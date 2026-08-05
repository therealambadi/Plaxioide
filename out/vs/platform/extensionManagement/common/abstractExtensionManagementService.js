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
import { distinct, isNonEmptyArray } from "../../../base/common/arrays.js";
import { Barrier, createCancelablePromise } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { CancellationError, getErrorMessage, isCancellationError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { isWeb } from "../../../base/common/platform.js";
import { URI } from "../../../base/common/uri.js";
import * as nls from "../../../nls.js";
import {
  ExtensionManagementError,
  IExtensionGalleryService,
  InstallOperation,
  StatisticType,
  isTargetPlatformCompatible,
  TargetPlatformToString,
  ExtensionManagementErrorCode,
  EXTENSION_INSTALL_DEP_PACK_CONTEXT,
  ExtensionGalleryError,
  ExtensionGalleryErrorCode,
  EXTENSION_INSTALL_SOURCE_CONTEXT,
  ExtensionSignatureVerificationCode,
  IAllowedExtensionsService
} from "./extensionManagement.js";
import { areSameExtensions, ExtensionKey, getGalleryExtensionId, getGalleryExtensionTelemetryData, getLocalExtensionTelemetryData, isMalicious } from "./extensionManagementUtil.js";
import { ExtensionType, isApplicationScopedExtension } from "../../extensions/common/extensions.js";
import { areApiProposalsCompatible } from "../../extensions/common/extensionValidator.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { MarkdownString } from "../../../base/common/htmlContent.js";
let CommontExtensionManagementService = class extends Disposable {
  constructor(productService, allowedExtensionsService) {
    super();
    this.productService = productService;
    this.allowedExtensionsService = allowedExtensionsService;
  }
  async canInstall(extension) {
    const allowedToInstall = this.allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName });
    if (allowedToInstall !== true) {
      return new MarkdownString(nls.localize("not allowed to install", "This extension cannot be installed because {0}", allowedToInstall.value));
    }
    if (!await this.isExtensionPlatformCompatible(extension)) {
      const learnLink = isWeb ? "https://aka.ms/vscode-web-extensions-guide" : "https://aka.ms/vscode-platform-specific-extensions";
      return new MarkdownString(`${nls.localize(
        "incompatible platform",
        "The '{0}' extension is not available in {1} for the {2}.",
        extension.displayName ?? extension.identifier.id,
        this.productService.nameLong,
        TargetPlatformToString(await this.getTargetPlatform())
      )} [${nls.localize("learn why", "Learn Why")}](${learnLink})`);
    }
    return true;
  }
  async isExtensionPlatformCompatible(extension) {
    const currentTargetPlatform = await this.getTargetPlatform();
    return extension.allTargetPlatforms.some((targetPlatform) => isTargetPlatformCompatible(targetPlatform, extension.allTargetPlatforms, currentTargetPlatform));
  }
};
CommontExtensionManagementService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IAllowedExtensionsService)
], CommontExtensionManagementService);
let AbstractExtensionManagementService = class extends CommontExtensionManagementService {
  constructor(galleryService, telemetryService, uriIdentityService, logService, productService, allowedExtensionsService, userDataProfilesService) {
    super(productService, allowedExtensionsService);
    this.galleryService = galleryService;
    this.telemetryService = telemetryService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.userDataProfilesService = userDataProfilesService;
    this.lastReportTimestamp = 0;
    this.installingExtensions = /* @__PURE__ */ new Map();
    this.uninstallingExtensions = /* @__PURE__ */ new Map();
    this._onInstallExtension = this._register(new Emitter());
    this._onDidInstallExtensions = this._register(new Emitter());
    this._onUninstallExtension = this._register(new Emitter());
    this._onDidUninstallExtension = this._register(new Emitter());
    this._onDidUpdateExtensionMetadata = this._register(new Emitter());
    this.participants = [];
    this._register(toDisposable(() => {
      this.installingExtensions.forEach(({ task }) => task.cancel());
      this.uninstallingExtensions.forEach((promise) => promise.cancel());
      this.installingExtensions.clear();
      this.uninstallingExtensions.clear();
    }));
  }
  get onInstallExtension() {
    return this._onInstallExtension.event;
  }
  get onDidInstallExtensions() {
    return this._onDidInstallExtensions.event;
  }
  get onUninstallExtension() {
    return this._onUninstallExtension.event;
  }
  get onDidUninstallExtension() {
    return this._onDidUninstallExtension.event;
  }
  get onDidUpdateExtensionMetadata() {
    return this._onDidUpdateExtensionMetadata.event;
  }
  async installFromGallery(extension, options = {}) {
    try {
      const results = await this.installGalleryExtensions([{ extension, options }]);
      const result = results.find(({ identifier }) => areSameExtensions(identifier, extension.identifier));
      if (result?.local) {
        return result?.local;
      }
      if (result?.error) {
        throw result.error;
      }
      throw new ExtensionManagementError(`Unknown error while installing extension ${extension.identifier.id}`, ExtensionManagementErrorCode.Unknown);
    } catch (error) {
      throw toExtensionManagementError(error);
    }
  }
  async installGalleryExtensions(extensions) {
    if (!this.galleryService.isEnabled()) {
      throw new ExtensionManagementError(nls.localize("MarketPlaceDisabled", "Marketplace is not enabled"), ExtensionManagementErrorCode.NotAllowed);
    }
    const results = [];
    const installableExtensions = [];
    await Promise.allSettled(extensions.map(async ({ extension, options }) => {
      try {
        const compatible = await this.checkAndGetCompatibleVersion(extension, !!options?.installGivenVersion, !!options?.installPreReleaseVersion, options.productVersion ?? { version: this.productService.version, date: this.productService.date });
        installableExtensions.push({ ...compatible, options });
      } catch (error) {
        results.push({ identifier: extension.identifier, operation: InstallOperation.Install, source: extension, error, profileLocation: options.profileLocation ?? this.getCurrentExtensionsManifestLocation() });
      }
    }));
    if (installableExtensions.length) {
      results.push(...await this.installExtensions(installableExtensions));
    }
    return results;
  }
  async uninstall(extension, options) {
    this.logService.trace("ExtensionManagementService#uninstall", extension.identifier.id);
    return this.uninstallExtensions([{ extension, options }]);
  }
  async toggleAppliationScope(extension, fromProfileLocation) {
    if (isApplicationScopedExtension(extension.manifest) || extension.isBuiltin) {
      return extension;
    }
    if (extension.isApplicationScoped) {
      let local = await this.updateMetadata(extension, { isApplicationScoped: false }, this.userDataProfilesService.defaultProfile.extensionsResource);
      if (!this.uriIdentityService.extUri.isEqual(fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource)) {
        local = await this.copyExtension(extension, this.userDataProfilesService.defaultProfile.extensionsResource, fromProfileLocation);
      }
      for (const profile of this.userDataProfilesService.profiles) {
        const existing = (await this.getInstalled(ExtensionType.User, profile.extensionsResource)).find((e) => areSameExtensions(e.identifier, extension.identifier));
        if (existing) {
          this._onDidUpdateExtensionMetadata.fire({ local: existing, profileLocation: profile.extensionsResource });
        } else {
          this._onDidUninstallExtension.fire({ identifier: extension.identifier, profileLocation: profile.extensionsResource });
        }
      }
      return local;
    } else {
      const local = this.uriIdentityService.extUri.isEqual(fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource) ? await this.updateMetadata(extension, { isApplicationScoped: true }, this.userDataProfilesService.defaultProfile.extensionsResource) : await this.copyExtension(extension, fromProfileLocation, this.userDataProfilesService.defaultProfile.extensionsResource, { isApplicationScoped: true });
      this._onDidInstallExtensions.fire([{ identifier: local.identifier, operation: InstallOperation.Install, local, profileLocation: this.userDataProfilesService.defaultProfile.extensionsResource, applicationScoped: true }]);
      return local;
    }
  }
  getExtensionsControlManifest() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    if (!this.extensionsControlManifest || now - this.lastReportTimestamp > 1e3 * 60 * 5) {
      this.extensionsControlManifest = this.updateControlCache();
      this.lastReportTimestamp = now;
    }
    return this.extensionsControlManifest;
  }
  registerParticipant(participant) {
    this.participants.push(participant);
  }
  async resetPinnedStateForAllUserExtensions(pinned) {
    try {
      await this.joinAllSettled(this.userDataProfilesService.profiles.map(
        async (profile) => {
          const extensions = await this.getInstalled(ExtensionType.User, profile.extensionsResource);
          await this.joinAllSettled(extensions.map(
            async (extension) => {
              if (extension.pinned !== pinned) {
                await this.updateMetadata(extension, { pinned }, profile.extensionsResource);
              }
            }
          ));
        }
      ));
    } catch (error) {
      this.logService.error("Error while resetting pinned state for all user extensions", getErrorMessage(error));
      throw error;
    }
  }
  async installExtensions(extensions) {
    const installExtensionResultsMap = /* @__PURE__ */ new Map();
    const installingExtensionsMap = /* @__PURE__ */ new Map();
    const alreadyRequestedInstallations = [];
    const getInstallExtensionTaskKey = (extension, profileLocation) => `${ExtensionKey.create(extension).toString()}-${profileLocation.toString()}`;
    const createInstallExtensionTask = (manifest, extension, options, root) => {
      if (!URI.isUri(extension)) {
        if (installingExtensionsMap.has(`${extension.identifier.id.toLowerCase()}-${options.profileLocation.toString()}`)) {
          return;
        }
        const existingInstallingExtension = this.installingExtensions.get(getInstallExtensionTaskKey(extension, options.profileLocation));
        if (existingInstallingExtension) {
          if (root && this.canWaitForTask(root, existingInstallingExtension.task)) {
            const identifier = existingInstallingExtension.task.identifier;
            this.logService.info("Waiting for already requested installing extension", identifier.id, root.identifier.id, options.profileLocation.toString());
            existingInstallingExtension.waitingTasks.push(root);
            alreadyRequestedInstallations.push(
              Event.toPromise(
                Event.filter(this.onDidInstallExtensions, (results2) => results2.some((result) => areSameExtensions(result.identifier, identifier)))
              ).then((results2) => {
                this.logService.info("Finished waiting for already requested installing extension", identifier.id, root.identifier.id, options.profileLocation.toString());
                const result = results2.find((result2) => areSameExtensions(result2.identifier, identifier));
                if (!result?.local) {
                  throw new Error(`Extension ${identifier.id} is not installed`);
                }
              })
            );
          }
          return;
        }
      }
      const installExtensionTask = this.createInstallExtensionTask(manifest, extension, options);
      const key = `${getGalleryExtensionId(manifest.publisher, manifest.name)}-${options.profileLocation.toString()}`;
      installingExtensionsMap.set(key, { task: installExtensionTask, root });
      this._onInstallExtension.fire({ identifier: installExtensionTask.identifier, source: extension, profileLocation: options.profileLocation });
      this.logService.info("Installing extension:", installExtensionTask.identifier.id, options);
      if (!URI.isUri(extension)) {
        this.installingExtensions.set(getInstallExtensionTaskKey(extension, options.profileLocation), { task: installExtensionTask, waitingTasks: [] });
      }
    };
    try {
      for (const { manifest, extension, options } of extensions) {
        const isApplicationScoped = options.isApplicationScoped || options.isBuiltin || isApplicationScopedExtension(manifest);
        const installExtensionTaskOptions = {
          ...options,
          isApplicationScoped,
          profileLocation: isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : options.profileLocation ?? this.getCurrentExtensionsManifestLocation(),
          productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date }
        };
        const existingInstallExtensionTask = !URI.isUri(extension) ? this.installingExtensions.get(getInstallExtensionTaskKey(extension, installExtensionTaskOptions.profileLocation)) : void 0;
        if (existingInstallExtensionTask) {
          this.logService.info("Extension is already requested to install", existingInstallExtensionTask.task.identifier.id, installExtensionTaskOptions.profileLocation.toString());
          alreadyRequestedInstallations.push(existingInstallExtensionTask.task.waitUntilTaskIsFinished());
        } else {
          createInstallExtensionTask(manifest, extension, installExtensionTaskOptions, void 0);
        }
      }
      await Promise.all([...installingExtensionsMap.values()].map(async ({ task }) => {
        if (task.options.donotIncludePackAndDependencies) {
          this.logService.info("Installing the extension without checking dependencies and pack", task.identifier.id);
        } else {
          try {
            const allDepsAndPackExtensionsToInstall = await this.getAllDepsAndPackExtensions(task.identifier, task.manifest, !!task.options.installPreReleaseVersion, task.options.productVersion);
            const installed = await this.getInstalled(void 0, task.options.profileLocation, task.options.productVersion);
            const options = { ...task.options, context: { ...task.options.context, [EXTENSION_INSTALL_DEP_PACK_CONTEXT]: true } };
            for (const { gallery, manifest } of distinct(allDepsAndPackExtensionsToInstall, ({ gallery: gallery2 }) => gallery2.identifier.id)) {
              const existing = installed.find((e) => areSameExtensions(e.identifier, gallery.identifier));
              if (existing && existing.isApplicationScoped === !!options.isApplicationScoped) {
                continue;
              }
              createInstallExtensionTask(manifest, gallery, options, task);
            }
          } catch (error) {
            if (URI.isUri(task.source)) {
              if (isNonEmptyArray(task.manifest.extensionDependencies)) {
                this.logService.warn(`Cannot install dependencies of extension:`, task.identifier.id, error.message);
              }
              if (isNonEmptyArray(task.manifest.extensionPack)) {
                this.logService.warn(`Cannot install packed extensions of extension:`, task.identifier.id, error.message);
              }
            } else {
              this.logService.error("Error while preparing to install dependencies and extension packs of the extension:", task.identifier.id);
              throw error;
            }
          }
        }
      }));
      const otherProfilesToUpdate = await this.getOtherProfilesToUpdateExtension([...installingExtensionsMap.values()].map(({ task }) => task));
      for (const [profileLocation, task] of otherProfilesToUpdate) {
        createInstallExtensionTask(task.manifest, task.source, { ...task.options, profileLocation }, void 0);
      }
      await this.joinAllSettled([...installingExtensionsMap.entries()].map(async ([key, { task }]) => {
        const startTime = (/* @__PURE__ */ new Date()).getTime();
        let local;
        try {
          local = await task.run();
          await this.joinAllSettled(this.participants.map((participant) => participant.postInstall(local, task.source, task.options, CancellationToken.None)), ExtensionManagementErrorCode.PostInstall);
        } catch (e) {
          const error = toExtensionManagementError(e);
          if (!URI.isUri(task.source)) {
            reportTelemetry(this.telemetryService, task.operation === InstallOperation.Update ? "extensionGallery:update" : "extensionGallery:install", {
              extensionData: getGalleryExtensionTelemetryData(task.source),
              error,
              source: task.options.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT]
            });
          }
          installExtensionResultsMap.set(key, { error, identifier: task.identifier, operation: task.operation, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, applicationScoped: task.options.isApplicationScoped });
          this.logService.error("Error while installing the extension", task.identifier.id, getErrorMessage(error), task.options.profileLocation.toString());
          throw error;
        }
        if (!URI.isUri(task.source)) {
          const isUpdate = task.operation === InstallOperation.Update;
          const durationSinceUpdate = isUpdate ? void 0 : ((/* @__PURE__ */ new Date()).getTime() - task.source.lastUpdated) / 1e3;
          reportTelemetry(this.telemetryService, isUpdate ? "extensionGallery:update" : "extensionGallery:install", {
            extensionData: getGalleryExtensionTelemetryData(task.source),
            verificationStatus: task.verificationStatus,
            duration: (/* @__PURE__ */ new Date()).getTime() - startTime,
            durationSinceUpdate,
            source: task.options.context?.[EXTENSION_INSTALL_SOURCE_CONTEXT]
          });
          if (isWeb && task.operation !== InstallOperation.Update) {
            try {
              await this.galleryService.reportStatistic(local.manifest.publisher, local.manifest.name, local.manifest.version, StatisticType.Install);
            } catch (error) {
            }
          }
        }
        installExtensionResultsMap.set(key, { local, identifier: task.identifier, operation: task.operation, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, applicationScoped: local.isApplicationScoped });
      }));
      if (alreadyRequestedInstallations.length) {
        await this.joinAllSettled(alreadyRequestedInstallations);
      }
    } catch (error) {
      const getAllDepsAndPacks = (extension, profileLocation, allDepsOrPacks) => {
        const depsOrPacks = [];
        if (extension.manifest.extensionDependencies?.length) {
          depsOrPacks.push(...extension.manifest.extensionDependencies);
        }
        if (extension.manifest.extensionPack?.length) {
          depsOrPacks.push(...extension.manifest.extensionPack);
        }
        for (const id of depsOrPacks) {
          if (allDepsOrPacks.includes(id.toLowerCase())) {
            continue;
          }
          allDepsOrPacks.push(id.toLowerCase());
          const installed = installExtensionResultsMap.get(`${id.toLowerCase()}-${profileLocation.toString()}`);
          if (installed?.local) {
            allDepsOrPacks = getAllDepsAndPacks(installed.local, profileLocation, allDepsOrPacks);
          }
        }
        return allDepsOrPacks;
      };
      const getErrorResult = (task) => ({ identifier: task.identifier, operation: InstallOperation.Install, source: task.source, context: task.options.context, profileLocation: task.options.profileLocation, error });
      const rollbackTasks = [];
      for (const [key, { task, root }] of installingExtensionsMap) {
        const result = installExtensionResultsMap.get(key);
        if (!result) {
          task.cancel();
          installExtensionResultsMap.set(key, getErrorResult(task));
        } else if (result.local && root && !installExtensionResultsMap.get(`${root.identifier.id.toLowerCase()}-${task.options.profileLocation.toString()}`)?.local) {
          rollbackTasks.push(this.createUninstallExtensionTask(result.local, { versionOnly: true, profileLocation: task.options.profileLocation }));
          installExtensionResultsMap.set(key, getErrorResult(task));
        }
      }
      for (const [key, { task }] of installingExtensionsMap) {
        const result = installExtensionResultsMap.get(key);
        if (!result?.local) {
          continue;
        }
        if (task.options.donotIncludePackAndDependencies) {
          continue;
        }
        const depsOrPacks = getAllDepsAndPacks(result.local, task.options.profileLocation, [result.local.identifier.id.toLowerCase()]).slice(1);
        if (depsOrPacks.some((depOrPack) => installingExtensionsMap.has(`${depOrPack.toLowerCase()}-${task.options.profileLocation.toString()}`) && !installExtensionResultsMap.get(`${depOrPack.toLowerCase()}-${task.options.profileLocation.toString()}`)?.local)) {
          rollbackTasks.push(this.createUninstallExtensionTask(result.local, { versionOnly: true, profileLocation: task.options.profileLocation }));
          installExtensionResultsMap.set(key, getErrorResult(task));
        }
      }
      if (rollbackTasks.length) {
        await Promise.allSettled(rollbackTasks.map(async (rollbackTask) => {
          try {
            await rollbackTask.run();
            this.logService.info("Rollback: Uninstalled extension", rollbackTask.extension.identifier.id);
          } catch (error2) {
            this.logService.warn("Rollback: Error while uninstalling extension", rollbackTask.extension.identifier.id, getErrorMessage(error2));
          }
        }));
      }
    } finally {
      for (const { task } of installingExtensionsMap.values()) {
        if (task.source && !URI.isUri(task.source)) {
          this.installingExtensions.delete(getInstallExtensionTaskKey(task.source, task.options.profileLocation));
        }
      }
    }
    const results = [...installExtensionResultsMap.values()];
    for (const result of results) {
      if (result.local) {
        this.logService.info(`Extension installed successfully:`, result.identifier.id, result.profileLocation.toString());
      }
    }
    this._onDidInstallExtensions.fire(results);
    return results;
  }
  async getOtherProfilesToUpdateExtension(tasks) {
    const otherProfilesToUpdate = [];
    const profileExtensionsCache = new ResourceMap();
    for (const task of tasks) {
      if (task.operation !== InstallOperation.Update || task.options.isApplicationScoped || task.options.pinned || task.options.installGivenVersion || URI.isUri(task.source)) {
        continue;
      }
      for (const profile of this.userDataProfilesService.profiles) {
        if (this.uriIdentityService.extUri.isEqual(profile.extensionsResource, task.options.profileLocation)) {
          continue;
        }
        let installedExtensions = profileExtensionsCache.get(profile.extensionsResource);
        if (!installedExtensions) {
          installedExtensions = await this.getInstalled(ExtensionType.User, profile.extensionsResource);
          profileExtensionsCache.set(profile.extensionsResource, installedExtensions);
        }
        const installedExtension = installedExtensions.find((e) => areSameExtensions(e.identifier, task.identifier));
        if (installedExtension && !installedExtension.pinned) {
          otherProfilesToUpdate.push([profile.extensionsResource, task]);
        }
      }
    }
    return otherProfilesToUpdate;
  }
  canWaitForTask(taskToWait, taskToWaitFor) {
    for (const [, { task, waitingTasks }] of this.installingExtensions.entries()) {
      if (task === taskToWait) {
        if (waitingTasks.includes(taskToWaitFor)) {
          return false;
        }
        if (waitingTasks.some((waitingTask) => this.canWaitForTask(waitingTask, taskToWaitFor))) {
          return false;
        }
      }
      if (task === taskToWaitFor && waitingTasks[0] && !this.canWaitForTask(taskToWait, waitingTasks[0])) {
        return false;
      }
    }
    return true;
  }
  async joinAllSettled(promises, errorCode) {
    const results = [];
    const errors = [];
    const promiseResults = await Promise.allSettled(promises);
    for (const r of promiseResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        errors.push(toExtensionManagementError(r.reason, errorCode));
      }
    }
    if (!errors.length) {
      return results;
    }
    if (errors.length === 1) {
      throw errors[0];
    }
    let error = new ExtensionManagementError("", ExtensionManagementErrorCode.Unknown);
    for (const current of errors) {
      error = new ExtensionManagementError(
        error.message ? `${error.message}, ${current.message}` : current.message,
        current.code !== ExtensionManagementErrorCode.Unknown && current.code !== ExtensionManagementErrorCode.Internal ? current.code : error.code
      );
    }
    throw error;
  }
  async getAllDepsAndPackExtensions(extensionIdentifier, manifest, installPreRelease, productVersion) {
    if (!this.galleryService.isEnabled()) {
      return [];
    }
    const knownIdentifiers = [];
    const allDependenciesAndPacks = [];
    const collectDependenciesAndPackExtensionsToInstall = async (extensionIdentifier2, manifest2) => {
      knownIdentifiers.push(extensionIdentifier2);
      const dependecies = manifest2.extensionDependencies || [];
      const dependenciesAndPackExtensions = [...dependecies];
      if (manifest2.extensionPack) {
        for (const extension of manifest2.extensionPack) {
          if (dependenciesAndPackExtensions.every((e) => !areSameExtensions({ id: e }, { id: extension }))) {
            dependenciesAndPackExtensions.push(extension);
          }
        }
      }
      if (dependenciesAndPackExtensions.length) {
        const ids = dependenciesAndPackExtensions.filter((id) => knownIdentifiers.every((galleryIdentifier) => !areSameExtensions(galleryIdentifier, { id })));
        if (ids.length) {
          const galleryExtensions = await this.galleryService.getExtensions(ids.map((id) => ({ id, preRelease: installPreRelease })), CancellationToken.None);
          for (const galleryExtension of galleryExtensions) {
            if (knownIdentifiers.find((identifier) => areSameExtensions(identifier, galleryExtension.identifier))) {
              continue;
            }
            const isDependency = dependecies.some((id) => areSameExtensions({ id }, galleryExtension.identifier));
            let compatible;
            try {
              compatible = await this.checkAndGetCompatibleVersion(galleryExtension, false, installPreRelease, productVersion);
            } catch (error) {
              if (!isDependency) {
                this.logService.info("Skipping the packed extension as it cannot be installed", galleryExtension.identifier.id, getErrorMessage(error));
                continue;
              } else {
                throw error;
              }
            }
            allDependenciesAndPacks.push({ gallery: compatible.extension, manifest: compatible.manifest });
            await collectDependenciesAndPackExtensionsToInstall(compatible.extension.identifier, compatible.manifest);
          }
        }
      }
    };
    await collectDependenciesAndPackExtensionsToInstall(extensionIdentifier, manifest);
    return allDependenciesAndPacks;
  }
  async checkAndGetCompatibleVersion(extension, sameVersion, installPreRelease, productVersion) {
    let compatibleExtension;
    const extensionsControlManifest = await this.getExtensionsControlManifest();
    if (isMalicious(extension.identifier, extensionsControlManifest.malicious)) {
      throw new ExtensionManagementError(nls.localize("malicious extension", "Can't install '{0}' extension since it was reported to be problematic.", extension.identifier.id), ExtensionManagementErrorCode.Malicious);
    }
    const deprecationInfo = extensionsControlManifest.deprecated[extension.identifier.id.toLowerCase()];
    if (deprecationInfo?.extension?.autoMigrate) {
      this.logService.info(`The '${extension.identifier.id}' extension is deprecated, fetching the compatible '${deprecationInfo.extension.id}' extension instead.`);
      compatibleExtension = (await this.galleryService.getExtensions([{ id: deprecationInfo.extension.id, preRelease: deprecationInfo.extension.preRelease }], { targetPlatform: await this.getTargetPlatform(), compatible: true, productVersion }, CancellationToken.None))[0];
      if (!compatibleExtension) {
        throw new ExtensionManagementError(nls.localize("notFoundDeprecatedReplacementExtension", "Can't install '{0}' extension since it was deprecated and the replacement extension '{1}' can't be found.", extension.identifier.id, deprecationInfo.extension.id), ExtensionManagementErrorCode.Deprecated);
      }
    } else {
      if (await this.canInstall(extension) !== true) {
        const targetPlatform = await this.getTargetPlatform();
        throw new ExtensionManagementError(nls.localize("incompatible platform", "The '{0}' extension is not available in {1} for the {2}.", extension.identifier.id, this.productService.nameLong, TargetPlatformToString(targetPlatform)), ExtensionManagementErrorCode.IncompatibleTargetPlatform);
      }
      compatibleExtension = await this.getCompatibleVersion(extension, sameVersion, installPreRelease, productVersion);
      if (!compatibleExtension) {
        const incompatibleApiProposalsMessages = [];
        if (!areApiProposalsCompatible(extension.properties.enabledApiProposals ?? [], incompatibleApiProposalsMessages)) {
          throw new ExtensionManagementError(nls.localize("incompatibleAPI", "Can't install '{0}' extension. {1}", extension.displayName ?? extension.identifier.id, incompatibleApiProposalsMessages[0]), ExtensionManagementErrorCode.IncompatibleApi);
        }
        if (!installPreRelease && extension.properties.isPreReleaseVersion && (await this.galleryService.getExtensions([extension.identifier], CancellationToken.None))[0]) {
          throw new ExtensionManagementError(nls.localize("notFoundReleaseExtension", "Can't install release version of '{0}' extension because it has no release version.", extension.displayName ?? extension.identifier.id), ExtensionManagementErrorCode.ReleaseVersionNotFound);
        }
        throw new ExtensionManagementError(nls.localize("notFoundCompatibleDependency", "Can't install '{0}' extension because it is not compatible with the current version of {1} (version {2}).", extension.identifier.id, this.productService.nameLong, this.productService.version), ExtensionManagementErrorCode.Incompatible);
      }
    }
    this.logService.info("Getting Manifest...", compatibleExtension.identifier.id);
    const manifest = await this.galleryService.getManifest(compatibleExtension, CancellationToken.None);
    if (manifest === null) {
      throw new ExtensionManagementError(`Missing manifest for extension ${compatibleExtension.identifier.id}`, ExtensionManagementErrorCode.Invalid);
    }
    if (manifest.version !== compatibleExtension.version) {
      throw new ExtensionManagementError(`Cannot install '${compatibleExtension.identifier.id}' extension because of version mismatch in Marketplace`, ExtensionManagementErrorCode.Invalid);
    }
    return { extension: compatibleExtension, manifest };
  }
  async getCompatibleVersion(extension, sameVersion, includePreRelease, productVersion) {
    const targetPlatform = await this.getTargetPlatform();
    let compatibleExtension = null;
    if (!sameVersion && extension.hasPreReleaseVersion && extension.properties.isPreReleaseVersion !== includePreRelease) {
      compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, preRelease: includePreRelease }], { targetPlatform, compatible: true, productVersion }, CancellationToken.None))[0] || null;
    }
    if (!compatibleExtension && await this.galleryService.isExtensionCompatible(extension, includePreRelease, targetPlatform, productVersion)) {
      compatibleExtension = extension;
    }
    if (!compatibleExtension) {
      if (sameVersion) {
        compatibleExtension = (await this.galleryService.getExtensions([{ ...extension.identifier, version: extension.version }], { targetPlatform, compatible: true, productVersion }, CancellationToken.None))[0] || null;
      } else {
        compatibleExtension = await this.galleryService.getCompatibleExtension(extension, includePreRelease, targetPlatform, productVersion);
      }
    }
    return compatibleExtension;
  }
  async uninstallExtensions(extensions) {
    const getUninstallExtensionTaskKey = (extension, uninstallOptions) => `${extension.identifier.id.toLowerCase()}${uninstallOptions.versionOnly ? `-${extension.manifest.version}` : ""}@${uninstallOptions.profileLocation.toString()}`;
    const createUninstallExtensionTask = (extension, uninstallOptions) => {
      const uninstallExtensionTask = this.createUninstallExtensionTask(extension, uninstallOptions);
      this.uninstallingExtensions.set(getUninstallExtensionTaskKey(uninstallExtensionTask.extension, uninstallOptions), uninstallExtensionTask);
      this.logService.info("Uninstalling extension from the profile:", `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString());
      this._onUninstallExtension.fire({ identifier: extension.identifier, profileLocation: uninstallOptions.profileLocation, applicationScoped: extension.isApplicationScoped });
      return uninstallExtensionTask;
    };
    const postUninstallExtension = (extension, uninstallOptions, error) => {
      if (error) {
        this.logService.error("Failed to uninstall extension from the profile:", `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString(), error.message);
      } else {
        this.logService.info("Successfully uninstalled extension from the profile", `${extension.identifier.id}@${extension.manifest.version}`, uninstallOptions.profileLocation.toString());
      }
      reportTelemetry(this.telemetryService, "extensionGallery:uninstall", { extensionData: getLocalExtensionTelemetryData(extension), error });
      this._onDidUninstallExtension.fire({ identifier: extension.identifier, error: error?.code, profileLocation: uninstallOptions.profileLocation, applicationScoped: extension.isApplicationScoped });
    };
    const allTasks = [];
    const processedTasks = [];
    const alreadyRequestedUninstalls = [];
    const extensionsToRemove = [];
    const installedExtensionsMap = new ResourceMap();
    const getInstalledExtensions = async (profileLocation) => {
      let installed = installedExtensionsMap.get(profileLocation);
      if (!installed) {
        installedExtensionsMap.set(profileLocation, installed = await this.getInstalled(ExtensionType.User, profileLocation));
      }
      return installed;
    };
    for (const { extension, options } of extensions) {
      const uninstallOptions = {
        ...options,
        profileLocation: extension.isApplicationScoped ? this.userDataProfilesService.defaultProfile.extensionsResource : options?.profileLocation ?? this.getCurrentExtensionsManifestLocation()
      };
      const uninstallExtensionTask = this.uninstallingExtensions.get(getUninstallExtensionTaskKey(extension, uninstallOptions));
      if (uninstallExtensionTask) {
        this.logService.info("Extensions is already requested to uninstall", extension.identifier.id);
        alreadyRequestedUninstalls.push(uninstallExtensionTask.waitUntilTaskIsFinished());
      } else {
        allTasks.push(createUninstallExtensionTask(extension, uninstallOptions));
      }
      if (uninstallOptions.remove) {
        extensionsToRemove.push(extension);
        for (const profile of this.userDataProfilesService.profiles) {
          if (this.uriIdentityService.extUri.isEqual(profile.extensionsResource, uninstallOptions.profileLocation)) {
            continue;
          }
          const installed = await getInstalledExtensions(profile.extensionsResource);
          const profileExtension = installed.find((e) => areSameExtensions(e.identifier, extension.identifier));
          if (profileExtension) {
            const uninstallOptionsWithProfile = { ...uninstallOptions, profileLocation: profile.extensionsResource };
            const uninstallExtensionTask2 = this.uninstallingExtensions.get(getUninstallExtensionTaskKey(profileExtension, uninstallOptionsWithProfile));
            if (uninstallExtensionTask2) {
              this.logService.info("Extensions is already requested to uninstall", profileExtension.identifier.id);
              alreadyRequestedUninstalls.push(uninstallExtensionTask2.waitUntilTaskIsFinished());
            } else {
              allTasks.push(createUninstallExtensionTask(profileExtension, uninstallOptionsWithProfile));
            }
          }
        }
      }
    }
    try {
      for (const task of allTasks.slice(0)) {
        const installed = await getInstalledExtensions(task.options.profileLocation);
        if (task.options.donotIncludePack) {
          this.logService.info("Uninstalling the extension without including packed extension", `${task.extension.identifier.id}@${task.extension.manifest.version}`);
        } else {
          const packedExtensions = this.getAllPackExtensionsToUninstall(task.extension, installed);
          for (const packedExtension of packedExtensions) {
            if (this.uninstallingExtensions.has(getUninstallExtensionTaskKey(packedExtension, task.options))) {
              this.logService.info("Extensions is already requested to uninstall", packedExtension.identifier.id);
            } else {
              allTasks.push(createUninstallExtensionTask(packedExtension, task.options));
            }
          }
        }
        if (task.options.donotCheckDependents) {
          this.logService.info("Uninstalling the extension without checking dependents", `${task.extension.identifier.id}@${task.extension.manifest.version}`);
        } else {
          this.checkForDependents(allTasks.map((task2) => task2.extension), installed, task.extension);
        }
      }
      await this.joinAllSettled(allTasks.map(async (task) => {
        try {
          await task.run();
          await this.joinAllSettled(this.participants.map((participant) => participant.postUninstall(task.extension, task.options, CancellationToken.None)));
          if (task.extension.identifier.uuid) {
            try {
              await this.galleryService.reportStatistic(task.extension.manifest.publisher, task.extension.manifest.name, task.extension.manifest.version, StatisticType.Uninstall);
            } catch (error) {
            }
          }
        } catch (e) {
          const error = toExtensionManagementError(e);
          postUninstallExtension(task.extension, task.options, error);
          throw error;
        } finally {
          processedTasks.push(task);
        }
      }));
      if (alreadyRequestedUninstalls.length) {
        await this.joinAllSettled(alreadyRequestedUninstalls);
      }
      for (const task of allTasks) {
        postUninstallExtension(task.extension, task.options);
      }
      if (extensionsToRemove.length) {
        await this.joinAllSettled(extensionsToRemove.map((extension) => this.removeExtension(extension)));
      }
    } catch (e) {
      const error = toExtensionManagementError(e);
      for (const task of allTasks) {
        try {
          task.cancel();
        } catch (error2) {
        }
        if (!processedTasks.includes(task)) {
          postUninstallExtension(task.extension, task.options, error);
        }
      }
      throw error;
    } finally {
      for (const task of allTasks) {
        if (!this.uninstallingExtensions.delete(getUninstallExtensionTaskKey(task.extension, task.options))) {
          this.logService.warn("Uninstallation task is not found in the cache", task.extension.identifier.id);
        }
      }
    }
  }
  checkForDependents(extensionsToUninstall, installed, extensionToUninstall) {
    for (const extension of extensionsToUninstall) {
      const dependents = this.getDependents(extension, installed);
      if (dependents.length) {
        const remainingDependents = dependents.filter((dependent) => !extensionsToUninstall.some((e) => areSameExtensions(e.identifier, dependent.identifier)));
        if (remainingDependents.length) {
          throw new Error(this.getDependentsErrorMessage(extension, remainingDependents, extensionToUninstall));
        }
      }
    }
  }
  getDependentsErrorMessage(dependingExtension, dependents, extensionToUninstall) {
    if (extensionToUninstall === dependingExtension) {
      if (dependents.length === 1) {
        return nls.localize(
          "singleDependentError",
          "Cannot uninstall '{0}' extension. '{1}' extension depends on this.",
          extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
          dependents[0].manifest.displayName || dependents[0].manifest.name
        );
      }
      if (dependents.length === 2) {
        return nls.localize(
          "twoDependentsError",
          "Cannot uninstall '{0}' extension. '{1}' and '{2}' extensions depend on this.",
          extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
          dependents[0].manifest.displayName || dependents[0].manifest.name,
          dependents[1].manifest.displayName || dependents[1].manifest.name
        );
      }
      return nls.localize(
        "multipleDependentsError",
        "Cannot uninstall '{0}' extension. '{1}', '{2}' and other extension depend on this.",
        extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
        dependents[0].manifest.displayName || dependents[0].manifest.name,
        dependents[1].manifest.displayName || dependents[1].manifest.name
      );
    }
    if (dependents.length === 1) {
      return nls.localize(
        "singleIndirectDependentError",
        "Cannot uninstall '{0}' extension . It includes uninstalling '{1}' extension and '{2}' extension depends on this.",
        extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
        dependingExtension.manifest.displayName || dependingExtension.manifest.name,
        dependents[0].manifest.displayName || dependents[0].manifest.name
      );
    }
    if (dependents.length === 2) {
      return nls.localize(
        "twoIndirectDependentsError",
        "Cannot uninstall '{0}' extension. It includes uninstalling '{1}' extension and '{2}' and '{3}' extensions depend on this.",
        extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
        dependingExtension.manifest.displayName || dependingExtension.manifest.name,
        dependents[0].manifest.displayName || dependents[0].manifest.name,
        dependents[1].manifest.displayName || dependents[1].manifest.name
      );
    }
    return nls.localize(
      "multipleIndirectDependentsError",
      "Cannot uninstall '{0}' extension. It includes uninstalling '{1}' extension and '{2}', '{3}' and other extensions depend on this.",
      extensionToUninstall.manifest.displayName || extensionToUninstall.manifest.name,
      dependingExtension.manifest.displayName || dependingExtension.manifest.name,
      dependents[0].manifest.displayName || dependents[0].manifest.name,
      dependents[1].manifest.displayName || dependents[1].manifest.name
    );
  }
  getAllPackExtensionsToUninstall(extension, installed, checked = []) {
    if (checked.indexOf(extension) !== -1) {
      return [];
    }
    checked.push(extension);
    const extensionsPack = extension.manifest.extensionPack ? extension.manifest.extensionPack : [];
    if (extensionsPack.length) {
      const packedExtensions = installed.filter((i) => !i.isBuiltin && extensionsPack.some((id) => areSameExtensions({ id }, i.identifier)));
      const packOfPackedExtensions = [];
      for (const packedExtension of packedExtensions) {
        packOfPackedExtensions.push(...this.getAllPackExtensionsToUninstall(packedExtension, installed, checked));
      }
      return [...packedExtensions, ...packOfPackedExtensions];
    }
    return [];
  }
  getDependents(extension, installed) {
    return installed.filter((e) => e.manifest.extensionDependencies && e.manifest.extensionDependencies.some((id) => areSameExtensions({ id }, extension.identifier)));
  }
  async updateControlCache() {
    try {
      this.logService.trace("ExtensionManagementService.updateControlCache");
      return await this.galleryService.getExtensionsControlManifest();
    } catch (err) {
      this.logService.trace("ExtensionManagementService.refreshControlCache - failed to get extension control manifest", getErrorMessage(err));
      return { malicious: [], deprecated: {}, search: [] };
    }
  }
};
AbstractExtensionManagementService = __decorateClass([
  __decorateParam(0, IExtensionGalleryService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IAllowedExtensionsService),
  __decorateParam(6, IUserDataProfilesService)
], AbstractExtensionManagementService);
function toExtensionManagementError(error, code) {
  if (error instanceof ExtensionManagementError) {
    return error;
  }
  let extensionManagementError;
  if (error instanceof ExtensionGalleryError) {
    extensionManagementError = new ExtensionManagementError(error.message, error.code === ExtensionGalleryErrorCode.DownloadFailedWriting ? ExtensionManagementErrorCode.DownloadFailedWriting : ExtensionManagementErrorCode.Gallery);
  } else {
    extensionManagementError = new ExtensionManagementError(error.message, isCancellationError(error) ? ExtensionManagementErrorCode.Cancelled : code ?? ExtensionManagementErrorCode.Internal);
  }
  extensionManagementError.stack = error.stack;
  return extensionManagementError;
}
function reportTelemetry(telemetryService, eventName, {
  extensionData,
  verificationStatus,
  duration,
  error,
  source,
  durationSinceUpdate
}) {
  telemetryService.publicLog(eventName, {
    ...extensionData,
    source,
    duration,
    durationSinceUpdate,
    success: !error,
    errorcode: error?.code,
    verificationStatus: verificationStatus === ExtensionSignatureVerificationCode.Success ? "Verified" : verificationStatus ?? "Unverified"
  });
}
class AbstractExtensionTask {
  constructor() {
    this.barrier = new Barrier();
  }
  async waitUntilTaskIsFinished() {
    await this.barrier.wait();
    return this.cancellablePromise;
  }
  run() {
    if (!this.cancellablePromise) {
      this.cancellablePromise = createCancelablePromise((token) => this.doRun(token));
    }
    this.barrier.open();
    return this.cancellablePromise;
  }
  cancel() {
    if (!this.cancellablePromise) {
      this.cancellablePromise = createCancelablePromise((token) => {
        return new Promise((c, e) => {
          const disposable = token.onCancellationRequested(() => {
            disposable.dispose();
            e(new CancellationError());
          });
        });
      });
      this.barrier.open();
    }
    this.cancellablePromise.cancel();
  }
}
export {
  AbstractExtensionManagementService,
  AbstractExtensionTask,
  CommontExtensionManagementService,
  toExtensionManagementError
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9hYnN0cmFjdEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGlzdGluY3QsIGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBCYXJyaWVyLCBDYW5jZWxhYmxlUHJvbWlzZSwgY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciwgZ2V0RXJyb3JNZXNzYWdlLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHtcblx0RXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yLCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFBhcnRpY2lwYW50LCBJR2FsbGVyeUV4dGVuc2lvbiwgSUxvY2FsRXh0ZW5zaW9uLCBJbnN0YWxsT3BlcmF0aW9uLFxuXHRJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCwgU3RhdGlzdGljVHlwZSwgaXNUYXJnZXRQbGF0Zm9ybUNvbXBhdGlibGUsIFRhcmdldFBsYXRmb3JtVG9TdHJpbmcsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUsXG5cdEluc3RhbGxPcHRpb25zLCBVbmluc3RhbGxPcHRpb25zLCBNZXRhZGF0YSwgSW5zdGFsbEV4dGVuc2lvbkV2ZW50LCBEaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudCwgSW5zdGFsbEV4dGVuc2lvblJlc3VsdCwgVW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSW5zdGFsbEV4dGVuc2lvbkluZm8sIEVYVEVOU0lPTl9JTlNUQUxMX0RFUF9QQUNLX0NPTlRFWFQsIEV4dGVuc2lvbkdhbGxlcnlFcnJvcixcblx0SVByb2R1Y3RWZXJzaW9uLCBFeHRlbnNpb25HYWxsZXJ5RXJyb3JDb2RlLFxuXHRFWFRFTlNJT05fSU5TVEFMTF9TT1VSQ0VfQ09OVEVYVCxcblx0RGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEsXG5cdFVuaW5zdGFsbEV4dGVuc2lvbkluZm8sXG5cdEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGUsXG5cdElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2Vcbn0gZnJvbSAnLi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zLCBFeHRlbnNpb25LZXksIGdldEdhbGxlcnlFeHRlbnNpb25JZCwgZ2V0R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGEsIGdldExvY2FsRXh0ZW5zaW9uVGVsZW1ldHJ5RGF0YSwgaXNNYWxpY2lvdXMgfSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIElFeHRlbnNpb25NYW5pZmVzdCwgaXNBcHBsaWNhdGlvblNjb3BlZEV4dGVuc2lvbiwgVGFyZ2V0UGxhdGZvcm0gfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25WYWxpZGF0b3IuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcblxuZXhwb3J0IHR5cGUgSW5zdGFsbGFibGVFeHRlbnNpb24gPSB7IHJlYWRvbmx5IG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3Q7IGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24gfCBVUkk7IG9wdGlvbnM6IEluc3RhbGxPcHRpb25zIH07XG5cbmV4cG9ydCB0eXBlIEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyA9IEluc3RhbGxPcHRpb25zICYgeyByZWFkb25seSBwcm9maWxlTG9jYXRpb246IFVSSTsgcmVhZG9ubHkgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbiB9O1xuZXhwb3J0IGludGVyZmFjZSBJSW5zdGFsbEV4dGVuc2lvblRhc2sge1xuXHRyZWFkb25seSBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0O1xuXHRyZWFkb25seSBpZGVudGlmaWVyOiBJRXh0ZW5zaW9uSWRlbnRpZmllcjtcblx0cmVhZG9ubHkgc291cmNlOiBJR2FsbGVyeUV4dGVuc2lvbiB8IFVSSTtcblx0cmVhZG9ubHkgb3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uO1xuXHRyZWFkb25seSBvcHRpb25zOiBJbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnM7XG5cdHJlYWRvbmx5IHZlcmlmaWNhdGlvblN0YXR1cz86IEV4dGVuc2lvblNpZ25hdHVyZVZlcmlmaWNhdGlvbkNvZGU7XG5cdHJ1bigpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj47XG5cdHdhaXRVbnRpbFRhc2tJc0ZpbmlzaGVkKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPjtcblx0Y2FuY2VsKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCB0eXBlIFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zID0gVW5pbnN0YWxsT3B0aW9ucyAmIHsgcmVhZG9ubHkgcHJvZmlsZUxvY2F0aW9uOiBVUkkgfTtcbmV4cG9ydCBpbnRlcmZhY2UgSVVuaW5zdGFsbEV4dGVuc2lvblRhc2sge1xuXHRyZWFkb25seSBvcHRpb25zOiBVbmluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb247XG5cdHJ1bigpOiBQcm9taXNlPHZvaWQ+O1xuXHR3YWl0VW50aWxUYXNrSXNGaW5pc2hlZCgpOiBQcm9taXNlPHZvaWQ+O1xuXHRjYW5jZWwoKTogdm9pZDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENvbW1vbnRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2U6IElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRhc3luYyBjYW5JbnN0YWxsKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24pOiBQcm9taXNlPHRydWUgfCBJTWFya2Rvd25TdHJpbmc+IHtcblx0XHRjb25zdCBhbGxvd2VkVG9JbnN0YWxsID0gdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHsgaWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lIH0pO1xuXHRcdGlmIChhbGxvd2VkVG9JbnN0YWxsICE9PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKG5scy5sb2NhbGl6ZSgnbm90IGFsbG93ZWQgdG8gaW5zdGFsbCcsIFwiVGhpcyBleHRlbnNpb24gY2Fubm90IGJlIGluc3RhbGxlZCBiZWNhdXNlIHswfVwiLCBhbGxvd2VkVG9JbnN0YWxsLnZhbHVlKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCEoYXdhaXQgdGhpcy5pc0V4dGVuc2lvblBsYXRmb3JtQ29tcGF0aWJsZShleHRlbnNpb24pKSkge1xuXHRcdFx0Y29uc3QgbGVhcm5MaW5rID0gaXNXZWIgPyAnaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXdlYi1leHRlbnNpb25zLWd1aWRlJyA6ICdodHRwczovL2FrYS5tcy92c2NvZGUtcGxhdGZvcm0tc3BlY2lmaWMtZXh0ZW5zaW9ucyc7XG5cdFx0XHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKGAke25scy5sb2NhbGl6ZSgnaW5jb21wYXRpYmxlIHBsYXRmb3JtJywgXCJUaGUgJ3swfScgZXh0ZW5zaW9uIGlzIG5vdCBhdmFpbGFibGUgaW4gezF9IGZvciB0aGUgezJ9LlwiLFxuXHRcdFx0XHRleHRlbnNpb24uZGlzcGxheU5hbWUgPz8gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcsIFRhcmdldFBsYXRmb3JtVG9TdHJpbmcoYXdhaXQgdGhpcy5nZXRUYXJnZXRQbGF0Zm9ybSgpKSl9IFske25scy5sb2NhbGl6ZSgnbGVhcm4gd2h5JywgXCJMZWFybiBXaHlcIil9XSgke2xlYXJuTGlua30pYCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgaXNFeHRlbnNpb25QbGF0Zm9ybUNvbXBhdGlibGUoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IGN1cnJlbnRUYXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZ2V0VGFyZ2V0UGxhdGZvcm0oKTtcblx0XHRyZXR1cm4gZXh0ZW5zaW9uLmFsbFRhcmdldFBsYXRmb3Jtcy5zb21lKHRhcmdldFBsYXRmb3JtID0+IGlzVGFyZ2V0UGxhdGZvcm1Db21wYXRpYmxlKHRhcmdldFBsYXRmb3JtLCBleHRlbnNpb24uYWxsVGFyZ2V0UGxhdGZvcm1zLCBjdXJyZW50VGFyZ2V0UGxhdGZvcm0pKTtcblx0fVxuXG5cdGFic3RyYWN0IHJlYWRvbmx5IG9uSW5zdGFsbEV4dGVuc2lvbjogRXZlbnQ8SW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0YWJzdHJhY3QgcmVhZG9ubHkgb25EaWRJbnN0YWxsRXh0ZW5zaW9uczogRXZlbnQ8cmVhZG9ubHkgSW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPjtcblx0YWJzdHJhY3QgcmVhZG9ubHkgb25Vbmluc3RhbGxFeHRlbnNpb246IEV2ZW50PFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0YWJzdHJhY3QgcmVhZG9ubHkgb25EaWRVbmluc3RhbGxFeHRlbnNpb246IEV2ZW50PERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0YWJzdHJhY3QgcmVhZG9ubHkgb25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YTogRXZlbnQ8RGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGE+O1xuXHRhYnN0cmFjdCBpbnN0YWxsRnJvbUdhbGxlcnkoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgb3B0aW9ucz86IEluc3RhbGxPcHRpb25zKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+O1xuXHRhYnN0cmFjdCBpbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSk6IFByb21pc2U8SW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPjtcblx0YWJzdHJhY3QgdW5pbnN0YWxsKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBvcHRpb25zPzogVW5pbnN0YWxsT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdGFic3RyYWN0IHVuaW5zdGFsbEV4dGVuc2lvbnMoZXh0ZW5zaW9uczogVW5pbnN0YWxsRXh0ZW5zaW9uSW5mb1tdKTogUHJvbWlzZTx2b2lkPjtcblx0YWJzdHJhY3QgdG9nZ2xlQXBwbGlhdGlvblNjb3BlKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj47XG5cdGFic3RyYWN0IGdldEV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QoKTogUHJvbWlzZTxJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdD47XG5cdGFic3RyYWN0IHJlc2V0UGlubmVkU3RhdGVGb3JBbGxVc2VyRXh0ZW5zaW9ucyhwaW5uZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xuXHRhYnN0cmFjdCByZWdpc3RlclBhcnRpY2lwYW50KHBhcml0aWNpcGFudDogSUV4dGVuc2lvbk1hbmFnZW1lbnRQYXJ0aWNpcGFudCk6IHZvaWQ7XG5cdGFic3RyYWN0IGdldFRhcmdldFBsYXRmb3JtKCk6IFByb21pc2U8VGFyZ2V0UGxhdGZvcm0+O1xuXHRhYnN0cmFjdCB6aXAoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24pOiBQcm9taXNlPFVSST47XG5cdGFic3RyYWN0IGdldE1hbmlmZXN0KHZzaXg6IFVSSSk6IFByb21pc2U8SUV4dGVuc2lvbk1hbmlmZXN0Pjtcblx0YWJzdHJhY3QgaW5zdGFsbCh2c2l4OiBVUkksIG9wdGlvbnM/OiBJbnN0YWxsT3B0aW9ucyk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPjtcblx0YWJzdHJhY3QgaW5zdGFsbEZyb21Mb2NhdGlvbihsb2NhdGlvbjogVVJJLCBwcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPjtcblx0YWJzdHJhY3QgaW5zdGFsbEV4dGVuc2lvbnNGcm9tUHJvZmlsZShleHRlbnNpb25zOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbltdPjtcblx0YWJzdHJhY3QgZ2V0SW5zdGFsbGVkKHR5cGU/OiBFeHRlbnNpb25UeXBlLCBwcm9maWxlTG9jYXRpb24/OiBVUkksIHByb2R1Y3RWZXJzaW9uPzogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb25bXT47XG5cdGFic3RyYWN0IGNvcHlFeHRlbnNpb25zKGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSwgdG9Qcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8dm9pZD47XG5cdGFic3RyYWN0IGRvd25sb2FkKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIG9wZXJhdGlvbjogSW5zdGFsbE9wZXJhdGlvbiwgZG9ub3RWZXJpZnlTaWduYXR1cmU6IGJvb2xlYW4pOiBQcm9taXNlPFVSST47XG5cdGFic3RyYWN0IGNsZWFuVXAoKTogUHJvbWlzZTx2b2lkPjtcblx0YWJzdHJhY3QgdXBkYXRlTWV0YWRhdGEobG9jYWw6IElMb2NhbEV4dGVuc2lvbiwgbWV0YWRhdGE6IFBhcnRpYWw8TWV0YWRhdGE+LCBwcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgZXh0ZW5kcyBDb21tb250RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgaW1wbGVtZW50cyBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdDogUHJvbWlzZTxJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdD4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbGFzdFJlcG9ydFRpbWVzdGFtcCA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5zdGFsbGluZ0V4dGVuc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgeyB0YXNrOiBJSW5zdGFsbEV4dGVuc2lvblRhc2s7IHdhaXRpbmdUYXNrczogSUluc3RhbGxFeHRlbnNpb25UYXNrW10gfT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSB1bmluc3RhbGxpbmdFeHRlbnNpb25zID0gbmV3IE1hcDxzdHJpbmcsIElVbmluc3RhbGxFeHRlbnNpb25UYXNrPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uSW5zdGFsbEV4dGVuc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEluc3RhbGxFeHRlbnNpb25FdmVudD4oKSk7XG5cdGdldCBvbkluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiB0aGlzLl9vbkluc3RhbGxFeHRlbnNpb24uZXZlbnQ7IH1cblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10+KCkpO1xuXHRnZXQgb25EaWRJbnN0YWxsRXh0ZW5zaW9ucygpIHsgcmV0dXJuIHRoaXMuX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMuZXZlbnQ7IH1cblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uVW5pbnN0YWxsRXh0ZW5zaW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQ+KCkpO1xuXHRnZXQgb25Vbmluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiB0aGlzLl9vblVuaW5zdGFsbEV4dGVuc2lvbi5ldmVudDsgfVxuXG5cdHByb3RlY3RlZCBfb25EaWRVbmluc3RhbGxFeHRlbnNpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxEaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudD4oKSk7XG5cdGdldCBvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbigpIHsgcmV0dXJuIHRoaXMuX29uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLmV2ZW50OyB9XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGE+KCkpO1xuXHRnZXQgb25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSgpIHsgcmV0dXJuIHRoaXMuX29uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEuZXZlbnQ7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHBhcnRpY2lwYW50czogSUV4dGVuc2lvbk1hbmFnZW1lbnRQYXJ0aWNpcGFudFtdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZ2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlOiBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHByb2R1Y3RTZXJ2aWNlLCBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLmluc3RhbGxpbmdFeHRlbnNpb25zLmZvckVhY2goKHsgdGFzayB9KSA9PiB0YXNrLmNhbmNlbCgpKTtcblx0XHRcdHRoaXMudW5pbnN0YWxsaW5nRXh0ZW5zaW9ucy5mb3JFYWNoKHByb21pc2UgPT4gcHJvbWlzZS5jYW5jZWwoKSk7XG5cdFx0XHR0aGlzLmluc3RhbGxpbmdFeHRlbnNpb25zLmNsZWFyKCk7XG5cdFx0XHR0aGlzLnVuaW5zdGFsbGluZ0V4dGVuc2lvbnMuY2xlYXIoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsRnJvbUdhbGxlcnkoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgb3B0aW9uczogSW5zdGFsbE9wdGlvbnMgPSB7fSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCB0aGlzLmluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucyhbeyBleHRlbnNpb24sIG9wdGlvbnMgfV0pO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gcmVzdWx0cy5maW5kKCh7IGlkZW50aWZpZXIgfSkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdGlmIChyZXN1bHQ/LmxvY2FsKSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ/LmxvY2FsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3VsdD8uZXJyb3IpIHtcblx0XHRcdFx0dGhyb3cgcmVzdWx0LmVycm9yO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihgVW5rbm93biBlcnJvciB3aGlsZSBpbnN0YWxsaW5nIGV4dGVuc2lvbiAke2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkfWAsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuVW5rbm93bik7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSk6IFByb21pc2U8SW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPiB7XG5cdFx0aWYgKCF0aGlzLmdhbGxlcnlTZXJ2aWNlLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKG5scy5sb2NhbGl6ZSgnTWFya2V0UGxhY2VEaXNhYmxlZCcsIFwiTWFya2V0cGxhY2UgaXMgbm90IGVuYWJsZWRcIiksIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuTm90QWxsb3dlZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0czogSW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdID0gW107XG5cdFx0Y29uc3QgaW5zdGFsbGFibGVFeHRlbnNpb25zOiBJbnN0YWxsYWJsZUV4dGVuc2lvbltdID0gW107XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQoZXh0ZW5zaW9ucy5tYXAoYXN5bmMgKHsgZXh0ZW5zaW9uLCBvcHRpb25zIH0pID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGNvbXBhdGlibGUgPSBhd2FpdCB0aGlzLmNoZWNrQW5kR2V0Q29tcGF0aWJsZVZlcnNpb24oZXh0ZW5zaW9uLCAhIW9wdGlvbnM/Lmluc3RhbGxHaXZlblZlcnNpb24sICEhb3B0aW9ucz8uaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uLCBvcHRpb25zLnByb2R1Y3RWZXJzaW9uID8/IHsgdmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBkYXRlOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfSk7XG5cdFx0XHRcdGluc3RhbGxhYmxlRXh0ZW5zaW9ucy5wdXNoKHsgLi4uY29tcGF0aWJsZSwgb3B0aW9ucyB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHJlc3VsdHMucHVzaCh7IGlkZW50aWZpZXI6IGV4dGVuc2lvbi5pZGVudGlmaWVyLCBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24uSW5zdGFsbCwgc291cmNlOiBleHRlbnNpb24sIGVycm9yLCBwcm9maWxlTG9jYXRpb246IG9wdGlvbnMucHJvZmlsZUxvY2F0aW9uID8/IHRoaXMuZ2V0Q3VycmVudEV4dGVuc2lvbnNNYW5pZmVzdExvY2F0aW9uKCkgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKGluc3RhbGxhYmxlRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdHJlc3VsdHMucHVzaCguLi5hd2FpdCB0aGlzLmluc3RhbGxFeHRlbnNpb25zKGluc3RhbGxhYmxlRXh0ZW5zaW9ucykpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9XG5cblx0YXN5bmMgdW5pbnN0YWxsKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBvcHRpb25zPzogVW5pbnN0YWxsT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UjdW5pbnN0YWxsJywgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdHJldHVybiB0aGlzLnVuaW5zdGFsbEV4dGVuc2lvbnMoW3sgZXh0ZW5zaW9uLCBvcHRpb25zIH1dKTtcblx0fVxuXG5cdGFzeW5jIHRvZ2dsZUFwcGxpYXRpb25TY29wZShleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgZnJvbVByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRpZiAoaXNBcHBsaWNhdGlvblNjb3BlZEV4dGVuc2lvbihleHRlbnNpb24ubWFuaWZlc3QpIHx8IGV4dGVuc2lvbi5pc0J1aWx0aW4pIHtcblx0XHRcdHJldHVybiBleHRlbnNpb247XG5cdFx0fVxuXG5cdFx0aWYgKGV4dGVuc2lvbi5pc0FwcGxpY2F0aW9uU2NvcGVkKSB7XG5cdFx0XHRsZXQgbG9jYWwgPSBhd2FpdCB0aGlzLnVwZGF0ZU1ldGFkYXRhKGV4dGVuc2lvbiwgeyBpc0FwcGxpY2F0aW9uU2NvcGVkOiBmYWxzZSB9LCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0XHRpZiAoIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGZyb21Qcm9maWxlTG9jYXRpb24sIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKSkge1xuXHRcdFx0XHRsb2NhbCA9IGF3YWl0IHRoaXMuY29weUV4dGVuc2lvbihleHRlbnNpb24sIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCBmcm9tUHJvZmlsZUxvY2F0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMpIHtcblx0XHRcdFx0Y29uc3QgZXhpc3RpbmcgPSAoYXdhaXQgdGhpcy5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyLCBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSkpXG5cdFx0XHRcdFx0LmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEuZmlyZSh7IGxvY2FsOiBleGlzdGluZywgcHJvZmlsZUxvY2F0aW9uOiBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbi5maXJlKHsgaWRlbnRpZmllcjogZXh0ZW5zaW9uLmlkZW50aWZpZXIsIHByb2ZpbGVMb2NhdGlvbjogcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBsb2NhbDtcblx0XHR9XG5cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IGxvY2FsID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZnJvbVByb2ZpbGVMb2NhdGlvbiwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpXG5cdFx0XHRcdD8gYXdhaXQgdGhpcy51cGRhdGVNZXRhZGF0YShleHRlbnNpb24sIHsgaXNBcHBsaWNhdGlvblNjb3BlZDogdHJ1ZSB9LCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSlcblx0XHRcdFx0OiBhd2FpdCB0aGlzLmNvcHlFeHRlbnNpb24oZXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uLCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSwgeyBpc0FwcGxpY2F0aW9uU2NvcGVkOiB0cnVlIH0pO1xuXG5cdFx0XHR0aGlzLl9vbkRpZEluc3RhbGxFeHRlbnNpb25zLmZpcmUoW3sgaWRlbnRpZmllcjogbG9jYWwuaWRlbnRpZmllciwgb3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLkluc3RhbGwsIGxvY2FsLCBwcm9maWxlTG9jYXRpb246IHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCBhcHBsaWNhdGlvblNjb3BlZDogdHJ1ZSB9XSk7XG5cdFx0XHRyZXR1cm4gbG9jYWw7XG5cdFx0fVxuXG5cdH1cblxuXHRnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk6IFByb21pc2U8SUV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q+IHtcblx0XHRjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuXHRcdGlmICghdGhpcy5leHRlbnNpb25zQ29udHJvbE1hbmlmZXN0IHx8IG5vdyAtIHRoaXMubGFzdFJlcG9ydFRpbWVzdGFtcCA+IDEwMDAgKiA2MCAqIDUpIHsgLy8gNSBtaW51dGUgY2FjaGUgZnJlc2huZXNzXG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QgPSB0aGlzLnVwZGF0ZUNvbnRyb2xDYWNoZSgpO1xuXHRcdFx0dGhpcy5sYXN0UmVwb3J0VGltZXN0YW1wID0gbm93O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q7XG5cdH1cblxuXHRyZWdpc3RlclBhcnRpY2lwYW50KHBhcnRpY2lwYW50OiBJRXh0ZW5zaW9uTWFuYWdlbWVudFBhcnRpY2lwYW50KTogdm9pZCB7XG5cdFx0dGhpcy5wYXJ0aWNpcGFudHMucHVzaChwYXJ0aWNpcGFudCk7XG5cdH1cblxuXHRhc3luYyByZXNldFBpbm5lZFN0YXRlRm9yQWxsVXNlckV4dGVuc2lvbnMocGlubmVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuam9pbkFsbFNldHRsZWQodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcy5tYXAoXG5cdFx0XHRcdGFzeW5jIHByb2ZpbGUgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmdldEluc3RhbGxlZChFeHRlbnNpb25UeXBlLlVzZXIsIHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmpvaW5BbGxTZXR0bGVkKGV4dGVuc2lvbnMubWFwKFxuXHRcdFx0XHRcdFx0YXN5bmMgZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5waW5uZWQgIT09IHBpbm5lZCkge1xuXHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudXBkYXRlTWV0YWRhdGEoZXh0ZW5zaW9uLCB7IHBpbm5lZCB9LCBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fSkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0Vycm9yIHdoaWxlIHJlc2V0dGluZyBwaW5uZWQgc3RhdGUgZm9yIGFsbCB1c2VyIGV4dGVuc2lvbnMnLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBpbnN0YWxsRXh0ZW5zaW9ucyhleHRlbnNpb25zOiBJbnN0YWxsYWJsZUV4dGVuc2lvbltdKTogUHJvbWlzZTxJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10+IHtcblx0XHRjb25zdCBpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcCA9IG5ldyBNYXA8c3RyaW5nLCBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0ICYgeyBwcm9maWxlTG9jYXRpb246IFVSSSB9PigpO1xuXHRcdGNvbnN0IGluc3RhbGxpbmdFeHRlbnNpb25zTWFwID0gbmV3IE1hcDxzdHJpbmcsIHsgdGFzazogSUluc3RhbGxFeHRlbnNpb25UYXNrOyByb290OiBJSW5zdGFsbEV4dGVuc2lvblRhc2sgfCB1bmRlZmluZWQgfT4oKTtcblx0XHRjb25zdCBhbHJlYWR5UmVxdWVzdGVkSW5zdGFsbGF0aW9uczogUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRcdGNvbnN0IGdldEluc3RhbGxFeHRlbnNpb25UYXNrS2V5ID0gKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIHByb2ZpbGVMb2NhdGlvbjogVVJJKSA9PiBgJHtFeHRlbnNpb25LZXkuY3JlYXRlKGV4dGVuc2lvbikudG9TdHJpbmcoKX0tJHtwcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKX1gO1xuXHRcdGNvbnN0IGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrID0gKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24gfCBVUkksIG9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucywgcm9vdDogSUluc3RhbGxFeHRlbnNpb25UYXNrIHwgdW5kZWZpbmVkKTogdm9pZCA9PiB7XG5cdFx0XHRpZiAoIVVSSS5pc1VyaShleHRlbnNpb24pKSB7XG5cdFx0XHRcdGlmIChpbnN0YWxsaW5nRXh0ZW5zaW9uc01hcC5oYXMoYCR7ZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKX0tJHtvcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpfWApKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nSW5zdGFsbGluZ0V4dGVuc2lvbiA9IHRoaXMuaW5zdGFsbGluZ0V4dGVuc2lvbnMuZ2V0KGdldEluc3RhbGxFeHRlbnNpb25UYXNrS2V5KGV4dGVuc2lvbiwgb3B0aW9ucy5wcm9maWxlTG9jYXRpb24pKTtcblx0XHRcdFx0aWYgKGV4aXN0aW5nSW5zdGFsbGluZ0V4dGVuc2lvbikge1xuXHRcdFx0XHRcdGlmIChyb290ICYmIHRoaXMuY2FuV2FpdEZvclRhc2socm9vdCwgZXhpc3RpbmdJbnN0YWxsaW5nRXh0ZW5zaW9uLnRhc2spKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpZGVudGlmaWVyID0gZXhpc3RpbmdJbnN0YWxsaW5nRXh0ZW5zaW9uLnRhc2suaWRlbnRpZmllcjtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdXYWl0aW5nIGZvciBhbHJlYWR5IHJlcXVlc3RlZCBpbnN0YWxsaW5nIGV4dGVuc2lvbicsIGlkZW50aWZpZXIuaWQsIHJvb3QuaWRlbnRpZmllci5pZCwgb3B0aW9ucy5wcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0XHRleGlzdGluZ0luc3RhbGxpbmdFeHRlbnNpb24ud2FpdGluZ1Rhc2tzLnB1c2gocm9vdCk7XG5cdFx0XHRcdFx0XHQvLyBhZGQgcHJvbWlzZSB0aGF0IHdhaXRzIHVudGlsIHRoZSBleHRlbnNpb24gaXMgY29tcGxldGVseSBpbnN0YWxsZWQsIGllLiwgb25EaWRJbnN0YWxsRXh0ZW5zaW9ucyBldmVudCBpcyB0cmlnZ2VyZWQgZm9yIHRoaXMgZXh0ZW5zaW9uXG5cdFx0XHRcdFx0XHRhbHJlYWR5UmVxdWVzdGVkSW5zdGFsbGF0aW9ucy5wdXNoKFxuXHRcdFx0XHRcdFx0XHRFdmVudC50b1Byb21pc2UoXG5cdFx0XHRcdFx0XHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMub25EaWRJbnN0YWxsRXh0ZW5zaW9ucywgcmVzdWx0cyA9PiByZXN1bHRzLnNvbWUocmVzdWx0ID0+IGFyZVNhbWVFeHRlbnNpb25zKHJlc3VsdC5pZGVudGlmaWVyLCBpZGVudGlmaWVyKSkpXG5cdFx0XHRcdFx0XHRcdCkudGhlbihyZXN1bHRzID0+IHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnRmluaXNoZWQgd2FpdGluZyBmb3IgYWxyZWFkeSByZXF1ZXN0ZWQgaW5zdGFsbGluZyBleHRlbnNpb24nLCBpZGVudGlmaWVyLmlkLCByb290LmlkZW50aWZpZXIuaWQsIG9wdGlvbnMucHJvZmlsZUxvY2F0aW9uLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHJlc3VsdHMuZmluZChyZXN1bHQgPT4gYXJlU2FtZUV4dGVuc2lvbnMocmVzdWx0LmlkZW50aWZpZXIsIGlkZW50aWZpZXIpKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIXJlc3VsdD8ubG9jYWwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIEV4dGVuc2lvbiBmYWlsZWQgdG8gaW5zdGFsbFxuXHRcdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBFeHRlbnNpb24gJHtpZGVudGlmaWVyLmlkfSBpcyBub3QgaW5zdGFsbGVkYCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5zdGFsbEV4dGVuc2lvblRhc2sgPSB0aGlzLmNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0LCBleHRlbnNpb24sIG9wdGlvbnMpO1xuXHRcdFx0Y29uc3Qga2V5ID0gYCR7Z2V0R2FsbGVyeUV4dGVuc2lvbklkKG1hbmlmZXN0LnB1Ymxpc2hlciwgbWFuaWZlc3QubmFtZSl9LSR7b3B0aW9ucy5wcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKX1gO1xuXHRcdFx0aW5zdGFsbGluZ0V4dGVuc2lvbnNNYXAuc2V0KGtleSwgeyB0YXNrOiBpbnN0YWxsRXh0ZW5zaW9uVGFzaywgcm9vdCB9KTtcblx0XHRcdHRoaXMuX29uSW5zdGFsbEV4dGVuc2lvbi5maXJlKHsgaWRlbnRpZmllcjogaW5zdGFsbEV4dGVuc2lvblRhc2suaWRlbnRpZmllciwgc291cmNlOiBleHRlbnNpb24sIHByb2ZpbGVMb2NhdGlvbjogb3B0aW9ucy5wcm9maWxlTG9jYXRpb24gfSk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnSW5zdGFsbGluZyBleHRlbnNpb246JywgaW5zdGFsbEV4dGVuc2lvblRhc2suaWRlbnRpZmllci5pZCwgb3B0aW9ucyk7XG5cdFx0XHQvLyBvbmx5IGNhY2hlIGdhbGxlcnkgZXh0ZW5zaW9ucyB0YXNrc1xuXHRcdFx0aWYgKCFVUkkuaXNVcmkoZXh0ZW5zaW9uKSkge1xuXHRcdFx0XHR0aGlzLmluc3RhbGxpbmdFeHRlbnNpb25zLnNldChnZXRJbnN0YWxsRXh0ZW5zaW9uVGFza0tleShleHRlbnNpb24sIG9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKSwgeyB0YXNrOiBpbnN0YWxsRXh0ZW5zaW9uVGFzaywgd2FpdGluZ1Rhc2tzOiBbXSB9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdC8vIFN0YXJ0IGluc3RhbGxpbmcgZXh0ZW5zaW9uc1xuXHRcdFx0Zm9yIChjb25zdCB7IG1hbmlmZXN0LCBleHRlbnNpb24sIG9wdGlvbnMgfSBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGlzQXBwbGljYXRpb25TY29wZWQgPSBvcHRpb25zLmlzQXBwbGljYXRpb25TY29wZWQgfHwgb3B0aW9ucy5pc0J1aWx0aW4gfHwgaXNBcHBsaWNhdGlvblNjb3BlZEV4dGVuc2lvbihtYW5pZmVzdCk7XG5cdFx0XHRcdGNvbnN0IGluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9uczogSW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zID0ge1xuXHRcdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdFx0aXNBcHBsaWNhdGlvblNjb3BlZCxcblx0XHRcdFx0XHRwcm9maWxlTG9jYXRpb246IGlzQXBwbGljYXRpb25TY29wZWQgPyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSA6IG9wdGlvbnMucHJvZmlsZUxvY2F0aW9uID8/IHRoaXMuZ2V0Q3VycmVudEV4dGVuc2lvbnNNYW5pZmVzdExvY2F0aW9uKCksXG5cdFx0XHRcdFx0cHJvZHVjdFZlcnNpb246IG9wdGlvbnMucHJvZHVjdFZlcnNpb24gPz8geyB2ZXJzaW9uOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLnZlcnNpb24sIGRhdGU6IHRoaXMucHJvZHVjdFNlcnZpY2UuZGF0ZSB9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Y29uc3QgZXhpc3RpbmdJbnN0YWxsRXh0ZW5zaW9uVGFzayA9ICFVUkkuaXNVcmkoZXh0ZW5zaW9uKSA/IHRoaXMuaW5zdGFsbGluZ0V4dGVuc2lvbnMuZ2V0KGdldEluc3RhbGxFeHRlbnNpb25UYXNrS2V5KGV4dGVuc2lvbiwgaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLnByb2ZpbGVMb2NhdGlvbikpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoZXhpc3RpbmdJbnN0YWxsRXh0ZW5zaW9uVGFzaykge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdFeHRlbnNpb24gaXMgYWxyZWFkeSByZXF1ZXN0ZWQgdG8gaW5zdGFsbCcsIGV4aXN0aW5nSW5zdGFsbEV4dGVuc2lvblRhc2sudGFzay5pZGVudGlmaWVyLmlkLCBpbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMucHJvZmlsZUxvY2F0aW9uLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdGFscmVhZHlSZXF1ZXN0ZWRJbnN0YWxsYXRpb25zLnB1c2goZXhpc3RpbmdJbnN0YWxsRXh0ZW5zaW9uVGFzay50YXNrLndhaXRVbnRpbFRhc2tJc0ZpbmlzaGVkKCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0LCBleHRlbnNpb24sIGluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucywgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBjb2xsZWN0IGFuZCBzdGFydCBpbnN0YWxsaW5nIGFsbCBkZXBlbmRlbmNpZXMgYW5kIHBhY2sgZXh0ZW5zaW9uc1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoWy4uLmluc3RhbGxpbmdFeHRlbnNpb25zTWFwLnZhbHVlcygpXS5tYXAoYXN5bmMgKHsgdGFzayB9KSA9PiB7XG5cdFx0XHRcdGlmICh0YXNrLm9wdGlvbnMuZG9ub3RJbmNsdWRlUGFja0FuZERlcGVuZGVuY2llcykge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdJbnN0YWxsaW5nIHRoZSBleHRlbnNpb24gd2l0aG91dCBjaGVja2luZyBkZXBlbmRlbmNpZXMgYW5kIHBhY2snLCB0YXNrLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBhbGxEZXBzQW5kUGFja0V4dGVuc2lvbnNUb0luc3RhbGwgPSBhd2FpdCB0aGlzLmdldEFsbERlcHNBbmRQYWNrRXh0ZW5zaW9ucyh0YXNrLmlkZW50aWZpZXIsIHRhc2subWFuaWZlc3QsICEhdGFzay5vcHRpb25zLmluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbiwgdGFzay5vcHRpb25zLnByb2R1Y3RWZXJzaW9uKTtcblx0XHRcdFx0XHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGVkKHVuZGVmaW5lZCwgdGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbiwgdGFzay5vcHRpb25zLnByb2R1Y3RWZXJzaW9uKTtcblx0XHRcdFx0XHRcdGNvbnN0IG9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyA9IHsgLi4udGFzay5vcHRpb25zLCBjb250ZXh0OiB7IC4uLnRhc2sub3B0aW9ucy5jb250ZXh0LCBbRVhURU5TSU9OX0lOU1RBTExfREVQX1BBQ0tfQ09OVEVYVF06IHRydWUgfSB9O1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCB7IGdhbGxlcnksIG1hbmlmZXN0IH0gb2YgZGlzdGluY3QoYWxsRGVwc0FuZFBhY2tFeHRlbnNpb25zVG9JbnN0YWxsLCAoeyBnYWxsZXJ5IH0pID0+IGdhbGxlcnkuaWRlbnRpZmllci5pZCkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZXhpc3RpbmcgPSBpbnN0YWxsZWQuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZ2FsbGVyeS5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0XHRcdC8vIFNraXAgaWYgdGhlIGV4dGVuc2lvbiBpcyBhbHJlYWR5IGluc3RhbGxlZCBhbmQgaGFzIHRoZSBzYW1lIGFwcGxpY2F0aW9uIHNjb3BlXG5cdFx0XHRcdFx0XHRcdGlmIChleGlzdGluZyAmJiBleGlzdGluZy5pc0FwcGxpY2F0aW9uU2NvcGVkID09PSAhIW9wdGlvbnMuaXNBcHBsaWNhdGlvblNjb3BlZCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0LCBnYWxsZXJ5LCBvcHRpb25zLCB0YXNrKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0Ly8gSW5zdGFsbGluZyB0aHJvdWdoIFZTSVhcblx0XHRcdFx0XHRcdGlmIChVUkkuaXNVcmkodGFzay5zb3VyY2UpKSB7XG5cdFx0XHRcdFx0XHRcdC8vIElnbm9yZSBpbnN0YWxsaW5nIGRlcGVuZGVuY2llcyBhbmQgcGFja3Ncblx0XHRcdFx0XHRcdFx0aWYgKGlzTm9uRW1wdHlBcnJheSh0YXNrLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcykpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgQ2Fubm90IGluc3RhbGwgZGVwZW5kZW5jaWVzIG9mIGV4dGVuc2lvbjpgLCB0YXNrLmlkZW50aWZpZXIuaWQsIGVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChpc05vbkVtcHR5QXJyYXkodGFzay5tYW5pZmVzdC5leHRlbnNpb25QYWNrKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBDYW5ub3QgaW5zdGFsbCBwYWNrZWQgZXh0ZW5zaW9ucyBvZiBleHRlbnNpb246YCwgdGFzay5pZGVudGlmaWVyLmlkLCBlcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdFcnJvciB3aGlsZSBwcmVwYXJpbmcgdG8gaW5zdGFsbCBkZXBlbmRlbmNpZXMgYW5kIGV4dGVuc2lvbiBwYWNrcyBvZiB0aGUgZXh0ZW5zaW9uOicsIHRhc2suaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBvdGhlclByb2ZpbGVzVG9VcGRhdGUgPSBhd2FpdCB0aGlzLmdldE90aGVyUHJvZmlsZXNUb1VwZGF0ZUV4dGVuc2lvbihbLi4uaW5zdGFsbGluZ0V4dGVuc2lvbnNNYXAudmFsdWVzKCldLm1hcCgoeyB0YXNrIH0pID0+IHRhc2spKTtcblx0XHRcdGZvciAoY29uc3QgW3Byb2ZpbGVMb2NhdGlvbiwgdGFza10gb2Ygb3RoZXJQcm9maWxlc1RvVXBkYXRlKSB7XG5cdFx0XHRcdGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKHRhc2subWFuaWZlc3QsIHRhc2suc291cmNlLCB7IC4uLnRhc2sub3B0aW9ucywgcHJvZmlsZUxvY2F0aW9uIH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluc3RhbGwgZXh0ZW5zaW9ucyBpbiBwYXJhbGxlbCBhbmQgd2FpdCB1bnRpbCBhbGwgZXh0ZW5zaW9ucyBhcmUgaW5zdGFsbGVkIC8gZmFpbGVkXG5cdFx0XHRhd2FpdCB0aGlzLmpvaW5BbGxTZXR0bGVkKFsuLi5pbnN0YWxsaW5nRXh0ZW5zaW9uc01hcC5lbnRyaWVzKCldLm1hcChhc3luYyAoW2tleSwgeyB0YXNrIH1dKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YXJ0VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuXHRcdFx0XHRsZXQgbG9jYWw6IElMb2NhbEV4dGVuc2lvbjtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRsb2NhbCA9IGF3YWl0IHRhc2sucnVuKCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5qb2luQWxsU2V0dGxlZCh0aGlzLnBhcnRpY2lwYW50cy5tYXAocGFydGljaXBhbnQgPT4gcGFydGljaXBhbnQucG9zdEluc3RhbGwobG9jYWwsIHRhc2suc291cmNlLCB0YXNrLm9wdGlvbnMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5Qb3N0SW5zdGFsbCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRjb25zdCBlcnJvciA9IHRvRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGUpO1xuXHRcdFx0XHRcdGlmICghVVJJLmlzVXJpKHRhc2suc291cmNlKSkge1xuXHRcdFx0XHRcdFx0cmVwb3J0VGVsZW1ldHJ5KHRoaXMudGVsZW1ldHJ5U2VydmljZSwgdGFzay5vcGVyYXRpb24gPT09IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlID8gJ2V4dGVuc2lvbkdhbGxlcnk6dXBkYXRlJyA6ICdleHRlbnNpb25HYWxsZXJ5Omluc3RhbGwnLCB7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbkRhdGE6IGdldEdhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhKHRhc2suc291cmNlKSxcblx0XHRcdFx0XHRcdFx0ZXJyb3IsXG5cdFx0XHRcdFx0XHRcdHNvdXJjZTogdGFzay5vcHRpb25zLmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9TT1VSQ0VfQ09OVEVYVF1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5zZXQoa2V5LCB7IGVycm9yLCBpZGVudGlmaWVyOiB0YXNrLmlkZW50aWZpZXIsIG9wZXJhdGlvbjogdGFzay5vcGVyYXRpb24sIHNvdXJjZTogdGFzay5zb3VyY2UsIGNvbnRleHQ6IHRhc2sub3B0aW9ucy5jb250ZXh0LCBwcm9maWxlTG9jYXRpb246IHRhc2sub3B0aW9ucy5wcm9maWxlTG9jYXRpb24sIGFwcGxpY2F0aW9uU2NvcGVkOiB0YXNrLm9wdGlvbnMuaXNBcHBsaWNhdGlvblNjb3BlZCB9KTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0Vycm9yIHdoaWxlIGluc3RhbGxpbmcgdGhlIGV4dGVuc2lvbicsIHRhc2suaWRlbnRpZmllci5pZCwgZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSwgdGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIVVSSS5pc1VyaSh0YXNrLnNvdXJjZSkpIHtcblx0XHRcdFx0XHRjb25zdCBpc1VwZGF0ZSA9IHRhc2sub3BlcmF0aW9uID09PSBJbnN0YWxsT3BlcmF0aW9uLlVwZGF0ZTtcblx0XHRcdFx0XHRjb25zdCBkdXJhdGlvblNpbmNlVXBkYXRlID0gaXNVcGRhdGUgPyB1bmRlZmluZWQgOiAobmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0YXNrLnNvdXJjZS5sYXN0VXBkYXRlZCkgLyAxMDAwO1xuXHRcdFx0XHRcdHJlcG9ydFRlbGVtZXRyeSh0aGlzLnRlbGVtZXRyeVNlcnZpY2UsIGlzVXBkYXRlID8gJ2V4dGVuc2lvbkdhbGxlcnk6dXBkYXRlJyA6ICdleHRlbnNpb25HYWxsZXJ5Omluc3RhbGwnLCB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25EYXRhOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uVGVsZW1ldHJ5RGF0YSh0YXNrLnNvdXJjZSksXG5cdFx0XHRcdFx0XHR2ZXJpZmljYXRpb25TdGF0dXM6IHRhc2sudmVyaWZpY2F0aW9uU3RhdHVzLFxuXHRcdFx0XHRcdFx0ZHVyYXRpb246IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lLFxuXHRcdFx0XHRcdFx0ZHVyYXRpb25TaW5jZVVwZGF0ZSxcblx0XHRcdFx0XHRcdHNvdXJjZTogdGFzay5vcHRpb25zLmNvbnRleHQ/LltFWFRFTlNJT05fSU5TVEFMTF9TT1VSQ0VfQ09OVEVYVF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHQvLyBJbiB3ZWIsIHJlcG9ydCBleHRlbnNpb24gaW5zdGFsbCBzdGF0aXN0aWNzIGV4cGxpY2l0bHkuIEluIERlc2t0b3AsIHN0YXRpc3RpY3MgYXJlIGF1dG9tYXRpY2FsbHkgdXBkYXRlZCB3aGlsZSBkb3dubG9hZGluZyB0aGUgVlNJWC5cblx0XHRcdFx0XHRpZiAoaXNXZWIgJiYgdGFzay5vcGVyYXRpb24gIT09IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLnJlcG9ydFN0YXRpc3RpYyhsb2NhbC5tYW5pZmVzdC5wdWJsaXNoZXIsIGxvY2FsLm1hbmlmZXN0Lm5hbWUsIGxvY2FsLm1hbmlmZXN0LnZlcnNpb24sIFN0YXRpc3RpY1R5cGUuSW5zdGFsbCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikgeyAvKiBpZ25vcmUgKi8gfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5zZXQoa2V5LCB7IGxvY2FsLCBpZGVudGlmaWVyOiB0YXNrLmlkZW50aWZpZXIsIG9wZXJhdGlvbjogdGFzay5vcGVyYXRpb24sIHNvdXJjZTogdGFzay5zb3VyY2UsIGNvbnRleHQ6IHRhc2sub3B0aW9ucy5jb250ZXh0LCBwcm9maWxlTG9jYXRpb246IHRhc2sub3B0aW9ucy5wcm9maWxlTG9jYXRpb24sIGFwcGxpY2F0aW9uU2NvcGVkOiBsb2NhbC5pc0FwcGxpY2F0aW9uU2NvcGVkIH0pO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAoYWxyZWFkeVJlcXVlc3RlZEluc3RhbGxhdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuam9pbkFsbFNldHRsZWQoYWxyZWFkeVJlcXVlc3RlZEluc3RhbGxhdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zdCBnZXRBbGxEZXBzQW5kUGFja3MgPSAoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIHByb2ZpbGVMb2NhdGlvbjogVVJJLCBhbGxEZXBzT3JQYWNrczogc3RyaW5nW10pID0+IHtcblx0XHRcdFx0Y29uc3QgZGVwc09yUGFja3MgPSBbXTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbi5tYW5pZmVzdC5leHRlbnNpb25EZXBlbmRlbmNpZXM/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdGRlcHNPclBhY2tzLnB1c2goLi4uZXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbi5tYW5pZmVzdC5leHRlbnNpb25QYWNrPy5sZW5ndGgpIHtcblx0XHRcdFx0XHRkZXBzT3JQYWNrcy5wdXNoKC4uLmV4dGVuc2lvbi5tYW5pZmVzdC5leHRlbnNpb25QYWNrKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IGlkIG9mIGRlcHNPclBhY2tzKSB7XG5cdFx0XHRcdFx0aWYgKGFsbERlcHNPclBhY2tzLmluY2x1ZGVzKGlkLnRvTG93ZXJDYXNlKCkpKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YWxsRGVwc09yUGFja3MucHVzaChpZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0XHRjb25zdCBpbnN0YWxsZWQgPSBpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5nZXQoYCR7aWQudG9Mb3dlckNhc2UoKX0tJHtwcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0XHRpZiAoaW5zdGFsbGVkPy5sb2NhbCkge1xuXHRcdFx0XHRcdFx0YWxsRGVwc09yUGFja3MgPSBnZXRBbGxEZXBzQW5kUGFja3MoaW5zdGFsbGVkLmxvY2FsLCBwcm9maWxlTG9jYXRpb24sIGFsbERlcHNPclBhY2tzKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGFsbERlcHNPclBhY2tzO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGdldEVycm9yUmVzdWx0ID0gKHRhc2s6IElJbnN0YWxsRXh0ZW5zaW9uVGFzaykgPT4gKHsgaWRlbnRpZmllcjogdGFzay5pZGVudGlmaWVyLCBvcGVyYXRpb246IEluc3RhbGxPcGVyYXRpb24uSW5zdGFsbCwgc291cmNlOiB0YXNrLnNvdXJjZSwgY29udGV4dDogdGFzay5vcHRpb25zLmNvbnRleHQsIHByb2ZpbGVMb2NhdGlvbjogdGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbiwgZXJyb3IgfSk7XG5cblx0XHRcdGNvbnN0IHJvbGxiYWNrVGFza3M6IElVbmluc3RhbGxFeHRlbnNpb25UYXNrW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgW2tleSwgeyB0YXNrLCByb290IH1dIG9mIGluc3RhbGxpbmdFeHRlbnNpb25zTWFwKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGluc3RhbGxFeHRlbnNpb25SZXN1bHRzTWFwLmdldChrZXkpO1xuXHRcdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRcdHRhc2suY2FuY2VsKCk7XG5cdFx0XHRcdFx0aW5zdGFsbEV4dGVuc2lvblJlc3VsdHNNYXAuc2V0KGtleSwgZ2V0RXJyb3JSZXN1bHQodGFzaykpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIElmIHRoZSBleHRlbnNpb24gaXMgaW5zdGFsbGVkIGJ5IGEgcm9vdCB0YXNrIGFuZCB0aGUgcm9vdCB0YXNrIGlzIGZhaWxlZCwgdGhlbiB1bmluc3RhbGwgdGhlIGV4dGVuc2lvblxuXHRcdFx0XHRlbHNlIGlmIChyZXN1bHQubG9jYWwgJiYgcm9vdCAmJiAhaW5zdGFsbEV4dGVuc2lvblJlc3VsdHNNYXAuZ2V0KGAke3Jvb3QuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfS0ke3Rhc2sub3B0aW9ucy5wcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKX1gKT8ubG9jYWwpIHtcblx0XHRcdFx0XHRyb2xsYmFja1Rhc2tzLnB1c2godGhpcy5jcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrKHJlc3VsdC5sb2NhbCwgeyB2ZXJzaW9uT25seTogdHJ1ZSwgcHJvZmlsZUxvY2F0aW9uOiB0YXNrLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uIH0pKTtcblx0XHRcdFx0XHRpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5zZXQoa2V5LCBnZXRFcnJvclJlc3VsdCh0YXNrKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgW2tleSwgeyB0YXNrIH1dIG9mIGluc3RhbGxpbmdFeHRlbnNpb25zTWFwKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGluc3RhbGxFeHRlbnNpb25SZXN1bHRzTWFwLmdldChrZXkpO1xuXHRcdFx0XHRpZiAoIXJlc3VsdD8ubG9jYWwpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGFzay5vcHRpb25zLmRvbm90SW5jbHVkZVBhY2tBbmREZXBlbmRlbmNpZXMpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBkZXBzT3JQYWNrcyA9IGdldEFsbERlcHNBbmRQYWNrcyhyZXN1bHQubG9jYWwsIHRhc2sub3B0aW9ucy5wcm9maWxlTG9jYXRpb24sIFtyZXN1bHQubG9jYWwuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpXSkuc2xpY2UoMSk7XG5cdFx0XHRcdGlmIChkZXBzT3JQYWNrcy5zb21lKGRlcE9yUGFjayA9PiBpbnN0YWxsaW5nRXh0ZW5zaW9uc01hcC5oYXMoYCR7ZGVwT3JQYWNrLnRvTG93ZXJDYXNlKCl9LSR7dGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpfWApICYmICFpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5nZXQoYCR7ZGVwT3JQYWNrLnRvTG93ZXJDYXNlKCl9LSR7dGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpfWApPy5sb2NhbCkpIHtcblx0XHRcdFx0XHRyb2xsYmFja1Rhc2tzLnB1c2godGhpcy5jcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrKHJlc3VsdC5sb2NhbCwgeyB2ZXJzaW9uT25seTogdHJ1ZSwgcHJvZmlsZUxvY2F0aW9uOiB0YXNrLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uIH0pKTtcblx0XHRcdFx0XHRpbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC5zZXQoa2V5LCBnZXRFcnJvclJlc3VsdCh0YXNrKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHJvbGxiYWNrVGFza3MubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChyb2xsYmFja1Rhc2tzLm1hcChhc3luYyByb2xsYmFja1Rhc2sgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCByb2xsYmFja1Rhc2sucnVuKCk7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnUm9sbGJhY2s6IFVuaW5zdGFsbGVkIGV4dGVuc2lvbicsIHJvbGxiYWNrVGFzay5leHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKCdSb2xsYmFjazogRXJyb3Igd2hpbGUgdW5pbnN0YWxsaW5nIGV4dGVuc2lvbicsIHJvbGxiYWNrVGFzay5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdC8vIEZpbmFsbHksIHJlbW92ZSBhbGwgdGhlIHRhc2tzIGZyb20gdGhlIGNhY2hlXG5cdFx0XHRmb3IgKGNvbnN0IHsgdGFzayB9IG9mIGluc3RhbGxpbmdFeHRlbnNpb25zTWFwLnZhbHVlcygpKSB7XG5cdFx0XHRcdGlmICh0YXNrLnNvdXJjZSAmJiAhVVJJLmlzVXJpKHRhc2suc291cmNlKSkge1xuXHRcdFx0XHRcdHRoaXMuaW5zdGFsbGluZ0V4dGVuc2lvbnMuZGVsZXRlKGdldEluc3RhbGxFeHRlbnNpb25UYXNrS2V5KHRhc2suc291cmNlLCB0YXNrLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0cyA9IFsuLi5pbnN0YWxsRXh0ZW5zaW9uUmVzdWx0c01hcC52YWx1ZXMoKV07XG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuXHRcdFx0aWYgKHJlc3VsdC5sb2NhbCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgRXh0ZW5zaW9uIGluc3RhbGxlZCBzdWNjZXNzZnVsbHk6YCwgcmVzdWx0LmlkZW50aWZpZXIuaWQsIHJlc3VsdC5wcm9maWxlTG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMuZmlyZShyZXN1bHRzKTtcblx0XHRyZXR1cm4gcmVzdWx0cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0T3RoZXJQcm9maWxlc1RvVXBkYXRlRXh0ZW5zaW9uKHRhc2tzOiBJSW5zdGFsbEV4dGVuc2lvblRhc2tbXSk6IFByb21pc2U8W1VSSSwgSUluc3RhbGxFeHRlbnNpb25UYXNrXVtdPiB7XG5cdFx0Y29uc3Qgb3RoZXJQcm9maWxlc1RvVXBkYXRlOiBbVVJJLCBJSW5zdGFsbEV4dGVuc2lvblRhc2tdW10gPSBbXTtcblx0XHRjb25zdCBwcm9maWxlRXh0ZW5zaW9uc0NhY2hlID0gbmV3IFJlc291cmNlTWFwPElMb2NhbEV4dGVuc2lvbltdPigpO1xuXHRcdGZvciAoY29uc3QgdGFzayBvZiB0YXNrcykge1xuXHRcdFx0aWYgKHRhc2sub3BlcmF0aW9uICE9PSBJbnN0YWxsT3BlcmF0aW9uLlVwZGF0ZVxuXHRcdFx0XHR8fCB0YXNrLm9wdGlvbnMuaXNBcHBsaWNhdGlvblNjb3BlZFxuXHRcdFx0XHR8fCB0YXNrLm9wdGlvbnMucGlubmVkXG5cdFx0XHRcdHx8IHRhc2sub3B0aW9ucy5pbnN0YWxsR2l2ZW5WZXJzaW9uXG5cdFx0XHRcdHx8IFVSSS5pc1VyaSh0YXNrLnNvdXJjZSlcblx0XHRcdCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzKSB7XG5cdFx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSwgdGFzay5vcHRpb25zLnByb2ZpbGVMb2NhdGlvbikpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsZXQgaW5zdGFsbGVkRXh0ZW5zaW9ucyA9IHByb2ZpbGVFeHRlbnNpb25zQ2FjaGUuZ2V0KHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlKTtcblx0XHRcdFx0aWYgKCFpbnN0YWxsZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0aW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGVkKEV4dGVuc2lvblR5cGUuVXNlciwgcHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdFx0XHRcdHByb2ZpbGVFeHRlbnNpb25zQ2FjaGUuc2V0KHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCBpbnN0YWxsZWRFeHRlbnNpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBpbnN0YWxsZWRFeHRlbnNpb24gPSBpbnN0YWxsZWRFeHRlbnNpb25zLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHRhc2suaWRlbnRpZmllcikpO1xuXHRcdFx0XHRpZiAoaW5zdGFsbGVkRXh0ZW5zaW9uICYmICFpbnN0YWxsZWRFeHRlbnNpb24ucGlubmVkKSB7XG5cdFx0XHRcdFx0b3RoZXJQcm9maWxlc1RvVXBkYXRlLnB1c2goW3Byb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLCB0YXNrXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG90aGVyUHJvZmlsZXNUb1VwZGF0ZTtcblx0fVxuXG5cdHByaXZhdGUgY2FuV2FpdEZvclRhc2sodGFza1RvV2FpdDogSUluc3RhbGxFeHRlbnNpb25UYXNrLCB0YXNrVG9XYWl0Rm9yOiBJSW5zdGFsbEV4dGVuc2lvblRhc2spOiBib29sZWFuIHtcblx0XHRmb3IgKGNvbnN0IFssIHsgdGFzaywgd2FpdGluZ1Rhc2tzIH1dIG9mIHRoaXMuaW5zdGFsbGluZ0V4dGVuc2lvbnMuZW50cmllcygpKSB7XG5cdFx0XHRpZiAodGFzayA9PT0gdGFza1RvV2FpdCkge1xuXHRcdFx0XHQvLyBDYW5ub3QgYmUgd2FpdGVkLCBJZiB0YXNrVG9XYWl0Rm9yIGlzIHdhaXRpbmcgZm9yIHRhc2tUb1dhaXRcblx0XHRcdFx0aWYgKHdhaXRpbmdUYXNrcy5pbmNsdWRlcyh0YXNrVG9XYWl0Rm9yKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBDYW5ub3QgYmUgd2FpdGVkLCBJZiB0YXNrVG9XYWl0Rm9yIGlzIHdhaXRpbmcgZm9yIHRhc2tzIHdhaXRpbmcgZm9yIHRhc2tUb1dhaXRcblx0XHRcdFx0aWYgKHdhaXRpbmdUYXNrcy5zb21lKHdhaXRpbmdUYXNrID0+IHRoaXMuY2FuV2FpdEZvclRhc2sod2FpdGluZ1Rhc2ssIHRhc2tUb1dhaXRGb3IpKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gQ2Fubm90IGJlIHdhaXRlZCwgaWYgdGhlIHRhc2tUb1dhaXQgY2Fubm90IGJlIHdhaXRlZCBmb3IgdGhlIHRhc2sgY3JlYXRlZCB0aGUgdGFza1RvV2FpdEZvclxuXHRcdFx0Ly8gQmVjYXVzZSwgdGhlIHRhc2sgd2FpdHMgZm9yIHRoZSB0YXNrcyBpdCBjcmVhdGVkXG5cdFx0XHRpZiAodGFzayA9PT0gdGFza1RvV2FpdEZvciAmJiB3YWl0aW5nVGFza3NbMF0gJiYgIXRoaXMuY2FuV2FpdEZvclRhc2sodGFza1RvV2FpdCwgd2FpdGluZ1Rhc2tzWzBdKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBqb2luQWxsU2V0dGxlZDxUPihwcm9taXNlczogUHJvbWlzZTxUPltdLCBlcnJvckNvZGU/OiBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlKTogUHJvbWlzZTxUW10+IHtcblx0XHRjb25zdCByZXN1bHRzOiBUW10gPSBbXTtcblx0XHRjb25zdCBlcnJvcnM6IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcltdID0gW107XG5cdFx0Y29uc3QgcHJvbWlzZVJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQocHJvbWlzZXMpO1xuXHRcdGZvciAoY29uc3QgciBvZiBwcm9taXNlUmVzdWx0cykge1xuXHRcdFx0aWYgKHIuc3RhdHVzID09PSAnZnVsZmlsbGVkJykge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goci52YWx1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlcnJvcnMucHVzaCh0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihyLnJlYXNvbiwgZXJyb3JDb2RlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFlcnJvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0cztcblx0XHR9XG5cblx0XHQvLyBUaHJvdyBpZiB0aGVyZSBhcmUgZXJyb3JzXG5cdFx0aWYgKGVycm9ycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHRocm93IGVycm9yc1swXTtcblx0XHR9XG5cblx0XHRsZXQgZXJyb3IgPSBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKCcnLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlVua25vd24pO1xuXHRcdGZvciAoY29uc3QgY3VycmVudCBvZiBlcnJvcnMpIHtcblx0XHRcdGVycm9yID0gbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihcblx0XHRcdFx0ZXJyb3IubWVzc2FnZSA/IGAke2Vycm9yLm1lc3NhZ2V9LCAke2N1cnJlbnQubWVzc2FnZX1gIDogY3VycmVudC5tZXNzYWdlLFxuXHRcdFx0XHRjdXJyZW50LmNvZGUgIT09IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuVW5rbm93biAmJiBjdXJyZW50LmNvZGUgIT09IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuSW50ZXJuYWwgPyBjdXJyZW50LmNvZGUgOiBlcnJvci5jb2RlXG5cdFx0XHQpO1xuXHRcdH1cblx0XHR0aHJvdyBlcnJvcjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QWxsRGVwc0FuZFBhY2tFeHRlbnNpb25zKGV4dGVuc2lvbklkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyLCBtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LCBpbnN0YWxsUHJlUmVsZWFzZTogYm9vbGVhbiwgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbik6IFByb21pc2U8eyBnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbjsgbWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCB9W10+IHtcblx0XHRpZiAoIXRoaXMuZ2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBrbm93bklkZW50aWZpZXJzOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdID0gW107XG5cblx0XHRjb25zdCBhbGxEZXBlbmRlbmNpZXNBbmRQYWNrczogeyBnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbjsgbWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCB9W10gPSBbXTtcblx0XHRjb25zdCBjb2xsZWN0RGVwZW5kZW5jaWVzQW5kUGFja0V4dGVuc2lvbnNUb0luc3RhbGwgPSBhc3luYyAoZXh0ZW5zaW9uSWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIsIG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdGtub3duSWRlbnRpZmllcnMucHVzaChleHRlbnNpb25JZGVudGlmaWVyKTtcblx0XHRcdGNvbnN0IGRlcGVuZGVjaWVzOiBzdHJpbmdbXSA9IG1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcyB8fCBbXTtcblx0XHRcdGNvbnN0IGRlcGVuZGVuY2llc0FuZFBhY2tFeHRlbnNpb25zID0gWy4uLmRlcGVuZGVjaWVzXTtcblx0XHRcdGlmIChtYW5pZmVzdC5leHRlbnNpb25QYWNrKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIG1hbmlmZXN0LmV4dGVuc2lvblBhY2spIHtcblx0XHRcdFx0XHRpZiAoZGVwZW5kZW5jaWVzQW5kUGFja0V4dGVuc2lvbnMuZXZlcnkoZSA9PiAhYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogZSB9LCB7IGlkOiBleHRlbnNpb24gfSkpKSB7XG5cdFx0XHRcdFx0XHRkZXBlbmRlbmNpZXNBbmRQYWNrRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkZXBlbmRlbmNpZXNBbmRQYWNrRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0Ly8gZmlsdGVyIG91dCBrbm93biBleHRlbnNpb25zXG5cdFx0XHRcdGNvbnN0IGlkcyA9IGRlcGVuZGVuY2llc0FuZFBhY2tFeHRlbnNpb25zLmZpbHRlcihpZCA9PiBrbm93bklkZW50aWZpZXJzLmV2ZXJ5KGdhbGxlcnlJZGVudGlmaWVyID0+ICFhcmVTYW1lRXh0ZW5zaW9ucyhnYWxsZXJ5SWRlbnRpZmllciwgeyBpZCB9KSkpO1xuXHRcdFx0XHRpZiAoaWRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKGlkcy5tYXAoaWQgPT4gKHsgaWQsIHByZVJlbGVhc2U6IGluc3RhbGxQcmVSZWxlYXNlIH0pKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBnYWxsZXJ5RXh0ZW5zaW9uIG9mIGdhbGxlcnlFeHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0XHRpZiAoa25vd25JZGVudGlmaWVycy5maW5kKGlkZW50aWZpZXIgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaWRlbnRpZmllciwgZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBpc0RlcGVuZGVuY3kgPSBkZXBlbmRlY2llcy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdFx0XHRsZXQgY29tcGF0aWJsZTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbXBhdGlibGUgPSBhd2FpdCB0aGlzLmNoZWNrQW5kR2V0Q29tcGF0aWJsZVZlcnNpb24oZ2FsbGVyeUV4dGVuc2lvbiwgZmFsc2UsIGluc3RhbGxQcmVSZWxlYXNlLCBwcm9kdWN0VmVyc2lvbik7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdFx0XHRpZiAoIWlzRGVwZW5kZW5jeSkge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTa2lwcGluZyB0aGUgcGFja2VkIGV4dGVuc2lvbiBhcyBpdCBjYW5ub3QgYmUgaW5zdGFsbGVkJywgZ2FsbGVyeUV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YWxsRGVwZW5kZW5jaWVzQW5kUGFja3MucHVzaCh7IGdhbGxlcnk6IGNvbXBhdGlibGUuZXh0ZW5zaW9uLCBtYW5pZmVzdDogY29tcGF0aWJsZS5tYW5pZmVzdCB9KTtcblx0XHRcdFx0XHRcdGF3YWl0IGNvbGxlY3REZXBlbmRlbmNpZXNBbmRQYWNrRXh0ZW5zaW9uc1RvSW5zdGFsbChjb21wYXRpYmxlLmV4dGVuc2lvbi5pZGVudGlmaWVyLCBjb21wYXRpYmxlLm1hbmlmZXN0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0YXdhaXQgY29sbGVjdERlcGVuZGVuY2llc0FuZFBhY2tFeHRlbnNpb25zVG9JbnN0YWxsKGV4dGVuc2lvbklkZW50aWZpZXIsIG1hbmlmZXN0KTtcblx0XHRyZXR1cm4gYWxsRGVwZW5kZW5jaWVzQW5kUGFja3M7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNoZWNrQW5kR2V0Q29tcGF0aWJsZVZlcnNpb24oZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgc2FtZVZlcnNpb246IGJvb2xlYW4sIGluc3RhbGxQcmVSZWxlYXNlOiBib29sZWFuLCBwcm9kdWN0VmVyc2lvbjogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTx7IGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb247IG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QgfT4ge1xuXHRcdGxldCBjb21wYXRpYmxlRXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiB8IG51bGw7XG5cblx0XHRjb25zdCBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0ID0gYXdhaXQgdGhpcy5nZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk7XG5cdFx0aWYgKGlzTWFsaWNpb3VzKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0Lm1hbGljaW91cykpIHtcblx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmxzLmxvY2FsaXplKCdtYWxpY2lvdXMgZXh0ZW5zaW9uJywgXCJDYW4ndCBpbnN0YWxsICd7MH0nIGV4dGVuc2lvbiBzaW5jZSBpdCB3YXMgcmVwb3J0ZWQgdG8gYmUgcHJvYmxlbWF0aWMuXCIsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5NYWxpY2lvdXMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRlcHJlY2F0aW9uSW5mbyA9IGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QuZGVwcmVjYXRlZFtleHRlbnNpb24uaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpXTtcblx0XHRpZiAoZGVwcmVjYXRpb25JbmZvPy5leHRlbnNpb24/LmF1dG9NaWdyYXRlKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgVGhlICcke2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkfScgZXh0ZW5zaW9uIGlzIGRlcHJlY2F0ZWQsIGZldGNoaW5nIHRoZSBjb21wYXRpYmxlICcke2RlcHJlY2F0aW9uSW5mby5leHRlbnNpb24uaWR9JyBleHRlbnNpb24gaW5zdGVhZC5gKTtcblx0XHRcdGNvbXBhdGlibGVFeHRlbnNpb24gPSAoYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiBkZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uLmlkLCBwcmVSZWxlYXNlOiBkZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uLnByZVJlbGVhc2UgfV0sIHsgdGFyZ2V0UGxhdGZvcm06IGF3YWl0IHRoaXMuZ2V0VGFyZ2V0UGxhdGZvcm0oKSwgY29tcGF0aWJsZTogdHJ1ZSwgcHJvZHVjdFZlcnNpb24gfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdO1xuXHRcdFx0aWYgKCFjb21wYXRpYmxlRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmxzLmxvY2FsaXplKCdub3RGb3VuZERlcHJlY2F0ZWRSZXBsYWNlbWVudEV4dGVuc2lvbicsIFwiQ2FuJ3QgaW5zdGFsbCAnezB9JyBleHRlbnNpb24gc2luY2UgaXQgd2FzIGRlcHJlY2F0ZWQgYW5kIHRoZSByZXBsYWNlbWVudCBleHRlbnNpb24gJ3sxfScgY2FuJ3QgYmUgZm91bmQuXCIsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBkZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uLmlkKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5EZXByZWNhdGVkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbHNlIHtcblx0XHRcdGlmIChhd2FpdCB0aGlzLmNhbkluc3RhbGwoZXh0ZW5zaW9uKSAhPT0gdHJ1ZSkge1xuXHRcdFx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZ2V0VGFyZ2V0UGxhdGZvcm0oKTtcblx0XHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihubHMubG9jYWxpemUoJ2luY29tcGF0aWJsZSBwbGF0Zm9ybScsIFwiVGhlICd7MH0nIGV4dGVuc2lvbiBpcyBub3QgYXZhaWxhYmxlIGluIHsxfSBmb3IgdGhlIHsyfS5cIiwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcsIFRhcmdldFBsYXRmb3JtVG9TdHJpbmcodGFyZ2V0UGxhdGZvcm0pKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbmNvbXBhdGlibGVUYXJnZXRQbGF0Zm9ybSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbXBhdGlibGVFeHRlbnNpb24gPSBhd2FpdCB0aGlzLmdldENvbXBhdGlibGVWZXJzaW9uKGV4dGVuc2lvbiwgc2FtZVZlcnNpb24sIGluc3RhbGxQcmVSZWxlYXNlLCBwcm9kdWN0VmVyc2lvbik7XG5cdFx0XHRpZiAoIWNvbXBhdGlibGVFeHRlbnNpb24pIHtcblx0XHRcdFx0Y29uc3QgaW5jb21wYXRpYmxlQXBpUHJvcG9zYWxzTWVzc2FnZXM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRcdGlmICghYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShleHRlbnNpb24ucHJvcGVydGllcy5lbmFibGVkQXBpUHJvcG9zYWxzID8/IFtdLCBpbmNvbXBhdGlibGVBcGlQcm9wb3NhbHNNZXNzYWdlcykpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKG5scy5sb2NhbGl6ZSgnaW5jb21wYXRpYmxlQVBJJywgXCJDYW4ndCBpbnN0YWxsICd7MH0nIGV4dGVuc2lvbi4gezF9XCIsIGV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgaW5jb21wYXRpYmxlQXBpUHJvcG9zYWxzTWVzc2FnZXNbMF0pLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLkluY29tcGF0aWJsZUFwaSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0LyoqIElmIG5vIGNvbXBhdGlibGUgcmVsZWFzZSB2ZXJzaW9uIGlzIGZvdW5kLCBjaGVjayBpZiB0aGUgZXh0ZW5zaW9uIGhhcyBhIHJlbGVhc2UgdmVyc2lvbiBvciBub3QgYW5kIHRocm93IHJlbGV2YW50IGVycm9yICovXG5cdFx0XHRcdGlmICghaW5zdGFsbFByZVJlbGVhc2UgJiYgZXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbiAmJiAoYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFtleHRlbnNpb24uaWRlbnRpZmllcl0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IobmxzLmxvY2FsaXplKCdub3RGb3VuZFJlbGVhc2VFeHRlbnNpb24nLCBcIkNhbid0IGluc3RhbGwgcmVsZWFzZSB2ZXJzaW9uIG9mICd7MH0nIGV4dGVuc2lvbiBiZWNhdXNlIGl0IGhhcyBubyByZWxlYXNlIHZlcnNpb24uXCIsIGV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24uaWRlbnRpZmllci5pZCksIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuUmVsZWFzZVZlcnNpb25Ob3RGb3VuZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihubHMubG9jYWxpemUoJ25vdEZvdW5kQ29tcGF0aWJsZURlcGVuZGVuY3knLCBcIkNhbid0IGluc3RhbGwgJ3swfScgZXh0ZW5zaW9uIGJlY2F1c2UgaXQgaXMgbm90IGNvbXBhdGlibGUgd2l0aCB0aGUgY3VycmVudCB2ZXJzaW9uIG9mIHsxfSAodmVyc2lvbiB7Mn0pLlwiLCBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZywgdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uKSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbmNvbXBhdGlibGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdHZXR0aW5nIE1hbmlmZXN0Li4uJywgY29tcGF0aWJsZUV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QoY29tcGF0aWJsZUV4dGVuc2lvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0aWYgKG1hbmlmZXN0ID09PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGBNaXNzaW5nIG1hbmlmZXN0IGZvciBleHRlbnNpb24gJHtjb21wYXRpYmxlRXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9YCwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbnZhbGlkKTtcblx0XHR9XG5cblx0XHRpZiAobWFuaWZlc3QudmVyc2lvbiAhPT0gY29tcGF0aWJsZUV4dGVuc2lvbi52ZXJzaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yKGBDYW5ub3QgaW5zdGFsbCAnJHtjb21wYXRpYmxlRXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9JyBleHRlbnNpb24gYmVjYXVzZSBvZiB2ZXJzaW9uIG1pc21hdGNoIGluIE1hcmtldHBsYWNlYCwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbnZhbGlkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBleHRlbnNpb246IGNvbXBhdGlibGVFeHRlbnNpb24sIG1hbmlmZXN0IH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0Q29tcGF0aWJsZVZlcnNpb24oZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgc2FtZVZlcnNpb246IGJvb2xlYW4sIGluY2x1ZGVQcmVSZWxlYXNlOiBib29sZWFuLCBwcm9kdWN0VmVyc2lvbjogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTxJR2FsbGVyeUV4dGVuc2lvbiB8IG51bGw+IHtcblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZ2V0VGFyZ2V0UGxhdGZvcm0oKTtcblx0XHRsZXQgY29tcGF0aWJsZUV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmICghc2FtZVZlcnNpb24gJiYgZXh0ZW5zaW9uLmhhc1ByZVJlbGVhc2VWZXJzaW9uICYmIGV4dGVuc2lvbi5wcm9wZXJ0aWVzLmlzUHJlUmVsZWFzZVZlcnNpb24gIT09IGluY2x1ZGVQcmVSZWxlYXNlKSB7XG5cdFx0XHRjb21wYXRpYmxlRXh0ZW5zaW9uID0gKGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyAuLi5leHRlbnNpb24uaWRlbnRpZmllciwgcHJlUmVsZWFzZTogaW5jbHVkZVByZVJlbGVhc2UgfV0sIHsgdGFyZ2V0UGxhdGZvcm0sIGNvbXBhdGlibGU6IHRydWUsIHByb2R1Y3RWZXJzaW9uIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXSB8fCBudWxsO1xuXHRcdH1cblxuXHRcdGlmICghY29tcGF0aWJsZUV4dGVuc2lvbiAmJiBhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLmlzRXh0ZW5zaW9uQ29tcGF0aWJsZShleHRlbnNpb24sIGluY2x1ZGVQcmVSZWxlYXNlLCB0YXJnZXRQbGF0Zm9ybSwgcHJvZHVjdFZlcnNpb24pKSB7XG5cdFx0XHRjb21wYXRpYmxlRXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdH1cblxuXHRcdGlmICghY29tcGF0aWJsZUV4dGVuc2lvbikge1xuXHRcdFx0aWYgKHNhbWVWZXJzaW9uKSB7XG5cdFx0XHRcdGNvbXBhdGlibGVFeHRlbnNpb24gPSAoYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IC4uLmV4dGVuc2lvbi5pZGVudGlmaWVyLCB2ZXJzaW9uOiBleHRlbnNpb24udmVyc2lvbiB9XSwgeyB0YXJnZXRQbGF0Zm9ybSwgY29tcGF0aWJsZTogdHJ1ZSwgcHJvZHVjdFZlcnNpb24gfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdIHx8IG51bGw7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb21wYXRpYmxlRXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRDb21wYXRpYmxlRXh0ZW5zaW9uKGV4dGVuc2lvbiwgaW5jbHVkZVByZVJlbGVhc2UsIHRhcmdldFBsYXRmb3JtLCBwcm9kdWN0VmVyc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbXBhdGlibGVFeHRlbnNpb247XG5cdH1cblxuXHRhc3luYyB1bmluc3RhbGxFeHRlbnNpb25zKGV4dGVuc2lvbnM6IFVuaW5zdGFsbEV4dGVuc2lvbkluZm9bXSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgZ2V0VW5pbnN0YWxsRXh0ZW5zaW9uVGFza0tleSA9IChleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgdW5pbnN0YWxsT3B0aW9uczogVW5pbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMpID0+IGAke2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCl9JHt1bmluc3RhbGxPcHRpb25zLnZlcnNpb25Pbmx5ID8gYC0ke2V4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9ufWAgOiAnJ31AJHt1bmluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpfWA7XG5cblx0XHRjb25zdCBjcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrID0gKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCB1bmluc3RhbGxPcHRpb25zOiBVbmluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyk6IElVbmluc3RhbGxFeHRlbnNpb25UYXNrID0+IHtcblx0XHRcdGNvbnN0IHVuaW5zdGFsbEV4dGVuc2lvblRhc2sgPSB0aGlzLmNyZWF0ZVVuaW5zdGFsbEV4dGVuc2lvblRhc2soZXh0ZW5zaW9uLCB1bmluc3RhbGxPcHRpb25zKTtcblx0XHRcdHRoaXMudW5pbnN0YWxsaW5nRXh0ZW5zaW9ucy5zZXQoZ2V0VW5pbnN0YWxsRXh0ZW5zaW9uVGFza0tleSh1bmluc3RhbGxFeHRlbnNpb25UYXNrLmV4dGVuc2lvbiwgdW5pbnN0YWxsT3B0aW9ucyksIHVuaW5zdGFsbEV4dGVuc2lvblRhc2spO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1VuaW5zdGFsbGluZyBleHRlbnNpb24gZnJvbSB0aGUgcHJvZmlsZTonLCBgJHtleHRlbnNpb24uaWRlbnRpZmllci5pZH1AJHtleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbn1gLCB1bmluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRcdHRoaXMuX29uVW5pbnN0YWxsRXh0ZW5zaW9uLmZpcmUoeyBpZGVudGlmaWVyOiBleHRlbnNpb24uaWRlbnRpZmllciwgcHJvZmlsZUxvY2F0aW9uOiB1bmluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbiwgYXBwbGljYXRpb25TY29wZWQ6IGV4dGVuc2lvbi5pc0FwcGxpY2F0aW9uU2NvcGVkIH0pO1xuXHRcdFx0cmV0dXJuIHVuaW5zdGFsbEV4dGVuc2lvblRhc2s7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHBvc3RVbmluc3RhbGxFeHRlbnNpb24gPSAoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIHVuaW5zdGFsbE9wdGlvbnM6IFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zLCBlcnJvcj86IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcik6IHZvaWQgPT4ge1xuXHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignRmFpbGVkIHRvIHVuaW5zdGFsbCBleHRlbnNpb24gZnJvbSB0aGUgcHJvZmlsZTonLCBgJHtleHRlbnNpb24uaWRlbnRpZmllci5pZH1AJHtleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbn1gLCB1bmluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpLCBlcnJvci5tZXNzYWdlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdTdWNjZXNzZnVsbHkgdW5pbnN0YWxsZWQgZXh0ZW5zaW9uIGZyb20gdGhlIHByb2ZpbGUnLCBgJHtleHRlbnNpb24uaWRlbnRpZmllci5pZH1AJHtleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbn1gLCB1bmluc3RhbGxPcHRpb25zLnByb2ZpbGVMb2NhdGlvbi50b1N0cmluZygpKTtcblx0XHRcdH1cblx0XHRcdHJlcG9ydFRlbGVtZXRyeSh0aGlzLnRlbGVtZXRyeVNlcnZpY2UsICdleHRlbnNpb25HYWxsZXJ5OnVuaW5zdGFsbCcsIHsgZXh0ZW5zaW9uRGF0YTogZ2V0TG9jYWxFeHRlbnNpb25UZWxlbWV0cnlEYXRhKGV4dGVuc2lvbiksIGVycm9yIH0pO1xuXHRcdFx0dGhpcy5fb25EaWRVbmluc3RhbGxFeHRlbnNpb24uZmlyZSh7IGlkZW50aWZpZXI6IGV4dGVuc2lvbi5pZGVudGlmaWVyLCBlcnJvcjogZXJyb3I/LmNvZGUsIHByb2ZpbGVMb2NhdGlvbjogdW5pbnN0YWxsT3B0aW9ucy5wcm9maWxlTG9jYXRpb24sIGFwcGxpY2F0aW9uU2NvcGVkOiBleHRlbnNpb24uaXNBcHBsaWNhdGlvblNjb3BlZCB9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWxsVGFza3M6IElVbmluc3RhbGxFeHRlbnNpb25UYXNrW10gPSBbXTtcblx0XHRjb25zdCBwcm9jZXNzZWRUYXNrczogSVVuaW5zdGFsbEV4dGVuc2lvblRhc2tbXSA9IFtdO1xuXHRcdGNvbnN0IGFscmVhZHlSZXF1ZXN0ZWRVbmluc3RhbGxzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb1JlbW92ZTogSUxvY2FsRXh0ZW5zaW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IGluc3RhbGxlZEV4dGVuc2lvbnNNYXAgPSBuZXcgUmVzb3VyY2VNYXA8SUxvY2FsRXh0ZW5zaW9uW10+KCk7XG5cdFx0Y29uc3QgZ2V0SW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGFzeW5jIChwcm9maWxlTG9jYXRpb246IFVSSSkgPT4ge1xuXHRcdFx0bGV0IGluc3RhbGxlZCA9IGluc3RhbGxlZEV4dGVuc2lvbnNNYXAuZ2V0KHByb2ZpbGVMb2NhdGlvbik7XG5cdFx0XHRpZiAoIWluc3RhbGxlZCkge1xuXHRcdFx0XHRpbnN0YWxsZWRFeHRlbnNpb25zTWFwLnNldChwcm9maWxlTG9jYXRpb24sIGluc3RhbGxlZCA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGVkKEV4dGVuc2lvblR5cGUuVXNlciwgcHJvZmlsZUxvY2F0aW9uKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaW5zdGFsbGVkO1xuXHRcdH07XG5cblx0XHRmb3IgKGNvbnN0IHsgZXh0ZW5zaW9uLCBvcHRpb25zIH0gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgdW5pbnN0YWxsT3B0aW9uczogVW5pbnN0YWxsRXh0ZW5zaW9uVGFza09wdGlvbnMgPSB7XG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogZXh0ZW5zaW9uLmlzQXBwbGljYXRpb25TY29wZWQgPyB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSA6IG9wdGlvbnM/LnByb2ZpbGVMb2NhdGlvbiA/PyB0aGlzLmdldEN1cnJlbnRFeHRlbnNpb25zTWFuaWZlc3RMb2NhdGlvbigpXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgdW5pbnN0YWxsRXh0ZW5zaW9uVGFzayA9IHRoaXMudW5pbnN0YWxsaW5nRXh0ZW5zaW9ucy5nZXQoZ2V0VW5pbnN0YWxsRXh0ZW5zaW9uVGFza0tleShleHRlbnNpb24sIHVuaW5zdGFsbE9wdGlvbnMpKTtcblx0XHRcdGlmICh1bmluc3RhbGxFeHRlbnNpb25UYXNrKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdFeHRlbnNpb25zIGlzIGFscmVhZHkgcmVxdWVzdGVkIHRvIHVuaW5zdGFsbCcsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0YWxyZWFkeVJlcXVlc3RlZFVuaW5zdGFsbHMucHVzaCh1bmluc3RhbGxFeHRlbnNpb25UYXNrLndhaXRVbnRpbFRhc2tJc0ZpbmlzaGVkKCkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YWxsVGFza3MucHVzaChjcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrKGV4dGVuc2lvbiwgdW5pbnN0YWxsT3B0aW9ucykpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodW5pbnN0YWxsT3B0aW9ucy5yZW1vdmUpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvUmVtb3ZlLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0Zm9yIChjb25zdCBwcm9maWxlIG9mIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UucHJvZmlsZXMpIHtcblx0XHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwocHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UsIHVuaW5zdGFsbE9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IGdldEluc3RhbGxlZEV4dGVuc2lvbnMocHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHByb2ZpbGVFeHRlbnNpb24gPSBpbnN0YWxsZWQuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0XHRpZiAocHJvZmlsZUV4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0Y29uc3QgdW5pbnN0YWxsT3B0aW9uc1dpdGhQcm9maWxlID0geyAuLi51bmluc3RhbGxPcHRpb25zLCBwcm9maWxlTG9jYXRpb246IHByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlIH07XG5cdFx0XHRcdFx0XHRjb25zdCB1bmluc3RhbGxFeHRlbnNpb25UYXNrID0gdGhpcy51bmluc3RhbGxpbmdFeHRlbnNpb25zLmdldChnZXRVbmluc3RhbGxFeHRlbnNpb25UYXNrS2V5KHByb2ZpbGVFeHRlbnNpb24sIHVuaW5zdGFsbE9wdGlvbnNXaXRoUHJvZmlsZSkpO1xuXHRcdFx0XHRcdFx0aWYgKHVuaW5zdGFsbEV4dGVuc2lvblRhc2spIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ0V4dGVuc2lvbnMgaXMgYWxyZWFkeSByZXF1ZXN0ZWQgdG8gdW5pbnN0YWxsJywgcHJvZmlsZUV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0XHRcdFx0YWxyZWFkeVJlcXVlc3RlZFVuaW5zdGFsbHMucHVzaCh1bmluc3RhbGxFeHRlbnNpb25UYXNrLndhaXRVbnRpbFRhc2tJc0ZpbmlzaGVkKCkpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0YWxsVGFza3MucHVzaChjcmVhdGVVbmluc3RhbGxFeHRlbnNpb25UYXNrKHByb2ZpbGVFeHRlbnNpb24sIHVuaW5zdGFsbE9wdGlvbnNXaXRoUHJvZmlsZSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgYWxsVGFza3Muc2xpY2UoMCkpIHtcblx0XHRcdFx0Y29uc3QgaW5zdGFsbGVkID0gYXdhaXQgZ2V0SW5zdGFsbGVkRXh0ZW5zaW9ucyh0YXNrLm9wdGlvbnMucHJvZmlsZUxvY2F0aW9uKTtcblxuXHRcdFx0XHRpZiAodGFzay5vcHRpb25zLmRvbm90SW5jbHVkZVBhY2spIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnVW5pbnN0YWxsaW5nIHRoZSBleHRlbnNpb24gd2l0aG91dCBpbmNsdWRpbmcgcGFja2VkIGV4dGVuc2lvbicsIGAke3Rhc2suZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9QCR7dGFzay5leHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbn1gKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBwYWNrZWRFeHRlbnNpb25zID0gdGhpcy5nZXRBbGxQYWNrRXh0ZW5zaW9uc1RvVW5pbnN0YWxsKHRhc2suZXh0ZW5zaW9uLCBpbnN0YWxsZWQpO1xuXHRcdFx0XHRcdGZvciAoY29uc3QgcGFja2VkRXh0ZW5zaW9uIG9mIHBhY2tlZEV4dGVuc2lvbnMpIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLnVuaW5zdGFsbGluZ0V4dGVuc2lvbnMuaGFzKGdldFVuaW5zdGFsbEV4dGVuc2lvblRhc2tLZXkocGFja2VkRXh0ZW5zaW9uLCB0YXNrLm9wdGlvbnMpKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnRXh0ZW5zaW9ucyBpcyBhbHJlYWR5IHJlcXVlc3RlZCB0byB1bmluc3RhbGwnLCBwYWNrZWRFeHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRhbGxUYXNrcy5wdXNoKGNyZWF0ZVVuaW5zdGFsbEV4dGVuc2lvblRhc2socGFja2VkRXh0ZW5zaW9uLCB0YXNrLm9wdGlvbnMpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRhc2sub3B0aW9ucy5kb25vdENoZWNrRGVwZW5kZW50cykge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdVbmluc3RhbGxpbmcgdGhlIGV4dGVuc2lvbiB3aXRob3V0IGNoZWNraW5nIGRlcGVuZGVudHMnLCBgJHt0YXNrLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkfUAke3Rhc2suZXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb259YCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jaGVja0ZvckRlcGVuZGVudHMoYWxsVGFza3MubWFwKHRhc2sgPT4gdGFzay5leHRlbnNpb24pLCBpbnN0YWxsZWQsIHRhc2suZXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBVbmluc3RhbGwgZXh0ZW5zaW9ucyBpbiBwYXJhbGxlbCBhbmQgd2FpdCB1bnRpbCBhbGwgZXh0ZW5zaW9ucyBhcmUgdW5pbnN0YWxsZWQgLyBmYWlsZWRcblx0XHRcdGF3YWl0IHRoaXMuam9pbkFsbFNldHRsZWQoYWxsVGFza3MubWFwKGFzeW5jIHRhc2sgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRhc2sucnVuKCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5qb2luQWxsU2V0dGxlZCh0aGlzLnBhcnRpY2lwYW50cy5tYXAocGFydGljaXBhbnQgPT4gcGFydGljaXBhbnQucG9zdFVuaW5zdGFsbCh0YXNrLmV4dGVuc2lvbiwgdGFzay5vcHRpb25zLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSkpO1xuXHRcdFx0XHRcdC8vIG9ubHkgcmVwb3J0IGlmIGV4dGVuc2lvbiBoYXMgYSBtYXBwZWQgZ2FsbGVyeSBleHRlbnNpb24uIFVVSUQgaWRlbnRpZmllcyB0aGUgZ2FsbGVyeSBleHRlbnNpb24uXG5cdFx0XHRcdFx0aWYgKHRhc2suZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCkge1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5yZXBvcnRTdGF0aXN0aWModGFzay5leHRlbnNpb24ubWFuaWZlc3QucHVibGlzaGVyLCB0YXNrLmV4dGVuc2lvbi5tYW5pZmVzdC5uYW1lLCB0YXNrLmV4dGVuc2lvbi5tYW5pZmVzdC52ZXJzaW9uLCBTdGF0aXN0aWNUeXBlLlVuaW5zdGFsbCk7XG5cdFx0XHRcdFx0XHR9IGNhdGNoIChlcnJvcikgeyAvKiBpZ25vcmUgKi8gfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yID0gdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZSk7XG5cdFx0XHRcdFx0cG9zdFVuaW5zdGFsbEV4dGVuc2lvbih0YXNrLmV4dGVuc2lvbiwgdGFzay5vcHRpb25zLCBlcnJvcik7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0cHJvY2Vzc2VkVGFza3MucHVzaCh0YXNrKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRpZiAoYWxyZWFkeVJlcXVlc3RlZFVuaW5zdGFsbHMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuam9pbkFsbFNldHRsZWQoYWxyZWFkeVJlcXVlc3RlZFVuaW5zdGFsbHMpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgYWxsVGFza3MpIHtcblx0XHRcdFx0cG9zdFVuaW5zdGFsbEV4dGVuc2lvbih0YXNrLmV4dGVuc2lvbiwgdGFzay5vcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dGVuc2lvbnNUb1JlbW92ZS5sZW5ndGgpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5qb2luQWxsU2V0dGxlZChleHRlbnNpb25zVG9SZW1vdmUubWFwKGV4dGVuc2lvbiA9PiB0aGlzLnJlbW92ZUV4dGVuc2lvbihleHRlbnNpb24pKSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSB0b0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlKTtcblx0XHRcdGZvciAoY29uc3QgdGFzayBvZiBhbGxUYXNrcykge1xuXHRcdFx0XHQvLyBjYW5jZWwgdGhlIHRhc2tzXG5cdFx0XHRcdHRyeSB7IHRhc2suY2FuY2VsKCk7IH0gY2F0Y2ggKGVycm9yKSB7IC8qIGlnbm9yZSAqLyB9XG5cdFx0XHRcdGlmICghcHJvY2Vzc2VkVGFza3MuaW5jbHVkZXModGFzaykpIHtcblx0XHRcdFx0XHRwb3N0VW5pbnN0YWxsRXh0ZW5zaW9uKHRhc2suZXh0ZW5zaW9uLCB0YXNrLm9wdGlvbnMsIGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdC8vIFJlbW92ZSB0YXNrcyBmcm9tIGNhY2hlXG5cdFx0XHRmb3IgKGNvbnN0IHRhc2sgb2YgYWxsVGFza3MpIHtcblx0XHRcdFx0aWYgKCF0aGlzLnVuaW5zdGFsbGluZ0V4dGVuc2lvbnMuZGVsZXRlKGdldFVuaW5zdGFsbEV4dGVuc2lvblRhc2tLZXkodGFzay5leHRlbnNpb24sIHRhc2sub3B0aW9ucykpKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ1VuaW5zdGFsbGF0aW9uIHRhc2sgaXMgbm90IGZvdW5kIGluIHRoZSBjYWNoZScsIHRhc2suZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0ZvckRlcGVuZGVudHMoZXh0ZW5zaW9uc1RvVW5pbnN0YWxsOiBJTG9jYWxFeHRlbnNpb25bXSwgaW5zdGFsbGVkOiBJTG9jYWxFeHRlbnNpb25bXSwgZXh0ZW5zaW9uVG9Vbmluc3RhbGw6IElMb2NhbEV4dGVuc2lvbik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnNUb1VuaW5zdGFsbCkge1xuXHRcdFx0Y29uc3QgZGVwZW5kZW50cyA9IHRoaXMuZ2V0RGVwZW5kZW50cyhleHRlbnNpb24sIGluc3RhbGxlZCk7XG5cdFx0XHRpZiAoZGVwZW5kZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgcmVtYWluaW5nRGVwZW5kZW50cyA9IGRlcGVuZGVudHMuZmlsdGVyKGRlcGVuZGVudCA9PiAhZXh0ZW5zaW9uc1RvVW5pbnN0YWxsLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGRlcGVuZGVudC5pZGVudGlmaWVyKSkpO1xuXHRcdFx0XHRpZiAocmVtYWluaW5nRGVwZW5kZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IodGhpcy5nZXREZXBlbmRlbnRzRXJyb3JNZXNzYWdlKGV4dGVuc2lvbiwgcmVtYWluaW5nRGVwZW5kZW50cywgZXh0ZW5zaW9uVG9Vbmluc3RhbGwpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVwZW5kZW50c0Vycm9yTWVzc2FnZShkZXBlbmRpbmdFeHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgZGVwZW5kZW50czogSUxvY2FsRXh0ZW5zaW9uW10sIGV4dGVuc2lvblRvVW5pbnN0YWxsOiBJTG9jYWxFeHRlbnNpb24pOiBzdHJpbmcge1xuXHRcdGlmIChleHRlbnNpb25Ub1VuaW5zdGFsbCA9PT0gZGVwZW5kaW5nRXh0ZW5zaW9uKSB7XG5cdFx0XHRpZiAoZGVwZW5kZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnc2luZ2xlRGVwZW5kZW50RXJyb3InLCBcIkNhbm5vdCB1bmluc3RhbGwgJ3swfScgZXh0ZW5zaW9uLiAnezF9JyBleHRlbnNpb24gZGVwZW5kcyBvbiB0aGlzLlwiLFxuXHRcdFx0XHRcdGV4dGVuc2lvblRvVW5pbnN0YWxsLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvblRvVW5pbnN0YWxsLm1hbmlmZXN0Lm5hbWUsIGRlcGVuZGVudHNbMF0ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZGVwZW5kZW50c1swXS5tYW5pZmVzdC5uYW1lKTtcblx0XHRcdH1cblx0XHRcdGlmIChkZXBlbmRlbnRzLmxlbmd0aCA9PT0gMikge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCd0d29EZXBlbmRlbnRzRXJyb3InLCBcIkNhbm5vdCB1bmluc3RhbGwgJ3swfScgZXh0ZW5zaW9uLiAnezF9JyBhbmQgJ3syfScgZXh0ZW5zaW9ucyBkZXBlbmQgb24gdGhpcy5cIixcblx0XHRcdFx0XHRleHRlbnNpb25Ub1VuaW5zdGFsbC5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb25Ub1VuaW5zdGFsbC5tYW5pZmVzdC5uYW1lLCBkZXBlbmRlbnRzWzBdLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGRlcGVuZGVudHNbMF0ubWFuaWZlc3QubmFtZSwgZGVwZW5kZW50c1sxXS5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBkZXBlbmRlbnRzWzFdLm1hbmlmZXN0Lm5hbWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnbXVsdGlwbGVEZXBlbmRlbnRzRXJyb3InLCBcIkNhbm5vdCB1bmluc3RhbGwgJ3swfScgZXh0ZW5zaW9uLiAnezF9JywgJ3syfScgYW5kIG90aGVyIGV4dGVuc2lvbiBkZXBlbmQgb24gdGhpcy5cIixcblx0XHRcdFx0ZXh0ZW5zaW9uVG9Vbmluc3RhbGwubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uVG9Vbmluc3RhbGwubWFuaWZlc3QubmFtZSwgZGVwZW5kZW50c1swXS5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBkZXBlbmRlbnRzWzBdLm1hbmlmZXN0Lm5hbWUsIGRlcGVuZGVudHNbMV0ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZGVwZW5kZW50c1sxXS5tYW5pZmVzdC5uYW1lKTtcblx0XHR9XG5cdFx0aWYgKGRlcGVuZGVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzaW5nbGVJbmRpcmVjdERlcGVuZGVudEVycm9yJywgXCJDYW5ub3QgdW5pbnN0YWxsICd7MH0nIGV4dGVuc2lvbiAuIEl0IGluY2x1ZGVzIHVuaW5zdGFsbGluZyAnezF9JyBleHRlbnNpb24gYW5kICd7Mn0nIGV4dGVuc2lvbiBkZXBlbmRzIG9uIHRoaXMuXCIsXG5cdFx0XHRcdGV4dGVuc2lvblRvVW5pbnN0YWxsLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvblRvVW5pbnN0YWxsLm1hbmlmZXN0Lm5hbWUsIGRlcGVuZGluZ0V4dGVuc2lvbi5tYW5pZmVzdC5kaXNwbGF5TmFtZVxuXHRcdFx0fHwgZGVwZW5kaW5nRXh0ZW5zaW9uLm1hbmlmZXN0Lm5hbWUsIGRlcGVuZGVudHNbMF0ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZGVwZW5kZW50c1swXS5tYW5pZmVzdC5uYW1lKTtcblx0XHR9XG5cdFx0aWYgKGRlcGVuZGVudHMubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCd0d29JbmRpcmVjdERlcGVuZGVudHNFcnJvcicsIFwiQ2Fubm90IHVuaW5zdGFsbCAnezB9JyBleHRlbnNpb24uIEl0IGluY2x1ZGVzIHVuaW5zdGFsbGluZyAnezF9JyBleHRlbnNpb24gYW5kICd7Mn0nIGFuZCAnezN9JyBleHRlbnNpb25zIGRlcGVuZCBvbiB0aGlzLlwiLFxuXHRcdFx0XHRleHRlbnNpb25Ub1VuaW5zdGFsbC5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb25Ub1VuaW5zdGFsbC5tYW5pZmVzdC5uYW1lLCBkZXBlbmRpbmdFeHRlbnNpb24ubWFuaWZlc3QuZGlzcGxheU5hbWVcblx0XHRcdHx8IGRlcGVuZGluZ0V4dGVuc2lvbi5tYW5pZmVzdC5uYW1lLCBkZXBlbmRlbnRzWzBdLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGRlcGVuZGVudHNbMF0ubWFuaWZlc3QubmFtZSwgZGVwZW5kZW50c1sxXS5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBkZXBlbmRlbnRzWzFdLm1hbmlmZXN0Lm5hbWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdtdWx0aXBsZUluZGlyZWN0RGVwZW5kZW50c0Vycm9yJywgXCJDYW5ub3QgdW5pbnN0YWxsICd7MH0nIGV4dGVuc2lvbi4gSXQgaW5jbHVkZXMgdW5pbnN0YWxsaW5nICd7MX0nIGV4dGVuc2lvbiBhbmQgJ3syfScsICd7M30nIGFuZCBvdGhlciBleHRlbnNpb25zIGRlcGVuZCBvbiB0aGlzLlwiLFxuXHRcdFx0ZXh0ZW5zaW9uVG9Vbmluc3RhbGwubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uVG9Vbmluc3RhbGwubWFuaWZlc3QubmFtZSwgZGVwZW5kaW5nRXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lXG5cdFx0fHwgZGVwZW5kaW5nRXh0ZW5zaW9uLm1hbmlmZXN0Lm5hbWUsIGRlcGVuZGVudHNbMF0ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZGVwZW5kZW50c1swXS5tYW5pZmVzdC5uYW1lLCBkZXBlbmRlbnRzWzFdLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGRlcGVuZGVudHNbMV0ubWFuaWZlc3QubmFtZSk7XG5cblx0fVxuXG5cdHByaXZhdGUgZ2V0QWxsUGFja0V4dGVuc2lvbnNUb1VuaW5zdGFsbChleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgaW5zdGFsbGVkOiBJTG9jYWxFeHRlbnNpb25bXSwgY2hlY2tlZDogSUxvY2FsRXh0ZW5zaW9uW10gPSBbXSk6IElMb2NhbEV4dGVuc2lvbltdIHtcblx0XHRpZiAoY2hlY2tlZC5pbmRleE9mKGV4dGVuc2lvbikgIT09IC0xKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNoZWNrZWQucHVzaChleHRlbnNpb24pO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNQYWNrID0gZXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvblBhY2sgPyBleHRlbnNpb24ubWFuaWZlc3QuZXh0ZW5zaW9uUGFjayA6IFtdO1xuXHRcdGlmIChleHRlbnNpb25zUGFjay5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHBhY2tlZEV4dGVuc2lvbnMgPSBpbnN0YWxsZWQuZmlsdGVyKGkgPT4gIWkuaXNCdWlsdGluICYmIGV4dGVuc2lvbnNQYWNrLnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBpLmlkZW50aWZpZXIpKSk7XG5cdFx0XHRjb25zdCBwYWNrT2ZQYWNrZWRFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBwYWNrZWRFeHRlbnNpb24gb2YgcGFja2VkRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRwYWNrT2ZQYWNrZWRFeHRlbnNpb25zLnB1c2goLi4udGhpcy5nZXRBbGxQYWNrRXh0ZW5zaW9uc1RvVW5pbnN0YWxsKHBhY2tlZEV4dGVuc2lvbiwgaW5zdGFsbGVkLCBjaGVja2VkKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gWy4uLnBhY2tlZEV4dGVuc2lvbnMsIC4uLnBhY2tPZlBhY2tlZEV4dGVuc2lvbnNdO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIGdldERlcGVuZGVudHMoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIGluc3RhbGxlZDogSUxvY2FsRXh0ZW5zaW9uW10pOiBJTG9jYWxFeHRlbnNpb25bXSB7XG5cdFx0cmV0dXJuIGluc3RhbGxlZC5maWx0ZXIoZSA9PiBlLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcyAmJiBlLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUNvbnRyb2xDYWNoZSgpOiBQcm9taXNlPElFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0PiB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudXBkYXRlQ29udHJvbENhY2hlJyk7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ0V4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnJlZnJlc2hDb250cm9sQ2FjaGUgLSBmYWlsZWQgdG8gZ2V0IGV4dGVuc2lvbiBjb250cm9sIG1hbmlmZXN0JywgZ2V0RXJyb3JNZXNzYWdlKGVycikpO1xuXHRcdFx0cmV0dXJuIHsgbWFsaWNpb3VzOiBbXSwgZGVwcmVjYXRlZDoge30sIHNlYXJjaDogW10gfTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0Q3VycmVudEV4dGVuc2lvbnNNYW5pZmVzdExvY2F0aW9uKCk6IFVSSTtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZUluc3RhbGxFeHRlbnNpb25UYXNrKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGV4dGVuc2lvbjogVVJJIHwgSUdhbGxlcnlFeHRlbnNpb24sIG9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25UYXNrT3B0aW9ucyk6IElJbnN0YWxsRXh0ZW5zaW9uVGFzaztcblx0cHJvdGVjdGVkIGFic3RyYWN0IGNyZWF0ZVVuaW5zdGFsbEV4dGVuc2lvblRhc2soZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIG9wdGlvbnM6IFVuaW5zdGFsbEV4dGVuc2lvblRhc2tPcHRpb25zKTogSVVuaW5zdGFsbEV4dGVuc2lvblRhc2s7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBjb3B5RXh0ZW5zaW9uKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkksIG1ldGFkYXRhPzogUGFydGlhbDxNZXRhZGF0YT4pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCByZW1vdmVFeHRlbnNpb24oZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9FeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3I6IEVycm9yLCBjb2RlPzogRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZSk6IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvciB7XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcikge1xuXHRcdHJldHVybiBlcnJvcjtcblx0fVxuXHRsZXQgZXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yOiBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3I7XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEV4dGVuc2lvbkdhbGxlcnlFcnJvcikge1xuXHRcdGV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvciA9IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IoZXJyb3IubWVzc2FnZSwgZXJyb3IuY29kZSA9PT0gRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZS5Eb3dubG9hZEZhaWxlZFdyaXRpbmcgPyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLkRvd25sb2FkRmFpbGVkV3JpdGluZyA6IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuR2FsbGVyeSk7XG5cdH0gZWxzZSB7XG5cdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yID0gbmV3IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvcihlcnJvci5tZXNzYWdlLCBpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSA/IEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuQ2FuY2VsbGVkIDogKGNvZGUgPz8gRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbnRlcm5hbCkpO1xuXHR9XG5cdGV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvci5zdGFjayA9IGVycm9yLnN0YWNrO1xuXHRyZXR1cm4gZXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yO1xufVxuXG5mdW5jdGlvbiByZXBvcnRUZWxlbWV0cnkodGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsIGV2ZW50TmFtZTogc3RyaW5nLFxuXHR7XG5cdFx0ZXh0ZW5zaW9uRGF0YSxcblx0XHR2ZXJpZmljYXRpb25TdGF0dXMsXG5cdFx0ZHVyYXRpb24sXG5cdFx0ZXJyb3IsXG5cdFx0c291cmNlLFxuXHRcdGR1cmF0aW9uU2luY2VVcGRhdGVcblx0fToge1xuXHRcdGV4dGVuc2lvbkRhdGE6IGFueTtcblx0XHR2ZXJpZmljYXRpb25TdGF0dXM/OiBFeHRlbnNpb25TaWduYXR1cmVWZXJpZmljYXRpb25Db2RlO1xuXHRcdGR1cmF0aW9uPzogbnVtYmVyO1xuXHRcdGR1cmF0aW9uU2luY2VVcGRhdGU/OiBudW1iZXI7XG5cdFx0c291cmNlPzogc3RyaW5nO1xuXHRcdGVycm9yPzogRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yIHwgRXh0ZW5zaW9uR2FsbGVyeUVycm9yO1xuXHR9KTogdm9pZCB7XG5cblx0LyogX19HRFBSX19cblx0XHRcImV4dGVuc2lvbkdhbGxlcnk6aW5zdGFsbFwiIDoge1xuXHRcdFx0XCJvd25lclwiOiBcInNhbmR5MDgxXCIsXG5cdFx0XHRcInN1Y2Nlc3NcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFwiZHVyYXRpb25cIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcImR1cmF0aW9uU2luY2VVcGRhdGVcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcImVycm9yY29kZVwiOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJDYWxsc3RhY2tPckV4Y2VwdGlvblwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiIH0sXG5cdFx0XHRcInJlY29tbWVuZGF0aW9uUmVhc29uXCI6IHsgXCJyZXRpcmVkRnJvbVZlcnNpb25cIjogXCIxLjIzLjBcIiwgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcInZlcmlmaWNhdGlvblN0YXR1c1wiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiB9LFxuXHRcdFx0XCJzb3VyY2VcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiB9LFxuXHRcdFx0XCIke2luY2x1ZGV9XCI6IFtcblx0XHRcdFx0XCIke0dhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhfVwiXG5cdFx0XHRdXG5cdFx0fVxuXHQqL1xuXHQvKiBfX0dEUFJfX1xuXHRcdFwiZXh0ZW5zaW9uR2FsbGVyeTp1bmluc3RhbGxcIiA6IHtcblx0XHRcdFwib3duZXJcIjogXCJzYW5keTA4MVwiLFxuXHRcdFx0XCJzdWNjZXNzXCI6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcImR1cmF0aW9uXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFx0XCJlcnJvcmNvZGVcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiQ2FsbHN0YWNrT3JFeGNlcHRpb25cIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiB9LFxuXHRcdFx0XCIke2luY2x1ZGV9XCI6IFtcblx0XHRcdFx0XCIke0dhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhfVwiXG5cdFx0XHRdXG5cdFx0fVxuXHQqL1xuXHQvKiBfX0dEUFJfX1xuXHRcdFwiZXh0ZW5zaW9uR2FsbGVyeTp1cGRhdGVcIiA6IHtcblx0XHRcdFwib3duZXJcIjogXCJzYW5keTA4MVwiLFxuXHRcdFx0XCJzdWNjZXNzXCI6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcImR1cmF0aW9uXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFx0XCJlcnJvcmNvZGVcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiQ2FsbHN0YWNrT3JFeGNlcHRpb25cIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiB9LFxuXHRcdFx0XCJ2ZXJpZmljYXRpb25TdGF0dXNcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIgfSxcblx0XHRcdFwic291cmNlXCI6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIgfSxcblx0XHRcdFwiJHtpbmNsdWRlfVwiOiBbXG5cdFx0XHRcdFwiJHtHYWxsZXJ5RXh0ZW5zaW9uVGVsZW1ldHJ5RGF0YX1cIlxuXHRcdFx0XVxuXHRcdH1cblx0Ki9cblx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2coZXZlbnROYW1lLCB7XG5cdFx0Li4uZXh0ZW5zaW9uRGF0YSxcblx0XHRzb3VyY2UsXG5cdFx0ZHVyYXRpb24sXG5cdFx0ZHVyYXRpb25TaW5jZVVwZGF0ZSxcblx0XHRzdWNjZXNzOiAhZXJyb3IsXG5cdFx0ZXJyb3Jjb2RlOiBlcnJvcj8uY29kZSxcblx0XHR2ZXJpZmljYXRpb25TdGF0dXM6IHZlcmlmaWNhdGlvblN0YXR1cyA9PT0gRXh0ZW5zaW9uU2lnbmF0dXJlVmVyaWZpY2F0aW9uQ29kZS5TdWNjZXNzID8gJ1ZlcmlmaWVkJyA6ICh2ZXJpZmljYXRpb25TdGF0dXMgPz8gJ1VudmVyaWZpZWQnKVxuXHR9KTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uVGFzazxUPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBiYXJyaWVyID0gbmV3IEJhcnJpZXIoKTtcblx0cHJpdmF0ZSBjYW5jZWxsYWJsZVByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPFQ+IHwgdW5kZWZpbmVkO1xuXG5cdGFzeW5jIHdhaXRVbnRpbFRhc2tJc0ZpbmlzaGVkKCk6IFByb21pc2U8VD4ge1xuXHRcdGF3YWl0IHRoaXMuYmFycmllci53YWl0KCk7XG5cdFx0cmV0dXJuIHRoaXMuY2FuY2VsbGFibGVQcm9taXNlITtcblx0fVxuXG5cdHJ1bigpOiBQcm9taXNlPFQ+IHtcblx0XHRpZiAoIXRoaXMuY2FuY2VsbGFibGVQcm9taXNlKSB7XG5cdFx0XHR0aGlzLmNhbmNlbGxhYmxlUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHRoaXMuZG9SdW4odG9rZW4pKTtcblx0XHR9XG5cdFx0dGhpcy5iYXJyaWVyLm9wZW4oKTtcblx0XHRyZXR1cm4gdGhpcy5jYW5jZWxsYWJsZVByb21pc2U7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmNhbmNlbGxhYmxlUHJvbWlzZSkge1xuXHRcdFx0dGhpcy5jYW5jZWxsYWJsZVByb21pc2UgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSh0b2tlbiA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZSgoYywgZSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdGUobmV3IENhbmNlbGxhdGlvbkVycm9yKCkpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5iYXJyaWVyLm9wZW4oKTtcblx0XHR9XG5cdFx0dGhpcy5jYW5jZWxsYWJsZVByb21pc2UuY2FuY2VsKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZG9SdW4odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUPjtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLHVCQUF1QjtBQUMxQyxTQUFTLFNBQTRCLCtCQUErQjtBQUNwRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG1CQUFtQixpQkFBaUIsMkJBQTJCO0FBQ3hFLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsV0FBVztBQUNwQixZQUFZLFNBQVM7QUFDckI7QUFBQSxFQUNDO0FBQUEsRUFBMEI7QUFBQSxFQUFxSDtBQUFBLEVBQ25IO0FBQUEsRUFBZTtBQUFBLEVBQTRCO0FBQUEsRUFBd0I7QUFBQSxFQUNvRztBQUFBLEVBQW9DO0FBQUEsRUFDdE47QUFBQSxFQUNqQjtBQUFBLEVBR0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsbUJBQW1CLGNBQWMsdUJBQXVCLGtDQUFrQyxnQ0FBZ0MsbUJBQW1CO0FBQ3RKLFNBQVMsZUFBbUMsb0NBQW9EO0FBQ2hHLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQTBCLHNCQUFzQjtBQTBCekMsSUFBZSxvQ0FBZixjQUF5RCxXQUFrRDtBQUFBLEVBSWpILFlBQ3FDLGdCQUNVLDBCQUM3QztBQUNELFVBQU07QUFIOEI7QUFDVTtBQUFBLEVBRy9DO0FBQUEsRUFFQSxNQUFNLFdBQVcsV0FBK0Q7QUFDL0UsVUFBTSxtQkFBbUIsS0FBSyx5QkFB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TSwwQkFBc0M7QUFDM0MsVUFBTSxLQUFLLFFBQVEsS0FBSztBQUN4QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFrQjtBQUNqQixRQUFJLENBQUMsS0FBSyxvQkFBb0I7QUFDN0IsV0FBSyxxQkFBcUIsd0JBQXdCLFdBQVMsS0FBSyxNQUFNLEtBQUssQ0FBQztBQUFBLElBQzdFO0FBQ0EsU0FBSyxRQUFRLEtBQUs7QUFDbEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsU0FBZTtBQUNkLFFBQUksQ0FBQyxLQUFLLG9CQUFvQjtBQUM3QixXQUFLLHFCQUFxQix3QkFBd0IsV0FBUztBQUMxRCxlQUFPLElBQUksUUFBUSxDQUFDLEdBQUcsTUFBTTtBQUM1QixnQkFBTSxhQUFhLE1BQU0sd0JBQXdCLE1BQU07QUFDdEQsdUJBQVcsUUFBUTtBQUNuQixjQUFFLElBQUksa0JBQWtCLENBQUM7QUFBQSxVQUMxQixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDO0FBQ0QsV0FBSyxRQUFRLEtBQUs7QUFBQSxJQUNuQjtBQUNBLFNBQUssbUJBQW1CLE9BQU87QUFBQSxFQUNoQztBQUdEOyIsCiAgIm5hbWVzIjogWyJyZXN1bHRzIiwgInJlc3VsdCIsICJnYWxsZXJ5IiwgImVycm9yIiwgImV4dGVuc2lvbklkZW50aWZpZXIiLCAibWFuaWZlc3QiLCAidW5pbnN0YWxsRXh0ZW5zaW9uVGFzayIsICJ0YXNrIl0KfQo=
