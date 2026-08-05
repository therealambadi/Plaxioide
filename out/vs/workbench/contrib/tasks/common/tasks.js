import * as nls from "../../../../nls.js";
import * as Types from "../../../../base/common/types.js";
import * as resources from "../../../../base/common/resources.js";
import * as Objects from "../../../../base/common/objects.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { TaskDefinitionRegistry } from "./taskDefinitionRegistry.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
const USER_TASKS_GROUP_KEY = "settings";
const TASK_RUNNING_STATE = new RawContextKey("taskRunning", false, nls.localize("tasks.taskRunningContext", "Whether a task is currently running."));
const TASK_TERMINAL_ACTIVE = new RawContextKey("taskTerminalActive", false, nls.localize("taskTerminalActive", "Whether the active terminal is a task terminal."));
const TASKS_CATEGORY = nls.localize2("tasksCategory", "Tasks");
var ShellQuoting = /* @__PURE__ */ ((ShellQuoting2) => {
  ShellQuoting2[ShellQuoting2["Escape"] = 1] = "Escape";
  ShellQuoting2[ShellQuoting2["Strong"] = 2] = "Strong";
  ShellQuoting2[ShellQuoting2["Weak"] = 3] = "Weak";
  return ShellQuoting2;
})(ShellQuoting || {});
const CUSTOMIZED_TASK_TYPE = "$customized";
((ShellQuoting2) => {
  function from(value) {
    if (!value) {
      return 2 /* Strong */;
    }
    switch (value.toLowerCase()) {
      case "escape":
        return 1 /* Escape */;
      case "strong":
        return 2 /* Strong */;
      case "weak":
        return 3 /* Weak */;
      default:
        return 2 /* Strong */;
    }
  }
  ShellQuoting2.from = from;
})(ShellQuoting || (ShellQuoting = {}));
var CommandOptions;
((CommandOptions2) => {
  CommandOptions2.defaults = { cwd: "${workspaceFolder}" };
})(CommandOptions || (CommandOptions = {}));
var RevealKind = /* @__PURE__ */ ((RevealKind2) => {
  RevealKind2[RevealKind2["Always"] = 1] = "Always";
  RevealKind2[RevealKind2["Silent"] = 2] = "Silent";
  RevealKind2[RevealKind2["Never"] = 3] = "Never";
  return RevealKind2;
})(RevealKind || {});
((RevealKind2) => {
  function fromString(value) {
    switch (value.toLowerCase()) {
      case "always":
        return 1 /* Always */;
      case "silent":
        return 2 /* Silent */;
      case "never":
        return 3 /* Never */;
      default:
        return 1 /* Always */;
    }
  }
  RevealKind2.fromString = fromString;
})(RevealKind || (RevealKind = {}));
var RevealProblemKind = /* @__PURE__ */ ((RevealProblemKind2) => {
  RevealProblemKind2[RevealProblemKind2["Never"] = 1] = "Never";
  RevealProblemKind2[RevealProblemKind2["OnProblem"] = 2] = "OnProblem";
  RevealProblemKind2[RevealProblemKind2["Always"] = 3] = "Always";
  return RevealProblemKind2;
})(RevealProblemKind || {});
((RevealProblemKind2) => {
  function fromString(value) {
    switch (value.toLowerCase()) {
      case "always":
        return 3 /* Always */;
      case "never":
        return 1 /* Never */;
      case "onproblem":
        return 2 /* OnProblem */;
      default:
        return 2 /* OnProblem */;
    }
  }
  RevealProblemKind2.fromString = fromString;
})(RevealProblemKind || (RevealProblemKind = {}));
var PanelKind = /* @__PURE__ */ ((PanelKind2) => {
  PanelKind2[PanelKind2["Shared"] = 1] = "Shared";
  PanelKind2[PanelKind2["Dedicated"] = 2] = "Dedicated";
  PanelKind2[PanelKind2["New"] = 3] = "New";
  return PanelKind2;
})(PanelKind || {});
((PanelKind2) => {
  function fromString(value) {
    switch (value.toLowerCase()) {
      case "shared":
        return 1 /* Shared */;
      case "dedicated":
        return 2 /* Dedicated */;
      case "new":
        return 3 /* New */;
      default:
        return 1 /* Shared */;
    }
  }
  PanelKind2.fromString = fromString;
})(PanelKind || (PanelKind = {}));
var PresentationOptions;
((PresentationOptions2) => {
  PresentationOptions2.defaults = {
    echo: true,
    reveal: 1 /* Always */,
    revealProblems: 1 /* Never */,
    focus: false,
    panel: 1 /* Shared */,
    showReuseMessage: true,
    clear: false
  };
})(PresentationOptions || (PresentationOptions = {}));
var RuntimeType = /* @__PURE__ */ ((RuntimeType2) => {
  RuntimeType2[RuntimeType2["Shell"] = 1] = "Shell";
  RuntimeType2[RuntimeType2["Process"] = 2] = "Process";
  RuntimeType2[RuntimeType2["CustomExecution"] = 3] = "CustomExecution";
  return RuntimeType2;
})(RuntimeType || {});
((RuntimeType2) => {
  function fromString(value) {
    switch (value.toLowerCase()) {
      case "shell":
        return 1 /* Shell */;
      case "process":
        return 2 /* Process */;
      case "customExecution":
        return 3 /* CustomExecution */;
      default:
        return 2 /* Process */;
    }
  }
  RuntimeType2.fromString = fromString;
  function toString(value) {
    switch (value) {
      case 1 /* Shell */:
        return "shell";
      case 2 /* Process */:
        return "process";
      case 3 /* CustomExecution */:
        return "customExecution";
      default:
        return "process";
    }
  }
  RuntimeType2.toString = toString;
})(RuntimeType || (RuntimeType = {}));
var CommandString;
((CommandString2) => {
  function value(value2) {
    if (Types.isString(value2)) {
      return value2;
    } else {
      return value2.value;
    }
  }
  CommandString2.value = value;
})(CommandString || (CommandString = {}));
var TaskGroup;
((TaskGroup2) => {
  TaskGroup2.Clean = { _id: "clean", isDefault: false };
  TaskGroup2.Build = { _id: "build", isDefault: false };
  TaskGroup2.Rebuild = { _id: "rebuild", isDefault: false };
  TaskGroup2.Test = { _id: "test", isDefault: false };
  function is(value) {
    return value === TaskGroup2.Clean._id || value === TaskGroup2.Build._id || value === TaskGroup2.Rebuild._id || value === TaskGroup2.Test._id;
  }
  TaskGroup2.is = is;
  function from(value) {
    if (value === void 0) {
      return void 0;
    } else if (Types.isString(value)) {
      if (is(value)) {
        return { _id: value, isDefault: false };
      }
      return void 0;
    } else {
      return value;
    }
  }
  TaskGroup2.from = from;
})(TaskGroup || (TaskGroup = {}));
var TaskScope = /* @__PURE__ */ ((TaskScope2) => {
  TaskScope2[TaskScope2["Global"] = 1] = "Global";
  TaskScope2[TaskScope2["Workspace"] = 2] = "Workspace";
  TaskScope2[TaskScope2["Folder"] = 3] = "Folder";
  return TaskScope2;
})(TaskScope || {});
var TaskSourceKind;
((TaskSourceKind2) => {
  TaskSourceKind2.Workspace = "workspace";
  TaskSourceKind2.Extension = "extension";
  TaskSourceKind2.InMemory = "inMemory";
  TaskSourceKind2.WorkspaceFile = "workspaceFile";
  TaskSourceKind2.User = "user";
  function toConfigurationTarget(kind) {
    switch (kind) {
      case TaskSourceKind2.User:
        return ConfigurationTarget.USER;
      case TaskSourceKind2.WorkspaceFile:
        return ConfigurationTarget.WORKSPACE;
      default:
        return ConfigurationTarget.WORKSPACE_FOLDER;
    }
  }
  TaskSourceKind2.toConfigurationTarget = toConfigurationTarget;
})(TaskSourceKind || (TaskSourceKind = {}));
var DependsOrder = /* @__PURE__ */ ((DependsOrder2) => {
  DependsOrder2["parallel"] = "parallel";
  DependsOrder2["sequence"] = "sequence";
  return DependsOrder2;
})(DependsOrder || {});
var RunOnOptions = /* @__PURE__ */ ((RunOnOptions2) => {
  RunOnOptions2[RunOnOptions2["default"] = 1] = "default";
  RunOnOptions2[RunOnOptions2["folderOpen"] = 2] = "folderOpen";
  return RunOnOptions2;
})(RunOnOptions || {});
var RunOptions;
((RunOptions2) => {
  RunOptions2.defaults = { reevaluateOnRerun: true, runOn: 1 /* default */, instanceLimit: 1 };
})(RunOptions || (RunOptions = {}));
class CommonTask {
  constructor(id, label, type, runOptions, configurationProperties, source) {
    /**
     * The cached label.
     */
    this._label = "";
    this._id = id;
    if (label) {
      this._label = label;
    }
    if (type) {
      this.type = type;
    }
    this.runOptions = runOptions;
    this.configurationProperties = configurationProperties;
    this._source = source;
  }
  getDefinition(useSource) {
    return void 0;
  }
  getMapKey() {
    return this._id;
  }
  getKey() {
    return void 0;
  }
  getCommonTaskId() {
    const key = { folder: this.getFolderId(), id: this._id };
    return JSON.stringify(key);
  }
  clone() {
    return this.fromObject(Object.assign({}, this));
  }
  getWorkspaceFolder() {
    return void 0;
  }
  getWorkspaceFileName() {
    return void 0;
  }
  getTelemetryKind() {
    return "unknown";
  }
  matches(key, compareId = false) {
    if (key === void 0) {
      return false;
    }
    if (Types.isString(key)) {
      return key === this._label || key === this.configurationProperties.identifier || compareId && key === this._id;
    }
    const identifier = this.getDefinition(true);
    return identifier !== void 0 && identifier._key === key._key;
  }
  getQualifiedLabel() {
    const workspaceFolder = this.getWorkspaceFolder();
    if (workspaceFolder) {
      return `${this._label} (${workspaceFolder.name})`;
    } else {
      return this._label;
    }
  }
  getTaskExecution() {
    const result = {
      id: this._id,
      task: this
    };
    return result;
  }
  addTaskLoadMessages(messages) {
    if (this._taskLoadMessages === void 0) {
      this._taskLoadMessages = [];
    }
    if (messages) {
      this._taskLoadMessages = this._taskLoadMessages.concat(messages);
    }
  }
  get taskLoadMessages() {
    return this._taskLoadMessages;
  }
}
class CustomTask extends CommonTask {
  constructor(id, source, label, type, command, hasDefinedMatchers, runOptions, configurationProperties) {
    super(id, label, void 0, runOptions, configurationProperties, source);
    /**
     * The command configuration
     */
    this.command = {};
    this._source = source;
    this.hasDefinedMatchers = hasDefinedMatchers;
    if (command) {
      this.command = command;
    }
  }
  clone() {
    return new CustomTask(this._id, this._source, this._label, this.type, this.command, this.hasDefinedMatchers, this.runOptions, this.configurationProperties);
  }
  customizes() {
    if (this._source && this._source.customizes) {
      return this._source.customizes;
    }
    return void 0;
  }
  getDefinition(useSource = false) {
    if (useSource && this._source.customizes !== void 0) {
      return this._source.customizes;
    } else {
      let type;
      const commandRuntime = this.command ? this.command.runtime : void 0;
      switch (commandRuntime) {
        case 1 /* Shell */:
          type = "shell";
          break;
        case 2 /* Process */:
          type = "process";
          break;
        case 3 /* CustomExecution */:
          type = "customExecution";
          break;
        case void 0:
          type = "$composite";
          break;
        default:
          throw new Error("Unexpected task runtime");
      }
      const result = {
        type,
        _key: this._id,
        id: this._id
      };
      return result;
    }
  }
  static is(value) {
    return value instanceof CustomTask;
  }
  getMapKey() {
    const workspaceFolder = this._source.config.workspaceFolder;
    return workspaceFolder ? `${workspaceFolder.uri.toString()}|${this._id}|${this.instance}` : `${this._id}|${this.instance}`;
  }
  getFolderId() {
    return this._source.kind === TaskSourceKind.User ? USER_TASKS_GROUP_KEY : this._source.config.workspaceFolder?.uri.toString();
  }
  getCommonTaskId() {
    return this._source.customizes ? super.getCommonTaskId() : this.getKey() ?? super.getCommonTaskId();
  }
  /**
   * @returns A key representing the task
   */
  getKey() {
    const workspaceFolder = this.getFolderId();
    if (!workspaceFolder) {
      return void 0;
    }
    let id = this.configurationProperties.identifier;
    if (this._source.kind !== TaskSourceKind.Workspace) {
      id += this._source.kind;
    }
    const key = { type: CUSTOMIZED_TASK_TYPE, folder: workspaceFolder, id };
    return JSON.stringify(key);
  }
  getWorkspaceFolder() {
    return this._source.config.workspaceFolder;
  }
  getWorkspaceFileName() {
    return this._source.config.workspace && this._source.config.workspace.configuration ? resources.basename(this._source.config.workspace.configuration) : void 0;
  }
  getTelemetryKind() {
    if (this._source.customizes) {
      return "workspace>extension";
    } else {
      return "workspace";
    }
  }
  fromObject(object) {
    return new CustomTask(object._id, object._source, object._label, object.type, object.command, object.hasDefinedMatchers, object.runOptions, object.configurationProperties);
  }
}
class ConfiguringTask extends CommonTask {
  constructor(id, source, label, type, configures, runOptions, configurationProperties) {
    super(id, label, type, runOptions, configurationProperties, source);
    this._source = source;
    this.configures = configures;
  }
  static is(value) {
    return value instanceof ConfiguringTask;
  }
  fromObject(object) {
    return object;
  }
  getDefinition() {
    return this.configures;
  }
  getWorkspaceFileName() {
    return this._source.config.workspace && this._source.config.workspace.configuration ? resources.basename(this._source.config.workspace.configuration) : void 0;
  }
  getWorkspaceFolder() {
    return this._source.config.workspaceFolder;
  }
  getFolderId() {
    return this._source.kind === TaskSourceKind.User ? USER_TASKS_GROUP_KEY : this._source.config.workspaceFolder?.uri.toString();
  }
  getKey() {
    const workspaceFolder = this.getFolderId();
    if (!workspaceFolder) {
      return void 0;
    }
    let id = this.configurationProperties.identifier;
    if (this._source.kind !== TaskSourceKind.Workspace) {
      id += this._source.kind;
    }
    const key = { type: CUSTOMIZED_TASK_TYPE, folder: workspaceFolder, id };
    return JSON.stringify(key);
  }
}
class ContributedTask extends CommonTask {
  constructor(id, source, label, type, defines, command, hasDefinedMatchers, runOptions, configurationProperties) {
    super(id, label, type, runOptions, configurationProperties, source);
    this.defines = defines;
    this.hasDefinedMatchers = hasDefinedMatchers;
    this.command = command;
    this.icon = configurationProperties.icon;
    this.hide = configurationProperties.hide;
  }
  clone() {
    return new ContributedTask(this._id, this._source, this._label, this.type, this.defines, this.command, this.hasDefinedMatchers, this.runOptions, this.configurationProperties);
  }
  getDefinition() {
    return this.defines;
  }
  static is(value) {
    return value instanceof ContributedTask;
  }
  getMapKey() {
    const workspaceFolder = this._source.workspaceFolder;
    return workspaceFolder ? `${this._source.scope.toString()}|${workspaceFolder.uri.toString()}|${this._id}|${this.instance}` : `${this._source.scope.toString()}|${this._id}|${this.instance}`;
  }
  getFolderId() {
    if (this._source.scope === 3 /* Folder */ && this._source.workspaceFolder) {
      return this._source.workspaceFolder.uri.toString();
    }
    return void 0;
  }
  getKey() {
    const key = { type: "contributed", scope: this._source.scope, id: this._id };
    key.folder = this.getFolderId();
    return JSON.stringify(key);
  }
  getWorkspaceFolder() {
    return this._source.workspaceFolder;
  }
  getTelemetryKind() {
    return "extension";
  }
  fromObject(object) {
    return new ContributedTask(object._id, object._source, object._label, object.type, object.defines, object.command, object.hasDefinedMatchers, object.runOptions, object.configurationProperties);
  }
}
class InMemoryTask extends CommonTask {
  constructor(id, source, label, type, runOptions, configurationProperties) {
    super(id, label, type, runOptions, configurationProperties, source);
    this._source = source;
  }
  clone() {
    return new InMemoryTask(this._id, this._source, this._label, this.type, this.runOptions, this.configurationProperties);
  }
  static is(value) {
    return value instanceof InMemoryTask;
  }
  getTelemetryKind() {
    return "composite";
  }
  getMapKey() {
    return `${this._id}|${this.instance}`;
  }
  getFolderId() {
    return void 0;
  }
  fromObject(object) {
    return new InMemoryTask(object._id, object._source, object._label, object.type, object.runOptions, object.configurationProperties);
  }
}
var ExecutionEngine = /* @__PURE__ */ ((ExecutionEngine2) => {
  ExecutionEngine2[ExecutionEngine2["Process"] = 1] = "Process";
  ExecutionEngine2[ExecutionEngine2["Terminal"] = 2] = "Terminal";
  return ExecutionEngine2;
})(ExecutionEngine || {});
((ExecutionEngine2) => {
  ExecutionEngine2._default = 2 /* Terminal */;
})(ExecutionEngine || (ExecutionEngine = {}));
var JsonSchemaVersion = /* @__PURE__ */ ((JsonSchemaVersion2) => {
  JsonSchemaVersion2[JsonSchemaVersion2["V0_1_0"] = 1] = "V0_1_0";
  JsonSchemaVersion2[JsonSchemaVersion2["V2_0_0"] = 2] = "V2_0_0";
  return JsonSchemaVersion2;
})(JsonSchemaVersion || {});
class TaskSorter {
  constructor(workspaceFolders) {
    this._order = /* @__PURE__ */ new Map();
    for (let i = 0; i < workspaceFolders.length; i++) {
      this._order.set(workspaceFolders[i].uri.toString(), i);
    }
  }
  compare(a, b) {
    const aw = a.getWorkspaceFolder();
    const bw = b.getWorkspaceFolder();
    if (aw && bw) {
      let ai = this._order.get(aw.uri.toString());
      ai = ai === void 0 ? 0 : ai + 1;
      let bi = this._order.get(bw.uri.toString());
      bi = bi === void 0 ? 0 : bi + 1;
      if (ai === bi) {
        return a._label.localeCompare(b._label);
      } else {
        return ai - bi;
      }
    } else if (!aw && bw) {
      return -1;
    } else if (aw && !bw) {
      return 1;
    } else {
      return 0;
    }
  }
}
var TaskRunType = /* @__PURE__ */ ((TaskRunType2) => {
  TaskRunType2["SingleRun"] = "singleRun";
  TaskRunType2["Background"] = "background";
  return TaskRunType2;
})(TaskRunType || {});
var TaskEventKind = /* @__PURE__ */ ((TaskEventKind2) => {
  TaskEventKind2["Changed"] = "changed";
  TaskEventKind2["ProcessStarted"] = "processStarted";
  TaskEventKind2["ProcessEnded"] = "processEnded";
  TaskEventKind2["Terminated"] = "terminated";
  TaskEventKind2["Start"] = "start";
  TaskEventKind2["AcquiredInput"] = "acquiredInput";
  TaskEventKind2["DependsOnStarted"] = "dependsOnStarted";
  TaskEventKind2["Active"] = "active";
  TaskEventKind2["Inactive"] = "inactive";
  TaskEventKind2["End"] = "end";
  TaskEventKind2["ProblemMatcherStarted"] = "problemMatcherStarted";
  TaskEventKind2["ProblemMatcherEnded"] = "problemMatcherEnded";
  TaskEventKind2["ProblemMatcherFoundErrors"] = "problemMatcherFoundErrors";
  return TaskEventKind2;
})(TaskEventKind || {});
var TaskRunSource = /* @__PURE__ */ ((TaskRunSource2) => {
  TaskRunSource2[TaskRunSource2["System"] = 0] = "System";
  TaskRunSource2[TaskRunSource2["User"] = 1] = "User";
  TaskRunSource2[TaskRunSource2["FolderOpen"] = 2] = "FolderOpen";
  TaskRunSource2[TaskRunSource2["ConfigurationChange"] = 3] = "ConfigurationChange";
  TaskRunSource2[TaskRunSource2["Reconnect"] = 4] = "Reconnect";
  return TaskRunSource2;
})(TaskRunSource || {});
var TaskEvent;
((TaskEvent2) => {
  function common(task) {
    return {
      taskId: task._id,
      taskName: task.configurationProperties.name,
      runType: task.configurationProperties.isBackground ? "background" /* Background */ : "singleRun" /* SingleRun */,
      group: task.configurationProperties.group,
      __task: task
    };
  }
  function start(task, terminalId, resolvedVariables) {
    return {
      ...common(task),
      kind: "start" /* Start */,
      terminalId,
      resolvedVariables
    };
  }
  TaskEvent2.start = start;
  function processStarted(task, terminalId, processId) {
    return {
      ...common(task),
      kind: "processStarted" /* ProcessStarted */,
      terminalId,
      processId
    };
  }
  TaskEvent2.processStarted = processStarted;
  function processEnded(task, terminalId, exitCode) {
    return {
      ...common(task),
      kind: "processEnded" /* ProcessEnded */,
      terminalId,
      exitCode
    };
  }
  TaskEvent2.processEnded = processEnded;
  function terminated(task, terminalId, exitReason) {
    return {
      ...common(task),
      kind: "terminated" /* Terminated */,
      exitReason,
      terminalId
    };
  }
  TaskEvent2.terminated = terminated;
  function general(kind, task, terminalId) {
    return {
      ...common(task),
      kind,
      terminalId
    };
  }
  TaskEvent2.general = general;
  function changed() {
    return { kind: "changed" /* Changed */ };
  }
  TaskEvent2.changed = changed;
})(TaskEvent || (TaskEvent = {}));
var KeyedTaskIdentifier;
((KeyedTaskIdentifier2) => {
  function sortedStringify(literal) {
    const keys = Object.keys(literal).sort();
    let result = "";
    for (const key of keys) {
      let stringified = literal[key];
      if (stringified instanceof Object) {
        stringified = sortedStringify(stringified);
      } else if (typeof stringified === "string") {
        stringified = stringified.replace(/,/g, ",,");
      }
      result += key + "," + stringified + ",";
    }
    return result;
  }
  function create(value) {
    const resultKey = sortedStringify(value);
    const result = { _key: resultKey, type: value.taskType };
    Object.assign(result, value);
    return result;
  }
  KeyedTaskIdentifier2.create = create;
})(KeyedTaskIdentifier || (KeyedTaskIdentifier = {}));
var TaskSettingId = /* @__PURE__ */ ((TaskSettingId2) => {
  TaskSettingId2["AutoDetect"] = "task.autoDetect";
  TaskSettingId2["SaveBeforeRun"] = "task.saveBeforeRun";
  TaskSettingId2["ShowDecorations"] = "task.showDecorations";
  TaskSettingId2["ProblemMatchersNeverPrompt"] = "task.problemMatchers.neverPrompt";
  TaskSettingId2["SlowProviderWarning"] = "task.slowProviderWarning";
  TaskSettingId2["QuickOpenHistory"] = "task.quickOpen.history";
  TaskSettingId2["QuickOpenDetail"] = "task.quickOpen.detail";
  TaskSettingId2["QuickOpenSkip"] = "task.quickOpen.skip";
  TaskSettingId2["QuickOpenShowAll"] = "task.quickOpen.showAll";
  TaskSettingId2["AllowAutomaticTasks"] = "task.allowAutomaticTasks";
  TaskSettingId2["Reconnection"] = "task.reconnection";
  TaskSettingId2["VerboseLogging"] = "task.verboseLogging";
  return TaskSettingId2;
})(TaskSettingId || {});
var TasksSchemaProperties = /* @__PURE__ */ ((TasksSchemaProperties2) => {
  TasksSchemaProperties2["Tasks"] = "tasks";
  TasksSchemaProperties2["SuppressTaskName"] = "tasks.suppressTaskName";
  TasksSchemaProperties2["Windows"] = "tasks.windows";
  TasksSchemaProperties2["Osx"] = "tasks.osx";
  TasksSchemaProperties2["Linux"] = "tasks.linux";
  TasksSchemaProperties2["ShowOutput"] = "tasks.showOutput";
  TasksSchemaProperties2["IsShellCommand"] = "tasks.isShellCommand";
  TasksSchemaProperties2["ServiceTestSetting"] = "tasks.service.testSetting";
  return TasksSchemaProperties2;
})(TasksSchemaProperties || {});
var TaskDefinition;
((TaskDefinition2) => {
  function createTaskIdentifier(external, reporter) {
    const definition = TaskDefinitionRegistry.get(external.type);
    if (definition === void 0) {
      const copy = Objects.deepClone(external);
      delete copy._key;
      return KeyedTaskIdentifier.create(copy);
    }
    const literal = /* @__PURE__ */ Object.create(null);
    literal.type = definition.taskType;
    const required = /* @__PURE__ */ new Set();
    definition.required.forEach((element) => required.add(element));
    const properties = definition.properties;
    for (const property of Object.keys(properties)) {
      const value = external[property];
      if (value !== void 0 && value !== null) {
        literal[property] = value;
      } else if (required.has(property)) {
        const schema = properties[property];
        if (schema.default !== void 0) {
          literal[property] = Objects.deepClone(schema.default);
        } else {
          switch (schema.type) {
            case "boolean":
              literal[property] = false;
              break;
            case "number":
            case "integer":
              literal[property] = 0;
              break;
            case "string":
              literal[property] = "";
              break;
            default:
              reporter.error(nls.localize(
                "TaskDefinition.missingRequiredProperty",
                "Error: the task identifier '{0}' is missing the required property '{1}'. The task identifier will be ignored.",
                JSON.stringify(external, void 0, 0),
                property
              ));
              return void 0;
          }
        }
      }
    }
    return KeyedTaskIdentifier.create(literal);
  }
  TaskDefinition2.createTaskIdentifier = createTaskIdentifier;
})(TaskDefinition || (TaskDefinition = {}));
export {
  CUSTOMIZED_TASK_TYPE,
  CommandOptions,
  CommandString,
  CommonTask,
  ConfiguringTask,
  ContributedTask,
  CustomTask,
  DependsOrder,
  ExecutionEngine,
  InMemoryTask,
  JsonSchemaVersion,
  KeyedTaskIdentifier,
  PanelKind,
  PresentationOptions,
  RevealKind,
  RevealProblemKind,
  RunOnOptions,
  RunOptions,
  RuntimeType,
  ShellQuoting,
  TASKS_CATEGORY,
  TASK_RUNNING_STATE,
  TASK_TERMINAL_ACTIVE,
  TaskDefinition,
  TaskEvent,
  TaskEventKind,
  TaskGroup,
  TaskRunSource,
  TaskRunType,
  TaskScope,
  TaskSettingId,
  TaskSorter,
  TaskSourceKind,
  TasksSchemaProperties,
  USER_TASKS_GROUP_KEY
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vdGFza3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIFR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWFNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCAqIGFzIE9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBVcmlDb21wb25lbnRzLCBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuXG5pbXBvcnQgeyBQcm9ibGVtTWF0Y2hlciB9IGZyb20gJy4vcHJvYmxlbU1hdGNoZXIuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlciwgSVdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFJhd0NvbnRleHRLZXksIENvbnRleHRLZXlFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi90YXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVybWluYWxFeGl0UmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcblxuXG5cbmV4cG9ydCBjb25zdCBVU0VSX1RBU0tTX0dST1VQX0tFWSA9ICdzZXR0aW5ncyc7XG5cbmV4cG9ydCBjb25zdCBUQVNLX1JVTk5JTkdfU1RBVEUgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigndGFza1J1bm5pbmcnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCd0YXNrcy50YXNrUnVubmluZ0NvbnRleHQnLCBcIldoZXRoZXIgYSB0YXNrIGlzIGN1cnJlbnRseSBydW5uaW5nLlwiKSk7XG4vKiogV2hldGhlciB0aGUgYWN0aXZlIHRlcm1pbmFsIGlzIGEgdGFzayB0ZXJtaW5hbC4gKi9cbmV4cG9ydCBjb25zdCBUQVNLX1RFUk1JTkFMX0FDVElWRSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0YXNrVGVybWluYWxBY3RpdmUnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCd0YXNrVGVybWluYWxBY3RpdmUnLCBcIldoZXRoZXIgdGhlIGFjdGl2ZSB0ZXJtaW5hbCBpcyBhIHRhc2sgdGVybWluYWwuXCIpKTtcbmV4cG9ydCBjb25zdCBUQVNLU19DQVRFR09SWSA9IG5scy5sb2NhbGl6ZTIoJ3Rhc2tzQ2F0ZWdvcnknLCBcIlRhc2tzXCIpO1xuXG5leHBvcnQgZW51bSBTaGVsbFF1b3Rpbmcge1xuXHQvKipcblx0ICogVXNlIGNoYXJhY3RlciBlc2NhcGluZy5cblx0ICovXG5cdEVzY2FwZSA9IDEsXG5cblx0LyoqXG5cdCAqIFVzZSBzdHJvbmcgcXVvdGluZ1xuXHQgKi9cblx0U3Ryb25nID0gMixcblxuXHQvKipcblx0ICogVXNlIHdlYWsgcXVvdGluZy5cblx0ICovXG5cdFdlYWsgPSAzLFxufVxuXG5leHBvcnQgY29uc3QgQ1VTVE9NSVpFRF9UQVNLX1RZUEUgPSAnJGN1c3RvbWl6ZWQnO1xuXG5leHBvcnQgbmFtZXNwYWNlIFNoZWxsUXVvdGluZyB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHRoaXM6IHZvaWQsIHZhbHVlOiBzdHJpbmcpOiBTaGVsbFF1b3Rpbmcge1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHJldHVybiBTaGVsbFF1b3RpbmcuU3Ryb25nO1xuXHRcdH1cblx0XHRzd2l0Y2ggKHZhbHVlLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdGNhc2UgJ2VzY2FwZSc6XG5cdFx0XHRcdHJldHVybiBTaGVsbFF1b3RpbmcuRXNjYXBlO1xuXHRcdFx0Y2FzZSAnc3Ryb25nJzpcblx0XHRcdFx0cmV0dXJuIFNoZWxsUXVvdGluZy5TdHJvbmc7XG5cdFx0XHRjYXNlICd3ZWFrJzpcblx0XHRcdFx0cmV0dXJuIFNoZWxsUXVvdGluZy5XZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIFNoZWxsUXVvdGluZy5TdHJvbmc7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNoZWxsUXVvdGluZ09wdGlvbnMge1xuXHQvKipcblx0ICogVGhlIGNoYXJhY3RlciB1c2VkIHRvIGRvIGNoYXJhY3RlciBlc2NhcGluZy5cblx0ICovXG5cdGVzY2FwZT86IHN0cmluZyB8IHtcblx0XHRlc2NhcGVDaGFyOiBzdHJpbmc7XG5cdFx0Y2hhcnNUb0VzY2FwZTogc3RyaW5nO1xuXHR9O1xuXG5cdC8qKlxuXHQgKiBUaGUgY2hhcmFjdGVyIHVzZWQgZm9yIHN0cmluZyBxdW90aW5nLlxuXHQgKi9cblx0c3Ryb25nPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgY2hhcmFjdGVyIHVzZWQgZm9yIHdlYWsgcXVvdGluZy5cblx0ICovXG5cdHdlYWs/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNoZWxsQ29uZmlndXJhdGlvbiB7XG5cdC8qKlxuXHQgKiBUaGUgc2hlbGwgZXhlY3V0YWJsZS5cblx0ICovXG5cdGV4ZWN1dGFibGU/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBhcmd1bWVudHMgdG8gYmUgcGFzc2VkIHRvIHRoZSBzaGVsbCBleGVjdXRhYmxlLlxuXHQgKi9cblx0YXJncz86IHN0cmluZ1tdO1xuXG5cdC8qKlxuXHQgKiBXaGljaCBraW5kIG9mIHF1b3RlcyB0aGUgc2hlbGwgc3VwcG9ydHMuXG5cdCAqL1xuXHRxdW90aW5nPzogSVNoZWxsUXVvdGluZ09wdGlvbnM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29tbWFuZE9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBUaGUgc2hlbGwgdG8gdXNlIGlmIHRoZSB0YXNrIGlzIGEgc2hlbGwgY29tbWFuZC5cblx0ICovXG5cdHNoZWxsPzogSVNoZWxsQ29uZmlndXJhdGlvbjtcblxuXHQvKipcblx0ICogVGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnkgb2YgdGhlIGV4ZWN1dGVkIHByb2dyYW0gb3Igc2hlbGwuXG5cdCAqIElmIG9taXR0ZWQgVlNDb2RlJ3MgY3VycmVudCB3b3Jrc3BhY2Ugcm9vdCBpcyB1c2VkLlxuXHQgKi9cblx0Y3dkPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgZW52aXJvbm1lbnQgb2YgdGhlIGV4ZWN1dGVkIHByb2dyYW0gb3Igc2hlbGwuIElmIG9taXR0ZWRcblx0ICogdGhlIHBhcmVudCBwcm9jZXNzJyBlbnZpcm9ubWVudCBpcyB1c2VkLlxuXHQgKi9cblx0ZW52PzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBDb21tYW5kT3B0aW9ucyB7XG5cdGV4cG9ydCBjb25zdCBkZWZhdWx0czogQ29tbWFuZE9wdGlvbnMgPSB7IGN3ZDogJyR7d29ya3NwYWNlRm9sZGVyfScgfTtcbn1cblxuZXhwb3J0IGVudW0gUmV2ZWFsS2luZCB7XG5cdC8qKlxuXHQgKiBBbHdheXMgYnJpbmdzIHRoZSB0ZXJtaW5hbCB0byBmcm9udCBpZiB0aGUgdGFzayBpcyBleGVjdXRlZC5cblx0ICovXG5cdEFsd2F5cyA9IDEsXG5cblx0LyoqXG5cdCAqIE9ubHkgYnJpbmdzIHRoZSB0ZXJtaW5hbCB0byBmcm9udCBpZiBhIHByb2JsZW0gaXMgZGV0ZWN0ZWQgZXhlY3V0aW5nIHRoZSB0YXNrXG5cdCAqIGUuZy4gdGhlIHRhc2sgY291bGRuJ3QgYmUgc3RhcnRlZCxcblx0ICogdGhlIHRhc2sgZW5kZWQgd2l0aCBhbiBleGl0IGNvZGUgb3RoZXIgdGhhbiB6ZXJvLFxuXHQgKiBvciB0aGUgcHJvYmxlbSBtYXRjaGVyIGZvdW5kIGFuIGVycm9yLlxuXHQgKi9cblx0U2lsZW50ID0gMixcblxuXHQvKipcblx0ICogVGhlIHRlcm1pbmFsIG5ldmVyIGNvbWVzIHRvIGZyb250IHdoZW4gdGhlIHRhc2sgaXMgZXhlY3V0ZWQuXG5cdCAqL1xuXHROZXZlciA9IDNcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBSZXZlYWxLaW5kIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21TdHJpbmcodGhpczogdm9pZCwgdmFsdWU6IHN0cmluZyk6IFJldmVhbEtpbmQge1xuXHRcdHN3aXRjaCAodmFsdWUudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0Y2FzZSAnYWx3YXlzJzpcblx0XHRcdFx0cmV0dXJuIFJldmVhbEtpbmQuQWx3YXlzO1xuXHRcdFx0Y2FzZSAnc2lsZW50Jzpcblx0XHRcdFx0cmV0dXJuIFJldmVhbEtpbmQuU2lsZW50O1xuXHRcdFx0Y2FzZSAnbmV2ZXInOlxuXHRcdFx0XHRyZXR1cm4gUmV2ZWFsS2luZC5OZXZlcjtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBSZXZlYWxLaW5kLkFsd2F5cztcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gUmV2ZWFsUHJvYmxlbUtpbmQge1xuXHQvKipcblx0ICogTmV2ZXIgcmV2ZWFscyB0aGUgcHJvYmxlbXMgcGFuZWwgd2hlbiB0aGlzIHRhc2sgaXMgZXhlY3V0ZWQuXG5cdCAqL1xuXHROZXZlciA9IDEsXG5cblxuXHQvKipcblx0ICogT25seSByZXZlYWxzIHRoZSBwcm9ibGVtcyBwYW5lbCBpZiBhIHByb2JsZW0gaXMgZm91bmQuXG5cdCAqL1xuXHRPblByb2JsZW0gPSAyLFxuXG5cdC8qKlxuXHQgKiBOZXZlciByZXZlYWxzIHRoZSBwcm9ibGVtcyBwYW5lbCB3aGVuIHRoaXMgdGFzayBpcyBleGVjdXRlZC5cblx0ICovXG5cdEFsd2F5cyA9IDNcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBSZXZlYWxQcm9ibGVtS2luZCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tU3RyaW5nKHRoaXM6IHZvaWQsIHZhbHVlOiBzdHJpbmcpOiBSZXZlYWxQcm9ibGVtS2luZCB7XG5cdFx0c3dpdGNoICh2YWx1ZS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRjYXNlICdhbHdheXMnOlxuXHRcdFx0XHRyZXR1cm4gUmV2ZWFsUHJvYmxlbUtpbmQuQWx3YXlzO1xuXHRcdFx0Y2FzZSAnbmV2ZXInOlxuXHRcdFx0XHRyZXR1cm4gUmV2ZWFsUHJvYmxlbUtpbmQuTmV2ZXI7XG5cdFx0XHRjYXNlICdvbnByb2JsZW0nOlxuXHRcdFx0XHRyZXR1cm4gUmV2ZWFsUHJvYmxlbUtpbmQuT25Qcm9ibGVtO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIFJldmVhbFByb2JsZW1LaW5kLk9uUHJvYmxlbTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGVudW0gUGFuZWxLaW5kIHtcblxuXHQvKipcblx0ICogU2hhcmVzIGEgcGFuZWwgd2l0aCBvdGhlciB0YXNrcy4gVGhpcyBpcyB0aGUgZGVmYXVsdC5cblx0ICovXG5cdFNoYXJlZCA9IDEsXG5cblx0LyoqXG5cdCAqIFVzZXMgYSBkZWRpY2F0ZWQgcGFuZWwgZm9yIHRoaXMgdGFza3MuIFRoZSBwYW5lbCBpcyBub3Rcblx0ICogc2hhcmVkIHdpdGggb3RoZXIgdGFza3MuXG5cdCAqL1xuXHREZWRpY2F0ZWQgPSAyLFxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHBhbmVsIHdoZW5ldmVyIHRoaXMgdGFzayBpcyBleGVjdXRlZC5cblx0ICovXG5cdE5ldyA9IDNcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBQYW5lbEtpbmQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVN0cmluZyh2YWx1ZTogc3RyaW5nKTogUGFuZWxLaW5kIHtcblx0XHRzd2l0Y2ggKHZhbHVlLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdGNhc2UgJ3NoYXJlZCc6XG5cdFx0XHRcdHJldHVybiBQYW5lbEtpbmQuU2hhcmVkO1xuXHRcdFx0Y2FzZSAnZGVkaWNhdGVkJzpcblx0XHRcdFx0cmV0dXJuIFBhbmVsS2luZC5EZWRpY2F0ZWQ7XG5cdFx0XHRjYXNlICduZXcnOlxuXHRcdFx0XHRyZXR1cm4gUGFuZWxLaW5kLk5ldztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBQYW5lbEtpbmQuU2hhcmVkO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcmVzZW50YXRpb25PcHRpb25zIHtcblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHRhc2sgb3V0cHV0IGlzIHJldmVhbCBpbiB0aGUgdXNlciBpbnRlcmZhY2UuXG5cdCAqIERlZmF1bHRzIHRvIGBSZXZlYWxLaW5kLkFsd2F5c2AuXG5cdCAqL1xuXHRyZXZlYWw6IFJldmVhbEtpbmQ7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHByb2JsZW1zIHBhbmUgaXMgcmV2ZWFsZWQgd2hlbiBydW5uaW5nIHRoaXMgdGFzayBvciBub3QuXG5cdCAqIERlZmF1bHRzIHRvIGBSZXZlYWxQcm9ibGVtS2luZC5OZXZlcmAuXG5cdCAqL1xuXHRyZXZlYWxQcm9ibGVtczogUmV2ZWFsUHJvYmxlbUtpbmQ7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIGNvbW1hbmQgYXNzb2NpYXRlZCB3aXRoIHRoZSB0YXNrIGlzIGVjaG9lZFxuXHQgKiBpbiB0aGUgdXNlciBpbnRlcmZhY2UuXG5cdCAqL1xuXHRlY2hvOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBwYW5lbCBzaG93aW5nIHRoZSB0YXNrIG91dHB1dCBpcyB0YWtpbmcgZm9jdXMuXG5cdCAqL1xuXHRmb2N1czogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQ29udHJvbHMgaWYgdGhlIHRhc2sgcGFuZWwgaXMgdXNlZCBmb3IgdGhpcyB0YXNrIG9ubHkgKGRlZGljYXRlZCksXG5cdCAqIHNoYXJlZCBiZXR3ZWVuIHRhc2tzIChzaGFyZWQpIG9yIGlmIGEgbmV3IHBhbmVsIGlzIGNyZWF0ZWQgb25cblx0ICogZXZlcnkgdGFzayBleGVjdXRpb24gKG5ldykuIERlZmF1bHRzIHRvIGBUYXNrSW5zdGFuY2VLaW5kLlNoYXJlZGBcblx0ICovXG5cdHBhbmVsOiBQYW5lbEtpbmQ7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdG8gc2hvdyB0aGUgXCJUZXJtaW5hbCB3aWxsIGJlIHJldXNlZCBieSB0YXNrcywgcHJlc3MgYW55IGtleSB0byBjbG9zZSBpdFwiIG1lc3NhZ2UuXG5cdCAqL1xuXHRzaG93UmV1c2VNZXNzYWdlOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRvIGNsZWFyIHRoZSB0ZXJtaW5hbCBiZWZvcmUgZXhlY3V0aW5nIHRoZSB0YXNrLlxuXHQgKi9cblx0Y2xlYXI6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHRhc2sgaXMgZXhlY3V0ZWQgaW4gYSBzcGVjaWZpYyB0ZXJtaW5hbCBncm91cCB1c2luZyBzcGxpdCBwYW5lcy5cblx0ICovXG5cdGdyb3VwPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSB0ZXJtaW5hbCB0aGF0IHRoZSB0YXNrIHJ1bnMgaW4gaXMgY2xvc2VkIHdoZW4gdGhlIHRhc2sgY29tcGxldGVzLlxuXHQgKi9cblx0Y2xvc2U/OiBib29sZWFuO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIFByZXNlbnRhdGlvbk9wdGlvbnMge1xuXHRleHBvcnQgY29uc3QgZGVmYXVsdHM6IElQcmVzZW50YXRpb25PcHRpb25zID0ge1xuXHRcdGVjaG86IHRydWUsIHJldmVhbDogUmV2ZWFsS2luZC5BbHdheXMsIHJldmVhbFByb2JsZW1zOiBSZXZlYWxQcm9ibGVtS2luZC5OZXZlciwgZm9jdXM6IGZhbHNlLCBwYW5lbDogUGFuZWxLaW5kLlNoYXJlZCwgc2hvd1JldXNlTWVzc2FnZTogdHJ1ZSwgY2xlYXI6IGZhbHNlXG5cdH07XG59XG5cbmV4cG9ydCBlbnVtIFJ1bnRpbWVUeXBlIHtcblx0U2hlbGwgPSAxLFxuXHRQcm9jZXNzID0gMixcblx0Q3VzdG9tRXhlY3V0aW9uID0gM1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIFJ1bnRpbWVUeXBlIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21TdHJpbmcodmFsdWU6IHN0cmluZyk6IFJ1bnRpbWVUeXBlIHtcblx0XHRzd2l0Y2ggKHZhbHVlLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdGNhc2UgJ3NoZWxsJzpcblx0XHRcdFx0cmV0dXJuIFJ1bnRpbWVUeXBlLlNoZWxsO1xuXHRcdFx0Y2FzZSAncHJvY2Vzcyc6XG5cdFx0XHRcdHJldHVybiBSdW50aW1lVHlwZS5Qcm9jZXNzO1xuXHRcdFx0Y2FzZSAnY3VzdG9tRXhlY3V0aW9uJzpcblx0XHRcdFx0cmV0dXJuIFJ1bnRpbWVUeXBlLkN1c3RvbUV4ZWN1dGlvbjtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBSdW50aW1lVHlwZS5Qcm9jZXNzO1xuXHRcdH1cblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gdG9TdHJpbmcodmFsdWU6IFJ1bnRpbWVUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHZhbHVlKSB7XG5cdFx0XHRjYXNlIFJ1bnRpbWVUeXBlLlNoZWxsOiByZXR1cm4gJ3NoZWxsJztcblx0XHRcdGNhc2UgUnVudGltZVR5cGUuUHJvY2VzczogcmV0dXJuICdwcm9jZXNzJztcblx0XHRcdGNhc2UgUnVudGltZVR5cGUuQ3VzdG9tRXhlY3V0aW9uOiByZXR1cm4gJ2N1c3RvbUV4ZWN1dGlvbic7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gJ3Byb2Nlc3MnO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElRdW90ZWRTdHJpbmcge1xuXHR2YWx1ZTogc3RyaW5nO1xuXHRxdW90aW5nOiBTaGVsbFF1b3Rpbmc7XG59XG5cbmV4cG9ydCB0eXBlIENvbW1hbmRTdHJpbmcgPSBzdHJpbmcgfCBJUXVvdGVkU3RyaW5nO1xuXG5leHBvcnQgbmFtZXNwYWNlIENvbW1hbmRTdHJpbmcge1xuXHRleHBvcnQgZnVuY3Rpb24gdmFsdWUodmFsdWU6IENvbW1hbmRTdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHZhbHVlLnZhbHVlO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21tYW5kQ29uZmlndXJhdGlvbiB7XG5cblx0LyoqXG5cdCAqIFRoZSB0YXNrIHR5cGVcblx0ICovXG5cdHJ1bnRpbWU/OiBSdW50aW1lVHlwZTtcblxuXHQvKipcblx0ICogVGhlIGNvbW1hbmQgdG8gZXhlY3V0ZVxuXHQgKi9cblx0bmFtZT86IENvbW1hbmRTdHJpbmc7XG5cblx0LyoqXG5cdCAqIEFkZGl0aW9uYWwgY29tbWFuZCBvcHRpb25zLlxuXHQgKi9cblx0b3B0aW9ucz86IENvbW1hbmRPcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBDb21tYW5kIGFyZ3VtZW50cy5cblx0ICovXG5cdGFyZ3M/OiBDb21tYW5kU3RyaW5nW107XG5cblx0LyoqXG5cdCAqIFRoZSB0YXNrIHNlbGVjdG9yIGlmIG5lZWRlZC5cblx0ICovXG5cdHRhc2tTZWxlY3Rvcj86IHN0cmluZztcblxuXHQvKipcblx0ICogV2hldGhlciB0byBzdXBwcmVzcyB0aGUgdGFzayBuYW1lIHdoZW4gbWVyZ2luZyBnbG9iYWwgYXJnc1xuXHQgKlxuXHQgKi9cblx0c3VwcHJlc3NUYXNrTmFtZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIERlc2NyaWJlcyBob3cgdGhlIHRhc2sgaXMgcHJlc2VudGVkIGluIHRoZSBVSS5cblx0ICovXG5cdHByZXNlbnRhdGlvbj86IElQcmVzZW50YXRpb25PcHRpb25zO1xufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRhc2tHcm91cCB7XG5cdGV4cG9ydCBjb25zdCBDbGVhbjogVGFza0dyb3VwID0geyBfaWQ6ICdjbGVhbicsIGlzRGVmYXVsdDogZmFsc2UgfTtcblxuXHRleHBvcnQgY29uc3QgQnVpbGQ6IFRhc2tHcm91cCA9IHsgX2lkOiAnYnVpbGQnLCBpc0RlZmF1bHQ6IGZhbHNlIH07XG5cblx0ZXhwb3J0IGNvbnN0IFJlYnVpbGQ6IFRhc2tHcm91cCA9IHsgX2lkOiAncmVidWlsZCcsIGlzRGVmYXVsdDogZmFsc2UgfTtcblxuXHRleHBvcnQgY29uc3QgVGVzdDogVGFza0dyb3VwID0geyBfaWQ6ICd0ZXN0JywgaXNEZWZhdWx0OiBmYWxzZSB9O1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgc3RyaW5nIHtcblx0XHRyZXR1cm4gdmFsdWUgPT09IENsZWFuLl9pZCB8fCB2YWx1ZSA9PT0gQnVpbGQuX2lkIHx8IHZhbHVlID09PSBSZWJ1aWxkLl9pZCB8fCB2YWx1ZSA9PT0gVGVzdC5faWQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh2YWx1ZTogc3RyaW5nIHwgVGFza0dyb3VwIHwgdW5kZWZpbmVkKTogVGFza0dyb3VwIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKFR5cGVzLmlzU3RyaW5nKHZhbHVlKSkge1xuXHRcdFx0aWYgKGlzKHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4geyBfaWQ6IHZhbHVlLCBpc0RlZmF1bHQ6IGZhbHNlIH07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFza0dyb3VwIHtcblx0X2lkOiBzdHJpbmc7XG5cdGlzRGVmYXVsdD86IGJvb2xlYW4gfCBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRhc2tTY29wZSB7XG5cdEdsb2JhbCA9IDEsXG5cdFdvcmtzcGFjZSA9IDIsXG5cdEZvbGRlciA9IDNcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBUYXNrU291cmNlS2luZCB7XG5cdGV4cG9ydCBjb25zdCBXb3Jrc3BhY2U6ICd3b3Jrc3BhY2UnID0gJ3dvcmtzcGFjZSc7XG5cdGV4cG9ydCBjb25zdCBFeHRlbnNpb246ICdleHRlbnNpb24nID0gJ2V4dGVuc2lvbic7XG5cdGV4cG9ydCBjb25zdCBJbk1lbW9yeTogJ2luTWVtb3J5JyA9ICdpbk1lbW9yeSc7XG5cdGV4cG9ydCBjb25zdCBXb3Jrc3BhY2VGaWxlOiAnd29ya3NwYWNlRmlsZScgPSAnd29ya3NwYWNlRmlsZSc7XG5cdGV4cG9ydCBjb25zdCBVc2VyOiAndXNlcicgPSAndXNlcic7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvQ29uZmlndXJhdGlvblRhcmdldChraW5kOiBzdHJpbmcpOiBDb25maWd1cmF0aW9uVGFyZ2V0IHtcblx0XHRzd2l0Y2ggKGtpbmQpIHtcblx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuVXNlcjogcmV0dXJuIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjtcblx0XHRcdGNhc2UgVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlRmlsZTogcmV0dXJuIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1NvdXJjZUNvbmZpZ0VsZW1lbnQge1xuXHR3b3Jrc3BhY2VGb2xkZXI/OiBJV29ya3NwYWNlRm9sZGVyO1xuXHR3b3Jrc3BhY2U/OiBJV29ya3NwYWNlO1xuXHRmaWxlOiBzdHJpbmc7XG5cdGluZGV4OiBudW1iZXI7XG5cdGVsZW1lbnQ6IGFueTtcbn1cblxuaW50ZXJmYWNlIElCYXNlVGFza1NvdXJjZSB7XG5cdHJlYWRvbmx5IGtpbmQ6IHN0cmluZztcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya3NwYWNlVGFza1NvdXJjZSBleHRlbmRzIElCYXNlVGFza1NvdXJjZSB7XG5cdHJlYWRvbmx5IGtpbmQ6ICd3b3Jrc3BhY2UnO1xuXHRyZWFkb25seSBjb25maWc6IElUYXNrU291cmNlQ29uZmlnRWxlbWVudDtcblx0cmVhZG9ubHkgY3VzdG9taXplcz86IEtleWVkVGFza0lkZW50aWZpZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvblRhc2tTb3VyY2UgZXh0ZW5kcyBJQmFzZVRhc2tTb3VyY2Uge1xuXHRyZWFkb25seSBraW5kOiAnZXh0ZW5zaW9uJztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBzY29wZTogVGFza1Njb3BlO1xuXHRyZWFkb25seSB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvblRhc2tTb3VyY2VUcmFuc2ZlciB7XG5cdF9fd29ya3NwYWNlRm9sZGVyOiBVcmlDb21wb25lbnRzO1xuXHRfX2RlZmluaXRpb246IHsgdHlwZTogc3RyaW5nO1tuYW1lOiBzdHJpbmddOiBhbnkgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5NZW1vcnlUYXNrU291cmNlIGV4dGVuZHMgSUJhc2VUYXNrU291cmNlIHtcblx0cmVhZG9ubHkga2luZDogJ2luTWVtb3J5Jztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVXNlclRhc2tTb3VyY2UgZXh0ZW5kcyBJQmFzZVRhc2tTb3VyY2Uge1xuXHRyZWFkb25seSBraW5kOiAndXNlcic7XG5cdHJlYWRvbmx5IGNvbmZpZzogSVRhc2tTb3VyY2VDb25maWdFbGVtZW50O1xuXHRyZWFkb25seSBjdXN0b21pemVzPzogS2V5ZWRUYXNrSWRlbnRpZmllcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXb3Jrc3BhY2VGaWxlVGFza1NvdXJjZSBleHRlbmRzIElCYXNlVGFza1NvdXJjZSB7XG5cdHJlYWRvbmx5IGtpbmQ6ICd3b3Jrc3BhY2VGaWxlJztcblx0cmVhZG9ubHkgY29uZmlnOiBJVGFza1NvdXJjZUNvbmZpZ0VsZW1lbnQ7XG5cdHJlYWRvbmx5IGN1c3RvbWl6ZXM/OiBLZXllZFRhc2tJZGVudGlmaWVyO1xufVxuXG5leHBvcnQgdHlwZSBUYXNrU291cmNlID0gSVdvcmtzcGFjZVRhc2tTb3VyY2UgfCBJRXh0ZW5zaW9uVGFza1NvdXJjZSB8IElJbk1lbW9yeVRhc2tTb3VyY2UgfCBJVXNlclRhc2tTb3VyY2UgfCBXb3Jrc3BhY2VGaWxlVGFza1NvdXJjZTtcbmV4cG9ydCB0eXBlIEZpbGVCYXNlZFRhc2tTb3VyY2UgPSBJV29ya3NwYWNlVGFza1NvdXJjZSB8IElVc2VyVGFza1NvdXJjZSB8IFdvcmtzcGFjZUZpbGVUYXNrU291cmNlO1xuZXhwb3J0IGludGVyZmFjZSBJVGFza0lkZW50aWZpZXIge1xuXHR0eXBlOiBzdHJpbmc7XG5cdFtuYW1lOiBzdHJpbmddOiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgS2V5ZWRUYXNrSWRlbnRpZmllciBleHRlbmRzIElUYXNrSWRlbnRpZmllciB7XG5cdF9rZXk6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza0RlcGVuZGVuY3kge1xuXHR1cmk6IFVSSSB8IHN0cmluZztcblx0dGFzazogc3RyaW5nIHwgS2V5ZWRUYXNrSWRlbnRpZmllciB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gRGVwZW5kc09yZGVyIHtcblx0cGFyYWxsZWwgPSAncGFyYWxsZWwnLFxuXHRzZXF1ZW5jZSA9ICdzZXF1ZW5jZSdcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMge1xuXG5cdC8qKlxuXHQgKiBUaGUgdGFzaydzIG5hbWVcblx0ICovXG5cdG5hbWU/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSB0YXNrJ3MgbmFtZVxuXHQgKi9cblx0aWRlbnRpZmllcj86IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIHRhc2sncyBncm91cDtcblx0ICovXG5cdGdyb3VwPzogc3RyaW5nIHwgVGFza0dyb3VwO1xuXG5cdC8qKlxuXHQgKiBUaGUgcHJlc2VudGF0aW9uIG9wdGlvbnNcblx0ICovXG5cdHByZXNlbnRhdGlvbj86IElQcmVzZW50YXRpb25PcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBUaGUgY29tbWFuZCBvcHRpb25zO1xuXHQgKi9cblx0b3B0aW9ucz86IENvbW1hbmRPcHRpb25zO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSB0YXNrIGlzIGEgYmFja2dyb3VuZCB0YXNrIG9yIG5vdC5cblx0ICovXG5cdGlzQmFja2dyb3VuZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHRhc2sgc2hvdWxkIHByb21wdCBvbiBjbG9zZSBmb3IgY29uZmlybWF0aW9uIGlmIHJ1bm5pbmcuXG5cdCAqL1xuXHRwcm9tcHRPbkNsb3NlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVGhlIG90aGVyIHRhc2tzIHRoaXMgdGFzayBkZXBlbmRzIG9uLlxuXHQgKi9cblx0ZGVwZW5kc09uPzogSVRhc2tEZXBlbmRlbmN5W107XG5cblx0LyoqXG5cdCAqIFRoZSBvcmRlciB0aGUgZGVwZW5kc09uIHRhc2tzIHNob3VsZCBiZSBleGVjdXRlZCBpbi5cblx0ICovXG5cdGRlcGVuZHNPcmRlcj86IERlcGVuZHNPcmRlcjtcblxuXHQvKipcblx0ICogQSBkZXNjcmlwdGlvbiBvZiB0aGUgdGFzay5cblx0ICovXG5cdGRldGFpbD86IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIHByb2JsZW0gd2F0Y2hlcnMgdG8gdXNlIGZvciB0aGlzIHRhc2tcblx0ICovXG5cdHByb2JsZW1NYXRjaGVycz86IEFycmF5PHN0cmluZyB8IFByb2JsZW1NYXRjaGVyPjtcblxuXHQvKipcblx0ICogVGhlIGljb24gZm9yIHRoaXMgdGFzayBpbiB0aGUgdGVybWluYWwgdGFicyBsaXN0XG5cdCAqL1xuXHRpY29uPzogeyBpZD86IHN0cmluZzsgY29sb3I/OiBzdHJpbmcgfTtcblxuXHQvKipcblx0ICogRG8gbm90IHNob3cgdGhpcyB0YXNrIGluIHRoZSBydW4gdGFzayBxdWlja3BpY2tcblx0ICovXG5cdGhpZGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZW51bSBSdW5Pbk9wdGlvbnMge1xuXHRkZWZhdWx0ID0gMSxcblx0Zm9sZGVyT3BlbiA9IDJcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUnVuT3B0aW9ucyB7XG5cdHJlZXZhbHVhdGVPblJlcnVuPzogYm9vbGVhbjtcblx0cnVuT24/OiBSdW5Pbk9wdGlvbnM7XG5cdGluc3RhbmNlTGltaXQ/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUnVuT3B0aW9ucyB7XG5cdGV4cG9ydCBjb25zdCBkZWZhdWx0czogSVJ1bk9wdGlvbnMgPSB7IHJlZXZhbHVhdGVPblJlcnVuOiB0cnVlLCBydW5PbjogUnVuT25PcHRpb25zLmRlZmF1bHQsIGluc3RhbmNlTGltaXQ6IDEgfTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbW1vblRhc2sge1xuXG5cdC8qKlxuXHQgKiBUaGUgdGFzaydzIGludGVybmFsIGlkXG5cdCAqL1xuXHRyZWFkb25seSBfaWQ6IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIGNhY2hlZCBsYWJlbC5cblx0ICovXG5cdF9sYWJlbDogc3RyaW5nID0gJyc7XG5cblx0dHlwZT86IHN0cmluZztcblxuXHRydW5PcHRpb25zOiBJUnVuT3B0aW9ucztcblxuXHRjb25maWd1cmF0aW9uUHJvcGVydGllczogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzO1xuXG5cdF9zb3VyY2U6IElCYXNlVGFza1NvdXJjZTtcblxuXHRwcml2YXRlIF90YXNrTG9hZE1lc3NhZ2VzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCwgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBydW5PcHRpb25zOiBJUnVuT3B0aW9ucyxcblx0XHRjb25maWd1cmF0aW9uUHJvcGVydGllczogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLCBzb3VyY2U6IElCYXNlVGFza1NvdXJjZSkge1xuXHRcdHRoaXMuX2lkID0gaWQ7XG5cdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHR0aGlzLl9sYWJlbCA9IGxhYmVsO1xuXHRcdH1cblx0XHRpZiAodHlwZSkge1xuXHRcdFx0dGhpcy50eXBlID0gdHlwZTtcblx0XHR9XG5cdFx0dGhpcy5ydW5PcHRpb25zID0gcnVuT3B0aW9ucztcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gY29uZmlndXJhdGlvblByb3BlcnRpZXM7XG5cdFx0dGhpcy5fc291cmNlID0gc291cmNlO1xuXHR9XG5cblx0cHVibGljIGdldERlZmluaXRpb24odXNlU291cmNlPzogYm9vbGVhbik6IEtleWVkVGFza0lkZW50aWZpZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TWFwS2V5KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2lkO1xuXHR9XG5cblx0cHVibGljIGdldEtleSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0Rm9sZGVySWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdHB1YmxpYyBnZXRDb21tb25UYXNrSWQoKTogc3RyaW5nIHtcblx0XHRpbnRlcmZhY2UgSVJlY2VudFRhc2tLZXkge1xuXHRcdFx0Zm9sZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZDogc3RyaW5nO1xuXHRcdH1cblxuXHRcdGNvbnN0IGtleTogSVJlY2VudFRhc2tLZXkgPSB7IGZvbGRlcjogdGhpcy5nZXRGb2xkZXJJZCgpLCBpZDogdGhpcy5faWQgfTtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoa2V5KTtcblx0fVxuXG5cdHB1YmxpYyBjbG9uZSgpOiBUYXNrIHtcblx0XHRyZXR1cm4gdGhpcy5mcm9tT2JqZWN0KE9iamVjdC5hc3NpZ24oe30sIDxhbnk+dGhpcykpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGZyb21PYmplY3Qob2JqZWN0OiBhbnkpOiBUYXNrO1xuXG5cdHB1YmxpYyBnZXRXb3Jrc3BhY2VGb2xkZXIoKTogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBnZXRXb3Jrc3BhY2VGaWxlTmFtZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VGVsZW1ldHJ5S2luZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAndW5rbm93bic7XG5cdH1cblxuXHRwdWJsaWMgbWF0Y2hlcyhrZXk6IHN0cmluZyB8IEtleWVkVGFza0lkZW50aWZpZXIgfCB1bmRlZmluZWQsIGNvbXBhcmVJZDogYm9vbGVhbiA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0aWYgKGtleSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChUeXBlcy5pc1N0cmluZyhrZXkpKSB7XG5cdFx0XHRyZXR1cm4ga2V5ID09PSB0aGlzLl9sYWJlbCB8fCBrZXkgPT09IHRoaXMuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWRlbnRpZmllciB8fCAoY29tcGFyZUlkICYmIGtleSA9PT0gdGhpcy5faWQpO1xuXHRcdH1cblx0XHRjb25zdCBpZGVudGlmaWVyID0gdGhpcy5nZXREZWZpbml0aW9uKHRydWUpO1xuXHRcdHJldHVybiBpZGVudGlmaWVyICE9PSB1bmRlZmluZWQgJiYgaWRlbnRpZmllci5fa2V5ID09PSBrZXkuX2tleTtcblx0fVxuXG5cdHB1YmxpYyBnZXRRdWFsaWZpZWRMYWJlbCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRoaXMuZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0aWYgKHdvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0cmV0dXJuIGAke3RoaXMuX2xhYmVsfSAoJHt3b3Jrc3BhY2VGb2xkZXIubmFtZX0pYDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2xhYmVsO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRUYXNrRXhlY3V0aW9uKCk6IElUYXNrRXhlY3V0aW9uIHtcblx0XHRjb25zdCByZXN1bHQ6IElUYXNrRXhlY3V0aW9uID0ge1xuXHRcdFx0aWQ6IHRoaXMuX2lkLFxuXHRcdFx0dGFzazogPGFueT50aGlzXG5cdFx0fTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGFkZFRhc2tMb2FkTWVzc2FnZXMobWVzc2FnZXM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHRoaXMuX3Rhc2tMb2FkTWVzc2FnZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fdGFza0xvYWRNZXNzYWdlcyA9IFtdO1xuXHRcdH1cblx0XHRpZiAobWVzc2FnZXMpIHtcblx0XHRcdHRoaXMuX3Rhc2tMb2FkTWVzc2FnZXMgPSB0aGlzLl90YXNrTG9hZE1lc3NhZ2VzLmNvbmNhdChtZXNzYWdlcyk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHRhc2tMb2FkTWVzc2FnZXMoKTogc3RyaW5nW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl90YXNrTG9hZE1lc3NhZ2VzO1xuXHR9XG59XG5cbi8qKlxuICogRm9yIHRhc2tzIG9mIHR5cGUgc2hlbGwgb3IgcHJvY2VzcywgdGhpcyBpcyBjcmVhdGVkIHVwb24gcGFyc2VcbiAqIG9mIHRoZSB0YXNrcy5qc29uIG9yIHdvcmtzcGFjZSBmaWxlLlxuICogRm9yIENvbnRyaWJ1dGVkVGFza3Mgb2YgYWxsIG90aGVyIHR5cGVzLCB0aGlzIGlzIHRoZSByZXN1bHQgb2ZcbiAqIHJlc29sdmluZyBhIENvbmZpZ3VyaW5nVGFzay5cbiAqL1xuZXhwb3J0IGNsYXNzIEN1c3RvbVRhc2sgZXh0ZW5kcyBDb21tb25UYXNrIHtcblxuXHRkZWNsYXJlIHR5cGU6ICckY3VzdG9taXplZCc7IC8vIENVU1RPTUlaRURfVEFTS19UWVBFXG5cblx0aW5zdGFuY2U6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogSW5kaWNhdGVkIHRoZSBzb3VyY2Ugb2YgdGhlIHRhc2sgKGUuZy4gdGFza3MuanNvbiBvciBleHRlbnNpb24pXG5cdCAqL1xuXHRvdmVycmlkZSBfc291cmNlOiBGaWxlQmFzZWRUYXNrU291cmNlO1xuXG5cdGhhc0RlZmluZWRNYXRjaGVyczogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVGhlIGNvbW1hbmQgY29uZmlndXJhdGlvblxuXHQgKi9cblx0Y29tbWFuZDogSUNvbW1hbmRDb25maWd1cmF0aW9uID0ge307XG5cblx0cHVibGljIGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIHNvdXJjZTogRmlsZUJhc2VkVGFza1NvdXJjZSwgbGFiZWw6IHN0cmluZywgdHlwZTogc3RyaW5nLCBjb21tYW5kOiBJQ29tbWFuZENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQsXG5cdFx0aGFzRGVmaW5lZE1hdGNoZXJzOiBib29sZWFuLCBydW5PcHRpb25zOiBJUnVuT3B0aW9ucywgY29uZmlndXJhdGlvblByb3BlcnRpZXM6IElDb25maWd1cmF0aW9uUHJvcGVydGllcykge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCwgdW5kZWZpbmVkLCBydW5PcHRpb25zLCBjb25maWd1cmF0aW9uUHJvcGVydGllcywgc291cmNlKTtcblx0XHR0aGlzLl9zb3VyY2UgPSBzb3VyY2U7XG5cdFx0dGhpcy5oYXNEZWZpbmVkTWF0Y2hlcnMgPSBoYXNEZWZpbmVkTWF0Y2hlcnM7XG5cdFx0aWYgKGNvbW1hbmQpIHtcblx0XHRcdHRoaXMuY29tbWFuZCA9IGNvbW1hbmQ7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGNsb25lKCk6IEN1c3RvbVRhc2sge1xuXHRcdHJldHVybiBuZXcgQ3VzdG9tVGFzayh0aGlzLl9pZCwgdGhpcy5fc291cmNlLCB0aGlzLl9sYWJlbCwgdGhpcy50eXBlLCB0aGlzLmNvbW1hbmQsIHRoaXMuaGFzRGVmaW5lZE1hdGNoZXJzLCB0aGlzLnJ1bk9wdGlvbnMsIHRoaXMuY29uZmlndXJhdGlvblByb3BlcnRpZXMpO1xuXHR9XG5cblx0cHVibGljIGN1c3RvbWl6ZXMoKTogS2V5ZWRUYXNrSWRlbnRpZmllciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX3NvdXJjZSAmJiB0aGlzLl9zb3VyY2UuY3VzdG9taXplcykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3NvdXJjZS5jdXN0b21pemVzO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldERlZmluaXRpb24odXNlU291cmNlOiBib29sZWFuID0gZmFsc2UpOiBLZXllZFRhc2tJZGVudGlmaWVyIHtcblx0XHRpZiAodXNlU291cmNlICYmIHRoaXMuX3NvdXJjZS5jdXN0b21pemVzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zb3VyY2UuY3VzdG9taXplcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IHR5cGU6IHN0cmluZztcblx0XHRcdGNvbnN0IGNvbW1hbmRSdW50aW1lID0gdGhpcy5jb21tYW5kID8gdGhpcy5jb21tYW5kLnJ1bnRpbWUgOiB1bmRlZmluZWQ7XG5cdFx0XHRzd2l0Y2ggKGNvbW1hbmRSdW50aW1lKSB7XG5cdFx0XHRcdGNhc2UgUnVudGltZVR5cGUuU2hlbGw6XG5cdFx0XHRcdFx0dHlwZSA9ICdzaGVsbCc7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBSdW50aW1lVHlwZS5Qcm9jZXNzOlxuXHRcdFx0XHRcdHR5cGUgPSAncHJvY2Vzcyc7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSBSdW50aW1lVHlwZS5DdXN0b21FeGVjdXRpb246XG5cdFx0XHRcdFx0dHlwZSA9ICdjdXN0b21FeGVjdXRpb24nO1xuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2UgdW5kZWZpbmVkOlxuXHRcdFx0XHRcdHR5cGUgPSAnJGNvbXBvc2l0ZSc7XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgdGFzayBydW50aW1lJyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogS2V5ZWRUYXNrSWRlbnRpZmllciA9IHtcblx0XHRcdFx0dHlwZSxcblx0XHRcdFx0X2tleTogdGhpcy5faWQsXG5cdFx0XHRcdGlkOiB0aGlzLl9pZFxuXHRcdFx0fTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHN0YXRpYyBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgQ3VzdG9tVGFzayB7XG5cdFx0cmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgQ3VzdG9tVGFzaztcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRNYXBLZXkoKTogc3RyaW5nIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZUZvbGRlcjtcblx0XHRyZXR1cm4gd29ya3NwYWNlRm9sZGVyID8gYCR7d29ya3NwYWNlRm9sZGVyLnVyaS50b1N0cmluZygpfXwke3RoaXMuX2lkfXwke3RoaXMuaW5zdGFuY2V9YCA6IGAke3RoaXMuX2lkfXwke3RoaXMuaW5zdGFuY2V9YDtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRGb2xkZXJJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zb3VyY2Uua2luZCA9PT0gVGFza1NvdXJjZUtpbmQuVXNlciA/IFVTRVJfVEFTS1NfR1JPVVBfS0VZIDogdGhpcy5fc291cmNlLmNvbmZpZy53b3Jrc3BhY2VGb2xkZXI/LnVyaS50b1N0cmluZygpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldENvbW1vblRhc2tJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9zb3VyY2UuY3VzdG9taXplcyA/IHN1cGVyLmdldENvbW1vblRhc2tJZCgpIDogKHRoaXMuZ2V0S2V5KCkgPz8gc3VwZXIuZ2V0Q29tbW9uVGFza0lkKCkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEByZXR1cm5zIEEga2V5IHJlcHJlc2VudGluZyB0aGUgdGFza1xuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIGdldEtleSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGludGVyZmFjZSBJQ3VzdG9tS2V5IHtcblx0XHRcdHR5cGU6IHN0cmluZztcblx0XHRcdGZvbGRlcjogc3RyaW5nO1xuXHRcdFx0aWQ6IHN0cmluZztcblx0XHR9XG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyID0gdGhpcy5nZXRGb2xkZXJJZCgpO1xuXHRcdGlmICghd29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgaWQ6IHN0cmluZyA9IHRoaXMuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWRlbnRpZmllciE7XG5cdFx0aWYgKHRoaXMuX3NvdXJjZS5raW5kICE9PSBUYXNrU291cmNlS2luZC5Xb3Jrc3BhY2UpIHtcblx0XHRcdGlkICs9IHRoaXMuX3NvdXJjZS5raW5kO1xuXHRcdH1cblx0XHRjb25zdCBrZXk6IElDdXN0b21LZXkgPSB7IHR5cGU6IENVU1RPTUlaRURfVEFTS19UWVBFLCBmb2xkZXI6IHdvcmtzcGFjZUZvbGRlciwgaWQgfTtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoa2V5KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRXb3Jrc3BhY2VGb2xkZXIoKTogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvdXJjZS5jb25maWcud29ya3NwYWNlRm9sZGVyO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldFdvcmtzcGFjZUZpbGVOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuICh0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZSAmJiB0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZS5jb25maWd1cmF0aW9uKSA/IHJlc291cmNlcy5iYXNlbmFtZSh0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZS5jb25maWd1cmF0aW9uKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRUZWxlbWV0cnlLaW5kKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuX3NvdXJjZS5jdXN0b21pemVzKSB7XG5cdFx0XHRyZXR1cm4gJ3dvcmtzcGFjZT5leHRlbnNpb24nO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJ3dvcmtzcGFjZSc7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGZyb21PYmplY3Qob2JqZWN0OiBDdXN0b21UYXNrKTogQ3VzdG9tVGFzayB7XG5cdFx0cmV0dXJuIG5ldyBDdXN0b21UYXNrKG9iamVjdC5faWQsIG9iamVjdC5fc291cmNlLCBvYmplY3QuX2xhYmVsLCBvYmplY3QudHlwZSwgb2JqZWN0LmNvbW1hbmQsIG9iamVjdC5oYXNEZWZpbmVkTWF0Y2hlcnMsIG9iamVjdC5ydW5PcHRpb25zLCBvYmplY3QuY29uZmlndXJhdGlvblByb3BlcnRpZXMpO1xuXHR9XG59XG5cbi8qKlxuICogQWZ0ZXIgYSBjb250cmlidXRlZCB0YXNrIGhhcyBiZWVuIHBhcnNlZCwgYnV0IGJlZm9yZVxuICogdGhlIHRhc2sgaGFzIGJlZW4gcmVzb2x2ZWQgdmlhIHRoZSBleHRlbnNpb24sIGl0cyBwcm9wZXJ0aWVzXG4gKiBhcmUgc3RvcmVkIGluIHRoaXNcbiAqL1xuZXhwb3J0IGNsYXNzIENvbmZpZ3VyaW5nVGFzayBleHRlbmRzIENvbW1vblRhc2sge1xuXG5cdC8qKlxuXHQgKiBJbmRpY2F0ZWQgdGhlIHNvdXJjZSBvZiB0aGUgdGFzayAoZS5nLiB0YXNrcy5qc29uIG9yIGV4dGVuc2lvbilcblx0ICovXG5cdG92ZXJyaWRlIF9zb3VyY2U6IEZpbGVCYXNlZFRhc2tTb3VyY2U7XG5cblx0Y29uZmlndXJlczogS2V5ZWRUYXNrSWRlbnRpZmllcjtcblxuXHRwdWJsaWMgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgc291cmNlOiBGaWxlQmFzZWRUYXNrU291cmNlLCBsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkLCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0Y29uZmlndXJlczogS2V5ZWRUYXNrSWRlbnRpZmllciwgcnVuT3B0aW9uczogSVJ1bk9wdGlvbnMsIGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzOiBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwsIHR5cGUsIHJ1bk9wdGlvbnMsIGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLCBzb3VyY2UpO1xuXHRcdHRoaXMuX3NvdXJjZSA9IHNvdXJjZTtcblx0XHR0aGlzLmNvbmZpZ3VyZXMgPSBjb25maWd1cmVzO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBpcyh2YWx1ZTogYW55KTogdmFsdWUgaXMgQ29uZmlndXJpbmdUYXNrIHtcblx0XHRyZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBDb25maWd1cmluZ1Rhc2s7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZnJvbU9iamVjdChvYmplY3Q6IGFueSk6IFRhc2sge1xuXHRcdHJldHVybiBvYmplY3Q7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0RGVmaW5pdGlvbigpOiBLZXllZFRhc2tJZGVudGlmaWVyIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmVzO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldFdvcmtzcGFjZUZpbGVOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuICh0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZSAmJiB0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZS5jb25maWd1cmF0aW9uKSA/IHJlc291cmNlcy5iYXNlbmFtZSh0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZS5jb25maWd1cmF0aW9uKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRXb3Jrc3BhY2VGb2xkZXIoKTogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvdXJjZS5jb25maWcud29ya3NwYWNlRm9sZGVyO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEZvbGRlcklkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3NvdXJjZS5raW5kID09PSBUYXNrU291cmNlS2luZC5Vc2VyID8gVVNFUl9UQVNLU19HUk9VUF9LRVkgOiB0aGlzLl9zb3VyY2UuY29uZmlnLndvcmtzcGFjZUZvbGRlcj8udXJpLnRvU3RyaW5nKCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0S2V5KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aW50ZXJmYWNlIElDdXN0b21LZXkge1xuXHRcdFx0dHlwZTogc3RyaW5nO1xuXHRcdFx0Zm9sZGVyOiBzdHJpbmc7XG5cdFx0XHRpZDogc3RyaW5nO1xuXHRcdH1cblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0aGlzLmdldEZvbGRlcklkKCk7XG5cdFx0aWYgKCF3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBpZDogc3RyaW5nID0gdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyITtcblx0XHRpZiAodGhpcy5fc291cmNlLmtpbmQgIT09IFRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZSkge1xuXHRcdFx0aWQgKz0gdGhpcy5fc291cmNlLmtpbmQ7XG5cdFx0fVxuXHRcdGNvbnN0IGtleTogSUN1c3RvbUtleSA9IHsgdHlwZTogQ1VTVE9NSVpFRF9UQVNLX1RZUEUsIGZvbGRlcjogd29ya3NwYWNlRm9sZGVyLCBpZCB9O1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShrZXkpO1xuXHR9XG59XG5cbi8qKlxuICogQSB0YXNrIGZyb20gYW4gZXh0ZW5zaW9uIGNyZWF0ZWQgdmlhIHJlc29sdmVUYXNrIG9yIHByb3ZpZGVUYXNrXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250cmlidXRlZFRhc2sgZXh0ZW5kcyBDb21tb25UYXNrIHtcblxuXHQvKipcblx0ICogSW5kaWNhdGVkIHRoZSBzb3VyY2Ugb2YgdGhlIHRhc2sgKGUuZy4gdGFza3MuanNvbiBvciBleHRlbnNpb24pXG5cdCAqIFNldCBpbiB0aGUgc3VwZXIgY29uc3RydWN0b3Jcblx0ICovXG5cdGRlY2xhcmUgX3NvdXJjZTogSUV4dGVuc2lvblRhc2tTb3VyY2U7XG5cblx0aW5zdGFuY2U6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRkZWZpbmVzOiBLZXllZFRhc2tJZGVudGlmaWVyO1xuXG5cdGhhc0RlZmluZWRNYXRjaGVyczogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVGhlIGNvbW1hbmQgY29uZmlndXJhdGlvblxuXHQgKi9cblx0Y29tbWFuZDogSUNvbW1hbmRDb25maWd1cmF0aW9uO1xuXG5cdC8qKlxuXHQgKiBUaGUgaWNvbiBmb3IgdGhlIHRhc2tcblx0ICovXG5cdGljb246IHsgaWQ/OiBzdHJpbmc7IGNvbG9yPzogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIERvbid0IHNob3cgdGhlIHRhc2sgaW4gdGhlIHJ1biB0YXNrIHF1aWNrcGlja1xuXHQgKi9cblx0aGlkZT86IGJvb2xlYW47XG5cblx0cHVibGljIGNvbnN0cnVjdG9yKGlkOiBzdHJpbmcsIHNvdXJjZTogSUV4dGVuc2lvblRhc2tTb3VyY2UsIGxhYmVsOiBzdHJpbmcsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGVmaW5lczogS2V5ZWRUYXNrSWRlbnRpZmllcixcblx0XHRjb21tYW5kOiBJQ29tbWFuZENvbmZpZ3VyYXRpb24sIGhhc0RlZmluZWRNYXRjaGVyczogYm9vbGVhbiwgcnVuT3B0aW9uczogSVJ1bk9wdGlvbnMsXG5cdFx0Y29uZmlndXJhdGlvblByb3BlcnRpZXM6IElDb25maWd1cmF0aW9uUHJvcGVydGllcykge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCwgdHlwZSwgcnVuT3B0aW9ucywgY29uZmlndXJhdGlvblByb3BlcnRpZXMsIHNvdXJjZSk7XG5cdFx0dGhpcy5kZWZpbmVzID0gZGVmaW5lcztcblx0XHR0aGlzLmhhc0RlZmluZWRNYXRjaGVycyA9IGhhc0RlZmluZWRNYXRjaGVycztcblx0XHR0aGlzLmNvbW1hbmQgPSBjb21tYW5kO1xuXHRcdHRoaXMuaWNvbiA9IGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb247XG5cdFx0dGhpcy5oaWRlID0gY29uZmlndXJhdGlvblByb3BlcnRpZXMuaGlkZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjbG9uZSgpOiBDb250cmlidXRlZFRhc2sge1xuXHRcdHJldHVybiBuZXcgQ29udHJpYnV0ZWRUYXNrKHRoaXMuX2lkLCB0aGlzLl9zb3VyY2UsIHRoaXMuX2xhYmVsLCB0aGlzLnR5cGUsIHRoaXMuZGVmaW5lcywgdGhpcy5jb21tYW5kLCB0aGlzLmhhc0RlZmluZWRNYXRjaGVycywgdGhpcy5ydW5PcHRpb25zLCB0aGlzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXREZWZpbml0aW9uKCk6IEtleWVkVGFza0lkZW50aWZpZXIge1xuXHRcdHJldHVybiB0aGlzLmRlZmluZXM7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGlzKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBDb250cmlidXRlZFRhc2sge1xuXHRcdHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIENvbnRyaWJ1dGVkVGFzaztcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRNYXBLZXkoKTogc3RyaW5nIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSB0aGlzLl9zb3VyY2Uud29ya3NwYWNlRm9sZGVyO1xuXHRcdHJldHVybiB3b3Jrc3BhY2VGb2xkZXJcblx0XHRcdD8gYCR7dGhpcy5fc291cmNlLnNjb3BlLnRvU3RyaW5nKCl9fCR7d29ya3NwYWNlRm9sZGVyLnVyaS50b1N0cmluZygpfXwke3RoaXMuX2lkfXwke3RoaXMuaW5zdGFuY2V9YFxuXHRcdFx0OiBgJHt0aGlzLl9zb3VyY2Uuc2NvcGUudG9TdHJpbmcoKX18JHt0aGlzLl9pZH18JHt0aGlzLmluc3RhbmNlfWA7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Rm9sZGVySWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fc291cmNlLnNjb3BlID09PSBUYXNrU2NvcGUuRm9sZGVyICYmIHRoaXMuX3NvdXJjZS53b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zb3VyY2Uud29ya3NwYWNlRm9sZGVyLnVyaS50b1N0cmluZygpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldEtleSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGludGVyZmFjZSBJQ29udHJpYnV0ZWRLZXkge1xuXHRcdFx0dHlwZTogc3RyaW5nO1xuXHRcdFx0c2NvcGU6IG51bWJlcjtcblx0XHRcdGZvbGRlcj86IHN0cmluZztcblx0XHRcdGlkOiBzdHJpbmc7XG5cdFx0fVxuXG5cdFx0Y29uc3Qga2V5OiBJQ29udHJpYnV0ZWRLZXkgPSB7IHR5cGU6ICdjb250cmlidXRlZCcsIHNjb3BlOiB0aGlzLl9zb3VyY2Uuc2NvcGUsIGlkOiB0aGlzLl9pZCB9O1xuXHRcdGtleS5mb2xkZXIgPSB0aGlzLmdldEZvbGRlcklkKCk7XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGtleSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0V29ya3NwYWNlRm9sZGVyKCk6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zb3VyY2Uud29ya3NwYWNlRm9sZGVyO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldFRlbGVtZXRyeUtpbmQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ2V4dGVuc2lvbic7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZnJvbU9iamVjdChvYmplY3Q6IENvbnRyaWJ1dGVkVGFzayk6IENvbnRyaWJ1dGVkVGFzayB7XG5cdFx0cmV0dXJuIG5ldyBDb250cmlidXRlZFRhc2sob2JqZWN0Ll9pZCwgb2JqZWN0Ll9zb3VyY2UsIG9iamVjdC5fbGFiZWwsIG9iamVjdC50eXBlLCBvYmplY3QuZGVmaW5lcywgb2JqZWN0LmNvbW1hbmQsIG9iamVjdC5oYXNEZWZpbmVkTWF0Y2hlcnMsIG9iamVjdC5ydW5PcHRpb25zLCBvYmplY3QuY29uZmlndXJhdGlvblByb3BlcnRpZXMpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbk1lbW9yeVRhc2sgZXh0ZW5kcyBDb21tb25UYXNrIHtcblx0LyoqXG5cdCAqIEluZGljYXRlZCB0aGUgc291cmNlIG9mIHRoZSB0YXNrIChlLmcuIHRhc2tzLmpzb24gb3IgZXh0ZW5zaW9uKVxuXHQgKi9cblx0b3ZlcnJpZGUgX3NvdXJjZTogSUluTWVtb3J5VGFza1NvdXJjZTtcblxuXHRpbnN0YW5jZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdGRlY2xhcmUgdHlwZTogJ2luTWVtb3J5JztcblxuXHRwdWJsaWMgY29uc3RydWN0b3IoaWQ6IHN0cmluZywgc291cmNlOiBJSW5NZW1vcnlUYXNrU291cmNlLCBsYWJlbDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsXG5cdFx0cnVuT3B0aW9uczogSVJ1bk9wdGlvbnMsIGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzOiBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwsIHR5cGUsIHJ1bk9wdGlvbnMsIGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLCBzb3VyY2UpO1xuXHRcdHRoaXMuX3NvdXJjZSA9IHNvdXJjZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBjbG9uZSgpOiBJbk1lbW9yeVRhc2sge1xuXHRcdHJldHVybiBuZXcgSW5NZW1vcnlUYXNrKHRoaXMuX2lkLCB0aGlzLl9zb3VyY2UsIHRoaXMuX2xhYmVsLCB0aGlzLnR5cGUsIHRoaXMucnVuT3B0aW9ucywgdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllcyk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGlzKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJbk1lbW9yeVRhc2sge1xuXHRcdHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIEluTWVtb3J5VGFzaztcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBnZXRUZWxlbWV0cnlLaW5kKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdjb21wb3NpdGUnO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldE1hcEtleSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHt0aGlzLl9pZH18JHt0aGlzLmluc3RhbmNlfWA7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Rm9sZGVySWQoKTogdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGZyb21PYmplY3Qob2JqZWN0OiBJbk1lbW9yeVRhc2spOiBJbk1lbW9yeVRhc2sge1xuXHRcdHJldHVybiBuZXcgSW5NZW1vcnlUYXNrKG9iamVjdC5faWQsIG9iamVjdC5fc291cmNlLCBvYmplY3QuX2xhYmVsLCBvYmplY3QudHlwZSwgb2JqZWN0LnJ1bk9wdGlvbnMsIG9iamVjdC5jb25maWd1cmF0aW9uUHJvcGVydGllcyk7XG5cdH1cbn1cblxuZXhwb3J0IHR5cGUgVGFzayA9IEN1c3RvbVRhc2sgfCBDb250cmlidXRlZFRhc2sgfCBJbk1lbW9yeVRhc2s7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRhc2tFeGVjdXRpb24ge1xuXHRpZDogc3RyaW5nO1xuXHR0YXNrOiBUYXNrO1xufVxuXG5leHBvcnQgZW51bSBFeGVjdXRpb25FbmdpbmUge1xuXHRQcm9jZXNzID0gMSxcblx0VGVybWluYWwgPSAyXG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRXhlY3V0aW9uRW5naW5lIHtcblx0ZXhwb3J0IGNvbnN0IF9kZWZhdWx0OiBFeGVjdXRpb25FbmdpbmUgPSBFeGVjdXRpb25FbmdpbmUuVGVybWluYWw7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEpzb25TY2hlbWFWZXJzaW9uIHtcblx0VjBfMV8wID0gMSxcblx0VjJfMF8wID0gMlxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrU2V0IHtcblx0dGFza3M6IFRhc2tbXTtcblx0ZXh0ZW5zaW9uPzogSUV4dGVuc2lvbkRlc2NyaXB0aW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrRGVmaW5pdGlvbiB7XG5cdGV4dGVuc2lvbklkOiBzdHJpbmc7XG5cdHRhc2tUeXBlOiBzdHJpbmc7XG5cdHJlcXVpcmVkOiBzdHJpbmdbXTtcblx0cHJvcGVydGllczogSUpTT05TY2hlbWFNYXA7XG5cdHdoZW4/OiBDb250ZXh0S2V5RXhwcmVzc2lvbjtcbn1cblxuZXhwb3J0IGNsYXNzIFRhc2tTb3J0ZXIge1xuXG5cdHByaXZhdGUgX29yZGVyOiBNYXA8c3RyaW5nLCBudW1iZXI+ID0gbmV3IE1hcCgpO1xuXG5cdGNvbnN0cnVjdG9yKHdvcmtzcGFjZUZvbGRlcnM6IElXb3Jrc3BhY2VGb2xkZXJbXSkge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgd29ya3NwYWNlRm9sZGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5fb3JkZXIuc2V0KHdvcmtzcGFjZUZvbGRlcnNbaV0udXJpLnRvU3RyaW5nKCksIGkpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBjb21wYXJlKGE6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2ssIGI6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2spOiBudW1iZXIge1xuXHRcdGNvbnN0IGF3ID0gYS5nZXRXb3Jrc3BhY2VGb2xkZXIoKTtcblx0XHRjb25zdCBidyA9IGIuZ2V0V29ya3NwYWNlRm9sZGVyKCk7XG5cdFx0aWYgKGF3ICYmIGJ3KSB7XG5cdFx0XHRsZXQgYWkgPSB0aGlzLl9vcmRlci5nZXQoYXcudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0YWkgPSBhaSA9PT0gdW5kZWZpbmVkID8gMCA6IGFpICsgMTtcblx0XHRcdGxldCBiaSA9IHRoaXMuX29yZGVyLmdldChidy51cmkudG9TdHJpbmcoKSk7XG5cdFx0XHRiaSA9IGJpID09PSB1bmRlZmluZWQgPyAwIDogYmkgKyAxO1xuXHRcdFx0aWYgKGFpID09PSBiaSkge1xuXHRcdFx0XHRyZXR1cm4gYS5fbGFiZWwubG9jYWxlQ29tcGFyZShiLl9sYWJlbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gYWkgLSBiaTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFhdyAmJiBidykge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYXcgJiYgIWJ3KSB7XG5cdFx0XHRyZXR1cm4gKzE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0fVxufVxuXG5cblxuZXhwb3J0IGNvbnN0IGVudW0gVGFza1J1blR5cGUge1xuXHRTaW5nbGVSdW4gPSAnc2luZ2xlUnVuJyxcblx0QmFja2dyb3VuZCA9ICdiYWNrZ3JvdW5kJ1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrQ2hhbmdlZEV2ZW50IHtcblx0a2luZDogVGFza0V2ZW50S2luZC5DaGFuZ2VkO1xufVxuXG5cblxuZXhwb3J0IGVudW0gVGFza0V2ZW50S2luZCB7XG5cdC8qKiBJbmRpY2F0ZXMgdGhhdCBhIHRhc2sncyBwcm9wZXJ0aWVzIG9yIGNvbmZpZ3VyYXRpb24gaGF2ZSBjaGFuZ2VkICovXG5cdENoYW5nZWQgPSAnY2hhbmdlZCcsXG5cblx0LyoqIEluZGljYXRlcyB0aGF0IGEgdGFzayBoYXMgYmVndW4gZXhlY3V0aW5nICovXG5cdFByb2Nlc3NTdGFydGVkID0gJ3Byb2Nlc3NTdGFydGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIHRoYXQgYSB0YXNrIHByb2Nlc3MgaGFzIGNvbXBsZXRlZCAqL1xuXHRQcm9jZXNzRW5kZWQgPSAncHJvY2Vzc0VuZGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIHRoYXQgYSB0YXNrIHdhcyB0ZXJtaW5hdGVkLCBlaXRoZXIgYnkgdXNlciBhY3Rpb24gb3IgYnkgdGhlIHN5c3RlbSAqL1xuXHRUZXJtaW5hdGVkID0gJ3Rlcm1pbmF0ZWQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgdGhhdCBhIHRhc2sgaGFzIHN0YXJ0ZWQgcnVubmluZyAqL1xuXHRTdGFydCA9ICdzdGFydCcsXG5cblx0LyoqIEluZGljYXRlcyB0aGF0IGEgdGFzayBoYXMgYWNxdWlyZWQgYWxsIG5lZWRlZCBpbnB1dC92YXJpYWJsZXMgdG8gZXhlY3V0ZSAqL1xuXHRBY3F1aXJlZElucHV0ID0gJ2FjcXVpcmVkSW5wdXQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgdGhhdCBhIGRlcGVuZGVudCB0YXNrIGhhcyBzdGFydGVkICovXG5cdERlcGVuZHNPblN0YXJ0ZWQgPSAnZGVwZW5kc09uU3RhcnRlZCcsXG5cblx0LyoqIEluZGljYXRlcyB0aGF0IGEgdGFzayBpcyBhY3RpdmVseSBydW5uaW5nL3Byb2Nlc3NpbmcgKi9cblx0QWN0aXZlID0gJ2FjdGl2ZScsXG5cblx0LyoqIEluZGljYXRlcyB0aGF0IGEgdGFzayBpcyBwYXVzZWQvd2FpdGluZyBidXQgbm90IGNvbXBsZXRlICovXG5cdEluYWN0aXZlID0gJ2luYWN0aXZlJyxcblxuXHQvKiogSW5kaWNhdGVzIHRoYXQgYSB0YXNrIGhhcyBjb21wbGV0ZWQgZnVsbHkgKi9cblx0RW5kID0gJ2VuZCcsXG5cblx0LyoqIEluZGljYXRlcyB0aGF0IGEgdGFzaydzIHByb2JsZW0gbWF0Y2hlciBoYXMgc3RhcnRlZCAqL1xuXHRQcm9ibGVtTWF0Y2hlclN0YXJ0ZWQgPSAncHJvYmxlbU1hdGNoZXJTdGFydGVkJyxcblxuXHQvKiogSW5kaWNhdGVzIHRoYXQgYSB0YXNrJ3MgcHJvYmxlbSBtYXRjaGVyIGhhcyBlbmRlZCAqL1xuXHRQcm9ibGVtTWF0Y2hlckVuZGVkID0gJ3Byb2JsZW1NYXRjaGVyRW5kZWQnLFxuXG5cdC8qKiBJbmRpY2F0ZXMgdGhhdCBhIHRhc2sncyBwcm9ibGVtIG1hdGNoZXIgaGFzIGZvdW5kIGVycm9ycyAqL1xuXHRQcm9ibGVtTWF0Y2hlckZvdW5kRXJyb3JzID0gJ3Byb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMnXG59XG5cbmludGVyZmFjZSBJVGFza0NvbW1vbiB7XG5cdHRhc2tJZDogc3RyaW5nO1xuXHRydW5UeXBlOiBUYXNrUnVuVHlwZTtcblx0dGFza05hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z3JvdXA6IHN0cmluZyB8IFRhc2tHcm91cCB8IHVuZGVmaW5lZDtcblx0X190YXNrOiBUYXNrO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrUHJvY2Vzc1N0YXJ0ZWRFdmVudCBleHRlbmRzIElUYXNrQ29tbW9uIHtcblx0a2luZDogVGFza0V2ZW50S2luZC5Qcm9jZXNzU3RhcnRlZDtcblx0dGVybWluYWxJZDogbnVtYmVyO1xuXHRwcm9jZXNzSWQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1Byb2Nlc3NFbmRlZEV2ZW50IGV4dGVuZHMgSVRhc2tDb21tb24ge1xuXHRraW5kOiBUYXNrRXZlbnRLaW5kLlByb2Nlc3NFbmRlZDtcblx0dGVybWluYWxJZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRleGl0Q29kZT86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1Rlcm1pbmF0ZWRFdmVudCBleHRlbmRzIElUYXNrQ29tbW9uIHtcblx0a2luZDogVGFza0V2ZW50S2luZC5UZXJtaW5hdGVkO1xuXHR0ZXJtaW5hbElkOiBudW1iZXI7XG5cdGV4aXRSZWFzb246IFRlcm1pbmFsRXhpdFJlYXNvbiB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1N0YXJ0ZWRFdmVudCBleHRlbmRzIElUYXNrQ29tbW9uIHtcblx0a2luZDogVGFza0V2ZW50S2luZC5TdGFydDtcblx0dGVybWluYWxJZDogbnVtYmVyO1xuXHRyZXNvbHZlZFZhcmlhYmxlczogTWFwPHN0cmluZywgc3RyaW5nPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1Byb2JsZW1NYXRjaGVyRW5kZWRFdmVudCBleHRlbmRzIElUYXNrQ29tbW9uIHtcblx0a2luZDogVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkO1xuXHRoYXNFcnJvcnM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRhc2tHZW5lcmFsRXZlbnQgZXh0ZW5kcyBJVGFza0NvbW1vbiB7XG5cdGtpbmQ6IFRhc2tFdmVudEtpbmQuQWNxdWlyZWRJbnB1dCB8IFRhc2tFdmVudEtpbmQuRGVwZW5kc09uU3RhcnRlZCB8IFRhc2tFdmVudEtpbmQuQWN0aXZlIHwgVGFza0V2ZW50S2luZC5JbmFjdGl2ZSB8IFRhc2tFdmVudEtpbmQuRW5kIHwgVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkIHwgVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlclN0YXJ0ZWQgfCBUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnM7XG5cdHRlcm1pbmFsSWQ6IG51bWJlciB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IHR5cGUgSVRhc2tFdmVudCA9XG5cdHwgSVRhc2tDaGFuZ2VkRXZlbnRcblx0fCBJVGFza1Byb2Nlc3NTdGFydGVkRXZlbnRcblx0fCBJVGFza1Byb2Nlc3NFbmRlZEV2ZW50XG5cdHwgSVRhc2tUZXJtaW5hdGVkRXZlbnRcblx0fCBJVGFza1N0YXJ0ZWRFdmVudFxuXHR8IElUYXNrR2VuZXJhbEV2ZW50XG5cdHwgSVRhc2tQcm9ibGVtTWF0Y2hlckVuZGVkRXZlbnQ7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFRhc2tSdW5Tb3VyY2Uge1xuXHRTeXN0ZW0sXG5cdFVzZXIsXG5cdEZvbGRlck9wZW4sXG5cdENvbmZpZ3VyYXRpb25DaGFuZ2UsXG5cdFJlY29ubmVjdFxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRhc2tFdmVudCB7XG5cdGZ1bmN0aW9uIGNvbW1vbih0YXNrOiBUYXNrKTogSVRhc2tDb21tb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHR0YXNrSWQ6IHRhc2suX2lkLFxuXHRcdFx0dGFza05hbWU6IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSxcblx0XHRcdHJ1blR5cGU6IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID8gVGFza1J1blR5cGUuQmFja2dyb3VuZCA6IFRhc2tSdW5UeXBlLlNpbmdsZVJ1bixcblx0XHRcdGdyb3VwOiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwLFxuXHRcdFx0X190YXNrOiB0YXNrLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gc3RhcnQodGFzazogVGFzaywgdGVybWluYWxJZDogbnVtYmVyLCByZXNvbHZlZFZhcmlhYmxlczogTWFwPHN0cmluZywgc3RyaW5nPik6IElUYXNrU3RhcnRlZEV2ZW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uY29tbW9uKHRhc2spLFxuXHRcdFx0a2luZDogVGFza0V2ZW50S2luZC5TdGFydCxcblx0XHRcdHRlcm1pbmFsSWQsXG5cdFx0XHRyZXNvbHZlZFZhcmlhYmxlcyxcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHByb2Nlc3NTdGFydGVkKHRhc2s6IFRhc2ssIHRlcm1pbmFsSWQ6IG51bWJlciwgcHJvY2Vzc0lkOiBudW1iZXIpOiBJVGFza1Byb2Nlc3NTdGFydGVkRXZlbnQge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5jb21tb24odGFzayksXG5cdFx0XHRraW5kOiBUYXNrRXZlbnRLaW5kLlByb2Nlc3NTdGFydGVkLFxuXHRcdFx0dGVybWluYWxJZCxcblx0XHRcdHByb2Nlc3NJZCxcblx0XHR9O1xuXHR9XG5cdGV4cG9ydCBmdW5jdGlvbiBwcm9jZXNzRW5kZWQodGFzazogVGFzaywgdGVybWluYWxJZDogbnVtYmVyIHwgdW5kZWZpbmVkLCBleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogSVRhc2tQcm9jZXNzRW5kZWRFdmVudCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLmNvbW1vbih0YXNrKSxcblx0XHRcdGtpbmQ6IFRhc2tFdmVudEtpbmQuUHJvY2Vzc0VuZGVkLFxuXHRcdFx0dGVybWluYWxJZCxcblx0XHRcdGV4aXRDb2RlLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gdGVybWluYXRlZCh0YXNrOiBUYXNrLCB0ZXJtaW5hbElkOiBudW1iZXIsIGV4aXRSZWFzb246IFRlcm1pbmFsRXhpdFJlYXNvbiB8IHVuZGVmaW5lZCk6IElUYXNrVGVybWluYXRlZEV2ZW50IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uY29tbW9uKHRhc2spLFxuXHRcdFx0a2luZDogVGFza0V2ZW50S2luZC5UZXJtaW5hdGVkLFxuXHRcdFx0ZXhpdFJlYXNvbixcblx0XHRcdHRlcm1pbmFsSWQsXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBnZW5lcmFsKGtpbmQ6IFRhc2tFdmVudEtpbmQuQWNxdWlyZWRJbnB1dCB8IFRhc2tFdmVudEtpbmQuRGVwZW5kc09uU3RhcnRlZCB8IFRhc2tFdmVudEtpbmQuQWN0aXZlIHwgVGFza0V2ZW50S2luZC5JbmFjdGl2ZSB8IFRhc2tFdmVudEtpbmQuRW5kIHwgVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlckVuZGVkIHwgVGFza0V2ZW50S2luZC5Qcm9ibGVtTWF0Y2hlclN0YXJ0ZWQgfCBUYXNrRXZlbnRLaW5kLlByb2JsZW1NYXRjaGVyRm91bmRFcnJvcnMsIHRhc2s6IFRhc2ssIHRlcm1pbmFsSWQ/OiBudW1iZXIpOiBJVGFza0dlbmVyYWxFdmVudCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLmNvbW1vbih0YXNrKSxcblx0XHRcdGtpbmQsXG5cdFx0XHR0ZXJtaW5hbElkLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gY2hhbmdlZCgpOiBJVGFza0NoYW5nZWRFdmVudCB7XG5cdFx0cmV0dXJuIHsga2luZDogVGFza0V2ZW50S2luZC5DaGFuZ2VkIH07XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBLZXllZFRhc2tJZGVudGlmaWVyIHtcblx0ZnVuY3Rpb24gc29ydGVkU3RyaW5naWZ5KGxpdGVyYWw6IGFueSk6IHN0cmluZyB7XG5cdFx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGxpdGVyYWwpLnNvcnQoKTtcblx0XHRsZXQgcmVzdWx0OiBzdHJpbmcgPSAnJztcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRsZXQgc3RyaW5naWZpZWQgPSBsaXRlcmFsW2tleV07XG5cdFx0XHRpZiAoc3RyaW5naWZpZWQgaW5zdGFuY2VvZiBPYmplY3QpIHtcblx0XHRcdFx0c3RyaW5naWZpZWQgPSBzb3J0ZWRTdHJpbmdpZnkoc3RyaW5naWZpZWQpO1xuXHRcdFx0fSBlbHNlIGlmICh0eXBlb2Ygc3RyaW5naWZpZWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHN0cmluZ2lmaWVkID0gc3RyaW5naWZpZWQucmVwbGFjZSgvLC9nLCAnLCwnKTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdCArPSBrZXkgKyAnLCcgKyBzdHJpbmdpZmllZCArICcsJztcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXHRleHBvcnQgZnVuY3Rpb24gY3JlYXRlKHZhbHVlOiBJVGFza0lkZW50aWZpZXIpOiBLZXllZFRhc2tJZGVudGlmaWVyIHtcblx0XHRjb25zdCByZXN1bHRLZXkgPSBzb3J0ZWRTdHJpbmdpZnkodmFsdWUpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHsgX2tleTogcmVzdWx0S2V5LCB0eXBlOiB2YWx1ZS50YXNrVHlwZSB9O1xuXHRcdE9iamVjdC5hc3NpZ24ocmVzdWx0LCB2YWx1ZSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBUYXNrU2V0dGluZ0lkIHtcblx0QXV0b0RldGVjdCA9ICd0YXNrLmF1dG9EZXRlY3QnLFxuXHRTYXZlQmVmb3JlUnVuID0gJ3Rhc2suc2F2ZUJlZm9yZVJ1bicsXG5cdFNob3dEZWNvcmF0aW9ucyA9ICd0YXNrLnNob3dEZWNvcmF0aW9ucycsXG5cdFByb2JsZW1NYXRjaGVyc05ldmVyUHJvbXB0ID0gJ3Rhc2sucHJvYmxlbU1hdGNoZXJzLm5ldmVyUHJvbXB0Jyxcblx0U2xvd1Byb3ZpZGVyV2FybmluZyA9ICd0YXNrLnNsb3dQcm92aWRlcldhcm5pbmcnLFxuXHRRdWlja09wZW5IaXN0b3J5ID0gJ3Rhc2sucXVpY2tPcGVuLmhpc3RvcnknLFxuXHRRdWlja09wZW5EZXRhaWwgPSAndGFzay5xdWlja09wZW4uZGV0YWlsJyxcblx0UXVpY2tPcGVuU2tpcCA9ICd0YXNrLnF1aWNrT3Blbi5za2lwJyxcblx0UXVpY2tPcGVuU2hvd0FsbCA9ICd0YXNrLnF1aWNrT3Blbi5zaG93QWxsJyxcblx0QWxsb3dBdXRvbWF0aWNUYXNrcyA9ICd0YXNrLmFsbG93QXV0b21hdGljVGFza3MnLFxuXHRSZWNvbm5lY3Rpb24gPSAndGFzay5yZWNvbm5lY3Rpb24nLFxuXHRWZXJib3NlTG9nZ2luZyA9ICd0YXNrLnZlcmJvc2VMb2dnaW5nJ1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBUYXNrc1NjaGVtYVByb3BlcnRpZXMge1xuXHRUYXNrcyA9ICd0YXNrcycsXG5cdFN1cHByZXNzVGFza05hbWUgPSAndGFza3Muc3VwcHJlc3NUYXNrTmFtZScsXG5cdFdpbmRvd3MgPSAndGFza3Mud2luZG93cycsXG5cdE9zeCA9ICd0YXNrcy5vc3gnLFxuXHRMaW51eCA9ICd0YXNrcy5saW51eCcsXG5cdFNob3dPdXRwdXQgPSAndGFza3Muc2hvd091dHB1dCcsXG5cdElzU2hlbGxDb21tYW5kID0gJ3Rhc2tzLmlzU2hlbGxDb21tYW5kJyxcblx0U2VydmljZVRlc3RTZXR0aW5nID0gJ3Rhc2tzLnNlcnZpY2UudGVzdFNldHRpbmcnLFxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFRhc2tEZWZpbml0aW9uIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVRhc2tJZGVudGlmaWVyKGV4dGVybmFsOiBJVGFza0lkZW50aWZpZXIsIHJlcG9ydGVyOiB7IGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgfSk6IEtleWVkVGFza0lkZW50aWZpZXIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGRlZmluaXRpb24gPSBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmdldChleHRlcm5hbC50eXBlKTtcblx0XHRpZiAoZGVmaW5pdGlvbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBXZSBoYXZlIG5vIHRhc2sgZGVmaW5pdGlvbiBzbyB3ZSBjYW4ndCBzYW5pdGl6ZSB0aGUgbGl0ZXJhbC4gVGFrZSBpdCBhcyBpc1xuXHRcdFx0Y29uc3QgY29weSA9IE9iamVjdHMuZGVlcENsb25lKGV4dGVybmFsKTtcblx0XHRcdGRlbGV0ZSBjb3B5Ll9rZXk7XG5cdFx0XHRyZXR1cm4gS2V5ZWRUYXNrSWRlbnRpZmllci5jcmVhdGUoY29weSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGl0ZXJhbDogeyB0eXBlOiBzdHJpbmc7W25hbWU6IHN0cmluZ106IGFueSB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRsaXRlcmFsLnR5cGUgPSBkZWZpbml0aW9uLnRhc2tUeXBlO1xuXHRcdGNvbnN0IHJlcXVpcmVkOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0XHRkZWZpbml0aW9uLnJlcXVpcmVkLmZvckVhY2goZWxlbWVudCA9PiByZXF1aXJlZC5hZGQoZWxlbWVudCkpO1xuXG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IGRlZmluaXRpb24ucHJvcGVydGllcztcblx0XHRmb3IgKGNvbnN0IHByb3BlcnR5IG9mIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGV4dGVybmFsW3Byb3BlcnR5XTtcblx0XHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdGxpdGVyYWxbcHJvcGVydHldID0gdmFsdWU7XG5cdFx0XHR9IGVsc2UgaWYgKHJlcXVpcmVkLmhhcyhwcm9wZXJ0eSkpIHtcblx0XHRcdFx0Y29uc3Qgc2NoZW1hID0gcHJvcGVydGllc1twcm9wZXJ0eV07XG5cdFx0XHRcdGlmIChzY2hlbWEuZGVmYXVsdCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0bGl0ZXJhbFtwcm9wZXJ0eV0gPSBPYmplY3RzLmRlZXBDbG9uZShzY2hlbWEuZGVmYXVsdCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c3dpdGNoIChzY2hlbWEudHlwZSkge1xuXHRcdFx0XHRcdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRcdFx0XHRcdGxpdGVyYWxbcHJvcGVydHldID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAnbnVtYmVyJzpcblx0XHRcdFx0XHRcdGNhc2UgJ2ludGVnZXInOlxuXHRcdFx0XHRcdFx0XHRsaXRlcmFsW3Byb3BlcnR5XSA9IDA7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAnc3RyaW5nJzpcblx0XHRcdFx0XHRcdFx0bGl0ZXJhbFtwcm9wZXJ0eV0gPSAnJztcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0XHRyZXBvcnRlci5lcnJvcihubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdFx0J1Rhc2tEZWZpbml0aW9uLm1pc3NpbmdSZXF1aXJlZFByb3BlcnR5Jyxcblx0XHRcdFx0XHRcdFx0XHQnRXJyb3I6IHRoZSB0YXNrIGlkZW50aWZpZXIgXFwnezB9XFwnIGlzIG1pc3NpbmcgdGhlIHJlcXVpcmVkIHByb3BlcnR5IFxcJ3sxfVxcJy4gVGhlIHRhc2sgaWRlbnRpZmllciB3aWxsIGJlIGlnbm9yZWQuJywgSlNPTi5zdHJpbmdpZnkoZXh0ZXJuYWwsIHVuZGVmaW5lZCwgMCksIHByb3BlcnR5XG5cdFx0XHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gS2V5ZWRUYXNrSWRlbnRpZmllci5jcmVhdGUobGl0ZXJhbCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFdBQVc7QUFDdkIsWUFBWSxlQUFlO0FBRTNCLFlBQVksYUFBYTtBQUt6QixTQUFTLHFCQUEyQztBQUNwRCxTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLDJCQUEyQjtBQUs3QixNQUFNLHVCQUF1QjtBQUU3QixNQUFNLHFCQUFxQixJQUFJLGNBQXVCLGVBQWUsT0FBTyxJQUFJLFNBQVMsNEJBQTRCLHNDQUFzQyxDQUFDO0FBRTVKLE1BQU0sdUJBQXVCLElBQUksY0FBdUIsc0JBQXNCLE9BQU8sSUFBSSxTQUFTLHNCQUFzQixpREFBaUQsQ0FBQztBQUMxSyxNQUFNLGlCQUFpQixJQUFJLFVBQVUsaUJBQWlCLE9BQU87QUFFN0QsSUFBSyxlQUFMLGtCQUFLQSxrQkFBTDtBQUlOLEVBQUFBLDRCQUFBLFlBQVMsS0FBVDtBQUtBLEVBQUFBLDRCQUFBLFlBQVMsS0FBVDtBQUtBLEVBQUFBLDRCQUFBLFVBQU8sS0FBUDtBQWRXLFNBQUFBO0FBQUEsR0FBQTtBQWlCTCxNQUFNLHVCQUF1QjtBQUFBLENBRTdCLENBQVVBLGtCQUFWO0FBQ0MsV0FBUyxLQUFpQixPQUE2QjtBQUM3RCxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU87QUFBQSxJQUNSO0FBQ0EsWUFBUSxNQUFNLFlBQVksR0FBRztBQUFBLE1BQzVCLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1IsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSO0FBQ0MsZUFBTztBQUFBLElBQ1Q7QUFBQSxFQUNEO0FBZE8sRUFBQUEsY0FBUztBQUFBLEdBREE7QUEyRVYsSUFBVTtBQUFBLENBQVYsQ0FBVUMsb0JBQVY7QUFDQyxFQUFNQSxnQkFBQSxXQUEyQixFQUFFLEtBQUsscUJBQXFCO0FBQUEsR0FEcEQ7QUFJVixJQUFLLGFBQUwsa0JBQUtDLGdCQUFMO0FBSU4sRUFBQUEsd0JBQUEsWUFBUyxLQUFUO0FBUUEsRUFBQUEsd0JBQUEsWUFBUyxLQUFUO0FBS0EsRUFBQUEsd0JBQUEsV0FBUSxLQUFSO0FBakJXLFNBQUFBO0FBQUEsR0FBQTtBQUFBLENBb0JMLENBQVVBLGdCQUFWO0FBQ0MsV0FBUyxXQUF1QixPQUEyQjtBQUNqRSxZQUFRLE1BQU0sWUFBWSxHQUFHO0FBQUEsTUFDNUIsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1I7QUFDQyxlQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Q7QUFYTyxFQUFBQSxZQUFTO0FBQUEsR0FEQTtBQWVWLElBQUssb0JBQUwsa0JBQUtDLHVCQUFMO0FBSU4sRUFBQUEsc0NBQUEsV0FBUSxLQUFSO0FBTUEsRUFBQUEsc0NBQUEsZUFBWSxLQUFaO0FBS0EsRUFBQUEsc0NBQUEsWUFBUyxLQUFUO0FBZlcsU0FBQUE7QUFBQSxHQUFBO0FBQUEsQ0FrQkwsQ0FBVUEsdUJBQVY7QUFDQyxXQUFTLFdBQXVCLE9BQWtDO0FBQ3hFLFlBQVEsTUFBTSxZQUFZLEdBQUc7QUFBQSxNQUM1QixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1IsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUjtBQUNDLGVBQU87QUFBQSxJQUNUO0FBQUEsRUFDRDtBQVhPLEVBQUFBLG1CQUFTO0FBQUEsR0FEQTtBQWVWLElBQUssWUFBTCxrQkFBS0MsZUFBTDtBQUtOLEVBQUFBLHNCQUFBLFlBQVMsS0FBVDtBQU1BLEVBQUFBLHNCQUFBLGVBQVksS0FBWjtBQUtBLEVBQUFBLHNCQUFBLFNBQU0sS0FBTjtBQWhCVyxTQUFBQTtBQUFBLEdBQUE7QUFBQSxDQW1CTCxDQUFVQSxlQUFWO0FBQ0MsV0FBUyxXQUFXLE9BQTBCO0FBQ3BELFlBQVEsTUFBTSxZQUFZLEdBQUc7QUFBQSxNQUM1QixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1IsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUjtBQUNDLGVBQU87QUFBQSxJQUNUO0FBQUEsRUFDRDtBQVhPLEVBQUFBLFdBQVM7QUFBQSxHQURBO0FBbUVWLElBQVU7QUFBQSxDQUFWLENBQVVDLHlCQUFWO0FBQ0MsRUFBTUEscUJBQUEsV0FBaUM7QUFBQSxJQUM3QyxNQUFNO0FBQUEsSUFBTSxRQUFRO0FBQUEsSUFBbUIsZ0JBQWdCO0FBQUEsSUFBeUIsT0FBTztBQUFBLElBQU8sT0FBTztBQUFBLElBQWtCLGtCQUFrQjtBQUFBLElBQU0sT0FBTztBQUFBLEVBQ3ZKO0FBQUEsR0FIZ0I7QUFNVixJQUFLLGNBQUwsa0JBQUtDLGlCQUFMO0FBQ04sRUFBQUEsMEJBQUEsV0FBUSxLQUFSO0FBQ0EsRUFBQUEsMEJBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsMEJBQUEscUJBQWtCLEtBQWxCO0FBSFcsU0FBQUE7QUFBQSxHQUFBO0FBQUEsQ0FNTCxDQUFVQSxpQkFBVjtBQUNDLFdBQVMsV0FBVyxPQUE0QjtBQUN0RCxZQUFRLE1BQU0sWUFBWSxHQUFHO0FBQUEsTUFDNUIsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1I7QUFDQyxlQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Q7QUFYTyxFQUFBQSxhQUFTO0FBWVQsV0FBUyxTQUFTLE9BQTRCO0FBQ3BELFlBQVEsT0FBTztBQUFBLE1BQ2QsS0FBSztBQUFtQixlQUFPO0FBQUEsTUFDL0IsS0FBSztBQUFxQixlQUFPO0FBQUEsTUFDakMsS0FBSztBQUE2QixlQUFPO0FBQUEsTUFDekM7QUFBUyxlQUFPO0FBQUEsSUFDakI7QUFBQSxFQUNEO0FBUE8sRUFBQUEsYUFBUztBQUFBLEdBYkE7QUE4QlYsSUFBVTtBQUFBLENBQVYsQ0FBVUMsbUJBQVY7QUFDQyxXQUFTLE1BQU1DLFFBQThCO0FBQ25ELFFBQUksTUFBTSxTQUFTQSxNQUFLLEdBQUc7QUFDMUIsYUFBT0E7QUFBQSxJQUNSLE9BQU87QUFDTixhQUFPQSxPQUFNO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFOTyxFQUFBRCxlQUFTO0FBQUEsR0FEQTtBQWlEVixJQUFVO0FBQUEsQ0FBVixDQUFVRSxlQUFWO0FBQ0MsRUFBTUEsV0FBQSxRQUFtQixFQUFFLEtBQUssU0FBUyxXQUFXLE1BQU07QUFFMUQsRUFBTUEsV0FBQSxRQUFtQixFQUFFLEtBQUssU0FBUyxXQUFXLE1BQU07QUFFMUQsRUFBTUEsV0FBQSxVQUFxQixFQUFFLEtBQUssV0FBVyxXQUFXLE1BQU07QUFFOUQsRUFBTUEsV0FBQSxPQUFrQixFQUFFLEtBQUssUUFBUSxXQUFXLE1BQU07QUFFeEQsV0FBUyxHQUFHLE9BQTZCO0FBQy9DLFdBQU8sVUFBVUEsV0FBQSxNQUFNLE9BQU8sVUFBVUEsV0FBQSxNQUFNLE9BQU8sVUFBVUEsV0FBQSxRQUFRLE9BQU8sVUFBVUEsV0FBQSxLQUFLO0FBQUEsRUFDOUY7QUFGTyxFQUFBQSxXQUFTO0FBSVQsV0FBUyxLQUFLLE9BQThEO0FBQ2xGLFFBQUksVUFBVSxRQUFXO0FBQ3hCLGFBQU87QUFBQSxJQUNSLFdBQVcsTUFBTSxTQUFTLEtBQUssR0FBRztBQUNqQyxVQUFJLEdBQUcsS0FBSyxHQUFHO0FBQ2QsZUFBTyxFQUFFLEtBQUssT0FBTyxXQUFXLE1BQU07QUFBQSxNQUN2QztBQUNBLGFBQU87QUFBQSxJQUNSLE9BQU87QUFDTixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFYTyxFQUFBQSxXQUFTO0FBQUEsR0FiQTtBQWdDVixJQUFXLFlBQVgsa0JBQVdDLGVBQVg7QUFDTixFQUFBQSxzQkFBQSxZQUFTLEtBQVQ7QUFDQSxFQUFBQSxzQkFBQSxlQUFZLEtBQVo7QUFDQSxFQUFBQSxzQkFBQSxZQUFTLEtBQVQ7QUFIaUIsU0FBQUE7QUFBQSxHQUFBO0FBTVgsSUFBVTtBQUFBLENBQVYsQ0FBVUMsb0JBQVY7QUFDQyxFQUFNQSxnQkFBQSxZQUF5QjtBQUMvQixFQUFNQSxnQkFBQSxZQUF5QjtBQUMvQixFQUFNQSxnQkFBQSxXQUF1QjtBQUM3QixFQUFNQSxnQkFBQSxnQkFBaUM7QUFDdkMsRUFBTUEsZ0JBQUEsT0FBZTtBQUVyQixXQUFTLHNCQUFzQixNQUFtQztBQUN4RSxZQUFRLE1BQU07QUFBQSxNQUNiLEtBQUtBLGdCQUFlO0FBQU0sZUFBTyxvQkFBb0I7QUFBQSxNQUNyRCxLQUFLQSxnQkFBZTtBQUFlLGVBQU8sb0JBQW9CO0FBQUEsTUFDOUQ7QUFBUyxlQUFPLG9CQUFvQjtBQUFBLElBQ3JDO0FBQUEsRUFDRDtBQU5PLEVBQUFBLGdCQUFTO0FBQUEsR0FQQTtBQStFVixJQUFXLGVBQVgsa0JBQVdDLGtCQUFYO0FBQ04sRUFBQUEsY0FBQSxjQUFXO0FBQ1gsRUFBQUEsY0FBQSxjQUFXO0FBRk0sU0FBQUE7QUFBQSxHQUFBO0FBeUVYLElBQUssZUFBTCxrQkFBS0Msa0JBQUw7QUFDTixFQUFBQSw0QkFBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSw0QkFBQSxnQkFBYSxLQUFiO0FBRlcsU0FBQUE7QUFBQSxHQUFBO0FBV0wsSUFBVTtBQUFBLENBQVYsQ0FBVUMsZ0JBQVY7QUFDQyxFQUFNQSxZQUFBLFdBQXdCLEVBQUUsbUJBQW1CLE1BQU0sT0FBTyxpQkFBc0IsZUFBZSxFQUFFO0FBQUEsR0FEOUY7QUFJVixNQUFlLFdBQVc7QUFBQSxFQXNCdEIsWUFBWSxJQUFZLE9BQTJCLE1BQTBCLFlBQ3RGLHlCQUFtRCxRQUF5QjtBQWI3RTtBQUFBO0FBQUE7QUFBQSxrQkFBaUI7QUFjaEIsU0FBSyxNQUFNO0FBQ1gsUUFBSSxPQUFPO0FBQ1YsV0FBSyxTQUFTO0FBQUEsSUFDZjtBQUNBLFFBQUksTUFBTTtBQUNULFdBQUssT0FBTztBQUFBLElBQ2I7QUFDQSxTQUFLLGFBQWE7QUFDbEIsU0FBSywwQkFBMEI7QUFDL0IsU0FBSyxVQUFVO0FBQUEsRUFDaEI7QUFBQSxFQUVPLGNBQWMsV0FBc0Q7QUFDMUUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLFlBQW9CO0FBQzFCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVPLFNBQTZCO0FBQ25DLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFJTyxrQkFBMEI7QUFNaEMsVUFBTSxNQUFzQixFQUFFLFFBQVEsS0FBSyxZQUFZLEdBQUcsSUFBSSxLQUFLLElBQUk7QUFDdkUsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzFCO0FBQUEsRUFFTyxRQUFjO0FBQ3BCLFdBQU8sS0FBSyxXQUFXLE9BQU8sT0FBTyxDQUFDLEdBQVEsSUFBSSxDQUFDO0FBQUEsRUFDcEQ7QUFBQSxFQUlPLHFCQUFtRDtBQUN6RCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sdUJBQTJDO0FBQ2pELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxtQkFBMkI7QUFDakMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLFFBQVEsS0FBK0MsWUFBcUIsT0FBZ0I7QUFDbEcsUUFBSSxRQUFRLFFBQVc7QUFDdEIsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLE1BQU0sU0FBUyxHQUFHLEdBQUc7QUFDeEIsYUFBTyxRQUFRLEtBQUssVUFBVSxRQUFRLEtBQUssd0JBQXdCLGNBQWUsYUFBYSxRQUFRLEtBQUs7QUFBQSxJQUM3RztBQUNBLFVBQU0sYUFBYSxLQUFLLGNBQWMsSUFBSTtBQUMxQyxXQUFPLGVBQWUsVUFBYSxXQUFXLFNBQVMsSUFBSTtBQUFBLEVBQzVEO0FBQUEsRUFFTyxvQkFBNEI7QUFDbEMsVUFBTSxrQkFBa0IsS0FBSyxtQkFBbUI7QUFDaEQsUUFBSSxpQkFBaUI7QUFDcEIsYUFBTyxHQUFHLEtBQUssTUFBTSxLQUFLLGdCQUFnQixJQUFJO0FBQUEsSUFDL0MsT0FBTztBQUNOLGFBQU8sS0FBSztBQUFBLElBQ2I7QUFBQSxFQUNEO0FBQUEsRUFFTyxtQkFBbUM7QUFDekMsVUFBTSxTQUF5QjtBQUFBLE1BQzlCLElBQUksS0FBSztBQUFBLE1BQ1QsTUFBVztBQUFBLElBQ1o7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sb0JBQW9CLFVBQWdDO0FBQzFELFFBQUksS0FBSyxzQkFBc0IsUUFBVztBQUN6QyxXQUFLLG9CQUFvQixDQUFDO0FBQUEsSUFDM0I7QUFDQSxRQUFJLFVBQVU7QUFDYixXQUFLLG9CQUFvQixLQUFLLGtCQUFrQixPQUFPLFFBQVE7QUFBQSxJQUNoRTtBQUFBLEVBQ0Q7QUFBQSxFQUVBLElBQUksbUJBQXlDO0FBQzVDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFDRDtBQVFPLE1BQU0sbUJBQW1CLFdBQVc7QUFBQSxFQWtCbkMsWUFBWSxJQUFZLFFBQTZCLE9BQWUsTUFBYyxTQUN4RixvQkFBNkIsWUFBeUIseUJBQW1EO0FBQ3pHLFVBQU0sSUFBSSxPQUFPLFFBQVcsWUFBWSx5QkFBeUIsTUFBTTtBQUp4RTtBQUFBO0FBQUE7QUFBQSxtQkFBaUMsQ0FBQztBQUtqQyxTQUFLLFVBQVU7QUFDZixTQUFLLHFCQUFxQjtBQUMxQixRQUFJLFNBQVM7QUFDWixXQUFLLFVBQVU7QUFBQSxJQUNoQjtBQUFBLEVBQ0Q7QUFBQSxFQUVnQixRQUFvQjtBQUNuQyxXQUFPLElBQUksV0FBVyxLQUFLLEtBQUssS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLE1BQU0sS0FBSyxTQUFTLEtBQUssb0JBQW9CLEtBQUssWUFBWSxLQUFLLHVCQUF1QjtBQUFBLEVBQzNKO0FBQUEsRUFFTyxhQUE4QztBQUNwRCxRQUFJLEtBQUssV0FBVyxLQUFLLFFBQVEsWUFBWTtBQUM1QyxhQUFPLEtBQUssUUFBUTtBQUFBLElBQ3JCO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVnQixjQUFjLFlBQXFCLE9BQTRCO0FBQzlFLFFBQUksYUFBYSxLQUFLLFFBQVEsZUFBZSxRQUFXO0FBQ3ZELGFBQU8sS0FBSyxRQUFRO0FBQUEsSUFDckIsT0FBTztBQUNOLFVBQUk7QUFDSixZQUFNLGlCQUFpQixLQUFLLFVBQVUsS0FBSyxRQUFRLFVBQVU7QUFDN0QsY0FBUSxnQkFBZ0I7QUFBQSxRQUN2QixLQUFLO0FBQ0osaUJBQU87QUFDUDtBQUFBLFFBRUQsS0FBSztBQUNKLGlCQUFPO0FBQ1A7QUFBQSxRQUVELEtBQUs7QUFDSixpQkFBTztBQUNQO0FBQUEsUUFFRCxLQUFLO0FBQ0osaUJBQU87QUFDUDtBQUFBLFFBRUQ7QUFDQyxnQkFBTSxJQUFJLE1BQU0seUJBQXlCO0FBQUEsTUFDM0M7QUFFQSxZQUFNLFNBQThCO0FBQUEsUUFDbkM7QUFBQSxRQUNBLE1BQU0sS0FBSztBQUFBLFFBQ1gsSUFBSSxLQUFLO0FBQUEsTUFDVjtBQUNBLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBYyxHQUFHLE9BQWlDO0FBQ2pELFdBQU8saUJBQWlCO0FBQUEsRUFDekI7QUFBQSxFQUVnQixZQUFvQjtBQUNuQyxVQUFNLGtCQUFrQixLQUFLLFFBQVEsT0FBTztBQUM1QyxXQUFPLGtCQUFrQixHQUFHLGdCQUFnQixJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLLEdBQUcsS0FBSyxHQUFHLElBQUksS0FBSyxRQUFRO0FBQUEsRUFDekg7QUFBQSxFQUVVLGNBQWtDO0FBQzNDLFdBQU8sS0FBSyxRQUFRLFNBQVMsZUFBZSxPQUFPLHVCQUF1QixLQUFLLFFBQVEsT0FBTyxpQkFBaUIsSUFBSSxTQUFTO0FBQUEsRUFDN0g7QUFBQSxFQUVnQixrQkFBMEI7QUFDekMsV0FBTyxLQUFLLFFBQVEsYUFBYSxNQUFNLGdCQUFnQixJQUFLLEtBQUssT0FBTyxLQUFLLE1BQU0sZ0JBQWdCO0FBQUEsRUFDcEc7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtnQixTQUE2QjtBQU01QyxVQUFNLGtCQUFrQixLQUFLLFlBQVk7QUFDekMsUUFBSSxDQUFDLGlCQUFpQjtBQUNyQixhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUksS0FBYSxLQUFLLHdCQUF3QjtBQUM5QyxRQUFJLEtBQUssUUFBUSxTQUFTLGVBQWUsV0FBVztBQUNuRCxZQUFNLEtBQUssUUFBUTtBQUFBLElBQ3BCO0FBQ0EsVUFBTSxNQUFrQixFQUFFLE1BQU0sc0JBQXNCLFFBQVEsaUJBQWlCLEdBQUc7QUFDbEYsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzFCO0FBQUEsRUFFZ0IscUJBQW1EO0FBQ2xFLFdBQU8sS0FBSyxRQUFRLE9BQU87QUFBQSxFQUM1QjtBQUFBLEVBRWdCLHVCQUEyQztBQUMxRCxXQUFRLEtBQUssUUFBUSxPQUFPLGFBQWEsS0FBSyxRQUFRLE9BQU8sVUFBVSxnQkFBaUIsVUFBVSxTQUFTLEtBQUssUUFBUSxPQUFPLFVBQVUsYUFBYSxJQUFJO0FBQUEsRUFDM0o7QUFBQSxFQUVnQixtQkFBMkI7QUFDMUMsUUFBSSxLQUFLLFFBQVEsWUFBWTtBQUM1QixhQUFPO0FBQUEsSUFDUixPQUFPO0FBQ04sYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQUEsRUFFVSxXQUFXLFFBQWdDO0FBQ3BELFdBQU8sSUFBSSxXQUFXLE9BQU8sS0FBSyxPQUFPLFNBQVMsT0FBTyxRQUFRLE9BQU8sTUFBTSxPQUFPLFNBQVMsT0FBTyxvQkFBb0IsT0FBTyxZQUFZLE9BQU8sdUJBQXVCO0FBQUEsRUFDM0s7QUFDRDtBQU9PLE1BQU0sd0JBQXdCLFdBQVc7QUFBQSxFQVN4QyxZQUFZLElBQVksUUFBNkIsT0FBMkIsTUFDdEYsWUFBaUMsWUFBeUIseUJBQW1EO0FBQzdHLFVBQU0sSUFBSSxPQUFPLE1BQU0sWUFBWSx5QkFBeUIsTUFBTTtBQUNsRSxTQUFLLFVBQVU7QUFDZixTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRUEsT0FBYyxHQUFHLE9BQXNDO0FBQ3RELFdBQU8saUJBQWlCO0FBQUEsRUFDekI7QUFBQSxFQUVVLFdBQVcsUUFBbUI7QUFDdkMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVnQixnQkFBcUM7QUFDcEQsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRWdCLHVCQUEyQztBQUMxRCxXQUFRLEtBQUssUUFBUSxPQUFPLGFBQWEsS0FBSyxRQUFRLE9BQU8sVUFBVSxnQkFBaUIsVUFBVSxTQUFTLEtBQUssUUFBUSxPQUFPLFVBQVUsYUFBYSxJQUFJO0FBQUEsRUFDM0o7QUFBQSxFQUVnQixxQkFBbUQ7QUFDbEUsV0FBTyxLQUFLLFFBQVEsT0FBTztBQUFBLEVBQzVCO0FBQUEsRUFFVSxjQUFrQztBQUMzQyxXQUFPLEtBQUssUUFBUSxTQUFTLGVBQWUsT0FBTyx1QkFBdUIsS0FBSyxRQUFRLE9BQU8saUJBQWlCLElBQUksU0FBUztBQUFBLEVBQzdIO0FBQUEsRUFFZ0IsU0FBNkI7QUFNNUMsVUFBTSxrQkFBa0IsS0FBSyxZQUFZO0FBQ3pDLFFBQUksQ0FBQyxpQkFBaUI7QUFDckIsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLEtBQWEsS0FBSyx3QkFBd0I7QUFDOUMsUUFBSSxLQUFLLFFBQVEsU0FBUyxlQUFlLFdBQVc7QUFDbkQsWUFBTSxLQUFLLFFBQVE7QUFBQSxJQUNwQjtBQUNBLFVBQU0sTUFBa0IsRUFBRSxNQUFNLHNCQUFzQixRQUFRLGlCQUFpQixHQUFHO0FBQ2xGLFdBQU8sS0FBSyxVQUFVLEdBQUc7QUFBQSxFQUMxQjtBQUNEO0FBS08sTUFBTSx3QkFBd0IsV0FBVztBQUFBLEVBNkJ4QyxZQUFZLElBQVksUUFBOEIsT0FBZSxNQUEwQixTQUNyRyxTQUFnQyxvQkFBNkIsWUFDN0QseUJBQW1EO0FBQ25ELFVBQU0sSUFBSSxPQUFPLE1BQU0sWUFBWSx5QkFBeUIsTUFBTTtBQUNsRSxTQUFLLFVBQVU7QUFDZixTQUFLLHFCQUFxQjtBQUMxQixTQUFLLFVBQVU7QUFDZixTQUFLLE9BQU8sd0JBQXdCO0FBQ3BDLFNBQUssT0FBTyx3QkFBd0I7QUFBQSxFQUNyQztBQUFBLEVBRWdCLFFBQXlCO0FBQ3hDLFdBQU8sSUFBSSxnQkFBZ0IsS0FBSyxLQUFLLEtBQUssU0FBUyxLQUFLLFFBQVEsS0FBSyxNQUFNLEtBQUssU0FBUyxLQUFLLFNBQVMsS0FBSyxvQkFBb0IsS0FBSyxZQUFZLEtBQUssdUJBQXVCO0FBQUEsRUFDOUs7QUFBQSxFQUVnQixnQkFBcUM7QUFDcEQsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsT0FBYyxHQUFHLE9BQXNDO0FBQ3RELFdBQU8saUJBQWlCO0FBQUEsRUFDekI7QUFBQSxFQUVnQixZQUFvQjtBQUNuQyxVQUFNLGtCQUFrQixLQUFLLFFBQVE7QUFDckMsV0FBTyxrQkFDSixHQUFHLEtBQUssUUFBUSxNQUFNLFNBQVMsQ0FBQyxJQUFJLGdCQUFnQixJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssUUFBUSxLQUMvRixHQUFHLEtBQUssUUFBUSxNQUFNLFNBQVMsQ0FBQyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssUUFBUTtBQUFBLEVBQ2pFO0FBQUEsRUFFVSxjQUFrQztBQUMzQyxRQUFJLEtBQUssUUFBUSxVQUFVLGtCQUFvQixLQUFLLFFBQVEsaUJBQWlCO0FBQzVFLGFBQU8sS0FBSyxRQUFRLGdCQUFnQixJQUFJLFNBQVM7QUFBQSxJQUNsRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFZ0IsU0FBNkI7QUFRNUMsVUFBTSxNQUF1QixFQUFFLE1BQU0sZUFBZSxPQUFPLEtBQUssUUFBUSxPQUFPLElBQUksS0FBSyxJQUFJO0FBQzVGLFFBQUksU0FBUyxLQUFLLFlBQVk7QUFDOUIsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzFCO0FBQUEsRUFFZ0IscUJBQW1EO0FBQ2xFLFdBQU8sS0FBSyxRQUFRO0FBQUEsRUFDckI7QUFBQSxFQUVnQixtQkFBMkI7QUFDMUMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVVLFdBQVcsUUFBMEM7QUFDOUQsV0FBTyxJQUFJLGdCQUFnQixPQUFPLEtBQUssT0FBTyxTQUFTLE9BQU8sUUFBUSxPQUFPLE1BQU0sT0FBTyxTQUFTLE9BQU8sU0FBUyxPQUFPLG9CQUFvQixPQUFPLFlBQVksT0FBTyx1QkFBdUI7QUFBQSxFQUNoTTtBQUNEO0FBRU8sTUFBTSxxQkFBcUIsV0FBVztBQUFBLEVBVXJDLFlBQVksSUFBWSxRQUE2QixPQUFlLE1BQzFFLFlBQXlCLHlCQUFtRDtBQUM1RSxVQUFNLElBQUksT0FBTyxNQUFNLFlBQVkseUJBQXlCLE1BQU07QUFDbEUsU0FBSyxVQUFVO0FBQUEsRUFDaEI7QUFBQSxFQUVnQixRQUFzQjtBQUNyQyxXQUFPLElBQUksYUFBYSxLQUFLLEtBQUssS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLE1BQU0sS0FBSyxZQUFZLEtBQUssdUJBQXVCO0FBQUEsRUFDdEg7QUFBQSxFQUVBLE9BQWMsR0FBRyxPQUFtQztBQUNuRCxXQUFPLGlCQUFpQjtBQUFBLEVBQ3pCO0FBQUEsRUFFZ0IsbUJBQTJCO0FBQzFDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFZ0IsWUFBb0I7QUFDbkMsV0FBTyxHQUFHLEtBQUssR0FBRyxJQUFJLEtBQUssUUFBUTtBQUFBLEVBQ3BDO0FBQUEsRUFFVSxjQUF5QjtBQUNsQyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVUsV0FBVyxRQUFvQztBQUN4RCxXQUFPLElBQUksYUFBYSxPQUFPLEtBQUssT0FBTyxTQUFTLE9BQU8sUUFBUSxPQUFPLE1BQU0sT0FBTyxZQUFZLE9BQU8sdUJBQXVCO0FBQUEsRUFDbEk7QUFDRDtBQVNPLElBQUssa0JBQUwsa0JBQUtDLHFCQUFMO0FBQ04sRUFBQUEsa0NBQUEsYUFBVSxLQUFWO0FBQ0EsRUFBQUEsa0NBQUEsY0FBVyxLQUFYO0FBRlcsU0FBQUE7QUFBQSxHQUFBO0FBQUEsQ0FLTCxDQUFVQSxxQkFBVjtBQUNDLEVBQU1BLGlCQUFBLFdBQTRCO0FBQUEsR0FEekI7QUFJVixJQUFXLG9CQUFYLGtCQUFXQyx1QkFBWDtBQUNOLEVBQUFBLHNDQUFBLFlBQVMsS0FBVDtBQUNBLEVBQUFBLHNDQUFBLFlBQVMsS0FBVDtBQUZpQixTQUFBQTtBQUFBLEdBQUE7QUFrQlgsTUFBTSxXQUFXO0FBQUEsRUFJdkIsWUFBWSxrQkFBc0M7QUFGbEQsU0FBUSxTQUE4QixvQkFBSSxJQUFJO0FBRzdDLGFBQVMsSUFBSSxHQUFHLElBQUksaUJBQWlCLFFBQVEsS0FBSztBQUNqRCxXQUFLLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxFQUFFLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Q7QUFBQSxFQUVPLFFBQVEsR0FBMkIsR0FBbUM7QUFDNUUsVUFBTSxLQUFLLEVBQUUsbUJBQW1CO0FBQ2hDLFVBQU0sS0FBSyxFQUFFLG1CQUFtQjtBQUNoQyxRQUFJLE1BQU0sSUFBSTtBQUNiLFVBQUksS0FBSyxLQUFLLE9BQU8sSUFBSSxHQUFHLElBQUksU0FBUyxDQUFDO0FBQzFDLFdBQUssT0FBTyxTQUFZLElBQUksS0FBSztBQUNqQyxVQUFJLEtBQUssS0FBSyxPQUFPLElBQUksR0FBRyxJQUFJLFNBQVMsQ0FBQztBQUMxQyxXQUFLLE9BQU8sU0FBWSxJQUFJLEtBQUs7QUFDakMsVUFBSSxPQUFPLElBQUk7QUFDZCxlQUFPLEVBQUUsT0FBTyxjQUFjLEVBQUUsTUFBTTtBQUFBLE1BQ3ZDLE9BQU87QUFDTixlQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUEsSUFDRCxXQUFXLENBQUMsTUFBTSxJQUFJO0FBQ3JCLGFBQU87QUFBQSxJQUNSLFdBQVcsTUFBTSxDQUFDLElBQUk7QUFDckIsYUFBTztBQUFBLElBQ1IsT0FBTztBQUNOLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUNEO0FBSU8sSUFBVyxjQUFYLGtCQUFXQyxpQkFBWDtBQUNOLEVBQUFBLGFBQUEsZUFBWTtBQUNaLEVBQUFBLGFBQUEsZ0JBQWE7QUFGSSxTQUFBQTtBQUFBLEdBQUE7QUFXWCxJQUFLLGdCQUFMLGtCQUFLQyxtQkFBTDtBQUVOLEVBQUFBLGVBQUEsYUFBVTtBQUdWLEVBQUFBLGVBQUEsb0JBQWlCO0FBR2pCLEVBQUFBLGVBQUEsa0JBQWU7QUFHZixFQUFBQSxlQUFBLGdCQUFhO0FBR2IsRUFBQUEsZUFBQSxXQUFRO0FBR1IsRUFBQUEsZUFBQSxtQkFBZ0I7QUFHaEIsRUFBQUEsZUFBQSxzQkFBbUI7QUFHbkIsRUFBQUEsZUFBQSxZQUFTO0FBR1QsRUFBQUEsZUFBQSxjQUFXO0FBR1gsRUFBQUEsZUFBQSxTQUFNO0FBR04sRUFBQUEsZUFBQSwyQkFBd0I7QUFHeEIsRUFBQUEsZUFBQSx5QkFBc0I7QUFHdEIsRUFBQUEsZUFBQSwrQkFBNEI7QUF0Q2pCLFNBQUFBO0FBQUEsR0FBQTtBQTRGTCxJQUFXLGdCQUFYLGtCQUFXQyxtQkFBWDtBQUNOLEVBQUFBLDhCQUFBO0FBQ0EsRUFBQUEsOEJBQUE7QUFDQSxFQUFBQSw4QkFBQTtBQUNBLEVBQUFBLDhCQUFBO0FBQ0EsRUFBQUEsOEJBQUE7QUFMaUIsU0FBQUE7QUFBQSxHQUFBO0FBUVgsSUFBVTtBQUFBLENBQVYsQ0FBVUMsZUFBVjtBQUNOLFdBQVMsT0FBTyxNQUF5QjtBQUN4QyxXQUFPO0FBQUEsTUFDTixRQUFRLEtBQUs7QUFBQSxNQUNiLFVBQVUsS0FBSyx3QkFBd0I7QUFBQSxNQUN2QyxTQUFTLEtBQUssd0JBQXdCLGVBQWUsZ0NBQXlCO0FBQUEsTUFDOUUsT0FBTyxLQUFLLHdCQUF3QjtBQUFBLE1BQ3BDLFFBQVE7QUFBQSxJQUNUO0FBQUEsRUFDRDtBQUVPLFdBQVMsTUFBTSxNQUFZLFlBQW9CLG1CQUEyRDtBQUNoSCxXQUFPO0FBQUEsTUFDTixHQUFHLE9BQU8sSUFBSTtBQUFBLE1BQ2QsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFQTyxFQUFBQSxXQUFTO0FBU1QsV0FBUyxlQUFlLE1BQVksWUFBb0IsV0FBNkM7QUFDM0csV0FBTztBQUFBLE1BQ04sR0FBRyxPQUFPLElBQUk7QUFBQSxNQUNkLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBUE8sRUFBQUEsV0FBUztBQVFULFdBQVMsYUFBYSxNQUFZLFlBQWdDLFVBQXNEO0FBQzlILFdBQU87QUFBQSxNQUNOLEdBQUcsT0FBTyxJQUFJO0FBQUEsTUFDZCxNQUFNO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQVBPLEVBQUFBLFdBQVM7QUFTVCxXQUFTLFdBQVcsTUFBWSxZQUFvQixZQUFrRTtBQUM1SCxXQUFPO0FBQUEsTUFDTixHQUFHLE9BQU8sSUFBSTtBQUFBLE1BQ2QsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFQTyxFQUFBQSxXQUFTO0FBU1QsV0FBUyxRQUFRLE1BQTRQLE1BQVksWUFBd0M7QUFDdlUsV0FBTztBQUFBLE1BQ04sR0FBRyxPQUFPLElBQUk7QUFBQSxNQUNkO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBTk8sRUFBQUEsV0FBUztBQVFULFdBQVMsVUFBNkI7QUFDNUMsV0FBTyxFQUFFLE1BQU0sd0JBQXNCO0FBQUEsRUFDdEM7QUFGTyxFQUFBQSxXQUFTO0FBQUEsR0F0REE7QUEyRFYsSUFBVTtBQUFBLENBQVYsQ0FBVUMseUJBQVY7QUFDTixXQUFTLGdCQUFnQixTQUFzQjtBQUM5QyxVQUFNLE9BQU8sT0FBTyxLQUFLLE9BQU8sRUFBRSxLQUFLO0FBQ3ZDLFFBQUksU0FBaUI7QUFDckIsZUFBVyxPQUFPLE1BQU07QUFDdkIsVUFBSSxjQUFjLFFBQVEsR0FBRztBQUM3QixVQUFJLHVCQUF1QixRQUFRO0FBQ2xDLHNCQUFjLGdCQUFnQixXQUFXO0FBQUEsTUFDMUMsV0FBVyxPQUFPLGdCQUFnQixVQUFVO0FBQzNDLHNCQUFjLFlBQVksUUFBUSxNQUFNLElBQUk7QUFBQSxNQUM3QztBQUNBLGdCQUFVLE1BQU0sTUFBTSxjQUFjO0FBQUEsSUFDckM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNPLFdBQVMsT0FBTyxPQUE2QztBQUNuRSxVQUFNLFlBQVksZ0JBQWdCLEtBQUs7QUFDdkMsVUFBTSxTQUFTLEVBQUUsTUFBTSxXQUFXLE1BQU0sTUFBTSxTQUFTO0FBQ3ZELFdBQU8sT0FBTyxRQUFRLEtBQUs7QUFDM0IsV0FBTztBQUFBLEVBQ1I7QUFMTyxFQUFBQSxxQkFBUztBQUFBLEdBZkE7QUF1QlYsSUFBVyxnQkFBWCxrQkFBV0MsbUJBQVg7QUFDTixFQUFBQSxlQUFBLGdCQUFhO0FBQ2IsRUFBQUEsZUFBQSxtQkFBZ0I7QUFDaEIsRUFBQUEsZUFBQSxxQkFBa0I7QUFDbEIsRUFBQUEsZUFBQSxnQ0FBNkI7QUFDN0IsRUFBQUEsZUFBQSx5QkFBc0I7QUFDdEIsRUFBQUEsZUFBQSxzQkFBbUI7QUFDbkIsRUFBQUEsZUFBQSxxQkFBa0I7QUFDbEIsRUFBQUEsZUFBQSxtQkFBZ0I7QUFDaEIsRUFBQUEsZUFBQSxzQkFBbUI7QUFDbkIsRUFBQUEsZUFBQSx5QkFBc0I7QUFDdEIsRUFBQUEsZUFBQSxrQkFBZTtBQUNmLEVBQUFBLGVBQUEsb0JBQWlCO0FBWkEsU0FBQUE7QUFBQSxHQUFBO0FBZVgsSUFBVyx3QkFBWCxrQkFBV0MsMkJBQVg7QUFDTixFQUFBQSx1QkFBQSxXQUFRO0FBQ1IsRUFBQUEsdUJBQUEsc0JBQW1CO0FBQ25CLEVBQUFBLHVCQUFBLGFBQVU7QUFDVixFQUFBQSx1QkFBQSxTQUFNO0FBQ04sRUFBQUEsdUJBQUEsV0FBUTtBQUNSLEVBQUFBLHVCQUFBLGdCQUFhO0FBQ2IsRUFBQUEsdUJBQUEsb0JBQWlCO0FBQ2pCLEVBQUFBLHVCQUFBLHdCQUFxQjtBQVJKLFNBQUFBO0FBQUEsR0FBQTtBQVdYLElBQVU7QUFBQSxDQUFWLENBQVVDLG9CQUFWO0FBQ0MsV0FBUyxxQkFBcUIsVUFBMkIsVUFBNkU7QUFDNUksVUFBTSxhQUFhLHVCQUF1QixJQUFJLFNBQVMsSUFBSTtBQUMzRCxRQUFJLGVBQWUsUUFBVztBQUU3QixZQUFNLE9BQU8sUUFBUSxVQUFVLFFBQVE7QUFDdkMsYUFBTyxLQUFLO0FBQ1osYUFBTyxvQkFBb0IsT0FBTyxJQUFJO0FBQUEsSUFDdkM7QUFFQSxVQUFNLFVBQWdELHVCQUFPLE9BQU8sSUFBSTtBQUN4RSxZQUFRLE9BQU8sV0FBVztBQUMxQixVQUFNLFdBQXdCLG9CQUFJLElBQUk7QUFDdEMsZUFBVyxTQUFTLFFBQVEsYUFBVyxTQUFTLElBQUksT0FBTyxDQUFDO0FBRTVELFVBQU0sYUFBYSxXQUFXO0FBQzlCLGVBQVcsWUFBWSxPQUFPLEtBQUssVUFBVSxHQUFHO0FBQy9DLFlBQU0sUUFBUSxTQUFTLFFBQVE7QUFDL0IsVUFBSSxVQUFVLFVBQWEsVUFBVSxNQUFNO0FBQzFDLGdCQUFRLFFBQVEsSUFBSTtBQUFBLE1BQ3JCLFdBQVcsU0FBUyxJQUFJLFFBQVEsR0FBRztBQUNsQyxjQUFNLFNBQVMsV0FBVyxRQUFRO0FBQ2xDLFlBQUksT0FBTyxZQUFZLFFBQVc7QUFDakMsa0JBQVEsUUFBUSxJQUFJLFFBQVEsVUFBVSxPQUFPLE9BQU87QUFBQSxRQUNyRCxPQUFPO0FBQ04sa0JBQVEsT0FBTyxNQUFNO0FBQUEsWUFDcEIsS0FBSztBQUNKLHNCQUFRLFFBQVEsSUFBSTtBQUNwQjtBQUFBLFlBQ0QsS0FBSztBQUFBLFlBQ0wsS0FBSztBQUNKLHNCQUFRLFFBQVEsSUFBSTtBQUNwQjtBQUFBLFlBQ0QsS0FBSztBQUNKLHNCQUFRLFFBQVEsSUFBSTtBQUNwQjtBQUFBLFlBQ0Q7QUFDQyx1QkFBUyxNQUFNLElBQUk7QUFBQSxnQkFDbEI7QUFBQSxnQkFDQTtBQUFBLGdCQUFxSCxLQUFLLFVBQVUsVUFBVSxRQUFXLENBQUM7QUFBQSxnQkFBRztBQUFBLGNBQzlKLENBQUM7QUFDRCxxQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxXQUFPLG9CQUFvQixPQUFPLE9BQU87QUFBQSxFQUMxQztBQTlDTyxFQUFBQSxnQkFBUztBQUFBLEdBREE7IiwKICAibmFtZXMiOiBbIlNoZWxsUXVvdGluZyIsICJDb21tYW5kT3B0aW9ucyIsICJSZXZlYWxLaW5kIiwgIlJldmVhbFByb2JsZW1LaW5kIiwgIlBhbmVsS2luZCIsICJQcmVzZW50YXRpb25PcHRpb25zIiwgIlJ1bnRpbWVUeXBlIiwgIkNvbW1hbmRTdHJpbmciLCAidmFsdWUiLCAiVGFza0dyb3VwIiwgIlRhc2tTY29wZSIsICJUYXNrU291cmNlS2luZCIsICJEZXBlbmRzT3JkZXIiLCAiUnVuT25PcHRpb25zIiwgIlJ1bk9wdGlvbnMiLCAiRXhlY3V0aW9uRW5naW5lIiwgIkpzb25TY2hlbWFWZXJzaW9uIiwgIlRhc2tSdW5UeXBlIiwgIlRhc2tFdmVudEtpbmQiLCAiVGFza1J1blNvdXJjZSIsICJUYXNrRXZlbnQiLCAiS2V5ZWRUYXNrSWRlbnRpZmllciIsICJUYXNrU2V0dGluZ0lkIiwgIlRhc2tzU2NoZW1hUHJvcGVydGllcyIsICJUYXNrRGVmaW5pdGlvbiJdCn0K
