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
import * as resources from "../../../../base/common/resources.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ITaskService } from "../common/taskService.js";
import { RunOnOptions, TaskRunSource, TaskSourceKind, TASKS_CATEGORY } from "../common/tasks.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Event } from "../../../../base/common/event.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const ALLOW_AUTOMATIC_TASKS = "task.allowAutomaticTasks";
let RunAutomaticTasks = class extends Disposable {
  constructor(_taskService, _configurationService, _workspaceTrustManagementService, _logService) {
    super();
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._workspaceTrustManagementService = _workspaceTrustManagementService;
    this._logService = _logService;
    this._hasRunTasks = false;
    if (this._taskService.isReconnected) {
      this._tryRunTasks();
    } else {
      this._register(Event.once(this._taskService.onDidReconnectToTasks)(async () => await this._tryRunTasks()));
    }
    this._register(this._workspaceTrustManagementService.onDidChangeTrust(async () => await this._tryRunTasks()));
  }
  async _tryRunTasks() {
    if (!this._workspaceTrustManagementService.isWorkspaceTrusted()) {
      return;
    }
    if (this._hasRunTasks || this._configurationService.getValue(ALLOW_AUTOMATIC_TASKS) === "off") {
      return;
    }
    this._hasRunTasks = true;
    this._logService.trace("RunAutomaticTasks: Trying to run tasks.");
    if (!this._taskService.hasTaskSystemInfo) {
      this._logService.trace("RunAutomaticTasks: Awaiting task system info.");
      await Event.toPromise(Event.once(this._taskService.onDidChangeTaskSystemInfo));
    }
    let workspaceTasks = await this._taskService.getWorkspaceTasks(TaskRunSource.FolderOpen);
    this._logService.trace(`RunAutomaticTasks: Found ${workspaceTasks.size} automatic tasks`);
    let autoTasks = this._findAutoTasks(this._taskService, workspaceTasks);
    this._logService.trace(`RunAutomaticTasks: taskNames=${JSON.stringify(autoTasks.taskNames)}`);
    if (autoTasks.taskNames.length === 0) {
      const updatedWithinTimeout = await Promise.race([
        new Promise((resolve) => {
          Event.toPromise(Event.once(this._taskService.onDidChangeTaskConfig)).then(() => resolve(true));
        }),
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            clearTimeout(timer);
            resolve(false);
          }, 1e4);
        })
      ]);
      if (!updatedWithinTimeout) {
        this._logService.trace(`RunAutomaticTasks: waited some extra time, but no update of tasks configuration`);
        return;
      }
      workspaceTasks = await this._taskService.getWorkspaceTasks(TaskRunSource.FolderOpen);
      autoTasks = this._findAutoTasks(this._taskService, workspaceTasks);
      this._logService.trace(`RunAutomaticTasks: updated taskNames=${JSON.stringify(autoTasks.taskNames)}`);
    }
    this._runWithPermission(this._taskService, this._configurationService, autoTasks.tasks, autoTasks.taskNames);
  }
  _runTasks(taskService, tasks) {
    tasks.forEach((task) => {
      if (task instanceof Promise) {
        task.then((promiseResult) => {
          if (promiseResult) {
            taskService.run(promiseResult);
          }
        });
      } else {
        taskService.run(task);
      }
    });
  }
  _getTaskSource(source) {
    const taskKind = TaskSourceKind.toConfigurationTarget(source.kind);
    switch (taskKind) {
      case ConfigurationTarget.WORKSPACE_FOLDER: {
        return resources.joinPath(source.config.workspaceFolder.uri, source.config.file);
      }
      case ConfigurationTarget.WORKSPACE: {
        return source.config.workspace?.configuration ?? void 0;
      }
    }
    return void 0;
  }
  _findAutoTasks(taskService, workspaceTaskResult) {
    const tasks = new Array();
    const taskNames = new Array();
    const locations = /* @__PURE__ */ new Map();
    if (workspaceTaskResult) {
      workspaceTaskResult.forEach((resultElement) => {
        if (resultElement.set) {
          resultElement.set.tasks.forEach((task) => {
            if (task.runOptions.runOn === RunOnOptions.folderOpen) {
              tasks.push(task);
              taskNames.push(task._label);
              const location = this._getTaskSource(task._source);
              if (location) {
                locations.set(location.fsPath, location);
              }
            }
          });
        }
        if (resultElement.configurations) {
          for (const configuredTask of Object.values(resultElement.configurations.byIdentifier)) {
            if (configuredTask.runOptions.runOn === RunOnOptions.folderOpen) {
              tasks.push(new Promise((resolve) => {
                taskService.getTask(resultElement.workspaceFolder, configuredTask._id, true).then((task) => resolve(task));
              }));
              if (configuredTask._label) {
                taskNames.push(configuredTask._label);
              } else {
                taskNames.push(configuredTask.configures.task);
              }
              const location = this._getTaskSource(configuredTask._source);
              if (location) {
                locations.set(location.fsPath, location);
              }
            }
          }
        }
      });
    }
    return { tasks, taskNames, locations };
  }
  async _runWithPermission(taskService, configurationService, tasks, taskNames) {
    if (taskNames.length === 0) {
      return;
    }
    if (configurationService.getValue(ALLOW_AUTOMATIC_TASKS) === "off") {
      return;
    }
    this._runTasks(taskService, tasks);
  }
};
RunAutomaticTasks = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, ILogService)
], RunAutomaticTasks);
const _ManageAutomaticTaskRunning = class _ManageAutomaticTaskRunning extends Action2 {
  constructor() {
    super({
      id: _ManageAutomaticTaskRunning.ID,
      title: _ManageAutomaticTaskRunning.LABEL,
      category: TASKS_CATEGORY
    });
  }
  async run(accessor) {
    const quickInputService = accessor.get(IQuickInputService);
    const configurationService = accessor.get(IConfigurationService);
    const allowItem = { label: nls.localize("workbench.action.tasks.allowAutomaticTasks", "Allow Automatic Tasks") };
    const disallowItem = { label: nls.localize("workbench.action.tasks.disallowAutomaticTasks", "Disallow Automatic Tasks") };
    const value = await quickInputService.pick([allowItem, disallowItem], { canPickMany: false });
    if (!value) {
      return;
    }
    configurationService.updateValue(ALLOW_AUTOMATIC_TASKS, value === allowItem ? "on" : "off", ConfigurationTarget.USER);
  }
};
_ManageAutomaticTaskRunning.ID = "workbench.action.tasks.manageAutomaticRunning";
_ManageAutomaticTaskRunning.LABEL = nls.localize("workbench.action.tasks.manageAutomaticRunning", "Manage Automatic Tasks");
let ManageAutomaticTaskRunning = _ManageAutomaticTaskRunning;
export {
  ManageAutomaticTaskRunning,
  RunAutomaticTasks
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL3J1bkF1dG9tYXRpY1Rhc2tzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElUYXNrU2VydmljZSwgSVdvcmtzcGFjZUZvbGRlclRhc2tSZXN1bHQgfSBmcm9tICcuLi9jb21tb24vdGFza1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgUnVuT25PcHRpb25zLCBUYXNrLCBUYXNrUnVuU291cmNlLCBUYXNrU291cmNlLCBUYXNrU291cmNlS2luZCwgVEFTS1NfQ0FURUdPUlksIFdvcmtzcGFjZUZpbGVUYXNrU291cmNlLCBJV29ya3NwYWNlVGFza1NvdXJjZSB9IGZyb20gJy4uL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuY29uc3QgQUxMT1dfQVVUT01BVElDX1RBU0tTID0gJ3Rhc2suYWxsb3dBdXRvbWF0aWNUYXNrcyc7XG5cbmV4cG9ydCBjbGFzcyBSdW5BdXRvbWF0aWNUYXNrcyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0cHJpdmF0ZSBfaGFzUnVuVGFza3M6IGJvb2xlYW4gPSBmYWxzZTtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElUYXNrU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90YXNrU2VydmljZTogSVRhc2tTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRpZiAodGhpcy5fdGFza1NlcnZpY2UuaXNSZWNvbm5lY3RlZCkge1xuXHRcdFx0dGhpcy5fdHJ5UnVuVGFza3MoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQub25jZSh0aGlzLl90YXNrU2VydmljZS5vbkRpZFJlY29ubmVjdFRvVGFza3MpKGFzeW5jICgpID0+IGF3YWl0IHRoaXMuX3RyeVJ1blRhc2tzKCkpKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KGFzeW5jICgpID0+IGF3YWl0IHRoaXMuX3RyeVJ1blRhc2tzKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3RyeVJ1blRhc2tzKCkge1xuXHRcdGlmICghdGhpcy5fd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5faGFzUnVuVGFza3MgfHwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQUxMT1dfQVVUT01BVElDX1RBU0tTKSA9PT0gJ29mZicpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5faGFzUnVuVGFza3MgPSB0cnVlO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1J1bkF1dG9tYXRpY1Rhc2tzOiBUcnlpbmcgdG8gcnVuIHRhc2tzLicpO1xuXHRcdC8vIFdhaXQgdW50aWwgd2UgaGF2ZSB0YXNrIHN5c3RlbSBpbmZvICh0aGUgZXh0ZW5zaW9uIGhvc3QgYW5kIHdvcmtzcGFjZSBmb2xkZXJzIGFyZSBhdmFpbGFibGUpLlxuXHRcdGlmICghdGhpcy5fdGFza1NlcnZpY2UuaGFzVGFza1N5c3RlbUluZm8pIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1J1bkF1dG9tYXRpY1Rhc2tzOiBBd2FpdGluZyB0YXNrIHN5c3RlbSBpbmZvLicpO1xuXHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKEV2ZW50Lm9uY2UodGhpcy5fdGFza1NlcnZpY2Uub25EaWRDaGFuZ2VUYXNrU3lzdGVtSW5mbykpO1xuXHRcdH1cblx0XHRsZXQgd29ya3NwYWNlVGFza3MgPSBhd2FpdCB0aGlzLl90YXNrU2VydmljZS5nZXRXb3Jrc3BhY2VUYXNrcyhUYXNrUnVuU291cmNlLkZvbGRlck9wZW4pO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFJ1bkF1dG9tYXRpY1Rhc2tzOiBGb3VuZCAke3dvcmtzcGFjZVRhc2tzLnNpemV9IGF1dG9tYXRpYyB0YXNrc2ApO1xuXG5cdFx0bGV0IGF1dG9UYXNrcyA9IHRoaXMuX2ZpbmRBdXRvVGFza3ModGhpcy5fdGFza1NlcnZpY2UsIHdvcmtzcGFjZVRhc2tzKTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBSdW5BdXRvbWF0aWNUYXNrczogdGFza05hbWVzPSR7SlNPTi5zdHJpbmdpZnkoYXV0b1Rhc2tzLnRhc2tOYW1lcyl9YCk7XG5cblx0XHQvLyBBcyBzZWVuIGluIHNvbWUgY2FzZXMgd2l0aCB0aGUgUmVtb3RlIFNTSCBleHRlbnNpb24sIHRoZSB0YXNrcyBjb25maWd1cmF0aW9uIGlzIGxvYWRlZCBhZnRlciB3ZSBoYXZlIGNvbWVcblx0XHQvLyB0byB0aGlzIHBvaW50LiBMZXQncyBnaXZlIGl0IHNvbWUgZXh0cmEgdGltZS5cblx0XHRpZiAoYXV0b1Rhc2tzLnRhc2tOYW1lcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGNvbnN0IHVwZGF0ZWRXaXRoaW5UaW1lb3V0ID0gYXdhaXQgUHJvbWlzZS5yYWNlKFtcblx0XHRcdFx0bmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcblx0XHRcdFx0XHRFdmVudC50b1Byb21pc2UoRXZlbnQub25jZSh0aGlzLl90YXNrU2VydmljZS5vbkRpZENoYW5nZVRhc2tDb25maWcpKS50aGVuKCgpID0+IHJlc29sdmUodHJ1ZSkpO1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0bmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcblx0XHRcdFx0XHRjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4geyBjbGVhclRpbWVvdXQodGltZXIpOyByZXNvbHZlKGZhbHNlKTsgfSwgMTAwMDApO1xuXHRcdFx0XHR9KV0pO1xuXG5cdFx0XHRpZiAoIXVwZGF0ZWRXaXRoaW5UaW1lb3V0KSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFJ1bkF1dG9tYXRpY1Rhc2tzOiB3YWl0ZWQgc29tZSBleHRyYSB0aW1lLCBidXQgbm8gdXBkYXRlIG9mIHRhc2tzIGNvbmZpZ3VyYXRpb25gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR3b3Jrc3BhY2VUYXNrcyA9IGF3YWl0IHRoaXMuX3Rhc2tTZXJ2aWNlLmdldFdvcmtzcGFjZVRhc2tzKFRhc2tSdW5Tb3VyY2UuRm9sZGVyT3Blbik7XG5cdFx0XHRhdXRvVGFza3MgPSB0aGlzLl9maW5kQXV0b1Rhc2tzKHRoaXMuX3Rhc2tTZXJ2aWNlLCB3b3Jrc3BhY2VUYXNrcyk7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBSdW5BdXRvbWF0aWNUYXNrczogdXBkYXRlZCB0YXNrTmFtZXM9JHtKU09OLnN0cmluZ2lmeShhdXRvVGFza3MudGFza05hbWVzKX1gKTtcblx0XHR9XG5cblx0XHR0aGlzLl9ydW5XaXRoUGVybWlzc2lvbih0aGlzLl90YXNrU2VydmljZSwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UsIGF1dG9UYXNrcy50YXNrcywgYXV0b1Rhc2tzLnRhc2tOYW1lcyk7XG5cdH1cblxuXHRwcml2YXRlIF9ydW5UYXNrcyh0YXNrU2VydmljZTogSVRhc2tTZXJ2aWNlLCB0YXNrczogQXJyYXk8VGFzayB8IFByb21pc2U8VGFzayB8IHVuZGVmaW5lZD4+KSB7XG5cdFx0dGFza3MuZm9yRWFjaCh0YXNrID0+IHtcblx0XHRcdGlmICh0YXNrIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuXHRcdFx0XHR0YXNrLnRoZW4ocHJvbWlzZVJlc3VsdCA9PiB7XG5cdFx0XHRcdFx0aWYgKHByb21pc2VSZXN1bHQpIHtcblx0XHRcdFx0XHRcdHRhc2tTZXJ2aWNlLnJ1bihwcm9taXNlUmVzdWx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGFza1NlcnZpY2UucnVuKHRhc2spO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VGFza1NvdXJjZShzb3VyY2U6IFRhc2tTb3VyY2UpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHRhc2tLaW5kID0gVGFza1NvdXJjZUtpbmQudG9Db25maWd1cmF0aW9uVGFyZ2V0KHNvdXJjZS5raW5kKTtcblx0XHRzd2l0Y2ggKHRhc2tLaW5kKSB7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjoge1xuXHRcdFx0XHRyZXR1cm4gcmVzb3VyY2VzLmpvaW5QYXRoKCg8SVdvcmtzcGFjZVRhc2tTb3VyY2U+c291cmNlKS5jb25maWcud29ya3NwYWNlRm9sZGVyIS51cmksICg8SVdvcmtzcGFjZVRhc2tTb3VyY2U+c291cmNlKS5jb25maWcuZmlsZSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFOiB7XG5cdFx0XHRcdHJldHVybiAoPFdvcmtzcGFjZUZpbGVUYXNrU291cmNlPnNvdXJjZSkuY29uZmlnLndvcmtzcGFjZT8uY29uZmlndXJhdGlvbiA/PyB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kQXV0b1Rhc2tzKHRhc2tTZXJ2aWNlOiBJVGFza1NlcnZpY2UsIHdvcmtzcGFjZVRhc2tSZXN1bHQ6IE1hcDxzdHJpbmcsIElXb3Jrc3BhY2VGb2xkZXJUYXNrUmVzdWx0Pik6IHsgdGFza3M6IEFycmF5PFRhc2sgfCBQcm9taXNlPFRhc2sgfCB1bmRlZmluZWQ+PjsgdGFza05hbWVzOiBBcnJheTxzdHJpbmc+OyBsb2NhdGlvbnM6IE1hcDxzdHJpbmcsIFVSST4gfSB7XG5cdFx0Y29uc3QgdGFza3MgPSBuZXcgQXJyYXk8VGFzayB8IFByb21pc2U8VGFzayB8IHVuZGVmaW5lZD4+KCk7XG5cdFx0Y29uc3QgdGFza05hbWVzID0gbmV3IEFycmF5PHN0cmluZz4oKTtcblx0XHRjb25zdCBsb2NhdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgVVJJPigpO1xuXG5cdFx0aWYgKHdvcmtzcGFjZVRhc2tSZXN1bHQpIHtcblx0XHRcdHdvcmtzcGFjZVRhc2tSZXN1bHQuZm9yRWFjaChyZXN1bHRFbGVtZW50ID0+IHtcblx0XHRcdFx0aWYgKHJlc3VsdEVsZW1lbnQuc2V0KSB7XG5cdFx0XHRcdFx0cmVzdWx0RWxlbWVudC5zZXQudGFza3MuZm9yRWFjaCh0YXNrID0+IHtcblx0XHRcdFx0XHRcdGlmICh0YXNrLnJ1bk9wdGlvbnMucnVuT24gPT09IFJ1bk9uT3B0aW9ucy5mb2xkZXJPcGVuKSB7XG5cdFx0XHRcdFx0XHRcdHRhc2tzLnB1c2godGFzayk7XG5cdFx0XHRcdFx0XHRcdHRhc2tOYW1lcy5wdXNoKHRhc2suX2xhYmVsKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLl9nZXRUYXNrU291cmNlKHRhc2suX3NvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChsb2NhdGlvbikge1xuXHRcdFx0XHRcdFx0XHRcdGxvY2F0aW9ucy5zZXQobG9jYXRpb24uZnNQYXRoLCBsb2NhdGlvbik7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocmVzdWx0RWxlbWVudC5jb25maWd1cmF0aW9ucykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgY29uZmlndXJlZFRhc2sgb2YgT2JqZWN0LnZhbHVlcyhyZXN1bHRFbGVtZW50LmNvbmZpZ3VyYXRpb25zLmJ5SWRlbnRpZmllcikpIHtcblx0XHRcdFx0XHRcdGlmIChjb25maWd1cmVkVGFzay5ydW5PcHRpb25zLnJ1bk9uID09PSBSdW5Pbk9wdGlvbnMuZm9sZGVyT3Blbikge1xuXHRcdFx0XHRcdFx0XHR0YXNrcy5wdXNoKG5ldyBQcm9taXNlPFRhc2sgfCB1bmRlZmluZWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdHRhc2tTZXJ2aWNlLmdldFRhc2socmVzdWx0RWxlbWVudC53b3Jrc3BhY2VGb2xkZXIsIGNvbmZpZ3VyZWRUYXNrLl9pZCwgdHJ1ZSkudGhlbih0YXNrID0+IHJlc29sdmUodGFzaykpO1xuXHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjb25maWd1cmVkVGFzay5fbGFiZWwpIHtcblx0XHRcdFx0XHRcdFx0XHR0YXNrTmFtZXMucHVzaChjb25maWd1cmVkVGFzay5fbGFiZWwpO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHRhc2tOYW1lcy5wdXNoKGNvbmZpZ3VyZWRUYXNrLmNvbmZpZ3VyZXMudGFzayk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLl9nZXRUYXNrU291cmNlKGNvbmZpZ3VyZWRUYXNrLl9zb3VyY2UpO1xuXHRcdFx0XHRcdFx0XHRpZiAobG9jYXRpb24pIHtcblx0XHRcdFx0XHRcdFx0XHRsb2NhdGlvbnMuc2V0KGxvY2F0aW9uLmZzUGF0aCwgbG9jYXRpb24pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHsgdGFza3MsIHRhc2tOYW1lcywgbG9jYXRpb25zIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9ydW5XaXRoUGVybWlzc2lvbih0YXNrU2VydmljZTogSVRhc2tTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0YXNrczogKFRhc2sgfCBQcm9taXNlPFRhc2sgfCB1bmRlZmluZWQ+KVtdLCB0YXNrTmFtZXM6IHN0cmluZ1tdKSB7XG5cdFx0aWYgKHRhc2tOYW1lcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFMTE9XX0FVVE9NQVRJQ19UQVNLUykgPT09ICdvZmYnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3J1blRhc2tzKHRhc2tTZXJ2aWNlLCB0YXNrcyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1hbmFnZUF1dG9tYXRpY1Rhc2tSdW5uaW5nIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLm1hbmFnZUF1dG9tYXRpY1J1bm5pbmcnO1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLm1hbmFnZUF1dG9tYXRpY1J1bm5pbmcnLCBcIk1hbmFnZSBBdXRvbWF0aWMgVGFza3NcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE1hbmFnZUF1dG9tYXRpY1Rhc2tSdW5uaW5nLklELFxuXHRcdFx0dGl0bGU6IE1hbmFnZUF1dG9tYXRpY1Rhc2tSdW5uaW5nLkxBQkVMLFxuXHRcdFx0Y2F0ZWdvcnk6IFRBU0tTX0NBVEVHT1JZXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgYWxsb3dJdGVtOiBJUXVpY2tQaWNrSXRlbSA9IHsgbGFiZWw6IG5scy5sb2NhbGl6ZSgnd29ya2JlbmNoLmFjdGlvbi50YXNrcy5hbGxvd0F1dG9tYXRpY1Rhc2tzJywgXCJBbGxvdyBBdXRvbWF0aWMgVGFza3NcIikgfTtcblx0XHRjb25zdCBkaXNhbGxvd0l0ZW06IElRdWlja1BpY2tJdGVtID0geyBsYWJlbDogbmxzLmxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRhc2tzLmRpc2FsbG93QXV0b21hdGljVGFza3MnLCBcIkRpc2FsbG93IEF1dG9tYXRpYyBUYXNrc1wiKSB9O1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhbYWxsb3dJdGVtLCBkaXNhbGxvd0l0ZW1dLCB7IGNhblBpY2tNYW55OiBmYWxzZSB9KTtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKEFMTE9XX0FVVE9NQVRJQ19UQVNLUywgdmFsdWUgPT09IGFsbG93SXRlbSA/ICdvbicgOiAnb2ZmJywgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxlQUFlO0FBQzNCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsb0JBQWdEO0FBQ3pELFNBQVMsY0FBb0IsZUFBMkIsZ0JBQWdCLHNCQUFxRTtBQUM3SSxTQUF5QiwwQkFBMEI7QUFDbkQsU0FBUyxlQUFlO0FBRXhCLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMscUJBQXFCLDZCQUE2QjtBQUUzRCxTQUFTLGFBQWE7QUFDdEIsU0FBUyxtQkFBbUI7QUFFNUIsTUFBTSx3QkFBd0I7QUFFdkIsSUFBTSxvQkFBTixjQUFnQyxXQUE2QztBQUFBLEVBRW5GLFlBQ2dDLGNBQ1MsdUJBQ1csa0NBQ3JCLGFBQTBCO0FBQ3hELFVBQU07QUFKeUI7QUFDUztBQUNXO0FBQ3JCO0FBTC9CLFNBQVEsZUFBd0I7QUFPL0IsUUFBSSxLQUFLLGFBQWEsZUFBZTtBQUNwQyxXQUFLLGFBQWE7QUFBQSxJQUNuQixPQUFPO0FBQ04sV0FBSyxVQUFVLE1BQU0sS0FBSyxLQUFLLGFBQWEscUJBQXFCLEVBQUUsWUFBWSxNQUFNLEtBQUssYUFBYSxDQUFDLENBQUM7QUFBQSxJQUMxRztBQUNBLFNBQUssVUFBVSxLQUFLLGlDQUFpQyxpQkFBaUIsWUFBWSxNQUFNLEtBQUssYUFBYSxDQUFDLENBQUM7QUFBQSxFQUM3RztBQUFBLEVBRUEsTUFBYyxlQUFlO0FBQzVCLFFBQUksQ0FBQyxLQUFLLGlDQUFpQyxtQkFBbUIsR0FBRztBQUNoRTtBQUFBLElBQ0Q7QUFDQSxRQUFJLEtBQUssZ0JBQWdCLEtBQUss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
