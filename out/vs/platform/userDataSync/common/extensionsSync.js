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
import { Promises } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { getErrorMessage } from "../../../base/common/errors.js";
import { Event } from "../../../base/common/event.js";
import { toFormattedString } from "../../../base/common/jsonFormatter.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { compare } from "../../../base/common/strings.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { GlobalExtensionEnablementService } from "../../extensionManagement/common/extensionEnablementService.js";
import { IExtensionGalleryService, IExtensionManagementService, ExtensionManagementError, ExtensionManagementErrorCode, DISABLED_EXTENSIONS_STORAGE_PATH, EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT, EXTENSION_INSTALL_SOURCE_CONTEXT, ExtensionInstallSource, EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT } from "../../extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../extensionManagement/common/extensionManagementUtil.js";
import { ExtensionStorageService, IExtensionStorageService } from "../../extensionManagement/common/extensionStorage.js";
import { ExtensionType, isApplicationScopedExtension } from "../../extensions/common/extensions.js";
import { IFileService } from "../../files/common/files.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { ServiceCollection } from "../../instantiation/common/serviceCollection.js";
import { ILogService } from "../../log/common/log.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { AbstractInitializer, AbstractSynchroniser, getSyncResourceLogLabel } from "./abstractSynchronizer.js";
import { merge } from "./extensionsMerge.js";
import { IIgnoredExtensionsManagementService } from "./ignoredExtensions.js";
import { Change, IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncStoreService, SyncResource, USER_DATA_SYNC_SCHEME } from "./userDataSync.js";
import { IUserDataProfileStorageService } from "../../userDataProfile/common/userDataProfileStorageService.js";
async function parseAndMigrateExtensions(syncData, extensionManagementService) {
  const extensions = JSON.parse(syncData.content);
  if (syncData.version === 1 || syncData.version === 2) {
    const builtinExtensions = (await extensionManagementService.getInstalled(ExtensionType.System)).filter((e) => e.isBuiltin);
    for (const extension of extensions) {
      if (syncData.version === 1) {
        if (extension.enabled === false) {
          extension.disabled = true;
        }
        delete extension.enabled;
      }
      if (syncData.version === 2) {
        if (builtinExtensions.every((installed) => !areSameExtensions(installed.identifier, extension.identifier))) {
          extension.installed = true;
        }
      }
    }
  }
  return extensions;
}
function parseExtensions(syncData) {
  return JSON.parse(syncData.content);
}
function stringify(extensions, format) {
  extensions.sort((e1, e2) => {
    if (!e1.identifier.uuid && e2.identifier.uuid) {
      return -1;
    }
    if (e1.identifier.uuid && !e2.identifier.uuid) {
      return 1;
    }
    return compare(e1.identifier.id, e2.identifier.id);
  });
  return format ? toFormattedString(extensions, {}) : JSON.stringify(extensions);
}
let ExtensionsSynchroniser = class extends AbstractSynchroniser {
  constructor(profile, collection, environmentService, fileService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, extensionManagementService, ignoredExtensionsManagementService, logService, configurationService, userDataSyncEnablementService, telemetryService, extensionStorageService, uriIdentityService, userDataProfileStorageService, instantiationService) {
    super({ syncResource: SyncResource.Extensions, profile }, collection, fileService, environmentService, storageService, userDataSyncStoreService, userDataSyncLocalStoreService, userDataSyncEnablementService, telemetryService, logService, configurationService, uriIdentityService);
    this.extensionManagementService = extensionManagementService;
    this.ignoredExtensionsManagementService = ignoredExtensionsManagementService;
    this.instantiationService = instantiationService;
    /*
    	Version 3 - Introduce installed property to skip installing built in extensions
    	protected readonly version: number = 3;
    */
    /* Version 4: Change settings from `sync.${setting}` to `settingsSync.{setting}` */
    /* Version 5: Introduce extension state */
    /* Version 6: Added isApplicationScoped property */
    this.version = 6;
    this.previewResource = this.extUri.joinPath(this.syncPreviewFolder, "extensions.json");
    this.baseResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "base" });
    this.localResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "local" });
    this.remoteResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "remote" });
    this.acceptedResource = this.previewResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "accepted" });
    this.localExtensionsProvider = this.instantiationService.createInstance(LocalExtensionsProvider);
    this._register(
      Event.any(
        Event.filter(this.extensionManagementService.onDidInstallExtensions, (e) => e.some(({ local }) => !!local)),
        Event.filter(this.extensionManagementService.onDidUninstallExtension, (e) => !e.error),
        Event.filter(userDataProfileStorageService.onDidChange, (e) => e.valueChanges.some(({ profile: profile2, changes }) => this.syncResource.profile.id === profile2.id && changes.some((change) => change.key === DISABLED_EXTENSIONS_STORAGE_PATH))),
        extensionStorageService.onDidChangeExtensionStorageToSync
      )(() => this.triggerLocalChange())
    );
  }
  async generateSyncPreview(remoteUserData, lastSyncUserData) {
    const remoteExtensions = remoteUserData.syncData ? await parseAndMigrateExtensions(remoteUserData.syncData, this.extensionManagementService) : null;
    const skippedExtensions = lastSyncUserData?.skippedExtensions ?? [];
    const builtinExtensions = lastSyncUserData?.builtinExtensions ?? null;
    const lastSyncExtensions = lastSyncUserData?.syncData ? await parseAndMigrateExtensions(lastSyncUserData.syncData, this.extensionManagementService) : null;
    const { localExtensions, ignoredExtensions } = await this.localExtensionsProvider.getLocalExtensions(this.syncResource.profile);
    if (remoteExtensions) {
      this.logService.trace(`${this.syncResourceLogLabel}: Merging remote extensions with local extensions...`);
    } else {
      this.logService.trace(`${this.syncResourceLogLabel}: Remote extensions does not exist. Synchronizing extensions for the first time.`);
    }
    const { local, remote } = merge(localExtensions, remoteExtensions, lastSyncExtensions, skippedExtensions, ignoredExtensions, builtinExtensions);
    const previewResult = {
      local,
      remote,
      content: this.getPreviewContent(localExtensions, local.added, local.updated, local.removed),
      localChange: local.added.length > 0 || local.removed.length > 0 || local.updated.length > 0 ? Change.Modified : Change.None,
      remoteChange: remote !== null ? Change.Modified : Change.None
    };
    const localContent = this.stringify(localExtensions, false);
    return [{
      skippedExtensions,
      builtinExtensions,
      baseResource: this.baseResource,
      baseContent: lastSyncExtensions ? this.stringify(lastSyncExtensions, false) : localContent,
      localResource: this.localResource,
      localContent,
      localExtensions,
      remoteResource: this.remoteResource,
      remoteExtensions,
      remoteContent: remoteExtensions ? this.stringify(remoteExtensions, false) : null,
      previewResource: this.previewResource,
      previewResult,
      localChange: previewResult.localChange,
      remoteChange: previewResult.remoteChange,
      acceptedResource: this.acceptedResource
    }];
  }
  async hasRemoteChanged(lastSyncUserData) {
    const lastSyncExtensions = lastSyncUserData.syncData ? await parseAndMigrateExtensions(lastSyncUserData.syncData, this.extensionManagementService) : null;
    const { localExtensions, ignoredExtensions } = await this.localExtensionsProvider.getLocalExtensions(this.syncResource.profile);
    const { remote } = merge(localExtensions, lastSyncExtensions, lastSyncExtensions, lastSyncUserData.skippedExtensions || [], ignoredExtensions, lastSyncUserData.builtinExtensions || []);
    return remote !== null;
  }
  getPreviewContent(localExtensions, added, updated, removed) {
    const preview = [...added, ...updated];
    const idsOrUUIDs = /* @__PURE__ */ new Set();
    const addIdentifier = (identifier) => {
      idsOrUUIDs.add(identifier.id.toLowerCase());
      if (identifier.uuid) {
        idsOrUUIDs.add(identifier.uuid);
      }
    };
    preview.forEach(({ identifier }) => addIdentifier(identifier));
    removed.forEach(addIdentifier);
    for (const localExtension of localExtensions) {
      if (idsOrUUIDs.has(localExtension.identifier.id.toLowerCase()) || localExtension.identifier.uuid && idsOrUUIDs.has(localExtension.identifier.uuid)) {
        continue;
      }
      preview.push(localExtension);
    }
    return this.stringify(preview, false);
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
    const installedExtensions = await this.extensionManagementService.getInstalled(void 0, this.syncResource.profile.extensionsResource);
    const ignoredExtensions = this.ignoredExtensionsManagementService.getIgnoredExtensions(installedExtensions);
    const remoteExtensions = resourcePreview.remoteContent ? JSON.parse(resourcePreview.remoteContent) : null;
    const mergeResult = merge(resourcePreview.localExtensions, remoteExtensions, remoteExtensions, resourcePreview.skippedExtensions, ignoredExtensions, resourcePreview.builtinExtensions);
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
    const installedExtensions = await this.extensionManagementService.getInstalled(void 0, this.syncResource.profile.extensionsResource);
    const ignoredExtensions = this.ignoredExtensionsManagementService.getIgnoredExtensions(installedExtensions);
    const remoteExtensions = resourcePreview.remoteContent ? JSON.parse(resourcePreview.remoteContent) : null;
    if (remoteExtensions !== null) {
      const mergeResult = merge(resourcePreview.localExtensions, remoteExtensions, resourcePreview.localExtensions, [], ignoredExtensions, resourcePreview.builtinExtensions);
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
    let { skippedExtensions, builtinExtensions, localExtensions } = resourcePreviews[0][0];
    const { local, remote, localChange, remoteChange } = resourcePreviews[0][1];
    if (localChange === Change.None && remoteChange === Change.None) {
      this.logService.info(`${this.syncResourceLogLabel}: No changes found during synchronizing extensions.`);
    }
    if (localChange !== Change.None) {
      await this.backupLocal(JSON.stringify(localExtensions));
      skippedExtensions = await this.localExtensionsProvider.updateLocalExtensions(local.added, local.removed, local.updated, skippedExtensions, this.syncResource.profile);
    }
    if (remote) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating remote extensions...`);
      const content = JSON.stringify(remote.all);
      remoteUserData = await this.updateRemoteUserData(content, force ? null : remoteUserData.ref);
      this.logService.info(`${this.syncResourceLogLabel}: Updated remote extensions.${remote.added.length ? ` Added: ${JSON.stringify(remote.added.map((e) => e.identifier.id))}.` : ""}${remote.updated.length ? ` Updated: ${JSON.stringify(remote.updated.map((e) => e.identifier.id))}.` : ""}${remote.removed.length ? ` Removed: ${JSON.stringify(remote.removed.map((e) => e.identifier.id))}.` : ""}`);
    }
    if (lastSyncUserData?.ref !== remoteUserData.ref) {
      this.logService.trace(`${this.syncResourceLogLabel}: Updating last synchronized extensions...`);
      builtinExtensions = this.computeBuiltinExtensions(localExtensions, builtinExtensions);
      await this.updateLastSyncUserData(remoteUserData, { skippedExtensions, builtinExtensions });
      this.logService.info(`${this.syncResourceLogLabel}: Updated last synchronized extensions.${skippedExtensions.length ? ` Skipped: ${JSON.stringify(skippedExtensions.map((e) => e.identifier.id))}.` : ""}`);
    }
  }
  computeBuiltinExtensions(localExtensions, previousBuiltinExtensions) {
    const localExtensionsSet = /* @__PURE__ */ new Set();
    const builtinExtensions = [];
    for (const localExtension of localExtensions) {
      localExtensionsSet.add(localExtension.identifier.id.toLowerCase());
      if (!localExtension.installed) {
        builtinExtensions.push(localExtension.identifier);
      }
    }
    if (previousBuiltinExtensions) {
      for (const builtinExtension of previousBuiltinExtensions) {
        if (!localExtensionsSet.has(builtinExtension.id.toLowerCase())) {
          builtinExtensions.push(builtinExtension);
        }
      }
    }
    return builtinExtensions;
  }
  async resolveContent(uri) {
    if (this.extUri.isEqual(this.remoteResource, uri) || this.extUri.isEqual(this.baseResource, uri) || this.extUri.isEqual(this.localResource, uri) || this.extUri.isEqual(this.acceptedResource, uri)) {
      const content = await this.resolvePreviewContent(uri);
      return content ? this.stringify(JSON.parse(content), true) : content;
    }
    return null;
  }
  stringify(extensions, format) {
    return stringify(extensions, format);
  }
  async hasLocalData() {
    try {
      const { localExtensions } = await this.localExtensionsProvider.getLocalExtensions(this.syncResource.profile);
      if (localExtensions.some((e) => e.installed || e.disabled)) {
        return true;
      }
    } catch (error) {
    }
    return false;
  }
};
ExtensionsSynchroniser = __decorateClass([
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, IUserDataSyncStoreService),
  __decorateParam(6, IUserDataSyncLocalStoreService),
  __decorateParam(7, IExtensionManagementService),
  __decorateParam(8, IIgnoredExtensionsManagementService),
  __decorateParam(9, IUserDataSyncLogService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IUserDataSyncEnablementService),
  __decorateParam(12, ITelemetryService),
  __decorateParam(13, IExtensionStorageService),
  __decorateParam(14, IUriIdentityService),
  __decorateParam(15, IUserDataProfileStorageService),
  __decorateParam(16, IInstantiationService)
], ExtensionsSynchroniser);
let LocalExtensionsProvider = class {
  constructor(extensionManagementService, userDataProfileStorageService, extensionGalleryService, ignoredExtensionsManagementService, instantiationService, logService) {
    this.extensionManagementService = extensionManagementService;
    this.userDataProfileStorageService = userDataProfileStorageService;
    this.extensionGalleryService = extensionGalleryService;
    this.ignoredExtensionsManagementService = ignoredExtensionsManagementService;
    this.instantiationService = instantiationService;
    this.logService = logService;
  }
  async getLocalExtensions(profile) {
    const installedExtensions = await this.extensionManagementService.getInstalled(void 0, profile.extensionsResource);
    const ignoredExtensions = this.ignoredExtensionsManagementService.getIgnoredExtensions(installedExtensions);
    const localExtensions = await this.withProfileScopedServices(profile, async (extensionEnablementService, extensionStorageService) => {
      const disabledExtensions = extensionEnablementService.getDisabledExtensions();
      return installedExtensions.map((extension) => {
        const { identifier, isBuiltin, manifest, preRelease, pinned, isApplicationScoped } = extension;
        const syncExntesion = { identifier, preRelease, version: manifest.version, pinned: !!pinned };
        if (isApplicationScoped && !isApplicationScopedExtension(manifest)) {
          syncExntesion.isApplicationScoped = isApplicationScoped;
        }
        if (disabledExtensions.some((disabledExtension) => areSameExtensions(disabledExtension, identifier))) {
          syncExntesion.disabled = true;
        }
        if (!isBuiltin) {
          syncExntesion.installed = true;
        }
        try {
          const keys = extensionStorageService.getKeysForSync({ id: identifier.id, version: manifest.version });
          if (keys) {
            const extensionStorageState = extensionStorageService.getExtensionState(extension, true) || {};
            syncExntesion.state = Object.keys(extensionStorageState).reduce((state, key) => {
              if (keys.includes(key)) {
                state[key] = extensionStorageState[key];
              }
              return state;
            }, {});
          }
        } catch (error) {
          this.logService.info(`${getSyncResourceLogLabel(SyncResource.Extensions, profile)}: Error while parsing extension state`, getErrorMessage(error));
        }
        return syncExntesion;
      });
    });
    return { localExtensions, ignoredExtensions };
  }
  async updateLocalExtensions(added, removed, updated, skippedExtensions, profile) {
    const syncResourceLogLabel = getSyncResourceLogLabel(SyncResource.Extensions, profile);
    const extensionsToInstall = [];
    const syncExtensionsToInstall = /* @__PURE__ */ new Map();
    const removeFromSkipped = [];
    const addToSkipped = [];
    const installedExtensions = await this.extensionManagementService.getInstalled(void 0, profile.extensionsResource);
    if (added.length || updated.length) {
      await this.withProfileScopedServices(profile, async (extensionEnablementService, extensionStorageService) => {
        await Promises.settled([...added, ...updated].map(async (e) => {
          const installedExtension = installedExtensions.find((installed) => areSameExtensions(installed.identifier, e.identifier));
          if (installedExtension && installedExtension.isBuiltin) {
            if (e.state && installedExtension.manifest.version === e.version) {
              this.updateExtensionState(e.state, installedExtension, installedExtension.manifest.version, extensionStorageService);
            }
            const isDisabled = extensionEnablementService.getDisabledExtensions().some((disabledExtension) => areSameExtensions(disabledExtension, e.identifier));
            if (isDisabled !== !!e.disabled) {
              if (e.disabled) {
                this.logService.trace(`${syncResourceLogLabel}: Disabling extension...`, e.identifier.id);
                await extensionEnablementService.disableExtension(e.identifier);
                this.logService.info(`${syncResourceLogLabel}: Disabled extension`, e.identifier.id);
              } else {
                this.logService.trace(`${syncResourceLogLabel}: Enabling extension...`, e.identifier.id);
                await extensionEnablementService.enableExtension(e.identifier);
                this.logService.info(`${syncResourceLogLabel}: Enabled extension`, e.identifier.id);
              }
            }
            removeFromSkipped.push(e.identifier);
            return;
          }
          const version = e.pinned ? e.version : void 0;
          const extension = (await this.extensionGalleryService.getExtensions([{ ...e.identifier, version, preRelease: version ? void 0 : e.preRelease }], CancellationToken.None))[0];
          if (e.state && (installedExtension ? installedExtension.manifest.version === e.version : !!extension)) {
            this.updateExtensionState(e.state, installedExtension || extension, installedExtension?.manifest.version, extensionStorageService);
          }
          if (extension) {
            try {
              const isDisabled = extensionEnablementService.getDisabledExtensions().some((disabledExtension) => areSameExtensions(disabledExtension, e.identifier));
              if (isDisabled !== !!e.disabled) {
                if (e.disabled) {
                  this.logService.trace(`${syncResourceLogLabel}: Disabling extension...`, e.identifier.id, extension.version);
                  await extensionEnablementService.disableExtension(extension.identifier);
                  this.logService.info(`${syncResourceLogLabel}: Disabled extension`, e.identifier.id, extension.version);
                } else {
                  this.logService.trace(`${syncResourceLogLabel}: Enabling extension...`, e.identifier.id, extension.version);
                  await extensionEnablementService.enableExtension(extension.identifier);
                  this.logService.info(`${syncResourceLogLabel}: Enabled extension`, e.identifier.id, extension.version);
                }
              }
              if (!installedExtension || installedExtension.preRelease !== e.preRelease || installedExtension.pinned !== e.pinned || version && installedExtension.manifest.version !== version) {
                if (await this.extensionManagementService.canInstall(extension) === true) {
                  extensionsToInstall.push({
                    extension,
                    options: {
                      isMachineScoped: false,
                      donotIncludePackAndDependencies: true,
                      installGivenVersion: e.pinned && !!e.version,
                      pinned: e.pinned,
                      installPreReleaseVersion: e.preRelease,
                      preRelease: e.preRelease,
                      profileLocation: profile.extensionsResource,
                      isApplicationScoped: e.isApplicationScoped,
                      context: { [EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT]: true, [EXTENSION_INSTALL_SOURCE_CONTEXT]: ExtensionInstallSource.SETTINGS_SYNC, [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
                    }
                  });
                  syncExtensionsToInstall.set(extension.identifier.id.toLowerCase(), e);
                } else {
                  this.logService.info(`${syncResourceLogLabel}: Skipped synchronizing extension because it cannot be installed.`, extension.displayName || extension.identifier.id);
                  addToSkipped.push(e);
                }
              }
            } catch (error) {
              addToSkipped.push(e);
              this.logService.error(error);
              this.logService.info(`${syncResourceLogLabel}: Skipped synchronizing extension`, extension.displayName || extension.identifier.id);
            }
          } else {
            addToSkipped.push(e);
            this.logService.info(`${syncResourceLogLabel}: Skipped synchronizing extension because the extension is not found.`, e.identifier.id);
          }
        }));
      });
    }
    if (removed.length) {
      const extensionsToRemove = installedExtensions.filter(({ identifier, isBuiltin }) => !isBuiltin && removed.some((r) => areSameExtensions(identifier, r)));
      await Promises.settled(extensionsToRemove.map(async (extensionToRemove) => {
        this.logService.trace(`${syncResourceLogLabel}: Uninstalling local extension...`, extensionToRemove.identifier.id);
        await this.extensionManagementService.uninstall(extensionToRemove, { donotIncludePack: true, donotCheckDependents: true, profileLocation: profile.extensionsResource });
        this.logService.info(`${syncResourceLogLabel}: Uninstalled local extension.`, extensionToRemove.identifier.id);
        removeFromSkipped.push(extensionToRemove.identifier);
      }));
    }
    const results = await this.extensionManagementService.installGalleryExtensions(extensionsToInstall);
    for (const { identifier, local, error, source } of results) {
      const gallery = source;
      if (local) {
        this.logService.info(`${syncResourceLogLabel}: Installed extension.`, identifier.id, gallery.version);
        removeFromSkipped.push(identifier);
      } else {
        const e = syncExtensionsToInstall.get(identifier.id.toLowerCase());
        if (e) {
          addToSkipped.push(e);
          this.logService.info(`${syncResourceLogLabel}: Skipped synchronizing extension`, gallery.displayName || gallery.identifier.id);
        }
        if (error instanceof ExtensionManagementError && [ExtensionManagementErrorCode.Incompatible, ExtensionManagementErrorCode.IncompatibleApi, ExtensionManagementErrorCode.IncompatibleTargetPlatform].includes(error.code)) {
          this.logService.info(`${syncResourceLogLabel}: Skipped synchronizing extension because the compatible extension is not found.`, gallery.displayName || gallery.identifier.id);
        } else if (error) {
          this.logService.error(error);
        }
      }
    }
    const newSkippedExtensions = [];
    for (const skippedExtension of skippedExtensions) {
      if (!removeFromSkipped.some((e) => areSameExtensions(e, skippedExtension.identifier))) {
        newSkippedExtensions.push(skippedExtension);
      }
    }
    for (const skippedExtension of addToSkipped) {
      if (!newSkippedExtensions.some((e) => areSameExtensions(e.identifier, skippedExtension.identifier))) {
        newSkippedExtensions.push(skippedExtension);
      }
    }
    return newSkippedExtensions;
  }
  updateExtensionState(state, extension, version, extensionStorageService) {
    const extensionState = extensionStorageService.getExtensionState(extension, true) || {};
    const keys = version ? extensionStorageService.getKeysForSync({ id: extension.identifier.id, version }) : void 0;
    if (keys) {
      keys.forEach((key) => {
        extensionState[key] = state[key];
      });
    } else {
      Object.keys(state).forEach((key) => extensionState[key] = state[key]);
    }
    extensionStorageService.setExtensionState(extension, extensionState, true);
  }
  async withProfileScopedServices(profile, fn) {
    return this.userDataProfileStorageService.withProfileScopedStorageService(
      profile,
      async (storageService) => {
        const disposables = new DisposableStore();
        const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IStorageService, storageService])));
        const extensionEnablementService = disposables.add(instantiationService.createInstance(GlobalExtensionEnablementService));
        const extensionStorageService = disposables.add(instantiationService.createInstance(ExtensionStorageService));
        try {
          return await fn(extensionEnablementService, extensionStorageService);
        } finally {
          disposables.dispose();
        }
      }
    );
  }
};
LocalExtensionsProvider = __decorateClass([
  __decorateParam(0, IExtensionManagementService),
  __decorateParam(1, IUserDataProfileStorageService),
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, IIgnoredExtensionsManagementService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IUserDataSyncLogService)
], LocalExtensionsProvider);
let AbstractExtensionsInitializer = class extends AbstractInitializer {
  constructor(extensionManagementService, ignoredExtensionsManagementService, fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
    super(SyncResource.Extensions, userDataProfilesService, environmentService, logService, fileService, storageService, uriIdentityService);
    this.extensionManagementService = extensionManagementService;
    this.ignoredExtensionsManagementService = ignoredExtensionsManagementService;
  }
  async parseExtensions(remoteUserData) {
    return remoteUserData.syncData ? await parseAndMigrateExtensions(remoteUserData.syncData, this.extensionManagementService) : null;
  }
  generatePreview(remoteExtensions, localExtensions) {
    const installedExtensions = [];
    const newExtensions = [];
    const disabledExtensions = [];
    for (const extension of remoteExtensions) {
      if (this.ignoredExtensionsManagementService.hasToNeverSyncExtension(extension.identifier.id)) {
        continue;
      }
      const installedExtension = localExtensions.find((i) => areSameExtensions(i.identifier, extension.identifier));
      if (installedExtension) {
        installedExtensions.push(installedExtension);
        if (extension.disabled) {
          disabledExtensions.push(extension.identifier);
        }
      } else if (extension.installed) {
        newExtensions.push({ ...extension.identifier, preRelease: !!extension.preRelease });
        if (extension.disabled) {
          disabledExtensions.push(extension.identifier);
        }
      }
    }
    return { installedExtensions, newExtensions, disabledExtensions, remoteExtensions };
  }
};
AbstractExtensionsInitializer = __decorateClass([
  __decorateParam(0, IExtensionManagementService),
  __decorateParam(1, IIgnoredExtensionsManagementService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IUserDataProfilesService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IUriIdentityService)
], AbstractExtensionsInitializer);
export {
  AbstractExtensionsInitializer,
  ExtensionsSynchroniser,
  LocalExtensionsProvider,
  parseExtensions,
  stringify
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2V4dGVuc2lvbnNTeW5jLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IGdldEVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHRvRm9ybWF0dGVkU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbkZvcm1hdHRlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY29tcGFyZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLCBJR2FsbGVyeUV4dGVuc2lvbiwgRElTQUJMRURfRVhURU5TSU9OU19TVE9SQUdFX1BBVEgsIEVYVEVOU0lPTl9JTlNUQUxMX1NLSVBfV0FMS1RIUk9VR0hfQ09OVEVYVCwgRVhURU5TSU9OX0lOU1RBTExfU09VUkNFX0NPTlRFWFQsIEluc3RhbGxFeHRlbnNpb25JbmZvLCBFeHRlbnNpb25JbnN0YWxsU291cmNlLCBFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1BVQkxJU0hFUl9UUlVTVF9DT05URVhUIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLCBJRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25TdG9yYWdlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIElFeHRlbnNpb25JZGVudGlmaWVyLCBpc0FwcGxpY2F0aW9uU2NvcGVkRXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RJbml0aWFsaXplciwgQWJzdHJhY3RTeW5jaHJvbmlzZXIsIGdldFN5bmNSZXNvdXJjZUxvZ0xhYmVsLCBJQWNjZXB0UmVzdWx0LCBJTWVyZ2VSZXN1bHQsIElSZXNvdXJjZVByZXZpZXcgfSBmcm9tICcuL2Fic3RyYWN0U3luY2hyb25pemVyLmpzJztcbmltcG9ydCB7IElNZXJnZVJlc3VsdCBhcyBJRXh0ZW5zaW9uTWVyZ2VSZXN1bHQsIG1lcmdlIH0gZnJvbSAnLi9leHRlbnNpb25zTWVyZ2UuanMnO1xuaW1wb3J0IHsgSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuL2lnbm9yZWRFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENoYW5nZSwgSVJlbW90ZVVzZXJEYXRhLCBJU3luY0RhdGEsIElTeW5jRXh0ZW5zaW9uLCBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIElVc2VyRGF0YVN5bmNocm9uaXNlciwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgU3luY1Jlc291cmNlLCBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIElMb2NhbFN5bmNFeHRlbnNpb24gfSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlLmpzJztcblxudHlwZSBJRXh0ZW5zaW9uUmVzb3VyY2VNZXJnZVJlc3VsdCA9IElBY2NlcHRSZXN1bHQgJiBJRXh0ZW5zaW9uTWVyZ2VSZXN1bHQ7XG5cbmludGVyZmFjZSBJRXh0ZW5zaW9uUmVzb3VyY2VQcmV2aWV3IGV4dGVuZHMgSVJlc291cmNlUHJldmlldyB7XG5cdHJlYWRvbmx5IGxvY2FsRXh0ZW5zaW9uczogSUxvY2FsU3luY0V4dGVuc2lvbltdO1xuXHRyZWFkb25seSByZW1vdGVFeHRlbnNpb25zOiBJU3luY0V4dGVuc2lvbltdIHwgbnVsbDtcblx0cmVhZG9ubHkgc2tpcHBlZEV4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW107XG5cdHJlYWRvbmx5IGJ1aWx0aW5FeHRlbnNpb25zOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdIHwgbnVsbDtcblx0cmVhZG9ubHkgcHJldmlld1Jlc3VsdDogSUV4dGVuc2lvblJlc291cmNlTWVyZ2VSZXN1bHQ7XG59XG5cbmludGVyZmFjZSBJTGFzdFN5bmNVc2VyRGF0YSBleHRlbmRzIElSZW1vdGVVc2VyRGF0YSB7XG5cdHNraXBwZWRFeHRlbnNpb25zOiBJU3luY0V4dGVuc2lvbltdIHwgdW5kZWZpbmVkO1xuXHRidWlsdGluRXh0ZW5zaW9uczogSUV4dGVuc2lvbklkZW50aWZpZXJbXSB8IHVuZGVmaW5lZDtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcGFyc2VBbmRNaWdyYXRlRXh0ZW5zaW9ucyhzeW5jRGF0YTogSVN5bmNEYXRhLCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlKTogUHJvbWlzZTxJU3luY0V4dGVuc2lvbltdPiB7XG5cdGNvbnN0IGV4dGVuc2lvbnMgPSBKU09OLnBhcnNlKHN5bmNEYXRhLmNvbnRlbnQpO1xuXHRpZiAoc3luY0RhdGEudmVyc2lvbiA9PT0gMVxuXHRcdHx8IHN5bmNEYXRhLnZlcnNpb24gPT09IDJcblx0KSB7XG5cdFx0Y29uc3QgYnVpbHRpbkV4dGVuc2lvbnMgPSAoYXdhaXQgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKEV4dGVuc2lvblR5cGUuU3lzdGVtKSkuZmlsdGVyKGUgPT4gZS5pc0J1aWx0aW4pO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdC8vICNyZWdpb24gTWlncmF0aW9uIGZyb20gdjEgKGVuYWJsZWQgLT4gZGlzYWJsZWQpXG5cdFx0XHRpZiAoc3luY0RhdGEudmVyc2lvbiA9PT0gMSkge1xuXHRcdFx0XHRpZiAoKDxhbnk+ZXh0ZW5zaW9uKS5lbmFibGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRcdGV4dGVuc2lvbi5kaXNhYmxlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGVsZXRlICg8YW55PmV4dGVuc2lvbikuZW5hYmxlZDtcblx0XHRcdH1cblx0XHRcdC8vICNlbmRyZWdpb25cblxuXHRcdFx0Ly8gI3JlZ2lvbiBNaWdyYXRpb24gZnJvbSB2MiAoc2V0IGluc3RhbGxlZCBwcm9wZXJ0eSBvbiBleHRlbnNpb24pXG5cdFx0XHRpZiAoc3luY0RhdGEudmVyc2lvbiA9PT0gMikge1xuXHRcdFx0XHRpZiAoYnVpbHRpbkV4dGVuc2lvbnMuZXZlcnkoaW5zdGFsbGVkID0+ICFhcmVTYW1lRXh0ZW5zaW9ucyhpbnN0YWxsZWQuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRcdGV4dGVuc2lvbi5pbnN0YWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyAjZW5kcmVnaW9uXG5cdFx0fVxuXHR9XG5cdHJldHVybiBleHRlbnNpb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VFeHRlbnNpb25zKHN5bmNEYXRhOiBJU3luY0RhdGEpOiBJU3luY0V4dGVuc2lvbltdIHtcblx0cmV0dXJuIEpTT04ucGFyc2Uoc3luY0RhdGEuY29udGVudCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdpZnkoZXh0ZW5zaW9uczogSVN5bmNFeHRlbnNpb25bXSwgZm9ybWF0OiBib29sZWFuKTogc3RyaW5nIHtcblx0ZXh0ZW5zaW9ucy5zb3J0KChlMSwgZTIpID0+IHtcblx0XHRpZiAoIWUxLmlkZW50aWZpZXIudXVpZCAmJiBlMi5pZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0aWYgKGUxLmlkZW50aWZpZXIudXVpZCAmJiAhZTIuaWRlbnRpZmllci51dWlkKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbXBhcmUoZTEuaWRlbnRpZmllci5pZCwgZTIuaWRlbnRpZmllci5pZCk7XG5cdH0pO1xuXHRyZXR1cm4gZm9ybWF0ID8gdG9Gb3JtYXR0ZWRTdHJpbmcoZXh0ZW5zaW9ucywge30pIDogSlNPTi5zdHJpbmdpZnkoZXh0ZW5zaW9ucyk7XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zU3luY2hyb25pc2VyIGV4dGVuZHMgQWJzdHJhY3RTeW5jaHJvbmlzZXIgaW1wbGVtZW50cyBJVXNlckRhdGFTeW5jaHJvbmlzZXIge1xuXG5cdC8qXG5cdFx0VmVyc2lvbiAzIC0gSW50cm9kdWNlIGluc3RhbGxlZCBwcm9wZXJ0eSB0byBza2lwIGluc3RhbGxpbmcgYnVpbHQgaW4gZXh0ZW5zaW9uc1xuXHRcdHByb3RlY3RlZCByZWFkb25seSB2ZXJzaW9uOiBudW1iZXIgPSAzO1xuXHQqL1xuXHQvKiBWZXJzaW9uIDQ6IENoYW5nZSBzZXR0aW5ncyBmcm9tIGBzeW5jLiR7c2V0dGluZ31gIHRvIGBzZXR0aW5nc1N5bmMue3NldHRpbmd9YCAqL1xuXHQvKiBWZXJzaW9uIDU6IEludHJvZHVjZSBleHRlbnNpb24gc3RhdGUgKi9cblx0LyogVmVyc2lvbiA2OiBBZGRlZCBpc0FwcGxpY2F0aW9uU2NvcGVkIHByb3BlcnR5ICovXG5cdHByb3RlY3RlZCByZWFkb25seSB2ZXJzaW9uOiBudW1iZXIgPSA2O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJldmlld1Jlc291cmNlOiBVUkkgPSB0aGlzLmV4dFVyaS5qb2luUGF0aCh0aGlzLnN5bmNQcmV2aWV3Rm9sZGVyLCAnZXh0ZW5zaW9ucy5qc29uJyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYmFzZVJlc291cmNlOiBVUkkgPSB0aGlzLnByZXZpZXdSZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ2Jhc2UnIH0pO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxvY2FsUmVzb3VyY2U6IFVSSSA9IHRoaXMucHJldmlld1Jlc291cmNlLndpdGgoeyBzY2hlbWU6IFVTRVJfREFUQV9TWU5DX1NDSEVNRSwgYXV0aG9yaXR5OiAnbG9jYWwnIH0pO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlbW90ZVJlc291cmNlOiBVUkkgPSB0aGlzLnByZXZpZXdSZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ3JlbW90ZScgfSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWNjZXB0ZWRSZXNvdXJjZTogVVJJID0gdGhpcy5wcmV2aWV3UmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogVVNFUl9EQVRBX1NZTkNfU0NIRU1FLCBhdXRob3JpdHk6ICdhY2NlcHRlZCcgfSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2NhbEV4dGVuc2lvbnNQcm92aWRlcjogTG9jYWxFeHRlbnNpb25zUHJvdmlkZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Ly8gcHJvZmlsZUxvY2F0aW9uIGNoYW5nZXMgZm9yIGRlZmF1bHQgcHJvZmlsZVxuXHRcdHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsXG5cdFx0Y29sbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlIHVzZXJEYXRhU3luY1N0b3JlU2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlIHVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElJZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZTogSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UgZXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2U6IElFeHRlbnNpb25TdG9yYWdlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZSB1c2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcih7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLkV4dGVuc2lvbnMsIHByb2ZpbGUgfSwgY29sbGVjdGlvbiwgZmlsZVNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgdXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIHVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHR0aGlzLmxvY2FsRXh0ZW5zaW9uc1Byb3ZpZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMb2NhbEV4dGVuc2lvbnNQcm92aWRlcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRFdmVudC5hbnk8YW55Pihcblx0XHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRJbnN0YWxsRXh0ZW5zaW9ucywgKGUgPT4gZS5zb21lKCh7IGxvY2FsIH0pID0+ICEhbG9jYWwpKSksXG5cdFx0XHRcdEV2ZW50LmZpbHRlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLCAoZSA9PiAhZS5lcnJvcikpLFxuXHRcdFx0XHRFdmVudC5maWx0ZXIodXNlckRhdGFQcm9maWxlU3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2UsIGUgPT4gZS52YWx1ZUNoYW5nZXMuc29tZSgoeyBwcm9maWxlLCBjaGFuZ2VzIH0pID0+IHRoaXMuc3luY1Jlc291cmNlLnByb2ZpbGUuaWQgPT09IHByb2ZpbGUuaWQgJiYgY2hhbmdlcy5zb21lKGNoYW5nZSA9PiBjaGFuZ2Uua2V5ID09PSBESVNBQkxFRF9FWFRFTlNJT05TX1NUT1JBR0VfUEFUSCkpKSxcblx0XHRcdFx0ZXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25TdG9yYWdlVG9TeW5jKSgoKSA9PiB0aGlzLnRyaWdnZXJMb2NhbENoYW5nZSgpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2VuZXJhdGVTeW5jUHJldmlldyhyZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhOiBJTGFzdFN5bmNVc2VyRGF0YSB8IG51bGwpOiBQcm9taXNlPElFeHRlbnNpb25SZXNvdXJjZVByZXZpZXdbXT4ge1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSA/IGF3YWl0IHBhcnNlQW5kTWlncmF0ZUV4dGVuc2lvbnMocmVtb3RlVXNlckRhdGEuc3luY0RhdGEsIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UpIDogbnVsbDtcblx0XHRjb25zdCBza2lwcGVkRXh0ZW5zaW9ucyA9IGxhc3RTeW5jVXNlckRhdGE/LnNraXBwZWRFeHRlbnNpb25zID8/IFtdO1xuXHRcdGNvbnN0IGJ1aWx0aW5FeHRlbnNpb25zID0gbGFzdFN5bmNVc2VyRGF0YT8uYnVpbHRpbkV4dGVuc2lvbnMgPz8gbnVsbDtcblx0XHRjb25zdCBsYXN0U3luY0V4dGVuc2lvbnMgPSBsYXN0U3luY1VzZXJEYXRhPy5zeW5jRGF0YSA/IGF3YWl0IHBhcnNlQW5kTWlncmF0ZUV4dGVuc2lvbnMobGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSkgOiBudWxsO1xuXG5cdFx0Y29uc3QgeyBsb2NhbEV4dGVuc2lvbnMsIGlnbm9yZWRFeHRlbnNpb25zIH0gPSBhd2FpdCB0aGlzLmxvY2FsRXh0ZW5zaW9uc1Byb3ZpZGVyLmdldExvY2FsRXh0ZW5zaW9ucyh0aGlzLnN5bmNSZXNvdXJjZS5wcm9maWxlKTtcblxuXHRcdGlmIChyZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IE1lcmdpbmcgcmVtb3RlIGV4dGVuc2lvbnMgd2l0aCBsb2NhbCBleHRlbnNpb25zLi4uYCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgJHt0aGlzLnN5bmNSZXNvdXJjZUxvZ0xhYmVsfTogUmVtb3RlIGV4dGVuc2lvbnMgZG9lcyBub3QgZXhpc3QuIFN5bmNocm9uaXppbmcgZXh0ZW5zaW9ucyBmb3IgdGhlIGZpcnN0IHRpbWUuYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBsb2NhbCwgcmVtb3RlIH0gPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGxhc3RTeW5jRXh0ZW5zaW9ucywgc2tpcHBlZEV4dGVuc2lvbnMsIGlnbm9yZWRFeHRlbnNpb25zLCBidWlsdGluRXh0ZW5zaW9ucyk7XG5cdFx0Y29uc3QgcHJldmlld1Jlc3VsdDogSUV4dGVuc2lvblJlc291cmNlTWVyZ2VSZXN1bHQgPSB7XG5cdFx0XHRsb2NhbCwgcmVtb3RlLFxuXHRcdFx0Y29udGVudDogdGhpcy5nZXRQcmV2aWV3Q29udGVudChsb2NhbEV4dGVuc2lvbnMsIGxvY2FsLmFkZGVkLCBsb2NhbC51cGRhdGVkLCBsb2NhbC5yZW1vdmVkKSxcblx0XHRcdGxvY2FsQ2hhbmdlOiBsb2NhbC5hZGRlZC5sZW5ndGggPiAwIHx8IGxvY2FsLnJlbW92ZWQubGVuZ3RoID4gMCB8fCBsb2NhbC51cGRhdGVkLmxlbmd0aCA+IDAgPyBDaGFuZ2UuTW9kaWZpZWQgOiBDaGFuZ2UuTm9uZSxcblx0XHRcdHJlbW90ZUNoYW5nZTogcmVtb3RlICE9PSBudWxsID8gQ2hhbmdlLk1vZGlmaWVkIDogQ2hhbmdlLk5vbmUsXG5cdFx0fTtcblxuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHRoaXMuc3RyaW5naWZ5KGxvY2FsRXh0ZW5zaW9ucywgZmFsc2UpO1xuXHRcdHJldHVybiBbe1xuXHRcdFx0c2tpcHBlZEV4dGVuc2lvbnMsXG5cdFx0XHRidWlsdGluRXh0ZW5zaW9ucyxcblx0XHRcdGJhc2VSZXNvdXJjZTogdGhpcy5iYXNlUmVzb3VyY2UsXG5cdFx0XHRiYXNlQ29udGVudDogbGFzdFN5bmNFeHRlbnNpb25zID8gdGhpcy5zdHJpbmdpZnkobGFzdFN5bmNFeHRlbnNpb25zLCBmYWxzZSkgOiBsb2NhbENvbnRlbnQsXG5cdFx0XHRsb2NhbFJlc291cmNlOiB0aGlzLmxvY2FsUmVzb3VyY2UsXG5cdFx0XHRsb2NhbENvbnRlbnQsXG5cdFx0XHRsb2NhbEV4dGVuc2lvbnMsXG5cdFx0XHRyZW1vdGVSZXNvdXJjZTogdGhpcy5yZW1vdGVSZXNvdXJjZSxcblx0XHRcdHJlbW90ZUV4dGVuc2lvbnMsXG5cdFx0XHRyZW1vdGVDb250ZW50OiByZW1vdGVFeHRlbnNpb25zID8gdGhpcy5zdHJpbmdpZnkocmVtb3RlRXh0ZW5zaW9ucywgZmFsc2UpIDogbnVsbCxcblx0XHRcdHByZXZpZXdSZXNvdXJjZTogdGhpcy5wcmV2aWV3UmVzb3VyY2UsXG5cdFx0XHRwcmV2aWV3UmVzdWx0LFxuXHRcdFx0bG9jYWxDaGFuZ2U6IHByZXZpZXdSZXN1bHQubG9jYWxDaGFuZ2UsXG5cdFx0XHRyZW1vdGVDaGFuZ2U6IHByZXZpZXdSZXN1bHQucmVtb3RlQ2hhbmdlLFxuXHRcdFx0YWNjZXB0ZWRSZXNvdXJjZTogdGhpcy5hY2NlcHRlZFJlc291cmNlLFxuXHRcdH1dO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGhhc1JlbW90ZUNoYW5nZWQobGFzdFN5bmNVc2VyRGF0YTogSUxhc3RTeW5jVXNlckRhdGEpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBsYXN0U3luY0V4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW10gfCBudWxsID0gbGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSA/IGF3YWl0IHBhcnNlQW5kTWlncmF0ZUV4dGVuc2lvbnMobGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSkgOiBudWxsO1xuXHRcdGNvbnN0IHsgbG9jYWxFeHRlbnNpb25zLCBpZ25vcmVkRXh0ZW5zaW9ucyB9ID0gYXdhaXQgdGhpcy5sb2NhbEV4dGVuc2lvbnNQcm92aWRlci5nZXRMb2NhbEV4dGVuc2lvbnModGhpcy5zeW5jUmVzb3VyY2UucHJvZmlsZSk7XG5cdFx0Y29uc3QgeyByZW1vdGUgfSA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgbGFzdFN5bmNFeHRlbnNpb25zLCBsYXN0U3luY0V4dGVuc2lvbnMsIGxhc3RTeW5jVXNlckRhdGEuc2tpcHBlZEV4dGVuc2lvbnMgfHwgW10sIGlnbm9yZWRFeHRlbnNpb25zLCBsYXN0U3luY1VzZXJEYXRhLmJ1aWx0aW5FeHRlbnNpb25zIHx8IFtdKTtcblx0XHRyZXR1cm4gcmVtb3RlICE9PSBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQcmV2aWV3Q29udGVudChsb2NhbEV4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW10sIGFkZGVkOiBJU3luY0V4dGVuc2lvbltdLCB1cGRhdGVkOiBJU3luY0V4dGVuc2lvbltdLCByZW1vdmVkOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdKTogc3RyaW5nIHtcblx0XHRjb25zdCBwcmV2aWV3OiBJU3luY0V4dGVuc2lvbltdID0gWy4uLmFkZGVkLCAuLi51cGRhdGVkXTtcblxuXHRcdGNvbnN0IGlkc09yVVVJRHM6IFNldDxzdHJpbmc+ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Y29uc3QgYWRkSWRlbnRpZmllciA9IChpZGVudGlmaWVyOiBJRXh0ZW5zaW9uSWRlbnRpZmllcikgPT4ge1xuXHRcdFx0aWRzT3JVVUlEcy5hZGQoaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdGlmIChpZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdFx0aWRzT3JVVUlEcy5hZGQoaWRlbnRpZmllci51dWlkKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHByZXZpZXcuZm9yRWFjaCgoeyBpZGVudGlmaWVyIH0pID0+IGFkZElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXHRcdHJlbW92ZWQuZm9yRWFjaChhZGRJZGVudGlmaWVyKTtcblxuXHRcdGZvciAoY29uc3QgbG9jYWxFeHRlbnNpb24gb2YgbG9jYWxFeHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoaWRzT3JVVUlEcy5oYXMobG9jYWxFeHRlbnNpb24uaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKSB8fCAobG9jYWxFeHRlbnNpb24uaWRlbnRpZmllci51dWlkICYmIGlkc09yVVVJRHMuaGFzKGxvY2FsRXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCkpKSB7XG5cdFx0XHRcdC8vIHNraXBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRwcmV2aWV3LnB1c2gobG9jYWxFeHRlbnNpb24pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnN0cmluZ2lmeShwcmV2aWV3LCBmYWxzZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0TWVyZ2VSZXN1bHQocmVzb3VyY2VQcmV2aWV3OiBJRXh0ZW5zaW9uUmVzb3VyY2VQcmV2aWV3LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElNZXJnZVJlc3VsdD4ge1xuXHRcdHJldHVybiB7IC4uLnJlc291cmNlUHJldmlldy5wcmV2aWV3UmVzdWx0LCBoYXNDb25mbGljdHM6IGZhbHNlIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0QWNjZXB0UmVzdWx0KHJlc291cmNlUHJldmlldzogSUV4dGVuc2lvblJlc291cmNlUHJldmlldywgcmVzb3VyY2U6IFVSSSwgY29udGVudDogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRXh0ZW5zaW9uUmVzb3VyY2VNZXJnZVJlc3VsdD4ge1xuXG5cdFx0LyogQWNjZXB0IGxvY2FsIHJlc291cmNlICovXG5cdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2UsIHRoaXMubG9jYWxSZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmFjY2VwdExvY2FsKHJlc291cmNlUHJldmlldyk7XG5cdFx0fVxuXG5cdFx0LyogQWNjZXB0IHJlbW90ZSByZXNvdXJjZSAqL1xuXHRcdGlmICh0aGlzLmV4dFVyaS5pc0VxdWFsKHJlc291cmNlLCB0aGlzLnJlbW90ZVJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuYWNjZXB0UmVtb3RlKHJlc291cmNlUHJldmlldyk7XG5cdFx0fVxuXG5cdFx0LyogQWNjZXB0IHByZXZpZXcgcmVzb3VyY2UgKi9cblx0XHRpZiAodGhpcy5leHRVcmkuaXNFcXVhbChyZXNvdXJjZSwgdGhpcy5wcmV2aWV3UmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VQcmV2aWV3LnByZXZpZXdSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIFJlc291cmNlOiAke3Jlc291cmNlLnRvU3RyaW5nKCl9YCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFjY2VwdExvY2FsKHJlc291cmNlUHJldmlldzogSUV4dGVuc2lvblJlc291cmNlUHJldmlldyk6IFByb21pc2U8SUV4dGVuc2lvblJlc291cmNlTWVyZ2VSZXN1bHQ+IHtcblx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQodW5kZWZpbmVkLCB0aGlzLnN5bmNSZXNvdXJjZS5wcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0Y29uc3QgaWdub3JlZEV4dGVuc2lvbnMgPSB0aGlzLmlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UuZ2V0SWdub3JlZEV4dGVuc2lvbnMoaW5zdGFsbGVkRXh0ZW5zaW9ucyk7XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IHJlc291cmNlUHJldmlldy5yZW1vdGVDb250ZW50ID8gSlNPTi5wYXJzZShyZXNvdXJjZVByZXZpZXcucmVtb3RlQ29udGVudCkgOiBudWxsO1xuXHRcdGNvbnN0IG1lcmdlUmVzdWx0ID0gbWVyZ2UocmVzb3VyY2VQcmV2aWV3LmxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVzb3VyY2VQcmV2aWV3LnNraXBwZWRFeHRlbnNpb25zLCBpZ25vcmVkRXh0ZW5zaW9ucywgcmVzb3VyY2VQcmV2aWV3LmJ1aWx0aW5FeHRlbnNpb25zKTtcblx0XHRjb25zdCB7IGxvY2FsLCByZW1vdGUgfSA9IG1lcmdlUmVzdWx0O1xuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZW50OiByZXNvdXJjZVByZXZpZXcubG9jYWxDb250ZW50LFxuXHRcdFx0bG9jYWwsXG5cdFx0XHRyZW1vdGUsXG5cdFx0XHRsb2NhbENoYW5nZTogbG9jYWwuYWRkZWQubGVuZ3RoID4gMCB8fCBsb2NhbC5yZW1vdmVkLmxlbmd0aCA+IDAgfHwgbG9jYWwudXBkYXRlZC5sZW5ndGggPiAwID8gQ2hhbmdlLk1vZGlmaWVkIDogQ2hhbmdlLk5vbmUsXG5cdFx0XHRyZW1vdGVDaGFuZ2U6IHJlbW90ZSAhPT0gbnVsbCA/IENoYW5nZS5Nb2RpZmllZCA6IENoYW5nZS5Ob25lLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFjY2VwdFJlbW90ZShyZXNvdXJjZVByZXZpZXc6IElFeHRlbnNpb25SZXNvdXJjZVByZXZpZXcpOiBQcm9taXNlPElFeHRlbnNpb25SZXNvdXJjZU1lcmdlUmVzdWx0PiB7XG5cdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKHVuZGVmaW5lZCwgdGhpcy5zeW5jUmVzb3VyY2UucHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdGNvbnN0IGlnbm9yZWRFeHRlbnNpb25zID0gdGhpcy5pZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlLmdldElnbm9yZWRFeHRlbnNpb25zKGluc3RhbGxlZEV4dGVuc2lvbnMpO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSByZXNvdXJjZVByZXZpZXcucmVtb3RlQ29udGVudCA/IEpTT04ucGFyc2UocmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQpIDogbnVsbDtcblx0XHRpZiAocmVtb3RlRXh0ZW5zaW9ucyAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgbWVyZ2VSZXN1bHQgPSBtZXJnZShyZXNvdXJjZVByZXZpZXcubG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCByZXNvdXJjZVByZXZpZXcubG9jYWxFeHRlbnNpb25zLCBbXSwgaWdub3JlZEV4dGVuc2lvbnMsIHJlc291cmNlUHJldmlldy5idWlsdGluRXh0ZW5zaW9ucyk7XG5cdFx0XHRjb25zdCB7IGxvY2FsLCByZW1vdGUgfSA9IG1lcmdlUmVzdWx0O1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29udGVudDogcmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQsXG5cdFx0XHRcdGxvY2FsLFxuXHRcdFx0XHRyZW1vdGUsXG5cdFx0XHRcdGxvY2FsQ2hhbmdlOiBsb2NhbC5hZGRlZC5sZW5ndGggPiAwIHx8IGxvY2FsLnJlbW92ZWQubGVuZ3RoID4gMCB8fCBsb2NhbC51cGRhdGVkLmxlbmd0aCA+IDAgPyBDaGFuZ2UuTW9kaWZpZWQgOiBDaGFuZ2UuTm9uZSxcblx0XHRcdFx0cmVtb3RlQ2hhbmdlOiByZW1vdGUgIT09IG51bGwgPyBDaGFuZ2UuTW9kaWZpZWQgOiBDaGFuZ2UuTm9uZSxcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNvbnRlbnQ6IHJlc291cmNlUHJldmlldy5yZW1vdGVDb250ZW50LFxuXHRcdFx0XHRsb2NhbDogeyBhZGRlZDogW10sIHJlbW92ZWQ6IFtdLCB1cGRhdGVkOiBbXSB9LFxuXHRcdFx0XHRyZW1vdGU6IG51bGwsXG5cdFx0XHRcdGxvY2FsQ2hhbmdlOiBDaGFuZ2UuTm9uZSxcblx0XHRcdFx0cmVtb3RlQ2hhbmdlOiBDaGFuZ2UuTm9uZSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGFwcGx5UmVzdWx0KHJlbW90ZVVzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSB8IG51bGwsIHJlc291cmNlUHJldmlld3M6IFtJRXh0ZW5zaW9uUmVzb3VyY2VQcmV2aWV3LCBJRXh0ZW5zaW9uUmVzb3VyY2VNZXJnZVJlc3VsdF1bXSwgZm9yY2U6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgeyBza2lwcGVkRXh0ZW5zaW9ucywgYnVpbHRpbkV4dGVuc2lvbnMsIGxvY2FsRXh0ZW5zaW9ucyB9ID0gcmVzb3VyY2VQcmV2aWV3c1swXVswXTtcblx0XHRjb25zdCB7IGxvY2FsLCByZW1vdGUsIGxvY2FsQ2hhbmdlLCByZW1vdGVDaGFuZ2UgfSA9IHJlc291cmNlUHJldmlld3NbMF1bMV07XG5cblx0XHRpZiAobG9jYWxDaGFuZ2UgPT09IENoYW5nZS5Ob25lICYmIHJlbW90ZUNoYW5nZSA9PT0gQ2hhbmdlLk5vbmUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBObyBjaGFuZ2VzIGZvdW5kIGR1cmluZyBzeW5jaHJvbml6aW5nIGV4dGVuc2lvbnMuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGxvY2FsQ2hhbmdlICE9PSBDaGFuZ2UuTm9uZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5iYWNrdXBMb2NhbChKU09OLnN0cmluZ2lmeShsb2NhbEV4dGVuc2lvbnMpKTtcblx0XHRcdHNraXBwZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5sb2NhbEV4dGVuc2lvbnNQcm92aWRlci51cGRhdGVMb2NhbEV4dGVuc2lvbnMobG9jYWwuYWRkZWQsIGxvY2FsLnJlbW92ZWQsIGxvY2FsLnVwZGF0ZWQsIHNraXBwZWRFeHRlbnNpb25zLCB0aGlzLnN5bmNSZXNvdXJjZS5wcm9maWxlKTtcblx0XHR9XG5cblx0XHRpZiAocmVtb3RlKSB7XG5cdFx0XHQvLyB1cGRhdGUgcmVtb3RlXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7dGhpcy5zeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVwZGF0aW5nIHJlbW90ZSBleHRlbnNpb25zLi4uYCk7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkocmVtb3RlLmFsbCk7XG5cdFx0XHRyZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRoaXMudXBkYXRlUmVtb3RlVXNlckRhdGEoY29udGVudCwgZm9yY2UgPyBudWxsIDogcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBVcGRhdGVkIHJlbW90ZSBleHRlbnNpb25zLiR7cmVtb3RlLmFkZGVkLmxlbmd0aCA/IGAgQWRkZWQ6ICR7SlNPTi5zdHJpbmdpZnkocmVtb3RlLmFkZGVkLm1hcChlID0+IGUuaWRlbnRpZmllci5pZCkpfS5gIDogJyd9JHtyZW1vdGUudXBkYXRlZC5sZW5ndGggPyBgIFVwZGF0ZWQ6ICR7SlNPTi5zdHJpbmdpZnkocmVtb3RlLnVwZGF0ZWQubWFwKGUgPT4gZS5pZGVudGlmaWVyLmlkKSl9LmAgOiAnJ30ke3JlbW90ZS5yZW1vdmVkLmxlbmd0aCA/IGAgUmVtb3ZlZDogJHtKU09OLnN0cmluZ2lmeShyZW1vdGUucmVtb3ZlZC5tYXAoZSA9PiBlLmlkZW50aWZpZXIuaWQpKX0uYCA6ICcnfWApO1xuXHRcdH1cblxuXHRcdGlmIChsYXN0U3luY1VzZXJEYXRhPy5yZWYgIT09IHJlbW90ZVVzZXJEYXRhLnJlZikge1xuXHRcdFx0Ly8gdXBkYXRlIGxhc3Qgc3luY1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBVcGRhdGluZyBsYXN0IHN5bmNocm9uaXplZCBleHRlbnNpb25zLi4uYCk7XG5cdFx0XHRidWlsdGluRXh0ZW5zaW9ucyA9IHRoaXMuY29tcHV0ZUJ1aWx0aW5FeHRlbnNpb25zKGxvY2FsRXh0ZW5zaW9ucywgYnVpbHRpbkV4dGVuc2lvbnMpO1xuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVMYXN0U3luY1VzZXJEYXRhKHJlbW90ZVVzZXJEYXRhLCB7IHNraXBwZWRFeHRlbnNpb25zLCBidWlsdGluRXh0ZW5zaW9ucyB9KTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3RoaXMuc3luY1Jlc291cmNlTG9nTGFiZWx9OiBVcGRhdGVkIGxhc3Qgc3luY2hyb25pemVkIGV4dGVuc2lvbnMuJHtza2lwcGVkRXh0ZW5zaW9ucy5sZW5ndGggPyBgIFNraXBwZWQ6ICR7SlNPTi5zdHJpbmdpZnkoc2tpcHBlZEV4dGVuc2lvbnMubWFwKGUgPT4gZS5pZGVudGlmaWVyLmlkKSl9LmAgOiAnJ31gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVCdWlsdGluRXh0ZW5zaW9ucyhsb2NhbEV4dGVuc2lvbnM6IElMb2NhbFN5bmNFeHRlbnNpb25bXSwgcHJldmlvdXNCdWlsdGluRXh0ZW5zaW9uczogSUV4dGVuc2lvbklkZW50aWZpZXJbXSB8IG51bGwpOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdIHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRjb25zdCBidWlsdGluRXh0ZW5zaW9uczogSUV4dGVuc2lvbklkZW50aWZpZXJbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgbG9jYWxFeHRlbnNpb24gb2YgbG9jYWxFeHRlbnNpb25zKSB7XG5cdFx0XHRsb2NhbEV4dGVuc2lvbnNTZXQuYWRkKGxvY2FsRXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRpZiAoIWxvY2FsRXh0ZW5zaW9uLmluc3RhbGxlZCkge1xuXHRcdFx0XHRidWlsdGluRXh0ZW5zaW9ucy5wdXNoKGxvY2FsRXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAocHJldmlvdXNCdWlsdGluRXh0ZW5zaW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBidWlsdGluRXh0ZW5zaW9uIG9mIHByZXZpb3VzQnVpbHRpbkV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Ly8gQWRkIHByZXZpb3VzIGJ1aWx0aW4gZXh0ZW5zaW9uIGlmIGl0IGRvZXMgbm90IGV4aXN0IGluIGxvY2FsIGV4dGVuc2lvbnNcblx0XHRcdFx0aWYgKCFsb2NhbEV4dGVuc2lvbnNTZXQuaGFzKGJ1aWx0aW5FeHRlbnNpb24uaWQudG9Mb3dlckNhc2UoKSkpIHtcblx0XHRcdFx0XHRidWlsdGluRXh0ZW5zaW9ucy5wdXNoKGJ1aWx0aW5FeHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBidWlsdGluRXh0ZW5zaW9ucztcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVDb250ZW50KHVyaTogVVJJKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0aWYgKHRoaXMuZXh0VXJpLmlzRXF1YWwodGhpcy5yZW1vdGVSZXNvdXJjZSwgdXJpKVxuXHRcdFx0fHwgdGhpcy5leHRVcmkuaXNFcXVhbCh0aGlzLmJhc2VSZXNvdXJjZSwgdXJpKVxuXHRcdFx0fHwgdGhpcy5leHRVcmkuaXNFcXVhbCh0aGlzLmxvY2FsUmVzb3VyY2UsIHVyaSlcblx0XHRcdHx8IHRoaXMuZXh0VXJpLmlzRXF1YWwodGhpcy5hY2NlcHRlZFJlc291cmNlLCB1cmkpXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJldmlld0NvbnRlbnQodXJpKTtcblx0XHRcdHJldHVybiBjb250ZW50ID8gdGhpcy5zdHJpbmdpZnkoSlNPTi5wYXJzZShjb250ZW50KSwgdHJ1ZSkgOiBjb250ZW50O1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgc3RyaW5naWZ5KGV4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW10sIGZvcm1hdDogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHN0cmluZ2lmeShleHRlbnNpb25zLCBmb3JtYXQpO1xuXHR9XG5cblx0YXN5bmMgaGFzTG9jYWxEYXRhKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB7IGxvY2FsRXh0ZW5zaW9ucyB9ID0gYXdhaXQgdGhpcy5sb2NhbEV4dGVuc2lvbnNQcm92aWRlci5nZXRMb2NhbEV4dGVuc2lvbnModGhpcy5zeW5jUmVzb3VyY2UucHJvZmlsZSk7XG5cdFx0XHRpZiAobG9jYWxFeHRlbnNpb25zLnNvbWUoZSA9PiBlLmluc3RhbGxlZCB8fCBlLmRpc2FibGVkKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0LyogaWdub3JlIGVycm9yICovXG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBMb2NhbEV4dGVuc2lvbnNQcm92aWRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElJZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZTogSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgZ2V0TG9jYWxFeHRlbnNpb25zKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHsgbG9jYWxFeHRlbnNpb25zOiBJTG9jYWxTeW5jRXh0ZW5zaW9uW107IGlnbm9yZWRFeHRlbnNpb25zOiBzdHJpbmdbXSB9PiB7XG5cdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKHVuZGVmaW5lZCwgcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdGNvbnN0IGlnbm9yZWRFeHRlbnNpb25zID0gdGhpcy5pZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlLmdldElnbm9yZWRFeHRlbnNpb25zKGluc3RhbGxlZEV4dGVuc2lvbnMpO1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMud2l0aFByb2ZpbGVTY29wZWRTZXJ2aWNlcyhwcm9maWxlLCBhc3luYyAoZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNhYmxlZEV4dGVuc2lvbnMgPSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZS5nZXREaXNhYmxlZEV4dGVuc2lvbnMoKTtcblx0XHRcdHJldHVybiBpbnN0YWxsZWRFeHRlbnNpb25zXG5cdFx0XHRcdC5tYXAoZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0XHRjb25zdCB7IGlkZW50aWZpZXIsIGlzQnVpbHRpbiwgbWFuaWZlc3QsIHByZVJlbGVhc2UsIHBpbm5lZCwgaXNBcHBsaWNhdGlvblNjb3BlZCB9ID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdGNvbnN0IHN5bmNFeG50ZXNpb246IElMb2NhbFN5bmNFeHRlbnNpb24gPSB7IGlkZW50aWZpZXIsIHByZVJlbGVhc2UsIHZlcnNpb246IG1hbmlmZXN0LnZlcnNpb24sIHBpbm5lZDogISFwaW5uZWQgfTtcblx0XHRcdFx0XHRpZiAoaXNBcHBsaWNhdGlvblNjb3BlZCAmJiAhaXNBcHBsaWNhdGlvblNjb3BlZEV4dGVuc2lvbihtYW5pZmVzdCkpIHtcblx0XHRcdFx0XHRcdHN5bmNFeG50ZXNpb24uaXNBcHBsaWNhdGlvblNjb3BlZCA9IGlzQXBwbGljYXRpb25TY29wZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkaXNhYmxlZEV4dGVuc2lvbnMuc29tZShkaXNhYmxlZEV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhkaXNhYmxlZEV4dGVuc2lvbiwgaWRlbnRpZmllcikpKSB7XG5cdFx0XHRcdFx0XHRzeW5jRXhudGVzaW9uLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFpc0J1aWx0aW4pIHtcblx0XHRcdFx0XHRcdHN5bmNFeG50ZXNpb24uaW5zdGFsbGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGtleXMgPSBleHRlbnNpb25TdG9yYWdlU2VydmljZS5nZXRLZXlzRm9yU3luYyh7IGlkOiBpZGVudGlmaWVyLmlkLCB2ZXJzaW9uOiBtYW5pZmVzdC52ZXJzaW9uIH0pO1xuXHRcdFx0XHRcdFx0aWYgKGtleXMpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uU3RvcmFnZVN0YXRlID0gZXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0ZW5zaW9uLCB0cnVlKSB8fCB7fTtcblx0XHRcdFx0XHRcdFx0c3luY0V4bnRlc2lvbi5zdGF0ZSA9IE9iamVjdC5rZXlzKGV4dGVuc2lvblN0b3JhZ2VTdGF0ZSkucmVkdWNlKChzdGF0ZTogSVN0cmluZ0RpY3Rpb25hcnk8YW55Piwga2V5KSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGtleXMuaW5jbHVkZXMoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0c3RhdGVba2V5XSA9IGV4dGVuc2lvblN0b3JhZ2VTdGF0ZVtrZXldO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gc3RhdGU7XG5cdFx0XHRcdFx0XHRcdH0sIHt9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7Z2V0U3luY1Jlc291cmNlTG9nTGFiZWwoU3luY1Jlc291cmNlLkV4dGVuc2lvbnMsIHByb2ZpbGUpfTogRXJyb3Igd2hpbGUgcGFyc2luZyBleHRlbnNpb24gc3RhdGVgLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHN5bmNFeG50ZXNpb247XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHJldHVybiB7IGxvY2FsRXh0ZW5zaW9ucywgaWdub3JlZEV4dGVuc2lvbnMgfTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUxvY2FsRXh0ZW5zaW9ucyhhZGRlZDogSVN5bmNFeHRlbnNpb25bXSwgcmVtb3ZlZDogSUV4dGVuc2lvbklkZW50aWZpZXJbXSwgdXBkYXRlZDogSVN5bmNFeHRlbnNpb25bXSwgc2tpcHBlZEV4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW10sIHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPElTeW5jRXh0ZW5zaW9uW10+IHtcblx0XHRjb25zdCBzeW5jUmVzb3VyY2VMb2dMYWJlbCA9IGdldFN5bmNSZXNvdXJjZUxvZ0xhYmVsKFN5bmNSZXNvdXJjZS5FeHRlbnNpb25zLCBwcm9maWxlKTtcblx0XHRjb25zdCBleHRlbnNpb25zVG9JbnN0YWxsOiBJbnN0YWxsRXh0ZW5zaW9uSW5mb1tdID0gW107XG5cdFx0Y29uc3Qgc3luY0V4dGVuc2lvbnNUb0luc3RhbGwgPSBuZXcgTWFwPHN0cmluZywgSVN5bmNFeHRlbnNpb24+KCk7XG5cdFx0Y29uc3QgcmVtb3ZlRnJvbVNraXBwZWQ6IElFeHRlbnNpb25JZGVudGlmaWVyW10gPSBbXTtcblx0XHRjb25zdCBhZGRUb1NraXBwZWQ6IElTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQodW5kZWZpbmVkLCBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cblx0XHQvLyAxLiBTeW5jIGV4dGVuc2lvbnMgc3RhdGUgZmlyc3Qgc28gdGhhdCB0aGUgc3RvcmFnZSBpcyBmbHVzaGVkIGFuZCB1cGRhdGVkIGluIGFsbCBvcGVuZWQgd2luZG93c1xuXHRcdGlmIChhZGRlZC5sZW5ndGggfHwgdXBkYXRlZC5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMud2l0aFByb2ZpbGVTY29wZWRTZXJ2aWNlcyhwcm9maWxlLCBhc3luYyAoZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlKSA9PiB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoWy4uLmFkZGVkLCAuLi51cGRhdGVkXS5tYXAoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9uID0gaW5zdGFsbGVkRXh0ZW5zaW9ucy5maW5kKGluc3RhbGxlZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpbnN0YWxsZWQuaWRlbnRpZmllciwgZS5pZGVudGlmaWVyKSk7XG5cblx0XHRcdFx0XHQvLyBCdWlsdGluIEV4dGVuc2lvbiBTeW5jOiBFbmFibGVtZW50ICYgU3RhdGVcblx0XHRcdFx0XHRpZiAoaW5zdGFsbGVkRXh0ZW5zaW9uICYmIGluc3RhbGxlZEV4dGVuc2lvbi5pc0J1aWx0aW4pIHtcblx0XHRcdFx0XHRcdGlmIChlLnN0YXRlICYmIGluc3RhbGxlZEV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uID09PSBlLnZlcnNpb24pIHtcblx0XHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25TdGF0ZShlLnN0YXRlLCBpbnN0YWxsZWRFeHRlbnNpb24sIGluc3RhbGxlZEV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uLCBleHRlbnNpb25TdG9yYWdlU2VydmljZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBpc0Rpc2FibGVkID0gZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCkuc29tZShkaXNhYmxlZEV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhkaXNhYmxlZEV4dGVuc2lvbiwgZS5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0XHRpZiAoaXNEaXNhYmxlZCAhPT0gISFlLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHRcdGlmIChlLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogRGlzYWJsaW5nIGV4dGVuc2lvbi4uLmAsIGUuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZGlzYWJsZUV4dGVuc2lvbihlLmlkZW50aWZpZXIpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogRGlzYWJsZWQgZXh0ZW5zaW9uYCwgZS5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBFbmFibGluZyBleHRlbnNpb24uLi5gLCBlLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbihlLmlkZW50aWZpZXIpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogRW5hYmxlZCBleHRlbnNpb25gLCBlLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZW1vdmVGcm9tU2tpcHBlZC5wdXNoKGUuaWRlbnRpZmllcik7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gVXNlciBFeHRlbnNpb24gU3luYzogSW5zdGFsbC9VcGRhdGUsIEVuYWJsZW1lbnQgJiBTdGF0ZVxuXHRcdFx0XHRcdGNvbnN0IHZlcnNpb24gPSBlLnBpbm5lZCA/IGUudmVyc2lvbiA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IC4uLmUuaWRlbnRpZmllciwgdmVyc2lvbiwgcHJlUmVsZWFzZTogdmVyc2lvbiA/IHVuZGVmaW5lZCA6IGUucHJlUmVsZWFzZSB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdO1xuXG5cdFx0XHRcdFx0LyogVXBkYXRlIGV4dGVuc2lvbiBzdGF0ZSBvbmx5IGlmXG5cdFx0XHRcdFx0ICpcdGV4dGVuc2lvbiBpcyBpbnN0YWxsZWQgYW5kIHZlcnNpb24gaXMgc2FtZSBhcyBzeW5jZWQgdmVyc2lvbiBvclxuXHRcdFx0XHRcdCAqXHRleHRlbnNpb24gaXMgbm90IGluc3RhbGxlZCBhbmQgaW5zdGFsbGFibGVcblx0XHRcdFx0XHQgKi9cblx0XHRcdFx0XHRpZiAoZS5zdGF0ZSAmJlxuXHRcdFx0XHRcdFx0KGluc3RhbGxlZEV4dGVuc2lvbiA/IGluc3RhbGxlZEV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uID09PSBlLnZlcnNpb24gLyogSW5zdGFsbGVkIGFuZCByZW1vdGUgaGFzIHNhbWUgdmVyc2lvbiAqL1xuXHRcdFx0XHRcdFx0XHQ6ICEhZXh0ZW5zaW9uIC8qIEluc3RhbGxhYmxlICovKVxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25TdGF0ZShlLnN0YXRlLCBpbnN0YWxsZWRFeHRlbnNpb24gfHwgZXh0ZW5zaW9uLCBpbnN0YWxsZWRFeHRlbnNpb24/Lm1hbmlmZXN0LnZlcnNpb24sIGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBpc0Rpc2FibGVkID0gZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCkuc29tZShkaXNhYmxlZEV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhkaXNhYmxlZEV4dGVuc2lvbiwgZS5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0XHRcdGlmIChpc0Rpc2FibGVkICE9PSAhIWUuZGlzYWJsZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZS5kaXNhYmxlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogRGlzYWJsaW5nIGV4dGVuc2lvbi4uLmAsIGUuaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZGlzYWJsZUV4dGVuc2lvbihleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHtzeW5jUmVzb3VyY2VMb2dMYWJlbH06IERpc2FibGVkIGV4dGVuc2lvbmAsIGUuaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBFbmFibGluZyBleHRlbnNpb24uLi5gLCBlLmlkZW50aWZpZXIuaWQsIGV4dGVuc2lvbi52ZXJzaW9uKTtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbihleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHtzeW5jUmVzb3VyY2VMb2dMYWJlbH06IEVuYWJsZWQgZXh0ZW5zaW9uYCwgZS5pZGVudGlmaWVyLmlkLCBleHRlbnNpb24udmVyc2lvbik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0aWYgKCFpbnN0YWxsZWRFeHRlbnNpb24gLy8gSW5zdGFsbCBpZiB0aGUgZXh0ZW5zaW9uIGRvZXMgbm90IGV4aXN0XG5cdFx0XHRcdFx0XHRcdFx0fHwgaW5zdGFsbGVkRXh0ZW5zaW9uLnByZVJlbGVhc2UgIT09IGUucHJlUmVsZWFzZSAvLyBJbnN0YWxsIGlmIHRoZSBleHRlbnNpb24gcHJlLXJlbGVhc2UgcHJlZmVyZW5jZSBoYXMgY2hhbmdlZFxuXHRcdFx0XHRcdFx0XHRcdHx8IGluc3RhbGxlZEV4dGVuc2lvbi5waW5uZWQgIT09IGUucGlubmVkICAvLyBJbnN0YWxsIGlmIHRoZSBleHRlbnNpb24gcGlubmVkIHByZWZlcmVuY2UgaGFzIGNoYW5nZWRcblx0XHRcdFx0XHRcdFx0XHR8fCAodmVyc2lvbiAmJiBpbnN0YWxsZWRFeHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbiAhPT0gdmVyc2lvbikgIC8vIEluc3RhbGwgaWYgdGhlIGV4dGVuc2lvbiB2ZXJzaW9uIGhhcyBjaGFuZ2VkXG5cdFx0XHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmNhbkluc3RhbGwoZXh0ZW5zaW9uKSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvSW5zdGFsbC5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uLCBvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiBmYWxzZSAvKiBzZXQgaXNNYWNoaW5lU2NvcGVkIHZhbHVlIHRvIHByZXZlbnQgaW5zdGFsbCBhbmQgc3luYyBkaWFsb2cgaW4gd2ViICovLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRvbm90SW5jbHVkZVBhY2tBbmREZXBlbmRlbmNpZXM6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0aW5zdGFsbEdpdmVuVmVyc2lvbjogZS5waW5uZWQgJiYgISFlLnZlcnNpb24sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cGlubmVkOiBlLnBpbm5lZCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IGUucHJlUmVsZWFzZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRwcmVSZWxlYXNlOiBlLnByZVJlbGVhc2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cHJvZmlsZUxvY2F0aW9uOiBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRpc0FwcGxpY2F0aW9uU2NvcGVkOiBlLmlzQXBwbGljYXRpb25TY29wZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGV4dDogeyBbRVhURU5TSU9OX0lOU1RBTExfU0tJUF9XQUxLVEhST1VHSF9DT05URVhUXTogdHJ1ZSwgW0VYVEVOU0lPTl9JTlNUQUxMX1NPVVJDRV9DT05URVhUXTogRXh0ZW5zaW9uSW5zdGFsbFNvdXJjZS5TRVRUSU5HU19TWU5DLCBbRVhURU5TSU9OX0lOU1RBTExfU0tJUF9QVUJMSVNIRVJfVFJVU1RfQ09OVEVYVF06IHRydWUgfVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdHN5bmNFeHRlbnNpb25zVG9JbnN0YWxsLnNldChleHRlbnNpb24uaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpLCBlKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBTa2lwcGVkIHN5bmNocm9uaXppbmcgZXh0ZW5zaW9uIGJlY2F1c2UgaXQgY2Fubm90IGJlIGluc3RhbGxlZC5gLCBleHRlbnNpb24uZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRcdFx0XHRcdFx0YWRkVG9Ta2lwcGVkLnB1c2goZSk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRhZGRUb1NraXBwZWQucHVzaChlKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBTa2lwcGVkIHN5bmNocm9uaXppbmcgZXh0ZW5zaW9uYCwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YWRkVG9Ta2lwcGVkLnB1c2goZSk7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHtzeW5jUmVzb3VyY2VMb2dMYWJlbH06IFNraXBwZWQgc3luY2hyb25pemluZyBleHRlbnNpb24gYmVjYXVzZSB0aGUgZXh0ZW5zaW9uIGlzIG5vdCBmb3VuZC5gLCBlLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gMi4gTmV4dCB1bmluc3RhbGwgdGhlIHJlbW92ZWQgZXh0ZW5zaW9uc1xuXHRcdGlmIChyZW1vdmVkLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1RvUmVtb3ZlID0gaW5zdGFsbGVkRXh0ZW5zaW9ucy5maWx0ZXIoKHsgaWRlbnRpZmllciwgaXNCdWlsdGluIH0pID0+ICFpc0J1aWx0aW4gJiYgcmVtb3ZlZC5zb21lKHIgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaWRlbnRpZmllciwgcikpKTtcblx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoZXh0ZW5zaW9uc1RvUmVtb3ZlLm1hcChhc3luYyBleHRlbnNpb25Ub1JlbW92ZSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgJHtzeW5jUmVzb3VyY2VMb2dMYWJlbH06IFVuaW5zdGFsbGluZyBsb2NhbCBleHRlbnNpb24uLi5gLCBleHRlbnNpb25Ub1JlbW92ZS5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS51bmluc3RhbGwoZXh0ZW5zaW9uVG9SZW1vdmUsIHsgZG9ub3RJbmNsdWRlUGFjazogdHJ1ZSwgZG9ub3RDaGVja0RlcGVuZGVudHM6IHRydWUsIHByb2ZpbGVMb2NhdGlvbjogcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UgfSk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogVW5pbnN0YWxsZWQgbG9jYWwgZXh0ZW5zaW9uLmAsIGV4dGVuc2lvblRvUmVtb3ZlLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRyZW1vdmVGcm9tU2tpcHBlZC5wdXNoKGV4dGVuc2lvblRvUmVtb3ZlLmlkZW50aWZpZXIpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIDMuIEluc3RhbGwgZXh0ZW5zaW9ucyBhdCB0aGUgZW5kXG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEdhbGxlcnlFeHRlbnNpb25zKGV4dGVuc2lvbnNUb0luc3RhbGwpO1xuXHRcdGZvciAoY29uc3QgeyBpZGVudGlmaWVyLCBsb2NhbCwgZXJyb3IsIHNvdXJjZSB9IG9mIHJlc3VsdHMpIHtcblx0XHRcdGNvbnN0IGdhbGxlcnkgPSBzb3VyY2UgYXMgSUdhbGxlcnlFeHRlbnNpb247XG5cdFx0XHRpZiAobG9jYWwpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBJbnN0YWxsZWQgZXh0ZW5zaW9uLmAsIGlkZW50aWZpZXIuaWQsIGdhbGxlcnkudmVyc2lvbik7XG5cdFx0XHRcdHJlbW92ZUZyb21Ta2lwcGVkLnB1c2goaWRlbnRpZmllcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBlID0gc3luY0V4dGVuc2lvbnNUb0luc3RhbGwuZ2V0KGlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0YWRkVG9Ta2lwcGVkLnB1c2goZSk7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYCR7c3luY1Jlc291cmNlTG9nTGFiZWx9OiBTa2lwcGVkIHN5bmNocm9uaXppbmcgZXh0ZW5zaW9uYCwgZ2FsbGVyeS5kaXNwbGF5TmFtZSB8fCBnYWxsZXJ5LmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvciAmJiBbRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbmNvbXBhdGlibGUsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuSW5jb21wYXRpYmxlQXBpLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLkluY29tcGF0aWJsZVRhcmdldFBsYXRmb3JtXS5pbmNsdWRlcyhlcnJvci5jb2RlKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGAke3N5bmNSZXNvdXJjZUxvZ0xhYmVsfTogU2tpcHBlZCBzeW5jaHJvbml6aW5nIGV4dGVuc2lvbiBiZWNhdXNlIHRoZSBjb21wYXRpYmxlIGV4dGVuc2lvbiBpcyBub3QgZm91bmQuYCwgZ2FsbGVyeS5kaXNwbGF5TmFtZSB8fCBnYWxsZXJ5LmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG5ld1NraXBwZWRFeHRlbnNpb25zOiBJU3luY0V4dGVuc2lvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBza2lwcGVkRXh0ZW5zaW9uIG9mIHNraXBwZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoIXJlbW92ZUZyb21Ta2lwcGVkLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLCBza2lwcGVkRXh0ZW5zaW9uLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRuZXdTa2lwcGVkRXh0ZW5zaW9ucy5wdXNoKHNraXBwZWRFeHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRmb3IgKGNvbnN0IHNraXBwZWRFeHRlbnNpb24gb2YgYWRkVG9Ta2lwcGVkKSB7XG5cdFx0XHRpZiAoIW5ld1NraXBwZWRFeHRlbnNpb25zLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHNraXBwZWRFeHRlbnNpb24uaWRlbnRpZmllcikpKSB7XG5cdFx0XHRcdG5ld1NraXBwZWRFeHRlbnNpb25zLnB1c2goc2tpcHBlZEV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBuZXdTa2lwcGVkRXh0ZW5zaW9ucztcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRXh0ZW5zaW9uU3RhdGUoc3RhdGU6IElTdHJpbmdEaWN0aW9uYXJ5PGFueT4sIGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uIHwgSUdhbGxlcnlFeHRlbnNpb24sIHZlcnNpb246IHN0cmluZyB8IHVuZGVmaW5lZCwgZXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2U6IElFeHRlbnNpb25TdG9yYWdlU2VydmljZSk6IHZvaWQge1xuXHRcdGNvbnN0IGV4dGVuc2lvblN0YXRlID0gZXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0ZW5zaW9uLCB0cnVlKSB8fCB7fTtcblx0XHRjb25zdCBrZXlzID0gdmVyc2lvbiA/IGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLmdldEtleXNGb3JTeW5jKHsgaWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCB2ZXJzaW9uIH0pIDogdW5kZWZpbmVkO1xuXHRcdGlmIChrZXlzKSB7XG5cdFx0XHRrZXlzLmZvckVhY2goa2V5ID0+IHsgZXh0ZW5zaW9uU3RhdGVba2V5XSA9IHN0YXRlW2tleV07IH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRPYmplY3Qua2V5cyhzdGF0ZSkuZm9yRWFjaChrZXkgPT4gZXh0ZW5zaW9uU3RhdGVba2V5XSA9IHN0YXRlW2tleV0pO1xuXHRcdH1cblx0XHRleHRlbnNpb25TdG9yYWdlU2VydmljZS5zZXRFeHRlbnNpb25TdGF0ZShleHRlbnNpb24sIGV4dGVuc2lvblN0YXRlLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2l0aFByb2ZpbGVTY29wZWRTZXJ2aWNlczxUPihwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlLCBmbjogKGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlOiBJRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcblx0XHRyZXR1cm4gdGhpcy51c2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZS53aXRoUHJvZmlsZVNjb3BlZFN0b3JhZ2VTZXJ2aWNlKHByb2ZpbGUsXG5cdFx0XHRhc3luYyBzdG9yYWdlU2VydmljZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSVN0b3JhZ2VTZXJ2aWNlLCBzdG9yYWdlU2VydmljZV0pKSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlKSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlKSk7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IGZuKGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBleHRlbnNpb25TdG9yYWdlU2VydmljZSk7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0fVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvbnNJbml0aWFsaXplclByZXZpZXdSZXN1bHQge1xuXHRyZWFkb25seSBpbnN0YWxsZWRFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXTtcblx0cmVhZG9ubHkgZGlzYWJsZWRFeHRlbnNpb25zOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdO1xuXHRyZWFkb25seSBuZXdFeHRlbnNpb25zOiAoSUV4dGVuc2lvbklkZW50aWZpZXIgJiB7IHByZVJlbGVhc2U6IGJvb2xlYW4gfSlbXTtcblx0cmVhZG9ubHkgcmVtb3RlRXh0ZW5zaW9uczogSVN5bmNFeHRlbnNpb25bXTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uc0luaXRpYWxpemVyIGV4dGVuZHMgQWJzdHJhY3RJbml0aWFsaXplciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlOiBJSWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoU3luY1Jlc291cmNlLkV4dGVuc2lvbnMsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGxvZ1NlcnZpY2UsIGZpbGVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBwYXJzZUV4dGVuc2lvbnMocmVtb3RlVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSk6IFByb21pc2U8SVN5bmNFeHRlbnNpb25bXSB8IG51bGw+IHtcblx0XHRyZXR1cm4gcmVtb3RlVXNlckRhdGEuc3luY0RhdGEgPyBhd2FpdCBwYXJzZUFuZE1pZ3JhdGVFeHRlbnNpb25zKHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhLCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlKSA6IG51bGw7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2VuZXJhdGVQcmV2aWV3KHJlbW90ZUV4dGVuc2lvbnM6IElTeW5jRXh0ZW5zaW9uW10sIGxvY2FsRXh0ZW5zaW9uczogSUxvY2FsRXh0ZW5zaW9uW10pOiBJRXh0ZW5zaW9uc0luaXRpYWxpemVyUHJldmlld1Jlc3VsdCB7XG5cdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9uczogSUxvY2FsRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCBuZXdFeHRlbnNpb25zOiAoSUV4dGVuc2lvbklkZW50aWZpZXIgJiB7IHByZVJlbGVhc2U6IGJvb2xlYW4gfSlbXSA9IFtdO1xuXHRcdGNvbnN0IGRpc2FibGVkRXh0ZW5zaW9uczogSUV4dGVuc2lvbklkZW50aWZpZXJbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHJlbW90ZUV4dGVuc2lvbnMpIHtcblx0XHRcdGlmICh0aGlzLmlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UuaGFzVG9OZXZlclN5bmNFeHRlbnNpb24oZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpKSB7XG5cdFx0XHRcdC8vIFNraXAgZXh0ZW5zaW9uIGlnbm9yZWQgdG8gc3luY1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9uID0gbG9jYWxFeHRlbnNpb25zLmZpbmQoaSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRpZiAoaW5zdGFsbGVkRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdGluc3RhbGxlZEV4dGVuc2lvbnMucHVzaChpbnN0YWxsZWRFeHRlbnNpb24pO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0ZGlzYWJsZWRFeHRlbnNpb25zLnB1c2goZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV4dGVuc2lvbi5pbnN0YWxsZWQpIHtcblx0XHRcdFx0bmV3RXh0ZW5zaW9ucy5wdXNoKHsgLi4uZXh0ZW5zaW9uLmlkZW50aWZpZXIsIHByZVJlbGVhc2U6ICEhZXh0ZW5zaW9uLnByZVJlbGVhc2UgfSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24uZGlzYWJsZWQpIHtcblx0XHRcdFx0XHRkaXNhYmxlZEV4dGVuc2lvbnMucHVzaChleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgaW5zdGFsbGVkRXh0ZW5zaW9ucywgbmV3RXh0ZW5zaW9ucywgZGlzYWJsZWRFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zIH07XG5cdH1cblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsMEJBQTBCLDZCQUFpRiwwQkFBMEIsOEJBQWlELGtDQUFrQyw0Q0FBNEMsa0NBQXdELHdCQUF3QixzREFBc0Q7QUFDblosU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUIsZ0NBQWdDO0FBQ2xFLFNBQVMsZUFBcUMsb0NBQW9DO0FBQ2xGLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQTJCLGdDQUFnQztBQUMzRCxTQUFTLHFCQUFxQixzQkFBc0IsK0JBQThFO0FBQ2xJLFNBQWdELGFBQWE7QUFDN0QsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUyxRQUFvRCxnQ0FBdUQseUJBQXlCLGdDQUFnQywyQkFBMkIsY0FBYyw2QkFBa0Q7QUFDeFEsU0FBUyxzQ0FBc0M7QUFpQi9DLGVBQWUsMEJBQTBCLFVBQXFCLDRCQUFvRjtBQUNqSixRQUFNLGFBQWEsS0FBSyxNQUFNLFNBQVMsT0FB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
