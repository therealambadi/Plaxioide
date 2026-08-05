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
import { hasWorkspaceFileExtension, isSavedWorkspace, isUntitledWorkspace, isWorkspaceIdentifier, IWorkspaceContextService, toWorkspaceIdentifier, WorkbenchState, WORKSPACE_EXTENSION, WORKSPACE_FILTER } from "../../../../platform/workspace/common/workspace.js";
import { IJSONEditingService, JSONEditingErrorCode } from "../../configuration/common/jsonEditing.js";
import { IWorkspacesService, rewriteWorkspaceFileForNewLocation } from "../../../../platform/workspaces/common/workspaces.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { distinct } from "../../../../base/common/arrays.js";
import { basename, isEqual, isEqualAuthority, joinPath, removeTrailingPathSeparator } from "../../../../base/common/resources.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ITextFileService } from "../../textfile/common/textfiles.js";
import { IHostService } from "../../host/browser/host.js";
import { Schemas } from "../../../../base/common/network.js";
import { SaveReason } from "../../../common/editor.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchConfigurationService } from "../../configuration/common/configuration.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
let AbstractWorkspaceEditingService = class extends Disposable {
  constructor(jsonEditingService, contextService, configurationService, notificationService, commandService, fileService, textFileService, workspacesService, environmentService, fileDialogService, dialogService, hostService, uriIdentityService, workspaceTrustManagementService, userDataProfilesService, userDataProfileService) {
    super();
    this.jsonEditingService = jsonEditingService;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.notificationService = notificationService;
    this.commandService = commandService;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.workspacesService = workspacesService;
    this.environmentService = environmentService;
    this.fileDialogService = fileDialogService;
    this.dialogService = dialogService;
    this.hostService = hostService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileService = userDataProfileService;
  }
  async pickNewWorkspacePath() {
    const availableFileSystems = [Schemas.file];
    if (this.environmentService.remoteAuthority) {
      availableFileSystems.unshift(Schemas.vscodeRemote);
    }
    let workspacePath = await this.fileDialogService.showSaveDialog({
      saveLabel: localize("save", "Save"),
      title: localize("saveWorkspace", "Save Workspace"),
      filters: WORKSPACE_FILTER,
      defaultUri: joinPath(await this.fileDialogService.defaultWorkspacePath(), this.getNewWorkspaceName()),
      availableFileSystems
    });
    if (!workspacePath) {
      return;
    }
    if (!hasWorkspaceFileExtension(workspacePath)) {
      workspacePath = workspacePath.with({ path: `${workspacePath.path}.${WORKSPACE_EXTENSION}` });
    }
    return workspacePath;
  }
  getNewWorkspaceName() {
    const configPathURI = this.getCurrentWorkspaceIdentifier()?.configPath;
    if (configPathURI && isSavedWorkspace(configPathURI, this.environmentService)) {
      return basename(configPathURI);
    }
    const folder = this.contextService.getWorkspace().folders.at(0);
    if (folder) {
      return `${basename(folder.uri)}.${WORKSPACE_EXTENSION}`;
    }
    return `workspace.${WORKSPACE_EXTENSION}`;
  }
  async updateFolders(index, deleteCount, foldersToAddCandidates, donotNotifyError) {
    const folders = this.contextService.getWorkspace().folders;
    let foldersToDelete = [];
    if (typeof deleteCount === "number") {
      foldersToDelete = folders.slice(index, index + deleteCount).map((folder) => folder.uri);
    }
    let foldersToAdd = [];
    if (Array.isArray(foldersToAddCandidates)) {
      foldersToAdd = foldersToAddCandidates.map((folderToAdd) => ({ uri: removeTrailingPathSeparator(folderToAdd.uri), name: folderToAdd.name }));
    }
    const wantsToDelete = foldersToDelete.length > 0;
    const wantsToAdd = foldersToAdd.length > 0;
    if (!wantsToAdd && !wantsToDelete) {
      return;
    }
    if (wantsToAdd && !wantsToDelete) {
      return this.doAddFolders(foldersToAdd, index, donotNotifyError);
    }
    if (wantsToDelete && !wantsToAdd) {
      return this.removeFolders(foldersToDelete);
    } else {
      if (this.includesSingleFolderWorkspace(foldersToDelete)) {
        return this.createAndEnterWorkspace(foldersToAdd);
      }
      if (this.contextService.getWorkbenchState() !== WorkbenchState.WORKSPACE) {
        return this.doAddFolders(foldersToAdd, index, donotNotifyError);
      }
      return this.doUpdateFolders(foldersToAdd, foldersToDelete, index, donotNotifyError);
    }
  }
  async doUpdateFolders(foldersToAdd, foldersToDelete, index, donotNotifyError = false) {
    try {
      await this.contextService.updateFolders(foldersToAdd, foldersToDelete, index);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  addFolders(foldersToAddCandidates, donotNotifyError = false) {
    const foldersToAdd = foldersToAddCandidates.map((folderToAdd) => ({ uri: removeTrailingPathSeparator(folderToAdd.uri), name: folderToAdd.name }));
    return this.doAddFolders(foldersToAdd, void 0, donotNotifyError);
  }
  async doAddFolders(foldersToAdd, index, donotNotifyError = false) {
    const state = this.contextService.getWorkbenchState();
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (remoteAuthority) {
      foldersToAdd = foldersToAdd.filter((folder) => folder.uri.scheme !== Schemas.file && (folder.uri.scheme !== Schemas.vscodeRemote || isEqualAuthority(folder.uri.authority, remoteAuthority)));
    }
    if (state !== WorkbenchState.WORKSPACE) {
      let newWorkspaceFolders = this.contextService.getWorkspace().folders.map((folder) => ({ uri: folder.uri }));
      newWorkspaceFolders.splice(typeof index === "number" ? index : newWorkspaceFolders.length, 0, ...foldersToAdd);
      newWorkspaceFolders = distinct(newWorkspaceFolders, (folder) => this.uriIdentityService.extUri.getComparisonKey(folder.uri));
      if (state === WorkbenchState.EMPTY && newWorkspaceFolders.length === 0 || state === WorkbenchState.FOLDER && newWorkspaceFolders.length === 1) {
        return;
      }
      return this.createAndEnterWorkspace(newWorkspaceFolders);
    }
    try {
      await this.contextService.addFolders(foldersToAdd, index);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  async removeFolders(foldersToRemove, donotNotifyError = false) {
    if (this.includesSingleFolderWorkspace(foldersToRemove)) {
      return this.createAndEnterWorkspace([]);
    }
    try {
      await this.contextService.removeFolders(foldersToRemove);
    } catch (error) {
      if (donotNotifyError) {
        throw error;
      }
      this.handleWorkspaceConfigurationEditingError(error);
    }
  }
  includesSingleFolderWorkspace(folders) {
    if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceFolder = this.contextService.getWorkspace().folders[0];
      return folders.some((folder) => this.uriIdentityService.extUri.isEqual(folder, workspaceFolder.uri));
    }
    return false;
  }
  async createAndEnterWorkspace(folders, path) {
    if (path && !await this.isValidTargetWorkspacePath(path)) {
      return;
    }
    const remoteAuthority = this.environmentService.remoteAuthority;
    const untitledWorkspace = await this.workspacesService.createUntitledWorkspace(folders, remoteAuthority);
    if (path) {
      try {
        await this.saveWorkspaceAs(untitledWorkspace, path);
      } finally {
        await this.workspacesService.deleteUntitledWorkspace(untitledWorkspace);
      }
    } else {
      path = untitledWorkspace.configPath;
      if (!this.userDataProfileService.currentProfile.isDefault) {
        await this.userDataProfilesService.setProfileForWorkspace(untitledWorkspace, this.userDataProfileService.currentProfile);
      }
    }
    return this.enterWorkspace(path);
  }
  async saveAndEnterWorkspace(workspaceUri) {
    const workspaceIdentifier = this.getCurrentWorkspaceIdentifier();
    if (!workspaceIdentifier) {
      return;
    }
    if (isEqual(workspaceIdentifier.configPath, workspaceUri)) {
      return this.saveWorkspace(workspaceIdentifier);
    }
    if (!await this.isValidTargetWorkspacePath(workspaceUri)) {
      return;
    }
    await this.saveWorkspaceAs(workspaceIdentifier, workspaceUri);
    return this.enterWorkspace(workspaceUri);
  }
  async isValidTargetWorkspacePath(workspaceUri) {
    return true;
  }
  async saveWorkspaceAs(workspace, targetConfigPathURI) {
    const configPathURI = workspace.configPath;
    const isNotUntitledWorkspace = !isUntitledWorkspace(targetConfigPathURI, this.environmentService);
    if (isNotUntitledWorkspace && !this.userDataProfileService.currentProfile.isDefault) {
      const newWorkspace = await this.workspacesService.getWorkspaceIdentifier(targetConfigPathURI);
      await this.userDataProfilesService.setProfileForWorkspace(newWorkspace, this.userDataProfileService.currentProfile);
    }
    if (this.uriIdentityService.extUri.isEqual(configPathURI, targetConfigPathURI)) {
      return;
    }
    const isFromUntitledWorkspace = isUntitledWorkspace(configPathURI, this.environmentService);
    const raw = await this.fileService.readFile(configPathURI);
    const newRawWorkspaceContents = rewriteWorkspaceFileForNewLocation(raw.value.toString(), configPathURI, isFromUntitledWorkspace, targetConfigPathURI, this.uriIdentityService.extUri);
    await this.textFileService.create([{ resource: targetConfigPathURI, value: newRawWorkspaceContents, options: { overwrite: true } }]);
    await this.trustWorkspaceConfiguration(targetConfigPathURI);
  }
  async saveWorkspace(workspace) {
    const configPathURI = workspace.configPath;
    const existingModel = this.textFileService.files.get(configPathURI);
    if (existingModel) {
      await existingModel.save({ force: true, reason: SaveReason.EXPLICIT });
      return;
    }
    const workspaceFileExists = await this.fileService.exists(configPathURI);
    if (workspaceFileExists) {
      return;
    }
    const newWorkspace = { folders: [] };
    const newRawWorkspaceContents = rewriteWorkspaceFileForNewLocation(JSON.stringify(newWorkspace, null, "	"), configPathURI, false, configPathURI, this.uriIdentityService.extUri);
    await this.textFileService.create([{ resource: configPathURI, value: newRawWorkspaceContents }]);
  }
  handleWorkspaceConfigurationEditingError(error) {
    switch (error.code) {
      case JSONEditingErrorCode.ERROR_INVALID_FILE:
        this.onInvalidWorkspaceConfigurationFileError();
        break;
      default:
        this.notificationService.error(error.message);
    }
  }
  onInvalidWorkspaceConfigurationFileError() {
    const message = localize("errorInvalidTaskConfiguration", "Unable to write into workspace configuration file. Please open the file to correct errors/warnings in it and try again.");
    this.askToOpenWorkspaceConfigurationFile(message);
  }
  askToOpenWorkspaceConfigurationFile(message) {
    this.notificationService.prompt(
      Severity.Error,
      message,
      [{
        label: localize("openWorkspaceConfigurationFile", "Open Workspace Configuration"),
        run: () => this.commandService.executeCommand("workbench.action.openWorkspaceConfigFile")
      }]
    );
  }
  async doEnterWorkspace(workspaceUri) {
    if (!!this.environmentService.extensionTestsLocationURI) {
      throw new Error("Entering a new workspace is not possible in tests.");
    }
    const workspace = await this.workspacesService.getWorkspaceIdentifier(workspaceUri);
    if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
      await this.migrateWorkspaceSettings(workspace);
    }
    await this.configurationService.initialize(workspace);
    return this.workspacesService.enterWorkspace(workspaceUri);
  }
  migrateWorkspaceSettings(toWorkspace) {
    return this.doCopyWorkspaceSettings(toWorkspace, (setting) => setting.scope === ConfigurationScope.WINDOW);
  }
  copyWorkspaceSettings(toWorkspace) {
    return this.doCopyWorkspaceSettings(toWorkspace);
  }
  doCopyWorkspaceSettings(toWorkspace, filter) {
    const configurationProperties = Registry.as(ConfigurationExtensions.Configuration).getConfigurationProperties();
    const targetWorkspaceConfiguration = {};
    for (const key of this.configurationService.keys().workspace) {
      if (configurationProperties[key]) {
        if (filter && !filter(configurationProperties[key])) {
          continue;
        }
        targetWorkspaceConfiguration[key] = this.configurationService.inspect(key).workspaceValue;
      }
    }
    return this.jsonEditingService.write(toWorkspace.configPath, [{ path: ["settings"], value: targetWorkspaceConfiguration }], true);
  }
  async trustWorkspaceConfiguration(configPathURI) {
    if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      await this.workspaceTrustManagementService.setUrisTrust([configPathURI], true);
    }
  }
  getCurrentWorkspaceIdentifier() {
    const identifier = toWorkspaceIdentifier(this.contextService.getWorkspace());
    if (isWorkspaceIdentifier(identifier)) {
      return identifier;
    }
    return void 0;
  }
};
AbstractWorkspaceEditingService = __decorateClass([
  __decorateParam(0, IJSONEditingService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IWorkbenchConfigurationService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ITextFileService),
  __decorateParam(7, IWorkspacesService),
  __decorateParam(8, IWorkbenchEnvironmentService),
  __decorateParam(9, IFileDialogService),
  __decorateParam(10, IDialogService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IUriIdentityService),
  __decorateParam(13, IWorkspaceTrustManagementService),
  __decorateParam(14, IUserDataProfilesService),
  __decorateParam(15, IUserDataProfileService)
], AbstractWorkspaceEditingService);
export {
  AbstractWorkspaceEditingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya3NwYWNlcy9icm93c2VyL2Fic3RyYWN0V29ya3NwYWNlRWRpdGluZ1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vd29ya3NwYWNlRWRpdGluZy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgaGFzV29ya3NwYWNlRmlsZUV4dGVuc2lvbiwgaXNTYXZlZFdvcmtzcGFjZSwgaXNVbnRpdGxlZFdvcmtzcGFjZSwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VJZGVudGlmaWVyLCB0b1dvcmtzcGFjZUlkZW50aWZpZXIsIFdvcmtiZW5jaFN0YXRlLCBXT1JLU1BBQ0VfRVhURU5TSU9OLCBXT1JLU1BBQ0VfRklMVEVSIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUpTT05FZGl0aW5nU2VydmljZSwgSlNPTkVkaXRpbmdFcnJvciwgSlNPTkVkaXRpbmdFcnJvckNvZGUgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9qc29uRWRpdGluZy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhLCBJV29ya3NwYWNlc1NlcnZpY2UsIHJld3JpdGVXb3Jrc3BhY2VGaWxlRm9yTmV3TG9jYXRpb24sIElFbnRlcldvcmtzcGFjZVJlc3VsdCwgSVN0b3JlZFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vYnJvd3Nlci9jb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBpc0VxdWFsLCBpc0VxdWFsQXV0aG9yaXR5LCBqb2luUGF0aCwgcmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UsIElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJVGV4dEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBTYXZlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdFdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElKU09ORWRpdGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBqc29uRWRpdGluZ1NlcnZpY2U6IElKU09ORWRpdGluZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IFdvcmtzcGFjZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZXNTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB3b3Jrc3BhY2VzU2VydmljZTogSVdvcmtzcGFjZXNTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRhc3luYyBwaWNrTmV3V29ya3NwYWNlUGF0aCgpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gW1NjaGVtYXMuZmlsZV07XG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0YXZhaWxhYmxlRmlsZVN5c3RlbXMudW5zaGlmdChTY2hlbWFzLnZzY29kZVJlbW90ZSk7XG5cdFx0fVxuXHRcdGxldCB3b3Jrc3BhY2VQYXRoID0gYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5zaG93U2F2ZURpYWxvZyh7XG5cdFx0XHRzYXZlTGFiZWw6IGxvY2FsaXplKCdzYXZlJywgXCJTYXZlXCIpLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzYXZlV29ya3NwYWNlJywgXCJTYXZlIFdvcmtzcGFjZVwiKSxcblx0XHRcdGZpbHRlcnM6IFdPUktTUEFDRV9GSUxURVIsXG5cdFx0XHRkZWZhdWx0VXJpOiBqb2luUGF0aChhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLmRlZmF1bHRXb3Jrc3BhY2VQYXRoKCksIHRoaXMuZ2V0TmV3V29ya3NwYWNlTmFtZSgpKSxcblx0XHRcdGF2YWlsYWJsZUZpbGVTeXN0ZW1zXG5cdFx0fSk7XG5cblx0XHRpZiAoIXdvcmtzcGFjZVBhdGgpIHtcblx0XHRcdHJldHVybjsgLy8gY2FuY2VsZWRcblx0XHR9XG5cblx0XHRpZiAoIWhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24od29ya3NwYWNlUGF0aCkpIHtcblx0XHRcdC8vIEFsd2F5cyBlbnN1cmUgd2UgaGF2ZSB3b3Jrc3BhY2UgZmlsZSBleHRlbnNpb25cblx0XHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg0ODE4KVxuXHRcdFx0d29ya3NwYWNlUGF0aCA9IHdvcmtzcGFjZVBhdGgud2l0aCh7IHBhdGg6IGAke3dvcmtzcGFjZVBhdGgucGF0aH0uJHtXT1JLU1BBQ0VfRVhURU5TSU9OfWAgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdvcmtzcGFjZVBhdGg7XG5cdH1cblxuXHRwcml2YXRlIGdldE5ld1dvcmtzcGFjZU5hbWUoKTogc3RyaW5nIHtcblxuXHRcdC8vIEZpcnN0IHRyeSB3aXRoIGV4aXN0aW5nIHdvcmtzcGFjZSBuYW1lXG5cdFx0Y29uc3QgY29uZmlnUGF0aFVSSSA9IHRoaXMuZ2V0Q3VycmVudFdvcmtzcGFjZUlkZW50aWZpZXIoKT8uY29uZmlnUGF0aDtcblx0XHRpZiAoY29uZmlnUGF0aFVSSSAmJiBpc1NhdmVkV29ya3NwYWNlKGNvbmZpZ1BhdGhVUkksIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlKSkge1xuXHRcdFx0cmV0dXJuIGJhc2VuYW1lKGNvbmZpZ1BhdGhVUkkpO1xuXHRcdH1cblxuXHRcdC8vIFRoZW4gZmFsbGJhY2sgdG8gZmlyc3QgZm9sZGVyIGlmIGFueVxuXHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5hdCgwKTtcblx0XHRpZiAoZm9sZGVyKSB7XG5cdFx0XHRyZXR1cm4gYCR7YmFzZW5hbWUoZm9sZGVyLnVyaSl9LiR7V09SS1NQQUNFX0VYVEVOU0lPTn1gO1xuXHRcdH1cblxuXHRcdC8vIEZpbmFsbHkgcGljayBhIGdvb2QgZGVmYXVsdFxuXHRcdHJldHVybiBgd29ya3NwYWNlLiR7V09SS1NQQUNFX0VYVEVOU0lPTn1gO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlRm9sZGVycyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudD86IG51bWJlciwgZm9sZGVyc1RvQWRkQ2FuZGlkYXRlcz86IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGFbXSwgZG9ub3ROb3RpZnlFcnJvcj86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXG5cdFx0bGV0IGZvbGRlcnNUb0RlbGV0ZTogVVJJW10gPSBbXTtcblx0XHRpZiAodHlwZW9mIGRlbGV0ZUNvdW50ID09PSAnbnVtYmVyJykge1xuXHRcdFx0Zm9sZGVyc1RvRGVsZXRlID0gZm9sZGVycy5zbGljZShpbmRleCwgaW5kZXggKyBkZWxldGVDb3VudCkubWFwKGZvbGRlciA9PiBmb2xkZXIudXJpKTtcblx0XHR9XG5cblx0XHRsZXQgZm9sZGVyc1RvQWRkOiBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhW10gPSBbXTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShmb2xkZXJzVG9BZGRDYW5kaWRhdGVzKSkge1xuXHRcdFx0Zm9sZGVyc1RvQWRkID0gZm9sZGVyc1RvQWRkQ2FuZGlkYXRlcy5tYXAoZm9sZGVyVG9BZGQgPT4gKHsgdXJpOiByZW1vdmVUcmFpbGluZ1BhdGhTZXBhcmF0b3IoZm9sZGVyVG9BZGQudXJpKSwgbmFtZTogZm9sZGVyVG9BZGQubmFtZSB9KSk7IC8vIE5vcm1hbGl6ZVxuXHRcdH1cblxuXHRcdGNvbnN0IHdhbnRzVG9EZWxldGUgPSBmb2xkZXJzVG9EZWxldGUubGVuZ3RoID4gMDtcblx0XHRjb25zdCB3YW50c1RvQWRkID0gZm9sZGVyc1RvQWRkLmxlbmd0aCA+IDA7XG5cblx0XHRpZiAoIXdhbnRzVG9BZGQgJiYgIXdhbnRzVG9EZWxldGUpIHtcblx0XHRcdHJldHVybjsgLy8gcmV0dXJuIGVhcmx5IGlmIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cblx0XHR9XG5cblx0XHQvLyBBZGQgRm9sZGVyc1xuXHRcdGlmICh3YW50c1RvQWRkICYmICF3YW50c1RvRGVsZXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0FkZEZvbGRlcnMoZm9sZGVyc1RvQWRkLCBpbmRleCwgZG9ub3ROb3RpZnlFcnJvcik7XG5cdFx0fVxuXG5cdFx0Ly8gRGVsZXRlIEZvbGRlcnNcblx0XHRpZiAod2FudHNUb0RlbGV0ZSAmJiAhd2FudHNUb0FkZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVtb3ZlRm9sZGVycyhmb2xkZXJzVG9EZWxldGUpO1xuXHRcdH1cblxuXHRcdC8vIEFkZCAmIERlbGV0ZSBGb2xkZXJzXG5cdFx0ZWxzZSB7XG5cblx0XHRcdC8vIGlmIHdlIGFyZSBpbiBzaW5nbGUtZm9sZGVyIHN0YXRlIGFuZCB0aGUgZm9sZGVyIGlzIHJlcGxhY2VkIHdpdGhcblx0XHRcdC8vIG90aGVyIGZvbGRlcnMsIHdlIGhhbmRsZSB0aGlzIHNwZWNpYWxseSBhbmQganVzdCBlbnRlciB3b3Jrc3BhY2Vcblx0XHRcdC8vIG1vZGUgd2l0aCB0aGUgZm9sZGVycyB0aGF0IGFyZSBiZWluZyBhZGRlZC5cblx0XHRcdGlmICh0aGlzLmluY2x1ZGVzU2luZ2xlRm9sZGVyV29ya3NwYWNlKGZvbGRlcnNUb0RlbGV0ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlQW5kRW50ZXJXb3Jrc3BhY2UoZm9sZGVyc1RvQWRkKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gaWYgd2UgYXJlIG5vdCBpbiB3b3Jrc3BhY2Utc3RhdGUsIHdlIGp1c3QgYWRkIHRoZSBmb2xkZXJzXG5cdFx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZG9BZGRGb2xkZXJzKGZvbGRlcnNUb0FkZCwgaW5kZXgsIGRvbm90Tm90aWZ5RXJyb3IpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBmaW5hbGx5LCB1cGRhdGUgZm9sZGVycyB3aXRoaW4gdGhlIHdvcmtzcGFjZVxuXHRcdFx0cmV0dXJuIHRoaXMuZG9VcGRhdGVGb2xkZXJzKGZvbGRlcnNUb0FkZCwgZm9sZGVyc1RvRGVsZXRlLCBpbmRleCwgZG9ub3ROb3RpZnlFcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1VwZGF0ZUZvbGRlcnMoZm9sZGVyc1RvQWRkOiBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhW10sIGZvbGRlcnNUb0RlbGV0ZTogVVJJW10sIGluZGV4PzogbnVtYmVyLCBkb25vdE5vdGlmeUVycm9yOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jb250ZXh0U2VydmljZS51cGRhdGVGb2xkZXJzKGZvbGRlcnNUb0FkZCwgZm9sZGVyc1RvRGVsZXRlLCBpbmRleCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChkb25vdE5vdGlmeUVycm9yKSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmhhbmRsZVdvcmtzcGFjZUNvbmZpZ3VyYXRpb25FZGl0aW5nRXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdGFkZEZvbGRlcnMoZm9sZGVyc1RvQWRkQ2FuZGlkYXRlczogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdLCBkb25vdE5vdGlmeUVycm9yOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIE5vcm1hbGl6ZVxuXHRcdGNvbnN0IGZvbGRlcnNUb0FkZCA9IGZvbGRlcnNUb0FkZENhbmRpZGF0ZXMubWFwKGZvbGRlclRvQWRkID0+ICh7IHVyaTogcmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yKGZvbGRlclRvQWRkLnVyaSksIG5hbWU6IGZvbGRlclRvQWRkLm5hbWUgfSkpO1xuXG5cdFx0cmV0dXJuIHRoaXMuZG9BZGRGb2xkZXJzKGZvbGRlcnNUb0FkZCwgdW5kZWZpbmVkLCBkb25vdE5vdGlmeUVycm9yKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9BZGRGb2xkZXJzKGZvbGRlcnNUb0FkZDogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdLCBpbmRleD86IG51bWJlciwgZG9ub3ROb3RpZnlFcnJvcjogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCk7XG5cdFx0Y29uc3QgcmVtb3RlQXV0aG9yaXR5ID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5O1xuXHRcdGlmIChyZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85NDE5MVxuXHRcdFx0Zm9sZGVyc1RvQWRkID0gZm9sZGVyc1RvQWRkLmZpbHRlcihmb2xkZXIgPT4gZm9sZGVyLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMuZmlsZSAmJiAoZm9sZGVyLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlUmVtb3RlIHx8IGlzRXF1YWxBdXRob3JpdHkoZm9sZGVyLnVyaS5hdXRob3JpdHksIHJlbW90ZUF1dGhvcml0eSkpKTtcblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBhcmUgaW4gbm8td29ya3NwYWNlIG9yIHNpbmdsZS1mb2xkZXIgd29ya3NwYWNlLCBhZGRpbmcgZm9sZGVycyBoYXMgdG9cblx0XHQvLyBlbnRlciBhIHdvcmtzcGFjZS5cblx0XHRpZiAoc3RhdGUgIT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0bGV0IG5ld1dvcmtzcGFjZUZvbGRlcnMgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubWFwKGZvbGRlciA9PiAoeyB1cmk6IGZvbGRlci51cmkgfSkpO1xuXHRcdFx0bmV3V29ya3NwYWNlRm9sZGVycy5zcGxpY2UodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJyA/IGluZGV4IDogbmV3V29ya3NwYWNlRm9sZGVycy5sZW5ndGgsIDAsIC4uLmZvbGRlcnNUb0FkZCk7XG5cdFx0XHRuZXdXb3Jrc3BhY2VGb2xkZXJzID0gZGlzdGluY3QobmV3V29ya3NwYWNlRm9sZGVycywgZm9sZGVyID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5nZXRDb21wYXJpc29uS2V5KGZvbGRlci51cmkpKTtcblxuXHRcdFx0aWYgKHN0YXRlID09PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSAmJiBuZXdXb3Jrc3BhY2VGb2xkZXJzLmxlbmd0aCA9PT0gMCB8fCBzdGF0ZSA9PT0gV29ya2JlbmNoU3RhdGUuRk9MREVSICYmIG5ld1dvcmtzcGFjZUZvbGRlcnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHJldHVybjsgLy8gcmV0dXJuIGlmIHRoZSBvcGVyYXRpb24gaXMgYSBuby1vcCBmb3IgdGhlIGN1cnJlbnQgc3RhdGVcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlQW5kRW50ZXJXb3Jrc3BhY2UobmV3V29ya3NwYWNlRm9sZGVycyk7XG5cdFx0fVxuXG5cdFx0Ly8gRGVsZWdhdGUgYWRkaXRpb24gb2YgZm9sZGVycyB0byB3b3Jrc3BhY2Ugc2VydmljZSBvdGhlcndpc2Vcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jb250ZXh0U2VydmljZS5hZGRGb2xkZXJzKGZvbGRlcnNUb0FkZCwgaW5kZXgpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoZG9ub3ROb3RpZnlFcnJvcikge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5oYW5kbGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uRWRpdGluZ0Vycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZW1vdmVGb2xkZXJzKGZvbGRlcnNUb1JlbW92ZTogVVJJW10sIGRvbm90Tm90aWZ5RXJyb3I6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gSWYgd2UgYXJlIGluIHNpbmdsZS1mb2xkZXIgc3RhdGUgYW5kIHRoZSBvcGVuZWQgZm9sZGVyIGlzIHRvIGJlIHJlbW92ZWQsXG5cdFx0Ly8gd2UgY3JlYXRlIGFuIGVtcHR5IHdvcmtzcGFjZSBhbmQgZW50ZXIgaXQuXG5cdFx0aWYgKHRoaXMuaW5jbHVkZXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2UoZm9sZGVyc1RvUmVtb3ZlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlQW5kRW50ZXJXb3Jrc3BhY2UoW10pO1xuXHRcdH1cblxuXHRcdC8vIERlbGVnYXRlIHJlbW92YWwgb2YgZm9sZGVycyB0byB3b3Jrc3BhY2Ugc2VydmljZSBvdGhlcndpc2Vcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jb250ZXh0U2VydmljZS5yZW1vdmVGb2xkZXJzKGZvbGRlcnNUb1JlbW92ZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChkb25vdE5vdGlmeUVycm9yKSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmhhbmRsZVdvcmtzcGFjZUNvbmZpZ3VyYXRpb25FZGl0aW5nRXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaW5jbHVkZXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2UoZm9sZGVyczogVVJJW10pOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXTtcblx0XHRcdHJldHVybiAoZm9sZGVycy5zb21lKGZvbGRlciA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChmb2xkZXIsIHdvcmtzcGFjZUZvbGRlci51cmkpKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlQW5kRW50ZXJXb3Jrc3BhY2UoZm9sZGVyczogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdLCBwYXRoPzogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHBhdGggJiYgIWF3YWl0IHRoaXMuaXNWYWxpZFRhcmdldFdvcmtzcGFjZVBhdGgocGF0aCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0Y29uc3QgdW50aXRsZWRXb3Jrc3BhY2UgPSBhd2FpdCB0aGlzLndvcmtzcGFjZXNTZXJ2aWNlLmNyZWF0ZVVudGl0bGVkV29ya3NwYWNlKGZvbGRlcnMsIHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0aWYgKHBhdGgpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc2F2ZVdvcmtzcGFjZUFzKHVudGl0bGVkV29ya3NwYWNlLCBwYXRoKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlc1NlcnZpY2UuZGVsZXRlVW50aXRsZWRXb3Jrc3BhY2UodW50aXRsZWRXb3Jrc3BhY2UpOyAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTAwMjc2XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBhdGggPSB1bnRpdGxlZFdvcmtzcGFjZS5jb25maWdQYXRoO1xuXHRcdFx0aWYgKCF0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2Uuc2V0UHJvZmlsZUZvcldvcmtzcGFjZSh1bnRpdGxlZFdvcmtzcGFjZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5lbnRlcldvcmtzcGFjZShwYXRoKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVBbmRFbnRlcldvcmtzcGFjZSh3b3Jrc3BhY2VVcmk6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZUlkZW50aWZpZXIgPSB0aGlzLmdldEN1cnJlbnRXb3Jrc3BhY2VJZGVudGlmaWVyKCk7XG5cdFx0aWYgKCF3b3Jrc3BhY2VJZGVudGlmaWVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQWxsb3cgdG8gc2F2ZSB0aGUgd29ya3NwYWNlIG9mIHRoZSBjdXJyZW50IHdpbmRvd1xuXHRcdC8vIGlmIHdlIGhhdmUgYW4gaWRlbnRpY2FsIG1hdGNoIG9uIHRoZSBwYXRoXG5cdFx0aWYgKGlzRXF1YWwod29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoLCB3b3Jrc3BhY2VVcmkpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zYXZlV29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXIpO1xuXHRcdH1cblxuXHRcdC8vIEZyb20gdGhpcyBtb21lbnQgb24gd2UgcmVxdWlyZSBhIHZhbGlkIHRhcmdldCB0aGF0IGlzIG5vdCBvcGVuZWQgYWxyZWFkeVxuXHRcdGlmICghYXdhaXQgdGhpcy5pc1ZhbGlkVGFyZ2V0V29ya3NwYWNlUGF0aCh3b3Jrc3BhY2VVcmkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5zYXZlV29ya3NwYWNlQXMod29ya3NwYWNlSWRlbnRpZmllciwgd29ya3NwYWNlVXJpKTtcblxuXHRcdHJldHVybiB0aGlzLmVudGVyV29ya3NwYWNlKHdvcmtzcGFjZVVyaSk7XG5cdH1cblxuXHRhc3luYyBpc1ZhbGlkVGFyZ2V0V29ya3NwYWNlUGF0aCh3b3Jrc3BhY2VVcmk6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0cnVlOyAvLyBPS1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHNhdmVXb3Jrc3BhY2VBcyh3b3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyLCB0YXJnZXRDb25maWdQYXRoVVJJOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb25maWdQYXRoVVJJID0gd29ya3NwYWNlLmNvbmZpZ1BhdGg7XG5cblx0XHRjb25zdCBpc05vdFVudGl0bGVkV29ya3NwYWNlID0gIWlzVW50aXRsZWRXb3Jrc3BhY2UodGFyZ2V0Q29uZmlnUGF0aFVSSSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGlmIChpc05vdFVudGl0bGVkV29ya3NwYWNlICYmICF0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRjb25zdCBuZXdXb3Jrc3BhY2UgPSBhd2FpdCB0aGlzLndvcmtzcGFjZXNTZXJ2aWNlLmdldFdvcmtzcGFjZUlkZW50aWZpZXIodGFyZ2V0Q29uZmlnUGF0aFVSSSk7XG5cdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnNldFByb2ZpbGVGb3JXb3Jrc3BhY2UobmV3V29ya3NwYWNlLCB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUpO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB0YXJnZXQgaXMgc2FtZSBhcyBzb3VyY2Vcblx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoY29uZmlnUGF0aFVSSSwgdGFyZ2V0Q29uZmlnUGF0aFVSSSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpc0Zyb21VbnRpdGxlZFdvcmtzcGFjZSA9IGlzVW50aXRsZWRXb3Jrc3BhY2UoY29uZmlnUGF0aFVSSSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UpO1xuXG5cdFx0Ly8gUmVhZCB0aGUgY29udGVudHMgb2YgdGhlIHdvcmtzcGFjZSBmaWxlLCB1cGRhdGUgaXQgdG8gbmV3IGxvY2F0aW9uIGFuZCBzYXZlIGl0LlxuXHRcdGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUoY29uZmlnUGF0aFVSSSk7XG5cdFx0Y29uc3QgbmV3UmF3V29ya3NwYWNlQ29udGVudHMgPSByZXdyaXRlV29ya3NwYWNlRmlsZUZvck5ld0xvY2F0aW9uKHJhdy52YWx1ZS50b1N0cmluZygpLCBjb25maWdQYXRoVVJJLCBpc0Zyb21VbnRpdGxlZFdvcmtzcGFjZSwgdGFyZ2V0Q29uZmlnUGF0aFVSSSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpKTtcblx0XHRhd2FpdCB0aGlzLnRleHRGaWxlU2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2U6IHRhcmdldENvbmZpZ1BhdGhVUkksIHZhbHVlOiBuZXdSYXdXb3Jrc3BhY2VDb250ZW50cywgb3B0aW9uczogeyBvdmVyd3JpdGU6IHRydWUgfSB9XSk7XG5cblx0XHQvLyBTZXQgdHJ1c3QgZm9yIHRoZSB3b3Jrc3BhY2UgZmlsZVxuXHRcdGF3YWl0IHRoaXMudHJ1c3RXb3Jrc3BhY2VDb25maWd1cmF0aW9uKHRhcmdldENvbmZpZ1BhdGhVUkkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHNhdmVXb3Jrc3BhY2Uod29ya3NwYWNlOiBJV29ya3NwYWNlSWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ1BhdGhVUkkgPSB3b3Jrc3BhY2UuY29uZmlnUGF0aDtcblxuXHRcdC8vIEZpcnN0OiB0cnkgdG8gc2F2ZSBhbnkgZXhpc3RpbmcgbW9kZWwgYXMgaXQgY291bGQgYmUgZGlydHlcblx0XHRjb25zdCBleGlzdGluZ01vZGVsID0gdGhpcy50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuZ2V0KGNvbmZpZ1BhdGhVUkkpO1xuXHRcdGlmIChleGlzdGluZ01vZGVsKSB7XG5cdFx0XHRhd2FpdCBleGlzdGluZ01vZGVsLnNhdmUoeyBmb3JjZTogdHJ1ZSwgcmVhc29uOiBTYXZlUmVhc29uLkVYUExJQ0lUIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFNlY29uZDogaWYgdGhlIGZpbGUgZXhpc3RzIG9uIGRpc2ssIHNpbXBseSByZXR1cm5cblx0XHRjb25zdCB3b3Jrc3BhY2VGaWxlRXhpc3RzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMoY29uZmlnUGF0aFVSSSk7XG5cdFx0aWYgKHdvcmtzcGFjZUZpbGVFeGlzdHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBGaW5hbGx5LCB3ZSBuZWVkIHRvIHJlLWNyZWF0ZSB0aGUgZmlsZSBhcyBpdCB3YXMgZGVsZXRlZFxuXHRcdGNvbnN0IG5ld1dvcmtzcGFjZTogSVN0b3JlZFdvcmtzcGFjZSA9IHsgZm9sZGVyczogW10gfTtcblx0XHRjb25zdCBuZXdSYXdXb3Jrc3BhY2VDb250ZW50cyA9IHJld3JpdGVXb3Jrc3BhY2VGaWxlRm9yTmV3TG9jYXRpb24oSlNPTi5zdHJpbmdpZnkobmV3V29ya3NwYWNlLCBudWxsLCAnXFx0JyksIGNvbmZpZ1BhdGhVUkksIGZhbHNlLCBjb25maWdQYXRoVVJJLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkpO1xuXHRcdGF3YWl0IHRoaXMudGV4dEZpbGVTZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZTogY29uZmlnUGF0aFVSSSwgdmFsdWU6IG5ld1Jhd1dvcmtzcGFjZUNvbnRlbnRzIH1dKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlV29ya3NwYWNlQ29uZmlndXJhdGlvbkVkaXRpbmdFcnJvcihlcnJvcjogSlNPTkVkaXRpbmdFcnJvcik6IHZvaWQge1xuXHRcdHN3aXRjaCAoZXJyb3IuY29kZSkge1xuXHRcdFx0Y2FzZSBKU09ORWRpdGluZ0Vycm9yQ29kZS5FUlJPUl9JTlZBTElEX0ZJTEU6XG5cdFx0XHRcdHRoaXMub25JbnZhbGlkV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGVFcnJvcigpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvci5tZXNzYWdlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uSW52YWxpZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlRXJyb3IoKTogdm9pZCB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdlcnJvckludmFsaWRUYXNrQ29uZmlndXJhdGlvbicsIFwiVW5hYmxlIHRvIHdyaXRlIGludG8gd29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gZmlsZS4gUGxlYXNlIG9wZW4gdGhlIGZpbGUgdG8gY29ycmVjdCBlcnJvcnMvd2FybmluZ3MgaW4gaXQgYW5kIHRyeSBhZ2Fpbi5cIik7XG5cdFx0dGhpcy5hc2tUb09wZW5Xb3Jrc3BhY2VDb25maWd1cmF0aW9uRmlsZShtZXNzYWdlKTtcblx0fVxuXG5cdHByaXZhdGUgYXNrVG9PcGVuV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5FcnJvciwgbWVzc2FnZSxcblx0XHRcdFt7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3BlbldvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlJywgXCJPcGVuIFdvcmtzcGFjZSBDb25maWd1cmF0aW9uXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldvcmtzcGFjZUNvbmZpZ0ZpbGUnKVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9XG5cblx0YWJzdHJhY3QgZW50ZXJXb3Jrc3BhY2Uod29ya3NwYWNlVXJpOiBVUkkpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHByb3RlY3RlZCBhc3luYyBkb0VudGVyV29ya3NwYWNlKHdvcmtzcGFjZVVyaTogVVJJKTogUHJvbWlzZTxJRW50ZXJXb3Jrc3BhY2VSZXN1bHQgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoISF0aGlzLmVudmlyb25tZW50U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0VudGVyaW5nIGEgbmV3IHdvcmtzcGFjZSBpcyBub3QgcG9zc2libGUgaW4gdGVzdHMuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgdGhpcy53b3Jrc3BhY2VzU2VydmljZS5nZXRXb3Jrc3BhY2VJZGVudGlmaWVyKHdvcmtzcGFjZVVyaSk7XG5cblx0XHQvLyBTZXR0aW5ncyBtaWdyYXRpb24gKG9ubHkgaWYgd2UgY29tZSBmcm9tIGEgZm9sZGVyIHdvcmtzcGFjZSlcblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIpIHtcblx0XHRcdGF3YWl0IHRoaXMubWlncmF0ZVdvcmtzcGFjZVNldHRpbmdzKHdvcmtzcGFjZSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbml0aWFsaXplKHdvcmtzcGFjZSk7XG5cblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VzU2VydmljZS5lbnRlcldvcmtzcGFjZSh3b3Jrc3BhY2VVcmkpO1xuXHR9XG5cblx0cHJpdmF0ZSBtaWdyYXRlV29ya3NwYWNlU2V0dGluZ3ModG9Xb3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9Db3B5V29ya3NwYWNlU2V0dGluZ3ModG9Xb3Jrc3BhY2UsIHNldHRpbmcgPT4gc2V0dGluZy5zY29wZSA9PT0gQ29uZmlndXJhdGlvblNjb3BlLldJTkRPVyk7XG5cdH1cblxuXHRjb3B5V29ya3NwYWNlU2V0dGluZ3ModG9Xb3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9Db3B5V29ya3NwYWNlU2V0dGluZ3ModG9Xb3Jrc3BhY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0NvcHlXb3Jrc3BhY2VTZXR0aW5ncyh0b1dvcmtzcGFjZTogSVdvcmtzcGFjZUlkZW50aWZpZXIsIGZpbHRlcj86IChjb25maWc6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEpID0+IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uUHJvcGVydGllcyA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKCk7XG5cdFx0Y29uc3QgdGFyZ2V0V29ya3NwYWNlQ29uZmlndXJhdGlvbjogYW55ID0ge307XG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5rZXlzKCkud29ya3NwYWNlKSB7XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvblByb3BlcnRpZXNba2V5XSkge1xuXHRcdFx0XHRpZiAoZmlsdGVyICYmICFmaWx0ZXIoY29uZmlndXJhdGlvblByb3BlcnRpZXNba2V5XSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRhcmdldFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25ba2V5XSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdChrZXkpLndvcmtzcGFjZVZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmpzb25FZGl0aW5nU2VydmljZS53cml0ZSh0b1dvcmtzcGFjZS5jb25maWdQYXRoLCBbeyBwYXRoOiBbJ3NldHRpbmdzJ10sIHZhbHVlOiB0YXJnZXRXb3Jrc3BhY2VDb25maWd1cmF0aW9uIH1dLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJ1c3RXb3Jrc3BhY2VDb25maWd1cmF0aW9uKGNvbmZpZ1BhdGhVUkk6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgIT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZICYmIHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLnNldFVyaXNUcnVzdChbY29uZmlnUGF0aFVSSV0sIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRDdXJyZW50V29ya3NwYWNlSWRlbnRpZmllcigpOiBJV29ya3NwYWNlSWRlbnRpZmllciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvV29ya3NwYWNlSWRlbnRpZmllcih0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKTtcblx0XHRpZiAoaXNXb3Jrc3BhY2VJZGVudGlmaWVyKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRyZXR1cm4gaWRlbnRpZmllcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU9BLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCLGtCQUFrQixxQkFBcUIsdUJBQXVCLDBCQUFnRCx1QkFBdUIsZ0JBQWdCLHFCQUFxQix3QkFBd0I7QUFDdE8sU0FBUyxxQkFBdUMsNEJBQTRCO0FBQzVFLFNBQXVDLG9CQUFvQiwwQ0FBbUY7QUFFOUksU0FBUyxvQkFBNEMsY0FBYywrQkFBNkQ7QUFDaEksU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxVQUFVLFNBQVMsa0JBQWtCLFVBQVUsbUNBQW1DO0FBQzNGLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLG9CQUFvQixzQkFBc0I7QUFDbkQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0JBQWtCO0FBRXBCLElBQWUsa0NBQWYsY0FBdUQsV0FBK0M7QUFBQSxFQUk1RyxZQUN1QyxvQkFDTyxnQkFDTSxzQkFDWixxQkFDTCxnQkFDSCxhQUNJLGlCQUNJLG1CQUNVLG9CQUNaLG1CQUNGLGVBQ0YsYUFDTyxvQkFDVyxpQ0FDUix5QkFDRCx3QkFDekM7QUFDRCxVQUFNO0FBakJnQztBQUNPO0FBQ007QUFDWjtBQUNMO0FBQ0g7QUFDSTtBQUNJO0FBQ1U7QUFDWjtBQUNGO0FBQ0Y7QUFDTztBQUNXO0FBQ1I7QUFDRDtBQUFBLEVBRzNDO0FBQUEsRUFFQSxNQUFNLHVCQUFpRDtBQUN0RCxVQUFNLHVCQUF1QixDQUFDLFFBQVEsSUFBSTtBQUMxQyxRQUFJLEtBQUssbUJBQW1CLGlCQUFpQjtBQUM1QywyQkFBcUIsUUFBUSxRQUFRLFlBQVk7QUFBQSxJQUNsRDtBQUNBLFFBQUksZ0JBQWdCLE1BQU0sS0FBSyxrQkFBa0IsZUFBZTtBQUFBLE1BQy9ELFdBQVcsU0FBUyxRQUFRLE1BQU07QUFBQSxNQUNsQyxPQUFPLFNBQVMsaUJBQWlCLGdCQUFnQjtBQUFBLE1BQ2pELFNBQVM7QUFBQSxNQUNULFlBQVksU0FBUyxNQUFNLEtBQUssa0JBQWtCLHFCQUFxQixHQUFHLEtBQUssb0JBQW9CLENBQUM7QUFBQSxNQUNwRztBQUFBLElBQ0QsQ0FBQztBQUVELFFBQUksQ0FBQyxlQUFlO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQywwQkFBMEIsYUFBYSxHQUFHO0FBRzlDLHNCQUFnQixjQUFjLEtBQUssRUFBRSxNQUFNLEdBQUcsY0FBYyxJQUFJLElBQUksbUJBQW1CLEdBQUcsQ0FBQztBQUFBLElBQzVGO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHNCQUE4QjtBQUdyQyxVQUFNLGdCQUFnQixLQUFLLDhCQUE4QixHQUFHO0FBQzVELFFBQUksaUJBQWlCLGlCQUFpQixlQUFlLEtBQUssa0JBQWtCLEdBQUc7QUFDOUUsYUFBTyxTQUFTLGFBQWE7QUFBQSxJQUM5QjtBQUdBLFVBQU0sU0FBUyxLQUFLLGVBQWUsYUFBYSxFQUFFLFFBQVEsR0FBRyxDQUFDO0FBQzlELFFBQUksUUFBUTtBQUNYLGFBQU8sR0FBRyxTQUFTLE9BQU8sR0FBRyxDQUFDLElBQUksbUJBQW1CO0FBQUEsSUFDdEQ7QUFHQSxXQUFPLGFBQWEsbUJBQW1CO0FBQUEsRUFDeEM7QUFBQSxFQUVBLE1BQU0sY0FBYyxPQUFlLGFBQXNCLHdCQUF5RCxrQkFBMkM7QUFDNUosVUFBTSxVQUFVLEtBQUssZUFBZSxhQUFhLEVBQUU7QUFFbkQsUUFBSSxrQkFBeUIsQ0FBQztBQUM5QixRQUFJLE9BQU8sZ0JBQWdCLFVBQVU7QUFDcEMsd0JBQWtCLFFBQVEsTUFBTSxPQUFPLFFBQVEsV0FBVyxFQUFFLElBQUksWUFBVSxPQUFPLEdBQUc7QUFBQSxJQUNyRjtBQUVBLFFBQUksZUFBK0MsQ0FBQztBQUNwRCxRQUFJLE1BQU0sUUFBUSxzQkFBc0IsR0FBRztBQUMxQyxxQkFBZSx1QkFBdUIsSUFBSSxrQkFBZ0IsRUFBRSxLQUFLLDRCQUE0QixZQUFZLEdBQUcsR0FBRyxNQUFNLFlBQVksS0FBSyxFQUFFO0FBQUEsSUFDekk7QUFFQSxVQUFNLGdCQUFnQixnQkFBZ0IsU0FBUztBQUMvQyxVQUFNLGFBQWEsYUFBYSxTQUFTO0FBRXpDLFFBQUksQ0FBQyxjQUFjLENBQUMsZUFBZTtBQUNsQztBQUFBLElBQ0Q7QUFHQSxRQUFJLGNBQWMsQ0FBQyxlQUFlO0FBQ2pDLGFBQU8sS0FBSyxhQUFhLGNBQWMsT0FBTyxnQkFBZ0I7QUFBQSxJQUMvRDtBQUdBLFFBQUksaUJBQWlCLENBQUMsWUFBWTtBQUNqQyxhQUFPLEtBQUssY0FBYyxlQUFlO0FBQUEsSUFDMUMsT0FHSztBQUtKLFVBQUksS0FBSyw4QkFBOEIsZUFBZSxHQUFHO0FBQ3hELGVBQU8sS0FBSyx3QkFBd0IsWUFBWTtBQUFBLE1BQ2pEO0FBR0EsVUFBSSxLQUFLLGVBQWUsa0JBQWtCLE1BQU0sZUFBZSxXQUFXO0FBQ3pFLGVBQU8sS0FBSyxhQUFhLGNBQWMsT0FBTyxnQkFBZ0I7QUFBQSxNQUMvRDtBQUdBLGFBQU8sS0FBSyxnQkFBZ0IsY0FBYyxpQkFBaUIsT0FBTyxnQkFBZ0I7QUFBQSxJQUNuRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsZ0JBQWdCLGNBQThDLGlCQUF3QixPQUFnQixtQkFBNEIsT0FBc0I7QUFDckssUUFBSTtBQUNILFlBQU0sS0FBSyxlQUFlLGNBQWMsY0FBYyxpQkFBaUIsS0FBSztBQUFBLElBQzdFLFNBQVMsT0FBTztBQUNmLFVBQUksa0JBQWtCO0FBQ3JCLGNBQU07QUFBQSxNQUNQO0FBRUEsV0FBSyx5Q0FBeUMsS0FBSztBQUFBLElBQ3BEO0FBQUEsRUFDRDtBQUFBLEVBRUEsV0FBVyx3QkFBd0QsbUJBQTRCLE9BQXNCO0FBR3BILFVBQU0sZUFBZSx1QkFBdUIsSUFBSSxrQkFBZ0IsRUFBRSxLQUFLLDRCQUE0QixZQUFZLEdBQUcsR0FBRyxNQUFNLFlBQVksS0FBSyxFQUFFO0FBRTlJLFdBQU8sS0FBSyxhQUFhLGNBQWMsUUFBVyxnQkFBZ0I7QUFBQSxFQUNuRTtBQUFBLEVBRUEsTUFBYyxhQUFhLGNBQThDLE9BQWdCLG1CQUE0QixPQUFzQjtBQUMxSSxVQUFNLFFBQVEsS0FBSyxlQUFlLGtCQUFrQjtBQUNwRCxVQUFNLGtCQUFrQixLQUFLLG1CQUFtQjtBQUNoRCxRQUFJLGlCQUFpQjtBQUVwQixxQkFBZSxhQUFhLE9BQU8sWUFBVSxPQUFPLElBQUksV0FBVyxRQUFRLFNBQVMsT0FBTyxJQUFJLFdBQVcsUUFBUSxnQkFBZ0IsaUJBQWlCLE9BQU8sSUFBSSxXQUFXLGVBQWUsRUFBRTtBQUFBLElBQzNMO0FBSUEsUUFBSSxVQUFVLGVBQWUsV0FBVztBQUN2QyxVQUFJLHNCQUFzQixLQUFLLGVBQWUsYUFBYSxFQUFFLFFBQVEsSUFBSSxhQUFXLEVBQUUsS0FBSyxPQUFPLElBQUksRUFBRTtBQUN4RywwQkFBb0IsT0FBTyxPQUFPLFVBQVUsV0FBVyxRQUFRLG9CQUFvQixRQUFRLEdBQUcsR0FBRyxZQUFZO0FBQzdHLDRCQUFzQixTQUFTLHFCQUFxQixZQUFVLEtBQUssbUJBQW1CLE9BQU8saUJBQWlCLE9BQU8sR0FBRyxDQUFDO0FBRXpILFVBQUksVUFBVSxlQUFlLFNBQVMsb0JBQW9CLFdBQVcsS0FBSyxVQUFVLGVBQWUsVUFBVSxvQkFBb0IsV0FBVyxHQUFHO0FBQzlJO0FBQUEsTUFDRDtBQUVBLGFBQU8sS0FBSyx3QkFBd0IsbUJBQW1CO0FBQUEsSUFDeEQ7QUFHQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLGVBQWUsV0FBVyxjQUFjLEtBQUs7QUFBQSxJQUN6RCxTQUFTLE9BQU87QUFDZixVQUFJLGtCQUFrQjtBQUNyQixjQUFNO0FBQUEsTUFDUDtBQUVBLFdBQUsseUNBQXlDLEtBQUs7QUFBQSxJQUNwRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sY0FBYyxpQkFBd0IsbUJBQTRCLE9BQXNCO0FBSTdGLFFBQUksS0FBSyw4QkFBOEIsZUFBZSxHQUFHO0FBQ3hELGFBQU8sS0FBSyx3QkFBd0IsQ0FBQyxDQUFDO0FBQUEsSUFDdkM7QUFHQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLGVBQWUsY0FBYyxlQUFlO0FBQUEsSUFDeEQsU0FBUyxPQUFPO0FBQ2YsVUFBSSxrQkFBa0I7QUFDckIsY0FBTTtBQUFBLE1BQ1A7QUFFQSxXQUFLLHlDQUF5QyxLQUFLO0FBQUEsSUFDcEQ7QUFBQSxFQUNEO0FBQUEsRUFFUSw4QkFBOEIsU0FBeUI7QUFDOUQsUUFBSSxLQUFLLGVBQWUsa0JBQWtCLE1BQU0sZUFBZSxRQUFRO0FBQ3RFLFlBQU0sa0JBQWtCLEtBQUssZUFBZSxhQUFhLEVBQUUsUUFBUSxDQUFDO0FBQ3BFLGFBQVEsUUFBUSxLQUFLLFlBQVUsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLFFBQVEsZ0JBQWdCLEdBQUcsQ0FBQztBQUFBLElBQ25HO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sd0JBQXdCLFNBQXlDLE1BQTJCO0FBQ2pHLFFBQUksUUFBUSxDQUFDLE1BQU0sS0FBSywyQkFBMkIsSUFBSSxHQUFHO0FBQ3pEO0FBQUEsSUFDRDtBQUVBLFVBQU0sa0JBQWtCLEtBQUssbUJBQW1CO0FBQ2hELFVBQU0sb0JBQW9CLE1BQU0sS0FBSyxrQkFBa0Isd0JBQXdCLFNBQVMsZUFBZTtBQUN2RyxRQUFJLE1BQU07QUFDVCxVQUFJO0FBQ0gsY0FBTSxLQUFLLGdCQUFnQixtQkFBbUIsSUFBSTtBQUFBLE1BQ25ELFVBQUU7QUFDRCxjQUFNLEtBQUssa0JBQWtCLHdCQUF3QixpQkFBaUI7QUFBQSxNQUN2RTtBQUFBLElBQ0QsT0FBTztBQUNOLGFBQU8sa0JBQWtCO0FBQ3pCLFVBQUksQ0FBQyxLQUFLLHVCQUF1QixlQUFlLFdBQVc7QUFDMUQsY0FBTSxLQUFLLHdCQUF3Qix1QkFBdUIsbUJBQW1CLEtBQUssdUJBQXVCLGNBQWM7QUFBQSxNQUN4SDtBQUFBLElBQ0Q7QUFFQSxXQUFPLEtBQUssZUFBZSxJQUFJO0FBQUEsRUFDaEM7QUFBQSxFQUVBLE1BQU0sc0JBQXNCLGNBQWtDO0FBQzdELFVBQU0sc0JBQXNCLEtBQUssOEJBQThCO0FBQy9ELFFBQUksQ0FBQyxxQkFBcUI7QUFDekI7QUFBQSxJQUNEO0FBSUEsUUFBSSxRQUFRLG9CQUFvQixZQUFZLFlBQVksR0FBRztBQUMxRCxhQUFPLEtBQUssY0FBYyxtQkFBbUI7QUFBQSxJQUM5QztBQUdBLFFBQUksQ0FBQyxNQUFNLEtBQUssMkJBQTJCLFlBQVksR0FBRztBQUN6RDtBQUFBLElBQ0Q7QUFFQSxVQUFNLEtBQUssZ0JBQWdCLHFCQUFxQixZQUFZO0FBRTVELFdBQU8sS0FBSyxlQUFlLFlBQVk7QUFBQSxFQUN4QztBQUFBLEVBRUEsTUFBTSwyQkFBMkIsY0FBcUM7QUFDckUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWdCLGdCQUFnQixXQUFpQyxxQkFBeUM7QUFDekcsVUFBTSxnQkFBZ0IsVUFBVTtBQUVoQyxVQUFNLHlCQUF5QixDQUFDLG9CQUFvQixxQkFBcUIsS0FBSyxrQkFBa0I7QUFDaEcsUUFBSSwwQkFBMEIsQ0FBQyxLQUFLLHVCQUF1QixlQUFlLFdBQVc7QUFDcEYsWUFBTSxlQUFlLE1BQU0sS0FBSyxrQkFBa0IsdUJBQXVCLG1CQUFtQjtBQUM1RixZQUFNLEtBQUssd0JBQXdCLHVCQUF1QixjQUFjLEtBQUssdUJBQXVCLGNBQWM7QUFBQSxJQUNuSDtBQUdBLFFBQUksS0FBSyxtQkFBbUIsT0FBTyxRQUFRLGVBQWUsbUJBQW1CLEdBQUc7QUFDL0U7QUFBQSxJQUNEO0FBRUEsVUFBTSwwQkFBMEIsb0JBQW9CLGVBQWUsS0FBSyxrQkFBa0I7QUFHMUYsVUFBTSxNQUFNLE1BQU0sS0FBSyxZQUFZLFNBQVMsYUFBYTtBQUN6RCxVQUFNLDBCQUEwQixtQ0FBbUMsSUFBSSxNQUFNLFNBQVMsR0FBRyxlQUFlLHlCQUF5QixxQkFBcUIsS0FBSyxtQkFBbUIsTUFBTTtBQUNwTCxVQUFNLEtBQUssZ0JBQWdCLE9BQU8sQ0FBQyxFQUFFLFVBQVUscUJBQXFCLE9BQU8seUJBQXlCLFNBQVMsRUFBRSxXQUFXLEtBQUssRUFBRSxDQUFDLENBQUM7QUFHbkksVUFBTSxLQUFLLDRCQUE0QixtQkFBbUI7QUFBQSxFQUMzRDtBQUFBLEVBRUEsTUFBZ0IsY0FBYyxXQUFnRDtBQUM3RSxVQUFNLGdCQUFnQixVQUFVO0FBR2hDLFVBQU0sZ0JBQWdCLEtBQUssZ0JBQWdCLE1BQU0sSUFBSSxhQUFhO0FBQ2xFLFFBQUksZUFBZTtBQUNsQixZQUFNLGNBQWMsS0FBSyxFQUFFLE9BQU8sTUFBTSxRQUFRLFdBQVcsU0FBUyxDQUFDO0FBQ3JFO0FBQUEsSUFDRDtBQUdBLFVBQU0sc0JBQXNCLE1BQU0sS0FBSyxZQUFZLE9BQU8sYUFBYTtBQUN2RSxRQUFJLHFCQUFxQjtBQUN4QjtBQUFBLElBQ0Q7QUFHQSxVQUFNLGVBQWlDLEVBQUUsU0FBUyxDQUFDLEVBQUU7QUFDckQsVUFBTSwwQkFBMEIsbUNBQW1DLEtBQUssVUFBVSxjQUFjLE1BQU0sR0FBSSxHQUFHLGVBQWUsT0FBTyxlQUFlLEtBQUssbUJBQW1CLE1BQU07QUFDaEwsVUFBTSxLQUFLLGdCQUFnQixPQUFPLENBQUMsRUFBRSxVQUFVLGVBQWUsT0FBTyx3QkFBd0IsQ0FBQyxDQUFDO0FBQUEsRUFDaEc7QUFBQSxFQUVRLHlDQUF5QyxPQUErQjtBQUMvRSxZQUFRLE1BQU0sTUFBTTtBQUFBLE1BQ25CLEtBQUsscUJBQXFCO0FBQ3pCLGFBQUsseUNBQXlDO0FBQzlDO0FBQUEsTUFDRDtBQUNDLGFBQUssb0JBQW9CLE1BQU0sTUFBTSxPQUFPO0FBQUEsSUFDOUM7QUFBQSxFQUNEO0FBQUEsRUFFUSwyQ0FBaUQ7QUFDeEQsVUFBTSxVQUFVLFNBQVMsaUNBQWlDLHlIQUF5SDtBQUNuTCxTQUFLLG9DQUFvQyxPQUFPO0FBQUEsRUFDakQ7QUFBQSxFQUVRLG9DQUFvQyxTQUF1QjtBQUNsRSxTQUFLLG9CQUFvQjtBQUFBLE1BQU8sU0FBUztBQUFBLE1BQU87QUFBQSxNQUMvQyxDQUFDO0FBQUEsUUFDQSxPQUFPLFNBQVMsa0NBQWtDLDhCQUE4QjtBQUFBLFFBQ2hGLEtBQUssTUFBTSxLQUFLLGVBQWUsZUFBZSwwQ0FBMEM7QUFBQSxNQUN6RixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUlBLE1BQWdCLGlCQUFpQixjQUErRDtBQUMvRixRQUFJLENBQUMsQ0FBQyxLQUFLLG1CQUFtQiwyQkFBMkI7QUFDeEQsWUFBTSxJQUFJLE1BQU0sb0RBQW9EO0FBQUEsSUFDckU7QUFFQSxVQUFNLFlBQVksTUFBTSxLQUFLLGtCQUFrQix1QkFBdUIsWUFBWTtBQUdsRixRQUFJLEtBQUssZUFBZSxrQkFBa0IsTUFBTSxlQUFlLFFBQVE7QUFDdEUsWUFBTSxLQUFLLHlCQUF5QixTQUFTO0FBQUEsSUFDOUM7QUFFQSxVQUFNLEtBQUsscUJBQXFCLFdBQVcsU0FBUztBQUVwRCxXQUFPLEtBQUssa0JBQWtCLGVBQWUsWUFBWTtBQUFBLEVBQzFEO0FBQUEsRUFFUSx5QkFBeUIsYUFBa0Q7QUFDbEYsV0FBTyxLQUFLLHdCQUF3QixhQUFhLGFBQVcsUUFBUSxVQUFVLG1CQUFtQixNQUFNO0FBQUEsRUFDeEc7QUFBQSxFQUVBLHNCQUFzQixhQUFrRDtBQUN2RSxXQUFPLEtBQUssd0JBQXdCLFdBQVc7QUFBQSxFQUNoRDtBQUFBLEVBRVEsd0JBQXdCLGFBQW1DLFFBQTJFO0FBQzdJLFVBQU0sMEJBQTBCLFNBQVMsR0FBMkIsd0JBQXdCLGFBQWEsRUFBRSwyQkFBMkI7QUFDdEksVUFBTSwrQkFBb0MsQ0FBQztBQUMzQyxlQUFXLE9BQU8sS0FBSyxxQkFBcUIsS0FBSyxFQUFFLFdBQVc7QUFDN0QsVUFBSSx3QkFBd0IsR0FBRyxHQUFHO0FBQ2pDLFlBQUksVUFBVSxDQUFDLE9BQU8sd0JBQXdCLEdBQUcsQ0FBQyxHQUFHO0FBQ3BEO0FBQUEsUUFDRDtBQUVBLHFDQUE2QixHQUFHLElBQUksS0FBSyxxQkFBcUIsUUFBUSxHQUFHLEVBQUU7QUFBQSxNQUM1RTtBQUFBLElBQ0Q7QUFFQSxXQUFPLEtBQUssbUJBQW1CLE1BQU0sWUFBWSxZQUFZLENBQUMsRUFBRSxNQUFNLENBQUMsVUFBVSxHQUFHLE9BQU8sNkJBQTZCLENBQUMsR0FBRyxJQUFJO0FBQUEsRUFDakk7QUFBQSxFQUVBLE1BQWMsNEJBQTRCLGVBQW1DO0FBQzVFLFFBQUksS0FBSyxlQUFlLGtCQUFrQixNQUFNLGVBQWUsU0FBUyxLQUFLLGdDQUFnQyxtQkFBbUIsR0FBRztBQUNsSSxZQUFNLEtBQUssZ0NBQWdDLGFBQWEsQ0FBQyxhQUFhLEdBQUcsSUFBSTtBQUFBLElBQzlFO0FBQUEsRUFDRDtBQUFBLEVBRVUsZ0NBQWtFO0FBQzNFLFVBQU0sYUFBYSxzQkFBc0IsS0FBSyxlQUFlLGFBQWEsQ0FBQztBQUMzRSxRQUFJLHNCQUFzQixVQUFVLEdBQUc7QUFDdEMsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBM1hzQixrQ0FBZjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXBCbUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
