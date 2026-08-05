import { URI } from "../../../../../base/common/uri.js";
import assert from "assert";
import Severity from "../../../../../base/common/severity.js";
import * as UUID from "../../../../../base/common/uuid.js";
import * as Types from "../../../../../base/common/types.js";
import * as Platform from "../../../../../base/common/platform.js";
import { ValidationStatus } from "../../../../../base/common/parsers.js";
import { FileLocationKind, ApplyToKind } from "../../common/problemMatcher.js";
import { WorkspaceFolder } from "../../../../../platform/workspace/common/workspace.js";
import * as Tasks from "../../common/tasks.js";
import { parse, TaskConfigSource, ProblemMatcherConverter, UUIDMap, TaskParser } from "../../common/taskConfiguration.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { Workspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const workspaceFolder = new WorkspaceFolder({
  uri: URI.file("/workspace/folderOne"),
  name: "folderOne",
  index: 0
});
const workspace = new Workspace("id", [workspaceFolder]);
class ProblemReporter {
  constructor() {
    this._validationStatus = new ValidationStatus();
    this.receivedMessage = false;
    this.lastMessage = void 0;
  }
  info(message) {
    this.log(message);
  }
  warn(message) {
    this.log(message);
  }
  error(message) {
    this.log(message);
  }
  fatal(message) {
    this.log(message);
  }
  get status() {
    return this._validationStatus;
  }
  log(message) {
    this.receivedMessage = true;
    this.lastMessage = message;
  }
  clearMessage() {
    this.lastMessage = void 0;
  }
}
class ConfigurationBuilder {
  constructor() {
    this.result = [];
    this.builders = [];
  }
  task(name, command) {
    const builder = new CustomTaskBuilder(this, name, command);
    this.builders.push(builder);
    this.result.push(builder.result);
    return builder;
  }
  done() {
    for (const builder of this.builders) {
      builder.done();
    }
  }
}
class PresentationBuilder {
  constructor(parent) {
    this.parent = parent;
    this.result = { echo: false, reveal: Tasks.RevealKind.Always, revealProblems: Tasks.RevealProblemKind.Never, focus: false, panel: Tasks.PanelKind.Shared, showReuseMessage: true, clear: false, close: false };
  }
  echo(value) {
    this.result.echo = value;
    return this;
  }
  reveal(value) {
    this.result.reveal = value;
    return this;
  }
  focus(value) {
    this.result.focus = value;
    return this;
  }
  instance(value) {
    this.result.panel = value;
    return this;
  }
  showReuseMessage(value) {
    this.result.showReuseMessage = value;
    return this;
  }
  close(value) {
    this.result.close = value;
    return this;
  }
  done() {
  }
}
class CommandConfigurationBuilder {
  constructor(parent, command) {
    this.parent = parent;
    this.presentationBuilder = new PresentationBuilder(this);
    this.result = {
      name: command,
      runtime: Tasks.RuntimeType.Process,
      args: [],
      options: {
        cwd: "${workspaceFolder}"
      },
      presentation: this.presentationBuilder.result,
      suppressTaskName: false
    };
  }
  name(value) {
    this.result.name = value;
    return this;
  }
  runtime(value) {
    this.result.runtime = value;
    return this;
  }
  args(value) {
    this.result.args = value;
    return this;
  }
  options(value) {
    this.result.options = value;
    return this;
  }
  taskSelector(value) {
    this.result.taskSelector = value;
    return this;
  }
  suppressTaskName(value) {
    this.result.suppressTaskName = value;
    return this;
  }
  presentation() {
    return this.presentationBuilder;
  }
  done(taskName) {
    this.result.args = this.result.args.map((arg) => arg === "$name" ? taskName : arg);
    this.presentationBuilder.done();
  }
}
class CustomTaskBuilder {
  constructor(parent, name, command) {
    this.parent = parent;
    this.commandBuilder = new CommandConfigurationBuilder(this, command);
    this.result = new Tasks.CustomTask(
      name,
      { kind: Tasks.TaskSourceKind.Workspace, label: "workspace", config: { workspaceFolder, element: void 0, index: -1, file: ".vscode/tasks.json" } },
      name,
      Tasks.CUSTOMIZED_TASK_TYPE,
      this.commandBuilder.result,
      false,
      { reevaluateOnRerun: true },
      {
        identifier: name,
        name,
        isBackground: false,
        promptOnClose: true,
        problemMatchers: []
      }
    );
  }
  identifier(value) {
    this.result.configurationProperties.identifier = value;
    return this;
  }
  group(value) {
    this.result.configurationProperties.group = value;
    return this;
  }
  isBackground(value) {
    this.result.configurationProperties.isBackground = value;
    return this;
  }
  promptOnClose(value) {
    this.result.configurationProperties.promptOnClose = value;
    return this;
  }
  problemMatcher() {
    const builder = new ProblemMatcherBuilder(this);
    this.result.configurationProperties.problemMatchers.push(builder.result);
    return builder;
  }
  command() {
    return this.commandBuilder;
  }
  done() {
    this.commandBuilder.done(this.result.configurationProperties.name);
  }
}
const _ProblemMatcherBuilder = class _ProblemMatcherBuilder {
  constructor(parent) {
    this.parent = parent;
    this.result = {
      owner: _ProblemMatcherBuilder.DEFAULT_UUID,
      applyTo: ApplyToKind.allDocuments,
      severity: void 0,
      fileLocation: FileLocationKind.Relative,
      filePrefix: "${workspaceFolder}",
      pattern: void 0
    };
  }
  owner(value) {
    this.result.owner = value;
    return this;
  }
  applyTo(value) {
    this.result.applyTo = value;
    return this;
  }
  severity(value) {
    this.result.severity = value;
    return this;
  }
  fileLocation(value) {
    this.result.fileLocation = value;
    return this;
  }
  filePrefix(value) {
    this.result.filePrefix = value;
    return this;
  }
  pattern(regExp) {
    const builder = new PatternBuilder(this, regExp);
    if (!this.result.pattern) {
      this.result.pattern = builder.result;
    }
    return builder;
  }
};
_ProblemMatcherBuilder.DEFAULT_UUID = UUID.generateUuid();
let ProblemMatcherBuilder = _ProblemMatcherBuilder;
class PatternBuilder {
  constructor(parent, regExp) {
    this.parent = parent;
    this.result = {
      regexp: regExp,
      file: 1,
      message: 0,
      line: 2,
      character: 3
    };
  }
  file(value) {
    this.result.file = value;
    return this;
  }
  message(value) {
    this.result.message = value;
    return this;
  }
  location(value) {
    this.result.location = value;
    return this;
  }
  line(value) {
    this.result.line = value;
    return this;
  }
  character(value) {
    this.result.character = value;
    return this;
  }
  endLine(value) {
    this.result.endLine = value;
    return this;
  }
  endCharacter(value) {
    this.result.endCharacter = value;
    return this;
  }
  code(value) {
    this.result.code = value;
    return this;
  }
  severity(value) {
    this.result.severity = value;
    return this;
  }
  loop(value) {
    this.result.loop = value;
    return this;
  }
}
class TasksMockContextKeyService extends MockContextKeyService {
  getContext(domNode) {
    return {
      getValue: (_key) => {
        return true;
      }
    };
  }
}
function testDefaultProblemMatcher(external, resolved) {
  const reporter = new ProblemReporter();
  const result = parse(workspaceFolder, workspace, Platform.platform, external, reporter, TaskConfigSource.TasksJson, new TasksMockContextKeyService());
  assert.ok(!reporter.receivedMessage);
  assert.strictEqual(result.custom.length, 1);
  const task = result.custom[0];
  assert.ok(task);
  assert.strictEqual(task.configurationProperties.problemMatchers.length, resolved);
}
function testConfiguration(external, builder) {
  builder.done();
  const reporter = new ProblemReporter();
  const result = parse(workspaceFolder, workspace, Platform.platform, external, reporter, TaskConfigSource.TasksJson, new TasksMockContextKeyService());
  if (reporter.receivedMessage) {
    assert.ok(false, reporter.lastMessage);
  }
  assertConfiguration(result, builder.result);
}
class TaskGroupMap {
  constructor() {
    this._store = /* @__PURE__ */ Object.create(null);
  }
  add(group, task) {
    let tasks = this._store[group];
    if (!tasks) {
      tasks = [];
      this._store[group] = tasks;
    }
    tasks.push(task);
  }
  static assert(actual, expected) {
    const actualKeys = Object.keys(actual._store);
    const expectedKeys = Object.keys(expected._store);
    if (actualKeys.length === 0 && expectedKeys.length === 0) {
      return;
    }
    assert.strictEqual(actualKeys.length, expectedKeys.length);
    actualKeys.forEach((key) => assert.ok(expected._store[key]));
    expectedKeys.forEach((key) => actual._store[key]);
    actualKeys.forEach((key) => {
      const actualTasks = actual._store[key];
      const expectedTasks = expected._store[key];
      assert.strictEqual(actualTasks.length, expectedTasks.length);
      if (actualTasks.length === 1) {
        assert.strictEqual(actualTasks[0].configurationProperties.name, expectedTasks[0].configurationProperties.name);
        return;
      }
      const expectedTaskMap = /* @__PURE__ */ Object.create(null);
      expectedTasks.forEach((task) => expectedTaskMap[task.configurationProperties.name] = true);
      actualTasks.forEach((task) => delete expectedTaskMap[task.configurationProperties.name]);
      assert.strictEqual(Object.keys(expectedTaskMap).length, 0);
    });
  }
}
function assertConfiguration(result, expected) {
  assert.ok(result.validationStatus.isOK());
  const actual = result.custom;
  assert.strictEqual(typeof actual, typeof expected);
  if (!actual) {
    return;
  }
  const actualTasks = /* @__PURE__ */ Object.create(null);
  const actualId2Name = /* @__PURE__ */ Object.create(null);
  const actualTaskGroups = new TaskGroupMap();
  actual.forEach((task) => {
    assert.ok(!actualTasks[task.configurationProperties.name]);
    actualTasks[task.configurationProperties.name] = task;
    actualId2Name[task._id] = task.configurationProperties.name;
    const taskId = Tasks.TaskGroup.from(task.configurationProperties.group)?._id;
    if (taskId) {
      actualTaskGroups.add(taskId, task);
    }
  });
  const expectedTasks = /* @__PURE__ */ Object.create(null);
  const expectedTaskGroup = new TaskGroupMap();
  expected.forEach((task) => {
    assert.ok(!expectedTasks[task.configurationProperties.name]);
    expectedTasks[task.configurationProperties.name] = task;
    const taskId = Tasks.TaskGroup.from(task.configurationProperties.group)?._id;
    if (taskId) {
      expectedTaskGroup.add(taskId, task);
    }
  });
  const actualKeys = Object.keys(actualTasks);
  assert.strictEqual(actualKeys.length, expected.length);
  actualKeys.forEach((key) => {
    const actualTask = actualTasks[key];
    const expectedTask = expectedTasks[key];
    assert.ok(expectedTask);
    assertTask(actualTask, expectedTask);
  });
  TaskGroupMap.assert(actualTaskGroups, expectedTaskGroup);
}
function assertTask(actual, expected) {
  assert.ok(actual._id);
  assert.strictEqual(actual.configurationProperties.name, expected.configurationProperties.name, "name");
  if (!Tasks.InMemoryTask.is(actual) && !Tasks.InMemoryTask.is(expected)) {
    assertCommandConfiguration(actual.command, expected.command);
  }
  assert.strictEqual(actual.configurationProperties.isBackground, expected.configurationProperties.isBackground, "isBackground");
  assert.strictEqual(typeof actual.configurationProperties.problemMatchers, typeof expected.configurationProperties.problemMatchers);
  assert.strictEqual(actual.configurationProperties.promptOnClose, expected.configurationProperties.promptOnClose, "promptOnClose");
  assert.strictEqual(typeof actual.configurationProperties.group, typeof expected.configurationProperties.group, `group types unequal`);
  if (actual.configurationProperties.problemMatchers && expected.configurationProperties.problemMatchers) {
    assert.strictEqual(actual.configurationProperties.problemMatchers.length, expected.configurationProperties.problemMatchers.length);
    for (let i = 0; i < actual.configurationProperties.problemMatchers.length; i++) {
      assertProblemMatcher(actual.configurationProperties.problemMatchers[i], expected.configurationProperties.problemMatchers[i]);
    }
  }
  if (actual.configurationProperties.group && expected.configurationProperties.group) {
    if (Types.isString(actual.configurationProperties.group)) {
      assert.strictEqual(actual.configurationProperties.group, expected.configurationProperties.group);
    } else {
      assertGroup(actual.configurationProperties.group, expected.configurationProperties.group);
    }
  }
}
function assertCommandConfiguration(actual, expected) {
  assert.strictEqual(typeof actual, typeof expected);
  if (actual && expected) {
    assertPresentation(actual.presentation, expected.presentation);
    assert.strictEqual(actual.name, expected.name, "name");
    assert.strictEqual(actual.runtime, expected.runtime, "runtime type");
    assert.strictEqual(actual.suppressTaskName, expected.suppressTaskName, "suppressTaskName");
    assert.strictEqual(actual.taskSelector, expected.taskSelector, "taskSelector");
    assert.deepStrictEqual(actual.args, expected.args, "args");
    assert.strictEqual(typeof actual.options, typeof expected.options);
    if (actual.options && expected.options) {
      assert.strictEqual(actual.options.cwd, expected.options.cwd, "cwd");
      assert.strictEqual(typeof actual.options.env, typeof expected.options.env, "env");
      if (actual.options.env && expected.options.env) {
        assert.deepStrictEqual(actual.options.env, expected.options.env, "env");
      }
    }
  }
}
function assertGroup(actual, expected) {
  assert.strictEqual(typeof actual, typeof expected);
  if (actual && expected) {
    assert.strictEqual(actual._id, expected._id, `group ids unequal. actual: ${actual._id} expected ${expected._id}`);
    assert.strictEqual(actual.isDefault, expected.isDefault, `group defaults unequal. actual: ${actual.isDefault} expected ${expected.isDefault}`);
  }
}
function assertPresentation(actual, expected) {
  assert.strictEqual(typeof actual, typeof expected);
  if (actual && expected) {
    assert.strictEqual(actual.echo, expected.echo);
    assert.strictEqual(actual.reveal, expected.reveal);
  }
}
function assertProblemMatcher(actual, expected) {
  assert.strictEqual(typeof actual, typeof expected);
  if (typeof actual === "string" && typeof expected === "string") {
    assert.strictEqual(actual, expected, "Problem matcher references are different");
    return;
  }
  if (typeof actual !== "string" && typeof expected !== "string") {
    if (expected.owner === ProblemMatcherBuilder.DEFAULT_UUID) {
      assert.ok(UUID.isUUID(actual.owner), "Owner must be a UUID");
    } else {
      assert.strictEqual(actual.owner, expected.owner);
    }
    assert.strictEqual(actual.applyTo, expected.applyTo);
    assert.strictEqual(actual.severity, expected.severity);
    assert.strictEqual(actual.fileLocation, expected.fileLocation);
    assert.strictEqual(actual.filePrefix, expected.filePrefix);
    if (actual.pattern && expected.pattern) {
      assertProblemPatterns(actual.pattern, expected.pattern);
    }
  }
}
function assertProblemPatterns(actual, expected) {
  assert.strictEqual(typeof actual, typeof expected);
  if (Array.isArray(actual)) {
    const actuals = actual;
    const expecteds = expected;
    assert.strictEqual(actuals.length, expecteds.length);
    for (let i = 0; i < actuals.length; i++) {
      assertProblemPattern(actuals[i], expecteds[i]);
    }
  } else {
    assertProblemPattern(actual, expected);
  }
}
function assertProblemPattern(actual, expected) {
  assert.strictEqual(actual.regexp.toString(), expected.regexp.toString());
  assert.strictEqual(actual.file, expected.file);
  assert.strictEqual(actual.message, expected.message);
  if (typeof expected.location !== "undefined") {
    assert.strictEqual(actual.location, expected.location);
  } else {
    assert.strictEqual(actual.line, expected.line);
    assert.strictEqual(actual.character, expected.character);
    assert.strictEqual(actual.endLine, expected.endLine);
    assert.strictEqual(actual.endCharacter, expected.endCharacter);
  }
  assert.strictEqual(actual.code, expected.code);
  assert.strictEqual(actual.severity, expected.severity);
  assert.strictEqual(actual.loop, expected.loop);
}
suite("Tasks version 0.1.0", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("tasks: all default", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc"
      },
      builder
    );
  });
  test("tasks: global isShellCommand", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        isShellCommand: true
      },
      builder
    );
  });
  test("tasks: global show output silent", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).presentation().reveal(Tasks.RevealKind.Silent);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        showOutput: "silent"
      },
      builder
    );
  });
  test("tasks: global promptOnClose default", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        promptOnClose: true
      },
      builder
    );
  });
  test("tasks: global promptOnClose", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).promptOnClose(false).command().suppressTaskName(true);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        promptOnClose: false
      },
      builder
    );
  });
  test("tasks: global promptOnClose default watching", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).isBackground(true).promptOnClose(false).command().suppressTaskName(true);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        isWatching: true
      },
      builder
    );
  });
  test("tasks: global show output never", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).presentation().reveal(Tasks.RevealKind.Never);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        showOutput: "never"
      },
      builder
    );
  });
  test("tasks: global echo Command", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).presentation().echo(true);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        echoCommand: true
      },
      builder
    );
  });
  test("tasks: global args", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).args(["--p"]);
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        args: [
          "--p"
        ]
      },
      builder
    );
  });
  test("tasks: options - cwd", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).options({
      cwd: "myPath"
    });
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        options: {
          cwd: "myPath"
        }
      },
      builder
    );
  });
  test("tasks: options - env", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).options({ cwd: "${workspaceFolder}", env: { key: "value" } });
    testConfiguration(
      {
        version: "0.1.0",
        command: "tsc",
        options: {
          env: {
            key: "value"
          }
        }
      },
      builder
    );
  });
  test("tasks: os windows", () => {
    const name = Platform.isWindows ? "tsc.win" : "tsc";
    const builder = new ConfigurationBuilder();
    builder.task(name, name).group(Tasks.TaskGroup.Build).command().suppressTaskName(true);
    const external = {
      version: "0.1.0",
      command: "tsc",
      windows: {
        command: "tsc.win"
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: os windows & global isShellCommand", () => {
    const name = Platform.isWindows ? "tsc.win" : "tsc";
    const builder = new ConfigurationBuilder();
    builder.task(name, name).group(Tasks.TaskGroup.Build).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell);
    const external = {
      version: "0.1.0",
      command: "tsc",
      isShellCommand: true,
      windows: {
        command: "tsc.win"
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: os mac", () => {
    const name = Platform.isMacintosh ? "tsc.osx" : "tsc";
    const builder = new ConfigurationBuilder();
    builder.task(name, name).group(Tasks.TaskGroup.Build).command().suppressTaskName(true);
    const external = {
      version: "0.1.0",
      command: "tsc",
      osx: {
        command: "tsc.osx"
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: os linux", () => {
    const name = Platform.isLinux ? "tsc.linux" : "tsc";
    const builder = new ConfigurationBuilder();
    builder.task(name, name).group(Tasks.TaskGroup.Build).command().suppressTaskName(true);
    const external = {
      version: "0.1.0",
      command: "tsc",
      linux: {
        command: "tsc.linux"
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: overwrite showOutput", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).presentation().reveal(Platform.isWindows ? Tasks.RevealKind.Always : Tasks.RevealKind.Never);
    const external = {
      version: "0.1.0",
      command: "tsc",
      showOutput: "never",
      windows: {
        showOutput: "always"
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: overwrite echo Command", () => {
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).presentation().echo(Platform.isWindows ? false : true);
    const external = {
      version: "0.1.0",
      command: "tsc",
      echoCommand: true,
      windows: {
        echoCommand: false
      }
    };
    testConfiguration(external, builder);
  });
  test("tasks: global problemMatcher one", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      problemMatcher: "$msCompile"
    };
    testDefaultProblemMatcher(external, 1);
  });
  test("tasks: global problemMatcher two", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      problemMatcher: ["$eslint-compact", "$msCompile"]
    };
    testDefaultProblemMatcher(external, 2);
  });
  test("tasks: task definition", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: build task", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          isBuildCommand: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").group(Tasks.TaskGroup.Build).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: default build task", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "build"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("build", "tsc").group(Tasks.TaskGroup.Build).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: test task", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          isTestCommand: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").group(Tasks.TaskGroup.Test).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: default test task", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "test"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("test", "tsc").group(Tasks.TaskGroup.Test).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: task with values", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "test",
          showOutput: "never",
          echoCommand: true,
          args: ["--p"],
          isWatching: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("test", "tsc").group(Tasks.TaskGroup.Test).isBackground(true).promptOnClose(false).command().args(["$name", "--p"]).presentation().echo(true).reveal(Tasks.RevealKind.Never);
    testConfiguration(external, builder);
  });
  test("tasks: task inherits global values", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      showOutput: "never",
      echoCommand: true,
      tasks: [
        {
          taskName: "test"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("test", "tsc").group(Tasks.TaskGroup.Test).command().args(["$name"]).presentation().echo(true).reveal(Tasks.RevealKind.Never);
    testConfiguration(external, builder);
  });
  test("tasks: problem matcher default", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            pattern: {
              regexp: "abc"
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().pattern(/abc/);
    testConfiguration(external, builder);
  });
  test("tasks: problem matcher .* regular expression", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            pattern: {
              regexp: ".*"
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().pattern(/.*/);
    testConfiguration(external, builder);
  });
  test("tasks: problem matcher owner, applyTo, severity and fileLocation", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            owner: "myOwner",
            applyTo: "closedDocuments",
            severity: "warning",
            fileLocation: "absolute",
            pattern: {
              regexp: "abc"
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().owner("myOwner").applyTo(ApplyToKind.closedDocuments).severity(Severity.Warning).fileLocation(FileLocationKind.Absolute).filePrefix(void 0).pattern(/abc/);
    testConfiguration(external, builder);
  });
  test("tasks: problem matcher fileLocation and filePrefix", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            fileLocation: ["relative", "myPath"],
            pattern: {
              regexp: "abc"
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().fileLocation(FileLocationKind.Relative).filePrefix("myPath").pattern(/abc/);
    testConfiguration(external, builder);
  });
  test("tasks: problem pattern location", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            pattern: {
              regexp: "abc",
              file: 10,
              message: 11,
              location: 12,
              severity: 13,
              code: 14
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().pattern(/abc/).file(10).message(11).location(12).severity(13).code(14);
    testConfiguration(external, builder);
  });
  test("tasks: problem pattern line & column", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          problemMatcher: {
            pattern: {
              regexp: "abc",
              file: 10,
              message: 11,
              line: 12,
              column: 13,
              endLine: 14,
              endColumn: 15,
              severity: 16,
              code: 17
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().args(["$name"]).parent.problemMatcher().pattern(/abc/).file(10).message(11).line(12).character(13).endLine(14).endCharacter(15).severity(16).code(17);
    testConfiguration(external, builder);
  });
  test("tasks: prompt on close default", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").promptOnClose(true).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: prompt on close watching", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          isWatching: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").isBackground(true).promptOnClose(false).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: prompt on close set", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskName",
          promptOnClose: false
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").promptOnClose(false).command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: task selector set", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      taskSelector: "/t:",
      tasks: [
        {
          taskName: "taskName"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().taskSelector("/t:").args(["/t:taskName"]);
    testConfiguration(external, builder);
  });
  test("tasks: suppress task name set", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      suppressTaskName: false,
      tasks: [
        {
          taskName: "taskName",
          suppressTaskName: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().suppressTaskName(true);
    testConfiguration(external, builder);
  });
  test("tasks: suppress task name inherit", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      suppressTaskName: true,
      tasks: [
        {
          taskName: "taskName"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskName", "tsc").command().suppressTaskName(true);
    testConfiguration(external, builder);
  });
  test("tasks: two tasks", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskNameOne"
        },
        {
          taskName: "taskNameTwo"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().args(["$name"]);
    builder.task("taskNameTwo", "tsc").command().args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: with command", () => {
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "taskNameOne",
          command: "tsc"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().suppressTaskName(true);
    testConfiguration(external, builder);
  });
  test("tasks: two tasks with command", () => {
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "taskNameOne",
          command: "tsc"
        },
        {
          taskName: "taskNameTwo",
          command: "dir"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().suppressTaskName(true);
    builder.task("taskNameTwo", "dir").command().suppressTaskName(true);
    testConfiguration(external, builder);
  });
  test("tasks: with command and args", () => {
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "taskNameOne",
          command: "tsc",
          isShellCommand: true,
          args: ["arg"],
          options: {
            cwd: "cwd",
            env: {
              env: "env"
            }
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).args(["arg"]).options({ cwd: "cwd", env: { env: "env" } });
    testConfiguration(external, builder);
  });
  test("tasks: with command os specific", () => {
    const name = Platform.isWindows ? "tsc.win" : "tsc";
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "taskNameOne",
          command: "tsc",
          windows: {
            command: "tsc.win"
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", name).command().suppressTaskName(true);
    testConfiguration(external, builder);
  });
  test("tasks: with Windows specific args", () => {
    const args = Platform.isWindows ? ["arg1", "arg2"] : ["arg1"];
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "tsc",
          command: "tsc",
          args: ["arg1"],
          windows: {
            args: ["arg2"]
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").command().suppressTaskName(true).args(args);
    testConfiguration(external, builder);
  });
  test("tasks: with Linux specific args", () => {
    const args = Platform.isLinux ? ["arg1", "arg2"] : ["arg1"];
    const external = {
      version: "0.1.0",
      tasks: [
        {
          taskName: "tsc",
          command: "tsc",
          args: ["arg1"],
          linux: {
            args: ["arg2"]
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("tsc", "tsc").command().suppressTaskName(true).args(args);
    testConfiguration(external, builder);
  });
  test("tasks: global command and task command properties", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      tasks: [
        {
          taskName: "taskNameOne",
          isShellCommand: true
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().runtime(Tasks.RuntimeType.Shell).args(["$name"]);
    testConfiguration(external, builder);
  });
  test("tasks: global and tasks args", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      args: ["global"],
      tasks: [
        {
          taskName: "taskNameOne",
          args: ["local"]
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().args(["global", "$name", "local"]);
    testConfiguration(external, builder);
  });
  test("tasks: global and tasks args with task selector", () => {
    const external = {
      version: "0.1.0",
      command: "tsc",
      args: ["global"],
      taskSelector: "/t:",
      tasks: [
        {
          taskName: "taskNameOne",
          args: ["local"]
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("taskNameOne", "tsc").command().taskSelector("/t:").args(["global", "/t:taskNameOne", "local"]);
    testConfiguration(external, builder);
  });
});
suite("Tasks version 2.0.0", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test.skip("Build workspace task", () => {
    const external = {
      version: "2.0.0",
      tasks: [
        {
          taskName: "dir",
          command: "dir",
          type: "shell",
          group: "build"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("dir", "dir").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test("Global group none", () => {
    const external = {
      version: "2.0.0",
      command: "dir",
      type: "shell",
      group: "none"
    };
    const builder = new ConfigurationBuilder();
    builder.task("dir", "dir").command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test.skip("Global group build", () => {
    const external = {
      version: "2.0.0",
      command: "dir",
      type: "shell",
      group: "build"
    };
    const builder = new ConfigurationBuilder();
    builder.task("dir", "dir").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test.skip("Global group default build", () => {
    const external = {
      version: "2.0.0",
      command: "dir",
      type: "shell",
      group: { kind: "build", isDefault: true }
    };
    const builder = new ConfigurationBuilder();
    const taskGroup = Tasks.TaskGroup.Build;
    taskGroup.isDefault = true;
    builder.task("dir", "dir").group(taskGroup).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test("Local group none", () => {
    const external = {
      version: "2.0.0",
      tasks: [
        {
          taskName: "dir",
          command: "dir",
          type: "shell",
          group: "none"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("dir", "dir").command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test.skip("Local group build", () => {
    const external = {
      version: "2.0.0",
      tasks: [
        {
          taskName: "dir",
          command: "dir",
          type: "shell",
          group: "build"
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("dir", "dir").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test.skip("Local group default build", () => {
    const external = {
      version: "2.0.0",
      tasks: [
        {
          taskName: "dir",
          command: "dir",
          type: "shell",
          group: { kind: "build", isDefault: true }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    const taskGroup = Tasks.TaskGroup.Build;
    taskGroup.isDefault = true;
    builder.task("dir", "dir").group(taskGroup).command().suppressTaskName(true).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
    testConfiguration(external, builder);
  });
  test("Arg overwrite", () => {
    const external = {
      version: "2.0.0",
      tasks: [
        {
          label: "echo",
          type: "shell",
          command: "echo",
          args: [
            "global"
          ],
          windows: {
            args: [
              "windows"
            ]
          },
          linux: {
            args: [
              "linux"
            ]
          },
          osx: {
            args: [
              "osx"
            ]
          }
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    if (Platform.isWindows) {
      builder.task("echo", "echo").command().suppressTaskName(true).args(["windows"]).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
      testConfiguration(external, builder);
    } else if (Platform.isLinux) {
      builder.task("echo", "echo").command().suppressTaskName(true).args(["linux"]).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
      testConfiguration(external, builder);
    } else if (Platform.isMacintosh) {
      builder.task("echo", "echo").command().suppressTaskName(true).args(["osx"]).runtime(Tasks.RuntimeType.Shell).presentation().echo(true);
      testConfiguration(external, builder);
    }
  });
});
suite("Bugs / regression tests", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  (Platform.isLinux ? test.skip : test)("Bug 19548", () => {
    const external = {
      version: "0.1.0",
      windows: {
        command: "powershell",
        options: {
          cwd: "${workspaceFolder}"
        },
        tasks: [
          {
            taskName: "composeForDebug",
            suppressTaskName: true,
            args: [
              "-ExecutionPolicy",
              "RemoteSigned",
              ".\\dockerTask.ps1",
              "-ComposeForDebug",
              "-Environment",
              "debug"
            ],
            isBuildCommand: false,
            showOutput: "always",
            echoCommand: true
          }
        ]
      },
      osx: {
        command: "/bin/bash",
        options: {
          cwd: "${workspaceFolder}"
        },
        tasks: [
          {
            taskName: "composeForDebug",
            suppressTaskName: true,
            args: [
              "-c",
              "./dockerTask.sh composeForDebug debug"
            ],
            isBuildCommand: false,
            showOutput: "always"
          }
        ]
      }
    };
    const builder = new ConfigurationBuilder();
    if (Platform.isWindows) {
      builder.task("composeForDebug", "powershell").command().suppressTaskName(true).args(["-ExecutionPolicy", "RemoteSigned", ".\\dockerTask.ps1", "-ComposeForDebug", "-Environment", "debug"]).options({ cwd: "${workspaceFolder}" }).presentation().echo(true).reveal(Tasks.RevealKind.Always);
      testConfiguration(external, builder);
    } else if (Platform.isMacintosh) {
      builder.task("composeForDebug", "/bin/bash").command().suppressTaskName(true).args(["-c", "./dockerTask.sh composeForDebug debug"]).options({ cwd: "${workspaceFolder}" }).presentation().reveal(Tasks.RevealKind.Always);
      testConfiguration(external, builder);
    }
  });
  test("Bug 28489", () => {
    const external = {
      version: "0.1.0",
      command: "",
      isShellCommand: true,
      args: [""],
      showOutput: "always",
      "tasks": [
        {
          taskName: "build",
          command: "bash",
          args: [
            "build.sh"
          ]
        }
      ]
    };
    const builder = new ConfigurationBuilder();
    builder.task("build", "bash").group(Tasks.TaskGroup.Build).command().suppressTaskName(true).args(["build.sh"]).runtime(Tasks.RuntimeType.Shell);
    testConfiguration(external, builder);
  });
});
class TestNamedProblemMatcher {
}
class TestParseContext {
}
class TestTaskDefinitionRegistry {
  get(key) {
    return this._task;
  }
  set(task) {
    this._task = task;
  }
}
suite("Task configuration conversions", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const globals = {};
  const taskConfigSource = {};
  const TaskDefinitionRegistry = new TestTaskDefinitionRegistry();
  let instantiationService;
  let parseContext;
  let namedProblemMatcher;
  let problemReporter;
  setup(() => {
    instantiationService = new TestInstantiationService();
    namedProblemMatcher = instantiationService.createInstance(TestNamedProblemMatcher);
    namedProblemMatcher.name = "real";
    namedProblemMatcher.label = "real label";
    problemReporter = new ProblemReporter();
    parseContext = instantiationService.createInstance(TestParseContext);
    parseContext.problemReporter = problemReporter;
    parseContext.namedProblemMatchers = { "real": namedProblemMatcher };
    parseContext.uuidMap = new UUIDMap();
  });
  teardown(() => {
    instantiationService.dispose();
  });
  suite("ProblemMatcherConverter.from", () => {
    test("returns [] and an error for an unknown problem matcher", () => {
      const result = ProblemMatcherConverter.from("$fake", parseContext);
      assert.deepEqual(result.value, []);
      assert.strictEqual(result.errors?.length, 1);
    });
    test("returns config for a known problem matcher", () => {
      const result = ProblemMatcherConverter.from("$real", parseContext);
      assert.strictEqual(result.errors?.length, 0);
      assert.deepEqual(result.value, [{ "label": "real label" }]);
    });
    test("returns config for a known problem matcher including applyTo", () => {
      namedProblemMatcher.applyTo = ApplyToKind.closedDocuments;
      const result = ProblemMatcherConverter.from("$real", parseContext);
      assert.strictEqual(result.errors?.length, 0);
      assert.deepEqual(result.value, [{ "label": "real label", "applyTo": ApplyToKind.closedDocuments }]);
    });
  });
  suite("TaskParser.from", () => {
    suite("CustomTask", () => {
      suite("incomplete config reports an appropriate error for missing", () => {
        test("name", () => {
          const result = TaskParser.from([{}], globals, parseContext, taskConfigSource);
          assertTaskParseResult(result, void 0, problemReporter, "Error: a task must provide a label property");
        });
        test("command", () => {
          const result = TaskParser.from([{ taskName: "task" }], globals, parseContext, taskConfigSource);
          assertTaskParseResult(result, void 0, problemReporter, "Error: the task 'task' doesn't define a command");
        });
      });
      test("returns expected result", () => {
        const expected = [
          { taskName: "task", command: "echo test" },
          { taskName: "task 2", command: "echo test" }
        ];
        const result = TaskParser.from(expected, globals, parseContext, taskConfigSource);
        assertTaskParseResult(result, { custom: expected }, problemReporter, void 0);
      });
    });
    suite("ConfiguredTask", () => {
      test("returns expected result", () => {
        const expected = [{ taskName: "task", command: "echo test", type: "any", label: "task" }, { taskName: "task 2", command: "echo test", type: "any", label: "task 2" }];
        TaskDefinitionRegistry.set({ extensionId: "registered", taskType: "any", properties: {} });
        const result = TaskParser.from(expected, globals, parseContext, taskConfigSource, TaskDefinitionRegistry);
        assertTaskParseResult(result, { configured: expected }, problemReporter, void 0);
      });
    });
  });
});
function assertTaskParseResult(actual, expected, problemReporter, expectedMessage) {
  if (expectedMessage === void 0) {
    assert.strictEqual(problemReporter.lastMessage, void 0);
  } else {
    assert.ok(problemReporter.lastMessage?.includes(expectedMessage));
  }
  assert.deepEqual(actual.custom.length, expected?.custom?.length || 0);
  assert.deepEqual(actual.configured.length, expected?.configured?.length || 0);
  let index = 0;
  if (expected?.configured) {
    for (const taskParseResult of expected?.configured) {
      assert.strictEqual(actual.configured[index]._label, taskParseResult.label);
      index++;
    }
  }
  index = 0;
  if (expected?.custom) {
    for (const taskParseResult of expected?.custom) {
      assert.strictEqual(actual.custom[index]._label, taskParseResult.taskName);
      index++;
    }
  }
  problemReporter.clearMessage();
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy90ZXN0L2NvbW1vbi90YXNrQ29uZmlndXJhdGlvbi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0ICogYXMgVVVJRCBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcblxuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0ICogYXMgUGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVmFsaWRhdGlvblN0YXR1cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhcnNlcnMuanMnO1xuaW1wb3J0IHsgUHJvYmxlbU1hdGNoZXIsIEZpbGVMb2NhdGlvbktpbmQsIElQcm9ibGVtUGF0dGVybiwgQXBwbHlUb0tpbmQsIElOYW1lZFByb2JsZW1NYXRjaGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Byb2JsZW1NYXRjaGVyLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUZvbGRlciwgSVdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcblxuaW1wb3J0ICogYXMgVGFza3MgZnJvbSAnLi4vLi4vY29tbW9uL3Rhc2tzLmpzJztcbmltcG9ydCB7IHBhcnNlLCBJUGFyc2VSZXN1bHQsIElQcm9ibGVtUmVwb3J0ZXIsIElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uLCBJQ3VzdG9tVGFzaywgVGFza0NvbmZpZ1NvdXJjZSwgSVBhcnNlQ29udGV4dCwgUHJvYmxlbU1hdGNoZXJDb252ZXJ0ZXIsIElHbG9iYWxzLCBJVGFza1BhcnNlUmVzdWx0LCBVVUlETWFwLCBUYXNrUGFyc2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rhc2tDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvdGVzdC9jb21tb24vdGVzdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJVGFza0RlZmluaXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi90YXNrRGVmaW5pdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCB3b3Jrc3BhY2VGb2xkZXI6IFdvcmtzcGFjZUZvbGRlciA9IG5ldyBXb3Jrc3BhY2VGb2xkZXIoe1xuXHR1cmk6IFVSSS5maWxlKCcvd29ya3NwYWNlL2ZvbGRlck9uZScpLFxuXHRuYW1lOiAnZm9sZGVyT25lJyxcblx0aW5kZXg6IDBcbn0pO1xuXG5jb25zdCB3b3Jrc3BhY2U6IElXb3Jrc3BhY2UgPSBuZXcgV29ya3NwYWNlKCdpZCcsIFt3b3Jrc3BhY2VGb2xkZXJdKTtcblxuY2xhc3MgUHJvYmxlbVJlcG9ydGVyIGltcGxlbWVudHMgSVByb2JsZW1SZXBvcnRlciB7XG5cblx0cHJpdmF0ZSBfdmFsaWRhdGlvblN0YXR1czogVmFsaWRhdGlvblN0YXR1cyA9IG5ldyBWYWxpZGF0aW9uU3RhdHVzKCk7XG5cblx0cHVibGljIHJlY2VpdmVkTWVzc2FnZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwdWJsaWMgbGFzdE1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZyhtZXNzYWdlKTtcblx0fVxuXG5cdHB1YmxpYyB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubG9nKG1lc3NhZ2UpO1xuXHR9XG5cblx0cHVibGljIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubG9nKG1lc3NhZ2UpO1xuXHR9XG5cblx0cHVibGljIGZhdGFsKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubG9nKG1lc3NhZ2UpO1xuXHR9XG5cblx0cHVibGljIGdldCBzdGF0dXMoKTogVmFsaWRhdGlvblN0YXR1cyB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbGlkYXRpb25TdGF0dXM7XG5cdH1cblxuXHRwcml2YXRlIGxvZyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLnJlY2VpdmVkTWVzc2FnZSA9IHRydWU7XG5cdFx0dGhpcy5sYXN0TWVzc2FnZSA9IG1lc3NhZ2U7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMubGFzdE1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdH1cbn1cblxuY2xhc3MgQ29uZmlndXJhdGlvbkJ1aWxkZXIge1xuXG5cdHB1YmxpYyByZXN1bHQ6IFRhc2tzLlRhc2tbXTtcblx0cHJpdmF0ZSBidWlsZGVyczogQ3VzdG9tVGFza0J1aWxkZXJbXTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLnJlc3VsdCA9IFtdO1xuXHRcdHRoaXMuYnVpbGRlcnMgPSBbXTtcblx0fVxuXG5cdHB1YmxpYyB0YXNrKG5hbWU6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKTogQ3VzdG9tVGFza0J1aWxkZXIge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ3VzdG9tVGFza0J1aWxkZXIodGhpcywgbmFtZSwgY29tbWFuZCk7XG5cdFx0dGhpcy5idWlsZGVycy5wdXNoKGJ1aWxkZXIpO1xuXHRcdHRoaXMucmVzdWx0LnB1c2goYnVpbGRlci5yZXN1bHQpO1xuXHRcdHJldHVybiBidWlsZGVyO1xuXHR9XG5cblx0cHVibGljIGRvbmUoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBidWlsZGVyIG9mIHRoaXMuYnVpbGRlcnMpIHtcblx0XHRcdGJ1aWxkZXIuZG9uZSgpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBQcmVzZW50YXRpb25CdWlsZGVyIHtcblxuXHRwdWJsaWMgcmVzdWx0OiBUYXNrcy5JUHJlc2VudGF0aW9uT3B0aW9ucztcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcGFyZW50OiBDb21tYW5kQ29uZmlndXJhdGlvbkJ1aWxkZXIpIHtcblx0XHR0aGlzLnJlc3VsdCA9IHsgZWNobzogZmFsc2UsIHJldmVhbDogVGFza3MuUmV2ZWFsS2luZC5BbHdheXMsIHJldmVhbFByb2JsZW1zOiBUYXNrcy5SZXZlYWxQcm9ibGVtS2luZC5OZXZlciwgZm9jdXM6IGZhbHNlLCBwYW5lbDogVGFza3MuUGFuZWxLaW5kLlNoYXJlZCwgc2hvd1JldXNlTWVzc2FnZTogdHJ1ZSwgY2xlYXI6IGZhbHNlLCBjbG9zZTogZmFsc2UgfTtcblx0fVxuXG5cdHB1YmxpYyBlY2hvKHZhbHVlOiBib29sZWFuKTogUHJlc2VudGF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuZWNobyA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIHJldmVhbCh2YWx1ZTogVGFza3MuUmV2ZWFsS2luZCk6IFByZXNlbnRhdGlvbkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LnJldmVhbCA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKHZhbHVlOiBib29sZWFuKTogUHJlc2VudGF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuZm9jdXMgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBpbnN0YW5jZSh2YWx1ZTogVGFza3MuUGFuZWxLaW5kKTogUHJlc2VudGF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQucGFuZWwgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBzaG93UmV1c2VNZXNzYWdlKHZhbHVlOiBib29sZWFuKTogUHJlc2VudGF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuc2hvd1JldXNlTWVzc2FnZSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGNsb3NlKHZhbHVlOiBib29sZWFuKTogUHJlc2VudGF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuY2xvc2UgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBkb25lKCk6IHZvaWQge1xuXHR9XG59XG5cbmNsYXNzIENvbW1hbmRDb25maWd1cmF0aW9uQnVpbGRlciB7XG5cdHB1YmxpYyByZXN1bHQ6IFRhc2tzLklDb21tYW5kQ29uZmlndXJhdGlvbjtcblxuXHRwcml2YXRlIHByZXNlbnRhdGlvbkJ1aWxkZXI6IFByZXNlbnRhdGlvbkJ1aWxkZXI7XG5cblx0Y29uc3RydWN0b3IocHVibGljIHBhcmVudDogQ3VzdG9tVGFza0J1aWxkZXIsIGNvbW1hbmQ6IHN0cmluZykge1xuXHRcdHRoaXMucHJlc2VudGF0aW9uQnVpbGRlciA9IG5ldyBQcmVzZW50YXRpb25CdWlsZGVyKHRoaXMpO1xuXHRcdHRoaXMucmVzdWx0ID0ge1xuXHRcdFx0bmFtZTogY29tbWFuZCxcblx0XHRcdHJ1bnRpbWU6IFRhc2tzLlJ1bnRpbWVUeXBlLlByb2Nlc3MsXG5cdFx0XHRhcmdzOiBbXSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0Y3dkOiAnJHt3b3Jrc3BhY2VGb2xkZXJ9J1xuXHRcdFx0fSxcblx0XHRcdHByZXNlbnRhdGlvbjogdGhpcy5wcmVzZW50YXRpb25CdWlsZGVyLnJlc3VsdCxcblx0XHRcdHN1cHByZXNzVGFza05hbWU6IGZhbHNlXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBuYW1lKHZhbHVlOiBzdHJpbmcpOiBDb21tYW5kQ29uZmlndXJhdGlvbkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0Lm5hbWUgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBydW50aW1lKHZhbHVlOiBUYXNrcy5SdW50aW1lVHlwZSk6IENvbW1hbmRDb25maWd1cmF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQucnVudGltZSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGFyZ3ModmFsdWU6IHN0cmluZ1tdKTogQ29tbWFuZENvbmZpZ3VyYXRpb25CdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5hcmdzID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgb3B0aW9ucyh2YWx1ZTogVGFza3MuQ29tbWFuZE9wdGlvbnMpOiBDb21tYW5kQ29uZmlndXJhdGlvbkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0Lm9wdGlvbnMgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyB0YXNrU2VsZWN0b3IodmFsdWU6IHN0cmluZyk6IENvbW1hbmRDb25maWd1cmF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQudGFza1NlbGVjdG9yID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgc3VwcHJlc3NUYXNrTmFtZSh2YWx1ZTogYm9vbGVhbik6IENvbW1hbmRDb25maWd1cmF0aW9uQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuc3VwcHJlc3NUYXNrTmFtZSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIHByZXNlbnRhdGlvbigpOiBQcmVzZW50YXRpb25CdWlsZGVyIHtcblx0XHRyZXR1cm4gdGhpcy5wcmVzZW50YXRpb25CdWlsZGVyO1xuXHR9XG5cblx0cHVibGljIGRvbmUodGFza05hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMucmVzdWx0LmFyZ3MgPSB0aGlzLnJlc3VsdC5hcmdzIS5tYXAoYXJnID0+IGFyZyA9PT0gJyRuYW1lJyA/IHRhc2tOYW1lIDogYXJnKTtcblx0XHR0aGlzLnByZXNlbnRhdGlvbkJ1aWxkZXIuZG9uZSgpO1xuXHR9XG59XG5cbmNsYXNzIEN1c3RvbVRhc2tCdWlsZGVyIHtcblxuXHRwdWJsaWMgcmVzdWx0OiBUYXNrcy5DdXN0b21UYXNrO1xuXHRwcml2YXRlIGNvbW1hbmRCdWlsZGVyOiBDb21tYW5kQ29uZmlndXJhdGlvbkJ1aWxkZXI7XG5cblx0Y29uc3RydWN0b3IocHVibGljIHBhcmVudDogQ29uZmlndXJhdGlvbkJ1aWxkZXIsIG5hbWU6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5jb21tYW5kQnVpbGRlciA9IG5ldyBDb21tYW5kQ29uZmlndXJhdGlvbkJ1aWxkZXIodGhpcywgY29tbWFuZCk7XG5cdFx0dGhpcy5yZXN1bHQgPSBuZXcgVGFza3MuQ3VzdG9tVGFzayhcblx0XHRcdG5hbWUsXG5cdFx0XHR7IGtpbmQ6IFRhc2tzLlRhc2tTb3VyY2VLaW5kLldvcmtzcGFjZSwgbGFiZWw6ICd3b3Jrc3BhY2UnLCBjb25maWc6IHsgd29ya3NwYWNlRm9sZGVyOiB3b3Jrc3BhY2VGb2xkZXIsIGVsZW1lbnQ6IHVuZGVmaW5lZCwgaW5kZXg6IC0xLCBmaWxlOiAnLnZzY29kZS90YXNrcy5qc29uJyB9IH0sXG5cdFx0XHRuYW1lLFxuXHRcdFx0VGFza3MuQ1VTVE9NSVpFRF9UQVNLX1RZUEUsXG5cdFx0XHR0aGlzLmNvbW1hbmRCdWlsZGVyLnJlc3VsdCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0eyByZWV2YWx1YXRlT25SZXJ1bjogdHJ1ZSB9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZGVudGlmaWVyOiBuYW1lLFxuXHRcdFx0XHRuYW1lOiBuYW1lLFxuXHRcdFx0XHRpc0JhY2tncm91bmQ6IGZhbHNlLFxuXHRcdFx0XHRwcm9tcHRPbkNsb3NlOiB0cnVlLFxuXHRcdFx0XHRwcm9ibGVtTWF0Y2hlcnM6IFtdLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRwdWJsaWMgaWRlbnRpZmllcih2YWx1ZTogc3RyaW5nKTogQ3VzdG9tVGFza0J1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlkZW50aWZpZXIgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBncm91cCh2YWx1ZTogc3RyaW5nIHwgVGFza3MuVGFza0dyb3VwKTogQ3VzdG9tVGFza0J1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgaXNCYWNrZ3JvdW5kKHZhbHVlOiBib29sZWFuKTogQ3VzdG9tVGFza0J1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIHByb21wdE9uQ2xvc2UodmFsdWU6IGJvb2xlYW4pOiBDdXN0b21UYXNrQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvbXB0T25DbG9zZSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIHByb2JsZW1NYXRjaGVyKCk6IFByb2JsZW1NYXRjaGVyQnVpbGRlciB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBQcm9ibGVtTWF0Y2hlckJ1aWxkZXIodGhpcyk7XG5cdFx0dGhpcy5yZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzIS5wdXNoKGJ1aWxkZXIucmVzdWx0KTtcblx0XHRyZXR1cm4gYnVpbGRlcjtcblx0fVxuXG5cdHB1YmxpYyBjb21tYW5kKCk6IENvbW1hbmRDb25maWd1cmF0aW9uQnVpbGRlciB7XG5cdFx0cmV0dXJuIHRoaXMuY29tbWFuZEJ1aWxkZXI7XG5cdH1cblxuXHRwdWJsaWMgZG9uZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbW1hbmRCdWlsZGVyLmRvbmUodGhpcy5yZXN1bHQuY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSEpO1xuXHR9XG59XG5cbmNsYXNzIFByb2JsZW1NYXRjaGVyQnVpbGRlciB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBERUZBVUxUX1VVSUQgPSBVVUlELmdlbmVyYXRlVXVpZCgpO1xuXG5cdHB1YmxpYyByZXN1bHQ6IFByb2JsZW1NYXRjaGVyO1xuXG5cdGNvbnN0cnVjdG9yKHB1YmxpYyBwYXJlbnQ6IEN1c3RvbVRhc2tCdWlsZGVyKSB7XG5cdFx0dGhpcy5yZXN1bHQgPSB7XG5cdFx0XHRvd25lcjogUHJvYmxlbU1hdGNoZXJCdWlsZGVyLkRFRkFVTFRfVVVJRCxcblx0XHRcdGFwcGx5VG86IEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cyxcblx0XHRcdHNldmVyaXR5OiB1bmRlZmluZWQsXG5cdFx0XHRmaWxlTG9jYXRpb246IEZpbGVMb2NhdGlvbktpbmQuUmVsYXRpdmUsXG5cdFx0XHRmaWxlUHJlZml4OiAnJHt3b3Jrc3BhY2VGb2xkZXJ9Jyxcblx0XHRcdHBhdHRlcm46IHVuZGVmaW5lZCFcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIG93bmVyKHZhbHVlOiBzdHJpbmcpOiBQcm9ibGVtTWF0Y2hlckJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0Lm93bmVyID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgYXBwbHlUbyh2YWx1ZTogQXBwbHlUb0tpbmQpOiBQcm9ibGVtTWF0Y2hlckJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmFwcGx5VG8gPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBzZXZlcml0eSh2YWx1ZTogU2V2ZXJpdHkpOiBQcm9ibGVtTWF0Y2hlckJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LnNldmVyaXR5ID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgZmlsZUxvY2F0aW9uKHZhbHVlOiBGaWxlTG9jYXRpb25LaW5kKTogUHJvYmxlbU1hdGNoZXJCdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5maWxlTG9jYXRpb24gPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBmaWxlUHJlZml4KHZhbHVlOiBzdHJpbmcpOiBQcm9ibGVtTWF0Y2hlckJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmZpbGVQcmVmaXggPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBwYXR0ZXJuKHJlZ0V4cDogUmVnRXhwKTogUGF0dGVybkJ1aWxkZXIge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgUGF0dGVybkJ1aWxkZXIodGhpcywgcmVnRXhwKTtcblx0XHRpZiAoIXRoaXMucmVzdWx0LnBhdHRlcm4pIHtcblx0XHRcdHRoaXMucmVzdWx0LnBhdHRlcm4gPSBidWlsZGVyLnJlc3VsdDtcblx0XHR9XG5cdFx0cmV0dXJuIGJ1aWxkZXI7XG5cdH1cbn1cblxuY2xhc3MgUGF0dGVybkJ1aWxkZXIge1xuXHRwdWJsaWMgcmVzdWx0OiBJUHJvYmxlbVBhdHRlcm47XG5cblx0Y29uc3RydWN0b3IocHVibGljIHBhcmVudDogUHJvYmxlbU1hdGNoZXJCdWlsZGVyLCByZWdFeHA6IFJlZ0V4cCkge1xuXHRcdHRoaXMucmVzdWx0ID0ge1xuXHRcdFx0cmVnZXhwOiByZWdFeHAsXG5cdFx0XHRmaWxlOiAxLFxuXHRcdFx0bWVzc2FnZTogMCxcblx0XHRcdGxpbmU6IDIsXG5cdFx0XHRjaGFyYWN0ZXI6IDNcblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGZpbGUodmFsdWU6IG51bWJlcik6IFBhdHRlcm5CdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5maWxlID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgbWVzc2FnZSh2YWx1ZTogbnVtYmVyKTogUGF0dGVybkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0Lm1lc3NhZ2UgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBsb2NhdGlvbih2YWx1ZTogbnVtYmVyKTogUGF0dGVybkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmxvY2F0aW9uID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgbGluZSh2YWx1ZTogbnVtYmVyKTogUGF0dGVybkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmxpbmUgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBjaGFyYWN0ZXIodmFsdWU6IG51bWJlcik6IFBhdHRlcm5CdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5jaGFyYWN0ZXIgPSB2YWx1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdHB1YmxpYyBlbmRMaW5lKHZhbHVlOiBudW1iZXIpOiBQYXR0ZXJuQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQuZW5kTGluZSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGVuZENoYXJhY3Rlcih2YWx1ZTogbnVtYmVyKTogUGF0dGVybkJ1aWxkZXIge1xuXHRcdHRoaXMucmVzdWx0LmVuZENoYXJhY3RlciA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGNvZGUodmFsdWU6IG51bWJlcik6IFBhdHRlcm5CdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5jb2RlID0gdmFsdWU7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRwdWJsaWMgc2V2ZXJpdHkodmFsdWU6IG51bWJlcik6IFBhdHRlcm5CdWlsZGVyIHtcblx0XHR0aGlzLnJlc3VsdC5zZXZlcml0eSA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0cHVibGljIGxvb3AodmFsdWU6IGJvb2xlYW4pOiBQYXR0ZXJuQnVpbGRlciB7XG5cdFx0dGhpcy5yZXN1bHQubG9vcCA9IHZhbHVlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG59XG5cbmNsYXNzIFRhc2tzTW9ja0NvbnRleHRLZXlTZXJ2aWNlIGV4dGVuZHMgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIHtcblx0cHVibGljIG92ZXJyaWRlIGdldENvbnRleHQoZG9tTm9kZTogSFRNTEVsZW1lbnQpOiBJQ29udGV4dCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldFZhbHVlOiA8VD4oX2tleTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHJldHVybiA8VD48dW5rbm93bj50cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuZnVuY3Rpb24gdGVzdERlZmF1bHRQcm9ibGVtTWF0Y2hlcihleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24sIHJlc29sdmVkOiBudW1iZXIpIHtcblx0Y29uc3QgcmVwb3J0ZXIgPSBuZXcgUHJvYmxlbVJlcG9ydGVyKCk7XG5cdGNvbnN0IHJlc3VsdCA9IHBhcnNlKHdvcmtzcGFjZUZvbGRlciwgd29ya3NwYWNlLCBQbGF0Zm9ybS5wbGF0Zm9ybSwgZXh0ZXJuYWwsIHJlcG9ydGVyLCBUYXNrQ29uZmlnU291cmNlLlRhc2tzSnNvbiwgbmV3IFRhc2tzTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCkpO1xuXHRhc3NlcnQub2soIXJlcG9ydGVyLnJlY2VpdmVkTWVzc2FnZSk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuY3VzdG9tLmxlbmd0aCwgMSk7XG5cdGNvbnN0IHRhc2sgPSByZXN1bHQuY3VzdG9tWzBdO1xuXHRhc3NlcnQub2sodGFzayk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbCh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyEubGVuZ3RoLCByZXNvbHZlZCk7XG59XG5cbmZ1bmN0aW9uIHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiwgYnVpbGRlcjogQ29uZmlndXJhdGlvbkJ1aWxkZXIpOiB2b2lkIHtcblx0YnVpbGRlci5kb25lKCk7XG5cdGNvbnN0IHJlcG9ydGVyID0gbmV3IFByb2JsZW1SZXBvcnRlcigpO1xuXHRjb25zdCByZXN1bHQgPSBwYXJzZSh3b3Jrc3BhY2VGb2xkZXIsIHdvcmtzcGFjZSwgUGxhdGZvcm0ucGxhdGZvcm0sIGV4dGVybmFsLCByZXBvcnRlciwgVGFza0NvbmZpZ1NvdXJjZS5UYXNrc0pzb24sIG5ldyBUYXNrc01vY2tDb250ZXh0S2V5U2VydmljZSgpKTtcblx0aWYgKHJlcG9ydGVyLnJlY2VpdmVkTWVzc2FnZSkge1xuXHRcdGFzc2VydC5vayhmYWxzZSwgcmVwb3J0ZXIubGFzdE1lc3NhZ2UpO1xuXHR9XG5cdGFzc2VydENvbmZpZ3VyYXRpb24ocmVzdWx0LCBidWlsZGVyLnJlc3VsdCk7XG59XG5cbmNsYXNzIFRhc2tHcm91cE1hcCB7XG5cdHByaXZhdGUgX3N0b3JlOiB7IFtrZXk6IHN0cmluZ106IFRhc2tzLlRhc2tbXSB9O1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHRoaXMuX3N0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxuXG5cdHB1YmxpYyBhZGQoZ3JvdXA6IHN0cmluZywgdGFzazogVGFza3MuVGFzayk6IHZvaWQge1xuXHRcdGxldCB0YXNrcyA9IHRoaXMuX3N0b3JlW2dyb3VwXTtcblx0XHRpZiAoIXRhc2tzKSB7XG5cdFx0XHR0YXNrcyA9IFtdO1xuXHRcdFx0dGhpcy5fc3RvcmVbZ3JvdXBdID0gdGFza3M7XG5cdFx0fVxuXHRcdHRhc2tzLnB1c2godGFzayk7XG5cdH1cblxuXHRwdWJsaWMgc3RhdGljIGFzc2VydChhY3R1YWw6IFRhc2tHcm91cE1hcCwgZXhwZWN0ZWQ6IFRhc2tHcm91cE1hcCk6IHZvaWQge1xuXHRcdGNvbnN0IGFjdHVhbEtleXMgPSBPYmplY3Qua2V5cyhhY3R1YWwuX3N0b3JlKTtcblx0XHRjb25zdCBleHBlY3RlZEtleXMgPSBPYmplY3Qua2V5cyhleHBlY3RlZC5fc3RvcmUpO1xuXHRcdGlmIChhY3R1YWxLZXlzLmxlbmd0aCA9PT0gMCAmJiBleHBlY3RlZEtleXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxLZXlzLmxlbmd0aCwgZXhwZWN0ZWRLZXlzLmxlbmd0aCk7XG5cdFx0YWN0dWFsS2V5cy5mb3JFYWNoKGtleSA9PiBhc3NlcnQub2soZXhwZWN0ZWQuX3N0b3JlW2tleV0pKTtcblx0XHRleHBlY3RlZEtleXMuZm9yRWFjaChrZXkgPT4gYWN0dWFsLl9zdG9yZVtrZXldKTtcblx0XHRhY3R1YWxLZXlzLmZvckVhY2goKGtleSkgPT4ge1xuXHRcdFx0Y29uc3QgYWN0dWFsVGFza3MgPSBhY3R1YWwuX3N0b3JlW2tleV07XG5cdFx0XHRjb25zdCBleHBlY3RlZFRhc2tzID0gZXhwZWN0ZWQuX3N0b3JlW2tleV07XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsVGFza3MubGVuZ3RoLCBleHBlY3RlZFRhc2tzLmxlbmd0aCk7XG5cdFx0XHRpZiAoYWN0dWFsVGFza3MubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxUYXNrc1swXS5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lLCBleHBlY3RlZFRhc2tzWzBdLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBleHBlY3RlZFRhc2tNYXA6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdGV4cGVjdGVkVGFza3MuZm9yRWFjaCh0YXNrID0+IGV4cGVjdGVkVGFza01hcFt0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUhXSA9IHRydWUpO1xuXHRcdFx0YWN0dWFsVGFza3MuZm9yRWFjaCh0YXNrID0+IGRlbGV0ZSBleHBlY3RlZFRhc2tNYXBbdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lIV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKE9iamVjdC5rZXlzKGV4cGVjdGVkVGFza01hcCkubGVuZ3RoLCAwKTtcblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBhc3NlcnRDb25maWd1cmF0aW9uKHJlc3VsdDogSVBhcnNlUmVzdWx0LCBleHBlY3RlZDogVGFza3MuVGFza1tdKTogdm9pZCB7XG5cdGFzc2VydC5vayhyZXN1bHQudmFsaWRhdGlvblN0YXR1cy5pc09LKCkpO1xuXHRjb25zdCBhY3R1YWwgPSByZXN1bHQuY3VzdG9tO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGFjdHVhbCwgdHlwZW9mIGV4cGVjdGVkKTtcblx0aWYgKCFhY3R1YWwpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyBXZSBjYW4ndCBjb21wYXJlIElkcyBzaW5jZSB0aGUgcGFyc2VyIHVzZXMgVVVJRCB3aGljaCBhcmUgcmFuZG9tXG5cdC8vIFNvIGNyZWF0ZSBhIG5ldyBtYXAgdXNpbmcgdGhlIG5hbWUuXG5cdGNvbnN0IGFjdHVhbFRhc2tzOiB7IFtrZXk6IHN0cmluZ106IFRhc2tzLlRhc2sgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdGNvbnN0IGFjdHVhbElkMk5hbWU6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRjb25zdCBhY3R1YWxUYXNrR3JvdXBzID0gbmV3IFRhc2tHcm91cE1hcCgpO1xuXHRhY3R1YWwuZm9yRWFjaCh0YXNrID0+IHtcblx0XHRhc3NlcnQub2soIWFjdHVhbFRhc2tzW3Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSFdKTtcblx0XHRhY3R1YWxUYXNrc1t0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUhXSA9IHRhc2s7XG5cdFx0YWN0dWFsSWQyTmFtZVt0YXNrLl9pZF0gPSB0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLm5hbWUhO1xuXG5cdFx0Y29uc3QgdGFza0lkID0gVGFza3MuVGFza0dyb3VwLmZyb20odGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCk/Ll9pZDtcblx0XHRpZiAodGFza0lkKSB7XG5cdFx0XHRhY3R1YWxUYXNrR3JvdXBzLmFkZCh0YXNrSWQsIHRhc2spO1xuXHRcdH1cblx0fSk7XG5cdGNvbnN0IGV4cGVjdGVkVGFza3M6IHsgW2tleTogc3RyaW5nXTogVGFza3MuVGFzayB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0Y29uc3QgZXhwZWN0ZWRUYXNrR3JvdXAgPSBuZXcgVGFza0dyb3VwTWFwKCk7XG5cdGV4cGVjdGVkLmZvckVhY2godGFzayA9PiB7XG5cdFx0YXNzZXJ0Lm9rKCFleHBlY3RlZFRhc2tzW3Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSFdKTtcblx0XHRleHBlY3RlZFRhc2tzW3Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSFdID0gdGFzaztcblx0XHRjb25zdCB0YXNrSWQgPSBUYXNrcy5UYXNrR3JvdXAuZnJvbSh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwKT8uX2lkO1xuXHRcdGlmICh0YXNrSWQpIHtcblx0XHRcdGV4cGVjdGVkVGFza0dyb3VwLmFkZCh0YXNrSWQsIHRhc2spO1xuXHRcdH1cblx0fSk7XG5cdGNvbnN0IGFjdHVhbEtleXMgPSBPYmplY3Qua2V5cyhhY3R1YWxUYXNrcyk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxLZXlzLmxlbmd0aCwgZXhwZWN0ZWQubGVuZ3RoKTtcblx0YWN0dWFsS2V5cy5mb3JFYWNoKChrZXkpID0+IHtcblx0XHRjb25zdCBhY3R1YWxUYXNrID0gYWN0dWFsVGFza3Nba2V5XTtcblx0XHRjb25zdCBleHBlY3RlZFRhc2sgPSBleHBlY3RlZFRhc2tzW2tleV07XG5cdFx0YXNzZXJ0Lm9rKGV4cGVjdGVkVGFzayk7XG5cdFx0YXNzZXJ0VGFzayhhY3R1YWxUYXNrLCBleHBlY3RlZFRhc2spO1xuXHR9KTtcblx0VGFza0dyb3VwTWFwLmFzc2VydChhY3R1YWxUYXNrR3JvdXBzLCBleHBlY3RlZFRhc2tHcm91cCk7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFRhc2soYWN0dWFsOiBUYXNrcy5UYXNrLCBleHBlY3RlZDogVGFza3MuVGFzaykge1xuXHRhc3NlcnQub2soYWN0dWFsLl9pZCk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSwgZXhwZWN0ZWQuY29uZmlndXJhdGlvblByb3BlcnRpZXMubmFtZSwgJ25hbWUnKTtcblx0aWYgKCFUYXNrcy5Jbk1lbW9yeVRhc2suaXMoYWN0dWFsKSAmJiAhVGFza3MuSW5NZW1vcnlUYXNrLmlzKGV4cGVjdGVkKSkge1xuXHRcdGFzc2VydENvbW1hbmRDb25maWd1cmF0aW9uKGFjdHVhbC5jb21tYW5kLCBleHBlY3RlZC5jb21tYW5kKTtcblx0fVxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmlzQmFja2dyb3VuZCwgZXhwZWN0ZWQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaXNCYWNrZ3JvdW5kLCAnaXNCYWNrZ3JvdW5kJyk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycywgdHlwZW9mIGV4cGVjdGVkLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvbXB0T25DbG9zZSwgZXhwZWN0ZWQuY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvbXB0T25DbG9zZSwgJ3Byb21wdE9uQ2xvc2UnKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwuY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAsIHR5cGVvZiBleHBlY3RlZC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCwgYGdyb3VwIHR5cGVzIHVuZXF1YWxgKTtcblxuXHRpZiAoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycyAmJiBleHBlY3RlZC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGgsIGV4cGVjdGVkLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0YXNzZXJ0UHJvYmxlbU1hdGNoZXIoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLnByb2JsZW1NYXRjaGVyc1tpXSwgZXhwZWN0ZWQuY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzW2ldKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwICYmIGV4cGVjdGVkLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwKSB7XG5cdFx0aWYgKFR5cGVzLmlzU3RyaW5nKGFjdHVhbC5jb25maWd1cmF0aW9uUHJvcGVydGllcy5ncm91cCkpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAsIGV4cGVjdGVkLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0R3JvdXAoYWN0dWFsLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmdyb3VwIGFzIFRhc2tzLlRhc2tHcm91cCwgZXhwZWN0ZWQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuZ3JvdXAgYXMgVGFza3MuVGFza0dyb3VwKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0Q29tbWFuZENvbmZpZ3VyYXRpb24oYWN0dWFsOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24sIGV4cGVjdGVkOiBUYXNrcy5JQ29tbWFuZENvbmZpZ3VyYXRpb24pIHtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwsIHR5cGVvZiBleHBlY3RlZCk7XG5cdGlmIChhY3R1YWwgJiYgZXhwZWN0ZWQpIHtcblx0XHRhc3NlcnRQcmVzZW50YXRpb24oYWN0dWFsLnByZXNlbnRhdGlvbiEsIGV4cGVjdGVkLnByZXNlbnRhdGlvbiEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubmFtZSwgZXhwZWN0ZWQubmFtZSwgJ25hbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJ1bnRpbWUsIGV4cGVjdGVkLnJ1bnRpbWUsICdydW50aW1lIHR5cGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnN1cHByZXNzVGFza05hbWUsIGV4cGVjdGVkLnN1cHByZXNzVGFza05hbWUsICdzdXBwcmVzc1Rhc2tOYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC50YXNrU2VsZWN0b3IsIGV4cGVjdGVkLnRhc2tTZWxlY3RvciwgJ3Rhc2tTZWxlY3RvcicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmFyZ3MsIGV4cGVjdGVkLmFyZ3MsICdhcmdzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwub3B0aW9ucywgdHlwZW9mIGV4cGVjdGVkLm9wdGlvbnMpO1xuXHRcdGlmIChhY3R1YWwub3B0aW9ucyAmJiBleHBlY3RlZC5vcHRpb25zKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm9wdGlvbnMuY3dkLCBleHBlY3RlZC5vcHRpb25zLmN3ZCwgJ2N3ZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwub3B0aW9ucy5lbnYsIHR5cGVvZiBleHBlY3RlZC5vcHRpb25zLmVudiwgJ2VudicpO1xuXHRcdFx0aWYgKGFjdHVhbC5vcHRpb25zLmVudiAmJiBleHBlY3RlZC5vcHRpb25zLmVudikge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5vcHRpb25zLmVudiwgZXhwZWN0ZWQub3B0aW9ucy5lbnYsICdlbnYnKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0R3JvdXAoYWN0dWFsOiBUYXNrcy5UYXNrR3JvdXAsIGV4cGVjdGVkOiBUYXNrcy5UYXNrR3JvdXApIHtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwsIHR5cGVvZiBleHBlY3RlZCk7XG5cdGlmIChhY3R1YWwgJiYgZXhwZWN0ZWQpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLl9pZCwgZXhwZWN0ZWQuX2lkLCBgZ3JvdXAgaWRzIHVuZXF1YWwuIGFjdHVhbDogJHthY3R1YWwuX2lkfSBleHBlY3RlZCAke2V4cGVjdGVkLl9pZH1gKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmlzRGVmYXVsdCwgZXhwZWN0ZWQuaXNEZWZhdWx0LCBgZ3JvdXAgZGVmYXVsdHMgdW5lcXVhbC4gYWN0dWFsOiAke2FjdHVhbC5pc0RlZmF1bHR9IGV4cGVjdGVkICR7ZXhwZWN0ZWQuaXNEZWZhdWx0fWApO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFByZXNlbnRhdGlvbihhY3R1YWw6IFRhc2tzLklQcmVzZW50YXRpb25PcHRpb25zLCBleHBlY3RlZDogVGFza3MuSVByZXNlbnRhdGlvbk9wdGlvbnMpIHtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhY3R1YWwsIHR5cGVvZiBleHBlY3RlZCk7XG5cdGlmIChhY3R1YWwgJiYgZXhwZWN0ZWQpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmVjaG8sIGV4cGVjdGVkLmVjaG8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmV2ZWFsLCBleHBlY3RlZC5yZXZlYWwpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGFzc2VydFByb2JsZW1NYXRjaGVyKGFjdHVhbDogc3RyaW5nIHwgUHJvYmxlbU1hdGNoZXIsIGV4cGVjdGVkOiBzdHJpbmcgfCBQcm9ibGVtTWF0Y2hlcikge1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGFjdHVhbCwgdHlwZW9mIGV4cGVjdGVkKTtcblx0aWYgKHR5cGVvZiBhY3R1YWwgPT09ICdzdHJpbmcnICYmIHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgJ1Byb2JsZW0gbWF0Y2hlciByZWZlcmVuY2VzIGFyZSBkaWZmZXJlbnQnKTtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKHR5cGVvZiBhY3R1YWwgIT09ICdzdHJpbmcnICYmIHR5cGVvZiBleHBlY3RlZCAhPT0gJ3N0cmluZycpIHtcblx0XHRpZiAoZXhwZWN0ZWQub3duZXIgPT09IFByb2JsZW1NYXRjaGVyQnVpbGRlci5ERUZBVUxUX1VVSUQpIHtcblx0XHRcdGFzc2VydC5vayhVVUlELmlzVVVJRChhY3R1YWwub3duZXIpLCAnT3duZXIgbXVzdCBiZSBhIFVVSUQnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5vd25lciwgZXhwZWN0ZWQub3duZXIpO1xuXHRcdH1cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmFwcGx5VG8sIGV4cGVjdGVkLmFwcGx5VG8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuc2V2ZXJpdHksIGV4cGVjdGVkLnNldmVyaXR5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmZpbGVMb2NhdGlvbiwgZXhwZWN0ZWQuZmlsZUxvY2F0aW9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmZpbGVQcmVmaXgsIGV4cGVjdGVkLmZpbGVQcmVmaXgpO1xuXHRcdGlmIChhY3R1YWwucGF0dGVybiAmJiBleHBlY3RlZC5wYXR0ZXJuKSB7XG5cdFx0XHRhc3NlcnRQcm9ibGVtUGF0dGVybnMoYWN0dWFsLnBhdHRlcm4sIGV4cGVjdGVkLnBhdHRlcm4pO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBhc3NlcnRQcm9ibGVtUGF0dGVybnMoYWN0dWFsOiBJUHJvYmxlbVBhdHRlcm4gfCBJUHJvYmxlbVBhdHRlcm5bXSwgZXhwZWN0ZWQ6IElQcm9ibGVtUGF0dGVybiB8IElQcm9ibGVtUGF0dGVybltdKSB7XG5cdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgYWN0dWFsLCB0eXBlb2YgZXhwZWN0ZWQpO1xuXHRpZiAoQXJyYXkuaXNBcnJheShhY3R1YWwpKSB7XG5cdFx0Y29uc3QgYWN0dWFscyA9IDxJUHJvYmxlbVBhdHRlcm5bXT5hY3R1YWw7XG5cdFx0Y29uc3QgZXhwZWN0ZWRzID0gPElQcm9ibGVtUGF0dGVybltdPmV4cGVjdGVkO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxzLmxlbmd0aCwgZXhwZWN0ZWRzLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhY3R1YWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRhc3NlcnRQcm9ibGVtUGF0dGVybihhY3R1YWxzW2ldLCBleHBlY3RlZHNbaV0pO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRhc3NlcnRQcm9ibGVtUGF0dGVybig8SVByb2JsZW1QYXR0ZXJuPmFjdHVhbCwgPElQcm9ibGVtUGF0dGVybj5leHBlY3RlZCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0UHJvYmxlbVBhdHRlcm4oYWN0dWFsOiBJUHJvYmxlbVBhdHRlcm4sIGV4cGVjdGVkOiBJUHJvYmxlbVBhdHRlcm4pIHtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZWdleHAudG9TdHJpbmcoKSwgZXhwZWN0ZWQucmVnZXhwLnRvU3RyaW5nKCkpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmZpbGUsIGV4cGVjdGVkLmZpbGUpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lc3NhZ2UsIGV4cGVjdGVkLm1lc3NhZ2UpO1xuXHRpZiAodHlwZW9mIGV4cGVjdGVkLmxvY2F0aW9uICE9PSAndW5kZWZpbmVkJykge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYXRpb24sIGV4cGVjdGVkLmxvY2F0aW9uKTtcblx0fSBlbHNlIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxpbmUsIGV4cGVjdGVkLmxpbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY2hhcmFjdGVyLCBleHBlY3RlZC5jaGFyYWN0ZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuZW5kTGluZSwgZXhwZWN0ZWQuZW5kTGluZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5lbmRDaGFyYWN0ZXIsIGV4cGVjdGVkLmVuZENoYXJhY3Rlcik7XG5cdH1cblx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb2RlLCBleHBlY3RlZC5jb2RlKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5zZXZlcml0eSwgZXhwZWN0ZWQuc2V2ZXJpdHkpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvb3AsIGV4cGVjdGVkLmxvb3ApO1xufVxuXG5zdWl0ZSgnVGFza3MgdmVyc2lvbiAwLjEuMCcsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgndGFza3M6IGFsbCBkZWZhdWx0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3RzYycsICd0c2MnKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihcblx0XHRcdHtcblx0XHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdFx0Y29tbWFuZDogJ3RzYydcblx0XHRcdH0sIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZ2xvYmFsIGlzU2hlbGxDb21tYW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3RzYycsICd0c2MnKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdHJ1bnRpbWUoVGFza3MuUnVudGltZVR5cGUuU2hlbGwpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKFxuXHRcdFx0e1xuXHRcdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0aXNTaGVsbENvbW1hbmQ6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBzaG93IG91dHB1dCBzaWxlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRwcmVzZW50YXRpb24oKS5yZXZlYWwoVGFza3MuUmV2ZWFsS2luZC5TaWxlbnQpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKFxuXHRcdFx0e1xuXHRcdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0c2hvd091dHB1dDogJ3NpbGVudCdcblx0XHRcdH0sXG5cdFx0XHRidWlsZGVyXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBwcm9tcHRPbkNsb3NlIGRlZmF1bHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndHNjJywgJ3RzYycpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLkJ1aWxkKS5cblx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKFxuXHRcdFx0e1xuXHRcdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0cHJvbXB0T25DbG9zZTogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGJ1aWxkZXJcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZ2xvYmFsIHByb21wdE9uQ2xvc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndHNjJywgJ3RzYycpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLkJ1aWxkKS5cblx0XHRcdHByb21wdE9uQ2xvc2UoZmFsc2UpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oXG5cdFx0XHR7XG5cdFx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0XHRwcm9tcHRPbkNsb3NlOiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdGJ1aWxkZXJcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZ2xvYmFsIHByb21wdE9uQ2xvc2UgZGVmYXVsdCB3YXRjaGluZycsICgpID0+IHtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0aXNCYWNrZ3JvdW5kKHRydWUpLlxuXHRcdFx0cHJvbXB0T25DbG9zZShmYWxzZSkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihcblx0XHRcdHtcblx0XHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRcdGlzV2F0Y2hpbmc6IHRydWVcblx0XHRcdH0sXG5cdFx0XHRidWlsZGVyXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBzaG93IG91dHB1dCBuZXZlcicsICgpID0+IHtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci5cblx0XHRcdHRhc2soJ3RzYycsICd0c2MnKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLnJldmVhbChUYXNrcy5SZXZlYWxLaW5kLk5ldmVyKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihcblx0XHRcdHtcblx0XHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRcdHNob3dPdXRwdXQ6ICduZXZlcidcblx0XHRcdH0sXG5cdFx0XHRidWlsZGVyXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBlY2hvIENvbW1hbmQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRwcmVzZW50YXRpb24oKS5cblx0XHRcdGVjaG8odHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oXG5cdFx0XHR7XG5cdFx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0XHRlY2hvQ29tbWFuZDogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdGJ1aWxkZXJcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZ2xvYmFsIGFyZ3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRhcmdzKFsnLS1wJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKFxuXHRcdFx0e1xuXHRcdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdCctLXAnXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHRidWlsZGVyXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IG9wdGlvbnMgLSBjd2QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRvcHRpb25zKHtcblx0XHRcdFx0Y3dkOiAnbXlQYXRoJ1xuXHRcdFx0fSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oXG5cdFx0XHR7XG5cdFx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0Y3dkOiAnbXlQYXRoJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YnVpbGRlclxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBvcHRpb25zIC0gZW52JywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLlxuXHRcdFx0dGFzaygndHNjJywgJ3RzYycpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLkJ1aWxkKS5cblx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpLlxuXHRcdFx0b3B0aW9ucyh7IGN3ZDogJyR7d29ya3NwYWNlRm9sZGVyfScsIGVudjogeyBrZXk6ICd2YWx1ZScgfSB9KTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihcblx0XHRcdHtcblx0XHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRlbnY6IHtcblx0XHRcdFx0XHRcdGtleTogJ3ZhbHVlJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGJ1aWxkZXJcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogb3Mgd2luZG93cycsICgpID0+IHtcblx0XHRjb25zdCBuYW1lOiBzdHJpbmcgPSBQbGF0Zm9ybS5pc1dpbmRvd3MgPyAndHNjLndpbicgOiAndHNjJztcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci5cblx0XHRcdHRhc2sobmFtZSwgbmFtZSkuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSk7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRjb21tYW5kOiAndHNjLndpbidcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IG9zIHdpbmRvd3MgJiBnbG9iYWwgaXNTaGVsbENvbW1hbmQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbmFtZTogc3RyaW5nID0gUGxhdGZvcm0uaXNXaW5kb3dzID8gJ3RzYy53aW4nIDogJ3RzYyc7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKG5hbWUsIG5hbWUpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLkJ1aWxkKS5cblx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpLlxuXHRcdFx0cnVudGltZShUYXNrcy5SdW50aW1lVHlwZS5TaGVsbCk7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0aXNTaGVsbENvbW1hbmQ6IHRydWUsXG5cdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdGNvbW1hbmQ6ICd0c2Mud2luJ1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogb3MgbWFjJywgKCkgPT4ge1xuXHRcdGNvbnN0IG5hbWU6IHN0cmluZyA9IFBsYXRmb3JtLmlzTWFjaW50b3NoID8gJ3RzYy5vc3gnIDogJ3RzYyc7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKG5hbWUsIG5hbWUpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLkJ1aWxkKS5cblx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpO1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdG9zeDoge1xuXHRcdFx0XHRjb21tYW5kOiAndHNjLm9zeCdcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IG9zIGxpbnV4JywgKCkgPT4ge1xuXHRcdGNvbnN0IG5hbWU6IHN0cmluZyA9IFBsYXRmb3JtLmlzTGludXggPyAndHNjLmxpbnV4JyA6ICd0c2MnO1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLlxuXHRcdFx0dGFzayhuYW1lLCBuYW1lKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRsaW51eDoge1xuXHRcdFx0XHRjb21tYW5kOiAndHNjLmxpbnV4J1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogb3ZlcndyaXRlIHNob3dPdXRwdXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIuXG5cdFx0XHR0YXNrKCd0c2MnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRwcmVzZW50YXRpb24oKS5yZXZlYWwoUGxhdGZvcm0uaXNXaW5kb3dzID8gVGFza3MuUmV2ZWFsS2luZC5BbHdheXMgOiBUYXNrcy5SZXZlYWxLaW5kLk5ldmVyKTtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRzaG93T3V0cHV0OiAnbmV2ZXInLFxuXHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRzaG93T3V0cHV0OiAnYWx3YXlzJ1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogb3ZlcndyaXRlIGVjaG8gQ29tbWFuZCcsICgpID0+IHtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci5cblx0XHRcdHRhc2soJ3RzYycsICd0c2MnKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLlxuXHRcdFx0ZWNobyhQbGF0Zm9ybS5pc1dpbmRvd3MgPyBmYWxzZSA6IHRydWUpO1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdGVjaG9Db21tYW5kOiB0cnVlLFxuXHRcdFx0d2luZG93czoge1xuXHRcdFx0XHRlY2hvQ29tbWFuZDogZmFsc2Vcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBwcm9ibGVtTWF0Y2hlciBvbmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0cHJvYmxlbU1hdGNoZXI6ICckbXNDb21waWxlJ1xuXHRcdH07XG5cdFx0dGVzdERlZmF1bHRQcm9ibGVtTWF0Y2hlcihleHRlcm5hbCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBnbG9iYWwgcHJvYmxlbU1hdGNoZXIgdHdvJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHByb2JsZW1NYXRjaGVyOiBbJyRlc2xpbnQtY29tcGFjdCcsICckbXNDb21waWxlJ11cblx0XHR9O1xuXHRcdHRlc3REZWZhdWx0UHJvYmxlbU1hdGNoZXIoZXh0ZXJuYWwsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogdGFzayBkZWZpbml0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lJ1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCd0YXNrTmFtZScsICd0c2MnKS5jb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGJ1aWxkIHRhc2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdGlzQnVpbGRDb21tYW5kOiB0cnVlXG5cdFx0XHRcdH0gYXMgSUN1c3RvbVRhc2tcblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lJywgJ3RzYycpLmdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuY29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBkZWZhdWx0IGJ1aWxkIHRhc2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAnYnVpbGQnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ2J1aWxkJywgJ3RzYycpLmdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuY29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiB0ZXN0IHRhc2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdGlzVGVzdENvbW1hbmQ6IHRydWVcblx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuZ3JvdXAoVGFza3MuVGFza0dyb3VwLlRlc3QpLmNvbW1hbmQoKS5hcmdzKFsnJG5hbWUnXSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZGVmYXVsdCB0ZXN0IHRhc2snLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGVzdCdcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGVzdCcsICd0c2MnKS5ncm91cChUYXNrcy5UYXNrR3JvdXAuVGVzdCkuY29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiB0YXNrIHdpdGggdmFsdWVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRcdHNob3dPdXRwdXQ6ICduZXZlcicsXG5cdFx0XHRcdFx0ZWNob0NvbW1hbmQ6IHRydWUsXG5cdFx0XHRcdFx0YXJnczogWyctLXAnXSxcblx0XHRcdFx0XHRpc1dhdGNoaW5nOiB0cnVlXG5cdFx0XHRcdH0gYXMgSUN1c3RvbVRhc2tcblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rlc3QnLCAndHNjJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuVGVzdCkuXG5cdFx0XHRpc0JhY2tncm91bmQodHJ1ZSkuXG5cdFx0XHRwcm9tcHRPbkNsb3NlKGZhbHNlKS5cblx0XHRcdGNvbW1hbmQoKS5hcmdzKFsnJG5hbWUnLCAnLS1wJ10pLlxuXHRcdFx0cHJlc2VudGF0aW9uKCkuXG5cdFx0XHRlY2hvKHRydWUpLnJldmVhbChUYXNrcy5SZXZlYWxLaW5kLk5ldmVyKTtcblxuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHRhc2sgaW5oZXJpdHMgZ2xvYmFsIHZhbHVlcycsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRzaG93T3V0cHV0OiAnbmV2ZXInLFxuXHRcdFx0ZWNob0NvbW1hbmQ6IHRydWUsXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0ZXN0J1xuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCd0ZXN0JywgJ3RzYycpLlxuXHRcdFx0Z3JvdXAoVGFza3MuVGFza0dyb3VwLlRlc3QpLlxuXHRcdFx0Y29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKS5wcmVzZW50YXRpb24oKS5cblx0XHRcdGVjaG8odHJ1ZSkucmV2ZWFsKFRhc2tzLlJldmVhbEtpbmQuTmV2ZXIpO1xuXG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogcHJvYmxlbSBtYXRjaGVyIGRlZmF1bHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdHByb2JsZW1NYXRjaGVyOiB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdHJlZ2V4cDogJ2FiYydcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lJywgJ3RzYycpLlxuXHRcdFx0Y29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKS5wYXJlbnQuXG5cdFx0XHRwcm9ibGVtTWF0Y2hlcigpLnBhdHRlcm4oL2FiYy8pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHByb2JsZW0gbWF0Y2hlciAuKiByZWd1bGFyIGV4cHJlc3Npb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdHByb2JsZW1NYXRjaGVyOiB7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdHJlZ2V4cDogJy4qJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pLnBhcmVudC5cblx0XHRcdHByb2JsZW1NYXRjaGVyKCkucGF0dGVybigvLiovKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBwcm9ibGVtIG1hdGNoZXIgb3duZXIsIGFwcGx5VG8sIHNldmVyaXR5IGFuZCBmaWxlTG9jYXRpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdHByb2JsZW1NYXRjaGVyOiB7XG5cdFx0XHRcdFx0XHRvd25lcjogJ215T3duZXInLFxuXHRcdFx0XHRcdFx0YXBwbHlUbzogJ2Nsb3NlZERvY3VtZW50cycsXG5cdFx0XHRcdFx0XHRzZXZlcml0eTogJ3dhcm5pbmcnLFxuXHRcdFx0XHRcdFx0ZmlsZUxvY2F0aW9uOiAnYWJzb2x1dGUnLFxuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRyZWdleHA6ICdhYmMnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCd0YXNrTmFtZScsICd0c2MnKS5cblx0XHRcdGNvbW1hbmQoKS5hcmdzKFsnJG5hbWUnXSkucGFyZW50LlxuXHRcdFx0cHJvYmxlbU1hdGNoZXIoKS5cblx0XHRcdG93bmVyKCdteU93bmVyJykuXG5cdFx0XHRhcHBseVRvKEFwcGx5VG9LaW5kLmNsb3NlZERvY3VtZW50cykuXG5cdFx0XHRzZXZlcml0eShTZXZlcml0eS5XYXJuaW5nKS5cblx0XHRcdGZpbGVMb2NhdGlvbihGaWxlTG9jYXRpb25LaW5kLkFic29sdXRlKS5cblx0XHRcdGZpbGVQcmVmaXgodW5kZWZpbmVkISkuXG5cdFx0XHRwYXR0ZXJuKC9hYmMvKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBwcm9ibGVtIG1hdGNoZXIgZmlsZUxvY2F0aW9uIGFuZCBmaWxlUHJlZml4JywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lJyxcblx0XHRcdFx0XHRwcm9ibGVtTWF0Y2hlcjoge1xuXHRcdFx0XHRcdFx0ZmlsZUxvY2F0aW9uOiBbJ3JlbGF0aXZlJywgJ215UGF0aCddLFxuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRyZWdleHA6ICdhYmMnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCd0YXNrTmFtZScsICd0c2MnKS5cblx0XHRcdGNvbW1hbmQoKS5hcmdzKFsnJG5hbWUnXSkucGFyZW50LlxuXHRcdFx0cHJvYmxlbU1hdGNoZXIoKS5cblx0XHRcdGZpbGVMb2NhdGlvbihGaWxlTG9jYXRpb25LaW5kLlJlbGF0aXZlKS5cblx0XHRcdGZpbGVQcmVmaXgoJ215UGF0aCcpLlxuXHRcdFx0cGF0dGVybigvYWJjLyk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogcHJvYmxlbSBwYXR0ZXJuIGxvY2F0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lJyxcblx0XHRcdFx0XHRwcm9ibGVtTWF0Y2hlcjoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRyZWdleHA6ICdhYmMnLFxuXHRcdFx0XHRcdFx0XHRmaWxlOiAxMCxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogMTEsXG5cdFx0XHRcdFx0XHRcdGxvY2F0aW9uOiAxMixcblx0XHRcdFx0XHRcdFx0c2V2ZXJpdHk6IDEzLFxuXHRcdFx0XHRcdFx0XHRjb2RlOiAxNFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pLnBhcmVudC5cblx0XHRcdHByb2JsZW1NYXRjaGVyKCkuXG5cdFx0XHRwYXR0ZXJuKC9hYmMvKS5maWxlKDEwKS5tZXNzYWdlKDExKS5sb2NhdGlvbigxMikuc2V2ZXJpdHkoMTMpLmNvZGUoMTQpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHByb2JsZW0gcGF0dGVybiBsaW5lICYgY29sdW1uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lJyxcblx0XHRcdFx0XHRwcm9ibGVtTWF0Y2hlcjoge1xuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRyZWdleHA6ICdhYmMnLFxuXHRcdFx0XHRcdFx0XHRmaWxlOiAxMCxcblx0XHRcdFx0XHRcdFx0bWVzc2FnZTogMTEsXG5cdFx0XHRcdFx0XHRcdGxpbmU6IDEyLFxuXHRcdFx0XHRcdFx0XHRjb2x1bW46IDEzLFxuXHRcdFx0XHRcdFx0XHRlbmRMaW5lOiAxNCxcblx0XHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiAxNSxcblx0XHRcdFx0XHRcdFx0c2V2ZXJpdHk6IDE2LFxuXHRcdFx0XHRcdFx0XHRjb2RlOiAxN1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pLnBhcmVudC5cblx0XHRcdHByb2JsZW1NYXRjaGVyKCkuXG5cdFx0XHRwYXR0ZXJuKC9hYmMvKS5maWxlKDEwKS5tZXNzYWdlKDExKS5cblx0XHRcdGxpbmUoMTIpLmNoYXJhY3RlcigxMykuZW5kTGluZSgxNCkuZW5kQ2hhcmFjdGVyKDE1KS5cblx0XHRcdHNldmVyaXR5KDE2KS5jb2RlKDE3KTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBwcm9tcHQgb24gY2xvc2UgZGVmYXVsdCcsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZSdcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRwcm9tcHRPbkNsb3NlKHRydWUpLlxuXHRcdFx0Y29tbWFuZCgpLmFyZ3MoWyckbmFtZSddKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBwcm9tcHQgb24gY2xvc2Ugd2F0Y2hpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdGlzV2F0Y2hpbmc6IHRydWVcblx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRpc0JhY2tncm91bmQodHJ1ZSkucHJvbXB0T25DbG9zZShmYWxzZSkuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHByb21wdCBvbiBjbG9zZSBzZXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdHByb21wdE9uQ2xvc2U6IGZhbHNlXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lJywgJ3RzYycpLlxuXHRcdFx0cHJvbXB0T25DbG9zZShmYWxzZSkuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHRhc2sgc2VsZWN0b3Igc2V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tTZWxlY3RvcjogJy90OicsXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZScsXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lJywgJ3RzYycpLlxuXHRcdFx0Y29tbWFuZCgpLlxuXHRcdFx0dGFza1NlbGVjdG9yKCcvdDonKS5cblx0XHRcdGFyZ3MoWycvdDp0YXNrTmFtZSddKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBzdXBwcmVzcyB0YXNrIG5hbWUgc2V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHN1cHByZXNzVGFza05hbWU6IGZhbHNlLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnLFxuXHRcdFx0XHRcdHN1cHByZXNzVGFza05hbWU6IHRydWVcblx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWUnLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiBzdXBwcmVzcyB0YXNrIG5hbWUgaW5oZXJpdCcsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHRzdXBwcmVzc1Rhc2tOYW1lOiB0cnVlLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWUnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lJywgJ3RzYycpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogdHdvIHRhc2tzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lT25lJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZVR3bydcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWVPbmUnLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWVUd28nLCAndHNjJykuXG5cdFx0XHRjb21tYW5kKCkuYXJncyhbJyRuYW1lJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHdpdGggY29tbWFuZCcsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWVPbmUnLFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICd0c2MnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lT25lJywgJ3RzYycpLmNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHR3byB0YXNrcyB3aXRoIGNvbW1hbmQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lT25lJyxcblx0XHRcdFx0XHRjb21tYW5kOiAndHNjJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZVR3bycsXG5cdFx0XHRcdFx0Y29tbWFuZDogJ2Rpcidcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWVPbmUnLCAndHNjJykuY29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSk7XG5cdFx0YnVpbGRlci50YXNrKCd0YXNrTmFtZVR3bycsICdkaXInKS5jb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiB3aXRoIGNvbW1hbmQgYW5kIGFyZ3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ3Rhc2tOYW1lT25lJyxcblx0XHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0XHRpc1NoZWxsQ29tbWFuZDogdHJ1ZSxcblx0XHRcdFx0XHRhcmdzOiBbJ2FyZyddLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdGN3ZDogJ2N3ZCcsXG5cdFx0XHRcdFx0XHRlbnY6IHtcblx0XHRcdFx0XHRcdFx0ZW52OiAnZW52J1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWVPbmUnLCAndHNjJykuY29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5hcmdzKFsnYXJnJ10pLm9wdGlvbnMoeyBjd2Q6ICdjd2QnLCBlbnY6IHsgZW52OiAnZW52JyB9IH0pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IHdpdGggY29tbWFuZCBvcyBzcGVjaWZpYycsICgpID0+IHtcblx0XHRjb25zdCBuYW1lOiBzdHJpbmcgPSBQbGF0Zm9ybS5pc1dpbmRvd3MgPyAndHNjLndpbicgOiAndHNjJztcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndGFza05hbWVPbmUnLFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0XHRcdHdpbmRvd3M6IHtcblx0XHRcdFx0XHRcdGNvbW1hbmQ6ICd0c2Mud2luJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndGFza05hbWVPbmUnLCBuYW1lKS5jb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rhc2tzOiB3aXRoIFdpbmRvd3Mgc3BlY2lmaWMgYXJncycsICgpID0+IHtcblx0XHRjb25zdCBhcmdzOiBzdHJpbmdbXSA9IFBsYXRmb3JtLmlzV2luZG93cyA/IFsnYXJnMScsICdhcmcyJ10gOiBbJ2FyZzEnXTtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndHNjJyxcblx0XHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0XHRhcmdzOiBbJ2FyZzEnXSxcblx0XHRcdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdFx0XHRhcmdzOiBbJ2FyZzInXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygndHNjJywgJ3RzYycpLmNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpLmFyZ3MoYXJncyk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogd2l0aCBMaW51eCBzcGVjaWZpYyBhcmdzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFyZ3M6IHN0cmluZ1tdID0gUGxhdGZvcm0uaXNMaW51eCA/IFsnYXJnMScsICdhcmcyJ10gOiBbJ2FyZzEnXTtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAndHNjJyxcblx0XHRcdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdFx0XHRhcmdzOiBbJ2FyZzEnXSxcblx0XHRcdFx0XHRsaW51eDoge1xuXHRcdFx0XHRcdFx0YXJnczogWydhcmcyJ11cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3RzYycsICd0c2MnKS5jb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5hcmdzKGFyZ3MpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBjb21tYW5kIGFuZCB0YXNrIGNvbW1hbmQgcHJvcGVydGllcycsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJ3RzYycsXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZU9uZScsXG5cdFx0XHRcdFx0aXNTaGVsbENvbW1hbmQ6IHRydWUsXG5cdFx0XHRcdH0gYXMgSUN1c3RvbVRhc2tcblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lT25lJywgJ3RzYycpLmNvbW1hbmQoKS5ydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5hcmdzKFsnJG5hbWUnXSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0YXNrczogZ2xvYmFsIGFuZCB0YXNrcyBhcmdzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHRjb21tYW5kOiAndHNjJyxcblx0XHRcdGFyZ3M6IFsnZ2xvYmFsJ10sXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZU9uZScsXG5cdFx0XHRcdFx0YXJnczogWydsb2NhbCddXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lT25lJywgJ3RzYycpLmNvbW1hbmQoKS5hcmdzKFsnZ2xvYmFsJywgJyRuYW1lJywgJ2xvY2FsJ10pO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cblx0dGVzdCgndGFza3M6IGdsb2JhbCBhbmQgdGFza3MgYXJncyB3aXRoIHRhc2sgc2VsZWN0b3InLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHRcdGNvbW1hbmQ6ICd0c2MnLFxuXHRcdFx0YXJnczogWydnbG9iYWwnXSxcblx0XHRcdHRhc2tTZWxlY3RvcjogJy90OicsXG5cdFx0XHR0YXNrczogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dGFza05hbWU6ICd0YXNrTmFtZU9uZScsXG5cdFx0XHRcdFx0YXJnczogWydsb2NhbCddXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ3Rhc2tOYW1lT25lJywgJ3RzYycpLmNvbW1hbmQoKS50YXNrU2VsZWN0b3IoJy90OicpLmFyZ3MoWydnbG9iYWwnLCAnL3Q6dGFza05hbWVPbmUnLCAnbG9jYWwnXSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnVGFza3MgdmVyc2lvbiAyLjAuMCcsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdC5za2lwKCdCdWlsZCB3b3Jrc3BhY2UgdGFzaycsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAnZGlyJyxcblx0XHRcdFx0XHRjb21tYW5kOiAnZGlyJyxcblx0XHRcdFx0XHR0eXBlOiAnc2hlbGwnLFxuXHRcdFx0XHRcdGdyb3VwOiAnYnVpbGQnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ2RpcicsICdkaXInKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdHJ1bnRpbWUoVGFza3MuUnVudGltZVR5cGUuU2hlbGwpLlxuXHRcdFx0cHJlc2VudGF0aW9uKCkuZWNobyh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXHR0ZXN0KCdHbG9iYWwgZ3JvdXAgbm9uZScsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0Y29tbWFuZDogJ2RpcicsXG5cdFx0XHR0eXBlOiAnc2hlbGwnLFxuXHRcdFx0Z3JvdXA6ICdub25lJ1xuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygnZGlyJywgJ2RpcicpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLmVjaG8odHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblx0dGVzdC5za2lwKCdHbG9iYWwgZ3JvdXAgYnVpbGQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzIuMC4wJyxcblx0XHRcdGNvbW1hbmQ6ICdkaXInLFxuXHRcdFx0dHlwZTogJ3NoZWxsJyxcblx0XHRcdGdyb3VwOiAnYnVpbGQnXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCdkaXInLCAnZGlyJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLmVjaG8odHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblx0dGVzdC5za2lwKCdHbG9iYWwgZ3JvdXAgZGVmYXVsdCBidWlsZCcsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0Y29tbWFuZDogJ2RpcicsXG5cdFx0XHR0eXBlOiAnc2hlbGwnLFxuXHRcdFx0Z3JvdXA6IHsga2luZDogJ2J1aWxkJywgaXNEZWZhdWx0OiB0cnVlIH1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRjb25zdCB0YXNrR3JvdXAgPSBUYXNrcy5UYXNrR3JvdXAuQnVpbGQ7XG5cdFx0dGFza0dyb3VwLmlzRGVmYXVsdCA9IHRydWU7XG5cdFx0YnVpbGRlci50YXNrKCdkaXInLCAnZGlyJykuXG5cdFx0XHRncm91cCh0YXNrR3JvdXApLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLmVjaG8odHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblx0dGVzdCgnTG9jYWwgZ3JvdXAgbm9uZScsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAnZGlyJyxcblx0XHRcdFx0XHRjb21tYW5kOiAnZGlyJyxcblx0XHRcdFx0XHR0eXBlOiAnc2hlbGwnLFxuXHRcdFx0XHRcdGdyb3VwOiAnbm9uZSdcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH07XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyBDb25maWd1cmF0aW9uQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIudGFzaygnZGlyJywgJ2RpcicpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdHByZXNlbnRhdGlvbigpLmVjaG8odHJ1ZSk7XG5cdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHR9KTtcblx0dGVzdC5za2lwKCdMb2NhbCBncm91cCBidWlsZCcsICgpID0+IHtcblx0XHRjb25zdCBleHRlcm5hbDogSUV4dGVybmFsVGFza1J1bm5lckNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdFx0dGFza3M6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAnZGlyJyxcblx0XHRcdFx0XHRjb21tYW5kOiAnZGlyJyxcblx0XHRcdFx0XHR0eXBlOiAnc2hlbGwnLFxuXHRcdFx0XHRcdGdyb3VwOiAnYnVpbGQnXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9O1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgQ29uZmlndXJhdGlvbkJ1aWxkZXIoKTtcblx0XHRidWlsZGVyLnRhc2soJ2RpcicsICdkaXInKS5cblx0XHRcdGdyb3VwKFRhc2tzLlRhc2tHcm91cC5CdWlsZCkuXG5cdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdHJ1bnRpbWUoVGFza3MuUnVudGltZVR5cGUuU2hlbGwpLlxuXHRcdFx0cHJlc2VudGF0aW9uKCkuZWNobyh0cnVlKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xuXHR0ZXN0LnNraXAoJ0xvY2FsIGdyb3VwIGRlZmF1bHQgYnVpbGQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzIuMC4wJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0YXNrTmFtZTogJ2RpcicsXG5cdFx0XHRcdFx0Y29tbWFuZDogJ2RpcicsXG5cdFx0XHRcdFx0dHlwZTogJ3NoZWxsJyxcblx0XHRcdFx0XHRncm91cDogeyBraW5kOiAnYnVpbGQnLCBpc0RlZmF1bHQ6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0Y29uc3QgdGFza0dyb3VwID0gVGFza3MuVGFza0dyb3VwLkJ1aWxkO1xuXHRcdHRhc2tHcm91cC5pc0RlZmF1bHQgPSB0cnVlO1xuXHRcdGJ1aWxkZXIudGFzaygnZGlyJywgJ2RpcicpLlxuXHRcdFx0Z3JvdXAodGFza0dyb3VwKS5cblx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpLlxuXHRcdFx0cnVudGltZShUYXNrcy5SdW50aW1lVHlwZS5TaGVsbCkuXG5cdFx0XHRwcmVzZW50YXRpb24oKS5lY2hvKHRydWUpO1xuXHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0fSk7XG5cdHRlc3QoJ0FyZyBvdmVyd3JpdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWw6IElFeHRlcm5hbFRhc2tSdW5uZXJDb25maWd1cmF0aW9uID0ge1xuXHRcdFx0dmVyc2lvbjogJzIuMC4wJyxcblx0XHRcdHRhc2tzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogJ2VjaG8nLFxuXHRcdFx0XHRcdHR5cGU6ICdzaGVsbCcsXG5cdFx0XHRcdFx0Y29tbWFuZDogJ2VjaG8nLFxuXHRcdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHRcdCdnbG9iYWwnXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0XHRcdCd3aW5kb3dzJ1xuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bGludXg6IHtcblx0XHRcdFx0XHRcdGFyZ3M6IFtcblx0XHRcdFx0XHRcdFx0J2xpbnV4J1xuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b3N4OiB7XG5cdFx0XHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0XHRcdCdvc3gnXG5cdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0aWYgKFBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0YnVpbGRlci50YXNrKCdlY2hvJywgJ2VjaG8nKS5cblx0XHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuYXJncyhbJ3dpbmRvd3MnXSkuXG5cdFx0XHRcdHJ1bnRpbWUoVGFza3MuUnVudGltZVR5cGUuU2hlbGwpLlxuXHRcdFx0XHRwcmVzZW50YXRpb24oKS5lY2hvKHRydWUpO1xuXHRcdFx0dGVzdENvbmZpZ3VyYXRpb24oZXh0ZXJuYWwsIGJ1aWxkZXIpO1xuXHRcdH0gZWxzZSBpZiAoUGxhdGZvcm0uaXNMaW51eCkge1xuXHRcdFx0YnVpbGRlci50YXNrKCdlY2hvJywgJ2VjaG8nKS5cblx0XHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuYXJncyhbJ2xpbnV4J10pLlxuXHRcdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdFx0cHJlc2VudGF0aW9uKCkuZWNobyh0cnVlKTtcblx0XHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0XHR9IGVsc2UgaWYgKFBsYXRmb3JtLmlzTWFjaW50b3NoKSB7XG5cdFx0XHRidWlsZGVyLnRhc2soJ2VjaG8nLCAnZWNobycpLlxuXHRcdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5hcmdzKFsnb3N4J10pLlxuXHRcdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKS5cblx0XHRcdFx0cHJlc2VudGF0aW9uKCkuZWNobyh0cnVlKTtcblx0XHRcdHRlc3RDb25maWd1cmF0aW9uKGV4dGVybmFsLCBidWlsZGVyKTtcblx0XHR9XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdCdWdzIC8gcmVncmVzc2lvbiB0ZXN0cycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0KFBsYXRmb3JtLmlzTGludXggPyB0ZXN0LnNraXAgOiB0ZXN0KSgnQnVnIDE5NTQ4JywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4dGVybmFsOiBJRXh0ZXJuYWxUYXNrUnVubmVyQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdHZlcnNpb246ICcwLjEuMCcsXG5cdFx0XHR3aW5kb3dzOiB7XG5cdFx0XHRcdGNvbW1hbmQ6ICdwb3dlcnNoZWxsJyxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdGN3ZDogJyR7d29ya3NwYWNlRm9sZGVyfSdcblx0XHRcdFx0fSxcblx0XHRcdFx0dGFza3M6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0YXNrTmFtZTogJ2NvbXBvc2VGb3JEZWJ1ZycsXG5cdFx0XHRcdFx0XHRzdXBwcmVzc1Rhc2tOYW1lOiB0cnVlLFxuXHRcdFx0XHRcdFx0YXJnczogW1xuXHRcdFx0XHRcdFx0XHQnLUV4ZWN1dGlvblBvbGljeScsXG5cdFx0XHRcdFx0XHRcdCdSZW1vdGVTaWduZWQnLFxuXHRcdFx0XHRcdFx0XHQnLlxcXFxkb2NrZXJUYXNrLnBzMScsXG5cdFx0XHRcdFx0XHRcdCctQ29tcG9zZUZvckRlYnVnJyxcblx0XHRcdFx0XHRcdFx0Jy1FbnZpcm9ubWVudCcsXG5cdFx0XHRcdFx0XHRcdCdkZWJ1Zydcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRpc0J1aWxkQ29tbWFuZDogZmFsc2UsXG5cdFx0XHRcdFx0XHRzaG93T3V0cHV0OiAnYWx3YXlzJyxcblx0XHRcdFx0XHRcdGVjaG9Db21tYW5kOiB0cnVlXG5cdFx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0b3N4OiB7XG5cdFx0XHRcdGNvbW1hbmQ6ICcvYmluL2Jhc2gnLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0Y3dkOiAnJHt3b3Jrc3BhY2VGb2xkZXJ9J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0YXNrczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHRhc2tOYW1lOiAnY29tcG9zZUZvckRlYnVnJyxcblx0XHRcdFx0XHRcdHN1cHByZXNzVGFza05hbWU6IHRydWUsXG5cdFx0XHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0XHRcdCctYycsXG5cdFx0XHRcdFx0XHRcdCcuL2RvY2tlclRhc2suc2ggY29tcG9zZUZvckRlYnVnIGRlYnVnJ1xuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdGlzQnVpbGRDb21tYW5kOiBmYWxzZSxcblx0XHRcdFx0XHRcdHNob3dPdXRwdXQ6ICdhbHdheXMnXG5cdFx0XHRcdFx0fSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0aWYgKFBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0YnVpbGRlci50YXNrKCdjb21wb3NlRm9yRGVidWcnLCAncG93ZXJzaGVsbCcpLlxuXHRcdFx0XHRjb21tYW5kKCkuc3VwcHJlc3NUYXNrTmFtZSh0cnVlKS5cblx0XHRcdFx0YXJncyhbJy1FeGVjdXRpb25Qb2xpY3knLCAnUmVtb3RlU2lnbmVkJywgJy5cXFxcZG9ja2VyVGFzay5wczEnLCAnLUNvbXBvc2VGb3JEZWJ1ZycsICctRW52aXJvbm1lbnQnLCAnZGVidWcnXSkuXG5cdFx0XHRcdG9wdGlvbnMoeyBjd2Q6ICcke3dvcmtzcGFjZUZvbGRlcn0nIH0pLlxuXHRcdFx0XHRwcmVzZW50YXRpb24oKS5lY2hvKHRydWUpLnJldmVhbChUYXNrcy5SZXZlYWxLaW5kLkFsd2F5cyk7XG5cdFx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdFx0fSBlbHNlIGlmIChQbGF0Zm9ybS5pc01hY2ludG9zaCkge1xuXHRcdFx0YnVpbGRlci50YXNrKCdjb21wb3NlRm9yRGVidWcnLCAnL2Jpbi9iYXNoJykuXG5cdFx0XHRcdGNvbW1hbmQoKS5zdXBwcmVzc1Rhc2tOYW1lKHRydWUpLlxuXHRcdFx0XHRhcmdzKFsnLWMnLCAnLi9kb2NrZXJUYXNrLnNoIGNvbXBvc2VGb3JEZWJ1ZyBkZWJ1ZyddKS5cblx0XHRcdFx0b3B0aW9ucyh7IGN3ZDogJyR7d29ya3NwYWNlRm9sZGVyfScgfSkuXG5cdFx0XHRcdHByZXNlbnRhdGlvbigpLnJldmVhbChUYXNrcy5SZXZlYWxLaW5kLkFsd2F5cyk7XG5cdFx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdCdWcgMjg0ODknLCAoKSA9PiB7XG5cdFx0Y29uc3QgZXh0ZXJuYWwgPSB7XG5cdFx0XHR2ZXJzaW9uOiAnMC4xLjAnLFxuXHRcdFx0Y29tbWFuZDogJycsXG5cdFx0XHRpc1NoZWxsQ29tbWFuZDogdHJ1ZSxcblx0XHRcdGFyZ3M6IFsnJ10sXG5cdFx0XHRzaG93T3V0cHV0OiAnYWx3YXlzJyxcblx0XHRcdCd0YXNrcyc6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHRhc2tOYW1lOiAnYnVpbGQnLFxuXHRcdFx0XHRcdGNvbW1hbmQ6ICdiYXNoJyxcblx0XHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0XHQnYnVpbGQuc2gnXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fTtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IENvbmZpZ3VyYXRpb25CdWlsZGVyKCk7XG5cdFx0YnVpbGRlci50YXNrKCdidWlsZCcsICdiYXNoJykuXG5cdFx0XHRncm91cChUYXNrcy5UYXNrR3JvdXAuQnVpbGQpLlxuXHRcdFx0Y29tbWFuZCgpLnN1cHByZXNzVGFza05hbWUodHJ1ZSkuXG5cdFx0XHRhcmdzKFsnYnVpbGQuc2gnXSkuXG5cdFx0XHRydW50aW1lKFRhc2tzLlJ1bnRpbWVUeXBlLlNoZWxsKTtcblx0XHR0ZXN0Q29uZmlndXJhdGlvbihleHRlcm5hbCwgYnVpbGRlcik7XG5cdH0pO1xufSk7XG5cbmNsYXNzIFRlc3ROYW1lZFByb2JsZW1NYXRjaGVyIGltcGxlbWVudHMgUGFydGlhbDxQcm9ibGVtTWF0Y2hlcj4ge1xufVxuXG5jbGFzcyBUZXN0UGFyc2VDb250ZXh0IGltcGxlbWVudHMgUGFydGlhbDxJUGFyc2VDb250ZXh0PiB7XG59XG5cbmNsYXNzIFRlc3RUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5IGltcGxlbWVudHMgUGFydGlhbDxJVGFza0RlZmluaXRpb25SZWdpc3RyeT4ge1xuXHRwcml2YXRlIF90YXNrOiBUYXNrcy5JVGFza0RlZmluaXRpb24gfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQoa2V5OiBzdHJpbmcpOiBUYXNrcy5JVGFza0RlZmluaXRpb24ge1xuXHRcdHJldHVybiB0aGlzLl90YXNrITtcblx0fVxuXHRwdWJsaWMgc2V0KHRhc2s6IFRhc2tzLklUYXNrRGVmaW5pdGlvbikge1xuXHRcdHRoaXMuX3Rhc2sgPSB0YXNrO1xuXHR9XG59XG5cbnN1aXRlKCdUYXNrIGNvbmZpZ3VyYXRpb24gY29udmVyc2lvbnMnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IGdsb2JhbHMgPSB7fSBhcyBJR2xvYmFscztcblx0Y29uc3QgdGFza0NvbmZpZ1NvdXJjZSA9IHt9IGFzIFRhc2tDb25maWdTb3VyY2U7XG5cdGNvbnN0IFRhc2tEZWZpbml0aW9uUmVnaXN0cnkgPSBuZXcgVGVzdFRhc2tEZWZpbml0aW9uUmVnaXN0cnkoKTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBwYXJzZUNvbnRleHQ6IElQYXJzZUNvbnRleHQ7XG5cdGxldCBuYW1lZFByb2JsZW1NYXRjaGVyOiBJTmFtZWRQcm9ibGVtTWF0Y2hlcjtcblx0bGV0IHByb2JsZW1SZXBvcnRlcjogUHJvYmxlbVJlcG9ydGVyO1xuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0bmFtZWRQcm9ibGVtTWF0Y2hlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3ROYW1lZFByb2JsZW1NYXRjaGVyKTtcblx0XHRuYW1lZFByb2JsZW1NYXRjaGVyLm5hbWUgPSAncmVhbCc7XG5cdFx0bmFtZWRQcm9ibGVtTWF0Y2hlci5sYWJlbCA9ICdyZWFsIGxhYmVsJztcblx0XHRwcm9ibGVtUmVwb3J0ZXIgPSBuZXcgUHJvYmxlbVJlcG9ydGVyKCk7XG5cdFx0cGFyc2VDb250ZXh0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFBhcnNlQ29udGV4dCk7XG5cdFx0cGFyc2VDb250ZXh0LnByb2JsZW1SZXBvcnRlciA9IHByb2JsZW1SZXBvcnRlcjtcblx0XHRwYXJzZUNvbnRleHQubmFtZWRQcm9ibGVtTWF0Y2hlcnMgPSB7ICdyZWFsJzogbmFtZWRQcm9ibGVtTWF0Y2hlciB9O1xuXHRcdHBhcnNlQ29udGV4dC51dWlkTWFwID0gbmV3IFVVSURNYXAoKTtcblx0fSk7XG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXHRzdWl0ZSgnUHJvYmxlbU1hdGNoZXJDb252ZXJ0ZXIuZnJvbScsICgpID0+IHtcblx0XHR0ZXN0KCdyZXR1cm5zIFtdIGFuZCBhbiBlcnJvciBmb3IgYW4gdW5rbm93biBwcm9ibGVtIG1hdGNoZXInLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSAoUHJvYmxlbU1hdGNoZXJDb252ZXJ0ZXIuZnJvbSgnJGZha2UnLCBwYXJzZUNvbnRleHQpKTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LnZhbHVlLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmVycm9ycz8ubGVuZ3RoLCAxKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdyZXR1cm5zIGNvbmZpZyBmb3IgYSBrbm93biBwcm9ibGVtIG1hdGNoZXInLCAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSAoUHJvYmxlbU1hdGNoZXJDb252ZXJ0ZXIuZnJvbSgnJHJlYWwnLCBwYXJzZUNvbnRleHQpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuZXJyb3JzPy5sZW5ndGgsIDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQudmFsdWUsIFt7IFwibGFiZWxcIjogXCJyZWFsIGxhYmVsXCIgfV0pO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3JldHVybnMgY29uZmlnIGZvciBhIGtub3duIHByb2JsZW0gbWF0Y2hlciBpbmNsdWRpbmcgYXBwbHlUbycsICgpID0+IHtcblx0XHRcdG5hbWVkUHJvYmxlbU1hdGNoZXIuYXBwbHlUbyA9IEFwcGx5VG9LaW5kLmNsb3NlZERvY3VtZW50cztcblx0XHRcdGNvbnN0IHJlc3VsdCA9IChQcm9ibGVtTWF0Y2hlckNvbnZlcnRlci5mcm9tKCckcmVhbCcsIHBhcnNlQ29udGV4dCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5lcnJvcnM/Lmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC52YWx1ZSwgW3sgXCJsYWJlbFwiOiBcInJlYWwgbGFiZWxcIiwgXCJhcHBseVRvXCI6IEFwcGx5VG9LaW5kLmNsb3NlZERvY3VtZW50cyB9XSk7XG5cdFx0fSk7XG5cdH0pO1xuXHRzdWl0ZSgnVGFza1BhcnNlci5mcm9tJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdDdXN0b21UYXNrJywgKCkgPT4ge1xuXHRcdFx0c3VpdGUoJ2luY29tcGxldGUgY29uZmlnIHJlcG9ydHMgYW4gYXBwcm9wcmlhdGUgZXJyb3IgZm9yIG1pc3NpbmcnLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ25hbWUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gVGFza1BhcnNlci5mcm9tKFt7fSBhcyBJQ3VzdG9tVGFza10sIGdsb2JhbHMsIHBhcnNlQ29udGV4dCwgdGFza0NvbmZpZ1NvdXJjZSk7XG5cdFx0XHRcdFx0YXNzZXJ0VGFza1BhcnNlUmVzdWx0KHJlc3VsdCwgdW5kZWZpbmVkLCBwcm9ibGVtUmVwb3J0ZXIsICdFcnJvcjogYSB0YXNrIG11c3QgcHJvdmlkZSBhIGxhYmVsIHByb3BlcnR5Jyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdjb21tYW5kJywgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IFRhc2tQYXJzZXIuZnJvbShbeyB0YXNrTmFtZTogJ3Rhc2snIH0gYXMgSUN1c3RvbVRhc2tdLCBnbG9iYWxzLCBwYXJzZUNvbnRleHQsIHRhc2tDb25maWdTb3VyY2UpO1xuXHRcdFx0XHRcdGFzc2VydFRhc2tQYXJzZVJlc3VsdChyZXN1bHQsIHVuZGVmaW5lZCwgcHJvYmxlbVJlcG9ydGVyLCBcIkVycm9yOiB0aGUgdGFzayAndGFzaycgZG9lc24ndCBkZWZpbmUgYSBjb21tYW5kXCIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgncmV0dXJucyBleHBlY3RlZCByZXN1bHQnLCAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0XHRcdHsgdGFza05hbWU6ICd0YXNrJywgY29tbWFuZDogJ2VjaG8gdGVzdCcgfSBhcyBJQ3VzdG9tVGFzayxcblx0XHRcdFx0XHR7IHRhc2tOYW1lOiAndGFzayAyJywgY29tbWFuZDogJ2VjaG8gdGVzdCcgfSBhcyBJQ3VzdG9tVGFza1xuXHRcdFx0XHRdO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBUYXNrUGFyc2VyLmZyb20oZXhwZWN0ZWQsIGdsb2JhbHMsIHBhcnNlQ29udGV4dCwgdGFza0NvbmZpZ1NvdXJjZSk7XG5cdFx0XHRcdGFzc2VydFRhc2tQYXJzZVJlc3VsdChyZXN1bHQsIHsgY3VzdG9tOiBleHBlY3RlZCB9LCBwcm9ibGVtUmVwb3J0ZXIsIHVuZGVmaW5lZCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHRzdWl0ZSgnQ29uZmlndXJlZFRhc2snLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdyZXR1cm5zIGV4cGVjdGVkIHJlc3VsdCcsICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBbeyB0YXNrTmFtZTogJ3Rhc2snLCBjb21tYW5kOiAnZWNobyB0ZXN0JywgdHlwZTogJ2FueScsIGxhYmVsOiAndGFzaycgfSwgeyB0YXNrTmFtZTogJ3Rhc2sgMicsIGNvbW1hbmQ6ICdlY2hvIHRlc3QnLCB0eXBlOiAnYW55JywgbGFiZWw6ICd0YXNrIDInIH1dO1xuXHRcdFx0XHRUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5LnNldCh7IGV4dGVuc2lvbklkOiAncmVnaXN0ZXJlZCcsIHRhc2tUeXBlOiAnYW55JywgcHJvcGVydGllczoge30gfSBhcyBUYXNrcy5JVGFza0RlZmluaXRpb24pO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBUYXNrUGFyc2VyLmZyb20oZXhwZWN0ZWQsIGdsb2JhbHMsIHBhcnNlQ29udGV4dCwgdGFza0NvbmZpZ1NvdXJjZSwgVGFza0RlZmluaXRpb25SZWdpc3RyeSk7XG5cdFx0XHRcdGFzc2VydFRhc2tQYXJzZVJlc3VsdChyZXN1bHQsIHsgY29uZmlndXJlZDogZXhwZWN0ZWQgfSwgcHJvYmxlbVJlcG9ydGVyLCB1bmRlZmluZWQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIGFzc2VydFRhc2tQYXJzZVJlc3VsdChhY3R1YWw6IElUYXNrUGFyc2VSZXN1bHQsIGV4cGVjdGVkOiBJVGVzdFRhc2tQYXJzZVJlc3VsdCB8IHVuZGVmaW5lZCwgcHJvYmxlbVJlcG9ydGVyOiBQcm9ibGVtUmVwb3J0ZXIsIGV4cGVjdGVkTWVzc2FnZT86IHN0cmluZyk6IHZvaWQge1xuXHRpZiAoZXhwZWN0ZWRNZXNzYWdlID09PSB1bmRlZmluZWQpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvYmxlbVJlcG9ydGVyLmxhc3RNZXNzYWdlLCB1bmRlZmluZWQpO1xuXHR9IGVsc2Uge1xuXHRcdGFzc2VydC5vayhwcm9ibGVtUmVwb3J0ZXIubGFzdE1lc3NhZ2U/LmluY2x1ZGVzKGV4cGVjdGVkTWVzc2FnZSkpO1xuXHR9XG5cblx0YXNzZXJ0LmRlZXBFcXVhbChhY3R1YWwuY3VzdG9tLmxlbmd0aCwgZXhwZWN0ZWQ/LmN1c3RvbT8ubGVuZ3RoIHx8IDApO1xuXHRhc3NlcnQuZGVlcEVxdWFsKGFjdHVhbC5jb25maWd1cmVkLmxlbmd0aCwgZXhwZWN0ZWQ/LmNvbmZpZ3VyZWQ/Lmxlbmd0aCB8fCAwKTtcblxuXHRsZXQgaW5kZXggPSAwO1xuXHRpZiAoZXhwZWN0ZWQ/LmNvbmZpZ3VyZWQpIHtcblx0XHRmb3IgKGNvbnN0IHRhc2tQYXJzZVJlc3VsdCBvZiBleHBlY3RlZD8uY29uZmlndXJlZCkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25maWd1cmVkW2luZGV4XS5fbGFiZWwsIHRhc2tQYXJzZVJlc3VsdC5sYWJlbCk7XG5cdFx0XHRpbmRleCsrO1xuXHRcdH1cblx0fVxuXHRpbmRleCA9IDA7XG5cdGlmIChleHBlY3RlZD8uY3VzdG9tKSB7XG5cdFx0Zm9yIChjb25zdCB0YXNrUGFyc2VSZXN1bHQgb2YgZXhwZWN0ZWQ/LmN1c3RvbSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jdXN0b21baW5kZXhdLl9sYWJlbCwgdGFza1BhcnNlUmVzdWx0LnRhc2tOYW1lKTtcblx0XHRcdGluZGV4Kys7XG5cdFx0fVxuXHR9XG5cdHByb2JsZW1SZXBvcnRlci5jbGVhck1lc3NhZ2UoKTtcbn1cblxuaW50ZXJmYWNlIElUZXN0VGFza1BhcnNlUmVzdWx0IHtcblx0Y3VzdG9tPzogUGFydGlhbDxJQ3VzdG9tVGFzaz5bXTtcblx0Y29uZmlndXJlZD86IFBhcnRpYWw8SVRlc3RDb25maWd1cmluZ1Rhc2s+W107XG59XG5cbmludGVyZmFjZSBJVGVzdENvbmZpZ3VyaW5nVGFzayBleHRlbmRzIFBhcnRpYWw8VGFza3MuQ29uZmlndXJpbmdUYXNrPiB7XG5cdGxhYmVsOiBzdHJpbmc7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLFdBQVc7QUFDcEIsT0FBTyxZQUFZO0FBQ25CLE9BQU8sY0FBYztBQUNyQixZQUFZLFVBQVU7QUFFdEIsWUFBWSxXQUFXO0FBQ3ZCLFlBQVksY0FBYztBQUMxQixTQUFTLHdCQUF3QjtBQUNqQyxTQUF5QixrQkFBbUMsbUJBQXlDO0FBQ3JHLFNBQVMsdUJBQW1DO0FBRTVDLFlBQVksV0FBVztBQUN2QixTQUFTLE9BQXNGLGtCQUFpQyx5QkFBcUQsU0FBUyxrQkFBa0I7QUFDaE4sU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSxrQkFBbUMsSUFBSSxnQkFBZ0I7QUFBQSxFQUM1RCxLQUFLLElBQUksS0FBSyxzQkFBc0I7QUFBQSxFQUNwQyxNQUFNO0FBQUEsRUFDTixPQUFPO0FBQ1IsQ0FBQztBQUVELE1BQU0sWUFBd0IsSUFBSSxVQUFVLE1BQU0sQ0FBQyxlQUFlLENBQUM7QUFFbkUsTUFBTSxnQkFBNEM7QUFBQSxFQUFsRDtBQUVDLFNBQVEsb0JBQXNDLElBQUksaUJBQWlCO0FBRW5FLFNBQU8sa0JBQTJCO0FBQ2xDLFNBQU8sY0FBa0M7QUFBQTtBQUFBLEVBRWxDLEtBQUssU0FBdUI7QUFDbEMsU0FBSyxJQUFJLE9BQU87QUFBQSxFQUNqQjtBQUFBLEVBRU8sS0FBSyxT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
