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
import * as Objects from "../../../../base/common/objects.js";
import { ContributedTask, CustomTask, ConfiguringTask } from "../common/tasks.js";
import * as Types from "../../../../base/common/types.js";
import { ITaskService } from "../common/taskService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { getColorClass, createColorStyleElement } from "../../terminal/browser/terminalIcon.js";
import { showWithPinnedItems } from "../../../../platform/quickinput/browser/quickPickPin.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
const QUICKOPEN_DETAIL_CONFIG = "task.quickOpen.detail";
const QUICKOPEN_SKIP_CONFIG = "task.quickOpen.skip";
function isWorkspaceFolder(folder) {
  return "uri" in folder;
}
const SHOW_ALL = nls.localize("taskQuickPick.showAll", "Show All Tasks...");
const configureTaskIcon = registerIcon("tasks-list-configure", Codicon.gear, nls.localize("configureTaskIcon", "Configuration icon in the tasks selection list."));
const removeTaskIcon = registerIcon("tasks-remove", Codicon.close, nls.localize("removeTaskIcon", "Icon for remove in the tasks selection list."));
const runTaskStorageKey = "runTaskStorageKey";
let TaskQuickPick = class extends Disposable {
  constructor(_taskService, _configurationService, _quickInputService, _notificationService, _themeService, _dialogService, _storageService) {
    super();
    this._taskService = _taskService;
    this._configurationService = _configurationService;
    this._quickInputService = _quickInputService;
    this._notificationService = _notificationService;
    this._themeService = _themeService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._sorter = this._taskService.createSorter();
  }
  _showDetail() {
    return !!this._configurationService.getValue(QUICKOPEN_DETAIL_CONFIG);
  }
  _guessTaskLabel(task) {
    if (task._label) {
      return task._label;
    }
    if (ConfiguringTask.is(task)) {
      let label = task.configures.type;
      const configures = Objects.deepClone(task.configures);
      delete configures["_key"];
      delete configures["type"];
      Object.keys(configures).forEach((key) => label += `: ${configures[key]}`);
      return label;
    }
    return "";
  }
  static getTaskLabelWithIcon(task, labelGuess) {
    const label = labelGuess || task._label;
    const icon = task.configurationProperties.icon;
    if (!icon) {
      return `${label}`;
    }
    return icon.id ? `$(${icon.id}) ${label}` : `$(${Codicon.tools.id}) ${label}`;
  }
  static applyColorStyles(task, entry, themeService) {
    if (task.configurationProperties.icon?.color) {
      const colorTheme = themeService.getColorTheme();
      const disposable = createColorStyleElement(colorTheme);
      entry.iconClasses = [getColorClass(task.configurationProperties.icon.color)];
      return disposable;
    }
    return;
  }
  _createTaskEntry(task, extraButtons = []) {
    const buttons = [
      { iconClass: ThemeIcon.asClassName(configureTaskIcon), tooltip: nls.localize("configureTask", "Configure Task") },
      ...extraButtons
    ];
    const entry = { label: TaskQuickPick.getTaskLabelWithIcon(task, this._guessTaskLabel(task)), description: this._taskService.getTaskDescription(task), task, detail: this._showDetail() ? task.configurationProperties.detail : void 0, buttons };
    const disposable = TaskQuickPick.applyColorStyles(task, entry, this._themeService);
    if (disposable) {
      this._register(disposable);
    }
    return entry;
  }
  _createEntriesForGroup(entries, tasks, groupLabel, extraButtons = []) {
    entries.push({ type: "separator", label: groupLabel });
    tasks.forEach((task) => {
      if (!task.configurationProperties.hide) {
        entries.push(this._createTaskEntry(task, extraButtons));
      }
    });
  }
  _createTypeEntries(entries, types) {
    entries.push({ type: "separator", label: nls.localize("contributedTasks", "contributed") });
    types.forEach((type) => {
      entries.push({ label: `$(folder) ${type}`, task: type, ariaLabel: nls.localize("taskType", "All {0} tasks", type) });
    });
    entries.push({ label: SHOW_ALL, task: SHOW_ALL, alwaysShow: true });
  }
  _handleFolderTaskResult(result) {
    const tasks = [];
    Array.from(result).forEach(([key, folderTasks]) => {
      if (folderTasks.set) {
        tasks.push(...folderTasks.set.tasks);
      }
      if (folderTasks.configurations) {
        for (const configuration in folderTasks.configurations.byIdentifier) {
          tasks.push(folderTasks.configurations.byIdentifier[configuration]);
        }
      }
    });
    return tasks;
  }
  _dedupeConfiguredAndRecent(recentTasks, configuredTasks) {
    let dedupedConfiguredTasks = [];
    const foundRecentTasks = Array(recentTasks.length).fill(false);
    for (let j = 0; j < configuredTasks.length; j++) {
      const workspaceFolder = configuredTasks[j].getWorkspaceFolder()?.uri.toString();
      const definition = configuredTasks[j].getDefinition()?._key;
      const type = configuredTasks[j].type;
      const label = configuredTasks[j]._label;
      const recentKey = configuredTasks[j].getKey();
      const findIndex = recentTasks.findIndex((value) => {
        return workspaceFolder && definition && value.getWorkspaceFolder()?.uri.toString() === workspaceFolder && (value.getDefinition()?._key === definition || value.type === type && value._label === label) || recentKey && value.getKey() === recentKey;
      });
      if (findIndex === -1) {
        dedupedConfiguredTasks.push(configuredTasks[j]);
      } else {
        recentTasks[findIndex] = configuredTasks[j];
        foundRecentTasks[findIndex] = true;
      }
    }
    dedupedConfiguredTasks = dedupedConfiguredTasks.sort((a, b) => this._sorter.compare(a, b));
    const prunedRecentTasks = [];
    for (let i = 0; i < recentTasks.length; i++) {
      if (foundRecentTasks[i] || ConfiguringTask.is(recentTasks[i])) {
        prunedRecentTasks.push(recentTasks[i]);
      }
    }
    return { configuredTasks: dedupedConfiguredTasks, recentTasks: prunedRecentTasks };
  }
  async getTopLevelEntries(defaultEntry) {
    if (this._topLevelEntries !== void 0) {
      return { entries: this._topLevelEntries };
    }
    let recentTasks = (await this._taskService.getSavedTasks("historical")).reverse();
    const configuredTasks = this._handleFolderTaskResult(await this._taskService.getWorkspaceTasks());
    const extensionTaskTypes = this._taskService.taskTypes();
    this._topLevelEntries = [];
    const dedupeAndPrune = this._dedupeConfiguredAndRecent(recentTasks, configuredTasks);
    const dedupedConfiguredTasks = dedupeAndPrune.configuredTasks;
    recentTasks = dedupeAndPrune.recentTasks;
    if (recentTasks.length > 0) {
      const removeRecentButton = {
        iconClass: ThemeIcon.asClassName(removeTaskIcon),
        tooltip: nls.localize("removeRecent", "Remove Recently Used Task")
      };
      this._createEntriesForGroup(this._topLevelEntries, recentTasks, nls.localize("recentlyUsed", "recently used"), [removeRecentButton]);
    }
    if (configuredTasks.length > 0) {
      if (dedupedConfiguredTasks.length > 0) {
        this._createEntriesForGroup(this._topLevelEntries, dedupedConfiguredTasks, nls.localize("configured", "configured"));
      }
    }
    if (defaultEntry && configuredTasks.length === 0) {
      this._topLevelEntries.push({ type: "separator", label: nls.localize("configured", "configured") });
      this._topLevelEntries.push(defaultEntry);
    }
    if (extensionTaskTypes.length > 0) {
      this._createTypeEntries(this._topLevelEntries, extensionTaskTypes);
    }
    return { entries: this._topLevelEntries, isSingleConfigured: configuredTasks.length === 1 ? configuredTasks[0] : void 0 };
  }
  async handleSettingOption(selectedType) {
    const { confirmed } = await this._dialogService.confirm({
      type: Severity.Warning,
      message: nls.localize(
        "TaskQuickPick.changeSettingDetails",
        "Task detection for {0} tasks causes files in any workspace you open to be run as code. Enabling {0} task detection is a user setting and will apply to any workspace you open. \n\n Do you want to enable {0} task detection for all workspaces?",
        selectedType
      ),
      cancelButton: nls.localize("TaskQuickPick.changeSettingNo", "No")
    });
    if (confirmed) {
      await this._configurationService.updateValue(`${selectedType}.autoDetect`, "on");
      await new Promise((resolve) => setTimeout(() => resolve(), 100));
      return this.show(nls.localize("TaskService.pickRunTask", "Select the task to run"), void 0, selectedType);
    }
    return void 0;
  }
  async show(placeHolder, defaultEntry, startAtType, name) {
    const disposables = new DisposableStore();
    const picker = disposables.add(this._quickInputService.createQuickPick({ useSeparators: true }));
    picker.placeholder = placeHolder;
    picker.matchOnDescription = true;
    picker.ignoreFocusOut = false;
    disposables.add(picker.onDidTriggerItemButton(async (context) => {
      const task = context.item.task;
      if (context.button.iconClass === ThemeIcon.asClassName(removeTaskIcon)) {
        const key = task && !Types.isString(task) ? task.getKey() : void 0;
        if (key) {
          this._taskService.removeRecentlyUsedTask(key);
        }
        const indexToRemove = picker.items.indexOf(context.item);
        if (indexToRemove >= 0) {
          picker.items = [...picker.items.slice(0, indexToRemove), ...picker.items.slice(indexToRemove + 1)];
        }
      } else if (context.button.iconClass === ThemeIcon.asClassName(configureTaskIcon)) {
        this._quickInputService.cancel();
        if (ContributedTask.is(task)) {
          this._taskService.customize(task, void 0, true);
        } else if (CustomTask.is(task) || ConfiguringTask.is(task)) {
          let canOpenConfig = false;
          try {
            canOpenConfig = await this._taskService.openConfig(task);
          } catch (e) {
          }
          if (!canOpenConfig) {
            this._taskService.customize(task, void 0, true);
          }
        }
      }
    }));
    if (name) {
      picker.value = name;
    }
    let firstLevelTask = startAtType;
    if (!firstLevelTask) {
      const topLevelEntriesResult = await this.getTopLevelEntries(defaultEntry);
      if (topLevelEntriesResult.isSingleConfigured && this._configurationService.getValue(QUICKOPEN_SKIP_CONFIG)) {
        disposables.dispose();
        return this._toTask(topLevelEntriesResult.isSingleConfigured);
      }
      const taskQuickPickEntries = topLevelEntriesResult.entries;
      firstLevelTask = await this._doPickerFirstLevel(picker, taskQuickPickEntries, disposables);
    }
    do {
      if (Types.isString(firstLevelTask)) {
        if (name) {
          await this._doPickerFirstLevel(picker, (await this.getTopLevelEntries(defaultEntry)).entries, disposables);
          disposables.dispose();
          return void 0;
        }
        const selectedEntry = await this.doPickerSecondLevel(picker, disposables, firstLevelTask);
        if (selectedEntry && !selectedEntry.settingType && selectedEntry.task === null) {
          picker.value = "";
          firstLevelTask = await this._doPickerFirstLevel(picker, (await this.getTopLevelEntries(defaultEntry)).entries, disposables);
        } else if (selectedEntry && Types.isString(selectedEntry.settingType)) {
          disposables.dispose();
          return this.handleSettingOption(selectedEntry.settingType);
        } else {
          disposables.dispose();
          return selectedEntry?.task && !Types.isString(selectedEntry?.task) ? this._toTask(selectedEntry?.task) : void 0;
        }
      } else if (firstLevelTask) {
        disposables.dispose();
        return this._toTask(firstLevelTask);
      } else {
        disposables.dispose();
        return firstLevelTask;
      }
    } while (1);
    return;
  }
  async _doPickerFirstLevel(picker, taskQuickPickEntries, disposables) {
    picker.items = taskQuickPickEntries;
    disposables.add(showWithPinnedItems(this._storageService, runTaskStorageKey, picker, true));
    const firstLevelPickerResult = await new Promise((resolve) => {
      disposables.add(Event.once(picker.onDidAccept)(async () => {
        resolve(picker.selectedItems ? picker.selectedItems[0] : void 0);
      }));
    });
    return firstLevelPickerResult?.task;
  }
  async doPickerSecondLevel(picker, disposables, type, name) {
    picker.busy = true;
    if (type === SHOW_ALL) {
      const items = (await this._taskService.tasks()).filter((t) => !t.configurationProperties.hide).sort((a, b) => this._sorter.compare(a, b)).map((task) => this._createTaskEntry(task));
      items.push(...TaskQuickPick.allSettingEntries(this._configurationService));
      picker.items = items;
    } else {
      picker.value = name || "";
      picker.items = await this._getEntriesForProvider(type);
    }
    await picker.show();
    picker.busy = false;
    const secondLevelPickerResult = await new Promise((resolve) => {
      disposables.add(Event.once(picker.onDidAccept)(async () => {
        resolve(picker.selectedItems ? picker.selectedItems[0] : void 0);
      }));
    });
    return secondLevelPickerResult;
  }
  static allSettingEntries(configurationService) {
    const entries = [];
    const gruntEntry = TaskQuickPick.getSettingEntry(configurationService, "grunt");
    if (gruntEntry) {
      entries.push(gruntEntry);
    }
    const gulpEntry = TaskQuickPick.getSettingEntry(configurationService, "gulp");
    if (gulpEntry) {
      entries.push(gulpEntry);
    }
    const jakeEntry = TaskQuickPick.getSettingEntry(configurationService, "jake");
    if (jakeEntry) {
      entries.push(jakeEntry);
    }
    return entries;
  }
  static getSettingEntry(configurationService, type) {
    if (configurationService.getValue(`${type}.autoDetect`) === "off") {
      return {
        label: nls.localize(
          "TaskQuickPick.changeSettingsOptions",
          "$(gear) {0} task detection is turned off. Enable {1} task detection...",
          type[0].toUpperCase() + type.slice(1),
          type
        ),
        task: null,
        settingType: type,
        alwaysShow: true
      };
    }
    return void 0;
  }
  async _getEntriesForProvider(type) {
    const tasks = (await this._taskService.tasks({ type })).sort((a, b) => this._sorter.compare(a, b));
    let taskQuickPickEntries = [];
    if (tasks.length > 0) {
      for (const task of tasks) {
        if (!task.configurationProperties.hide) {
          taskQuickPickEntries.push(this._createTaskEntry(task));
        }
      }
      taskQuickPickEntries.push({
        type: "separator"
      }, {
        label: nls.localize("TaskQuickPick.goBack", "Go back \u21A9"),
        task: null,
        alwaysShow: true
      });
    } else {
      taskQuickPickEntries = [{
        label: nls.localize("TaskQuickPick.noTasksForType", "No {0} tasks found. Go back \u21A9", type),
        task: null,
        alwaysShow: true
      }];
    }
    const settingEntry = TaskQuickPick.getSettingEntry(this._configurationService, type);
    if (settingEntry) {
      taskQuickPickEntries.push(settingEntry);
    }
    return taskQuickPickEntries;
  }
  async _toTask(task) {
    if (!ConfiguringTask.is(task)) {
      return task;
    }
    const resolvedTask = await this._taskService.tryResolveTask(task);
    if (!resolvedTask) {
      this._notificationService.error(nls.localize("noProviderForTask", 'There is no task provider registered for tasks of type "{0}".', task.type));
    }
    return resolvedTask;
  }
};
TaskQuickPick = __decorateClass([
  __decorateParam(0, ITaskService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IStorageService)
], TaskQuickPick);
export {
  QUICKOPEN_DETAIL_CONFIG,
  QUICKOPEN_SKIP_CONFIG,
  TaskQuickPick,
  configureTaskIcon,
  isWorkspaceFolder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9icm93c2VyL3Rhc2tRdWlja1BpY2sudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIE9iamVjdHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBUYXNrLCBDb250cmlidXRlZFRhc2ssIEN1c3RvbVRhc2ssIENvbmZpZ3VyaW5nVGFzaywgVGFza1NvcnRlciwgS2V5ZWRUYXNrSWRlbnRpZmllciB9IGZyb20gJy4uL2NvbW1vbi90YXNrcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlLCBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0ICogYXMgVHlwZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVRhc2tTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyVGFza1Jlc3VsdCB9IGZyb20gJy4uL2NvbW1vbi90YXNrU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQsIElRdWlja1BpY2ssIElRdWlja0lucHV0QnV0dG9uLCBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgZ2V0Q29sb3JDbGFzcywgY3JlYXRlQ29sb3JTdHlsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsSWNvbi5qcyc7XG5pbXBvcnQgeyBUYXNrUXVpY2tQaWNrRW50cnlUeXBlIH0gZnJvbSAnLi9hYnN0cmFjdFRhc2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNob3dXaXRoUGlubmVkSXRlbXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tQaWNrUGluLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgY29uc3QgUVVJQ0tPUEVOX0RFVEFJTF9DT05GSUcgPSAndGFzay5xdWlja09wZW4uZGV0YWlsJztcbmV4cG9ydCBjb25zdCBRVUlDS09QRU5fU0tJUF9DT05GSUcgPSAndGFzay5xdWlja09wZW4uc2tpcCc7XG5leHBvcnQgZnVuY3Rpb24gaXNXb3Jrc3BhY2VGb2xkZXIoZm9sZGVyOiBJV29ya3NwYWNlIHwgSVdvcmtzcGFjZUZvbGRlcik6IGZvbGRlciBpcyBJV29ya3NwYWNlRm9sZGVyIHtcblx0cmV0dXJuICd1cmknIGluIGZvbGRlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1F1aWNrUGlja0VudHJ5IGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHR0YXNrOiBUYXNrIHwgdW5kZWZpbmVkIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnkgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdHRhc2s6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2sgfCBzdHJpbmcgfCB1bmRlZmluZWQgfCBudWxsO1xuXHRzZXR0aW5nVHlwZT86IHN0cmluZztcbn1cblxuY29uc3QgU0hPV19BTEw6IHN0cmluZyA9IG5scy5sb2NhbGl6ZSgndGFza1F1aWNrUGljay5zaG93QWxsJywgXCJTaG93IEFsbCBUYXNrcy4uLlwiKTtcblxuZXhwb3J0IGNvbnN0IGNvbmZpZ3VyZVRhc2tJY29uID0gcmVnaXN0ZXJJY29uKCd0YXNrcy1saXN0LWNvbmZpZ3VyZScsIENvZGljb24uZ2VhciwgbmxzLmxvY2FsaXplKCdjb25maWd1cmVUYXNrSWNvbicsICdDb25maWd1cmF0aW9uIGljb24gaW4gdGhlIHRhc2tzIHNlbGVjdGlvbiBsaXN0LicpKTtcbmNvbnN0IHJlbW92ZVRhc2tJY29uID0gcmVnaXN0ZXJJY29uKCd0YXNrcy1yZW1vdmUnLCBDb2RpY29uLmNsb3NlLCBubHMubG9jYWxpemUoJ3JlbW92ZVRhc2tJY29uJywgJ0ljb24gZm9yIHJlbW92ZSBpbiB0aGUgdGFza3Mgc2VsZWN0aW9uIGxpc3QuJykpO1xuXG5jb25zdCBydW5UYXNrU3RvcmFnZUtleSA9ICdydW5UYXNrU3RvcmFnZUtleSc7XG5cbmV4cG9ydCBjbGFzcyBUYXNrUXVpY2tQaWNrIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX3NvcnRlcjogVGFza1NvcnRlcjtcblx0cHJpdmF0ZSBfdG9wTGV2ZWxFbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnk+W10gfCB1bmRlZmluZWQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGFza1NlcnZpY2UgcHJpdmF0ZSBfdGFza1NlcnZpY2U6IElUYXNrU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIF90aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fc29ydGVyID0gdGhpcy5fdGFza1NlcnZpY2UuY3JlYXRlU29ydGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93RGV0YWlsKCk6IGJvb2xlYW4ge1xuXHRcdC8vIEVuc3VyZSBpbnZhbGlkIHZhbHVlcyBnZXQgY29udmVydGVkIGludG8gYm9vbGVhbiB2YWx1ZXNcblx0XHRyZXR1cm4gISF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShRVUlDS09QRU5fREVUQUlMX0NPTkZJRyk7XG5cdH1cblxuXHRwcml2YXRlIF9ndWVzc1Rhc2tMYWJlbCh0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrKTogc3RyaW5nIHtcblx0XHRpZiAodGFzay5fbGFiZWwpIHtcblx0XHRcdHJldHVybiB0YXNrLl9sYWJlbDtcblx0XHR9XG5cdFx0aWYgKENvbmZpZ3VyaW5nVGFzay5pcyh0YXNrKSkge1xuXHRcdFx0bGV0IGxhYmVsOiBzdHJpbmcgPSB0YXNrLmNvbmZpZ3VyZXMudHlwZTtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyZXM6IFBhcnRpYWw8S2V5ZWRUYXNrSWRlbnRpZmllcj4gPSBPYmplY3RzLmRlZXBDbG9uZSh0YXNrLmNvbmZpZ3VyZXMpO1xuXHRcdFx0ZGVsZXRlIGNvbmZpZ3VyZXNbJ19rZXknXTtcblx0XHRcdGRlbGV0ZSBjb25maWd1cmVzWyd0eXBlJ107XG5cdFx0XHRPYmplY3Qua2V5cyhjb25maWd1cmVzKS5mb3JFYWNoKGtleSA9PiBsYWJlbCArPSBgOiAke2NvbmZpZ3VyZXNba2V5XX1gKTtcblx0XHRcdHJldHVybiBsYWJlbDtcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBnZXRUYXNrTGFiZWxXaXRoSWNvbih0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrLCBsYWJlbEd1ZXNzPzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBsYWJlbCA9IGxhYmVsR3Vlc3MgfHwgdGFzay5fbGFiZWw7XG5cdFx0Y29uc3QgaWNvbiA9IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaWNvbjtcblx0XHRpZiAoIWljb24pIHtcblx0XHRcdHJldHVybiBgJHtsYWJlbH1gO1xuXHRcdH1cblx0XHRyZXR1cm4gaWNvbi5pZCA/IGAkKCR7aWNvbi5pZH0pICR7bGFiZWx9YCA6IGAkKCR7Q29kaWNvbi50b29scy5pZH0pICR7bGFiZWx9YDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYXBwbHlDb2xvclN0eWxlcyh0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrLCBlbnRyeTogVGFza1F1aWNrUGlja0VudHJ5VHlwZSB8IElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeSwgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlKTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0YXNrLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLmljb24/LmNvbG9yKSB7XG5cdFx0XHRjb25zdCBjb2xvclRoZW1lID0gdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBjcmVhdGVDb2xvclN0eWxlRWxlbWVudChjb2xvclRoZW1lKTtcblx0XHRcdGVudHJ5Lmljb25DbGFzc2VzID0gW2dldENvbG9yQ2xhc3ModGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5pY29uLmNvbG9yKV07XG5cdFx0XHRyZXR1cm4gZGlzcG9zYWJsZTtcblx0XHR9XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVGFza0VudHJ5KHRhc2s6IFRhc2sgfCBDb25maWd1cmluZ1Rhc2ssIGV4dHJhQnV0dG9uczogSVF1aWNrSW5wdXRCdXR0b25bXSA9IFtdKTogSVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5IHtcblx0XHRjb25zdCBidXR0b25zOiBJUXVpY2tJbnB1dEJ1dHRvbltdID0gW1xuXHRcdFx0eyBpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShjb25maWd1cmVUYXNrSWNvbiksIHRvb2x0aXA6IG5scy5sb2NhbGl6ZSgnY29uZmlndXJlVGFzaycsIFwiQ29uZmlndXJlIFRhc2tcIikgfSxcblx0XHRcdC4uLmV4dHJhQnV0dG9uc1xuXHRcdF07XG5cdFx0Y29uc3QgZW50cnk6IElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeSA9IHsgbGFiZWw6IFRhc2tRdWlja1BpY2suZ2V0VGFza0xhYmVsV2l0aEljb24odGFzaywgdGhpcy5fZ3Vlc3NUYXNrTGFiZWwodGFzaykpLCBkZXNjcmlwdGlvbjogdGhpcy5fdGFza1NlcnZpY2UuZ2V0VGFza0Rlc2NyaXB0aW9uKHRhc2spLCB0YXNrLCBkZXRhaWw6IHRoaXMuX3Nob3dEZXRhaWwoKSA/IHRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuZGV0YWlsIDogdW5kZWZpbmVkLCBidXR0b25zIH07XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IFRhc2tRdWlja1BpY2suYXBwbHlDb2xvclN0eWxlcyh0YXNrLCBlbnRyeSwgdGhpcy5fdGhlbWVTZXJ2aWNlKTtcblx0XHRpZiAoZGlzcG9zYWJsZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZGlzcG9zYWJsZSk7XG5cdFx0fVxuXHRcdHJldHVybiBlbnRyeTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUVudHJpZXNGb3JHcm91cChlbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnk+W10sIHRhc2tzOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXSxcblx0XHRncm91cExhYmVsOiBzdHJpbmcsIGV4dHJhQnV0dG9uczogSVF1aWNrSW5wdXRCdXR0b25bXSA9IFtdKSB7XG5cdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBncm91cExhYmVsIH0pO1xuXHRcdHRhc2tzLmZvckVhY2godGFzayA9PiB7XG5cdFx0XHRpZiAoIXRhc2suY29uZmlndXJhdGlvblByb3BlcnRpZXMuaGlkZSkge1xuXHRcdFx0XHRlbnRyaWVzLnB1c2godGhpcy5fY3JlYXRlVGFza0VudHJ5KHRhc2ssIGV4dHJhQnV0dG9ucykpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVHlwZUVudHJpZXMoZW50cmllczogUXVpY2tQaWNrSW5wdXQ8SVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5PltdLCB0eXBlczogc3RyaW5nW10pIHtcblx0XHRlbnRyaWVzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZWRUYXNrcycsIFwiY29udHJpYnV0ZWRcIikgfSk7XG5cdFx0dHlwZXMuZm9yRWFjaCh0eXBlID0+IHtcblx0XHRcdGVudHJpZXMucHVzaCh7IGxhYmVsOiBgJChmb2xkZXIpICR7dHlwZX1gLCB0YXNrOiB0eXBlLCBhcmlhTGFiZWw6IG5scy5sb2NhbGl6ZSgndGFza1R5cGUnLCBcIkFsbCB7MH0gdGFza3NcIiwgdHlwZSkgfSk7XG5cdFx0fSk7XG5cdFx0ZW50cmllcy5wdXNoKHsgbGFiZWw6IFNIT1dfQUxMLCB0YXNrOiBTSE9XX0FMTCwgYWx3YXlzU2hvdzogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZUZvbGRlclRhc2tSZXN1bHQocmVzdWx0OiBNYXA8c3RyaW5nLCBJV29ya3NwYWNlRm9sZGVyVGFza1Jlc3VsdD4pOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXSB7XG5cdFx0Y29uc3QgdGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdID0gW107XG5cdFx0QXJyYXkuZnJvbShyZXN1bHQpLmZvckVhY2goKFtrZXksIGZvbGRlclRhc2tzXSkgPT4ge1xuXHRcdFx0aWYgKGZvbGRlclRhc2tzLnNldCkge1xuXHRcdFx0XHR0YXNrcy5wdXNoKC4uLmZvbGRlclRhc2tzLnNldC50YXNrcyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZm9sZGVyVGFza3MuY29uZmlndXJhdGlvbnMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uIGluIGZvbGRlclRhc2tzLmNvbmZpZ3VyYXRpb25zLmJ5SWRlbnRpZmllcikge1xuXHRcdFx0XHRcdHRhc2tzLnB1c2goZm9sZGVyVGFza3MuY29uZmlndXJhdGlvbnMuYnlJZGVudGlmaWVyW2NvbmZpZ3VyYXRpb25dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiB0YXNrcztcblx0fVxuXG5cdHByaXZhdGUgX2RlZHVwZUNvbmZpZ3VyZWRBbmRSZWNlbnQocmVjZW50VGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdLCBjb25maWd1cmVkVGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdKTogeyBjb25maWd1cmVkVGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdOyByZWNlbnRUYXNrczogKFRhc2sgfCBDb25maWd1cmluZ1Rhc2spW10gfSB7XG5cdFx0bGV0IGRlZHVwZWRDb25maWd1cmVkVGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdID0gW107XG5cdFx0Y29uc3QgZm91bmRSZWNlbnRUYXNrczogYm9vbGVhbltdID0gQXJyYXkocmVjZW50VGFza3MubGVuZ3RoKS5maWxsKGZhbHNlKTtcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IGNvbmZpZ3VyZWRUYXNrcy5sZW5ndGg7IGorKykge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyID0gY29uZmlndXJlZFRhc2tzW2pdLmdldFdvcmtzcGFjZUZvbGRlcigpPy51cmkudG9TdHJpbmcoKTtcblx0XHRcdGNvbnN0IGRlZmluaXRpb24gPSBjb25maWd1cmVkVGFza3Nbal0uZ2V0RGVmaW5pdGlvbigpPy5fa2V5O1xuXHRcdFx0Y29uc3QgdHlwZSA9IGNvbmZpZ3VyZWRUYXNrc1tqXS50eXBlO1xuXHRcdFx0Y29uc3QgbGFiZWwgPSBjb25maWd1cmVkVGFza3Nbal0uX2xhYmVsO1xuXHRcdFx0Y29uc3QgcmVjZW50S2V5ID0gY29uZmlndXJlZFRhc2tzW2pdLmdldEtleSgpO1xuXHRcdFx0Y29uc3QgZmluZEluZGV4ID0gcmVjZW50VGFza3MuZmluZEluZGV4KCh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gKHdvcmtzcGFjZUZvbGRlciAmJiBkZWZpbml0aW9uICYmIHZhbHVlLmdldFdvcmtzcGFjZUZvbGRlcigpPy51cmkudG9TdHJpbmcoKSA9PT0gd29ya3NwYWNlRm9sZGVyXG5cdFx0XHRcdFx0JiYgKCh2YWx1ZS5nZXREZWZpbml0aW9uKCk/Ll9rZXkgPT09IGRlZmluaXRpb24pIHx8ICh2YWx1ZS50eXBlID09PSB0eXBlICYmIHZhbHVlLl9sYWJlbCA9PT0gbGFiZWwpKSlcblx0XHRcdFx0XHR8fCAocmVjZW50S2V5ICYmIHZhbHVlLmdldEtleSgpID09PSByZWNlbnRLZXkpO1xuXHRcdFx0fSk7XG5cdFx0XHRpZiAoZmluZEluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRkZWR1cGVkQ29uZmlndXJlZFRhc2tzLnB1c2goY29uZmlndXJlZFRhc2tzW2pdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlY2VudFRhc2tzW2ZpbmRJbmRleF0gPSBjb25maWd1cmVkVGFza3Nbal07XG5cdFx0XHRcdGZvdW5kUmVjZW50VGFza3NbZmluZEluZGV4XSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGRlZHVwZWRDb25maWd1cmVkVGFza3MgPSBkZWR1cGVkQ29uZmlndXJlZFRhc2tzLnNvcnQoKGEsIGIpID0+IHRoaXMuX3NvcnRlci5jb21wYXJlKGEsIGIpKTtcblx0XHRjb25zdCBwcnVuZWRSZWNlbnRUYXNrczogKFRhc2sgfCBDb25maWd1cmluZ1Rhc2spW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlY2VudFRhc2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAoZm91bmRSZWNlbnRUYXNrc1tpXSB8fCBDb25maWd1cmluZ1Rhc2suaXMocmVjZW50VGFza3NbaV0pKSB7XG5cdFx0XHRcdHBydW5lZFJlY2VudFRhc2tzLnB1c2gocmVjZW50VGFza3NbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4geyBjb25maWd1cmVkVGFza3M6IGRlZHVwZWRDb25maWd1cmVkVGFza3MsIHJlY2VudFRhc2tzOiBwcnVuZWRSZWNlbnRUYXNrcyB9O1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldFRvcExldmVsRW50cmllcyhkZWZhdWx0RW50cnk/OiBJVGFza1F1aWNrUGlja0VudHJ5KTogUHJvbWlzZTx7IGVudHJpZXM6IFF1aWNrUGlja0lucHV0PElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeT5bXTsgaXNTaW5nbGVDb25maWd1cmVkPzogVGFzayB8IENvbmZpZ3VyaW5nVGFzayB9PiB7XG5cdFx0aWYgKHRoaXMuX3RvcExldmVsRW50cmllcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4geyBlbnRyaWVzOiB0aGlzLl90b3BMZXZlbEVudHJpZXMgfTtcblx0XHR9XG5cdFx0bGV0IHJlY2VudFRhc2tzOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXSA9IChhd2FpdCB0aGlzLl90YXNrU2VydmljZS5nZXRTYXZlZFRhc2tzKCdoaXN0b3JpY2FsJykpLnJldmVyc2UoKTtcblx0XHRjb25zdCBjb25maWd1cmVkVGFza3M6IChUYXNrIHwgQ29uZmlndXJpbmdUYXNrKVtdID0gdGhpcy5faGFuZGxlRm9sZGVyVGFza1Jlc3VsdChhd2FpdCB0aGlzLl90YXNrU2VydmljZS5nZXRXb3Jrc3BhY2VUYXNrcygpKTtcblx0XHRjb25zdCBleHRlbnNpb25UYXNrVHlwZXMgPSB0aGlzLl90YXNrU2VydmljZS50YXNrVHlwZXMoKTtcblx0XHR0aGlzLl90b3BMZXZlbEVudHJpZXMgPSBbXTtcblx0XHQvLyBEZWR1cGUgd2lsbCB1cGRhdGUgcmVjZW50IHRhc2tzIGlmIHRoZXkndmUgY2hhbmdlZCBpbiB0YXNrcy5qc29uLlxuXHRcdGNvbnN0IGRlZHVwZUFuZFBydW5lID0gdGhpcy5fZGVkdXBlQ29uZmlndXJlZEFuZFJlY2VudChyZWNlbnRUYXNrcywgY29uZmlndXJlZFRhc2tzKTtcblx0XHRjb25zdCBkZWR1cGVkQ29uZmlndXJlZFRhc2tzOiAoVGFzayB8IENvbmZpZ3VyaW5nVGFzaylbXSA9IGRlZHVwZUFuZFBydW5lLmNvbmZpZ3VyZWRUYXNrcztcblx0XHRyZWNlbnRUYXNrcyA9IGRlZHVwZUFuZFBydW5lLnJlY2VudFRhc2tzO1xuXHRcdGlmIChyZWNlbnRUYXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCByZW1vdmVSZWNlbnRCdXR0b246IElRdWlja0lucHV0QnV0dG9uID0ge1xuXHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShyZW1vdmVUYXNrSWNvbiksXG5cdFx0XHRcdHRvb2x0aXA6IG5scy5sb2NhbGl6ZSgncmVtb3ZlUmVjZW50JywgJ1JlbW92ZSBSZWNlbnRseSBVc2VkIFRhc2snKVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX2NyZWF0ZUVudHJpZXNGb3JHcm91cCh0aGlzLl90b3BMZXZlbEVudHJpZXMsIHJlY2VudFRhc2tzLCBubHMubG9jYWxpemUoJ3JlY2VudGx5VXNlZCcsICdyZWNlbnRseSB1c2VkJyksIFtyZW1vdmVSZWNlbnRCdXR0b25dKTtcblx0XHR9XG5cdFx0aWYgKGNvbmZpZ3VyZWRUYXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAoZGVkdXBlZENvbmZpZ3VyZWRUYXNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMuX2NyZWF0ZUVudHJpZXNGb3JHcm91cCh0aGlzLl90b3BMZXZlbEVudHJpZXMsIGRlZHVwZWRDb25maWd1cmVkVGFza3MsIG5scy5sb2NhbGl6ZSgnY29uZmlndXJlZCcsICdjb25maWd1cmVkJykpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChkZWZhdWx0RW50cnkgJiYgKGNvbmZpZ3VyZWRUYXNrcy5sZW5ndGggPT09IDApKSB7XG5cdFx0XHR0aGlzLl90b3BMZXZlbEVudHJpZXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbmxzLmxvY2FsaXplKCdjb25maWd1cmVkJywgJ2NvbmZpZ3VyZWQnKSB9KTtcblx0XHRcdHRoaXMuX3RvcExldmVsRW50cmllcy5wdXNoKGRlZmF1bHRFbnRyeSk7XG5cdFx0fVxuXG5cdFx0aWYgKGV4dGVuc2lvblRhc2tUeXBlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9jcmVhdGVUeXBlRW50cmllcyh0aGlzLl90b3BMZXZlbEVudHJpZXMsIGV4dGVuc2lvblRhc2tUeXBlcyk7XG5cdFx0fVxuXHRcdHJldHVybiB7IGVudHJpZXM6IHRoaXMuX3RvcExldmVsRW50cmllcywgaXNTaW5nbGVDb25maWd1cmVkOiBjb25maWd1cmVkVGFza3MubGVuZ3RoID09PSAxID8gY29uZmlndXJlZFRhc2tzWzBdIDogdW5kZWZpbmVkIH07XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgaGFuZGxlU2V0dGluZ09wdGlvbihzZWxlY3RlZFR5cGU6IHN0cmluZykge1xuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnVGFza1F1aWNrUGljay5jaGFuZ2VTZXR0aW5nRGV0YWlscycsXG5cdFx0XHRcdFwiVGFzayBkZXRlY3Rpb24gZm9yIHswfSB0YXNrcyBjYXVzZXMgZmlsZXMgaW4gYW55IHdvcmtzcGFjZSB5b3Ugb3BlbiB0byBiZSBydW4gYXMgY29kZS4gRW5hYmxpbmcgezB9IHRhc2sgZGV0ZWN0aW9uIGlzIGEgdXNlciBzZXR0aW5nIGFuZCB3aWxsIGFwcGx5IHRvIGFueSB3b3Jrc3BhY2UgeW91IG9wZW4uIFxcblxcbiBEbyB5b3Ugd2FudCB0byBlbmFibGUgezB9IHRhc2sgZGV0ZWN0aW9uIGZvciBhbGwgd29ya3NwYWNlcz9cIiwgc2VsZWN0ZWRUeXBlKSxcblx0XHRcdGNhbmNlbEJ1dHRvbjogbmxzLmxvY2FsaXplKCdUYXNrUXVpY2tQaWNrLmNoYW5nZVNldHRpbmdObycsIFwiTm9cIilcblx0XHR9KTtcblx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShgJHtzZWxlY3RlZFR5cGV9LmF1dG9EZXRlY3RgLCAnb24nKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dCgoKSA9PiByZXNvbHZlKCksIDEwMCkpO1xuXHRcdFx0cmV0dXJuIHRoaXMuc2hvdyhubHMubG9jYWxpemUoJ1Rhc2tTZXJ2aWNlLnBpY2tSdW5UYXNrJywgJ1NlbGVjdCB0aGUgdGFzayB0byBydW4nKSwgdW5kZWZpbmVkLCBzZWxlY3RlZFR5cGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHNob3cocGxhY2VIb2xkZXI6IHN0cmluZywgZGVmYXVsdEVudHJ5PzogSVRhc2tRdWlja1BpY2tFbnRyeSwgc3RhcnRBdFR5cGU/OiBzdHJpbmcsIG5hbWU/OiBzdHJpbmcpOiBQcm9taXNlPFRhc2sgfCB1bmRlZmluZWQgfCBudWxsPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcGlja2VyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnk+KHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cdFx0cGlja2VyLnBsYWNlaG9sZGVyID0gcGxhY2VIb2xkZXI7XG5cdFx0cGlja2VyLm1hdGNoT25EZXNjcmlwdGlvbiA9IHRydWU7XG5cdFx0cGlja2VyLmlnbm9yZUZvY3VzT3V0ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHBpY2tlci5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKGFzeW5jIChjb250ZXh0KSA9PiB7XG5cdFx0XHRjb25zdCB0YXNrID0gY29udGV4dC5pdGVtLnRhc2s7XG5cdFx0XHRpZiAoY29udGV4dC5idXR0b24uaWNvbkNsYXNzID09PSBUaGVtZUljb24uYXNDbGFzc05hbWUocmVtb3ZlVGFza0ljb24pKSB7XG5cdFx0XHRcdGNvbnN0IGtleSA9ICh0YXNrICYmICFUeXBlcy5pc1N0cmluZyh0YXNrKSkgPyB0YXNrLmdldEtleSgpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoa2V5KSB7XG5cdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UucmVtb3ZlUmVjZW50bHlVc2VkVGFzayhrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGluZGV4VG9SZW1vdmUgPSBwaWNrZXIuaXRlbXMuaW5kZXhPZihjb250ZXh0Lml0ZW0pO1xuXHRcdFx0XHRpZiAoaW5kZXhUb1JlbW92ZSA+PSAwKSB7XG5cdFx0XHRcdFx0cGlja2VyLml0ZW1zID0gWy4uLnBpY2tlci5pdGVtcy5zbGljZSgwLCBpbmRleFRvUmVtb3ZlKSwgLi4ucGlja2VyLml0ZW1zLnNsaWNlKGluZGV4VG9SZW1vdmUgKyAxKV07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoY29udGV4dC5idXR0b24uaWNvbkNsYXNzID09PSBUaGVtZUljb24uYXNDbGFzc05hbWUoY29uZmlndXJlVGFza0ljb24pKSB7XG5cdFx0XHRcdHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmNhbmNlbCgpO1xuXHRcdFx0XHRpZiAoQ29udHJpYnV0ZWRUYXNrLmlzKHRhc2spKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGFza1NlcnZpY2UuY3VzdG9taXplKHRhc2ssIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoQ3VzdG9tVGFzay5pcyh0YXNrKSB8fCBDb25maWd1cmluZ1Rhc2suaXModGFzaykpIHtcblx0XHRcdFx0XHRsZXQgY2FuT3BlbkNvbmZpZzogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjYW5PcGVuQ29uZmlnID0gYXdhaXQgdGhpcy5fdGFza1NlcnZpY2Uub3BlbkNvbmZpZyh0YXNrKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHQvLyBkbyBub3RoaW5nLlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoIWNhbk9wZW5Db25maWcpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Rhc2tTZXJ2aWNlLmN1c3RvbWl6ZSh0YXNrLCB1bmRlZmluZWQsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRpZiAobmFtZSkge1xuXHRcdFx0cGlja2VyLnZhbHVlID0gbmFtZTtcblx0XHR9XG5cdFx0bGV0IGZpcnN0TGV2ZWxUYXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrIHwgc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbCA9IHN0YXJ0QXRUeXBlO1xuXHRcdGlmICghZmlyc3RMZXZlbFRhc2spIHtcblx0XHRcdC8vIEZpcnN0IHNob3cgcmVjZW50IHRhc2tzIGNvbmZpZ3VyZWQgdGFza3MuIE90aGVyIHRhc2tzIHdpbGwgYmUgYXZhaWxhYmxlIGF0IGEgc2Vjb25kIGxldmVsXG5cdFx0XHRjb25zdCB0b3BMZXZlbEVudHJpZXNSZXN1bHQgPSBhd2FpdCB0aGlzLmdldFRvcExldmVsRW50cmllcyhkZWZhdWx0RW50cnkpO1xuXHRcdFx0aWYgKHRvcExldmVsRW50cmllc1Jlc3VsdC5pc1NpbmdsZUNvbmZpZ3VyZWQgJiYgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oUVVJQ0tPUEVOX1NLSVBfQ09ORklHKSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLl90b1Rhc2sodG9wTGV2ZWxFbnRyaWVzUmVzdWx0LmlzU2luZ2xlQ29uZmlndXJlZCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0YXNrUXVpY2tQaWNrRW50cmllczogUXVpY2tQaWNrSW5wdXQ8SVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5PltdID0gdG9wTGV2ZWxFbnRyaWVzUmVzdWx0LmVudHJpZXM7XG5cdFx0XHRmaXJzdExldmVsVGFzayA9IGF3YWl0IHRoaXMuX2RvUGlja2VyRmlyc3RMZXZlbChwaWNrZXIsIHRhc2tRdWlja1BpY2tFbnRyaWVzLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXHRcdGRvIHtcblx0XHRcdGlmIChUeXBlcy5pc1N0cmluZyhmaXJzdExldmVsVGFzaykpIHtcblx0XHRcdFx0aWYgKG5hbWUpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9kb1BpY2tlckZpcnN0TGV2ZWwocGlja2VyLCAoYXdhaXQgdGhpcy5nZXRUb3BMZXZlbEVudHJpZXMoZGVmYXVsdEVudHJ5KSkuZW50cmllcywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGVkRW50cnkgPSBhd2FpdCB0aGlzLmRvUGlja2VyU2Vjb25kTGV2ZWwocGlja2VyLCBkaXNwb3NhYmxlcywgZmlyc3RMZXZlbFRhc2spO1xuXHRcdFx0XHQvLyBQcm9jZWVkIHRvIHNlY29uZCBsZXZlbCBvZiBxdWljayBwaWNrXG5cdFx0XHRcdGlmIChzZWxlY3RlZEVudHJ5ICYmICFzZWxlY3RlZEVudHJ5LnNldHRpbmdUeXBlICYmIHNlbGVjdGVkRW50cnkudGFzayA9PT0gbnVsbCkge1xuXHRcdFx0XHRcdC8vIFRoZSB1c2VyIGhhcyBjaG9zZW4gdG8gZ28gYmFjayB0byB0aGUgZmlyc3QgbGV2ZWxcblx0XHRcdFx0XHRwaWNrZXIudmFsdWUgPSAnJztcblx0XHRcdFx0XHRmaXJzdExldmVsVGFzayA9IGF3YWl0IHRoaXMuX2RvUGlja2VyRmlyc3RMZXZlbChwaWNrZXIsIChhd2FpdCB0aGlzLmdldFRvcExldmVsRW50cmllcyhkZWZhdWx0RW50cnkpKS5lbnRyaWVzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2VsZWN0ZWRFbnRyeSAmJiBUeXBlcy5pc1N0cmluZyhzZWxlY3RlZEVudHJ5LnNldHRpbmdUeXBlKSkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5oYW5kbGVTZXR0aW5nT3B0aW9uKHNlbGVjdGVkRW50cnkuc2V0dGluZ1R5cGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm4gKHNlbGVjdGVkRW50cnk/LnRhc2sgJiYgIVR5cGVzLmlzU3RyaW5nKHNlbGVjdGVkRW50cnk/LnRhc2spKSA/IHRoaXMuX3RvVGFzayhzZWxlY3RlZEVudHJ5Py50YXNrKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChmaXJzdExldmVsVGFzaykge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLl90b1Rhc2soZmlyc3RMZXZlbFRhc2spO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RMZXZlbFRhc2s7XG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoMSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblxuXG5cdHByaXZhdGUgYXN5bmMgX2RvUGlja2VyRmlyc3RMZXZlbChwaWNrZXI6IElRdWlja1BpY2s8SVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5LCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT4sIHRhc2tRdWlja1BpY2tFbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnk+W10sIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBQcm9taXNlPFRhc2sgfCBDb25maWd1cmluZ1Rhc2sgfCBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkPiB7XG5cdFx0cGlja2VyLml0ZW1zID0gdGFza1F1aWNrUGlja0VudHJpZXM7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNob3dXaXRoUGlubmVkSXRlbXModGhpcy5fc3RvcmFnZVNlcnZpY2UsIHJ1blRhc2tTdG9yYWdlS2V5LCBwaWNrZXIsIHRydWUpKTtcblx0XHRjb25zdCBmaXJzdExldmVsUGlja2VyUmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2U8SVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5IHwgdW5kZWZpbmVkIHwgbnVsbD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZShwaWNrZXIub25EaWRBY2NlcHQpKGFzeW5jICgpID0+IHtcblx0XHRcdFx0cmVzb2x2ZShwaWNrZXIuc2VsZWN0ZWRJdGVtcyA/IHBpY2tlci5zZWxlY3RlZEl0ZW1zWzBdIDogdW5kZWZpbmVkKTtcblx0XHRcdH0pKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gZmlyc3RMZXZlbFBpY2tlclJlc3VsdD8udGFzaztcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBkb1BpY2tlclNlY29uZExldmVsKHBpY2tlcjogSVF1aWNrUGljazxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnksIHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9PiwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgdHlwZTogc3RyaW5nLCBuYW1lPzogc3RyaW5nKSB7XG5cdFx0cGlja2VyLmJ1c3kgPSB0cnVlO1xuXHRcdGlmICh0eXBlID09PSBTSE9XX0FMTCkge1xuXHRcdFx0Y29uc3QgaXRlbXMgPSAoYXdhaXQgdGhpcy5fdGFza1NlcnZpY2UudGFza3MoKSkuZmlsdGVyKHQgPT4gIXQuY29uZmlndXJhdGlvblByb3BlcnRpZXMuaGlkZSkuc29ydCgoYSwgYikgPT4gdGhpcy5fc29ydGVyLmNvbXBhcmUoYSwgYikpLm1hcCh0YXNrID0+IHRoaXMuX2NyZWF0ZVRhc2tFbnRyeSh0YXNrKSk7XG5cdFx0XHRpdGVtcy5wdXNoKC4uLlRhc2tRdWlja1BpY2suYWxsU2V0dGluZ0VudHJpZXModGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0XHRcdHBpY2tlci5pdGVtcyA9IGl0ZW1zO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRwaWNrZXIudmFsdWUgPSBuYW1lIHx8ICcnO1xuXHRcdFx0cGlja2VyLml0ZW1zID0gYXdhaXQgdGhpcy5fZ2V0RW50cmllc0ZvclByb3ZpZGVyKHR5cGUpO1xuXHRcdH1cblx0XHRhd2FpdCBwaWNrZXIuc2hvdygpO1xuXHRcdHBpY2tlci5idXN5ID0gZmFsc2U7XG5cdFx0Y29uc3Qgc2Vjb25kTGV2ZWxQaWNrZXJSZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZTxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnkgfCB1bmRlZmluZWQgfCBudWxsPihyZXNvbHZlID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKHBpY2tlci5vbkRpZEFjY2VwdCkoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHBpY2tlci5zZWxlY3RlZEl0ZW1zID8gcGlja2VyLnNlbGVjdGVkSXRlbXNbMF0gOiB1bmRlZmluZWQpO1xuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBzZWNvbmRMZXZlbFBpY2tlclJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYWxsU2V0dGluZ0VudHJpZXMoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IChJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnkgJiB7IHNldHRpbmdUeXBlOiBzdHJpbmcgfSlbXSB7XG5cdFx0Y29uc3QgZW50cmllczogKElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeSAmIHsgc2V0dGluZ1R5cGU6IHN0cmluZyB9KVtdID0gW107XG5cdFx0Y29uc3QgZ3J1bnRFbnRyeSA9IFRhc2tRdWlja1BpY2suZ2V0U2V0dGluZ0VudHJ5KGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCAnZ3J1bnQnKTtcblx0XHRpZiAoZ3J1bnRFbnRyeSkge1xuXHRcdFx0ZW50cmllcy5wdXNoKGdydW50RW50cnkpO1xuXHRcdH1cblx0XHRjb25zdCBndWxwRW50cnkgPSBUYXNrUXVpY2tQaWNrLmdldFNldHRpbmdFbnRyeShjb25maWd1cmF0aW9uU2VydmljZSwgJ2d1bHAnKTtcblx0XHRpZiAoZ3VscEVudHJ5KSB7XG5cdFx0XHRlbnRyaWVzLnB1c2goZ3VscEVudHJ5KTtcblx0XHR9XG5cdFx0Y29uc3QgamFrZUVudHJ5ID0gVGFza1F1aWNrUGljay5nZXRTZXR0aW5nRW50cnkoY29uZmlndXJhdGlvblNlcnZpY2UsICdqYWtlJyk7XG5cdFx0aWYgKGpha2VFbnRyeSkge1xuXHRcdFx0ZW50cmllcy5wdXNoKGpha2VFbnRyeSk7XG5cdFx0fVxuXHRcdHJldHVybiBlbnRyaWVzO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyBnZXRTZXR0aW5nRW50cnkoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSwgdHlwZTogc3RyaW5nKTogKElUYXNrVHdvTGV2ZWxRdWlja1BpY2tFbnRyeSAmIHsgc2V0dGluZ1R5cGU6IHN0cmluZyB9KSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGAke3R5cGV9LmF1dG9EZXRlY3RgKSA9PT0gJ29mZicpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ1Rhc2tRdWlja1BpY2suY2hhbmdlU2V0dGluZ3NPcHRpb25zJywgXCIkKGdlYXIpIHswfSB0YXNrIGRldGVjdGlvbiBpcyB0dXJuZWQgb2ZmLiBFbmFibGUgezF9IHRhc2sgZGV0ZWN0aW9uLi4uXCIsXG5cdFx0XHRcdFx0dHlwZVswXS50b1VwcGVyQ2FzZSgpICsgdHlwZS5zbGljZSgxKSwgdHlwZSksXG5cdFx0XHRcdHRhc2s6IG51bGwsXG5cdFx0XHRcdHNldHRpbmdUeXBlOiB0eXBlLFxuXHRcdFx0XHRhbHdheXNTaG93OiB0cnVlXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0RW50cmllc0ZvclByb3ZpZGVyKHR5cGU6IHN0cmluZyk6IFByb21pc2U8UXVpY2tQaWNrSW5wdXQ8SVRhc2tUd29MZXZlbFF1aWNrUGlja0VudHJ5PltdPiB7XG5cdFx0Y29uc3QgdGFza3MgPSAoYXdhaXQgdGhpcy5fdGFza1NlcnZpY2UudGFza3MoeyB0eXBlIH0pKS5zb3J0KChhLCBiKSA9PiB0aGlzLl9zb3J0ZXIuY29tcGFyZShhLCBiKSk7XG5cdFx0bGV0IHRhc2tRdWlja1BpY2tFbnRyaWVzOiBRdWlja1BpY2tJbnB1dDxJVGFza1R3b0xldmVsUXVpY2tQaWNrRW50cnk+W10gPSBbXTtcblx0XHRpZiAodGFza3MubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRhc2tzKSB7XG5cdFx0XHRcdGlmICghdGFzay5jb25maWd1cmF0aW9uUHJvcGVydGllcy5oaWRlKSB7XG5cdFx0XHRcdFx0dGFza1F1aWNrUGlja0VudHJpZXMucHVzaCh0aGlzLl9jcmVhdGVUYXNrRW50cnkodGFzaykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0YXNrUXVpY2tQaWNrRW50cmllcy5wdXNoKHtcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcidcblx0XHRcdH0sIHtcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnVGFza1F1aWNrUGljay5nb0JhY2snLCAnR28gYmFjayBcdTIxQTknKSxcblx0XHRcdFx0dGFzazogbnVsbCxcblx0XHRcdFx0YWx3YXlzU2hvdzogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRhc2tRdWlja1BpY2tFbnRyaWVzID0gW3tcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnVGFza1F1aWNrUGljay5ub1Rhc2tzRm9yVHlwZScsICdObyB7MH0gdGFza3MgZm91bmQuIEdvIGJhY2sgXHUyMUE5JywgdHlwZSksXG5cdFx0XHRcdHRhc2s6IG51bGwsXG5cdFx0XHRcdGFsd2F5c1Nob3c6IHRydWVcblx0XHRcdH1dO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNldHRpbmdFbnRyeSA9IFRhc2tRdWlja1BpY2suZ2V0U2V0dGluZ0VudHJ5KHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0eXBlKTtcblx0XHRpZiAoc2V0dGluZ0VudHJ5KSB7XG5cdFx0XHR0YXNrUXVpY2tQaWNrRW50cmllcy5wdXNoKHNldHRpbmdFbnRyeSk7XG5cdFx0fVxuXHRcdHJldHVybiB0YXNrUXVpY2tQaWNrRW50cmllcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3RvVGFzayh0YXNrOiBUYXNrIHwgQ29uZmlndXJpbmdUYXNrKTogUHJvbWlzZTxUYXNrIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFDb25maWd1cmluZ1Rhc2suaXModGFzaykpIHtcblx0XHRcdHJldHVybiB0YXNrO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc29sdmVkVGFzayA9IGF3YWl0IHRoaXMuX3Rhc2tTZXJ2aWNlLnRyeVJlc29sdmVUYXNrKHRhc2spO1xuXG5cdFx0aWYgKCFyZXNvbHZlZFRhc2spIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IobmxzLmxvY2FsaXplKCdub1Byb3ZpZGVyRm9yVGFzaycsIFwiVGhlcmUgaXMgbm8gdGFzayBwcm92aWRlciByZWdpc3RlcmVkIGZvciB0YXNrcyBvZiB0eXBlIFxcXCJ7MH1cXFwiLlwiLCB0YXNrLnR5cGUpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc29sdmVkVGFzaztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxhQUFhO0FBQ3pCLFNBQWUsaUJBQWlCLFlBQVksdUJBQXdEO0FBRXBHLFlBQVksV0FBVztBQUN2QixTQUFTLG9CQUFnRDtBQUN6RCxTQUF3RSwwQkFBMEI7QUFDbEcsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxZQUFZLHVCQUFvQztBQUN6RCxTQUFTLGFBQWE7QUFDdEIsU0FBUyxzQkFBc0IsZ0JBQWdCO0FBQy9DLFNBQVMsZUFBZTtBQUN4QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQWUsK0JBQStCO0FBRXZELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCO0FBRXpCLE1BQU0sMEJBQTBCO0FBQ2hDLE1BQU0sd0JBQXdCO0FBQzlCLFNBQVMsa0JBQWtCLFFBQW1FO0FBQ3BHLFNBQU8sU0FBUztBQUNqQjtBQVdBLE1BQU0sV0FBbUIsSUFBSSxTQUFTLHlCQUF5QixtQkFBbUI7QUFFM0UsTUFBTSxvQkFBb0IsYUFBYSx3QkFBd0IsUUFBUSxNQUFNLElBQUksU0FBUyxxQkFBcUIsaURBQWlELENBQUM7QUFDeEssTUFBTSxpQkFBaUIsYUFBYSxnQkFBZ0IsUUFBUSxPQUFPLElBQUksU0FBUyxrQkFBa0IsOENBQThDLENBQUM7QUFFakosTUFBTSxvQkFBb0I7QUFFbkIsSUFBTSxnQkFBTixjQUE0QixXQUFXO0FBQUEsRUFHN0MsWUFDdUIsY0FDUyx1QkFDSCxvQkFDRSxzQkFDUCxlQUNDLGdCQUNDLGlCQUFrQztBQUMzRCxVQUFNO0FBUGdCO0FBQ1M7QUFDSDtBQUNFO0FBQ1A7QUFDQztBQUNDO0FBRXpCLFNBQUssVUFBVSxLQUFLLGFBQWEsYUFBYTtBQUFBLEVBQy9DO0FBQUEsRUFFUSxjQUF1QjtBQUU5QixXQUFPLENBQUMsQ0FBQyxLQUFLLHNCQUFzQixTQUFTLHVCQUF1QjtBQUFBLEVBQ3JFO0FBQUEsRUFFUSxnQkFBZ0IsTUFBc0M7QUFDN0QsUUFBSSxLQUFLLFFBQVE7QUFDaEIsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUNBLFFBQUksZ0JBQWdCLEdBQUcsSUFBSSxHQUFHO0FBQzdCLFVBQUksUUFBZ0IsS0FBSyxXQUFXO0FBQ3BDLFlBQU0sYUFBMkMsUUFBUSxVQUFVLEtBQUssVUFBVTtBQUNsRixhQUFPLFdBQVcsTUFBTTtBQUN4QixhQUFPLFdBQVcsTUFBTTtBQUN4QixhQUFPLEtBQUssVUFBVSxFQUFFLFFBQVEsU0FBTyxTQUFTLEtBQUssV0FBVyxHQUFHLENBQUMsRUFBRTtBQUN0RSxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFjLHFCQUFxQixNQUE4QixZQUE2QjtBQUM3RixVQUFNLFFBQVEsY0FBYyxLQUFLO0FBQ2pDLFVBQU0sT0FBTyxLQUFLLHdCQUF3QjtBQUMxQyxRQUFJLENBQUMsTUFBTTtBQUNWLGFBQU8sR0FBRyxLQUFLO0FBQUEsSUFDaEI7QUFDQSxXQUFPLEtBQUssS0FBSyxLQUFLLEtBQUssRUFBRSxLQUFLLEtBQUssS0FBSyxLQUFLLFFBQVEsTUFBTSxFQUFFLEtBQUssS0FBSztBQUFBLEVBQzVFO0FBQUEsRUFFQSxPQUFjLGlCQUFpQixNQUE4QixPQUE2RCxjQUFzRDtBQUMvSyxRQUFJLEtBQUssd0JBQXdCLE1BQU0sT0FBTztBQUM3QyxZQUFNLGFBQWEsYUFBYSxjQUFjO0FBQzlDLFlBQU0sYUFBYSx3QkFBd0IsVUFBVTtBQUNyRCxZQUFNLGNBQWMsQ0FBQyxjQUFjLEtBQUssd0JBQXdCLEtBQUssS0FBSyxDQUFDO0FBQzNFLGFBQU87QUFBQSxJQUNSO0FBQ0E7QUFBQSxFQUNEO0FBQUEsRUFFUSxpQkFBaUIsTUFBOEIsZUFBb0MsQ0FBQyxHQUFnQztBQUMzSCxVQUFNLFVBQStCO0FBQUEsTUFDcEMsRUFBRSxXQUFXLFVBQVUsWUFBWSxpQkFBaUIsR0FBRyxTQUFTLElBQUksU0FBUyxpQkFBaUIsZ0JBQWdCLEVBQUU7QUFBQSxNQUNoSCxHQUFHO0FBQUEsSUFDSjtBQUNBLFVBQU0sUUFBcUMsRUFBRSxPQUFPLGNBQWMscUJBQXFCLE1BQU0sS0FBSyxnQkFBZ0IsSUFBSSxDQUFDLEdBQUcsYUFBYSxLQUFLLGFBQWEsbUJBQW1CLElBQUksR0FBRyxNQUFNLFFBQVEsS0FBSyxZQUFZLElBQUksS0FBSyx3QkFBd0IsU0FBUyxRQUFXLFFBQVE7QUFDL1EsVUFBTSxhQUFhLGNBQWMsaUJBQWlCLE1BQU0sT0FBTyxLQUFLLGFBQWE7QUFDakYsUUFBSSxZQUFZO0FBQ2YsV0FBSyxVQUFVLFVBQVU7QUFBQSxJQUMxQjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx1QkFBdUIsU0FBd0QsT0FDdEYsWUFBb0IsZUFBb0MsQ0FBQyxHQUFHO0FBQzVELFlBQVEsS0FBSyxFQUFFLE1BQU0sYUFBYSxPQUFPLFdBQVcsQ0FBQztBQUNyRCxVQUFNLFFBQVEsVUFBUTtBQUNyQixVQUFJLENBQUMsS0FBSyx3QkFBd0IsTUFBTTtBQUN2QyxnQkFBUSxLQUFLLEtBQUssaUJBQWlCLE1BQU0sWUFBWSxDQUFDO0FBQUEsTUFDdkQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxtQkFBbUIsU0FBd0QsT0FBaUI7QUFDbkcsWUFBUSxLQUFLLEVBQUUsTUFBTSxhQUFhLE9BQU8sSUFBSSxTQUFTLG9CQUFvQixhQUFhLEVBQUUsQ0FBQztBQUMxRixVQUFNLFFBQVEsVUFBUTtBQUNyQixjQUFRLEtBQUssRUFBRSxPQUFPLGFBQWEsSUFBSSxJQUFJLE1BQU0sTUFBTSxXQUFXLElBQUksU0FBUyxZQUFZLGlCQUFpQixJQUFJLEVBQUUsQ0FBQztBQUFBLElBQ3BILENBQUM7QUFDRCxZQUFRLEtBQUssRUFBRSxPQUFPLFVBQVUsTUFBTSxVQUFVLFlBQVksS0FBSyxDQUFDO0FBQUEsRUFDbkU7QUFBQSxFQUVRLHdCQUF3QixRQUE2RTtBQUM1RyxVQUFNLFFBQW9DLENBQUM7QUFDM0MsVUFBTSxLQUFLLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxLQUFLLFdBQVcsTUFBTTtBQUNsRCxVQUFJLFlBQVksS0FBSztBQUNwQixjQUFNLEtBQUssR0FBRyxZQUFZLElBQUksS0FBSztBQUFBLE1BQ3BDO0FBQ0EsVUFBSSxZQUFZLGdCQUFnQjtBQUMvQixtQkFBVyxpQkFBaUIsWUFBWSxlQUFlLGNBQWM7QUFDcEUsZ0JBQU0sS0FBSyxZQUFZLGVBQWUsYUFBYSxhQUFhLENBQUM7QUFBQSxRQUNsRTtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsMkJBQTJCLGFBQXlDLGlCQUF1STtBQUNsTixRQUFJLHlCQUFxRCxDQUFDO0FBQzFELFVBQU0sbUJBQThCLE1BQU0sWUFBWSxNQUFNLEVBQUUsS0FBSyxLQUFLO0FBQ3hFLGFBQVMsSUFBSSxHQUFHLElBQUksZ0JBQWdCLFFBQVEsS0FBSztBQUNoRCxZQUFNLGtCQUFrQixnQkFBZ0IsQ0FBQyxFQUFFLG1CQUFtQixHQUFHLElBQUksU0FBUztBQUM5RSxZQUFNLGFBQWEsZ0JBQWdCLENBQUMsRUFBRSxjQUFjLEdBQUc7QUFDdkQsWUFBTSxPQUFPLGdCQUFnQixDQUFDLEVBQUU7QUFDaEMsWUFBTSxRQUFRLGdCQUFnQixDQUFDLEVBQUU7QUFDakMsWUFBTSxZQUFZLGdCQUFnQixDQUFDLEVBQUUsT0FBTztBQUM1QyxZQUFNLFlBQVksWUFBWSxVQUFVLENBQUMsVUFBVTtBQUNsRCxlQUFRLG1CQUFtQixjQUFjLE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxTQUFTLE1BQU0sb0JBQ2xGLE1BQU0sY0FBYyxHQUFHLFNBQVMsY0FBZ0IsTUFBTSxTQUFTLFFBQVEsTUFBTSxXQUFXLFVBQ3pGLGFBQWEsTUFBTSxPQUFPLE1BQU07QUFBQSxNQUN0QyxDQUFDO0FBQ0QsVUFBSSxjQUFjLElBQUk7QUFDckIsK0JBQXVCLEtBQUssZ0JBQWdCLENBQUMsQ0FBQztBQUFBLE1BQy9DLE9BQU87QUFDTixvQkFBWSxTQUFTLElBQUksZ0JBQWdCLENBQUM7QUFDMUMseUJBQWlCLFNBQVMsSUFBSTtBQUFBLE1BQy9CO0FBQUEsSUFDRDtBQUNBLDZCQUF5Qix1QkFBdUIsS0FBSyxDQUFDLEdBQUcsTUFBTSxLQUFLLFFBQVEsUUFBUSxHQUFHLENBQUMsQ0FBQztBQUN6RixVQUFNLG9CQUFnRCxDQUFDO0FBQ3ZELGFBQVMsSUFBSSxHQUFHLElBQUksWUFBWSxRQUFRLEtBQUs7QUFDNUMsVUFBSSxpQkFBaUIsQ0FBQyxLQUFLLGdCQUFnQixHQUFHLFlBQVksQ0FBQyxDQUFDLEdBQUc7QUFDOUQsMEJBQWtCLEtBQUssWUFBWSxDQUFDLENBQUM7QUFBQSxNQUN0QztBQUFBLElBQ0Q7QUFDQSxXQUFPLEVBQUUsaUJBQWlCLHdCQUF3QixhQUFhLGtCQUFrQjtBQUFBLEVBQ2xGO0FBQUEsRUFFQSxNQUFhLG1CQUFtQixjQUFzSjtBQUNyTCxRQUFJLEtBQUsscUJBQXFCLFFBQVc7QUFDeEMsYUFBTyxFQUFFLFNBQVMsS0FBSyxpQkFBaUI7QUFBQSxJQUN6QztBQUNBLFFBQUksZUFBMkMsTUFBTSxLQUFLLGFBQWEsY0FBYyxZQUFZLEdBQUcsUUFBUTtBQUM1RyxVQUFNLGtCQUE4QyxLQUFLLHdCQUF3QixNQUFNLEtBQUssYUFBYSxrQkFBa0IsQ0FBQztBQUM1SCxVQUFNLHFCQUFxQixLQUFLLGFBQWEsVUFBVTtBQUN2RCxTQUFLLG1CQUFtQixDQUFDO0FBRXpCLFVBQU0saUJBQWlCLEtBQUssMkJBQTJCLGFBQWEsZUFBZTtBQUNuRixVQUFNLHlCQUFxRCxlQUFlO0FBQzFFLGtCQUFjLGVBQWU7QUFDN0IsUUFBSSxZQUFZLFNBQVMsR0FBRztBQUMzQixZQUFNLHFCQUF3QztBQUFBLFFBQzdDLFdBQVcsVUFBVSxZQUFZLGNBQWM7QUFBQSxRQUMvQyxTQUFTLElBQUksU0FBUyxnQkFBZ0IsMkJBQTJCO0FBQUEsTUFDbEU7QUFDQSxXQUFLLHVCQUF1QixLQUFLLGtCQUFrQixhQUFhLElBQUksU0FBUyxnQkFBZ0IsZUFBZSxHQUFHLENBQUMsa0JBQWtCLENBQUM7QUFBQSxJQUNwSTtBQUNBLFFBQUksZ0JBQWdCLFNBQVMsR0FBRztBQUMvQixVQUFJLHVCQUF1QixTQUFTLEdBQUc7QUFDdEMsYUFBSyx1QkFBdUIsS0FBSyxrQkFBa0Isd0JBQXdCLElBQUksU0FBUyxjQUFjLFlBQVksQ0FBQztBQUFBLE1BQ3BIO0FBQUEsSUFDRDtBQUVBLFFBQUksZ0JBQWlCLGdCQUFnQixXQUFXLEdBQUk7QUFDbkQsV0FBSyxpQkFBaUIsS0FBSyxFQUFFLE1BQU0sYUFBYSxPQUFPLElBQUksU0FBUyxjQUFjLFlBQVksRUFBRSxDQUFDO0FBQ2pHLFdBQUssaUJBQWlCLEtBQUssWUFBWTtBQUFBLElBQ3hDO0FBRUEsUUFBSSxtQkFBbUIsU0FBUyxHQUFHO0FBQ2xDLFdBQUssbUJBQW1CLEtBQUssa0JBQWtCLGtCQUFrQjtBQUFBLElBQ2xFO0FBQ0EsV0FBTyxFQUFFLFNBQVMsS0FBSyxrQkFBa0Isb0JBQW9CLGdCQUFnQixXQUFXLElBQUksZ0JBQWdCLENBQUMsSUFBSSxPQUFVO0FBQUEsRUFDNUg7QUFBQSxFQUVBLE1BQWEsb0JBQW9CLGNBQXNCO0FBQ3RELFVBQU0sRUFBRSxVQUFVLElBQUksTUFBTSxLQUFLLGVBQWUsUUFBUTtBQUFBLE1BQ3ZELE1BQU0sU0FBUztBQUFBLE1BQ2YsU0FBUyxJQUFJO0FBQUEsUUFBUztBQUFBLFFBQ3JCO0FBQUEsUUFBb1A7QUFBQSxNQUFZO0FBQUEsTUFDalEsY0FBYyxJQUFJLFNBQVMsaUNBQWlDLElBQUk7QUFBQSxJQUNqRSxDQUFDO0FBQ0QsUUFBSSxXQUFXO0FBQ2QsWUFBTSxLQUFLLHNCQUFzQixZQUFZLEdBQUcsWUFBWSxlQUFlLElBQUk7QUFDL0UsWUFBTSxJQUFJLFFBQWMsYUFBVyxXQUFXLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQztBQUNuRSxhQUFPLEtBQUssS0FBSyxJQUFJLFNBQVMsMkJBQTJCLHdCQUF3QixHQUFHLFFBQVcsWUFBWTtBQUFBLElBQzVHO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWEsS0FBSyxhQUFxQixjQUFvQyxhQUFzQixNQUFpRDtBQUNqSixVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsVUFBTSxTQUFTLFlBQVksSUFBSSxLQUFLLG1CQUFtQixnQkFBNkMsRUFBRSxlQUFlLEtBQUssQ0FBQyxDQUFDO0FBQzVILFdBQU8sY0FBYztBQUNyQixXQUFPLHFCQUFxQjtBQUM1QixXQUFPLGlCQUFpQjtBQUN4QixnQkFBWSxJQUFJLE9BQU8sdUJBQXVCLE9BQU8sWUFBWTtBQUNoRSxZQUFNLE9BQU8sUUFBUSxLQUFLO0FBQzFCLFVBQUksUUFBUSxPQUFPLGNBQWMsVUFBVSxZQUFZLGNBQWMsR0FBRztBQUN2RSxjQUFNLE1BQU8sUUFBUSxDQUFDLE1BQU0sU0FBUyxJQUFJLElBQUssS0FBSyxPQUFPLElBQUk7QUFDOUQsWUFBSSxLQUFLO0FBQ1IsZUFBSyxhQUFhLHVCQUF1QixHQUFHO0FBQUEsUUFDN0M7QUFDQSxjQUFNLGdCQUFnQixPQUFPLE1BQU0sUUFBUSxRQUFRLElBQUk7QUFDdkQsWUFBSSxpQkFBaUIsR0FBRztBQUN2QixpQkFBTyxRQUFRLENBQUMsR0FBRyxPQUFPLE1BQU0sTUFBTSxHQUFHLGFBQWEsR0FBRyxHQUFHLE9BQU8sTUFBTSxNQUFNLGdCQUFnQixDQUFDLENBQUM7QUFBQSxRQUNsRztBQUFBLE1BQ0QsV0FBVyxRQUFRLE9BQU8sY0FBYyxVQUFVLFlBQVksaUJBQWlCLEdBQUc7QUFDakYsYUFBSyxtQkFBbUIsT0FBTztBQUMvQixZQUFJLGdCQUFnQixHQUFHLElBQUksR0FBRztBQUM3QixlQUFLLGFBQWEsVUFBVSxNQUFNLFFBQVcsSUFBSTtBQUFBLFFBQ2xELFdBQVcsV0FBVyxHQUFHLElBQUksS0FBSyxnQkFBZ0IsR0FBRyxJQUFJLEdBQUc7QUFDM0QsY0FBSSxnQkFBeUI7QUFDN0IsY0FBSTtBQUNILDRCQUFnQixNQUFNLEtBQUssYUFBYSxXQUFXLElBQUk7QUFBQSxVQUN4RCxTQUFTLEdBQUc7QUFBQSxVQUVaO0FBQ0EsY0FBSSxDQUFDLGVBQWU7QUFDbkIsaUJBQUssYUFBYSxVQUFVLE1BQU0sUUFBVyxJQUFJO0FBQUEsVUFDbEQ7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsUUFBSSxNQUFNO0FBQ1QsYUFBTyxRQUFRO0FBQUEsSUFDaEI7QUFDQSxRQUFJLGlCQUFxRTtBQUN6RSxRQUFJLENBQUMsZ0JBQWdCO0FBRXBCLFlBQU0sd0JBQXdCLE1BQU0sS0FBSyxtQkFBbUIsWUFBWTtBQUN4RSxVQUFJLHNCQUFzQixzQkFBc0IsS0FBSyxzQkFBc0IsU0FBa0IscUJBQXFCLEdBQUc7QUFDcEgsb0JBQVksUUFBUTtBQUNwQixlQUFPLEtBQUssUUFBUSxzQkFBc0Isa0JBQWtCO0FBQUEsTUFDN0Q7QUFDQSxZQUFNLHVCQUFzRSxzQkFBc0I7QUFDbEcsdUJBQWlCLE1BQU0sS0FBSyxvQkFBb0IsUUFBUSxzQkFBc0IsV0FBVztBQUFBLElBQzFGO0FBQ0EsT0FBRztBQUNGLFVBQUksTUFBTSxTQUFTLGNBQWMsR0FBRztBQUNuQyxZQUFJLE1BQU07QUFDVCxnQkFBTSxLQUFLLG9CQUFvQixTQUFTLE1BQU0sS0FBSyxtQkFBbUIsWUFBWSxHQUFHLFNBQVMsV0FBVztBQUN6RyxzQkFBWSxRQUFRO0FBQ3BCLGlCQUFPO0FBQUEsUUFDUjtBQUNBLGNBQU0sZ0JBQWdCLE1BQU0sS0FBSyxvQkFBb0IsUUFBUSxhQUFhLGNBQWM7QUFFeEYsWUFBSSxpQkFBaUIsQ0FBQyxjQUFjLGVBQWUsY0FBYyxTQUFTLE1BQU07QUFFL0UsaUJBQU8sUUFBUTtBQUNmLDJCQUFpQixNQUFNLEtBQUssb0JBQW9CLFNBQVMsTUFBTSxLQUFLLG1CQUFtQixZQUFZLEdBQUcsU0FBUyxXQUFXO0FBQUEsUUFDM0gsV0FBVyxpQkFBaUIsTUFBTSxTQUFTLGNBQWMsV0FBVyxHQUFHO0FBQ3RFLHNCQUFZLFFBQVE7QUFDcEIsaUJBQU8sS0FBSyxvQkFBb0IsY0FBYyxXQUFXO0FBQUEsUUFDMUQsT0FBTztBQUNOLHNCQUFZLFFBQVE7QUFDcEIsaUJBQVEsZUFBZSxRQUFRLENBQUMsTUFBTSxTQUFTLGVBQWUsSUFBSSxJQUFLLEtBQUssUUFBUSxlQUFlLElBQUksSUFBSTtBQUFBLFFBQzVHO0FBQUEsTUFDRCxXQUFXLGdCQUFnQjtBQUMxQixvQkFBWSxRQUFRO0FBQ3BCLGVBQU8sS0FBSyxRQUFRLGNBQWM7QUFBQSxNQUNuQyxPQUFPO0FBQ04sb0JBQVksUUFBUTtBQUNwQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsU0FBUztBQUNUO0FBQUEsRUFDRDtBQUFBLEVBSUEsTUFBYyxvQkFBb0IsUUFBMEUsc0JBQXFFLGFBQTJGO0FBQzNRLFdBQU8sUUFBUTtBQUNmLGdCQUFZLElBQUksb0JBQW9CLEtBQUssaUJBQWlCLG1CQUFtQixRQUFRLElBQUksQ0FBQztBQUMxRixVQUFNLHlCQUF5QixNQUFNLElBQUksUUFBd0QsYUFBVztBQUMzRyxrQkFBWSxJQUFJLE1BQU0sS0FBSyxPQUFPLFdBQVcsRUFBRSxZQUFZO0FBQzFELGdCQUFRLE9BQU8sZ0JBQWdCLE9BQU8sY0FBYyxDQUFDLElBQUksTUFBUztBQUFBLE1BQ25FLENBQUMsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUNELFdBQU8sd0JBQXdCO0FBQUEsRUFDaEM7QUFBQSxFQUVBLE1BQWEsb0JBQW9CLFFBQTBFLGFBQThCLE1BQWMsTUFBZTtBQUNySyxXQUFPLE9BQU87QUFDZCxRQUFJLFNBQVMsVUFBVTtBQUN0QixZQUFNLFNBQVMsTUFBTSxLQUFLLGFBQWEsTUFBTSxHQUFHLE9BQU8sT0FBSyxDQUFDLEVBQUUsd0JBQXdCLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLEtBQUssUUFBUSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxVQUFRLEtBQUssaUJBQWlCLElBQUksQ0FBQztBQUMvSyxZQUFNLEtBQUssR0FBRyxjQUFjLGtCQUFrQixLQUFLLHFCQUFxQixDQUFDO0FBQ3pFLGFBQU8sUUFBUTtBQUFBLElBQ2hCLE9BQU87QUFDTixhQUFPLFFBQVEsUUFBUTtBQUN2QixhQUFPLFFBQVEsTUFBTSxLQUFLLHVCQUF1QixJQUFJO0FBQUEsSUFDdEQ7QUFDQSxVQUFNLE9BQU8sS0FBSztBQUNsQixXQUFPLE9BQU87QUFDZCxVQUFNLDBCQUEwQixNQUFNLElBQUksUUFBd0QsYUFBVztBQUM1RyxrQkFBWSxJQUFJLE1BQU0sS0FBSyxPQUFPLFdBQVcsRUFBRSxZQUFZO0FBQzFELGdCQUFRLE9BQU8sZ0JBQWdCLE9BQU8sY0FBYyxDQUFDLElBQUksTUFBUztBQUFBLE1BQ25FLENBQUMsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFjLGtCQUFrQixzQkFBd0c7QUFDdkksVUFBTSxVQUFxRSxDQUFDO0FBQzVFLFVBQU0sYUFBYSxjQUFjLGdCQUFnQixzQkFBc0IsT0FBTztBQUM5RSxRQUFJLFlBQVk7QUFDZixjQUFRLEtBQUssVUFBVTtBQUFBLElBQ3hCO0FBQ0EsVUFBTSxZQUFZLGNBQWMsZ0JBQWdCLHNCQUFzQixNQUFNO0FBQzVFLFFBQUksV0FBVztBQUNkLGNBQVEsS0FBSyxTQUFTO0FBQUEsSUFDdkI7QUFDQSxVQUFNLFlBQVksY0FBYyxnQkFBZ0Isc0JBQXNCLE1BQU07QUFDNUUsUUFBSSxXQUFXO0FBQ2QsY0FBUSxLQUFLLFNBQVM7QUFBQSxJQUN2QjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFjLGdCQUFnQixzQkFBNkMsTUFBbUY7QUFDN0osUUFBSSxxQkFBcUIsU0FBUyxHQUFHLElBQUksYUFBYSxNQUFNLE9BQU87QUFDbEUsYUFBTztBQUFBLFFBQ04sT0FBTyxJQUFJO0FBQUEsVUFBUztBQUFBLFVBQXVDO0FBQUEsVUFDMUQsS0FBSyxDQUFDLEVBQUUsWUFBWSxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQUEsVUFBRztBQUFBLFFBQUk7QUFBQSxRQUM1QyxNQUFNO0FBQUEsUUFDTixhQUFhO0FBQUEsUUFDYixZQUFZO0FBQUEsTUFDYjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyx1QkFBdUIsTUFBc0U7QUFDMUcsVUFBTSxTQUFTLE1BQU0sS0FBSyxhQUFhLE1BQU0sRUFBRSxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxNQUFNLEtBQUssUUFBUSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ2pHLFFBQUksdUJBQXNFLENBQUM7QUFDM0UsUUFBSSxNQUFNLFNBQVMsR0FBRztBQUNyQixpQkFBVyxRQUFRLE9BQU87QUFDekIsWUFBSSxDQUFDLEtBQUssd0JBQXdCLE1BQU07QUFDdkMsK0JBQXFCLEtBQUssS0FBSyxpQkFBaUIsSUFBSSxDQUFDO0FBQUEsUUFDdEQ7QUFBQSxNQUNEO0FBQ0EsMkJBQXFCLEtBQUs7QUFBQSxRQUN6QixNQUFNO0FBQUEsTUFDUCxHQUFHO0FBQUEsUUFDRixPQUFPLElBQUksU0FBUyx3QkFBd0IsZ0JBQVc7QUFBQSxRQUN2RCxNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sNkJBQXVCLENBQUM7QUFBQSxRQUN2QixPQUFPLElBQUksU0FBUyxnQ0FBZ0Msc0NBQWlDLElBQUk7QUFBQSxRQUN6RixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsTUFDYixDQUFDO0FBQUEsSUFDRjtBQUVBLFVBQU0sZUFBZSxjQUFjLGdCQUFnQixLQUFLLHVCQUF1QixJQUFJO0FBQ25GLFFBQUksY0FBYztBQUNqQiwyQkFBcUIsS0FBSyxZQUFZO0FBQUEsSUFDdkM7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxRQUFRLE1BQXlEO0FBQzlFLFFBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLEdBQUc7QUFDOUIsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLGVBQWUsTUFBTSxLQUFLLGFBQWEsZUFBZSxJQUFJO0FBRWhFLFFBQUksQ0FBQyxjQUFjO0FBQ2xCLFdBQUsscUJBQXFCLE1BQU0sSUFBSSxTQUFTLHFCQUFxQixpRUFBbUUsS0FBSyxJQUFJLENBQUM7QUFBQSxJQUNoSjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUEvV2EsZ0JBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FWVTsiLAogICJuYW1lcyI6IFtdCn0K
