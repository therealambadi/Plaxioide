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
import * as objects from "../../../../base/common/objects.js";
import { IFileService, FileKind } from "../../../../platform/files/common/files.js";
import { IQuickInputService, ItemActivation } from "../../../../platform/quickinput/common/quickInput.js";
import { URI } from "../../../../base/common/uri.js";
import { isWindows, OperatingSystem } from "../../../../base/common/platform.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { Schemas } from "../../../../base/common/network.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { equalsIgnoreCase, format, startsWithIgnoreCase } from "../../../../base/common/strings.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { isValidBasename } from "../../../../base/common/extpath.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { createCancelablePromise } from "../../../../base/common/async.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import { SaveReason } from "../../../common/editor.js";
import { IPathService } from "../../path/common/pathService.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { getActiveDocument } from "../../../../base/browser/dom.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
var OpenLocalFileCommand;
((OpenLocalFileCommand2) => {
  OpenLocalFileCommand2.ID = "workbench.action.files.openLocalFile";
  OpenLocalFileCommand2.LABEL = nls.localize("openLocalFile", "Open Local File...");
  function handler() {
    return (accessor) => {
      const dialogService = accessor.get(IFileDialogService);
      return dialogService.pickFileAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });
    };
  }
  OpenLocalFileCommand2.handler = handler;
})(OpenLocalFileCommand || (OpenLocalFileCommand = {}));
var SaveLocalFileCommand;
((SaveLocalFileCommand2) => {
  SaveLocalFileCommand2.ID = "workbench.action.files.saveLocalFile";
  SaveLocalFileCommand2.LABEL = nls.localize("saveLocalFile", "Save Local File...");
  function handler() {
    return (accessor) => {
      const editorService = accessor.get(IEditorService);
      const activeEditorPane = editorService.activeEditorPane;
      if (activeEditorPane) {
        return editorService.save({ groupId: activeEditorPane.group.id, editor: activeEditorPane.input }, { saveAs: true, availableFileSystems: [Schemas.file], reason: SaveReason.EXPLICIT });
      }
      return Promise.resolve(void 0);
    };
  }
  SaveLocalFileCommand2.handler = handler;
})(SaveLocalFileCommand || (SaveLocalFileCommand = {}));
var OpenLocalFolderCommand;
((OpenLocalFolderCommand2) => {
  OpenLocalFolderCommand2.ID = "workbench.action.files.openLocalFolder";
  OpenLocalFolderCommand2.LABEL = nls.localize("openLocalFolder", "Open Local Folder...");
  function handler() {
    return (accessor) => {
      const dialogService = accessor.get(IFileDialogService);
      return dialogService.pickFolderAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });
    };
  }
  OpenLocalFolderCommand2.handler = handler;
})(OpenLocalFolderCommand || (OpenLocalFolderCommand = {}));
var OpenLocalFileFolderCommand;
((OpenLocalFileFolderCommand2) => {
  OpenLocalFileFolderCommand2.ID = "workbench.action.files.openLocalFileFolder";
  OpenLocalFileFolderCommand2.LABEL = nls.localize("openLocalFileFolder", "Open Local...");
  function handler() {
    return (accessor) => {
      const dialogService = accessor.get(IFileDialogService);
      return dialogService.pickFileFolderAndOpen({ forceNewWindow: false, availableFileSystems: [Schemas.file] });
    };
  }
  OpenLocalFileFolderCommand2.handler = handler;
})(OpenLocalFileFolderCommand || (OpenLocalFileFolderCommand = {}));
var UpdateResult = /* @__PURE__ */ ((UpdateResult2) => {
  UpdateResult2[UpdateResult2["Updated"] = 0] = "Updated";
  UpdateResult2[UpdateResult2["UpdatedWithTrailing"] = 1] = "UpdatedWithTrailing";
  UpdateResult2[UpdateResult2["Updating"] = 2] = "Updating";
  UpdateResult2[UpdateResult2["NotUpdated"] = 3] = "NotUpdated";
  UpdateResult2[UpdateResult2["InvalidPath"] = 4] = "InvalidPath";
  return UpdateResult2;
})(UpdateResult || {});
const RemoteFileDialogContext = new RawContextKey("remoteFileDialogVisible", false);
let SimpleFileDialog = class extends Disposable {
  constructor(fileService, quickInputService, labelService, workspaceContextService, notificationService, fileDialogService, modelService, languageService, environmentService, remoteAgentService, pathService, keybindingService, contextKeyService, accessibilityService, storageService) {
    super();
    this.fileService = fileService;
    this.quickInputService = quickInputService;
    this.labelService = labelService;
    this.workspaceContextService = workspaceContextService;
    this.notificationService = notificationService;
    this.fileDialogService = fileDialogService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.environmentService = environmentService;
    this.remoteAgentService = remoteAgentService;
    this.pathService = pathService;
    this.keybindingService = keybindingService;
    this.accessibilityService = accessibilityService;
    this.storageService = storageService;
    this.hidden = false;
    this.allowFileSelection = true;
    this.allowFolderSelection = false;
    this.requiresTrailing = false;
    this.userEnteredPathSegment = "";
    this.autoCompletePathSegment = "";
    this.isWindows = false;
    this.separator = "/";
    this.onBusyChangeEmitter = this._register(new Emitter());
    this._showDotFiles = true;
    this.remoteAuthority = this.environmentService.remoteAuthority;
    this.contextKey = RemoteFileDialogContext.bindTo(contextKeyService);
    this.scheme = this.pathService.defaultUriScheme;
    this.getShowDotFiles();
    const disposableStore = this._register(new DisposableStore());
    this.storageService.onDidChangeValue(StorageScope.WORKSPACE, "remoteFileDialog.showDotFiles", disposableStore)(async (_) => {
      this.getShowDotFiles();
      this.setButtons();
      const startingValue = this.filePickBox.value;
      const folderValue = this.pathFromUri(this.currentFolder, true);
      this.filePickBox.value = folderValue;
      await this.tryUpdateItems(folderValue, this.currentFolder, true);
      this.filePickBox.value = startingValue;
    });
  }
  setShowDotFiles(showDotFiles) {
    this.storageService.store("remoteFileDialog.showDotFiles", showDotFiles, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  getShowDotFiles() {
    this._showDotFiles = this.storageService.getBoolean("remoteFileDialog.showDotFiles", StorageScope.WORKSPACE, true);
  }
  set busy(busy) {
    if (this.filePickBox.busy !== busy) {
      this.filePickBox.busy = busy;
      this.onBusyChangeEmitter.fire(busy);
    }
  }
  get busy() {
    return this.filePickBox.busy;
  }
  async showOpenDialog(options = {}) {
    this.scheme = this.getScheme(options.availableFileSystems, options.defaultUri);
    this.userHome = await this.getUserHome();
    this.trueHome = await this.getUserHome(true);
    const newOptions = this.getOptions(options);
    if (!newOptions) {
      return Promise.resolve(void 0);
    }
    this.options = newOptions;
    return this.pickResource();
  }
  async showSaveDialog(options) {
    this.scheme = this.getScheme(options.availableFileSystems, options.defaultUri);
    this.userHome = await this.getUserHome();
    this.trueHome = await this.getUserHome(true);
    this.requiresTrailing = true;
    const newOptions = this.getOptions(options, true);
    if (!newOptions) {
      return Promise.resolve(void 0);
    }
    this.options = newOptions;
    this.options.canSelectFolders = true;
    this.options.canSelectFiles = true;
    return new Promise((resolve) => {
      this.pickResource(true).then((folderUri) => {
        resolve(folderUri);
      });
    });
  }
  getOptions(options, isSave = false) {
    let defaultUri = void 0;
    let filename = void 0;
    if (options.defaultUri) {
      defaultUri = this.scheme === options.defaultUri.scheme ? options.defaultUri : void 0;
      filename = isSave ? resources.basename(options.defaultUri) : void 0;
    }
    if (!defaultUri) {
      defaultUri = this.userHome;
      if (filename) {
        defaultUri = resources.joinPath(defaultUri, filename);
      }
    }
    if (this.scheme !== Schemas.file && !this.fileService.hasProvider(defaultUri)) {
      this.notificationService.info(nls.localize("remoteFileDialog.notConnectedToRemote", "File system provider for {0} is not available.", defaultUri.toString()));
      return void 0;
    }
    const newOptions = objects.deepClone(options);
    newOptions.defaultUri = defaultUri;
    return newOptions;
  }
  remoteUriFrom(path, hintUri) {
    if (!path.startsWith("\\\\")) {
      path = path.replace(/\\/g, "/");
    }
    const uri = this.scheme === Schemas.file ? URI.file(path) : URI.from({ scheme: this.scheme, path, query: hintUri?.query, fragment: hintUri?.fragment });
    const authority = uri.scheme === Schemas.file ? void 0 : this.remoteAuthority ?? hintUri?.authority;
    return resources.toLocalResource(
      uri,
      authority,
      // If there is a remote authority, then we should use the system's default URI as the local scheme.
      // If there is *no* remote authority, then we should use the default scheme for this dialog as that is already local.
      authority ? this.pathService.defaultUriScheme : uri.scheme
    );
  }
  getScheme(available, defaultUri) {
    if (available && available.length > 0) {
      if (defaultUri && available.indexOf(defaultUri.scheme) >= 0) {
        return defaultUri.scheme;
      }
      return available[0];
    } else if (defaultUri) {
      return defaultUri.scheme;
    }
    return Schemas.file;
  }
  async getRemoteAgentEnvironment() {
    if (this.remoteAgentEnvironment === void 0) {
      this.remoteAgentEnvironment = await this.remoteAgentService.getEnvironment();
    }
    return this.remoteAgentEnvironment;
  }
  getUserHome(trueHome = false) {
    return trueHome ? this.pathService.userHome({ preferLocal: this.scheme === Schemas.file }) : this.fileDialogService.preferredHome(this.scheme);
  }
  async pickResource(isSave = false) {
    this.allowFolderSelection = !!this.options.canSelectFolders;
    this.allowFileSelection = !!this.options.canSelectFiles;
    this.separator = this.labelService.getSeparator(this.scheme, this.remoteAuthority);
    this.hidden = false;
    this.isWindows = await this.checkIsWindowsOS();
    let homedir = this.options.defaultUri ? this.options.defaultUri : this.workspaceContextService.getWorkspace().folders[0].uri;
    let stat;
    const ext = resources.extname(homedir);
    if (this.options.defaultUri) {
      try {
        stat = await this.fileService.stat(this.options.defaultUri);
      } catch (e) {
      }
      if (!stat || !stat.isDirectory) {
        homedir = resources.dirname(this.options.defaultUri);
        this.trailing = resources.basename(this.options.defaultUri);
      }
    }
    return new Promise((resolve) => {
      this.filePickBox = this._register(this.quickInputService.createQuickPick());
      this.busy = true;
      this.filePickBox.matchOnLabel = false;
      this.filePickBox.sortByLabel = false;
      this.filePickBox.ignoreFocusOut = true;
      this.filePickBox.ok = true;
      this.filePickBox.okLabel = typeof this.options.openLabel === "string" ? this.options.openLabel : this.options.openLabel?.withoutMnemonic;
      if (this.scheme !== Schemas.file && this.options && this.options.availableFileSystems && this.options.availableFileSystems.length > 1 && this.options.availableFileSystems.indexOf(Schemas.file) > -1) {
        this.filePickBox.customButton = true;
        this.filePickBox.customLabel = nls.localize("remoteFileDialog.local", "Show Local");
        let action;
        if (isSave) {
          action = SaveLocalFileCommand;
        } else {
          action = this.allowFileSelection ? this.allowFolderSelection ? OpenLocalFileFolderCommand : OpenLocalFileCommand : OpenLocalFolderCommand;
        }
        const keybinding = this.keybindingService.lookupKeybinding(action.ID);
        if (keybinding) {
          const label = keybinding.getLabel();
          if (label) {
            this.filePickBox.customHover = format("{0} ({1})", action.LABEL, label);
          }
        }
      }
      this.setButtons();
      this._register(this.filePickBox.onDidTriggerButton((e) => {
        this.setShowDotFiles(!this._showDotFiles);
      }));
      let isResolving = 0;
      let isAcceptHandled = false;
      this.currentFolder = resources.dirname(homedir);
      this.userEnteredPathSegment = "";
      this.autoCompletePathSegment = "";
      this.filePickBox.title = this.options.title;
      this.filePickBox.value = this.pathFromUri(this.currentFolder, true);
      this.filePickBox.valueSelection = [this.filePickBox.value.length, this.filePickBox.value.length];
      const doResolve = (uri) => {
        if (uri) {
          uri = resources.addTrailingPathSeparator(uri, this.separator);
          uri = resources.removeTrailingPathSeparator(uri);
        }
        resolve(uri);
        this.contextKey.set(false);
        this.dispose();
      };
      this._register(this.filePickBox.onDidCustom(() => {
        if (isAcceptHandled || this.busy) {
          return;
        }
        isAcceptHandled = true;
        isResolving++;
        if (this.options.availableFileSystems && this.options.availableFileSystems.length > 1) {
          this.options.availableFileSystems = this.options.availableFileSystems.slice(1);
        }
        this.filePickBox.hide();
        if (isSave) {
          return this.fileDialogService.showSaveDialog(this.options).then((result) => {
            doResolve(result);
          });
        } else {
          return this.fileDialogService.showOpenDialog(this.options).then((result) => {
            doResolve(result ? result[0] : void 0);
          });
        }
      }));
      const handleAccept = () => {
        if (this.busy) {
          this.onBusyChangeEmitter.event((busy) => {
            if (!busy) {
              handleAccept();
            }
          });
          return;
        } else if (isAcceptHandled) {
          return;
        }
        isAcceptHandled = true;
        isResolving++;
        this.onDidAccept().then((resolveValue) => {
          if (resolveValue) {
            this.filePickBox.hide();
            doResolve(resolveValue);
          } else if (this.hidden) {
            doResolve(void 0);
          } else {
            isResolving--;
            isAcceptHandled = false;
          }
        });
      };
      this._register(this.filePickBox.onDidAccept((_) => {
        handleAccept();
      }));
      this._register(this.filePickBox.onDidChangeActive((i) => {
        isAcceptHandled = false;
        if (i.length === 1 && this.isSelectionChangeFromUser()) {
          this.filePickBox.validationMessage = void 0;
          const userPath = this.constructFullUserPath();
          if (!equalsIgnoreCase(this.filePickBox.value.substring(0, userPath.length), userPath)) {
            this.filePickBox.valueSelection = [0, this.filePickBox.value.length];
            this.insertText(userPath, userPath);
          }
          this.setAutoComplete(userPath, this.userEnteredPathSegment, i[0], true);
        }
      }));
      this._register(this.filePickBox.onDidChangeValue(async (value) => {
        return this.handleValueChange(value);
      }));
      this._register(this.filePickBox.onDidHide(() => {
        this.hidden = true;
        if (isResolving === 0) {
          doResolve(void 0);
        }
      }));
      this.filePickBox.show();
      this.contextKey.set(true);
      this.updateItems(homedir, true, this.trailing).then(() => {
        if (this.trailing) {
          this.filePickBox.valueSelection = [this.filePickBox.value.length - this.trailing.length, this.filePickBox.value.length - ext.length];
        } else {
          this.filePickBox.valueSelection = [this.filePickBox.value.length, this.filePickBox.value.length];
        }
        this.busy = false;
      });
    });
  }
  dispose() {
    super.dispose();
  }
  async handleValueChange(value) {
    try {
      if (this.isValueChangeFromUser()) {
        if (!equalsIgnoreCase(value, this.constructFullUserPath()) && (!this.isBadSubpath(value) || this.canTildaEscapeHatch(value))) {
          this.filePickBox.validationMessage = void 0;
          const filePickBoxUri = this.filePickBoxValue();
          let updated = 3 /* NotUpdated */;
          if (!resources.extUriIgnorePathCase.isEqual(this.currentFolder, filePickBoxUri)) {
            updated = await this.tryUpdateItems(value, filePickBoxUri);
          }
          if (updated === 3 /* NotUpdated */ || updated === 1 /* UpdatedWithTrailing */) {
            this.setActiveItems(value);
          }
        } else {
          this.filePickBox.activeItems = [];
          this.userEnteredPathSegment = "";
        }
      }
    } catch {
    }
  }
  setButtons() {
    this.filePickBox.buttons = [{
      iconClass: this._showDotFiles ? ThemeIcon.asClassName(Codicon.eye) : ThemeIcon.asClassName(Codicon.eyeClosed),
      tooltip: this._showDotFiles ? nls.localize("remoteFileDialog.hideDotFiles", "Hide dot files") : nls.localize("remoteFileDialog.showDotFiles", "Show dot files"),
      alwaysVisible: true
    }];
  }
  isBadSubpath(value) {
    return this.badPath && value.length > this.badPath.length && equalsIgnoreCase(value.substring(0, this.badPath.length), this.badPath);
  }
  isValueChangeFromUser() {
    if (equalsIgnoreCase(this.filePickBox.value, this.pathAppend(this.currentFolder, this.userEnteredPathSegment + this.autoCompletePathSegment))) {
      return false;
    }
    return true;
  }
  isSelectionChangeFromUser() {
    if (this.activeItem === (this.filePickBox.activeItems ? this.filePickBox.activeItems[0] : void 0)) {
      return false;
    }
    return true;
  }
  constructFullUserPath() {
    const currentFolderPath = this.pathFromUri(this.currentFolder);
    if (equalsIgnoreCase(this.filePickBox.value.substr(0, this.userEnteredPathSegment.length), this.userEnteredPathSegment)) {
      if (equalsIgnoreCase(this.filePickBox.value.substr(0, currentFolderPath.length), currentFolderPath)) {
        return currentFolderPath;
      } else {
        return this.userEnteredPathSegment;
      }
    } else {
      return this.pathAppend(this.currentFolder, this.userEnteredPathSegment);
    }
  }
  filePickBoxValue() {
    const directUri = this.remoteUriFrom(this.filePickBox.value.trimRight(), this.currentFolder);
    const currentPath = this.pathFromUri(this.currentFolder);
    if (equalsIgnoreCase(this.filePickBox.value, currentPath)) {
      return this.currentFolder;
    }
    const currentDisplayUri = this.remoteUriFrom(currentPath, this.currentFolder);
    const relativePath = resources.relativePath(currentDisplayUri, directUri);
    const isSameRoot = this.filePickBox.value.length > 1 && currentPath.length > 1 ? equalsIgnoreCase(this.filePickBox.value.substr(0, 2), currentPath.substr(0, 2)) : false;
    if (relativePath && isSameRoot) {
      let path = resources.joinPath(this.currentFolder, relativePath);
      const directBasename = resources.basename(directUri);
      if (directBasename === "." || directBasename === "..") {
        path = this.remoteUriFrom(this.pathAppend(path, directBasename), this.currentFolder);
      }
      return resources.hasTrailingPathSeparator(directUri) ? resources.addTrailingPathSeparator(path) : path;
    } else {
      return directUri;
    }
  }
  async onDidAccept() {
    this.busy = true;
    if (!this.updatingPromise && this.filePickBox.activeItems.length === 1) {
      const item = this.filePickBox.selectedItems[0];
      if (item.isFolder) {
        if (this.trailing) {
          await this.updateItems(item.uri, true, this.trailing);
        } else {
          const newPath = this.pathFromUri(item.uri);
          if (startsWithIgnoreCase(newPath, this.filePickBox.value) && equalsIgnoreCase(item.label, resources.basename(item.uri))) {
            this.filePickBox.valueSelection = [this.pathFromUri(this.currentFolder).length, this.filePickBox.value.length];
            this.insertText(newPath, this.basenameWithTrailingSlash(item.uri));
          } else if (item.label === ".." && startsWithIgnoreCase(this.filePickBox.value, newPath)) {
            this.filePickBox.valueSelection = [newPath.length, this.filePickBox.value.length];
            this.insertText(newPath, "");
          } else {
            await this.updateItems(item.uri, true);
          }
        }
        this.filePickBox.busy = false;
        return;
      }
    } else if (!this.updatingPromise) {
      if (await this.tryUpdateItems(this.filePickBox.value, this.filePickBoxValue()) !== 3 /* NotUpdated */) {
        this.filePickBox.busy = false;
        return;
      }
    }
    let resolveValue;
    if (this.filePickBox.activeItems.length === 0) {
      resolveValue = this.filePickBoxValue();
    } else if (this.filePickBox.activeItems.length === 1) {
      resolveValue = this.filePickBox.selectedItems[0].uri;
    }
    if (resolveValue) {
      resolveValue = this.addPostfix(resolveValue);
    }
    if (await this.validate(resolveValue)) {
      this.busy = false;
      return resolveValue;
    }
    this.busy = false;
    return void 0;
  }
  root(value) {
    let lastDir = value;
    let dir = resources.dirname(value);
    while (!resources.isEqual(lastDir, dir)) {
      lastDir = dir;
      dir = resources.dirname(dir);
    }
    return dir;
  }
  canTildaEscapeHatch(value) {
    return !!(value.endsWith("~") && this.isBadSubpath(value));
  }
  tildaReplace(value) {
    const home = this.trueHome;
    if (value.length > 0 && value[0] === "~") {
      return resources.joinPath(home, value.substring(1));
    } else if (this.canTildaEscapeHatch(value)) {
      return home;
    }
    return this.remoteUriFrom(value);
  }
  tryAddTrailingSeparatorToDirectory(uri, stat) {
    if (stat.isDirectory) {
      if (!this.endsWithSlash(uri.path)) {
        return resources.addTrailingPathSeparator(uri);
      }
    }
    return uri;
  }
  async tryUpdateItems(value, valueUri, reset = false) {
    if (value.length > 0 && (value[0] === "~" || this.canTildaEscapeHatch(value))) {
      const newDir = this.tildaReplace(value);
      return await this.updateItems(newDir, true) ? 1 /* UpdatedWithTrailing */ : 0 /* Updated */;
    } else if (value === "\\") {
      valueUri = this.root(this.currentFolder);
      value = this.pathFromUri(valueUri);
      return await this.updateItems(valueUri, true) ? 1 /* UpdatedWithTrailing */ : 0 /* Updated */;
    } else {
      const newFolderIsOldFolder = resources.extUriIgnorePathCase.isEqual(this.currentFolder, valueUri);
      const newFolderIsSubFolder = resources.extUriIgnorePathCase.isEqual(this.currentFolder, resources.dirname(valueUri));
      const newFolderIsParent = resources.extUriIgnorePathCase.isEqualOrParent(this.currentFolder, resources.dirname(valueUri));
      const newFolderIsUnrelated = !newFolderIsParent && !newFolderIsSubFolder;
      if (!newFolderIsOldFolder && (this.endsWithSlash(value) || newFolderIsParent || newFolderIsUnrelated) || reset) {
        let stat;
        try {
          stat = await this.fileService.stat(valueUri);
        } catch (e) {
        }
        if (stat && stat.isDirectory && resources.basename(valueUri) !== "." && this.endsWithSlash(value)) {
          valueUri = this.tryAddTrailingSeparatorToDirectory(valueUri, stat);
          return await this.updateItems(valueUri) ? 1 /* UpdatedWithTrailing */ : 0 /* Updated */;
        } else if (this.endsWithSlash(value)) {
          this.filePickBox.validationMessage = nls.localize("remoteFileDialog.badPath", "The path does not exist. Use ~ to go to your home directory.");
          this.badPath = value;
          return 4 /* InvalidPath */;
        } else {
          let inputUriDirname = resources.dirname(valueUri);
          const currentFolderWithoutSep = resources.removeTrailingPathSeparator(resources.addTrailingPathSeparator(this.currentFolder));
          const inputUriDirnameWithoutSep = resources.removeTrailingPathSeparator(resources.addTrailingPathSeparator(inputUriDirname));
          if (!resources.extUriIgnorePathCase.isEqual(currentFolderWithoutSep, inputUriDirnameWithoutSep) && (!/^[a-zA-Z]:$/.test(this.filePickBox.value) || !equalsIgnoreCase(this.pathFromUri(this.currentFolder).substring(0, this.filePickBox.value.length), this.filePickBox.value))) {
            let statWithoutTrailing;
            try {
              statWithoutTrailing = await this.fileService.stat(inputUriDirname);
            } catch (e) {
            }
            if (statWithoutTrailing && statWithoutTrailing.isDirectory) {
              this.badPath = void 0;
              inputUriDirname = this.tryAddTrailingSeparatorToDirectory(inputUriDirname, statWithoutTrailing);
              return await this.updateItems(inputUriDirname, false, resources.basename(valueUri)) ? 1 /* UpdatedWithTrailing */ : 0 /* Updated */;
            }
          }
        }
      }
    }
    this.badPath = void 0;
    return 3 /* NotUpdated */;
  }
  tryUpdateTrailing(value) {
    const ext = resources.extname(value);
    if (this.trailing && ext) {
      this.trailing = resources.basename(value);
    }
  }
  setActiveItems(value) {
    value = this.pathFromUri(this.tildaReplace(value));
    const asUri = this.remoteUriFrom(value);
    const inputBasename = resources.basename(asUri);
    const userPath = this.constructFullUserPath();
    const pathsEqual = equalsIgnoreCase(userPath, value.substring(0, userPath.length)) || equalsIgnoreCase(value, userPath.substring(0, value.length));
    if (pathsEqual) {
      let hasMatch = false;
      for (let i = 0; i < this.filePickBox.items.length; i++) {
        const item = this.filePickBox.items[i];
        if (this.setAutoComplete(value, inputBasename, item)) {
          hasMatch = true;
          break;
        }
      }
      if (!hasMatch) {
        const userBasename = inputBasename.length >= 2 ? userPath.substring(userPath.length - inputBasename.length + 2) : "";
        this.userEnteredPathSegment = userBasename === inputBasename ? inputBasename : "";
        this.autoCompletePathSegment = "";
        this.filePickBox.activeItems = [];
        this.tryUpdateTrailing(asUri);
      }
    } else {
      this.userEnteredPathSegment = inputBasename;
      this.autoCompletePathSegment = "";
      this.filePickBox.activeItems = [];
      this.tryUpdateTrailing(asUri);
    }
  }
  setAutoComplete(startingValue, startingBasename, quickPickItem, force = false) {
    if (this.busy) {
      this.userEnteredPathSegment = startingBasename;
      this.autoCompletePathSegment = "";
      return false;
    }
    const itemBasename = quickPickItem.label;
    if (itemBasename === "..") {
      this.userEnteredPathSegment = "";
      this.autoCompletePathSegment = "";
      this.activeItem = quickPickItem;
      if (force) {
        getActiveDocument().execCommand("insertText", false, "");
      }
      return false;
    } else if (!force && itemBasename.length >= startingBasename.length && equalsIgnoreCase(itemBasename.substr(0, startingBasename.length), startingBasename)) {
      this.userEnteredPathSegment = startingBasename;
      this.activeItem = quickPickItem;
      this.autoCompletePathSegment = "";
      if (quickPickItem.isFolder || !this.trailing) {
        this.filePickBox.activeItems = [quickPickItem];
      } else {
        this.filePickBox.activeItems = [];
      }
      return true;
    } else if (force && !equalsIgnoreCase(this.basenameWithTrailingSlash(quickPickItem.uri), this.userEnteredPathSegment + this.autoCompletePathSegment)) {
      this.userEnteredPathSegment = "";
      if (!this.accessibilityService.isScreenReaderOptimized()) {
        this.autoCompletePathSegment = this.trimTrailingSlash(itemBasename);
      }
      this.activeItem = quickPickItem;
      if (!this.accessibilityService.isScreenReaderOptimized()) {
        this.filePickBox.valueSelection = [this.pathFromUri(this.currentFolder, true).length, this.filePickBox.value.length];
        this.insertText(this.pathAppend(this.currentFolder, this.autoCompletePathSegment), this.autoCompletePathSegment);
        this.filePickBox.valueSelection = [this.filePickBox.value.length - this.autoCompletePathSegment.length, this.filePickBox.value.length];
      }
      return true;
    } else {
      this.userEnteredPathSegment = startingBasename;
      this.autoCompletePathSegment = "";
      return false;
    }
  }
  insertText(wholeValue, insertText) {
    if (this.filePickBox.inputHasFocus()) {
      getActiveDocument().execCommand("insertText", false, insertText);
      if (this.filePickBox.value !== wholeValue) {
        this.filePickBox.value = wholeValue;
        this.handleValueChange(wholeValue);
      }
    } else {
      this.filePickBox.value = wholeValue;
      this.handleValueChange(wholeValue);
    }
  }
  addPostfix(uri) {
    let result = uri;
    if (this.requiresTrailing && this.options.filters && this.options.filters.length > 0 && !resources.hasTrailingPathSeparator(uri)) {
      let hasExt = false;
      const currentExt = resources.extname(uri).substr(1);
      for (let i = 0; i < this.options.filters.length; i++) {
        for (let j = 0; j < this.options.filters[i].extensions.length; j++) {
          if (this.options.filters[i].extensions[j] === "*" || this.options.filters[i].extensions[j] === currentExt) {
            hasExt = true;
            break;
          }
        }
        if (hasExt) {
          break;
        }
      }
      if (!hasExt) {
        result = resources.joinPath(resources.dirname(uri), resources.basename(uri) + "." + this.options.filters[0].extensions[0]);
      }
    }
    return result;
  }
  trimTrailingSlash(path) {
    return path.length > 1 && this.endsWithSlash(path) ? path.substr(0, path.length - 1) : path;
  }
  yesNoPrompt(uri, message) {
    const disposableStore = new DisposableStore();
    const prompt = disposableStore.add(this.quickInputService.createQuickPick());
    prompt.title = message;
    prompt.ignoreFocusOut = true;
    prompt.ok = true;
    prompt.customButton = true;
    prompt.customLabel = nls.localize("remoteFileDialog.cancel", "Cancel");
    prompt.value = this.pathFromUri(uri);
    let isResolving = false;
    return new Promise((resolve) => {
      disposableStore.add(prompt.onDidAccept(() => {
        isResolving = true;
        prompt.hide();
        resolve(true);
      }));
      disposableStore.add(prompt.onDidHide(() => {
        if (!isResolving) {
          resolve(false);
        }
        this.filePickBox.show();
        this.hidden = false;
        disposableStore.dispose();
      }));
      disposableStore.add(prompt.onDidChangeValue(() => {
        prompt.hide();
      }));
      disposableStore.add(prompt.onDidCustom(() => {
        prompt.hide();
      }));
      prompt.show();
    });
  }
  async validate(uri) {
    if (uri === void 0) {
      this.filePickBox.validationMessage = nls.localize("remoteFileDialog.invalidPath", "Please enter a valid path.");
      return Promise.resolve(false);
    }
    let stat;
    let statDirname;
    try {
      statDirname = await this.fileService.stat(resources.dirname(uri));
      stat = await this.fileService.stat(uri);
    } catch (e) {
    }
    if (this.requiresTrailing) {
      if (stat && stat.isDirectory) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateFolder", "The folder already exists. Please use a new file name.");
        return Promise.resolve(false);
      } else if (stat) {
        const message = nls.localize("remoteFileDialog.validateExisting", "{0} already exists. Are you sure you want to overwrite it?", resources.basename(uri));
        return this.yesNoPrompt(uri, message);
      } else if (!isValidBasename(resources.basename(uri), this.isWindows)) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateBadFilename", "Please enter a valid file name.");
        return Promise.resolve(false);
      } else if (!statDirname) {
        const message = nls.localize("remoteFileDialog.validateCreateDirectory", "The folder {0} does not exist. Would you like to create it?", resources.basename(resources.dirname(uri)));
        return this.yesNoPrompt(uri, message);
      } else if (!statDirname.isDirectory) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateNonexistentDir", "Please enter a path that exists.");
        return Promise.resolve(false);
      } else if (statDirname.readonly) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateReadonlyFolder", "This folder cannot be used as a save destination. Please choose another folder");
        return Promise.resolve(false);
      }
    } else {
      if (!stat) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateNonexistentDir", "Please enter a path that exists.");
        return Promise.resolve(false);
      } else if (uri.path === "/" && this.isWindows) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.windowsDriveLetter", "Please start the path with a drive letter.");
        return Promise.resolve(false);
      } else if (stat.isDirectory && !this.allowFolderSelection) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateFileOnly", "Please select a file.");
        return Promise.resolve(false);
      } else if (!stat.isDirectory && !this.allowFileSelection) {
        this.filePickBox.validationMessage = nls.localize("remoteFileDialog.validateFolderOnly", "Please select a folder.");
        return Promise.resolve(false);
      }
    }
    return Promise.resolve(true);
  }
  // Returns true if there is a file at the end of the URI.
  async updateItems(newFolder, force = false, trailing) {
    this.busy = true;
    this.autoCompletePathSegment = "";
    const wasDotDot = trailing === "..";
    trailing = wasDotDot ? void 0 : trailing;
    const isSave = !!trailing;
    let result = false;
    const updatingPromise = createCancelablePromise(async (token) => {
      let folderStat;
      try {
        folderStat = await this.fileService.resolve(newFolder);
        if (!folderStat.isDirectory) {
          trailing = resources.basename(newFolder);
          newFolder = resources.dirname(newFolder);
          folderStat = void 0;
          result = true;
        }
      } catch (e) {
      }
      const newValue = trailing ? this.pathAppend(newFolder, trailing) : this.pathFromUri(newFolder, true);
      this.currentFolder = this.endsWithSlash(newFolder.path) ? newFolder : resources.addTrailingPathSeparator(newFolder, this.separator);
      this.userEnteredPathSegment = trailing ? trailing : "";
      return this.createItems(folderStat, this.currentFolder, token).then((items) => {
        if (token.isCancellationRequested) {
          this.busy = false;
          return false;
        }
        this.filePickBox.itemActivation = ItemActivation.NONE;
        this.filePickBox.items = items;
        if (!equalsIgnoreCase(this.filePickBox.value, newValue) && (force || wasDotDot)) {
          this.filePickBox.valueSelection = [0, this.filePickBox.value.length];
          this.insertText(newValue, newValue);
        }
        if (force && trailing && isSave) {
          this.filePickBox.valueSelection = [this.filePickBox.value.length - trailing.length, this.filePickBox.value.length - trailing.length];
        } else if (!trailing) {
          this.filePickBox.valueSelection = [this.filePickBox.value.length, this.filePickBox.value.length];
        }
        this.busy = false;
        this.updatingPromise = void 0;
        return result;
      });
    });
    if (this.updatingPromise !== void 0) {
      this.updatingPromise.cancel();
    }
    this.updatingPromise = updatingPromise;
    return updatingPromise;
  }
  pathFromUri(uri, endWithSeparator = false) {
    let result = normalizeDriveLetter(uri.fsPath, this.isWindows).replace(/\n/g, "");
    if (this.separator === "/") {
      result = result.replace(/\\/g, this.separator);
    } else {
      result = result.replace(/\//g, this.separator);
    }
    if (endWithSeparator && !this.endsWithSlash(result)) {
      result = result + this.separator;
    }
    return result;
  }
  pathAppend(uri, additional) {
    if (additional === ".." || additional === ".") {
      const basePath = this.pathFromUri(uri, true);
      return basePath + additional;
    } else {
      return this.pathFromUri(resources.joinPath(uri, additional));
    }
  }
  async checkIsWindowsOS() {
    let isWindowsOS = isWindows;
    const env = await this.getRemoteAgentEnvironment();
    if (env) {
      isWindowsOS = env.os === OperatingSystem.Windows;
    }
    return isWindowsOS;
  }
  endsWithSlash(s) {
    return /[\/\\]$/.test(s);
  }
  basenameWithTrailingSlash(fullPath) {
    const child = this.pathFromUri(fullPath, true);
    const parent = this.pathFromUri(resources.dirname(fullPath), true);
    return child.substring(parent.length);
  }
  async createBackItem(currFolder) {
    const fileRepresentationCurr = this.currentFolder.with({ scheme: Schemas.file, authority: "" });
    const fileRepresentationParent = resources.dirname(fileRepresentationCurr);
    if (!resources.isEqual(fileRepresentationCurr, fileRepresentationParent)) {
      const parentFolder = resources.dirname(currFolder);
      if (await this.fileService.exists(parentFolder)) {
        return { label: "..", uri: resources.addTrailingPathSeparator(parentFolder, this.separator), isFolder: true };
      }
    }
    return void 0;
  }
  async createItems(folder, currentFolder, token) {
    const result = [];
    const backDir = await this.createBackItem(currentFolder);
    try {
      if (!folder) {
        folder = await this.fileService.resolve(currentFolder);
      }
      const filteredChildren = this._showDotFiles ? folder.children : folder.children?.filter((child) => !child.name.startsWith("."));
      const items = filteredChildren ? await Promise.all(filteredChildren.map((child) => this.createItem(child, currentFolder, token))) : [];
      for (const item of items) {
        if (item) {
          result.push(item);
        }
      }
    } catch (e) {
      console.log(e);
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const sorted = result.sort((i1, i2) => {
      if (i1.isFolder !== i2.isFolder) {
        return i1.isFolder ? -1 : 1;
      }
      const trimmed1 = this.endsWithSlash(i1.label) ? i1.label.substr(0, i1.label.length - 1) : i1.label;
      const trimmed2 = this.endsWithSlash(i2.label) ? i2.label.substr(0, i2.label.length - 1) : i2.label;
      return trimmed1.localeCompare(trimmed2);
    });
    if (backDir) {
      sorted.unshift(backDir);
    }
    return sorted;
  }
  filterFile(file) {
    if (this.options.filters) {
      for (let i = 0; i < this.options.filters.length; i++) {
        for (let j = 0; j < this.options.filters[i].extensions.length; j++) {
          const testExt = this.options.filters[i].extensions[j];
          if (testExt === "*" || file.path.endsWith("." + testExt)) {
            return true;
          }
        }
      }
      return false;
    }
    return true;
  }
  async createItem(stat, parent, token) {
    if (token.isCancellationRequested) {
      return void 0;
    }
    let fullPath = resources.joinPath(parent, stat.name);
    if (stat.isDirectory) {
      const filename = resources.basename(fullPath);
      fullPath = resources.addTrailingPathSeparator(fullPath, this.separator);
      return { label: filename, uri: fullPath, isFolder: true, iconClasses: getIconClasses(this.modelService, this.languageService, fullPath || void 0, FileKind.FOLDER) };
    } else if (!stat.isDirectory && this.allowFileSelection && this.filterFile(fullPath)) {
      return { label: stat.name, uri: fullPath, isFolder: false, iconClasses: getIconClasses(this.modelService, this.languageService, fullPath || void 0) };
    }
    return void 0;
  }
};
SimpleFileDialog = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IFileDialogService),
  __decorateParam(6, IModelService),
  __decorateParam(7, ILanguageService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IRemoteAgentService),
  __decorateParam(10, IPathService),
  __decorateParam(11, IKeybindingService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IAccessibilityService),
  __decorateParam(14, IStorageService)
], SimpleFileDialog);
export {
  OpenLocalFileCommand,
  OpenLocalFileFolderCommand,
  OpenLocalFolderCommand,
  RemoteFileDialogContext,
  SaveLocalFileCommand,
  SimpleFileDialog
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZGlhbG9ncy9icm93c2VyL3NpbXBsZUZpbGVEaWFsb2cudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0ICogYXMgb2JqZWN0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0LCBGaWxlS2luZCwgSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrLCBJdGVtQWN0aXZhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGlzV2luZG93cywgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVNhdmVEaWFsb2dPcHRpb25zLCBJT3BlbkRpYWxvZ09wdGlvbnMsIElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBnZXRJY29uQ2xhc3NlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZ2V0SWNvbkNsYXNzZXMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgSUNvbnRleHRLZXksIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGVxdWFsc0lnbm9yZUNhc2UsIGZvcm1hdCwgc3RhcnRzV2l0aElnbm9yZUNhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50RW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgaXNWYWxpZEJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgQ2FuY2VsYWJsZVByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgU2F2ZVJlYXNvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBnZXRBY3RpdmVEb2N1bWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgbmFtZXNwYWNlIE9wZW5Mb2NhbEZpbGVDb21tYW5kIHtcblx0ZXhwb3J0IGNvbnN0IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkxvY2FsRmlsZSc7XG5cdGV4cG9ydCBjb25zdCBMQUJFTCA9IG5scy5sb2NhbGl6ZSgnb3BlbkxvY2FsRmlsZScsIFwiT3BlbiBMb2NhbCBGaWxlLi4uXCIpO1xuXHRleHBvcnQgZnVuY3Rpb24gaGFuZGxlcigpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlRGlhbG9nU2VydmljZSk7XG5cdFx0XHRyZXR1cm4gZGlhbG9nU2VydmljZS5waWNrRmlsZUFuZE9wZW4oeyBmb3JjZU5ld1dpbmRvdzogZmFsc2UsIGF2YWlsYWJsZUZpbGVTeXN0ZW1zOiBbU2NoZW1hcy5maWxlXSB9KTtcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgU2F2ZUxvY2FsRmlsZUNvbW1hbmQge1xuXHRleHBvcnQgY29uc3QgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5zYXZlTG9jYWxGaWxlJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMID0gbmxzLmxvY2FsaXplKCdzYXZlTG9jYWxGaWxlJywgXCJTYXZlIExvY2FsIEZpbGUuLi5cIik7XG5cdGV4cG9ydCBmdW5jdGlvbiBoYW5kbGVyKCk6IElDb21tYW5kSGFuZGxlciB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yUGFuZSA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0b3JTZXJ2aWNlLnNhdmUoeyBncm91cElkOiBhY3RpdmVFZGl0b3JQYW5lLmdyb3VwLmlkLCBlZGl0b3I6IGFjdGl2ZUVkaXRvclBhbmUuaW5wdXQgfSwgeyBzYXZlQXM6IHRydWUsIGF2YWlsYWJsZUZpbGVTeXN0ZW1zOiBbU2NoZW1hcy5maWxlXSwgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lUIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIE9wZW5Mb2NhbEZvbGRlckNvbW1hbmQge1xuXHRleHBvcnQgY29uc3QgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5maWxlcy5vcGVuTG9jYWxGb2xkZXInO1xuXHRleHBvcnQgY29uc3QgTEFCRUwgPSBubHMubG9jYWxpemUoJ29wZW5Mb2NhbEZvbGRlcicsIFwiT3BlbiBMb2NhbCBGb2xkZXIuLi5cIik7XG5cdGV4cG9ydCBmdW5jdGlvbiBoYW5kbGVyKCk6IElDb21tYW5kSGFuZGxlciB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdHJldHVybiBkaWFsb2dTZXJ2aWNlLnBpY2tGb2xkZXJBbmRPcGVuKHsgZm9yY2VOZXdXaW5kb3c6IGZhbHNlLCBhdmFpbGFibGVGaWxlU3lzdGVtczogW1NjaGVtYXMuZmlsZV0gfSk7XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgbmFtZXNwYWNlIE9wZW5Mb2NhbEZpbGVGb2xkZXJDb21tYW5kIHtcblx0ZXhwb3J0IGNvbnN0IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uZmlsZXMub3BlbkxvY2FsRmlsZUZvbGRlcic7XG5cdGV4cG9ydCBjb25zdCBMQUJFTCA9IG5scy5sb2NhbGl6ZSgnb3BlbkxvY2FsRmlsZUZvbGRlcicsIFwiT3BlbiBMb2NhbC4uLlwiKTtcblx0ZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0cmV0dXJuIGRpYWxvZ1NlcnZpY2UucGlja0ZpbGVGb2xkZXJBbmRPcGVuKHsgZm9yY2VOZXdXaW5kb3c6IGZhbHNlLCBhdmFpbGFibGVGaWxlU3lzdGVtczogW1NjaGVtYXMuZmlsZV0gfSk7XG5cdFx0fTtcblx0fVxufVxuXG5pbnRlcmZhY2UgRmlsZVF1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdHVyaTogVVJJO1xuXHRpc0ZvbGRlcjogYm9vbGVhbjtcbn1cblxuZW51bSBVcGRhdGVSZXN1bHQge1xuXHRVcGRhdGVkLFxuXHRVcGRhdGVkV2l0aFRyYWlsaW5nLFxuXHRVcGRhdGluZyxcblx0Tm90VXBkYXRlZCxcblx0SW52YWxpZFBhdGhcbn1cblxuZXhwb3J0IGNvbnN0IFJlbW90ZUZpbGVEaWFsb2dDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3JlbW90ZUZpbGVEaWFsb2dWaXNpYmxlJywgZmFsc2UpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTaW1wbGVGaWxlRGlhbG9nIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXHRzaG93T3BlbkRpYWxvZyhvcHRpb25zOiBJT3BlbkRpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD47XG5cdHNob3dTYXZlRGlhbG9nKG9wdGlvbnM6IElTYXZlRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPjtcbn1cblxuZXhwb3J0IGNsYXNzIFNpbXBsZUZpbGVEaWFsb2cgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNpbXBsZUZpbGVEaWFsb2cge1xuXHRwcml2YXRlIG9wdGlvbnMhOiBJT3BlbkRpYWxvZ09wdGlvbnM7XG5cdHByaXZhdGUgY3VycmVudEZvbGRlciE6IFVSSTtcblx0cHJpdmF0ZSBmaWxlUGlja0JveCE6IElRdWlja1BpY2s8RmlsZVF1aWNrUGlja0l0ZW0+O1xuXHRwcml2YXRlIGhpZGRlbjogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIGFsbG93RmlsZVNlbGVjdGlvbjogYm9vbGVhbiA9IHRydWU7XG5cdHByaXZhdGUgYWxsb3dGb2xkZXJTZWxlY3Rpb246IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZW1vdGVBdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXF1aXJlc1RyYWlsaW5nOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgdHJhaWxpbmc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIHNjaGVtZTogc3RyaW5nO1xuXHRwcml2YXRlIGNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHVzZXJFbnRlcmVkUGF0aFNlZ21lbnQ6IHN0cmluZyA9ICcnO1xuXHRwcml2YXRlIGF1dG9Db21wbGV0ZVBhdGhTZWdtZW50OiBzdHJpbmcgPSAnJztcblx0cHJpdmF0ZSBhY3RpdmVJdGVtOiBGaWxlUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB1c2VySG9tZSE6IFVSSTtcblx0cHJpdmF0ZSB0cnVlSG9tZSE6IFVSSTtcblx0cHJpdmF0ZSBpc1dpbmRvd3M6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBiYWRQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVtb3RlQWdlbnRFbnZpcm9ubWVudDogSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfCBudWxsIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNlcGFyYXRvcjogc3RyaW5nID0gJy8nO1xuXHRwcml2YXRlIHJlYWRvbmx5IG9uQnVzeUNoYW5nZUVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cHJpdmF0ZSB1cGRhdGluZ1Byb21pc2U6IENhbmNlbGFibGVQcm9taXNlPGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3Nob3dEb3RGaWxlczogYm9vbGVhbiA9IHRydWU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBwYXRoU2VydmljZTogSVBhdGhTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVtb3RlQXV0aG9yaXR5ID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdHRoaXMuY29udGV4dEtleSA9IFJlbW90ZUZpbGVEaWFsb2dDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zY2hlbWUgPSB0aGlzLnBhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWU7XG5cblx0XHR0aGlzLmdldFNob3dEb3RGaWxlcygpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdyZW1vdGVGaWxlRGlhbG9nLnNob3dEb3RGaWxlcycsIGRpc3Bvc2FibGVTdG9yZSkoYXN5bmMgXyA9PiB7XG5cdFx0XHR0aGlzLmdldFNob3dEb3RGaWxlcygpO1xuXHRcdFx0dGhpcy5zZXRCdXR0b25zKCk7XG5cdFx0XHRjb25zdCBzdGFydGluZ1ZhbHVlID0gdGhpcy5maWxlUGlja0JveC52YWx1ZTtcblx0XHRcdGNvbnN0IGZvbGRlclZhbHVlID0gdGhpcy5wYXRoRnJvbVVyaSh0aGlzLmN1cnJlbnRGb2xkZXIsIHRydWUpO1xuXHRcdFx0dGhpcy5maWxlUGlja0JveC52YWx1ZSA9IGZvbGRlclZhbHVlO1xuXHRcdFx0YXdhaXQgdGhpcy50cnlVcGRhdGVJdGVtcyhmb2xkZXJWYWx1ZSwgdGhpcy5jdXJyZW50Rm9sZGVyLCB0cnVlKTtcblx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWUgPSBzdGFydGluZ1ZhbHVlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRTaG93RG90RmlsZXMoc2hvd0RvdEZpbGVzOiBib29sZWFuKSB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSgncmVtb3RlRmlsZURpYWxvZy5zaG93RG90RmlsZXMnLCBzaG93RG90RmlsZXMsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cblxuXHRwcml2YXRlIGdldFNob3dEb3RGaWxlcygpIHtcblx0XHR0aGlzLl9zaG93RG90RmlsZXMgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oJ3JlbW90ZUZpbGVEaWFsb2cuc2hvd0RvdEZpbGVzJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgdHJ1ZSk7XG5cdH1cblxuXHRzZXQgYnVzeShidXN5OiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuZmlsZVBpY2tCb3guYnVzeSAhPT0gYnVzeSkge1xuXHRcdFx0dGhpcy5maWxlUGlja0JveC5idXN5ID0gYnVzeTtcblx0XHRcdHRoaXMub25CdXN5Q2hhbmdlRW1pdHRlci5maXJlKGJ1c3kpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBidXN5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmZpbGVQaWNrQm94LmJ1c3k7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2hvd09wZW5EaWFsb2cob3B0aW9uczogSU9wZW5EaWFsb2dPcHRpb25zID0ge30pOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRoaXMuc2NoZW1lID0gdGhpcy5nZXRTY2hlbWUob3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcywgb3B0aW9ucy5kZWZhdWx0VXJpKTtcblx0XHR0aGlzLnVzZXJIb21lID0gYXdhaXQgdGhpcy5nZXRVc2VySG9tZSgpO1xuXHRcdHRoaXMudHJ1ZUhvbWUgPSBhd2FpdCB0aGlzLmdldFVzZXJIb21lKHRydWUpO1xuXHRcdGNvbnN0IG5ld09wdGlvbnMgPSB0aGlzLmdldE9wdGlvbnMob3B0aW9ucyk7XG5cdFx0aWYgKCFuZXdPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMub3B0aW9ucyA9IG5ld09wdGlvbnM7XG5cdFx0cmV0dXJuIHRoaXMucGlja1Jlc291cmNlKCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2hvd1NhdmVEaWFsb2cob3B0aW9uczogSVNhdmVEaWFsb2dPcHRpb25zKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLnNjaGVtZSA9IHRoaXMuZ2V0U2NoZW1lKG9wdGlvbnMuYXZhaWxhYmxlRmlsZVN5c3RlbXMsIG9wdGlvbnMuZGVmYXVsdFVyaSk7XG5cdFx0dGhpcy51c2VySG9tZSA9IGF3YWl0IHRoaXMuZ2V0VXNlckhvbWUoKTtcblx0XHR0aGlzLnRydWVIb21lID0gYXdhaXQgdGhpcy5nZXRVc2VySG9tZSh0cnVlKTtcblx0XHR0aGlzLnJlcXVpcmVzVHJhaWxpbmcgPSB0cnVlO1xuXHRcdGNvbnN0IG5ld09wdGlvbnMgPSB0aGlzLmdldE9wdGlvbnMob3B0aW9ucywgdHJ1ZSk7XG5cdFx0aWYgKCFuZXdPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdHRoaXMub3B0aW9ucyA9IG5ld09wdGlvbnM7XG5cdFx0dGhpcy5vcHRpb25zLmNhblNlbGVjdEZvbGRlcnMgPSB0cnVlO1xuXHRcdHRoaXMub3B0aW9ucy5jYW5TZWxlY3RGaWxlcyA9IHRydWU7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuXHRcdFx0dGhpcy5waWNrUmVzb3VyY2UodHJ1ZSkudGhlbihmb2xkZXJVcmkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKGZvbGRlclVyaSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0T3B0aW9ucyhvcHRpb25zOiBJU2F2ZURpYWxvZ09wdGlvbnMgfCBJT3BlbkRpYWxvZ09wdGlvbnMsIGlzU2F2ZTogYm9vbGVhbiA9IGZhbHNlKTogSU9wZW5EaWFsb2dPcHRpb25zIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgZGVmYXVsdFVyaTogVVJJIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBmaWxlbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChvcHRpb25zLmRlZmF1bHRVcmkpIHtcblx0XHRcdGRlZmF1bHRVcmkgPSAodGhpcy5zY2hlbWUgPT09IG9wdGlvbnMuZGVmYXVsdFVyaS5zY2hlbWUpID8gb3B0aW9ucy5kZWZhdWx0VXJpIDogdW5kZWZpbmVkO1xuXHRcdFx0ZmlsZW5hbWUgPSBpc1NhdmUgPyByZXNvdXJjZXMuYmFzZW5hbWUob3B0aW9ucy5kZWZhdWx0VXJpKSA6IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKCFkZWZhdWx0VXJpKSB7XG5cdFx0XHRkZWZhdWx0VXJpID0gdGhpcy51c2VySG9tZTtcblx0XHRcdGlmIChmaWxlbmFtZSkge1xuXHRcdFx0XHRkZWZhdWx0VXJpID0gcmVzb3VyY2VzLmpvaW5QYXRoKGRlZmF1bHRVcmksIGZpbGVuYW1lKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCh0aGlzLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSAmJiAhdGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihkZWZhdWx0VXJpKSkge1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLm5vdENvbm5lY3RlZFRvUmVtb3RlJywgJ0ZpbGUgc3lzdGVtIHByb3ZpZGVyIGZvciB7MH0gaXMgbm90IGF2YWlsYWJsZS4nLCBkZWZhdWx0VXJpLnRvU3RyaW5nKCkpKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IG5ld09wdGlvbnM6IElPcGVuRGlhbG9nT3B0aW9ucyA9IG9iamVjdHMuZGVlcENsb25lKG9wdGlvbnMpO1xuXHRcdG5ld09wdGlvbnMuZGVmYXVsdFVyaSA9IGRlZmF1bHRVcmk7XG5cdFx0cmV0dXJuIG5ld09wdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIHJlbW90ZVVyaUZyb20ocGF0aDogc3RyaW5nLCBoaW50VXJpPzogVVJJKTogVVJJIHtcblx0XHRpZiAoIXBhdGguc3RhcnRzV2l0aCgnXFxcXFxcXFwnKSkge1xuXHRcdFx0cGF0aCA9IHBhdGgucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXHRcdH1cblx0XHRjb25zdCB1cmk6IFVSSSA9IHRoaXMuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgPyBVUkkuZmlsZShwYXRoKSA6IFVSSS5mcm9tKHsgc2NoZW1lOiB0aGlzLnNjaGVtZSwgcGF0aCwgcXVlcnk6IGhpbnRVcmk/LnF1ZXJ5LCBmcmFnbWVudDogaGludFVyaT8uZnJhZ21lbnQgfSk7XG5cdFx0Ly8gSWYgdGhlIGRlZmF1bHQgc2NoZW1lIGlzIGZpbGUsIHRoZW4gd2UgZG9uJ3QgY2FyZSBhYm91dCB0aGUgcmVtb3RlIGF1dGhvcml0eSBvciB0aGUgaGludCBhdXRob3JpdHlcblx0XHRjb25zdCBhdXRob3JpdHkgPSAodXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSA/IHVuZGVmaW5lZCA6ICh0aGlzLnJlbW90ZUF1dGhvcml0eSA/PyBoaW50VXJpPy5hdXRob3JpdHkpO1xuXHRcdHJldHVybiByZXNvdXJjZXMudG9Mb2NhbFJlc291cmNlKHVyaSwgYXV0aG9yaXR5LFxuXHRcdFx0Ly8gSWYgdGhlcmUgaXMgYSByZW1vdGUgYXV0aG9yaXR5LCB0aGVuIHdlIHNob3VsZCB1c2UgdGhlIHN5c3RlbSdzIGRlZmF1bHQgVVJJIGFzIHRoZSBsb2NhbCBzY2hlbWUuXG5cdFx0XHQvLyBJZiB0aGVyZSBpcyAqbm8qIHJlbW90ZSBhdXRob3JpdHksIHRoZW4gd2Ugc2hvdWxkIHVzZSB0aGUgZGVmYXVsdCBzY2hlbWUgZm9yIHRoaXMgZGlhbG9nIGFzIHRoYXQgaXMgYWxyZWFkeSBsb2NhbC5cblx0XHRcdGF1dGhvcml0eSA/IHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSA6IHVyaS5zY2hlbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTY2hlbWUoYXZhaWxhYmxlOiByZWFkb25seSBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgZGVmYXVsdFVyaTogVVJJIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHRpZiAoYXZhaWxhYmxlICYmIGF2YWlsYWJsZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAoZGVmYXVsdFVyaSAmJiAoYXZhaWxhYmxlLmluZGV4T2YoZGVmYXVsdFVyaS5zY2hlbWUpID49IDApKSB7XG5cdFx0XHRcdHJldHVybiBkZWZhdWx0VXJpLnNjaGVtZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhdmFpbGFibGVbMF07XG5cdFx0fSBlbHNlIGlmIChkZWZhdWx0VXJpKSB7XG5cdFx0XHRyZXR1cm4gZGVmYXVsdFVyaS5zY2hlbWU7XG5cdFx0fVxuXHRcdHJldHVybiBTY2hlbWFzLmZpbGU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFJlbW90ZUFnZW50RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUmVtb3RlQWdlbnRFbnZpcm9ubWVudCB8IG51bGw+IHtcblx0XHRpZiAodGhpcy5yZW1vdGVBZ2VudEVudmlyb25tZW50ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMucmVtb3RlQWdlbnRFbnZpcm9ubWVudCA9IGF3YWl0IHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJlbW90ZUFnZW50RW52aXJvbm1lbnQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0VXNlckhvbWUodHJ1ZUhvbWUgPSBmYWxzZSk6IFByb21pc2U8VVJJPiB7XG5cdFx0cmV0dXJuIHRydWVIb21lXG5cdFx0XHQ/IHRoaXMucGF0aFNlcnZpY2UudXNlckhvbWUoeyBwcmVmZXJMb2NhbDogdGhpcy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSB9KVxuXHRcdFx0OiB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnByZWZlcnJlZEhvbWUodGhpcy5zY2hlbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwaWNrUmVzb3VyY2UoaXNTYXZlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRoaXMuYWxsb3dGb2xkZXJTZWxlY3Rpb24gPSAhIXRoaXMub3B0aW9ucy5jYW5TZWxlY3RGb2xkZXJzO1xuXHRcdHRoaXMuYWxsb3dGaWxlU2VsZWN0aW9uID0gISF0aGlzLm9wdGlvbnMuY2FuU2VsZWN0RmlsZXM7XG5cdFx0dGhpcy5zZXBhcmF0b3IgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRTZXBhcmF0b3IodGhpcy5zY2hlbWUsIHRoaXMucmVtb3RlQXV0aG9yaXR5KTtcblx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xuXHRcdHRoaXMuaXNXaW5kb3dzID0gYXdhaXQgdGhpcy5jaGVja0lzV2luZG93c09TKCk7XG5cdFx0bGV0IGhvbWVkaXI6IFVSSSA9IHRoaXMub3B0aW9ucy5kZWZhdWx0VXJpID8gdGhpcy5vcHRpb25zLmRlZmF1bHRVcmkgOiB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF0udXJpO1xuXHRcdGxldCBzdGF0OiBJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGV4dDogc3RyaW5nID0gcmVzb3VyY2VzLmV4dG5hbWUoaG9tZWRpcik7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5kZWZhdWx0VXJpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHRoaXMub3B0aW9ucy5kZWZhdWx0VXJpKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Ly8gVGhlIGZpbGUgb3IgZm9sZGVyIGRvZXNuJ3QgZXhpc3Rcblx0XHRcdH1cblx0XHRcdGlmICghc3RhdCB8fCAhc3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRob21lZGlyID0gcmVzb3VyY2VzLmRpcm5hbWUodGhpcy5vcHRpb25zLmRlZmF1bHRVcmkpO1xuXHRcdFx0XHR0aGlzLnRyYWlsaW5nID0gcmVzb3VyY2VzLmJhc2VuYW1lKHRoaXMub3B0aW9ucy5kZWZhdWx0VXJpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuXHRcdFx0dGhpcy5maWxlUGlja0JveCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPEZpbGVRdWlja1BpY2tJdGVtPigpKTtcblx0XHRcdHRoaXMuYnVzeSA9IHRydWU7XG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94Lm1hdGNoT25MYWJlbCA9IGZhbHNlO1xuXHRcdFx0dGhpcy5maWxlUGlja0JveC5zb3J0QnlMYWJlbCA9IGZhbHNlO1xuXHRcdFx0dGhpcy5maWxlUGlja0JveC5pZ25vcmVGb2N1c091dCA9IHRydWU7XG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94Lm9rID0gdHJ1ZTtcblx0XHRcdHRoaXMuZmlsZVBpY2tCb3gub2tMYWJlbCA9IHR5cGVvZiB0aGlzLm9wdGlvbnMub3BlbkxhYmVsID09PSAnc3RyaW5nJyA/IHRoaXMub3B0aW9ucy5vcGVuTGFiZWwgOiB0aGlzLm9wdGlvbnMub3BlbkxhYmVsPy53aXRob3V0TW5lbW9uaWM7XG5cdFx0XHRpZiAoKHRoaXMuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUpICYmIHRoaXMub3B0aW9ucyAmJiB0aGlzLm9wdGlvbnMuYXZhaWxhYmxlRmlsZVN5c3RlbXMgJiYgKHRoaXMub3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcy5sZW5ndGggPiAxKSAmJiAodGhpcy5vcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zLmluZGV4T2YoU2NoZW1hcy5maWxlKSA+IC0xKSkge1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmN1c3RvbUJ1dHRvbiA9IHRydWU7XG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3guY3VzdG9tTGFiZWwgPSBubHMubG9jYWxpemUoJ3JlbW90ZUZpbGVEaWFsb2cubG9jYWwnLCAnU2hvdyBMb2NhbCcpO1xuXHRcdFx0XHRsZXQgYWN0aW9uO1xuXHRcdFx0XHRpZiAoaXNTYXZlKSB7XG5cdFx0XHRcdFx0YWN0aW9uID0gU2F2ZUxvY2FsRmlsZUNvbW1hbmQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWN0aW9uID0gdGhpcy5hbGxvd0ZpbGVTZWxlY3Rpb24gPyAodGhpcy5hbGxvd0ZvbGRlclNlbGVjdGlvbiA/IE9wZW5Mb2NhbEZpbGVGb2xkZXJDb21tYW5kIDogT3BlbkxvY2FsRmlsZUNvbW1hbmQpIDogT3BlbkxvY2FsRm9sZGVyQ29tbWFuZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBrZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjdGlvbi5JRCk7XG5cdFx0XHRcdGlmIChrZXliaW5kaW5nKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBrZXliaW5kaW5nLmdldExhYmVsKCk7XG5cdFx0XHRcdFx0aWYgKGxhYmVsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmN1c3RvbUhvdmVyID0gZm9ybWF0KCd7MH0gKHsxfSknLCBhY3Rpb24uTEFCRUwsIGxhYmVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy5zZXRCdXR0b25zKCk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVQaWNrQm94Lm9uRGlkVHJpZ2dlckJ1dHRvbihlID0+IHtcblx0XHRcdFx0dGhpcy5zZXRTaG93RG90RmlsZXMoIXRoaXMuX3Nob3dEb3RGaWxlcyk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGxldCBpc1Jlc29sdmluZzogbnVtYmVyID0gMDtcblx0XHRcdGxldCBpc0FjY2VwdEhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuY3VycmVudEZvbGRlciA9IHJlc291cmNlcy5kaXJuYW1lKGhvbWVkaXIpO1xuXHRcdFx0dGhpcy51c2VyRW50ZXJlZFBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHR0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50ID0gJyc7XG5cblx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudGl0bGUgPSB0aGlzLm9wdGlvbnMudGl0bGU7XG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbHVlID0gdGhpcy5wYXRoRnJvbVVyaSh0aGlzLmN1cnJlbnRGb2xkZXIsIHRydWUpO1xuXHRcdFx0dGhpcy5maWxlUGlja0JveC52YWx1ZVNlbGVjdGlvbiA9IFt0aGlzLmZpbGVQaWNrQm94LnZhbHVlLmxlbmd0aCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGhdO1xuXG5cdFx0XHRjb25zdCBkb1Jlc29sdmUgPSAodXJpOiBVUkkgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdHVyaSA9IHJlc291cmNlcy5hZGRUcmFpbGluZ1BhdGhTZXBhcmF0b3IodXJpLCB0aGlzLnNlcGFyYXRvcik7IC8vIEVuc3VyZXMgdGhhdCBjOiBpcyBjOi8gc2luY2UgdGhpcyBjb21lcyBmcm9tIHVzZXIgaW5wdXQgYW5kIGNhbiBiZSBpbmNvcnJlY3QuXG5cdFx0XHRcdFx0Ly8gVG8gYmUgY29uc2lzdGVudCwgd2Ugc2hvdWxkIG5ldmVyIGhhdmUgYSB0cmFpbGluZyBwYXRoIHNlcGFyYXRvciBvbiBkaXJlY3RvcmllcyAob3IgYW55dGhpbmcgZWxzZSkuIFdpbGwgbm90IHJlbW92ZSBmcm9tIGM6Ly5cblx0XHRcdFx0XHR1cmkgPSByZXNvdXJjZXMucmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yKHVyaSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZSh1cmkpO1xuXHRcdFx0XHR0aGlzLmNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVQaWNrQm94Lm9uRGlkQ3VzdG9tKCgpID0+IHtcblx0XHRcdFx0aWYgKGlzQWNjZXB0SGFuZGxlZCB8fCB0aGlzLmJ1c3kpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpc0FjY2VwdEhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0XHRpc1Jlc29sdmluZysrO1xuXHRcdFx0XHRpZiAodGhpcy5vcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zICYmICh0aGlzLm9wdGlvbnMuYXZhaWxhYmxlRmlsZVN5c3RlbXMubGVuZ3RoID4gMSkpIHtcblx0XHRcdFx0XHR0aGlzLm9wdGlvbnMuYXZhaWxhYmxlRmlsZVN5c3RlbXMgPSB0aGlzLm9wdGlvbnMuYXZhaWxhYmxlRmlsZVN5c3RlbXMuc2xpY2UoMSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC5oaWRlKCk7XG5cdFx0XHRcdGlmIChpc1NhdmUpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5maWxlRGlhbG9nU2VydmljZS5zaG93U2F2ZURpYWxvZyh0aGlzLm9wdGlvbnMpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0XHRcdGRvUmVzb2x2ZShyZXN1bHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHRoaXMub3B0aW9ucykudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdFx0ZG9SZXNvbHZlKHJlc3VsdCA/IHJlc3VsdFswXSA6IHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3QgaGFuZGxlQWNjZXB0ID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5idXN5KSB7XG5cdFx0XHRcdFx0Ly8gU2F2ZSB0aGUgYWNjZXB0IHVudGlsIHRoZSBmaWxlIHBpY2tlciBpcyBub3QgYnVzeS5cblx0XHRcdFx0XHR0aGlzLm9uQnVzeUNoYW5nZUVtaXR0ZXIuZXZlbnQoKGJ1c3k6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0XHRcdGlmICghYnVzeSkge1xuXHRcdFx0XHRcdFx0XHRoYW5kbGVBY2NlcHQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNBY2NlcHRIYW5kbGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aXNBY2NlcHRIYW5kbGVkID0gdHJ1ZTtcblx0XHRcdFx0aXNSZXNvbHZpbmcrKztcblx0XHRcdFx0dGhpcy5vbkRpZEFjY2VwdCgpLnRoZW4ocmVzb2x2ZVZhbHVlID0+IHtcblx0XHRcdFx0XHRpZiAocmVzb2x2ZVZhbHVlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmhpZGUoKTtcblx0XHRcdFx0XHRcdGRvUmVzb2x2ZShyZXNvbHZlVmFsdWUpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5oaWRkZW4pIHtcblx0XHRcdFx0XHRcdGRvUmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpc1Jlc29sdmluZy0tO1xuXHRcdFx0XHRcdFx0aXNBY2NlcHRIYW5kbGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVBpY2tCb3gub25EaWRBY2NlcHQoXyA9PiB7XG5cdFx0XHRcdGhhbmRsZUFjY2VwdCgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVQaWNrQm94Lm9uRGlkQ2hhbmdlQWN0aXZlKGkgPT4ge1xuXHRcdFx0XHRpc0FjY2VwdEhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdFx0Ly8gdXBkYXRlIGlucHV0IGJveCB0byBtYXRjaCB0aGUgZmlyc3Qgc2VsZWN0ZWQgaXRlbVxuXHRcdFx0XHRpZiAoKGkubGVuZ3RoID09PSAxKSAmJiB0aGlzLmlzU2VsZWN0aW9uQ2hhbmdlRnJvbVVzZXIoKSkge1xuXHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsaWRhdGlvbk1lc3NhZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Y29uc3QgdXNlclBhdGggPSB0aGlzLmNvbnN0cnVjdEZ1bGxVc2VyUGF0aCgpO1xuXHRcdFx0XHRcdGlmICghZXF1YWxzSWdub3JlQ2FzZSh0aGlzLmZpbGVQaWNrQm94LnZhbHVlLnN1YnN0cmluZygwLCB1c2VyUGF0aC5sZW5ndGgpLCB1c2VyUGF0aCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWVTZWxlY3Rpb24gPSBbMCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGhdO1xuXHRcdFx0XHRcdFx0dGhpcy5pbnNlcnRUZXh0KHVzZXJQYXRoLCB1c2VyUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuc2V0QXV0b0NvbXBsZXRlKHVzZXJQYXRoLCB0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQsIGlbMF0sIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVBpY2tCb3gub25EaWRDaGFuZ2VWYWx1ZShhc3luYyB2YWx1ZSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZVZhbHVlQ2hhbmdlKHZhbHVlKTtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVBpY2tCb3gub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0dGhpcy5oaWRkZW4gPSB0cnVlO1xuXHRcdFx0XHRpZiAoaXNSZXNvbHZpbmcgPT09IDApIHtcblx0XHRcdFx0XHRkb1Jlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94LnNob3coKTtcblx0XHRcdHRoaXMuY29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZUl0ZW1zKGhvbWVkaXIsIHRydWUsIHRoaXMudHJhaWxpbmcpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy50cmFpbGluZykge1xuXHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWVTZWxlY3Rpb24gPSBbdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGggLSB0aGlzLnRyYWlsaW5nLmxlbmd0aCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGggLSBleHQubGVuZ3RoXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbHVlU2VsZWN0aW9uID0gW3RoaXMuZmlsZVBpY2tCb3gudmFsdWUubGVuZ3RoLCB0aGlzLmZpbGVQaWNrQm94LnZhbHVlLmxlbmd0aF07XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5idXN5ID0gZmFsc2U7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlVmFsdWVDaGFuZ2UodmFsdWU6IHN0cmluZykge1xuXHRcdHRyeSB7XG5cdFx0XHQvLyBvbkRpZENoYW5nZVZhbHVlIGNhbiBhbHNvIGJlIHRyaWdnZXJlZCBieSB0aGUgYXV0byBjb21wbGV0ZSwgc28gaWYgaXQgbG9va3MgbGlrZSB0aGUgYXV0byBjb21wbGV0ZSwgZG9uJ3QgZG8gYW55dGhpbmdcblx0XHRcdGlmICh0aGlzLmlzVmFsdWVDaGFuZ2VGcm9tVXNlcigpKSB7XG5cdFx0XHRcdC8vIElmIHRoZSB1c2VyIGhhcyBqdXN0IGVudGVyZWQgbW9yZSBiYWQgcGF0aCwgZG9uJ3QgY2hhbmdlIGFueXRoaW5nXG5cdFx0XHRcdGlmICghZXF1YWxzSWdub3JlQ2FzZSh2YWx1ZSwgdGhpcy5jb25zdHJ1Y3RGdWxsVXNlclBhdGgoKSkgJiYgKCF0aGlzLmlzQmFkU3VicGF0aCh2YWx1ZSkgfHwgdGhpcy5jYW5UaWxkYUVzY2FwZUhhdGNoKHZhbHVlKSkpIHtcblx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVQaWNrQm94VXJpID0gdGhpcy5maWxlUGlja0JveFZhbHVlKCk7XG5cdFx0XHRcdFx0bGV0IHVwZGF0ZWQ6IFVwZGF0ZVJlc3VsdCA9IFVwZGF0ZVJlc3VsdC5Ob3RVcGRhdGVkO1xuXHRcdFx0XHRcdGlmICghcmVzb3VyY2VzLmV4dFVyaUlnbm9yZVBhdGhDYXNlLmlzRXF1YWwodGhpcy5jdXJyZW50Rm9sZGVyLCBmaWxlUGlja0JveFVyaSkpIHtcblx0XHRcdFx0XHRcdHVwZGF0ZWQgPSBhd2FpdCB0aGlzLnRyeVVwZGF0ZUl0ZW1zKHZhbHVlLCBmaWxlUGlja0JveFVyaSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICgodXBkYXRlZCA9PT0gVXBkYXRlUmVzdWx0Lk5vdFVwZGF0ZWQpIHx8ICh1cGRhdGVkID09PSBVcGRhdGVSZXN1bHQuVXBkYXRlZFdpdGhUcmFpbGluZykpIHtcblx0XHRcdFx0XHRcdHRoaXMuc2V0QWN0aXZlSXRlbXModmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zID0gW107XG5cdFx0XHRcdFx0dGhpcy51c2VyRW50ZXJlZFBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIFNpbmNlIGFueSB0ZXh0IGNhbiBiZSBlbnRlcmVkIGluIHRoZSBpbnB1dCBib3gsIHRoZXJlIGlzIHBvdGVudGlhbCBmb3IgZXJyb3IgY2F1c2luZyBpbnB1dC4gSWYgdGhpcyBoYXBwZW5zLCBkbyBub3RoaW5nLlxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2V0QnV0dG9ucygpIHtcblx0XHR0aGlzLmZpbGVQaWNrQm94LmJ1dHRvbnMgPSBbe1xuXHRcdFx0aWNvbkNsYXNzOiB0aGlzLl9zaG93RG90RmlsZXMgPyBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5leWUpIDogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uZXllQ2xvc2VkKSxcblx0XHRcdHRvb2x0aXA6IHRoaXMuX3Nob3dEb3RGaWxlcyA/IG5scy5sb2NhbGl6ZSgncmVtb3RlRmlsZURpYWxvZy5oaWRlRG90RmlsZXMnLCBcIkhpZGUgZG90IGZpbGVzXCIpIDogbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLnNob3dEb3RGaWxlcycsIFwiU2hvdyBkb3QgZmlsZXNcIiksXG5cdFx0XHRhbHdheXNWaXNpYmxlOiB0cnVlXG5cdFx0fV07XG5cdH1cblxuXHRwcml2YXRlIGlzQmFkU3VicGF0aCh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMuYmFkUGF0aCAmJiAodmFsdWUubGVuZ3RoID4gdGhpcy5iYWRQYXRoLmxlbmd0aCkgJiYgZXF1YWxzSWdub3JlQ2FzZSh2YWx1ZS5zdWJzdHJpbmcoMCwgdGhpcy5iYWRQYXRoLmxlbmd0aCksIHRoaXMuYmFkUGF0aCk7XG5cdH1cblxuXHRwcml2YXRlIGlzVmFsdWVDaGFuZ2VGcm9tVXNlcigpOiBib29sZWFuIHtcblx0XHRpZiAoZXF1YWxzSWdub3JlQ2FzZSh0aGlzLmZpbGVQaWNrQm94LnZhbHVlLCB0aGlzLnBhdGhBcHBlbmQodGhpcy5jdXJyZW50Rm9sZGVyLCB0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQgKyB0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50KSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGlzU2VsZWN0aW9uQ2hhbmdlRnJvbVVzZXIoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuYWN0aXZlSXRlbSA9PT0gKHRoaXMuZmlsZVBpY2tCb3guYWN0aXZlSXRlbXMgPyB0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zWzBdIDogdW5kZWZpbmVkKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0RnVsbFVzZXJQYXRoKCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgY3VycmVudEZvbGRlclBhdGggPSB0aGlzLnBhdGhGcm9tVXJpKHRoaXMuY3VycmVudEZvbGRlcik7XG5cdFx0aWYgKGVxdWFsc0lnbm9yZUNhc2UodGhpcy5maWxlUGlja0JveC52YWx1ZS5zdWJzdHIoMCwgdGhpcy51c2VyRW50ZXJlZFBhdGhTZWdtZW50Lmxlbmd0aCksIHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCkpIHtcblx0XHRcdGlmIChlcXVhbHNJZ25vcmVDYXNlKHRoaXMuZmlsZVBpY2tCb3gudmFsdWUuc3Vic3RyKDAsIGN1cnJlbnRGb2xkZXJQYXRoLmxlbmd0aCksIGN1cnJlbnRGb2xkZXJQYXRoKSkge1xuXHRcdFx0XHRyZXR1cm4gY3VycmVudEZvbGRlclBhdGg7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51c2VyRW50ZXJlZFBhdGhTZWdtZW50O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wYXRoQXBwZW5kKHRoaXMuY3VycmVudEZvbGRlciwgdGhpcy51c2VyRW50ZXJlZFBhdGhTZWdtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZpbGVQaWNrQm94VmFsdWUoKTogVVJJIHtcblx0XHQvLyBUaGUgZmlsZSBwaWNrIGJveCBjYW4ndCByZW5kZXIgZXZlcnl0aGluZywgc28gd2UgdXNlIHRoZSBjdXJyZW50IGZvbGRlciB0byBjcmVhdGUgdGhlIHVyaSBzbyB0aGF0IGl0IGlzIGFuIGV4aXN0aW5nIHBhdGguXG5cdFx0Y29uc3QgZGlyZWN0VXJpID0gdGhpcy5yZW1vdGVVcmlGcm9tKHRoaXMuZmlsZVBpY2tCb3gudmFsdWUudHJpbVJpZ2h0KCksIHRoaXMuY3VycmVudEZvbGRlcik7XG5cdFx0Y29uc3QgY3VycmVudFBhdGggPSB0aGlzLnBhdGhGcm9tVXJpKHRoaXMuY3VycmVudEZvbGRlcik7XG5cdFx0aWYgKGVxdWFsc0lnbm9yZUNhc2UodGhpcy5maWxlUGlja0JveC52YWx1ZSwgY3VycmVudFBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jdXJyZW50Rm9sZGVyO1xuXHRcdH1cblx0XHRjb25zdCBjdXJyZW50RGlzcGxheVVyaSA9IHRoaXMucmVtb3RlVXJpRnJvbShjdXJyZW50UGF0aCwgdGhpcy5jdXJyZW50Rm9sZGVyKTtcblx0XHRjb25zdCByZWxhdGl2ZVBhdGggPSByZXNvdXJjZXMucmVsYXRpdmVQYXRoKGN1cnJlbnREaXNwbGF5VXJpLCBkaXJlY3RVcmkpO1xuXHRcdGNvbnN0IGlzU2FtZVJvb3QgPSAodGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGggPiAxICYmIGN1cnJlbnRQYXRoLmxlbmd0aCA+IDEpID8gZXF1YWxzSWdub3JlQ2FzZSh0aGlzLmZpbGVQaWNrQm94LnZhbHVlLnN1YnN0cigwLCAyKSwgY3VycmVudFBhdGguc3Vic3RyKDAsIDIpKSA6IGZhbHNlO1xuXHRcdGlmIChyZWxhdGl2ZVBhdGggJiYgaXNTYW1lUm9vdCkge1xuXHRcdFx0bGV0IHBhdGggPSByZXNvdXJjZXMuam9pblBhdGgodGhpcy5jdXJyZW50Rm9sZGVyLCByZWxhdGl2ZVBhdGgpO1xuXHRcdFx0Y29uc3QgZGlyZWN0QmFzZW5hbWUgPSByZXNvdXJjZXMuYmFzZW5hbWUoZGlyZWN0VXJpKTtcblx0XHRcdGlmICgoZGlyZWN0QmFzZW5hbWUgPT09ICcuJykgfHwgKGRpcmVjdEJhc2VuYW1lID09PSAnLi4nKSkge1xuXHRcdFx0XHRwYXRoID0gdGhpcy5yZW1vdGVVcmlGcm9tKHRoaXMucGF0aEFwcGVuZChwYXRoLCBkaXJlY3RCYXNlbmFtZSksIHRoaXMuY3VycmVudEZvbGRlcik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VzLmhhc1RyYWlsaW5nUGF0aFNlcGFyYXRvcihkaXJlY3RVcmkpID8gcmVzb3VyY2VzLmFkZFRyYWlsaW5nUGF0aFNlcGFyYXRvcihwYXRoKSA6IHBhdGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBkaXJlY3RVcmk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkRpZEFjY2VwdCgpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdHRoaXMuYnVzeSA9IHRydWU7XG5cdFx0aWYgKCF0aGlzLnVwZGF0aW5nUHJvbWlzZSAmJiB0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuZmlsZVBpY2tCb3guc2VsZWN0ZWRJdGVtc1swXTtcblx0XHRcdGlmIChpdGVtLmlzRm9sZGVyKSB7XG5cdFx0XHRcdGlmICh0aGlzLnRyYWlsaW5nKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVJdGVtcyhpdGVtLnVyaSwgdHJ1ZSwgdGhpcy50cmFpbGluZyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gV2hlbiBwb3NzaWJsZSwgY2F1c2UgdGhlIHVwZGF0ZSB0byBoYXBwZW4gYnkgbW9kaWZ5aW5nIHRoZSBpbnB1dCBib3guXG5cdFx0XHRcdFx0Ly8gVGhpcyBhbGxvd3MgYWxsIGlucHV0IGJveCB1cGRhdGVzIHRvIGhhcHBlbiBmaXJzdCwgYW5kIHVzZXMgdGhlIHNhbWUgY29kZSBwYXRoIGFzIHRoZSB1c2VyIHR5cGluZy5cblx0XHRcdFx0XHRjb25zdCBuZXdQYXRoID0gdGhpcy5wYXRoRnJvbVVyaShpdGVtLnVyaSk7XG5cdFx0XHRcdFx0aWYgKHN0YXJ0c1dpdGhJZ25vcmVDYXNlKG5ld1BhdGgsIHRoaXMuZmlsZVBpY2tCb3gudmFsdWUpICYmIChlcXVhbHNJZ25vcmVDYXNlKGl0ZW0ubGFiZWwsIHJlc291cmNlcy5iYXNlbmFtZShpdGVtLnVyaSkpKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5maWxlUGlja0JveC52YWx1ZVNlbGVjdGlvbiA9IFt0aGlzLnBhdGhGcm9tVXJpKHRoaXMuY3VycmVudEZvbGRlcikubGVuZ3RoLCB0aGlzLmZpbGVQaWNrQm94LnZhbHVlLmxlbmd0aF07XG5cdFx0XHRcdFx0XHR0aGlzLmluc2VydFRleHQobmV3UGF0aCwgdGhpcy5iYXNlbmFtZVdpdGhUcmFpbGluZ1NsYXNoKGl0ZW0udXJpKSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICgoaXRlbS5sYWJlbCA9PT0gJy4uJykgJiYgc3RhcnRzV2l0aElnbm9yZUNhc2UodGhpcy5maWxlUGlja0JveC52YWx1ZSwgbmV3UGF0aCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWVTZWxlY3Rpb24gPSBbbmV3UGF0aC5sZW5ndGgsIHRoaXMuZmlsZVBpY2tCb3gudmFsdWUubGVuZ3RoXTtcblx0XHRcdFx0XHRcdHRoaXMuaW5zZXJ0VGV4dChuZXdQYXRoLCAnJyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlSXRlbXMoaXRlbS51cmksIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmJ1c3kgPSBmYWxzZTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoIXRoaXMudXBkYXRpbmdQcm9taXNlKSB7XG5cdFx0XHQvLyBJZiB0aGUgaXRlbXMgaGF2ZSB1cGRhdGVkLCBkb24ndCB0cnkgdG8gcmVzb2x2ZVxuXHRcdFx0aWYgKChhd2FpdCB0aGlzLnRyeVVwZGF0ZUl0ZW1zKHRoaXMuZmlsZVBpY2tCb3gudmFsdWUsIHRoaXMuZmlsZVBpY2tCb3hWYWx1ZSgpKSkgIT09IFVwZGF0ZVJlc3VsdC5Ob3RVcGRhdGVkKSB7XG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3guYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHJlc29sdmVWYWx1ZTogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdC8vIEZpbmQgcmVzb2x2ZSB2YWx1ZVxuXHRcdGlmICh0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmVzb2x2ZVZhbHVlID0gdGhpcy5maWxlUGlja0JveFZhbHVlKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmVzb2x2ZVZhbHVlID0gdGhpcy5maWxlUGlja0JveC5zZWxlY3RlZEl0ZW1zWzBdLnVyaTtcblx0XHR9XG5cdFx0aWYgKHJlc29sdmVWYWx1ZSkge1xuXHRcdFx0cmVzb2x2ZVZhbHVlID0gdGhpcy5hZGRQb3N0Zml4KHJlc29sdmVWYWx1ZSk7XG5cdFx0fVxuXHRcdGlmIChhd2FpdCB0aGlzLnZhbGlkYXRlKHJlc29sdmVWYWx1ZSkpIHtcblx0XHRcdHRoaXMuYnVzeSA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuIHJlc29sdmVWYWx1ZTtcblx0XHR9XG5cdFx0dGhpcy5idXN5ID0gZmFsc2U7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgcm9vdCh2YWx1ZTogVVJJKSB7XG5cdFx0bGV0IGxhc3REaXIgPSB2YWx1ZTtcblx0XHRsZXQgZGlyID0gcmVzb3VyY2VzLmRpcm5hbWUodmFsdWUpO1xuXHRcdHdoaWxlICghcmVzb3VyY2VzLmlzRXF1YWwobGFzdERpciwgZGlyKSkge1xuXHRcdFx0bGFzdERpciA9IGRpcjtcblx0XHRcdGRpciA9IHJlc291cmNlcy5kaXJuYW1lKGRpcik7XG5cdFx0fVxuXHRcdHJldHVybiBkaXI7XG5cdH1cblxuXHRwcml2YXRlIGNhblRpbGRhRXNjYXBlSGF0Y2godmFsdWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhISh2YWx1ZS5lbmRzV2l0aCgnficpICYmIHRoaXMuaXNCYWRTdWJwYXRoKHZhbHVlKSk7XG5cdH1cblxuXHRwcml2YXRlIHRpbGRhUmVwbGFjZSh2YWx1ZTogc3RyaW5nKTogVVJJIHtcblx0XHRjb25zdCBob21lID0gdGhpcy50cnVlSG9tZTtcblx0XHRpZiAoKHZhbHVlLmxlbmd0aCA+IDApICYmICh2YWx1ZVswXSA9PT0gJ34nKSkge1xuXHRcdFx0cmV0dXJuIHJlc291cmNlcy5qb2luUGF0aChob21lLCB2YWx1ZS5zdWJzdHJpbmcoMSkpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5jYW5UaWxkYUVzY2FwZUhhdGNoKHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIGhvbWU7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJlbW90ZVVyaUZyb20odmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB0cnlBZGRUcmFpbGluZ1NlcGFyYXRvclRvRGlyZWN0b3J5KHVyaTogVVJJLCBzdGF0OiBJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhKTogVVJJIHtcblx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0Ly8gQXQgdGhpcyBwb2ludCB3ZSBrbm93IGl0J3MgYSBkaXJlY3RvcnkgYW5kIGNhbiBhZGQgdGhlIHRyYWlsaW5nIHBhdGggc2VwYXJhdG9yXG5cdFx0XHRpZiAoIXRoaXMuZW5kc1dpdGhTbGFzaCh1cmkucGF0aCkpIHtcblx0XHRcdFx0cmV0dXJuIHJlc291cmNlcy5hZGRUcmFpbGluZ1BhdGhTZXBhcmF0b3IodXJpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVyaTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJ5VXBkYXRlSXRlbXModmFsdWU6IHN0cmluZywgdmFsdWVVcmk6IFVSSSwgcmVzZXQ6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8VXBkYXRlUmVzdWx0PiB7XG5cdFx0aWYgKCh2YWx1ZS5sZW5ndGggPiAwKSAmJiAoKHZhbHVlWzBdID09PSAnficpIHx8IHRoaXMuY2FuVGlsZGFFc2NhcGVIYXRjaCh2YWx1ZSkpKSB7XG5cdFx0XHRjb25zdCBuZXdEaXIgPSB0aGlzLnRpbGRhUmVwbGFjZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy51cGRhdGVJdGVtcyhuZXdEaXIsIHRydWUpID8gVXBkYXRlUmVzdWx0LlVwZGF0ZWRXaXRoVHJhaWxpbmcgOiBVcGRhdGVSZXN1bHQuVXBkYXRlZDtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSAnXFxcXCcpIHtcblx0XHRcdHZhbHVlVXJpID0gdGhpcy5yb290KHRoaXMuY3VycmVudEZvbGRlcik7XG5cdFx0XHR2YWx1ZSA9IHRoaXMucGF0aEZyb21VcmkodmFsdWVVcmkpO1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMudXBkYXRlSXRlbXModmFsdWVVcmksIHRydWUpID8gVXBkYXRlUmVzdWx0LlVwZGF0ZWRXaXRoVHJhaWxpbmcgOiBVcGRhdGVSZXN1bHQuVXBkYXRlZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbmV3Rm9sZGVySXNPbGRGb2xkZXIgPSByZXNvdXJjZXMuZXh0VXJpSWdub3JlUGF0aENhc2UuaXNFcXVhbCh0aGlzLmN1cnJlbnRGb2xkZXIsIHZhbHVlVXJpKTtcblx0XHRcdGNvbnN0IG5ld0ZvbGRlcklzU3ViRm9sZGVyID0gcmVzb3VyY2VzLmV4dFVyaUlnbm9yZVBhdGhDYXNlLmlzRXF1YWwodGhpcy5jdXJyZW50Rm9sZGVyLCByZXNvdXJjZXMuZGlybmFtZSh2YWx1ZVVyaSkpO1xuXHRcdFx0Y29uc3QgbmV3Rm9sZGVySXNQYXJlbnQgPSByZXNvdXJjZXMuZXh0VXJpSWdub3JlUGF0aENhc2UuaXNFcXVhbE9yUGFyZW50KHRoaXMuY3VycmVudEZvbGRlciwgcmVzb3VyY2VzLmRpcm5hbWUodmFsdWVVcmkpKTtcblx0XHRcdGNvbnN0IG5ld0ZvbGRlcklzVW5yZWxhdGVkID0gIW5ld0ZvbGRlcklzUGFyZW50ICYmICFuZXdGb2xkZXJJc1N1YkZvbGRlcjtcblx0XHRcdGlmICgoIW5ld0ZvbGRlcklzT2xkRm9sZGVyICYmICh0aGlzLmVuZHNXaXRoU2xhc2godmFsdWUpIHx8IG5ld0ZvbGRlcklzUGFyZW50IHx8IG5ld0ZvbGRlcklzVW5yZWxhdGVkKSkgfHwgcmVzZXQpIHtcblx0XHRcdFx0bGV0IHN0YXQ6IElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0c3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uuc3RhdCh2YWx1ZVVyaSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHQvLyBkbyBub3RoaW5nXG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHN0YXQgJiYgc3RhdC5pc0RpcmVjdG9yeSAmJiAocmVzb3VyY2VzLmJhc2VuYW1lKHZhbHVlVXJpKSAhPT0gJy4nKSAmJiB0aGlzLmVuZHNXaXRoU2xhc2godmFsdWUpKSB7XG5cdFx0XHRcdFx0dmFsdWVVcmkgPSB0aGlzLnRyeUFkZFRyYWlsaW5nU2VwYXJhdG9yVG9EaXJlY3RvcnkodmFsdWVVcmksIHN0YXQpO1xuXHRcdFx0XHRcdHJldHVybiBhd2FpdCB0aGlzLnVwZGF0ZUl0ZW1zKHZhbHVlVXJpKSA/IFVwZGF0ZVJlc3VsdC5VcGRhdGVkV2l0aFRyYWlsaW5nIDogVXBkYXRlUmVzdWx0LlVwZGF0ZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5lbmRzV2l0aFNsYXNoKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIFRoZSBpbnB1dCBib3ggY29udGFpbnMgYSBwYXRoIHRoYXQgZG9lc24ndCBleGlzdCBvbiB0aGUgc3lzdGVtLlxuXHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsaWRhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3JlbW90ZUZpbGVEaWFsb2cuYmFkUGF0aCcsICdUaGUgcGF0aCBkb2VzIG5vdCBleGlzdC4gVXNlIH4gdG8gZ28gdG8geW91ciBob21lIGRpcmVjdG9yeS4nKTtcblx0XHRcdFx0XHQvLyBTYXZlIHRoaXMgYmFkIHBhdGguIEl0IGNhbiB0YWtlIHRvbyBsb25nIHRvIGEgc3RhdCBvbiBldmVyeSB1c2VyIGVudGVyZWQgY2hhcmFjdGVyLCBidXQgb25jZSBhIHVzZXIgZW50ZXJzIGEgYmFkIHBhdGggdGhleSBhcmUgbGlrZWx5XG5cdFx0XHRcdFx0Ly8gdG8ga2VlcCB0eXBpbmcgbW9yZSBiYWQgcGF0aC4gV2UgY2FuIGNvbXBhcmUgYWdhaW5zdCB0aGlzIGJhZCBwYXRoIGFuZCBzZWUgaWYgdGhlIHVzZXIgZW50ZXJlZCBwYXRoIHN0YXJ0cyB3aXRoIGl0LlxuXHRcdFx0XHRcdHRoaXMuYmFkUGF0aCA9IHZhbHVlO1xuXHRcdFx0XHRcdHJldHVybiBVcGRhdGVSZXN1bHQuSW52YWxpZFBhdGg7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGV0IGlucHV0VXJpRGlybmFtZSA9IHJlc291cmNlcy5kaXJuYW1lKHZhbHVlVXJpKTtcblx0XHRcdFx0XHRjb25zdCBjdXJyZW50Rm9sZGVyV2l0aG91dFNlcCA9IHJlc291cmNlcy5yZW1vdmVUcmFpbGluZ1BhdGhTZXBhcmF0b3IocmVzb3VyY2VzLmFkZFRyYWlsaW5nUGF0aFNlcGFyYXRvcih0aGlzLmN1cnJlbnRGb2xkZXIpKTtcblx0XHRcdFx0XHRjb25zdCBpbnB1dFVyaURpcm5hbWVXaXRob3V0U2VwID0gcmVzb3VyY2VzLnJlbW92ZVRyYWlsaW5nUGF0aFNlcGFyYXRvcihyZXNvdXJjZXMuYWRkVHJhaWxpbmdQYXRoU2VwYXJhdG9yKGlucHV0VXJpRGlybmFtZSkpO1xuXHRcdFx0XHRcdGlmICghcmVzb3VyY2VzLmV4dFVyaUlnbm9yZVBhdGhDYXNlLmlzRXF1YWwoY3VycmVudEZvbGRlcldpdGhvdXRTZXAsIGlucHV0VXJpRGlybmFtZVdpdGhvdXRTZXApXG5cdFx0XHRcdFx0XHQmJiAoIS9eW2EtekEtWl06JC8udGVzdCh0aGlzLmZpbGVQaWNrQm94LnZhbHVlKVxuXHRcdFx0XHRcdFx0XHR8fCAhZXF1YWxzSWdub3JlQ2FzZSh0aGlzLnBhdGhGcm9tVXJpKHRoaXMuY3VycmVudEZvbGRlcikuc3Vic3RyaW5nKDAsIHRoaXMuZmlsZVBpY2tCb3gudmFsdWUubGVuZ3RoKSwgdGhpcy5maWxlUGlja0JveC52YWx1ZSkpKSB7XG5cdFx0XHRcdFx0XHRsZXQgc3RhdFdpdGhvdXRUcmFpbGluZzogSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdHN0YXRXaXRob3V0VHJhaWxpbmcgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQoaW5wdXRVcmlEaXJuYW1lKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdFx0Ly8gZG8gbm90aGluZ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHN0YXRXaXRob3V0VHJhaWxpbmcgJiYgc3RhdFdpdGhvdXRUcmFpbGluZy5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmJhZFBhdGggPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdGlucHV0VXJpRGlybmFtZSA9IHRoaXMudHJ5QWRkVHJhaWxpbmdTZXBhcmF0b3JUb0RpcmVjdG9yeShpbnB1dFVyaURpcm5hbWUsIHN0YXRXaXRob3V0VHJhaWxpbmcpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy51cGRhdGVJdGVtcyhpbnB1dFVyaURpcm5hbWUsIGZhbHNlLCByZXNvdXJjZXMuYmFzZW5hbWUodmFsdWVVcmkpKSA/IFVwZGF0ZVJlc3VsdC5VcGRhdGVkV2l0aFRyYWlsaW5nIDogVXBkYXRlUmVzdWx0LlVwZGF0ZWQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuYmFkUGF0aCA9IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gVXBkYXRlUmVzdWx0Lk5vdFVwZGF0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIHRyeVVwZGF0ZVRyYWlsaW5nKHZhbHVlOiBVUkkpIHtcblx0XHRjb25zdCBleHQgPSByZXNvdXJjZXMuZXh0bmFtZSh2YWx1ZSk7XG5cdFx0aWYgKHRoaXMudHJhaWxpbmcgJiYgZXh0KSB7XG5cdFx0XHR0aGlzLnRyYWlsaW5nID0gcmVzb3VyY2VzLmJhc2VuYW1lKHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEFjdGl2ZUl0ZW1zKHZhbHVlOiBzdHJpbmcpIHtcblx0XHR2YWx1ZSA9IHRoaXMucGF0aEZyb21VcmkodGhpcy50aWxkYVJlcGxhY2UodmFsdWUpKTtcblx0XHRjb25zdCBhc1VyaSA9IHRoaXMucmVtb3RlVXJpRnJvbSh2YWx1ZSk7XG5cdFx0Y29uc3QgaW5wdXRCYXNlbmFtZSA9IHJlc291cmNlcy5iYXNlbmFtZShhc1VyaSk7XG5cdFx0Y29uc3QgdXNlclBhdGggPSB0aGlzLmNvbnN0cnVjdEZ1bGxVc2VyUGF0aCgpO1xuXHRcdC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBmb2xkZXIgd2hvc2UgY2hpbGRyZW4gd2UgYXJlIGN1cnJlbnRseSB2aWV3aW5nIG1hdGNoZXMgdGhlIHBhdGggaW4gdGhlIGlucHV0XG5cdFx0Y29uc3QgcGF0aHNFcXVhbCA9IGVxdWFsc0lnbm9yZUNhc2UodXNlclBhdGgsIHZhbHVlLnN1YnN0cmluZygwLCB1c2VyUGF0aC5sZW5ndGgpKSB8fFxuXHRcdFx0ZXF1YWxzSWdub3JlQ2FzZSh2YWx1ZSwgdXNlclBhdGguc3Vic3RyaW5nKDAsIHZhbHVlLmxlbmd0aCkpO1xuXHRcdGlmIChwYXRoc0VxdWFsKSB7XG5cdFx0XHRsZXQgaGFzTWF0Y2ggPSBmYWxzZTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5maWxlUGlja0JveC5pdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gPEZpbGVRdWlja1BpY2tJdGVtPnRoaXMuZmlsZVBpY2tCb3guaXRlbXNbaV07XG5cdFx0XHRcdGlmICh0aGlzLnNldEF1dG9Db21wbGV0ZSh2YWx1ZSwgaW5wdXRCYXNlbmFtZSwgaXRlbSkpIHtcblx0XHRcdFx0XHRoYXNNYXRjaCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghaGFzTWF0Y2gpIHtcblx0XHRcdFx0Y29uc3QgdXNlckJhc2VuYW1lID0gaW5wdXRCYXNlbmFtZS5sZW5ndGggPj0gMiA/IHVzZXJQYXRoLnN1YnN0cmluZyh1c2VyUGF0aC5sZW5ndGggLSBpbnB1dEJhc2VuYW1lLmxlbmd0aCArIDIpIDogJyc7XG5cdFx0XHRcdHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCA9ICh1c2VyQmFzZW5hbWUgPT09IGlucHV0QmFzZW5hbWUpID8gaW5wdXRCYXNlbmFtZSA6ICcnO1xuXHRcdFx0XHR0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3guYWN0aXZlSXRlbXMgPSBbXTtcblx0XHRcdFx0dGhpcy50cnlVcGRhdGVUcmFpbGluZyhhc1VyaSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCA9IGlucHV0QmFzZW5hbWU7XG5cdFx0XHR0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zID0gW107XG5cdFx0XHR0aGlzLnRyeVVwZGF0ZVRyYWlsaW5nKGFzVXJpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldEF1dG9Db21wbGV0ZShzdGFydGluZ1ZhbHVlOiBzdHJpbmcsIHN0YXJ0aW5nQmFzZW5hbWU6IHN0cmluZywgcXVpY2tQaWNrSXRlbTogRmlsZVF1aWNrUGlja0l0ZW0sIGZvcmNlOiBib29sZWFuID0gZmFsc2UpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5idXN5KSB7XG5cdFx0XHQvLyBXZSdyZSBpbiB0aGUgbWlkZGxlIG9mIHNvbWV0aGluZyBlbHNlLiBEb2luZyBhbiBhdXRvIGNvbXBsZXRlIG5vdyBjYW4gcmVzdWx0IGp1bWJsZWQgb3IgaW5jb3JyZWN0IGF1dG9jb21wbGV0ZXMuXG5cdFx0XHR0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQgPSBzdGFydGluZ0Jhc2VuYW1lO1xuXHRcdFx0dGhpcy5hdXRvQ29tcGxldGVQYXRoU2VnbWVudCA9ICcnO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBpdGVtQmFzZW5hbWUgPSBxdWlja1BpY2tJdGVtLmxhYmVsO1xuXHRcdC8vIEVpdGhlciBmb3JjZSB0aGUgYXV0b2NvbXBsZXRlLCBvciB0aGUgb2xkIHZhbHVlIHNob3VsZCBiZSBvbmUgc21hbGxlciB0aGFuIHRoZSBuZXcgdmFsdWUgYW5kIG1hdGNoIHRoZSBuZXcgdmFsdWUuXG5cdFx0aWYgKGl0ZW1CYXNlbmFtZSA9PT0gJy4uJykge1xuXHRcdFx0Ly8gRG9uJ3QgbWF0Y2ggb24gdGhlIHVwIGRpcmVjdG9yeSBpdGVtIGV2ZXIuXG5cdFx0XHR0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQgPSAnJztcblx0XHRcdHRoaXMuYXV0b0NvbXBsZXRlUGF0aFNlZ21lbnQgPSAnJztcblx0XHRcdHRoaXMuYWN0aXZlSXRlbSA9IHF1aWNrUGlja0l0ZW07XG5cdFx0XHRpZiAoZm9yY2UpIHtcblx0XHRcdFx0Ly8gY2xlYXIgYW55IHNlbGVjdGVkIHRleHRcblx0XHRcdFx0Z2V0QWN0aXZlRG9jdW1lbnQoKS5leGVjQ29tbWFuZCgnaW5zZXJ0VGV4dCcsIGZhbHNlLCAnJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBlbHNlIGlmICghZm9yY2UgJiYgKGl0ZW1CYXNlbmFtZS5sZW5ndGggPj0gc3RhcnRpbmdCYXNlbmFtZS5sZW5ndGgpICYmIGVxdWFsc0lnbm9yZUNhc2UoaXRlbUJhc2VuYW1lLnN1YnN0cigwLCBzdGFydGluZ0Jhc2VuYW1lLmxlbmd0aCksIHN0YXJ0aW5nQmFzZW5hbWUpKSB7XG5cdFx0XHR0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQgPSBzdGFydGluZ0Jhc2VuYW1lO1xuXHRcdFx0dGhpcy5hY3RpdmVJdGVtID0gcXVpY2tQaWNrSXRlbTtcblx0XHRcdC8vIENoYW5naW5nIHRoZSBhY3RpdmUgaXRlbXMgd2lsbCB0cmlnZ2VyIHRoZSBvbkRpZEFjdGl2ZUl0ZW1zQ2hhbmdlZC4gQ2xlYXIgdGhlIGF1dG9jb21wbGV0ZSBmaXJzdCwgdGhlbiBzZXQgaXQgYWZ0ZXIuXG5cdFx0XHR0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHRpZiAocXVpY2tQaWNrSXRlbS5pc0ZvbGRlciB8fCAhdGhpcy50cmFpbGluZykge1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LmFjdGl2ZUl0ZW1zID0gW3F1aWNrUGlja0l0ZW1dO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC5hY3RpdmVJdGVtcyA9IFtdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIGlmIChmb3JjZSAmJiAoIWVxdWFsc0lnbm9yZUNhc2UodGhpcy5iYXNlbmFtZVdpdGhUcmFpbGluZ1NsYXNoKHF1aWNrUGlja0l0ZW0udXJpKSwgKHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCArIHRoaXMuYXV0b0NvbXBsZXRlUGF0aFNlZ21lbnQpKSkpIHtcblx0XHRcdHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCA9ICcnO1xuXHRcdFx0aWYgKCF0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpIHtcblx0XHRcdFx0dGhpcy5hdXRvQ29tcGxldGVQYXRoU2VnbWVudCA9IHRoaXMudHJpbVRyYWlsaW5nU2xhc2goaXRlbUJhc2VuYW1lKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuYWN0aXZlSXRlbSA9IHF1aWNrUGlja0l0ZW07XG5cdFx0XHRpZiAoIXRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSkge1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbHVlU2VsZWN0aW9uID0gW3RoaXMucGF0aEZyb21VcmkodGhpcy5jdXJyZW50Rm9sZGVyLCB0cnVlKS5sZW5ndGgsIHRoaXMuZmlsZVBpY2tCb3gudmFsdWUubGVuZ3RoXTtcblx0XHRcdFx0Ly8gdXNlIGluc2VydCB0ZXh0IHRvIHByZXNlcnZlIHVuZG8gYnVmZmVyXG5cdFx0XHRcdHRoaXMuaW5zZXJ0VGV4dCh0aGlzLnBhdGhBcHBlbmQodGhpcy5jdXJyZW50Rm9sZGVyLCB0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50KSwgdGhpcy5hdXRvQ29tcGxldGVQYXRoU2VnbWVudCk7XG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWVTZWxlY3Rpb24gPSBbdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGggLSB0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50Lmxlbmd0aCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGhdO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudXNlckVudGVyZWRQYXRoU2VnbWVudCA9IHN0YXJ0aW5nQmFzZW5hbWU7XG5cdFx0XHR0aGlzLmF1dG9Db21wbGV0ZVBhdGhTZWdtZW50ID0gJyc7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpbnNlcnRUZXh0KHdob2xlVmFsdWU6IHN0cmluZywgaW5zZXJ0VGV4dDogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuZmlsZVBpY2tCb3guaW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHRnZXRBY3RpdmVEb2N1bWVudCgpLmV4ZWNDb21tYW5kKCdpbnNlcnRUZXh0JywgZmFsc2UsIGluc2VydFRleHQpO1xuXHRcdFx0aWYgKHRoaXMuZmlsZVBpY2tCb3gudmFsdWUgIT09IHdob2xlVmFsdWUpIHtcblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC52YWx1ZSA9IHdob2xlVmFsdWU7XG5cdFx0XHRcdHRoaXMuaGFuZGxlVmFsdWVDaGFuZ2Uod2hvbGVWYWx1ZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWUgPSB3aG9sZVZhbHVlO1xuXHRcdFx0dGhpcy5oYW5kbGVWYWx1ZUNoYW5nZSh3aG9sZVZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkZFBvc3RmaXgodXJpOiBVUkkpOiBVUkkge1xuXHRcdGxldCByZXN1bHQgPSB1cmk7XG5cdFx0aWYgKHRoaXMucmVxdWlyZXNUcmFpbGluZyAmJiB0aGlzLm9wdGlvbnMuZmlsdGVycyAmJiB0aGlzLm9wdGlvbnMuZmlsdGVycy5sZW5ndGggPiAwICYmICFyZXNvdXJjZXMuaGFzVHJhaWxpbmdQYXRoU2VwYXJhdG9yKHVyaSkpIHtcblx0XHRcdC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBzdWZmaXggaXMgYWRkZWQuIElmIHRoZSB1c2VyIGRlbGV0ZWQgaXQsIHdlIGF1dG9tYXRpY2FsbHkgYWRkIGl0IGhlcmVcblx0XHRcdGxldCBoYXNFeHQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdGNvbnN0IGN1cnJlbnRFeHQgPSByZXNvdXJjZXMuZXh0bmFtZSh1cmkpLnN1YnN0cigxKTtcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5vcHRpb25zLmZpbHRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPCB0aGlzLm9wdGlvbnMuZmlsdGVyc1tpXS5leHRlbnNpb25zLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKCh0aGlzLm9wdGlvbnMuZmlsdGVyc1tpXS5leHRlbnNpb25zW2pdID09PSAnKicpIHx8ICh0aGlzLm9wdGlvbnMuZmlsdGVyc1tpXS5leHRlbnNpb25zW2pdID09PSBjdXJyZW50RXh0KSkge1xuXHRcdFx0XHRcdFx0aGFzRXh0ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoaGFzRXh0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICghaGFzRXh0KSB7XG5cdFx0XHRcdHJlc3VsdCA9IHJlc291cmNlcy5qb2luUGF0aChyZXNvdXJjZXMuZGlybmFtZSh1cmkpLCByZXNvdXJjZXMuYmFzZW5hbWUodXJpKSArICcuJyArIHRoaXMub3B0aW9ucy5maWx0ZXJzWzBdLmV4dGVuc2lvbnNbMF0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSB0cmltVHJhaWxpbmdTbGFzaChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiAoKHBhdGgubGVuZ3RoID4gMSkgJiYgdGhpcy5lbmRzV2l0aFNsYXNoKHBhdGgpKSA/IHBhdGguc3Vic3RyKDAsIHBhdGgubGVuZ3RoIC0gMSkgOiBwYXRoO1xuXHR9XG5cblx0cHJpdmF0ZSB5ZXNOb1Byb21wdCh1cmk6IFVSSSwgbWVzc2FnZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aW50ZXJmYWNlIFllc05vSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0XHRcdHZhbHVlOiBib29sZWFuO1xuXHRcdH1cblx0XHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcHJvbXB0ID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxZZXNOb0l0ZW0+KCkpO1xuXHRcdHByb21wdC50aXRsZSA9IG1lc3NhZ2U7XG5cdFx0cHJvbXB0Lmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRwcm9tcHQub2sgPSB0cnVlO1xuXHRcdHByb21wdC5jdXN0b21CdXR0b24gPSB0cnVlO1xuXHRcdHByb21wdC5jdXN0b21MYWJlbCA9IG5scy5sb2NhbGl6ZSgncmVtb3RlRmlsZURpYWxvZy5jYW5jZWwnLCAnQ2FuY2VsJyk7XG5cdFx0cHJvbXB0LnZhbHVlID0gdGhpcy5wYXRoRnJvbVVyaSh1cmkpO1xuXG5cdFx0bGV0IGlzUmVzb2x2aW5nID0gZmFsc2U7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZChwcm9tcHQub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRpc1Jlc29sdmluZyA9IHRydWU7XG5cdFx0XHRcdHByb21wdC5oaWRlKCk7XG5cdFx0XHRcdHJlc29sdmUodHJ1ZSk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHByb21wdC5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWlzUmVzb2x2aW5nKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZShmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC5zaG93KCk7XG5cdFx0XHRcdHRoaXMuaGlkZGVuID0gZmFsc2U7XG5cdFx0XHRcdGRpc3Bvc2FibGVTdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHByb21wdC5vbkRpZENoYW5nZVZhbHVlKCgpID0+IHtcblx0XHRcdFx0cHJvbXB0LmhpZGUoKTtcblx0XHRcdH0pKTtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQocHJvbXB0Lm9uRGlkQ3VzdG9tKCgpID0+IHtcblx0XHRcdFx0cHJvbXB0LmhpZGUoKTtcblx0XHRcdH0pKTtcblx0XHRcdHByb21wdC5zaG93KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHZhbGlkYXRlKHVyaTogVVJJIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHVyaSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLmludmFsaWRQYXRoJywgJ1BsZWFzZSBlbnRlciBhIHZhbGlkIHBhdGguJyk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHR9XG5cblx0XHRsZXQgc3RhdDogSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc3RhdERpcm5hbWU6IElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdHN0YXREaXJuYW1lID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHJlc291cmNlcy5kaXJuYW1lKHVyaSkpO1xuXHRcdFx0c3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uuc3RhdCh1cmkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIGRvIG5vdGhpbmdcblx0XHR9XG5cblx0XHRpZiAodGhpcy5yZXF1aXJlc1RyYWlsaW5nKSB7IC8vIHNhdmVcblx0XHRcdGlmIChzdGF0ICYmIHN0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0Ly8gQ2FuJ3QgZG8gdGhpc1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLnZhbGlkYXRlRm9sZGVyJywgJ1RoZSBmb2xkZXIgYWxyZWFkeSBleGlzdHMuIFBsZWFzZSB1c2UgYSBuZXcgZmlsZSBuYW1lLicpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHRcdH0gZWxzZSBpZiAoc3RhdCkge1xuXHRcdFx0XHQvLyBSZXBsYWNpbmcgYSBmaWxlLlxuXHRcdFx0XHQvLyBTaG93IGEgeWVzL25vIHByb21wdFxuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLnZhbGlkYXRlRXhpc3RpbmcnLCAnezB9IGFscmVhZHkgZXhpc3RzLiBBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gb3ZlcndyaXRlIGl0PycsIHJlc291cmNlcy5iYXNlbmFtZSh1cmkpKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMueWVzTm9Qcm9tcHQodXJpLCBtZXNzYWdlKTtcblx0XHRcdH0gZWxzZSBpZiAoIShpc1ZhbGlkQmFzZW5hbWUocmVzb3VyY2VzLmJhc2VuYW1lKHVyaSksIHRoaXMuaXNXaW5kb3dzKSkpIHtcblx0XHRcdFx0Ly8gRmlsZW5hbWUgbm90IGFsbG93ZWRcblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC52YWxpZGF0aW9uTWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncmVtb3RlRmlsZURpYWxvZy52YWxpZGF0ZUJhZEZpbGVuYW1lJywgJ1BsZWFzZSBlbnRlciBhIHZhbGlkIGZpbGUgbmFtZS4nKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0XHR9IGVsc2UgaWYgKCFzdGF0RGlybmFtZSkge1xuXHRcdFx0XHQvLyBGb2xkZXIgdG8gc2F2ZSBpbiBkb2Vzbid0IGV4aXN0XG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3JlbW90ZUZpbGVEaWFsb2cudmFsaWRhdGVDcmVhdGVEaXJlY3RvcnknLCAnVGhlIGZvbGRlciB7MH0gZG9lcyBub3QgZXhpc3QuIFdvdWxkIHlvdSBsaWtlIHRvIGNyZWF0ZSBpdD8nLCByZXNvdXJjZXMuYmFzZW5hbWUocmVzb3VyY2VzLmRpcm5hbWUodXJpKSkpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy55ZXNOb1Byb21wdCh1cmksIG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIGlmICghc3RhdERpcm5hbWUuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC52YWxpZGF0aW9uTWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncmVtb3RlRmlsZURpYWxvZy52YWxpZGF0ZU5vbmV4aXN0ZW50RGlyJywgJ1BsZWFzZSBlbnRlciBhIHBhdGggdGhhdCBleGlzdHMuJyk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXHRcdFx0fSBlbHNlIGlmIChzdGF0RGlybmFtZS5yZWFkb25seSkge1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLnZhbGlkYXRlUmVhZG9ubHlGb2xkZXInLCAnVGhpcyBmb2xkZXIgY2Fubm90IGJlIHVzZWQgYXMgYSBzYXZlIGRlc3RpbmF0aW9uLiBQbGVhc2UgY2hvb3NlIGFub3RoZXIgZm9sZGVyJyk7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7IC8vIG9wZW5cblx0XHRcdGlmICghc3RhdCkge1xuXHRcdFx0XHQvLyBGaWxlIG9yIGZvbGRlciBkb2Vzbid0IGV4aXN0XG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsaWRhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3JlbW90ZUZpbGVEaWFsb2cudmFsaWRhdGVOb25leGlzdGVudERpcicsICdQbGVhc2UgZW50ZXIgYSBwYXRoIHRoYXQgZXhpc3RzLicpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHRcdH0gZWxzZSBpZiAodXJpLnBhdGggPT09ICcvJyAmJiB0aGlzLmlzV2luZG93cykge1xuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLndpbmRvd3NEcml2ZUxldHRlcicsICdQbGVhc2Ugc3RhcnQgdGhlIHBhdGggd2l0aCBhIGRyaXZlIGxldHRlci4nKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0XHR9IGVsc2UgaWYgKHN0YXQuaXNEaXJlY3RvcnkgJiYgIXRoaXMuYWxsb3dGb2xkZXJTZWxlY3Rpb24pIHtcblx0XHRcdFx0Ly8gRm9sZGVyIHNlbGVjdGVkIHdoZW4gZm9sZGVyIHNlbGVjdGlvbiBub3QgcGVybWl0dGVkXG5cdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsaWRhdGlvbk1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ3JlbW90ZUZpbGVEaWFsb2cudmFsaWRhdGVGaWxlT25seScsICdQbGVhc2Ugc2VsZWN0IGEgZmlsZS4nKTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG5cdFx0XHR9IGVsc2UgaWYgKCFzdGF0LmlzRGlyZWN0b3J5ICYmICF0aGlzLmFsbG93RmlsZVNlbGVjdGlvbikge1xuXHRcdFx0XHQvLyBGaWxlIHNlbGVjdGVkIHdoZW4gZmlsZSBzZWxlY3Rpb24gbm90IHBlcm1pdHRlZFxuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbGlkYXRpb25NZXNzYWdlID0gbmxzLmxvY2FsaXplKCdyZW1vdGVGaWxlRGlhbG9nLnZhbGlkYXRlRm9sZGVyT25seScsICdQbGVhc2Ugc2VsZWN0IGEgZm9sZGVyLicpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0fVxuXG5cdC8vIFJldHVybnMgdHJ1ZSBpZiB0aGVyZSBpcyBhIGZpbGUgYXQgdGhlIGVuZCBvZiB0aGUgVVJJLlxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUl0ZW1zKG5ld0ZvbGRlcjogVVJJLCBmb3JjZTogYm9vbGVhbiA9IGZhbHNlLCB0cmFpbGluZz86IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMuYnVzeSA9IHRydWU7XG5cdFx0dGhpcy5hdXRvQ29tcGxldGVQYXRoU2VnbWVudCA9ICcnO1xuXHRcdGNvbnN0IHdhc0RvdERvdCA9IHRyYWlsaW5nID09PSAnLi4nO1xuXHRcdHRyYWlsaW5nID0gd2FzRG90RG90ID8gdW5kZWZpbmVkIDogdHJhaWxpbmc7XG5cdFx0Y29uc3QgaXNTYXZlID0gISF0cmFpbGluZztcblx0XHRsZXQgcmVzdWx0ID0gZmFsc2U7XG5cblx0XHRjb25zdCB1cGRhdGluZ1Byb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShhc3luYyB0b2tlbiA9PiB7XG5cdFx0XHRsZXQgZm9sZGVyU3RhdDogSUZpbGVTdGF0IHwgdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zm9sZGVyU3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZShuZXdGb2xkZXIpO1xuXHRcdFx0XHRpZiAoIWZvbGRlclN0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHR0cmFpbGluZyA9IHJlc291cmNlcy5iYXNlbmFtZShuZXdGb2xkZXIpO1xuXHRcdFx0XHRcdG5ld0ZvbGRlciA9IHJlc291cmNlcy5kaXJuYW1lKG5ld0ZvbGRlcik7XG5cdFx0XHRcdFx0Zm9sZGVyU3RhdCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRyZXN1bHQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIFRoZSBmaWxlL2RpcmVjdG9yeSBkb2Vzbid0IGV4aXN0XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBuZXdWYWx1ZSA9IHRyYWlsaW5nID8gdGhpcy5wYXRoQXBwZW5kKG5ld0ZvbGRlciwgdHJhaWxpbmcpIDogdGhpcy5wYXRoRnJvbVVyaShuZXdGb2xkZXIsIHRydWUpO1xuXHRcdFx0dGhpcy5jdXJyZW50Rm9sZGVyID0gdGhpcy5lbmRzV2l0aFNsYXNoKG5ld0ZvbGRlci5wYXRoKSA/IG5ld0ZvbGRlciA6IHJlc291cmNlcy5hZGRUcmFpbGluZ1BhdGhTZXBhcmF0b3IobmV3Rm9sZGVyLCB0aGlzLnNlcGFyYXRvcik7XG5cdFx0XHR0aGlzLnVzZXJFbnRlcmVkUGF0aFNlZ21lbnQgPSB0cmFpbGluZyA/IHRyYWlsaW5nIDogJyc7XG5cblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZUl0ZW1zKGZvbGRlclN0YXQsIHRoaXMuY3VycmVudEZvbGRlciwgdG9rZW4pLnRoZW4oaXRlbXMgPT4ge1xuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHR0aGlzLmJ1c3kgPSBmYWxzZTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94Lml0ZW1BY3RpdmF0aW9uID0gSXRlbUFjdGl2YXRpb24uTk9ORTtcblx0XHRcdFx0dGhpcy5maWxlUGlja0JveC5pdGVtcyA9IGl0ZW1zO1xuXG5cdFx0XHRcdC8vIHRoZSB1c2VyIG1pZ2h0IGhhdmUgY29udGludWVkIHR5cGluZyB3aGlsZSB3ZSB3ZXJlIHVwZGF0aW5nLiBPbmx5IHVwZGF0ZSB0aGUgaW5wdXQgYm94IGlmIGl0IGRvZXNuJ3QgbWF0Y2ggdGhlIGRpcmVjdG9yeS5cblx0XHRcdFx0aWYgKCFlcXVhbHNJZ25vcmVDYXNlKHRoaXMuZmlsZVBpY2tCb3gudmFsdWUsIG5ld1ZhbHVlKSAmJiAoZm9yY2UgfHwgd2FzRG90RG90KSkge1xuXHRcdFx0XHRcdHRoaXMuZmlsZVBpY2tCb3gudmFsdWVTZWxlY3Rpb24gPSBbMCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGhdO1xuXHRcdFx0XHRcdHRoaXMuaW5zZXJ0VGV4dChuZXdWYWx1ZSwgbmV3VmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChmb3JjZSAmJiB0cmFpbGluZyAmJiBpc1NhdmUpIHtcblx0XHRcdFx0XHQvLyBLZWVwIHRoZSBjdXJzb3IgcG9zaXRpb24gaW4gZnJvbnQgb2YgdGhlIHNhdmUgYXMgbmFtZS5cblx0XHRcdFx0XHR0aGlzLmZpbGVQaWNrQm94LnZhbHVlU2VsZWN0aW9uID0gW3RoaXMuZmlsZVBpY2tCb3gudmFsdWUubGVuZ3RoIC0gdHJhaWxpbmcubGVuZ3RoLCB0aGlzLmZpbGVQaWNrQm94LnZhbHVlLmxlbmd0aCAtIHRyYWlsaW5nLmxlbmd0aF07XG5cdFx0XHRcdH0gZWxzZSBpZiAoIXRyYWlsaW5nKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlcmUgaXMgdHJhaWxpbmcsIHdlIGRvbid0IG1vdmUgdGhlIGN1cnNvci4gSWYgdGhlcmUgaXMgbm8gdHJhaWxpbmcsIGN1cnNvciBnb2VzIGF0IHRoZSBlbmQuXG5cdFx0XHRcdFx0dGhpcy5maWxlUGlja0JveC52YWx1ZVNlbGVjdGlvbiA9IFt0aGlzLmZpbGVQaWNrQm94LnZhbHVlLmxlbmd0aCwgdGhpcy5maWxlUGlja0JveC52YWx1ZS5sZW5ndGhdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLnVwZGF0aW5nUHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0aWYgKHRoaXMudXBkYXRpbmdQcm9taXNlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRpbmdQcm9taXNlLmNhbmNlbCgpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0aW5nUHJvbWlzZSA9IHVwZGF0aW5nUHJvbWlzZTtcblxuXHRcdHJldHVybiB1cGRhdGluZ1Byb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIHBhdGhGcm9tVXJpKHVyaTogVVJJLCBlbmRXaXRoU2VwYXJhdG9yOiBib29sZWFuID0gZmFsc2UpOiBzdHJpbmcge1xuXHRcdGxldCByZXN1bHQ6IHN0cmluZyA9IG5vcm1hbGl6ZURyaXZlTGV0dGVyKHVyaS5mc1BhdGgsIHRoaXMuaXNXaW5kb3dzKS5yZXBsYWNlKC9cXG4vZywgJycpO1xuXHRcdGlmICh0aGlzLnNlcGFyYXRvciA9PT0gJy8nKSB7XG5cdFx0XHRyZXN1bHQgPSByZXN1bHQucmVwbGFjZSgvXFxcXC9nLCB0aGlzLnNlcGFyYXRvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdC5yZXBsYWNlKC9cXC8vZywgdGhpcy5zZXBhcmF0b3IpO1xuXHRcdH1cblx0XHRpZiAoZW5kV2l0aFNlcGFyYXRvciAmJiAhdGhpcy5lbmRzV2l0aFNsYXNoKHJlc3VsdCkpIHtcblx0XHRcdHJlc3VsdCA9IHJlc3VsdCArIHRoaXMuc2VwYXJhdG9yO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBwYXRoQXBwZW5kKHVyaTogVVJJLCBhZGRpdGlvbmFsOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmICgoYWRkaXRpb25hbCA9PT0gJy4uJykgfHwgKGFkZGl0aW9uYWwgPT09ICcuJykpIHtcblx0XHRcdGNvbnN0IGJhc2VQYXRoID0gdGhpcy5wYXRoRnJvbVVyaSh1cmksIHRydWUpO1xuXHRcdFx0cmV0dXJuIGJhc2VQYXRoICsgYWRkaXRpb25hbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMucGF0aEZyb21VcmkocmVzb3VyY2VzLmpvaW5QYXRoKHVyaSwgYWRkaXRpb25hbCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2hlY2tJc1dpbmRvd3NPUygpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRsZXQgaXNXaW5kb3dzT1MgPSBpc1dpbmRvd3M7XG5cdFx0Y29uc3QgZW52ID0gYXdhaXQgdGhpcy5nZXRSZW1vdGVBZ2VudEVudmlyb25tZW50KCk7XG5cdFx0aWYgKGVudikge1xuXHRcdFx0aXNXaW5kb3dzT1MgPSBlbnYub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzO1xuXHRcdH1cblx0XHRyZXR1cm4gaXNXaW5kb3dzT1M7XG5cdH1cblxuXHRwcml2YXRlIGVuZHNXaXRoU2xhc2goczogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIC9bXFwvXFxcXF0kLy50ZXN0KHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBiYXNlbmFtZVdpdGhUcmFpbGluZ1NsYXNoKGZ1bGxQYXRoOiBVUkkpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGNoaWxkID0gdGhpcy5wYXRoRnJvbVVyaShmdWxsUGF0aCwgdHJ1ZSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gdGhpcy5wYXRoRnJvbVVyaShyZXNvdXJjZXMuZGlybmFtZShmdWxsUGF0aCksIHRydWUpO1xuXHRcdHJldHVybiBjaGlsZC5zdWJzdHJpbmcocGFyZW50Lmxlbmd0aCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZUJhY2tJdGVtKGN1cnJGb2xkZXI6IFVSSSk6IFByb21pc2U8RmlsZVF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBmaWxlUmVwcmVzZW50YXRpb25DdXJyID0gdGhpcy5jdXJyZW50Rm9sZGVyLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgYXV0aG9yaXR5OiAnJyB9KTtcblx0XHRjb25zdCBmaWxlUmVwcmVzZW50YXRpb25QYXJlbnQgPSByZXNvdXJjZXMuZGlybmFtZShmaWxlUmVwcmVzZW50YXRpb25DdXJyKTtcblx0XHRpZiAoIXJlc291cmNlcy5pc0VxdWFsKGZpbGVSZXByZXNlbnRhdGlvbkN1cnIsIGZpbGVSZXByZXNlbnRhdGlvblBhcmVudCkpIHtcblx0XHRcdGNvbnN0IHBhcmVudEZvbGRlciA9IHJlc291cmNlcy5kaXJuYW1lKGN1cnJGb2xkZXIpO1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHBhcmVudEZvbGRlcikpIHtcblx0XHRcdFx0cmV0dXJuIHsgbGFiZWw6ICcuLicsIHVyaTogcmVzb3VyY2VzLmFkZFRyYWlsaW5nUGF0aFNlcGFyYXRvcihwYXJlbnRGb2xkZXIsIHRoaXMuc2VwYXJhdG9yKSwgaXNGb2xkZXI6IHRydWUgfTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlSXRlbXMoZm9sZGVyOiBJRmlsZVN0YXQgfCB1bmRlZmluZWQsIGN1cnJlbnRGb2xkZXI6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxGaWxlUXVpY2tQaWNrSXRlbVtdPiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBGaWxlUXVpY2tQaWNrSXRlbVtdID0gW107XG5cblx0XHRjb25zdCBiYWNrRGlyID0gYXdhaXQgdGhpcy5jcmVhdGVCYWNrSXRlbShjdXJyZW50Rm9sZGVyKTtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCFmb2xkZXIpIHtcblx0XHRcdFx0Zm9sZGVyID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKGN1cnJlbnRGb2xkZXIpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZmlsdGVyZWRDaGlsZHJlbiA9IHRoaXMuX3Nob3dEb3RGaWxlcyA/IGZvbGRlci5jaGlsZHJlbiA6IGZvbGRlci5jaGlsZHJlbj8uZmlsdGVyKGNoaWxkID0+ICFjaGlsZC5uYW1lLnN0YXJ0c1dpdGgoJy4nKSk7XG5cdFx0XHRjb25zdCBpdGVtcyA9IGZpbHRlcmVkQ2hpbGRyZW4gPyBhd2FpdCBQcm9taXNlLmFsbChmaWx0ZXJlZENoaWxkcmVuLm1hcChjaGlsZCA9PiB0aGlzLmNyZWF0ZUl0ZW0oY2hpbGQsIGN1cnJlbnRGb2xkZXIsIHRva2VuKSkpIDogW107XG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdFx0aWYgKGl0ZW0pIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChpdGVtKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0Y29uc29sZS5sb2coZSk7XG5cdFx0fVxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBzb3J0ZWQgPSByZXN1bHQuc29ydCgoaTEsIGkyKSA9PiB7XG5cdFx0XHRpZiAoaTEuaXNGb2xkZXIgIT09IGkyLmlzRm9sZGVyKSB7XG5cdFx0XHRcdHJldHVybiBpMS5pc0ZvbGRlciA/IC0xIDogMTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHRyaW1tZWQxID0gdGhpcy5lbmRzV2l0aFNsYXNoKGkxLmxhYmVsKSA/IGkxLmxhYmVsLnN1YnN0cigwLCBpMS5sYWJlbC5sZW5ndGggLSAxKSA6IGkxLmxhYmVsO1xuXHRcdFx0Y29uc3QgdHJpbW1lZDIgPSB0aGlzLmVuZHNXaXRoU2xhc2goaTIubGFiZWwpID8gaTIubGFiZWwuc3Vic3RyKDAsIGkyLmxhYmVsLmxlbmd0aCAtIDEpIDogaTIubGFiZWw7XG5cdFx0XHRyZXR1cm4gdHJpbW1lZDEubG9jYWxlQ29tcGFyZSh0cmltbWVkMik7XG5cdFx0fSk7XG5cblx0XHRpZiAoYmFja0Rpcikge1xuXHRcdFx0c29ydGVkLnVuc2hpZnQoYmFja0Rpcik7XG5cdFx0fVxuXHRcdHJldHVybiBzb3J0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckZpbGUoZmlsZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5maWx0ZXJzKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMub3B0aW9ucy5maWx0ZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGZvciAobGV0IGogPSAwOyBqIDwgdGhpcy5vcHRpb25zLmZpbHRlcnNbaV0uZXh0ZW5zaW9ucy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdGNvbnN0IHRlc3RFeHQgPSB0aGlzLm9wdGlvbnMuZmlsdGVyc1tpXS5leHRlbnNpb25zW2pdO1xuXHRcdFx0XHRcdGlmICgodGVzdEV4dCA9PT0gJyonKSB8fCAoZmlsZS5wYXRoLmVuZHNXaXRoKCcuJyArIHRlc3RFeHQpKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVJdGVtKHN0YXQ6IElGaWxlU3RhdCwgcGFyZW50OiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8RmlsZVF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGxldCBmdWxsUGF0aCA9IHJlc291cmNlcy5qb2luUGF0aChwYXJlbnQsIHN0YXQubmFtZSk7XG5cdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdGNvbnN0IGZpbGVuYW1lID0gcmVzb3VyY2VzLmJhc2VuYW1lKGZ1bGxQYXRoKTtcblx0XHRcdGZ1bGxQYXRoID0gcmVzb3VyY2VzLmFkZFRyYWlsaW5nUGF0aFNlcGFyYXRvcihmdWxsUGF0aCwgdGhpcy5zZXBhcmF0b3IpO1xuXHRcdFx0cmV0dXJuIHsgbGFiZWw6IGZpbGVuYW1lLCB1cmk6IGZ1bGxQYXRoLCBpc0ZvbGRlcjogdHJ1ZSwgaWNvbkNsYXNzZXM6IGdldEljb25DbGFzc2VzKHRoaXMubW9kZWxTZXJ2aWNlLCB0aGlzLmxhbmd1YWdlU2VydmljZSwgZnVsbFBhdGggfHwgdW5kZWZpbmVkLCBGaWxlS2luZC5GT0xERVIpIH07XG5cdFx0fSBlbHNlIGlmICghc3RhdC5pc0RpcmVjdG9yeSAmJiB0aGlzLmFsbG93RmlsZVNlbGVjdGlvbiAmJiB0aGlzLmZpbHRlckZpbGUoZnVsbFBhdGgpKSB7XG5cdFx0XHRyZXR1cm4geyBsYWJlbDogc3RhdC5uYW1lLCB1cmk6IGZ1bGxQYXRoLCBpc0ZvbGRlcjogZmFsc2UsIGljb25DbGFzc2VzOiBnZXRJY29uQ2xhc3Nlcyh0aGlzLm1vZGVsU2VydmljZSwgdGhpcy5sYW5ndWFnZVNlcnZpY2UsIGZ1bGxQYXRoIHx8IHVuZGVmaW5lZCkgfTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxlQUFlO0FBQzNCLFlBQVksYUFBYTtBQUN6QixTQUFTLGNBQXlCLGdCQUE4QztBQUNoRixTQUFTLG9CQUFnRCxzQkFBc0I7QUFDL0UsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsV0FBVyx1QkFBdUI7QUFDM0MsU0FBaUQsMEJBQTBCO0FBQzNFLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFpQyxxQkFBcUI7QUFDL0QsU0FBUyxrQkFBa0IsUUFBUSw0QkFBNEI7QUFDL0QsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSx1QkFBb0M7QUFDekQsU0FBUywrQkFBa0Q7QUFHM0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBRXRELElBQVU7QUFBQSxDQUFWLENB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QUNsQyxhQUFPO0FBQUEsSUFDUjtBQUNBLFFBQUksV0FBVyxVQUFVLFNBQVMsUUFBUSxLQUFLLElBQUk7QUFDbkQsUUFBSSxLQUFLLGFBQWE7QUFDckIsWUFBTSxXQUFXLFVBQVUsU0FBUyxRQUFRO0FBQzVDLGlCQUFXLFVBQVUseUJBQXlCLFVBQVUsS0FBSyxTQUFTO0FBQ3RFLGFBQU8sRUFBRSxPQUFPLFVBQVUsS0FBSyxVQUFVLFVBQVUsTUFBTSxhQUFhLGVBQWUsS0FBSyxjQUFjLEtBQUssaUJBQWlCLFlBQVksUUFBVyxTQUFTLE1BQU0sRUFBRTtBQUFBLElBQ3ZLLFdBQVcsQ0FBQyxLQUFLLGVBQWUsS0FBSyxzQkFBc0IsS0FBSyxXQUFXLFFBQVEsR0FBRztBQUNyRixhQUFPLEVBQUUsT0FBTyxLQUFLLE1BQU0sS0FBSyxVQUFVLFVBQVUsT0FBTyxhQUFhLGVBQWUsS0FBSyxjQUFjLEtBQUssaUJBQWlCLFlBQVksTUFBUyxFQUFFO0FBQUEsSUFDeEo7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBLzhCYSxtQkFBTjtBQUFBLEVBMkJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXpDVTsiLAogICJuYW1lcyI6IFsiT3BlbkxvY2FsRmlsZUNvbW1hbmQiLCAiU2F2ZUxvY2FsRmlsZUNvbW1hbmQiLCAiT3BlbkxvY2FsRm9sZGVyQ29tbWFuZCIsICJPcGVuTG9jYWxGaWxlRm9sZGVyQ29tbWFuZCIsICJVcGRhdGVSZXN1bHQiXQp9Cg==
