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
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { IStorageService } from "../../storage/common/storage.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncStoreService, SyncResource, UserDataSyncError, UserDataSyncErrorCode, USER_DATA_SYNC_SCHEME, CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM } from "./userDataSync.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { isSyncData } from "./abstractSynchronizer.js";
import { parseSnippets } from "./snippetsSync.js";
import { parseSettingsSyncContent } from "./settingsSync.js";
import { getKeybindingsContentFromSyncContent } from "./keybindingsSync.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { getTasksContentFromSyncContent } from "./tasksSync.js";
import { LocalExtensionsProvider, parseExtensions, stringify as stringifyExtensions } from "./extensionsSync.js";
import { LocalGlobalStateProvider, stringify as stringifyGlobalState } from "./globalStateSync.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { parseUserDataProfilesManifest, stringifyLocalProfiles } from "./userDataProfilesManifestSync.js";
import { toFormattedString } from "../../../base/common/jsonFormatter.js";
import { trim } from "../../../base/common/strings.js";
import { parsePrompts } from "./promptsSync/promptsSync.js";
let UserDataSyncResourceProviderService = class {
  constructor(userDataSyncStoreService, userDataSyncLocalStoreService, logService, uriIdentityService, environmentService, storageService, fileService, userDataProfilesService, configurationService, instantiationService) {
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncLocalStoreService = userDataSyncLocalStoreService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.fileService = fileService;
    this.userDataProfilesService = userDataProfilesService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.extUri = uriIdentityService.extUri;
  }
  async getRemoteSyncedProfiles() {
    const userData = await this.userDataSyncStoreService.readResource(SyncResource.Profiles, null, void 0);
    if (userData.content) {
      const syncData = this.parseSyncData(userData.content, SyncResource.Profiles);
      return parseUserDataProfilesManifest(syncData);
    }
    return [];
  }
  async getLocalSyncedProfiles(location) {
    const refs = await this.userDataSyncLocalStoreService.getAllResourceRefs(SyncResource.Profiles, void 0, location);
    if (refs.length) {
      const content = await this.userDataSyncLocalStoreService.resolveResourceContent(SyncResource.Profiles, refs[0].ref, void 0, location);
      if (content) {
        const syncData = this.parseSyncData(content, SyncResource.Profiles);
        return parseUserDataProfilesManifest(syncData);
      }
    }
    return [];
  }
  async getLocalSyncedMachines(location) {
    const refs = await this.userDataSyncLocalStoreService.getAllResourceRefs("machines", void 0, location);
    if (refs.length) {
      const content = await this.userDataSyncLocalStoreService.resolveResourceContent("machines", refs[0].ref, void 0, location);
      if (content) {
        const machinesData = JSON.parse(content);
        return machinesData.machines.map((m) => ({ ...m, isCurrent: false }));
      }
    }
    return [];
  }
  async getRemoteSyncResourceHandles(syncResource, profile) {
    const handles = await this.userDataSyncStoreService.getAllResourceRefs(syncResource, profile?.collection);
    return handles.map(({ created, ref }) => ({
      created,
      uri: this.toUri({
        remote: true,
        syncResource,
        profile: profile?.id ?? this.userDataProfilesService.defaultProfile.id,
        location: void 0,
        collection: profile?.collection,
        ref,
        node: void 0
      })
    }));
  }
  async getLocalSyncResourceHandles(syncResource, profile, location) {
    const handles = await this.userDataSyncLocalStoreService.getAllResourceRefs(syncResource, profile?.collection, location);
    return handles.map(({ created, ref }) => ({
      created,
      uri: this.toUri({
        remote: false,
        syncResource,
        profile: profile?.id ?? this.userDataProfilesService.defaultProfile.id,
        collection: profile?.collection,
        ref,
        node: void 0,
        location
      })
    }));
  }
  resolveUserDataSyncResource({ uri }) {
    const resolved = this.resolveUri(uri);
    const profile = resolved ? this.userDataProfilesService.profiles.find((p) => p.id === resolved.profile) : void 0;
    return resolved && profile ? { profile, syncResource: resolved?.syncResource } : void 0;
  }
  async getAssociatedResources({ uri }) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return [];
    }
    const profile = this.userDataProfilesService.profiles.find((p) => p.id === resolved.profile);
    switch (resolved.syncResource) {
      case SyncResource.Settings:
        return this.getSettingsAssociatedResources(uri, profile);
      case SyncResource.Keybindings:
        return this.getKeybindingsAssociatedResources(uri, profile);
      case SyncResource.Tasks:
        return this.getTasksAssociatedResources(uri, profile);
      case SyncResource.Snippets:
        return this.getSnippetsAssociatedResources(uri, profile);
      case SyncResource.Prompts:
        return this.getPromptsAssociatedResources(uri, profile);
      case SyncResource.GlobalState:
        return this.getGlobalStateAssociatedResources(uri, profile);
      case SyncResource.Extensions:
        return this.getExtensionsAssociatedResources(uri, profile);
      case SyncResource.Profiles:
        return this.getProfilesAssociatedResources(uri, profile);
      case SyncResource.WorkspaceState:
        return [];
    }
  }
  async getMachineId({ uri }) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return void 0;
    }
    if (resolved.remote) {
      if (resolved.ref) {
        const { content } = await this.getUserData(resolved.syncResource, resolved.ref, resolved.collection);
        if (content) {
          const syncData = this.parseSyncData(content, resolved.syncResource);
          return syncData?.machineId;
        }
      }
      return void 0;
    }
    if (resolved.location) {
      if (resolved.ref) {
        const content = await this.userDataSyncLocalStoreService.resolveResourceContent(resolved.syncResource, resolved.ref, resolved.collection, resolved.location);
        if (content) {
          const syncData = this.parseSyncData(content, resolved.syncResource);
          return syncData?.machineId;
        }
      }
      return void 0;
    }
    return getServiceMachineId(this.environmentService, this.fileService, this.storageService);
  }
  async resolveContent(uri) {
    const resolved = this.resolveUri(uri);
    if (!resolved) {
      return null;
    }
    if (resolved.node === UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE) {
      return null;
    }
    if (resolved.ref) {
      const content = await this.getContentFromStore(resolved.remote, resolved.syncResource, resolved.collection, resolved.ref, resolved.location);
      if (resolved.node && content) {
        return this.resolveNodeContent(resolved.syncResource, content, resolved.node);
      }
      return content;
    }
    if (!resolved.remote && !resolved.node) {
      return this.resolveLatestContent(resolved.syncResource, resolved.profile);
    }
    return null;
  }
  async getContentFromStore(remote, syncResource, collection, ref, location) {
    if (remote) {
      const { content } = await this.getUserData(syncResource, ref, collection);
      return content;
    }
    return this.userDataSyncLocalStoreService.resolveResourceContent(syncResource, ref, collection, location);
  }
  resolveNodeContent(syncResource, content, node) {
    const syncData = this.parseSyncData(content, syncResource);
    switch (syncResource) {
      case SyncResource.Settings:
        return this.resolveSettingsNodeContent(syncData, node);
      case SyncResource.Keybindings:
        return this.resolveKeybindingsNodeContent(syncData, node);
      case SyncResource.Tasks:
        return this.resolveTasksNodeContent(syncData, node);
      case SyncResource.Snippets:
        return this.resolveSnippetsNodeContent(syncData, node);
      case SyncResource.Prompts:
        return this.resolvePromptsNodeContent(syncData, node);
      case SyncResource.GlobalState:
        return this.resolveGlobalStateNodeContent(syncData, node);
      case SyncResource.Extensions:
        return this.resolveExtensionsNodeContent(syncData, node);
      case SyncResource.Profiles:
        return this.resolveProfileNodeContent(syncData, node);
      case SyncResource.WorkspaceState:
        return null;
    }
  }
  async resolveLatestContent(syncResource, profileId) {
    const profile = this.userDataProfilesService.profiles.find((p) => p.id === profileId);
    if (!profile) {
      return null;
    }
    switch (syncResource) {
      case SyncResource.GlobalState:
        return this.resolveLatestGlobalStateContent(profile);
      case SyncResource.Extensions:
        return this.resolveLatestExtensionsContent(profile);
      case SyncResource.Profiles:
        return this.resolveLatestProfilesContent(profile);
      case SyncResource.Settings:
        return null;
      case SyncResource.Keybindings:
        return null;
      case SyncResource.Tasks:
        return null;
      case SyncResource.Snippets:
        return null;
      case SyncResource.Prompts:
        return null;
      case SyncResource.WorkspaceState:
        return null;
    }
  }
  getSettingsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "settings.json");
    const comparableResource = profile ? profile.settingsResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveSettingsNodeContent(syncData, node) {
    switch (node) {
      case "settings.json":
        return parseSettingsSyncContent(syncData.content).settings;
    }
    return null;
  }
  getKeybindingsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "keybindings.json");
    const comparableResource = profile ? profile.keybindingsResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveKeybindingsNodeContent(syncData, node) {
    switch (node) {
      case "keybindings.json":
        return getKeybindingsContentFromSyncContent(syncData.content, !!this.configurationService.getValue(CONFIG_SYNC_KEYBINDINGS_PER_PLATFORM), this.logService);
    }
    return null;
  }
  getTasksAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "tasks.json");
    const comparableResource = profile ? profile.tasksResource : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveTasksNodeContent(syncData, node) {
    switch (node) {
      case "tasks.json":
        return getTasksContentFromSyncContent(syncData.content, this.logService);
    }
    return null;
  }
  async getSnippetsAssociatedResources(uri, profile) {
    const content = await this.resolveContent(uri);
    if (content) {
      const syncData = this.parseSyncData(content, SyncResource.Snippets);
      if (syncData) {
        const snippets = parseSnippets(syncData);
        const result = [];
        for (const snippet of Object.keys(snippets)) {
          const resource = this.extUri.joinPath(uri, snippet);
          const comparableResource = profile ? this.extUri.joinPath(profile.snippetsHome, snippet) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
          result.push({ resource, comparableResource });
        }
        return result;
      }
    }
    return [];
  }
  resolveSnippetsNodeContent(syncData, node) {
    return parseSnippets(syncData)[node] || null;
  }
  async getPromptsAssociatedResources(uri, profile) {
    const content = await this.resolveContent(uri);
    if (content) {
      const syncData = this.parseSyncData(content, SyncResource.Prompts);
      if (syncData) {
        const prompts = parsePrompts(syncData);
        const result = [];
        for (const prompt of Object.keys(prompts)) {
          const resource = this.extUri.joinPath(uri, prompt);
          const comparableResource = profile ? this.extUri.joinPath(profile.promptsHome, prompt) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
          result.push({ resource, comparableResource });
        }
        return result;
      }
    }
    return [];
  }
  resolvePromptsNodeContent(syncData, node) {
    return parsePrompts(syncData)[node] || null;
  }
  getExtensionsAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "extensions.json");
    const comparableResource = profile ? this.toUri({
      remote: false,
      syncResource: SyncResource.Extensions,
      profile: profile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    }) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveExtensionsNodeContent(syncData, node) {
    switch (node) {
      case "extensions.json":
        return stringifyExtensions(parseExtensions(syncData), true);
    }
    return null;
  }
  async resolveLatestExtensionsContent(profile) {
    const { localExtensions } = await this.instantiationService.createInstance(LocalExtensionsProvider).getLocalExtensions(profile);
    return stringifyExtensions(localExtensions, true);
  }
  getGlobalStateAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "globalState.json");
    const comparableResource = profile ? this.toUri({
      remote: false,
      syncResource: SyncResource.GlobalState,
      profile: profile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    }) : this.extUri.joinPath(uri, UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE);
    return [{ resource, comparableResource }];
  }
  resolveGlobalStateNodeContent(syncData, node) {
    switch (node) {
      case "globalState.json":
        return stringifyGlobalState(JSON.parse(syncData.content), true);
    }
    return null;
  }
  async resolveLatestGlobalStateContent(profile) {
    const localGlobalState = await this.instantiationService.createInstance(LocalGlobalStateProvider).getLocalGlobalState(profile);
    return stringifyGlobalState(localGlobalState, true);
  }
  getProfilesAssociatedResources(uri, profile) {
    const resource = this.extUri.joinPath(uri, "profiles.json");
    const comparableResource = this.toUri({
      remote: false,
      syncResource: SyncResource.Profiles,
      profile: this.userDataProfilesService.defaultProfile.id,
      location: void 0,
      collection: void 0,
      ref: void 0,
      node: void 0
    });
    return [{ resource, comparableResource }];
  }
  resolveProfileNodeContent(syncData, node) {
    switch (node) {
      case "profiles.json":
        return toFormattedString(JSON.parse(syncData.content), {});
    }
    return null;
  }
  async resolveLatestProfilesContent(profile) {
    return stringifyLocalProfiles(this.userDataProfilesService.profiles.filter((p) => !p.isDefault && !p.isTransient), true);
  }
  toUri(syncResourceUriInfo) {
    const authority = syncResourceUriInfo.remote ? UserDataSyncResourceProviderService.REMOTE_BACKUP_AUTHORITY : UserDataSyncResourceProviderService.LOCAL_BACKUP_AUTHORITY;
    const paths = [];
    if (syncResourceUriInfo.location) {
      paths.push(`scheme:${syncResourceUriInfo.location.scheme}`);
      paths.push(`authority:${syncResourceUriInfo.location.authority}`);
      paths.push(trim(syncResourceUriInfo.location.path, "/"));
    }
    paths.push(`syncResource:${syncResourceUriInfo.syncResource}`);
    paths.push(`profile:${syncResourceUriInfo.profile}`);
    if (syncResourceUriInfo.collection) {
      paths.push(`collection:${syncResourceUriInfo.collection}`);
    }
    if (syncResourceUriInfo.ref) {
      paths.push(`ref:${syncResourceUriInfo.ref}`);
    }
    if (syncResourceUriInfo.node) {
      paths.push(syncResourceUriInfo.node);
    }
    return this.extUri.joinPath(URI.from({ scheme: USER_DATA_SYNC_SCHEME, authority, path: `/`, query: syncResourceUriInfo.location?.query, fragment: syncResourceUriInfo.location?.fragment }), ...paths);
  }
  resolveUri(uri) {
    if (uri.scheme !== USER_DATA_SYNC_SCHEME) {
      return void 0;
    }
    const paths = [];
    while (uri.path !== "/") {
      paths.unshift(this.extUri.basename(uri));
      uri = this.extUri.dirname(uri);
    }
    if (paths.length < 2) {
      return void 0;
    }
    const remote = uri.authority === UserDataSyncResourceProviderService.REMOTE_BACKUP_AUTHORITY;
    let scheme;
    let authority;
    const locationPaths = [];
    let syncResource;
    let profile;
    let collection;
    let ref;
    let node;
    while (paths.length) {
      const path = paths.shift();
      if (path.startsWith("scheme:")) {
        scheme = path.substring("scheme:".length);
      } else if (path.startsWith("authority:")) {
        authority = path.substring("authority:".length);
      } else if (path.startsWith("syncResource:")) {
        syncResource = path.substring("syncResource:".length);
      } else if (path.startsWith("profile:")) {
        profile = path.substring("profile:".length);
      } else if (path.startsWith("collection:")) {
        collection = path.substring("collection:".length);
      } else if (path.startsWith("ref:")) {
        ref = path.substring("ref:".length);
      } else if (!syncResource) {
        locationPaths.push(path);
      } else {
        node = path;
      }
    }
    return {
      remote,
      syncResource,
      profile,
      collection,
      ref,
      node,
      location: scheme && authority !== void 0 ? this.extUri.joinPath(URI.from({ scheme, authority, query: uri.query, fragment: uri.fragment, path: "/" }), ...locationPaths) : void 0
    };
  }
  parseSyncData(content, syncResource) {
    try {
      const syncData = JSON.parse(content);
      if (isSyncData(syncData)) {
        return syncData;
      }
    } catch (error) {
      this.logService.error(error);
    }
    throw new UserDataSyncError(localize("incompatible sync data", "Cannot parse sync data as it is not compatible with the current version."), UserDataSyncErrorCode.IncompatibleRemoteContent, syncResource);
  }
  async getUserData(syncResource, ref, collection) {
    const content = await this.userDataSyncStoreService.resolveResourceContent(syncResource, ref, collection);
    return { ref, content };
  }
};
UserDataSyncResourceProviderService.NOT_EXISTING_RESOURCE = "not-existing-resource";
UserDataSyncResourceProviderService.REMOTE_BACKUP_AUTHORITY = "remote-backup";
UserDataSyncResourceProviderService.LOCAL_BACKUP_AUTHORITY = "local-backup";
UserDataSyncResourceProviderService = __decorateClass([
  __decorateParam(0, IUserDataSyncStoreService),
  __decorateParam(1, IUserDataSyncLocalStoreService),
  __decorateParam(2, IUserDataSyncLogService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IUserDataProfilesService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IInstantiationService)
], UserDataSyncResourceProviderService);
export {
  UserDataSyncResourceProviderService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBnZXRTZXJ2aWNlTWFjaGluZUlkIH0gZnJvbSAnLi4vLi4vZXh0ZXJuYWxTZXJ2aWNlcy9jb21tb24vc2VydmljZU1hY2hpbmVJZC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVN5bmNEYXRhLCBJU3luY1Jlc291cmNlSGFuZGxlLCBJVXNlckRhdGEsIElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIFN5bmNSZXNvdXJjZSwgVXNlckRhdGFTeW5jRXJyb3IsIFVzZXJEYXRhU3luY0Vycm9yQ29kZSwgVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UsIElTeW5jVXNlckRhdGFQcm9maWxlLCBDT05GSUdfU1lOQ19LRVlCSU5ESU5HU19QRVJfUExBVEZPUk0sIElVc2VyRGF0YVN5bmNSZXNvdXJjZSB9IGZyb20gJy4vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IGlzU3luY0RhdGEgfSBmcm9tICcuL2Fic3RyYWN0U3luY2hyb25pemVyLmpzJztcbmltcG9ydCB7IHBhcnNlU25pcHBldHMgfSBmcm9tICcuL3NuaXBwZXRzU3luYy5qcyc7XG5pbXBvcnQgeyBwYXJzZVNldHRpbmdzU3luY0NvbnRlbnQgfSBmcm9tICcuL3NldHRpbmdzU3luYy5qcyc7XG5pbXBvcnQgeyBnZXRLZXliaW5kaW5nc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQgfSBmcm9tICcuL2tleWJpbmRpbmdzU3luYy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudCB9IGZyb20gJy4vdGFza3NTeW5jLmpzJztcbmltcG9ydCB7IExvY2FsRXh0ZW5zaW9uc1Byb3ZpZGVyLCBwYXJzZUV4dGVuc2lvbnMsIHN0cmluZ2lmeSBhcyBzdHJpbmdpZnlFeHRlbnNpb25zIH0gZnJvbSAnLi9leHRlbnNpb25zU3luYy5qcyc7XG5pbXBvcnQgeyBMb2NhbEdsb2JhbFN0YXRlUHJvdmlkZXIsIHN0cmluZ2lmeSBhcyBzdHJpbmdpZnlHbG9iYWxTdGF0ZSB9IGZyb20gJy4vZ2xvYmFsU3RhdGVTeW5jLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgcGFyc2VVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3QsIHN0cmluZ2lmeUxvY2FsUHJvZmlsZXMgfSBmcm9tICcuL3VzZXJEYXRhUHJvZmlsZXNNYW5pZmVzdFN5bmMuanMnO1xuaW1wb3J0IHsgdG9Gb3JtYXR0ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRm9ybWF0dGVyLmpzJztcbmltcG9ydCB7IHRyaW0gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElNYWNoaW5lc0RhdGEsIElVc2VyRGF0YVN5bmNNYWNoaW5lIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNNYWNoaW5lcy5qcyc7XG5pbXBvcnQgeyBwYXJzZVByb21wdHMgfSBmcm9tICcuL3Byb21wdHNTeW5jL3Byb21wdHNTeW5jLmpzJztcblxuaW50ZXJmYWNlIElTeW5jUmVzb3VyY2VVcmlJbmZvIHtcblx0cmVhZG9ubHkgcmVtb3RlOiBib29sZWFuO1xuXHRyZWFkb25seSBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZTtcblx0cmVhZG9ubHkgcHJvZmlsZTogc3RyaW5nO1xuXHRyZWFkb25seSBjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBub2RlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGxvY2F0aW9uOiBVUkkgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZSBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogYW55O1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE5PVF9FWElTVElOR19SRVNPVVJDRSA9ICdub3QtZXhpc3RpbmctcmVzb3VyY2UnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRU1PVEVfQkFDS1VQX0FVVEhPUklUWSA9ICdyZW1vdGUtYmFja3VwJztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTE9DQUxfQkFDS1VQX0FVVEhPUklUWSA9ICdsb2NhbC1iYWNrdXAnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0VXJpOiBJRXh0VXJpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZTogSVVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmV4dFVyaSA9IHVyaUlkZW50aXR5U2VydmljZS5leHRVcmk7XG5cdH1cblxuXHRhc3luYyBnZXRSZW1vdGVTeW5jZWRQcm9maWxlcygpOiBQcm9taXNlPElTeW5jVXNlckRhdGFQcm9maWxlW10+IHtcblx0XHRjb25zdCB1c2VyRGF0YSA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLnJlYWRSZXNvdXJjZShTeW5jUmVzb3VyY2UuUHJvZmlsZXMsIG51bGwsIHVuZGVmaW5lZCk7XG5cdFx0aWYgKHVzZXJEYXRhLmNvbnRlbnQpIHtcblx0XHRcdGNvbnN0IHN5bmNEYXRhID0gdGhpcy5wYXJzZVN5bmNEYXRhKHVzZXJEYXRhLmNvbnRlbnQsIFN5bmNSZXNvdXJjZS5Qcm9maWxlcyk7XG5cdFx0XHRyZXR1cm4gcGFyc2VVc2VyRGF0YVByb2ZpbGVzTWFuaWZlc3Qoc3luY0RhdGEpO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRhc3luYyBnZXRMb2NhbFN5bmNlZFByb2ZpbGVzKGxvY2F0aW9uPzogVVJJKTogUHJvbWlzZTxJU3luY1VzZXJEYXRhUHJvZmlsZVtdPiB7XG5cdFx0Y29uc3QgcmVmcyA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UuZ2V0QWxsUmVzb3VyY2VSZWZzKFN5bmNSZXNvdXJjZS5Qcm9maWxlcywgdW5kZWZpbmVkLCBsb2NhdGlvbik7XG5cdFx0aWYgKHJlZnMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZS5yZXNvbHZlUmVzb3VyY2VDb250ZW50KFN5bmNSZXNvdXJjZS5Qcm9maWxlcywgcmVmc1swXS5yZWYsIHVuZGVmaW5lZCwgbG9jYXRpb24pO1xuXHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0Y29uc3Qgc3luY0RhdGEgPSB0aGlzLnBhcnNlU3luY0RhdGEoY29udGVudCwgU3luY1Jlc291cmNlLlByb2ZpbGVzKTtcblx0XHRcdFx0cmV0dXJuIHBhcnNlVXNlckRhdGFQcm9maWxlc01hbmlmZXN0KHN5bmNEYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0YXN5bmMgZ2V0TG9jYWxTeW5jZWRNYWNoaW5lcyhsb2NhdGlvbj86IFVSSSk6IFByb21pc2U8SVVzZXJEYXRhU3luY01hY2hpbmVbXT4ge1xuXHRcdGNvbnN0IHJlZnMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLmdldEFsbFJlc291cmNlUmVmcygnbWFjaGluZXMnLCB1bmRlZmluZWQsIGxvY2F0aW9uKTtcblx0XHRpZiAocmVmcy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLnJlc29sdmVSZXNvdXJjZUNvbnRlbnQoJ21hY2hpbmVzJywgcmVmc1swXS5yZWYsIHVuZGVmaW5lZCwgbG9jYXRpb24pO1xuXHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0Y29uc3QgbWFjaGluZXNEYXRhOiBJTWFjaGluZXNEYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcblx0XHRcdFx0cmV0dXJuIG1hY2hpbmVzRGF0YS5tYWNoaW5lcy5tYXAobSA9PiAoeyAuLi5tLCBpc0N1cnJlbnQ6IGZhbHNlIH0pKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0YXN5bmMgZ2V0UmVtb3RlU3luY1Jlc291cmNlSGFuZGxlcyhzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSwgcHJvZmlsZT86IElTeW5jVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTxJU3luY1Jlc291cmNlSGFuZGxlW10+IHtcblx0XHRjb25zdCBoYW5kbGVzID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UuZ2V0QWxsUmVzb3VyY2VSZWZzKHN5bmNSZXNvdXJjZSwgcHJvZmlsZT8uY29sbGVjdGlvbik7XG5cdFx0cmV0dXJuIGhhbmRsZXMubWFwKCh7IGNyZWF0ZWQsIHJlZiB9KSA9PiAoe1xuXHRcdFx0Y3JlYXRlZCxcblx0XHRcdHVyaTogdGhpcy50b1VyaSh7XG5cdFx0XHRcdHJlbW90ZTogdHJ1ZSxcblx0XHRcdFx0c3luY1Jlc291cmNlLFxuXHRcdFx0XHRwcm9maWxlOiBwcm9maWxlPy5pZCA/PyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmlkLFxuXHRcdFx0XHRsb2NhdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRjb2xsZWN0aW9uOiBwcm9maWxlPy5jb2xsZWN0aW9uLFxuXHRcdFx0XHRyZWYsXG5cdFx0XHRcdG5vZGU6IHVuZGVmaW5lZCxcblx0XHRcdH0pXG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0TG9jYWxTeW5jUmVzb3VyY2VIYW5kbGVzKHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLCBwcm9maWxlPzogSVN5bmNVc2VyRGF0YVByb2ZpbGUsIGxvY2F0aW9uPzogVVJJKTogUHJvbWlzZTxJU3luY1Jlc291cmNlSGFuZGxlW10+IHtcblx0XHRjb25zdCBoYW5kbGVzID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZS5nZXRBbGxSZXNvdXJjZVJlZnMoc3luY1Jlc291cmNlLCBwcm9maWxlPy5jb2xsZWN0aW9uLCBsb2NhdGlvbik7XG5cdFx0cmV0dXJuIGhhbmRsZXMubWFwKCh7IGNyZWF0ZWQsIHJlZiB9KSA9PiAoe1xuXHRcdFx0Y3JlYXRlZCxcblx0XHRcdHVyaTogdGhpcy50b1VyaSh7XG5cdFx0XHRcdHJlbW90ZTogZmFsc2UsXG5cdFx0XHRcdHN5bmNSZXNvdXJjZSxcblx0XHRcdFx0cHJvZmlsZTogcHJvZmlsZT8uaWQgPz8gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5pZCxcblx0XHRcdFx0Y29sbGVjdGlvbjogcHJvZmlsZT8uY29sbGVjdGlvbixcblx0XHRcdFx0cmVmLFxuXHRcdFx0XHRub2RlOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxvY2F0aW9uLFxuXHRcdFx0fSlcblx0XHR9KSk7XG5cdH1cblxuXHRyZXNvbHZlVXNlckRhdGFTeW5jUmVzb3VyY2UoeyB1cmkgfTogSVN5bmNSZXNvdXJjZUhhbmRsZSk6IElVc2VyRGF0YVN5bmNSZXNvdXJjZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSB0aGlzLnJlc29sdmVVcmkodXJpKTtcblx0XHRjb25zdCBwcm9maWxlID0gcmVzb2x2ZWQgPyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSByZXNvbHZlZC5wcm9maWxlKSA6IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gcmVzb2x2ZWQgJiYgcHJvZmlsZSA/IHsgcHJvZmlsZSwgc3luY1Jlc291cmNlOiByZXNvbHZlZD8uc3luY1Jlc291cmNlIH0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBnZXRBc3NvY2lhdGVkUmVzb3VyY2VzKHsgdXJpIH06IElTeW5jUmVzb3VyY2VIYW5kbGUpOiBQcm9taXNlPHsgcmVzb3VyY2U6IFVSSTsgY29tcGFyYWJsZVJlc291cmNlOiBVUkkgfVtdPiB7XG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSB0aGlzLnJlc29sdmVVcmkodXJpKTtcblx0XHRpZiAoIXJlc29sdmVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJvZmlsZSA9IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHJlc29sdmVkLnByb2ZpbGUpO1xuXHRcdHN3aXRjaCAocmVzb2x2ZWQuc3luY1Jlc291cmNlKSB7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TZXR0aW5nczogcmV0dXJuIHRoaXMuZ2V0U2V0dGluZ3NBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaSwgcHJvZmlsZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5LZXliaW5kaW5nczogcmV0dXJuIHRoaXMuZ2V0S2V5YmluZGluZ3NBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaSwgcHJvZmlsZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5UYXNrczogcmV0dXJuIHRoaXMuZ2V0VGFza3NBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaSwgcHJvZmlsZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TbmlwcGV0czogcmV0dXJuIHRoaXMuZ2V0U25pcHBldHNBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaSwgcHJvZmlsZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5Qcm9tcHRzOiByZXR1cm4gdGhpcy5nZXRQcm9tcHRzQXNzb2NpYXRlZFJlc291cmNlcyh1cmksIHByb2ZpbGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGU6IHJldHVybiB0aGlzLmdldEdsb2JhbFN0YXRlQXNzb2NpYXRlZFJlc291cmNlcyh1cmksIHByb2ZpbGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuRXh0ZW5zaW9uczogcmV0dXJuIHRoaXMuZ2V0RXh0ZW5zaW9uc0Fzc29jaWF0ZWRSZXNvdXJjZXModXJpLCBwcm9maWxlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlByb2ZpbGVzOiByZXR1cm4gdGhpcy5nZXRQcm9maWxlc0Fzc29jaWF0ZWRSZXNvdXJjZXModXJpLCBwcm9maWxlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLldvcmtzcGFjZVN0YXRlOiByZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0TWFjaGluZUlkKHsgdXJpIH06IElTeW5jUmVzb3VyY2VIYW5kbGUpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHJlc29sdmVkID0gdGhpcy5yZXNvbHZlVXJpKHVyaSk7XG5cdFx0aWYgKCFyZXNvbHZlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHJlc29sdmVkLnJlbW90ZSkge1xuXHRcdFx0aWYgKHJlc29sdmVkLnJlZikge1xuXHRcdFx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRoaXMuZ2V0VXNlckRhdGEocmVzb2x2ZWQuc3luY1Jlc291cmNlLCByZXNvbHZlZC5yZWYsIHJlc29sdmVkLmNvbGxlY3Rpb24pO1xuXHRcdFx0XHRpZiAoY29udGVudCkge1xuXHRcdFx0XHRcdGNvbnN0IHN5bmNEYXRhID0gdGhpcy5wYXJzZVN5bmNEYXRhKGNvbnRlbnQsIHJlc29sdmVkLnN5bmNSZXNvdXJjZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHN5bmNEYXRhPy5tYWNoaW5lSWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc29sdmVkLmxvY2F0aW9uKSB7XG5cdFx0XHRpZiAocmVzb2x2ZWQucmVmKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLnJlc29sdmVSZXNvdXJjZUNvbnRlbnQocmVzb2x2ZWQuc3luY1Jlc291cmNlLCByZXNvbHZlZC5yZWYsIHJlc29sdmVkLmNvbGxlY3Rpb24sIHJlc29sdmVkLmxvY2F0aW9uKTtcblx0XHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0XHRjb25zdCBzeW5jRGF0YSA9IHRoaXMucGFyc2VTeW5jRGF0YShjb250ZW50LCByZXNvbHZlZC5zeW5jUmVzb3VyY2UpO1xuXHRcdFx0XHRcdHJldHVybiBzeW5jRGF0YT8ubWFjaGluZUlkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBnZXRTZXJ2aWNlTWFjaGluZUlkKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVDb250ZW50KHVyaTogVVJJKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSB0aGlzLnJlc29sdmVVcmkodXJpKTtcblx0XHRpZiAoIXJlc29sdmVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAocmVzb2x2ZWQubm9kZSA9PT0gVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuTk9UX0VYSVNUSU5HX1JFU09VUkNFKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAocmVzb2x2ZWQucmVmKSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5nZXRDb250ZW50RnJvbVN0b3JlKHJlc29sdmVkLnJlbW90ZSwgcmVzb2x2ZWQuc3luY1Jlc291cmNlLCByZXNvbHZlZC5jb2xsZWN0aW9uLCByZXNvbHZlZC5yZWYsIHJlc29sdmVkLmxvY2F0aW9uKTtcblx0XHRcdGlmIChyZXNvbHZlZC5ub2RlICYmIGNvbnRlbnQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZU5vZGVDb250ZW50KHJlc29sdmVkLnN5bmNSZXNvdXJjZSwgY29udGVudCwgcmVzb2x2ZWQubm9kZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHR9XG5cblx0XHRpZiAoIXJlc29sdmVkLnJlbW90ZSAmJiAhcmVzb2x2ZWQubm9kZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVzb2x2ZUxhdGVzdENvbnRlbnQocmVzb2x2ZWQuc3luY1Jlc291cmNlLCByZXNvbHZlZC5wcm9maWxlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0Q29udGVudEZyb21TdG9yZShyZW1vdGU6IGJvb2xlYW4sIHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLCBjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlZjogc3RyaW5nLCBsb2NhdGlvbj86IFVSSSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuXHRcdGlmIChyZW1vdGUpIHtcblx0XHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGhpcy5nZXRVc2VyRGF0YShzeW5jUmVzb3VyY2UsIHJlZiwgY29sbGVjdGlvbik7XG5cdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UucmVzb2x2ZVJlc291cmNlQ29udGVudChzeW5jUmVzb3VyY2UsIHJlZiwgY29sbGVjdGlvbiwgbG9jYXRpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlTm9kZUNvbnRlbnQoc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UsIGNvbnRlbnQ6IHN0cmluZywgbm9kZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0Y29uc3Qgc3luY0RhdGEgPSB0aGlzLnBhcnNlU3luY0RhdGEoY29udGVudCwgc3luY1Jlc291cmNlKTtcblx0XHRzd2l0Y2ggKHN5bmNSZXNvdXJjZSkge1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU2V0dGluZ3M6IHJldHVybiB0aGlzLnJlc29sdmVTZXR0aW5nc05vZGVDb250ZW50KHN5bmNEYXRhLCBub2RlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLktleWJpbmRpbmdzOiByZXR1cm4gdGhpcy5yZXNvbHZlS2V5YmluZGluZ3NOb2RlQ29udGVudChzeW5jRGF0YSwgbm9kZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5UYXNrczogcmV0dXJuIHRoaXMucmVzb2x2ZVRhc2tzTm9kZUNvbnRlbnQoc3luY0RhdGEsIG5vZGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU25pcHBldHM6IHJldHVybiB0aGlzLnJlc29sdmVTbmlwcGV0c05vZGVDb250ZW50KHN5bmNEYXRhLCBub2RlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlByb21wdHM6IHJldHVybiB0aGlzLnJlc29sdmVQcm9tcHRzTm9kZUNvbnRlbnQoc3luY0RhdGEsIG5vZGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGU6IHJldHVybiB0aGlzLnJlc29sdmVHbG9iYWxTdGF0ZU5vZGVDb250ZW50KHN5bmNEYXRhLCBub2RlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLkV4dGVuc2lvbnM6IHJldHVybiB0aGlzLnJlc29sdmVFeHRlbnNpb25zTm9kZUNvbnRlbnQoc3luY0RhdGEsIG5vZGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuUHJvZmlsZXM6IHJldHVybiB0aGlzLnJlc29sdmVQcm9maWxlTm9kZUNvbnRlbnQoc3luY0RhdGEsIG5vZGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuV29ya3NwYWNlU3RhdGU6IHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUxhdGVzdENvbnRlbnQoc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UsIHByb2ZpbGVJZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0Y29uc3QgcHJvZmlsZSA9IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHByb2ZpbGVJZCk7XG5cdFx0aWYgKCFwcm9maWxlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0c3dpdGNoIChzeW5jUmVzb3VyY2UpIHtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLkdsb2JhbFN0YXRlOiByZXR1cm4gdGhpcy5yZXNvbHZlTGF0ZXN0R2xvYmFsU3RhdGVDb250ZW50KHByb2ZpbGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuRXh0ZW5zaW9uczogcmV0dXJuIHRoaXMucmVzb2x2ZUxhdGVzdEV4dGVuc2lvbnNDb250ZW50KHByb2ZpbGUpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuUHJvZmlsZXM6IHJldHVybiB0aGlzLnJlc29sdmVMYXRlc3RQcm9maWxlc0NvbnRlbnQocHJvZmlsZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TZXR0aW5nczogcmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5LZXliaW5kaW5nczogcmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5UYXNrczogcmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5TbmlwcGV0czogcmV0dXJuIG51bGw7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5Qcm9tcHRzOiByZXR1cm4gbnVsbDtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLldvcmtzcGFjZVN0YXRlOiByZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFNldHRpbmdzQXNzb2NpYXRlZFJlc291cmNlcyh1cmk6IFVSSSwgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCk6IHsgcmVzb3VyY2U6IFVSSTsgY29tcGFyYWJsZVJlc291cmNlOiBVUkkgfVtdIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCBjb21wYXJhYmxlUmVzb3VyY2UgPSBwcm9maWxlID8gcHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlIDogdGhpcy5leHRVcmkuam9pblBhdGgodXJpLCBVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5OT1RfRVhJU1RJTkdfUkVTT1VSQ0UpO1xuXHRcdHJldHVybiBbeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH1dO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlU2V0dGluZ3NOb2RlQ29udGVudChzeW5jRGF0YTogSVN5bmNEYXRhLCBub2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRzd2l0Y2ggKG5vZGUpIHtcblx0XHRcdGNhc2UgJ3NldHRpbmdzLmpzb24nOlxuXHRcdFx0XHRyZXR1cm4gcGFyc2VTZXR0aW5nc1N5bmNDb250ZW50KHN5bmNEYXRhLmNvbnRlbnQpLnNldHRpbmdzO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5YmluZGluZ3NBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaTogVVJJLCBwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkKTogeyByZXNvdXJjZTogVVJJOyBjb21wYXJhYmxlUmVzb3VyY2U6IFVSSSB9W10ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdGhpcy5leHRVcmkuam9pblBhdGgodXJpLCAna2V5YmluZGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IGNvbXBhcmFibGVSZXNvdXJjZSA9IHByb2ZpbGUgPyBwcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UgOiB0aGlzLmV4dFVyaS5qb2luUGF0aCh1cmksIFVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLk5PVF9FWElTVElOR19SRVNPVVJDRSk7XG5cdFx0cmV0dXJuIFt7IHJlc291cmNlLCBjb21wYXJhYmxlUmVzb3VyY2UgfV07XG5cdH1cblxuXHRwcml2YXRlIHJlc29sdmVLZXliaW5kaW5nc05vZGVDb250ZW50KHN5bmNEYXRhOiBJU3luY0RhdGEsIG5vZGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRcdHN3aXRjaCAobm9kZSkge1xuXHRcdFx0Y2FzZSAna2V5YmluZGluZ3MuanNvbic6XG5cdFx0XHRcdHJldHVybiBnZXRLZXliaW5kaW5nc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQoc3luY0RhdGEuY29udGVudCwgISF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKENPTkZJR19TWU5DX0tFWUJJTkRJTkdTX1BFUl9QTEFURk9STSksIHRoaXMubG9nU2VydmljZSk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRUYXNrc0Fzc29jaWF0ZWRSZXNvdXJjZXModXJpOiBVUkksIHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQpOiB7IHJlc291cmNlOiBVUkk7IGNvbXBhcmFibGVSZXNvdXJjZTogVVJJIH1bXSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLmV4dFVyaS5qb2luUGF0aCh1cmksICd0YXNrcy5qc29uJyk7XG5cdFx0Y29uc3QgY29tcGFyYWJsZVJlc291cmNlID0gcHJvZmlsZSA/IHByb2ZpbGUudGFza3NSZXNvdXJjZSA6IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuTk9UX0VYSVNUSU5HX1JFU09VUkNFKTtcblx0XHRyZXR1cm4gW3sgcmVzb3VyY2UsIGNvbXBhcmFibGVSZXNvdXJjZSB9XTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVRhc2tzTm9kZUNvbnRlbnQoc3luY0RhdGE6IElTeW5jRGF0YSwgbm9kZTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0c3dpdGNoIChub2RlKSB7XG5cdFx0XHRjYXNlICd0YXNrcy5qc29uJzpcblx0XHRcdFx0cmV0dXJuIGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChzeW5jRGF0YS5jb250ZW50LCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0U25pcHBldHNBc3NvY2lhdGVkUmVzb3VyY2VzKHVyaTogVVJJLCBwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx7IHJlc291cmNlOiBVUkk7IGNvbXBhcmFibGVSZXNvdXJjZTogVVJJIH1bXT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLnJlc29sdmVDb250ZW50KHVyaSk7XG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdGNvbnN0IHN5bmNEYXRhID0gdGhpcy5wYXJzZVN5bmNEYXRhKGNvbnRlbnQsIFN5bmNSZXNvdXJjZS5TbmlwcGV0cyk7XG5cdFx0XHRpZiAoc3luY0RhdGEpIHtcblx0XHRcdFx0Y29uc3Qgc25pcHBldHMgPSBwYXJzZVNuaXBwZXRzKHN5bmNEYXRhKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gW107XG5cdFx0XHRcdGZvciAoY29uc3Qgc25pcHBldCBvZiBPYmplY3Qua2V5cyhzbmlwcGV0cykpIHtcblx0XHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgc25pcHBldCk7XG5cdFx0XHRcdFx0Y29uc3QgY29tcGFyYWJsZVJlc291cmNlID0gcHJvZmlsZSA/IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHByb2ZpbGUuc25pcHBldHNIb21lLCBzbmlwcGV0KSA6IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuTk9UX0VYSVNUSU5HX1JFU09VUkNFKTtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh7IHJlc291cmNlLCBjb21wYXJhYmxlUmVzb3VyY2UgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlU25pcHBldHNOb2RlQ29udGVudChzeW5jRGF0YTogSVN5bmNEYXRhLCBub2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gcGFyc2VTbmlwcGV0cyhzeW5jRGF0YSlbbm9kZV0gfHwgbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UHJvbXB0c0Fzc29jaWF0ZWRSZXNvdXJjZXModXJpOiBVUkksIHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQpOiBQcm9taXNlPHsgcmVzb3VyY2U6IFVSSTsgY29tcGFyYWJsZVJlc291cmNlOiBVUkkgfVtdPiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMucmVzb2x2ZUNvbnRlbnQodXJpKTtcblx0XHRpZiAoY29udGVudCkge1xuXHRcdFx0Y29uc3Qgc3luY0RhdGEgPSB0aGlzLnBhcnNlU3luY0RhdGEoY29udGVudCwgU3luY1Jlc291cmNlLlByb21wdHMpO1xuXHRcdFx0aWYgKHN5bmNEYXRhKSB7XG5cdFx0XHRcdGNvbnN0IHByb21wdHMgPSBwYXJzZVByb21wdHMoc3luY0RhdGEpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBwcm9tcHQgb2YgT2JqZWN0LmtleXMocHJvbXB0cykpIHtcblx0XHRcdFx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgcHJvbXB0KTtcblx0XHRcdFx0XHRjb25zdCBjb21wYXJhYmxlUmVzb3VyY2UgPSAocHJvZmlsZSlcblx0XHRcdFx0XHRcdD8gdGhpcy5leHRVcmkuam9pblBhdGgocHJvZmlsZS5wcm9tcHRzSG9tZSwgcHJvbXB0KVxuXHRcdFx0XHRcdFx0OiB0aGlzLmV4dFVyaS5qb2luUGF0aCh1cmksIFVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLk5PVF9FWElTVElOR19SRVNPVVJDRSk7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZVByb21wdHNOb2RlQ29udGVudChzeW5jRGF0YTogSVN5bmNEYXRhLCBub2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRyZXR1cm4gcGFyc2VQcm9tcHRzKHN5bmNEYXRhKVtub2RlXSB8fCBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFeHRlbnNpb25zQXNzb2NpYXRlZFJlc291cmNlcyh1cmk6IFVSSSwgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCk6IHsgcmVzb3VyY2U6IFVSSTsgY29tcGFyYWJsZVJlc291cmNlOiBVUkkgfVtdIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgJ2V4dGVuc2lvbnMuanNvbicpO1xuXHRcdGNvbnN0IGNvbXBhcmFibGVSZXNvdXJjZSA9IHByb2ZpbGVcblx0XHRcdD8gdGhpcy50b1VyaSh7XG5cdFx0XHRcdHJlbW90ZTogZmFsc2UsXG5cdFx0XHRcdHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLkV4dGVuc2lvbnMsXG5cdFx0XHRcdHByb2ZpbGU6IHByb2ZpbGUuaWQsXG5cdFx0XHRcdGxvY2F0aW9uOiB1bmRlZmluZWQsXG5cdFx0XHRcdGNvbGxlY3Rpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0cmVmOiB1bmRlZmluZWQsXG5cdFx0XHRcdG5vZGU6IHVuZGVmaW5lZCxcblx0XHRcdH0pXG5cdFx0XHQ6IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuTk9UX0VYSVNUSU5HX1JFU09VUkNFKTtcblx0XHRyZXR1cm4gW3sgcmVzb3VyY2UsIGNvbXBhcmFibGVSZXNvdXJjZSB9XTtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZUV4dGVuc2lvbnNOb2RlQ29udGVudChzeW5jRGF0YTogSVN5bmNEYXRhLCBub2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRzd2l0Y2ggKG5vZGUpIHtcblx0XHRcdGNhc2UgJ2V4dGVuc2lvbnMuanNvbic6XG5cdFx0XHRcdHJldHVybiBzdHJpbmdpZnlFeHRlbnNpb25zKHBhcnNlRXh0ZW5zaW9ucyhzeW5jRGF0YSksIHRydWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUxhdGVzdEV4dGVuc2lvbnNDb250ZW50KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRjb25zdCB7IGxvY2FsRXh0ZW5zaW9ucyB9ID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2NhbEV4dGVuc2lvbnNQcm92aWRlcikuZ2V0TG9jYWxFeHRlbnNpb25zKHByb2ZpbGUpO1xuXHRcdHJldHVybiBzdHJpbmdpZnlFeHRlbnNpb25zKGxvY2FsRXh0ZW5zaW9ucywgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEdsb2JhbFN0YXRlQXNzb2NpYXRlZFJlc291cmNlcyh1cmk6IFVSSSwgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCk6IHsgcmVzb3VyY2U6IFVSSTsgY29tcGFyYWJsZVJlc291cmNlOiBVUkkgfVtdIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHVyaSwgJ2dsb2JhbFN0YXRlLmpzb24nKTtcblx0XHRjb25zdCBjb21wYXJhYmxlUmVzb3VyY2UgPSBwcm9maWxlXG5cdFx0XHQ/IHRoaXMudG9Vcmkoe1xuXHRcdFx0XHRyZW1vdGU6IGZhbHNlLFxuXHRcdFx0XHRzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5HbG9iYWxTdGF0ZSxcblx0XHRcdFx0cHJvZmlsZTogcHJvZmlsZS5pZCxcblx0XHRcdFx0bG9jYXRpb246IHVuZGVmaW5lZCxcblx0XHRcdFx0Y29sbGVjdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRyZWY6IHVuZGVmaW5lZCxcblx0XHRcdFx0bm9kZTogdW5kZWZpbmVkLFxuXHRcdFx0fSlcblx0XHRcdDogdGhpcy5leHRVcmkuam9pblBhdGgodXJpLCBVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5OT1RfRVhJU1RJTkdfUkVTT1VSQ0UpO1xuXHRcdHJldHVybiBbeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH1dO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlR2xvYmFsU3RhdGVOb2RlQ29udGVudChzeW5jRGF0YTogSVN5bmNEYXRhLCBub2RlOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRzd2l0Y2ggKG5vZGUpIHtcblx0XHRcdGNhc2UgJ2dsb2JhbFN0YXRlLmpzb24nOlxuXHRcdFx0XHRyZXR1cm4gc3RyaW5naWZ5R2xvYmFsU3RhdGUoSlNPTi5wYXJzZShzeW5jRGF0YS5jb250ZW50KSwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlTGF0ZXN0R2xvYmFsU3RhdGVDb250ZW50KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRjb25zdCBsb2NhbEdsb2JhbFN0YXRlID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2NhbEdsb2JhbFN0YXRlUHJvdmlkZXIpLmdldExvY2FsR2xvYmFsU3RhdGUocHJvZmlsZSk7XG5cdFx0cmV0dXJuIHN0cmluZ2lmeUdsb2JhbFN0YXRlKGxvY2FsR2xvYmFsU3RhdGUsIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQcm9maWxlc0Fzc29jaWF0ZWRSZXNvdXJjZXModXJpOiBVUkksIHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUgfCB1bmRlZmluZWQpOiB7IHJlc291cmNlOiBVUkk7IGNvbXBhcmFibGVSZXNvdXJjZTogVVJJIH1bXSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0aGlzLmV4dFVyaS5qb2luUGF0aCh1cmksICdwcm9maWxlcy5qc29uJyk7XG5cdFx0Y29uc3QgY29tcGFyYWJsZVJlc291cmNlID0gdGhpcy50b1VyaSh7XG5cdFx0XHRyZW1vdGU6IGZhbHNlLFxuXHRcdFx0c3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuUHJvZmlsZXMsXG5cdFx0XHRwcm9maWxlOiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmlkLFxuXHRcdFx0bG9jYXRpb246IHVuZGVmaW5lZCxcblx0XHRcdGNvbGxlY3Rpb246IHVuZGVmaW5lZCxcblx0XHRcdHJlZjogdW5kZWZpbmVkLFxuXHRcdFx0bm9kZTogdW5kZWZpbmVkLFxuXHRcdH0pO1xuXHRcdHJldHVybiBbeyByZXNvdXJjZSwgY29tcGFyYWJsZVJlc291cmNlIH1dO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlUHJvZmlsZU5vZGVDb250ZW50KHN5bmNEYXRhOiBJU3luY0RhdGEsIG5vZGU6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuXHRcdHN3aXRjaCAobm9kZSkge1xuXHRcdFx0Y2FzZSAncHJvZmlsZXMuanNvbic6XG5cdFx0XHRcdHJldHVybiB0b0Zvcm1hdHRlZFN0cmluZyhKU09OLnBhcnNlKHN5bmNEYXRhLmNvbnRlbnQpLCB7fSk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlTGF0ZXN0UHJvZmlsZXNDb250ZW50KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRyZXR1cm4gc3RyaW5naWZ5TG9jYWxQcm9maWxlcyh0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLmZpbHRlcihwID0+ICFwLmlzRGVmYXVsdCAmJiAhcC5pc1RyYW5zaWVudCksIHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB0b1VyaShzeW5jUmVzb3VyY2VVcmlJbmZvOiBJU3luY1Jlc291cmNlVXJpSW5mbyk6IFVSSSB7XG5cdFx0Y29uc3QgYXV0aG9yaXR5ID0gc3luY1Jlc291cmNlVXJpSW5mby5yZW1vdGUgPyBVc2VyRGF0YVN5bmNSZXNvdXJjZVByb3ZpZGVyU2VydmljZS5SRU1PVEVfQkFDS1VQX0FVVEhPUklUWSA6IFVzZXJEYXRhU3luY1Jlc291cmNlUHJvdmlkZXJTZXJ2aWNlLkxPQ0FMX0JBQ0tVUF9BVVRIT1JJVFk7XG5cdFx0Y29uc3QgcGF0aHMgPSBbXTtcblx0XHRpZiAoc3luY1Jlc291cmNlVXJpSW5mby5sb2NhdGlvbikge1xuXHRcdFx0cGF0aHMucHVzaChgc2NoZW1lOiR7c3luY1Jlc291cmNlVXJpSW5mby5sb2NhdGlvbi5zY2hlbWV9YCk7XG5cdFx0XHRwYXRocy5wdXNoKGBhdXRob3JpdHk6JHtzeW5jUmVzb3VyY2VVcmlJbmZvLmxvY2F0aW9uLmF1dGhvcml0eX1gKTtcblx0XHRcdHBhdGhzLnB1c2godHJpbShzeW5jUmVzb3VyY2VVcmlJbmZvLmxvY2F0aW9uLnBhdGgsICcvJykpO1xuXHRcdH1cblx0XHRwYXRocy5wdXNoKGBzeW5jUmVzb3VyY2U6JHtzeW5jUmVzb3VyY2VVcmlJbmZvLnN5bmNSZXNvdXJjZX1gKTtcblx0XHRwYXRocy5wdXNoKGBwcm9maWxlOiR7c3luY1Jlc291cmNlVXJpSW5mby5wcm9maWxlfWApO1xuXHRcdGlmIChzeW5jUmVzb3VyY2VVcmlJbmZvLmNvbGxlY3Rpb24pIHtcblx0XHRcdHBhdGhzLnB1c2goYGNvbGxlY3Rpb246JHtzeW5jUmVzb3VyY2VVcmlJbmZvLmNvbGxlY3Rpb259YCk7XG5cdFx0fVxuXHRcdGlmIChzeW5jUmVzb3VyY2VVcmlJbmZvLnJlZikge1xuXHRcdFx0cGF0aHMucHVzaChgcmVmOiR7c3luY1Jlc291cmNlVXJpSW5mby5yZWZ9YCk7XG5cdFx0fVxuXHRcdGlmIChzeW5jUmVzb3VyY2VVcmlJbmZvLm5vZGUpIHtcblx0XHRcdHBhdGhzLnB1c2goc3luY1Jlc291cmNlVXJpSW5mby5ub2RlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZXh0VXJpLmpvaW5QYXRoKFVSSS5mcm9tKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eSwgcGF0aDogYC9gLCBxdWVyeTogc3luY1Jlc291cmNlVXJpSW5mby5sb2NhdGlvbj8ucXVlcnksIGZyYWdtZW50OiBzeW5jUmVzb3VyY2VVcmlJbmZvLmxvY2F0aW9uPy5mcmFnbWVudCB9KSwgLi4ucGF0aHMpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlVXJpKHVyaTogVVJJKTogSVN5bmNSZXNvdXJjZVVyaUluZm8gfCB1bmRlZmluZWQge1xuXHRcdGlmICh1cmkuc2NoZW1lICE9PSBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdHdoaWxlICh1cmkucGF0aCAhPT0gJy8nKSB7XG5cdFx0XHRwYXRocy51bnNoaWZ0KHRoaXMuZXh0VXJpLmJhc2VuYW1lKHVyaSkpO1xuXHRcdFx0dXJpID0gdGhpcy5leHRVcmkuZGlybmFtZSh1cmkpO1xuXHRcdH1cblx0XHRpZiAocGF0aHMubGVuZ3RoIDwgMikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVtb3RlID0gdXJpLmF1dGhvcml0eSA9PT0gVXNlckRhdGFTeW5jUmVzb3VyY2VQcm92aWRlclNlcnZpY2UuUkVNT1RFX0JBQ0tVUF9BVVRIT1JJVFk7XG5cdFx0bGV0IHNjaGVtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBhdXRob3JpdHk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsb2NhdGlvblBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcHJvZmlsZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHJlZjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBub2RlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0d2hpbGUgKHBhdGhzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgcGF0aCA9IHBhdGhzLnNoaWZ0KCkhO1xuXHRcdFx0aWYgKHBhdGguc3RhcnRzV2l0aCgnc2NoZW1lOicpKSB7XG5cdFx0XHRcdHNjaGVtZSA9IHBhdGguc3Vic3RyaW5nKCdzY2hlbWU6Jy5sZW5ndGgpO1xuXHRcdFx0fSBlbHNlIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ2F1dGhvcml0eTonKSkge1xuXHRcdFx0XHRhdXRob3JpdHkgPSBwYXRoLnN1YnN0cmluZygnYXV0aG9yaXR5OicubGVuZ3RoKTtcblx0XHRcdH0gZWxzZSBpZiAocGF0aC5zdGFydHNXaXRoKCdzeW5jUmVzb3VyY2U6JykpIHtcblx0XHRcdFx0c3luY1Jlc291cmNlID0gcGF0aC5zdWJzdHJpbmcoJ3N5bmNSZXNvdXJjZTonLmxlbmd0aCkgYXMgU3luY1Jlc291cmNlO1xuXHRcdFx0fSBlbHNlIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ3Byb2ZpbGU6JykpIHtcblx0XHRcdFx0cHJvZmlsZSA9IHBhdGguc3Vic3RyaW5nKCdwcm9maWxlOicubGVuZ3RoKTtcblx0XHRcdH0gZWxzZSBpZiAocGF0aC5zdGFydHNXaXRoKCdjb2xsZWN0aW9uOicpKSB7XG5cdFx0XHRcdGNvbGxlY3Rpb24gPSBwYXRoLnN1YnN0cmluZygnY29sbGVjdGlvbjonLmxlbmd0aCk7XG5cdFx0XHR9IGVsc2UgaWYgKHBhdGguc3RhcnRzV2l0aCgncmVmOicpKSB7XG5cdFx0XHRcdHJlZiA9IHBhdGguc3Vic3RyaW5nKCdyZWY6Jy5sZW5ndGgpO1xuXHRcdFx0fSBlbHNlIGlmICghc3luY1Jlc291cmNlKSB7XG5cdFx0XHRcdGxvY2F0aW9uUGF0aHMucHVzaChwYXRoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG5vZGUgPSBwYXRoO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVtb3RlLFxuXHRcdFx0c3luY1Jlc291cmNlOiBzeW5jUmVzb3VyY2UhLFxuXHRcdFx0cHJvZmlsZTogcHJvZmlsZSEsXG5cdFx0XHRjb2xsZWN0aW9uLFxuXHRcdFx0cmVmLFxuXHRcdFx0bm9kZSxcblx0XHRcdGxvY2F0aW9uOiBzY2hlbWUgJiYgYXV0aG9yaXR5ICE9PSB1bmRlZmluZWQgPyB0aGlzLmV4dFVyaS5qb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZSwgYXV0aG9yaXR5LCBxdWVyeTogdXJpLnF1ZXJ5LCBmcmFnbWVudDogdXJpLmZyYWdtZW50LCBwYXRoOiAnLycgfSksIC4uLmxvY2F0aW9uUGF0aHMpIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VTeW5jRGF0YShjb250ZW50OiBzdHJpbmcsIHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlKTogSVN5bmNEYXRhIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3luY0RhdGE6IElTeW5jRGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG5cdFx0XHRpZiAoaXNTeW5jRGF0YShzeW5jRGF0YSkpIHtcblx0XHRcdFx0cmV0dXJuIHN5bmNEYXRhO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jRXJyb3IobG9jYWxpemUoJ2luY29tcGF0aWJsZSBzeW5jIGRhdGEnLCBcIkNhbm5vdCBwYXJzZSBzeW5jIGRhdGEgYXMgaXQgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgY3VycmVudCB2ZXJzaW9uLlwiKSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkluY29tcGF0aWJsZVJlbW90ZUNvbnRlbnQsIHN5bmNSZXNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFVzZXJEYXRhKHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLCByZWY6IHN0cmluZywgY29sbGVjdGlvbj86IHN0cmluZyk6IFByb21pc2U8SVVzZXJEYXRhPiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLnJlc29sdmVSZXNvdXJjZUNvbnRlbnQoc3luY1Jlc291cmNlLCByZWYsIGNvbGxlY3Rpb24pO1xuXHRcdHJldHVybiB7IHJlZiwgY29udGVudCB9O1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQW9ELGdDQUFnQyx5QkFBeUIsMkJBQTJCLGNBQWMsbUJBQW1CLHVCQUF1Qix1QkFBbUYsNENBQW1FO0FBQ3RWLFNBQTJCLGdDQUFnQztBQUMzRCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDRDQUE0QztBQUNyRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHlCQUF5QixpQkFBaUIsYUFBYSwyQkFBMkI7QUFDM0YsU0FBUywwQkFBMEIsYUFBYSw0QkFBNEI7QUFDNUUsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQkFBK0IsOEJBQThCO0FBQ3RFLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsWUFBWTtBQUVyQixTQUFTLG9CQUFvQjtBQVl0QixJQUFNLHNDQUFOLE1BQTBGO0FBQUEsRUFVaEcsWUFDNkMsMEJBQ0ssK0JBQ0wsWUFDdkIsb0JBQ2lCLG9CQUNKLGdCQUNILGFBQ1kseUJBQ0gsc0JBQ0Esc0JBQ3ZDO0FBVjJDO0FBQ0s7QUFDTDtBQUVOO0FBQ0o7QUFDSDtBQUNZO0FBQ0g7QUFDQTtBQUV4QyxTQUFLLFNBQVMsbUJBQW1CO0FBQUEsRUFDbEM7QUFBQSxFQUVBLE1BQU0sMEJBQTJEO0FBQ2hFLFVBQU0sV0FBVyxNQUFNLEtBQUsseUJBQXlCLGFBQWEsYUFBYSxVQUFVLE1BQU0sTUFBUztBQUN4RyxRQUFJLFNBQVMsU0FBUztBQUNyQixZQUFNLFdBQVcsS0FBSyxjQUFjLFNBQVMsU0FBUyxhQUFhLFFBQVE7QUFDM0UsYUFBTyw4QkFBOEIsUUFBUTtBQUFBLElBQzlDO0FBQ0EsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUFBLEVBRUEsTUFBTSx1QkFBdUIsVUFBaUQ7QUFDN0UsVUFBTSxPQUFPLE1BQU0sS0FBSyw4QkFBOEIsbUJBQW1CLGFBQWEsVUFBVSxRQUFXLFFBQVE7QUFDbkgsUUFBSSxLQUFLLFFBQVE7QUFDaEIsWUFBTSxVQUFVLE1BQU0sS0FBSyw4QkFBOEIsdUJBQXVCLGFBQWEsVUFBVSxLQUFLLENBQUMsRUFBRSxLQUFLLFFBQVcsUUFBUTtBQUN2SSxVQUFJLFNBQVM7QUFDWixjQUFNLFdBQVcsS0FBSyxjQUFjLFNBQVMsYUFBYSxRQUFRO0FBQ2xFLGVBQU8sOEJBQThCLFFBQVE7QUFBQSxNQUM5QztBQUFBLElBQ0Q7QUFDQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFNLHVCQUF1QixVQUFpRDtBQUM3RSxVQUFNLE9BQU8sTUFBTSxLQUFLLDhCQUE4QixtQkFBbUIsWUFBWSxRQUFXLFFBQVE7QUFDeEcsUUFBSSxLQUFLLFFBQVE7QUFDaEIsWUFBTSxVQUFVLE1BQU0sS0FBSyw4QkFBOEIsdUJBQXVCLFlBQVksS0FBSyxDQUFDLEVBQUUsS0FBSyxRQUFXLFFBQVE7QUFDNUgsVUFBSSxTQUFTO0FBQ1osY0FBTSxlQUE4QixLQUFLLE1BQU0sT0FBTztBQUN0RCxlQUFPLGFBQWEsU0FBUyxJQUFJLFFBQU0sRUFBRSxHQUFHLEdBQUcsV0FBVyxNQUFNLEVBQUU7QUFBQSxNQUNuRTtBQUFBLElBQ0Q7QUFDQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxNQUFNLDZCQUE2QixjQUE0QixTQUFnRTtBQUM5SCxVQUFNLFVBQVUsTUFBTSxLQUFLLHlCQUF5QixtQkFBbUIsY0FBYyxTQUFTLFVBQVU7QUFDeEcsV0FBTyxRQUFRLElBQUksQ0FBQyxFQUFFLFNBQVMsSUFBSSxPQUFPO0FBQUEsTUFDekM7QUFBQSxNQUNBLEtBQUssS0FBSyxNQUFNO0FBQUEsUUFDZixRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0EsU0FBUyxTQUFTLE1BQU0sS0FBSyx3QkFBd0IsZUFBZTtBQUFBLFFBQ3BFLFVBQVU7QUFBQSxRQUNWLFlBQVksU0FBUztBQUFBLFFBQ3JCO0FBQUEsUUFDQSxNQUFNO0FBQUEsTUFDUCxDQUFDO0FBQUEsSUFDRixFQUFFO0FBQUEsRUFDSDtBQUFBLEVBRUEsTUFBTSw0QkFBNEIsY0FBNEIsU0FBZ0MsVUFBZ0Q7QUFDN0ksVUFBTSxVQUFVLE1BQU0sS0FBSyw4QkFBOEIsbUJBQW1CLGNBQWMsU0FBUyxZQUFZLFFBQVE7QUFDdkgsV0FBTyxRQUFRLElBQUksQ0FBQyxFQUFFLFNBQVMsSUFBSSxPQUFPO0FBQUEsTUFDekM7QUFBQSxNQUNBLEtBQUssS0FBSyxNQUFNO0FBQUEsUUFDZixRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0EsU0FBUyxTQUFTLE1BQU0sS0FBSyx3QkFBd0IsZUFBZTtBQUFBLFFBQ3BFLFlBQVksU0FBUztBQUFBLFFBQ3JCO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsRUFBRTtBQUFBLEVBQ0g7QUFBQSxFQUVBLDRCQUE0QixFQUFFLElBQUksR0FBMkQ7QUFDNUYsVUFBTSxXQUFXLEtBQUssV0FBVyxHQUFHO0FBQ3BDLFVBQU0sVUFBVSxXQUFXLEtBQUssd0JBQXdCLFNBQVMsS0FBSyxPQUFLLEVBQUUsT0FBTyxTQUFTLE9BQU8sSUFBSTtBQUN4RyxXQUFPLFlBQVksVUFBVSxFQUFFLFNBQVMsY0FBYyxVQUFVLGFBQWEsSUFBSTtBQUFBLEVBQ2xGO0FBQUEsRUFFQSxNQUFNLHVCQUF1QixFQUFFLElBQUksR0FBK0U7QUFDakgsVUFBTSxXQUFXLEtBQUssV0FBVyxHQUFHO0FBQ3BDLFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTyxDQUFDO0FBQUEsSUFDVDtBQUVBLFVBQU0sVUFBVSxLQUFLLHdCQUF3QixTQUFTLEtBQUssT0FBSyxFQUFFLE9BQU8sU0FBUyxPQUFPO0FBQ3pGLFlBQVEsU0FBUyxjQUFjO0FBQUEsTUFDOUIsS0FBSyxhQUFhO0FBQVUsZUFBTyxLQUFLLCtCQUErQixLQUFLLE9BQU87QUFBQSxNQUNuRixLQUFLLGFBQWE7QUFBYSxlQUFPLEtBQUssa0NBQWtDLEtBQUssT0FBTztBQUFBLE1BQ3pGLEtBQUssYUFBYTtBQUFPLGVBQU8sS0FBSyw0QkFBNEIsS0FBSyxPQUFPO0FBQUEsTUFDN0UsS0FBSyxhQUFhO0FBQVUsZUFBTyxLQUFLLCtCQUErQixLQUFLLE9BQU87QUFBQSxNQUNuRixLQUFLLGFBQWE7QUFBUyxlQUFPLEtBQUssOEJBQThCLEtBQUssT0FBTztBQUFBLE1BQ2pGLEtBQUssYUFBYTtBQUFhLGVBQU8sS0FBSyxrQ0FBa0MsS0FBSyxPQUFPO0FBQUEsTUFDekYsS0FBSyxhQUFhO0FBQVksZUFBTyxLQUFLLGlDQUFpQyxLQUFLLE9BQU87QUFBQSxNQUN2RixLQUFLLGFBQWE7QUFBVSxlQUFPLEtBQUssK0JBQStCLEtBQUssT0FBTztBQUFBLE1BQ25GLEtBQUssYUFBYTtBQUFnQixlQUFPLENBQUM7QUFBQSxJQUMzQztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sYUFBYSxFQUFFLElBQUksR0FBcUQ7QUFDN0UsVUFBTSxXQUFXLEtBQUssV0FBVyxHQUFHO0FBQ3BDLFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLFNBQVMsUUFBUTtBQUNwQixVQUFJLFNBQVMsS0FBSztBQUNqQixjQUFNLEVBQUUsUUFBUSxJQUFJLE1BQU0sS0FBSyxZQUFZLFNBQVMsY0FBYyxTQUFTLEtBQUssU0FBUyxVQUFVO0FBQ25HLFlBQUksU0FBUztBQUNaLGdCQUFNLFdBQVcsS0FBSyxjQUFjLFNBQVMsU0FBUyxZQUFZO0FBQ2xFLGlCQUFPLFVBQVU7QUFBQSxRQUNsQjtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksU0FBUyxVQUFVO0FBQ3RCLFVBQUksU0FBUyxLQUFLO0FBQ2pCLGNBQU0sVUFBVSxNQUFNLEtBQUssOEJBQThCLHVCQUF1QixTQUFTLGNBQWMsU0FBUyxLQUFLLFNBQVMsWUFBWSxTQUFTLFFBQVE7QUFDM0osWUFBSSxTQUFTO0FBQ1osZ0JBQU0sV0FBVyxLQUFLLGNBQWMsU0FBUyxTQUFTLFlBQVk7QUFDbEUsaUJBQU8sVUFBVTtBQUFBLFFBQ2xCO0FBQUEsTUFDRDtBQUNBLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxvQkFBb0IsS0FBSyxvQkFBb0IsS0FBSyxhQUFhLEtBQUssY0FBYztBQUFBLEVBQzFGO0FBQUEsRUFFQSxNQUFNLGVBQWUsS0FBa0M7QUFDdEQsVUFBTSxXQUFXLEtBQUssV0FBVyxHQUFHO0FBQ3BDLFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLFNBQVMsU0FBUyxvQ0FBb0MsdUJBQXVCO0FBQ2hGLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxTQUFTLEtBQUs7QUFDakIsWUFBTSxVQUFVLE1BQU0sS0FBSyxvQkFBb0IsU0FBUyxRQUFRLFNBQVMsY0FBYyxTQUFTLFlBQVksU0FBUyxLQUFLLFNBQVMsUUFBUTtBQUMzSSxVQUFJLFNBQVMsUUFBUSxTQUFTO0FBQzdCLGVBQU8sS0FBSyxtQkFBbUIsU0FBUyxjQUFjLFNBQVMsU0FBUyxJQUFJO0FBQUEsTUFDN0U7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksQ0FBQyxTQUFTLFVBQVUsQ0FBQyxTQUFTLE1BQU07QUFDdkMsYUFBTyxLQUFLLHFCQUFxQixTQUFTLGNBQWMsU0FBUyxPQUFPO0FBQUEsSUFDekU7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxvQkFBb0IsUUFBaUIsY0FBNEIsWUFBZ0MsS0FBYSxVQUF3QztBQUNuSyxRQUFJLFFBQVE7QUFDWCxZQUFNLEVBQUUsUUFBUSxJQUFJLE1BQU0sS0FBSyxZQUFZLGNBQWMsS0FBSyxVQUFVO0FBQ3hFLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxLQUFLLDhCQUE4Qix1QkFBdUIsY0FBYyxLQUFLLFlBQVksUUFBUTtBQUFBLEVBQ3pHO0FBQUEsRUFFUSxtQkFBbUIsY0FBNEIsU0FBaUIsTUFBNkI7QUFDcEcsVUFBTSxXQUFXLEtBQUssY0FBYyxTQUFTLFlBQVk7QUFDekQsWUFBUSxjQUFjO0FBQUEsTUFDckIsS0FBSyxhQUFhO0FBQVUsZUFBTyxLQUFLLDJCQUEyQixVQUFVLElBQUk7QUFBQSxNQUNqRixLQUFLLGFBQWE7QUFBYSxlQUFPLEtBQUssOEJBQThCLFVBQVUsSUFBSTtBQUFBLE1BQ3ZGLEtBQUssYUFBYTtBQUFPLGVBQU8sS0FBSyx3QkFBd0IsVUFBVSxJQUFJO0FBQUEsTUFDM0UsS0FBSyxhQUFhO0FBQVUsZUFBTyxLQUFLLDJCQUEyQixVQUFVLElBQUk7QUFBQSxNQUNqRixLQUFLLGFBQWE7QUFBUyxlQUFPLEtBQUssMEJBQTBCLFVBQVUsSUFBSTtBQUFBLE1BQy9FLEtBQUssYUFBYTtBQUFhLGVBQU8sS0FBSyw4QkFBOEIsVUFBVSxJQUFJO0FBQUEsTUFDdkYsS0FBSyxhQUFhO0FBQVksZUFBTyxLQUFLLDZCQUE2QixVQUFVLElBQUk7QUFBQSxNQUNyRixLQUFLLGFBQWE7QUFBVSxlQUFPLEtBQUssMEJBQTBCLFVBQVUsSUFBSTtBQUFBLE1BQ2hGLEtBQUssYUFBYTtBQUFnQixlQUFPO0FBQUEsSUFDMUM7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLHFCQUFxQixjQUE0QixXQUEyQztBQUN6RyxVQUFNLFVBQVUsS0FBSyx3QkFBd0IsU0FBUyxLQUFLLE9BQUssRUFBRSxPQUFPLFNBQVM7QUFDbEYsUUFBSSxDQUFDLFNBQVM7QUFDYixhQUFPO0FBQUEsSUFDUjtBQUNBLFlBQVEsY0FBYztBQUFBLE1BQ3JCLEtBQUssYUFBYTtBQUFhLGVBQU8sS0FBSyxnQ0FBZ0MsT0FBTztBQUFBLE1BQ2xGLEtBQUssYUFBYTtBQUFZLGVBQU8sS0FBSywrQkFBK0IsT0FBTztBQUFBLE1BQ2hGLEtBQUssYUFBYTtBQUFVLGVBQU8sS0FBSyw2QkFBNkIsT0FBTztBQUFBLE1BQzVFLEtBQUssYUFBYTtBQUFVLGVBQU87QUFBQSxNQUNuQyxLQUFLLGFBQWE7QUFBYSxlQUFPO0FBQUEsTUFDdEMsS0FBSyxhQUFhO0FBQU8sZUFBTztBQUFBLE1BQ2hDLEtBQUssYUFBYTtBQUFVLGVBQU87QUFBQSxNQUNuQyxLQUFLLGFBQWE7QUFBUyxlQUFPO0FBQUEsTUFDbEMsS0FBSyxhQUFhO0FBQWdCLGVBQU87QUFBQSxJQUMxQztBQUFBLEVBQ0Q7QUFBQSxFQUVRLCtCQUErQixLQUFVLFNBQXFGO0FBQ3JJLFVBQU0sV0FBVyxLQUFLLE9BQU8sU0FBUyxLQUFLLGVBQWU7QUFDMUQsVUFBTSxxQkFBcUIsVUFBVSxRQUFRLG1CQUFtQixLQUFLLE9BQU8sU0FBUyxLQUFLLG9DQUFvQyxxQkFBcUI7QUFDbkosV0FBTyxDQUFDLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSwyQkFBMkIsVUFBcUIsTUFBNkI7QUFDcEYsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQ0osZUFBTyx5QkFBeUIsU0FBUyxPQUFPLEVBQUU7QUFBQSxJQUNwRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxrQ0FBa0MsS0FBVSxTQUFxRjtBQUN4SSxVQUFNLFdBQVcsS0FBSyxPQUFPLFNBQVMsS0FBSyxrQkFBa0I7QUFDN0QsVUFBTSxxQkFBcUIsVUFBVSxRQUFRLHNCQUFzQixLQUFLLE9BQU8sU0FBUyxLQUFLLG9DQUFvQyxxQkFBcUI7QUFDdEosV0FBTyxDQUFDLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSw4QkFBOEIsVUFBcUIsTUFBNkI7QUFDdkYsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQ0osZUFBTyxxQ0FBcUMsU0FBUyxTQUFTLENBQUMsQ0FBQyxLQUFLLHFCQUFxQixTQUFTLG9DQUFvQyxHQUFHLEtBQUssVUFBVTtBQUFBLElBQzNKO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLDRCQUE0QixLQUFVLFNBQXFGO0FBQ2xJLFVBQU0sV0FBVyxLQUFLLE9BQU8sU0FBUyxLQUFLLFlBQVk7QUFDdkQsVUFBTSxxQkFBcUIsVUFBVSxRQUFRLGdCQUFnQixLQUFLLE9BQU8sU0FBUyxLQUFLLG9DQUFvQyxxQkFBcUI7QUFDaEosV0FBTyxDQUFDLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSx3QkFBd0IsVUFBcUIsTUFBNkI7QUFDakYsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQ0osZUFBTywrQkFBK0IsU0FBUyxTQUFTLEtBQUssVUFBVTtBQUFBLElBQ3pFO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsK0JBQStCLEtBQVUsU0FBOEY7QUFDcEosVUFBTSxVQUFVLE1BQU0sS0FBSyxlQUFlLEdBQUc7QUFDN0MsUUFBSSxTQUFTO0FBQ1osWUFBTSxXQUFXLEtBQUssY0FBYyxTQUFTLGFBQWEsUUFBUTtBQUNsRSxVQUFJLFVBQVU7QUFDYixjQUFNLFdBQVcsY0FBYyxRQUFRO0FBQ3ZDLGNBQU0sU0FBUyxDQUFDO0FBQ2hCLG1CQUFXLFdBQVcsT0FBTyxLQUFLLFFBQVEsR0FBRztBQUM1QyxnQkFBTSxXQUFXLEtBQUssT0FBTyxTQUFTLEtBQUssT0FBTztBQUNsRCxnQkFBTSxxQkFBcUIsVUFBVSxLQUFLLE9BQU8sU0FBUyxRQUFRLGNBQWMsT0FBTyxJQUFJLEtBQUssT0FBTyxTQUFTLEtBQUssb0NBQW9DLHFCQUFxQjtBQUM5SyxpQkFBTyxLQUFLLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLFFBQzdDO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUFBLEVBRVEsMkJBQTJCLFVBQXFCLE1BQTZCO0FBQ3BGLFdBQU8sY0FBYyxRQUFRLEVBQUUsSUFBSSxLQUFLO0FBQUEsRUFDekM7QUFBQSxFQUVBLE1BQWMsOEJBQThCLEtBQVUsU0FBOEY7QUFDbkosVUFBTSxVQUFVLE1BQU0sS0FBSyxlQUFlLEdBQUc7QUFDN0MsUUFBSSxTQUFTO0FBQ1osWUFBTSxXQUFXLEtBQUssY0FBYyxTQUFTLGFBQWEsT0FBTztBQUNqRSxVQUFJLFVBQVU7QUFDYixjQUFNLFVBQVUsYUFBYSxRQUFRO0FBQ3JDLGNBQU0sU0FBUyxDQUFDO0FBQ2hCLG1CQUFXLFVBQVUsT0FBTyxLQUFLLE9BQU8sR0FBRztBQUMxQyxnQkFBTSxXQUFXLEtBQUssT0FBTyxTQUFTLEtBQUssTUFBTTtBQUNqRCxnQkFBTSxxQkFBc0IsVUFDekIsS0FBSyxPQUFPLFNBQVMsUUFBUSxhQUFhLE1BQU0sSUFDaEQsS0FBSyxPQUFPLFNBQVMsS0FBSyxvQ0FBb0MscUJBQXFCO0FBQ3RGLGlCQUFPLEtBQUssRUFBRSxVQUFVLG1CQUFtQixDQUFDO0FBQUEsUUFDN0M7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFUSwwQkFBMEIsVUFBcUIsTUFBNkI7QUFDbkYsV0FBTyxhQUFhLFFBQVEsRUFBRSxJQUFJLEtBQUs7QUFBQSxFQUN4QztBQUFBLEVBRVEsaUNBQWlDLEtBQVUsU0FBcUY7QUFDdkksVUFBTSxXQUFXLEtBQUssT0FBTyxTQUFTLEtBQUssaUJBQWlCO0FBQzVELFVBQU0scUJBQXFCLFVBQ3hCLEtBQUssTUFBTTtBQUFBLE1BQ1osUUFBUTtBQUFBLE1BQ1IsY0FBYyxhQUFhO0FBQUEsTUFDM0IsU0FBUyxRQUFRO0FBQUEsTUFDakIsVUFBVTtBQUFBLE1BQ1YsWUFBWTtBQUFBLE1BQ1osS0FBSztBQUFBLE1BQ0wsTUFBTTtBQUFBLElBQ1AsQ0FBQyxJQUNDLEtBQUssT0FBTyxTQUFTLEtBQUssb0NBQW9DLHFCQUFxQjtBQUN0RixXQUFPLENBQUMsRUFBRSxVQUFVLG1CQUFtQixDQUFDO0FBQUEsRUFDekM7QUFBQSxFQUVRLDZCQUE2QixVQUFxQixNQUE2QjtBQUN0RixZQUFRLE1BQU07QUFBQSxNQUNiLEtBQUs7QUFDSixlQUFPLG9CQUFvQixnQkFBZ0IsUUFBUSxHQUFHLElBQUk7QUFBQSxJQUM1RDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLCtCQUErQixTQUFtRDtBQUMvRixVQUFNLEVBQUUsZ0JBQWdCLElBQUksTUFBTSxLQUFLLHFCQUFxQixlQUFlLHVCQUF1QixFQUFFLG1CQUFtQixPQUFPO0FBQzlILFdBQU8sb0JBQW9CLGlCQUFpQixJQUFJO0FBQUEsRUFDakQ7QUFBQSxFQUVRLGtDQUFrQyxLQUFVLFNBQXFGO0FBQ3hJLFVBQU0sV0FBVyxLQUFLLE9BQU8sU0FBUyxLQUFLLGtCQUFrQjtBQUM3RCxVQUFNLHFCQUFxQixVQUN4QixLQUFLLE1BQU07QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLGNBQWMsYUFBYTtBQUFBLE1BQzNCLFNBQVMsUUFBUTtBQUFBLE1BQ2pCLFVBQVU7QUFBQSxNQUNWLFlBQVk7QUFBQSxNQUNaLEtBQUs7QUFBQSxNQUNMLE1BQU07QUFBQSxJQUNQLENBQUMsSUFDQyxLQUFLLE9BQU8sU0FBUyxLQUFLLG9DQUFvQyxxQkFBcUI7QUFDdEYsV0FBTyxDQUFDLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSw4QkFBOEIsVUFBcUIsTUFBNkI7QUFDdkYsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQ0osZUFBTyxxQkFBcUIsS0FBSyxNQUFNLFNBQVMsT0FBTyxHQUFHLElBQUk7QUFBQSxJQUNoRTtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFjLGdDQUFnQyxTQUFtRDtBQUNoRyxVQUFNLG1CQUFtQixNQUFNLEtBQUsscUJBQXFCLGVBQWUsd0JBQXdCLEVBQUUsb0JBQW9CLE9BQU87QUFDN0gsV0FBTyxxQkFBcUIsa0JBQWtCLElBQUk7QUFBQSxFQUNuRDtBQUFBLEVBRVEsK0JBQStCLEtBQVUsU0FBcUY7QUFDckksVUFBTSxXQUFXLEtBQUssT0FBTyxTQUFTLEtBQUssZUFBZTtBQUMxRCxVQUFNLHFCQUFxQixLQUFLLE1BQU07QUFBQSxNQUNyQyxRQUFRO0FBQUEsTUFDUixjQUFjLGFBQWE7QUFBQSxNQUMzQixTQUFTLEtBQUssd0JBQXdCLGVBQWU7QUFBQSxNQUNyRCxVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsTUFDWixLQUFLO0FBQUEsTUFDTCxNQUFNO0FBQUEsSUFDUCxDQUFDO0FBQ0QsV0FBTyxDQUFDLEVBQUUsVUFBVSxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSwwQkFBMEIsVUFBcUIsTUFBNkI7QUFDbkYsWUFBUSxNQUFNO0FBQUEsTUFDYixLQUFLO0FBQ0osZUFBTyxrQkFBa0IsS0FBSyxNQUFNLFNBQVMsT0FBTyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQzNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsNkJBQTZCLFNBQW1EO0FBQzdGLFdBQU8sdUJBQXVCLEtBQUssd0JBQXdCLFNBQVMsT0FBTyxPQUFLLENBQUMsRUFBRSxhQUFhLENBQUMsRUFBRSxXQUFXLEdBQUcsSUFBSTtBQUFBLEVBQ3RIO0FBQUEsRUFFUSxNQUFNLHFCQUFnRDtBQUM3RCxVQUFNLFlBQVksb0JBQW9CLFNBQVMsb0NBQW9DLDBCQUEwQixvQ0FBb0M7QUFDakosVUFBTSxRQUFRLENBQUM7QUFDZixRQUFJLG9CQUFvQixVQUFVO0FBQ2pDLFlBQU0sS0FBSyxVQUFVLG9CQUFvQixTQUFTLE1BQU0sRUFBRTtBQUMxRCxZQUFNLEtBQUssYUFBYSxvQkFBb0IsU0FBUyxTQUFTLEVBQUU7QUFDaEUsWUFBTSxLQUFLLEtBQUssb0JBQW9CLFNBQVMsTUFBTSxHQUFHLENBQUM7QUFBQSxJQUN4RDtBQUNBLFVBQU0sS0FBSyxnQkFBZ0Isb0JBQW9CLFlBQVksRUFBRTtBQUM3RCxVQUFNLEtBQUssV0FBVyxvQkFBb0IsT0FBTyxFQUFFO0FBQ25ELFFBQUksb0JBQW9CLFlBQVk7QUFDbkMsWUFBTSxLQUFLLGNBQWMsb0JBQW9CLFVBQVUsRUFBRTtBQUFBLElBQzFEO0FBQ0EsUUFBSSxvQkFBb0IsS0FBSztBQUM1QixZQUFNLEtBQUssT0FBTyxvQkFBb0IsR0FBRyxFQUFFO0FBQUEsSUFDNUM7QUFDQSxRQUFJLG9CQUFvQixNQUFNO0FBQzdCLFlBQU0sS0FBSyxvQkFBb0IsSUFBSTtBQUFBLElBQ3BDO0FBQ0EsV0FBTyxLQUFLLE9BQU8sU0FBUyxJQUFJLEtBQUssRUFBRSxRQUFRLHVCQUF1QixXQUFXLE1BQU0sS0FBSyxPQUFPLG9CQUFvQixVQUFVLE9BQU8sVUFBVSxvQkFBb0IsVUFBVSxTQUFTLENBQUMsR0FBRyxHQUFHLEtBQUs7QUFBQSxFQUN0TTtBQUFBLEVBRVEsV0FBVyxLQUE0QztBQUM5RCxRQUFJLElBQUksV0FBVyx1QkFBdUI7QUFDekMsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLFFBQWtCLENBQUM7QUFDekIsV0FBTyxJQUFJLFNBQVMsS0FBSztBQUN4QixZQUFNLFFBQVEsS0FBSyxPQUFPLFNBQVMsR0FBRyxDQUFDO0FBQ3ZDLFlBQU0sS0FBSyxPQUFPLFFBQVEsR0FBRztBQUFBLElBQzlCO0FBQ0EsUUFBSSxNQUFNLFNBQVMsR0FBRztBQUNyQixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sU0FBUyxJQUFJLGNBQWMsb0NBQW9DO0FBQ3JFLFFBQUk7QUFDSixRQUFJO0FBQ0osVUFBTSxnQkFBMEIsQ0FBQztBQUNqQyxRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUNKLFdBQU8sTUFBTSxRQUFRO0FBQ3BCLFlBQU0sT0FBTyxNQUFNLE1BQU07QUFDekIsVUFBSSxLQUFLLFdBQVcsU0FBUyxHQUFHO0FBQy9CLGlCQUFTLEtBQUssVUFBVSxVQUFVLE1BQU07QUFBQSxNQUN6QyxXQUFXLEtBQUssV0FBVyxZQUFZLEdBQUc7QUFDekMsb0JBQVksS0FBSyxVQUFVLGFBQWEsTUFBTTtBQUFBLE1BQy9DLFdBQVcsS0FBSyxXQUFXLGVBQWUsR0FBRztBQUM1Qyx1QkFBZSxLQUFLLFVBQVUsZ0JBQWdCLE1BQU07QUFBQSxNQUNyRCxXQUFXLEtBQUssV0FBVyxVQUFVLEdBQUc7QUFDdkMsa0JBQVUsS0FBSyxVQUFVLFdBQVcsTUFBTTtBQUFBLE1BQzNDLFdBQVcsS0FBSyxXQUFXLGFBQWEsR0FBRztBQUMxQyxxQkFBYSxLQUFLLFVBQVUsY0FBYyxNQUFNO0FBQUEsTUFDakQsV0FBVyxLQUFLLFdBQVcsTUFBTSxHQUFHO0FBQ25DLGNBQU0sS0FBSyxVQUFVLE9BQU8sTUFBTTtBQUFBLE1BQ25DLFdBQVcsQ0FBQyxjQUFjO0FBQ3pCLHNCQUFjLEtBQUssSUFBSTtBQUFBLE1BQ3hCLE9BQU87QUFDTixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxVQUFVLFVBQVUsY0FBYyxTQUFZLEtBQUssT0FBTyxTQUFTLElBQUksS0FBSyxFQUFFLFFBQVEsV0FBVyxPQUFPLElBQUksT0FBTyxVQUFVLElBQUksVUFBVSxNQUFNLElBQUksQ0FBQyxHQUFHLEdBQUcsYUFBYSxJQUFJO0FBQUEsSUFDOUs7QUFBQSxFQUNEO0FBQUEsRUFFUSxjQUFjLFNBQWlCLGNBQXVDO0FBQzdFLFFBQUk7QUFDSCxZQUFNLFdBQXNCLEtBQUssTUFBTSxPQUFPO0FBQzlDLFVBQUksV0FBVyxRQUFRLEdBQUc7QUFDekIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFBQSxJQUM1QjtBQUNBLFVBQU0sSUFBSSxrQkFBa0IsU0FBUywwQkFBMEIsMEVBQTBFLEdBQUcsc0JBQXNCLDJCQUEyQixZQUFZO0FBQUEsRUFDMU07QUFBQSxFQUVBLE1BQWMsWUFBWSxjQUE0QixLQUFhLFlBQXlDO0FBQzNHLFVBQU0sVUFBVSxNQUFNLEtBQUsseUJBQXlCLHVCQUF1QixjQUFjLEtBQUssVUFBVTtBQUN4RyxXQUFPLEVBQUUsS0FBSyxRQUFRO0FBQUEsRUFDdkI7QUFFRDtBQTNkYSxvQ0FJWSx3QkFBd0I7QUFKcEMsb0NBS1ksMEJBQTBCO0FBTHRDLG9DQU1ZLHlCQUF5QjtBQU5yQyxzQ0FBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXBCVTsiLAogICJuYW1lcyI6IFtdCn0K
