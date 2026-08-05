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
import { join } from "../../../base/common/path.js";
import { basename, isEqual, isEqualOrParent } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { Event, Emitter } from "../../../base/common/event.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { WorkbenchState } from "../../../platform/workspace/common/workspace.js";
import { TestWorkspace } from "../../../platform/workspace/test/common/testWorkspace.js";
import { isLinux, isMacintosh } from "../../../base/common/platform.js";
import { InMemoryStorageService } from "../../../platform/storage/common/storage.js";
import { WorkingCopyCapabilities } from "../../services/workingCopy/common/workingCopy.js";
import { NullExtensionService } from "../../services/extensions/common/extensions.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { SaveReason } from "../../common/editor.js";
import product from "../../../platform/product/common/product.js";
import { AbstractLoggerService, LogLevel, NullLogger } from "../../../platform/log/common/log.js";
import { WorkspaceTrustUriResponse } from "../../../platform/workspace/common/workspaceTrust.js";
class TestLoggerService extends AbstractLoggerService {
  constructor(logsHome) {
    super(LogLevel.Info, logsHome ?? URI.file("tests").with({ scheme: "vscode-tests" }));
  }
  doCreateLogger() {
    return new NullLogger();
  }
}
let TestTextResourcePropertiesService = class {
  constructor(configurationService) {
    this.configurationService = configurationService;
  }
  getEOL(resource, language) {
    const eol = this.configurationService.getValue("files.eol", { overrideIdentifier: language, resource });
    if (eol && typeof eol === "string" && eol !== "auto") {
      return eol;
    }
    return isLinux || isMacintosh ? "\n" : "\r\n";
  }
};
TestTextResourcePropertiesService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], TestTextResourcePropertiesService);
class TestContextService {
  get onDidChangeWorkspaceName() {
    return this._onDidChangeWorkspaceName.event;
  }
  get onWillChangeWorkspaceFolders() {
    return this._onWillChangeWorkspaceFolders.event;
  }
  get onDidChangeWorkspaceFolders() {
    return this._onDidChangeWorkspaceFolders.event;
  }
  get onDidChangeWorkbenchState() {
    return this._onDidChangeWorkbenchState.event;
  }
  constructor(workspace = TestWorkspace, options = null) {
    this.workspace = workspace;
    this.options = options || /* @__PURE__ */ Object.create(null);
    this._onDidChangeWorkspaceName = new Emitter();
    this._onWillChangeWorkspaceFolders = new Emitter();
    this._onDidChangeWorkspaceFolders = new Emitter();
    this._onDidChangeWorkbenchState = new Emitter();
  }
  getFolders() {
    return this.workspace ? this.workspace.folders : [];
  }
  getWorkbenchState() {
    if (this.workspace.configuration) {
      return WorkbenchState.WORKSPACE;
    }
    if (this.workspace.folders.length) {
      return WorkbenchState.FOLDER;
    }
    return WorkbenchState.EMPTY;
  }
  getCompleteWorkspace() {
    return Promise.resolve(this.getWorkspace());
  }
  getWorkspace() {
    return this.workspace;
  }
  getWorkspaceFolder(resource) {
    return this.workspace.getFolder(resource);
  }
  setWorkspace(workspace) {
    this.workspace = workspace;
  }
  getOptions() {
    return this.options;
  }
  updateOptions() {
  }
  isInsideWorkspace(resource) {
    if (resource && this.workspace) {
      return isEqualOrParent(resource, this.workspace.folders[0].uri);
    }
    return false;
  }
  toResource(workspaceRelativePath) {
    return URI.file(join("C:\\", workspaceRelativePath));
  }
  isCurrentWorkspace(workspaceIdOrFolder) {
    return URI.isUri(workspaceIdOrFolder) && isEqual(this.workspace.folders[0].uri, workspaceIdOrFolder);
  }
}
class TestStorageService extends InMemoryStorageService {
  testEmitWillSaveState(reason) {
    super.emitWillSaveState(reason);
  }
}
class TestHistoryService {
  constructor(root) {
    this.root = root;
  }
  async reopenLastClosedEditor() {
  }
  async goForward() {
  }
  async goBack() {
  }
  async goPrevious() {
  }
  async goLast() {
  }
  removeFromHistory(_input) {
  }
  clear() {
  }
  clearRecentlyOpened() {
  }
  getHistory() {
    return [];
  }
  async openNextRecentlyUsedEditor(group) {
  }
  async openPreviouslyUsedEditor(group) {
  }
  getLastActiveWorkspaceRoot(_schemeFilter) {
    return this.root;
  }
  getLastActiveFile(_schemeFilter) {
    return void 0;
  }
}
class TestWorkingCopy extends Disposable {
  constructor(resource, isDirty = false, typeId = "testWorkingCopyType") {
    super();
    this.resource = resource;
    this.typeId = typeId;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this.capabilities = WorkingCopyCapabilities.None;
    this.dirty = false;
    this.name = basename(this.resource);
    this.dirty = isDirty;
  }
  setDirty(dirty) {
    if (this.dirty !== dirty) {
      this.dirty = dirty;
      this._onDidChangeDirty.fire();
    }
  }
  setContent(content) {
    this._onDidChangeContent.fire();
  }
  isDirty() {
    return this.dirty;
  }
  isModified() {
    return this.isDirty();
  }
  async save(options, stat) {
    this._onDidSave.fire({ reason: options?.reason ?? SaveReason.EXPLICIT, stat: stat ?? createFileStat(this.resource), source: options?.source });
    return true;
  }
  async revert(options) {
    this.setDirty(false);
  }
  async backup(token) {
    return {};
  }
}
function createFileStat(resource, readonly = false, isFile, isDirectory, children) {
  return {
    resource,
    etag: Date.now().toString(),
    mtime: Date.now(),
    ctime: Date.now(),
    size: 42,
    isFile: isFile ?? true,
    isDirectory: isDirectory ?? false,
    isSymbolicLink: false,
    readonly,
    locked: false,
    name: basename(resource),
    children: children?.map((c) => createFileStat(c.resource, false, c.isFile, c.isDirectory))
  };
}
class TestWorkingCopyFileService {
  constructor() {
    this.onWillRunWorkingCopyFileOperation = Event.None;
    this.onDidFailWorkingCopyFileOperation = Event.None;
    this.onDidRunWorkingCopyFileOperation = Event.None;
    this.hasSaveParticipants = false;
  }
  addFileOperationParticipant(participant) {
    return Disposable.None;
  }
  addSaveParticipant(participant) {
    return Disposable.None;
  }
  async runSaveParticipants(workingCopy, context, progress, token) {
  }
  async delete(operations, token, undoInfo) {
  }
  registerWorkingCopyProvider(provider) {
    return Disposable.None;
  }
  getDirty(resource) {
    return [];
  }
  create(operations, token, undoInfo) {
    throw new Error("Method not implemented.");
  }
  createFolder(operations, token, undoInfo) {
    throw new Error("Method not implemented.");
  }
  move(operations, token, undoInfo) {
    throw new Error("Method not implemented.");
  }
  copy(operations, token, undoInfo) {
    throw new Error("Method not implemented.");
  }
}
function mock() {
  return function() {
  };
}
class TestExtensionService extends NullExtensionService {
}
const TestProductService = { _serviceBrand: void 0, ...product };
class TestActivityService {
  constructor() {
    this.onDidChangeActivity = Event.None;
  }
  getViewContainerActivities(viewContainerId) {
    return [];
  }
  getActivity(id) {
    return [];
  }
  showViewContainerActivity(viewContainerId, badge) {
    return this;
  }
  showViewActivity(viewId, badge) {
    return this;
  }
  showAccountsActivity(activity) {
    return this;
  }
  showGlobalActivity(activity) {
    return this;
  }
  dispose() {
  }
}
const NullFilesConfigurationService = new class {
  constructor() {
    this.onDidChangeAutoSaveConfiguration = Event.None;
    this.onDidChangeAutoSaveDisabled = Event.None;
    this.onDidChangeReadonly = Event.None;
    this.onDidChangeFilesAssociation = Event.None;
    this.isHotExitEnabled = false;
    this.hotExitConfiguration = void 0;
  }
  getAutoSaveConfiguration() {
    throw new Error("Method not implemented.");
  }
  getAutoSaveMode() {
    throw new Error("Method not implemented.");
  }
  hasShortAutoSaveDelay() {
    throw new Error("Method not implemented.");
  }
  toggleAutoSave() {
    throw new Error("Method not implemented.");
  }
  enableAutoSaveAfterShortDelay(resourceOrEditor) {
    throw new Error("Method not implemented.");
  }
  disableAutoSave(resourceOrEditor) {
    throw new Error("Method not implemented.");
  }
  isReadonly(resource, stat) {
    return false;
  }
  async updateReadonly(resource, readonly) {
  }
  preventSaveConflicts(resource, language) {
    throw new Error("Method not implemented.");
  }
}();
class TestWorkspaceTrustEnablementService {
  constructor(isEnabled = true) {
    this.isEnabled = isEnabled;
  }
  isWorkspaceTrustEnabled() {
    return this.isEnabled;
  }
}
class TestWorkspaceTrustManagementService extends Disposable {
  constructor(trusted = true) {
    super();
    this.trusted = trusted;
    this._onDidChangeTrust = this._register(new Emitter());
    this.onDidChangeTrust = this._onDidChangeTrust.event;
    this._onDidChangeTrustedFolders = this._register(new Emitter());
    this.onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;
    this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
    this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
  }
  get acceptsOutOfWorkspaceFiles() {
    throw new Error("Method not implemented.");
  }
  set acceptsOutOfWorkspaceFiles(value) {
    throw new Error("Method not implemented.");
  }
  addWorkspaceTrustTransitionParticipant(participant) {
    throw new Error("Method not implemented.");
  }
  getTrustedUris() {
    throw new Error("Method not implemented.");
  }
  setParentFolderTrust(trusted) {
    throw new Error("Method not implemented.");
  }
  getUriTrustInfo(uri) {
    throw new Error("Method not implemented.");
  }
  async setTrustedUris(folders) {
    throw new Error("Method not implemented.");
  }
  async setUrisTrust(uris, trusted) {
    throw new Error("Method not implemented.");
  }
  canSetParentFolderTrust() {
    throw new Error("Method not implemented.");
  }
  canSetWorkspaceTrust() {
    throw new Error("Method not implemented.");
  }
  isWorkspaceTrusted() {
    return this.trusted;
  }
  isWorkspaceTrustForced() {
    return false;
  }
  get workspaceTrustInitialized() {
    return Promise.resolve();
  }
  get workspaceResolved() {
    return Promise.resolve();
  }
  async setWorkspaceTrust(trusted) {
    if (this.trusted !== trusted) {
      this.trusted = trusted;
      this._onDidChangeTrust.fire(this.trusted);
    }
  }
}
class TestWorkspaceTrustRequestService extends Disposable {
  constructor(_trusted) {
    super();
    this._trusted = _trusted;
    this._onDidInitiateOpenFilesTrustRequest = this._register(new Emitter());
    this.onDidInitiateOpenFilesTrustRequest = this._onDidInitiateOpenFilesTrustRequest.event;
    this._onDidInitiateWorkspaceTrustRequest = this._register(new Emitter());
    this.onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;
    this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
    this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
    this.requestOpenUrisHandler = async (uris) => {
      return WorkspaceTrustUriResponse.Open;
    };
  }
  requestOpenFilesTrust(uris) {
    return this.requestOpenUrisHandler(uris);
  }
  async completeOpenFilesTrustRequest(result, saveResponse) {
    throw new Error("Method not implemented.");
  }
  cancelWorkspaceTrustRequest() {
    throw new Error("Method not implemented.");
  }
  async completeWorkspaceTrustRequest(trusted) {
    throw new Error("Method not implemented.");
  }
  async requestWorkspaceTrust(options) {
    return this._trusted;
  }
  requestWorkspaceTrustOnStartup() {
    throw new Error("Method not implemented.");
  }
}
class TestMarkerService {
  constructor() {
    this.onMarkerChanged = Event.None;
  }
  getStatistics() {
    throw new Error("Method not implemented.");
  }
  changeOne(owner, resource, markers) {
  }
  changeAll(owner, data) {
  }
  remove(owner, resources) {
  }
  read(filter) {
    return [];
  }
  installResourceFilter(resource, reason) {
    return { dispose: () => {
    } };
  }
}
export {
  NullFilesConfigurationService,
  TestActivityService,
  TestContextService,
  TestExtensionService,
  TestHistoryService,
  TestLoggerService,
  TestMarkerService,
  TestProductService,
  TestStorageService,
  TestTextResourcePropertiesService,
  TestWorkingCopy,
  TestWorkingCopyFileService,
  TestWorkspaceTrustEnablementService,
  TestWorkspaceTrustManagementService,
  TestWorkspaceTrustRequestService,
  createFileStat,
  mock
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgam9pbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGlzRXF1YWwsIGlzRXF1YWxPclBhcmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZSwgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQsIFdvcmtzcGFjZSwgSVdvcmtzcGFjZUZvbGRlcnNXaWxsQ2hhbmdlRXZlbnQsIElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFRlc3RXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvdGVzdC9jb21tb24vdGVzdFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgaXNMaW51eCwgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlLCBXaWxsU2F2ZVN0YXRlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHksIElXb3JraW5nQ29weUJhY2t1cCwgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgTnVsbEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLCBJV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uUGFydGljaXBhbnQsIFdvcmtpbmdDb3B5RmlsZUV2ZW50LCBJRGVsZXRlT3BlcmF0aW9uLCBJQ29weU9wZXJhdGlvbiwgSU1vdmVPcGVyYXRpb24sIElGaWxlT3BlcmF0aW9uVW5kb1JlZG9JbmZvLCBJQ3JlYXRlRmlsZU9wZXJhdGlvbiwgSUNyZWF0ZU9wZXJhdGlvbiwgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVQYXJ0aWNpcGFudCwgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVQYXJ0aWNpcGFudENvbnRleHQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQmFzZUZpbGVTdGF0LCBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNhdmVPcHRpb25zLCBJUmV2ZXJ0T3B0aW9ucywgU2F2ZVJlYXNvbiwgR3JvdXBJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElBY3Rpdml0eSwgSUFjdGl2aXR5U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdExvZ2dlclNlcnZpY2UsIElMb2dnZXIsIExvZ0xldmVsLCBOdWxsTG9nZ2VyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVJlc291cmNlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJQXV0b1NhdmVDb25maWd1cmF0aW9uLCBJQXV0b1NhdmVNb2RlLCBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2ZpbGVzQ29uZmlndXJhdGlvbi9jb21tb24vZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSwgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBJV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQsIElXb3Jrc3BhY2VUcnVzdFVyaUluZm8sIFdvcmtzcGFjZVRydXN0UmVxdWVzdE9wdGlvbnMsIFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZVRydXN0LmpzJztcbmltcG9ydCB7IElNYXJrZXIsIElNYXJrZXJEYXRhLCBJTWFya2VyU2VydmljZSwgSVJlc291cmNlTWFya2VyLCBNYXJrZXJTdGF0aXN0aWNzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MsIElQcm9ncmVzc1N0ZXAgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVzdExvZ2dlclNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdExvZ2dlclNlcnZpY2Uge1xuXHRjb25zdHJ1Y3Rvcihsb2dzSG9tZT86IFVSSSkge1xuXHRcdHN1cGVyKExvZ0xldmVsLkluZm8sIGxvZ3NIb21lID8/IFVSSS5maWxlKCd0ZXN0cycpLndpdGgoeyBzY2hlbWU6ICd2c2NvZGUtdGVzdHMnIH0pKTtcblx0fVxuXHRwcm90ZWN0ZWQgZG9DcmVhdGVMb2dnZXIoKTogSUxvZ2dlciB7IHJldHVybiBuZXcgTnVsbExvZ2dlcigpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0VGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgaW1wbGVtZW50cyBJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGdldEVPTChyZXNvdXJjZTogVVJJLCBsYW5ndWFnZT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZW9sID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZmlsZXMuZW9sJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlLCByZXNvdXJjZSB9KTtcblx0XHRpZiAoZW9sICYmIHR5cGVvZiBlb2wgPT09ICdzdHJpbmcnICYmIGVvbCAhPT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gZW9sO1xuXHRcdH1cblx0XHRyZXR1cm4gKGlzTGludXggfHwgaXNNYWNpbnRvc2gpID8gJ1xcbicgOiAnXFxyXFxuJztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdENvbnRleHRTZXJ2aWNlIGltcGxlbWVudHMgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHdvcmtzcGFjZTogV29ya3NwYWNlO1xuXHRwcml2YXRlIG9wdGlvbnM6IG9iamVjdDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVdvcmtzcGFjZU5hbWU6IEVtaXR0ZXI8dm9pZD47XG5cdGdldCBvbkRpZENoYW5nZVdvcmtzcGFjZU5hbWUoKTogRXZlbnQ8dm9pZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2VOYW1lLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVyczogRW1pdHRlcjxJV29ya3NwYWNlRm9sZGVyc1dpbGxDaGFuZ2VFdmVudD47XG5cdGdldCBvbldpbGxDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKCk6IEV2ZW50PElXb3Jrc3BhY2VGb2xkZXJzV2lsbENoYW5nZUV2ZW50PiB7IHJldHVybiB0aGlzLl9vbldpbGxDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzOiBFbWl0dGVyPElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQ+O1xuXHRnZXQgb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKCk6IEV2ZW50PElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycy5ldmVudDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGU6IEVtaXR0ZXI8V29ya2JlbmNoU3RhdGU+O1xuXHRnZXQgb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSgpOiBFdmVudDxXb3JrYmVuY2hTdGF0ZT4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZS5ldmVudDsgfVxuXG5cdGNvbnN0cnVjdG9yKHdvcmtzcGFjZSA9IFRlc3RXb3Jrc3BhY2UsIG9wdGlvbnMgPSBudWxsKSB7XG5cdFx0dGhpcy53b3Jrc3BhY2UgPSB3b3Jrc3BhY2U7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlV29ya3NwYWNlTmFtZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0dGhpcy5fb25XaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVycyA9IG5ldyBFbWl0dGVyPElXb3Jrc3BhY2VGb2xkZXJzV2lsbENoYW5nZUV2ZW50PigpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycyA9IG5ldyBFbWl0dGVyPElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQ+KCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSA9IG5ldyBFbWl0dGVyPFdvcmtiZW5jaFN0YXRlPigpO1xuXHR9XG5cblx0Z2V0Rm9sZGVycygpOiBJV29ya3NwYWNlRm9sZGVyW10ge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZSA/IHRoaXMud29ya3NwYWNlLmZvbGRlcnMgOiBbXTtcblx0fVxuXG5cdGdldFdvcmtiZW5jaFN0YXRlKCk6IFdvcmtiZW5jaFN0YXRlIHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2UuY29uZmlndXJhdGlvbikge1xuXHRcdFx0cmV0dXJuIFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy53b3Jrc3BhY2UuZm9sZGVycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBXb3JrYmVuY2hTdGF0ZS5GT0xERVI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFdvcmtiZW5jaFN0YXRlLkVNUFRZO1xuXHR9XG5cblx0Z2V0Q29tcGxldGVXb3Jrc3BhY2UoKTogUHJvbWlzZTxJV29ya3NwYWNlPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmdldFdvcmtzcGFjZSgpKTtcblx0fVxuXG5cdGdldFdvcmtzcGFjZSgpOiBJV29ya3NwYWNlIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2U7XG5cdH1cblxuXHRnZXRXb3Jrc3BhY2VGb2xkZXIocmVzb3VyY2U6IFVSSSk6IElXb3Jrc3BhY2VGb2xkZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2UuZ2V0Rm9sZGVyKHJlc291cmNlKTtcblx0fVxuXG5cdHNldFdvcmtzcGFjZSh3b3Jrc3BhY2U6IGFueSk6IHZvaWQge1xuXHRcdHRoaXMud29ya3NwYWNlID0gd29ya3NwYWNlO1xuXHR9XG5cblx0Z2V0T3B0aW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5vcHRpb25zO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucygpIHsgfVxuXG5cdGlzSW5zaWRlV29ya3NwYWNlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRpZiAocmVzb3VyY2UgJiYgdGhpcy53b3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiBpc0VxdWFsT3JQYXJlbnQocmVzb3VyY2UsIHRoaXMud29ya3NwYWNlLmZvbGRlcnNbMF0udXJpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHR0b1Jlc291cmNlKHdvcmtzcGFjZVJlbGF0aXZlUGF0aDogc3RyaW5nKTogVVJJIHtcblx0XHRyZXR1cm4gVVJJLmZpbGUoam9pbignQzpcXFxcJywgd29ya3NwYWNlUmVsYXRpdmVQYXRoKSk7XG5cdH1cblxuXHRpc0N1cnJlbnRXb3Jrc3BhY2Uod29ya3NwYWNlSWRPckZvbGRlcjogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciB8IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBVUkkuaXNVcmkod29ya3NwYWNlSWRPckZvbGRlcikgJiYgaXNFcXVhbCh0aGlzLndvcmtzcGFjZS5mb2xkZXJzWzBdLnVyaSwgd29ya3NwYWNlSWRPckZvbGRlcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RTdG9yYWdlU2VydmljZSBleHRlbmRzIEluTWVtb3J5U3RvcmFnZVNlcnZpY2Uge1xuXG5cdHRlc3RFbWl0V2lsbFNhdmVTdGF0ZShyZWFzb246IFdpbGxTYXZlU3RhdGVSZWFzb24pOiB2b2lkIHtcblx0XHRzdXBlci5lbWl0V2lsbFNhdmVTdGF0ZShyZWFzb24pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0SGlzdG9yeVNlcnZpY2UgaW1wbGVtZW50cyBJSGlzdG9yeVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcm9vdD86IFVSSSkgeyB9XG5cblx0YXN5bmMgcmVvcGVuTGFzdENsb3NlZEVkaXRvcigpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBnb0ZvcndhcmQoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgZ29CYWNrKCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGdvUHJldmlvdXMoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgZ29MYXN0KCk6IFByb21pc2U8dm9pZD4geyB9XG5cdHJlbW92ZUZyb21IaXN0b3J5KF9pbnB1dDogRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCk6IHZvaWQgeyB9XG5cdGNsZWFyKCk6IHZvaWQgeyB9XG5cdGNsZWFyUmVjZW50bHlPcGVuZWQoKTogdm9pZCB7IH1cblx0Z2V0SGlzdG9yeSgpOiByZWFkb25seSAoRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dClbXSB7IHJldHVybiBbXTsgfVxuXHRhc3luYyBvcGVuTmV4dFJlY2VudGx5VXNlZEVkaXRvcihncm91cD86IEdyb3VwSWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIG9wZW5QcmV2aW91c2x5VXNlZEVkaXRvcihncm91cD86IEdyb3VwSWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4geyB9XG5cdGdldExhc3RBY3RpdmVXb3Jrc3BhY2VSb290KF9zY2hlbWVGaWx0ZXI6IHN0cmluZyk6IFVSSSB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLnJvb3Q7IH1cblx0Z2V0TGFzdEFjdGl2ZUZpbGUoX3NjaGVtZUZpbHRlcjogc3RyaW5nKTogVVJJIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFdvcmtpbmdDb3B5IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JraW5nQ29weSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VEaXJ0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZURpcnR5ID0gdGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2F2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNhdmUgPSB0aGlzLl9vbkRpZFNhdmUuZXZlbnQ7XG5cblx0cmVhZG9ubHkgY2FwYWJpbGl0aWVzID0gV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuTm9uZTtcblxuXHRyZWFkb25seSBuYW1lO1xuXG5cdHByaXZhdGUgZGlydHkgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSByZXNvdXJjZTogVVJJLCBpc0RpcnR5ID0gZmFsc2UsIHJlYWRvbmx5IHR5cGVJZCA9ICd0ZXN0V29ya2luZ0NvcHlUeXBlJykge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLm5hbWUgPSBiYXNlbmFtZSh0aGlzLnJlc291cmNlKTtcblx0XHR0aGlzLmRpcnR5ID0gaXNEaXJ0eTtcblx0fVxuXG5cdHNldERpcnR5KGRpcnR5OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZGlydHkgIT09IGRpcnR5KSB7XG5cdFx0XHR0aGlzLmRpcnR5ID0gZGlydHk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRzZXRDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKCk7XG5cdH1cblxuXHRpc0RpcnR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRpcnR5O1xuXHR9XG5cblx0aXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pc0RpcnR5KCk7XG5cdH1cblxuXHRhc3luYyBzYXZlKG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMsIHN0YXQ/OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHR0aGlzLl9vbkRpZFNhdmUuZmlyZSh7IHJlYXNvbjogb3B0aW9ucz8ucmVhc29uID8/IFNhdmVSZWFzb24uRVhQTElDSVQsIHN0YXQ6IHN0YXQgPz8gY3JlYXRlRmlsZVN0YXQodGhpcy5yZXNvdXJjZSksIHNvdXJjZTogb3B0aW9ucz8uc291cmNlIH0pO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyByZXZlcnQob3B0aW9ucz86IElSZXZlcnRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zZXREaXJ0eShmYWxzZSk7XG5cdH1cblxuXHRhc3luYyBiYWNrdXAodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJV29ya2luZ0NvcHlCYWNrdXA+IHtcblx0XHRyZXR1cm4ge307XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpbGVTdGF0KHJlc291cmNlOiBVUkksIHJlYWRvbmx5ID0gZmFsc2UsIGlzRmlsZT86IGJvb2xlYW4sIGlzRGlyZWN0b3J5PzogYm9vbGVhbiwgY2hpbGRyZW4/OiB7IHJlc291cmNlOiBVUkk7IGlzRmlsZT86IGJvb2xlYW47IGlzRGlyZWN0b3J5PzogYm9vbGVhbiB9W10gfCB1bmRlZmluZWQpOiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEge1xuXHRyZXR1cm4ge1xuXHRcdHJlc291cmNlLFxuXHRcdGV0YWc6IERhdGUubm93KCkudG9TdHJpbmcoKSxcblx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRjdGltZTogRGF0ZS5ub3coKSxcblx0XHRzaXplOiA0Mixcblx0XHRpc0ZpbGU6IGlzRmlsZSA/PyB0cnVlLFxuXHRcdGlzRGlyZWN0b3J5OiBpc0RpcmVjdG9yeSA/PyBmYWxzZSxcblx0XHRpc1N5bWJvbGljTGluazogZmFsc2UsXG5cdFx0cmVhZG9ubHksXG5cdFx0bG9ja2VkOiBmYWxzZSxcblx0XHRuYW1lOiBiYXNlbmFtZShyZXNvdXJjZSksXG5cdFx0Y2hpbGRyZW46IGNoaWxkcmVuPy5tYXAoYyA9PiBjcmVhdGVGaWxlU3RhdChjLnJlc291cmNlLCBmYWxzZSwgYy5pc0ZpbGUsIGMuaXNEaXJlY3RvcnkpKVxuXHR9O1xufVxuXG5leHBvcnQgY2xhc3MgVGVzdFdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgaW1wbGVtZW50cyBJV29ya2luZ0NvcHlGaWxlU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0b25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uOiBFdmVudDxXb3JraW5nQ29weUZpbGVFdmVudD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZEZhaWxXb3JraW5nQ29weUZpbGVPcGVyYXRpb246IEV2ZW50PFdvcmtpbmdDb3B5RmlsZUV2ZW50PiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uOiBFdmVudDxXb3JraW5nQ29weUZpbGVFdmVudD4gPSBFdmVudC5Ob25lO1xuXG5cdGFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudChwYXJ0aWNpcGFudDogSVdvcmtpbmdDb3B5RmlsZU9wZXJhdGlvblBhcnRpY2lwYW50KTogSURpc3Bvc2FibGUgeyByZXR1cm4gRGlzcG9zYWJsZS5Ob25lOyB9XG5cblx0cmVhZG9ubHkgaGFzU2F2ZVBhcnRpY2lwYW50cyA9IGZhbHNlO1xuXHRhZGRTYXZlUGFydGljaXBhbnQocGFydGljaXBhbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlUGFydGljaXBhbnQpOiBJRGlzcG9zYWJsZSB7IHJldHVybiBEaXNwb3NhYmxlLk5vbmU7IH1cblx0YXN5bmMgcnVuU2F2ZVBhcnRpY2lwYW50cyh3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5LCBjb250ZXh0OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZVBhcnRpY2lwYW50Q29udGV4dCwgcHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7IH1cblxuXHRhc3luYyBkZWxldGUob3BlcmF0aW9uczogSURlbGV0ZU9wZXJhdGlvbltdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHVuZG9JbmZvPzogSUZpbGVPcGVyYXRpb25VbmRvUmVkb0luZm8pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXG5cdHJlZ2lzdGVyV29ya2luZ0NvcHlQcm92aWRlcihwcm92aWRlcjogKHJlc291cmNlT3JGb2xkZXI6IFVSSSkgPT4gSVdvcmtpbmdDb3B5W10pOiBJRGlzcG9zYWJsZSB7IHJldHVybiBEaXNwb3NhYmxlLk5vbmU7IH1cblxuXHRnZXREaXJ0eShyZXNvdXJjZTogVVJJKTogSVdvcmtpbmdDb3B5W10geyByZXR1cm4gW107IH1cblxuXHRjcmVhdGUob3BlcmF0aW9uczogSUNyZWF0ZUZpbGVPcGVyYXRpb25bXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCB1bmRvSW5mbz86IElGaWxlT3BlcmF0aW9uVW5kb1JlZG9JbmZvKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGFbXT4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Y3JlYXRlRm9sZGVyKG9wZXJhdGlvbnM6IElDcmVhdGVPcGVyYXRpb25bXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCB1bmRvSW5mbz86IElGaWxlT3BlcmF0aW9uVW5kb1JlZG9JbmZvKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGFbXT4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblxuXHRtb3ZlKG9wZXJhdGlvbnM6IElNb3ZlT3BlcmF0aW9uW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgdW5kb0luZm8/OiBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbyk6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhW10+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cblx0Y29weShvcGVyYXRpb25zOiBJQ29weU9wZXJhdGlvbltdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHVuZG9JbmZvPzogSUZpbGVPcGVyYXRpb25VbmRvUmVkb0luZm8pOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YVtdPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gbW9jazxUPigpOiBDdG9yPFQ+IHtcblx0cmV0dXJuIGZ1bmN0aW9uICgpIHsgfSBhcyBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ3RvcjxUPiB7XG5cdG5ldygpOiBUO1xufVxuXG5leHBvcnQgY2xhc3MgVGVzdEV4dGVuc2lvblNlcnZpY2UgZXh0ZW5kcyBOdWxsRXh0ZW5zaW9uU2VydmljZSB7IH1cblxuZXhwb3J0IGNvbnN0IFRlc3RQcm9kdWN0U2VydmljZSA9IHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCAuLi5wcm9kdWN0IH07XG5cbmV4cG9ydCBjbGFzcyBUZXN0QWN0aXZpdHlTZXJ2aWNlIGltcGxlbWVudHMgSUFjdGl2aXR5U2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0b25EaWRDaGFuZ2VBY3Rpdml0eSA9IEV2ZW50Lk5vbmU7XG5cdGdldFZpZXdDb250YWluZXJBY3Rpdml0aWVzKHZpZXdDb250YWluZXJJZDogc3RyaW5nKTogSUFjdGl2aXR5W10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXHRnZXRBY3Rpdml0eShpZDogc3RyaW5nKTogSUFjdGl2aXR5W10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXHRzaG93Vmlld0NvbnRhaW5lckFjdGl2aXR5KHZpZXdDb250YWluZXJJZDogc3RyaW5nLCBiYWRnZTogSUFjdGl2aXR5KTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cdHNob3dWaWV3QWN0aXZpdHkodmlld0lkOiBzdHJpbmcsIGJhZGdlOiBJQWN0aXZpdHkpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblx0c2hvd0FjY291bnRzQWN0aXZpdHkoYWN0aXZpdHk6IElBY3Rpdml0eSk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXHRzaG93R2xvYmFsQWN0aXZpdHkoYWN0aXZpdHk6IElBY3Rpdml0eSk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGRpc3Bvc2UoKSB7IH1cbn1cblxuZXhwb3J0IGNvbnN0IE51bGxGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUF1dG9TYXZlQ29uZmlndXJhdGlvbiA9IEV2ZW50Lk5vbmU7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQXV0b1NhdmVEaXNhYmxlZCA9IEV2ZW50Lk5vbmU7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVhZG9ubHkgPSBFdmVudC5Ob25lO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbGVzQXNzb2NpYXRpb24gPSBFdmVudC5Ob25lO1xuXG5cdHJlYWRvbmx5IGlzSG90RXhpdEVuYWJsZWQgPSBmYWxzZTtcblx0cmVhZG9ubHkgaG90RXhpdENvbmZpZ3VyYXRpb24gPSB1bmRlZmluZWQ7XG5cblx0Z2V0QXV0b1NhdmVDb25maWd1cmF0aW9uKCk6IElBdXRvU2F2ZUNvbmZpZ3VyYXRpb24geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0QXV0b1NhdmVNb2RlKCk6IElBdXRvU2F2ZU1vZGUgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0aGFzU2hvcnRBdXRvU2F2ZURlbGF5KCk6IGJvb2xlYW4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0dG9nZ2xlQXV0b1NhdmUoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRlbmFibGVBdXRvU2F2ZUFmdGVyU2hvcnREZWxheShyZXNvdXJjZU9yRWRpdG9yOiBVUkkgfCBFZGl0b3JJbnB1dCk6IElEaXNwb3NhYmxlIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGRpc2FibGVBdXRvU2F2ZShyZXNvdXJjZU9yRWRpdG9yOiBVUkkgfCBFZGl0b3JJbnB1dCk6IElEaXNwb3NhYmxlIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGlzUmVhZG9ubHkocmVzb3VyY2U6IFVSSSwgc3RhdD86IElCYXNlRmlsZVN0YXQgfCB1bmRlZmluZWQpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGFzeW5jIHVwZGF0ZVJlYWRvbmx5KHJlc291cmNlOiBVUkksIHJlYWRvbmx5OiBib29sZWFuIHwgJ3RvZ2dsZScgfCAncmVzZXQnKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0cHJldmVudFNhdmVDb25mbGljdHMocmVzb3VyY2U6IFVSSSwgbGFuZ3VhZ2U/OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG59O1xuXG5leHBvcnQgY2xhc3MgVGVzdFdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UgaW1wbGVtZW50cyBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGlzRW5hYmxlZDogYm9vbGVhbiA9IHRydWUpIHsgfVxuXG5cdGlzV29ya3NwYWNlVHJ1c3RFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlzRW5hYmxlZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VUcnVzdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRvbkRpZENoYW5nZVRydXN0ID0gdGhpcy5fb25EaWRDaGFuZ2VUcnVzdC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVRydXN0ZWRGb2xkZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdG9uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnMgPSB0aGlzLl9vbkRpZENoYW5nZVRydXN0ZWRGb2xkZXJzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPblN0YXJ0dXAgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0b25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdE9uU3RhcnR1cCA9IHRoaXMuX29uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPblN0YXJ0dXAuZXZlbnQ7XG5cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHRydXN0ZWQ6IGJvb2xlYW4gPSB0cnVlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRnZXQgYWNjZXB0c091dE9mV29ya3NwYWNlRmlsZXMoKTogYm9vbGVhbiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0c2V0IGFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YWRkV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQocGFydGljaXBhbnQ6IElXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25QYXJ0aWNpcGFudCk6IElEaXNwb3NhYmxlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRnZXRUcnVzdGVkVXJpcygpOiBVUklbXSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0c2V0UGFyZW50Rm9sZGVyVHJ1c3QodHJ1c3RlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGdldFVyaVRydXN0SW5mbyh1cmk6IFVSSSk6IFByb21pc2U8SVdvcmtzcGFjZVRydXN0VXJpSW5mbz4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGFzeW5jIHNldFRydXN0ZWRVcmlzKGZvbGRlcnM6IFVSSVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YXN5bmMgc2V0VXJpc1RydXN0KHVyaXM6IFVSSVtdLCB0cnVzdGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Y2FuU2V0UGFyZW50Rm9sZGVyVHJ1c3QoKTogYm9vbGVhbiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Y2FuU2V0V29ya3NwYWNlVHJ1c3QoKTogYm9vbGVhbiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0aXNXb3Jrc3BhY2VUcnVzdGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnRydXN0ZWQ7XG5cdH1cblxuXHRpc1dvcmtzcGFjZVRydXN0Rm9yY2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldCB3b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG5cdGdldCB3b3Jrc3BhY2VSZXNvbHZlZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRhc3luYyBzZXRXb3Jrc3BhY2VUcnVzdCh0cnVzdGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMudHJ1c3RlZCAhPT0gdHJ1c3RlZCkge1xuXHRcdFx0dGhpcy50cnVzdGVkID0gdHJ1c3RlZDtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVHJ1c3QuZmlyZSh0aGlzLnRydXN0ZWQpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRJbml0aWF0ZU9wZW5GaWxlc1RydXN0UmVxdWVzdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEluaXRpYXRlT3BlbkZpbGVzVHJ1c3RSZXF1ZXN0ID0gdGhpcy5fb25EaWRJbml0aWF0ZU9wZW5GaWxlc1RydXN0UmVxdWVzdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8V29ya3NwYWNlVHJ1c3RSZXF1ZXN0T3B0aW9ucz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QgPSB0aGlzLl9vbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPblN0YXJ0dXAgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdE9uU3RhcnR1cCA9IHRoaXMuX29uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPblN0YXJ0dXAuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfdHJ1c3RlZDogYm9vbGVhbikge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gYXN5bmMgKHVyaXM6IFVSSVtdKSA9PiB7XG5cdFx0cmV0dXJuIFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuT3Blbjtcblx0fTtcblxuXHRyZXF1ZXN0T3BlbkZpbGVzVHJ1c3QodXJpczogVVJJW10pOiBQcm9taXNlPFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2U+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyKHVyaXMpO1xuXHR9XG5cblx0YXN5bmMgY29tcGxldGVPcGVuRmlsZXNUcnVzdFJlcXVlc3QocmVzdWx0OiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLCBzYXZlUmVzcG9uc2U6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRjYW5jZWxXb3Jrc3BhY2VUcnVzdFJlcXVlc3QoKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0YXN5bmMgY29tcGxldGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QodHJ1c3RlZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRhc3luYyByZXF1ZXN0V29ya3NwYWNlVHJ1c3Qob3B0aW9ucz86IFdvcmtzcGFjZVRydXN0UmVxdWVzdE9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5fdHJ1c3RlZDtcblx0fVxuXG5cdHJlcXVlc3RXb3Jrc3BhY2VUcnVzdE9uU3RhcnR1cCgpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RNYXJrZXJTZXJ2aWNlIGltcGxlbWVudHMgSU1hcmtlclNlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRvbk1hcmtlckNoYW5nZWQgPSBFdmVudC5Ob25lO1xuXG5cdGdldFN0YXRpc3RpY3MoKTogTWFya2VyU3RhdGlzdGljcyB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRjaGFuZ2VPbmUob3duZXI6IHN0cmluZywgcmVzb3VyY2U6IFVSSSwgbWFya2VyczogSU1hcmtlckRhdGFbXSk6IHZvaWQgeyB9XG5cdGNoYW5nZUFsbChvd25lcjogc3RyaW5nLCBkYXRhOiBJUmVzb3VyY2VNYXJrZXJbXSk6IHZvaWQgeyB9XG5cdHJlbW92ZShvd25lcjogc3RyaW5nLCByZXNvdXJjZXM6IFVSSVtdKTogdm9pZCB7IH1cblx0cmVhZChmaWx0ZXI/OiB7IG93bmVyPzogc3RyaW5nIHwgdW5kZWZpbmVkOyByZXNvdXJjZT86IFVSSSB8IHVuZGVmaW5lZDsgc2V2ZXJpdGllcz86IG51bWJlciB8IHVuZGVmaW5lZDsgdGFrZT86IG51bWJlciB8IHVuZGVmaW5lZCB9IHwgdW5kZWZpbmVkKTogSU1hcmtlcltdIHsgcmV0dXJuIFtdOyB9XG5cdGluc3RhbGxSZXNvdXJjZUZpbHRlcihyZXNvdXJjZTogVVJJLCByZWFzb246IHN0cmluZyk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4geyBkaXNwb3NlOiAoKSA9PiB7IC8qIFRPRE86IEltcGxlbWVudCBjbGVhbnVwIGxvZ2ljICovIH0gfTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVk7QUFDckIsU0FBUyxVQUFVLFNBQVMsdUJBQXVCO0FBQ25ELFNBQVMsV0FBVztBQUNwQixTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFTLDZCQUE2QjtBQUN0QyxTQUErQyxzQkFBMks7QUFDMU4sU0FBUyxxQkFBcUI7QUFFOUIsU0FBUyxTQUFTLG1CQUFtQjtBQUNyQyxTQUFTLDhCQUFtRDtBQUM1RCxTQUEyQywrQkFBK0I7QUFDMUUsU0FBUyw0QkFBNEI7QUFFckMsU0FBc0Isa0JBQWtCO0FBRXhDLFNBQXVDLGtCQUFtQztBQUUxRSxPQUFPLGFBQWE7QUFHcEIsU0FBUyx1QkFBZ0MsVUFBVSxrQkFBa0I7QUFLckUsU0FBd00saUNBQWlDO0FBSWxPLE1BQU0sMEJBQTBCLHNCQUFzQjtBQUFBLEVBQzVELFlBQVksVUFBZ0I7QUFDM0IsVUFBTSxTQUFTLE1BQU0sWUFBWSxJQUFJLEtBQUssT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLGVBQWUsQ0FBQyxDQUFDO0FBQUEsRUFDcEY7QUFBQSxFQUNVLGlCQUEwQjtBQUFFLFdBQU8sSUFBSSxXQUFXO0FBQUEsRUFBRztBQUNoRTtBQUVPLElBQU0sb0NBQU4sTUFBa0Y7QUFBQSxFQUl4RixZQUN5QyxzQkFDdkM7QUFEdUM7QUFBQSxFQUV6QztBQUFBLEVBRUEsT0FBTyxVQUFlLFVBQTJCO0FBQ2hELFVBQU0sTUFBTSxLQUFLLHFCQUFxQixTQUFTLGFBQWEsRUFBRSxvQkFBb0IsVUFBVSxTQUFTLENBQUM7QUFDdEcsUUFBSSxPQUFPLE9BQU8sUUFBUSxZQUFZLFFBQVEsUUFBUTtBQUNyRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQVEsV0FBVyxjQUFlLE9BQU87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
