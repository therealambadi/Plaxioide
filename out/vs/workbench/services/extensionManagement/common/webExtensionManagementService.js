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
import { ExtensionIdentifier, ExtensionType, TargetPlatform } from "../../../../platform/extensions/common/extensions.js";
import { InstallOperation, IExtensionGalleryService, IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { areSameExtensions, getGalleryExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IWebExtensionsScannerService } from "./extensionManagement.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AbstractExtensionManagementService, AbstractExtensionTask, toExtensionManagementError } from "../../../../platform/extensionManagement/common/abstractExtensionManagementService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { isBoolean, isUndefined } from "../../../../base/common/types.js";
import { IUserDataProfileService } from "../../userDataProfile/common/userDataProfile.js";
import { delta } from "../../../../base/common/arrays.js";
import { compare } from "../../../../base/common/strings.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
let WebExtensionManagementService = class extends AbstractExtensionManagementService {
  constructor(extensionGalleryService, telemetryService, logService, webExtensionsScannerService, extensionManifestPropertiesService, userDataProfileService, productService, allowedExtensionsService, userDataProfilesService, uriIdentityService) {
    super(extensionGalleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService);
    this.webExtensionsScannerService = webExtensionsScannerService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.userDataProfileService = userDataProfileService;
    this.disposables = this._register(new DisposableStore());
    this._onDidChangeProfile = this._register(new Emitter());
    this.onDidChangeProfile = this._onDidChangeProfile.event;
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => {
      if (!this.uriIdentityService.extUri.isEqual(e.previous.extensionsResource, e.profile.extensionsResource)) {
        e.join(this.whenProfileChanged(e));
      }
    }));
  }
  get onProfileAwareInstallExtension() {
    return super.onInstallExtension;
  }
  get onInstallExtension() {
    return Event.filter(this.onProfileAwareInstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidInstallExtensions() {
    return super.onDidInstallExtensions;
  }
  get onDidInstallExtensions() {
    return Event.filter(
      Event.map(this.onProfileAwareDidInstallExtensions, (results) => results.filter((e) => this.filterEvent(e)), this.disposables),
      (results) => results.length > 0,
      this.disposables
    );
  }
  get onProfileAwareUninstallExtension() {
    return super.onUninstallExtension;
  }
  get onUninstallExtension() {
    return Event.filter(this.onProfileAwareUninstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidUninstallExtension() {
    return super.onDidUninstallExtension;
  }
  get onDidUninstallExtension() {
    return Event.filter(this.onProfileAwareDidUninstallExtension, (e) => this.filterEvent(e), this.disposables);
  }
  get onProfileAwareDidUpdateExtensionMetadata() {
    return super.onDidUpdateExtensionMetadata;
  }
  filterEvent({ profileLocation, applicationScoped }) {
    profileLocation = profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource;
    return applicationScoped || this.uriIdentityService.extUri.isEqual(this.userDataProfileService.currentProfile.extensionsResource, profileLocation);
  }
  async getTargetPlatform() {
    return TargetPlatform.WEB;
  }
  async isExtensionPlatformCompatible(extension) {
    if (this.isConfiguredToExecuteOnWeb(extension)) {
      return true;
    }
    return super.isExtensionPlatformCompatible(extension);
  }
  async getInstalled(type, profileLocation) {
    const extensions = [];
    if (type === void 0 || type === ExtensionType.System) {
      const systemExtensions = await this.webExtensionsScannerService.scanSystemExtensions();
      extensions.push(...systemExtensions);
    }
    if (type === void 0 || type === ExtensionType.User) {
      const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(profileLocation ?? this.userDataProfileService.currentProfile.extensionsResource);
      extensions.push(...userExtensions);
    }
    return extensions.map((e) => toLocalExtension(e));
  }
  async install(location, options = {}) {
    this.logService.trace("ExtensionManagementService#install", location.toString());
    const manifest = await this.webExtensionsScannerService.scanExtensionManifest(location);
    if (!manifest || !manifest.name || !manifest.version) {
      throw new Error(`Cannot find a valid extension from the location ${location.toString()}`);
    }
    const result = await this.installExtensions([{ manifest, extension: location, options }]);
    if (result[0]?.local) {
      return result[0]?.local;
    }
    if (result[0]?.error) {
      throw result[0].error;
    }
    throw toExtensionManagementError(new Error(`Unknown error while installing extension ${getGalleryExtensionId(manifest.publisher, manifest.name)}`));
  }
  installFromLocation(location, profileLocation) {
    return this.install(location, { profileLocation });
  }
  async removeExtension(extension) {
  }
  async copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
    const target = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, toProfileLocation);
    const source = await this.webExtensionsScannerService.scanExistingExtension(extension.location, extension.type, fromProfileLocation);
    metadata = { ...source?.metadata, ...metadata };
    let scanned;
    if (target) {
      scanned = await this.webExtensionsScannerService.updateMetadata(extension, { ...target.metadata, ...metadata }, toProfileLocation);
    } else {
      scanned = await this.webExtensionsScannerService.addExtension(extension.location, metadata, toProfileLocation);
    }
    return toLocalExtension(scanned);
  }
  async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
    const result = [];
    const extensionsToInstall = (await this.webExtensionsScannerService.scanUserExtensions(fromProfileLocation)).filter((e) => extensions.some((id) => areSameExtensions(id, e.identifier)));
    if (extensionsToInstall.length) {
      await Promise.allSettled(extensionsToInstall.map(async (e) => {
        let local = await this.installFromLocation(e.location, toProfileLocation);
        if (e.metadata) {
          local = await this.updateMetadata(local, e.metadata, fromProfileLocation);
        }
        result.push(local);
      }));
    }
    return result;
  }
  async updateMetadata(local, metadata, profileLocation) {
    if (metadata.isMachineScoped === false) {
      metadata.isMachineScoped = void 0;
    }
    if (metadata.isBuiltin === false) {
      metadata.isBuiltin = void 0;
    }
    if (metadata.pinned === false) {
      metadata.pinned = void 0;
    }
    const updatedExtension = await this.webExtensionsScannerService.updateMetadata(local, metadata, profileLocation);
    const updatedLocalExtension = toLocalExtension(updatedExtension);
    this._onDidUpdateExtensionMetadata.fire({ local: updatedLocalExtension, profileLocation });
    return updatedLocalExtension;
  }
  async copyExtensions(fromProfileLocation, toProfileLocation) {
    await this.webExtensionsScannerService.copyExtensions(fromProfileLocation, toProfileLocation, (e) => !e.metadata?.isApplicationScoped);
  }
  async getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion) {
    const compatibleExtension = await super.getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion);
    if (compatibleExtension) {
      return compatibleExtension;
    }
    if (this.isConfiguredToExecuteOnWeb(extension)) {
      return extension;
    }
    return null;
  }
  isConfiguredToExecuteOnWeb(gallery) {
    const configuredExtensionKind = this.extensionManifestPropertiesService.getUserConfiguredExtensionKind(gallery.identifier);
    return !!configuredExtensionKind && configuredExtensionKind.includes("web");
  }
  getCurrentExtensionsManifestLocation() {
    return this.userDataProfileService.currentProfile.extensionsResource;
  }
  createInstallExtensionTask(manifest, extension, options) {
    return new InstallExtensionTask(manifest, extension, options, this.webExtensionsScannerService, this.userDataProfilesService);
  }
  createUninstallExtensionTask(extension, options) {
    return new UninstallExtensionTask(extension, options, this.webExtensionsScannerService);
  }
  zip(extension) {
    throw new Error("unsupported");
  }
  getManifest(vsix) {
    throw new Error("unsupported");
  }
  download() {
    throw new Error("unsupported");
  }
  async cleanUp() {
  }
  async whenProfileChanged(e) {
    const previousProfileLocation = e.previous.extensionsResource;
    const currentProfileLocation = e.profile.extensionsResource;
    if (!previousProfileLocation || !currentProfileLocation) {
      throw new Error("This should not happen");
    }
    const oldExtensions = await this.webExtensionsScannerService.scanUserExtensions(previousProfileLocation);
    const newExtensions = await this.webExtensionsScannerService.scanUserExtensions(currentProfileLocation);
    const { added, removed } = delta(oldExtensions, newExtensions, (a, b) => compare(`${ExtensionIdentifier.toKey(a.identifier.id)}@${a.manifest.version}`, `${ExtensionIdentifier.toKey(b.identifier.id)}@${b.manifest.version}`));
    this._onDidChangeProfile.fire({ added: added.map((e2) => toLocalExtension(e2)), removed: removed.map((e2) => toLocalExtension(e2)) });
  }
};
WebExtensionManagementService = __decorateClass([
  __decorateParam(0, IExtensionGalleryService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IWebExtensionsScannerService),
  __decorateParam(4, IExtensionManifestPropertiesService),
  __decorateParam(5, IUserDataProfileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IAllowedExtensionsService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, IUriIdentityService)
], WebExtensionManagementService);
function toLocalExtension(extension) {
  const metadata = getMetadata(void 0, extension);
  return {
    ...extension,
    identifier: { id: extension.identifier.id, uuid: metadata.id ?? extension.identifier.uuid },
    isMachineScoped: !!metadata.isMachineScoped,
    isApplicationScoped: !!metadata.isApplicationScoped,
    publisherId: metadata.publisherId || null,
    publisherDisplayName: metadata.publisherDisplayName,
    installedTimestamp: metadata.installedTimestamp,
    isPreReleaseVersion: !!metadata.isPreReleaseVersion,
    hasPreReleaseVersion: !!metadata.hasPreReleaseVersion,
    preRelease: extension.preRelease,
    targetPlatform: TargetPlatform.WEB,
    updated: !!metadata.updated,
    pinned: !!metadata?.pinned,
    private: !!metadata.private,
    isWorkspaceScoped: false,
    source: metadata?.source ?? (extension.identifier.uuid ? "gallery" : "resource"),
    size: metadata.size ?? 0
  };
}
function getMetadata(options, existingExtension) {
  const metadata = { ...existingExtension?.metadata || {} };
  metadata.isMachineScoped = options?.isMachineScoped || metadata.isMachineScoped;
  return metadata;
}
class InstallExtensionTask extends AbstractExtensionTask {
  constructor(manifest, extension, options, webExtensionsScannerService, userDataProfilesService) {
    super();
    this.manifest = manifest;
    this.extension = extension;
    this.options = options;
    this.webExtensionsScannerService = webExtensionsScannerService;
    this.userDataProfilesService = userDataProfilesService;
    this._profileLocation = this.options.profileLocation;
    this._operation = InstallOperation.Install;
    this.identifier = URI.isUri(extension) ? { id: getGalleryExtensionId(manifest.publisher, manifest.name) } : extension.identifier;
    this.source = extension;
  }
  get profileLocation() {
    return this._profileLocation;
  }
  get operation() {
    return isUndefined(this.options.operation) ? this._operation : this.options.operation;
  }
  async doRun(token) {
    const userExtensions = await this.webExtensionsScannerService.scanUserExtensions(this.options.profileLocation);
    const existingExtension = userExtensions.find((e) => areSameExtensions(e.identifier, this.identifier));
    if (existingExtension) {
      this._operation = InstallOperation.Update;
    }
    const metadata = getMetadata(this.options, existingExtension);
    if (!URI.isUri(this.extension)) {
      metadata.id = this.extension.identifier.uuid;
      metadata.publisherDisplayName = this.extension.publisherDisplayName;
      metadata.publisherId = this.extension.publisherId;
      metadata.installedTimestamp = Date.now();
      metadata.isPreReleaseVersion = this.extension.properties.isPreReleaseVersion;
      metadata.hasPreReleaseVersion = metadata.hasPreReleaseVersion || this.extension.properties.isPreReleaseVersion;
      metadata.isBuiltin = this.options.isBuiltin || existingExtension?.isBuiltin;
      metadata.isSystem = existingExtension?.type === ExtensionType.System ? true : void 0;
      metadata.updated = !!existingExtension;
      metadata.isApplicationScoped = this.options.isApplicationScoped || metadata.isApplicationScoped;
      metadata.private = this.extension.private;
      metadata.preRelease = isBoolean(this.options.preRelease) ? this.options.preRelease : this.options.installPreReleaseVersion || this.extension.properties.isPreReleaseVersion || metadata.preRelease;
      metadata.source = URI.isUri(this.extension) ? "resource" : "gallery";
    }
    metadata.pinned = this.options.installGivenVersion ? true : this.options.pinned ?? metadata.pinned;
    this._profileLocation = metadata.isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : this.options.profileLocation;
    const scannedExtension = URI.isUri(this.extension) ? await this.webExtensionsScannerService.addExtension(this.extension, metadata, this.profileLocation) : await this.webExtensionsScannerService.addExtensionFromGallery(this.extension, metadata, this.profileLocation);
    return toLocalExtension(scannedExtension);
  }
}
class UninstallExtensionTask extends AbstractExtensionTask {
  constructor(extension, options, webExtensionsScannerService) {
    super();
    this.extension = extension;
    this.options = options;
    this.webExtensionsScannerService = webExtensionsScannerService;
  }
  doRun(token) {
    return this.webExtensionsScannerService.removeExtension(this.extension, this.options.profileLocation);
  }
}
export {
  WebExtensionManagementService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vd2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uLCBJRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbk1hbmlmZXN0LCBUYXJnZXRQbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvY2FsRXh0ZW5zaW9uLCBJR2FsbGVyeUV4dGVuc2lvbiwgSW5zdGFsbE9wZXJhdGlvbiwgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBNZXRhZGF0YSwgSW5zdGFsbE9wdGlvbnMsIElQcm9kdWN0VmVyc2lvbiwgSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgYXJlU2FtZUV4dGVuc2lvbnMsIGdldEdhbGxlcnlFeHRlbnNpb25JZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IElQcm9maWxlQXdhcmVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSVNjYW5uZWRFeHRlbnNpb24sIElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgfSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBBYnN0cmFjdEV4dGVuc2lvblRhc2ssIElJbnN0YWxsRXh0ZW5zaW9uVGFzaywgSW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLCBJVW5pbnN0YWxsRXh0ZW5zaW9uVGFzaywgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IsIFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vYWJzdHJhY3RFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0Jvb2xlYW4sIGlzVW5kZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGlkQ2hhbmdlVXNlckRhdGFQcm9maWxlRXZlbnQsIElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgZGVsdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgY29tcGFyZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgY2xhc3MgV2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGltcGxlbWVudHMgSVByb2ZpbGVBd2FyZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRnZXQgb25Qcm9maWxlQXdhcmVJbnN0YWxsRXh0ZW5zaW9uKCkgeyByZXR1cm4gc3VwZXIub25JbnN0YWxsRXh0ZW5zaW9uOyB9XG5cdG92ZXJyaWRlIGdldCBvbkluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiBFdmVudC5maWx0ZXIodGhpcy5vblByb2ZpbGVBd2FyZUluc3RhbGxFeHRlbnNpb24sIGUgPT4gdGhpcy5maWx0ZXJFdmVudChlKSwgdGhpcy5kaXNwb3NhYmxlcyk7IH1cblxuXHRnZXQgb25Qcm9maWxlQXdhcmVEaWRJbnN0YWxsRXh0ZW5zaW9ucygpIHsgcmV0dXJuIHN1cGVyLm9uRGlkSW5zdGFsbEV4dGVuc2lvbnM7IH1cblx0b3ZlcnJpZGUgZ2V0IG9uRGlkSW5zdGFsbEV4dGVuc2lvbnMoKSB7XG5cdFx0cmV0dXJuIEV2ZW50LmZpbHRlcihcblx0XHRcdEV2ZW50Lm1hcCh0aGlzLm9uUHJvZmlsZUF3YXJlRGlkSW5zdGFsbEV4dGVuc2lvbnMsIHJlc3VsdHMgPT4gcmVzdWx0cy5maWx0ZXIoZSA9PiB0aGlzLmZpbHRlckV2ZW50KGUpKSwgdGhpcy5kaXNwb3NhYmxlcyksXG5cdFx0XHRyZXN1bHRzID0+IHJlc3VsdHMubGVuZ3RoID4gMCwgdGhpcy5kaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRnZXQgb25Qcm9maWxlQXdhcmVVbmluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiBzdXBlci5vblVuaW5zdGFsbEV4dGVuc2lvbjsgfVxuXHRvdmVycmlkZSBnZXQgb25Vbmluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiBFdmVudC5maWx0ZXIodGhpcy5vblByb2ZpbGVBd2FyZVVuaW5zdGFsbEV4dGVuc2lvbiwgZSA9PiB0aGlzLmZpbHRlckV2ZW50KGUpLCB0aGlzLmRpc3Bvc2FibGVzKTsgfVxuXG5cdGdldCBvblByb2ZpbGVBd2FyZURpZFVuaW5zdGFsbEV4dGVuc2lvbigpIHsgcmV0dXJuIHN1cGVyLm9uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uOyB9XG5cdG92ZXJyaWRlIGdldCBvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbigpIHsgcmV0dXJuIEV2ZW50LmZpbHRlcih0aGlzLm9uUHJvZmlsZUF3YXJlRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLCBlID0+IHRoaXMuZmlsdGVyRXZlbnQoZSksIHRoaXMuZGlzcG9zYWJsZXMpOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VQcm9maWxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZWFkb25seSBhZGRlZDogSUxvY2FsRXh0ZW5zaW9uW107IHJlYWRvbmx5IHJlbW92ZWQ6IElMb2NhbEV4dGVuc2lvbltdIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVByb2ZpbGUgPSB0aGlzLl9vbkRpZENoYW5nZVByb2ZpbGUuZXZlbnQ7XG5cblx0Z2V0IG9uUHJvZmlsZUF3YXJlRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEoKSB7IHJldHVybiBzdXBlci5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2U6IElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZTogSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlIGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihleHRlbnNpb25HYWxsZXJ5U2VydmljZSwgdGVsZW1ldHJ5U2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlLCBwcm9kdWN0U2VydmljZSwgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFQcm9maWxlU2VydmljZS5vbkRpZENoYW5nZUN1cnJlbnRQcm9maWxlKGUgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChlLnByZXZpb3VzLmV4dGVuc2lvbnNSZXNvdXJjZSwgZS5wcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSkpIHtcblx0XHRcdFx0ZS5qb2luKHRoaXMud2hlblByb2ZpbGVDaGFuZ2VkKGUpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckV2ZW50KHsgcHJvZmlsZUxvY2F0aW9uLCBhcHBsaWNhdGlvblNjb3BlZCB9OiB7IHByb2ZpbGVMb2NhdGlvbj86IFVSSTsgYXBwbGljYXRpb25TY29wZWQ/OiBib29sZWFuIH0pOiBib29sZWFuIHtcblx0XHRwcm9maWxlTG9jYXRpb24gPSBwcm9maWxlTG9jYXRpb24gPz8gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZTtcblx0XHRyZXR1cm4gYXBwbGljYXRpb25TY29wZWQgfHwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSwgcHJvZmlsZUxvY2F0aW9uKTtcblx0fVxuXG5cdGFzeW5jIGdldFRhcmdldFBsYXRmb3JtKCk6IFByb21pc2U8VGFyZ2V0UGxhdGZvcm0+IHtcblx0XHRyZXR1cm4gVGFyZ2V0UGxhdGZvcm0uV0VCO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGlzRXh0ZW5zaW9uUGxhdGZvcm1Db21wYXRpYmxlKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAodGhpcy5pc0NvbmZpZ3VyZWRUb0V4ZWN1dGVPbldlYihleHRlbnNpb24pKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1cGVyLmlzRXh0ZW5zaW9uUGxhdGZvcm1Db21wYXRpYmxlKGV4dGVuc2lvbik7XG5cdH1cblxuXHRhc3luYyBnZXRJbnN0YWxsZWQodHlwZT86IEV4dGVuc2lvblR5cGUsIHByb2ZpbGVMb2NhdGlvbj86IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHRjb25zdCBleHRlbnNpb25zID0gW107XG5cdFx0aWYgKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB0eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbSkge1xuXHRcdFx0Y29uc3Qgc3lzdGVtRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMud2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5TeXN0ZW1FeHRlbnNpb25zKCk7XG5cdFx0XHRleHRlbnNpb25zLnB1c2goLi4uc3lzdGVtRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlID09PSB1bmRlZmluZWQgfHwgdHlwZSA9PT0gRXh0ZW5zaW9uVHlwZS5Vc2VyKSB7XG5cdFx0XHRjb25zdCB1c2VyRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMud2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5Vc2VyRXh0ZW5zaW9ucyhwcm9maWxlTG9jYXRpb24gPz8gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0XHRleHRlbnNpb25zLnB1c2goLi4udXNlckV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0ZW5zaW9ucy5tYXAoZSA9PiB0b0xvY2FsRXh0ZW5zaW9uKGUpKTtcblx0fVxuXG5cdGFzeW5jIGluc3RhbGwobG9jYXRpb246IFVSSSwgb3B0aW9uczogSW5zdGFsbE9wdGlvbnMgPSB7fSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSNpbnN0YWxsJywgbG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgbWFuaWZlc3QgPSBhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuRXh0ZW5zaW9uTWFuaWZlc3QobG9jYXRpb24pO1xuXHRcdGlmICghbWFuaWZlc3QgfHwgIW1hbmlmZXN0Lm5hbWUgfHwgIW1hbmlmZXN0LnZlcnNpb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGZpbmQgYSB2YWxpZCBleHRlbnNpb24gZnJvbSB0aGUgbG9jYXRpb24gJHtsb2NhdGlvbi50b1N0cmluZygpfWApO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmluc3RhbGxFeHRlbnNpb25zKFt7IG1hbmlmZXN0LCBleHRlbnNpb246IGxvY2F0aW9uLCBvcHRpb25zIH1dKTtcblx0XHRpZiAocmVzdWx0WzBdPy5sb2NhbCkge1xuXHRcdFx0cmV0dXJuIHJlc3VsdFswXT8ubG9jYWw7XG5cdFx0fVxuXHRcdGlmIChyZXN1bHRbMF0/LmVycm9yKSB7XG5cdFx0XHR0aHJvdyByZXN1bHRbMF0uZXJyb3I7XG5cdFx0fVxuXHRcdHRocm93IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKG5ldyBFcnJvcihgVW5rbm93biBlcnJvciB3aGlsZSBpbnN0YWxsaW5nIGV4dGVuc2lvbiAke2dldEdhbGxlcnlFeHRlbnNpb25JZChtYW5pZmVzdC5wdWJsaXNoZXIsIG1hbmlmZXN0Lm5hbWUpfWApKTtcblx0fVxuXG5cdGluc3RhbGxGcm9tTG9jYXRpb24obG9jYXRpb246IFVSSSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHJldHVybiB0aGlzLmluc3RhbGwobG9jYXRpb24sIHsgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHJlbW92ZUV4dGVuc2lvbihleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIGRvIG5vdGhpbmdcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBjb3B5RXh0ZW5zaW9uKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkksIG1ldGFkYXRhOiBQYXJ0aWFsPE1ldGFkYXRhPik6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhbkV4aXN0aW5nRXh0ZW5zaW9uKGV4dGVuc2lvbi5sb2NhdGlvbiwgZXh0ZW5zaW9uLnR5cGUsIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRjb25zdCBzb3VyY2UgPSBhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuRXhpc3RpbmdFeHRlbnNpb24oZXh0ZW5zaW9uLmxvY2F0aW9uLCBleHRlbnNpb24udHlwZSwgZnJvbVByb2ZpbGVMb2NhdGlvbik7XG5cdFx0bWV0YWRhdGEgPSB7IC4uLnNvdXJjZT8ubWV0YWRhdGEsIC4uLm1ldGFkYXRhIH07XG5cblx0XHRsZXQgc2Nhbm5lZDtcblx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHRzY2FubmVkID0gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UudXBkYXRlTWV0YWRhdGEoZXh0ZW5zaW9uLCB7IC4uLnRhcmdldC5tZXRhZGF0YSwgLi4ubWV0YWRhdGEgfSwgdG9Qcm9maWxlTG9jYXRpb24pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzY2FubmVkID0gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UuYWRkRXh0ZW5zaW9uKGV4dGVuc2lvbi5sb2NhdGlvbiwgbWV0YWRhdGEsIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRvTG9jYWxFeHRlbnNpb24oc2Nhbm5lZCk7XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsRXh0ZW5zaW9uc0Zyb21Qcm9maWxlKGV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10sIGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSwgdG9Qcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHRjb25zdCByZXN1bHQ6IElMb2NhbEV4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1RvSW5zdGFsbCA9IChhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuVXNlckV4dGVuc2lvbnMoZnJvbVByb2ZpbGVMb2NhdGlvbikpXG5cdFx0XHQuZmlsdGVyKGUgPT4gZXh0ZW5zaW9ucy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkLCBlLmlkZW50aWZpZXIpKSk7XG5cdFx0aWYgKGV4dGVuc2lvbnNUb0luc3RhbGwubGVuZ3RoKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoZXh0ZW5zaW9uc1RvSW5zdGFsbC5tYXAoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdGxldCBsb2NhbCA9IGF3YWl0IHRoaXMuaW5zdGFsbEZyb21Mb2NhdGlvbihlLmxvY2F0aW9uLCB0b1Byb2ZpbGVMb2NhdGlvbik7XG5cdFx0XHRcdGlmIChlLm1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0bG9jYWwgPSBhd2FpdCB0aGlzLnVwZGF0ZU1ldGFkYXRhKGxvY2FsLCBlLm1ldGFkYXRhLCBmcm9tUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQucHVzaChsb2NhbCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVNZXRhZGF0YShsb2NhbDogSUxvY2FsRXh0ZW5zaW9uLCBtZXRhZGF0YTogUGFydGlhbDxNZXRhZGF0YT4sIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHQvLyB1bnNldCBpZiBmYWxzZVxuXHRcdGlmIChtZXRhZGF0YS5pc01hY2hpbmVTY29wZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRtZXRhZGF0YS5pc01hY2hpbmVTY29wZWQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChtZXRhZGF0YS5pc0J1aWx0aW4gPT09IGZhbHNlKSB7XG5cdFx0XHRtZXRhZGF0YS5pc0J1aWx0aW4gPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChtZXRhZGF0YS5waW5uZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRtZXRhZGF0YS5waW5uZWQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHVwZGF0ZWRFeHRlbnNpb24gPSBhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51cGRhdGVNZXRhZGF0YShsb2NhbCwgbWV0YWRhdGEsIHByb2ZpbGVMb2NhdGlvbik7XG5cdFx0Y29uc3QgdXBkYXRlZExvY2FsRXh0ZW5zaW9uID0gdG9Mb2NhbEV4dGVuc2lvbih1cGRhdGVkRXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhLmZpcmUoeyBsb2NhbDogdXBkYXRlZExvY2FsRXh0ZW5zaW9uLCBwcm9maWxlTG9jYXRpb24gfSk7XG5cdFx0cmV0dXJuIHVwZGF0ZWRMb2NhbEV4dGVuc2lvbjtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGNvcHlFeHRlbnNpb25zKGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSwgdG9Qcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLmNvcHlFeHRlbnNpb25zKGZyb21Qcm9maWxlTG9jYXRpb24sIHRvUHJvZmlsZUxvY2F0aW9uLCBlID0+ICFlLm1ldGFkYXRhPy5pc0FwcGxpY2F0aW9uU2NvcGVkKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBnZXRDb21wYXRpYmxlVmVyc2lvbihleHRlbnNpb246IElHYWxsZXJ5RXh0ZW5zaW9uLCBzYW1lVmVyc2lvbjogYm9vbGVhbiwgaW5jbHVkZVByZVJlbGVhc2U6IGJvb2xlYW4sIHByb2R1Y3RWZXJzaW9uOiBJUHJvZHVjdFZlcnNpb24pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGNvbXBhdGlibGVFeHRlbnNpb24gPSBhd2FpdCBzdXBlci5nZXRDb21wYXRpYmxlVmVyc2lvbihleHRlbnNpb24sIHNhbWVWZXJzaW9uLCBpbmNsdWRlUHJlUmVsZWFzZSwgcHJvZHVjdFZlcnNpb24pO1xuXHRcdGlmIChjb21wYXRpYmxlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gY29tcGF0aWJsZUV4dGVuc2lvbjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuaXNDb25maWd1cmVkVG9FeGVjdXRlT25XZWIoZXh0ZW5zaW9uKSkge1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGlzQ29uZmlndXJlZFRvRXhlY3V0ZU9uV2ViKGdhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY29uZmlndXJlZEV4dGVuc2lvbktpbmQgPSB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuZ2V0VXNlckNvbmZpZ3VyZWRFeHRlbnNpb25LaW5kKGdhbGxlcnkuaWRlbnRpZmllcik7XG5cdFx0cmV0dXJuICEhY29uZmlndXJlZEV4dGVuc2lvbktpbmQgJiYgY29uZmlndXJlZEV4dGVuc2lvbktpbmQuaW5jbHVkZXMoJ3dlYicpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEN1cnJlbnRFeHRlbnNpb25zTWFuaWZlc3RMb2NhdGlvbigpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbjogVVJJIHwgSUdhbGxlcnlFeHRlbnNpb24sIG9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyk6IElJbnN0YWxsRXh0ZW5zaW9uVGFzayB7XG5cdFx0cmV0dXJuIG5ldyBJbnN0YWxsRXh0ZW5zaW9uVGFzayhtYW5pZmVzdCwgZXh0ZW5zaW9uLCBvcHRpb25zLCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlVW5pbnN0YWxsRXh0ZW5zaW9uVGFzayhleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgb3B0aW9uczogVW5pbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMpOiBJVW5pbnN0YWxsRXh0ZW5zaW9uVGFzayB7XG5cdFx0cmV0dXJuIG5ldyBVbmluc3RhbGxFeHRlbnNpb25UYXNrKGV4dGVuc2lvbiwgb3B0aW9ucywgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UpO1xuXHR9XG5cblx0emlwKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uKTogUHJvbWlzZTxVUkk+IHsgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCcpOyB9XG5cdGdldE1hbmlmZXN0KHZzaXg6IFVSSSk6IFByb21pc2U8SUV4dGVuc2lvbk1hbmlmZXN0PiB7IHRocm93IG5ldyBFcnJvcigndW5zdXBwb3J0ZWQnKTsgfVxuXHRkb3dubG9hZCgpOiBQcm9taXNlPFVSST4geyB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkJyk7IH1cblxuXHRhc3luYyBjbGVhblVwKCk6IFByb21pc2U8dm9pZD4geyB9XG5cblx0cHJpdmF0ZSBhc3luYyB3aGVuUHJvZmlsZUNoYW5nZWQoZTogRGlkQ2hhbmdlVXNlckRhdGFQcm9maWxlRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwcmV2aW91c1Byb2ZpbGVMb2NhdGlvbiA9IGUucHJldmlvdXMuZXh0ZW5zaW9uc1Jlc291cmNlO1xuXHRcdGNvbnN0IGN1cnJlbnRQcm9maWxlTG9jYXRpb24gPSBlLnByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlO1xuXHRcdGlmICghcHJldmlvdXNQcm9maWxlTG9jYXRpb24gfHwgIWN1cnJlbnRQcm9maWxlTG9jYXRpb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVGhpcyBzaG91bGQgbm90IGhhcHBlbicpO1xuXHRcdH1cblx0XHRjb25zdCBvbGRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblVzZXJFeHRlbnNpb25zKHByZXZpb3VzUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRjb25zdCBuZXdFeHRlbnNpb25zID0gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblVzZXJFeHRlbnNpb25zKGN1cnJlbnRQcm9maWxlTG9jYXRpb24pO1xuXHRcdGNvbnN0IHsgYWRkZWQsIHJlbW92ZWQgfSA9IGRlbHRhKG9sZEV4dGVuc2lvbnMsIG5ld0V4dGVuc2lvbnMsIChhLCBiKSA9PiBjb21wYXJlKGAke0V4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoYS5pZGVudGlmaWVyLmlkKX1AJHthLm1hbmlmZXN0LnZlcnNpb259YCwgYCR7RXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShiLmlkZW50aWZpZXIuaWQpfUAke2IubWFuaWZlc3QudmVyc2lvbn1gKSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VQcm9maWxlLmZpcmUoeyBhZGRlZDogYWRkZWQubWFwKGUgPT4gdG9Mb2NhbEV4dGVuc2lvbihlKSksIHJlbW92ZWQ6IHJlbW92ZWQubWFwKGUgPT4gdG9Mb2NhbEV4dGVuc2lvbihlKSkgfSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdG9Mb2NhbEV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb24pOiBJTG9jYWxFeHRlbnNpb24ge1xuXHRjb25zdCBtZXRhZGF0YSA9IGdldE1ldGFkYXRhKHVuZGVmaW5lZCwgZXh0ZW5zaW9uKTtcblx0cmV0dXJuIHtcblx0XHQuLi5leHRlbnNpb24sXG5cdFx0aWRlbnRpZmllcjogeyBpZDogZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHV1aWQ6IG1ldGFkYXRhLmlkID8/IGV4dGVuc2lvbi5pZGVudGlmaWVyLnV1aWQgfSxcblx0XHRpc01hY2hpbmVTY29wZWQ6ICEhbWV0YWRhdGEuaXNNYWNoaW5lU2NvcGVkLFxuXHRcdGlzQXBwbGljYXRpb25TY29wZWQ6ICEhbWV0YWRhdGEuaXNBcHBsaWNhdGlvblNjb3BlZCxcblx0XHRwdWJsaXNoZXJJZDogbWV0YWRhdGEucHVibGlzaGVySWQgfHwgbnVsbCxcblx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogbWV0YWRhdGEucHVibGlzaGVyRGlzcGxheU5hbWUsXG5cdFx0aW5zdGFsbGVkVGltZXN0YW1wOiBtZXRhZGF0YS5pbnN0YWxsZWRUaW1lc3RhbXAsXG5cdFx0aXNQcmVSZWxlYXNlVmVyc2lvbjogISFtZXRhZGF0YS5pc1ByZVJlbGVhc2VWZXJzaW9uLFxuXHRcdGhhc1ByZVJlbGVhc2VWZXJzaW9uOiAhIW1ldGFkYXRhLmhhc1ByZVJlbGVhc2VWZXJzaW9uLFxuXHRcdHByZVJlbGVhc2U6IGV4dGVuc2lvbi5wcmVSZWxlYXNlLFxuXHRcdHRhcmdldFBsYXRmb3JtOiBUYXJnZXRQbGF0Zm9ybS5XRUIsXG5cdFx0dXBkYXRlZDogISFtZXRhZGF0YS51cGRhdGVkLFxuXHRcdHBpbm5lZDogISFtZXRhZGF0YT8ucGlubmVkLFxuXHRcdHByaXZhdGU6ICEhbWV0YWRhdGEucHJpdmF0ZSxcblx0XHRpc1dvcmtzcGFjZVNjb3BlZDogZmFsc2UsXG5cdFx0c291cmNlOiBtZXRhZGF0YT8uc291cmNlID8/IChleHRlbnNpb24uaWRlbnRpZmllci51dWlkID8gJ2dhbGxlcnknIDogJ3Jlc291cmNlJyksXG5cdFx0c2l6ZTogbWV0YWRhdGEuc2l6ZSA/PyAwLFxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRNZXRhZGF0YShvcHRpb25zPzogSW5zdGFsbE9wdGlvbnMsIGV4aXN0aW5nRXh0ZW5zaW9uPzogSUV4dGVuc2lvbik6IE1ldGFkYXRhIHtcblx0Y29uc3QgbWV0YWRhdGE6IE1ldGFkYXRhID0geyAuLi4oKDxJU2Nhbm5lZEV4dGVuc2lvbj5leGlzdGluZ0V4dGVuc2lvbik/Lm1ldGFkYXRhIHx8IHt9KSB9O1xuXHRtZXRhZGF0YS5pc01hY2hpbmVTY29wZWQgPSBvcHRpb25zPy5pc01hY2hpbmVTY29wZWQgfHwgbWV0YWRhdGEuaXNNYWNoaW5lU2NvcGVkO1xuXHRyZXR1cm4gbWV0YWRhdGE7XG59XG5cbmNsYXNzIEluc3RhbGxFeHRlbnNpb25UYXNrIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25UYXNrPElMb2NhbEV4dGVuc2lvbj4gaW1wbGVtZW50cyBJSW5zdGFsbEV4dGVuc2lvblRhc2sge1xuXG5cdHJlYWRvbmx5IGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyO1xuXHRyZWFkb25seSBzb3VyY2U6IFVSSSB8IElHYWxsZXJ5RXh0ZW5zaW9uO1xuXG5cdHByaXZhdGUgX3Byb2ZpbGVMb2NhdGlvbiA9IHRoaXMub3B0aW9ucy5wcm9maWxlTG9jYXRpb247XG5cdGdldCBwcm9maWxlTG9jYXRpb24oKSB7IHJldHVybiB0aGlzLl9wcm9maWxlTG9jYXRpb247IH1cblxuXHRwcml2YXRlIF9vcGVyYXRpb24gPSBJbnN0YWxsT3BlcmF0aW9uLkluc3RhbGw7XG5cdGdldCBvcGVyYXRpb24oKSB7IHJldHVybiBpc1VuZGVmaW5lZCh0aGlzLm9wdGlvbnMub3BlcmF0aW9uKSA/IHRoaXMuX29wZXJhdGlvbiA6IHRoaXMub3B0aW9ucy5vcGVyYXRpb247IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uOiBVUkkgfCBJR2FsbGVyeUV4dGVuc2lvbixcblx0XHRyZWFkb25seSBvcHRpb25zOiBJbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2U6IElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuaWRlbnRpZmllciA9IFVSSS5pc1VyaShleHRlbnNpb24pID8geyBpZDogZ2V0R2FsbGVyeUV4dGVuc2lvbklkKG1hbmlmZXN0LnB1Ymxpc2hlciwgbWFuaWZlc3QubmFtZSkgfSA6IGV4dGVuc2lvbi5pZGVudGlmaWVyO1xuXHRcdHRoaXMuc291cmNlID0gZXh0ZW5zaW9uO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGRvUnVuKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0Y29uc3QgdXNlckV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuVXNlckV4dGVuc2lvbnModGhpcy5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbik7XG5cdFx0Y29uc3QgZXhpc3RpbmdFeHRlbnNpb24gPSB1c2VyRXh0ZW5zaW9ucy5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB0aGlzLmlkZW50aWZpZXIpKTtcblx0XHRpZiAoZXhpc3RpbmdFeHRlbnNpb24pIHtcblx0XHRcdHRoaXMuX29wZXJhdGlvbiA9IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1ldGFkYXRhID0gZ2V0TWV0YWRhdGEodGhpcy5vcHRpb25zLCBleGlzdGluZ0V4dGVuc2lvbik7XG5cdFx0aWYgKCFVUkkuaXNVcmkodGhpcy5leHRlbnNpb24pKSB7XG5cdFx0XHRtZXRhZGF0YS5pZCA9IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZDtcblx0XHRcdG1ldGFkYXRhLnB1Ymxpc2hlckRpc3BsYXlOYW1lID0gdGhpcy5leHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWU7XG5cdFx0XHRtZXRhZGF0YS5wdWJsaXNoZXJJZCA9IHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlcklkO1xuXHRcdFx0bWV0YWRhdGEuaW5zdGFsbGVkVGltZXN0YW1wID0gRGF0ZS5ub3coKTtcblx0XHRcdG1ldGFkYXRhLmlzUHJlUmVsZWFzZVZlcnNpb24gPSB0aGlzLmV4dGVuc2lvbi5wcm9wZXJ0aWVzLmlzUHJlUmVsZWFzZVZlcnNpb247XG5cdFx0XHRtZXRhZGF0YS5oYXNQcmVSZWxlYXNlVmVyc2lvbiA9IG1ldGFkYXRhLmhhc1ByZVJlbGVhc2VWZXJzaW9uIHx8IHRoaXMuZXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbjtcblx0XHRcdG1ldGFkYXRhLmlzQnVpbHRpbiA9IHRoaXMub3B0aW9ucy5pc0J1aWx0aW4gfHwgZXhpc3RpbmdFeHRlbnNpb24/LmlzQnVpbHRpbjtcblx0XHRcdG1ldGFkYXRhLmlzU3lzdGVtID0gZXhpc3RpbmdFeHRlbnNpb24/LnR5cGUgPT09IEV4dGVuc2lvblR5cGUuU3lzdGVtID8gdHJ1ZSA6IHVuZGVmaW5lZDtcblx0XHRcdG1ldGFkYXRhLnVwZGF0ZWQgPSAhIWV4aXN0aW5nRXh0ZW5zaW9uO1xuXHRcdFx0bWV0YWRhdGEuaXNBcHBsaWNhdGlvblNjb3BlZCA9IHRoaXMub3B0aW9ucy5pc0FwcGxpY2F0aW9uU2NvcGVkIHx8IG1ldGFkYXRhLmlzQXBwbGljYXRpb25TY29wZWQ7XG5cdFx0XHRtZXRhZGF0YS5wcml2YXRlID0gdGhpcy5leHRlbnNpb24ucHJpdmF0ZTtcblx0XHRcdG1ldGFkYXRhLnByZVJlbGVhc2UgPSBpc0Jvb2xlYW4odGhpcy5vcHRpb25zLnByZVJlbGVhc2UpXG5cdFx0XHRcdD8gdGhpcy5vcHRpb25zLnByZVJlbGVhc2Vcblx0XHRcdFx0OiB0aGlzLm9wdGlvbnMuaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uIHx8IHRoaXMuZXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbiB8fCBtZXRhZGF0YS5wcmVSZWxlYXNlO1xuXHRcdFx0bWV0YWRhdGEuc291cmNlID0gVVJJLmlzVXJpKHRoaXMuZXh0ZW5zaW9uKSA/ICdyZXNvdXJjZScgOiAnZ2FsbGVyeSc7XG5cdFx0fVxuXHRcdG1ldGFkYXRhLnBpbm5lZCA9IHRoaXMub3B0aW9ucy5pbnN0YWxsR2l2ZW5WZXJzaW9uID8gdHJ1ZSA6ICh0aGlzLm9wdGlvbnMucGlubmVkID8/IG1ldGFkYXRhLnBpbm5lZCk7XG5cblx0XHR0aGlzLl9wcm9maWxlTG9jYXRpb24gPSBtZXRhZGF0YS5pc0FwcGxpY2F0aW9uU2NvcGVkID8gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UgOiB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uO1xuXHRcdGNvbnN0IHNjYW5uZWRFeHRlbnNpb24gPSBVUkkuaXNVcmkodGhpcy5leHRlbnNpb24pID8gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UuYWRkRXh0ZW5zaW9uKHRoaXMuZXh0ZW5zaW9uLCBtZXRhZGF0YSwgdGhpcy5wcm9maWxlTG9jYXRpb24pXG5cdFx0XHQ6IGF3YWl0IHRoaXMud2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLmFkZEV4dGVuc2lvbkZyb21HYWxsZXJ5KHRoaXMuZXh0ZW5zaW9uLCBtZXRhZGF0YSwgdGhpcy5wcm9maWxlTG9jYXRpb24pO1xuXHRcdHJldHVybiB0b0xvY2FsRXh0ZW5zaW9uKHNjYW5uZWRFeHRlbnNpb24pO1xuXHR9XG59XG5cbmNsYXNzIFVuaW5zdGFsbEV4dGVuc2lvblRhc2sgZXh0ZW5kcyBBYnN0cmFjdEV4dGVuc2lvblRhc2s8dm9pZD4gaW1wbGVtZW50cyBJVW5pbnN0YWxsRXh0ZW5zaW9uVGFzayB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogVW5pbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3ZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2U6IElXZWJFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZG9SdW4odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnJlbW92ZUV4dGVuc2lvbih0aGlzLmV4dGVuc2lvbiwgdGhpcy5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxxQkFBcUIsZUFBcUUsc0JBQXNCO0FBQ3pILFNBQTZDLGtCQUFrQiwwQkFBcUUsaUNBQWlDO0FBQ3JLLFNBQVMsV0FBVztBQUNwQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLG1CQUFtQiw2QkFBNkI7QUFDekQsU0FBcUUsb0NBQW9DO0FBQ3pHLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsb0NBQW9DLHVCQUFvRyxrQ0FBaUU7QUFDbE4sU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXLG1CQUFtQjtBQUN2QyxTQUF3QywrQkFBK0I7QUFDdkUsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUV6QixJQUFNLGdDQUFOLGNBQTRDLG1DQUFzRjtBQUFBLEVBMkJ4SSxZQUMyQix5QkFDUCxrQkFD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
