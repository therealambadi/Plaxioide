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
import { isWindows, OS } from "../../../../base/common/platform.js";
import { extname, basename, isAbsolute } from "../../../../base/common/path.js";
import * as resources from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Action } from "../../../../base/common/actions.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { VIEWLET_ID, VIEW_ID, UndoConfirmLevel } from "../common/files.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IQuickInputService, ItemActivation } from "../../../../platform/quickinput/common/quickInput.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { REVEAL_IN_EXPLORER_COMMAND_ID, SAVE_ALL_IN_GROUP_COMMAND_ID, NEW_UNTITLED_FILE_COMMAND_ID } from "./fileConstants.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Schemas } from "../../../../base/common/network.js";
import { IDialogService, getFileNamesMessage } from "../../../../platform/dialogs/common/dialogs.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Constants } from "../../../../base/common/uint.js";
import { CLOSE_EDITORS_AND_GROUP_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { NewExplorerItem } from "../common/explorerModel.js";
import { getErrorMessage } from "../../../../base/common/errors.js";
import { triggerUpload } from "../../../../base/browser/dom.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { timeout } from "../../../../base/common/async.js";
import { IWorkingCopyFileService } from "../../../services/workingCopy/common/workingCopyFileService.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { trim, rtrim } from "../../../../base/common/strings.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ResourceFileEdit } from "../../../../editor/browser/services/bulkEditService.js";
import { IExplorerService } from "./files.js";
import { BrowserFileUpload, FileDownload } from "./fileImportExport.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { Action2 } from "../../../../platform/actions/common/actions.js";
import { ActiveEditorCanToggleReadonlyContext, ActiveEditorContext, EmptyWorkspaceSupportContext } from "../../../common/contextkeys.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { getPathForFile } from "../../../../platform/dnd/browser/dnd.js";
const NEW_FILE_COMMAND_ID = "explorer.newFile";
const NEW_FILE_LABEL = nls.localize2("newFile", "New File...");
const NEW_FOLDER_COMMAND_ID = "explorer.newFolder";
const NEW_FOLDER_LABEL = nls.localize2("newFolder", "New Folder...");
const TRIGGER_RENAME_LABEL = nls.localize("rename", "Rename...");
const MOVE_FILE_TO_TRASH_LABEL = nls.localize("delete", "Delete");
const COPY_FILE_LABEL = nls.localize("copyFile", "Copy");
const PASTE_FILE_LABEL = nls.localize("pasteFile", "Paste");
const FileCopiedContext = new RawContextKey("fileCopied", false);
const DOWNLOAD_COMMAND_ID = "explorer.download";
const DOWNLOAD_LABEL = nls.localize("download", "Download...");
const UPLOAD_COMMAND_ID = "explorer.upload";
const UPLOAD_LABEL = nls.localize("upload", "Upload...");
const CONFIRM_DELETE_SETTING_KEY = "explorer.confirmDelete";
const MAX_UNDO_FILE_SIZE = 5e6;
function onError(notificationService, error) {
  if (error.message === "string") {
    error = error.message;
  }
  notificationService.error(toErrorMessage(error, false));
}
async function refreshIfSeparator(value, explorerService) {
  if (value && (value.indexOf("/") >= 0 || value.indexOf("\\") >= 0)) {
    await explorerService.refresh();
  }
}
async function deleteFiles(explorerService, workingCopyFileService, dialogService, configurationService, filesConfigurationService, elements, useTrash, skipConfirm = false, ignoreIfNotExists = false) {
  let primaryButton;
  if (useTrash) {
    primaryButton = isWindows ? nls.localize("deleteButtonLabelRecycleBin", "&&Move to Recycle Bin") : nls.localize({ key: "deleteButtonLabelTrash", comment: ["&& denotes a mnemonic"] }, "&&Move to Trash");
  } else {
    primaryButton = nls.localize({ key: "deleteButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Delete");
  }
  const distinctElements = resources.distinctParents(elements, (e) => e.resource);
  const dirtyWorkingCopies = /* @__PURE__ */ new Set();
  for (const distinctElement of distinctElements) {
    for (const dirtyWorkingCopy of workingCopyFileService.getDirty(distinctElement.resource)) {
      dirtyWorkingCopies.add(dirtyWorkingCopy);
    }
  }
  if (dirtyWorkingCopies.size) {
    let message;
    if (distinctElements.length > 1) {
      message = nls.localize("dirtyMessageFilesDelete", "You are deleting files with unsaved changes. Do you want to continue?");
    } else if (distinctElements[0].isDirectory) {
      if (dirtyWorkingCopies.size === 1) {
        message = nls.localize("dirtyMessageFolderOneDelete", "You are deleting a folder {0} with unsaved changes in 1 file. Do you want to continue?", distinctElements[0].name);
      } else {
        message = nls.localize("dirtyMessageFolderDelete", "You are deleting a folder {0} with unsaved changes in {1} files. Do you want to continue?", distinctElements[0].name, dirtyWorkingCopies.size);
      }
    } else {
      message = nls.localize("dirtyMessageFileDelete", "You are deleting {0} with unsaved changes. Do you want to continue?", distinctElements[0].name);
    }
    const response = await dialogService.confirm({
      type: "warning",
      message,
      detail: nls.localize("dirtyWarning", "Your changes will be lost if you don't save them."),
      primaryButton
    });
    if (!response.confirmed) {
      return;
    } else {
      skipConfirm = true;
    }
  }
  if (!skipConfirm) {
    const readonlyResources = distinctElements.filter((e) => filesConfigurationService.isReadonly(e.resource));
    if (readonlyResources.length) {
      let message;
      if (readonlyResources.length > 1) {
        message = nls.localize("readonlyMessageFilesDelete", "You are deleting files that are configured to be read-only. Do you want to continue?");
      } else if (readonlyResources[0].isDirectory) {
        message = nls.localize("readonlyMessageFolderOneDelete", "You are deleting a folder {0} that is configured to be read-only. Do you want to continue?", distinctElements[0].name);
      } else {
        message = nls.localize("readonlyMessageFolderDelete", "You are deleting a file {0} that is configured to be read-only. Do you want to continue?", distinctElements[0].name);
      }
      const response = await dialogService.confirm({
        type: "warning",
        message,
        detail: nls.localize("continueDetail", "The read-only protection will be overridden if you continue."),
        primaryButton: nls.localize("continueButtonLabel", "Continue")
      });
      if (!response.confirmed) {
        return;
      }
    }
  }
  let confirmation;
  const deleteDetail = distinctElements.some((e) => e.isDirectory) ? nls.localize("irreversible", "This action is irreversible!") : distinctElements.length > 1 ? nls.localize("restorePlural", "You can restore these files using the Undo command.") : nls.localize("restore", "You can restore this file using the Undo command.");
  if (skipConfirm || useTrash && configurationService.getValue(CONFIRM_DELETE_SETTING_KEY) === false) {
    confirmation = { confirmed: true };
  } else if (useTrash) {
    let { message, detail } = getMoveToTrashMessage(distinctElements);
    detail += detail ? "\n" : "";
    if (isWindows) {
      detail += distinctElements.length > 1 ? nls.localize("undoBinFiles", "You can restore these files from the Recycle Bin.") : nls.localize("undoBin", "You can restore this file from the Recycle Bin.");
    } else {
      detail += distinctElements.length > 1 ? nls.localize("undoTrashFiles", "You can restore these files from the Trash.") : nls.localize("undoTrash", "You can restore this file from the Trash.");
    }
    confirmation = await dialogService.confirm({
      message,
      detail,
      primaryButton,
      checkbox: {
        label: nls.localize("doNotAskAgain", "Do not ask me again")
      }
    });
  } else {
    let { message, detail } = getDeleteMessage(distinctElements);
    detail += detail ? "\n" : "";
    detail += deleteDetail;
    confirmation = await dialogService.confirm({
      type: "warning",
      message,
      detail,
      primaryButton
    });
  }
  if (confirmation.confirmed && confirmation.checkboxChecked === true) {
    await configurationService.updateValue(CONFIRM_DELETE_SETTING_KEY, false);
  }
  if (!confirmation.confirmed) {
    return;
  }
  try {
    const resourceFileEdits = distinctElements.map((e) => new ResourceFileEdit(e.resource, void 0, { recursive: true, folder: e.isDirectory, ignoreIfNotExists, skipTrashBin: !useTrash, maxSize: MAX_UNDO_FILE_SIZE }));
    const options = {
      undoLabel: distinctElements.length > 1 ? nls.localize({ key: "deleteBulkEdit", comment: ["Placeholder will be replaced by the number of files deleted"] }, "Delete {0} files", distinctElements.length) : nls.localize({ key: "deleteFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file deleted"] }, "Delete {0}", distinctElements[0].name),
      progressLabel: distinctElements.length > 1 ? nls.localize({ key: "deletingBulkEdit", comment: ["Placeholder will be replaced by the number of files deleted"] }, "Deleting {0} files", distinctElements.length) : nls.localize({ key: "deletingFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file deleted"] }, "Deleting {0}", distinctElements[0].name)
    };
    await explorerService.applyBulkEdit(resourceFileEdits, options);
  } catch (error) {
    let errorMessage;
    let detailMessage;
    let primaryButton2;
    if (useTrash) {
      errorMessage = isWindows ? nls.localize("binFailed", "Failed to delete using the Recycle Bin. Do you want to permanently delete instead?") : nls.localize("trashFailed", "Failed to delete using the Trash. Do you want to permanently delete instead?");
      detailMessage = deleteDetail;
      primaryButton2 = nls.localize({ key: "deletePermanentlyButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Delete Permanently");
    } else {
      errorMessage = toErrorMessage(error, false);
      primaryButton2 = nls.localize({ key: "retryButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Retry");
    }
    const res = await dialogService.confirm({
      type: "warning",
      message: errorMessage,
      detail: detailMessage,
      primaryButton: primaryButton2
    });
    if (res.confirmed) {
      if (useTrash) {
        useTrash = false;
      }
      skipConfirm = true;
      ignoreIfNotExists = true;
      return deleteFiles(explorerService, workingCopyFileService, dialogService, configurationService, filesConfigurationService, elements, useTrash, skipConfirm, ignoreIfNotExists);
    }
  }
}
function getMoveToTrashMessage(distinctElements) {
  if (containsBothDirectoryAndFile(distinctElements)) {
    return {
      message: nls.localize("confirmMoveTrashMessageFilesAndDirectories", "Are you sure you want to delete the following {0} files/directories and their contents?", distinctElements.length),
      detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
    };
  }
  if (distinctElements.length > 1) {
    if (distinctElements[0].isDirectory) {
      return {
        message: nls.localize("confirmMoveTrashMessageMultipleDirectories", "Are you sure you want to delete the following {0} directories and their contents?", distinctElements.length),
        detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
      };
    }
    return {
      message: nls.localize("confirmMoveTrashMessageMultiple", "Are you sure you want to delete the following {0} files?", distinctElements.length),
      detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
    };
  }
  if (distinctElements[0].isDirectory && !distinctElements[0].isSymbolicLink) {
    return { message: nls.localize("confirmMoveTrashMessageFolder", "Are you sure you want to delete '{0}' and its contents?", distinctElements[0].name), detail: "" };
  }
  return { message: nls.localize("confirmMoveTrashMessageFile", "Are you sure you want to delete '{0}'?", distinctElements[0].name), detail: "" };
}
function getDeleteMessage(distinctElements) {
  if (containsBothDirectoryAndFile(distinctElements)) {
    return {
      message: nls.localize("confirmDeleteMessageFilesAndDirectories", "Are you sure you want to permanently delete the following {0} files/directories and their contents?", distinctElements.length),
      detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
    };
  }
  if (distinctElements.length > 1) {
    if (distinctElements[0].isDirectory) {
      return {
        message: nls.localize("confirmDeleteMessageMultipleDirectories", "Are you sure you want to permanently delete the following {0} directories and their contents?", distinctElements.length),
        detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
      };
    }
    return {
      message: nls.localize("confirmDeleteMessageMultiple", "Are you sure you want to permanently delete the following {0} files?", distinctElements.length),
      detail: getFileNamesMessage(distinctElements.map((e) => e.resource))
    };
  }
  if (distinctElements[0].isDirectory) {
    return { message: nls.localize("confirmDeleteMessageFolder", "Are you sure you want to permanently delete '{0}' and its contents?", distinctElements[0].name), detail: "" };
  }
  return { message: nls.localize("confirmDeleteMessageFile", "Are you sure you want to permanently delete '{0}'?", distinctElements[0].name), detail: "" };
}
function containsBothDirectoryAndFile(distinctElements) {
  const directory = distinctElements.find((element) => element.isDirectory);
  const file = distinctElements.find((element) => !element.isDirectory);
  return !!directory && !!file;
}
async function findValidPasteFileTarget(explorerService, fileService, dialogService, targetFolder, fileToPaste, incrementalNaming) {
  let name = typeof fileToPaste.resource === "string" ? fileToPaste.resource : resources.basenameOrAuthority(fileToPaste.resource);
  let candidate = resources.joinPath(targetFolder.resource, name);
  if (incrementalNaming === "disabled") {
    const canOverwrite = await askForOverwrite(fileService, dialogService, candidate);
    if (!canOverwrite) {
      return;
    }
  }
  while (!fileToPaste.allowOverwrite) {
    if (!explorerService.findClosest(candidate)) {
      break;
    }
    if (incrementalNaming !== "disabled") {
      name = incrementFileName(name, !!fileToPaste.isDirectory, incrementalNaming);
    }
    candidate = resources.joinPath(targetFolder.resource, name);
  }
  return candidate;
}
function incrementFileName(name, isFolder, incrementalNaming) {
  if (incrementalNaming === "simple") {
    let namePrefix = name;
    let extSuffix = "";
    if (!isFolder) {
      extSuffix = extname(name);
      namePrefix = basename(name, extSuffix);
    }
    const suffixRegex = /^(.+ copy)( \d+)?$/;
    if (suffixRegex.test(namePrefix)) {
      return namePrefix.replace(suffixRegex, (match, g1, g2) => {
        const number = g2 ? parseInt(g2) : 1;
        return number === 0 ? `${g1}` : number < Constants.MAX_SAFE_SMALL_INTEGER ? `${g1} ${number + 1}` : `${g1}${g2} copy`;
      }) + extSuffix;
    }
    return `${namePrefix} copy${extSuffix}`;
  }
  const separators = "[\\.\\-_]";
  const maxNumber = Constants.MAX_SAFE_SMALL_INTEGER;
  const suffixFileRegex = RegExp("(.*" + separators + ")(\\d+)(\\..*)$");
  if (!isFolder && name.match(suffixFileRegex)) {
    return name.replace(suffixFileRegex, (match, g1, g2, g3) => {
      const number = parseInt(g2);
      return number < maxNumber ? g1 + String(number + 1).padStart(g2.length, "0") + g3 : `${g1}${g2}.1${g3}`;
    });
  }
  const prefixFileRegex = RegExp("(\\d+)(" + separators + ".*)(\\..*)$");
  if (!isFolder && name.match(prefixFileRegex)) {
    return name.replace(prefixFileRegex, (match, g1, g2, g3) => {
      const number = parseInt(g1);
      return number < maxNumber ? String(number + 1).padStart(g1.length, "0") + g2 + g3 : `${g1}${g2}.1${g3}`;
    });
  }
  const prefixFileNoNameRegex = RegExp("(\\d+)(\\..*)$");
  if (!isFolder && name.match(prefixFileNoNameRegex)) {
    return name.replace(prefixFileNoNameRegex, (match, g1, g2) => {
      const number = parseInt(g1);
      return number < maxNumber ? String(number + 1).padStart(g1.length, "0") + g2 : `${g1}.1${g2}`;
    });
  }
  const lastIndexOfDot = name.lastIndexOf(".");
  if (!isFolder && lastIndexOfDot >= 0) {
    return `${name.substr(0, lastIndexOfDot)}.1${name.substr(lastIndexOfDot)}`;
  }
  const noNameNoExtensionRegex = RegExp("(\\d+)$");
  if (!isFolder && lastIndexOfDot === -1 && name.match(noNameNoExtensionRegex)) {
    return name.replace(noNameNoExtensionRegex, (match, g1) => {
      const number = parseInt(g1);
      return number < maxNumber ? String(number + 1).padStart(g1.length, "0") : `${g1}.1`;
    });
  }
  const noExtensionRegex = RegExp("(.*)(\\d*)$");
  if (!isFolder && lastIndexOfDot === -1 && name.match(noExtensionRegex)) {
    return name.replace(noExtensionRegex, (match, g1, g2) => {
      let number = parseInt(g2);
      if (isNaN(number)) {
        number = 0;
      }
      return number < maxNumber ? g1 + String(number + 1).padStart(g2.length, "0") : `${g1}${g2}.1`;
    });
  }
  if (isFolder && name.match(/(\d+)$/)) {
    return name.replace(/(\d+)$/, (match, ...groups) => {
      const number = parseInt(groups[0]);
      return number < maxNumber ? String(number + 1).padStart(groups[0].length, "0") : `${groups[0]}.1`;
    });
  }
  if (isFolder && name.match(/^(\d+)/)) {
    return name.replace(/^(\d+)(.*)$/, (match, ...groups) => {
      const number = parseInt(groups[0]);
      return number < maxNumber ? String(number + 1).padStart(groups[0].length, "0") + groups[1] : `${groups[0]}${groups[1]}.1`;
    });
  }
  return `${name}.1`;
}
async function askForOverwrite(fileService, dialogService, targetResource) {
  const exists = await fileService.exists(targetResource);
  if (!exists) {
    return true;
  }
  const { confirmed } = await dialogService.confirm({
    type: Severity.Warning,
    message: nls.localize("confirmOverwrite", "A file or folder with the name '{0}' already exists in the destination folder. Do you want to replace it?", basename(targetResource.path)),
    primaryButton: nls.localize("replaceButtonLabel", "&&Replace")
  });
  return confirmed;
}
const _GlobalCompareResourcesAction = class _GlobalCompareResourcesAction extends Action2 {
  constructor() {
    super({
      id: _GlobalCompareResourcesAction.ID,
      title: _GlobalCompareResourcesAction.LABEL,
      f1: true,
      category: Categories.File,
      precondition: ActiveEditorContext,
      metadata: {
        description: nls.localize2("compareFileWithMeta", "Opens a picker to select a file to diff with the active editor.")
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const textModelService = accessor.get(ITextModelService);
    const quickInputService = accessor.get(IQuickInputService);
    const activeInput = editorService.activeEditor;
    const activeResource = EditorResourceAccessor.getOriginalUri(activeInput);
    if (activeResource && textModelService.canHandleResource(activeResource)) {
      const picks = await quickInputService.quickAccess.pick("", { itemActivation: ItemActivation.SECOND });
      if (picks?.length === 1) {
        const resource = picks[0].resource;
        if (URI.isUri(resource) && textModelService.canHandleResource(resource)) {
          editorService.openEditor({
            original: { resource: activeResource },
            modified: { resource },
            options: { pinned: true }
          });
        }
      }
    }
  }
};
_GlobalCompareResourcesAction.ID = "workbench.files.action.compareFileWith";
_GlobalCompareResourcesAction.LABEL = nls.localize2("globalCompareFile", "Compare Active File With...");
let GlobalCompareResourcesAction = _GlobalCompareResourcesAction;
const _ToggleAutoSaveAction = class _ToggleAutoSaveAction extends Action2 {
  constructor() {
    super({
      id: _ToggleAutoSaveAction.ID,
      title: nls.localize2("toggleAutoSave", "Toggle Auto Save"),
      f1: true,
      category: Categories.File,
      metadata: { description: nls.localize2("toggleAutoSaveDescription", "Toggle the ability to save files automatically after typing") }
    });
  }
  run(accessor) {
    const filesConfigurationService = accessor.get(IFilesConfigurationService);
    return filesConfigurationService.toggleAutoSave();
  }
};
_ToggleAutoSaveAction.ID = "workbench.action.toggleAutoSave";
let ToggleAutoSaveAction = _ToggleAutoSaveAction;
let BaseSaveAllAction = class extends Action {
  constructor(id, label, commandService, notificationService, workingCopyService) {
    super(id, label);
    this.commandService = commandService;
    this.notificationService = notificationService;
    this.workingCopyService = workingCopyService;
    this.lastDirtyState = this.workingCopyService.hasDirty;
    this.enabled = this.lastDirtyState;
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.workingCopyService.onDidChangeDirty((workingCopy) => this.updateEnablement(workingCopy)));
  }
  updateEnablement(workingCopy) {
    const hasDirty = workingCopy.isDirty() || this.workingCopyService.hasDirty;
    if (this.lastDirtyState !== hasDirty) {
      this.enabled = hasDirty;
      this.lastDirtyState = this.enabled;
    }
  }
  async run(context) {
    try {
      await this.doRun(context);
    } catch (error) {
      onError(this.notificationService, error);
    }
  }
};
BaseSaveAllAction = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IWorkingCopyService)
], BaseSaveAllAction);
class SaveAllInGroupAction extends BaseSaveAllAction {
  get class() {
    return "explorer-action " + ThemeIcon.asClassName(Codicon.saveAll);
  }
  doRun(context) {
    return this.commandService.executeCommand(SAVE_ALL_IN_GROUP_COMMAND_ID, {}, context);
  }
}
SaveAllInGroupAction.ID = "workbench.files.action.saveAllInGroup";
SaveAllInGroupAction.LABEL = nls.localize("saveAllInGroup", "Save All in Group");
let CloseGroupAction = class extends Action {
  constructor(id, label, commandService) {
    super(id, label, ThemeIcon.asClassName(Codicon.closeAll));
    this.commandService = commandService;
  }
  run(context) {
    return this.commandService.executeCommand(CLOSE_EDITORS_AND_GROUP_COMMAND_ID, {}, context);
  }
};
CloseGroupAction.ID = "workbench.files.action.closeGroup";
CloseGroupAction.LABEL = nls.localize("closeGroup", "Close Group");
CloseGroupAction = __decorateClass([
  __decorateParam(2, ICommandService)
], CloseGroupAction);
const _FocusFilesExplorer = class _FocusFilesExplorer extends Action2 {
  constructor() {
    super({
      id: _FocusFilesExplorer.ID,
      title: _FocusFilesExplorer.LABEL,
      f1: true,
      category: Categories.File,
      metadata: {
        description: nls.localize2("focusFilesExplorerMetadata", "Moves focus to the file explorer view container.")
      }
    });
  }
  async run(accessor) {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    await paneCompositeService.openPaneComposite(VIEWLET_ID, ViewContainerLocation.Sidebar, true);
  }
};
_FocusFilesExplorer.ID = "workbench.files.action.focusFilesExplorer";
_FocusFilesExplorer.LABEL = nls.localize2("focusFilesExplorer", "Focus on Files Explorer");
let FocusFilesExplorer = _FocusFilesExplorer;
const _ShowActiveFileInExplorer = class _ShowActiveFileInExplorer extends Action2 {
  constructor() {
    super({
      id: _ShowActiveFileInExplorer.ID,
      title: _ShowActiveFileInExplorer.LABEL,
      f1: true,
      category: Categories.File,
      metadata: {
        description: nls.localize2("showInExplorerMetadata", "Reveals and selects the active file within the explorer view.")
      }
    });
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    const editorService = accessor.get(IEditorService);
    const resource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (resource) {
      commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, resource);
    }
  }
};
_ShowActiveFileInExplorer.ID = "workbench.files.action.showActiveFileInExplorer";
_ShowActiveFileInExplorer.LABEL = nls.localize2("showInExplorer", "Reveal Active File in Explorer View");
let ShowActiveFileInExplorer = _ShowActiveFileInExplorer;
const _OpenActiveFileInEmptyWorkspace = class _OpenActiveFileInEmptyWorkspace extends Action2 {
  constructor() {
    super({
      id: _OpenActiveFileInEmptyWorkspace.ID,
      title: _OpenActiveFileInEmptyWorkspace.LABEL,
      f1: true,
      category: Categories.File,
      precondition: EmptyWorkspaceSupportContext,
      metadata: {
        description: nls.localize2("openFileInEmptyWorkspaceMetadata", "Opens the active file in a new window with no folders open.")
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const hostService = accessor.get(IHostService);
    const dialogService = accessor.get(IDialogService);
    const fileService = accessor.get(IFileService);
    const fileResource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (fileResource) {
      if (fileService.hasProvider(fileResource)) {
        hostService.openWindow([{ fileUri: fileResource }], { forceNewWindow: true });
      } else {
        dialogService.error(nls.localize("openFileToShowInNewWindow.unsupportedschema", "The active editor must contain an openable resource."));
      }
    }
  }
};
_OpenActiveFileInEmptyWorkspace.ID = "workbench.action.files.showOpenedFileInNewWindow";
_OpenActiveFileInEmptyWorkspace.LABEL = nls.localize2("openFileInEmptyWorkspace", "Open Active File in New Empty Workspace");
let OpenActiveFileInEmptyWorkspace = _OpenActiveFileInEmptyWorkspace;
function validateFileName(pathService, item, name, os) {
  name = getWellFormedFileName(name);
  if (!name || name.length === 0 || /^\s+$/.test(name)) {
    return {
      content: nls.localize("emptyFileNameError", "A file or folder name must be provided."),
      severity: Severity.Error
    };
  }
  if (name[0] === "/" || name[0] === "\\") {
    return {
      content: nls.localize("fileNameStartsWithSlashError", "A file or folder name cannot start with a slash."),
      severity: Severity.Error
    };
  }
  const names = coalesce(name.split(/[\\/]/));
  const parent = item.parent;
  if (name !== item.name) {
    const child = parent?.getChild(name);
    if (child && child !== item) {
      return {
        content: nls.localize("fileNameExistsError", "A file or folder **{0}** already exists at this location. Please choose a different name.", name),
        severity: Severity.Error
      };
    }
  }
  if (names.some((folderName) => !pathService.hasValidBasename(item.resource, os, folderName))) {
    const escapedName = name.replace(/\*/g, "\\*");
    return {
      content: nls.localize("invalidFileNameError", "The name **{0}** is not valid as a file or folder name. Please choose a different name.", trimLongName(escapedName)),
      severity: Severity.Error
    };
  }
  if (names.some((name2) => /^\s|\s$/.test(name2))) {
    return {
      content: nls.localize("fileNameWhitespaceWarning", "Leading or trailing whitespace detected in file or folder name."),
      severity: Severity.Warning
    };
  }
  return null;
}
function trimLongName(name) {
  if (name?.length > 255) {
    return `${name.substr(0, 255)}...`;
  }
  return name;
}
function getWellFormedFileName(filename) {
  if (!filename) {
    return filename;
  }
  filename = trim(filename, "	");
  filename = rtrim(filename, "/");
  filename = rtrim(filename, "\\");
  return filename;
}
const _CompareNewUntitledTextFilesAction = class _CompareNewUntitledTextFilesAction extends Action2 {
  constructor() {
    super({
      id: _CompareNewUntitledTextFilesAction.ID,
      title: _CompareNewUntitledTextFilesAction.LABEL,
      f1: true,
      category: Categories.File,
      metadata: {
        description: nls.localize2("compareNewUntitledTextFilesMeta", "Opens a new diff editor with two untitled files.")
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({
      original: { resource: void 0 },
      modified: { resource: void 0 },
      options: { pinned: true }
    });
  }
};
_CompareNewUntitledTextFilesAction.ID = "workbench.files.action.compareNewUntitledTextFiles";
_CompareNewUntitledTextFilesAction.LABEL = nls.localize2("compareNewUntitledTextFiles", "Compare New Untitled Text Files");
let CompareNewUntitledTextFilesAction = _CompareNewUntitledTextFilesAction;
const _CompareWithClipboardAction = class _CompareWithClipboardAction extends Action2 {
  constructor() {
    super({
      id: _CompareWithClipboardAction.ID,
      title: _CompareWithClipboardAction.LABEL,
      f1: true,
      category: Categories.File,
      keybinding: { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyC), weight: KeybindingWeight.WorkbenchContrib },
      metadata: {
        description: nls.localize2("compareWithClipboardMeta", "Opens a new diff editor to compare the active file with the contents of the clipboard.")
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const textModelService = accessor.get(ITextModelService);
    const fileService = accessor.get(IFileService);
    const resource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const scheme = `clipboardCompare${_CompareWithClipboardAction.SCHEME_COUNTER++}`;
    if (resource && (fileService.hasProvider(resource) || resource.scheme === Schemas.untitled)) {
      if (!this.registrationDisposal) {
        const provider = instantiationService.createInstance(ClipboardContentProvider);
        this.registrationDisposal = textModelService.registerTextModelContentProvider(scheme, provider);
      }
      const name = resources.basename(resource);
      const editorLabel = nls.localize("clipboardComparisonLabel", "Clipboard \u2194 {0}", name);
      await editorService.openEditor({
        original: { resource: resource.with({ scheme }) },
        modified: { resource },
        label: editorLabel,
        options: { pinned: true }
      }).finally(() => {
        dispose(this.registrationDisposal);
        this.registrationDisposal = void 0;
      });
    }
  }
  dispose() {
    dispose(this.registrationDisposal);
    this.registrationDisposal = void 0;
  }
};
_CompareWithClipboardAction.ID = "workbench.files.action.compareWithClipboard";
_CompareWithClipboardAction.LABEL = nls.localize2("compareWithClipboard", "Compare Active File with Clipboard");
_CompareWithClipboardAction.SCHEME_COUNTER = 0;
let CompareWithClipboardAction = _CompareWithClipboardAction;
let ClipboardContentProvider = class {
  constructor(clipboardService, languageService, modelService) {
    this.clipboardService = clipboardService;
    this.languageService = languageService;
    this.modelService = modelService;
  }
  async provideTextContent(resource) {
    const text = await this.clipboardService.readText();
    const model = this.modelService.createModel(text, this.languageService.createByFilepathOrFirstLine(resource), resource);
    return model;
  }
};
ClipboardContentProvider = __decorateClass([
  __decorateParam(0, IClipboardService),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, IModelService)
], ClipboardContentProvider);
function onErrorWithRetry(notificationService, error, retry) {
  notificationService.prompt(
    Severity.Error,
    toErrorMessage(error, false),
    [{
      label: nls.localize("retry", "Retry"),
      run: () => retry()
    }]
  );
}
async function openExplorerAndCreate(accessor, isFolder) {
  const explorerService = accessor.get(IExplorerService);
  const fileService = accessor.get(IFileService);
  const configService = accessor.get(IConfigurationService);
  const filesConfigService = accessor.get(IFilesConfigurationService);
  const editorService = accessor.get(IEditorService);
  const viewsService = accessor.get(IViewsService);
  const notificationService = accessor.get(INotificationService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const commandService = accessor.get(ICommandService);
  const pathService = accessor.get(IPathService);
  const wasHidden = !viewsService.isViewVisible(VIEW_ID);
  const view = await viewsService.openView(VIEW_ID, true);
  if (wasHidden) {
    await timeout(500);
  }
  if (!view) {
    if (isFolder) {
      throw new Error("Open a folder or workspace first.");
    }
    return commandService.executeCommand(NEW_UNTITLED_FILE_COMMAND_ID);
  }
  const stats = explorerService.getContext(false);
  const stat = stats.length > 0 ? stats[0] : void 0;
  let folder;
  if (stat) {
    folder = stat.isDirectory ? stat : stat.parent || explorerService.roots[0];
  } else {
    folder = explorerService.roots[0];
  }
  if (folder.isReadonly) {
    throw new Error("Parent folder is readonly.");
  }
  const newStat = new NewExplorerItem(fileService, configService, filesConfigService, folder, isFolder);
  folder.addChild(newStat);
  const onSuccess = async (value) => {
    try {
      const resourceToCreate = resources.joinPath(folder.resource, value);
      if (value.endsWith("/")) {
        isFolder = true;
      }
      await explorerService.applyBulkEdit([new ResourceFileEdit(void 0, resourceToCreate, { folder: isFolder })], {
        undoLabel: nls.localize("createBulkEdit", "Create {0}", value),
        progressLabel: nls.localize("creatingBulkEdit", "Creating {0}", value),
        confirmBeforeUndo: true
      });
      await refreshIfSeparator(value, explorerService);
      if (isFolder) {
        await explorerService.select(resourceToCreate, true);
      } else {
        await editorService.openEditor({ resource: resourceToCreate, options: { pinned: true } });
      }
    } catch (error) {
      onErrorWithRetry(notificationService, error, () => onSuccess(value));
    }
  };
  const os = (await remoteAgentService.getEnvironment())?.os ?? OS;
  await explorerService.setEditable(newStat, {
    validationMessage: (value) => validateFileName(pathService, newStat, value, os),
    onFinish: async (value, success) => {
      folder.removeChild(newStat);
      await explorerService.setEditable(newStat, null);
      if (success) {
        onSuccess(value);
      }
    }
  });
}
CommandsRegistry.registerCommand({
  id: NEW_FILE_COMMAND_ID,
  handler: async (accessor) => {
    await openExplorerAndCreate(accessor, false);
  }
});
CommandsRegistry.registerCommand({
  id: NEW_FOLDER_COMMAND_ID,
  handler: async (accessor) => {
    await openExplorerAndCreate(accessor, true);
  }
});
const renameHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const notificationService = accessor.get(INotificationService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const pathService = accessor.get(IPathService);
  const configurationService = accessor.get(IConfigurationService);
  const stats = explorerService.getContext(false);
  const stat = stats.length > 0 ? stats[0] : void 0;
  if (!stat) {
    return;
  }
  const os = (await remoteAgentService.getEnvironment())?.os ?? OS;
  await explorerService.setEditable(stat, {
    validationMessage: (value) => validateFileName(pathService, stat, value, os),
    onFinish: async (value, success) => {
      if (success) {
        const parentResource = stat.parent.resource;
        const targetResource = resources.joinPath(parentResource, value);
        if (stat.resource.toString() !== targetResource.toString()) {
          try {
            await explorerService.applyBulkEdit([new ResourceFileEdit(stat.resource, targetResource)], {
              confirmBeforeUndo: configurationService.getValue().explorer.confirmUndo === UndoConfirmLevel.Verbose,
              undoLabel: nls.localize("renameBulkEdit", "Rename {0} to {1}", stat.name, value),
              progressLabel: nls.localize("renamingBulkEdit", "Renaming {0} to {1}", stat.name, value)
            });
            await refreshIfSeparator(value, explorerService);
          } catch (e) {
            notificationService.error(e);
          }
        }
      }
      await explorerService.setEditable(stat, null);
    }
  });
};
const moveFileToTrashHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const stats = explorerService.getContext(true).filter((s) => !s.isRoot);
  if (stats.length) {
    await deleteFiles(accessor.get(IExplorerService), accessor.get(IWorkingCopyFileService), accessor.get(IDialogService), accessor.get(IConfigurationService), accessor.get(IFilesConfigurationService), stats, true);
  }
};
const deleteFileHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const stats = explorerService.getContext(true).filter((s) => !s.isRoot);
  if (stats.length) {
    await deleteFiles(accessor.get(IExplorerService), accessor.get(IWorkingCopyFileService), accessor.get(IDialogService), accessor.get(IConfigurationService), accessor.get(IFilesConfigurationService), stats, false);
  }
};
let pasteShouldMove = false;
const copyFileHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const stats = explorerService.getContext(true);
  if (stats.length > 0) {
    await explorerService.setToCopy(stats, false);
    pasteShouldMove = false;
  }
};
const cutFileHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const stats = explorerService.getContext(true);
  if (stats.length > 0) {
    await explorerService.setToCopy(stats, true);
    pasteShouldMove = true;
  }
};
const downloadFileHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const notificationService = accessor.get(INotificationService);
  const instantiationService = accessor.get(IInstantiationService);
  const context = explorerService.getContext(true);
  const explorerItems = context.length ? context : explorerService.roots;
  const downloadHandler = instantiationService.createInstance(FileDownload);
  try {
    await downloadHandler.download(explorerItems);
  } catch (error) {
    notificationService.error(error);
    throw error;
  }
};
CommandsRegistry.registerCommand({
  id: DOWNLOAD_COMMAND_ID,
  handler: downloadFileHandler
});
const uploadFileHandler = async (accessor) => {
  const explorerService = accessor.get(IExplorerService);
  const notificationService = accessor.get(INotificationService);
  const instantiationService = accessor.get(IInstantiationService);
  const context = explorerService.getContext(false);
  const element = context.length ? context[0] : explorerService.roots[0];
  try {
    const files = await triggerUpload();
    if (files) {
      const browserUpload = instantiationService.createInstance(BrowserFileUpload);
      await browserUpload.upload(element, files);
    }
  } catch (error) {
    notificationService.error(error);
    throw error;
  }
};
CommandsRegistry.registerCommand({
  id: UPLOAD_COMMAND_ID,
  handler: uploadFileHandler
});
const pasteFileHandler = async (accessor, fileList) => {
  const clipboardService = accessor.get(IClipboardService);
  const explorerService = accessor.get(IExplorerService);
  const fileService = accessor.get(IFileService);
  const notificationService = accessor.get(INotificationService);
  const editorService = accessor.get(IEditorService);
  const configurationService = accessor.get(IConfigurationService);
  const uriIdentityService = accessor.get(IUriIdentityService);
  const dialogService = accessor.get(IDialogService);
  const hostService = accessor.get(IHostService);
  const context = explorerService.getContext(false);
  const hasNativeFilesToPaste = fileList && fileList.length > 0;
  const confirmPasteNative = hasNativeFilesToPaste && configurationService.getValue("explorer.confirmPasteNative");
  const toPaste = await getFilesToPaste(fileList, clipboardService, hostService);
  if (confirmPasteNative && toPaste.files.length >= 1) {
    const message = toPaste.files.length > 1 ? nls.localize("confirmMultiPasteNative", "Are you sure you want to paste the following {0} items?", toPaste.files.length) : nls.localize("confirmPasteNative", "Are you sure you want to paste '{0}'?", basename(toPaste.type === "paths" ? toPaste.files[0].fsPath : toPaste.files[0].name));
    const detail = toPaste.files.length > 1 ? getFileNamesMessage(toPaste.files.map((item) => {
      if (URI.isUri(item)) {
        return item.fsPath;
      }
      if (toPaste.type === "paths") {
        const path = getPathForFile(item);
        if (path) {
          return path;
        }
      }
      return item.name;
    })) : void 0;
    const confirmation = await dialogService.confirm({
      message,
      detail,
      checkbox: {
        label: nls.localize("doNotAskAgain", "Do not ask me again")
      },
      primaryButton: nls.localize({ key: "pasteButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Paste")
    });
    if (!confirmation.confirmed) {
      return;
    }
    if (confirmation.checkboxChecked === true) {
      await configurationService.updateValue("explorer.confirmPasteNative", false);
    }
  }
  const element = context.length ? context[0] : explorerService.roots[0];
  const incrementalNaming = configurationService.getValue().explorer.incrementalNaming;
  const editableItem = explorerService.getEditable();
  if (editableItem) {
    return;
  }
  try {
    let targets = [];
    if (toPaste.type === "paths") {
      const sourceTargetPairs = coalesce(await Promise.all(toPaste.files.map(async (fileToPaste) => {
        if (element.resource.toString() !== fileToPaste.toString() && resources.isEqualOrParent(element.resource, fileToPaste)) {
          throw new Error(nls.localize("fileIsAncestor", "File to paste is an ancestor of the destination folder"));
        }
        const fileToPasteStat = await fileService.stat(fileToPaste);
        let target;
        if (uriIdentityService.extUri.isEqual(element.resource, fileToPaste)) {
          target = element.parent;
        } else {
          target = element.isDirectory ? element : element.parent;
        }
        const targetFile = await findValidPasteFileTarget(
          explorerService,
          fileService,
          dialogService,
          target,
          { resource: fileToPaste, isDirectory: fileToPasteStat.isDirectory, allowOverwrite: pasteShouldMove || incrementalNaming === "disabled" },
          incrementalNaming
        );
        if (!targetFile) {
          return void 0;
        }
        return { source: fileToPaste, target: targetFile };
      })));
      if (sourceTargetPairs.length >= 1) {
        if (pasteShouldMove) {
          const resourceFileEdits = sourceTargetPairs.map((pair) => new ResourceFileEdit(pair.source, pair.target, { overwrite: incrementalNaming === "disabled" }));
          const options = {
            confirmBeforeUndo: configurationService.getValue().explorer.confirmUndo === UndoConfirmLevel.Verbose,
            progressLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: "movingBulkEdit", comment: ["Placeholder will be replaced by the number of files being moved"] }, "Moving {0} files", sourceTargetPairs.length) : nls.localize({ key: "movingFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file moved."] }, "Moving {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target)),
            undoLabel: sourceTargetPairs.length > 1 ? nls.localize({ key: "moveBulkEdit", comment: ["Placeholder will be replaced by the number of files being moved"] }, "Move {0} files", sourceTargetPairs.length) : nls.localize({ key: "moveFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file moved."] }, "Move {0}", resources.basenameOrAuthority(sourceTargetPairs[0].target))
          };
          await explorerService.applyBulkEdit(resourceFileEdits, options);
        } else {
          const resourceFileEdits = sourceTargetPairs.map((pair) => new ResourceFileEdit(pair.source, pair.target, { copy: true, overwrite: incrementalNaming === "disabled" }));
          await applyCopyResourceEdit(sourceTargetPairs.map((pair) => pair.target), resourceFileEdits);
        }
      }
      targets = sourceTargetPairs.map((pair) => pair.target);
    } else {
      const targetAndEdits = coalesce(await Promise.all(toPaste.files.map(async (file) => {
        const target = element.isDirectory ? element : element.parent;
        const targetFile = await findValidPasteFileTarget(
          explorerService,
          fileService,
          dialogService,
          target,
          { resource: file.name, isDirectory: false, allowOverwrite: pasteShouldMove || incrementalNaming === "disabled" },
          incrementalNaming
        );
        if (!targetFile) {
          return;
        }
        return {
          target: targetFile,
          edit: new ResourceFileEdit(void 0, targetFile, {
            overwrite: incrementalNaming === "disabled",
            contents: (async () => VSBuffer.wrap(new Uint8Array(await file.arrayBuffer())))()
          })
        };
      })));
      await applyCopyResourceEdit(targetAndEdits.map((pair) => pair.target), targetAndEdits.map((pair) => pair.edit));
      targets = targetAndEdits.map((pair) => pair.target);
    }
    if (targets.length) {
      const firstTarget = targets[0];
      await explorerService.select(firstTarget);
      if (targets.length === 1) {
        const item = explorerService.findClosest(firstTarget);
        if (item && !item.isDirectory) {
          await editorService.openEditor({ resource: item.resource, options: { pinned: true, preserveFocus: true } });
        }
      }
    }
  } catch (e) {
    onError(notificationService, new Error(nls.localize("fileDeleted", "The file(s) to paste have been deleted or moved since you copied them. {0}", getErrorMessage(e))));
  } finally {
    if (pasteShouldMove) {
      await explorerService.setToCopy([], false);
      pasteShouldMove = false;
    }
  }
  async function applyCopyResourceEdit(targets, resourceFileEdits) {
    const undoLevel = configurationService.getValue().explorer.confirmUndo;
    const options = {
      confirmBeforeUndo: undoLevel === UndoConfirmLevel.Default || undoLevel === UndoConfirmLevel.Verbose,
      progressLabel: targets.length > 1 ? nls.localize({ key: "copyingBulkEdit", comment: ["Placeholder will be replaced by the number of files being copied"] }, "Copying {0} files", targets.length) : nls.localize({ key: "copyingFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file copied."] }, "Copying {0}", resources.basenameOrAuthority(targets[0])),
      undoLabel: targets.length > 1 ? nls.localize({ key: "copyBulkEdit", comment: ["Placeholder will be replaced by the number of files being copied"] }, "Paste {0} files", targets.length) : nls.localize({ key: "copyFileBulkEdit", comment: ["Placeholder will be replaced by the name of the file copied."] }, "Paste {0}", resources.basenameOrAuthority(targets[0]))
    };
    await explorerService.applyBulkEdit(resourceFileEdits, options);
  }
};
async function getFilesToPaste(fileList, clipboardService, hostService) {
  if (fileList && fileList.length > 0) {
    const resources2 = [...fileList].map((file) => getPathForFile(file)).filter((filePath) => !!filePath && isAbsolute(filePath)).map((filePath) => URI.file(filePath));
    if (resources2.length) {
      return { type: "paths", files: resources2 };
    }
    return { type: "data", files: [...fileList].filter((file) => !getPathForFile(file)) };
  } else {
    return { type: "paths", files: resources.distinctParents(await clipboardService.readResources(), (resource) => resource) };
  }
}
const openFilePreserveFocusHandler = async (accessor) => {
  const editorService = accessor.get(IEditorService);
  const explorerService = accessor.get(IExplorerService);
  const stats = explorerService.getContext(true);
  await editorService.openEditors(stats.filter((s) => !s.isDirectory).map((s) => ({
    resource: s.resource,
    options: { preserveFocus: true }
  })));
};
class BaseSetActiveEditorReadonlyInSession extends Action2 {
  constructor(id, title, newReadonlyState) {
    super({
      id,
      title,
      f1: true,
      category: Categories.File,
      precondition: ActiveEditorCanToggleReadonlyContext
    });
    this.newReadonlyState = newReadonlyState;
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const filesConfigurationService = accessor.get(IFilesConfigurationService);
    const fileResource = EditorResourceAccessor.getOriginalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!fileResource) {
      return;
    }
    await filesConfigurationService.updateReadonly(fileResource, this.newReadonlyState);
  }
}
const _SetActiveEditorReadonlyInSession = class _SetActiveEditorReadonlyInSession extends BaseSetActiveEditorReadonlyInSession {
  constructor() {
    super(
      _SetActiveEditorReadonlyInSession.ID,
      _SetActiveEditorReadonlyInSession.LABEL,
      true
    );
  }
};
_SetActiveEditorReadonlyInSession.ID = "workbench.action.files.setActiveEditorReadonlyInSession";
_SetActiveEditorReadonlyInSession.LABEL = nls.localize2("setActiveEditorReadonlyInSession", "Set Active Editor Read-only in Session");
let SetActiveEditorReadonlyInSession = _SetActiveEditorReadonlyInSession;
const _SetActiveEditorWriteableInSession = class _SetActiveEditorWriteableInSession extends BaseSetActiveEditorReadonlyInSession {
  constructor() {
    super(
      _SetActiveEditorWriteableInSession.ID,
      _SetActiveEditorWriteableInSession.LABEL,
      false
    );
  }
};
_SetActiveEditorWriteableInSession.ID = "workbench.action.files.setActiveEditorWriteableInSession";
_SetActiveEditorWriteableInSession.LABEL = nls.localize2("setActiveEditorWriteableInSession", "Set Active Editor Writeable in Session");
let SetActiveEditorWriteableInSession = _SetActiveEditorWriteableInSession;
const _ToggleActiveEditorReadonlyInSession = class _ToggleActiveEditorReadonlyInSession extends BaseSetActiveEditorReadonlyInSession {
  constructor() {
    super(
      _ToggleActiveEditorReadonlyInSession.ID,
      _ToggleActiveEditorReadonlyInSession.LABEL,
      "toggle"
    );
  }
};
_ToggleActiveEditorReadonlyInSession.ID = "workbench.action.files.toggleActiveEditorReadonlyInSession";
_ToggleActiveEditorReadonlyInSession.LABEL = nls.localize2("toggleActiveEditorReadonlyInSession", "Toggle Active Editor Read-only in Session");
let ToggleActiveEditorReadonlyInSession = _ToggleActiveEditorReadonlyInSession;
const _ResetActiveEditorReadonlyInSession = class _ResetActiveEditorReadonlyInSession extends BaseSetActiveEditorReadonlyInSession {
  constructor() {
    super(
      _ResetActiveEditorReadonlyInSession.ID,
      _ResetActiveEditorReadonlyInSession.LABEL,
      "reset"
    );
  }
};
_ResetActiveEditorReadonlyInSession.ID = "workbench.action.files.resetActiveEditorReadonlyInSession";
_ResetActiveEditorReadonlyInSession.LABEL = nls.localize2("resetActiveEditorReadonlyInSession", "Reset Active Editor Read-only in Session");
let ResetActiveEditorReadonlyInSession = _ResetActiveEditorReadonlyInSession;
export {
  COPY_FILE_LABEL,
  CloseGroupAction,
  CompareNewUntitledTextFilesAction,
  CompareWithClipboardAction,
  DOWNLOAD_COMMAND_ID,
  DOWNLOAD_LABEL,
  FileCopiedContext,
  FocusFilesExplorer,
  GlobalCompareResourcesAction,
  MOVE_FILE_TO_TRASH_LABEL,
  NEW_FILE_COMMAND_ID,
  NEW_FILE_LABEL,
  NEW_FOLDER_COMMAND_ID,
  NEW_FOLDER_LABEL,
  OpenActiveFileInEmptyWorkspace,
  PASTE_FILE_LABEL,
  ResetActiveEditorReadonlyInSession,
  SaveAllInGroupAction,
  SetActiveEditorReadonlyInSession,
  SetActiveEditorWriteableInSession,
  ShowActiveFileInExplorer,
  TRIGGER_RENAME_LABEL,
  ToggleActiveEditorReadonlyInSession,
  ToggleAutoSaveAction,
  UPLOAD_COMMAND_ID,
  UPLOAD_LABEL,
  copyFileHandler,
  cutFileHandler,
  deleteFileHandler,
  findValidPasteFileTarget,
  incrementFileName,
  moveFileToTrashHandler,
  openFilePreserveFocusHandler,
  pasteFileHandler,
  renameHandler,
  validateFileName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2ZpbGVBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSwgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBiYXNlbmFtZSwgaXNBYnNvbHV0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0ICogYXMgcmVzb3VyY2VzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBkaXNwb3NlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBWSUVXTEVUX0lELCBJRmlsZXNDb25maWd1cmF0aW9uLCBWSUVXX0lELCBVbmRvQ29uZmlybUxldmVsIH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIEl0ZW1BY3RpdmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFJFVkVBTF9JTl9FWFBMT1JFUl9DT01NQU5EX0lELCBTQVZFX0FMTF9JTl9HUk9VUF9DT01NQU5EX0lELCBORVdfVU5USVRMRURfRklMRV9DT01NQU5EX0lEIH0gZnJvbSAnLi9maWxlQ29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlLCBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlLCBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJQ29uZmlybWF0aW9uUmVzdWx0LCBnZXRGaWxlTmFtZXNNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCB7IENMT1NFX0VESVRPUlNfQU5EX0dST1VQX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBFeHBsb3Jlckl0ZW0sIE5ld0V4cGxvcmVySXRlbSB9IGZyb20gJy4uL2NvbW1vbi9leHBsb3Jlck1vZGVsLmpzJztcbmltcG9ydCB7IGdldEVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB0cmlnZ2VyVXBsb2FkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgdHJpbSwgcnRyaW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VGaWxlRWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi9maWxlcy5qcyc7XG5pbXBvcnQgeyBCcm93c2VyRmlsZVVwbG9hZCwgRmlsZURvd25sb2FkIH0gZnJvbSAnLi9maWxlSW1wb3J0RXhwb3J0LmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ2FuVG9nZ2xlUmVhZG9ubHlDb250ZXh0LCBBY3RpdmVFZGl0b3JDb250ZXh0LCBFbXB0eVdvcmtzcGFjZVN1cHBvcnRDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBnZXRQYXRoRm9yRmlsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RuZC9icm93c2VyL2RuZC5qcyc7XG5cbmV4cG9ydCBjb25zdCBORVdfRklMRV9DT01NQU5EX0lEID0gJ2V4cGxvcmVyLm5ld0ZpbGUnO1xuZXhwb3J0IGNvbnN0IE5FV19GSUxFX0xBQkVMID0gbmxzLmxvY2FsaXplMignbmV3RmlsZScsIFwiTmV3IEZpbGUuLi5cIik7XG5leHBvcnQgY29uc3QgTkVXX0ZPTERFUl9DT01NQU5EX0lEID0gJ2V4cGxvcmVyLm5ld0ZvbGRlcic7XG5leHBvcnQgY29uc3QgTkVXX0ZPTERFUl9MQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ25ld0ZvbGRlcicsIFwiTmV3IEZvbGRlci4uLlwiKTtcbmV4cG9ydCBjb25zdCBUUklHR0VSX1JFTkFNRV9MQUJFTCA9IG5scy5sb2NhbGl6ZSgncmVuYW1lJywgXCJSZW5hbWUuLi5cIik7XG5leHBvcnQgY29uc3QgTU9WRV9GSUxFX1RPX1RSQVNIX0xBQkVMID0gbmxzLmxvY2FsaXplKCdkZWxldGUnLCBcIkRlbGV0ZVwiKTtcbmV4cG9ydCBjb25zdCBDT1BZX0ZJTEVfTEFCRUwgPSBubHMubG9jYWxpemUoJ2NvcHlGaWxlJywgXCJDb3B5XCIpO1xuZXhwb3J0IGNvbnN0IFBBU1RFX0ZJTEVfTEFCRUwgPSBubHMubG9jYWxpemUoJ3Bhc3RlRmlsZScsIFwiUGFzdGVcIik7XG5leHBvcnQgY29uc3QgRmlsZUNvcGllZENvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignZmlsZUNvcGllZCcsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9DT01NQU5EX0lEID0gJ2V4cGxvcmVyLmRvd25sb2FkJztcbmV4cG9ydCBjb25zdCBET1dOTE9BRF9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnZG93bmxvYWQnLCBcIkRvd25sb2FkLi4uXCIpO1xuZXhwb3J0IGNvbnN0IFVQTE9BRF9DT01NQU5EX0lEID0gJ2V4cGxvcmVyLnVwbG9hZCc7XG5leHBvcnQgY29uc3QgVVBMT0FEX0xBQkVMID0gbmxzLmxvY2FsaXplKCd1cGxvYWQnLCBcIlVwbG9hZC4uLlwiKTtcbmNvbnN0IENPTkZJUk1fREVMRVRFX1NFVFRJTkdfS0VZID0gJ2V4cGxvcmVyLmNvbmZpcm1EZWxldGUnO1xuY29uc3QgTUFYX1VORE9fRklMRV9TSVpFID0gNTAwMDAwMDsgLy8gNW1iXG5cbmZ1bmN0aW9uIG9uRXJyb3Iobm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsIGVycm9yOiBhbnkpOiB2b2lkIHtcblx0aWYgKGVycm9yLm1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0ZXJyb3IgPSBlcnJvci5tZXNzYWdlO1xuXHR9XG5cblx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcih0b0Vycm9yTWVzc2FnZShlcnJvciwgZmFsc2UpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVmcmVzaElmU2VwYXJhdG9yKHZhbHVlOiBzdHJpbmcsIGV4cGxvcmVyU2VydmljZTogSUV4cGxvcmVyU2VydmljZSk6IFByb21pc2U8dm9pZD4ge1xuXHRpZiAodmFsdWUgJiYgKCh2YWx1ZS5pbmRleE9mKCcvJykgPj0gMCkgfHwgKHZhbHVlLmluZGV4T2YoJ1xcXFwnKSA+PSAwKSkpIHtcblx0XHQvLyBOZXcgaW5wdXQgY29udGFpbnMgc2VwYXJhdG9yLCBtdWx0aXBsZSByZXNvdXJjZXMgd2lsbCBnZXQgY3JlYXRlZCB3b3JrYXJvdW5kIGZvciAjNjgyMDRcblx0XHRhd2FpdCBleHBsb3JlclNlcnZpY2UucmVmcmVzaCgpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUZpbGVzKGV4cGxvcmVyU2VydmljZTogSUV4cGxvcmVyU2VydmljZSwgd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgZWxlbWVudHM6IEV4cGxvcmVySXRlbVtdLCB1c2VUcmFzaDogYm9vbGVhbiwgc2tpcENvbmZpcm0gPSBmYWxzZSwgaWdub3JlSWZOb3RFeGlzdHMgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRsZXQgcHJpbWFyeUJ1dHRvbjogc3RyaW5nO1xuXHRpZiAodXNlVHJhc2gpIHtcblx0XHRwcmltYXJ5QnV0dG9uID0gaXNXaW5kb3dzID8gbmxzLmxvY2FsaXplKCdkZWxldGVCdXR0b25MYWJlbFJlY3ljbGVCaW4nLCBcIiYmTW92ZSB0byBSZWN5Y2xlIEJpblwiKSA6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2RlbGV0ZUJ1dHRvbkxhYmVsVHJhc2gnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZNb3ZlIHRvIFRyYXNoXCIpO1xuXHR9IGVsc2Uge1xuXHRcdHByaW1hcnlCdXR0b24gPSBubHMubG9jYWxpemUoeyBrZXk6ICdkZWxldGVCdXR0b25MYWJlbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkRlbGV0ZVwiKTtcblx0fVxuXG5cdC8vIEhhbmRsZSBkaXJ0eVxuXHRjb25zdCBkaXN0aW5jdEVsZW1lbnRzID0gcmVzb3VyY2VzLmRpc3RpbmN0UGFyZW50cyhlbGVtZW50cywgZSA9PiBlLnJlc291cmNlKTtcblx0Y29uc3QgZGlydHlXb3JraW5nQ29waWVzID0gbmV3IFNldDxJV29ya2luZ0NvcHk+KCk7XG5cdGZvciAoY29uc3QgZGlzdGluY3RFbGVtZW50IG9mIGRpc3RpbmN0RWxlbWVudHMpIHtcblx0XHRmb3IgKGNvbnN0IGRpcnR5V29ya2luZ0NvcHkgb2Ygd29ya2luZ0NvcHlGaWxlU2VydmljZS5nZXREaXJ0eShkaXN0aW5jdEVsZW1lbnQucmVzb3VyY2UpKSB7XG5cdFx0XHRkaXJ0eVdvcmtpbmdDb3BpZXMuYWRkKGRpcnR5V29ya2luZ0NvcHkpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChkaXJ0eVdvcmtpbmdDb3BpZXMuc2l6ZSkge1xuXHRcdGxldCBtZXNzYWdlOiBzdHJpbmc7XG5cdFx0aWYgKGRpc3RpbmN0RWxlbWVudHMubGVuZ3RoID4gMSkge1xuXHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnZGlydHlNZXNzYWdlRmlsZXNEZWxldGUnLCBcIllvdSBhcmUgZGVsZXRpbmcgZmlsZXMgd2l0aCB1bnNhdmVkIGNoYW5nZXMuIERvIHlvdSB3YW50IHRvIGNvbnRpbnVlP1wiKTtcblx0XHR9IGVsc2UgaWYgKGRpc3RpbmN0RWxlbWVudHNbMF0uaXNEaXJlY3RvcnkpIHtcblx0XHRcdGlmIChkaXJ0eVdvcmtpbmdDb3BpZXMuc2l6ZSA9PT0gMSkge1xuXHRcdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdkaXJ0eU1lc3NhZ2VGb2xkZXJPbmVEZWxldGUnLCBcIllvdSBhcmUgZGVsZXRpbmcgYSBmb2xkZXIgezB9IHdpdGggdW5zYXZlZCBjaGFuZ2VzIGluIDEgZmlsZS4gRG8geW91IHdhbnQgdG8gY29udGludWU/XCIsIGRpc3RpbmN0RWxlbWVudHNbMF0ubmFtZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdkaXJ0eU1lc3NhZ2VGb2xkZXJEZWxldGUnLCBcIllvdSBhcmUgZGVsZXRpbmcgYSBmb2xkZXIgezB9IHdpdGggdW5zYXZlZCBjaGFuZ2VzIGluIHsxfSBmaWxlcy4gRG8geW91IHdhbnQgdG8gY29udGludWU/XCIsIGRpc3RpbmN0RWxlbWVudHNbMF0ubmFtZSwgZGlydHlXb3JraW5nQ29waWVzLnNpemUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdkaXJ0eU1lc3NhZ2VGaWxlRGVsZXRlJywgXCJZb3UgYXJlIGRlbGV0aW5nIHswfSB3aXRoIHVuc2F2ZWQgY2hhbmdlcy4gRG8geW91IHdhbnQgdG8gY29udGludWU/XCIsIGRpc3RpbmN0RWxlbWVudHNbMF0ubmFtZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdkaXJ0eVdhcm5pbmcnLCBcIllvdXIgY2hhbmdlcyB3aWxsIGJlIGxvc3QgaWYgeW91IGRvbid0IHNhdmUgdGhlbS5cIiksXG5cdFx0XHRwcmltYXJ5QnV0dG9uXG5cdFx0fSk7XG5cblx0XHRpZiAoIXJlc3BvbnNlLmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRza2lwQ29uZmlybSA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Ly8gSGFuZGxlIHJlYWRvbmx5XG5cdGlmICghc2tpcENvbmZpcm0pIHtcblx0XHRjb25zdCByZWFkb25seVJlc291cmNlcyA9IGRpc3RpbmN0RWxlbWVudHMuZmlsdGVyKGUgPT4gZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5pc1JlYWRvbmx5KGUucmVzb3VyY2UpKTtcblx0XHRpZiAocmVhZG9ubHlSZXNvdXJjZXMubGVuZ3RoKSB7XG5cdFx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXHRcdFx0aWYgKHJlYWRvbmx5UmVzb3VyY2VzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncmVhZG9ubHlNZXNzYWdlRmlsZXNEZWxldGUnLCBcIllvdSBhcmUgZGVsZXRpbmcgZmlsZXMgdGhhdCBhcmUgY29uZmlndXJlZCB0byBiZSByZWFkLW9ubHkuIERvIHlvdSB3YW50IHRvIGNvbnRpbnVlP1wiKTtcblx0XHRcdH0gZWxzZSBpZiAocmVhZG9ubHlSZXNvdXJjZXNbMF0uaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncmVhZG9ubHlNZXNzYWdlRm9sZGVyT25lRGVsZXRlJywgXCJZb3UgYXJlIGRlbGV0aW5nIGEgZm9sZGVyIHswfSB0aGF0IGlzIGNvbmZpZ3VyZWQgdG8gYmUgcmVhZC1vbmx5LiBEbyB5b3Ugd2FudCB0byBjb250aW51ZT9cIiwgZGlzdGluY3RFbGVtZW50c1swXS5uYW1lKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3JlYWRvbmx5TWVzc2FnZUZvbGRlckRlbGV0ZScsIFwiWW91IGFyZSBkZWxldGluZyBhIGZpbGUgezB9IHRoYXQgaXMgY29uZmlndXJlZCB0byBiZSByZWFkLW9ubHkuIERvIHlvdSB3YW50IHRvIGNvbnRpbnVlP1wiLCBkaXN0aW5jdEVsZW1lbnRzWzBdLm5hbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0ZGV0YWlsOiBubHMubG9jYWxpemUoJ2NvbnRpbnVlRGV0YWlsJywgXCJUaGUgcmVhZC1vbmx5IHByb3RlY3Rpb24gd2lsbCBiZSBvdmVycmlkZGVuIGlmIHlvdSBjb250aW51ZS5cIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSgnY29udGludWVCdXR0b25MYWJlbCcsIFwiQ29udGludWVcIilcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXJlc3BvbnNlLmNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0bGV0IGNvbmZpcm1hdGlvbjogSUNvbmZpcm1hdGlvblJlc3VsdDtcblxuXHQvLyBXZSBkbyBub3Qgc3VwcG9ydCB1bmRvIG9mIGZvbGRlcnMsIHNvIGluIHRoYXQgY2FzZSB0aGUgZGVsZXRlIGFjdGlvbiBpcyBpcnJldmVyc2libGVcblx0Y29uc3QgZGVsZXRlRGV0YWlsID0gZGlzdGluY3RFbGVtZW50cy5zb21lKGUgPT4gZS5pc0RpcmVjdG9yeSkgPyBubHMubG9jYWxpemUoJ2lycmV2ZXJzaWJsZScsIFwiVGhpcyBhY3Rpb24gaXMgaXJyZXZlcnNpYmxlIVwiKSA6XG5cdFx0ZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxID8gbmxzLmxvY2FsaXplKCdyZXN0b3JlUGx1cmFsJywgXCJZb3UgY2FuIHJlc3RvcmUgdGhlc2UgZmlsZXMgdXNpbmcgdGhlIFVuZG8gY29tbWFuZC5cIikgOiBubHMubG9jYWxpemUoJ3Jlc3RvcmUnLCBcIllvdSBjYW4gcmVzdG9yZSB0aGlzIGZpbGUgdXNpbmcgdGhlIFVuZG8gY29tbWFuZC5cIik7XG5cblx0Ly8gQ2hlY2sgaWYgd2UgbmVlZCB0byBhc2sgZm9yIGNvbmZpcm1hdGlvbiBhdCBhbGxcblx0aWYgKHNraXBDb25maXJtIHx8ICh1c2VUcmFzaCAmJiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihDT05GSVJNX0RFTEVURV9TRVRUSU5HX0tFWSkgPT09IGZhbHNlKSkge1xuXHRcdGNvbmZpcm1hdGlvbiA9IHsgY29uZmlybWVkOiB0cnVlIH07XG5cdH1cblxuXHQvLyBDb25maXJtIGZvciBtb3ZpbmcgdG8gdHJhc2hcblx0ZWxzZSBpZiAodXNlVHJhc2gpIHtcblx0XHRsZXQgeyBtZXNzYWdlLCBkZXRhaWwgfSA9IGdldE1vdmVUb1RyYXNoTWVzc2FnZShkaXN0aW5jdEVsZW1lbnRzKTtcblx0XHRkZXRhaWwgKz0gZGV0YWlsID8gJ1xcbicgOiAnJztcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRkZXRhaWwgKz0gZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxID8gbmxzLmxvY2FsaXplKCd1bmRvQmluRmlsZXMnLCBcIllvdSBjYW4gcmVzdG9yZSB0aGVzZSBmaWxlcyBmcm9tIHRoZSBSZWN5Y2xlIEJpbi5cIikgOiBubHMubG9jYWxpemUoJ3VuZG9CaW4nLCBcIllvdSBjYW4gcmVzdG9yZSB0aGlzIGZpbGUgZnJvbSB0aGUgUmVjeWNsZSBCaW4uXCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkZXRhaWwgKz0gZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxID8gbmxzLmxvY2FsaXplKCd1bmRvVHJhc2hGaWxlcycsIFwiWW91IGNhbiByZXN0b3JlIHRoZXNlIGZpbGVzIGZyb20gdGhlIFRyYXNoLlwiKSA6IG5scy5sb2NhbGl6ZSgndW5kb1RyYXNoJywgXCJZb3UgY2FuIHJlc3RvcmUgdGhpcyBmaWxlIGZyb20gdGhlIFRyYXNoLlwiKTtcblx0XHR9XG5cblx0XHRjb25maXJtYXRpb24gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGRldGFpbCxcblx0XHRcdHByaW1hcnlCdXR0b24sXG5cdFx0XHRjaGVja2JveDoge1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdkb05vdEFza0FnYWluJywgXCJEbyBub3QgYXNrIG1lIGFnYWluXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvLyBDb25maXJtIGZvciBkZWxldGluZyBwZXJtYW5lbnRseVxuXHRlbHNlIHtcblx0XHRsZXQgeyBtZXNzYWdlLCBkZXRhaWwgfSA9IGdldERlbGV0ZU1lc3NhZ2UoZGlzdGluY3RFbGVtZW50cyk7XG5cdFx0ZGV0YWlsICs9IGRldGFpbCA/ICdcXG4nIDogJyc7XG5cdFx0ZGV0YWlsICs9IGRlbGV0ZURldGFpbDtcblx0XHRjb25maXJtYXRpb24gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGRldGFpbCxcblx0XHRcdHByaW1hcnlCdXR0b25cblx0XHR9KTtcblx0fVxuXG5cdC8vIENoZWNrIGZvciBjb25maXJtYXRpb24gY2hlY2tib3hcblx0aWYgKGNvbmZpcm1hdGlvbi5jb25maXJtZWQgJiYgY29uZmlybWF0aW9uLmNoZWNrYm94Q2hlY2tlZCA9PT0gdHJ1ZSkge1xuXHRcdGF3YWl0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKENPTkZJUk1fREVMRVRFX1NFVFRJTkdfS0VZLCBmYWxzZSk7XG5cdH1cblxuXHQvLyBDaGVjayBmb3IgY29uZmlybWF0aW9uXG5cdGlmICghY29uZmlybWF0aW9uLmNvbmZpcm1lZCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdC8vIENhbGwgZnVuY3Rpb25cblx0dHJ5IHtcblx0XHRjb25zdCByZXNvdXJjZUZpbGVFZGl0cyA9IGRpc3RpbmN0RWxlbWVudHMubWFwKGUgPT4gbmV3IFJlc291cmNlRmlsZUVkaXQoZS5yZXNvdXJjZSwgdW5kZWZpbmVkLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZm9sZGVyOiBlLmlzRGlyZWN0b3J5LCBpZ25vcmVJZk5vdEV4aXN0cywgc2tpcFRyYXNoQmluOiAhdXNlVHJhc2gsIG1heFNpemU6IE1BWF9VTkRPX0ZJTEVfU0laRSB9KSk7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdHVuZG9MYWJlbDogZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxID8gbmxzLmxvY2FsaXplKHsga2V5OiAnZGVsZXRlQnVsa0VkaXQnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVyIHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG51bWJlciBvZiBmaWxlcyBkZWxldGVkJ10gfSwgXCJEZWxldGUgezB9IGZpbGVzXCIsIGRpc3RpbmN0RWxlbWVudHMubGVuZ3RoKSA6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2RlbGV0ZUZpbGVCdWxrRWRpdCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgbmFtZSBvZiB0aGUgZmlsZSBkZWxldGVkJ10gfSwgXCJEZWxldGUgezB9XCIsIGRpc3RpbmN0RWxlbWVudHNbMF0ubmFtZSksXG5cdFx0XHRwcm9ncmVzc0xhYmVsOiBkaXN0aW5jdEVsZW1lbnRzLmxlbmd0aCA+IDEgPyBubHMubG9jYWxpemUoeyBrZXk6ICdkZWxldGluZ0J1bGtFZGl0JywgY29tbWVudDogWydQbGFjZWhvbGRlciB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBudW1iZXIgb2YgZmlsZXMgZGVsZXRlZCddIH0sIFwiRGVsZXRpbmcgezB9IGZpbGVzXCIsIGRpc3RpbmN0RWxlbWVudHMubGVuZ3RoKSA6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2RlbGV0aW5nRmlsZUJ1bGtFZGl0JywgY29tbWVudDogWydQbGFjZWhvbGRlciB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBuYW1lIG9mIHRoZSBmaWxlIGRlbGV0ZWQnXSB9LCBcIkRlbGV0aW5nIHswfVwiLCBkaXN0aW5jdEVsZW1lbnRzWzBdLm5hbWUpLFxuXHRcdH07XG5cdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLmFwcGx5QnVsa0VkaXQocmVzb3VyY2VGaWxlRWRpdHMsIG9wdGlvbnMpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXG5cdFx0Ly8gSGFuZGxlIGVycm9yIHRvIGRlbGV0ZSBmaWxlKHMpIGZyb20gYSBtb2RhbCBjb25maXJtYXRpb24gZGlhbG9nXG5cdFx0bGV0IGVycm9yTWVzc2FnZTogc3RyaW5nO1xuXHRcdGxldCBkZXRhaWxNZXNzYWdlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHByaW1hcnlCdXR0b246IHN0cmluZztcblx0XHRpZiAodXNlVHJhc2gpIHtcblx0XHRcdGVycm9yTWVzc2FnZSA9IGlzV2luZG93cyA/IG5scy5sb2NhbGl6ZSgnYmluRmFpbGVkJywgXCJGYWlsZWQgdG8gZGVsZXRlIHVzaW5nIHRoZSBSZWN5Y2xlIEJpbi4gRG8geW91IHdhbnQgdG8gcGVybWFuZW50bHkgZGVsZXRlIGluc3RlYWQ/XCIpIDogbmxzLmxvY2FsaXplKCd0cmFzaEZhaWxlZCcsIFwiRmFpbGVkIHRvIGRlbGV0ZSB1c2luZyB0aGUgVHJhc2guIERvIHlvdSB3YW50IHRvIHBlcm1hbmVudGx5IGRlbGV0ZSBpbnN0ZWFkP1wiKTtcblx0XHRcdGRldGFpbE1lc3NhZ2UgPSBkZWxldGVEZXRhaWw7XG5cdFx0XHRwcmltYXJ5QnV0dG9uID0gbmxzLmxvY2FsaXplKHsga2V5OiAnZGVsZXRlUGVybWFuZW50bHlCdXR0b25MYWJlbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkRlbGV0ZSBQZXJtYW5lbnRseVwiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZXJyb3JNZXNzYWdlID0gdG9FcnJvck1lc3NhZ2UoZXJyb3IsIGZhbHNlKTtcblx0XHRcdHByaW1hcnlCdXR0b24gPSBubHMubG9jYWxpemUoeyBrZXk6ICdyZXRyeUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUmV0cnlcIik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdHR5cGU6ICd3YXJuaW5nJyxcblx0XHRcdG1lc3NhZ2U6IGVycm9yTWVzc2FnZSxcblx0XHRcdGRldGFpbDogZGV0YWlsTWVzc2FnZSxcblx0XHRcdHByaW1hcnlCdXR0b25cblx0XHR9KTtcblxuXHRcdGlmIChyZXMuY29uZmlybWVkKSB7XG5cdFx0XHRpZiAodXNlVHJhc2gpIHtcblx0XHRcdFx0dXNlVHJhc2ggPSBmYWxzZTsgLy8gRGVsZXRlIFBlcm1hbmVudGx5XG5cdFx0XHR9XG5cblx0XHRcdHNraXBDb25maXJtID0gdHJ1ZTtcblx0XHRcdGlnbm9yZUlmTm90RXhpc3RzID0gdHJ1ZTtcblxuXHRcdFx0cmV0dXJuIGRlbGV0ZUZpbGVzKGV4cGxvcmVyU2VydmljZSwgd29ya2luZ0NvcHlGaWxlU2VydmljZSwgZGlhbG9nU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIGVsZW1lbnRzLCB1c2VUcmFzaCwgc2tpcENvbmZpcm0sIGlnbm9yZUlmTm90RXhpc3RzKTtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0TW92ZVRvVHJhc2hNZXNzYWdlKGRpc3RpbmN0RWxlbWVudHM6IEV4cGxvcmVySXRlbVtdKTogeyBtZXNzYWdlOiBzdHJpbmc7IGRldGFpbDogc3RyaW5nIH0ge1xuXHRpZiAoY29udGFpbnNCb3RoRGlyZWN0b3J5QW5kRmlsZShkaXN0aW5jdEVsZW1lbnRzKSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1Nb3ZlVHJhc2hNZXNzYWdlRmlsZXNBbmREaXJlY3RvcmllcycsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGUgZm9sbG93aW5nIHswfSBmaWxlcy9kaXJlY3RvcmllcyBhbmQgdGhlaXIgY29udGVudHM/XCIsIGRpc3RpbmN0RWxlbWVudHMubGVuZ3RoKSxcblx0XHRcdGRldGFpbDogZ2V0RmlsZU5hbWVzTWVzc2FnZShkaXN0aW5jdEVsZW1lbnRzLm1hcChlID0+IGUucmVzb3VyY2UpKVxuXHRcdH07XG5cdH1cblxuXHRpZiAoZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxKSB7XG5cdFx0aWYgKGRpc3RpbmN0RWxlbWVudHNbMF0uaXNEaXJlY3RvcnkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29uZmlybU1vdmVUcmFzaE1lc3NhZ2VNdWx0aXBsZURpcmVjdG9yaWVzJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIHRoZSBmb2xsb3dpbmcgezB9IGRpcmVjdG9yaWVzIGFuZCB0aGVpciBjb250ZW50cz9cIiwgZGlzdGluY3RFbGVtZW50cy5sZW5ndGgpLFxuXHRcdFx0XHRkZXRhaWw6IGdldEZpbGVOYW1lc01lc3NhZ2UoZGlzdGluY3RFbGVtZW50cy5tYXAoZSA9PiBlLnJlc291cmNlKSlcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29uZmlybU1vdmVUcmFzaE1lc3NhZ2VNdWx0aXBsZScsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSB0aGUgZm9sbG93aW5nIHswfSBmaWxlcz9cIiwgZGlzdGluY3RFbGVtZW50cy5sZW5ndGgpLFxuXHRcdFx0ZGV0YWlsOiBnZXRGaWxlTmFtZXNNZXNzYWdlKGRpc3RpbmN0RWxlbWVudHMubWFwKGUgPT4gZS5yZXNvdXJjZSkpXG5cdFx0fTtcblx0fVxuXG5cdGlmIChkaXN0aW5jdEVsZW1lbnRzWzBdLmlzRGlyZWN0b3J5ICYmICFkaXN0aW5jdEVsZW1lbnRzWzBdLmlzU3ltYm9saWNMaW5rKSB7XG5cdFx0cmV0dXJuIHsgbWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb25maXJtTW92ZVRyYXNoTWVzc2FnZUZvbGRlcicsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAnezB9JyBhbmQgaXRzIGNvbnRlbnRzP1wiLCBkaXN0aW5jdEVsZW1lbnRzWzBdLm5hbWUpLCBkZXRhaWw6ICcnIH07XG5cdH1cblxuXHRyZXR1cm4geyBtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1Nb3ZlVHJhc2hNZXNzYWdlRmlsZScsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGRlbGV0ZSAnezB9Jz9cIiwgZGlzdGluY3RFbGVtZW50c1swXS5uYW1lKSwgZGV0YWlsOiAnJyB9O1xufVxuXG5mdW5jdGlvbiBnZXREZWxldGVNZXNzYWdlKGRpc3RpbmN0RWxlbWVudHM6IEV4cGxvcmVySXRlbVtdKTogeyBtZXNzYWdlOiBzdHJpbmc7IGRldGFpbDogc3RyaW5nIH0ge1xuXHRpZiAoY29udGFpbnNCb3RoRGlyZWN0b3J5QW5kRmlsZShkaXN0aW5jdEVsZW1lbnRzKSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1EZWxldGVNZXNzYWdlRmlsZXNBbmREaXJlY3RvcmllcycsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGUgZm9sbG93aW5nIHswfSBmaWxlcy9kaXJlY3RvcmllcyBhbmQgdGhlaXIgY29udGVudHM/XCIsIGRpc3RpbmN0RWxlbWVudHMubGVuZ3RoKSxcblx0XHRcdGRldGFpbDogZ2V0RmlsZU5hbWVzTWVzc2FnZShkaXN0aW5jdEVsZW1lbnRzLm1hcChlID0+IGUucmVzb3VyY2UpKVxuXHRcdH07XG5cdH1cblxuXHRpZiAoZGlzdGluY3RFbGVtZW50cy5sZW5ndGggPiAxKSB7XG5cdFx0aWYgKGRpc3RpbmN0RWxlbWVudHNbMF0uaXNEaXJlY3RvcnkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29uZmlybURlbGV0ZU1lc3NhZ2VNdWx0aXBsZURpcmVjdG9yaWVzJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcGVybWFuZW50bHkgZGVsZXRlIHRoZSBmb2xsb3dpbmcgezB9IGRpcmVjdG9yaWVzIGFuZCB0aGVpciBjb250ZW50cz9cIiwgZGlzdGluY3RFbGVtZW50cy5sZW5ndGgpLFxuXHRcdFx0XHRkZXRhaWw6IGdldEZpbGVOYW1lc01lc3NhZ2UoZGlzdGluY3RFbGVtZW50cy5tYXAoZSA9PiBlLnJlc291cmNlKSlcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29uZmlybURlbGV0ZU1lc3NhZ2VNdWx0aXBsZScsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHBlcm1hbmVudGx5IGRlbGV0ZSB0aGUgZm9sbG93aW5nIHswfSBmaWxlcz9cIiwgZGlzdGluY3RFbGVtZW50cy5sZW5ndGgpLFxuXHRcdFx0ZGV0YWlsOiBnZXRGaWxlTmFtZXNNZXNzYWdlKGRpc3RpbmN0RWxlbWVudHMubWFwKGUgPT4gZS5yZXNvdXJjZSkpXG5cdFx0fTtcblx0fVxuXG5cdGlmIChkaXN0aW5jdEVsZW1lbnRzWzBdLmlzRGlyZWN0b3J5KSB7XG5cdFx0cmV0dXJuIHsgbWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb25maXJtRGVsZXRlTWVzc2FnZUZvbGRlcicsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHBlcm1hbmVudGx5IGRlbGV0ZSAnezB9JyBhbmQgaXRzIGNvbnRlbnRzP1wiLCBkaXN0aW5jdEVsZW1lbnRzWzBdLm5hbWUpLCBkZXRhaWw6ICcnIH07XG5cdH1cblxuXHRyZXR1cm4geyBtZXNzYWdlOiBubHMubG9jYWxpemUoJ2NvbmZpcm1EZWxldGVNZXNzYWdlRmlsZScsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIHBlcm1hbmVudGx5IGRlbGV0ZSAnezB9Jz9cIiwgZGlzdGluY3RFbGVtZW50c1swXS5uYW1lKSwgZGV0YWlsOiAnJyB9O1xufVxuXG5mdW5jdGlvbiBjb250YWluc0JvdGhEaXJlY3RvcnlBbmRGaWxlKGRpc3RpbmN0RWxlbWVudHM6IEV4cGxvcmVySXRlbVtdKTogYm9vbGVhbiB7XG5cdGNvbnN0IGRpcmVjdG9yeSA9IGRpc3RpbmN0RWxlbWVudHMuZmluZChlbGVtZW50ID0+IGVsZW1lbnQuaXNEaXJlY3RvcnkpO1xuXHRjb25zdCBmaWxlID0gZGlzdGluY3RFbGVtZW50cy5maW5kKGVsZW1lbnQgPT4gIWVsZW1lbnQuaXNEaXJlY3RvcnkpO1xuXG5cdHJldHVybiAhIWRpcmVjdG9yeSAmJiAhIWZpbGU7XG59XG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRWYWxpZFBhc3RlRmlsZVRhcmdldChcblx0ZXhwbG9yZXJTZXJ2aWNlOiBJRXhwbG9yZXJTZXJ2aWNlLFxuXHRmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0dGFyZ2V0Rm9sZGVyOiBFeHBsb3Jlckl0ZW0sXG5cdGZpbGVUb1Bhc3RlOiB7IHJlc291cmNlOiBVUkkgfCBzdHJpbmc7IGlzRGlyZWN0b3J5PzogYm9vbGVhbjsgYWxsb3dPdmVyd3JpdGU6IGJvb2xlYW4gfSxcblx0aW5jcmVtZW50YWxOYW1pbmc6ICdzaW1wbGUnIHwgJ3NtYXJ0JyB8ICdkaXNhYmxlZCdcbik6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cblx0bGV0IG5hbWUgPSB0eXBlb2YgZmlsZVRvUGFzdGUucmVzb3VyY2UgPT09ICdzdHJpbmcnID8gZmlsZVRvUGFzdGUucmVzb3VyY2UgOiByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eShmaWxlVG9QYXN0ZS5yZXNvdXJjZSk7XG5cdGxldCBjYW5kaWRhdGUgPSByZXNvdXJjZXMuam9pblBhdGgodGFyZ2V0Rm9sZGVyLnJlc291cmNlLCBuYW1lKTtcblxuXHQvLyBJbiB0aGUgZGlzYWJsZWQgY2FzZSB3ZSBtdXN0IGFzayBpZiBpdCdzIG9rIHRvIG92ZXJ3cml0ZSB0aGUgZmlsZSBpZiBpdCBleGlzdHNcblx0aWYgKGluY3JlbWVudGFsTmFtaW5nID09PSAnZGlzYWJsZWQnKSB7XG5cdFx0Y29uc3QgY2FuT3ZlcndyaXRlID0gYXdhaXQgYXNrRm9yT3ZlcndyaXRlKGZpbGVTZXJ2aWNlLCBkaWFsb2dTZXJ2aWNlLCBjYW5kaWRhdGUpO1xuXHRcdGlmICghY2FuT3ZlcndyaXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0d2hpbGUgKHRydWUgJiYgIWZpbGVUb1Bhc3RlLmFsbG93T3ZlcndyaXRlKSB7XG5cdFx0aWYgKCFleHBsb3JlclNlcnZpY2UuZmluZENsb3Nlc3QoY2FuZGlkYXRlKSkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0aWYgKGluY3JlbWVudGFsTmFtaW5nICE9PSAnZGlzYWJsZWQnKSB7XG5cdFx0XHRuYW1lID0gaW5jcmVtZW50RmlsZU5hbWUobmFtZSwgISFmaWxlVG9QYXN0ZS5pc0RpcmVjdG9yeSwgaW5jcmVtZW50YWxOYW1pbmcpO1xuXHRcdH1cblx0XHRjYW5kaWRhdGUgPSByZXNvdXJjZXMuam9pblBhdGgodGFyZ2V0Rm9sZGVyLnJlc291cmNlLCBuYW1lKTtcblx0fVxuXG5cdHJldHVybiBjYW5kaWRhdGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmNyZW1lbnRGaWxlTmFtZShuYW1lOiBzdHJpbmcsIGlzRm9sZGVyOiBib29sZWFuLCBpbmNyZW1lbnRhbE5hbWluZzogJ3NpbXBsZScgfCAnc21hcnQnKTogc3RyaW5nIHtcblx0aWYgKGluY3JlbWVudGFsTmFtaW5nID09PSAnc2ltcGxlJykge1xuXHRcdGxldCBuYW1lUHJlZml4ID0gbmFtZTtcblx0XHRsZXQgZXh0U3VmZml4ID0gJyc7XG5cdFx0aWYgKCFpc0ZvbGRlcikge1xuXHRcdFx0ZXh0U3VmZml4ID0gZXh0bmFtZShuYW1lKTtcblx0XHRcdG5hbWVQcmVmaXggPSBiYXNlbmFtZShuYW1lLCBleHRTdWZmaXgpO1xuXHRcdH1cblxuXHRcdC8vIG5hbWUgY29weSA1KC50eHQpID0+IG5hbWUgY29weSA2KC50eHQpXG5cdFx0Ly8gbmFtZSBjb3B5KC50eHQpID0+IG5hbWUgY29weSAyKC50eHQpXG5cdFx0Y29uc3Qgc3VmZml4UmVnZXggPSAvXiguKyBjb3B5KSggXFxkKyk/JC87XG5cdFx0aWYgKHN1ZmZpeFJlZ2V4LnRlc3QobmFtZVByZWZpeCkpIHtcblx0XHRcdHJldHVybiBuYW1lUHJlZml4LnJlcGxhY2Uoc3VmZml4UmVnZXgsIChtYXRjaCwgZzE/LCBnMj8pID0+IHtcblx0XHRcdFx0Y29uc3QgbnVtYmVyID0gKGcyID8gcGFyc2VJbnQoZzIpIDogMSk7XG5cdFx0XHRcdHJldHVybiBudW1iZXIgPT09IDBcblx0XHRcdFx0XHQ/IGAke2cxfWBcblx0XHRcdFx0XHQ6IChudW1iZXIgPCBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUlxuXHRcdFx0XHRcdFx0PyBgJHtnMX0gJHtudW1iZXIgKyAxfWBcblx0XHRcdFx0XHRcdDogYCR7ZzF9JHtnMn0gY29weWApO1xuXHRcdFx0fSkgKyBleHRTdWZmaXg7XG5cdFx0fVxuXG5cdFx0Ly8gbmFtZSgudHh0KSA9PiBuYW1lIGNvcHkoLnR4dClcblx0XHRyZXR1cm4gYCR7bmFtZVByZWZpeH0gY29weSR7ZXh0U3VmZml4fWA7XG5cdH1cblxuXHRjb25zdCBzZXBhcmF0b3JzID0gJ1tcXFxcLlxcXFwtX10nO1xuXHRjb25zdCBtYXhOdW1iZXIgPSBDb25zdGFudHMuTUFYX1NBRkVfU01BTExfSU5URUdFUjtcblxuXHQvLyBmaWxlLjEudHh0PT5maWxlLjIudHh0XG5cdGNvbnN0IHN1ZmZpeEZpbGVSZWdleCA9IFJlZ0V4cCgnKC4qJyArIHNlcGFyYXRvcnMgKyAnKShcXFxcZCspKFxcXFwuLiopJCcpO1xuXHRpZiAoIWlzRm9sZGVyICYmIG5hbWUubWF0Y2goc3VmZml4RmlsZVJlZ2V4KSkge1xuXHRcdHJldHVybiBuYW1lLnJlcGxhY2Uoc3VmZml4RmlsZVJlZ2V4LCAobWF0Y2gsIGcxPywgZzI/LCBnMz8pID0+IHtcblx0XHRcdGNvbnN0IG51bWJlciA9IHBhcnNlSW50KGcyKTtcblx0XHRcdHJldHVybiBudW1iZXIgPCBtYXhOdW1iZXJcblx0XHRcdFx0PyBnMSArIFN0cmluZyhudW1iZXIgKyAxKS5wYWRTdGFydChnMi5sZW5ndGgsICcwJykgKyBnM1xuXHRcdFx0XHQ6IGAke2cxfSR7ZzJ9LjEke2czfWA7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyAxLmZpbGUudHh0PT4yLmZpbGUudHh0XG5cdGNvbnN0IHByZWZpeEZpbGVSZWdleCA9IFJlZ0V4cCgnKFxcXFxkKykoJyArIHNlcGFyYXRvcnMgKyAnLiopKFxcXFwuLiopJCcpO1xuXHRpZiAoIWlzRm9sZGVyICYmIG5hbWUubWF0Y2gocHJlZml4RmlsZVJlZ2V4KSkge1xuXHRcdHJldHVybiBuYW1lLnJlcGxhY2UocHJlZml4RmlsZVJlZ2V4LCAobWF0Y2gsIGcxPywgZzI/LCBnMz8pID0+IHtcblx0XHRcdGNvbnN0IG51bWJlciA9IHBhcnNlSW50KGcxKTtcblx0XHRcdHJldHVybiBudW1iZXIgPCBtYXhOdW1iZXJcblx0XHRcdFx0PyBTdHJpbmcobnVtYmVyICsgMSkucGFkU3RhcnQoZzEubGVuZ3RoLCAnMCcpICsgZzIgKyBnM1xuXHRcdFx0XHQ6IGAke2cxfSR7ZzJ9LjEke2czfWA7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyAxLnR4dD0+Mi50eHRcblx0Y29uc3QgcHJlZml4RmlsZU5vTmFtZVJlZ2V4ID0gUmVnRXhwKCcoXFxcXGQrKShcXFxcLi4qKSQnKTtcblx0aWYgKCFpc0ZvbGRlciAmJiBuYW1lLm1hdGNoKHByZWZpeEZpbGVOb05hbWVSZWdleCkpIHtcblx0XHRyZXR1cm4gbmFtZS5yZXBsYWNlKHByZWZpeEZpbGVOb05hbWVSZWdleCwgKG1hdGNoLCBnMT8sIGcyPykgPT4ge1xuXHRcdFx0Y29uc3QgbnVtYmVyID0gcGFyc2VJbnQoZzEpO1xuXHRcdFx0cmV0dXJuIG51bWJlciA8IG1heE51bWJlclxuXHRcdFx0XHQ/IFN0cmluZyhudW1iZXIgKyAxKS5wYWRTdGFydChnMS5sZW5ndGgsICcwJykgKyBnMlxuXHRcdFx0XHQ6IGAke2cxfS4xJHtnMn1gO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gZmlsZS50eHQ9PmZpbGUuMS50eHRcblx0Y29uc3QgbGFzdEluZGV4T2ZEb3QgPSBuYW1lLmxhc3RJbmRleE9mKCcuJyk7XG5cdGlmICghaXNGb2xkZXIgJiYgbGFzdEluZGV4T2ZEb3QgPj0gMCkge1xuXHRcdHJldHVybiBgJHtuYW1lLnN1YnN0cigwLCBsYXN0SW5kZXhPZkRvdCl9LjEke25hbWUuc3Vic3RyKGxhc3RJbmRleE9mRG90KX1gO1xuXHR9XG5cblx0Ly8gMTIzID0+IDEyNFxuXHRjb25zdCBub05hbWVOb0V4dGVuc2lvblJlZ2V4ID0gUmVnRXhwKCcoXFxcXGQrKSQnKTtcblx0aWYgKCFpc0ZvbGRlciAmJiBsYXN0SW5kZXhPZkRvdCA9PT0gLTEgJiYgbmFtZS5tYXRjaChub05hbWVOb0V4dGVuc2lvblJlZ2V4KSkge1xuXHRcdHJldHVybiBuYW1lLnJlcGxhY2Uobm9OYW1lTm9FeHRlbnNpb25SZWdleCwgKG1hdGNoLCBnMT8pID0+IHtcblx0XHRcdGNvbnN0IG51bWJlciA9IHBhcnNlSW50KGcxKTtcblx0XHRcdHJldHVybiBudW1iZXIgPCBtYXhOdW1iZXJcblx0XHRcdFx0PyBTdHJpbmcobnVtYmVyICsgMSkucGFkU3RhcnQoZzEubGVuZ3RoLCAnMCcpXG5cdFx0XHRcdDogYCR7ZzF9LjFgO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gZmlsZSA9PiBmaWxlMVxuXHQvLyBmaWxlMSA9PiBmaWxlMlxuXHRjb25zdCBub0V4dGVuc2lvblJlZ2V4ID0gUmVnRXhwKCcoLiopKFxcXFxkKikkJyk7XG5cdGlmICghaXNGb2xkZXIgJiYgbGFzdEluZGV4T2ZEb3QgPT09IC0xICYmIG5hbWUubWF0Y2gobm9FeHRlbnNpb25SZWdleCkpIHtcblx0XHRyZXR1cm4gbmFtZS5yZXBsYWNlKG5vRXh0ZW5zaW9uUmVnZXgsIChtYXRjaCwgZzE/LCBnMj8pID0+IHtcblx0XHRcdGxldCBudW1iZXIgPSBwYXJzZUludChnMik7XG5cdFx0XHRpZiAoaXNOYU4obnVtYmVyKSkge1xuXHRcdFx0XHRudW1iZXIgPSAwO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG51bWJlciA8IG1heE51bWJlclxuXHRcdFx0XHQ/IGcxICsgU3RyaW5nKG51bWJlciArIDEpLnBhZFN0YXJ0KGcyLmxlbmd0aCwgJzAnKVxuXHRcdFx0XHQ6IGAke2cxfSR7ZzJ9LjFgO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gZm9sZGVyLjE9PmZvbGRlci4yXG5cdGlmIChpc0ZvbGRlciAmJiBuYW1lLm1hdGNoKC8oXFxkKykkLykpIHtcblx0XHRyZXR1cm4gbmFtZS5yZXBsYWNlKC8oXFxkKykkLywgKG1hdGNoLCAuLi5ncm91cHMpID0+IHtcblx0XHRcdGNvbnN0IG51bWJlciA9IHBhcnNlSW50KGdyb3Vwc1swXSk7XG5cdFx0XHRyZXR1cm4gbnVtYmVyIDwgbWF4TnVtYmVyXG5cdFx0XHRcdD8gU3RyaW5nKG51bWJlciArIDEpLnBhZFN0YXJ0KGdyb3Vwc1swXS5sZW5ndGgsICcwJylcblx0XHRcdFx0OiBgJHtncm91cHNbMF19LjFgO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gMS5mb2xkZXI9PjIuZm9sZGVyXG5cdGlmIChpc0ZvbGRlciAmJiBuYW1lLm1hdGNoKC9eKFxcZCspLykpIHtcblx0XHRyZXR1cm4gbmFtZS5yZXBsYWNlKC9eKFxcZCspKC4qKSQvLCAobWF0Y2gsIC4uLmdyb3VwcykgPT4ge1xuXHRcdFx0Y29uc3QgbnVtYmVyID0gcGFyc2VJbnQoZ3JvdXBzWzBdKTtcblx0XHRcdHJldHVybiBudW1iZXIgPCBtYXhOdW1iZXJcblx0XHRcdFx0PyBTdHJpbmcobnVtYmVyICsgMSkucGFkU3RhcnQoZ3JvdXBzWzBdLmxlbmd0aCwgJzAnKSArIGdyb3Vwc1sxXVxuXHRcdFx0XHQ6IGAke2dyb3Vwc1swXX0ke2dyb3Vwc1sxXX0uMWA7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyBmaWxlL2ZvbGRlcj0+ZmlsZS4xL2ZvbGRlci4xXG5cdHJldHVybiBgJHtuYW1lfS4xYDtcbn1cblxuLyoqXG4gKiBDaGVja3MgdG8gc2VlIGlmIHRoZSByZXNvdXJjZSBhbHJlYWR5IGV4aXN0cywgaWYgc28gcHJvbXB0cyB0aGUgdXNlciBpZiB0aGV5IHdvdWxkIGJlIG9rIHdpdGggaXQgYmVpbmcgb3ZlcndyaXR0ZW5cbiAqIEBwYXJhbSBmaWxlU2VydmljZSBUaGUgZmlsZSBzZXJ2aWNlXG4gKiBAcGFyYW0gZGlhbG9nU2VydmljZSBUaGUgZGlhbG9nIHNlcnZpY2VcbiAqIEBwYXJhbSB0YXJnZXRSZXNvdXJjZSBUaGUgcmVzb3VyY2UgdG8gYmUgb3ZlcndyaXR0ZW5cbiAqIEByZXR1cm4gQSBib29sZWFuIGluZGljYXRpbmcgaWYgdGhlIHVzZXIgaXMgb2sgd2l0aCByZXNvdXJjZSBiZWluZyBvdmVyd3JpdHRlbiwgaWYgdGhlIHJlc291cmNlIGRvZXMgbm90IGV4aXN0IGl0IHJldHVybnMgdHJ1ZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gYXNrRm9yT3ZlcndyaXRlKGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLCB0YXJnZXRSZXNvdXJjZTogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdGNvbnN0IGV4aXN0cyA9IGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyh0YXJnZXRSZXNvdXJjZSk7XG5cdGlmICghZXhpc3RzKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0Ly8gQXNrIGZvciBvdmVyd3JpdGUgY29uZmlybWF0aW9uXG5cdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdHR5cGU6IFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb25maXJtT3ZlcndyaXRlJywgXCJBIGZpbGUgb3IgZm9sZGVyIHdpdGggdGhlIG5hbWUgJ3swfScgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGRlc3RpbmF0aW9uIGZvbGRlci4gRG8geW91IHdhbnQgdG8gcmVwbGFjZSBpdD9cIiwgYmFzZW5hbWUodGFyZ2V0UmVzb3VyY2UucGF0aCkpLFxuXHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSgncmVwbGFjZUJ1dHRvbkxhYmVsJywgXCImJlJlcGxhY2VcIilcblx0fSk7XG5cdHJldHVybiBjb25maXJtZWQ7XG59XG5cbi8vIEdsb2JhbCBDb21wYXJlIHdpdGhcbmV4cG9ydCBjbGFzcyBHbG9iYWxDb21wYXJlUmVzb3VyY2VzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uY29tcGFyZUZpbGVXaXRoJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplMignZ2xvYmFsQ29tcGFyZUZpbGUnLCBcIkNvbXBhcmUgQWN0aXZlIEZpbGUgV2l0aC4uLlwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogR2xvYmFsQ29tcGFyZVJlc291cmNlc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBHbG9iYWxDb21wYXJlUmVzb3VyY2VzQWN0aW9uLkxBQkVMLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBBY3RpdmVFZGl0b3JDb250ZXh0LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ2NvbXBhcmVGaWxlV2l0aE1ldGEnLCBcIk9wZW5zIGEgcGlja2VyIHRvIHNlbGVjdCBhIGZpbGUgdG8gZGlmZiB3aXRoIHRoZSBhY3RpdmUgZWRpdG9yLlwiKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgdGV4dE1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGV4dE1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGFjdGl2ZUlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0Y29uc3QgYWN0aXZlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUlucHV0KTtcblx0XHRpZiAoYWN0aXZlUmVzb3VyY2UgJiYgdGV4dE1vZGVsU2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZShhY3RpdmVSZXNvdXJjZSkpIHtcblx0XHRcdGNvbnN0IHBpY2tzID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3MucGljaygnJywgeyBpdGVtQWN0aXZhdGlvbjogSXRlbUFjdGl2YXRpb24uU0VDT05EIH0pO1xuXHRcdFx0aWYgKHBpY2tzPy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSAocGlja3NbMF0gYXMgdW5rbm93biBhcyB7IHJlc291cmNlOiB1bmtub3duIH0pLnJlc291cmNlO1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlKSAmJiB0ZXh0TW9kZWxTZXJ2aWNlLmNhbkhhbmRsZVJlc291cmNlKHJlc291cmNlKSkge1xuXHRcdFx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogYWN0aXZlUmVzb3VyY2UgfSxcblx0XHRcdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiByZXNvdXJjZSB9LFxuXHRcdFx0XHRcdFx0b3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUb2dnbGVBdXRvU2F2ZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi50b2dnbGVBdXRvU2F2ZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRvZ2dsZUF1dG9TYXZlQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUF1dG9TYXZlJywgXCJUb2dnbGUgQXV0byBTYXZlXCIpLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5GaWxlLFxuXHRcdFx0bWV0YWRhdGE6IHsgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUF1dG9TYXZlRGVzY3JpcHRpb24nLCBcIlRvZ2dsZSB0aGUgYWJpbGl0eSB0byBzYXZlIGZpbGVzIGF1dG9tYXRpY2FsbHkgYWZ0ZXIgdHlwaW5nXCIpIH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHJldHVybiBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRvZ2dsZUF1dG9TYXZlKCk7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQmFzZVNhdmVBbGxBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXHRwcml2YXRlIGxhc3REaXJ0eVN0YXRlOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByb3RlY3RlZCBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlTZXJ2aWNlOiBJV29ya2luZ0NvcHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCk7XG5cblx0XHR0aGlzLmxhc3REaXJ0eVN0YXRlID0gdGhpcy53b3JraW5nQ29weVNlcnZpY2UuaGFzRGlydHk7XG5cdFx0dGhpcy5lbmFibGVkID0gdGhpcy5sYXN0RGlydHlTdGF0ZTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBkb1J1bihjb250ZXh0OiB1bmtub3duKTogUHJvbWlzZTx2b2lkPjtcblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gdXBkYXRlIGVuYWJsZW1lbnQgYmFzZWQgb24gd29ya2luZyBjb3B5IGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtpbmdDb3B5U2VydmljZS5vbkRpZENoYW5nZURpcnR5KHdvcmtpbmdDb3B5ID0+IHRoaXMudXBkYXRlRW5hYmxlbWVudCh3b3JraW5nQ29weSkpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRW5hYmxlbWVudCh3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5KTogdm9pZCB7XG5cdFx0Y29uc3QgaGFzRGlydHkgPSB3b3JraW5nQ29weS5pc0RpcnR5KCkgfHwgdGhpcy53b3JraW5nQ29weVNlcnZpY2UuaGFzRGlydHk7XG5cdFx0aWYgKHRoaXMubGFzdERpcnR5U3RhdGUgIT09IGhhc0RpcnR5KSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBoYXNEaXJ0eTtcblx0XHRcdHRoaXMubGFzdERpcnR5U3RhdGUgPSB0aGlzLmVuYWJsZWQ7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGNvbnRleHQ/OiB1bmtub3duKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZG9SdW4oY29udGV4dCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdG9uRXJyb3IodGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCBlcnJvcik7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTYXZlQWxsSW5Hcm91cEFjdGlvbiBleHRlbmRzIEJhc2VTYXZlQWxsQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5zYXZlQWxsSW5Hcm91cCc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IG5scy5sb2NhbGl6ZSgnc2F2ZUFsbEluR3JvdXAnLCBcIlNhdmUgQWxsIGluIEdyb3VwXCIpO1xuXG5cdG92ZXJyaWRlIGdldCBjbGFzcygpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnZXhwbG9yZXItYWN0aW9uICcgKyBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5zYXZlQWxsKTtcblx0fVxuXG5cdHByb3RlY3RlZCBkb1J1bihjb250ZXh0OiB1bmtub3duKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoU0FWRV9BTExfSU5fR1JPVVBfQ09NTUFORF9JRCwge30sIGNvbnRleHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbG9zZUdyb3VwQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5jbG9zZUdyb3VwJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplKCdjbG9zZUdyb3VwJywgXCJDbG9zZSBHcm91cFwiKTtcblxuXHRjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSkge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCwgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uY2xvc2VBbGwpKTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihjb250ZXh0PzogdW5rbm93bik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKENMT1NFX0VESVRPUlNfQU5EX0dST1VQX0NPTU1BTkRfSUQsIHt9LCBjb250ZXh0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9jdXNGaWxlc0V4cGxvcmVyIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uZm9jdXNGaWxlc0V4cGxvcmVyJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplMignZm9jdXNGaWxlc0V4cGxvcmVyJywgXCJGb2N1cyBvbiBGaWxlcyBFeHBsb3JlclwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRm9jdXNGaWxlc0V4cGxvcmVyLklELFxuXHRcdFx0dGl0bGU6IEZvY3VzRmlsZXNFeHBsb3Jlci5MQUJFTCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdmb2N1c0ZpbGVzRXhwbG9yZXJNZXRhZGF0YScsIFwiTW92ZXMgZm9jdXMgdG8gdGhlIGZpbGUgZXhwbG9yZXIgdmlldyBjb250YWluZXIuXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHRhd2FpdCBwYW5lQ29tcG9zaXRlU2VydmljZS5vcGVuUGFuZUNvbXBvc2l0ZShWSUVXTEVUX0lELCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhciwgdHJ1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dBY3RpdmVGaWxlSW5FeHBsb3JlciBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZmlsZXMuYWN0aW9uLnNob3dBY3RpdmVGaWxlSW5FeHBsb3Jlcic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ3Nob3dJbkV4cGxvcmVyJywgXCJSZXZlYWwgQWN0aXZlIEZpbGUgaW4gRXhwbG9yZXIgVmlld1wiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2hvd0FjdGl2ZUZpbGVJbkV4cGxvcmVyLklELFxuXHRcdFx0dGl0bGU6IFNob3dBY3RpdmVGaWxlSW5FeHBsb3Jlci5MQUJFTCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZSxcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUyKCdzaG93SW5FeHBsb3Jlck1ldGFkYXRhJywgXCJSZXZlYWxzIGFuZCBzZWxlY3RzIHRoZSBhY3RpdmUgZmlsZSB3aXRoaW4gdGhlIGV4cGxvcmVyIHZpZXcuXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gRWRpdG9yUmVzb3VyY2VBY2Nlc3Nvci5nZXRPcmlnaW5hbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdGlmIChyZXNvdXJjZSkge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoUkVWRUFMX0lOX0VYUExPUkVSX0NPTU1BTkRfSUQsIHJlc291cmNlKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5BY3RpdmVGaWxlSW5FbXB0eVdvcmtzcGFjZSBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLnNob3dPcGVuZWRGaWxlSW5OZXdXaW5kb3cnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUyKCdvcGVuRmlsZUluRW1wdHlXb3Jrc3BhY2UnLCBcIk9wZW4gQWN0aXZlIEZpbGUgaW4gTmV3IEVtcHR5IFdvcmtzcGFjZVwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE9wZW5BY3RpdmVGaWxlSW5FbXB0eVdvcmtzcGFjZS5JRCxcblx0XHRcdHRpdGxlOiBPcGVuQWN0aXZlRmlsZUluRW1wdHlXb3Jrc3BhY2UuTEFCRUwsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGUsXG5cdFx0XHRwcmVjb25kaXRpb246IEVtcHR5V29ya3NwYWNlU3VwcG9ydENvbnRleHQsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignb3BlbkZpbGVJbkVtcHR5V29ya3NwYWNlTWV0YWRhdGEnLCBcIk9wZW5zIHRoZSBhY3RpdmUgZmlsZSBpbiBhIG5ldyB3aW5kb3cgd2l0aCBubyBmb2xkZXJzIG9wZW4uXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBob3N0U2VydmljZSA9IGFjY2Vzc29yLmdldChJSG9zdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cblx0XHRjb25zdCBmaWxlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0aWYgKGZpbGVSZXNvdXJjZSkge1xuXHRcdFx0aWYgKGZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKGZpbGVSZXNvdXJjZSkpIHtcblx0XHRcdFx0aG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyBmaWxlVXJpOiBmaWxlUmVzb3VyY2UgfV0sIHsgZm9yY2VOZXdXaW5kb3c6IHRydWUgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkaWFsb2dTZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgnb3BlbkZpbGVUb1Nob3dJbk5ld1dpbmRvdy51bnN1cHBvcnRlZHNjaGVtYScsIFwiVGhlIGFjdGl2ZSBlZGl0b3IgbXVzdCBjb250YWluIGFuIG9wZW5hYmxlIHJlc291cmNlLlwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUZpbGVOYW1lKHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsIGl0ZW06IEV4cGxvcmVySXRlbSwgbmFtZTogc3RyaW5nLCBvczogT3BlcmF0aW5nU3lzdGVtKTogeyBjb250ZW50OiBzdHJpbmc7IHNldmVyaXR5OiBTZXZlcml0eSB9IHwgbnVsbCB7XG5cdC8vIFByb2R1Y2UgYSB3ZWxsIGZvcm1lZCBmaWxlIG5hbWVcblx0bmFtZSA9IGdldFdlbGxGb3JtZWRGaWxlTmFtZShuYW1lKTtcblxuXHQvLyBOYW1lIG5vdCBwcm92aWRlZFxuXHRpZiAoIW5hbWUgfHwgbmFtZS5sZW5ndGggPT09IDAgfHwgL15cXHMrJC8udGVzdChuYW1lKSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZW50OiBubHMubG9jYWxpemUoJ2VtcHR5RmlsZU5hbWVFcnJvcicsIFwiQSBmaWxlIG9yIGZvbGRlciBuYW1lIG11c3QgYmUgcHJvdmlkZWQuXCIpLFxuXHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yXG5cdFx0fTtcblx0fVxuXG5cdC8vIFJlbGF0aXZlIHBhdGhzIG9ubHlcblx0aWYgKG5hbWVbMF0gPT09ICcvJyB8fCBuYW1lWzBdID09PSAnXFxcXCcpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Y29udGVudDogbmxzLmxvY2FsaXplKCdmaWxlTmFtZVN0YXJ0c1dpdGhTbGFzaEVycm9yJywgXCJBIGZpbGUgb3IgZm9sZGVyIG5hbWUgY2Fubm90IHN0YXJ0IHdpdGggYSBzbGFzaC5cIiksXG5cdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3Jcblx0XHR9O1xuXHR9XG5cblx0Y29uc3QgbmFtZXMgPSBjb2FsZXNjZShuYW1lLnNwbGl0KC9bXFxcXC9dLykpO1xuXHRjb25zdCBwYXJlbnQgPSBpdGVtLnBhcmVudDtcblxuXHRpZiAobmFtZSAhPT0gaXRlbS5uYW1lKSB7XG5cdFx0Ly8gRG8gbm90IGFsbG93IHRvIG92ZXJ3cml0ZSBleGlzdGluZyBmaWxlXG5cdFx0Y29uc3QgY2hpbGQgPSBwYXJlbnQ/LmdldENoaWxkKG5hbWUpO1xuXHRcdGlmIChjaGlsZCAmJiBjaGlsZCAhPT0gaXRlbSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29udGVudDogbmxzLmxvY2FsaXplKCdmaWxlTmFtZUV4aXN0c0Vycm9yJywgXCJBIGZpbGUgb3IgZm9sZGVyICoqezB9KiogYWxyZWFkeSBleGlzdHMgYXQgdGhpcyBsb2NhdGlvbi4gUGxlYXNlIGNob29zZSBhIGRpZmZlcmVudCBuYW1lLlwiLCBuYW1lKSxcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdC8vIENoZWNrIGZvciBpbnZhbGlkIGZpbGUgbmFtZS5cblx0aWYgKG5hbWVzLnNvbWUoZm9sZGVyTmFtZSA9PiAhcGF0aFNlcnZpY2UuaGFzVmFsaWRCYXNlbmFtZShpdGVtLnJlc291cmNlLCBvcywgZm9sZGVyTmFtZSkpKSB7XG5cdFx0Ly8gRXNjYXBlICogY2hhcmFjdGVyc1xuXHRcdGNvbnN0IGVzY2FwZWROYW1lID0gbmFtZS5yZXBsYWNlKC9cXCovZywgJ1xcXFwqJyk7IC8vIENvZGVRTCBbU00wMjM4M10gVGhpcyBvbmx5IHByb2Nlc3NlcyBmaWxlbmFtZXMgd2hpY2ggYXJlIGVuZm9yY2VkIGFnYWluc3QgaGF2aW5nIGJhY2tzbGFzaGVzIGluIHRoZW0gZmFydGhlciB1cCBpbiB0aGUgc3RhY2suXG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbnRlbnQ6IG5scy5sb2NhbGl6ZSgnaW52YWxpZEZpbGVOYW1lRXJyb3InLCBcIlRoZSBuYW1lICoqezB9KiogaXMgbm90IHZhbGlkIGFzIGEgZmlsZSBvciBmb2xkZXIgbmFtZS4gUGxlYXNlIGNob29zZSBhIGRpZmZlcmVudCBuYW1lLlwiLCB0cmltTG9uZ05hbWUoZXNjYXBlZE5hbWUpKSxcblx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvclxuXHRcdH07XG5cdH1cblxuXHRpZiAobmFtZXMuc29tZShuYW1lID0+IC9eXFxzfFxccyQvLnRlc3QobmFtZSkpKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbnRlbnQ6IG5scy5sb2NhbGl6ZSgnZmlsZU5hbWVXaGl0ZXNwYWNlV2FybmluZycsIFwiTGVhZGluZyBvciB0cmFpbGluZyB3aGl0ZXNwYWNlIGRldGVjdGVkIGluIGZpbGUgb3IgZm9sZGVyIG5hbWUuXCIpLFxuXHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5Lldhcm5pbmdcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHRyaW1Mb25nTmFtZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAobmFtZT8ubGVuZ3RoID4gMjU1KSB7XG5cdFx0cmV0dXJuIGAke25hbWUuc3Vic3RyKDAsIDI1NSl9Li4uYDtcblx0fVxuXG5cdHJldHVybiBuYW1lO1xufVxuXG5mdW5jdGlvbiBnZXRXZWxsRm9ybWVkRmlsZU5hbWUoZmlsZW5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICghZmlsZW5hbWUpIHtcblx0XHRyZXR1cm4gZmlsZW5hbWU7XG5cdH1cblxuXHQvLyBUcmltIHRhYnNcblx0ZmlsZW5hbWUgPSB0cmltKGZpbGVuYW1lLCAnXFx0Jyk7XG5cblx0Ly8gUmVtb3ZlIHRyYWlsaW5nIHNsYXNoZXNcblx0ZmlsZW5hbWUgPSBydHJpbShmaWxlbmFtZSwgJy8nKTtcblx0ZmlsZW5hbWUgPSBydHJpbShmaWxlbmFtZSwgJ1xcXFwnKTtcblxuXHRyZXR1cm4gZmlsZW5hbWU7XG59XG5cbmV4cG9ydCBjbGFzcyBDb21wYXJlTmV3VW50aXRsZWRUZXh0RmlsZXNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmZpbGVzLmFjdGlvbi5jb21wYXJlTmV3VW50aXRsZWRUZXh0RmlsZXMnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUyKCdjb21wYXJlTmV3VW50aXRsZWRUZXh0RmlsZXMnLCBcIkNvbXBhcmUgTmV3IFVudGl0bGVkIFRleHQgRmlsZXNcIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbXBhcmVOZXdVbnRpdGxlZFRleHRGaWxlc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBDb21wYXJlTmV3VW50aXRsZWRUZXh0RmlsZXNBY3Rpb24uTEFCRUwsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGUsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignY29tcGFyZU5ld1VudGl0bGVkVGV4dEZpbGVzTWV0YScsIFwiT3BlbnMgYSBuZXcgZGlmZiBlZGl0b3Igd2l0aCB0d28gdW50aXRsZWQgZmlsZXMuXCIpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogdW5kZWZpbmVkIH0sXG5cdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogdW5kZWZpbmVkIH0sXG5cdFx0XHRvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbXBhcmVXaXRoQ2xpcGJvYXJkQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uY29tcGFyZVdpdGhDbGlwYm9hcmQnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUyKCdjb21wYXJlV2l0aENsaXBib2FyZCcsIFwiQ29tcGFyZSBBY3RpdmUgRmlsZSB3aXRoIENsaXBib2FyZFwiKTtcblxuXHRwcml2YXRlIHJlZ2lzdHJhdGlvbkRpc3Bvc2FsOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzdGF0aWMgU0NIRU1FX0NPVU5URVIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21wYXJlV2l0aENsaXBib2FyZEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBDb21wYXJlV2l0aENsaXBib2FyZEFjdGlvbi5MQUJFTCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRmlsZSxcblx0XHRcdGtleWJpbmRpbmc6IHsgcHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuS2V5QyksIHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliIH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignY29tcGFyZVdpdGhDbGlwYm9hcmRNZXRhJywgXCJPcGVucyBhIG5ldyBkaWZmIGVkaXRvciB0byBjb21wYXJlIHRoZSBhY3RpdmUgZmlsZSB3aXRoIHRoZSBjb250ZW50cyBvZiB0aGUgY2xpcGJvYXJkLlwiKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCB0ZXh0TW9kZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUZXh0TW9kZWxTZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0Y29uc3Qgc2NoZW1lID0gYGNsaXBib2FyZENvbXBhcmUke0NvbXBhcmVXaXRoQ2xpcGJvYXJkQWN0aW9uLlNDSEVNRV9DT1VOVEVSKyt9YDtcblx0XHRpZiAocmVzb3VyY2UgJiYgKGZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHJlc291cmNlKSB8fCByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpKSB7XG5cdFx0XHRpZiAoIXRoaXMucmVnaXN0cmF0aW9uRGlzcG9zYWwpIHtcblx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDbGlwYm9hcmRDb250ZW50UHJvdmlkZXIpO1xuXHRcdFx0XHR0aGlzLnJlZ2lzdHJhdGlvbkRpc3Bvc2FsID0gdGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmFtZSA9IHJlc291cmNlcy5iYXNlbmFtZShyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBlZGl0b3JMYWJlbCA9IG5scy5sb2NhbGl6ZSgnY2xpcGJvYXJkQ29tcGFyaXNvbkxhYmVsJywgXCJDbGlwYm9hcmQgXHUyMTk0IHswfVwiLCBuYW1lKTtcblxuXHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IHJlc291cmNlLndpdGgoeyBzY2hlbWUgfSkgfSxcblx0XHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IHJlc291cmNlIH0sXG5cdFx0XHRcdGxhYmVsOiBlZGl0b3JMYWJlbCxcblx0XHRcdFx0b3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfVxuXHRcdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2UodGhpcy5yZWdpc3RyYXRpb25EaXNwb3NhbCk7XG5cdFx0XHRcdHRoaXMucmVnaXN0cmF0aW9uRGlzcG9zYWwgPSB1bmRlZmluZWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGRpc3Bvc2UodGhpcy5yZWdpc3RyYXRpb25EaXNwb3NhbCk7XG5cdFx0dGhpcy5yZWdpc3RyYXRpb25EaXNwb3NhbCA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBDbGlwYm9hcmRDb250ZW50UHJvdmlkZXIgaW1wbGVtZW50cyBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2Vcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbD4ge1xuXHRcdGNvbnN0IHRleHQgPSBhd2FpdCB0aGlzLmNsaXBib2FyZFNlcnZpY2UucmVhZFRleHQoKTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKHRleHQsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5RmlsZXBhdGhPckZpcnN0TGluZShyZXNvdXJjZSksIHJlc291cmNlKTtcblxuXHRcdHJldHVybiBtb2RlbDtcblx0fVxufVxuXG5mdW5jdGlvbiBvbkVycm9yV2l0aFJldHJ5KG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLCBlcnJvcjogdW5rbm93biwgcmV0cnk6ICgpID0+IFByb21pc2U8dW5rbm93bj4pOiB2b2lkIHtcblx0bm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuRXJyb3IsIHRvRXJyb3JNZXNzYWdlKGVycm9yLCBmYWxzZSksXG5cdFx0W3tcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JldHJ5JywgXCJSZXRyeVwiKSxcblx0XHRcdHJ1bjogKCkgPT4gcmV0cnkoKVxuXHRcdH1dXG5cdCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW5FeHBsb3JlckFuZENyZWF0ZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaXNGb2xkZXI6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0Y29uc3QgZXhwbG9yZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHBsb3JlclNlcnZpY2UpO1xuXHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRjb25zdCBjb25maWdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IGZpbGVzQ29uZmlnU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCByZW1vdGVBZ2VudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUFnZW50U2VydmljZSk7XG5cdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdGNvbnN0IHBhdGhTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQYXRoU2VydmljZSk7XG5cblx0Y29uc3Qgd2FzSGlkZGVuID0gIXZpZXdzU2VydmljZS5pc1ZpZXdWaXNpYmxlKFZJRVdfSUQpO1xuXHRjb25zdCB2aWV3ID0gYXdhaXQgdmlld3NTZXJ2aWNlLm9wZW5WaWV3KFZJRVdfSUQsIHRydWUpO1xuXHRpZiAod2FzSGlkZGVuKSB7XG5cdFx0Ly8gR2l2ZSBleHBsb3JlciBzb21lIHRpbWUgdG8gcmVzb2x2ZSBpdHNlbGYgIzExMTIxOFxuXHRcdGF3YWl0IHRpbWVvdXQoNTAwKTtcblx0fVxuXHRpZiAoIXZpZXcpIHtcblx0XHQvLyBDYW4gaGFwcGVuIGluIGVtcHR5IHdvcmtzcGFjZSBjYXNlIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTAwNjA0KVxuXG5cdFx0aWYgKGlzRm9sZGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ09wZW4gYSBmb2xkZXIgb3Igd29ya3NwYWNlIGZpcnN0LicpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChORVdfVU5USVRMRURfRklMRV9DT01NQU5EX0lEKTtcblx0fVxuXG5cdGNvbnN0IHN0YXRzID0gZXhwbG9yZXJTZXJ2aWNlLmdldENvbnRleHQoZmFsc2UpO1xuXHRjb25zdCBzdGF0ID0gc3RhdHMubGVuZ3RoID4gMCA/IHN0YXRzWzBdIDogdW5kZWZpbmVkO1xuXHRsZXQgZm9sZGVyOiBFeHBsb3Jlckl0ZW07XG5cdGlmIChzdGF0KSB7XG5cdFx0Zm9sZGVyID0gc3RhdC5pc0RpcmVjdG9yeSA/IHN0YXQgOiAoc3RhdC5wYXJlbnQgfHwgZXhwbG9yZXJTZXJ2aWNlLnJvb3RzWzBdKTtcblx0fSBlbHNlIHtcblx0XHRmb2xkZXIgPSBleHBsb3JlclNlcnZpY2Uucm9vdHNbMF07XG5cdH1cblxuXHRpZiAoZm9sZGVyLmlzUmVhZG9ubHkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1BhcmVudCBmb2xkZXIgaXMgcmVhZG9ubHkuJyk7XG5cdH1cblxuXHRjb25zdCBuZXdTdGF0ID0gbmV3IE5ld0V4cGxvcmVySXRlbShmaWxlU2VydmljZSwgY29uZmlnU2VydmljZSwgZmlsZXNDb25maWdTZXJ2aWNlLCBmb2xkZXIsIGlzRm9sZGVyKTtcblx0Zm9sZGVyLmFkZENoaWxkKG5ld1N0YXQpO1xuXG5cdGNvbnN0IG9uU3VjY2VzcyA9IGFzeW5jICh2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc291cmNlVG9DcmVhdGUgPSByZXNvdXJjZXMuam9pblBhdGgoZm9sZGVyLnJlc291cmNlLCB2YWx1ZSk7XG5cdFx0XHRpZiAodmFsdWUuZW5kc1dpdGgoJy8nKSkge1xuXHRcdFx0XHRpc0ZvbGRlciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBleHBsb3JlclNlcnZpY2UuYXBwbHlCdWxrRWRpdChbbmV3IFJlc291cmNlRmlsZUVkaXQodW5kZWZpbmVkLCByZXNvdXJjZVRvQ3JlYXRlLCB7IGZvbGRlcjogaXNGb2xkZXIgfSldLCB7XG5cdFx0XHRcdHVuZG9MYWJlbDogbmxzLmxvY2FsaXplKCdjcmVhdGVCdWxrRWRpdCcsIFwiQ3JlYXRlIHswfVwiLCB2YWx1ZSksXG5cdFx0XHRcdHByb2dyZXNzTGFiZWw6IG5scy5sb2NhbGl6ZSgnY3JlYXRpbmdCdWxrRWRpdCcsIFwiQ3JlYXRpbmcgezB9XCIsIHZhbHVlKSxcblx0XHRcdFx0Y29uZmlybUJlZm9yZVVuZG86IHRydWVcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgcmVmcmVzaElmU2VwYXJhdG9yKHZhbHVlLCBleHBsb3JlclNlcnZpY2UpO1xuXG5cdFx0XHRpZiAoaXNGb2xkZXIpIHtcblx0XHRcdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLnNlbGVjdChyZXNvdXJjZVRvQ3JlYXRlLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiByZXNvdXJjZVRvQ3JlYXRlLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH0pO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRvbkVycm9yV2l0aFJldHJ5KG5vdGlmaWNhdGlvblNlcnZpY2UsIGVycm9yLCAoKSA9PiBvblN1Y2Nlc3ModmFsdWUpKTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3Qgb3MgPSAoYXdhaXQgcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkpPy5vcyA/PyBPUztcblxuXHRhd2FpdCBleHBsb3JlclNlcnZpY2Uuc2V0RWRpdGFibGUobmV3U3RhdCwge1xuXHRcdHZhbGlkYXRpb25NZXNzYWdlOiB2YWx1ZSA9PiB2YWxpZGF0ZUZpbGVOYW1lKHBhdGhTZXJ2aWNlLCBuZXdTdGF0LCB2YWx1ZSwgb3MpLFxuXHRcdG9uRmluaXNoOiBhc3luYyAodmFsdWUsIHN1Y2Nlc3MpID0+IHtcblx0XHRcdGZvbGRlci5yZW1vdmVDaGlsZChuZXdTdGF0KTtcblx0XHRcdGF3YWl0IGV4cGxvcmVyU2VydmljZS5zZXRFZGl0YWJsZShuZXdTdGF0LCBudWxsKTtcblx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdG9uU3VjY2Vzcyh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogTkVXX0ZJTEVfQ09NTUFORF9JRCxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yKSA9PiB7XG5cdFx0YXdhaXQgb3BlbkV4cGxvcmVyQW5kQ3JlYXRlKGFjY2Vzc29yLCBmYWxzZSk7XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiBORVdfRk9MREVSX0NPTU1BTkRfSUQsXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvcikgPT4ge1xuXHRcdGF3YWl0IG9wZW5FeHBsb3JlckFuZENyZWF0ZShhY2Nlc3NvciwgdHJ1ZSk7XG5cdH1cbn0pO1xuXG5leHBvcnQgY29uc3QgcmVuYW1lSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCByZW1vdGVBZ2VudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUFnZW50U2VydmljZSk7XG5cdGNvbnN0IHBhdGhTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQYXRoU2VydmljZSk7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0Y29uc3Qgc3RhdHMgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dChmYWxzZSk7XG5cdGNvbnN0IHN0YXQgPSBzdGF0cy5sZW5ndGggPiAwID8gc3RhdHNbMF0gOiB1bmRlZmluZWQ7XG5cdGlmICghc3RhdCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IG9zID0gKGF3YWl0IHJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpKT8ub3MgPz8gT1M7XG5cblx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHN0YXQsIHtcblx0XHR2YWxpZGF0aW9uTWVzc2FnZTogdmFsdWUgPT4gdmFsaWRhdGVGaWxlTmFtZShwYXRoU2VydmljZSwgc3RhdCwgdmFsdWUsIG9zKSxcblx0XHRvbkZpbmlzaDogYXN5bmMgKHZhbHVlLCBzdWNjZXNzKSA9PiB7XG5cdFx0XHRpZiAoc3VjY2Vzcykge1xuXHRcdFx0XHRjb25zdCBwYXJlbnRSZXNvdXJjZSA9IHN0YXQucGFyZW50IS5yZXNvdXJjZTtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0UmVzb3VyY2UgPSByZXNvdXJjZXMuam9pblBhdGgocGFyZW50UmVzb3VyY2UsIHZhbHVlKTtcblx0XHRcdFx0aWYgKHN0YXQucmVzb3VyY2UudG9TdHJpbmcoKSAhPT0gdGFyZ2V0UmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCBleHBsb3JlclNlcnZpY2UuYXBwbHlCdWxrRWRpdChbbmV3IFJlc291cmNlRmlsZUVkaXQoc3RhdC5yZXNvdXJjZSwgdGFyZ2V0UmVzb3VyY2UpXSwge1xuXHRcdFx0XHRcdFx0XHRjb25maXJtQmVmb3JlVW5kbzogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKS5leHBsb3Jlci5jb25maXJtVW5kbyA9PT0gVW5kb0NvbmZpcm1MZXZlbC5WZXJib3NlLFxuXHRcdFx0XHRcdFx0XHR1bmRvTGFiZWw6IG5scy5sb2NhbGl6ZSgncmVuYW1lQnVsa0VkaXQnLCBcIlJlbmFtZSB7MH0gdG8gezF9XCIsIHN0YXQubmFtZSwgdmFsdWUpLFxuXHRcdFx0XHRcdFx0XHRwcm9ncmVzc0xhYmVsOiBubHMubG9jYWxpemUoJ3JlbmFtaW5nQnVsa0VkaXQnLCBcIlJlbmFtaW5nIHswfSB0byB7MX1cIiwgc3RhdC5uYW1lLCB2YWx1ZSksXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGF3YWl0IHJlZnJlc2hJZlNlcGFyYXRvcih2YWx1ZSwgZXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHN0YXQsIG51bGwpO1xuXHRcdH1cblx0fSk7XG59O1xuXG5leHBvcnQgY29uc3QgbW92ZUZpbGVUb1RyYXNoSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IHN0YXRzID0gZXhwbG9yZXJTZXJ2aWNlLmdldENvbnRleHQodHJ1ZSkuZmlsdGVyKHMgPT4gIXMuaXNSb290KTtcblx0aWYgKHN0YXRzLmxlbmd0aCkge1xuXHRcdGF3YWl0IGRlbGV0ZUZpbGVzKGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElXb3JraW5nQ29weUZpbGVTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSksIGFjY2Vzc29yLmdldChJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSksIHN0YXRzLCB0cnVlKTtcblx0fVxufTtcblxuZXhwb3J0IGNvbnN0IGRlbGV0ZUZpbGVIYW5kbGVyID0gYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdGNvbnN0IGV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKTtcblx0Y29uc3Qgc3RhdHMgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dCh0cnVlKS5maWx0ZXIocyA9PiAhcy5pc1Jvb3QpO1xuXG5cdGlmIChzdGF0cy5sZW5ndGgpIHtcblx0XHRhd2FpdCBkZWxldGVGaWxlcyhhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSksIGFjY2Vzc29yLmdldChJV29ya2luZ0NvcHlGaWxlU2VydmljZSksIGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSksIGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UpLCBzdGF0cywgZmFsc2UpO1xuXHR9XG59O1xuXG5sZXQgcGFzdGVTaG91bGRNb3ZlID0gZmFsc2U7XG5leHBvcnQgY29uc3QgY29weUZpbGVIYW5kbGVyID0gYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdGNvbnN0IGV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKTtcblx0Y29uc3Qgc3RhdHMgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dCh0cnVlKTtcblx0aWYgKHN0YXRzLmxlbmd0aCA+IDApIHtcblx0XHRhd2FpdCBleHBsb3JlclNlcnZpY2Uuc2V0VG9Db3B5KHN0YXRzLCBmYWxzZSk7XG5cdFx0cGFzdGVTaG91bGRNb3ZlID0gZmFsc2U7XG5cdH1cbn07XG5cbmV4cG9ydCBjb25zdCBjdXRGaWxlSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IHN0YXRzID0gZXhwbG9yZXJTZXJ2aWNlLmdldENvbnRleHQodHJ1ZSk7XG5cdGlmIChzdGF0cy5sZW5ndGggPiAwKSB7XG5cdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLnNldFRvQ29weShzdGF0cywgdHJ1ZSk7XG5cdFx0cGFzdGVTaG91bGRNb3ZlID0gdHJ1ZTtcblx0fVxufTtcblxuY29uc3QgZG93bmxvYWRGaWxlSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdGNvbnN0IGNvbnRleHQgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dCh0cnVlKTtcblx0Y29uc3QgZXhwbG9yZXJJdGVtcyA9IGNvbnRleHQubGVuZ3RoID8gY29udGV4dCA6IGV4cGxvcmVyU2VydmljZS5yb290cztcblxuXHRjb25zdCBkb3dubG9hZEhhbmRsZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlRG93bmxvYWQpO1xuXG5cdHRyeSB7XG5cdFx0YXdhaXQgZG93bmxvYWRIYW5kbGVyLmRvd25sb2FkKGV4cGxvcmVySXRlbXMpO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXG5cdFx0dGhyb3cgZXJyb3I7XG5cdH1cbn07XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IERPV05MT0FEX0NPTU1BTkRfSUQsXG5cdGhhbmRsZXI6IGRvd25sb2FkRmlsZUhhbmRsZXJcbn0pO1xuXG5jb25zdCB1cGxvYWRGaWxlSGFuZGxlciA9IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdGNvbnN0IGNvbnRleHQgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dChmYWxzZSk7XG5cdGNvbnN0IGVsZW1lbnQgPSBjb250ZXh0Lmxlbmd0aCA/IGNvbnRleHRbMF0gOiBleHBsb3JlclNlcnZpY2Uucm9vdHNbMF07XG5cblx0dHJ5IHtcblx0XHRjb25zdCBmaWxlcyA9IGF3YWl0IHRyaWdnZXJVcGxvYWQoKTtcblx0XHRpZiAoZmlsZXMpIHtcblx0XHRcdGNvbnN0IGJyb3dzZXJVcGxvYWQgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcm93c2VyRmlsZVVwbG9hZCk7XG5cdFx0XHRhd2FpdCBicm93c2VyVXBsb2FkLnVwbG9hZChlbGVtZW50LCBmaWxlcyk7XG5cdFx0fVxuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdG5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXG5cdFx0dGhyb3cgZXJyb3I7XG5cdH1cbn07XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6IFVQTE9BRF9DT01NQU5EX0lELFxuXHRoYW5kbGVyOiB1cGxvYWRGaWxlSGFuZGxlclxufSk7XG5cbmV4cG9ydCBjb25zdCBwYXN0ZUZpbGVIYW5kbGVyID0gYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBmaWxlTGlzdD86IEZpbGVMaXN0KSA9PiB7XG5cdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgdXJpSWRlbnRpdHlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElVcmlJZGVudGl0eVNlcnZpY2UpO1xuXHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblxuXHRjb25zdCBjb250ZXh0ID0gZXhwbG9yZXJTZXJ2aWNlLmdldENvbnRleHQoZmFsc2UpO1xuXHRjb25zdCBoYXNOYXRpdmVGaWxlc1RvUGFzdGUgPSBmaWxlTGlzdCAmJiBmaWxlTGlzdC5sZW5ndGggPiAwO1xuXHRjb25zdCBjb25maXJtUGFzdGVOYXRpdmUgPSBoYXNOYXRpdmVGaWxlc1RvUGFzdGUgJiYgY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2V4cGxvcmVyLmNvbmZpcm1QYXN0ZU5hdGl2ZScpO1xuXG5cdGNvbnN0IHRvUGFzdGUgPSBhd2FpdCBnZXRGaWxlc1RvUGFzdGUoZmlsZUxpc3QsIGNsaXBib2FyZFNlcnZpY2UsIGhvc3RTZXJ2aWNlKTtcblxuXHRpZiAoY29uZmlybVBhc3RlTmF0aXZlICYmIHRvUGFzdGUuZmlsZXMubGVuZ3RoID49IDEpIHtcblx0XHRjb25zdCBtZXNzYWdlID0gdG9QYXN0ZS5maWxlcy5sZW5ndGggPiAxID9cblx0XHRcdG5scy5sb2NhbGl6ZSgnY29uZmlybU11bHRpUGFzdGVOYXRpdmUnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBwYXN0ZSB0aGUgZm9sbG93aW5nIHswfSBpdGVtcz9cIiwgdG9QYXN0ZS5maWxlcy5sZW5ndGgpIDpcblx0XHRcdG5scy5sb2NhbGl6ZSgnY29uZmlybVBhc3RlTmF0aXZlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gcGFzdGUgJ3swfSc/XCIsIGJhc2VuYW1lKHRvUGFzdGUudHlwZSA9PT0gJ3BhdGhzJyA/IHRvUGFzdGUuZmlsZXNbMF0uZnNQYXRoIDogdG9QYXN0ZS5maWxlc1swXS5uYW1lKSk7XG5cdFx0Y29uc3QgZGV0YWlsID0gdG9QYXN0ZS5maWxlcy5sZW5ndGggPiAxID8gZ2V0RmlsZU5hbWVzTWVzc2FnZSh0b1Bhc3RlLmZpbGVzLm1hcChpdGVtID0+IHtcblx0XHRcdGlmIChVUkkuaXNVcmkoaXRlbSkpIHtcblx0XHRcdFx0cmV0dXJuIGl0ZW0uZnNQYXRoO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodG9QYXN0ZS50eXBlID09PSAncGF0aHMnKSB7XG5cdFx0XHRcdGNvbnN0IHBhdGggPSBnZXRQYXRoRm9yRmlsZShpdGVtKTtcblx0XHRcdFx0aWYgKHBhdGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gcGF0aDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaXRlbS5uYW1lO1xuXHRcdH0pKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjb25maXJtYXRpb24gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0bWVzc2FnZSxcblx0XHRcdGRldGFpbCxcblx0XHRcdGNoZWNrYm94OiB7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2RvTm90QXNrQWdhaW4nLCBcIkRvIG5vdCBhc2sgbWUgYWdhaW5cIilcblx0XHRcdH0sXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdwYXN0ZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUGFzdGVcIilcblx0XHR9KTtcblxuXHRcdGlmICghY29uZmlybWF0aW9uLmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBjb25maXJtYXRpb24gY2hlY2tib3hcblx0XHRpZiAoY29uZmlybWF0aW9uLmNoZWNrYm94Q2hlY2tlZCA9PT0gdHJ1ZSkge1xuXHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2V4cGxvcmVyLmNvbmZpcm1QYXN0ZU5hdGl2ZScsIGZhbHNlKTtcblx0XHR9XG5cdH1cblx0Y29uc3QgZWxlbWVudCA9IGNvbnRleHQubGVuZ3RoID8gY29udGV4dFswXSA6IGV4cGxvcmVyU2VydmljZS5yb290c1swXTtcblx0Y29uc3QgaW5jcmVtZW50YWxOYW1pbmcgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uPigpLmV4cGxvcmVyLmluY3JlbWVudGFsTmFtaW5nO1xuXG5cdGNvbnN0IGVkaXRhYmxlSXRlbSA9IGV4cGxvcmVyU2VydmljZS5nZXRFZGl0YWJsZSgpO1xuXHQvLyBJZiBpdCdzIGFuIGVkaXRhYmxlIGl0ZW0sIGp1c3QgZG8gbm90aGluZ1xuXHRpZiAoZWRpdGFibGVJdGVtKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0dHJ5IHtcblx0XHRsZXQgdGFyZ2V0czogVVJJW10gPSBbXTtcblxuXHRcdGlmICh0b1Bhc3RlLnR5cGUgPT09ICdwYXRocycpIHsgLy8gUGFzdGluZyBmcm9tIGZpbGVzIG9uIGRpc2tcblxuXHRcdFx0Ly8gQ2hlY2sgaWYgdGFyZ2V0IGlzIGFuY2VzdG9yIG9mIHBhc3RlZCBmb2xkZXJcblx0XHRcdGNvbnN0IHNvdXJjZVRhcmdldFBhaXJzID0gY29hbGVzY2UoYXdhaXQgUHJvbWlzZS5hbGwodG9QYXN0ZS5maWxlcy5tYXAoYXN5bmMgZmlsZVRvUGFzdGUgPT4ge1xuXHRcdFx0XHRpZiAoZWxlbWVudC5yZXNvdXJjZS50b1N0cmluZygpICE9PSBmaWxlVG9QYXN0ZS50b1N0cmluZygpICYmIHJlc291cmNlcy5pc0VxdWFsT3JQYXJlbnQoZWxlbWVudC5yZXNvdXJjZSwgZmlsZVRvUGFzdGUpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnZmlsZUlzQW5jZXN0b3InLCBcIkZpbGUgdG8gcGFzdGUgaXMgYW4gYW5jZXN0b3Igb2YgdGhlIGRlc3RpbmF0aW9uIGZvbGRlclwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZmlsZVRvUGFzdGVTdGF0ID0gYXdhaXQgZmlsZVNlcnZpY2Uuc3RhdChmaWxlVG9QYXN0ZSk7XG5cblx0XHRcdFx0Ly8gRmluZCB0YXJnZXRcblx0XHRcdFx0bGV0IHRhcmdldDogRXhwbG9yZXJJdGVtO1xuXHRcdFx0XHRpZiAodXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGVsZW1lbnQucmVzb3VyY2UsIGZpbGVUb1Bhc3RlKSkge1xuXHRcdFx0XHRcdHRhcmdldCA9IGVsZW1lbnQucGFyZW50ITtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0YXJnZXQgPSBlbGVtZW50LmlzRGlyZWN0b3J5ID8gZWxlbWVudCA6IGVsZW1lbnQucGFyZW50ITtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRhcmdldEZpbGUgPSBhd2FpdCBmaW5kVmFsaWRQYXN0ZUZpbGVUYXJnZXQoXG5cdFx0XHRcdFx0ZXhwbG9yZXJTZXJ2aWNlLFxuXHRcdFx0XHRcdGZpbGVTZXJ2aWNlLFxuXHRcdFx0XHRcdGRpYWxvZ1NlcnZpY2UsXG5cdFx0XHRcdFx0dGFyZ2V0LFxuXHRcdFx0XHRcdHsgcmVzb3VyY2U6IGZpbGVUb1Bhc3RlLCBpc0RpcmVjdG9yeTogZmlsZVRvUGFzdGVTdGF0LmlzRGlyZWN0b3J5LCBhbGxvd092ZXJ3cml0ZTogcGFzdGVTaG91bGRNb3ZlIHx8IGluY3JlbWVudGFsTmFtaW5nID09PSAnZGlzYWJsZWQnIH0sXG5cdFx0XHRcdFx0aW5jcmVtZW50YWxOYW1pbmdcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRpZiAoIXRhcmdldEZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgc291cmNlOiBmaWxlVG9QYXN0ZSwgdGFyZ2V0OiB0YXJnZXRGaWxlIH07XG5cdFx0XHR9KSkpO1xuXG5cdFx0XHRpZiAoc291cmNlVGFyZ2V0UGFpcnMubGVuZ3RoID49IDEpIHtcblx0XHRcdFx0Ly8gTW92ZS9Db3B5IEZpbGVcblx0XHRcdFx0aWYgKHBhc3RlU2hvdWxkTW92ZSkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc291cmNlRmlsZUVkaXRzID0gc291cmNlVGFyZ2V0UGFpcnMubWFwKHBhaXIgPT4gbmV3IFJlc291cmNlRmlsZUVkaXQocGFpci5zb3VyY2UsIHBhaXIudGFyZ2V0LCB7IG92ZXJ3cml0ZTogaW5jcmVtZW50YWxOYW1pbmcgPT09ICdkaXNhYmxlZCcgfSkpO1xuXHRcdFx0XHRcdGNvbnN0IG9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHRjb25maXJtQmVmb3JlVW5kbzogY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKS5leHBsb3Jlci5jb25maXJtVW5kbyA9PT0gVW5kb0NvbmZpcm1MZXZlbC5WZXJib3NlLFxuXHRcdFx0XHRcdFx0cHJvZ3Jlc3NMYWJlbDogc291cmNlVGFyZ2V0UGFpcnMubGVuZ3RoID4gMSA/IG5scy5sb2NhbGl6ZSh7IGtleTogJ21vdmluZ0J1bGtFZGl0JywgY29tbWVudDogWydQbGFjZWhvbGRlciB3aWxsIGJlIHJlcGxhY2VkIGJ5IHRoZSBudW1iZXIgb2YgZmlsZXMgYmVpbmcgbW92ZWQnXSB9LCBcIk1vdmluZyB7MH0gZmlsZXNcIiwgc291cmNlVGFyZ2V0UGFpcnMubGVuZ3RoKVxuXHRcdFx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21vdmluZ0ZpbGVCdWxrRWRpdCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgbmFtZSBvZiB0aGUgZmlsZSBtb3ZlZC4nXSB9LCBcIk1vdmluZyB7MH1cIiwgcmVzb3VyY2VzLmJhc2VuYW1lT3JBdXRob3JpdHkoc291cmNlVGFyZ2V0UGFpcnNbMF0udGFyZ2V0KSksXG5cdFx0XHRcdFx0XHR1bmRvTGFiZWw6IHNvdXJjZVRhcmdldFBhaXJzLmxlbmd0aCA+IDEgPyBubHMubG9jYWxpemUoeyBrZXk6ICdtb3ZlQnVsa0VkaXQnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVyIHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG51bWJlciBvZiBmaWxlcyBiZWluZyBtb3ZlZCddIH0sIFwiTW92ZSB7MH0gZmlsZXNcIiwgc291cmNlVGFyZ2V0UGFpcnMubGVuZ3RoKVxuXHRcdFx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21vdmVGaWxlQnVsa0VkaXQnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVyIHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG5hbWUgb2YgdGhlIGZpbGUgbW92ZWQuJ10gfSwgXCJNb3ZlIHswfVwiLCByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eShzb3VyY2VUYXJnZXRQYWlyc1swXS50YXJnZXQpKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLmFwcGx5QnVsa0VkaXQocmVzb3VyY2VGaWxlRWRpdHMsIG9wdGlvbnMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHJlc291cmNlRmlsZUVkaXRzID0gc291cmNlVGFyZ2V0UGFpcnMubWFwKHBhaXIgPT4gbmV3IFJlc291cmNlRmlsZUVkaXQocGFpci5zb3VyY2UsIHBhaXIudGFyZ2V0LCB7IGNvcHk6IHRydWUsIG92ZXJ3cml0ZTogaW5jcmVtZW50YWxOYW1pbmcgPT09ICdkaXNhYmxlZCcgfSkpO1xuXHRcdFx0XHRcdGF3YWl0IGFwcGx5Q29weVJlc291cmNlRWRpdChzb3VyY2VUYXJnZXRQYWlycy5tYXAocGFpciA9PiBwYWlyLnRhcmdldCksIHJlc291cmNlRmlsZUVkaXRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXRzID0gc291cmNlVGFyZ2V0UGFpcnMubWFwKHBhaXIgPT4gcGFpci50YXJnZXQpO1xuXG5cdFx0fSBlbHNlIHsgLy8gUGFzdGluZyBmcm9tIGZpbGUgZGF0YVxuXHRcdFx0Y29uc3QgdGFyZ2V0QW5kRWRpdHMgPSBjb2FsZXNjZShhd2FpdCBQcm9taXNlLmFsbCh0b1Bhc3RlLmZpbGVzLm1hcChhc3luYyBmaWxlID0+IHtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gZWxlbWVudC5pc0RpcmVjdG9yeSA/IGVsZW1lbnQgOiBlbGVtZW50LnBhcmVudCE7XG5cblx0XHRcdFx0Y29uc3QgdGFyZ2V0RmlsZSA9IGF3YWl0IGZpbmRWYWxpZFBhc3RlRmlsZVRhcmdldChcblx0XHRcdFx0XHRleHBsb3JlclNlcnZpY2UsXG5cdFx0XHRcdFx0ZmlsZVNlcnZpY2UsXG5cdFx0XHRcdFx0ZGlhbG9nU2VydmljZSxcblx0XHRcdFx0XHR0YXJnZXQsXG5cdFx0XHRcdFx0eyByZXNvdXJjZTogZmlsZS5uYW1lLCBpc0RpcmVjdG9yeTogZmFsc2UsIGFsbG93T3ZlcndyaXRlOiBwYXN0ZVNob3VsZE1vdmUgfHwgaW5jcmVtZW50YWxOYW1pbmcgPT09ICdkaXNhYmxlZCcgfSxcblx0XHRcdFx0XHRpbmNyZW1lbnRhbE5hbWluZ1xuXHRcdFx0XHQpO1xuXHRcdFx0XHRpZiAoIXRhcmdldEZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR0YXJnZXQ6IHRhcmdldEZpbGUsXG5cdFx0XHRcdFx0ZWRpdDogbmV3IFJlc291cmNlRmlsZUVkaXQodW5kZWZpbmVkLCB0YXJnZXRGaWxlLCB7XG5cdFx0XHRcdFx0XHRvdmVyd3JpdGU6IGluY3JlbWVudGFsTmFtaW5nID09PSAnZGlzYWJsZWQnLFxuXHRcdFx0XHRcdFx0Y29udGVudHM6IChhc3luYyAoKSA9PiBWU0J1ZmZlci53cmFwKG5ldyBVaW50OEFycmF5KGF3YWl0IGZpbGUuYXJyYXlCdWZmZXIoKSkpKSgpLFxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH07XG5cdFx0XHR9KSkpO1xuXG5cdFx0XHRhd2FpdCBhcHBseUNvcHlSZXNvdXJjZUVkaXQodGFyZ2V0QW5kRWRpdHMubWFwKHBhaXIgPT4gcGFpci50YXJnZXQpLCB0YXJnZXRBbmRFZGl0cy5tYXAocGFpciA9PiBwYWlyLmVkaXQpKTtcblx0XHRcdHRhcmdldHMgPSB0YXJnZXRBbmRFZGl0cy5tYXAocGFpciA9PiBwYWlyLnRhcmdldCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRhcmdldHMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBmaXJzdFRhcmdldCA9IHRhcmdldHNbMF07XG5cdFx0XHRhd2FpdCBleHBsb3JlclNlcnZpY2Uuc2VsZWN0KGZpcnN0VGFyZ2V0KTtcblx0XHRcdGlmICh0YXJnZXRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gZXhwbG9yZXJTZXJ2aWNlLmZpbmRDbG9zZXN0KGZpcnN0VGFyZ2V0KTtcblx0XHRcdFx0aWYgKGl0ZW0gJiYgIWl0ZW0uaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogaXRlbS5yZXNvdXJjZSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUgfSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSBjYXRjaCAoZSkge1xuXHRcdG9uRXJyb3Iobm90aWZpY2F0aW9uU2VydmljZSwgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnZmlsZURlbGV0ZWQnLCBcIlRoZSBmaWxlKHMpIHRvIHBhc3RlIGhhdmUgYmVlbiBkZWxldGVkIG9yIG1vdmVkIHNpbmNlIHlvdSBjb3BpZWQgdGhlbS4gezB9XCIsIGdldEVycm9yTWVzc2FnZShlKSkpKTtcblx0fSBmaW5hbGx5IHtcblx0XHRpZiAocGFzdGVTaG91bGRNb3ZlKSB7XG5cdFx0XHQvLyBDdXQgaXMgZG9uZS4gTWFrZSBzdXJlIHRvIGNsZWFyIGN1dCBzdGF0ZS5cblx0XHRcdGF3YWl0IGV4cGxvcmVyU2VydmljZS5zZXRUb0NvcHkoW10sIGZhbHNlKTtcblx0XHRcdHBhc3RlU2hvdWxkTW92ZSA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGFwcGx5Q29weVJlc291cmNlRWRpdCh0YXJnZXRzOiByZWFkb25seSBVUklbXSwgcmVzb3VyY2VGaWxlRWRpdHM6IFJlc291cmNlRmlsZUVkaXRbXSkge1xuXHRcdGNvbnN0IHVuZG9MZXZlbCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElGaWxlc0NvbmZpZ3VyYXRpb24+KCkuZXhwbG9yZXIuY29uZmlybVVuZG87XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdGNvbmZpcm1CZWZvcmVVbmRvOiB1bmRvTGV2ZWwgPT09IFVuZG9Db25maXJtTGV2ZWwuRGVmYXVsdCB8fCB1bmRvTGV2ZWwgPT09IFVuZG9Db25maXJtTGV2ZWwuVmVyYm9zZSxcblx0XHRcdHByb2dyZXNzTGFiZWw6IHRhcmdldHMubGVuZ3RoID4gMSA/IG5scy5sb2NhbGl6ZSh7IGtleTogJ2NvcHlpbmdCdWxrRWRpdCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgbnVtYmVyIG9mIGZpbGVzIGJlaW5nIGNvcGllZCddIH0sIFwiQ29weWluZyB7MH0gZmlsZXNcIiwgdGFyZ2V0cy5sZW5ndGgpXG5cdFx0XHRcdDogbmxzLmxvY2FsaXplKHsga2V5OiAnY29weWluZ0ZpbGVCdWxrRWRpdCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgbmFtZSBvZiB0aGUgZmlsZSBjb3BpZWQuJ10gfSwgXCJDb3B5aW5nIHswfVwiLCByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eSh0YXJnZXRzWzBdKSksXG5cdFx0XHR1bmRvTGFiZWw6IHRhcmdldHMubGVuZ3RoID4gMSA/IG5scy5sb2NhbGl6ZSh7IGtleTogJ2NvcHlCdWxrRWRpdCcsIGNvbW1lbnQ6IFsnUGxhY2Vob2xkZXIgd2lsbCBiZSByZXBsYWNlZCBieSB0aGUgbnVtYmVyIG9mIGZpbGVzIGJlaW5nIGNvcGllZCddIH0sIFwiUGFzdGUgezB9IGZpbGVzXCIsIHRhcmdldHMubGVuZ3RoKVxuXHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2NvcHlGaWxlQnVsa0VkaXQnLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVyIHdpbGwgYmUgcmVwbGFjZWQgYnkgdGhlIG5hbWUgb2YgdGhlIGZpbGUgY29waWVkLiddIH0sIFwiUGFzdGUgezB9XCIsIHJlc291cmNlcy5iYXNlbmFtZU9yQXV0aG9yaXR5KHRhcmdldHNbMF0pKVxuXHRcdH07XG5cdFx0YXdhaXQgZXhwbG9yZXJTZXJ2aWNlLmFwcGx5QnVsa0VkaXQocmVzb3VyY2VGaWxlRWRpdHMsIG9wdGlvbnMpO1xuXHR9XG59O1xuXG50eXBlIEZpbGVzVG9QYXN0ZSA9XG5cdHwgeyB0eXBlOiAncGF0aHMnOyBmaWxlczogVVJJW10gfVxuXHR8IHsgdHlwZTogJ2RhdGEnOyBmaWxlczogRmlsZVtdIH07XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEZpbGVzVG9QYXN0ZShmaWxlTGlzdDogRmlsZUxpc3QgfCB1bmRlZmluZWQsIGNsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLCBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlKTogUHJvbWlzZTxGaWxlc1RvUGFzdGU+IHtcblx0aWYgKGZpbGVMaXN0ICYmIGZpbGVMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHQvLyB3aXRoIGEgYGZpbGVMaXN0YCB3ZSBzdXBwb3J0IG5hdGl2ZWx5IHBhc3RpbmcgZmlsZSBmcm9tIGRpc2sgZnJvbSBjbGlwYm9hcmRcblx0XHRjb25zdCByZXNvdXJjZXMgPSBbLi4uZmlsZUxpc3RdLm1hcChmaWxlID0+IGdldFBhdGhGb3JGaWxlKGZpbGUpKS5maWx0ZXIoZmlsZVBhdGggPT4gISFmaWxlUGF0aCAmJiBpc0Fic29sdXRlKGZpbGVQYXRoKSkubWFwKChmaWxlUGF0aCkgPT4gVVJJLmZpbGUoZmlsZVBhdGghKSk7XG5cdFx0aWYgKHJlc291cmNlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IHR5cGU6ICdwYXRocycsIGZpbGVzOiByZXNvdXJjZXMsIH07XG5cdFx0fVxuXG5cdFx0Ly8gU3VwcG9ydCBwYXN0aW5nIGZpbGVzIHRoYXQgd2UgY2FuJ3QgcmVhZCBmcm9tIGRpc2tcblx0XHRyZXR1cm4geyB0eXBlOiAnZGF0YScsIGZpbGVzOiBbLi4uZmlsZUxpc3RdLmZpbHRlcihmaWxlID0+ICFnZXRQYXRoRm9yRmlsZShmaWxlKSkgfTtcblx0fSBlbHNlIHtcblx0XHQvLyBvdGhlcndpc2Ugd2UgZmFsbGJhY2sgdG8gcmVhZGluZyByZXNvdXJjZXMgZnJvbSBvdXIgY2xpcGJvYXJkIHNlcnZpY2Vcblx0XHRyZXR1cm4geyB0eXBlOiAncGF0aHMnLCBmaWxlczogcmVzb3VyY2VzLmRpc3RpbmN0UGFyZW50cyhhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLnJlYWRSZXNvdXJjZXMoKSwgcmVzb3VyY2UgPT4gcmVzb3VyY2UpIH07XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IG9wZW5GaWxlUHJlc2VydmVGb2N1c0hhbmRsZXIgPSBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IGV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKTtcblx0Y29uc3Qgc3RhdHMgPSBleHBsb3JlclNlcnZpY2UuZ2V0Q29udGV4dCh0cnVlKTtcblxuXHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKHN0YXRzLmZpbHRlcihzID0+ICFzLmlzRGlyZWN0b3J5KS5tYXAocyA9PiAoe1xuXHRcdHJlc291cmNlOiBzLnJlc291cmNlLFxuXHRcdG9wdGlvbnM6IHsgcHJlc2VydmVGb2N1czogdHJ1ZSB9XG5cdH0pKSk7XG59O1xuXG5jbGFzcyBCYXNlU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdHRpdGxlOiBJTG9jYWxpemVkU3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbmV3UmVhZG9ubHlTdGF0ZTogdHJ1ZSB8IGZhbHNlIHwgJ3RvZ2dsZScgfCAncmVzZXQnXG5cdCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkLFxuXHRcdFx0dGl0bGUsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkZpbGUsXG5cdFx0XHRwcmVjb25kaXRpb246IEFjdGl2ZUVkaXRvckNhblRvZ2dsZVJlYWRvbmx5Q29udGV4dFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBmaWxlUmVzb3VyY2UgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0aWYgKCFmaWxlUmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVJlYWRvbmx5KGZpbGVSZXNvdXJjZSwgdGhpcy5uZXdSZWFkb25seVN0YXRlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24gZXh0ZW5kcyBCYXNlU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLnNldEFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbmxzLmxvY2FsaXplMignc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24nLCBcIlNldCBBY3RpdmUgRWRpdG9yIFJlYWQtb25seSBpbiBTZXNzaW9uXCIpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0U2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24uSUQsXG5cdFx0XHRTZXRBY3RpdmVFZGl0b3JSZWFkb25seUluU2Vzc2lvbi5MQUJFTCxcblx0XHRcdHRydWVcblx0XHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXRBY3RpdmVFZGl0b3JXcml0ZWFibGVJblNlc3Npb24gZXh0ZW5kcyBCYXNlU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLnNldEFjdGl2ZUVkaXRvcldyaXRlYWJsZUluU2Vzc2lvbic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ3NldEFjdGl2ZUVkaXRvcldyaXRlYWJsZUluU2Vzc2lvbicsIFwiU2V0IEFjdGl2ZSBFZGl0b3IgV3JpdGVhYmxlIGluIFNlc3Npb25cIik7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRTZXRBY3RpdmVFZGl0b3JXcml0ZWFibGVJblNlc3Npb24uSUQsXG5cdFx0XHRTZXRBY3RpdmVFZGl0b3JXcml0ZWFibGVJblNlc3Npb24uTEFCRUwsXG5cdFx0XHRmYWxzZVxuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRvZ2dsZUFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uIGV4dGVuZHMgQmFzZVNldEFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy50b2dnbGVBY3RpdmVFZGl0b3JSZWFkb25seUluU2Vzc2lvbic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZUFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uJywgXCJUb2dnbGUgQWN0aXZlIEVkaXRvciBSZWFkLW9ubHkgaW4gU2Vzc2lvblwiKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihcblx0XHRcdFRvZ2dsZUFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uLklELFxuXHRcdFx0VG9nZ2xlQWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24uTEFCRUwsXG5cdFx0XHQndG9nZ2xlJ1xuXHRcdCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJlc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24gZXh0ZW5kcyBCYXNlU2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmZpbGVzLnJlc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24nO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUyKCdyZXNldEFjdGl2ZUVkaXRvclJlYWRvbmx5SW5TZXNzaW9uJywgXCJSZXNldCBBY3RpdmUgRWRpdG9yIFJlYWQtb25seSBpbiBTZXNzaW9uXCIpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0UmVzZXRBY3RpdmVFZGl0b3JSZWFkb25seUluU2Vzc2lvbi5JRCxcblx0XHRcdFJlc2V0QWN0aXZlRWRpdG9yUmVhZG9ubHlJblNlc3Npb24uTEFCRUwsXG5cdFx0XHQncmVzZXQnXG5cdFx0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxXQUE0QixVQUFVO0FBQy9DLFNBQVMsU0FBUyxVQUFVLGtCQUFrQjtBQUM5QyxZQUFZLGVBQWU7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsY0FBYztBQUN2QixTQUFTLGVBQTRCO0FBQ3JDLFNBQVMsWUFBaUMsU0FBUyx3QkFBd0I7QUFDM0UsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx3QkFBd0Isd0JBQXdCO0FBQ3pELFNBQVMsb0JBQW9CLHNCQUFzQjtBQUNuRCxTQUFTLDZCQUErQztBQUV4RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtCQUErQiw4QkFBOEIsb0NBQW9DO0FBQzFHLFNBQVMseUJBQW9EO0FBQzdELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCLHdCQUF3QjtBQUNsRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBcUMsMkJBQTJCO0FBQ3pFLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLDBDQUEwQztBQUNuRCxTQUFTLGdCQUFnQjtBQUN6QixTQUF1Qix1QkFBdUI7QUFDOUMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4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a0M7QUFBQSxNQUNsQztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFaYSxtQ0FFSSxLQUFLO0FBRlQsbUNBR0ksUUFBUSxJQUFJLFVBQVUscUNBQXFDLHdDQUF3QztBQUg3RyxJQUFNLG9DQUFOO0FBY0EsTUFBTSx1Q0FBTixNQUFNLDZDQUE0QyxxQ0FBcUM7QUFBQSxFQUs3RixjQUFjO0FBQ2I7QUFBQSxNQUNDLHFDQUFvQztBQUFBLE1BQ3BDLHFDQUFvQztBQUFBLE1BQ3BDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQVphLHFDQUVJLEtBQUs7QUFGVCxxQ0FHSSxRQUFRLElBQUksVUFBVSx1Q0FBdUMsMkNBQTJDO0FBSGxILElBQU0sc0NBQU47QUFjQSxNQUFNLHNDQUFOLE1BQU0sNENBQTJDLHFDQUFxQztBQUFBLEVBSzVGLGNBQWM7QUFDYjtBQUFBLE1BQ0Msb0NBQW1DO0FBQUEsTUFDbkMsb0NBQW1DO0FBQUEsTUFDbkM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBWmEsb0NBRUksS0FBSztBQUZULG9DQUdJLFFBQVEsSUFBSSxVQUFVLHNDQUFzQywwQ0FBMEM7QUFIaEgsSUFBTSxxQ0FBTjsiLAogICJuYW1lcyI6IFsicHJpbWFyeUJ1dHRvbiIsICJuYW1lIiwgInJlc291cmNlcyJdCn0K
