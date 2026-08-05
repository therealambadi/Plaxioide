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
import { isWorkspaceToOpen, isFileToOpen } from "../../../../platform/window/common/window.js";
import { IDialogService, ConfirmResult, getFileNamesMessage } from "../../../../platform/dialogs/common/dialogs.js";
import { isSavedWorkspace, isTemporaryWorkspace, IWorkspaceContextService, WorkbenchState, WORKSPACE_EXTENSION } from "../../../../platform/workspace/common/workspace.js";
import { IHistoryService } from "../../history/common/history.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import * as resources from "../../../../base/common/resources.js";
import { isAbsolute as localPathIsAbsolute, normalize as localPathNormalize } from "../../../../base/common/path.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SimpleFileDialog } from "./simpleFileDialog.js";
import { IWorkspacesService } from "../../../../platform/workspaces/common/workspaces.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IHostService } from "../../host/browser/host.js";
import Severity from "../../../../base/common/severity.js";
import { coalesce, distinct } from "../../../../base/common/arrays.js";
import { trim } from "../../../../base/common/strings.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IPathService } from "../../path/common/pathService.js";
import { Schemas } from "../../../../base/common/network.js";
import { PLAINTEXT_EXTENSION } from "../../../../editor/common/languages/modesRegistry.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { EditorOpenSource } from "../../../../platform/editor/common/editor.js";
import { ILogService } from "../../../../platform/log/common/log.js";
let AbstractFileDialogService = class {
  constructor(hostService, contextService, historyService, environmentService, instantiationService, configurationService, fileService, openerService, dialogService, languageService, workspacesService, labelService, pathService, commandService, editorService, codeEditorService, logService) {
    this.hostService = hostService;
    this.contextService = contextService;
    this.historyService = historyService;
    this.environmentService = environmentService;
    this.instantiationService = instantiationService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.openerService = openerService;
    this.dialogService = dialogService;
    this.languageService = languageService;
    this.workspacesService = workspacesService;
    this.labelService = labelService;
    this.pathService = pathService;
    this.commandService = commandService;
    this.editorService = editorService;
    this.codeEditorService = codeEditorService;
    this.logService = logService;
  }
  async defaultFilePath(schemeFilter = this.getSchemeFilterForWindow(), authorityFilter = this.getAuthorityFilterForWindow()) {
    let candidate = this.historyService.getLastActiveFile(schemeFilter, authorityFilter);
    if (!candidate) {
      candidate = this.historyService.getLastActiveWorkspaceRoot(schemeFilter, authorityFilter);
    } else {
      candidate = resources.dirname(candidate);
    }
    if (!candidate) {
      candidate = await this.preferredHome(schemeFilter);
    }
    return candidate;
  }
  async defaultFolderPath(schemeFilter = this.getSchemeFilterForWindow(), authorityFilter = this.getAuthorityFilterForWindow()) {
    let candidate = this.historyService.getLastActiveWorkspaceRoot(schemeFilter, authorityFilter);
    if (!candidate) {
      candidate = this.historyService.getLastActiveFile(schemeFilter, authorityFilter);
    }
    if (!candidate) {
      return this.preferredHome(schemeFilter);
    }
    return resources.dirname(candidate);
  }
  async preferredHome(schemeFilter = this.getSchemeFilterForWindow()) {
    const preferLocal = schemeFilter === Schemas.file;
    const preferredHomeConfig = this.configurationService.inspect("files.dialog.defaultPath");
    const preferredHomeCandidate = preferLocal ? preferredHomeConfig.userLocalValue : preferredHomeConfig.userRemoteValue;
    if (preferredHomeCandidate) {
      const isPreferredHomeCandidateAbsolute = preferLocal ? localPathIsAbsolute(preferredHomeCandidate) : (await this.pathService.path).isAbsolute(preferredHomeCandidate);
      if (isPreferredHomeCandidateAbsolute) {
        const preferredHomeNormalized = preferLocal ? localPathNormalize(preferredHomeCandidate) : (await this.pathService.path).normalize(preferredHomeCandidate);
        const preferredHome = resources.toLocalResource(await this.pathService.fileURI(preferredHomeNormalized), this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
        if (await this.fileService.exists(preferredHome)) {
          return preferredHome;
        }
      }
    }
    return this.pathService.userHome({ preferLocal });
  }
  async defaultWorkspacePath(schemeFilter = this.getSchemeFilterForWindow()) {
    let defaultWorkspacePath;
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const configuration = this.contextService.getWorkspace().configuration;
      if (configuration?.scheme === schemeFilter && isSavedWorkspace(configuration, this.environmentService) && !isTemporaryWorkspace(configuration)) {
        defaultWorkspacePath = resources.dirname(configuration);
      }
    }
    if (!defaultWorkspacePath) {
      defaultWorkspacePath = await this.defaultFilePath(schemeFilter);
    }
    return defaultWorkspacePath;
  }
  async showSaveConfirm(fileNamesOrResources) {
    if (this.skipDialogs()) {
      this.logService.trace("FileDialogService: refused to show save confirmation dialog in tests.");
      return ConfirmResult.DONT_SAVE;
    }
    return this.doShowSaveConfirm(fileNamesOrResources);
  }
  skipDialogs() {
    if (this.environmentService.isExtensionDevelopment && this.environmentService.extensionTestsLocationURI) {
      return true;
    }
    return !!this.environmentService.enableSmokeTestDriver;
  }
  async doShowSaveConfirm(fileNamesOrResources) {
    if (fileNamesOrResources.length === 0) {
      return ConfirmResult.DONT_SAVE;
    }
    let message;
    let detail = nls.localize("saveChangesDetail", "Your changes will be lost if you don't save them.");
    if (fileNamesOrResources.length === 1) {
      message = nls.localize("saveChangesMessage", "Do you want to save the changes you made to {0}?", typeof fileNamesOrResources[0] === "string" ? fileNamesOrResources[0] : resources.basename(fileNamesOrResources[0]));
    } else {
      message = nls.localize("saveChangesMessages", "Do you want to save the changes to the following {0} files?", fileNamesOrResources.length);
      detail = getFileNamesMessage(fileNamesOrResources) + "\n" + detail;
    }
    const { result } = await this.dialogService.prompt({
      type: Severity.Warning,
      message,
      detail,
      buttons: [
        {
          label: fileNamesOrResources.length > 1 ? nls.localize({ key: "saveAll", comment: ["&& denotes a mnemonic"] }, "&&Save All") : nls.localize({ key: "save", comment: ["&& denotes a mnemonic"] }, "&&Save"),
          run: () => ConfirmResult.SAVE
        },
        {
          label: nls.localize({ key: "dontSave", comment: ["&& denotes a mnemonic"] }, "Do&&n't Save"),
          run: () => ConfirmResult.DONT_SAVE
        }
      ],
      cancelButton: {
        run: () => ConfirmResult.CANCEL
      }
    });
    return result;
  }
  addFileSchemaIfNeeded(schema, _isFolder) {
    return schema === Schemas.untitled ? [Schemas.file] : schema !== Schemas.file ? [schema, Schemas.file] : [schema];
  }
  async pickFileFolderAndOpenSimplified(schema, options, preferNewWindow) {
    const title = nls.localize("openFileOrFolder.title", "Open File or Folder");
    const availableFileSystems = this.addFileSchemaIfNeeded(schema);
    const uri = await this.pickResource({ canSelectFiles: true, canSelectFolders: true, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
    if (uri) {
      const stat = await this.fileService.stat(uri);
      const toOpen = stat.isDirectory ? { folderUri: uri } : { fileUri: uri };
      if (!isWorkspaceToOpen(toOpen) && isFileToOpen(toOpen)) {
        this.addFileToRecentlyOpened(toOpen.fileUri);
      }
      if (stat.isDirectory || options.forceNewWindow || preferNewWindow) {
        await this.hostService.openWindow([toOpen], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
      } else {
        await this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], void 0, { validateTrust: true });
      }
    }
  }
  async pickFileAndOpenSimplified(schema, options, preferNewWindow) {
    const title = nls.localize("openFile.title", "Open File");
    const availableFileSystems = this.addFileSchemaIfNeeded(schema);
    const uri = await this.pickResource({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
    if (uri) {
      this.addFileToRecentlyOpened(uri);
      if (options.forceNewWindow || preferNewWindow) {
        await this.hostService.openWindow([{ fileUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
      } else {
        await this.editorService.openEditors([{ resource: uri, options: { source: EditorOpenSource.USER, pinned: true } }], void 0, { validateTrust: true });
      }
    }
  }
  addFileToRecentlyOpened(uri) {
    this.workspacesService.addRecentlyOpened([{ fileUri: uri, label: this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true }) }]);
  }
  async pickFolderAndOpenSimplified(schema, options) {
    const title = nls.localize("openFolder.title", "Open Folder");
    const availableFileSystems = this.addFileSchemaIfNeeded(schema, true);
    const uri = await this.pickResource({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, defaultUri: options.defaultUri, title, availableFileSystems });
    if (uri) {
      return this.hostService.openWindow([{ folderUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
    }
  }
  async pickWorkspaceAndOpenSimplified(schema, options) {
    const title = nls.localize("openWorkspace.title", "Open Workspace from File");
    const filters = [{ name: nls.localize("filterName.workspace", "Workspace"), extensions: [WORKSPACE_EXTENSION] }];
    const availableFileSystems = this.addFileSchemaIfNeeded(schema, true);
    const uri = await this.pickResource({ canSelectFiles: true, canSelectFolders: false, canSelectMany: false, defaultUri: options.defaultUri, title, filters, availableFileSystems });
    if (uri) {
      return this.hostService.openWindow([{ workspaceUri: uri }], { forceNewWindow: options.forceNewWindow, remoteAuthority: options.remoteAuthority });
    }
  }
  async pickFileToSaveSimplified(schema, options) {
    if (!options.availableFileSystems) {
      options.availableFileSystems = this.addFileSchemaIfNeeded(schema);
    }
    options.title = nls.localize("saveFileAs.title", "Save As");
    const uri = await this.saveRemoteResource(options);
    if (uri) {
      this.addFileToRecentlyOpened(uri);
    }
    return uri;
  }
  async showSaveDialogSimplified(schema, options) {
    if (!options.availableFileSystems) {
      options.availableFileSystems = this.addFileSchemaIfNeeded(schema);
    }
    return this.saveRemoteResource(options);
  }
  async showOpenDialogSimplified(schema, options) {
    if (!options.availableFileSystems) {
      options.availableFileSystems = this.addFileSchemaIfNeeded(schema, options.canSelectFolders);
    }
    const uri = await this.pickResource(options);
    return uri ? [uri] : void 0;
  }
  getSimpleFileDialog() {
    return this.instantiationService.createInstance(SimpleFileDialog);
  }
  pickResource(options) {
    return this.getSimpleFileDialog().showOpenDialog(options);
  }
  saveRemoteResource(options) {
    return this.getSimpleFileDialog().showSaveDialog(options);
  }
  getSchemeFilterForWindow(defaultUriScheme) {
    return defaultUriScheme ?? this.pathService.defaultUriScheme;
  }
  getAuthorityFilterForWindow() {
    return this.environmentService.remoteAuthority;
  }
  getFileSystemSchema(options) {
    return options.availableFileSystems && options.availableFileSystems[0] || this.getSchemeFilterForWindow(options.defaultUri?.scheme);
  }
  getWorkspaceAvailableFileSystems(options) {
    if (options.availableFileSystems && options.availableFileSystems.length > 0) {
      return options.availableFileSystems;
    }
    const availableFileSystems = [Schemas.file];
    if (this.environmentService.remoteAuthority) {
      availableFileSystems.unshift(Schemas.vscodeRemote);
    }
    return availableFileSystems;
  }
  getPickFileToSaveDialogOptions(defaultUri, availableFileSystems) {
    const options = {
      defaultUri,
      title: nls.localize("saveAsTitle", "Save As"),
      availableFileSystems
    };
    const ext = defaultUri ? resources.extname(defaultUri) : void 0;
    let matchingFilter;
    const registeredLanguageNames = this.languageService.getSortedRegisteredLanguageNames();
    const registeredLanguageFilters = coalesce(registeredLanguageNames.map(({ languageName, languageId }) => {
      const extensions = this.languageService.getExtensions(languageId);
      if (!extensions.length) {
        return null;
      }
      const filter = { name: languageName, extensions: distinct(extensions).slice(0, 10).map((e) => trim(e, ".")) };
      const extOrPlaintext = ext || PLAINTEXT_EXTENSION;
      if (!matchingFilter && extensions.includes(extOrPlaintext)) {
        matchingFilter = filter;
        const trimmedExt = trim(extOrPlaintext, ".");
        if (!filter.extensions.includes(trimmedExt)) {
          filter.extensions.unshift(trimmedExt);
        }
        return null;
      }
      return filter;
    }));
    if (!matchingFilter && ext) {
      matchingFilter = { name: trim(ext, ".").toUpperCase(), extensions: [trim(ext, ".")] };
    }
    options.filters = coalesce([
      { name: nls.localize("allFiles", "All Files"), extensions: ["*"] },
      matchingFilter,
      ...registeredLanguageFilters,
      { name: nls.localize("noExt", "No Extension"), extensions: [""] }
    ]);
    return options;
  }
};
AbstractFileDialogService = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IHistoryService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, ILanguageService),
  __decorateParam(10, IWorkspacesService),
  __decorateParam(11, ILabelService),
  __decorateParam(12, IPathService),
  __decorateParam(13, ICommandService),
  __decorateParam(14, IEditorService),
  __decorateParam(15, ICodeEditorService),
  __decorateParam(16, ILogService)
], AbstractFileDialogService);
export {
  AbstractFileDialogService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZGlhbG9ncy9icm93c2VyL2Fic3RyYWN0RmlsZURpYWxvZ1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXaW5kb3dPcGVuYWJsZSwgaXNXb3Jrc3BhY2VUb09wZW4sIGlzRmlsZVRvT3BlbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dpbmRvdy9jb21tb24vd2luZG93LmpzJztcbmltcG9ydCB7IElQaWNrQW5kT3Blbk9wdGlvbnMsIElTYXZlRGlhbG9nT3B0aW9ucywgSU9wZW5EaWFsb2dPcHRpb25zLCBGaWxlRmlsdGVyLCBJRmlsZURpYWxvZ1NlcnZpY2UsIElEaWFsb2dTZXJ2aWNlLCBDb25maXJtUmVzdWx0LCBnZXRGaWxlTmFtZXNNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBpc1NhdmVkV29ya3NwYWNlLCBpc1RlbXBvcmFyeVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSwgV09SS1NQQUNFX0VYVEVOU0lPTiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uL2hpc3RvcnkvY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNBYnNvbHV0ZSBhcyBsb2NhbFBhdGhJc0Fic29sdXRlLCBub3JtYWxpemUgYXMgbG9jYWxQYXRoTm9ybWFsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU2ltcGxlRmlsZURpYWxvZywgU2ltcGxlRmlsZURpYWxvZyB9IGZyb20gJy4vc2ltcGxlRmlsZURpYWxvZy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IGNvYWxlc2NlLCBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyB0cmltIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfRVhURU5TSU9OIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3BlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RGaWxlRGlhbG9nU2VydmljZSBpbXBsZW1lbnRzIElGaWxlRGlhbG9nU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElIb3N0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJSGlzdG9yeVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGhpc3RvcnlTZXJ2aWNlOiBJSGlzdG9yeVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZXNTZXJ2aWNlOiBJV29ya3NwYWNlc1NlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7IH1cblxuXHRhc3luYyBkZWZhdWx0RmlsZVBhdGgoc2NoZW1lRmlsdGVyID0gdGhpcy5nZXRTY2hlbWVGaWx0ZXJGb3JXaW5kb3coKSwgYXV0aG9yaXR5RmlsdGVyID0gdGhpcy5nZXRBdXRob3JpdHlGaWx0ZXJGb3JXaW5kb3coKSk6IFByb21pc2U8VVJJPiB7XG5cblx0XHQvLyBDaGVjayBmb3IgbGFzdCBhY3RpdmUgZmlsZSBmaXJzdC4uLlxuXHRcdGxldCBjYW5kaWRhdGUgPSB0aGlzLmhpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVGaWxlKHNjaGVtZUZpbHRlciwgYXV0aG9yaXR5RmlsdGVyKTtcblxuXHRcdC8vIC4uLnRoZW4gZm9yIGxhc3QgYWN0aXZlIGZpbGUgcm9vdFxuXHRcdGlmICghY2FuZGlkYXRlKSB7XG5cdFx0XHRjYW5kaWRhdGUgPSB0aGlzLmhpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KHNjaGVtZUZpbHRlciwgYXV0aG9yaXR5RmlsdGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2FuZGlkYXRlID0gcmVzb3VyY2VzLmRpcm5hbWUoY2FuZGlkYXRlKTtcblx0XHR9XG5cblx0XHRpZiAoIWNhbmRpZGF0ZSkge1xuXHRcdFx0Y2FuZGlkYXRlID0gYXdhaXQgdGhpcy5wcmVmZXJyZWRIb21lKHNjaGVtZUZpbHRlcik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNhbmRpZGF0ZTtcblx0fVxuXG5cdGFzeW5jIGRlZmF1bHRGb2xkZXJQYXRoKHNjaGVtZUZpbHRlciA9IHRoaXMuZ2V0U2NoZW1lRmlsdGVyRm9yV2luZG93KCksIGF1dGhvcml0eUZpbHRlciA9IHRoaXMuZ2V0QXV0aG9yaXR5RmlsdGVyRm9yV2luZG93KCkpOiBQcm9taXNlPFVSST4ge1xuXG5cdFx0Ly8gQ2hlY2sgZm9yIGxhc3QgYWN0aXZlIGZpbGUgcm9vdCBmaXJzdC4uLlxuXHRcdGxldCBjYW5kaWRhdGUgPSB0aGlzLmhpc3RvcnlTZXJ2aWNlLmdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KHNjaGVtZUZpbHRlciwgYXV0aG9yaXR5RmlsdGVyKTtcblxuXHRcdC8vIC4uLnRoZW4gZm9yIGxhc3QgYWN0aXZlIGZpbGVcblx0XHRpZiAoIWNhbmRpZGF0ZSkge1xuXHRcdFx0Y2FuZGlkYXRlID0gdGhpcy5oaXN0b3J5U2VydmljZS5nZXRMYXN0QWN0aXZlRmlsZShzY2hlbWVGaWx0ZXIsIGF1dGhvcml0eUZpbHRlcik7XG5cdFx0fVxuXG5cdFx0aWYgKCFjYW5kaWRhdGUpIHtcblx0XHRcdHJldHVybiB0aGlzLnByZWZlcnJlZEhvbWUoc2NoZW1lRmlsdGVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzb3VyY2VzLmRpcm5hbWUoY2FuZGlkYXRlKTtcblx0fVxuXG5cdGFzeW5jIHByZWZlcnJlZEhvbWUoc2NoZW1lRmlsdGVyID0gdGhpcy5nZXRTY2hlbWVGaWx0ZXJGb3JXaW5kb3coKSk6IFByb21pc2U8VVJJPiB7XG5cdFx0Y29uc3QgcHJlZmVyTG9jYWwgPSBzY2hlbWVGaWx0ZXIgPT09IFNjaGVtYXMuZmlsZTtcblx0XHRjb25zdCBwcmVmZXJyZWRIb21lQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PHN0cmluZz4oJ2ZpbGVzLmRpYWxvZy5kZWZhdWx0UGF0aCcpO1xuXHRcdGNvbnN0IHByZWZlcnJlZEhvbWVDYW5kaWRhdGUgPSBwcmVmZXJMb2NhbCA/IHByZWZlcnJlZEhvbWVDb25maWcudXNlckxvY2FsVmFsdWUgOiBwcmVmZXJyZWRIb21lQ29uZmlnLnVzZXJSZW1vdGVWYWx1ZTtcblx0XHRpZiAocHJlZmVycmVkSG9tZUNhbmRpZGF0ZSkge1xuXHRcdFx0Y29uc3QgaXNQcmVmZXJyZWRIb21lQ2FuZGlkYXRlQWJzb2x1dGUgPSBwcmVmZXJMb2NhbCA/IGxvY2FsUGF0aElzQWJzb2x1dGUocHJlZmVycmVkSG9tZUNhbmRpZGF0ZSkgOiAoYXdhaXQgdGhpcy5wYXRoU2VydmljZS5wYXRoKS5pc0Fic29sdXRlKHByZWZlcnJlZEhvbWVDYW5kaWRhdGUpO1xuXHRcdFx0aWYgKGlzUHJlZmVycmVkSG9tZUNhbmRpZGF0ZUFic29sdXRlKSB7XG5cdFx0XHRcdGNvbnN0IHByZWZlcnJlZEhvbWVOb3JtYWxpemVkID0gcHJlZmVyTG9jYWwgPyBsb2NhbFBhdGhOb3JtYWxpemUocHJlZmVycmVkSG9tZUNhbmRpZGF0ZSkgOiAoYXdhaXQgdGhpcy5wYXRoU2VydmljZS5wYXRoKS5ub3JtYWxpemUocHJlZmVycmVkSG9tZUNhbmRpZGF0ZSk7XG5cdFx0XHRcdGNvbnN0IHByZWZlcnJlZEhvbWUgPSByZXNvdXJjZXMudG9Mb2NhbFJlc291cmNlKGF3YWl0IHRoaXMucGF0aFNlcnZpY2UuZmlsZVVSSShwcmVmZXJyZWRIb21lTm9ybWFsaXplZCksIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSwgdGhpcy5wYXRoU2VydmljZS5kZWZhdWx0VXJpU2NoZW1lKTtcblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKHByZWZlcnJlZEhvbWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByZWZlcnJlZEhvbWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSh7IHByZWZlckxvY2FsIH0pO1xuXHR9XG5cblx0YXN5bmMgZGVmYXVsdFdvcmtzcGFjZVBhdGgoc2NoZW1lRmlsdGVyID0gdGhpcy5nZXRTY2hlbWVGaWx0ZXJGb3JXaW5kb3coKSk6IFByb21pc2U8VVJJPiB7XG5cdFx0bGV0IGRlZmF1bHRXb3Jrc3BhY2VQYXRoOiBVUkkgfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBDaGVjayBmb3IgY3VycmVudCB3b3Jrc3BhY2UgY29uZmlnIGZpbGUgZmlyc3QuLi5cblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmNvbmZpZ3VyYXRpb247XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvbj8uc2NoZW1lID09PSBzY2hlbWVGaWx0ZXIgJiYgaXNTYXZlZFdvcmtzcGFjZShjb25maWd1cmF0aW9uLCB0aGlzLmVudmlyb25tZW50U2VydmljZSkgJiYgIWlzVGVtcG9yYXJ5V29ya3NwYWNlKGNvbmZpZ3VyYXRpb24pKSB7XG5cdFx0XHRcdGRlZmF1bHRXb3Jrc3BhY2VQYXRoID0gcmVzb3VyY2VzLmRpcm5hbWUoY29uZmlndXJhdGlvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gLi4udGhlbiBmYWxsYmFjayB0byBkZWZhdWx0IGZpbGUgcGF0aFxuXHRcdGlmICghZGVmYXVsdFdvcmtzcGFjZVBhdGgpIHtcblx0XHRcdGRlZmF1bHRXb3Jrc3BhY2VQYXRoID0gYXdhaXQgdGhpcy5kZWZhdWx0RmlsZVBhdGgoc2NoZW1lRmlsdGVyKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGVmYXVsdFdvcmtzcGFjZVBhdGg7XG5cdH1cblxuXHRhc3luYyBzaG93U2F2ZUNvbmZpcm0oZmlsZU5hbWVzT3JSZXNvdXJjZXM6IChzdHJpbmcgfCBVUkkpW10pOiBQcm9taXNlPENvbmZpcm1SZXN1bHQ+IHtcblx0XHRpZiAodGhpcy5za2lwRGlhbG9ncygpKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0ZpbGVEaWFsb2dTZXJ2aWNlOiByZWZ1c2VkIHRvIHNob3cgc2F2ZSBjb25maXJtYXRpb24gZGlhbG9nIGluIHRlc3RzLicpO1xuXG5cdFx0XHQvLyBubyB2ZXRvIHdoZW4gd2UgYXJlIGluIGV4dGVuc2lvbiBkZXYgdGVzdGluZyBtb2RlIGJlY2F1c2Ugd2UgY2Fubm90IGFzc3VtZSB3ZSBydW4gaW50ZXJhY3RpdmVcblx0XHRcdHJldHVybiBDb25maXJtUmVzdWx0LkRPTlRfU0FWRTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kb1Nob3dTYXZlQ29uZmlybShmaWxlTmFtZXNPclJlc291cmNlcyk7XG5cdH1cblxuXHRwcml2YXRlIHNraXBEaWFsb2dzKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0V4dGVuc2lvbkRldmVsb3BtZW50ICYmIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkpIHtcblx0XHRcdHJldHVybiB0cnVlOyAvLyBpbnRlZ3JhdGlvbiB0ZXN0c1xuXHRcdH1cblxuXHRcdHJldHVybiAhIXRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmVuYWJsZVNtb2tlVGVzdERyaXZlcjsgLy8gc21va2UgdGVzdHNcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TaG93U2F2ZUNvbmZpcm0oZmlsZU5hbWVzT3JSZXNvdXJjZXM6IChzdHJpbmcgfCBVUkkpW10pOiBQcm9taXNlPENvbmZpcm1SZXN1bHQ+IHtcblx0XHRpZiAoZmlsZU5hbWVzT3JSZXNvdXJjZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gQ29uZmlybVJlc3VsdC5ET05UX1NBVkU7XG5cdFx0fVxuXG5cdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblx0XHRsZXQgZGV0YWlsID0gbmxzLmxvY2FsaXplKCdzYXZlQ2hhbmdlc0RldGFpbCcsIFwiWW91ciBjaGFuZ2VzIHdpbGwgYmUgbG9zdCBpZiB5b3UgZG9uJ3Qgc2F2ZSB0aGVtLlwiKTtcblx0XHRpZiAoZmlsZU5hbWVzT3JSZXNvdXJjZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdzYXZlQ2hhbmdlc01lc3NhZ2UnLCBcIkRvIHlvdSB3YW50IHRvIHNhdmUgdGhlIGNoYW5nZXMgeW91IG1hZGUgdG8gezB9P1wiLCB0eXBlb2YgZmlsZU5hbWVzT3JSZXNvdXJjZXNbMF0gPT09ICdzdHJpbmcnID8gZmlsZU5hbWVzT3JSZXNvdXJjZXNbMF0gOiByZXNvdXJjZXMuYmFzZW5hbWUoZmlsZU5hbWVzT3JSZXNvdXJjZXNbMF0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnc2F2ZUNoYW5nZXNNZXNzYWdlcycsIFwiRG8geW91IHdhbnQgdG8gc2F2ZSB0aGUgY2hhbmdlcyB0byB0aGUgZm9sbG93aW5nIHswfSBmaWxlcz9cIiwgZmlsZU5hbWVzT3JSZXNvdXJjZXMubGVuZ3RoKTtcblx0XHRcdGRldGFpbCA9IGdldEZpbGVOYW1lc01lc3NhZ2UoZmlsZU5hbWVzT3JSZXNvdXJjZXMpICsgJ1xcbicgKyBkZXRhaWw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQ8Q29uZmlybVJlc3VsdD4oe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRkZXRhaWwsXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogZmlsZU5hbWVzT3JSZXNvdXJjZXMubGVuZ3RoID4gMSA/XG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoeyBrZXk6ICdzYXZlQWxsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2F2ZSBBbGxcIikgOlxuXHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKHsga2V5OiAnc2F2ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlNhdmVcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBDb25maXJtUmVzdWx0LlNBVkVcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoeyBrZXk6ICdkb250U2F2ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJEbyYmbid0IFNhdmVcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBDb25maXJtUmVzdWx0LkRPTlRfU0FWRVxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0Y2FuY2VsQnV0dG9uOiB7XG5cdFx0XHRcdHJ1bjogKCkgPT4gQ29uZmlybVJlc3VsdC5DQU5DRUxcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWRkRmlsZVNjaGVtYUlmTmVlZGVkKHNjaGVtYTogc3RyaW5nLCBfaXNGb2xkZXI/OiBib29sZWFuKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiBzY2hlbWEgPT09IFNjaGVtYXMudW50aXRsZWQgPyBbU2NoZW1hcy5maWxlXSA6IChzY2hlbWEgIT09IFNjaGVtYXMuZmlsZSA/IFtzY2hlbWEsIFNjaGVtYXMuZmlsZV0gOiBbc2NoZW1hXSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcGlja0ZpbGVGb2xkZXJBbmRPcGVuU2ltcGxpZmllZChzY2hlbWE6IHN0cmluZywgb3B0aW9uczogSVBpY2tBbmRPcGVuT3B0aW9ucywgcHJlZmVyTmV3V2luZG93OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGl0bGUgPSBubHMubG9jYWxpemUoJ29wZW5GaWxlT3JGb2xkZXIudGl0bGUnLCAnT3BlbiBGaWxlIG9yIEZvbGRlcicpO1xuXHRcdGNvbnN0IGF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hKTtcblxuXHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMucGlja1Jlc291cmNlKHsgY2FuU2VsZWN0RmlsZXM6IHRydWUsIGNhblNlbGVjdEZvbGRlcnM6IHRydWUsIGNhblNlbGVjdE1hbnk6IGZhbHNlLCBkZWZhdWx0VXJpOiBvcHRpb25zLmRlZmF1bHRVcmksIHRpdGxlLCBhdmFpbGFibGVGaWxlU3lzdGVtcyB9KTtcblxuXHRcdGlmICh1cmkpIHtcblx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQodXJpKTtcblxuXHRcdFx0Y29uc3QgdG9PcGVuOiBJV2luZG93T3BlbmFibGUgPSBzdGF0LmlzRGlyZWN0b3J5ID8geyBmb2xkZXJVcmk6IHVyaSB9IDogeyBmaWxlVXJpOiB1cmkgfTtcblx0XHRcdGlmICghaXNXb3Jrc3BhY2VUb09wZW4odG9PcGVuKSAmJiBpc0ZpbGVUb09wZW4odG9PcGVuKSkge1xuXHRcdFx0XHR0aGlzLmFkZEZpbGVUb1JlY2VudGx5T3BlbmVkKHRvT3Blbi5maWxlVXJpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkgfHwgb3B0aW9ucy5mb3JjZU5ld1dpbmRvdyB8fCBwcmVmZXJOZXdXaW5kb3cpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KFt0b09wZW5dLCB7IGZvcmNlTmV3V2luZG93OiBvcHRpb25zLmZvcmNlTmV3V2luZG93LCByZW1vdGVBdXRob3JpdHk6IG9wdGlvbnMucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IHJlc291cmNlOiB1cmksIG9wdGlvbnM6IHsgc291cmNlOiBFZGl0b3JPcGVuU291cmNlLlVTRVIsIHBpbm5lZDogdHJ1ZSB9IH1dLCB1bmRlZmluZWQsIHsgdmFsaWRhdGVUcnVzdDogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcGlja0ZpbGVBbmRPcGVuU2ltcGxpZmllZChzY2hlbWE6IHN0cmluZywgb3B0aW9uczogSVBpY2tBbmRPcGVuT3B0aW9ucywgcHJlZmVyTmV3V2luZG93OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGl0bGUgPSBubHMubG9jYWxpemUoJ29wZW5GaWxlLnRpdGxlJywgJ09wZW4gRmlsZScpO1xuXHRcdGNvbnN0IGF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hKTtcblxuXHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMucGlja1Jlc291cmNlKHsgY2FuU2VsZWN0RmlsZXM6IHRydWUsIGNhblNlbGVjdEZvbGRlcnM6IGZhbHNlLCBjYW5TZWxlY3RNYW55OiBmYWxzZSwgZGVmYXVsdFVyaTogb3B0aW9ucy5kZWZhdWx0VXJpLCB0aXRsZSwgYXZhaWxhYmxlRmlsZVN5c3RlbXMgfSk7XG5cdFx0aWYgKHVyaSkge1xuXHRcdFx0dGhpcy5hZGRGaWxlVG9SZWNlbnRseU9wZW5lZCh1cmkpO1xuXG5cdFx0XHRpZiAob3B0aW9ucy5mb3JjZU5ld1dpbmRvdyB8fCBwcmVmZXJOZXdXaW5kb3cpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KFt7IGZpbGVVcmk6IHVyaSB9XSwgeyBmb3JjZU5ld1dpbmRvdzogb3B0aW9ucy5mb3JjZU5ld1dpbmRvdywgcmVtb3RlQXV0aG9yaXR5OiBvcHRpb25zLnJlbW90ZUF1dGhvcml0eSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhbeyByZXNvdXJjZTogdXJpLCBvcHRpb25zOiB7IHNvdXJjZTogRWRpdG9yT3BlblNvdXJjZS5VU0VSLCBwaW5uZWQ6IHRydWUgfSB9XSwgdW5kZWZpbmVkLCB7IHZhbGlkYXRlVHJ1c3Q6IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFkZEZpbGVUb1JlY2VudGx5T3BlbmVkKHVyaTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy53b3Jrc3BhY2VzU2VydmljZS5hZGRSZWNlbnRseU9wZW5lZChbeyBmaWxlVXJpOiB1cmksIGxhYmVsOiB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmksIHsgYXBwZW5kV29ya3NwYWNlU3VmZml4OiB0cnVlIH0pIH1dKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBwaWNrRm9sZGVyQW5kT3BlblNpbXBsaWZpZWQoc2NoZW1hOiBzdHJpbmcsIG9wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0aXRsZSA9IG5scy5sb2NhbGl6ZSgnb3BlbkZvbGRlci50aXRsZScsICdPcGVuIEZvbGRlcicpO1xuXHRcdGNvbnN0IGF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hLCB0cnVlKTtcblxuXHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMucGlja1Jlc291cmNlKHsgY2FuU2VsZWN0RmlsZXM6IGZhbHNlLCBjYW5TZWxlY3RGb2xkZXJzOiB0cnVlLCBjYW5TZWxlY3RNYW55OiBmYWxzZSwgZGVmYXVsdFVyaTogb3B0aW9ucy5kZWZhdWx0VXJpLCB0aXRsZSwgYXZhaWxhYmxlRmlsZVN5c3RlbXMgfSk7XG5cdFx0aWYgKHVyaSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyBmb2xkZXJVcmk6IHVyaSB9XSwgeyBmb3JjZU5ld1dpbmRvdzogb3B0aW9ucy5mb3JjZU5ld1dpbmRvdywgcmVtb3RlQXV0aG9yaXR5OiBvcHRpb25zLnJlbW90ZUF1dGhvcml0eSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcGlja1dvcmtzcGFjZUFuZE9wZW5TaW1wbGlmaWVkKHNjaGVtYTogc3RyaW5nLCBvcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGl0bGUgPSBubHMubG9jYWxpemUoJ29wZW5Xb3Jrc3BhY2UudGl0bGUnLCAnT3BlbiBXb3Jrc3BhY2UgZnJvbSBGaWxlJyk7XG5cdFx0Y29uc3QgZmlsdGVyczogRmlsZUZpbHRlcltdID0gW3sgbmFtZTogbmxzLmxvY2FsaXplKCdmaWx0ZXJOYW1lLndvcmtzcGFjZScsICdXb3Jrc3BhY2UnKSwgZXh0ZW5zaW9uczogW1dPUktTUEFDRV9FWFRFTlNJT05dIH1dO1xuXHRcdGNvbnN0IGF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hLCB0cnVlKTtcblxuXHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMucGlja1Jlc291cmNlKHsgY2FuU2VsZWN0RmlsZXM6IHRydWUsIGNhblNlbGVjdEZvbGRlcnM6IGZhbHNlLCBjYW5TZWxlY3RNYW55OiBmYWxzZSwgZGVmYXVsdFVyaTogb3B0aW9ucy5kZWZhdWx0VXJpLCB0aXRsZSwgZmlsdGVycywgYXZhaWxhYmxlRmlsZVN5c3RlbXMgfSk7XG5cdFx0aWYgKHVyaSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyB3b3Jrc3BhY2VVcmk6IHVyaSB9XSwgeyBmb3JjZU5ld1dpbmRvdzogb3B0aW9ucy5mb3JjZU5ld1dpbmRvdywgcmVtb3RlQXV0aG9yaXR5OiBvcHRpb25zLnJlbW90ZUF1dGhvcml0eSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcGlja0ZpbGVUb1NhdmVTaW1wbGlmaWVkKHNjaGVtYTogc3RyaW5nLCBvcHRpb25zOiBJU2F2ZURpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghb3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcykge1xuXHRcdFx0b3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcyA9IHRoaXMuYWRkRmlsZVNjaGVtYUlmTmVlZGVkKHNjaGVtYSk7XG5cdFx0fVxuXG5cdFx0b3B0aW9ucy50aXRsZSA9IG5scy5sb2NhbGl6ZSgnc2F2ZUZpbGVBcy50aXRsZScsICdTYXZlIEFzJyk7XG5cdFx0Y29uc3QgdXJpID0gYXdhaXQgdGhpcy5zYXZlUmVtb3RlUmVzb3VyY2Uob3B0aW9ucyk7XG5cblx0XHRpZiAodXJpKSB7XG5cdFx0XHR0aGlzLmFkZEZpbGVUb1JlY2VudGx5T3BlbmVkKHVyaSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVyaTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBzaG93U2F2ZURpYWxvZ1NpbXBsaWZpZWQoc2NoZW1hOiBzdHJpbmcsIG9wdGlvbnM6IElTYXZlRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zKSB7XG5cdFx0XHRvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zYXZlUmVtb3RlUmVzb3VyY2Uob3B0aW9ucyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgc2hvd09wZW5EaWFsb2dTaW1wbGlmaWVkKHNjaGVtYTogc3RyaW5nLCBvcHRpb25zOiBJT3BlbkRpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zKSB7XG5cdFx0XHRvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5hZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hLCBvcHRpb25zLmNhblNlbGVjdEZvbGRlcnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMucGlja1Jlc291cmNlKG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIHVyaSA/IFt1cmldIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldFNpbXBsZUZpbGVEaWFsb2coKTogSVNpbXBsZUZpbGVEaWFsb2cge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpbXBsZUZpbGVEaWFsb2cpO1xuXHR9XG5cblx0cHJpdmF0ZSBwaWNrUmVzb3VyY2Uob3B0aW9uczogSU9wZW5EaWFsb2dPcHRpb25zKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTaW1wbGVGaWxlRGlhbG9nKCkuc2hvd09wZW5EaWFsb2cob3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIHNhdmVSZW1vdGVSZXNvdXJjZShvcHRpb25zOiBJU2F2ZURpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldFNpbXBsZUZpbGVEaWFsb2coKS5zaG93U2F2ZURpYWxvZyhvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2NoZW1lRmlsdGVyRm9yV2luZG93KGRlZmF1bHRVcmlTY2hlbWU/OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBkZWZhdWx0VXJpU2NoZW1lID8/IHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QXV0aG9yaXR5RmlsdGVyRm9yV2luZG93KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRGaWxlU3lzdGVtU2NoZW1hKG9wdGlvbnM6IHsgYXZhaWxhYmxlRmlsZVN5c3RlbXM/OiByZWFkb25seSBzdHJpbmdbXTsgZGVmYXVsdFVyaT86IFVSSSB9KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gb3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcyAmJiBvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zWzBdIHx8IHRoaXMuZ2V0U2NoZW1lRmlsdGVyRm9yV2luZG93KG9wdGlvbnMuZGVmYXVsdFVyaT8uc2NoZW1lKTtcblx0fVxuXG5cdGFic3RyYWN0IHBpY2tGaWxlRm9sZGVyQW5kT3BlbihvcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcblx0YWJzdHJhY3QgcGlja0ZpbGVBbmRPcGVuKG9wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXHRhYnN0cmFjdCBwaWNrRm9sZGVyQW5kT3BlbihvcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcblx0YWJzdHJhY3QgcGlja1dvcmtzcGFjZUFuZE9wZW4ob3B0aW9uczogSVBpY2tBbmRPcGVuT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdHByb3RlY3RlZCBnZXRXb3Jrc3BhY2VBdmFpbGFibGVGaWxlU3lzdGVtcyhvcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogc3RyaW5nW10ge1xuXHRcdGlmIChvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zICYmIChvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zLmxlbmd0aCA+IDApKSB7XG5cdFx0XHRyZXR1cm4gb3B0aW9ucy5hdmFpbGFibGVGaWxlU3lzdGVtcztcblx0XHR9XG5cdFx0Y29uc3QgYXZhaWxhYmxlRmlsZVN5c3RlbXMgPSBbU2NoZW1hcy5maWxlXTtcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRhdmFpbGFibGVGaWxlU3lzdGVtcy51bnNoaWZ0KFNjaGVtYXMudnNjb2RlUmVtb3RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGF2YWlsYWJsZUZpbGVTeXN0ZW1zO1xuXHR9XG5cdGFic3RyYWN0IHNob3dTYXZlRGlhbG9nKG9wdGlvbnM6IElTYXZlRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPjtcblx0YWJzdHJhY3Qgc2hvd09wZW5EaWFsb2cob3B0aW9uczogSU9wZW5EaWFsb2dPcHRpb25zKTogUHJvbWlzZTxVUklbXSB8IHVuZGVmaW5lZD47XG5cblx0YWJzdHJhY3QgcGlja0ZpbGVUb1NhdmUoZGVmYXVsdFVyaTogVVJJLCBhdmFpbGFibGVGaWxlU3lzdGVtcz86IHN0cmluZ1tdKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+O1xuXG5cdHByb3RlY3RlZCBnZXRQaWNrRmlsZVRvU2F2ZURpYWxvZ09wdGlvbnMoZGVmYXVsdFVyaTogVVJJLCBhdmFpbGFibGVGaWxlU3lzdGVtcz86IHN0cmluZ1tdKTogSVNhdmVEaWFsb2dPcHRpb25zIHtcblx0XHRjb25zdCBvcHRpb25zOiBJU2F2ZURpYWxvZ09wdGlvbnMgPSB7XG5cdFx0XHRkZWZhdWx0VXJpLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2F2ZUFzVGl0bGUnLCBcIlNhdmUgQXNcIiksXG5cdFx0XHRhdmFpbGFibGVGaWxlU3lzdGVtc1xuXHRcdH07XG5cblx0XHRpbnRlcmZhY2UgSUZpbHRlciB7IG5hbWU6IHN0cmluZzsgZXh0ZW5zaW9uczogc3RyaW5nW10gfVxuXG5cdFx0Ly8gQnVpbGQgdGhlIGZpbGUgZmlsdGVyIGJ5IHVzaW5nIG91ciBrbm93biBsYW5ndWFnZXNcblx0XHRjb25zdCBleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGRlZmF1bHRVcmkgPyByZXNvdXJjZXMuZXh0bmFtZShkZWZhdWx0VXJpKSA6IHVuZGVmaW5lZDtcblx0XHRsZXQgbWF0Y2hpbmdGaWx0ZXI6IElGaWx0ZXIgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCByZWdpc3RlcmVkTGFuZ3VhZ2VOYW1lcyA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCk7XG5cdFx0Y29uc3QgcmVnaXN0ZXJlZExhbmd1YWdlRmlsdGVyczogSUZpbHRlcltdID0gY29hbGVzY2UocmVnaXN0ZXJlZExhbmd1YWdlTmFtZXMubWFwKCh7IGxhbmd1YWdlTmFtZSwgbGFuZ3VhZ2VJZCB9KSA9PiB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhsYW5ndWFnZUlkKTtcblx0XHRcdGlmICghZXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZpbHRlcjogSUZpbHRlciA9IHsgbmFtZTogbGFuZ3VhZ2VOYW1lLCBleHRlbnNpb25zOiBkaXN0aW5jdChleHRlbnNpb25zKS5zbGljZSgwLCAxMCkubWFwKGUgPT4gdHJpbShlLCAnLicpKSB9O1xuXG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE1ODYwXG5cdFx0XHRjb25zdCBleHRPclBsYWludGV4dCA9IGV4dCB8fCBQTEFJTlRFWFRfRVhURU5TSU9OO1xuXHRcdFx0aWYgKCFtYXRjaGluZ0ZpbHRlciAmJiBleHRlbnNpb25zLmluY2x1ZGVzKGV4dE9yUGxhaW50ZXh0KSkge1xuXHRcdFx0XHRtYXRjaGluZ0ZpbHRlciA9IGZpbHRlcjtcblxuXHRcdFx0XHQvLyBUaGUgc2VsZWN0ZWQgZXh0ZW5zaW9uIG11c3QgYmUgaW4gdGhlIHNldCBvZiBleHRlbnNpb25zIHRoYXQgYXJlIGluIHRoZSBmaWx0ZXIgbGlzdCB0aGF0IGlzIHNlbnQgdG8gdGhlIHNhdmUgZGlhbG9nLlxuXHRcdFx0XHQvLyBJZiBpdCBpc24ndCwgYWRkIGl0IG1hbnVhbGx5LiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQ3NjU3XG5cdFx0XHRcdGNvbnN0IHRyaW1tZWRFeHQgPSB0cmltKGV4dE9yUGxhaW50ZXh0LCAnLicpO1xuXHRcdFx0XHRpZiAoIWZpbHRlci5leHRlbnNpb25zLmluY2x1ZGVzKHRyaW1tZWRFeHQpKSB7XG5cdFx0XHRcdFx0ZmlsdGVyLmV4dGVuc2lvbnMudW5zaGlmdCh0cmltbWVkRXh0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBudWxsOyAvLyBmaXJzdCBtYXRjaGluZyBmaWx0ZXIgd2lsbCBiZSBhZGRlZCB0byB0aGUgdG9wXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmaWx0ZXI7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gV2UgaGF2ZSBubyBtYXRjaGluZyBmaWx0ZXIsIGUuZy4gYmVjYXVzZSB0aGUgbGFuZ3VhZ2Vcblx0XHQvLyBpcyB1bmtub3duLiBXZSBzdGlsbCBhZGQgdGhlIGV4dGVuc2lvbiB0byB0aGUgbGlzdCBvZlxuXHRcdC8vIGZpbHRlcnMgdGhvdWdoIHNvIHRoYXQgaXQgY2FuIGJlIHBpY2tlZFxuXHRcdC8vIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTYyODMpXG5cdFx0aWYgKCFtYXRjaGluZ0ZpbHRlciAmJiBleHQpIHtcblx0XHRcdG1hdGNoaW5nRmlsdGVyID0geyBuYW1lOiB0cmltKGV4dCwgJy4nKS50b1VwcGVyQ2FzZSgpLCBleHRlbnNpb25zOiBbdHJpbShleHQsICcuJyldIH07XG5cdFx0fVxuXG5cdFx0Ly8gT3JkZXIgb2YgZmlsdGVycyBpc1xuXHRcdC8vIC0gQWxsIEZpbGVzICh3ZSBNVVNUIGRvIHRoaXMgdG8gZml4IG1hY09TIGlzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMDI3MTMpXG5cdFx0Ly8gLSBGaWxlIEV4dGVuc2lvbiBNYXRjaCAoaWYgYW55KVxuXHRcdC8vIC0gQWxsIExhbmd1YWdlc1xuXHRcdC8vIC0gTm8gRXh0ZW5zaW9uXG5cdFx0b3B0aW9ucy5maWx0ZXJzID0gY29hbGVzY2UoW1xuXHRcdFx0eyBuYW1lOiBubHMubG9jYWxpemUoJ2FsbEZpbGVzJywgXCJBbGwgRmlsZXNcIiksIGV4dGVuc2lvbnM6IFsnKiddIH0sXG5cdFx0XHRtYXRjaGluZ0ZpbHRlcixcblx0XHRcdC4uLnJlZ2lzdGVyZWRMYW5ndWFnZUZpbHRlcnMsXG5cdFx0XHR7IG5hbWU6IG5scy5sb2NhbGl6ZSgnbm9FeHQnLCBcIk5vIEV4dGVuc2lvblwiKSwgZXh0ZW5zaW9uczogWycnXSB9XG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gb3B0aW9ucztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBMEIsbUJBQW1CLG9CQUFvQjtBQUNqRSxTQUFzRyxnQkFBZ0IsZUFBZSwyQkFBMkI7QUFDaEssU0FBUyxrQkFBa0Isc0JBQXNCLDBCQUEwQixnQkFBZ0IsMkJBQTJCO0FBQ3RILFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0NBQW9DO0FBRTdDLFlBQVksZUFBZTtBQUMzQixTQUFTLGNBQWMscUJBQXFCLGFBQWEsMEJBQTBCO0FBQ25GLFNBQVMsNkJBQThCO0FBQ3ZDLFNBQTRCLHdCQUF3QjtBQUNwRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLGNBQWM7QUFDckIsU0FBUyxVQUFVLGdCQUFnQjtBQUNuQyxTQUFTLFlBQVk7QUFDckIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBRXJCLElBQWUsNEJBQWYsTUFBdUU7QUFBQSxFQUk3RSxZQUNrQyxhQUNZLGdCQUNULGdCQUNhLG9CQUNQLHNCQUNBLHNCQUNULGFBQ0UsZUFDQSxlQUNBLGlCQUNFLG1CQUNMLGNBQ0QsYUFDSyxnQkFDRCxlQUNJLG1CQUNULFlBQzdCO0FBakJnQztBQUNZO0FBQ1Q7QUFDYTtBQUNQO0FBQ0E7QUFDVDtBQUNFO0FBQ0E7QUFDQTtBQUNFO0FBQ0w7QUFDRDtBQUNLO0FBQ0Q7QUFDSTtBQUNUO0FBQUEsRUFDM0I7QUFBQSxFQUVKLE1BQU0sZ0JBQWdCLGVBQWUsS0FBSyx5QkFBeUIsR0FBRyxrQkFBa0IsS0FBSyw0QkFBNEIsR0FBaUI7QUFHekksUUFBSSxZQUFZLEtBQUssZUFBZSxrQkFBa0IsY0FBYyxlQUFlO0FBR25GLFFBQUksQ0FBQyxXQUFXO0FBQ2Ysa0JBQVksS0FBSyxlQUFlLDJCQUEyQixjQUFjLGVBQWU7QUFBQSxJQUN6RixPQUFPO0FBQ04sa0JBQVksVUFBVSxRQUFRLFNBQVM7QUFBQSxJQUN4QztBQUVBLFFBQUksQ0FBQyxXQUFXO0FBQ2Ysa0JBQVksTUFBTSxLQUFLLGNBQWMsWUFBWTtBQUFBLElBQ2xEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLGVBQWUsS0FBSyx5QkFBeUIsR0FBRyxrQkFBa0IsS0FBSyw0QkFBNEIsR0FBaUI7QUFHM0ksUUFBSSxZQUFZLEtBQUssZUFBZSwyQkFBMkIsY0FBYyxlQUFlO0FBRzVGLFFBQUksQ0FBQyxXQUFXO0FBQ2Ysa0JBQVksS0FBSyxlQUFlLGtCQUFrQixjQUFjLGVBQWU7QUFBQSxJQUNoRjtBQUVBLFFBQUksQ0FBQyxXQUFXO0FBQ2YsYUFBTyxLQUFLLGNBQWMsWUFBWTtBQUFBLElBQ3ZDO0FBRUEsV0FBTyxVQUFVLFFBQVEsU0FBUztBQUFBLEVBQ25DO0FBQUEsRUFFQSxNQUFNLGNBQWMsZUFBZSxLQUFLLHlCQUF5QixHQUFpQjtBQUNqRixVQUFNLGNBQWMsaUJBQWlCLFFBQVE7QUFDN0MsVUFBTSxzQkFBc0IsS0FBSyxxQkFBcUIsUUFBZ0IsMEJBQTBCO0FBQ2hHLFVBQU0seUJBQXlCLGNBQWMsb0JBQW9CLGlCQUFpQixvQkFBb0I7QUFDdEcsUUFBSSx3QkFBd0I7QUFDM0IsWUFBTSxtQ0FBbUMsY0FBYyxvQkFBb0Isc0JBQXNCLEtBQUssTUFBTSxLQUFLLFlBQVksTUFBTSxXQUFXLHNCQUFzQjtBQUNwSyxVQUFJLGtDQUFrQztBQUNyQyxjQUFNLDBCQUEwQixjQUFjLG1CQUFtQixzQkFBc0IsS0FBSyxNQUFNLEtBQUssWUFBWSxNQUFNLFVBQVUsc0JBQXNCO0FBQ3pKLGNBQU0sZ0JBQWdCLFVBQVUsZ0JBQWdCLE1BQU0sS0FBSyxZQUFZLFFBQVEsdUJBQXVCLEdBQUcsS0FBSyxtQkFBbUIsaUJBQWlCLEtBQUssWUFBWSxnQkFBZ0I7QUFDbkwsWUFBSSxNQUFNLEtBQUssWUFBWSxPQUFPLGFBQWEsR0FBRztBQUNqRCxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU8sS0FBSyxZQUFZLFNBQVMsRUFBRSxZQUFZLENBQUM7QUFBQSxFQUNqRDtBQUFBLEVBRUEsTUFBTSxxQkFBcUIsZUFBZSxLQUFLLHlCQUF5QixHQUFpQjtBQUN4RixRQUFJO0FBR0osUUFBSSxLQUFLLGVBQWUsa0JBQWtCLE1BQU0sZUFBZSxXQUFXO0FBQ3pFLFlBQU0sZ0JBQWdCLEtBQUssZUFBZSxhQUFhLEVBQUU7QUFDekQsVUFBSSxlQUFlLFdBQVcsZ0JBQWdCLGlCQUFpQixlQUFlLEtBQUssa0JBQWtCLEtBQUssQ0FBQyxxQkFBcUIsYUFBYSxHQUFHO0FBQy9JLCtCQUF1QixVQUFVLFFBQVEsYUFBYTtBQUFBLE1BQ3ZEO0FBQUEsSUFDRDtBQUdBLFFBQUksQ0FBQyxzQkFBc0I7QUFDMUIsNkJBQXVCLE1BQU0sS0FBSyxnQkFBZ0IsWUFBWTtBQUFBLElBQy9EO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sZ0JBQWdCLHNCQUFnRTtBQUNyRixRQUFJLEtBQUssWUFBWSxHQUFHO0FBQ3ZCLFdBQUssV0FBVyxNQUFNLHVFQUF1RTtBQUc3RixhQUFPLGNBQWM7QUFBQSxJQUN0QjtBQUVBLFdBQU8sS0FBSyxrQkFBa0Isb0JBQW9CO0FBQUEsRUFDbkQ7QUFBQSxFQUVRLGNBQXVCO0FBQzlCLFFBQUksS0FBSyxtQkFBbUIsMEJBQTBCLEtBQUssbUJBQW1CLDJCQUEyQjtBQUN4RyxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sQ0FBQyxDQUFDLEtBQUssbUJBQW1CO0FBQUEsRUFDbEM7QUFBQSxFQUVBLE1BQWMsa0JBQWtCLHNCQUFnRTtBQUMvRixRQUFJLHFCQUFxQixXQUFXLEdBQUc7QUFDdEMsYUFBTyxjQUFjO0FBQUEsSUFDdEI7QUFFQSxRQUFJO0FBQ0osUUFBSSxTQUFTLElBQUksU0FBUyxxQkFBcUIsbURBQW1EO0FBQ2xHLFFBQUkscUJBQXFCLFdBQVcsR0FBRztBQUN0QyxnQkFBVSxJQUFJLFNBQVMsc0JBQXNCLG9EQUFvRCxPQUFPLHFCQUFxQixDQUFDLE1BQU0sV0FBVyxxQkFBcUIsQ0FBQyxJQUFJLFVBQVUsU0FBUyxxQkFBcUIsQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUNyTixPQUFPO0FBQ04sZ0JBQVUsSUFBSSxTQUFTLHVCQUF1QiwrREFBK0QscUJBQXFCLE1BQU07QUFDeEksZUFBUyxvQkFBb0Isb0JBQW9CLElBQUksT0FBTztBQUFBLElBQzdEO0FBRUEsVUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNLEtBQUssY0FBYyxPQUFzQjtBQUFBLE1BQ2pFLE1BQU0sU0FBUztBQUFBLE1BQ2Y7QUFBQSxNQUNBO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUjtBQUFBLFVBQ0MsT0FBTyxxQkFBcUIsU0FBUyxJQUNwQyxJQUFJLFNBQVMsRUFBRSxLQUFLLFdBQVcsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsWUFBWSxJQUNqRixJQUFJLFNBQVMsRUFBRSxLQUFLLFFBQVEsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsUUFBUTtBQUFBLFVBQzNFLEtBQUssTUFBTSxjQUFjO0FBQUEsUUFDMUI7QUFBQSxRQUNBO0FBQUEsVUFDQyxPQUFPLElBQUksU0FBUyxFQUFFLEtBQUssWUFBWSxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxjQUFjO0FBQUEsVUFDM0YsS0FBSyxNQUFNLGNBQWM7QUFBQSxRQUMxQjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLEtBQUssTUFBTSxjQUFjO0FBQUEsTUFDMUI7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVUsc0JBQXNCLFFBQWdCLFdBQStCO0FBQzlFLFdBQU8sV0FBVyxRQUFRLFdBQVcsQ0FBQyxRQUFRLElBQUksSUFBSyxXQUFXLFFBQVEsT0FBTyxDQUFDLFFBQVEsUUFBUSxJQUFJLElBQUksQ0FBQyxNQUFNO0FBQUEsRUFDbEg7QUFBQSxFQUVBLE1BQWdCLGdDQUFnQyxRQUFnQixTQUE4QixpQkFBeUM7QUFDdEksVUFBTSxRQUFRLElBQUksU0FBUywwQkFBMEIscUJBQXFCO0FBQzFFLFVBQU0sdUJBQXVCLEtBQUssc0JBQXNCLE1BQU07QUFFOUQsVUFBTSxNQUFNLE1BQU0sS0FBSyxhQUFhLEVBQUUsZ0JBQWdCLE1BQU0sa0JBQWtCLE1BQU0sZUFBZSxPQUFPLFlBQVksUUFBUSxZQUFZLE9BQU8scUJBQXFCLENBQUM7QUFFdkssUUFBSSxLQUFLO0FBQ1IsWUFBTSxPQUFPLE1BQU0sS0FBSyxZQUFZLEtBQUssR0FBRztBQUU1QyxZQUFNLFNBQTBCLEtBQUssY0FBYyxFQUFFLFdBQVcsSUFBSSxJQUFJLEVBQUUsU0FBUyxJQUFJO0FBQ3ZGLFVBQUksQ0FBQyxrQkFBa0IsTUFBTSxLQUFLLGFBQWEsTUFBTSxHQUFHO0FBQ3ZELGFBQUssd0JBQXdCLE9BQU8sT0FBTztBQUFBLE1BQzVDO0FBRUEsVUFBSSxLQUFLLGVBQWUsUUFBUSxrQkFBa0IsaUJBQWlCO0FBQ2xFLGNBQU0sS0FBSyxZQUFZLFdBQVcsQ0FBQyxNQUFNLEdBQUcsRUFBRSxnQkFBZ0IsUUFBUSxnQkFBZ0IsaUJBQWlCLFFBQVEsZ0JBQWdCLENBQUM7QUFBQSxNQUNqSSxPQUFPO0FBQ04sY0FBTSxLQUFLLGNBQWMsWUFBWSxDQUFDLEVBQUUsVUFBVSxLQUFLLFNBQVMsRUFBRSxRQUFRLGlCQUFpQixNQUFNLFFBQVEsS0FBSyxFQUFFLENBQUMsR0FBRyxRQUFXLEVBQUUsZUFBZSxLQUFLLENBQUM7QUFBQSxNQUN2SjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFnQiwwQkFBMEIsUUFBZ0IsU0FBOEIsaUJBQXlDO0FBQ2hJLFVBQU0sUUFBUSxJQUFJLFNBQVMsa0JBQWtCLFdBQVc7QUFDeEQsVUFBTSx1QkFBdUIsS0FBSyxzQkFBc0IsTUFBTTtBQUU5RCxVQUFNLE1BQU0sTUFBTSxLQUFLLGFBQWEsRUFBRSxnQkFBZ0IsTUFBTSxrQkFBa0IsT0FBTyxlQUFlLE9BQU8sWUFBWSxRQUFRLFlBQVksT0FBTyxxQkFBcUIsQ0FBQztBQUN4SyxRQUFJLEtBQUs7QUFDUixXQUFLLHdCQUF3QixHQUFHO0FBRWhDLFVBQUksUUFBUSxrQkFBa0IsaUJBQWlCO0FBQzlDLGNBQU0sS0FBSyxZQUFZLFdBQVcsQ0FBQyxFQUFFLFNBQVMsSUFBSSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsUUFBUSxnQkFBZ0IsaUJBQWlCLFFBQVEsZ0JBQWdCLENBQUM7QUFBQSxNQUMzSSxPQUFPO0FBQ04sY0FBTSxLQUFLLGNBQWMsWUFBWSxDQUFDLEVBQUUsVUFBVSxLQUFLLFNBQVMsRUFBRSxRQUFRLGlCQUFpQixNQUFNLFFBQVEsS0FBSyxFQUFFLENBQUMsR0FBRyxRQUFXLEVBQUUsZUFBZSxLQUFLLENBQUM7QUFBQSxNQUN2SjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFVSx3QkFBd0IsS0FBZ0I7QUFDakQsU0FBSyxrQkFBa0Isa0JBQWtCLENBQUMsRUFBRSxTQUFTLEtBQUssT0FBTyxLQUFLLGFBQWEsWUFBWSxLQUFLLEVBQUUsdUJBQXVCLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUFBLEVBQ3hJO0FBQUEsRUFFQSxNQUFnQiw0QkFBNEIsUUFBZ0IsU0FBNkM7QUFDeEcsVUFBTSxRQUFRLElBQUksU0FBUyxvQkFBb0IsYUFBYTtBQUM1RCxVQUFNLHVCQUF1QixLQUFLLHNCQUFzQixRQUFRLElBQUk7QUFFcEUsVUFBTSxNQUFNLE1BQU0sS0FBSyxhQUFhLEVBQUUsZ0JBQWdCLE9BQU8sa0JBQWtCLE1BQU0sZUFBZSxPQUFPLFlBQVksUUFBUSxZQUFZLE9BQU8scUJBQXFCLENBQUM7QUFDeEssUUFBSSxLQUFLO0FBQ1IsYUFBTyxLQUFLLFlBQVksV0FBVyxDQUFDLEVBQUUsV0FBVyxJQUFJLENBQUMsR0FBRyxFQUFFLGdCQUFnQixRQUFRLGdCQUFnQixpQkFBaUIsUUFBUSxnQkFBZ0IsQ0FBQztBQUFBLElBQzlJO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBZ0IsK0JBQStCLFFBQWdCLFNBQTZDO0FBQzNHLFVBQU0sUUFBUSxJQUFJLFNBQVMsdUJBQXVCLDBCQUEwQjtBQUM1RSxVQUFNLFVBQXdCLENBQUMsRUFBRSxNQUFNLElBQUksU0FBUyx3QkFBd0IsV0FBVyxHQUFHLFlBQVksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0FBQzdILFVBQU0sdUJBQXVCLEtBQUssc0JBQXNCLFFBQVEsSUFBSTtBQUVwRSxVQUFNLE1BQU0sTUFBTSxLQUFLLGFBQWEsRUFBRSxnQkFBZ0IsTUFBTSxrQkFBa0IsT0FBTyxlQUFlLE9BQU8sWUFBWSxRQUFRLFlBQVksT0FBTyxTQUFTLHFCQUFxQixDQUFDO0FBQ2pMLFFBQUksS0FBSztBQUNSLGFBQU8sS0FBSyxZQUFZLFdBQVcsQ0FBQyxFQUFFLGNBQWMsSUFBSSxDQUFDLEdBQUcsRUFBRSxnQkFBZ0IsUUFBUSxnQkFBZ0IsaUJBQWlCLFFBQVEsZ0JBQWdCLENBQUM7QUFBQSxJQUNqSjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWdCLHlCQUF5QixRQUFnQixTQUF1RDtBQUMvRyxRQUFJLENBQUMsUUFBUSxzQkFBc0I7QUFDbEMsY0FBUSx1QkFBdUIsS0FBSyxzQkFBc0IsTUFBTTtBQUFBLElBQ2pFO0FBRUEsWUFBUSxRQUFRLElBQUksU0FBUyxvQkFBb0IsU0FBUztBQUMxRCxVQUFNLE1BQU0sTUFBTSxLQUFLLG1CQUFtQixPQUFPO0FBRWpELFFBQUksS0FBSztBQUNSLFdBQUssd0JBQXdCLEdBQUc7QUFBQSxJQUNqQztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFnQix5QkFBeUIsUUFBZ0IsU0FBdUQ7QUFDL0csUUFBSSxDQUFDLFFBQVEsc0JBQXNCO0FBQ2xDLGNBQVEsdUJBQXVCLEtBQUssc0JBQXNCLE1BQU07QUFBQSxJQUNqRTtBQUVBLFdBQU8sS0FBSyxtQkFBbUIsT0FBTztBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxNQUFnQix5QkFBeUIsUUFBZ0IsU0FBeUQ7QUFDakgsUUFBSSxDQUFDLFFBQVEsc0JBQXNCO0FBQ2xDLGNBQVEsdUJBQXVCLEtBQUssc0JBQXNCLFFBQVEsUUFBUSxnQkFBZ0I7QUFBQSxJQUMzRjtBQUVBLFVBQU0sTUFBTSxNQUFNLEtBQUssYUFBYSxPQUFPO0FBRTNDLFdBQU8sTUFBTSxDQUFDLEdBQUcsSUFBSTtBQUFBLEVBQ3RCO0FBQUEsRUFFVSxzQkFBeUM7QUFDbEQsV0FBTyxLQUFLLHFCQUFxQixlQUFlLGdCQUFnQjtBQUFBLEVBQ2pFO0FBQUEsRUFFUSxhQUFhLFNBQXVEO0FBQzNFLFdBQU8sS0FBSyxvQkFBb0IsRUFBRSxlQUFlLE9BQU87QUFBQSxFQUN6RDtBQUFBLEVBRVEsbUJBQW1CLFNBQXVEO0FBQ2pGLFdBQU8sS0FBSyxvQkFBb0IsRUFBRSxlQUFlLE9BQU87QUFBQSxFQUN6RDtBQUFBLEVBRVEseUJBQXlCLGtCQUFtQztBQUNuRSxXQUFPLG9CQUFvQixLQUFLLFlBQVk7QUFBQSxFQUM3QztBQUFBLEVBRVEsOEJBQWtEO0FBQ3pELFdBQU8sS0FBSyxtQkFBbUI7QUFBQSxFQUNoQztBQUFBLEVBRVUsb0JBQW9CLFNBQWlGO0FBQzlHLFdBQU8sUUFBUSx3QkFBd0IsUUFBUSxxQkFBcUIsQ0FBQyxLQUFLLEtBQUsseUJBQXlCLFFBQVEsWUFBWSxNQUFNO0FBQUEsRUFDbkk7QUFBQSxFQU1VLGlDQUFpQyxTQUF3QztBQUNsRixRQUFJLFFBQVEsd0JBQXlCLFFBQVEscUJBQXFCLFNBQVMsR0FBSTtBQUM5RSxhQUFPLFFBQVE7QUFBQSxJQUNoQjtBQUNBLFVBQU0sdUJBQXVCLENBQUMsUUFBUSxJQUFJO0FBQzFDLFFBQUksS0FBSyxtQkFBbUIsaUJBQWlCO0FBQzVDLDJCQUFxQixRQUFRLFFBQVEsWUFBWTtBQUFBLElBQ2xEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQU1VLCtCQUErQixZQUFpQixzQkFBcUQ7QUFDOUcsVUFBTSxVQUE4QjtBQUFBLE1BQ25DO0FBQUEsTUFDQSxPQUFPLElBQUksU0FBUyxlQUFlLFNBQVM7QUFBQSxNQUM1QztBQUFBLElBQ0Q7QUFLQSxVQUFNLE1BQTBCLGFBQWEsVUFBVSxRQUFRLFVBQVUsSUFBSTtBQUM3RSxRQUFJO0FBRUosVUFBTSwwQkFBMEIsS0FBSyxnQkFBZ0IsaUNBQWlDO0FBQ3RGLFVBQU0sNEJBQXVDLFNBQVMsd0JBQXdCLElBQUksQ0FBQyxFQUFFLGNBQWMsV0FBVyxNQUFNO0FBQ25ILFlBQU0sYUFBYSxLQUFLLGdCQUFnQixjQUFjLFVBQVU7QUFDaEUsVUFBSSxDQUFDLFdBQVcsUUFBUTtBQUN2QixlQUFPO0FBQUEsTUFDUjtBQUVBLFlBQU0sU0FBa0IsRUFBRSxNQUFNLGNBQWMsWUFBWSxTQUFTLFVBQVUsRUFBRSxNQUFNLEdBQUcsRUFBRSxFQUFFLElBQUksT0FBSyxLQUFLLEdBQUcsR0FBRyxDQUFDLEVBQUU7QUFHbkgsWUFBTSxpQkFBaUIsT0FBTztBQUM5QixVQUFJLENBQUMsa0JBQWtCLFdBQVcsU0FBUyxjQUFjLEdBQUc7QUFDM0QseUJBQWlCO0FBSWpCLGNBQU0sYUFBYSxLQUFLLGdCQUFnQixHQUFHO0FBQzNDLFlBQUksQ0FBQyxPQUFPLFdBQVcsU0FBUyxVQUFVLEdBQUc7QUFDNUMsaUJBQU8sV0FBVyxRQUFRLFVBQVU7QUFBQSxRQUNyQztBQUVBLGVBQU87QUFBQSxNQUNSO0FBRUEsYUFBTztBQUFBLElBQ1IsQ0FBQyxDQUFDO0FBTUYsUUFBSSxDQUFDLGtCQUFrQixLQUFLO0FBQzNCLHVCQUFpQixFQUFFLE1BQU0sS0FBSyxLQUFLLEdBQUcsRUFBRSxZQUFZLEdBQUcsWUFBWSxDQUFDLEtBQUssS0FBSyxHQUFHLENBQUMsRUFBRTtBQUFBLElBQ3JGO0FBT0EsWUFBUSxVQUFVLFNBQVM7QUFBQSxNQUMxQixFQUFFLE1BQU0sSUFBSSxTQUFTLFlBQVksV0FBVyxHQUFHLFlBQVksQ0FBQyxHQUFHLEVBQUU7QUFBQSxNQUNqRTtBQUFBLE1BQ0EsR0FBRztBQUFBLE1BQ0gsRUFBRSxNQUFNLElBQUksU0FBUyxTQUFTLGNBQWMsR0FBRyxZQUFZLENBQUMsRUFBRSxFQUFFO0FBQUEsSUFDakUsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUF2V3NCLDRCQUFmO0FBQUEsRUFLSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXJCbUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
