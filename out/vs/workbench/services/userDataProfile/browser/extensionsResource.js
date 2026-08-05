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
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { GlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionEnablementService.js";
import { EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT, EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT, IExtensionGalleryService, IExtensionManagementService, IGlobalExtensionEnablementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUserDataProfileStorageService } from "../../../../platform/userDataProfile/common/userDataProfileStorageService.js";
import { TreeItemCollapsibleState } from "../../../common/views.js";
import { IWorkbenchExtensionManagementService } from "../../extensionManagement/common/extensionManagement.js";
import { IUserDataProfileService } from "../common/userDataProfile.js";
let ExtensionsResourceInitializer = class {
  constructor(userDataProfileService, extensionManagementService, extensionGalleryService, extensionEnablementService, logService) {
    this.userDataProfileService = userDataProfileService;
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
    this.extensionEnablementService = extensionEnablementService;
    this.logService = logService;
  }
  async initialize(content) {
    const profileExtensions = JSON.parse(content);
    const installedExtensions = await this.extensionManagementService.getInstalled(void 0, this.userDataProfileService.currentProfile.extensionsResource);
    const extensionsToEnableOrDisable = [];
    const extensionsToInstall = [];
    for (const e of profileExtensions) {
      const isDisabled = this.extensionEnablementService.getDisabledExtensions().some((disabledExtension) => areSameExtensions(disabledExtension, e.identifier));
      const installedExtension = installedExtensions.find((installed) => areSameExtensions(installed.identifier, e.identifier));
      if (!installedExtension || !installedExtension.isBuiltin && installedExtension.preRelease !== e.preRelease) {
        extensionsToInstall.push(e);
      }
      if (isDisabled !== !!e.disabled) {
        extensionsToEnableOrDisable.push({ extension: e.identifier, enable: !e.disabled });
      }
    }
    const extensionsToUninstall = installedExtensions.filter((extension) => !extension.isBuiltin && !profileExtensions.some(({ identifier }) => areSameExtensions(identifier, extension.identifier)));
    for (const { extension, enable } of extensionsToEnableOrDisable) {
      if (enable) {
        this.logService.trace(`Initializing Profile: Enabling extension...`, extension.id);
        await this.extensionEnablementService.enableExtension(extension);
        this.logService.info(`Initializing Profile: Enabled extension...`, extension.id);
      } else {
        this.logService.trace(`Initializing Profile: Disabling extension...`, extension.id);
        await this.extensionEnablementService.disableExtension(extension);
        this.logService.info(`Initializing Profile: Disabled extension...`, extension.id);
      }
    }
    if (extensionsToInstall.length) {
      const galleryExtensions = await this.extensionGalleryService.getExtensions(extensionsToInstall.map((e) => ({ ...e.identifier, version: e.version, hasPreRelease: e.version ? void 0 : e.preRelease })), CancellationToken.None);
      await Promise.all(extensionsToInstall.map(async (e) => {
        const extension = galleryExtensions.find((galleryExtension) => areSameExtensions(galleryExtension.identifier, e.identifier));
        if (!extension) {
          return;
        }
        if (await this.extensionManagementService.canInstall(extension) === true) {
          this.logService.trace(`Initializing Profile: Installing extension...`, extension.identifier.id, extension.version);
          await this.extensionManagementService.installFromGallery(extension, {
            isMachineScoped: false,
            /* set isMachineScoped value to prevent install and sync dialog in web */
            donotIncludePackAndDependencies: true,
            installGivenVersion: !!e.version,
            installPreReleaseVersion: e.preRelease,
            profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
            context: { [EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT]: true, [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
          });
          this.logService.info(`Initializing Profile: Installed extension...`, extension.identifier.id, extension.version);
        } else {
          this.logService.info(`Initializing Profile: Skipped installing extension because it cannot be installed.`, extension.identifier.id);
        }
      }));
    }
    if (extensionsToUninstall.length) {
      await Promise.all(extensionsToUninstall.map((e) => this.extensionManagementService.uninstall(e)));
    }
  }
};
ExtensionsResourceInitializer = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IExtensionManagementService),
  __decorateParam(2, IExtensionGalleryService),
  __decorateParam(3, IGlobalExtensionEnablementService),
  __decorateParam(4, ILogService)
], ExtensionsResourceInitializer);
let ExtensionsResource = class {
  constructor(extensionManagementService, extensionGalleryService, userDataProfileStorageService, instantiationService, logService) {
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
    this.userDataProfileStorageService = userDataProfileStorageService;
    this.instantiationService = instantiationService;
    this.logService = logService;
  }
  async getContent(profile, exclude) {
    const extensions = await this.getLocalExtensions(profile);
    return this.toContent(extensions, exclude);
  }
  toContent(extensions, exclude) {
    return JSON.stringify(exclude?.length ? extensions.filter((e) => !exclude.includes(e.identifier.id.toLowerCase())) : extensions);
  }
  async apply(content, profile, progress, token) {
    return this.withProfileScopedServices(profile, async (extensionEnablementService) => {
      const profileExtensions = await this.getProfileExtensions(content);
      const installedExtensions = await this.extensionManagementService.getInstalled(void 0, profile.extensionsResource);
      const extensionsToEnableOrDisable = [];
      const extensionsToInstall = [];
      for (const e of profileExtensions) {
        const isDisabled = extensionEnablementService.getDisabledExtensions().some((disabledExtension) => areSameExtensions(disabledExtension, e.identifier));
        const installedExtension = installedExtensions.find((installed) => areSameExtensions(installed.identifier, e.identifier));
        if (!installedExtension || !installedExtension.isBuiltin && installedExtension.preRelease !== e.preRelease) {
          extensionsToInstall.push(e);
        }
        if (isDisabled !== !!e.disabled) {
          extensionsToEnableOrDisable.push({ extension: e.identifier, enable: !e.disabled });
        }
      }
      const extensionsToUninstall = installedExtensions.filter((extension) => !extension.isBuiltin && !profileExtensions.some(({ identifier }) => areSameExtensions(identifier, extension.identifier)) && !extension.isApplicationScoped);
      for (const { extension, enable } of extensionsToEnableOrDisable) {
        if (enable) {
          this.logService.trace(`Importing Profile (${profile.name}): Enabling extension...`, extension.id);
          await extensionEnablementService.enableExtension(extension);
          this.logService.info(`Importing Profile (${profile.name}): Enabled extension...`, extension.id);
        } else {
          this.logService.trace(`Importing Profile (${profile.name}): Disabling extension...`, extension.id);
          await extensionEnablementService.disableExtension(extension);
          this.logService.info(`Importing Profile (${profile.name}): Disabled extension...`, extension.id);
        }
      }
      if (extensionsToInstall.length) {
        this.logService.info(`Importing Profile (${profile.name}): Started installing extensions.`);
        const galleryExtensions = await this.extensionGalleryService.getExtensions(extensionsToInstall.map((e) => ({ ...e.identifier, version: e.version, hasPreRelease: e.version ? void 0 : e.preRelease })), CancellationToken.None);
        const installExtensionInfos = [];
        await Promise.all(extensionsToInstall.map(async (e) => {
          const extension = galleryExtensions.find((galleryExtension) => areSameExtensions(galleryExtension.identifier, e.identifier));
          if (!extension) {
            return;
          }
          if (await this.extensionManagementService.canInstall(extension) === true) {
            installExtensionInfos.push({
              extension,
              options: {
                isMachineScoped: false,
                /* set isMachineScoped value to prevent install and sync dialog in web */
                donotIncludePackAndDependencies: true,
                installGivenVersion: !!e.version,
                installPreReleaseVersion: e.preRelease,
                profileLocation: profile.extensionsResource,
                context: { [EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT]: true }
              }
            });
          } else {
            this.logService.info(`Importing Profile (${profile.name}): Skipped installing extension because it cannot be installed.`, extension.identifier.id);
          }
        }));
        if (installExtensionInfos.length) {
          if (token) {
            await this.extensionManagementService.requestPublisherTrust(installExtensionInfos);
            for (const installExtensionInfo of installExtensionInfos) {
              if (token.isCancellationRequested) {
                return;
              }
              progress?.(localize("installingExtension", "Installing extension {0}...", installExtensionInfo.extension.displayName ?? installExtensionInfo.extension.identifier.id));
              await this.extensionManagementService.installFromGallery(installExtensionInfo.extension, installExtensionInfo.options);
            }
          } else {
            await this.extensionManagementService.installGalleryExtensions(installExtensionInfos);
          }
        }
        this.logService.info(`Importing Profile (${profile.name}): Finished installing extensions.`);
      }
      if (extensionsToUninstall.length) {
        await Promise.all(extensionsToUninstall.map((e) => this.extensionManagementService.uninstall(e)));
      }
    });
  }
  async copy(from, to, disableExtensions) {
    await this.extensionManagementService.copyExtensions(from.extensionsResource, to.extensionsResource);
    const extensionsToDisable = await this.withProfileScopedServices(from, async (extensionEnablementService) => extensionEnablementService.getDisabledExtensions());
    if (disableExtensions) {
      const extensions = await this.extensionManagementService.getInstalled(ExtensionType.User, to.extensionsResource);
      for (const extension of extensions) {
        extensionsToDisable.push(extension.identifier);
      }
    }
    await this.withProfileScopedServices(to, async (extensionEnablementService) => Promise.all(extensionsToDisable.map((extension) => extensionEnablementService.disableExtension(extension))));
  }
  async getLocalExtensions(profile) {
    return this.withProfileScopedServices(profile, async (extensionEnablementService) => {
      const result = /* @__PURE__ */ new Map();
      const installedExtensions = await this.extensionManagementService.getInstalled(void 0, profile.extensionsResource);
      const disabledExtensions = extensionEnablementService.getDisabledExtensions();
      for (const extension of installedExtensions) {
        const { identifier, preRelease } = extension;
        const disabled = disabledExtensions.some((disabledExtension) => areSameExtensions(disabledExtension, identifier));
        if (extension.isBuiltin && !disabled) {
          continue;
        }
        if (!extension.isBuiltin) {
          if (!extension.identifier.uuid) {
            continue;
          }
        }
        const existing = result.get(identifier.id.toLowerCase());
        if (existing?.disabled) {
          result.delete(identifier.id.toLowerCase());
        }
        const profileExtension = { identifier, displayName: extension.manifest.displayName };
        if (disabled) {
          profileExtension.disabled = true;
        }
        if (!extension.isBuiltin && extension.pinned) {
          profileExtension.version = extension.manifest.version;
        }
        if (!profileExtension.version && preRelease) {
          profileExtension.preRelease = true;
        }
        profileExtension.applicationScoped = extension.isApplicationScoped;
        result.set(profileExtension.identifier.id.toLowerCase(), profileExtension);
      }
      return [...result.values()];
    });
  }
  async getProfileExtensions(content) {
    return JSON.parse(content);
  }
  async withProfileScopedServices(profile, fn) {
    return this.userDataProfileStorageService.withProfileScopedStorageService(
      profile,
      async (storageService) => {
        const disposables = new DisposableStore();
        const instantiationService = disposables.add(this.instantiationService.createChild(new ServiceCollection([IStorageService, storageService])));
        const extensionEnablementService = disposables.add(instantiationService.createInstance(GlobalExtensionEnablementService));
        try {
          return await fn(extensionEnablementService);
        } finally {
          disposables.dispose();
        }
      }
    );
  }
};
ExtensionsResource = __decorateClass([
  __decorateParam(0, IWorkbenchExtensionManagementService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IUserDataProfileStorageService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService)
], ExtensionsResource);
class ExtensionsResourceTreeItem {
  constructor() {
    this.type = ProfileResourceType.Extensions;
    this.handle = ProfileResourceType.Extensions;
    this.label = { label: localize("extensions", "Extensions") };
    this.collapsibleState = TreeItemCollapsibleState.Expanded;
    this.contextValue = ProfileResourceType.Extensions;
    this.excludedExtensions = /* @__PURE__ */ new Set();
  }
  async getChildren() {
    const extensions = (await this.getExtensions()).sort((a, b) => (a.displayName ?? a.identifier.id).localeCompare(b.displayName ?? b.identifier.id));
    const that = this;
    return extensions.map((e) => ({
      ...e,
      handle: e.identifier.id.toLowerCase(),
      parent: this,
      label: { label: e.displayName || e.identifier.id },
      description: e.applicationScoped ? localize("all profiles and disabled", "All Profiles") : void 0,
      collapsibleState: TreeItemCollapsibleState.None,
      checkbox: that.checkbox ? {
        get isChecked() {
          return !that.excludedExtensions.has(e.identifier.id.toLowerCase());
        },
        set isChecked(value) {
          if (value) {
            that.excludedExtensions.delete(e.identifier.id.toLowerCase());
          } else {
            that.excludedExtensions.add(e.identifier.id.toLowerCase());
          }
        },
        tooltip: localize("exclude", "Select {0} Extension", e.displayName || e.identifier.id),
        accessibilityInformation: {
          label: localize("exclude", "Select {0} Extension", e.displayName || e.identifier.id)
        }
      } : void 0,
      themeIcon: Codicon.extensions,
      command: {
        id: "extension.open",
        title: "",
        arguments: [e.identifier.id, void 0, true]
      }
    }));
  }
  async hasContent() {
    const extensions = await this.getExtensions();
    return extensions.length > 0;
  }
}
let ExtensionsResourceExportTreeItem = class extends ExtensionsResourceTreeItem {
  constructor(profile, instantiationService) {
    super();
    this.profile = profile;
    this.instantiationService = instantiationService;
  }
  isFromDefaultProfile() {
    return !this.profile.isDefault && !!this.profile.useDefaultFlags?.extensions;
  }
  getExtensions() {
    return this.instantiationService.createInstance(ExtensionsResource).getLocalExtensions(this.profile);
  }
  async getContent() {
    return this.instantiationService.createInstance(ExtensionsResource).getContent(this.profile, [...this.excludedExtensions.values()]);
  }
};
ExtensionsResourceExportTreeItem = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ExtensionsResourceExportTreeItem);
let ExtensionsResourceImportTreeItem = class extends ExtensionsResourceTreeItem {
  constructor(content, instantiationService) {
    super();
    this.content = content;
    this.instantiationService = instantiationService;
  }
  isFromDefaultProfile() {
    return false;
  }
  getExtensions() {
    return this.instantiationService.createInstance(ExtensionsResource).getProfileExtensions(this.content);
  }
  async getContent() {
    const extensionsResource = this.instantiationService.createInstance(ExtensionsResource);
    const extensions = await extensionsResource.getProfileExtensions(this.content);
    return extensionsResource.toContent(extensions, [...this.excludedExtensions.values()]);
  }
};
ExtensionsResourceImportTreeItem = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ExtensionsResourceImportTreeItem);
export {
  ExtensionsResource,
  ExtensionsResourceExportTreeItem,
  ExtensionsResourceImportTreeItem,
  ExtensionsResourceInitializer,
  ExtensionsResourceTreeItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvZXh0ZW5zaW9uc1Jlc291cmNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVYVEVOU0lPTl9JTlNUQUxMX1NLSVBfUFVCTElTSEVSX1RSVVNUX0NPTlRFWFQsIEVYVEVOU0lPTl9JTlNUQUxMX1NLSVBfV0FMS1RIUk9VR0hfQ09OVEVYVCwgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiwgSW5zdGFsbEV4dGVuc2lvbkluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBQcm9maWxlUmVzb3VyY2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVHJlZUl0ZW1DaGVja2JveFN0YXRlLCBUcmVlSXRlbUNvbGxhcHNpYmxlU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJUHJvZmlsZVJlc291cmNlLCBJUHJvZmlsZVJlc291cmNlQ2hpbGRUcmVlSXRlbSwgSVByb2ZpbGVSZXNvdXJjZUluaXRpYWxpemVyLCBJUHJvZmlsZVJlc291cmNlVHJlZUl0ZW0sIElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5cbmludGVyZmFjZSBJUHJvZmlsZUV4dGVuc2lvbiB7XG5cdGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyO1xuXHRkaXNwbGF5TmFtZT86IHN0cmluZztcblx0cHJlUmVsZWFzZT86IGJvb2xlYW47XG5cdGFwcGxpY2F0aW9uU2NvcGVkPzogYm9vbGVhbjtcblx0ZGlzYWJsZWQ/OiBib29sZWFuO1xuXHR2ZXJzaW9uPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uc1Jlc291cmNlSW5pdGlhbGl6ZXIgaW1wbGVtZW50cyBJUHJvZmlsZVJlc291cmNlSW5pdGlhbGl6ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemUoY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvZmlsZUV4dGVuc2lvbnM6IElQcm9maWxlRXh0ZW5zaW9uW10gPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCh1bmRlZmluZWQsIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0VuYWJsZU9yRGlzYWJsZTogeyBleHRlbnNpb246IElFeHRlbnNpb25JZGVudGlmaWVyOyBlbmFibGU6IGJvb2xlYW4gfVtdID0gW107XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1RvSW5zdGFsbDogSVByb2ZpbGVFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZSBvZiBwcm9maWxlRXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgaXNEaXNhYmxlZCA9IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCkuc29tZShkaXNhYmxlZEV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhkaXNhYmxlZEV4dGVuc2lvbiwgZS5pZGVudGlmaWVyKSk7XG5cdFx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb24gPSBpbnN0YWxsZWRFeHRlbnNpb25zLmZpbmQoaW5zdGFsbGVkID0+IGFyZVNhbWVFeHRlbnNpb25zKGluc3RhbGxlZC5pZGVudGlmaWVyLCBlLmlkZW50aWZpZXIpKTtcblx0XHRcdGlmICghaW5zdGFsbGVkRXh0ZW5zaW9uIHx8ICghaW5zdGFsbGVkRXh0ZW5zaW9uLmlzQnVpbHRpbiAmJiBpbnN0YWxsZWRFeHRlbnNpb24ucHJlUmVsZWFzZSAhPT0gZS5wcmVSZWxlYXNlKSkge1xuXHRcdFx0XHRleHRlbnNpb25zVG9JbnN0YWxsLnB1c2goZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaXNEaXNhYmxlZCAhPT0gISFlLmRpc2FibGVkKSB7XG5cdFx0XHRcdGV4dGVuc2lvbnNUb0VuYWJsZU9yRGlzYWJsZS5wdXNoKHsgZXh0ZW5zaW9uOiBlLmlkZW50aWZpZXIsIGVuYWJsZTogIWUuZGlzYWJsZWQgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb1VuaW5zdGFsbDogSUxvY2FsRXh0ZW5zaW9uW10gPSBpbnN0YWxsZWRFeHRlbnNpb25zLmZpbHRlcihleHRlbnNpb24gPT4gIWV4dGVuc2lvbi5pc0J1aWx0aW4gJiYgIXByb2ZpbGVFeHRlbnNpb25zLnNvbWUoKHsgaWRlbnRpZmllciB9KSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpKTtcblx0XHRmb3IgKGNvbnN0IHsgZXh0ZW5zaW9uLCBlbmFibGUgfSBvZiBleHRlbnNpb25zVG9FbmFibGVPckRpc2FibGUpIHtcblx0XHRcdGlmIChlbmFibGUpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBJbml0aWFsaXppbmcgUHJvZmlsZTogRW5hYmxpbmcgZXh0ZW5zaW9uLi4uYCwgZXh0ZW5zaW9uLmlkKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5lbmFibGVFeHRlbnNpb24oZXh0ZW5zaW9uKTtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYEluaXRpYWxpemluZyBQcm9maWxlOiBFbmFibGVkIGV4dGVuc2lvbi4uLmAsIGV4dGVuc2lvbi5pZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEluaXRpYWxpemluZyBQcm9maWxlOiBEaXNhYmxpbmcgZXh0ZW5zaW9uLi4uYCwgZXh0ZW5zaW9uLmlkKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5kaXNhYmxlRXh0ZW5zaW9uKGV4dGVuc2lvbik7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBJbml0aWFsaXppbmcgUHJvZmlsZTogRGlzYWJsZWQgZXh0ZW5zaW9uLi4uYCwgZXh0ZW5zaW9uLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbnNUb0luc3RhbGwubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhleHRlbnNpb25zVG9JbnN0YWxsLm1hcChlID0+ICh7IC4uLmUuaWRlbnRpZmllciwgdmVyc2lvbjogZS52ZXJzaW9uLCBoYXNQcmVSZWxlYXNlOiBlLnZlcnNpb24gPyB1bmRlZmluZWQgOiBlLnByZVJlbGVhc2UgfSkpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGV4dGVuc2lvbnNUb0luc3RhbGwubWFwKGFzeW5jIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBnYWxsZXJ5RXh0ZW5zaW9ucy5maW5kKGdhbGxlcnlFeHRlbnNpb24gPT4gYXJlU2FtZUV4dGVuc2lvbnMoZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyLCBlLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0aWYgKCFleHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuY2FuSW5zdGFsbChleHRlbnNpb24pID09PSB0cnVlKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBJbml0aWFsaXppbmcgUHJvZmlsZTogSW5zdGFsbGluZyBleHRlbnNpb24uLi5gLCBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEZyb21HYWxsZXJ5KGV4dGVuc2lvbiwge1xuXHRcdFx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiBmYWxzZSwvKiBzZXQgaXNNYWNoaW5lU2NvcGVkIHZhbHVlIHRvIHByZXZlbnQgaW5zdGFsbCBhbmQgc3luYyBkaWFsb2cgaW4gd2ViICovXG5cdFx0XHRcdFx0XHRkb25vdEluY2x1ZGVQYWNrQW5kRGVwZW5kZW5jaWVzOiB0cnVlLFxuXHRcdFx0XHRcdFx0aW5zdGFsbEdpdmVuVmVyc2lvbjogISFlLnZlcnNpb24sXG5cdFx0XHRcdFx0XHRpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IGUucHJlUmVsZWFzZSxcblx0XHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSxcblx0XHRcdFx0XHRcdGNvbnRleHQ6IHsgW0VYVEVOU0lPTl9JTlNUQUxMX1NLSVBfV0FMS1RIUk9VR0hfQ09OVEVYVF06IHRydWUsIFtFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1BVQkxJU0hFUl9UUlVTVF9DT05URVhUXTogdHJ1ZSB9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYEluaXRpYWxpemluZyBQcm9maWxlOiBJbnN0YWxsZWQgZXh0ZW5zaW9uLi4uYCwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIGV4dGVuc2lvbi52ZXJzaW9uKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgSW5pdGlhbGl6aW5nIFByb2ZpbGU6IFNraXBwZWQgaW5zdGFsbGluZyBleHRlbnNpb24gYmVjYXVzZSBpdCBjYW5ub3QgYmUgaW5zdGFsbGVkLmAsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uc1RvVW5pbnN0YWxsLmxlbmd0aCkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoZXh0ZW5zaW9uc1RvVW5pbnN0YWxsLm1hcChlID0+IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudW5pbnN0YWxsKGUpKSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zUmVzb3VyY2UgaW1wbGVtZW50cyBJUHJvZmlsZVJlc291cmNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU3RvcmFnZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRhc3luYyBnZXRDb250ZW50KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsIGV4Y2x1ZGU/OiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2V0TG9jYWxFeHRlbnNpb25zKHByb2ZpbGUpO1xuXHRcdHJldHVybiB0aGlzLnRvQ29udGVudChleHRlbnNpb25zLCBleGNsdWRlKTtcblx0fVxuXG5cdHRvQ29udGVudChleHRlbnNpb25zOiBJUHJvZmlsZUV4dGVuc2lvbltdLCBleGNsdWRlPzogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeShleGNsdWRlPy5sZW5ndGggPyBleHRlbnNpb25zLmZpbHRlcihlID0+ICFleGNsdWRlLmluY2x1ZGVzKGUuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKSkgOiBleHRlbnNpb25zKTtcblx0fVxuXG5cdGFzeW5jIGFwcGx5KGNvbnRlbnQ6IHN0cmluZywgcHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSwgcHJvZ3Jlc3M/OiAobWVzc2FnZTogc3RyaW5nKSA9PiB2b2lkLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud2l0aFByb2ZpbGVTY29wZWRTZXJ2aWNlcyhwcm9maWxlLCBhc3luYyAoZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UpID0+IHtcblx0XHRcdGNvbnN0IHByb2ZpbGVFeHRlbnNpb25zOiBJUHJvZmlsZUV4dGVuc2lvbltdID0gYXdhaXQgdGhpcy5nZXRQcm9maWxlRXh0ZW5zaW9ucyhjb250ZW50KTtcblx0XHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCh1bmRlZmluZWQsIHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKTtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNUb0VuYWJsZU9yRGlzYWJsZTogeyBleHRlbnNpb246IElFeHRlbnNpb25JZGVudGlmaWVyOyBlbmFibGU6IGJvb2xlYW4gfVtdID0gW107XG5cdFx0XHRjb25zdCBleHRlbnNpb25zVG9JbnN0YWxsOiBJUHJvZmlsZUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGUgb2YgcHJvZmlsZUV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Y29uc3QgaXNEaXNhYmxlZCA9IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmdldERpc2FibGVkRXh0ZW5zaW9ucygpLnNvbWUoZGlzYWJsZWRFeHRlbnNpb24gPT4gYXJlU2FtZUV4dGVuc2lvbnMoZGlzYWJsZWRFeHRlbnNpb24sIGUuaWRlbnRpZmllcikpO1xuXHRcdFx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb24gPSBpbnN0YWxsZWRFeHRlbnNpb25zLmZpbmQoaW5zdGFsbGVkID0+IGFyZVNhbWVFeHRlbnNpb25zKGluc3RhbGxlZC5pZGVudGlmaWVyLCBlLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0aWYgKCFpbnN0YWxsZWRFeHRlbnNpb24gfHwgKCFpbnN0YWxsZWRFeHRlbnNpb24uaXNCdWlsdGluICYmIGluc3RhbGxlZEV4dGVuc2lvbi5wcmVSZWxlYXNlICE9PSBlLnByZVJlbGVhc2UpKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvSW5zdGFsbC5wdXNoKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpc0Rpc2FibGVkICE9PSAhIWUuZGlzYWJsZWQpIHtcblx0XHRcdFx0XHRleHRlbnNpb25zVG9FbmFibGVPckRpc2FibGUucHVzaCh7IGV4dGVuc2lvbjogZS5pZGVudGlmaWVyLCBlbmFibGU6ICFlLmRpc2FibGVkIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBleHRlbnNpb25zVG9Vbmluc3RhbGw6IElMb2NhbEV4dGVuc2lvbltdID0gaW5zdGFsbGVkRXh0ZW5zaW9ucy5maWx0ZXIoZXh0ZW5zaW9uID0+ICFleHRlbnNpb24uaXNCdWlsdGluICYmICFwcm9maWxlRXh0ZW5zaW9ucy5zb21lKCh7IGlkZW50aWZpZXIgfSkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSAmJiAhZXh0ZW5zaW9uLmlzQXBwbGljYXRpb25TY29wZWQpO1xuXHRcdFx0Zm9yIChjb25zdCB7IGV4dGVuc2lvbiwgZW5hYmxlIH0gb2YgZXh0ZW5zaW9uc1RvRW5hYmxlT3JEaXNhYmxlKSB7XG5cdFx0XHRcdGlmIChlbmFibGUpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEltcG9ydGluZyBQcm9maWxlICgke3Byb2ZpbGUubmFtZX0pOiBFbmFibGluZyBleHRlbnNpb24uLi5gLCBleHRlbnNpb24uaWQpO1xuXHRcdFx0XHRcdGF3YWl0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbihleHRlbnNpb24pO1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBJbXBvcnRpbmcgUHJvZmlsZSAoJHtwcm9maWxlLm5hbWV9KTogRW5hYmxlZCBleHRlbnNpb24uLi5gLCBleHRlbnNpb24uaWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgSW1wb3J0aW5nIFByb2ZpbGUgKCR7cHJvZmlsZS5uYW1lfSk6IERpc2FibGluZyBleHRlbnNpb24uLi5gLCBleHRlbnNpb24uaWQpO1xuXHRcdFx0XHRcdGF3YWl0IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmRpc2FibGVFeHRlbnNpb24oZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgSW1wb3J0aW5nIFByb2ZpbGUgKCR7cHJvZmlsZS5uYW1lfSk6IERpc2FibGVkIGV4dGVuc2lvbi4uLmAsIGV4dGVuc2lvbi5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25zVG9JbnN0YWxsLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgSW1wb3J0aW5nIFByb2ZpbGUgKCR7cHJvZmlsZS5uYW1lfSk6IFN0YXJ0ZWQgaW5zdGFsbGluZyBleHRlbnNpb25zLmApO1xuXHRcdFx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhleHRlbnNpb25zVG9JbnN0YWxsLm1hcChlID0+ICh7IC4uLmUuaWRlbnRpZmllciwgdmVyc2lvbjogZS52ZXJzaW9uLCBoYXNQcmVSZWxlYXNlOiBlLnZlcnNpb24gPyB1bmRlZmluZWQgOiBlLnByZVJlbGVhc2UgfSkpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0Y29uc3QgaW5zdGFsbEV4dGVuc2lvbkluZm9zOiBJbnN0YWxsRXh0ZW5zaW9uSW5mb1tdID0gW107XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGV4dGVuc2lvbnNUb0luc3RhbGwubWFwKGFzeW5jIGUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGdhbGxlcnlFeHRlbnNpb25zLmZpbmQoZ2FsbGVyeUV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIsIGUuaWRlbnRpZmllcikpO1xuXHRcdFx0XHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmNhbkluc3RhbGwoZXh0ZW5zaW9uKSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdFx0aW5zdGFsbEV4dGVuc2lvbkluZm9zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRleHRlbnNpb24sXG5cdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0XHRpc01hY2hpbmVTY29wZWQ6IGZhbHNlLC8qIHNldCBpc01hY2hpbmVTY29wZWQgdmFsdWUgdG8gcHJldmVudCBpbnN0YWxsIGFuZCBzeW5jIGRpYWxvZyBpbiB3ZWIgKi9cblx0XHRcdFx0XHRcdFx0XHRkb25vdEluY2x1ZGVQYWNrQW5kRGVwZW5kZW5jaWVzOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGluc3RhbGxHaXZlblZlcnNpb246ICEhZS52ZXJzaW9uLFxuXHRcdFx0XHRcdFx0XHRcdGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogZS5wcmVSZWxlYXNlLFxuXHRcdFx0XHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRcdFx0Y29udGV4dDogeyBbRVhURU5TSU9OX0lOU1RBTExfU0tJUF9XQUxLVEhST1VHSF9DT05URVhUXTogdHJ1ZSB9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgSW1wb3J0aW5nIFByb2ZpbGUgKCR7cHJvZmlsZS5uYW1lfSk6IFNraXBwZWQgaW5zdGFsbGluZyBleHRlbnNpb24gYmVjYXVzZSBpdCBjYW5ub3QgYmUgaW5zdGFsbGVkLmAsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0aWYgKGluc3RhbGxFeHRlbnNpb25JbmZvcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRpZiAodG9rZW4pIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UucmVxdWVzdFB1Ymxpc2hlclRydXN0KGluc3RhbGxFeHRlbnNpb25JbmZvcyk7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGluc3RhbGxFeHRlbnNpb25JbmZvIG9mIGluc3RhbGxFeHRlbnNpb25JbmZvcykge1xuXHRcdFx0XHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cHJvZ3Jlc3M/Lihsb2NhbGl6ZSgnaW5zdGFsbGluZ0V4dGVuc2lvbicsIFwiSW5zdGFsbGluZyBleHRlbnNpb24gezB9Li4uXCIsIGluc3RhbGxFeHRlbnNpb25JbmZvLmV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBpbnN0YWxsRXh0ZW5zaW9uSW5mby5leHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxGcm9tR2FsbGVyeShpbnN0YWxsRXh0ZW5zaW9uSW5mby5leHRlbnNpb24sIGluc3RhbGxFeHRlbnNpb25JbmZvLm9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucyhpbnN0YWxsRXh0ZW5zaW9uSW5mb3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgSW1wb3J0aW5nIFByb2ZpbGUgKCR7cHJvZmlsZS5uYW1lfSk6IEZpbmlzaGVkIGluc3RhbGxpbmcgZXh0ZW5zaW9ucy5gKTtcblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25zVG9Vbmluc3RhbGwubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGV4dGVuc2lvbnNUb1VuaW5zdGFsbC5tYXAoZSA9PiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnVuaW5zdGFsbChlKSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgY29weShmcm9tOiBJVXNlckRhdGFQcm9maWxlLCB0bzogSVVzZXJEYXRhUHJvZmlsZSwgZGlzYWJsZUV4dGVuc2lvbnM6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmNvcHlFeHRlbnNpb25zKGZyb20uZXh0ZW5zaW9uc1Jlc291cmNlLCB0by5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0Rpc2FibGUgPSBhd2FpdCB0aGlzLndpdGhQcm9maWxlU2NvcGVkU2VydmljZXMoZnJvbSwgYXN5bmMgKGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlKSA9PlxuXHRcdFx0ZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCkpO1xuXHRcdGlmIChkaXNhYmxlRXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKEV4dGVuc2lvblR5cGUuVXNlciwgdG8uZXh0ZW5zaW9uc1Jlc291cmNlKTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvRGlzYWJsZS5wdXNoKGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXdhaXQgdGhpcy53aXRoUHJvZmlsZVNjb3BlZFNlcnZpY2VzKHRvLCBhc3luYyAoZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UpID0+XG5cdFx0XHRQcm9taXNlLmFsbChleHRlbnNpb25zVG9EaXNhYmxlLm1hcChleHRlbnNpb24gPT4gZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZGlzYWJsZUV4dGVuc2lvbihleHRlbnNpb24pKSkpO1xuXHR9XG5cblx0YXN5bmMgZ2V0TG9jYWxFeHRlbnNpb25zKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPElQcm9maWxlRXh0ZW5zaW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy53aXRoUHJvZmlsZVNjb3BlZFNlcnZpY2VzKHByb2ZpbGUsIGFzeW5jIChleHRlbnNpb25FbmFibGVtZW50U2VydmljZSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIElQcm9maWxlRXh0ZW5zaW9uICYgeyBkaXNwbGF5TmFtZT86IHN0cmluZyB9PigpO1xuXHRcdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKHVuZGVmaW5lZCwgcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgZGlzYWJsZWRFeHRlbnNpb25zID0gZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBpbnN0YWxsZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IHsgaWRlbnRpZmllciwgcHJlUmVsZWFzZSB9ID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRjb25zdCBkaXNhYmxlZCA9IGRpc2FibGVkRXh0ZW5zaW9ucy5zb21lKGRpc2FibGVkRXh0ZW5zaW9uID0+IGFyZVNhbWVFeHRlbnNpb25zKGRpc2FibGVkRXh0ZW5zaW9uLCBpZGVudGlmaWVyKSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24uaXNCdWlsdGluICYmICFkaXNhYmxlZCkge1xuXHRcdFx0XHRcdC8vIHNraXAgZW5hYmxlZCBidWlsdGluIGV4dGVuc2lvbnNcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvbi5pc0J1aWx0aW4pIHtcblx0XHRcdFx0XHRpZiAoIWV4dGVuc2lvbi5pZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdFx0XHRcdC8vIHNraXAgdXNlciBleHRlbnNpb25zIHdpdGhvdXQgdXVpZFxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nID0gcmVzdWx0LmdldChpZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHRpZiAoZXhpc3Rpbmc/LmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0Ly8gUmVtb3ZlIHRoZSBkdXBsaWNhdGUgZGlzYWJsZWQgZXh0ZW5zaW9uXG5cdFx0XHRcdFx0cmVzdWx0LmRlbGV0ZShpZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVFeHRlbnNpb246IElQcm9maWxlRXh0ZW5zaW9uID0geyBpZGVudGlmaWVyLCBkaXNwbGF5TmFtZTogZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIH07XG5cdFx0XHRcdGlmIChkaXNhYmxlZCkge1xuXHRcdFx0XHRcdHByb2ZpbGVFeHRlbnNpb24uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghZXh0ZW5zaW9uLmlzQnVpbHRpbiAmJiBleHRlbnNpb24ucGlubmVkKSB7XG5cdFx0XHRcdFx0cHJvZmlsZUV4dGVuc2lvbi52ZXJzaW9uID0gZXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb247XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFwcm9maWxlRXh0ZW5zaW9uLnZlcnNpb24gJiYgcHJlUmVsZWFzZSkge1xuXHRcdFx0XHRcdHByb2ZpbGVFeHRlbnNpb24ucHJlUmVsZWFzZSA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJvZmlsZUV4dGVuc2lvbi5hcHBsaWNhdGlvblNjb3BlZCA9IGV4dGVuc2lvbi5pc0FwcGxpY2F0aW9uU2NvcGVkO1xuXHRcdFx0XHRyZXN1bHQuc2V0KHByb2ZpbGVFeHRlbnNpb24uaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpLCBwcm9maWxlRXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBbLi4ucmVzdWx0LnZhbHVlcygpXTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGdldFByb2ZpbGVFeHRlbnNpb25zKGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8SVByb2ZpbGVFeHRlbnNpb25bXT4ge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3aXRoUHJvZmlsZVNjb3BlZFNlcnZpY2VzPFQ+KHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsIGZuOiAoZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlLndpdGhQcm9maWxlU2NvcGVkU3RvcmFnZVNlcnZpY2UocHJvZmlsZSxcblx0XHRcdGFzeW5jIHN0b3JhZ2VTZXJ2aWNlID0+IHtcblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJU3RvcmFnZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlXSkpKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoR2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UpKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgZm4oZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UpO1xuXHRcdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtIGltcGxlbWVudHMgSVByb2ZpbGVSZXNvdXJjZVRyZWVJdGVtIHtcblxuXHRyZWFkb25seSB0eXBlID0gUHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zO1xuXHRyZWFkb25seSBoYW5kbGUgPSBQcm9maWxlUmVzb3VyY2VUeXBlLkV4dGVuc2lvbnM7XG5cdHJlYWRvbmx5IGxhYmVsID0geyBsYWJlbDogbG9jYWxpemUoJ2V4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnNcIikgfTtcblx0cmVhZG9ubHkgY29sbGFwc2libGVTdGF0ZSA9IFRyZWVJdGVtQ29sbGFwc2libGVTdGF0ZS5FeHBhbmRlZDtcblx0Y29udGV4dFZhbHVlID0gUHJvZmlsZVJlc291cmNlVHlwZS5FeHRlbnNpb25zO1xuXHRjaGVja2JveDogSVRyZWVJdGVtQ2hlY2tib3hTdGF0ZSB8IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgZXhjbHVkZWRFeHRlbnNpb25zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0YXN5bmMgZ2V0Q2hpbGRyZW4oKTogUHJvbWlzZTxBcnJheTxJUHJvZmlsZVJlc291cmNlQ2hpbGRUcmVlSXRlbSAmIElQcm9maWxlRXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnMgPSAoYXdhaXQgdGhpcy5nZXRFeHRlbnNpb25zKCkpLnNvcnQoKGEsIGIpID0+IChhLmRpc3BsYXlOYW1lID8/IGEuaWRlbnRpZmllci5pZCkubG9jYWxlQ29tcGFyZShiLmRpc3BsYXlOYW1lID8/IGIuaWRlbnRpZmllci5pZCkpO1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiBleHRlbnNpb25zLm1hcDxJUHJvZmlsZVJlc291cmNlQ2hpbGRUcmVlSXRlbSAmIElQcm9maWxlRXh0ZW5zaW9uPihlID0+ICh7XG5cdFx0XHQuLi5lLFxuXHRcdFx0aGFuZGxlOiBlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSxcblx0XHRcdHBhcmVudDogdGhpcyxcblx0XHRcdGxhYmVsOiB7IGxhYmVsOiBlLmRpc3BsYXlOYW1lIHx8IGUuaWRlbnRpZmllci5pZCB9LFxuXHRcdFx0ZGVzY3JpcHRpb246IGUuYXBwbGljYXRpb25TY29wZWQgPyBsb2NhbGl6ZSgnYWxsIHByb2ZpbGVzIGFuZCBkaXNhYmxlZCcsIFwiQWxsIFByb2ZpbGVzXCIpIDogdW5kZWZpbmVkLFxuXHRcdFx0Y29sbGFwc2libGVTdGF0ZTogVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLk5vbmUsXG5cdFx0XHRjaGVja2JveDogdGhhdC5jaGVja2JveCA/IHtcblx0XHRcdFx0Z2V0IGlzQ2hlY2tlZCgpIHsgcmV0dXJuICF0aGF0LmV4Y2x1ZGVkRXh0ZW5zaW9ucy5oYXMoZS5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpOyB9LFxuXHRcdFx0XHRzZXQgaXNDaGVja2VkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdFx0XHR0aGF0LmV4Y2x1ZGVkRXh0ZW5zaW9ucy5kZWxldGUoZS5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGF0LmV4Y2x1ZGVkRXh0ZW5zaW9ucy5hZGQoZS5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2V4Y2x1ZGUnLCBcIlNlbGVjdCB7MH0gRXh0ZW5zaW9uXCIsIGUuZGlzcGxheU5hbWUgfHwgZS5pZGVudGlmaWVyLmlkKSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uOiB7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdleGNsdWRlJywgXCJTZWxlY3QgezB9IEV4dGVuc2lvblwiLCBlLmRpc3BsYXlOYW1lIHx8IGUuaWRlbnRpZmllci5pZCksXG5cdFx0XHRcdH1cblx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHR0aGVtZUljb246IENvZGljb24uZXh0ZW5zaW9ucyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6ICdleHRlbnNpb24ub3BlbicsXG5cdFx0XHRcdHRpdGxlOiAnJyxcblx0XHRcdFx0YXJndW1lbnRzOiBbZS5pZGVudGlmaWVyLmlkLCB1bmRlZmluZWQsIHRydWVdXG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgaGFzQ29udGVudCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5nZXRFeHRlbnNpb25zKCk7XG5cdFx0cmV0dXJuIGV4dGVuc2lvbnMubGVuZ3RoID4gMDtcblx0fVxuXG5cdGFic3RyYWN0IGlzRnJvbURlZmF1bHRQcm9maWxlKCk6IGJvb2xlYW47XG5cdGFic3RyYWN0IGdldENvbnRlbnQoKTogUHJvbWlzZTxzdHJpbmc+O1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0RXh0ZW5zaW9ucygpOiBQcm9taXNlPElQcm9maWxlRXh0ZW5zaW9uW10+O1xuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zUmVzb3VyY2VFeHBvcnRUcmVlSXRlbSBleHRlbmRzIEV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRpc0Zyb21EZWZhdWx0UHJvZmlsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMucHJvZmlsZS5pc0RlZmF1bHQgJiYgISF0aGlzLnByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5leHRlbnNpb25zO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEV4dGVuc2lvbnMoKTogUHJvbWlzZTxJUHJvZmlsZUV4dGVuc2lvbltdPiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1Jlc291cmNlKS5nZXRMb2NhbEV4dGVuc2lvbnModGhpcy5wcm9maWxlKTtcblx0fVxuXG5cdGFzeW5jIGdldENvbnRlbnQoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25zUmVzb3VyY2UpLmdldENvbnRlbnQodGhpcy5wcm9maWxlLCBbLi4udGhpcy5leGNsdWRlZEV4dGVuc2lvbnMudmFsdWVzKCldKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zUmVzb3VyY2VJbXBvcnRUcmVlSXRlbSBleHRlbmRzIEV4dGVuc2lvbnNSZXNvdXJjZVRyZWVJdGVtIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRlbnQ6IHN0cmluZyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGlzRnJvbURlZmF1bHRQcm9maWxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRFeHRlbnNpb25zKCk6IFByb21pc2U8SVByb2ZpbGVFeHRlbnNpb25bXT4ge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNSZXNvdXJjZSkuZ2V0UHJvZmlsZUV4dGVuc2lvbnModGhpcy5jb250ZW50KTtcblx0fVxuXG5cdGFzeW5jIGdldENvbnRlbnQoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBleHRlbnNpb25zUmVzb3VyY2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IGV4dGVuc2lvbnNSZXNvdXJjZS5nZXRQcm9maWxlRXh0ZW5zaW9ucyh0aGlzLmNvbnRlbnQpO1xuXHRcdHJldHVybiBleHRlbnNpb25zUmVzb3VyY2UudG9Db250ZW50KGV4dGVuc2lvbnMsIFsuLi50aGlzLmV4Y2x1ZGVkRXh0ZW5zaW9ucy52YWx1ZXMoKV0pO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsZ0RBQWdELDRDQUE0QywwQkFBZ0QsNkJBQTZCLHlDQUFnRjtBQUNsUSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHlCQUF5QjtBQUNsQyxT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
