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
import * as fs from "fs";
import { Promises, Queue } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationError, getErrorMessage } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { hash } from "../../../base/common/hash.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../base/common/map.js";
import { Schemas } from "../../../base/common/network.js";
import * as path from "../../../base/common/path.js";
import { joinPath } from "../../../base/common/resources.js";
import * as semver from "../../../base/common/semver/semver.js";
import { isBoolean, isDefined, isUndefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import * as pfs from "../../../base/node/pfs.js";
import { extract, zip } from "../../../base/node/zip.js";
import * as nls from "../../../nls.js";
import { IDownloadService } from "../../download/common/download.js";
import { INativeEnvironmentService } from "../../environment/common/environment.js";
import { AbstractExtensionManagementService, AbstractExtensionTask, toExtensionManagementError } from "../common/abstractExtensionManagementService.js";
import {
  ExtensionManagementError,
  ExtensionManagementErrorCode,
  IExtensionGalleryService,
  IExtensionManagementService,
  InstallOperation,
  EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT,
  ExtensionSignatureVerificationCode,
  computeSize,
  IAllowedExtensionsService
} from "../common/extensionManagement.js";
import { areSameExtensions, computeTargetPlatform, ExtensionKey, getGalleryExtensionId, groupByExtension } from "../common/extensionManagementUtil.js";
import { IExtensionsProfileScannerService } from "../common/extensionsProfileScannerService.js";
import { IExtensionsScannerService } from "../common/extensionsScannerService.js";
import { ExtensionsDownloader } from "./extensionDownloader.js";
import { ExtensionsLifecycle } from "./extensionLifecycle.js";
import { fromExtractError, getManifest } from "./extensionManagementUtil.js";
import { ExtensionsManifestCache } from "./extensionsManifestCache.js";
import { ExtensionsWatcher } from "./extensionsWatcher.js";
import { ExtensionType } from "../../extensions/common/extensions.js";
import { isEngineValid } from "../../extensions/common/extensionValidator.js";
import { FileChangeType, FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { IInstantiationService, refineServiceDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { isLinux } from "../../../base/common/platform.js";
import { IExtensionGalleryManifestService } from "../common/extensionGalleryManifest.js";
const INativeServerExtensionManagementService = refineServiceDecorator(IExtensionManagementService);
const DELETED_FOLDER_POSTFIX = ".vsctmp";
let ExtensionManagementService = class extends AbstractExtensionManagementService {
  constructor(galleryService, telemetryService, logService, environmentService, extensionsScannerService, extensionsProfileScannerService, downloadService, instantiationService, fileService, configurationService, extensionGalleryManifestService, productService, allowedExtensionsService, uriIdentityService, userDataProfilesService) {
    super(galleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService);
    this.environmentService = environmentService;
    this.extensionsScannerService = extensionsScannerService;
    this.extensionsProfileScannerService = extensionsProfileScannerService;
    this.downloadService = downloadService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.extractingGalleryExtensions = /* @__PURE__ */ new Map();
    this.knownDirectories = new ResourceSet();
    const extensionLifecycle = this._register(instantiationService.createInstance(ExtensionsLifecycle));
    this.extensionsScanner = this._register(instantiationService.createInstance(ExtensionsScanner, (extension) => extensionLifecycle.postUninstall(extension)));
    this.manifestCache = this._register(new ExtensionsManifestCache(userDataProfilesService, fileService, uriIdentityService, this, this.logService));
    this.extensionsDownloader = this._register(instantiationService.createInstance(ExtensionsDownloader));
    const extensionsWatcher = this._register(new ExtensionsWatcher(this, this.extensionsScannerService, userDataProfilesService, extensionsProfileScannerService, uriIdentityService, fileService, logService));
    this._register(extensionsWatcher.onDidChangeExtensionsByAnotherSource((e) => this.onDidChangeExtensionsFromAnotherSource(e)));
    this.watchForExtensionsNotInstalledBySystem();
  }
  getTargetPlatform() {
    if (!this._targetPlatformPromise) {
      this._targetPlatformPromise = computeTargetPlatform(this.fileService, this.logService);
    }
    return this._targetPlatformPromise;
  }
  async zip(extension) {
    this.logService.trace("ExtensionManagementService#zip", extension.identifier.id);
    const files = await this.collectFiles(extension);
    const location = await zip(joinPath(this.extensionsDownloader.extensionsDownloadDir, generateUuid()).fsPath, files);
    return URI.file(location);
  }
  async getManifest(vsix) {
    const { location, cleanup } = await this.downloadVsix(vsix);
    const zipPath = path.resolve(location.fsPath);
    try {
      return await getManifest(zipPath);
    } finally {
      await cleanup();
    }
  }
  getInstalled(type, profileLocation = this.userDataProfilesService.defaultProfile.extensionsResource, productVersion = { version: this.productService.version, date: this.productService.date }) {
    return this.extensionsScanner.scanExtensions(type ?? null, profileLocation, productVersion);
  }
  scanAllUserInstalledExtensions() {
    return this.extensionsScanner.scanAllUserExtensions();
  }
  scanInstalledExtensionAtLocation(location) {
    return this.extensionsScanner.scanUserExtensionAtLocation(location);
  }
  async install(vsix, options = {}) {
    this.logService.trace("ExtensionManagementService#install", vsix.toString());
    const { location, cleanup } = await this.downloadVsix(vsix);
    try {
      const manifest = await getManifest(path.resolve(location.fsPath));
      const extensionId = getGalleryExtensionId(manifest.publisher, manifest.name);
      if (manifest.engines && manifest.engines.vscode && !isEngineValid(manifest.engines.vscode, this.productService.version, this.productService.date)) {
        throw new Error(nls.localize("incompatible", "Unable to install extension '{0}' as it is not compatible with VS Code '{1}'.", extensionId, this.productService.version));
      }
      const allowedToInstall = this.allowedExtensionsService.isAllowed({ id: extensionId, version: manifest.version, publisherDisplayName: void 0 });
      if (allowedToInstall !== true) {
        throw new Error(nls.localize("notAllowed", "This extension cannot be installed because {0}", allowedToInstall.value));
      }
      const results = await this.installExtensions([{ manifest, extension: location, options }]);
      const result = results.find(({ identifier }) => areSameExtensions(identifier, { id: extensionId }));
      if (result?.local) {
        return result.local;
      }
      if (result?.error) {
        throw result.error;
      }
      throw toExtensionManagementError(new Error(`Unknown error while installing extension ${extensionId}`));
    } finally {
      await cleanup();
    }
  }
  async installFromLocation(location, profileLocation) {
    this.logService.trace("ExtensionManagementService#installFromLocation", location.toString());
    const local = await this.extensionsScanner.scanUserExtensionAtLocation(location);
    if (!local || !local.manifest.name || !local.manifest.version) {
      throw new Error(`Cannot find a valid extension from the location ${location.toString()}`);
    }
    await this.addExtensionsToProfile([[local, { source: "resource" }]], profileLocation);
    this.logService.info("Successfully installed extension", local.identifier.id, profileLocation.toString());
    return local;
  }
  async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
    this.logService.trace("ExtensionManagementService#installExtensionsFromProfile", extensions, fromProfileLocation.toString(), toProfileLocation.toString());
    const extensionsToInstall = (await this.getInstalled(ExtensionType.User, fromProfileLocation)).filter((e) => extensions.some((id) => areSameExtensions(id, e.identifier)));
    if (extensionsToInstall.length) {
      const metadata = await Promise.all(extensionsToInstall.map((e) => this.extensionsScanner.scanMetadata(e, fromProfileLocation)));
      await this.addExtensionsToProfile(extensionsToInstall.map((e, index) => [e, metadata[index]]), toProfileLocation);
      this.logService.info("Successfully installed extensions", extensionsToInstall.map((e) => e.identifier.id), toProfileLocation.toString());
    }
    return extensionsToInstall;
  }
  async updateMetadata(local, metadata, profileLocation) {
    this.logService.trace("ExtensionManagementService#updateMetadata", local.identifier.id);
    if (metadata.isPreReleaseVersion) {
      metadata.preRelease = true;
      metadata.hasPreReleaseVersion = true;
    }
    if (metadata.isMachineScoped === false) {
      metadata.isMachineScoped = void 0;
    }
    if (metadata.isBuiltin === false) {
      metadata.isBuiltin = void 0;
    }
    if (metadata.pinned === false) {
      metadata.pinned = void 0;
    }
    local = await this.extensionsScanner.updateMetadata(local, metadata, profileLocation);
    this.manifestCache.invalidate(profileLocation);
    this._onDidUpdateExtensionMetadata.fire({ local, profileLocation });
    return local;
  }
  removeExtension(extension) {
    return this.extensionsScanner.deleteExtension(extension, "remove");
  }
  copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
    return this.extensionsScanner.copyExtension(extension, fromProfileLocation, toProfileLocation, metadata);
  }
  copyExtensions(fromProfileLocation, toProfileLocation) {
    return this.extensionsScanner.copyExtensions(fromProfileLocation, toProfileLocation, { version: this.productService.version, date: this.productService.date });
  }
  deleteExtensions(...extensions) {
    return this.extensionsScanner.setExtensionsForRemoval(...extensions);
  }
  async cleanUp() {
    this.logService.trace("ExtensionManagementService#cleanUp");
    try {
      await this.extensionsScanner.cleanUp();
    } catch (error) {
      this.logService.error(error);
    }
  }
  async download(extension, operation, donotVerifySignature) {
    const { location } = await this.downloadExtension(extension, operation, !donotVerifySignature);
    return location;
  }
  async downloadVsix(vsix) {
    if (vsix.scheme === Schemas.file) {
      return { location: vsix, async cleanup() {
      } };
    }
    this.logService.trace("Downloading extension from", vsix.toString());
    const location = joinPath(this.extensionsDownloader.extensionsDownloadDir, generateUuid());
    await this.downloadService.download(vsix, location);
    this.logService.info("Downloaded extension to", location.toString());
    const cleanup = async () => {
      try {
        await this.fileService.del(location);
      } catch (error) {
        this.logService.error(error);
      }
    };
    return { location, cleanup };
  }
  getCurrentExtensionsManifestLocation() {
    return this.userDataProfilesService.defaultProfile.extensionsResource;
  }
  createInstallExtensionTask(manifest, extension, options) {
    const extensionKey = extension instanceof URI ? new ExtensionKey({ id: getGalleryExtensionId(manifest.publisher, manifest.name) }, manifest.version) : ExtensionKey.create(extension);
    return this.instantiationService.createInstance(InstallExtensionInProfileTask, extensionKey, manifest, extension, options, (operation, token) => {
      if (extension instanceof URI) {
        return this.extractVSIX(extensionKey, extension, options, token);
      }
      let promise = this.extractingGalleryExtensions.get(extensionKey.toString());
      if (!promise) {
        this.extractingGalleryExtensions.set(extensionKey.toString(), promise = this.downloadAndExtractGalleryExtension(extensionKey, extension, operation, options, token));
        promise.finally(() => this.extractingGalleryExtensions.delete(extensionKey.toString()));
      }
      return promise;
    }, this.extensionsScanner);
  }
  createUninstallExtensionTask(extension, options) {
    return new UninstallExtensionInProfileTask(extension, options, this.extensionsProfileScannerService);
  }
  async downloadAndExtractGalleryExtension(extensionKey, gallery, operation, options, token) {
    const { verificationStatus, location } = await this.downloadExtension(gallery, operation, !options.donotVerifySignature, options.context?.[EXTENSION_INSTALL_CLIENT_TARGET_PLATFORM_CONTEXT]);
    try {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      const manifest = await getManifest(location.fsPath);
      if (!new ExtensionKey(gallery.identifier, gallery.version).equals(new ExtensionKey({ id: getGalleryExtensionId(manifest.publisher, manifest.name) }, manifest.version))) {
        throw new ExtensionManagementError(nls.localize("invalidManifest", "Cannot install '{0}' extension because of manifest mismatch with Marketplace", gallery.identifier.id), ExtensionManagementErrorCode.Invalid);
      }
      const local = await this.extensionsScanner.extractUserExtension(
        extensionKey,
        location.fsPath,
        false,
        token
      );
      if (verificationStatus !== ExtensionSignatureVerificationCode.Success && this.environmentService.isBuilt) {
        try {
          await this.extensionsDownloader.delete(location);
        } catch (e) {
          this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
        }
      }
      return { local, verificationStatus };
    } catch (error) {
      try {
        await this.extensionsDownloader.delete(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
      }
      throw toExtensionManagementError(error);
    }
  }
  async downloadExtension(extension, operation, verifySignature, clientTargetPlatform) {
    if (verifySignature) {
      const value = this.configurationService.getValue("extensions.verifySignature");
      verifySignature = isBoolean(value) ? value : true;
    }
    const { location, verificationStatus } = await this.extensionsDownloader.download(extension, operation, verifySignature, clientTargetPlatform);
    const shouldRequireSignature = (await this.extensionGalleryManifestService.getExtensionGalleryManifest())?.capabilities.signing?.allRepositorySigned;
    if (verificationStatus !== ExtensionSignatureVerificationCode.Success && !(verificationStatus === ExtensionSignatureVerificationCode.NotSigned && !shouldRequireSignature) && verifySignature && this.environmentService.isBuilt && !(isLinux && this.productService.quality === "stable")) {
      try {
        await this.extensionsDownloader.delete(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the downloaded file`, location.toString(), getErrorMessage(e));
      }
      if (!verificationStatus) {
        throw new ExtensionManagementError(nls.localize("signature verification not executed", "Signature verification was not executed."), ExtensionManagementErrorCode.SignatureVerificationInternal);
      }
      switch (verificationStatus) {
        case ExtensionSignatureVerificationCode.PackageIntegrityCheckFailed:
        case ExtensionSignatureVerificationCode.SignatureIsInvalid:
        case ExtensionSignatureVerificationCode.SignatureManifestIsInvalid:
        case ExtensionSignatureVerificationCode.SignatureIntegrityCheckFailed:
        case ExtensionSignatureVerificationCode.EntryIsMissing:
        case ExtensionSignatureVerificationCode.EntryIsTampered:
        case ExtensionSignatureVerificationCode.Untrusted:
        case ExtensionSignatureVerificationCode.CertificateRevoked:
        case ExtensionSignatureVerificationCode.SignatureIsNotValid:
        case ExtensionSignatureVerificationCode.SignatureArchiveHasTooManyEntries:
        case ExtensionSignatureVerificationCode.NotSigned:
          throw new ExtensionManagementError(nls.localize("signature verification failed", "Signature verification failed with '{0}' error.", verificationStatus), ExtensionManagementErrorCode.SignatureVerificationFailed);
      }
      throw new ExtensionManagementError(nls.localize("signature verification failed", "Signature verification failed with '{0}' error.", verificationStatus), ExtensionManagementErrorCode.SignatureVerificationInternal);
    }
    return { location, verificationStatus };
  }
  async extractVSIX(extensionKey, location, options, token) {
    const local = await this.extensionsScanner.extractUserExtension(
      extensionKey,
      path.resolve(location.fsPath),
      isBoolean(options.keepExisting) ? !options.keepExisting : true,
      token
    );
    return { local };
  }
  async collectFiles(extension) {
    const collectFilesFromDirectory = async (dir) => {
      let entries = await pfs.Promises.readdir(dir);
      entries = entries.map((e) => path.join(dir, e));
      const stats = await Promise.all(entries.map((e) => fs.promises.stat(e)));
      let promise = Promise.resolve([]);
      stats.forEach((stat, index) => {
        const entry = entries[index];
        if (stat.isFile()) {
          promise = promise.then((result) => [...result, entry]);
        }
        if (stat.isDirectory()) {
          promise = promise.then((result) => collectFilesFromDirectory(entry).then((files2) => [...result, ...files2]));
        }
      });
      return promise;
    };
    const files = await collectFilesFromDirectory(extension.location.fsPath);
    return files.map((f) => ({ path: `extension/${path.relative(extension.location.fsPath, f)}`, localPath: f }));
  }
  async onDidChangeExtensionsFromAnotherSource({ added, removed }) {
    if (removed) {
      const removedExtensions = added && this.uriIdentityService.extUri.isEqual(removed.profileLocation, added.profileLocation) ? removed.extensions.filter((e) => added.extensions.every((identifier) => !areSameExtensions(identifier, e))) : removed.extensions;
      for (const identifier of removedExtensions) {
        this.logService.info("Extensions removed from another source", identifier.id, removed.profileLocation.toString());
        this._onDidUninstallExtension.fire({ identifier, profileLocation: removed.profileLocation });
      }
    }
    if (added) {
      const extensions = await this.getInstalled(ExtensionType.User, added.profileLocation);
      const addedExtensions = extensions.filter((e) => added.extensions.some((identifier) => areSameExtensions(identifier, e.identifier)));
      this._onDidInstallExtensions.fire(addedExtensions.map((local) => {
        this.logService.info("Extensions added from another source", local.identifier.id, added.profileLocation.toString());
        return { identifier: local.identifier, local, profileLocation: added.profileLocation, operation: InstallOperation.None };
      }));
    }
  }
  async watchForExtensionsNotInstalledBySystem() {
    this._register(this.extensionsScanner.onExtract((resource) => this.knownDirectories.add(resource)));
    const stat = await this.fileService.resolve(this.extensionsScannerService.userExtensionsLocation);
    for (const childStat of stat.children ?? []) {
      if (childStat.isDirectory) {
        this.knownDirectories.add(childStat.resource);
      }
    }
    this._register(this.fileService.watch(this.extensionsScannerService.userExtensionsLocation));
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
  }
  async onDidFilesChange(e) {
    if (!e.affects(this.extensionsScannerService.userExtensionsLocation, FileChangeType.ADDED)) {
      return;
    }
    const added = [];
    for (const resource of e.rawAdded) {
      if (this.knownDirectories.has(resource)) {
        continue;
      }
      if (!this.uriIdentityService.extUri.isEqual(this.uriIdentityService.extUri.dirname(resource), this.extensionsScannerService.userExtensionsLocation)) {
        continue;
      }
      if (this.uriIdentityService.extUri.isEqual(resource, this.uriIdentityService.extUri.joinPath(this.extensionsScannerService.userExtensionsLocation, ".obsolete"))) {
        continue;
      }
      if (this.uriIdentityService.extUri.basename(resource).startsWith(".")) {
        continue;
      }
      if (this.uriIdentityService.extUri.basename(resource).endsWith(DELETED_FOLDER_POSTFIX)) {
        continue;
      }
      try {
        if (!(await this.fileService.stat(resource)).isDirectory) {
          continue;
        }
      } catch (error) {
        if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
          this.logService.error(error);
        }
        continue;
      }
      const extension = await this.extensionsScanner.scanUserExtensionAtLocation(resource);
      if (extension && extension.installedTimestamp === void 0) {
        this.knownDirectories.add(resource);
        added.push(extension);
      }
    }
    if (added.length) {
      await this.addExtensionsToProfile(added.map((e2) => [e2, void 0]), this.userDataProfilesService.defaultProfile.extensionsResource);
      this.logService.info("Added extensions to default profile from external source", added.map((e2) => e2.identifier.id));
    }
  }
  async addExtensionsToProfile(extensions, profileLocation) {
    const localExtensions = extensions.map((e) => e[0]);
    await this.extensionsScanner.unsetExtensionsForRemoval(...localExtensions.map((extension) => ExtensionKey.create(extension)));
    await this.extensionsProfileScannerService.addExtensionsToProfile(extensions, profileLocation);
    this._onDidInstallExtensions.fire(localExtensions.map((local) => ({ local, identifier: local.identifier, operation: InstallOperation.None, profileLocation })));
  }
};
ExtensionManagementService = __decorateClass([
  __decorateParam(0, IExtensionGalleryService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, ILogService),
  __decorateParam(3, INativeEnvironmentService),
  __decorateParam(4, IExtensionsScannerService),
  __decorateParam(5, IExtensionsProfileScannerService),
  __decorateParam(6, IDownloadService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IFileService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IExtensionGalleryManifestService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IAllowedExtensionsService),
  __decorateParam(13, IUriIdentityService),
  __decorateParam(14, IUserDataProfilesService)
], ExtensionManagementService);
let ExtensionsScanner = class extends Disposable {
  constructor(beforeRemovingExtension, fileService, extensionsScannerService, extensionsProfileScannerService, uriIdentityService, telemetryService, logService) {
    super();
    this.beforeRemovingExtension = beforeRemovingExtension;
    this.fileService = fileService;
    this.extensionsScannerService = extensionsScannerService;
    this.extensionsProfileScannerService = extensionsProfileScannerService;
    this.uriIdentityService = uriIdentityService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this._onExtract = this._register(new Emitter());
    this.onExtract = this._onExtract.event;
    this.scanAllExtensionPromise = new ResourceMap();
    this.scanUserExtensionsPromise = new ResourceMap();
    this.obsoletedResource = joinPath(this.extensionsScannerService.userExtensionsLocation, ".obsolete");
    this.obsoleteFileLimiter = new Queue();
  }
  async cleanUp() {
    await this.removeTemporarilyDeletedFolders();
    await this.deleteExtensionsMarkedForRemoval();
    await this.initializeExtensionSize();
  }
  async scanExtensions(type, profileLocation, productVersion) {
    try {
      const userScanOptions = { includeInvalid: true, profileLocation, productVersion };
      let scannedExtensions = [];
      if (type === null || type === ExtensionType.System) {
        let scanAllExtensionsPromise = this.scanAllExtensionPromise.get(profileLocation);
        if (!scanAllExtensionsPromise) {
          scanAllExtensionsPromise = this.extensionsScannerService.scanAllExtensions({}, userScanOptions).finally(() => this.scanAllExtensionPromise.delete(profileLocation));
          this.scanAllExtensionPromise.set(profileLocation, scanAllExtensionsPromise);
        }
        scannedExtensions.push(...await scanAllExtensionsPromise);
      } else if (type === ExtensionType.User) {
        let scanUserExtensionsPromise = this.scanUserExtensionsPromise.get(profileLocation);
        if (!scanUserExtensionsPromise) {
          scanUserExtensionsPromise = this.extensionsScannerService.scanUserExtensions(userScanOptions).finally(() => this.scanUserExtensionsPromise.delete(profileLocation));
          this.scanUserExtensionsPromise.set(profileLocation, scanUserExtensionsPromise);
        }
        scannedExtensions.push(...await scanUserExtensionsPromise);
      }
      scannedExtensions = type !== null ? scannedExtensions.filter((r) => r.type === type) : scannedExtensions;
      return await Promise.all(scannedExtensions.map((extension) => this.toLocalExtension(extension)));
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.Scanning);
    }
  }
  async scanAllUserExtensions() {
    try {
      const scannedExtensions = await this.extensionsScannerService.scanAllUserExtensions();
      return await Promise.all(scannedExtensions.map((extension) => this.toLocalExtension(extension)));
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.Scanning);
    }
  }
  async scanUserExtensionAtLocation(location) {
    try {
      const scannedExtension = await this.extensionsScannerService.scanExistingExtension(location, ExtensionType.User, { includeInvalid: true });
      if (scannedExtension) {
        return await this.toLocalExtension(scannedExtension);
      }
    } catch (error) {
      this.logService.error(error);
    }
    return null;
  }
  async extractUserExtension(extensionKey, zipPath, removeIfExists, token) {
    const folderName = extensionKey.toString();
    const tempLocation = URI.file(path.join(this.extensionsScannerService.userExtensionsLocation.fsPath, `.${generateUuid()}`));
    const extensionLocation = URI.file(path.join(this.extensionsScannerService.userExtensionsLocation.fsPath, folderName));
    if (await this.fileService.exists(extensionLocation)) {
      if (!removeIfExists) {
        try {
          return await this.scanLocalExtension(extensionLocation, ExtensionType.User);
        } catch (error) {
          this.logService.warn(`Error while scanning the existing extension at ${extensionLocation.path}. Deleting the existing extension and extracting it.`, getErrorMessage(error));
        }
      }
      try {
        await this.deleteExtensionFromLocation(extensionKey.id, extensionLocation, "removeExisting");
      } catch (error) {
        throw new ExtensionManagementError(nls.localize("errorDeleting", "Unable to delete the existing folder '{0}' while installing the extension '{1}'. Please delete the folder manually and try again", extensionLocation.fsPath, extensionKey.id), ExtensionManagementErrorCode.Delete);
      }
    }
    try {
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      try {
        this.logService.trace(`Started extracting the extension from ${zipPath} to ${extensionLocation.fsPath}`);
        await extract(zipPath, tempLocation.fsPath, { sourcePath: "extension", overwrite: true }, token);
        this.logService.info(`Extracted extension to ${extensionLocation}:`, extensionKey.id);
      } catch (e) {
        throw fromExtractError(e);
      }
      const metadata = { installedTimestamp: Date.now(), targetPlatform: extensionKey.targetPlatform };
      try {
        metadata.size = await computeSize(tempLocation, this.fileService);
      } catch (error) {
        this.logService.warn(`Error while getting the size of the extracted extension : ${tempLocation.fsPath}`, getErrorMessage(error));
      }
      try {
        await this.extensionsScannerService.updateManifestMetadata(tempLocation, metadata);
      } catch (error) {
        this.telemetryService.publicLog2("extension:extract", { extensionId: extensionKey.id, code: `${toFileOperationResult(error)}` });
        throw toExtensionManagementError(error, ExtensionManagementErrorCode.UpdateMetadata);
      }
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      try {
        this.logService.trace(`Started renaming the extension from ${tempLocation.fsPath} to ${extensionLocation.fsPath}`);
        await this.rename(tempLocation.fsPath, extensionLocation.fsPath);
        this.logService.info("Renamed to", extensionLocation.fsPath);
      } catch (error) {
        if (error.code === "ENOTEMPTY") {
          this.logService.info(`Rename failed because extension was installed by another source. So ignoring renaming.`, extensionKey.id);
          try {
            await this.fileService.del(tempLocation, { recursive: true });
          } catch (e) {
          }
        } else {
          this.logService.info(`Rename failed because of ${getErrorMessage(error)}. Deleted from extracted location`, tempLocation);
          throw error;
        }
      }
      this._onExtract.fire(extensionLocation);
    } catch (error) {
      try {
        await this.fileService.del(tempLocation, { recursive: true });
      } catch (e) {
      }
      throw error;
    }
    return this.scanLocalExtension(extensionLocation, ExtensionType.User);
  }
  async scanMetadata(local, profileLocation) {
    const extension = await this.getScannedExtension(local, profileLocation);
    return extension?.metadata;
  }
  async getScannedExtension(local, profileLocation) {
    const extensions = await this.extensionsProfileScannerService.scanProfileExtensions(profileLocation);
    return extensions.find((e) => areSameExtensions(e.identifier, local.identifier));
  }
  async updateMetadata(local, metadata, profileLocation) {
    try {
      await this.extensionsProfileScannerService.updateMetadata([[local, metadata]], profileLocation);
    } catch (error) {
      this.telemetryService.publicLog2("extension:extract", { extensionId: local.identifier.id, code: `${toFileOperationResult(error)}`, isProfile: !!profileLocation });
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.UpdateMetadata);
    }
    return this.scanLocalExtension(local.location, local.type, profileLocation);
  }
  async setExtensionsForRemoval(...extensions) {
    const extensionsToRemove = [];
    for (const extension of extensions) {
      if (await this.fileService.exists(extension.location)) {
        extensionsToRemove.push(extension);
      }
    }
    const extensionKeys = extensionsToRemove.map((e) => ExtensionKey.create(e));
    await this.withRemovedExtensions((removedExtensions) => extensionKeys.forEach((extensionKey) => {
      removedExtensions[extensionKey.toString()] = true;
      this.logService.info("Marked extension as removed", extensionKey.toString());
    }));
  }
  async unsetExtensionsForRemoval(...extensionKeys) {
    try {
      const results = [];
      await this.withRemovedExtensions((removedExtensions) => extensionKeys.forEach((extensionKey) => {
        if (removedExtensions[extensionKey.toString()]) {
          results.push(true);
          delete removedExtensions[extensionKey.toString()];
        } else {
          results.push(false);
        }
      }));
      return results;
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.UnsetRemoved);
    }
  }
  async deleteExtension(extension, type) {
    if (this.uriIdentityService.extUri.isEqualOrParent(extension.location, this.extensionsScannerService.userExtensionsLocation)) {
      await this.deleteExtensionFromLocation(extension.identifier.id, extension.location, type);
      await this.unsetExtensionsForRemoval(ExtensionKey.create(extension));
    }
  }
  async copyExtension(extension, fromProfileLocation, toProfileLocation, metadata) {
    const source = await this.getScannedExtension(extension, fromProfileLocation);
    const target = await this.getScannedExtension(extension, toProfileLocation);
    metadata = { ...source?.metadata, ...metadata };
    if (target) {
      if (this.uriIdentityService.extUri.isEqual(target.location, extension.location)) {
        await this.extensionsProfileScannerService.updateMetadata([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
      } else {
        const targetExtension = await this.scanLocalExtension(target.location, extension.type, toProfileLocation);
        await this.extensionsProfileScannerService.removeExtensionsFromProfile([targetExtension.identifier], toProfileLocation);
        await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, { ...target.metadata, ...metadata }]], toProfileLocation);
      }
    } else {
      await this.extensionsProfileScannerService.addExtensionsToProfile([[extension, metadata]], toProfileLocation);
    }
    return this.scanLocalExtension(extension.location, extension.type, toProfileLocation);
  }
  async copyExtensions(fromProfileLocation, toProfileLocation, productVersion) {
    const fromExtensions = await this.scanExtensions(ExtensionType.User, fromProfileLocation, productVersion);
    const extensions = await Promise.all(fromExtensions.filter((e) => !e.isApplicationScoped).map(async (e) => [e, await this.scanMetadata(e, fromProfileLocation)]));
    await this.extensionsProfileScannerService.addExtensionsToProfile(extensions, toProfileLocation);
  }
  async deleteExtensionFromLocation(id, location, type) {
    this.logService.trace(`Deleting ${type} extension from disk`, id, location.fsPath);
    const renamedLocation = this.uriIdentityService.extUri.joinPath(this.uriIdentityService.extUri.dirname(location), `${this.uriIdentityService.extUri.basename(location)}.${hash(generateUuid()).toString(16)}${DELETED_FOLDER_POSTFIX}`);
    await this.rename(location.fsPath, renamedLocation.fsPath);
    await this.fileService.del(renamedLocation, { recursive: true });
    this.logService.info(`Deleted ${type} extension from disk`, id, location.fsPath);
  }
  withRemovedExtensions(updateFn) {
    return this.obsoleteFileLimiter.queue(async () => {
      let raw;
      try {
        const content = await this.fileService.readFile(this.obsoletedResource, "utf8");
        raw = content.value.toString();
      } catch (error) {
        if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
          throw error;
        }
      }
      let removed = {};
      if (raw) {
        try {
          removed = JSON.parse(raw);
        } catch (e) {
        }
      }
      if (updateFn) {
        updateFn(removed);
        if (Object.keys(removed).length) {
          await this.fileService.writeFile(this.obsoletedResource, VSBuffer.fromString(JSON.stringify(removed)));
        } else {
          try {
            await this.fileService.del(this.obsoletedResource);
          } catch (error) {
            if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
              throw error;
            }
          }
        }
      }
      return removed;
    });
  }
  async rename(extractPath, renamePath) {
    try {
      await pfs.Promises.rename(
        extractPath,
        renamePath,
        2 * 60 * 1e3
        /* Retry for 2 minutes */
      );
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.Rename);
    }
  }
  async scanLocalExtension(location, type, profileLocation) {
    try {
      if (profileLocation) {
        const scannedExtensions = await this.extensionsScannerService.scanUserExtensions({ profileLocation });
        const scannedExtension = scannedExtensions.find((e) => this.uriIdentityService.extUri.isEqual(e.location, location));
        if (scannedExtension) {
          return await this.toLocalExtension(scannedExtension);
        }
      } else {
        const scannedExtension = await this.extensionsScannerService.scanExistingExtension(location, type, { includeInvalid: true });
        if (scannedExtension) {
          return await this.toLocalExtension(scannedExtension);
        }
      }
      throw new ExtensionManagementError(nls.localize("cannot read", "Cannot read the extension from {0}", location.path), ExtensionManagementErrorCode.ScanningExtension);
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.ScanningExtension);
    }
  }
  async toLocalExtension(extension) {
    let stat;
    try {
      stat = await this.fileService.resolve(extension.location);
    } catch (error) {
    }
    let readmeUrl;
    let changelogUrl;
    if (stat?.children) {
      readmeUrl = stat.children.find(({ name }) => /^readme(\.txt|\.md|)$/i.test(name))?.resource;
      changelogUrl = stat.children.find(({ name }) => /^changelog(\.txt|\.md|)$/i.test(name))?.resource;
    }
    return {
      identifier: extension.identifier,
      type: extension.type,
      isBuiltin: extension.isBuiltin || !!extension.metadata?.isBuiltin,
      location: extension.location,
      manifest: extension.manifest,
      targetPlatform: extension.targetPlatform,
      validations: extension.validations,
      isValid: extension.isValid,
      readmeUrl,
      changelogUrl,
      publisherDisplayName: extension.metadata?.publisherDisplayName,
      publisherId: extension.metadata?.publisherId || null,
      isApplicationScoped: !!extension.metadata?.isApplicationScoped,
      isMachineScoped: !!extension.metadata?.isMachineScoped,
      isPreReleaseVersion: !!extension.metadata?.isPreReleaseVersion,
      hasPreReleaseVersion: !!extension.metadata?.hasPreReleaseVersion,
      preRelease: extension.preRelease,
      installedTimestamp: extension.metadata?.installedTimestamp,
      updated: !!extension.metadata?.updated,
      pinned: !!extension.metadata?.pinned,
      private: !!extension.metadata?.private,
      isWorkspaceScoped: false,
      source: extension.metadata?.source ?? (extension.identifier.uuid ? "gallery" : "vsix"),
      size: extension.metadata?.size ?? 0
    };
  }
  async initializeExtensionSize() {
    const extensions = await this.extensionsScannerService.scanAllUserExtensions();
    await Promise.all(extensions.map(async (extension) => {
      if (isDefined(extension.metadata?.installedTimestamp) && isUndefined(extension.metadata?.size)) {
        const size = await computeSize(extension.location, this.fileService);
        await this.extensionsScannerService.updateManifestMetadata(extension.location, { size });
      }
    }));
  }
  async deleteExtensionsMarkedForRemoval() {
    let removed;
    try {
      removed = await this.withRemovedExtensions();
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.ReadRemoved);
    }
    if (Object.keys(removed).length === 0) {
      this.logService.debug(`No extensions are marked as removed.`);
      return;
    }
    this.logService.debug(`Deleting extensions marked as removed:`, Object.keys(removed));
    const extensions = await this.scanAllUserExtensions();
    const installed = /* @__PURE__ */ new Set();
    for (const e of extensions) {
      if (!removed[ExtensionKey.create(e).toString()]) {
        installed.add(e.identifier.id.toLowerCase());
      }
    }
    try {
      const byExtension = groupByExtension(extensions, (e) => e.identifier);
      await Promises.settled(byExtension.map(async (e) => {
        const latest = e.sort((a, b) => semver.rcompare(a.manifest.version, b.manifest.version))[0];
        if (!installed.has(latest.identifier.id.toLowerCase())) {
          await this.beforeRemovingExtension(latest);
        }
      }));
    } catch (error) {
      this.logService.error(error);
    }
    const toRemove = extensions.filter((e) => e.installedTimestamp && removed[ExtensionKey.create(e).toString()]);
    await Promise.allSettled(toRemove.map((e) => this.deleteExtension(e, "marked for removal")));
  }
  async removeTemporarilyDeletedFolders() {
    this.logService.trace("ExtensionManagementService#removeTempDeleteFolders");
    let stat;
    try {
      stat = await this.fileService.resolve(this.extensionsScannerService.userExtensionsLocation);
    } catch (error) {
      if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
        this.logService.error(error);
      }
      return;
    }
    if (!stat?.children) {
      return;
    }
    try {
      await Promise.allSettled(stat.children.map(async (child) => {
        if (!child.isDirectory || !child.name.endsWith(DELETED_FOLDER_POSTFIX)) {
          return;
        }
        this.logService.trace("Deleting the temporarily deleted folder", child.resource.toString());
        try {
          await this.fileService.del(child.resource, { recursive: true });
          this.logService.trace("Deleted the temporarily deleted folder", child.resource.toString());
        } catch (error) {
          if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
            this.logService.error(error);
          }
        }
      }));
    } catch (error) {
    }
  }
};
ExtensionsScanner = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IExtensionsScannerService),
  __decorateParam(3, IExtensionsProfileScannerService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, ILogService)
], ExtensionsScanner);
let InstallExtensionInProfileTask = class extends AbstractExtensionTask {
  constructor(extensionKey, manifest, source, options, extractExtensionFn, extensionsScanner, uriIdentityService, galleryService, userDataProfilesService, extensionsScannerService, extensionsProfileScannerService, logService) {
    super();
    this.extensionKey = extensionKey;
    this.manifest = manifest;
    this.source = source;
    this.options = options;
    this.extractExtensionFn = extractExtensionFn;
    this.extensionsScanner = extensionsScanner;
    this.uriIdentityService = uriIdentityService;
    this.galleryService = galleryService;
    this.userDataProfilesService = userDataProfilesService;
    this.extensionsScannerService = extensionsScannerService;
    this.extensionsProfileScannerService = extensionsProfileScannerService;
    this.logService = logService;
    this._operation = InstallOperation.Install;
    this.identifier = this.extensionKey.identifier;
  }
  get operation() {
    return this.options.operation ?? this._operation;
  }
  get verificationStatus() {
    return this._verificationStatus;
  }
  async doRun(token) {
    const installed = await this.extensionsScanner.scanExtensions(ExtensionType.User, this.options.profileLocation, this.options.productVersion);
    const existingExtension = installed.find((i) => areSameExtensions(i.identifier, this.identifier));
    if (existingExtension) {
      this._operation = InstallOperation.Update;
    }
    const metadata = {
      isApplicationScoped: this.options.isApplicationScoped || existingExtension?.isApplicationScoped,
      isMachineScoped: this.options.isMachineScoped || existingExtension?.isMachineScoped,
      isBuiltin: this.options.isBuiltin || existingExtension?.isBuiltin,
      isSystem: existingExtension?.type === ExtensionType.System ? true : void 0,
      installedTimestamp: Date.now(),
      pinned: this.options.installGivenVersion ? true : this.options.pinned ?? existingExtension?.pinned,
      source: this.source instanceof URI ? "vsix" : "gallery"
    };
    let local;
    if (this.source instanceof URI) {
      if (existingExtension) {
        if (this.extensionKey.equals(new ExtensionKey(existingExtension.identifier, existingExtension.manifest.version))) {
          try {
            await this.extensionsScanner.deleteExtension(existingExtension, "existing");
          } catch (e) {
            throw new Error(nls.localize("restartCode", "Please restart VS Code before reinstalling {0}.", this.manifest.displayName || this.manifest.name));
          }
        }
      }
      const existingWithSameVersion = await this.unsetIfRemoved(this.extensionKey);
      if (existingWithSameVersion) {
        try {
          await this.extensionsScanner.deleteExtension(existingWithSameVersion, "existing");
        } catch (e) {
          throw new Error(nls.localize("restartCode", "Please restart VS Code before reinstalling {0}.", this.manifest.displayName || this.manifest.name));
        }
      }
    } else {
      metadata.id = this.source.identifier.uuid;
      metadata.publisherId = this.source.publisherId;
      metadata.publisherDisplayName = this.source.publisherDisplayName;
      metadata.targetPlatform = this.source.properties.targetPlatform;
      metadata.updated = !!existingExtension;
      metadata.private = this.source.private;
      metadata.isPreReleaseVersion = this.source.properties.isPreReleaseVersion;
      metadata.hasPreReleaseVersion = existingExtension?.hasPreReleaseVersion || this.source.properties.isPreReleaseVersion;
      metadata.preRelease = isBoolean(this.options.preRelease) ? this.options.preRelease : this.options.installPreReleaseVersion || this.source.properties.isPreReleaseVersion || existingExtension?.preRelease;
      if (existingExtension && existingExtension.type !== ExtensionType.System && existingExtension.manifest.version === this.source.version) {
        return this.extensionsScanner.updateMetadata(existingExtension, metadata, this.options.profileLocation);
      }
      local = await this.unsetIfRemoved(this.extensionKey);
    }
    if (token.isCancellationRequested) {
      throw toExtensionManagementError(new CancellationError());
    }
    if (!local) {
      const result2 = await this.extractExtensionFn(this.operation, token);
      local = result2.local;
      this._verificationStatus = result2.verificationStatus;
    }
    if (this.uriIdentityService.extUri.isEqual(this.userDataProfilesService.defaultProfile.extensionsResource, this.options.profileLocation)) {
      try {
        await this.extensionsScannerService.initializeDefaultProfileExtensions();
      } catch (error) {
        throw toExtensionManagementError(error, ExtensionManagementErrorCode.IntializeDefaultProfile);
      }
    }
    if (token.isCancellationRequested) {
      throw toExtensionManagementError(new CancellationError());
    }
    try {
      await this.extensionsProfileScannerService.addExtensionsToProfile([[local, metadata]], this.options.profileLocation, !local.isValid);
    } catch (error) {
      throw toExtensionManagementError(error, ExtensionManagementErrorCode.AddToProfile);
    }
    const result = await this.extensionsScanner.scanLocalExtension(local.location, ExtensionType.User, this.options.profileLocation);
    if (!result) {
      throw new ExtensionManagementError("Cannot find the installed extension", ExtensionManagementErrorCode.InstalledExtensionNotFound);
    }
    if (this.source instanceof URI) {
      this.updateMetadata(local, token);
    }
    return result;
  }
  async unsetIfRemoved(extensionKey) {
    const [removed] = await this.extensionsScanner.unsetExtensionsForRemoval(extensionKey);
    if (removed) {
      this.logService.info("Removed the extension from removed list:", extensionKey.id);
      const userExtensions = await this.extensionsScanner.scanAllUserExtensions();
      return userExtensions.find((i) => ExtensionKey.create(i).equals(extensionKey));
    }
    return void 0;
  }
  async updateMetadata(extension, token) {
    try {
      let [galleryExtension] = await this.galleryService.getExtensions([{ id: extension.identifier.id, version: extension.manifest.version }], token);
      if (!galleryExtension) {
        [galleryExtension] = await this.galleryService.getExtensions([{ id: extension.identifier.id }], token);
      }
      if (galleryExtension) {
        const metadata = {
          id: galleryExtension.identifier.uuid,
          publisherDisplayName: galleryExtension.publisherDisplayName,
          publisherId: galleryExtension.publisherId,
          isPreReleaseVersion: galleryExtension.properties.isPreReleaseVersion,
          hasPreReleaseVersion: extension.hasPreReleaseVersion || galleryExtension.properties.isPreReleaseVersion,
          preRelease: galleryExtension.properties.isPreReleaseVersion || this.options.installPreReleaseVersion
        };
        await this.extensionsScanner.updateMetadata(extension, metadata, this.options.profileLocation);
      }
    } catch (error) {
    }
  }
};
InstallExtensionInProfileTask = __decorateClass([
  __decorateParam(6, IUriIdentityService),
  __decorateParam(7, IExtensionGalleryService),
  __decorateParam(8, IUserDataProfilesService),
  __decorateParam(9, IExtensionsScannerService),
  __decorateParam(10, IExtensionsProfileScannerService),
  __decorateParam(11, ILogService)
], InstallExtensionInProfileTask);
class UninstallExtensionInProfileTask extends AbstractExtensionTask {
  constructor(extension, options, extensionsProfileScannerService) {
    super();
    this.extension = extension;
    this.options = options;
    this.extensionsProfileScannerService = extensionsProfileScannerService;
  }
  doRun(token) {
    return this.extensionsProfileScannerService.removeExtensionsFromProfile([this.extension.identifier], this.options.profileLocation);
  }
}
export {
  ExtensionManagementService,
  ExtensionsScanner,
  INativeServerExtensionManagementService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L25vZGUvZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBQcm9taXNlcywgUXVldWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBnZXRFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2VtdmVyL3NlbXZlci5qcyc7XG5pbXBvcnQgeyBpc0Jvb2xlYW4sIGlzRGVmaW5lZCwgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgKiBhcyBwZnMgZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBleHRyYWN0LCBJRmlsZSwgemlwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3ppcC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElEb3dubG9hZFNlcnZpY2UgfSBmcm9tICcuLi8uLi9kb3dubG9hZC9jb21tb24vZG93bmxvYWQuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBBYnN0cmFjdEV4dGVuc2lvblRhc2ssIElJbnN0YWxsRXh0ZW5zaW9uVGFzaywgSW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLCBJVW5pbnN0YWxsRXh0ZW5zaW9uVGFzaywgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IsIFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2Fic3RyYWN0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHtcblx0RXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIElHYWxsZXJ5RXh0ZW5zaW9uLCBJTG9jYWxFeHRlbnNpb24sIEluc3RhbGxPcGVyYXRpb24sXG5cdE1ldGFkYXRhLCBJbnN0YWxsT3B0aW9ucyxcblx0SVByb2R1Y3RWZXJzaW9uLFxuXHRFWFRFTlNJT05fSU5TVEFMTF9DTElFTlRfVEFSR0VUX1BMQVRGT1JNX0NPTlRFWFQsXG5cdEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUsXG5cdGNvbXB1dGVTaXplLFxuXHRJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLFxufSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucywgY29tcHV0ZVRhcmdldFBsYXRmb3JtLCBFeHRlbnNpb25LZXksIGdldEdhbGxlcnlFeHRlbnNpb25JZCwgZ3JvdXBCeUV4dGVuc2lvbiB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSwgSVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNTY2FubmVyU2VydmljZSwgSVNjYW5uZWRFeHRlbnNpb24sIE1hbmlmZXN0TWV0YWRhdGEsIFVzZXJFeHRlbnNpb25zU2Nhbk9wdGlvbnMgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNEb3dubG9hZGVyIH0gZnJvbSAnLi9leHRlbnNpb25Eb3dubG9hZGVyLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNMaWZlY3ljbGUgfSBmcm9tICcuL2V4dGVuc2lvbkxpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBmcm9tRXh0cmFjdEVycm9yLCBnZXRNYW5pZmVzdCB9IGZyb20gJy4vZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc01hbmlmZXN0Q2FjaGUgfSBmcm9tICcuL2V4dGVuc2lvbnNNYW5pZmVzdENhY2hlLmpzJztcbmltcG9ydCB7IERpZENoYW5nZVByb2ZpbGVFeHRlbnNpb25zRXZlbnQsIEV4dGVuc2lvbnNXYXRjaGVyIH0gZnJvbSAnLi9leHRlbnNpb25zV2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uLCBJRXh0ZW5zaW9uTWFuaWZlc3QsIFRhcmdldFBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBpc0VuZ2luZVZhbGlkIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uVmFsaWRhdG9yLmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VzRXZlbnQsIEZpbGVDaGFuZ2VUeXBlLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBJRmlsZVNlcnZpY2UsIElGaWxlU3RhdCwgdG9GaWxlT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgcmVmaW5lU2VydmljZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LmpzJztcblxuZXhwb3J0IGNvbnN0IElOYXRpdmVTZXJ2ZXJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSA9IHJlZmluZVNlcnZpY2VEZWNvcmF0b3I8SUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJTmF0aXZlU2VydmVyRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U+KElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSk7XG5leHBvcnQgaW50ZXJmYWNlIElOYXRpdmVTZXJ2ZXJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBleHRlbmRzIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0c2NhbkFsbFVzZXJJbnN0YWxsZWRFeHRlbnNpb25zKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+O1xuXHRzY2FuSW5zdGFsbGVkRXh0ZW5zaW9uQXRMb2NhdGlvbihsb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24gfCBudWxsPjtcblx0ZGVsZXRlRXh0ZW5zaW9ucyguLi5leHRlbnNpb25zOiBJRXh0ZW5zaW9uW10pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG50eXBlIEV4dHJhY3RFeHRlbnNpb25SZXN1bHQgPSB7IHJlYWRvbmx5IGxvY2FsOiBJTG9jYWxFeHRlbnNpb247IHJlYWRvbmx5IHZlcmlmaWNhdGlvblN0YXR1cz86IEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUgfTtcblxuY29uc3QgREVMRVRFRF9GT0xERVJfUE9TVEZJWCA9ICcudnNjdG1wJztcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBpbXBsZW1lbnRzIElOYXRpdmVTZXJ2ZXJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zU2Nhbm5lcjogRXh0ZW5zaW9uc1NjYW5uZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgbWFuaWZlc3RDYWNoZTogRXh0ZW5zaW9uc01hbmlmZXN0Q2FjaGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc0Rvd25sb2FkZXI6IEV4dGVuc2lvbnNEb3dubG9hZGVyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0cmFjdGluZ0dhbGxlcnlFeHRlbnNpb25zID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8RXh0cmFjdEV4dGVuc2lvblJlc3VsdD4+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBnYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zU2Nhbm5lclNlcnZpY2U6IElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZTogSUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UsXG5cdFx0QElEb3dubG9hZFNlcnZpY2UgcHJpdmF0ZSBkb3dubG9hZFNlcnZpY2U6IElEb3dubG9hZFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlOiBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZ2FsbGVyeVNlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGFsbG93ZWRFeHRlbnNpb25zU2VydmljZSwgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkxpZmVjeWNsZSA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNMaWZlY3ljbGUpKTtcblx0XHR0aGlzLmV4dGVuc2lvbnNTY2FubmVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1NjYW5uZXIsIGV4dGVuc2lvbiA9PiBleHRlbnNpb25MaWZlY3ljbGUucG9zdFVuaW5zdGFsbChleHRlbnNpb24pKSk7XG5cdFx0dGhpcy5tYW5pZmVzdENhY2hlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEV4dGVuc2lvbnNNYW5pZmVzdENhY2hlKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCBmaWxlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCB0aGlzLCB0aGlzLmxvZ1NlcnZpY2UpKTtcblx0XHR0aGlzLmV4dGVuc2lvbnNEb3dubG9hZGVyID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc0Rvd25sb2FkZXIpKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNXYXRjaGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEV4dGVuc2lvbnNXYXRjaGVyKHRoaXMsIHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSwgZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGV4dGVuc2lvbnNXYXRjaGVyLm9uRGlkQ2hhbmdlRXh0ZW5zaW9uc0J5QW5vdGhlclNvdXJjZShlID0+IHRoaXMub25EaWRDaGFuZ2VFeHRlbnNpb25zRnJvbUFub3RoZXJTb3VyY2UoZSkpKTtcblx0XHR0aGlzLndhdGNoRm9yRXh0ZW5zaW9uc05vdEluc3RhbGxlZEJ5U3lzdGVtKCk7XG5cdH1cblxuXHRwcml2YXRlIF90YXJnZXRQbGF0Zm9ybVByb21pc2U6IFByb21pc2U8VGFyZ2V0UGxhdGZvcm0+IHwgdW5kZWZpbmVkO1xuXHRnZXRUYXJnZXRQbGF0Zm9ybSgpOiBQcm9taXNlPFRhcmdldFBsYXRmb3JtPiB7XG5cdFx0aWYgKCF0aGlzLl90YXJnZXRQbGF0Zm9ybVByb21pc2UpIHtcblx0XHRcdHRoaXMuX3RhcmdldFBsYXRmb3JtUHJvbWlzZSA9IGNvbXB1dGVUYXJnZXRQbGF0Zm9ybSh0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdGFyZ2V0UGxhdGZvcm1Qcm9taXNlO1xuXHR9XG5cblx0YXN5bmMgemlwKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uKTogUHJvbWlzZTxVUkk+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlI3ppcCcsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRjb25zdCBmaWxlcyA9IGF3YWl0IHRoaXMuY29sbGVjdEZpbGVzKGV4dGVuc2lvbik7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSBhd2FpdCB6aXAoam9pblBhdGgodGhpcy5leHRlbnNpb25zRG93bmxvYWRlci5leHRlbnNpb25zRG93bmxvYWREaXIsIGdlbmVyYXRlVXVpZCgpKS5mc1BhdGgsIGZpbGVzKTtcblx0XHRyZXR1cm4gVVJJLmZpbGUobG9jYXRpb24pO1xuXHR9XG5cblx0YXN5bmMgZ2V0TWFuaWZlc3QodnNpeDogVVJJKTogUHJvbWlzZTxJRXh0ZW5zaW9uTWFuaWZlc3Q+IHtcblx0XHRjb25zdCB7IGxvY2F0aW9uLCBjbGVhbnVwIH0gPSBhd2FpdCB0aGlzLmRvd25sb2FkVnNpeCh2c2l4KTtcblx0XHRjb25zdCB6aXBQYXRoID0gcGF0aC5yZXNvbHZlKGxvY2F0aW9uLmZzUGF0aCk7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCBnZXRNYW5pZmVzdCh6aXBQYXRoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YXdhaXQgY2xlYW51cCgpO1xuXHRcdH1cblx0fVxuXG5cdGdldEluc3RhbGxlZCh0eXBlPzogRXh0ZW5zaW9uVHlwZSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkgPSB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSwgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbiA9IHsgdmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBkYXRlOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zU2Nhbm5lci5zY2FuRXh0ZW5zaW9ucyh0eXBlID8/IG51bGwsIHByb2ZpbGVMb2NhdGlvbiwgcHJvZHVjdFZlcnNpb24pO1xuXHR9XG5cblx0c2NhbkFsbFVzZXJJbnN0YWxsZWRFeHRlbnNpb25zKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zU2Nhbm5lci5zY2FuQWxsVXNlckV4dGVuc2lvbnMoKTtcblx0fVxuXG5cdHNjYW5JbnN0YWxsZWRFeHRlbnNpb25BdExvY2F0aW9uKGxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbiB8IG51bGw+IHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zU2Nhbm5lci5zY2FuVXNlckV4dGVuc2lvbkF0TG9jYXRpb24obG9jYXRpb24pO1xuXHR9XG5cblx0YXN5bmMgaW5zdGFsbCh2c2l4OiBVUkksIG9wdGlvbnM6IEluc3RhbGxPcHRpb25zID0ge30pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UjaW5zdGFsbCcsIHZzaXgudG9TdHJpbmcoKSk7XG5cblx0XHRjb25zdCB7IGxvY2F0aW9uLCBjbGVhbnVwIH0gPSBhd2FpdCB0aGlzLmRvd25sb2FkVnNpeCh2c2l4KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGdldE1hbmlmZXN0KHBhdGgucmVzb2x2ZShsb2NhdGlvbi5mc1BhdGgpKTtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZ2V0R2FsbGVyeUV4dGVuc2lvbklkKG1hbmlmZXN0LnB1Ymxpc2hlciwgbWFuaWZlc3QubmFtZSk7XG5cdFx0XHRpZiAobWFuaWZlc3QuZW5naW5lcyAmJiBtYW5pZmVzdC5lbmdpbmVzLnZzY29kZSAmJiAhaXNFbmdpbmVWYWxpZChtYW5pZmVzdC5lbmdpbmVzLnZzY29kZSwgdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2luY29tcGF0aWJsZScsIFwiVW5hYmxlIHRvIGluc3RhbGwgZXh0ZW5zaW9uICd7MH0nIGFzIGl0IGlzIG5vdCBjb21wYXRpYmxlIHdpdGggVlMgQ29kZSAnezF9Jy5cIiwgZXh0ZW5zaW9uSWQsIHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbikpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhbGxvd2VkVG9JbnN0YWxsID0gdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHsgaWQ6IGV4dGVuc2lvbklkLCB2ZXJzaW9uOiBtYW5pZmVzdC52ZXJzaW9uLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogdW5kZWZpbmVkIH0pO1xuXHRcdFx0aWYgKGFsbG93ZWRUb0luc3RhbGwgIT09IHRydWUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnbm90QWxsb3dlZCcsIFwiVGhpcyBleHRlbnNpb24gY2Fubm90IGJlIGluc3RhbGxlZCBiZWNhdXNlIHswfVwiLCBhbGxvd2VkVG9JbnN0YWxsLnZhbHVlKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmluc3RhbGxFeHRlbnNpb25zKFt7IG1hbmlmZXN0LCBleHRlbnNpb246IGxvY2F0aW9uLCBvcHRpb25zIH1dKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlc3VsdHMuZmluZCgoeyBpZGVudGlmaWVyIH0pID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIHsgaWQ6IGV4dGVuc2lvbklkIH0pKTtcblx0XHRcdGlmIChyZXN1bHQ/LmxvY2FsKSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQubG9jYWw7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzdWx0Py5lcnJvcikge1xuXHRcdFx0XHR0aHJvdyByZXN1bHQuZXJyb3I7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihuZXcgRXJyb3IoYFVua25vd24gZXJyb3Igd2hpbGUgaW5zdGFsbGluZyBleHRlbnNpb24gJHtleHRlbnNpb25JZH1gKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGF3YWl0IGNsZWFudXAoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsRnJvbUxvY2F0aW9uKGxvY2F0aW9uOiBVUkksIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlI2luc3RhbGxGcm9tTG9jYXRpb24nLCBsb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRjb25zdCBsb2NhbCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuc2NhblVzZXJFeHRlbnNpb25BdExvY2F0aW9uKGxvY2F0aW9uKTtcblx0XHRpZiAoIWxvY2FsIHx8ICFsb2NhbC5tYW5pZmVzdC5uYW1lIHx8ICFsb2NhbC5tYW5pZmVzdC52ZXJzaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBmaW5kIGEgdmFsaWQgZXh0ZW5zaW9uIGZyb20gdGhlIGxvY2F0aW9uICR7bG9jYXRpb24udG9TdHJpbmcoKX1gKTtcblx0XHR9XG5cdFx0YXdhaXQgdGhpcy5hZGRFeHRlbnNpb25zVG9Qcm9maWxlKFtbbG9jYWwsIHsgc291cmNlOiAncmVzb3VyY2UnIH1dXSwgcHJvZmlsZUxvY2F0aW9uKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnU3VjY2Vzc2Z1bGx5IGluc3RhbGxlZCBleHRlbnNpb24nLCBsb2NhbC5pZGVudGlmaWVyLmlkLCBwcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0cmV0dXJuIGxvY2FsO1xuXHR9XG5cblx0YXN5bmMgaW5zdGFsbEV4dGVuc2lvbnNGcm9tUHJvZmlsZShleHRlbnNpb25zOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbltdPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSNpbnN0YWxsRXh0ZW5zaW9uc0Zyb21Qcm9maWxlJywgZXh0ZW5zaW9ucywgZnJvbVByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpLCB0b1Byb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRjb25zdCBleHRlbnNpb25zVG9JbnN0YWxsID0gKGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGVkKEV4dGVuc2lvblR5cGUuVXNlciwgZnJvbVByb2ZpbGVMb2NhdGlvbikpLmZpbHRlcihlID0+IGV4dGVuc2lvbnMuc29tZShpZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpZCwgZS5pZGVudGlmaWVyKSkpO1xuXHRcdGlmIChleHRlbnNpb25zVG9JbnN0YWxsLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbWV0YWRhdGEgPSBhd2FpdCBQcm9taXNlLmFsbChleHRlbnNpb25zVG9JbnN0YWxsLm1hcChlID0+IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuc2Nhbk1ldGFkYXRhKGUsIGZyb21Qcm9maWxlTG9jYXRpb24pKSk7XG5cdFx0XHRhd2FpdCB0aGlzLmFkZEV4dGVuc2lvbnNUb1Byb2ZpbGUoZXh0ZW5zaW9uc1RvSW5zdGFsbC5tYXAoKGUsIGluZGV4KSA9PiBbZSwgbWV0YWRhdGFbaW5kZXhdXSksIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTdWNjZXNzZnVsbHkgaW5zdGFsbGVkIGV4dGVuc2lvbnMnLCBleHRlbnNpb25zVG9JbnN0YWxsLm1hcChlID0+IGUuaWRlbnRpZmllci5pZCksIHRvUHJvZmlsZUxvY2F0aW9uLnRvU3RyaW5nKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0ZW5zaW9uc1RvSW5zdGFsbDtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZU1ldGFkYXRhKGxvY2FsOiBJTG9jYWxFeHRlbnNpb24sIG1ldGFkYXRhOiBQYXJ0aWFsPE1ldGFkYXRhPiwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UjdXBkYXRlTWV0YWRhdGEnLCBsb2NhbC5pZGVudGlmaWVyLmlkKTtcblx0XHRpZiAobWV0YWRhdGEuaXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0bWV0YWRhdGEucHJlUmVsZWFzZSA9IHRydWU7XG5cdFx0XHRtZXRhZGF0YS5oYXNQcmVSZWxlYXNlVmVyc2lvbiA9IHRydWU7XG5cdFx0fVxuXHRcdC8vIHVuc2V0IGlmIGZhbHNlXG5cdFx0aWYgKG1ldGFkYXRhLmlzTWFjaGluZVNjb3BlZCA9PT0gZmFsc2UpIHtcblx0XHRcdG1ldGFkYXRhLmlzTWFjaGluZVNjb3BlZCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKG1ldGFkYXRhLmlzQnVpbHRpbiA9PT0gZmFsc2UpIHtcblx0XHRcdG1ldGFkYXRhLmlzQnVpbHRpbiA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKG1ldGFkYXRhLnBpbm5lZCA9PT0gZmFsc2UpIHtcblx0XHRcdG1ldGFkYXRhLnBpbm5lZCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bG9jYWwgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLnVwZGF0ZU1ldGFkYXRhKGxvY2FsLCBtZXRhZGF0YSwgcHJvZmlsZUxvY2F0aW9uKTtcblx0XHR0aGlzLm1hbmlmZXN0Q2FjaGUuaW52YWxpZGF0ZShwcm9maWxlTG9jYXRpb24pO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEuZmlyZSh7IGxvY2FsLCBwcm9maWxlTG9jYXRpb24gfSk7XG5cdFx0cmV0dXJuIGxvY2FsO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlbW92ZUV4dGVuc2lvbihleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLmRlbGV0ZUV4dGVuc2lvbihleHRlbnNpb24sICdyZW1vdmUnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjb3B5RXh0ZW5zaW9uKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkksIG1ldGFkYXRhOiBQYXJ0aWFsPE1ldGFkYXRhPik6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuY29weUV4dGVuc2lvbihleHRlbnNpb24sIGZyb21Qcm9maWxlTG9jYXRpb24sIHRvUHJvZmlsZUxvY2F0aW9uLCBtZXRhZGF0YSk7XG5cdH1cblxuXHRjb3B5RXh0ZW5zaW9ucyhmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zU2Nhbm5lci5jb3B5RXh0ZW5zaW9ucyhmcm9tUHJvZmlsZUxvY2F0aW9uLCB0b1Byb2ZpbGVMb2NhdGlvbiwgeyB2ZXJzaW9uOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLnZlcnNpb24sIGRhdGU6IHRoaXMucHJvZHVjdFNlcnZpY2UuZGF0ZSB9KTtcblx0fVxuXG5cdGRlbGV0ZUV4dGVuc2lvbnMoLi4uZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuc2V0RXh0ZW5zaW9uc0ZvclJlbW92YWwoLi4uZXh0ZW5zaW9ucyk7XG5cdH1cblxuXHRhc3luYyBjbGVhblVwKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UjY2xlYW5VcCcpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLmNsZWFuVXAoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBkb3dubG9hZChleHRlbnNpb246IElHYWxsZXJ5RXh0ZW5zaW9uLCBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24sIGRvbm90VmVyaWZ5U2lnbmF0dXJlOiBib29sZWFuKTogUHJvbWlzZTxVUkk+IHtcblx0XHRjb25zdCB7IGxvY2F0aW9uIH0gPSBhd2FpdCB0aGlzLmRvd25sb2FkRXh0ZW5zaW9uKGV4dGVuc2lvbiwgb3BlcmF0aW9uLCAhZG9ub3RWZXJpZnlTaWduYXR1cmUpO1xuXHRcdHJldHVybiBsb2NhdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG93bmxvYWRWc2l4KHZzaXg6IFVSSSk6IFByb21pc2U8eyBsb2NhdGlvbjogVVJJOyBjbGVhbnVwOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0+IHtcblx0XHRpZiAodnNpeC5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0cmV0dXJuIHsgbG9jYXRpb246IHZzaXgsIGFzeW5jIGNsZWFudXAoKSB7IH0gfTtcblx0XHR9XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdEb3dubG9hZGluZyBleHRlbnNpb24gZnJvbScsIHZzaXgudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSBqb2luUGF0aCh0aGlzLmV4dGVuc2lvbnNEb3dubG9hZGVyLmV4dGVuc2lvbnNEb3dubG9hZERpciwgZ2VuZXJhdGVVdWlkKCkpO1xuXHRcdGF3YWl0IHRoaXMuZG93bmxvYWRTZXJ2aWNlLmRvd25sb2FkKHZzaXgsIGxvY2F0aW9uKTtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnRG93bmxvYWRlZCBleHRlbnNpb24gdG8nLCBsb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRjb25zdCBjbGVhbnVwID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwobG9jYXRpb24pO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiB7IGxvY2F0aW9uLCBjbGVhbnVwIH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Q3VycmVudEV4dGVuc2lvbnNNYW5pZmVzdExvY2F0aW9uKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbjogVVJJIHwgSUdhbGxlcnlFeHRlbnNpb24sIG9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyk6IElJbnN0YWxsRXh0ZW5zaW9uVGFzayB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uS2V5ID0gZXh0ZW5zaW9uIGluc3RhbmNlb2YgVVJJID8gbmV3IEV4dGVuc2lvbktleSh7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSB9LCBtYW5pZmVzdC52ZXJzaW9uKSA6IEV4dGVuc2lvbktleS5jcmVhdGUoZXh0ZW5zaW9uKTtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsRXh0ZW5zaW9uSW5Qcm9maWxlVGFzaywgZXh0ZW5zaW9uS2V5LCBtYW5pZmVzdCwgZXh0ZW5zaW9uLCBvcHRpb25zLCAob3BlcmF0aW9uLCB0b2tlbikgPT4ge1xuXHRcdFx0aWYgKGV4dGVuc2lvbiBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5leHRyYWN0VlNJWChleHRlbnNpb25LZXksIGV4dGVuc2lvbiwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdFx0bGV0IHByb21pc2UgPSB0aGlzLmV4dHJhY3RpbmdHYWxsZXJ5RXh0ZW5zaW9ucy5nZXQoZXh0ZW5zaW9uS2V5LnRvU3RyaW5nKCkpO1xuXHRcdFx0aWYgKCFwcm9taXNlKSB7XG5cdFx0XHRcdHRoaXMuZXh0cmFjdGluZ0dhbGxlcnlFeHRlbnNpb25zLnNldChleHRlbnNpb25LZXkudG9TdHJpbmcoKSwgcHJvbWlzZSA9IHRoaXMuZG93bmxvYWRBbmRFeHRyYWN0R2FsbGVyeUV4dGVuc2lvbihleHRlbnNpb25LZXksIGV4dGVuc2lvbiwgb3BlcmF0aW9uLCBvcHRpb25zLCB0b2tlbikpO1xuXHRcdFx0XHRwcm9taXNlLmZpbmFsbHkoKCkgPT4gdGhpcy5leHRyYWN0aW5nR2FsbGVyeUV4dGVuc2lvbnMuZGVsZXRlKGV4dGVuc2lvbktleS50b1N0cmluZygpKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9LCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBvcHRpb25zOiBVbmluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyk6IElVbmluc3RhbGxFeHRlbnNpb25UYXNrIHtcblx0XHRyZXR1cm4gbmV3IFVuaW5zdGFsbEV4dGVuc2lvbkluUHJvZmlsZVRhc2soZXh0ZW5zaW9uLCBvcHRpb25zLCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb3dubG9hZEFuZEV4dHJhY3RHYWxsZXJ5RXh0ZW5zaW9uKGV4dGVuc2lvbktleTogRXh0ZW5zaW9uS2V5LCBnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbiwgb3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLCBvcHRpb25zOiBJbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8RXh0cmFjdEV4dGVuc2lvblJlc3VsdD4ge1xuXHRcdGNvbnN0IHsgdmVyaWZpY2F0aW9uU3RhdHVzLCBsb2NhdGlvbiB9ID0gYXdhaXQgdGhpcy5kb3dubG9hZEV4dGVuc2lvbihnYWxsZXJ5LCBvcGVyYXRpb24sICFvcHRpb25zLmRvbm90VmVyaWZ5U2lnbmF0dXJlLCBvcHRpb25zLmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9DTElFTlRfVEFSR0VUX1BMQVRGT1JNX0NPTlRFWFRdKTtcblx0XHR0cnkge1xuXG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHZhbGlkYXRlIG1hbmlmZXN0XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGdldE1hbmlmZXN0KGxvY2F0aW9uLmZzUGF0aCk7XG5cdFx0XHRpZiAoIW5ldyBFeHRlbnNpb25LZXkoZ2FsbGVyeS5pZGVudGlmaWVyLCBnYWxsZXJ5LnZlcnNpb24pLmVxdWFscyhuZXcgRXh0ZW5zaW9uS2V5KHsgaWQ6IGdldEdhbGxlcnlFeHRlbnNpb25JZChtYW5pZmVzdC5wdWJsaXNoZXIsIG1hbmlmZXN0Lm5hbWUpIH0sIG1hbmlmZXN0LnZlcnNpb24pKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZE1hbmlmZXN0JywgXCJDYW5ub3QgaW5zdGFsbCAnezB9JyBleHRlbnNpb24gYmVjYXVzZSBvZiBtYW5pZmVzdCBtaXNtYXRjaCB3aXRoIE1hcmtldHBsYWNlXCIsIGdhbGxlcnkuaWRlbnRpZmllci5pZCksIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuSW52YWxpZCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxvY2FsID0gYXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lci5leHRyYWN0VXNlckV4dGVuc2lvbihcblx0XHRcdFx0ZXh0ZW5zaW9uS2V5LFxuXHRcdFx0XHRsb2NhdGlvbi5mc1BhdGgsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHR0b2tlbik7XG5cblx0XHRcdGlmICh2ZXJpZmljYXRpb25TdGF0dXMgIT09IEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUuU3VjY2VzcyAmJiB0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0J1aWx0KSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zRG93bmxvYWRlci5kZWxldGUobG9jYXRpb24pO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0LyogSWdub3JlICovXG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEVycm9yIHdoaWxlIGRlbGV0aW5nIHRoZSBkb3dubG9hZGVkIGZpbGVgLCBsb2NhdGlvbi50b1N0cmluZygpLCBnZXRFcnJvck1lc3NhZ2UoZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7IGxvY2FsLCB2ZXJpZmljYXRpb25TdGF0dXMgfTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zRG93bmxvYWRlci5kZWxldGUobG9jYXRpb24pO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvKiBJZ25vcmUgKi9cblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEVycm9yIHdoaWxlIGRlbGV0aW5nIHRoZSBkb3dubG9hZGVkIGZpbGVgLCBsb2NhdGlvbi50b1N0cmluZygpLCBnZXRFcnJvck1lc3NhZ2UoZSkpO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG93bmxvYWRFeHRlbnNpb24oZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgb3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLCB2ZXJpZnlTaWduYXR1cmU6IGJvb2xlYW4sIGNsaWVudFRhcmdldFBsYXRmb3JtPzogVGFyZ2V0UGxhdGZvcm0pOiBQcm9taXNlPHsgcmVhZG9ubHkgbG9jYXRpb246IFVSSTsgcmVhZG9ubHkgdmVyaWZpY2F0aW9uU3RhdHVzOiBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlIHwgdW5kZWZpbmVkIH0+IHtcblx0XHRpZiAodmVyaWZ5U2lnbmF0dXJlKSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2V4dGVuc2lvbnMudmVyaWZ5U2lnbmF0dXJlJyk7XG5cdFx0XHR2ZXJpZnlTaWduYXR1cmUgPSBpc0Jvb2xlYW4odmFsdWUpID8gdmFsdWUgOiB0cnVlO1xuXHRcdH1cblx0XHRjb25zdCB7IGxvY2F0aW9uLCB2ZXJpZmljYXRpb25TdGF0dXMgfSA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc0Rvd25sb2FkZXIuZG93bmxvYWQoZXh0ZW5zaW9uLCBvcGVyYXRpb24sIHZlcmlmeVNpZ25hdHVyZSwgY2xpZW50VGFyZ2V0UGxhdGZvcm0pO1xuXHRcdGNvbnN0IHNob3VsZFJlcXVpcmVTaWduYXR1cmUgPSAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpKT8uY2FwYWJpbGl0aWVzLnNpZ25pbmc/LmFsbFJlcG9zaXRvcnlTaWduZWQ7XG5cblx0XHRpZiAoXG5cdFx0XHR2ZXJpZmljYXRpb25TdGF0dXMgIT09IEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUuU3VjY2Vzc1xuXHRcdFx0JiYgISh2ZXJpZmljYXRpb25TdGF0dXMgPT09IEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUuTm90U2lnbmVkICYmICFzaG91bGRSZXF1aXJlU2lnbmF0dXJlKVxuXHRcdFx0JiYgdmVyaWZ5U2lnbmF0dXJlXG5cdFx0XHQmJiB0aGlzLmVudmlyb25tZW50U2VydmljZS5pc0J1aWx0XG5cdFx0XHQmJiAhKGlzTGludXggJiYgdGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnc3RhYmxlJylcblx0XHQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc0Rvd25sb2FkZXIuZGVsZXRlKGxvY2F0aW9uKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0LyogSWdub3JlICovXG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBFcnJvciB3aGlsZSBkZWxldGluZyB0aGUgZG93bmxvYWRlZCBmaWxlYCwgbG9jYXRpb24udG9TdHJpbmcoKSwgZ2V0RXJyb3JNZXNzYWdlKGUpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF2ZXJpZmljYXRpb25TdGF0dXMpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihubHMubG9jYWxpemUoJ3NpZ25hdHVyZSB2ZXJpZmljYXRpb24gbm90IGV4ZWN1dGVkJywgXCJTaWduYXR1cmUgdmVyaWZpY2F0aW9uIHdhcyBub3QgZXhlY3V0ZWQuXCIpLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlNpZ25hdHVyZVZlcmlmaWNhdGlvbkludGVybmFsKTtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoICh2ZXJpZmljYXRpb25TdGF0dXMpIHtcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLlBhY2thZ2VJbnRlZ3JpdHlDaGVja0ZhaWxlZDpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLlNpZ25hdHVyZUlzSW52YWxpZDpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLlNpZ25hdHVyZU1hbmlmZXN0SXNJbnZhbGlkOlxuXHRcdFx0XHRjYXNlIEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUuU2lnbmF0dXJlSW50ZWdyaXR5Q2hlY2tGYWlsZWQ6XG5cdFx0XHRcdGNhc2UgRXh0ZW5zaW9uU2lnbmF0dXJlVmVyaWZpY2F0aW9uQ29kZS5FbnRyeUlzTWlzc2luZzpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLkVudHJ5SXNUYW1wZXJlZDpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLlVudHJ1c3RlZDpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLkNlcnRpZmljYXRlUmV2b2tlZDpcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlLlNpZ25hdHVyZUlzTm90VmFsaWQ6XG5cdFx0XHRcdGNhc2UgRXh0ZW5zaW9uU2lnbmF0dXJlVmVyaWZpY2F0aW9uQ29kZS5TaWduYXR1cmVBcmNoaXZlSGFzVG9vTWFueUVudHJpZXM6XG5cdFx0XHRcdGNhc2UgRXh0ZW5zaW9uU2lnbmF0dXJlVmVyaWZpY2F0aW9uQ29kZS5Ob3RTaWduZWQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihubHMubG9jYWxpemUoJ3NpZ25hdHVyZSB2ZXJpZmljYXRpb24gZmFpbGVkJywgXCJTaWduYXR1cmUgdmVyaWZpY2F0aW9uIGZhaWxlZCB3aXRoICd7MH0nIGVycm9yLlwiLCB2ZXJpZmljYXRpb25TdGF0dXMpLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlNpZ25hdHVyZVZlcmlmaWNhdGlvbkZhaWxlZCk7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmxzLmxvY2FsaXplKCdzaWduYXR1cmUgdmVyaWZpY2F0aW9uIGZhaWxlZCcsIFwiU2lnbmF0dXJlIHZlcmlmaWNhdGlvbiBmYWlsZWQgd2l0aCAnezB9JyBlcnJvci5cIiwgdmVyaWZpY2F0aW9uU3RhdHVzKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5TaWduYXR1cmVWZXJpZmljYXRpb25JbnRlcm5hbCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgbG9jYXRpb24sIHZlcmlmaWNhdGlvblN0YXR1cyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleHRyYWN0VlNJWChleHRlbnNpb25LZXk6IEV4dGVuc2lvbktleSwgbG9jYXRpb246IFVSSSwgb3B0aW9uczogSW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPEV4dHJhY3RFeHRlbnNpb25SZXN1bHQ+IHtcblx0XHRjb25zdCBsb2NhbCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuZXh0cmFjdFVzZXJFeHRlbnNpb24oXG5cdFx0XHRleHRlbnNpb25LZXksXG5cdFx0XHRwYXRoLnJlc29sdmUobG9jYXRpb24uZnNQYXRoKSxcblx0XHRcdGlzQm9vbGVhbihvcHRpb25zLmtlZXBFeGlzdGluZykgPyAhb3B0aW9ucy5rZWVwRXhpc3RpbmcgOiB0cnVlLFxuXHRcdFx0dG9rZW4pO1xuXHRcdHJldHVybiB7IGxvY2FsIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbGxlY3RGaWxlcyhleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbik6IFByb21pc2U8SUZpbGVbXT4ge1xuXG5cdFx0Y29uc3QgY29sbGVjdEZpbGVzRnJvbURpcmVjdG9yeSA9IGFzeW5jIChkaXI6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+ID0+IHtcblx0XHRcdGxldCBlbnRyaWVzID0gYXdhaXQgcGZzLlByb21pc2VzLnJlYWRkaXIoZGlyKTtcblx0XHRcdGVudHJpZXMgPSBlbnRyaWVzLm1hcChlID0+IHBhdGguam9pbihkaXIsIGUpKTtcblx0XHRcdGNvbnN0IHN0YXRzID0gYXdhaXQgUHJvbWlzZS5hbGwoZW50cmllcy5tYXAoZSA9PiBmcy5wcm9taXNlcy5zdGF0KGUpKSk7XG5cdFx0XHRsZXQgcHJvbWlzZTogUHJvbWlzZTxzdHJpbmdbXT4gPSBQcm9taXNlLnJlc29sdmUoW10pO1xuXHRcdFx0c3RhdHMuZm9yRWFjaCgoc3RhdCwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBlbnRyaWVzW2luZGV4XTtcblx0XHRcdFx0aWYgKHN0YXQuaXNGaWxlKCkpIHtcblx0XHRcdFx0XHRwcm9taXNlID0gcHJvbWlzZS50aGVuKHJlc3VsdCA9PiAoWy4uLnJlc3VsdCwgZW50cnldKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRcdHByb21pc2UgPSBwcm9taXNlXG5cdFx0XHRcdFx0XHQudGhlbihyZXN1bHQgPT4gY29sbGVjdEZpbGVzRnJvbURpcmVjdG9yeShlbnRyeSlcblx0XHRcdFx0XHRcdFx0LnRoZW4oZmlsZXMgPT4gKFsuLi5yZXN1bHQsIC4uLmZpbGVzXSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gcHJvbWlzZTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZmlsZXMgPSBhd2FpdCBjb2xsZWN0RmlsZXNGcm9tRGlyZWN0b3J5KGV4dGVuc2lvbi5sb2NhdGlvbi5mc1BhdGgpO1xuXHRcdHJldHVybiBmaWxlcy5tYXAoZiA9PiAoeyBwYXRoOiBgZXh0ZW5zaW9uLyR7cGF0aC5yZWxhdGl2ZShleHRlbnNpb24ubG9jYXRpb24uZnNQYXRoLCBmKX1gLCBsb2NhbFBhdGg6IGYgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkRpZENoYW5nZUV4dGVuc2lvbnNGcm9tQW5vdGhlclNvdXJjZSh7IGFkZGVkLCByZW1vdmVkIH06IERpZENoYW5nZVByb2ZpbGVFeHRlbnNpb25zRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAocmVtb3ZlZCkge1xuXHRcdFx0Y29uc3QgcmVtb3ZlZEV4dGVuc2lvbnMgPSBhZGRlZCAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChyZW1vdmVkLnByb2ZpbGVMb2NhdGlvbiwgYWRkZWQucHJvZmlsZUxvY2F0aW9uKVxuXHRcdFx0XHQ/IHJlbW92ZWQuZXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBhZGRlZC5leHRlbnNpb25zLmV2ZXJ5KGlkZW50aWZpZXIgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIGUpKSlcblx0XHRcdFx0OiByZW1vdmVkLmV4dGVuc2lvbnM7XG5cdFx0XHRmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2YgcmVtb3ZlZEV4dGVuc2lvbnMpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ0V4dGVuc2lvbnMgcmVtb3ZlZCBmcm9tIGFub3RoZXIgc291cmNlJywgaWRlbnRpZmllci5pZCwgcmVtb3ZlZC5wcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLmZpcmUoeyBpZGVudGlmaWVyLCBwcm9maWxlTG9jYXRpb246IHJlbW92ZWQucHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoYWRkZWQpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmdldEluc3RhbGxlZChFeHRlbnNpb25UeXBlLlVzZXIsIGFkZGVkLnByb2ZpbGVMb2NhdGlvbik7XG5cdFx0XHRjb25zdCBhZGRlZEV4dGVuc2lvbnMgPSBleHRlbnNpb25zLmZpbHRlcihlID0+IGFkZGVkLmV4dGVuc2lvbnMuc29tZShpZGVudGlmaWVyID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIGUuaWRlbnRpZmllcikpKTtcblx0XHRcdHRoaXMuX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMuZmlyZShhZGRlZEV4dGVuc2lvbnMubWFwKGxvY2FsID0+IHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ0V4dGVuc2lvbnMgYWRkZWQgZnJvbSBhbm90aGVyIHNvdXJjZScsIGxvY2FsLmlkZW50aWZpZXIuaWQsIGFkZGVkLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRcdFx0cmV0dXJuIHsgaWRlbnRpZmllcjogbG9jYWwuaWRlbnRpZmllciwgbG9jYWwsIHByb2ZpbGVMb2NhdGlvbjogYWRkZWQucHJvZmlsZUxvY2F0aW9uLCBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24uTm9uZSB9O1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkga25vd25EaXJlY3RvcmllcyA9IG5ldyBSZXNvdXJjZVNldCgpO1xuXHRwcml2YXRlIGFzeW5jIHdhdGNoRm9yRXh0ZW5zaW9uc05vdEluc3RhbGxlZEJ5U3lzdGVtKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIub25FeHRyYWN0KHJlc291cmNlID0+IHRoaXMua25vd25EaXJlY3Rvcmllcy5hZGQocmVzb3VyY2UpKSk7XG5cdFx0Y29uc3Qgc3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZSh0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51c2VyRXh0ZW5zaW9uc0xvY2F0aW9uKTtcblx0XHRmb3IgKGNvbnN0IGNoaWxkU3RhdCBvZiBzdGF0LmNoaWxkcmVuID8/IFtdKSB7XG5cdFx0XHRpZiAoY2hpbGRTdGF0LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRoaXMua25vd25EaXJlY3Rvcmllcy5hZGQoY2hpbGRTdGF0LnJlc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS53YXRjaCh0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51c2VyRXh0ZW5zaW9uc0xvY2F0aW9uKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZEZpbGVzQ2hhbmdlKGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkRmlsZXNDaGFuZ2UoZTogRmlsZUNoYW5nZXNFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghZS5hZmZlY3RzKHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnVzZXJFeHRlbnNpb25zTG9jYXRpb24sIEZpbGVDaGFuZ2VUeXBlLkFEREVEKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZGVkOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgZS5yYXdBZGRlZCkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhpcyBpcyBhIGtub3duIGRpcmVjdG9yeVxuXHRcdFx0aWYgKHRoaXMua25vd25EaXJlY3Rvcmllcy5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJcyBub3QgaW1tZWRpYXRlIGNoaWxkIG9mIGV4dGVuc2lvbnMgcmVzb3VyY2Vcblx0XHRcdGlmICghdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUocmVzb3VyY2UpLCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51c2VyRXh0ZW5zaW9uc0xvY2F0aW9uKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gLm9ic29sZXRlIGZpbGUgY2hhbmdlZFxuXHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHJlc291cmNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuam9pblBhdGgodGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UudXNlckV4dGVuc2lvbnNMb2NhdGlvbiwgJy5vYnNvbGV0ZScpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWdub3JlIGNoYW5nZXMgdG8gZmlsZXMgc3RhcnRpbmcgd2l0aCBgLmBcblx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuYmFzZW5hbWUocmVzb3VyY2UpLnN0YXJ0c1dpdGgoJy4nKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWdub3JlIGNoYW5nZXMgdG8gdGhlIGRlbGV0ZWQgZm9sZGVyXG5cdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmJhc2VuYW1lKHJlc291cmNlKS5lbmRzV2l0aChERUxFVEVEX0ZPTERFUl9QT1NURklYKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhpcyBpcyBhIGRpcmVjdG9yeVxuXHRcdFx0XHRpZiAoIShhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQocmVzb3VyY2UpKS5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENoZWNrIGlmIHRoaXMgaXMgYW4gZXh0ZW5zaW9uIGFkZGVkIGJ5IGFub3RoZXIgc291cmNlXG5cdFx0XHQvLyBFeHRlbnNpb24gYWRkZWQgYnkgYW5vdGhlciBzb3VyY2Ugd2lsbCBub3QgaGF2ZSBpbnN0YWxsZWQgdGltZXN0YW1wXG5cdFx0XHRjb25zdCBleHRlbnNpb24gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLnNjYW5Vc2VyRXh0ZW5zaW9uQXRMb2NhdGlvbihyZXNvdXJjZSk7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uICYmIGV4dGVuc2lvbi5pbnN0YWxsZWRUaW1lc3RhbXAgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLmtub3duRGlyZWN0b3JpZXMuYWRkKHJlc291cmNlKTtcblx0XHRcdFx0YWRkZWQucHVzaChleHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChhZGRlZC5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMuYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShhZGRlZC5tYXAoZSA9PiBbZSwgdW5kZWZpbmVkXSksIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdBZGRlZCBleHRlbnNpb25zIHRvIGRlZmF1bHQgcHJvZmlsZSBmcm9tIGV4dGVybmFsIHNvdXJjZScsIGFkZGVkLm1hcChlID0+IGUuaWRlbnRpZmllci5pZCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShleHRlbnNpb25zOiBbSUxvY2FsRXh0ZW5zaW9uLCBNZXRhZGF0YSB8IHVuZGVmaW5lZF1bXSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBleHRlbnNpb25zLm1hcChlID0+IGVbMF0pO1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIudW5zZXRFeHRlbnNpb25zRm9yUmVtb3ZhbCguLi5sb2NhbEV4dGVuc2lvbnMubWFwKGV4dGVuc2lvbiA9PiBFeHRlbnNpb25LZXkuY3JlYXRlKGV4dGVuc2lvbikpKTtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UuYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShleHRlbnNpb25zLCBwcm9maWxlTG9jYXRpb24pO1xuXHRcdHRoaXMuX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMuZmlyZShsb2NhbEV4dGVuc2lvbnMubWFwKGxvY2FsID0+ICh7IGxvY2FsLCBpZGVudGlmaWVyOiBsb2NhbC5pZGVudGlmaWVyLCBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24uTm9uZSwgcHJvZmlsZUxvY2F0aW9uIH0pKSk7XG5cdH1cbn1cblxudHlwZSBVcGRhdGVNZXRhZGF0YUVycm9yQ2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnc2FuZHkwODEnO1xuXHRjb21tZW50OiAnVXBkYXRlIG1ldGFkYXRhIGVycm9yJztcblx0ZXh0ZW5zaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdleHRlbnNpb24gaWRlbnRpZmllcicgfTtcblx0Y29kZT86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdlcnJvciBjb2RlJyB9O1xuXHRpc1Byb2ZpbGU/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnSXMgd3JpdGluZyBpbnRvIHByb2ZpbGUnIH07XG59O1xudHlwZSBVcGRhdGVNZXRhZGF0YUVycm9yRXZlbnQgPSB7XG5cdGV4dGVuc2lvbklkOiBzdHJpbmc7XG5cdGNvZGU/OiBzdHJpbmc7XG5cdGlzUHJvZmlsZT86IGJvb2xlYW47XG59O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uc1NjYW5uZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG9ic29sZXRlZFJlc291cmNlOiBVUkk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb2Jzb2xldGVGaWxlTGltaXRlcjogUXVldWU8YW55PjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkV4dHJhY3QgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVUkk+KCkpO1xuXHRyZWFkb25seSBvbkV4dHJhY3QgPSB0aGlzLl9vbkV4dHJhY3QuZXZlbnQ7XG5cblx0cHJpdmF0ZSBzY2FuQWxsRXh0ZW5zaW9uUHJvbWlzZSA9IG5ldyBSZXNvdXJjZU1hcDxQcm9taXNlPElTY2FubmVkRXh0ZW5zaW9uW10+PigpO1xuXHRwcml2YXRlIHNjYW5Vc2VyRXh0ZW5zaW9uc1Byb21pc2UgPSBuZXcgUmVzb3VyY2VNYXA8UHJvbWlzZTxJU2Nhbm5lZEV4dGVuc2lvbltdPj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGJlZm9yZVJlbW92aW5nRXh0ZW5zaW9uOiAoZTogSUxvY2FsRXh0ZW5zaW9uKSA9PiBQcm9taXNlPHZvaWQ+LFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2U6IElFeHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMub2Jzb2xldGVkUmVzb3VyY2UgPSBqb2luUGF0aCh0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51c2VyRXh0ZW5zaW9uc0xvY2F0aW9uLCAnLm9ic29sZXRlJyk7XG5cdFx0dGhpcy5vYnNvbGV0ZUZpbGVMaW1pdGVyID0gbmV3IFF1ZXVlKCk7XG5cdH1cblxuXHRhc3luYyBjbGVhblVwKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucmVtb3ZlVGVtcG9yYXJpbHlEZWxldGVkRm9sZGVycygpO1xuXHRcdGF3YWl0IHRoaXMuZGVsZXRlRXh0ZW5zaW9uc01hcmtlZEZvclJlbW92YWwoKTtcblx0XHQvL1RPRE86IFJlbW92ZSB0aGlzIGluaXRpaWFsaXphdGlvbiBhZnRlciBjb3VwZSBvZiByZWxlYXNlc1xuXHRcdGF3YWl0IHRoaXMuaW5pdGlhbGl6ZUV4dGVuc2lvblNpemUoKTtcblx0fVxuXG5cdGFzeW5jIHNjYW5FeHRlbnNpb25zKHR5cGU6IEV4dGVuc2lvblR5cGUgfCBudWxsLCBwcm9maWxlTG9jYXRpb246IFVSSSwgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbik6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdXNlclNjYW5PcHRpb25zOiBVc2VyRXh0ZW5zaW9uc1NjYW5PcHRpb25zID0geyBpbmNsdWRlSW52YWxpZDogdHJ1ZSwgcHJvZmlsZUxvY2F0aW9uLCBwcm9kdWN0VmVyc2lvbiB9O1xuXHRcdFx0bGV0IHNjYW5uZWRFeHRlbnNpb25zOiBJU2Nhbm5lZEV4dGVuc2lvbltdID0gW107XG5cdFx0XHRpZiAodHlwZSA9PT0gbnVsbCB8fCB0eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbSkge1xuXHRcdFx0XHRsZXQgc2NhbkFsbEV4dGVuc2lvbnNQcm9taXNlID0gdGhpcy5zY2FuQWxsRXh0ZW5zaW9uUHJvbWlzZS5nZXQocHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdFx0aWYgKCFzY2FuQWxsRXh0ZW5zaW9uc1Byb21pc2UpIHtcblx0XHRcdFx0XHRzY2FuQWxsRXh0ZW5zaW9uc1Byb21pc2UgPSB0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuQWxsRXh0ZW5zaW9ucyh7fSwgdXNlclNjYW5PcHRpb25zKVxuXHRcdFx0XHRcdFx0LmZpbmFsbHkoKCkgPT4gdGhpcy5zY2FuQWxsRXh0ZW5zaW9uUHJvbWlzZS5kZWxldGUocHJvZmlsZUxvY2F0aW9uKSk7XG5cdFx0XHRcdFx0dGhpcy5zY2FuQWxsRXh0ZW5zaW9uUHJvbWlzZS5zZXQocHJvZmlsZUxvY2F0aW9uLCBzY2FuQWxsRXh0ZW5zaW9uc1Byb21pc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNjYW5uZWRFeHRlbnNpb25zLnB1c2goLi4uYXdhaXQgc2NhbkFsbEV4dGVuc2lvbnNQcm9taXNlKTtcblx0XHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gRXh0ZW5zaW9uVHlwZS5Vc2VyKSB7XG5cdFx0XHRcdGxldCBzY2FuVXNlckV4dGVuc2lvbnNQcm9taXNlID0gdGhpcy5zY2FuVXNlckV4dGVuc2lvbnNQcm9taXNlLmdldChwcm9maWxlTG9jYXRpb24pO1xuXHRcdFx0XHRpZiAoIXNjYW5Vc2VyRXh0ZW5zaW9uc1Byb21pc2UpIHtcblx0XHRcdFx0XHRzY2FuVXNlckV4dGVuc2lvbnNQcm9taXNlID0gdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblVzZXJFeHRlbnNpb25zKHVzZXJTY2FuT3B0aW9ucylcblx0XHRcdFx0XHRcdC5maW5hbGx5KCgpID0+IHRoaXMuc2NhblVzZXJFeHRlbnNpb25zUHJvbWlzZS5kZWxldGUocHJvZmlsZUxvY2F0aW9uKSk7XG5cdFx0XHRcdFx0dGhpcy5zY2FuVXNlckV4dGVuc2lvbnNQcm9taXNlLnNldChwcm9maWxlTG9jYXRpb24sIHNjYW5Vc2VyRXh0ZW5zaW9uc1Byb21pc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNjYW5uZWRFeHRlbnNpb25zLnB1c2goLi4uYXdhaXQgc2NhblVzZXJFeHRlbnNpb25zUHJvbWlzZSk7XG5cdFx0XHR9XG5cdFx0XHRzY2FubmVkRXh0ZW5zaW9ucyA9IHR5cGUgIT09IG51bGwgPyBzY2FubmVkRXh0ZW5zaW9ucy5maWx0ZXIociA9PiByLnR5cGUgPT09IHR5cGUpIDogc2Nhbm5lZEV4dGVuc2lvbnM7XG5cdFx0XHRyZXR1cm4gYXdhaXQgUHJvbWlzZS5hbGwoc2Nhbm5lZEV4dGVuc2lvbnMubWFwKGV4dGVuc2lvbiA9PiB0aGlzLnRvTG9jYWxFeHRlbnNpb24oZXh0ZW5zaW9uKSkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlcnJvciwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5TY2FubmluZyk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgc2NhbkFsbFVzZXJFeHRlbnNpb25zKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc2Nhbm5lZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS5zY2FuQWxsVXNlckV4dGVuc2lvbnMoKTtcblx0XHRcdHJldHVybiBhd2FpdCBQcm9taXNlLmFsbChzY2FubmVkRXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IHRoaXMudG9Mb2NhbEV4dGVuc2lvbihleHRlbnNpb24pKSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGVycm9yLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlNjYW5uaW5nKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzY2FuVXNlckV4dGVuc2lvbkF0TG9jYXRpb24obG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uIHwgbnVsbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzY2FubmVkRXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhbkV4aXN0aW5nRXh0ZW5zaW9uKGxvY2F0aW9uLCBFeHRlbnNpb25UeXBlLlVzZXIsIHsgaW5jbHVkZUludmFsaWQ6IHRydWUgfSk7XG5cdFx0XHRpZiAoc2Nhbm5lZEV4dGVuc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy50b0xvY2FsRXh0ZW5zaW9uKHNjYW5uZWRFeHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGFzeW5jIGV4dHJhY3RVc2VyRXh0ZW5zaW9uKGV4dGVuc2lvbktleTogRXh0ZW5zaW9uS2V5LCB6aXBQYXRoOiBzdHJpbmcsIHJlbW92ZUlmRXhpc3RzOiBib29sZWFuLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdGNvbnN0IGZvbGRlck5hbWUgPSBleHRlbnNpb25LZXkudG9TdHJpbmcoKTtcblx0XHRjb25zdCB0ZW1wTG9jYXRpb24gPSBVUkkuZmlsZShwYXRoLmpvaW4odGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UudXNlckV4dGVuc2lvbnNMb2NhdGlvbi5mc1BhdGgsIGAuJHtnZW5lcmF0ZVV1aWQoKX1gKSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uTG9jYXRpb24gPSBVUkkuZmlsZShwYXRoLmpvaW4odGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UudXNlckV4dGVuc2lvbnNMb2NhdGlvbi5mc1BhdGgsIGZvbGRlck5hbWUpKTtcblxuXHRcdGlmIChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhleHRlbnNpb25Mb2NhdGlvbikpIHtcblx0XHRcdGlmICghcmVtb3ZlSWZFeGlzdHMpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5zY2FuTG9jYWxFeHRlbnNpb24oZXh0ZW5zaW9uTG9jYXRpb24sIEV4dGVuc2lvblR5cGUuVXNlcik7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEVycm9yIHdoaWxlIHNjYW5uaW5nIHRoZSBleGlzdGluZyBleHRlbnNpb24gYXQgJHtleHRlbnNpb25Mb2NhdGlvbi5wYXRofS4gRGVsZXRpbmcgdGhlIGV4aXN0aW5nIGV4dGVuc2lvbiBhbmQgZXh0cmFjdGluZyBpdC5gLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRlbGV0ZUV4dGVuc2lvbkZyb21Mb2NhdGlvbihleHRlbnNpb25LZXkuaWQsIGV4dGVuc2lvbkxvY2F0aW9uLCAncmVtb3ZlRXhpc3RpbmcnKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmxzLmxvY2FsaXplKCdlcnJvckRlbGV0aW5nJywgXCJVbmFibGUgdG8gZGVsZXRlIHRoZSBleGlzdGluZyBmb2xkZXIgJ3swfScgd2hpbGUgaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uICd7MX0nLiBQbGVhc2UgZGVsZXRlIHRoZSBmb2xkZXIgbWFudWFsbHkgYW5kIHRyeSBhZ2FpblwiLCBleHRlbnNpb25Mb2NhdGlvbi5mc1BhdGgsIGV4dGVuc2lvbktleS5pZCksIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuRGVsZXRlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBFeHRyYWN0XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFN0YXJ0ZWQgZXh0cmFjdGluZyB0aGUgZXh0ZW5zaW9uIGZyb20gJHt6aXBQYXRofSB0byAke2V4dGVuc2lvbkxvY2F0aW9uLmZzUGF0aH1gKTtcblx0XHRcdFx0YXdhaXQgZXh0cmFjdCh6aXBQYXRoLCB0ZW1wTG9jYXRpb24uZnNQYXRoLCB7IHNvdXJjZVBhdGg6ICdleHRlbnNpb24nLCBvdmVyd3JpdGU6IHRydWUgfSwgdG9rZW4pO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgRXh0cmFjdGVkIGV4dGVuc2lvbiB0byAke2V4dGVuc2lvbkxvY2F0aW9ufTpgLCBleHRlbnNpb25LZXkuaWQpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aHJvdyBmcm9tRXh0cmFjdEVycm9yKGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXRhZGF0YTogTWFuaWZlc3RNZXRhZGF0YSA9IHsgaW5zdGFsbGVkVGltZXN0YW1wOiBEYXRlLm5vdygpLCB0YXJnZXRQbGF0Zm9ybTogZXh0ZW5zaW9uS2V5LnRhcmdldFBsYXRmb3JtIH07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRtZXRhZGF0YS5zaXplID0gYXdhaXQgY29tcHV0ZVNpemUodGVtcExvY2F0aW9uLCB0aGlzLmZpbGVTZXJ2aWNlKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIExvZyAmIGlnbm9yZVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgRXJyb3Igd2hpbGUgZ2V0dGluZyB0aGUgc2l6ZSBvZiB0aGUgZXh0cmFjdGVkIGV4dGVuc2lvbiA6ICR7dGVtcExvY2F0aW9uLmZzUGF0aH1gLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UudXBkYXRlTWFuaWZlc3RNZXRhZGF0YSh0ZW1wTG9jYXRpb24sIG1ldGFkYXRhKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFVwZGF0ZU1ldGFkYXRhRXJyb3JFdmVudCwgVXBkYXRlTWV0YWRhdGFFcnJvckNsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uOmV4dHJhY3QnLCB7IGV4dGVuc2lvbklkOiBleHRlbnNpb25LZXkuaWQsIGNvZGU6IGAke3RvRmlsZU9wZXJhdGlvblJlc3VsdChlcnJvcil9YCB9KTtcblx0XHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3IsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuVXBkYXRlTWV0YWRhdGEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlbmFtZVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTdGFydGVkIHJlbmFtaW5nIHRoZSBleHRlbnNpb24gZnJvbSAke3RlbXBMb2NhdGlvbi5mc1BhdGh9IHRvICR7ZXh0ZW5zaW9uTG9jYXRpb24uZnNQYXRofWApO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbmFtZSh0ZW1wTG9jYXRpb24uZnNQYXRoLCBleHRlbnNpb25Mb2NhdGlvbi5mc1BhdGgpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnUmVuYW1lZCB0bycsIGV4dGVuc2lvbkxvY2F0aW9uLmZzUGF0aCk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAoZXJyb3IuY29kZSA9PT0gJ0VOT1RFTVBUWScpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgUmVuYW1lIGZhaWxlZCBiZWNhdXNlIGV4dGVuc2lvbiB3YXMgaW5zdGFsbGVkIGJ5IGFub3RoZXIgc291cmNlLiBTbyBpZ25vcmluZyByZW5hbWluZy5gLCBleHRlbnNpb25LZXkuaWQpO1xuXHRcdFx0XHRcdHRyeSB7IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHRlbXBMb2NhdGlvbiwgeyByZWN1cnNpdmU6IHRydWUgfSk7IH0gY2F0Y2ggKGUpIHsgLyogaWdub3JlICovIH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgUmVuYW1lIGZhaWxlZCBiZWNhdXNlIG9mICR7Z2V0RXJyb3JNZXNzYWdlKGVycm9yKX0uIERlbGV0ZWQgZnJvbSBleHRyYWN0ZWQgbG9jYXRpb25gLCB0ZW1wTG9jYXRpb24pO1xuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uRXh0cmFjdC5maXJlKGV4dGVuc2lvbkxvY2F0aW9uKTtcblxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0cnkgeyBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbCh0ZW1wTG9jYXRpb24sIHsgcmVjdXJzaXZlOiB0cnVlIH0pOyB9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zY2FuTG9jYWxFeHRlbnNpb24oZXh0ZW5zaW9uTG9jYXRpb24sIEV4dGVuc2lvblR5cGUuVXNlcik7XG5cdH1cblxuXHRhc3luYyBzY2FuTWV0YWRhdGEobG9jYWw6IElMb2NhbEV4dGVuc2lvbiwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPE1ldGFkYXRhIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5nZXRTY2FubmVkRXh0ZW5zaW9uKGxvY2FsLCBwcm9maWxlTG9jYXRpb24pO1xuXHRcdHJldHVybiBleHRlbnNpb24/Lm1ldGFkYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRTY2FubmVkRXh0ZW5zaW9uKGxvY2FsOiBJTG9jYWxFeHRlbnNpb24sIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb24gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLnNjYW5Qcm9maWxlRXh0ZW5zaW9ucyhwcm9maWxlTG9jYXRpb24pO1xuXHRcdHJldHVybiBleHRlbnNpb25zLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGxvY2FsLmlkZW50aWZpZXIpKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZU1ldGFkYXRhKGxvY2FsOiBJTG9jYWxFeHRlbnNpb24sIG1ldGFkYXRhOiBQYXJ0aWFsPE1ldGFkYXRhPiwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UudXBkYXRlTWV0YWRhdGEoW1tsb2NhbCwgbWV0YWRhdGFdXSwgcHJvZmlsZUxvY2F0aW9uKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8VXBkYXRlTWV0YWRhdGFFcnJvckV2ZW50LCBVcGRhdGVNZXRhZGF0YUVycm9yQ2xhc3NpZmljYXRpb24+KCdleHRlbnNpb246ZXh0cmFjdCcsIHsgZXh0ZW5zaW9uSWQ6IGxvY2FsLmlkZW50aWZpZXIuaWQsIGNvZGU6IGAke3RvRmlsZU9wZXJhdGlvblJlc3VsdChlcnJvcil9YCwgaXNQcm9maWxlOiAhIXByb2ZpbGVMb2NhdGlvbiB9KTtcblx0XHRcdHRocm93IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGVycm9yLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlVwZGF0ZU1ldGFkYXRhKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc2NhbkxvY2FsRXh0ZW5zaW9uKGxvY2FsLmxvY2F0aW9uLCBsb2NhbC50eXBlLCBwcm9maWxlTG9jYXRpb24pO1xuXHR9XG5cblx0YXN5bmMgc2V0RXh0ZW5zaW9uc0ZvclJlbW92YWwoLi4uZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1RvUmVtb3ZlID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKGV4dGVuc2lvbi5sb2NhdGlvbikpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvUmVtb3ZlLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgZXh0ZW5zaW9uS2V5czogRXh0ZW5zaW9uS2V5W10gPSBleHRlbnNpb25zVG9SZW1vdmUubWFwKGUgPT4gRXh0ZW5zaW9uS2V5LmNyZWF0ZShlKSk7XG5cdFx0YXdhaXQgdGhpcy53aXRoUmVtb3ZlZEV4dGVuc2lvbnMocmVtb3ZlZEV4dGVuc2lvbnMgPT5cblx0XHRcdGV4dGVuc2lvbktleXMuZm9yRWFjaChleHRlbnNpb25LZXkgPT4ge1xuXHRcdFx0XHRyZW1vdmVkRXh0ZW5zaW9uc1tleHRlbnNpb25LZXkudG9TdHJpbmcoKV0gPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnTWFya2VkIGV4dGVuc2lvbiBhcyByZW1vdmVkJywgZXh0ZW5zaW9uS2V5LnRvU3RyaW5nKCkpO1xuXHRcdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgdW5zZXRFeHRlbnNpb25zRm9yUmVtb3ZhbCguLi5leHRlbnNpb25LZXlzOiBFeHRlbnNpb25LZXlbXSk6IFByb21pc2U8Ym9vbGVhbltdPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3VsdHM6IGJvb2xlYW5bXSA9IFtdO1xuXHRcdFx0YXdhaXQgdGhpcy53aXRoUmVtb3ZlZEV4dGVuc2lvbnMocmVtb3ZlZEV4dGVuc2lvbnMgPT5cblx0XHRcdFx0ZXh0ZW5zaW9uS2V5cy5mb3JFYWNoKGV4dGVuc2lvbktleSA9PiB7XG5cdFx0XHRcdFx0aWYgKHJlbW92ZWRFeHRlbnNpb25zW2V4dGVuc2lvbktleS50b1N0cmluZygpXSkge1xuXHRcdFx0XHRcdFx0cmVzdWx0cy5wdXNoKHRydWUpO1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHJlbW92ZWRFeHRlbnNpb25zW2V4dGVuc2lvbktleS50b1N0cmluZygpXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzdWx0cy5wdXNoKGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdHJldHVybiByZXN1bHRzO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlcnJvciwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5VbnNldFJlbW92ZWQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGRlbGV0ZUV4dGVuc2lvbihleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiB8IElTY2FubmVkRXh0ZW5zaW9uLCB0eXBlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChleHRlbnNpb24ubG9jYXRpb24sIHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnVzZXJFeHRlbnNpb25zTG9jYXRpb24pKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRlbGV0ZUV4dGVuc2lvbkZyb21Mb2NhdGlvbihleHRlbnNpb24uaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uLmxvY2F0aW9uLCB0eXBlKTtcblx0XHRcdGF3YWl0IHRoaXMudW5zZXRFeHRlbnNpb25zRm9yUmVtb3ZhbChFeHRlbnNpb25LZXkuY3JlYXRlKGV4dGVuc2lvbikpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNvcHlFeHRlbnNpb24oZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSwgdG9Qcm9maWxlTG9jYXRpb246IFVSSSwgbWV0YWRhdGE6IFBhcnRpYWw8TWV0YWRhdGE+KTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRjb25zdCBzb3VyY2UgPSBhd2FpdCB0aGlzLmdldFNjYW5uZWRFeHRlbnNpb24oZXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRjb25zdCB0YXJnZXQgPSBhd2FpdCB0aGlzLmdldFNjYW5uZWRFeHRlbnNpb24oZXh0ZW5zaW9uLCB0b1Byb2ZpbGVMb2NhdGlvbik7XG5cdFx0bWV0YWRhdGEgPSB7IC4uLnNvdXJjZT8ubWV0YWRhdGEsIC4uLm1ldGFkYXRhIH07XG5cblx0XHRpZiAodGFyZ2V0KSB7XG5cdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodGFyZ2V0LmxvY2F0aW9uLCBleHRlbnNpb24ubG9jYXRpb24pKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZS51cGRhdGVNZXRhZGF0YShbW2V4dGVuc2lvbiwgeyAuLi50YXJnZXQubWV0YWRhdGEsIC4uLm1ldGFkYXRhIH1dXSwgdG9Qcm9maWxlTG9jYXRpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdGFyZ2V0RXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5zY2FuTG9jYWxFeHRlbnNpb24odGFyZ2V0LmxvY2F0aW9uLCBleHRlbnNpb24udHlwZSwgdG9Qcm9maWxlTG9jYXRpb24pO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UucmVtb3ZlRXh0ZW5zaW9uc0Zyb21Qcm9maWxlKFt0YXJnZXRFeHRlbnNpb24uaWRlbnRpZmllcl0sIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLmFkZEV4dGVuc2lvbnNUb1Byb2ZpbGUoW1tleHRlbnNpb24sIHsgLi4udGFyZ2V0Lm1ldGFkYXRhLCAuLi5tZXRhZGF0YSB9XV0sIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLmFkZEV4dGVuc2lvbnNUb1Byb2ZpbGUoW1tleHRlbnNpb24sIG1ldGFkYXRhXV0sIHRvUHJvZmlsZUxvY2F0aW9uKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zY2FuTG9jYWxFeHRlbnNpb24oZXh0ZW5zaW9uLmxvY2F0aW9uLCBleHRlbnNpb24udHlwZSwgdG9Qcm9maWxlTG9jYXRpb24pO1xuXHR9XG5cblx0YXN5bmMgY29weUV4dGVuc2lvbnMoZnJvbVByb2ZpbGVMb2NhdGlvbjogVVJJLCB0b1Byb2ZpbGVMb2NhdGlvbjogVVJJLCBwcm9kdWN0VmVyc2lvbjogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZnJvbUV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLnNjYW5FeHRlbnNpb25zKEV4dGVuc2lvblR5cGUuVXNlciwgZnJvbVByb2ZpbGVMb2NhdGlvbiwgcHJvZHVjdFZlcnNpb24pO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnM6IFtJTG9jYWxFeHRlbnNpb24sIE1ldGFkYXRhIHwgdW5kZWZpbmVkXVtdID0gYXdhaXQgUHJvbWlzZS5hbGwoZnJvbUV4dGVuc2lvbnNcblx0XHRcdC5maWx0ZXIoZSA9PiAhZS5pc0FwcGxpY2F0aW9uU2NvcGVkKSAvKiByZW1vdmUgYXBwbGljYXRpb24gc2NvcGVkIGV4dGVuc2lvbnMgKi9cblx0XHRcdC5tYXAoYXN5bmMgZSA9PiAoW2UsIGF3YWl0IHRoaXMuc2Nhbk1ldGFkYXRhKGUsIGZyb21Qcm9maWxlTG9jYXRpb24pXSkpKTtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UuYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShleHRlbnNpb25zLCB0b1Byb2ZpbGVMb2NhdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRlbGV0ZUV4dGVuc2lvbkZyb21Mb2NhdGlvbihpZDogc3RyaW5nLCBsb2NhdGlvbjogVVJJLCB0eXBlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYERlbGV0aW5nICR7dHlwZX0gZXh0ZW5zaW9uIGZyb20gZGlza2AsIGlkLCBsb2NhdGlvbi5mc1BhdGgpO1xuXHRcdGNvbnN0IHJlbmFtZWRMb2NhdGlvbiA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZShsb2NhdGlvbiksIGAke3RoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5iYXNlbmFtZShsb2NhdGlvbil9LiR7aGFzaChnZW5lcmF0ZVV1aWQoKSkudG9TdHJpbmcoMTYpfSR7REVMRVRFRF9GT0xERVJfUE9TVEZJWH1gKTtcblx0XHRhd2FpdCB0aGlzLnJlbmFtZShsb2NhdGlvbi5mc1BhdGgsIHJlbmFtZWRMb2NhdGlvbi5mc1BhdGgpO1xuXHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHJlbmFtZWRMb2NhdGlvbiwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYERlbGV0ZWQgJHt0eXBlfSBleHRlbnNpb24gZnJvbSBkaXNrYCwgaWQsIGxvY2F0aW9uLmZzUGF0aCk7XG5cdH1cblxuXHRwcml2YXRlIHdpdGhSZW1vdmVkRXh0ZW5zaW9ucyh1cGRhdGVGbj86IChyZW1vdmVkOiBJU3RyaW5nRGljdGlvbmFyeTxib29sZWFuPikgPT4gdm9pZCk6IFByb21pc2U8SVN0cmluZ0RpY3Rpb25hcnk8Ym9vbGVhbj4+IHtcblx0XHRyZXR1cm4gdGhpcy5vYnNvbGV0ZUZpbGVMaW1pdGVyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGxldCByYXc6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRoaXMub2Jzb2xldGVkUmVzb3VyY2UsICd1dGY4Jyk7XG5cdFx0XHRcdHJhdyA9IGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmICh0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpICE9PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IHJlbW92ZWQgPSB7fTtcblx0XHRcdGlmIChyYXcpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZW1vdmVkID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7IC8qIGlnbm9yZSAqLyB9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh1cGRhdGVGbikge1xuXHRcdFx0XHR1cGRhdGVGbihyZW1vdmVkKTtcblx0XHRcdFx0aWYgKE9iamVjdC5rZXlzKHJlbW92ZWQpLmxlbmd0aCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRoaXMub2Jzb2xldGVkUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkocmVtb3ZlZCkpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwodGhpcy5vYnNvbGV0ZWRSZXNvdXJjZSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGlmICh0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpICE9PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVtb3ZlZDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuYW1lKGV4dHJhY3RQYXRoOiBzdHJpbmcsIHJlbmFtZVBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBwZnMuUHJvbWlzZXMucmVuYW1lKGV4dHJhY3RQYXRoLCByZW5hbWVQYXRoLCAyICogNjAgKiAxMDAwIC8qIFJldHJ5IGZvciAyIG1pbnV0ZXMgKi8pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlcnJvciwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5SZW5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNjYW5Mb2NhbEV4dGVuc2lvbihsb2NhdGlvbjogVVJJLCB0eXBlOiBFeHRlbnNpb25UeXBlLCBwcm9maWxlTG9jYXRpb24/OiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAocHJvZmlsZUxvY2F0aW9uKSB7XG5cdFx0XHRcdGNvbnN0IHNjYW5uZWRFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblVzZXJFeHRlbnNpb25zKHsgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0XHRjb25zdCBzY2FubmVkRXh0ZW5zaW9uID0gc2Nhbm5lZEV4dGVuc2lvbnMuZmluZChlID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGUubG9jYXRpb24sIGxvY2F0aW9uKSk7XG5cdFx0XHRcdGlmIChzY2FubmVkRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMudG9Mb2NhbEV4dGVuc2lvbihzY2FubmVkRXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc2Nhbm5lZEV4dGVuc2lvbiA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5FeGlzdGluZ0V4dGVuc2lvbihsb2NhdGlvbiwgdHlwZSwgeyBpbmNsdWRlSW52YWxpZDogdHJ1ZSB9KTtcblx0XHRcdFx0aWYgKHNjYW5uZWRFeHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy50b0xvY2FsRXh0ZW5zaW9uKHNjYW5uZWRFeHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKG5scy5sb2NhbGl6ZSgnY2Fubm90IHJlYWQnLCBcIkNhbm5vdCByZWFkIHRoZSBleHRlbnNpb24gZnJvbSB7MH1cIiwgbG9jYXRpb24ucGF0aCksIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuU2Nhbm5pbmdFeHRlbnNpb24pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlcnJvciwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5TY2FubmluZ0V4dGVuc2lvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0b0xvY2FsRXh0ZW5zaW9uKGV4dGVuc2lvbjogSVNjYW5uZWRFeHRlbnNpb24pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdGxldCBzdGF0OiBJRmlsZVN0YXQgfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUoZXh0ZW5zaW9uLmxvY2F0aW9uKTtcblx0XHR9IGNhdGNoIChlcnJvcikgey8qIGlnbm9yZSAqLyB9XG5cblx0XHRsZXQgcmVhZG1lVXJsOiBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGNoYW5nZWxvZ1VybDogVVJJIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChzdGF0Py5jaGlsZHJlbikge1xuXHRcdFx0cmVhZG1lVXJsID0gc3RhdC5jaGlsZHJlbi5maW5kKCh7IG5hbWUgfSkgPT4gL15yZWFkbWUoXFwudHh0fFxcLm1kfCkkL2kudGVzdChuYW1lKSk/LnJlc291cmNlO1xuXHRcdFx0Y2hhbmdlbG9nVXJsID0gc3RhdC5jaGlsZHJlbi5maW5kKCh7IG5hbWUgfSkgPT4gL15jaGFuZ2Vsb2coXFwudHh0fFxcLm1kfCkkL2kudGVzdChuYW1lKSk/LnJlc291cmNlO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0aWRlbnRpZmllcjogZXh0ZW5zaW9uLmlkZW50aWZpZXIsXG5cdFx0XHR0eXBlOiBleHRlbnNpb24udHlwZSxcblx0XHRcdGlzQnVpbHRpbjogZXh0ZW5zaW9uLmlzQnVpbHRpbiB8fCAhIWV4dGVuc2lvbi5tZXRhZGF0YT8uaXNCdWlsdGluLFxuXHRcdFx0bG9jYXRpb246IGV4dGVuc2lvbi5sb2NhdGlvbixcblx0XHRcdG1hbmlmZXN0OiBleHRlbnNpb24ubWFuaWZlc3QsXG5cdFx0XHR0YXJnZXRQbGF0Zm9ybTogZXh0ZW5zaW9uLnRhcmdldFBsYXRmb3JtLFxuXHRcdFx0dmFsaWRhdGlvbnM6IGV4dGVuc2lvbi52YWxpZGF0aW9ucyxcblx0XHRcdGlzVmFsaWQ6IGV4dGVuc2lvbi5pc1ZhbGlkLFxuXHRcdFx0cmVhZG1lVXJsLFxuXHRcdFx0Y2hhbmdlbG9nVXJsLFxuXHRcdFx0cHVibGlzaGVyRGlzcGxheU5hbWU6IGV4dGVuc2lvbi5tZXRhZGF0YT8ucHVibGlzaGVyRGlzcGxheU5hbWUsXG5cdFx0XHRwdWJsaXNoZXJJZDogZXh0ZW5zaW9uLm1ldGFkYXRhPy5wdWJsaXNoZXJJZCB8fCBudWxsLFxuXHRcdFx0aXNBcHBsaWNhdGlvblNjb3BlZDogISFleHRlbnNpb24ubWV0YWRhdGE/LmlzQXBwbGljYXRpb25TY29wZWQsXG5cdFx0XHRpc01hY2hpbmVTY29wZWQ6ICEhZXh0ZW5zaW9uLm1ldGFkYXRhPy5pc01hY2hpbmVTY29wZWQsXG5cdFx0XHRpc1ByZVJlbGVhc2VWZXJzaW9uOiAhIWV4dGVuc2lvbi5tZXRhZGF0YT8uaXNQcmVSZWxlYXNlVmVyc2lvbixcblx0XHRcdGhhc1ByZVJlbGVhc2VWZXJzaW9uOiAhIWV4dGVuc2lvbi5tZXRhZGF0YT8uaGFzUHJlUmVsZWFzZVZlcnNpb24sXG5cdFx0XHRwcmVSZWxlYXNlOiBleHRlbnNpb24ucHJlUmVsZWFzZSxcblx0XHRcdGluc3RhbGxlZFRpbWVzdGFtcDogZXh0ZW5zaW9uLm1ldGFkYXRhPy5pbnN0YWxsZWRUaW1lc3RhbXAsXG5cdFx0XHR1cGRhdGVkOiAhIWV4dGVuc2lvbi5tZXRhZGF0YT8udXBkYXRlZCxcblx0XHRcdHBpbm5lZDogISFleHRlbnNpb24ubWV0YWRhdGE/LnBpbm5lZCxcblx0XHRcdHByaXZhdGU6ICEhZXh0ZW5zaW9uLm1ldGFkYXRhPy5wcml2YXRlLFxuXHRcdFx0aXNXb3Jrc3BhY2VTY29wZWQ6IGZhbHNlLFxuXHRcdFx0c291cmNlOiBleHRlbnNpb24ubWV0YWRhdGE/LnNvdXJjZSA/PyAoZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCA/ICdnYWxsZXJ5JyA6ICd2c2l4JyksXG5cdFx0XHRzaXplOiBleHRlbnNpb24ubWV0YWRhdGE/LnNpemUgPz8gMCxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplRXh0ZW5zaW9uU2l6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhbkFsbFVzZXJFeHRlbnNpb25zKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoZXh0ZW5zaW9ucy5tYXAoYXN5bmMgZXh0ZW5zaW9uID0+IHtcblx0XHRcdC8vIHNldCBzaXplIGlmIG5vdCBzZXQgYmVmb3JlXG5cdFx0XHRpZiAoaXNEZWZpbmVkKGV4dGVuc2lvbi5tZXRhZGF0YT8uaW5zdGFsbGVkVGltZXN0YW1wKSAmJiBpc1VuZGVmaW5lZChleHRlbnNpb24ubWV0YWRhdGE/LnNpemUpKSB7XG5cdFx0XHRcdGNvbnN0IHNpemUgPSBhd2FpdCBjb21wdXRlU2l6ZShleHRlbnNpb24ubG9jYXRpb24sIHRoaXMuZmlsZVNlcnZpY2UpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyU2VydmljZS51cGRhdGVNYW5pZmVzdE1ldGFkYXRhKGV4dGVuc2lvbi5sb2NhdGlvbiwgeyBzaXplIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGVsZXRlRXh0ZW5zaW9uc01hcmtlZEZvclJlbW92YWwoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHJlbW92ZWQ6IElTdHJpbmdEaWN0aW9uYXJ5PGJvb2xlYW4+O1xuXHRcdHRyeSB7XG5cdFx0XHRyZW1vdmVkID0gYXdhaXQgdGhpcy53aXRoUmVtb3ZlZEV4dGVuc2lvbnMoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3IsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuUmVhZFJlbW92ZWQpO1xuXHRcdH1cblxuXHRcdGlmIChPYmplY3Qua2V5cyhyZW1vdmVkKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZyhgTm8gZXh0ZW5zaW9ucyBhcmUgbWFya2VkIGFzIHJlbW92ZWQuYCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBEZWxldGluZyBleHRlbnNpb25zIG1hcmtlZCBhcyByZW1vdmVkOmAsIE9iamVjdC5rZXlzKHJlbW92ZWQpKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLnNjYW5BbGxVc2VyRXh0ZW5zaW9ucygpO1xuXHRcdGNvbnN0IGluc3RhbGxlZDogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRmb3IgKGNvbnN0IGUgb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0aWYgKCFyZW1vdmVkW0V4dGVuc2lvbktleS5jcmVhdGUoZSkudG9TdHJpbmcoKV0pIHtcblx0XHRcdFx0aW5zdGFsbGVkLmFkZChlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdC8vIHJ1bm5pbmcgcG9zdCB1bmluc3RhbGwgdGFza3MgZm9yIGV4dGVuc2lvbnMgdGhhdCBhcmUgbm90IGluc3RhbGxlZCBhbnltb3JlXG5cdFx0XHRjb25zdCBieUV4dGVuc2lvbiA9IGdyb3VwQnlFeHRlbnNpb24oZXh0ZW5zaW9ucywgZSA9PiBlLmlkZW50aWZpZXIpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChieUV4dGVuc2lvbi5tYXAoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxhdGVzdCA9IGUuc29ydCgoYSwgYikgPT4gc2VtdmVyLnJjb21wYXJlKGEubWFuaWZlc3QudmVyc2lvbiwgYi5tYW5pZmVzdC52ZXJzaW9uKSlbMF07XG5cdFx0XHRcdGlmICghaW5zdGFsbGVkLmhhcyhsYXRlc3QuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuYmVmb3JlUmVtb3ZpbmdFeHRlbnNpb24obGF0ZXN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvUmVtb3ZlID0gZXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBlLmluc3RhbGxlZFRpbWVzdGFtcCAvKiBJbnN0YWxsZWQgYnkgU3lzdGVtICovICYmIHJlbW92ZWRbRXh0ZW5zaW9uS2V5LmNyZWF0ZShlKS50b1N0cmluZygpXSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRvUmVtb3ZlLm1hcChlID0+IHRoaXMuZGVsZXRlRXh0ZW5zaW9uKGUsICdtYXJrZWQgZm9yIHJlbW92YWwnKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW1vdmVUZW1wb3JhcmlseURlbGV0ZWRGb2xkZXJzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UjcmVtb3ZlVGVtcERlbGV0ZUZvbGRlcnMnKTtcblxuXHRcdGxldCBzdGF0O1xuXHRcdHRyeSB7XG5cdFx0XHRzdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnVzZXJFeHRlbnNpb25zTG9jYXRpb24pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghc3RhdD8uY2hpbGRyZW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHN0YXQuY2hpbGRyZW4ubWFwKGFzeW5jIGNoaWxkID0+IHtcblx0XHRcdFx0aWYgKCFjaGlsZC5pc0RpcmVjdG9yeSB8fCAhY2hpbGQubmFtZS5lbmRzV2l0aChERUxFVEVEX0ZPTERFUl9QT1NURklYKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0RlbGV0aW5nIHRoZSB0ZW1wb3JhcmlseSBkZWxldGVkIGZvbGRlcicsIGNoaWxkLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKGNoaWxkLnJlc291cmNlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0RlbGV0ZWQgdGhlIHRlbXBvcmFyaWx5IGRlbGV0ZWQgZm9sZGVyJywgY2hpbGQucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0aWYgKHRvRmlsZU9wZXJhdGlvblJlc3VsdChlcnJvcikgIT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHsgLyogaWdub3JlICovIH1cblx0fVxuXG59XG5cbmNsYXNzIEluc3RhbGxFeHRlbnNpb25JblByb2ZpbGVUYXNrIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25UYXNrPElMb2NhbEV4dGVuc2lvbj4gaW1wbGVtZW50cyBJSW5zdGFsbEV4dGVuc2lvblRhc2sge1xuXG5cdHByaXZhdGUgX29wZXJhdGlvbiA9IEluc3RhbGxPcGVyYXRpb24uSW5zdGFsbDtcblx0Z2V0IG9wZXJhdGlvbigpIHsgcmV0dXJuIHRoaXMub3B0aW9ucy5vcGVyYXRpb24gPz8gdGhpcy5fb3BlcmF0aW9uOyB9XG5cblx0cHJpdmF0ZSBfdmVyaWZpY2F0aW9uU3RhdHVzOiBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlIHwgdW5kZWZpbmVkO1xuXHRnZXQgdmVyaWZpY2F0aW9uU3RhdHVzKCkgeyByZXR1cm4gdGhpcy5fdmVyaWZpY2F0aW9uU3RhdHVzOyB9XG5cblx0cmVhZG9ubHkgaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25LZXk6IEV4dGVuc2lvbktleSxcblx0XHRyZWFkb25seSBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LFxuXHRcdHJlYWRvbmx5IHNvdXJjZTogSUdhbGxlcnlFeHRlbnNpb24gfCBVUkksXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogSW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0cmFjdEV4dGVuc2lvbkZuOiAob3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb21pc2U8RXh0cmFjdEV4dGVuc2lvblJlc3VsdD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zU2Nhbm5lcjogRXh0ZW5zaW9uc1NjYW5uZXIsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zU2Nhbm5lclNlcnZpY2U6IElFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZTogSUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5pZGVudGlmaWVyID0gdGhpcy5leHRlbnNpb25LZXkuaWRlbnRpZmllcjtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBkb1J1bih0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIuc2NhbkV4dGVuc2lvbnMoRXh0ZW5zaW9uVHlwZS5Vc2VyLCB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uLCB0aGlzLm9wdGlvbnMucHJvZHVjdFZlcnNpb24pO1xuXHRcdGNvbnN0IGV4aXN0aW5nRXh0ZW5zaW9uID0gaW5zdGFsbGVkLmZpbmQoaSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhpLmlkZW50aWZpZXIsIHRoaXMuaWRlbnRpZmllcikpO1xuXHRcdGlmIChleGlzdGluZ0V4dGVuc2lvbikge1xuXHRcdFx0dGhpcy5fb3BlcmF0aW9uID0gSW5zdGFsbE9wZXJhdGlvbi5VcGRhdGU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWV0YWRhdGE6IE1ldGFkYXRhID0ge1xuXHRcdFx0aXNBcHBsaWNhdGlvblNjb3BlZDogdGhpcy5vcHRpb25zLmlzQXBwbGljYXRpb25TY29wZWQgfHwgZXhpc3RpbmdFeHRlbnNpb24/LmlzQXBwbGljYXRpb25TY29wZWQsXG5cdFx0XHRpc01hY2hpbmVTY29wZWQ6IHRoaXMub3B0aW9ucy5pc01hY2hpbmVTY29wZWQgfHwgZXhpc3RpbmdFeHRlbnNpb24/LmlzTWFjaGluZVNjb3BlZCxcblx0XHRcdGlzQnVpbHRpbjogdGhpcy5vcHRpb25zLmlzQnVpbHRpbiB8fCBleGlzdGluZ0V4dGVuc2lvbj8uaXNCdWlsdGluLFxuXHRcdFx0aXNTeXN0ZW06IGV4aXN0aW5nRXh0ZW5zaW9uPy50eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbSA/IHRydWUgOiB1bmRlZmluZWQsXG5cdFx0XHRpbnN0YWxsZWRUaW1lc3RhbXA6IERhdGUubm93KCksXG5cdFx0XHRwaW5uZWQ6IHRoaXMub3B0aW9ucy5pbnN0YWxsR2l2ZW5WZXJzaW9uID8gdHJ1ZSA6ICh0aGlzLm9wdGlvbnMucGlubmVkID8/IGV4aXN0aW5nRXh0ZW5zaW9uPy5waW5uZWQpLFxuXHRcdFx0c291cmNlOiB0aGlzLnNvdXJjZSBpbnN0YW5jZW9mIFVSSSA/ICd2c2l4JyA6ICdnYWxsZXJ5Jyxcblx0XHR9O1xuXG5cdFx0bGV0IGxvY2FsOiBJTG9jYWxFeHRlbnNpb24gfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBWU0lYXG5cdFx0aWYgKHRoaXMuc291cmNlIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRpZiAoZXhpc3RpbmdFeHRlbnNpb24pIHtcblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uS2V5LmVxdWFscyhuZXcgRXh0ZW5zaW9uS2V5KGV4aXN0aW5nRXh0ZW5zaW9uLmlkZW50aWZpZXIsIGV4aXN0aW5nRXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24pKSkge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLmRlbGV0ZUV4dGVuc2lvbihleGlzdGluZ0V4dGVuc2lvbiwgJ2V4aXN0aW5nJyk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgncmVzdGFydENvZGUnLCBcIlBsZWFzZSByZXN0YXJ0IFZTIENvZGUgYmVmb3JlIHJlaW5zdGFsbGluZyB7MH0uXCIsIHRoaXMubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgdGhpcy5tYW5pZmVzdC5uYW1lKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBSZW1vdmUgdGhlIGV4dGVuc2lvbiB3aXRoIHNhbWUgdmVyc2lvbiBpZiBpdCBpcyBhbHJlYWR5IHVuaW5zdGFsbGVkLlxuXHRcdFx0Ly8gSW5zdGFsbGluZyBhIFZTSVggZXh0ZW5zaW9uIHNoYWxsIHJlcGxhY2UgdGhlIGV4aXN0aW5nIGV4dGVuc2lvbiBhbHdheXMuXG5cdFx0XHRjb25zdCBleGlzdGluZ1dpdGhTYW1lVmVyc2lvbiA9IGF3YWl0IHRoaXMudW5zZXRJZlJlbW92ZWQodGhpcy5leHRlbnNpb25LZXkpO1xuXHRcdFx0aWYgKGV4aXN0aW5nV2l0aFNhbWVWZXJzaW9uKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lci5kZWxldGVFeHRlbnNpb24oZXhpc3RpbmdXaXRoU2FtZVZlcnNpb24sICdleGlzdGluZycpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgncmVzdGFydENvZGUnLCBcIlBsZWFzZSByZXN0YXJ0IFZTIENvZGUgYmVmb3JlIHJlaW5zdGFsbGluZyB7MH0uXCIsIHRoaXMubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgdGhpcy5tYW5pZmVzdC5uYW1lKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdC8vIEdhbGxlcnlcblx0XHRlbHNlIHtcblx0XHRcdG1ldGFkYXRhLmlkID0gdGhpcy5zb3VyY2UuaWRlbnRpZmllci51dWlkO1xuXHRcdFx0bWV0YWRhdGEucHVibGlzaGVySWQgPSB0aGlzLnNvdXJjZS5wdWJsaXNoZXJJZDtcblx0XHRcdG1ldGFkYXRhLnB1Ymxpc2hlckRpc3BsYXlOYW1lID0gdGhpcy5zb3VyY2UucHVibGlzaGVyRGlzcGxheU5hbWU7XG5cdFx0XHRtZXRhZGF0YS50YXJnZXRQbGF0Zm9ybSA9IHRoaXMuc291cmNlLnByb3BlcnRpZXMudGFyZ2V0UGxhdGZvcm07XG5cdFx0XHRtZXRhZGF0YS51cGRhdGVkID0gISFleGlzdGluZ0V4dGVuc2lvbjtcblx0XHRcdG1ldGFkYXRhLnByaXZhdGUgPSB0aGlzLnNvdXJjZS5wcml2YXRlO1xuXHRcdFx0bWV0YWRhdGEuaXNQcmVSZWxlYXNlVmVyc2lvbiA9IHRoaXMuc291cmNlLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbjtcblx0XHRcdG1ldGFkYXRhLmhhc1ByZVJlbGVhc2VWZXJzaW9uID0gZXhpc3RpbmdFeHRlbnNpb24/Lmhhc1ByZVJlbGVhc2VWZXJzaW9uIHx8IHRoaXMuc291cmNlLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbjtcblx0XHRcdG1ldGFkYXRhLnByZVJlbGVhc2UgPSBpc0Jvb2xlYW4odGhpcy5vcHRpb25zLnByZVJlbGVhc2UpXG5cdFx0XHRcdD8gdGhpcy5vcHRpb25zLnByZVJlbGVhc2Vcblx0XHRcdFx0OiB0aGlzLm9wdGlvbnMuaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uIHx8IHRoaXMuc291cmNlLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbiB8fCBleGlzdGluZ0V4dGVuc2lvbj8ucHJlUmVsZWFzZTtcblxuXHRcdFx0aWYgKGV4aXN0aW5nRXh0ZW5zaW9uICYmIGV4aXN0aW5nRXh0ZW5zaW9uLnR5cGUgIT09IEV4dGVuc2lvblR5cGUuU3lzdGVtICYmIGV4aXN0aW5nRXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24gPT09IHRoaXMuc291cmNlLnZlcnNpb24pIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIudXBkYXRlTWV0YWRhdGEoZXhpc3RpbmdFeHRlbnNpb24sIG1ldGFkYXRhLCB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVW5zZXQgaWYgdGhlIGV4dGVuc2lvbiBpcyB1bmluc3RhbGxlZCBhbmQgcmV0dXJuIHRoZSB1bnNldCBleHRlbnNpb24uXG5cdFx0XHRsb2NhbCA9IGF3YWl0IHRoaXMudW5zZXRJZlJlbW92ZWQodGhpcy5leHRlbnNpb25LZXkpO1xuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdH1cblxuXHRcdGlmICghbG9jYWwpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXh0cmFjdEV4dGVuc2lvbkZuKHRoaXMub3BlcmF0aW9uLCB0b2tlbik7XG5cdFx0XHRsb2NhbCA9IHJlc3VsdC5sb2NhbDtcblx0XHRcdHRoaXMuX3ZlcmlmaWNhdGlvblN0YXR1cyA9IHJlc3VsdC52ZXJpZmljYXRpb25TdGF0dXM7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lclNlcnZpY2UuaW5pdGlhbGl6ZURlZmF1bHRQcm9maWxlRXh0ZW5zaW9ucygpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3IsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuSW50aWFsaXplRGVmYXVsdFByb2ZpbGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0dGhyb3cgdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UuYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShbW2xvY2FsLCBtZXRhZGF0YV1dLCB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uLCAhbG9jYWwuaXNWYWxpZCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGVycm9yLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLkFkZFRvUHJvZmlsZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25zU2Nhbm5lci5zY2FuTG9jYWxFeHRlbnNpb24obG9jYWwubG9jYXRpb24sIEV4dGVuc2lvblR5cGUuVXNlciwgdGhpcy5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbik7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoJ0Nhbm5vdCBmaW5kIHRoZSBpbnN0YWxsZWQgZXh0ZW5zaW9uJywgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbnN0YWxsZWRFeHRlbnNpb25Ob3RGb3VuZCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc291cmNlIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZU1ldGFkYXRhKGxvY2FsLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdW5zZXRJZlJlbW92ZWQoZXh0ZW5zaW9uS2V5OiBFeHRlbnNpb25LZXkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIElmIHRoZSBzYW1lIHZlcnNpb24gb2YgZXh0ZW5zaW9uIGlzIG1hcmtlZCBhcyByZW1vdmVkLCByZW1vdmUgaXQgZnJvbSB0aGVyZSBhbmQgcmV0dXJuIHRoZSBsb2NhbC5cblx0XHRjb25zdCBbcmVtb3ZlZF0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLnVuc2V0RXh0ZW5zaW9uc0ZvclJlbW92YWwoZXh0ZW5zaW9uS2V5KTtcblx0XHRpZiAocmVtb3ZlZCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1JlbW92ZWQgdGhlIGV4dGVuc2lvbiBmcm9tIHJlbW92ZWQgbGlzdDonLCBleHRlbnNpb25LZXkuaWQpO1xuXHRcdFx0Y29uc3QgdXNlckV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNTY2FubmVyLnNjYW5BbGxVc2VyRXh0ZW5zaW9ucygpO1xuXHRcdFx0cmV0dXJuIHVzZXJFeHRlbnNpb25zLmZpbmQoaSA9PiBFeHRlbnNpb25LZXkuY3JlYXRlKGkpLmVxdWFscyhleHRlbnNpb25LZXkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlTWV0YWRhdGEoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgW2dhbGxlcnlFeHRlbnNpb25dID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgdmVyc2lvbjogZXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24gfV0sIHRva2VuKTtcblx0XHRcdGlmICghZ2FsbGVyeUV4dGVuc2lvbikge1xuXHRcdFx0XHRbZ2FsbGVyeUV4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkIH1dLCB0b2tlbik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZ2FsbGVyeUV4dGVuc2lvbikge1xuXHRcdFx0XHRjb25zdCBtZXRhZGF0YSA9IHtcblx0XHRcdFx0XHRpZDogZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyLnV1aWQsXG5cdFx0XHRcdFx0cHVibGlzaGVyRGlzcGxheU5hbWU6IGdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUsXG5cdFx0XHRcdFx0cHVibGlzaGVySWQ6IGdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVySWQsXG5cdFx0XHRcdFx0aXNQcmVSZWxlYXNlVmVyc2lvbjogZ2FsbGVyeUV4dGVuc2lvbi5wcm9wZXJ0aWVzLmlzUHJlUmVsZWFzZVZlcnNpb24sXG5cdFx0XHRcdFx0aGFzUHJlUmVsZWFzZVZlcnNpb246IGV4dGVuc2lvbi5oYXNQcmVSZWxlYXNlVmVyc2lvbiB8fCBnYWxsZXJ5RXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbixcblx0XHRcdFx0XHRwcmVSZWxlYXNlOiBnYWxsZXJ5RXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbiB8fCB0aGlzLm9wdGlvbnMuaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uXG5cdFx0XHRcdH07XG5cdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1NjYW5uZXIudXBkYXRlTWV0YWRhdGEoZXh0ZW5zaW9uLCBtZXRhZGF0YSwgdGhpcy5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8qIElnbm9yZSBFcnJvciAqL1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBVbmluc3RhbGxFeHRlbnNpb25JblByb2ZpbGVUYXNrIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25UYXNrPHZvaWQ+IGltcGxlbWVudHMgSVVuaW5zdGFsbEV4dGVuc2lvblRhc2sge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLFxuXHRcdHJlYWRvbmx5IG9wdGlvbnM6IFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZTogSUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZG9SdW4odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZS5yZW1vdmVFeHRlbnNpb25zRnJvbVByb2ZpbGUoW3RoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXJdLCB0aGlzLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksUUFBUTtBQUNwQixTQUFTLFVBQVUsYUFBYTtBQUNoQyxTQUFTLGdCQUFnQjtBQUd6QixTQUFTLG1CQUFtQix1QkFBdUI7QUFDbkQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWTtBQUNyQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWEsbUJBQW1CO0FBQ3pDLFNBQVMsZUFBZTtBQUN4QixZQUFZLFVBQVU7QUFDdEIsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsV0FBVyxXQUFXLG1CQUFtQjtBQUNsRCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBb0I7QUFDN0IsWUFBWSxTQUFTO0FBQ3JCLFNBQVMs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
