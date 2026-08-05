import { localize, localize2 } from "../../../../nls.js";
import { URI } from "../../../../base/common/uri.js";
import { Event } from "../../../../base/common/event.js";
import { Schemas } from "../../../../base/common/network.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IWorkingCopyHistoryService } from "../../../services/workingCopy/common/workingCopyHistory.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { LocalHistoryFileSystemProvider } from "./localHistoryFileSystemProvider.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { registerAction2, Action2, MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { basename, basenameOrAuthority, dirname } from "../../../../base/common/resources.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { EditorResourceAccessor, SaveSourceRegistry, SideBySideEditor } from "../../../common/editor.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ActiveEditorContext, ResourceContextKey } from "../../../common/contextkeys.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { getLocalHistoryDateFormatter, LOCAL_HISTORY_ICON_RESTORE, LOCAL_HISTORY_MENU_CONTEXT_KEY } from "./localHistory.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
const LOCAL_HISTORY_CATEGORY = localize2("localHistory.category", "Local History");
const CTX_LOCAL_HISTORY_ENABLED = ContextKeyExpr.has("config.workbench.localHistory.enabled");
const COMPARE_WITH_FILE_LABEL = localize2("localHistory.compareWithFile", "Compare with File");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.compareWithFile",
      title: COMPARE_WITH_FILE_LABEL,
      menu: {
        id: MenuId.TimelineItemContext,
        group: "1_compare",
        order: 1,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const commandService = accessor.get(ICommandService);
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      return commandService.executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, ...toDiffEditorArguments(entry, entry.workingCopy.resource));
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.compareWithPrevious",
      title: localize2("localHistory.compareWithPrevious", "Compare with Previous"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "1_compare",
        order: 2,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const commandService = accessor.get(ICommandService);
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const editorService = accessor.get(IEditorService);
    const { entry, previous } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      if (!previous) {
        return openEntry(entry, editorService);
      }
      return commandService.executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, ...toDiffEditorArguments(previous, entry));
    }
  }
});
let itemSelectedForCompare = void 0;
const LocalHistoryItemSelectedForCompare = new RawContextKey("localHistoryItemSelectedForCompare", false, true);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.selectForCompare",
      title: localize2("localHistory.selectForCompare", "Select for Compare"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "2_compare_with",
        order: 2,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const contextKeyService = accessor.get(IContextKeyService);
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      itemSelectedForCompare = item;
      LocalHistoryItemSelectedForCompare.bindTo(contextKeyService).set(true);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.compareWithSelected",
      title: localize2("localHistory.compareWithSelected", "Compare with Selected"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "2_compare_with",
        order: 1,
        when: ContextKeyExpr.and(LOCAL_HISTORY_MENU_CONTEXT_KEY, LocalHistoryItemSelectedForCompare)
      }
    });
  }
  async run(accessor, item) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const commandService = accessor.get(ICommandService);
    if (!itemSelectedForCompare) {
      return;
    }
    const selectedEntry = (await findLocalHistoryEntry(workingCopyHistoryService, itemSelectedForCompare)).entry;
    if (!selectedEntry) {
      return;
    }
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      return commandService.executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, ...toDiffEditorArguments(selectedEntry, entry));
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.open",
      title: localize2("localHistory.open", "Show Contents"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "3_contents",
        order: 1,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const editorService = accessor.get(IEditorService);
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      return openEntry(entry, editorService);
    }
  }
});
const RESTORE_CONTENTS_LABEL = localize2("localHistory.restore", "Restore Contents");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.restoreViaEditor",
      title: RESTORE_CONTENTS_LABEL,
      menu: {
        id: MenuId.EditorTitle,
        group: "navigation",
        order: -10,
        when: ResourceContextKey.Scheme.isEqualTo(LocalHistoryFileSystemProvider.SCHEMA)
      },
      icon: LOCAL_HISTORY_ICON_RESTORE
    });
  }
  async run(accessor, uri) {
    const { associatedResource, location } = LocalHistoryFileSystemProvider.fromLocalHistoryFileSystem(uri);
    return restore(accessor, { uri: associatedResource, handle: basenameOrAuthority(location) });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.restore",
      title: RESTORE_CONTENTS_LABEL,
      menu: {
        id: MenuId.TimelineItemContext,
        group: "3_contents",
        order: 2,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    return restore(accessor, item);
  }
});
const restoreSaveSource = SaveSourceRegistry.registerSource("localHistoryRestore.source", localize("localHistoryRestore.source", "File Restored"));
async function restore(accessor, item) {
  const fileService = accessor.get(IFileService);
  const dialogService = accessor.get(IDialogService);
  const workingCopyService = accessor.get(IWorkingCopyService);
  const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
  const editorService = accessor.get(IEditorService);
  const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
  if (entry) {
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("confirmRestoreMessage", "Do you want to restore the contents of '{0}'?", basename(entry.workingCopy.resource)),
      detail: localize("confirmRestoreDetail", "Restoring will discard any unsaved changes."),
      primaryButton: localize({ key: "restoreButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Restore")
    });
    if (!confirmed) {
      return;
    }
    const workingCopies = workingCopyService.getAll(entry.workingCopy.resource);
    if (workingCopies) {
      for (const workingCopy of workingCopies) {
        if (workingCopy.isDirty()) {
          await workingCopy.revert({ soft: true });
        }
      }
    }
    try {
      await fileService.cloneFile(entry.location, entry.workingCopy.resource);
    } catch (error) {
      await dialogService.error(localize("unableToRestore", "Unable to restore '{0}'.", basename(entry.workingCopy.resource)), toErrorMessage(error));
      return;
    }
    if (workingCopies) {
      for (const workingCopy of workingCopies) {
        await workingCopy.revert({ force: true });
      }
    }
    await editorService.openEditor({ resource: entry.workingCopy.resource });
    await workingCopyHistoryService.addEntry({
      resource: entry.workingCopy.resource,
      source: restoreSaveSource
    }, CancellationToken.None);
    await closeEntry(entry, editorService);
  }
}
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.restoreViaPicker",
      title: localize2("localHistory.restoreViaPicker", "Find Entry to Restore"),
      f1: true,
      category: LOCAL_HISTORY_CATEGORY,
      precondition: CTX_LOCAL_HISTORY_ENABLED
    });
  }
  async run(accessor) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const quickInputService = accessor.get(IQuickInputService);
    const modelService = accessor.get(IModelService);
    const languageService = accessor.get(ILanguageService);
    const labelService = accessor.get(ILabelService);
    const editorService = accessor.get(IEditorService);
    const fileService = accessor.get(IFileService);
    const commandService = accessor.get(ICommandService);
    const historyService = accessor.get(IHistoryService);
    const resourcePickerDisposables = new DisposableStore();
    const resourcePicker = resourcePickerDisposables.add(quickInputService.createQuickPick());
    let cts = new CancellationTokenSource();
    resourcePickerDisposables.add(resourcePicker.onDidHide(() => cts.dispose(true)));
    resourcePicker.busy = true;
    resourcePicker.show();
    const resources = new ResourceSet(await workingCopyHistoryService.getAll(cts.token));
    const recentEditorResources = new ResourceSet(coalesce(historyService.getHistory().map(({ resource: resource2 }) => resource2)));
    const resourcesSortedByRecency = [];
    for (const resource2 of recentEditorResources) {
      if (resources.has(resource2)) {
        resourcesSortedByRecency.push(resource2);
        resources.delete(resource2);
      }
    }
    resourcesSortedByRecency.push(...[...resources].sort((r1, r2) => r1.fsPath < r2.fsPath ? -1 : 1));
    resourcePicker.busy = false;
    resourcePicker.placeholder = localize("restoreViaPicker.filePlaceholder", "Select the file to show local history for");
    resourcePicker.matchOnLabel = true;
    resourcePicker.matchOnDescription = true;
    resourcePicker.items = [...resourcesSortedByRecency].map((resource2) => ({
      resource: resource2,
      label: basenameOrAuthority(resource2),
      description: labelService.getUriLabel(dirname(resource2), { relative: true }),
      iconClasses: getIconClasses(modelService, languageService, resource2)
    }));
    await Event.toPromise(resourcePicker.onDidAccept);
    resourcePickerDisposables.dispose();
    const resource = resourcePicker.selectedItems.at(0)?.resource;
    if (!resource) {
      return;
    }
    const entryPickerDisposables = new DisposableStore();
    const entryPicker = entryPickerDisposables.add(quickInputService.createQuickPick());
    cts = new CancellationTokenSource();
    entryPickerDisposables.add(entryPicker.onDidHide(() => cts.dispose(true)));
    entryPicker.busy = true;
    entryPicker.show();
    const entries = await workingCopyHistoryService.getEntries(resource, cts.token);
    entryPicker.busy = false;
    entryPicker.canAcceptInBackground = true;
    entryPicker.placeholder = localize("restoreViaPicker.entryPlaceholder", "Select the local history entry to open");
    entryPicker.matchOnLabel = true;
    entryPicker.matchOnDescription = true;
    entryPicker.items = Array.from(entries).reverse().map((entry) => ({
      entry,
      label: `$(circle-outline) ${SaveSourceRegistry.getSourceLabel(entry.source)}`,
      description: toLocalHistoryEntryDateLabel(entry.timestamp)
    }));
    entryPickerDisposables.add(entryPicker.onDidAccept(async (e) => {
      if (!e.inBackground) {
        entryPickerDisposables.dispose();
      }
      const selectedItem = entryPicker.selectedItems.at(0);
      if (!selectedItem) {
        return;
      }
      const resourceExists = await fileService.exists(selectedItem.entry.workingCopy.resource);
      if (resourceExists) {
        return commandService.executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, ...toDiffEditorArguments(selectedItem.entry, selectedItem.entry.workingCopy.resource, { preserveFocus: e.inBackground }));
      }
      return openEntry(selectedItem.entry, editorService, { preserveFocus: e.inBackground });
    }));
  }
});
MenuRegistry.appendMenuItem(MenuId.TimelineTitle, { command: { id: "workbench.action.localHistory.restoreViaPicker", title: localize2("localHistory.restoreViaPickerMenu", "Local History: Find Entry to Restore...") }, group: "submenu", order: 1, when: CTX_LOCAL_HISTORY_ENABLED });
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.rename",
      title: localize2("localHistory.rename", "Rename"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "5_edit",
        order: 1,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const quickInputService = accessor.get(IQuickInputService);
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      const disposables = new DisposableStore();
      const inputBox = disposables.add(quickInputService.createInputBox());
      inputBox.title = localize("renameLocalHistoryEntryTitle", "Rename Local History Entry");
      inputBox.ignoreFocusOut = true;
      inputBox.placeholder = localize("renameLocalHistoryPlaceholder", "Enter the new name of the local history entry");
      inputBox.value = SaveSourceRegistry.getSourceLabel(entry.source);
      inputBox.show();
      disposables.add(inputBox.onDidAccept(() => {
        if (inputBox.value) {
          workingCopyHistoryService.updateEntry(entry, { source: inputBox.value }, CancellationToken.None);
        }
        disposables.dispose();
      }));
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.delete",
      title: localize2("localHistory.delete", "Delete"),
      menu: {
        id: MenuId.TimelineItemContext,
        group: "5_edit",
        order: 2,
        when: LOCAL_HISTORY_MENU_CONTEXT_KEY
      }
    });
  }
  async run(accessor, item) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const editorService = accessor.get(IEditorService);
    const dialogService = accessor.get(IDialogService);
    const { entry } = await findLocalHistoryEntry(workingCopyHistoryService, item);
    if (entry) {
      const { confirmed } = await dialogService.confirm({
        type: "warning",
        message: localize("confirmDeleteMessage", "Do you want to delete the local history entry of '{0}' from {1}?", entry.workingCopy.name, toLocalHistoryEntryDateLabel(entry.timestamp)),
        detail: localize("confirmDeleteDetail", "This action is irreversible!"),
        primaryButton: localize({ key: "deleteButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Delete")
      });
      if (!confirmed) {
        return;
      }
      await workingCopyHistoryService.removeEntry(entry, CancellationToken.None);
      await closeEntry(entry, editorService);
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.deleteAll",
      title: localize2("localHistory.deleteAll", "Delete All"),
      f1: true,
      category: LOCAL_HISTORY_CATEGORY,
      precondition: CTX_LOCAL_HISTORY_ENABLED
    });
  }
  async run(accessor) {
    const dialogService = accessor.get(IDialogService);
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const { confirmed } = await dialogService.confirm({
      type: "warning",
      message: localize("confirmDeleteAllMessage", "Do you want to delete all entries of all files in local history?"),
      detail: localize("confirmDeleteAllDetail", "This action is irreversible!"),
      primaryButton: localize({ key: "deleteAllButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Delete All")
    });
    if (!confirmed) {
      return;
    }
    await workingCopyHistoryService.removeAll(CancellationToken.None);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.localHistory.create",
      title: localize2("localHistory.create", "Create Entry"),
      f1: true,
      category: LOCAL_HISTORY_CATEGORY,
      precondition: ContextKeyExpr.and(CTX_LOCAL_HISTORY_ENABLED, ActiveEditorContext)
    });
  }
  async run(accessor) {
    const workingCopyHistoryService = accessor.get(IWorkingCopyHistoryService);
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const labelService = accessor.get(ILabelService);
    const pathService = accessor.get(IPathService);
    const resource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (resource?.scheme !== pathService.defaultUriScheme && resource?.scheme !== Schemas.vscodeUserData) {
      return;
    }
    const disposables = new DisposableStore();
    const inputBox = disposables.add(quickInputService.createInputBox());
    inputBox.title = localize("createLocalHistoryEntryTitle", "Create Local History Entry");
    inputBox.ignoreFocusOut = true;
    inputBox.placeholder = localize("createLocalHistoryPlaceholder", "Enter the new name of the local history entry for '{0}'", labelService.getUriBasenameLabel(resource));
    inputBox.show();
    disposables.add(inputBox.onDidAccept(async () => {
      const entrySource = inputBox.value;
      disposables.dispose();
      if (entrySource) {
        await workingCopyHistoryService.addEntry({ resource, source: inputBox.value }, CancellationToken.None);
      }
    }));
  }
});
async function openEntry(entry, editorService, options) {
  const resource = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: entry.location, associatedResource: entry.workingCopy.resource });
  await editorService.openEditor({
    resource,
    label: localize("localHistoryEditorLabel", "{0} ({1} \u2022 {2})", entry.workingCopy.name, SaveSourceRegistry.getSourceLabel(entry.source), toLocalHistoryEntryDateLabel(entry.timestamp)),
    options
  });
}
async function closeEntry(entry, editorService) {
  const resource = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: entry.location, associatedResource: entry.workingCopy.resource });
  const editors = editorService.findEditors(resource, { supportSideBySide: SideBySideEditor.ANY });
  await editorService.closeEditors(editors, { preserveFocus: true });
}
function toDiffEditorArguments(arg1, arg2, options) {
  const originalResource = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: arg1.location, associatedResource: arg1.workingCopy.resource });
  let label;
  let modifiedResource;
  if (URI.isUri(arg2)) {
    const resource = arg2;
    modifiedResource = resource;
    label = localize("localHistoryCompareToFileEditorLabel", "{0} ({1} \u2022 {2}) \u2194 {3}", arg1.workingCopy.name, SaveSourceRegistry.getSourceLabel(arg1.source), toLocalHistoryEntryDateLabel(arg1.timestamp), arg1.workingCopy.name);
  } else {
    const modified = arg2;
    modifiedResource = LocalHistoryFileSystemProvider.toLocalHistoryFileSystem({ location: modified.location, associatedResource: modified.workingCopy.resource });
    label = localize("localHistoryCompareToPreviousEditorLabel", "{0} ({1} \u2022 {2}) \u2194 {3} ({4} \u2022 {5})", arg1.workingCopy.name, SaveSourceRegistry.getSourceLabel(arg1.source), toLocalHistoryEntryDateLabel(arg1.timestamp), modified.workingCopy.name, SaveSourceRegistry.getSourceLabel(modified.source), toLocalHistoryEntryDateLabel(modified.timestamp));
  }
  return [
    originalResource,
    modifiedResource,
    label,
    options ? [void 0, options] : void 0
  ];
}
async function findLocalHistoryEntry(workingCopyHistoryService, descriptor) {
  const entries = await workingCopyHistoryService.getEntries(descriptor.uri, CancellationToken.None);
  let currentEntry = void 0;
  let previousEntry = void 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.id === descriptor.handle) {
      currentEntry = entry;
      previousEntry = entries[i - 1];
      break;
    }
  }
  return {
    entry: currentEntry,
    previous: previousEntry
  };
}
const SEP = /\//g;
function toLocalHistoryEntryDateLabel(timestamp) {
  return `${getLocalHistoryDateFormatter().format(timestamp).replace(SEP, "-")}`;
}
export {
  COMPARE_WITH_FILE_LABEL,
  findLocalHistoryEntry,
  toDiffEditorArguments
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9sb2NhbEhpc3RvcnkvYnJvd3Nlci9sb2NhbEhpc3RvcnlDb21tYW5kcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeSwgSVdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlIaXN0b3J5LmpzJztcbmltcG9ydCB7IEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBMb2NhbEhpc3RvcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuL2xvY2FsSGlzdG9yeUZpbGVTeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVJZCwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgYmFzZW5hbWVPckF1dGhvcml0eSwgZGlybmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgU2F2ZVNvdXJjZVJlZ2lzdHJ5LCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckNvbnRleHQsIFJlc291cmNlQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBnZXRJY29uQ2xhc3NlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZ2V0SWNvbkNsYXNzZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgZ2V0TG9jYWxIaXN0b3J5RGF0ZUZvcm1hdHRlciwgTE9DQUxfSElTVE9SWV9JQ09OX1JFU1RPUkUsIExPQ0FMX0hJU1RPUllfTUVOVV9DT05URVhUX0tFWSB9IGZyb20gJy4vbG9jYWxIaXN0b3J5LmpzJztcbmltcG9ydCB7IElQYXRoU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhdGgvY29tbW9uL3BhdGhTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hpc3RvcnkvY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuXG5jb25zdCBMT0NBTF9ISVNUT1JZX0NBVEVHT1JZID0gbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkuY2F0ZWdvcnknLCAnTG9jYWwgSGlzdG9yeScpO1xuY29uc3QgQ1RYX0xPQ0FMX0hJU1RPUllfRU5BQkxFRCA9IENvbnRleHRLZXlFeHByLmhhcygnY29uZmlnLndvcmtiZW5jaC5sb2NhbEhpc3RvcnkuZW5hYmxlZCcpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUaW1lbGluZUNvbW1hbmRBcmd1bWVudCB7XG5cdHVyaTogVVJJO1xuXHRoYW5kbGU6IHN0cmluZztcbn1cblxuLy8jcmVnaW9uIENvbXBhcmUgd2l0aCBGaWxlXG5cbmV4cG9ydCBjb25zdCBDT01QQVJFX1dJVEhfRklMRV9MQUJFTCA9IGxvY2FsaXplMignbG9jYWxIaXN0b3J5LmNvbXBhcmVXaXRoRmlsZScsICdDb21wYXJlIHdpdGggRmlsZScpO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmxvY2FsSGlzdG9yeS5jb21wYXJlV2l0aEZpbGUnLFxuXHRcdFx0dGl0bGU6IENPTVBBUkVfV0lUSF9GSUxFX0xBQkVMLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRpbWVsaW5lSXRlbUNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMV9jb21wYXJlJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IExPQ0FMX0hJU1RPUllfTUVOVV9DT05URVhUX0tFWVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaXRlbTogSVRpbWVsaW5lQ29tbWFuZEFyZ3VtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHsgZW50cnkgfSA9IGF3YWl0IGZpbmRMb2NhbEhpc3RvcnlFbnRyeSh3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLCBpdGVtKTtcblx0XHRpZiAoZW50cnkpIHtcblx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lELCAuLi50b0RpZmZFZGl0b3JBcmd1bWVudHMoZW50cnksIGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlKSk7XG5cdFx0fVxuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBDb21wYXJlIHdpdGggUHJldmlvdXNcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sb2NhbEhpc3RvcnkuY29tcGFyZVdpdGhQcmV2aW91cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkuY29tcGFyZVdpdGhQcmV2aW91cycsICdDb21wYXJlIHdpdGggUHJldmlvdXMnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UaW1lbGluZUl0ZW1Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzFfY29tcGFyZScsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR3aGVuOiBMT0NBTF9ISVNUT1JZX01FTlVfQ09OVEVYVF9LRVlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGl0ZW06IElUaW1lbGluZUNvbW1hbmRBcmd1bWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCB7IGVudHJ5LCBwcmV2aW91cyB9ID0gYXdhaXQgZmluZExvY2FsSGlzdG9yeUVudHJ5KHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UsIGl0ZW0pO1xuXHRcdGlmIChlbnRyeSkge1xuXG5cdFx0XHQvLyBXaXRob3V0IGEgcHJldmlvdXMgZW50cnksIGp1c3Qgc2hvdyB0aGUgZW50cnkgZGlyZWN0bHlcblx0XHRcdGlmICghcHJldmlvdXMpIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5FbnRyeShlbnRyeSwgZWRpdG9yU2VydmljZSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIE9wZW4gcmVhbCBkaWZmIGVkaXRvclxuXHRcdFx0cmV0dXJuIGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQsIC4uLnRvRGlmZkVkaXRvckFyZ3VtZW50cyhwcmV2aW91cywgZW50cnkpKTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFNlbGVjdCBmb3IgQ29tcGFyZSAvIENvbXBhcmUgd2l0aCBTZWxlY3RlZFxuXG5sZXQgaXRlbVNlbGVjdGVkRm9yQ29tcGFyZTogSVRpbWVsaW5lQ29tbWFuZEFyZ3VtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5jb25zdCBMb2NhbEhpc3RvcnlJdGVtU2VsZWN0ZWRGb3JDb21wYXJlID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2xvY2FsSGlzdG9yeUl0ZW1TZWxlY3RlZEZvckNvbXBhcmUnLCBmYWxzZSwgdHJ1ZSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9jYWxIaXN0b3J5LnNlbGVjdEZvckNvbXBhcmUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbG9jYWxIaXN0b3J5LnNlbGVjdEZvckNvbXBhcmUnLCAnU2VsZWN0IGZvciBDb21wYXJlJyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGltZWxpbmVJdGVtQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcyX2NvbXBhcmVfd2l0aCcsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR3aGVuOiBMT0NBTF9ISVNUT1JZX01FTlVfQ09OVEVYVF9LRVlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGl0ZW06IElUaW1lbGluZUNvbW1hbmRBcmd1bWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCB7IGVudHJ5IH0gPSBhd2FpdCBmaW5kTG9jYWxIaXN0b3J5RW50cnkod29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSwgaXRlbSk7XG5cdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRpdGVtU2VsZWN0ZWRGb3JDb21wYXJlID0gaXRlbTtcblx0XHRcdExvY2FsSGlzdG9yeUl0ZW1TZWxlY3RlZEZvckNvbXBhcmUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sb2NhbEhpc3RvcnkuY29tcGFyZVdpdGhTZWxlY3RlZCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkuY29tcGFyZVdpdGhTZWxlY3RlZCcsICdDb21wYXJlIHdpdGggU2VsZWN0ZWQnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UaW1lbGluZUl0ZW1Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzJfY29tcGFyZV93aXRoJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChMT0NBTF9ISVNUT1JZX01FTlVfQ09OVEVYVF9LRVksIExvY2FsSGlzdG9yeUl0ZW1TZWxlY3RlZEZvckNvbXBhcmUpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpdGVtOiBJVGltZWxpbmVDb21tYW5kQXJndW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXG5cdFx0aWYgKCFpdGVtU2VsZWN0ZWRGb3JDb21wYXJlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0ZWRFbnRyeSA9IChhd2FpdCBmaW5kTG9jYWxIaXN0b3J5RW50cnkod29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSwgaXRlbVNlbGVjdGVkRm9yQ29tcGFyZSkpLmVudHJ5O1xuXHRcdGlmICghc2VsZWN0ZWRFbnRyeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZW50cnkgfSA9IGF3YWl0IGZpbmRMb2NhbEhpc3RvcnlFbnRyeSh3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLCBpdGVtKTtcblx0XHRpZiAoZW50cnkpIHtcblx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lELCAuLi50b0RpZmZFZGl0b3JBcmd1bWVudHMoc2VsZWN0ZWRFbnRyeSwgZW50cnkpKTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFNob3cgQ29udGVudHNcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sb2NhbEhpc3Rvcnkub3BlbicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3Rvcnkub3BlbicsICdTaG93IENvbnRlbnRzJyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVGltZWxpbmVJdGVtQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICczX2NvbnRlbnRzJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IExPQ0FMX0hJU1RPUllfTUVOVV9DT05URVhUX0tFWVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaXRlbTogSVRpbWVsaW5lQ29tbWFuZEFyZ3VtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCB7IGVudHJ5IH0gPSBhd2FpdCBmaW5kTG9jYWxIaXN0b3J5RW50cnkod29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSwgaXRlbSk7XG5cdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gb3BlbkVudHJ5KGVudHJ5LCBlZGl0b3JTZXJ2aWNlKTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyNyZWdpb24gUmVzdG9yZSBDb250ZW50c1xuXG5jb25zdCBSRVNUT1JFX0NPTlRFTlRTX0xBQkVMID0gbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkucmVzdG9yZScsICdSZXN0b3JlIENvbnRlbnRzJyk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9jYWxIaXN0b3J5LnJlc3RvcmVWaWFFZGl0b3InLFxuXHRcdFx0dGl0bGU6IFJFU1RPUkVfQ09OVEVOVFNfTEFCRUwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAtMTAsXG5cdFx0XHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUuaXNFcXVhbFRvKExvY2FsSGlzdG9yeUZpbGVTeXN0ZW1Qcm92aWRlci5TQ0hFTUEpXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogTE9DQUxfSElTVE9SWV9JQ09OX1JFU1RPUkVcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHVyaTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgeyBhc3NvY2lhdGVkUmVzb3VyY2UsIGxvY2F0aW9uIH0gPSBMb2NhbEhpc3RvcnlGaWxlU3lzdGVtUHJvdmlkZXIuZnJvbUxvY2FsSGlzdG9yeUZpbGVTeXN0ZW0odXJpKTtcblxuXHRcdHJldHVybiByZXN0b3JlKGFjY2Vzc29yLCB7IHVyaTogYXNzb2NpYXRlZFJlc291cmNlLCBoYW5kbGU6IGJhc2VuYW1lT3JBdXRob3JpdHkobG9jYXRpb24pIH0pO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sb2NhbEhpc3RvcnkucmVzdG9yZScsXG5cdFx0XHR0aXRsZTogUkVTVE9SRV9DT05URU5UU19MQUJFTCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UaW1lbGluZUl0ZW1Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzNfY29udGVudHMnLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0d2hlbjogTE9DQUxfSElTVE9SWV9NRU5VX0NPTlRFWFRfS0VZXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpdGVtOiBJVGltZWxpbmVDb21tYW5kQXJndW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gcmVzdG9yZShhY2Nlc3NvciwgaXRlbSk7XG5cdH1cbn0pO1xuXG5jb25zdCByZXN0b3JlU2F2ZVNvdXJjZSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgnbG9jYWxIaXN0b3J5UmVzdG9yZS5zb3VyY2UnLCBsb2NhbGl6ZSgnbG9jYWxIaXN0b3J5UmVzdG9yZS5zb3VyY2UnLCBcIkZpbGUgUmVzdG9yZWRcIikpO1xuXG5hc3luYyBmdW5jdGlvbiByZXN0b3JlKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpdGVtOiBJVGltZWxpbmVDb21tYW5kQXJndW1lbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdGNvbnN0IHdvcmtpbmdDb3B5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlTZXJ2aWNlKTtcblx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdGNvbnN0IHsgZW50cnkgfSA9IGF3YWl0IGZpbmRMb2NhbEhpc3RvcnlFbnRyeSh3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLCBpdGVtKTtcblx0aWYgKGVudHJ5KSB7XG5cblx0XHQvLyBBc2sgZm9yIGNvbmZpcm1hdGlvblxuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1SZXN0b3JlTWVzc2FnZScsIFwiRG8geW91IHdhbnQgdG8gcmVzdG9yZSB0aGUgY29udGVudHMgb2YgJ3swfSc/XCIsIGJhc2VuYW1lKGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlKSksXG5cdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdjb25maXJtUmVzdG9yZURldGFpbCcsIFwiUmVzdG9yaW5nIHdpbGwgZGlzY2FyZCBhbnkgdW5zYXZlZCBjaGFuZ2VzLlwiKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAncmVzdG9yZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmVzdG9yZVwiKVxuXHRcdH0pO1xuXG5cdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZXZlcnQgYWxsIGRpcnR5IHdvcmtpbmcgY29waWVzIGZvciB0YXJnZXRcblx0XHRjb25zdCB3b3JraW5nQ29waWVzID0gd29ya2luZ0NvcHlTZXJ2aWNlLmdldEFsbChlbnRyeS53b3JraW5nQ29weS5yZXNvdXJjZSk7XG5cdFx0aWYgKHdvcmtpbmdDb3BpZXMpIHtcblx0XHRcdGZvciAoY29uc3Qgd29ya2luZ0NvcHkgb2Ygd29ya2luZ0NvcGllcykge1xuXHRcdFx0XHRpZiAod29ya2luZ0NvcHkuaXNEaXJ0eSgpKSB7XG5cdFx0XHRcdFx0YXdhaXQgd29ya2luZ0NvcHkucmV2ZXJ0KHsgc29mdDogdHJ1ZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlcGxhY2UgdGFyZ2V0IHdpdGggY29udGVudHMgb2YgaGlzdG9yeSBlbnRyeVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jbG9uZUZpbGUoZW50cnkubG9jYXRpb24sIGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXG5cdFx0XHQvLyBJdCBpcyBwb3NzaWJsZSB0aGF0IHdlIGZhaWwgdG8gY29weSB0aGUgaGlzdG9yeSBlbnRyeSB0byB0aGVcblx0XHRcdC8vIGRlc3RpbmF0aW9uLCBmb3IgZXhhbXBsZSB3aGVuIHRoZSBkZXN0aW5hdGlvbiBpcyB3cml0ZSBwcm90ZWN0ZWQuXG5cdFx0XHQvLyBJbiB0aGF0IGNhc2UgdGVsbCB0aGUgdXNlciBhbmQgcmV0dXJuLCBpdCBpcyBzdGlsbCBwb3NzaWJsZSBmb3Jcblx0XHRcdC8vIHRoZSB1c2VyIHRvIG1hbnVhbGx5IGNvcHkgdGhlIGNoYW5nZXMgb3ZlciBmcm9tIHRoZSBkaWZmIGVkaXRvci5cblxuXHRcdFx0YXdhaXQgZGlhbG9nU2VydmljZS5lcnJvcihsb2NhbGl6ZSgndW5hYmxlVG9SZXN0b3JlJywgXCJVbmFibGUgdG8gcmVzdG9yZSAnezB9Jy5cIiwgYmFzZW5hbWUoZW50cnkud29ya2luZ0NvcHkucmVzb3VyY2UpKSwgdG9FcnJvck1lc3NhZ2UoZXJyb3IpKTtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlc3RvcmUgYWxsIHdvcmtpbmcgY29waWVzIGZvciB0YXJnZXRcblx0XHRpZiAod29ya2luZ0NvcGllcykge1xuXHRcdFx0Zm9yIChjb25zdCB3b3JraW5nQ29weSBvZiB3b3JraW5nQ29waWVzKSB7XG5cdFx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJldmVydCh7IGZvcmNlOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE9wZW4gdGFyZ2V0XG5cdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlIH0pO1xuXG5cdFx0Ly8gQWRkIG5ldyBlbnRyeVxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UuYWRkRW50cnkoe1xuXHRcdFx0cmVzb3VyY2U6IGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlLFxuXHRcdFx0c291cmNlOiByZXN0b3JlU2F2ZVNvdXJjZVxuXHRcdH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0Ly8gQ2xvc2Ugc291cmNlXG5cdFx0YXdhaXQgY2xvc2VFbnRyeShlbnRyeSwgZWRpdG9yU2VydmljZSk7XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5sb2NhbEhpc3RvcnkucmVzdG9yZVZpYVBpY2tlcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkucmVzdG9yZVZpYVBpY2tlcicsICdGaW5kIEVudHJ5IHRvIFJlc3RvcmUnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IExPQ0FMX0hJU1RPUllfQ0FURUdPUlksXG5cdFx0XHRwcmVjb25kaXRpb246IENUWF9MT0NBTF9ISVNUT1JZX0VOQUJMRURcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdGNvbnN0IG1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTW9kZWxTZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0Y29uc3QgbGFiZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYWJlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCBoaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJSGlzdG9yeVNlcnZpY2UpO1xuXG5cdFx0Ly8gU2hvdyBhbGwgcmVzb3VyY2VzIHdpdGggYXNzb2NpYXRlZCBoaXN0b3J5IGVudHJpZXMgaW4gcGlja2VyXG5cdFx0Ly8gd2l0aCBwcm9ncmVzcyBiZWNhdXNlIHRoaXMgb3BlcmF0aW9uIHdpbGwgdGFrZSBsb25nZXIgdGhlIG1vcmVcblx0XHQvLyBmaWxlcyBoYXZlIGJlZW4gc2F2ZWQgb3ZlcmFsbC5cblx0XHQvL1xuXHRcdC8vIFNvcnQgdGhlIHJlc291cmNlcyBieSBoaXN0b3J5IHRvIHB1dCBtb3JlIHJlbGV2YW50IGVudHJpZXNcblx0XHQvLyB0byB0aGUgdG9wLlxuXG5cdFx0Y29uc3QgcmVzb3VyY2VQaWNrZXJEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCByZXNvdXJjZVBpY2tlciA9IHJlc291cmNlUGlja2VyRGlzcG9zYWJsZXMuYWRkKHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxJUXVpY2tQaWNrSXRlbSAmIHsgcmVzb3VyY2U6IFVSSSB9PigpKTtcblxuXHRcdGxldCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRyZXNvdXJjZVBpY2tlckRpc3Bvc2FibGVzLmFkZChyZXNvdXJjZVBpY2tlci5vbkRpZEhpZGUoKCkgPT4gY3RzLmRpc3Bvc2UodHJ1ZSkpKTtcblxuXHRcdHJlc291cmNlUGlja2VyLmJ1c3kgPSB0cnVlO1xuXHRcdHJlc291cmNlUGlja2VyLnNob3coKTtcblxuXHRcdGNvbnN0IHJlc291cmNlcyA9IG5ldyBSZXNvdXJjZVNldChhd2FpdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLmdldEFsbChjdHMudG9rZW4pKTtcblx0XHRjb25zdCByZWNlbnRFZGl0b3JSZXNvdXJjZXMgPSBuZXcgUmVzb3VyY2VTZXQoY29hbGVzY2UoaGlzdG9yeVNlcnZpY2UuZ2V0SGlzdG9yeSgpLm1hcCgoeyByZXNvdXJjZSB9KSA9PiByZXNvdXJjZSkpKTtcblxuXHRcdGNvbnN0IHJlc291cmNlc1NvcnRlZEJ5UmVjZW5jeTogVVJJW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHJlc291cmNlIG9mIHJlY2VudEVkaXRvclJlc291cmNlcykge1xuXHRcdFx0aWYgKHJlc291cmNlcy5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJlc291cmNlc1NvcnRlZEJ5UmVjZW5jeS5wdXNoKHJlc291cmNlKTtcblx0XHRcdFx0cmVzb3VyY2VzLmRlbGV0ZShyZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJlc291cmNlc1NvcnRlZEJ5UmVjZW5jeS5wdXNoKC4uLlsuLi5yZXNvdXJjZXNdLnNvcnQoKHIxLCByMikgPT4gcjEuZnNQYXRoIDwgcjIuZnNQYXRoID8gLTEgOiAxKSk7XG5cblx0XHRyZXNvdXJjZVBpY2tlci5idXN5ID0gZmFsc2U7XG5cdFx0cmVzb3VyY2VQaWNrZXIucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgncmVzdG9yZVZpYVBpY2tlci5maWxlUGxhY2Vob2xkZXInLCBcIlNlbGVjdCB0aGUgZmlsZSB0byBzaG93IGxvY2FsIGhpc3RvcnkgZm9yXCIpO1xuXHRcdHJlc291cmNlUGlja2VyLm1hdGNoT25MYWJlbCA9IHRydWU7XG5cdFx0cmVzb3VyY2VQaWNrZXIubWF0Y2hPbkRlc2NyaXB0aW9uID0gdHJ1ZTtcblx0XHRyZXNvdXJjZVBpY2tlci5pdGVtcyA9IFsuLi5yZXNvdXJjZXNTb3J0ZWRCeVJlY2VuY3ldLm1hcChyZXNvdXJjZSA9PiAoe1xuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRsYWJlbDogYmFzZW5hbWVPckF1dGhvcml0eShyZXNvdXJjZSksXG5cdFx0XHRkZXNjcmlwdGlvbjogbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGRpcm5hbWUocmVzb3VyY2UpLCB7IHJlbGF0aXZlOiB0cnVlIH0pLFxuXHRcdFx0aWNvbkNsYXNzZXM6IGdldEljb25DbGFzc2VzKG1vZGVsU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlLCByZXNvdXJjZSlcblx0XHR9KSk7XG5cblx0XHRhd2FpdCBFdmVudC50b1Byb21pc2UocmVzb3VyY2VQaWNrZXIub25EaWRBY2NlcHQpO1xuXHRcdHJlc291cmNlUGlja2VyRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSByZXNvdXJjZVBpY2tlci5zZWxlY3RlZEl0ZW1zLmF0KDApPy5yZXNvdXJjZTtcblx0XHRpZiAoIXJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyBhbGwgZW50cmllcyBmb3IgdGhlIHBpY2tlZCByZXNvdXJjZSBpbiBhbm90aGVyIHBpY2tlclxuXHRcdC8vIGFuZCBvcGVuIHRoZSBlbnRyeSBpbiB0aGUgZW5kIHRoYXQgd2FzIHNlbGVjdGVkIGJ5IHRoZSB1c2VyXG5cblx0XHRjb25zdCBlbnRyeVBpY2tlckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVudHJ5UGlja2VyID0gZW50cnlQaWNrZXJEaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElRdWlja1BpY2tJdGVtICYgeyBlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IH0+KCkpO1xuXG5cdFx0Y3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0ZW50cnlQaWNrZXJEaXNwb3NhYmxlcy5hZGQoZW50cnlQaWNrZXIub25EaWRIaWRlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cblx0XHRlbnRyeVBpY2tlci5idXN5ID0gdHJ1ZTtcblx0XHRlbnRyeVBpY2tlci5zaG93KCk7XG5cblx0XHRjb25zdCBlbnRyaWVzID0gYXdhaXQgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZS5nZXRFbnRyaWVzKHJlc291cmNlLCBjdHMudG9rZW4pO1xuXG5cdFx0ZW50cnlQaWNrZXIuYnVzeSA9IGZhbHNlO1xuXHRcdGVudHJ5UGlja2VyLmNhbkFjY2VwdEluQmFja2dyb3VuZCA9IHRydWU7XG5cdFx0ZW50cnlQaWNrZXIucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgncmVzdG9yZVZpYVBpY2tlci5lbnRyeVBsYWNlaG9sZGVyJywgXCJTZWxlY3QgdGhlIGxvY2FsIGhpc3RvcnkgZW50cnkgdG8gb3BlblwiKTtcblx0XHRlbnRyeVBpY2tlci5tYXRjaE9uTGFiZWwgPSB0cnVlO1xuXHRcdGVudHJ5UGlja2VyLm1hdGNoT25EZXNjcmlwdGlvbiA9IHRydWU7XG5cdFx0ZW50cnlQaWNrZXIuaXRlbXMgPSBBcnJheS5mcm9tKGVudHJpZXMpLnJldmVyc2UoKS5tYXAoZW50cnkgPT4gKHtcblx0XHRcdGVudHJ5LFxuXHRcdFx0bGFiZWw6IGAkKGNpcmNsZS1vdXRsaW5lKSAke1NhdmVTb3VyY2VSZWdpc3RyeS5nZXRTb3VyY2VMYWJlbChlbnRyeS5zb3VyY2UpfWAsXG5cdFx0XHRkZXNjcmlwdGlvbjogdG9Mb2NhbEhpc3RvcnlFbnRyeURhdGVMYWJlbChlbnRyeS50aW1lc3RhbXApXG5cdFx0fSkpO1xuXG5cdFx0ZW50cnlQaWNrZXJEaXNwb3NhYmxlcy5hZGQoZW50cnlQaWNrZXIub25EaWRBY2NlcHQoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoIWUuaW5CYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdGVudHJ5UGlja2VyRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzZWxlY3RlZEl0ZW0gPSBlbnRyeVBpY2tlci5zZWxlY3RlZEl0ZW1zLmF0KDApO1xuXHRcdFx0aWYgKCFzZWxlY3RlZEl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXNvdXJjZUV4aXN0cyA9IGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhzZWxlY3RlZEl0ZW0uZW50cnkud29ya2luZ0NvcHkucmVzb3VyY2UpO1xuXHRcdFx0aWYgKHJlc291cmNlRXhpc3RzKSB7XG5cdFx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChBUElfT1BFTl9ESUZGX0VESVRPUl9DT01NQU5EX0lELCAuLi50b0RpZmZFZGl0b3JBcmd1bWVudHMoc2VsZWN0ZWRJdGVtLmVudHJ5LCBzZWxlY3RlZEl0ZW0uZW50cnkud29ya2luZ0NvcHkucmVzb3VyY2UsIHsgcHJlc2VydmVGb2N1czogZS5pbkJhY2tncm91bmQgfSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gb3BlbkVudHJ5KHNlbGVjdGVkSXRlbS5lbnRyeSwgZWRpdG9yU2VydmljZSwgeyBwcmVzZXJ2ZUZvY3VzOiBlLmluQmFja2dyb3VuZCB9KTtcblx0XHR9KSk7XG5cdH1cbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlRpbWVsaW5lVGl0bGUsIHsgY29tbWFuZDogeyBpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9jYWxIaXN0b3J5LnJlc3RvcmVWaWFQaWNrZXInLCB0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkucmVzdG9yZVZpYVBpY2tlck1lbnUnLCAnTG9jYWwgSGlzdG9yeTogRmluZCBFbnRyeSB0byBSZXN0b3JlLi4uJykgfSwgZ3JvdXA6ICdzdWJtZW51Jywgb3JkZXI6IDEsIHdoZW46IENUWF9MT0NBTF9ISVNUT1JZX0VOQUJMRUQgfSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gUmVuYW1lXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9jYWxIaXN0b3J5LnJlbmFtZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkucmVuYW1lJywgJ1JlbmFtZScpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLlRpbWVsaW5lSXRlbUNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnNV9lZGl0Jyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IExPQ0FMX0hJU1RPUllfTUVOVV9DT05URVhUX0tFWVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaXRlbTogSVRpbWVsaW5lQ29tbWFuZEFyZ3VtZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHsgZW50cnkgfSA9IGF3YWl0IGZpbmRMb2NhbEhpc3RvcnlFbnRyeSh3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLCBpdGVtKTtcblx0XHRpZiAoZW50cnkpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgaW5wdXRCb3ggPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlSW5wdXRCb3goKSk7XG5cdFx0XHRpbnB1dEJveC50aXRsZSA9IGxvY2FsaXplKCdyZW5hbWVMb2NhbEhpc3RvcnlFbnRyeVRpdGxlJywgXCJSZW5hbWUgTG9jYWwgSGlzdG9yeSBFbnRyeVwiKTtcblx0XHRcdGlucHV0Qm94Lmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRcdGlucHV0Qm94LnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3JlbmFtZUxvY2FsSGlzdG9yeVBsYWNlaG9sZGVyJywgXCJFbnRlciB0aGUgbmV3IG5hbWUgb2YgdGhlIGxvY2FsIGhpc3RvcnkgZW50cnlcIik7XG5cdFx0XHRpbnB1dEJveC52YWx1ZSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5nZXRTb3VyY2VMYWJlbChlbnRyeS5zb3VyY2UpO1xuXHRcdFx0aW5wdXRCb3guc2hvdygpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Qm94Lm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0aWYgKGlucHV0Qm94LnZhbHVlKSB7XG5cdFx0XHRcdFx0d29ya2luZ0NvcHlIaXN0b3J5U2VydmljZS51cGRhdGVFbnRyeShlbnRyeSwgeyBzb3VyY2U6IGlucHV0Qm94LnZhbHVlIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIERlbGV0ZVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmxvY2FsSGlzdG9yeS5kZWxldGUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbG9jYWxIaXN0b3J5LmRlbGV0ZScsICdEZWxldGUnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5UaW1lbGluZUl0ZW1Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzVfZWRpdCcsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR3aGVuOiBMT0NBTF9ISVNUT1JZX01FTlVfQ09OVEVYVF9LRVlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGl0ZW06IElUaW1lbGluZUNvbW1hbmRBcmd1bWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgeyBlbnRyeSB9ID0gYXdhaXQgZmluZExvY2FsSGlzdG9yeUVudHJ5KHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UsIGl0ZW0pO1xuXHRcdGlmIChlbnRyeSkge1xuXG5cdFx0XHQvLyBBc2sgZm9yIGNvbmZpcm1hdGlvblxuXHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1EZWxldGVNZXNzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBkZWxldGUgdGhlIGxvY2FsIGhpc3RvcnkgZW50cnkgb2YgJ3swfScgZnJvbSB7MX0/XCIsIGVudHJ5LndvcmtpbmdDb3B5Lm5hbWUsIHRvTG9jYWxIaXN0b3J5RW50cnlEYXRlTGFiZWwoZW50cnkudGltZXN0YW1wKSksXG5cdFx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2NvbmZpcm1EZWxldGVEZXRhaWwnLCBcIlRoaXMgYWN0aW9uIGlzIGlycmV2ZXJzaWJsZSFcIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnZGVsZXRlQnV0dG9uTGFiZWwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEZWxldGVcIiksXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZW1vdmUgdmlhIHNlcnZpY2Vcblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UucmVtb3ZlRW50cnkoZW50cnksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0XHQvLyBDbG9zZSBhbnkgb3BlbmVkIGVkaXRvcnNcblx0XHRcdGF3YWl0IGNsb3NlRW50cnkoZW50cnksIGVkaXRvclNlcnZpY2UpO1xuXHRcdH1cblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gRGVsZXRlIEFsbFxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmxvY2FsSGlzdG9yeS5kZWxldGVBbGwnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignbG9jYWxIaXN0b3J5LmRlbGV0ZUFsbCcsICdEZWxldGUgQWxsJyksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBMT0NBTF9ISVNUT1JZX0NBVEVHT1JZLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDVFhfTE9DQUxfSElTVE9SWV9FTkFCTEVEXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cblx0XHQvLyBBc2sgZm9yIGNvbmZpcm1hdGlvblxuXHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1EZWxldGVBbGxNZXNzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBkZWxldGUgYWxsIGVudHJpZXMgb2YgYWxsIGZpbGVzIGluIGxvY2FsIGhpc3Rvcnk/XCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnY29uZmlybURlbGV0ZUFsbERldGFpbCcsIFwiVGhpcyBhY3Rpb24gaXMgaXJyZXZlcnNpYmxlIVwiKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnZGVsZXRlQWxsQnV0dG9uTGFiZWwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZEZWxldGUgQWxsXCIpLFxuXHRcdH0pO1xuXG5cdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgdmlhIHNlcnZpY2Vcblx0XHRhd2FpdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLnJlbW92ZUFsbChDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQ3JlYXRlXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubG9jYWxIaXN0b3J5LmNyZWF0ZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsb2NhbEhpc3RvcnkuY3JlYXRlJywgJ0NyZWF0ZSBFbnRyeScpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogTE9DQUxfSElTVE9SWV9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENUWF9MT0NBTF9ISVNUT1JZX0VOQUJMRUQsIEFjdGl2ZUVkaXRvckNvbnRleHQpXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsYWJlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhYmVsU2VydmljZSk7XG5cdFx0Y29uc3QgcGF0aFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVBhdGhTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdGlmIChyZXNvdXJjZT8uc2NoZW1lICE9PSBwYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lICYmIHJlc291cmNlPy5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlVXNlckRhdGEpIHtcblx0XHRcdHJldHVybjsgLy8gb25seSBlbmFibGUgZm9yIHNlbGVjdGVkIHNjaGVtZXNcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBpbnB1dEJveCA9IGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0U2VydmljZS5jcmVhdGVJbnB1dEJveCgpKTtcblx0XHRpbnB1dEJveC50aXRsZSA9IGxvY2FsaXplKCdjcmVhdGVMb2NhbEhpc3RvcnlFbnRyeVRpdGxlJywgXCJDcmVhdGUgTG9jYWwgSGlzdG9yeSBFbnRyeVwiKTtcblx0XHRpbnB1dEJveC5pZ25vcmVGb2N1c091dCA9IHRydWU7XG5cdFx0aW5wdXRCb3gucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnY3JlYXRlTG9jYWxIaXN0b3J5UGxhY2Vob2xkZXInLCBcIkVudGVyIHRoZSBuZXcgbmFtZSBvZiB0aGUgbG9jYWwgaGlzdG9yeSBlbnRyeSBmb3IgJ3swfSdcIiwgbGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwocmVzb3VyY2UpKTtcblx0XHRpbnB1dEJveC5zaG93KCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Qm94Lm9uRGlkQWNjZXB0KGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVudHJ5U291cmNlID0gaW5wdXRCb3gudmFsdWU7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cblx0XHRcdGlmIChlbnRyeVNvdXJjZSkge1xuXHRcdFx0XHRhd2FpdCB3b3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLmFkZEVudHJ5KHsgcmVzb3VyY2UsIHNvdXJjZTogaW5wdXRCb3gudmFsdWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBIZWxwZXJzXG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW5FbnRyeShlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSwgb3B0aW9ucz86IElFZGl0b3JPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IHJlc291cmNlID0gTG9jYWxIaXN0b3J5RmlsZVN5c3RlbVByb3ZpZGVyLnRvTG9jYWxIaXN0b3J5RmlsZVN5c3RlbSh7IGxvY2F0aW9uOiBlbnRyeS5sb2NhdGlvbiwgYXNzb2NpYXRlZFJlc291cmNlOiBlbnRyeS53b3JraW5nQ29weS5yZXNvdXJjZSB9KTtcblxuXHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdHJlc291cmNlLFxuXHRcdGxhYmVsOiBsb2NhbGl6ZSgnbG9jYWxIaXN0b3J5RWRpdG9yTGFiZWwnLCBcInswfSAoezF9IFx1MjAyMiB7Mn0pXCIsIGVudHJ5LndvcmtpbmdDb3B5Lm5hbWUsIFNhdmVTb3VyY2VSZWdpc3RyeS5nZXRTb3VyY2VMYWJlbChlbnRyeS5zb3VyY2UpLCB0b0xvY2FsSGlzdG9yeUVudHJ5RGF0ZUxhYmVsKGVudHJ5LnRpbWVzdGFtcCkpLFxuXHRcdG9wdGlvbnNcblx0fSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNsb3NlRW50cnkoZW50cnk6IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeSwgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgcmVzb3VyY2UgPSBMb2NhbEhpc3RvcnlGaWxlU3lzdGVtUHJvdmlkZXIudG9Mb2NhbEhpc3RvcnlGaWxlU3lzdGVtKHsgbG9jYXRpb246IGVudHJ5LmxvY2F0aW9uLCBhc3NvY2lhdGVkUmVzb3VyY2U6IGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlIH0pO1xuXG5cdGNvbnN0IGVkaXRvcnMgPSBlZGl0b3JTZXJ2aWNlLmZpbmRFZGl0b3JzKHJlc291cmNlLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KTtcblx0YXdhaXQgZWRpdG9yU2VydmljZS5jbG9zZUVkaXRvcnMoZWRpdG9ycywgeyBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9EaWZmRWRpdG9yQXJndW1lbnRzKGVudHJ5OiBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnksIHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucyk6IHVua25vd25bXTtcbmV4cG9ydCBmdW5jdGlvbiB0b0RpZmZFZGl0b3JBcmd1bWVudHMocHJldmlvdXNFbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCBlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMpOiB1bmtub3duW107XG5leHBvcnQgZnVuY3Rpb24gdG9EaWZmRWRpdG9yQXJndW1lbnRzKGFyZzE6IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeSwgYXJnMjogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IHwgVVJJLCBvcHRpb25zPzogSUVkaXRvck9wdGlvbnMpOiB1bmtub3duW10ge1xuXG5cdC8vIExlZnQgaGFuZCBzaWRlIGlzIGFsd2F5cyBhIHdvcmtpbmcgY29weSBoaXN0b3J5IGVudHJ5XG5cdGNvbnN0IG9yaWdpbmFsUmVzb3VyY2UgPSBMb2NhbEhpc3RvcnlGaWxlU3lzdGVtUHJvdmlkZXIudG9Mb2NhbEhpc3RvcnlGaWxlU3lzdGVtKHsgbG9jYXRpb246IGFyZzEubG9jYXRpb24sIGFzc29jaWF0ZWRSZXNvdXJjZTogYXJnMS53b3JraW5nQ29weS5yZXNvdXJjZSB9KTtcblxuXHRsZXQgbGFiZWw6IHN0cmluZztcblxuXHQvLyBSaWdodCBoYW5kIHNpZGUgZGVwZW5kcyBvbiBob3cgdGhlIG1ldGhvZCB3YXMgY2FsbGVkXG5cdC8vIGFuZCBpcyBlaXRoZXIgYW5vdGhlciB3b3JraW5nIGNvcHkgaGlzdG9yeSBlbnRyeVxuXHQvLyBvciB0aGUgZmlsZSBvbiBkaXNrLlxuXG5cdGxldCBtb2RpZmllZFJlc291cmNlOiBVUkk7XG5cblx0Ly8gQ29tcGFyZSB3aXRoIGZpbGUgb24gZGlza1xuXHRpZiAoVVJJLmlzVXJpKGFyZzIpKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBhcmcyO1xuXG5cdFx0bW9kaWZpZWRSZXNvdXJjZSA9IHJlc291cmNlO1xuXHRcdGxhYmVsID0gbG9jYWxpemUoJ2xvY2FsSGlzdG9yeUNvbXBhcmVUb0ZpbGVFZGl0b3JMYWJlbCcsIFwiezB9ICh7MX0gXHUyMDIyIHsyfSkgXHUyMTk0IHszfVwiLCBhcmcxLndvcmtpbmdDb3B5Lm5hbWUsIFNhdmVTb3VyY2VSZWdpc3RyeS5nZXRTb3VyY2VMYWJlbChhcmcxLnNvdXJjZSksIHRvTG9jYWxIaXN0b3J5RW50cnlEYXRlTGFiZWwoYXJnMS50aW1lc3RhbXApLCBhcmcxLndvcmtpbmdDb3B5Lm5hbWUpO1xuXHR9XG5cblx0Ly8gQ29tcGFyZSB3aXRoIGFub3RoZXIgZW50cnlcblx0ZWxzZSB7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBhcmcyO1xuXG5cdFx0bW9kaWZpZWRSZXNvdXJjZSA9IExvY2FsSGlzdG9yeUZpbGVTeXN0ZW1Qcm92aWRlci50b0xvY2FsSGlzdG9yeUZpbGVTeXN0ZW0oeyBsb2NhdGlvbjogbW9kaWZpZWQubG9jYXRpb24sIGFzc29jaWF0ZWRSZXNvdXJjZTogbW9kaWZpZWQud29ya2luZ0NvcHkucmVzb3VyY2UgfSk7XG5cdFx0bGFiZWwgPSBsb2NhbGl6ZSgnbG9jYWxIaXN0b3J5Q29tcGFyZVRvUHJldmlvdXNFZGl0b3JMYWJlbCcsIFwiezB9ICh7MX0gXHUyMDIyIHsyfSkgXHUyMTk0IHszfSAoezR9IFx1MjAyMiB7NX0pXCIsIGFyZzEud29ya2luZ0NvcHkubmFtZSwgU2F2ZVNvdXJjZVJlZ2lzdHJ5LmdldFNvdXJjZUxhYmVsKGFyZzEuc291cmNlKSwgdG9Mb2NhbEhpc3RvcnlFbnRyeURhdGVMYWJlbChhcmcxLnRpbWVzdGFtcCksIG1vZGlmaWVkLndvcmtpbmdDb3B5Lm5hbWUsIFNhdmVTb3VyY2VSZWdpc3RyeS5nZXRTb3VyY2VMYWJlbChtb2RpZmllZC5zb3VyY2UpLCB0b0xvY2FsSGlzdG9yeUVudHJ5RGF0ZUxhYmVsKG1vZGlmaWVkLnRpbWVzdGFtcCkpO1xuXHR9XG5cblx0cmV0dXJuIFtcblx0XHRvcmlnaW5hbFJlc291cmNlLFxuXHRcdG1vZGlmaWVkUmVzb3VyY2UsXG5cdFx0bGFiZWwsXG5cdFx0b3B0aW9ucyA/IFt1bmRlZmluZWQsIG9wdGlvbnNdIDogdW5kZWZpbmVkXG5cdF07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kTG9jYWxIaXN0b3J5RW50cnkod29ya2luZ0NvcHlIaXN0b3J5U2VydmljZTogSVdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UsIGRlc2NyaXB0b3I6IElUaW1lbGluZUNvbW1hbmRBcmd1bWVudCk6IFByb21pc2U8eyBlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IHwgdW5kZWZpbmVkOyBwcmV2aW91czogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IHwgdW5kZWZpbmVkIH0+IHtcblx0Y29uc3QgZW50cmllcyA9IGF3YWl0IHdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UuZ2V0RW50cmllcyhkZXNjcmlwdG9yLnVyaSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0bGV0IGN1cnJlbnRFbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgcHJldmlvdXNFbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBlbnRyeSA9IGVudHJpZXNbaV07XG5cblx0XHRpZiAoZW50cnkuaWQgPT09IGRlc2NyaXB0b3IuaGFuZGxlKSB7XG5cdFx0XHRjdXJyZW50RW50cnkgPSBlbnRyeTtcblx0XHRcdHByZXZpb3VzRW50cnkgPSBlbnRyaWVzW2kgLSAxXTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB7XG5cdFx0ZW50cnk6IGN1cnJlbnRFbnRyeSxcblx0XHRwcmV2aW91czogcHJldmlvdXNFbnRyeVxuXHR9O1xufVxuXG5jb25zdCBTRVAgPSAvXFwvL2c7XG5mdW5jdGlvbiB0b0xvY2FsSGlzdG9yeUVudHJ5RGF0ZUxhYmVsKHRpbWVzdGFtcDogbnVtYmVyKTogc3RyaW5nIHtcblx0cmV0dXJuIGAke2dldExvY2FsSGlzdG9yeURhdGVGb3JtYXR0ZXIoKS5mb3JtYXQodGltZXN0YW1wKS5yZXBsYWNlKFNFUCwgJy0nKX1gOyAvLyBwcmVzZXJ2aW5nIGAvYCB3aWxsIGJyZWFrIGVkaXRvciBsYWJlbHMsIHNvIHJlcGxhY2UgaXQgd2l0aCBhIG5vbi1wYXRoIHN5bWJvbFxufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQW1DLGtDQUFrQztBQUNyRSxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGdCQUFnQixvQkFBb0IscUJBQXFCO0FBRWxFLFNBQVMsaUJBQWlCLFNBQVMsUUFBUSxvQkFBb0I7QUFDL0QsU0FBUyxVQUFVLHFCQUFxQixlQUFlO0FBQ3ZELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXdCLG9CQUFvQix3QkFBd0I7QUFDN0UsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUIsMEJBQTBCO0FBQ3hELFNBQVMsMEJBQTBDO0FBQ25ELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsOEJBQThCLDRCQUE0QixzQ0FBc0M7QUFDekcsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUI7QUFHaEMsTUFBTSx5QkFBeUIsVUFBVSx5QkFBeUIsZUFBZTtBQUNqRixNQUFNLDRCQUE0QixlQUFlLElBQUksdUNBQXVDO0FBU3JGLE1BQU0sMEJBQTBCLFVBQVUsZ0NBQWdDLG1CQUFtQjtBQUVwRyxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFD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
