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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { getErrorMessage, isCancellationError } from "../../../base/common/errors.js";
import { Schemas } from "../../../base/common/network.js";
import { basename } from "../../../base/common/resources.js";
import { gt } from "../../../base/common/semver/semver.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { EXTENSION_IDENTIFIER_REGEX, IExtensionGalleryService, IExtensionManagementService, InstallOperation } from "./extensionManagement.js";
import { areSameExtensions, getExtensionId, getGalleryExtensionId, getIdAndVersion } from "./extensionManagementUtil.js";
import { ExtensionType, EXTENSION_CATEGORIES } from "../../extensions/common/extensions.js";
const notFound = (id) => localize("notFound", "Extension '{0}' not found.", id);
const useId = localize("useId", "Make sure you use the full extension ID, including the publisher, e.g.: {0}", "ms-dotnettools.csharp");
let ExtensionManagementCLI = class {
  constructor(logger, extensionManagementService, extensionGalleryService) {
    this.logger = logger;
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
  }
  get location() {
    return void 0;
  }
  async listExtensions(showVersions, category, profileLocation) {
    let extensions = await this.extensionManagementService.getInstalled(ExtensionType.User, profileLocation);
    const categories = EXTENSION_CATEGORIES.map((c) => c.toLowerCase());
    if (category && category !== "") {
      if (categories.indexOf(category.toLowerCase()) < 0) {
        this.logger.info("Invalid category please enter a valid category. To list valid categories run --category without a category specified");
        return;
      }
      extensions = extensions.filter((e) => {
        if (e.manifest.categories) {
          const lowerCaseCategories = e.manifest.categories.map((c) => c.toLowerCase());
          return lowerCaseCategories.indexOf(category.toLowerCase()) > -1;
        }
        return false;
      });
    } else if (category === "") {
      this.logger.info("Possible Categories: ");
      categories.forEach((category2) => {
        this.logger.info(category2);
      });
      return;
    }
    if (this.location) {
      this.logger.info(localize("listFromLocation", "Extensions installed on {0}:", this.location));
    }
    extensions = extensions.sort((e1, e2) => e1.identifier.id.localeCompare(e2.identifier.id));
    let lastId = void 0;
    for (const extension of extensions) {
      if (lastId !== extension.identifier.id) {
        lastId = extension.identifier.id;
        this.logger.info(showVersions ? `${lastId}@${extension.manifest.version}` : lastId);
      }
    }
  }
  async installExtensions(extensions, builtinExtensions, installOptions, force) {
    const failed = [];
    try {
      if (extensions.length) {
        this.logger.info(this.location ? localize("installingExtensionsOnLocation", "Installing extensions on {0}...", this.location) : localize("installingExtensions", "Installing extensions..."));
      }
      const installVSIXInfos = [];
      const installExtensionInfos = [];
      const addInstallExtensionInfo = (id, version, isBuiltin) => {
        installExtensionInfos.push({ id, version: version !== "prerelease" ? version : void 0, installOptions: { ...installOptions, isBuiltin, installPreReleaseVersion: version === "prerelease" || installOptions.installPreReleaseVersion } });
      };
      for (const extension of extensions) {
        if (extension instanceof URI) {
          installVSIXInfos.push({ vsix: extension, installOptions });
        } else {
          const [id, version] = getIdAndVersion(extension);
          addInstallExtensionInfo(id, version, false);
        }
      }
      for (const extension of builtinExtensions) {
        if (extension instanceof URI) {
          installVSIXInfos.push({ vsix: extension, installOptions: { ...installOptions, isBuiltin: true, donotIncludePackAndDependencies: true } });
        } else {
          const [id, version] = getIdAndVersion(extension);
          addInstallExtensionInfo(id, version, true);
        }
      }
      const installed = await this.extensionManagementService.getInstalled(void 0, installOptions.profileLocation);
      if (installVSIXInfos.length) {
        await Promise.all(installVSIXInfos.map(async ({ vsix, installOptions: installOptions2 }) => {
          try {
            await this.installVSIX(vsix, installOptions2, force, installed);
          } catch (err) {
            this.logger.error(err);
            failed.push(vsix.toString());
          }
        }));
      }
      if (installExtensionInfos.length) {
        const failedGalleryExtensions = await this.installGalleryExtensions(installExtensionInfos, installed, force);
        failed.push(...failedGalleryExtensions);
      }
    } catch (error) {
      this.logger.error(localize("error while installing extensions", "Error while installing extensions: {0}", getErrorMessage(error)));
      throw error;
    }
    if (failed.length) {
      throw new Error(localize("installation failed", "Failed Installing Extensions: {0}", failed.join(", ")));
    }
  }
  async updateExtensions(profileLocation) {
    const installedExtensions = await this.extensionManagementService.getInstalled(ExtensionType.User, profileLocation);
    const installedExtensionsQuery = [];
    for (const extension of installedExtensions) {
      if (!!extension.identifier.uuid) {
        installedExtensionsQuery.push({ ...extension.identifier, preRelease: extension.preRelease });
      }
    }
    this.logger.trace(localize({ key: "updateExtensionsQuery", comment: ["Placeholder is for the count of extensions"] }, "Fetching latest versions for {0} extensions", installedExtensionsQuery.length));
    const availableVersions = await this.extensionGalleryService.getExtensions(installedExtensionsQuery, { compatible: true }, CancellationToken.None);
    const extensionsToUpdate = [];
    for (const newVersion of availableVersions) {
      for (const oldVersion of installedExtensions) {
        if (areSameExtensions(oldVersion.identifier, newVersion.identifier) && gt(newVersion.version, oldVersion.manifest.version)) {
          extensionsToUpdate.push({
            extension: newVersion,
            options: { operation: InstallOperation.Update, installPreReleaseVersion: oldVersion.preRelease, profileLocation, isApplicationScoped: oldVersion.isApplicationScoped }
          });
        }
      }
    }
    if (!extensionsToUpdate.length) {
      this.logger.info(localize("updateExtensionsNoExtensions", "No extension to update"));
      return;
    }
    this.logger.info(localize("updateExtensionsNewVersionsAvailable", "Updating extensions: {0}", extensionsToUpdate.map((ext) => ext.extension.identifier.id).join(", ")));
    const installationResult = await this.extensionManagementService.installGalleryExtensions(extensionsToUpdate);
    for (const extensionResult of installationResult) {
      if (extensionResult.error) {
        this.logger.error(localize("errorUpdatingExtension", "Error while updating extension {0}: {1}", extensionResult.identifier.id, getErrorMessage(extensionResult.error)));
      } else {
        this.logger.info(localize("successUpdate", "Extension '{0}' v{1} was successfully updated.", extensionResult.identifier.id, extensionResult.local?.manifest.version));
      }
    }
  }
  async installGalleryExtensions(installExtensionInfos, installed, force) {
    installExtensionInfos = installExtensionInfos.filter((installExtensionInfo) => {
      const { id, version, installOptions } = installExtensionInfo;
      const installedExtension = installed.find((i) => areSameExtensions(i.identifier, { id }));
      if (installedExtension) {
        if (!force && (!version || version === "prerelease" && installedExtension.preRelease)) {
          this.logger.info(localize("alreadyInstalled-checkAndUpdate", "Extension '{0}' v{1} is already installed. Use '--force' option to update to latest version or provide '@<version>' to install a specific version, for example: '{2}@1.2.3'.", id, installedExtension.manifest.version, id));
          return false;
        }
        if (version && installedExtension.manifest.version === version) {
          this.logger.info(localize("alreadyInstalled", "Extension '{0}' is already installed.", `${id}@${version}`));
          return false;
        }
        if (installedExtension.preRelease && version !== "prerelease") {
          installOptions.preRelease = false;
        }
      }
      return true;
    });
    if (!installExtensionInfos.length) {
      return [];
    }
    const failed = [];
    const extensionsToInstall = [];
    const galleryExtensions = await this.getGalleryExtensions(installExtensionInfos);
    await Promise.all(installExtensionInfos.map(async ({ id, version, installOptions }) => {
      const gallery = galleryExtensions.get(id.toLowerCase());
      if (!gallery) {
        this.logger.error(`${notFound(version ? `${id}@${version}` : id)}
${useId}`);
        failed.push(id);
        return;
      }
      try {
        const manifest = await this.extensionGalleryService.getManifest(gallery, CancellationToken.None);
        if (manifest && !this.validateExtensionKind(manifest)) {
          return;
        }
      } catch (err) {
        this.logger.error(err.message || err.stack || err);
        failed.push(id);
        return;
      }
      const installedExtension = installed.find((e) => areSameExtensions(e.identifier, gallery.identifier));
      if (installedExtension) {
        if (gallery.version === installedExtension.manifest.version) {
          this.logger.info(localize("alreadyInstalled", "Extension '{0}' is already installed.", version ? `${id}@${version}` : id));
          return;
        }
        this.logger.info(localize("updateMessage", "Updating the extension '{0}' to the version {1}", id, gallery.version));
      }
      if (installOptions.isBuiltin) {
        this.logger.info(version ? localize("installing builtin with version", "Installing builtin extension '{0}' v{1}...", id, version) : localize("installing builtin ", "Installing builtin extension '{0}'...", id));
      } else {
        this.logger.info(version ? localize("installing with version", "Installing extension '{0}' v{1}...", id, version) : localize("installing", "Installing extension '{0}'...", id));
      }
      extensionsToInstall.push({
        extension: gallery,
        options: { ...installOptions, installGivenVersion: !!version, isApplicationScoped: installOptions.isApplicationScoped || installedExtension?.isApplicationScoped }
      });
    }));
    if (extensionsToInstall.length) {
      const installationResult = await this.extensionManagementService.installGalleryExtensions(extensionsToInstall);
      for (const extensionResult of installationResult) {
        if (extensionResult.error) {
          this.logger.error(localize("errorInstallingExtension", "Error while installing extension {0}: {1}", extensionResult.identifier.id, getErrorMessage(extensionResult.error)));
          failed.push(extensionResult.identifier.id);
        } else {
          this.logger.info(localize("successInstall", "Extension '{0}' v{1} was successfully installed.", extensionResult.identifier.id, extensionResult.local?.manifest.version));
        }
      }
    }
    return failed;
  }
  async installVSIX(vsix, installOptions, force, installedExtensions) {
    const manifest = await this.extensionManagementService.getManifest(vsix);
    if (!manifest) {
      throw new Error("Invalid vsix");
    }
    const valid = await this.validateVSIX(manifest, force, installOptions.profileLocation, installedExtensions);
    if (valid) {
      try {
        await this.extensionManagementService.install(vsix, { ...installOptions, installGivenVersion: true });
        this.logger.info(localize("successVsixInstall", "Extension '{0}' was successfully installed.", basename(vsix)));
      } catch (error) {
        if (isCancellationError(error)) {
          this.logger.info(localize("cancelVsixInstall", "Cancelled installing extension '{0}'.", basename(vsix)));
        } else {
          throw error;
        }
      }
    }
  }
  async getGalleryExtensions(extensions) {
    const galleryExtensions = /* @__PURE__ */ new Map();
    const preRelease = extensions.some((e) => e.installOptions.installPreReleaseVersion);
    const targetPlatform = await this.extensionManagementService.getTargetPlatform();
    const extensionInfos = [];
    for (const extension of extensions) {
      if (EXTENSION_IDENTIFIER_REGEX.test(extension.id)) {
        extensionInfos.push({ ...extension, preRelease });
      }
    }
    if (extensionInfos.length) {
      const result = await this.extensionGalleryService.getExtensions(extensionInfos, { targetPlatform }, CancellationToken.None);
      for (const extension of result) {
        galleryExtensions.set(extension.identifier.id.toLowerCase(), extension);
      }
    }
    return galleryExtensions;
  }
  validateExtensionKind(_manifest) {
    return true;
  }
  async validateVSIX(manifest, force, profileLocation, installedExtensions) {
    if (!force) {
      const extensionIdentifier = { id: getGalleryExtensionId(manifest.publisher, manifest.name) };
      const newer = installedExtensions.find((local) => areSameExtensions(extensionIdentifier, local.identifier) && gt(local.manifest.version, manifest.version));
      if (newer) {
        this.logger.info(localize("forceDowngrade", "A newer version of extension '{0}' v{1} is already installed. Use '--force' option to downgrade to older version.", newer.identifier.id, newer.manifest.version, manifest.version));
        return false;
      }
    }
    return this.validateExtensionKind(manifest);
  }
  async uninstallExtensions(extensions, force, profileLocation) {
    const getId = async (extensionDescription) => {
      if (extensionDescription instanceof URI) {
        const manifest = await this.extensionManagementService.getManifest(extensionDescription);
        return getExtensionId(manifest.publisher, manifest.name);
      }
      return extensionDescription;
    };
    const uninstalledExtensions = [];
    for (const extension of extensions) {
      const id = await getId(extension);
      const installed = await this.extensionManagementService.getInstalled(void 0, profileLocation);
      const extensionsToUninstall = installed.filter((e) => areSameExtensions(e.identifier, { id }));
      if (!extensionsToUninstall.length) {
        throw new Error(`${this.notInstalled(id)}
${useId}`);
      }
      if (extensionsToUninstall.some((e) => e.type === ExtensionType.System)) {
        this.logger.info(localize("builtin", "Extension '{0}' is a Built-in extension and cannot be uninstalled", id));
        return;
      }
      if (!force && extensionsToUninstall.some((e) => e.isBuiltin)) {
        this.logger.info(localize("forceUninstall", "Extension '{0}' is marked as a Built-in extension by user. Please use '--force' option to uninstall it.", id));
        return;
      }
      this.logger.info(localize("uninstalling", "Uninstalling {0}...", id));
      for (const extensionToUninstall of extensionsToUninstall) {
        await this.extensionManagementService.uninstall(extensionToUninstall, { profileLocation });
        uninstalledExtensions.push(extensionToUninstall);
      }
      if (this.location) {
        this.logger.info(localize("successUninstallFromLocation", "Extension '{0}' was successfully uninstalled from {1}!", id, this.location));
      } else {
        this.logger.info(localize("successUninstall", "Extension '{0}' was successfully uninstalled!", id));
      }
    }
  }
  async locateExtension(extensions) {
    const installed = await this.extensionManagementService.getInstalled();
    extensions.forEach((e) => {
      installed.forEach((i) => {
        if (i.identifier.id === e) {
          if (i.location.scheme === Schemas.file) {
            this.logger.info(i.location.fsPath);
            return;
          }
        }
      });
    });
  }
  notInstalled(id) {
    return this.location ? localize("notInstalleddOnLocation", "Extension '{0}' is not installed on {1}.", id, this.location) : localize("notInstalled", "Extension '{0}' is not installed.", id);
  }
};
ExtensionManagementCLI = __decorateClass([
  __decorateParam(1, IExtensionManagementService),
  __decorateParam(2, IExtensionGalleryService)
], ExtensionManagementCLI);
export {
  ExtensionManagementCLI
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50Q0xJLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGd0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2VtdmVyL3NlbXZlci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRVhURU5TSU9OX0lERU5USUZJRVJfUkVHRVgsIElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgSUV4dGVuc2lvbkluZm8sIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUdhbGxlcnlFeHRlbnNpb24sIElMb2NhbEV4dGVuc2lvbiwgSW5zdGFsbE9wdGlvbnMsIEluc3RhbGxFeHRlbnNpb25JbmZvLCBJbnN0YWxsT3BlcmF0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zLCBnZXRFeHRlbnNpb25JZCwgZ2V0R2FsbGVyeUV4dGVuc2lvbklkLCBnZXRJZEFuZFZlcnNpb24gfSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIEVYVEVOU0lPTl9DQVRFR09SSUVTLCBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMb2dnZXIgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5cblxuY29uc3Qgbm90Rm91bmQgPSAoaWQ6IHN0cmluZykgPT4gbG9jYWxpemUoJ25vdEZvdW5kJywgXCJFeHRlbnNpb24gJ3swfScgbm90IGZvdW5kLlwiLCBpZCk7XG5jb25zdCB1c2VJZCA9IGxvY2FsaXplKCd1c2VJZCcsIFwiTWFrZSBzdXJlIHlvdSB1c2UgdGhlIGZ1bGwgZXh0ZW5zaW9uIElELCBpbmNsdWRpbmcgdGhlIHB1Ymxpc2hlciwgZS5nLjogezB9XCIsICdtcy1kb3RuZXR0b29scy5jc2hhcnAnKTtcblxudHlwZSBJbnN0YWxsVlNJWEluZm8gPSB7IHZzaXg6IFVSSTsgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxPcHRpb25zIH07XG50eXBlIEluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9uSW5mbyA9IHsgaWQ6IHN0cmluZzsgdmVyc2lvbj86IHN0cmluZzsgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxPcHRpb25zIH07XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25NYW5hZ2VtZW50Q0xJIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nZ2VyOiBJTG9nZ2VyLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHByb3RlY3RlZCBnZXQgbG9jYXRpb24oKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGxpc3RFeHRlbnNpb25zKHNob3dWZXJzaW9uczogYm9vbGVhbiwgY2F0ZWdvcnk/OiBzdHJpbmcsIHByb2ZpbGVMb2NhdGlvbj86IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyLCBwcm9maWxlTG9jYXRpb24pO1xuXHRcdGNvbnN0IGNhdGVnb3JpZXMgPSBFWFRFTlNJT05fQ0FURUdPUklFUy5tYXAoYyA9PiBjLnRvTG93ZXJDYXNlKCkpO1xuXHRcdGlmIChjYXRlZ29yeSAmJiBjYXRlZ29yeSAhPT0gJycpIHtcblx0XHRcdGlmIChjYXRlZ29yaWVzLmluZGV4T2YoY2F0ZWdvcnkudG9Mb3dlckNhc2UoKSkgPCAwKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8oJ0ludmFsaWQgY2F0ZWdvcnkgcGxlYXNlIGVudGVyIGEgdmFsaWQgY2F0ZWdvcnkuIFRvIGxpc3QgdmFsaWQgY2F0ZWdvcmllcyBydW4gLS1jYXRlZ29yeSB3aXRob3V0IGEgY2F0ZWdvcnkgc3BlY2lmaWVkJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGV4dGVuc2lvbnMgPSBleHRlbnNpb25zLmZpbHRlcihlID0+IHtcblx0XHRcdFx0aWYgKGUubWFuaWZlc3QuY2F0ZWdvcmllcykge1xuXHRcdFx0XHRcdGNvbnN0IGxvd2VyQ2FzZUNhdGVnb3JpZXM6IHN0cmluZ1tdID0gZS5tYW5pZmVzdC5jYXRlZ29yaWVzLm1hcChjID0+IGMudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdFx0cmV0dXJuIGxvd2VyQ2FzZUNhdGVnb3JpZXMuaW5kZXhPZihjYXRlZ29yeS50b0xvd2VyQ2FzZSgpKSA+IC0xO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSBpZiAoY2F0ZWdvcnkgPT09ICcnKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKCdQb3NzaWJsZSBDYXRlZ29yaWVzOiAnKTtcblx0XHRcdGNhdGVnb3JpZXMuZm9yRWFjaChjYXRlZ29yeSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8oY2F0ZWdvcnkpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmxvY2F0aW9uKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCdsaXN0RnJvbUxvY2F0aW9uJywgXCJFeHRlbnNpb25zIGluc3RhbGxlZCBvbiB7MH06XCIsIHRoaXMubG9jYXRpb24pKTtcblx0XHR9XG5cblx0XHRleHRlbnNpb25zID0gZXh0ZW5zaW9ucy5zb3J0KChlMSwgZTIpID0+IGUxLmlkZW50aWZpZXIuaWQubG9jYWxlQ29tcGFyZShlMi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0bGV0IGxhc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdGlmIChsYXN0SWQgIT09IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSB7XG5cdFx0XHRcdGxhc3RJZCA9IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkO1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKHNob3dWZXJzaW9ucyA/IGAke2xhc3RJZH1AJHtleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbn1gIDogbGFzdElkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgaW5zdGFsbEV4dGVuc2lvbnMoZXh0ZW5zaW9uczogKHN0cmluZyB8IFVSSSlbXSwgYnVpbHRpbkV4dGVuc2lvbnM6IChzdHJpbmcgfCBVUkkpW10sIGluc3RhbGxPcHRpb25zOiBJbnN0YWxsT3B0aW9ucywgZm9yY2U6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmYWlsZWQ6IHN0cmluZ1tdID0gW107XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKGV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8odGhpcy5sb2NhdGlvbiA/IGxvY2FsaXplKCdpbnN0YWxsaW5nRXh0ZW5zaW9uc09uTG9jYXRpb24nLCBcIkluc3RhbGxpbmcgZXh0ZW5zaW9ucyBvbiB7MH0uLi5cIiwgdGhpcy5sb2NhdGlvbikgOiBsb2NhbGl6ZSgnaW5zdGFsbGluZ0V4dGVuc2lvbnMnLCBcIkluc3RhbGxpbmcgZXh0ZW5zaW9ucy4uLlwiKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGluc3RhbGxWU0lYSW5mb3M6IEluc3RhbGxWU0lYSW5mb1tdID0gW107XG5cdFx0XHRjb25zdCBpbnN0YWxsRXh0ZW5zaW9uSW5mb3M6IEluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9uSW5mb1tdID0gW107XG5cdFx0XHRjb25zdCBhZGRJbnN0YWxsRXh0ZW5zaW9uSW5mbyA9IChpZDogc3RyaW5nLCB2ZXJzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIGlzQnVpbHRpbjogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHRpbnN0YWxsRXh0ZW5zaW9uSW5mb3MucHVzaCh7IGlkLCB2ZXJzaW9uOiB2ZXJzaW9uICE9PSAncHJlcmVsZWFzZScgPyB2ZXJzaW9uIDogdW5kZWZpbmVkLCBpbnN0YWxsT3B0aW9uczogeyAuLi5pbnN0YWxsT3B0aW9ucywgaXNCdWlsdGluLCBpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IHZlcnNpb24gPT09ICdwcmVyZWxlYXNlJyB8fCBpbnN0YWxsT3B0aW9ucy5pbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24gfSB9KTtcblx0XHRcdH07XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGlmIChleHRlbnNpb24gaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdFx0XHRpbnN0YWxsVlNJWEluZm9zLnB1c2goeyB2c2l4OiBleHRlbnNpb24sIGluc3RhbGxPcHRpb25zIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IFtpZCwgdmVyc2lvbl0gPSBnZXRJZEFuZFZlcnNpb24oZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHRhZGRJbnN0YWxsRXh0ZW5zaW9uSW5mbyhpZCwgdmVyc2lvbiwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBidWlsdGluRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRcdFx0aW5zdGFsbFZTSVhJbmZvcy5wdXNoKHsgdnNpeDogZXh0ZW5zaW9uLCBpbnN0YWxsT3B0aW9uczogeyAuLi5pbnN0YWxsT3B0aW9ucywgaXNCdWlsdGluOiB0cnVlLCBkb25vdEluY2x1ZGVQYWNrQW5kRGVwZW5kZW5jaWVzOiB0cnVlIH0gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgW2lkLCB2ZXJzaW9uXSA9IGdldElkQW5kVmVyc2lvbihleHRlbnNpb24pO1xuXHRcdFx0XHRcdGFkZEluc3RhbGxFeHRlbnNpb25JbmZvKGlkLCB2ZXJzaW9uLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBpbnN0YWxsZWQgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCh1bmRlZmluZWQsIGluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbik7XG5cblx0XHRcdGlmIChpbnN0YWxsVlNJWEluZm9zLmxlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChpbnN0YWxsVlNJWEluZm9zLm1hcChhc3luYyAoeyB2c2l4LCBpbnN0YWxsT3B0aW9ucyB9KSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuaW5zdGFsbFZTSVgodnNpeCwgaW5zdGFsbE9wdGlvbnMsIGZvcmNlLCBpbnN0YWxsZWQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoZXJyKTtcblx0XHRcdFx0XHRcdGZhaWxlZC5wdXNoKHZzaXgudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbnN0YWxsRXh0ZW5zaW9uSW5mb3MubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IGZhaWxlZEdhbGxlcnlFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5pbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoaW5zdGFsbEV4dGVuc2lvbkluZm9zLCBpbnN0YWxsZWQsIGZvcmNlKTtcblx0XHRcdFx0ZmFpbGVkLnB1c2goLi4uZmFpbGVkR2FsbGVyeUV4dGVuc2lvbnMpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihsb2NhbGl6ZSgnZXJyb3Igd2hpbGUgaW5zdGFsbGluZyBleHRlbnNpb25zJywgXCJFcnJvciB3aGlsZSBpbnN0YWxsaW5nIGV4dGVuc2lvbnM6IHswfVwiLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKSk7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cblx0XHRpZiAoZmFpbGVkLmxlbmd0aCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdpbnN0YWxsYXRpb24gZmFpbGVkJywgXCJGYWlsZWQgSW5zdGFsbGluZyBFeHRlbnNpb25zOiB7MH1cIiwgZmFpbGVkLmpvaW4oJywgJykpKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgdXBkYXRlRXh0ZW5zaW9ucyhwcm9maWxlTG9jYXRpb24/OiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyLCBwcm9maWxlTG9jYXRpb24pO1xuXG5cdFx0Y29uc3QgaW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5OiBJRXh0ZW5zaW9uSW5mb1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgaW5zdGFsbGVkRXh0ZW5zaW9ucykge1xuXHRcdFx0aWYgKCEhZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCkgeyAvLyBObyBuZWVkIHRvIGNoZWNrIG5ldyB2ZXJzaW9uIGZvciBhbiB1bnB1Ymxpc2hlZCBleHRlbnNpb25cblx0XHRcdFx0aW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5LnB1c2goeyAuLi5leHRlbnNpb24uaWRlbnRpZmllciwgcHJlUmVsZWFzZTogZXh0ZW5zaW9uLnByZVJlbGVhc2UgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dnZXIudHJhY2UobG9jYWxpemUoeyBrZXk6ICd1cGRhdGVFeHRlbnNpb25zUXVlcnknLCBjb21tZW50OiBbJ1BsYWNlaG9sZGVyIGlzIGZvciB0aGUgY291bnQgb2YgZXh0ZW5zaW9ucyddIH0sIFwiRmV0Y2hpbmcgbGF0ZXN0IHZlcnNpb25zIGZvciB7MH0gZXh0ZW5zaW9uc1wiLCBpbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkubGVuZ3RoKSk7XG5cdFx0Y29uc3QgYXZhaWxhYmxlVmVyc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLmdldEV4dGVuc2lvbnMoaW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5LCB7IGNvbXBhdGlibGU6IHRydWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBleHRlbnNpb25zVG9VcGRhdGU6IEluc3RhbGxFeHRlbnNpb25JbmZvW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IG5ld1ZlcnNpb24gb2YgYXZhaWxhYmxlVmVyc2lvbnMpIHtcblx0XHRcdGZvciAoY29uc3Qgb2xkVmVyc2lvbiBvZiBpbnN0YWxsZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRcdGlmIChhcmVTYW1lRXh0ZW5zaW9ucyhvbGRWZXJzaW9uLmlkZW50aWZpZXIsIG5ld1ZlcnNpb24uaWRlbnRpZmllcikgJiYgZ3QobmV3VmVyc2lvbi52ZXJzaW9uLCBvbGRWZXJzaW9uLm1hbmlmZXN0LnZlcnNpb24pKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvVXBkYXRlLnB1c2goe1xuXHRcdFx0XHRcdFx0ZXh0ZW5zaW9uOiBuZXdWZXJzaW9uLFxuXHRcdFx0XHRcdFx0b3B0aW9uczogeyBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlLCBpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IG9sZFZlcnNpb24ucHJlUmVsZWFzZSwgcHJvZmlsZUxvY2F0aW9uLCBpc0FwcGxpY2F0aW9uU2NvcGVkOiBvbGRWZXJzaW9uLmlzQXBwbGljYXRpb25TY29wZWQgfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFleHRlbnNpb25zVG9VcGRhdGUubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCd1cGRhdGVFeHRlbnNpb25zTm9FeHRlbnNpb25zJywgXCJObyBleHRlbnNpb24gdG8gdXBkYXRlXCIpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCd1cGRhdGVFeHRlbnNpb25zTmV3VmVyc2lvbnNBdmFpbGFibGUnLCBcIlVwZGF0aW5nIGV4dGVuc2lvbnM6IHswfVwiLCBleHRlbnNpb25zVG9VcGRhdGUubWFwKGV4dCA9PiBleHQuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpLmpvaW4oJywgJykpKTtcblx0XHRjb25zdCBpbnN0YWxsYXRpb25SZXN1bHQgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucyhleHRlbnNpb25zVG9VcGRhdGUpO1xuXG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb25SZXN1bHQgb2YgaW5zdGFsbGF0aW9uUmVzdWx0KSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uUmVzdWx0LmVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGxvY2FsaXplKCdlcnJvclVwZGF0aW5nRXh0ZW5zaW9uJywgXCJFcnJvciB3aGlsZSB1cGRhdGluZyBleHRlbnNpb24gezB9OiB7MX1cIiwgZXh0ZW5zaW9uUmVzdWx0LmlkZW50aWZpZXIuaWQsIGdldEVycm9yTWVzc2FnZShleHRlbnNpb25SZXN1bHQuZXJyb3IpKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCdzdWNjZXNzVXBkYXRlJywgXCJFeHRlbnNpb24gJ3swfScgdnsxfSB3YXMgc3VjY2Vzc2Z1bGx5IHVwZGF0ZWQuXCIsIGV4dGVuc2lvblJlc3VsdC5pZGVudGlmaWVyLmlkLCBleHRlbnNpb25SZXN1bHQubG9jYWw/Lm1hbmlmZXN0LnZlcnNpb24pKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucyhpbnN0YWxsRXh0ZW5zaW9uSW5mb3M6IEluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9uSW5mb1tdLCBpbnN0YWxsZWQ6IElMb2NhbEV4dGVuc2lvbltdLCBmb3JjZTogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHRpbnN0YWxsRXh0ZW5zaW9uSW5mb3MgPSBpbnN0YWxsRXh0ZW5zaW9uSW5mb3MuZmlsdGVyKGluc3RhbGxFeHRlbnNpb25JbmZvID0+IHtcblx0XHRcdGNvbnN0IHsgaWQsIHZlcnNpb24sIGluc3RhbGxPcHRpb25zIH0gPSBpbnN0YWxsRXh0ZW5zaW9uSW5mbztcblx0XHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbiA9IGluc3RhbGxlZC5maW5kKGkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaS5pZGVudGlmaWVyLCB7IGlkIH0pKTtcblx0XHRcdGlmIChpbnN0YWxsZWRFeHRlbnNpb24pIHtcblx0XHRcdFx0aWYgKCFmb3JjZSAmJiAoIXZlcnNpb24gfHwgKHZlcnNpb24gPT09ICdwcmVyZWxlYXNlJyAmJiBpbnN0YWxsZWRFeHRlbnNpb24ucHJlUmVsZWFzZSkpKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnYWxyZWFkeUluc3RhbGxlZC1jaGVja0FuZFVwZGF0ZScsIFwiRXh0ZW5zaW9uICd7MH0nIHZ7MX0gaXMgYWxyZWFkeSBpbnN0YWxsZWQuIFVzZSAnLS1mb3JjZScgb3B0aW9uIHRvIHVwZGF0ZSB0byBsYXRlc3QgdmVyc2lvbiBvciBwcm92aWRlICdAPHZlcnNpb24+JyB0byBpbnN0YWxsIGEgc3BlY2lmaWMgdmVyc2lvbiwgZm9yIGV4YW1wbGU6ICd7Mn1AMS4yLjMnLlwiLCBpZCwgaW5zdGFsbGVkRXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24sIGlkKSk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh2ZXJzaW9uICYmIGluc3RhbGxlZEV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uID09PSB2ZXJzaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnYWxyZWFkeUluc3RhbGxlZCcsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIGFscmVhZHkgaW5zdGFsbGVkLlwiLCBgJHtpZH1AJHt2ZXJzaW9ufWApKTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGluc3RhbGxlZEV4dGVuc2lvbi5wcmVSZWxlYXNlICYmIHZlcnNpb24gIT09ICdwcmVyZWxlYXNlJykge1xuXHRcdFx0XHRcdGluc3RhbGxPcHRpb25zLnByZVJlbGVhc2UgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cblx0XHRpZiAoIWluc3RhbGxFeHRlbnNpb25JbmZvcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBmYWlsZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1RvSW5zdGFsbDogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSA9IFtdO1xuXHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5nZXRHYWxsZXJ5RXh0ZW5zaW9ucyhpbnN0YWxsRXh0ZW5zaW9uSW5mb3MpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGluc3RhbGxFeHRlbnNpb25JbmZvcy5tYXAoYXN5bmMgKHsgaWQsIHZlcnNpb24sIGluc3RhbGxPcHRpb25zIH0pID0+IHtcblx0XHRcdGNvbnN0IGdhbGxlcnkgPSBnYWxsZXJ5RXh0ZW5zaW9ucy5nZXQoaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRpZiAoIWdhbGxlcnkpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuZXJyb3IoYCR7bm90Rm91bmQodmVyc2lvbiA/IGAke2lkfUAke3ZlcnNpb259YCA6IGlkKX1cXG4ke3VzZUlkfWApO1xuXHRcdFx0XHRmYWlsZWQucHVzaChpZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRNYW5pZmVzdChnYWxsZXJ5LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0aWYgKG1hbmlmZXN0ICYmICF0aGlzLnZhbGlkYXRlRXh0ZW5zaW9uS2luZChtYW5pZmVzdCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihlcnIubWVzc2FnZSB8fCBlcnIuc3RhY2sgfHwgZXJyKTtcblx0XHRcdFx0ZmFpbGVkLnB1c2goaWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb24gPSBpbnN0YWxsZWQuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZ2FsbGVyeS5pZGVudGlmaWVyKSk7XG5cdFx0XHRpZiAoaW5zdGFsbGVkRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdGlmIChnYWxsZXJ5LnZlcnNpb24gPT09IGluc3RhbGxlZEV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnYWxyZWFkeUluc3RhbGxlZCcsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIGFscmVhZHkgaW5zdGFsbGVkLlwiLCB2ZXJzaW9uID8gYCR7aWR9QCR7dmVyc2lvbn1gIDogaWQpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgndXBkYXRlTWVzc2FnZScsIFwiVXBkYXRpbmcgdGhlIGV4dGVuc2lvbiAnezB9JyB0byB0aGUgdmVyc2lvbiB7MX1cIiwgaWQsIGdhbGxlcnkudmVyc2lvbikpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGluc3RhbGxPcHRpb25zLmlzQnVpbHRpbikge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKHZlcnNpb24gPyBsb2NhbGl6ZSgnaW5zdGFsbGluZyBidWlsdGluIHdpdGggdmVyc2lvbicsIFwiSW5zdGFsbGluZyBidWlsdGluIGV4dGVuc2lvbiAnezB9JyB2ezF9Li4uXCIsIGlkLCB2ZXJzaW9uKSA6IGxvY2FsaXplKCdpbnN0YWxsaW5nIGJ1aWx0aW4gJywgXCJJbnN0YWxsaW5nIGJ1aWx0aW4gZXh0ZW5zaW9uICd7MH0nLi4uXCIsIGlkKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKHZlcnNpb24gPyBsb2NhbGl6ZSgnaW5zdGFsbGluZyB3aXRoIHZlcnNpb24nLCBcIkluc3RhbGxpbmcgZXh0ZW5zaW9uICd7MH0nIHZ7MX0uLi5cIiwgaWQsIHZlcnNpb24pIDogbG9jYWxpemUoJ2luc3RhbGxpbmcnLCBcIkluc3RhbGxpbmcgZXh0ZW5zaW9uICd7MH0nLi4uXCIsIGlkKSk7XG5cdFx0XHR9XG5cdFx0XHRleHRlbnNpb25zVG9JbnN0YWxsLnB1c2goe1xuXHRcdFx0XHRleHRlbnNpb246IGdhbGxlcnksXG5cdFx0XHRcdG9wdGlvbnM6IHsgLi4uaW5zdGFsbE9wdGlvbnMsIGluc3RhbGxHaXZlblZlcnNpb246ICEhdmVyc2lvbiwgaXNBcHBsaWNhdGlvblNjb3BlZDogaW5zdGFsbE9wdGlvbnMuaXNBcHBsaWNhdGlvblNjb3BlZCB8fCBpbnN0YWxsZWRFeHRlbnNpb24/LmlzQXBwbGljYXRpb25TY29wZWQgfSxcblx0XHRcdH0pO1xuXHRcdH0pKTtcblxuXHRcdGlmIChleHRlbnNpb25zVG9JbnN0YWxsLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaW5zdGFsbGF0aW9uUmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoZXh0ZW5zaW9uc1RvSW5zdGFsbCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvblJlc3VsdCBvZiBpbnN0YWxsYXRpb25SZXN1bHQpIHtcblx0XHRcdFx0aWYgKGV4dGVuc2lvblJlc3VsdC5lcnJvcikge1xuXHRcdFx0XHRcdHRoaXMubG9nZ2VyLmVycm9yKGxvY2FsaXplKCdlcnJvckluc3RhbGxpbmdFeHRlbnNpb24nLCBcIkVycm9yIHdoaWxlIGluc3RhbGxpbmcgZXh0ZW5zaW9uIHswfTogezF9XCIsIGV4dGVuc2lvblJlc3VsdC5pZGVudGlmaWVyLmlkLCBnZXRFcnJvck1lc3NhZ2UoZXh0ZW5zaW9uUmVzdWx0LmVycm9yKSkpO1xuXHRcdFx0XHRcdGZhaWxlZC5wdXNoKGV4dGVuc2lvblJlc3VsdC5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCdzdWNjZXNzSW5zdGFsbCcsIFwiRXh0ZW5zaW9uICd7MH0nIHZ7MX0gd2FzIHN1Y2Nlc3NmdWxseSBpbnN0YWxsZWQuXCIsIGV4dGVuc2lvblJlc3VsdC5pZGVudGlmaWVyLmlkLCBleHRlbnNpb25SZXN1bHQubG9jYWw/Lm1hbmlmZXN0LnZlcnNpb24pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWlsZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxWU0lYKHZzaXg6IFVSSSwgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxPcHRpb25zLCBmb3JjZTogYm9vbGVhbiwgaW5zdGFsbGVkRXh0ZW5zaW9uczogSUxvY2FsRXh0ZW5zaW9uW10pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRNYW5pZmVzdCh2c2l4KTtcblx0XHRpZiAoIW1hbmlmZXN0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdnNpeCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbGlkID0gYXdhaXQgdGhpcy52YWxpZGF0ZVZTSVgobWFuaWZlc3QsIGZvcmNlLCBpbnN0YWxsT3B0aW9ucy5wcm9maWxlTG9jYXRpb24sIGluc3RhbGxlZEV4dGVuc2lvbnMpO1xuXHRcdGlmICh2YWxpZCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsKHZzaXgsIHsgLi4uaW5zdGFsbE9wdGlvbnMsIGluc3RhbGxHaXZlblZlcnNpb246IHRydWUgfSk7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8obG9jYWxpemUoJ3N1Y2Nlc3NWc2l4SW5zdGFsbCcsIFwiRXh0ZW5zaW9uICd7MH0nIHdhcyBzdWNjZXNzZnVsbHkgaW5zdGFsbGVkLlwiLCBiYXNlbmFtZSh2c2l4KSkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnY2FuY2VsVnNpeEluc3RhbGwnLCBcIkNhbmNlbGxlZCBpbnN0YWxsaW5nIGV4dGVuc2lvbiAnezB9Jy5cIiwgYmFzZW5hbWUodnNpeCkpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0R2FsbGVyeUV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSW5zdGFsbEdhbGxlcnlFeHRlbnNpb25JbmZvW10pOiBQcm9taXNlPE1hcDxzdHJpbmcsIElHYWxsZXJ5RXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zID0gbmV3IE1hcDxzdHJpbmcsIElHYWxsZXJ5RXh0ZW5zaW9uPigpO1xuXHRcdGNvbnN0IHByZVJlbGVhc2UgPSBleHRlbnNpb25zLnNvbWUoZSA9PiBlLmluc3RhbGxPcHRpb25zLmluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbik7XG5cdFx0Y29uc3QgdGFyZ2V0UGxhdGZvcm0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldFRhcmdldFBsYXRmb3JtKCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSW5mb3M6IElFeHRlbnNpb25JbmZvW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoRVhURU5TSU9OX0lERU5USUZJRVJfUkVHRVgudGVzdChleHRlbnNpb24uaWQpKSB7XG5cdFx0XHRcdGV4dGVuc2lvbkluZm9zLnB1c2goeyAuLi5leHRlbnNpb24sIHByZVJlbGVhc2UgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb25JbmZvcy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhleHRlbnNpb25JbmZvcywgeyB0YXJnZXRQbGF0Zm9ybSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHJlc3VsdCkge1xuXHRcdFx0XHRnYWxsZXJ5RXh0ZW5zaW9ucy5zZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSwgZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGdhbGxlcnlFeHRlbnNpb25zO1xuXHR9XG5cblx0cHJvdGVjdGVkIHZhbGlkYXRlRXh0ZW5zaW9uS2luZChfbWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVZTSVgobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCwgZm9yY2U6IGJvb2xlYW4sIHByb2ZpbGVMb2NhdGlvbjogVVJJIHwgdW5kZWZpbmVkLCBpbnN0YWxsZWRFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghZm9yY2UpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbklkZW50aWZpZXIgPSB7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSB9O1xuXHRcdFx0Y29uc3QgbmV3ZXIgPSBpbnN0YWxsZWRFeHRlbnNpb25zLmZpbmQobG9jYWwgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZXh0ZW5zaW9uSWRlbnRpZmllciwgbG9jYWwuaWRlbnRpZmllcikgJiYgZ3QobG9jYWwubWFuaWZlc3QudmVyc2lvbiwgbWFuaWZlc3QudmVyc2lvbikpO1xuXHRcdFx0aWYgKG5ld2VyKSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8obG9jYWxpemUoJ2ZvcmNlRG93bmdyYWRlJywgXCJBIG5ld2VyIHZlcnNpb24gb2YgZXh0ZW5zaW9uICd7MH0nIHZ7MX0gaXMgYWxyZWFkeSBpbnN0YWxsZWQuIFVzZSAnLS1mb3JjZScgb3B0aW9uIHRvIGRvd25ncmFkZSB0byBvbGRlciB2ZXJzaW9uLlwiLCBuZXdlci5pZGVudGlmaWVyLmlkLCBuZXdlci5tYW5pZmVzdC52ZXJzaW9uLCBtYW5pZmVzdC52ZXJzaW9uKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52YWxpZGF0ZUV4dGVuc2lvbktpbmQobWFuaWZlc3QpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVuaW5zdGFsbEV4dGVuc2lvbnMoZXh0ZW5zaW9uczogKHN0cmluZyB8IFVSSSlbXSwgZm9yY2U6IGJvb2xlYW4sIHByb2ZpbGVMb2NhdGlvbj86IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGdldElkID0gYXN5bmMgKGV4dGVuc2lvbkRlc2NyaXB0aW9uOiBzdHJpbmcgfCBVUkkpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuXHRcdFx0aWYgKGV4dGVuc2lvbkRlc2NyaXB0aW9uIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRNYW5pZmVzdChleHRlbnNpb25EZXNjcmlwdGlvbik7XG5cdFx0XHRcdHJldHVybiBnZXRFeHRlbnNpb25JZChtYW5pZmVzdC5wdWJsaXNoZXIsIG1hbmlmZXN0Lm5hbWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbkRlc2NyaXB0aW9uO1xuXHRcdH07XG5cblx0XHRjb25zdCB1bmluc3RhbGxlZEV4dGVuc2lvbnM6IElMb2NhbEV4dGVuc2lvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgaWQgPSBhd2FpdCBnZXRJZChleHRlbnNpb24pO1xuXHRcdFx0Y29uc3QgaW5zdGFsbGVkID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQodW5kZWZpbmVkLCBwcm9maWxlTG9jYXRpb24pO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1RvVW5pbnN0YWxsID0gaW5zdGFsbGVkLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZCB9KSk7XG5cdFx0XHRpZiAoIWV4dGVuc2lvbnNUb1VuaW5zdGFsbC5sZW5ndGgpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGAke3RoaXMubm90SW5zdGFsbGVkKGlkKX1cXG4ke3VzZUlkfWApO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbnNUb1VuaW5zdGFsbC5zb21lKGUgPT4gZS50eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbSkpIHtcblx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhsb2NhbGl6ZSgnYnVpbHRpbicsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIGEgQnVpbHQtaW4gZXh0ZW5zaW9uIGFuZCBjYW5ub3QgYmUgdW5pbnN0YWxsZWRcIiwgaWQpKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFmb3JjZSAmJiBleHRlbnNpb25zVG9Vbmluc3RhbGwuc29tZShlID0+IGUuaXNCdWlsdGluKSkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCdmb3JjZVVuaW5zdGFsbCcsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIG1hcmtlZCBhcyBhIEJ1aWx0LWluIGV4dGVuc2lvbiBieSB1c2VyLiBQbGVhc2UgdXNlICctLWZvcmNlJyBvcHRpb24gdG8gdW5pbnN0YWxsIGl0LlwiLCBpZCkpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCd1bmluc3RhbGxpbmcnLCBcIlVuaW5zdGFsbGluZyB7MH0uLi5cIiwgaWQpKTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uVG9Vbmluc3RhbGwgb2YgZXh0ZW5zaW9uc1RvVW5pbnN0YWxsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudW5pbnN0YWxsKGV4dGVuc2lvblRvVW5pbnN0YWxsLCB7IHByb2ZpbGVMb2NhdGlvbiB9KTtcblx0XHRcdFx0dW5pbnN0YWxsZWRFeHRlbnNpb25zLnB1c2goZXh0ZW5zaW9uVG9Vbmluc3RhbGwpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5sb2NhdGlvbikge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKGxvY2FsaXplKCdzdWNjZXNzVW5pbnN0YWxsRnJvbUxvY2F0aW9uJywgXCJFeHRlbnNpb24gJ3swfScgd2FzIHN1Y2Nlc3NmdWxseSB1bmluc3RhbGxlZCBmcm9tIHsxfSFcIiwgaWQsIHRoaXMubG9jYXRpb24pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8obG9jYWxpemUoJ3N1Y2Nlc3NVbmluc3RhbGwnLCBcIkV4dGVuc2lvbiAnezB9JyB3YXMgc3VjY2Vzc2Z1bGx5IHVuaW5zdGFsbGVkIVwiLCBpZCkpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIGxvY2F0ZUV4dGVuc2lvbihleHRlbnNpb25zOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCk7XG5cdFx0ZXh0ZW5zaW9ucy5mb3JFYWNoKGUgPT4ge1xuXHRcdFx0aW5zdGFsbGVkLmZvckVhY2goaSA9PiB7XG5cdFx0XHRcdGlmIChpLmlkZW50aWZpZXIuaWQgPT09IGUpIHtcblx0XHRcdFx0XHRpZiAoaS5sb2NhdGlvbi5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhpLmxvY2F0aW9uLmZzUGF0aCk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbm90SW5zdGFsbGVkKGlkOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5sb2NhdGlvbiA/IGxvY2FsaXplKCdub3RJbnN0YWxsZWRkT25Mb2NhdGlvbicsIFwiRXh0ZW5zaW9uICd7MH0nIGlzIG5vdCBpbnN0YWxsZWQgb24gezF9LlwiLCBpZCwgdGhpcy5sb2NhdGlvbikgOiBsb2NhbGl6ZSgnbm90SW5zdGFsbGVkJywgXCJFeHRlbnNpb24gJ3swfScgaXMgbm90IGluc3RhbGxlZC5cIiwgaWQpO1xuXHR9XG5cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxpQkFBaUIsMkJBQTJCO0FBQ3JELFNBQVMsZUFBZTtBQUN4QixT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QkFBa0IsRUFBRSxZQUFZLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDM0YsVUFBSSxDQUFDLHNCQUFzQixRQUFRO0FBQ2xDLGNBQU0sSUFBSSxNQUFNLEdBQUcsS0FBSyxhQUFhLEVBQUUsQ0FBQztBQUFBLEVBQUssS0FBSyxFQUFFO0FBQUEsTUFDckQ7QUFDQSxVQUFJLHNCQUFzQixLQUFLLE9BQUssRUFBRSxTQUFTLGNBQWMsTUFBTSxHQUFHO0FBQ3JFLGFBQUssT0FBTyxLQUFLLFNBQVMsV0FBVyxxRUFBcUUsRUFBRSxDQUFDO0FBQzdHO0FBQUEsTUFDRDtBQUNBLFVBQUksQ0FBQyxTQUFTLHNCQUFzQixLQUFLLE9BQUssRUFBRSxTQUFTLEdBQUc7QUFDM0QsYUFBSyxPQUFPLEtBQUssU0FBUyxrQkFBa0IsMkdBQTJHLEVBQUUsQ0FBQztBQUMxSjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLE9BQU8sS0FBSyxTQUFTLGdCQUFnQix1QkFBdUIsRUFBRSxDQUFDO0FBQ3BFLGlCQUFXLHdCQUF3Qix1QkFBdUI7QUFDekQsY0FBTSxLQUFLLDJCQUEyQixVQUFVLHNCQUFzQixFQUFFLGdCQUFnQixDQUFDO0FBQ3pGLDhCQUFzQixLQUFLLG9CQUFvQjtBQUFBLE1BQ2hEO0FBRUEsVUFBSSxLQUFLLFVBQVU7QUFDbEIsYUFBSyxPQUFPLEtBQUssU0FBUyxnQ0FBZ0MsMERBQTBELElBQUksS0FBSyxRQUFRLENBQUM7QUFBQSxNQUN2SSxPQUFPO0FBQ04sYUFBSyxPQUFPLEtBQUssU0FBUyxvQkFBb0IsaURBQWlELEVBQUUsQ0FBQztBQUFBLE1BQ25HO0FBQUEsSUFFRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWEsZ0JBQWdCLFlBQXFDO0FBQ2pFLFVBQU0sWUFBWSxNQUFNLEtBQUssMkJBQTJCLGFBQWE7QUFDckUsZUFBVyxRQUFRLE9BQUs7QUFDdkIsZ0JBQVUsUUFBUSxPQUFLO0FBQ3RCLFlBQUksRUFBRSxXQUFXLE9BQU8sR0FBRztBQUMxQixjQUFJLEVBQUUsU0FBUyxXQUFXLFFBQVEsTUFBTTtBQUN2QyxpQkFBSyxPQUFPLEtBQUssRUFBRSxTQUFTLE1BQU07QUFDbEM7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLGFBQWEsSUFBWTtBQUNoQyxXQUFPLEtBQUssV0FBVyxTQUFTLDJCQUEyQiw0Q0FBNEMsSUFBSSxLQUFLLFFBQVEsSUFBSSxTQUFTLGdCQUFnQixxQ0FBcUMsRUFBRTtBQUFBLEVBQzdMO0FBRUQ7QUFyVmEseUJBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEdBTFU7IiwKICAibmFtZXMiOiBbImNhdGVnb3J5IiwgImluc3RhbGxPcHRpb25zIl0KfQo=
