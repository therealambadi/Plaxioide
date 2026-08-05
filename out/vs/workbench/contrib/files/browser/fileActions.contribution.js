import * as nls from "../../../../nls.js";
import { ToggleAutoSaveAction, FocusFilesExplorer, GlobalCompareResourcesAction, ShowActiveFileInExplorer, CompareWithClipboardAction, NEW_FILE_COMMAND_ID, NEW_FILE_LABEL, NEW_FOLDER_COMMAND_ID, NEW_FOLDER_LABEL, TRIGGER_RENAME_LABEL, MOVE_FILE_TO_TRASH_LABEL, COPY_FILE_LABEL, PASTE_FILE_LABEL, FileCopiedContext, renameHandler, moveFileToTrashHandler, copyFileHandler, pasteFileHandler, deleteFileHandler, cutFileHandler, DOWNLOAD_COMMAND_ID, openFilePreserveFocusHandler, DOWNLOAD_LABEL, OpenActiveFileInEmptyWorkspace, UPLOAD_COMMAND_ID, UPLOAD_LABEL, CompareNewUntitledTextFilesAction, SetActiveEditorReadonlyInSession, SetActiveEditorWriteableInSession, ToggleActiveEditorReadonlyInSession, ResetActiveEditorReadonlyInSession } from "./fileActions.js";
import { revertLocalChangesCommand, acceptLocalChangesCommand, CONFLICT_RESOLUTION_CONTEXT } from "./editors/textFileSaveErrorHandler.js";
import { MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { openWindowCommand, newWindowCommand } from "./fileCommands.js";
import { COPY_PATH_COMMAND_ID, REVEAL_IN_EXPLORER_COMMAND_ID, OPEN_TO_SIDE_COMMAND_ID, REVERT_FILE_COMMAND_ID, SAVE_FILE_COMMAND_ID, SAVE_FILE_LABEL, SAVE_FILE_AS_COMMAND_ID, SAVE_FILE_AS_LABEL, SAVE_ALL_IN_GROUP_COMMAND_ID, OpenEditorsGroupContext, COMPARE_WITH_SAVED_COMMAND_ID, COMPARE_RESOURCE_COMMAND_ID, SELECT_FOR_COMPARE_COMMAND_ID, ResourceSelectedForCompareContext, OpenEditorsDirtyEditorContext, COMPARE_SELECTED_COMMAND_ID, REMOVE_ROOT_FOLDER_COMMAND_ID, REMOVE_ROOT_FOLDER_LABEL, SAVE_FILES_COMMAND_ID, COPY_RELATIVE_PATH_COMMAND_ID, SAVE_FILE_WITHOUT_FORMATTING_COMMAND_ID, SAVE_FILE_WITHOUT_FORMATTING_LABEL, OpenEditorsReadonlyEditorContext, OPEN_WITH_EXPLORER_COMMAND_ID, NEW_UNTITLED_FILE_COMMAND_ID, NEW_UNTITLED_FILE_LABEL, SAVE_ALL_COMMAND_ID, OpenEditorsSelectedFileOrUntitledContext } from "./fileConstants.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { FilesExplorerFocusCondition, ExplorerRootContext, ExplorerFolderContext, ExplorerResourceWritableContext, ExplorerResourceCut, ExplorerResourceMoveableToTrash, ExplorerResourceAvailableEditorIdsContext, FoldersViewVisibleContext } from "../common/files.js";
import { ADD_ROOT_FOLDER_COMMAND_ID, ADD_ROOT_FOLDER_LABEL } from "../../../browser/actions/workspaceCommands.js";
import { CLOSE_SAVED_EDITORS_COMMAND_ID, CLOSE_EDITORS_IN_GROUP_COMMAND_ID, CLOSE_EDITOR_COMMAND_ID, CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID, REOPEN_WITH_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { AutoSaveAfterShortDelayContext } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { WorkbenchListDoubleSelection } from "../../../../platform/list/browser/listService.js";
import { Schemas } from "../../../../base/common/network.js";
import { DirtyWorkingCopiesContext, EnterMultiRootWorkspaceSupportContext, HasWebFileSystemAccess, WorkbenchStateContext, WorkspaceFolderCountContext, SidebarFocusContext, ActiveEditorCanRevertContext, ActiveEditorContext, ResourceContextKey, ActiveEditorAvailableEditorIdsContext, MultipleEditorsSelectedInGroupContext, TwoEditorsSelectedInGroupContext, SelectedEditorsInGroupFileOrUntitledResourceContextKey } from "../../../common/contextkeys.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { IExplorerService } from "./files.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { VOID_OPEN_SETTINGS_ACTION_ID } from "../../void/browser/voidSettingsPane.js";
registerAction2(GlobalCompareResourcesAction);
registerAction2(FocusFilesExplorer);
registerAction2(ShowActiveFileInExplorer);
registerAction2(CompareWithClipboardAction);
registerAction2(CompareNewUntitledTextFilesAction);
registerAction2(ToggleAutoSaveAction);
registerAction2(OpenActiveFileInEmptyWorkspace);
registerAction2(SetActiveEditorReadonlyInSession);
registerAction2(SetActiveEditorWriteableInSession);
registerAction2(ToggleActiveEditorReadonlyInSession);
registerAction2(ResetActiveEditorReadonlyInSession);
CommandsRegistry.registerCommand("_files.windowOpen", openWindowCommand);
CommandsRegistry.registerCommand("_files.newWindow", newWindowCommand);
const explorerCommandsWeightBonus = 10;
const RENAME_ID = "renameFile";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: RENAME_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerRootContext.toNegated(), ExplorerResourceWritableContext),
  primary: KeyCode.F2,
  mac: {
    primary: KeyCode.Enter
  },
  handler: renameHandler
});
const MOVE_FILE_TO_TRASH_ID = "moveFileToTrash";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: MOVE_FILE_TO_TRASH_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerResourceMoveableToTrash),
  primary: KeyCode.Delete,
  mac: {
    primary: KeyMod.CtrlCmd | KeyCode.Backspace,
    secondary: [KeyCode.Delete]
  },
  handler: moveFileToTrashHandler
});
const DELETE_FILE_ID = "deleteFile";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: DELETE_FILE_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: FilesExplorerFocusCondition,
  primary: KeyMod.Shift | KeyCode.Delete,
  mac: {
    primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Backspace
  },
  handler: deleteFileHandler
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: DELETE_FILE_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerResourceMoveableToTrash.toNegated()),
  primary: KeyCode.Delete,
  mac: {
    primary: KeyMod.CtrlCmd | KeyCode.Backspace
  },
  handler: deleteFileHandler
});
const CUT_FILE_ID = "filesExplorer.cut";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CUT_FILE_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerRootContext.toNegated(), ExplorerResourceWritableContext),
  primary: KeyMod.CtrlCmd | KeyCode.KeyX,
  handler: cutFileHandler
});
const COPY_FILE_ID = "filesExplorer.copy";
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: COPY_FILE_ID,
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerRootContext.toNegated()),
  primary: KeyMod.CtrlCmd | KeyCode.KeyC,
  handler: copyFileHandler
});
const PASTE_FILE_ID = "filesExplorer.paste";
CommandsRegistry.registerCommand(PASTE_FILE_ID, pasteFileHandler);
KeybindingsRegistry.registerKeybindingRule({
  id: `^${PASTE_FILE_ID}`,
  // the `^` enables pasting files into the explorer by preventing default bubble up
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerResourceWritableContext),
  primary: KeyMod.CtrlCmd | KeyCode.KeyV
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "filesExplorer.cancelCut",
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerResourceCut),
  primary: KeyCode.Escape,
  handler: async (accessor) => {
    const explorerService = accessor.get(IExplorerService);
    await explorerService.setToCopy([], true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "filesExplorer.openFilePreserveFocus",
  weight: KeybindingWeight.WorkbenchContrib + explorerCommandsWeightBonus,
  when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerFolderContext.toNegated()),
  primary: KeyCode.Space,
  handler: openFilePreserveFocusHandler
});
const copyPathCommand = {
  id: COPY_PATH_COMMAND_ID,
  title: nls.localize("copyPath", "Copy Path")
};
const copyRelativePathCommand = {
  id: COPY_RELATIVE_PATH_COMMAND_ID,
  title: nls.localize("copyRelativePath", "Copy Relative Path")
};
const revealInSideBarCommand = {
  id: REVEAL_IN_EXPLORER_COMMAND_ID,
  title: nls.localize("revealInSideBar", "Reveal in Explorer View")
};
appendEditorTitleContextMenuItem(COPY_PATH_COMMAND_ID, copyPathCommand.title, ResourceContextKey.IsFileSystemResource, "1_cutcopypaste", true);
appendEditorTitleContextMenuItem(COPY_RELATIVE_PATH_COMMAND_ID, copyRelativePathCommand.title, ResourceContextKey.IsFileSystemResource, "1_cutcopypaste", true);
appendEditorTitleContextMenuItem(revealInSideBarCommand.id, revealInSideBarCommand.title, ResourceContextKey.IsFileSystemResource, "2_files", false, 1);
function appendEditorTitleContextMenuItem(id, title, when, group, supportsMultiSelect, order) {
  const precondition = supportsMultiSelect !== true ? MultipleEditorsSelectedInGroupContext.negate() : void 0;
  MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
    command: { id, title, precondition },
    when,
    group,
    order
  });
}
appendSaveConflictEditorTitleAction("workbench.files.action.acceptLocalChanges", nls.localize("acceptLocalChanges", "Use your changes and overwrite file contents"), Codicon.check, -10, acceptLocalChangesCommand);
appendSaveConflictEditorTitleAction("workbench.files.action.revertLocalChanges", nls.localize("revertLocalChanges", "Discard your changes and revert to file contents"), Codicon.discard, -9, revertLocalChangesCommand);
function appendSaveConflictEditorTitleAction(id, title, icon, order, command) {
  CommandsRegistry.registerCommand(id, command);
  MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
    command: { id, title, icon },
    when: ContextKeyExpr.equals(CONFLICT_RESOLUTION_CONTEXT, true),
    group: "navigation",
    order
  });
}
function appendToCommandPalette({ id, title, category, metadata }, when) {
  MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
    command: {
      id,
      title,
      category,
      metadata
    },
    when
  });
}
appendToCommandPalette({
  id: COPY_PATH_COMMAND_ID,
  title: nls.localize2("copyPathOfActive", "Copy Path of Active File"),
  category: Categories.File
});
appendToCommandPalette({
  id: COPY_RELATIVE_PATH_COMMAND_ID,
  title: nls.localize2("copyRelativePathOfActive", "Copy Relative Path of Active File"),
  category: Categories.File
});
appendToCommandPalette({
  id: SAVE_FILE_COMMAND_ID,
  title: SAVE_FILE_LABEL,
  category: Categories.File
});
appendToCommandPalette({
  id: SAVE_FILE_WITHOUT_FORMATTING_COMMAND_ID,
  title: SAVE_FILE_WITHOUT_FORMATTING_LABEL,
  category: Categories.File
});
appendToCommandPalette({
  id: SAVE_ALL_IN_GROUP_COMMAND_ID,
  title: nls.localize2("saveAllInGroup", "Save All in Group"),
  category: Categories.File
});
appendToCommandPalette({
  id: SAVE_FILES_COMMAND_ID,
  title: nls.localize2("saveFiles", "Save All Files"),
  category: Categories.File
});
appendToCommandPalette({
  id: REVERT_FILE_COMMAND_ID,
  title: nls.localize2("revert", "Revert File"),
  category: Categories.File
});
appendToCommandPalette({
  id: COMPARE_WITH_SAVED_COMMAND_ID,
  title: nls.localize2("compareActiveWithSaved", "Compare Active File with Saved"),
  category: Categories.File,
  metadata: {
    description: nls.localize2("compareActiveWithSavedMeta", "Opens a new diff editor to compare the active file with the version on disk.")
  }
});
appendToCommandPalette({
  id: SAVE_FILE_AS_COMMAND_ID,
  title: SAVE_FILE_AS_LABEL,
  category: Categories.File
});
appendToCommandPalette({
  id: NEW_FILE_COMMAND_ID,
  title: NEW_FILE_LABEL,
  category: Categories.File
}, WorkspaceFolderCountContext.notEqualsTo("0"));
appendToCommandPalette({
  id: NEW_FOLDER_COMMAND_ID,
  title: NEW_FOLDER_LABEL,
  category: Categories.File,
  metadata: { description: nls.localize2("newFolderDescription", "Create a new folder or directory") }
}, WorkspaceFolderCountContext.notEqualsTo("0"));
appendToCommandPalette({
  id: NEW_UNTITLED_FILE_COMMAND_ID,
  title: NEW_UNTITLED_FILE_LABEL,
  category: Categories.File
});
const isFileOrUntitledResourceContextKey = ContextKeyExpr.or(ResourceContextKey.IsFileSystemResource, ResourceContextKey.Scheme.isEqualTo(Schemas.untitled));
const openToSideCommand = {
  id: OPEN_TO_SIDE_COMMAND_ID,
  title: nls.localize("openToSide", "Open to the Side")
};
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "navigation",
  order: 10,
  command: openToSideCommand,
  when: isFileOrUntitledResourceContextKey
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "1_open",
  order: 10,
  command: {
    id: REOPEN_WITH_COMMAND_ID,
    title: nls.localize("reopenWith", "Reopen Editor With...")
  },
  when: ContextKeyExpr.and(
    // Editors with Available Choices to Open With
    ActiveEditorAvailableEditorIdsContext,
    // Not: editor groups
    OpenEditorsGroupContext.toNegated()
  )
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "1_cutcopypaste",
  order: 10,
  command: copyPathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "1_cutcopypaste",
  order: 20,
  command: copyRelativePathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "2_save",
  order: 10,
  command: {
    id: SAVE_FILE_COMMAND_ID,
    title: SAVE_FILE_LABEL,
    precondition: OpenEditorsDirtyEditorContext
  },
  when: ContextKeyExpr.or(
    // Untitled Editors
    ResourceContextKey.Scheme.isEqualTo(Schemas.untitled),
    // Or:
    ContextKeyExpr.and(
      // Not: editor groups
      OpenEditorsGroupContext.toNegated(),
      // Not: readonly editors
      OpenEditorsReadonlyEditorContext.toNegated(),
      // Not: auto save after short delay
      AutoSaveAfterShortDelayContext.toNegated()
    )
  )
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "2_save",
  order: 20,
  command: {
    id: REVERT_FILE_COMMAND_ID,
    title: nls.localize("revert", "Revert File"),
    precondition: OpenEditorsDirtyEditorContext
  },
  when: ContextKeyExpr.and(
    // Not: editor groups
    OpenEditorsGroupContext.toNegated(),
    // Not: readonly editors
    OpenEditorsReadonlyEditorContext.toNegated(),
    // Not: untitled editors (revert closes them)
    ResourceContextKey.Scheme.notEqualsTo(Schemas.untitled),
    // Not: auto save after short delay
    AutoSaveAfterShortDelayContext.toNegated()
  )
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "2_save",
  order: 30,
  command: {
    id: SAVE_ALL_IN_GROUP_COMMAND_ID,
    title: nls.localize("saveAll", "Save All"),
    precondition: DirtyWorkingCopiesContext
  },
  // Editor Group
  when: OpenEditorsGroupContext
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "3_compare",
  order: 10,
  command: {
    id: COMPARE_WITH_SAVED_COMMAND_ID,
    title: nls.localize("compareWithSaved", "Compare with Saved"),
    precondition: OpenEditorsDirtyEditorContext
  },
  when: ContextKeyExpr.and(ResourceContextKey.IsFileSystemResource, AutoSaveAfterShortDelayContext.toNegated(), WorkbenchListDoubleSelection.toNegated())
});
const compareResourceCommand = {
  id: COMPARE_RESOURCE_COMMAND_ID,
  title: nls.localize("compareWithSelected", "Compare with Selected")
};
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "3_compare",
  order: 20,
  command: compareResourceCommand,
  when: ContextKeyExpr.and(ResourceContextKey.HasResource, ResourceSelectedForCompareContext, isFileOrUntitledResourceContextKey, WorkbenchListDoubleSelection.toNegated())
});
const selectForCompareCommand = {
  id: SELECT_FOR_COMPARE_COMMAND_ID,
  title: nls.localize("compareSource", "Select for Compare")
};
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "3_compare",
  order: 30,
  command: selectForCompareCommand,
  when: ContextKeyExpr.and(ResourceContextKey.HasResource, isFileOrUntitledResourceContextKey, WorkbenchListDoubleSelection.toNegated())
});
const compareSelectedCommand = {
  id: COMPARE_SELECTED_COMMAND_ID,
  title: nls.localize("compareSelected", "Compare Selected")
};
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "3_compare",
  order: 30,
  command: compareSelectedCommand,
  when: ContextKeyExpr.and(ResourceContextKey.HasResource, WorkbenchListDoubleSelection, OpenEditorsSelectedFileOrUntitledContext)
});
MenuRegistry.appendMenuItem(MenuId.EditorTitleContext, {
  group: "1_compare",
  order: 30,
  command: compareSelectedCommand,
  when: ContextKeyExpr.and(ResourceContextKey.HasResource, TwoEditorsSelectedInGroupContext, SelectedEditorsInGroupFileOrUntitledResourceContextKey)
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "4_close",
  order: 10,
  command: {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: nls.localize("close", "Close")
  },
  when: OpenEditorsGroupContext.toNegated()
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "4_close",
  order: 20,
  command: {
    id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
    title: nls.localize("closeOthers", "Close Others")
  },
  when: OpenEditorsGroupContext.toNegated()
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "4_close",
  order: 30,
  command: {
    id: CLOSE_SAVED_EDITORS_COMMAND_ID,
    title: nls.localize("closeSaved", "Close Saved")
  }
});
MenuRegistry.appendMenuItem(MenuId.OpenEditorsContext, {
  group: "4_close",
  order: 40,
  command: {
    id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
    title: nls.localize("closeAll", "Close All")
  }
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "navigation",
  order: 4,
  command: {
    id: NEW_FILE_COMMAND_ID,
    title: NEW_FILE_LABEL,
    precondition: ExplorerResourceWritableContext
  },
  when: ExplorerFolderContext
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "navigation",
  order: 6,
  command: {
    id: NEW_FOLDER_COMMAND_ID,
    title: NEW_FOLDER_LABEL,
    precondition: ExplorerResourceWritableContext
  },
  when: ExplorerFolderContext
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "navigation",
  order: 10,
  command: openToSideCommand,
  when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource)
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "navigation",
  order: 20,
  command: {
    id: OPEN_WITH_EXPLORER_COMMAND_ID,
    title: nls.localize("explorerOpenWith", "Open With...")
  },
  when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ExplorerResourceAvailableEditorIdsContext)
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "3_compare",
  order: 20,
  command: compareResourceCommand,
  when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource, ResourceSelectedForCompareContext, WorkbenchListDoubleSelection.toNegated())
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "3_compare",
  order: 30,
  command: selectForCompareCommand,
  when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource, WorkbenchListDoubleSelection.toNegated())
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "3_compare",
  order: 30,
  command: compareSelectedCommand,
  when: ContextKeyExpr.and(ExplorerFolderContext.toNegated(), ResourceContextKey.HasResource, WorkbenchListDoubleSelection)
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "5_cutcopypaste",
  order: 8,
  command: {
    id: CUT_FILE_ID,
    title: nls.localize("cut", "Cut")
  },
  when: ContextKeyExpr.and(ExplorerRootContext.toNegated(), ExplorerResourceWritableContext)
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "5_cutcopypaste",
  order: 10,
  command: {
    id: COPY_FILE_ID,
    title: COPY_FILE_LABEL
  },
  when: ExplorerRootContext.toNegated()
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "5_cutcopypaste",
  order: 20,
  command: {
    id: PASTE_FILE_ID,
    title: PASTE_FILE_LABEL,
    precondition: ContextKeyExpr.and(ExplorerResourceWritableContext, FileCopiedContext)
  },
  when: ExplorerFolderContext
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "5b_importexport",
  order: 10,
  command: {
    id: DOWNLOAD_COMMAND_ID,
    title: DOWNLOAD_LABEL
  },
  when: ContextKeyExpr.or(
    // native: for any remote resource
    ContextKeyExpr.and(IsWebContext.toNegated(), ResourceContextKey.Scheme.notEqualsTo(Schemas.file)),
    // web: for any files
    ContextKeyExpr.and(IsWebContext, ExplorerFolderContext.toNegated(), ExplorerRootContext.toNegated()),
    // web: for any folders if file system API support is provided
    ContextKeyExpr.and(IsWebContext, HasWebFileSystemAccess)
  )
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "5b_importexport",
  order: 20,
  command: {
    id: UPLOAD_COMMAND_ID,
    title: UPLOAD_LABEL
  },
  when: ContextKeyExpr.and(
    // only in web
    IsWebContext,
    // only on folders
    ExplorerFolderContext,
    // only on writable folders
    ExplorerResourceWritableContext
  )
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "6_copypath",
  order: 10,
  command: copyPathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "6_copypath",
  order: 20,
  command: copyRelativePathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "2_workspace",
  order: 10,
  command: {
    id: ADD_ROOT_FOLDER_COMMAND_ID,
    title: ADD_ROOT_FOLDER_LABEL
  },
  when: ContextKeyExpr.and(ExplorerRootContext, ContextKeyExpr.or(EnterMultiRootWorkspaceSupportContext, WorkbenchStateContext.isEqualTo("workspace")))
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "2_workspace",
  order: 30,
  command: {
    id: REMOVE_ROOT_FOLDER_COMMAND_ID,
    title: REMOVE_ROOT_FOLDER_LABEL
  },
  when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext, ContextKeyExpr.and(WorkspaceFolderCountContext.notEqualsTo("0"), ContextKeyExpr.or(EnterMultiRootWorkspaceSupportContext, WorkbenchStateContext.isEqualTo("workspace"))))
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "7_modification",
  order: 10,
  command: {
    id: RENAME_ID,
    title: TRIGGER_RENAME_LABEL,
    precondition: ExplorerResourceWritableContext
  },
  when: ExplorerRootContext.toNegated()
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "7_modification",
  order: 20,
  command: {
    id: MOVE_FILE_TO_TRASH_ID,
    title: MOVE_FILE_TO_TRASH_LABEL
  },
  alt: {
    id: DELETE_FILE_ID,
    title: nls.localize("deleteFile", "Delete Permanently")
  },
  when: ContextKeyExpr.and(ExplorerRootContext.toNegated(), ExplorerResourceMoveableToTrash)
});
MenuRegistry.appendMenuItem(MenuId.ExplorerContext, {
  group: "7_modification",
  order: 20,
  command: {
    id: DELETE_FILE_ID,
    title: nls.localize("deleteFile", "Delete Permanently")
  },
  when: ContextKeyExpr.and(ExplorerRootContext.toNegated(), ExplorerResourceMoveableToTrash.toNegated())
});
for (const menuId of [MenuId.EmptyEditorGroupContext, MenuId.EditorTabsBarContext]) {
  MenuRegistry.appendMenuItem(menuId, { command: { id: NEW_UNTITLED_FILE_COMMAND_ID, title: nls.localize("newFile", "New Text File") }, group: "1_file", order: 10 });
  MenuRegistry.appendMenuItem(menuId, { command: { id: "workbench.action.quickOpen", title: nls.localize("openFile", "Open File...") }, group: "1_file", order: 20 });
}
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "0_void",
  command: {
    id: VOID_OPEN_SETTINGS_ACTION_ID,
    title: nls.localize({ key: "openVoid", comment: ["&& denotes a mnemonic"] }, "&&Open Void Settings")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "1_new",
  command: {
    id: NEW_UNTITLED_FILE_COMMAND_ID,
    title: nls.localize({ key: "miNewFile", comment: ["&& denotes a mnemonic"] }, "&&New Text File")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "4_save",
  command: {
    id: SAVE_FILE_COMMAND_ID,
    title: nls.localize({ key: "miSave", comment: ["&& denotes a mnemonic"] }, "&&Save"),
    precondition: ContextKeyExpr.or(ActiveEditorContext, ContextKeyExpr.and(FoldersViewVisibleContext, SidebarFocusContext))
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "4_save",
  command: {
    id: SAVE_FILE_AS_COMMAND_ID,
    title: nls.localize({ key: "miSaveAs", comment: ["&& denotes a mnemonic"] }, "Save &&As..."),
    precondition: ContextKeyExpr.or(ActiveEditorContext, ContextKeyExpr.and(FoldersViewVisibleContext, SidebarFocusContext))
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "4_save",
  command: {
    id: SAVE_ALL_COMMAND_ID,
    title: nls.localize({ key: "miSaveAll", comment: ["&& denotes a mnemonic"] }, "Save A&&ll"),
    precondition: DirtyWorkingCopiesContext
  },
  order: 3
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "5_autosave",
  command: {
    id: ToggleAutoSaveAction.ID,
    title: nls.localize({ key: "miAutoSave", comment: ["&& denotes a mnemonic"] }, "A&&uto Save"),
    toggled: ContextKeyExpr.notEquals("config.files.autoSave", "off")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "6_close",
  command: {
    id: REVERT_FILE_COMMAND_ID,
    title: nls.localize({ key: "miRevert", comment: ["&& denotes a mnemonic"] }, "Re&&vert File"),
    precondition: ContextKeyExpr.or(
      // Active editor can revert
      ContextKeyExpr.and(ActiveEditorCanRevertContext),
      // Explorer focused but not on untitled
      ContextKeyExpr.and(ResourceContextKey.Scheme.notEqualsTo(Schemas.untitled), FoldersViewVisibleContext, SidebarFocusContext)
    )
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  group: "6_close",
  command: {
    id: CLOSE_EDITOR_COMMAND_ID,
    title: nls.localize({ key: "miCloseEditor", comment: ["&& denotes a mnemonic"] }, "&&Close Editor"),
    precondition: ContextKeyExpr.or(ActiveEditorContext, ContextKeyExpr.and(FoldersViewVisibleContext, SidebarFocusContext))
  },
  order: 2
});
MenuRegistry.appendMenuItem(MenuId.MenubarGoMenu, {
  group: "3_global_nav",
  command: {
    id: "workbench.action.quickOpen",
    title: nls.localize({ key: "miGotoFile", comment: ["&& denotes a mnemonic"] }, "Go to &&File...")
  },
  order: 1
});
MenuRegistry.appendMenuItem(MenuId.ChatAttachmentsContext, {
  group: "navigation",
  order: 10,
  command: openToSideCommand,
  when: ContextKeyExpr.and(ResourceContextKey.IsFileSystemResource, ExplorerFolderContext.toNegated())
});
MenuRegistry.appendMenuItem(MenuId.ChatAttachmentsContext, {
  group: "navigation",
  order: 20,
  command: revealInSideBarCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.ChatAttachmentsContext, {
  group: "1_cutcopypaste",
  order: 10,
  command: copyPathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
MenuRegistry.appendMenuItem(MenuId.ChatAttachmentsContext, {
  group: "1_cutcopypaste",
  order: 20,
  command: copyRelativePathCommand,
  when: ResourceContextKey.IsFileSystemResource
});
for (const menuId of [MenuId.ChatInlineResourceAnchorContext, MenuId.ChatInputResourceAttachmentContext]) {
  MenuRegistry.appendMenuItem(menuId, {
    group: "navigation",
    order: 10,
    command: openToSideCommand,
    when: ContextKeyExpr.and(ResourceContextKey.HasResource, ExplorerFolderContext.toNegated())
  });
  MenuRegistry.appendMenuItem(menuId, {
    group: "navigation",
    order: 20,
    command: revealInSideBarCommand,
    when: ResourceContextKey.IsFileSystemResource
  });
  MenuRegistry.appendMenuItem(menuId, {
    group: "1_cutcopypaste",
    order: 10,
    command: copyPathCommand,
    when: ResourceContextKey.IsFileSystemResource
  });
  MenuRegistry.appendMenuItem(menuId, {
    group: "1_cutcopypaste",
    order: 20,
    command: copyRelativePathCommand,
    when: ResourceContextKey.IsFileSystemResource
  });
}
export {
  appendEditorTitleContextMenuItem,
  appendToCommandPalette,
  revealInSideBarCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2ZpbGVBY3Rpb25zLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgVG9nZ2xlQXV0b1NhdmVBY3Rpb24sIEZvY3VzRmlsZXNFeHBsb3JlciwgR2xvYmFsQ29tcGFyZVJlc291cmNlc0FjdGlvbiwgU2hvd0FjdGl2ZUZpbGVJbkV4cGxvcmVyLCBDb21wYXJlV2l0aENsaXBib2FyZEFjdGlvbiwgTkVXX0ZJTEVfQ09NTUFORF9JRCwgTkVXX0ZJTEVfTEFCRUwsIE5FV19GT0xERVJfQ09NTUFORF9JRCwgTkVXX0ZPTERFUl9MQUJFTCwgVFJJR0dFUl9SRU5BTUVfTEFCRUwsIE1PVkVfRklMRV9UT19UUkFTSF9MQUJFTCwgQ09QWV9GSUxFX0xBQkVMLCBQQVNURV9GSUxFX0xBQkVMLCBGaWxlQ29waWVkQ29udGV4dCwgcmVuYW1lSGFuZGxlciwgbW92ZUZpbGVUb1RyYXNoSGFuZGxlciwgY29weUZpbGVIYW5kbGVyLCBwYXN0ZUZpbGVIYW5kbGVyLCBkZWxldGVGaWxlSGFuZGxlciwgY3V0RmlsZUhhbmRsZXIsIERPV05MT0FEX0NPTU1BTkRfSUQsIG9wZW5GaWxlUHJlc2VydmVGb2N1c0hhbmRsZXIsIERPV05MT0FEX0xBQkVMLCBPcGVuQWN0aXZlRmlsZUluRW1wdHlXb3Jrc3BhY2UsIFVQTE9BRF9DT01NQU5EX0lELCBVUExPQURfTEFCRUwsIENvbXBhcmVOZXdVbnRpdGxlZFRleHRGaWxlc0FjdGlvbiwgU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24sIFNldEFjdGl2ZUVkaXRvcldyaXRlYWJsZUluU2Vzc2lvbiwgVG9nZ2xlQWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24sIFJlc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24gfSBmcm9tICcuL2ZpbGVBY3Rpb25zLmpzJztcbmltcG9ydCB7IHJldmVydExvY2FsQ2hhbmdlc0NvbW1hbmQsIGFjY2VwdExvY2FsQ2hhbmdlc0NvbW1hbmQsIENPTkZMSUNUX1JFU09MVVRJT05fQ09OVEVYVCB9IGZyb20gJy4vZWRpdG9ycy90ZXh0RmlsZVNhdmVFcnJvckhhbmRsZXIuanMnO1xuaW1wb3J0IHsgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBvcGVuV2luZG93Q29tbWFuZCwgbmV3V2luZG93Q29tbWFuZCB9IGZyb20gJy4vZmlsZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IENPUFlfUEFUSF9DT01NQU5EX0lELCBSRVZFQUxfSU5fRVhQTE9SRVJfQ09NTUFORF9JRCwgT1BFTl9UT19TSURFX0NPTU1BTkRfSUQsIFJFVkVSVF9GSUxFX0NPTU1BTkRfSUQsIFNBVkVfRklMRV9DT01NQU5EX0lELCBTQVZFX0ZJTEVfTEFCRUwsIFNBVkVfRklMRV9BU19DT01NQU5EX0lELCBTQVZFX0ZJTEVfQVNfTEFCRUwsIFNBVkVfQUxMX0lOX0dST1VQX0NPTU1BTkRfSUQsIE9wZW5FZGl0b3JzR3JvdXBDb250ZXh0LCBDT01QQVJFX1dJVEhfU0FWRURfQ09NTUFORF9JRCwgQ09NUEFSRV9SRVNPVVJDRV9DT01NQU5EX0lELCBTRUxFQ1RfRk9SX0NPTVBBUkVfQ09NTUFORF9JRCwgUmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0LCBPcGVuRWRpdG9yc0RpcnR5RWRpdG9yQ29udGV4dCwgQ09NUEFSRV9TRUxFQ1RFRF9DT01NQU5EX0lELCBSRU1PVkVfUk9PVF9GT0xERVJfQ09NTUFORF9JRCwgUkVNT1ZFX1JPT1RfRk9MREVSX0xBQkVMLCBTQVZFX0ZJTEVTX0NPTU1BTkRfSUQsIENPUFlfUkVMQVRJVkVfUEFUSF9DT01NQU5EX0lELCBTQVZFX0ZJTEVfV0lUSE9VVF9GT1JNQVRUSU5HX0NPTU1BTkRfSUQsIFNBVkVfRklMRV9XSVRIT1VUX0ZPUk1BVFRJTkdfTEFCRUwsIE9wZW5FZGl0b3JzUmVhZG9ubHlFZGl0b3JDb250ZXh0LCBPUEVOX1dJVEhfRVhQTE9SRVJfQ09NTUFORF9JRCwgTkVXX1VOVElUTEVEX0ZJTEVfQ09NTUFORF9JRCwgTkVXX1VOVElUTEVEX0ZJTEVfTEFCRUwsIFNBVkVfQUxMX0NPTU1BTkRfSUQsIE9wZW5FZGl0b3JzU2VsZWN0ZWRGaWxlT3JVbnRpdGxlZENvbnRleHQgfSBmcm9tICcuL2ZpbGVDb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlclJvb3RDb250ZXh0LCBFeHBsb3JlckZvbGRlckNvbnRleHQsIEV4cGxvcmVyUmVzb3VyY2VXcml0YWJsZUNvbnRleHQsIEV4cGxvcmVyUmVzb3VyY2VDdXQsIEV4cGxvcmVyUmVzb3VyY2VNb3ZlYWJsZVRvVHJhc2gsIEV4cGxvcmVyUmVzb3VyY2VBdmFpbGFibGVFZGl0b3JJZHNDb250ZXh0LCBGb2xkZXJzVmlld1Zpc2libGVDb250ZXh0IH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEFERF9ST09UX0ZPTERFUl9DT01NQU5EX0lELCBBRERfUk9PVF9GT0xERVJfTEFCRUwgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2FjdGlvbnMvd29ya3NwYWNlQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ0xPU0VfU0FWRURfRURJVE9SU19DT01NQU5EX0lELCBDTE9TRV9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIENMT1NFX0VESVRPUl9DT01NQU5EX0lELCBDTE9TRV9PVEhFUl9FRElUT1JTX0lOX0dST1VQX0NPTU1BTkRfSUQsIFJFT1BFTl9XSVRIX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBBdXRvU2F2ZUFmdGVyU2hvcnREZWxheUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBEaXJ0eVdvcmtpbmdDb3BpZXNDb250ZXh0LCBFbnRlck11bHRpUm9vdFdvcmtzcGFjZVN1cHBvcnRDb250ZXh0LCBIYXNXZWJGaWxlU3lzdGVtQWNjZXNzLCBXb3JrYmVuY2hTdGF0ZUNvbnRleHQsIFdvcmtzcGFjZUZvbGRlckNvdW50Q29udGV4dCwgU2lkZWJhckZvY3VzQ29udGV4dCwgQWN0aXZlRWRpdG9yQ2FuUmV2ZXJ0Q29udGV4dCwgQWN0aXZlRWRpdG9yQ29udGV4dCwgUmVzb3VyY2VDb250ZXh0S2V5LCBBY3RpdmVFZGl0b3JBdmFpbGFibGVFZGl0b3JJZHNDb250ZXh0LCBNdWx0aXBsZUVkaXRvcnNTZWxlY3RlZEluR3JvdXBDb250ZXh0LCBUd29FZGl0b3JzU2VsZWN0ZWRJbkdyb3VwQ29udGV4dCwgU2VsZWN0ZWRFZGl0b3JzSW5Hcm91cEZpbGVPclVudGl0bGVkUmVzb3VyY2VDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElzV2ViQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi9maWxlcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBWT0lEX09QRU5fU0VUVElOR1NfQUNUSU9OX0lEIH0gZnJvbSAnLi4vLi4vdm9pZC9icm93c2VyL3ZvaWRTZXR0aW5nc1BhbmUuanMnO1xuXG4vLyBDb250cmlidXRlIEdsb2JhbCBBY3Rpb25zXG5cbnJlZ2lzdGVyQWN0aW9uMihHbG9iYWxDb21wYXJlUmVzb3VyY2VzQWN0aW9uKTtcbnJlZ2lzdGVyQWN0aW9uMihGb2N1c0ZpbGVzRXhwbG9yZXIpO1xucmVnaXN0ZXJBY3Rpb24yKFNob3dBY3RpdmVGaWxlSW5FeHBsb3Jlcik7XG5yZWdpc3RlckFjdGlvbjIoQ29tcGFyZVdpdGhDbGlwYm9hcmRBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKENvbXBhcmVOZXdVbnRpdGxlZFRleHRGaWxlc0FjdGlvbik7XG5yZWdpc3RlckFjdGlvbjIoVG9nZ2xlQXV0b1NhdmVBY3Rpb24pO1xucmVnaXN0ZXJBY3Rpb24yKE9wZW5BY3RpdmVGaWxlSW5FbXB0eVdvcmtzcGFjZSk7XG5yZWdpc3RlckFjdGlvbjIoU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24pO1xucmVnaXN0ZXJBY3Rpb24yKFNldEFjdGl2ZUVkaXRvcldyaXRlYWJsZUluU2Vzc2lvbik7XG5yZWdpc3RlckFjdGlvbjIoVG9nZ2xlQWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24pO1xucmVnaXN0ZXJBY3Rpb24yKFJlc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24pO1xuXG4vLyBDb21tYW5kc1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ19maWxlcy53aW5kb3dPcGVuJywgb3BlbldpbmRvd0NvbW1hbmQpO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ19maWxlcy5uZXdXaW5kb3cnLCBuZXdXaW5kb3dDb21tYW5kKTtcblxuY29uc3QgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzID0gMTA7IC8vIGdpdmUgb3VyIGNvbW1hbmRzIGEgbGl0dGxlIGJpdCBtb3JlIHdlaWdodCBvdmVyIG90aGVyIGRlZmF1bHQgbGlzdC90cmVlIGNvbW1hbmRzXG5cbmNvbnN0IFJFTkFNRV9JRCA9ICdyZW5hbWVGaWxlJztcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogUkVOQU1FX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIGV4cGxvcmVyQ29tbWFuZHNXZWlnaHRCb251cyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSwgRXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dCksXG5cdHByaW1hcnk6IEtleUNvZGUuRjIsXG5cdG1hYzoge1xuXHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXJcblx0fSxcblx0aGFuZGxlcjogcmVuYW1lSGFuZGxlclxufSk7XG5cbmNvbnN0IE1PVkVfRklMRV9UT19UUkFTSF9JRCA9ICdtb3ZlRmlsZVRvVHJhc2gnO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBNT1ZFX0ZJTEVfVE9fVFJBU0hfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlclJlc291cmNlTW92ZWFibGVUb1RyYXNoKSxcblx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdG1hYzoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0c2Vjb25kYXJ5OiBbS2V5Q29kZS5EZWxldGVdXG5cdH0sXG5cdGhhbmRsZXI6IG1vdmVGaWxlVG9UcmFzaEhhbmRsZXJcbn0pO1xuXG5jb25zdCBERUxFVEVfRklMRV9JRCA9ICdkZWxldGVGaWxlJztcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogREVMRVRFX0ZJTEVfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBGaWxlc0V4cGxvcmVyRm9jdXNDb25kaXRpb24sXG5cdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRGVsZXRlLFxuXHRtYWM6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkJhY2tzcGFjZVxuXHR9LFxuXHRoYW5kbGVyOiBkZWxldGVGaWxlSGFuZGxlclxufSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogREVMRVRFX0ZJTEVfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlclJlc291cmNlTW92ZWFibGVUb1RyYXNoLnRvTmVnYXRlZCgpKSxcblx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdG1hYzoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2Vcblx0fSxcblx0aGFuZGxlcjogZGVsZXRlRmlsZUhhbmRsZXJcbn0pO1xuXG5jb25zdCBDVVRfRklMRV9JRCA9ICdmaWxlc0V4cGxvcmVyLmN1dCc7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IENVVF9GSUxFX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIGV4cGxvcmVyQ29tbWFuZHNXZWlnaHRCb251cyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSwgRXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dCksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlYLFxuXHRoYW5kbGVyOiBjdXRGaWxlSGFuZGxlcixcbn0pO1xuXG5jb25zdCBDT1BZX0ZJTEVfSUQgPSAnZmlsZXNFeHBsb3Jlci5jb3B5JztcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogQ09QWV9GSUxFX0lELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIGV4cGxvcmVyQ29tbWFuZHNXZWlnaHRCb251cyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlDLFxuXHRoYW5kbGVyOiBjb3B5RmlsZUhhbmRsZXIsXG59KTtcblxuY29uc3QgUEFTVEVfRklMRV9JRCA9ICdmaWxlc0V4cGxvcmVyLnBhc3RlJztcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoUEFTVEVfRklMRV9JRCwgcGFzdGVGaWxlSGFuZGxlcik7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBgXiR7UEFTVEVfRklMRV9JRH1gLCAvLyB0aGUgYF5gIGVuYWJsZXMgcGFzdGluZyBmaWxlcyBpbnRvIHRoZSBleHBsb3JlciBieSBwcmV2ZW50aW5nIGRlZmF1bHQgYnViYmxlIHVwXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlclJlc291cmNlV3JpdGFibGVDb250ZXh0KSxcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVYsXG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnZmlsZXNFeHBsb3Jlci5jYW5jZWxDdXQnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIGV4cGxvcmVyQ29tbWFuZHNXZWlnaHRCb251cyxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJSZXNvdXJjZUN1dCksXG5cdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLnNldFRvQ29weShbXSwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdmaWxlc0V4cGxvcmVyLm9wZW5GaWxlUHJlc2VydmVGb2N1cycsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgZXhwbG9yZXJDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBFeHBsb3JlckZvbGRlckNvbnRleHQudG9OZWdhdGVkKCkpLFxuXHRwcmltYXJ5OiBLZXlDb2RlLlNwYWNlLFxuXHRoYW5kbGVyOiBvcGVuRmlsZVByZXNlcnZlRm9jdXNIYW5kbGVyXG59KTtcblxuY29uc3QgY29weVBhdGhDb21tYW5kID0ge1xuXHRpZDogQ09QWV9QQVRIX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUoJ2NvcHlQYXRoJywgXCJDb3B5IFBhdGhcIilcbn07XG5cbmNvbnN0IGNvcHlSZWxhdGl2ZVBhdGhDb21tYW5kID0ge1xuXHRpZDogQ09QWV9SRUxBVElWRV9QQVRIX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUoJ2NvcHlSZWxhdGl2ZVBhdGgnLCBcIkNvcHkgUmVsYXRpdmUgUGF0aFwiKVxufTtcblxuZXhwb3J0IGNvbnN0IHJldmVhbEluU2lkZUJhckNvbW1hbmQgPSB7XG5cdGlkOiBSRVZFQUxfSU5fRVhQTE9SRVJfQ09NTUFORF9JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZSgncmV2ZWFsSW5TaWRlQmFyJywgXCJSZXZlYWwgaW4gRXhwbG9yZXIgVmlld1wiKVxufTtcblxuLy8gRWRpdG9yIFRpdGxlIENvbnRleHQgTWVudVxuYXBwZW5kRWRpdG9yVGl0bGVDb250ZXh0TWVudUl0ZW0oQ09QWV9QQVRIX0NPTU1BTkRfSUQsIGNvcHlQYXRoQ29tbWFuZC50aXRsZSwgUmVzb3VyY2VDb250ZXh0S2V5LklzRmlsZVN5c3RlbVJlc291cmNlLCAnMV9jdXRjb3B5cGFzdGUnLCB0cnVlKTtcbmFwcGVuZEVkaXRvclRpdGxlQ29udGV4dE1lbnVJdGVtKENPUFlfUkVMQVRJVkVfUEFUSF9DT01NQU5EX0lELCBjb3B5UmVsYXRpdmVQYXRoQ29tbWFuZC50aXRsZSwgUmVzb3VyY2VDb250ZXh0S2V5LklzRmlsZVN5c3RlbVJlc291cmNlLCAnMV9jdXRjb3B5cGFzdGUnLCB0cnVlKTtcbmFwcGVuZEVkaXRvclRpdGxlQ29udGV4dE1lbnVJdGVtKHJldmVhbEluU2lkZUJhckNvbW1hbmQuaWQsIHJldmVhbEluU2lkZUJhckNvbW1hbmQudGl0bGUsIFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZSwgJzJfZmlsZXMnLCBmYWxzZSwgMSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBlbmRFZGl0b3JUaXRsZUNvbnRleHRNZW51SXRlbShpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCB3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCwgZ3JvdXA6IHN0cmluZywgc3VwcG9ydHNNdWx0aVNlbGVjdDogYm9vbGVhbiwgb3JkZXI/OiBudW1iZXIpOiB2b2lkIHtcblx0Y29uc3QgcHJlY29uZGl0aW9uID0gc3VwcG9ydHNNdWx0aVNlbGVjdCAhPT0gdHJ1ZSA/IE11bHRpcGxlRWRpdG9yc1NlbGVjdGVkSW5Hcm91cENvbnRleHQubmVnYXRlKCkgOiB1bmRlZmluZWQ7XG5cblx0Ly8gTWVudVxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwge1xuXHRcdGNvbW1hbmQ6IHsgaWQsIHRpdGxlLCBwcmVjb25kaXRpb24gfSxcblx0XHR3aGVuLFxuXHRcdGdyb3VwLFxuXHRcdG9yZGVyLFxuXHR9KTtcbn1cblxuLy8gRWRpdG9yIFRpdGxlIE1lbnUgZm9yIENvbmZsaWN0IFJlc29sdXRpb25cbmFwcGVuZFNhdmVDb25mbGljdEVkaXRvclRpdGxlQWN0aW9uKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLmFjY2VwdExvY2FsQ2hhbmdlcycsIG5scy5sb2NhbGl6ZSgnYWNjZXB0TG9jYWxDaGFuZ2VzJywgXCJVc2UgeW91ciBjaGFuZ2VzIGFuZCBvdmVyd3JpdGUgZmlsZSBjb250ZW50c1wiKSwgQ29kaWNvbi5jaGVjaywgLTEwLCBhY2NlcHRMb2NhbENoYW5nZXNDb21tYW5kKTtcbmFwcGVuZFNhdmVDb25mbGljdEVkaXRvclRpdGxlQWN0aW9uKCd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnJldmVydExvY2FsQ2hhbmdlcycsIG5scy5sb2NhbGl6ZSgncmV2ZXJ0TG9jYWxDaGFuZ2VzJywgXCJEaXNjYXJkIHlvdXIgY2hhbmdlcyBhbmQgcmV2ZXJ0IHRvIGZpbGUgY29udGVudHNcIiksIENvZGljb24uZGlzY2FyZCwgLTksIHJldmVydExvY2FsQ2hhbmdlc0NvbW1hbmQpO1xuXG5mdW5jdGlvbiBhcHBlbmRTYXZlQ29uZmxpY3RFZGl0b3JUaXRsZUFjdGlvbihpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBpY29uOiBUaGVtZUljb24sIG9yZGVyOiBudW1iZXIsIGNvbW1hbmQ6IElDb21tYW5kSGFuZGxlcik6IHZvaWQge1xuXG5cdC8vIENvbW1hbmRcblx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoaWQsIGNvbW1hbmQpO1xuXG5cdC8vIEFjdGlvblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlLCB7XG5cdFx0Y29tbWFuZDogeyBpZCwgdGl0bGUsIGljb24gfSxcblx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoQ09ORkxJQ1RfUkVTT0xVVElPTl9DT05URVhULCB0cnVlKSxcblx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdG9yZGVyXG5cdH0pO1xufVxuXG4vLyBNZW51IHJlZ2lzdHJhdGlvbiAtIGNvbW1hbmQgcGFsZXR0ZVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kVG9Db21tYW5kUGFsZXR0ZSh7IGlkLCB0aXRsZSwgY2F0ZWdvcnksIG1ldGFkYXRhIH06IElDb21tYW5kQWN0aW9uLCB3aGVuPzogQ29udGV4dEtleUV4cHJlc3Npb24pOiB2b2lkIHtcblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGUsXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdG1ldGFkYXRhXG5cdFx0fSxcblx0XHR3aGVuXG5cdH0pO1xufVxuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IENPUFlfUEFUSF9DT01NQU5EX0lELFxuXHR0aXRsZTogbmxzLmxvY2FsaXplMignY29weVBhdGhPZkFjdGl2ZScsIFwiQ29weSBQYXRoIG9mIEFjdGl2ZSBGaWxlXCIpLFxuXHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlXG59KTtcbmFwcGVuZFRvQ29tbWFuZFBhbGV0dGUoe1xuXHRpZDogQ09QWV9SRUxBVElWRV9QQVRIX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUyKCdjb3B5UmVsYXRpdmVQYXRoT2ZBY3RpdmUnLCBcIkNvcHkgUmVsYXRpdmUgUGF0aCBvZiBBY3RpdmUgRmlsZVwiKSxcblx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZVxufSk7XG5cbmFwcGVuZFRvQ29tbWFuZFBhbGV0dGUoe1xuXHRpZDogU0FWRV9GSUxFX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBTQVZFX0ZJTEVfTEFCRUwsXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGVcbn0pO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IFNBVkVfRklMRV9XSVRIT1VUX0ZPUk1BVFRJTkdfQ09NTUFORF9JRCxcblx0dGl0bGU6IFNBVkVfRklMRV9XSVRIT1VUX0ZPUk1BVFRJTkdfTEFCRUwsXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGVcbn0pO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IFNBVkVfQUxMX0lOX0dST1VQX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUyKCdzYXZlQWxsSW5Hcm91cCcsIFwiU2F2ZSBBbGwgaW4gR3JvdXBcIiksXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGVcbn0pO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IFNBVkVfRklMRVNfQ09NTUFORF9JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3NhdmVGaWxlcycsIFwiU2F2ZSBBbGwgRmlsZXNcIiksXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGVcbn0pO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IFJFVkVSVF9GSUxFX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUyKCdyZXZlcnQnLCBcIlJldmVydCBGaWxlXCIpLFxuXHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlXG59KTtcblxuYXBwZW5kVG9Db21tYW5kUGFsZXR0ZSh7XG5cdGlkOiBDT01QQVJFX1dJVEhfU0FWRURfQ09NTUFORF9JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2NvbXBhcmVBY3RpdmVXaXRoU2F2ZWQnLCBcIkNvbXBhcmUgQWN0aXZlIEZpbGUgd2l0aCBTYXZlZFwiKSxcblx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZSxcblx0bWV0YWRhdGE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignY29tcGFyZUFjdGl2ZVdpdGhTYXZlZE1ldGEnLCBcIk9wZW5zIGEgbmV3IGRpZmYgZWRpdG9yIHRvIGNvbXBhcmUgdGhlIGFjdGl2ZSBmaWxlIHdpdGggdGhlIHZlcnNpb24gb24gZGlzay5cIilcblx0fVxufSk7XG5cbmFwcGVuZFRvQ29tbWFuZFBhbGV0dGUoe1xuXHRpZDogU0FWRV9GSUxFX0FTX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBTQVZFX0ZJTEVfQVNfTEFCRUwsXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGVcbn0pO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IE5FV19GSUxFX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBORVdfRklMRV9MQUJFTCxcblx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZVxufSwgV29ya3NwYWNlRm9sZGVyQ291bnRDb250ZXh0Lm5vdEVxdWFsc1RvKCcwJykpO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IE5FV19GT0xERVJfQ09NTUFORF9JRCxcblx0dGl0bGU6IE5FV19GT0xERVJfTEFCRUwsXG5cdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGUsXG5cdG1ldGFkYXRhOiB7IGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCduZXdGb2xkZXJEZXNjcmlwdGlvbicsIFwiQ3JlYXRlIGEgbmV3IGZvbGRlciBvciBkaXJlY3RvcnlcIikgfVxufSwgV29ya3NwYWNlRm9sZGVyQ291bnRDb250ZXh0Lm5vdEVxdWFsc1RvKCcwJykpO1xuXG5hcHBlbmRUb0NvbW1hbmRQYWxldHRlKHtcblx0aWQ6IE5FV19VTlRJVExFRF9GSUxFX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBORVdfVU5USVRMRURfRklMRV9MQUJFTCxcblx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZVxufSk7XG5cbi8vIE1lbnUgcmVnaXN0cmF0aW9uIC0gb3BlbiBlZGl0b3JzXG5cbmNvbnN0IGlzRmlsZU9yVW50aXRsZWRSZXNvdXJjZUNvbnRleHRLZXkgPSBDb250ZXh0S2V5RXhwci5vcihSZXNvdXJjZUNvbnRleHRLZXkuSXNGaWxlU3lzdGVtUmVzb3VyY2UsIFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUuaXNFcXVhbFRvKFNjaGVtYXMudW50aXRsZWQpKTtcblxuY29uc3Qgb3BlblRvU2lkZUNvbW1hbmQgPSB7XG5cdGlkOiBPUEVOX1RPX1NJREVfQ09NTUFORF9JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnb3BlblRvU2lkZScsIFwiT3BlbiB0byB0aGUgU2lkZVwiKVxufTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdG9yZGVyOiAxMCxcblx0Y29tbWFuZDogb3BlblRvU2lkZUNvbW1hbmQsXG5cdHdoZW46IGlzRmlsZU9yVW50aXRsZWRSZXNvdXJjZUNvbnRleHRLZXlcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk9wZW5FZGl0b3JzQ29udGV4dCwge1xuXHRncm91cDogJzFfb3BlbicsXG5cdG9yZGVyOiAxMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBSRU9QRU5fV0lUSF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3Jlb3BlbldpdGgnLCBcIlJlb3BlbiBFZGl0b3IgV2l0aC4uLlwiKVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0Ly8gRWRpdG9ycyB3aXRoIEF2YWlsYWJsZSBDaG9pY2VzIHRvIE9wZW4gV2l0aFxuXHRcdEFjdGl2ZUVkaXRvckF2YWlsYWJsZUVkaXRvcklkc0NvbnRleHQsXG5cdFx0Ly8gTm90OiBlZGl0b3IgZ3JvdXBzXG5cdFx0T3BlbkVkaXRvcnNHcm91cENvbnRleHQudG9OZWdhdGVkKClcblx0KVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnMV9jdXRjb3B5cGFzdGUnLFxuXHRvcmRlcjogMTAsXG5cdGNvbW1hbmQ6IGNvcHlQYXRoQ29tbWFuZCxcblx0d2hlbjogUmVzb3VyY2VDb250ZXh0S2V5LklzRmlsZVN5c3RlbVJlc291cmNlXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHQsIHtcblx0Z3JvdXA6ICcxX2N1dGNvcHlwYXN0ZScsXG5cdG9yZGVyOiAyMCxcblx0Y29tbWFuZDogY29weVJlbGF0aXZlUGF0aENvbW1hbmQsXG5cdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnMl9zYXZlJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNBVkVfRklMRV9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBTQVZFX0ZJTEVfTEFCRUwsXG5cdFx0cHJlY29uZGl0aW9uOiBPcGVuRWRpdG9yc0RpcnR5RWRpdG9yQ29udGV4dFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHQvLyBVbnRpdGxlZCBFZGl0b3JzXG5cdFx0UmVzb3VyY2VDb250ZXh0S2V5LlNjaGVtZS5pc0VxdWFsVG8oU2NoZW1hcy51bnRpdGxlZCksXG5cdFx0Ly8gT3I6XG5cdFx0Q29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0Ly8gTm90OiBlZGl0b3IgZ3JvdXBzXG5cdFx0XHRPcGVuRWRpdG9yc0dyb3VwQ29udGV4dC50b05lZ2F0ZWQoKSxcblx0XHRcdC8vIE5vdDogcmVhZG9ubHkgZWRpdG9yc1xuXHRcdFx0T3BlbkVkaXRvcnNSZWFkb25seUVkaXRvckNvbnRleHQudG9OZWdhdGVkKCksXG5cdFx0XHQvLyBOb3Q6IGF1dG8gc2F2ZSBhZnRlciBzaG9ydCBkZWxheVxuXHRcdFx0QXV0b1NhdmVBZnRlclNob3J0RGVsYXlDb250ZXh0LnRvTmVnYXRlZCgpXG5cdFx0KVxuXHQpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHQsIHtcblx0Z3JvdXA6ICcyX3NhdmUnLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogUkVWRVJUX0ZJTEVfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdyZXZlcnQnLCBcIlJldmVydCBGaWxlXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogT3BlbkVkaXRvcnNEaXJ0eUVkaXRvckNvbnRleHRcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdC8vIE5vdDogZWRpdG9yIGdyb3Vwc1xuXHRcdE9wZW5FZGl0b3JzR3JvdXBDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdC8vIE5vdDogcmVhZG9ubHkgZWRpdG9yc1xuXHRcdE9wZW5FZGl0b3JzUmVhZG9ubHlFZGl0b3JDb250ZXh0LnRvTmVnYXRlZCgpLFxuXHRcdC8vIE5vdDogdW50aXRsZWQgZWRpdG9ycyAocmV2ZXJ0IGNsb3NlcyB0aGVtKVxuXHRcdFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUubm90RXF1YWxzVG8oU2NoZW1hcy51bnRpdGxlZCksXG5cdFx0Ly8gTm90OiBhdXRvIHNhdmUgYWZ0ZXIgc2hvcnQgZGVsYXlcblx0XHRBdXRvU2F2ZUFmdGVyU2hvcnREZWxheUNvbnRleHQudG9OZWdhdGVkKClcblx0KVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnMl9zYXZlJyxcblx0b3JkZXI6IDMwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNBVkVfQUxMX0lOX0dST1VQX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2F2ZUFsbCcsIFwiU2F2ZSBBbGxcIiksXG5cdFx0cHJlY29uZGl0aW9uOiBEaXJ0eVdvcmtpbmdDb3BpZXNDb250ZXh0XG5cdH0sXG5cdC8vIEVkaXRvciBHcm91cFxuXHR3aGVuOiBPcGVuRWRpdG9yc0dyb3VwQ29udGV4dFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnM19jb21wYXJlJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENPTVBBUkVfV0lUSF9TQVZFRF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2NvbXBhcmVXaXRoU2F2ZWQnLCBcIkNvbXBhcmUgd2l0aCBTYXZlZFwiKSxcblx0XHRwcmVjb25kaXRpb246IE9wZW5FZGl0b3JzRGlydHlFZGl0b3JDb250ZXh0XG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChSZXNvdXJjZUNvbnRleHRLZXkuSXNGaWxlU3lzdGVtUmVzb3VyY2UsIEF1dG9TYXZlQWZ0ZXJTaG9ydERlbGF5Q29udGV4dC50b05lZ2F0ZWQoKSwgV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbi50b05lZ2F0ZWQoKSlcbn0pO1xuXG5jb25zdCBjb21wYXJlUmVzb3VyY2VDb21tYW5kID0ge1xuXHRpZDogQ09NUEFSRV9SRVNPVVJDRV9DT01NQU5EX0lELFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdjb21wYXJlV2l0aFNlbGVjdGVkJywgXCJDb21wYXJlIHdpdGggU2VsZWN0ZWRcIilcbn07XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk9wZW5FZGl0b3JzQ29udGV4dCwge1xuXHRncm91cDogJzNfY29tcGFyZScsXG5cdG9yZGVyOiAyMCxcblx0Y29tbWFuZDogY29tcGFyZVJlc291cmNlQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSwgUmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0LCBpc0ZpbGVPclVudGl0bGVkUmVzb3VyY2VDb250ZXh0S2V5LCBXb3JrYmVuY2hMaXN0RG91YmxlU2VsZWN0aW9uLnRvTmVnYXRlZCgpKVxufSk7XG5cbmNvbnN0IHNlbGVjdEZvckNvbXBhcmVDb21tYW5kID0ge1xuXHRpZDogU0VMRUNUX0ZPUl9DT01QQVJFX0NPTU1BTkRfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUoJ2NvbXBhcmVTb3VyY2UnLCBcIlNlbGVjdCBmb3IgQ29tcGFyZVwiKVxufTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuT3BlbkVkaXRvcnNDb250ZXh0LCB7XG5cdGdyb3VwOiAnM19jb21wYXJlJyxcblx0b3JkZXI6IDMwLFxuXHRjb21tYW5kOiBzZWxlY3RGb3JDb21wYXJlQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSwgaXNGaWxlT3JVbnRpdGxlZFJlc291cmNlQ29udGV4dEtleSwgV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbi50b05lZ2F0ZWQoKSlcbn0pO1xuXG5jb25zdCBjb21wYXJlU2VsZWN0ZWRDb21tYW5kID0ge1xuXHRpZDogQ09NUEFSRV9TRUxFQ1RFRF9DT01NQU5EX0lELFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdjb21wYXJlU2VsZWN0ZWQnLCBcIkNvbXBhcmUgU2VsZWN0ZWRcIilcbn07XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk9wZW5FZGl0b3JzQ29udGV4dCwge1xuXHRncm91cDogJzNfY29tcGFyZScsXG5cdG9yZGVyOiAzMCxcblx0Y29tbWFuZDogY29tcGFyZVNlbGVjdGVkQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSwgV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbiwgT3BlbkVkaXRvcnNTZWxlY3RlZEZpbGVPclVudGl0bGVkQ29udGV4dClcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkVkaXRvclRpdGxlQ29udGV4dCwge1xuXHRncm91cDogJzFfY29tcGFyZScsXG5cdG9yZGVyOiAzMCxcblx0Y29tbWFuZDogY29tcGFyZVNlbGVjdGVkQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSwgVHdvRWRpdG9yc1NlbGVjdGVkSW5Hcm91cENvbnRleHQsIFNlbGVjdGVkRWRpdG9yc0luR3JvdXBGaWxlT3JVbnRpdGxlZFJlc291cmNlQ29udGV4dEtleSlcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk9wZW5FZGl0b3JzQ29udGV4dCwge1xuXHRncm91cDogJzRfY2xvc2UnLFxuXHRvcmRlcjogMTAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ0xPU0VfRURJVE9SX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnY2xvc2UnLCBcIkNsb3NlXCIpXG5cdH0sXG5cdHdoZW46IE9wZW5FZGl0b3JzR3JvdXBDb250ZXh0LnRvTmVnYXRlZCgpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHQsIHtcblx0Z3JvdXA6ICc0X2Nsb3NlJyxcblx0b3JkZXI6IDIwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENMT1NFX09USEVSX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdjbG9zZU90aGVycycsIFwiQ2xvc2UgT3RoZXJzXCIpXG5cdH0sXG5cdHdoZW46IE9wZW5FZGl0b3JzR3JvdXBDb250ZXh0LnRvTmVnYXRlZCgpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHQsIHtcblx0Z3JvdXA6ICc0X2Nsb3NlJyxcblx0b3JkZXI6IDMwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENMT1NFX1NBVkVEX0VESVRPUlNfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdjbG9zZVNhdmVkJywgXCJDbG9zZSBTYXZlZFwiKVxuXHR9XG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHQsIHtcblx0Z3JvdXA6ICc0X2Nsb3NlJyxcblx0b3JkZXI6IDQwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENMT1NFX0VESVRPUlNfSU5fR1JPVVBfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdjbG9zZUFsbCcsIFwiQ2xvc2UgQWxsXCIpXG5cdH1cbn0pO1xuXG4vLyBNZW51IHJlZ2lzdHJhdGlvbiAtIGV4cGxvcmVyXG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdG9yZGVyOiA0LFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IE5FV19GSUxFX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IE5FV19GSUxFX0xBQkVMLFxuXHRcdHByZWNvbmRpdGlvbjogRXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dFxuXHR9LFxuXHR3aGVuOiBFeHBsb3JlckZvbGRlckNvbnRleHRcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRvcmRlcjogNixcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBORVdfRk9MREVSX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IE5FV19GT0xERVJfTEFCRUwsXG5cdFx0cHJlY29uZGl0aW9uOiBFeHBsb3JlclJlc291cmNlV3JpdGFibGVDb250ZXh0XG5cdH0sXG5cdHdoZW46IEV4cGxvcmVyRm9sZGVyQ29udGV4dFxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdG9yZGVyOiAxMCxcblx0Y29tbWFuZDogb3BlblRvU2lkZUNvbW1hbmQsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFeHBsb3JlckZvbGRlckNvbnRleHQudG9OZWdhdGVkKCksIFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSlcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogT1BFTl9XSVRIX0VYUExPUkVSX0NPTU1BTkRfSUQsXG5cdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnZXhwbG9yZXJPcGVuV2l0aCcsIFwiT3BlbiBXaXRoLi4uXCIpLFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJGb2xkZXJDb250ZXh0LnRvTmVnYXRlZCgpLCBFeHBsb3JlclJlc291cmNlQXZhaWxhYmxlRWRpdG9ySWRzQ29udGV4dCksXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHtcblx0Z3JvdXA6ICczX2NvbXBhcmUnLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IGNvbXBhcmVSZXNvdXJjZUNvbW1hbmQsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFeHBsb3JlckZvbGRlckNvbnRleHQudG9OZWdhdGVkKCksIFJlc291cmNlQ29udGV4dEtleS5IYXNSZXNvdXJjZSwgUmVzb3VyY2VTZWxlY3RlZEZvckNvbXBhcmVDb250ZXh0LCBXb3JrYmVuY2hMaXN0RG91YmxlU2VsZWN0aW9uLnRvTmVnYXRlZCgpKVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnM19jb21wYXJlJyxcblx0b3JkZXI6IDMwLFxuXHRjb21tYW5kOiBzZWxlY3RGb3JDb21wYXJlQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEV4cGxvcmVyRm9sZGVyQ29udGV4dC50b05lZ2F0ZWQoKSwgUmVzb3VyY2VDb250ZXh0S2V5Lkhhc1Jlc291cmNlLCBXb3JrYmVuY2hMaXN0RG91YmxlU2VsZWN0aW9uLnRvTmVnYXRlZCgpKVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnM19jb21wYXJlJyxcblx0b3JkZXI6IDMwLFxuXHRjb21tYW5kOiBjb21wYXJlU2VsZWN0ZWRDb21tYW5kLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJGb2xkZXJDb250ZXh0LnRvTmVnYXRlZCgpLCBSZXNvdXJjZUNvbnRleHRLZXkuSGFzUmVzb3VyY2UsIFdvcmtiZW5jaExpc3REb3VibGVTZWxlY3Rpb24pXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHtcblx0Z3JvdXA6ICc1X2N1dGNvcHlwYXN0ZScsXG5cdG9yZGVyOiA4LFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENVVF9GSUxFX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2N1dCcsIFwiQ3V0XCIpLFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSwgRXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dClcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJzVfY3V0Y29weXBhc3RlJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENPUFlfRklMRV9JRCxcblx0XHR0aXRsZTogQ09QWV9GSUxFX0xBQkVMLFxuXHR9LFxuXHR3aGVuOiBFeHBsb3JlclJvb3RDb250ZXh0LnRvTmVnYXRlZCgpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHtcblx0Z3JvdXA6ICc1X2N1dGNvcHlwYXN0ZScsXG5cdG9yZGVyOiAyMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBQQVNURV9GSUxFX0lELFxuXHRcdHRpdGxlOiBQQVNURV9GSUxFX0xBQkVMLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKEV4cGxvcmVyUmVzb3VyY2VXcml0YWJsZUNvbnRleHQsIEZpbGVDb3BpZWRDb250ZXh0KVxuXHR9LFxuXHR3aGVuOiBFeHBsb3JlckZvbGRlckNvbnRleHRcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwgKHtcblx0Z3JvdXA6ICc1Yl9pbXBvcnRleHBvcnQnLFxuXHRvcmRlcjogMTAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogRE9XTkxPQURfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogRE9XTkxPQURfTEFCRUxcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0Ly8gbmF0aXZlOiBmb3IgYW55IHJlbW90ZSByZXNvdXJjZVxuXHRcdENvbnRleHRLZXlFeHByLmFuZChJc1dlYkNvbnRleHQudG9OZWdhdGVkKCksIFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUubm90RXF1YWxzVG8oU2NoZW1hcy5maWxlKSksXG5cdFx0Ly8gd2ViOiBmb3IgYW55IGZpbGVzXG5cdFx0Q29udGV4dEtleUV4cHIuYW5kKElzV2ViQ29udGV4dCwgRXhwbG9yZXJGb2xkZXJDb250ZXh0LnRvTmVnYXRlZCgpLCBFeHBsb3JlclJvb3RDb250ZXh0LnRvTmVnYXRlZCgpKSxcblx0XHQvLyB3ZWI6IGZvciBhbnkgZm9sZGVycyBpZiBmaWxlIHN5c3RlbSBBUEkgc3VwcG9ydCBpcyBwcm92aWRlZFxuXHRcdENvbnRleHRLZXlFeHByLmFuZChJc1dlYkNvbnRleHQsIEhhc1dlYkZpbGVTeXN0ZW1BY2Nlc3MpXG5cdClcbn0pKTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsICh7XG5cdGdyb3VwOiAnNWJfaW1wb3J0ZXhwb3J0Jyxcblx0b3JkZXI6IDIwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFVQTE9BRF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBVUExPQURfTEFCRUwsXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHQvLyBvbmx5IGluIHdlYlxuXHRcdElzV2ViQ29udGV4dCxcblx0XHQvLyBvbmx5IG9uIGZvbGRlcnNcblx0XHRFeHBsb3JlckZvbGRlckNvbnRleHQsXG5cdFx0Ly8gb25seSBvbiB3cml0YWJsZSBmb2xkZXJzXG5cdFx0RXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dFxuXHQpXG59KSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnNl9jb3B5cGF0aCcsXG5cdG9yZGVyOiAxMCxcblx0Y29tbWFuZDogY29weVBhdGhDb21tYW5kLFxuXHR3aGVuOiBSZXNvdXJjZUNvbnRleHRLZXkuSXNGaWxlU3lzdGVtUmVzb3VyY2Vcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJzZfY29weXBhdGgnLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IGNvcHlSZWxhdGl2ZVBhdGhDb21tYW5kLFxuXHR3aGVuOiBSZXNvdXJjZUNvbnRleHRLZXkuSXNGaWxlU3lzdGVtUmVzb3VyY2Vcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJzJfd29ya3NwYWNlJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IEFERF9ST09UX0ZPTERFUl9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBBRERfUk9PVF9GT0xERVJfTEFCRUwsXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFeHBsb3JlclJvb3RDb250ZXh0LCBDb250ZXh0S2V5RXhwci5vcihFbnRlck11bHRpUm9vdFdvcmtzcGFjZVN1cHBvcnRDb250ZXh0LCBXb3JrYmVuY2hTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCd3b3Jrc3BhY2UnKSkpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHtcblx0Z3JvdXA6ICcyX3dvcmtzcGFjZScsXG5cdG9yZGVyOiAzMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBSRU1PVkVfUk9PVF9GT0xERVJfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogUkVNT1ZFX1JPT1RfRk9MREVSX0xBQkVMLFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJSb290Q29udGV4dCwgRXhwbG9yZXJGb2xkZXJDb250ZXh0LCBDb250ZXh0S2V5RXhwci5hbmQoV29ya3NwYWNlRm9sZGVyQ291bnRDb250ZXh0Lm5vdEVxdWFsc1RvKCcwJyksIENvbnRleHRLZXlFeHByLm9yKEVudGVyTXVsdGlSb290V29ya3NwYWNlU3VwcG9ydENvbnRleHQsIFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpKSkpXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FeHBsb3JlckNvbnRleHQsIHtcblx0Z3JvdXA6ICc3X21vZGlmaWNhdGlvbicsXG5cdG9yZGVyOiAxMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBSRU5BTUVfSUQsXG5cdFx0dGl0bGU6IFRSSUdHRVJfUkVOQU1FX0xBQkVMLFxuXHRcdHByZWNvbmRpdGlvbjogRXhwbG9yZXJSZXNvdXJjZVdyaXRhYmxlQ29udGV4dCxcblx0fSxcblx0d2hlbjogRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRXhwbG9yZXJDb250ZXh0LCB7XG5cdGdyb3VwOiAnN19tb2RpZmljYXRpb24nLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogTU9WRV9GSUxFX1RPX1RSQVNIX0lELFxuXHRcdHRpdGxlOiBNT1ZFX0ZJTEVfVE9fVFJBU0hfTEFCRUxcblx0fSxcblx0YWx0OiB7XG5cdFx0aWQ6IERFTEVURV9GSUxFX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2RlbGV0ZUZpbGUnLCBcIkRlbGV0ZSBQZXJtYW5lbnRseVwiKVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSwgRXhwbG9yZXJSZXNvdXJjZU1vdmVhYmxlVG9UcmFzaClcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkV4cGxvcmVyQ29udGV4dCwge1xuXHRncm91cDogJzdfbW9kaWZpY2F0aW9uJyxcblx0b3JkZXI6IDIwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IERFTEVURV9GSUxFX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2RlbGV0ZUZpbGUnLCBcIkRlbGV0ZSBQZXJtYW5lbnRseVwiKVxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRXhwbG9yZXJSb290Q29udGV4dC50b05lZ2F0ZWQoKSwgRXhwbG9yZXJSZXNvdXJjZU1vdmVhYmxlVG9UcmFzaC50b05lZ2F0ZWQoKSlcbn0pO1xuXG4vLyBFbXB0eSBFZGl0b3IgR3JvdXAgLyBFZGl0b3IgVGFicyBDb250YWluZXIgQ29udGV4dCBNZW51XG5mb3IgKGNvbnN0IG1lbnVJZCBvZiBbTWVudUlkLkVtcHR5RWRpdG9yR3JvdXBDb250ZXh0LCBNZW51SWQuRWRpdG9yVGFic0JhckNvbnRleHRdKSB7XG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShtZW51SWQsIHsgY29tbWFuZDogeyBpZDogTkVXX1VOVElUTEVEX0ZJTEVfQ09NTUFORF9JRCwgdGl0bGU6IG5scy5sb2NhbGl6ZSgnbmV3RmlsZScsIFwiTmV3IFRleHQgRmlsZVwiKSB9LCBncm91cDogJzFfZmlsZScsIG9yZGVyOiAxMCB9KTtcblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKG1lbnVJZCwgeyBjb21tYW5kOiB7IGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW4nLCB0aXRsZTogbmxzLmxvY2FsaXplKCdvcGVuRmlsZScsIFwiT3BlbiBGaWxlLi4uXCIpIH0sIGdyb3VwOiAnMV9maWxlJywgb3JkZXI6IDIwIH0pO1xufVxuXG4vLyBGaWxlIG1lbnVcblxuXG4vLyBWb2lkIGFkZGVkIHRoaXM6XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJGaWxlTWVudSwge1xuXHRncm91cDogJzBfdm9pZCcsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogVk9JRF9PUEVOX1NFVFRJTkdTX0FDVElPTl9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnb3BlblZvaWQnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZPcGVuIFZvaWQgU2V0dGluZ3NcIiksXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJGaWxlTWVudSwge1xuXHRncm91cDogJzFfbmV3Jyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBORVdfVU5USVRMRURfRklMRV9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaU5ld0ZpbGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZOZXcgVGV4dCBGaWxlXCIpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsIHtcblx0Z3JvdXA6ICc0X3NhdmUnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNBVkVfRklMRV9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVNhdmUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZTYXZlXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQWN0aXZlRWRpdG9yQ29udGV4dCwgQ29udGV4dEtleUV4cHIuYW5kKEZvbGRlcnNWaWV3VmlzaWJsZUNvbnRleHQsIFNpZGViYXJGb2N1c0NvbnRleHQpKVxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdGdyb3VwOiAnNF9zYXZlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBTQVZFX0ZJTEVfQVNfQ09NTUFORF9JRCxcblx0XHR0aXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlTYXZlQXMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiU2F2ZSAmJkFzLi4uXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQWN0aXZlRWRpdG9yQ29udGV4dCwgQ29udGV4dEtleUV4cHIuYW5kKEZvbGRlcnNWaWV3VmlzaWJsZUNvbnRleHQsIFNpZGViYXJGb2N1c0NvbnRleHQpKVxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdGdyb3VwOiAnNF9zYXZlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBTQVZFX0FMTF9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVNhdmVBbGwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiU2F2ZSBBJiZsbFwiKSxcblx0XHRwcmVjb25kaXRpb246IERpcnR5V29ya2luZ0NvcGllc0NvbnRleHRcblx0fSxcblx0b3JkZXI6IDNcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJGaWxlTWVudSwge1xuXHRncm91cDogJzVfYXV0b3NhdmUnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFRvZ2dsZUF1dG9TYXZlQWN0aW9uLklELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUF1dG9TYXZlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkEmJnV0byBTYXZlXCIpLFxuXHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnY29uZmlnLmZpbGVzLmF1dG9TYXZlJywgJ29mZicpXG5cdH0sXG5cdG9yZGVyOiAxXG59KTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyRmlsZU1lbnUsIHtcblx0Z3JvdXA6ICc2X2Nsb3NlJyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBSRVZFUlRfRklMRV9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVJldmVydCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJSZSYmdmVydCBGaWxlXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHQvLyBBY3RpdmUgZWRpdG9yIGNhbiByZXZlcnRcblx0XHRcdENvbnRleHRLZXlFeHByLmFuZChBY3RpdmVFZGl0b3JDYW5SZXZlcnRDb250ZXh0KSxcblx0XHRcdC8vIEV4cGxvcmVyIGZvY3VzZWQgYnV0IG5vdCBvbiB1bnRpdGxlZFxuXHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5TY2hlbWUubm90RXF1YWxzVG8oU2NoZW1hcy51bnRpdGxlZCksIEZvbGRlcnNWaWV3VmlzaWJsZUNvbnRleHQsIFNpZGViYXJGb2N1c0NvbnRleHQpXG5cdFx0KSxcblx0fSxcblx0b3JkZXI6IDFcbn0pO1xuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJGaWxlTWVudSwge1xuXHRncm91cDogJzZfY2xvc2UnLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENMT1NFX0VESVRPUl9DT01NQU5EX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUNsb3NlRWRpdG9yJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2xvc2UgRWRpdG9yXCIpLFxuXHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQWN0aXZlRWRpdG9yQ29udGV4dCwgQ29udGV4dEtleUV4cHIuYW5kKEZvbGRlcnNWaWV3VmlzaWJsZUNvbnRleHQsIFNpZGViYXJGb2N1c0NvbnRleHQpKVxuXHR9LFxuXHRvcmRlcjogMlxufSk7XG5cbi8vIEdvIHRvIG1lbnVcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5NZW51YmFyR29NZW51LCB7XG5cdGdyb3VwOiAnM19nbG9iYWxfbmF2Jyxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW4nLFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaUdvdG9GaWxlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIkdvIHRvICYmRmlsZS4uLlwiKVxuXHR9LFxuXHRvcmRlcjogMVxufSk7XG5cblxuLy8gQ2hhdCB1c2VkIGF0dGFjaG1lbnQgYW5jaG9yIGNvbnRleHQgbWVudVxuXG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNoYXRBdHRhY2htZW50c0NvbnRleHQsIHtcblx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiBvcGVuVG9TaWRlQ29tbWFuZCxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZSwgRXhwbG9yZXJGb2xkZXJDb250ZXh0LnRvTmVnYXRlZCgpKVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ2hhdEF0dGFjaG1lbnRzQ29udGV4dCwge1xuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRvcmRlcjogMjAsXG5cdGNvbW1hbmQ6IHJldmVhbEluU2lkZUJhckNvbW1hbmQsXG5cdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ2hhdEF0dGFjaG1lbnRzQ29udGV4dCwge1xuXHRncm91cDogJzFfY3V0Y29weXBhc3RlJyxcblx0b3JkZXI6IDEwLFxuXHRjb21tYW5kOiBjb3B5UGF0aENvbW1hbmQsXG5cdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ2hhdEF0dGFjaG1lbnRzQ29udGV4dCwge1xuXHRncm91cDogJzFfY3V0Y29weXBhc3RlJyxcblx0b3JkZXI6IDIwLFxuXHRjb21tYW5kOiBjb3B5UmVsYXRpdmVQYXRoQ29tbWFuZCxcblx0d2hlbjogUmVzb3VyY2VDb250ZXh0S2V5LklzRmlsZVN5c3RlbVJlc291cmNlXG59KTtcblxuLy8gQ2hhdCByZXNvdXJjZSBhbmNob3IgYXR0YWNobWVudHMvYW5jaG9ycyBjb250ZXh0IG1lbnVcblxuZm9yIChjb25zdCBtZW51SWQgb2YgW01lbnVJZC5DaGF0SW5saW5lUmVzb3VyY2VBbmNob3JDb250ZXh0LCBNZW51SWQuQ2hhdElucHV0UmVzb3VyY2VBdHRhY2htZW50Q29udGV4dF0pIHtcblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKG1lbnVJZCwge1xuXHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0b3JkZXI6IDEwLFxuXHRcdGNvbW1hbmQ6IG9wZW5Ub1NpZGVDb21tYW5kLFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChSZXNvdXJjZUNvbnRleHRLZXkuSGFzUmVzb3VyY2UsIEV4cGxvcmVyRm9sZGVyQ29udGV4dC50b05lZ2F0ZWQoKSlcblx0fSk7XG5cblx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKG1lbnVJZCwge1xuXHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0b3JkZXI6IDIwLFxuXHRcdGNvbW1hbmQ6IHJldmVhbEluU2lkZUJhckNvbW1hbmQsXG5cdFx0d2hlbjogUmVzb3VyY2VDb250ZXh0S2V5LklzRmlsZVN5c3RlbVJlc291cmNlXG5cdH0pO1xuXG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShtZW51SWQsIHtcblx0XHRncm91cDogJzFfY3V0Y29weXBhc3RlJyxcblx0XHRvcmRlcjogMTAsXG5cdFx0Y29tbWFuZDogY29weVBhdGhDb21tYW5kLFxuXHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZVxuXHR9KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0obWVudUlkLCB7XG5cdFx0Z3JvdXA6ICcxX2N1dGNvcHlwYXN0ZScsXG5cdFx0b3JkZXI6IDIwLFxuXHRcdGNvbW1hbmQ6IGNvcHlSZWxhdGl2ZVBhdGhDb21tYW5kLFxuXHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5Jc0ZpbGVTeXN0ZW1SZXNvdXJjZVxuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLHNCQUFzQixvQkFBb0IsOEJBQThCLDBCQUEwQiw0QkFBNEIscUJBQXFCLGdCQUFnQix1QkFBdUIsa0JBQWtCLHNCQUFzQiwwQkFBMEIsaUJBQWlCLGtCQUFrQixtQkFBbUIsZUFBZSx3QkFBd0IsaUJBQWlCLGtCQUFrQixtQkFBbUIsZ0JBQWdCLHFC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
