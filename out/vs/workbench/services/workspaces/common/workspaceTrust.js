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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { getRemoteAuthority } from "../../../../platform/remote/common/remoteHosts.js";
import { isVirtualResource } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { isSavedWorkspace, isSingleFolderWorkspaceIdentifier, isTemporaryWorkspace, IWorkspaceContextService, toWorkspaceIdentifier, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService, WorkspaceTrustUriResponse, IWorkspaceTrustEnablementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { Memento } from "../../../common/memento.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { isEqualAuthority } from "../../../../base/common/resources.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { promiseWithResolvers } from "../../../../base/common/async.js";
const WORKSPACE_TRUST_ENABLED = "security.workspace.trust.enabled";
const WORKSPACE_TRUST_STARTUP_PROMPT = "security.workspace.trust.startupPrompt";
const WORKSPACE_TRUST_BANNER = "security.workspace.trust.banner";
const WORKSPACE_TRUST_UNTRUSTED_FILES = "security.workspace.trust.untrustedFiles";
const WORKSPACE_TRUST_EMPTY_WINDOW = "security.workspace.trust.emptyWindow";
const WORKSPACE_TRUST_EXTENSION_SUPPORT = "extensions.supportUntrustedWorkspaces";
const WORKSPACE_TRUST_STORAGE_KEY = "content.trust.model.key";
class CanonicalWorkspace {
  constructor(originalWorkspace, canonicalFolderUris, canonicalConfiguration) {
    this.originalWorkspace = originalWorkspace;
    this.canonicalFolderUris = canonicalFolderUris;
    this.canonicalConfiguration = canonicalConfiguration;
  }
  get folders() {
    return this.originalWorkspace.folders.map((folder, index) => {
      return {
        index: folder.index,
        name: folder.name,
        toResource: folder.toResource,
        uri: this.canonicalFolderUris[index]
      };
    });
  }
  get transient() {
    return this.originalWorkspace.transient;
  }
  get configuration() {
    return this.canonicalConfiguration ?? this.originalWorkspace.configuration;
  }
  get id() {
    return this.originalWorkspace.id;
  }
}
let WorkspaceTrustEnablementService = class extends Disposable {
  constructor(configurationService, environmentService) {
    super();
    this.configurationService = configurationService;
    this.environmentService = environmentService;
  }
  isWorkspaceTrustEnabled() {
    if (this.environmentService.disableWorkspaceTrust) {
      return false;
    }
    return !!this.configurationService.getValue(WORKSPACE_TRUST_ENABLED);
  }
};
WorkspaceTrustEnablementService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkbenchEnvironmentService)
], WorkspaceTrustEnablementService);
let WorkspaceTrustManagementService = class extends Disposable {
  constructor(configurationService, remoteAuthorityResolverService, storageService, uriIdentityService, environmentService, workspaceService, workspaceTrustEnablementService, fileService) {
    super();
    this.configurationService = configurationService;
    this.remoteAuthorityResolverService = remoteAuthorityResolverService;
    this.storageService = storageService;
    this.uriIdentityService = uriIdentityService;
    this.environmentService = environmentService;
    this.workspaceService = workspaceService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.fileService = fileService;
    this.storageKey = WORKSPACE_TRUST_STORAGE_KEY;
    this._onDidChangeTrust = this._register(new Emitter());
    this.onDidChangeTrust = this._onDidChangeTrust.event;
    this._onDidChangeTrustedFolders = this._register(new Emitter());
    this.onDidChangeTrustedFolders = this._onDidChangeTrustedFolders.event;
    this._canonicalStartupFiles = [];
    this._canonicalUrisResolved = false;
    this._canonicalWorkspace = this.workspaceService.getWorkspace();
    ({ promise: this._workspaceResolvedPromise, resolve: this._workspaceResolvedPromiseResolve } = promiseWithResolvers());
    ({ promise: this._workspaceTrustInitializedPromise, resolve: this._workspaceTrustInitializedPromiseResolve } = promiseWithResolvers());
    this._storedTrustState = new WorkspaceTrustMemento(isWeb && this.isEmptyWorkspace() ? void 0 : this.storageService);
    this._trustTransitionManager = this._register(new WorkspaceTrustTransitionManager());
    this._trustStateInfo = this.loadTrustInfo();
    this._isTrusted = this.calculateWorkspaceTrust();
    this.initializeWorkspaceTrust();
    this.registerListeners();
  }
  //#region initialize
  initializeWorkspaceTrust() {
    this.resolveCanonicalUris().then(async () => {
      this._canonicalUrisResolved = true;
      await this.updateWorkspaceTrust();
    }).finally(() => {
      this._workspaceResolvedPromiseResolve();
      if (!this.environmentService.remoteAuthority) {
        this._workspaceTrustInitializedPromiseResolve();
      }
    });
    if (this.environmentService.remoteAuthority) {
      this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority).then(async (result) => {
        this._remoteAuthority = result;
        await this.fileService.activateProvider(Schemas.vscodeRemote);
        await this.updateWorkspaceTrust();
      }).finally(() => {
        this._workspaceTrustInitializedPromiseResolve();
      });
    }
    if (this.isEmptyWorkspace()) {
      this._workspaceTrustInitializedPromise.then(() => {
        if (this._storedTrustState.isEmptyWorkspaceTrusted === void 0) {
          this._storedTrustState.isEmptyWorkspaceTrusted = this.isWorkspaceTrusted();
        }
      });
    }
  }
  //#endregion
  //#region private interface
  registerListeners() {
    this._register(this.workspaceService.onDidChangeWorkspaceFolders(async () => await this.updateWorkspaceTrust()));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, this.storageKey, this._store)(async () => {
      if (JSON.stringify(this._trustStateInfo) !== JSON.stringify(this.loadTrustInfo())) {
        this._trustStateInfo = this.loadTrustInfo();
        this._onDidChangeTrustedFolders.fire();
        await this.updateWorkspaceTrust();
      }
    }));
  }
  async getCanonicalUri(uri) {
    let canonicalUri = uri;
    if (this.environmentService.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {
      canonicalUri = await this.remoteAuthorityResolverService.getCanonicalURI(uri);
    } else if (uri.scheme === "vscode-vfs") {
      const index = uri.authority.indexOf("+");
      if (index !== -1) {
        canonicalUri = uri.with({ authority: uri.authority.substr(0, index) });
      }
    }
    return canonicalUri.with({ query: null, fragment: null });
  }
  async resolveCanonicalUris() {
    const filesToOpen = [];
    if (this.environmentService.filesToOpenOrCreate) {
      filesToOpen.push(...this.environmentService.filesToOpenOrCreate);
    }
    if (this.environmentService.filesToDiff) {
      filesToOpen.push(...this.environmentService.filesToDiff);
    }
    if (this.environmentService.filesToMerge) {
      filesToOpen.push(...this.environmentService.filesToMerge);
    }
    if (filesToOpen.length) {
      const filesToOpenOrCreateUris = filesToOpen.filter((f) => !!f.fileUri).map((f) => f.fileUri);
      const canonicalFilesToOpen = await Promise.all(filesToOpenOrCreateUris.map((uri) => this.getCanonicalUri(uri)));
      this._canonicalStartupFiles.push(...canonicalFilesToOpen.filter((uri) => this._canonicalStartupFiles.every((u) => !this.uriIdentityService.extUri.isEqual(uri, u))));
    }
    const workspaceUris = this.workspaceService.getWorkspace().folders.map((f) => f.uri);
    const canonicalWorkspaceFolders = await Promise.all(workspaceUris.map((uri) => this.getCanonicalUri(uri)));
    let canonicalWorkspaceConfiguration = this.workspaceService.getWorkspace().configuration;
    if (canonicalWorkspaceConfiguration && isSavedWorkspace(canonicalWorkspaceConfiguration, this.environmentService)) {
      canonicalWorkspaceConfiguration = await this.getCanonicalUri(canonicalWorkspaceConfiguration);
    }
    this._canonicalWorkspace = new CanonicalWorkspace(this.workspaceService.getWorkspace(), canonicalWorkspaceFolders, canonicalWorkspaceConfiguration);
  }
  loadTrustInfo() {
    const infoAsString = this.storageService.get(this.storageKey, StorageScope.APPLICATION);
    let result;
    try {
      if (infoAsString) {
        result = JSON.parse(infoAsString);
      }
    } catch {
    }
    if (!result) {
      result = {
        uriTrustInfo: []
      };
    }
    if (!result.uriTrustInfo) {
      result.uriTrustInfo = [];
    }
    result.uriTrustInfo = result.uriTrustInfo.map((info) => {
      return { uri: URI.revive(info.uri), trusted: info.trusted };
    });
    result.uriTrustInfo = result.uriTrustInfo.filter((info) => info.trusted);
    return result;
  }
  async saveTrustInfo() {
    this.storageService.store(this.storageKey, JSON.stringify(this._trustStateInfo), StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._onDidChangeTrustedFolders.fire();
    await this.updateWorkspaceTrust();
  }
  getWorkspaceUris() {
    const workspaceUris = this._canonicalWorkspace.folders.map((f) => f.uri);
    const workspaceConfiguration = this._canonicalWorkspace.configuration;
    if (workspaceConfiguration && isSavedWorkspace(workspaceConfiguration, this.environmentService)) {
      workspaceUris.push(workspaceConfiguration);
    }
    return workspaceUris;
  }
  calculateWorkspaceTrust() {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      return true;
    }
    if (!this._canonicalUrisResolved) {
      return false;
    }
    if (this.environmentService.remoteAuthority && this._remoteAuthority?.options?.isTrusted) {
      return this._remoteAuthority.options.isTrusted;
    }
    if (this.isEmptyWorkspace()) {
      if (this._storedTrustState.isEmptyWorkspaceTrusted !== void 0) {
        return this._storedTrustState.isEmptyWorkspaceTrusted;
      }
      if (this._canonicalStartupFiles.length) {
        return this.getUrisTrust(this._canonicalStartupFiles);
      }
      return !!this.configurationService.getValue(WORKSPACE_TRUST_EMPTY_WINDOW);
    }
    return this.getUrisTrust(this.getWorkspaceUris());
  }
  async updateWorkspaceTrust(trusted) {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      return;
    }
    if (trusted === void 0) {
      await this.resolveCanonicalUris();
      trusted = this.calculateWorkspaceTrust();
    }
    if (this.isWorkspaceTrusted() === trusted) {
      return;
    }
    this.isTrusted = trusted;
    await this._trustTransitionManager.participate(trusted);
    this._onDidChangeTrust.fire(trusted);
  }
  getUrisTrust(uris) {
    let state = true;
    for (const uri of uris) {
      const { trusted } = this.doGetUriTrustInfo(uri);
      if (!trusted) {
        state = trusted;
        return state;
      }
    }
    return state;
  }
  doGetUriTrustInfo(uri) {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      return { trusted: true, uri };
    }
    if (this.isTrustedVirtualResource(uri)) {
      return { trusted: true, uri };
    }
    if (this.isTrustedByRemote(uri)) {
      return { trusted: true, uri };
    }
    let resultState = false;
    let maxLength = -1;
    let resultUri = uri;
    for (const trustInfo of this._trustStateInfo.uriTrustInfo) {
      if (this.uriIdentityService.extUri.isEqualOrParent(uri, trustInfo.uri)) {
        const fsPath = trustInfo.uri.fsPath;
        if (fsPath.length > maxLength) {
          maxLength = fsPath.length;
          resultState = trustInfo.trusted;
          resultUri = trustInfo.uri;
        }
      }
    }
    return { trusted: resultState, uri: resultUri };
  }
  async doSetUrisTrust(uris, trusted) {
    let changed = false;
    for (const uri of uris) {
      if (trusted) {
        if (this.isTrustedVirtualResource(uri)) {
          continue;
        }
        if (this.isTrustedByRemote(uri)) {
          continue;
        }
        const foundItem = this._trustStateInfo.uriTrustInfo.find((trustInfo) => this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
        if (!foundItem) {
          this._trustStateInfo.uriTrustInfo.push({ uri, trusted: true });
          changed = true;
        }
      } else {
        const previousLength = this._trustStateInfo.uriTrustInfo.length;
        this._trustStateInfo.uriTrustInfo = this._trustStateInfo.uriTrustInfo.filter((trustInfo) => !this.uriIdentityService.extUri.isEqual(trustInfo.uri, uri));
        if (previousLength !== this._trustStateInfo.uriTrustInfo.length) {
          changed = true;
        }
      }
    }
    if (changed) {
      await this.saveTrustInfo();
    }
  }
  isEmptyWorkspace() {
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return true;
    }
    const workspace = this.workspaceService.getWorkspace();
    if (workspace) {
      return isTemporaryWorkspace(this.workspaceService.getWorkspace()) && workspace.folders.length === 0;
    }
    return false;
  }
  isTrustedVirtualResource(uri) {
    return isVirtualResource(uri) && uri.scheme !== "vscode-vfs";
  }
  isTrustedByRemote(uri) {
    if (!this.environmentService.remoteAuthority) {
      return false;
    }
    if (!this._remoteAuthority) {
      return false;
    }
    return isEqualAuthority(getRemoteAuthority(uri), this._remoteAuthority.authority.authority) && !!this._remoteAuthority.options?.isTrusted;
  }
  set isTrusted(value) {
    this._isTrusted = value;
    if (!value) {
      this._storedTrustState.acceptsOutOfWorkspaceFiles = false;
    }
    if (this.isEmptyWorkspace()) {
      this._storedTrustState.isEmptyWorkspaceTrusted = value;
    }
  }
  //#endregion
  //#region public interface
  get workspaceResolved() {
    return this._workspaceResolvedPromise;
  }
  get workspaceTrustInitialized() {
    return this._workspaceTrustInitializedPromise;
  }
  get acceptsOutOfWorkspaceFiles() {
    return this._storedTrustState.acceptsOutOfWorkspaceFiles;
  }
  set acceptsOutOfWorkspaceFiles(value) {
    this._storedTrustState.acceptsOutOfWorkspaceFiles = value;
  }
  isWorkspaceTrusted() {
    return this._isTrusted;
  }
  isWorkspaceTrustForced() {
    if (this.environmentService.remoteAuthority && this._remoteAuthority && this._remoteAuthority.options?.isTrusted !== void 0) {
      return true;
    }
    const workspaceUris = this.getWorkspaceUris().filter((uri) => !this.isTrustedVirtualResource(uri));
    if (workspaceUris.length === 0) {
      return true;
    }
    return false;
  }
  canSetParentFolderTrust() {
    const workspaceIdentifier = toWorkspaceIdentifier(this._canonicalWorkspace);
    if (!isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
      return false;
    }
    if (workspaceIdentifier.uri.scheme !== Schemas.file && workspaceIdentifier.uri.scheme !== Schemas.vscodeRemote) {
      return false;
    }
    const parentFolder = this.uriIdentityService.extUri.dirname(workspaceIdentifier.uri);
    if (this.uriIdentityService.extUri.isEqual(workspaceIdentifier.uri, parentFolder)) {
      return false;
    }
    return true;
  }
  async setParentFolderTrust(trusted) {
    if (this.canSetParentFolderTrust()) {
      const workspaceUri = toWorkspaceIdentifier(this._canonicalWorkspace).uri;
      const parentFolder = this.uriIdentityService.extUri.dirname(workspaceUri);
      await this.setUrisTrust([parentFolder], trusted);
    }
  }
  canSetWorkspaceTrust() {
    if (this.environmentService.remoteAuthority && (!this._remoteAuthority || this._remoteAuthority.options?.isTrusted !== void 0)) {
      return false;
    }
    if (this.isEmptyWorkspace()) {
      return true;
    }
    const workspaceUris = this.getWorkspaceUris().filter((uri) => !this.isTrustedVirtualResource(uri));
    if (workspaceUris.length === 0) {
      return false;
    }
    if (!this.isWorkspaceTrusted()) {
      return true;
    }
    const workspaceIdentifier = toWorkspaceIdentifier(this._canonicalWorkspace);
    if (!isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
      return false;
    }
    if (workspaceIdentifier.uri.scheme !== Schemas.file && workspaceIdentifier.uri.scheme !== "vscode-vfs") {
      return false;
    }
    const trustInfo = this.doGetUriTrustInfo(workspaceIdentifier.uri);
    if (!trustInfo.trusted || !this.uriIdentityService.extUri.isEqual(workspaceIdentifier.uri, trustInfo.uri)) {
      return false;
    }
    if (this.canSetParentFolderTrust()) {
      const parentFolder = this.uriIdentityService.extUri.dirname(workspaceIdentifier.uri);
      const parentPathTrustInfo = this.doGetUriTrustInfo(parentFolder);
      if (parentPathTrustInfo.trusted) {
        return false;
      }
    }
    return true;
  }
  async setWorkspaceTrust(trusted) {
    if (this.isEmptyWorkspace()) {
      await this.updateWorkspaceTrust(trusted);
      return;
    }
    const workspaceFolders = this.getWorkspaceUris();
    await this.setUrisTrust(workspaceFolders, trusted);
  }
  async getUriTrustInfo(uri) {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      return { trusted: true, uri };
    }
    if (this.isTrustedByRemote(uri)) {
      return { trusted: true, uri };
    }
    return this.doGetUriTrustInfo(await this.getCanonicalUri(uri));
  }
  async setUrisTrust(uris, trusted) {
    this.doSetUrisTrust(await Promise.all(uris.map((uri) => this.getCanonicalUri(uri))), trusted);
  }
  getTrustedUris() {
    return this._trustStateInfo.uriTrustInfo.map((info) => info.uri);
  }
  async setTrustedUris(uris) {
    this._trustStateInfo.uriTrustInfo = [];
    for (const uri of uris) {
      const canonicalUri = await this.getCanonicalUri(uri);
      const cleanUri = this.uriIdentityService.extUri.removeTrailingPathSeparator(canonicalUri);
      let added = false;
      for (const addedUri of this._trustStateInfo.uriTrustInfo) {
        if (this.uriIdentityService.extUri.isEqual(addedUri.uri, cleanUri)) {
          added = true;
          break;
        }
      }
      if (added) {
        continue;
      }
      this._trustStateInfo.uriTrustInfo.push({
        trusted: true,
        uri: cleanUri
      });
    }
    await this.saveTrustInfo();
  }
  addWorkspaceTrustTransitionParticipant(participant) {
    return this._trustTransitionManager.addWorkspaceTrustTransitionParticipant(participant);
  }
  //#endregion
};
WorkspaceTrustManagementService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IRemoteAuthorityResolverService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IWorkspaceTrustEnablementService),
  __decorateParam(7, IFileService)
], WorkspaceTrustManagementService);
let WorkspaceTrustRequestService = class extends Disposable {
  constructor(configurationService, workspaceTrustManagementService) {
    super();
    this.configurationService = configurationService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this._onDidInitiateOpenFilesTrustRequest = this._register(new Emitter());
    this.onDidInitiateOpenFilesTrustRequest = this._onDidInitiateOpenFilesTrustRequest.event;
    this._onDidInitiateWorkspaceTrustRequest = this._register(new Emitter());
    this.onDidInitiateWorkspaceTrustRequest = this._onDidInitiateWorkspaceTrustRequest.event;
    this._onDidInitiateWorkspaceTrustRequestOnStartup = this._register(new Emitter());
    this.onDidInitiateWorkspaceTrustRequestOnStartup = this._onDidInitiateWorkspaceTrustRequestOnStartup.event;
  }
  //#region Open file(s) trust request
  get untrustedFilesSetting() {
    return this.configurationService.getValue(WORKSPACE_TRUST_UNTRUSTED_FILES);
  }
  set untrustedFilesSetting(value) {
    this.configurationService.updateValue(WORKSPACE_TRUST_UNTRUSTED_FILES, value);
  }
  async completeOpenFilesTrustRequest(result, saveResponse) {
    if (!this._openFilesTrustRequestResolver) {
      return;
    }
    if (result === WorkspaceTrustUriResponse.Open) {
      this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles = true;
    }
    if (saveResponse) {
      if (result === WorkspaceTrustUriResponse.Open) {
        this.untrustedFilesSetting = "open";
      }
      if (result === WorkspaceTrustUriResponse.OpenInNewWindow) {
        this.untrustedFilesSetting = "newWindow";
      }
    }
    this._openFilesTrustRequestResolver(result);
    this._openFilesTrustRequestResolver = void 0;
    this._openFilesTrustRequestPromise = void 0;
  }
  async requestOpenFilesTrust(uris) {
    if (!this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      return WorkspaceTrustUriResponse.Open;
    }
    const openFilesTrustInfo = await Promise.all(uris.map((uri) => this.workspaceTrustManagementService.getUriTrustInfo(uri)));
    if (openFilesTrustInfo.map((info) => info.trusted).every((trusted) => trusted)) {
      return WorkspaceTrustUriResponse.Open;
    }
    if (this.untrustedFilesSetting !== "prompt") {
      if (this.untrustedFilesSetting === "newWindow") {
        return WorkspaceTrustUriResponse.OpenInNewWindow;
      }
      if (this.untrustedFilesSetting === "open") {
        return WorkspaceTrustUriResponse.Open;
      }
    }
    if (this.workspaceTrustManagementService.acceptsOutOfWorkspaceFiles) {
      return WorkspaceTrustUriResponse.Open;
    }
    if (!this._openFilesTrustRequestPromise) {
      this._openFilesTrustRequestPromise = new Promise((resolve) => {
        this._openFilesTrustRequestResolver = resolve;
      });
    } else {
      return this._openFilesTrustRequestPromise;
    }
    this._onDidInitiateOpenFilesTrustRequest.fire();
    return this._openFilesTrustRequestPromise;
  }
  //#endregion
  //#region Workspace trust request
  resolveWorkspaceTrustRequest(trusted) {
    if (this._workspaceTrustRequestResolver) {
      this._workspaceTrustRequestResolver(trusted ?? this.workspaceTrustManagementService.isWorkspaceTrusted());
      this._workspaceTrustRequestResolver = void 0;
      this._workspaceTrustRequestPromise = void 0;
    }
  }
  cancelWorkspaceTrustRequest() {
    if (this._workspaceTrustRequestResolver) {
      this._workspaceTrustRequestResolver(void 0);
      this._workspaceTrustRequestResolver = void 0;
      this._workspaceTrustRequestPromise = void 0;
    }
  }
  async completeWorkspaceTrustRequest(trusted) {
    if (trusted === void 0 || trusted === this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      this.resolveWorkspaceTrustRequest(trusted);
      return;
    }
    Event.once(this.workspaceTrustManagementService.onDidChangeTrust)((trusted2) => this.resolveWorkspaceTrustRequest(trusted2));
    await this.workspaceTrustManagementService.setWorkspaceTrust(trusted);
  }
  async requestWorkspaceTrust(options) {
    if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      return this.workspaceTrustManagementService.isWorkspaceTrusted();
    }
    if (!this._workspaceTrustRequestPromise) {
      this._workspaceTrustRequestPromise = new Promise((resolve) => {
        this._workspaceTrustRequestResolver = resolve;
      });
    } else {
      return this._workspaceTrustRequestPromise;
    }
    this._onDidInitiateWorkspaceTrustRequest.fire(options);
    return this._workspaceTrustRequestPromise;
  }
  requestWorkspaceTrustOnStartup() {
    if (!this._workspaceTrustRequestPromise) {
      this._workspaceTrustRequestPromise = new Promise((resolve) => {
        this._workspaceTrustRequestResolver = resolve;
      });
    }
    this._onDidInitiateWorkspaceTrustRequestOnStartup.fire();
  }
  //#endregion
};
WorkspaceTrustRequestService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IWorkspaceTrustManagementService)
], WorkspaceTrustRequestService);
class WorkspaceTrustTransitionManager extends Disposable {
  constructor() {
    super(...arguments);
    this.participants = new LinkedList();
  }
  addWorkspaceTrustTransitionParticipant(participant) {
    const remove = this.participants.push(participant);
    return toDisposable(() => remove());
  }
  async participate(trusted) {
    for (const participant of this.participants) {
      await participant.participate(trusted);
    }
  }
  dispose() {
    this.participants.clear();
    super.dispose();
  }
}
class WorkspaceTrustMemento {
  constructor(storageService) {
    this._acceptsOutOfWorkspaceFilesKey = "acceptsOutOfWorkspaceFiles";
    this._isEmptyWorkspaceTrustedKey = "isEmptyWorkspaceTrusted";
    if (storageService) {
      this._memento = new Memento("workspaceTrust", storageService);
      this._mementoObject = this._memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this._mementoObject = {};
    }
  }
  get acceptsOutOfWorkspaceFiles() {
    return this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] ?? false;
  }
  set acceptsOutOfWorkspaceFiles(value) {
    this._mementoObject[this._acceptsOutOfWorkspaceFilesKey] = value;
    this._memento?.saveMemento();
  }
  get isEmptyWorkspaceTrusted() {
    return this._mementoObject[this._isEmptyWorkspaceTrustedKey];
  }
  set isEmptyWorkspaceTrusted(value) {
    this._mementoObject[this._isEmptyWorkspaceTrustedKey] = value;
    this._memento?.saveMemento();
  }
}
registerSingleton(IWorkspaceTrustRequestService, WorkspaceTrustRequestService, InstantiationType.Delayed);
export {
  CanonicalWorkspace,
  WORKSPACE_TRUST_BANNER,
  WORKSPACE_TRUST_EMPTY_WINDOW,
  WORKSPACE_TRUST_ENABLED,
  WORKSPACE_TRUST_EXTENSION_SUPPORT,
  WORKSPACE_TRUST_STARTUP_PROMPT,
  WORKSPACE_TRUST_STORAGE_KEY,
  WORKSPACE_TRUST_UNTRUSTED_FILES,
  WorkspaceTrustEnablementService,
  WorkspaceTrustManagementService,
  WorkspaceTrustRequestService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlVHJ1c3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZExpc3QuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsIFJlc29sdmVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBnZXRSZW1vdGVBdXRob3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IGlzVmlydHVhbFJlc291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi92aXJ0dWFsV29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgaXNTYXZlZFdvcmtzcGFjZSwgaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBpc1RlbXBvcmFyeVdvcmtzcGFjZSwgSVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCB0b1dvcmtzcGFjZUlkZW50aWZpZXIsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T3B0aW9ucywgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdEluZm8sIElXb3Jrc3BhY2VUcnVzdFVyaUluZm8sIElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBJV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQsIFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UsIElXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBNZW1lbnRvLCBNZW1lbnRvT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21lbWVudG8uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsQXV0aG9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHByb21pc2VXaXRoUmVzb2x2ZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuXG5leHBvcnQgY29uc3QgV09SS1NQQUNFX1RSVVNUX0VOQUJMRUQgPSAnc2VjdXJpdHkud29ya3NwYWNlLnRydXN0LmVuYWJsZWQnO1xuZXhwb3J0IGNvbnN0IFdPUktTUEFDRV9UUlVTVF9TVEFSVFVQX1BST01QVCA9ICdzZWN1cml0eS53b3Jrc3BhY2UudHJ1c3Quc3RhcnR1cFByb21wdCc7XG5leHBvcnQgY29uc3QgV09SS1NQQUNFX1RSVVNUX0JBTk5FUiA9ICdzZWN1cml0eS53b3Jrc3BhY2UudHJ1c3QuYmFubmVyJztcbmV4cG9ydCBjb25zdCBXT1JLU1BBQ0VfVFJVU1RfVU5UUlVTVEVEX0ZJTEVTID0gJ3NlY3VyaXR5LndvcmtzcGFjZS50cnVzdC51bnRydXN0ZWRGaWxlcyc7XG5leHBvcnQgY29uc3QgV09SS1NQQUNFX1RSVVNUX0VNUFRZX1dJTkRPVyA9ICdzZWN1cml0eS53b3Jrc3BhY2UudHJ1c3QuZW1wdHlXaW5kb3cnO1xuZXhwb3J0IGNvbnN0IFdPUktTUEFDRV9UUlVTVF9FWFRFTlNJT05fU1VQUE9SVCA9ICdleHRlbnNpb25zLnN1cHBvcnRVbnRydXN0ZWRXb3Jrc3BhY2VzJztcbmV4cG9ydCBjb25zdCBXT1JLU1BBQ0VfVFJVU1RfU1RPUkFHRV9LRVkgPSAnY29udGVudC50cnVzdC5tb2RlbC5rZXknO1xuXG5leHBvcnQgY2xhc3MgQ2Fub25pY2FsV29ya3NwYWNlIGltcGxlbWVudHMgSVdvcmtzcGFjZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3JpZ2luYWxXb3Jrc3BhY2U6IElXb3Jrc3BhY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjYW5vbmljYWxGb2xkZXJVcmlzOiBVUklbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNhbm9uaWNhbENvbmZpZ3VyYXRpb246IFVSSSB8IG51bGwgfCB1bmRlZmluZWRcblx0KSB7IH1cblxuXG5cdGdldCBmb2xkZXJzKCk6IElXb3Jrc3BhY2VGb2xkZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMub3JpZ2luYWxXb3Jrc3BhY2UuZm9sZGVycy5tYXAoKGZvbGRlciwgaW5kZXgpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGluZGV4OiBmb2xkZXIuaW5kZXgsXG5cdFx0XHRcdG5hbWU6IGZvbGRlci5uYW1lLFxuXHRcdFx0XHR0b1Jlc291cmNlOiBmb2xkZXIudG9SZXNvdXJjZSxcblx0XHRcdFx0dXJpOiB0aGlzLmNhbm9uaWNhbEZvbGRlclVyaXNbaW5kZXhdXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0IHRyYW5zaWVudCgpOiBib29sZWFuIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5vcmlnaW5hbFdvcmtzcGFjZS50cmFuc2llbnQ7XG5cdH1cblxuXHRnZXQgY29uZmlndXJhdGlvbigpOiBVUkkgfCBudWxsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jYW5vbmljYWxDb25maWd1cmF0aW9uID8/IHRoaXMub3JpZ2luYWxXb3Jrc3BhY2UuY29uZmlndXJhdGlvbjtcblx0fVxuXG5cdGdldCBpZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLm9yaWdpbmFsV29ya3NwYWNlLmlkO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlIHtcblxuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGlzV29ya3NwYWNlVHJ1c3RFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5kaXNhYmxlV29ya3NwYWNlVHJ1c3QpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gISF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFdPUktTUEFDRV9UUlVTVF9FTkFCTEVEKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZUtleSA9IFdPUktTUEFDRV9UUlVTVF9TVE9SQUdFX0tFWTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VSZXNvbHZlZFByb21pc2U6IFByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVJlc29sdmVkUHJvbWlzZVJlc29sdmU6ICgpID0+IHZvaWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWRQcm9taXNlOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkUHJvbWlzZVJlc29sdmU6ICgpID0+IHZvaWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VUcnVzdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPGJvb2xlYW4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVRydXN0ID0gdGhpcy5fb25EaWRDaGFuZ2VUcnVzdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRydXN0ZWRGb2xkZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnMgPSB0aGlzLl9vbkRpZENoYW5nZVRydXN0ZWRGb2xkZXJzLmV2ZW50O1xuXG5cdHByaXZhdGUgX2Nhbm9uaWNhbFN0YXJ0dXBGaWxlczogVVJJW10gPSBbXTtcblx0cHJpdmF0ZSBfY2Fub25pY2FsV29ya3NwYWNlOiBJV29ya3NwYWNlO1xuXHRwcml2YXRlIF9jYW5vbmljYWxVcmlzUmVzb2x2ZWQ6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfaXNUcnVzdGVkOiBib29sZWFuO1xuXHRwcml2YXRlIF90cnVzdFN0YXRlSW5mbzogSVdvcmtzcGFjZVRydXN0SW5mbztcblx0cHJpdmF0ZSBfcmVtb3RlQXV0aG9yaXR5OiBSZXNvbHZlclJlc3VsdCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yZWRUcnVzdFN0YXRlOiBXb3Jrc3BhY2VUcnVzdE1lbWVudG87XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RydXN0VHJhbnNpdGlvbk1hbmFnZXI6IFdvcmtzcGFjZVRydXN0VHJhbnNpdGlvbk1hbmFnZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY2Fub25pY2FsVXJpc1Jlc29sdmVkID0gZmFsc2U7XG5cdFx0dGhpcy5fY2Fub25pY2FsV29ya3NwYWNlID0gdGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXG5cdFx0KHsgcHJvbWlzZTogdGhpcy5fd29ya3NwYWNlUmVzb2x2ZWRQcm9taXNlLCByZXNvbHZlOiB0aGlzLl93b3Jrc3BhY2VSZXNvbHZlZFByb21pc2VSZXNvbHZlIH0gPSBwcm9taXNlV2l0aFJlc29sdmVycygpKTtcblx0XHQoeyBwcm9taXNlOiB0aGlzLl93b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkUHJvbWlzZSwgcmVzb2x2ZTogdGhpcy5fd29ya3NwYWNlVHJ1c3RJbml0aWFsaXplZFByb21pc2VSZXNvbHZlIH0gPSBwcm9taXNlV2l0aFJlc29sdmVycygpKTtcblxuXHRcdHRoaXMuX3N0b3JlZFRydXN0U3RhdGUgPSBuZXcgV29ya3NwYWNlVHJ1c3RNZW1lbnRvKGlzV2ViICYmIHRoaXMuaXNFbXB0eVdvcmtzcGFjZSgpID8gdW5kZWZpbmVkIDogdGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0dGhpcy5fdHJ1c3RUcmFuc2l0aW9uTWFuYWdlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25NYW5hZ2VyKCkpO1xuXG5cdFx0dGhpcy5fdHJ1c3RTdGF0ZUluZm8gPSB0aGlzLmxvYWRUcnVzdEluZm8oKTtcblx0XHR0aGlzLl9pc1RydXN0ZWQgPSB0aGlzLmNhbGN1bGF0ZVdvcmtzcGFjZVRydXN0KCk7XG5cblx0XHR0aGlzLmluaXRpYWxpemVXb3Jrc3BhY2VUcnVzdCgpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBpbml0aWFsaXplXG5cblx0cHJpdmF0ZSBpbml0aWFsaXplV29ya3NwYWNlVHJ1c3QoKTogdm9pZCB7XG5cdFx0Ly8gUmVzb2x2ZSBjYW5vbmljYWwgVXJpc1xuXHRcdHRoaXMucmVzb2x2ZUNhbm9uaWNhbFVyaXMoKVxuXHRcdFx0LnRoZW4oYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jYW5vbmljYWxVcmlzUmVzb2x2ZWQgPSB0cnVlO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZVdvcmtzcGFjZVRydXN0KCk7XG5cdFx0XHR9KVxuXHRcdFx0LmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl93b3Jrc3BhY2VSZXNvbHZlZFByb21pc2VSZXNvbHZlKCk7XG5cblx0XHRcdFx0aWYgKCF0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkUHJvbWlzZVJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHQvLyBSZW1vdGUgLSByZXNvbHZlIHJlbW90ZSBhdXRob3JpdHlcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHR0aGlzLnJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5yZXNvbHZlQXV0aG9yaXR5KHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSlcblx0XHRcdFx0LnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcblx0XHRcdFx0XHR0aGlzLl9yZW1vdGVBdXRob3JpdHkgPSByZXN1bHQ7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5hY3RpdmF0ZVByb3ZpZGVyKFNjaGVtYXMudnNjb2RlUmVtb3RlKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZVdvcmtzcGFjZVRydXN0KCk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdEluaXRpYWxpemVkUHJvbWlzZVJlc29sdmUoKTtcblx0XHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gRW1wdHkgd29ya3NwYWNlIC0gc2F2ZSBpbml0aWFsIHN0YXRlIHRvIG1lbWVudG9cblx0XHRpZiAodGhpcy5pc0VtcHR5V29ya3NwYWNlKCkpIHtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWRQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fc3RvcmVkVHJ1c3RTdGF0ZS5pc0VtcHR5V29ya3NwYWNlVHJ1c3RlZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fc3RvcmVkVHJ1c3RTdGF0ZS5pc0VtcHR5V29ya3NwYWNlVHJ1c3RlZCA9IHRoaXMuaXNXb3Jrc3BhY2VUcnVzdGVkKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBwcml2YXRlIGludGVyZmFjZVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycyhhc3luYyAoKSA9PiBhd2FpdCB0aGlzLnVwZGF0ZVdvcmtzcGFjZVRydXN0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCB0aGlzLnN0b3JhZ2VLZXksIHRoaXMuX3N0b3JlKShhc3luYyAoKSA9PiB7XG5cdFx0XHQvKiBUaGlzIHdpbGwgb25seSBleGVjdXRlIGlmIHN0b3JhZ2Ugd2FzIGNoYW5nZWQgYnkgYSB1c2VyIGFjdGlvbiBpbiBhIHNlcGFyYXRlIHdpbmRvdyAqL1xuXHRcdFx0aWYgKEpTT04uc3RyaW5naWZ5KHRoaXMuX3RydXN0U3RhdGVJbmZvKSAhPT0gSlNPTi5zdHJpbmdpZnkodGhpcy5sb2FkVHJ1c3RJbmZvKCkpKSB7XG5cdFx0XHRcdHRoaXMuX3RydXN0U3RhdGVJbmZvID0gdGhpcy5sb2FkVHJ1c3RJbmZvKCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnMuZmlyZSgpO1xuXG5cdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlV29ya3NwYWNlVHJ1c3QoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldENhbm9uaWNhbFVyaSh1cmk6IFVSSSk6IFByb21pc2U8VVJJPiB7XG5cdFx0bGV0IGNhbm9uaWNhbFVyaSA9IHVyaTtcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmIHVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlKSB7XG5cdFx0XHRjYW5vbmljYWxVcmkgPSBhd2FpdCB0aGlzLnJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5nZXRDYW5vbmljYWxVUkkodXJpKTtcblx0XHR9IGVsc2UgaWYgKHVyaS5zY2hlbWUgPT09ICd2c2NvZGUtdmZzJykge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB1cmkuYXV0aG9yaXR5LmluZGV4T2YoJysnKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0Y2Fub25pY2FsVXJpID0gdXJpLndpdGgoeyBhdXRob3JpdHk6IHVyaS5hdXRob3JpdHkuc3Vic3RyKDAsIGluZGV4KSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBpZ25vcmUgcXVlcnkgYW5kIGZyYWdlbnQgc2VjdGlvbiBvZiB1cmlzIGFsd2F5c1xuXHRcdHJldHVybiBjYW5vbmljYWxVcmkud2l0aCh7IHF1ZXJ5OiBudWxsLCBmcmFnbWVudDogbnVsbCB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUNhbm9uaWNhbFVyaXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gT3BlbiBlZGl0b3JzXG5cdFx0Y29uc3QgZmlsZXNUb09wZW46IElQYXRoW10gPSBbXTtcblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZmlsZXNUb09wZW5PckNyZWF0ZSkge1xuXHRcdFx0ZmlsZXNUb09wZW4ucHVzaCguLi50aGlzLmVudmlyb25tZW50U2VydmljZS5maWxlc1RvT3Blbk9yQ3JlYXRlKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZmlsZXNUb0RpZmYpIHtcblx0XHRcdGZpbGVzVG9PcGVuLnB1c2goLi4udGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZmlsZXNUb0RpZmYpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5maWxlc1RvTWVyZ2UpIHtcblx0XHRcdGZpbGVzVG9PcGVuLnB1c2goLi4udGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZmlsZXNUb01lcmdlKTtcblx0XHR9XG5cblx0XHRpZiAoZmlsZXNUb09wZW4ubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBmaWxlc1RvT3Blbk9yQ3JlYXRlVXJpcyA9IGZpbGVzVG9PcGVuLmZpbHRlcihmID0+ICEhZi5maWxlVXJpKS5tYXAoZiA9PiBmLmZpbGVVcmkhKTtcblx0XHRcdGNvbnN0IGNhbm9uaWNhbEZpbGVzVG9PcGVuID0gYXdhaXQgUHJvbWlzZS5hbGwoZmlsZXNUb09wZW5PckNyZWF0ZVVyaXMubWFwKHVyaSA9PiB0aGlzLmdldENhbm9uaWNhbFVyaSh1cmkpKSk7XG5cblx0XHRcdHRoaXMuX2Nhbm9uaWNhbFN0YXJ0dXBGaWxlcy5wdXNoKC4uLmNhbm9uaWNhbEZpbGVzVG9PcGVuLmZpbHRlcih1cmkgPT4gdGhpcy5fY2Fub25pY2FsU3RhcnR1cEZpbGVzLmV2ZXJ5KHUgPT4gIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHVyaSwgdSkpKSk7XG5cdFx0fVxuXG5cdFx0Ly8gV29ya3NwYWNlXG5cdFx0Y29uc3Qgd29ya3NwYWNlVXJpcyA9IHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLm1hcChmID0+IGYudXJpKTtcblx0XHRjb25zdCBjYW5vbmljYWxXb3Jrc3BhY2VGb2xkZXJzID0gYXdhaXQgUHJvbWlzZS5hbGwod29ya3NwYWNlVXJpcy5tYXAodXJpID0+IHRoaXMuZ2V0Q2Fub25pY2FsVXJpKHVyaSkpKTtcblxuXHRcdGxldCBjYW5vbmljYWxXb3Jrc3BhY2VDb25maWd1cmF0aW9uID0gdGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmNvbmZpZ3VyYXRpb247XG5cdFx0aWYgKGNhbm9uaWNhbFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gJiYgaXNTYXZlZFdvcmtzcGFjZShjYW5vbmljYWxXb3Jrc3BhY2VDb25maWd1cmF0aW9uLCB0aGlzLmVudmlyb25tZW50U2VydmljZSkpIHtcblx0XHRcdGNhbm9uaWNhbFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSBhd2FpdCB0aGlzLmdldENhbm9uaWNhbFVyaShjYW5vbmljYWxXb3Jrc3BhY2VDb25maWd1cmF0aW9uKTtcblx0XHR9XG5cblx0XHR0aGlzLl9jYW5vbmljYWxXb3Jrc3BhY2UgPSBuZXcgQ2Fub25pY2FsV29ya3NwYWNlKHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKSwgY2Fub25pY2FsV29ya3NwYWNlRm9sZGVycywgY2Fub25pY2FsV29ya3NwYWNlQ29uZmlndXJhdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIGxvYWRUcnVzdEluZm8oKTogSVdvcmtzcGFjZVRydXN0SW5mbyB7XG5cdFx0Y29uc3QgaW5mb0FzU3RyaW5nID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQodGhpcy5zdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXG5cdFx0bGV0IHJlc3VsdDogSVdvcmtzcGFjZVRydXN0SW5mbyB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0aWYgKGluZm9Bc1N0cmluZykge1xuXHRcdFx0XHRyZXN1bHQgPSBKU09OLnBhcnNlKGluZm9Bc1N0cmluZyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCB7IH1cblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXN1bHQgPSB7XG5cdFx0XHRcdHVyaVRydXN0SW5mbzogW11cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXN1bHQudXJpVHJ1c3RJbmZvKSB7XG5cdFx0XHRyZXN1bHQudXJpVHJ1c3RJbmZvID0gW107XG5cdFx0fVxuXG5cdFx0cmVzdWx0LnVyaVRydXN0SW5mbyA9IHJlc3VsdC51cmlUcnVzdEluZm8ubWFwKGluZm8gPT4geyByZXR1cm4geyB1cmk6IFVSSS5yZXZpdmUoaW5mby51cmkpLCB0cnVzdGVkOiBpbmZvLnRydXN0ZWQgfTsgfSk7XG5cdFx0cmVzdWx0LnVyaVRydXN0SW5mbyA9IHJlc3VsdC51cmlUcnVzdEluZm8uZmlsdGVyKGluZm8gPT4gaW5mby50cnVzdGVkKTtcblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNhdmVUcnVzdEluZm8oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZSh0aGlzLnN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHRoaXMuX3RydXN0U3RhdGVJbmZvKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnMuZmlyZSgpO1xuXG5cdFx0YXdhaXQgdGhpcy51cGRhdGVXb3Jrc3BhY2VUcnVzdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRXb3Jrc3BhY2VVcmlzKCk6IFVSSVtdIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VVcmlzID0gdGhpcy5fY2Fub25pY2FsV29ya3NwYWNlLmZvbGRlcnMubWFwKGYgPT4gZi51cmkpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9jYW5vbmljYWxXb3Jrc3BhY2UuY29uZmlndXJhdGlvbjtcblx0XHRpZiAod29ya3NwYWNlQ29uZmlndXJhdGlvbiAmJiBpc1NhdmVkV29ya3NwYWNlKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24sIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlKSkge1xuXHRcdFx0d29ya3NwYWNlVXJpcy5wdXNoKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24pO1xuXHRcdH1cblxuXHRcdHJldHVybiB3b3Jrc3BhY2VVcmlzO1xuXHR9XG5cblx0cHJpdmF0ZSBjYWxjdWxhdGVXb3Jrc3BhY2VUcnVzdCgpOiBib29sZWFuIHtcblx0XHQvLyBGZWF0dXJlIGlzIGRpc2FibGVkXG5cdFx0aWYgKCF0aGlzLndvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdEVuYWJsZWQoKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gQ2Fub25pY2FsIFVyaXMgbm90IHlldCByZXNvbHZlZFxuXHRcdGlmICghdGhpcy5fY2Fub25pY2FsVXJpc1Jlc29sdmVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3RlIC0gcmVzb2x2ZXIgZXhwbGljaXRseSBzZXRzIHdvcmtzcGFjZSB0cnVzdCB0byBUUlVFXG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSAmJiB0aGlzLl9yZW1vdGVBdXRob3JpdHk/Lm9wdGlvbnM/LmlzVHJ1c3RlZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3JlbW90ZUF1dGhvcml0eS5vcHRpb25zLmlzVHJ1c3RlZDtcblx0XHR9XG5cblx0XHQvLyBFbXB0eSB3b3Jrc3BhY2UgLSB1c2UgbWVtZW50bywgb3BlbiBlZGlvcnMsIG9yIHVzZXIgc2V0dGluZ1xuXHRcdGlmICh0aGlzLmlzRW1wdHlXb3Jrc3BhY2UoKSkge1xuXHRcdFx0Ly8gVXNlIG1lbWVudG8gaWYgcHJlc2VudFxuXHRcdFx0aWYgKHRoaXMuX3N0b3JlZFRydXN0U3RhdGUuaXNFbXB0eVdvcmtzcGFjZVRydXN0ZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fc3RvcmVkVHJ1c3RTdGF0ZS5pc0VtcHR5V29ya3NwYWNlVHJ1c3RlZDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU3RhcnR1cCBmaWxlc1xuXHRcdFx0aWYgKHRoaXMuX2Nhbm9uaWNhbFN0YXJ0dXBGaWxlcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0VXJpc1RydXN0KHRoaXMuX2Nhbm9uaWNhbFN0YXJ0dXBGaWxlcyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVzZXIgc2V0dGluZ1xuXHRcdFx0cmV0dXJuICEhdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShXT1JLU1BBQ0VfVFJVU1RfRU1QVFlfV0lORE9XKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRVcmlzVHJ1c3QodGhpcy5nZXRXb3Jrc3BhY2VVcmlzKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVXb3Jrc3BhY2VUcnVzdCh0cnVzdGVkPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy53b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodHJ1c3RlZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlc29sdmVDYW5vbmljYWxVcmlzKCk7XG5cdFx0XHR0cnVzdGVkID0gdGhpcy5jYWxjdWxhdGVXb3Jrc3BhY2VUcnVzdCgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzV29ya3NwYWNlVHJ1c3RlZCgpID09PSB0cnVzdGVkKSB7IHJldHVybjsgfVxuXG5cdFx0Ly8gVXBkYXRlIHdvcmtzcGFjZSB0cnVzdFxuXHRcdHRoaXMuaXNUcnVzdGVkID0gdHJ1c3RlZDtcblxuXHRcdC8vIFJ1biB3b3Jrc3BhY2UgdHJ1c3QgdHJhbnNpdGlvbiBwYXJ0aWNpcGFudHNcblx0XHRhd2FpdCB0aGlzLl90cnVzdFRyYW5zaXRpb25NYW5hZ2VyLnBhcnRpY2lwYXRlKHRydXN0ZWQpO1xuXG5cdFx0Ly8gRmlyZSB3b3Jrc3BhY2UgdHJ1c3QgY2hhbmdlIGV2ZW50XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUcnVzdC5maXJlKHRydXN0ZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRVcmlzVHJ1c3QodXJpczogVVJJW10pOiBib29sZWFuIHtcblx0XHRsZXQgc3RhdGUgPSB0cnVlO1xuXHRcdGZvciAoY29uc3QgdXJpIG9mIHVyaXMpIHtcblx0XHRcdGNvbnN0IHsgdHJ1c3RlZCB9ID0gdGhpcy5kb0dldFVyaVRydXN0SW5mbyh1cmkpO1xuXG5cdFx0XHRpZiAoIXRydXN0ZWQpIHtcblx0XHRcdFx0c3RhdGUgPSB0cnVzdGVkO1xuXHRcdFx0XHRyZXR1cm4gc3RhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0dldFVyaVRydXN0SW5mbyh1cmk6IFVSSSk6IElXb3Jrc3BhY2VUcnVzdFVyaUluZm8ge1xuXHRcdC8vIFJldHVybiB0cnVzdGVkIHdoZW4gd29ya3NwYWNlIHRydXN0IGlzIGRpc2FibGVkXG5cdFx0aWYgKCF0aGlzLndvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdEVuYWJsZWQoKSkge1xuXHRcdFx0cmV0dXJuIHsgdHJ1c3RlZDogdHJ1ZSwgdXJpIH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNUcnVzdGVkVmlydHVhbFJlc291cmNlKHVyaSkpIHtcblx0XHRcdHJldHVybiB7IHRydXN0ZWQ6IHRydWUsIHVyaSB9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzVHJ1c3RlZEJ5UmVtb3RlKHVyaSkpIHtcblx0XHRcdHJldHVybiB7IHRydXN0ZWQ6IHRydWUsIHVyaSB9O1xuXHRcdH1cblxuXHRcdGxldCByZXN1bHRTdGF0ZSA9IGZhbHNlO1xuXHRcdGxldCBtYXhMZW5ndGggPSAtMTtcblxuXHRcdGxldCByZXN1bHRVcmkgPSB1cmk7XG5cblx0XHRmb3IgKGNvbnN0IHRydXN0SW5mbyBvZiB0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8pIHtcblx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbE9yUGFyZW50KHVyaSwgdHJ1c3RJbmZvLnVyaSkpIHtcblx0XHRcdFx0Y29uc3QgZnNQYXRoID0gdHJ1c3RJbmZvLnVyaS5mc1BhdGg7XG5cdFx0XHRcdGlmIChmc1BhdGgubGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG5cdFx0XHRcdFx0bWF4TGVuZ3RoID0gZnNQYXRoLmxlbmd0aDtcblx0XHRcdFx0XHRyZXN1bHRTdGF0ZSA9IHRydXN0SW5mby50cnVzdGVkO1xuXHRcdFx0XHRcdHJlc3VsdFVyaSA9IHRydXN0SW5mby51cmk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyB0cnVzdGVkOiByZXN1bHRTdGF0ZSwgdXJpOiByZXN1bHRVcmkgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TZXRVcmlzVHJ1c3QodXJpczogVVJJW10sIHRydXN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgdXJpcykge1xuXHRcdFx0aWYgKHRydXN0ZWQpIHtcblx0XHRcdFx0aWYgKHRoaXMuaXNUcnVzdGVkVmlydHVhbFJlc291cmNlKHVyaSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aGlzLmlzVHJ1c3RlZEJ5UmVtb3RlKHVyaSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGZvdW5kSXRlbSA9IHRoaXMuX3RydXN0U3RhdGVJbmZvLnVyaVRydXN0SW5mby5maW5kKHRydXN0SW5mbyA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh0cnVzdEluZm8udXJpLCB1cmkpKTtcblx0XHRcdFx0aWYgKCFmb3VuZEl0ZW0pIHtcblx0XHRcdFx0XHR0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8ucHVzaCh7IHVyaSwgdHJ1c3RlZDogdHJ1ZSB9KTtcblx0XHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcHJldmlvdXNMZW5ndGggPSB0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8ubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8gPSB0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8uZmlsdGVyKHRydXN0SW5mbyA9PiAhdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodHJ1c3RJbmZvLnVyaSwgdXJpKSk7XG5cdFx0XHRcdGlmIChwcmV2aW91c0xlbmd0aCAhPT0gdGhpcy5fdHJ1c3RTdGF0ZUluZm8udXJpVHJ1c3RJbmZvLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGNoYW5nZWQpIHtcblx0XHRcdGF3YWl0IHRoaXMuc2F2ZVRydXN0SW5mbygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaXNFbXB0eVdvcmtzcGFjZSgpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLndvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0aWYgKHdvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuIGlzVGVtcG9yYXJ5V29ya3NwYWNlKHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKSkgJiYgd29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoID09PSAwO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgaXNUcnVzdGVkVmlydHVhbFJlc291cmNlKHVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzVmlydHVhbFJlc291cmNlKHVyaSkgJiYgdXJpLnNjaGVtZSAhPT0gJ3ZzY29kZS12ZnMnO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1RydXN0ZWRCeVJlbW90ZSh1cmk6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gKGlzRXF1YWxBdXRob3JpdHkoZ2V0UmVtb3RlQXV0aG9yaXR5KHVyaSksIHRoaXMuX3JlbW90ZUF1dGhvcml0eS5hdXRob3JpdHkuYXV0aG9yaXR5KSkgJiYgISF0aGlzLl9yZW1vdGVBdXRob3JpdHkub3B0aW9ucz8uaXNUcnVzdGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgaXNUcnVzdGVkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5faXNUcnVzdGVkID0gdmFsdWU7XG5cblx0XHQvLyBSZXNldCBhY2NlcHRzT3V0T2ZXb3Jrc3BhY2VGaWxlc1xuXHRcdGlmICghdmFsdWUpIHtcblx0XHRcdHRoaXMuX3N0b3JlZFRydXN0U3RhdGUuYWNjZXB0c091dE9mV29ya3NwYWNlRmlsZXMgPSBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBFbXB0eSB3b3Jrc3BhY2UgLSBzYXZlIG1lbWVudG9cblx0XHRpZiAodGhpcy5pc0VtcHR5V29ya3NwYWNlKCkpIHtcblx0XHRcdHRoaXMuX3N0b3JlZFRydXN0U3RhdGUuaXNFbXB0eVdvcmtzcGFjZVRydXN0ZWQgPSB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gcHVibGljIGludGVyZmFjZVxuXG5cdGdldCB3b3Jrc3BhY2VSZXNvbHZlZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlUmVzb2x2ZWRQcm9taXNlO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWRQcm9taXNlO1xuXHR9XG5cblx0Z2V0IGFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yZWRUcnVzdFN0YXRlLmFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzO1xuXHR9XG5cblx0c2V0IGFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fc3RvcmVkVHJ1c3RTdGF0ZS5hY2NlcHRzT3V0T2ZXb3Jrc3BhY2VGaWxlcyA9IHZhbHVlO1xuXHR9XG5cblx0aXNXb3Jrc3BhY2VUcnVzdGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc1RydXN0ZWQ7XG5cdH1cblxuXHRpc1dvcmtzcGFjZVRydXN0Rm9yY2VkKCk6IGJvb2xlYW4ge1xuXHRcdC8vIFJlbW90ZSAtIHJlbW90ZSBhdXRob3JpdHkgZXhwbGljaXRseSBzZXRzIHdvcmtzcGFjZSB0cnVzdFxuXHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkgJiYgdGhpcy5fcmVtb3RlQXV0aG9yaXR5ICYmIHRoaXMuX3JlbW90ZUF1dGhvcml0eS5vcHRpb25zPy5pc1RydXN0ZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gQWxsIHdvcmtzcGFjZSB1cmlzIGFyZSB0cnVzdGVkIGF1dG9tYXRpY2FsbHlcblx0XHRjb25zdCB3b3Jrc3BhY2VVcmlzID0gdGhpcy5nZXRXb3Jrc3BhY2VVcmlzKCkuZmlsdGVyKHVyaSA9PiAhdGhpcy5pc1RydXN0ZWRWaXJ0dWFsUmVzb3VyY2UodXJpKSk7XG5cdFx0aWYgKHdvcmtzcGFjZVVyaXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjYW5TZXRQYXJlbnRGb2xkZXJUcnVzdCgpOiBib29sZWFuIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VJZGVudGlmaWVyID0gdG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMuX2Nhbm9uaWNhbFdvcmtzcGFjZSk7XG5cblx0XHRpZiAoIWlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2VJZGVudGlmaWVyKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICh3b3Jrc3BhY2VJZGVudGlmaWVyLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMuZmlsZSAmJiB3b3Jrc3BhY2VJZGVudGlmaWVyLnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlUmVtb3RlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyZW50Rm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUod29ya3NwYWNlSWRlbnRpZmllci51cmkpO1xuXHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh3b3Jrc3BhY2VJZGVudGlmaWVyLnVyaSwgcGFyZW50Rm9sZGVyKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgc2V0UGFyZW50Rm9sZGVyVHJ1c3QodHJ1c3RlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmNhblNldFBhcmVudEZvbGRlclRydXN0KCkpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZVVyaSA9ICh0b1dvcmtzcGFjZUlkZW50aWZpZXIodGhpcy5fY2Fub25pY2FsV29ya3NwYWNlKSBhcyBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcikudXJpO1xuXHRcdFx0Y29uc3QgcGFyZW50Rm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUod29ya3NwYWNlVXJpKTtcblxuXHRcdFx0YXdhaXQgdGhpcy5zZXRVcmlzVHJ1c3QoW3BhcmVudEZvbGRlcl0sIHRydXN0ZWQpO1xuXHRcdH1cblx0fVxuXG5cdGNhblNldFdvcmtzcGFjZVRydXN0KCk6IGJvb2xlYW4ge1xuXHRcdC8vIFJlbW90ZSAtIHJlbW90ZSBhdXRob3JpdHkgbm90IHlldCByZXNvbHZlZCwgb3IgcmVtb3RlIGF1dGhvcml0eSBleHBsaWNpdGx5IHNldHMgd29ya3NwYWNlIHRydXN0XG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSAmJiAoIXRoaXMuX3JlbW90ZUF1dGhvcml0eSB8fCB0aGlzLl9yZW1vdGVBdXRob3JpdHkub3B0aW9ucz8uaXNUcnVzdGVkICE9PSB1bmRlZmluZWQpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gRW1wdHkgd29ya3NwYWNlXG5cdFx0aWYgKHRoaXMuaXNFbXB0eVdvcmtzcGFjZSgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBBbGwgd29ya3NwYWNlIHVyaXMgYXJlIHRydXN0ZWQgYXV0b21hdGljYWxseVxuXHRcdGNvbnN0IHdvcmtzcGFjZVVyaXMgPSB0aGlzLmdldFdvcmtzcGFjZVVyaXMoKS5maWx0ZXIodXJpID0+ICF0aGlzLmlzVHJ1c3RlZFZpcnR1YWxSZXNvdXJjZSh1cmkpKTtcblx0XHRpZiAod29ya3NwYWNlVXJpcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBVbnRydXN0ZWQgd29ya3NwYWNlXG5cdFx0aWYgKCF0aGlzLmlzV29ya3NwYWNlVHJ1c3RlZCgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBUcnVzdGVkIHdvcmtzcGFjZXNcblx0XHQvLyBDYW4gb25seSB1bnRydXN0ZWQgaW4gdGhlIHNpbmdsZSBmb2xkZXIgc2NlbmFyaW9cblx0XHRjb25zdCB3b3Jrc3BhY2VJZGVudGlmaWVyID0gdG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMuX2Nhbm9uaWNhbFdvcmtzcGFjZSk7XG5cdFx0aWYgKCFpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlSWRlbnRpZmllcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBDYW4gb25seSBiZSB1bnRydXN0ZWQgaW4gY2VydGFpbiBzY2hlbWVzXG5cdFx0aWYgKHdvcmtzcGFjZUlkZW50aWZpZXIudXJpLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlICYmIHdvcmtzcGFjZUlkZW50aWZpZXIudXJpLnNjaGVtZSAhPT0gJ3ZzY29kZS12ZnMnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGN1cnJlbnQgZm9sZGVyIGlzbid0IHRydXN0ZWQgZGlyZWN0bHksIHJldHVybiBmYWxzZVxuXHRcdGNvbnN0IHRydXN0SW5mbyA9IHRoaXMuZG9HZXRVcmlUcnVzdEluZm8od29ya3NwYWNlSWRlbnRpZmllci51cmkpO1xuXHRcdGlmICghdHJ1c3RJbmZvLnRydXN0ZWQgfHwgIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHdvcmtzcGFjZUlkZW50aWZpZXIudXJpLCB0cnVzdEluZm8udXJpKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIHRoZSBwYXJlbnQgaXMgYWxzbyB0cnVzdGVkXG5cdFx0aWYgKHRoaXMuY2FuU2V0UGFyZW50Rm9sZGVyVHJ1c3QoKSkge1xuXHRcdFx0Y29uc3QgcGFyZW50Rm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUod29ya3NwYWNlSWRlbnRpZmllci51cmkpO1xuXHRcdFx0Y29uc3QgcGFyZW50UGF0aFRydXN0SW5mbyA9IHRoaXMuZG9HZXRVcmlUcnVzdEluZm8ocGFyZW50Rm9sZGVyKTtcblx0XHRcdGlmIChwYXJlbnRQYXRoVHJ1c3RJbmZvLnRydXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgc2V0V29ya3NwYWNlVHJ1c3QodHJ1c3RlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEVtcHR5IHdvcmtzcGFjZVxuXHRcdGlmICh0aGlzLmlzRW1wdHlXb3Jrc3BhY2UoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVXb3Jrc3BhY2VUcnVzdCh0cnVzdGVkKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzID0gdGhpcy5nZXRXb3Jrc3BhY2VVcmlzKCk7XG5cdFx0YXdhaXQgdGhpcy5zZXRVcmlzVHJ1c3Qod29ya3NwYWNlRm9sZGVycywgdHJ1c3RlZCk7XG5cdH1cblxuXHRhc3luYyBnZXRVcmlUcnVzdEluZm8odXJpOiBVUkkpOiBQcm9taXNlPElXb3Jrc3BhY2VUcnVzdFVyaUluZm8+IHtcblx0XHQvLyBSZXR1cm4gdHJ1c3RlZCB3aGVuIHdvcmtzcGFjZSB0cnVzdCBpcyBkaXNhYmxlZFxuXHRcdGlmICghdGhpcy53b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybiB7IHRydXN0ZWQ6IHRydWUsIHVyaSB9O1xuXHRcdH1cblxuXHRcdC8vIFVyaSBpcyB0cnVzdGVkIGF1dG9tYXRpY2FsbHkgYnkgdGhlIHJlbW90ZVxuXHRcdGlmICh0aGlzLmlzVHJ1c3RlZEJ5UmVtb3RlKHVyaSkpIHtcblx0XHRcdHJldHVybiB7IHRydXN0ZWQ6IHRydWUsIHVyaSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvR2V0VXJpVHJ1c3RJbmZvKGF3YWl0IHRoaXMuZ2V0Q2Fub25pY2FsVXJpKHVyaSkpO1xuXHR9XG5cblx0YXN5bmMgc2V0VXJpc1RydXN0KHVyaXM6IFVSSVtdLCB0cnVzdGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5kb1NldFVyaXNUcnVzdChhd2FpdCBQcm9taXNlLmFsbCh1cmlzLm1hcCh1cmkgPT4gdGhpcy5nZXRDYW5vbmljYWxVcmkodXJpKSkpLCB0cnVzdGVkKTtcblx0fVxuXG5cdGdldFRydXN0ZWRVcmlzKCk6IFVSSVtdIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJ1c3RTdGF0ZUluZm8udXJpVHJ1c3RJbmZvLm1hcChpbmZvID0+IGluZm8udXJpKTtcblx0fVxuXG5cdGFzeW5jIHNldFRydXN0ZWRVcmlzKHVyaXM6IFVSSVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fdHJ1c3RTdGF0ZUluZm8udXJpVHJ1c3RJbmZvID0gW107XG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgdXJpcykge1xuXHRcdFx0Y29uc3QgY2Fub25pY2FsVXJpID0gYXdhaXQgdGhpcy5nZXRDYW5vbmljYWxVcmkodXJpKTtcblx0XHRcdGNvbnN0IGNsZWFuVXJpID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLnJlbW92ZVRyYWlsaW5nUGF0aFNlcGFyYXRvcihjYW5vbmljYWxVcmkpO1xuXHRcdFx0bGV0IGFkZGVkID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IGFkZGVkVXJpIG9mIHRoaXMuX3RydXN0U3RhdGVJbmZvLnVyaVRydXN0SW5mbykge1xuXHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoYWRkZWRVcmkudXJpLCBjbGVhblVyaSkpIHtcblx0XHRcdFx0XHRhZGRlZCA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGFkZGVkKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl90cnVzdFN0YXRlSW5mby51cmlUcnVzdEluZm8ucHVzaCh7XG5cdFx0XHRcdHRydXN0ZWQ6IHRydWUsXG5cdFx0XHRcdHVyaTogY2xlYW5Vcmlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuc2F2ZVRydXN0SW5mbygpO1xuXHR9XG5cblx0YWRkV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQocGFydGljaXBhbnQ6IElXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25QYXJ0aWNpcGFudCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5fdHJ1c3RUcmFuc2l0aW9uTWFuYWdlci5hZGRXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25QYXJ0aWNpcGFudChwYXJ0aWNpcGFudCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb3BlbkZpbGVzVHJ1c3RSZXF1ZXN0UHJvbWlzZT86IFByb21pc2U8V29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZT47XG5cdHByaXZhdGUgX29wZW5GaWxlc1RydXN0UmVxdWVzdFJlc29sdmVyPzogKHJlc3BvbnNlOiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlKSA9PiB2b2lkO1xuXG5cdHByaXZhdGUgX3dvcmtzcGFjZVRydXN0UmVxdWVzdFByb21pc2U/OiBQcm9taXNlPGJvb2xlYW4gfCB1bmRlZmluZWQ+O1xuXHRwcml2YXRlIF93b3Jrc3BhY2VUcnVzdFJlcXVlc3RSZXNvbHZlcj86ICh0cnVzdGVkOiBib29sZWFuIHwgdW5kZWZpbmVkKSA9PiB2b2lkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkSW5pdGlhdGVPcGVuRmlsZXNUcnVzdFJlcXVlc3QgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRJbml0aWF0ZU9wZW5GaWxlc1RydXN0UmVxdWVzdCA9IHRoaXMuX29uRGlkSW5pdGlhdGVPcGVuRmlsZXNUcnVzdFJlcXVlc3QuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFdvcmtzcGFjZVRydXN0UmVxdWVzdE9wdGlvbnMgfCB1bmRlZmluZWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0ID0gdGhpcy5fb25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T25TdGFydHVwID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkSW5pdGlhdGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPblN0YXJ0dXAgPSB0aGlzLl9vbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T25TdGFydHVwLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvLyNyZWdpb24gT3BlbiBmaWxlKHMpIHRydXN0IHJlcXVlc3RcblxuXHRwcml2YXRlIGdldCB1bnRydXN0ZWRGaWxlc1NldHRpbmcoKTogJ3Byb21wdCcgfCAnb3BlbicgfCAnbmV3V2luZG93JyB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoV09SS1NQQUNFX1RSVVNUX1VOVFJVU1RFRF9GSUxFUyk7XG5cdH1cblxuXHRwcml2YXRlIHNldCB1bnRydXN0ZWRGaWxlc1NldHRpbmcodmFsdWU6ICdwcm9tcHQnIHwgJ29wZW4nIHwgJ25ld1dpbmRvdycpIHtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFdPUktTUEFDRV9UUlVTVF9VTlRSVVNURURfRklMRVMsIHZhbHVlKTtcblx0fVxuXG5cdGFzeW5jIGNvbXBsZXRlT3BlbkZpbGVzVHJ1c3RSZXF1ZXN0KHJlc3VsdDogV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZSwgc2F2ZVJlc3BvbnNlPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5fb3BlbkZpbGVzVHJ1c3RSZXF1ZXN0UmVzb2x2ZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTZXQgYWNjZXB0c091dE9mV29ya3NwYWNlRmlsZXNcblx0XHRpZiAocmVzdWx0ID09PSBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW4pIHtcblx0XHRcdHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5hY2NlcHRzT3V0T2ZXb3Jrc3BhY2VGaWxlcyA9IHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gU2F2ZSByZXNwb25zZVxuXHRcdGlmIChzYXZlUmVzcG9uc2UpIHtcblx0XHRcdGlmIChyZXN1bHQgPT09IFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuT3Blbikge1xuXHRcdFx0XHR0aGlzLnVudHJ1c3RlZEZpbGVzU2V0dGluZyA9ICdvcGVuJztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlc3VsdCA9PT0gV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5PcGVuSW5OZXdXaW5kb3cpIHtcblx0XHRcdFx0dGhpcy51bnRydXN0ZWRGaWxlc1NldHRpbmcgPSAnbmV3V2luZG93Jztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIHByb21pc2Vcblx0XHR0aGlzLl9vcGVuRmlsZXNUcnVzdFJlcXVlc3RSZXNvbHZlcihyZXN1bHQpO1xuXG5cdFx0dGhpcy5fb3BlbkZpbGVzVHJ1c3RSZXF1ZXN0UmVzb2x2ZXIgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fb3BlbkZpbGVzVHJ1c3RSZXF1ZXN0UHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIHJlcXVlc3RPcGVuRmlsZXNUcnVzdCh1cmlzOiBVUklbXSk6IFByb21pc2U8V29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZT4ge1xuXHRcdC8vIElmIHdvcmtzcGFjZSBpcyB1bnRydXN0ZWQsIHRoZXJlIGlzIG5vIGNvbmZsaWN0XG5cdFx0aWYgKCF0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpIHtcblx0XHRcdHJldHVybiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3BlbkZpbGVzVHJ1c3RJbmZvID0gYXdhaXQgUHJvbWlzZS5hbGwodXJpcy5tYXAodXJpID0+IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5nZXRVcmlUcnVzdEluZm8odXJpKSkpO1xuXG5cdFx0Ly8gSWYgYWxsIHVyaXMgYXJlIHRydXN0ZWQsIHRoZXJlIGlzIG5vIGNvbmZsaWN0XG5cdFx0aWYgKG9wZW5GaWxlc1RydXN0SW5mby5tYXAoaW5mbyA9PiBpbmZvLnRydXN0ZWQpLmV2ZXJ5KHRydXN0ZWQgPT4gdHJ1c3RlZCkpIHtcblx0XHRcdHJldHVybiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW47XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdXNlciBoYXMgc2V0dGluZywgZG9uJ3QgbmVlZCB0byBhc2tcblx0XHRpZiAodGhpcy51bnRydXN0ZWRGaWxlc1NldHRpbmcgIT09ICdwcm9tcHQnKSB7XG5cdFx0XHRpZiAodGhpcy51bnRydXN0ZWRGaWxlc1NldHRpbmcgPT09ICduZXdXaW5kb3cnKSB7XG5cdFx0XHRcdHJldHVybiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW5Jbk5ld1dpbmRvdztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMudW50cnVzdGVkRmlsZXNTZXR0aW5nID09PSAnb3BlbicpIHtcblx0XHRcdFx0cmV0dXJuIFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuT3Blbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBhbHJlYWR5IGFza2VkIHRoZSB1c2VyLCBkb24ndCBuZWVkIHRvIGFzayBhZ2FpblxuXHRcdGlmICh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuYWNjZXB0c091dE9mV29ya3NwYWNlRmlsZXMpIHtcblx0XHRcdHJldHVybiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW47XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlL3JldHVybiBhIHByb21pc2Vcblx0XHRpZiAoIXRoaXMuX29wZW5GaWxlc1RydXN0UmVxdWVzdFByb21pc2UpIHtcblx0XHRcdHRoaXMuX29wZW5GaWxlc1RydXN0UmVxdWVzdFByb21pc2UgPSBuZXcgUHJvbWlzZTxXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlPihyZXNvbHZlID0+IHtcblx0XHRcdFx0dGhpcy5fb3BlbkZpbGVzVHJ1c3RSZXF1ZXN0UmVzb2x2ZXIgPSByZXNvbHZlO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9vcGVuRmlsZXNUcnVzdFJlcXVlc3RQcm9taXNlO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkSW5pdGlhdGVPcGVuRmlsZXNUcnVzdFJlcXVlc3QuZmlyZSgpO1xuXHRcdHJldHVybiB0aGlzLl9vcGVuRmlsZXNUcnVzdFJlcXVlc3RQcm9taXNlO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFdvcmtzcGFjZSB0cnVzdCByZXF1ZXN0XG5cblx0cHJpdmF0ZSByZXNvbHZlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0KHRydXN0ZWQ/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFJlc29sdmVyKSB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdFJlcXVlc3RSZXNvbHZlcih0cnVzdGVkID8/IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSk7XG5cblx0XHRcdHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFJlc29sdmVyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fd29ya3NwYWNlVHJ1c3RSZXF1ZXN0UHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRjYW5jZWxXb3Jrc3BhY2VUcnVzdFJlcXVlc3QoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFJlc29sdmVyKSB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdFJlcXVlc3RSZXNvbHZlcih1bmRlZmluZWQpO1xuXG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdFJlcXVlc3RSZXNvbHZlciA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY29tcGxldGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QodHJ1c3RlZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodHJ1c3RlZCA9PT0gdW5kZWZpbmVkIHx8IHRydXN0ZWQgPT09IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkge1xuXHRcdFx0dGhpcy5yZXNvbHZlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0KHRydXN0ZWQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlZ2lzdGVyIG9uZS10aW1lIGV2ZW50IGhhbmRsZXIgdG8gcmVzb2x2ZSB0aGUgcHJvbWlzZSB3aGVuIHdvcmtzcGFjZSB0cnVzdCBjaGFuZ2VkXG5cdFx0RXZlbnQub25jZSh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VUcnVzdCkodHJ1c3RlZCA9PiB0aGlzLnJlc29sdmVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QodHJ1c3RlZCkpO1xuXG5cdFx0Ly8gVXBkYXRlIHN0b3JhZ2UsIHRyYW5zaXRpb24gd29ya3NwYWNlIHN0YXRlXG5cdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLnNldFdvcmtzcGFjZVRydXN0KHRydXN0ZWQpO1xuXHR9XG5cblx0YXN5bmMgcmVxdWVzdFdvcmtzcGFjZVRydXN0KG9wdGlvbnM/OiBXb3Jrc3BhY2VUcnVzdFJlcXVlc3RPcHRpb25zKTogUHJvbWlzZTxib29sZWFuIHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gVHJ1c3RlZCB3b3Jrc3BhY2Vcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpO1xuXHRcdH1cblxuXHRcdC8vIE1vZGFsIHJlcXVlc3Rcblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFByb21pc2UpIHtcblx0XHRcdC8vIENyZWF0ZSBwcm9taXNlXG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VUcnVzdFJlcXVlc3RQcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFJlc29sdmVyID0gcmVzb2x2ZTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBSZXR1cm4gZXhpc3RpbmcgcHJvbWlzZVxuXHRcdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFByb21pc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdC5maXJlKG9wdGlvbnMpO1xuXHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VUcnVzdFJlcXVlc3RQcm9taXNlO1xuXHR9XG5cblx0cmVxdWVzdFdvcmtzcGFjZVRydXN0T25TdGFydHVwKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fd29ya3NwYWNlVHJ1c3RSZXF1ZXN0UHJvbWlzZSkge1xuXHRcdFx0Ly8gQ3JlYXRlIHByb21pc2Vcblx0XHRcdHRoaXMuX3dvcmtzcGFjZVRydXN0UmVxdWVzdFByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0dGhpcy5fd29ya3NwYWNlVHJ1c3RSZXF1ZXN0UmVzb2x2ZXIgPSByZXNvbHZlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdE9uU3RhcnR1cC5maXJlKCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cblxuY2xhc3MgV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcGFydGljaXBhbnRzID0gbmV3IExpbmtlZExpc3Q8SVdvcmtzcGFjZVRydXN0VHJhbnNpdGlvblBhcnRpY2lwYW50PigpO1xuXG5cdGFkZFdvcmtzcGFjZVRydXN0VHJhbnNpdGlvblBhcnRpY2lwYW50KHBhcnRpY2lwYW50OiBJV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgcmVtb3ZlID0gdGhpcy5wYXJ0aWNpcGFudHMucHVzaChwYXJ0aWNpcGFudCk7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiByZW1vdmUoKSk7XG5cdH1cblxuXHRhc3luYyBwYXJ0aWNpcGF0ZSh0cnVzdGVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiB0aGlzLnBhcnRpY2lwYW50cykge1xuXHRcdFx0YXdhaXQgcGFydGljaXBhbnQucGFydGljaXBhdGUodHJ1c3RlZCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnBhcnRpY2lwYW50cy5jbGVhcigpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBXb3Jrc3BhY2VUcnVzdE1lbWVudG8ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21lbWVudG8/OiBNZW1lbnRvO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tZW1lbnRvT2JqZWN0OiBNZW1lbnRvT2JqZWN0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzS2V5ID0gJ2FjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzJztcblx0cHJpdmF0ZSByZWFkb25seSBfaXNFbXB0eVdvcmtzcGFjZVRydXN0ZWRLZXkgPSAnaXNFbXB0eVdvcmtzcGFjZVRydXN0ZWQnO1xuXG5cdGNvbnN0cnVjdG9yKHN0b3JhZ2VTZXJ2aWNlPzogSVN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0aWYgKHN0b3JhZ2VTZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLl9tZW1lbnRvID0gbmV3IE1lbWVudG8oJ3dvcmtzcGFjZVRydXN0Jywgc3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0dGhpcy5fbWVtZW50b09iamVjdCA9IHRoaXMuX21lbWVudG8uZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tZW1lbnRvT2JqZWN0ID0ge307XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tZW1lbnRvT2JqZWN0W3RoaXMuX2FjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzS2V5XSA/PyBmYWxzZTtcblx0fVxuXG5cdHNldCBhY2NlcHRzT3V0T2ZXb3Jrc3BhY2VGaWxlcyh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX21lbWVudG9PYmplY3RbdGhpcy5fYWNjZXB0c091dE9mV29ya3NwYWNlRmlsZXNLZXldID0gdmFsdWU7XG5cblx0XHR0aGlzLl9tZW1lbnRvPy5zYXZlTWVtZW50bygpO1xuXHR9XG5cblx0Z2V0IGlzRW1wdHlXb3Jrc3BhY2VUcnVzdGVkKCk6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tZW1lbnRvT2JqZWN0W3RoaXMuX2lzRW1wdHlXb3Jrc3BhY2VUcnVzdGVkS2V5XTtcblx0fVxuXG5cdHNldCBpc0VtcHR5V29ya3NwYWNlVHJ1c3RlZCh2YWx1ZTogYm9vbGVhbiB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX21lbWVudG9PYmplY3RbdGhpcy5faXNFbXB0eVdvcmtzcGFjZVRydXN0ZWRLZXldID0gdmFsdWU7XG5cblx0XHR0aGlzLl9tZW1lbnRvPy5zYXZlTWVtZW50bygpO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUVwQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx1Q0FBdUQ7QUFDaEUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBMkMsa0JBQWtCLG1DQUFtQyxzQkFBa0MsMEJBQTRDLHVCQUF1QixzQkFBc0I7QUFDM04sU0FBdUMsa0NBQStFLCtCQUFxRSwyQkFBMkIsd0NBQXdDO0FBQzlQLFNBQVMsZUFBOEI7QUFDdkMsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNEJBQTRCO0FBRTlCLE1BQU0sMEJBQTBCO0FBQ2hDLE1BQU0saUNBQWlDO0FBQ3ZDLE1BQU0seUJBQXlCO0FBQy9CLE1BQU0sa0NBQWtDO0FBQ3hDLE1BQU0sK0JBQStCO0FBQ3JDLE1BQU0sb0NBQW9DO0FBQzFDLE1BQU0sOEJBQThCO0FBRXBDLE1BQU0sbUJBQXlDO0FBQUEsRUFDckQsWUFDa0IsbUJBQ0EscUJBQ0Esd0JBQ2hCO0FBSGdCO0FBQ0E7QUFDQTtBQUFBLEVBQ2Q7QUFBQSxFQUdKLElBQUksVUFBOEI7QUFDakMsV0FBTyxLQUFLLGtCQUFrQixRQUFRLElBQUksQ0FBQyxRQUFRLFVBQVU7QUFDNUQsYUFBTztBQUFBLFFBQ04sT0FBTyxPQUFPO0FBQUEsUUFDZCxNQUFNLE9BQU87QUFBQSxRQUNiLFlBQVksT0FBTztBQUFBLFFBQ25CLEtBQUssS0FBSyxvQkFBb0IsS0FBSztBQUFBLE1BQ3BDO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsSUFBSSxZQUFpQztBQUNwQyxXQUFPLEtBQUssa0JBQWtCO0FBQUEsRUFDL0I7QUFBQSxFQUVBLElBQUksZ0JBQXdDO0FBQzNDLFdBQU8sS0FBSywwQkFBMEIsS0FBSyxrQkFBa0I7QUFBQSxFQUM5RDtBQUFBLEVBRUEsSUFBSSxLQUFhO0FBQ2hCLFdBQU8sS0FBSyxrQkFBa0I7QUFBQSxFQUMvQjtBQUNEO0FBRU8sSUFBTSxrQ0FBTixjQUE4QyxXQUF1RDtBQUFBLEVBSTNHLFlBQ3lDLHNCQUNPLG9CQUM5QztBQUNELFVBQU07QUFIa0M7QUFDTztBQUFBLEVBR2hEO0FBQUEsRUFFQSwwQkFBbUM7QUFDbEMsUUFBSSxLQUFLLG1CQUFtQix1QkFBdUI7QUFDbEQsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLENBQUMsQ0FBQyxLQUFLLHFCQUFxQixTQUFTLHVCQUF1QjtBQUFBLEVBQ3BFO0FBQ0Q7QUFsQmEsa0NBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7QUFvQk4sSUFBTSxrQ0FBTixjQUE4QyxXQUF1RDtBQUFBLEVBNEIzRyxZQUN5QyxzQkFDVSxnQ0FDaEIsZ0JBQ0ksb0JBQ1Msb0JBQ0osa0JBQ1EsaUNBQ3BCLGFBQzlCO0FBQ0QsVUFBTTtBQVRrQztBQUNVO0FBQ2hCO0FBQ0k7QUFDUztBQUNKO0FBQ1E7QUFDcEI7QUFoQ2hDLFNBQWlCLGFBQWE7QUFPOUIsU0FBaUIsb0JBQW9CLEtBQUssVUFBVSxJQUFJLFFBQWlCLENBQUM7QUFDMUUsU0FBUyxtQkFBbUIsS0FBSyxrQkFBa0I7QUFFbkQsU0FBaUIsNkJBQTZCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUNoRixTQUFTLDRCQUE0QixLQUFLLDJCQUEyQjtBQUVyRSxTQUFRLHlCQUFnQyxDQUFDO0FBdUJ4QyxTQUFLLHlCQUF5QjtBQUM5QixTQUFLLHNCQUFzQixLQUFLLGlCQUFpQixhQUFhO0FBRTlELEtBQUMsRUFBRSxTQUFTLEtBQUssMkJBQTJCLFNBQVMsS0FBSyxpQ0FBaUMsSUFBSSxxQkFBcUI7QUFDcEgsS0FBQyxFQUFFLFNBQVMsS0FBSyxtQ0FBbUMsU0FBUyxLQUFLLHlDQUF5QyxJQUFJLHFCQUFxQjtBQUVwSSxTQUFLLG9CQUFvQixJQUFJLHNCQUFzQixTQUFTLEtBQUssaUJBQWlCLElBQUksU0FBWSxLQUFLLGNBQWM7QUFDckgsU0FBSywwQkFBMEIsS0FBSyxVQUFVLElBQUksZ0NBQWdDLENBQUM7QUFFbkYsU0FBSyxrQkFBa0IsS0FBSyxjQUFjO0FBQzFDLFNBQUssYUFBYSxLQUFLLHdCQUF3QjtBQUUvQyxTQUFLLHlCQUF5QjtBQUM5QixTQUFLLGtCQUFrQjtBQUFBLEVBQ3hCO0FBQUE7QUFBQSxFQUlRLDJCQUFpQztBQUV4QyxTQUFLLHFCQUFxQixFQUN4QixLQUFLLFlBQVk7QUFDakIsV0FBSyx5QkFBeUI7QUFDOUIsWUFBTSxLQUFLLHFCQUFxQjtBQUFBLElBQ2pDLENBQUMsRUFDQSxRQUFRLE1BQU07QUFDZCxXQUFLLGlDQUFpQztBQUV0QyxVQUFJLENBQUMsS0FBSyxtQkFBbUIsaUJBQWlCO0FBQzdDLGFBQUsseUNBQXlDO0FBQUEsTUFDL0M7QUFBQSxJQUNELENBQUM7QUFHRixRQUFJLEtBQUssbUJBQW1CLGlCQUFpQjtBQUM1QyxXQUFLLCtCQUErQixpQkFBaUIsS0FBSyxtQkFBbUIsZUFBZSxFQUMxRixLQUFLLE9BQU0sV0FBVTtBQUNyQixhQUFLLG1CQUFtQjtBQUN4QixjQUFNLEtBQUssWUFBWSxpQkFBaUIsUUFBUSxZQUFZO0FBQzVELGNBQU0sS0FBSyxxQkFBcUI7QUFBQSxNQUNqQyxDQUFDLEVBQ0EsUUFBUSxNQUFNO0FBQ2QsYUFBSyx5Q0FBeUM7QUFBQSxNQUMvQyxDQUFDO0FBQUEsSUFDSDtBQUdBLFFBQUksS0FBSyxpQkFBaUIsR0FBRztBQUM1QixXQUFLLGtDQUFrQyxLQUFLLE1BQU07QUFDakQsWUFBSSxLQUFLLGtCQUFrQiw0QkFBNEIsUUFBVztBQUNqRSxlQUFLLGtCQUFrQiwwQkFBMEIsS0FBSyxtQkFBbUI7QUFBQSxRQUMxRTtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBLEVBTVEsb0JBQTBCO0FBQ2pDLFNBQUssVUFBVSxLQUFLLGlCQUFpQiw0QkFBNEIsWUFBWSxNQUFNLEtBQUsscUJBQXFCLENBQUMsQ0FBQztBQUMvRyxTQUFLLFVBQVUsS0FBSyxlQUFlLGlCQUFpQixhQUFhLGFBQWEsS0FBSyxZQUFZLEtBQUssTUFBTSxFQUFFLFlBQVk7QUFFdkgsVUFBSSxLQUFLLFVBQVUsS0FBSyxlQUFlLE1BQU0sS0FBSyxVQUFVLEtBQUssY0FBYyxDQUFDLEdBQUc7QUFDbEYsYUFBSyxrQkFBa0IsS0FBSyxjQUFjO0FBQzFDLGFBQUssMkJBQTJCLEtBQUs7QUFFckMsY0FBTSxLQUFLLHFCQUFxQjtBQUFBLE1BQ2pDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFQSxNQUFjLGdCQUFnQixLQUF3QjtBQUNyRCxRQUFJLGVBQWU7QUFDbkIsUUFBSSxLQUFLLG1CQUFtQixtQkFBbUIsSUFBSSxXQUFXLFFBQVEsY0FBYztBQUNuRixxQkFBZSxNQUFNLEtBQUssK0JBQStCLGdCQUFnQixHQUFHO0FBQUEsSUFDN0UsV0FBVyxJQUFJLFdBQVcsY0FBYztBQUN2QyxZQUFNLFFBQVEsSUFBSSxVQUFVLFFBQVEsR0FBRztBQUN2QyxVQUFJLFVBQVUsSUFBSTtBQUNqQix1QkFBZSxJQUFJLEtBQUssRUFBRSxXQUFXLElBQUksVUFBVSxPQUFPLEdBQUcsS0FBSyxFQUFFLENBQUM7QUFBQSxNQUN0RTtBQUFBLElBQ0Q7QUFHQSxXQUFPLGFBQWEsS0FBSyxFQUFFLE9BQU8sTUFBTSxVQUFVLEtBQUssQ0FBQztBQUFBLEVBQ3pEO0FBQUEsRUFFQSxNQUFjLHVCQUFzQztBQUVuRCxVQUFNLGNBQXVCLENBQUM7QUFDOUIsUUFBSSxLQUFLLG1CQUFtQixxQkFBcUI7QUFDaEQsa0JBQVksS0FBSyxHQUFHLEtBQUssbUJBQW1CLG1CQUFtQjtBQUFBLElBQ2hFO0FBRUEsUUFBSSxLQUFLLG1CQUFtQixhQUFhO0FBQ3hDLGtCQUFZLEtBQUssR0FBRyxLQUFLLG1CQUFtQixXQUFXO0FBQUEsSUFDeEQ7QUFFQSxRQUFJLEtBQUssbUJBQW1CLGNBQWM7QUFDekMsa0JBQVksS0FBSyxHQUFHLEtBQUssbUJBQW1CLFlBQVk7QUFBQSxJQUN6RDtBQUVBLFFBQUksWUFBWSxRQUFRO0FBQ3ZCLFlBQU0sMEJBQTBCLFlBQVksT0FBTyxPQUFLLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLE9BQUssRUFBRSxPQUFRO0FBQ3hGLFlBQU0sdUJBQXVCLE1BQU0sUUFBUSxJQUFJLHdCQUF3QixJQUFJLFNBQU8sS0FBSyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7QUFFNUcsV0FBSyx1QkFBdUIsS0FBSyxHQUFHLHFCQUFxQixPQUFPLFNBQU8sS0FBSyx1QkFBdUIsTUFBTSxPQUFLLENBQUMsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUFBLElBQ2hLO0FBR0EsVUFBTSxnQkFBZ0IsS0FBSyxpQkFBaUIsYUFBYSxFQUFFLFFBQVEsSUFBSSxPQUFLLEVBQUUsR0FBRztBQUNqRixVQUFNLDRCQUE0QixNQUFNLFFBQVEsSUFBSSxjQUFjLElBQUksU0FBTyxLQUFLLGdCQUFnQixHQUFHLENBQUMsQ0FBQztBQUV2RyxRQUFJLGtDQUFrQyxLQUFLLGlCQUFpQixhQUFhLEVBQUU7QUFDM0UsUUFBSSxtQ0FBbUMsaUJBQWlCLGlDQUFpQyxLQUFLLGtCQUFrQixHQUFHO0FBQ2xILHdDQUFrQyxNQUFNLEtBQUssZ0JBQWdCLCtCQUErQjtBQUFBLElBQzdGO0FBRUEsU0FBSyxzQkFBc0IsSUFBSSxtQkFBbUIsS0FBSyxpQkFBaUIsYUFBYSxHQUFHLDJCQUEyQiwrQkFBK0I7QUFBQSxFQUNuSjtBQUFBLEVBRVEsZ0JBQXFDO0FBQzVDLFVBQU0sZUFBZSxLQUFLLGVBQWUsSUFBSSxLQUFLLFlBQVksYUFBYSxXQUFXO0FBRXRGLFFBQUk7QUFDSixRQUFJO0FBQ0gsVUFBSSxjQUFjO0FBQ2pCLGlCQUFTLEtBQUssTUFBTSxZQUFZO0FBQUEsTUFDakM7QUFBQSxJQUNELFFBQVE7QUFBQSxJQUFFO0FBRVYsUUFBSSxDQUFDLFFBQVE7QUFDWixlQUFTO0FBQUEsUUFDUixjQUFjLENBQUM7QUFBQSxNQUNoQjtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsT0FBTyxjQUFjO0FBQ3pCLGFBQU8sZUFBZSxDQUFDO0FBQUEsSUFDeEI7QUFFQSxXQUFPLGVBQWUsT0FBTyxhQUFhLElBQUksVUFBUTtBQUFFLGFBQU8sRUFBRSxLQUFLLElBQUksT0FBTyxLQUFLLEdBQUcsR0FBRyxTQUFTLEtBQUssUUFBUTtBQUFBLElBQUcsQ0FBQztBQUN0SCxXQUFPLGVBQWUsT0FBTyxhQUFhLE9BQU8sVUFBUSxLQUFLLE9BQU87QUFFckUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsZ0JBQStCO0FBQzVDLFNBQUssZUFBZSxNQUFNLEtBQUssWUFBWSxLQUFLLFVBQVUsS0FBSyxlQUFlLEdBQUcsYUFBYSxhQUFhLGNBQWMsT0FBTztBQUNoSSxTQUFLLDJCQUEyQixLQUFLO0FBRXJDLFVBQU0sS0FBSyxxQkFBcUI7QUFBQSxFQUNqQztBQUFBLEVBRVEsbUJBQTBCO0FBQ2pDLFVBQU0sZ0JBQWdCLEtBQUssb0JBQW9CLFFBQVEsSUFBSSxPQUFLLEVBQUUsR0FBRztBQUNyRSxVQUFNLHlCQUF5QixLQUFLLG9CQUFvQjtBQUN4RCxRQUFJLDBCQUEwQixpQkFBaUIsd0JBQXdCLEtBQUssa0JBQWtCLEdBQUc7QUFDaEcsb0JBQWMsS0FBSyxzQkFBc0I7QUFBQSxJQUMxQztBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSwwQkFBbUM7QUFFMUMsUUFBSSxDQUFDLEtBQUssZ0NBQWdDLHdCQUF3QixHQUFHO0FBQ3BFLGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxDQUFDLEtBQUssd0JBQXdCO0FBQ2pDLGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxLQUFLLG1CQUFtQixtQkFBbUIsS0FBSyxrQkFBa0IsU0FBUyxXQUFXO0FBQ3pGLGFBQU8sS0FBSyxpQkFBaUIsUUFBUTtBQUFBLElBQ3RDO0FBR0EsUUFBSSxLQUFLLGlCQUFpQixHQUFHO0FBRTVCLFVBQUksS0FBSyxrQkFBa0IsNEJBQTRCLFFBQVc7QUFDakUsZUFBTyxLQUFLLGtCQUFrQjtBQUFBLE1BQy9CO0FBR0EsVUFBSSxLQUFLLHVCQUF1QixRQUFRO0FBQ3ZDLGVBQU8sS0FBSyxhQUFhLEtBQUssc0JBQXNCO0FBQUEsTUFDckQ7QUFHQSxhQUFPLENBQUMsQ0FBQyxLQUFLLHFCQUFxQixTQUFTLDRCQUE0QjtBQUFBLElBQ3pFO0FBRUEsV0FBTyxLQUFLLGFBQWEsS0FBSyxpQkFBaUIsQ0FBQztBQUFBLEVBQ2pEO0FBQUEsRUFFQSxNQUFjLHFCQUFxQixTQUFrQztBQUNwRSxRQUFJLENBQUMsS0FBSyxnQ0FBZ0Msd0JBQXdCLEdBQUc7QUFDcEU7QUFBQSxJQUNEO0FBRUEsUUFBSSxZQUFZLFFBQVc7QUFDMUIsWUFBTSxLQUFLLHFCQUFxQjtBQUNoQyxnQkFBVSxLQUFLLHdCQUF3QjtBQUFBLElBQ3hDO0FBRUEsUUFBSSxLQUFLLG1CQUFtQixNQUFNLFNBQVM7QUFBRTtBQUFBLElBQVE7QUFHckQsU0FBSyxZQUFZO0FBR2pCLFVBQU0sS0FBSyx3QkFBd0IsWUFBWSxPQUFPO0FBR3RELFNBQUssa0JBQWtCLEtBQUssT0FBTztBQUFBLEVBQ3BDO0FBQUEsRUFFUSxhQUFhLE1BQXNCO0FBQzFDLFFBQUksUUFBUTtBQUNaLGVBQVcsT0FBTyxNQUFNO0FBQ3ZCLFlBQU0sRUFBRSxRQUFRLElBQUksS0FBSyxrQkFBa0IsR0FBRztBQUU5QyxVQUFJLENBQUMsU0FBUztBQUNiLGdCQUFRO0FBQ1IsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGtCQUFrQixLQUFrQztBQUUzRCxRQUFJLENBQUMsS0FBSyxnQ0FBZ0Msd0JBQXdCLEdBQUc7QUFDcEUsYUFBTyxFQUFFLFNBQVMsTUFBTSxJQUFJO0FBQUEsSUFDN0I7QUFFQSxRQUFJLEtBQUsseUJBQXlCLEdBQUcsR0FBRztBQUN2QyxhQUFPLEVBQUUsU0FBUyxNQUFNLElBQUk7QUFBQSxJQUM3QjtBQUVBLFFBQUksS0FBSyxrQkFBa0IsR0FBRyxHQUFHO0FBQ2hDLGFBQU8sRUFBRSxTQUFTLE1BQU0sSUFBSTtBQUFBLElBQzdCO0FBRUEsUUFBSSxjQUFjO0FBQ2xCLFFBQUksWUFBWTtBQUVoQixRQUFJLFlBQVk7QUFFaEIsZUFBVyxhQUFhLEtBQUssZ0JBQWdCLGNBQWM7QUFDMUQsVUFBSSxLQUFLLG1CQUFtQixPQUFPLGdCQUFnQixLQUFLLFVBQVUsR0FBRyxHQUFHO0FBQ3ZFLGNBQU0sU0FBUyxVQUFVLElBQUk7QUFDN0IsWUFBSSxPQUFPLFNBQVMsV0FBVztBQUM5QixzQkFBWSxPQUFPO0FBQ25CLHdCQUFjLFVBQVU7QUFDeEIsc0JBQVksVUFBVTtBQUFBLFFBQ3ZCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxXQUFPLEVBQUUsU0FBUyxhQUFhLEtBQUssVUFBVTtBQUFBLEVBQy9DO0FBQUEsRUFFQSxNQUFjLGVBQWUsTUFBYSxTQUFpQztBQUMxRSxRQUFJLFVBQVU7QUFFZCxlQUFXLE9BQU8sTUFBTTtBQUN2QixVQUFJLFNBQVM7QUFDWixZQUFJLEtBQUsseUJBQXlCLEdBQUcsR0FBRztBQUN2QztBQUFBLFFBQ0Q7QUFFQSxZQUFJLEtBQUssa0JBQWtCLEdBQUcsR0FBRztBQUNoQztBQUFBLFFBQ0Q7QUFFQSxjQUFNLFlBQVksS0FBSyxnQkFBZ0IsYUFBYSxLQUFLLGVBQWEsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLFVBQVUsS0FBSyxHQUFHLENBQUM7QUFDaEksWUFBSSxDQUFDLFdBQVc7QUFDZixlQUFLLGdCQUFnQixhQUFhLEtBQUssRUFBRSxLQUFLLFNBQVMsS0FBSyxDQUFDO0FBQzdELG9CQUFVO0FBQUEsUUFDWDtBQUFBLE1BQ0QsT0FBTztBQUNOLGNBQU0saUJBQWlCLEtBQUssZ0JBQWdCLGFBQWE7QUFDekQsYUFBSyxnQkFBZ0IsZUFBZSxLQUFLLGdCQUFnQixhQUFhLE9BQU8sZUFBYSxDQUFDLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxVQUFVLEtBQUssR0FBRyxDQUFDO0FBQ3JKLFlBQUksbUJBQW1CLEtBQUssZ0JBQWdCLGFBQWEsUUFBUTtBQUNoRSxvQkFBVTtBQUFBLFFBQ1g7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksU0FBUztBQUNaLFlBQU0sS0FBSyxjQUFjO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQUEsRUFFUSxtQkFBNEI7QUFDbkMsUUFBSSxLQUFLLGlCQUFpQixrQkFBa0IsTUFBTSxlQUFlLE9BQU87QUFDdkUsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLFlBQVksS0FBSyxpQkFBaUIsYUFBYTtBQUNyRCxRQUFJLFdBQVc7QUFDZCxhQUFPLHFCQUFxQixLQUFLLGlCQUFpQixhQUFhLENBQUMsS0FBSyxVQUFVLFFBQVEsV0FBVztBQUFBLElBQ25HO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLHlCQUF5QixLQUFtQjtBQUNuRCxXQUFPLGtCQUFrQixHQUFHLEtBQUssSUFBSSxXQUFXO0FBQUEsRUFDakQ7QUFBQSxFQUVRLGtCQUFrQixLQUFtQjtBQUM1QyxRQUFJLENBQUMsS0FBSyxtQkFBbUIsaUJBQWlCO0FBQzdDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxDQUFDLEtBQUssa0JBQWtCO0FBQzNCLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBUSxpQkFBaUIsbUJBQW1CLEdBQUcsR0FBRyxLQUFLLGlCQUFpQixVQUFVLFNBQVMsS0FBTSxDQUFDLENBQUMsS0FBSyxpQkFBaUIsU0FBUztBQUFBLEVBQ25JO0FBQUEsRUFFQSxJQUFZLFVBQVUsT0FBZ0I7QUFDckMsU0FBSyxhQUFhO0FBR2xCLFFBQUksQ0FBQyxPQUFPO0FBQ1gsV0FBSyxrQkFBa0IsNkJBQTZCO0FBQUEsSUFDckQ7QUFHQSxRQUFJLEtBQUssaUJBQWlCLEdBQUc7QUFDNUIsV0FBSyxrQkFBa0IsMEJBQTBCO0FBQUEsSUFDbEQ7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBLEVBTUEsSUFBSSxvQkFBbUM7QUFDdEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSw0QkFBMkM7QUFDOUMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSw2QkFBc0M7QUFDekMsV0FBTyxLQUFLLGtCQUFrQjtBQUFBLEVBQy9CO0FBQUEsRUFFQSxJQUFJLDJCQUEyQixPQUFnQjtBQUM5QyxTQUFLLGtCQUFrQiw2QkFBNkI7QUFBQSxFQUNyRDtBQUFBLEVBRUEscUJBQThCO0FBQzdCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLHlCQUFrQztBQUVqQyxRQUFJLEtBQUssbUJBQW1CLG1CQUFtQixLQUFLLG9CQUFvQixLQUFLLGlCQUFpQixTQUFTLGNBQWMsUUFBVztBQUMvSCxhQUFPO0FBQUEsSUFDUjtBQUdBLFVBQU0sZ0JBQWdCLEtBQUssaUJBQWlCLEVBQUUsT0FBTyxTQUFPLENBQUMsS0FBSyx5QkFBeUIsR0FBRyxDQUFDO0FBQy9GLFFBQUksY0FBYyxXQUFXLEdBQUc7QUFDL0IsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsMEJBQW1DO0FBQ2xDLFVBQU0sc0JBQXNCLHNCQUFzQixLQUFLLG1CQUFtQjtBQUUxRSxRQUFJLENBQUMsa0NBQWtDLG1CQUFtQixHQUFHO0FBQzVELGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxvQkFBb0IsSUFBSSxXQUFXLFFBQVEsUUFBUSxvQkFBb0IsSUFBSSxXQUFXLFFBQVEsY0FBYztBQUMvRyxhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sZUFBZSxLQUFLLG1CQUFtQixPQUFPLFFBQVEsb0JBQW9CLEdBQUc7QUFDbkYsUUFBSSxLQUFLLG1CQUFtQixPQUFPLFFBQVEsb0JBQW9CLEtBQUssWUFBWSxHQUFHO0FBQ2xGLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0scUJBQXFCLFNBQWlDO0FBQzNELFFBQUksS0FBSyx3QkFBd0IsR0FBRztBQUNuQyxZQUFNLGVBQWdCLHNCQUFzQixLQUFLLG1CQUFtQixFQUF1QztBQUMzRyxZQUFNLGVBQWUsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLFlBQVk7QUFFeEUsWUFBTSxLQUFLLGFBQWEsQ0FBQyxZQUFZLEdBQUcsT0FBTztBQUFBLElBQ2hEO0FBQUEsRUFDRDtBQUFBLEVBRUEsdUJBQWdDO0FBRS9CLFFBQUksS0FBSyxtQkFBbUIsb0JBQW9CLENBQUMsS0FBSyxvQkFBb0IsS0FBSyxpQkFBaUIsU0FBUyxjQUFjLFNBQVk7QUFDbEksYUFBTztBQUFBLElBQ1I7QUFHQSxRQUFJLEtBQUssaUJBQWlCLEdBQUc7QUFDNUIsYUFBTztBQUFBLElBQ1I7QUFHQSxVQUFNLGdCQUFnQixLQUFLLGlCQUFpQixFQUFFLE9BQU8sU0FBTyxDQUFDLEtBQUsseUJBQXlCLEdBQUcsQ0FBQztBQUMvRixRQUFJLGNBQWMsV0FBVyxHQUFHO0FBQy9CLGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxDQUFDLEtBQUssbUJBQW1CLEdBQUc7QUFDL0IsYUFBTztBQUFBLElBQ1I7QUFJQSxVQUFNLHNCQUFzQixzQkFBc0IsS0FBSyxtQkFBbUI7QUFDMUUsUUFBSSxDQUFDLGtDQUFrQyxtQkFBbUIsR0FBRztBQUM1RCxhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksb0JBQW9CLElBQUksV0FBVyxRQUFRLFFBQVEsb0JBQW9CLElBQUksV0FBVyxjQUFjO0FBQ3ZHLGFBQU87QUFBQSxJQUNSO0FBR0EsVUFBTSxZQUFZLEtBQUssa0JBQWtCLG9CQUFvQixHQUFHO0FBQ2hFLFFBQUksQ0FBQyxVQUFVLFdBQVcsQ0FBQyxLQUFLLG1CQUFtQixPQUFPLFFBQVEsb0JBQW9CLEtBQUssVUFBVSxHQUFHLEdBQUc7QUFDMUcsYUFBTztBQUFBLElBQ1I7QUFHQSxRQUFJLEtBQUssd0JBQXdCLEdBQUc7QUFDbkMsWUFBTSxlQUFlLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxvQkFBb0IsR0FBRztBQUNuRixZQUFNLHNCQUFzQixLQUFLLGtCQUFrQixZQUFZO0FBQy9ELFVBQUksb0JBQW9CLFNBQVM7QUFDaEMsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLFNBQWlDO0FBRXhELFFBQUksS0FBSyxpQkFBaUIsR0FBRztBQUM1QixZQUFNLEtBQUsscUJBQXFCLE9BQU87QUFDdkM7QUFBQSxJQUNEO0FBRUEsVUFBTSxtQkFBbUIsS0FBSyxpQkFBaUI7QUFDL0MsVUFBTSxLQUFLLGFBQWEsa0JBQWtCLE9BQU87QUFBQSxFQUNsRDtBQUFBLEVBRUEsTUFBTSxnQkFBZ0IsS0FBMkM7QUFFaEUsUUFBSSxDQUFDLEtBQUssZ0NBQWdDLHdCQUF3QixHQUFHO0FBQ3BFLGFBQU8sRUFBRSxTQUFTLE1BQU0sSUFBSTtBQUFBLElBQzdCO0FBR0EsUUFBSSxLQUFLLGtCQUFrQixHQUFHLEdBQUc7QUFDaEMsYUFBTyxFQUFFLFNBQVMsTUFBTSxJQUFJO0FBQUEsSUFDN0I7QUFFQSxXQUFPLEtBQUssa0JBQWtCLE1BQU0sS0FBSyxnQkFBZ0IsR0FBRyxDQUFDO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLE1BQU0sYUFBYSxNQUFhLFNBQWlDO0FBQ2hFLFNBQUssZUFBZSxNQUFNLFFBQVEsSUFBSSxLQUFLLElBQUksU0FBTyxLQUFLLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU87QUFBQSxFQUMzRjtBQUFBLEVBRUEsaUJBQXdCO0FBQ3ZCLFdBQU8sS0FBSyxnQkFBZ0IsYUFBYSxJQUFJLFVBQVEsS0FBSyxHQUFHO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLE1BQU0sZUFBZSxNQUE0QjtBQUNoRCxTQUFLLGdCQUFnQixlQUFlLENBQUM7QUFDckMsZUFBVyxPQUFPLE1BQU07QUFDdkIsWUFBTSxlQUFlLE1BQU0sS0FBSyxnQkFBZ0IsR0FBRztBQUNuRCxZQUFNLFdBQVcsS0FBSyxtQkFBbUIsT0FBTyw0QkFBNEIsWUFBWTtBQUN4RixVQUFJLFFBQVE7QUFDWixpQkFBVyxZQUFZLEtBQUssZ0JBQWdCLGNBQWM7QUFDekQsWUFBSSxLQUFLLG1CQUFtQixPQUFPLFFBQVEsU0FBUyxLQUFLLFFBQVEsR0FBRztBQUNuRSxrQkFBUTtBQUNSO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxVQUFJLE9BQU87QUFDVjtBQUFBLE1BQ0Q7QUFFQSxXQUFLLGdCQUFnQixhQUFhLEtBQUs7QUFBQSxRQUN0QyxTQUFTO0FBQUEsUUFDVCxLQUFLO0FBQUEsTUFDTixDQUFDO0FBQUEsSUFDRjtBQUVBLFVBQU0sS0FBSyxjQUFjO0FBQUEsRUFDMUI7QUFBQSxFQUVBLHVDQUF1QyxhQUFnRTtBQUN0RyxXQUFPLEtBQUssd0JBQXdCLHVDQUF1QyxXQUFXO0FBQUEsRUFDdkY7QUFBQTtBQUdEO0FBdmpCYSxrQ0FBTjtBQUFBLEVBNkJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBcENVO0FBeWpCTixJQUFNLCtCQUFOLGNBQTJDLFdBQW9EO0FBQUEsRUFrQnJHLFlBQ3lDLHNCQUNXLGlDQUNsRDtBQUNELFVBQU07QUFIa0M7QUFDVztBQVhwRCxTQUFpQixzQ0FBc0MsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ3pGLFNBQVMscUNBQXFDLEtBQUssb0NBQW9DO0FBRXZGLFNBQWlCLHNDQUFzQyxLQUFLLFVBQVUsSUFBSSxRQUFrRCxDQUFDO0FBQzdILFNBQVMscUNBQXFDLEtBQUssb0NBQW9DO0FBRXZGLFNBQWlCLCtDQUErQyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDbEcsU0FBUyw4Q0FBOEMsS0FBSyw2Q0FBNkM7QUFBQSxFQU96RztBQUFBO0FBQUEsRUFJQSxJQUFZLHdCQUF5RDtBQUNwRSxXQUFPLEtBQUsscUJBQXFCLFNBQVMsK0JBQStCO0FBQUEsRUFDMUU7QUFBQSxFQUVBLElBQVksc0JBQXNCLE9BQXdDO0FBQ3pFLFNBQUsscUJBQXFCLFlBQVksaUNBQWlDLEtBQUs7QUFBQSxFQUM3RTtBQUFBLEVBRUEsTUFBTSw4QkFBOEIsUUFBbUMsY0FBdUM7QUFDN0csUUFBSSxDQUFDLEtBQUssZ0NBQWdDO0FBQ3pDO0FBQUEsSUFDRDtBQUdBLFFBQUksV0FBVywwQkFBMEIsTUFBTTtBQUM5QyxXQUFLLGdDQUFnQyw2QkFBNkI7QUFBQSxJQUNuRTtBQUdBLFFBQUksY0FBYztBQUNqQixVQUFJLFdBQVcsMEJBQTBCLE1BQU07QUFDOUMsYUFBSyx3QkFBd0I7QUFBQSxNQUM5QjtBQUVBLFVBQUksV0FBVywwQkFBMEIsaUJBQWlCO0FBQ3pELGFBQUssd0JBQXdCO0FBQUEsTUFDOUI7QUFBQSxJQUNEO0FBR0EsU0FBSywrQkFBK0IsTUFBTTtBQUUxQyxTQUFLLGlDQUFpQztBQUN0QyxTQUFLLGdDQUFnQztBQUFBLEVBQ3RDO0FBQUEsRUFFQSxNQUFNLHNCQUFzQixNQUFpRDtBQUU1RSxRQUFJLENBQUMsS0FBSyxnQ0FBZ0MsbUJBQW1CLEdBQUc7QUFDL0QsYUFBTywwQkFBMEI7QUFBQSxJQUNsQztBQUVBLFVBQU0scUJBQXFCLE1BQU0sUUFBUSxJQUFJLEtBQUssSUFBSSxTQUFPLEtBQUssZ0NBQWdDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztBQUd2SCxRQUFJLG1CQUFtQixJQUFJLFVBQVEsS0FBSyxPQUFPLEVBQUUsTUFBTSxhQUFXLE9BQU8sR0FBRztBQUMzRSxhQUFPLDBCQUEwQjtBQUFBLElBQ2xDO0FBR0EsUUFBSSxLQUFLLDBCQUEwQixVQUFVO0FBQzVDLFVBQUksS0FBSywwQkFBMEIsYUFBYTtBQUMvQyxlQUFPLDBCQUEwQjtBQUFBLE1BQ2xDO0FBRUEsVUFBSSxLQUFLLDBCQUEwQixRQUFRO0FBQzFDLGVBQU8sMEJBQTBCO0FBQUEsTUFDbEM7QUFBQSxJQUNEO0FBR0EsUUFBSSxLQUFLLGdDQUFnQyw0QkFBNEI7QUFDcEUsYUFBTywwQkFBMEI7QUFBQSxJQUNsQztBQUdBLFFBQUksQ0FBQyxLQUFLLCtCQUErQjtBQUN4QyxXQUFLLGdDQUFnQyxJQUFJLFFBQW1DLGFBQVc7QUFDdEYsYUFBSyxpQ0FBaUM7QUFBQSxNQUN2QyxDQUFDO0FBQUEsSUFDRixPQUFPO0FBQ04sYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFNBQUssb0NBQW9DLEtBQUs7QUFDOUMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBO0FBQUE7QUFBQSxFQU1RLDZCQUE2QixTQUF5QjtBQUM3RCxRQUFJLEtBQUssZ0NBQWdDO0FBQ3hDLFdBQUssK0JBQStCLFdBQVcsS0FBSyxnQ0FBZ0MsbUJBQW1CLENBQUM7QUFFeEcsV0FBSyxpQ0FBaUM7QUFDdEMsV0FBSyxnQ0FBZ0M7QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLDhCQUFvQztBQUNuQyxRQUFJLEtBQUssZ0NBQWdDO0FBQ3hDLFdBQUssK0JBQStCLE1BQVM7QUFFN0MsV0FBSyxpQ0FBaUM7QUFDdEMsV0FBSyxnQ0FBZ0M7QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sOEJBQThCLFNBQWtDO0FBQ3JFLFFBQUksWUFBWSxVQUFhLFlBQVksS0FBSyxnQ0FBZ0MsbUJBQW1CLEdBQUc7QUFDbkcsV0FBSyw2QkFBNkIsT0FBTztBQUN6QztBQUFBLElBQ0Q7QUFHQSxVQUFNLEtBQUssS0FBSyxnQ0FBZ0MsZ0JBQWdCLEVBQUUsQ0FBQUEsYUFBVyxLQUFLLDZCQUE2QkEsUUFBTyxDQUFDO0FBR3ZILFVBQU0sS0FBSyxnQ0FBZ0Msa0JBQWtCLE9BQU87QUFBQSxFQUNyRTtBQUFBLEVBRUEsTUFBTSxzQkFBc0IsU0FBc0U7QUFFakcsUUFBSSxLQUFLLGdDQUFnQyxtQkFBbUIsR0FBRztBQUM5RCxhQUFPLEtBQUssZ0NBQWdDLG1CQUFtQjtBQUFBLElBQ2hFO0FBR0EsUUFBSSxDQUFDLEtBQUssK0JBQStCO0FBRXhDLFdBQUssZ0NBQWdDLElBQUksUUFBUSxhQUFXO0FBQzNELGFBQUssaUNBQWlDO0FBQUEsTUFDdkMsQ0FBQztBQUFBLElBQ0YsT0FBTztBQUVOLGFBQU8sS0FBSztBQUFBLElBQ2I7QUFFQSxTQUFLLG9DQUFvQyxLQUFLLE9BQU87QUFDckQsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsaUNBQXVDO0FBQ3RDLFFBQUksQ0FBQyxLQUFLLCtCQUErQjtBQUV4QyxXQUFLLGdDQUFnQyxJQUFJLFFBQVEsYUFBVztBQUMzRCxhQUFLLGlDQUFpQztBQUFBLE1BQ3ZDLENBQUM7QUFBQSxJQUNGO0FBRUEsU0FBSyw2Q0FBNkMsS0FBSztBQUFBLEVBQ3hEO0FBQUE7QUFHRDtBQTdLYSwrQkFBTjtBQUFBLEVBbUJKO0FBQUEsRUFDQTtBQUFBLEdBcEJVO0FBK0tiLE1BQU0sd0NBQXdDLFdBQVc7QUFBQSxFQUF6RDtBQUFBO0FBRUMsU0FBaUIsZUFBZSxJQUFJLFdBQWlEO0FBQUE7QUFBQSxFQUVyRix1Q0FBdUMsYUFBZ0U7QUFDdEcsVUFBTSxTQUFTLEtBQUssYUFBYSxLQUFLLFdBQVc7QUFDakQsV0FBTyxhQUFhLE1BQU0sT0FBTyxDQUFDO0FBQUEsRUFDbkM7QUFBQSxFQUVBLE1BQU0sWUFBWSxTQUFpQztBQUNsRCxlQUFXLGVBQWUsS0FBSyxjQUFjO0FBQzVDLFlBQU0sWUFBWSxZQUFZLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Q7QUFBQSxFQUVTLFVBQWdCO0FBQ3hCLFNBQUssYUFBYSxNQUFNO0FBQ3hCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQUVBLE1BQU0sc0JBQXNCO0FBQUEsRUFRM0IsWUFBWSxnQkFBa0M7QUFIOUMsU0FBaUIsaUNBQWlDO0FBQ2xELFNBQWlCLDhCQUE4QjtBQUc5QyxRQUFJLGdCQUFnQjtBQUNuQixXQUFLLFdBQVcsSUFBSSxRQUFRLGtCQUFrQixjQUFjO0FBQzVELFdBQUssaUJBQWlCLEtBQUssU0FBUyxXQUFXLGFBQWEsV0FBVyxjQUFjLE9BQU87QUFBQSxJQUM3RixPQUFPO0FBQ04sV0FBSyxpQkFBaUIsQ0FBQztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBSSw2QkFBc0M7QUFDekMsV0FBTyxLQUFLLGVBQWUsS0FBSyw4QkFBOEIsS0FBSztBQUFBLEVBQ3BFO0FBQUEsRUFFQSxJQUFJLDJCQUEyQixPQUFnQjtBQUM5QyxTQUFLLGVBQWUsS0FBSyw4QkFBOEIsSUFBSTtBQUUzRCxTQUFLLFVBQVUsWUFBWTtBQUFBLEVBQzVCO0FBQUEsRUFFQSxJQUFJLDBCQUErQztBQUNsRCxXQUFPLEtBQUssZUFBZSxLQUFLLDJCQUEyQjtBQUFBLEVBQzVEO0FBQUEsRUFFQSxJQUFJLHdCQUF3QixPQUE0QjtBQUN2RCxTQUFLLGVBQWUsS0FBSywyQkFBMkIsSUFBSTtBQUV4RCxTQUFLLFVBQVUsWUFBWTtBQUFBLEVBQzVCO0FBQ0Q7QUFFQSxrQkFBa0IsK0JBQStCLDhCQUE4QixrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFsidHJ1c3RlZCJdCn0K
