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
import { disposableTimeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { createErrorWithActions } from "../../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import severity from "../../../../base/common/severity.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL } from "./debugCommands.js";
import { Markers } from "../../markers/common/markers.js";
import { ConfiguringTask, CustomTask, TaskEventKind } from "../../tasks/common/tasks.js";
import { ITaskService } from "../../tasks/common/taskService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
const onceFilter = (event, filter) => Event.once(Event.filter(event, filter));
var TaskRunResult = /* @__PURE__ */ ((TaskRunResult2) => {
  TaskRunResult2[TaskRunResult2["Failure"] = 0] = "Failure";
  TaskRunResult2[TaskRunResult2["Success"] = 1] = "Success";
  return TaskRunResult2;
})(TaskRunResult || {});
const DEBUG_TASK_ERROR_CHOICE_KEY = "debug.taskerrorchoice";
const ABORT_LABEL = nls.localize("abort", "Abort");
const DEBUG_ANYWAY_LABEL = nls.localize({ key: "debugAnyway", comment: ["&& denotes a mnemonic"] }, "&&Debug Anyway");
const DEBUG_ANYWAY_LABEL_NO_MEMO = nls.localize("debugAnywayNoMemo", "Debug Anyway");
let DebugTaskRunner = class {
  constructor(taskService, markerService, configurationService, viewsService, dialogService, storageService, commandService, progressService) {
    this.taskService = taskService;
    this.markerService = markerService;
    this.configurationService = configurationService;
    this.viewsService = viewsService;
    this.dialogService = dialogService;
    this.storageService = storageService;
    this.commandService = commandService;
    this.progressService = progressService;
    this.globalCancellation = new CancellationTokenSource();
  }
  cancel() {
    this.globalCancellation.dispose(true);
    this.globalCancellation = new CancellationTokenSource();
  }
  dispose() {
    this.globalCancellation.dispose(true);
  }
  async runTaskAndCheckErrors(root, taskId) {
    try {
      const taskSummary = await this.runTask(root, taskId, this.globalCancellation.token);
      if (taskSummary && (taskSummary.exitCode === void 0 || taskSummary.cancelled)) {
        return 0 /* Failure */;
      }
      const errorCount = taskId ? this.markerService.read({ severities: MarkerSeverity.Error, take: 2 }).length : 0;
      const successExitCode = taskSummary && taskSummary.exitCode === 0;
      const failureExitCode = taskSummary && taskSummary.exitCode !== 0;
      const onTaskErrors = this.configurationService.getValue("debug").onTaskErrors;
      if (successExitCode || onTaskErrors === "debugAnyway" || errorCount === 0 && !failureExitCode) {
        return 1 /* Success */;
      }
      if (onTaskErrors === "showErrors") {
        await this.viewsService.openView(Markers.MARKERS_VIEW_ID, true);
        return Promise.resolve(0 /* Failure */);
      }
      if (onTaskErrors === "abort") {
        return Promise.resolve(0 /* Failure */);
      }
      const taskLabel = typeof taskId === "string" ? taskId : taskId ? taskId.name : "";
      const message = errorCount > 1 ? nls.localize("preLaunchTaskErrors", "Errors exist after running preLaunchTask '{0}'.", taskLabel) : errorCount === 1 ? nls.localize("preLaunchTaskError", "Error exists after running preLaunchTask '{0}'.", taskLabel) : taskSummary && typeof taskSummary.exitCode === "number" ? nls.localize("preLaunchTaskExitCode", "The preLaunchTask '{0}' terminated with exit code {1}.", taskLabel, taskSummary.exitCode) : nls.localize("preLaunchTaskTerminated", "The preLaunchTask '{0}' terminated.", taskLabel);
      let DebugChoice;
      ((DebugChoice2) => {
        DebugChoice2[DebugChoice2["DebugAnyway"] = 1] = "DebugAnyway";
        DebugChoice2[DebugChoice2["ShowErrors"] = 2] = "ShowErrors";
        DebugChoice2[DebugChoice2["Cancel"] = 0] = "Cancel";
      })(DebugChoice || (DebugChoice = {}));
      const { result, checkboxChecked } = await this.dialogService.prompt({
        type: severity.Warning,
        message,
        buttons: [
          {
            label: DEBUG_ANYWAY_LABEL,
            run: () => 1 /* DebugAnyway */
          },
          {
            label: nls.localize({ key: "showErrors", comment: ["&& denotes a mnemonic"] }, "&&Show Errors"),
            run: () => 2 /* ShowErrors */
          }
        ],
        cancelButton: {
          label: ABORT_LABEL,
          run: () => 0 /* Cancel */
        },
        checkbox: {
          label: nls.localize("remember", "Remember my choice in user settings")
        }
      });
      const debugAnyway = result === 1 /* DebugAnyway */;
      const abort = result === 0 /* Cancel */;
      if (checkboxChecked) {
        this.configurationService.updateValue("debug.onTaskErrors", result === 1 /* DebugAnyway */ ? "debugAnyway" : abort ? "abort" : "showErrors");
      }
      if (abort) {
        return Promise.resolve(0 /* Failure */);
      }
      if (debugAnyway) {
        return 1 /* Success */;
      }
      await this.viewsService.openView(Markers.MARKERS_VIEW_ID, true);
      return Promise.resolve(0 /* Failure */);
    } catch (err) {
      const taskConfigureAction = this.taskService.configureAction();
      const choiceMap = JSON.parse(this.storageService.get(DEBUG_TASK_ERROR_CHOICE_KEY, StorageScope.WORKSPACE, "{}"));
      let choice = -1;
      let DebugChoice;
      ((DebugChoice2) => {
        DebugChoice2[DebugChoice2["DebugAnyway"] = 0] = "DebugAnyway";
        DebugChoice2[DebugChoice2["ConfigureTask"] = 1] = "ConfigureTask";
        DebugChoice2[DebugChoice2["Cancel"] = 2] = "Cancel";
      })(DebugChoice || (DebugChoice = {}));
      if (choiceMap[err.message] !== void 0) {
        choice = choiceMap[err.message];
      } else {
        const { result, checkboxChecked } = await this.dialogService.prompt({
          type: severity.Error,
          message: err.message,
          buttons: [
            {
              label: nls.localize({ key: "debugAnyway", comment: ["&& denotes a mnemonic"] }, "&&Debug Anyway"),
              run: () => 0 /* DebugAnyway */
            },
            {
              label: taskConfigureAction.label,
              run: () => 1 /* ConfigureTask */
            }
          ],
          cancelButton: {
            run: () => 2 /* Cancel */
          },
          checkbox: {
            label: nls.localize("rememberTask", "Remember my choice for this task")
          }
        });
        choice = result;
        if (checkboxChecked) {
          choiceMap[err.message] = choice;
          this.storageService.store(DEBUG_TASK_ERROR_CHOICE_KEY, JSON.stringify(choiceMap), StorageScope.WORKSPACE, StorageTarget.MACHINE);
        }
      }
      if (choice === 1 /* ConfigureTask */) {
        await taskConfigureAction.run();
      }
      return choice === 0 /* DebugAnyway */ ? 1 /* Success */ : 0 /* Failure */;
    }
  }
  async runTask(root, taskId, token = this.globalCancellation.token) {
    if (!taskId) {
      return Promise.resolve(null);
    }
    if (!root) {
      return Promise.reject(new Error(nls.localize("invalidTaskReference", "Task '{0}' can not be referenced from a launch configuration that is in a different workspace folder.", typeof taskId === "string" ? taskId : taskId.type)));
    }
    const task = await this.taskService.getTask(root, taskId);
    if (!task) {
      const errorMessage = typeof taskId === "string" ? nls.localize("DebugTaskNotFoundWithTaskId", "Could not find the task '{0}'.", taskId) : nls.localize("DebugTaskNotFound", "Could not find the specified task.");
      return Promise.reject(createErrorWithActions(errorMessage, [new Action(DEBUG_CONFIGURE_COMMAND_ID, DEBUG_CONFIGURE_LABEL, void 0, true, () => this.commandService.executeCommand(DEBUG_CONFIGURE_COMMAND_ID))]));
    }
    let taskStarted = false;
    const store = new DisposableStore();
    const getTaskKey = (t) => t.getKey() ?? t.getMapKey();
    const taskKey = getTaskKey(task);
    const inactivePromise = new Promise((resolve) => store.add(
      onceFilter(this.taskService.onDidStateChange, (e) => {
        return (e.kind === TaskEventKind.Inactive || e.kind === TaskEventKind.ProcessEnded && e.exitCode === void 0) && getTaskKey(e.__task) === taskKey;
      })((e) => {
        taskStarted = true;
        resolve(e.kind === TaskEventKind.ProcessEnded ? { exitCode: e.exitCode } : null);
      })
    ));
    store.add(
      onceFilter(
        this.taskService.onDidStateChange,
        (e) => (e.kind === TaskEventKind.Active || e.kind === TaskEventKind.DependsOnStarted) && getTaskKey(e.__task) === taskKey
      )(() => {
        taskStarted = true;
      })
    );
    const didAcquireInput = store.add(new Emitter());
    store.add(onceFilter(
      this.taskService.onDidStateChange,
      (e) => e.kind === TaskEventKind.AcquiredInput && getTaskKey(e.__task) === taskKey
    )(() => didAcquireInput.fire()));
    const taskDonePromise = this.taskService.getActiveTasks().then(async (tasks) => {
      if (tasks.find((t) => getTaskKey(t) === taskKey)) {
        didAcquireInput.fire();
        const busyTasks = await this.taskService.getBusyTasks();
        if (busyTasks.find((t) => getTaskKey(t) === taskKey)) {
          taskStarted = true;
          return inactivePromise;
        }
        return Promise.resolve(null);
      }
      const taskPromise = this.taskService.run(task);
      if (task.configurationProperties.isBackground) {
        return inactivePromise;
      }
      return taskPromise.then((x) => x ?? null);
    });
    const result = new Promise((resolve, reject) => {
      taskDonePromise.then((result2) => {
        taskStarted = true;
        resolve(result2);
      }, (error) => reject(error));
      store.add(token.onCancellationRequested(() => {
        resolve({ exitCode: void 0, cancelled: true });
        this.taskService.terminate(task).catch(() => {
        });
      }));
      store.add(didAcquireInput.event(() => {
        const waitTime = task.configurationProperties.isBackground ? 5e3 : 1e4;
        store.add(disposableTimeout(() => {
          if (!taskStarted) {
            const errorMessage = nls.localize("taskNotTracked", "The task '{0}' has not exited and doesn't have a 'problemMatcher' defined. Make sure to define a problem matcher for watch tasks.", typeof taskId === "string" ? taskId : JSON.stringify(taskId));
            reject({ severity: severity.Error, message: errorMessage });
          }
        }, waitTime));
        const hideSlowPreLaunchWarning = this.configurationService.getValue("debug").hideSlowPreLaunchWarning;
        if (!hideSlowPreLaunchWarning) {
          store.add(disposableTimeout(() => {
            const message = nls.localize("runningTask", "Waiting for preLaunchTask '{0}'...", task.configurationProperties.name);
            const buttons = [DEBUG_ANYWAY_LABEL_NO_MEMO, ABORT_LABEL];
            const canConfigure = task instanceof CustomTask || task instanceof ConfiguringTask;
            if (canConfigure) {
              buttons.splice(1, 0, nls.localize("configureTask", "Configure Task"));
            }
            this.progressService.withProgress(
              { location: ProgressLocation.Notification, title: message, buttons },
              () => result.catch(() => {
              }),
              (choice) => {
                if (choice === void 0) {
                } else if (choice === 0) {
                  resolve({ exitCode: 0 });
                } else {
                  resolve({ exitCode: void 0, cancelled: true });
                  this.taskService.terminate(task).catch(() => {
                  });
                  if (canConfigure && choice === 1) {
                    this.taskService.openConfig(task);
                  }
                }
              }
            );
          }, 1e4));
        }
      }));
    });
    return result.finally(() => store.dispose());
  }
};
DebugTaskRunner = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IViewsService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IProgressService)
], DebugTaskRunner);
export {
  DebugTaskRunner,
  TaskRunResult
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnVGFza1J1bm5lci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVFcnJvcldpdGhBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgc2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlLCBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgREVCVUdfQ09ORklHVVJFX0NPTU1BTkRfSUQsIERFQlVHX0NPTkZJR1VSRV9MQUJFTCB9IGZyb20gJy4vZGVidWdDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJRGVidWdDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IE1hcmtlcnMgfSBmcm9tICcuLi8uLi9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyaW5nVGFzaywgQ3VzdG9tVGFzaywgSVRhc2tFdmVudCwgSVRhc2tJZGVudGlmaWVyLCBUYXNrLCBUYXNrRXZlbnRLaW5kIH0gZnJvbSAnLi4vLi4vdGFza3MvY29tbW9uL3Rhc2tzLmpzJztcbmltcG9ydCB7IElUYXNrU2VydmljZSwgSVRhc2tTdW1tYXJ5IH0gZnJvbSAnLi4vLi4vdGFza3MvY29tbW9uL3Rhc2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcblxuY29uc3Qgb25jZUZpbHRlciA9IChldmVudDogRXZlbnQ8SVRhc2tFdmVudD4sIGZpbHRlcjogKGU6IElUYXNrRXZlbnQpID0+IGJvb2xlYW4pID0+IEV2ZW50Lm9uY2UoRXZlbnQuZmlsdGVyKGV2ZW50LCBmaWx0ZXIpKTtcblxuZXhwb3J0IGNvbnN0IGVudW0gVGFza1J1blJlc3VsdCB7XG5cdEZhaWx1cmUsXG5cdFN1Y2Nlc3Ncbn1cblxuY29uc3QgREVCVUdfVEFTS19FUlJPUl9DSE9JQ0VfS0VZID0gJ2RlYnVnLnRhc2tlcnJvcmNob2ljZSc7XG5jb25zdCBBQk9SVF9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnYWJvcnQnLCBcIkFib3J0XCIpO1xuY29uc3QgREVCVUdfQU5ZV0FZX0xBQkVMID0gbmxzLmxvY2FsaXplKHsga2V5OiAnZGVidWdBbnl3YXknLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEZWJ1ZyBBbnl3YXlcIik7XG5jb25zdCBERUJVR19BTllXQVlfTEFCRUxfTk9fTUVNTyA9IG5scy5sb2NhbGl6ZSgnZGVidWdBbnl3YXlOb01lbW8nLCBcIkRlYnVnIEFueXdheVwiKTtcblxuaW50ZXJmYWNlIElSdW5uZXJUYXNrU3VtbWFyeSBleHRlbmRzIElUYXNrU3VtbWFyeSB7XG5cdGNhbmNlbGxlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBEZWJ1Z1Rhc2tSdW5uZXIgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBnbG9iYWxDYW5jZWxsYXRpb24gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRhc2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGFza1NlcnZpY2U6IElUYXNrU2VydmljZSxcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtYXJrZXJTZXJ2aWNlOiBJTWFya2VyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0KSB7IH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5nbG9iYWxDYW5jZWxsYXRpb24uZGlzcG9zZSh0cnVlKTtcblx0XHR0aGlzLmdsb2JhbENhbmNlbGxhdGlvbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5nbG9iYWxDYW5jZWxsYXRpb24uZGlzcG9zZSh0cnVlKTtcblx0fVxuXG5cdGFzeW5jIHJ1blRhc2tBbmRDaGVja0Vycm9ycyhcblx0XHRyb290OiBJV29ya3NwYWNlRm9sZGVyIHwgSVdvcmtzcGFjZSB8IHVuZGVmaW5lZCxcblx0XHR0YXNrSWQ6IHN0cmluZyB8IElUYXNrSWRlbnRpZmllciB8IHVuZGVmaW5lZCxcblx0KTogUHJvbWlzZTxUYXNrUnVuUmVzdWx0PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHRhc2tTdW1tYXJ5ID0gYXdhaXQgdGhpcy5ydW5UYXNrKHJvb3QsIHRhc2tJZCwgdGhpcy5nbG9iYWxDYW5jZWxsYXRpb24udG9rZW4pO1xuXHRcdFx0aWYgKHRhc2tTdW1tYXJ5ICYmICh0YXNrU3VtbWFyeS5leGl0Q29kZSA9PT0gdW5kZWZpbmVkIHx8IHRhc2tTdW1tYXJ5LmNhbmNlbGxlZCkpIHtcblx0XHRcdFx0Ly8gVXNlciBjYW5jZWxlZCwgZWl0aGVyIGRlYnVnZ2luZywgb3IgdGhlIHByZWxhdW5jaCB0YXNrXG5cdFx0XHRcdHJldHVybiBUYXNrUnVuUmVzdWx0LkZhaWx1cmU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVycm9yQ291bnQgPSB0YXNrSWQgPyB0aGlzLm1hcmtlclNlcnZpY2UucmVhZCh7IHNldmVyaXRpZXM6IE1hcmtlclNldmVyaXR5LkVycm9yLCB0YWtlOiAyIH0pLmxlbmd0aCA6IDA7XG5cdFx0XHRjb25zdCBzdWNjZXNzRXhpdENvZGUgPSB0YXNrU3VtbWFyeSAmJiB0YXNrU3VtbWFyeS5leGl0Q29kZSA9PT0gMDtcblx0XHRcdGNvbnN0IGZhaWx1cmVFeGl0Q29kZSA9IHRhc2tTdW1tYXJ5ICYmIHRhc2tTdW1tYXJ5LmV4aXRDb2RlICE9PSAwO1xuXHRcdFx0Y29uc3Qgb25UYXNrRXJyb3JzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5vblRhc2tFcnJvcnM7XG5cdFx0XHRpZiAoc3VjY2Vzc0V4aXRDb2RlIHx8IG9uVGFza0Vycm9ycyA9PT0gJ2RlYnVnQW55d2F5JyB8fCAoZXJyb3JDb3VudCA9PT0gMCAmJiAhZmFpbHVyZUV4aXRDb2RlKSkge1xuXHRcdFx0XHRyZXR1cm4gVGFza1J1blJlc3VsdC5TdWNjZXNzO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9uVGFza0Vycm9ycyA9PT0gJ3Nob3dFcnJvcnMnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3KE1hcmtlcnMuTUFSS0VSU19WSUVXX0lELCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShUYXNrUnVuUmVzdWx0LkZhaWx1cmUpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9uVGFza0Vycm9ycyA9PT0gJ2Fib3J0Jykge1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFRhc2tSdW5SZXN1bHQuRmFpbHVyZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRhc2tMYWJlbCA9IHR5cGVvZiB0YXNrSWQgPT09ICdzdHJpbmcnID8gdGFza0lkIDogdGFza0lkID8gdGFza0lkLm5hbWUgOiAnJztcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBlcnJvckNvdW50ID4gMVxuXHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgncHJlTGF1bmNoVGFza0Vycm9ycycsIFwiRXJyb3JzIGV4aXN0IGFmdGVyIHJ1bm5pbmcgcHJlTGF1bmNoVGFzayAnezB9Jy5cIiwgdGFza0xhYmVsKVxuXHRcdFx0XHQ6IGVycm9yQ291bnQgPT09IDFcblx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgncHJlTGF1bmNoVGFza0Vycm9yJywgXCJFcnJvciBleGlzdHMgYWZ0ZXIgcnVubmluZyBwcmVMYXVuY2hUYXNrICd7MH0nLlwiLCB0YXNrTGFiZWwpXG5cdFx0XHRcdFx0OiB0YXNrU3VtbWFyeSAmJiB0eXBlb2YgdGFza1N1bW1hcnkuZXhpdENvZGUgPT09ICdudW1iZXInXG5cdFx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgncHJlTGF1bmNoVGFza0V4aXRDb2RlJywgXCJUaGUgcHJlTGF1bmNoVGFzayAnezB9JyB0ZXJtaW5hdGVkIHdpdGggZXhpdCBjb2RlIHsxfS5cIiwgdGFza0xhYmVsLCB0YXNrU3VtbWFyeS5leGl0Q29kZSlcblx0XHRcdFx0XHRcdDogbmxzLmxvY2FsaXplKCdwcmVMYXVuY2hUYXNrVGVybWluYXRlZCcsIFwiVGhlIHByZUxhdW5jaFRhc2sgJ3swfScgdGVybWluYXRlZC5cIiwgdGFza0xhYmVsKTtcblxuXHRcdFx0ZW51bSBEZWJ1Z0Nob2ljZSB7XG5cdFx0XHRcdERlYnVnQW55d2F5ID0gMSxcblx0XHRcdFx0U2hvd0Vycm9ycyA9IDIsXG5cdFx0XHRcdENhbmNlbCA9IDBcblx0XHRcdH1cblx0XHRcdGNvbnN0IHsgcmVzdWx0LCBjaGVja2JveENoZWNrZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQ8RGVidWdDaG9pY2U+KHtcblx0XHRcdFx0dHlwZTogc2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiBERUJVR19BTllXQVlfTEFCRUwsXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IERlYnVnQ2hvaWNlLkRlYnVnQW55d2F5XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKHsga2V5OiAnc2hvd0Vycm9ycycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlNob3cgRXJyb3JzXCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBEZWJ1Z0Nob2ljZS5TaG93RXJyb3JzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0XHRsYWJlbDogQUJPUlRfTEFCRUwsXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBEZWJ1Z0Nob2ljZS5DYW5jZWxcblx0XHRcdFx0fSxcblx0XHRcdFx0Y2hlY2tib3g6IHtcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZW1lbWJlcicsIFwiUmVtZW1iZXIgbXkgY2hvaWNlIGluIHVzZXIgc2V0dGluZ3NcIiksXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cblx0XHRcdGNvbnN0IGRlYnVnQW55d2F5ID0gcmVzdWx0ID09PSBEZWJ1Z0Nob2ljZS5EZWJ1Z0FueXdheTtcblx0XHRcdGNvbnN0IGFib3J0ID0gcmVzdWx0ID09PSBEZWJ1Z0Nob2ljZS5DYW5jZWw7XG5cdFx0XHRpZiAoY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2RlYnVnLm9uVGFza0Vycm9ycycsIHJlc3VsdCA9PT0gRGVidWdDaG9pY2UuRGVidWdBbnl3YXkgPyAnZGVidWdBbnl3YXknIDogYWJvcnQgPyAnYWJvcnQnIDogJ3Nob3dFcnJvcnMnKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFib3J0KSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoVGFza1J1blJlc3VsdC5GYWlsdXJlKTtcblx0XHRcdH1cblx0XHRcdGlmIChkZWJ1Z0FueXdheSkge1xuXHRcdFx0XHRyZXR1cm4gVGFza1J1blJlc3VsdC5TdWNjZXNzO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLnZpZXdzU2VydmljZS5vcGVuVmlldyhNYXJrZXJzLk1BUktFUlNfVklFV19JRCwgdHJ1ZSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFRhc2tSdW5SZXN1bHQuRmFpbHVyZSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zdCB0YXNrQ29uZmlndXJlQWN0aW9uID0gdGhpcy50YXNrU2VydmljZS5jb25maWd1cmVBY3Rpb24oKTtcblx0XHRcdGNvbnN0IGNob2ljZU1hcDogeyBba2V5OiBzdHJpbmddOiBudW1iZXIgfSA9IEpTT04ucGFyc2UodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoREVCVUdfVEFTS19FUlJPUl9DSE9JQ0VfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCAne30nKSk7XG5cblx0XHRcdGxldCBjaG9pY2UgPSAtMTtcblx0XHRcdGVudW0gRGVidWdDaG9pY2Uge1xuXHRcdFx0XHREZWJ1Z0FueXdheSA9IDAsXG5cdFx0XHRcdENvbmZpZ3VyZVRhc2sgPSAxLFxuXHRcdFx0XHRDYW5jZWwgPSAyXG5cdFx0XHR9XG5cdFx0XHRpZiAoY2hvaWNlTWFwW2Vyci5tZXNzYWdlXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNob2ljZSA9IGNob2ljZU1hcFtlcnIubWVzc2FnZV07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB7IHJlc3VsdCwgY2hlY2tib3hDaGVja2VkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0PERlYnVnQ2hvaWNlPih7XG5cdFx0XHRcdFx0dHlwZTogc2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0bWVzc2FnZTogZXJyLm1lc3NhZ2UsXG5cdFx0XHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKHsga2V5OiAnZGVidWdBbnl3YXknLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEZWJ1ZyBBbnl3YXlcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gRGVidWdDaG9pY2UuRGVidWdBbnl3YXlcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiB0YXNrQ29uZmlndXJlQWN0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdFx0XHRydW46ICgpID0+IERlYnVnQ2hvaWNlLkNvbmZpZ3VyZVRhc2tcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjoge1xuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBEZWJ1Z0Nob2ljZS5DYW5jZWxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNoZWNrYm94OiB7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZW1lbWJlclRhc2snLCBcIlJlbWVtYmVyIG15IGNob2ljZSBmb3IgdGhpcyB0YXNrXCIpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y2hvaWNlID0gcmVzdWx0O1xuXHRcdFx0XHRpZiAoY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdFx0Y2hvaWNlTWFwW2Vyci5tZXNzYWdlXSA9IGNob2ljZTtcblx0XHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKERFQlVHX1RBU0tfRVJST1JfQ0hPSUNFX0tFWSwgSlNPTi5zdHJpbmdpZnkoY2hvaWNlTWFwKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2hvaWNlID09PSBEZWJ1Z0Nob2ljZS5Db25maWd1cmVUYXNrKSB7XG5cdFx0XHRcdGF3YWl0IHRhc2tDb25maWd1cmVBY3Rpb24ucnVuKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBjaG9pY2UgPT09IERlYnVnQ2hvaWNlLkRlYnVnQW55d2F5ID8gVGFza1J1blJlc3VsdC5TdWNjZXNzIDogVGFza1J1blJlc3VsdC5GYWlsdXJlO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJ1blRhc2socm9vdDogSVdvcmtzcGFjZSB8IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIHRhc2tJZDogc3RyaW5nIHwgSVRhc2tJZGVudGlmaWVyIHwgdW5kZWZpbmVkLCB0b2tlbiA9IHRoaXMuZ2xvYmFsQ2FuY2VsbGF0aW9uLnRva2VuKTogUHJvbWlzZTxJUnVubmVyVGFza1N1bW1hcnkgfCBudWxsPiB7XG5cdFx0aWYgKCF0YXNrSWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0fVxuXHRcdGlmICghcm9vdCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWRUYXNrUmVmZXJlbmNlJywgXCJUYXNrICd7MH0nIGNhbiBub3QgYmUgcmVmZXJlbmNlZCBmcm9tIGEgbGF1bmNoIGNvbmZpZ3VyYXRpb24gdGhhdCBpcyBpbiBhIGRpZmZlcmVudCB3b3Jrc3BhY2UgZm9sZGVyLlwiLCB0eXBlb2YgdGFza0lkID09PSAnc3RyaW5nJyA/IHRhc2tJZCA6IHRhc2tJZC50eXBlKSkpO1xuXHRcdH1cblx0XHQvLyBydW4gYSB0YXNrIGJlZm9yZSBzdGFydGluZyBhIGRlYnVnIHNlc3Npb25cblx0XHRjb25zdCB0YXNrID0gYXdhaXQgdGhpcy50YXNrU2VydmljZS5nZXRUYXNrKHJvb3QsIHRhc2tJZCk7XG5cdFx0aWYgKCF0YXNrKSB7XG5cdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSB0eXBlb2YgdGFza0lkID09PSAnc3RyaW5nJ1xuXHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnRGVidWdUYXNrTm90Rm91bmRXaXRoVGFza0lkJywgXCJDb3VsZCBub3QgZmluZCB0aGUgdGFzayAnezB9Jy5cIiwgdGFza0lkKVxuXHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnRGVidWdUYXNrTm90Rm91bmQnLCBcIkNvdWxkIG5vdCBmaW5kIHRoZSBzcGVjaWZpZWQgdGFzay5cIik7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoY3JlYXRlRXJyb3JXaXRoQWN0aW9ucyhlcnJvck1lc3NhZ2UsIFtuZXcgQWN0aW9uKERFQlVHX0NPTkZJR1VSRV9DT01NQU5EX0lELCBERUJVR19DT05GSUdVUkVfTEFCRUwsIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChERUJVR19DT05GSUdVUkVfQ09NTUFORF9JRCkpXSkpO1xuXHRcdH1cblxuXHRcdC8vIElmIGEgdGFzayBpcyBtaXNzaW5nIHRoZSBwcm9ibGVtIG1hdGNoZXIgdGhlIHByb21pc2Ugd2lsbCBuZXZlciBjb21wbGV0ZSwgc28gd2UgbmVlZCB0byBoYXZlIGEgd29ya2Fyb3VuZCAjMzUzNDBcblx0XHRsZXQgdGFza1N0YXJ0ZWQgPSBmYWxzZTtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBnZXRUYXNrS2V5ID0gKHQ6IFRhc2spID0+IHQuZ2V0S2V5KCkgPz8gdC5nZXRNYXBLZXkoKTtcblx0XHRjb25zdCB0YXNrS2V5ID0gZ2V0VGFza0tleSh0YXNrKTtcblx0XHRjb25zdCBpbmFjdGl2ZVByb21pc2U6IFByb21pc2U8SVRhc2tTdW1tYXJ5IHwgbnVsbD4gPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc3RvcmUuYWRkKFxuXHRcdFx0b25jZUZpbHRlcih0aGlzLnRhc2tTZXJ2aWNlLm9uRGlkU3RhdGVDaGFuZ2UsIGUgPT4ge1xuXHRcdFx0XHQvLyBXaGVuIGEgdGFzayBpc0JhY2tncm91bmQgaXQgd2lsbCBnbyBpbmFjdGl2ZSB3aGVuIGl0IGlzIHNhZmUgdG8gbGF1bmNoLlxuXHRcdFx0XHQvLyBCdXQgd2hlbiBhIGJhY2tncm91bmQgdGFzayBpcyB0ZXJtaW5hdGVkIGJ5IHRoZSB1c2VyLCBpdCB3aWxsIGFsc28gZmlyZSBhbiBpbmFjdGl2ZSBldmVudC5cblx0XHRcdFx0Ly8gVGhpcyBtZWFucyB0aGF0IHdlIHdpbGwgbm90IGdldCB0byBzZWUgdGhlIHJlYWwgZXhpdCBjb2RlIGZyb20gcnVubmluZyB0aGUgdGFzayAodW5kZWZpbmVkIHdoZW4gdGVybWluYXRlZCBieSB0aGUgdXNlcikuXG5cdFx0XHRcdC8vIENhdGNoIHRoZSBQcm9jZXNzRW5kZWQgZXZlbnQgaGVyZSwgd2hpY2ggb2NjdXJzIGJlZm9yZSBpbmFjdGl2ZSwgYW5kIGNhcHR1cmUgdGhlIGV4aXQgY29kZSB0byBwcmV2ZW50IHRoaXMuXG5cdFx0XHRcdHJldHVybiAoZS5raW5kID09PSBUYXNrRXZlbnRLaW5kLkluYWN0aXZlXG5cdFx0XHRcdFx0fHwgKGUua2luZCA9PT0gVGFza0V2ZW50S2luZC5Qcm9jZXNzRW5kZWQgJiYgZS5leGl0Q29kZSA9PT0gdW5kZWZpbmVkKSlcblx0XHRcdFx0XHQmJiBnZXRUYXNrS2V5KGUuX190YXNrKSA9PT0gdGFza0tleTtcblx0XHRcdH0pKGUgPT4ge1xuXHRcdFx0XHR0YXNrU3RhcnRlZCA9IHRydWU7XG5cdFx0XHRcdHJlc29sdmUoZS5raW5kID09PSBUYXNrRXZlbnRLaW5kLlByb2Nlc3NFbmRlZCA/IHsgZXhpdENvZGU6IGUuZXhpdENvZGUgfSA6IG51bGwpO1xuXHRcdFx0fSksXG5cdFx0KSk7XG5cblx0XHRzdG9yZS5hZGQoXG5cdFx0XHRvbmNlRmlsdGVyKHRoaXMudGFza1NlcnZpY2Uub25EaWRTdGF0ZUNoYW5nZSwgZSA9PiAoKGUua2luZCA9PT0gVGFza0V2ZW50S2luZC5BY3RpdmUpIHx8IChlLmtpbmQgPT09IFRhc2tFdmVudEtpbmQuRGVwZW5kc09uU3RhcnRlZCkpICYmIGdldFRhc2tLZXkoZS5fX3Rhc2spID09PSB0YXNrS2V5XG5cdFx0XHQpKCgpID0+IHtcblx0XHRcdFx0Ly8gVGFzayBpcyBhY3RpdmUsIHNvIGV2ZXJ5dGhpbmcgc2VlbXMgdG8gYmUgZmluZSwgbm8gbmVlZCB0byBwcm9tcHQgYWZ0ZXIgMTAgc2Vjb25kc1xuXHRcdFx0XHQvLyBVc2UgY2FzZSBiZWluZyBhIHNsb3cgcnVubmluZyB0YXNrIHNob3VsZCBub3QgYmUgcHJvbXB0ZWQgZXZlbiB0aG91Z2ggaXQgdGFrZXMgbW9yZSB0aGFuIDEwIHNlY29uZHNcblx0XHRcdFx0dGFza1N0YXJ0ZWQgPSB0cnVlO1xuXHRcdFx0fSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgZGlkQWNxdWlyZUlucHV0ID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdHN0b3JlLmFkZChvbmNlRmlsdGVyKFxuXHRcdFx0dGhpcy50YXNrU2VydmljZS5vbkRpZFN0YXRlQ2hhbmdlLFxuXHRcdFx0ZSA9PiAoZS5raW5kID09PSBUYXNrRXZlbnRLaW5kLkFjcXVpcmVkSW5wdXQpICYmIGdldFRhc2tLZXkoZS5fX3Rhc2spID09PSB0YXNrS2V5XG5cdFx0KSgoKSA9PiBkaWRBY3F1aXJlSW5wdXQuZmlyZSgpKSk7XG5cblx0XHRjb25zdCB0YXNrRG9uZVByb21pc2U6IFByb21pc2U8SVRhc2tTdW1tYXJ5IHwgbnVsbD4gPSB0aGlzLnRhc2tTZXJ2aWNlLmdldEFjdGl2ZVRhc2tzKCkudGhlbihhc3luYyAodGFza3MpOiBQcm9taXNlPElUYXNrU3VtbWFyeSB8IG51bGw+ID0+IHtcblx0XHRcdGlmICh0YXNrcy5maW5kKHQgPT4gZ2V0VGFza0tleSh0KSA9PT0gdGFza0tleSkpIHtcblx0XHRcdFx0ZGlkQWNxdWlyZUlucHV0LmZpcmUoKTtcblx0XHRcdFx0Ly8gQ2hlY2sgdGhhdCB0aGUgdGFzayBpc24ndCBidXN5IGFuZCBpZiBpdCBpcywgd2FpdCBmb3IgaXRcblx0XHRcdFx0Y29uc3QgYnVzeVRhc2tzID0gYXdhaXQgdGhpcy50YXNrU2VydmljZS5nZXRCdXN5VGFza3MoKTtcblx0XHRcdFx0aWYgKGJ1c3lUYXNrcy5maW5kKHQgPT4gZ2V0VGFza0tleSh0KSA9PT0gdGFza0tleSkpIHtcblx0XHRcdFx0XHR0YXNrU3RhcnRlZCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIGluYWN0aXZlUHJvbWlzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyB0YXNrIGlzIGFscmVhZHkgcnVubmluZyBhbmQgaXNuJ3QgYnVzeSAtIG5vdGhpbmcgdG8gZG8uXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRhc2tQcm9taXNlID0gdGhpcy50YXNrU2VydmljZS5ydW4odGFzayk7XG5cdFx0XHRpZiAodGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pc0JhY2tncm91bmQpIHtcblx0XHRcdFx0cmV0dXJuIGluYWN0aXZlUHJvbWlzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRhc2tQcm9taXNlLnRoZW4oeCA9PiB4ID8/IG51bGwpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFByb21pc2U8SVJ1bm5lclRhc2tTdW1tYXJ5IHwgbnVsbD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0dGFza0RvbmVQcm9taXNlLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0dGFza1N0YXJ0ZWQgPSB0cnVlO1xuXHRcdFx0XHRyZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9LCBlcnJvciA9PiByZWplY3QoZXJyb3IpKTtcblxuXHRcdFx0c3RvcmUuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSh7IGV4aXRDb2RlOiB1bmRlZmluZWQsIGNhbmNlbGxlZDogdHJ1ZSB9KTtcblx0XHRcdFx0dGhpcy50YXNrU2VydmljZS50ZXJtaW5hdGUodGFzaykuY2F0Y2goKCkgPT4geyB9KTtcblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gU3RhcnQgdGhlIHRpbWVvdXRzIG9uY2UgYSB0ZXJtaW5hbCBoYXMgYmVlbiBhY3F1aXJlZFxuXHRcdFx0c3RvcmUuYWRkKGRpZEFjcXVpcmVJbnB1dC5ldmVudCgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHdhaXRUaW1lID0gdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pc0JhY2tncm91bmQgPyA1MDAwIDogMTAwMDA7XG5cblx0XHRcdFx0Ly8gRXJyb3Igc2hvd24gaWYgdGhlcmUncyBhIGJhY2tncm91bmQgdGFzayB3aXRoIG5vIHByb2JsZW0gbWF0Y2hlciB0aGF0IGRvZXNuJ3QgZXhpdCBxdWlja2x5XG5cdFx0XHRcdHN0b3JlLmFkZChkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0YXNrU3RhcnRlZCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gbmxzLmxvY2FsaXplKCd0YXNrTm90VHJhY2tlZCcsIFwiVGhlIHRhc2sgJ3swfScgaGFzIG5vdCBleGl0ZWQgYW5kIGRvZXNuJ3QgaGF2ZSBhICdwcm9ibGVtTWF0Y2hlcicgZGVmaW5lZC4gTWFrZSBzdXJlIHRvIGRlZmluZSBhIHByb2JsZW0gbWF0Y2hlciBmb3Igd2F0Y2ggdGFza3MuXCIsIHR5cGVvZiB0YXNrSWQgPT09ICdzdHJpbmcnID8gdGFza0lkIDogSlNPTi5zdHJpbmdpZnkodGFza0lkKSk7XG5cdFx0XHRcdFx0XHRyZWplY3QoeyBzZXZlcml0eTogc2V2ZXJpdHkuRXJyb3IsIG1lc3NhZ2U6IGVycm9yTWVzc2FnZSB9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIHdhaXRUaW1lKSk7XG5cblx0XHRcdFx0Y29uc3QgaGlkZVNsb3dQcmVMYXVuY2hXYXJuaW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRGVidWdDb25maWd1cmF0aW9uPignZGVidWcnKS5oaWRlU2xvd1ByZUxhdW5jaFdhcm5pbmc7XG5cdFx0XHRcdGlmICghaGlkZVNsb3dQcmVMYXVuY2hXYXJuaW5nKSB7XG5cdFx0XHRcdFx0Ly8gTm90aWZpY2F0aW9uIHNob3duIG9uIGFueSB0YXNrIHRha2luZyBhIHdoaWxlIHRvIHJlc29sdmVcblx0XHRcdFx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncnVubmluZ1Rhc2snLCBcIldhaXRpbmcgZm9yIHByZUxhdW5jaFRhc2sgJ3swfScuLi5cIiwgdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5uYW1lKTtcblx0XHRcdFx0XHRcdGNvbnN0IGJ1dHRvbnMgPSBbREVCVUdfQU5ZV0FZX0xBQkVMX05PX01FTU8sIEFCT1JUX0xBQkVMXTtcblx0XHRcdFx0XHRcdGNvbnN0IGNhbkNvbmZpZ3VyZSA9IHRhc2sgaW5zdGFuY2VvZiBDdXN0b21UYXNrIHx8IHRhc2sgaW5zdGFuY2VvZiBDb25maWd1cmluZ1Rhc2s7XG5cdFx0XHRcdFx0XHRpZiAoY2FuQ29uZmlndXJlKSB7XG5cdFx0XHRcdFx0XHRcdGJ1dHRvbnMuc3BsaWNlKDEsIDAsIG5scy5sb2NhbGl6ZSgnY29uZmlndXJlVGFzaycsIFwiQ29uZmlndXJlIFRhc2tcIikpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoXG5cdFx0XHRcdFx0XHRcdHsgbG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uLCB0aXRsZTogbWVzc2FnZSwgYnV0dG9ucyB9LFxuXHRcdFx0XHRcdFx0XHQoKSA9PiByZXN1bHQuY2F0Y2goKCkgPT4geyB9KSxcblx0XHRcdFx0XHRcdFx0KGNob2ljZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChjaG9pY2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gbm8tb3AsIGtlZXAgd2FpdGluZ1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoY2hvaWNlID09PSAwKSB7IC8vIGRlYnVnIGFueXdheVxuXHRcdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IGV4aXRDb2RlOiAwIH0pO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7IC8vIGFib3J0IG9yIGNvbmZpZ3VyZVxuXHRcdFx0XHRcdFx0XHRcdFx0cmVzb2x2ZSh7IGV4aXRDb2RlOiB1bmRlZmluZWQsIGNhbmNlbGxlZDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMudGFza1NlcnZpY2UudGVybWluYXRlKHRhc2spLmNhdGNoKCgpID0+IHsgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoY2FuQ29uZmlndXJlICYmIGNob2ljZSA9PT0gMSkgeyAvLyBjb25maWd1cmVcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy50YXNrU2VydmljZS5vcGVuQ29uZmlnKHRhc2sgYXMgQ3VzdG9tVGFzayk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0sIDEwXzAwMCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0LmZpbmFsbHkoKCkgPT4gc3RvcmUuZGlzcG9zZSgpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWM7QUFDdkIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyx1QkFBb0M7QUFDN0MsT0FBTyxjQUFjO0FBQ3JCLFlBQVksU0FBUztBQUNyQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdCQUFnQixzQkFBc0I7QUFDL0MsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBRTdELFNBQVMsNEJBQTRCLDZCQUE2QjtBQUVsRSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsWUFBK0MscUJBQXFCO0FBQzlGLFNBQVMsb0JBQWtDO0FBQzNDLFNBQVMscUJBQXFCO0FBRTlCLE1BQU0sYUFBYSxDQUFDLE9BQTBCLFdBQXVDLE1BQU0sS0FBSyxNQUFNLE9BQU8sT0FBTyxNQUFNLENBQUM7QUFFcEgsSUFBVyxnQkFBWCxrQkFBV0EsbUJBQVg7QUFDTixFQUFBQSw4QkFBQTtBQUNBLEVBQUFBLDhCQUFBO0FBRmlCLFNBQUFBO0FBQUEsR0FBQTtB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QWEsQ0FBQztBQUFBLFVBQzNEO0FBQUEsUUFDRCxHQUFHLFFBQVEsQ0FBQztBQUVaLGNBQU0sMkJBQTJCLEtBQUsscUJBQXFCLFNBQThCLE9BQU8sRUFBRTtBQUNsRyxZQUFJLENBQUMsMEJBQTBCO0FBRTlCLGdCQUFNLElBQUksa0JBQWtCLE1BQU07QUFDakMsa0JBQU0sVUFBVSxJQUFJLFNBQVMsZUFBZSxzQ0FBc0MsS0FBSyx3QkFBd0IsSUFBSTtBQUNuSCxrQkFBTSxVQUFVLENBQUMsNEJBQTRCLFdBQVc7QUFDeEQsa0JBQU0sZUFBZSxnQkFBZ0IsY0FBYyxnQkFBZ0I7QUFDbkUsZ0JBQUksY0FBYztBQUNqQixzQkFBUSxPQUFPLEdBQUcsR0FBRyxJQUFJLFNBQVMsaUJBQWlCLGdCQUFnQixDQUFDO0FBQUEsWUFDckU7QUFFQSxpQkFBSyxnQkFBZ0I7QUFBQSxjQUNwQixFQUFFLFVBQVUsaUJBQWlCLGNBQWMsT0FBTyxTQUFTLFFBQVE7QUFBQSxjQUNuRSxNQUFNLE9BQU8sTUFBTSxNQUFNO0FBQUEsY0FBRSxDQUFDO0FBQUEsY0FDNUIsQ0FBQyxXQUFXO0FBQ1gsb0JBQUksV0FBVyxRQUFXO0FBQUEsZ0JBRTFCLFdBQVcsV0FBVyxHQUFHO0FBQ3hCLDBCQUFRLEVBQUUsVUFBVSxFQUFFLENBQUM7QUFBQSxnQkFDeEIsT0FBTztBQUNOLDBCQUFRLEVBQUUsVUFBVSxRQUFXLFdBQVcsS0FBSyxDQUFDO0FBQ2hELHVCQUFLLFlBQVksVUFBVSxJQUFJLEVBQUUsTUFBTSxNQUFNO0FBQUEsa0JBQUUsQ0FBQztBQUNoRCxzQkFBSSxnQkFBZ0IsV0FBVyxHQUFHO0FBQ2pDLHlCQUFLLFlBQVksV0FBVyxJQUFrQjtBQUFBLGtCQUMvQztBQUFBLGdCQUNEO0FBQUEsY0FDRDtBQUFBLFlBQ0Q7QUFBQSxVQUNELEdBQUcsR0FBTSxDQUFDO0FBQUEsUUFDWDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSCxDQUFDO0FBRUQsV0FBTyxPQUFPLFFBQVEsTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUFBLEVBQzVDO0FBQ0Q7QUF4UmEsa0JBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBWlU7IiwKICAibmFtZXMiOiBbIlRhc2tSdW5SZXN1bHQiLCAiRGVidWdDaG9pY2UiLCAicmVzdWx0Il0KfQo=
