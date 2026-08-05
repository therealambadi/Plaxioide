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
import { equals } from "../../../base/common/arrays.js";
import { createCancelablePromise, ThrottledDelayer } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { parse } from "../../../base/common/json.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { uppercaseFirstLetter } from "../../../base/common/strings.js";
import { isUndefined } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { FileOperationError, FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import {
  Change,
  getLastSyncResourceUri,
  IUserDataSyncLocalStoreService,
  IUserDataSyncLogService,
  IUserDataSyncEnablementService,
  IUserDataSyncStoreService,
  IUserDataSyncUtilService,
  MergeState,
  PREVIEW_DIR_NAME,
  SyncStatus,
  UserDataSyncError,
  UserDataSyncErrorCode,
  USER_DATA_SYNC_CONFIGURATION_SCOPE,
  USER_DATA_SYNC_SCHEME,
  getPathSegments
} from "./userDataSync.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
function isRemoteUserData(thing) {
  if (thing && (thing.ref !== void 0 && typeof thing.ref === "string" && thing.ref !== "") && (thing.syncData !== void 0 && (thing.syncData === null || isSyncData(thing.syncData)))) {
    return true;
  }
  return false;
}
function isSyncData(thing) {
  if (thing && (thing.version !== void 0 && typeof thing.version === "number") && (thing.content !== void 0 && typeof thing.content === "string")) {
    if (Object.keys(thing).length === 2) {
      return true;
    }
    if (Object.keys(thing).length === 3 && (thing.machineId !== void 0 && typeof thing.machineId === "string")) {
      return true;
    }
  }
  return false;
}
function getSyncResourceLogLabel(syncResource, profile) {
  return `${uppercaseFirstLetter(syncResource)}${profile.isDefault ? "" : ` (${profile.name})`}`;
}
var SyncStrategy = /* @__PURE__ */ ((SyncStrategy2) => {
  SyncStrategy2["Preview"] = "preview";
  SyncStrategy2["Merge"] = "merge";
  SyncStrategy2["PullOrPush"] = "pull-push";
  return SyncStrategy2;
})(SyncStrategy || {});
let AbstractSynchroniser = class extends Disposable {
  constructor(syncResource, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService) {
    super();
    this.syncResource = syncResource;
    this.collection = collection;
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncLocalStoreService = userDataSyncLocalStoreService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this.configurationService = configurationService;
    this.syncPreviewPromise = null;
    this._status = SyncStatus.Idle;
    this._onDidChangStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangStatus.event;
    this._conflicts = [];
    this._onDidChangeConflicts = this._register(new Emitter());
    this.onDidChangeConflicts = this._onDidChangeConflicts.event;
    this.localChangeTriggerThrottler = this._register(new ThrottledDelayer(50));
    this._onDidChangeLocal = this._register(new Emitter());
    this.onDidChangeLocal = this._onDidChangeLocal.event;
    this.lastSyncUserDataStateKey = `${this.collection ? `${this.collection}.` : ""}${this.syncResource.syncResource}.lastSyncUserData`;
    this.hasSyncResourceStateVersionChanged = false;
    this.syncHeaders = {};
    this.resource = this.syncResource.syncResource;
    this.syncResourceLogLabel = getSyncResourceLogLabel(syncResource.syncResource, syncResource.profile);
    this.extUri = uriIdentityService.extUri;
    this.syncFolder = this.extUri.joinPath(environmentService.userDataSyncHome, ...getPathSegments(syncResource.profile.isDefault ? void 0 : syncResource.profile.id, syncResource.syncResource));
    this.syncPreviewFolder = this.extUri.joinPath(this.syncFolder, PREVIEW_DIR_NAME);
    this.lastSyncResource = getLastSyncResourceUri(syncResource.profile.isDefault ? void 0 : syncResource.profile.id, syncResource.syncResource, environmentService, this.extUri);
    this.currentMachineIdPromise = getServiceMachineId(environmentService, fileService, storageService);
  }
  get status() {
    return this._status;
  }
  get conflicts() {
    return { ...this.syncResource, conflicts: this._conflicts };
  }
  triggerLocalChange() {
    this.localChangeTriggerThrottler.trigger(() => this.doTriggerLocalChange());
  }
  async doTriggerLocalChange() {
    if (this.status === SyncStatus.HasConflicts) {
      this.logService.info(`${this.syncResourceLogLabel}: In conflicts state and local change detected. Syncing again...`);
      const preview = await this.syncPreviewPromise;
      this.syncPreviewPromise = null;
      const status = await this.performSync(preview.remoteUserData, preview.lastSyncUserData, "merge" /* Merge */, this.getUserDataSyncConfiguration());
      this.setStatus(status);
    } else {
      this.logService.trace(`${this.syncResourceLogLabel}: Checking for local changes...`);
      const lastSyncUserData = await this.getLastSyncUserData();
      const hasRemoteChanged = lastSyncUserData ? await this.hasRemoteChanged(lastSyncUserData) : true;
      if (hasRemoteChanged) {
        this._onDidChangeLocal.fire();
      }
    }
  }
  setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      this._onDidChangStatus.fire(status);
    }
  }
  async sync(manifest, preview = false, userDataSyncConfiguration = this.getUserDataSyncConfiguration(), headers = {}) {
    try {
      this.syncHeaders = { ...headers };
      if (this.status === SyncStatus.HasConflicts) {
        this.logService.info(`${this.syncResourceLogLabel}: Skipped synchronizing ${this.resource.toLowerCase()} as there are conflicts.`);
        return this.syncPreviewPromise;
      }
      if (this.status === SyncStatus.Syncing) {
        this.logService.info(`${this.syncResourceLogLabel}: Skipped synchronizing ${this.resource.toLowerCase()} as it is running already.`);
        return this.syncPreviewPromise;
      }
      this.logService.trace(`${this.syncResourceLogLabel}: Started synchronizing ${this.resource.toLowerCase()}...`);
      this.setStatus(SyncStatus.Syncing);
      let status = SyncStatus.Idle;
      try {
        const lastSyncUserData = await this.getLastSyncUserData();
        const remoteUserData = await this.getLatestRemoteUserData(manifest, lastSyncUserData);
        status = await this.performSync(remoteUserData, lastSyncUserData, preview ? "preview" /* Preview */ : "merge" /* Merge */, userDataSyncConfiguration);
        if (status === SyncStatus.HasConflicts) {
          this.logService.info(`${this.syncResourceLogLabel}: Detected conflicts while synchronizing ${this.resource.toLowerCase()}.`);
        } else if (status === SyncStatus.Idle) {
          this.logService.trace(`${this.syncResourceLogLabel}: Finished synchronizing ${this.resource.toLowerCase()}.`);
        }
        return this.syncPreviewPromise || null;
      } finally {
        this.setStatus(status);
      }
    } finally {
      this.syncHeaders = {};
    }
  }
  async apply(force, headers = {}) {
    try {
      this.syncHeaders = { ...headers };
      const status = await this.doApply(force);
      this.setStatus(status);
      return this.syncPreviewPromise;
    } finally {
      this.syncHeaders = {};
    }
  }
  async replace(content) {
    const syncData = this.parseSyncData(content);
    if (!syncData) {
      return false;
    }
    await this.stop();
    try {
      this.logService.trace(`${this.syncResourceLogLabel}: Started resetting ${this.resource.toLowerCase()}...`);
      this.setStatus(SyncStatus.Syncing);
      const lastSyncUserData = await this.getLastSyncUserData();
      const remoteUserData = await this.getLatestRemoteUserData(null, lastSyncUserData);
      const isRemoteDataFromCurrentMachine = await this.isRemoteDataFromCurrentMachine(remoteUserData);
      const resourcePreviewResults = await this.generateSyncPreview({ ref: remoteUserData.ref, syncData }, lastSyncUserData, isRemoteDataFromCurrentMachine, this.getUserDataSyncConfiguration(), CancellationToken.None);
      const resourcePreviews = [];
      for (const resourcePreviewResult of resourcePreviewResults) {
        const acceptResult = await this.getAcceptResult(resourcePreviewResult, resourcePreviewResult.remoteResource, void 0, CancellationToken.None);
        const { remoteChange } = await this.getAcceptResult(resourcePreviewResult, resourcePreviewResult.previewResource, resourcePreviewResult.remoteContent, CancellationToken.None);
        resourcePreviews.push([resourcePreviewResult, { ...acceptResult, remoteChange: remoteChange !== Change.None ? remoteChange : Change.Modified }]);
      }
      await this.applyResult(remoteUserData, lastSyncUserData, resourcePreviews, false);
      this.logService.info(`${this.syncResourceLogLabel}: Finished resetting ${this.resource.toLowerCase()}.`);
    } finally {
      this.setStatus(SyncStatus.Idle);
    }
    return true;
  }
  async isRemoteDataFromCurrentMachine(remoteUserData) {
    const machineId = await this.currentMachineIdPromise;
    return !!remoteUserData.syncData?.machineId && remoteUserData.syncData.machineId === machineId;
  }
  async getLatestRemoteUserData(manifest, lastSyncUserData) {
    if (lastSyncUserData) {
      const latestRef = manifest ? manifest[this.resource] : void 0;
      if (lastSyncUserData.ref === latestRef) {
        return lastSyncUserData;
      }
      if (latestRef === void 0 && lastSyncUserData.syncData === null) {
        return lastSyncUserData;
      }
    }
    return this.getRemoteUserData(lastSyncUserData);
  }
  async performSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration) {
    if (remoteUserData.syncData && remoteUserData.syncData.version > this.version) {
      throw new UserDataSyncError(localize({ key: "incompatible", comment: ["This is an error while syncing a resource that its local version is not compatible with its remote version."] }, "Cannot sync {0} as its local version {1} is not compatible with its remote version {2}", this.resource, this.version, remoteUserData.syncData.version), UserDataSyncErrorCode.IncompatibleLocalContent, this.resource);
    }
    try {
      return await this.doSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration);
    } catch (e) {
      if (e instanceof UserDataSyncError) {
        switch (e.code) {
          case UserDataSyncErrorCode.LocalPreconditionFailed:
            this.logService.info(`${this.syncResourceLogLabel}: Failed to synchronize ${this.syncResourceLogLabel} as there is a new local version available. Synchronizing again...`);
            return this.performSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration);
          case UserDataSyncErrorCode.Conflict:
          case UserDataSyncErrorCode.PreconditionFailed:
            this.logService.info(`${this.syncResourceLogLabel}: Failed to synchronize as there is a new remote version available. Synchronizing again...`);
            remoteUserData = await this.getRemoteUserData(null);
            lastSyncUserData = await this.getLastSyncUserData();
            return this.performSync(remoteUserData, lastSyncUserData, "merge" /* Merge */, userDataSyncConfiguration);
        }
      }
      throw e;
    }
  }
  async doSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration) {
    try {
      const isRemoteDataFromCurrentMachine = await this.isRemoteDataFromCurrentMachine(remoteUserData);
      const acceptRemote = !isRemoteDataFromCurrentMachine && lastSyncUserData === null && this.getStoredLastSyncUserDataStateContent() !== void 0;
      const merge = strategy === "preview" /* Preview */ || strategy === "merge" /* Merge */ && !acceptRemote;
      const apply = strategy === "merge" /* Merge */ || strategy === "pull-push" /* PullOrPush */;
      if (!this.syncPreviewPromise) {
        this.syncPreviewPromise = createCancelablePromise((token) => this.doGenerateSyncResourcePreview(remoteUserData, lastSyncUserData, isRemoteDataFromCurrentMachine, merge, userDataSyncConfiguration, token));
      }
      let preview = await this.syncPreviewPromise;
      if (strategy === "merge" /* Merge */ && acceptRemote) {
        this.logService.info(`${this.syncResourceLogLabel}: Accepting remote because it was synced before and the last sync data is not available.`);
        for (const resourcePreview of preview.resourcePreviews) {
          preview = await this.accept(resourcePreview.remoteResource) || preview;
        }
      } else if (strategy === "pull-push" /* PullOrPush */) {
        for (const resourcePreview of preview.resourcePreviews) {
          if (resourcePreview.mergeState === MergeState.Accepted) {
            continue;
          }
          if (remoteUserData.ref === lastSyncUserData?.ref || isRemoteDataFromCurrentMachine) {
            preview = await this.accept(resourcePreview.localResource) ?? preview;
          } else {
            preview = await this.accept(resourcePreview.remoteResource) ?? preview;
          }
        }
      }
      this.updateConflicts(preview.resourcePreviews);
      if (preview.resourcePreviews.some(({ mergeState }) => mergeState === MergeState.Conflict)) {
        return SyncStatus.HasConflicts;
      }
      if (apply) {
        return await this.doApply(false);
      }
      return SyncStatus.Syncing;
    } catch (error) {
      this.syncPreviewPromise = null;
      throw error;
    }
  }
  async accept(resource, content) {
    await this.updateSyncResourcePreview(resource, async (resourcePreview) => {
      const acceptResult = await this.getAcceptResult(resourcePreview, resource, content, CancellationToken.None);
      resourcePreview.acceptResult = acceptResult;
      resourcePreview.mergeState = MergeState.Accepted;
      resourcePreview.localChange = acceptResult.localChange;
      resourcePreview.remoteChange = acceptResult.remoteChange;
      return resourcePreview;
    });
    return this.syncPreviewPromise;
  }
  async discard(resource) {
    await this.updateSyncResourcePreview(resource, async (resourcePreview) => {
      const mergeResult = await this.getMergeResult(resourcePreview, CancellationToken.None);
      await this.fileService.writeFile(resourcePreview.previewResource, VSBuffer.fromString(mergeResult.content || ""));
      resourcePreview.acceptResult = void 0;
      resourcePreview.mergeState = MergeState.Preview;
      resourcePreview.localChange = mergeResult.localChange;
      resourcePreview.remoteChange = mergeResult.remoteChange;
      return resourcePreview;
    });
    return this.syncPreviewPromise;
  }
  async updateSyncResourcePreview(resource, updateResourcePreview) {
    if (!this.syncPreviewPromise) {
      return;
    }
    let preview = await this.syncPreviewPromise;
    const index = preview.resourcePreviews.findIndex(({ localResource, remoteResource, previewResource }) => this.extUri.isEqual(localResource, resource) || this.extUri.isEqual(remoteResource, resource) || this.extUri.isEqual(previewResource, resource));
    if (index === -1) {
      return;
    }
    this.syncPreviewPromise = createCancelablePromise(async (token) => {
      const resourcePreviews = [...preview.resourcePreviews];
      resourcePreviews[index] = await updateResourcePreview(resourcePreviews[index]);
      return {
        ...preview,
        resourcePreviews
      };
    });
    preview = await this.syncPreviewPromise;
    this.updateConflicts(preview.resourcePreviews);
    if (preview.resourcePreviews.some(({ mergeState }) => mergeState === MergeState.Conflict)) {
      this.setStatus(SyncStatus.HasConflicts);
    } else {
      this.setStatus(SyncStatus.Syncing);
    }
  }
  async doApply(force) {
    if (!this.syncPreviewPromise) {
      return SyncStatus.Idle;
    }
    const preview = await this.syncPreviewPromise;
    if (preview.resourcePreviews.some(({ mergeState }) => mergeState === MergeState.Conflict)) {
      return SyncStatus.HasConflicts;
    }
    if (preview.resourcePreviews.some(({ mergeState }) => mergeState !== MergeState.Accepted)) {
      return SyncStatus.Syncing;
    }
    await this.applyResult(preview.remoteUserData, preview.lastSyncUserData, preview.resourcePreviews.map((resourcePreview) => [resourcePreview, resourcePreview.acceptResult]), force);
    this.syncPreviewPromise = null;
    await this.clearPreviewFolder();
    return SyncStatus.Idle;
  }
  async clearPreviewFolder() {
    try {
      await this.fileService.del(this.syncPreviewFolder, { recursive: true });
    } catch (error) {
    }
  }
  updateConflicts(resourcePreviews) {
    const conflicts = resourcePreviews.filter(({ mergeState }) => mergeState === MergeState.Conflict);
    if (!equals(this._conflicts, conflicts, (a, b) => this.extUri.isEqual(a.previewResource, b.previewResource))) {
      this._conflicts = conflicts;
      this._onDidChangeConflicts.fire(this.conflicts);
    }
  }
  async hasPreviouslySynced() {
    const lastSyncData = await this.getLastSyncUserData();
    return !!lastSyncData && lastSyncData.syncData !== null;
  }
  async resolvePreviewContent(uri) {
    const syncPreview = this.syncPreviewPromise ? await this.syncPreviewPromise : null;
    if (syncPreview) {
      for (const resourcePreview of syncPreview.resourcePreviews) {
        if (this.extUri.isEqual(resourcePreview.acceptedResource, uri)) {
          return resourcePreview.acceptResult ? resourcePreview.acceptResult.content : null;
        }
        if (this.extUri.isEqual(resourcePreview.remoteResource, uri)) {
          return resourcePreview.remoteContent;
        }
        if (this.extUri.isEqual(resourcePreview.localResource, uri)) {
          return resourcePreview.localContent;
        }
        if (this.extUri.isEqual(resourcePreview.baseResource, uri)) {
          return resourcePreview.baseContent;
        }
      }
    }
    return null;
  }
  async resetLocal() {
    this.storageService.remove(this.lastSyncUserDataStateKey, StorageScope.APPLICATION);
    try {
      await this.fileService.del(this.lastSyncResource);
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(error);
      }
    }
  }
  async doGenerateSyncResourcePreview(remoteUserData, lastSyncUserData, isRemoteDataFromCurrentMachine, merge, userDataSyncConfiguration, token) {
    const resourcePreviewResults = await this.generateSyncPreview(remoteUserData, lastSyncUserData, isRemoteDataFromCurrentMachine, userDataSyncConfiguration, token);
    const resourcePreviews = [];
    for (const resourcePreviewResult of resourcePreviewResults) {
      const acceptedResource = resourcePreviewResult.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "accepted" });
      if (resourcePreviewResult.localChange === Change.None && resourcePreviewResult.remoteChange === Change.None) {
        resourcePreviews.push({
          ...resourcePreviewResult,
          acceptedResource,
          acceptResult: { content: null, localChange: Change.None, remoteChange: Change.None },
          mergeState: MergeState.Accepted
        });
      } else {
        const mergeResult = merge ? await this.getMergeResult(resourcePreviewResult, token) : void 0;
        if (token.isCancellationRequested) {
          break;
        }
        await this.fileService.writeFile(resourcePreviewResult.previewResource, VSBuffer.fromString(mergeResult?.content || ""));
        const acceptResult = mergeResult && !mergeResult.hasConflicts ? await this.getAcceptResult(resourcePreviewResult, resourcePreviewResult.previewResource, void 0, token) : void 0;
        resourcePreviews.push({
          ...resourcePreviewResult,
          acceptResult,
          mergeState: mergeResult?.hasConflicts ? MergeState.Conflict : acceptResult ? MergeState.Accepted : MergeState.Preview,
          localChange: acceptResult ? acceptResult.localChange : mergeResult ? mergeResult.localChange : resourcePreviewResult.localChange,
          remoteChange: acceptResult ? acceptResult.remoteChange : mergeResult ? mergeResult.remoteChange : resourcePreviewResult.remoteChange
        });
      }
    }
    return { syncResource: this.resource, profile: this.syncResource.profile, remoteUserData, lastSyncUserData, resourcePreviews, isLastSyncFromCurrentMachine: isRemoteDataFromCurrentMachine };
  }
  async getLastSyncUserData() {
    const storedLastSyncUserDataStateContent = this.getStoredLastSyncUserDataStateContent();
    if (!storedLastSyncUserDataStateContent) {
      this.logService.info(`${this.syncResourceLogLabel}: Last sync data state does not exist.`);
      return null;
    }
    const lastSyncUserDataState = JSON.parse(storedLastSyncUserDataStateContent);
    const resourceSyncStateVersion = this.userDataSyncEnablementService.getResourceSyncStateVersion(this.resource);
    this.hasSyncResourceStateVersionChanged = !!lastSyncUserDataState.version && !!resourceSyncStateVersion && lastSyncUserDataState.version !== resourceSyncStateVersion;
    if (this.hasSyncResourceStateVersionChanged) {
      this.logService.info(`${this.syncResourceLogLabel}: Reset last sync state because last sync state version ${lastSyncUserDataState.version} is not compatible with current sync state version ${resourceSyncStateVersion}.`);
      await this.resetLocal();
      return null;
    }
    let syncData = void 0;
    let retrial = 1;
    while (syncData === void 0 && retrial++ < 6) {
      try {
        const lastSyncStoredRemoteUserData = await this.readLastSyncStoredRemoteUserData();
        if (lastSyncStoredRemoteUserData) {
          if (lastSyncStoredRemoteUserData.ref === lastSyncUserDataState.ref) {
            syncData = lastSyncStoredRemoteUserData.syncData;
          } else {
            this.logService.info(`${this.syncResourceLogLabel}: Last sync data stored locally is not same as the last sync state.`);
          }
        }
        break;
      } catch (error) {
        if (error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
          this.logService.info(`${this.syncResourceLogLabel}: Last sync resource does not exist locally.`);
          break;
        } else if (error instanceof UserDataSyncError) {
          throw error;
        } else {
          this.logService.error(error, retrial);
        }
      }
    }
    if (syncData === void 0) {
      try {
        const content = await this.userDataSyncStoreService.resolveResourceContent(this.resource, lastSyncUserDataState.ref, this.collection, this.syncHeaders);
        syncData = content === null ? null : this.parseSyncData(content);
        await this.writeLastSyncStoredRemoteUserData({ ref: lastSyncUserDataState.ref, syncData });
      } catch (error) {
        if (error instanceof UserDataSyncError && error.code === UserDataSyncErrorCode.NotFound) {
          this.logService.info(`${this.syncResourceLogLabel}: Last sync resource does not exist remotely.`);
        } else {
          throw error;
        }
      }
    }
    if (syncData === void 0) {
      return null;
    }
    return {
      ...lastSyncUserDataState,
      syncData
    };
  }
  async updateLastSyncUserData(lastSyncRemoteUserData, additionalProps = {}) {
    if (additionalProps["ref"] || additionalProps["version"]) {
      throw new Error("Cannot have core properties as additional");
    }
    const version = this.userDataSyncEnablementService.getResourceSyncStateVersion(this.resource);
    const lastSyncUserDataState = {
      ref: lastSyncRemoteUserData.ref,
      version,
      ...additionalProps
    };
    this.storageService.store(this.lastSyncUserDataStateKey, JSON.stringify(lastSyncUserDataState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    await this.writeLastSyncStoredRemoteUserData(lastSyncRemoteUserData);
  }
  getStoredLastSyncUserDataStateContent() {
    return this.storageService.get(this.lastSyncUserDataStateKey, StorageScope.APPLICATION);
  }
  async readLastSyncStoredRemoteUserData() {
    const content = (await this.fileService.readFile(this.lastSyncResource)).value.toString();
    try {
      const lastSyncStoredRemoteUserData = content ? JSON.parse(content) : void 0;
      if (isRemoteUserData(lastSyncStoredRemoteUserData)) {
        return lastSyncStoredRemoteUserData;
      }
    } catch (e) {
      this.logService.error(e);
    }
    return void 0;
  }
  async writeLastSyncStoredRemoteUserData(lastSyncRemoteUserData) {
    await this.fileService.writeFile(this.lastSyncResource, VSBuffer.fromString(JSON.stringify(lastSyncRemoteUserData)));
  }
  async getRemoteUserData(lastSyncData) {
    const { ref, content } = await this.getUserData(lastSyncData);
    let syncData = null;
    if (content !== null) {
      syncData = this.parseSyncData(content);
    }
    return { ref, syncData };
  }
  parseSyncData(content) {
    try {
      const syncData = JSON.parse(content);
      if (isSyncData(syncData)) {
        return syncData;
      }
    } catch (error) {
      this.logService.error(error);
    }
    throw new UserDataSyncError(localize("incompatible sync data", "Cannot parse sync data as it is not compatible with the current version."), UserDataSyncErrorCode.IncompatibleRemoteContent, this.resource);
  }
  async getUserData(lastSyncData) {
    const lastSyncUserData = lastSyncData ? { ref: lastSyncData.ref, content: lastSyncData.syncData ? JSON.stringify(lastSyncData.syncData) : null } : null;
    return this.userDataSyncStoreService.readResource(this.resource, lastSyncUserData, this.collection, this.syncHeaders);
  }
  async updateRemoteUserData(content, ref) {
    const machineId = await this.currentMachineIdPromise;
    const syncData = { version: this.version, machineId, content };
    try {
      ref = await this.userDataSyncStoreService.writeResource(this.resource, JSON.stringify(syncData), ref, this.collection, this.syncHeaders);
      return { ref, syncData };
    } catch (error) {
      if (error instanceof UserDataSyncError && error.code === UserDataSyncErrorCode.TooLarge) {
        error = new UserDataSyncError(error.message, error.code, this.resource);
      }
      throw error;
    }
  }
  async backupLocal(content) {
    const syncData = { version: this.version, content };
    return this.userDataSyncLocalStoreService.writeResource(this.resource, JSON.stringify(syncData), /* @__PURE__ */ new Date(), this.syncResource.profile.isDefault ? void 0 : this.syncResource.profile.id);
  }
  async stop() {
    if (this.status === SyncStatus.Idle) {
      return;
    }
    this.logService.trace(`${this.syncResourceLogLabel}: Stopping synchronizing ${this.resource.toLowerCase()}.`);
    if (this.syncPreviewPromise) {
      this.syncPreviewPromise.cancel();
      this.syncPreviewPromise = null;
    }
    this.updateConflicts([]);
    await this.clearPreviewFolder();
    this.setStatus(SyncStatus.Idle);
    this.logService.info(`${this.syncResourceLogLabel}: Stopped synchronizing ${this.resource.toLowerCase()}.`);
  }
  getUserDataSyncConfiguration() {
    return this.configurationService.getValue(USER_DATA_SYNC_CONFIGURATION_SCOPE);
  }
};
AbstractSynchroniser = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IUserDataSyncStoreService),
  __decorateParam(6, IUserDataSyncLocalStoreService),
  __decorateParam(7, IUserDataSyncEnablementService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IUserDataSyncLogService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IUriIdentityService)
], AbstractSynchroniser);
let AbstractFileSynchroniser = class extends AbstractSynchroniser {
  constructor(file, syncResource, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService) {
    super(syncResource, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
    this.file = file;
    this._register(this.fileService.watch(this.extUri.dirname(file)));
    this._register(this.fileService.onDidFilesChange((e) => this.onFileChanges(e)));
  }
  async getLocalFileContent() {
    try {
      return await this.fileService.readFile(this.file);
    } catch (error) {
      return null;
    }
  }
  async updateLocalFileContent(newContent, oldContent, force) {
    try {
      if (oldContent) {
        await this.fileService.writeFile(this.file, VSBuffer.fromString(newContent), force ? void 0 : oldContent);
      } else {
        await this.fileService.createFile(this.file, VSBuffer.fromString(newContent), { overwrite: force });
      }
    } catch (e) {
      if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND || e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
        throw new UserDataSyncError(e.message, UserDataSyncErrorCode.LocalPreconditionFailed);
      } else {
        throw e;
      }
    }
  }
  async deleteLocalFile() {
    try {
      await this.fileService.del(this.file);
    } catch (e) {
      if (!(e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND)) {
        throw e;
      }
    }
  }
  onFileChanges(e) {
    if (!e.contains(this.file)) {
      return;
    }
    this.triggerLocalChange();
  }
};
AbstractFileSynchroniser = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IUserDataSyncStoreService),
  __decorateParam(7, IUserDataSyncLocalStoreService),
  __decorateParam(8, IUserDataSyncEnablementService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IUserDataSyncLogService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IUriIdentityService)
], AbstractFileSynchroniser);
let AbstractJsonFileSynchroniser = class extends AbstractFileSynchroniser {
  constructor(file, syncResource, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, userDataSyncUtilService, configurationService, uriIdentityService) {
    super(file, syncResource, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
    this.userDataSyncUtilService = userDataSyncUtilService;
    this._formattingOptions = void 0;
  }
  hasErrors(content, isArray) {
    const parseErrors = [];
    const result = parse(content, parseErrors, { allowEmptyContent: true, allowTrailingComma: true });
    return parseErrors.length > 0 || !isUndefined(result) && isArray !== Array.isArray(result);
  }
  getFormattingOptions() {
    if (!this._formattingOptions) {
      this._formattingOptions = this.userDataSyncUtilService.resolveFormattingOptions(this.file);
    }
    return this._formattingOptions;
  }
};
AbstractJsonFileSynchroniser = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IUserDataSyncStoreService),
  __decorateParam(7, IUserDataSyncLocalStoreService),
  __decorateParam(8, IUserDataSyncEnablementService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IUserDataSyncLogService),
  __decorateParam(11, IUserDataSyncUtilService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IUriIdentityService)
], AbstractJsonFileSynchroniser);
let AbstractInitializer = class {
  constructor(resource, userDataProfilesService, environmentService, logService, fileService, storageService, uriIdentityService) {
    this.resource = resource;
    this.userDataProfilesService = userDataProfilesService;
    this.environmentService = environmentService;
    this.logService = logService;
    this.fileService = fileService;
    this.storageService = storageService;
    this.extUri = uriIdentityService.extUri;
    this.lastSyncResource = getLastSyncResourceUri(void 0, this.resource, environmentService, this.extUri);
  }
  async initialize({ ref, content }) {
    if (!content) {
      this.logService.info("Remote content does not exist.", this.resource);
      return;
    }
    const syncData = this.parseSyncData(content);
    if (!syncData) {
      return;
    }
    try {
      await this.doInitialize({ ref, syncData });
    } catch (error) {
      this.logService.error(error);
    }
  }
  parseSyncData(content) {
    try {
      const syncData = JSON.parse(content);
      if (isSyncData(syncData)) {
        return syncData;
      }
    } catch (error) {
      this.logService.error(error);
    }
    this.logService.info("Cannot parse sync data as it is not compatible with the current version.", this.resource);
    return void 0;
  }
  async updateLastSyncUserData(lastSyncRemoteUserData, additionalProps = {}) {
    if (additionalProps["ref"] || additionalProps["version"]) {
      throw new Error("Cannot have core properties as additional");
    }
    const lastSyncUserDataState = {
      ref: lastSyncRemoteUserData.ref,
      version: void 0,
      ...additionalProps
    };
    this.storageService.store(`${this.resource}.lastSyncUserData`, JSON.stringify(lastSyncUserDataState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    await this.fileService.writeFile(this.lastSyncResource, VSBuffer.fromString(JSON.stringify(lastSyncRemoteUserData)));
  }
};
AbstractInitializer = __decorateClass([
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IUriIdentityService)
], AbstractInitializer);
export {
  AbstractFileSynchroniser,
  AbstractInitializer,
  AbstractJsonFileSynchroniser,
  AbstractSynchroniser,
  SyncStrategy,
  getSyncResourceLogLabel,
  isRemoteUserData,
  isSyncData
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2Fic3RyYWN0U3luY2hyb25pemVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgVGhyb3R0bGVkRGVsYXllciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBwYXJzZSwgUGFyc2VFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgRm9ybWF0dGluZ09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRm9ybWF0dGVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dFVyaSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyB1cHBlcmNhc2VGaXJzdExldHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUhlYWRlcnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL3BhcnRzL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VzRXZlbnQsIEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvblJlc3VsdCwgSUZpbGVDb250ZW50LCBJRmlsZVNlcnZpY2UsIHRvRmlsZU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGdldFNlcnZpY2VNYWNoaW5lSWQgfSBmcm9tICcuLi8uLi9leHRlcm5hbFNlcnZpY2VzL2NvbW1vbi9zZXJ2aWNlTWFjaGluZUlkLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHtcblx0Q2hhbmdlLCBnZXRMYXN0U3luY1Jlc291cmNlVXJpLCBJUmVtb3RlVXNlckRhdGEsIElSZXNvdXJjZVByZXZpZXcgYXMgSUJhc2VSZXNvdXJjZVByZXZpZXcsIElTeW5jRGF0YSxcblx0SVVzZXJEYXRhU3luY1Jlc291cmNlUHJldmlldyBhcyBJQmFzZVN5bmNSZXNvdXJjZVByZXZpZXcsIElVc2VyRGF0YSwgSVVzZXJEYXRhU3luY1Jlc291cmNlSW5pdGlhbGl6ZXIsIElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSxcblx0SVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24sIElVc2VyRGF0YVN5bmNocm9uaXNlciwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSxcblx0SVVzZXJEYXRhU3luY1V0aWxTZXJ2aWNlLCBNZXJnZVN0YXRlLCBQUkVWSUVXX0RJUl9OQU1FLCBTeW5jUmVzb3VyY2UsIFN5bmNTdGF0dXMsIFVzZXJEYXRhU3luY0Vycm9yLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUsXG5cdFVTRVJfREFUQV9TWU5DX0NPTkZJR1VSQVRJT05fU0NPUEUsIFVTRVJfREFUQV9TWU5DX1NDSEVNRSwgSVVzZXJEYXRhUmVzb3VyY2VNYW5pZmVzdCwgZ2V0UGF0aFNlZ21lbnRzLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VDb25mbGljdHMsXG5cdElVc2VyRGF0YVN5bmNSZXNvdXJjZSwgSVVzZXJEYXRhU3luY1Jlc291cmNlUHJldmlld1xufSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1JlbW90ZVVzZXJEYXRhKHRoaW5nOiBhbnkpOiB0aGluZyBpcyBJUmVtb3RlVXNlckRhdGEge1xuXHRpZiAodGhpbmdcblx0XHQmJiAodGhpbmcucmVmICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHRoaW5nLnJlZiA9PT0gJ3N0cmluZycgJiYgdGhpbmcucmVmICE9PSAnJylcblx0XHQmJiAodGhpbmcuc3luY0RhdGEgIT09IHVuZGVmaW5lZCAmJiAodGhpbmcuc3luY0RhdGEgPT09IG51bGwgfHwgaXNTeW5jRGF0YSh0aGluZy5zeW5jRGF0YSkpKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTeW5jRGF0YSh0aGluZzogYW55KTogdGhpbmcgaXMgSVN5bmNEYXRhIHtcblx0aWYgKHRoaW5nXG5cdFx0JiYgKHRoaW5nLnZlcnNpb24gIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgdGhpbmcudmVyc2lvbiA9PT0gJ251bWJlcicpXG5cdFx0JiYgKHRoaW5nLmNvbnRlbnQgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgdGhpbmcuY29udGVudCA9PT0gJ3N0cmluZycpKSB7XG5cblx0XHQvLyBiYWNrd2FyZCBjb21wYXRpYmlsaXR5XG5cdFx0aWYgKE9iamVjdC5rZXlzKHRoaW5nKS5sZW5ndGggPT09IDIpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChPYmplY3Qua2V5cyh0aGluZykubGVuZ3RoID09PSAzXG5cdFx0XHQmJiAodGhpbmcubWFjaGluZUlkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIHRoaW5nLm1hY2hpbmVJZCA9PT0gJ3N0cmluZycpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTeW5jUmVzb3VyY2VMb2dMYWJlbChzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSwgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSk6IHN0cmluZyB7XG5cdHJldHVybiBgJHt1cHBlcmNhc2VGaXJzdExldHRlcihzeW5jUmVzb3VyY2UpfSR7cHJvZmlsZS5pc0RlZmF1bHQgPyAnJyA6IGAgKCR7cHJvZmlsZS5uYW1lfSlgfWA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlc291cmNlUHJldmlldyB7XG5cblx0cmVhZG9ubHkgYmFzZVJlc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IGJhc2VDb250ZW50OiBzdHJpbmcgfCBudWxsO1xuXG5cdHJlYWRvbmx5IHJlbW90ZVJlc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IHJlbW90ZUNvbnRlbnQ6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IHJlbW90ZUNoYW5nZTogQ2hhbmdlO1xuXG5cdHJlYWRvbmx5IGxvY2FsUmVzb3VyY2U6IFVSSTtcblx0cmVhZG9ubHkgbG9jYWxDb250ZW50OiBzdHJpbmcgfCBudWxsO1xuXHRyZWFkb25seSBsb2NhbENoYW5nZTogQ2hhbmdlO1xuXG5cdHJlYWRvbmx5IHByZXZpZXdSZXNvdXJjZTogVVJJO1xuXHRyZWFkb25seSBhY2NlcHRlZFJlc291cmNlOiBVUkk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUFjY2VwdFJlc3VsdCB7XG5cdHJlYWRvbmx5IGNvbnRlbnQ6IHN0cmluZyB8IG51bGw7XG5cdHJlYWRvbmx5IGxvY2FsQ2hhbmdlOiBDaGFuZ2U7XG5cdHJlYWRvbmx5IHJlbW90ZUNoYW5nZTogQ2hhbmdlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNZXJnZVJlc3VsdCBleHRlbmRzIElBY2NlcHRSZXN1bHQge1xuXHRyZWFkb25seSBoYXNDb25mbGljdHM6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJRWRpdGFibGVSZXNvdXJjZVByZXZpZXcgZXh0ZW5kcyBJQmFzZVJlc291cmNlUHJldmlldywgSVJlc291cmNlUHJldmlldyB7XG5cdGxvY2FsQ2hhbmdlOiBDaGFuZ2U7XG5cdHJlbW90ZUNoYW5nZTogQ2hhbmdlO1xuXHRtZXJnZVN0YXRlOiBNZXJnZVN0YXRlO1xuXHRhY2NlcHRSZXN1bHQ/OiBJQWNjZXB0UmVzdWx0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTeW5jUmVzb3VyY2VQcmV2aWV3IGV4dGVuZHMgSUJhc2VTeW5jUmVzb3VyY2VQcmV2aWV3IHtcblx0cmVhZG9ubHkgcmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YTtcblx0cmVhZG9ubHkgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbDtcblx0cmVhZG9ubHkgcmVzb3VyY2VQcmV2aWV3czogSUVkaXRhYmxlUmVzb3VyY2VQcmV2aWV3W107XG59XG5cbmludGVyZmFjZSBJTGFzdFN5bmNVc2VyRGF0YVN0YXRlIHtcblx0cmVhZG9ubHkgcmVmOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHZlcnNpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0W2tleTogc3RyaW5nXTogYW55O1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBTeW5jU3RyYXRlZ3kge1xuXHRQcmV2aWV3ID0gJ3ByZXZpZXcnLCAvLyBNZXJnZSB0aGUgbG9jYWwgYW5kIHJlbW90ZSBkYXRhIHdpdGhvdXQgYXBwbHlpbmcuXG5cdE1lcmdlID0gJ21lcmdlJywgLy8gTWVyZ2UgdGhlIGxvY2FsIGFuZCByZW1vdGUgZGF0YSBhbmQgYXBwbHkuXG5cdFB1bGxPclB1c2ggPSAncHVsbC1wdXNoJywgLy8gUHVsbCB0aGUgcmVtb3RlIGRhdGEgb3IgcHVzaCB0aGUgbG9jYWwgZGF0YS5cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0U3luY2hyb25pc2VyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNocm9uaXNlciB7XG5cblx0cHJpdmF0ZSBzeW5jUHJldmlld1Byb21pc2U6IENhbmNlbGFibGVQcm9taXNlPElTeW5jUmVzb3VyY2VQcmV2aWV3PiB8IG51bGwgPSBudWxsO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBzeW5jRm9sZGVyOiBVUkk7XG5cdHByb3RlY3RlZCByZWFkb25seSBzeW5jUHJldmlld0ZvbGRlcjogVVJJO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgZXh0VXJpOiBJRXh0VXJpO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgY3VycmVudE1hY2hpbmVJZFByb21pc2U6IFByb21pc2U8c3RyaW5nPjtcblxuXHRwcml2YXRlIF9zdGF0dXM6IFN5bmNTdGF0dXMgPSBTeW5jU3RhdHVzLklkbGU7XG5cdGdldCBzdGF0dXMoKTogU3luY1N0YXR1cyB7IHJldHVybiB0aGlzLl9zdGF0dXM7IH1cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ1N0YXR1czogRW1pdHRlcjxTeW5jU3RhdHVzPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFN5bmNTdGF0dXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVN0YXR1czogRXZlbnQ8U3luY1N0YXR1cz4gPSB0aGlzLl9vbkRpZENoYW5nU3RhdHVzLmV2ZW50O1xuXG5cdHByaXZhdGUgX2NvbmZsaWN0czogSUJhc2VSZXNvdXJjZVByZXZpZXdbXSA9IFtdO1xuXHRnZXQgY29uZmxpY3RzKCk6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUNvbmZsaWN0cyB7IHJldHVybiB7IC4uLnRoaXMuc3luY1Jlc291cmNlLCBjb25mbGljdHM6IHRoaXMuX2NvbmZsaWN0cyB9OyB9XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlQ29uZmxpY3RzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVVzZXJEYXRhU3luY1Jlc291cmNlQ29uZmxpY3RzPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb25mbGljdHMgPSB0aGlzLl9vbkRpZENoYW5nZUNvbmZsaWN0cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxvY2FsQ2hhbmdlVHJpZ2dlclRocm90dGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaHJvdHRsZWREZWxheWVyPHZvaWQ+KDUwKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlTG9jYWw6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VMb2NhbDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUxvY2FsLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBsYXN0U3luY1Jlc291cmNlOiBVUkk7XG5cdHByaXZhdGUgcmVhZG9ubHkgbGFzdFN5bmNVc2VyRGF0YVN0YXRlS2V5ID0gYCR7dGhpcy5jb2xsZWN0aW9uID8gYCR7dGhpcy5jb2xsZWN0aW9ufS5gIDogJyd9JHt0aGlzLnN5bmNSZXNvdXJjZS5zeW5jUmVzb3VyY2V9Lmxhc3RTeW5jVXNlckRhdGFgO1xuXHRwcml2YXRlIGhhc1N5bmNSZXNvdXJjZVN0YXRlVmVyc2lvbkNoYW5nZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IHN5bmNSZXNvdXJjZUxvZ0xhYmVsOiBzdHJpbmc7XG5cblx0cHJvdGVjdGVkIHN5bmNIZWFkZXJzOiBJSGVhZGVycyA9IHt9O1xuXG5cdHJlYWRvbmx5IHJlc291cmNlID0gdGhpcy5zeW5jUmVzb3VyY2Uuc3luY1Jlc291cmNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHN5bmNSZXNvdXJjZTogSVVzZXJEYXRhU3luY1Jlc291cmNlLFxuXHRcdHJlYWRvbmx5IGNvbGxlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASUZpbGVTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbCA9IGdldFN5bmNSZXNvdXJjZUxvZ0xhYmVsKHN5bmNSZXNvdXJjZS5zeW5jUmVzb3VyY2UsIHN5bmNSZXNvdXJjZS5wcm9maWxlKTtcblx0XHR0aGlzLmV4dFVyaSA9IHVyaUlkZW50aXR5U2VydmljZS5leHRVcmk7XG5cdFx0dGhpcy5zeW5jRm9sZGVyID0gdGhpcy5leHRVcmkuam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIC4uLmdldFBhdGhTZWdtZW50cyhzeW5jUmVzb3VyY2UucHJvZmlsZS5pc0RlZmF1bHQgPyB1bmRlZmluZWQgOiBzeW5jUmVzb3VyY2UucHJvZmlsZS5pZCwgc3luY1Jlc291cmNlLnN5bmNSZXNvdXJjZSkpO1xuXHRcdHRoaXMuc3luY1ByZXZpZXdGb2xkZXIgPSB0aGlzLmV4dFVyaS5qb2luUGF0aCh0aGlzLnN5bmNGb2xkZXIsIFBSRVZJRVdfRElSX05BTUUpO1xuXHRcdHRoaXMubGFzdFN5bmNSZXNvdXJjZSA9IGdldExhc3RTeW5jUmVzb3VyY2VVcmkoc3luY1Jlc291cmNlLnByb2ZpbGUuaXNEZWZhdWx0ID8gdW5kZWZpbmVkIDogc3luY1Jlc291cmNlLnByb2ZpbGUuaWQsIHN5bmNSZXNvdXJjZS5zeW5jUmVzb3VyY2UsIGVudmlyb25tZW50U2VydmljZSwgdGhpcy5leHRVcmkpO1xuXHRcdHRoaXMuY3VycmVudE1hY2hpbmVJZFByb21pc2UgPSBnZXRTZXJ2aWNlTWFjaGluZUlkKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCB0cmlnZ2VyTG9jYWxDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5sb2NhbENoYW5nZVRyaWdnZXJUaHJvdHRsZXIudHJpZ2dlcigoKSA9PiB0aGlzLmRvVHJpZ2dlckxvY2FsQ2hhbmdlKCkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGRvVHJpZ2dlckxvY2FsQ2hhbmdlKCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gU3luYyBhZ2FpbiBpZiBjdXJyZW50IHN0YXR1cyBpcyBpbiBjb25mbGljdHNcblx0XHRpZiAodGhpcy5zdGF0dXMgPT09IFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogSW4gY29uZmxpY3RzIHN0YXRlIGFuZCBsb2NhbCBjaGFuZ2UgZGV0ZWN0ZWQuIFN5bmNpbmcgYWdhaW4uLi5gKTtcblx0XHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZSE7XG5cdFx0XHR0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZSA9IG51bGw7XG5cdFx0XHRjb25zdCBzdGF0dXMgPSBhd2FpdCB0aGlzLnBlcmZvcm1TeW5jKHByZXZpZXcucmVtb3RlVXNlckRhdGEsIHByZXZpZXcubGFzdFN5bmNVc2VyRGF0YSwgU3luY1N0cmF0ZWd5Lk1lcmdlLCB0aGlzLmdldFVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24oKSk7XG5cdFx0XHR0aGlzLnNldFN0YXR1cyhzdGF0dXMpO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIGlmIGxvY2FsIGNoYW5nZSBjYXVzZXMgcmVtb3RlIGNoYW5nZVxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBDaGVja2luZyBmb3IgbG9jYWwgY2hhbmdlcy4uLmApO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRoaXMuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgaGFzUmVtb3RlQ2hhbmdlZCA9IGxhc3RTeW5jVXNlckRhdGEgPyBhd2FpdCB0aGlzLmhhc1JlbW90ZUNoYW5nZWQobGFzdFN5bmNVc2VyRGF0YSkgOiB0cnVlO1xuXHRcdFx0aWYgKGhhc1JlbW90ZUNoYW5nZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VMb2NhbC5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHNldFN0YXR1cyhzdGF0dXM6IFN5bmNTdGF0dXMpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdHVzICE9PSBzdGF0dXMpIHtcblx0XHRcdHRoaXMuX3N0YXR1cyA9IHN0YXR1cztcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdTdGF0dXMuZmlyZShzdGF0dXMpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHN5bmMobWFuaWZlc3Q6IElVc2VyRGF0YVJlc291cmNlTWFuaWZlc3QgfCBudWxsLCBwcmV2aWV3OiBib29sZWFuID0gZmFsc2UsIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb246IElVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uID0gdGhpcy5nZXRVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uKCksIGhlYWRlcnM6IElIZWFkZXJzID0ge30pOiBQcm9taXNlPElVc2VyRGF0YVN5bmNSZXNvdXJjZVByZXZpZXcgfCBudWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuc3luY0hlYWRlcnMgPSB7IC4uLmhlYWRlcnMgfTtcblxuXHRcdFx0aWYgKHRoaXMuc3RhdHVzID09PSBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cykge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogU2tpcHBlZCBzeW5jaHJvbml6aW5nICR7dGhpcy5yZXNvdXJjZS50b0xvd2VyQ2FzZSgpfSBhcyB0aGVyZSBhcmUgY29uZmxpY3RzLmApO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zeW5jUHJldmlld1Byb21pc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLnN0YXR1cyA9PT0gU3luY1N0YXR1cy5TeW5jaW5nKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBTa2lwcGVkIHN5bmNocm9uaXppbmcgJHt0aGlzLnJlc291cmNlLnRvTG93ZXJDYXNlKCl9IGFzIGl0IGlzIHJ1bm5pbmcgYWxyZWFkeS5gKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3luY1ByZXZpZXdQcm9taXNlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFN0YXJ0ZWQgc3luY2hyb25pemluZyAke3RoaXMucmVzb3VyY2UudG9Mb3dlckNhc2UoKX0uLi5gKTtcblx0XHRcdHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuU3luY2luZyk7XG5cblx0XHRcdGxldCBzdGF0dXM6IFN5bmNTdGF0dXMgPSBTeW5jU3RhdHVzLklkbGU7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RSZW1vdGVVc2VyRGF0YShtYW5pZmVzdCwgbGFzdFN5bmNVc2VyRGF0YSk7XG5cdFx0XHRcdHN0YXR1cyA9IGF3YWl0IHRoaXMucGVyZm9ybVN5bmMocmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGEsIHByZXZpZXcgPyBTeW5jU3RyYXRlZ3kuUHJldmlldyA6IFN5bmNTdHJhdGVneS5NZXJnZSwgdXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbik7XG5cdFx0XHRcdGlmIChzdGF0dXMgPT09IFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IERldGVjdGVkIGNvbmZsaWN0cyB3aGlsZSBzeW5jaHJvbml6aW5nICR7dGhpcy5yZXNvdXJjZS50b0xvd2VyQ2FzZSgpfS5gKTtcblx0XHRcdFx0fSBlbHNlIGlmIChzdGF0dXMgPT09IFN5bmNTdGF0dXMuSWRsZSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogRmluaXNoZWQgc3luY2hyb25pemluZyAke3RoaXMucmVzb3VyY2UudG9Mb3dlckNhc2UoKX0uYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuc3luY1ByZXZpZXdQcm9taXNlIHx8IG51bGw7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLnNldFN0YXR1cyhzdGF0dXMpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnN5bmNIZWFkZXJzID0ge307XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYXBwbHkoZm9yY2U6IGJvb2xlYW4sIGhlYWRlcnM6IElIZWFkZXJzID0ge30pOiBQcm9taXNlPElTeW5jUmVzb3VyY2VQcmV2aWV3IHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLnN5bmNIZWFkZXJzID0geyAuLi5oZWFkZXJzIH07XG5cblx0XHRcdGNvbnN0IHN0YXR1cyA9IGF3YWl0IHRoaXMuZG9BcHBseShmb3JjZSk7XG5cdFx0XHR0aGlzLnNldFN0YXR1cyhzdGF0dXMpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5zeW5jUHJldmlld1Byb21pc2U7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc3luY0hlYWRlcnMgPSB7fTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXBsYWNlKGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHN5bmNEYXRhID0gdGhpcy5wYXJzZVN5bmNEYXRhKGNvbnRlbnQpO1xuXHRcdGlmICghc3luY0RhdGEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnN0b3AoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFN0YXJ0ZWQgcmVzZXR0aW5nICR7dGhpcy5yZXNvdXJjZS50b0xvd2VyQ2FzZSgpfS4uLmApO1xuXHRcdFx0dGhpcy5zZXRTdGF0dXMoU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGNvbnN0IGxhc3RTeW5jVXNlckRhdGEgPSBhd2FpdCB0aGlzLmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRcdGNvbnN0IHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RSZW1vdGVVc2VyRGF0YShudWxsLCBsYXN0U3luY1VzZXJEYXRhKTtcblx0XHRcdGNvbnN0IGlzUmVtb3RlRGF0YUZyb21DdXJyZW50TWFjaGluZSA9IGF3YWl0IHRoaXMuaXNSZW1vdGVEYXRhRnJvbUN1cnJlbnRNYWNoaW5lKHJlbW90ZVVzZXJEYXRhKTtcblxuXHRcdFx0LyogdXNlIHJlcGxhY2Ugc3luYyBkYXRhICovXG5cdFx0XHRjb25zdCByZXNvdXJjZVByZXZpZXdSZXN1bHRzID0gYXdhaXQgdGhpcy5nZW5lcmF0ZVN5bmNQcmV2aWV3KHsgcmVmOiByZW1vdGVVc2VyRGF0YS5yZWYsIHN5bmNEYXRhIH0sIGxhc3RTeW5jVXNlckRhdGEsIGlzUmVtb3RlRGF0YUZyb21DdXJyZW50TWFjaGluZSwgdGhpcy5nZXRVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uKCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0XHRjb25zdCByZXNvdXJjZVByZXZpZXdzOiBbSVJlc291cmNlUHJldmlldywgSUFjY2VwdFJlc3VsdF1bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCByZXNvdXJjZVByZXZpZXdSZXN1bHQgb2YgcmVzb3VyY2VQcmV2aWV3UmVzdWx0cykge1xuXHRcdFx0XHQvKiBBY2NlcHQgcmVtb3RlIHJlc291cmNlICovXG5cdFx0XHRcdGNvbnN0IGFjY2VwdFJlc3VsdDogSUFjY2VwdFJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QWNjZXB0UmVzdWx0KHJlc291cmNlUHJldmlld1Jlc3VsdCwgcmVzb3VyY2VQcmV2aWV3UmVzdWx0LnJlbW90ZVJlc291cmNlLCB1bmRlZmluZWQsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHQvKiBjb21wdXRlIHJlbW90ZSBjaGFuZ2UgKi9cblx0XHRcdFx0Y29uc3QgeyByZW1vdGVDaGFuZ2UgfSA9IGF3YWl0IHRoaXMuZ2V0QWNjZXB0UmVzdWx0KHJlc291cmNlUHJldmlld1Jlc3VsdCwgcmVzb3VyY2VQcmV2aWV3UmVzdWx0LnByZXZpZXdSZXNvdXJjZSwgcmVzb3VyY2VQcmV2aWV3UmVzdWx0LnJlbW90ZUNvbnRlbnQsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRyZXNvdXJjZVByZXZpZXdzLnB1c2goW3Jlc291cmNlUHJldmlld1Jlc3VsdCwgeyAuLi5hY2NlcHRSZXN1bHQsIHJlbW90ZUNoYW5nZTogcmVtb3RlQ2hhbmdlICE9PSBDaGFuZ2UuTm9uZSA/IHJlbW90ZUNoYW5nZSA6IENoYW5nZS5Nb2RpZmllZCB9XSk7XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRoaXMuYXBwbHlSZXN1bHQocmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGEsIHJlc291cmNlUHJldmlld3MsIGZhbHNlKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBGaW5pc2hlZCByZXNldHRpbmcgJHt0aGlzLnJlc291cmNlLnRvTG93ZXJDYXNlKCl9LmApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldFN0YXR1cyhTeW5jU3RhdHVzLklkbGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpc1JlbW90ZURhdGFGcm9tQ3VycmVudE1hY2hpbmUocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IG1hY2hpbmVJZCA9IGF3YWl0IHRoaXMuY3VycmVudE1hY2hpbmVJZFByb21pc2U7XG5cdFx0cmV0dXJuICEhcmVtb3RlVXNlckRhdGEuc3luY0RhdGE/Lm1hY2hpbmVJZCAmJiByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YS5tYWNoaW5lSWQgPT09IG1hY2hpbmVJZDtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRMYXRlc3RSZW1vdGVVc2VyRGF0YShtYW5pZmVzdDogSVVzZXJEYXRhUmVzb3VyY2VNYW5pZmVzdCB8IG51bGwsIGxhc3RTeW5jVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSB8IG51bGwpOiBQcm9taXNlPElSZW1vdGVVc2VyRGF0YT4ge1xuXHRcdGlmIChsYXN0U3luY1VzZXJEYXRhKSB7XG5cblx0XHRcdGNvbnN0IGxhdGVzdFJlZiA9IG1hbmlmZXN0ID8gbWFuaWZlc3RbdGhpcy5yZXNvdXJjZV0gOiB1bmRlZmluZWQ7XG5cblx0XHRcdC8vIExhc3QgdGltZSBzeW5jZWQgcmVzb3VyY2UgYW5kIGxhdGVzdCByZXNvdXJjZSBvbiBzZXJ2ZXIgYXJlIHNhbWVcblx0XHRcdGlmIChsYXN0U3luY1VzZXJEYXRhLnJlZiA9PT0gbGF0ZXN0UmVmKSB7XG5cdFx0XHRcdHJldHVybiBsYXN0U3luY1VzZXJEYXRhO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGVyZSBpcyBubyByZXNvdXJjZSBvbiBzZXJ2ZXIgYW5kIGxhc3QgdGltZSBpdCB3YXMgc3luY2VkIHdpdGggbm8gcmVzb3VyY2Vcblx0XHRcdGlmIChsYXRlc3RSZWYgPT09IHVuZGVmaW5lZCAmJiBsYXN0U3luY1VzZXJEYXRhLnN5bmNEYXRhID09PSBudWxsKSB7XG5cdFx0XHRcdHJldHVybiBsYXN0U3luY1VzZXJEYXRhO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5nZXRSZW1vdGVVc2VyRGF0YShsYXN0U3luY1VzZXJEYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcGVyZm9ybVN5bmMocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCwgc3RyYXRlZ3k6IFN5bmNTdHJhdGVneSwgdXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbjogSVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24pOiBQcm9taXNlPFN5bmNTdGF0dXM+IHtcblx0XHRpZiAocmVtb3RlVXNlckRhdGEuc3luY0RhdGEgJiYgcmVtb3RlVXNlckRhdGEuc3luY0RhdGEudmVyc2lvbiA+IHRoaXMudmVyc2lvbikge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY0Vycm9yKGxvY2FsaXplKHsga2V5OiAnaW5jb21wYXRpYmxlJywgY29tbWVudDogWydUaGlzIGlzIGFuIGVycm9yIHdoaWxlIHN5bmNpbmcgYSByZXNvdXJjZSB0aGF0IGl0cyBsb2NhbCB2ZXJzaW9uIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggaXRzIHJlbW90ZSB2ZXJzaW9uLiddIH0sIFwiQ2Fubm90IHN5bmMgezB9IGFzIGl0cyBsb2NhbCB2ZXJzaW9uIHsxfSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIGl0cyByZW1vdGUgdmVyc2lvbiB7Mn1cIiwgdGhpcy5yZXNvdXJjZSwgdGhpcy52ZXJzaW9uLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YS52ZXJzaW9uKSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkluY29tcGF0aWJsZUxvY2FsQ29udGVudCwgdGhpcy5yZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRvU3luYyhyZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YSwgc3RyYXRlZ3ksIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmIChlIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IpIHtcblx0XHRcdFx0c3dpdGNoIChlLmNvZGUpIHtcblxuXHRcdFx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsUHJlY29uZGl0aW9uRmFpbGVkOlxuXHRcdFx0XHRcdFx0Ly8gUmVqZWN0ZWQgYXMgdGhlcmUgaXMgYSBuZXcgbG9jYWwgdmVyc2lvbi4gU3luY2luZyBhZ2Fpbi4uLlxuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IEZhaWxlZCB0byBzeW5jaHJvbml6ZSAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9IGFzIHRoZXJlIGlzIGEgbmV3IGxvY2FsIHZlcnNpb24gYXZhaWxhYmxlLiBTeW5jaHJvbml6aW5nIGFnYWluLi4uYCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wZXJmb3JtU3luYyhyZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YSwgc3RyYXRlZ3ksIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24pO1xuXG5cdFx0XHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuQ29uZmxpY3Q6XG5cdFx0XHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuUHJlY29uZGl0aW9uRmFpbGVkOlxuXHRcdFx0XHRcdFx0Ly8gUmVqZWN0ZWQgYXMgdGhlcmUgaXMgYSBuZXcgcmVtb3RlIHZlcnNpb24uIFN5bmNpbmcgYWdhaW4uLi5cblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBGYWlsZWQgdG8gc3luY2hyb25pemUgYXMgdGhlcmUgaXMgYSBuZXcgcmVtb3RlIHZlcnNpb24gYXZhaWxhYmxlLiBTeW5jaHJvbml6aW5nIGFnYWluLi4uYCk7XG5cblx0XHRcdFx0XHRcdC8vIEF2b2lkIGNhY2hlIGFuZCBnZXQgbGF0ZXN0IHJlbW90ZSB1c2VyIGRhdGEgLSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTA2MjRcblx0XHRcdFx0XHRcdHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRSZW1vdGVVc2VyRGF0YShudWxsKTtcblxuXHRcdFx0XHRcdFx0Ly8gR2V0IHRoZSBsYXRlc3QgbGFzdCBzeW5jIHVzZXIgZGF0YS4gQmVjYXVzZSBtdWx0aXBsZSBwYXJhbGxlbCBzeW5jcyAoaW4gV2ViKSBjb3VsZCBzaGFyZSBzYW1lIGxhc3Qgc3luYyBkYXRhXG5cdFx0XHRcdFx0XHQvLyBhbmQgb25lIG9mIHRoZW0gc3VjY2Vzc2Z1bGx5IHVwZGF0ZWQgcmVtb3RlIGFuZCBsYXN0IHN5bmMgc3RhdGUuXG5cdFx0XHRcdFx0XHRsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnBlcmZvcm1TeW5jKHJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhLCBTeW5jU3RyYXRlZ3kuTWVyZ2UsIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBkb1N5bmMocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCwgc3RyYXRlZ3k6IFN5bmNTdHJhdGVneSwgdXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbjogSVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24pOiBQcm9taXNlPFN5bmNTdGF0dXM+IHtcblx0XHR0cnkge1xuXG5cdFx0XHRjb25zdCBpc1JlbW90ZURhdGFGcm9tQ3VycmVudE1hY2hpbmUgPSBhd2FpdCB0aGlzLmlzUmVtb3RlRGF0YUZyb21DdXJyZW50TWFjaGluZShyZW1vdGVVc2VyRGF0YSk7XG5cdFx0XHRjb25zdCBhY2NlcHRSZW1vdGUgPSAhaXNSZW1vdGVEYXRhRnJvbUN1cnJlbnRNYWNoaW5lICYmIGxhc3RTeW5jVXNlckRhdGEgPT09IG51bGwgJiYgdGhpcy5nZXRTdG9yZWRMYXN0U3luY1VzZXJEYXRhU3RhdGVDb250ZW50KCkgIT09IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IG1lcmdlID0gc3RyYXRlZ3kgPT09IFN5bmNTdHJhdGVneS5QcmV2aWV3IHx8IChzdHJhdGVneSA9PT0gU3luY1N0cmF0ZWd5Lk1lcmdlICYmICFhY2NlcHRSZW1vdGUpO1xuXHRcdFx0Y29uc3QgYXBwbHkgPSBzdHJhdGVneSA9PT0gU3luY1N0cmF0ZWd5Lk1lcmdlIHx8IHN0cmF0ZWd5ID09PSBTeW5jU3RyYXRlZ3kuUHVsbE9yUHVzaDtcblxuXHRcdFx0Ly8gZ2VuZXJhdGUgb3IgdXNlIGV4aXN0aW5nIHByZXZpZXdcblx0XHRcdGlmICghdGhpcy5zeW5jUHJldmlld1Byb21pc2UpIHtcblx0XHRcdFx0dGhpcy5zeW5jUHJldmlld1Byb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PiB0aGlzLmRvR2VuZXJhdGVTeW5jUmVzb3VyY2VQcmV2aWV3KHJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhLCBpc1JlbW90ZURhdGFGcm9tQ3VycmVudE1hY2hpbmUsIG1lcmdlLCB1c2VyRGF0YVN5bmNDb25maWd1cmF0aW9uLCB0b2tlbikpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRoaXMuc3luY1ByZXZpZXdQcm9taXNlO1xuXG5cdFx0XHRpZiAoc3RyYXRlZ3kgPT09IFN5bmNTdHJhdGVneS5NZXJnZSAmJiBhY2NlcHRSZW1vdGUpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IEFjY2VwdGluZyByZW1vdGUgYmVjYXVzZSBpdCB3YXMgc3luY2VkIGJlZm9yZSBhbmQgdGhlIGxhc3Qgc3luYyBkYXRhIGlzIG5vdCBhdmFpbGFibGUuYCk7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2VQcmV2aWV3IG9mIHByZXZpZXcucmVzb3VyY2VQcmV2aWV3cykge1xuXHRcdFx0XHRcdHByZXZpZXcgPSAoYXdhaXQgdGhpcy5hY2NlcHQocmVzb3VyY2VQcmV2aWV3LnJlbW90ZVJlc291cmNlKSkgfHwgcHJldmlldztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRlbHNlIGlmIChzdHJhdGVneSA9PT0gU3luY1N0cmF0ZWd5LlB1bGxPclB1c2gpIHtcblx0XHRcdFx0Zm9yIChjb25zdCByZXNvdXJjZVByZXZpZXcgb2YgcHJldmlldy5yZXNvdXJjZVByZXZpZXdzKSB7XG5cdFx0XHRcdFx0aWYgKHJlc291cmNlUHJldmlldy5tZXJnZVN0YXRlID09PSBNZXJnZVN0YXRlLkFjY2VwdGVkKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHJlbW90ZVVzZXJEYXRhLnJlZiA9PT0gbGFzdFN5bmNVc2VyRGF0YT8ucmVmIHx8IGlzUmVtb3RlRGF0YUZyb21DdXJyZW50TWFjaGluZSkge1xuXHRcdFx0XHRcdFx0cHJldmlldyA9IChhd2FpdCB0aGlzLmFjY2VwdChyZXNvdXJjZVByZXZpZXcubG9jYWxSZXNvdXJjZSkpID8/IHByZXZpZXc7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHByZXZpZXcgPSAoYXdhaXQgdGhpcy5hY2NlcHQocmVzb3VyY2VQcmV2aWV3LnJlbW90ZVJlc291cmNlKSkgPz8gcHJldmlldztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVDb25mbGljdHMocHJldmlldy5yZXNvdXJjZVByZXZpZXdzKTtcblx0XHRcdGlmIChwcmV2aWV3LnJlc291cmNlUHJldmlld3Muc29tZSgoeyBtZXJnZVN0YXRlIH0pID0+IG1lcmdlU3RhdGUgPT09IE1lcmdlU3RhdGUuQ29uZmxpY3QpKSB7XG5cdFx0XHRcdHJldHVybiBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cztcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFwcGx5KSB7XG5cdFx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRvQXBwbHkoZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gU3luY1N0YXR1cy5TeW5jaW5nO1xuXG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gcmVzZXQgcHJldmlldyBvbiBlcnJvclxuXHRcdFx0dGhpcy5zeW5jUHJldmlld1Byb21pc2UgPSBudWxsO1xuXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBhY2NlcHQocmVzb3VyY2U6IFVSSSwgY29udGVudD86IHN0cmluZyB8IG51bGwpOiBQcm9taXNlPElTeW5jUmVzb3VyY2VQcmV2aWV3IHwgbnVsbD4ge1xuXHRcdGF3YWl0IHRoaXMudXBkYXRlU3luY1Jlc291cmNlUHJldmlldyhyZXNvdXJjZSwgYXN5bmMgKHJlc291cmNlUHJldmlldykgPT4ge1xuXHRcdFx0Y29uc3QgYWNjZXB0UmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBY2NlcHRSZXN1bHQocmVzb3VyY2VQcmV2aWV3LCByZXNvdXJjZSwgY29udGVudCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRyZXNvdXJjZVByZXZpZXcuYWNjZXB0UmVzdWx0ID0gYWNjZXB0UmVzdWx0O1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3Lm1lcmdlU3RhdGUgPSBNZXJnZVN0YXRlLkFjY2VwdGVkO1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3LmxvY2FsQ2hhbmdlID0gYWNjZXB0UmVzdWx0LmxvY2FsQ2hhbmdlO1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNoYW5nZSA9IGFjY2VwdFJlc3VsdC5yZW1vdGVDaGFuZ2U7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VQcmV2aWV3O1xuXHRcdH0pO1xuXHRcdHJldHVybiB0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZTtcblx0fVxuXG5cdGFzeW5jIGRpc2NhcmQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN5bmNSZXNvdXJjZVByZXZpZXcgfCBudWxsPiB7XG5cdFx0YXdhaXQgdGhpcy51cGRhdGVTeW5jUmVzb3VyY2VQcmV2aWV3KHJlc291cmNlLCBhc3luYyAocmVzb3VyY2VQcmV2aWV3KSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZVJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0TWVyZ2VSZXN1bHQocmVzb3VyY2VQcmV2aWV3LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHJlc291cmNlUHJldmlldy5wcmV2aWV3UmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcobWVyZ2VSZXN1bHQuY29udGVudCB8fCAnJykpO1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3LmFjY2VwdFJlc3VsdCA9IHVuZGVmaW5lZDtcblx0XHRcdHJlc291cmNlUHJldmlldy5tZXJnZVN0YXRlID0gTWVyZ2VTdGF0ZS5QcmV2aWV3O1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3LmxvY2FsQ2hhbmdlID0gbWVyZ2VSZXN1bHQubG9jYWxDaGFuZ2U7XG5cdFx0XHRyZXNvdXJjZVByZXZpZXcucmVtb3RlQ2hhbmdlID0gbWVyZ2VSZXN1bHQucmVtb3RlQ2hhbmdlO1xuXHRcdFx0cmV0dXJuIHJlc291cmNlUHJldmlldztcblx0XHR9KTtcblx0XHRyZXR1cm4gdGhpcy5zeW5jUHJldmlld1Byb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZVN5bmNSZXNvdXJjZVByZXZpZXcocmVzb3VyY2U6IFVSSSwgdXBkYXRlUmVzb3VyY2VQcmV2aWV3OiAocmVzb3VyY2VQcmV2aWV3OiBJRWRpdGFibGVSZXNvdXJjZVByZXZpZXcpID0+IFByb21pc2U8SUVkaXRhYmxlUmVzb3VyY2VQcmV2aWV3Pik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5zeW5jUHJldmlld1Byb21pc2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRoaXMuc3luY1ByZXZpZXdQcm9taXNlO1xuXHRcdGNvbnN0IGluZGV4ID0gcHJldmlldy5yZXNvdXJjZVByZXZpZXdzLmZpbmRJbmRleCgoeyBsb2NhbFJlc291cmNlLCByZW1vdGVSZXNvdXJjZSwgcHJldmlld1Jlc291cmNlIH0pID0+XG5cdFx0XHR0aGlzLmV4dFVyaS5pc0VxdWFsKGxvY2FsUmVzb3VyY2UsIHJlc291cmNlKSB8fCB0aGlzLmV4dFVyaS5pc0VxdWFsKHJlbW90ZVJlc291cmNlLCByZXNvdXJjZSkgfHwgdGhpcy5leHRVcmkuaXNFcXVhbChwcmV2aWV3UmVzb3VyY2UsIHJlc291cmNlKSk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc3luY1ByZXZpZXdQcm9taXNlID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgdG9rZW4gPT4ge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VQcmV2aWV3cyA9IFsuLi5wcmV2aWV3LnJlc291cmNlUHJldmlld3NdO1xuXHRcdFx0cmVzb3VyY2VQcmV2aWV3c1tpbmRleF0gPSBhd2FpdCB1cGRhdGVSZXNvdXJjZVByZXZpZXcocmVzb3VyY2VQcmV2aWV3c1tpbmRleF0pO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Li4ucHJldmlldyxcblx0XHRcdFx0cmVzb3VyY2VQcmV2aWV3c1xuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdHByZXZpZXcgPSBhd2FpdCB0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZTtcblx0XHR0aGlzLnVwZGF0ZUNvbmZsaWN0cyhwcmV2aWV3LnJlc291cmNlUHJldmlld3MpO1xuXHRcdGlmIChwcmV2aWV3LnJlc291cmNlUHJldmlld3Muc29tZSgoeyBtZXJnZVN0YXRlIH0pID0+IG1lcmdlU3RhdGUgPT09IE1lcmdlU3RhdGUuQ29uZmxpY3QpKSB7XG5cdFx0XHR0aGlzLnNldFN0YXR1cyhTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0FwcGx5KGZvcmNlOiBib29sZWFuKTogUHJvbWlzZTxTeW5jU3RhdHVzPiB7XG5cdFx0aWYgKCF0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZSkge1xuXHRcdFx0cmV0dXJuIFN5bmNTdGF0dXMuSWRsZTtcblx0XHR9XG5cblx0XHRjb25zdCBwcmV2aWV3ID0gYXdhaXQgdGhpcy5zeW5jUHJldmlld1Byb21pc2U7XG5cblx0XHQvLyBjaGVjayBmb3IgY29uZmxpY3RzXG5cdFx0aWYgKHByZXZpZXcucmVzb3VyY2VQcmV2aWV3cy5zb21lKCh7IG1lcmdlU3RhdGUgfSkgPT4gbWVyZ2VTdGF0ZSA9PT0gTWVyZ2VTdGF0ZS5Db25mbGljdCkpIHtcblx0XHRcdHJldHVybiBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cztcblx0XHR9XG5cblx0XHQvLyBjaGVjayBpZiBhbGwgYXJlIGFjY2VwdGVkXG5cdFx0aWYgKHByZXZpZXcucmVzb3VyY2VQcmV2aWV3cy5zb21lKCh7IG1lcmdlU3RhdGUgfSkgPT4gbWVyZ2VTdGF0ZSAhPT0gTWVyZ2VTdGF0ZS5BY2NlcHRlZCkpIHtcblx0XHRcdHJldHVybiBTeW5jU3RhdHVzLlN5bmNpbmc7XG5cdFx0fVxuXG5cdFx0Ly8gYXBwbHkgcHJldmlld1xuXHRcdGF3YWl0IHRoaXMuYXBwbHlSZXN1bHQocHJldmlldy5yZW1vdGVVc2VyRGF0YSwgcHJldmlldy5sYXN0U3luY1VzZXJEYXRhLCBwcmV2aWV3LnJlc291cmNlUHJldmlld3MubWFwKHJlc291cmNlUHJldmlldyA9PiAoW3Jlc291cmNlUHJldmlldywgcmVzb3VyY2VQcmV2aWV3LmFjY2VwdFJlc3VsdCFdKSksIGZvcmNlKTtcblxuXHRcdC8vIHJlc2V0IHByZXZpZXdcblx0XHR0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZSA9IG51bGw7XG5cblx0XHQvLyByZXNldCBwcmV2aWV3IGZvbGRlclxuXHRcdGF3YWl0IHRoaXMuY2xlYXJQcmV2aWV3Rm9sZGVyKCk7XG5cblx0XHRyZXR1cm4gU3luY1N0YXR1cy5JZGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjbGVhclByZXZpZXdGb2xkZXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHRoaXMuc3luY1ByZXZpZXdGb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7IC8qIElnbm9yZSAqLyB9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZsaWN0cyhyZXNvdXJjZVByZXZpZXdzOiBJRWRpdGFibGVSZXNvdXJjZVByZXZpZXdbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZsaWN0cyA9IHJlc291cmNlUHJldmlld3MuZmlsdGVyKCh7IG1lcmdlU3RhdGUgfSkgPT4gbWVyZ2VTdGF0ZSA9PT0gTWVyZ2VTdGF0ZS5Db25mbGljdCk7XG5cdFx0aWYgKCFlcXVhbHModGhpcy5fY29uZmxpY3RzLCBjb25mbGljdHMsIChhLCBiKSA9PiB0aGlzLmV4dFVyaS5pc0VxdWFsKGEucHJldmlld1Jlc291cmNlLCBiLnByZXZpZXdSZXNvdXJjZSkpKSB7XG5cdFx0XHR0aGlzLl9jb25mbGljdHMgPSBjb25mbGljdHM7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZsaWN0cy5maXJlKHRoaXMuY29uZmxpY3RzKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBoYXNQcmV2aW91c2x5U3luY2VkKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGxhc3RTeW5jRGF0YSA9IGF3YWl0IHRoaXMuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdHJldHVybiAhIWxhc3RTeW5jRGF0YSAmJiBsYXN0U3luY0RhdGEuc3luY0RhdGEgIT09IG51bGwgLyogYG51bGxgIHN5bmMgZGF0YSBpbXBsaWVzIHJlc291cmNlIGlzIG5vdCBzeW5jZWQgKi87XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcmVzb2x2ZVByZXZpZXdDb250ZW50KHVyaTogVVJJKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0Y29uc3Qgc3luY1ByZXZpZXcgPSB0aGlzLnN5bmNQcmV2aWV3UHJvbWlzZSA/IGF3YWl0IHRoaXMuc3luY1ByZXZpZXdQcm9taXNlIDogbnVsbDtcblx0XHRpZiAoc3luY1ByZXZpZXcpIHtcblx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2VQcmV2aWV3IG9mIHN5bmNQcmV2aWV3LnJlc291cmNlUHJldmlld3MpIHtcblx0XHRcdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2VQcmV2aWV3LmFjY2VwdGVkUmVzb3VyY2UsIHVyaSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzb3VyY2VQcmV2aWV3LmFjY2VwdFJlc3VsdCA/IHJlc291cmNlUHJldmlldy5hY2NlcHRSZXN1bHQuY29udGVudCA6IG51bGw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2VQcmV2aWV3LnJlbW90ZVJlc291cmNlLCB1cmkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc291cmNlUHJldmlldy5yZW1vdGVDb250ZW50O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLmV4dFVyaS5pc0VxdWFsKHJlc291cmNlUHJldmlldy5sb2NhbFJlc291cmNlLCB1cmkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc291cmNlUHJldmlldy5sb2NhbENvbnRlbnQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2VQcmV2aWV3LmJhc2VSZXNvdXJjZSwgdXJpKSkge1xuXHRcdFx0XHRcdHJldHVybiByZXNvdXJjZVByZXZpZXcuYmFzZUNvbnRlbnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyByZXNldExvY2FsKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHRoaXMubGFzdFN5bmNVc2VyRGF0YVN0YXRlS2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbCh0aGlzLmxhc3RTeW5jUmVzb3VyY2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9HZW5lcmF0ZVN5bmNSZXNvdXJjZVByZXZpZXcocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCwgaXNSZW1vdGVEYXRhRnJvbUN1cnJlbnRNYWNoaW5lOiBib29sZWFuLCBtZXJnZTogYm9vbGVhbiwgdXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbjogSVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVN5bmNSZXNvdXJjZVByZXZpZXc+IHtcblx0XHRjb25zdCByZXNvdXJjZVByZXZpZXdSZXN1bHRzID0gYXdhaXQgdGhpcy5nZW5lcmF0ZVN5bmNQcmV2aWV3KHJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhLCBpc1JlbW90ZURhdGFGcm9tQ3VycmVudE1hY2hpbmUsIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24sIHRva2VuKTtcblxuXHRcdGNvbnN0IHJlc291cmNlUHJldmlld3M6IElFZGl0YWJsZVJlc291cmNlUHJldmlld1tdID0gW107XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZVByZXZpZXdSZXN1bHQgb2YgcmVzb3VyY2VQcmV2aWV3UmVzdWx0cykge1xuXHRcdFx0Y29uc3QgYWNjZXB0ZWRSZXNvdXJjZSA9IHJlc291cmNlUHJldmlld1Jlc3VsdC5wcmV2aWV3UmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBhdXRob3JpdHk6ICdhY2NlcHRlZCcgfSk7XG5cblx0XHRcdC8qIE5vIGNoYW5nZSAtPiBBY2NlcHQgKi9cblx0XHRcdGlmIChyZXNvdXJjZVByZXZpZXdSZXN1bHQubG9jYWxDaGFuZ2UgPT09IENoYW5nZS5Ob25lICYmIHJlc291cmNlUHJldmlld1Jlc3VsdC5yZW1vdGVDaGFuZ2UgPT09IENoYW5nZS5Ob25lKSB7XG5cdFx0XHRcdHJlc291cmNlUHJldmlld3MucHVzaCh7XG5cdFx0XHRcdFx0Li4ucmVzb3VyY2VQcmV2aWV3UmVzdWx0LFxuXHRcdFx0XHRcdGFjY2VwdGVkUmVzb3VyY2UsXG5cdFx0XHRcdFx0YWNjZXB0UmVzdWx0OiB7IGNvbnRlbnQ6IG51bGwsIGxvY2FsQ2hhbmdlOiBDaGFuZ2UuTm9uZSwgcmVtb3RlQ2hhbmdlOiBDaGFuZ2UuTm9uZSB9LFxuXHRcdFx0XHRcdG1lcmdlU3RhdGU6IE1lcmdlU3RhdGUuQWNjZXB0ZWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8qIENoYW5nZWQgLT4gQXBwbHkgPyAoTWVyZ2UgPyBDb25mbGljdCB8IEFjY2VwdCkgOiBQcmV2aWV3ICovXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0LyogTWVyZ2UgKi9cblx0XHRcdFx0Y29uc3QgbWVyZ2VSZXN1bHQgPSBtZXJnZSA/IGF3YWl0IHRoaXMuZ2V0TWVyZ2VSZXN1bHQocmVzb3VyY2VQcmV2aWV3UmVzdWx0LCB0b2tlbikgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHJlc291cmNlUHJldmlld1Jlc3VsdC5wcmV2aWV3UmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcobWVyZ2VSZXN1bHQ/LmNvbnRlbnQgfHwgJycpKTtcblxuXHRcdFx0XHQvKiBDb25mbGljdCB8IEFjY2VwdCAqL1xuXHRcdFx0XHRjb25zdCBhY2NlcHRSZXN1bHQgPSBtZXJnZVJlc3VsdCAmJiAhbWVyZ2VSZXN1bHQuaGFzQ29uZmxpY3RzXG5cdFx0XHRcdFx0LyogQWNjZXB0IGlmIG1lcmdlZCBhbmQgdGhlcmUgYXJlIG5vIGNvbmZsaWN0cyAqL1xuXHRcdFx0XHRcdD8gYXdhaXQgdGhpcy5nZXRBY2NlcHRSZXN1bHQocmVzb3VyY2VQcmV2aWV3UmVzdWx0LCByZXNvdXJjZVByZXZpZXdSZXN1bHQucHJldmlld1Jlc291cmNlLCB1bmRlZmluZWQsIHRva2VuKVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdHJlc291cmNlUHJldmlld3MucHVzaCh7XG5cdFx0XHRcdFx0Li4ucmVzb3VyY2VQcmV2aWV3UmVzdWx0LFxuXHRcdFx0XHRcdGFjY2VwdFJlc3VsdCxcblx0XHRcdFx0XHRtZXJnZVN0YXRlOiBtZXJnZVJlc3VsdD8uaGFzQ29uZmxpY3RzID8gTWVyZ2VTdGF0ZS5Db25mbGljdCA6IGFjY2VwdFJlc3VsdCA/IE1lcmdlU3RhdGUuQWNjZXB0ZWQgOiBNZXJnZVN0YXRlLlByZXZpZXcsXG5cdFx0XHRcdFx0bG9jYWxDaGFuZ2U6IGFjY2VwdFJlc3VsdCA/IGFjY2VwdFJlc3VsdC5sb2NhbENoYW5nZSA6IG1lcmdlUmVzdWx0ID8gbWVyZ2VSZXN1bHQubG9jYWxDaGFuZ2UgOiByZXNvdXJjZVByZXZpZXdSZXN1bHQubG9jYWxDaGFuZ2UsXG5cdFx0XHRcdFx0cmVtb3RlQ2hhbmdlOiBhY2NlcHRSZXN1bHQgPyBhY2NlcHRSZXN1bHQucmVtb3RlQ2hhbmdlIDogbWVyZ2VSZXN1bHQgPyBtZXJnZVJlc3VsdC5yZW1vdGVDaGFuZ2UgOiByZXNvdXJjZVByZXZpZXdSZXN1bHQucmVtb3RlQ2hhbmdlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHN5bmNSZXNvdXJjZTogdGhpcy5yZXNvdXJjZSwgcHJvZmlsZTogdGhpcy5zeW5jUmVzb3VyY2UucHJvZmlsZSwgcmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGEsIHJlc291cmNlUHJldmlld3MsIGlzTGFzdFN5bmNGcm9tQ3VycmVudE1hY2hpbmU6IGlzUmVtb3RlRGF0YUZyb21DdXJyZW50TWFjaGluZSB9O1xuXHR9XG5cblx0YXN5bmMgZ2V0TGFzdFN5bmNVc2VyRGF0YSgpOiBQcm9taXNlPElSZW1vdGVVc2VyRGF0YSB8IG51bGw+IHtcblx0XHRjb25zdCBzdG9yZWRMYXN0U3luY1VzZXJEYXRhU3RhdGVDb250ZW50ID0gdGhpcy5nZXRTdG9yZWRMYXN0U3luY1VzZXJEYXRhU3RhdGVDb250ZW50KCk7XG5cblx0XHQvLyBMYXN0IFN5bmMgRGF0YSBzdGF0ZSBkb2VzIG5vdCBleGlzdFxuXHRcdGlmICghc3RvcmVkTGFzdFN5bmNVc2VyRGF0YVN0YXRlQ29udGVudCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IExhc3Qgc3luYyBkYXRhIHN0YXRlIGRvZXMgbm90IGV4aXN0LmApO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YVN0YXRlOiBJTGFzdFN5bmNVc2VyRGF0YVN0YXRlID0gSlNPTi5wYXJzZShzdG9yZWRMYXN0U3luY1VzZXJEYXRhU3RhdGVDb250ZW50KTtcblx0XHRjb25zdCByZXNvdXJjZVN5bmNTdGF0ZVZlcnNpb24gPSB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmdldFJlc291cmNlU3luY1N0YXRlVmVyc2lvbih0aGlzLnJlc291cmNlKTtcblx0XHR0aGlzLmhhc1N5bmNSZXNvdXJjZVN0YXRlVmVyc2lvbkNoYW5nZWQgPSAhIWxhc3RTeW5jVXNlckRhdGFTdGF0ZS52ZXJzaW9uICYmICEhcmVzb3VyY2VTeW5jU3RhdGVWZXJzaW9uICYmIGxhc3RTeW5jVXNlckRhdGFTdGF0ZS52ZXJzaW9uICE9PSByZXNvdXJjZVN5bmNTdGF0ZVZlcnNpb247XG5cdFx0aWYgKHRoaXMuaGFzU3luY1Jlc291cmNlU3RhdGVWZXJzaW9uQ2hhbmdlZCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFJlc2V0IGxhc3Qgc3luYyBzdGF0ZSBiZWNhdXNlIGxhc3Qgc3luYyBzdGF0ZSB2ZXJzaW9uICR7bGFzdFN5bmNVc2VyRGF0YVN0YXRlLnZlcnNpb259IGlzIG5vdCBjb21wYXRpYmxlIHdpdGggY3VycmVudCBzeW5jIHN0YXRlIHZlcnNpb24gJHtyZXNvdXJjZVN5bmNTdGF0ZVZlcnNpb259LmApO1xuXHRcdFx0YXdhaXQgdGhpcy5yZXNldExvY2FsKCk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRsZXQgc3luY0RhdGE6IElTeW5jRGF0YSB8IG51bGwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBHZXQgTGFzdCBTeW5jIERhdGEgZnJvbSBMb2NhbFxuXHRcdGxldCByZXRyaWFsID0gMTtcblx0XHR3aGlsZSAoc3luY0RhdGEgPT09IHVuZGVmaW5lZCAmJiByZXRyaWFsKysgPCA2IC8qIFJldHJ5IDUgdGltZXMgKi8pIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGxhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0aGlzLnJlYWRMYXN0U3luY1N0b3JlZFJlbW90ZVVzZXJEYXRhKCk7XG5cdFx0XHRcdGlmIChsYXN0U3luY1N0b3JlZFJlbW90ZVVzZXJEYXRhKSB7XG5cdFx0XHRcdFx0aWYgKGxhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGEucmVmID09PSBsYXN0U3luY1VzZXJEYXRhU3RhdGUucmVmKSB7XG5cdFx0XHRcdFx0XHRzeW5jRGF0YSA9IGxhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGEuc3luY0RhdGE7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBMYXN0IHN5bmMgZGF0YSBzdG9yZWQgbG9jYWxseSBpcyBub3Qgc2FtZSBhcyB0aGUgbGFzdCBzeW5jIHN0YXRlLmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FcnJvciAmJiBlcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IExhc3Qgc3luYyByZXNvdXJjZSBkb2VzIG5vdCBleGlzdCBsb2NhbGx5LmApO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVycm9yIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IpIHtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBsb2cgYW5kIHJldHJ5XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yLCByZXRyaWFsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEdldCBMYXN0IFN5bmMgRGF0YSBmcm9tIFJlbW90ZVxuXHRcdGlmIChzeW5jRGF0YSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UucmVzb2x2ZVJlc291cmNlQ29udGVudCh0aGlzLnJlc291cmNlLCBsYXN0U3luY1VzZXJEYXRhU3RhdGUucmVmLCB0aGlzLmNvbGxlY3Rpb24sIHRoaXMuc3luY0hlYWRlcnMpO1xuXHRcdFx0XHRzeW5jRGF0YSA9IGNvbnRlbnQgPT09IG51bGwgPyBudWxsIDogdGhpcy5wYXJzZVN5bmNEYXRhKGNvbnRlbnQpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLndyaXRlTGFzdFN5bmNTdG9yZWRSZW1vdGVVc2VyRGF0YSh7IHJlZjogbGFzdFN5bmNVc2VyRGF0YVN0YXRlLnJlZiwgc3luY0RhdGEgfSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBVc2VyRGF0YVN5bmNFcnJvciAmJiBlcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTm90Rm91bmQpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogTGFzdCBzeW5jIHJlc291cmNlIGRvZXMgbm90IGV4aXN0IHJlbW90ZWx5LmApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTGFzdCBTeW5jIERhdGEgTm90IEZvdW5kXG5cdFx0aWYgKHN5bmNEYXRhID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5sYXN0U3luY1VzZXJEYXRhU3RhdGUsXG5cdFx0XHRzeW5jRGF0YSxcblx0XHR9O1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHVwZGF0ZUxhc3RTeW5jVXNlckRhdGEobGFzdFN5bmNSZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBhZGRpdGlvbmFsUHJvcHM6IElTdHJpbmdEaWN0aW9uYXJ5PGFueT4gPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChhZGRpdGlvbmFsUHJvcHNbJ3JlZiddIHx8IGFkZGl0aW9uYWxQcm9wc1sndmVyc2lvbiddKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBoYXZlIGNvcmUgcHJvcGVydGllcyBhcyBhZGRpdGlvbmFsJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmVyc2lvbiA9IHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuZ2V0UmVzb3VyY2VTeW5jU3RhdGVWZXJzaW9uKHRoaXMucmVzb3VyY2UpO1xuXHRcdGNvbnN0IGxhc3RTeW5jVXNlckRhdGFTdGF0ZTogSUxhc3RTeW5jVXNlckRhdGFTdGF0ZSA9IHtcblx0XHRcdHJlZjogbGFzdFN5bmNSZW1vdGVVc2VyRGF0YS5yZWYsXG5cdFx0XHR2ZXJzaW9uLFxuXHRcdFx0Li4uYWRkaXRpb25hbFByb3BzXG5cdFx0fTtcblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5sYXN0U3luY1VzZXJEYXRhU3RhdGVLZXksIEpTT04uc3RyaW5naWZ5KGxhc3RTeW5jVXNlckRhdGFTdGF0ZSksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRhd2FpdCB0aGlzLndyaXRlTGFzdFN5bmNTdG9yZWRSZW1vdGVVc2VyRGF0YShsYXN0U3luY1JlbW90ZVVzZXJEYXRhKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmVkTGFzdFN5bmNVc2VyRGF0YVN0YXRlQ29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLmxhc3RTeW5jVXNlckRhdGFTdGF0ZUtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVhZExhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGEoKTogUHJvbWlzZTxJUmVtb3RlVXNlckRhdGEgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjb250ZW50ID0gKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUodGhpcy5sYXN0U3luY1Jlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNTdG9yZWRSZW1vdGVVc2VyRGF0YSA9IGNvbnRlbnQgPyBKU09OLnBhcnNlKGNvbnRlbnQpIDogdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGlzUmVtb3RlVXNlckRhdGEobGFzdFN5bmNTdG9yZWRSZW1vdGVVc2VyRGF0YSkpIHtcblx0XHRcdFx0cmV0dXJuIGxhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGE7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUxhc3RTeW5jU3RvcmVkUmVtb3RlVXNlckRhdGEobGFzdFN5bmNSZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy5sYXN0U3luY1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KGxhc3RTeW5jUmVtb3RlVXNlckRhdGEpKSk7XG5cdH1cblxuXHRhc3luYyBnZXRSZW1vdGVVc2VyRGF0YShsYXN0U3luY0RhdGE6IElSZW1vdGVVc2VyRGF0YSB8IG51bGwpOiBQcm9taXNlPElSZW1vdGVVc2VyRGF0YT4ge1xuXHRcdGNvbnN0IHsgcmVmLCBjb250ZW50IH0gPSBhd2FpdCB0aGlzLmdldFVzZXJEYXRhKGxhc3RTeW5jRGF0YSk7XG5cdFx0bGV0IHN5bmNEYXRhOiBJU3luY0RhdGEgfCBudWxsID0gbnVsbDtcblx0XHRpZiAoY29udGVudCAhPT0gbnVsbCkge1xuXHRcdFx0c3luY0RhdGEgPSB0aGlzLnBhcnNlU3luY0RhdGEoY29udGVudCk7XG5cdFx0fVxuXHRcdHJldHVybiB7IHJlZiwgc3luY0RhdGEgfTtcblx0fVxuXG5cdHByb3RlY3RlZCBwYXJzZVN5bmNEYXRhKGNvbnRlbnQ6IHN0cmluZyk6IElTeW5jRGF0YSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN5bmNEYXRhOiBJU3luY0RhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRcdFx0aWYgKGlzU3luY0RhdGEoc3luY0RhdGEpKSB7XG5cdFx0XHRcdHJldHVybiBzeW5jRGF0YTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY0Vycm9yKGxvY2FsaXplKCdpbmNvbXBhdGlibGUgc3luYyBkYXRhJywgXCJDYW5ub3QgcGFyc2Ugc3luYyBkYXRhIGFzIGl0IGlzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIGN1cnJlbnQgdmVyc2lvbi5cIiksIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5JbmNvbXBhdGlibGVSZW1vdGVDb250ZW50LCB0aGlzLnJlc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0VXNlckRhdGEobGFzdFN5bmNEYXRhOiBJUmVtb3RlVXNlckRhdGEgfCBudWxsKTogUHJvbWlzZTxJVXNlckRhdGE+IHtcblx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhOiBJVXNlckRhdGEgfCBudWxsID0gbGFzdFN5bmNEYXRhID8geyByZWY6IGxhc3RTeW5jRGF0YS5yZWYsIGNvbnRlbnQ6IGxhc3RTeW5jRGF0YS5zeW5jRGF0YSA/IEpTT04uc3RyaW5naWZ5KGxhc3RTeW5jRGF0YS5zeW5jRGF0YSkgOiBudWxsIH0gOiBudWxsO1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS5yZWFkUmVzb3VyY2UodGhpcy5yZXNvdXJjZSwgbGFzdFN5bmNVc2VyRGF0YSwgdGhpcy5jb2xsZWN0aW9uLCB0aGlzLnN5bmNIZWFkZXJzKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyB1cGRhdGVSZW1vdGVVc2VyRGF0YShjb250ZW50OiBzdHJpbmcsIHJlZjogc3RyaW5nIHwgbnVsbCk6IFByb21pc2U8SVJlbW90ZVVzZXJEYXRhPiB7XG5cdFx0Y29uc3QgbWFjaGluZUlkID0gYXdhaXQgdGhpcy5jdXJyZW50TWFjaGluZUlkUHJvbWlzZTtcblx0XHRjb25zdCBzeW5jRGF0YTogSVN5bmNEYXRhID0geyB2ZXJzaW9uOiB0aGlzLnZlcnNpb24sIG1hY2hpbmVJZCwgY29udGVudCB9O1xuXHRcdHRyeSB7XG5cdFx0XHRyZWYgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS53cml0ZVJlc291cmNlKHRoaXMucmVzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHN5bmNEYXRhKSwgcmVmLCB0aGlzLmNvbGxlY3Rpb24sIHRoaXMuc3luY0hlYWRlcnMpO1xuXHRcdFx0cmV0dXJuIHsgcmVmLCBzeW5jRGF0YSB9O1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBVc2VyRGF0YVN5bmNFcnJvciAmJiBlcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTGFyZ2UpIHtcblx0XHRcdFx0ZXJyb3IgPSBuZXcgVXNlckRhdGFTeW5jRXJyb3IoZXJyb3IubWVzc2FnZSwgZXJyb3IuY29kZSwgdGhpcy5yZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgYmFja3VwTG9jYWwoY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc3luY0RhdGE6IElTeW5jRGF0YSA9IHsgdmVyc2lvbjogdGhpcy52ZXJzaW9uLCBjb250ZW50IH07XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2Uud3JpdGVSZXNvdXJjZSh0aGlzLnJlc291cmNlLCBKU09OLnN0cmluZ2lmeShzeW5jRGF0YSksIG5ldyBEYXRlKCksIHRoaXMuc3luY1Jlc291cmNlLnByb2ZpbGUuaXNEZWZhdWx0ID8gdW5kZWZpbmVkIDogdGhpcy5zeW5jUmVzb3VyY2UucHJvZmlsZS5pZCk7XG5cdH1cblxuXHRhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnN0YXR1cyA9PT0gU3luY1N0YXR1cy5JZGxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBTdG9wcGluZyBzeW5jaHJvbml6aW5nICR7dGhpcy5yZXNvdXJjZS50b0xvd2VyQ2FzZSgpfS5gKTtcblx0XHRpZiAodGhpcy5zeW5jUHJldmlld1Byb21pc2UpIHtcblx0XHRcdHRoaXMuc3luY1ByZXZpZXdQcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5zeW5jUHJldmlld1Byb21pc2UgPSBudWxsO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlQ29uZmxpY3RzKFtdKTtcblx0XHRhd2FpdCB0aGlzLmNsZWFyUHJldmlld0ZvbGRlcigpO1xuXG5cdFx0dGhpcy5zZXRTdGF0dXMoU3luY1N0YXR1cy5JZGxlKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogU3RvcHBlZCBzeW5jaHJvbml6aW5nICR7dGhpcy5yZXNvdXJjZS50b0xvd2VyQ2FzZSgpfS5gKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbigpOiBJVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVVNFUl9EQVRBX1NZTkNfQ09ORklHVVJBVElPTl9TQ09QRSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcmVhZG9ubHkgdmVyc2lvbjogbnVtYmVyO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2VuZXJhdGVTeW5jUHJldmlldyhyZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEgfCBudWxsLCBpc1JlbW90ZURhdGFGcm9tQ3VycmVudE1hY2hpbmU6IGJvb2xlYW4sIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb246IElVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSZXNvdXJjZVByZXZpZXdbXT47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRNZXJnZVJlc3VsdChyZXNvdXJjZVByZXZpZXc6IElSZXNvdXJjZVByZXZpZXcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SU1lcmdlUmVzdWx0Pjtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldEFjY2VwdFJlc3VsdChyZXNvdXJjZVByZXZpZXc6IElSZXNvdXJjZVByZXZpZXcsIHJlc291cmNlOiBVUkksIGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFjY2VwdFJlc3VsdD47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBhcHBseVJlc3VsdChyZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEgfCBudWxsLCByZXN1bHQ6IFtJUmVzb3VyY2VQcmV2aWV3LCBJQWNjZXB0UmVzdWx0XVtdLCBmb3JjZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBoYXNSZW1vdGVDaGFuZ2VkKGxhc3RTeW5jVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSk6IFByb21pc2U8Ym9vbGVhbj47XG5cblx0YWJzdHJhY3QgaGFzTG9jYWxEYXRhKCk6IFByb21pc2U8Ym9vbGVhbj47XG5cdGFic3RyYWN0IHJlc29sdmVDb250ZW50KHVyaTogVVJJKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVJlc291cmNlUHJldmlldyBleHRlbmRzIElSZXNvdXJjZVByZXZpZXcge1xuXHRyZWFkb25seSBmaWxlQ29udGVudDogSUZpbGVDb250ZW50IHwgbnVsbDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RmlsZVN5bmNocm9uaXNlciBleHRlbmRzIEFic3RyYWN0U3luY2hyb25pc2VyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgZmlsZTogVVJJLFxuXHRcdHN5bmNSZXNvdXJjZTogSVVzZXJEYXRhU3luY1Jlc291cmNlLFxuXHRcdGNvbGxlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSB1c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2U6IElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSB1c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZTogSVVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHN5bmNSZXNvdXJjZSwgY29sbGVjdGlvbiwgZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgdXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLndhdGNoKHRoaXMuZXh0VXJpLmRpcm5hbWUoZmlsZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB0aGlzLm9uRmlsZUNoYW5nZXMoZSkpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRMb2NhbEZpbGVDb250ZW50KCk6IFByb21pc2U8SUZpbGVDb250ZW50IHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh0aGlzLmZpbGUpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgdXBkYXRlTG9jYWxGaWxlQ29udGVudChuZXdDb250ZW50OiBzdHJpbmcsIG9sZENvbnRlbnQ6IElGaWxlQ29udGVudCB8IG51bGwsIGZvcmNlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmIChvbGRDb250ZW50KSB7XG5cdFx0XHRcdC8vIGZpbGUgZXhpc3RzIGFscmVhZHlcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy5maWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKG5ld0NvbnRlbnQpLCBmb3JjZSA/IHVuZGVmaW5lZCA6IG9sZENvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZmlsZSBkb2VzIG5vdCBleGlzdFxuXHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNyZWF0ZUZpbGUodGhpcy5maWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKG5ld0NvbnRlbnQpLCB7IG92ZXJ3cml0ZTogZm9yY2UgfSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKChlIGluc3RhbmNlb2YgRmlsZU9wZXJhdGlvbkVycm9yICYmIGUuZmlsZU9wZXJhdGlvblJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkgfHxcblx0XHRcdFx0KGUgaW5zdGFuY2VvZiBGaWxlT3BlcmF0aW9uRXJyb3IgJiYgZS5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9ESUZJRURfU0lOQ0UpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNFcnJvcihlLm1lc3NhZ2UsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Mb2NhbFByZWNvbmRpdGlvbkZhaWxlZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBkZWxldGVMb2NhbEZpbGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHRoaXMuZmlsZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKCEoZSBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FcnJvciAmJiBlLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQpKSB7XG5cdFx0XHRcdHRocm93IGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkZpbGVDaGFuZ2VzKGU6IEZpbGVDaGFuZ2VzRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIWUuY29udGFpbnModGhpcy5maWxlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnRyaWdnZXJMb2NhbENoYW5nZSgpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0SnNvbkZpbGVTeW5jaHJvbmlzZXIgZXh0ZW5kcyBBYnN0cmFjdEZpbGVTeW5jaHJvbmlzZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGZpbGU6IFVSSSxcblx0XHRzeW5jUmVzb3VyY2U6IElVc2VyRGF0YVN5bmNSZXNvdXJjZSxcblx0XHRjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UgdXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9nU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1V0aWxTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB1c2VyRGF0YVN5bmNVdGlsU2VydmljZTogSVVzZXJEYXRhU3luY1V0aWxTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGZpbGUsIHN5bmNSZXNvdXJjZSwgY29sbGVjdGlvbiwgZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgdXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBoYXNFcnJvcnMoY29udGVudDogc3RyaW5nLCBpc0FycmF5OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcGFyc2VFcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHBhcnNlKGNvbnRlbnQsIHBhcnNlRXJyb3JzLCB7IGFsbG93RW1wdHlDb250ZW50OiB0cnVlLCBhbGxvd1RyYWlsaW5nQ29tbWE6IHRydWUgfSk7XG5cdFx0cmV0dXJuIHBhcnNlRXJyb3JzLmxlbmd0aCA+IDAgfHwgKCFpc1VuZGVmaW5lZChyZXN1bHQpICYmIGlzQXJyYXkgIT09IEFycmF5LmlzQXJyYXkocmVzdWx0KSk7XG5cdH1cblxuXHRwcml2YXRlIF9mb3JtYXR0aW5nT3B0aW9uczogUHJvbWlzZTxGb3JtYXR0aW5nT3B0aW9ucz4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByb3RlY3RlZCBnZXRGb3JtYXR0aW5nT3B0aW9ucygpOiBQcm9taXNlPEZvcm1hdHRpbmdPcHRpb25zPiB7XG5cdFx0aWYgKCF0aGlzLl9mb3JtYXR0aW5nT3B0aW9ucykge1xuXHRcdFx0dGhpcy5fZm9ybWF0dGluZ09wdGlvbnMgPSB0aGlzLnVzZXJEYXRhU3luY1V0aWxTZXJ2aWNlLnJlc29sdmVGb3JtYXR0aW5nT3B0aW9ucyh0aGlzLmZpbGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZm9ybWF0dGluZ09wdGlvbnM7XG5cdH1cblxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RJbml0aWFsaXplciBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNSZXNvdXJjZUluaXRpYWxpemVyIHtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgZXh0VXJpOiBJRXh0VXJpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxhc3RTeW5jUmVzb3VyY2U6IFVSSTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSByZXNvdXJjZTogU3luY1Jlc291cmNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuZXh0VXJpID0gdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaTtcblx0XHR0aGlzLmxhc3RTeW5jUmVzb3VyY2UgPSBnZXRMYXN0U3luY1Jlc291cmNlVXJpKHVuZGVmaW5lZCwgdGhpcy5yZXNvdXJjZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmV4dFVyaSk7XG5cdH1cblxuXHRhc3luYyBpbml0aWFsaXplKHsgcmVmLCBjb250ZW50IH06IElVc2VyRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghY29udGVudCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1JlbW90ZSBjb250ZW50IGRvZXMgbm90IGV4aXN0LicsIHRoaXMucmVzb3VyY2UpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN5bmNEYXRhID0gdGhpcy5wYXJzZVN5bmNEYXRhKGNvbnRlbnQpO1xuXHRcdGlmICghc3luY0RhdGEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5kb0luaXRpYWxpemUoeyByZWYsIHN5bmNEYXRhIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcGFyc2VTeW5jRGF0YShjb250ZW50OiBzdHJpbmcpOiBJU3luY0RhdGEgfCB1bmRlZmluZWQge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzeW5jRGF0YTogSVN5bmNEYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcblx0XHRcdGlmIChpc1N5bmNEYXRhKHN5bmNEYXRhKSkge1xuXHRcdFx0XHRyZXR1cm4gc3luY0RhdGE7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0fVxuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdDYW5ub3QgcGFyc2Ugc3luYyBkYXRhIGFzIGl0IGlzIG5vdCBjb21wYXRpYmxlIHdpdGggdGhlIGN1cnJlbnQgdmVyc2lvbi4nLCB0aGlzLnJlc291cmNlKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHVwZGF0ZUxhc3RTeW5jVXNlckRhdGEobGFzdFN5bmNSZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBhZGRpdGlvbmFsUHJvcHM6IElTdHJpbmdEaWN0aW9uYXJ5PGFueT4gPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChhZGRpdGlvbmFsUHJvcHNbJ3JlZiddIHx8IGFkZGl0aW9uYWxQcm9wc1sndmVyc2lvbiddKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBoYXZlIGNvcmUgcHJvcGVydGllcyBhcyBhZGRpdGlvbmFsJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YVN0YXRlOiBJTGFzdFN5bmNVc2VyRGF0YVN0YXRlID0ge1xuXHRcdFx0cmVmOiBsYXN0U3luY1JlbW90ZVVzZXJEYXRhLnJlZixcblx0XHRcdHZlcnNpb246IHVuZGVmaW5lZCxcblx0XHRcdC4uLmFkZGl0aW9uYWxQcm9wc1xuXHRcdH07XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGAke3RoaXMucmVzb3VyY2V9Lmxhc3RTeW5jVXNlckRhdGFgLCBKU09OLnN0cmluZ2lmeShsYXN0U3luY1VzZXJEYXRhU3RhdGUpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy5sYXN0U3luY1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KGxhc3RTeW5jUmVtb3RlVXNlckRhdGEpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZG9Jbml0aWFsaXplKHJlbW90ZVVzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEpOiBQcm9taXNlPHZvaWQ+O1xuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsY0FBYztBQUN2QixTQUE0Qix5QkFBeUIsd0JBQXdCO0FBQzdFLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxhQUF5QjtBQUVsQyxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLG1CQUFtQjtBQUc1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUEyQixvQkFBb0IscUJBQW1DLGNBQWMsNkJBQTZCO0FBQzdILFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJC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QUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FoQm1CO0FBcUNmLElBQWUsc0JBQWYsTUFBK0U7QUFBQSxFQUtyRixZQUNVLFVBQ29DLHlCQUNMLG9CQUNSLFlBQ0MsYUFDRyxnQkFDZixvQkFDcEI7QUFQUTtBQUNvQztBQUNMO0FBQ1I7QUFDQztBQUNHO0FBR3BDLFNBQUssU0FBUyxtQkFBbUI7QUFDakMsU0FBSyxtQkFBbUIsdUJBQXVCLFFBQVcsS0FBSyxVQUFVLG9CQUFvQixLQUFLLE1BQU07QUFBQSxFQUN6RztBQUFBLEVBRUEsTUFBTSxXQUFXLEVBQUUsS0FBSyxRQUFRLEdBQTZCO0FBQzVELFFBQUksQ0FBQyxTQUFTO0FBQ2IsV0FBSyxXQUFXLEtBQUssa0NBQWtDLEtBQUssUUFBUTtBQUNwRTtBQUFBLElBQ0Q7QUFFQSxVQUFNLFdBQVcsS0FBSyxjQUFjLE9BQU87QUFDM0MsUUFBSSxDQUFDLFVBQVU7QUFDZDtBQUFBLElBQ0Q7QUFFQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLGFBQWEsRUFBRSxLQUFLLFNBQVMsQ0FBQztBQUFBLElBQzFDLFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGNBQWMsU0FBd0M7QUFDN0QsUUFBSTtBQUNILFlBQU0sV0FBc0IsS0FBSyxNQUFNLE9BQU87QUFDOUMsVUFBSSxXQUFXLFFBQVEsR0FBRztBQUN6QixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsU0FBUyxPQUFPO0FBQ2YsV0FBSyxXQUFXLE1BQU0sS0FBSztBQUFBLElBQzVCO0FBQ0EsU0FBSyxXQUFXLEtBQUssNEVBQTRFLEtBQUssUUFBUTtBQUM5RyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBZ0IsdUJBQXVCLHdCQUF5QyxrQkFBMEMsQ0FBQyxHQUFrQjtBQUM1SSxRQUFJLGdCQUFnQixLQUFLLEtBQUssZ0JBQWdCLFNBQVMsR0FBRztBQUN6RCxZQUFNLElBQUksTUFBTSwyQ0FBMkM7QUFBQSxJQUM1RDtBQUVBLFVBQU0sd0JBQWdEO0FBQUEsTUFDckQsS0FBSyx1QkFBdUI7QUFBQSxNQUM1QixTQUFTO0FBQUEsTUFDVCxHQUFHO0FBQUEsSUFDSjtBQUVBLFNBQUssZUFBZSxNQUFNLEdBQUcsS0FBSyxRQUFRLHFCQUFxQixLQUFLLFVBQVUscUJBQXFCLEdBQUcsYUFBYSxhQUFhLGNBQWMsT0FBTztBQUNySixVQUFNLEtBQUssWUFBWSxVQUFVLEtBQUssa0JBQWtCLFNBQVMsV0FBVyxLQUFLLFVBQVUsc0JBQXNCLENBQUMsQ0FBQztBQUFBLEVBQ3BIO0FBSUQ7QUFsRXNCLHNCQUFmO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FabUI7IiwKICAibmFtZXMiOiBbIlN5bmNTdHJhdGVneSJdCn0K
