import * as nls from "../../../../nls.js";
import * as Objects from "../../../../base/common/objects.js";
import { Platform } from "../../../../base/common/platform.js";
import * as Types from "../../../../base/common/types.js";
import * as UUID from "../../../../base/common/uuid.js";
import {
  ProblemMatcherParser,
  isNamedProblemMatcher,
  ProblemMatcherRegistry
} from "./problemMatcher.js";
import * as Tasks from "./tasks.js";
import { TaskDefinitionRegistry } from "./taskDefinitionRegistry.js";
import { ShellExecutionSupportedContext, ProcessExecutionSupportedContext } from "./taskService.js";
var ShellQuoting = /* @__PURE__ */ ((ShellQuoting2) => {
  ShellQuoting2[ShellQuoting2["escape"] = 1] = "escape";
  ShellQuoting2[ShellQuoting2["strong"] = 2] = "strong";
  ShellQuoting2[ShellQuoting2["weak"] = 3] = "weak";
  return ShellQuoting2;
})(ShellQuoting || {});
var ITaskIdentifier;
((ITaskIdentifier2) => {
  function is(value) {
    const candidate = value;
    return candidate !== void 0 && Types.isString(value.type);
  }
  ITaskIdentifier2.is = is;
})(ITaskIdentifier || (ITaskIdentifier = {}));
var CommandString;
((CommandString2) => {
  function value(value2) {
    if (Types.isString(value2)) {
      return value2;
    } else if (Types.isStringArray(value2)) {
      return value2.join(" ");
    } else {
      if (Types.isString(value2.value)) {
        return value2.value;
      } else {
        return value2.value.join(" ");
      }
    }
  }
  CommandString2.value = value;
})(CommandString || (CommandString = {}));
var ProblemMatcherKind = /* @__PURE__ */ ((ProblemMatcherKind2) => {
  ProblemMatcherKind2[ProblemMatcherKind2["Unknown"] = 0] = "Unknown";
  ProblemMatcherKind2[ProblemMatcherKind2["String"] = 1] = "String";
  ProblemMatcherKind2[ProblemMatcherKind2["ProblemMatcher"] = 2] = "ProblemMatcher";
  ProblemMatcherKind2[ProblemMatcherKind2["Array"] = 3] = "Array";
  return ProblemMatcherKind2;
})(ProblemMatcherKind || {});
const EMPTY_ARRAY = [];
Object.freeze(EMPTY_ARRAY);
function assignProperty(target, source, key) {
  const sourceAtKey = source[key];
  if (sourceAtKey !== void 0) {
    target[key] = sourceAtKey;
  }
}
function fillProperty(target, source, key) {
  const sourceAtKey = source[key];
  if (target[key] === void 0 && sourceAtKey !== void 0) {
    target[key] = sourceAtKey;
  }
}
function _isEmpty(value, properties, allowEmptyArray = false) {
  if (value === void 0 || value === null || properties === void 0) {
    return true;
  }
  for (const meta of properties) {
    const property = value[meta.property];
    if (property !== void 0 && property !== null) {
      if (meta.type !== void 0 && !meta.type.isEmpty(property)) {
        return false;
      } else if (!Array.isArray(property) || property.length > 0 || allowEmptyArray) {
        return false;
      }
    }
  }
  return true;
}
function _assignProperties(target, source, properties) {
  if (!source || _isEmpty(source, properties)) {
    return target;
  }
  if (!target || _isEmpty(target, properties)) {
    return source;
  }
  for (const meta of properties) {
    const property = meta.property;
    let value;
    if (meta.type !== void 0) {
      value = meta.type.assignProperties(target[property], source[property]);
    } else {
      value = source[property];
    }
    if (value !== void 0 && value !== null) {
      target[property] = value;
    }
  }
  return target;
}
function _fillProperties(target, source, properties, allowEmptyArray = false) {
  if (!source || _isEmpty(source, properties)) {
    return target;
  }
  if (!target || _isEmpty(target, properties, allowEmptyArray)) {
    return source;
  }
  for (const meta of properties) {
    const property = meta.property;
    let value;
    if (meta.type) {
      value = meta.type.fillProperties(target[property], source[property]);
    } else if (target[property] === void 0) {
      value = source[property];
    }
    if (value !== void 0 && value !== null) {
      target[property] = value;
    }
  }
  return target;
}
function _fillDefaults(target, defaults, properties, context) {
  if (target && Object.isFrozen(target)) {
    return target;
  }
  if (target === void 0 || target === null || defaults === void 0 || defaults === null) {
    if (defaults !== void 0 && defaults !== null) {
      return Objects.deepClone(defaults);
    } else {
      return void 0;
    }
  }
  for (const meta of properties) {
    const property = meta.property;
    if (target[property] !== void 0) {
      continue;
    }
    let value;
    if (meta.type) {
      value = meta.type.fillDefaults(target[property], context);
    } else {
      value = defaults[property];
    }
    if (value !== void 0 && value !== null) {
      target[property] = value;
    }
  }
  return target;
}
function _freeze(target, properties) {
  if (target === void 0 || target === null) {
    return void 0;
  }
  if (Object.isFrozen(target)) {
    return target;
  }
  for (const meta of properties) {
    if (meta.type) {
      const value = target[meta.property];
      if (value) {
        meta.type.freeze(value);
      }
    }
  }
  Object.freeze(target);
  return target;
}
var RunOnOptions;
((RunOnOptions2) => {
  function fromString(value) {
    if (!value) {
      return Tasks.RunOnOptions.default;
    }
    switch (value.toLowerCase()) {
      case "folderopen":
        return Tasks.RunOnOptions.folderOpen;
      case "default":
      default:
        return Tasks.RunOnOptions.default;
    }
  }
  RunOnOptions2.fromString = fromString;
})(RunOnOptions || (RunOnOptions = {}));
var RunOptions;
((RunOptions2) => {
  const properties = [{ property: "reevaluateOnRerun" }, { property: "runOn" }, { property: "instanceLimit" }];
  function fromConfiguration(value) {
    return {
      reevaluateOnRerun: value ? value.reevaluateOnRerun : true,
      runOn: value ? RunOnOptions.fromString(value.runOn) : Tasks.RunOnOptions.default,
      instanceLimit: value ? value.instanceLimit : 1
    };
  }
  RunOptions2.fromConfiguration = fromConfiguration;
  function assignProperties(target, source) {
    return _assignProperties(target, source, properties);
  }
  RunOptions2.assignProperties = assignProperties;
  function fillProperties(target, source) {
    return _fillProperties(target, source, properties);
  }
  RunOptions2.fillProperties = fillProperties;
})(RunOptions || (RunOptions = {}));
var ShellConfiguration;
((ShellConfiguration2) => {
  const properties = [{ property: "executable" }, { property: "args" }, { property: "quoting" }];
  function is(value) {
    const candidate = value;
    return candidate && (Types.isString(candidate.executable) || Types.isStringArray(candidate.args));
  }
  ShellConfiguration2.is = is;
  function from(config, context) {
    if (!is(config)) {
      return void 0;
    }
    const result = {};
    if (config.executable !== void 0) {
      result.executable = config.executable;
    }
    if (config.args !== void 0) {
      result.args = config.args.slice();
    }
    if (config.quoting !== void 0) {
      result.quoting = Objects.deepClone(config.quoting);
    }
    return result;
  }
  ShellConfiguration2.from = from;
  function isEmpty(value) {
    return _isEmpty(value, properties, true);
  }
  ShellConfiguration2.isEmpty = isEmpty;
  function assignProperties(target, source) {
    return _assignProperties(target, source, properties);
  }
  ShellConfiguration2.assignProperties = assignProperties;
  function fillProperties(target, source) {
    return _fillProperties(target, source, properties, true);
  }
  ShellConfiguration2.fillProperties = fillProperties;
  function fillDefaults(value, context) {
    return value;
  }
  ShellConfiguration2.fillDefaults = fillDefaults;
  function freeze(value) {
    if (!value) {
      return void 0;
    }
    return Object.freeze(value);
  }
  ShellConfiguration2.freeze = freeze;
})(ShellConfiguration || (ShellConfiguration = {}));
var CommandOptions;
((CommandOptions2) => {
  const properties = [{ property: "cwd" }, { property: "env" }, { property: "shell", type: ShellConfiguration }];
  const defaults = { cwd: "${workspaceFolder}" };
  function from(options, context) {
    const result = {};
    if (options.cwd !== void 0) {
      if (Types.isString(options.cwd)) {
        result.cwd = options.cwd;
      } else {
        context.taskLoadIssues.push(nls.localize("ConfigurationParser.invalidCWD", "Warning: options.cwd must be of type string. Ignoring value {0}\n", options.cwd));
      }
    }
    if (options.env !== void 0) {
      result.env = Objects.deepClone(options.env);
    }
    result.shell = ShellConfiguration.from(options.shell, context);
    return isEmpty(result) ? void 0 : result;
  }
  CommandOptions2.from = from;
  function isEmpty(value) {
    return _isEmpty(value, properties);
  }
  CommandOptions2.isEmpty = isEmpty;
  function assignProperties(target, source) {
    if (source === void 0 || isEmpty(source)) {
      return target;
    }
    if (target === void 0 || isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, "cwd");
    if (target.env === void 0) {
      target.env = source.env;
    } else if (source.env !== void 0) {
      const env = /* @__PURE__ */ Object.create(null);
      if (target.env !== void 0) {
        Object.keys(target.env).forEach((key) => env[key] = target.env[key]);
      }
      if (source.env !== void 0) {
        Object.keys(source.env).forEach((key) => env[key] = source.env[key]);
      }
      target.env = env;
    }
    target.shell = ShellConfiguration.assignProperties(target.shell, source.shell);
    return target;
  }
  CommandOptions2.assignProperties = assignProperties;
  function fillProperties(target, source) {
    return _fillProperties(target, source, properties);
  }
  CommandOptions2.fillProperties = fillProperties;
  function fillDefaults(value, context) {
    return _fillDefaults(value, defaults, properties, context);
  }
  CommandOptions2.fillDefaults = fillDefaults;
  function freeze(value) {
    return _freeze(value, properties);
  }
  CommandOptions2.freeze = freeze;
})(CommandOptions || (CommandOptions = {}));
var CommandConfiguration;
((CommandConfiguration2) => {
  let PresentationOptions;
  ((PresentationOptions2) => {
    const properties2 = [{ property: "echo" }, { property: "reveal" }, { property: "revealProblems" }, { property: "focus" }, { property: "panel" }, { property: "showReuseMessage" }, { property: "clear" }, { property: "group" }, { property: "close" }];
    function from2(config, context) {
      let echo;
      let reveal;
      let revealProblems;
      let focus;
      let panel;
      let showReuseMessage;
      let clear;
      let group;
      let close;
      let hasProps = false;
      if (Types.isBoolean(config.echoCommand)) {
        echo = config.echoCommand;
        hasProps = true;
      }
      if (Types.isString(config.showOutput)) {
        reveal = Tasks.RevealKind.fromString(config.showOutput);
        hasProps = true;
      }
      const presentation = config.presentation || config.terminal;
      if (presentation) {
        if (Types.isBoolean(presentation.echo)) {
          echo = presentation.echo;
        }
        if (Types.isString(presentation.reveal)) {
          reveal = Tasks.RevealKind.fromString(presentation.reveal);
        }
        if (Types.isString(presentation.revealProblems)) {
          revealProblems = Tasks.RevealProblemKind.fromString(presentation.revealProblems);
        }
        if (Types.isBoolean(presentation.focus)) {
          focus = presentation.focus;
        }
        if (Types.isString(presentation.panel)) {
          panel = Tasks.PanelKind.fromString(presentation.panel);
        }
        if (Types.isBoolean(presentation.showReuseMessage)) {
          showReuseMessage = presentation.showReuseMessage;
        }
        if (Types.isBoolean(presentation.clear)) {
          clear = presentation.clear;
        }
        if (Types.isString(presentation.group)) {
          group = presentation.group;
        }
        if (Types.isBoolean(presentation.close)) {
          close = presentation.close;
        }
        hasProps = true;
      }
      if (!hasProps) {
        return void 0;
      }
      return { echo, reveal, revealProblems, focus, panel, showReuseMessage, clear, group, close };
    }
    PresentationOptions2.from = from2;
    function assignProperties2(target, source) {
      return _assignProperties(target, source, properties2);
    }
    PresentationOptions2.assignProperties = assignProperties2;
    function fillProperties2(target, source) {
      return _fillProperties(target, source, properties2);
    }
    PresentationOptions2.fillProperties = fillProperties2;
    function fillDefaults2(value, context) {
      const defaultEcho = context.engine === Tasks.ExecutionEngine.Terminal ? true : false;
      return _fillDefaults(value, { echo: defaultEcho, reveal: Tasks.RevealKind.Always, revealProblems: Tasks.RevealProblemKind.Never, focus: false, panel: Tasks.PanelKind.Shared, showReuseMessage: true, clear: false }, properties2, context);
    }
    PresentationOptions2.fillDefaults = fillDefaults2;
    function freeze2(value) {
      return _freeze(value, properties2);
    }
    PresentationOptions2.freeze = freeze2;
    function isEmpty2(value) {
      return _isEmpty(value, properties2);
    }
    PresentationOptions2.isEmpty = isEmpty2;
  })(PresentationOptions = CommandConfiguration2.PresentationOptions || (CommandConfiguration2.PresentationOptions = {}));
  let ShellString;
  ((ShellString2) => {
    function from2(value) {
      if (value === void 0 || value === null) {
        return void 0;
      }
      if (Types.isString(value)) {
        return value;
      } else if (Types.isStringArray(value)) {
        return value.join(" ");
      } else {
        const quoting = Tasks.ShellQuoting.from(value.quoting);
        const result = Types.isString(value.value) ? value.value : Types.isStringArray(value.value) ? value.value.join(" ") : void 0;
        if (result) {
          return {
            value: result,
            quoting
          };
        } else {
          return void 0;
        }
      }
    }
    ShellString2.from = from2;
  })(ShellString || (ShellString = {}));
  const properties = [
    { property: "runtime" },
    { property: "name" },
    { property: "options", type: CommandOptions },
    { property: "args" },
    { property: "taskSelector" },
    { property: "suppressTaskName" },
    { property: "presentation", type: PresentationOptions }
  ];
  function from(config, context) {
    let result = fromBase(config, context);
    let osConfig = void 0;
    if (config.windows && context.platform === Platform.Windows) {
      osConfig = fromBase(config.windows, context);
    } else if (config.osx && context.platform === Platform.Mac) {
      osConfig = fromBase(config.osx, context);
    } else if (config.linux && context.platform === Platform.Linux) {
      osConfig = fromBase(config.linux, context);
    }
    if (osConfig) {
      result = assignProperties(result, osConfig, context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0);
    }
    return isEmpty(result) ? void 0 : result;
  }
  CommandConfiguration2.from = from;
  function fromBase(config, context) {
    const name = ShellString.from(config.command);
    let runtime;
    if (Types.isString(config.type)) {
      if (config.type === "shell" || config.type === "process") {
        runtime = Tasks.RuntimeType.fromString(config.type);
      }
    }
    if (Types.isBoolean(config.isShellCommand) || ShellConfiguration.is(config.isShellCommand)) {
      runtime = Tasks.RuntimeType.Shell;
    } else if (config.isShellCommand !== void 0) {
      runtime = !!config.isShellCommand ? Tasks.RuntimeType.Shell : Tasks.RuntimeType.Process;
    }
    const result = {
      name,
      runtime,
      presentation: PresentationOptions.from(config, context)
    };
    if (config.args !== void 0) {
      result.args = [];
      for (const arg of config.args) {
        const converted = ShellString.from(arg);
        if (converted !== void 0) {
          result.args.push(converted);
        } else {
          context.taskLoadIssues.push(
            nls.localize(
              "ConfigurationParser.inValidArg",
              "Error: command argument must either be a string or a quoted string. Provided value is:\n{0}",
              arg ? JSON.stringify(arg, void 0, 4) : "undefined"
            )
          );
        }
      }
    }
    if (config.options !== void 0) {
      result.options = CommandOptions.from(config.options, context);
      if (result.options && result.options.shell === void 0 && ShellConfiguration.is(config.isShellCommand)) {
        result.options.shell = ShellConfiguration.from(config.isShellCommand, context);
        if (context.engine !== Tasks.ExecutionEngine.Terminal) {
          context.taskLoadIssues.push(nls.localize("ConfigurationParser.noShell", "Warning: shell configuration is only supported when executing tasks in the terminal."));
        }
      }
    }
    if (Types.isString(config.taskSelector)) {
      result.taskSelector = config.taskSelector;
    }
    if (Types.isBoolean(config.suppressTaskName)) {
      result.suppressTaskName = config.suppressTaskName;
    }
    return isEmpty(result) ? void 0 : result;
  }
  function hasCommand(value) {
    return value && !!value.name;
  }
  CommandConfiguration2.hasCommand = hasCommand;
  function isEmpty(value) {
    return _isEmpty(value, properties);
  }
  CommandConfiguration2.isEmpty = isEmpty;
  function assignProperties(target, source, overwriteArgs) {
    if (isEmpty(source)) {
      return target;
    }
    if (isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, "name");
    assignProperty(target, source, "runtime");
    assignProperty(target, source, "taskSelector");
    assignProperty(target, source, "suppressTaskName");
    if (source.args !== void 0) {
      if (target.args === void 0 || overwriteArgs) {
        target.args = source.args;
      } else {
        target.args = target.args.concat(source.args);
      }
    }
    target.presentation = PresentationOptions.assignProperties(target.presentation, source.presentation);
    target.options = CommandOptions.assignProperties(target.options, source.options);
    return target;
  }
  CommandConfiguration2.assignProperties = assignProperties;
  function fillProperties(target, source) {
    return _fillProperties(target, source, properties);
  }
  CommandConfiguration2.fillProperties = fillProperties;
  function fillGlobals(target, source, taskName) {
    if (source === void 0 || isEmpty(source)) {
      return target;
    }
    target = target || {
      name: void 0,
      runtime: void 0,
      presentation: void 0
    };
    if (target.name === void 0) {
      fillProperty(target, source, "name");
      fillProperty(target, source, "taskSelector");
      fillProperty(target, source, "suppressTaskName");
      let args = source.args ? source.args.slice() : [];
      if (!target.suppressTaskName && taskName) {
        if (target.taskSelector !== void 0) {
          args.push(target.taskSelector + taskName);
        } else {
          args.push(taskName);
        }
      }
      if (target.args) {
        args = args.concat(target.args);
      }
      target.args = args;
    }
    fillProperty(target, source, "runtime");
    target.presentation = PresentationOptions.fillProperties(target.presentation, source.presentation);
    target.options = CommandOptions.fillProperties(target.options, source.options);
    return target;
  }
  CommandConfiguration2.fillGlobals = fillGlobals;
  function fillDefaults(value, context) {
    if (!value || Object.isFrozen(value)) {
      return;
    }
    if (value.name !== void 0 && value.runtime === void 0) {
      value.runtime = Tasks.RuntimeType.Process;
    }
    value.presentation = PresentationOptions.fillDefaults(value.presentation, context);
    if (!isEmpty(value)) {
      value.options = CommandOptions.fillDefaults(value.options, context);
    }
    if (value.args === void 0) {
      value.args = EMPTY_ARRAY;
    }
    if (value.suppressTaskName === void 0) {
      value.suppressTaskName = context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0;
    }
  }
  CommandConfiguration2.fillDefaults = fillDefaults;
  function freeze(value) {
    return _freeze(value, properties);
  }
  CommandConfiguration2.freeze = freeze;
})(CommandConfiguration || (CommandConfiguration = {}));
var ProblemMatcherConverter;
((ProblemMatcherConverter2) => {
  function namedFrom(declares, context) {
    const result = /* @__PURE__ */ Object.create(null);
    if (!Array.isArray(declares)) {
      return result;
    }
    declares.forEach((value) => {
      const namedProblemMatcher = new ProblemMatcherParser(context.problemReporter).parse(value);
      if (isNamedProblemMatcher(namedProblemMatcher)) {
        result[namedProblemMatcher.name] = namedProblemMatcher;
      } else {
        context.problemReporter.error(nls.localize("ConfigurationParser.noName", "Error: Problem Matcher in declare scope must have a name:\n{0}\n", JSON.stringify(value, void 0, 4)));
      }
    });
    return result;
  }
  ProblemMatcherConverter2.namedFrom = namedFrom;
  function fromWithOsConfig(external, context) {
    let result = {};
    if (external.windows && external.windows.problemMatcher && context.platform === Platform.Windows) {
      result = from(external.windows.problemMatcher, context);
    } else if (external.osx && external.osx.problemMatcher && context.platform === Platform.Mac) {
      result = from(external.osx.problemMatcher, context);
    } else if (external.linux && external.linux.problemMatcher && context.platform === Platform.Linux) {
      result = from(external.linux.problemMatcher, context);
    } else if (external.problemMatcher) {
      result = from(external.problemMatcher, context);
    }
    return result;
  }
  ProblemMatcherConverter2.fromWithOsConfig = fromWithOsConfig;
  function from(config, context) {
    const result = [];
    if (config === void 0) {
      return { value: result };
    }
    const errors = [];
    function addResult(matcher) {
      if (matcher.value) {
        result.push(matcher.value);
      }
      if (matcher.errors) {
        errors.push(...matcher.errors);
      }
    }
    const kind = getProblemMatcherKind(config);
    if (kind === 0 /* Unknown */) {
      const error = nls.localize(
        "ConfigurationParser.unknownMatcherKind",
        "Warning: the defined problem matcher is unknown. Supported types are string | ProblemMatcher | Array<string | ProblemMatcher>.\n{0}\n",
        JSON.stringify(config, null, 4)
      );
      context.problemReporter.warn(error);
    } else if (kind === 1 /* String */ || kind === 2 /* ProblemMatcher */) {
      addResult(resolveProblemMatcher(config, context));
    } else if (kind === 3 /* Array */) {
      const problemMatchers = config;
      problemMatchers.forEach((problemMatcher) => {
        addResult(resolveProblemMatcher(problemMatcher, context));
      });
    }
    return { value: result, errors };
  }
  ProblemMatcherConverter2.from = from;
  function getProblemMatcherKind(value) {
    if (Types.isString(value)) {
      return 1 /* String */;
    } else if (Array.isArray(value)) {
      return 3 /* Array */;
    } else if (!Types.isUndefined(value)) {
      return 2 /* ProblemMatcher */;
    } else {
      return 0 /* Unknown */;
    }
  }
  function resolveProblemMatcher(value, context) {
    if (Types.isString(value)) {
      let variableName = value;
      if (variableName.length > 1 && variableName[0] === "$") {
        variableName = variableName.substring(1);
        const global = ProblemMatcherRegistry.get(variableName);
        if (global) {
          return { value: Objects.deepClone(global) };
        }
        let localProblemMatcher = context.namedProblemMatchers[variableName];
        if (localProblemMatcher) {
          localProblemMatcher = Objects.deepClone(localProblemMatcher);
          delete localProblemMatcher.name;
          return { value: localProblemMatcher };
        }
      }
      return { errors: [nls.localize("ConfigurationParser.invalidVariableReference", "Error: Invalid problemMatcher reference: {0}\n", value)] };
    } else {
      const json = value;
      return { value: new ProblemMatcherParser(context.problemReporter).parse(json) };
    }
  }
})(ProblemMatcherConverter || (ProblemMatcherConverter = {}));
var GroupKind;
((GroupKind2) => {
  function from(external) {
    if (external === void 0) {
      return void 0;
    } else if (Types.isString(external) && Tasks.TaskGroup.is(external)) {
      return { _id: external, isDefault: false };
    } else if (Types.isString(external.kind) && Tasks.TaskGroup.is(external.kind)) {
      const group = external.kind;
      const isDefault = Types.isUndefined(external.isDefault) ? false : external.isDefault;
      return { _id: group, isDefault };
    }
    return void 0;
  }
  GroupKind2.from = from;
  function to(group) {
    if (Types.isString(group)) {
      return group;
    } else if (!group.isDefault) {
      return group._id;
    }
    return {
      kind: group._id,
      isDefault: group.isDefault
    };
  }
  GroupKind2.to = to;
})(GroupKind || (GroupKind = {}));
var TaskDependency;
((TaskDependency2) => {
  function uriFromSource(context, source) {
    switch (source) {
      case 2 /* User */:
        return Tasks.USER_TASKS_GROUP_KEY;
      case 0 /* TasksJson */:
        return context.workspaceFolder.uri;
      default:
        return context.workspace && context.workspace.configuration ? context.workspace.configuration : context.workspaceFolder.uri;
    }
  }
  function from(external, context, source) {
    if (Types.isString(external)) {
      return { uri: uriFromSource(context, source), task: external };
    } else if (ITaskIdentifier.is(external)) {
      return {
        uri: uriFromSource(context, source),
        task: Tasks.TaskDefinition.createTaskIdentifier(external, context.problemReporter)
      };
    } else {
      return void 0;
    }
  }
  TaskDependency2.from = from;
})(TaskDependency || (TaskDependency = {}));
var DependsOrder;
((DependsOrder2) => {
  function from(order) {
    switch (order) {
      case Tasks.DependsOrder.sequence:
        return Tasks.DependsOrder.sequence;
      case Tasks.DependsOrder.parallel:
      default:
        return Tasks.DependsOrder.parallel;
    }
  }
  DependsOrder2.from = from;
})(DependsOrder || (DependsOrder = {}));
var ConfigurationProperties;
((ConfigurationProperties2) => {
  const properties = [
    { property: "name" },
    { property: "identifier" },
    { property: "group" },
    { property: "isBackground" },
    { property: "promptOnClose" },
    { property: "dependsOn" },
    { property: "presentation", type: CommandConfiguration.PresentationOptions },
    { property: "problemMatchers" },
    { property: "options" },
    { property: "icon" },
    { property: "hide" }
  ];
  function from(external, context, includeCommandOptions, source, properties2) {
    if (!external) {
      return {};
    }
    const result = {};
    if (properties2) {
      for (const propertyName of Object.keys(properties2)) {
        if (external[propertyName] !== void 0) {
          result[propertyName] = Objects.deepClone(external[propertyName]);
        }
      }
    }
    if (Types.isString(external.taskName)) {
      result.name = external.taskName;
    }
    if (Types.isString(external.label) && context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0) {
      result.name = external.label;
    }
    if (Types.isString(external.identifier)) {
      result.identifier = external.identifier;
    }
    result.icon = external.icon;
    result.hide = external.hide;
    if (external.isBackground !== void 0) {
      result.isBackground = !!external.isBackground;
    }
    if (external.promptOnClose !== void 0) {
      result.promptOnClose = !!external.promptOnClose;
    }
    result.group = GroupKind.from(external.group);
    if (external.dependsOn !== void 0) {
      if (Array.isArray(external.dependsOn)) {
        result.dependsOn = external.dependsOn.reduce((dependencies, item) => {
          const dependency = TaskDependency.from(item, context, source);
          if (dependency) {
            dependencies.push(dependency);
          }
          return dependencies;
        }, []);
      } else {
        const dependsOnValue = TaskDependency.from(external.dependsOn, context, source);
        result.dependsOn = dependsOnValue ? [dependsOnValue] : void 0;
      }
    }
    result.dependsOrder = DependsOrder.from(external.dependsOrder);
    if (includeCommandOptions && (external.presentation !== void 0 || external.terminal !== void 0)) {
      result.presentation = CommandConfiguration.PresentationOptions.from(external, context);
    }
    if (includeCommandOptions && external.options !== void 0) {
      result.options = CommandOptions.from(external.options, context);
    }
    const configProblemMatcher = ProblemMatcherConverter.fromWithOsConfig(external, context);
    if (configProblemMatcher.value !== void 0) {
      result.problemMatchers = configProblemMatcher.value;
    }
    if (external.detail) {
      result.detail = external.detail;
    }
    return isEmpty(result) ? {} : { value: result, errors: configProblemMatcher.errors };
  }
  ConfigurationProperties2.from = from;
  function isEmpty(value) {
    return _isEmpty(value, properties);
  }
  ConfigurationProperties2.isEmpty = isEmpty;
})(ConfigurationProperties || (ConfigurationProperties = {}));
const label = "Workspace";
var ConfiguringTask;
((ConfiguringTask2) => {
  const grunt = "grunt.";
  const jake = "jake.";
  const gulp = "gulp.";
  const npm = "vscode.npm.";
  const typescript = "vscode.typescript.";
  function from(external, context, index, source, registry) {
    if (!external) {
      return void 0;
    }
    const type = external.type;
    const customize = external.customize;
    if (!type && !customize) {
      context.problemReporter.error(nls.localize("ConfigurationParser.noTaskType", "Error: tasks configuration must have a type property. The configuration will be ignored.\n{0}\n", JSON.stringify(external, null, 4)));
      return void 0;
    }
    const typeDeclaration = type ? registry?.get?.(type) || TaskDefinitionRegistry.get(type) : void 0;
    if (!typeDeclaration) {
      const message = nls.localize("ConfigurationParser.noTypeDefinition", "Error: there is no registered task type '{0}'. Did you miss installing an extension that provides a corresponding task provider?", type);
      context.problemReporter.error(message);
      return void 0;
    }
    let identifier;
    if (Types.isString(customize)) {
      if (customize.indexOf(grunt) === 0) {
        identifier = { type: "grunt", task: customize.substring(grunt.length) };
      } else if (customize.indexOf(jake) === 0) {
        identifier = { type: "jake", task: customize.substring(jake.length) };
      } else if (customize.indexOf(gulp) === 0) {
        identifier = { type: "gulp", task: customize.substring(gulp.length) };
      } else if (customize.indexOf(npm) === 0) {
        identifier = { type: "npm", script: customize.substring(npm.length + 4) };
      } else if (customize.indexOf(typescript) === 0) {
        identifier = { type: "typescript", tsconfig: customize.substring(typescript.length + 6) };
      }
    } else {
      if (Types.isString(external.type)) {
        identifier = external;
      }
    }
    if (identifier === void 0) {
      context.problemReporter.error(nls.localize(
        "ConfigurationParser.missingType",
        "Error: the task configuration '{0}' is missing the required property 'type'. The task configuration will be ignored.",
        JSON.stringify(external, void 0, 0)
      ));
      return void 0;
    }
    const taskIdentifier = Tasks.TaskDefinition.createTaskIdentifier(identifier, context.problemReporter);
    if (taskIdentifier === void 0) {
      context.problemReporter.error(nls.localize(
        "ConfigurationParser.incorrectType",
        "Error: the task configuration '{0}' is using an unknown type. The task configuration will be ignored.",
        JSON.stringify(external, void 0, 0)
      ));
      return void 0;
    }
    const configElement = {
      workspaceFolder: context.workspaceFolder,
      file: ".vscode/tasks.json",
      index,
      element: external
    };
    let taskSource;
    switch (source) {
      case 2 /* User */: {
        taskSource = { kind: Tasks.TaskSourceKind.User, config: configElement, label };
        break;
      }
      case 1 /* WorkspaceFile */: {
        taskSource = { kind: Tasks.TaskSourceKind.WorkspaceFile, config: configElement, label };
        break;
      }
      default: {
        taskSource = { kind: Tasks.TaskSourceKind.Workspace, config: configElement, label };
        break;
      }
    }
    const result = new Tasks.ConfiguringTask(
      `${typeDeclaration.extensionId}.${taskIdentifier._key}`,
      taskSource,
      void 0,
      type,
      taskIdentifier,
      RunOptions.fromConfiguration(external.runOptions),
      { hide: external.hide }
    );
    const configuration = ConfigurationProperties.from(external, context, true, source, typeDeclaration.properties);
    result.addTaskLoadMessages(configuration.errors);
    if (configuration.value) {
      result.configurationProperties = Object.assign(result.configurationProperties, configuration.value);
      if (result.configurationProperties.name) {
        result._label = result.configurationProperties.name;
      } else {
        let label2 = result.configures.type;
        if (typeDeclaration.required && typeDeclaration.required.length > 0) {
          for (const required of typeDeclaration.required) {
            const value = result.configures[required];
            if (value) {
              label2 = label2 + ": " + value;
              break;
            }
          }
        }
        result._label = label2;
      }
      if (!result.configurationProperties.identifier) {
        result.configurationProperties.identifier = taskIdentifier._key;
      }
    }
    return result;
  }
  ConfiguringTask2.from = from;
})(ConfiguringTask || (ConfiguringTask = {}));
var CustomTask;
((CustomTask2) => {
  function from(external, context, index, source) {
    if (!external) {
      return void 0;
    }
    let type = external.type;
    if (type === void 0 || type === null) {
      type = Tasks.CUSTOMIZED_TASK_TYPE;
    }
    if (type !== Tasks.CUSTOMIZED_TASK_TYPE && type !== "shell" && type !== "process") {
      context.problemReporter.error(nls.localize("ConfigurationParser.notCustom", "Error: tasks is not declared as a custom task. The configuration will be ignored.\n{0}\n", JSON.stringify(external, null, 4)));
      return void 0;
    }
    let taskName = external.taskName;
    if (Types.isString(external.label) && context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0) {
      taskName = external.label;
    }
    if (!taskName) {
      context.problemReporter.error(nls.localize("ConfigurationParser.noTaskName", "Error: a task must provide a label property. The task will be ignored.\n{0}\n", JSON.stringify(external, null, 4)));
      return void 0;
    }
    let taskSource;
    switch (source) {
      case 2 /* User */: {
        taskSource = { kind: Tasks.TaskSourceKind.User, config: { index, element: external, file: ".vscode/tasks.json", workspaceFolder: context.workspaceFolder }, label };
        break;
      }
      case 1 /* WorkspaceFile */: {
        taskSource = { kind: Tasks.TaskSourceKind.WorkspaceFile, config: { index, element: external, file: ".vscode/tasks.json", workspaceFolder: context.workspaceFolder, workspace: context.workspace }, label };
        break;
      }
      default: {
        taskSource = { kind: Tasks.TaskSourceKind.Workspace, config: { index, element: external, file: ".vscode/tasks.json", workspaceFolder: context.workspaceFolder }, label };
        break;
      }
    }
    const result = new Tasks.CustomTask(
      context.uuidMap.getUUID(taskName),
      taskSource,
      taskName,
      Tasks.CUSTOMIZED_TASK_TYPE,
      void 0,
      false,
      RunOptions.fromConfiguration(external.runOptions),
      {
        name: taskName,
        identifier: taskName
      }
    );
    const configuration = ConfigurationProperties.from(external, context, false, source);
    result.addTaskLoadMessages(configuration.errors);
    if (configuration.value) {
      result.configurationProperties = Object.assign(result.configurationProperties, configuration.value);
    }
    const supportLegacy = true;
    if (supportLegacy) {
      const legacy = external;
      if (result.configurationProperties.isBackground === void 0 && legacy.isWatching !== void 0) {
        result.configurationProperties.isBackground = !!legacy.isWatching;
      }
      if (result.configurationProperties.group === void 0) {
        if (legacy.isBuildCommand === true) {
          result.configurationProperties.group = Tasks.TaskGroup.Build;
        } else if (legacy.isTestCommand === true) {
          result.configurationProperties.group = Tasks.TaskGroup.Test;
        }
      }
    }
    const command = CommandConfiguration.from(external, context);
    if (command) {
      result.command = command;
    }
    if (external.command !== void 0) {
      command.suppressTaskName = true;
    }
    return result;
  }
  CustomTask2.from = from;
  function fillGlobals(task, globals) {
    if (CommandConfiguration.hasCommand(task.command) || task.configurationProperties.dependsOn === void 0) {
      task.command = CommandConfiguration.fillGlobals(task.command, globals.command, task.configurationProperties.name);
    }
    if (task.configurationProperties.problemMatchers === void 0 && globals.problemMatcher !== void 0) {
      task.configurationProperties.problemMatchers = Objects.deepClone(globals.problemMatcher);
      task.hasDefinedMatchers = true;
    }
    if (task.configurationProperties.promptOnClose === void 0 && task.configurationProperties.isBackground === void 0 && globals.promptOnClose !== void 0) {
      task.configurationProperties.promptOnClose = globals.promptOnClose;
    }
  }
  CustomTask2.fillGlobals = fillGlobals;
  function fillDefaults(task, context) {
    CommandConfiguration.fillDefaults(task.command, context);
    if (task.configurationProperties.promptOnClose === void 0) {
      task.configurationProperties.promptOnClose = task.configurationProperties.isBackground !== void 0 ? !task.configurationProperties.isBackground : true;
    }
    if (task.configurationProperties.isBackground === void 0) {
      task.configurationProperties.isBackground = false;
    }
    if (task.configurationProperties.problemMatchers === void 0) {
      task.configurationProperties.problemMatchers = EMPTY_ARRAY;
    }
  }
  CustomTask2.fillDefaults = fillDefaults;
  function createCustomTask2(contributedTask, configuredProps) {
    const result = new Tasks.CustomTask(
      configuredProps._id,
      Object.assign({}, configuredProps._source, { customizes: contributedTask.defines }),
      configuredProps.configurationProperties.name || contributedTask._label,
      Tasks.CUSTOMIZED_TASK_TYPE,
      contributedTask.command,
      false,
      contributedTask.runOptions,
      {
        name: configuredProps.configurationProperties.name || contributedTask.configurationProperties.name,
        identifier: configuredProps.configurationProperties.identifier || contributedTask.configurationProperties.identifier,
        icon: configuredProps.configurationProperties.icon,
        hide: configuredProps.configurationProperties.hide
      }
    );
    result.addTaskLoadMessages(configuredProps.taskLoadMessages);
    const resultConfigProps = result.configurationProperties;
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "group");
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "isBackground");
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "dependsOn");
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "problemMatchers");
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "promptOnClose");
    assignProperty(resultConfigProps, configuredProps.configurationProperties, "detail");
    result.command.presentation = CommandConfiguration.PresentationOptions.assignProperties(
      result.command.presentation,
      configuredProps.configurationProperties.presentation
    );
    result.command.options = CommandOptions.assignProperties(result.command.options, configuredProps.configurationProperties.options);
    result.runOptions = RunOptions.assignProperties(result.runOptions, configuredProps.runOptions);
    const contributedConfigProps = contributedTask.configurationProperties;
    fillProperty(resultConfigProps, contributedConfigProps, "group");
    fillProperty(resultConfigProps, contributedConfigProps, "isBackground");
    fillProperty(resultConfigProps, contributedConfigProps, "dependsOn");
    fillProperty(resultConfigProps, contributedConfigProps, "problemMatchers");
    fillProperty(resultConfigProps, contributedConfigProps, "promptOnClose");
    fillProperty(resultConfigProps, contributedConfigProps, "detail");
    result.command.presentation = CommandConfiguration.PresentationOptions.fillProperties(
      result.command.presentation,
      contributedConfigProps.presentation
    );
    result.command.options = CommandOptions.fillProperties(result.command.options, contributedConfigProps.options);
    result.runOptions = RunOptions.fillProperties(result.runOptions, contributedTask.runOptions);
    if (contributedTask.hasDefinedMatchers === true) {
      result.hasDefinedMatchers = true;
    }
    return result;
  }
  CustomTask2.createCustomTask = createCustomTask2;
})(CustomTask || (CustomTask = {}));
var TaskParser;
((TaskParser2) => {
  function isCustomTask(value) {
    const type = value.type;
    const customize = value.customize;
    return customize === void 0 && (type === void 0 || type === null || type === Tasks.CUSTOMIZED_TASK_TYPE || type === "shell" || type === "process");
  }
  const builtinTypeContextMap = {
    shell: ShellExecutionSupportedContext,
    process: ProcessExecutionSupportedContext
  };
  function from(externals, globals, context, source, registry) {
    const result = { custom: [], configured: [] };
    if (!externals) {
      return result;
    }
    const defaultBuildTask = { task: void 0, rank: -1 };
    const defaultTestTask = { task: void 0, rank: -1 };
    const schema2_0_0 = context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0;
    const baseLoadIssues = Objects.deepClone(context.taskLoadIssues);
    for (let index = 0; index < externals.length; index++) {
      const external = externals[index];
      const definition = external.type ? registry?.get?.(external.type) || TaskDefinitionRegistry.get(external.type) : void 0;
      let typeNotSupported = false;
      if (definition && definition.when && !context.contextKeyService.contextMatchesRules(definition.when)) {
        typeNotSupported = true;
      } else if (!definition && external.type) {
        for (const key of Object.keys(builtinTypeContextMap)) {
          if (external.type === key) {
            typeNotSupported = !ShellExecutionSupportedContext.evaluate(context.contextKeyService.getContext(null));
            break;
          }
        }
      }
      if (typeNotSupported) {
        context.problemReporter.info(nls.localize(
          "taskConfiguration.providerUnavailable",
          "Warning: {0} tasks are unavailable in the current environment.\n",
          external.type
        ));
        continue;
      }
      if (isCustomTask(external)) {
        const customTask = CustomTask.from(external, context, index, source);
        if (customTask) {
          CustomTask.fillGlobals(customTask, globals);
          CustomTask.fillDefaults(customTask, context);
          if (schema2_0_0) {
            if ((customTask.command === void 0 || customTask.command.name === void 0) && (customTask.configurationProperties.dependsOn === void 0 || customTask.configurationProperties.dependsOn.length === 0)) {
              context.problemReporter.error(nls.localize(
                "taskConfiguration.noCommandOrDependsOn",
                "Error: the task '{0}' neither specifies a command nor a dependsOn property. The task will be ignored. Its definition is:\n{1}",
                customTask.configurationProperties.name,
                JSON.stringify(external, void 0, 4)
              ));
              continue;
            }
          } else {
            if (customTask.command === void 0 || customTask.command.name === void 0) {
              context.problemReporter.warn(nls.localize(
                "taskConfiguration.noCommand",
                "Error: the task '{0}' doesn't define a command. The task will be ignored. Its definition is:\n{1}",
                customTask.configurationProperties.name,
                JSON.stringify(external, void 0, 4)
              ));
              continue;
            }
          }
          if (customTask.configurationProperties.group === Tasks.TaskGroup.Build && defaultBuildTask.rank < 2) {
            defaultBuildTask.task = customTask;
            defaultBuildTask.rank = 2;
          } else if (customTask.configurationProperties.group === Tasks.TaskGroup.Test && defaultTestTask.rank < 2) {
            defaultTestTask.task = customTask;
            defaultTestTask.rank = 2;
          } else if (customTask.configurationProperties.name === "build" && defaultBuildTask.rank < 1) {
            defaultBuildTask.task = customTask;
            defaultBuildTask.rank = 1;
          } else if (customTask.configurationProperties.name === "test" && defaultTestTask.rank < 1) {
            defaultTestTask.task = customTask;
            defaultTestTask.rank = 1;
          }
          customTask.addTaskLoadMessages(context.taskLoadIssues);
          result.custom.push(customTask);
        }
      } else {
        const configuredTask = ConfiguringTask.from(external, context, index, source, registry);
        if (configuredTask) {
          configuredTask.addTaskLoadMessages(context.taskLoadIssues);
          result.configured.push(configuredTask);
        }
      }
      context.taskLoadIssues = Objects.deepClone(baseLoadIssues);
    }
    const defaultBuildGroupName = Types.isString(defaultBuildTask.task?.configurationProperties.group) ? defaultBuildTask.task?.configurationProperties.group : defaultBuildTask.task?.configurationProperties.group?._id;
    const defaultTestTaskGroupName = Types.isString(defaultTestTask.task?.configurationProperties.group) ? defaultTestTask.task?.configurationProperties.group : defaultTestTask.task?.configurationProperties.group?._id;
    if (defaultBuildGroupName !== Tasks.TaskGroup.Build._id && defaultBuildTask.rank > -1 && defaultBuildTask.rank < 2 && defaultBuildTask.task) {
      defaultBuildTask.task.configurationProperties.group = Tasks.TaskGroup.Build;
    } else if (defaultTestTaskGroupName !== Tasks.TaskGroup.Test._id && defaultTestTask.rank > -1 && defaultTestTask.rank < 2 && defaultTestTask.task) {
      defaultTestTask.task.configurationProperties.group = Tasks.TaskGroup.Test;
    }
    return result;
  }
  TaskParser2.from = from;
  function assignTasks(target, source) {
    if (source === void 0 || source.length === 0) {
      return target;
    }
    if (target === void 0 || target.length === 0) {
      return source;
    }
    if (source) {
      const map = /* @__PURE__ */ Object.create(null);
      target.forEach((task) => {
        map[task.configurationProperties.name] = task;
      });
      source.forEach((task) => {
        map[task.configurationProperties.name] = task;
      });
      const newTarget = [];
      target.forEach((task) => {
        newTarget.push(map[task.configurationProperties.name]);
        delete map[task.configurationProperties.name];
      });
      Object.keys(map).forEach((key) => newTarget.push(map[key]));
      target = newTarget;
    }
    return target;
  }
  TaskParser2.assignTasks = assignTasks;
})(TaskParser || (TaskParser = {}));
var Globals;
((Globals2) => {
  function from(config, context) {
    let result = fromBase(config, context);
    let osGlobals = void 0;
    if (config.windows && context.platform === Platform.Windows) {
      osGlobals = fromBase(config.windows, context);
    } else if (config.osx && context.platform === Platform.Mac) {
      osGlobals = fromBase(config.osx, context);
    } else if (config.linux && context.platform === Platform.Linux) {
      osGlobals = fromBase(config.linux, context);
    }
    if (osGlobals) {
      result = Globals2.assignProperties(result, osGlobals);
    }
    const command = CommandConfiguration.from(config, context);
    if (command) {
      result.command = command;
    }
    Globals2.fillDefaults(result, context);
    Globals2.freeze(result);
    return result;
  }
  Globals2.from = from;
  function fromBase(config, context) {
    const result = {};
    if (config.suppressTaskName !== void 0) {
      result.suppressTaskName = !!config.suppressTaskName;
    }
    if (config.promptOnClose !== void 0) {
      result.promptOnClose = !!config.promptOnClose;
    }
    if (config.problemMatcher) {
      result.problemMatcher = ProblemMatcherConverter.from(config.problemMatcher, context).value;
    }
    return result;
  }
  Globals2.fromBase = fromBase;
  function isEmpty(value) {
    return !value || value.command === void 0 && value.promptOnClose === void 0 && value.suppressTaskName === void 0;
  }
  Globals2.isEmpty = isEmpty;
  function assignProperties(target, source) {
    if (isEmpty(source)) {
      return target;
    }
    if (isEmpty(target)) {
      return source;
    }
    assignProperty(target, source, "promptOnClose");
    assignProperty(target, source, "suppressTaskName");
    return target;
  }
  Globals2.assignProperties = assignProperties;
  function fillDefaults(value, context) {
    if (!value) {
      return;
    }
    CommandConfiguration.fillDefaults(value.command, context);
    if (value.suppressTaskName === void 0) {
      value.suppressTaskName = context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0;
    }
    if (value.promptOnClose === void 0) {
      value.promptOnClose = true;
    }
  }
  Globals2.fillDefaults = fillDefaults;
  function freeze(value) {
    Object.freeze(value);
    if (value.command) {
      CommandConfiguration.freeze(value.command);
    }
  }
  Globals2.freeze = freeze;
})(Globals || (Globals = {}));
var ExecutionEngine;
((ExecutionEngine2) => {
  function from(config) {
    const runner = config.runner || config._runner;
    let result;
    if (runner) {
      switch (runner) {
        case "terminal":
          result = Tasks.ExecutionEngine.Terminal;
          break;
        case "process":
          result = Tasks.ExecutionEngine.Process;
          break;
      }
    }
    const schemaVersion = JsonSchemaVersion.from(config);
    if (schemaVersion === Tasks.JsonSchemaVersion.V0_1_0) {
      return result || Tasks.ExecutionEngine.Process;
    } else if (schemaVersion === Tasks.JsonSchemaVersion.V2_0_0) {
      return Tasks.ExecutionEngine.Terminal;
    } else {
      throw new Error("Shouldn't happen.");
    }
  }
  ExecutionEngine2.from = from;
})(ExecutionEngine || (ExecutionEngine = {}));
var JsonSchemaVersion;
((JsonSchemaVersion2) => {
  const _default = Tasks.JsonSchemaVersion.V2_0_0;
  function from(config) {
    const version = config.version;
    if (!version) {
      return _default;
    }
    switch (version) {
      case "0.1.0":
        return Tasks.JsonSchemaVersion.V0_1_0;
      case "2.0.0":
        return Tasks.JsonSchemaVersion.V2_0_0;
      default:
        return _default;
    }
  }
  JsonSchemaVersion2.from = from;
})(JsonSchemaVersion || (JsonSchemaVersion = {}));
class UUIDMap {
  constructor(other) {
    this.current = /* @__PURE__ */ Object.create(null);
    if (other) {
      for (const key of Object.keys(other.current)) {
        const value = other.current[key];
        if (Array.isArray(value)) {
          this.current[key] = value.slice();
        } else {
          this.current[key] = value;
        }
      }
    }
  }
  start() {
    this.last = this.current;
    this.current = /* @__PURE__ */ Object.create(null);
  }
  getUUID(identifier) {
    const lastValue = this.last ? this.last[identifier] : void 0;
    let result = void 0;
    if (lastValue !== void 0) {
      if (Array.isArray(lastValue)) {
        result = lastValue.shift();
        if (lastValue.length === 0) {
          delete this.last[identifier];
        }
      } else {
        result = lastValue;
        delete this.last[identifier];
      }
    }
    if (result === void 0) {
      result = UUID.generateUuid();
    }
    const currentValue = this.current[identifier];
    if (currentValue === void 0) {
      this.current[identifier] = result;
    } else {
      if (Array.isArray(currentValue)) {
        currentValue.push(result);
      } else {
        const arrayValue = [currentValue];
        arrayValue.push(result);
        this.current[identifier] = arrayValue;
      }
    }
    return result;
  }
  finish() {
    this.last = void 0;
  }
}
var TaskConfigSource = /* @__PURE__ */ ((TaskConfigSource2) => {
  TaskConfigSource2[TaskConfigSource2["TasksJson"] = 0] = "TasksJson";
  TaskConfigSource2[TaskConfigSource2["WorkspaceFile"] = 1] = "WorkspaceFile";
  TaskConfigSource2[TaskConfigSource2["User"] = 2] = "User";
  return TaskConfigSource2;
})(TaskConfigSource || {});
class ConfigurationParser {
  constructor(workspaceFolder, workspace, platform, problemReporter, uuidMap) {
    this.workspaceFolder = workspaceFolder;
    this.workspace = workspace;
    this.platform = platform;
    this.problemReporter = problemReporter;
    this.uuidMap = uuidMap;
  }
  run(fileConfig, source, contextKeyService) {
    const engine = ExecutionEngine.from(fileConfig);
    const schemaVersion = JsonSchemaVersion.from(fileConfig);
    const context = {
      workspaceFolder: this.workspaceFolder,
      workspace: this.workspace,
      problemReporter: this.problemReporter,
      uuidMap: this.uuidMap,
      namedProblemMatchers: {},
      engine,
      schemaVersion,
      platform: this.platform,
      taskLoadIssues: [],
      contextKeyService
    };
    const taskParseResult = this.createTaskRunnerConfiguration(fileConfig, context, source);
    return {
      validationStatus: this.problemReporter.status,
      custom: taskParseResult.custom,
      configured: taskParseResult.configured,
      engine
    };
  }
  createTaskRunnerConfiguration(fileConfig, context, source) {
    const globals = Globals.from(fileConfig, context);
    if (this.problemReporter.status.isFatal()) {
      return { custom: [], configured: [] };
    }
    context.namedProblemMatchers = ProblemMatcherConverter.namedFrom(fileConfig.declares, context);
    let globalTasks = void 0;
    let externalGlobalTasks = void 0;
    if (fileConfig.windows && context.platform === Platform.Windows) {
      globalTasks = TaskParser.from(fileConfig.windows.tasks, globals, context, source).custom;
      externalGlobalTasks = fileConfig.windows.tasks;
    } else if (fileConfig.osx && context.platform === Platform.Mac) {
      globalTasks = TaskParser.from(fileConfig.osx.tasks, globals, context, source).custom;
      externalGlobalTasks = fileConfig.osx.tasks;
    } else if (fileConfig.linux && context.platform === Platform.Linux) {
      globalTasks = TaskParser.from(fileConfig.linux.tasks, globals, context, source).custom;
      externalGlobalTasks = fileConfig.linux.tasks;
    }
    if (context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0 && globalTasks && globalTasks.length > 0 && externalGlobalTasks && externalGlobalTasks.length > 0) {
      const taskContent = [];
      for (const task of externalGlobalTasks) {
        taskContent.push(JSON.stringify(task, null, 4));
      }
      context.problemReporter.error(
        nls.localize(
          { key: "TaskParse.noOsSpecificGlobalTasks", comment: ['"Task version 2.0.0" refers to the 2.0.0 version of the task system. The "version 2.0.0" is not localizable as it is a json key and value.'] },
          "Task version 2.0.0 doesn't support global OS specific tasks. Convert them to a task with a OS specific command. Affected tasks are:\n{0}",
          taskContent.join("\n")
        )
      );
    }
    let result = { custom: [], configured: [] };
    if (fileConfig.tasks) {
      result = TaskParser.from(fileConfig.tasks, globals, context, source);
    }
    if (globalTasks) {
      result.custom = TaskParser.assignTasks(result.custom, globalTasks);
    }
    if ((!result.custom || result.custom.length === 0) && (globals.command && globals.command.name)) {
      const matchers = ProblemMatcherConverter.from(fileConfig.problemMatcher, context).value ?? [];
      const isBackground = fileConfig.isBackground ? !!fileConfig.isBackground : fileConfig.isWatching ? !!fileConfig.isWatching : void 0;
      const name = Tasks.CommandString.value(globals.command.name);
      const task = new Tasks.CustomTask(
        context.uuidMap.getUUID(name),
        Object.assign({}, source, "workspace", { config: { index: -1, element: fileConfig, workspaceFolder: context.workspaceFolder } }),
        name,
        Tasks.CUSTOMIZED_TASK_TYPE,
        {
          name: void 0,
          runtime: void 0,
          presentation: void 0,
          suppressTaskName: true
        },
        false,
        { reevaluateOnRerun: true },
        {
          name,
          identifier: name,
          group: Tasks.TaskGroup.Build,
          isBackground,
          problemMatchers: matchers
        }
      );
      const taskGroupKind = GroupKind.from(fileConfig.group);
      if (taskGroupKind !== void 0) {
        task.configurationProperties.group = taskGroupKind;
      } else if (fileConfig.group === "none") {
        task.configurationProperties.group = void 0;
      }
      CustomTask.fillGlobals(task, globals);
      CustomTask.fillDefaults(task, context);
      result.custom = [task];
    }
    result.custom = result.custom || [];
    result.configured = result.configured || [];
    return result;
  }
}
const uuidMaps = /* @__PURE__ */ new Map();
const recentUuidMaps = /* @__PURE__ */ new Map();
function parse(workspaceFolder, workspace, platform, configuration, logger, source, contextKeyService, isRecents = false) {
  const recentOrOtherMaps = isRecents ? recentUuidMaps : uuidMaps;
  let selectedUuidMaps = recentOrOtherMaps.get(source);
  if (!selectedUuidMaps) {
    recentOrOtherMaps.set(source, /* @__PURE__ */ new Map());
    selectedUuidMaps = recentOrOtherMaps.get(source);
  }
  let uuidMap = selectedUuidMaps.get(workspaceFolder.uri.toString());
  if (!uuidMap) {
    uuidMap = new UUIDMap();
    selectedUuidMaps.set(workspaceFolder.uri.toString(), uuidMap);
  }
  try {
    uuidMap.start();
    return new ConfigurationParser(workspaceFolder, workspace, platform, logger, uuidMap).run(configuration, source, contextKeyService);
  } finally {
    uuidMap.finish();
  }
}
function createCustomTask(contributedTask, configuredProps) {
  return CustomTask.createCustomTask(contributedTask, configuredProps);
}
export {
  CommandString,
  ExecutionEngine,
  GroupKind,
  ITaskIdentifier,
  JsonSchemaVersion,
  ProblemMatcherConverter,
  RunOnOptions,
  RunOptions,
  ShellQuoting,
  TaskConfigSource,
  TaskParser,
  UUIDMap,
  createCustomTask,
  parse
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vdGFza0NvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcblxuaW1wb3J0ICogYXMgT2JqZWN0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWFNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IFBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICogYXMgVVVJRCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcblxuaW1wb3J0IHsgVmFsaWRhdGlvblN0YXR1cywgSVByb2JsZW1SZXBvcnRlciBhcyBJUHJvYmxlbVJlcG9ydGVyQmFzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhcnNlcnMuanMnO1xuaW1wb3J0IHtcblx0SU5hbWVkUHJvYmxlbU1hdGNoZXIsIFByb2JsZW1NYXRjaGVyUGFyc2VyLCBDb25maWcgYXMgUHJvYmxlbU1hdGNoZXJDb25maWcsXG5cdGlzTmFtZWRQcm9ibGVtTWF0Y2hlciwgUHJvYmxlbU1hdGNoZXJSZWdpc3RyeSwgUHJvYmxlbU1hdGNoZXJcbn0gZnJvbSAnLi9wcm9ibGVtTWF0Y2hlci5qcyc7XG5cbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgKiBhcyBUYXNrcyBmcm9tICcuL3Rhc2tzLmpzJztcbmltcG9ydCB7IElUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LCBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi90YXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbmZpZ3VyZWRJbnB1dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTaGVsbEV4ZWN1dGlvblN1cHBvcnRlZENvbnRleHQsIFByb2Nlc3NFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0IH0gZnJvbSAnLi90YXNrU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcblxuZXhwb3J0IGNvbnN0IGVudW0gU2hlbGxRdW90aW5nIHtcblx0LyoqXG5cdCAqIERlZmF1bHQgaXMgY2hhcmFjdGVyIGVzY2FwaW5nLlxuXHQgKi9cblx0ZXNjYXBlID0gMSxcblxuXHQvKipcblx0ICogRGVmYXVsdCBpcyBzdHJvbmcgcXVvdGluZ1xuXHQgKi9cblx0c3Ryb25nID0gMixcblxuXHQvKipcblx0ICogRGVmYXVsdCBpcyB3ZWFrIHF1b3RpbmcuXG5cdCAqL1xuXHR3ZWFrID0gM1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTaGVsbFF1b3RpbmdPcHRpb25zIHtcblx0LyoqXG5cdCAqIFRoZSBjaGFyYWN0ZXIgdXNlZCB0byBkbyBjaGFyYWN0ZXIgZXNjYXBpbmcuXG5cdCAqL1xuXHRlc2NhcGU/OiBzdHJpbmcgfCB7XG5cdFx0ZXNjYXBlQ2hhcjogc3RyaW5nO1xuXHRcdGNoYXJzVG9Fc2NhcGU6IHN0cmluZztcblx0fTtcblxuXHQvKipcblx0ICogVGhlIGNoYXJhY3RlciB1c2VkIGZvciBzdHJpbmcgcXVvdGluZy5cblx0ICovXG5cdHN0cm9uZz86IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIGNoYXJhY3RlciB1c2VkIGZvciB3ZWFrIHF1b3RpbmcuXG5cdCAqL1xuXHR3ZWFrPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTaGVsbENvbmZpZ3VyYXRpb24ge1xuXHRleGVjdXRhYmxlPzogc3RyaW5nO1xuXHRhcmdzPzogc3RyaW5nW107XG5cdHF1b3Rpbmc/OiBJU2hlbGxRdW90aW5nT3B0aW9ucztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWFuZE9wdGlvbnNDb25maWcge1xuXHQvKipcblx0ICogVGhlIGN1cnJlbnQgd29ya2luZyBkaXJlY3Rvcnkgb2YgdGhlIGV4ZWN1dGVkIHByb2dyYW0gb3Igc2hlbGwuXG5cdCAqIElmIG9taXR0ZWQgVlNDb2RlJ3MgY3VycmVudCB3b3Jrc3BhY2Ugcm9vdCBpcyB1c2VkLlxuXHQgKi9cblx0Y3dkPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgYWRkaXRpb25hbCBlbnZpcm9ubWVudCBvZiB0aGUgZXhlY3V0ZWQgcHJvZ3JhbSBvciBzaGVsbC4gSWYgb21pdHRlZFxuXHQgKiB0aGUgcGFyZW50IHByb2Nlc3MnIGVudmlyb25tZW50IGlzIHVzZWQuXG5cdCAqL1xuXHRlbnY/OiBJU3RyaW5nRGljdGlvbmFyeTxzdHJpbmc+O1xuXG5cdC8qKlxuXHQgKiBUaGUgc2hlbGwgY29uZmlndXJhdGlvbjtcblx0ICovXG5cdHNoZWxsPzogSVNoZWxsQ29uZmlndXJhdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJlc2VudGF0aW9uT3B0aW9uc0NvbmZpZyB7XG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSB0ZXJtaW5hbCBleGVjdXRpbmcgYSB0YXNrIGlzIGJyb3VnaHQgdG8gZnJvbnQgb3Igbm90LlxuXHQgKiBEZWZhdWx0cyB0byBgUmV2ZWFsS2luZC5BbHdheXNgLlxuXHQgKi9cblx0cmV2ZWFsPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBwcm9ibGVtcyBwYW5lbCBpcyByZXZlYWxlZCB3aGVuIHJ1bm5pbmcgdGhpcyB0YXNrIG9yIG5vdC5cblx0ICogRGVmYXVsdHMgdG8gYFJldmVhbEtpbmQuTmV2ZXJgLlxuXHQgKi9cblx0cmV2ZWFsUHJvYmxlbXM/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIGV4ZWN1dGVkIGNvbW1hbmQgaXMgcHJpbnRlZCB0byB0aGUgb3V0cHV0IHdpbmRvdyBvciB0ZXJtaW5hbCBhcyB3ZWxsLlxuXHQgKi9cblx0ZWNobz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHRlcm1pbmFsIGlzIGZvY3VzIHdoZW4gdGhpcyB0YXNrIGlzIGV4ZWN1dGVkXG5cdCAqL1xuXHRmb2N1cz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHRhc2sgcnVucyBpbiBhIG5ldyB0ZXJtaW5hbFxuXHQgKi9cblx0cGFuZWw/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdG8gc2hvdyB0aGUgXCJUZXJtaW5hbCB3aWxsIGJlIHJldXNlZCBieSB0YXNrcywgcHJlc3MgYW55IGtleSB0byBjbG9zZSBpdFwiIG1lc3NhZ2UuXG5cdCAqL1xuXHRzaG93UmV1c2VNZXNzYWdlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQ29udHJvbHMgd2hldGhlciB0aGUgdGVybWluYWwgc2hvdWxkIGJlIGNsZWFyZWQgYmVmb3JlIHJ1bm5pbmcgdGhlIHRhc2suXG5cdCAqL1xuXHRjbGVhcj86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIHRhc2sgaXMgZXhlY3V0ZWQgaW4gYSBzcGVjaWZpYyB0ZXJtaW5hbCBncm91cCB1c2luZyBzcGxpdCBwYW5lcy5cblx0ICovXG5cdGdyb3VwPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSB0ZXJtaW5hbCB0aGF0IHRoZSB0YXNrIHJ1bnMgaW4gaXMgY2xvc2VkIHdoZW4gdGhlIHRhc2sgY29tcGxldGVzLlxuXHQgKiBOb3RlIHRoYXQgaWYgdGhlIHRlcm1pbmFsIHByb2Nlc3MgZXhpdHMgd2l0aCBhIG5vbi16ZXJvIGV4aXQgY29kZSwgaXQgd2lsbCBub3QgY2xvc2UuXG5cdCAqL1xuXHRjbG9zZT86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJ1bk9wdGlvbnNDb25maWcge1xuXHRyZWV2YWx1YXRlT25SZXJ1bj86IGJvb2xlYW47XG5cdHJ1bk9uPzogc3RyaW5nO1xuXHRpbnN0YW5jZUxpbWl0PzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrSWRlbnRpZmllciB7XG5cdHR5cGU/OiBzdHJpbmc7XG5cdFtuYW1lOiBzdHJpbmddOiBhbnk7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSVRhc2tJZGVudGlmaWVyIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGlzKHZhbHVlOiBhbnkpOiB2YWx1ZSBpcyBJVGFza0lkZW50aWZpZXIge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZTogSVRhc2tJZGVudGlmaWVyID0gdmFsdWU7XG5cdFx0cmV0dXJuIGNhbmRpZGF0ZSAhPT0gdW5kZWZpbmVkICYmIFR5cGVzLmlzU3RyaW5nKHZhbHVlLnR5cGUpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxlZ2FjeVRhc2tQcm9wZXJ0aWVzIHtcblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkIFVzZSBgaXNCYWNrZ3JvdW5kYCBpbnN0ZWFkLlxuXHQgKiBXaGV0aGVyIHRoZSBleGVjdXRlZCBjb21tYW5kIGlzIGtlcHQgYWxpdmUgYW5kIGlzIHdhdGNoaW5nIHRoZSBmaWxlIHN5c3RlbS5cblx0ICovXG5cdGlzV2F0Y2hpbmc/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgYGdyb3VwYCBpbnN0ZWFkLlxuXHQgKiBXaGV0aGVyIHRoaXMgdGFzayBtYXBzIHRvIHRoZSBkZWZhdWx0IGJ1aWxkIGNvbW1hbmQuXG5cdCAqL1xuXHRpc0J1aWxkQ29tbWFuZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkIFVzZSBgZ3JvdXBgIGluc3RlYWQuXG5cdCAqIFdoZXRoZXIgdGhpcyB0YXNrIG1hcHMgdG8gdGhlIGRlZmF1bHQgdGVzdCBjb21tYW5kLlxuXHQgKi9cblx0aXNUZXN0Q29tbWFuZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxlZ2FjeUNvbW1hbmRQcm9wZXJ0aWVzIHtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGlzIGlzIGEgc2hlbGwgb3IgcHJvY2Vzc1xuXHQgKi9cblx0dHlwZT86IHN0cmluZztcblxuXHQvKipcblx0ICogQGRlcHJlY2F0ZWQgVXNlIHByZXNlbnRhdGlvbiBvcHRpb25zXG5cdCAqIENvbnRyb2xzIHdoZXRoZXIgdGhlIG91dHB1dCB2aWV3IG9mIHRoZSBydW5uaW5nIHRhc2tzIGlzIGJyb3VnaHQgdG8gZnJvbnQgb3Igbm90LlxuXHQgKiBTZWUgQmFzZVRhc2tSdW5uZXJDb25maWd1cmF0aW9uI3Nob3dPdXRwdXQgZm9yIGRldGFpbHMuXG5cdCAqL1xuXHRzaG93T3V0cHV0Pzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgcHJlc2VudGF0aW9uIG9wdGlvbnNcblx0ICogQ29udHJvbHMgd2hldGhlciB0aGUgZXhlY3V0ZWQgY29tbWFuZCBpcyBwcmludGVkIHRvIHRoZSBvdXRwdXQgd2luZG93cyBhcyB3ZWxsLlxuXHQgKi9cblx0ZWNob0NvbW1hbmQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgcHJlc2VudGF0aW9uIGluc3RlYWRcblx0ICovXG5cdHRlcm1pbmFsPzogSVByZXNlbnRhdGlvbk9wdGlvbnNDb25maWc7XG5cblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkIFVzZSBpbmxpbmUgY29tbWFuZHMuXG5cdCAqIFNlZSBCYXNlVGFza1J1bm5lckNvbmZpZ3VyYXRpb24jc3VwcHJlc3NUYXNrTmFtZSBmb3IgZGV0YWlscy5cblx0ICovXG5cdHN1cHByZXNzVGFza05hbWU/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBTb21lIGNvbW1hbmRzIHJlcXVpcmUgdGhhdCB0aGUgdGFzayBhcmd1bWVudCBpcyBoaWdobGlnaHRlZCB3aXRoIGEgc3BlY2lhbFxuXHQgKiBwcmVmaXggKGUuZy4gL3Q6IGZvciBtc2J1aWxkKS4gVGhpcyBwcm9wZXJ0eSBjYW4gYmUgdXNlZCB0byBjb250cm9sIHN1Y2hcblx0ICogYSBwcmVmaXguXG5cdCAqL1xuXHR0YXNrU2VsZWN0b3I/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkIHVzZSB0aGUgdGFzayB0eXBlIGluc3RlYWQuXG5cdCAqIFNwZWNpZmllcyB3aGV0aGVyIHRoZSBjb21tYW5kIGlzIGEgc2hlbGwgY29tbWFuZCBhbmQgdGhlcmVmb3JlIG11c3Rcblx0ICogYmUgZXhlY3V0ZWQgaW4gYSBzaGVsbCBpbnRlcnByZXRlciAoZS5nLiBjbWQuZXhlLCBiYXNoLCAuLi4pLlxuXHQgKlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZSBpZiBvbWl0dGVkLlxuXHQgKi9cblx0aXNTaGVsbENvbW1hbmQ/OiBib29sZWFuIHwgSVNoZWxsQ29uZmlndXJhdGlvbjtcbn1cblxuZXhwb3J0IHR5cGUgQ29tbWFuZFN0cmluZyA9IHN0cmluZyB8IHN0cmluZ1tdIHwgeyB2YWx1ZTogc3RyaW5nIHwgc3RyaW5nW107IHF1b3Rpbmc6ICdlc2NhcGUnIHwgJ3N0cm9uZycgfCAnd2VhaycgfTtcblxuZXhwb3J0IG5hbWVzcGFjZSBDb21tYW5kU3RyaW5nIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIHZhbHVlKHZhbHVlOiBDb21tYW5kU3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcodmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fSBlbHNlIGlmIChUeXBlcy5pc1N0cmluZ0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLmpvaW4oJyAnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKHZhbHVlLnZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUudmFsdWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUudmFsdWUuam9pbignICcpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElCYXNlQ29tbWFuZFByb3BlcnRpZXMge1xuXG5cdC8qKlxuXHQgKiBUaGUgY29tbWFuZCB0byBiZSBleGVjdXRlZC4gQ2FuIGJlIGFuIGV4dGVybmFsIHByb2dyYW0gb3IgYSBzaGVsbFxuXHQgKiBjb21tYW5kLlxuXHQgKi9cblx0Y29tbWFuZD86IENvbW1hbmRTdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBjb21tYW5kIG9wdGlvbnMgdXNlZCB3aGVuIHRoZSBjb21tYW5kIGlzIGV4ZWN1dGVkLiBDYW4gYmUgb21pdHRlZC5cblx0ICovXG5cdG9wdGlvbnM/OiBJQ29tbWFuZE9wdGlvbnNDb25maWc7XG5cblx0LyoqXG5cdCAqIFRoZSBhcmd1bWVudHMgcGFzc2VkIHRvIHRoZSBjb21tYW5kIG9yIGFkZGl0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byB0aGVcblx0ICogY29tbWFuZCB3aGVuIHVzaW5nIGEgZ2xvYmFsIGNvbW1hbmQuXG5cdCAqL1xuXHRhcmdzPzogQ29tbWFuZFN0cmluZ1tdO1xufVxuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbW1hbmRQcm9wZXJ0aWVzIGV4dGVuZHMgSUJhc2VDb21tYW5kUHJvcGVydGllcyB7XG5cblx0LyoqXG5cdCAqIFdpbmRvd3Mgc3BlY2lmaWMgY29tbWFuZCBwcm9wZXJ0aWVzXG5cdCAqL1xuXHR3aW5kb3dzPzogSUJhc2VDb21tYW5kUHJvcGVydGllcztcblxuXHQvKipcblx0ICogT1NYIHNwZWNpZmljIGNvbW1hbmQgcHJvcGVydGllc1xuXHQgKi9cblx0b3N4PzogSUJhc2VDb21tYW5kUHJvcGVydGllcztcblxuXHQvKipcblx0ICogbGludXggc3BlY2lmaWMgY29tbWFuZCBwcm9wZXJ0aWVzXG5cdCAqL1xuXHRsaW51eD86IElCYXNlQ29tbWFuZFByb3BlcnRpZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUdyb3VwS2luZCB7XG5cdGtpbmQ/OiBzdHJpbmc7XG5cdGlzRGVmYXVsdD86IGJvb2xlYW4gfCBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIHtcblx0LyoqXG5cdCAqIFRoZSB0YXNrJ3MgbmFtZVxuXHQgKi9cblx0dGFza05hbWU/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBVSSBsYWJlbCB1c2VkIGZvciB0aGUgdGFzay5cblx0ICovXG5cdGxhYmVsPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBBbiBvcHRpb25hbCBpZGVudGlmaWVyIHdoaWNoIGNhbiBiZSB1c2VkIHRvIHJlZmVyZW5jZSBhIHRhc2tcblx0ICogaW4gYSBkZXBlbmRzT24gb3Igb3RoZXIgYXR0cmlidXRlcy5cblx0ICovXG5cdGlkZW50aWZpZXI/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIGV4ZWN1dGVkIGNvbW1hbmQgaXMga2VwdCBhbGl2ZSBhbmQgcnVucyBpbiB0aGUgYmFja2dyb3VuZC5cblx0ICovXG5cdGlzQmFja2dyb3VuZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHRhc2sgc2hvdWxkIHByb21wdCBvbiBjbG9zZSBmb3IgY29uZmlybWF0aW9uIGlmIHJ1bm5pbmcuXG5cdCAqL1xuXHRwcm9tcHRPbkNsb3NlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRGVmaW5lcyB0aGUgZ3JvdXAgdGhlIHRhc2sgYmVsb25ncyB0b28uXG5cdCAqL1xuXHRncm91cD86IHN0cmluZyB8IElHcm91cEtpbmQ7XG5cblx0LyoqXG5cdCAqIEEgZGVzY3JpcHRpb24gb2YgdGhlIHRhc2suXG5cdCAqL1xuXHRkZXRhaWw/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBvdGhlciB0YXNrcyB0aGUgdGFzayBkZXBlbmQgb25cblx0ICovXG5cdGRlcGVuZHNPbj86IHN0cmluZyB8IElUYXNrSWRlbnRpZmllciB8IEFycmF5PHN0cmluZyB8IElUYXNrSWRlbnRpZmllcj47XG5cblx0LyoqXG5cdCAqIFRoZSBvcmRlciB0aGUgZGVwZW5kc09uIHRhc2tzIHNob3VsZCBiZSBleGVjdXRlZCBpbi5cblx0ICovXG5cdGRlcGVuZHNPcmRlcj86IHN0cmluZztcblxuXHQvKipcblx0ICogQ29udHJvbHMgdGhlIGJlaGF2aW9yIG9mIHRoZSB1c2VkIHRlcm1pbmFsXG5cdCAqL1xuXHRwcmVzZW50YXRpb24/OiBJUHJlc2VudGF0aW9uT3B0aW9uc0NvbmZpZztcblxuXHQvKipcblx0ICogQ29udHJvbHMgc2hlbGwgb3B0aW9ucy5cblx0ICovXG5cdG9wdGlvbnM/OiBJQ29tbWFuZE9wdGlvbnNDb25maWc7XG5cblx0LyoqXG5cdCAqIFRoZSBwcm9ibGVtIG1hdGNoZXIocykgdG8gdXNlIHRvIGNhcHR1cmUgcHJvYmxlbXMgaW4gdGhlIHRhc2tzXG5cdCAqIG91dHB1dC5cblx0ICovXG5cdHByb2JsZW1NYXRjaGVyPzogUHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXJUeXBlO1xuXG5cdC8qKlxuXHQgKiBUYXNrIHJ1biBvcHRpb25zLiBDb250cm9sIHJ1biByZWxhdGVkIHByb3BlcnRpZXMuXG5cdCAqL1xuXHRydW5PcHRpb25zPzogSVJ1bk9wdGlvbnNDb25maWc7XG5cblx0LyoqXG5cdCAqIFRoZSBpY29uIGZvciB0aGlzIHRhc2sgaW4gdGhlIHRlcm1pbmFsIHRhYnMgbGlzdFxuXHQgKi9cblx0aWNvbj86IHsgaWQ6IHN0cmluZzsgY29sb3I/OiBzdHJpbmcgfTtcblxuXHQvKipcblx0ICogVGhlIGljb24ncyBjb2xvciBpbiB0aGUgdGVybWluYWwgdGFicyBsaXN0XG5cdCAqL1xuXHRjb2xvcj86IHN0cmluZztcblxuXHQvKipcblx0ICogRG8gbm90IHNob3cgdGhpcyB0YXNrIGluIHRoZSBydW4gdGFzayBxdWlja3BpY2tcblx0ICovXG5cdGhpZGU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDdXN0b21UYXNrIGV4dGVuZHMgSUNvbW1hbmRQcm9wZXJ0aWVzLCBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMge1xuXHQvKipcblx0ICogQ3VzdG9tIHRhc2tzIGhhdmUgdGhlIHR5cGUgQ1VTVE9NSVpFRF9UQVNLX1RZUEVcblx0ICovXG5cdHR5cGU/OiBzdHJpbmc7XG5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29uZmlndXJpbmdUYXNrIGV4dGVuZHMgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIHtcblx0LyoqXG5cdCAqIFRoZSBjb250cmlidXRlZCB0eXBlIG9mIHRoZSB0YXNrXG5cdCAqL1xuXHR0eXBlPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFRoZSBiYXNlIHRhc2sgcnVubmVyIGNvbmZpZ3VyYXRpb25cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQmFzZVRhc2tSdW5uZXJDb25maWd1cmF0aW9uIHtcblxuXHQvKipcblx0ICogVGhlIGNvbW1hbmQgdG8gYmUgZXhlY3V0ZWQuIENhbiBiZSBhbiBleHRlcm5hbCBwcm9ncmFtIG9yIGEgc2hlbGxcblx0ICogY29tbWFuZC5cblx0ICovXG5cdGNvbW1hbmQ/OiBDb21tYW5kU3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBAZGVwcmVjYXRlZCBVc2UgdHlwZSBpbnN0ZWFkXG5cdCAqXG5cdCAqIFNwZWNpZmllcyB3aGV0aGVyIHRoZSBjb21tYW5kIGlzIGEgc2hlbGwgY29tbWFuZCBhbmQgdGhlcmVmb3JlIG11c3Rcblx0ICogYmUgZXhlY3V0ZWQgaW4gYSBzaGVsbCBpbnRlcnByZXRlciAoZS5nLiBjbWQuZXhlLCBiYXNoLCAuLi4pLlxuXHQgKlxuXHQgKiBEZWZhdWx0cyB0byBmYWxzZSBpZiBvbWl0dGVkLlxuXHQgKi9cblx0aXNTaGVsbENvbW1hbmQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUaGUgdGFzayB0eXBlXG5cdCAqL1xuXHR0eXBlPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgY29tbWFuZCBvcHRpb25zIHVzZWQgd2hlbiB0aGUgY29tbWFuZCBpcyBleGVjdXRlZC4gQ2FuIGJlIG9taXR0ZWQuXG5cdCAqL1xuXHRvcHRpb25zPzogSUNvbW1hbmRPcHRpb25zQ29uZmlnO1xuXG5cdC8qKlxuXHQgKiBUaGUgYXJndW1lbnRzIHBhc3NlZCB0byB0aGUgY29tbWFuZC4gQ2FuIGJlIG9taXR0ZWQuXG5cdCAqL1xuXHRhcmdzPzogQ29tbWFuZFN0cmluZ1tdO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBvdXRwdXQgdmlldyBvZiB0aGUgcnVubmluZyB0YXNrcyBpcyBicm91Z2h0IHRvIGZyb250IG9yIG5vdC5cblx0ICogVmFsaWQgdmFsdWVzIGFyZTpcblx0ICogICBcImFsd2F5c1wiOiBicmluZyB0aGUgb3V0cHV0IHdpbmRvdyBhbHdheXMgdG8gZnJvbnQgd2hlbiBhIHRhc2sgaXMgZXhlY3V0ZWQuXG5cdCAqICAgXCJzaWxlbnRcIjogb25seSBicmluZyBpdCB0byBmcm9udCBpZiBubyBwcm9ibGVtIG1hdGNoZXIgaXMgZGVmaW5lZCBmb3IgdGhlIHRhc2sgZXhlY3V0ZWQuXG5cdCAqICAgXCJuZXZlclwiOiBuZXZlciBicmluZyB0aGUgb3V0cHV0IHdpbmRvdyB0byBmcm9udC5cblx0ICpcblx0ICogSWYgb21pdHRlZCBcImFsd2F5c1wiIGlzIHVzZWQuXG5cdCAqL1xuXHRzaG93T3V0cHV0Pzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSBleGVjdXRlZCBjb21tYW5kIGlzIHByaW50ZWQgdG8gdGhlIG91dHB1dCB3aW5kb3dzIGFzIHdlbGwuXG5cdCAqL1xuXHRlY2hvQ29tbWFuZD86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoZSBncm91cFxuXHQgKi9cblx0Z3JvdXA/OiBzdHJpbmcgfCBJR3JvdXBLaW5kO1xuXG5cdC8qKlxuXHQgKiBDb250cm9scyB0aGUgYmVoYXZpb3Igb2YgdGhlIHVzZWQgdGVybWluYWxcblx0ICovXG5cdHByZXNlbnRhdGlvbj86IElQcmVzZW50YXRpb25PcHRpb25zQ29uZmlnO1xuXG5cdC8qKlxuXHQgKiBJZiBzZXQgdG8gZmFsc2UgdGhlIHRhc2sgbmFtZSBpcyBhZGRlZCBhcyBhbiBhZGRpdGlvbmFsIGFyZ3VtZW50IHRvIHRoZVxuXHQgKiBjb21tYW5kIHdoZW4gZXhlY3V0ZWQuIElmIHNldCB0byB0cnVlIHRoZSB0YXNrIG5hbWUgaXMgc3VwcHJlc3NlZC4gSWZcblx0ICogb21pdHRlZCBmYWxzZSBpcyB1c2VkLlxuXHQgKi9cblx0c3VwcHJlc3NUYXNrTmFtZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFNvbWUgY29tbWFuZHMgcmVxdWlyZSB0aGF0IHRoZSB0YXNrIGFyZ3VtZW50IGlzIGhpZ2hsaWdodGVkIHdpdGggYSBzcGVjaWFsXG5cdCAqIHByZWZpeCAoZS5nLiAvdDogZm9yIG1zYnVpbGQpLiBUaGlzIHByb3BlcnR5IGNhbiBiZSB1c2VkIHRvIGNvbnRyb2wgc3VjaFxuXHQgKiBhIHByZWZpeC5cblx0ICovXG5cdHRhc2tTZWxlY3Rvcj86IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIHByb2JsZW0gbWF0Y2hlcihzKSB0byB1c2VkIGlmIGEgZ2xvYmFsIGNvbW1hbmQgaXMgZXhlY3V0ZWQgKGUuZy4gbm8gdGFza3Ncblx0ICogYXJlIGRlZmluZWQpLiBBIHRhc2tzLmpzb24gZmlsZSBjYW4gZWl0aGVyIGNvbnRhaW4gYSBnbG9iYWwgcHJvYmxlbU1hdGNoZXJcblx0ICogcHJvcGVydHkgb3IgYSB0YXNrcyBwcm9wZXJ0eSBidXQgbm90IGJvdGguXG5cdCAqL1xuXHRwcm9ibGVtTWF0Y2hlcj86IFByb2JsZW1NYXRjaGVyQ29uZmlnLlByb2JsZW1NYXRjaGVyVHlwZTtcblxuXHQvKipcblx0ICogQGRlcHJlY2F0ZWQgVXNlIGBpc0JhY2tncm91bmRgIGluc3RlYWQuXG5cdCAqXG5cdCAqIFNwZWNpZmllcyB3aGV0aGVyIGEgZ2xvYmFsIGNvbW1hbmQgaXMgYSB3YXRjaGluZyB0aGUgZmlsZXN5c3RlbS4gQSB0YXNrLmpzb25cblx0ICogZmlsZSBjYW4gZWl0aGVyIGNvbnRhaW4gYSBnbG9iYWwgaXNXYXRjaGluZyBwcm9wZXJ0eSBvciBhIHRhc2tzIHByb3BlcnR5XG5cdCAqIGJ1dCBub3QgYm90aC5cblx0ICovXG5cdGlzV2F0Y2hpbmc/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBTcGVjaWZpZXMgd2hldGhlciBhIGdsb2JhbCBjb21tYW5kIGlzIGEgYmFja2dyb3VuZCB0YXNrLlxuXHQgKi9cblx0aXNCYWNrZ3JvdW5kPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgdGFzayBzaG91bGQgcHJvbXB0IG9uIGNsb3NlIGZvciBjb25maXJtYXRpb24gaWYgcnVubmluZy5cblx0ICovXG5cdHByb21wdE9uQ2xvc2U/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUaGUgY29uZmlndXJhdGlvbiBvZiB0aGUgYXZhaWxhYmxlIHRhc2tzLiBBIHRhc2tzLmpzb24gZmlsZSBjYW4gZWl0aGVyXG5cdCAqIGNvbnRhaW4gYSBnbG9iYWwgcHJvYmxlbU1hdGNoZXIgcHJvcGVydHkgb3IgYSB0YXNrcyBwcm9wZXJ0eSBidXQgbm90IGJvdGguXG5cdCAqL1xuXHR0YXNrcz86IEFycmF5PElDdXN0b21UYXNrIHwgSUNvbmZpZ3VyaW5nVGFzaz47XG5cblx0LyoqXG5cdCAqIFByb2JsZW0gbWF0Y2hlciBkZWNsYXJhdGlvbnMuXG5cdCAqL1xuXHRkZWNsYXJlcz86IFByb2JsZW1NYXRjaGVyQ29uZmlnLklOYW1lZFByb2JsZW1NYXRjaGVyW107XG5cblx0LyoqXG5cdCAqIE9wdGlvbmFsIHVzZXIgaW5wdXQgdmFyaWFibGVzLlxuXHQgKi9cblx0aW5wdXRzPzogQ29uZmlndXJlZElucHV0W107XG59XG5cbi8qKlxuICogQSBjb25maWd1cmF0aW9uIG9mIGFuIGV4dGVybmFsIGJ1aWxkIHN5c3RlbS4gQnVpbGRDb25maWd1cmF0aW9uLmJ1aWxkU3lzdGVtXG4gKiBtdXN0IGJlIHNldCB0byAncHJvZ3JhbSdcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiBleHRlbmRzIElCYXNlVGFza1J1bm5lckNvbmZpZ3VyYXRpb24ge1xuXG5cdF9ydW5uZXI/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIERldGVybWluZXMgdGhlIHJ1bm5lciB0byB1c2Vcblx0ICovXG5cdHJ1bm5lcj86IHN0cmluZztcblxuXHQvKipcblx0ICogVGhlIGNvbmZpZydzIHZlcnNpb24gbnVtYmVyXG5cdCAqL1xuXHR2ZXJzaW9uOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFdpbmRvd3Mgc3BlY2lmaWMgdGFzayBjb25maWd1cmF0aW9uXG5cdCAqL1xuXHR3aW5kb3dzPzogSUJhc2VUYXNrUnVubmVyQ29uZmlndXJhdGlvbjtcblxuXHQvKipcblx0ICogTWFjIHNwZWNpZmljIHRhc2sgY29uZmlndXJhdGlvblxuXHQgKi9cblx0b3N4PzogSUJhc2VUYXNrUnVubmVyQ29uZmlndXJhdGlvbjtcblxuXHQvKipcblx0ICogTGludXggc3BlY2lmaWMgdGFzayBjb25maWd1cmF0aW9uXG5cdCAqL1xuXHRsaW51eD86IElCYXNlVGFza1J1bm5lckNvbmZpZ3VyYXRpb247XG59XG5cbmVudW0gUHJvYmxlbU1hdGNoZXJLaW5kIHtcblx0VW5rbm93bixcblx0U3RyaW5nLFxuXHRQcm9ibGVtTWF0Y2hlcixcblx0QXJyYXlcbn1cblxudHlwZSBUYXNrQ29uZmlndXJhdGlvblZhbHVlV2l0aEVycm9yczxUPiA9IHtcblx0dmFsdWU/OiBUO1xuXHRlcnJvcnM/OiBzdHJpbmdbXTtcbn07XG5cbmNvbnN0IEVNUFRZX0FSUkFZOiBhbnlbXSA9IFtdO1xuT2JqZWN0LmZyZWV6ZShFTVBUWV9BUlJBWSk7XG5cbmZ1bmN0aW9uIGFzc2lnblByb3BlcnR5PFQsIEsgZXh0ZW5kcyBrZXlvZiBUPih0YXJnZXQ6IFQsIHNvdXJjZTogUGFydGlhbDxUPiwga2V5OiBLKSB7XG5cdGNvbnN0IHNvdXJjZUF0S2V5ID0gc291cmNlW2tleV07XG5cdGlmIChzb3VyY2VBdEtleSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0dGFyZ2V0W2tleV0gPSBzb3VyY2VBdEtleSE7XG5cdH1cbn1cblxuZnVuY3Rpb24gZmlsbFByb3BlcnR5PFQsIEsgZXh0ZW5kcyBrZXlvZiBUPih0YXJnZXQ6IFQsIHNvdXJjZTogUGFydGlhbDxUPiwga2V5OiBLKSB7XG5cdGNvbnN0IHNvdXJjZUF0S2V5ID0gc291cmNlW2tleV07XG5cdGlmICh0YXJnZXRba2V5XSA9PT0gdW5kZWZpbmVkICYmIHNvdXJjZUF0S2V5ICE9PSB1bmRlZmluZWQpIHtcblx0XHR0YXJnZXRba2V5XSA9IHNvdXJjZUF0S2V5ITtcblx0fVxufVxuXG5cbmludGVyZmFjZSBJUGFyc2VyVHlwZTxUPiB7XG5cdGlzRW1wdHkodmFsdWU6IFQgfCB1bmRlZmluZWQpOiBib29sZWFuO1xuXHRhc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldDogVCB8IHVuZGVmaW5lZCwgc291cmNlOiBUIHwgdW5kZWZpbmVkKTogVCB8IHVuZGVmaW5lZDtcblx0ZmlsbFByb3BlcnRpZXModGFyZ2V0OiBUIHwgdW5kZWZpbmVkLCBzb3VyY2U6IFQgfCB1bmRlZmluZWQpOiBUIHwgdW5kZWZpbmVkO1xuXHRmaWxsRGVmYXVsdHModmFsdWU6IFQgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUIHwgdW5kZWZpbmVkO1xuXHRmcmVlemUodmFsdWU6IFQpOiBSZWFkb25seTxUPiB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIElNZXRhRGF0YTxULCBVPiB7XG5cdHByb3BlcnR5OiBrZXlvZiBUO1xuXHR0eXBlPzogSVBhcnNlclR5cGU8VT47XG59XG5cblxuZnVuY3Rpb24gX2lzRW1wdHk8VD4odGhpczogdm9pZCwgdmFsdWU6IFQgfCB1bmRlZmluZWQsIHByb3BlcnRpZXM6IElNZXRhRGF0YTxULCBhbnk+W10gfCB1bmRlZmluZWQsIGFsbG93RW1wdHlBcnJheTogYm9vbGVhbiA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHByb3BlcnRpZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGZvciAoY29uc3QgbWV0YSBvZiBwcm9wZXJ0aWVzKSB7XG5cdFx0Y29uc3QgcHJvcGVydHkgPSB2YWx1ZVttZXRhLnByb3BlcnR5XTtcblx0XHRpZiAocHJvcGVydHkgIT09IHVuZGVmaW5lZCAmJiBwcm9wZXJ0eSAhPT0gbnVsbCkge1xuXHRcdFx0aWYgKG1ldGEudHlwZSAhPT0gdW5kZWZpbmVkICYmICFtZXRhLnR5cGUuaXNFbXB0eShwcm9wZXJ0eSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSBlbHNlIGlmICghQXJyYXkuaXNBcnJheShwcm9wZXJ0eSkgfHwgKHByb3BlcnR5Lmxlbmd0aCA+IDApIHx8IGFsbG93RW1wdHlBcnJheSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBfYXNzaWduUHJvcGVydGllczxUPih0aGlzOiB2b2lkLCB0YXJnZXQ6IFQgfCB1bmRlZmluZWQsIHNvdXJjZTogVCB8IHVuZGVmaW5lZCwgcHJvcGVydGllczogSU1ldGFEYXRhPFQsIGFueT5bXSk6IFQgfCB1bmRlZmluZWQge1xuXHRpZiAoIXNvdXJjZSB8fCBfaXNFbXB0eShzb3VyY2UsIHByb3BlcnRpZXMpKSB7XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fVxuXHRpZiAoIXRhcmdldCB8fCBfaXNFbXB0eSh0YXJnZXQsIHByb3BlcnRpZXMpKSB7XG5cdFx0cmV0dXJuIHNvdXJjZTtcblx0fVxuXHRmb3IgKGNvbnN0IG1ldGEgb2YgcHJvcGVydGllcykge1xuXHRcdGNvbnN0IHByb3BlcnR5ID0gbWV0YS5wcm9wZXJ0eTtcblx0XHRsZXQgdmFsdWU6IGFueTtcblx0XHRpZiAobWV0YS50eXBlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHZhbHVlID0gbWV0YS50eXBlLmFzc2lnblByb3BlcnRpZXModGFyZ2V0W3Byb3BlcnR5XSwgc291cmNlW3Byb3BlcnR5XSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlID0gc291cmNlW3Byb3BlcnR5XTtcblx0XHR9XG5cdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQgJiYgdmFsdWUgIT09IG51bGwpIHtcblx0XHRcdHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHRhcmdldDtcbn1cblxuZnVuY3Rpb24gX2ZpbGxQcm9wZXJ0aWVzPFQ+KHRoaXM6IHZvaWQsIHRhcmdldDogVCB8IHVuZGVmaW5lZCwgc291cmNlOiBUIHwgdW5kZWZpbmVkLCBwcm9wZXJ0aWVzOiBJTWV0YURhdGE8VCwgYW55PltdIHwgdW5kZWZpbmVkLCBhbGxvd0VtcHR5QXJyYXk6IGJvb2xlYW4gPSBmYWxzZSk6IFQgfCB1bmRlZmluZWQge1xuXHRpZiAoIXNvdXJjZSB8fCBfaXNFbXB0eShzb3VyY2UsIHByb3BlcnRpZXMpKSB7XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fVxuXHRpZiAoIXRhcmdldCB8fCBfaXNFbXB0eSh0YXJnZXQsIHByb3BlcnRpZXMsIGFsbG93RW1wdHlBcnJheSkpIHtcblx0XHRyZXR1cm4gc291cmNlO1xuXHR9XG5cdGZvciAoY29uc3QgbWV0YSBvZiBwcm9wZXJ0aWVzISkge1xuXHRcdGNvbnN0IHByb3BlcnR5ID0gbWV0YS5wcm9wZXJ0eTtcblx0XHRsZXQgdmFsdWU6IGFueTtcblx0XHRpZiAobWV0YS50eXBlKSB7XG5cdFx0XHR2YWx1ZSA9IG1ldGEudHlwZS5maWxsUHJvcGVydGllcyh0YXJnZXRbcHJvcGVydHldLCBzb3VyY2VbcHJvcGVydHldKTtcblx0XHR9IGVsc2UgaWYgKHRhcmdldFtwcm9wZXJ0eV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dmFsdWUgPSBzb3VyY2VbcHJvcGVydHldO1xuXHRcdH1cblx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0dGFyZ2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGFyZ2V0O1xufVxuXG5mdW5jdGlvbiBfZmlsbERlZmF1bHRzPFQ+KHRoaXM6IHZvaWQsIHRhcmdldDogVCB8IHVuZGVmaW5lZCwgZGVmYXVsdHM6IFQgfCB1bmRlZmluZWQsIHByb3BlcnRpZXM6IElNZXRhRGF0YTxULCBhbnk+W10sIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUIHwgdW5kZWZpbmVkIHtcblx0aWYgKHRhcmdldCAmJiBPYmplY3QuaXNGcm96ZW4odGFyZ2V0KSkge1xuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH1cblx0aWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkIHx8IHRhcmdldCA9PT0gbnVsbCB8fCBkZWZhdWx0cyA9PT0gdW5kZWZpbmVkIHx8IGRlZmF1bHRzID09PSBudWxsKSB7XG5cdFx0aWYgKGRlZmF1bHRzICE9PSB1bmRlZmluZWQgJiYgZGVmYXVsdHMgIT09IG51bGwpIHtcblx0XHRcdHJldHVybiBPYmplY3RzLmRlZXBDbG9uZShkZWZhdWx0cyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdGZvciAoY29uc3QgbWV0YSBvZiBwcm9wZXJ0aWVzKSB7XG5cdFx0Y29uc3QgcHJvcGVydHkgPSBtZXRhLnByb3BlcnR5O1xuXHRcdGlmICh0YXJnZXRbcHJvcGVydHldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblx0XHRsZXQgdmFsdWU6IGFueTtcblx0XHRpZiAobWV0YS50eXBlKSB7XG5cdFx0XHR2YWx1ZSA9IG1ldGEudHlwZS5maWxsRGVmYXVsdHModGFyZ2V0W3Byb3BlcnR5XSwgY29udGV4dCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhbHVlID0gZGVmYXVsdHNbcHJvcGVydHldO1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHR0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG5cdFx0fVxuXHR9XG5cdHJldHVybiB0YXJnZXQ7XG59XG5cbmZ1bmN0aW9uIF9mcmVlemU8VD4odGhpczogdm9pZCwgdGFyZ2V0OiBULCBwcm9wZXJ0aWVzOiBJTWV0YURhdGE8VCwgYW55PltdKTogUmVhZG9ubHk8VD4gfCB1bmRlZmluZWQge1xuXHRpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0ID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRpZiAoT2JqZWN0LmlzRnJvemVuKHRhcmdldCkpIHtcblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG5cdGZvciAoY29uc3QgbWV0YSBvZiBwcm9wZXJ0aWVzKSB7XG5cdFx0aWYgKG1ldGEudHlwZSkge1xuXHRcdFx0Y29uc3QgdmFsdWUgPSB0YXJnZXRbbWV0YS5wcm9wZXJ0eV07XG5cdFx0XHRpZiAodmFsdWUpIHtcblx0XHRcdFx0bWV0YS50eXBlLmZyZWV6ZSh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdE9iamVjdC5mcmVlemUodGFyZ2V0KTtcblx0cmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBSdW5Pbk9wdGlvbnMge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbVN0cmluZyh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogVGFza3MuUnVuT25PcHRpb25zIHtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gVGFza3MuUnVuT25PcHRpb25zLmRlZmF1bHQ7XG5cdFx0fVxuXHRcdHN3aXRjaCAodmFsdWUudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0Y2FzZSAnZm9sZGVyb3Blbic6XG5cdFx0XHRcdHJldHVybiBUYXNrcy5SdW5Pbk9wdGlvbnMuZm9sZGVyT3Blbjtcblx0XHRcdGNhc2UgJ2RlZmF1bHQnOlxuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIFRhc2tzLlJ1bk9uT3B0aW9ucy5kZWZhdWx0O1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIFJ1bk9wdGlvbnMge1xuXHRjb25zdCBwcm9wZXJ0aWVzOiBJTWV0YURhdGE8VGFza3MuSVJ1bk9wdGlvbnMsIHZvaWQ+W10gPSBbeyBwcm9wZXJ0eTogJ3JlZXZhbHVhdGVPblJlcnVuJyB9LCB7IHByb3BlcnR5OiAncnVuT24nIH0sIHsgcHJvcGVydHk6ICdpbnN0YW5jZUxpbWl0JyB9XTtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb21Db25maWd1cmF0aW9uKHZhbHVlOiBJUnVuT3B0aW9uc0NvbmZpZyB8IHVuZGVmaW5lZCk6IFRhc2tzLklSdW5PcHRpb25zIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVldmFsdWF0ZU9uUmVydW46IHZhbHVlID8gdmFsdWUucmVldmFsdWF0ZU9uUmVydW4gOiB0cnVlLFxuXHRcdFx0cnVuT246IHZhbHVlID8gUnVuT25PcHRpb25zLmZyb21TdHJpbmcodmFsdWUucnVuT24pIDogVGFza3MuUnVuT25PcHRpb25zLmRlZmF1bHQsXG5cdFx0XHRpbnN0YW5jZUxpbWl0OiB2YWx1ZSA/IHZhbHVlLmluc3RhbmNlTGltaXQgOiAxXG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBhc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldDogVGFza3MuSVJ1bk9wdGlvbnMsIHNvdXJjZTogVGFza3MuSVJ1bk9wdGlvbnMgfCB1bmRlZmluZWQpOiBUYXNrcy5JUnVuT3B0aW9ucyB7XG5cdFx0cmV0dXJuIF9hc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlLCBwcm9wZXJ0aWVzKSE7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZmlsbFByb3BlcnRpZXModGFyZ2V0OiBUYXNrcy5JUnVuT3B0aW9ucywgc291cmNlOiBUYXNrcy5JUnVuT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFRhc2tzLklSdW5PcHRpb25zIHtcblx0XHRyZXR1cm4gX2ZpbGxQcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlLCBwcm9wZXJ0aWVzKSE7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUGFyc2VDb250ZXh0IHtcblx0d29ya3NwYWNlRm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyO1xuXHR3b3Jrc3BhY2U6IElXb3Jrc3BhY2UgfCB1bmRlZmluZWQ7XG5cdHByb2JsZW1SZXBvcnRlcjogSVByb2JsZW1SZXBvcnRlcjtcblx0bmFtZWRQcm9ibGVtTWF0Y2hlcnM6IElTdHJpbmdEaWN0aW9uYXJ5PElOYW1lZFByb2JsZW1NYXRjaGVyPjtcblx0dXVpZE1hcDogVVVJRE1hcDtcblx0ZW5naW5lOiBUYXNrcy5FeGVjdXRpb25FbmdpbmU7XG5cdHNjaGVtYVZlcnNpb246IFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uO1xuXHRwbGF0Zm9ybTogUGxhdGZvcm07XG5cdHRhc2tMb2FkSXNzdWVzOiBzdHJpbmdbXTtcblx0Y29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcbn1cblxuXG5uYW1lc3BhY2UgU2hlbGxDb25maWd1cmF0aW9uIHtcblxuXHRjb25zdCBwcm9wZXJ0aWVzOiBJTWV0YURhdGE8VGFza3MuSVNoZWxsQ29uZmlndXJhdGlvbiwgdm9pZD5bXSA9IFt7IHByb3BlcnR5OiAnZXhlY3V0YWJsZScgfSwgeyBwcm9wZXJ0eTogJ2FyZ3MnIH0sIHsgcHJvcGVydHk6ICdxdW90aW5nJyB9XTtcblxuXHRleHBvcnQgZnVuY3Rpb24gaXModmFsdWU6IGFueSk6IHZhbHVlIGlzIElTaGVsbENvbmZpZ3VyYXRpb24ge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZTogSVNoZWxsQ29uZmlndXJhdGlvbiA9IHZhbHVlO1xuXHRcdHJldHVybiBjYW5kaWRhdGUgJiYgKFR5cGVzLmlzU3RyaW5nKGNhbmRpZGF0ZS5leGVjdXRhYmxlKSB8fCBUeXBlcy5pc1N0cmluZ0FycmF5KGNhbmRpZGF0ZS5hcmdzKSk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh0aGlzOiB2b2lkLCBjb25maWc6IElTaGVsbENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUYXNrcy5JU2hlbGxDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWlzKGNvbmZpZykpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdDogSVNoZWxsQ29uZmlndXJhdGlvbiA9IHt9O1xuXHRcdGlmIChjb25maWcuZXhlY3V0YWJsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQuZXhlY3V0YWJsZSA9IGNvbmZpZy5leGVjdXRhYmxlO1xuXHRcdH1cblx0XHRpZiAoY29uZmlnLmFyZ3MgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0LmFyZ3MgPSBjb25maWcuYXJncy5zbGljZSgpO1xuXHRcdH1cblx0XHRpZiAoY29uZmlnLnF1b3RpbmcgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0LnF1b3RpbmcgPSBPYmplY3RzLmRlZXBDbG9uZShjb25maWcucXVvdGluZyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KHRoaXM6IHZvaWQsIHZhbHVlOiBUYXNrcy5JU2hlbGxDb25maWd1cmF0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIF9pc0VtcHR5KHZhbHVlLCBwcm9wZXJ0aWVzLCB0cnVlKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBhc3NpZ25Qcm9wZXJ0aWVzKHRoaXM6IHZvaWQsIHRhcmdldDogVGFza3MuSVNoZWxsQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCwgc291cmNlOiBUYXNrcy5JU2hlbGxDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkKTogVGFza3MuSVNoZWxsQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIF9hc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlLCBwcm9wZXJ0aWVzKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmaWxsUHJvcGVydGllcyh0aGlzOiB2b2lkLCB0YXJnZXQ6IFRhc2tzLklTaGVsbENvbmZpZ3VyYXRpb24sIHNvdXJjZTogVGFza3MuSVNoZWxsQ29uZmlndXJhdGlvbik6IFRhc2tzLklTaGVsbENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBfZmlsbFByb3BlcnRpZXModGFyZ2V0LCBzb3VyY2UsIHByb3BlcnRpZXMsIHRydWUpO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZpbGxEZWZhdWx0cyh0aGlzOiB2b2lkLCB2YWx1ZTogVGFza3MuSVNoZWxsQ29uZmlndXJhdGlvbiwgY29udGV4dDogSVBhcnNlQ29udGV4dCk6IFRhc2tzLklTaGVsbENvbmZpZ3VyYXRpb24ge1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcmVlemUodGhpczogdm9pZCwgdmFsdWU6IFRhc2tzLklTaGVsbENvbmZpZ3VyYXRpb24pOiBSZWFkb25seTxUYXNrcy5JU2hlbGxDb25maWd1cmF0aW9uPiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUodmFsdWUpO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBDb21tYW5kT3B0aW9ucyB7XG5cblx0Y29uc3QgcHJvcGVydGllczogSU1ldGFEYXRhPFRhc2tzLkNvbW1hbmRPcHRpb25zLCBUYXNrcy5JU2hlbGxDb25maWd1cmF0aW9uPltdID0gW3sgcHJvcGVydHk6ICdjd2QnIH0sIHsgcHJvcGVydHk6ICdlbnYnIH0sIHsgcHJvcGVydHk6ICdzaGVsbCcsIHR5cGU6IFNoZWxsQ29uZmlndXJhdGlvbiB9XTtcblx0Y29uc3QgZGVmYXVsdHM6IElDb21tYW5kT3B0aW9uc0NvbmZpZyA9IHsgY3dkOiAnJHt3b3Jrc3BhY2VGb2xkZXJ9JyB9O1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHRoaXM6IHZvaWQsIG9wdGlvbnM6IElDb21tYW5kT3B0aW9uc0NvbmZpZywgY29udGV4dDogSVBhcnNlQ29udGV4dCk6IFRhc2tzLkNvbW1hbmRPcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXN1bHQ6IFRhc2tzLkNvbW1hbmRPcHRpb25zID0ge307XG5cdFx0aWYgKG9wdGlvbnMuY3dkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhvcHRpb25zLmN3ZCkpIHtcblx0XHRcdFx0cmVzdWx0LmN3ZCA9IG9wdGlvbnMuY3dkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGV4dC50YXNrTG9hZElzc3Vlcy5wdXNoKG5scy5sb2NhbGl6ZSgnQ29uZmlndXJhdGlvblBhcnNlci5pbnZhbGlkQ1dEJywgJ1dhcm5pbmc6IG9wdGlvbnMuY3dkIG11c3QgYmUgb2YgdHlwZSBzdHJpbmcuIElnbm9yaW5nIHZhbHVlIHswfVxcbicsIG9wdGlvbnMuY3dkKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmVudiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQuZW52ID0gT2JqZWN0cy5kZWVwQ2xvbmUob3B0aW9ucy5lbnYpO1xuXHRcdH1cblx0XHRyZXN1bHQuc2hlbGwgPSBTaGVsbENvbmZpZ3VyYXRpb24uZnJvbShvcHRpb25zLnNoZWxsLCBjb250ZXh0KTtcblx0XHRyZXR1cm4gaXNFbXB0eShyZXN1bHQpID8gdW5kZWZpbmVkIDogcmVzdWx0O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHkodmFsdWU6IFRhc2tzLkNvbW1hbmRPcHRpb25zIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIF9pc0VtcHR5KHZhbHVlLCBwcm9wZXJ0aWVzKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBhc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldDogVGFza3MuQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQsIHNvdXJjZTogVGFza3MuQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQpOiBUYXNrcy5Db21tYW5kT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKChzb3VyY2UgPT09IHVuZGVmaW5lZCkgfHwgaXNFbXB0eShzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdGFyZ2V0O1xuXHRcdH1cblx0XHRpZiAoKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB8fCBpc0VtcHR5KHRhcmdldCkpIHtcblx0XHRcdHJldHVybiBzb3VyY2U7XG5cdFx0fVxuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAnY3dkJyk7XG5cdFx0aWYgKHRhcmdldC5lbnYgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGFyZ2V0LmVudiA9IHNvdXJjZS5lbnY7XG5cdFx0fSBlbHNlIGlmIChzb3VyY2UuZW52ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGVudjogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHRpZiAodGFyZ2V0LmVudiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdE9iamVjdC5rZXlzKHRhcmdldC5lbnYpLmZvckVhY2goa2V5ID0+IGVudltrZXldID0gdGFyZ2V0LmVudiFba2V5XSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc291cmNlLmVudiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdE9iamVjdC5rZXlzKHNvdXJjZS5lbnYpLmZvckVhY2goa2V5ID0+IGVudltrZXldID0gc291cmNlLmVudiFba2V5XSk7XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXQuZW52ID0gZW52O1xuXHRcdH1cblx0XHR0YXJnZXQuc2hlbGwgPSBTaGVsbENvbmZpZ3VyYXRpb24uYXNzaWduUHJvcGVydGllcyh0YXJnZXQuc2hlbGwsIHNvdXJjZS5zaGVsbCk7XG5cdFx0cmV0dXJuIHRhcmdldDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmaWxsUHJvcGVydGllcyh0YXJnZXQ6IFRhc2tzLkNvbW1hbmRPcHRpb25zIHwgdW5kZWZpbmVkLCBzb3VyY2U6IFRhc2tzLkNvbW1hbmRPcHRpb25zIHwgdW5kZWZpbmVkKTogVGFza3MuQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBfZmlsbFByb3BlcnRpZXModGFyZ2V0LCBzb3VyY2UsIHByb3BlcnRpZXMpO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZpbGxEZWZhdWx0cyh2YWx1ZTogVGFza3MuQ29tbWFuZE9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUYXNrcy5Db21tYW5kT3B0aW9ucyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIF9maWxsRGVmYXVsdHModmFsdWUsIGRlZmF1bHRzLCBwcm9wZXJ0aWVzLCBjb250ZXh0KTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcmVlemUodmFsdWU6IFRhc2tzLkNvbW1hbmRPcHRpb25zKTogUmVhZG9ubHk8VGFza3MuQ29tbWFuZE9wdGlvbnM+IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gX2ZyZWV6ZSh2YWx1ZSwgcHJvcGVydGllcyk7XG5cdH1cbn1cblxubmFtZXNwYWNlIENvbW1hbmRDb25maWd1cmF0aW9uIHtcblxuXHRleHBvcnQgbmFtZXNwYWNlIFByZXNlbnRhdGlvbk9wdGlvbnMge1xuXHRcdGNvbnN0IHByb3BlcnRpZXM6IElNZXRhRGF0YTxUYXNrcy5JUHJlc2VudGF0aW9uT3B0aW9ucywgdm9pZD5bXSA9IFt7IHByb3BlcnR5OiAnZWNobycgfSwgeyBwcm9wZXJ0eTogJ3JldmVhbCcgfSwgeyBwcm9wZXJ0eTogJ3JldmVhbFByb2JsZW1zJyB9LCB7IHByb3BlcnR5OiAnZm9jdXMnIH0sIHsgcHJvcGVydHk6ICdwYW5lbCcgfSwgeyBwcm9wZXJ0eTogJ3Nob3dSZXVzZU1lc3NhZ2UnIH0sIHsgcHJvcGVydHk6ICdjbGVhcicgfSwgeyBwcm9wZXJ0eTogJ2dyb3VwJyB9LCB7IHByb3BlcnR5OiAnY2xvc2UnIH1dO1xuXG5cdFx0aW50ZXJmYWNlIElQcmVzZW50YXRpb25PcHRpb25zU2hhcGUgZXh0ZW5kcyBJTGVnYWN5Q29tbWFuZFByb3BlcnRpZXMge1xuXHRcdFx0cHJlc2VudGF0aW9uPzogSVByZXNlbnRhdGlvbk9wdGlvbnNDb25maWc7XG5cdFx0fVxuXG5cdFx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGhpczogdm9pZCwgY29uZmlnOiBJUHJlc2VudGF0aW9uT3B0aW9uc1NoYXBlLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogVGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdFx0bGV0IGVjaG86IGJvb2xlYW47XG5cdFx0XHRsZXQgcmV2ZWFsOiBUYXNrcy5SZXZlYWxLaW5kO1xuXHRcdFx0bGV0IHJldmVhbFByb2JsZW1zOiBUYXNrcy5SZXZlYWxQcm9ibGVtS2luZDtcblx0XHRcdGxldCBmb2N1czogYm9vbGVhbjtcblx0XHRcdGxldCBwYW5lbDogVGFza3MuUGFuZWxLaW5kO1xuXHRcdFx0bGV0IHNob3dSZXVzZU1lc3NhZ2U6IGJvb2xlYW47XG5cdFx0XHRsZXQgY2xlYXI6IGJvb2xlYW47XG5cdFx0XHRsZXQgZ3JvdXA6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBjbG9zZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBoYXNQcm9wcyA9IGZhbHNlO1xuXHRcdFx0aWYgKFR5cGVzLmlzQm9vbGVhbihjb25maWcuZWNob0NvbW1hbmQpKSB7XG5cdFx0XHRcdGVjaG8gPSBjb25maWcuZWNob0NvbW1hbmQ7XG5cdFx0XHRcdGhhc1Byb3BzID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhjb25maWcuc2hvd091dHB1dCkpIHtcblx0XHRcdFx0cmV2ZWFsID0gVGFza3MuUmV2ZWFsS2luZC5mcm9tU3RyaW5nKGNvbmZpZy5zaG93T3V0cHV0KTtcblx0XHRcdFx0aGFzUHJvcHMgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcHJlc2VudGF0aW9uID0gY29uZmlnLnByZXNlbnRhdGlvbiB8fCBjb25maWcudGVybWluYWw7XG5cdFx0XHRpZiAocHJlc2VudGF0aW9uKSB7XG5cdFx0XHRcdGlmIChUeXBlcy5pc0Jvb2xlYW4ocHJlc2VudGF0aW9uLmVjaG8pKSB7XG5cdFx0XHRcdFx0ZWNobyA9IHByZXNlbnRhdGlvbi5lY2hvO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhwcmVzZW50YXRpb24ucmV2ZWFsKSkge1xuXHRcdFx0XHRcdHJldmVhbCA9IFRhc2tzLlJldmVhbEtpbmQuZnJvbVN0cmluZyhwcmVzZW50YXRpb24ucmV2ZWFsKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoVHlwZXMuaXNTdHJpbmcocHJlc2VudGF0aW9uLnJldmVhbFByb2JsZW1zKSkge1xuXHRcdFx0XHRcdHJldmVhbFByb2JsZW1zID0gVGFza3MuUmV2ZWFsUHJvYmxlbUtpbmQuZnJvbVN0cmluZyhwcmVzZW50YXRpb24ucmV2ZWFsUHJvYmxlbXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc0Jvb2xlYW4ocHJlc2VudGF0aW9uLmZvY3VzKSkge1xuXHRcdFx0XHRcdGZvY3VzID0gcHJlc2VudGF0aW9uLmZvY3VzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhwcmVzZW50YXRpb24ucGFuZWwpKSB7XG5cdFx0XHRcdFx0cGFuZWwgPSBUYXNrcy5QYW5lbEtpbmQuZnJvbVN0cmluZyhwcmVzZW50YXRpb24ucGFuZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc0Jvb2xlYW4ocHJlc2VudGF0aW9uLnNob3dSZXVzZU1lc3NhZ2UpKSB7XG5cdFx0XHRcdFx0c2hvd1JldXNlTWVzc2FnZSA9IHByZXNlbnRhdGlvbi5zaG93UmV1c2VNZXNzYWdlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc0Jvb2xlYW4ocHJlc2VudGF0aW9uLmNsZWFyKSkge1xuXHRcdFx0XHRcdGNsZWFyID0gcHJlc2VudGF0aW9uLmNsZWFyO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhwcmVzZW50YXRpb24uZ3JvdXApKSB7XG5cdFx0XHRcdFx0Z3JvdXAgPSBwcmVzZW50YXRpb24uZ3JvdXA7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKFR5cGVzLmlzQm9vbGVhbihwcmVzZW50YXRpb24uY2xvc2UpKSB7XG5cdFx0XHRcdFx0Y2xvc2UgPSBwcmVzZW50YXRpb24uY2xvc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aGFzUHJvcHMgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFoYXNQcm9wcykge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgZWNobzogZWNobyEsIHJldmVhbDogcmV2ZWFsISwgcmV2ZWFsUHJvYmxlbXM6IHJldmVhbFByb2JsZW1zISwgZm9jdXM6IGZvY3VzISwgcGFuZWw6IHBhbmVsISwgc2hvd1JldXNlTWVzc2FnZTogc2hvd1JldXNlTWVzc2FnZSEsIGNsZWFyOiBjbGVhciEsIGdyb3VwLCBjbG9zZTogY2xvc2UgfTtcblx0XHR9XG5cblx0XHRleHBvcnQgZnVuY3Rpb24gYXNzaWduUHJvcGVydGllcyh0YXJnZXQ6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zLCBzb3VyY2U6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zIHwgdW5kZWZpbmVkKTogVGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdFx0cmV0dXJuIF9hc3NpZ25Qcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlLCBwcm9wZXJ0aWVzKTtcblx0XHR9XG5cblx0XHRleHBvcnQgZnVuY3Rpb24gZmlsbFByb3BlcnRpZXModGFyZ2V0OiBUYXNrcy5JUHJlc2VudGF0aW9uT3B0aW9ucywgc291cmNlOiBUYXNrcy5JUHJlc2VudGF0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRcdHJldHVybiBfZmlsbFByb3BlcnRpZXModGFyZ2V0LCBzb3VyY2UsIHByb3BlcnRpZXMpO1xuXHRcdH1cblxuXHRcdGV4cG9ydCBmdW5jdGlvbiBmaWxsRGVmYXVsdHModmFsdWU6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogVGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnMgfCB1bmRlZmluZWQge1xuXHRcdFx0Y29uc3QgZGVmYXVsdEVjaG8gPSBjb250ZXh0LmVuZ2luZSA9PT0gVGFza3MuRXhlY3V0aW9uRW5naW5lLlRlcm1pbmFsID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0cmV0dXJuIF9maWxsRGVmYXVsdHModmFsdWUsIHsgZWNobzogZGVmYXVsdEVjaG8sIHJldmVhbDogVGFza3MuUmV2ZWFsS2luZC5BbHdheXMsIHJldmVhbFByb2JsZW1zOiBUYXNrcy5SZXZlYWxQcm9ibGVtS2luZC5OZXZlciwgZm9jdXM6IGZhbHNlLCBwYW5lbDogVGFza3MuUGFuZWxLaW5kLlNoYXJlZCwgc2hvd1JldXNlTWVzc2FnZTogdHJ1ZSwgY2xlYXI6IGZhbHNlIH0sIHByb3BlcnRpZXMsIGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdGV4cG9ydCBmdW5jdGlvbiBmcmVlemUodmFsdWU6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zKTogUmVhZG9ubHk8VGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnM+IHwgdW5kZWZpbmVkIHtcblx0XHRcdHJldHVybiBfZnJlZXplKHZhbHVlLCBwcm9wZXJ0aWVzKTtcblx0XHR9XG5cblx0XHRleHBvcnQgZnVuY3Rpb24gaXNFbXB0eSh0aGlzOiB2b2lkLCB2YWx1ZTogVGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnMpOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBfaXNFbXB0eSh2YWx1ZSwgcHJvcGVydGllcyk7XG5cdFx0fVxuXHR9XG5cblx0bmFtZXNwYWNlIFNoZWxsU3RyaW5nIHtcblx0XHRleHBvcnQgZnVuY3Rpb24gZnJvbSh0aGlzOiB2b2lkLCB2YWx1ZTogQ29tbWFuZFN0cmluZyB8IHVuZGVmaW5lZCk6IFRhc2tzLkNvbW1hbmRTdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdFx0aWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSBlbHNlIGlmIChUeXBlcy5pc1N0cmluZ0FycmF5KHZhbHVlKSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUuam9pbignICcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcXVvdGluZyA9IFRhc2tzLlNoZWxsUXVvdGluZy5mcm9tKHZhbHVlLnF1b3RpbmcpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBUeXBlcy5pc1N0cmluZyh2YWx1ZS52YWx1ZSkgPyB2YWx1ZS52YWx1ZSA6IFR5cGVzLmlzU3RyaW5nQXJyYXkodmFsdWUudmFsdWUpID8gdmFsdWUudmFsdWUuam9pbignICcpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHZhbHVlOiByZXN1bHQsXG5cdFx0XHRcdFx0XHRxdW90aW5nOiBxdW90aW5nXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aW50ZXJmYWNlIElCYXNlQ29tbWFuZENvbmZpZ3VyYXRpb25TaGFwZSBleHRlbmRzIElCYXNlQ29tbWFuZFByb3BlcnRpZXMsIElMZWdhY3lDb21tYW5kUHJvcGVydGllcyB7XG5cdH1cblxuXHRpbnRlcmZhY2UgSUNvbW1hbmRDb25maWd1cmF0aW9uU2hhcGUgZXh0ZW5kcyBJQmFzZUNvbW1hbmRDb25maWd1cmF0aW9uU2hhcGUge1xuXHRcdHdpbmRvd3M/OiBJQmFzZUNvbW1hbmRDb25maWd1cmF0aW9uU2hhcGU7XG5cdFx0b3N4PzogSUJhc2VDb21tYW5kQ29uZmlndXJhdGlvblNoYXBlO1xuXHRcdGxpbnV4PzogSUJhc2VDb21tYW5kQ29uZmlndXJhdGlvblNoYXBlO1xuXHR9XG5cblx0Y29uc3QgcHJvcGVydGllczogSU1ldGFEYXRhPFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiwgYW55PltdID0gW1xuXHRcdHsgcHJvcGVydHk6ICdydW50aW1lJyB9LCB7IHByb3BlcnR5OiAnbmFtZScgfSwgeyBwcm9wZXJ0eTogJ29wdGlvbnMnLCB0eXBlOiBDb21tYW5kT3B0aW9ucyB9LFxuXHRcdHsgcHJvcGVydHk6ICdhcmdzJyB9LCB7IHByb3BlcnR5OiAndGFza1NlbGVjdG9yJyB9LCB7IHByb3BlcnR5OiAnc3VwcHJlc3NUYXNrTmFtZScgfSxcblx0XHR7IHByb3BlcnR5OiAncHJlc2VudGF0aW9uJywgdHlwZTogUHJlc2VudGF0aW9uT3B0aW9ucyB9XG5cdF07XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGhpczogdm9pZCwgY29uZmlnOiBJQ29tbWFuZENvbmZpZ3VyYXRpb25TaGFwZSwgY29udGV4dDogSVBhcnNlQ29udGV4dCk6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IHJlc3VsdDogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uID0gZnJvbUJhc2UoY29uZmlnLCBjb250ZXh0KSE7XG5cblx0XHRsZXQgb3NDb25maWc6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAoY29uZmlnLndpbmRvd3MgJiYgY29udGV4dC5wbGF0Zm9ybSA9PT0gUGxhdGZvcm0uV2luZG93cykge1xuXHRcdFx0b3NDb25maWcgPSBmcm9tQmFzZShjb25maWcud2luZG93cywgY29udGV4dCk7XG5cdFx0fSBlbHNlIGlmIChjb25maWcub3N4ICYmIGNvbnRleHQucGxhdGZvcm0gPT09IFBsYXRmb3JtLk1hYykge1xuXHRcdFx0b3NDb25maWcgPSBmcm9tQmFzZShjb25maWcub3N4LCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZy5saW51eCAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5MaW51eCkge1xuXHRcdFx0b3NDb25maWcgPSBmcm9tQmFzZShjb25maWcubGludXgsIGNvbnRleHQpO1xuXHRcdH1cblx0XHRpZiAob3NDb25maWcpIHtcblx0XHRcdHJlc3VsdCA9IGFzc2lnblByb3BlcnRpZXMocmVzdWx0LCBvc0NvbmZpZywgY29udGV4dC5zY2hlbWFWZXJzaW9uID09PSBUYXNrcy5Kc29uU2NoZW1hVmVyc2lvbi5WMl8wXzApO1xuXHRcdH1cblx0XHRyZXR1cm4gaXNFbXB0eShyZXN1bHQpID8gdW5kZWZpbmVkIDogcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gZnJvbUJhc2UodGhpczogdm9pZCwgY29uZmlnOiBJQmFzZUNvbW1hbmRDb25maWd1cmF0aW9uU2hhcGUsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG5hbWU6IFRhc2tzLkNvbW1hbmRTdHJpbmcgfCB1bmRlZmluZWQgPSBTaGVsbFN0cmluZy5mcm9tKGNvbmZpZy5jb21tYW5kKTtcblx0XHRsZXQgcnVudGltZTogVGFza3MuUnVudGltZVR5cGU7XG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGNvbmZpZy50eXBlKSkge1xuXHRcdFx0aWYgKGNvbmZpZy50eXBlID09PSAnc2hlbGwnIHx8IGNvbmZpZy50eXBlID09PSAncHJvY2VzcycpIHtcblx0XHRcdFx0cnVudGltZSA9IFRhc2tzLlJ1bnRpbWVUeXBlLmZyb21TdHJpbmcoY29uZmlnLnR5cGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoVHlwZXMuaXNCb29sZWFuKGNvbmZpZy5pc1NoZWxsQ29tbWFuZCkgfHwgU2hlbGxDb25maWd1cmF0aW9uLmlzKGNvbmZpZy5pc1NoZWxsQ29tbWFuZCkpIHtcblx0XHRcdHJ1bnRpbWUgPSBUYXNrcy5SdW50aW1lVHlwZS5TaGVsbDtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZy5pc1NoZWxsQ29tbWFuZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRydW50aW1lID0gISFjb25maWcuaXNTaGVsbENvbW1hbmQgPyBUYXNrcy5SdW50aW1lVHlwZS5TaGVsbCA6IFRhc2tzLlJ1bnRpbWVUeXBlLlByb2Nlc3M7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0OiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0cnVudGltZTogcnVudGltZSEsXG5cdFx0XHRwcmVzZW50YXRpb246IFByZXNlbnRhdGlvbk9wdGlvbnMuZnJvbShjb25maWcsIGNvbnRleHQpIVxuXHRcdH07XG5cblx0XHRpZiAoY29uZmlnLmFyZ3MgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0LmFyZ3MgPSBbXTtcblx0XHRcdGZvciAoY29uc3QgYXJnIG9mIGNvbmZpZy5hcmdzKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnZlcnRlZCA9IFNoZWxsU3RyaW5nLmZyb20oYXJnKTtcblx0XHRcdFx0aWYgKGNvbnZlcnRlZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmFyZ3MucHVzaChjb252ZXJ0ZWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnRleHQudGFza0xvYWRJc3N1ZXMucHVzaChcblx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0J0NvbmZpZ3VyYXRpb25QYXJzZXIuaW5WYWxpZEFyZycsXG5cdFx0XHRcdFx0XHRcdCdFcnJvcjogY29tbWFuZCBhcmd1bWVudCBtdXN0IGVpdGhlciBiZSBhIHN0cmluZyBvciBhIHF1b3RlZCBzdHJpbmcuIFByb3ZpZGVkIHZhbHVlIGlzOlxcbnswfScsXG5cdFx0XHRcdFx0XHRcdGFyZyA/IEpTT04uc3RyaW5naWZ5KGFyZywgdW5kZWZpbmVkLCA0KSA6ICd1bmRlZmluZWQnXG5cdFx0XHRcdFx0XHQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY29uZmlnLm9wdGlvbnMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0Lm9wdGlvbnMgPSBDb21tYW5kT3B0aW9ucy5mcm9tKGNvbmZpZy5vcHRpb25zLCBjb250ZXh0KTtcblx0XHRcdGlmIChyZXN1bHQub3B0aW9ucyAmJiByZXN1bHQub3B0aW9ucy5zaGVsbCA9PT0gdW5kZWZpbmVkICYmIFNoZWxsQ29uZmlndXJhdGlvbi5pcyhjb25maWcuaXNTaGVsbENvbW1hbmQpKSB7XG5cdFx0XHRcdHJlc3VsdC5vcHRpb25zLnNoZWxsID0gU2hlbGxDb25maWd1cmF0aW9uLmZyb20oY29uZmlnLmlzU2hlbGxDb21tYW5kLCBjb250ZXh0KTtcblx0XHRcdFx0aWYgKGNvbnRleHQuZW5naW5lICE9PSBUYXNrcy5FeGVjdXRpb25FbmdpbmUuVGVybWluYWwpIHtcblx0XHRcdFx0XHRjb250ZXh0LnRhc2tMb2FkSXNzdWVzLnB1c2gobmxzLmxvY2FsaXplKCdDb25maWd1cmF0aW9uUGFyc2VyLm5vU2hlbGwnLCAnV2FybmluZzogc2hlbGwgY29uZmlndXJhdGlvbiBpcyBvbmx5IHN1cHBvcnRlZCB3aGVuIGV4ZWN1dGluZyB0YXNrcyBpbiB0aGUgdGVybWluYWwuJykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGNvbmZpZy50YXNrU2VsZWN0b3IpKSB7XG5cdFx0XHRyZXN1bHQudGFza1NlbGVjdG9yID0gY29uZmlnLnRhc2tTZWxlY3Rvcjtcblx0XHR9XG5cdFx0aWYgKFR5cGVzLmlzQm9vbGVhbihjb25maWcuc3VwcHJlc3NUYXNrTmFtZSkpIHtcblx0XHRcdHJlc3VsdC5zdXBwcmVzc1Rhc2tOYW1lID0gY29uZmlnLnN1cHByZXNzVGFza05hbWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlzRW1wdHkocmVzdWx0KSA/IHVuZGVmaW5lZCA6IHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBoYXNDb21tYW5kKHZhbHVlOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdmFsdWUgJiYgISF2YWx1ZS5uYW1lO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlzRW1wdHkodmFsdWU6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBfaXNFbXB0eSh2YWx1ZSwgcHJvcGVydGllcyk7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gYXNzaWduUHJvcGVydGllcyh0YXJnZXQ6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiwgc291cmNlOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24sIG92ZXJ3cml0ZUFyZ3M6IGJvb2xlYW4pOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24ge1xuXHRcdGlmIChpc0VtcHR5KHNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0YXJnZXQ7XG5cdFx0fVxuXHRcdGlmIChpc0VtcHR5KHRhcmdldCkpIHtcblx0XHRcdHJldHVybiBzb3VyY2U7XG5cdFx0fVxuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAnbmFtZScpO1xuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAncnVudGltZScpO1xuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAndGFza1NlbGVjdG9yJyk7XG5cdFx0YXNzaWduUHJvcGVydHkodGFyZ2V0LCBzb3VyY2UsICdzdXBwcmVzc1Rhc2tOYW1lJyk7XG5cdFx0aWYgKHNvdXJjZS5hcmdzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICh0YXJnZXQuYXJncyA9PT0gdW5kZWZpbmVkIHx8IG92ZXJ3cml0ZUFyZ3MpIHtcblx0XHRcdFx0dGFyZ2V0LmFyZ3MgPSBzb3VyY2UuYXJncztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRhcmdldC5hcmdzID0gdGFyZ2V0LmFyZ3MuY29uY2F0KHNvdXJjZS5hcmdzKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGFyZ2V0LnByZXNlbnRhdGlvbiA9IFByZXNlbnRhdGlvbk9wdGlvbnMuYXNzaWduUHJvcGVydGllcyh0YXJnZXQucHJlc2VudGF0aW9uISwgc291cmNlLnByZXNlbnRhdGlvbikhO1xuXHRcdHRhcmdldC5vcHRpb25zID0gQ29tbWFuZE9wdGlvbnMuYXNzaWduUHJvcGVydGllcyh0YXJnZXQub3B0aW9ucywgc291cmNlLm9wdGlvbnMpO1xuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZmlsbFByb3BlcnRpZXModGFyZ2V0OiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24sIHNvdXJjZTogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uKTogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gX2ZpbGxQcm9wZXJ0aWVzKHRhcmdldCwgc291cmNlLCBwcm9wZXJ0aWVzKTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmaWxsR2xvYmFscyh0YXJnZXQ6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbiwgc291cmNlOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQsIHRhc2tOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24ge1xuXHRcdGlmICgoc291cmNlID09PSB1bmRlZmluZWQpIHx8IGlzRW1wdHkoc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHR9XG5cdFx0dGFyZ2V0ID0gdGFyZ2V0IHx8IHtcblx0XHRcdG5hbWU6IHVuZGVmaW5lZCxcblx0XHRcdHJ1bnRpbWU6IHVuZGVmaW5lZCxcblx0XHRcdHByZXNlbnRhdGlvbjogdW5kZWZpbmVkXG5cdFx0fTtcblx0XHRpZiAodGFyZ2V0Lm5hbWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0ZmlsbFByb3BlcnR5KHRhcmdldCwgc291cmNlLCAnbmFtZScpO1xuXHRcdFx0ZmlsbFByb3BlcnR5KHRhcmdldCwgc291cmNlLCAndGFza1NlbGVjdG9yJyk7XG5cdFx0XHRmaWxsUHJvcGVydHkodGFyZ2V0LCBzb3VyY2UsICdzdXBwcmVzc1Rhc2tOYW1lJyk7XG5cdFx0XHRsZXQgYXJnczogVGFza3MuQ29tbWFuZFN0cmluZ1tdID0gc291cmNlLmFyZ3MgPyBzb3VyY2UuYXJncy5zbGljZSgpIDogW107XG5cdFx0XHRpZiAoIXRhcmdldC5zdXBwcmVzc1Rhc2tOYW1lICYmIHRhc2tOYW1lKSB7XG5cdFx0XHRcdGlmICh0YXJnZXQudGFza1NlbGVjdG9yICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRhcmdzLnB1c2godGFyZ2V0LnRhc2tTZWxlY3RvciArIHRhc2tOYW1lKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhcmdzLnB1c2godGFza05hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodGFyZ2V0LmFyZ3MpIHtcblx0XHRcdFx0YXJncyA9IGFyZ3MuY29uY2F0KHRhcmdldC5hcmdzKTtcblx0XHRcdH1cblx0XHRcdHRhcmdldC5hcmdzID0gYXJncztcblx0XHR9XG5cdFx0ZmlsbFByb3BlcnR5KHRhcmdldCwgc291cmNlLCAncnVudGltZScpO1xuXG5cdFx0dGFyZ2V0LnByZXNlbnRhdGlvbiA9IFByZXNlbnRhdGlvbk9wdGlvbnMuZmlsbFByb3BlcnRpZXModGFyZ2V0LnByZXNlbnRhdGlvbiEsIHNvdXJjZS5wcmVzZW50YXRpb24pITtcblx0XHR0YXJnZXQub3B0aW9ucyA9IENvbW1hbmRPcHRpb25zLmZpbGxQcm9wZXJ0aWVzKHRhcmdldC5vcHRpb25zLCBzb3VyY2Uub3B0aW9ucyk7XG5cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZpbGxEZWZhdWx0cyh2YWx1ZTogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogdm9pZCB7XG5cdFx0aWYgKCF2YWx1ZSB8fCBPYmplY3QuaXNGcm96ZW4odmFsdWUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh2YWx1ZS5uYW1lICE9PSB1bmRlZmluZWQgJiYgdmFsdWUucnVudGltZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR2YWx1ZS5ydW50aW1lID0gVGFza3MuUnVudGltZVR5cGUuUHJvY2Vzcztcblx0XHR9XG5cdFx0dmFsdWUucHJlc2VudGF0aW9uID0gUHJlc2VudGF0aW9uT3B0aW9ucy5maWxsRGVmYXVsdHModmFsdWUucHJlc2VudGF0aW9uISwgY29udGV4dCkhO1xuXHRcdGlmICghaXNFbXB0eSh2YWx1ZSkpIHtcblx0XHRcdHZhbHVlLm9wdGlvbnMgPSBDb21tYW5kT3B0aW9ucy5maWxsRGVmYXVsdHModmFsdWUub3B0aW9ucywgY29udGV4dCk7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZS5hcmdzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHZhbHVlLmFyZ3MgPSBFTVBUWV9BUlJBWTtcblx0XHR9XG5cdFx0aWYgKHZhbHVlLnN1cHByZXNzVGFza05hbWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dmFsdWUuc3VwcHJlc3NUYXNrTmFtZSA9IChjb250ZXh0LnNjaGVtYVZlcnNpb24gPT09IFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMCk7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyZWV6ZSh2YWx1ZTogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uKTogUmVhZG9ubHk8VGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIF9mcmVlemUodmFsdWUsIHByb3BlcnRpZXMpO1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgUHJvYmxlbU1hdGNoZXJDb252ZXJ0ZXIge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBuYW1lZEZyb20odGhpczogdm9pZCwgZGVjbGFyZXM6IFByb2JsZW1NYXRjaGVyQ29uZmlnLklOYW1lZFByb2JsZW1NYXRjaGVyW10gfCB1bmRlZmluZWQsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBJU3RyaW5nRGljdGlvbmFyeTxJTmFtZWRQcm9ibGVtTWF0Y2hlcj4ge1xuXHRcdGNvbnN0IHJlc3VsdDogSVN0cmluZ0RpY3Rpb25hcnk8SU5hbWVkUHJvYmxlbU1hdGNoZXI+ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRcdGlmICghQXJyYXkuaXNBcnJheShkZWNsYXJlcykpIHtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHRcdCg8UHJvYmxlbU1hdGNoZXJDb25maWcuSU5hbWVkUHJvYmxlbU1hdGNoZXJbXT5kZWNsYXJlcykuZm9yRWFjaCgodmFsdWUpID0+IHtcblx0XHRcdGNvbnN0IG5hbWVkUHJvYmxlbU1hdGNoZXIgPSAobmV3IFByb2JsZW1NYXRjaGVyUGFyc2VyKGNvbnRleHQucHJvYmxlbVJlcG9ydGVyKSkucGFyc2UodmFsdWUpO1xuXHRcdFx0aWYgKGlzTmFtZWRQcm9ibGVtTWF0Y2hlcihuYW1lZFByb2JsZW1NYXRjaGVyKSkge1xuXHRcdFx0XHRyZXN1bHRbbmFtZWRQcm9ibGVtTWF0Y2hlci5uYW1lXSA9IG5hbWVkUHJvYmxlbU1hdGNoZXI7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci5lcnJvcihubHMubG9jYWxpemUoJ0NvbmZpZ3VyYXRpb25QYXJzZXIubm9OYW1lJywgJ0Vycm9yOiBQcm9ibGVtIE1hdGNoZXIgaW4gZGVjbGFyZSBzY29wZSBtdXN0IGhhdmUgYSBuYW1lOlxcbnswfVxcbicsIEpTT04uc3RyaW5naWZ5KHZhbHVlLCB1bmRlZmluZWQsIDQpKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tV2l0aE9zQ29uZmlnKHRoaXM6IHZvaWQsIGV4dGVybmFsOiBJQ29uZmlndXJhdGlvblByb3BlcnRpZXMgJiB7IFtrZXk6IHN0cmluZ106IGFueSB9LCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogVGFza0NvbmZpZ3VyYXRpb25WYWx1ZVdpdGhFcnJvcnM8UHJvYmxlbU1hdGNoZXJbXT4ge1xuXHRcdGxldCByZXN1bHQ6IFRhc2tDb25maWd1cmF0aW9uVmFsdWVXaXRoRXJyb3JzPFByb2JsZW1NYXRjaGVyW10+ID0ge307XG5cdFx0aWYgKGV4dGVybmFsLndpbmRvd3MgJiYgZXh0ZXJuYWwud2luZG93cy5wcm9ibGVtTWF0Y2hlciAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5XaW5kb3dzKSB7XG5cdFx0XHRyZXN1bHQgPSBmcm9tKGV4dGVybmFsLndpbmRvd3MucHJvYmxlbU1hdGNoZXIsIGNvbnRleHQpO1xuXHRcdH0gZWxzZSBpZiAoZXh0ZXJuYWwub3N4ICYmIGV4dGVybmFsLm9zeC5wcm9ibGVtTWF0Y2hlciAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5NYWMpIHtcblx0XHRcdHJlc3VsdCA9IGZyb20oZXh0ZXJuYWwub3N4LnByb2JsZW1NYXRjaGVyLCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGV4dGVybmFsLmxpbnV4ICYmIGV4dGVybmFsLmxpbnV4LnByb2JsZW1NYXRjaGVyICYmIGNvbnRleHQucGxhdGZvcm0gPT09IFBsYXRmb3JtLkxpbnV4KSB7XG5cdFx0XHRyZXN1bHQgPSBmcm9tKGV4dGVybmFsLmxpbnV4LnByb2JsZW1NYXRjaGVyLCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGV4dGVybmFsLnByb2JsZW1NYXRjaGVyKSB7XG5cdFx0XHRyZXN1bHQgPSBmcm9tKGV4dGVybmFsLnByb2JsZW1NYXRjaGVyLCBjb250ZXh0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHRoaXM6IHZvaWQsIGNvbmZpZzogUHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXJUeXBlIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogVGFza0NvbmZpZ3VyYXRpb25WYWx1ZVdpdGhFcnJvcnM8UHJvYmxlbU1hdGNoZXJbXT4ge1xuXHRcdGNvbnN0IHJlc3VsdDogUHJvYmxlbU1hdGNoZXJbXSA9IFtdO1xuXHRcdGlmIChjb25maWcgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHsgdmFsdWU6IHJlc3VsdCB9O1xuXHRcdH1cblx0XHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdFx0ZnVuY3Rpb24gYWRkUmVzdWx0KG1hdGNoZXI6IFRhc2tDb25maWd1cmF0aW9uVmFsdWVXaXRoRXJyb3JzPFByb2JsZW1NYXRjaGVyPikge1xuXHRcdFx0aWYgKG1hdGNoZXIudmFsdWUpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2gobWF0Y2hlci52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAobWF0Y2hlci5lcnJvcnMpIHtcblx0XHRcdFx0ZXJyb3JzLnB1c2goLi4ubWF0Y2hlci5lcnJvcnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBraW5kID0gZ2V0UHJvYmxlbU1hdGNoZXJLaW5kKGNvbmZpZyk7XG5cdFx0aWYgKGtpbmQgPT09IFByb2JsZW1NYXRjaGVyS2luZC5Vbmtub3duKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J0NvbmZpZ3VyYXRpb25QYXJzZXIudW5rbm93bk1hdGNoZXJLaW5kJyxcblx0XHRcdFx0J1dhcm5pbmc6IHRoZSBkZWZpbmVkIHByb2JsZW0gbWF0Y2hlciBpcyB1bmtub3duLiBTdXBwb3J0ZWQgdHlwZXMgYXJlIHN0cmluZyB8IFByb2JsZW1NYXRjaGVyIHwgQXJyYXk8c3RyaW5nIHwgUHJvYmxlbU1hdGNoZXI+LlxcbnswfVxcbicsXG5cdFx0XHRcdEpTT04uc3RyaW5naWZ5KGNvbmZpZywgbnVsbCwgNCkpO1xuXHRcdFx0Y29udGV4dC5wcm9ibGVtUmVwb3J0ZXIud2FybihlcnJvcik7XG5cdFx0fSBlbHNlIGlmIChraW5kID09PSBQcm9ibGVtTWF0Y2hlcktpbmQuU3RyaW5nIHx8IGtpbmQgPT09IFByb2JsZW1NYXRjaGVyS2luZC5Qcm9ibGVtTWF0Y2hlcikge1xuXHRcdFx0YWRkUmVzdWx0KHJlc29sdmVQcm9ibGVtTWF0Y2hlcihjb25maWcgYXMgUHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXIsIGNvbnRleHQpKTtcblx0XHR9IGVsc2UgaWYgKGtpbmQgPT09IFByb2JsZW1NYXRjaGVyS2luZC5BcnJheSkge1xuXHRcdFx0Y29uc3QgcHJvYmxlbU1hdGNoZXJzID0gPChzdHJpbmcgfCBQcm9ibGVtTWF0Y2hlckNvbmZpZy5Qcm9ibGVtTWF0Y2hlcilbXT5jb25maWc7XG5cdFx0XHRwcm9ibGVtTWF0Y2hlcnMuZm9yRWFjaChwcm9ibGVtTWF0Y2hlciA9PiB7XG5cdFx0XHRcdGFkZFJlc3VsdChyZXNvbHZlUHJvYmxlbU1hdGNoZXIocHJvYmxlbU1hdGNoZXIsIGNvbnRleHQpKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4geyB2YWx1ZTogcmVzdWx0LCBlcnJvcnMgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFByb2JsZW1NYXRjaGVyS2luZCh0aGlzOiB2b2lkLCB2YWx1ZTogUHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXJUeXBlKTogUHJvYmxlbU1hdGNoZXJLaW5kIHtcblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcodmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gUHJvYmxlbU1hdGNoZXJLaW5kLlN0cmluZztcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gUHJvYmxlbU1hdGNoZXJLaW5kLkFycmF5O1xuXHRcdH0gZWxzZSBpZiAoIVR5cGVzLmlzVW5kZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIFByb2JsZW1NYXRjaGVyS2luZC5Qcm9ibGVtTWF0Y2hlcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIFByb2JsZW1NYXRjaGVyS2luZC5Vbmtub3duO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlc29sdmVQcm9ibGVtTWF0Y2hlcih0aGlzOiB2b2lkLCB2YWx1ZTogc3RyaW5nIHwgUHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXIsIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBUYXNrQ29uZmlndXJhdGlvblZhbHVlV2l0aEVycm9yczxQcm9ibGVtTWF0Y2hlcj4ge1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyh2YWx1ZSkpIHtcblx0XHRcdGxldCB2YXJpYWJsZU5hbWUgPSA8c3RyaW5nPnZhbHVlO1xuXHRcdFx0aWYgKHZhcmlhYmxlTmFtZS5sZW5ndGggPiAxICYmIHZhcmlhYmxlTmFtZVswXSA9PT0gJyQnKSB7XG5cdFx0XHRcdHZhcmlhYmxlTmFtZSA9IHZhcmlhYmxlTmFtZS5zdWJzdHJpbmcoMSk7XG5cdFx0XHRcdGNvbnN0IGdsb2JhbCA9IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkuZ2V0KHZhcmlhYmxlTmFtZSk7XG5cdFx0XHRcdGlmIChnbG9iYWwpIHtcblx0XHRcdFx0XHRyZXR1cm4geyB2YWx1ZTogT2JqZWN0cy5kZWVwQ2xvbmUoZ2xvYmFsKSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCBsb2NhbFByb2JsZW1NYXRjaGVyOiBQcm9ibGVtTWF0Y2hlciAmIFBhcnRpYWw8SU5hbWVkUHJvYmxlbU1hdGNoZXI+ID0gY29udGV4dC5uYW1lZFByb2JsZW1NYXRjaGVyc1t2YXJpYWJsZU5hbWVdO1xuXHRcdFx0XHRpZiAobG9jYWxQcm9ibGVtTWF0Y2hlcikge1xuXHRcdFx0XHRcdGxvY2FsUHJvYmxlbU1hdGNoZXIgPSBPYmplY3RzLmRlZXBDbG9uZShsb2NhbFByb2JsZW1NYXRjaGVyKTtcblx0XHRcdFx0XHQvLyByZW1vdmUgdGhlIG5hbWVcblx0XHRcdFx0XHRkZWxldGUgbG9jYWxQcm9ibGVtTWF0Y2hlci5uYW1lO1xuXHRcdFx0XHRcdHJldHVybiB7IHZhbHVlOiBsb2NhbFByb2JsZW1NYXRjaGVyIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB7IGVycm9yczogW25scy5sb2NhbGl6ZSgnQ29uZmlndXJhdGlvblBhcnNlci5pbnZhbGlkVmFyaWFibGVSZWZlcmVuY2UnLCAnRXJyb3I6IEludmFsaWQgcHJvYmxlbU1hdGNoZXIgcmVmZXJlbmNlOiB7MH1cXG4nLCB2YWx1ZSldIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGpzb24gPSA8UHJvYmxlbU1hdGNoZXJDb25maWcuUHJvYmxlbU1hdGNoZXI+dmFsdWU7XG5cdFx0XHRyZXR1cm4geyB2YWx1ZTogbmV3IFByb2JsZW1NYXRjaGVyUGFyc2VyKGNvbnRleHQucHJvYmxlbVJlcG9ydGVyKS5wYXJzZShqc29uKSB9O1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIEdyb3VwS2luZCB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHRoaXM6IHZvaWQsIGV4dGVybmFsOiBzdHJpbmcgfCBJR3JvdXBLaW5kIHwgdW5kZWZpbmVkKTogVGFza3MuVGFza0dyb3VwIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoZXh0ZXJuYWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKFR5cGVzLmlzU3RyaW5nKGV4dGVybmFsKSAmJiBUYXNrcy5UYXNrR3JvdXAuaXMoZXh0ZXJuYWwpKSB7XG5cdFx0XHRyZXR1cm4geyBfaWQ6IGV4dGVybmFsLCBpc0RlZmF1bHQ6IGZhbHNlIH07XG5cdFx0fSBlbHNlIGlmIChUeXBlcy5pc1N0cmluZyhleHRlcm5hbC5raW5kKSAmJiBUYXNrcy5UYXNrR3JvdXAuaXMoZXh0ZXJuYWwua2luZCkpIHtcblx0XHRcdGNvbnN0IGdyb3VwOiBzdHJpbmcgPSBleHRlcm5hbC5raW5kO1xuXHRcdFx0Y29uc3QgaXNEZWZhdWx0OiBib29sZWFuIHwgc3RyaW5nID0gVHlwZXMuaXNVbmRlZmluZWQoZXh0ZXJuYWwuaXNEZWZhdWx0KSA/IGZhbHNlIDogZXh0ZXJuYWwuaXNEZWZhdWx0O1xuXG5cdFx0XHRyZXR1cm4geyBfaWQ6IGdyb3VwLCBpc0RlZmF1bHQgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiB0byhncm91cDogVGFza3MuVGFza0dyb3VwIHwgc3RyaW5nKTogSUdyb3VwS2luZCB8IHN0cmluZyB7XG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGdyb3VwKSkge1xuXHRcdFx0cmV0dXJuIGdyb3VwO1xuXHRcdH0gZWxzZSBpZiAoIWdyb3VwLmlzRGVmYXVsdCkge1xuXHRcdFx0cmV0dXJuIGdyb3VwLl9pZDtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGtpbmQ6IGdyb3VwLl9pZCxcblx0XHRcdGlzRGVmYXVsdDogZ3JvdXAuaXNEZWZhdWx0LFxuXHRcdH07XG5cdH1cbn1cblxubmFtZXNwYWNlIFRhc2tEZXBlbmRlbmN5IHtcblx0ZnVuY3Rpb24gdXJpRnJvbVNvdXJjZShjb250ZXh0OiBJUGFyc2VDb250ZXh0LCBzb3VyY2U6IFRhc2tDb25maWdTb3VyY2UpOiBVUkkgfCBzdHJpbmcge1xuXHRcdHN3aXRjaCAoc291cmNlKSB7XG5cdFx0XHRjYXNlIFRhc2tDb25maWdTb3VyY2UuVXNlcjogcmV0dXJuIFRhc2tzLlVTRVJfVEFTS1NfR1JPVVBfS0VZO1xuXHRcdFx0Y2FzZSBUYXNrQ29uZmlnU291cmNlLlRhc2tzSnNvbjogcmV0dXJuIGNvbnRleHQud29ya3NwYWNlRm9sZGVyLnVyaTtcblx0XHRcdGRlZmF1bHQ6IHJldHVybiBjb250ZXh0LndvcmtzcGFjZSAmJiBjb250ZXh0LndvcmtzcGFjZS5jb25maWd1cmF0aW9uID8gY29udGV4dC53b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA6IGNvbnRleHQud29ya3NwYWNlRm9sZGVyLnVyaTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh0aGlzOiB2b2lkLCBleHRlcm5hbDogc3RyaW5nIHwgSVRhc2tJZGVudGlmaWVyLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0LCBzb3VyY2U6IFRhc2tDb25maWdTb3VyY2UpOiBUYXNrcy5JVGFza0RlcGVuZGVuY3kgfCB1bmRlZmluZWQge1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyhleHRlcm5hbCkpIHtcblx0XHRcdHJldHVybiB7IHVyaTogdXJpRnJvbVNvdXJjZShjb250ZXh0LCBzb3VyY2UpLCB0YXNrOiBleHRlcm5hbCB9O1xuXHRcdH0gZWxzZSBpZiAoSVRhc2tJZGVudGlmaWVyLmlzKGV4dGVybmFsKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dXJpOiB1cmlGcm9tU291cmNlKGNvbnRleHQsIHNvdXJjZSksXG5cdFx0XHRcdHRhc2s6IFRhc2tzLlRhc2tEZWZpbml0aW9uLmNyZWF0ZVRhc2tJZGVudGlmaWVyKGV4dGVybmFsIGFzIFRhc2tzLklUYXNrSWRlbnRpZmllciwgY29udGV4dC5wcm9ibGVtUmVwb3J0ZXIpXG5cdFx0XHR9O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuXG5uYW1lc3BhY2UgRGVwZW5kc09yZGVyIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20ob3JkZXI6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFRhc2tzLkRlcGVuZHNPcmRlciB7XG5cdFx0c3dpdGNoIChvcmRlcikge1xuXHRcdFx0Y2FzZSBUYXNrcy5EZXBlbmRzT3JkZXIuc2VxdWVuY2U6XG5cdFx0XHRcdHJldHVybiBUYXNrcy5EZXBlbmRzT3JkZXIuc2VxdWVuY2U7XG5cdFx0XHRjYXNlIFRhc2tzLkRlcGVuZHNPcmRlci5wYXJhbGxlbDpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBUYXNrcy5EZXBlbmRzT3JkZXIucGFyYWxsZWw7XG5cdFx0fVxuXHR9XG59XG5cbm5hbWVzcGFjZSBDb25maWd1cmF0aW9uUHJvcGVydGllcyB7XG5cblx0Y29uc3QgcHJvcGVydGllczogSU1ldGFEYXRhPFRhc2tzLklDb25maWd1cmF0aW9uUHJvcGVydGllcywgYW55PltdID0gW1xuXHRcdHsgcHJvcGVydHk6ICduYW1lJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdpZGVudGlmaWVyJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdncm91cCcgfSxcblx0XHR7IHByb3BlcnR5OiAnaXNCYWNrZ3JvdW5kJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdwcm9tcHRPbkNsb3NlJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdkZXBlbmRzT24nIH0sXG5cdFx0eyBwcm9wZXJ0eTogJ3ByZXNlbnRhdGlvbicsIHR5cGU6IENvbW1hbmRDb25maWd1cmF0aW9uLlByZXNlbnRhdGlvbk9wdGlvbnMgfSxcblx0XHR7IHByb3BlcnR5OiAncHJvYmxlbU1hdGNoZXJzJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdvcHRpb25zJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdpY29uJyB9LFxuXHRcdHsgcHJvcGVydHk6ICdoaWRlJyB9XG5cdF07XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGhpczogdm9pZCwgZXh0ZXJuYWw6IElDb25maWd1cmF0aW9uUHJvcGVydGllcyAmIHsgW2tleTogc3RyaW5nXTogYW55IH0sIGNvbnRleHQ6IElQYXJzZUNvbnRleHQsXG5cdFx0aW5jbHVkZUNvbW1hbmRPcHRpb25zOiBib29sZWFuLCBzb3VyY2U6IFRhc2tDb25maWdTb3VyY2UsIHByb3BlcnRpZXM/OiBJSlNPTlNjaGVtYU1hcCk6IFRhc2tDb25maWd1cmF0aW9uVmFsdWVXaXRoRXJyb3JzPFRhc2tzLklDb25maWd1cmF0aW9uUHJvcGVydGllcz4ge1xuXHRcdGlmICghZXh0ZXJuYWwpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBUYXNrcy5JQ29uZmlndXJhdGlvblByb3BlcnRpZXMgJiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XG5cblx0XHRpZiAocHJvcGVydGllcykge1xuXHRcdFx0Zm9yIChjb25zdCBwcm9wZXJ0eU5hbWUgb2YgT2JqZWN0LmtleXMocHJvcGVydGllcykpIHtcblx0XHRcdFx0aWYgKGV4dGVybmFsW3Byb3BlcnR5TmFtZV0gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3VsdFtwcm9wZXJ0eU5hbWVdID0gT2JqZWN0cy5kZWVwQ2xvbmUoZXh0ZXJuYWxbcHJvcGVydHlOYW1lXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcoZXh0ZXJuYWwudGFza05hbWUpKSB7XG5cdFx0XHRyZXN1bHQubmFtZSA9IGV4dGVybmFsLnRhc2tOYW1lO1xuXHRcdH1cblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcoZXh0ZXJuYWwubGFiZWwpICYmIGNvbnRleHQuc2NoZW1hVmVyc2lvbiA9PT0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wKSB7XG5cdFx0XHRyZXN1bHQubmFtZSA9IGV4dGVybmFsLmxhYmVsO1xuXHRcdH1cblx0XHRpZiAoVHlwZXMuaXNTdHJpbmcoZXh0ZXJuYWwuaWRlbnRpZmllcikpIHtcblx0XHRcdHJlc3VsdC5pZGVudGlmaWVyID0gZXh0ZXJuYWwuaWRlbnRpZmllcjtcblx0XHR9XG5cdFx0cmVzdWx0Lmljb24gPSBleHRlcm5hbC5pY29uO1xuXHRcdHJlc3VsdC5oaWRlID0gZXh0ZXJuYWwuaGlkZTtcblx0XHRpZiAoZXh0ZXJuYWwuaXNCYWNrZ3JvdW5kICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc3VsdC5pc0JhY2tncm91bmQgPSAhIWV4dGVybmFsLmlzQmFja2dyb3VuZDtcblx0XHR9XG5cdFx0aWYgKGV4dGVybmFsLnByb21wdE9uQ2xvc2UgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0LnByb21wdE9uQ2xvc2UgPSAhIWV4dGVybmFsLnByb21wdE9uQ2xvc2U7XG5cdFx0fVxuXHRcdHJlc3VsdC5ncm91cCA9IEdyb3VwS2luZC5mcm9tKGV4dGVybmFsLmdyb3VwKTtcblx0XHRpZiAoZXh0ZXJuYWwuZGVwZW5kc09uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGV4dGVybmFsLmRlcGVuZHNPbikpIHtcblx0XHRcdFx0cmVzdWx0LmRlcGVuZHNPbiA9IGV4dGVybmFsLmRlcGVuZHNPbi5yZWR1Y2UoKGRlcGVuZGVuY2llczogVGFza3MuSVRhc2tEZXBlbmRlbmN5W10sIGl0ZW0pOiBUYXNrcy5JVGFza0RlcGVuZGVuY3lbXSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZGVwZW5kZW5jeSA9IFRhc2tEZXBlbmRlbmN5LmZyb20oaXRlbSwgY29udGV4dCwgc291cmNlKTtcblx0XHRcdFx0XHRpZiAoZGVwZW5kZW5jeSkge1xuXHRcdFx0XHRcdFx0ZGVwZW5kZW5jaWVzLnB1c2goZGVwZW5kZW5jeSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBkZXBlbmRlbmNpZXM7XG5cdFx0XHRcdH0sIFtdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGRlcGVuZHNPblZhbHVlID0gVGFza0RlcGVuZGVuY3kuZnJvbShleHRlcm5hbC5kZXBlbmRzT24sIGNvbnRleHQsIHNvdXJjZSk7XG5cdFx0XHRcdHJlc3VsdC5kZXBlbmRzT24gPSBkZXBlbmRzT25WYWx1ZSA/IFtkZXBlbmRzT25WYWx1ZV0gOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJlc3VsdC5kZXBlbmRzT3JkZXIgPSBEZXBlbmRzT3JkZXIuZnJvbShleHRlcm5hbC5kZXBlbmRzT3JkZXIpO1xuXHRcdGlmIChpbmNsdWRlQ29tbWFuZE9wdGlvbnMgJiYgKGV4dGVybmFsLnByZXNlbnRhdGlvbiAhPT0gdW5kZWZpbmVkIHx8IChleHRlcm5hbCBhcyBJTGVnYWN5Q29tbWFuZFByb3BlcnRpZXMpLnRlcm1pbmFsICE9PSB1bmRlZmluZWQpKSB7XG5cdFx0XHRyZXN1bHQucHJlc2VudGF0aW9uID0gQ29tbWFuZENvbmZpZ3VyYXRpb24uUHJlc2VudGF0aW9uT3B0aW9ucy5mcm9tKGV4dGVybmFsLCBjb250ZXh0KTtcblx0XHR9XG5cdFx0aWYgKGluY2x1ZGVDb21tYW5kT3B0aW9ucyAmJiAoZXh0ZXJuYWwub3B0aW9ucyAhPT0gdW5kZWZpbmVkKSkge1xuXHRcdFx0cmVzdWx0Lm9wdGlvbnMgPSBDb21tYW5kT3B0aW9ucy5mcm9tKGV4dGVybmFsLm9wdGlvbnMsIGNvbnRleHQpO1xuXHRcdH1cblx0XHRjb25zdCBjb25maWdQcm9ibGVtTWF0Y2hlciA9IFByb2JsZW1NYXRjaGVyQ29udmVydGVyLmZyb21XaXRoT3NDb25maWcoZXh0ZXJuYWwsIGNvbnRleHQpO1xuXHRcdGlmIChjb25maWdQcm9ibGVtTWF0Y2hlci52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQucHJvYmxlbU1hdGNoZXJzID0gY29uZmlnUHJvYmxlbU1hdGNoZXIudmFsdWU7XG5cdFx0fVxuXHRcdGlmIChleHRlcm5hbC5kZXRhaWwpIHtcblx0XHRcdHJlc3VsdC5kZXRhaWwgPSBleHRlcm5hbC5kZXRhaWw7XG5cdFx0fVxuXHRcdHJldHVybiBpc0VtcHR5KHJlc3VsdCkgPyB7fSA6IHsgdmFsdWU6IHJlc3VsdCwgZXJyb3JzOiBjb25maWdQcm9ibGVtTWF0Y2hlci5lcnJvcnMgfTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KHRoaXM6IHZvaWQsIHZhbHVlOiBUYXNrcy5JQ29uZmlndXJhdGlvblByb3BlcnRpZXMpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gX2lzRW1wdHkodmFsdWUsIHByb3BlcnRpZXMpO1xuXHR9XG59XG5jb25zdCBsYWJlbCA9ICdXb3Jrc3BhY2UnO1xuXG5uYW1lc3BhY2UgQ29uZmlndXJpbmdUYXNrIHtcblxuXHRjb25zdCBncnVudCA9ICdncnVudC4nO1xuXHRjb25zdCBqYWtlID0gJ2pha2UuJztcblx0Y29uc3QgZ3VscCA9ICdndWxwLic7XG5cdGNvbnN0IG5wbSA9ICd2c2NvZGUubnBtLic7XG5cdGNvbnN0IHR5cGVzY3JpcHQgPSAndnNjb2RlLnR5cGVzY3JpcHQuJztcblxuXHRpbnRlcmZhY2UgSUN1c3RvbWl6ZVNoYXBlIHtcblx0XHRjdXN0b21pemU6IHN0cmluZztcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKHRoaXM6IHZvaWQsIGV4dGVybmFsOiBJQ29uZmlndXJpbmdUYXNrLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0LCBpbmRleDogbnVtYmVyLCBzb3VyY2U6IFRhc2tDb25maWdTb3VyY2UsIHJlZ2lzdHJ5PzogUGFydGlhbDxJVGFza0RlZmluaXRpb25SZWdpc3RyeT4pOiBUYXNrcy5Db25maWd1cmluZ1Rhc2sgfCB1bmRlZmluZWQge1xuXHRcdGlmICghZXh0ZXJuYWwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHR5cGUgPSBleHRlcm5hbC50eXBlO1xuXHRcdGNvbnN0IGN1c3RvbWl6ZSA9IChleHRlcm5hbCBhcyBJQ3VzdG9taXplU2hhcGUpLmN1c3RvbWl6ZTtcblx0XHRpZiAoIXR5cGUgJiYgIWN1c3RvbWl6ZSkge1xuXHRcdFx0Y29udGV4dC5wcm9ibGVtUmVwb3J0ZXIuZXJyb3IobmxzLmxvY2FsaXplKCdDb25maWd1cmF0aW9uUGFyc2VyLm5vVGFza1R5cGUnLCAnRXJyb3I6IHRhc2tzIGNvbmZpZ3VyYXRpb24gbXVzdCBoYXZlIGEgdHlwZSBwcm9wZXJ0eS4gVGhlIGNvbmZpZ3VyYXRpb24gd2lsbCBiZSBpZ25vcmVkLlxcbnswfVxcbicsIEpTT04uc3RyaW5naWZ5KGV4dGVybmFsLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgdHlwZURlY2xhcmF0aW9uID0gdHlwZSA/IHJlZ2lzdHJ5Py5nZXQ/Lih0eXBlKSB8fCBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmdldCh0eXBlKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoIXR5cGVEZWNsYXJhdGlvbikge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnQ29uZmlndXJhdGlvblBhcnNlci5ub1R5cGVEZWZpbml0aW9uJywgJ0Vycm9yOiB0aGVyZSBpcyBubyByZWdpc3RlcmVkIHRhc2sgdHlwZSBcXCd7MH1cXCcuIERpZCB5b3UgbWlzcyBpbnN0YWxsaW5nIGFuIGV4dGVuc2lvbiB0aGF0IHByb3ZpZGVzIGEgY29ycmVzcG9uZGluZyB0YXNrIHByb3ZpZGVyPycsIHR5cGUpO1xuXHRcdFx0Y29udGV4dC5wcm9ibGVtUmVwb3J0ZXIuZXJyb3IobWVzc2FnZSk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgaWRlbnRpZmllcjogVGFza3MuSVRhc2tJZGVudGlmaWVyIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChUeXBlcy5pc1N0cmluZyhjdXN0b21pemUpKSB7XG5cdFx0XHRpZiAoY3VzdG9taXplLmluZGV4T2YoZ3J1bnQpID09PSAwKSB7XG5cdFx0XHRcdGlkZW50aWZpZXIgPSB7IHR5cGU6ICdncnVudCcsIHRhc2s6IGN1c3RvbWl6ZS5zdWJzdHJpbmcoZ3J1bnQubGVuZ3RoKSB9O1xuXHRcdFx0fSBlbHNlIGlmIChjdXN0b21pemUuaW5kZXhPZihqYWtlKSA9PT0gMCkge1xuXHRcdFx0XHRpZGVudGlmaWVyID0geyB0eXBlOiAnamFrZScsIHRhc2s6IGN1c3RvbWl6ZS5zdWJzdHJpbmcoamFrZS5sZW5ndGgpIH07XG5cdFx0XHR9IGVsc2UgaWYgKGN1c3RvbWl6ZS5pbmRleE9mKGd1bHApID09PSAwKSB7XG5cdFx0XHRcdGlkZW50aWZpZXIgPSB7IHR5cGU6ICdndWxwJywgdGFzazogY3VzdG9taXplLnN1YnN0cmluZyhndWxwLmxlbmd0aCkgfTtcblx0XHRcdH0gZWxzZSBpZiAoY3VzdG9taXplLmluZGV4T2YobnBtKSA9PT0gMCkge1xuXHRcdFx0XHRpZGVudGlmaWVyID0geyB0eXBlOiAnbnBtJywgc2NyaXB0OiBjdXN0b21pemUuc3Vic3RyaW5nKG5wbS5sZW5ndGggKyA0KSB9O1xuXHRcdFx0fSBlbHNlIGlmIChjdXN0b21pemUuaW5kZXhPZih0eXBlc2NyaXB0KSA9PT0gMCkge1xuXHRcdFx0XHRpZGVudGlmaWVyID0geyB0eXBlOiAndHlwZXNjcmlwdCcsIHRzY29uZmlnOiBjdXN0b21pemUuc3Vic3RyaW5nKHR5cGVzY3JpcHQubGVuZ3RoICsgNikgfTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGV4dGVybmFsLnR5cGUpKSB7XG5cdFx0XHRcdGlkZW50aWZpZXIgPSBleHRlcm5hbCBhcyBUYXNrcy5JVGFza0lkZW50aWZpZXI7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChpZGVudGlmaWVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnRleHQucHJvYmxlbVJlcG9ydGVyLmVycm9yKG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J0NvbmZpZ3VyYXRpb25QYXJzZXIubWlzc2luZ1R5cGUnLFxuXHRcdFx0XHQnRXJyb3I6IHRoZSB0YXNrIGNvbmZpZ3VyYXRpb24gXFwnezB9XFwnIGlzIG1pc3NpbmcgdGhlIHJlcXVpcmVkIHByb3BlcnR5IFxcJ3R5cGVcXCcuIFRoZSB0YXNrIGNvbmZpZ3VyYXRpb24gd2lsbCBiZSBpZ25vcmVkLicsIEpTT04uc3RyaW5naWZ5KGV4dGVybmFsLCB1bmRlZmluZWQsIDApXG5cdFx0XHQpKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHRhc2tJZGVudGlmaWVyOiBUYXNrcy5LZXllZFRhc2tJZGVudGlmaWVyIHwgdW5kZWZpbmVkID0gVGFza3MuVGFza0RlZmluaXRpb24uY3JlYXRlVGFza0lkZW50aWZpZXIoaWRlbnRpZmllciwgY29udGV4dC5wcm9ibGVtUmVwb3J0ZXIpO1xuXHRcdGlmICh0YXNrSWRlbnRpZmllciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci5lcnJvcihubHMubG9jYWxpemUoXG5cdFx0XHRcdCdDb25maWd1cmF0aW9uUGFyc2VyLmluY29ycmVjdFR5cGUnLFxuXHRcdFx0XHQnRXJyb3I6IHRoZSB0YXNrIGNvbmZpZ3VyYXRpb24gXFwnezB9XFwnIGlzIHVzaW5nIGFuIHVua25vd24gdHlwZS4gVGhlIHRhc2sgY29uZmlndXJhdGlvbiB3aWxsIGJlIGlnbm9yZWQuJywgSlNPTi5zdHJpbmdpZnkoZXh0ZXJuYWwsIHVuZGVmaW5lZCwgMClcblx0XHRcdCkpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgY29uZmlnRWxlbWVudDogVGFza3MuSVRhc2tTb3VyY2VDb25maWdFbGVtZW50ID0ge1xuXHRcdFx0d29ya3NwYWNlRm9sZGVyOiBjb250ZXh0LndvcmtzcGFjZUZvbGRlcixcblx0XHRcdGZpbGU6ICcudnNjb2RlL3Rhc2tzLmpzb24nLFxuXHRcdFx0aW5kZXgsXG5cdFx0XHRlbGVtZW50OiBleHRlcm5hbFxuXHRcdH07XG5cdFx0bGV0IHRhc2tTb3VyY2U6IFRhc2tzLkZpbGVCYXNlZFRhc2tTb3VyY2U7XG5cdFx0c3dpdGNoIChzb3VyY2UpIHtcblx0XHRcdGNhc2UgVGFza0NvbmZpZ1NvdXJjZS5Vc2VyOiB7XG5cdFx0XHRcdHRhc2tTb3VyY2UgPSB7IGtpbmQ6IFRhc2tzLlRhc2tTb3VyY2VLaW5kLlVzZXIsIGNvbmZpZzogY29uZmlnRWxlbWVudCwgbGFiZWwgfTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFRhc2tDb25maWdTb3VyY2UuV29ya3NwYWNlRmlsZToge1xuXHRcdFx0XHR0YXNrU291cmNlID0geyBraW5kOiBUYXNrcy5UYXNrU291cmNlS2luZC5Xb3Jrc3BhY2VGaWxlLCBjb25maWc6IGNvbmZpZ0VsZW1lbnQsIGxhYmVsIH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHR0YXNrU291cmNlID0geyBraW5kOiBUYXNrcy5UYXNrU291cmNlS2luZC5Xb3Jrc3BhY2UsIGNvbmZpZzogY29uZmlnRWxlbWVudCwgbGFiZWwgfTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdDogVGFza3MuQ29uZmlndXJpbmdUYXNrID0gbmV3IFRhc2tzLkNvbmZpZ3VyaW5nVGFzayhcblx0XHRcdGAke3R5cGVEZWNsYXJhdGlvbi5leHRlbnNpb25JZH0uJHt0YXNrSWRlbnRpZmllci5fa2V5fWAsXG5cdFx0XHR0YXNrU291cmNlLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dHlwZSxcblx0XHRcdHRhc2tJZGVudGlmaWVyLFxuXHRcdFx0UnVuT3B0aW9ucy5mcm9tQ29uZmlndXJhdGlvbihleHRlcm5hbC5ydW5PcHRpb25zKSxcblx0XHRcdHsgaGlkZTogZXh0ZXJuYWwuaGlkZSB9XG5cdFx0KTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gQ29uZmlndXJhdGlvblByb3BlcnRpZXMuZnJvbShleHRlcm5hbCwgY29udGV4dCwgdHJ1ZSwgc291cmNlLCB0eXBlRGVjbGFyYXRpb24ucHJvcGVydGllcyk7XG5cdFx0cmVzdWx0LmFkZFRhc2tMb2FkTWVzc2FnZXMoY29uZmlndXJhdGlvbi5lcnJvcnMpO1xuXHRcdGlmIChjb25maWd1cmF0aW9uLnZhbHVlKSB7XG5cdFx0XHRyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMgPSBPYmplY3QuYXNzaWduKHJlc3VsdC5jb25maWd1cmF0aW9uUHJvcGVydGllcywgY29uZmlndXJhdGlvbi52YWx1ZSk7XG5cdFx0XHRpZiAocmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUpIHtcblx0XHRcdFx0cmVzdWx0Ll9sYWJlbCA9IHJlc3VsdC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IGxhYmVsID0gcmVzdWx0LmNvbmZpZ3VyZXMudHlwZTtcblx0XHRcdFx0aWYgKHR5cGVEZWNsYXJhdGlvbi5yZXF1aXJlZCAmJiB0eXBlRGVjbGFyYXRpb24ucmVxdWlyZWQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgcmVxdWlyZWQgb2YgdHlwZURlY2xhcmF0aW9uLnJlcXVpcmVkKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IHJlc3VsdC5jb25maWd1cmVzW3JlcXVpcmVkXTtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRsYWJlbCA9IGxhYmVsICsgJzogJyArIHZhbHVlO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzdWx0Ll9sYWJlbCA9IGxhYmVsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWRlbnRpZmllcikge1xuXHRcdFx0XHRyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWRlbnRpZmllciA9IHRhc2tJZGVudGlmaWVyLl9rZXk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxubmFtZXNwYWNlIEN1c3RvbVRhc2sge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbSh0aGlzOiB2b2lkLCBleHRlcm5hbDogSUN1c3RvbVRhc2ssIGNvbnRleHQ6IElQYXJzZUNvbnRleHQsIGluZGV4OiBudW1iZXIsIHNvdXJjZTogVGFza0NvbmZpZ1NvdXJjZSk6IFRhc2tzLkN1c3RvbVRhc2sgfCB1bmRlZmluZWQge1xuXHRcdGlmICghZXh0ZXJuYWwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCB0eXBlID0gZXh0ZXJuYWwudHlwZTtcblx0XHRpZiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGUgPT09IG51bGwpIHtcblx0XHRcdHR5cGUgPSBUYXNrcy5DVVNUT01JWkVEX1RBU0tfVFlQRTtcblx0XHR9XG5cdFx0aWYgKHR5cGUgIT09IFRhc2tzLkNVU1RPTUlaRURfVEFTS19UWVBFICYmIHR5cGUgIT09ICdzaGVsbCcgJiYgdHlwZSAhPT0gJ3Byb2Nlc3MnKSB7XG5cdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci5lcnJvcihubHMubG9jYWxpemUoJ0NvbmZpZ3VyYXRpb25QYXJzZXIubm90Q3VzdG9tJywgJ0Vycm9yOiB0YXNrcyBpcyBub3QgZGVjbGFyZWQgYXMgYSBjdXN0b20gdGFzay4gVGhlIGNvbmZpZ3VyYXRpb24gd2lsbCBiZSBpZ25vcmVkLlxcbnswfVxcbicsIEpTT04uc3RyaW5naWZ5KGV4dGVybmFsLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IHRhc2tOYW1lID0gZXh0ZXJuYWwudGFza05hbWU7XG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGV4dGVybmFsLmxhYmVsKSAmJiBjb250ZXh0LnNjaGVtYVZlcnNpb24gPT09IFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMCkge1xuXHRcdFx0dGFza05hbWUgPSBleHRlcm5hbC5sYWJlbDtcblx0XHR9XG5cdFx0aWYgKCF0YXNrTmFtZSkge1xuXHRcdFx0Y29udGV4dC5wcm9ibGVtUmVwb3J0ZXIuZXJyb3IobmxzLmxvY2FsaXplKCdDb25maWd1cmF0aW9uUGFyc2VyLm5vVGFza05hbWUnLCAnRXJyb3I6IGEgdGFzayBtdXN0IHByb3ZpZGUgYSBsYWJlbCBwcm9wZXJ0eS4gVGhlIHRhc2sgd2lsbCBiZSBpZ25vcmVkLlxcbnswfVxcbicsIEpTT04uc3RyaW5naWZ5KGV4dGVybmFsLCBudWxsLCA0KSkpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgdGFza1NvdXJjZTogVGFza3MuRmlsZUJhc2VkVGFza1NvdXJjZTtcblx0XHRzd2l0Y2ggKHNvdXJjZSkge1xuXHRcdFx0Y2FzZSBUYXNrQ29uZmlnU291cmNlLlVzZXI6IHtcblx0XHRcdFx0dGFza1NvdXJjZSA9IHsga2luZDogVGFza3MuVGFza1NvdXJjZUtpbmQuVXNlciwgY29uZmlnOiB7IGluZGV4LCBlbGVtZW50OiBleHRlcm5hbCwgZmlsZTogJy52c2NvZGUvdGFza3MuanNvbicsIHdvcmtzcGFjZUZvbGRlcjogY29udGV4dC53b3Jrc3BhY2VGb2xkZXIgfSwgbGFiZWwgfTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFRhc2tDb25maWdTb3VyY2UuV29ya3NwYWNlRmlsZToge1xuXHRcdFx0XHR0YXNrU291cmNlID0geyBraW5kOiBUYXNrcy5UYXNrU291cmNlS2luZC5Xb3Jrc3BhY2VGaWxlLCBjb25maWc6IHsgaW5kZXgsIGVsZW1lbnQ6IGV4dGVybmFsLCBmaWxlOiAnLnZzY29kZS90YXNrcy5qc29uJywgd29ya3NwYWNlRm9sZGVyOiBjb250ZXh0LndvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlOiBjb250ZXh0LndvcmtzcGFjZSB9LCBsYWJlbCB9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0dGFza1NvdXJjZSA9IHsga2luZDogVGFza3MuVGFza1NvdXJjZUtpbmQuV29ya3NwYWNlLCBjb25maWc6IHsgaW5kZXgsIGVsZW1lbnQ6IGV4dGVybmFsLCBmaWxlOiAnLnZzY29kZS90YXNrcy5qc29uJywgd29ya3NwYWNlRm9sZGVyOiBjb250ZXh0LndvcmtzcGFjZUZvbGRlciB9LCBsYWJlbCB9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IFRhc2tzLkN1c3RvbVRhc2sgPSBuZXcgVGFza3MuQ3VzdG9tVGFzayhcblx0XHRcdGNvbnRleHQudXVpZE1hcC5nZXRVVUlEKHRhc2tOYW1lKSxcblx0XHRcdHRhc2tTb3VyY2UsXG5cdFx0XHR0YXNrTmFtZSxcblx0XHRcdFRhc2tzLkNVU1RPTUlaRURfVEFTS19UWVBFLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRSdW5PcHRpb25zLmZyb21Db25maWd1cmF0aW9uKGV4dGVybmFsLnJ1bk9wdGlvbnMpLFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiB0YXNrTmFtZSxcblx0XHRcdFx0aWRlbnRpZmllcjogdGFza05hbWUsXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gQ29uZmlndXJhdGlvblByb3BlcnRpZXMuZnJvbShleHRlcm5hbCwgY29udGV4dCwgZmFsc2UsIHNvdXJjZSk7XG5cdFx0cmVzdWx0LmFkZFRhc2tMb2FkTWVzc2FnZXMoY29uZmlndXJhdGlvbi5lcnJvcnMpO1xuXHRcdGlmIChjb25maWd1cmF0aW9uLnZhbHVlKSB7XG5cdFx0XHRyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMgPSBPYmplY3QuYXNzaWduKHJlc3VsdC5jb25maWd1cmF0aW9uUHJvcGVydGllcywgY29uZmlndXJhdGlvbi52YWx1ZSk7XG5cdFx0fVxuXHRcdGNvbnN0IHN1cHBvcnRMZWdhY3k6IGJvb2xlYW4gPSB0cnVlOyAvL2NvbnRleHQuc2NoZW1hVmVyc2lvbiA9PT0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wO1xuXHRcdGlmIChzdXBwb3J0TGVnYWN5KSB7XG5cdFx0XHRjb25zdCBsZWdhY3k6IElMZWdhY3lUYXNrUHJvcGVydGllcyA9IGV4dGVybmFsIGFzIElMZWdhY3lUYXNrUHJvcGVydGllcztcblx0XHRcdGlmIChyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID09PSB1bmRlZmluZWQgJiYgbGVnYWN5LmlzV2F0Y2hpbmcgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID0gISFsZWdhY3kuaXNXYXRjaGluZztcblx0XHRcdH1cblx0XHRcdGlmIChyZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAobGVnYWN5LmlzQnVpbGRDb21tYW5kID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwID0gVGFza3MuVGFza0dyb3VwLkJ1aWxkO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGxlZ2FjeS5pc1Rlc3RDb21tYW5kID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwID0gVGFza3MuVGFza0dyb3VwLlRlc3Q7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgY29tbWFuZDogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uID0gQ29tbWFuZENvbmZpZ3VyYXRpb24uZnJvbShleHRlcm5hbCwgY29udGV4dCkhO1xuXHRcdGlmIChjb21tYW5kKSB7XG5cdFx0XHRyZXN1bHQuY29tbWFuZCA9IGNvbW1hbmQ7XG5cdFx0fVxuXHRcdGlmIChleHRlcm5hbC5jb21tYW5kICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIGlmIHRoZSB0YXNrIGhhcyBpdHMgb3duIGNvbW1hbmQgdGhlbiB3ZSBzdXBwcmVzcyB0aGVcblx0XHRcdC8vIHRhc2sgbmFtZSBieSBkZWZhdWx0LlxuXHRcdFx0Y29tbWFuZC5zdXBwcmVzc1Rhc2tOYW1lID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmaWxsR2xvYmFscyh0YXNrOiBUYXNrcy5DdXN0b21UYXNrLCBnbG9iYWxzOiBJR2xvYmFscyk6IHZvaWQge1xuXHRcdC8vIFdlIG9ubHkgbWVyZ2UgYSBjb21tYW5kIGZyb20gYSBnbG9iYWwgZGVmaW5pdGlvbiBpZiB0aGVyZSBpcyBubyBkZXBlbmRzT25cblx0XHQvLyBvciB0aGVyZSBpcyBhIGRlcGVuZHNPbiBhbmQgYSBkZWZpbmVkIGNvbW1hbmQuXG5cdFx0aWYgKENvbW1hbmRDb25maWd1cmF0aW9uLmhhc0NvbW1hbmQodGFzay5jb21tYW5kKSB8fCB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmRlcGVuZHNPbiA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0YXNrLmNvbW1hbmQgPSBDb21tYW5kQ29uZmlndXJhdGlvbi5maWxsR2xvYmFscyh0YXNrLmNvbW1hbmQsIGdsb2JhbHMuY29tbWFuZCwgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lKTtcblx0XHR9XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzID09PSB1bmRlZmluZWQgJiYgZ2xvYmFscy5wcm9ibGVtTWF0Y2hlciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyA9IE9iamVjdHMuZGVlcENsb25lKGdsb2JhbHMucHJvYmxlbU1hdGNoZXIpO1xuXHRcdFx0dGFzay5oYXNEZWZpbmVkTWF0Y2hlcnMgPSB0cnVlO1xuXHRcdH1cblx0XHQvLyBwcm9tcHRPbkNsb3NlIGlzIGluZmVycmVkIGZyb20gaXNCYWNrZ3JvdW5kIGlmIGF2YWlsYWJsZVxuXHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb21wdE9uQ2xvc2UgPT09IHVuZGVmaW5lZCAmJiB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCA9PT0gdW5kZWZpbmVkICYmIGdsb2JhbHMucHJvbXB0T25DbG9zZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb21wdE9uQ2xvc2UgPSBnbG9iYWxzLnByb21wdE9uQ2xvc2U7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZpbGxEZWZhdWx0cyh0YXNrOiBUYXNrcy5DdXN0b21UYXNrLCBjb250ZXh0OiBJUGFyc2VDb250ZXh0KTogdm9pZCB7XG5cdFx0Q29tbWFuZENvbmZpZ3VyYXRpb24uZmlsbERlZmF1bHRzKHRhc2suY29tbWFuZCwgY29udGV4dCk7XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvbXB0T25DbG9zZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb21wdE9uQ2xvc2UgPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCAhPT0gdW5kZWZpbmVkID8gIXRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kIDogdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kID0gZmFsc2U7XG5cdFx0fVxuXHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyA9IEVNUFRZX0FSUkFZO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDdXN0b21UYXNrKGNvbnRyaWJ1dGVkVGFzazogVGFza3MuQ29udHJpYnV0ZWRUYXNrLCBjb25maWd1cmVkUHJvcHM6IFRhc2tzLkNvbmZpZ3VyaW5nVGFzayB8IFRhc2tzLkN1c3RvbVRhc2spOiBUYXNrcy5DdXN0b21UYXNrIHtcblx0XHRjb25zdCByZXN1bHQ6IFRhc2tzLkN1c3RvbVRhc2sgPSBuZXcgVGFza3MuQ3VzdG9tVGFzayhcblx0XHRcdGNvbmZpZ3VyZWRQcm9wcy5faWQsXG5cdFx0XHRPYmplY3QuYXNzaWduKHt9LCBjb25maWd1cmVkUHJvcHMuX3NvdXJjZSwgeyBjdXN0b21pemVzOiBjb250cmlidXRlZFRhc2suZGVmaW5lcyB9KSxcblx0XHRcdGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lIHx8IGNvbnRyaWJ1dGVkVGFzay5fbGFiZWwsXG5cdFx0XHRUYXNrcy5DVVNUT01JWkVEX1RBU0tfVFlQRSxcblx0XHRcdGNvbnRyaWJ1dGVkVGFzay5jb21tYW5kLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRjb250cmlidXRlZFRhc2sucnVuT3B0aW9ucyxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogY29uZmlndXJlZFByb3BzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUgfHwgY29udHJpYnV0ZWRUYXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUsXG5cdFx0XHRcdGlkZW50aWZpZXI6IGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyIHx8IGNvbnRyaWJ1dGVkVGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pZGVudGlmaWVyLFxuXHRcdFx0XHRpY29uOiBjb25maWd1cmVkUHJvcHMuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbixcblx0XHRcdFx0aGlkZTogY29uZmlndXJlZFByb3BzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmhpZGVcblx0XHRcdH0sXG5cblx0XHQpO1xuXHRcdHJlc3VsdC5hZGRUYXNrTG9hZE1lc3NhZ2VzKGNvbmZpZ3VyZWRQcm9wcy50YXNrTG9hZE1lc3NhZ2VzKTtcblx0XHRjb25zdCByZXN1bHRDb25maWdQcm9wczogVGFza3MuSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gcmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzO1xuXG5cdFx0YXNzaWduUHJvcGVydHkocmVzdWx0Q29uZmlnUHJvcHMsIGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcywgJ2dyb3VwJyk7XG5cdFx0YXNzaWduUHJvcGVydHkocmVzdWx0Q29uZmlnUHJvcHMsIGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcywgJ2lzQmFja2dyb3VuZCcpO1xuXHRcdGFzc2lnblByb3BlcnR5KHJlc3VsdENvbmZpZ1Byb3BzLCBjb25maWd1cmVkUHJvcHMuY29uZmlndXJhdGlvblByb3BlcnRpZXMsICdkZXBlbmRzT24nKTtcblx0XHRhc3NpZ25Qcm9wZXJ0eShyZXN1bHRDb25maWdQcm9wcywgY29uZmlndXJlZFByb3BzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLCAncHJvYmxlbU1hdGNoZXJzJyk7XG5cdFx0YXNzaWduUHJvcGVydHkocmVzdWx0Q29uZmlnUHJvcHMsIGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcywgJ3Byb21wdE9uQ2xvc2UnKTtcblx0XHRhc3NpZ25Qcm9wZXJ0eShyZXN1bHRDb25maWdQcm9wcywgY29uZmlndXJlZFByb3BzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLCAnZGV0YWlsJyk7XG5cdFx0cmVzdWx0LmNvbW1hbmQucHJlc2VudGF0aW9uID0gQ29tbWFuZENvbmZpZ3VyYXRpb24uUHJlc2VudGF0aW9uT3B0aW9ucy5hc3NpZ25Qcm9wZXJ0aWVzKFxuXHRcdFx0cmVzdWx0LmNvbW1hbmQucHJlc2VudGF0aW9uISwgY29uZmlndXJlZFByb3BzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByZXNlbnRhdGlvbikhO1xuXHRcdHJlc3VsdC5jb21tYW5kLm9wdGlvbnMgPSBDb21tYW5kT3B0aW9ucy5hc3NpZ25Qcm9wZXJ0aWVzKHJlc3VsdC5jb21tYW5kLm9wdGlvbnMsIGNvbmZpZ3VyZWRQcm9wcy5jb25maWd1cmF0aW9uUHJvcGVydGllcy5vcHRpb25zKTtcblx0XHRyZXN1bHQucnVuT3B0aW9ucyA9IFJ1bk9wdGlvbnMuYXNzaWduUHJvcGVydGllcyhyZXN1bHQucnVuT3B0aW9ucywgY29uZmlndXJlZFByb3BzLnJ1bk9wdGlvbnMpO1xuXG5cdFx0Y29uc3QgY29udHJpYnV0ZWRDb25maWdQcm9wczogVGFza3MuSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gY29udHJpYnV0ZWRUYXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzO1xuXHRcdGZpbGxQcm9wZXJ0eShyZXN1bHRDb25maWdQcm9wcywgY29udHJpYnV0ZWRDb25maWdQcm9wcywgJ2dyb3VwJyk7XG5cdFx0ZmlsbFByb3BlcnR5KHJlc3VsdENvbmZpZ1Byb3BzLCBjb250cmlidXRlZENvbmZpZ1Byb3BzLCAnaXNCYWNrZ3JvdW5kJyk7XG5cdFx0ZmlsbFByb3BlcnR5KHJlc3VsdENvbmZpZ1Byb3BzLCBjb250cmlidXRlZENvbmZpZ1Byb3BzLCAnZGVwZW5kc09uJyk7XG5cdFx0ZmlsbFByb3BlcnR5KHJlc3VsdENvbmZpZ1Byb3BzLCBjb250cmlidXRlZENvbmZpZ1Byb3BzLCAncHJvYmxlbU1hdGNoZXJzJyk7XG5cdFx0ZmlsbFByb3BlcnR5KHJlc3VsdENvbmZpZ1Byb3BzLCBjb250cmlidXRlZENvbmZpZ1Byb3BzLCAncHJvbXB0T25DbG9zZScpO1xuXHRcdGZpbGxQcm9wZXJ0eShyZXN1bHRDb25maWdQcm9wcywgY29udHJpYnV0ZWRDb25maWdQcm9wcywgJ2RldGFpbCcpO1xuXHRcdHJlc3VsdC5jb21tYW5kLnByZXNlbnRhdGlvbiA9IENvbW1hbmRDb25maWd1cmF0aW9uLlByZXNlbnRhdGlvbk9wdGlvbnMuZmlsbFByb3BlcnRpZXMoXG5cdFx0XHRyZXN1bHQuY29tbWFuZC5wcmVzZW50YXRpb24sIGNvbnRyaWJ1dGVkQ29uZmlnUHJvcHMucHJlc2VudGF0aW9uKSE7XG5cdFx0cmVzdWx0LmNvbW1hbmQub3B0aW9ucyA9IENvbW1hbmRPcHRpb25zLmZpbGxQcm9wZXJ0aWVzKHJlc3VsdC5jb21tYW5kLm9wdGlvbnMsIGNvbnRyaWJ1dGVkQ29uZmlnUHJvcHMub3B0aW9ucyk7XG5cdFx0cmVzdWx0LnJ1bk9wdGlvbnMgPSBSdW5PcHRpb25zLmZpbGxQcm9wZXJ0aWVzKHJlc3VsdC5ydW5PcHRpb25zLCBjb250cmlidXRlZFRhc2sucnVuT3B0aW9ucyk7XG5cblx0XHRpZiAoY29udHJpYnV0ZWRUYXNrLmhhc0RlZmluZWRNYXRjaGVycyA9PT0gdHJ1ZSkge1xuXHRcdFx0cmVzdWx0Lmhhc0RlZmluZWRNYXRjaGVycyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUYXNrUGFyc2VSZXN1bHQge1xuXHRjdXN0b206IFRhc2tzLkN1c3RvbVRhc2tbXTtcblx0Y29uZmlndXJlZDogVGFza3MuQ29uZmlndXJpbmdUYXNrW107XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgVGFza1BhcnNlciB7XG5cblx0ZnVuY3Rpb24gaXNDdXN0b21UYXNrKHZhbHVlOiBJQ3VzdG9tVGFzayB8IElDb25maWd1cmluZ1Rhc2spOiB2YWx1ZSBpcyBJQ3VzdG9tVGFzayB7XG5cdFx0Y29uc3QgdHlwZSA9IHZhbHVlLnR5cGU7XG5cdFx0Y29uc3QgY3VzdG9taXplID0gKHZhbHVlIGFzIGFueSkuY3VzdG9taXplO1xuXHRcdHJldHVybiBjdXN0b21pemUgPT09IHVuZGVmaW5lZCAmJiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGUgPT09IG51bGwgfHwgdHlwZSA9PT0gVGFza3MuQ1VTVE9NSVpFRF9UQVNLX1RZUEUgfHwgdHlwZSA9PT0gJ3NoZWxsJyB8fCB0eXBlID09PSAncHJvY2VzcycpO1xuXHR9XG5cblx0Y29uc3QgYnVpbHRpblR5cGVDb250ZXh0TWFwOiBJU3RyaW5nRGljdGlvbmFyeTxSYXdDb250ZXh0S2V5PGJvb2xlYW4+PiA9IHtcblx0XHRzaGVsbDogU2hlbGxFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0LFxuXHRcdHByb2Nlc3M6IFByb2Nlc3NFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG5cdH07XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGZyb20odGhpczogdm9pZCwgZXh0ZXJuYWxzOiBBcnJheTxJQ3VzdG9tVGFzayB8IElDb25maWd1cmluZ1Rhc2s+IHwgdW5kZWZpbmVkLCBnbG9iYWxzOiBJR2xvYmFscywgY29udGV4dDogSVBhcnNlQ29udGV4dCwgc291cmNlOiBUYXNrQ29uZmlnU291cmNlLCByZWdpc3RyeT86IFBhcnRpYWw8SVRhc2tEZWZpbml0aW9uUmVnaXN0cnk+KTogSVRhc2tQYXJzZVJlc3VsdCB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJVGFza1BhcnNlUmVzdWx0ID0geyBjdXN0b206IFtdLCBjb25maWd1cmVkOiBbXSB9O1xuXHRcdGlmICghZXh0ZXJuYWxzKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRjb25zdCBkZWZhdWx0QnVpbGRUYXNrOiB7IHRhc2s6IFRhc2tzLlRhc2sgfCB1bmRlZmluZWQ7IHJhbms6IG51bWJlciB9ID0geyB0YXNrOiB1bmRlZmluZWQsIHJhbms6IC0xIH07XG5cdFx0Y29uc3QgZGVmYXVsdFRlc3RUYXNrOiB7IHRhc2s6IFRhc2tzLlRhc2sgfCB1bmRlZmluZWQ7IHJhbms6IG51bWJlciB9ID0geyB0YXNrOiB1bmRlZmluZWQsIHJhbms6IC0xIH07XG5cdFx0Y29uc3Qgc2NoZW1hMl8wXzA6IGJvb2xlYW4gPSBjb250ZXh0LnNjaGVtYVZlcnNpb24gPT09IFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMDtcblx0XHRjb25zdCBiYXNlTG9hZElzc3VlcyA9IE9iamVjdHMuZGVlcENsb25lKGNvbnRleHQudGFza0xvYWRJc3N1ZXMpO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBleHRlcm5hbHMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBleHRlcm5hbCA9IGV4dGVybmFsc1tpbmRleF07XG5cdFx0XHRjb25zdCBkZWZpbml0aW9uID0gZXh0ZXJuYWwudHlwZSA/IHJlZ2lzdHJ5Py5nZXQ/LihleHRlcm5hbC50eXBlKSB8fCBUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmdldChleHRlcm5hbC50eXBlKSA6IHVuZGVmaW5lZDtcblx0XHRcdGxldCB0eXBlTm90U3VwcG9ydGVkOiBib29sZWFuID0gZmFsc2U7XG5cdFx0XHRpZiAoZGVmaW5pdGlvbiAmJiBkZWZpbml0aW9uLndoZW4gJiYgIWNvbnRleHQuY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhkZWZpbml0aW9uLndoZW4pKSB7XG5cdFx0XHRcdHR5cGVOb3RTdXBwb3J0ZWQgPSB0cnVlO1xuXHRcdFx0fSBlbHNlIGlmICghZGVmaW5pdGlvbiAmJiBleHRlcm5hbC50eXBlKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGJ1aWx0aW5UeXBlQ29udGV4dE1hcCkpIHtcblx0XHRcdFx0XHRpZiAoZXh0ZXJuYWwudHlwZSA9PT0ga2V5KSB7XG5cdFx0XHRcdFx0XHR0eXBlTm90U3VwcG9ydGVkID0gIVNoZWxsRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dC5ldmFsdWF0ZShjb250ZXh0LmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHQobnVsbCkpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0eXBlTm90U3VwcG9ydGVkKSB7XG5cdFx0XHRcdGNvbnRleHQucHJvYmxlbVJlcG9ydGVyLmluZm8obmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdCd0YXNrQ29uZmlndXJhdGlvbi5wcm92aWRlclVuYXZhaWxhYmxlJywgJ1dhcm5pbmc6IHswfSB0YXNrcyBhcmUgdW5hdmFpbGFibGUgaW4gdGhlIGN1cnJlbnQgZW52aXJvbm1lbnQuXFxuJyxcblx0XHRcdFx0XHRleHRlcm5hbC50eXBlXG5cdFx0XHRcdCkpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzQ3VzdG9tVGFzayhleHRlcm5hbCkpIHtcblx0XHRcdFx0Y29uc3QgY3VzdG9tVGFzayA9IEN1c3RvbVRhc2suZnJvbShleHRlcm5hbCwgY29udGV4dCwgaW5kZXgsIHNvdXJjZSk7XG5cdFx0XHRcdGlmIChjdXN0b21UYXNrKSB7XG5cdFx0XHRcdFx0Q3VzdG9tVGFzay5maWxsR2xvYmFscyhjdXN0b21UYXNrLCBnbG9iYWxzKTtcblx0XHRcdFx0XHRDdXN0b21UYXNrLmZpbGxEZWZhdWx0cyhjdXN0b21UYXNrLCBjb250ZXh0KTtcblx0XHRcdFx0XHRpZiAoc2NoZW1hMl8wXzApIHtcblx0XHRcdFx0XHRcdGlmICgoY3VzdG9tVGFzay5jb21tYW5kID09PSB1bmRlZmluZWQgfHwgY3VzdG9tVGFzay5jb21tYW5kLm5hbWUgPT09IHVuZGVmaW5lZCkgJiYgKGN1c3RvbVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGVwZW5kc09uID09PSB1bmRlZmluZWQgfHwgY3VzdG9tVGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5kZXBlbmRzT24ubGVuZ3RoID09PSAwKSkge1xuXHRcdFx0XHRcdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci5lcnJvcihubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdFx0J3Rhc2tDb25maWd1cmF0aW9uLm5vQ29tbWFuZE9yRGVwZW5kc09uJywgJ0Vycm9yOiB0aGUgdGFzayBcXCd7MH1cXCcgbmVpdGhlciBzcGVjaWZpZXMgYSBjb21tYW5kIG5vciBhIGRlcGVuZHNPbiBwcm9wZXJ0eS4gVGhlIHRhc2sgd2lsbCBiZSBpZ25vcmVkLiBJdHMgZGVmaW5pdGlvbiBpczpcXG57MX0nLFxuXHRcdFx0XHRcdFx0XHRcdGN1c3RvbVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSwgSlNPTi5zdHJpbmdpZnkoZXh0ZXJuYWwsIHVuZGVmaW5lZCwgNClcblx0XHRcdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoY3VzdG9tVGFzay5jb21tYW5kID09PSB1bmRlZmluZWQgfHwgY3VzdG9tVGFzay5jb21tYW5kLm5hbWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci53YXJuKG5scy5sb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0XHQndGFza0NvbmZpZ3VyYXRpb24ubm9Db21tYW5kJywgJ0Vycm9yOiB0aGUgdGFzayBcXCd7MH1cXCcgZG9lc25cXCd0IGRlZmluZSBhIGNvbW1hbmQuIFRoZSB0YXNrIHdpbGwgYmUgaWdub3JlZC4gSXRzIGRlZmluaXRpb24gaXM6XFxuezF9Jyxcblx0XHRcdFx0XHRcdFx0XHRjdXN0b21UYXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUsIEpTT04uc3RyaW5naWZ5KGV4dGVybmFsLCB1bmRlZmluZWQsIDQpXG5cdFx0XHRcdFx0XHRcdCkpO1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGN1c3RvbVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgPT09IFRhc2tzLlRhc2tHcm91cC5CdWlsZCAmJiBkZWZhdWx0QnVpbGRUYXNrLnJhbmsgPCAyKSB7XG5cdFx0XHRcdFx0XHRkZWZhdWx0QnVpbGRUYXNrLnRhc2sgPSBjdXN0b21UYXNrO1xuXHRcdFx0XHRcdFx0ZGVmYXVsdEJ1aWxkVGFzay5yYW5rID0gMjtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGN1c3RvbVRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgPT09IFRhc2tzLlRhc2tHcm91cC5UZXN0ICYmIGRlZmF1bHRUZXN0VGFzay5yYW5rIDwgMikge1xuXHRcdFx0XHRcdFx0ZGVmYXVsdFRlc3RUYXNrLnRhc2sgPSBjdXN0b21UYXNrO1xuXHRcdFx0XHRcdFx0ZGVmYXVsdFRlc3RUYXNrLnJhbmsgPSAyO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoY3VzdG9tVGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lID09PSAnYnVpbGQnICYmIGRlZmF1bHRCdWlsZFRhc2sucmFuayA8IDEpIHtcblx0XHRcdFx0XHRcdGRlZmF1bHRCdWlsZFRhc2sudGFzayA9IGN1c3RvbVRhc2s7XG5cdFx0XHRcdFx0XHRkZWZhdWx0QnVpbGRUYXNrLnJhbmsgPSAxO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoY3VzdG9tVGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lID09PSAndGVzdCcgJiYgZGVmYXVsdFRlc3RUYXNrLnJhbmsgPCAxKSB7XG5cdFx0XHRcdFx0XHRkZWZhdWx0VGVzdFRhc2sudGFzayA9IGN1c3RvbVRhc2s7XG5cdFx0XHRcdFx0XHRkZWZhdWx0VGVzdFRhc2sucmFuayA9IDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGN1c3RvbVRhc2suYWRkVGFza0xvYWRNZXNzYWdlcyhjb250ZXh0LnRhc2tMb2FkSXNzdWVzKTtcblx0XHRcdFx0XHRyZXN1bHQuY3VzdG9tLnB1c2goY3VzdG9tVGFzayk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZ3VyZWRUYXNrID0gQ29uZmlndXJpbmdUYXNrLmZyb20oZXh0ZXJuYWwsIGNvbnRleHQsIGluZGV4LCBzb3VyY2UsIHJlZ2lzdHJ5KTtcblx0XHRcdFx0aWYgKGNvbmZpZ3VyZWRUYXNrKSB7XG5cdFx0XHRcdFx0Y29uZmlndXJlZFRhc2suYWRkVGFza0xvYWRNZXNzYWdlcyhjb250ZXh0LnRhc2tMb2FkSXNzdWVzKTtcblx0XHRcdFx0XHRyZXN1bHQuY29uZmlndXJlZC5wdXNoKGNvbmZpZ3VyZWRUYXNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29udGV4dC50YXNrTG9hZElzc3VlcyA9IE9iamVjdHMuZGVlcENsb25lKGJhc2VMb2FkSXNzdWVzKTtcblx0XHR9XG5cdFx0Ly8gVGhlcmUgaXMgc29tZSBzcGVjaWFsIGxvZ2ljIGZvciB0YXNrcyB3aXRoIHRoZSBsYWJlbHMgXCJidWlsZFwiIGFuZCBcInRlc3RcIi5cblx0XHQvLyBFdmVuIGlmIHRoZXkgYXJlIG5vdCBtYXJrZWQgYXMgYSB0YXNrIGdyb3VwIEJ1aWxkIG9yIFRlc3QsIHdlIGF1dG9tYWdpY2FsbHkgZ3JvdXAgdGhlbSBhcyBzdWNoLlxuXHRcdC8vIEhvd2V2ZXIsIGlmIHRoZXkgYXJlIGFscmVhZHkgZ3JvdXBlZCBhcyBCdWlsZCBvciBUZXN0LCB3ZSBkb24ndCBuZWVkIHRvIGFkZCB0aGlzIGdyb3VwaW5nLlxuXHRcdGNvbnN0IGRlZmF1bHRCdWlsZEdyb3VwTmFtZSA9IFR5cGVzLmlzU3RyaW5nKGRlZmF1bHRCdWlsZFRhc2sudGFzaz8uY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXApID8gZGVmYXVsdEJ1aWxkVGFzay50YXNrPy5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCA6IGRlZmF1bHRCdWlsZFRhc2sudGFzaz8uY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXA/Ll9pZDtcblx0XHRjb25zdCBkZWZhdWx0VGVzdFRhc2tHcm91cE5hbWUgPSBUeXBlcy5pc1N0cmluZyhkZWZhdWx0VGVzdFRhc2sudGFzaz8uY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXApID8gZGVmYXVsdFRlc3RUYXNrLnRhc2s/LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwIDogZGVmYXVsdFRlc3RUYXNrLnRhc2s/LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwPy5faWQ7XG5cdFx0aWYgKChkZWZhdWx0QnVpbGRHcm91cE5hbWUgIT09IFRhc2tzLlRhc2tHcm91cC5CdWlsZC5faWQpICYmIChkZWZhdWx0QnVpbGRUYXNrLnJhbmsgPiAtMSkgJiYgKGRlZmF1bHRCdWlsZFRhc2sucmFuayA8IDIpICYmIGRlZmF1bHRCdWlsZFRhc2sudGFzaykge1xuXHRcdFx0ZGVmYXVsdEJ1aWxkVGFzay50YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwID0gVGFza3MuVGFza0dyb3VwLkJ1aWxkO1xuXHRcdH0gZWxzZSBpZiAoKGRlZmF1bHRUZXN0VGFza0dyb3VwTmFtZSAhPT0gVGFza3MuVGFza0dyb3VwLlRlc3QuX2lkKSAmJiAoZGVmYXVsdFRlc3RUYXNrLnJhbmsgPiAtMSkgJiYgKGRlZmF1bHRUZXN0VGFzay5yYW5rIDwgMikgJiYgZGVmYXVsdFRlc3RUYXNrLnRhc2spIHtcblx0XHRcdGRlZmF1bHRUZXN0VGFzay50YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwID0gVGFza3MuVGFza0dyb3VwLlRlc3Q7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBhc3NpZ25UYXNrcyh0YXJnZXQ6IFRhc2tzLkN1c3RvbVRhc2tbXSwgc291cmNlOiBUYXNrcy5DdXN0b21UYXNrW10pOiBUYXNrcy5DdXN0b21UYXNrW10ge1xuXHRcdGlmIChzb3VyY2UgPT09IHVuZGVmaW5lZCB8fCBzb3VyY2UubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdGFyZ2V0O1xuXHRcdH1cblx0XHRpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQgfHwgdGFyZ2V0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHNvdXJjZTtcblx0XHR9XG5cblx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHQvLyBUYXNrcyBhcmUga2V5ZWQgYnkgSUQgYnV0IHdlIG5lZWQgdG8gbWVyZ2UgYnkgbmFtZVxuXHRcdFx0Y29uc3QgbWFwOiBJU3RyaW5nRGljdGlvbmFyeTxUYXNrcy5DdXN0b21UYXNrPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHR0YXJnZXQuZm9yRWFjaCgodGFzaykgPT4ge1xuXHRcdFx0XHRtYXBbdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lIV0gPSB0YXNrO1xuXHRcdFx0fSk7XG5cblx0XHRcdHNvdXJjZS5mb3JFYWNoKCh0YXNrKSA9PiB7XG5cdFx0XHRcdG1hcFt0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUhXSA9IHRhc2s7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IG5ld1RhcmdldDogVGFza3MuQ3VzdG9tVGFza1tdID0gW107XG5cdFx0XHR0YXJnZXQuZm9yRWFjaCh0YXNrID0+IHtcblx0XHRcdFx0bmV3VGFyZ2V0LnB1c2gobWFwW3Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSFdKTtcblx0XHRcdFx0ZGVsZXRlIG1hcFt0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUhXTtcblx0XHRcdH0pO1xuXHRcdFx0T2JqZWN0LmtleXMobWFwKS5mb3JFYWNoKGtleSA9PiBuZXdUYXJnZXQucHVzaChtYXBba2V5XSkpO1xuXHRcdFx0dGFyZ2V0ID0gbmV3VGFyZ2V0O1xuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUdsb2JhbHMge1xuXHRjb21tYW5kPzogVGFza3MuSUNvbW1hbmRDb25maWd1cmF0aW9uO1xuXHRwcm9ibGVtTWF0Y2hlcj86IFByb2JsZW1NYXRjaGVyW107XG5cdHByb21wdE9uQ2xvc2U/OiBib29sZWFuO1xuXHRzdXBwcmVzc1Rhc2tOYW1lPzogYm9vbGVhbjtcbn1cblxubmFtZXNwYWNlIEdsb2JhbHMge1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGNvbmZpZzogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24sIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBJR2xvYmFscyB7XG5cdFx0bGV0IHJlc3VsdCA9IGZyb21CYXNlKGNvbmZpZywgY29udGV4dCk7XG5cdFx0bGV0IG9zR2xvYmFsczogSUdsb2JhbHMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbmZpZy53aW5kb3dzICYmIGNvbnRleHQucGxhdGZvcm0gPT09IFBsYXRmb3JtLldpbmRvd3MpIHtcblx0XHRcdG9zR2xvYmFscyA9IGZyb21CYXNlKGNvbmZpZy53aW5kb3dzLCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZy5vc3ggJiYgY29udGV4dC5wbGF0Zm9ybSA9PT0gUGxhdGZvcm0uTWFjKSB7XG5cdFx0XHRvc0dsb2JhbHMgPSBmcm9tQmFzZShjb25maWcub3N4LCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGNvbmZpZy5saW51eCAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5MaW51eCkge1xuXHRcdFx0b3NHbG9iYWxzID0gZnJvbUJhc2UoY29uZmlnLmxpbnV4LCBjb250ZXh0KTtcblx0XHR9XG5cdFx0aWYgKG9zR2xvYmFscykge1xuXHRcdFx0cmVzdWx0ID0gR2xvYmFscy5hc3NpZ25Qcm9wZXJ0aWVzKHJlc3VsdCwgb3NHbG9iYWxzKTtcblx0XHR9XG5cdFx0Y29uc3QgY29tbWFuZCA9IENvbW1hbmRDb25maWd1cmF0aW9uLmZyb20oY29uZmlnLCBjb250ZXh0KTtcblx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0cmVzdWx0LmNvbW1hbmQgPSBjb21tYW5kO1xuXHRcdH1cblx0XHRHbG9iYWxzLmZpbGxEZWZhdWx0cyhyZXN1bHQsIGNvbnRleHQpO1xuXHRcdEdsb2JhbHMuZnJlZXplKHJlc3VsdCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tQmFzZSh0aGlzOiB2b2lkLCBjb25maWc6IElCYXNlVGFza1J1bm5lckNvbmZpZ3VyYXRpb24sIGNvbnRleHQ6IElQYXJzZUNvbnRleHQpOiBJR2xvYmFscyB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJR2xvYmFscyA9IHt9O1xuXHRcdGlmIChjb25maWcuc3VwcHJlc3NUYXNrTmFtZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQuc3VwcHJlc3NUYXNrTmFtZSA9ICEhY29uZmlnLnN1cHByZXNzVGFza05hbWU7XG5cdFx0fVxuXHRcdGlmIChjb25maWcucHJvbXB0T25DbG9zZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQucHJvbXB0T25DbG9zZSA9ICEhY29uZmlnLnByb21wdE9uQ2xvc2U7XG5cdFx0fVxuXHRcdGlmIChjb25maWcucHJvYmxlbU1hdGNoZXIpIHtcblx0XHRcdHJlc3VsdC5wcm9ibGVtTWF0Y2hlciA9IFByb2JsZW1NYXRjaGVyQ29udmVydGVyLmZyb20oY29uZmlnLnByb2JsZW1NYXRjaGVyLCBjb250ZXh0KS52YWx1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KHZhbHVlOiBJR2xvYmFscyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdmFsdWUgfHwgdmFsdWUuY29tbWFuZCA9PT0gdW5kZWZpbmVkICYmIHZhbHVlLnByb21wdE9uQ2xvc2UgPT09IHVuZGVmaW5lZCAmJiB2YWx1ZS5zdXBwcmVzc1Rhc2tOYW1lID09PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gYXNzaWduUHJvcGVydGllcyh0YXJnZXQ6IElHbG9iYWxzLCBzb3VyY2U6IElHbG9iYWxzKTogSUdsb2JhbHMge1xuXHRcdGlmIChpc0VtcHR5KHNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0YXJnZXQ7XG5cdFx0fVxuXHRcdGlmIChpc0VtcHR5KHRhcmdldCkpIHtcblx0XHRcdHJldHVybiBzb3VyY2U7XG5cdFx0fVxuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAncHJvbXB0T25DbG9zZScpO1xuXHRcdGFzc2lnblByb3BlcnR5KHRhcmdldCwgc291cmNlLCAnc3VwcHJlc3NUYXNrTmFtZScpO1xuXHRcdHJldHVybiB0YXJnZXQ7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZmlsbERlZmF1bHRzKHZhbHVlOiBJR2xvYmFscywgY29udGV4dDogSVBhcnNlQ29udGV4dCk6IHZvaWQge1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Q29tbWFuZENvbmZpZ3VyYXRpb24uZmlsbERlZmF1bHRzKHZhbHVlLmNvbW1hbmQsIGNvbnRleHQpO1xuXHRcdGlmICh2YWx1ZS5zdXBwcmVzc1Rhc2tOYW1lID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHZhbHVlLnN1cHByZXNzVGFza05hbWUgPSAoY29udGV4dC5zY2hlbWFWZXJzaW9uID09PSBUYXNrcy5Kc29uU2NoZW1hVmVyc2lvbi5WMl8wXzApO1xuXHRcdH1cblx0XHRpZiAodmFsdWUucHJvbXB0T25DbG9zZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR2YWx1ZS5wcm9tcHRPbkNsb3NlID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gZnJlZXplKHZhbHVlOiBJR2xvYmFscyk6IHZvaWQge1xuXHRcdE9iamVjdC5mcmVlemUodmFsdWUpO1xuXHRcdGlmICh2YWx1ZS5jb21tYW5kKSB7XG5cdFx0XHRDb21tYW5kQ29uZmlndXJhdGlvbi5mcmVlemUodmFsdWUuY29tbWFuZCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgRXhlY3V0aW9uRW5naW5lIHtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbShjb25maWc6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uKTogVGFza3MuRXhlY3V0aW9uRW5naW5lIHtcblx0XHRjb25zdCBydW5uZXIgPSBjb25maWcucnVubmVyIHx8IGNvbmZpZy5fcnVubmVyO1xuXHRcdGxldCByZXN1bHQ6IFRhc2tzLkV4ZWN1dGlvbkVuZ2luZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAocnVubmVyKSB7XG5cdFx0XHRzd2l0Y2ggKHJ1bm5lcikge1xuXHRcdFx0XHRjYXNlICd0ZXJtaW5hbCc6XG5cdFx0XHRcdFx0cmVzdWx0ID0gVGFza3MuRXhlY3V0aW9uRW5naW5lLlRlcm1pbmFsO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdwcm9jZXNzJzpcblx0XHRcdFx0XHRyZXN1bHQgPSBUYXNrcy5FeGVjdXRpb25FbmdpbmUuUHJvY2Vzcztcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgc2NoZW1hVmVyc2lvbiA9IEpzb25TY2hlbWFWZXJzaW9uLmZyb20oY29uZmlnKTtcblx0XHRpZiAoc2NoZW1hVmVyc2lvbiA9PT0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjBfMV8wKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0IHx8IFRhc2tzLkV4ZWN1dGlvbkVuZ2luZS5Qcm9jZXNzO1xuXHRcdH0gZWxzZSBpZiAoc2NoZW1hVmVyc2lvbiA9PT0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wKSB7XG5cdFx0XHRyZXR1cm4gVGFza3MuRXhlY3V0aW9uRW5naW5lLlRlcm1pbmFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Nob3VsZG5cXCd0IGhhcHBlbi4nKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBKc29uU2NoZW1hVmVyc2lvbiB7XG5cblx0Y29uc3QgX2RlZmF1bHQ6IFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uID0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wO1xuXG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tKGNvbmZpZzogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24pOiBUYXNrcy5Kc29uU2NoZW1hVmVyc2lvbiB7XG5cdFx0Y29uc3QgdmVyc2lvbiA9IGNvbmZpZy52ZXJzaW9uO1xuXHRcdGlmICghdmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIF9kZWZhdWx0O1xuXHRcdH1cblx0XHRzd2l0Y2ggKHZlcnNpb24pIHtcblx0XHRcdGNhc2UgJzAuMS4wJzpcblx0XHRcdFx0cmV0dXJuIFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uLlYwXzFfMDtcblx0XHRcdGNhc2UgJzIuMC4wJzpcblx0XHRcdFx0cmV0dXJuIFRhc2tzLkpzb25TY2hlbWFWZXJzaW9uLlYyXzBfMDtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBfZGVmYXVsdDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUGFyc2VSZXN1bHQge1xuXHR2YWxpZGF0aW9uU3RhdHVzOiBWYWxpZGF0aW9uU3RhdHVzO1xuXHRjdXN0b206IFRhc2tzLkN1c3RvbVRhc2tbXTtcblx0Y29uZmlndXJlZDogVGFza3MuQ29uZmlndXJpbmdUYXNrW107XG5cdGVuZ2luZTogVGFza3MuRXhlY3V0aW9uRW5naW5lO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcm9ibGVtUmVwb3J0ZXIgZXh0ZW5kcyBJUHJvYmxlbVJlcG9ydGVyQmFzZSB7XG59XG5cbmV4cG9ydCBjbGFzcyBVVUlETWFwIHtcblxuXHRwcml2YXRlIGxhc3Q6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZyB8IHN0cmluZ1tdPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50OiBJU3RyaW5nRGljdGlvbmFyeTxzdHJpbmcgfCBzdHJpbmdbXT47XG5cblx0Y29uc3RydWN0b3Iob3RoZXI/OiBVVUlETWFwKSB7XG5cdFx0dGhpcy5jdXJyZW50ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRpZiAob3RoZXIpIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG90aGVyLmN1cnJlbnQpKSB7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gb3RoZXIuY3VycmVudFtrZXldO1xuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdFx0XHR0aGlzLmN1cnJlbnRba2V5XSA9IHZhbHVlLnNsaWNlKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50W2tleV0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBzdGFydCgpOiB2b2lkIHtcblx0XHR0aGlzLmxhc3QgPSB0aGlzLmN1cnJlbnQ7XG5cdFx0dGhpcy5jdXJyZW50ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRVVUlEKGlkZW50aWZpZXI6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgbGFzdFZhbHVlID0gdGhpcy5sYXN0ID8gdGhpcy5sYXN0W2lkZW50aWZpZXJdIDogdW5kZWZpbmVkO1xuXHRcdGxldCByZXN1bHQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAobGFzdFZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGxhc3RWYWx1ZSkpIHtcblx0XHRcdFx0cmVzdWx0ID0gbGFzdFZhbHVlLnNoaWZ0KCk7XG5cdFx0XHRcdGlmIChsYXN0VmFsdWUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMubGFzdCFbaWRlbnRpZmllcl07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdCA9IGxhc3RWYWx1ZTtcblx0XHRcdFx0ZGVsZXRlIHRoaXMubGFzdCFbaWRlbnRpZmllcl07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmVzdWx0ID0gVVVJRC5nZW5lcmF0ZVV1aWQoKTtcblx0XHR9XG5cdFx0Y29uc3QgY3VycmVudFZhbHVlID0gdGhpcy5jdXJyZW50W2lkZW50aWZpZXJdO1xuXHRcdGlmIChjdXJyZW50VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5jdXJyZW50W2lkZW50aWZpZXJdID0gcmVzdWx0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50VmFsdWUpKSB7XG5cdFx0XHRcdGN1cnJlbnRWYWx1ZS5wdXNoKHJlc3VsdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBhcnJheVZhbHVlOiBzdHJpbmdbXSA9IFtjdXJyZW50VmFsdWVdO1xuXHRcdFx0XHRhcnJheVZhbHVlLnB1c2gocmVzdWx0KTtcblx0XHRcdFx0dGhpcy5jdXJyZW50W2lkZW50aWZpZXJdID0gYXJyYXlWYWx1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBmaW5pc2goKTogdm9pZCB7XG5cdFx0dGhpcy5sYXN0ID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBlbnVtIFRhc2tDb25maWdTb3VyY2Uge1xuXHRUYXNrc0pzb24sXG5cdFdvcmtzcGFjZUZpbGUsXG5cdFVzZXJcbn1cblxuY2xhc3MgQ29uZmlndXJhdGlvblBhcnNlciB7XG5cblx0cHJpdmF0ZSB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXI7XG5cdHByaXZhdGUgd29ya3NwYWNlOiBJV29ya3NwYWNlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByb2JsZW1SZXBvcnRlcjogSVByb2JsZW1SZXBvcnRlcjtcblx0cHJpdmF0ZSB1dWlkTWFwOiBVVUlETWFwO1xuXHRwcml2YXRlIHBsYXRmb3JtOiBQbGF0Zm9ybTtcblxuXHRjb25zdHJ1Y3Rvcih3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsIHdvcmtzcGFjZTogSVdvcmtzcGFjZSB8IHVuZGVmaW5lZCwgcGxhdGZvcm06IFBsYXRmb3JtLCBwcm9ibGVtUmVwb3J0ZXI6IElQcm9ibGVtUmVwb3J0ZXIsIHV1aWRNYXA6IFVVSURNYXApIHtcblx0XHR0aGlzLndvcmtzcGFjZUZvbGRlciA9IHdvcmtzcGFjZUZvbGRlcjtcblx0XHR0aGlzLndvcmtzcGFjZSA9IHdvcmtzcGFjZTtcblx0XHR0aGlzLnBsYXRmb3JtID0gcGxhdGZvcm07XG5cdFx0dGhpcy5wcm9ibGVtUmVwb3J0ZXIgPSBwcm9ibGVtUmVwb3J0ZXI7XG5cdFx0dGhpcy51dWlkTWFwID0gdXVpZE1hcDtcblx0fVxuXG5cdHB1YmxpYyBydW4oZmlsZUNvbmZpZzogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24sIHNvdXJjZTogVGFza0NvbmZpZ1NvdXJjZSwgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IElQYXJzZVJlc3VsdCB7XG5cdFx0Y29uc3QgZW5naW5lID0gRXhlY3V0aW9uRW5naW5lLmZyb20oZmlsZUNvbmZpZyk7XG5cdFx0Y29uc3Qgc2NoZW1hVmVyc2lvbiA9IEpzb25TY2hlbWFWZXJzaW9uLmZyb20oZmlsZUNvbmZpZyk7XG5cdFx0Y29uc3QgY29udGV4dDogSVBhcnNlQ29udGV4dCA9IHtcblx0XHRcdHdvcmtzcGFjZUZvbGRlcjogdGhpcy53b3Jrc3BhY2VGb2xkZXIsXG5cdFx0XHR3b3Jrc3BhY2U6IHRoaXMud29ya3NwYWNlLFxuXHRcdFx0cHJvYmxlbVJlcG9ydGVyOiB0aGlzLnByb2JsZW1SZXBvcnRlcixcblx0XHRcdHV1aWRNYXA6IHRoaXMudXVpZE1hcCxcblx0XHRcdG5hbWVkUHJvYmxlbU1hdGNoZXJzOiB7fSxcblx0XHRcdGVuZ2luZSxcblx0XHRcdHNjaGVtYVZlcnNpb24sXG5cdFx0XHRwbGF0Zm9ybTogdGhpcy5wbGF0Zm9ybSxcblx0XHRcdHRhc2tMb2FkSXNzdWVzOiBbXSxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlXG5cdFx0fTtcblx0XHRjb25zdCB0YXNrUGFyc2VSZXN1bHQgPSB0aGlzLmNyZWF0ZVRhc2tSdW5uZXJDb25maWd1cmF0aW9uKGZpbGVDb25maWcsIGNvbnRleHQsIHNvdXJjZSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHZhbGlkYXRpb25TdGF0dXM6IHRoaXMucHJvYmxlbVJlcG9ydGVyLnN0YXR1cyxcblx0XHRcdGN1c3RvbTogdGFza1BhcnNlUmVzdWx0LmN1c3RvbSxcblx0XHRcdGNvbmZpZ3VyZWQ6IHRhc2tQYXJzZVJlc3VsdC5jb25maWd1cmVkLFxuXHRcdFx0ZW5naW5lXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGFza1J1bm5lckNvbmZpZ3VyYXRpb24oZmlsZUNvbmZpZzogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24sIGNvbnRleHQ6IElQYXJzZUNvbnRleHQsIHNvdXJjZTogVGFza0NvbmZpZ1NvdXJjZSk6IElUYXNrUGFyc2VSZXN1bHQge1xuXHRcdGNvbnN0IGdsb2JhbHMgPSBHbG9iYWxzLmZyb20oZmlsZUNvbmZpZywgY29udGV4dCk7XG5cdFx0aWYgKHRoaXMucHJvYmxlbVJlcG9ydGVyLnN0YXR1cy5pc0ZhdGFsKCkpIHtcblx0XHRcdHJldHVybiB7IGN1c3RvbTogW10sIGNvbmZpZ3VyZWQ6IFtdIH07XG5cdFx0fVxuXHRcdGNvbnRleHQubmFtZWRQcm9ibGVtTWF0Y2hlcnMgPSBQcm9ibGVtTWF0Y2hlckNvbnZlcnRlci5uYW1lZEZyb20oZmlsZUNvbmZpZy5kZWNsYXJlcywgY29udGV4dCk7XG5cdFx0bGV0IGdsb2JhbFRhc2tzOiBUYXNrcy5DdXN0b21UYXNrW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGV4dGVybmFsR2xvYmFsVGFza3M6IEFycmF5PElDb25maWd1cmluZ1Rhc2sgfCBJQ3VzdG9tVGFzaz4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGZpbGVDb25maWcud2luZG93cyAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5XaW5kb3dzKSB7XG5cdFx0XHRnbG9iYWxUYXNrcyA9IFRhc2tQYXJzZXIuZnJvbShmaWxlQ29uZmlnLndpbmRvd3MudGFza3MsIGdsb2JhbHMsIGNvbnRleHQsIHNvdXJjZSkuY3VzdG9tO1xuXHRcdFx0ZXh0ZXJuYWxHbG9iYWxUYXNrcyA9IGZpbGVDb25maWcud2luZG93cy50YXNrcztcblx0XHR9IGVsc2UgaWYgKGZpbGVDb25maWcub3N4ICYmIGNvbnRleHQucGxhdGZvcm0gPT09IFBsYXRmb3JtLk1hYykge1xuXHRcdFx0Z2xvYmFsVGFza3MgPSBUYXNrUGFyc2VyLmZyb20oZmlsZUNvbmZpZy5vc3gudGFza3MsIGdsb2JhbHMsIGNvbnRleHQsIHNvdXJjZSkuY3VzdG9tO1xuXHRcdFx0ZXh0ZXJuYWxHbG9iYWxUYXNrcyA9IGZpbGVDb25maWcub3N4LnRhc2tzO1xuXHRcdH0gZWxzZSBpZiAoZmlsZUNvbmZpZy5saW51eCAmJiBjb250ZXh0LnBsYXRmb3JtID09PSBQbGF0Zm9ybS5MaW51eCkge1xuXHRcdFx0Z2xvYmFsVGFza3MgPSBUYXNrUGFyc2VyLmZyb20oZmlsZUNvbmZpZy5saW51eC50YXNrcywgZ2xvYmFscywgY29udGV4dCwgc291cmNlKS5jdXN0b207XG5cdFx0XHRleHRlcm5hbEdsb2JhbFRhc2tzID0gZmlsZUNvbmZpZy5saW51eC50YXNrcztcblx0XHR9XG5cdFx0aWYgKGNvbnRleHQuc2NoZW1hVmVyc2lvbiA9PT0gVGFza3MuSnNvblNjaGVtYVZlcnNpb24uVjJfMF8wICYmIGdsb2JhbFRhc2tzICYmIGdsb2JhbFRhc2tzLmxlbmd0aCA+IDAgJiYgZXh0ZXJuYWxHbG9iYWxUYXNrcyAmJiBleHRlcm5hbEdsb2JhbFRhc2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IHRhc2tDb250ZW50OiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIGV4dGVybmFsR2xvYmFsVGFza3MpIHtcblx0XHRcdFx0dGFza0NvbnRlbnQucHVzaChKU09OLnN0cmluZ2lmeSh0YXNrLCBudWxsLCA0KSk7XG5cdFx0XHR9XG5cdFx0XHRjb250ZXh0LnByb2JsZW1SZXBvcnRlci5lcnJvcihcblx0XHRcdFx0bmxzLmxvY2FsaXplKFxuXHRcdFx0XHRcdHsga2V5OiAnVGFza1BhcnNlLm5vT3NTcGVjaWZpY0dsb2JhbFRhc2tzJywgY29tbWVudDogWydcXFwiVGFzayB2ZXJzaW9uIDIuMC4wXFxcIiByZWZlcnMgdG8gdGhlIDIuMC4wIHZlcnNpb24gb2YgdGhlIHRhc2sgc3lzdGVtLiBUaGUgXFxcInZlcnNpb24gMi4wLjBcXFwiIGlzIG5vdCBsb2NhbGl6YWJsZSBhcyBpdCBpcyBhIGpzb24ga2V5IGFuZCB2YWx1ZS4nXSB9LFxuXHRcdFx0XHRcdCdUYXNrIHZlcnNpb24gMi4wLjAgZG9lc25cXCd0IHN1cHBvcnQgZ2xvYmFsIE9TIHNwZWNpZmljIHRhc2tzLiBDb252ZXJ0IHRoZW0gdG8gYSB0YXNrIHdpdGggYSBPUyBzcGVjaWZpYyBjb21tYW5kLiBBZmZlY3RlZCB0YXNrcyBhcmU6XFxuezB9JywgdGFza0NvbnRlbnQuam9pbignXFxuJykpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHQ6IElUYXNrUGFyc2VSZXN1bHQgPSB7IGN1c3RvbTogW10sIGNvbmZpZ3VyZWQ6IFtdIH07XG5cdFx0aWYgKGZpbGVDb25maWcudGFza3MpIHtcblx0XHRcdHJlc3VsdCA9IFRhc2tQYXJzZXIuZnJvbShmaWxlQ29uZmlnLnRhc2tzLCBnbG9iYWxzLCBjb250ZXh0LCBzb3VyY2UpO1xuXHRcdH1cblx0XHRpZiAoZ2xvYmFsVGFza3MpIHtcblx0XHRcdHJlc3VsdC5jdXN0b20gPSBUYXNrUGFyc2VyLmFzc2lnblRhc2tzKHJlc3VsdC5jdXN0b20sIGdsb2JhbFRhc2tzKTtcblx0XHR9XG5cblx0XHRpZiAoKCFyZXN1bHQuY3VzdG9tIHx8IHJlc3VsdC5jdXN0b20ubGVuZ3RoID09PSAwKSAmJiAoZ2xvYmFscy5jb21tYW5kICYmIGdsb2JhbHMuY29tbWFuZC5uYW1lKSkge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcnM6IFByb2JsZW1NYXRjaGVyW10gPSBQcm9ibGVtTWF0Y2hlckNvbnZlcnRlci5mcm9tKGZpbGVDb25maWcucHJvYmxlbU1hdGNoZXIsIGNvbnRleHQpLnZhbHVlID8/IFtdO1xuXHRcdFx0Y29uc3QgaXNCYWNrZ3JvdW5kID0gZmlsZUNvbmZpZy5pc0JhY2tncm91bmQgPyAhIWZpbGVDb25maWcuaXNCYWNrZ3JvdW5kIDogZmlsZUNvbmZpZy5pc1dhdGNoaW5nID8gISFmaWxlQ29uZmlnLmlzV2F0Y2hpbmcgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBuYW1lID0gVGFza3MuQ29tbWFuZFN0cmluZy52YWx1ZShnbG9iYWxzLmNvbW1hbmQubmFtZSk7XG5cdFx0XHRjb25zdCB0YXNrOiBUYXNrcy5DdXN0b21UYXNrID0gbmV3IFRhc2tzLkN1c3RvbVRhc2soXG5cdFx0XHRcdGNvbnRleHQudXVpZE1hcC5nZXRVVUlEKG5hbWUpLFxuXHRcdFx0XHRPYmplY3QuYXNzaWduKHt9LCBzb3VyY2UsICd3b3Jrc3BhY2UnLCB7IGNvbmZpZzogeyBpbmRleDogLTEsIGVsZW1lbnQ6IGZpbGVDb25maWcsIHdvcmtzcGFjZUZvbGRlcjogY29udGV4dC53b3Jrc3BhY2VGb2xkZXIgfSB9KSBzYXRpc2ZpZXMgVGFza3MuSVdvcmtzcGFjZVRhc2tTb3VyY2UsXG5cdFx0XHRcdG5hbWUsXG5cdFx0XHRcdFRhc2tzLkNVU1RPTUlaRURfVEFTS19UWVBFLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bmFtZTogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHJ1bnRpbWU6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRwcmVzZW50YXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRzdXBwcmVzc1Rhc2tOYW1lOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHR7IHJlZXZhbHVhdGVPblJlcnVuOiB0cnVlIH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IG5hbWUsXG5cdFx0XHRcdFx0Z3JvdXA6IFRhc2tzLlRhc2tHcm91cC5CdWlsZCxcblx0XHRcdFx0XHRpc0JhY2tncm91bmQ6IGlzQmFja2dyb3VuZCxcblx0XHRcdFx0XHRwcm9ibGVtTWF0Y2hlcnM6IG1hdGNoZXJzXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRjb25zdCB0YXNrR3JvdXBLaW5kID0gR3JvdXBLaW5kLmZyb20oZmlsZUNvbmZpZy5ncm91cCk7XG5cdFx0XHRpZiAodGFza0dyb3VwS2luZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgPSB0YXNrR3JvdXBLaW5kO1xuXHRcdFx0fSBlbHNlIGlmIChmaWxlQ29uZmlnLmdyb3VwID09PSAnbm9uZScpIHtcblx0XHRcdFx0dGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdEN1c3RvbVRhc2suZmlsbEdsb2JhbHModGFzaywgZ2xvYmFscyk7XG5cdFx0XHRDdXN0b21UYXNrLmZpbGxEZWZhdWx0cyh0YXNrLCBjb250ZXh0KTtcblx0XHRcdHJlc3VsdC5jdXN0b20gPSBbdGFza107XG5cdFx0fVxuXHRcdHJlc3VsdC5jdXN0b20gPSByZXN1bHQuY3VzdG9tIHx8IFtdO1xuXHRcdHJlc3VsdC5jb25maWd1cmVkID0gcmVzdWx0LmNvbmZpZ3VyZWQgfHwgW107XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jb25zdCB1dWlkTWFwczogTWFwPFRhc2tDb25maWdTb3VyY2UsIE1hcDxzdHJpbmcsIFVVSURNYXA+PiA9IG5ldyBNYXAoKTtcbmNvbnN0IHJlY2VudFV1aWRNYXBzOiBNYXA8VGFza0NvbmZpZ1NvdXJjZSwgTWFwPHN0cmluZywgVVVJRE1hcD4+ID0gbmV3IE1hcCgpO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKHdvcmtzcGFjZUZvbGRlcjogSVdvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlOiBJV29ya3NwYWNlIHwgdW5kZWZpbmVkLCBwbGF0Zm9ybTogUGxhdGZvcm0sIGNvbmZpZ3VyYXRpb246IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uLCBsb2dnZXI6IElQcm9ibGVtUmVwb3J0ZXIsIHNvdXJjZTogVGFza0NvbmZpZ1NvdXJjZSwgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgaXNSZWNlbnRzOiBib29sZWFuID0gZmFsc2UpOiBJUGFyc2VSZXN1bHQge1xuXHRjb25zdCByZWNlbnRPck90aGVyTWFwcyA9IGlzUmVjZW50cyA/IHJlY2VudFV1aWRNYXBzIDogdXVpZE1hcHM7XG5cdGxldCBzZWxlY3RlZFV1aWRNYXBzID0gcmVjZW50T3JPdGhlck1hcHMuZ2V0KHNvdXJjZSk7XG5cdGlmICghc2VsZWN0ZWRVdWlkTWFwcykge1xuXHRcdHJlY2VudE9yT3RoZXJNYXBzLnNldChzb3VyY2UsIG5ldyBNYXAoKSk7XG5cdFx0c2VsZWN0ZWRVdWlkTWFwcyA9IHJlY2VudE9yT3RoZXJNYXBzLmdldChzb3VyY2UpITtcblx0fVxuXHRsZXQgdXVpZE1hcCA9IHNlbGVjdGVkVXVpZE1hcHMuZ2V0KHdvcmtzcGFjZUZvbGRlci51cmkudG9TdHJpbmcoKSk7XG5cdGlmICghdXVpZE1hcCkge1xuXHRcdHV1aWRNYXAgPSBuZXcgVVVJRE1hcCgpO1xuXHRcdHNlbGVjdGVkVXVpZE1hcHMuc2V0KHdvcmtzcGFjZUZvbGRlci51cmkudG9TdHJpbmcoKSwgdXVpZE1hcCk7XG5cdH1cblx0dHJ5IHtcblx0XHR1dWlkTWFwLnN0YXJ0KCk7XG5cdFx0cmV0dXJuIChuZXcgQ29uZmlndXJhdGlvblBhcnNlcih3b3Jrc3BhY2VGb2xkZXIsIHdvcmtzcGFjZSwgcGxhdGZvcm0sIGxvZ2dlciwgdXVpZE1hcCkpLnJ1bihjb25maWd1cmF0aW9uLCBzb3VyY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fSBmaW5hbGx5IHtcblx0XHR1dWlkTWFwLmZpbmlzaCgpO1xuXHR9XG59XG5cblxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ3VzdG9tVGFzayhjb250cmlidXRlZFRhc2s6IFRhc2tzLkNvbnRyaWJ1dGVkVGFzaywgY29uZmlndXJlZFByb3BzOiBUYXNrcy5Db25maWd1cmluZ1Rhc2sgfCBUYXNrcy5DdXN0b21UYXNrKTogVGFza3MuQ3VzdG9tVGFzayB7XG5cdHJldHVybiBDdXN0b21UYXNrLmNyZWF0ZUN1c3RvbVRhc2soY29udHJpYnV0ZWRUYXNrLCBjb25maWd1cmVkUHJvcHMpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBRXJCLFlBQVksYUFBYTtBQUd6QixTQUFTLGdCQUFnQjtBQUN6QixZQUFZLFdBQVc7QUFDdkIsWUFBWSxVQUFVO0FBR3RCO0FBQUEsRUFDdUI7QUFBQSxFQUN0QjtBQUFBLEVBQXVCO0FBQUEsT0FDakI7QUFHUCxZQUFZLFdBQVc7QUFDdkIsU0FBa0MsOEJB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LElBQUksZ0JBQWdCLElBQUksU0FBUyxHQUFHLE9BQU87QUFBQSxFQUM3RDtBQUNBLE1BQUk7QUFDSCxZQUFRLE1BQU07QUFDZCxXQUFRLElBQUksb0JBQW9CLGlCQUFpQixXQUFXLFVBQVUsUUFBUSxPQUFPLEVBQUcsSUFBSSxlQUFlLFFBQVEsaUJBQWlCO0FBQUEsRUFDckksVUFBRTtBQUNELFlBQVEsT0FBTztBQUFBLEVBQ2hCO0FBQ0Q7QUFJTyxTQUFTLGlCQUFpQixpQkFBd0MsaUJBQTZFO0FBQ3JKLFNBQU8sV0FBVyxpQkFBaUIsaUJBQWlCLGVBQWU7QUFDcEU7IiwKICAibmFtZXMiOiBbIlNoZWxsUXVvdGluZyIsICJJVGFza0lkZW50aWZpZXIiLCAiQ29tbWFuZFN0cmluZyIsICJ2YWx1ZSIsICJQcm9ibGVtTWF0Y2hlcktpbmQiLCAiUnVuT25PcHRpb25zIiwgIlJ1bk9wdGlvbnMiLCAiU2hlbGxDb25maWd1cmF0aW9uIiwgIkNvbW1hbmRPcHRpb25zIiwgIkNvbW1hbmRDb25maWd1cmF0aW9uIiwgIlByZXNlbnRhdGlvbk9wdGlvbnMiLCAicHJvcGVydGllcyIsICJmcm9tIiwgImFzc2lnblByb3BlcnRpZXMiLCAiZmlsbFByb3BlcnRpZXMiLCAiZmlsbERlZmF1bHRzIiwgImZyZWV6ZSIsICJpc0VtcHR5IiwgIlNoZWxsU3RyaW5nIiwgIlByb2JsZW1NYXRjaGVyQ29udmVydGVyIiwgIkdyb3VwS2luZCIsICJUYXNrRGVwZW5kZW5jeSIsICJEZXBlbmRzT3JkZXIiLCAiQ29uZmlndXJhdGlvblByb3BlcnRpZXMiLCAiQ29uZmlndXJpbmdUYXNrIiwgImxhYmVsIiwgIkN1c3RvbVRhc2siLCAiY3JlYXRlQ3VzdG9tVGFzayIsICJUYXNrUGFyc2VyIiwgIkdsb2JhbHMiLCAiRXhlY3V0aW9uRW5naW5lIiwgIkpzb25TY2hlbWFWZXJzaW9uIiwgIlRhc2tDb25maWdTb3VyY2UiXQp9Cg==
