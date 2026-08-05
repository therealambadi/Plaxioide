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
import { hash } from "../../../base/common/hash.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { basename, joinPath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from "../../workspace/common/workspace.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { Promises } from "../../../base/common/async.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { escapeRegExpCharacters } from "../../../base/common/strings.js";
import { isString } from "../../../base/common/types.js";
var ProfileResourceType = /* @__PURE__ */ ((ProfileResourceType2) => {
  ProfileResourceType2["Settings"] = "settings";
  ProfileResourceType2["Keybindings"] = "keybindings";
  ProfileResourceType2["Snippets"] = "snippets";
  ProfileResourceType2["Prompts"] = "prompts";
  ProfileResourceType2["Tasks"] = "tasks";
  ProfileResourceType2["Extensions"] = "extensions";
  ProfileResourceType2["GlobalState"] = "globalState";
  return ProfileResourceType2;
})(ProfileResourceType || {});
function isUserDataProfile(thing) {
  const candidate = thing;
  return !!(candidate && typeof candidate === "object" && typeof candidate.id === "string" && typeof candidate.isDefault === "boolean" && typeof candidate.name === "string" && URI.isUri(candidate.location) && URI.isUri(candidate.globalStorageHome) && URI.isUri(candidate.settingsResource) && URI.isUri(candidate.keybindingsResource) && URI.isUri(candidate.tasksResource) && URI.isUri(candidate.snippetsHome) && URI.isUri(candidate.promptsHome) && URI.isUri(candidate.extensionsResource));
}
const IUserDataProfilesService = createDecorator("IUserDataProfilesService");
function reviveProfile(profile, scheme) {
  return {
    id: profile.id,
    isDefault: profile.isDefault,
    name: profile.name,
    icon: profile.icon,
    location: URI.revive(profile.location).with({ scheme }),
    globalStorageHome: URI.revive(profile.globalStorageHome).with({ scheme }),
    settingsResource: URI.revive(profile.settingsResource).with({ scheme }),
    keybindingsResource: URI.revive(profile.keybindingsResource).with({ scheme }),
    tasksResource: URI.revive(profile.tasksResource).with({ scheme }),
    snippetsHome: URI.revive(profile.snippetsHome).with({ scheme }),
    promptsHome: URI.revive(profile.promptsHome).with({ scheme }),
    extensionsResource: URI.revive(profile.extensionsResource).with({ scheme }),
    cacheHome: URI.revive(profile.cacheHome).with({ scheme }),
    useDefaultFlags: profile.useDefaultFlags,
    isTransient: profile.isTransient,
    workspaces: profile.workspaces?.map((w) => URI.revive(w))
  };
}
function toUserDataProfile(id, name, location, profilesCacheHome, options, defaultProfile) {
  return {
    id,
    name,
    location,
    isDefault: false,
    icon: options?.icon,
    globalStorageHome: defaultProfile && options?.useDefaultFlags?.globalState ? defaultProfile.globalStorageHome : joinPath(location, "globalStorage"),
    settingsResource: defaultProfile && options?.useDefaultFlags?.settings ? defaultProfile.settingsResource : joinPath(location, "settings.json"),
    keybindingsResource: defaultProfile && options?.useDefaultFlags?.keybindings ? defaultProfile.keybindingsResource : joinPath(location, "keybindings.json"),
    tasksResource: defaultProfile && options?.useDefaultFlags?.tasks ? defaultProfile.tasksResource : joinPath(location, "tasks.json"),
    snippetsHome: defaultProfile && options?.useDefaultFlags?.snippets ? defaultProfile.snippetsHome : joinPath(location, "snippets"),
    promptsHome: defaultProfile && options?.useDefaultFlags?.prompts ? defaultProfile.promptsHome : joinPath(location, "prompts"),
    extensionsResource: defaultProfile && options?.useDefaultFlags?.extensions ? defaultProfile.extensionsResource : joinPath(location, "extensions.json"),
    cacheHome: joinPath(profilesCacheHome, id),
    useDefaultFlags: options?.useDefaultFlags,
    isTransient: options?.transient,
    workspaces: options?.workspaces
  };
}
let UserDataProfilesService = class extends Disposable {
  constructor(environmentService, fileService, uriIdentityService, logService) {
    super();
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._onDidChangeProfiles = this._register(new Emitter());
    this.onDidChangeProfiles = this._onDidChangeProfiles.event;
    this._onWillCreateProfile = this._register(new Emitter());
    this.onWillCreateProfile = this._onWillCreateProfile.event;
    this._onWillRemoveProfile = this._register(new Emitter());
    this.onWillRemoveProfile = this._onWillRemoveProfile.event;
    this._onDidResetWorkspaces = this._register(new Emitter());
    this.onDidResetWorkspaces = this._onDidResetWorkspaces.event;
    this.profileCreationPromises = /* @__PURE__ */ new Map();
    this.transientProfilesObject = {
      profiles: [],
      emptyWindows: /* @__PURE__ */ new Map()
    };
    this.profilesHome = joinPath(this.environmentService.userRoamingDataHome, "profiles");
    this.profilesCacheHome = joinPath(this.environmentService.cacheHome, "CachedProfilesData");
  }
  get defaultProfile() {
    return this.profiles[0];
  }
  get profiles() {
    return [...this.profilesObject.profiles, ...this.transientProfilesObject.profiles];
  }
  init() {
    this._profilesObject = void 0;
  }
  get profilesObject() {
    if (!this._profilesObject) {
      const defaultProfile = this.createDefaultProfile();
      const profiles = [defaultProfile];
      try {
        for (const storedProfile of this.getStoredProfiles()) {
          if (!storedProfile.name || !isString(storedProfile.name) || !storedProfile.location) {
            this.logService.warn("Skipping the invalid stored profile", storedProfile.location || storedProfile.name);
            continue;
          }
          profiles.push(toUserDataProfile(basename(storedProfile.location), storedProfile.name, storedProfile.location, this.profilesCacheHome, { icon: storedProfile.icon, useDefaultFlags: storedProfile.useDefaultFlags }, defaultProfile));
        }
      } catch (error) {
        this.logService.error(error);
      }
      const emptyWindows = /* @__PURE__ */ new Map();
      if (profiles.length) {
        try {
          const profileAssociaitions = this.getStoredProfileAssociations();
          if (profileAssociaitions.workspaces) {
            for (const [workspacePath, profileId] of Object.entries(profileAssociaitions.workspaces)) {
              const workspace = URI.parse(workspacePath);
              const profile = profiles.find((p) => p.id === profileId);
              if (profile) {
                const workspaces = profile.workspaces ? profile.workspaces.slice(0) : [];
                workspaces.push(workspace);
                profile.workspaces = workspaces;
              }
            }
          }
          if (profileAssociaitions.emptyWindows) {
            for (const [windowId, profileId] of Object.entries(profileAssociaitions.emptyWindows)) {
              const profile = profiles.find((p) => p.id === profileId);
              if (profile) {
                emptyWindows.set(windowId, profile);
              }
            }
          }
        } catch (error) {
          this.logService.error(error);
        }
      }
      this._profilesObject = { profiles, emptyWindows };
    }
    return this._profilesObject;
  }
  createDefaultProfile() {
    const defaultProfile = toUserDataProfile("__default__profile__", localize("defaultProfile", "Default"), this.environmentService.userRoamingDataHome, this.profilesCacheHome);
    return { ...defaultProfile, extensionsResource: this.getDefaultProfileExtensionsLocation() ?? defaultProfile.extensionsResource, isDefault: true };
  }
  async createTransientProfile(workspaceIdentifier) {
    const namePrefix = `Temp`;
    const nameRegEx = new RegExp(`${escapeRegExpCharacters(namePrefix)}\\s(\\d+)`);
    let nameIndex = 0;
    for (const profile of this.profiles) {
      const matches = nameRegEx.exec(profile.name);
      const index = matches ? parseInt(matches[1]) : 0;
      nameIndex = index > nameIndex ? index : nameIndex;
    }
    const name = `${namePrefix} ${nameIndex + 1}`;
    return this.createProfile(hash(generateUuid()).toString(16), name, { transient: true }, workspaceIdentifier);
  }
  async createNamedProfile(name, options, workspaceIdentifier) {
    return this.createProfile(hash(generateUuid()).toString(16), name, options, workspaceIdentifier);
  }
  async createProfile(id, name, options, workspaceIdentifier) {
    const profile = await this.doCreateProfile(id, name, options, workspaceIdentifier);
    return profile;
  }
  async doCreateProfile(id, name, options, workspaceIdentifier) {
    if (!isString(name) || !name) {
      throw new Error("Name of the profile is mandatory and must be of type `string`");
    }
    let profileCreationPromise = this.profileCreationPromises.get(name);
    if (!profileCreationPromise) {
      profileCreationPromise = (async () => {
        try {
          const existing = this.profiles.find((p) => p.id === id || !p.isTransient && !options?.transient && p.name === name);
          if (existing) {
            throw new Error(`Profile with ${name} name already exists`);
          }
          const workspace = workspaceIdentifier ? this.getWorkspace(workspaceIdentifier) : void 0;
          if (URI.isUri(workspace)) {
            options = { ...options, workspaces: [workspace] };
          }
          const profile = toUserDataProfile(id, name, joinPath(this.profilesHome, id), this.profilesCacheHome, options, this.defaultProfile);
          await this.fileService.createFolder(profile.location);
          const joiners = [];
          this._onWillCreateProfile.fire({
            profile,
            join(promise) {
              joiners.push(promise);
            }
          });
          await Promises.settled(joiners);
          if (workspace && !URI.isUri(workspace)) {
            this.updateEmptyWindowAssociation(workspace, profile, !!profile.isTransient);
          }
          this.updateProfiles([profile], [], []);
          return profile;
        } finally {
          this.profileCreationPromises.delete(name);
        }
      })();
      this.profileCreationPromises.set(name, profileCreationPromise);
    }
    return profileCreationPromise;
  }
  async updateProfile(profile, options) {
    const profilesToUpdate = [];
    for (const existing of this.profiles) {
      let profileToUpdate;
      if (profile.id === existing.id) {
        if (!existing.isDefault) {
          profileToUpdate = toUserDataProfile(existing.id, options.name ?? existing.name, existing.location, this.profilesCacheHome, {
            icon: options.icon === null ? void 0 : options.icon ?? existing.icon,
            transient: options.transient ?? existing.isTransient,
            useDefaultFlags: options.useDefaultFlags ?? existing.useDefaultFlags,
            workspaces: options.workspaces ?? existing.workspaces
          }, this.defaultProfile);
        } else if (options.workspaces) {
          profileToUpdate = existing;
          profileToUpdate.workspaces = options.workspaces;
        }
      } else if (options.workspaces) {
        const workspaces = existing.workspaces?.filter((w1) => !options.workspaces?.some((w2) => this.uriIdentityService.extUri.isEqual(w1, w2)));
        if (existing.workspaces?.length !== workspaces?.length) {
          profileToUpdate = existing;
          profileToUpdate.workspaces = workspaces;
        }
      }
      if (profileToUpdate) {
        profilesToUpdate.push(profileToUpdate);
      }
    }
    if (!profilesToUpdate.length) {
      if (profile.isDefault) {
        throw new Error("Cannot update default profile");
      }
      throw new Error(`Profile '${profile.name}' does not exist`);
    }
    this.updateProfiles([], [], profilesToUpdate);
    const updatedProfile = this.profiles.find((p) => p.id === profile.id);
    if (!updatedProfile) {
      throw new Error(`Profile '${profile.name}' was not updated`);
    }
    return updatedProfile;
  }
  async removeProfile(profileToRemove) {
    if (profileToRemove.isDefault) {
      throw new Error("Cannot remove default profile");
    }
    const profile = this.profiles.find((p) => p.id === profileToRemove.id);
    if (!profile) {
      throw new Error(`Profile '${profileToRemove.name}' does not exist`);
    }
    const joiners = [];
    this._onWillRemoveProfile.fire({
      profile,
      join(promise) {
        joiners.push(promise);
      }
    });
    try {
      await Promise.allSettled(joiners);
    } catch (error) {
      this.logService.error(error);
    }
    this.updateProfiles([], [profile], []);
    try {
      await this.fileService.del(profile.cacheHome, { recursive: true });
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(error);
      }
    }
  }
  async setProfileForWorkspace(workspaceIdentifier, profileToSet) {
    const profile = this.profiles.find((p) => p.id === profileToSet.id);
    if (!profile) {
      throw new Error(`Profile '${profileToSet.name}' does not exist`);
    }
    const workspace = this.getWorkspace(workspaceIdentifier);
    if (URI.isUri(workspace)) {
      const workspaces = profile.workspaces ? [...profile.workspaces] : [];
      if (!workspaces.some((w) => this.uriIdentityService.extUri.isEqual(w, workspace))) {
        workspaces.push(workspace);
        await this.updateProfile(profile, { workspaces });
      }
    } else {
      this.updateEmptyWindowAssociation(workspace, profile, false);
      this.updateStoredProfiles(this.profiles);
    }
  }
  unsetWorkspace(workspaceIdentifier, transient = false) {
    const workspace = this.getWorkspace(workspaceIdentifier);
    if (URI.isUri(workspace)) {
      const currentlyAssociatedProfile = this.getProfileForWorkspace(workspaceIdentifier);
      if (currentlyAssociatedProfile) {
        this.updateProfile(currentlyAssociatedProfile, { workspaces: currentlyAssociatedProfile.workspaces?.filter((w) => !this.uriIdentityService.extUri.isEqual(w, workspace)) });
      }
    } else {
      this.updateEmptyWindowAssociation(workspace, void 0, transient);
      this.updateStoredProfiles(this.profiles);
    }
  }
  async resetWorkspaces() {
    this.transientProfilesObject.emptyWindows.clear();
    this.profilesObject.emptyWindows.clear();
    for (const profile of this.profiles) {
      profile.workspaces = void 0;
    }
    this.updateProfiles([], [], this.profiles);
    this._onDidResetWorkspaces.fire();
  }
  async cleanUp() {
    if (await this.fileService.exists(this.profilesHome)) {
      const stat = await this.fileService.resolve(this.profilesHome);
      await Promise.all((stat.children || []).filter((child) => child.isDirectory && this.profiles.every((p) => !this.uriIdentityService.extUri.isEqual(p.location, child.resource))).map((child) => this.fileService.del(child.resource, { recursive: true })));
    }
  }
  async cleanUpTransientProfiles() {
    const unAssociatedTransientProfiles = this.transientProfilesObject.profiles.filter((p) => !this.isProfileAssociatedToWorkspace(p));
    await Promise.allSettled(unAssociatedTransientProfiles.map((p) => this.removeProfile(p)));
  }
  getProfileForWorkspace(workspaceIdentifier) {
    const workspace = this.getWorkspace(workspaceIdentifier);
    return URI.isUri(workspace) ? this.profiles.find((p) => p.workspaces?.some((w) => this.uriIdentityService.extUri.isEqual(w, workspace))) : this.profilesObject.emptyWindows.get(workspace) ?? this.transientProfilesObject.emptyWindows.get(workspace);
  }
  getWorkspace(workspaceIdentifier) {
    if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
      return workspaceIdentifier.uri;
    }
    if (isWorkspaceIdentifier(workspaceIdentifier)) {
      return workspaceIdentifier.configPath;
    }
    return workspaceIdentifier.id;
  }
  isProfileAssociatedToWorkspace(profile) {
    if (profile.workspaces?.length) {
      return true;
    }
    if ([...this.profilesObject.emptyWindows.values()].some((windowProfile) => this.uriIdentityService.extUri.isEqual(windowProfile.location, profile.location))) {
      return true;
    }
    if ([...this.transientProfilesObject.emptyWindows.values()].some((windowProfile) => this.uriIdentityService.extUri.isEqual(windowProfile.location, profile.location))) {
      return true;
    }
    return false;
  }
  updateProfiles(added, removed, updated) {
    const allProfiles = [...this.profiles, ...added];
    const transientProfiles = this.transientProfilesObject.profiles;
    this.transientProfilesObject.profiles = [];
    const profiles = [];
    for (let profile of allProfiles) {
      if (removed.some((p) => profile.id === p.id)) {
        for (const windowId of [...this.profilesObject.emptyWindows.keys()]) {
          if (profile.id === this.profilesObject.emptyWindows.get(windowId)?.id) {
            this.profilesObject.emptyWindows.delete(windowId);
          }
        }
        continue;
      }
      if (!profile.isDefault) {
        profile = updated.find((p) => profile.id === p.id) ?? profile;
        const transientProfile = transientProfiles.find((p) => profile.id === p.id);
        if (profile.isTransient) {
          this.transientProfilesObject.profiles.push(profile);
        } else {
          if (transientProfile) {
            for (const [windowId, p] of this.transientProfilesObject.emptyWindows.entries()) {
              if (profile.id === p.id) {
                this.transientProfilesObject.emptyWindows.delete(windowId);
                this.profilesObject.emptyWindows.set(windowId, profile);
                break;
              }
            }
          }
        }
      }
      if (profile.workspaces?.length === 0) {
        profile.workspaces = void 0;
      }
      profiles.push(profile);
    }
    this.updateStoredProfiles(profiles);
    this.triggerProfilesChanges(added, removed, updated);
  }
  triggerProfilesChanges(added, removed, updated) {
    this._onDidChangeProfiles.fire({ added, removed, updated, all: this.profiles });
  }
  updateEmptyWindowAssociation(windowId, newProfile, transient) {
    transient = newProfile?.isTransient ? true : transient;
    if (transient) {
      if (newProfile) {
        this.transientProfilesObject.emptyWindows.set(windowId, newProfile);
      } else {
        this.transientProfilesObject.emptyWindows.delete(windowId);
      }
    } else {
      this.transientProfilesObject.emptyWindows.delete(windowId);
      if (newProfile) {
        this.profilesObject.emptyWindows.set(windowId, newProfile);
      } else {
        this.profilesObject.emptyWindows.delete(windowId);
      }
    }
  }
  updateStoredProfiles(profiles) {
    const storedProfiles = [];
    const workspaces = {};
    const emptyWindows = {};
    for (const profile of profiles) {
      if (profile.isTransient) {
        continue;
      }
      if (!profile.isDefault) {
        storedProfiles.push({ location: profile.location, name: profile.name, icon: profile.icon, useDefaultFlags: profile.useDefaultFlags });
      }
      if (profile.workspaces) {
        for (const workspace of profile.workspaces) {
          workspaces[workspace.toString()] = profile.id;
        }
      }
    }
    for (const [windowId, profile] of this.profilesObject.emptyWindows.entries()) {
      emptyWindows[windowId.toString()] = profile.id;
    }
    this.saveStoredProfileAssociations({ workspaces, emptyWindows });
    this.saveStoredProfiles(storedProfiles);
    this._profilesObject = void 0;
  }
  getStoredProfiles() {
    return [];
  }
  saveStoredProfiles(storedProfiles) {
    throw new Error("not implemented");
  }
  getStoredProfileAssociations() {
    return {};
  }
  saveStoredProfileAssociations(storedProfileAssociations) {
    throw new Error("not implemented");
  }
  getDefaultProfileExtensionsLocation() {
    return void 0;
  }
};
UserDataProfilesService.PROFILES_KEY = "userDataProfiles";
UserDataProfilesService.PROFILE_ASSOCIATIONS_KEY = "profileAssociations";
UserDataProfilesService = __decorateClass([
  __decorateParam(0, IEnvironmentService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ILogService)
], UserDataProfilesService);
class InMemoryUserDataProfilesService extends UserDataProfilesService {
  constructor() {
    super(...arguments);
    this.storedProfiles = [];
    this.storedProfileAssociations = {};
  }
  getStoredProfiles() {
    return this.storedProfiles;
  }
  saveStoredProfiles(storedProfiles) {
    this.storedProfiles = storedProfiles;
  }
  getStoredProfileAssociations() {
    return this.storedProfileAssociations;
  }
  saveStoredProfileAssociations(storedProfileAssociations) {
    this.storedProfileAssociations = storedProfileAssociations;
  }
}
export {
  IUserDataProfilesService,
  InMemoryUserDataProfilesService,
  ProfileResourceType,
  UserDataProfilesService,
  isUserDataProfile,
  reviveProfile,
  toUserDataProfile
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlEdG8gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uUmVzdWx0LCBJRmlsZVNlcnZpY2UsIHRvRmlsZU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUFueVdvcmtzcGFjZUlkZW50aWZpZXIsIGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZywgTXV0YWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcblxuZXhwb3J0IGNvbnN0IGVudW0gUHJvZmlsZVJlc291cmNlVHlwZSB7XG5cdFNldHRpbmdzID0gJ3NldHRpbmdzJyxcblx0S2V5YmluZGluZ3MgPSAna2V5YmluZGluZ3MnLFxuXHRTbmlwcGV0cyA9ICdzbmlwcGV0cycsXG5cdFByb21wdHMgPSAncHJvbXB0cycsXG5cdFRhc2tzID0gJ3Rhc2tzJyxcblx0RXh0ZW5zaW9ucyA9ICdleHRlbnNpb25zJyxcblx0R2xvYmFsU3RhdGUgPSAnZ2xvYmFsU3RhdGUnLFxufVxuXG4vKipcbiAqIEZsYWdzIHRvIGluZGljYXRlIHdoZXRoZXIgdG8gdXNlIHRoZSBkZWZhdWx0IHByb2ZpbGUgb3Igbm90LlxuICovXG5leHBvcnQgdHlwZSBVc2VEZWZhdWx0UHJvZmlsZUZsYWdzID0geyBba2V5IGluIFByb2ZpbGVSZXNvdXJjZVR5cGVdPzogYm9vbGVhbiB9O1xuZXhwb3J0IHR5cGUgUHJvZmlsZVJlc291cmNlVHlwZUZsYWdzID0gVXNlRGVmYXVsdFByb2ZpbGVGbGFncztcblxuZXhwb3J0IGludGVyZmFjZSBJVXNlckRhdGFQcm9maWxlIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgaXNEZWZhdWx0OiBib29sZWFuO1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGljb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGxvY2F0aW9uOiBVUkk7XG5cdHJlYWRvbmx5IGdsb2JhbFN0b3JhZ2VIb21lOiBVUkk7XG5cdHJlYWRvbmx5IHNldHRpbmdzUmVzb3VyY2U6IFVSSTtcblx0cmVhZG9ubHkga2V5YmluZGluZ3NSZXNvdXJjZTogVVJJO1xuXHRyZWFkb25seSB0YXNrc1Jlc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IHNuaXBwZXRzSG9tZTogVVJJO1xuXHRyZWFkb25seSBwcm9tcHRzSG9tZTogVVJJO1xuXHRyZWFkb25seSBleHRlbnNpb25zUmVzb3VyY2U6IFVSSTtcblx0cmVhZG9ubHkgY2FjaGVIb21lOiBVUkk7XG5cdHJlYWRvbmx5IHVzZURlZmF1bHRGbGFncz86IFVzZURlZmF1bHRQcm9maWxlRmxhZ3M7XG5cdHJlYWRvbmx5IGlzVHJhbnNpZW50PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgd29ya3NwYWNlcz86IHJlYWRvbmx5IFVSSVtdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNVc2VyRGF0YVByb2ZpbGUodGhpbmc6IHVua25vd24pOiB0aGluZyBpcyBJVXNlckRhdGFQcm9maWxlIHtcblx0Y29uc3QgY2FuZGlkYXRlID0gdGhpbmcgYXMgSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZDtcblxuXHRyZXR1cm4gISEoY2FuZGlkYXRlICYmIHR5cGVvZiBjYW5kaWRhdGUgPT09ICdvYmplY3QnXG5cdFx0JiYgdHlwZW9mIGNhbmRpZGF0ZS5pZCA9PT0gJ3N0cmluZydcblx0XHQmJiB0eXBlb2YgY2FuZGlkYXRlLmlzRGVmYXVsdCA9PT0gJ2Jvb2xlYW4nXG5cdFx0JiYgdHlwZW9mIGNhbmRpZGF0ZS5uYW1lID09PSAnc3RyaW5nJ1xuXHRcdCYmIFVSSS5pc1VyaShjYW5kaWRhdGUubG9jYXRpb24pXG5cdFx0JiYgVVJJLmlzVXJpKGNhbmRpZGF0ZS5nbG9iYWxTdG9yYWdlSG9tZSlcblx0XHQmJiBVUkkuaXNVcmkoY2FuZGlkYXRlLnNldHRpbmdzUmVzb3VyY2UpXG5cdFx0JiYgVVJJLmlzVXJpKGNhbmRpZGF0ZS5rZXliaW5kaW5nc1Jlc291cmNlKVxuXHRcdCYmIFVSSS5pc1VyaShjYW5kaWRhdGUudGFza3NSZXNvdXJjZSlcblx0XHQmJiBVUkkuaXNVcmkoY2FuZGlkYXRlLnNuaXBwZXRzSG9tZSlcblx0XHQmJiBVUkkuaXNVcmkoY2FuZGlkYXRlLnByb21wdHNIb21lKVxuXHRcdCYmIFVSSS5pc1VyaShjYW5kaWRhdGUuZXh0ZW5zaW9uc1Jlc291cmNlKVxuXHQpO1xufVxuXG5leHBvcnQgdHlwZSBEaWRDaGFuZ2VQcm9maWxlc0V2ZW50ID0geyByZWFkb25seSBhZGRlZDogcmVhZG9ubHkgSVVzZXJEYXRhUHJvZmlsZVtdOyByZWFkb25seSByZW1vdmVkOiByZWFkb25seSBJVXNlckRhdGFQcm9maWxlW107IHJlYWRvbmx5IHVwZGF0ZWQ6IHJlYWRvbmx5IElVc2VyRGF0YVByb2ZpbGVbXTsgcmVhZG9ubHkgYWxsOiByZWFkb25seSBJVXNlckRhdGFQcm9maWxlW10gfTtcblxuZXhwb3J0IHR5cGUgV2lsbENyZWF0ZVByb2ZpbGVFdmVudCA9IHtcblx0cHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZTtcblx0am9pbihwcm9taXNlOiBQcm9taXNlPHZvaWQ+KTogdm9pZDtcbn07XG5cbmV4cG9ydCB0eXBlIFdpbGxSZW1vdmVQcm9maWxlRXZlbnQgPSB7XG5cdHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGU7XG5cdGpvaW4ocHJvbWlzZTogUHJvbWlzZTx2b2lkPik6IHZvaWQ7XG59O1xuXG5leHBvcnQgaW50ZXJmYWNlIElVc2VyRGF0YVByb2ZpbGVPcHRpb25zIHtcblx0cmVhZG9ubHkgaWNvbj86IHN0cmluZztcblx0cmVhZG9ubHkgdXNlRGVmYXVsdEZsYWdzPzogVXNlRGVmYXVsdFByb2ZpbGVGbGFncztcblx0cmVhZG9ubHkgdHJhbnNpZW50PzogYm9vbGVhbjtcblx0cmVhZG9ubHkgd29ya3NwYWNlcz86IHJlYWRvbmx5IFVSSVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElVc2VyRGF0YVByb2ZpbGVVcGRhdGVPcHRpb25zIGV4dGVuZHMgT21pdDxJVXNlckRhdGFQcm9maWxlT3B0aW9ucywgJ2ljb24nPiB7XG5cdHJlYWRvbmx5IG5hbWU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGljb24/OiBzdHJpbmcgfCBudWxsO1xufVxuXG5leHBvcnQgY29uc3QgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElVc2VyRGF0YVByb2ZpbGVzU2VydmljZT4oJ0lVc2VyRGF0YVByb2ZpbGVzU2VydmljZScpO1xuZXhwb3J0IGludGVyZmFjZSBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgcHJvZmlsZXNIb21lOiBVUkk7XG5cdHJlYWRvbmx5IGRlZmF1bHRQcm9maWxlOiBJVXNlckRhdGFQcm9maWxlO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUHJvZmlsZXM6IEV2ZW50PERpZENoYW5nZVByb2ZpbGVzRXZlbnQ+O1xuXHRyZWFkb25seSBwcm9maWxlczogcmVhZG9ubHkgSVVzZXJEYXRhUHJvZmlsZVtdO1xuXG5cdHJlYWRvbmx5IG9uRGlkUmVzZXRXb3Jrc3BhY2VzOiBFdmVudDx2b2lkPjtcblxuXHRjcmVhdGVOYW1lZFByb2ZpbGUobmFtZTogc3RyaW5nLCBvcHRpb25zPzogSVVzZXJEYXRhUHJvZmlsZU9wdGlvbnMsIHdvcmtzcGFjZUlkZW50aWZpZXI/OiBJQW55V29ya3NwYWNlSWRlbnRpZmllcik6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZT47XG5cdGNyZWF0ZVRyYW5zaWVudFByb2ZpbGUod29ya3NwYWNlSWRlbnRpZmllcj86IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPjtcblx0Y3JlYXRlUHJvZmlsZShpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiBJVXNlckRhdGFQcm9maWxlT3B0aW9ucywgd29ya3NwYWNlSWRlbnRpZmllcj86IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPjtcblx0dXBkYXRlUHJvZmlsZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLCBvcHRpb25zPzogSVVzZXJEYXRhUHJvZmlsZVVwZGF0ZU9wdGlvbnMsKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPjtcblx0cmVtb3ZlUHJvZmlsZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPjtcblxuXHRzZXRQcm9maWxlRm9yV29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXI6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyLCBwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPjtcblx0cmVzZXRXb3Jrc3BhY2VzKCk6IFByb21pc2U8dm9pZD47XG5cblx0Y2xlYW5VcCgpOiBQcm9taXNlPHZvaWQ+O1xuXHRjbGVhblVwVHJhbnNpZW50UHJvZmlsZXMoKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJldml2ZVByb2ZpbGUocHJvZmlsZTogVXJpRHRvPElVc2VyRGF0YVByb2ZpbGU+LCBzY2hlbWU6IHN0cmluZyk6IElVc2VyRGF0YVByb2ZpbGUge1xuXHRyZXR1cm4ge1xuXHRcdGlkOiBwcm9maWxlLmlkLFxuXHRcdGlzRGVmYXVsdDogcHJvZmlsZS5pc0RlZmF1bHQsXG5cdFx0bmFtZTogcHJvZmlsZS5uYW1lLFxuXHRcdGljb246IHByb2ZpbGUuaWNvbixcblx0XHRsb2NhdGlvbjogVVJJLnJldml2ZShwcm9maWxlLmxvY2F0aW9uKS53aXRoKHsgc2NoZW1lIH0pLFxuXHRcdGdsb2JhbFN0b3JhZ2VIb21lOiBVUkkucmV2aXZlKHByb2ZpbGUuZ2xvYmFsU3RvcmFnZUhvbWUpLndpdGgoeyBzY2hlbWUgfSksXG5cdFx0c2V0dGluZ3NSZXNvdXJjZTogVVJJLnJldml2ZShwcm9maWxlLnNldHRpbmdzUmVzb3VyY2UpLndpdGgoeyBzY2hlbWUgfSksXG5cdFx0a2V5YmluZGluZ3NSZXNvdXJjZTogVVJJLnJldml2ZShwcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UpLndpdGgoeyBzY2hlbWUgfSksXG5cdFx0dGFza3NSZXNvdXJjZTogVVJJLnJldml2ZShwcm9maWxlLnRhc2tzUmVzb3VyY2UpLndpdGgoeyBzY2hlbWUgfSksXG5cdFx0c25pcHBldHNIb21lOiBVUkkucmV2aXZlKHByb2ZpbGUuc25pcHBldHNIb21lKS53aXRoKHsgc2NoZW1lIH0pLFxuXHRcdHByb21wdHNIb21lOiBVUkkucmV2aXZlKHByb2ZpbGUucHJvbXB0c0hvbWUpLndpdGgoeyBzY2hlbWUgfSksXG5cdFx0ZXh0ZW5zaW9uc1Jlc291cmNlOiBVUkkucmV2aXZlKHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKS53aXRoKHsgc2NoZW1lIH0pLFxuXHRcdGNhY2hlSG9tZTogVVJJLnJldml2ZShwcm9maWxlLmNhY2hlSG9tZSkud2l0aCh7IHNjaGVtZSB9KSxcblx0XHR1c2VEZWZhdWx0RmxhZ3M6IHByb2ZpbGUudXNlRGVmYXVsdEZsYWdzLFxuXHRcdGlzVHJhbnNpZW50OiBwcm9maWxlLmlzVHJhbnNpZW50LFxuXHRcdHdvcmtzcGFjZXM6IHByb2ZpbGUud29ya3NwYWNlcz8ubWFwKHcgPT4gVVJJLnJldml2ZSh3KSksXG5cdH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1VzZXJEYXRhUHJvZmlsZShpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIGxvY2F0aW9uOiBVUkksIHByb2ZpbGVzQ2FjaGVIb21lOiBVUkksIG9wdGlvbnM/OiBJVXNlckRhdGFQcm9maWxlT3B0aW9ucywgZGVmYXVsdFByb2ZpbGU/OiBJVXNlckRhdGFQcm9maWxlKTogSVVzZXJEYXRhUHJvZmlsZSB7XG5cdHJldHVybiB7XG5cdFx0aWQsXG5cdFx0bmFtZSxcblx0XHRsb2NhdGlvbixcblx0XHRpc0RlZmF1bHQ6IGZhbHNlLFxuXHRcdGljb246IG9wdGlvbnM/Lmljb24sXG5cdFx0Z2xvYmFsU3RvcmFnZUhvbWU6IGRlZmF1bHRQcm9maWxlICYmIG9wdGlvbnM/LnVzZURlZmF1bHRGbGFncz8uZ2xvYmFsU3RhdGUgPyBkZWZhdWx0UHJvZmlsZS5nbG9iYWxTdG9yYWdlSG9tZSA6IGpvaW5QYXRoKGxvY2F0aW9uLCAnZ2xvYmFsU3RvcmFnZScpLFxuXHRcdHNldHRpbmdzUmVzb3VyY2U6IGRlZmF1bHRQcm9maWxlICYmIG9wdGlvbnM/LnVzZURlZmF1bHRGbGFncz8uc2V0dGluZ3MgPyBkZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlIDogam9pblBhdGgobG9jYXRpb24sICdzZXR0aW5ncy5qc29uJyksXG5cdFx0a2V5YmluZGluZ3NSZXNvdXJjZTogZGVmYXVsdFByb2ZpbGUgJiYgb3B0aW9ucz8udXNlRGVmYXVsdEZsYWdzPy5rZXliaW5kaW5ncyA/IGRlZmF1bHRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UgOiBqb2luUGF0aChsb2NhdGlvbiwgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0XHR0YXNrc1Jlc291cmNlOiBkZWZhdWx0UHJvZmlsZSAmJiBvcHRpb25zPy51c2VEZWZhdWx0RmxhZ3M/LnRhc2tzID8gZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZSA6IGpvaW5QYXRoKGxvY2F0aW9uLCAndGFza3MuanNvbicpLFxuXHRcdHNuaXBwZXRzSG9tZTogZGVmYXVsdFByb2ZpbGUgJiYgb3B0aW9ucz8udXNlRGVmYXVsdEZsYWdzPy5zbmlwcGV0cyA/IGRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSA6IGpvaW5QYXRoKGxvY2F0aW9uLCAnc25pcHBldHMnKSxcblx0XHRwcm9tcHRzSG9tZTogZGVmYXVsdFByb2ZpbGUgJiYgb3B0aW9ucz8udXNlRGVmYXVsdEZsYWdzPy5wcm9tcHRzID8gZGVmYXVsdFByb2ZpbGUucHJvbXB0c0hvbWUgOiBqb2luUGF0aChsb2NhdGlvbiwgJ3Byb21wdHMnKSxcblx0XHRleHRlbnNpb25zUmVzb3VyY2U6IGRlZmF1bHRQcm9maWxlICYmIG9wdGlvbnM/LnVzZURlZmF1bHRGbGFncz8uZXh0ZW5zaW9ucyA/IGRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSA6IGpvaW5QYXRoKGxvY2F0aW9uLCAnZXh0ZW5zaW9ucy5qc29uJyksXG5cdFx0Y2FjaGVIb21lOiBqb2luUGF0aChwcm9maWxlc0NhY2hlSG9tZSwgaWQpLFxuXHRcdHVzZURlZmF1bHRGbGFnczogb3B0aW9ucz8udXNlRGVmYXVsdEZsYWdzLFxuXHRcdGlzVHJhbnNpZW50OiBvcHRpb25zPy50cmFuc2llbnQsXG5cdFx0d29ya3NwYWNlczogb3B0aW9ucz8ud29ya3NwYWNlcyxcblx0fTtcbn1cblxuZXhwb3J0IHR5cGUgVXNlckRhdGFQcm9maWxlc09iamVjdCA9IHtcblx0cHJvZmlsZXM6IElVc2VyRGF0YVByb2ZpbGVbXTtcblx0ZW1wdHlXaW5kb3dzOiBNYXA8c3RyaW5nLCBJVXNlckRhdGFQcm9maWxlPjtcbn07XG5cbmV4cG9ydCB0eXBlIFN0b3JlZFVzZXJEYXRhUHJvZmlsZSA9IHtcblx0bmFtZTogc3RyaW5nO1xuXHRsb2NhdGlvbjogVVJJO1xuXHRpY29uPzogc3RyaW5nO1xuXHR1c2VEZWZhdWx0RmxhZ3M/OiBVc2VEZWZhdWx0UHJvZmlsZUZsYWdzO1xufTtcblxuZXhwb3J0IHR5cGUgU3RvcmVkUHJvZmlsZUFzc29jaWF0aW9ucyA9IHtcblx0d29ya3NwYWNlcz86IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz47XG5cdGVtcHR5V2luZG93cz86IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz47XG59O1xuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHtcblxuXHRwcm90ZWN0ZWQgc3RhdGljIHJlYWRvbmx5IFBST0ZJTEVTX0tFWSA9ICd1c2VyRGF0YVByb2ZpbGVzJztcblx0cHJvdGVjdGVkIHN0YXRpYyByZWFkb25seSBQUk9GSUxFX0FTU09DSUFUSU9OU19LRVkgPSAncHJvZmlsZUFzc29jaWF0aW9ucyc7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IHByb2ZpbGVzSG9tZTogVVJJO1xuXHRwcml2YXRlIHJlYWRvbmx5IHByb2ZpbGVzQ2FjaGVIb21lOiBVUkk7XG5cblx0Z2V0IGRlZmF1bHRQcm9maWxlKCk6IElVc2VyRGF0YVByb2ZpbGUgeyByZXR1cm4gdGhpcy5wcm9maWxlc1swXTsgfVxuXHRnZXQgcHJvZmlsZXMoKTogSVVzZXJEYXRhUHJvZmlsZVtdIHsgcmV0dXJuIFsuLi50aGlzLnByb2ZpbGVzT2JqZWN0LnByb2ZpbGVzLCAuLi50aGlzLnRyYW5zaWVudFByb2ZpbGVzT2JqZWN0LnByb2ZpbGVzXTsgfVxuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VQcm9maWxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERpZENoYW5nZVByb2ZpbGVzRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVByb2ZpbGVzID0gdGhpcy5fb25EaWRDaGFuZ2VQcm9maWxlcy5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uV2lsbENyZWF0ZVByb2ZpbGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxXaWxsQ3JlYXRlUHJvZmlsZUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25XaWxsQ3JlYXRlUHJvZmlsZSA9IHRoaXMuX29uV2lsbENyZWF0ZVByb2ZpbGUuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbldpbGxSZW1vdmVQcm9maWxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8V2lsbFJlbW92ZVByb2ZpbGVFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbFJlbW92ZVByb2ZpbGUgPSB0aGlzLl9vbldpbGxSZW1vdmVQcm9maWxlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVzZXRXb3Jrc3BhY2VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVzZXRXb3Jrc3BhY2VzID0gdGhpcy5fb25EaWRSZXNldFdvcmtzcGFjZXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSBwcm9maWxlQ3JlYXRpb25Qcm9taXNlcyA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGU+PigpO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSB0cmFuc2llbnRQcm9maWxlc09iamVjdDogVXNlckRhdGFQcm9maWxlc09iamVjdCA9IHtcblx0XHRwcm9maWxlczogW10sXG5cdFx0ZW1wdHlXaW5kb3dzOiBuZXcgTWFwKClcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5wcm9maWxlc0hvbWUgPSBqb2luUGF0aCh0aGlzLmVudmlyb25tZW50U2VydmljZS51c2VyUm9hbWluZ0RhdGFIb21lLCAncHJvZmlsZXMnKTtcblx0XHR0aGlzLnByb2ZpbGVzQ2FjaGVIb21lID0gam9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuY2FjaGVIb21lLCAnQ2FjaGVkUHJvZmlsZXNEYXRhJyk7XG5cdH1cblxuXHRpbml0KCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb2ZpbGVzT2JqZWN0ID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9wcm9maWxlc09iamVjdDogVXNlckRhdGFQcm9maWxlc09iamVjdCB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIGdldCBwcm9maWxlc09iamVjdCgpOiBVc2VyRGF0YVByb2ZpbGVzT2JqZWN0IHtcblx0XHRpZiAoIXRoaXMuX3Byb2ZpbGVzT2JqZWN0KSB7XG5cdFx0XHRjb25zdCBkZWZhdWx0UHJvZmlsZSA9IHRoaXMuY3JlYXRlRGVmYXVsdFByb2ZpbGUoKTtcblx0XHRcdGNvbnN0IHByb2ZpbGVzOiBBcnJheTxNdXRhYmxlPElVc2VyRGF0YVByb2ZpbGU+PiA9IFtkZWZhdWx0UHJvZmlsZV07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN0b3JlZFByb2ZpbGUgb2YgdGhpcy5nZXRTdG9yZWRQcm9maWxlcygpKSB7XG5cdFx0XHRcdFx0aWYgKCFzdG9yZWRQcm9maWxlLm5hbWUgfHwgIWlzU3RyaW5nKHN0b3JlZFByb2ZpbGUubmFtZSkgfHwgIXN0b3JlZFByb2ZpbGUubG9jYXRpb24pIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdTa2lwcGluZyB0aGUgaW52YWxpZCBzdG9yZWQgcHJvZmlsZScsIHN0b3JlZFByb2ZpbGUubG9jYXRpb24gfHwgc3RvcmVkUHJvZmlsZS5uYW1lKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcm9maWxlcy5wdXNoKHRvVXNlckRhdGFQcm9maWxlKGJhc2VuYW1lKHN0b3JlZFByb2ZpbGUubG9jYXRpb24pLCBzdG9yZWRQcm9maWxlLm5hbWUsIHN0b3JlZFByb2ZpbGUubG9jYXRpb24sIHRoaXMucHJvZmlsZXNDYWNoZUhvbWUsIHsgaWNvbjogc3RvcmVkUHJvZmlsZS5pY29uLCB1c2VEZWZhdWx0RmxhZ3M6IHN0b3JlZFByb2ZpbGUudXNlRGVmYXVsdEZsYWdzIH0sIGRlZmF1bHRQcm9maWxlKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbXB0eVdpbmRvd3MgPSBuZXcgTWFwPHN0cmluZywgSVVzZXJEYXRhUHJvZmlsZT4oKTtcblx0XHRcdGlmIChwcm9maWxlcy5sZW5ndGgpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBwcm9maWxlQXNzb2NpYWl0aW9ucyA9IHRoaXMuZ2V0U3RvcmVkUHJvZmlsZUFzc29jaWF0aW9ucygpO1xuXHRcdFx0XHRcdGlmIChwcm9maWxlQXNzb2NpYWl0aW9ucy53b3Jrc3BhY2VzKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IFt3b3Jrc3BhY2VQYXRoLCBwcm9maWxlSWRdIG9mIE9iamVjdC5lbnRyaWVzKHByb2ZpbGVBc3NvY2lhaXRpb25zLndvcmtzcGFjZXMpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZSA9IFVSSS5wYXJzZSh3b3Jrc3BhY2VQYXRoKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvZmlsZSA9IHByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSBwcm9maWxlSWQpO1xuXHRcdFx0XHRcdFx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZXMgPSBwcm9maWxlLndvcmtzcGFjZXMgPyBwcm9maWxlLndvcmtzcGFjZXMuc2xpY2UoMCkgOiBbXTtcblx0XHRcdFx0XHRcdFx0XHR3b3Jrc3BhY2VzLnB1c2god29ya3NwYWNlKTtcblx0XHRcdFx0XHRcdFx0XHRwcm9maWxlLndvcmtzcGFjZXMgPSB3b3Jrc3BhY2VzO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChwcm9maWxlQXNzb2NpYWl0aW9ucy5lbXB0eVdpbmRvd3MpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgW3dpbmRvd0lkLCBwcm9maWxlSWRdIG9mIE9iamVjdC5lbnRyaWVzKHByb2ZpbGVBc3NvY2lhaXRpb25zLmVtcHR5V2luZG93cykpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgcHJvZmlsZSA9IHByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSBwcm9maWxlSWQpO1xuXHRcdFx0XHRcdFx0XHRpZiAocHJvZmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdGVtcHR5V2luZG93cy5zZXQod2luZG93SWQsIHByb2ZpbGUpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX3Byb2ZpbGVzT2JqZWN0ID0geyBwcm9maWxlcywgZW1wdHlXaW5kb3dzIH07XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcm9maWxlc09iamVjdDtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRGVmYXVsdFByb2ZpbGUoKSB7XG5cdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGUgPSB0b1VzZXJEYXRhUHJvZmlsZSgnX19kZWZhdWx0X19wcm9maWxlX18nLCBsb2NhbGl6ZSgnZGVmYXVsdFByb2ZpbGUnLCBcIkRlZmF1bHRcIiksIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJSb2FtaW5nRGF0YUhvbWUsIHRoaXMucHJvZmlsZXNDYWNoZUhvbWUpO1xuXHRcdHJldHVybiB7IC4uLmRlZmF1bHRQcm9maWxlLCBleHRlbnNpb25zUmVzb3VyY2U6IHRoaXMuZ2V0RGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zTG9jYXRpb24oKSA/PyBkZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UsIGlzRGVmYXVsdDogdHJ1ZSB9O1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlVHJhbnNpZW50UHJvZmlsZSh3b3Jrc3BhY2VJZGVudGlmaWVyPzogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIpOiBQcm9taXNlPElVc2VyRGF0YVByb2ZpbGU+IHtcblx0XHRjb25zdCBuYW1lUHJlZml4ID0gYFRlbXBgO1xuXHRcdGNvbnN0IG5hbWVSZWdFeCA9IG5ldyBSZWdFeHAoYCR7ZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhuYW1lUHJlZml4KX1cXFxccyhcXFxcZCspYCk7XG5cdFx0bGV0IG5hbWVJbmRleCA9IDA7XG5cdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHRoaXMucHJvZmlsZXMpIHtcblx0XHRcdGNvbnN0IG1hdGNoZXMgPSBuYW1lUmVnRXguZXhlYyhwcm9maWxlLm5hbWUpO1xuXHRcdFx0Y29uc3QgaW5kZXggPSBtYXRjaGVzID8gcGFyc2VJbnQobWF0Y2hlc1sxXSkgOiAwO1xuXHRcdFx0bmFtZUluZGV4ID0gaW5kZXggPiBuYW1lSW5kZXggPyBpbmRleCA6IG5hbWVJbmRleDtcblx0XHR9XG5cdFx0Y29uc3QgbmFtZSA9IGAke25hbWVQcmVmaXh9ICR7bmFtZUluZGV4ICsgMX1gO1xuXHRcdHJldHVybiB0aGlzLmNyZWF0ZVByb2ZpbGUoaGFzaChnZW5lcmF0ZVV1aWQoKSkudG9TdHJpbmcoMTYpLCBuYW1lLCB7IHRyYW5zaWVudDogdHJ1ZSB9LCB3b3Jrc3BhY2VJZGVudGlmaWVyKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZU5hbWVkUHJvZmlsZShuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiBJVXNlckRhdGFQcm9maWxlT3B0aW9ucywgd29ya3NwYWNlSWRlbnRpZmllcj86IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPiB7XG5cdFx0cmV0dXJuIHRoaXMuY3JlYXRlUHJvZmlsZShoYXNoKGdlbmVyYXRlVXVpZCgpKS50b1N0cmluZygxNiksIG5hbWUsIG9wdGlvbnMsIHdvcmtzcGFjZUlkZW50aWZpZXIpO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlUHJvZmlsZShpZDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIG9wdGlvbnM/OiBJVXNlckRhdGFQcm9maWxlT3B0aW9ucywgd29ya3NwYWNlSWRlbnRpZmllcj86IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxJVXNlckRhdGFQcm9maWxlPiB7XG5cdFx0Y29uc3QgcHJvZmlsZSA9IGF3YWl0IHRoaXMuZG9DcmVhdGVQcm9maWxlKGlkLCBuYW1lLCBvcHRpb25zLCB3b3Jrc3BhY2VJZGVudGlmaWVyKTtcblxuXHRcdHJldHVybiBwcm9maWxlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0NyZWF0ZVByb2ZpbGUoaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBvcHRpb25zPzogSVVzZXJEYXRhUHJvZmlsZU9wdGlvbnMsIHdvcmtzcGFjZUlkZW50aWZpZXI/OiBJQW55V29ya3NwYWNlSWRlbnRpZmllcik6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZT4ge1xuXHRcdGlmICghaXNTdHJpbmcobmFtZSkgfHwgIW5hbWUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTmFtZSBvZiB0aGUgcHJvZmlsZSBpcyBtYW5kYXRvcnkgYW5kIG11c3QgYmUgb2YgdHlwZSBgc3RyaW5nYCcpO1xuXHRcdH1cblxuXHRcdGxldCBwcm9maWxlQ3JlYXRpb25Qcm9taXNlID0gdGhpcy5wcm9maWxlQ3JlYXRpb25Qcm9taXNlcy5nZXQobmFtZSk7XG5cdFx0aWYgKCFwcm9maWxlQ3JlYXRpb25Qcm9taXNlKSB7XG5cdFx0XHRwcm9maWxlQ3JlYXRpb25Qcm9taXNlID0gKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IGlkIHx8ICghcC5pc1RyYW5zaWVudCAmJiAhb3B0aW9ucz8udHJhbnNpZW50ICYmIHAubmFtZSA9PT0gbmFtZSkpO1xuXHRcdFx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBQcm9maWxlIHdpdGggJHtuYW1lfSBuYW1lIGFscmVhZHkgZXhpc3RzYCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlID0gd29ya3NwYWNlSWRlbnRpZmllciA/IHRoaXMuZ2V0V29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXIpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmIChVUkkuaXNVcmkod29ya3NwYWNlKSkge1xuXHRcdFx0XHRcdFx0b3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgd29ya3NwYWNlczogW3dvcmtzcGFjZV0gfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcHJvZmlsZSA9IHRvVXNlckRhdGFQcm9maWxlKGlkLCBuYW1lLCBqb2luUGF0aCh0aGlzLnByb2ZpbGVzSG9tZSwgaWQpLCB0aGlzLnByb2ZpbGVzQ2FjaGVIb21lLCBvcHRpb25zLCB0aGlzLmRlZmF1bHRQcm9maWxlKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihwcm9maWxlLmxvY2F0aW9uKTtcblxuXHRcdFx0XHRcdGNvbnN0IGpvaW5lcnM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdFx0XHRcdHRoaXMuX29uV2lsbENyZWF0ZVByb2ZpbGUuZmlyZSh7XG5cdFx0XHRcdFx0XHRwcm9maWxlLFxuXHRcdFx0XHRcdFx0am9pbihwcm9taXNlKSB7XG5cdFx0XHRcdFx0XHRcdGpvaW5lcnMucHVzaChwcm9taXNlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKGpvaW5lcnMpO1xuXG5cdFx0XHRcdFx0aWYgKHdvcmtzcGFjZSAmJiAhVVJJLmlzVXJpKHdvcmtzcGFjZSkpIHtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlRW1wdHlXaW5kb3dBc3NvY2lhdGlvbih3b3Jrc3BhY2UsIHByb2ZpbGUsICEhcHJvZmlsZS5pc1RyYW5zaWVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMudXBkYXRlUHJvZmlsZXMoW3Byb2ZpbGVdLCBbXSwgW10pO1xuXHRcdFx0XHRcdHJldHVybiBwcm9maWxlO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdHRoaXMucHJvZmlsZUNyZWF0aW9uUHJvbWlzZXMuZGVsZXRlKG5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSgpO1xuXHRcdFx0dGhpcy5wcm9maWxlQ3JlYXRpb25Qcm9taXNlcy5zZXQobmFtZSwgcHJvZmlsZUNyZWF0aW9uUHJvbWlzZSk7XG5cdFx0fVxuXHRcdHJldHVybiBwcm9maWxlQ3JlYXRpb25Qcm9taXNlO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlUHJvZmlsZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLCBvcHRpb25zOiBJVXNlckRhdGFQcm9maWxlVXBkYXRlT3B0aW9ucyk6IFByb21pc2U8SVVzZXJEYXRhUHJvZmlsZT4ge1xuXHRcdGNvbnN0IHByb2ZpbGVzVG9VcGRhdGU6IElVc2VyRGF0YVByb2ZpbGVbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZXhpc3Rpbmcgb2YgdGhpcy5wcm9maWxlcykge1xuXHRcdFx0bGV0IHByb2ZpbGVUb1VwZGF0ZTogTXV0YWJsZTxJVXNlckRhdGFQcm9maWxlPiB8IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHByb2ZpbGUuaWQgPT09IGV4aXN0aW5nLmlkKSB7XG5cdFx0XHRcdGlmICghZXhpc3RpbmcuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdFx0cHJvZmlsZVRvVXBkYXRlID0gdG9Vc2VyRGF0YVByb2ZpbGUoZXhpc3RpbmcuaWQsIG9wdGlvbnMubmFtZSA/PyBleGlzdGluZy5uYW1lLCBleGlzdGluZy5sb2NhdGlvbiwgdGhpcy5wcm9maWxlc0NhY2hlSG9tZSwge1xuXHRcdFx0XHRcdFx0aWNvbjogb3B0aW9ucy5pY29uID09PSBudWxsID8gdW5kZWZpbmVkIDogb3B0aW9ucy5pY29uID8/IGV4aXN0aW5nLmljb24sXG5cdFx0XHRcdFx0XHR0cmFuc2llbnQ6IG9wdGlvbnMudHJhbnNpZW50ID8/IGV4aXN0aW5nLmlzVHJhbnNpZW50LFxuXHRcdFx0XHRcdFx0dXNlRGVmYXVsdEZsYWdzOiBvcHRpb25zLnVzZURlZmF1bHRGbGFncyA/PyBleGlzdGluZy51c2VEZWZhdWx0RmxhZ3MsXG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2VzOiBvcHRpb25zLndvcmtzcGFjZXMgPz8gZXhpc3Rpbmcud29ya3NwYWNlcyxcblx0XHRcdFx0XHR9LCB0aGlzLmRlZmF1bHRQcm9maWxlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChvcHRpb25zLndvcmtzcGFjZXMpIHtcblx0XHRcdFx0XHRwcm9maWxlVG9VcGRhdGUgPSBleGlzdGluZztcblx0XHRcdFx0XHRwcm9maWxlVG9VcGRhdGUud29ya3NwYWNlcyA9IG9wdGlvbnMud29ya3NwYWNlcztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRlbHNlIGlmIChvcHRpb25zLndvcmtzcGFjZXMpIHtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlcyA9IGV4aXN0aW5nLndvcmtzcGFjZXM/LmZpbHRlcih3MSA9PiAhb3B0aW9ucy53b3Jrc3BhY2VzPy5zb21lKHcyID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHcxLCB3MikpKTtcblx0XHRcdFx0aWYgKGV4aXN0aW5nLndvcmtzcGFjZXM/Lmxlbmd0aCAhPT0gd29ya3NwYWNlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cHJvZmlsZVRvVXBkYXRlID0gZXhpc3Rpbmc7XG5cdFx0XHRcdFx0cHJvZmlsZVRvVXBkYXRlLndvcmtzcGFjZXMgPSB3b3Jrc3BhY2VzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChwcm9maWxlVG9VcGRhdGUpIHtcblx0XHRcdFx0cHJvZmlsZXNUb1VwZGF0ZS5wdXNoKHByb2ZpbGVUb1VwZGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFwcm9maWxlc1RvVXBkYXRlLmxlbmd0aCkge1xuXHRcdFx0aWYgKHByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVwZGF0ZSBkZWZhdWx0IHByb2ZpbGUnKTtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBFcnJvcihgUHJvZmlsZSAnJHtwcm9maWxlLm5hbWV9JyBkb2VzIG5vdCBleGlzdGApO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlUHJvZmlsZXMoW10sIFtdLCBwcm9maWxlc1RvVXBkYXRlKTtcblxuXHRcdGNvbnN0IHVwZGF0ZWRQcm9maWxlID0gdGhpcy5wcm9maWxlcy5maW5kKHAgPT4gcC5pZCA9PT0gcHJvZmlsZS5pZCk7XG5cdFx0aWYgKCF1cGRhdGVkUHJvZmlsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBQcm9maWxlICcke3Byb2ZpbGUubmFtZX0nIHdhcyBub3QgdXBkYXRlZGApO1xuXHRcdH1cblxuXHRcdHJldHVybiB1cGRhdGVkUHJvZmlsZTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZVByb2ZpbGUocHJvZmlsZVRvUmVtb3ZlOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHByb2ZpbGVUb1JlbW92ZS5pc0RlZmF1bHQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHJlbW92ZSBkZWZhdWx0IHByb2ZpbGUnKTtcblx0XHR9XG5cdFx0Y29uc3QgcHJvZmlsZSA9IHRoaXMucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHByb2ZpbGVUb1JlbW92ZS5pZCk7XG5cdFx0aWYgKCFwcm9maWxlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFByb2ZpbGUgJyR7cHJvZmlsZVRvUmVtb3ZlLm5hbWV9JyBkb2VzIG5vdCBleGlzdGApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGpvaW5lcnM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdHRoaXMuX29uV2lsbFJlbW92ZVByb2ZpbGUuZmlyZSh7XG5cdFx0XHRwcm9maWxlLFxuXHRcdFx0am9pbihwcm9taXNlKSB7XG5cdFx0XHRcdGpvaW5lcnMucHVzaChwcm9taXNlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoam9pbmVycyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGVQcm9maWxlcyhbXSwgW3Byb2ZpbGVdLCBbXSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwocHJvZmlsZS5jYWNoZUhvbWUsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNldFByb2ZpbGVGb3JXb3Jrc3BhY2Uod29ya3NwYWNlSWRlbnRpZmllcjogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIsIHByb2ZpbGVUb1NldDogSVVzZXJEYXRhUHJvZmlsZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHByb2ZpbGUgPSB0aGlzLnByb2ZpbGVzLmZpbmQocCA9PiBwLmlkID09PSBwcm9maWxlVG9TZXQuaWQpO1xuXHRcdGlmICghcHJvZmlsZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBQcm9maWxlICcke3Byb2ZpbGVUb1NldC5uYW1lfScgZG9lcyBub3QgZXhpc3RgKTtcblx0XHR9XG5cblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLmdldFdvcmtzcGFjZSh3b3Jrc3BhY2VJZGVudGlmaWVyKTtcblx0XHRpZiAoVVJJLmlzVXJpKHdvcmtzcGFjZSkpIHtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZXMgPSBwcm9maWxlLndvcmtzcGFjZXMgPyBbLi4ucHJvZmlsZS53b3Jrc3BhY2VzXSA6IFtdO1xuXHRcdFx0aWYgKCF3b3Jrc3BhY2VzLnNvbWUodyA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh3LCB3b3Jrc3BhY2UpKSkge1xuXHRcdFx0XHR3b3Jrc3BhY2VzLnB1c2god29ya3NwYWNlKTtcblx0XHRcdFx0YXdhaXQgdGhpcy51cGRhdGVQcm9maWxlKHByb2ZpbGUsIHsgd29ya3NwYWNlcyB9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy51cGRhdGVFbXB0eVdpbmRvd0Fzc29jaWF0aW9uKHdvcmtzcGFjZSwgcHJvZmlsZSwgZmFsc2UpO1xuXHRcdFx0dGhpcy51cGRhdGVTdG9yZWRQcm9maWxlcyh0aGlzLnByb2ZpbGVzKTtcblx0XHR9XG5cdH1cblxuXHR1bnNldFdvcmtzcGFjZSh3b3Jrc3BhY2VJZGVudGlmaWVyOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciwgdHJhbnNpZW50OiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLmdldFdvcmtzcGFjZSh3b3Jrc3BhY2VJZGVudGlmaWVyKTtcblx0XHRpZiAoVVJJLmlzVXJpKHdvcmtzcGFjZSkpIHtcblx0XHRcdGNvbnN0IGN1cnJlbnRseUFzc29jaWF0ZWRQcm9maWxlID0gdGhpcy5nZXRQcm9maWxlRm9yV29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXIpO1xuXHRcdFx0aWYgKGN1cnJlbnRseUFzc29jaWF0ZWRQcm9maWxlKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlUHJvZmlsZShjdXJyZW50bHlBc3NvY2lhdGVkUHJvZmlsZSwgeyB3b3Jrc3BhY2VzOiBjdXJyZW50bHlBc3NvY2lhdGVkUHJvZmlsZS53b3Jrc3BhY2VzPy5maWx0ZXIodyA9PiAhdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodywgd29ya3NwYWNlKSkgfSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudXBkYXRlRW1wdHlXaW5kb3dBc3NvY2lhdGlvbih3b3Jrc3BhY2UsIHVuZGVmaW5lZCwgdHJhbnNpZW50KTtcblx0XHRcdHRoaXMudXBkYXRlU3RvcmVkUHJvZmlsZXModGhpcy5wcm9maWxlcyk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVzZXRXb3Jrc3BhY2VzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhbnNpZW50UHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmNsZWFyKCk7XG5cdFx0dGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3MuY2xlYXIoKTtcblx0XHRmb3IgKGNvbnN0IHByb2ZpbGUgb2YgdGhpcy5wcm9maWxlcykge1xuXHRcdFx0KDxNdXRhYmxlPElVc2VyRGF0YVByb2ZpbGU+PnByb2ZpbGUpLndvcmtzcGFjZXMgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlUHJvZmlsZXMoW10sIFtdLCB0aGlzLnByb2ZpbGVzKTtcblx0XHR0aGlzLl9vbkRpZFJlc2V0V29ya3NwYWNlcy5maXJlKCk7XG5cdH1cblxuXHRhc3luYyBjbGVhblVwKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyh0aGlzLnByb2ZpbGVzSG9tZSkpIHtcblx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUodGhpcy5wcm9maWxlc0hvbWUpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoKHN0YXQuY2hpbGRyZW4gfHwgW10pXG5cdFx0XHRcdC5maWx0ZXIoY2hpbGQgPT4gY2hpbGQuaXNEaXJlY3RvcnkgJiYgdGhpcy5wcm9maWxlcy5ldmVyeShwID0+ICF0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChwLmxvY2F0aW9uLCBjaGlsZC5yZXNvdXJjZSkpKVxuXHRcdFx0XHQubWFwKGNoaWxkID0+IHRoaXMuZmlsZVNlcnZpY2UuZGVsKGNoaWxkLnJlc291cmNlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSkpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNsZWFuVXBUcmFuc2llbnRQcm9maWxlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB1bkFzc29jaWF0ZWRUcmFuc2llbnRQcm9maWxlcyA9IHRoaXMudHJhbnNpZW50UHJvZmlsZXNPYmplY3QucHJvZmlsZXMuZmlsdGVyKHAgPT4gIXRoaXMuaXNQcm9maWxlQXNzb2NpYXRlZFRvV29ya3NwYWNlKHApKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQodW5Bc3NvY2lhdGVkVHJhbnNpZW50UHJvZmlsZXMubWFwKHAgPT4gdGhpcy5yZW1vdmVQcm9maWxlKHApKSk7XG5cdH1cblxuXHRnZXRQcm9maWxlRm9yV29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXI6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy5nZXRXb3Jrc3BhY2Uod29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0cmV0dXJuIFVSSS5pc1VyaSh3b3Jrc3BhY2UpXG5cdFx0XHQ/IHRoaXMucHJvZmlsZXMuZmluZChwID0+IHAud29ya3NwYWNlcz8uc29tZSh3ID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHcsIHdvcmtzcGFjZSkpKVxuXHRcdFx0OiAodGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3MuZ2V0KHdvcmtzcGFjZSkgPz8gdGhpcy50cmFuc2llbnRQcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3MuZ2V0KHdvcmtzcGFjZSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldFdvcmtzcGFjZSh3b3Jrc3BhY2VJZGVudGlmaWVyOiBJQW55V29ya3NwYWNlSWRlbnRpZmllcik6IFVSSSB8IHN0cmluZyB7XG5cdFx0aWYgKGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcih3b3Jrc3BhY2VJZGVudGlmaWVyKSkge1xuXHRcdFx0cmV0dXJuIHdvcmtzcGFjZUlkZW50aWZpZXIudXJpO1xuXHRcdH1cblx0XHRpZiAoaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdvcmtzcGFjZUlkZW50aWZpZXIpKSB7XG5cdFx0XHRyZXR1cm4gd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gd29ya3NwYWNlSWRlbnRpZmllci5pZDtcblx0fVxuXG5cdHByaXZhdGUgaXNQcm9maWxlQXNzb2NpYXRlZFRvV29ya3NwYWNlKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBib29sZWFuIHtcblx0XHRpZiAocHJvZmlsZS53b3Jrc3BhY2VzPy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoWy4uLnRoaXMucHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLnZhbHVlcygpXS5zb21lKHdpbmRvd1Byb2ZpbGUgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwod2luZG93UHJvZmlsZS5sb2NhdGlvbiwgcHJvZmlsZS5sb2NhdGlvbikpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKFsuLi50aGlzLnRyYW5zaWVudFByb2ZpbGVzT2JqZWN0LmVtcHR5V2luZG93cy52YWx1ZXMoKV0uc29tZSh3aW5kb3dQcm9maWxlID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHdpbmRvd1Byb2ZpbGUubG9jYXRpb24sIHByb2ZpbGUubG9jYXRpb24pKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJvZmlsZXMoYWRkZWQ6IElVc2VyRGF0YVByb2ZpbGVbXSwgcmVtb3ZlZDogSVVzZXJEYXRhUHJvZmlsZVtdLCB1cGRhdGVkOiBJVXNlckRhdGFQcm9maWxlW10pOiB2b2lkIHtcblx0XHRjb25zdCBhbGxQcm9maWxlczogTXV0YWJsZTxJVXNlckRhdGFQcm9maWxlPltdID0gWy4uLnRoaXMucHJvZmlsZXMsIC4uLmFkZGVkXTtcblxuXHRcdGNvbnN0IHRyYW5zaWVudFByb2ZpbGVzID0gdGhpcy50cmFuc2llbnRQcm9maWxlc09iamVjdC5wcm9maWxlcztcblx0XHR0aGlzLnRyYW5zaWVudFByb2ZpbGVzT2JqZWN0LnByb2ZpbGVzID0gW107XG5cblx0XHRjb25zdCBwcm9maWxlczogSVVzZXJEYXRhUHJvZmlsZVtdID0gW107XG5cblx0XHRmb3IgKGxldCBwcm9maWxlIG9mIGFsbFByb2ZpbGVzKSB7XG5cdFx0XHQvLyByZW1vdmVkXG5cdFx0XHRpZiAocmVtb3ZlZC5zb21lKHAgPT4gcHJvZmlsZS5pZCA9PT0gcC5pZCkpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB3aW5kb3dJZCBvZiBbLi4udGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3Mua2V5cygpXSkge1xuXHRcdFx0XHRcdGlmIChwcm9maWxlLmlkID09PSB0aGlzLnByb2ZpbGVzT2JqZWN0LmVtcHR5V2luZG93cy5nZXQod2luZG93SWQpPy5pZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3MuZGVsZXRlKHdpbmRvd0lkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghcHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0cHJvZmlsZSA9IHVwZGF0ZWQuZmluZChwID0+IHByb2ZpbGUuaWQgPT09IHAuaWQpID8/IHByb2ZpbGU7XG5cdFx0XHRcdGNvbnN0IHRyYW5zaWVudFByb2ZpbGUgPSB0cmFuc2llbnRQcm9maWxlcy5maW5kKHAgPT4gcHJvZmlsZS5pZCA9PT0gcC5pZCk7XG5cdFx0XHRcdGlmIChwcm9maWxlLmlzVHJhbnNpZW50KSB7XG5cdFx0XHRcdFx0dGhpcy50cmFuc2llbnRQcm9maWxlc09iamVjdC5wcm9maWxlcy5wdXNoKHByb2ZpbGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICh0cmFuc2llbnRQcm9maWxlKSB7XG5cdFx0XHRcdFx0XHQvLyBNb3ZlIHRoZSBlbXB0eSB3aW5kb3cgYXNzb2NpYXRpb25zIGZyb20gdGhlIHRyYW5zaWVudCBwcm9maWxlIHRvIHRoZSBwZXJzaXN0ZWQgcHJvZmlsZVxuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBbd2luZG93SWQsIHBdIG9mIHRoaXMudHJhbnNpZW50UHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdFx0XHRpZiAocHJvZmlsZS5pZCA9PT0gcC5pZCkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudHJhbnNpZW50UHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmRlbGV0ZSh3aW5kb3dJZCk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3Muc2V0KHdpbmRvd0lkLCBwcm9maWxlKTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocHJvZmlsZS53b3Jrc3BhY2VzPy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cHJvZmlsZS53b3Jrc3BhY2VzID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRwcm9maWxlcy5wdXNoKHByb2ZpbGUpO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlU3RvcmVkUHJvZmlsZXMocHJvZmlsZXMpO1xuXHRcdHRoaXMudHJpZ2dlclByb2ZpbGVzQ2hhbmdlcyhhZGRlZCwgcmVtb3ZlZCwgdXBkYXRlZCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdHJpZ2dlclByb2ZpbGVzQ2hhbmdlcyhhZGRlZDogSVVzZXJEYXRhUHJvZmlsZVtdLCByZW1vdmVkOiBJVXNlckRhdGFQcm9maWxlW10sIHVwZGF0ZWQ6IElVc2VyRGF0YVByb2ZpbGVbXSkge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUHJvZmlsZXMuZmlyZSh7IGFkZGVkLCByZW1vdmVkLCB1cGRhdGVkLCBhbGw6IHRoaXMucHJvZmlsZXMgfSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUVtcHR5V2luZG93QXNzb2NpYXRpb24od2luZG93SWQ6IHN0cmluZywgbmV3UHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSB8IHVuZGVmaW5lZCwgdHJhbnNpZW50OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Ly8gRm9yY2UgdHJhbnNpZW50IGlmIHRoZSBuZXcgcHJvZmlsZSB0byBhc3NvY2lhdGUgaXMgdHJhbnNpZW50XG5cdFx0dHJhbnNpZW50ID0gbmV3UHJvZmlsZT8uaXNUcmFuc2llbnQgPyB0cnVlIDogdHJhbnNpZW50O1xuXG5cdFx0aWYgKHRyYW5zaWVudCkge1xuXHRcdFx0aWYgKG5ld1Byb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy50cmFuc2llbnRQcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3Muc2V0KHdpbmRvd0lkLCBuZXdQcm9maWxlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudHJhbnNpZW50UHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmRlbGV0ZSh3aW5kb3dJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyBVbnNldCB0aGUgdHJhbnNpZXQgYXNzb2NpYXRpb24gaWYgYW55XG5cdFx0XHR0aGlzLnRyYW5zaWVudFByb2ZpbGVzT2JqZWN0LmVtcHR5V2luZG93cy5kZWxldGUod2luZG93SWQpO1xuXHRcdFx0aWYgKG5ld1Byb2ZpbGUpIHtcblx0XHRcdFx0dGhpcy5wcm9maWxlc09iamVjdC5lbXB0eVdpbmRvd3Muc2V0KHdpbmRvd0lkLCBuZXdQcm9maWxlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmRlbGV0ZSh3aW5kb3dJZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdG9yZWRQcm9maWxlcyhwcm9maWxlczogSVVzZXJEYXRhUHJvZmlsZVtdKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmVkUHJvZmlsZXM6IFN0b3JlZFVzZXJEYXRhUHJvZmlsZVtdID0gW107XG5cdFx0Y29uc3Qgd29ya3NwYWNlczogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPiA9IHt9O1xuXHRcdGNvbnN0IGVtcHR5V2luZG93czogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPiA9IHt9O1xuXG5cdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHByb2ZpbGVzKSB7XG5cdFx0XHRpZiAocHJvZmlsZS5pc1RyYW5zaWVudCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICghcHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0c3RvcmVkUHJvZmlsZXMucHVzaCh7IGxvY2F0aW9uOiBwcm9maWxlLmxvY2F0aW9uLCBuYW1lOiBwcm9maWxlLm5hbWUsIGljb246IHByb2ZpbGUuaWNvbiwgdXNlRGVmYXVsdEZsYWdzOiBwcm9maWxlLnVzZURlZmF1bHRGbGFncyB9KTtcblx0XHRcdH1cblx0XHRcdGlmIChwcm9maWxlLndvcmtzcGFjZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2Ugb2YgcHJvZmlsZS53b3Jrc3BhY2VzKSB7XG5cdFx0XHRcdFx0d29ya3NwYWNlc1t3b3Jrc3BhY2UudG9TdHJpbmcoKV0gPSBwcm9maWxlLmlkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBbd2luZG93SWQsIHByb2ZpbGVdIG9mIHRoaXMucHJvZmlsZXNPYmplY3QuZW1wdHlXaW5kb3dzLmVudHJpZXMoKSkge1xuXHRcdFx0ZW1wdHlXaW5kb3dzW3dpbmRvd0lkLnRvU3RyaW5nKCldID0gcHJvZmlsZS5pZDtcblx0XHR9XG5cblx0XHR0aGlzLnNhdmVTdG9yZWRQcm9maWxlQXNzb2NpYXRpb25zKHsgd29ya3NwYWNlcywgZW1wdHlXaW5kb3dzIH0pO1xuXHRcdHRoaXMuc2F2ZVN0b3JlZFByb2ZpbGVzKHN0b3JlZFByb2ZpbGVzKTtcblx0XHR0aGlzLl9wcm9maWxlc09iamVjdCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRTdG9yZWRQcm9maWxlcygpOiBTdG9yZWRVc2VyRGF0YVByb2ZpbGVbXSB7IHJldHVybiBbXTsgfVxuXHRwcm90ZWN0ZWQgc2F2ZVN0b3JlZFByb2ZpbGVzKHN0b3JlZFByb2ZpbGVzOiBTdG9yZWRVc2VyRGF0YVByb2ZpbGVbXSk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cblx0cHJvdGVjdGVkIGdldFN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnMoKTogU3RvcmVkUHJvZmlsZUFzc29jaWF0aW9ucyB7IHJldHVybiB7fTsgfVxuXHRwcm90ZWN0ZWQgc2F2ZVN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnMoc3RvcmVkUHJvZmlsZUFzc29jaWF0aW9uczogU3RvcmVkUHJvZmlsZUFzc29jaWF0aW9ucyk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdHByb3RlY3RlZCBnZXREZWZhdWx0UHJvZmlsZUV4dGVuc2lvbnNMb2NhdGlvbigpOiBVUkkgfCB1bmRlZmluZWQgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBJbk1lbW9yeVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIGV4dGVuZHMgVXNlckRhdGFQcm9maWxlc1NlcnZpY2Uge1xuXHRwcml2YXRlIHN0b3JlZFByb2ZpbGVzOiBTdG9yZWRVc2VyRGF0YVByb2ZpbGVbXSA9IFtdO1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0U3RvcmVkUHJvZmlsZXMoKTogU3RvcmVkVXNlckRhdGFQcm9maWxlW10geyByZXR1cm4gdGhpcy5zdG9yZWRQcm9maWxlczsgfVxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgc2F2ZVN0b3JlZFByb2ZpbGVzKHN0b3JlZFByb2ZpbGVzOiBTdG9yZWRVc2VyRGF0YVByb2ZpbGVbXSk6IHZvaWQgeyB0aGlzLnN0b3JlZFByb2ZpbGVzID0gc3RvcmVkUHJvZmlsZXM7IH1cblxuXHRwcml2YXRlIHN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnM6IFN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnMgPSB7fTtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnMoKTogU3RvcmVkUHJvZmlsZUFzc29jaWF0aW9ucyB7IHJldHVybiB0aGlzLnN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnM7IH1cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNhdmVTdG9yZWRQcm9maWxlQXNzb2NpYXRpb25zKHN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnM6IFN0b3JlZFByb2ZpbGVBc3NvY2lhdGlvbnMpOiB2b2lkIHsgdGhpcy5zdG9yZWRQcm9maWxlQXNzb2NpYXRpb25zID0gc3RvcmVkUHJvZmlsZUFzc29jaWF0aW9uczsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVk7QUFDckIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFNBQVMsV0FBbUI7QUFDNUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBcUIsY0FBYyw2QkFBNkI7QUFDekUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBa0MsbUNBQW1DLDZCQUE2QjtBQUVsRyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGdCQUF5QjtBQUUzQixJQUFXLHNCQUFYLGtCQUFXQSx5QkFBWDtBQUNOLEVBQUFBLHFCQUFBLGNBQVc7QUFDWCxFQUFBQSxxQkFBQSxpQkFBYztBQUNkLEVBQUFBLHFCQUFBLGNBQVc7QUFDWCxFQUFBQSxxQkFBQSxhQUFVO0FBQ1YsRUFBQUEscUJBQUEsV0FBUTtBQUNSLEVBQUFBLHFCQUFBLGdCQUFhO0FBQ2IsRUFBQUEscUJBQUEsaUJBQWM7QUFQRyxTQUFBQTtBQUFBLEdBQUE7QUFtQ1gsU0FBUyxrQkFBa0IsT0FBMkM7QUFDNUUsUUFBTSxZQUFZO0FBRWxCLFNBQU8sQ0FBQyxFQUFFLGFBQWEsT0FBTyxjQUFjLFlBQ3hDLE9BQU8sVUFBVSxPQUFPLFlB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
