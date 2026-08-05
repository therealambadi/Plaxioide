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
import { toFormattedString } from "../../../base/common/jsonFormatter.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { AbstractSynchroniser } from "./abstractSynchronizer.js";
import { merge } from "./userDataProfilesManifestMerge.js";
import { Change, IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncStoreService, SyncResource, USER_DATA_SYNC_SCHEME, UserDataSyncError, UserDataSyncErrorCode } from "./userDataSync.js";
let UserDataProfilesManifestSynchroniser = class extends AbstractSynchroniser {
  constructor(profile, collection, userDataProfilesService, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, logService, configurationService, userDataSyncEnablementService, telemetryService, uriIdentityService) {
    super({ syncResource: SyncResource.Profiles, profile }, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
    this.userDataProfilesService = userDataProfilesService;
    this.version = 2;
    this.previewResource = this.extUri.joinPath(this.syncPreviewFolder, "profiles.json");
    this.baseResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "base" });
    this.localResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "local" });
    this.remoteResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "remote" });
    this.acceptedResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "accepted" });
    this._register(userDataProfilesService.onDidChangeProfiles(() => this.triggerLocalChange()));
  }
  async getLastSyncedProfiles() {
    const lastSyncUserData = await this.getLastSyncUserData();
    return lastSyncUserData?.syncData ? parseUserDataProfilesManifest(lastSyncUserData.syncData) : null;
  }
  async getRemoteSyncedProfiles(manifest) {
    const lastSyncUserData = await this.getLastSyncUserData();
    const remoteUserData = await this.getLatestRemoteUserData(manifest, lastSyncUserData);
    return remoteUserData?.syncData ? parseUserDataProfilesManifest(remoteUserData.syncData) : null;
  }
  async generateSyncPreview(remoteUserData, lastSyncUserData, isRemoteDataFromCurrentMachine) {
    const remoteProfiles = remoteUserData.syncData ? parseUserDataProfilesManifest(remoteUserData.syncData) : null;
    const lastSyncProfiles = lastSyncUserData?.syncData ? parseUserDataProfilesManifest(lastSyncUserData.syncData) : null;
    const localProfiles = this.getLocalUserDataProfiles();
    const { local, remote } = merge(localProfiles, remoteProfiles, lastSyncProfiles, []);
    const previewResult = {
      local,
      remote,
      content: lastSyncProfiles ? this.stringifyRemoteProfiles(lastSyncProfiles) : null,
      localChange: local.added.length > 0 || local.removed.length > 0 || local.updated.length > 0 ? Change.Modified : Change.None,
      remoteChange: remote !== null ? Change.Modified : Change.None
    };
    const localContent = stringifyLocalProfiles(localProfiles, false);
    return [{
      baseResource: this.baseResource,
      baseContent: lastSyncProfiles ? this.stringifyRemoteProfiles(lastSyncProfiles) : null,
      localResource: this.localResource,
      localContent,
      remoteResource: this.remoteResource,
      remoteContent: remoteProfiles ? this.stringifyRemoteProfiles(remoteProfiles) : null,
      remoteProfiles,
      previewResource: this.previewResource,
      previewResult,
      localChange: previewResult.localChange,
      remoteChange: previewResult.remoteChange,
      acceptedResource: this.acceptedResource
    }];
  }
  async hasRemoteChanged(lastSyncUserData) {
    const lastSyncProfiles = lastSyncUserData?.syncData ? parseUserDataProfilesManifest(lastSyncUserData.syncData) : null;
    const localProfiles = this.getLocalUserDataProfiles();
    const { remote } = merge(localProfiles, lastSyncProfiles, lastSyncProfiles, []);
    return !!remote?.added.length || !!remote?.removed.length || !!remote?.updated.length;
  }
  async getMergeResult(resourcePreview, token) {
    return { ...resourcePreview.previewResult, hasConflicts: false };
  }
  async getAcceptResult(resourcePreview, resource, content, token) {
    if (this.extUri.isEqual(resource, this.localResource)) {
      return this.acceptLocal(resourcePreview);
    }
    if (this.extUri.isEqual(resource, this.remoteResource)) {
      return this.acceptRemote(resourcePreview);
    }
    if (this.extUri.isEqual(resource, this.previewResource)) {
      return resourcePreview.previewResult;
    }
    throw new Error(`Invalid Resource: ${resource.toString()}`);
  }
  async acceptLocal(resourcePreview) {
    const localProfiles = this.getLocalUserDataProfiles();
    const mergeResult = merge(localProfiles, null, null, []);
    const { local, remote } = mergeResult;
    return {
      content: resourcePreview.localContent,
      local,
      remote,
      localChange: local.added.length > 0 || local.removed.length > 0 || local.updated.length > 0 ? Change.Modified : Change.None,
      remoteChange: remote !== null ? Change.Modified : Change.None
    };
  }
  async acceptRemote(resourcePreview) {
    const remoteProfiles = resourcePreview.remoteContent ? JSON.parse(resourcePreview.remoteContent) : null;
    const lastSyncProfiles = [];
    const localProfiles = [];
    for (const profile of this.getLocalUserDataProfiles()) {
      const remoteProfile = remoteProfiles?.find((remoteProfile2) => remoteProfile2.id === profile.id);
      if (remoteProfile) {
        lastSyncProfiles.push({ id: profile.id, name: profile.name, collection: remoteProfile.collection });
        localProfiles.push(profile);
      }
    }
    if (remoteProfiles !== null) {
      const mergeResult = merge(localProfiles, remoteProfiles, lastSyncProfiles, []);
      const { local, remote } = mergeResult;
      return {
        content: resourcePreview.remoteContent,
        local,
        remote,
        localChange: local.added.length > 0 || local.removed.length > 0 || local.updated.length > 0 ? Change.Modified : Change.None,
        remoteChange: remote !== null ? Change.Modified : Change.None
      };
    } else {
      return {
        content: resourcePreview.remoteContent,
        local: { added: [], removed: [], updated: [] },
        remote: null,
        localChange: Change.None,
        remoteChange: Change.None
      };
    }
  }
  async applyResult(remoteUserData, lastSyncUserData, resourcePreviews, force) {
    const { local, remote, localChange, remoteChange } = resourcePreviews[0][1];
    if (localChange === Change.None && remoteChange === Change.None) {
      this.logService.info(`${this.syncResourceLogLabel}: No changes found during synchronizing profiles.`);
    }
    const remoteProfiles = resourcePreviews[0][0].remoteProfiles || [];
    if (remoteProfiles.length + (remote?.added.length ?? 0) - (remote?.removed.length ?? 0) > 20) {
      throw new UserDataSyncError("Too many profiles to sync. Please remove some profiles and try again.", UserDataSyncErrorCode.LocalTooManyProfiles);
    }
    if (localChange !== Change.None) {
      await this.backupLocal(stringifyLocalProfiles(this.getLocalUserDataProfiles(), false));
      await Promise.all(local.removed.map(async (profile) => {
        this.logService.trace(`${this.syncResourceLogLabel}: Removing '${profile.name}' profile...`);
        await this.userDataProfilesService.removeProfile(profile);
        this.logService.info(`${this.syncResourceLogLabel}: Removed profile '${profile.name}'.`);
      }));
      await Promise.all(local.added.map(async (profile) => {
        this.logService.trace(`${this.syncResourceLogLabel}: Creating '${profile.name}' profile...`);
        await this.userDataProfilesService.createProfile(profile.id, profile.name, { icon: profile.icon, useDefaultFlags: profile.useDefaultFlags });
        this.logService.info(`${this.syncResourceLogLabel}: Created profile '${profile.name}'.`);
      }));
      await Promise.all(local.updated.map(async (profile) => {
        const localProfile = this.userDataProfilesService.profiles.find((p) => p.id === profile.id);
        if (localProfile) {
          this.logService.trace(`${this.syncResourceLogLabel}: Updating '${profile.name}' profile...`);
          await this.userDataProfilesService.updateProfile(localProfile, { name: profile.name, icon: profile.icon, useDefaultFlags: profile.useDefaultFlags });
          this.logService.info(`${this.syncResourceLogLabel}: Updated profile '${profile.name}'.`);
        } else {
          this.logService.info(`${this.syncResourceLogLabel}: Could not find profile with id '${profile.id}' to update.`);
        }
      }));
    }
    if (remoteChange !== Change.None) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating remote profiles...`);
      const addedCollections = [];
      const canAddRemoteProfiles = remoteProfiles.length + (remote?.added.length ?? 0) <= 20;
      if (canAddRemoteProfiles) {
        for (const profile of remote?.added || []) {
          const collection = await this.userDataSyncStoreService.createCollection(this.syncHeaders);
          addedCollections.push(collection);
          remoteProfiles.push({ id: profile.id, name: profile.name, collection, icon: profile.icon, useDefaultFlags: profile.useDefaultFlags });
        }
      } else {
        this.logService.info(`${this.syncResourceLogLabel}: Could not create remote profiles as there are too many profiles.`);
      }
      for (const profile of remote?.removed || []) {
        remoteProfiles.splice(remoteProfiles.findIndex(({ id }) => profile.id === id), 1);
      }
      for (const profile of remote?.updated || []) {
        const profileToBeUpdated = remoteProfiles.find(({ id }) => profile.id === id);
        if (profileToBeUpdated) {
          remoteProfiles.splice(remoteProfiles.indexOf(profileToBeUpdated), 1, { ...profileToBeUpdated, id: profile.id, name: profile.name, icon: profile.icon, useDefaultFlags: profile.useDefaultFlags });
        }
      }
      try {
        remoteUserData = await this.updateRemoteProfiles(remoteProfiles, force ? null : remoteUserData.ref);
        this.logService.info(`${this.syncResourceLogLabel}: Updated remote profiles.${canAddRemoteProfiles && remote?.added.length ? ` Added: ${JSON.stringify(remote.added.map((e) => e.name))}.` : ""}${remote?.updated.length ? ` Updated: ${JSON.stringify(remote.updated.map((e) => e.name))}.` : ""}${remote?.removed.length ? ` Removed: ${JSON.stringify(remote.removed.map((e) => e.name))}.` : ""}`);
      } catch (error) {
        if (addedCollections.length) {
          this.logService.info(`${this.syncResourceLogLabel}: Failed to update remote profiles. Cleaning up added collections...`);
          for (const collection of addedCollections) {
            await this.userDataSyncStoreService.deleteCollection(collection, this.syncHeaders);
          }
        }
        throw error;
      }
      for (const profile of remote?.removed || []) {
        await this.userDataSyncStoreService.deleteCollection(profile.collection, this.syncHeaders);
      }
    }
    if (lastSyncUserData?.ref !== remoteUserData.ref) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating last synchronized profiles...`);
      await this.updateLastSyncUserData(remoteUserData);
      this.logService.info(`${this.syncResourceLogLabel}: Updated last synchronized profiles.`);
    }
  }
  async updateRemoteProfiles(profiles, ref) {
    return this.updateRemoteUserData(this.stringifyRemoteProfiles(profiles), ref);
  }
  async hasLocalData() {
    return this.getLocalUserDataProfiles().length > 0;
  }
  async resolveContent(uri) {
    if (this.extUri.isEqual(this.remoteResource, uri) || this.extUri.isEqual(this.baseResource, uri) || this.extUri.isEqual(this.localResource, uri) || this.extUri.isEqual(this.acceptedResource, uri)) {
      const content = await this.resolvePreviewContent(uri);
      return content ? toFormattedString(JSON.parse(content), {}) : content;
    }
    return null;
  }
  getLocalUserDataProfiles() {
    return this.userDataProfilesService.profiles.filter((p) => !p.isDefault && !p.isTransient);
  }
  stringifyRemoteProfiles(profiles) {
    return JSON.stringify([...profiles].sort((a, b) => a.name.localeCompare(b.name)));
  }
};
UserDataProfilesManifestSynchroniser = __decorateClass([
  __decorateParam(2, IUserDataProfilesService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IUserDataSyncStoreService),
  __decorateParam(7, IUserDataSyncLocalStoreService),
  __decorateParam(8, IUserDataSyncLogService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IUserDataSyncEnablementService),
  __decorateParam(11, ITelemetryService),
  __decorateParam(12, IUriIdentityService)
], UserDataProfilesManifestSynchroniser);
function stringifyLocalProfiles(profiles, format) {
  const result = [...profiles].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ id: p.id, name: p.name }));
  return format ? toFormattedString(result, {}) : JSON.stringify(result);
}
function parseUserDataProfilesManifest(syncData) {
  return JSON.parse(syncData.content);
}
export {
  UserDataProfilesManifestSynchroniser,
  parseUserDataProfilesManifest,
  stringifyLocalProfiles
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFN5bmMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyB0b0Zvcm1hdHRlZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25Gb3JtYXR0ZXIuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RTeW5jaHJvbmlzZXIsIElBY2NlcHRSZXN1bHQsIElNZXJnZVJlc3VsdCwgSVJlc291cmNlUHJldmlldyB9IGZyb20gJy4vYWJzdHJhY3RTeW5jaHJvbml6ZXIuanMnO1xuaW1wb3J0IHsgbWVyZ2UgfSBmcm9tICcuL3VzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdE1lcmdlLmpzJztcbmltcG9ydCB7IENoYW5nZSwgSVJlbW90ZVVzZXJEYXRhLCBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIElVc2VyRGF0YVN5bmNocm9uaXNlciwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgU3luY1Jlc291cmNlLCBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIElTeW5jVXNlckRhdGFQcm9maWxlLCBJU3luY0RhdGEsIElVc2VyRGF0YVJlc291cmNlTWFuaWZlc3QsIFVzZXJEYXRhU3luY0Vycm9yLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUgfSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5cbmludGVyZmFjZSBJVXNlckRhdGFQcm9maWxlTWFuaWZlc3RSZXNvdXJjZU1lcmdlUmVzdWx0IGV4dGVuZHMgSUFjY2VwdFJlc3VsdCB7XG5cdHJlYWRvbmx5IGxvY2FsOiB7IGFkZGVkOiBJU3luY1VzZXJEYXRhUHJvZmlsZVtdOyByZW1vdmVkOiBJVXNlckRhdGFQcm9maWxlW107IHVwZGF0ZWQ6IElTeW5jVXNlckRhdGFQcm9maWxlW10gfTtcblx0cmVhZG9ubHkgcmVtb3RlOiB7IGFkZGVkOiBJVXNlckRhdGFQcm9maWxlW107IHJlbW92ZWQ6IElTeW5jVXNlckRhdGFQcm9maWxlW107IHVwZGF0ZWQ6IElVc2VyRGF0YVByb2ZpbGVbXSB9IHwgbnVsbDtcbn1cblxuaW50ZXJmYWNlIElVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3RSZXNvdXJjZVByZXZpZXcgZXh0ZW5kcyBJUmVzb3VyY2VQcmV2aWV3IHtcblx0cmVhZG9ubHkgcHJldmlld1Jlc3VsdDogSVVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0UmVzb3VyY2VNZXJnZVJlc3VsdDtcblx0cmVhZG9ubHkgcmVtb3RlUHJvZmlsZXM6IElTeW5jVXNlckRhdGFQcm9maWxlW10gfCBudWxsO1xufVxuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlc01hbmlmZXN0U3luY2hyb25pc2VyIGV4dGVuZHMgQWJzdHJhY3RTeW5jaHJvbmlzZXIgaW1wbGVtZW50cyBJVXNlckRhdGFTeW5jaHJvbmlzZXIge1xuXG5cdHByb3RlY3RlZCByZWFkb25seSB2ZXJzaW9uOiBudW1iZXIgPSAyO1xuXHRyZWFkb25seSBwcmV2aWV3UmVzb3VyY2U6IFVSSSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHRoaXMuc3luY1ByZXZpZXdGb2xkZXIsICdwcm9maWxlcy5qc29uJyk7XG5cdHJlYWRvbmx5IGJhc2VSZXNvdXJjZTogVVJJID0gdGhpcy5wcmV2aWV3UmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBhdXRob3JpdHk6ICdiYXNlJyB9KTtcblx0cmVhZG9ubHkgbG9jYWxSZXNvdXJjZTogVVJJID0gdGhpcy5wcmV2aWV3UmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBhdXRob3JpdHk6ICdsb2NhbCcgfSk7XG5cdHJlYWRvbmx5IHJlbW90ZVJlc291cmNlOiBVUkkgPSB0aGlzLnByZXZpZXdSZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ3JlbW90ZScgfSk7XG5cdHJlYWRvbmx5IGFjY2VwdGVkUmVzb3VyY2U6IFVSSSA9IHRoaXMucHJldmlld1Jlc291cmNlLndpdGgoeyBzY2hlbWU6IFVTRVJfREFUQV9TWU5DX1NDSEVNRSwgYXV0aG9yaXR5OiAnYWNjZXB0ZWQnIH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsXG5cdFx0Y29sbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlIHVzZXJEYXRhU3luY1N0b3JlU2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlIHVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5Qcm9maWxlcywgcHJvZmlsZSB9LCBjb2xsZWN0aW9uLCBmaWxlU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLCB1c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSwgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UsIGxvZ1NlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZXMoKCkgPT4gdGhpcy50cmlnZ2VyTG9jYWxDaGFuZ2UoKSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0TGFzdFN5bmNlZFByb2ZpbGVzKCk6IFByb21pc2U8SVN5bmNVc2VyRGF0YVByb2ZpbGVbXSB8IG51bGw+IHtcblx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGhpcy5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0cmV0dXJuIGxhc3RTeW5jVXNlckRhdGE/LnN5bmNEYXRhID8gcGFyc2VVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3QobGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSkgOiBudWxsO1xuXHR9XG5cblx0YXN5bmMgZ2V0UmVtb3RlU3luY2VkUHJvZmlsZXMobWFuaWZlc3Q6IElVc2VyRGF0YVJlc291cmNlTWFuaWZlc3QgfCBudWxsKTogUHJvbWlzZTxJU3luY1VzZXJEYXRhUHJvZmlsZVtdIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGxhc3RTeW5jVXNlckRhdGEgPSBhd2FpdCB0aGlzLmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRoaXMuZ2V0TGF0ZXN0UmVtb3RlVXNlckRhdGEobWFuaWZlc3QsIGxhc3RTeW5jVXNlckRhdGEpO1xuXHRcdHJldHVybiByZW1vdGVVc2VyRGF0YT8uc3luY0RhdGEgPyBwYXJzZVVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdChyZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSkgOiBudWxsO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGdlbmVyYXRlU3luY1ByZXZpZXcocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCwgaXNSZW1vdGVEYXRhRnJvbUN1cnJlbnRNYWNoaW5lOiBib29sZWFuKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlc01hbmlmZXN0UmVzb3VyY2VQcmV2aWV3W10+IHtcblx0XHRjb25zdCByZW1vdGVQcm9maWxlczogSVN5bmNVc2VyRGF0YVByb2ZpbGVbXSB8IG51bGwgPSByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSA/IHBhcnNlVXNlckRhdGFQcm9maWxlc01hbmlmZXN0KHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhKSA6IG51bGw7XG5cdFx0Y29uc3QgbGFzdFN5bmNQcm9maWxlczogSVN5bmNVc2VyRGF0YVByb2ZpbGVbXSB8IG51bGwgPSBsYXN0U3luY1VzZXJEYXRhPy5zeW5jRGF0YSA/IHBhcnNlVXNlckRhdGFQcm9maWxlc01hbmlmZXN0KGxhc3RTeW5jVXNlckRhdGEuc3luY0RhdGEpIDogbnVsbDtcblx0XHRjb25zdCBsb2NhbFByb2ZpbGVzID0gdGhpcy5nZXRMb2NhbFVzZXJEYXRhUHJvZmlsZXMoKTtcblxuXHRcdGNvbnN0IHsgbG9jYWwsIHJlbW90ZSB9ID0gbWVyZ2UobG9jYWxQcm9maWxlcywgcmVtb3RlUHJvZmlsZXMsIGxhc3RTeW5jUHJvZmlsZXMsIFtdKTtcblx0XHRjb25zdCBwcmV2aWV3UmVzdWx0OiBJVXNlckRhdGFQcm9maWxlTWFuaWZlc3RSZXNvdXJjZU1lcmdlUmVzdWx0ID0ge1xuXHRcdFx0bG9jYWwsIHJlbW90ZSxcblx0XHRcdGNvbnRlbnQ6IGxhc3RTeW5jUHJvZmlsZXMgPyB0aGlzLnN0cmluZ2lmeVJlbW90ZVByb2ZpbGVzKGxhc3RTeW5jUHJvZmlsZXMpIDogbnVsbCxcblx0XHRcdGxvY2FsQ2hhbmdlOiBsb2NhbC5hZGRlZC5sZW5ndGggPiAwIHx8IGxvY2FsLnJlbW92ZWQubGVuZ3RoID4gMCB8fCBsb2NhbC51cGRhdGVkLmxlbmd0aCA+IDAgPyBDaGFuZ2UuTW9kaWZpZWQgOiBDaGFuZ2UuTm9uZSxcblx0XHRcdHJlbW90ZUNoYW5nZTogcmVtb3RlICE9PSBudWxsID8gQ2hhbmdlLk1vZGlmaWVkIDogQ2hhbmdlLk5vbmUsXG5cdFx0fTtcblxuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeUxvY2FsUHJvZmlsZXMobG9jYWxQcm9maWxlcywgZmFsc2UpO1xuXHRcdHJldHVybiBbe1xuXHRcdFx0YmFzZVJlc291cmNlOiB0aGlzLmJhc2VSZXNvdXJjZSxcblx0XHRcdGJhc2VDb250ZW50OiBsYXN0U3luY1Byb2ZpbGVzID8gdGhpcy5zdHJpbmdpZnlSZW1vdGVQcm9maWxlcyhsYXN0U3luY1Byb2ZpbGVzKSA6IG51bGwsXG5cdFx0XHRsb2NhbFJlc291cmNlOiB0aGlzLmxvY2FsUmVzb3VyY2UsXG5cdFx0XHRsb2NhbENvbnRlbnQsXG5cdFx0XHRyZW1vdGVSZXNvdXJjZTogdGhpcy5yZW1vdGVSZXNvdXJjZSxcblx0XHRcdHJlbW90ZUNvbnRlbnQ6IHJlbW90ZVByb2ZpbGVzID8gdGhpcy5zdHJpbmdpZnlSZW1vdGVQcm9maWxlcyhyZW1vdGVQcm9maWxlcykgOiBudWxsLFxuXHRcdFx0cmVtb3RlUHJvZmlsZXMsXG5cdFx0XHRwcmV2aWV3UmVzb3VyY2U6IHRoaXMucHJldmlld1Jlc291cmNlLFxuXHRcdFx0cHJldmlld1Jlc3VsdCxcblx0XHRcdGxvY2FsQ2hhbmdlOiBwcmV2aWV3UmVzdWx0LmxvY2FsQ2hhbmdlLFxuXHRcdFx0cmVtb3RlQ2hhbmdlOiBwcmV2aWV3UmVzdWx0LnJlbW90ZUNoYW5nZSxcblx0XHRcdGFjY2VwdGVkUmVzb3VyY2U6IHRoaXMuYWNjZXB0ZWRSZXNvdXJjZVxuXHRcdH1dO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGhhc1JlbW90ZUNoYW5nZWQobGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgbGFzdFN5bmNQcm9maWxlczogSVN5bmNVc2VyRGF0YVByb2ZpbGVbXSB8IG51bGwgPSBsYXN0U3luY1VzZXJEYXRhPy5zeW5jRGF0YSA/IHBhcnNlVXNlckRhdGFQcm9maWxlc01hbmlmZXN0KGxhc3RTeW5jVXNlckRhdGEuc3luY0RhdGEpIDogbnVsbDtcblx0XHRjb25zdCBsb2NhbFByb2ZpbGVzID0gdGhpcy5nZXRMb2NhbFVzZXJEYXRhUHJvZmlsZXMoKTtcblx0XHRjb25zdCB7IHJlbW90ZSB9ID0gbWVyZ2UobG9jYWxQcm9maWxlcywgbGFzdFN5bmNQcm9maWxlcywgbGFzdFN5bmNQcm9maWxlcywgW10pO1xuXHRcdHJldHVybiAhIXJlbW90ZT8uYWRkZWQubGVuZ3RoIHx8ICEhcmVtb3RlPy5yZW1vdmVkLmxlbmd0aCB8fCAhIXJlbW90ZT8udXBkYXRlZC5sZW5ndGg7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0TWVyZ2VSZXN1bHQocmVzb3VyY2VQcmV2aWV3OiBJVXNlckRhdGFQcm9maWxlc01hbmlmZXN0UmVzb3VyY2VQcmV2aWV3LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElNZXJnZVJlc3VsdD4ge1xuXHRcdHJldHVybiB7IC4uLnJlc291cmNlUHJldmlldy5wcmV2aWV3UmVzdWx0LCBoYXNDb25mbGljdHM6IGZhbHNlIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0QWNjZXB0UmVzdWx0KHJlc291cmNlUHJldmlldzogSVVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFJlc291cmNlUHJldmlldywgcmVzb3VyY2U6IFVSSSwgY29udGVudDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQWNjZXB0UmVzdWx0PiB7XG5cdFx0LyogQWNjZXB0IGxvY2FsIHJlc291cmNlICovXG5cdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2UsIHRoaXMubG9jYWxSZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmFjY2VwdExvY2FsKHJlc291cmNlUHJldmlldyk7XG5cdFx0fVxuXG5cdFx0LyogQWNjZXB0IHJlbW90ZSByZXNvdXJjZSAqL1xuXHRcdGlmICh0aGlzLmV4dFVyaS5pc0VxdWFsKHJlc291cmNlLCB0aGlzLnJlbW90ZVJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuYWNjZXB0UmVtb3RlKHJlc291cmNlUHJldmlldyk7XG5cdFx0fVxuXG5cdFx0LyogQWNjZXB0IHByZXZpZXcgcmVzb3VyY2UgKi9cblx0XHRpZiAodGhpcy5leHRVcmkuaXNFcXVhbChyZXNvdXJjZSwgdGhpcy5wcmV2aWV3UmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VQcmV2aWV3LnByZXZpZXdSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFJlc291cmNlOiAke3Jlc291cmNlLnRvU3RyaW5nKCl9YCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFjY2VwdExvY2FsKHJlc291cmNlUHJldmlldzogSVVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFJlc291cmNlUHJldmlldyk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0UmVzb3VyY2VNZXJnZVJlc3VsdD4ge1xuXHRcdGNvbnN0IGxvY2FsUHJvZmlsZXMgPSB0aGlzLmdldExvY2FsVXNlckRhdGFQcm9maWxlcygpO1xuXHRcdGNvbnN0IG1lcmdlUmVzdWx0ID0gbWVyZ2UobG9jYWxQcm9maWxlcywgbnVsbCwgbnVsbCwgW10pO1xuXHRcdGNvbnN0IHsgbG9jYWwsIHJlbW90ZSB9ID0gbWVyZ2VSZXN1bHQ7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbnRlbnQ6IHJlc291cmNlUHJldmlldy5sb2NhbENvbnRlbnQsXG5cdFx0XHRsb2NhbCxcblx0XHRcdHJlbW90ZSxcblx0XHRcdGxvY2FsQ2hhbmdlOiBsb2NhbC5hZGRlZC5sZW5ndGggPiAwIHx8IGxvY2FsLnJlbW92ZWQubGVuZ3RoID4gMCB8fCBsb2NhbC51cGRhdGVkLmxlbmd0aCA+IDAgPyBDaGFuZ2UuTW9kaWZpZWQgOiBDaGFuZ2UuTm9uZSxcblx0XHRcdHJlbW90ZUNoYW5nZTogcmVtb3RlICE9PSBudWxsID8gQ2hhbmdlLk1vZGlmaWVkIDogQ2hhbmdlLk5vbmUsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWNjZXB0UmVtb3RlKHJlc291cmNlUHJldmlldzogSVVzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFJlc291cmNlUHJldmlldyk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZU1hbmlmZXN0UmVzb3VyY2VNZXJnZVJlc3VsdD4ge1xuXHRcdGNvbnN0IHJlbW90ZVByb2ZpbGVzOiBJU3luY1VzZXJEYXRhUHJvZmlsZVtdID0gcmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQgPyBKU09OLnBhcnNlKHJlc291cmNlUHJldmlldy5yZW1vdGVDb250ZW50KSA6IG51bGw7XG5cdFx0Y29uc3QgbGFzdFN5bmNQcm9maWxlczogSVN5bmNVc2VyRGF0YVByb2ZpbGVbXSA9IFtdO1xuXHRcdGNvbnN0IGxvY2FsUHJvZmlsZXM6IElVc2VyRGF0YVByb2ZpbGVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB0aGlzLmdldExvY2FsVXNlckRhdGFQcm9maWxlcygpKSB7XG5cdFx0XHRjb25zdCByZW1vdGVQcm9maWxlID0gcmVtb3RlUHJvZmlsZXM/LmZpbmQocmVtb3RlUHJvZmlsZSA9PiByZW1vdGVQcm9maWxlLmlkID09PSBwcm9maWxlLmlkKTtcblx0XHRcdGlmIChyZW1vdGVQcm9maWxlKSB7XG5cdFx0XHRcdGxhc3RTeW5jUHJvZmlsZXMucHVzaCh7IGlkOiBwcm9maWxlLmlkLCBuYW1lOiBwcm9maWxlLm5hbWUsIGNvbGxlY3Rpb246IHJlbW90ZVByb2ZpbGUuY29sbGVjdGlvbiB9KTtcblx0XHRcdFx0bG9jYWxQcm9maWxlcy5wdXNoKHByb2ZpbGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAocmVtb3RlUHJvZmlsZXMgIT09IG51bGwpIHtcblx0XHRcdGNvbnN0IG1lcmdlUmVzdWx0ID0gbWVyZ2UobG9jYWxQcm9maWxlcywgcmVtb3RlUHJvZmlsZXMsIGxhc3RTeW5jUHJvZmlsZXMsIFtdKTtcblx0XHRcdGNvbnN0IHsgbG9jYWwsIHJlbW90ZSB9ID0gbWVyZ2VSZXN1bHQ7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb250ZW50OiByZXNvdXJjZVByZXZpZXcucmVtb3RlQ29udGVudCxcblx0XHRcdFx0bG9jYWwsXG5cdFx0XHRcdHJlbW90ZSxcblx0XHRcdFx0bG9jYWxDaGFuZ2U6IGxvY2FsLmFkZGVkLmxlbmd0aCA+IDAgfHwgbG9jYWwucmVtb3ZlZC5sZW5ndGggPiAwIHx8IGxvY2FsLnVwZGF0ZWQubGVuZ3RoID4gMCA/IENoYW5nZS5Nb2RpZmllZCA6IENoYW5nZS5Ob25lLFxuXHRcdFx0XHRyZW1vdGVDaGFuZ2U6IHJlbW90ZSAhPT0gbnVsbCA/IENoYW5nZS5Nb2RpZmllZCA6IENoYW5nZS5Ob25lLFxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29udGVudDogcmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQsXG5cdFx0XHRcdGxvY2FsOiB7IGFkZGVkOiBbXSwgcmVtb3ZlZDogW10sIHVwZGF0ZWQ6IFtdIH0sXG5cdFx0XHRcdHJlbW90ZTogbnVsbCxcblx0XHRcdFx0bG9jYWxDaGFuZ2U6IENoYW5nZS5Ob25lLFxuXHRcdFx0XHRyZW1vdGVDaGFuZ2U6IENoYW5nZS5Ob25lLFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgYXBwbHlSZXN1bHQocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCwgcmVzb3VyY2VQcmV2aWV3czogW0lVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3RSZXNvdXJjZVByZXZpZXcsIElVc2VyRGF0YVByb2ZpbGVNYW5pZmVzdFJlc291cmNlTWVyZ2VSZXN1bHRdW10sIGZvcmNlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgeyBsb2NhbCwgcmVtb3RlLCBsb2NhbENoYW5nZSwgcmVtb3RlQ2hhbmdlIH0gPSByZXNvdXJjZVByZXZpZXdzWzBdWzFdO1xuXHRcdGlmIChsb2NhbENoYW5nZSA9PT0gQ2hhbmdlLk5vbmUgJiYgcmVtb3RlQ2hhbmdlID09PSBDaGFuZ2UuTm9uZSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IE5vIGNoYW5nZXMgZm91bmQgZHVyaW5nIHN5bmNocm9uaXppbmcgcHJvZmlsZXMuYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVtb3RlUHJvZmlsZXMgPSByZXNvdXJjZVByZXZpZXdzWzBdWzBdLnJlbW90ZVByb2ZpbGVzIHx8IFtdO1xuXHRcdGlmIChyZW1vdGVQcm9maWxlcy5sZW5ndGggKyAocmVtb3RlPy5hZGRlZC5sZW5ndGggPz8gMCkgLSAocmVtb3RlPy5yZW1vdmVkLmxlbmd0aCA/PyAwKSA+IDIwKSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jRXJyb3IoJ1RvbyBtYW55IHByb2ZpbGVzIHRvIHN5bmMuIFBsZWFzZSByZW1vdmUgc29tZSBwcm9maWxlcyBhbmQgdHJ5IGFnYWluLicsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Mb2NhbFRvb01hbnlQcm9maWxlcyk7XG5cdFx0fVxuXG5cdFx0aWYgKGxvY2FsQ2hhbmdlICE9PSBDaGFuZ2UuTm9uZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5iYWNrdXBMb2NhbChzdHJpbmdpZnlMb2NhbFByb2ZpbGVzKHRoaXMuZ2V0TG9jYWxVc2VyRGF0YVByb2ZpbGVzKCksIGZhbHNlKSk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChsb2NhbC5yZW1vdmVkLm1hcChhc3luYyBwcm9maWxlID0+IHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBSZW1vdmluZyAnJHtwcm9maWxlLm5hbWV9JyBwcm9maWxlLi4uYCk7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucmVtb3ZlUHJvZmlsZShwcm9maWxlKTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFJlbW92ZWQgcHJvZmlsZSAnJHtwcm9maWxlLm5hbWV9Jy5gKTtcblx0XHRcdH0pKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGxvY2FsLmFkZGVkLm1hcChhc3luYyBwcm9maWxlID0+IHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBDcmVhdGluZyAnJHtwcm9maWxlLm5hbWV9JyBwcm9maWxlLi4uYCk7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuY3JlYXRlUHJvZmlsZShwcm9maWxlLmlkLCBwcm9maWxlLm5hbWUsIHsgaWNvbjogcHJvZmlsZS5pY29uLCB1c2VEZWZhdWx0RmxhZ3M6IHByb2ZpbGUudXNlRGVmYXVsdEZsYWdzIH0pO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogQ3JlYXRlZCBwcm9maWxlICcke3Byb2ZpbGUubmFtZX0nLmApO1xuXHRcdFx0fSkpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwobG9jYWwudXBkYXRlZC5tYXAoYXN5bmMgcHJvZmlsZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxvY2FsUHJvZmlsZSA9IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHByb2ZpbGUuaWQpO1xuXHRcdFx0XHRpZiAobG9jYWxQcm9maWxlKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBVcGRhdGluZyAnJHtwcm9maWxlLm5hbWV9JyBwcm9maWxlLi4uYCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS51cGRhdGVQcm9maWxlKGxvY2FsUHJvZmlsZSwgeyBuYW1lOiBwcm9maWxlLm5hbWUsIGljb246IHByb2ZpbGUuaWNvbiwgdXNlRGVmYXVsdEZsYWdzOiBwcm9maWxlLnVzZURlZmF1bHRGbGFncyB9KTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogVXBkYXRlZCBwcm9maWxlICcke3Byb2ZpbGUubmFtZX0nLmApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBDb3VsZCBub3QgZmluZCBwcm9maWxlIHdpdGggaWQgJyR7cHJvZmlsZS5pZH0nIHRvIHVwZGF0ZS5gKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGlmIChyZW1vdGVDaGFuZ2UgIT09IENoYW5nZS5Ob25lKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVwZGF0aW5nIHJlbW90ZSBwcm9maWxlcy4uLmApO1xuXHRcdFx0Y29uc3QgYWRkZWRDb2xsZWN0aW9uczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGNvbnN0IGNhbkFkZFJlbW90ZVByb2ZpbGVzID0gcmVtb3RlUHJvZmlsZXMubGVuZ3RoICsgKHJlbW90ZT8uYWRkZWQubGVuZ3RoID8/IDApIDw9IDIwO1xuXHRcdFx0aWYgKGNhbkFkZFJlbW90ZVByb2ZpbGVzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiByZW1vdGU/LmFkZGVkIHx8IFtdKSB7XG5cdFx0XHRcdFx0Y29uc3QgY29sbGVjdGlvbiA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmNyZWF0ZUNvbGxlY3Rpb24odGhpcy5zeW5jSGVhZGVycyk7XG5cdFx0XHRcdFx0YWRkZWRDb2xsZWN0aW9ucy5wdXNoKGNvbGxlY3Rpb24pO1xuXHRcdFx0XHRcdHJlbW90ZVByb2ZpbGVzLnB1c2goeyBpZDogcHJvZmlsZS5pZCwgbmFtZTogcHJvZmlsZS5uYW1lLCBjb2xsZWN0aW9uLCBpY29uOiBwcm9maWxlLmljb24sIHVzZURlZmF1bHRGbGFnczogcHJvZmlsZS51c2VEZWZhdWx0RmxhZ3MgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBDb3VsZCBub3QgY3JlYXRlIHJlbW90ZSBwcm9maWxlcyBhcyB0aGVyZSBhcmUgdG9vIG1hbnkgcHJvZmlsZXMuYCk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgcmVtb3RlPy5yZW1vdmVkIHx8IFtdKSB7XG5cdFx0XHRcdHJlbW90ZVByb2ZpbGVzLnNwbGljZShyZW1vdGVQcm9maWxlcy5maW5kSW5kZXgoKHsgaWQgfSkgPT4gcHJvZmlsZS5pZCA9PT0gaWQpLCAxKTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiByZW1vdGU/LnVwZGF0ZWQgfHwgW10pIHtcblx0XHRcdFx0Y29uc3QgcHJvZmlsZVRvQmVVcGRhdGVkID0gcmVtb3RlUHJvZmlsZXMuZmluZCgoeyBpZCB9KSA9PiBwcm9maWxlLmlkID09PSBpZCk7XG5cdFx0XHRcdGlmIChwcm9maWxlVG9CZVVwZGF0ZWQpIHtcblx0XHRcdFx0XHRyZW1vdGVQcm9maWxlcy5zcGxpY2UocmVtb3RlUHJvZmlsZXMuaW5kZXhPZihwcm9maWxlVG9CZVVwZGF0ZWQpLCAxLCB7IC4uLnByb2ZpbGVUb0JlVXBkYXRlZCwgaWQ6IHByb2ZpbGUuaWQsIG5hbWU6IHByb2ZpbGUubmFtZSwgaWNvbjogcHJvZmlsZS5pY29uLCB1c2VEZWZhdWx0RmxhZ3M6IHByb2ZpbGUudXNlRGVmYXVsdEZsYWdzIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGhpcy51cGRhdGVSZW1vdGVQcm9maWxlcyhyZW1vdGVQcm9maWxlcywgZm9yY2UgPyBudWxsIDogcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVwZGF0ZWQgcmVtb3RlIHByb2ZpbGVzLiR7Y2FuQWRkUmVtb3RlUHJvZmlsZXMgJiYgcmVtb3RlPy5hZGRlZC5sZW5ndGggPyBgIEFkZGVkOiAke0pTT04uc3RyaW5naWZ5KHJlbW90ZS5hZGRlZC5tYXAoZSA9PiBlLm5hbWUpKX0uYCA6ICcnfSR7cmVtb3RlPy51cGRhdGVkLmxlbmd0aCA/IGAgVXBkYXRlZDogJHtKU09OLnN0cmluZ2lmeShyZW1vdGUudXBkYXRlZC5tYXAoZSA9PiBlLm5hbWUpKX0uYCA6ICcnfSR7cmVtb3RlPy5yZW1vdmVkLmxlbmd0aCA/IGAgUmVtb3ZlZDogJHtKU09OLnN0cmluZ2lmeShyZW1vdGUucmVtb3ZlZC5tYXAoZSA9PiBlLm5hbWUpKX0uYCA6ICcnfWApO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKGFkZGVkQ29sbGVjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IEZhaWxlZCB0byB1cGRhdGUgcmVtb3RlIHByb2ZpbGVzLiBDbGVhbmluZyB1cCBhZGRlZCBjb2xsZWN0aW9ucy4uLmApO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgY29sbGVjdGlvbiBvZiBhZGRlZENvbGxlY3Rpb25zKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS5kZWxldGVDb2xsZWN0aW9uKGNvbGxlY3Rpb24sIHRoaXMuc3luY0hlYWRlcnMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHJlbW90ZT8ucmVtb3ZlZCB8fCBbXSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlU2VydmljZS5kZWxldGVDb2xsZWN0aW9uKHByb2ZpbGUuY29sbGVjdGlvbiwgdGhpcy5zeW5jSGVhZGVycyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGxhc3RTeW5jVXNlckRhdGE/LnJlZiAhPT0gcmVtb3RlVXNlckRhdGEucmVmKSB7XG5cdFx0XHQvLyB1cGRhdGUgbGFzdCBzeW5jXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVwZGF0aW5nIGxhc3Qgc3luY2hyb25pemVkIHByb2ZpbGVzLi4uYCk7XG5cdFx0XHRhd2FpdCB0aGlzLnVwZGF0ZUxhc3RTeW5jVXNlckRhdGEocmVtb3RlVXNlckRhdGEpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVwZGF0ZWQgbGFzdCBzeW5jaHJvbml6ZWQgcHJvZmlsZXMuYCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdXBkYXRlUmVtb3RlUHJvZmlsZXMocHJvZmlsZXM6IElTeW5jVXNlckRhdGFQcm9maWxlW10sIHJlZjogc3RyaW5nIHwgbnVsbCk6IFByb21pc2U8SVJlbW90ZVVzZXJEYXRhPiB7XG5cdFx0cmV0dXJuIHRoaXMudXBkYXRlUmVtb3RlVXNlckRhdGEodGhpcy5zdHJpbmdpZnlSZW1vdGVQcm9maWxlcyhwcm9maWxlcyksIHJlZik7XG5cdH1cblxuXHRhc3luYyBoYXNMb2NhbERhdGEoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0TG9jYWxVc2VyRGF0YVByb2ZpbGVzKCkubGVuZ3RoID4gMDtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVDb250ZW50KHVyaTogVVJJKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwodGhpcy5yZW1vdGVSZXNvdXJjZSwgdXJpKVxuXHRcdFx0fHwgdGhpcy5leHRVcmkuaXNFcXVhbCh0aGlzLmJhc2VSZXNvdXJjZSwgdXJpKVxuXHRcdFx0fHwgdGhpcy5leHRVcmkuaXNFcXVhbCh0aGlzLmxvY2FsUmVzb3VyY2UsIHVyaSlcblx0XHRcdHx8IHRoaXMuZXh0VXJpLmlzRXF1YWwodGhpcy5hY2NlcHRlZFJlc291cmNlLCB1cmkpXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJldmlld0NvbnRlbnQodXJpKTtcblx0XHRcdHJldHVybiBjb250ZW50ID8gdG9Gb3JtYXR0ZWRTdHJpbmcoSlNPTi5wYXJzZShjb250ZW50KSwge30pIDogY29udGVudDtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGdldExvY2FsVXNlckRhdGFQcm9maWxlcygpOiBJVXNlckRhdGFQcm9maWxlW10ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmZpbHRlcihwID0+ICFwLmlzRGVmYXVsdCAmJiAhcC5pc1RyYW5zaWVudCk7XG5cdH1cblxuXHRwcml2YXRlIHN0cmluZ2lmeVJlbW90ZVByb2ZpbGVzKHByb2ZpbGVzOiBJU3luY1VzZXJEYXRhUHJvZmlsZVtdKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoWy4uLnByb2ZpbGVzXS5zb3J0KChhLCBiKSA9PiBhLm5hbWUubG9jYWxlQ29tcGFyZShiLm5hbWUpKSk7XG5cdH1cblxufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5naWZ5TG9jYWxQcm9maWxlcyhwcm9maWxlczogSVVzZXJEYXRhUHJvZmlsZVtdLCBmb3JtYXQ6IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRjb25zdCByZXN1bHQgPSBbLi4ucHJvZmlsZXNdLnNvcnQoKGEsIGIpID0+IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpLm1hcChwID0+ICh7IGlkOiBwLmlkLCBuYW1lOiBwLm5hbWUgfSkpO1xuXHRyZXR1cm4gZm9ybWF0ID8gdG9Gb3JtYXR0ZWRTdHJpbmcocmVzdWx0LCB7fSkgOiBKU09OLnN0cmluZ2lmeShyZXN1bHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3Qoc3luY0RhdGE6IElTeW5jRGF0YSk6IElTeW5jVXNlckRhdGFQcm9maWxlW10ge1xu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
