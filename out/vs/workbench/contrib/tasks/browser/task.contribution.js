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
import * as nls from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { MenuRegistry, MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { ProblemMatcherRegistry } from "../common/problemMatcher.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import * as jsonContributionRegistry from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { StatusbarAlignment, IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { Extensions as OutputExt } from "../../../services/output/common/output.js";
import { TaskGroup, TaskSettingId, TASKS_CATEGORY, TASK_RUNNING_STATE, TASK_TERMINAL_ACTIVE, TaskEventKind } from "../common/tasks.js";
import { ITaskService, TaskCommandsRegistered, TaskExecutionSupportedContext } from "../common/taskService.js";
import { Extensions as WorkbenchExtensions, WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { RunAutomaticTasks, ManageAutomaticTaskRunning } from "./runAutomaticTasks.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import schemaVersion1 from "../common/jsonSchema_v1.js";
import schemaVersion2, { updateProblemMatchers, updateTaskDefinitions } from "../common/jsonSchema_v2.js";
import { AbstractTaskService, ConfigureTaskAction } from "./abstractTaskService.js";
import { tasksSchemaId } from "../../../services/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { WorkbenchStateContext } from "../../../common/contextkeys.js";
import { Extensions as QuickAccessExtensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { TasksQuickAccessProvider } from "./tasksQuickAccess.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { TaskDefinitionRegistry } from "../common/taskDefinitionRegistry.js";
import { TerminalMenuBarGroup } from "../../terminal/browser/terminalMenus.js";
import { isString } from "../../../../base/common/types.js";
import { promiseWithResolvers } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { TerminalContextKeys } from "../../terminal/common/terminalContextKey.js";
import { ITerminalService } from "../../terminal/browser/terminal.js";
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RunAutomaticTasks, LifecyclePhase.Eventually);
registerAction2(ManageAutomaticTaskRunning);
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ManageAutomaticTaskRunning.ID,
    title: ManageAutomaticTaskRunning.LABEL,
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
let TaskStatusBarContributions = class extends Disposable {
  constructor(_taskService, _statusbarService, _progressService) {
    super();
    this._taskService = _taskService;
    this._statusbarService = _statusbarService;
    this._progressService = _progressService;
    this._activeTasksCount = 0;
    this._registerListeners();
  }
  _registerListeners() {
    let promise = void 0;
    let resolve;
    this._register(this._taskService.onDidStateChange((event) => {
      if (event.kind === TaskEventKind.Changed) {
        this._updateRunningTasksStatus();
      }
      if (!this._ignoreEventForUpdateRunningTasksCount(event)) {
        switch (event.kind) {
          case TaskEventKind.Active:
            this._activeTasksCount++;
            if (this._activeTasksCount === 1) {
              if (!promise) {
                ({ promise, resolve } = promiseWithResolvers());
              }
            }
            break;
          case TaskEventKind.Inactive:
            if (this._activeTasksCount > 0) {
              this._activeTasksCount--;
              if (this._activeTasksCount === 0) {
                if (promise && resolve) {
                  resolve();
                }
              }
            }
            break;
          case TaskEventKind.Terminated:
            if (this._activeTasksCount !== 0) {
              this._activeTasksCount = 0;
              if (promise && resolve) {
                resolve();
              }
            }
            break;
        }
      }
      if (promise && event.kind === TaskEventKind.Active && this._activeTasksCount === 1) {
        this._progressService.withProgress({ location: ProgressLocation.Window, command: "workbench.action.tasks.showTasks" }, (progress) => {
          progress.report({ message: nls.localize("building", "Building...") });
          return promise;
        }).then(() => {
          promise = void 0;
        });
      }
    }));
  }
  async _updateRunningTasksStatus() {
    const tasks = await this._taskService.getActiveTasks();
    if (tasks.length === 0) {
      if (this._runningTasksStatusItem) {
        this._runningTasksStatusItem.dispose();
        this._runningTasksStatusItem = void 0;
      }
    } else {
      const itemProps = {
        name: nls.localize("status.runningTasks", "Running Tasks"),
        text: `$(tools) ${tasks.length}`,
        ariaLabel: nls.localize("numberOfRunningTasks", "{0} running tasks", tasks.length),
        tooltip: nls.localize("runningTasks", "Show Running Tasks"),
        command: "workbench.action.tasks.showTasks"
      };
      if (!this._runningTasksStatusItem) {
        this._runningTasksStatusItem = this._statusbarService.addEntry(itemProps, "status.runningTasks", StatusbarAlignment.LEFT, { location: { id: "status.problems", priority: 50 }, alignment: StatusbarAlignment.RIGHT });
      } else {
        this._runningTasksStatusItem.update(itemProps);
      }
    }
  }
  _ignoreEventForUpdateRunningTasksCount(event) {
    if (!this._taskService.inTerminal() || event.kind === TaskEventKind.Changed) {
      return false;
    }
    if ((isString(event.group) ? event.group : event.group?._id) !== TaskGroup.Build._id) {
      return true;
    }
    return event.__task.configurationProperties.problemMatchers === void 0 || event.__task.configurationProperties.problemMatchers.length === 0;
  }
};
TaskStatusBarContributions = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, IProgressService)
], TaskStatusBarContributions);
workbenchRegistry.registerWorkbenchContribution(TaskStatusBarContributions, LifecyclePhase.Restored);
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Run,
  command: {
    id: "workbench.action.tasks.runTask",
    title: nls.localize({ key: "miRunTask", comment: ["&& denotes a mnemonic"] }, "&&Run Task...")
  },
  order: 1,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Run,
  command: {
    id: "workbench.action.tasks.build",
    title: nls.localize({ key: "miBuildTask", comment: ["&& denotes a mnemonic"] }, "Run &&Build Task...")
  },
  order: 2,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Manage,
  command: {
    precondition: TASK_RUNNING_STATE,
    id: "workbench.action.tasks.showTasks",
    title: nls.localize({ key: "miRunningTask", comment: ["&& denotes a mnemonic"] }, "Show Runnin&&g Tasks...")
  },
  order: 1,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Manage,
  command: {
    precondition: TASK_RUNNING_STATE,
    id: "workbench.action.tasks.restartTask",
    title: nls.localize({ key: "miRestartTask", comment: ["&& denotes a mnemonic"] }, "R&&estart Running Task...")
  },
  order: 2,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Manage,
  command: {
    precondition: TASK_RUNNING_STATE,
    id: "workbench.action.tasks.terminate",
    title: nls.localize({ key: "miTerminateTask", comment: ["&& denotes a mnemonic"] }, "&&Terminate Task...")
  },
  order: 3,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Configure,
  command: {
    id: "workbench.action.tasks.configureTaskRunner",
    title: nls.localize({ key: "miConfigureTask", comment: ["&& denotes a mnemonic"] }, "&&Configure Tasks...")
  },
  order: 1,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.MenubarTerminalMenu, {
  group: TerminalMenuBarGroup.Configure,
  command: {
    id: "workbench.action.tasks.configureDefaultBuildTask",
    title: nls.localize({ key: "miConfigureBuildTask", comment: ["&& denotes a mnemonic"] }, "Configure De&&fault Build Task...")
  },
  order: 2,
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.openWorkspaceFileTasks",
    title: nls.localize2("workbench.action.tasks.openWorkspaceFileTasks", "Open Workspace Tasks"),
    category: TASKS_CATEGORY
  },
  when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("workspace"), TaskExecutionSupportedContext)
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ConfigureTaskAction.ID,
    title: ConfigureTaskAction.TEXT,
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.showLog",
    title: nls.localize2("ShowLogAction.label", "Show Task Log"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.runTask",
    title: nls.localize2("RunTaskAction.label", "Run Task"),
    category: TASKS_CATEGORY
  }
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.reRunTask",
    title: nls.localize2("ReRunTaskAction.label", "Rerun Last Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.restartTask",
    title: nls.localize2("RestartTaskAction.label", "Restart Running Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.showTasks",
    title: nls.localize2("ShowTasksAction.label", "Show Running Tasks"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.terminate",
    title: nls.localize2("TerminateAction.label", "Terminate Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.build",
    title: nls.localize2("BuildAction.label", "Run Build Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.test",
    title: nls.localize2("TestAction.label", "Run Test Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.configureDefaultBuildTask",
    title: nls.localize2("ConfigureDefaultBuildTask.label", "Configure Default Build Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.configureDefaultTestTask",
    title: nls.localize2("ConfigureDefaultTestTask.label", "Configure Default Test Task"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: "workbench.action.tasks.openUserTasks",
    title: nls.localize2("workbench.action.tasks.openUserTasks", "Open User Tasks"),
    category: TASKS_CATEGORY
  },
  when: TaskExecutionSupportedContext
});
class UserTasksGlobalActionContribution extends Disposable {
  constructor() {
    super();
    this.registerActions();
  }
  registerActions() {
    const id = "workbench.action.tasks.openUserTasks";
    const title = nls.localize("tasks", "Tasks");
    this._register(MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      command: {
        id,
        title
      },
      when: TaskExecutionSupportedContext,
      group: "2_configuration",
      order: 6
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
      command: {
        id,
        title
      },
      when: TaskExecutionSupportedContext,
      group: "2_configuration",
      order: 6
    }));
  }
}
workbenchRegistry.registerWorkbenchContribution(UserTasksGlobalActionContribution, LifecyclePhase.Restored);
KeybindingsRegistry.registerKeybindingRule({
  id: "workbench.action.tasks.build",
  weight: KeybindingWeight.WorkbenchContrib,
  when: TaskCommandsRegistered,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyB
});
const outputChannelRegistry = Registry.as(OutputExt.OutputChannels);
outputChannelRegistry.registerChannel({ id: AbstractTaskService.OutputChannelId, label: AbstractTaskService.OutputChannelLabel, log: false });
const quickAccessRegistry = Registry.as(QuickAccessExtensions.Quickaccess);
const tasksPickerContextKey = "inTasksPicker";
quickAccessRegistry.registerQuickAccessProvider({
  ctor: TasksQuickAccessProvider,
  prefix: TasksQuickAccessProvider.PREFIX,
  contextKey: tasksPickerContextKey,
  placeholder: nls.localize("tasksQuickAccessPlaceholder", "Type the name of a task to run."),
  helpEntries: [{ description: nls.localize("tasksQuickAccessHelp", "Run Task"), commandCenterOrder: 60 }]
});
const schema = {
  id: tasksSchemaId,
  description: "Task definition file",
  type: "object",
  allowTrailingCommas: true,
  allowComments: true,
  default: {
    version: "2.0.0",
    tasks: [
      {
        label: "My Task",
        command: "echo hello",
        type: "shell",
        args: [],
        problemMatcher: ["$tsc"],
        presentation: {
          reveal: "always"
        },
        group: "build"
      }
    ]
  }
};
schema.definitions = {
  ...schemaVersion1.definitions,
  ...schemaVersion2.definitions
};
schema.oneOf = [...schemaVersion2.oneOf || [], ...schemaVersion1.oneOf || []];
const jsonRegistry = Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(tasksSchemaId, schema);
class TaskRegistryContribution extends Disposable {
  constructor() {
    super();
    this._register(ProblemMatcherRegistry.onMatcherChanged(() => {
      updateProblemMatchers();
      jsonRegistry.notifySchemaChanged(tasksSchemaId);
    }));
    this._register(TaskDefinitionRegistry.onDefinitionsChanged(() => {
      updateTaskDefinitions();
      jsonRegistry.notifySchemaChanged(tasksSchemaId);
    }));
  }
}
TaskRegistryContribution.ID = "taskRegistryContribution";
registerWorkbenchContribution2(TaskRegistryContribution.ID, TaskRegistryContribution, WorkbenchPhase.AfterRestored);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "task",
  order: 100,
  title: nls.localize("tasksConfigurationTitle", "Tasks"),
  type: "object",
  properties: {
    [TaskSettingId.ProblemMatchersNeverPrompt]: {
      markdownDescription: nls.localize("task.problemMatchers.neverPrompt", "Configures whether to show the problem matcher prompt when running a task. Set to `true` to never prompt, or use a dictionary of task types to turn off prompting only for specific task types."),
      "oneOf": [
        {
          type: "boolean",
          markdownDescription: nls.localize("task.problemMatchers.neverPrompt.boolean", "Sets problem matcher prompting behavior for all tasks.")
        },
        {
          type: "object",
          patternProperties: {
            ".*": {
              type: "boolean"
            }
          },
          markdownDescription: nls.localize("task.problemMatchers.neverPrompt.array", "An object containing task type-boolean pairs to never prompt for problem matchers on."),
          default: {
            "shell": true
          }
        }
      ],
      default: false
    },
    [TaskSettingId.AutoDetect]: {
      markdownDescription: nls.localize("task.autoDetect", "Controls enablement of `provideTasks` for all task provider extension. If the Tasks: Run Task command is slow, disabling auto detect for task providers may help. Individual extensions may also provide settings that disable auto detection."),
      type: "string",
      enum: ["on", "off"],
      default: "on"
    },
    [TaskSettingId.SlowProviderWarning]: {
      markdownDescription: nls.localize("task.slowProviderWarning", "Configures whether a warning is shown when a provider is slow"),
      "oneOf": [
        {
          type: "boolean",
          markdownDescription: nls.localize("task.slowProviderWarning.boolean", "Sets the slow provider warning for all tasks.")
        },
        {
          type: "array",
          items: {
            type: "string",
            markdownDescription: nls.localize("task.slowProviderWarning.array", "An array of task types to never show the slow provider warning.")
          }
        }
      ],
      default: true
    },
    [TaskSettingId.QuickOpenHistory]: {
      markdownDescription: nls.localize("task.quickOpen.history", "Controls the number of recent items tracked in task quick open dialog."),
      type: "number",
      default: 30,
      minimum: 0,
      maximum: 30
    },
    [TaskSettingId.QuickOpenDetail]: {
      markdownDescription: nls.localize("task.quickOpen.detail", "Controls whether to show the task detail for tasks that have a detail in task quick picks, such as Run Task."),
      type: "boolean",
      default: true
    },
    [TaskSettingId.QuickOpenSkip]: {
      type: "boolean",
      description: nls.localize("task.quickOpen.skip", "Controls whether the task quick pick is skipped when there is only one task to pick from."),
      default: false
    },
    [TaskSettingId.QuickOpenShowAll]: {
      type: "boolean",
      description: nls.localize("task.quickOpen.showAll", 'Causes the Tasks: Run Task command to use the slower "show all" behavior instead of the faster two level picker where tasks are grouped by provider.'),
      default: false
    },
    [TaskSettingId.AllowAutomaticTasks]: {
      type: "string",
      enum: ["on", "off"],
      enumDescriptions: [
        nls.localize("task.allowAutomaticTasks.on", "Always"),
        nls.localize("task.allowAutomaticTasks.off", "Never")
      ],
      description: nls.localize("task.allowAutomaticTasks", "Enable automatic tasks - note that tasks won't run in an untrusted workspace."),
      default: "on",
      restricted: true
    },
    [TaskSettingId.Reconnection]: {
      type: "boolean",
      description: nls.localize("task.reconnection", "On window reload, reconnect to tasks that have problem matchers."),
      default: true
    },
    [TaskSettingId.SaveBeforeRun]: {
      markdownDescription: nls.localize(
        "task.saveBeforeRun",
        "Save all dirty editors before running a task."
      ),
      type: "string",
      enum: ["always", "never", "prompt"],
      enumDescriptions: [
        nls.localize("task.saveBeforeRun.always", "Always saves all editors before running."),
        nls.localize("task.saveBeforeRun.never", "Never saves editors before running."),
        nls.localize("task.SaveBeforeRun.prompt", "Prompts whether to save editors before running.")
      ],
      default: "always"
    },
    [TaskSettingId.VerboseLogging]: {
      type: "boolean",
      description: nls.localize("task.verboseLogging", "Enable verbose logging for tasks."),
      default: false
    }
  }
});
const rerunTaskIcon = registerIcon("rerun-task", Codicon.refresh, nls.localize("rerunTaskIcon", "View icon of the rerun task."));
const RerunForActiveTerminalCommandId = "workbench.action.tasks.rerunForActiveTerminal";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RerunForActiveTerminalCommandId,
      icon: rerunTaskIcon,
      title: nls.localize2("workbench.action.tasks.rerunForActiveTerminal", "Rerun Task"),
      precondition: TASK_TERMINAL_ACTIVE,
      menu: [{ id: MenuId.TerminalInstanceContext, when: TASK_TERMINAL_ACTIVE }],
      keybinding: {
        when: TerminalContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
        mac: {
          primary: KeyMod.WinCtrl | KeyMod.Shift | KeyCode.KeyR
        },
        weight: KeybindingWeight.WorkbenchContrib
      }
    });
  }
  async run(accessor, args) {
    const terminalService = accessor.get(ITerminalService);
    const taskSystem = accessor.get(ITaskService);
    const instance = args ?? terminalService.activeInstance;
    if (instance) {
      await taskSystem.rerun(instance.instanceId);
    }
  }
});
export {
  RerunForActiveTerminalCommandId,
  TaskRegistryContribution,
  TaskStatusBarContributions,
  rerunTaskIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL3Rhc2suY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNZW51UmVnaXN0cnksIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5cbmltcG9ydCB7IFByb2JsZW1NYXRjaGVyUmVnaXN0cnkgfSBmcm9tICcuLi9jb21tb24vcHJvYmxlbU1hdGNoZXIuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5cbmltcG9ydCAqIGFzIGpzb25Db250cmlidXRpb25SZWdpc3RyeSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5cbmltcG9ydCB7IFN0YXR1c2JhckFsaWdubWVudCwgSVN0YXR1c2JhclNlcnZpY2UsIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yLCBJU3RhdHVzYmFyRW50cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuXG5pbXBvcnQgeyBJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIE91dHB1dEV4dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL291dHB1dC9jb21tb24vb3V0cHV0LmpzJztcblxuaW1wb3J0IHsgSVRhc2tFdmVudCwgVGFza0dyb3VwLCBUYXNrU2V0dGluZ0lkLCBUQVNLU19DQVRFR09SWSwgVEFTS19SVU5OSU5HX1NUQVRFLCBUQVNLX1RFUk1JTkFMX0FDVElWRSwgVGFza0V2ZW50S2luZCB9IGZyb20gJy4uL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBJVGFza1NlcnZpY2UsIFRhc2tDb21tYW5kc1JlZ2lzdGVyZWQsIFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0IH0gZnJvbSAnLi4vY29tbW9uL3Rhc2tTZXJ2aWNlLmpzJztcblxuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZSwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgUnVuQXV0b21hdGljVGFza3MsIE1hbmFnZUF1dG9tYXRpY1Rhc2tSdW5uaW5nIH0gZnJvbSAnLi9ydW5BdXRvbWF0aWNUYXNrcy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nc1JlZ2lzdHJ5LCBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgc2NoZW1hVmVyc2lvbjEgZnJvbSAnLi4vY29tbW9uL2pzb25TY2hlbWFfdjEuanMnO1xuaW1wb3J0IHNjaGVtYVZlcnNpb24yLCB7IHVwZGF0ZVByb2JsZW1NYXRjaGVycywgdXBkYXRlVGFza0RlZmluaXRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2pzb25TY2hlbWFfdjIuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUYXNrU2VydmljZSwgQ29uZmlndXJlVGFza0FjdGlvbiB9IGZyb20gJy4vYWJzdHJhY3RUYXNrU2VydmljZS5qcyc7XG5pbXBvcnQgeyB0YXNrc1NjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFN0YXRlQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tBY2Nlc3NSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBRdWlja0FjY2Vzc0V4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBUYXNrc1F1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuL3Rhc2tzUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFRhc2tEZWZpbml0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi9jb21tb24vdGFza0RlZmluaXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbE1lbnVCYXJHcm91cCB9IGZyb20gJy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWxNZW51cy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IHByb21pc2VXaXRoUmVzb2x2ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBUZXJtaW5hbENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsQ29udGV4dEtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsU2VydmljZSB9IGZyb20gJy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuXG5jb25zdCB3b3JrYmVuY2hSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFJ1bkF1dG9tYXRpY1Rhc2tzLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxucmVnaXN0ZXJBY3Rpb24yKE1hbmFnZUF1dG9tYXRpY1Rhc2tSdW5uaW5nKTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBNYW5hZ2VBdXRvbWF0aWNUYXNrUnVubmluZy5JRCxcblx0XHR0aXRsZTogTWFuYWdlQXV0b21hdGljVGFza1J1bm5pbmcuTEFCRUwsXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcblxuZXhwb3J0IGNsYXNzIFRhc2tTdGF0dXNCYXJDb250cmlidXRpb25zIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRwcml2YXRlIF9ydW5uaW5nVGFza3NTdGF0dXNJdGVtOiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYWN0aXZlVGFza3NDb3VudDogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRhc2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rhc2tTZXJ2aWNlOiBJVGFza1NlcnZpY2UsXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0YXR1c2JhclNlcnZpY2U6IElTdGF0dXNiYXJTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRsZXQgcHJvbWlzZTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsZXQgcmVzb2x2ZTogKHZhbHVlPzogdm9pZCB8IFRoZW5hYmxlPHZvaWQ+KSA9PiB2b2lkO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rhc2tTZXJ2aWNlLm9uRGlkU3RhdGVDaGFuZ2UoZXZlbnQgPT4ge1xuXHRcdFx0aWYgKGV2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVSdW5uaW5nVGFza3NTdGF0dXMoKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLl9pZ25vcmVFdmVudEZvclVwZGF0ZVJ1bm5pbmdUYXNrc0NvdW50KGV2ZW50KSkge1xuXHRcdFx0XHRzd2l0Y2ggKGV2ZW50LmtpbmQpIHtcblx0XHRcdFx0XHRjYXNlIFRhc2tFdmVudEtpbmQuQWN0aXZlOlxuXHRcdFx0XHRcdFx0dGhpcy5fYWN0aXZlVGFza3NDb3VudCsrO1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX2FjdGl2ZVRhc2tzQ291bnQgPT09IDEpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCFwcm9taXNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0KHsgcHJvbWlzZSwgcmVzb2x2ZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8dm9pZD4oKSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgVGFza0V2ZW50S2luZC5JbmFjdGl2ZTpcblx0XHRcdFx0XHRcdC8vIFNpbmNlIHRoZSBleGl0aW5nIG9mIHRoZSBzdWIgcHJvY2VzcyBpcyBjb21tdW5pY2F0ZWQgYXN5bmMgd2UgY2FuJ3Qgb3JkZXIgaW5hY3RpdmUgYW5kIHRlcm1pbmF0ZSBldmVudHMuXG5cdFx0XHRcdFx0XHQvLyBTbyB0cnkgdG8gdHJlYXQgdGhlbSBhY2NvcmRpbmdseS5cblx0XHRcdFx0XHRcdGlmICh0aGlzLl9hY3RpdmVUYXNrc0NvdW50ID4gMCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9hY3RpdmVUYXNrc0NvdW50LS07XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLl9hY3RpdmVUYXNrc0NvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHByb21pc2UgJiYgcmVzb2x2ZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSEoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgVGFza0V2ZW50S2luZC5UZXJtaW5hdGVkOlxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX2FjdGl2ZVRhc2tzQ291bnQgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fYWN0aXZlVGFza3NDb3VudCA9IDA7XG5cdFx0XHRcdFx0XHRcdGlmIChwcm9taXNlICYmIHJlc29sdmUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXNvbHZlISgpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocHJvbWlzZSAmJiAoZXZlbnQua2luZCA9PT0gVGFza0V2ZW50S2luZC5BY3RpdmUpICYmICh0aGlzLl9hY3RpdmVUYXNrc0NvdW50ID09PSAxKSkge1xuXHRcdFx0XHR0aGlzLl9wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHsgbG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LCBjb21tYW5kOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5zaG93VGFza3MnIH0sIHByb2dyZXNzID0+IHtcblx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBubHMubG9jYWxpemUoJ2J1aWxkaW5nJywgJ0J1aWxkaW5nLi4uJykgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIHByb21pc2UhO1xuXHRcdFx0XHR9KS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRwcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVSdW5uaW5nVGFza3NTdGF0dXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGFza3MgPSBhd2FpdCB0aGlzLl90YXNrU2VydmljZS5nZXRBY3RpdmVUYXNrcygpO1xuXHRcdGlmICh0YXNrcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGlmICh0aGlzLl9ydW5uaW5nVGFza3NTdGF0dXNJdGVtKSB7XG5cdFx0XHRcdHRoaXMuX3J1bm5pbmdUYXNrc1N0YXR1c0l0ZW0uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9ydW5uaW5nVGFza3NTdGF0dXNJdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpdGVtUHJvcHM6IElTdGF0dXNiYXJFbnRyeSA9IHtcblx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplKCdzdGF0dXMucnVubmluZ1Rhc2tzJywgXCJSdW5uaW5nIFRhc2tzXCIpLFxuXHRcdFx0XHR0ZXh0OiBgJCh0b29scykgJHt0YXNrcy5sZW5ndGh9YCxcblx0XHRcdFx0YXJpYUxhYmVsOiBubHMubG9jYWxpemUoJ251bWJlck9mUnVubmluZ1Rhc2tzJywgXCJ7MH0gcnVubmluZyB0YXNrc1wiLCB0YXNrcy5sZW5ndGgpLFxuXHRcdFx0XHR0b29sdGlwOiBubHMubG9jYWxpemUoJ3J1bm5pbmdUYXNrcycsIFwiU2hvdyBSdW5uaW5nIFRhc2tzXCIpLFxuXHRcdFx0XHRjb21tYW5kOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5zaG93VGFza3MnLFxuXHRcdFx0fTtcblxuXHRcdFx0aWYgKCF0aGlzLl9ydW5uaW5nVGFza3NTdGF0dXNJdGVtKSB7XG5cdFx0XHRcdHRoaXMuX3J1bm5pbmdUYXNrc1N0YXR1c0l0ZW0gPSB0aGlzLl9zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KGl0ZW1Qcm9wcywgJ3N0YXR1cy5ydW5uaW5nVGFza3MnLCBTdGF0dXNiYXJBbGlnbm1lbnQuTEVGVCwgeyBsb2NhdGlvbjogeyBpZDogJ3N0YXR1cy5wcm9ibGVtcycsIHByaW9yaXR5OiA1MCB9LCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3J1bm5pbmdUYXNrc1N0YXR1c0l0ZW0udXBkYXRlKGl0ZW1Qcm9wcyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaWdub3JlRXZlbnRGb3JVcGRhdGVSdW5uaW5nVGFza3NDb3VudChldmVudDogSVRhc2tFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fdGFza1NlcnZpY2UuaW5UZXJtaW5hbCgpIHx8IGV2ZW50LmtpbmQgPT09IFRhc2tFdmVudEtpbmQuQ2hhbmdlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICgoaXNTdHJpbmcoZXZlbnQuZ3JvdXApID8gZXZlbnQuZ3JvdXAgOiBldmVudC5ncm91cD8uX2lkKSAhPT0gVGFza0dyb3VwLkJ1aWxkLl9pZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV2ZW50Ll9fdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5wcm9ibGVtTWF0Y2hlcnMgPT09IHVuZGVmaW5lZCB8fCBldmVudC5fX3Rhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMucHJvYmxlbU1hdGNoZXJzLmxlbmd0aCA9PT0gMDtcblx0fVxufVxuXG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihUYXNrU3RhdHVzQmFyQ29udHJpYnV0aW9ucywgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJUZXJtaW5hbE1lbnUsIHtcblx0Z3JvdXA6IFRlcm1pbmFsTWVudUJhckdyb3VwLlJ1bixcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5ydW5UYXNrJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlSdW5UYXNrJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUnVuIFRhc2suLi5cIilcblx0fSxcblx0b3JkZXI6IDEsXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVGVybWluYWxNZW51LCB7XG5cdGdyb3VwOiBUZXJtaW5hbE1lbnVCYXJHcm91cC5SdW4sXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuYnVpbGQnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUJ1aWxkVGFzaycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJSdW4gJiZCdWlsZCBUYXNrLi4uXCIpXG5cdH0sXG5cdG9yZGVyOiAyLFxuXHR3aGVuOiBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dFxufSk7XG5cbi8vIE1hbmFnZSBUYXNrc1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVGVybWluYWxNZW51LCB7XG5cdGdyb3VwOiBUZXJtaW5hbE1lbnVCYXJHcm91cC5NYW5hZ2UsXG5cdGNvbW1hbmQ6IHtcblx0XHRwcmVjb25kaXRpb246IFRBU0tfUlVOTklOR19TVEFURSxcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Muc2hvd1Rhc2tzJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlSdW5uaW5nVGFzaycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJTaG93IFJ1bm5pbiYmZyBUYXNrcy4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMSxcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJUZXJtaW5hbE1lbnUsIHtcblx0Z3JvdXA6IFRlcm1pbmFsTWVudUJhckdyb3VwLk1hbmFnZSxcblx0Y29tbWFuZDoge1xuXHRcdHByZWNvbmRpdGlvbjogVEFTS19SVU5OSU5HX1NUQVRFLFxuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5yZXN0YXJ0VGFzaycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pUmVzdGFydFRhc2snLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiUiYmZXN0YXJ0IFJ1bm5pbmcgVGFzay4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMixcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJUZXJtaW5hbE1lbnUsIHtcblx0Z3JvdXA6IFRlcm1pbmFsTWVudUJhckdyb3VwLk1hbmFnZSxcblx0Y29tbWFuZDoge1xuXHRcdHByZWNvbmRpdGlvbjogVEFTS19SVU5OSU5HX1NUQVRFLFxuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy50ZXJtaW5hdGUnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVRlcm1pbmF0ZVRhc2snLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZUZXJtaW5hdGUgVGFzay4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMyxcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuXG4vLyBDb25maWd1cmUgVGFza3Ncbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhclRlcm1pbmFsTWVudSwge1xuXHRncm91cDogVGVybWluYWxNZW51QmFyR3JvdXAuQ29uZmlndXJlLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmNvbmZpZ3VyZVRhc2tSdW5uZXInLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUNvbmZpZ3VyZVRhc2snLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDb25maWd1cmUgVGFza3MuLi5cIilcblx0fSxcblx0b3JkZXI6IDEsXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyVGVybWluYWxNZW51LCB7XG5cdGdyb3VwOiBUZXJtaW5hbE1lbnVCYXJHcm91cC5Db25maWd1cmUsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuY29uZmlndXJlRGVmYXVsdEJ1aWxkVGFzaycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pQ29uZmlndXJlQnVpbGRUYXNrJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkNvbmZpZ3VyZSBEZSYmZmF1bHQgQnVpbGQgVGFzay4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMixcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuXG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5vcGVuV29ya3NwYWNlRmlsZVRhc2tzJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi50YXNrcy5vcGVuV29ya3NwYWNlRmlsZVRhc2tzJywgXCJPcGVuIFdvcmtzcGFjZSBUYXNrc1wiKSxcblx0XHRjYXRlZ29yeTogVEFTS1NfQ0FURUdPUllcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpLCBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dClcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ29uZmlndXJlVGFza0FjdGlvbi5JRCxcblx0XHR0aXRsZTogQ29uZmlndXJlVGFza0FjdGlvbi5URVhULFxuXHRcdGNhdGVnb3J5OiBUQVNLU19DQVRFR09SWVxuXHR9LFxuXHR3aGVuOiBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dFxufSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Muc2hvd0xvZycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1Nob3dMb2dBY3Rpb24ubGFiZWwnLCBcIlNob3cgVGFzayBMb2dcIiksXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5ydW5UYXNrJyxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignUnVuVGFza0FjdGlvbi5sYWJlbCcsIFwiUnVuIFRhc2tcIiksXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH1cbn0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlUnVuVGFzaycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1JlUnVuVGFza0FjdGlvbi5sYWJlbCcsIFwiUmVydW4gTGFzdCBUYXNrXCIpLFxuXHRcdGNhdGVnb3J5OiBUQVNLU19DQVRFR09SWVxuXHR9LFxuXHR3aGVuOiBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dFxufSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MucmVzdGFydFRhc2snLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdSZXN0YXJ0VGFza0FjdGlvbi5sYWJlbCcsIFwiUmVzdGFydCBSdW5uaW5nIFRhc2tcIiksXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5zaG93VGFza3MnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdTaG93VGFza3NBY3Rpb24ubGFiZWwnLCBcIlNob3cgUnVubmluZyBUYXNrc1wiKSxcblx0XHRjYXRlZ29yeTogVEFTS1NfQ0FURUdPUllcblx0fSxcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnRlcm1pbmF0ZScsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1Rlcm1pbmF0ZUFjdGlvbi5sYWJlbCcsIFwiVGVybWluYXRlIFRhc2tcIiksXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5idWlsZCcsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ0J1aWxkQWN0aW9uLmxhYmVsJywgXCJSdW4gQnVpbGQgVGFza1wiKSxcblx0XHRjYXRlZ29yeTogVEFTS1NfQ0FURUdPUllcblx0fSxcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnRlc3QnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdUZXN0QWN0aW9uLmxhYmVsJywgXCJSdW4gVGVzdCBUYXNrXCIpLFxuXHRcdGNhdGVnb3J5OiBUQVNLU19DQVRFR09SWVxuXHR9LFxuXHR3aGVuOiBUYXNrRXhlY3V0aW9uU3VwcG9ydGVkQ29udGV4dFxufSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNvbW1hbmRQYWxldHRlLCB7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuY29uZmlndXJlRGVmYXVsdEJ1aWxkVGFzaycsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ0NvbmZpZ3VyZURlZmF1bHRCdWlsZFRhc2subGFiZWwnLCBcIkNvbmZpZ3VyZSBEZWZhdWx0IEJ1aWxkIFRhc2tcIiksXG5cdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsIHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5jb25maWd1cmVEZWZhdWx0VGVzdFRhc2snLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdDb25maWd1cmVEZWZhdWx0VGVzdFRhc2subGFiZWwnLCBcIkNvbmZpZ3VyZSBEZWZhdWx0IFRlc3QgVGFza1wiKSxcblx0XHRjYXRlZ29yeTogVEFTS1NfQ0FURUdPUllcblx0fSxcblx0d2hlbjogVGFza0V4ZWN1dGlvblN1cHBvcnRlZENvbnRleHRcbn0pO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRjb21tYW5kOiB7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLm9wZW5Vc2VyVGFza3MnLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLm9wZW5Vc2VyVGFza3MnLCBcIk9wZW4gVXNlciBUYXNrc1wiKSwgY2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdH0sXG5cdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0XG59KTtcblxuY2xhc3MgVXNlclRhc2tzR2xvYmFsQWN0aW9uQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5yZWdpc3RlckFjdGlvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJBY3Rpb25zKCkge1xuXHRcdGNvbnN0IGlkID0gJ3dvcmtiZW5jaC5hY3Rpb24udGFza3Mub3BlblVzZXJUYXNrcyc7XG5cdFx0Y29uc3QgdGl0bGUgPSBubHMubG9jYWxpemUoJ3Rhc2tzJywgXCJUYXNrc1wiKTtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkdsb2JhbEFjdGl2aXR5LCB7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHR0aXRsZVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0LFxuXHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0b3JkZXI6IDZcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyUHJlZmVyZW5jZXNNZW51LCB7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHR0aXRsZVxuXHRcdFx0fSxcblx0XHRcdHdoZW46IFRhc2tFeGVjdXRpb25TdXBwb3J0ZWRDb250ZXh0LFxuXHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0b3JkZXI6IDZcblx0XHR9KSk7XG5cdH1cbn1cbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFVzZXJUYXNrc0dsb2JhbEFjdGlvbkNvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG4vLyBNZW51UmVnaXN0cnkuYWRkQ29tbWFuZCggeyBpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MucmVidWlsZCcsIHRpdGxlOiBubHMubG9jYWxpemUoJ1JlYnVpbGRBY3Rpb24ubGFiZWwnLCAnUnVuIFJlYnVpbGQgVGFzaycpLCBjYXRlZ29yeTogdGFza3NDYXRlZ29yeSB9KTtcbi8vIE1lbnVSZWdpc3RyeS5hZGRDb21tYW5kKCB7IGlkOiAnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5jbGVhbicsIHRpdGxlOiBubHMubG9jYWxpemUoJ0NsZWFuQWN0aW9uLmxhYmVsJywgJ1J1biBDbGVhbiBUYXNrJyksIGNhdGVnb3J5OiB0YXNrc0NhdGVnb3J5IH0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGFza3MuYnVpbGQnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0d2hlbjogVGFza0NvbW1hbmRzUmVnaXN0ZXJlZCxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUJcbn0pO1xuXG4vLyBUYXNrcyBPdXRwdXQgY2hhbm5lbC4gUmVnaXN0ZXIgaXQgYmVmb3JlIHVzaW5nIGl0IGluIFRhc2sgU2VydmljZS5cbmNvbnN0IG91dHB1dENoYW5uZWxSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElPdXRwdXRDaGFubmVsUmVnaXN0cnk+KE91dHB1dEV4dC5PdXRwdXRDaGFubmVscyk7XG5vdXRwdXRDaGFubmVsUmVnaXN0cnkucmVnaXN0ZXJDaGFubmVsKHsgaWQ6IEFic3RyYWN0VGFza1NlcnZpY2UuT3V0cHV0Q2hhbm5lbElkLCBsYWJlbDogQWJzdHJhY3RUYXNrU2VydmljZS5PdXRwdXRDaGFubmVsTGFiZWwsIGxvZzogZmFsc2UgfSk7XG5cblxuLy8gUmVnaXN0ZXIgUXVpY2sgQWNjZXNzXG5jb25zdCBxdWlja0FjY2Vzc1JlZ2lzdHJ5ID0gKFJlZ2lzdHJ5LmFzPElRdWlja0FjY2Vzc1JlZ2lzdHJ5PihRdWlja0FjY2Vzc0V4dGVuc2lvbnMuUXVpY2thY2Nlc3MpKTtcbmNvbnN0IHRhc2tzUGlja2VyQ29udGV4dEtleSA9ICdpblRhc2tzUGlja2VyJztcblxucXVpY2tBY2Nlc3NSZWdpc3RyeS5yZWdpc3RlclF1aWNrQWNjZXNzUHJvdmlkZXIoe1xuXHRjdG9yOiBUYXNrc1F1aWNrQWNjZXNzUHJvdmlkZXIsXG5cdHByZWZpeDogVGFza3NRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0Y29udGV4dEtleTogdGFza3NQaWNrZXJDb250ZXh0S2V5LFxuXHRwbGFjZWhvbGRlcjogbmxzLmxvY2FsaXplKCd0YXNrc1F1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlR5cGUgdGhlIG5hbWUgb2YgYSB0YXNrIHRvIHJ1bi5cIiksXG5cdGhlbHBFbnRyaWVzOiBbeyBkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0YXNrc1F1aWNrQWNjZXNzSGVscCcsIFwiUnVuIFRhc2tcIiksIGNvbW1hbmRDZW50ZXJPcmRlcjogNjAgfV1cbn0pO1xuXG4vLyB0YXNrcy5qc29uIHZhbGlkYXRpb25cbmNvbnN0IHNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdGlkOiB0YXNrc1NjaGVtYUlkLFxuXHRkZXNjcmlwdGlvbjogJ1Rhc2sgZGVmaW5pdGlvbiBmaWxlJyxcblx0dHlwZTogJ29iamVjdCcsXG5cdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdGFsbG93Q29tbWVudHM6IHRydWUsXG5cdGRlZmF1bHQ6IHtcblx0XHR2ZXJzaW9uOiAnMi4wLjAnLFxuXHRcdHRhc2tzOiBbXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiAnTXkgVGFzaycsXG5cdFx0XHRcdGNvbW1hbmQ6ICdlY2hvIGhlbGxvJyxcblx0XHRcdFx0dHlwZTogJ3NoZWxsJyxcblx0XHRcdFx0YXJnczogW10sXG5cdFx0XHRcdHByb2JsZW1NYXRjaGVyOiBbJyR0c2MnXSxcblx0XHRcdFx0cHJlc2VudGF0aW9uOiB7XG5cdFx0XHRcdFx0cmV2ZWFsOiAnYWx3YXlzJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRncm91cDogJ2J1aWxkJ1xuXHRcdFx0fVxuXHRcdF1cblx0fVxufTtcblxuc2NoZW1hLmRlZmluaXRpb25zID0ge1xuXHQuLi5zY2hlbWFWZXJzaW9uMS5kZWZpbml0aW9ucyxcblx0Li4uc2NoZW1hVmVyc2lvbjIuZGVmaW5pdGlvbnMsXG59O1xuc2NoZW1hLm9uZU9mID0gWy4uLihzY2hlbWFWZXJzaW9uMi5vbmVPZiB8fCBbXSksIC4uLihzY2hlbWFWZXJzaW9uMS5vbmVPZiB8fCBbXSldO1xuXG5jb25zdCBqc29uUmVnaXN0cnkgPSA8anNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+UmVnaXN0cnkuYXMoanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LkV4dGVuc2lvbnMuSlNPTkNvbnRyaWJ1dGlvbik7XG5qc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEodGFza3NTY2hlbWFJZCwgc2NoZW1hKTtcblxuZXhwb3J0IGNsYXNzIFRhc2tSZWdpc3RyeUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0c3RhdGljIElEID0gJ3Rhc2tSZWdpc3RyeUNvbnRyaWJ1dGlvbic7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihQcm9ibGVtTWF0Y2hlclJlZ2lzdHJ5Lm9uTWF0Y2hlckNoYW5nZWQoKCkgPT4ge1xuXHRcdFx0dXBkYXRlUHJvYmxlbU1hdGNoZXJzKCk7XG5cdFx0XHRqc29uUmVnaXN0cnkubm90aWZ5U2NoZW1hQ2hhbmdlZCh0YXNrc1NjaGVtYUlkKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihUYXNrRGVmaW5pdGlvblJlZ2lzdHJ5Lm9uRGVmaW5pdGlvbnNDaGFuZ2VkKCgpID0+IHtcblx0XHRcdHVwZGF0ZVRhc2tEZWZpbml0aW9ucygpO1xuXHRcdFx0anNvblJlZ2lzdHJ5Lm5vdGlmeVNjaGVtYUNoYW5nZWQodGFza3NTY2hlbWFJZCk7XG5cdFx0fSkpO1xuXHR9XG59XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoVGFza1JlZ2lzdHJ5Q29udHJpYnV0aW9uLklELCBUYXNrUmVnaXN0cnlDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkFmdGVyUmVzdG9yZWQpO1xuXG5cbmNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdGlkOiAndGFzaycsXG5cdG9yZGVyOiAxMDAsXG5cdHRpdGxlOiBubHMubG9jYWxpemUoJ3Rhc2tzQ29uZmlndXJhdGlvblRpdGxlJywgXCJUYXNrc1wiKSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHRbVGFza1NldHRpbmdJZC5Qcm9ibGVtTWF0Y2hlcnNOZXZlclByb21wdF06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFzay5wcm9ibGVtTWF0Y2hlcnMubmV2ZXJQcm9tcHQnLCBcIkNvbmZpZ3VyZXMgd2hldGhlciB0byBzaG93IHRoZSBwcm9ibGVtIG1hdGNoZXIgcHJvbXB0IHdoZW4gcnVubmluZyBhIHRhc2suIFNldCB0byBgdHJ1ZWAgdG8gbmV2ZXIgcHJvbXB0LCBvciB1c2UgYSBkaWN0aW9uYXJ5IG9mIHRhc2sgdHlwZXMgdG8gdHVybiBvZmYgcHJvbXB0aW5nIG9ubHkgZm9yIHNwZWNpZmljIHRhc2sgdHlwZXMuXCIpLFxuXHRcdFx0J29uZU9mJzogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFzay5wcm9ibGVtTWF0Y2hlcnMubmV2ZXJQcm9tcHQuYm9vbGVhbicsICdTZXRzIHByb2JsZW0gbWF0Y2hlciBwcm9tcHRpbmcgYmVoYXZpb3IgZm9yIGFsbCB0YXNrcy4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0cGF0dGVyblByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdCcuKic6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2sucHJvYmxlbU1hdGNoZXJzLm5ldmVyUHJvbXB0LmFycmF5JywgJ0FuIG9iamVjdCBjb250YWluaW5nIHRhc2sgdHlwZS1ib29sZWFuIHBhaXJzIHRvIG5ldmVyIHByb21wdCBmb3IgcHJvYmxlbSBtYXRjaGVycyBvbi4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFx0XHQnc2hlbGwnOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUYXNrU2V0dGluZ0lkLkF1dG9EZXRlY3RdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2suYXV0b0RldGVjdCcsIFwiQ29udHJvbHMgZW5hYmxlbWVudCBvZiBgcHJvdmlkZVRhc2tzYCBmb3IgYWxsIHRhc2sgcHJvdmlkZXIgZXh0ZW5zaW9uLiBJZiB0aGUgVGFza3M6IFJ1biBUYXNrIGNvbW1hbmQgaXMgc2xvdywgZGlzYWJsaW5nIGF1dG8gZGV0ZWN0IGZvciB0YXNrIHByb3ZpZGVycyBtYXkgaGVscC4gSW5kaXZpZHVhbCBleHRlbnNpb25zIG1heSBhbHNvIHByb3ZpZGUgc2V0dGluZ3MgdGhhdCBkaXNhYmxlIGF1dG8gZGV0ZWN0aW9uLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydvbicsICdvZmYnXSxcblx0XHRcdGRlZmF1bHQ6ICdvbidcblx0XHR9LFxuXHRcdFtUYXNrU2V0dGluZ0lkLlNsb3dQcm92aWRlcldhcm5pbmddOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2suc2xvd1Byb3ZpZGVyV2FybmluZycsIFwiQ29uZmlndXJlcyB3aGV0aGVyIGEgd2FybmluZyBpcyBzaG93biB3aGVuIGEgcHJvdmlkZXIgaXMgc2xvd1wiKSxcblx0XHRcdCdvbmVPZic6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2suc2xvd1Byb3ZpZGVyV2FybmluZy5ib29sZWFuJywgJ1NldHMgdGhlIHNsb3cgcHJvdmlkZXIgd2FybmluZyBmb3IgYWxsIHRhc2tzLicpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFzay5zbG93UHJvdmlkZXJXYXJuaW5nLmFycmF5JywgJ0FuIGFycmF5IG9mIHRhc2sgdHlwZXMgdG8gbmV2ZXIgc2hvdyB0aGUgc2xvdyBwcm92aWRlciB3YXJuaW5nLicpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rhc2tTZXR0aW5nSWQuUXVpY2tPcGVuSGlzdG9yeV06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFzay5xdWlja09wZW4uaGlzdG9yeScsIFwiQ29udHJvbHMgdGhlIG51bWJlciBvZiByZWNlbnQgaXRlbXMgdHJhY2tlZCBpbiB0YXNrIHF1aWNrIG9wZW4gZGlhbG9nLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMzAsIG1pbmltdW06IDAsIG1heGltdW06IDMwXG5cdFx0fSxcblx0XHRbVGFza1NldHRpbmdJZC5RdWlja09wZW5EZXRhaWxdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2sucXVpY2tPcGVuLmRldGFpbCcsIFwiQ29udHJvbHMgd2hldGhlciB0byBzaG93IHRoZSB0YXNrIGRldGFpbCBmb3IgdGFza3MgdGhhdCBoYXZlIGEgZGV0YWlsIGluIHRhc2sgcXVpY2sgcGlja3MsIHN1Y2ggYXMgUnVuIFRhc2suXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W1Rhc2tTZXR0aW5nSWQuUXVpY2tPcGVuU2tpcF06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Rhc2sucXVpY2tPcGVuLnNraXAnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHRhc2sgcXVpY2sgcGljayBpcyBza2lwcGVkIHdoZW4gdGhlcmUgaXMgb25seSBvbmUgdGFzayB0byBwaWNrIGZyb20uXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUYXNrU2V0dGluZ0lkLlF1aWNrT3BlblNob3dBbGxdOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0YXNrLnF1aWNrT3Blbi5zaG93QWxsJywgXCJDYXVzZXMgdGhlIFRhc2tzOiBSdW4gVGFzayBjb21tYW5kIHRvIHVzZSB0aGUgc2xvd2VyIFxcXCJzaG93IGFsbFxcXCIgYmVoYXZpb3IgaW5zdGVhZCBvZiB0aGUgZmFzdGVyIHR3byBsZXZlbCBwaWNrZXIgd2hlcmUgdGFza3MgYXJlIGdyb3VwZWQgYnkgcHJvdmlkZXIuXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtUYXNrU2V0dGluZ0lkLkFsbG93QXV0b21hdGljVGFza3NdOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnb24nLCAnb2ZmJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFzay5hbGxvd0F1dG9tYXRpY1Rhc2tzLm9uJywgXCJBbHdheXNcIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFzay5hbGxvd0F1dG9tYXRpY1Rhc2tzLm9mZicsIFwiTmV2ZXJcIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndGFzay5hbGxvd0F1dG9tYXRpY1Rhc2tzJywgXCJFbmFibGUgYXV0b21hdGljIHRhc2tzIC0gbm90ZSB0aGF0IHRhc2tzIHdvbid0IHJ1biBpbiBhbiB1bnRydXN0ZWQgd29ya3NwYWNlLlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdvbicsXG5cdFx0XHRyZXN0cmljdGVkOiB0cnVlXG5cdFx0fSxcblx0XHRbVGFza1NldHRpbmdJZC5SZWNvbm5lY3Rpb25dOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0YXNrLnJlY29ubmVjdGlvbicsIFwiT24gd2luZG93IHJlbG9hZCwgcmVjb25uZWN0IHRvIHRhc2tzIHRoYXQgaGF2ZSBwcm9ibGVtIG1hdGNoZXJzLlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdFtUYXNrU2V0dGluZ0lkLlNhdmVCZWZvcmVSdW5dOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoXG5cdFx0XHRcdCd0YXNrLnNhdmVCZWZvcmVSdW4nLFxuXHRcdFx0XHQnU2F2ZSBhbGwgZGlydHkgZWRpdG9ycyBiZWZvcmUgcnVubmluZyBhIHRhc2suJ1xuXHRcdFx0KSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhbHdheXMnLCAnbmV2ZXInLCAncHJvbXB0J10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFzay5zYXZlQmVmb3JlUnVuLmFsd2F5cycsICdBbHdheXMgc2F2ZXMgYWxsIGVkaXRvcnMgYmVmb3JlIHJ1bm5pbmcuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFzay5zYXZlQmVmb3JlUnVuLm5ldmVyJywgJ05ldmVyIHNhdmVzIGVkaXRvcnMgYmVmb3JlIHJ1bm5pbmcuJyksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgndGFzay5TYXZlQmVmb3JlUnVuLnByb21wdCcsICdQcm9tcHRzIHdoZXRoZXIgdG8gc2F2ZSBlZGl0b3JzIGJlZm9yZSBydW5uaW5nLicpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdhbHdheXMnLFxuXHRcdH0sXG5cdFx0W1Rhc2tTZXR0aW5nSWQuVmVyYm9zZUxvZ2dpbmddOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd0YXNrLnZlcmJvc2VMb2dnaW5nJywgXCJFbmFibGUgdmVyYm9zZSBsb2dnaW5nIGZvciB0YXNrcy5cIiksXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVydW5UYXNrSWNvbiA9IHJlZ2lzdGVySWNvbigncmVydW4tdGFzaycsIENvZGljb24ucmVmcmVzaCwgbmxzLmxvY2FsaXplKCdyZXJ1blRhc2tJY29uJywgJ1ZpZXcgaWNvbiBvZiB0aGUgcmVydW4gdGFzay4nKSk7XG5leHBvcnQgY29uc3QgUmVydW5Gb3JBY3RpdmVUZXJtaW5hbENvbW1hbmRJZCA9ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlcnVuRm9yQWN0aXZlVGVybWluYWwnO1xucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSZXJ1bkZvckFjdGl2ZVRlcm1pbmFsQ29tbWFuZElkLFxuXHRcdFx0aWNvbjogcmVydW5UYXNrSWNvbixcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLnJlcnVuRm9yQWN0aXZlVGVybWluYWwnLCAnUmVydW4gVGFzaycpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBUQVNLX1RFUk1JTkFMX0FDVElWRSxcblx0XHRcdG1lbnU6IFt7IGlkOiBNZW51SWQuVGVybWluYWxJbnN0YW5jZUNvbnRleHQsIHdoZW46IFRBU0tfVEVSTUlOQUxfQUNUSVZFIH1dLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBUZXJtaW5hbENvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5Uixcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVJcblx0XHRcdFx0fSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlcm1pbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGVybWluYWxTZXJ2aWNlKTtcblx0XHRjb25zdCB0YXNrU3lzdGVtID0gYWNjZXNzb3IuZ2V0KElUYXNrU2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFuY2UgPSBhcmdzIGFzIElUZXJtaW5hbEluc3RhbmNlID8/IHRlcm1pbmFsU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoaW5zdGFuY2UpIHtcblx0XHRcdGF3YWl0IHRhc2tTeXN0ZW0ucmVydW4oaW5zdGFuY2UuaW5zdGFuY2VJZCk7XG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsY0FBYyxRQUFRLGlCQUFpQixlQUFlO0FBRS9ELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsa0JBQWtCLHdCQUF3QjtBQUVuRCxZQUFZLDhCQUE4QjtBQUcxQyxTQUFTLG9CQUFvQix5QkFBbUU7QUFFaEcsU0FBaUMsY0FBYyxpQkFBaUI7QUFFaEUsU0FBcUIsV0FBVyxlQUFlLGdCQUFnQixvQkFBb0Isc0JBQXNCLHFCQUFxQjtBQUM5SCxTQUFTLGNBQWMsd0JBQXdCLHFDQUFxQztBQUVwRixTQUFTLGNBQWMscUJBQThFLGdCQUFnQixzQ0FBc0M7QUFDM0osU0FBUyxtQkFBbUIsa0NBQWtDO0FBQzlELFNBQVMscUJBQXFCLHdCQUF3QjtBQUN0RCxTQUFTLFFBQVEsZUFBZTtBQUNoQyxPQUFPLG9CQUFvQjtBQUMzQixPQUFPLGtCQUFrQix1QkFBdUIsNkJBQTZCO0FBQzdFLFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGNBQWMsK0JBQXVEO0FBQzlFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQStCLGNBQWMsNkJBQTZCO0FBQzFFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRCO0FBQ3JD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
