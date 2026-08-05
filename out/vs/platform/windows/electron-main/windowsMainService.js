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
import * as fs from "fs";
import { app, BrowserWindow, shell } from "electron";
import { addUNCHostToAllowlist } from "../../../base/node/unc.js";
import { hostname, release, arch } from "os";
import { coalesce, distinct } from "../../../base/common/arrays.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { CharCode } from "../../../base/common/charCode.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { isWindowsDriveLetter, parseLineAndColumnAware, sanitizeFilePath, toSlashes } from "../../../base/common/extpath.js";
import { getPathLabel } from "../../../base/common/labels.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { Schemas } from "../../../base/common/network.js";
import { basename, join, normalize, posix } from "../../../base/common/path.js";
import { getMarks, mark } from "../../../base/common/performance.js";
import { isMacintosh, isWindows, OS } from "../../../base/common/platform.js";
import { cwd } from "../../../base/common/process.js";
import { extUriBiasedIgnorePathCase, isEqualAuthority, normalizePath, originalFSPath, removeTrailingPathSeparator } from "../../../base/common/resources.js";
import { assertIsDefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { getNLSLanguage, getNLSMessages, localize } from "../../../nls.js";
import { IBackupMainService } from "../../backup/electron-main/backup.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IDialogMainService } from "../../dialogs/electron-main/dialogMainService.js";
import { IEnvironmentMainService } from "../../environment/electron-main/environmentMainService.js";
import { FileType, IFileService } from "../../files/common/files.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ILifecycleMainService } from "../../lifecycle/electron-main/lifecycleMainService.js";
import { ILogService } from "../../log/common/log.js";
import product from "../../product/common/product.js";
import { IProtocolMainService } from "../../protocol/electron-main/protocol.js";
import { getRemoteAuthority } from "../../remote/common/remoteHosts.js";
import { IStateService } from "../../state/node/state.js";
import { isFileToOpen, isFolderToOpen, isWorkspaceToOpen } from "../../window/common/window.js";
import { CodeWindow } from "./windowImpl.js";
import { OpenContext, getLastFocused } from "./windows.js";
import { findWindowOnExtensionDevelopmentPath, findWindowOnFile, findWindowOnWorkspaceOrFolder } from "./windowsFinder.js";
import { WindowsStateHandler } from "./windowsStateHandler.js";
import { hasWorkspaceFileExtension, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier, toWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { createEmptyWorkspaceIdentifier, getSingleFolderWorkspaceIdentifier, getWorkspaceIdentifier } from "../../workspaces/node/workspaces.js";
import { IWorkspacesHistoryMainService } from "../../workspaces/electron-main/workspacesHistoryMainService.js";
import { IWorkspacesManagementMainService } from "../../workspaces/electron-main/workspacesManagementMainService.js";
import { UnloadReason } from "../../window/electron-main/window.js";
import { IThemeMainService } from "../../theme/electron-main/themeMainService.js";
import { IPolicyService } from "../../policy/common/policy.js";
import { IUserDataProfilesMainService } from "../../userDataProfile/electron-main/userDataProfile.js";
import { ILoggerMainService } from "../../log/electron-main/loggerService.js";
import { IAuxiliaryWindowsMainService } from "../../auxiliaryWindow/electron-main/auxiliaryWindows.js";
import { ICSSDevelopmentService } from "../../cssDev/node/cssDevService.js";
import { ResourceSet } from "../../../base/common/map.js";
const EMPTY_WINDOW = /* @__PURE__ */ Object.create(null);
function isWorkspacePathToOpen(path) {
  return isWorkspaceIdentifier(path?.workspace);
}
function isSingleFolderWorkspacePathToOpen(path) {
  return isSingleFolderWorkspaceIdentifier(path?.workspace);
}
let WindowsMainService = class extends Disposable {
  constructor(machineId, sqmId, devDeviceId, initialUserEnv, logService, loggerService, stateService, policyService, environmentMainService, userDataProfilesMainService, lifecycleMainService, backupMainService, configurationService, workspacesHistoryMainService, workspacesManagementMainService, instantiationService, dialogMainService, fileService, protocolMainService, themeMainService, auxiliaryWindowsMainService, cssDevelopmentService) {
    super();
    this.machineId = machineId;
    this.sqmId = sqmId;
    this.devDeviceId = devDeviceId;
    this.initialUserEnv = initialUserEnv;
    this.logService = logService;
    this.loggerService = loggerService;
    this.policyService = policyService;
    this.environmentMainService = environmentMainService;
    this.userDataProfilesMainService = userDataProfilesMainService;
    this.lifecycleMainService = lifecycleMainService;
    this.backupMainService = backupMainService;
    this.configurationService = configurationService;
    this.workspacesHistoryMainService = workspacesHistoryMainService;
    this.workspacesManagementMainService = workspacesManagementMainService;
    this.instantiationService = instantiationService;
    this.dialogMainService = dialogMainService;
    this.fileService = fileService;
    this.protocolMainService = protocolMainService;
    this.themeMainService = themeMainService;
    this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    this.cssDevelopmentService = cssDevelopmentService;
    this._onDidOpenWindow = this._register(new Emitter());
    this.onDidOpenWindow = this._onDidOpenWindow.event;
    this._onDidSignalReadyWindow = this._register(new Emitter());
    this.onDidSignalReadyWindow = this._onDidSignalReadyWindow.event;
    this._onDidDestroyWindow = this._register(new Emitter());
    this.onDidDestroyWindow = this._onDidDestroyWindow.event;
    this._onDidChangeWindowsCount = this._register(new Emitter());
    this.onDidChangeWindowsCount = this._onDidChangeWindowsCount.event;
    this._onDidMaximizeWindow = this._register(new Emitter());
    this.onDidMaximizeWindow = this._onDidMaximizeWindow.event;
    this._onDidUnmaximizeWindow = this._register(new Emitter());
    this.onDidUnmaximizeWindow = this._onDidUnmaximizeWindow.event;
    this._onDidChangeFullScreen = this._register(new Emitter());
    this.onDidChangeFullScreen = this._onDidChangeFullScreen.event;
    this._onDidTriggerSystemContextMenu = this._register(new Emitter());
    this.onDidTriggerSystemContextMenu = this._onDidTriggerSystemContextMenu.event;
    this.windows = /* @__PURE__ */ new Map();
    this.windowsStateHandler = this._register(new WindowsStateHandler(this, stateService, this.lifecycleMainService, this.logService, this.configurationService));
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.workspacesManagementMainService.onDidEnterWorkspace((event) => this._onDidSignalReadyWindow.fire(event.window)));
    this._register(this.onDidSignalReadyWindow((window) => {
      if (window.config?.extensionDevelopmentPath || window.config?.extensionTestsPath) {
        const disposables = new DisposableStore();
        disposables.add(Event.any(window.onDidClose, window.onDidDestroy)(() => disposables.dispose()));
        if (window.config.extensionDevelopmentPath) {
          for (const extensionDevelopmentPath of window.config.extensionDevelopmentPath) {
            disposables.add(this.protocolMainService.addValidFileRoot(extensionDevelopmentPath));
          }
        }
        if (window.config.extensionTestsPath) {
          disposables.add(this.protocolMainService.addValidFileRoot(window.config.extensionTestsPath));
        }
      }
    }));
  }
  openEmptyWindow(openConfig, options) {
    const cli = this.environmentMainService.args;
    const remoteAuthority = options?.remoteAuthority || void 0;
    const forceEmpty = true;
    const forceReuseWindow = options?.forceReuseWindow;
    const forceNewWindow = !forceReuseWindow;
    return this.open({ ...openConfig, cli, forceEmpty, forceNewWindow, forceReuseWindow, remoteAuthority, forceTempProfile: options?.forceTempProfile, forceProfile: options?.forceProfile });
  }
  openExistingWindow(window, openConfig) {
    window.focus();
    this.handleWaitMarkerFile(openConfig, [window]);
  }
  async open(openConfig) {
    this.logService.trace("windowsManager#open");
    if ((openConfig.addMode || openConfig.removeMode) && (openConfig.initialStartup || !this.getLastActiveWindow())) {
      openConfig.addMode = false;
      openConfig.removeMode = false;
    }
    const foldersToAdd = [];
    const foldersToRemove = [];
    const foldersToOpen = [];
    const workspacesToOpen = [];
    const untitledWorkspacesToRestore = [];
    const emptyWindowsWithBackupsToRestore = [];
    let filesToOpen;
    let maybeOpenEmptyWindow = false;
    const pathsToOpen = await this.getPathsToOpen(openConfig);
    this.logService.trace("windowsManager#open pathsToOpen", pathsToOpen);
    for (const path of pathsToOpen) {
      if (isSingleFolderWorkspacePathToOpen(path)) {
        if (openConfig.addMode) {
          foldersToAdd.push(path);
        } else if (openConfig.removeMode) {
          foldersToRemove.push(path);
        } else {
          foldersToOpen.push(path);
        }
      } else if (isWorkspacePathToOpen(path)) {
        workspacesToOpen.push(path);
      } else if (path.fileUri) {
        if (!filesToOpen) {
          filesToOpen = { filesToOpenOrCreate: [], filesToDiff: [], filesToMerge: [], remoteAuthority: path.remoteAuthority };
        }
        filesToOpen.filesToOpenOrCreate.push(path);
      } else if (path.backupPath) {
        emptyWindowsWithBackupsToRestore.push({ backupFolder: basename(path.backupPath), remoteAuthority: path.remoteAuthority });
      } else {
        maybeOpenEmptyWindow = true;
      }
    }
    if (openConfig.diffMode && filesToOpen && filesToOpen.filesToOpenOrCreate.length >= 2) {
      filesToOpen.filesToDiff = filesToOpen.filesToOpenOrCreate.slice(0, 2);
      filesToOpen.filesToOpenOrCreate = [];
    }
    if (openConfig.mergeMode && filesToOpen && filesToOpen.filesToOpenOrCreate.length === 4) {
      filesToOpen.filesToMerge = filesToOpen.filesToOpenOrCreate.slice(0, 4);
      filesToOpen.filesToOpenOrCreate = [];
      filesToOpen.filesToDiff = [];
    }
    if (filesToOpen && openConfig.waitMarkerFileURI) {
      filesToOpen.filesToWait = { paths: coalesce([...filesToOpen.filesToDiff, filesToOpen.filesToMerge[3], ...filesToOpen.filesToOpenOrCreate]), waitMarkerFileUri: openConfig.waitMarkerFileURI };
    }
    if (openConfig.initialStartup) {
      untitledWorkspacesToRestore.push(...this.workspacesManagementMainService.getUntitledWorkspaces());
      workspacesToOpen.push(...untitledWorkspacesToRestore);
      emptyWindowsWithBackupsToRestore.push(...this.backupMainService.getEmptyWindowBackups());
    } else {
      emptyWindowsWithBackupsToRestore.length = 0;
    }
    const { windows: usedWindows, filesOpenedInWindow } = await this.doOpen(openConfig, workspacesToOpen, foldersToOpen, emptyWindowsWithBackupsToRestore, maybeOpenEmptyWindow, filesToOpen, foldersToAdd, foldersToRemove);
    this.logService.trace(`windowsManager#open used window count ${usedWindows.length} (workspacesToOpen: ${workspacesToOpen.length}, foldersToOpen: ${foldersToOpen.length}, emptyToRestore: ${emptyWindowsWithBackupsToRestore.length}, maybeOpenEmptyWindow: ${maybeOpenEmptyWindow})`);
    if (usedWindows.length > 1) {
      if (filesOpenedInWindow) {
        filesOpenedInWindow.focus();
      } else {
        const focusLastActive = this.windowsStateHandler.state.lastActiveWindow && !openConfig.forceEmpty && !openConfig.cli._.length && !openConfig.cli["file-uri"] && !openConfig.cli["folder-uri"] && !(openConfig.urisToOpen && openConfig.urisToOpen.length);
        let focusLastOpened = true;
        let focusLastWindow = true;
        if (focusLastActive) {
          const lastActiveWindow = usedWindows.filter((window) => this.windowsStateHandler.state.lastActiveWindow && window.backupPath === this.windowsStateHandler.state.lastActiveWindow.backupPath);
          if (lastActiveWindow.length) {
            lastActiveWindow[0].focus();
            focusLastOpened = false;
            focusLastWindow = false;
          }
        }
        if (focusLastOpened) {
          for (let i = usedWindows.length - 1; i >= 0; i--) {
            const usedWindow = usedWindows[i];
            if (usedWindow.openedWorkspace && untitledWorkspacesToRestore.some((workspace) => usedWindow.openedWorkspace && workspace.workspace.id === usedWindow.openedWorkspace.id) || // skip over restored workspace
            usedWindow.backupPath && emptyWindowsWithBackupsToRestore.some((empty) => usedWindow.backupPath && empty.backupFolder === basename(usedWindow.backupPath))) {
              continue;
            }
            usedWindow.focus();
            focusLastWindow = false;
            break;
          }
        }
        if (focusLastWindow) {
          usedWindows[usedWindows.length - 1].focus();
        }
      }
    }
    const isDiff = filesToOpen && filesToOpen.filesToDiff.length > 0;
    const isMerge = filesToOpen && filesToOpen.filesToMerge.length > 0;
    if (!usedWindows.some((window) => window.isExtensionDevelopmentHost) && !isDiff && !isMerge && !openConfig.noRecentEntry) {
      const recents = [];
      for (const pathToOpen of pathsToOpen) {
        if (isWorkspacePathToOpen(pathToOpen) && !pathToOpen.transient) {
          recents.push({ label: pathToOpen.label, workspace: pathToOpen.workspace, remoteAuthority: pathToOpen.remoteAuthority });
        } else if (isSingleFolderWorkspacePathToOpen(pathToOpen)) {
          recents.push({ label: pathToOpen.label, folderUri: pathToOpen.workspace.uri, remoteAuthority: pathToOpen.remoteAuthority });
        } else if (pathToOpen.fileUri) {
          recents.push({ label: pathToOpen.label, fileUri: pathToOpen.fileUri, remoteAuthority: pathToOpen.remoteAuthority });
        }
      }
      this.workspacesHistoryMainService.addRecentlyOpened(recents);
    }
    this.handleWaitMarkerFile(openConfig, usedWindows);
    return usedWindows;
  }
  handleWaitMarkerFile(openConfig, usedWindows) {
    const waitMarkerFileURI = openConfig.waitMarkerFileURI;
    if (openConfig.context === OpenContext.CLI && waitMarkerFileURI && usedWindows.length === 1 && usedWindows[0]) {
      (async () => {
        await usedWindows[0].whenClosedOrLoaded;
        try {
          await this.fileService.del(waitMarkerFileURI);
        } catch (error) {
        }
      })();
    }
  }
  async doOpen(openConfig, workspacesToOpen, foldersToOpen, emptyToRestore, maybeOpenEmptyWindow, filesToOpen, foldersToAdd, foldersToRemove) {
    const usedWindows = [];
    let filesOpenedInWindow = void 0;
    function addUsedWindow(window, openedFiles) {
      usedWindows.push(window);
      if (openedFiles) {
        filesOpenedInWindow = window;
        filesToOpen = void 0;
      }
    }
    let { openFolderInNewWindow, openFilesInNewWindow } = this.shouldOpenNewWindow(openConfig);
    if (!openConfig.initialStartup && (foldersToAdd.length > 0 || foldersToRemove.length > 0)) {
      const authority = foldersToAdd.at(0)?.remoteAuthority ?? foldersToRemove.at(0)?.remoteAuthority;
      const lastActiveWindow = this.getLastActiveWindowForAuthority(authority);
      if (lastActiveWindow) {
        addUsedWindow(this.doAddRemoveFoldersInExistingWindow(lastActiveWindow, foldersToAdd.map((folderToAdd) => folderToAdd.workspace.uri), foldersToRemove.map((folderToRemove) => folderToRemove.workspace.uri)));
      }
    }
    const potentialNewWindowsCount = foldersToOpen.length + workspacesToOpen.length + emptyToRestore.length;
    if (filesToOpen && potentialNewWindowsCount === 0) {
      const fileToCheck = filesToOpen.filesToOpenOrCreate[0] || filesToOpen.filesToDiff[0] || filesToOpen.filesToMerge[3];
      const windows = this.getWindows().filter((window) => filesToOpen && isEqualAuthority(window.remoteAuthority, filesToOpen.remoteAuthority));
      let windowToUseForFiles = void 0;
      if (fileToCheck?.fileUri && !openFilesInNewWindow) {
        if (openConfig.context === OpenContext.DESKTOP || openConfig.context === OpenContext.CLI || openConfig.context === OpenContext.DOCK || openConfig.context === OpenContext.LINK) {
          windowToUseForFiles = await findWindowOnFile(windows, fileToCheck.fileUri, async (workspace) => workspace.configPath.scheme === Schemas.file ? this.workspacesManagementMainService.resolveLocalWorkspace(workspace.configPath) : void 0);
        }
        if (!windowToUseForFiles) {
          windowToUseForFiles = this.doGetLastActiveWindow(windows);
        }
      }
      if (windowToUseForFiles) {
        if (isWorkspaceIdentifier(windowToUseForFiles.openedWorkspace)) {
          workspacesToOpen.push({ workspace: windowToUseForFiles.openedWorkspace, remoteAuthority: windowToUseForFiles.remoteAuthority });
        } else if (isSingleFolderWorkspaceIdentifier(windowToUseForFiles.openedWorkspace)) {
          foldersToOpen.push({ workspace: windowToUseForFiles.openedWorkspace, remoteAuthority: windowToUseForFiles.remoteAuthority });
        } else {
          addUsedWindow(this.doOpenFilesInExistingWindow(openConfig, windowToUseForFiles, filesToOpen), true);
        }
      } else {
        addUsedWindow(await this.openInBrowserWindow({
          userEnv: openConfig.userEnv,
          cli: openConfig.cli,
          initialStartup: openConfig.initialStartup,
          filesToOpen,
          forceNewWindow: true,
          remoteAuthority: filesToOpen.remoteAuthority,
          forceNewTabbedWindow: openConfig.forceNewTabbedWindow,
          forceProfile: openConfig.forceProfile,
          forceTempProfile: openConfig.forceTempProfile
        }), true);
      }
    }
    const allWorkspacesToOpen = distinct(workspacesToOpen, (workspace) => workspace.workspace.id);
    if (allWorkspacesToOpen.length > 0) {
      const windowsOnWorkspace = coalesce(allWorkspacesToOpen.map((workspaceToOpen) => findWindowOnWorkspaceOrFolder(this.getWindows(), workspaceToOpen.workspace.configPath)));
      if (windowsOnWorkspace.length > 0) {
        const windowOnWorkspace = windowsOnWorkspace[0];
        const filesToOpenInWindow = isEqualAuthority(filesToOpen?.remoteAuthority, windowOnWorkspace.remoteAuthority) ? filesToOpen : void 0;
        addUsedWindow(this.doOpenFilesInExistingWindow(openConfig, windowOnWorkspace, filesToOpenInWindow), !!filesToOpenInWindow);
        openFolderInNewWindow = true;
      }
      for (const workspaceToOpen of allWorkspacesToOpen) {
        if (windowsOnWorkspace.some((window) => window.openedWorkspace && window.openedWorkspace.id === workspaceToOpen.workspace.id)) {
          continue;
        }
        const remoteAuthority = workspaceToOpen.remoteAuthority;
        const filesToOpenInWindow = isEqualAuthority(filesToOpen?.remoteAuthority, remoteAuthority) ? filesToOpen : void 0;
        addUsedWindow(await this.doOpenFolderOrWorkspace(openConfig, workspaceToOpen, openFolderInNewWindow, filesToOpenInWindow), !!filesToOpenInWindow);
        openFolderInNewWindow = true;
      }
    }
    const allFoldersToOpen = distinct(foldersToOpen, (folder) => extUriBiasedIgnorePathCase.getComparisonKey(folder.workspace.uri));
    if (allFoldersToOpen.length > 0) {
      const windowsOnFolderPath = coalesce(allFoldersToOpen.map((folderToOpen) => findWindowOnWorkspaceOrFolder(this.getWindows(), folderToOpen.workspace.uri)));
      if (windowsOnFolderPath.length > 0) {
        const windowOnFolderPath = windowsOnFolderPath[0];
        const filesToOpenInWindow = isEqualAuthority(filesToOpen?.remoteAuthority, windowOnFolderPath.remoteAuthority) ? filesToOpen : void 0;
        addUsedWindow(this.doOpenFilesInExistingWindow(openConfig, windowOnFolderPath, filesToOpenInWindow), !!filesToOpenInWindow);
        openFolderInNewWindow = true;
      }
      for (const folderToOpen of allFoldersToOpen) {
        if (windowsOnFolderPath.some((window) => isSingleFolderWorkspaceIdentifier(window.openedWorkspace) && extUriBiasedIgnorePathCase.isEqual(window.openedWorkspace.uri, folderToOpen.workspace.uri))) {
          continue;
        }
        const remoteAuthority = folderToOpen.remoteAuthority;
        const filesToOpenInWindow = isEqualAuthority(filesToOpen?.remoteAuthority, remoteAuthority) ? filesToOpen : void 0;
        addUsedWindow(await this.doOpenFolderOrWorkspace(openConfig, folderToOpen, openFolderInNewWindow, filesToOpenInWindow), !!filesToOpenInWindow);
        openFolderInNewWindow = true;
      }
    }
    const allEmptyToRestore = distinct(emptyToRestore, (info) => info.backupFolder);
    if (allEmptyToRestore.length > 0) {
      for (const emptyWindowBackupInfo of allEmptyToRestore) {
        const remoteAuthority = emptyWindowBackupInfo.remoteAuthority;
        const filesToOpenInWindow = isEqualAuthority(filesToOpen?.remoteAuthority, remoteAuthority) ? filesToOpen : void 0;
        addUsedWindow(await this.doOpenEmpty(openConfig, true, remoteAuthority, filesToOpenInWindow, emptyWindowBackupInfo), !!filesToOpenInWindow);
        openFolderInNewWindow = true;
      }
    }
    if (filesToOpen || maybeOpenEmptyWindow && (openConfig.forceEmpty || usedWindows.length === 0)) {
      const remoteAuthority = filesToOpen ? filesToOpen.remoteAuthority : openConfig.remoteAuthority;
      addUsedWindow(await this.doOpenEmpty(openConfig, openFolderInNewWindow, remoteAuthority, filesToOpen), !!filesToOpen);
    }
    return { windows: distinct(usedWindows), filesOpenedInWindow };
  }
  doOpenFilesInExistingWindow(configuration, window, filesToOpen) {
    this.logService.trace("windowsManager#doOpenFilesInExistingWindow", { filesToOpen });
    this.focusMainOrChildWindow(window);
    const params = {
      filesToOpenOrCreate: filesToOpen?.filesToOpenOrCreate,
      filesToDiff: filesToOpen?.filesToDiff,
      filesToMerge: filesToOpen?.filesToMerge,
      filesToWait: filesToOpen?.filesToWait,
      termProgram: configuration?.userEnv?.["TERM_PROGRAM"]
    };
    window.sendWhenReady("vscode:openFiles", CancellationToken.None, params);
    return window;
  }
  focusMainOrChildWindow(mainWindow) {
    let windowToFocus = mainWindow;
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow && focusedWindow.id !== mainWindow.id) {
      const auxiliaryWindowCandidate = this.auxiliaryWindowsMainService.getWindowByWebContents(focusedWindow.webContents);
      if (auxiliaryWindowCandidate && auxiliaryWindowCandidate.parentId === mainWindow.id) {
        windowToFocus = auxiliaryWindowCandidate;
      }
    }
    windowToFocus.focus();
  }
  doAddRemoveFoldersInExistingWindow(window, foldersToAdd, foldersToRemove) {
    this.logService.trace("windowsManager#doAddRemoveFoldersToExistingWindow", { foldersToAdd, foldersToRemove });
    window.focus();
    const request = { foldersToAdd, foldersToRemove };
    window.sendWhenReady("vscode:addRemoveFolders", CancellationToken.None, request);
    return window;
  }
  doOpenEmpty(openConfig, forceNewWindow, remoteAuthority, filesToOpen, emptyWindowBackupInfo) {
    this.logService.trace("windowsManager#doOpenEmpty", { restore: !!emptyWindowBackupInfo, remoteAuthority, filesToOpen, forceNewWindow });
    let windowToUse;
    if (!forceNewWindow && typeof openConfig.contextWindowId === "number") {
      windowToUse = this.getWindowById(openConfig.contextWindowId);
    }
    return this.openInBrowserWindow({
      userEnv: openConfig.userEnv,
      cli: openConfig.cli,
      initialStartup: openConfig.initialStartup,
      remoteAuthority,
      forceNewWindow,
      forceNewTabbedWindow: openConfig.forceNewTabbedWindow,
      filesToOpen,
      windowToUse,
      emptyWindowBackupInfo,
      forceProfile: openConfig.forceProfile,
      forceTempProfile: openConfig.forceTempProfile
    });
  }
  doOpenFolderOrWorkspace(openConfig, folderOrWorkspace, forceNewWindow, filesToOpen, windowToUse) {
    this.logService.trace("windowsManager#doOpenFolderOrWorkspace", { folderOrWorkspace, filesToOpen });
    if (!forceNewWindow && !windowToUse && typeof openConfig.contextWindowId === "number") {
      windowToUse = this.getWindowById(openConfig.contextWindowId);
    }
    return this.openInBrowserWindow({
      workspace: folderOrWorkspace.workspace,
      userEnv: openConfig.userEnv,
      cli: openConfig.cli,
      initialStartup: openConfig.initialStartup,
      remoteAuthority: folderOrWorkspace.remoteAuthority,
      forceNewWindow,
      forceNewTabbedWindow: openConfig.forceNewTabbedWindow,
      filesToOpen,
      windowToUse,
      forceProfile: openConfig.forceProfile,
      forceTempProfile: openConfig.forceTempProfile
    });
  }
  async getPathsToOpen(openConfig) {
    let pathsToOpen;
    let isCommandLineOrAPICall = false;
    let isRestoringPaths = false;
    if (openConfig.urisToOpen && openConfig.urisToOpen.length > 0) {
      pathsToOpen = await this.doExtractPathsFromAPI(openConfig);
      isCommandLineOrAPICall = true;
    } else if (openConfig.forceEmpty) {
      pathsToOpen = [EMPTY_WINDOW];
    } else if (openConfig.cli._.length || openConfig.cli["folder-uri"] || openConfig.cli["file-uri"]) {
      pathsToOpen = await this.doExtractPathsFromCLI(openConfig.cli);
      if (pathsToOpen.length === 0) {
        pathsToOpen.push(EMPTY_WINDOW);
      }
      isCommandLineOrAPICall = true;
    } else {
      pathsToOpen = await this.doGetPathsFromLastSession();
      if (pathsToOpen.length === 0) {
        pathsToOpen.push(EMPTY_WINDOW);
      }
      isRestoringPaths = true;
    }
    if (!openConfig.addMode && !openConfig.removeMode && isCommandLineOrAPICall) {
      const foldersToOpen = pathsToOpen.filter((path) => isSingleFolderWorkspacePathToOpen(path));
      if (foldersToOpen.length > 1) {
        const remoteAuthority = foldersToOpen[0].remoteAuthority;
        if (foldersToOpen.every((folderToOpen) => isEqualAuthority(folderToOpen.remoteAuthority, remoteAuthority))) {
          let workspace;
          const lastSessionWorkspaceMatchingFolders = await this.doGetWorkspaceMatchingFoldersFromLastSession(remoteAuthority, foldersToOpen);
          if (lastSessionWorkspaceMatchingFolders) {
            workspace = lastSessionWorkspaceMatchingFolders;
          } else {
            workspace = await this.workspacesManagementMainService.createUntitledWorkspace(foldersToOpen.map((folder) => ({ uri: folder.workspace.uri })));
          }
          pathsToOpen.push({ workspace, remoteAuthority });
          pathsToOpen = pathsToOpen.filter((path) => !isSingleFolderWorkspacePathToOpen(path));
        }
      }
    }
    if (openConfig.initialStartup && !isRestoringPaths && this.configurationService.getValue("window")?.restoreWindows === "preserve") {
      const lastSessionPaths = await this.doGetPathsFromLastSession();
      pathsToOpen.unshift(...lastSessionPaths.filter((path) => isWorkspacePathToOpen(path) || isSingleFolderWorkspacePathToOpen(path) || path.backupPath));
    }
    return pathsToOpen;
  }
  async doExtractPathsFromAPI(openConfig) {
    const pathResolveOptions = {
      gotoLineMode: openConfig.gotoLineMode,
      remoteAuthority: openConfig.remoteAuthority
    };
    const pathsToOpen = await Promise.all(coalesce(openConfig.urisToOpen || []).map(async (pathToOpen) => {
      const path = await this.resolveOpenable(pathToOpen, pathResolveOptions);
      if (path) {
        path.label = pathToOpen.label;
        return path;
      }
      const uri = this.resourceFromOpenable(pathToOpen);
      this.dialogMainService.showMessageBox({
        type: "info",
        buttons: [localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK")],
        message: uri.scheme === Schemas.file ? localize("pathNotExistTitle", "Path does not exist") : localize("uriInvalidTitle", "URI can not be opened"),
        detail: uri.scheme === Schemas.file ? localize("pathNotExistDetail", "The path '{0}' does not exist on this computer.", getPathLabel(uri, { os: OS, tildify: this.environmentMainService })) : localize("uriInvalidDetail", "The URI '{0}' is not valid and can not be opened.", uri.toString(true))
      }, BrowserWindow.getFocusedWindow() ?? void 0);
      return void 0;
    }));
    return coalesce(pathsToOpen);
  }
  async doExtractPathsFromCLI(cli) {
    const pathsToOpen = [];
    const pathResolveOptions = {
      ignoreFileNotFound: true,
      gotoLineMode: cli.goto,
      remoteAuthority: cli.remote || void 0,
      forceOpenWorkspaceAsFile: (
        // special case diff / merge mode to force open
        // workspace as file
        // https://github.com/microsoft/vscode/issues/149731
        cli.diff && cli._.length === 2 || cli.merge && cli._.length === 4
      )
    };
    const folderUris = cli["folder-uri"];
    if (folderUris) {
      const resolvedFolderUris = await Promise.all(folderUris.map((rawFolderUri) => {
        const folderUri = this.cliArgToUri(rawFolderUri);
        if (!folderUri) {
          return void 0;
        }
        return this.resolveOpenable({ folderUri }, pathResolveOptions);
      }));
      pathsToOpen.push(...coalesce(resolvedFolderUris));
    }
    const fileUris = cli["file-uri"];
    if (fileUris) {
      const resolvedFileUris = await Promise.all(fileUris.map((rawFileUri) => {
        const fileUri = this.cliArgToUri(rawFileUri);
        if (!fileUri) {
          return void 0;
        }
        return this.resolveOpenable(hasWorkspaceFileExtension(rawFileUri) ? { workspaceUri: fileUri } : { fileUri }, pathResolveOptions);
      }));
      pathsToOpen.push(...coalesce(resolvedFileUris));
    }
    const resolvedCliPaths = await Promise.all(cli._.map((cliPath) => {
      return pathResolveOptions.remoteAuthority ? this.doResolveRemotePath(cliPath, pathResolveOptions) : this.doResolveFilePath(cliPath, pathResolveOptions);
    }));
    pathsToOpen.push(...coalesce(resolvedCliPaths));
    return pathsToOpen;
  }
  cliArgToUri(arg) {
    try {
      const uri = URI.parse(arg);
      if (!uri.scheme) {
        this.logService.error(`Invalid URI input string, scheme missing: ${arg}`);
        return void 0;
      }
      if (!uri.path) {
        return uri.with({ path: "/" });
      }
      return uri;
    } catch (e) {
      this.logService.error(`Invalid URI input string: ${arg}, ${e.message}`);
    }
    return void 0;
  }
  async doGetPathsFromLastSession() {
    const restoreWindowsSetting = this.getRestoreWindowsSetting();
    switch (restoreWindowsSetting) {
      // none: no window to restore
      case "none":
        return [];
      // one: restore last opened workspace/folder or empty window
      // all: restore all windows
      // folders: restore last opened folders only
      case "one":
      case "all":
      case "preserve":
      case "folders": {
        const lastSessionWindows = [];
        if (restoreWindowsSetting !== "one") {
          lastSessionWindows.push(...this.windowsStateHandler.state.openedWindows);
        }
        if (this.windowsStateHandler.state.lastActiveWindow) {
          lastSessionWindows.push(this.windowsStateHandler.state.lastActiveWindow);
        }
        const pathsToOpen = await Promise.all(lastSessionWindows.map(async (lastSessionWindow) => {
          if (lastSessionWindow.workspace) {
            const pathToOpen = await this.resolveOpenable({ workspaceUri: lastSessionWindow.workspace.configPath }, {
              remoteAuthority: lastSessionWindow.remoteAuthority,
              rejectTransientWorkspaces: true
              /* https://github.com/microsoft/vscode/issues/119695 */
            });
            if (isWorkspacePathToOpen(pathToOpen)) {
              return pathToOpen;
            }
          } else if (lastSessionWindow.folderUri) {
            const pathToOpen = await this.resolveOpenable({ folderUri: lastSessionWindow.folderUri }, { remoteAuthority: lastSessionWindow.remoteAuthority });
            if (isSingleFolderWorkspacePathToOpen(pathToOpen)) {
              return pathToOpen;
            }
          } else if (restoreWindowsSetting !== "folders" && lastSessionWindow.backupPath) {
            return { backupPath: lastSessionWindow.backupPath, remoteAuthority: lastSessionWindow.remoteAuthority };
          }
          return void 0;
        }));
        return coalesce(pathsToOpen);
      }
    }
  }
  getRestoreWindowsSetting() {
    let restoreWindows;
    if (this.lifecycleMainService.wasRestarted) {
      restoreWindows = "all";
    } else {
      const windowConfig = this.configurationService.getValue("window");
      restoreWindows = windowConfig?.restoreWindows || "all";
      if (!["preserve", "all", "folders", "one", "none"].includes(restoreWindows)) {
        restoreWindows = "all";
      }
    }
    return restoreWindows;
  }
  async doGetWorkspaceMatchingFoldersFromLastSession(remoteAuthority, folders) {
    const workspaces = (await this.doGetPathsFromLastSession()).filter((path) => isWorkspacePathToOpen(path));
    const folderUris = folders.map((folder) => folder.workspace.uri);
    for (const { workspace } of workspaces) {
      const resolvedWorkspace = await this.workspacesManagementMainService.resolveLocalWorkspace(workspace.configPath);
      if (!resolvedWorkspace || resolvedWorkspace.remoteAuthority !== remoteAuthority || resolvedWorkspace.transient || resolvedWorkspace.folders.length !== folders.length) {
        continue;
      }
      const folderSet = new ResourceSet(folderUris, (uri) => extUriBiasedIgnorePathCase.getComparisonKey(uri));
      if (resolvedWorkspace.folders.every((folder) => folderSet.has(folder.uri))) {
        return resolvedWorkspace;
      }
    }
    return void 0;
  }
  async resolveOpenable(openable, options = /* @__PURE__ */ Object.create(null)) {
    const uri = this.resourceFromOpenable(openable);
    if (uri.scheme === Schemas.file) {
      if (isFileToOpen(openable)) {
        options = { ...options, forceOpenWorkspaceAsFile: true };
      }
      return this.doResolveFilePath(uri.fsPath, options);
    }
    return this.doResolveRemoteOpenable(openable, options);
  }
  doResolveRemoteOpenable(openable, options) {
    let uri = this.resourceFromOpenable(openable);
    const remoteAuthority = getRemoteAuthority(uri) || options.remoteAuthority;
    uri = removeTrailingPathSeparator(normalizePath(uri));
    if (isFileToOpen(openable)) {
      if (options.gotoLineMode) {
        const { path, line, column } = parseLineAndColumnAware(uri.path);
        return {
          fileUri: uri.with({ path }),
          options: {
            selection: line ? { startLineNumber: line, startColumn: column || 1 } : void 0
          },
          remoteAuthority
        };
      }
      return { fileUri: uri, remoteAuthority };
    } else if (isWorkspaceToOpen(openable)) {
      return { workspace: getWorkspaceIdentifier(uri), remoteAuthority };
    }
    return { workspace: getSingleFolderWorkspaceIdentifier(uri), remoteAuthority };
  }
  resourceFromOpenable(openable) {
    if (isWorkspaceToOpen(openable)) {
      return openable.workspaceUri;
    }
    if (isFolderToOpen(openable)) {
      return openable.folderUri;
    }
    return openable.fileUri;
  }
  async doResolveFilePath(path, options, skipHandleUNCError) {
    let lineNumber;
    let columnNumber;
    if (options.gotoLineMode) {
      ({ path, line: lineNumber, column: columnNumber } = parseLineAndColumnAware(path));
    }
    path = sanitizeFilePath(normalize(path), cwd());
    try {
      const pathStat = await fs.promises.stat(path);
      if (pathStat.isFile()) {
        if (!options.forceOpenWorkspaceAsFile) {
          const workspace = await this.workspacesManagementMainService.resolveLocalWorkspace(URI.file(path));
          if (workspace) {
            if (workspace.transient && options.rejectTransientWorkspaces) {
              return void 0;
            }
            return {
              workspace: { id: workspace.id, configPath: workspace.configPath },
              type: FileType.File,
              exists: true,
              remoteAuthority: workspace.remoteAuthority,
              transient: workspace.transient
            };
          }
        }
        return {
          fileUri: URI.file(path),
          type: FileType.File,
          exists: true,
          options: {
            selection: lineNumber ? { startLineNumber: lineNumber, startColumn: columnNumber || 1 } : void 0
          }
        };
      } else if (pathStat.isDirectory()) {
        return {
          workspace: getSingleFolderWorkspaceIdentifier(URI.file(path), pathStat),
          type: FileType.Directory,
          exists: true
        };
      } else if (!isWindows && path === "/dev/null") {
        return {
          fileUri: URI.file(path),
          type: FileType.File,
          exists: true
        };
      }
    } catch (error) {
      if (error.code === "ERR_UNC_HOST_NOT_ALLOWED" && !skipHandleUNCError) {
        return this.onUNCHostNotAllowed(path, options);
      }
      const fileUri = URI.file(path);
      this.workspacesHistoryMainService.removeRecentlyOpened([fileUri]);
      if (options.ignoreFileNotFound && error.code === "ENOENT") {
        return {
          fileUri,
          type: FileType.File,
          exists: false
        };
      }
      this.logService.error(`Invalid path provided: ${path}, ${error.message}`);
    }
    return void 0;
  }
  async onUNCHostNotAllowed(path, options) {
    const uri = URI.file(path);
    const { response, checkboxChecked } = await this.dialogMainService.showMessageBox({
      type: "warning",
      buttons: [
        localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
        localize({ key: "cancel", comment: ["&& denotes a mnemonic"] }, "&&Cancel"),
        localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More")
      ],
      message: localize("confirmOpenMessage", "The host '{0}' was not found in the list of allowed hosts. Do you want to allow it anyway?", uri.authority),
      detail: localize("confirmOpenDetail", "The path '{0}' uses a host that is not allowed. Unless you trust the host, you should press 'Cancel'", getPathLabel(uri, { os: OS, tildify: this.environmentMainService })),
      checkboxLabel: localize("doNotAskAgain", "Permanently allow host '{0}'", uri.authority),
      cancelId: 1
    });
    if (response === 0) {
      addUNCHostToAllowlist(uri.authority);
      if (checkboxChecked) {
        const request = { channel: "vscode:configureAllowedUNCHost", args: uri.authority };
        this.sendToFocused(request.channel, request.args);
        this.sendToOpeningWindow(request.channel, request.args);
      }
      return this.doResolveFilePath(
        path,
        options,
        true
        /* do not handle UNC error again */
      );
    }
    if (response === 2) {
      shell.openExternal("https://aka.ms/vscode-windows-unc");
      return this.onUNCHostNotAllowed(path, options);
    }
    return void 0;
  }
  doResolveRemotePath(path, options) {
    const first = path.charCodeAt(0);
    const remoteAuthority = options.remoteAuthority;
    let lineNumber;
    let columnNumber;
    if (options.gotoLineMode) {
      ({ path, line: lineNumber, column: columnNumber } = parseLineAndColumnAware(path));
    }
    if (first !== CharCode.Slash) {
      if (isWindowsDriveLetter(first) && path.charCodeAt(path.charCodeAt(1)) === CharCode.Colon) {
        path = toSlashes(path);
      }
      path = `/${path}`;
    }
    const uri = URI.from({ scheme: Schemas.vscodeRemote, authority: remoteAuthority, path });
    if (path.charCodeAt(path.length - 1) !== CharCode.Slash) {
      if (hasWorkspaceFileExtension(path)) {
        if (options.forceOpenWorkspaceAsFile) {
          return {
            fileUri: uri,
            options: {
              selection: lineNumber ? { startLineNumber: lineNumber, startColumn: columnNumber || 1 } : void 0
            },
            remoteAuthority: options.remoteAuthority
          };
        }
        return { workspace: getWorkspaceIdentifier(uri), remoteAuthority };
      } else if (options.gotoLineMode || posix.basename(path).indexOf(".") !== -1) {
        return {
          fileUri: uri,
          options: {
            selection: lineNumber ? { startLineNumber: lineNumber, startColumn: columnNumber || 1 } : void 0
          },
          remoteAuthority
        };
      }
    }
    return { workspace: getSingleFolderWorkspaceIdentifier(uri), remoteAuthority };
  }
  shouldOpenNewWindow(openConfig) {
    const windowConfig = this.configurationService.getValue("window");
    const openFolderInNewWindowConfig = windowConfig?.openFoldersInNewWindow || "default";
    const openFilesInNewWindowConfig = windowConfig?.openFilesInNewWindow || "off";
    let openFolderInNewWindow = (openConfig.preferNewWindow || openConfig.forceNewWindow) && !openConfig.forceReuseWindow;
    if (!openConfig.forceNewWindow && !openConfig.forceReuseWindow && (openFolderInNewWindowConfig === "on" || openFolderInNewWindowConfig === "off")) {
      openFolderInNewWindow = openFolderInNewWindowConfig === "on";
    }
    let openFilesInNewWindow = false;
    if (openConfig.forceNewWindow || openConfig.forceReuseWindow) {
      openFilesInNewWindow = !!openConfig.forceNewWindow && !openConfig.forceReuseWindow;
    } else {
      if (isMacintosh) {
        if (openConfig.context === OpenContext.DOCK) {
          openFilesInNewWindow = true;
        }
      } else {
        if (openConfig.context !== OpenContext.DIALOG && openConfig.context !== OpenContext.MENU && !(openConfig.userEnv && openConfig.userEnv["TERM_PROGRAM"] === "vscode")) {
          openFilesInNewWindow = true;
        }
      }
      if (!openConfig.cli.extensionDevelopmentPath && (openFilesInNewWindowConfig === "on" || openFilesInNewWindowConfig === "off")) {
        openFilesInNewWindow = openFilesInNewWindowConfig === "on";
      }
    }
    return { openFolderInNewWindow: !!openFolderInNewWindow, openFilesInNewWindow };
  }
  async openExtensionDevelopmentHostWindow(extensionDevelopmentPaths, openConfig) {
    const existingWindow = findWindowOnExtensionDevelopmentPath(this.getWindows(), extensionDevelopmentPaths);
    if (existingWindow) {
      this.lifecycleMainService.reload(existingWindow, openConfig.cli);
      existingWindow.focus();
      return [existingWindow];
    }
    let folderUris = openConfig.cli["folder-uri"] || [];
    let fileUris = openConfig.cli["file-uri"] || [];
    let cliArgs = openConfig.cli._;
    if (!cliArgs.length && !folderUris.length && !fileUris.length && !openConfig.cli.extensionTestsPath) {
      const extensionDevelopmentWindowState = this.windowsStateHandler.state.lastPluginDevelopmentHostWindow;
      const workspaceToOpen = extensionDevelopmentWindowState?.workspace ?? extensionDevelopmentWindowState?.folderUri;
      if (workspaceToOpen) {
        if (URI.isUri(workspaceToOpen)) {
          if (workspaceToOpen.scheme === Schemas.file) {
            cliArgs = [workspaceToOpen.fsPath];
          } else {
            folderUris = [workspaceToOpen.toString()];
          }
        } else {
          if (workspaceToOpen.configPath.scheme === Schemas.file) {
            cliArgs = [originalFSPath(workspaceToOpen.configPath)];
          } else {
            fileUris = [workspaceToOpen.configPath.toString()];
          }
        }
      }
    }
    let remoteAuthority = openConfig.remoteAuthority;
    for (const extensionDevelopmentPath of extensionDevelopmentPaths) {
      if (extensionDevelopmentPath.match(/^[a-zA-Z][a-zA-Z0-9\+\-\.]+:/)) {
        const url = URI.parse(extensionDevelopmentPath);
        const extensionDevelopmentPathRemoteAuthority = getRemoteAuthority(url);
        if (extensionDevelopmentPathRemoteAuthority) {
          if (remoteAuthority) {
            if (!isEqualAuthority(extensionDevelopmentPathRemoteAuthority, remoteAuthority)) {
              this.logService.error("more than one extension development path authority");
            }
          } else {
            remoteAuthority = extensionDevelopmentPathRemoteAuthority;
          }
        }
      }
    }
    cliArgs = cliArgs.filter((path) => {
      const uri = URI.file(path);
      if (!!findWindowOnWorkspaceOrFolder(this.getWindows(), uri)) {
        return false;
      }
      return isEqualAuthority(getRemoteAuthority(uri), remoteAuthority);
    });
    folderUris = folderUris.filter((folderUriStr) => {
      const folderUri = this.cliArgToUri(folderUriStr);
      if (folderUri && !!findWindowOnWorkspaceOrFolder(this.getWindows(), folderUri)) {
        return false;
      }
      return folderUri ? isEqualAuthority(getRemoteAuthority(folderUri), remoteAuthority) : false;
    });
    fileUris = fileUris.filter((fileUriStr) => {
      const fileUri = this.cliArgToUri(fileUriStr);
      if (fileUri && !!findWindowOnWorkspaceOrFolder(this.getWindows(), fileUri)) {
        return false;
      }
      return fileUri ? isEqualAuthority(getRemoteAuthority(fileUri), remoteAuthority) : false;
    });
    openConfig.cli._ = cliArgs;
    openConfig.cli["folder-uri"] = folderUris;
    openConfig.cli["file-uri"] = fileUris;
    const openArgs = {
      context: openConfig.context,
      cli: openConfig.cli,
      forceNewWindow: true,
      forceEmpty: !cliArgs.length && !folderUris.length && !fileUris.length,
      userEnv: openConfig.userEnv,
      noRecentEntry: true,
      waitMarkerFileURI: openConfig.waitMarkerFileURI,
      remoteAuthority,
      forceProfile: openConfig.forceProfile,
      forceTempProfile: openConfig.forceTempProfile
    };
    return this.open(openArgs);
  }
  async openInBrowserWindow(options) {
    const windowConfig = this.configurationService.getValue("window");
    const lastActiveWindow = this.getLastActiveWindow();
    const newWindowProfile = windowConfig?.newWindowProfile ? this.userDataProfilesMainService.profiles.find((profile) => profile.name === windowConfig.newWindowProfile) : void 0;
    const defaultProfile = newWindowProfile ?? lastActiveWindow?.profile ?? this.userDataProfilesMainService.defaultProfile;
    let window;
    if (!options.forceNewWindow && !options.forceNewTabbedWindow) {
      window = options.windowToUse || lastActiveWindow;
      if (window) {
        window.focus();
      }
    }
    const configuration = {
      // Inherit CLI arguments from environment and/or
      // the specific properties from this launch if provided
      ...this.environmentMainService.args,
      ...options.cli,
      machineId: this.machineId,
      sqmId: this.sqmId,
      devDeviceId: this.devDeviceId,
      windowId: -1,
      // Will be filled in by the window once loaded later
      mainPid: process.pid,
      appRoot: this.environmentMainService.appRoot,
      execPath: process.execPath,
      codeCachePath: this.environmentMainService.codeCachePath,
      // If we know the backup folder upfront (for empty windows to restore), we can set it
      // directly here which helps for restoring UI state associated with that window.
      // For all other cases we first call into registerEmptyWindowBackup() to set it before
      // loading the window.
      backupPath: options.emptyWindowBackupInfo ? join(this.environmentMainService.backupHome, options.emptyWindowBackupInfo.backupFolder) : void 0,
      profiles: {
        home: this.userDataProfilesMainService.profilesHome,
        all: this.userDataProfilesMainService.profiles,
        // Set to default profile first and resolve and update the profile
        // only after the workspace-backup is registered.
        // Because, workspace identifier of an empty window is known only then.
        profile: defaultProfile
      },
      homeDir: this.environmentMainService.userHome.with({ scheme: Schemas.file }).fsPath,
      tmpDir: this.environmentMainService.tmpDir.with({ scheme: Schemas.file }).fsPath,
      userDataDir: this.environmentMainService.userDataPath,
      remoteAuthority: options.remoteAuthority,
      workspace: options.workspace,
      userEnv: { ...this.initialUserEnv, ...options.userEnv },
      nls: {
        messages: getNLSMessages(),
        language: getNLSLanguage()
      },
      filesToOpenOrCreate: options.filesToOpen?.filesToOpenOrCreate,
      filesToDiff: options.filesToOpen?.filesToDiff,
      filesToMerge: options.filesToOpen?.filesToMerge,
      filesToWait: options.filesToOpen?.filesToWait,
      logLevel: this.loggerService.getLogLevel(),
      loggers: this.loggerService.getGlobalLoggers(),
      logsPath: this.environmentMainService.logsHome.with({ scheme: Schemas.file }).fsPath,
      product,
      isInitialStartup: options.initialStartup,
      perfMarks: getMarks(),
      os: { release: release(), hostname: hostname(), arch: arch() },
      autoDetectHighContrast: windowConfig?.autoDetectHighContrast ?? true,
      autoDetectColorScheme: windowConfig?.autoDetectColorScheme ?? false,
      accessibilitySupport: app.accessibilitySupportEnabled,
      colorScheme: this.themeMainService.getColorScheme(),
      policiesData: this.policyService.serialize(),
      continueOn: this.environmentMainService.continueOn,
      cssModules: this.cssDevelopmentService.isEnabled ? await this.cssDevelopmentService.getCssModules() : void 0
    };
    if (!window) {
      const state = this.windowsStateHandler.getNewWindowState(configuration);
      mark("code/willCreateCodeWindow");
      const createdWindow = window = this.instantiationService.createInstance(CodeWindow, {
        state,
        extensionDevelopmentPath: configuration.extensionDevelopmentPath,
        isExtensionTestHost: !!configuration.extensionTestsPath
      });
      mark("code/didCreateCodeWindow");
      if (options.forceNewTabbedWindow) {
        const activeWindow = this.getLastActiveWindow();
        activeWindow?.addTabbedWindow(createdWindow);
      }
      this.windows.set(createdWindow.id, createdWindow);
      this._onDidOpenWindow.fire(createdWindow);
      this._onDidChangeWindowsCount.fire({ oldCount: this.getWindowCount() - 1, newCount: this.getWindowCount() });
      const disposables = new DisposableStore();
      disposables.add(createdWindow.onDidSignalReady(() => this._onDidSignalReadyWindow.fire(createdWindow)));
      disposables.add(Event.once(createdWindow.onDidClose)(() => this.onWindowClosed(createdWindow, disposables)));
      disposables.add(Event.once(createdWindow.onDidDestroy)(() => this.onWindowDestroyed(createdWindow)));
      disposables.add(createdWindow.onDidMaximize(() => this._onDidMaximizeWindow.fire(createdWindow)));
      disposables.add(createdWindow.onDidUnmaximize(() => this._onDidUnmaximizeWindow.fire(createdWindow)));
      disposables.add(createdWindow.onDidEnterFullScreen(() => this._onDidChangeFullScreen.fire({ window: createdWindow, fullscreen: true })));
      disposables.add(createdWindow.onDidLeaveFullScreen(() => this._onDidChangeFullScreen.fire({ window: createdWindow, fullscreen: false })));
      disposables.add(createdWindow.onDidTriggerSystemContextMenu(({ x, y }) => this._onDidTriggerSystemContextMenu.fire({ window: createdWindow, x, y })));
      const webContents = assertIsDefined(createdWindow.win?.webContents);
      webContents.removeAllListeners("devtools-reload-page");
      disposables.add(Event.fromNodeEventEmitter(webContents, "devtools-reload-page")(() => this.lifecycleMainService.reload(createdWindow)));
      this.lifecycleMainService.registerWindow(createdWindow);
    } else {
      const currentWindowConfig = window.config;
      if (!configuration.extensionDevelopmentPath && currentWindowConfig?.extensionDevelopmentPath) {
        configuration.extensionDevelopmentPath = currentWindowConfig.extensionDevelopmentPath;
        configuration.extensionDevelopmentKind = currentWindowConfig.extensionDevelopmentKind;
        configuration["enable-proposed-api"] = currentWindowConfig["enable-proposed-api"];
        configuration.verbose = currentWindowConfig.verbose;
        configuration["inspect-extensions"] = currentWindowConfig["inspect-extensions"];
        configuration["inspect-brk-extensions"] = currentWindowConfig["inspect-brk-extensions"];
        configuration.debugId = currentWindowConfig.debugId;
        configuration.extensionEnvironment = currentWindowConfig.extensionEnvironment;
        configuration["extensions-dir"] = currentWindowConfig["extensions-dir"];
        configuration["disable-extensions"] = currentWindowConfig["disable-extensions"];
        configuration["disable-extension"] = currentWindowConfig["disable-extension"];
      }
      configuration.loggers = configuration.loggers;
    }
    configuration.windowId = window.id;
    if (window.isReady) {
      this.lifecycleMainService.unload(window, UnloadReason.LOAD).then(async (veto) => {
        if (!veto) {
          await this.doOpenInBrowserWindow(window, configuration, options, defaultProfile);
        }
      });
    } else {
      await this.doOpenInBrowserWindow(window, configuration, options, defaultProfile);
    }
    return window;
  }
  async doOpenInBrowserWindow(window, configuration, options, defaultProfile) {
    if (!configuration.extensionDevelopmentPath) {
      if (isWorkspaceIdentifier(configuration.workspace)) {
        configuration.backupPath = this.backupMainService.registerWorkspaceBackup({
          workspace: configuration.workspace,
          remoteAuthority: configuration.remoteAuthority
        });
      } else if (isSingleFolderWorkspaceIdentifier(configuration.workspace)) {
        configuration.backupPath = this.backupMainService.registerFolderBackup({
          folderUri: configuration.workspace.uri,
          remoteAuthority: configuration.remoteAuthority
        });
      } else {
        configuration.backupPath = this.backupMainService.registerEmptyWindowBackup({
          backupFolder: options.emptyWindowBackupInfo?.backupFolder ?? createEmptyWorkspaceIdentifier().id,
          remoteAuthority: configuration.remoteAuthority
        });
      }
    }
    const workspace = configuration.workspace ?? toWorkspaceIdentifier(configuration.backupPath, false);
    const profilePromise = this.resolveProfileForBrowserWindow(options, workspace, defaultProfile);
    const profile = profilePromise instanceof Promise ? await profilePromise : profilePromise;
    configuration.profiles.profile = profile;
    if (!configuration.extensionDevelopmentPath) {
      await this.userDataProfilesMainService.setProfileForWorkspace(workspace, profile);
    }
    window.load(configuration);
  }
  resolveProfileForBrowserWindow(options, workspace, defaultProfile) {
    if (options.forceProfile) {
      return this.userDataProfilesMainService.profiles.find((p) => p.name === options.forceProfile) ?? this.userDataProfilesMainService.createNamedProfile(options.forceProfile);
    }
    if (options.forceTempProfile) {
      return this.userDataProfilesMainService.createTransientProfile();
    }
    return this.userDataProfilesMainService.getProfileForWorkspace(workspace) ?? defaultProfile;
  }
  onWindowClosed(window, disposables) {
    this.windows.delete(window.id);
    this._onDidChangeWindowsCount.fire({ oldCount: this.getWindowCount() + 1, newCount: this.getWindowCount() });
    disposables.dispose();
  }
  onWindowDestroyed(window) {
    this.windows.delete(window.id);
    this._onDidDestroyWindow.fire(window);
  }
  getFocusedWindow() {
    const window = BrowserWindow.getFocusedWindow();
    if (window) {
      return this.getWindowById(window.id);
    }
    return void 0;
  }
  getLastActiveWindow() {
    return this.doGetLastActiveWindow(this.getWindows());
  }
  getLastActiveWindowForAuthority(remoteAuthority) {
    return this.doGetLastActiveWindow(this.getWindows().filter((window) => isEqualAuthority(window.remoteAuthority, remoteAuthority)));
  }
  doGetLastActiveWindow(windows) {
    return getLastFocused(windows);
  }
  sendToFocused(channel, ...args) {
    const focusedWindow = this.getFocusedWindow() || this.getLastActiveWindow();
    focusedWindow?.sendWhenReady(channel, CancellationToken.None, ...args);
  }
  sendToOpeningWindow(channel, ...args) {
    this._register(Event.once(this.onDidSignalReadyWindow)((window) => {
      window.sendWhenReady(channel, CancellationToken.None, ...args);
    }));
  }
  sendToAll(channel, payload, windowIdsToIgnore) {
    for (const window of this.getWindows()) {
      if (windowIdsToIgnore && windowIdsToIgnore.indexOf(window.id) >= 0) {
        continue;
      }
      window.sendWhenReady(channel, CancellationToken.None, payload);
    }
  }
  getWindows() {
    return Array.from(this.windows.values());
  }
  getWindowCount() {
    return this.windows.size;
  }
  getWindowById(windowId) {
    return this.windows.get(windowId);
  }
  getWindowByWebContents(webContents) {
    const browserWindow = BrowserWindow.fromWebContents(webContents);
    if (!browserWindow) {
      return void 0;
    }
    const window = this.getWindowById(browserWindow.id);
    return window?.matches(webContents) ? window : void 0;
  }
};
WindowsMainService = __decorateClass([
  __decorateParam(4, ILogService),
  __decorateParam(5, ILoggerMainService),
  __decorateParam(6, IStateService),
  __decorateParam(7, IPolicyService),
  __decorateParam(8, IEnvironmentMainService),
  __decorateParam(9, IUserDataProfilesMainService),
  __decorateParam(10, ILifecycleMainService),
  __decorateParam(11, IBackupMainService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkspacesHistoryMainService),
  __decorateParam(14, IWorkspacesManagementMainService),
  __decorateParam(15, IInstantiationService),
  __decorateParam(16, IDialogMainService),
  __decorateParam(17, IFileService),
  __decorateParam(18, IProtocolMainService),
  __decorateParam(19, IThemeMainService),
  __decorateParam(20, IAuxiliaryWindowsMainService),
  __decorateParam(21, ICSSDevelopmentService)
], WindowsMainService);
export {
  WindowsMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93aW5kb3dzL2VsZWN0cm9uLW1haW4vd2luZG93c01haW5TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgYXBwLCBCcm93c2VyV2luZG93LCBXZWJDb250ZW50cywgc2hlbGwgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgeyBhZGRVTkNIb3N0VG9BbGxvd2xpc3QgfSBmcm9tICcuLi8uLi8uLi9iYXNlL25vZGUvdW5jLmpzJztcbmltcG9ydCB7IGhvc3RuYW1lLCByZWxlYXNlLCBhcmNoIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgY29hbGVzY2UsIGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENoYXJDb2RlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3NEcml2ZUxldHRlciwgcGFyc2VMaW5lQW5kQ29sdW1uQXdhcmUsIHNhbml0aXplRmlsZVBhdGgsIHRvU2xhc2hlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgZ2V0UGF0aExhYmVsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGpvaW4sIG5vcm1hbGl6ZSwgcG9zaXggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IGdldE1hcmtzLCBtYXJrIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGVyZm9ybWFuY2UuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cywgT1MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBjd2QgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLCBpc0VxdWFsQXV0aG9yaXR5LCBub3JtYWxpemVQYXRoLCBvcmlnaW5hbEZTUGF0aCwgcmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZXROTFNMYW5ndWFnZSwgZ2V0TkxTTWVzc2FnZXMsIGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElCYWNrdXBNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2JhY2t1cC9lbGVjdHJvbi1tYWluL2JhY2t1cC5qcyc7XG5pbXBvcnQgeyBJRW1wdHlXaW5kb3dCYWNrdXBJbmZvIH0gZnJvbSAnLi4vLi4vYmFja3VwL25vZGUvYmFja3VwLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGlhbG9ncy9lbGVjdHJvbi1tYWluL2RpYWxvZ01haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5hdGl2ZVBhcnNlZEFyZ3MgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vYXJndi5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGaWxlVHlwZSwgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2VsZWN0cm9uLW1haW4vbGlmZWN5Y2xlTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElQcm90b2NvbE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvdG9jb2wvZWxlY3Ryb24tbWFpbi9wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBnZXRSZW1vdGVBdXRob3JpdHkgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IElTdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zdGF0ZS9ub2RlL3N0YXRlLmpzJztcbmltcG9ydCB7IElBZGRSZW1vdmVGb2xkZXJzUmVxdWVzdCwgSU5hdGl2ZU9wZW5GaWxlUmVxdWVzdCwgSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24sIElPcGVuRW1wdHlXaW5kb3dPcHRpb25zLCBJUGF0aCwgSVBhdGhzVG9XYWl0Rm9yLCBpc0ZpbGVUb09wZW4sIGlzRm9sZGVyVG9PcGVuLCBpc1dvcmtzcGFjZVRvT3BlbiwgSVdpbmRvd09wZW5hYmxlLCBJV2luZG93U2V0dGluZ3MgfSBmcm9tICcuLi8uLi93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBDb2RlV2luZG93IH0gZnJvbSAnLi93aW5kb3dJbXBsLmpzJztcbmltcG9ydCB7IElPcGVuQ29uZmlndXJhdGlvbiwgSU9wZW5FbXB0eUNvbmZpZ3VyYXRpb24sIElXaW5kb3dzQ291bnRDaGFuZ2VkRXZlbnQsIElXaW5kb3dzTWFpblNlcnZpY2UsIE9wZW5Db250ZXh0LCBnZXRMYXN0Rm9jdXNlZCB9IGZyb20gJy4vd2luZG93cy5qcyc7XG5pbXBvcnQgeyBmaW5kV2luZG93T25FeHRlbnNpb25EZXZlbG9wbWVudFBhdGgsIGZpbmRXaW5kb3dPbkZpbGUsIGZpbmRXaW5kb3dPbldvcmtzcGFjZU9yRm9sZGVyIH0gZnJvbSAnLi93aW5kb3dzRmluZGVyLmpzJztcbmltcG9ydCB7IElXaW5kb3dTdGF0ZSwgV2luZG93c1N0YXRlSGFuZGxlciB9IGZyb20gJy4vd2luZG93c1N0YXRlSGFuZGxlci5qcyc7XG5pbXBvcnQgeyBJUmVjZW50IH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBoYXNXb3Jrc3BhY2VGaWxlRXh0ZW5zaW9uLCBJQW55V29ya3NwYWNlSWRlbnRpZmllciwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlSWRlbnRpZmllciwgdG9Xb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlRW1wdHlXb3Jrc3BhY2VJZGVudGlmaWVyLCBnZXRTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBnZXRXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlcy9ub2RlL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi93b3Jrc3BhY2VzL2VsZWN0cm9uLW1haW4vd29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3dvcmtzcGFjZXMvZWxlY3Ryb24tbWFpbi93b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb2RlV2luZG93LCBVbmxvYWRSZWFzb24gfSBmcm9tICcuLi8uLi93aW5kb3cvZWxlY3Ryb24tbWFpbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSVRoZW1lTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi90aGVtZS9lbGVjdHJvbi1tYWluL3RoZW1lTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMsIElUZXh0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uL3BvbGljeS9jb21tb24vcG9saWN5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvZWxlY3Ryb24tbWFpbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUxvZ2dlck1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2VsZWN0cm9uLW1haW4vbG9nZ2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQXV4aWxpYXJ5V2luZG93c01haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYXV4aWxpYXJ5V2luZG93L2VsZWN0cm9uLW1haW4vYXV4aWxpYXJ5V2luZG93cy5qcyc7XG5pbXBvcnQgeyBJQXV4aWxpYXJ5V2luZG93IH0gZnJvbSAnLi4vLi4vYXV4aWxpYXJ5V2luZG93L2VsZWN0cm9uLW1haW4vYXV4aWxpYXJ5V2luZG93LmpzJztcbmltcG9ydCB7IElDU1NEZXZlbG9wbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jc3NEZXYvbm9kZS9jc3NEZXZTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcblxuLy8jcmVnaW9uIEhlbHBlciBJbnRlcmZhY2VzXG5cbnR5cGUgUmVzdG9yZVdpbmRvd3NTZXR0aW5nID0gJ3ByZXNlcnZlJyB8ICdhbGwnIHwgJ2ZvbGRlcnMnIHwgJ29uZScgfCAnbm9uZSc7XG5cbmludGVyZmFjZSBJT3BlbkJyb3dzZXJXaW5kb3dPcHRpb25zIHtcblx0cmVhZG9ubHkgdXNlckVudj86IElQcm9jZXNzRW52aXJvbm1lbnQ7XG5cdHJlYWRvbmx5IGNsaT86IE5hdGl2ZVBhcnNlZEFyZ3M7XG5cblx0cmVhZG9ubHkgd29ya3NwYWNlPzogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcjtcblxuXHRyZWFkb25seSByZW1vdGVBdXRob3JpdHk/OiBzdHJpbmc7XG5cblx0cmVhZG9ubHkgaW5pdGlhbFN0YXJ0dXA/OiBib29sZWFuO1xuXG5cdHJlYWRvbmx5IGZpbGVzVG9PcGVuPzogSUZpbGVzVG9PcGVuO1xuXG5cdHJlYWRvbmx5IGZvcmNlTmV3V2luZG93PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgZm9yY2VOZXdUYWJiZWRXaW5kb3c/OiBib29sZWFuO1xuXHRyZWFkb25seSB3aW5kb3dUb1VzZT86IElDb2RlV2luZG93O1xuXG5cdHJlYWRvbmx5IGVtcHR5V2luZG93QmFja3VwSW5mbz86IElFbXB0eVdpbmRvd0JhY2t1cEluZm87XG5cdHJlYWRvbmx5IGZvcmNlUHJvZmlsZT86IHN0cmluZztcblx0cmVhZG9ubHkgZm9yY2VUZW1wUHJvZmlsZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJUGF0aFJlc29sdmVPcHRpb25zIHtcblxuXHQvKipcblx0ICogQnkgZGVmYXVsdCwgcmVzb2x2aW5nIGEgcGF0aCB3aWxsIGNoZWNrXG5cdCAqIGlmIHRoZSBwYXRoIGV4aXN0cy4gVGhpcyBjYW4gYmUgZGlzYWJsZWRcblx0ICogd2l0aCB0aGlzIGZsYWcuXG5cdCAqL1xuXHRyZWFkb25seSBpZ25vcmVGaWxlTm90Rm91bmQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaWxsIHJlamVjdCBhIHBhdGggaWYgaXQgcG9pbnRzIHRvIGEgdHJhbnNpZW50XG5cdCAqIHdvcmtzcGFjZSBhcyBpbmRpY2F0ZWQgYnkgYSBgdHJhbnNpZW50OiB0cnVlYFxuXHQgKiBwcm9wZXJ0eSBpbiB0aGUgd29ya3NwYWNlIGZpbGUuXG5cdCAqL1xuXHRyZWFkb25seSByZWplY3RUcmFuc2llbnRXb3Jrc3BhY2VzPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogSWYgZW5hYmxlZCwgd2lsbCByZXNvbHZlIHRoZSBwYXRoIGxpbmUvY29sdW1uXG5cdCAqIGF3YXJlIGFuZCBwcm9wZXJseSByZW1vdmUgdGhpcyBpbmZvcm1hdGlvblxuXHQgKiBmcm9tIHRoZSByZXN1bHRpbmcgZmlsZSBwYXRoLlxuXHQgKi9cblx0cmVhZG9ubHkgZ290b0xpbmVNb2RlPzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRm9yY2VzIHRvIHJlc29sdmUgdGhlIHByb3ZpZGVkIHBhdGggYXMgd29ya3NwYWNlXG5cdCAqIGZpbGUgaW5zdGVhZCBvZiBvcGVuaW5nIGl0IGFzIGEgZmlsZS5cblx0ICovXG5cdHJlYWRvbmx5IGZvcmNlT3BlbldvcmtzcGFjZUFzRmlsZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoZSByZW1vdGVBdXRob3JpdHkgdG8gdXNlIGlmIHRoZSBVUkwgdG8gb3BlbiBpc1xuXHQgKiBuZWl0aGVyIGBmaWxlYCBub3IgYHZzY29kZS1yZW1vdGVgLlxuXHQgKi9cblx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgSUZpbGVzVG9PcGVuIHtcblx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nO1xuXG5cdGZpbGVzVG9PcGVuT3JDcmVhdGU6IElQYXRoW107XG5cdGZpbGVzVG9EaWZmOiBJUGF0aFtdO1xuXHRmaWxlc1RvTWVyZ2U6IElQYXRoW107XG5cblx0ZmlsZXNUb1dhaXQ/OiBJUGF0aHNUb1dhaXRGb3I7XG59XG5cbmludGVyZmFjZSBJUGF0aFRvT3BlbjxUID0gSUVkaXRvck9wdGlvbnM+IGV4dGVuZHMgSVBhdGg8VD4ge1xuXG5cdC8qKlxuXHQgKiBUaGUgd29ya3NwYWNlIHRvIG9wZW5cblx0ICovXG5cdHJlYWRvbmx5IHdvcmtzcGFjZT86IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXI7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHBhdGggaXMgY29uc2lkZXJlZCB0byBiZSB0cmFuc2llbnQgb3Igbm90XG5cdCAqIGZvciBleGFtcGxlLCBhIHRyYW5zaWVudCB3b3Jrc3BhY2Ugc2hvdWxkIG5vdCBhZGQgdG9cblx0ICogdGhlIHdvcmtzcGFjZXMgaGlzdG9yeSBhbmQgc2hvdWxkIG5ldmVyIHJlc3RvcmUuXG5cdCAqL1xuXHRyZWFkb25seSB0cmFuc2llbnQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUaGUgYmFja3VwIHBhdGggdG8gdXNlXG5cdCAqL1xuXHRyZWFkb25seSBiYWNrdXBQYXRoPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgcmVtb3RlIGF1dGhvcml0eSBmb3IgdGhlIENvZGUgaW5zdGFuY2UgdG8gb3Blbi4gVW5kZWZpbmVkIGlmIG5vdCByZW1vdGUuXG5cdCAqL1xuXHRyZWFkb25seSByZW1vdGVBdXRob3JpdHk/OiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIE9wdGlvbmFsIGxhYmVsIGZvciB0aGUgcmVjZW50IGhpc3Rvcnlcblx0ICovXG5cdGxhYmVsPzogc3RyaW5nO1xufVxuXG5jb25zdCBFTVBUWV9XSU5ET1c6IElQYXRoVG9PcGVuID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuaW50ZXJmYWNlIElXb3Jrc3BhY2VQYXRoVG9PcGVuIGV4dGVuZHMgSVBhdGhUb09wZW4ge1xuXHRyZWFkb25seSB3b3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyO1xufVxuXG5pbnRlcmZhY2UgSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW4gZXh0ZW5kcyBJUGF0aFRvT3BlbiB7XG5cdHJlYWRvbmx5IHdvcmtzcGFjZTogSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXI7XG59XG5cbmZ1bmN0aW9uIGlzV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoOiBJUGF0aFRvT3BlbiB8IHVuZGVmaW5lZCk6IHBhdGggaXMgSVdvcmtzcGFjZVBhdGhUb09wZW4ge1xuXHRyZXR1cm4gaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHBhdGg/LndvcmtzcGFjZSk7XG59XG5cbmZ1bmN0aW9uIGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoOiBJUGF0aFRvT3BlbiB8IHVuZGVmaW5lZCk6IHBhdGggaXMgSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW4ge1xuXHRyZXR1cm4gaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyKHBhdGg/LndvcmtzcGFjZSk7XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5leHBvcnQgY2xhc3MgV2luZG93c01haW5TZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXaW5kb3dzTWFpblNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkT3BlbldpbmRvdyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDb2RlV2luZG93PigpKTtcblx0cmVhZG9ubHkgb25EaWRPcGVuV2luZG93ID0gdGhpcy5fb25EaWRPcGVuV2luZG93LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2lnbmFsUmVhZHlXaW5kb3cgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29kZVdpbmRvdz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2lnbmFsUmVhZHlXaW5kb3cgPSB0aGlzLl9vbkRpZFNpZ25hbFJlYWR5V2luZG93LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGVzdHJveVdpbmRvdyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDb2RlV2luZG93PigpKTtcblx0cmVhZG9ubHkgb25EaWREZXN0cm95V2luZG93ID0gdGhpcy5fb25EaWREZXN0cm95V2luZG93LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV2luZG93c0NvdW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVdpbmRvd3NDb3VudENoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlV2luZG93c0NvdW50ID0gdGhpcy5fb25EaWRDaGFuZ2VXaW5kb3dzQ291bnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRNYXhpbWl6ZVdpbmRvdyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDb2RlV2luZG93PigpKTtcblx0cmVhZG9ubHkgb25EaWRNYXhpbWl6ZVdpbmRvdyA9IHRoaXMuX29uRGlkTWF4aW1pemVXaW5kb3cuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVbm1heGltaXplV2luZG93ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUNvZGVXaW5kb3c+KCkpO1xuXHRyZWFkb25seSBvbkRpZFVubWF4aW1pemVXaW5kb3cgPSB0aGlzLl9vbkRpZFVubWF4aW1pemVXaW5kb3cuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VGdWxsU2NyZWVuID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyB3aW5kb3c6IElDb2RlV2luZG93OyBmdWxsc2NyZWVuOiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZ1bGxTY3JlZW4gPSB0aGlzLl9vbkRpZENoYW5nZUZ1bGxTY3JlZW4uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUcmlnZ2VyU3lzdGVtQ29udGV4dE1lbnUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHdpbmRvdzogSUNvZGVXaW5kb3c7IHg6IG51bWJlcjsgeTogbnVtYmVyIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFRyaWdnZXJTeXN0ZW1Db250ZXh0TWVudSA9IHRoaXMuX29uRGlkVHJpZ2dlclN5c3RlbUNvbnRleHRNZW51LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgd2luZG93cyA9IG5ldyBNYXA8bnVtYmVyLCBJQ29kZVdpbmRvdz4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdpbmRvd3NTdGF0ZUhhbmRsZXI6IFdpbmRvd3NTdGF0ZUhhbmRsZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtYWNoaW5lSWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNxbUlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkZXZEZXZpY2VJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaW5pdGlhbFVzZXJFbnY6IElQcm9jZXNzRW52aXJvbm1lbnQsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElMb2dnZXJNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ2dlclNlcnZpY2U6IElMb2dnZXJNYWluU2VydmljZSxcblx0XHRASVN0YXRlU2VydmljZSBzdGF0ZVNlcnZpY2U6IElTdGF0ZVNlcnZpY2UsXG5cdFx0QElQb2xpY3lTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcG9saWN5U2VydmljZTogSVBvbGljeVNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZU1haW5TZXJ2aWNlOiBJTGlmZWN5Y2xlTWFpblNlcnZpY2UsXG5cdFx0QElCYWNrdXBNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGJhY2t1cE1haW5TZXJ2aWNlOiBJQmFja3VwTWFpblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlc0hpc3RvcnlNYWluU2VydmljZTogSVdvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZTogSVdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElEaWFsb2dNYWluU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ01haW5TZXJ2aWNlOiBJRGlhbG9nTWFpblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm90b2NvbE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvdG9jb2xNYWluU2VydmljZTogSVByb3RvY29sTWFpblNlcnZpY2UsXG5cdFx0QElUaGVtZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVNYWluU2VydmljZTogSVRoZW1lTWFpblNlcnZpY2UsXG5cdFx0QElBdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2U6IElBdXhpbGlhcnlXaW5kb3dzTWFpblNlcnZpY2UsXG5cdFx0QElDU1NEZXZlbG9wbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjc3NEZXZlbG9wbWVudFNlcnZpY2U6IElDU1NEZXZlbG9wbWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMud2luZG93c1N0YXRlSGFuZGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXaW5kb3dzU3RhdGVIYW5kbGVyKHRoaXMsIHN0YXRlU2VydmljZSwgdGhpcy5saWZlY3ljbGVNYWluU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXG5cdFx0Ly8gU2lnbmFsIGEgd2luZG93IGlzIHJlYWR5IGFmdGVyIGhhdmluZyBlbnRlcmVkIGEgd29ya3NwYWNlXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLm9uRGlkRW50ZXJXb3Jrc3BhY2UoZXZlbnQgPT4gdGhpcy5fb25EaWRTaWduYWxSZWFkeVdpbmRvdy5maXJlKGV2ZW50LndpbmRvdykpKTtcblxuXHRcdC8vIFVwZGF0ZSB2YWxpZCByb290cyBpbiBwcm90b2NvbCBzZXJ2aWNlIGZvciBleHRlbnNpb24gZGV2IHdpbmRvd3Ncblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkU2lnbmFsUmVhZHlXaW5kb3cod2luZG93ID0+IHtcblx0XHRcdGlmICh3aW5kb3cuY29uZmlnPy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGggfHwgd2luZG93LmNvbmZpZz8uZXh0ZW5zaW9uVGVzdHNQYXRoKSB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQuYW55KHdpbmRvdy5vbkRpZENsb3NlLCB3aW5kb3cub25EaWREZXN0cm95KSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblxuXHRcdFx0XHQvLyBBbGxvdyBhY2Nlc3MgdG8gZXh0ZW5zaW9uIGRldmVsb3BtZW50IHBhdGhcblx0XHRcdFx0aWYgKHdpbmRvdy5jb25maWcuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb25EZXZlbG9wbWVudFBhdGggb2Ygd2luZG93LmNvbmZpZy5leHRlbnNpb25EZXZlbG9wbWVudFBhdGgpIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnByb3RvY29sTWFpblNlcnZpY2UuYWRkVmFsaWRGaWxlUm9vdChleHRlbnNpb25EZXZlbG9wbWVudFBhdGgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBbGxvdyBhY2Nlc3MgdG8gZXh0ZW5zaW9uIHRlc3RzIHBhdGhcblx0XHRcdFx0aWYgKHdpbmRvdy5jb25maWcuZXh0ZW5zaW9uVGVzdHNQYXRoKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMucHJvdG9jb2xNYWluU2VydmljZS5hZGRWYWxpZEZpbGVSb290KHdpbmRvdy5jb25maWcuZXh0ZW5zaW9uVGVzdHNQYXRoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvcGVuRW1wdHlXaW5kb3cob3BlbkNvbmZpZzogSU9wZW5FbXB0eUNvbmZpZ3VyYXRpb24sIG9wdGlvbnM/OiBJT3BlbkVtcHR5V2luZG93T3B0aW9ucyk6IFByb21pc2U8SUNvZGVXaW5kb3dbXT4ge1xuXHRcdGNvbnN0IGNsaSA9IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzO1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IG9wdGlvbnM/LnJlbW90ZUF1dGhvcml0eSB8fCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZm9yY2VFbXB0eSA9IHRydWU7XG5cdFx0Y29uc3QgZm9yY2VSZXVzZVdpbmRvdyA9IG9wdGlvbnM/LmZvcmNlUmV1c2VXaW5kb3c7XG5cdFx0Y29uc3QgZm9yY2VOZXdXaW5kb3cgPSAhZm9yY2VSZXVzZVdpbmRvdztcblxuXHRcdHJldHVybiB0aGlzLm9wZW4oeyAuLi5vcGVuQ29uZmlnLCBjbGksIGZvcmNlRW1wdHksIGZvcmNlTmV3V2luZG93LCBmb3JjZVJldXNlV2luZG93LCByZW1vdGVBdXRob3JpdHksIGZvcmNlVGVtcFByb2ZpbGU6IG9wdGlvbnM/LmZvcmNlVGVtcFByb2ZpbGUsIGZvcmNlUHJvZmlsZTogb3B0aW9ucz8uZm9yY2VQcm9maWxlIH0pO1xuXHR9XG5cblx0b3BlbkV4aXN0aW5nV2luZG93KHdpbmRvdzogSUNvZGVXaW5kb3csIG9wZW5Db25maWc6IElPcGVuQ29uZmlndXJhdGlvbik6IHZvaWQge1xuXG5cdFx0Ly8gQnJpbmcgd2luZG93IHRvIGZyb250XG5cdFx0d2luZG93LmZvY3VzKCk7XG5cblx0XHQvLyBIYW5kbGUgLS13YWl0XG5cdFx0dGhpcy5oYW5kbGVXYWl0TWFya2VyRmlsZShvcGVuQ29uZmlnLCBbd2luZG93XSk7XG5cdH1cblxuXHRhc3luYyBvcGVuKG9wZW5Db25maWc6IElPcGVuQ29uZmlndXJhdGlvbik6IFByb21pc2U8SUNvZGVXaW5kb3dbXT4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnd2luZG93c01hbmFnZXIjb3BlbicpO1xuXG5cdFx0Ly8gTWFrZSBzdXJlIGFkZE1vZGUvcmVtb3ZlTW9kZSBpcyBvbmx5IGVuYWJsZWQgaWYgd2UgaGF2ZSBhbiBhY3RpdmUgd2luZG93XG5cdFx0aWYgKChvcGVuQ29uZmlnLmFkZE1vZGUgfHwgb3BlbkNvbmZpZy5yZW1vdmVNb2RlKSAmJiAob3BlbkNvbmZpZy5pbml0aWFsU3RhcnR1cCB8fCAhdGhpcy5nZXRMYXN0QWN0aXZlV2luZG93KCkpKSB7XG5cdFx0XHRvcGVuQ29uZmlnLmFkZE1vZGUgPSBmYWxzZTtcblx0XHRcdG9wZW5Db25maWcucmVtb3ZlTW9kZSA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbGRlcnNUb0FkZDogSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW5bXSA9IFtdO1xuXHRcdGNvbnN0IGZvbGRlcnNUb1JlbW92ZTogSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW5bXSA9IFtdO1xuXG5cdFx0Y29uc3QgZm9sZGVyc1RvT3BlbjogSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW5bXSA9IFtdO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlc1RvT3BlbjogSVdvcmtzcGFjZVBhdGhUb09wZW5bXSA9IFtdO1xuXHRcdGNvbnN0IHVudGl0bGVkV29ya3NwYWNlc1RvUmVzdG9yZTogSVdvcmtzcGFjZVBhdGhUb09wZW5bXSA9IFtdO1xuXG5cdFx0Y29uc3QgZW1wdHlXaW5kb3dzV2l0aEJhY2t1cHNUb1Jlc3RvcmU6IElFbXB0eVdpbmRvd0JhY2t1cEluZm9bXSA9IFtdO1xuXG5cdFx0bGV0IGZpbGVzVG9PcGVuOiBJRmlsZXNUb09wZW4gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1heWJlT3BlbkVtcHR5V2luZG93ID0gZmFsc2U7XG5cblx0XHQvLyBJZGVudGlmeSB0aGluZ3MgdG8gb3BlbiBmcm9tIG9wZW4gY29uZmlnXG5cdFx0Y29uc3QgcGF0aHNUb09wZW4gPSBhd2FpdCB0aGlzLmdldFBhdGhzVG9PcGVuKG9wZW5Db25maWcpO1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnd2luZG93c01hbmFnZXIjb3BlbiBwYXRoc1RvT3BlbicsIHBhdGhzVG9PcGVuKTtcblx0XHRmb3IgKGNvbnN0IHBhdGggb2YgcGF0aHNUb09wZW4pIHtcblx0XHRcdGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW4ocGF0aCkpIHtcblx0XHRcdFx0aWYgKG9wZW5Db25maWcuYWRkTW9kZSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gcnVuIHdpdGggLS1hZGQsIHRha2UgdGhlIGZvbGRlcnMgdGhhdCBhcmUgdG8gYmUgb3BlbmVkIGFzXG5cdFx0XHRcdFx0Ly8gZm9sZGVycyB0aGF0IHNob3VsZCBiZSBhZGRlZCB0byB0aGUgY3VycmVudGx5IGFjdGl2ZSB3aW5kb3cuXG5cdFx0XHRcdFx0Zm9sZGVyc1RvQWRkLnB1c2gocGF0aCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAob3BlbkNvbmZpZy5yZW1vdmVNb2RlKSB7XG5cdFx0XHRcdFx0Ly8gV2hlbiBydW4gd2l0aCAtLXJlbW92ZSwgdGFrZSB0aGUgZm9sZGVycyB0aGF0IGFyZSB0byBiZSBvcGVuZWQgYXNcblx0XHRcdFx0XHQvLyBmb2xkZXJzIHRoYXQgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSB0aGUgY3VycmVudGx5IGFjdGl2ZSB3aW5kb3cuXG5cdFx0XHRcdFx0Zm9sZGVyc1RvUmVtb3ZlLnB1c2gocGF0aCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9sZGVyc1RvT3Blbi5wdXNoKHBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGlzV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoKSkge1xuXHRcdFx0XHR3b3Jrc3BhY2VzVG9PcGVuLnB1c2gocGF0aCk7XG5cdFx0XHR9IGVsc2UgaWYgKHBhdGguZmlsZVVyaSkge1xuXHRcdFx0XHRpZiAoIWZpbGVzVG9PcGVuKSB7XG5cdFx0XHRcdFx0ZmlsZXNUb09wZW4gPSB7IGZpbGVzVG9PcGVuT3JDcmVhdGU6IFtdLCBmaWxlc1RvRGlmZjogW10sIGZpbGVzVG9NZXJnZTogW10sIHJlbW90ZUF1dGhvcml0eTogcGF0aC5yZW1vdGVBdXRob3JpdHkgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmaWxlc1RvT3Blbi5maWxlc1RvT3Blbk9yQ3JlYXRlLnB1c2gocGF0aCk7XG5cdFx0XHR9IGVsc2UgaWYgKHBhdGguYmFja3VwUGF0aCkge1xuXHRcdFx0XHRlbXB0eVdpbmRvd3NXaXRoQmFja3Vwc1RvUmVzdG9yZS5wdXNoKHsgYmFja3VwRm9sZGVyOiBiYXNlbmFtZShwYXRoLmJhY2t1cFBhdGgpLCByZW1vdGVBdXRob3JpdHk6IHBhdGgucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bWF5YmVPcGVuRW1wdHlXaW5kb3cgPSB0cnVlOyAvLyBkZXBlbmRzIG9uIG90aGVyIHBhcmFtZXRlcnMgc3VjaCBhcyBgZm9yY2VFbXB0eWAgYW5kIGhvdyBtYW55IHdpbmRvd3MgaGF2ZSBvcGVuZWQgYWxyZWFkeVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdoZW4gcnVuIHdpdGggLS1kaWZmLCB0YWtlIHRoZSBmaXJzdCAyIGZpbGVzIHRvIG9wZW4gYXMgZmlsZXMgdG8gZGlmZlxuXHRcdGlmIChvcGVuQ29uZmlnLmRpZmZNb2RlICYmIGZpbGVzVG9PcGVuICYmIGZpbGVzVG9PcGVuLmZpbGVzVG9PcGVuT3JDcmVhdGUubGVuZ3RoID49IDIpIHtcblx0XHRcdGZpbGVzVG9PcGVuLmZpbGVzVG9EaWZmID0gZmlsZXNUb09wZW4uZmlsZXNUb09wZW5PckNyZWF0ZS5zbGljZSgwLCAyKTtcblx0XHRcdGZpbGVzVG9PcGVuLmZpbGVzVG9PcGVuT3JDcmVhdGUgPSBbXTtcblx0XHR9XG5cblx0XHQvLyBXaGVuIHJ1biB3aXRoIC0tbWVyZ2UsIHRha2UgdGhlIGZpcnN0IDQgZmlsZXMgdG8gb3BlbiBhcyBmaWxlcyB0byBtZXJnZVxuXHRcdGlmIChvcGVuQ29uZmlnLm1lcmdlTW9kZSAmJiBmaWxlc1RvT3BlbiAmJiBmaWxlc1RvT3Blbi5maWxlc1RvT3Blbk9yQ3JlYXRlLmxlbmd0aCA9PT0gNCkge1xuXHRcdFx0ZmlsZXNUb09wZW4uZmlsZXNUb01lcmdlID0gZmlsZXNUb09wZW4uZmlsZXNUb09wZW5PckNyZWF0ZS5zbGljZSgwLCA0KTtcblx0XHRcdGZpbGVzVG9PcGVuLmZpbGVzVG9PcGVuT3JDcmVhdGUgPSBbXTtcblx0XHRcdGZpbGVzVG9PcGVuLmZpbGVzVG9EaWZmID0gW107XG5cdFx0fVxuXG5cdFx0Ly8gV2hlbiBydW4gd2l0aCAtLXdhaXQsIG1ha2Ugc3VyZSB3ZSBrZWVwIHRoZSBwYXRocyB0byB3YWl0IGZvclxuXHRcdGlmIChmaWxlc1RvT3BlbiAmJiBvcGVuQ29uZmlnLndhaXRNYXJrZXJGaWxlVVJJKSB7XG5cdFx0XHRmaWxlc1RvT3Blbi5maWxlc1RvV2FpdCA9IHsgcGF0aHM6IGNvYWxlc2NlKFsuLi5maWxlc1RvT3Blbi5maWxlc1RvRGlmZiwgZmlsZXNUb09wZW4uZmlsZXNUb01lcmdlWzNdIC8qIFszXSBpcyB0aGUgcmVzdWx0aW5nIG1lcmdlIGZpbGUgKi8sIC4uLmZpbGVzVG9PcGVuLmZpbGVzVG9PcGVuT3JDcmVhdGVdKSwgd2FpdE1hcmtlckZpbGVVcmk6IG9wZW5Db25maWcud2FpdE1hcmtlckZpbGVVUkkgfTtcblx0XHR9XG5cblx0XHQvLyBUaGVzZSBhcmUgd2luZG93cyB0byByZXN0b3JlIGJlY2F1c2Ugb2YgaG90LWV4aXQgb3IgZnJvbSBwcmV2aW91cyBzZXNzaW9uIChvbmx5IHBlcmZvcm1lZCBvbmNlIG9uIHN0YXJ0dXAhKVxuXHRcdGlmIChvcGVuQ29uZmlnLmluaXRpYWxTdGFydHVwKSB7XG5cblx0XHRcdC8vIFVudGl0bGVkIHdvcmtzcGFjZXMgYXJlIGFsd2F5cyByZXN0b3JlZFxuXHRcdFx0dW50aXRsZWRXb3Jrc3BhY2VzVG9SZXN0b3JlLnB1c2goLi4udGhpcy53b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLmdldFVudGl0bGVkV29ya3NwYWNlcygpKTtcblx0XHRcdHdvcmtzcGFjZXNUb09wZW4ucHVzaCguLi51bnRpdGxlZFdvcmtzcGFjZXNUb1Jlc3RvcmUpO1xuXG5cdFx0XHQvLyBFbXB0eSB3aW5kb3dzIHdpdGggYmFja3VwcyBhcmUgYWx3YXlzIHJlc3RvcmVkXG5cdFx0XHRlbXB0eVdpbmRvd3NXaXRoQmFja3Vwc1RvUmVzdG9yZS5wdXNoKC4uLnRoaXMuYmFja3VwTWFpblNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbXB0eVdpbmRvd3NXaXRoQmFja3Vwc1RvUmVzdG9yZS5sZW5ndGggPSAwO1xuXHRcdH1cblxuXHRcdC8vIE9wZW4gYmFzZWQgb24gY29uZmlnXG5cdFx0Y29uc3QgeyB3aW5kb3dzOiB1c2VkV2luZG93cywgZmlsZXNPcGVuZWRJbldpbmRvdyB9ID0gYXdhaXQgdGhpcy5kb09wZW4ob3BlbkNvbmZpZywgd29ya3NwYWNlc1RvT3BlbiwgZm9sZGVyc1RvT3BlbiwgZW1wdHlXaW5kb3dzV2l0aEJhY2t1cHNUb1Jlc3RvcmUsIG1heWJlT3BlbkVtcHR5V2luZG93LCBmaWxlc1RvT3BlbiwgZm9sZGVyc1RvQWRkLCBmb2xkZXJzVG9SZW1vdmUpO1xuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGB3aW5kb3dzTWFuYWdlciNvcGVuIHVzZWQgd2luZG93IGNvdW50ICR7dXNlZFdpbmRvd3MubGVuZ3RofSAod29ya3NwYWNlc1RvT3BlbjogJHt3b3Jrc3BhY2VzVG9PcGVuLmxlbmd0aH0sIGZvbGRlcnNUb09wZW46ICR7Zm9sZGVyc1RvT3Blbi5sZW5ndGh9LCBlbXB0eVRvUmVzdG9yZTogJHtlbXB0eVdpbmRvd3NXaXRoQmFja3Vwc1RvUmVzdG9yZS5sZW5ndGh9LCBtYXliZU9wZW5FbXB0eVdpbmRvdzogJHttYXliZU9wZW5FbXB0eVdpbmRvd30pYCk7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gcGFzcyBmb2N1cyB0byB0aGUgbW9zdCByZWxldmFudCBvZiB0aGUgd2luZG93cyBpZiB3ZSBvcGVuIG11bHRpcGxlXG5cdFx0aWYgKHVzZWRXaW5kb3dzLmxlbmd0aCA+IDEpIHtcblxuXHRcdFx0Ly8gMS4pIGZvY3VzIHdpbmRvdyB3ZSBvcGVuZWQgZmlsZXMgaW4gYWx3YXlzIHdpdGggaGlnaGVzdCBwcmlvcml0eVxuXHRcdFx0aWYgKGZpbGVzT3BlbmVkSW5XaW5kb3cpIHtcblx0XHRcdFx0ZmlsZXNPcGVuZWRJbldpbmRvdy5mb2N1cygpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPdGhlcndpc2UsIGZpbmQgYSBnb29kIHdpbmRvdyBiYXNlZCBvbiBvcGVuIHBhcmFtc1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZvY3VzTGFzdEFjdGl2ZSA9IHRoaXMud2luZG93c1N0YXRlSGFuZGxlci5zdGF0ZS5sYXN0QWN0aXZlV2luZG93ICYmICFvcGVuQ29uZmlnLmZvcmNlRW1wdHkgJiYgIW9wZW5Db25maWcuY2xpLl8ubGVuZ3RoICYmICFvcGVuQ29uZmlnLmNsaVsnZmlsZS11cmknXSAmJiAhb3BlbkNvbmZpZy5jbGlbJ2ZvbGRlci11cmknXSAmJiAhKG9wZW5Db25maWcudXJpc1RvT3BlbiAmJiBvcGVuQ29uZmlnLnVyaXNUb09wZW4ubGVuZ3RoKTtcblx0XHRcdFx0bGV0IGZvY3VzTGFzdE9wZW5lZCA9IHRydWU7XG5cdFx0XHRcdGxldCBmb2N1c0xhc3RXaW5kb3cgPSB0cnVlO1xuXG5cdFx0XHRcdC8vIDIuKSBmb2N1cyBsYXN0IGFjdGl2ZSB3aW5kb3cgaWYgd2UgYXJlIG5vdCBpbnN0cnVjdGVkIHRvIG9wZW4gYW55IHBhdGhzXG5cdFx0XHRcdGlmIChmb2N1c0xhc3RBY3RpdmUpIHtcblx0XHRcdFx0XHRjb25zdCBsYXN0QWN0aXZlV2luZG93ID0gdXNlZFdpbmRvd3MuZmlsdGVyKHdpbmRvdyA9PiB0aGlzLndpbmRvd3NTdGF0ZUhhbmRsZXIuc3RhdGUubGFzdEFjdGl2ZVdpbmRvdyAmJiB3aW5kb3cuYmFja3VwUGF0aCA9PT0gdGhpcy53aW5kb3dzU3RhdGVIYW5kbGVyLnN0YXRlLmxhc3RBY3RpdmVXaW5kb3cuYmFja3VwUGF0aCk7XG5cdFx0XHRcdFx0aWYgKGxhc3RBY3RpdmVXaW5kb3cubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRsYXN0QWN0aXZlV2luZG93WzBdLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRmb2N1c0xhc3RPcGVuZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGZvY3VzTGFzdFdpbmRvdyA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIDMuKSBpZiBpbnN0cnVjdGVkIHRvIG9wZW4gcGF0aHMsIGZvY3VzIGxhc3Qgd2luZG93IHdoaWNoIGlzIG5vdCByZXN0b3JlZFxuXHRcdFx0XHRpZiAoZm9jdXNMYXN0T3BlbmVkKSB7XG5cdFx0XHRcdFx0Zm9yIChsZXQgaSA9IHVzZWRXaW5kb3dzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1c2VkV2luZG93ID0gdXNlZFdpbmRvd3NbaV07XG5cdFx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRcdCh1c2VkV2luZG93Lm9wZW5lZFdvcmtzcGFjZSAmJiB1bnRpdGxlZFdvcmtzcGFjZXNUb1Jlc3RvcmUuc29tZSh3b3Jrc3BhY2UgPT4gdXNlZFdpbmRvdy5vcGVuZWRXb3Jrc3BhY2UgJiYgd29ya3NwYWNlLndvcmtzcGFjZS5pZCA9PT0gdXNlZFdpbmRvdy5vcGVuZWRXb3Jrc3BhY2UuaWQpKSB8fFx0Ly8gc2tpcCBvdmVyIHJlc3RvcmVkIHdvcmtzcGFjZVxuXHRcdFx0XHRcdFx0XHQodXNlZFdpbmRvdy5iYWNrdXBQYXRoICYmIGVtcHR5V2luZG93c1dpdGhCYWNrdXBzVG9SZXN0b3JlLnNvbWUoZW1wdHkgPT4gdXNlZFdpbmRvdy5iYWNrdXBQYXRoICYmIGVtcHR5LmJhY2t1cEZvbGRlciA9PT0gYmFzZW5hbWUodXNlZFdpbmRvdy5iYWNrdXBQYXRoKSkpXHRcdFx0XHRcdFx0XHQvLyBza2lwIG92ZXIgcmVzdG9yZWQgZW1wdHkgd2luZG93XG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHVzZWRXaW5kb3cuZm9jdXMoKTtcblx0XHRcdFx0XHRcdGZvY3VzTGFzdFdpbmRvdyA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gNC4pIGZpbmFsbHksIGFsd2F5cyBlbnN1cmUgdG8gaGF2ZSBhdCBsZWFzdCBsYXN0IHVzZWQgd2luZG93IGZvY3VzZWRcblx0XHRcdFx0aWYgKGZvY3VzTGFzdFdpbmRvdykge1xuXHRcdFx0XHRcdHVzZWRXaW5kb3dzW3VzZWRXaW5kb3dzLmxlbmd0aCAtIDFdLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBpbiByZWNlbnQgZG9jdW1lbnQgbGlzdCAodW5sZXNzIHRoaXMgb3BlbnMgZm9yIGV4dGVuc2lvbiBkZXZlbG9wbWVudClcblx0XHQvLyBBbHNvIGRvIG5vdCBhZGQgcGF0aHMgd2hlbiBmaWxlcyBhcmUgb3BlbmVkIGZvciBkaWZmaW5nIG9yIG1lcmdpbmcsIG9ubHkgaWYgb3BlbmVkIGluZGl2aWR1YWxseVxuXHRcdGNvbnN0IGlzRGlmZiA9IGZpbGVzVG9PcGVuICYmIGZpbGVzVG9PcGVuLmZpbGVzVG9EaWZmLmxlbmd0aCA+IDA7XG5cdFx0Y29uc3QgaXNNZXJnZSA9IGZpbGVzVG9PcGVuICYmIGZpbGVzVG9PcGVuLmZpbGVzVG9NZXJnZS5sZW5ndGggPiAwO1xuXHRcdGlmICghdXNlZFdpbmRvd3Muc29tZSh3aW5kb3cgPT4gd2luZG93LmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnRIb3N0KSAmJiAhaXNEaWZmICYmICFpc01lcmdlICYmICFvcGVuQ29uZmlnLm5vUmVjZW50RW50cnkpIHtcblx0XHRcdGNvbnN0IHJlY2VudHM6IElSZWNlbnRbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBwYXRoVG9PcGVuIG9mIHBhdGhzVG9PcGVuKSB7XG5cdFx0XHRcdGlmIChpc1dvcmtzcGFjZVBhdGhUb09wZW4ocGF0aFRvT3BlbikgJiYgIXBhdGhUb09wZW4udHJhbnNpZW50IC8qIG5ldmVyIGFkZCB0cmFuc2llbnQgd29ya3NwYWNlcyB0byBoaXN0b3J5ICovKSB7XG5cdFx0XHRcdFx0cmVjZW50cy5wdXNoKHsgbGFiZWw6IHBhdGhUb09wZW4ubGFiZWwsIHdvcmtzcGFjZTogcGF0aFRvT3Blbi53b3Jrc3BhY2UsIHJlbW90ZUF1dGhvcml0eTogcGF0aFRvT3Blbi5yZW1vdGVBdXRob3JpdHkgfSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VQYXRoVG9PcGVuKHBhdGhUb09wZW4pKSB7XG5cdFx0XHRcdFx0cmVjZW50cy5wdXNoKHsgbGFiZWw6IHBhdGhUb09wZW4ubGFiZWwsIGZvbGRlclVyaTogcGF0aFRvT3Blbi53b3Jrc3BhY2UudXJpLCByZW1vdGVBdXRob3JpdHk6IHBhdGhUb09wZW4ucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHBhdGhUb09wZW4uZmlsZVVyaSkge1xuXHRcdFx0XHRcdHJlY2VudHMucHVzaCh7IGxhYmVsOiBwYXRoVG9PcGVuLmxhYmVsLCBmaWxlVXJpOiBwYXRoVG9PcGVuLmZpbGVVcmksIHJlbW90ZUF1dGhvcml0eTogcGF0aFRvT3Blbi5yZW1vdGVBdXRob3JpdHkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy53b3Jrc3BhY2VzSGlzdG9yeU1haW5TZXJ2aWNlLmFkZFJlY2VudGx5T3BlbmVkKHJlY2VudHMpO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSAtLXdhaXRcblx0XHR0aGlzLmhhbmRsZVdhaXRNYXJrZXJGaWxlKG9wZW5Db25maWcsIHVzZWRXaW5kb3dzKTtcblxuXHRcdHJldHVybiB1c2VkV2luZG93cztcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlV2FpdE1hcmtlckZpbGUob3BlbkNvbmZpZzogSU9wZW5Db25maWd1cmF0aW9uLCB1c2VkV2luZG93czogSUNvZGVXaW5kb3dbXSk6IHZvaWQge1xuXG5cdFx0Ly8gSWYgd2UgZ290IHN0YXJ0ZWQgd2l0aCAtLXdhaXQgZnJvbSB0aGUgQ0xJLCB3ZSBuZWVkIHRvIHNpZ25hbCB0byB0aGUgb3V0c2lkZSB3aGVuIHRoZSB3aW5kb3dcblx0XHQvLyB1c2VkIGZvciB0aGUgZWRpdCBvcGVyYXRpb24gaXMgY2xvc2VkIG9yIGxvYWRlZCB0byBhIGRpZmZlcmVudCBmb2xkZXIgc28gdGhhdCB0aGUgd2FpdGluZ1xuXHRcdC8vIHByb2Nlc3MgY2FuIGNvbnRpbnVlLiBXZSBkbyB0aGlzIGJ5IGRlbGV0aW5nIHRoZSB3YWl0TWFya2VyRmlsZVBhdGguXG5cdFx0Y29uc3Qgd2FpdE1hcmtlckZpbGVVUkkgPSBvcGVuQ29uZmlnLndhaXRNYXJrZXJGaWxlVVJJO1xuXHRcdGlmIChvcGVuQ29uZmlnLmNvbnRleHQgPT09IE9wZW5Db250ZXh0LkNMSSAmJiB3YWl0TWFya2VyRmlsZVVSSSAmJiB1c2VkV2luZG93cy5sZW5ndGggPT09IDEgJiYgdXNlZFdpbmRvd3NbMF0pIHtcblx0XHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHVzZWRXaW5kb3dzWzBdLndoZW5DbG9zZWRPckxvYWRlZDtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHdhaXRNYXJrZXJGaWxlVVJJKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmUgLSBjb3VsZCBoYXZlIGJlZW4gZGVsZXRlZCBmcm9tIHRoZSB3aW5kb3cgYWxyZWFkeVxuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9PcGVuKFxuXHRcdG9wZW5Db25maWc6IElPcGVuQ29uZmlndXJhdGlvbixcblx0XHR3b3Jrc3BhY2VzVG9PcGVuOiBJV29ya3NwYWNlUGF0aFRvT3BlbltdLFxuXHRcdGZvbGRlcnNUb09wZW46IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VQYXRoVG9PcGVuW10sXG5cdFx0ZW1wdHlUb1Jlc3RvcmU6IElFbXB0eVdpbmRvd0JhY2t1cEluZm9bXSxcblx0XHRtYXliZU9wZW5FbXB0eVdpbmRvdzogYm9vbGVhbixcblx0XHRmaWxlc1RvT3BlbjogSUZpbGVzVG9PcGVuIHwgdW5kZWZpbmVkLFxuXHRcdGZvbGRlcnNUb0FkZDogSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW5bXSxcblx0XHRmb2xkZXJzVG9SZW1vdmU6IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VQYXRoVG9PcGVuW11cblx0KTogUHJvbWlzZTx7IHdpbmRvd3M6IElDb2RlV2luZG93W107IGZpbGVzT3BlbmVkSW5XaW5kb3c6IElDb2RlV2luZG93IHwgdW5kZWZpbmVkIH0+IHtcblxuXHRcdC8vIEtlZXAgdHJhY2sgb2YgdXNlZCB3aW5kb3dzIGFuZCByZW1lbWJlclxuXHRcdC8vIGlmIGZpbGVzIGhhdmUgYmVlbiBvcGVuZWQgaW4gb25lIG9mIHRoZW1cblx0XHRjb25zdCB1c2VkV2luZG93czogSUNvZGVXaW5kb3dbXSA9IFtdO1xuXHRcdGxldCBmaWxlc09wZW5lZEluV2luZG93OiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRmdW5jdGlvbiBhZGRVc2VkV2luZG93KHdpbmRvdzogSUNvZGVXaW5kb3csIG9wZW5lZEZpbGVzPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0dXNlZFdpbmRvd3MucHVzaCh3aW5kb3cpO1xuXG5cdFx0XHRpZiAob3BlbmVkRmlsZXMpIHtcblx0XHRcdFx0ZmlsZXNPcGVuZWRJbldpbmRvdyA9IHdpbmRvdztcblx0XHRcdFx0ZmlsZXNUb09wZW4gPSB1bmRlZmluZWQ7IC8vIHJlc2V0IGBmaWxlc1RvT3BlbmAgc2luY2UgZmlsZXMgaGF2ZSBiZWVuIG9wZW5lZFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNldHRpbmdzIGNhbiBkZWNpZGUgaWYgZmlsZXMvZm9sZGVycyBvcGVuIGluIG5ldyB3aW5kb3cgb3Igbm90XG5cdFx0bGV0IHsgb3BlbkZvbGRlckluTmV3V2luZG93LCBvcGVuRmlsZXNJbk5ld1dpbmRvdyB9ID0gdGhpcy5zaG91bGRPcGVuTmV3V2luZG93KG9wZW5Db25maWcpO1xuXG5cdFx0Ly8gSGFuZGxlIGZvbGRlcnMgdG8gYWRkL3JlbW92ZSBieSBsb29raW5nIGZvciB0aGUgbGFzdCBhY3RpdmUgd29ya3NwYWNlIChub3Qgb24gaW5pdGlhbCBzdGFydHVwKVxuXHRcdGlmICghb3BlbkNvbmZpZy5pbml0aWFsU3RhcnR1cCAmJiAoZm9sZGVyc1RvQWRkLmxlbmd0aCA+IDAgfHwgZm9sZGVyc1RvUmVtb3ZlLmxlbmd0aCA+IDApKSB7XG5cdFx0XHRjb25zdCBhdXRob3JpdHkgPSBmb2xkZXJzVG9BZGQuYXQoMCk/LnJlbW90ZUF1dGhvcml0eSA/PyBmb2xkZXJzVG9SZW1vdmUuYXQoMCk/LnJlbW90ZUF1dGhvcml0eTtcblx0XHRcdGNvbnN0IGxhc3RBY3RpdmVXaW5kb3cgPSB0aGlzLmdldExhc3RBY3RpdmVXaW5kb3dGb3JBdXRob3JpdHkoYXV0aG9yaXR5KTtcblx0XHRcdGlmIChsYXN0QWN0aXZlV2luZG93KSB7XG5cdFx0XHRcdGFkZFVzZWRXaW5kb3codGhpcy5kb0FkZFJlbW92ZUZvbGRlcnNJbkV4aXN0aW5nV2luZG93KGxhc3RBY3RpdmVXaW5kb3csIGZvbGRlcnNUb0FkZC5tYXAoZm9sZGVyVG9BZGQgPT4gZm9sZGVyVG9BZGQud29ya3NwYWNlLnVyaSksIGZvbGRlcnNUb1JlbW92ZS5tYXAoZm9sZGVyVG9SZW1vdmUgPT4gZm9sZGVyVG9SZW1vdmUud29ya3NwYWNlLnVyaSkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgZmlsZXMgdG8gb3Blbi9kaWZmL21lcmdlIG9yIHRvIGNyZWF0ZSB3aGVuIHdlIGRvbnQgb3BlbiBhIGZvbGRlciBhbmQgd2UgZG8gbm90IHJlc3RvcmUgYW55XG5cdFx0Ly8gZm9sZGVyL3VudGl0bGVkIGZyb20gaG90LWV4aXQgYnkgdHJ5aW5nIHRvIG9wZW4gdGhlbSBpbiB0aGUgd2luZG93IHRoYXQgZml0cyBiZXN0XG5cdFx0Y29uc3QgcG90ZW50aWFsTmV3V2luZG93c0NvdW50ID0gZm9sZGVyc1RvT3Blbi5sZW5ndGggKyB3b3Jrc3BhY2VzVG9PcGVuLmxlbmd0aCArIGVtcHR5VG9SZXN0b3JlLmxlbmd0aDtcblx0XHRpZiAoZmlsZXNUb09wZW4gJiYgcG90ZW50aWFsTmV3V2luZG93c0NvdW50ID09PSAwKSB7XG5cblx0XHRcdC8vIEZpbmQgc3VpdGFibGUgd2luZG93IG9yIGZvbGRlciBwYXRoIHRvIG9wZW4gZmlsZXMgaW5cblx0XHRcdGNvbnN0IGZpbGVUb0NoZWNrOiBJUGF0aDxJRWRpdG9yT3B0aW9ucz4gfCB1bmRlZmluZWQgPSBmaWxlc1RvT3Blbi5maWxlc1RvT3Blbk9yQ3JlYXRlWzBdIHx8IGZpbGVzVG9PcGVuLmZpbGVzVG9EaWZmWzBdIHx8IGZpbGVzVG9PcGVuLmZpbGVzVG9NZXJnZVszXSAvKiBbM10gaXMgdGhlIHJlc3VsdGluZyBtZXJnZSBmaWxlICovO1xuXG5cdFx0XHQvLyBvbmx5IGxvb2sgYXQgdGhlIHdpbmRvd3Mgd2l0aCBjb3JyZWN0IGF1dGhvcml0eVxuXHRcdFx0Y29uc3Qgd2luZG93cyA9IHRoaXMuZ2V0V2luZG93cygpLmZpbHRlcih3aW5kb3cgPT4gZmlsZXNUb09wZW4gJiYgaXNFcXVhbEF1dGhvcml0eSh3aW5kb3cucmVtb3RlQXV0aG9yaXR5LCBmaWxlc1RvT3Blbi5yZW1vdGVBdXRob3JpdHkpKTtcblxuXHRcdFx0Ly8gZmlndXJlIG91dCBhIGdvb2Qgd2luZG93IHRvIG9wZW4gdGhlIGZpbGVzIGluIGlmIGFueVxuXHRcdFx0Ly8gd2l0aCBhIGZhbGxiYWNrIHRvIHRoZSBsYXN0IGFjdGl2ZSB3aW5kb3cuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gaW4gY2FzZSBgb3BlbkZpbGVzSW5OZXdXaW5kb3dgIGlzIGVuZm9yY2VkLCB3ZSBza2lwXG5cdFx0XHQvLyB0aGlzIHN0ZXAuXG5cdFx0XHRsZXQgd2luZG93VG9Vc2VGb3JGaWxlczogSUNvZGVXaW5kb3cgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZmlsZVRvQ2hlY2s/LmZpbGVVcmkgJiYgIW9wZW5GaWxlc0luTmV3V2luZG93KSB7XG5cdFx0XHRcdGlmIChvcGVuQ29uZmlnLmNvbnRleHQgPT09IE9wZW5Db250ZXh0LkRFU0tUT1AgfHwgb3BlbkNvbmZpZy5jb250ZXh0ID09PSBPcGVuQ29udGV4dC5DTEkgfHwgb3BlbkNvbmZpZy5jb250ZXh0ID09PSBPcGVuQ29udGV4dC5ET0NLIHx8IG9wZW5Db25maWcuY29udGV4dCA9PT0gT3BlbkNvbnRleHQuTElOSykge1xuXHRcdFx0XHRcdHdpbmRvd1RvVXNlRm9yRmlsZXMgPSBhd2FpdCBmaW5kV2luZG93T25GaWxlKHdpbmRvd3MsIGZpbGVUb0NoZWNrLmZpbGVVcmksIGFzeW5jIHdvcmtzcGFjZSA9PiB3b3Jrc3BhY2UuY29uZmlnUGF0aC5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSA/IHRoaXMud29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5yZXNvbHZlTG9jYWxXb3Jrc3BhY2Uod29ya3NwYWNlLmNvbmZpZ1BhdGgpIDogdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghd2luZG93VG9Vc2VGb3JGaWxlcykge1xuXHRcdFx0XHRcdHdpbmRvd1RvVXNlRm9yRmlsZXMgPSB0aGlzLmRvR2V0TGFzdEFjdGl2ZVdpbmRvdyh3aW5kb3dzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBXZSBmb3VuZCBhIHdpbmRvdyB0byBvcGVuIHRoZSBmaWxlcyBpblxuXHRcdFx0aWYgKHdpbmRvd1RvVXNlRm9yRmlsZXMpIHtcblxuXHRcdFx0XHQvLyBXaW5kb3cgaXMgd29ya3NwYWNlXG5cdFx0XHRcdGlmIChpc1dvcmtzcGFjZUlkZW50aWZpZXIod2luZG93VG9Vc2VGb3JGaWxlcy5vcGVuZWRXb3Jrc3BhY2UpKSB7XG5cdFx0XHRcdFx0d29ya3NwYWNlc1RvT3Blbi5wdXNoKHsgd29ya3NwYWNlOiB3aW5kb3dUb1VzZUZvckZpbGVzLm9wZW5lZFdvcmtzcGFjZSwgcmVtb3RlQXV0aG9yaXR5OiB3aW5kb3dUb1VzZUZvckZpbGVzLnJlbW90ZUF1dGhvcml0eSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFdpbmRvdyBpcyBzaW5nbGUgZm9sZGVyXG5cdFx0XHRcdGVsc2UgaWYgKGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3aW5kb3dUb1VzZUZvckZpbGVzLm9wZW5lZFdvcmtzcGFjZSkpIHtcblx0XHRcdFx0XHRmb2xkZXJzVG9PcGVuLnB1c2goeyB3b3Jrc3BhY2U6IHdpbmRvd1RvVXNlRm9yRmlsZXMub3BlbmVkV29ya3NwYWNlLCByZW1vdGVBdXRob3JpdHk6IHdpbmRvd1RvVXNlRm9yRmlsZXMucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gV2luZG93IGlzIGVtcHR5XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGFkZFVzZWRXaW5kb3codGhpcy5kb09wZW5GaWxlc0luRXhpc3RpbmdXaW5kb3cob3BlbkNvbmZpZywgd2luZG93VG9Vc2VGb3JGaWxlcywgZmlsZXNUb09wZW4pLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaW5hbGx5LCBpZiBubyB3aW5kb3cgb3IgZm9sZGVyIGlzIGZvdW5kLCBqdXN0IG9wZW4gdGhlIGZpbGVzIGluIGFuIGVtcHR5IHdpbmRvd1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGFkZFVzZWRXaW5kb3coYXdhaXQgdGhpcy5vcGVuSW5Ccm93c2VyV2luZG93KHtcblx0XHRcdFx0XHR1c2VyRW52OiBvcGVuQ29uZmlnLnVzZXJFbnYsXG5cdFx0XHRcdFx0Y2xpOiBvcGVuQ29uZmlnLmNsaSxcblx0XHRcdFx0XHRpbml0aWFsU3RhcnR1cDogb3BlbkNvbmZpZy5pbml0aWFsU3RhcnR1cCxcblx0XHRcdFx0XHRmaWxlc1RvT3Blbixcblx0XHRcdFx0XHRmb3JjZU5ld1dpbmRvdzogdHJ1ZSxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IGZpbGVzVG9PcGVuLnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0XHRmb3JjZU5ld1RhYmJlZFdpbmRvdzogb3BlbkNvbmZpZy5mb3JjZU5ld1RhYmJlZFdpbmRvdyxcblx0XHRcdFx0XHRmb3JjZVByb2ZpbGU6IG9wZW5Db25maWcuZm9yY2VQcm9maWxlLFxuXHRcdFx0XHRcdGZvcmNlVGVtcFByb2ZpbGU6IG9wZW5Db25maWcuZm9yY2VUZW1wUHJvZmlsZVxuXHRcdFx0XHR9KSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIHdvcmtzcGFjZXMgdG8gb3BlbiAoaW5zdHJ1Y3RlZCBhbmQgdG8gcmVzdG9yZSlcblx0XHRjb25zdCBhbGxXb3Jrc3BhY2VzVG9PcGVuID0gZGlzdGluY3Qod29ya3NwYWNlc1RvT3Blbiwgd29ya3NwYWNlID0+IHdvcmtzcGFjZS53b3Jrc3BhY2UuaWQpOyAvLyBwcmV2ZW50IGR1cGxpY2F0ZXNcblx0XHRpZiAoYWxsV29ya3NwYWNlc1RvT3Blbi5sZW5ndGggPiAwKSB7XG5cblx0XHRcdC8vIENoZWNrIGZvciBleGlzdGluZyBpbnN0YW5jZXNcblx0XHRcdGNvbnN0IHdpbmRvd3NPbldvcmtzcGFjZSA9IGNvYWxlc2NlKGFsbFdvcmtzcGFjZXNUb09wZW4ubWFwKHdvcmtzcGFjZVRvT3BlbiA9PiBmaW5kV2luZG93T25Xb3Jrc3BhY2VPckZvbGRlcih0aGlzLmdldFdpbmRvd3MoKSwgd29ya3NwYWNlVG9PcGVuLndvcmtzcGFjZS5jb25maWdQYXRoKSkpO1xuXHRcdFx0aWYgKHdpbmRvd3NPbldvcmtzcGFjZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IHdpbmRvd09uV29ya3NwYWNlID0gd2luZG93c09uV29ya3NwYWNlWzBdO1xuXHRcdFx0XHRjb25zdCBmaWxlc1RvT3BlbkluV2luZG93ID0gaXNFcXVhbEF1dGhvcml0eShmaWxlc1RvT3Blbj8ucmVtb3RlQXV0aG9yaXR5LCB3aW5kb3dPbldvcmtzcGFjZS5yZW1vdGVBdXRob3JpdHkpID8gZmlsZXNUb09wZW4gOiB1bmRlZmluZWQ7XG5cblx0XHRcdFx0Ly8gRG8gb3BlbiBmaWxlc1xuXHRcdFx0XHRhZGRVc2VkV2luZG93KHRoaXMuZG9PcGVuRmlsZXNJbkV4aXN0aW5nV2luZG93KG9wZW5Db25maWcsIHdpbmRvd09uV29ya3NwYWNlLCBmaWxlc1RvT3BlbkluV2luZG93KSwgISFmaWxlc1RvT3BlbkluV2luZG93KTtcblxuXHRcdFx0XHRvcGVuRm9sZGVySW5OZXdXaW5kb3cgPSB0cnVlOyAvLyBhbnkgb3RoZXIgZm9sZGVycyB0byBvcGVuIG11c3Qgb3BlbiBpbiBuZXcgd2luZG93IHRoZW5cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3BlbiByZW1haW5pbmcgb25lc1xuXHRcdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2VUb09wZW4gb2YgYWxsV29ya3NwYWNlc1RvT3Blbikge1xuXHRcdFx0XHRpZiAod2luZG93c09uV29ya3NwYWNlLnNvbWUod2luZG93ID0+IHdpbmRvdy5vcGVuZWRXb3Jrc3BhY2UgJiYgd2luZG93Lm9wZW5lZFdvcmtzcGFjZS5pZCA9PT0gd29ya3NwYWNlVG9PcGVuLndvcmtzcGFjZS5pZCkpIHtcblx0XHRcdFx0XHRjb250aW51ZTsgLy8gaWdub3JlIGZvbGRlcnMgdGhhdCBhcmUgYWxyZWFkeSBvcGVuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB3b3Jrc3BhY2VUb09wZW4ucmVtb3RlQXV0aG9yaXR5O1xuXHRcdFx0XHRjb25zdCBmaWxlc1RvT3BlbkluV2luZG93ID0gaXNFcXVhbEF1dGhvcml0eShmaWxlc1RvT3Blbj8ucmVtb3RlQXV0aG9yaXR5LCByZW1vdGVBdXRob3JpdHkpID8gZmlsZXNUb09wZW4gOiB1bmRlZmluZWQ7XG5cblx0XHRcdFx0Ly8gRG8gb3BlbiBmb2xkZXJcblx0XHRcdFx0YWRkVXNlZFdpbmRvdyhhd2FpdCB0aGlzLmRvT3BlbkZvbGRlck9yV29ya3NwYWNlKG9wZW5Db25maWcsIHdvcmtzcGFjZVRvT3Blbiwgb3BlbkZvbGRlckluTmV3V2luZG93LCBmaWxlc1RvT3BlbkluV2luZG93KSwgISFmaWxlc1RvT3BlbkluV2luZG93KTtcblxuXHRcdFx0XHRvcGVuRm9sZGVySW5OZXdXaW5kb3cgPSB0cnVlOyAvLyBhbnkgb3RoZXIgZm9sZGVycyB0byBvcGVuIG11c3Qgb3BlbiBpbiBuZXcgd2luZG93IHRoZW5cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgZm9sZGVycyB0byBvcGVuIChpbnN0cnVjdGVkIGFuZCB0byByZXN0b3JlKVxuXHRcdGNvbnN0IGFsbEZvbGRlcnNUb09wZW4gPSBkaXN0aW5jdChmb2xkZXJzVG9PcGVuLCBmb2xkZXIgPT4gZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UuZ2V0Q29tcGFyaXNvbktleShmb2xkZXIud29ya3NwYWNlLnVyaSkpOyAvLyBwcmV2ZW50IGR1cGxpY2F0ZXNcblx0XHRpZiAoYWxsRm9sZGVyc1RvT3Blbi5sZW5ndGggPiAwKSB7XG5cblx0XHRcdC8vIENoZWNrIGZvciBleGlzdGluZyBpbnN0YW5jZXNcblx0XHRcdGNvbnN0IHdpbmRvd3NPbkZvbGRlclBhdGggPSBjb2FsZXNjZShhbGxGb2xkZXJzVG9PcGVuLm1hcChmb2xkZXJUb09wZW4gPT4gZmluZFdpbmRvd09uV29ya3NwYWNlT3JGb2xkZXIodGhpcy5nZXRXaW5kb3dzKCksIGZvbGRlclRvT3Blbi53b3Jrc3BhY2UudXJpKSkpO1xuXHRcdFx0aWYgKHdpbmRvd3NPbkZvbGRlclBhdGgubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCB3aW5kb3dPbkZvbGRlclBhdGggPSB3aW5kb3dzT25Gb2xkZXJQYXRoWzBdO1xuXHRcdFx0XHRjb25zdCBmaWxlc1RvT3BlbkluV2luZG93ID0gaXNFcXVhbEF1dGhvcml0eShmaWxlc1RvT3Blbj8ucmVtb3RlQXV0aG9yaXR5LCB3aW5kb3dPbkZvbGRlclBhdGgucmVtb3RlQXV0aG9yaXR5KSA/IGZpbGVzVG9PcGVuIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdC8vIERvIG9wZW4gZmlsZXNcblx0XHRcdFx0YWRkVXNlZFdpbmRvdyh0aGlzLmRvT3BlbkZpbGVzSW5FeGlzdGluZ1dpbmRvdyhvcGVuQ29uZmlnLCB3aW5kb3dPbkZvbGRlclBhdGgsIGZpbGVzVG9PcGVuSW5XaW5kb3cpLCAhIWZpbGVzVG9PcGVuSW5XaW5kb3cpO1xuXG5cdFx0XHRcdG9wZW5Gb2xkZXJJbk5ld1dpbmRvdyA9IHRydWU7IC8vIGFueSBvdGhlciBmb2xkZXJzIHRvIG9wZW4gbXVzdCBvcGVuIGluIG5ldyB3aW5kb3cgdGhlblxuXHRcdFx0fVxuXG5cdFx0XHQvLyBPcGVuIHJlbWFpbmluZyBvbmVzXG5cdFx0XHRmb3IgKGNvbnN0IGZvbGRlclRvT3BlbiBvZiBhbGxGb2xkZXJzVG9PcGVuKSB7XG5cdFx0XHRcdGlmICh3aW5kb3dzT25Gb2xkZXJQYXRoLnNvbWUod2luZG93ID0+IGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3aW5kb3cub3BlbmVkV29ya3NwYWNlKSAmJiBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5pc0VxdWFsKHdpbmRvdy5vcGVuZWRXb3Jrc3BhY2UudXJpLCBmb2xkZXJUb09wZW4ud29ya3NwYWNlLnVyaSkpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7IC8vIGlnbm9yZSBmb2xkZXJzIHRoYXQgYXJlIGFscmVhZHkgb3BlblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gZm9sZGVyVG9PcGVuLnJlbW90ZUF1dGhvcml0eTtcblx0XHRcdFx0Y29uc3QgZmlsZXNUb09wZW5JbldpbmRvdyA9IGlzRXF1YWxBdXRob3JpdHkoZmlsZXNUb09wZW4/LnJlbW90ZUF1dGhvcml0eSwgcmVtb3RlQXV0aG9yaXR5KSA/IGZpbGVzVG9PcGVuIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdC8vIERvIG9wZW4gZm9sZGVyXG5cdFx0XHRcdGFkZFVzZWRXaW5kb3coYXdhaXQgdGhpcy5kb09wZW5Gb2xkZXJPcldvcmtzcGFjZShvcGVuQ29uZmlnLCBmb2xkZXJUb09wZW4sIG9wZW5Gb2xkZXJJbk5ld1dpbmRvdywgZmlsZXNUb09wZW5JbldpbmRvdyksICEhZmlsZXNUb09wZW5JbldpbmRvdyk7XG5cblx0XHRcdFx0b3BlbkZvbGRlckluTmV3V2luZG93ID0gdHJ1ZTsgLy8gYW55IG90aGVyIGZvbGRlcnMgdG8gb3BlbiBtdXN0IG9wZW4gaW4gbmV3IHdpbmRvdyB0aGVuXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIGVtcHR5IHRvIHJlc3RvcmVcblx0XHRjb25zdCBhbGxFbXB0eVRvUmVzdG9yZSA9IGRpc3RpbmN0KGVtcHR5VG9SZXN0b3JlLCBpbmZvID0+IGluZm8uYmFja3VwRm9sZGVyKTsgLy8gcHJldmVudCBkdXBsaWNhdGVzXG5cdFx0aWYgKGFsbEVtcHR5VG9SZXN0b3JlLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgZW1wdHlXaW5kb3dCYWNrdXBJbmZvIG9mIGFsbEVtcHR5VG9SZXN0b3JlKSB7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IGVtcHR5V2luZG93QmFja3VwSW5mby5yZW1vdGVBdXRob3JpdHk7XG5cdFx0XHRcdGNvbnN0IGZpbGVzVG9PcGVuSW5XaW5kb3cgPSBpc0VxdWFsQXV0aG9yaXR5KGZpbGVzVG9PcGVuPy5yZW1vdGVBdXRob3JpdHksIHJlbW90ZUF1dGhvcml0eSkgPyBmaWxlc1RvT3BlbiA6IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRhZGRVc2VkV2luZG93KGF3YWl0IHRoaXMuZG9PcGVuRW1wdHkob3BlbkNvbmZpZywgdHJ1ZSwgcmVtb3RlQXV0aG9yaXR5LCBmaWxlc1RvT3BlbkluV2luZG93LCBlbXB0eVdpbmRvd0JhY2t1cEluZm8pLCAhIWZpbGVzVG9PcGVuSW5XaW5kb3cpO1xuXG5cdFx0XHRcdG9wZW5Gb2xkZXJJbk5ld1dpbmRvdyA9IHRydWU7IC8vIGFueSBvdGhlciBmb2xkZXJzIHRvIG9wZW4gbXVzdCBvcGVuIGluIG5ldyB3aW5kb3cgdGhlblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZpbmFsbHksIG9wZW4gYW4gZW1wdHkgd2luZG93IGlmXG5cdFx0Ly8gLSB3ZSBzdGlsbCBoYXZlIGZpbGVzIHRvIG9wZW5cblx0XHQvLyAtIHVzZXIgZm9yY2VzIGFuIGVtcHR5IHdpbmRvdyAoZS5nLiB2aWEgY29tbWFuZCBsaW5lKVxuXHRcdC8vIC0gbm8gd2luZG93IGhhcyBvcGVuZWQgeWV0XG5cdFx0aWYgKGZpbGVzVG9PcGVuIHx8IChtYXliZU9wZW5FbXB0eVdpbmRvdyAmJiAob3BlbkNvbmZpZy5mb3JjZUVtcHR5IHx8IHVzZWRXaW5kb3dzLmxlbmd0aCA9PT0gMCkpKSB7XG5cdFx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSBmaWxlc1RvT3BlbiA/IGZpbGVzVG9PcGVuLnJlbW90ZUF1dGhvcml0eSA6IG9wZW5Db25maWcucmVtb3RlQXV0aG9yaXR5O1xuXG5cdFx0XHRhZGRVc2VkV2luZG93KGF3YWl0IHRoaXMuZG9PcGVuRW1wdHkob3BlbkNvbmZpZywgb3BlbkZvbGRlckluTmV3V2luZG93LCByZW1vdGVBdXRob3JpdHksIGZpbGVzVG9PcGVuKSwgISFmaWxlc1RvT3Blbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgd2luZG93czogZGlzdGluY3QodXNlZFdpbmRvd3MpLCBmaWxlc09wZW5lZEluV2luZG93IH07XG5cdH1cblxuXHRwcml2YXRlIGRvT3BlbkZpbGVzSW5FeGlzdGluZ1dpbmRvdyhjb25maWd1cmF0aW9uOiBJT3BlbkNvbmZpZ3VyYXRpb24sIHdpbmRvdzogSUNvZGVXaW5kb3csIGZpbGVzVG9PcGVuPzogSUZpbGVzVG9PcGVuKTogSUNvZGVXaW5kb3cge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnd2luZG93c01hbmFnZXIjZG9PcGVuRmlsZXNJbkV4aXN0aW5nV2luZG93JywgeyBmaWxlc1RvT3BlbiB9KTtcblxuXHRcdHRoaXMuZm9jdXNNYWluT3JDaGlsZFdpbmRvdyh3aW5kb3cpOyAvLyBtYWtlIHN1cmUgd2luZG93IG9yIGFueSBvZiB0aGUgY2hpbGRyZW4gaGFzIGZvY3VzXG5cblx0XHRjb25zdCBwYXJhbXM6IElOYXRpdmVPcGVuRmlsZVJlcXVlc3QgPSB7XG5cdFx0XHRmaWxlc1RvT3Blbk9yQ3JlYXRlOiBmaWxlc1RvT3Blbj8uZmlsZXNUb09wZW5PckNyZWF0ZSxcblx0XHRcdGZpbGVzVG9EaWZmOiBmaWxlc1RvT3Blbj8uZmlsZXNUb0RpZmYsXG5cdFx0XHRmaWxlc1RvTWVyZ2U6IGZpbGVzVG9PcGVuPy5maWxlc1RvTWVyZ2UsXG5cdFx0XHRmaWxlc1RvV2FpdDogZmlsZXNUb09wZW4/LmZpbGVzVG9XYWl0LFxuXHRcdFx0dGVybVByb2dyYW06IGNvbmZpZ3VyYXRpb24/LnVzZXJFbnY/LlsnVEVSTV9QUk9HUkFNJ11cblx0XHR9O1xuXHRcdHdpbmRvdy5zZW5kV2hlblJlYWR5KCd2c2NvZGU6b3BlbkZpbGVzJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgcGFyYW1zKTtcblxuXHRcdHJldHVybiB3aW5kb3c7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzTWFpbk9yQ2hpbGRXaW5kb3cobWFpbldpbmRvdzogSUNvZGVXaW5kb3cpOiB2b2lkIHtcblx0XHRsZXQgd2luZG93VG9Gb2N1czogSUNvZGVXaW5kb3cgfCBJQXV4aWxpYXJ5V2luZG93ID0gbWFpbldpbmRvdztcblxuXHRcdGNvbnN0IGZvY3VzZWRXaW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcblx0XHRpZiAoZm9jdXNlZFdpbmRvdyAmJiBmb2N1c2VkV2luZG93LmlkICE9PSBtYWluV2luZG93LmlkKSB7XG5cdFx0XHRjb25zdCBhdXhpbGlhcnlXaW5kb3dDYW5kaWRhdGUgPSB0aGlzLmF1eGlsaWFyeVdpbmRvd3NNYWluU2VydmljZS5nZXRXaW5kb3dCeVdlYkNvbnRlbnRzKGZvY3VzZWRXaW5kb3cud2ViQ29udGVudHMpO1xuXHRcdFx0aWYgKGF1eGlsaWFyeVdpbmRvd0NhbmRpZGF0ZSAmJiBhdXhpbGlhcnlXaW5kb3dDYW5kaWRhdGUucGFyZW50SWQgPT09IG1haW5XaW5kb3cuaWQpIHtcblx0XHRcdFx0d2luZG93VG9Gb2N1cyA9IGF1eGlsaWFyeVdpbmRvd0NhbmRpZGF0ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR3aW5kb3dUb0ZvY3VzLmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIGRvQWRkUmVtb3ZlRm9sZGVyc0luRXhpc3RpbmdXaW5kb3cod2luZG93OiBJQ29kZVdpbmRvdywgZm9sZGVyc1RvQWRkOiBVUklbXSwgZm9sZGVyc1RvUmVtb3ZlOiBVUklbXSk6IElDb2RlV2luZG93IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ3dpbmRvd3NNYW5hZ2VyI2RvQWRkUmVtb3ZlRm9sZGVyc1RvRXhpc3RpbmdXaW5kb3cnLCB7IGZvbGRlcnNUb0FkZCwgZm9sZGVyc1RvUmVtb3ZlIH0pO1xuXG5cdFx0d2luZG93LmZvY3VzKCk7IC8vIG1ha2Ugc3VyZSB3aW5kb3cgaGFzIGZvY3VzXG5cblx0XHRjb25zdCByZXF1ZXN0OiBJQWRkUmVtb3ZlRm9sZGVyc1JlcXVlc3QgPSB7IGZvbGRlcnNUb0FkZCwgZm9sZGVyc1RvUmVtb3ZlIH07XG5cdFx0d2luZG93LnNlbmRXaGVuUmVhZHkoJ3ZzY29kZTphZGRSZW1vdmVGb2xkZXJzJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgcmVxdWVzdCk7XG5cblx0XHRyZXR1cm4gd2luZG93O1xuXHR9XG5cblx0cHJpdmF0ZSBkb09wZW5FbXB0eShvcGVuQ29uZmlnOiBJT3BlbkNvbmZpZ3VyYXRpb24sIGZvcmNlTmV3V2luZG93OiBib29sZWFuLCByZW1vdGVBdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZCwgZmlsZXNUb09wZW46IElGaWxlc1RvT3BlbiB8IHVuZGVmaW5lZCwgZW1wdHlXaW5kb3dCYWNrdXBJbmZvPzogSUVtcHR5V2luZG93QmFja3VwSW5mbyk6IFByb21pc2U8SUNvZGVXaW5kb3c+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ3dpbmRvd3NNYW5hZ2VyI2RvT3BlbkVtcHR5JywgeyByZXN0b3JlOiAhIWVtcHR5V2luZG93QmFja3VwSW5mbywgcmVtb3RlQXV0aG9yaXR5LCBmaWxlc1RvT3BlbiwgZm9yY2VOZXdXaW5kb3cgfSk7XG5cblx0XHRsZXQgd2luZG93VG9Vc2U6IElDb2RlV2luZG93IHwgdW5kZWZpbmVkO1xuXHRcdGlmICghZm9yY2VOZXdXaW5kb3cgJiYgdHlwZW9mIG9wZW5Db25maWcuY29udGV4dFdpbmRvd0lkID09PSAnbnVtYmVyJykge1xuXHRcdFx0d2luZG93VG9Vc2UgPSB0aGlzLmdldFdpbmRvd0J5SWQob3BlbkNvbmZpZy5jb250ZXh0V2luZG93SWQpOyAvLyBmaXggZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85NzE3MlxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLm9wZW5JbkJyb3dzZXJXaW5kb3coe1xuXHRcdFx0dXNlckVudjogb3BlbkNvbmZpZy51c2VyRW52LFxuXHRcdFx0Y2xpOiBvcGVuQ29uZmlnLmNsaSxcblx0XHRcdGluaXRpYWxTdGFydHVwOiBvcGVuQ29uZmlnLmluaXRpYWxTdGFydHVwLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0Zm9yY2VOZXdXaW5kb3csXG5cdFx0XHRmb3JjZU5ld1RhYmJlZFdpbmRvdzogb3BlbkNvbmZpZy5mb3JjZU5ld1RhYmJlZFdpbmRvdyxcblx0XHRcdGZpbGVzVG9PcGVuLFxuXHRcdFx0d2luZG93VG9Vc2UsXG5cdFx0XHRlbXB0eVdpbmRvd0JhY2t1cEluZm8sXG5cdFx0XHRmb3JjZVByb2ZpbGU6IG9wZW5Db25maWcuZm9yY2VQcm9maWxlLFxuXHRcdFx0Zm9yY2VUZW1wUHJvZmlsZTogb3BlbkNvbmZpZy5mb3JjZVRlbXBQcm9maWxlXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRvT3BlbkZvbGRlck9yV29ya3NwYWNlKG9wZW5Db25maWc6IElPcGVuQ29uZmlndXJhdGlvbiwgZm9sZGVyT3JXb3Jrc3BhY2U6IElXb3Jrc3BhY2VQYXRoVG9PcGVuIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW4sIGZvcmNlTmV3V2luZG93OiBib29sZWFuLCBmaWxlc1RvT3BlbjogSUZpbGVzVG9PcGVuIHwgdW5kZWZpbmVkLCB3aW5kb3dUb1VzZT86IElDb2RlV2luZG93KTogUHJvbWlzZTxJQ29kZVdpbmRvdz4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnd2luZG93c01hbmFnZXIjZG9PcGVuRm9sZGVyT3JXb3Jrc3BhY2UnLCB7IGZvbGRlck9yV29ya3NwYWNlLCBmaWxlc1RvT3BlbiB9KTtcblxuXHRcdGlmICghZm9yY2VOZXdXaW5kb3cgJiYgIXdpbmRvd1RvVXNlICYmIHR5cGVvZiBvcGVuQ29uZmlnLmNvbnRleHRXaW5kb3dJZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdHdpbmRvd1RvVXNlID0gdGhpcy5nZXRXaW5kb3dCeUlkKG9wZW5Db25maWcuY29udGV4dFdpbmRvd0lkKTsgLy8gZml4IGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDk1ODdcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5vcGVuSW5Ccm93c2VyV2luZG93KHtcblx0XHRcdHdvcmtzcGFjZTogZm9sZGVyT3JXb3Jrc3BhY2Uud29ya3NwYWNlLFxuXHRcdFx0dXNlckVudjogb3BlbkNvbmZpZy51c2VyRW52LFxuXHRcdFx0Y2xpOiBvcGVuQ29uZmlnLmNsaSxcblx0XHRcdGluaXRpYWxTdGFydHVwOiBvcGVuQ29uZmlnLmluaXRpYWxTdGFydHVwLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBmb2xkZXJPcldvcmtzcGFjZS5yZW1vdGVBdXRob3JpdHksXG5cdFx0XHRmb3JjZU5ld1dpbmRvdyxcblx0XHRcdGZvcmNlTmV3VGFiYmVkV2luZG93OiBvcGVuQ29uZmlnLmZvcmNlTmV3VGFiYmVkV2luZG93LFxuXHRcdFx0ZmlsZXNUb09wZW4sXG5cdFx0XHR3aW5kb3dUb1VzZSxcblx0XHRcdGZvcmNlUHJvZmlsZTogb3BlbkNvbmZpZy5mb3JjZVByb2ZpbGUsXG5cdFx0XHRmb3JjZVRlbXBQcm9maWxlOiBvcGVuQ29uZmlnLmZvcmNlVGVtcFByb2ZpbGVcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UGF0aHNUb09wZW4ob3BlbkNvbmZpZzogSU9wZW5Db25maWd1cmF0aW9uKTogUHJvbWlzZTxJUGF0aFRvT3BlbltdPiB7XG5cdFx0bGV0IHBhdGhzVG9PcGVuOiBJUGF0aFRvT3BlbltdO1xuXHRcdGxldCBpc0NvbW1hbmRMaW5lT3JBUElDYWxsID0gZmFsc2U7XG5cdFx0bGV0IGlzUmVzdG9yaW5nUGF0aHMgPSBmYWxzZTtcblxuXHRcdC8vIEV4dHJhY3QgcGF0aHM6IGZyb20gQVBJXG5cdFx0aWYgKG9wZW5Db25maWcudXJpc1RvT3BlbiAmJiBvcGVuQ29uZmlnLnVyaXNUb09wZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0cGF0aHNUb09wZW4gPSBhd2FpdCB0aGlzLmRvRXh0cmFjdFBhdGhzRnJvbUFQSShvcGVuQ29uZmlnKTtcblx0XHRcdGlzQ29tbWFuZExpbmVPckFQSUNhbGwgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBmb3JjZSBlbXB0eVxuXHRcdGVsc2UgaWYgKG9wZW5Db25maWcuZm9yY2VFbXB0eSkge1xuXHRcdFx0cGF0aHNUb09wZW4gPSBbRU1QVFlfV0lORE9XXTtcblx0XHR9XG5cblx0XHQvLyBFeHRyYWN0IHBhdGhzOiBmcm9tIENMSVxuXHRcdGVsc2UgaWYgKG9wZW5Db25maWcuY2xpLl8ubGVuZ3RoIHx8IG9wZW5Db25maWcuY2xpWydmb2xkZXItdXJpJ10gfHwgb3BlbkNvbmZpZy5jbGlbJ2ZpbGUtdXJpJ10pIHtcblx0XHRcdHBhdGhzVG9PcGVuID0gYXdhaXQgdGhpcy5kb0V4dHJhY3RQYXRoc0Zyb21DTEkob3BlbkNvbmZpZy5jbGkpO1xuXHRcdFx0aWYgKHBhdGhzVG9PcGVuLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRwYXRoc1RvT3Blbi5wdXNoKEVNUFRZX1dJTkRPVyk7IC8vIGFkZCBhbiBlbXB0eSB3aW5kb3cgaWYgd2UgZGlkIG5vdCBoYXZlIHdpbmRvd3MgdG8gb3BlbiBmcm9tIGNvbW1hbmQgbGluZVxuXHRcdFx0fVxuXG5cdFx0XHRpc0NvbW1hbmRMaW5lT3JBUElDYWxsID0gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBFeHRyYWN0IHBhdGhzOiBmcm9tIHByZXZpb3VzIHNlc3Npb25cblx0XHRlbHNlIHtcblx0XHRcdHBhdGhzVG9PcGVuID0gYXdhaXQgdGhpcy5kb0dldFBhdGhzRnJvbUxhc3RTZXNzaW9uKCk7XG5cdFx0XHRpZiAocGF0aHNUb09wZW4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHBhdGhzVG9PcGVuLnB1c2goRU1QVFlfV0lORE9XKTsgLy8gYWRkIGFuIGVtcHR5IHdpbmRvdyBpZiB3ZSBkaWQgbm90IGhhdmUgd2luZG93cyB0byByZXN0b3JlXG5cdFx0XHR9XG5cblx0XHRcdGlzUmVzdG9yaW5nUGF0aHMgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSB0aGUgY2FzZSBvZiBtdWx0aXBsZSBmb2xkZXJzIGJlaW5nIG9wZW5lZCBmcm9tIENMSSB3aGlsZSB3ZSBhcmVcblx0XHQvLyBub3QgaW4gYC0tYWRkYCBvciBgLS1yZW1vdmVgIG1vZGUgYnkgY3JlYXRpbmcgYW4gdW50aXRsZWQgd29ya3NwYWNlLCBvbmx5IGlmOlxuXHRcdC8vIC0gdGhleSBhbGwgc2hhcmUgdGhlIHNhbWUgcmVtb3RlIGF1dGhvcml0eVxuXHRcdC8vIC0gdGhlcmUgaXMgbm8gZXhpc3Rpbmcgd29ya3NwYWNlIHRvIG9wZW4gdGhhdCBtYXRjaGVzIHRoZXNlIGZvbGRlcnNcblx0XHRpZiAoIW9wZW5Db25maWcuYWRkTW9kZSAmJiAhb3BlbkNvbmZpZy5yZW1vdmVNb2RlICYmIGlzQ29tbWFuZExpbmVPckFQSUNhbGwpIHtcblx0XHRcdGNvbnN0IGZvbGRlcnNUb09wZW4gPSBwYXRoc1RvT3Blbi5maWx0ZXIocGF0aCA9PiBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZVBhdGhUb09wZW4ocGF0aCkpO1xuXHRcdFx0aWYgKGZvbGRlcnNUb09wZW4ubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSBmb2xkZXJzVG9PcGVuWzBdLnJlbW90ZUF1dGhvcml0eTtcblx0XHRcdFx0aWYgKGZvbGRlcnNUb09wZW4uZXZlcnkoZm9sZGVyVG9PcGVuID0+IGlzRXF1YWxBdXRob3JpdHkoZm9sZGVyVG9PcGVuLnJlbW90ZUF1dGhvcml0eSwgcmVtb3RlQXV0aG9yaXR5KSkpIHtcblx0XHRcdFx0XHRsZXQgd29ya3NwYWNlOiBJV29ya3NwYWNlSWRlbnRpZmllciB8IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRcdGNvbnN0IGxhc3RTZXNzaW9uV29ya3NwYWNlTWF0Y2hpbmdGb2xkZXJzID0gYXdhaXQgdGhpcy5kb0dldFdvcmtzcGFjZU1hdGNoaW5nRm9sZGVyc0Zyb21MYXN0U2Vzc2lvbihyZW1vdGVBdXRob3JpdHksIGZvbGRlcnNUb09wZW4pO1xuXHRcdFx0XHRcdGlmIChsYXN0U2Vzc2lvbldvcmtzcGFjZU1hdGNoaW5nRm9sZGVycykge1xuXHRcdFx0XHRcdFx0d29ya3NwYWNlID0gbGFzdFNlc3Npb25Xb3Jrc3BhY2VNYXRjaGluZ0ZvbGRlcnM7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHdvcmtzcGFjZSA9IGF3YWl0IHRoaXMud29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5jcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShmb2xkZXJzVG9PcGVuLm1hcChmb2xkZXIgPT4gKHsgdXJpOiBmb2xkZXIud29ya3NwYWNlLnVyaSB9KSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEFkZCB3b3Jrc3BhY2UgYW5kIHJlbW92ZSBmb2xkZXJzIHRoZXJlYnlcblx0XHRcdFx0XHRwYXRoc1RvT3Blbi5wdXNoKHsgd29ya3NwYWNlLCByZW1vdGVBdXRob3JpdHkgfSk7XG5cdFx0XHRcdFx0cGF0aHNUb09wZW4gPSBwYXRoc1RvT3Blbi5maWx0ZXIocGF0aCA9PiAhaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VQYXRoVG9PcGVuKHBhdGgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENoZWNrIGZvciBgd2luZG93LnJlc3RvcmVXaW5kb3dzYCBzZXR0aW5nIHRvIGluY2x1ZGUgYWxsIHdpbmRvd3Ncblx0XHQvLyBmcm9tIHRoZSBwcmV2aW91cyBzZXNzaW9uIGlmIHRoaXMgaXMgdGhlIGluaXRpYWwgc3RhcnR1cCBhbmQgd2UgaGF2ZVxuXHRcdC8vIG5vdCByZXN0b3JlZCB3aW5kb3dzIGFscmVhZHkgb3RoZXJ3aXNlLlxuXHRcdC8vIFVzZSBgdW5zaGlmdGAgdG8gZW5zdXJlIGFueSBuZXcgd2luZG93IHRvIG9wZW4gY29tZXMgbGFzdCBmb3IgcHJvcGVyXG5cdFx0Ly8gZm9jdXMgdHJlYXRtZW50LlxuXHRcdGlmIChvcGVuQ29uZmlnLmluaXRpYWxTdGFydHVwICYmICFpc1Jlc3RvcmluZ1BhdGhzICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVdpbmRvd1NldHRpbmdzIHwgdW5kZWZpbmVkPignd2luZG93Jyk/LnJlc3RvcmVXaW5kb3dzID09PSAncHJlc2VydmUnKSB7XG5cdFx0XHRjb25zdCBsYXN0U2Vzc2lvblBhdGhzID0gYXdhaXQgdGhpcy5kb0dldFBhdGhzRnJvbUxhc3RTZXNzaW9uKCk7XG5cdFx0XHRwYXRoc1RvT3Blbi51bnNoaWZ0KC4uLmxhc3RTZXNzaW9uUGF0aHMuZmlsdGVyKHBhdGggPT4gaXNXb3Jrc3BhY2VQYXRoVG9PcGVuKHBhdGgpIHx8IGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoKSB8fCBwYXRoLmJhY2t1cFBhdGgpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGF0aHNUb09wZW47XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvRXh0cmFjdFBhdGhzRnJvbUFQSShvcGVuQ29uZmlnOiBJT3BlbkNvbmZpZ3VyYXRpb24pOiBQcm9taXNlPElQYXRoVG9PcGVuW10+IHtcblx0XHRjb25zdCBwYXRoUmVzb2x2ZU9wdGlvbnM6IElQYXRoUmVzb2x2ZU9wdGlvbnMgPSB7XG5cdFx0XHRnb3RvTGluZU1vZGU6IG9wZW5Db25maWcuZ290b0xpbmVNb2RlLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBvcGVuQ29uZmlnLnJlbW90ZUF1dGhvcml0eVxuXHRcdH07XG5cblx0XHRjb25zdCBwYXRoc1RvT3BlbiA9IGF3YWl0IFByb21pc2UuYWxsKGNvYWxlc2NlKG9wZW5Db25maWcudXJpc1RvT3BlbiB8fCBbXSkubWFwKGFzeW5jIHBhdGhUb09wZW4gPT4ge1xuXHRcdFx0Y29uc3QgcGF0aCA9IGF3YWl0IHRoaXMucmVzb2x2ZU9wZW5hYmxlKHBhdGhUb09wZW4sIHBhdGhSZXNvbHZlT3B0aW9ucyk7XG5cblx0XHRcdC8vIFBhdGggZXhpc3RzXG5cdFx0XHRpZiAocGF0aCkge1xuXHRcdFx0XHRwYXRoLmxhYmVsID0gcGF0aFRvT3Blbi5sYWJlbDtcblxuXHRcdFx0XHRyZXR1cm4gcGF0aDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUGF0aCBkb2VzIG5vdCBleGlzdDogc2hvdyBhIHdhcm5pbmcgYm94XG5cdFx0XHRjb25zdCB1cmkgPSB0aGlzLnJlc291cmNlRnJvbU9wZW5hYmxlKHBhdGhUb09wZW4pO1xuXG5cdFx0XHR0aGlzLmRpYWxvZ01haW5TZXJ2aWNlLnNob3dNZXNzYWdlQm94KHtcblx0XHRcdFx0dHlwZTogJ2luZm8nLFxuXHRcdFx0XHRidXR0b25zOiBbbG9jYWxpemUoeyBrZXk6ICdvaycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9LXCIpXSxcblx0XHRcdFx0bWVzc2FnZTogdXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gbG9jYWxpemUoJ3BhdGhOb3RFeGlzdFRpdGxlJywgXCJQYXRoIGRvZXMgbm90IGV4aXN0XCIpIDogbG9jYWxpemUoJ3VyaUludmFsaWRUaXRsZScsIFwiVVJJIGNhbiBub3QgYmUgb3BlbmVkXCIpLFxuXHRcdFx0XHRkZXRhaWw6IHVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ3BhdGhOb3RFeGlzdERldGFpbCcsIFwiVGhlIHBhdGggJ3swfScgZG9lcyBub3QgZXhpc3Qgb24gdGhpcyBjb21wdXRlci5cIiwgZ2V0UGF0aExhYmVsKHVyaSwgeyBvczogT1MsIHRpbGRpZnk6IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZSB9KSkgOlxuXHRcdFx0XHRcdGxvY2FsaXplKCd1cmlJbnZhbGlkRGV0YWlsJywgXCJUaGUgVVJJICd7MH0nIGlzIG5vdCB2YWxpZCBhbmQgY2FuIG5vdCBiZSBvcGVuZWQuXCIsIHVyaS50b1N0cmluZyh0cnVlKSlcblx0XHRcdH0sIEJyb3dzZXJXaW5kb3cuZ2V0Rm9jdXNlZFdpbmRvdygpID8/IHVuZGVmaW5lZCk7XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGNvYWxlc2NlKHBhdGhzVG9PcGVuKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9FeHRyYWN0UGF0aHNGcm9tQ0xJKGNsaTogTmF0aXZlUGFyc2VkQXJncyk6IFByb21pc2U8SVBhdGhbXT4ge1xuXHRcdGNvbnN0IHBhdGhzVG9PcGVuOiBJUGF0aFRvT3BlbltdID0gW107XG5cdFx0Y29uc3QgcGF0aFJlc29sdmVPcHRpb25zOiBJUGF0aFJlc29sdmVPcHRpb25zID0ge1xuXHRcdFx0aWdub3JlRmlsZU5vdEZvdW5kOiB0cnVlLFxuXHRcdFx0Z290b0xpbmVNb2RlOiBjbGkuZ290byxcblx0XHRcdHJlbW90ZUF1dGhvcml0eTogY2xpLnJlbW90ZSB8fCB1bmRlZmluZWQsXG5cdFx0XHRmb3JjZU9wZW5Xb3Jrc3BhY2VBc0ZpbGU6XG5cdFx0XHRcdC8vIHNwZWNpYWwgY2FzZSBkaWZmIC8gbWVyZ2UgbW9kZSB0byBmb3JjZSBvcGVuXG5cdFx0XHRcdC8vIHdvcmtzcGFjZSBhcyBmaWxlXG5cdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDk3MzFcblx0XHRcdFx0Y2xpLmRpZmYgJiYgY2xpLl8ubGVuZ3RoID09PSAyIHx8XG5cdFx0XHRcdGNsaS5tZXJnZSAmJiBjbGkuXy5sZW5ndGggPT09IDRcblx0XHR9O1xuXG5cdFx0Ly8gZm9sZGVyIHVyaXNcblx0XHRjb25zdCBmb2xkZXJVcmlzID0gY2xpWydmb2xkZXItdXJpJ107XG5cdFx0aWYgKGZvbGRlclVyaXMpIHtcblx0XHRcdGNvbnN0IHJlc29sdmVkRm9sZGVyVXJpcyA9IGF3YWl0IFByb21pc2UuYWxsKGZvbGRlclVyaXMubWFwKHJhd0ZvbGRlclVyaSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlclVyaSA9IHRoaXMuY2xpQXJnVG9VcmkocmF3Rm9sZGVyVXJpKTtcblx0XHRcdFx0aWYgKCFmb2xkZXJVcmkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZU9wZW5hYmxlKHsgZm9sZGVyVXJpIH0sIHBhdGhSZXNvbHZlT3B0aW9ucyk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHBhdGhzVG9PcGVuLnB1c2goLi4uY29hbGVzY2UocmVzb2x2ZWRGb2xkZXJVcmlzKSk7XG5cdFx0fVxuXG5cdFx0Ly8gZmlsZSB1cmlzXG5cdFx0Y29uc3QgZmlsZVVyaXMgPSBjbGlbJ2ZpbGUtdXJpJ107XG5cdFx0aWYgKGZpbGVVcmlzKSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZEZpbGVVcmlzID0gYXdhaXQgUHJvbWlzZS5hbGwoZmlsZVVyaXMubWFwKHJhd0ZpbGVVcmkgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlVXJpID0gdGhpcy5jbGlBcmdUb1VyaShyYXdGaWxlVXJpKTtcblx0XHRcdFx0aWYgKCFmaWxlVXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0aGlzLnJlc29sdmVPcGVuYWJsZShoYXNXb3Jrc3BhY2VGaWxlRXh0ZW5zaW9uKHJhd0ZpbGVVcmkpID8geyB3b3Jrc3BhY2VVcmk6IGZpbGVVcmkgfSA6IHsgZmlsZVVyaSB9LCBwYXRoUmVzb2x2ZU9wdGlvbnMpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRwYXRoc1RvT3Blbi5wdXNoKC4uLmNvYWxlc2NlKHJlc29sdmVkRmlsZVVyaXMpKTtcblx0XHR9XG5cblx0XHQvLyBmb2xkZXIgb3IgZmlsZSBwYXRoc1xuXHRcdGNvbnN0IHJlc29sdmVkQ2xpUGF0aHMgPSBhd2FpdCBQcm9taXNlLmFsbChjbGkuXy5tYXAoY2xpUGF0aCA9PiB7XG5cdFx0XHRyZXR1cm4gcGF0aFJlc29sdmVPcHRpb25zLnJlbW90ZUF1dGhvcml0eSA/IHRoaXMuZG9SZXNvbHZlUmVtb3RlUGF0aChjbGlQYXRoLCBwYXRoUmVzb2x2ZU9wdGlvbnMpIDogdGhpcy5kb1Jlc29sdmVGaWxlUGF0aChjbGlQYXRoLCBwYXRoUmVzb2x2ZU9wdGlvbnMpO1xuXHRcdH0pKTtcblxuXHRcdHBhdGhzVG9PcGVuLnB1c2goLi4uY29hbGVzY2UocmVzb2x2ZWRDbGlQYXRocykpO1xuXG5cdFx0cmV0dXJuIHBhdGhzVG9PcGVuO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGlBcmdUb1VyaShhcmc6IHN0cmluZyk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZShhcmcpO1xuXHRcdFx0aWYgKCF1cmkuc2NoZW1lKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgSW52YWxpZCBVUkkgaW5wdXQgc3RyaW5nLCBzY2hlbWUgbWlzc2luZzogJHthcmd9YCk7XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmICghdXJpLnBhdGgpIHtcblx0XHRcdFx0cmV0dXJuIHVyaS53aXRoKHsgcGF0aDogJy8nIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdXJpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgSW52YWxpZCBVUkkgaW5wdXQgc3RyaW5nOiAke2FyZ30sICR7ZS5tZXNzYWdlfWApO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvR2V0UGF0aHNGcm9tTGFzdFNlc3Npb24oKTogUHJvbWlzZTxJUGF0aFRvT3BlbltdPiB7XG5cdFx0Y29uc3QgcmVzdG9yZVdpbmRvd3NTZXR0aW5nID0gdGhpcy5nZXRSZXN0b3JlV2luZG93c1NldHRpbmcoKTtcblxuXHRcdHN3aXRjaCAocmVzdG9yZVdpbmRvd3NTZXR0aW5nKSB7XG5cblx0XHRcdC8vIG5vbmU6IG5vIHdpbmRvdyB0byByZXN0b3JlXG5cdFx0XHRjYXNlICdub25lJzpcblx0XHRcdFx0cmV0dXJuIFtdO1xuXG5cdFx0XHQvLyBvbmU6IHJlc3RvcmUgbGFzdCBvcGVuZWQgd29ya3NwYWNlL2ZvbGRlciBvciBlbXB0eSB3aW5kb3dcblx0XHRcdC8vIGFsbDogcmVzdG9yZSBhbGwgd2luZG93c1xuXHRcdFx0Ly8gZm9sZGVyczogcmVzdG9yZSBsYXN0IG9wZW5lZCBmb2xkZXJzIG9ubHlcblx0XHRcdGNhc2UgJ29uZSc6XG5cdFx0XHRjYXNlICdhbGwnOlxuXHRcdFx0Y2FzZSAncHJlc2VydmUnOlxuXHRcdFx0Y2FzZSAnZm9sZGVycyc6IHtcblxuXHRcdFx0XHQvLyBDb2xsZWN0IHByZXZpb3VzbHkgb3BlbmVkIHdpbmRvd3Ncblx0XHRcdFx0Y29uc3QgbGFzdFNlc3Npb25XaW5kb3dzOiBJV2luZG93U3RhdGVbXSA9IFtdO1xuXHRcdFx0XHRpZiAocmVzdG9yZVdpbmRvd3NTZXR0aW5nICE9PSAnb25lJykge1xuXHRcdFx0XHRcdGxhc3RTZXNzaW9uV2luZG93cy5wdXNoKC4uLnRoaXMud2luZG93c1N0YXRlSGFuZGxlci5zdGF0ZS5vcGVuZWRXaW5kb3dzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy53aW5kb3dzU3RhdGVIYW5kbGVyLnN0YXRlLmxhc3RBY3RpdmVXaW5kb3cpIHtcblx0XHRcdFx0XHRsYXN0U2Vzc2lvbldpbmRvd3MucHVzaCh0aGlzLndpbmRvd3NTdGF0ZUhhbmRsZXIuc3RhdGUubGFzdEFjdGl2ZVdpbmRvdyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBwYXRoc1RvT3BlbiA9IGF3YWl0IFByb21pc2UuYWxsKGxhc3RTZXNzaW9uV2luZG93cy5tYXAoYXN5bmMgbGFzdFNlc3Npb25XaW5kb3cgPT4ge1xuXG5cdFx0XHRcdFx0Ly8gV29ya3NwYWNlc1xuXHRcdFx0XHRcdGlmIChsYXN0U2Vzc2lvbldpbmRvdy53b3Jrc3BhY2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhdGhUb09wZW4gPSBhd2FpdCB0aGlzLnJlc29sdmVPcGVuYWJsZSh7IHdvcmtzcGFjZVVyaTogbGFzdFNlc3Npb25XaW5kb3cud29ya3NwYWNlLmNvbmZpZ1BhdGggfSwgeyByZW1vdGVBdXRob3JpdHk6IGxhc3RTZXNzaW9uV2luZG93LnJlbW90ZUF1dGhvcml0eSwgcmVqZWN0VHJhbnNpZW50V29ya3NwYWNlczogdHJ1ZSAvKiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE5Njk1ICovIH0pO1xuXHRcdFx0XHRcdFx0aWYgKGlzV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoVG9PcGVuKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcGF0aFRvT3Blbjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBGb2xkZXJzXG5cdFx0XHRcdFx0ZWxzZSBpZiAobGFzdFNlc3Npb25XaW5kb3cuZm9sZGVyVXJpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBwYXRoVG9PcGVuID0gYXdhaXQgdGhpcy5yZXNvbHZlT3BlbmFibGUoeyBmb2xkZXJVcmk6IGxhc3RTZXNzaW9uV2luZG93LmZvbGRlclVyaSB9LCB7IHJlbW90ZUF1dGhvcml0eTogbGFzdFNlc3Npb25XaW5kb3cucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdFx0XHRcdFx0aWYgKGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoVG9PcGVuKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcGF0aFRvT3Blbjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBFbXB0eSB3aW5kb3csIHBvdGVudGlhbGx5IGVkaXRvcnMgb3BlbiB0byBiZSByZXN0b3JlZFxuXHRcdFx0XHRcdGVsc2UgaWYgKHJlc3RvcmVXaW5kb3dzU2V0dGluZyAhPT0gJ2ZvbGRlcnMnICYmIGxhc3RTZXNzaW9uV2luZG93LmJhY2t1cFBhdGgpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7IGJhY2t1cFBhdGg6IGxhc3RTZXNzaW9uV2luZG93LmJhY2t1cFBhdGgsIHJlbW90ZUF1dGhvcml0eTogbGFzdFNlc3Npb25XaW5kb3cucmVtb3RlQXV0aG9yaXR5IH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHJldHVybiBjb2FsZXNjZShwYXRoc1RvT3Blbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZXN0b3JlV2luZG93c1NldHRpbmcoKTogUmVzdG9yZVdpbmRvd3NTZXR0aW5nIHtcblx0XHRsZXQgcmVzdG9yZVdpbmRvd3M6IFJlc3RvcmVXaW5kb3dzU2V0dGluZztcblx0XHRpZiAodGhpcy5saWZlY3ljbGVNYWluU2VydmljZS53YXNSZXN0YXJ0ZWQpIHtcblx0XHRcdHJlc3RvcmVXaW5kb3dzID0gJ2FsbCc7IC8vIGFsd2F5cyByZW9wZW4gYWxsIHdpbmRvd3Mgd2hlbiBhbiB1cGRhdGUgd2FzIGFwcGxpZWRcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3Qgd2luZG93Q29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJV2luZG93U2V0dGluZ3MgfCB1bmRlZmluZWQ+KCd3aW5kb3cnKTtcblx0XHRcdHJlc3RvcmVXaW5kb3dzID0gd2luZG93Q29uZmlnPy5yZXN0b3JlV2luZG93cyB8fCAnYWxsJzsgLy8gYnkgZGVmYXVsdCByZXN0b3JlIGFsbCB3aW5kb3dzXG5cblx0XHRcdGlmICghWydwcmVzZXJ2ZScsICdhbGwnLCAnZm9sZGVycycsICdvbmUnLCAnbm9uZSddLmluY2x1ZGVzKHJlc3RvcmVXaW5kb3dzKSkge1xuXHRcdFx0XHRyZXN0b3JlV2luZG93cyA9ICdhbGwnOyAvLyBieSBkZWZhdWx0IHJlc3RvcmUgYWxsIHdpbmRvd3Ncblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdG9yZVdpbmRvd3M7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvR2V0V29ya3NwYWNlTWF0Y2hpbmdGb2xkZXJzRnJvbUxhc3RTZXNzaW9uKHJlbW90ZUF1dGhvcml0eTogc3RyaW5nIHwgdW5kZWZpbmVkLCBmb2xkZXJzOiBJU2luZ2xlRm9sZGVyV29ya3NwYWNlUGF0aFRvT3BlbltdKTogUHJvbWlzZTxJV29ya3NwYWNlSWRlbnRpZmllciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZXMgPSAoYXdhaXQgdGhpcy5kb0dldFBhdGhzRnJvbUxhc3RTZXNzaW9uKCkpLmZpbHRlcihwYXRoID0+IGlzV29ya3NwYWNlUGF0aFRvT3BlbihwYXRoKSk7XG5cdFx0Y29uc3QgZm9sZGVyVXJpcyA9IGZvbGRlcnMubWFwKGZvbGRlciA9PiBmb2xkZXIud29ya3NwYWNlLnVyaSk7XG5cblx0XHRmb3IgKGNvbnN0IHsgd29ya3NwYWNlIH0gb2Ygd29ya3NwYWNlcykge1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWRXb3Jrc3BhY2UgPSBhd2FpdCB0aGlzLndvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UucmVzb2x2ZUxvY2FsV29ya3NwYWNlKHdvcmtzcGFjZS5jb25maWdQYXRoKTtcblx0XHRcdGlmIChcblx0XHRcdFx0IXJlc29sdmVkV29ya3NwYWNlIHx8XG5cdFx0XHRcdHJlc29sdmVkV29ya3NwYWNlLnJlbW90ZUF1dGhvcml0eSAhPT0gcmVtb3RlQXV0aG9yaXR5IHx8XG5cdFx0XHRcdHJlc29sdmVkV29ya3NwYWNlLnRyYW5zaWVudCB8fFxuXHRcdFx0XHRyZXNvbHZlZFdvcmtzcGFjZS5mb2xkZXJzLmxlbmd0aCAhPT0gZm9sZGVycy5sZW5ndGhcblx0XHRcdCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZm9sZGVyU2V0ID0gbmV3IFJlc291cmNlU2V0KGZvbGRlclVyaXMsIHVyaSA9PiBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5nZXRDb21wYXJpc29uS2V5KHVyaSkpO1xuXHRcdFx0aWYgKHJlc29sdmVkV29ya3NwYWNlLmZvbGRlcnMuZXZlcnkoZm9sZGVyID0+IGZvbGRlclNldC5oYXMoZm9sZGVyLnVyaSkpKSB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZFdvcmtzcGFjZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlT3BlbmFibGUob3BlbmFibGU6IElXaW5kb3dPcGVuYWJsZSwgb3B0aW9uczogSVBhdGhSZXNvbHZlT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiBQcm9taXNlPElQYXRoVG9PcGVuIHwgdW5kZWZpbmVkPiB7XG5cblx0XHQvLyBoYW5kbGUgZmlsZTovLyBvcGVuYWJsZXMgd2l0aCBzb21lIGV4dHJhIHZhbGlkYXRpb25cblx0XHRjb25zdCB1cmkgPSB0aGlzLnJlc291cmNlRnJvbU9wZW5hYmxlKG9wZW5hYmxlKTtcblx0XHRpZiAodXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRpZiAoaXNGaWxlVG9PcGVuKG9wZW5hYmxlKSkge1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBmb3JjZU9wZW5Xb3Jrc3BhY2VBc0ZpbGU6IHRydWUgfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuZG9SZXNvbHZlRmlsZVBhdGgodXJpLmZzUGF0aCwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Ly8gaGFuZGxlIG5vbiBmaWxlOi8vIG9wZW5hYmxlc1xuXHRcdHJldHVybiB0aGlzLmRvUmVzb2x2ZVJlbW90ZU9wZW5hYmxlKG9wZW5hYmxlLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZXNvbHZlUmVtb3RlT3BlbmFibGUob3BlbmFibGU6IElXaW5kb3dPcGVuYWJsZSwgb3B0aW9uczogSVBhdGhSZXNvbHZlT3B0aW9ucyk6IElQYXRoVG9PcGVuPElUZXh0RWRpdG9yT3B0aW9ucz4gfCB1bmRlZmluZWQge1xuXHRcdGxldCB1cmkgPSB0aGlzLnJlc291cmNlRnJvbU9wZW5hYmxlKG9wZW5hYmxlKTtcblxuXHRcdC8vIHVzZSByZW1vdGUgYXV0aG9yaXR5IGZyb20gdnNjb2RlXG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gZ2V0UmVtb3RlQXV0aG9yaXR5KHVyaSkgfHwgb3B0aW9ucy5yZW1vdGVBdXRob3JpdHk7XG5cblx0XHQvLyBub3JtYWxpemUgVVJJXG5cdFx0dXJpID0gcmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yKG5vcm1hbGl6ZVBhdGgodXJpKSk7XG5cblx0XHQvLyBGaWxlXG5cdFx0aWYgKGlzRmlsZVRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdGlmIChvcHRpb25zLmdvdG9MaW5lTW9kZSkge1xuXHRcdFx0XHRjb25zdCB7IHBhdGgsIGxpbmUsIGNvbHVtbiB9ID0gcGFyc2VMaW5lQW5kQ29sdW1uQXdhcmUodXJpLnBhdGgpO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZmlsZVVyaTogdXJpLndpdGgoeyBwYXRoIH0pLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdHNlbGVjdGlvbjogbGluZSA/IHsgc3RhcnRMaW5lTnVtYmVyOiBsaW5lLCBzdGFydENvbHVtbjogY29sdW1uIHx8IDEgfSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7IGZpbGVVcmk6IHVyaSwgcmVtb3RlQXV0aG9yaXR5IH07XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlXG5cdFx0ZWxzZSBpZiAoaXNXb3Jrc3BhY2VUb09wZW4ob3BlbmFibGUpKSB7XG5cdFx0XHRyZXR1cm4geyB3b3Jrc3BhY2U6IGdldFdvcmtzcGFjZUlkZW50aWZpZXIodXJpKSwgcmVtb3RlQXV0aG9yaXR5IH07XG5cdFx0fVxuXG5cdFx0Ly8gRm9sZGVyXG5cdFx0cmV0dXJuIHsgd29ya3NwYWNlOiBnZXRTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyKHVyaSksIHJlbW90ZUF1dGhvcml0eSB9O1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvdXJjZUZyb21PcGVuYWJsZShvcGVuYWJsZTogSVdpbmRvd09wZW5hYmxlKTogVVJJIHtcblx0XHRpZiAoaXNXb3Jrc3BhY2VUb09wZW4ob3BlbmFibGUpKSB7XG5cdFx0XHRyZXR1cm4gb3BlbmFibGUud29ya3NwYWNlVXJpO1xuXHRcdH1cblxuXHRcdGlmIChpc0ZvbGRlclRvT3BlbihvcGVuYWJsZSkpIHtcblx0XHRcdHJldHVybiBvcGVuYWJsZS5mb2xkZXJVcmk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9wZW5hYmxlLmZpbGVVcmk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUZpbGVQYXRoKHBhdGg6IHN0cmluZywgb3B0aW9uczogSVBhdGhSZXNvbHZlT3B0aW9ucywgc2tpcEhhbmRsZVVOQ0Vycm9yPzogYm9vbGVhbik6IFByb21pc2U8SVBhdGhUb09wZW48SVRleHRFZGl0b3JPcHRpb25zPiB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gRXh0cmFjdCBsaW5lL2NvbCBpbmZvcm1hdGlvbiBmcm9tIHBhdGhcblx0XHRsZXQgbGluZU51bWJlcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjb2x1bW5OdW1iZXI6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRpZiAob3B0aW9ucy5nb3RvTGluZU1vZGUpIHtcblx0XHRcdCh7IHBhdGgsIGxpbmU6IGxpbmVOdW1iZXIsIGNvbHVtbjogY29sdW1uTnVtYmVyIH0gPSBwYXJzZUxpbmVBbmRDb2x1bW5Bd2FyZShwYXRoKSk7XG5cdFx0fVxuXG5cdFx0Ly8gRW5zdXJlIHRoZSBwYXRoIGlzIG5vcm1hbGl6ZWQgYW5kIGFic29sdXRlXG5cdFx0cGF0aCA9IHNhbml0aXplRmlsZVBhdGgobm9ybWFsaXplKHBhdGgpLCBjd2QoKSk7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcGF0aFN0YXQgPSBhd2FpdCBmcy5wcm9taXNlcy5zdGF0KHBhdGgpO1xuXG5cdFx0XHQvLyBGaWxlXG5cdFx0XHRpZiAocGF0aFN0YXQuaXNGaWxlKCkpIHtcblxuXHRcdFx0XHQvLyBXb3Jrc3BhY2UgKHVubGVzcyBkaXNhYmxlZCB2aWEgZmxhZylcblx0XHRcdFx0aWYgKCFvcHRpb25zLmZvcmNlT3BlbldvcmtzcGFjZUFzRmlsZSkge1xuXHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IHRoaXMud29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5yZXNvbHZlTG9jYWxXb3Jrc3BhY2UoVVJJLmZpbGUocGF0aCkpO1xuXHRcdFx0XHRcdGlmICh3b3Jrc3BhY2UpIHtcblxuXHRcdFx0XHRcdFx0Ly8gSWYgdGhlIHdvcmtzcGFjZSBpcyB0cmFuc2llbnQgYW5kIHdlIGFyZSB0byBpZ25vcmVcblx0XHRcdFx0XHRcdC8vIHRyYW5zaWVudCB3b3Jrc3BhY2VzLCByZWplY3QgaXQuXG5cdFx0XHRcdFx0XHRpZiAod29ya3NwYWNlLnRyYW5zaWVudCAmJiBvcHRpb25zLnJlamVjdFRyYW5zaWVudFdvcmtzcGFjZXMpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0d29ya3NwYWNlOiB7IGlkOiB3b3Jrc3BhY2UuaWQsIGNvbmZpZ1BhdGg6IHdvcmtzcGFjZS5jb25maWdQYXRoIH0sXG5cdFx0XHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0XHRcdGV4aXN0czogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiB3b3Jrc3BhY2UucmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0XHRcdFx0XHR0cmFuc2llbnQ6IHdvcmtzcGFjZS50cmFuc2llbnRcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRmaWxlVXJpOiBVUkkuZmlsZShwYXRoKSxcblx0XHRcdFx0XHR0eXBlOiBGaWxlVHlwZS5GaWxlLFxuXHRcdFx0XHRcdGV4aXN0czogdHJ1ZSxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IGxpbmVOdW1iZXIgPyB7IHN0YXJ0TGluZU51bWJlcjogbGluZU51bWJlciwgc3RhcnRDb2x1bW46IGNvbHVtbk51bWJlciB8fCAxIH0gOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZvbGRlclxuXHRcdFx0ZWxzZSBpZiAocGF0aFN0YXQuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHdvcmtzcGFjZTogZ2V0U2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcihVUkkuZmlsZShwYXRoKSwgcGF0aFN0YXQpLFxuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkRpcmVjdG9yeSxcblx0XHRcdFx0XHRleGlzdHM6IHRydWVcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU3BlY2lhbCBkZXZpY2U6IGluIFBPU0lYIGVudmlyb25tZW50cywgd2UgbWF5IGdldCAvZGV2L251bGwgcGFzc2VkXG5cdFx0XHQvLyBpbiAoZm9yIGV4YW1wbGUgZ2l0IHVzZXMgaXQgdG8gc2lnbmFsIG9uZSBzaWRlIG9mIGEgZGlmZiBkb2VzIG5vdFxuXHRcdFx0Ly8gZXhpc3QpLiBJbiB0aGF0IHNwZWNpYWwgY2FzZSwgdHJlYXQgaXQgbGlrZSBhIGZpbGUgdG8gc3VwcG9ydCB0aGlzXG5cdFx0XHQvLyBzY2VuYXJpbyAoKVxuXHRcdFx0ZWxzZSBpZiAoIWlzV2luZG93cyAmJiBwYXRoID09PSAnL2Rldi9udWxsJykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGZpbGVVcmk6IFVSSS5maWxlKHBhdGgpLFxuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0ZXhpc3RzOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFUlJfVU5DX0hPU1RfTk9UX0FMTE9XRUQnICYmICFza2lwSGFuZGxlVU5DRXJyb3IpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMub25VTkNIb3N0Tm90QWxsb3dlZChwYXRoLCBvcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZmlsZVVyaSA9IFVSSS5maWxlKHBhdGgpO1xuXG5cdFx0XHQvLyBzaW5jZSBmaWxlIGRvZXMgbm90IHNlZW0gdG8gZXhpc3QgYW55bW9yZSwgcmVtb3ZlIGZyb20gcmVjZW50XG5cdFx0XHR0aGlzLndvcmtzcGFjZXNIaXN0b3J5TWFpblNlcnZpY2UucmVtb3ZlUmVjZW50bHlPcGVuZWQoW2ZpbGVVcmldKTtcblxuXHRcdFx0Ly8gYXNzdW1lIHRoaXMgaXMgYSBmaWxlIHRoYXQgZG9lcyBub3QgeWV0IGV4aXN0XG5cdFx0XHRpZiAob3B0aW9ucy5pZ25vcmVGaWxlTm90Rm91bmQgJiYgZXJyb3IuY29kZSA9PT0gJ0VOT0VOVCcpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRmaWxlVXJpLFxuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0ZXhpc3RzOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEludmFsaWQgcGF0aCBwcm92aWRlZDogJHtwYXRofSwgJHtlcnJvci5tZXNzYWdlfWApO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uVU5DSG9zdE5vdEFsbG93ZWQocGF0aDogc3RyaW5nLCBvcHRpb25zOiBJUGF0aFJlc29sdmVPcHRpb25zKTogUHJvbWlzZTxJUGF0aFRvT3BlbjxJVGV4dEVkaXRvck9wdGlvbnM+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdXJpID0gVVJJLmZpbGUocGF0aCk7XG5cblx0XHRjb25zdCB7IHJlc3BvbnNlLCBjaGVja2JveENoZWNrZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nTWFpblNlcnZpY2Uuc2hvd01lc3NhZ2VCb3goe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ2FsbG93JywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQWxsb3dcIiksXG5cdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnY2FuY2VsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ2FuY2VsXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ2xlYXJuTW9yZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkxlYXJuIE1vcmVcIiksXG5cdFx0XHRdLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1PcGVuTWVzc2FnZScsIFwiVGhlIGhvc3QgJ3swfScgd2FzIG5vdCBmb3VuZCBpbiB0aGUgbGlzdCBvZiBhbGxvd2VkIGhvc3RzLiBEbyB5b3Ugd2FudCB0byBhbGxvdyBpdCBhbnl3YXk/XCIsIHVyaS5hdXRob3JpdHkpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnY29uZmlybU9wZW5EZXRhaWwnLCBcIlRoZSBwYXRoICd7MH0nIHVzZXMgYSBob3N0IHRoYXQgaXMgbm90IGFsbG93ZWQuIFVubGVzcyB5b3UgdHJ1c3QgdGhlIGhvc3QsIHlvdSBzaG91bGQgcHJlc3MgJ0NhbmNlbCdcIiwgZ2V0UGF0aExhYmVsKHVyaSwgeyBvczogT1MsIHRpbGRpZnk6IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZSB9KSksXG5cdFx0XHRjaGVja2JveExhYmVsOiBsb2NhbGl6ZSgnZG9Ob3RBc2tBZ2FpbicsIFwiUGVybWFuZW50bHkgYWxsb3cgaG9zdCAnezB9J1wiLCB1cmkuYXV0aG9yaXR5KSxcblx0XHRcdGNhbmNlbElkOiAxXG5cdFx0fSk7XG5cblx0XHRpZiAocmVzcG9uc2UgPT09IDApIHtcblx0XHRcdGFkZFVOQ0hvc3RUb0FsbG93bGlzdCh1cmkuYXV0aG9yaXR5KTtcblxuXHRcdFx0aWYgKGNoZWNrYm94Q2hlY2tlZCkge1xuXHRcdFx0XHQvLyBEdWUgdG8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5NTQzNiwgd2UgY2FuIG9ubHlcblx0XHRcdFx0Ly8gdXBkYXRlIHNldHRpbmdzIGZyb20gd2l0aGluIGEgd2luZG93LiBCdXQgd2UgZG8gbm90IGtub3cgaWYgYSB3aW5kb3dcblx0XHRcdFx0Ly8gaXMgYWJvdXQgdG8gb3BlbiBvciBjYW4gYWxyZWFkeSBoYW5kbGUgdGhlIHJlcXVlc3QsIHNvIHdlIGhhdmUgdG8gc2VuZFxuXHRcdFx0XHQvLyB0byBhbnkgY3VycmVudCB3aW5kb3cgYW5kIGFueSBuZXdseSBvcGVuaW5nIHdpbmRvdy5cblx0XHRcdFx0Y29uc3QgcmVxdWVzdCA9IHsgY2hhbm5lbDogJ3ZzY29kZTpjb25maWd1cmVBbGxvd2VkVU5DSG9zdCcsIGFyZ3M6IHVyaS5hdXRob3JpdHkgfTtcblx0XHRcdFx0dGhpcy5zZW5kVG9Gb2N1c2VkKHJlcXVlc3QuY2hhbm5lbCwgcmVxdWVzdC5hcmdzKTtcblx0XHRcdFx0dGhpcy5zZW5kVG9PcGVuaW5nV2luZG93KHJlcXVlc3QuY2hhbm5lbCwgcmVxdWVzdC5hcmdzKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuZG9SZXNvbHZlRmlsZVBhdGgocGF0aCwgb3B0aW9ucywgdHJ1ZSAvKiBkbyBub3QgaGFuZGxlIFVOQyBlcnJvciBhZ2FpbiAqLyk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3BvbnNlID09PSAyKSB7XG5cdFx0XHRzaGVsbC5vcGVuRXh0ZXJuYWwoJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS13aW5kb3dzLXVuYycpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5vblVOQ0hvc3ROb3RBbGxvd2VkKHBhdGgsIG9wdGlvbnMpOyAvLyBrZWVwIHNob3dpbmcgdGhlIGRpYWxvZyB1bnRpbCBkZWNpc2lvbiAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE4MTk1Nilcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1Jlc29sdmVSZW1vdGVQYXRoKHBhdGg6IHN0cmluZywgb3B0aW9uczogSVBhdGhSZXNvbHZlT3B0aW9ucyk6IElQYXRoVG9PcGVuPElUZXh0RWRpdG9yT3B0aW9ucz4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGZpcnN0ID0gcGF0aC5jaGFyQ29kZUF0KDApO1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IG9wdGlvbnMucmVtb3RlQXV0aG9yaXR5O1xuXG5cdFx0Ly8gRXh0cmFjdCBsaW5lL2NvbCBpbmZvcm1hdGlvbiBmcm9tIHBhdGhcblx0XHRsZXQgbGluZU51bWJlcjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjb2x1bW5OdW1iZXI6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRcdGlmIChvcHRpb25zLmdvdG9MaW5lTW9kZSkge1xuXHRcdFx0KHsgcGF0aCwgbGluZTogbGluZU51bWJlciwgY29sdW1uOiBjb2x1bW5OdW1iZXIgfSA9IHBhcnNlTGluZUFuZENvbHVtbkF3YXJlKHBhdGgpKTtcblx0XHR9XG5cblx0XHQvLyBtYWtlIGFic29sdXRlXG5cdFx0aWYgKGZpcnN0ICE9PSBDaGFyQ29kZS5TbGFzaCkge1xuXHRcdFx0aWYgKGlzV2luZG93c0RyaXZlTGV0dGVyKGZpcnN0KSAmJiBwYXRoLmNoYXJDb2RlQXQocGF0aC5jaGFyQ29kZUF0KDEpKSA9PT0gQ2hhckNvZGUuQ29sb24pIHtcblx0XHRcdFx0cGF0aCA9IHRvU2xhc2hlcyhwYXRoKTtcblx0XHRcdH1cblxuXHRcdFx0cGF0aCA9IGAvJHtwYXRofWA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlUmVtb3RlLCBhdXRob3JpdHk6IHJlbW90ZUF1dGhvcml0eSwgcGF0aDogcGF0aCB9KTtcblxuXHRcdC8vIGd1ZXNzIHRoZSBmaWxlIHR5cGU6XG5cdFx0Ly8gLSBpZiBpdCBlbmRzIHdpdGggYSBzbGFzaCBpdCdzIGEgZm9sZGVyXG5cdFx0Ly8gLSBpZiBpbiBnb3RvIGxpbmUgbW9kZSBvciBpZiBpdCBoYXMgYSBmaWxlIGV4dGVuc2lvbiwgaXQncyBhIGZpbGUgb3IgYSB3b3Jrc3BhY2Vcblx0XHQvLyAtIGJ5IGRlZmF1bHRzIGl0J3MgYSBmb2xkZXJcblx0XHRpZiAocGF0aC5jaGFyQ29kZUF0KHBhdGgubGVuZ3RoIC0gMSkgIT09IENoYXJDb2RlLlNsYXNoKSB7XG5cblx0XHRcdC8vIGZpbGUgbmFtZSBlbmRzIHdpdGggLmNvZGUtd29ya3NwYWNlXG5cdFx0XHRpZiAoaGFzV29ya3NwYWNlRmlsZUV4dGVuc2lvbihwYXRoKSkge1xuXHRcdFx0XHRpZiAob3B0aW9ucy5mb3JjZU9wZW5Xb3Jrc3BhY2VBc0ZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZmlsZVVyaTogdXJpLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3Rpb246IGxpbmVOdW1iZXIgPyB7IHN0YXJ0TGluZU51bWJlcjogbGluZU51bWJlciwgc3RhcnRDb2x1bW46IGNvbHVtbk51bWJlciB8fCAxIH0gOiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IG9wdGlvbnMucmVtb3RlQXV0aG9yaXR5XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB7IHdvcmtzcGFjZTogZ2V0V29ya3NwYWNlSWRlbnRpZmllcih1cmkpLCByZW1vdGVBdXRob3JpdHkgfTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZmlsZSBuYW1lIHN0YXJ0cyB3aXRoIGEgZG90IG9yIGhhcyBhbiBmaWxlIGV4dGVuc2lvblxuXHRcdFx0ZWxzZSBpZiAob3B0aW9ucy5nb3RvTGluZU1vZGUgfHwgcG9zaXguYmFzZW5hbWUocGF0aCkuaW5kZXhPZignLicpICE9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGZpbGVVcmk6IHVyaSxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IGxpbmVOdW1iZXIgPyB7IHN0YXJ0TGluZU51bWJlcjogbGluZU51bWJlciwgc3RhcnRDb2x1bW46IGNvbHVtbk51bWJlciB8fCAxIH0gOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJlbW90ZUF1dGhvcml0eVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHdvcmtzcGFjZTogZ2V0U2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih1cmkpLCByZW1vdGVBdXRob3JpdHkgfTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkT3Blbk5ld1dpbmRvdyhvcGVuQ29uZmlnOiBJT3BlbkNvbmZpZ3VyYXRpb24pOiB7IG9wZW5Gb2xkZXJJbk5ld1dpbmRvdzogYm9vbGVhbjsgb3BlbkZpbGVzSW5OZXdXaW5kb3c6IGJvb2xlYW4gfSB7XG5cblx0XHQvLyBsZXQgdGhlIHVzZXIgc2V0dGluZ3Mgb3ZlcnJpZGUgaG93IGZvbGRlcnMgYXJlIG9wZW4gaW4gYSBuZXcgd2luZG93IG9yIHNhbWUgd2luZG93IHVubGVzcyB3ZSBhcmUgZm9yY2VkXG5cdFx0Y29uc3Qgd2luZG93Q29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJV2luZG93U2V0dGluZ3MgfCB1bmRlZmluZWQ+KCd3aW5kb3cnKTtcblx0XHRjb25zdCBvcGVuRm9sZGVySW5OZXdXaW5kb3dDb25maWcgPSB3aW5kb3dDb25maWc/Lm9wZW5Gb2xkZXJzSW5OZXdXaW5kb3cgfHwgJ2RlZmF1bHQnIC8qIGRlZmF1bHQgKi87XG5cdFx0Y29uc3Qgb3BlbkZpbGVzSW5OZXdXaW5kb3dDb25maWcgPSB3aW5kb3dDb25maWc/Lm9wZW5GaWxlc0luTmV3V2luZG93IHx8ICdvZmYnIC8qIGRlZmF1bHQgKi87XG5cblx0XHRsZXQgb3BlbkZvbGRlckluTmV3V2luZG93ID0gKG9wZW5Db25maWcucHJlZmVyTmV3V2luZG93IHx8IG9wZW5Db25maWcuZm9yY2VOZXdXaW5kb3cpICYmICFvcGVuQ29uZmlnLmZvcmNlUmV1c2VXaW5kb3c7XG5cdFx0aWYgKCFvcGVuQ29uZmlnLmZvcmNlTmV3V2luZG93ICYmICFvcGVuQ29uZmlnLmZvcmNlUmV1c2VXaW5kb3cgJiYgKG9wZW5Gb2xkZXJJbk5ld1dpbmRvd0NvbmZpZyA9PT0gJ29uJyB8fCBvcGVuRm9sZGVySW5OZXdXaW5kb3dDb25maWcgPT09ICdvZmYnKSkge1xuXHRcdFx0b3BlbkZvbGRlckluTmV3V2luZG93ID0gKG9wZW5Gb2xkZXJJbk5ld1dpbmRvd0NvbmZpZyA9PT0gJ29uJyk7XG5cdFx0fVxuXG5cdFx0Ly8gbGV0IHRoZSB1c2VyIHNldHRpbmdzIG92ZXJyaWRlIGhvdyBmaWxlcyBhcmUgb3BlbiBpbiBhIG5ldyB3aW5kb3cgb3Igc2FtZSB3aW5kb3cgdW5sZXNzIHdlIGFyZSBmb3JjZWQgKG5vdCBmb3IgZXh0ZW5zaW9uIGRldmVsb3BtZW50IHRob3VnaClcblx0XHRsZXQgb3BlbkZpbGVzSW5OZXdXaW5kb3c6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRpZiAob3BlbkNvbmZpZy5mb3JjZU5ld1dpbmRvdyB8fCBvcGVuQ29uZmlnLmZvcmNlUmV1c2VXaW5kb3cpIHtcblx0XHRcdG9wZW5GaWxlc0luTmV3V2luZG93ID0gISFvcGVuQ29uZmlnLmZvcmNlTmV3V2luZG93ICYmICFvcGVuQ29uZmlnLmZvcmNlUmV1c2VXaW5kb3c7XG5cdFx0fSBlbHNlIHtcblxuXHRcdFx0Ly8gbWFjT1M6IGJ5IGRlZmF1bHQgd2Ugb3BlbiBmaWxlcyBpbiBhIG5ldyB3aW5kb3cgaWYgdGhpcyBpcyB0cmlnZ2VyZWQgdmlhIERPQ0sgY29udGV4dFxuXHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdGlmIChvcGVuQ29uZmlnLmNvbnRleHQgPT09IE9wZW5Db250ZXh0LkRPQ0spIHtcblx0XHRcdFx0XHRvcGVuRmlsZXNJbk5ld1dpbmRvdyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gTGludXgvV2luZG93czogYnkgZGVmYXVsdCB3ZSBvcGVuIGZpbGVzIGluIHRoZSBuZXcgd2luZG93IHVubGVzcyB0cmlnZ2VyZWQgdmlhIERJQUxPRyAvIE1FTlUgY29udGV4dFxuXHRcdFx0Ly8gb3IgZnJvbSB0aGUgaW50ZWdyYXRlZCB0ZXJtaW5hbCB3aGVyZSB3ZSBhc3N1bWUgdGhlIHVzZXIgcHJlZmVycyB0byBvcGVuIGluIHRoZSBjdXJyZW50IHdpbmRvd1xuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmIChvcGVuQ29uZmlnLmNvbnRleHQgIT09IE9wZW5Db250ZXh0LkRJQUxPRyAmJiBvcGVuQ29uZmlnLmNvbnRleHQgIT09IE9wZW5Db250ZXh0Lk1FTlUgJiYgIShvcGVuQ29uZmlnLnVzZXJFbnYgJiYgb3BlbkNvbmZpZy51c2VyRW52WydURVJNX1BST0dSQU0nXSA9PT0gJ3ZzY29kZScpKSB7XG5cdFx0XHRcdFx0b3BlbkZpbGVzSW5OZXdXaW5kb3cgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZpbmFsbHkgY2hlY2sgZm9yIG92ZXJyaWRlcyBvZiBkZWZhdWx0XG5cdFx0XHRpZiAoIW9wZW5Db25maWcuY2xpLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCAmJiAob3BlbkZpbGVzSW5OZXdXaW5kb3dDb25maWcgPT09ICdvbicgfHwgb3BlbkZpbGVzSW5OZXdXaW5kb3dDb25maWcgPT09ICdvZmYnKSkge1xuXHRcdFx0XHRvcGVuRmlsZXNJbk5ld1dpbmRvdyA9IChvcGVuRmlsZXNJbk5ld1dpbmRvd0NvbmZpZyA9PT0gJ29uJyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgb3BlbkZvbGRlckluTmV3V2luZG93OiAhIW9wZW5Gb2xkZXJJbk5ld1dpbmRvdywgb3BlbkZpbGVzSW5OZXdXaW5kb3cgfTtcblx0fVxuXG5cdGFzeW5jIG9wZW5FeHRlbnNpb25EZXZlbG9wbWVudEhvc3RXaW5kb3coZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoczogc3RyaW5nW10sIG9wZW5Db25maWc6IElPcGVuQ29uZmlndXJhdGlvbik6IFByb21pc2U8SUNvZGVXaW5kb3dbXT4ge1xuXG5cdFx0Ly8gUmVsb2FkIGFuIGV4aXN0aW5nIGV4dGVuc2lvbiBkZXZlbG9wbWVudCBob3N0IHdpbmRvdyBvbiB0aGUgc2FtZSBwYXRoXG5cdFx0Ly8gV2UgY3VycmVudGx5IGRvIG5vdCBhbGxvdyBtb3JlIHRoYW4gb25lIGV4dGVuc2lvbiBkZXZlbG9wbWVudCB3aW5kb3dcblx0XHQvLyBvbiB0aGUgc2FtZSBleHRlbnNpb24gcGF0aC5cblx0XHRjb25zdCBleGlzdGluZ1dpbmRvdyA9IGZpbmRXaW5kb3dPbkV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCh0aGlzLmdldFdpbmRvd3MoKSwgZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRocyk7XG5cdFx0aWYgKGV4aXN0aW5nV2luZG93KSB7XG5cdFx0XHR0aGlzLmxpZmVjeWNsZU1haW5TZXJ2aWNlLnJlbG9hZChleGlzdGluZ1dpbmRvdywgb3BlbkNvbmZpZy5jbGkpO1xuXHRcdFx0ZXhpc3RpbmdXaW5kb3cuZm9jdXMoKTsgLy8gbWFrZSBzdXJlIGl0IGdldHMgZm9jdXMgYW5kIGlzIHJlc3RvcmVkXG5cblx0XHRcdHJldHVybiBbZXhpc3RpbmdXaW5kb3ddO1xuXHRcdH1cblxuXHRcdGxldCBmb2xkZXJVcmlzID0gb3BlbkNvbmZpZy5jbGlbJ2ZvbGRlci11cmknXSB8fCBbXTtcblx0XHRsZXQgZmlsZVVyaXMgPSBvcGVuQ29uZmlnLmNsaVsnZmlsZS11cmknXSB8fCBbXTtcblx0XHRsZXQgY2xpQXJncyA9IG9wZW5Db25maWcuY2xpLl87XG5cblx0XHQvLyBGaWxsIGluIHByZXZpb3VzbHkgb3BlbmVkIHdvcmtzcGFjZSB1bmxlc3MgYW4gZXhwbGljaXQgcGF0aCBpcyBwcm92aWRlZCBhbmQgd2UgYXJlIG5vdCB1bml0IHRlc3Rpbmdcblx0XHRpZiAoIWNsaUFyZ3MubGVuZ3RoICYmICFmb2xkZXJVcmlzLmxlbmd0aCAmJiAhZmlsZVVyaXMubGVuZ3RoICYmICFvcGVuQ29uZmlnLmNsaS5leHRlbnNpb25UZXN0c1BhdGgpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbkRldmVsb3BtZW50V2luZG93U3RhdGUgPSB0aGlzLndpbmRvd3NTdGF0ZUhhbmRsZXIuc3RhdGUubGFzdFBsdWdpbkRldmVsb3BtZW50SG9zdFdpbmRvdztcblx0XHRcdGNvbnN0IHdvcmtzcGFjZVRvT3BlbiA9IGV4dGVuc2lvbkRldmVsb3BtZW50V2luZG93U3RhdGU/LndvcmtzcGFjZSA/PyBleHRlbnNpb25EZXZlbG9wbWVudFdpbmRvd1N0YXRlPy5mb2xkZXJVcmk7XG5cdFx0XHRpZiAod29ya3NwYWNlVG9PcGVuKSB7XG5cdFx0XHRcdGlmIChVUkkuaXNVcmkod29ya3NwYWNlVG9PcGVuKSkge1xuXHRcdFx0XHRcdGlmICh3b3Jrc3BhY2VUb09wZW4uc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpIHtcblx0XHRcdFx0XHRcdGNsaUFyZ3MgPSBbd29ya3NwYWNlVG9PcGVuLmZzUGF0aF07XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGZvbGRlclVyaXMgPSBbd29ya3NwYWNlVG9PcGVuLnRvU3RyaW5nKCldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAod29ya3NwYWNlVG9PcGVuLmNvbmZpZ1BhdGguc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpIHtcblx0XHRcdFx0XHRcdGNsaUFyZ3MgPSBbb3JpZ2luYWxGU1BhdGgod29ya3NwYWNlVG9PcGVuLmNvbmZpZ1BhdGgpXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZmlsZVVyaXMgPSBbd29ya3NwYWNlVG9PcGVuLmNvbmZpZ1BhdGgudG9TdHJpbmcoKV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHJlbW90ZUF1dGhvcml0eSA9IG9wZW5Db25maWcucmVtb3RlQXV0aG9yaXR5O1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoIG9mIGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aHMpIHtcblx0XHRcdGlmIChleHRlbnNpb25EZXZlbG9wbWVudFBhdGgubWF0Y2goL15bYS16QS1aXVthLXpBLVowLTlcXCtcXC1cXC5dKzovKSkge1xuXHRcdFx0XHRjb25zdCB1cmwgPSBVUkkucGFyc2UoZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoUmVtb3RlQXV0aG9yaXR5ID0gZ2V0UmVtb3RlQXV0aG9yaXR5KHVybCk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25EZXZlbG9wbWVudFBhdGhSZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0XHRpZiAocmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0XHRpZiAoIWlzRXF1YWxBdXRob3JpdHkoZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoUmVtb3RlQXV0aG9yaXR5LCByZW1vdGVBdXRob3JpdHkpKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignbW9yZSB0aGFuIG9uZSBleHRlbnNpb24gZGV2ZWxvcG1lbnQgcGF0aCBhdXRob3JpdHknKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5ID0gZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoUmVtb3RlQXV0aG9yaXR5O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB0aGF0IHdlIGRvIG5vdCB0cnkgdG8gb3Blbjpcblx0XHQvLyAtIGEgd29ya3NwYWNlIG9yIGZvbGRlciB0aGF0IGlzIGFscmVhZHkgb3BlbmVkXG5cdFx0Ly8gLSBhIHdvcmtzcGFjZSBvciBmaWxlIHRoYXQgaGFzIGEgZGlmZmVyZW50IGF1dGhvcml0eSBhcyB0aGUgZXh0ZW5zaW9uIGRldmVsb3BtZW50LlxuXG5cdFx0Y2xpQXJncyA9IGNsaUFyZ3MuZmlsdGVyKHBhdGggPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZpbGUocGF0aCk7XG5cdFx0XHRpZiAoISFmaW5kV2luZG93T25Xb3Jrc3BhY2VPckZvbGRlcih0aGlzLmdldFdpbmRvd3MoKSwgdXJpKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBpc0VxdWFsQXV0aG9yaXR5KGdldFJlbW90ZUF1dGhvcml0eSh1cmkpLCByZW1vdGVBdXRob3JpdHkpO1xuXHRcdH0pO1xuXG5cdFx0Zm9sZGVyVXJpcyA9IGZvbGRlclVyaXMuZmlsdGVyKGZvbGRlclVyaVN0ciA9PiB7XG5cdFx0XHRjb25zdCBmb2xkZXJVcmkgPSB0aGlzLmNsaUFyZ1RvVXJpKGZvbGRlclVyaVN0cik7XG5cdFx0XHRpZiAoZm9sZGVyVXJpICYmICEhZmluZFdpbmRvd09uV29ya3NwYWNlT3JGb2xkZXIodGhpcy5nZXRXaW5kb3dzKCksIGZvbGRlclVyaSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZm9sZGVyVXJpID8gaXNFcXVhbEF1dGhvcml0eShnZXRSZW1vdGVBdXRob3JpdHkoZm9sZGVyVXJpKSwgcmVtb3RlQXV0aG9yaXR5KSA6IGZhbHNlO1xuXHRcdH0pO1xuXG5cdFx0ZmlsZVVyaXMgPSBmaWxlVXJpcy5maWx0ZXIoZmlsZVVyaVN0ciA9PiB7XG5cdFx0XHRjb25zdCBmaWxlVXJpID0gdGhpcy5jbGlBcmdUb1VyaShmaWxlVXJpU3RyKTtcblx0XHRcdGlmIChmaWxlVXJpICYmICEhZmluZFdpbmRvd09uV29ya3NwYWNlT3JGb2xkZXIodGhpcy5nZXRXaW5kb3dzKCksIGZpbGVVcmkpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZpbGVVcmkgPyBpc0VxdWFsQXV0aG9yaXR5KGdldFJlbW90ZUF1dGhvcml0eShmaWxlVXJpKSwgcmVtb3RlQXV0aG9yaXR5KSA6IGZhbHNlO1xuXHRcdH0pO1xuXG5cdFx0b3BlbkNvbmZpZy5jbGkuXyA9IGNsaUFyZ3M7XG5cdFx0b3BlbkNvbmZpZy5jbGlbJ2ZvbGRlci11cmknXSA9IGZvbGRlclVyaXM7XG5cdFx0b3BlbkNvbmZpZy5jbGlbJ2ZpbGUtdXJpJ10gPSBmaWxlVXJpcztcblxuXHRcdC8vIE9wZW4gaXRcblx0XHRjb25zdCBvcGVuQXJnczogSU9wZW5Db25maWd1cmF0aW9uID0ge1xuXHRcdFx0Y29udGV4dDogb3BlbkNvbmZpZy5jb250ZXh0LFxuXHRcdFx0Y2xpOiBvcGVuQ29uZmlnLmNsaSxcblx0XHRcdGZvcmNlTmV3V2luZG93OiB0cnVlLFxuXHRcdFx0Zm9yY2VFbXB0eTogIWNsaUFyZ3MubGVuZ3RoICYmICFmb2xkZXJVcmlzLmxlbmd0aCAmJiAhZmlsZVVyaXMubGVuZ3RoLFxuXHRcdFx0dXNlckVudjogb3BlbkNvbmZpZy51c2VyRW52LFxuXHRcdFx0bm9SZWNlbnRFbnRyeTogdHJ1ZSxcblx0XHRcdHdhaXRNYXJrZXJGaWxlVVJJOiBvcGVuQ29uZmlnLndhaXRNYXJrZXJGaWxlVVJJLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0Zm9yY2VQcm9maWxlOiBvcGVuQ29uZmlnLmZvcmNlUHJvZmlsZSxcblx0XHRcdGZvcmNlVGVtcFByb2ZpbGU6IG9wZW5Db25maWcuZm9yY2VUZW1wUHJvZmlsZVxuXHRcdH07XG5cblx0XHRyZXR1cm4gdGhpcy5vcGVuKG9wZW5BcmdzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkluQnJvd3NlcldpbmRvdyhvcHRpb25zOiBJT3BlbkJyb3dzZXJXaW5kb3dPcHRpb25zKTogUHJvbWlzZTxJQ29kZVdpbmRvdz4ge1xuXHRcdGNvbnN0IHdpbmRvd0NvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVdpbmRvd1NldHRpbmdzIHwgdW5kZWZpbmVkPignd2luZG93Jyk7XG5cblx0XHRjb25zdCBsYXN0QWN0aXZlV2luZG93ID0gdGhpcy5nZXRMYXN0QWN0aXZlV2luZG93KCk7XG5cdFx0Y29uc3QgbmV3V2luZG93UHJvZmlsZSA9IHdpbmRvd0NvbmZpZz8ubmV3V2luZG93UHJvZmlsZVxuXHRcdFx0PyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZS5wcm9maWxlcy5maW5kKHByb2ZpbGUgPT4gcHJvZmlsZS5uYW1lID09PSB3aW5kb3dDb25maWcubmV3V2luZG93UHJvZmlsZSkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGUgPSBuZXdXaW5kb3dQcm9maWxlID8/IGxhc3RBY3RpdmVXaW5kb3c/LnByb2ZpbGUgPz8gdGhpcy51c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UuZGVmYXVsdFByb2ZpbGU7XG5cblx0XHRsZXQgd2luZG93OiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoIW9wdGlvbnMuZm9yY2VOZXdXaW5kb3cgJiYgIW9wdGlvbnMuZm9yY2VOZXdUYWJiZWRXaW5kb3cpIHtcblx0XHRcdHdpbmRvdyA9IG9wdGlvbnMud2luZG93VG9Vc2UgfHwgbGFzdEFjdGl2ZVdpbmRvdztcblx0XHRcdGlmICh3aW5kb3cpIHtcblx0XHRcdFx0d2luZG93LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQnVpbGQgdXAgdGhlIHdpbmRvdyBjb25maWd1cmF0aW9uIGZyb20gcHJvdmlkZWQgb3B0aW9ucywgY29uZmlnIGFuZCBlbnZpcm9ubWVudFxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb246IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uID0ge1xuXG5cdFx0XHQvLyBJbmhlcml0IENMSSBhcmd1bWVudHMgZnJvbSBlbnZpcm9ubWVudCBhbmQvb3Jcblx0XHRcdC8vIHRoZSBzcGVjaWZpYyBwcm9wZXJ0aWVzIGZyb20gdGhpcyBsYXVuY2ggaWYgcHJvdmlkZWRcblx0XHRcdC4uLnRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLFxuXHRcdFx0Li4ub3B0aW9ucy5jbGksXG5cblx0XHRcdG1hY2hpbmVJZDogdGhpcy5tYWNoaW5lSWQsXG5cdFx0XHRzcW1JZDogdGhpcy5zcW1JZCxcblx0XHRcdGRldkRldmljZUlkOiB0aGlzLmRldkRldmljZUlkLFxuXG5cdFx0XHR3aW5kb3dJZDogLTEsXHQvLyBXaWxsIGJlIGZpbGxlZCBpbiBieSB0aGUgd2luZG93IG9uY2UgbG9hZGVkIGxhdGVyXG5cblx0XHRcdG1haW5QaWQ6IHByb2Nlc3MucGlkLFxuXG5cdFx0XHRhcHBSb290OiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYXBwUm9vdCxcblx0XHRcdGV4ZWNQYXRoOiBwcm9jZXNzLmV4ZWNQYXRoLFxuXHRcdFx0Y29kZUNhY2hlUGF0aDogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmNvZGVDYWNoZVBhdGgsXG5cdFx0XHQvLyBJZiB3ZSBrbm93IHRoZSBiYWNrdXAgZm9sZGVyIHVwZnJvbnQgKGZvciBlbXB0eSB3aW5kb3dzIHRvIHJlc3RvcmUpLCB3ZSBjYW4gc2V0IGl0XG5cdFx0XHQvLyBkaXJlY3RseSBoZXJlIHdoaWNoIGhlbHBzIGZvciByZXN0b3JpbmcgVUkgc3RhdGUgYXNzb2NpYXRlZCB3aXRoIHRoYXQgd2luZG93LlxuXHRcdFx0Ly8gRm9yIGFsbCBvdGhlciBjYXNlcyB3ZSBmaXJzdCBjYWxsIGludG8gcmVnaXN0ZXJFbXB0eVdpbmRvd0JhY2t1cCgpIHRvIHNldCBpdCBiZWZvcmVcblx0XHRcdC8vIGxvYWRpbmcgdGhlIHdpbmRvdy5cblx0XHRcdGJhY2t1cFBhdGg6IG9wdGlvbnMuZW1wdHlXaW5kb3dCYWNrdXBJbmZvID8gam9pbih0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UuYmFja3VwSG9tZSwgb3B0aW9ucy5lbXB0eVdpbmRvd0JhY2t1cEluZm8uYmFja3VwRm9sZGVyKSA6IHVuZGVmaW5lZCxcblxuXHRcdFx0cHJvZmlsZXM6IHtcblx0XHRcdFx0aG9tZTogdGhpcy51c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UucHJvZmlsZXNIb21lLFxuXHRcdFx0XHRhbGw6IHRoaXMudXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlLnByb2ZpbGVzLFxuXHRcdFx0XHQvLyBTZXQgdG8gZGVmYXVsdCBwcm9maWxlIGZpcnN0IGFuZCByZXNvbHZlIGFuZCB1cGRhdGUgdGhlIHByb2ZpbGVcblx0XHRcdFx0Ly8gb25seSBhZnRlciB0aGUgd29ya3NwYWNlLWJhY2t1cCBpcyByZWdpc3RlcmVkLlxuXHRcdFx0XHQvLyBCZWNhdXNlLCB3b3Jrc3BhY2UgaWRlbnRpZmllciBvZiBhbiBlbXB0eSB3aW5kb3cgaXMga25vd24gb25seSB0aGVuLlxuXHRcdFx0XHRwcm9maWxlOiBkZWZhdWx0UHJvZmlsZVxuXHRcdFx0fSxcblxuXHRcdFx0aG9tZURpcjogdGhpcy5lbnZpcm9ubWVudE1haW5TZXJ2aWNlLnVzZXJIb21lLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSB9KS5mc1BhdGgsXG5cdFx0XHR0bXBEaXI6IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS50bXBEaXIud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlIH0pLmZzUGF0aCxcblx0XHRcdHVzZXJEYXRhRGlyOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UudXNlckRhdGFQYXRoLFxuXG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IG9wdGlvbnMucmVtb3RlQXV0aG9yaXR5LFxuXHRcdFx0d29ya3NwYWNlOiBvcHRpb25zLndvcmtzcGFjZSxcblx0XHRcdHVzZXJFbnY6IHsgLi4udGhpcy5pbml0aWFsVXNlckVudiwgLi4ub3B0aW9ucy51c2VyRW52IH0sXG5cblx0XHRcdG5sczoge1xuXHRcdFx0XHRtZXNzYWdlczogZ2V0TkxTTWVzc2FnZXMoKSxcblx0XHRcdFx0bGFuZ3VhZ2U6IGdldE5MU0xhbmd1YWdlKClcblx0XHRcdH0sXG5cblx0XHRcdGZpbGVzVG9PcGVuT3JDcmVhdGU6IG9wdGlvbnMuZmlsZXNUb09wZW4/LmZpbGVzVG9PcGVuT3JDcmVhdGUsXG5cdFx0XHRmaWxlc1RvRGlmZjogb3B0aW9ucy5maWxlc1RvT3Blbj8uZmlsZXNUb0RpZmYsXG5cdFx0XHRmaWxlc1RvTWVyZ2U6IG9wdGlvbnMuZmlsZXNUb09wZW4/LmZpbGVzVG9NZXJnZSxcblx0XHRcdGZpbGVzVG9XYWl0OiBvcHRpb25zLmZpbGVzVG9PcGVuPy5maWxlc1RvV2FpdCxcblxuXHRcdFx0bG9nTGV2ZWw6IHRoaXMubG9nZ2VyU2VydmljZS5nZXRMb2dMZXZlbCgpLFxuXHRcdFx0bG9nZ2VyczogdGhpcy5sb2dnZXJTZXJ2aWNlLmdldEdsb2JhbExvZ2dlcnMoKSxcblx0XHRcdGxvZ3NQYXRoOiB0aGlzLmVudmlyb25tZW50TWFpblNlcnZpY2UubG9nc0hvbWUud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlIH0pLmZzUGF0aCxcblxuXHRcdFx0cHJvZHVjdCxcblx0XHRcdGlzSW5pdGlhbFN0YXJ0dXA6IG9wdGlvbnMuaW5pdGlhbFN0YXJ0dXAsXG5cdFx0XHRwZXJmTWFya3M6IGdldE1hcmtzKCksXG5cdFx0XHRvczogeyByZWxlYXNlOiByZWxlYXNlKCksIGhvc3RuYW1lOiBob3N0bmFtZSgpLCBhcmNoOiBhcmNoKCkgfSxcblxuXHRcdFx0YXV0b0RldGVjdEhpZ2hDb250cmFzdDogd2luZG93Q29uZmlnPy5hdXRvRGV0ZWN0SGlnaENvbnRyYXN0ID8/IHRydWUsXG5cdFx0XHRhdXRvRGV0ZWN0Q29sb3JTY2hlbWU6IHdpbmRvd0NvbmZpZz8uYXV0b0RldGVjdENvbG9yU2NoZW1lID8/IGZhbHNlLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVN1cHBvcnQ6IGFwcC5hY2Nlc3NpYmlsaXR5U3VwcG9ydEVuYWJsZWQsXG5cdFx0XHRjb2xvclNjaGVtZTogdGhpcy50aGVtZU1haW5TZXJ2aWNlLmdldENvbG9yU2NoZW1lKCksXG5cdFx0XHRwb2xpY2llc0RhdGE6IHRoaXMucG9saWN5U2VydmljZS5zZXJpYWxpemUoKSxcblx0XHRcdGNvbnRpbnVlT246IHRoaXMuZW52aXJvbm1lbnRNYWluU2VydmljZS5jb250aW51ZU9uLFxuXG5cdFx0XHRjc3NNb2R1bGVzOiB0aGlzLmNzc0RldmVsb3BtZW50U2VydmljZS5pc0VuYWJsZWQgPyBhd2FpdCB0aGlzLmNzc0RldmVsb3BtZW50U2VydmljZS5nZXRDc3NNb2R1bGVzKCkgOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0Ly8gTmV3IHdpbmRvd1xuXHRcdGlmICghd2luZG93KSB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMud2luZG93c1N0YXRlSGFuZGxlci5nZXROZXdXaW5kb3dTdGF0ZShjb25maWd1cmF0aW9uKTtcblxuXHRcdFx0Ly8gQ3JlYXRlIHRoZSB3aW5kb3dcblx0XHRcdG1hcmsoJ2NvZGUvd2lsbENyZWF0ZUNvZGVXaW5kb3cnKTtcblx0XHRcdGNvbnN0IGNyZWF0ZWRXaW5kb3cgPSB3aW5kb3cgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVXaW5kb3csIHtcblx0XHRcdFx0c3RhdGUsXG5cdFx0XHRcdGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aDogY29uZmlndXJhdGlvbi5leHRlbnNpb25EZXZlbG9wbWVudFBhdGgsXG5cdFx0XHRcdGlzRXh0ZW5zaW9uVGVzdEhvc3Q6ICEhY29uZmlndXJhdGlvbi5leHRlbnNpb25UZXN0c1BhdGhcblx0XHRcdH0pO1xuXHRcdFx0bWFyaygnY29kZS9kaWRDcmVhdGVDb2RlV2luZG93Jyk7XG5cblx0XHRcdC8vIEFkZCBhcyB3aW5kb3cgdGFiIGlmIGNvbmZpZ3VyZWQgKG1hY09TIG9ubHkpXG5cdFx0XHRpZiAob3B0aW9ucy5mb3JjZU5ld1RhYmJlZFdpbmRvdykge1xuXHRcdFx0XHRjb25zdCBhY3RpdmVXaW5kb3cgPSB0aGlzLmdldExhc3RBY3RpdmVXaW5kb3coKTtcblx0XHRcdFx0YWN0aXZlV2luZG93Py5hZGRUYWJiZWRXaW5kb3coY3JlYXRlZFdpbmRvdyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCB0byBvdXIgbGlzdCBvZiB3aW5kb3dzXG5cdFx0XHR0aGlzLndpbmRvd3Muc2V0KGNyZWF0ZWRXaW5kb3cuaWQsIGNyZWF0ZWRXaW5kb3cpO1xuXG5cdFx0XHQvLyBJbmRpY2F0ZSBuZXcgd2luZG93IHZpYSBldmVudFxuXHRcdFx0dGhpcy5fb25EaWRPcGVuV2luZG93LmZpcmUoY3JlYXRlZFdpbmRvdyk7XG5cblx0XHRcdC8vIEluZGljYXRlIG51bWJlciBjaGFuZ2UgdmlhIGV2ZW50XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVdpbmRvd3NDb3VudC5maXJlKHsgb2xkQ291bnQ6IHRoaXMuZ2V0V2luZG93Q291bnQoKSAtIDEsIG5ld0NvdW50OiB0aGlzLmdldFdpbmRvd0NvdW50KCkgfSk7XG5cblx0XHRcdC8vIFdpbmRvdyBFdmVudHNcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZWRXaW5kb3cub25EaWRTaWduYWxSZWFkeSgoKSA9PiB0aGlzLl9vbkRpZFNpZ25hbFJlYWR5V2luZG93LmZpcmUoY3JlYXRlZFdpbmRvdykpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKGNyZWF0ZWRXaW5kb3cub25EaWRDbG9zZSkoKCkgPT4gdGhpcy5vbldpbmRvd0Nsb3NlZChjcmVhdGVkV2luZG93LCBkaXNwb3NhYmxlcykpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKGNyZWF0ZWRXaW5kb3cub25EaWREZXN0cm95KSgoKSA9PiB0aGlzLm9uV2luZG93RGVzdHJveWVkKGNyZWF0ZWRXaW5kb3cpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoY3JlYXRlZFdpbmRvdy5vbkRpZE1heGltaXplKCgpID0+IHRoaXMuX29uRGlkTWF4aW1pemVXaW5kb3cuZmlyZShjcmVhdGVkV2luZG93KSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZWRXaW5kb3cub25EaWRVbm1heGltaXplKCgpID0+IHRoaXMuX29uRGlkVW5tYXhpbWl6ZVdpbmRvdy5maXJlKGNyZWF0ZWRXaW5kb3cpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoY3JlYXRlZFdpbmRvdy5vbkRpZEVudGVyRnVsbFNjcmVlbigoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUZ1bGxTY3JlZW4uZmlyZSh7IHdpbmRvdzogY3JlYXRlZFdpbmRvdywgZnVsbHNjcmVlbjogdHJ1ZSB9KSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZWRXaW5kb3cub25EaWRMZWF2ZUZ1bGxTY3JlZW4oKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VGdWxsU2NyZWVuLmZpcmUoeyB3aW5kb3c6IGNyZWF0ZWRXaW5kb3csIGZ1bGxzY3JlZW46IGZhbHNlIH0pKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoY3JlYXRlZFdpbmRvdy5vbkRpZFRyaWdnZXJTeXN0ZW1Db250ZXh0TWVudSgoeyB4LCB5IH0pID0+IHRoaXMuX29uRGlkVHJpZ2dlclN5c3RlbUNvbnRleHRNZW51LmZpcmUoeyB3aW5kb3c6IGNyZWF0ZWRXaW5kb3csIHgsIHkgfSkpKTtcblxuXHRcdFx0Y29uc3Qgd2ViQ29udGVudHMgPSBhc3NlcnRJc0RlZmluZWQoY3JlYXRlZFdpbmRvdy53aW4/LndlYkNvbnRlbnRzKTtcblx0XHRcdHdlYkNvbnRlbnRzLnJlbW92ZUFsbExpc3RlbmVycygnZGV2dG9vbHMtcmVsb2FkLXBhZ2UnKTsgLy8gcmVtb3ZlIGJ1aWx0IGluIGxpc3RlbmVyIHNvIHdlIGNhbiBoYW5kbGUgdGhpcyBvbiBvdXIgb3duXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQuZnJvbU5vZGVFdmVudEVtaXR0ZXIod2ViQ29udGVudHMsICdkZXZ0b29scy1yZWxvYWQtcGFnZScpKCgpID0+IHRoaXMubGlmZWN5Y2xlTWFpblNlcnZpY2UucmVsb2FkKGNyZWF0ZWRXaW5kb3cpKSk7XG5cblx0XHRcdC8vIExpZmVjeWNsZVxuXHRcdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS5yZWdpc3RlcldpbmRvdyhjcmVhdGVkV2luZG93KTtcblx0XHR9XG5cblx0XHQvLyBFeGlzdGluZyB3aW5kb3dcblx0XHRlbHNlIHtcblxuXHRcdFx0Ly8gU29tZSBjb25maWd1cmF0aW9uIHRoaW5ncyBnZXQgaW5oZXJpdGVkIGlmIHRoZSB3aW5kb3cgaXMgYmVpbmcgcmV1c2VkIGFuZCB3ZSBhcmVcblx0XHRcdC8vIGluIGV4dGVuc2lvbiBkZXZlbG9wbWVudCBob3N0IG1vZGUuIFRoZXNlIG9wdGlvbnMgYXJlIGFsbCBkZXZlbG9wbWVudCByZWxhdGVkLlxuXHRcdFx0Y29uc3QgY3VycmVudFdpbmRvd0NvbmZpZyA9IHdpbmRvdy5jb25maWc7XG5cdFx0XHRpZiAoIWNvbmZpZ3VyYXRpb24uZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoICYmIGN1cnJlbnRXaW5kb3dDb25maWc/LmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCA9IGN1cnJlbnRXaW5kb3dDb25maWcuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoO1xuXHRcdFx0XHRjb25maWd1cmF0aW9uLmV4dGVuc2lvbkRldmVsb3BtZW50S2luZCA9IGN1cnJlbnRXaW5kb3dDb25maWcuZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kO1xuXHRcdFx0XHRjb25maWd1cmF0aW9uWydlbmFibGUtcHJvcG9zZWQtYXBpJ10gPSBjdXJyZW50V2luZG93Q29uZmlnWydlbmFibGUtcHJvcG9zZWQtYXBpJ107XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb24udmVyYm9zZSA9IGN1cnJlbnRXaW5kb3dDb25maWcudmVyYm9zZTtcblx0XHRcdFx0Y29uZmlndXJhdGlvblsnaW5zcGVjdC1leHRlbnNpb25zJ10gPSBjdXJyZW50V2luZG93Q29uZmlnWydpbnNwZWN0LWV4dGVuc2lvbnMnXTtcblx0XHRcdFx0Y29uZmlndXJhdGlvblsnaW5zcGVjdC1icmstZXh0ZW5zaW9ucyddID0gY3VycmVudFdpbmRvd0NvbmZpZ1snaW5zcGVjdC1icmstZXh0ZW5zaW9ucyddO1xuXHRcdFx0XHRjb25maWd1cmF0aW9uLmRlYnVnSWQgPSBjdXJyZW50V2luZG93Q29uZmlnLmRlYnVnSWQ7XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb24uZXh0ZW5zaW9uRW52aXJvbm1lbnQgPSBjdXJyZW50V2luZG93Q29uZmlnLmV4dGVuc2lvbkVudmlyb25tZW50O1xuXHRcdFx0XHRjb25maWd1cmF0aW9uWydleHRlbnNpb25zLWRpciddID0gY3VycmVudFdpbmRvd0NvbmZpZ1snZXh0ZW5zaW9ucy1kaXInXTtcblx0XHRcdFx0Y29uZmlndXJhdGlvblsnZGlzYWJsZS1leHRlbnNpb25zJ10gPSBjdXJyZW50V2luZG93Q29uZmlnWydkaXNhYmxlLWV4dGVuc2lvbnMnXTtcblx0XHRcdFx0Y29uZmlndXJhdGlvblsnZGlzYWJsZS1leHRlbnNpb24nXSA9IGN1cnJlbnRXaW5kb3dDb25maWdbJ2Rpc2FibGUtZXh0ZW5zaW9uJ107XG5cdFx0XHR9XG5cdFx0XHRjb25maWd1cmF0aW9uLmxvZ2dlcnMgPSBjb25maWd1cmF0aW9uLmxvZ2dlcnM7XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIHdpbmRvdyBpZGVudGlmaWVyIGFuZCBzZXNzaW9uIG5vd1xuXHRcdC8vIHRoYXQgd2UgaGF2ZSB0aGUgd2luZG93IG9iamVjdCBpbiBoYW5kLlxuXHRcdGNvbmZpZ3VyYXRpb24ud2luZG93SWQgPSB3aW5kb3cuaWQ7XG5cblx0XHQvLyBJZiB0aGUgd2luZG93IHdhcyBhbHJlYWR5IGxvYWRlZCwgbWFrZSBzdXJlIHRvIHVubG9hZCBpdFxuXHRcdC8vIGZpcnN0IGFuZCBvbmx5IGxvYWQgdGhlIG5ldyBjb25maWd1cmF0aW9uIGlmIHRoYXQgd2FzXG5cdFx0Ly8gbm90IHZldG9lZFxuXHRcdGlmICh3aW5kb3cuaXNSZWFkeSkge1xuXHRcdFx0dGhpcy5saWZlY3ljbGVNYWluU2VydmljZS51bmxvYWQod2luZG93LCBVbmxvYWRSZWFzb24uTE9BRCkudGhlbihhc3luYyB2ZXRvID0+IHtcblx0XHRcdFx0aWYgKCF2ZXRvKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5kb09wZW5JbkJyb3dzZXJXaW5kb3cod2luZG93LCBjb25maWd1cmF0aW9uLCBvcHRpb25zLCBkZWZhdWx0UHJvZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvT3BlbkluQnJvd3NlcldpbmRvdyh3aW5kb3csIGNvbmZpZ3VyYXRpb24sIG9wdGlvbnMsIGRlZmF1bHRQcm9maWxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gd2luZG93O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb09wZW5JbkJyb3dzZXJXaW5kb3cod2luZG93OiBJQ29kZVdpbmRvdywgY29uZmlndXJhdGlvbjogSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24sIG9wdGlvbnM6IElPcGVuQnJvd3NlcldpbmRvd09wdGlvbnMsIGRlZmF1bHRQcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBSZWdpc3RlciB3aW5kb3cgZm9yIGJhY2t1cHMgdW5sZXNzIHRoZSB3aW5kb3dcblx0XHQvLyBpcyBmb3IgZXh0ZW5zaW9uIGRldmVsb3BtZW50LCB3aGVyZSB3ZSBkbyBub3Rcblx0XHQvLyBrZWVwIGFueSBiYWNrdXBzLlxuXG5cdFx0aWYgKCFjb25maWd1cmF0aW9uLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkge1xuXHRcdFx0aWYgKGlzV29ya3NwYWNlSWRlbnRpZmllcihjb25maWd1cmF0aW9uLndvcmtzcGFjZSkpIHtcblx0XHRcdFx0Y29uZmlndXJhdGlvbi5iYWNrdXBQYXRoID0gdGhpcy5iYWNrdXBNYWluU2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh7XG5cdFx0XHRcdFx0d29ya3NwYWNlOiBjb25maWd1cmF0aW9uLndvcmtzcGFjZSxcblx0XHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IGNvbmZpZ3VyYXRpb24ucmVtb3RlQXV0aG9yaXR5XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIoY29uZmlndXJhdGlvbi53b3Jrc3BhY2UpKSB7XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb24uYmFja3VwUGF0aCA9IHRoaXMuYmFja3VwTWFpblNlcnZpY2UucmVnaXN0ZXJGb2xkZXJCYWNrdXAoe1xuXHRcdFx0XHRcdGZvbGRlclVyaTogY29uZmlndXJhdGlvbi53b3Jrc3BhY2UudXJpLFxuXHRcdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogY29uZmlndXJhdGlvbi5yZW1vdGVBdXRob3JpdHlcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vIEVtcHR5IHdpbmRvd3MgYXJlIHNwZWNpYWwgaW4gdGhhdCB0aGV5IHByb3ZpZGUgbm8gd29ya3NwYWNlIG9uXG5cdFx0XHRcdC8vIHRoZWlyIGNvbmZpZ3VyYXRpb24uIFRvIHByb3Blcmx5IHJlZ2lzdGVyIHRoZW0gd2l0aCB0aGUgYmFja3VwXG5cdFx0XHRcdC8vIHNlcnZpY2UsIHdlIGVpdGhlciB1c2UgdGhlIHByb3ZpZGVkIGFzc29jaWF0ZWQgYGJhY2t1cEZvbGRlcmBcblx0XHRcdFx0Ly8gaW4gY2FzZSB3ZSByZXN0b3JlIGEgcHJldmlvdXNseSBvcGVuZWQgZW1wdHkgd2luZG93IG9yIHdlIGhhdmVcblx0XHRcdFx0Ly8gdG8gZ2VuZXJhdGUgYSBuZXcgZW1wdHkgd2luZG93IHdvcmtzcGFjZSBpZGVudGlmaWVyIHRvIGJlIHVzZWRcblx0XHRcdFx0Ly8gYXMgYGJhY2t1cEZvbGRlcmAuXG5cblx0XHRcdFx0Y29uZmlndXJhdGlvbi5iYWNrdXBQYXRoID0gdGhpcy5iYWNrdXBNYWluU2VydmljZS5yZWdpc3RlckVtcHR5V2luZG93QmFja3VwKHtcblx0XHRcdFx0XHRiYWNrdXBGb2xkZXI6IG9wdGlvbnMuZW1wdHlXaW5kb3dCYWNrdXBJbmZvPy5iYWNrdXBGb2xkZXIgPz8gY3JlYXRlRW1wdHlXb3Jrc3BhY2VJZGVudGlmaWVyKCkuaWQsXG5cdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBjb25maWd1cmF0aW9uLnJlbW90ZUF1dGhvcml0eVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBjb25maWd1cmF0aW9uLndvcmtzcGFjZSA/PyB0b1dvcmtzcGFjZUlkZW50aWZpZXIoY29uZmlndXJhdGlvbi5iYWNrdXBQYXRoLCBmYWxzZSk7XG5cdFx0Y29uc3QgcHJvZmlsZVByb21pc2UgPSB0aGlzLnJlc29sdmVQcm9maWxlRm9yQnJvd3NlcldpbmRvdyhvcHRpb25zLCB3b3Jrc3BhY2UsIGRlZmF1bHRQcm9maWxlKTtcblx0XHRjb25zdCBwcm9maWxlID0gcHJvZmlsZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlID8gYXdhaXQgcHJvZmlsZVByb21pc2UgOiBwcm9maWxlUHJvbWlzZTtcblx0XHRjb25maWd1cmF0aW9uLnByb2ZpbGVzLnByb2ZpbGUgPSBwcm9maWxlO1xuXG5cdFx0aWYgKCFjb25maWd1cmF0aW9uLmV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkge1xuXHRcdFx0Ly8gQXNzb2NpYXRlIHRoZSBjb25maWd1cmVkIHByb2ZpbGUgdG8gdGhlIHdvcmtzcGFjZVxuXHRcdFx0Ly8gdW5sZXNzIHRoZSB3aW5kb3cgaXMgZm9yIGV4dGVuc2lvbiBkZXZlbG9wbWVudCxcblx0XHRcdC8vIHdoZXJlIHdlIGRvIG5vdCBwZXJzaXN0IHRoZSBhc3NvY2lhdGlvbnNcblx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlLnNldFByb2ZpbGVGb3JXb3Jrc3BhY2Uod29ya3NwYWNlLCBwcm9maWxlKTtcblx0XHR9XG5cblx0XHQvLyBMb2FkIGl0XG5cdFx0d2luZG93LmxvYWQoY29uZmlndXJhdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIHJlc29sdmVQcm9maWxlRm9yQnJvd3NlcldpbmRvdyhvcHRpb25zOiBJT3BlbkJyb3dzZXJXaW5kb3dPcHRpb25zLCB3b3Jrc3BhY2U6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyLCBkZWZhdWx0UHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZT4gfCBJVXNlckRhdGFQcm9maWxlIHtcblx0XHRpZiAob3B0aW9ucy5mb3JjZVByb2ZpbGUpIHtcblx0XHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZS5wcm9maWxlcy5maW5kKHAgPT4gcC5uYW1lID09PSBvcHRpb25zLmZvcmNlUHJvZmlsZSkgPz8gdGhpcy51c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UuY3JlYXRlTmFtZWRQcm9maWxlKG9wdGlvbnMuZm9yY2VQcm9maWxlKTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5mb3JjZVRlbXBQcm9maWxlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy51c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UuY3JlYXRlVHJhbnNpZW50UHJvZmlsZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZS5nZXRQcm9maWxlRm9yV29ya3NwYWNlKHdvcmtzcGFjZSkgPz8gZGVmYXVsdFByb2ZpbGU7XG5cdH1cblxuXHRwcml2YXRlIG9uV2luZG93Q2xvc2VkKHdpbmRvdzogSUNvZGVXaW5kb3csIGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZSk6IHZvaWQge1xuXG5cdFx0Ly8gUmVtb3ZlIGZyb20gb3VyIGxpc3Qgc28gdGhhdCBFbGVjdHJvbiBjYW4gY2xlYW4gaXQgdXBcblx0XHR0aGlzLndpbmRvd3MuZGVsZXRlKHdpbmRvdy5pZCk7XG5cblx0XHQvLyBFbWl0XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VXaW5kb3dzQ291bnQuZmlyZSh7IG9sZENvdW50OiB0aGlzLmdldFdpbmRvd0NvdW50KCkgKyAxLCBuZXdDb3VudDogdGhpcy5nZXRXaW5kb3dDb3VudCgpIH0pO1xuXG5cdFx0Ly8gQ2xlYW4gdXBcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uV2luZG93RGVzdHJveWVkKHdpbmRvdzogSUNvZGVXaW5kb3cpOiB2b2lkIHtcblxuXHRcdC8vIFJlbW92ZSBmcm9tIG91ciBsaXN0IHNvIHRoYXQgRWxlY3Ryb24gY2FuIGNsZWFuIGl0IHVwXG5cdFx0dGhpcy53aW5kb3dzLmRlbGV0ZSh3aW5kb3cuaWQpO1xuXG5cdFx0Ly8gRW1pdFxuXHRcdHRoaXMuX29uRGlkRGVzdHJveVdpbmRvdy5maXJlKHdpbmRvdyk7XG5cdH1cblxuXHRnZXRGb2N1c2VkV2luZG93KCk6IElDb2RlV2luZG93IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB3aW5kb3cgPSBCcm93c2VyV2luZG93LmdldEZvY3VzZWRXaW5kb3coKTtcblx0XHRpZiAod2luZG93KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRXaW5kb3dCeUlkKHdpbmRvdy5pZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldExhc3RBY3RpdmVXaW5kb3coKTogSUNvZGVXaW5kb3cgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRvR2V0TGFzdEFjdGl2ZVdpbmRvdyh0aGlzLmdldFdpbmRvd3MoKSk7XG5cdH1cblxuXHRwcml2YXRlIGdldExhc3RBY3RpdmVXaW5kb3dGb3JBdXRob3JpdHkocmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZG9HZXRMYXN0QWN0aXZlV2luZG93KHRoaXMuZ2V0V2luZG93cygpLmZpbHRlcih3aW5kb3cgPT4gaXNFcXVhbEF1dGhvcml0eSh3aW5kb3cucmVtb3RlQXV0aG9yaXR5LCByZW1vdGVBdXRob3JpdHkpKSk7XG5cdH1cblxuXHRwcml2YXRlIGRvR2V0TGFzdEFjdGl2ZVdpbmRvdyh3aW5kb3dzOiBJQ29kZVdpbmRvd1tdKTogSUNvZGVXaW5kb3cgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBnZXRMYXN0Rm9jdXNlZCh3aW5kb3dzKTtcblx0fVxuXG5cdHNlbmRUb0ZvY3VzZWQoY2hhbm5lbDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGZvY3VzZWRXaW5kb3cgPSB0aGlzLmdldEZvY3VzZWRXaW5kb3coKSB8fCB0aGlzLmdldExhc3RBY3RpdmVXaW5kb3coKTtcblxuXHRcdGZvY3VzZWRXaW5kb3c/LnNlbmRXaGVuUmVhZHkoY2hhbm5lbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgLi4uYXJncyk7XG5cdH1cblxuXHRzZW5kVG9PcGVuaW5nV2luZG93KGNoYW5uZWw6IHN0cmluZywgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5vbmNlKHRoaXMub25EaWRTaWduYWxSZWFkeVdpbmRvdykod2luZG93ID0+IHtcblx0XHRcdHdpbmRvdy5zZW5kV2hlblJlYWR5KGNoYW5uZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUsIC4uLmFyZ3MpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHNlbmRUb0FsbChjaGFubmVsOiBzdHJpbmcsIHBheWxvYWQ/OiBhbnksIHdpbmRvd0lkc1RvSWdub3JlPzogbnVtYmVyW10pOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IHdpbmRvdyBvZiB0aGlzLmdldFdpbmRvd3MoKSkge1xuXHRcdFx0aWYgKHdpbmRvd0lkc1RvSWdub3JlICYmIHdpbmRvd0lkc1RvSWdub3JlLmluZGV4T2Yod2luZG93LmlkKSA+PSAwKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBkbyBub3Qgc2VuZCBpZiB3ZSBhcmUgaW5zdHJ1Y3RlZCB0byBpZ25vcmUgaXRcblx0XHRcdH1cblxuXHRcdFx0d2luZG93LnNlbmRXaGVuUmVhZHkoY2hhbm5lbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSwgcGF5bG9hZCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0V2luZG93cygpOiBJQ29kZVdpbmRvd1tdIHtcblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLndpbmRvd3MudmFsdWVzKCkpO1xuXHR9XG5cblx0Z2V0V2luZG93Q291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy53aW5kb3dzLnNpemU7XG5cdH1cblxuXHRnZXRXaW5kb3dCeUlkKHdpbmRvd0lkOiBudW1iZXIpOiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMud2luZG93cy5nZXQod2luZG93SWQpO1xuXHR9XG5cblx0Z2V0V2luZG93QnlXZWJDb250ZW50cyh3ZWJDb250ZW50czogV2ViQ29udGVudHMpOiBJQ29kZVdpbmRvdyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgYnJvd3NlcldpbmRvdyA9IEJyb3dzZXJXaW5kb3cuZnJvbVdlYkNvbnRlbnRzKHdlYkNvbnRlbnRzKTtcblx0XHRpZiAoIWJyb3dzZXJXaW5kb3cpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2luZG93ID0gdGhpcy5nZXRXaW5kb3dCeUlkKGJyb3dzZXJXaW5kb3cuaWQpO1xuXG5cdFx0cmV0dXJuIHdpbmRvdz8ubWF0Y2hlcyh3ZWJDb250ZW50cykgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsS0FBSyxlQUE0QixhQUFhO0FBQ3ZELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsVUFBVSxTQUFTLFlBQVk7QUFDeEMsU0FBUyxVQUFVLGdCQUFnQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHNCQUFzQix5QkFBeUIsa0JBQWtCLGlCQUFpQjtBQUMzRixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFlBQVksdUJBQW9DO0FBQ3pELFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsTUFBTSxXQUFXLGFBQWE7QUFDakQsU0FBUyxVQUFVLFlBQVk7QUFDL0IsU0FBOEIsYUFBYSxXQUFXLFVBQVU7QUFDaEUsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsNEJBQTRCLGtCQUFrQixlQUFlLGdCQUFnQixtQ0FBbUM7QUFDekgsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCLGdCQUFnQixnQkFBZ0I7QUFDekQs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
