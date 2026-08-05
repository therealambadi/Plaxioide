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
import { app } from "electron";
import { coalesce } from "../../../base/common/arrays.js";
import { ThrottledDelayer } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { normalizeDriveLetter, splitRecentLabel } from "../../../base/common/labels.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { isMacintosh, isWindows } from "../../../base/common/platform.js";
import { basename, extUriBiasedIgnorePathCase, originalFSPath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { Promises } from "../../../base/node/pfs.js";
import { localize } from "../../../nls.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILifecycleMainService, LifecycleMainPhase } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import { StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { IApplicationStorageMainService } from "../../storage/electron-main/storageMainService.js";
import { isRecentFile, isRecentFolder, isRecentWorkspace, restoreRecentlyOpened, toStoreData } from "../common/workspaces.js";
import { WORKSPACE_EXTENSION } from "../../workspace/common/workspace.js";
import { IWorkspacesManagementMainService } from "./workspacesManagementMainService.js";
import { ResourceMap } from "../../../base/common/map.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
const IWorkspacesHistoryMainService = createDecorator("workspacesHistoryMainService");
let WorkspacesHistoryMainService = class extends Disposable {
  constructor(logService, workspacesManagementMainService, lifecycleMainService, applicationStorageMainService, dialogMainService) {
    super();
    this.logService = logService;
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.applicationStorageMainService = applicationStorageMainService;
    this.dialogMainService = dialogMainService;
    this._onDidChangeRecentlyOpened = this._register(new Emitter());
    this.onDidChangeRecentlyOpened = this._onDidChangeRecentlyOpened.event;
    this.macOSRecentDocumentsUpdater = this._register(new ThrottledDelayer(800));
    this.registerListeners();
  }
  registerListeners() {
    this.lifecycleMainService.when(LifecycleMainPhase.Eventually).then(() => this.handleWindowsJumpList());
    this._register(this.workspacesManagementMainService.onDidEnterWorkspace((event) => this.addRecentlyOpened([{ workspace: event.workspace, remoteAuthority: event.window.remoteAuthority }])));
  }
  //#region Workspaces History
  async addRecentlyOpened(recentToAdd) {
    let workspaces = [];
    let files = [];
    for (const recent of recentToAdd) {
      if (isRecentWorkspace(recent)) {
        if (!this.workspacesManagementMainService.isUntitledWorkspace(recent.workspace) && !this.containsWorkspace(workspaces, recent.workspace)) {
          workspaces.push(recent);
        }
      } else if (isRecentFolder(recent)) {
        if (!this.containsFolder(workspaces, recent.folderUri)) {
          workspaces.push(recent);
        }
      } else {
        const alreadyExistsInHistory = this.containsFile(files, recent.fileUri);
        const shouldBeFiltered = recent.fileUri.scheme === Schemas.file && WorkspacesHistoryMainService.COMMON_FILES_FILTER.indexOf(basename(recent.fileUri)) >= 0;
        if (!alreadyExistsInHistory && !shouldBeFiltered) {
          files.push(recent);
          if (isWindows && recent.fileUri.scheme === Schemas.file) {
            app.addRecentDocument(recent.fileUri.fsPath);
          }
        }
      }
    }
    const mergedEntries = await this.mergeEntriesFromStorage({ workspaces, files });
    workspaces = mergedEntries.workspaces;
    files = mergedEntries.files;
    if (workspaces.length > WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES) {
      workspaces.length = WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES;
    }
    if (files.length > WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES) {
      files.length = WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES;
    }
    await this.saveRecentlyOpened({ workspaces, files });
    this._onDidChangeRecentlyOpened.fire();
    if (isMacintosh) {
      this.macOSRecentDocumentsUpdater.trigger(() => this.updateMacOSRecentDocuments());
    }
  }
  async removeRecentlyOpened(recentToRemove) {
    const keep = (recent) => {
      const uri = this.location(recent);
      for (const resourceToRemove of recentToRemove) {
        if (extUriBiasedIgnorePathCase.isEqual(resourceToRemove, uri)) {
          return false;
        }
      }
      return true;
    };
    const mru = await this.getRecentlyOpened();
    const workspaces = mru.workspaces.filter(keep);
    const files = mru.files.filter(keep);
    if (workspaces.length !== mru.workspaces.length || files.length !== mru.files.length) {
      await this.saveRecentlyOpened({ files, workspaces });
      this._onDidChangeRecentlyOpened.fire();
      if (isMacintosh) {
        this.macOSRecentDocumentsUpdater.trigger(() => this.updateMacOSRecentDocuments());
      }
    }
  }
  async clearRecentlyOpened(options) {
    if (options?.confirm) {
      const { response } = await this.dialogMainService.showMessageBox({
        type: "warning",
        buttons: [
          localize({ key: "clearButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Clear"),
          localize({ key: "cancel", comment: ["&& denotes a mnemonic"] }, "&&Cancel")
        ],
        message: localize("confirmClearRecentsMessage", "Do you want to clear all recently opened files and workspaces?"),
        detail: localize("confirmClearDetail", "This action is irreversible!"),
        cancelId: 1
      });
      if (response !== 0) {
        return;
      }
    }
    await this.saveRecentlyOpened({ workspaces: [], files: [] });
    app.clearRecentDocuments();
    this._onDidChangeRecentlyOpened.fire();
  }
  async getRecentlyOpened() {
    return this.mergeEntriesFromStorage();
  }
  async mergeEntriesFromStorage(existingEntries) {
    const mapWorkspaceIdToWorkspace = new ResourceMap((uri) => extUriBiasedIgnorePathCase.getComparisonKey(uri));
    if (existingEntries?.workspaces) {
      for (const workspace of existingEntries.workspaces) {
        mapWorkspaceIdToWorkspace.set(this.location(workspace), workspace);
      }
    }
    const mapFileIdToFile = new ResourceMap((uri) => extUriBiasedIgnorePathCase.getComparisonKey(uri));
    if (existingEntries?.files) {
      for (const file of existingEntries.files) {
        mapFileIdToFile.set(this.location(file), file);
      }
    }
    const recentFromStorage = await this.getRecentlyOpenedFromStorage();
    for (const recentWorkspaceFromStorage of recentFromStorage.workspaces) {
      const existingRecentWorkspace = mapWorkspaceIdToWorkspace.get(this.location(recentWorkspaceFromStorage));
      if (existingRecentWorkspace) {
        existingRecentWorkspace.label = existingRecentWorkspace.label ?? recentWorkspaceFromStorage.label;
      } else {
        mapWorkspaceIdToWorkspace.set(this.location(recentWorkspaceFromStorage), recentWorkspaceFromStorage);
      }
    }
    for (const recentFileFromStorage of recentFromStorage.files) {
      const existingRecentFile = mapFileIdToFile.get(this.location(recentFileFromStorage));
      if (existingRecentFile) {
        existingRecentFile.label = existingRecentFile.label ?? recentFileFromStorage.label;
      } else {
        mapFileIdToFile.set(this.location(recentFileFromStorage), recentFileFromStorage);
      }
    }
    return {
      workspaces: [...mapWorkspaceIdToWorkspace.values()],
      files: [...mapFileIdToFile.values()]
    };
  }
  async getRecentlyOpenedFromStorage() {
    await this.applicationStorageMainService.whenReady;
    let storedRecentlyOpened = void 0;
    const storedRecentlyOpenedRaw = this.applicationStorageMainService.get(WorkspacesHistoryMainService.RECENTLY_OPENED_STORAGE_KEY, StorageScope.APPLICATION);
    if (typeof storedRecentlyOpenedRaw === "string") {
      try {
        storedRecentlyOpened = JSON.parse(storedRecentlyOpenedRaw);
      } catch (error) {
        this.logService.error("Unexpected error parsing opened paths list", error);
      }
    }
    return restoreRecentlyOpened(storedRecentlyOpened, this.logService);
  }
  async saveRecentlyOpened(recent) {
    await this.applicationStorageMainService.whenReady;
    this.applicationStorageMainService.store(WorkspacesHistoryMainService.RECENTLY_OPENED_STORAGE_KEY, JSON.stringify(toStoreData(recent)), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  location(recent) {
    if (isRecentFolder(recent)) {
      return recent.folderUri;
    }
    if (isRecentFile(recent)) {
      return recent.fileUri;
    }
    return recent.workspace.configPath;
  }
  containsWorkspace(recents, candidate) {
    return !!recents.find((recent) => isRecentWorkspace(recent) && recent.workspace.id === candidate.id);
  }
  containsFolder(recents, candidate) {
    return !!recents.find((recent) => isRecentFolder(recent) && extUriBiasedIgnorePathCase.isEqual(recent.folderUri, candidate));
  }
  containsFile(recents, candidate) {
    return !!recents.find((recent) => extUriBiasedIgnorePathCase.isEqual(recent.fileUri, candidate));
  }
  async handleWindowsJumpList() {
    if (!isWindows) {
      return;
    }
    await this.updateWindowsJumpList();
    this._register(this.onDidChangeRecentlyOpened(() => this.updateWindowsJumpList()));
  }
  async updateWindowsJumpList() {
    if (!isWindows) {
      return;
    }
    const jumpList = [];
    jumpList.push({
      type: "tasks",
      items: [
        {
          type: "task",
          title: localize("newWindow", "New Window"),
          description: localize("newWindowDesc", "Opens a new window"),
          program: process.execPath,
          args: "-n",
          // force new window
          iconPath: process.execPath,
          iconIndex: 0
        }
      ]
    });
    if ((await this.getRecentlyOpened()).workspaces.length > 0) {
      const toRemove = [];
      for (const item of app.getJumpListSettings().removedItems) {
        const args = item.args;
        if (args) {
          const match = /^--(folder|file)-uri\s+"([^"]+)"$/.exec(args);
          if (match) {
            toRemove.push(URI.parse(match[2]));
          }
        }
      }
      await this.removeRecentlyOpened(toRemove);
      let hasWorkspaces = false;
      const items = coalesce((await this.getRecentlyOpened()).workspaces.slice(0, WorkspacesHistoryMainService.MAX_WINDOWS_JUMP_LIST_ENTRIES).map((recent) => {
        const workspace = isRecentWorkspace(recent) ? recent.workspace : recent.folderUri;
        const { title, description } = this.getWindowsJumpListLabel(workspace, recent.label);
        let args;
        if (URI.isUri(workspace)) {
          args = `--folder-uri "${workspace.toString()}"`;
        } else {
          hasWorkspaces = true;
          args = `--file-uri "${workspace.configPath.toString()}"`;
        }
        return {
          type: "task",
          title: title.substr(0, 255),
          // Windows seems to be picky around the length of entries
          description: description.substr(0, 255),
          // (see https://github.com/microsoft/vscode/issues/111177)
          program: process.execPath,
          args,
          iconPath: "explorer.exe",
          // simulate folder icon
          iconIndex: 0
        };
      }));
      if (items.length > 0) {
        jumpList.push({
          type: "custom",
          name: hasWorkspaces ? localize("recentFoldersAndWorkspaces", "Recent Folders & Workspaces") : localize("recentFolders", "Recent Folders"),
          items
        });
      }
    }
    jumpList.push({
      type: "recent"
      // this enables to show files in the "recent" category
    });
    try {
      const res = app.setJumpList(jumpList);
      if (res && res !== "ok") {
        this.logService.warn(`updateWindowsJumpList#setJumpList unexpected result: ${res}`);
      }
    } catch (error) {
      this.logService.warn("updateWindowsJumpList#setJumpList", error);
    }
  }
  getWindowsJumpListLabel(workspace, recentLabel) {
    if (recentLabel) {
      return { title: splitRecentLabel(recentLabel).name, description: recentLabel };
    }
    if (URI.isUri(workspace)) {
      return { title: basename(workspace), description: this.renderJumpListPathDescription(workspace) };
    }
    if (this.workspacesManagementMainService.isUntitledWorkspace(workspace)) {
      return { title: localize("untitledWorkspace", "Untitled (Workspace)"), description: "" };
    }
    let filename = basename(workspace.configPath);
    if (filename.endsWith(WORKSPACE_EXTENSION)) {
      filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
    }
    return { title: localize("workspaceName", "{0} (Workspace)", filename), description: this.renderJumpListPathDescription(workspace.configPath) };
  }
  renderJumpListPathDescription(uri) {
    return uri.scheme === "file" ? normalizeDriveLetter(uri.fsPath) : uri.toString();
  }
  async updateMacOSRecentDocuments() {
    if (!isMacintosh) {
      return;
    }
    app.clearRecentDocuments();
    const mru = await this.getRecentlyOpened();
    const workspaceEntries = [];
    let entries = 0;
    for (let i = 0; i < mru.workspaces.length && entries < WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_WORKSPACES; i++) {
      const loc = this.location(mru.workspaces[i]);
      if (loc.scheme === Schemas.file) {
        const workspacePath = originalFSPath(loc);
        if (await Promises.exists(workspacePath)) {
          workspaceEntries.push(workspacePath);
          entries++;
        }
      }
    }
    const fileEntries = [];
    for (let i = 0; i < mru.files.length && entries < WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_ENTRIES_TOTAL; i++) {
      const loc = this.location(mru.files[i]);
      if (loc.scheme === Schemas.file) {
        const filePath = originalFSPath(loc);
        if (WorkspacesHistoryMainService.COMMON_FILES_FILTER.includes(basename(loc)) || // skip some well known file entries
        workspaceEntries.includes(filePath)) {
          continue;
        }
        if (await Promises.exists(filePath)) {
          fileEntries.push(filePath);
          entries++;
        }
      }
    }
    fileEntries.reverse().forEach((fileEntry) => app.addRecentDocument(fileEntry));
    workspaceEntries.reverse().forEach((workspaceEntry) => app.addRecentDocument(workspaceEntry));
  }
  //#endregion
};
WorkspacesHistoryMainService.MAX_TOTAL_RECENT_ENTRIES = 500;
WorkspacesHistoryMainService.RECENTLY_OPENED_STORAGE_KEY = "history.recentlyOpenedPathsList";
//#endregion
//#region macOS Dock / Windows JumpList
WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_WORKSPACES = 7;
// prefer higher number of workspaces...
WorkspacesHistoryMainService.MAX_MACOS_DOCK_RECENT_ENTRIES_TOTAL = 10;
// ...over number of files
WorkspacesHistoryMainService.MAX_WINDOWS_JUMP_LIST_ENTRIES = 7;
// Exclude some very common files from the dock/taskbar
WorkspacesHistoryMainService.COMMON_FILES_FILTER = [
  "COMMIT_EDITMSG",
  "MERGE_MSG",
  "git-rebase-todo"
];
WorkspacesHistoryMainService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IWorkspacesManagementMainService),
  __decorateParam(2, ILifecycleMainService),
  __decorateParam(3, IApplicationStorageMainService),
  __decorateParam(4, IDialogMainService)
], WorkspacesHistoryMainService);
export {
  IWorkspacesHistoryMainService,
  WorkspacesHistoryMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93b3Jrc3BhY2VzL2VsZWN0cm9uLW1haW4vd29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGFwcCwgSnVtcExpc3RDYXRlZ29yeSwgSnVtcExpc3RJdGVtIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgVGhyb3R0bGVkRGVsYXllciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IGFzIENvbW1vbkV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRHJpdmVMZXR0ZXIsIHNwbGl0UmVjZW50TGFiZWwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLCBvcmlnaW5hbEZTUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZU1haW5TZXJ2aWNlLCBMaWZlY3ljbGVNYWluUGhhc2UgfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvZWxlY3Ryb24tbWFpbi9saWZlY3ljbGVNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9lbGVjdHJvbi1tYWluL3N0b3JhZ2VNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVjZW50LCBJUmVjZW50RmlsZSwgSVJlY2VudEZvbGRlciwgSVJlY2VudGx5T3BlbmVkLCBJUmVjZW50V29ya3NwYWNlLCBpc1JlY2VudEZpbGUsIGlzUmVjZW50Rm9sZGVyLCBpc1JlY2VudFdvcmtzcGFjZSwgcmVzdG9yZVJlY2VudGx5T3BlbmVkLCB0b1N0b3JlRGF0YSB9IGZyb20gJy4uL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VJZGVudGlmaWVyLCBXT1JLU1BBQ0VfRVhURU5TSU9OIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UgfSBmcm9tICcuL3dvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgSURpYWxvZ01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGlhbG9ncy9lbGVjdHJvbi1tYWluL2RpYWxvZ01haW5TZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlPignd29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZWNlbnRseU9wZW5lZDogQ29tbW9uRXZlbnQ8dm9pZD47XG5cblx0YWRkUmVjZW50bHlPcGVuZWQocmVjZW50czogSVJlY2VudFtdKTogUHJvbWlzZTx2b2lkPjtcblx0Z2V0UmVjZW50bHlPcGVuZWQoKTogUHJvbWlzZTxJUmVjZW50bHlPcGVuZWQ+O1xuXHRyZW1vdmVSZWNlbnRseU9wZW5lZChwYXRoczogVVJJW10pOiBQcm9taXNlPHZvaWQ+O1xuXHRjbGVhclJlY2VudGx5T3BlbmVkKG9wdGlvbnM/OiB7IGNvbmZpcm0/OiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUFYX1RPVEFMX1JFQ0VOVF9FTlRSSUVTID0gNTAwO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJFQ0VOVExZX09QRU5FRF9TVE9SQUdFX0tFWSA9ICdoaXN0b3J5LnJlY2VudGx5T3BlbmVkUGF0aHNMaXN0JztcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVjZW50bHlPcGVuZWQgPSB0aGlzLl9vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2U6IElXb3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsaWZlY3ljbGVNYWluU2VydmljZTogSUxpZmVjeWNsZU1haW5TZXJ2aWNlLFxuXHRcdEBJQXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZTogSUFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlLFxuXHRcdEBJRGlhbG9nTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dNYWluU2VydmljZTogSURpYWxvZ01haW5TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gSW5zdGFsbCB3aW5kb3cganVtcCBsaXN0IGRlbGF5ZWQgYWZ0ZXIgb3BlbmluZyB3aW5kb3dcblx0XHQvLyBiZWNhdXNlIHBlcmYgbWVhc3VyZW1lbnRzIGhhdmUgc2hvd24gdGhpcyB0byBiZSBzbG93XG5cdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS53aGVuKExpZmVjeWNsZU1haW5QaGFzZS5FdmVudHVhbGx5KS50aGVuKCgpID0+IHRoaXMuaGFuZGxlV2luZG93c0p1bXBMaXN0KCkpO1xuXG5cdFx0Ly8gQWRkIHRvIGhpc3Rvcnkgd2hlbiBlbnRlcmluZyB3b3Jrc3BhY2Vcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2Uub25EaWRFbnRlcldvcmtzcGFjZShldmVudCA9PiB0aGlzLmFkZFJlY2VudGx5T3BlbmVkKFt7IHdvcmtzcGFjZTogZXZlbnQud29ya3NwYWNlLCByZW1vdGVBdXRob3JpdHk6IGV2ZW50LndpbmRvdy5yZW1vdGVBdXRob3JpdHkgfV0pKSk7XG5cdH1cblxuXHQvLyNyZWdpb24gV29ya3NwYWNlcyBIaXN0b3J5XG5cblx0YXN5bmMgYWRkUmVjZW50bHlPcGVuZWQocmVjZW50VG9BZGQ6IElSZWNlbnRbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCB3b3Jrc3BhY2VzOiBBcnJheTxJUmVjZW50Rm9sZGVyIHwgSVJlY2VudFdvcmtzcGFjZT4gPSBbXTtcblx0XHRsZXQgZmlsZXM6IElSZWNlbnRGaWxlW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgcmVjZW50IG9mIHJlY2VudFRvQWRkKSB7XG5cblx0XHRcdC8vIFdvcmtzcGFjZVxuXHRcdFx0aWYgKGlzUmVjZW50V29ya3NwYWNlKHJlY2VudCkpIHtcblx0XHRcdFx0aWYgKCF0aGlzLndvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UuaXNVbnRpdGxlZFdvcmtzcGFjZShyZWNlbnQud29ya3NwYWNlKSAmJiAhdGhpcy5jb250YWluc1dvcmtzcGFjZSh3b3Jrc3BhY2VzLCByZWNlbnQud29ya3NwYWNlKSkge1xuXHRcdFx0XHRcdHdvcmtzcGFjZXMucHVzaChyZWNlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZvbGRlclxuXHRcdFx0ZWxzZSBpZiAoaXNSZWNlbnRGb2xkZXIocmVjZW50KSkge1xuXHRcdFx0XHRpZiAoIXRoaXMuY29udGFpbnNGb2xkZXIod29ya3NwYWNlcywgcmVjZW50LmZvbGRlclVyaSkpIHtcblx0XHRcdFx0XHR3b3Jrc3BhY2VzLnB1c2gocmVjZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaWxlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgYWxyZWFkeUV4aXN0c0luSGlzdG9yeSA9IHRoaXMuY29udGFpbnNGaWxlKGZpbGVzLCByZWNlbnQuZmlsZVVyaSk7XG5cdFx0XHRcdGNvbnN0IHNob3VsZEJlRmlsdGVyZWQgPSByZWNlbnQuZmlsZVVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSAmJiBXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLkNPTU1PTl9GSUxFU19GSUxURVIuaW5kZXhPZihiYXNlbmFtZShyZWNlbnQuZmlsZVVyaSkpID49IDA7XG5cblx0XHRcdFx0aWYgKCFhbHJlYWR5RXhpc3RzSW5IaXN0b3J5ICYmICFzaG91bGRCZUZpbHRlcmVkKSB7XG5cdFx0XHRcdFx0ZmlsZXMucHVzaChyZWNlbnQpO1xuXG5cdFx0XHRcdFx0Ly8gQWRkIHRvIHJlY2VudCBkb2N1bWVudHMgKFdpbmRvd3Mgb25seSwgbWFjT1MgbGF0ZXIpXG5cdFx0XHRcdFx0aWYgKGlzV2luZG93cyAmJiByZWNlbnQuZmlsZVVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdFx0YXBwLmFkZFJlY2VudERvY3VtZW50KHJlY2VudC5maWxlVXJpLmZzUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVyZ2VkRW50cmllcyA9IGF3YWl0IHRoaXMubWVyZ2VFbnRyaWVzRnJvbVN0b3JhZ2UoeyB3b3Jrc3BhY2VzLCBmaWxlcyB9KTtcblx0XHR3b3Jrc3BhY2VzID0gbWVyZ2VkRW50cmllcy53b3Jrc3BhY2VzO1xuXHRcdGZpbGVzID0gbWVyZ2VkRW50cmllcy5maWxlcztcblxuXHRcdGlmICh3b3Jrc3BhY2VzLmxlbmd0aCA+IFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuTUFYX1RPVEFMX1JFQ0VOVF9FTlRSSUVTKSB7XG5cdFx0XHR3b3Jrc3BhY2VzLmxlbmd0aCA9IFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuTUFYX1RPVEFMX1JFQ0VOVF9FTlRSSUVTO1xuXHRcdH1cblxuXHRcdGlmIChmaWxlcy5sZW5ndGggPiBXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLk1BWF9UT1RBTF9SRUNFTlRfRU5UUklFUykge1xuXHRcdFx0ZmlsZXMubGVuZ3RoID0gV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZS5NQVhfVE9UQUxfUkVDRU5UX0VOVFJJRVM7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5zYXZlUmVjZW50bHlPcGVuZWQoeyB3b3Jrc3BhY2VzLCBmaWxlcyB9KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkLmZpcmUoKTtcblxuXHRcdC8vIFNjaGVkdWxlIHVwZGF0ZSB0byByZWNlbnQgZG9jdW1lbnRzIG9uIG1hY09TIGRvY2tcblx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdHRoaXMubWFjT1NSZWNlbnREb2N1bWVudHNVcGRhdGVyLnRyaWdnZXIoKCkgPT4gdGhpcy51cGRhdGVNYWNPU1JlY2VudERvY3VtZW50cygpKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZW1vdmVSZWNlbnRseU9wZW5lZChyZWNlbnRUb1JlbW92ZTogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBrZWVwID0gKHJlY2VudDogSVJlY2VudCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gdGhpcy5sb2NhdGlvbihyZWNlbnQpO1xuXHRcdFx0Zm9yIChjb25zdCByZXNvdXJjZVRvUmVtb3ZlIG9mIHJlY2VudFRvUmVtb3ZlKSB7XG5cdFx0XHRcdGlmIChleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5pc0VxdWFsKHJlc291cmNlVG9SZW1vdmUsIHVyaSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1ydSA9IGF3YWl0IHRoaXMuZ2V0UmVjZW50bHlPcGVuZWQoKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VzID0gbXJ1LndvcmtzcGFjZXMuZmlsdGVyKGtlZXApO1xuXHRcdGNvbnN0IGZpbGVzID0gbXJ1LmZpbGVzLmZpbHRlcihrZWVwKTtcblxuXHRcdGlmICh3b3Jrc3BhY2VzLmxlbmd0aCAhPT0gbXJ1LndvcmtzcGFjZXMubGVuZ3RoIHx8IGZpbGVzLmxlbmd0aCAhPT0gbXJ1LmZpbGVzLmxlbmd0aCkge1xuXHRcdFx0YXdhaXQgdGhpcy5zYXZlUmVjZW50bHlPcGVuZWQoeyBmaWxlcywgd29ya3NwYWNlcyB9KTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUmVjZW50bHlPcGVuZWQuZmlyZSgpO1xuXG5cdFx0XHQvLyBTY2hlZHVsZSB1cGRhdGUgdG8gcmVjZW50IGRvY3VtZW50cyBvbiBtYWNPUyBkb2NrXG5cdFx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0dGhpcy5tYWNPU1JlY2VudERvY3VtZW50c1VwZGF0ZXIudHJpZ2dlcigoKSA9PiB0aGlzLnVwZGF0ZU1hY09TUmVjZW50RG9jdW1lbnRzKCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNsZWFyUmVjZW50bHlPcGVuZWQob3B0aW9ucz86IHsgY29uZmlybT86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChvcHRpb25zPy5jb25maXJtKSB7XG5cdFx0XHRjb25zdCB7IHJlc3BvbnNlIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnNob3dNZXNzYWdlQm94KHtcblx0XHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdjbGVhckJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2xlYXJcIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdjYW5jZWwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDYW5jZWxcIilcblx0XHRcdFx0XSxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1DbGVhclJlY2VudHNNZXNzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBjbGVhciBhbGwgcmVjZW50bHkgb3BlbmVkIGZpbGVzIGFuZCB3b3Jrc3BhY2VzP1wiKSxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnY29uZmlybUNsZWFyRGV0YWlsJywgXCJUaGlzIGFjdGlvbiBpcyBpcnJldmVyc2libGUhXCIpLFxuXHRcdFx0XHRjYW5jZWxJZDogMVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChyZXNwb25zZSAhPT0gMCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5zYXZlUmVjZW50bHlPcGVuZWQoeyB3b3Jrc3BhY2VzOiBbXSwgZmlsZXM6IFtdIH0pO1xuXHRcdGFwcC5jbGVhclJlY2VudERvY3VtZW50cygpO1xuXG5cdFx0Ly8gRXZlbnRcblx0XHR0aGlzLl9vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkLmZpcmUoKTtcblx0fVxuXG5cdGFzeW5jIGdldFJlY2VudGx5T3BlbmVkKCk6IFByb21pc2U8SVJlY2VudGx5T3BlbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMubWVyZ2VFbnRyaWVzRnJvbVN0b3JhZ2UoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWVyZ2VFbnRyaWVzRnJvbVN0b3JhZ2UoZXhpc3RpbmdFbnRyaWVzPzogSVJlY2VudGx5T3BlbmVkKTogUHJvbWlzZTxJUmVjZW50bHlPcGVuZWQ+IHtcblxuXHRcdC8vIEJ1aWxkIG1hcHMgZm9yIG1vcmUgZWZmaWNpZW50IGxvb2t1cCBvZiBleGlzdGluZyBlbnRyaWVzIHRoYXRcblx0XHQvLyBhcmUgcGFzc2VkIGluIGJ5IHN0b3JpbmcgYmFzZWQgb24gd29ya3NwYWNlL2ZpbGUgaWRlbnRpZmllclxuXG5cdFx0Y29uc3QgbWFwV29ya3NwYWNlSWRUb1dvcmtzcGFjZSA9IG5ldyBSZXNvdXJjZU1hcDxJUmVjZW50Rm9sZGVyIHwgSVJlY2VudFdvcmtzcGFjZT4odXJpID0+IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLmdldENvbXBhcmlzb25LZXkodXJpKSk7XG5cdFx0aWYgKGV4aXN0aW5nRW50cmllcz8ud29ya3NwYWNlcykge1xuXHRcdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2Ugb2YgZXhpc3RpbmdFbnRyaWVzLndvcmtzcGFjZXMpIHtcblx0XHRcdFx0bWFwV29ya3NwYWNlSWRUb1dvcmtzcGFjZS5zZXQodGhpcy5sb2NhdGlvbih3b3Jrc3BhY2UpLCB3b3Jrc3BhY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG1hcEZpbGVJZFRvRmlsZSA9IG5ldyBSZXNvdXJjZU1hcDxJUmVjZW50RmlsZT4odXJpID0+IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLmdldENvbXBhcmlzb25LZXkodXJpKSk7XG5cdFx0aWYgKGV4aXN0aW5nRW50cmllcz8uZmlsZXMpIHtcblx0XHRcdGZvciAoY29uc3QgZmlsZSBvZiBleGlzdGluZ0VudHJpZXMuZmlsZXMpIHtcblx0XHRcdFx0bWFwRmlsZUlkVG9GaWxlLnNldCh0aGlzLmxvY2F0aW9uKGZpbGUpLCBmaWxlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBNZXJnZSBpbiBlbnRyaWVzIGZyb20gc3RvcmFnZSwgcHJlc2VydmluZyBleGlzdGluZyBrbm93biBlbnRyaWVzXG5cblx0XHRjb25zdCByZWNlbnRGcm9tU3RvcmFnZSA9IGF3YWl0IHRoaXMuZ2V0UmVjZW50bHlPcGVuZWRGcm9tU3RvcmFnZSgpO1xuXHRcdGZvciAoY29uc3QgcmVjZW50V29ya3NwYWNlRnJvbVN0b3JhZ2Ugb2YgcmVjZW50RnJvbVN0b3JhZ2Uud29ya3NwYWNlcykge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmdSZWNlbnRXb3Jrc3BhY2UgPSBtYXBXb3Jrc3BhY2VJZFRvV29ya3NwYWNlLmdldCh0aGlzLmxvY2F0aW9uKHJlY2VudFdvcmtzcGFjZUZyb21TdG9yYWdlKSk7XG5cdFx0XHRpZiAoZXhpc3RpbmdSZWNlbnRXb3Jrc3BhY2UpIHtcblx0XHRcdFx0ZXhpc3RpbmdSZWNlbnRXb3Jrc3BhY2UubGFiZWwgPSBleGlzdGluZ1JlY2VudFdvcmtzcGFjZS5sYWJlbCA/PyByZWNlbnRXb3Jrc3BhY2VGcm9tU3RvcmFnZS5sYWJlbDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcFdvcmtzcGFjZUlkVG9Xb3Jrc3BhY2Uuc2V0KHRoaXMubG9jYXRpb24ocmVjZW50V29ya3NwYWNlRnJvbVN0b3JhZ2UpLCByZWNlbnRXb3Jrc3BhY2VGcm9tU3RvcmFnZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCByZWNlbnRGaWxlRnJvbVN0b3JhZ2Ugb2YgcmVjZW50RnJvbVN0b3JhZ2UuZmlsZXMpIHtcblx0XHRcdGNvbnN0IGV4aXN0aW5nUmVjZW50RmlsZSA9IG1hcEZpbGVJZFRvRmlsZS5nZXQodGhpcy5sb2NhdGlvbihyZWNlbnRGaWxlRnJvbVN0b3JhZ2UpKTtcblx0XHRcdGlmIChleGlzdGluZ1JlY2VudEZpbGUpIHtcblx0XHRcdFx0ZXhpc3RpbmdSZWNlbnRGaWxlLmxhYmVsID0gZXhpc3RpbmdSZWNlbnRGaWxlLmxhYmVsID8/IHJlY2VudEZpbGVGcm9tU3RvcmFnZS5sYWJlbDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcEZpbGVJZFRvRmlsZS5zZXQodGhpcy5sb2NhdGlvbihyZWNlbnRGaWxlRnJvbVN0b3JhZ2UpLCByZWNlbnRGaWxlRnJvbVN0b3JhZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR3b3Jrc3BhY2VzOiBbLi4ubWFwV29ya3NwYWNlSWRUb1dvcmtzcGFjZS52YWx1ZXMoKV0sXG5cdFx0XHRmaWxlczogWy4uLm1hcEZpbGVJZFRvRmlsZS52YWx1ZXMoKV1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRSZWNlbnRseU9wZW5lZEZyb21TdG9yYWdlKCk6IFByb21pc2U8SVJlY2VudGx5T3BlbmVkPiB7XG5cblx0XHQvLyBXYWl0IGZvciBnbG9iYWwgc3RvcmFnZSB0byBiZSByZWFkeVxuXHRcdGF3YWl0IHRoaXMuYXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2Uud2hlblJlYWR5O1xuXG5cdFx0bGV0IHN0b3JlZFJlY2VudGx5T3BlbmVkOiBvYmplY3QgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBGaXJzdCB0cnkgd2l0aCBzdG9yYWdlIHNlcnZpY2Vcblx0XHRjb25zdCBzdG9yZWRSZWNlbnRseU9wZW5lZFJhdyA9IHRoaXMuYXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2UuZ2V0KFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuUkVDRU5UTFlfT1BFTkVEX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdGlmICh0eXBlb2Ygc3RvcmVkUmVjZW50bHlPcGVuZWRSYXcgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzdG9yZWRSZWNlbnRseU9wZW5lZCA9IEpTT04ucGFyc2Uoc3RvcmVkUmVjZW50bHlPcGVuZWRSYXcpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdVbmV4cGVjdGVkIGVycm9yIHBhcnNpbmcgb3BlbmVkIHBhdGhzIGxpc3QnLCBlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3RvcmVSZWNlbnRseU9wZW5lZChzdG9yZWRSZWNlbnRseU9wZW5lZCwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2F2ZVJlY2VudGx5T3BlbmVkKHJlY2VudDogSVJlY2VudGx5T3BlbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBXYWl0IGZvciBnbG9iYWwgc3RvcmFnZSB0byBiZSByZWFkeVxuXHRcdGF3YWl0IHRoaXMuYXBwbGljYXRpb25TdG9yYWdlTWFpblNlcnZpY2Uud2hlblJlYWR5O1xuXG5cdFx0Ly8gU3RvcmUgaW4gZ2xvYmFsIHN0b3JhZ2UgKGJ1dCBkbyBub3Qgc3luYyBzaW5jZSB0aGlzIGlzIG1haW5seSBsb2NhbCBwYXRocylcblx0XHR0aGlzLmFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlLnN0b3JlKFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuUkVDRU5UTFlfT1BFTkVEX1NUT1JBR0VfS0VZLCBKU09OLnN0cmluZ2lmeSh0b1N0b3JlRGF0YShyZWNlbnQpKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cHJpdmF0ZSBsb2NhdGlvbihyZWNlbnQ6IElSZWNlbnQpOiBVUkkge1xuXHRcdGlmIChpc1JlY2VudEZvbGRlcihyZWNlbnQpKSB7XG5cdFx0XHRyZXR1cm4gcmVjZW50LmZvbGRlclVyaTtcblx0XHR9XG5cblx0XHRpZiAoaXNSZWNlbnRGaWxlKHJlY2VudCkpIHtcblx0XHRcdHJldHVybiByZWNlbnQuZmlsZVVyaTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVjZW50LndvcmtzcGFjZS5jb25maWdQYXRoO1xuXHR9XG5cblx0cHJpdmF0ZSBjb250YWluc1dvcmtzcGFjZShyZWNlbnRzOiBJUmVjZW50W10sIGNhbmRpZGF0ZTogSVdvcmtzcGFjZUlkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFyZWNlbnRzLmZpbmQocmVjZW50ID0+IGlzUmVjZW50V29ya3NwYWNlKHJlY2VudCkgJiYgcmVjZW50LndvcmtzcGFjZS5pZCA9PT0gY2FuZGlkYXRlLmlkKTtcblx0fVxuXG5cdHByaXZhdGUgY29udGFpbnNGb2xkZXIocmVjZW50czogSVJlY2VudFtdLCBjYW5kaWRhdGU6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXJlY2VudHMuZmluZChyZWNlbnQgPT4gaXNSZWNlbnRGb2xkZXIocmVjZW50KSAmJiBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5pc0VxdWFsKHJlY2VudC5mb2xkZXJVcmksIGNhbmRpZGF0ZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb250YWluc0ZpbGUocmVjZW50czogSVJlY2VudEZpbGVbXSwgY2FuZGlkYXRlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFyZWNlbnRzLmZpbmQocmVjZW50ID0+IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLmlzRXF1YWwocmVjZW50LmZpbGVVcmksIGNhbmRpZGF0ZSkpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gbWFjT1MgRG9jayAvIFdpbmRvd3MgSnVtcExpc3RcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfTUFDT1NfRE9DS19SRUNFTlRfV09SS1NQQUNFUyA9IDc7IFx0XHQvLyBwcmVmZXIgaGlnaGVyIG51bWJlciBvZiB3b3Jrc3BhY2VzLi4uXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9NQUNPU19ET0NLX1JFQ0VOVF9FTlRSSUVTX1RPVEFMID0gMTA7IFx0Ly8gLi4ub3ZlciBudW1iZXIgb2YgZmlsZXNcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfV0lORE9XU19KVU1QX0xJU1RfRU5UUklFUyA9IDc7XG5cblx0Ly8gRXhjbHVkZSBzb21lIHZlcnkgY29tbW9uIGZpbGVzIGZyb20gdGhlIGRvY2svdGFza2JhclxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDT01NT05fRklMRVNfRklMVEVSID0gW1xuXHRcdCdDT01NSVRfRURJVE1TRycsXG5cdFx0J01FUkdFX01TRycsXG5cdFx0J2dpdC1yZWJhc2UtdG9kbydcblx0XTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hY09TUmVjZW50RG9jdW1lbnRzVXBkYXRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaHJvdHRsZWREZWxheWVyPHZvaWQ+KDgwMCkpO1xuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlV2luZG93c0p1bXBMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgb24gd2luZG93c1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMudXBkYXRlV2luZG93c0p1bXBMaXN0KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkKCgpID0+IHRoaXMudXBkYXRlV2luZG93c0p1bXBMaXN0KCkpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlV2luZG93c0p1bXBMaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgb24gd2luZG93c1xuXHRcdH1cblxuXHRcdGNvbnN0IGp1bXBMaXN0OiBKdW1wTGlzdENhdGVnb3J5W10gPSBbXTtcblxuXHRcdC8vIFRhc2tzXG5cdFx0anVtcExpc3QucHVzaCh7XG5cdFx0XHR0eXBlOiAndGFza3MnLFxuXHRcdFx0aXRlbXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICd0YXNrJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ25ld1dpbmRvdycsIFwiTmV3IFdpbmRvd1wiKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ25ld1dpbmRvd0Rlc2MnLCBcIk9wZW5zIGEgbmV3IHdpbmRvd1wiKSxcblx0XHRcdFx0XHRwcm9ncmFtOiBwcm9jZXNzLmV4ZWNQYXRoLFxuXHRcdFx0XHRcdGFyZ3M6ICctbicsIC8vIGZvcmNlIG5ldyB3aW5kb3dcblx0XHRcdFx0XHRpY29uUGF0aDogcHJvY2Vzcy5leGVjUGF0aCxcblx0XHRcdFx0XHRpY29uSW5kZXg6IDBcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXG5cdFx0Ly8gUmVjZW50IFdvcmtzcGFjZXNcblx0XHRpZiAoKGF3YWl0IHRoaXMuZ2V0UmVjZW50bHlPcGVuZWQoKSkud29ya3NwYWNlcy5sZW5ndGggPiAwKSB7XG5cblx0XHRcdC8vIFRoZSB1c2VyIG1pZ2h0IGhhdmUgbWVhbndoaWxlIHJlbW92ZWQgaXRlbXMgZnJvbSB0aGUganVtcCBsaXN0IGFuZCB3ZSBoYXZlIHRvIHJlc3BlY3QgdGhhdFxuXHRcdFx0Ly8gc28gd2UgbmVlZCB0byB1cGRhdGUgb3VyIGxpc3Qgb2YgcmVjZW50IHBhdGhzIHdpdGggdGhlIGNob2ljZSBvZiB0aGUgdXNlciB0byBub3QgYWRkIHRoZW0gYWdhaW5cblx0XHRcdC8vIEFsc286IFdpbmRvd3Mgd2lsbCBub3Qgc2hvdyBvdXIgY3VzdG9tIGNhdGVnb3J5IGF0IGFsbCBpZiB0aGVyZSBpcyBhbnkgZW50cnkgd2hpY2ggd2FzIHJlbW92ZWRcblx0XHRcdC8vIGJ5IHRoZSB1c2VyISBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE1MDUyXG5cdFx0XHRjb25zdCB0b1JlbW92ZTogVVJJW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBhcHAuZ2V0SnVtcExpc3RTZXR0aW5ncygpLnJlbW92ZWRJdGVtcykge1xuXHRcdFx0XHRjb25zdCBhcmdzID0gaXRlbS5hcmdzO1xuXHRcdFx0XHRpZiAoYXJncykge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gL14tLShmb2xkZXJ8ZmlsZSktdXJpXFxzK1wiKFteXCJdKylcIiQvLmV4ZWMoYXJncyk7XG5cdFx0XHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdFx0XHR0b1JlbW92ZS5wdXNoKFVSSS5wYXJzZShtYXRjaFsyXSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5yZW1vdmVSZWNlbnRseU9wZW5lZCh0b1JlbW92ZSk7XG5cblx0XHRcdC8vIEFkZCBlbnRyaWVzXG5cdFx0XHRsZXQgaGFzV29ya3NwYWNlcyA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgaXRlbXM6IEp1bXBMaXN0SXRlbVtdID0gY29hbGVzY2UoKGF3YWl0IHRoaXMuZ2V0UmVjZW50bHlPcGVuZWQoKSkud29ya3NwYWNlcy5zbGljZSgwLCBXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLk1BWF9XSU5ET1dTX0pVTVBfTElTVF9FTlRSSUVTKS5tYXAocmVjZW50ID0+IHtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gaXNSZWNlbnRXb3Jrc3BhY2UocmVjZW50KSA/IHJlY2VudC53b3Jrc3BhY2UgOiByZWNlbnQuZm9sZGVyVXJpO1xuXG5cdFx0XHRcdGNvbnN0IHsgdGl0bGUsIGRlc2NyaXB0aW9uIH0gPSB0aGlzLmdldFdpbmRvd3NKdW1wTGlzdExhYmVsKHdvcmtzcGFjZSwgcmVjZW50LmxhYmVsKTtcblx0XHRcdFx0bGV0IGFyZ3M7XG5cdFx0XHRcdGlmIChVUkkuaXNVcmkod29ya3NwYWNlKSkge1xuXHRcdFx0XHRcdGFyZ3MgPSBgLS1mb2xkZXItdXJpIFwiJHt3b3Jrc3BhY2UudG9TdHJpbmcoKX1cImA7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aGFzV29ya3NwYWNlcyA9IHRydWU7XG5cdFx0XHRcdFx0YXJncyA9IGAtLWZpbGUtdXJpIFwiJHt3b3Jrc3BhY2UuY29uZmlnUGF0aC50b1N0cmluZygpfVwiYDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogJ3Rhc2snLFxuXHRcdFx0XHRcdHRpdGxlOiB0aXRsZS5zdWJzdHIoMCwgMjU1KSwgXHRcdFx0XHQvLyBXaW5kb3dzIHNlZW1zIHRvIGJlIHBpY2t5IGFyb3VuZCB0aGUgbGVuZ3RoIG9mIGVudHJpZXNcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24uc3Vic3RyKDAsIDI1NSksXHQvLyAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTExNzcpXG5cdFx0XHRcdFx0cHJvZ3JhbTogcHJvY2Vzcy5leGVjUGF0aCxcblx0XHRcdFx0XHRhcmdzLFxuXHRcdFx0XHRcdGljb25QYXRoOiAnZXhwbG9yZXIuZXhlJywgLy8gc2ltdWxhdGUgZm9sZGVyIGljb25cblx0XHRcdFx0XHRpY29uSW5kZXg6IDBcblx0XHRcdFx0fTtcblx0XHRcdH0pKTtcblxuXHRcdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0anVtcExpc3QucHVzaCh7XG5cdFx0XHRcdFx0dHlwZTogJ2N1c3RvbScsXG5cdFx0XHRcdFx0bmFtZTogaGFzV29ya3NwYWNlcyA/IGxvY2FsaXplKCdyZWNlbnRGb2xkZXJzQW5kV29ya3NwYWNlcycsIFwiUmVjZW50IEZvbGRlcnMgJiBXb3Jrc3BhY2VzXCIpIDogbG9jYWxpemUoJ3JlY2VudEZvbGRlcnMnLCBcIlJlY2VudCBGb2xkZXJzXCIpLFxuXHRcdFx0XHRcdGl0ZW1zXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlY2VudFxuXHRcdGp1bXBMaXN0LnB1c2goe1xuXHRcdFx0dHlwZTogJ3JlY2VudCcgLy8gdGhpcyBlbmFibGVzIHRvIHNob3cgZmlsZXMgaW4gdGhlIFwicmVjZW50XCIgY2F0ZWdvcnlcblx0XHR9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXMgPSBhcHAuc2V0SnVtcExpc3QoanVtcExpc3QpO1xuXHRcdFx0aWYgKHJlcyAmJiByZXMgIT09ICdvaycpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYHVwZGF0ZVdpbmRvd3NKdW1wTGlzdCNzZXRKdW1wTGlzdCB1bmV4cGVjdGVkIHJlc3VsdDogJHtyZXN9YCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCd1cGRhdGVXaW5kb3dzSnVtcExpc3Qjc2V0SnVtcExpc3QnLCBlcnJvcik7IC8vIHNpbmNlIHNldEp1bXBMaXN0IGlzIHJlbGF0aXZlbHkgbmV3IEFQSSwgbWFrZSBzdXJlIHRvIGd1YXJkIGZvciBlcnJvcnNcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFdpbmRvd3NKdW1wTGlzdExhYmVsKHdvcmtzcGFjZTogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBVUkksIHJlY2VudExhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB7IHRpdGxlOiBzdHJpbmc7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSB7XG5cblx0XHQvLyBQcmVmZXIgcmVjZW50IGxhYmVsXG5cdFx0aWYgKHJlY2VudExhYmVsKSB7XG5cdFx0XHRyZXR1cm4geyB0aXRsZTogc3BsaXRSZWNlbnRMYWJlbChyZWNlbnRMYWJlbCkubmFtZSwgZGVzY3JpcHRpb246IHJlY2VudExhYmVsIH07XG5cdFx0fVxuXG5cdFx0Ly8gU2luZ2xlIEZvbGRlclxuXHRcdGlmIChVUkkuaXNVcmkod29ya3NwYWNlKSkge1xuXHRcdFx0cmV0dXJuIHsgdGl0bGU6IGJhc2VuYW1lKHdvcmtzcGFjZSksIGRlc2NyaXB0aW9uOiB0aGlzLnJlbmRlckp1bXBMaXN0UGF0aERlc2NyaXB0aW9uKHdvcmtzcGFjZSkgfTtcblx0XHR9XG5cblx0XHQvLyBXb3Jrc3BhY2U6IFVudGl0bGVkXG5cdFx0aWYgKHRoaXMud29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5pc1VudGl0bGVkV29ya3NwYWNlKHdvcmtzcGFjZSkpIHtcblx0XHRcdHJldHVybiB7IHRpdGxlOiBsb2NhbGl6ZSgndW50aXRsZWRXb3Jrc3BhY2UnLCBcIlVudGl0bGVkIChXb3Jrc3BhY2UpXCIpLCBkZXNjcmlwdGlvbjogJycgfTtcblx0XHR9XG5cblx0XHQvLyBXb3Jrc3BhY2U6IG5vcm1hbFxuXHRcdGxldCBmaWxlbmFtZSA9IGJhc2VuYW1lKHdvcmtzcGFjZS5jb25maWdQYXRoKTtcblx0XHRpZiAoZmlsZW5hbWUuZW5kc1dpdGgoV09SS1NQQUNFX0VYVEVOU0lPTikpIHtcblx0XHRcdGZpbGVuYW1lID0gZmlsZW5hbWUuc3Vic3RyKDAsIGZpbGVuYW1lLmxlbmd0aCAtIFdPUktTUEFDRV9FWFRFTlNJT04ubGVuZ3RoIC0gMSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgdGl0bGU6IGxvY2FsaXplKCd3b3Jrc3BhY2VOYW1lJywgXCJ7MH0gKFdvcmtzcGFjZSlcIiwgZmlsZW5hbWUpLCBkZXNjcmlwdGlvbjogdGhpcy5yZW5kZXJKdW1wTGlzdFBhdGhEZXNjcmlwdGlvbih3b3Jrc3BhY2UuY29uZmlnUGF0aCkgfTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVySnVtcExpc3RQYXRoRGVzY3JpcHRpb24odXJpOiBVUkkpIHtcblx0XHRyZXR1cm4gdXJpLnNjaGVtZSA9PT0gJ2ZpbGUnID8gbm9ybWFsaXplRHJpdmVMZXR0ZXIodXJpLmZzUGF0aCkgOiB1cmkudG9TdHJpbmcoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlTWFjT1NSZWNlbnREb2N1bWVudHMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFpc01hY2ludG9zaCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFdlIGNsZWFyIGFsbCBkb2N1bWVudHMgZmlyc3QgdG8gZW5zdXJlIGFuIHVwLXRvLWRhdGUgdmlldyBvbiB0aGUgc2V0LiBTaW5jZSBlbnRyaWVzXG5cdFx0Ly8gY2FuIGdldCBkZWxldGVkIG9uIGRpc2ssIHRoaXMgZW5zdXJlcyB0aGF0IHRoZSBsaXN0IGlzIGFsd2F5cyB2YWxpZFxuXHRcdGFwcC5jbGVhclJlY2VudERvY3VtZW50cygpO1xuXG5cdFx0Y29uc3QgbXJ1ID0gYXdhaXQgdGhpcy5nZXRSZWNlbnRseU9wZW5lZCgpO1xuXG5cdFx0Ly8gQ29sbGVjdCBtYXgtTiByZWNlbnQgd29ya3NwYWNlcyB0aGF0IGFyZSBrbm93biB0byBleGlzdFxuXHRcdGNvbnN0IHdvcmtzcGFjZUVudHJpZXM6IHN0cmluZ1tdID0gW107XG5cdFx0bGV0IGVudHJpZXMgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbXJ1LndvcmtzcGFjZXMubGVuZ3RoICYmIGVudHJpZXMgPCBXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLk1BWF9NQUNPU19ET0NLX1JFQ0VOVF9XT1JLU1BBQ0VTOyBpKyspIHtcblx0XHRcdGNvbnN0IGxvYyA9IHRoaXMubG9jYXRpb24obXJ1LndvcmtzcGFjZXNbaV0pO1xuXHRcdFx0aWYgKGxvYy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VQYXRoID0gb3JpZ2luYWxGU1BhdGgobG9jKTtcblx0XHRcdFx0aWYgKGF3YWl0IFByb21pc2VzLmV4aXN0cyh3b3Jrc3BhY2VQYXRoKSkge1xuXHRcdFx0XHRcdHdvcmtzcGFjZUVudHJpZXMucHVzaCh3b3Jrc3BhY2VQYXRoKTtcblx0XHRcdFx0XHRlbnRyaWVzKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDb2xsZWN0IG1heC1OIHJlY2VudCBmaWxlcyB0aGF0IGFyZSBrbm93biB0byBleGlzdFxuXHRcdGNvbnN0IGZpbGVFbnRyaWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbXJ1LmZpbGVzLmxlbmd0aCAmJiBlbnRyaWVzIDwgV29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZS5NQVhfTUFDT1NfRE9DS19SRUNFTlRfRU5UUklFU19UT1RBTDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsb2MgPSB0aGlzLmxvY2F0aW9uKG1ydS5maWxlc1tpXSk7XG5cdFx0XHRpZiAobG9jLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVQYXRoID0gb3JpZ2luYWxGU1BhdGgobG9jKTtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UuQ09NTU9OX0ZJTEVTX0ZJTFRFUi5pbmNsdWRlcyhiYXNlbmFtZShsb2MpKSB8fCAvLyBza2lwIHNvbWUgd2VsbCBrbm93biBmaWxlIGVudHJpZXNcblx0XHRcdFx0XHR3b3Jrc3BhY2VFbnRyaWVzLmluY2x1ZGVzKGZpbGVQYXRoKVx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwcmVmZXIgYSB3b3Jrc3BhY2UgZW50cnkgb3ZlciBhIGZpbGUgZW50cnkgKGUuZy4gZm9yIC5jb2RlLXdvcmtzcGFjZSlcblx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYXdhaXQgUHJvbWlzZXMuZXhpc3RzKGZpbGVQYXRoKSkge1xuXHRcdFx0XHRcdGZpbGVFbnRyaWVzLnB1c2goZmlsZVBhdGgpO1xuXHRcdFx0XHRcdGVudHJpZXMrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRoZSBhcHBsZSBndWlkZWxpbmVzIChodHRwczovL2RldmVsb3Blci5hcHBsZS5jb20vZGVzaWduL2h1bWFuLWludGVyZmFjZS1ndWlkZWxpbmVzL21hY29zL21lbnVzL21lbnUtYW5hdG9teS8pXG5cdFx0Ly8gZXhwbGFpbiB0aGF0IG1vc3QgcmVjZW50IGVudHJpZXMgc2hvdWxkIGFwcGVhciBjbG9zZSB0byB0aGUgaW50ZXJhY3Rpb24gYnkgdGhlIHVzZXIgKGUuZy4gY2xvc2UgdG8gdGhlXG5cdFx0Ly8gbW91c2UgY2xpY2spLiBNb3N0IG5hdGl2ZSBtYWNPUyBhcHBsaWNhdGlvbnMgdGhhdCBhZGQgcmVjZW50IGRvY3VtZW50cyB0byB0aGUgZG9jaywgc2hvdyB0aGUgbW9zdCByZWNlbnQgZG9jdW1lbnRcblx0XHQvLyB0byB0aGUgYm90dG9tIChiZWNhdXNlIHRoZSBkb2NrIG1lbnUgaXMgbm90IGFwcGVhcmluZyBmcm9tIHRvcCB0byBib3R0b20sIGJ1dCBmcm9tIHRoZSBib3R0b20gdG8gdGhlIHRvcCkuIEFzIHN1Y2hcblx0XHQvLyB3ZSBmaWxsIGluIHRoZSBlbnRyaWVzIGluIHJldmVyc2Ugb3JkZXIgc28gdGhhdCB0aGUgbW9zdCByZWNlbnQgc2hvd3MgdXAgYXQgdGhlIGJvdHRvbSBvZiB0aGUgbWVudS5cblx0XHQvL1xuXHRcdC8vIE9uIHRvcCBvZiB0aGF0LCB0aGUgbWF4aW11bSBudW1iZXIgb2YgZG9jdW1lbnRzIGNhbiBiZSBjb25maWd1cmVkIGJ5IHRoZSB1c2VyIChkZWZhdWx0cyB0byAxMCkuIFRvIGVuc3VyZSB0aGF0XG5cdFx0Ly8gd2UgYXJlIG5vdCBmYWlsaW5nIHRvIHNob3cgdGhlIG1vc3QgcmVjZW50IGVudHJpZXMsIHdlIHN0YXJ0IGJ5IGFkZGluZyBmaWxlcyBmaXJzdCAoaW4gcmV2ZXJzZSBvcmRlciBvZiByZWNlbmN5KVxuXHRcdC8vIGFuZCB0aGVuIGFkZCBmb2xkZXJzIChpbiByZXZlcnNlIG9yZGVyIG9mIHJlY2VuY3kpLiBHaXZlbiB0aGF0IHN0cmF0ZWd5LCB3ZSBjYW4gZW5zdXJlIHRoYXQgdGhlIG1vc3QgcmVjZW50XG5cdFx0Ly8gTiBmb2xkZXJzIGFyZSBhbHdheXMgYXBwZWFyaW5nLCBldmVuIGlmIHRoZSBsaW1pdCBpcyBsb3cgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83NDc4OClcblx0XHRmaWxlRW50cmllcy5yZXZlcnNlKCkuZm9yRWFjaChmaWxlRW50cnkgPT4gYXBwLmFkZFJlY2VudERvY3VtZW50KGZpbGVFbnRyeSkpO1xuXHRcdHdvcmtzcGFjZUVudHJpZXMucmV2ZXJzZSgpLmZvckVhY2god29ya3NwYWNlRW50cnkgPT4gYXBwLmFkZFJlY2VudERvY3VtZW50KHdvcmtzcGFjZUVudHJ5KSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxXQUEyQztBQUNwRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQXFDO0FBQzlDLFNBQVMsc0JBQXNCLHdCQUF3QjtBQUN2RCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxhQUFhLGlCQUFpQjtBQUN2QyxTQUFTLFVBQVUsNEJBQTRCLHNCQUFzQjtBQUNyRSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUIsMEJBQTBCO0FBQzFELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsY0FBYyxxQkFBcUI7QUFDNUMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBaUYsY0FBYyxnQkFBZ0IsbUJBQW1CLHVCQUF1QixtQkFBbUI7QUFDNUssU0FBK0IsMkJBQTJCO0FBQzFELFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMEJBQTBCO0FBRTVCLE1BQU0sZ0NBQWdDLGdCQUErQyw4QkFBOEI7QUFjbkgsSUFBTSwrQkFBTixjQUEyQyxXQUFvRDtBQUFBLEVBV3JHLFlBQytCLFlBQ3FCLGlDQUNYLHNCQUNT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
