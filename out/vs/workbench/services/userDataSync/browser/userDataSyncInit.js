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
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { AbstractExtensionsInitializer } from "../../../../platform/userDataSync/common/extensionsSync.js";
import { GlobalStateInitializer, UserDataSyncStoreTypeSynchronizer } from "../../../../platform/userDataSync/common/globalStateSync.js";
import { KeybindingsInitializer } from "../../../../platform/userDataSync/common/keybindingsSync.js";
import { SettingsInitializer } from "../../../../platform/userDataSync/common/settingsSync.js";
import { SnippetsInitializer } from "../../../../platform/userDataSync/common/snippetsSync.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { UserDataSyncStoreClient } from "../../../../platform/userDataSync/common/userDataSyncStoreService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IRequestService } from "../../../../platform/request/common/request.js";
import { IUserDataSyncLogService, IUserDataSyncStoreManagementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { getCurrentAuthenticationSessionInfo } from "../../authentication/browser/authenticationService.js";
import { getSyncAreaLabel } from "../common/userDataSync.js";
import { isWeb } from "../../../../base/common/platform.js";
import { Barrier, Promises } from "../../../../base/common/async.js";
import { EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT, IExtensionGalleryService, IExtensionManagementService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IExtensionService, toExtensionDescription } from "../../extensions/common/extensions.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IIgnoredExtensionsManagementService } from "../../../../platform/userDataSync/common/ignoredExtensions.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IExtensionStorageService } from "../../../../platform/extensionManagement/common/extensionStorage.js";
import { TasksInitializer } from "../../../../platform/userDataSync/common/tasksSync.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IBrowserWorkbenchEnvironmentService } from "../../environment/browser/environmentService.js";
import { ISecretStorageService } from "../../../../platform/secrets/common/secrets.js";
let UserDataSyncInitializer = class {
  constructor(environmentService, secretStorageService, userDataSyncStoreManagementService, fileService, userDataProfilesService, storageService, productService, requestService, logService, uriIdentityService) {
    this.environmentService = environmentService;
    this.secretStorageService = secretStorageService;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.fileService = fileService;
    this.userDataProfilesService = userDataProfilesService;
    this.storageService = storageService;
    this.productService = productService;
    this.requestService = requestService;
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this.initialized = [];
    this.initializationFinished = new Barrier();
    this.globalStateUserData = null;
    this.createUserDataSyncStoreClient().then((userDataSyncStoreClient) => {
      if (!userDataSyncStoreClient) {
        this.initializationFinished.open();
      }
    });
  }
  createUserDataSyncStoreClient() {
    if (!this._userDataSyncStoreClientPromise) {
      this._userDataSyncStoreClientPromise = (async () => {
        try {
          if (!isWeb) {
            this.logService.trace(`Skipping initializing user data in desktop`);
            return;
          }
          if (!this.storageService.isNew(StorageScope.APPLICATION)) {
            this.logService.trace(`Skipping initializing user data as application was opened before`);
            return;
          }
          if (!this.storageService.isNew(StorageScope.WORKSPACE)) {
            this.logService.trace(`Skipping initializing user data as workspace was opened before`);
            return;
          }
          if (this.environmentService.options?.settingsSyncOptions?.authenticationProvider && !this.environmentService.options.settingsSyncOptions.enabled) {
            this.logService.trace(`Skipping initializing user data as settings sync is disabled`);
            return;
          }
          let authenticationSession;
          try {
            authenticationSession = await getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService);
          } catch (error) {
            this.logService.error(error);
          }
          if (!authenticationSession) {
            this.logService.trace(`Skipping initializing user data as authentication session is not set`);
            return;
          }
          await this.initializeUserDataSyncStore(authenticationSession);
          const userDataSyncStore = this.userDataSyncStoreManagementService.userDataSyncStore;
          if (!userDataSyncStore) {
            this.logService.trace(`Skipping initializing user data as sync service is not provided`);
            return;
          }
          const userDataSyncStoreClient = new UserDataSyncStoreClient(userDataSyncStore.url, this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService);
          userDataSyncStoreClient.setAuthToken(authenticationSession.accessToken, authenticationSession.providerId);
          const manifest = await userDataSyncStoreClient.manifest(null);
          if (manifest === null) {
            userDataSyncStoreClient.dispose();
            this.logService.trace(`Skipping initializing user data as there is no data`);
            return;
          }
          this.logService.info(`Using settings sync service ${userDataSyncStore.url.toString()} for initialization`);
          return userDataSyncStoreClient;
        } catch (error) {
          this.logService.error(error);
          return;
        }
      })();
    }
    return this._userDataSyncStoreClientPromise;
  }
  async initializeUserDataSyncStore(authenticationSession) {
    const userDataSyncStore = this.userDataSyncStoreManagementService.userDataSyncStore;
    if (!userDataSyncStore?.canSwitch) {
      return;
    }
    const disposables = new DisposableStore();
    try {
      const userDataSyncStoreClient = disposables.add(new UserDataSyncStoreClient(userDataSyncStore.url, this.productService, this.requestService, this.logService, this.environmentService, this.fileService, this.storageService));
      userDataSyncStoreClient.setAuthToken(authenticationSession.accessToken, authenticationSession.providerId);
      this.globalStateUserData = await userDataSyncStoreClient.readResource(SyncResource.GlobalState, null);
      if (this.globalStateUserData) {
        const userDataSyncStoreType = new UserDataSyncStoreTypeSynchronizer(userDataSyncStoreClient, this.storageService, this.environmentService, this.fileService, this.logService).getSyncStoreType(this.globalStateUserData);
        if (userDataSyncStoreType) {
          await this.userDataSyncStoreManagementService.switch(userDataSyncStoreType);
          if (!isEqual(userDataSyncStore.url, this.userDataSyncStoreManagementService.userDataSyncStore?.url)) {
            this.logService.info("Switched settings sync store");
            this.globalStateUserData = null;
          }
        }
      }
    } finally {
      disposables.dispose();
    }
  }
  async whenInitializationFinished() {
    await this.initializationFinished.wait();
  }
  async requiresInitialization() {
    this.logService.trace(`UserDataInitializationService#requiresInitialization`);
    const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
    return !!userDataSyncStoreClient;
  }
  async initializeRequiredResources() {
    this.logService.trace(`UserDataInitializationService#initializeRequiredResources`);
    return this.initialize([SyncResource.Settings, SyncResource.GlobalState]);
  }
  async initializeOtherResources(instantiationService) {
    try {
      this.logService.trace(`UserDataInitializationService#initializeOtherResources`);
      await Promise.allSettled([this.initialize([SyncResource.Keybindings, SyncResource.Snippets, SyncResource.Tasks]), this.initializeExtensions(instantiationService)]);
    } finally {
      this.initializationFinished.open();
    }
  }
  async initializeExtensions(instantiationService) {
    try {
      await Promise.all([this.initializeInstalledExtensions(instantiationService), this.initializeNewExtensions(instantiationService)]);
    } finally {
      this.initialized.push(SyncResource.Extensions);
    }
  }
  async initializeInstalledExtensions(instantiationService) {
    if (!this.initializeInstalledExtensionsPromise) {
      this.initializeInstalledExtensionsPromise = (async () => {
        this.logService.trace(`UserDataInitializationService#initializeInstalledExtensions`);
        const extensionsPreviewInitializer = await this.getExtensionsPreviewInitializer(instantiationService);
        if (extensionsPreviewInitializer) {
          await instantiationService.createInstance(InstalledExtensionsInitializer, extensionsPreviewInitializer).initialize();
        }
      })();
    }
    return this.initializeInstalledExtensionsPromise;
  }
  async initializeNewExtensions(instantiationService) {
    if (!this.initializeNewExtensionsPromise) {
      this.initializeNewExtensionsPromise = (async () => {
        this.logService.trace(`UserDataInitializationService#initializeNewExtensions`);
        const extensionsPreviewInitializer = await this.getExtensionsPreviewInitializer(instantiationService);
        if (extensionsPreviewInitializer) {
          await instantiationService.createInstance(NewExtensionsInitializer, extensionsPreviewInitializer).initialize();
        }
      })();
    }
    return this.initializeNewExtensionsPromise;
  }
  getExtensionsPreviewInitializer(instantiationService) {
    if (!this.extensionsPreviewInitializerPromise) {
      this.extensionsPreviewInitializerPromise = (async () => {
        const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
        if (!userDataSyncStoreClient) {
          return null;
        }
        const userData = await userDataSyncStoreClient.readResource(SyncResource.Extensions, null);
        return instantiationService.createInstance(ExtensionsPreviewInitializer, userData);
      })();
    }
    return this.extensionsPreviewInitializerPromise;
  }
  async initialize(syncResources) {
    const userDataSyncStoreClient = await this.createUserDataSyncStoreClient();
    if (!userDataSyncStoreClient) {
      return;
    }
    await Promises.settled(syncResources.map(async (syncResource) => {
      try {
        if (this.initialized.includes(syncResource)) {
          this.logService.info(`${getSyncAreaLabel(syncResource)} initialized already.`);
          return;
        }
        this.initialized.push(syncResource);
        this.logService.trace(`Initializing ${getSyncAreaLabel(syncResource)}`);
        const initializer = this.createSyncResourceInitializer(syncResource);
        const userData = await userDataSyncStoreClient.readResource(syncResource, syncResource === SyncResource.GlobalState ? this.globalStateUserData : null);
        await initializer.initialize(userData);
        this.logService.info(`Initialized ${getSyncAreaLabel(syncResource)}`);
      } catch (error) {
        this.logService.info(`Error while initializing ${getSyncAreaLabel(syncResource)}`);
        this.logService.error(error);
      }
    }));
  }
  createSyncResourceInitializer(syncResource) {
    switch (syncResource) {
      case SyncResource.Settings:
        return new SettingsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Keybindings:
        return new KeybindingsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Tasks:
        return new TasksInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.Snippets:
        return new SnippetsInitializer(this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.storageService, this.uriIdentityService);
      case SyncResource.GlobalState:
        return new GlobalStateInitializer(this.storageService, this.fileService, this.userDataProfilesService, this.environmentService, this.logService, this.uriIdentityService);
    }
    throw new Error(`Cannot create initializer for ${syncResource}`);
  }
};
UserDataSyncInitializer = __decorateClass([
  __decorateParam(0, IBrowserWorkbenchEnvironmentService),
  __decorateParam(1, ISecretStorageService),
  __decorateParam(2, IUserDataSyncStoreManagementService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IRequestService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IUriIdentityService)
], UserDataSyncInitializer);
let ExtensionsPreviewInitializer = class extends AbstractExtensionsInitializer {
  constructor(extensionsData, extensionManagementService, ignoredExtensionsManagementService, fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService) {
    super(extensionManagementService, ignoredExtensionsManagementService, fileService, userDataProfilesService, environmentService, logService, storageService, uriIdentityService);
    this.extensionsData = extensionsData;
    this.preview = null;
  }
  getPreview() {
    if (!this.previewPromise) {
      this.previewPromise = super.initialize(this.extensionsData).then(() => this.preview);
    }
    return this.previewPromise;
  }
  initialize() {
    throw new Error("should not be called directly");
  }
  async doInitialize(remoteUserData) {
    const remoteExtensions = await this.parseExtensions(remoteUserData);
    if (!remoteExtensions) {
      this.logService.info("Skipping initializing extensions because remote extensions does not exist.");
      return;
    }
    const installedExtensions = await this.extensionManagementService.getInstalled();
    this.preview = this.generatePreview(remoteExtensions, installedExtensions);
  }
};
ExtensionsPreviewInitializer = __decorateClass([
  __decorateParam(1, IExtensionManagementService),
  __decorateParam(2, IIgnoredExtensionsManagementService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IEnvironmentService),
  __decorateParam(6, IUserDataSyncLogService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IUriIdentityService)
], ExtensionsPreviewInitializer);
let InstalledExtensionsInitializer = class {
  constructor(extensionsPreviewInitializer, extensionEnablementService, extensionStorageService, logService) {
    this.extensionsPreviewInitializer = extensionsPreviewInitializer;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionStorageService = extensionStorageService;
    this.logService = logService;
  }
  async initialize() {
    const preview = await this.extensionsPreviewInitializer.getPreview();
    if (!preview) {
      return;
    }
    for (const installedExtension of preview.installedExtensions) {
      const syncExtension = preview.remoteExtensions.find(({ identifier }) => areSameExtensions(identifier, installedExtension.identifier));
      if (syncExtension?.state) {
        const extensionState = this.extensionStorageService.getExtensionState(installedExtension, true) || {};
        Object.keys(syncExtension.state).forEach((key) => extensionState[key] = syncExtension.state[key]);
        this.extensionStorageService.setExtensionState(installedExtension, extensionState, true);
      }
    }
    if (preview.disabledExtensions.length) {
      for (const identifier of preview.disabledExtensions) {
        this.logService.trace(`Disabling extension...`, identifier.id);
        await this.extensionEnablementService.disableExtension(identifier);
        this.logService.info(`Disabling extension`, identifier.id);
      }
    }
  }
};
InstalledExtensionsInitializer = __decorateClass([
  __decorateParam(1, IGlobalExtensionEnablementService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IUserDataSyncLogService)
], InstalledExtensionsInitializer);
let NewExtensionsInitializer = class {
  constructor(extensionsPreviewInitializer, extensionService, extensionStorageService, galleryService, extensionManagementService, logService) {
    this.extensionsPreviewInitializer = extensionsPreviewInitializer;
    this.extensionService = extensionService;
    this.extensionStorageService = extensionStorageService;
    this.galleryService = galleryService;
    this.extensionManagementService = extensionManagementService;
    this.logService = logService;
  }
  async initialize() {
    const preview = await this.extensionsPreviewInitializer.getPreview();
    if (!preview) {
      return;
    }
    const newlyEnabledExtensions = [];
    const targetPlatform = await this.extensionManagementService.getTargetPlatform();
    const galleryExtensions = await this.galleryService.getExtensions(preview.newExtensions, { targetPlatform, compatible: true }, CancellationToken.None);
    for (const galleryExtension of galleryExtensions) {
      try {
        const extensionToSync = preview.remoteExtensions.find(({ identifier }) => areSameExtensions(identifier, galleryExtension.identifier));
        if (!extensionToSync) {
          continue;
        }
        if (extensionToSync.state) {
          this.extensionStorageService.setExtensionState(galleryExtension, extensionToSync.state, true);
        }
        this.logService.trace(`Installing extension...`, galleryExtension.identifier.id);
        const local = await this.extensionManagementService.installFromGallery(galleryExtension, {
          isMachineScoped: false,
          /* set isMachineScoped to prevent install and sync dialog in web */
          donotIncludePackAndDependencies: true,
          installGivenVersion: !!extensionToSync.version,
          installPreReleaseVersion: extensionToSync.preRelease,
          context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
        });
        if (!preview.disabledExtensions.some((identifier) => areSameExtensions(identifier, galleryExtension.identifier))) {
          newlyEnabledExtensions.push(local);
        }
        this.logService.info(`Installed extension.`, galleryExtension.identifier.id);
      } catch (error) {
        this.logService.error(error);
      }
    }
    const canEnabledExtensions = newlyEnabledExtensions.filter((e) => this.extensionService.canAddExtension(toExtensionDescription(e)));
    if (!await this.areExtensionsRunning(canEnabledExtensions)) {
      await new Promise((c, e) => {
        const disposable = this.extensionService.onDidChangeExtensions(async () => {
          try {
            if (await this.areExtensionsRunning(canEnabledExtensions)) {
              disposable.dispose();
              c();
            }
          } catch (error) {
            e(error);
          }
        });
      });
    }
  }
  async areExtensionsRunning(extensions) {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const runningExtensions = this.extensionService.extensions;
    return extensions.every((e) => runningExtensions.some((r) => areSameExtensions({ id: r.identifier.value }, e.identifier)));
  }
};
NewExtensionsInitializer = __decorateClass([
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IExtensionStorageService),
  __decorateParam(3, IExtensionGalleryService),
  __decorateParam(4, IExtensionManagementService),
  __decorateParam(5, IUserDataSyncLogService)
], NewExtensionsInitializer);
export {
  UserDataSyncInitializer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFTeW5jL2Jyb3dzZXIvdXNlckRhdGFTeW5jSW5pdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEV4dGVuc2lvbnNJbml0aWFsaXplciwgSUV4dGVuc2lvbnNJbml0aWFsaXplclByZXZpZXdSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2V4dGVuc2lvbnNTeW5jLmpzJztcbmltcG9ydCB7IEdsb2JhbFN0YXRlSW5pdGlhbGl6ZXIsIFVzZXJEYXRhU3luY1N0b3JlVHlwZVN5bmNocm9uaXplciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vZ2xvYmFsU3RhdGVTeW5jLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzSW5pdGlhbGl6ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2tleWJpbmRpbmdzU3luYy5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc0luaXRpYWxpemVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi9zZXR0aW5nc1N5bmMuanMnO1xuaW1wb3J0IHsgU25pcHBldHNJbml0aWFsaXplciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vc25pcHBldHNTeW5jLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jU3RvcmVDbGllbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY1N0b3JlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElSZW1vdGVVc2VyRGF0YSwgSVVzZXJEYXRhLCBJVXNlckRhdGFTeW5jUmVzb3VyY2VJbml0aWFsaXplciwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCBTeW5jUmVzb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvblNlc3Npb25JbmZvLCBnZXRDdXJyZW50QXV0aGVudGljYXRpb25TZXNzaW9uSW5mbyB9IGZyb20gJy4uLy4uL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldFN5bmNBcmVhTGFiZWwgfSBmcm9tICcuLi9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQmFycmllciwgUHJvbWlzZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1BVQkxJU0hFUl9UUlVTVF9DT05URVhULCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBJTG9jYWxFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UsIHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwuanMnO1xuaW1wb3J0IHsgSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL2lnbm9yZWRFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uU3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBUYXNrc0luaXRpYWxpemVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi90YXNrc1N5bmMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9icm93c2VyL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFJbml0aWFsaXplciB9IGZyb20gJy4uLy4uL3VzZXJEYXRhL2Jyb3dzZXIvdXNlckRhdGFJbml0LmpzJztcbmltcG9ydCB7IElTZWNyZXRTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvY29tbW9uL3NlY3JldHMuanMnO1xuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFTeW5jSW5pdGlhbGl6ZXIgaW1wbGVtZW50cyBJVXNlckRhdGFJbml0aWFsaXplciB7XG5cblx0X3NlcnZpY2VCcmFuZDogYW55O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaW5pdGlhbGl6ZWQ6IFN5bmNSZXNvdXJjZVtdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5pdGlhbGl6YXRpb25GaW5pc2hlZCA9IG5ldyBCYXJyaWVyKCk7XG5cdHByaXZhdGUgZ2xvYmFsU3RhdGVVc2VyRGF0YTogSVVzZXJEYXRhIHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVNlY3JldFN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2VjcmV0U3RvcmFnZVNlcnZpY2U6IElTZWNyZXRTdG9yYWdlU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5jcmVhdGVVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCgpLnRoZW4odXNlckRhdGFTeW5jU3RvcmVDbGllbnQgPT4ge1xuXHRcdFx0aWYgKCF1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCkge1xuXHRcdFx0XHR0aGlzLmluaXRpYWxpemF0aW9uRmluaXNoZWQub3BlbigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXNlckRhdGFTeW5jU3RvcmVDbGllbnRQcm9taXNlOiBQcm9taXNlPFVzZXJEYXRhU3luY1N0b3JlQ2xpZW50IHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjcmVhdGVVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCgpOiBQcm9taXNlPFVzZXJEYXRhU3luY1N0b3JlQ2xpZW50IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl91c2VyRGF0YVN5bmNTdG9yZUNsaWVudFByb21pc2UpIHtcblx0XHRcdHRoaXMuX3VzZXJEYXRhU3luY1N0b3JlQ2xpZW50UHJvbWlzZSA9IChhc3luYyAoKTogUHJvbWlzZTxVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmICghaXNXZWIpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgU2tpcHBpbmcgaW5pdGlhbGl6aW5nIHVzZXIgZGF0YSBpbiBkZXNrdG9wYCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKCF0aGlzLnN0b3JhZ2VTZXJ2aWNlLmlzTmV3KFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTikpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgU2tpcHBpbmcgaW5pdGlhbGl6aW5nIHVzZXIgZGF0YSBhcyBhcHBsaWNhdGlvbiB3YXMgb3BlbmVkIGJlZm9yZWApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghdGhpcy5zdG9yYWdlU2VydmljZS5pc05ldyhTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTa2lwcGluZyBpbml0aWFsaXppbmcgdXNlciBkYXRhIGFzIHdvcmtzcGFjZSB3YXMgb3BlbmVkIGJlZm9yZWApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICh0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5zZXR0aW5nc1N5bmNPcHRpb25zPy5hdXRoZW50aWNhdGlvblByb3ZpZGVyICYmICF0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zLnNldHRpbmdzU3luY09wdGlvbnMuZW5hYmxlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTa2lwcGluZyBpbml0aWFsaXppbmcgdXNlciBkYXRhIGFzIHNldHRpbmdzIHN5bmMgaXMgZGlzYWJsZWRgKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRsZXQgYXV0aGVudGljYXRpb25TZXNzaW9uO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhdXRoZW50aWNhdGlvblNlc3Npb24gPSBhd2FpdCBnZXRDdXJyZW50QXV0aGVudGljYXRpb25TZXNzaW9uSW5mbyh0aGlzLnNlY3JldFN0b3JhZ2VTZXJ2aWNlLCB0aGlzLnByb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFhdXRoZW50aWNhdGlvblNlc3Npb24pIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgU2tpcHBpbmcgaW5pdGlhbGl6aW5nIHVzZXIgZGF0YSBhcyBhdXRoZW50aWNhdGlvbiBzZXNzaW9uIGlzIG5vdCBzZXRgKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRhd2FpdCB0aGlzLmluaXRpYWxpemVVc2VyRGF0YVN5bmNTdG9yZShhdXRoZW50aWNhdGlvblNlc3Npb24pO1xuXG5cdFx0XHRcdFx0Y29uc3QgdXNlckRhdGFTeW5jU3RvcmUgPSB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU7XG5cdFx0XHRcdFx0aWYgKCF1c2VyRGF0YVN5bmNTdG9yZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTa2lwcGluZyBpbml0aWFsaXppbmcgdXNlciBkYXRhIGFzIHN5bmMgc2VydmljZSBpcyBub3QgcHJvdmlkZWRgKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCA9IG5ldyBVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCh1c2VyRGF0YVN5bmNTdG9yZS51cmwsIHRoaXMucHJvZHVjdFNlcnZpY2UsIHRoaXMucmVxdWVzdFNlcnZpY2UsIHRoaXMubG9nU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMuc3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHRcdHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50LnNldEF1dGhUb2tlbihhdXRoZW50aWNhdGlvblNlc3Npb24uYWNjZXNzVG9rZW4sIGF1dGhlbnRpY2F0aW9uU2Vzc2lvbi5wcm92aWRlcklkKTtcblxuXHRcdFx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdXNlckRhdGFTeW5jU3RvcmVDbGllbnQubWFuaWZlc3QobnVsbCk7XG5cdFx0XHRcdFx0aWYgKG1hbmlmZXN0ID09PSBudWxsKSB7XG5cdFx0XHRcdFx0XHR1c2VyRGF0YVN5bmNTdG9yZUNsaWVudC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFNraXBwaW5nIGluaXRpYWxpemluZyB1c2VyIGRhdGEgYXMgdGhlcmUgaXMgbm8gZGF0YWApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBVc2luZyBzZXR0aW5ncyBzeW5jIHNlcnZpY2UgJHt1c2VyRGF0YVN5bmNTdG9yZS51cmwudG9TdHJpbmcoKX0gZm9yIGluaXRpYWxpemF0aW9uYCk7XG5cdFx0XHRcdFx0cmV0dXJuIHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50O1xuXG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJEYXRhU3luY1N0b3JlQ2xpZW50UHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZVVzZXJEYXRhU3luY1N0b3JlKGF1dGhlbnRpY2F0aW9uU2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uSW5mbyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlID0gdGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlO1xuXHRcdGlmICghdXNlckRhdGFTeW5jU3RvcmU/LmNhblN3aXRjaCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVXNlckRhdGFTeW5jU3RvcmVDbGllbnQodXNlckRhdGFTeW5jU3RvcmUudXJsLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLCB0aGlzLnJlcXVlc3RTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlKSk7XG5cdFx0XHR1c2VyRGF0YVN5bmNTdG9yZUNsaWVudC5zZXRBdXRoVG9rZW4oYXV0aGVudGljYXRpb25TZXNzaW9uLmFjY2Vzc1Rva2VuLCBhdXRoZW50aWNhdGlvblNlc3Npb24ucHJvdmlkZXJJZCk7XG5cblx0XHRcdC8vIENhY2hlIGdsb2JhbCBzdGF0ZSBkYXRhIGZvciBnbG9iYWwgc3RhdGUgaW5pdGlhbGl6YXRpb25cblx0XHRcdHRoaXMuZ2xvYmFsU3RhdGVVc2VyRGF0YSA9IGF3YWl0IHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50LnJlYWRSZXNvdXJjZShTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGUsIG51bGwpO1xuXG5cdFx0XHRpZiAodGhpcy5nbG9iYWxTdGF0ZVVzZXJEYXRhKSB7XG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlVHlwZSA9IG5ldyBVc2VyRGF0YVN5bmNTdG9yZVR5cGVTeW5jaHJvbml6ZXIodXNlckRhdGFTeW5jU3RvcmVDbGllbnQsIHRoaXMuc3RvcmFnZVNlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpLmdldFN5bmNTdG9yZVR5cGUodGhpcy5nbG9iYWxTdGF0ZVVzZXJEYXRhKTtcblx0XHRcdFx0aWYgKHVzZXJEYXRhU3luY1N0b3JlVHlwZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS5zd2l0Y2godXNlckRhdGFTeW5jU3RvcmVUeXBlKTtcblxuXHRcdFx0XHRcdC8vIFVuc2V0IGNhY2hlZCBnbG9iYWwgc3RhdGUgZGF0YSBpZiB1cmxzIGFyZSBjaGFuZ2VkXG5cdFx0XHRcdFx0aWYgKCFpc0VxdWFsKHVzZXJEYXRhU3luY1N0b3JlLnVybCwgdGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlPy51cmwpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnU3dpdGNoZWQgc2V0dGluZ3Mgc3luYyBzdG9yZScpO1xuXHRcdFx0XHRcdFx0dGhpcy5nbG9iYWxTdGF0ZVVzZXJEYXRhID0gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHdoZW5Jbml0aWFsaXphdGlvbkZpbmlzaGVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuaW5pdGlhbGl6YXRpb25GaW5pc2hlZC53YWl0KCk7XG5cdH1cblxuXHRhc3luYyByZXF1aXJlc0luaXRpYWxpemF0aW9uKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UjcmVxdWlyZXNJbml0aWFsaXphdGlvbmApO1xuXHRcdGNvbnN0IHVzZXJEYXRhU3luY1N0b3JlQ2xpZW50ID0gYXdhaXQgdGhpcy5jcmVhdGVVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCgpO1xuXHRcdHJldHVybiAhIXVzZXJEYXRhU3luY1N0b3JlQ2xpZW50O1xuXHR9XG5cblx0YXN5bmMgaW5pdGlhbGl6ZVJlcXVpcmVkUmVzb3VyY2VzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UjaW5pdGlhbGl6ZVJlcXVpcmVkUmVzb3VyY2VzYCk7XG5cdFx0cmV0dXJuIHRoaXMuaW5pdGlhbGl6ZShbU3luY1Jlc291cmNlLlNldHRpbmdzLCBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGVdKTtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemVPdGhlclJlc291cmNlcyhpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UjaW5pdGlhbGl6ZU90aGVyUmVzb3VyY2VzYCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoW3RoaXMuaW5pdGlhbGl6ZShbU3luY1Jlc291cmNlLktleWJpbmRpbmdzLCBTeW5jUmVzb3VyY2UuU25pcHBldHMsIFN5bmNSZXNvdXJjZS5UYXNrc10pLCB0aGlzLmluaXRpYWxpemVFeHRlbnNpb25zKGluc3RhbnRpYXRpb25TZXJ2aWNlKV0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemF0aW9uRmluaXNoZWQub3BlbigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZUV4dGVuc2lvbnMoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5pbml0aWFsaXplSW5zdGFsbGVkRXh0ZW5zaW9ucyhpbnN0YW50aWF0aW9uU2VydmljZSksIHRoaXMuaW5pdGlhbGl6ZU5ld0V4dGVuc2lvbnMoaW5zdGFudGlhdGlvblNlcnZpY2UpXSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuaW5pdGlhbGl6ZWQucHVzaChTeW5jUmVzb3VyY2UuRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplSW5zdGFsbGVkRXh0ZW5zaW9uc1Byb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cdGFzeW5jIGluaXRpYWxpemVJbnN0YWxsZWRFeHRlbnNpb25zKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZUluc3RhbGxlZEV4dGVuc2lvbnNQcm9taXNlKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVJbnN0YWxsZWRFeHRlbnNpb25zUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UjaW5pdGlhbGl6ZUluc3RhbGxlZEV4dGVuc2lvbnNgKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplciA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplcihpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyKSB7XG5cdFx0XHRcdFx0YXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbGVkRXh0ZW5zaW9uc0luaXRpYWxpemVyLCBleHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyKS5pbml0aWFsaXplKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmluaXRpYWxpemVJbnN0YWxsZWRFeHRlbnNpb25zUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZU5ld0V4dGVuc2lvbnNQcm9taXNlOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemVOZXdFeHRlbnNpb25zKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZU5ld0V4dGVuc2lvbnNQcm9taXNlKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemVOZXdFeHRlbnNpb25zUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgVXNlckRhdGFJbml0aWFsaXphdGlvblNlcnZpY2UjaW5pdGlhbGl6ZU5ld0V4dGVuc2lvbnNgKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplciA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplcihpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyKSB7XG5cdFx0XHRcdFx0YXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTmV3RXh0ZW5zaW9uc0luaXRpYWxpemVyLCBleHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyKS5pbml0aWFsaXplKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmluaXRpYWxpemVOZXdFeHRlbnNpb25zUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplclByb21pc2U6IFByb21pc2U8RXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplciB8IG51bGw+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldEV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXIoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IFByb21pc2U8RXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplciB8IG51bGw+IHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplclByb21pc2UpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplclByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCA9IGF3YWl0IHRoaXMuY3JlYXRlVXNlckRhdGFTeW5jU3RvcmVDbGllbnQoKTtcblx0XHRcdFx0aWYgKCF1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhID0gYXdhaXQgdXNlckRhdGFTeW5jU3RvcmVDbGllbnQucmVhZFJlc291cmNlKFN5bmNSZXNvdXJjZS5FeHRlbnNpb25zLCBudWxsKTtcblx0XHRcdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXIsIHVzZXJEYXRhKTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXJQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplKHN5bmNSZXNvdXJjZXM6IFN5bmNSZXNvdXJjZVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdXNlckRhdGFTeW5jU3RvcmVDbGllbnQgPSBhd2FpdCB0aGlzLmNyZWF0ZVVzZXJEYXRhU3luY1N0b3JlQ2xpZW50KCk7XG5cdFx0aWYgKCF1c2VyRGF0YVN5bmNTdG9yZUNsaWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoc3luY1Jlc291cmNlcy5tYXAoYXN5bmMgc3luY1Jlc291cmNlID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmICh0aGlzLmluaXRpYWxpemVkLmluY2x1ZGVzKHN5bmNSZXNvdXJjZSkpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgJHtnZXRTeW5jQXJlYUxhYmVsKHN5bmNSZXNvdXJjZSl9IGluaXRpYWxpemVkIGFscmVhZHkuYCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaW5pdGlhbGl6ZWQucHVzaChzeW5jUmVzb3VyY2UpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEluaXRpYWxpemluZyAke2dldFN5bmNBcmVhTGFiZWwoc3luY1Jlc291cmNlKX1gKTtcblx0XHRcdFx0Y29uc3QgaW5pdGlhbGl6ZXIgPSB0aGlzLmNyZWF0ZVN5bmNSZXNvdXJjZUluaXRpYWxpemVyKHN5bmNSZXNvdXJjZSk7XG5cdFx0XHRcdGNvbnN0IHVzZXJEYXRhID0gYXdhaXQgdXNlckRhdGFTeW5jU3RvcmVDbGllbnQucmVhZFJlc291cmNlKHN5bmNSZXNvdXJjZSwgc3luY1Jlc291cmNlID09PSBTeW5jUmVzb3VyY2UuR2xvYmFsU3RhdGUgPyB0aGlzLmdsb2JhbFN0YXRlVXNlckRhdGEgOiBudWxsKTtcblx0XHRcdFx0YXdhaXQgaW5pdGlhbGl6ZXIuaW5pdGlhbGl6ZSh1c2VyRGF0YSk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBJbml0aWFsaXplZCAke2dldFN5bmNBcmVhTGFiZWwoc3luY1Jlc291cmNlKX1gKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBFcnJvciB3aGlsZSBpbml0aWFsaXppbmcgJHtnZXRTeW5jQXJlYUxhYmVsKHN5bmNSZXNvdXJjZSl9YCk7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTeW5jUmVzb3VyY2VJbml0aWFsaXplcihzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZSk6IElVc2VyRGF0YVN5bmNSZXNvdXJjZUluaXRpYWxpemVyIHtcblx0XHRzd2l0Y2ggKHN5bmNSZXNvdXJjZSkge1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU2V0dGluZ3M6IHJldHVybiBuZXcgU2V0dGluZ3NJbml0aWFsaXplcih0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5LZXliaW5kaW5nczogcmV0dXJuIG5ldyBLZXliaW5kaW5nc0luaXRpYWxpemVyKHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMuc3RvcmFnZVNlcnZpY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHRcdGNhc2UgU3luY1Jlc291cmNlLlRhc2tzOiByZXR1cm4gbmV3IFRhc2tzSW5pdGlhbGl6ZXIodGhpcy5maWxlU2VydmljZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsIHRoaXMubG9nU2VydmljZSwgdGhpcy5zdG9yYWdlU2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UpO1xuXHRcdFx0Y2FzZSBTeW5jUmVzb3VyY2UuU25pcHBldHM6IHJldHVybiBuZXcgU25pcHBldHNJbml0aWFsaXplcih0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLnN0b3JhZ2VTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0XHRjYXNlIFN5bmNSZXNvdXJjZS5HbG9iYWxTdGF0ZTogcmV0dXJuIG5ldyBHbG9iYWxTdGF0ZUluaXRpYWxpemVyKHRoaXMuc3RvcmFnZVNlcnZpY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgY3JlYXRlIGluaXRpYWxpemVyIGZvciAke3N5bmNSZXNvdXJjZX1gKTtcblx0fVxuXG59XG5cbmNsYXNzIEV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXIgZXh0ZW5kcyBBYnN0cmFjdEV4dGVuc2lvbnNJbml0aWFsaXplciB7XG5cblx0cHJpdmF0ZSBwcmV2aWV3UHJvbWlzZTogUHJvbWlzZTxJRXh0ZW5zaW9uc0luaXRpYWxpemVyUHJldmlld1Jlc3VsdCB8IG51bGw+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByZXZpZXc6IElFeHRlbnNpb25zSW5pdGlhbGl6ZXJQcmV2aWV3UmVzdWx0IHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zRGF0YTogSVVzZXJEYXRhLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UgaWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZTogSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBpZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlLCBmaWxlU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgbG9nU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cdH1cblxuXHRnZXRQcmV2aWV3KCk6IFByb21pc2U8SUV4dGVuc2lvbnNJbml0aWFsaXplclByZXZpZXdSZXN1bHQgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLnByZXZpZXdQcm9taXNlKSB7XG5cdFx0XHR0aGlzLnByZXZpZXdQcm9taXNlID0gc3VwZXIuaW5pdGlhbGl6ZSh0aGlzLmV4dGVuc2lvbnNEYXRhKS50aGVuKCgpID0+IHRoaXMucHJldmlldyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnByZXZpZXdQcm9taXNlO1xuXHR9XG5cblx0b3ZlcnJpZGUgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Nob3VsZCBub3QgYmUgY2FsbGVkIGRpcmVjdGx5Jyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgZG9Jbml0aWFsaXplKHJlbW90ZVVzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5wYXJzZUV4dGVuc2lvbnMocmVtb3RlVXNlckRhdGEpO1xuXHRcdGlmICghcmVtb3RlRXh0ZW5zaW9ucykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1NraXBwaW5nIGluaXRpYWxpemluZyBleHRlbnNpb25zIGJlY2F1c2UgcmVtb3RlIGV4dGVuc2lvbnMgZG9lcyBub3QgZXhpc3QuJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCgpO1xuXHRcdHRoaXMucHJldmlldyA9IHRoaXMuZ2VuZXJhdGVQcmV2aWV3KHJlbW90ZUV4dGVuc2lvbnMsIGluc3RhbGxlZEV4dGVuc2lvbnMpO1xuXHR9XG59XG5cbmNsYXNzIEluc3RhbGxlZEV4dGVuc2lvbnNJbml0aWFsaXplciBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNSZXNvdXJjZUluaXRpYWxpemVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXI6IEV4dGVuc2lvbnNQcmV2aWV3SW5pdGlhbGl6ZXIsXG5cdFx0QElHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlOiBJRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdCkge1xuXHR9XG5cblx0YXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwcmV2aWV3ID0gYXdhaXQgdGhpcy5leHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyLmdldFByZXZpZXcoKTtcblx0XHRpZiAoIXByZXZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyAxLiBJbml0aWFsaXNlIGFscmVhZHkgaW5zdGFsbGVkIGV4dGVuc2lvbnMgc3RhdGVcblx0XHRmb3IgKGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbiBvZiBwcmV2aWV3Lmluc3RhbGxlZEV4dGVuc2lvbnMpIHtcblx0XHRcdGNvbnN0IHN5bmNFeHRlbnNpb24gPSBwcmV2aWV3LnJlbW90ZUV4dGVuc2lvbnMuZmluZCgoeyBpZGVudGlmaWVyIH0pID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIGluc3RhbGxlZEV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRpZiAoc3luY0V4dGVuc2lvbj8uc3RhdGUpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uU3RhdGUgPSB0aGlzLmV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLmdldEV4dGVuc2lvblN0YXRlKGluc3RhbGxlZEV4dGVuc2lvbiwgdHJ1ZSkgfHwge307XG5cdFx0XHRcdE9iamVjdC5rZXlzKHN5bmNFeHRlbnNpb24uc3RhdGUpLmZvckVhY2goa2V5ID0+IGV4dGVuc2lvblN0YXRlW2tleV0gPSBzeW5jRXh0ZW5zaW9uLnN0YXRlIVtrZXldKTtcblx0XHRcdFx0dGhpcy5leHRlbnNpb25TdG9yYWdlU2VydmljZS5zZXRFeHRlbnNpb25TdGF0ZShpbnN0YWxsZWRFeHRlbnNpb24sIGV4dGVuc2lvblN0YXRlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyAyLiBJbml0aWFsaXNlIGV4dGVuc2lvbnMgZW5hYmxlbWVudFxuXHRcdGlmIChwcmV2aWV3LmRpc2FibGVkRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdGZvciAoY29uc3QgaWRlbnRpZmllciBvZiBwcmV2aWV3LmRpc2FibGVkRXh0ZW5zaW9ucykge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYERpc2FibGluZyBleHRlbnNpb24uLi5gLCBpZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5kaXNhYmxlRXh0ZW5zaW9uKGlkZW50aWZpZXIpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgRGlzYWJsaW5nIGV4dGVuc2lvbmAsIGlkZW50aWZpZXIuaWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBOZXdFeHRlbnNpb25zSW5pdGlhbGl6ZXIgaW1wbGVtZW50cyBJVXNlckRhdGFTeW5jUmVzb3VyY2VJbml0aWFsaXplciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyOiBFeHRlbnNpb25zUHJldmlld0luaXRpYWxpemVyLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TdG9yYWdlU2VydmljZTogSUV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBnYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJldmlldyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1ByZXZpZXdJbml0aWFsaXplci5nZXRQcmV2aWV3KCk7XG5cdFx0aWYgKCFwcmV2aWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3bHlFbmFibGVkRXh0ZW5zaW9uczogSUxvY2FsRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0VGFyZ2V0UGxhdGZvcm0oKTtcblx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhwcmV2aWV3Lm5ld0V4dGVuc2lvbnMsIHsgdGFyZ2V0UGxhdGZvcm0sIGNvbXBhdGlibGU6IHRydWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0Zm9yIChjb25zdCBnYWxsZXJ5RXh0ZW5zaW9uIG9mIGdhbGxlcnlFeHRlbnNpb25zKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25Ub1N5bmMgPSBwcmV2aWV3LnJlbW90ZUV4dGVuc2lvbnMuZmluZCgoeyBpZGVudGlmaWVyIH0pID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIGdhbGxlcnlFeHRlbnNpb24uaWRlbnRpZmllcikpO1xuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblRvU3luYykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb25Ub1N5bmMuc3RhdGUpIHtcblx0XHRcdFx0XHR0aGlzLmV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLnNldEV4dGVuc2lvblN0YXRlKGdhbGxlcnlFeHRlbnNpb24sIGV4dGVuc2lvblRvU3luYy5zdGF0ZSwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBJbnN0YWxsaW5nIGV4dGVuc2lvbi4uLmAsIGdhbGxlcnlFeHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdGNvbnN0IGxvY2FsID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsRnJvbUdhbGxlcnkoZ2FsbGVyeUV4dGVuc2lvbiwge1xuXHRcdFx0XHRcdGlzTWFjaGluZVNjb3BlZDogZmFsc2UsIC8qIHNldCBpc01hY2hpbmVTY29wZWQgdG8gcHJldmVudCBpbnN0YWxsIGFuZCBzeW5jIGRpYWxvZyBpbiB3ZWIgKi9cblx0XHRcdFx0XHRkb25vdEluY2x1ZGVQYWNrQW5kRGVwZW5kZW5jaWVzOiB0cnVlLFxuXHRcdFx0XHRcdGluc3RhbGxHaXZlblZlcnNpb246ICEhZXh0ZW5zaW9uVG9TeW5jLnZlcnNpb24sXG5cdFx0XHRcdFx0aW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiBleHRlbnNpb25Ub1N5bmMucHJlUmVsZWFzZSxcblx0XHRcdFx0XHRjb250ZXh0OiB7IFtFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1BVQkxJU0hFUl9UUlVTVF9DT05URVhUXTogdHJ1ZSB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAoIXByZXZpZXcuZGlzYWJsZWRFeHRlbnNpb25zLnNvbWUoaWRlbnRpZmllciA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpZGVudGlmaWVyLCBnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRcdG5ld2x5RW5hYmxlZEV4dGVuc2lvbnMucHVzaChsb2NhbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYEluc3RhbGxlZCBleHRlbnNpb24uYCwgZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FuRW5hYmxlZEV4dGVuc2lvbnMgPSBuZXdseUVuYWJsZWRFeHRlbnNpb25zLmZpbHRlcihlID0+IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5jYW5BZGRFeHRlbnNpb24odG9FeHRlbnNpb25EZXNjcmlwdGlvbihlKSkpO1xuXHRcdGlmICghKGF3YWl0IHRoaXMuYXJlRXh0ZW5zaW9uc1J1bm5pbmcoY2FuRW5hYmxlZEV4dGVuc2lvbnMpKSkge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnMoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5hcmVFeHRlbnNpb25zUnVubmluZyhjYW5FbmFibGVkRXh0ZW5zaW9ucykpIHtcblx0XHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdGMoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0ZShlcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYXJlRXh0ZW5zaW9uc1J1bm5pbmcoZXh0ZW5zaW9uczogSUxvY2FsRXh0ZW5zaW9uW10pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0Y29uc3QgcnVubmluZ0V4dGVuc2lvbnMgPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucztcblx0XHRyZXR1cm4gZXh0ZW5zaW9ucy5ldmVyeShlID0+IHJ1bm5pbmdFeHRlbnNpb25zLnNvbWUociA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiByLmlkZW50aWZpZXIudmFsdWUgfSwgZS5pZGVudGlmaWVyKSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFTLHFDQUEwRTtBQUNuRixTQUFTLHdCQUF3Qix5Q0FBeUM7QUFDMUUsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBdUUseUJBQXlCLHFDQUFxQyxvQkFBb0I7QUFDekosU0FBb0MsMkNBQTJDO0FBQy9FLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsYUFBYTtBQUN0QixTQUFTLFNBQVMsZ0JBQWdCO0FBQ2xDLFNBQVMsZ0RBQWdELDBCQUEwQiw2QkFBNkIseUNBQTBEO0FBQzFLLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsbUJBQW1CLDhCQUE4QjtBQUMxRCxTQUFTLHlCQUF5QjtBQUNs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
