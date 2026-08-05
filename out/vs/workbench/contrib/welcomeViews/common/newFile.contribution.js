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
import { promiseWithResolvers } from "../../../../base/common/async.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, IMenuService, MenuId, registerAction2, MenuRegistry, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
const builtInSource = localize("Built-In", "Built-In");
const category = localize2("Create", "Create");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "welcome.showNewFileEntries",
      title: localize2("welcome.newFile", "New File..."),
      category,
      f1: true,
      keybinding: {
        primary: KeyMod.Alt + KeyMod.CtrlCmd + KeyMod.WinCtrl + KeyCode.KeyN,
        weight: KeybindingWeight.WorkbenchContrib
      },
      menu: {
        id: MenuId.MenubarFileMenu,
        group: "1_new",
        order: 2
      }
    });
  }
  async run(accessor) {
    return assertIsDefined(NewFileTemplatesManager.Instance).run();
  }
});
let NewFileTemplatesManager = class extends Disposable {
  constructor(quickInputService, contextKeyService, commandService, keybindingService, menuService) {
    super();
    this.quickInputService = quickInputService;
    this.contextKeyService = contextKeyService;
    this.commandService = commandService;
    this.keybindingService = keybindingService;
    NewFileTemplatesManager.Instance = this;
    this._register({ dispose() {
      if (NewFileTemplatesManager.Instance === this) {
        NewFileTemplatesManager.Instance = void 0;
      }
    } });
    this.menu = menuService.createMenu(MenuId.NewFile, contextKeyService);
  }
  allEntries() {
    const items = [];
    for (const [groupName, group] of this.menu.getActions({ renderShortTitle: true })) {
      for (const action of group) {
        if (action instanceof MenuItemAction) {
          items.push({ commandID: action.item.id, from: action.item.source?.title ?? builtInSource, title: action.label, group: groupName });
        }
      }
    }
    return items;
  }
  async run() {
    const entries = this.allEntries();
    if (entries.length === 0) {
      throw Error("Unexpected empty new items list");
    } else if (entries.length === 1) {
      this.commandService.executeCommand(entries[0].commandID);
      return true;
    } else {
      return this.selectNewEntry(entries);
    }
  }
  async selectNewEntry(entries) {
    const { promise: resultPromise, resolve: resolveResult } = promiseWithResolvers();
    const disposables = new DisposableStore();
    const qp = this.quickInputService.createQuickPick({ useSeparators: true });
    qp.title = localize("newFileTitle", "New File...");
    qp.placeholder = localize("newFilePlaceholder", "Select File Type or Enter File Name...");
    qp.sortByLabel = false;
    qp.matchOnDetail = true;
    qp.matchOnDescription = true;
    const sortCategories = (a, b) => {
      const categoryPriority = { "file": 1, "notebook": 2 };
      if (categoryPriority[a.group] && categoryPriority[b.group]) {
        if (categoryPriority[a.group] !== categoryPriority[b.group]) {
          return categoryPriority[b.group] - categoryPriority[a.group];
        }
      } else if (categoryPriority[a.group]) {
        return 1;
      } else if (categoryPriority[b.group]) {
        return -1;
      }
      if (a.from === builtInSource) {
        return 1;
      }
      if (b.from === builtInSource) {
        return -1;
      }
      return a.from.localeCompare(b.from);
    };
    const displayCategory = {
      "file": localize("file", "File"),
      "notebook": localize("notebook", "Notebook")
    };
    const refreshQp = (entries2) => {
      const items = [];
      let lastSeparator;
      entries2.sort((a, b) => -sortCategories(a, b)).forEach((entry) => {
        const command = entry.commandID;
        const keybinding = this.keybindingService.lookupKeybinding(command || "", this.contextKeyService);
        if (lastSeparator !== entry.group) {
          items.push({
            type: "separator",
            label: displayCategory[entry.group] ?? entry.group
          });
          lastSeparator = entry.group;
        }
        items.push({
          ...entry,
          label: entry.title,
          type: "item",
          keybinding,
          buttons: command ? [
            {
              iconClass: "codicon codicon-gear",
              tooltip: localize("change keybinding", "Configure Keybinding")
            }
          ] : [],
          detail: "",
          description: entry.from
        });
      });
      qp.items = items;
    };
    refreshQp(entries);
    disposables.add(this.menu.onDidChange(() => refreshQp(this.allEntries())));
    disposables.add(qp.onDidChangeValue((val) => {
      if (val === "") {
        refreshQp(entries);
        return;
      }
      const currentTextEntry = {
        commandID: "workbench.action.files.newFile",
        commandArgs: { languageId: void 0, viewType: void 0, fileName: val },
        title: localize("miNewFileWithName", "Create New File ({0})", val),
        group: "file",
        from: builtInSource
      };
      refreshQp([currentTextEntry, ...entries]);
    }));
    disposables.add(qp.onDidAccept(async (e) => {
      const selected = qp.selectedItems[0];
      resolveResult(!!selected);
      qp.hide();
      if (selected) {
        await this.commandService.executeCommand(selected.commandID, selected.commandArgs);
      }
    }));
    disposables.add(qp.onDidHide(() => {
      qp.dispose();
      disposables.dispose();
      resolveResult(false);
    }));
    disposables.add(qp.onDidTriggerItemButton((e) => {
      qp.hide();
      this.commandService.executeCommand("workbench.action.openGlobalKeybindings", e.item.commandID);
      resolveResult(false);
    }));
    qp.show();
    return resultPromise;
  }
};
NewFileTemplatesManager = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IMenuService)
], NewFileTemplatesManager);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NewFileTemplatesManager, LifecyclePhase.Restored);
MenuRegistry.appendMenuItem(MenuId.NewFile, {
  group: "file",
  command: {
    id: "workbench.action.files.newUntitledFile",
    title: localize("miNewFile2", "Text File")
  },
  order: 1
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lVmlld3MvY29tbW9uL25ld0ZpbGUuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgcHJvbWlzZVdpdGhSZXNvbHZlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTG9jYWxpemVkU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiwgSU1lbnUsIE1lbnVSZWdpc3RyeSwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmNvbnN0IGJ1aWx0SW5Tb3VyY2UgPSBsb2NhbGl6ZSgnQnVpbHQtSW4nLCBcIkJ1aWx0LUluXCIpO1xuY29uc3QgY2F0ZWdvcnk6IElMb2NhbGl6ZWRTdHJpbmcgPSBsb2NhbGl6ZTIoJ0NyZWF0ZScsICdDcmVhdGUnKTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd2VsY29tZS5zaG93TmV3RmlsZUVudHJpZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd2VsY29tZS5uZXdGaWxlJywgJ05ldyBGaWxlLi4uJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0ICsgS2V5TW9kLkN0cmxDbWQgKyBLZXlNb2QuV2luQ3RybCArIEtleUNvZGUuS2V5Tixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJGaWxlTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcxX25ldycsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gYXNzZXJ0SXNEZWZpbmVkKE5ld0ZpbGVUZW1wbGF0ZXNNYW5hZ2VyLkluc3RhbmNlKS5ydW4oKTtcblx0fVxufSk7XG5cbnR5cGUgTmV3RmlsZUl0ZW0gPSB7IGNvbW1hbmRJRDogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyBmcm9tOiBzdHJpbmc7IGdyb3VwOiBzdHJpbmc7IGNvbW1hbmRBcmdzPzogYW55IH07XG5jbGFzcyBOZXdGaWxlVGVtcGxhdGVzTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRzdGF0aWMgSW5zdGFuY2U6IE5ld0ZpbGVUZW1wbGF0ZXNNYW5hZ2VyIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgbWVudTogSU1lbnU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0TmV3RmlsZVRlbXBsYXRlc01hbmFnZXIuSW5zdGFuY2UgPSB0aGlzO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoeyBkaXNwb3NlKCkgeyBpZiAoTmV3RmlsZVRlbXBsYXRlc01hbmFnZXIuSW5zdGFuY2UgPT09IHRoaXMpIHsgTmV3RmlsZVRlbXBsYXRlc01hbmFnZXIuSW5zdGFuY2UgPSB1bmRlZmluZWQ7IH0gfSB9KTtcblxuXHRcdHRoaXMubWVudSA9IG1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLk5ld0ZpbGUsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYWxsRW50cmllcygpOiBOZXdGaWxlSXRlbVtdIHtcblx0XHRjb25zdCBpdGVtczogTmV3RmlsZUl0ZW1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgW2dyb3VwTmFtZSwgZ3JvdXBdIG9mIHRoaXMubWVudS5nZXRBY3Rpb25zKHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9KSkge1xuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgZ3JvdXApIHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0aXRlbXMucHVzaCh7IGNvbW1hbmRJRDogYWN0aW9uLml0ZW0uaWQsIGZyb206IGFjdGlvbi5pdGVtLnNvdXJjZT8udGl0bGUgPz8gYnVpbHRJblNvdXJjZSwgdGl0bGU6IGFjdGlvbi5sYWJlbCwgZ3JvdXA6IGdyb3VwTmFtZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gaXRlbXM7XG5cdH1cblxuXHRhc3luYyBydW4oKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMuYWxsRW50cmllcygpO1xuXHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ1VuZXhwZWN0ZWQgZW1wdHkgbmV3IGl0ZW1zIGxpc3QnKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoZW50cmllcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZW50cmllc1swXS5jb21tYW5kSUQpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2VsZWN0TmV3RW50cnkoZW50cmllcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZWxlY3ROZXdFbnRyeShlbnRyaWVzOiBOZXdGaWxlSXRlbVtdKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgeyBwcm9taXNlOiByZXN1bHRQcm9taXNlLCByZXNvbHZlOiByZXNvbHZlUmVzdWx0IH0gPSBwcm9taXNlV2l0aFJlc29sdmVyczxib29sZWFuPigpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcXAgPSB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljayh7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSk7XG5cdFx0cXAudGl0bGUgPSBsb2NhbGl6ZSgnbmV3RmlsZVRpdGxlJywgXCJOZXcgRmlsZS4uLlwiKTtcblx0XHRxcC5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCduZXdGaWxlUGxhY2Vob2xkZXInLCBcIlNlbGVjdCBGaWxlIFR5cGUgb3IgRW50ZXIgRmlsZSBOYW1lLi4uXCIpO1xuXHRcdHFwLnNvcnRCeUxhYmVsID0gZmFsc2U7XG5cdFx0cXAubWF0Y2hPbkRldGFpbCA9IHRydWU7XG5cdFx0cXAubWF0Y2hPbkRlc2NyaXB0aW9uID0gdHJ1ZTtcblxuXHRcdGNvbnN0IHNvcnRDYXRlZ29yaWVzID0gKGE6IE5ld0ZpbGVJdGVtLCBiOiBOZXdGaWxlSXRlbSk6IG51bWJlciA9PiB7XG5cdFx0XHRjb25zdCBjYXRlZ29yeVByaW9yaXR5OiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyAnZmlsZSc6IDEsICdub3RlYm9vayc6IDIgfTtcblx0XHRcdGlmIChjYXRlZ29yeVByaW9yaXR5W2EuZ3JvdXBdICYmIGNhdGVnb3J5UHJpb3JpdHlbYi5ncm91cF0pIHtcblx0XHRcdFx0aWYgKGNhdGVnb3J5UHJpb3JpdHlbYS5ncm91cF0gIT09IGNhdGVnb3J5UHJpb3JpdHlbYi5ncm91cF0pIHtcblx0XHRcdFx0XHRyZXR1cm4gY2F0ZWdvcnlQcmlvcml0eVtiLmdyb3VwXSAtIGNhdGVnb3J5UHJpb3JpdHlbYS5ncm91cF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNhdGVnb3J5UHJpb3JpdHlbYS5ncm91cF0pIHsgcmV0dXJuIDE7IH1cblx0XHRcdGVsc2UgaWYgKGNhdGVnb3J5UHJpb3JpdHlbYi5ncm91cF0pIHsgcmV0dXJuIC0xOyB9XG5cblx0XHRcdGlmIChhLmZyb20gPT09IGJ1aWx0SW5Tb3VyY2UpIHsgcmV0dXJuIDE7IH1cblx0XHRcdGlmIChiLmZyb20gPT09IGJ1aWx0SW5Tb3VyY2UpIHsgcmV0dXJuIC0xOyB9XG5cblx0XHRcdHJldHVybiBhLmZyb20ubG9jYWxlQ29tcGFyZShiLmZyb20pO1xuXHRcdH07XG5cblx0XHRjb25zdCBkaXNwbGF5Q2F0ZWdvcnk6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG5cdFx0XHQnZmlsZSc6IGxvY2FsaXplKCdmaWxlJywgXCJGaWxlXCIpLFxuXHRcdFx0J25vdGVib29rJzogbG9jYWxpemUoJ25vdGVib29rJywgXCJOb3RlYm9va1wiKSxcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVmcmVzaFFwID0gKGVudHJpZXM6IE5ld0ZpbGVJdGVtW10pID0+IHtcblx0XHRcdGNvbnN0IGl0ZW1zOiAoKChJUXVpY2tQaWNrSXRlbSAmIE5ld0ZpbGVJdGVtKSB8IElRdWlja1BpY2tTZXBhcmF0b3IpKVtdID0gW107XG5cdFx0XHRsZXQgbGFzdFNlcGFyYXRvcjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0ZW50cmllc1xuXHRcdFx0XHQuc29ydCgoYSwgYikgPT4gLXNvcnRDYXRlZ29yaWVzKGEsIGIpKVxuXHRcdFx0XHQuZm9yRWFjaCgoZW50cnkpID0+IHtcblx0XHRcdFx0XHRjb25zdCBjb21tYW5kID0gZW50cnkuY29tbWFuZElEO1xuXHRcdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoY29tbWFuZCB8fCAnJywgdGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRcdFx0aWYgKGxhc3RTZXBhcmF0b3IgIT09IGVudHJ5Lmdyb3VwKSB7XG5cdFx0XHRcdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBkaXNwbGF5Q2F0ZWdvcnlbZW50cnkuZ3JvdXBdID8/IGVudHJ5Lmdyb3VwXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGxhc3RTZXBhcmF0b3IgPSBlbnRyeS5ncm91cDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0XHQuLi5lbnRyeSxcblx0XHRcdFx0XHRcdGxhYmVsOiBlbnRyeS50aXRsZSxcblx0XHRcdFx0XHRcdHR5cGU6ICdpdGVtJyxcblx0XHRcdFx0XHRcdGtleWJpbmRpbmcsXG5cdFx0XHRcdFx0XHRidXR0b25zOiBjb21tYW5kID8gW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0aWNvbkNsYXNzOiAnY29kaWNvbiBjb2RpY29uLWdlYXInLFxuXHRcdFx0XHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdjaGFuZ2Uga2V5YmluZGluZycsIFwiQ29uZmlndXJlIEtleWJpbmRpbmdcIilcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XSA6IFtdLFxuXHRcdFx0XHRcdFx0ZGV0YWlsOiAnJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBlbnRyeS5mcm9tLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdHFwLml0ZW1zID0gaXRlbXM7XG5cdFx0fTtcblx0XHRyZWZyZXNoUXAoZW50cmllcyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5tZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHJlZnJlc2hRcCh0aGlzLmFsbEVudHJpZXMoKSkpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxcC5vbkRpZENoYW5nZVZhbHVlKCh2YWw6IHN0cmluZykgPT4ge1xuXHRcdFx0aWYgKHZhbCA9PT0gJycpIHtcblx0XHRcdFx0cmVmcmVzaFFwKGVudHJpZXMpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjdXJyZW50VGV4dEVudHJ5OiBOZXdGaWxlSXRlbSA9IHtcblx0XHRcdFx0Y29tbWFuZElEOiAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5uZXdGaWxlJyxcblx0XHRcdFx0Y29tbWFuZEFyZ3M6IHsgbGFuZ3VhZ2VJZDogdW5kZWZpbmVkLCB2aWV3VHlwZTogdW5kZWZpbmVkLCBmaWxlTmFtZTogdmFsIH0sXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWlOZXdGaWxlV2l0aE5hbWUnLCBcIkNyZWF0ZSBOZXcgRmlsZSAoezB9KVwiLCB2YWwpLFxuXHRcdFx0XHRncm91cDogJ2ZpbGUnLFxuXHRcdFx0XHRmcm9tOiBidWlsdEluU291cmNlLFxuXHRcdFx0fTtcblx0XHRcdHJlZnJlc2hRcChbY3VycmVudFRleHRFbnRyeSwgLi4uZW50cmllc10pO1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxcC5vbkRpZEFjY2VwdChhc3luYyBlID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkID0gcXAuc2VsZWN0ZWRJdGVtc1swXSBhcyAoSVF1aWNrUGlja0l0ZW0gJiBOZXdGaWxlSXRlbSk7XG5cdFx0XHRyZXNvbHZlUmVzdWx0KCEhc2VsZWN0ZWQpO1xuXG5cdFx0XHRxcC5oaWRlKCk7XG5cdFx0XHRpZiAoc2VsZWN0ZWQpIHsgYXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChzZWxlY3RlZC5jb21tYW5kSUQsIHNlbGVjdGVkLmNvbW1hbmRBcmdzKTsgfVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChxcC5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0cXAuZGlzcG9zZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0cmVzb2x2ZVJlc3VsdChmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHFwLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oZSA9PiB7XG5cdFx0XHRxcC5oaWRlKCk7XG5cdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5HbG9iYWxLZXliaW5kaW5ncycsIChlLml0ZW0gYXMgKElRdWlja1BpY2tJdGVtICYgTmV3RmlsZUl0ZW0pKS5jb21tYW5kSUQpO1xuXHRcdFx0cmVzb2x2ZVJlc3VsdChmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0cXAuc2hvdygpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdFByb21pc2U7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihOZXdGaWxlVGVtcGxhdGVzTWFuYWdlciwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk5ld0ZpbGUsIHtcblx0Z3JvdXA6ICdmaWxlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5uZXdVbnRpdGxlZEZpbGUnLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWlOZXdGaWxlMicsIFwiVGV4dCBGaWxlXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxRQUFRLGVBQWU7QUFDaEMsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFVBQVUsaUJBQWlCO0FBRXBDLFNBQVMsU0FBUyxjQUFjLFFBQVEsaUJBQXdCLGNBQWMsc0JBQXNCO0FBQ3BHLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBRW5DLFNBQVMs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
