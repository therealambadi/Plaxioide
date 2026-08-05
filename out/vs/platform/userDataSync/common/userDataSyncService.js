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
import { createCancelablePromise, RunOnceScheduler } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { isEqual } from "../../../base/common/resources.js";
import { isBoolean, isUndefined } from "../../../base/common/types.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IExtensionGalleryService } from "../../extensionManagement/common/extensionManagement.js";
import { IFileService } from "../../files/common/files.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { ExtensionsSynchroniser } from "./extensionsSync.js";
import { GlobalStateSynchroniser } from "./globalStateSync.js";
import { KeybindingsSynchroniser } from "./keybindingsSync.js";
import { PromptsSynchronizer } from "./promptsSync/promptsSync.js";
import { SettingsSynchroniser } from "./settingsSync.js";
import { SnippetsSynchroniser } from "./snippetsSync.js";
import { TasksSynchroniser } from "./tasksSync.js";
import { UserDataProfilesManifestSynchroniser } from "./userDataProfilesManifestSync.js";
import {
  ALL_SYNC_RESOURCES,
  createSyncHeaders,
  IUserDataSyncEnablementService,
  IUserDataSyncLogService,
  IUserDataSyncStoreManagementService,
  IUserDataSyncStoreService,
  SyncResource,
  SyncStatus,
  UserDataSyncError,
  UserDataSyncErrorCode,
  UserDataSyncStoreError,
  USER_DATA_SYNC_CONFIGURATION_SCOPE,
  IUserDataSyncResourceProviderService,
  IUserDataSyncLocalStoreService
} from "./userDataSync.js";
const LAST_SYNC_TIME_KEY = "sync.lastSyncTime";
let UserDataSyncService = class extends Disposable {
  constructor(fileService, userDataSyncStoreService, userDataSyncStoreManagementService, instantiationService, logService, telemetryService, storageService, userDataSyncEnablementService, userDataProfilesService, userDataSyncResourceProviderService, userDataSyncLocalStoreService) {
    super();
    this.fileService = fileService;
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.storageService = storageService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataProfilesService = userDataProfilesService;
    this.userDataSyncResourceProviderService = userDataSyncResourceProviderService;
    this.userDataSyncLocalStoreService = userDataSyncLocalStoreService;
    this._status = SyncStatus.Uninitialized;
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._onDidChangeLocal = this._register(new Emitter());
    this.onDidChangeLocal = this._onDidChangeLocal.event;
    this._conflicts = [];
    this._onDidChangeConflicts = this._register(new Emitter());
    this.onDidChangeConflicts = this._onDidChangeConflicts.event;
    this._syncErrors = [];
    this._onSyncErrors = this._register(new Emitter());
    this.onSyncErrors = this._onSyncErrors.event;
    this._lastSyncTime = void 0;
    this._onDidChangeLastSyncTime = this._register(new Emitter());
    this.onDidChangeLastSyncTime = this._onDidChangeLastSyncTime.event;
    this._onDidResetLocal = this._register(new Emitter());
    this.onDidResetLocal = this._onDidResetLocal.event;
    this._onDidResetRemote = this._register(new Emitter());
    this.onDidResetRemote = this._onDidResetRemote.event;
    this.activeProfileSynchronizers = /* @__PURE__ */ new Map();
    this._status = userDataSyncStoreManagementService.userDataSyncStore ? SyncStatus.Idle : SyncStatus.Uninitialized;
    this._lastSyncTime = this.storageService.getNumber(LAST_SYNC_TIME_KEY, StorageScope.APPLICATION, void 0);
    this._register(toDisposable(() => this.clearActiveProfileSynchronizers()));
    this._register(new RunOnceScheduler(
      () => this.cleanUpStaleStorageData(),
      5 * 1e3
      /* after 5s */
    )).schedule();
  }
  get status() {
    return this._status;
  }
  get conflicts() {
    return this._conflicts;
  }
  get lastSyncTime() {
    return this._lastSyncTime;
  }
  async createSyncTask(manifest, disableCache) {
    this.checkEnablement();
    this.logService.info("Sync started.");
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    const executionId = generateUuid();
    try {
      const syncHeaders = createSyncHeaders(executionId);
      if (disableCache) {
        syncHeaders["Cache-Control"] = "no-cache";
      }
      manifest = await this.userDataSyncStoreService.manifest(manifest, syncHeaders);
    } catch (error) {
      const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
      reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
      throw userDataSyncError;
    }
    const executed = false;
    const that = this;
    let cancellablePromise;
    return {
      manifest,
      async run() {
        if (executed) {
          throw new Error("Can run a task only once");
        }
        cancellablePromise = createCancelablePromise((token) => that.sync(manifest, false, executionId, token));
        await cancellablePromise.finally(() => cancellablePromise = void 0);
        that.logService.info(`Sync done. Took ${(/* @__PURE__ */ new Date()).getTime() - startTime}ms`);
        that.updateLastSyncTime();
      },
      stop() {
        cancellablePromise?.cancel();
        return that.stop();
      }
    };
  }
  async createManualSyncTask() {
    this.checkEnablement();
    if (this.userDataSyncEnablementService.isEnabled()) {
      throw new UserDataSyncError("Cannot start manual sync when sync is enabled", UserDataSyncErrorCode.LocalError);
    }
    this.logService.info("Sync started.");
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    const executionId = generateUuid();
    const syncHeaders = createSyncHeaders(executionId);
    let manifest;
    try {
      manifest = await this.userDataSyncStoreService.manifest(null, syncHeaders);
    } catch (error) {
      const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
      reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
      throw userDataSyncError;
    }
    await this.resetLocal();
    const that = this;
    const cancellableToken = new CancellationTokenSource();
    return {
      id: executionId,
      async merge() {
        return that.sync(manifest, true, executionId, cancellableToken.token);
      },
      async apply() {
        try {
          try {
            await that.applyManualSync(manifest, executionId, cancellableToken.token);
          } catch (error) {
            if (UserDataSyncError.toUserDataSyncError(error).code === UserDataSyncErrorCode.MethodNotFound) {
              that.logService.info("Client is making invalid requests. Cleaning up data...");
              await that.cleanUpRemoteData();
              that.logService.info("Applying manual sync again...");
              await that.applyManualSync(manifest, executionId, cancellableToken.token);
            } else {
              throw error;
            }
          }
        } catch (error) {
          that.logService.error(error);
          throw error;
        }
        that.logService.info(`Sync done. Took ${(/* @__PURE__ */ new Date()).getTime() - startTime}ms`);
        that.updateLastSyncTime();
      },
      async stop() {
        cancellableToken.cancel();
        await that.stop();
        await that.resetLocal();
      }
    };
  }
  async sync(manifest, preview, executionId, token) {
    this._syncErrors = [];
    try {
      if (this.status !== SyncStatus.HasConflicts) {
        this.setStatus(SyncStatus.Syncing);
      }
      const defaultProfileSynchronizer = this.getOrCreateActiveProfileSynchronizer(this.userDataProfilesService.defaultProfile, void 0);
      this._syncErrors.push(...await this.syncProfile(defaultProfileSynchronizer, manifest, preview, executionId, token));
      const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find((s) => s.resource === SyncResource.Profiles);
      if (userDataProfileManifestSynchronizer) {
        const syncProfiles = await userDataProfileManifestSynchronizer.getLastSyncedProfiles() || [];
        if (token.isCancellationRequested) {
          return;
        }
        await this.syncRemoteProfiles(syncProfiles, manifest, preview, executionId, token);
      }
    } finally {
      if (this.status !== SyncStatus.HasConflicts) {
        this.setStatus(SyncStatus.Idle);
      }
      this._onSyncErrors.fire(this._syncErrors);
    }
  }
  async syncRemoteProfiles(remoteProfiles, manifest, preview, executionId, token) {
    for (const syncProfile of remoteProfiles) {
      if (token.isCancellationRequested) {
        return;
      }
      const profile = this.userDataProfilesService.profiles.find((p) => p.id === syncProfile.id);
      if (!profile) {
        this.logService.error(`Profile with id:${syncProfile.id} and name: ${syncProfile.name} does not exist locally to sync.`);
        continue;
      }
      this.logService.info("Syncing profile.", syncProfile.name);
      const profileSynchronizer = this.getOrCreateActiveProfileSynchronizer(profile, syncProfile);
      this._syncErrors.push(...await this.syncProfile(profileSynchronizer, manifest, preview, executionId, token));
    }
    for (const [key, profileSynchronizerItem] of this.activeProfileSynchronizers.entries()) {
      if (this.userDataProfilesService.profiles.some((p) => p.id === profileSynchronizerItem[0].profile.id)) {
        continue;
      }
      await profileSynchronizerItem[0].resetLocal();
      profileSynchronizerItem[1].dispose();
      this.activeProfileSynchronizers.delete(key);
    }
  }
  async applyManualSync(manifest, executionId, token) {
    try {
      this.setStatus(SyncStatus.Syncing);
      const profileSynchronizers = this.getActiveProfileSynchronizers();
      for (const profileSynchronizer of profileSynchronizers) {
        if (token.isCancellationRequested) {
          return;
        }
        await profileSynchronizer.apply(executionId, token);
      }
      const defaultProfileSynchronizer = profileSynchronizers.find((s) => s.profile.isDefault);
      if (!defaultProfileSynchronizer) {
        return;
      }
      const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find((s) => s.resource === SyncResource.Profiles);
      if (!userDataProfileManifestSynchronizer) {
        return;
      }
      const remoteProfiles = await userDataProfileManifestSynchronizer.getRemoteSyncedProfiles(manifest?.latest ?? null) || [];
      const remoteProfilesToSync = remoteProfiles.filter((remoteProfile) => profileSynchronizers.every((s) => s.profile.id !== remoteProfile.id));
      if (remoteProfilesToSync.length) {
        await this.syncRemoteProfiles(remoteProfilesToSync, manifest, false, executionId, token);
      }
    } finally {
      this.setStatus(SyncStatus.Idle);
    }
  }
  async syncProfile(profileSynchronizer, manifest, preview, executionId, token) {
    const errors = await profileSynchronizer.sync(manifest, preview, executionId, token);
    return errors.map(([syncResource, error]) => ({ profile: profileSynchronizer.profile, syncResource, error }));
  }
  async stop() {
    if (this.status !== SyncStatus.Idle) {
      await Promise.allSettled(this.getActiveProfileSynchronizers().map((profileSynchronizer) => profileSynchronizer.stop()));
    }
  }
  async resolveContent(resource) {
    const content = await this.userDataSyncResourceProviderService.resolveContent(resource);
    if (content) {
      return content;
    }
    for (const profileSynchronizer of this.getActiveProfileSynchronizers()) {
      for (const synchronizer of profileSynchronizer.enabled) {
        const content2 = await synchronizer.resolveContent(resource);
        if (content2) {
          return content2;
        }
      }
    }
    return null;
  }
  async replace(syncResourceHandle) {
    this.checkEnablement();
    const profileSyncResource = this.userDataSyncResourceProviderService.resolveUserDataSyncResource(syncResourceHandle);
    if (!profileSyncResource) {
      return;
    }
    const content = await this.resolveContent(syncResourceHandle.uri);
    if (!content) {
      return;
    }
    await this.performAction(profileSyncResource.profile, async (synchronizer) => {
      if (profileSyncResource.syncResource === synchronizer.resource) {
        await synchronizer.replace(content);
        return true;
      }
      return void 0;
    });
    return;
  }
  async accept(syncResource, resource, content, apply) {
    this.checkEnablement();
    await this.performAction(syncResource.profile, async (synchronizer) => {
      if (syncResource.syncResource === synchronizer.resource) {
        await synchronizer.accept(resource, content);
        if (apply) {
          await synchronizer.apply(isBoolean(apply) ? false : apply.force, createSyncHeaders(generateUuid()));
        }
        return true;
      }
      return void 0;
    });
  }
  async hasLocalData() {
    const result = await this.performAction(this.userDataProfilesService.defaultProfile, async (synchronizer) => {
      if (synchronizer.resource !== SyncResource.GlobalState && await synchronizer.hasLocalData()) {
        return true;
      }
      return void 0;
    });
    return !!result;
  }
  async hasPreviouslySynced() {
    const result = await this.performAction(this.userDataProfilesService.defaultProfile, async (synchronizer) => {
      if (await synchronizer.hasPreviouslySynced()) {
        return true;
      }
      return void 0;
    });
    return !!result;
  }
  async reset() {
    this.checkEnablement();
    await this.resetRemote();
    await this.resetLocal();
  }
  async resetRemote() {
    this.checkEnablement();
    try {
      await this.userDataSyncStoreService.clear();
      this.logService.info("Cleared data on server");
    } catch (e) {
      this.logService.error(e);
    }
    this._onDidResetRemote.fire();
  }
  async resetLocal() {
    this.checkEnablement();
    this._lastSyncTime = void 0;
    this.storageService.remove(LAST_SYNC_TIME_KEY, StorageScope.APPLICATION);
    for (const [synchronizer] of this.activeProfileSynchronizers.values()) {
      try {
        await synchronizer.resetLocal();
      } catch (e) {
        this.logService.error(e);
      }
    }
    this.clearActiveProfileSynchronizers();
    this._onDidResetLocal.fire();
    this.logService.info("Did reset the local sync state.");
  }
  async cleanUpStaleStorageData() {
    const allKeys = this.storageService.keys(StorageScope.APPLICATION, StorageTarget.MACHINE);
    const lastSyncProfileKeys = [];
    for (const key of allKeys) {
      if (!key.endsWith(".lastSyncUserData")) {
        continue;
      }
      const segments = key.split(".");
      if (segments.length === 3) {
        lastSyncProfileKeys.push([key, segments[0]]);
      }
    }
    if (!lastSyncProfileKeys.length) {
      return;
    }
    const disposables = new DisposableStore();
    try {
      let defaultProfileSynchronizer = this.activeProfileSynchronizers.get(this.userDataProfilesService.defaultProfile.id)?.[0];
      if (!defaultProfileSynchronizer) {
        defaultProfileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, this.userDataProfilesService.defaultProfile, void 0));
      }
      const userDataProfileManifestSynchronizer = defaultProfileSynchronizer.enabled.find((s) => s.resource === SyncResource.Profiles);
      if (!userDataProfileManifestSynchronizer) {
        return;
      }
      const lastSyncedProfiles = await userDataProfileManifestSynchronizer.getLastSyncedProfiles();
      const lastSyncedCollections = lastSyncedProfiles?.map((p) => p.collection) ?? [];
      for (const [key, collection] of lastSyncProfileKeys) {
        if (!lastSyncedCollections.includes(collection)) {
          this.logService.info(`Removing last sync state for stale profile: ${collection}`);
          this.storageService.remove(key, StorageScope.APPLICATION);
        }
      }
    } finally {
      disposables.dispose();
    }
  }
  async cleanUpRemoteData() {
    const remoteProfiles = await this.userDataSyncResourceProviderService.getRemoteSyncedProfiles();
    const remoteProfileCollections = remoteProfiles.map((profile) => profile.collection);
    const allCollections = await this.userDataSyncStoreService.getAllCollections();
    const redundantCollections = allCollections.filter((c) => !remoteProfileCollections.includes(c));
    if (redundantCollections.length) {
      this.logService.info(`Deleting ${redundantCollections.length} redundant collections on server`);
      await Promise.allSettled(redundantCollections.map((collectionId) => this.userDataSyncStoreService.deleteCollection(collectionId)));
      this.logService.info(`Deleted redundant collections on server`);
    }
    const updatedRemoteProfiles = remoteProfiles.filter((profile) => allCollections.includes(profile.collection));
    if (updatedRemoteProfiles.length !== remoteProfiles.length) {
      const profileManifestSynchronizer = this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, this.userDataProfilesService.defaultProfile, void 0);
      try {
        this.logService.info("Resetting the last synced state of profiles");
        await profileManifestSynchronizer.resetLocal();
        this.logService.info("Did reset the last synced state of profiles");
        this.logService.info(`Updating remote profiles with invalid collections on server`);
        await profileManifestSynchronizer.updateRemoteProfiles(updatedRemoteProfiles, null);
        this.logService.info(`Updated remote profiles on server`);
      } finally {
        profileManifestSynchronizer.dispose();
      }
    }
  }
  async saveRemoteActivityData(location) {
    this.checkEnablement();
    const data = await this.userDataSyncStoreService.getActivityData();
    await this.fileService.writeFile(location, data);
  }
  async extractActivityData(activityDataResource, location) {
    const content = (await this.fileService.readFile(activityDataResource)).value.toString();
    const activityData = JSON.parse(content);
    if (activityData.resources) {
      for (const resource in activityData.resources) {
        for (const version of activityData.resources[resource]) {
          await this.userDataSyncLocalStoreService.writeResource(resource, version.content, new Date(version.created * 1e3), void 0, location);
        }
      }
    }
    if (activityData.collections) {
      for (const collection in activityData.collections) {
        for (const resource in activityData.collections[collection].resources) {
          for (const version of activityData.collections[collection].resources?.[resource] ?? []) {
            await this.userDataSyncLocalStoreService.writeResource(resource, version.content, new Date(version.created * 1e3), collection, location);
          }
        }
      }
    }
  }
  async performAction(profile, action) {
    const disposables = new DisposableStore();
    try {
      const activeProfileSyncronizer = this.activeProfileSynchronizers.get(profile.id);
      if (activeProfileSyncronizer) {
        const result = await this.performActionWithProfileSynchronizer(activeProfileSyncronizer[0], action, disposables);
        return isUndefined(result) ? null : result;
      }
      if (profile.isDefault) {
        const defaultProfileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, void 0));
        const result = await this.performActionWithProfileSynchronizer(defaultProfileSynchronizer, action, disposables);
        return isUndefined(result) ? null : result;
      }
      const userDataProfileManifestSynchronizer = disposables.add(this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, profile, void 0));
      const manifest = await this.userDataSyncStoreService.manifest(null);
      const syncProfiles = await userDataProfileManifestSynchronizer.getRemoteSyncedProfiles(manifest?.latest ?? null) || [];
      const syncProfile = syncProfiles.find((syncProfile2) => syncProfile2.id === profile.id);
      if (syncProfile) {
        const profileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, syncProfile.collection));
        const result = await this.performActionWithProfileSynchronizer(profileSynchronizer, action, disposables);
        return isUndefined(result) ? null : result;
      }
      return null;
    } finally {
      disposables.dispose();
    }
  }
  async performActionWithProfileSynchronizer(profileSynchronizer, action, disposables) {
    const allSynchronizers = [...profileSynchronizer.enabled, ...profileSynchronizer.disabled.reduce((synchronizers, syncResource) => {
      if (syncResource !== SyncResource.WorkspaceState) {
        synchronizers.push(disposables.add(profileSynchronizer.createSynchronizer(syncResource)));
      }
      return synchronizers;
    }, [])];
    for (const synchronizer of allSynchronizers) {
      const result = await action(synchronizer);
      if (!isUndefined(result)) {
        return result;
      }
    }
    return void 0;
  }
  setStatus(status) {
    const oldStatus = this._status;
    if (this._status !== status) {
      this._status = status;
      this._onDidChangeStatus.fire(status);
      if (oldStatus === SyncStatus.HasConflicts) {
        this.updateLastSyncTime();
      }
    }
  }
  updateConflicts() {
    const conflicts = this.getActiveProfileSynchronizers().map((synchronizer) => synchronizer.conflicts).flat();
    if (!equals(this._conflicts, conflicts, (a, b) => a.profile.id === b.profile.id && a.syncResource === b.syncResource && equals(a.conflicts, b.conflicts, (a2, b2) => isEqual(a2.previewResource, b2.previewResource)))) {
      this._conflicts = conflicts;
      this._onDidChangeConflicts.fire(conflicts);
    }
  }
  updateLastSyncTime() {
    if (this.status === SyncStatus.Idle) {
      this._lastSyncTime = (/* @__PURE__ */ new Date()).getTime();
      this.storageService.store(LAST_SYNC_TIME_KEY, this._lastSyncTime, StorageScope.APPLICATION, StorageTarget.MACHINE);
      this._onDidChangeLastSyncTime.fire(this._lastSyncTime);
    }
  }
  getOrCreateActiveProfileSynchronizer(profile, syncProfile) {
    let activeProfileSynchronizer = this.activeProfileSynchronizers.get(profile.id);
    if (activeProfileSynchronizer && activeProfileSynchronizer[0].collection !== syncProfile?.collection) {
      this.logService.error("Profile synchronizer collection does not match with the remote sync profile collection");
      activeProfileSynchronizer[1].dispose();
      activeProfileSynchronizer = void 0;
      this.activeProfileSynchronizers.delete(profile.id);
    }
    if (!activeProfileSynchronizer) {
      const disposables = new DisposableStore();
      const profileSynchronizer = disposables.add(this.instantiationService.createInstance(ProfileSynchronizer, profile, syncProfile?.collection));
      disposables.add(profileSynchronizer.onDidChangeStatus((e) => this.setStatus(e)));
      disposables.add(profileSynchronizer.onDidChangeConflicts((conflicts) => this.updateConflicts()));
      disposables.add(profileSynchronizer.onDidChangeLocal((e) => this._onDidChangeLocal.fire(e)));
      this.activeProfileSynchronizers.set(profile.id, activeProfileSynchronizer = [profileSynchronizer, disposables]);
    }
    return activeProfileSynchronizer[0];
  }
  getActiveProfileSynchronizers() {
    const profileSynchronizers = [];
    for (const [profileSynchronizer] of this.activeProfileSynchronizers.values()) {
      profileSynchronizers.push(profileSynchronizer);
    }
    return profileSynchronizers;
  }
  clearActiveProfileSynchronizers() {
    this.activeProfileSynchronizers.forEach(([, disposable]) => disposable.dispose());
    this.activeProfileSynchronizers.clear();
  }
  checkEnablement() {
    if (!this.userDataSyncStoreManagementService.userDataSyncStore) {
      throw new Error("Not enabled");
    }
  }
};
UserDataSyncService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUserDataSyncStoreService),
  __decorateParam(2, IUserDataSyncStoreManagementService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IUserDataSyncLogService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IUserDataSyncEnablementService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, IUserDataSyncResourceProviderService),
  __decorateParam(10, IUserDataSyncLocalStoreService)
], UserDataSyncService);
let ProfileSynchronizer = class extends Disposable {
  constructor(profile, collection, userDataSyncEnablementService, instantiationService, extensionGalleryService, userDataSyncStoreManagementService, telemetryService, logService, configurationService) {
    super();
    this.profile = profile;
    this.collection = collection;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.instantiationService = instantiationService;
    this.extensionGalleryService = extensionGalleryService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this.configurationService = configurationService;
    this._enabled = [];
    this._status = SyncStatus.Idle;
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this._onDidChangeLocal = this._register(new Emitter());
    this.onDidChangeLocal = this._onDidChangeLocal.event;
    this._conflicts = [];
    this._onDidChangeConflicts = this._register(new Emitter());
    this.onDidChangeConflicts = this._onDidChangeConflicts.event;
    this._register(userDataSyncEnablementService.onDidChangeResourceEnablement(([syncResource, enablement]) => this.onDidChangeResourceEnablement(syncResource, enablement)));
    this._register(toDisposable(() => this._enabled.splice(0, this._enabled.length).forEach(([, , disposable]) => disposable.dispose())));
    for (const syncResource of ALL_SYNC_RESOURCES) {
      if (userDataSyncEnablementService.isResourceEnabled(syncResource)) {
        this.registerSynchronizer(syncResource);
      }
    }
  }
  get enabled() {
    return this._enabled.sort((a, b) => a[1] - b[1]).map(([synchronizer]) => synchronizer);
  }
  get disabled() {
    return ALL_SYNC_RESOURCES.filter((syncResource) => !this.userDataSyncEnablementService.isResourceEnabled(syncResource));
  }
  get status() {
    return this._status;
  }
  get conflicts() {
    return this._conflicts;
  }
  onDidChangeResourceEnablement(syncResource, enabled) {
    if (enabled) {
      this.registerSynchronizer(syncResource);
    } else {
      this.deRegisterSynchronizer(syncResource);
    }
  }
  registerSynchronizer(syncResource) {
    if (this._enabled.some(([synchronizer2]) => synchronizer2.resource === syncResource)) {
      return;
    }
    if (syncResource === SyncResource.Extensions && !this.extensionGalleryService.isEnabled()) {
      this.logService.info("Skipping extensions sync because gallery is not configured");
      return;
    }
    if (syncResource === SyncResource.Profiles) {
      if (!this.profile.isDefault) {
        return;
      }
    }
    if (syncResource === SyncResource.WorkspaceState) {
      return;
    }
    if (syncResource !== SyncResource.Profiles && this.profile.useDefaultFlags?.[syncResource]) {
      this.logService.debug(`Skipping syncing ${syncResource} in ${this.profile.name} because it is already synced by default profile`);
      return;
    }
    const disposables = new DisposableStore();
    const synchronizer = disposables.add(this.createSynchronizer(syncResource));
    disposables.add(synchronizer.onDidChangeStatus(() => this.updateStatus()));
    disposables.add(synchronizer.onDidChangeConflicts(() => this.updateConflicts()));
    disposables.add(synchronizer.onDidChangeLocal(() => this._onDidChangeLocal.fire(syncResource)));
    const order = this.getOrder(syncResource);
    this._enabled.push([synchronizer, order, disposables]);
  }
  deRegisterSynchronizer(syncResource) {
    const index = this._enabled.findIndex(([synchronizer]) => synchronizer.resource === syncResource);
    if (index !== -1) {
      const [[synchronizer, , disposable]] = this._enabled.splice(index, 1);
      disposable.dispose();
      this.updateStatus();
      synchronizer.stop().then(null, (error) => this.logService.error(error));
    }
  }
  createSynchronizer(syncResource) {
    switch (syncResource) {
      case SyncResource.Settings:
        return this.instantiationService.createInstance(SettingsSynchroniser, this.profile, this.collection);
      case SyncResource.Keybindings:
        return this.instantiationService.createInstance(KeybindingsSynchroniser, this.profile, this.collection);
      case SyncResource.Snippets:
        return this.instantiationService.createInstance(SnippetsSynchroniser, this.profile, this.collection);
      case SyncResource.Prompts:
        return this.instantiationService.createInstance(PromptsSynchronizer, this.profile, this.collection);
      case SyncResource.Tasks:
        return this.instantiationService.createInstance(TasksSynchroniser, this.profile, this.collection);
      case SyncResource.GlobalState:
        return this.instantiationService.createInstance(GlobalStateSynchroniser, this.profile, this.collection);
      case SyncResource.Extensions:
        return this.instantiationService.createInstance(ExtensionsSynchroniser, this.profile, this.collection);
      case SyncResource.Profiles:
        return this.instantiationService.createInstance(UserDataProfilesManifestSynchroniser, this.profile, this.collection);
    }
  }
  async sync(manifest, preview, executionId, token) {
    if (token.isCancellationRequested) {
      return [];
    }
    const synchronizers = this.enabled;
    if (!synchronizers.length) {
      return [];
    }
    try {
      const syncErrors = [];
      const syncHeaders = createSyncHeaders(executionId);
      const resourceManifest = (this.collection ? manifest?.collections?.[this.collection]?.latest : manifest?.latest) ?? null;
      const userDataSyncConfiguration = preview ? await this.getUserDataSyncConfiguration(resourceManifest) : this.getLocalUserDataSyncConfiguration();
      for (const synchroniser of synchronizers) {
        if (token.isCancellationRequested) {
          return [];
        }
        if (!this.userDataSyncEnablementService.isResourceEnabled(synchroniser.resource)) {
          return [];
        }
        try {
          await synchroniser.sync(resourceManifest, preview, userDataSyncConfiguration, syncHeaders);
        } catch (e) {
          const userDataSyncError = UserDataSyncError.toUserDataSyncError(e);
          reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
          if (canBailout(e)) {
            throw userDataSyncError;
          }
          this.logService.error(e);
          this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
          syncErrors.push([synchroniser.resource, userDataSyncError]);
        }
      }
      return syncErrors;
    } finally {
      this.updateStatus();
    }
  }
  async apply(executionId, token) {
    const syncHeaders = createSyncHeaders(executionId);
    for (const synchroniser of this.enabled) {
      if (token.isCancellationRequested) {
        return;
      }
      try {
        await synchroniser.apply(false, syncHeaders);
      } catch (e) {
        const userDataSyncError = UserDataSyncError.toUserDataSyncError(e);
        reportUserDataSyncError(userDataSyncError, executionId, this.userDataSyncStoreManagementService, this.telemetryService);
        if (canBailout(e)) {
          throw userDataSyncError;
        }
        this.logService.error(e);
        this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
      }
    }
  }
  async stop() {
    for (const synchroniser of this.enabled) {
      try {
        if (synchroniser.status !== SyncStatus.Idle) {
          await synchroniser.stop();
        }
      } catch (e) {
        this.logService.error(e);
      }
    }
  }
  async resetLocal() {
    for (const synchroniser of this.enabled) {
      try {
        await synchroniser.resetLocal();
      } catch (e) {
        this.logService.error(`${synchroniser.resource}: ${toErrorMessage(e)}`);
        this.logService.error(e);
      }
    }
  }
  async getUserDataSyncConfiguration(manifest) {
    if (!this.profile.isDefault) {
      return {};
    }
    const local = this.getLocalUserDataSyncConfiguration();
    const settingsSynchronizer = this.enabled.find((synchronizer) => synchronizer instanceof SettingsSynchroniser);
    if (settingsSynchronizer) {
      const remote = await settingsSynchronizer.getRemoteUserDataSyncConfiguration(manifest);
      return { ...local, ...remote };
    }
    return local;
  }
  getLocalUserDataSyncConfiguration() {
    return this.configurationService.getValue(USER_DATA_SYNC_CONFIGURATION_SCOPE);
  }
  setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      this._onDidChangeStatus.fire(status);
    }
  }
  updateStatus() {
    this.updateConflicts();
    if (this.enabled.some((s) => s.status === SyncStatus.HasConflicts)) {
      return this.setStatus(SyncStatus.HasConflicts);
    }
    if (this.enabled.some((s) => s.status === SyncStatus.Syncing)) {
      return this.setStatus(SyncStatus.Syncing);
    }
    return this.setStatus(SyncStatus.Idle);
  }
  updateConflicts() {
    const conflicts = this.enabled.filter((s) => s.status === SyncStatus.HasConflicts).filter((s) => s.conflicts.conflicts.length > 0).map((s) => s.conflicts);
    if (!equals(this._conflicts, conflicts, (a, b) => a.syncResource === b.syncResource && equals(a.conflicts, b.conflicts, (a2, b2) => isEqual(a2.previewResource, b2.previewResource)))) {
      this._conflicts = conflicts;
      this._onDidChangeConflicts.fire(conflicts);
    }
  }
  getOrder(syncResource) {
    switch (syncResource) {
      case SyncResource.Settings:
        return 0;
      case SyncResource.Keybindings:
        return 1;
      case SyncResource.Snippets:
        return 2;
      case SyncResource.Tasks:
        return 3;
      case SyncResource.GlobalState:
        return 4;
      case SyncResource.Extensions:
        return 5;
      case SyncResource.Prompts:
        return 6;
      case SyncResource.Profiles:
        return 7;
      case SyncResource.WorkspaceState:
        return 8;
    }
  }
};
ProfileSynchronizer = __decorateClass([
  __decorateParam(2, IUserDataSyncEnablementService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IUserDataSyncStoreManagementService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, IUserDataSyncLogService),
  __decorateParam(8, IConfigurationService)
], ProfileSynchronizer);
function canBailout(e) {
  if (e instanceof UserDataSyncError) {
    switch (e.code) {
      case UserDataSyncErrorCode.MethodNotFound:
      case UserDataSyncErrorCode.TooLarge:
      case UserDataSyncErrorCode.TooManyRequests:
      case UserDataSyncErrorCode.TooManyRequestsAndRetryAfter:
      case UserDataSyncErrorCode.LocalTooManyRequests:
      case UserDataSyncErrorCode.LocalTooManyProfiles:
      case UserDataSyncErrorCode.Gone:
      case UserDataSyncErrorCode.UpgradeRequired:
      case UserDataSyncErrorCode.IncompatibleRemoteContent:
      case UserDataSyncErrorCode.IncompatibleLocalContent:
        return true;
    }
  }
  return false;
}
function reportUserDataSyncError(userDataSyncError, executionId, userDataSyncStoreManagementService, telemetryService) {
  telemetryService.publicLog2(
    "sync/error",
    {
      code: userDataSyncError.code,
      serverCode: userDataSyncError instanceof UserDataSyncStoreError ? String(userDataSyncError.serverCode) : void 0,
      url: userDataSyncError instanceof UserDataSyncStoreError ? userDataSyncError.url : void 0,
      resource: userDataSyncError.resource,
      executionId,
      service: userDataSyncStoreManagementService.userDataSyncStore.url.toString()
    }
  );
}
export {
  UserDataSyncService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNCb29sZWFuLCBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zU3luY2hyb25pc2VyIH0gZnJvbSAnLi9leHRlbnNpb25zU3luYy5qcyc7XG5pbXBvcnQgeyBHbG9iYWxTdGF0ZVN5bmNocm9uaXNlciB9IGZyb20gJy4vZ2xvYmFsU3RhdGVTeW5jLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzU3luY2hyb25pc2VyIH0gZnJvbSAnLi9rZXliaW5kaW5nc1N5bmMuanMnO1xuaW1wb3J0IHsgUHJvbXB0c1N5bmNocm9uaXplciB9IGZyb20gJy4vcHJvbXB0c1N5bmMvcHJvbXB0c1N5bmMuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NTeW5jaHJvbmlzZXIgfSBmcm9tICcuL3NldHRpbmdzU3luYy5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0c1N5bmNocm9uaXNlciB9IGZyb20gJy4vc25pcHBldHNTeW5jLmpzJztcbmltcG9ydCB7IFRhc2tzU3luY2hyb25pc2VyIH0gZnJvbSAnLi90YXNrc1N5bmMuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFQcm9maWxlc01hbmlmZXN0U3luY2hyb25pc2VyIH0gZnJvbSAnLi91c2VyRGF0YVByb2ZpbGVzTWFuaWZlc3RTeW5jLmpzJztcbmltcG9ydCB7XG5cdEFMTF9TWU5DX1JFU09VUkNFUywgY3JlYXRlU3luY0hlYWRlcnMsIElVc2VyRGF0YU1hbnVhbFN5bmNUYXNrLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VDb25mbGljdHMsIElVc2VyRGF0YVN5bmNSZXNvdXJjZUVycm9yLFxuXHRJVXNlckRhdGFTeW5jUmVzb3VyY2UsIElTeW5jUmVzb3VyY2VIYW5kbGUsIElVc2VyRGF0YVN5bmNUYXNrLCBJU3luY1VzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhTWFuaWZlc3QsIElVc2VyRGF0YVJlc291cmNlTWFuaWZlc3QsIElVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uLFxuXHRJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsIElVc2VyRGF0YVN5bmNocm9uaXNlciwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTZXJ2aWNlLCBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSxcblx0U3luY1Jlc291cmNlLCBTeW5jU3RhdHVzLCBVc2VyRGF0YVN5bmNFcnJvciwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLCBVc2VyRGF0YVN5bmNTdG9yZUVycm9yLCBVU0VSX0RBVEFfU1lOQ19DT05GSUdVUkFUSU9OX1NDT1BFLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UsIElVc2VyRGF0YUFjdGl2aXR5RGF0YSwgSVVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLFxufSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5cbnR5cGUgU3luY0Vycm9yQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnc2FuZHkwODEnO1xuXHRjb21tZW50OiAnSW5mb3JtYXRpb24gYWJvdXQgdGhlIGVycm9yIHRoYXQgb2NjdXJyZWQgd2hpbGUgc3luY2luZyc7XG5cdGNvZGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdlcnJvciBjb2RlJyB9O1xuXHRzZXJ2aWNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnU2V0dGluZ3MgU3luYyBzZXJ2aWNlIGZvciB3aGljaCB0aGlzIGVycm9yIGhhcyBvY2N1cnJlZCcgfTtcblx0c2VydmVyQ29kZT86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdTZXR0aW5ncyBTeW5jIHNlcnZpY2UgZXJyb3IgY29kZScgfTtcblx0dXJsPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1NldHRpbmdzIFN5bmMgcmVzb3VyY2UgVVJMIGZvciB3aGljaCB0aGlzIGVycm9yIGhhcyBvY2N1cnJlZCcgfTtcblx0cmVzb3VyY2U/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnU2V0dGluZ3MgU3luYyByZXNvdXJjZSBmb3Igd2hpY2ggdGhpcyBlcnJvciBoYXMgb2NjdXJyZWQnIH07XG5cdGV4ZWN1dGlvbklkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1NldHRpbmdzIFN5bmMgZXhlY3V0aW9uIGlkIGZvciB3aGljaCB0aGlzIGVycm9yIGhhcyBvY2N1cnJlZCcgfTtcbn07XG5cbmNvbnN0IExBU1RfU1lOQ19USU1FX0tFWSA9ICdzeW5jLmxhc3RTeW5jVGltZSc7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNTZXJ2aWNlIHtcblxuXHRfc2VydmljZUJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSBfc3RhdHVzOiBTeW5jU3RhdHVzID0gU3luY1N0YXR1cy5VbmluaXRpYWxpemVkO1xuXHRnZXQgc3RhdHVzKCk6IFN5bmNTdGF0dXMgeyByZXR1cm4gdGhpcy5fc3RhdHVzOyB9XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlU3RhdHVzOiBFbWl0dGVyPFN5bmNTdGF0dXM+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8U3luY1N0YXR1cz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdHVzOiBFdmVudDxTeW5jU3RhdHVzPiA9IHRoaXMuX29uRGlkQ2hhbmdlU3RhdHVzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlTG9jYWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxTeW5jUmVzb3VyY2U+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxvY2FsID0gdGhpcy5fb25EaWRDaGFuZ2VMb2NhbC5ldmVudDtcblxuXHRwcml2YXRlIF9jb25mbGljdHM6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUNvbmZsaWN0c1tdID0gW107XG5cdGdldCBjb25mbGljdHMoKTogSVVzZXJEYXRhU3luY1Jlc291cmNlQ29uZmxpY3RzW10geyByZXR1cm4gdGhpcy5fY29uZmxpY3RzOyB9XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlQ29uZmxpY3RzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVVzZXJEYXRhU3luY1Jlc291cmNlQ29uZmxpY3RzW10+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbmZsaWN0cyA9IHRoaXMuX29uRGlkQ2hhbmdlQ29uZmxpY3RzLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N5bmNFcnJvcnM6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUVycm9yW10gPSBbXTtcblx0cHJpdmF0ZSBfb25TeW5jRXJyb3JzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVVzZXJEYXRhU3luY1Jlc291cmNlRXJyb3JbXT4oKSk7XG5cdHJlYWRvbmx5IG9uU3luY0Vycm9ycyA9IHRoaXMuX29uU3luY0Vycm9ycy5ldmVudDtcblxuXHRwcml2YXRlIF9sYXN0U3luY1RpbWU6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Z2V0IGxhc3RTeW5jVGltZSgpOiBudW1iZXIgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fbGFzdFN5bmNUaW1lOyB9XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlTGFzdFN5bmNUaW1lOiBFbWl0dGVyPG51bWJlcj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxhc3RTeW5jVGltZTogRXZlbnQ8bnVtYmVyPiA9IHRoaXMuX29uRGlkQ2hhbmdlTGFzdFN5bmNUaW1lLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkUmVzZXRMb2NhbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlc2V0TG9jYWwgPSB0aGlzLl9vbkRpZFJlc2V0TG9jYWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRSZXNldFJlbW90ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlc2V0UmVtb3RlID0gdGhpcy5fb25EaWRSZXNldFJlbW90ZS5ldmVudDtcblxuXHRwcml2YXRlIGFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzID0gbmV3IE1hcDxzdHJpbmcsIFtQcm9maWxlU3luY2hyb25pemVyLCBJRGlzcG9zYWJsZV0+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2U6IElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlOiBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fc3RhdHVzID0gdXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZSA/IFN5bmNTdGF0dXMuSWRsZSA6IFN5bmNTdGF0dXMuVW5pbml0aWFsaXplZDtcblx0XHR0aGlzLl9sYXN0U3luY1RpbWUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihMQVNUX1NZTkNfVElNRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5jbGVhckFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzKCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuY2xlYW5VcFN0YWxlU3RvcmFnZURhdGEoKSwgNSAqIDEwMDAgLyogYWZ0ZXIgNXMgKi8pKS5zY2hlZHVsZSgpO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlU3luY1Rhc2sobWFuaWZlc3Q6IElVc2VyRGF0YU1hbmlmZXN0IHwgbnVsbCwgZGlzYWJsZUNhY2hlPzogYm9vbGVhbik6IFByb21pc2U8SVVzZXJEYXRhU3luY1Rhc2s+IHtcblx0XHR0aGlzLmNoZWNrRW5hYmxlbWVudCgpO1xuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1N5bmMgc3RhcnRlZC4nKTtcblx0XHRjb25zdCBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblx0XHRjb25zdCBleGVjdXRpb25JZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzeW5jSGVhZGVycyA9IGNyZWF0ZVN5bmNIZWFkZXJzKGV4ZWN1dGlvbklkKTtcblx0XHRcdGlmIChkaXNhYmxlQ2FjaGUpIHtcblx0XHRcdFx0c3luY0hlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG5cdFx0XHR9XG5cdFx0XHRtYW5pZmVzdCA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLm1hbmlmZXN0KG1hbmlmZXN0LCBzeW5jSGVhZGVycyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY0Vycm9yID0gVXNlckRhdGFTeW5jRXJyb3IudG9Vc2VyRGF0YVN5bmNFcnJvcihlcnJvcik7XG5cdFx0XHRyZXBvcnRVc2VyRGF0YVN5bmNFcnJvcih1c2VyRGF0YVN5bmNFcnJvciwgZXhlY3V0aW9uSWQsIHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgdGhpcy50ZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHRcdHRocm93IHVzZXJEYXRhU3luY0Vycm9yO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4ZWN1dGVkID0gZmFsc2U7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0bGV0IGNhbmNlbGxhYmxlUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG1hbmlmZXN0LFxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRpZiAoZXhlY3V0ZWQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhbiBydW4gYSB0YXNrIG9ubHkgb25jZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhbmNlbGxhYmxlUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHRoYXQuc3luYyhtYW5pZmVzdCwgZmFsc2UsIGV4ZWN1dGlvbklkLCB0b2tlbikpO1xuXHRcdFx0XHRhd2FpdCBjYW5jZWxsYWJsZVByb21pc2UuZmluYWxseSgoKSA9PiBjYW5jZWxsYWJsZVByb21pc2UgPSB1bmRlZmluZWQpO1xuXHRcdFx0XHR0aGF0LmxvZ1NlcnZpY2UuaW5mbyhgU3luYyBkb25lLiBUb29rICR7bmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydFRpbWV9bXNgKTtcblx0XHRcdFx0dGhhdC51cGRhdGVMYXN0U3luY1RpbWUoKTtcblx0XHRcdH0sXG5cdFx0XHRzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjYW5jZWxsYWJsZVByb21pc2U/LmNhbmNlbCgpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5zdG9wKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZU1hbnVhbFN5bmNUYXNrKCk6IFByb21pc2U8SVVzZXJEYXRhTWFudWFsU3luY1Rhc2s+IHtcblx0XHR0aGlzLmNoZWNrRW5hYmxlbWVudCgpO1xuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNFcnJvcignQ2Fubm90IHN0YXJ0IG1hbnVhbCBzeW5jIHdoZW4gc3luYyBpcyBlbmFibGVkJywgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsRXJyb3IpO1xuXHRcdH1cblxuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTeW5jIHN0YXJ0ZWQuJyk7XG5cdFx0Y29uc3Qgc3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0Y29uc3QgZXhlY3V0aW9uSWQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHRjb25zdCBzeW5jSGVhZGVycyA9IGNyZWF0ZVN5bmNIZWFkZXJzKGV4ZWN1dGlvbklkKTtcblx0XHRsZXQgbWFuaWZlc3Q6IElVc2VyRGF0YU1hbmlmZXN0IHwgbnVsbDtcblx0XHR0cnkge1xuXHRcdFx0bWFuaWZlc3QgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS5tYW5pZmVzdChudWxsLCBzeW5jSGVhZGVycyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY0Vycm9yID0gVXNlckRhdGFTeW5jRXJyb3IudG9Vc2VyRGF0YVN5bmNFcnJvcihlcnJvcik7XG5cdFx0XHRyZXBvcnRVc2VyRGF0YVN5bmNFcnJvcih1c2VyRGF0YVN5bmNFcnJvciwgZXhlY3V0aW9uSWQsIHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgdGhpcy50ZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHRcdHRocm93IHVzZXJEYXRhU3luY0Vycm9yO1xuXHRcdH1cblxuXHRcdC8qIE1hbnVhbCBzeW5jIHNoYWxsIHN0YXJ0IG9uIGNsZWFuIGxvY2FsIHN0YXRlICovXG5cdFx0YXdhaXQgdGhpcy5yZXNldExvY2FsKCk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBjYW5jZWxsYWJsZVRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBleGVjdXRpb25JZCxcblx0XHRcdGFzeW5jIG1lcmdlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5zeW5jKG1hbmlmZXN0LCB0cnVlLCBleGVjdXRpb25JZCwgY2FuY2VsbGFibGVUb2tlbi50b2tlbik7XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgYXBwbHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoYXQuYXBwbHlNYW51YWxTeW5jKG1hbmlmZXN0LCBleGVjdXRpb25JZCwgY2FuY2VsbGFibGVUb2tlbi50b2tlbik7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGlmIChVc2VyRGF0YVN5bmNFcnJvci50b1VzZXJEYXRhU3luY0Vycm9yKGVycm9yKS5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTWV0aG9kTm90Rm91bmQpIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5sb2dTZXJ2aWNlLmluZm8oJ0NsaWVudCBpcyBtYWtpbmcgaW52YWxpZCByZXF1ZXN0cy4gQ2xlYW5pbmcgdXAgZGF0YS4uLicpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGF0LmNsZWFuVXBSZW1vdGVEYXRhKCk7XG5cdFx0XHRcdFx0XHRcdHRoYXQubG9nU2VydmljZS5pbmZvKCdBcHBseWluZyBtYW51YWwgc3luYyBhZ2Fpbi4uLicpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGF0LmFwcGx5TWFudWFsU3luYyhtYW5pZmVzdCwgZXhlY3V0aW9uSWQsIGNhbmNlbGxhYmxlVG9rZW4udG9rZW4pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoYXQubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhhdC5sb2dTZXJ2aWNlLmluZm8oYFN5bmMgZG9uZS4gVG9vayAke25ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lfW1zYCk7XG5cdFx0XHRcdHRoYXQudXBkYXRlTGFzdFN5bmNUaW1lKCk7XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y2FuY2VsbGFibGVUb2tlbi5jYW5jZWwoKTtcblx0XHRcdFx0YXdhaXQgdGhhdC5zdG9wKCk7XG5cdFx0XHRcdGF3YWl0IHRoYXQucmVzZXRMb2NhbCgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN5bmMobWFuaWZlc3Q6IElVc2VyRGF0YU1hbmlmZXN0IHwgbnVsbCwgcHJldmlldzogYm9vbGVhbiwgZXhlY3V0aW9uSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fc3luY0Vycm9ycyA9IFtdO1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAodGhpcy5zdGF0dXMgIT09IFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKSB7XG5cdFx0XHRcdHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN5bmMgRGVmYXVsdCBQcm9maWxlIEZpcnN0XG5cdFx0XHRjb25zdCBkZWZhdWx0UHJvZmlsZVN5bmNocm9uaXplciA9IHRoaXMuZ2V0T3JDcmVhdGVBY3RpdmVQcm9maWxlU3luY2hyb25pemVyKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUsIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9zeW5jRXJyb3JzLnB1c2goLi4uYXdhaXQgdGhpcy5zeW5jUHJvZmlsZShkZWZhdWx0UHJvZmlsZVN5bmNocm9uaXplciwgbWFuaWZlc3QsIHByZXZpZXcsIGV4ZWN1dGlvbklkLCB0b2tlbikpO1xuXG5cdFx0XHQvLyBTeW5jIG90aGVyIHByb2ZpbGVzXG5cdFx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVNYW5pZmVzdFN5bmNocm9uaXplciA9IGRlZmF1bHRQcm9maWxlU3luY2hyb25pemVyLmVuYWJsZWQuZmluZChzID0+IHMucmVzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5Qcm9maWxlcyk7XG5cdFx0XHRpZiAodXNlckRhdGFQcm9maWxlTWFuaWZlc3RTeW5jaHJvbml6ZXIpIHtcblx0XHRcdFx0Y29uc3Qgc3luY1Byb2ZpbGVzID0gKGF3YWl0ICh1c2VyRGF0YVByb2ZpbGVNYW5pZmVzdFN5bmNocm9uaXplciBhcyBVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3RTeW5jaHJvbmlzZXIpLmdldExhc3RTeW5jZWRQcm9maWxlcygpKSB8fCBbXTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3luY1JlbW90ZVByb2ZpbGVzKHN5bmNQcm9maWxlcywgbWFuaWZlc3QsIHByZXZpZXcsIGV4ZWN1dGlvbklkLCB0b2tlbik7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmICh0aGlzLnN0YXR1cyAhPT0gU3luY1N0YXR1cy5IYXNDb25mbGljdHMpIHtcblx0XHRcdFx0dGhpcy5zZXRTdGF0dXMoU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uU3luY0Vycm9ycy5maXJlKHRoaXMuX3N5bmNFcnJvcnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3luY1JlbW90ZVByb2ZpbGVzKHJlbW90ZVByb2ZpbGVzOiBJU3luY1VzZXJEYXRhUHJvZmlsZVtdLCBtYW5pZmVzdDogSVVzZXJEYXRhTWFuaWZlc3QgfCBudWxsLCBwcmV2aWV3OiBib29sZWFuLCBleGVjdXRpb25JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmb3IgKGNvbnN0IHN5bmNQcm9maWxlIG9mIHJlbW90ZVByb2ZpbGVzKSB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcHJvZmlsZSA9IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHN5bmNQcm9maWxlLmlkKTtcblx0XHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFByb2ZpbGUgd2l0aCBpZDoke3N5bmNQcm9maWxlLmlkfSBhbmQgbmFtZTogJHtzeW5jUHJvZmlsZS5uYW1lfSBkb2VzIG5vdCBleGlzdCBsb2NhbGx5IHRvIHN5bmMuYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1N5bmNpbmcgcHJvZmlsZS4nLCBzeW5jUHJvZmlsZS5uYW1lKTtcblx0XHRcdGNvbnN0IHByb2ZpbGVTeW5jaHJvbml6ZXIgPSB0aGlzLmdldE9yQ3JlYXRlQWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcihwcm9maWxlLCBzeW5jUHJvZmlsZSk7XG5cdFx0XHR0aGlzLl9zeW5jRXJyb3JzLnB1c2goLi4uYXdhaXQgdGhpcy5zeW5jUHJvZmlsZShwcm9maWxlU3luY2hyb25pemVyLCBtYW5pZmVzdCwgcHJldmlldywgZXhlY3V0aW9uSWQsIHRva2VuKSk7XG5cdFx0fVxuXHRcdC8vIERpc3Bvc2UgJiBEZWxldGUgcHJvZmlsZSBzeW5jaHJvbml6ZXJzIHdoaWNoIGRvIG5vdCBleGlzdCBhbnltb3JlXG5cdFx0Zm9yIChjb25zdCBba2V5LCBwcm9maWxlU3luY2hyb25pemVySXRlbV0gb2YgdGhpcy5hY3RpdmVQcm9maWxlU3luY2hyb25pemVycy5lbnRyaWVzKCkpIHtcblx0XHRcdGlmICh0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLnNvbWUocCA9PiBwLmlkID09PSBwcm9maWxlU3luY2hyb25pemVySXRlbVswXS5wcm9maWxlLmlkKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHByb2ZpbGVTeW5jaHJvbml6ZXJJdGVtWzBdLnJlc2V0TG9jYWwoKTtcblx0XHRcdHByb2ZpbGVTeW5jaHJvbml6ZXJJdGVtWzFdLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMuZGVsZXRlKGtleSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhcHBseU1hbnVhbFN5bmMobWFuaWZlc3Q6IElVc2VyRGF0YU1hbmlmZXN0IHwgbnVsbCwgZXhlY3V0aW9uSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRjb25zdCBwcm9maWxlU3luY2hyb25pemVycyA9IHRoaXMuZ2V0QWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMoKTtcblx0XHRcdGZvciAoY29uc3QgcHJvZmlsZVN5bmNocm9uaXplciBvZiBwcm9maWxlU3luY2hyb25pemVycykge1xuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgcHJvZmlsZVN5bmNocm9uaXplci5hcHBseShleGVjdXRpb25JZCwgdG9rZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkZWZhdWx0UHJvZmlsZVN5bmNocm9uaXplciA9IHByb2ZpbGVTeW5jaHJvbml6ZXJzLmZpbmQocyA9PiBzLnByb2ZpbGUuaXNEZWZhdWx0KTtcblx0XHRcdGlmICghZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVNYW5pZmVzdFN5bmNocm9uaXplciA9IGRlZmF1bHRQcm9maWxlU3luY2hyb25pemVyLmVuYWJsZWQuZmluZChzID0+IHMucmVzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5Qcm9maWxlcyk7XG5cdFx0XHRpZiAoIXVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU3luYyByZW1vdGUgcHJvZmlsZXMgd2hpY2ggYXJlIG5vdCBzeW5jZWQgbG9jYWxseVxuXHRcdFx0Y29uc3QgcmVtb3RlUHJvZmlsZXMgPSAoYXdhaXQgKHVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyIGFzIFVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFN5bmNocm9uaXNlcikuZ2V0UmVtb3RlU3luY2VkUHJvZmlsZXMobWFuaWZlc3Q/LmxhdGVzdCA/PyBudWxsKSkgfHwgW107XG5cdFx0XHRjb25zdCByZW1vdGVQcm9maWxlc1RvU3luYyA9IHJlbW90ZVByb2ZpbGVzLmZpbHRlcihyZW1vdGVQcm9maWxlID0+IHByb2ZpbGVTeW5jaHJvbml6ZXJzLmV2ZXJ5KHMgPT4gcy5wcm9maWxlLmlkICE9PSByZW1vdGVQcm9maWxlLmlkKSk7XG5cdFx0XHRpZiAocmVtb3RlUHJvZmlsZXNUb1N5bmMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3luY1JlbW90ZVByb2ZpbGVzKHJlbW90ZVByb2ZpbGVzVG9TeW5jLCBtYW5pZmVzdCwgZmFsc2UsIGV4ZWN1dGlvbklkLCB0b2tlbik7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzeW5jUHJvZmlsZShwcm9maWxlU3luY2hyb25pemVyOiBQcm9maWxlU3luY2hyb25pemVyLCBtYW5pZmVzdDogSVVzZXJEYXRhTWFuaWZlc3QgfCBudWxsLCBwcmV2aWV3OiBib29sZWFuLCBleGVjdXRpb25JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElVc2VyRGF0YVN5bmNSZXNvdXJjZUVycm9yW10+IHtcblx0XHRjb25zdCBlcnJvcnMgPSBhd2FpdCBwcm9maWxlU3luY2hyb25pemVyLnN5bmMobWFuaWZlc3QsIHByZXZpZXcsIGV4ZWN1dGlvbklkLCB0b2tlbik7XG5cdFx0cmV0dXJuIGVycm9ycy5tYXAoKFtzeW5jUmVzb3VyY2UsIGVycm9yXSkgPT4gKHsgcHJvZmlsZTogcHJvZmlsZVN5bmNocm9uaXplci5wcm9maWxlLCBzeW5jUmVzb3VyY2UsIGVycm9yIH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5zdGF0dXMgIT09IFN5bmNTdGF0dXMuSWRsZSkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRoaXMuZ2V0QWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMoKS5tYXAocHJvZmlsZVN5bmNocm9uaXplciA9PiBwcm9maWxlU3luY2hyb25pemVyLnN0b3AoKSkpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlc29sdmVDb250ZW50KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5yZXNvbHZlQ29udGVudChyZXNvdXJjZSk7XG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdHJldHVybiBjb250ZW50O1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHByb2ZpbGVTeW5jaHJvbml6ZXIgb2YgdGhpcy5nZXRBY3RpdmVQcm9maWxlU3luY2hyb25pemVycygpKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHN5bmNocm9uaXplciBvZiBwcm9maWxlU3luY2hyb25pemVyLmVuYWJsZWQpIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHN5bmNocm9uaXplci5yZXNvbHZlQ29udGVudChyZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChjb250ZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyByZXBsYWNlKHN5bmNSZXNvdXJjZUhhbmRsZTogSVN5bmNSZXNvdXJjZUhhbmRsZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuY2hlY2tFbmFibGVtZW50KCk7XG5cblx0XHRjb25zdCBwcm9maWxlU3luY1Jlc291cmNlID0gdGhpcy51c2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5yZXNvbHZlVXNlckRhdGFTeW5jUmVzb3VyY2Uoc3luY1Jlc291cmNlSGFuZGxlKTtcblx0XHRpZiAoIXByb2ZpbGVTeW5jUmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29udGVudChzeW5jUmVzb3VyY2VIYW5kbGUudXJpKTtcblx0XHRpZiAoIWNvbnRlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnBlcmZvcm1BY3Rpb24ocHJvZmlsZVN5bmNSZXNvdXJjZS5wcm9maWxlLCBhc3luYyBzeW5jaHJvbml6ZXIgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVTeW5jUmVzb3VyY2Uuc3luY1Jlc291cmNlID09PSBzeW5jaHJvbml6ZXIucmVzb3VyY2UpIHtcblx0XHRcdFx0YXdhaXQgc3luY2hyb25pemVyLnJlcGxhY2UoY29udGVudCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9KTtcblxuXHRcdHJldHVybjtcblx0fVxuXG5cdGFzeW5jIGFjY2VwdChzeW5jUmVzb3VyY2U6IElVc2VyRGF0YVN5bmNSZXNvdXJjZSwgcmVzb3VyY2U6IFVSSSwgY29udGVudDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgYXBwbHk6IGJvb2xlYW4gfCB7IGZvcmNlOiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNoZWNrRW5hYmxlbWVudCgpO1xuXG5cdFx0YXdhaXQgdGhpcy5wZXJmb3JtQWN0aW9uKHN5bmNSZXNvdXJjZS5wcm9maWxlLCBhc3luYyBzeW5jaHJvbml6ZXIgPT4ge1xuXHRcdFx0aWYgKHN5bmNSZXNvdXJjZS5zeW5jUmVzb3VyY2UgPT09IHN5bmNocm9uaXplci5yZXNvdXJjZSkge1xuXHRcdFx0XHRhd2FpdCBzeW5jaHJvbml6ZXIuYWNjZXB0KHJlc291cmNlLCBjb250ZW50KTtcblx0XHRcdFx0aWYgKGFwcGx5KSB7XG5cdFx0XHRcdFx0YXdhaXQgc3luY2hyb25pemVyLmFwcGx5KGlzQm9vbGVhbihhcHBseSkgPyBmYWxzZSA6IGFwcGx5LmZvcmNlLCBjcmVhdGVTeW5jSGVhZGVycyhnZW5lcmF0ZVV1aWQoKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGhhc0xvY2FsRGF0YSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBlcmZvcm1BY3Rpb24odGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSwgYXN5bmMgc3luY2hyb25pemVyID0+IHtcblx0XHRcdC8vIHNraXAgZ2xvYmFsIHN0YXRlIHN5bmNocm9uaXplclxuXHRcdFx0aWYgKHN5bmNocm9uaXplci5yZXNvdXJjZSAhPT0gU3luY1Jlc291cmNlLkdsb2JhbFN0YXRlICYmIGF3YWl0IHN5bmNocm9uaXplci5oYXNMb2NhbERhdGEoKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdFx0cmV0dXJuICEhcmVzdWx0O1xuXHR9XG5cblx0YXN5bmMgaGFzUHJldmlvdXNseVN5bmNlZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBlcmZvcm1BY3Rpb24odGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSwgYXN5bmMgc3luY2hyb25pemVyID0+IHtcblx0XHRcdGlmIChhd2FpdCBzeW5jaHJvbml6ZXIuaGFzUHJldmlvdXNseVN5bmNlZCgpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9KTtcblx0XHRyZXR1cm4gISFyZXN1bHQ7XG5cdH1cblxuXHRhc3luYyByZXNldCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNoZWNrRW5hYmxlbWVudCgpO1xuXHRcdGF3YWl0IHRoaXMucmVzZXRSZW1vdGUoKTtcblx0XHRhd2FpdCB0aGlzLnJlc2V0TG9jYWwoKTtcblx0fVxuXG5cdGFzeW5jIHJlc2V0UmVtb3RlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuY2hlY2tFbmFibGVtZW50KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmNsZWFyKCk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnQ2xlYXJlZCBkYXRhIG9uIHNlcnZlcicpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRSZXNldFJlbW90ZS5maXJlKCk7XG5cdH1cblxuXHRhc3luYyByZXNldExvY2FsKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuY2hlY2tFbmFibGVtZW50KCk7XG5cdFx0dGhpcy5fbGFzdFN5bmNUaW1lID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKExBU1RfU1lOQ19USU1FX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRmb3IgKGNvbnN0IFtzeW5jaHJvbml6ZXJdIG9mIHRoaXMuYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMudmFsdWVzKCkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHN5bmNocm9uaXplci5yZXNldExvY2FsKCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5jbGVhckFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzKCk7XG5cdFx0dGhpcy5fb25EaWRSZXNldExvY2FsLmZpcmUoKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnRGlkIHJlc2V0IHRoZSBsb2NhbCBzeW5jIHN0YXRlLicpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjbGVhblVwU3RhbGVTdG9yYWdlRGF0YSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhbGxLZXlzID0gdGhpcy5zdG9yYWdlU2VydmljZS5rZXlzKFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRjb25zdCBsYXN0U3luY1Byb2ZpbGVLZXlzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBhbGxLZXlzKSB7XG5cdFx0XHRpZiAoIWtleS5lbmRzV2l0aCgnLmxhc3RTeW5jVXNlckRhdGEnKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNlZ21lbnRzID0ga2V5LnNwbGl0KCcuJyk7XG5cdFx0XHRpZiAoc2VnbWVudHMubGVuZ3RoID09PSAzKSB7XG5cdFx0XHRcdGxhc3RTeW5jUHJvZmlsZUtleXMucHVzaChba2V5LCBzZWdtZW50c1swXV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIWxhc3RTeW5jUHJvZmlsZUtleXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0bGV0IGRlZmF1bHRQcm9maWxlU3luY2hyb25pemVyID0gdGhpcy5hY3RpdmVQcm9maWxlU3luY2hyb25pemVycy5nZXQodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5pZCk/LlswXTtcblx0XHRcdGlmICghZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIpIHtcblx0XHRcdFx0ZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9maWxlU3luY2hyb25pemVyLCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLCB1bmRlZmluZWQpKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyID0gZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIuZW5hYmxlZC5maW5kKHMgPT4gcy5yZXNvdXJjZSA9PT0gU3luY1Jlc291cmNlLlByb2ZpbGVzKSBhcyBVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3RTeW5jaHJvbmlzZXI7XG5cdFx0XHRpZiAoIXVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGxhc3RTeW5jZWRQcm9maWxlcyA9IGF3YWl0IHVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyLmdldExhc3RTeW5jZWRQcm9maWxlcygpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNlZENvbGxlY3Rpb25zID0gbGFzdFN5bmNlZFByb2ZpbGVzPy5tYXAocCA9PiBwLmNvbGxlY3Rpb24pID8/IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBba2V5LCBjb2xsZWN0aW9uXSBvZiBsYXN0U3luY1Byb2ZpbGVLZXlzKSB7XG5cdFx0XHRcdGlmICghbGFzdFN5bmNlZENvbGxlY3Rpb25zLmluY2x1ZGVzKGNvbGxlY3Rpb24pKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFJlbW92aW5nIGxhc3Qgc3luYyBzdGF0ZSBmb3Igc3RhbGUgcHJvZmlsZTogJHtjb2xsZWN0aW9ufWApO1xuXHRcdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKGtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2xlYW5VcFJlbW90ZURhdGEoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVtb3RlUHJvZmlsZXMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLmdldFJlbW90ZVN5bmNlZFByb2ZpbGVzKCk7XG5cdFx0Y29uc3QgcmVtb3RlUHJvZmlsZUNvbGxlY3Rpb25zID0gcmVtb3RlUHJvZmlsZXMubWFwKHByb2ZpbGUgPT4gcHJvZmlsZS5jb2xsZWN0aW9uKTtcblx0XHRjb25zdCBhbGxDb2xsZWN0aW9ucyA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmdldEFsbENvbGxlY3Rpb25zKCk7XG5cdFx0Y29uc3QgcmVkdW5kYW50Q29sbGVjdGlvbnMgPSBhbGxDb2xsZWN0aW9ucy5maWx0ZXIoYyA9PiAhcmVtb3RlUHJvZmlsZUNvbGxlY3Rpb25zLmluY2x1ZGVzKGMpKTtcblx0XHRpZiAocmVkdW5kYW50Q29sbGVjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgRGVsZXRpbmcgJHtyZWR1bmRhbnRDb2xsZWN0aW9ucy5sZW5ndGh9IHJlZHVuZGFudCBjb2xsZWN0aW9ucyBvbiBzZXJ2ZXJgKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChyZWR1bmRhbnRDb2xsZWN0aW9ucy5tYXAoY29sbGVjdGlvbklkID0+IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmRlbGV0ZUNvbGxlY3Rpb24oY29sbGVjdGlvbklkKSkpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYERlbGV0ZWQgcmVkdW5kYW50IGNvbGxlY3Rpb25zIG9uIHNlcnZlcmApO1xuXHRcdH1cblx0XHRjb25zdCB1cGRhdGVkUmVtb3RlUHJvZmlsZXMgPSByZW1vdGVQcm9maWxlcy5maWx0ZXIocHJvZmlsZSA9PiBhbGxDb2xsZWN0aW9ucy5pbmNsdWRlcyhwcm9maWxlLmNvbGxlY3Rpb24pKTtcblx0XHRpZiAodXBkYXRlZFJlbW90ZVByb2ZpbGVzLmxlbmd0aCAhPT0gcmVtb3RlUHJvZmlsZXMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBwcm9maWxlTWFuaWZlc3RTeW5jaHJvbml6ZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFN5bmNocm9uaXNlciwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSwgdW5kZWZpbmVkKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdSZXNldHRpbmcgdGhlIGxhc3Qgc3luY2VkIHN0YXRlIG9mIHByb2ZpbGVzJyk7XG5cdFx0XHRcdGF3YWl0IHByb2ZpbGVNYW5pZmVzdFN5bmNocm9uaXplci5yZXNldExvY2FsKCk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdEaWQgcmVzZXQgdGhlIGxhc3Qgc3luY2VkIHN0YXRlIG9mIHByb2ZpbGVzJyk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBVcGRhdGluZyByZW1vdGUgcHJvZmlsZXMgd2l0aCBpbnZhbGlkIGNvbGxlY3Rpb25zIG9uIHNlcnZlcmApO1xuXHRcdFx0XHRhd2FpdCBwcm9maWxlTWFuaWZlc3RTeW5jaHJvbml6ZXIudXBkYXRlUmVtb3RlUHJvZmlsZXModXBkYXRlZFJlbW90ZVByb2ZpbGVzLCBudWxsKTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFVwZGF0ZWQgcmVtb3RlIHByb2ZpbGVzIG9uIHNlcnZlcmApO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0cHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBzYXZlUmVtb3RlQWN0aXZpdHlEYXRhKGxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNoZWNrRW5hYmxlbWVudCgpO1xuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS5nZXRBY3Rpdml0eURhdGEoKTtcblx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShsb2NhdGlvbiwgZGF0YSk7XG5cdH1cblxuXHRhc3luYyBleHRyYWN0QWN0aXZpdHlEYXRhKGFjdGl2aXR5RGF0YVJlc291cmNlOiBVUkksIGxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250ZW50ID0gKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUoYWN0aXZpdHlEYXRhUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGFjdGl2aXR5RGF0YTogSVVzZXJEYXRhQWN0aXZpdHlEYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcblxuXHRcdGlmIChhY3Rpdml0eURhdGEucmVzb3VyY2VzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHJlc291cmNlIGluIGFjdGl2aXR5RGF0YS5yZXNvdXJjZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB2ZXJzaW9uIG9mIGFjdGl2aXR5RGF0YS5yZXNvdXJjZXNbcmVzb3VyY2VdKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZS53cml0ZVJlc291cmNlKHJlc291cmNlIGFzIFN5bmNSZXNvdXJjZSwgdmVyc2lvbi5jb250ZW50LCBuZXcgRGF0ZSh2ZXJzaW9uLmNyZWF0ZWQgKiAxMDAwKSwgdW5kZWZpbmVkLCBsb2NhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYWN0aXZpdHlEYXRhLmNvbGxlY3Rpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbGxlY3Rpb24gaW4gYWN0aXZpdHlEYXRhLmNvbGxlY3Rpb25zKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2UgaW4gYWN0aXZpdHlEYXRhLmNvbGxlY3Rpb25zW2NvbGxlY3Rpb25dLnJlc291cmNlcykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdmVyc2lvbiBvZiBhY3Rpdml0eURhdGEuY29sbGVjdGlvbnNbY29sbGVjdGlvbl0ucmVzb3VyY2VzPy5bcmVzb3VyY2VdID8/IFtdKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLndyaXRlUmVzb3VyY2UocmVzb3VyY2UgYXMgU3luY1Jlc291cmNlLCB2ZXJzaW9uLmNvbnRlbnQsIG5ldyBEYXRlKHZlcnNpb24uY3JlYXRlZCAqIDEwMDApLCBjb2xsZWN0aW9uLCBsb2NhdGlvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwZXJmb3JtQWN0aW9uPFQ+KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsIGFjdGlvbjogKHN5bmNocm9uaXNlcjogSVVzZXJEYXRhU3luY2hyb25pc2VyKSA9PiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+KTogUHJvbWlzZTxUIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY3RpdmVQcm9maWxlU3luY3Jvbml6ZXIgPSB0aGlzLmFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzLmdldChwcm9maWxlLmlkKTtcblx0XHRcdGlmIChhY3RpdmVQcm9maWxlU3luY3Jvbml6ZXIpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wZXJmb3JtQWN0aW9uV2l0aFByb2ZpbGVTeW5jaHJvbml6ZXIoYWN0aXZlUHJvZmlsZVN5bmNyb25pemVyWzBdLCBhY3Rpb24sIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0cmV0dXJuIGlzVW5kZWZpbmVkKHJlc3VsdCkgPyBudWxsIDogcmVzdWx0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9maWxlU3luY2hyb25pemVyLCBwcm9maWxlLCB1bmRlZmluZWQpKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wZXJmb3JtQWN0aW9uV2l0aFByb2ZpbGVTeW5jaHJvbml6ZXIoZGVmYXVsdFByb2ZpbGVTeW5jaHJvbml6ZXIsIGFjdGlvbiwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRyZXR1cm4gaXNVbmRlZmluZWQocmVzdWx0KSA/IG51bGwgOiByZXN1bHQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0U3luY2hyb25pemVyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFQcm9maWxlc01hbmlmZXN0U3luY2hyb25pc2VyLCBwcm9maWxlLCB1bmRlZmluZWQpKTtcblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UubWFuaWZlc3QobnVsbCk7XG5cdFx0XHRjb25zdCBzeW5jUHJvZmlsZXMgPSAoYXdhaXQgdXNlckRhdGFQcm9maWxlTWFuaWZlc3RTeW5jaHJvbml6ZXIuZ2V0UmVtb3RlU3luY2VkUHJvZmlsZXMobWFuaWZlc3Q/LmxhdGVzdCA/PyBudWxsKSkgfHwgW107XG5cdFx0XHRjb25zdCBzeW5jUHJvZmlsZSA9IHN5bmNQcm9maWxlcy5maW5kKHN5bmNQcm9maWxlID0+IHN5bmNQcm9maWxlLmlkID09PSBwcm9maWxlLmlkKTtcblx0XHRcdGlmIChzeW5jUHJvZmlsZSkge1xuXHRcdFx0XHRjb25zdCBwcm9maWxlU3luY2hyb25pemVyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvZmlsZVN5bmNocm9uaXplciwgcHJvZmlsZSwgc3luY1Byb2ZpbGUuY29sbGVjdGlvbikpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnBlcmZvcm1BY3Rpb25XaXRoUHJvZmlsZVN5bmNocm9uaXplcihwcm9maWxlU3luY2hyb25pemVyLCBhY3Rpb24sIGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0cmV0dXJuIGlzVW5kZWZpbmVkKHJlc3VsdCkgPyBudWxsIDogcmVzdWx0O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcGVyZm9ybUFjdGlvbldpdGhQcm9maWxlU3luY2hyb25pemVyPFQ+KHByb2ZpbGVTeW5jaHJvbml6ZXI6IFByb2ZpbGVTeW5jaHJvbml6ZXIsIGFjdGlvbjogKHN5bmNocm9uaXNlcjogSVVzZXJEYXRhU3luY2hyb25pc2VyKSA9PiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+LCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgYWxsU3luY2hyb25pemVycyA9IFsuLi5wcm9maWxlU3luY2hyb25pemVyLmVuYWJsZWQsIC4uLnByb2ZpbGVTeW5jaHJvbml6ZXIuZGlzYWJsZWQucmVkdWNlPChJVXNlckRhdGFTeW5jaHJvbmlzZXIgJiBJRGlzcG9zYWJsZSlbXT4oKHN5bmNocm9uaXplcnMsIHN5bmNSZXNvdXJjZSkgPT4ge1xuXHRcdFx0aWYgKHN5bmNSZXNvdXJjZSAhPT0gU3luY1Jlc291cmNlLldvcmtzcGFjZVN0YXRlKSB7XG5cdFx0XHRcdHN5bmNocm9uaXplcnMucHVzaChkaXNwb3NhYmxlcy5hZGQocHJvZmlsZVN5bmNocm9uaXplci5jcmVhdGVTeW5jaHJvbml6ZXIoc3luY1Jlc291cmNlKSkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHN5bmNocm9uaXplcnM7XG5cdFx0fSwgW10pXTtcblx0XHRmb3IgKGNvbnN0IHN5bmNocm9uaXplciBvZiBhbGxTeW5jaHJvbml6ZXJzKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBhY3Rpb24oc3luY2hyb25pemVyKTtcblx0XHRcdGlmICghaXNVbmRlZmluZWQocmVzdWx0KSkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRTdGF0dXMoc3RhdHVzOiBTeW5jU3RhdHVzKTogdm9pZCB7XG5cdFx0Y29uc3Qgb2xkU3RhdHVzID0gdGhpcy5fc3RhdHVzO1xuXHRcdGlmICh0aGlzLl9zdGF0dXMgIT09IHN0YXR1cykge1xuXHRcdFx0dGhpcy5fc3RhdHVzID0gc3RhdHVzO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0dXMuZmlyZShzdGF0dXMpO1xuXHRcdFx0aWYgKG9sZFN0YXR1cyA9PT0gU3luY1N0YXR1cy5IYXNDb25mbGljdHMpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVMYXN0U3luY1RpbWUoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZsaWN0cygpOiB2b2lkIHtcblx0XHRjb25zdCBjb25mbGljdHMgPSB0aGlzLmdldEFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzKCkubWFwKHN5bmNocm9uaXplciA9PiBzeW5jaHJvbml6ZXIuY29uZmxpY3RzKS5mbGF0KCk7XG5cdFx0aWYgKCFlcXVhbHModGhpcy5fY29uZmxpY3RzLCBjb25mbGljdHMsIChhLCBiKSA9PiBhLnByb2ZpbGUuaWQgPT09IGIucHJvZmlsZS5pZCAmJiBhLnN5bmNSZXNvdXJjZSA9PT0gYi5zeW5jUmVzb3VyY2UgJiYgZXF1YWxzKGEuY29uZmxpY3RzLCBiLmNvbmZsaWN0cywgKGEsIGIpID0+IGlzRXF1YWwoYS5wcmV2aWV3UmVzb3VyY2UsIGIucHJldmlld1Jlc291cmNlKSkpKSB7XG5cdFx0XHR0aGlzLl9jb25mbGljdHMgPSBjb25mbGljdHM7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZsaWN0cy5maXJlKGNvbmZsaWN0cyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVMYXN0U3luY1RpbWUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc3RhdHVzID09PSBTeW5jU3RhdHVzLklkbGUpIHtcblx0XHRcdHRoaXMuX2xhc3RTeW5jVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShMQVNUX1NZTkNfVElNRV9LRVksIHRoaXMuX2xhc3RTeW5jVGltZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VMYXN0U3luY1RpbWUuZmlyZSh0aGlzLl9sYXN0U3luY1RpbWUpO1xuXHRcdH1cblx0fVxuXG5cdGdldE9yQ3JlYXRlQWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcihwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLCBzeW5jUHJvZmlsZTogSVN5bmNVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQpOiBQcm9maWxlU3luY2hyb25pemVyIHtcblx0XHRsZXQgYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplciA9IHRoaXMuYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMuZ2V0KHByb2ZpbGUuaWQpO1xuXHRcdGlmIChhY3RpdmVQcm9maWxlU3luY2hyb25pemVyICYmIGFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJbMF0uY29sbGVjdGlvbiAhPT0gc3luY1Byb2ZpbGU/LmNvbGxlY3Rpb24pIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignUHJvZmlsZSBzeW5jaHJvbml6ZXIgY29sbGVjdGlvbiBkb2VzIG5vdCBtYXRjaCB3aXRoIHRoZSByZW1vdGUgc3luYyBwcm9maWxlIGNvbGxlY3Rpb24nKTtcblx0XHRcdGFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJbMV0uZGlzcG9zZSgpO1xuXHRcdFx0YWN0aXZlUHJvZmlsZVN5bmNocm9uaXplciA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMuZGVsZXRlKHByb2ZpbGUuaWQpO1xuXHRcdH1cblx0XHRpZiAoIWFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXIpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgcHJvZmlsZVN5bmNocm9uaXplciA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb2ZpbGVTeW5jaHJvbml6ZXIsIHByb2ZpbGUsIHN5bmNQcm9maWxlPy5jb2xsZWN0aW9uKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocHJvZmlsZVN5bmNocm9uaXplci5vbkRpZENoYW5nZVN0YXR1cyhlID0+IHRoaXMuc2V0U3RhdHVzKGUpKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocHJvZmlsZVN5bmNocm9uaXplci5vbkRpZENoYW5nZUNvbmZsaWN0cyhjb25mbGljdHMgPT4gdGhpcy51cGRhdGVDb25mbGljdHMoKSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHByb2ZpbGVTeW5jaHJvbml6ZXIub25EaWRDaGFuZ2VMb2NhbChlID0+IHRoaXMuX29uRGlkQ2hhbmdlTG9jYWwuZmlyZShlKSkpO1xuXHRcdFx0dGhpcy5hY3RpdmVQcm9maWxlU3luY2hyb25pemVycy5zZXQocHJvZmlsZS5pZCwgYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplciA9IFtwcm9maWxlU3luY2hyb25pemVyLCBkaXNwb3NhYmxlc10pO1xuXHRcdH1cblx0XHRyZXR1cm4gYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplclswXTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMoKTogUHJvZmlsZVN5bmNocm9uaXplcltdIHtcblx0XHRjb25zdCBwcm9maWxlU3luY2hyb25pemVyczogUHJvZmlsZVN5bmNocm9uaXplcltdID0gW107XG5cdFx0Zm9yIChjb25zdCBbcHJvZmlsZVN5bmNocm9uaXplcl0gb2YgdGhpcy5hY3RpdmVQcm9maWxlU3luY2hyb25pemVycy52YWx1ZXMoKSkge1xuXHRcdFx0cHJvZmlsZVN5bmNocm9uaXplcnMucHVzaChwcm9maWxlU3luY2hyb25pemVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHByb2ZpbGVTeW5jaHJvbml6ZXJzO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcnMuZm9yRWFjaCgoWywgZGlzcG9zYWJsZV0pID0+IGRpc3Bvc2FibGUuZGlzcG9zZSgpKTtcblx0XHR0aGlzLmFjdGl2ZVByb2ZpbGVTeW5jaHJvbml6ZXJzLmNsZWFyKCk7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrRW5hYmxlbWVudCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3QgZW5hYmxlZCcpO1xuXHRcdH1cblx0fVxuXG59XG5cblxuY2xhc3MgUHJvZmlsZVN5bmNocm9uaXplciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2VuYWJsZWQ6IFtJVXNlckRhdGFTeW5jaHJvbmlzZXIsIG51bWJlciwgSURpc3Bvc2FibGVdW10gPSBbXTtcblx0Z2V0IGVuYWJsZWQoKTogSVVzZXJEYXRhU3luY2hyb25pc2VyW10geyByZXR1cm4gdGhpcy5fZW5hYmxlZC5zb3J0KChhLCBiKSA9PiBhWzFdIC0gYlsxXSkubWFwKChbc3luY2hyb25pemVyXSkgPT4gc3luY2hyb25pemVyKTsgfVxuXG5cdGdldCBkaXNhYmxlZCgpOiBTeW5jUmVzb3VyY2VbXSB7IHJldHVybiBBTExfU1lOQ19SRVNPVVJDRVMuZmlsdGVyKHN5bmNSZXNvdXJjZSA9PiAhdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc1Jlc291cmNlRW5hYmxlZChzeW5jUmVzb3VyY2UpKTsgfVxuXG5cdHByaXZhdGUgX3N0YXR1czogU3luY1N0YXR1cyA9IFN5bmNTdGF0dXMuSWRsZTtcblx0Z2V0IHN0YXR1cygpOiBTeW5jU3RhdHVzIHsgcmV0dXJuIHRoaXMuX3N0YXR1czsgfVxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVN0YXR1czogRW1pdHRlcjxTeW5jU3RhdHVzPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFN5bmNTdGF0dXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVN0YXR1czogRXZlbnQ8U3luY1N0YXR1cz4gPSB0aGlzLl9vbkRpZENoYW5nZVN0YXR1cy5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUxvY2FsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8U3luY1Jlc291cmNlPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VMb2NhbCA9IHRoaXMuX29uRGlkQ2hhbmdlTG9jYWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfY29uZmxpY3RzOiBJVXNlckRhdGFTeW5jUmVzb3VyY2VDb25mbGljdHNbXSA9IFtdO1xuXHRnZXQgY29uZmxpY3RzKCk6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUNvbmZsaWN0c1tdIHsgcmV0dXJuIHRoaXMuX2NvbmZsaWN0czsgfVxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUNvbmZsaWN0cyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElVc2VyRGF0YVN5bmNSZXNvdXJjZUNvbmZsaWN0c1tdPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb25mbGljdHMgPSB0aGlzLl9vbkRpZENoYW5nZUNvbmZsaWN0cy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLFxuXHRcdHJlYWRvbmx5IGNvbGxlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5vbkRpZENoYW5nZVJlc291cmNlRW5hYmxlbWVudCgoW3N5bmNSZXNvdXJjZSwgZW5hYmxlbWVudF0pID0+IHRoaXMub25EaWRDaGFuZ2VSZXNvdXJjZUVuYWJsZW1lbnQoc3luY1Jlc291cmNlLCBlbmFibGVtZW50KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9lbmFibGVkLnNwbGljZSgwLCB0aGlzLl9lbmFibGVkLmxlbmd0aCkuZm9yRWFjaCgoWywgLCBkaXNwb3NhYmxlXSkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpKSk7XG5cdFx0Zm9yIChjb25zdCBzeW5jUmVzb3VyY2Ugb2YgQUxMX1NZTkNfUkVTT1VSQ0VTKSB7XG5cdFx0XHRpZiAodXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNSZXNvdXJjZUVuYWJsZWQoc3luY1Jlc291cmNlKSkge1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyU3luY2hyb25pemVyKHN5bmNSZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZENoYW5nZVJlc291cmNlRW5hYmxlbWVudChzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSwgZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChlbmFibGVkKSB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyU3luY2hyb25pemVyKHN5bmNSZXNvdXJjZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZGVSZWdpc3RlclN5bmNocm9uaXplcihzeW5jUmVzb3VyY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCByZWdpc3RlclN5bmNocm9uaXplcihzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9lbmFibGVkLnNvbWUoKFtzeW5jaHJvbml6ZXJdKSA9PiBzeW5jaHJvbml6ZXIucmVzb3VyY2UgPT09IHN5bmNSZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHN5bmNSZXNvdXJjZSA9PT0gU3luY1Jlc291cmNlLkV4dGVuc2lvbnMgJiYgIXRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTa2lwcGluZyBleHRlbnNpb25zIHN5bmMgYmVjYXVzZSBnYWxsZXJ5IGlzIG5vdCBjb25maWd1cmVkJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChzeW5jUmVzb3VyY2UgPT09IFN5bmNSZXNvdXJjZS5Qcm9maWxlcykge1xuXHRcdFx0aWYgKCF0aGlzLnByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHN5bmNSZXNvdXJjZSA9PT0gU3luY1Jlc291cmNlLldvcmtzcGFjZVN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChzeW5jUmVzb3VyY2UgIT09IFN5bmNSZXNvdXJjZS5Qcm9maWxlcyAmJiB0aGlzLnByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5bc3luY1Jlc291cmNlXSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBTa2lwcGluZyBzeW5jaW5nICR7c3luY1Jlc291cmNlfSBpbiAke3RoaXMucHJvZmlsZS5uYW1lfSBiZWNhdXNlIGl0IGlzIGFscmVhZHkgc3luY2VkIGJ5IGRlZmF1bHQgcHJvZmlsZWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBzeW5jaHJvbml6ZXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5jcmVhdGVTeW5jaHJvbml6ZXIoc3luY1Jlc291cmNlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHN5bmNocm9uaXplci5vbkRpZENoYW5nZVN0YXR1cygoKSA9PiB0aGlzLnVwZGF0ZVN0YXR1cygpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHN5bmNocm9uaXplci5vbkRpZENoYW5nZUNvbmZsaWN0cygoKSA9PiB0aGlzLnVwZGF0ZUNvbmZsaWN0cygpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHN5bmNocm9uaXplci5vbkRpZENoYW5nZUxvY2FsKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlTG9jYWwuZmlyZShzeW5jUmVzb3VyY2UpKSk7XG5cdFx0Y29uc3Qgb3JkZXIgPSB0aGlzLmdldE9yZGVyKHN5bmNSZXNvdXJjZSk7XG5cdFx0dGhpcy5fZW5hYmxlZC5wdXNoKFtzeW5jaHJvbml6ZXIsIG9yZGVyLCBkaXNwb3NhYmxlc10pO1xuXHR9XG5cblx0cHJpdmF0ZSBkZVJlZ2lzdGVyU3luY2hyb25pemVyKHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9lbmFibGVkLmZpbmRJbmRleCgoW3N5bmNocm9uaXplcl0pID0+IHN5bmNocm9uaXplci5yZXNvdXJjZSA9PT0gc3luY1Jlc291cmNlKTtcblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRjb25zdCBbW3N5bmNocm9uaXplciwgLCBkaXNwb3NhYmxlXV0gPSB0aGlzLl9lbmFibGVkLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKCk7XG5cdFx0XHRzeW5jaHJvbml6ZXIuc3RvcCgpLnRoZW4obnVsbCwgZXJyb3IgPT4gdGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKSk7XG5cdFx0fVxuXHR9XG5cblx0Y3JlYXRlU3luY2hyb25pemVyKHN5bmNSZXNvdXJjZTogRXhjbHVkZTxTeW5jUmVzb3VyY2UsIFN5bmNSZXNvdXJjZS5Xb3Jrc3BhY2VTdGF0ZT4pOiBJVXNlckRhdGFTeW5jaHJvbmlzZXIgJiBJRGlzcG9zYWJsZSB7XG5cdFx0c3dpdGNoIChzeW5jUmVzb3VyY2UpIHtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlNldHRpbmdzOiByZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc1N5bmNocm9uaXNlciwgdGhpcy5wcm9maWxlLCB0aGlzLmNvbGxlY3Rpb24pO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuS2V5YmluZGluZ3M6IHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdzU3luY2hyb25pc2VyLCB0aGlzLnByb2ZpbGUsIHRoaXMuY29sbGVjdGlvbik7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TbmlwcGV0czogcmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU25pcHBldHNTeW5jaHJvbmlzZXIsIHRoaXMucHJvZmlsZSwgdGhpcy5jb2xsZWN0aW9uKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlByb21wdHM6IHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb21wdHNTeW5jaHJvbml6ZXIsIHRoaXMucHJvZmlsZSwgdGhpcy5jb2xsZWN0aW9uKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlRhc2tzOiByZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUYXNrc1N5bmNocm9uaXNlciwgdGhpcy5wcm9maWxlLCB0aGlzLmNvbGxlY3Rpb24pO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGU6IHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEdsb2JhbFN0YXRlU3luY2hyb25pc2VyLCB0aGlzLnByb2ZpbGUsIHRoaXMuY29sbGVjdGlvbik7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5FeHRlbnNpb25zOiByZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zU3luY2hyb25pc2VyLCB0aGlzLnByb2ZpbGUsIHRoaXMuY29sbGVjdGlvbik7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5Qcm9maWxlczogcmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFQcm9maWxlc01hbmlmZXN0U3luY2hyb25pc2VyLCB0aGlzLnByb2ZpbGUsIHRoaXMuY29sbGVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc3luYyhtYW5pZmVzdDogSVVzZXJEYXRhTWFuaWZlc3QgfCBudWxsLCBwcmV2aWV3OiBib29sZWFuLCBleGVjdXRpb25JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFtTeW5jUmVzb3VyY2UsIFVzZXJEYXRhU3luY0Vycm9yXVtdPiB7XG5cblx0XHQvLyBSZXR1cm4gaWYgY2FuY2VsbGF0aW9uIGlzIHJlcXVlc3RlZFxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN5bmNocm9uaXplcnMgPSB0aGlzLmVuYWJsZWQ7XG5cdFx0aWYgKCFzeW5jaHJvbml6ZXJzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzeW5jRXJyb3JzOiBbU3luY1Jlc291cmNlLCBVc2VyRGF0YVN5bmNFcnJvcl1bXSA9IFtdO1xuXHRcdFx0Y29uc3Qgc3luY0hlYWRlcnMgPSBjcmVhdGVTeW5jSGVhZGVycyhleGVjdXRpb25JZCk7XG5cdFx0XHRjb25zdCByZXNvdXJjZU1hbmlmZXN0OiBJVXNlckRhdGFSZXNvdXJjZU1hbmlmZXN0IHwgbnVsbCA9ICh0aGlzLmNvbGxlY3Rpb24gPyBtYW5pZmVzdD8uY29sbGVjdGlvbnM/Llt0aGlzLmNvbGxlY3Rpb25dPy5sYXRlc3QgOiBtYW5pZmVzdD8ubGF0ZXN0KSA/PyBudWxsO1xuXHRcdFx0Y29uc3QgdXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbiA9IHByZXZpZXcgPyBhd2FpdCB0aGlzLmdldFVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24ocmVzb3VyY2VNYW5pZmVzdCkgOiB0aGlzLmdldExvY2FsVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0Zm9yIChjb25zdCBzeW5jaHJvbmlzZXIgb2Ygc3luY2hyb25pemVycykge1xuXHRcdFx0XHQvLyBSZXR1cm4gaWYgY2FuY2VsbGF0aW9uIGlzIHJlcXVlc3RlZFxuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBSZXR1cm4gaWYgcmVzb3VyY2UgaXMgbm90IGVuYWJsZWRcblx0XHRcdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzUmVzb3VyY2VFbmFibGVkKHN5bmNocm9uaXNlci5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHN5bmNocm9uaXNlci5zeW5jKHJlc291cmNlTWFuaWZlc3QsIHByZXZpZXcsIHVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24sIHN5bmNIZWFkZXJzKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY0Vycm9yID0gVXNlckRhdGFTeW5jRXJyb3IudG9Vc2VyRGF0YVN5bmNFcnJvcihlKTtcblx0XHRcdFx0XHRyZXBvcnRVc2VyRGF0YVN5bmNFcnJvcih1c2VyRGF0YVN5bmNFcnJvciwgZXhlY3V0aW9uSWQsIHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgdGhpcy50ZWxlbWV0cnlTZXJ2aWNlKTtcblx0XHRcdFx0XHRpZiAoY2FuQmFpbG91dChlKSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgdXNlckRhdGFTeW5jRXJyb3I7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gTG9nIGFuZCBhbmQgY29udGludWVcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGAke3N5bmNocm9uaXNlci5yZXNvdXJjZX06ICR7dG9FcnJvck1lc3NhZ2UoZSl9YCk7XG5cdFx0XHRcdFx0c3luY0Vycm9ycy5wdXNoKFtzeW5jaHJvbmlzZXIucmVzb3VyY2UsIHVzZXJEYXRhU3luY0Vycm9yXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHN5bmNFcnJvcnM7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYXBwbHkoZXhlY3V0aW9uSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc3luY0hlYWRlcnMgPSBjcmVhdGVTeW5jSGVhZGVycyhleGVjdXRpb25JZCk7XG5cdFx0Zm9yIChjb25zdCBzeW5jaHJvbmlzZXIgb2YgdGhpcy5lbmFibGVkKSB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgc3luY2hyb25pc2VyLmFwcGx5KGZhbHNlLCBzeW5jSGVhZGVycyk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY0Vycm9yID0gVXNlckRhdGFTeW5jRXJyb3IudG9Vc2VyRGF0YVN5bmNFcnJvcihlKTtcblx0XHRcdFx0cmVwb3J0VXNlckRhdGFTeW5jRXJyb3IodXNlckRhdGFTeW5jRXJyb3IsIGV4ZWN1dGlvbklkLCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsIHRoaXMudGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0XHRcdGlmIChjYW5CYWlsb3V0KGUpKSB7XG5cdFx0XHRcdFx0dGhyb3cgdXNlckRhdGFTeW5jRXJyb3I7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBMb2cgYW5kIGFuZCBjb250aW51ZVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgJHtzeW5jaHJvbmlzZXIucmVzb3VyY2V9OiAke3RvRXJyb3JNZXNzYWdlKGUpfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBzeW5jaHJvbmlzZXIgb2YgdGhpcy5lbmFibGVkKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoc3luY2hyb25pc2VyLnN0YXR1cyAhPT0gU3luY1N0YXR1cy5JZGxlKSB7XG5cdFx0XHRcdFx0YXdhaXQgc3luY2hyb25pc2VyLnN0b3AoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVzZXRMb2NhbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmb3IgKGNvbnN0IHN5bmNocm9uaXNlciBvZiB0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHN5bmNocm9uaXNlci5yZXNldExvY2FsKCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgJHtzeW5jaHJvbmlzZXIucmVzb3VyY2V9OiAke3RvRXJyb3JNZXNzYWdlKGUpfWApO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uKG1hbmlmZXN0OiBJVXNlckRhdGFSZXNvdXJjZU1hbmlmZXN0IHwgbnVsbCk6IFByb21pc2U8SVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24+IHtcblx0XHRpZiAoIXRoaXMucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cdFx0Y29uc3QgbG9jYWwgPSB0aGlzLmdldExvY2FsVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbigpO1xuXHRcdGNvbnN0IHNldHRpbmdzU3luY2hyb25pemVyID0gdGhpcy5lbmFibGVkLmZpbmQoc3luY2hyb25pemVyID0+IHN5bmNocm9uaXplciBpbnN0YW5jZW9mIFNldHRpbmdzU3luY2hyb25pc2VyKTtcblx0XHRpZiAoc2V0dGluZ3NTeW5jaHJvbml6ZXIpIHtcblx0XHRcdGNvbnN0IHJlbW90ZSA9IGF3YWl0ICg8U2V0dGluZ3NTeW5jaHJvbmlzZXI+c2V0dGluZ3NTeW5jaHJvbml6ZXIpLmdldFJlbW90ZVVzZXJEYXRhU3luY0NvbmZpZ3VyYXRpb24obWFuaWZlc3QpO1xuXHRcdFx0cmV0dXJuIHsgLi4ubG9jYWwsIC4uLnJlbW90ZSB9O1xuXHRcdH1cblx0XHRyZXR1cm4gbG9jYWw7XG5cdH1cblxuXHRwcml2YXRlIGdldExvY2FsVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbigpOiBJVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVVNFUl9EQVRBX1NZTkNfQ09ORklHVVJBVElPTl9TQ09QRSk7XG5cdH1cblxuXHRwcml2YXRlIHNldFN0YXR1cyhzdGF0dXM6IFN5bmNTdGF0dXMpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdHVzICE9PSBzdGF0dXMpIHtcblx0XHRcdHRoaXMuX3N0YXR1cyA9IHN0YXR1cztcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdHVzLmZpcmUoc3RhdHVzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0YXR1cygpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZUNvbmZsaWN0cygpO1xuXHRcdGlmICh0aGlzLmVuYWJsZWQuc29tZShzID0+IHMuc3RhdHVzID09PSBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cykpIHtcblx0XHRcdHJldHVybiB0aGlzLnNldFN0YXR1cyhTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmVuYWJsZWQuc29tZShzID0+IHMuc3RhdHVzID09PSBTeW5jU3RhdHVzLlN5bmNpbmcpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXRTdGF0dXMoU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc2V0U3RhdHVzKFN5bmNTdGF0dXMuSWRsZSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZsaWN0cygpOiB2b2lkIHtcblx0XHRjb25zdCBjb25mbGljdHMgPSB0aGlzLmVuYWJsZWQuZmlsdGVyKHMgPT4gcy5zdGF0dXMgPT09IFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKVxuXHRcdFx0LmZpbHRlcihzID0+IHMuY29uZmxpY3RzLmNvbmZsaWN0cy5sZW5ndGggPiAwKVxuXHRcdFx0Lm1hcChzID0+IHMuY29uZmxpY3RzKTtcblx0XHRpZiAoIWVxdWFscyh0aGlzLl9jb25mbGljdHMsIGNvbmZsaWN0cywgKGEsIGIpID0+IGEuc3luY1Jlc291cmNlID09PSBiLnN5bmNSZXNvdXJjZSAmJiBlcXVhbHMoYS5jb25mbGljdHMsIGIuY29uZmxpY3RzLCAoYSwgYikgPT4gaXNFcXVhbChhLnByZXZpZXdSZXNvdXJjZSwgYi5wcmV2aWV3UmVzb3VyY2UpKSkpIHtcblx0XHRcdHRoaXMuX2NvbmZsaWN0cyA9IGNvbmZsaWN0cztcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29uZmxpY3RzLmZpcmUoY29uZmxpY3RzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE9yZGVyKHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlKTogbnVtYmVyIHtcblx0XHRzd2l0Y2ggKHN5bmNSZXNvdXJjZSkge1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU2V0dGluZ3M6IHJldHVybiAwO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuS2V5YmluZGluZ3M6IHJldHVybiAxO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU25pcHBldHM6IHJldHVybiAyO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuVGFza3M6IHJldHVybiAzO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGU6IHJldHVybiA0O1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuRXh0ZW5zaW9uczogcmV0dXJuIDU7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5Qcm9tcHRzOiByZXR1cm4gNjtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlByb2ZpbGVzOiByZXR1cm4gNztcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLldvcmtzcGFjZVN0YXRlOiByZXR1cm4gODtcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gY2FuQmFpbG91dChlOiBhbnkpOiBib29sZWFuIHtcblx0aWYgKGUgaW5zdGFuY2VvZiBVc2VyRGF0YVN5bmNFcnJvcikge1xuXHRcdHN3aXRjaCAoZS5jb2RlKSB7XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5NZXRob2ROb3RGb3VuZDpcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlRvb0xhcmdlOlxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzOlxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzQW5kUmV0cnlBZnRlcjpcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkxvY2FsVG9vTWFueVJlcXVlc3RzOlxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTG9jYWxUb29NYW55UHJvZmlsZXM6XG5cdFx0XHRjYXNlIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Hb25lOlxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVXBncmFkZVJlcXVpcmVkOlxuXHRcdFx0Y2FzZSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuSW5jb21wYXRpYmxlUmVtb3RlQ29udGVudDpcblx0XHRcdGNhc2UgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkluY29tcGF0aWJsZUxvY2FsQ29udGVudDpcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcmVwb3J0VXNlckRhdGFTeW5jRXJyb3IodXNlckRhdGFTeW5jRXJyb3I6IFVzZXJEYXRhU3luY0Vycm9yLCBleGVjdXRpb25JZDogc3RyaW5nLCB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UpOiB2b2lkIHtcblx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHsgY29kZTogc3RyaW5nOyBzZXJ2aWNlOiBzdHJpbmc7IHNlcnZlckNvZGU/OiBzdHJpbmc7IHVybD86IHN0cmluZzsgcmVzb3VyY2U/OiBzdHJpbmc7IGV4ZWN1dGlvbklkPzogc3RyaW5nIH0sIFN5bmNFcnJvckNsYXNzaWZpY2F0aW9uPignc3luYy9lcnJvcicsXG5cdFx0e1xuXHRcdFx0Y29kZTogdXNlckRhdGFTeW5jRXJyb3IuY29kZSxcblx0XHRcdHNlcnZlckNvZGU6IHVzZXJEYXRhU3luY0Vycm9yIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jU3RvcmVFcnJvciA/IFN0cmluZyh1c2VyRGF0YVN5bmNFcnJvci5zZXJ2ZXJDb2RlKSA6IHVuZGVmaW5lZCxcblx0XHRcdHVybDogdXNlckRhdGFTeW5jRXJyb3IgaW5zdGFuY2VvZiBVc2VyRGF0YVN5bmNTdG9yZUVycm9yID8gdXNlckRhdGFTeW5jRXJyb3IudXJsIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVzb3VyY2U6IHVzZXJEYXRhU3luY0Vycm9yLnJlc291cmNlLFxuXHRcdFx0ZXhlY3V0aW9uSWQsXG5cdFx0XHRzZXJ2aWNlOiB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlIS51cmwudG9TdHJpbmcoKVxuXHRcdH0pO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWM7QUFDdkIsU0FBNEIseUJBQXlCLHdCQUF3QjtBQUM3RSxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLGVB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
