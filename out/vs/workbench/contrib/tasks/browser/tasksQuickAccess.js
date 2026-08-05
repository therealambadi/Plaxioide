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
import { localize } from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { matchesFuzzy } from "../../../../base/common/filters.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ITaskService } from "../common/taskService.js";
import { CustomTask, ContributedTask, ConfiguringTask } from "../common/tasks.js";
import { TaskQuickPick } from "./taskQuickPick.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isString } from "../../../../base/common/types.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let TasksQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(extensionService, _taskService, _configurationService, _quickInputService, _notificationService, _dialogService, _themeService, _storageService) {
    super(TasksQuickAccessProvider.PREFIX, {
      noResultsPick: {
        label: localize("noTaskResults", "No matching tasks")
      }
    });
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._dialogService = _dialogService;
    this._themeService = _themeService;
    this._storageService = _storageService;
  }
  async _getPicks(filter, disposables, token) {
    if (token.isCancellationRequested) {
      return [];
    }
    const taskQuickPick = new TaskQuickPick(this._taskService, this._configurationService, this._quickInputService, this._notificationService, this._themeService, this._dialogService, this._storageService);
    const topLevelPicks = await taskQuickPick.getTopLevelEntries();
    const taskPicks = [];
    for (const entry of topLevelPicks.entries) {
      const highlights = matchesFuzzy(filter, entry.label);
      if (!highlights) {
        continue;
      }
      if (entry.type === "separator") {
        taskPicks.push(entry);
      }
      const task = entry.task;
      const quickAccessEntry = entry;
      quickAccessEntry.highlights = { label: highlights };
      quickAccessEntry.trigger = (index) => {
        if (index === 1 && quickAccessEntry.buttons?.length === 2) {
          const key = task && !isString(task) ? task.getKey() : void 0;
          if (key) {
            this._taskService.removeRecentlyUsedTask(key);
          }
          return TriggerAction.REFRESH_PICKER;
        } else {
          if (ContributedTask.is(task)) {
            this._taskService.customize(task, void 0, true);
          } else if (CustomTask.is(task)) {
            this._taskService.openConfig(task);
          }
          return TriggerAction.CLOSE_PICKER;
        }
      };
      quickAccessEntry.accept = async () => {
        if (isString(task)) {
          const showResult = await taskQuickPick.show(localize("TaskService.pickRunTask", "Select the task to run"), void 0, task);
          if (showResult) {
            this._taskService.run(showResult, { attachProblemMatcher: true });
          }
        } else {
          this._taskService.run(await this._toTask(task), { attachProblemMatcher: true });
        }
      };
      taskPicks.push(quickAccessEntry);
    }
    return taskPicks;
  }
  async _toTask(task) {
    if (!ConfiguringTask.is(task)) {
      return task;
    }
    return this._taskService.tryResolveTask(task);
  }
};
TasksQuickAccessProvider.PREFIX = "task ";
TasksQuickAccessProvider = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, ITaskService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IStorageService)
], TasksQuickAccessProvider);
export {
  TasksQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL3Rhc2tzUXVpY2tBY2Nlc3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tQaWNrU2VwYXJhdG9yLCBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0sIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXIsIFRyaWdnZXJBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcGlja2VyUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgbWF0Y2hlc0Z1enp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVRhc2tTZXJ2aWNlLCBUYXNrIH0gZnJvbSAnLi4vY29tbW9uL3Rhc2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEN1c3RvbVRhc2ssIENvbnRyaWJ1dGVkVGFzaywgQ29uZmlndXJpbmdUYXNrIH0gZnJvbSAnLi4vY29tbW9uL3Rhc2tzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUYXNrUXVpY2tQaWNrLCBJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnkgfSBmcm9tICcuL3Rhc2tRdWlja1BpY2suanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgY2xhc3MgVGFza3NRdWlja0FjY2Vzc1Byb3ZpZGVyIGV4dGVuZHMgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlcjxJUGlja2VyUXVpY2tBY2Nlc3NJdGVtPiB7XG5cblx0c3RhdGljIFBSRUZJWCA9ICd0YXNrICc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJVGFza1NlcnZpY2UgcHJpdmF0ZSBfdGFza1NlcnZpY2U6IElUYXNrU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSBfZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihUYXNrc1F1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLCB7XG5cdFx0XHRub1Jlc3VsdHNQaWNrOiB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbm9UYXNrUmVzdWx0cycsIFwiTm8gbWF0Y2hpbmcgdGFza3NcIilcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBfZ2V0UGlja3MoZmlsdGVyOiBzdHJpbmcsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8QXJyYXk8SVBpY2tlclF1aWNrQWNjZXNzSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3I+PiB7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGFza1F1aWNrUGljayA9IG5ldyBUYXNrUXVpY2tQaWNrKHRoaXMuX3Rhc2tTZXJ2aWNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UsIHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UsIHRoaXMuX3RoZW1lU2VydmljZSwgdGhpcy5fZGlhbG9nU2VydmljZSwgdGhpcy5fc3RvcmFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHRvcExldmVsUGlja3MgPSBhd2FpdCB0YXNrUXVpY2tQaWNrLmdldFRvcExldmVsRW50cmllcygpO1xuXHRcdGNvbnN0IHRhc2tQaWNrczogQXJyYXk8SVBpY2tlclF1aWNrQWNjZXNzSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3I+ID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRvcExldmVsUGlja3MuZW50cmllcykge1xuXHRcdFx0Y29uc3QgaGlnaGxpZ2h0cyA9IG1hdGNoZXNGdXp6eShmaWx0ZXIsIGVudHJ5LmxhYmVsISk7XG5cdFx0XHRpZiAoIWhpZ2hsaWdodHMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlbnRyeS50eXBlID09PSAnc2VwYXJhdG9yJykge1xuXHRcdFx0XHR0YXNrUGlja3MucHVzaChlbnRyeSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRhc2s6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2sgfCBzdHJpbmcgPSAoPElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeT5lbnRyeSkudGFzayE7XG5cdFx0XHRjb25zdCBxdWlja0FjY2Vzc0VudHJ5OiBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtID0gPElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeT5lbnRyeTtcblx0XHRcdHF1aWNrQWNjZXNzRW50cnkuaGlnaGxpZ2h0cyA9IHsgbGFiZWw6IGhpZ2hsaWdodHMgfTtcblx0XHRcdHF1aWNrQWNjZXNzRW50cnkudHJpZ2dlciA9IChpbmRleCkgPT4ge1xuXHRcdFx0XHRpZiAoKGluZGV4ID09PSAxKSAmJiAocXVpY2tBY2Nlc3NFbnRyeS5idXR0b25zPy5sZW5ndGggPT09IDIpKSB7XG5cdFx0XHRcdFx0Y29uc3Qga2V5ID0gKHRhc2sgJiYgIWlzU3RyaW5nKHRhc2spKSA/IHRhc2suZ2V0S2V5KCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKGtleSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UucmVtb3ZlUmVjZW50bHlVc2VkVGFzayhrZXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5SRUZSRVNIX1BJQ0tFUjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoQ29udHJpYnV0ZWRUYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl90YXNrU2VydmljZS5jdXN0b21pemUodGFzaywgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKEN1c3RvbVRhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLm9wZW5Db25maWcodGFzayk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBUcmlnZ2VyQWN0aW9uLkNMT1NFX1BJQ0tFUjtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHF1aWNrQWNjZXNzRW50cnkuYWNjZXB0ID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRpZiAoaXNTdHJpbmcodGFzaykpIHtcblx0XHRcdFx0XHQvLyBzd2l0Y2ggdG8gcXVpY2sgcGljayBhbmQgc2hvdyBzZWNvbmQgbGV2ZWxcblx0XHRcdFx0XHRjb25zdCBzaG93UmVzdWx0ID0gYXdhaXQgdGFza1F1aWNrUGljay5zaG93KGxvY2FsaXplKCdUYXNrU2VydmljZS5waWNrUnVuVGFzaycsICdTZWxlY3QgdGhlIHRhc2sgdG8gcnVuJyksIHVuZGVmaW5lZCwgdGFzayk7XG5cdFx0XHRcdFx0aWYgKHNob3dSZXN1bHQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLnJ1bihzaG93UmVzdWx0LCB7IGF0dGFjaFByb2JsZW1NYXRjaGVyOiB0cnVlIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl90YXNrU2VydmljZS5ydW4oYXdhaXQgdGhpcy5fdG9UYXNrKHRhc2spLCB7IGF0dGFjaFByb2JsZW1NYXRjaGVyOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0YXNrUGlja3MucHVzaChxdWlja0FjY2Vzc0VudHJ5KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRhc2tQaWNrcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3RvVGFzayh0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrKTogUHJvbWlzZTxUYXNrIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFDb25maWd1cmluZ1Rhc2suaXModGFzaykpIHtcblx0XHRcdHJldHVybiB0YXNrO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl90YXNrU2VydmljZS50cnlSZXNvbHZlVGFzayh0YXNrKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUE4QiwwQkFBMEI7QUFDeEQsU0FBaUMsMkJBQTJCLHFCQUFxQjtBQUNqRixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG9C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
