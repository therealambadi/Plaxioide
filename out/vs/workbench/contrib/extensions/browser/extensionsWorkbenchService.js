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
var __decorateParam = (index2, decorator) => (target, key) => decorator(target, key, index2);
import * as nls from "../../../../nls.js";
import * as semver from "../../../../base/common/semver/semver.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { index } from "../../../../base/common/arrays.js";
import { Promises, ThrottledDelayer, createCancelablePromise } from "../../../../base/common/async.js";
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { singlePagePager } from "../../../../base/common/paging.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import {
  IExtensionGalleryService,
  InstallOperation,
  WEB_EXTENSION_TAG,
  isTargetPlatformCompatible,
  EXTENSION_IDENTIFIER_REGEX,
  TargetPlatformToString,
  IAllowedExtensionsService,
  AllowedExtensionsConfigKey,
  EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT,
  ExtensionManagementError,
  ExtensionManagementErrorCode
} from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IWorkbenchExtensionManagementService, DefaultIconPath } from "../../../services/extensionManagement/common/extensionManagement.js";
import { getGalleryExtensionTelemetryData, getLocalExtensionTelemetryData, areSameExtensions, groupByExtension, getGalleryExtensionId, isMalicious } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { URI } from "../../../../base/common/uri.js";
import { ExtensionState, AutoUpdateConfigurationKey, AutoCheckUpdatesConfigurationKey, HasOutdatedExtensionsContext, ExtensionRuntimeActionType, AutoRestartConfigurationKey, VIEWLET_ID } from "../common/extensions.js";
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { ExtensionsInput } from "../common/extensionsInput.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import * as resources from "../../../../base/common/resources.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ExtensionType, TargetPlatform, ExtensionIdentifier, isApplicationScopedExtension } from "../../../../platform/extensions/common/extensions.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { FileAccess } from "../../../../base/common/network.js";
import { IIgnoredExtensionsManagementService } from "../../../../platform/userDataSync/common/ignoredExtensions.js";
import { IUserDataAutoSyncService, IUserDataSyncEnablementService, SyncResource } from "../../../../platform/userDataSync/common/userDataSync.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { isBoolean, isDefined, isString, isUndefined } from "../../../../base/common/types.js";
import { IExtensionManifestPropertiesService } from "../../../services/extensions/common/extensionManifestPropertiesService.js";
import { IExtensionService, toExtension, toExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { isWeb, language } from "../../../../base/common/platform.js";
import { getLocale } from "../../../../platform/languagePacks/common/languagePacks.js";
import { ILocaleService } from "../../../services/localization/common/locale.js";
import { TelemetryTrustedValue } from "../../../../platform/telemetry/common/telemetryUtils.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IUserDataProfileService } from "../../../services/userDataProfile/common/userDataProfile.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IUpdateService, StateType } from "../../../../platform/update/common/update.js";
import { areApiProposalsCompatible, isEngineValid } from "../../../../platform/extensions/common/extensionValidator.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ShowCurrentReleaseNotesActionId } from "../../update/common/update.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { ExtensionGalleryResourceType, getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
let Extension = class {
  constructor(stateProvider, runtimeStateProvider, server, local, _gallery, resourceExtensionInfo, galleryService, telemetryService, logService, fileService, productService) {
    this.stateProvider = stateProvider;
    this.runtimeStateProvider = runtimeStateProvider;
    this.server = server;
    this.local = local;
    this._gallery = _gallery;
    this.resourceExtensionInfo = resourceExtensionInfo;
    this.galleryService = galleryService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this.fileService = fileService;
    this.productService = productService;
    this.enablementState = EnablementState.EnabledGlobally;
    this.galleryResourcesCache = /* @__PURE__ */ new Map();
    this.malicious = false;
  }
  get resourceExtension() {
    if (this.resourceExtensionInfo) {
      return this.resourceExtensionInfo.resourceExtension;
    }
    if (this.local?.isWorkspaceScoped) {
      return {
        type: "resource",
        identifier: this.local.identifier,
        location: this.local.location,
        manifest: this.local.manifest,
        changelogUri: this.local.changelogUrl,
        readmeUri: this.local.readmeUrl
      };
    }
    return void 0;
  }
  get gallery() {
    return this._gallery;
  }
  set gallery(gallery) {
    this._gallery = gallery;
    this.galleryResourcesCache.clear();
  }
  get type() {
    return this.local ? this.local.type : ExtensionType.User;
  }
  get isBuiltin() {
    return this.local ? this.local.isBuiltin : false;
  }
  get isWorkspaceScoped() {
    if (this.local) {
      return this.local.isWorkspaceScoped;
    }
    if (this.resourceExtensionInfo) {
      return this.resourceExtensionInfo.isWorkspaceScoped;
    }
    return false;
  }
  get name() {
    if (this.gallery) {
      return this.gallery.name;
    }
    return this.getManifestFromLocalOrResource()?.name ?? "";
  }
  get displayName() {
    if (this.gallery) {
      return this.gallery.displayName || this.gallery.name;
    }
    return this.getManifestFromLocalOrResource()?.displayName ?? this.name;
  }
  get identifier() {
    if (this.gallery) {
      return this.gallery.identifier;
    }
    if (this.resourceExtension) {
      return this.resourceExtension.identifier;
    }
    return this.local.identifier;
  }
  get uuid() {
    return this.gallery ? this.gallery.identifier.uuid : this.local?.identifier.uuid;
  }
  get publisher() {
    if (this.gallery) {
      return this.gallery.publisher;
    }
    return this.getManifestFromLocalOrResource()?.publisher ?? "";
  }
  get publisherDisplayName() {
    if (this.gallery) {
      return this.gallery.publisherDisplayName || this.gallery.publisher;
    }
    if (this.local?.publisherDisplayName) {
      return this.local.publisherDisplayName;
    }
    return this.publisher;
  }
  get publisherUrl() {
    return this.gallery?.publisherLink ? URI.parse(this.gallery.publisherLink) : void 0;
  }
  get publisherDomain() {
    return this.gallery?.publisherDomain;
  }
  get publisherSponsorLink() {
    return this.gallery?.publisherSponsorLink ? URI.parse(this.gallery.publisherSponsorLink) : void 0;
  }
  get version() {
    return this.local ? this.local.manifest.version : this.latestVersion;
  }
  get private() {
    return this.local ? this.local.private : this.gallery ? this.gallery.private : false;
  }
  get pinned() {
    return !!this.local?.pinned;
  }
  get latestVersion() {
    return this.gallery ? this.gallery.version : this.getManifestFromLocalOrResource()?.version ?? "";
  }
  get description() {
    return this.gallery ? this.gallery.description : this.getManifestFromLocalOrResource()?.description ?? "";
  }
  get url() {
    return this.gallery?.detailsLink;
  }
  get iconUrl() {
    return this.galleryIconUrl || this.resourceExtensionIconUrl || this.localIconUrl || this.defaultIconUrl;
  }
  get iconUrlFallback() {
    return this.galleryIconUrlFallback || this.resourceExtensionIconUrl || this.localIconUrl || this.defaultIconUrl;
  }
  get localIconUrl() {
    if (this.local && this.local.manifest.icon) {
      return FileAccess.uriToBrowserUri(resources.joinPath(this.local.location, this.local.manifest.icon)).toString(true);
    }
    return null;
  }
  get resourceExtensionIconUrl() {
    if (this.resourceExtension?.manifest.icon) {
      return FileAccess.uriToBrowserUri(resources.joinPath(this.resourceExtension.location, this.resourceExtension.manifest.icon)).toString(true);
    }
    return null;
  }
  get galleryIconUrl() {
    return this.gallery?.assets.icon ? this.gallery.assets.icon.uri : null;
  }
  get galleryIconUrlFallback() {
    return this.gallery?.assets.icon ? this.gallery.assets.icon.fallbackUri : null;
  }
  get defaultIconUrl() {
    if (this.type === ExtensionType.System && this.local) {
      if (this.local.manifest && this.local.manifest.contributes) {
        if (Array.isArray(this.local.manifest.contributes.themes) && this.local.manifest.contributes.themes.length) {
          return FileAccess.asBrowserUri("vs/workbench/contrib/extensions/browser/media/theme-icon.png").toString(true);
        }
        if (Array.isArray(this.local.manifest.contributes.grammars) && this.local.manifest.contributes.grammars.length) {
          return FileAccess.asBrowserUri("vs/workbench/contrib/extensions/browser/media/language-icon.svg").toString(true);
        }
      }
    }
    return DefaultIconPath;
  }
  get repository() {
    return this.gallery && this.gallery.assets.repository ? this.gallery.assets.repository.uri : void 0;
  }
  get licenseUrl() {
    return this.gallery && this.gallery.assets.license ? this.gallery.assets.license.uri : void 0;
  }
  get supportUrl() {
    return this.gallery && this.gallery.supportLink ? this.gallery.supportLink : void 0;
  }
  get state() {
    return this.stateProvider(this);
  }
  get isMalicious() {
    return this.malicious || this.enablementState === EnablementState.DisabledByMalicious;
  }
  get installCount() {
    return this.gallery ? this.gallery.installCount : void 0;
  }
  get rating() {
    return this.gallery ? this.gallery.rating : void 0;
  }
  get ratingCount() {
    return this.gallery ? this.gallery.ratingCount : void 0;
  }
  get ratingUrl() {
    return this.gallery?.ratingLink;
  }
  get outdated() {
    try {
      if (!this.gallery || !this.local) {
        return false;
      }
      if (this.type === ExtensionType.System && this.productService.quality === "stable") {
        return false;
      }
      if (!this.local.preRelease && this.gallery.properties.isPreReleaseVersion) {
        return false;
      }
      if (semver.gt(this.latestVersion, this.version)) {
        return true;
      }
      if (this.outdatedTargetPlatform) {
        return true;
      }
    } catch (error) {
    }
    return false;
  }
  get outdatedTargetPlatform() {
    return !!this.local && !!this.gallery && ![TargetPlatform.UNDEFINED, TargetPlatform.WEB].includes(this.local.targetPlatform) && this.gallery.properties.targetPlatform !== TargetPlatform.WEB && this.local.targetPlatform !== this.gallery.properties.targetPlatform && semver.eq(this.latestVersion, this.version);
  }
  get runtimeState() {
    return this.runtimeStateProvider(this);
  }
  get telemetryData() {
    const { local, gallery } = this;
    if (gallery) {
      return getGalleryExtensionTelemetryData(gallery);
    } else if (local) {
      return getLocalExtensionTelemetryData(local);
    } else {
      return {};
    }
  }
  get preview() {
    return this.local?.manifest.preview ?? this.gallery?.preview ?? false;
  }
  get preRelease() {
    return !!this.local?.preRelease;
  }
  get isPreReleaseVersion() {
    if (this.local) {
      return this.local.isPreReleaseVersion;
    }
    return !!this.gallery?.properties.isPreReleaseVersion;
  }
  get hasPreReleaseVersion() {
    return !!this.gallery?.hasPreReleaseVersion || !!this.local?.hasPreReleaseVersion || !!this._extensionEnabledWithPreRelease;
  }
  get hasReleaseVersion() {
    return !!this.resourceExtension || !!this.gallery?.hasReleaseVersion;
  }
  getLocal() {
    return this.local && !this.outdated ? this.local : void 0;
  }
  async getManifest(token) {
    const local = this.getLocal();
    if (local) {
      return local.manifest;
    }
    if (this.gallery) {
      return this.getGalleryManifest(token);
    }
    if (this.resourceExtension) {
      return this.resourceExtension.manifest;
    }
    return null;
  }
  async getGalleryManifest(token = CancellationToken.None) {
    if (this.gallery) {
      let cache = this.galleryResourcesCache.get("manifest");
      if (!cache) {
        if (this.gallery.assets.manifest) {
          this.galleryResourcesCache.set("manifest", cache = this.galleryService.getManifest(this.gallery, token).catch((e) => {
            this.galleryResourcesCache.delete("manifest");
            throw e;
          }));
        } else {
          this.logService.error(nls.localize("Manifest is not found", "Manifest is not found"), this.identifier.id);
        }
      }
      return cache;
    }
    return null;
  }
  hasReadme() {
    if (this.local && this.local.readmeUrl) {
      return true;
    }
    if (this.gallery && this.gallery.assets.readme) {
      return true;
    }
    if (this.resourceExtension?.readmeUri) {
      return true;
    }
    return this.type === ExtensionType.System;
  }
  async getReadme(token) {
    const local = this.getLocal();
    if (local?.readmeUrl) {
      const content = await this.fileService.readFile(local.readmeUrl);
      return content.value.toString();
    }
    if (this.gallery) {
      if (this.gallery.assets.readme) {
        return this.galleryService.getReadme(this.gallery, token);
      }
      this.telemetryService.publicLog("extensions:NotFoundReadMe", this.telemetryData);
    }
    if (this.type === ExtensionType.System) {
      return Promise.resolve(`# ${this.displayName || this.name}
**Notice:** This extension is bundled with Visual Studio Code. It can be disabled but not uninstalled.
## Features
${this.description}
`);
    }
    if (this.resourceExtension?.readmeUri) {
      const content = await this.fileService.readFile(this.resourceExtension?.readmeUri);
      return content.value.toString();
    }
    return Promise.reject(new Error("not available"));
  }
  hasChangelog() {
    if (this.local && this.local.changelogUrl) {
      return true;
    }
    if (this.gallery && this.gallery.assets.changelog) {
      return true;
    }
    return this.type === ExtensionType.System;
  }
  async getChangelog(token) {
    const local = this.getLocal();
    if (local?.changelogUrl) {
      const content = await this.fileService.readFile(local.changelogUrl);
      return content.value.toString();
    }
    if (this.gallery?.assets.changelog) {
      return this.galleryService.getChangelog(this.gallery, token);
    }
    if (this.type === ExtensionType.System) {
      return Promise.resolve(`Please check the [VS Code Release Notes](command:${ShowCurrentReleaseNotesActionId}) for changes to the built-in extensions.`);
    }
    return Promise.reject(new Error("not available"));
  }
  get categories() {
    const { local, gallery, resourceExtension } = this;
    if (local && local.manifest.categories && !this.outdated) {
      return local.manifest.categories;
    }
    if (gallery) {
      return gallery.categories;
    }
    if (resourceExtension) {
      return resourceExtension.manifest.categories ?? [];
    }
    return [];
  }
  get tags() {
    const { gallery } = this;
    if (gallery) {
      return gallery.tags.filter((tag) => !tag.startsWith("_"));
    }
    return [];
  }
  get dependencies() {
    const { local, gallery, resourceExtension } = this;
    if (local && local.manifest.extensionDependencies && !this.outdated) {
      return local.manifest.extensionDependencies;
    }
    if (gallery) {
      return gallery.properties.dependencies || [];
    }
    if (resourceExtension) {
      return resourceExtension.manifest.extensionDependencies || [];
    }
    return [];
  }
  get extensionPack() {
    const { local, gallery, resourceExtension } = this;
    if (local && local.manifest.extensionPack && !this.outdated) {
      return local.manifest.extensionPack;
    }
    if (gallery) {
      return gallery.properties.extensionPack || [];
    }
    if (resourceExtension) {
      return resourceExtension.manifest.extensionPack || [];
    }
    return [];
  }
  setExtensionsControlManifest(extensionsControlManifest) {
    this.malicious = isMalicious(this.identifier, extensionsControlManifest.malicious);
    this.deprecationInfo = extensionsControlManifest.deprecated ? extensionsControlManifest.deprecated[this.identifier.id.toLowerCase()] : void 0;
    this._extensionEnabledWithPreRelease = extensionsControlManifest?.extensionsEnabledWithPreRelease?.includes(this.identifier.id.toLowerCase());
  }
  getManifestFromLocalOrResource() {
    if (this.local) {
      return this.local.manifest;
    }
    if (this.resourceExtension) {
      return this.resourceExtension.manifest;
    }
    return null;
  }
};
Extension = __decorateClass([
  __decorateParam(6, IExtensionGalleryService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IFileService),
  __decorateParam(10, IProductService)
], Extension);
const EXTENSIONS_AUTO_UPDATE_KEY = "extensions.autoUpdate";
const EXTENSIONS_DONOT_AUTO_UPDATE_KEY = "extensions.donotAutoUpdate";
const EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY = "extensions.dismissedNotifications";
let Extensions = class extends Disposable {
  constructor(server, stateProvider, runtimeStateProvider, isWorkspaceServer, galleryService, extensionEnablementService, workbenchExtensionManagementService, telemetryService, instantiationService) {
    super();
    this.server = server;
    this.stateProvider = stateProvider;
    this.runtimeStateProvider = runtimeStateProvider;
    this.isWorkspaceServer = isWorkspaceServer;
    this.galleryService = galleryService;
    this.extensionEnablementService = extensionEnablementService;
    this.workbenchExtensionManagementService = workbenchExtensionManagementService;
    this.telemetryService = telemetryService;
    this.instantiationService = instantiationService;
    this._onChange = this._register(new Emitter());
    this._onReset = this._register(new Emitter());
    this.installing = [];
    this.uninstalling = [];
    this.installed = [];
    this._register(server.extensionManagementService.onInstallExtension((e) => this.onInstallExtension(e)));
    this._register(server.extensionManagementService.onDidInstallExtensions((e) => this.onDidInstallExtensions(e)));
    this._register(server.extensionManagementService.onUninstallExtension((e) => this.onUninstallExtension(e.identifier)));
    this._register(server.extensionManagementService.onDidUninstallExtension((e) => this.onDidUninstallExtension(e)));
    this._register(server.extensionManagementService.onDidUpdateExtensionMetadata((e) => this.onDidUpdateExtensionMetadata(e.local)));
    this._register(server.extensionManagementService.onDidChangeProfile(() => this.reset()));
    this._register(extensionEnablementService.onEnablementChanged((e) => this.onEnablementChanged(e)));
    this._register(Event.any(this.onChange, this.onReset)(() => this._local = void 0));
    if (this.isWorkspaceServer) {
      this._register(this.workbenchExtensionManagementService.onInstallExtension((e) => {
        if (e.workspaceScoped) {
          this.onInstallExtension(e);
        }
      }));
      this._register(this.workbenchExtensionManagementService.onDidInstallExtensions((e) => {
        const result = e.filter((e2) => e2.workspaceScoped);
        if (result.length) {
          this.onDidInstallExtensions(result);
        }
      }));
      this._register(this.workbenchExtensionManagementService.onUninstallExtension((e) => {
        if (e.workspaceScoped) {
          this.onUninstallExtension(e.identifier);
        }
      }));
      this._register(this.workbenchExtensionManagementService.onDidUninstallExtension((e) => {
        if (e.workspaceScoped) {
          this.onDidUninstallExtension(e);
        }
      }));
    }
  }
  get onChange() {
    return this._onChange.event;
  }
  get onReset() {
    return this._onReset.event;
  }
  get local() {
    if (!this._local) {
      this._local = [];
      for (const extension of this.installed) {
        this._local.push(extension);
      }
      for (const extension of this.installing) {
        if (!this.installed.some((installed) => areSameExtensions(installed.identifier, extension.identifier))) {
          this._local.push(extension);
        }
      }
    }
    return this._local;
  }
  async queryInstalled(productVersion) {
    await this.fetchInstalledExtensions(productVersion);
    this._onChange.fire(void 0);
    return this.local;
  }
  async syncInstalledExtensionsWithGallery(galleryExtensions, productVersion) {
    const extensions = await this.mapInstalledExtensionWithCompatibleGalleryExtension(galleryExtensions, productVersion);
    for (const [extension, gallery] of extensions) {
      if (extension.local && extension.local.identifier.uuid !== gallery.identifier.uuid) {
        extension.local = await this.updateMetadata(extension.local, gallery);
      }
      if (!extension.gallery || extension.gallery.version !== gallery.version || extension.gallery.properties.targetPlatform !== gallery.properties.targetPlatform) {
        extension.gallery = gallery;
        this._onChange.fire({ extension });
      }
    }
  }
  async mapInstalledExtensionWithCompatibleGalleryExtension(galleryExtensions, productVersion) {
    const mappedExtensions = this.mapInstalledExtensionWithGalleryExtension(galleryExtensions);
    const targetPlatform = await this.server.extensionManagementService.getTargetPlatform();
    const compatibleGalleryExtensions = [];
    const compatibleGalleryExtensionsToFetch = [];
    await Promise.allSettled(mappedExtensions.map(async ([extension, gallery]) => {
      if (extension.local) {
        if (await this.galleryService.isExtensionCompatible(gallery, extension.local.preRelease, targetPlatform, productVersion)) {
          compatibleGalleryExtensions.push(gallery);
        } else {
          compatibleGalleryExtensionsToFetch.push({ ...extension.local.identifier, preRelease: extension.local.preRelease });
        }
      }
    }));
    if (compatibleGalleryExtensionsToFetch.length) {
      const result = await this.galleryService.getExtensions(compatibleGalleryExtensionsToFetch, { targetPlatform, compatible: true, queryAllVersions: true, productVersion }, CancellationToken.None);
      compatibleGalleryExtensions.push(...result);
    }
    return this.mapInstalledExtensionWithGalleryExtension(compatibleGalleryExtensions);
  }
  mapInstalledExtensionWithGalleryExtension(galleryExtensions) {
    const mappedExtensions = [];
    const byUUID = /* @__PURE__ */ new Map(), byID = /* @__PURE__ */ new Map();
    for (const gallery of galleryExtensions) {
      byUUID.set(gallery.identifier.uuid, gallery);
      byID.set(gallery.identifier.id.toLowerCase(), gallery);
    }
    for (const installed of this.installed) {
      if (installed.uuid) {
        const gallery = byUUID.get(installed.uuid);
        if (gallery) {
          mappedExtensions.push([installed, gallery]);
          continue;
        }
      }
      if (installed.local?.source !== "resource") {
        const gallery = byID.get(installed.identifier.id.toLowerCase());
        if (gallery) {
          mappedExtensions.push([installed, gallery]);
        }
      }
    }
    return mappedExtensions;
  }
  async updateMetadata(localExtension, gallery) {
    let isPreReleaseVersion = false;
    if (localExtension.manifest.version !== gallery.version) {
      this.telemetryService.publicLog2("galleryService:updateMetadata");
      const galleryWithLocalVersion = (await this.galleryService.getExtensions([{ ...localExtension.identifier, version: localExtension.manifest.version }], CancellationToken.None))[0];
      isPreReleaseVersion = !!galleryWithLocalVersion?.properties?.isPreReleaseVersion;
    }
    return this.workbenchExtensionManagementService.updateMetadata(localExtension, { id: gallery.identifier.uuid, publisherDisplayName: gallery.publisherDisplayName, publisherId: gallery.publisherId, isPreReleaseVersion });
  }
  canInstall(galleryExtension) {
    return this.server.extensionManagementService.canInstall(galleryExtension);
  }
  onInstallExtension(event) {
    const { source } = event;
    if (source && !URI.isUri(source)) {
      const extension = this.installed.find((e) => areSameExtensions(e.identifier, source.identifier)) ?? this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, void 0, source, void 0);
      this.installing.push(extension);
      this._onChange.fire({ extension });
    }
  }
  async fetchInstalledExtensions(productVersion) {
    const extensionsControlManifest = await this.server.extensionManagementService.getExtensionsControlManifest();
    const all = await this.server.extensionManagementService.getInstalled(void 0, void 0, productVersion);
    if (this.isWorkspaceServer) {
      all.push(...await this.workbenchExtensionManagementService.getInstalledWorkspaceExtensions(true));
    }
    const installed = groupByExtension(all, (r) => r.identifier).reduce((result, extensions) => {
      if (extensions.length === 1) {
        result.push(extensions[0]);
      } else {
        let workspaceExtension, userExtension, systemExtension;
        for (const extension2 of extensions) {
          if (extension2.isWorkspaceScoped) {
            workspaceExtension = extension2;
          } else if (extension2.type === ExtensionType.User) {
            userExtension = extension2;
          } else {
            systemExtension = extension2;
          }
        }
        const extension = workspaceExtension ?? userExtension ?? systemExtension;
        if (extension) {
          result.push(extension);
        }
      }
      return result;
    }, []);
    const byId = index(this.installed, (e) => e.local ? e.local.identifier.id : e.identifier.id);
    this.installed = installed.map((local) => {
      const extension = byId[local.identifier.id] || this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, local, void 0, void 0);
      extension.local = local;
      extension.enablementState = this.extensionEnablementService.getEnablementState(local);
      extension.setExtensionsControlManifest(extensionsControlManifest);
      return extension;
    });
  }
  async reset() {
    this.installed = [];
    this.installing = [];
    this.uninstalling = [];
    await this.fetchInstalledExtensions();
    this._onReset.fire();
  }
  async onDidInstallExtensions(results) {
    const extensions = [];
    for (const event of results) {
      const { local, source } = event;
      const gallery = source && !URI.isUri(source) ? source : void 0;
      const location = source && URI.isUri(source) ? source : void 0;
      const installingExtension = gallery ? this.installing.filter((e) => areSameExtensions(e.identifier, gallery.identifier))[0] : null;
      this.installing = installingExtension ? this.installing.filter((e) => e !== installingExtension) : this.installing;
      let extension = installingExtension ? installingExtension : location || local ? this.instantiationService.createInstance(Extension, this.stateProvider, this.runtimeStateProvider, this.server, local, void 0, void 0) : void 0;
      if (extension) {
        if (local) {
          const installed = this.installed.filter((e) => areSameExtensions(e.identifier, extension.identifier))[0];
          if (installed) {
            extension = installed;
          } else {
            this.installed.push(extension);
          }
          extension.local = local;
          if (!extension.gallery) {
            extension.gallery = gallery;
          }
          extension.enablementState = this.extensionEnablementService.getEnablementState(local);
        }
        extensions.push(extension);
      }
      this._onChange.fire(!local || !extension ? void 0 : { extension, operation: event.operation });
    }
    if (extensions.length) {
      const manifest = await this.server.extensionManagementService.getExtensionsControlManifest();
      for (const extension of extensions) {
        extension.setExtensionsControlManifest(manifest);
      }
      this.matchInstalledExtensionsWithGallery(extensions);
    }
  }
  async onDidUpdateExtensionMetadata(local) {
    const extension = this.installed.find((e) => areSameExtensions(e.identifier, local.identifier));
    if (extension?.local) {
      const hasChanged = extension.local.pinned !== local.pinned || extension.local.preRelease !== local.preRelease;
      extension.local = local;
      if (hasChanged) {
        this._onChange.fire({ extension });
      }
    }
  }
  async matchInstalledExtensionsWithGallery(extensions) {
    const toMatch = extensions.filter((e) => e.local && !e.gallery && e.local.source !== "resource");
    if (!toMatch.length) {
      return;
    }
    if (!this.galleryService.isEnabled()) {
      return;
    }
    const galleryExtensions = await this.galleryService.getExtensions(toMatch.map((e) => ({ ...e.identifier, preRelease: e.local?.preRelease })), { compatible: true, targetPlatform: await this.server.extensionManagementService.getTargetPlatform() }, CancellationToken.None);
    for (const extension of extensions) {
      const compatible = galleryExtensions.find((e) => areSameExtensions(e.identifier, extension.identifier));
      if (compatible) {
        extension.gallery = compatible;
        this._onChange.fire({ extension });
      }
    }
  }
  onUninstallExtension(identifier) {
    const extension = this.installed.filter((e) => areSameExtensions(e.identifier, identifier))[0];
    if (extension) {
      const uninstalling = this.uninstalling.filter((e) => areSameExtensions(e.identifier, identifier))[0] || extension;
      this.uninstalling = [uninstalling, ...this.uninstalling.filter((e) => !areSameExtensions(e.identifier, identifier))];
      this._onChange.fire(uninstalling ? { extension: uninstalling } : void 0);
    }
  }
  onDidUninstallExtension({ identifier, error }) {
    const uninstalled = this.uninstalling.find((e) => areSameExtensions(e.identifier, identifier)) || this.installed.find((e) => areSameExtensions(e.identifier, identifier));
    this.uninstalling = this.uninstalling.filter((e) => !areSameExtensions(e.identifier, identifier));
    if (!error) {
      this.installed = this.installed.filter((e) => !areSameExtensions(e.identifier, identifier));
    }
    if (uninstalled) {
      this._onChange.fire({ extension: uninstalled });
    }
  }
  onEnablementChanged(platformExtensions) {
    const extensions = this.local.filter((e) => platformExtensions.some((p) => areSameExtensions(e.identifier, p.identifier)));
    for (const extension of extensions) {
      if (extension.local) {
        const enablementState = this.extensionEnablementService.getEnablementState(extension.local);
        if (enablementState !== extension.enablementState) {
          extension.enablementState = enablementState;
          this._onChange.fire({ extension });
        }
      }
    }
  }
  getExtensionState(extension) {
    if (extension.gallery && this.installing.some((e) => !!e.gallery && areSameExtensions(e.gallery.identifier, extension.gallery.identifier))) {
      return ExtensionState.Installing;
    }
    if (this.uninstalling.some((e) => areSameExtensions(e.identifier, extension.identifier))) {
      return ExtensionState.Uninstalling;
    }
    const local = this.installed.filter((e) => e === extension || e.gallery && extension.gallery && areSameExtensions(e.gallery.identifier, extension.gallery.identifier))[0];
    return local ? ExtensionState.Installed : ExtensionState.Uninstalled;
  }
};
Extensions = __decorateClass([
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IWorkbenchExtensionEnablementService),
  __decorateParam(6, IWorkbenchExtensionManagementService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IInstantiationService)
], Extensions);
let ExtensionsWorkbenchService = class extends Disposable {
  constructor(instantiationService, editorService, extensionManagementService, galleryService, extensionGalleryManifestService, configurationService, telemetryService, notificationService, urlService, extensionEnablementService, hostService, progressService, extensionManagementServerService, languageService, extensionsSyncManagementService, userDataAutoSyncService, productService, contextKeyService, extensionManifestPropertiesService, logService, extensionService, localeService, lifecycleService, fileService, userDataProfileService, storageService, dialogService, userDataSyncEnablementService, updateService, uriIdentityService, workspaceContextService, viewsService, fileDialogService, quickInputService, allowedExtensionsService) {
    super();
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.extensionManagementService = extensionManagementService;
    this.galleryService = galleryService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.notificationService = notificationService;
    this.extensionEnablementService = extensionEnablementService;
    this.hostService = hostService;
    this.progressService = progressService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.languageService = languageService;
    this.extensionsSyncManagementService = extensionsSyncManagementService;
    this.userDataAutoSyncService = userDataAutoSyncService;
    this.productService = productService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.logService = logService;
    this.extensionService = extensionService;
    this.localeService = localeService;
    this.lifecycleService = lifecycleService;
    this.fileService = fileService;
    this.userDataProfileService = userDataProfileService;
    this.storageService = storageService;
    this.dialogService = dialogService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.updateService = updateService;
    this.uriIdentityService = uriIdentityService;
    this.workspaceContextService = workspaceContextService;
    this.viewsService = viewsService;
    this.fileDialogService = fileDialogService;
    this.quickInputService = quickInputService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.localExtensions = null;
    this.remoteExtensions = null;
    this.webExtensions = null;
    this.extensionsServers = [];
    this._onChange = this._register(new Emitter());
    this._onDidChangeExtensionsNotification = new Emitter();
    this.onDidChangeExtensionsNotification = this._onDidChangeExtensionsNotification.event;
    this._onReset = new Emitter();
    this.preferPreReleases = this.productService.quality !== "stable";
    this.installing = [];
    this.tasksInProgress = [];
    this.autoRestartListenerDisposable = this._register(new MutableDisposable());
    const preferPreReleasesValue = configurationService.getValue("_extensions.preferPreReleases");
    if (!isUndefined(preferPreReleasesValue)) {
      this.preferPreReleases = !!preferPreReleasesValue;
    }
    this.hasOutdatedExtensionsContextKey = HasOutdatedExtensionsContext.bindTo(contextKeyService);
    if (extensionManagementServerService.localExtensionManagementServer) {
      this.localExtensions = this._register(instantiationService.createInstance(
        Extensions,
        extensionManagementServerService.localExtensionManagementServer,
        (ext) => this.getExtensionState(ext),
        (ext) => this.getRuntimeState(ext),
        !extensionManagementServerService.remoteExtensionManagementServer
      ));
      this._register(this.localExtensions.onChange((e) => this.onDidChangeExtensions(e?.extension)));
      this._register(this.localExtensions.onReset((e) => this.reset()));
      this.extensionsServers.push(this.localExtensions);
    }
    if (extensionManagementServerService.remoteExtensionManagementServer) {
      this.remoteExtensions = this._register(instantiationService.createInstance(
        Extensions,
        extensionManagementServerService.remoteExtensionManagementServer,
        (ext) => this.getExtensionState(ext),
        (ext) => this.getRuntimeState(ext),
        true
      ));
      this._register(this.remoteExtensions.onChange((e) => this.onDidChangeExtensions(e?.extension)));
      this._register(this.remoteExtensions.onReset((e) => this.reset()));
      this.extensionsServers.push(this.remoteExtensions);
    }
    if (extensionManagementServerService.webExtensionManagementServer) {
      this.webExtensions = this._register(instantiationService.createInstance(
        Extensions,
        extensionManagementServerService.webExtensionManagementServer,
        (ext) => this.getExtensionState(ext),
        (ext) => this.getRuntimeState(ext),
        !(extensionManagementServerService.remoteExtensionManagementServer || extensionManagementServerService.localExtensionManagementServer)
      ));
      this._register(this.webExtensions.onChange((e) => this.onDidChangeExtensions(e?.extension)));
      this._register(this.webExtensions.onReset((e) => this.reset()));
      this.extensionsServers.push(this.webExtensions);
    }
    this.updatesCheckDelayer = new ThrottledDelayer(ExtensionsWorkbenchService.UpdatesCheckInterval);
    this.autoUpdateDelayer = new ThrottledDelayer(1e3);
    this._register(toDisposable(() => {
      this.updatesCheckDelayer.cancel();
      this.autoUpdateDelayer.cancel();
    }));
    urlService.registerHandler(this);
    this.whenInitialized = this.initialize();
  }
  get onChange() {
    return this._onChange.event;
  }
  get onReset() {
    return this._onReset.event;
  }
  async initialize() {
    await Promise.all([this.queryLocal(), this.extensionService.whenInstalledExtensionsRegistered()]);
    if (this._store.isDisposed) {
      return;
    }
    this.onDidChangeRunningExtensions(this.extensionService.extensions, []);
    this._register(this.extensionService.onDidChangeExtensions(({ added, removed }) => this.onDidChangeRunningExtensions(added, removed)));
    await this.lifecycleService.when(LifecyclePhase.Eventually);
    if (this._store.isDisposed) {
      return;
    }
    this.initializeAutoUpdate();
    this.updateExtensionsNotificaiton();
    this.reportInstalledExtensionsTelemetry();
    this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, this._store)((e) => this.onDidDismissedNotificationsValueChange()));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, EXTENSIONS_AUTO_UPDATE_KEY, this._store)((e) => this.onDidSelectedExtensionToAutoUpdateValueChange()));
    this._register(this.storageService.onDidChangeValue(StorageScope.APPLICATION, EXTENSIONS_DONOT_AUTO_UPDATE_KEY, this._store)((e) => this.onDidSelectedExtensionToAutoUpdateValueChange()));
    this._register(Event.debounce(this.onChange, () => void 0, 100)(() => {
      this.updateExtensionsNotificaiton();
      this.reportProgressFromOtherSources();
    }));
  }
  initializeAutoUpdate() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
        if (this.isAutoUpdateEnabled()) {
          this.eventuallyAutoUpdateExtensions();
        }
      }
      if (e.affectsConfiguration(AutoCheckUpdatesConfigurationKey)) {
        if (this.isAutoCheckUpdatesEnabled()) {
          this.checkForUpdates(`Enabled auto check updates`);
        }
      }
    }));
    this._register(this.extensionEnablementService.onEnablementChanged((platformExtensions) => {
      if (this.getAutoUpdateValue() === "onlyEnabledExtensions" && platformExtensions.some((e) => this.extensionEnablementService.isEnabled(e))) {
        this.checkForUpdates("Extension enablement changed");
      }
    }));
    this._register(Event.debounce(this.onChange, () => void 0, 100)(() => this.hasOutdatedExtensionsContextKey.set(this.outdated.length > 0)));
    this._register(this.updateService.onStateChange((e) => {
      if (e.type === StateType.CheckingForUpdates && e.explicit || e.type === StateType.AvailableForDownload || e.type === StateType.Downloaded) {
        this.telemetryService.publicLog2("extensions:updatecheckonproductupdate");
        if (this.isAutoCheckUpdatesEnabled()) {
          this.checkForUpdates("Product update");
        }
      }
    }));
    this._register(this.allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => {
      if (this.isAutoCheckUpdatesEnabled()) {
        this.checkForUpdates("Allowed extensions changed");
      }
    }));
    this.hasOutdatedExtensionsContextKey.set(this.outdated.length > 0);
    this.eventuallyCheckForUpdates(true);
    if (isWeb) {
      this.syncPinnedBuiltinExtensions();
      if (!this.isAutoUpdateEnabled()) {
        this.autoUpdateBuiltinExtensions();
      }
    }
    this.registerAutoRestartListener();
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AutoRestartConfigurationKey)) {
        this.registerAutoRestartListener();
      }
    }));
  }
  isAutoUpdateEnabled() {
    return this.getAutoUpdateValue() !== false;
  }
  getAutoUpdateValue() {
    const autoUpdate = this.configurationService.getValue(AutoUpdateConfigurationKey);
    if (autoUpdate === "onlySelectedExtensions") {
      return false;
    }
    return isBoolean(autoUpdate) || autoUpdate === "onlyEnabledExtensions" ? autoUpdate : true;
  }
  async updateAutoUpdateForAllExtensions(isAutoUpdateEnabled) {
    const wasAutoUpdateEnabled = this.isAutoUpdateEnabled();
    if (wasAutoUpdateEnabled === isAutoUpdateEnabled) {
      return;
    }
    const result = await this.dialogService.confirm({
      title: nls.localize("confirmEnableDisableAutoUpdate", "Auto Update Extensions"),
      message: isAutoUpdateEnabled ? nls.localize("confirmEnableAutoUpdate", "Do you want to enable auto update for all extensions?") : nls.localize("confirmDisableAutoUpdate", "Do you want to disable auto update for all extensions?"),
      detail: nls.localize("confirmEnableDisableAutoUpdateDetail", "This will reset any auto update settings you have set for individual extensions.")
    });
    if (!result.confirmed) {
      return;
    }
    this.setEnabledAutoUpdateExtensions([]);
    await this.configurationService.updateValue(AutoUpdateConfigurationKey, isAutoUpdateEnabled);
    this.setDisabledAutoUpdateExtensions([]);
    await this.updateExtensionsPinnedState(!isAutoUpdateEnabled);
    this._onChange.fire(void 0);
  }
  registerAutoRestartListener() {
    this.autoRestartListenerDisposable.value = void 0;
    if (this.configurationService.getValue(AutoRestartConfigurationKey) === true) {
      this.autoRestartListenerDisposable.value = this.hostService.onDidChangeFocus((focus) => {
        if (!focus && this.configurationService.getValue(AutoRestartConfigurationKey) === true) {
          this.updateRunningExtensions(true);
        }
      });
    }
  }
  reportInstalledExtensionsTelemetry() {
    const extensionIds = this.installed.filter((extension) => !extension.isBuiltin && (extension.enablementState === EnablementState.EnabledWorkspace || extension.enablementState === EnablementState.EnabledGlobally)).map((extension) => ExtensionIdentifier.toKey(extension.identifier.id));
    this.telemetryService.publicLog2("installedExtensions", { extensionIds: new TelemetryTrustedValue(extensionIds.join(";")), count: extensionIds.length });
  }
  async onDidChangeRunningExtensions(added, removed) {
    const changedExtensions = [];
    const extensionsToFetch = [];
    for (const desc of added) {
      const extension = this.installed.find((e) => areSameExtensions({ id: desc.identifier.value, uuid: desc.uuid }, e.identifier));
      if (extension) {
        changedExtensions.push(extension);
      } else {
        extensionsToFetch.push(desc);
      }
    }
    const workspaceExtensions = [];
    for (const desc of removed) {
      if (this.workspaceContextService.isInsideWorkspace(desc.extensionLocation)) {
        workspaceExtensions.push(desc);
      } else {
        extensionsToFetch.push(desc);
      }
    }
    if (extensionsToFetch.length) {
      const extensions = await this.getExtensions(extensionsToFetch.map((e) => ({ id: e.identifier.value, uuid: e.uuid })), CancellationToken.None);
      changedExtensions.push(...extensions);
    }
    if (workspaceExtensions.length) {
      const extensions = await this.getResourceExtensions(workspaceExtensions.map((e) => e.extensionLocation), true);
      changedExtensions.push(...extensions);
    }
    for (const changedExtension of changedExtensions) {
      this._onChange.fire(changedExtension);
    }
  }
  updateExtensionsPinnedState(pinned) {
    return this.progressService.withProgress({
      location: ProgressLocation.Extensions,
      title: nls.localize("updatingExtensions", "Updating Extensions Auto Update State")
    }, () => this.extensionManagementService.resetPinnedStateForAllUserExtensions(pinned));
  }
  reset() {
    for (const task of this.tasksInProgress) {
      task.cancel();
    }
    this.tasksInProgress = [];
    this.installing = [];
    this.onDidChangeExtensions();
    this._onReset.fire();
  }
  onDidChangeExtensions(extension) {
    this._installed = void 0;
    this._local = void 0;
    this._onChange.fire(extension);
  }
  get local() {
    if (!this._local) {
      if (this.extensionsServers.length === 1) {
        this._local = this.installed;
      } else {
        this._local = [];
        const byId = groupByExtension(this.installed, (r) => r.identifier);
        for (const extensions of byId) {
          this._local.push(this.getPrimaryExtension(extensions));
        }
      }
    }
    return this._local;
  }
  get installed() {
    if (!this._installed) {
      this._installed = [];
      for (const extensions of this.extensionsServers) {
        for (const extension of extensions.local) {
          this._installed.push(extension);
        }
      }
    }
    return this._installed;
  }
  get outdated() {
    return this.installed.filter((e) => e.outdated && e.local && e.state === ExtensionState.Installed);
  }
  async queryLocal(server) {
    if (server) {
      if (this.localExtensions && this.extensionManagementServerService.localExtensionManagementServer === server) {
        return this.localExtensions.queryInstalled(this.getProductVersion());
      }
      if (this.remoteExtensions && this.extensionManagementServerService.remoteExtensionManagementServer === server) {
        return this.remoteExtensions.queryInstalled(this.getProductVersion());
      }
      if (this.webExtensions && this.extensionManagementServerService.webExtensionManagementServer === server) {
        return this.webExtensions.queryInstalled(this.getProductVersion());
      }
    }
    if (this.localExtensions) {
      try {
        await this.localExtensions.queryInstalled(this.getProductVersion());
      } catch (error) {
        this.logService.error(error);
      }
    }
    if (this.remoteExtensions) {
      try {
        await this.remoteExtensions.queryInstalled(this.getProductVersion());
      } catch (error) {
        this.logService.error(error);
      }
    }
    if (this.webExtensions) {
      try {
        await this.webExtensions.queryInstalled(this.getProductVersion());
      } catch (error) {
        this.logService.error(error);
      }
    }
    return this.local;
  }
  async queryGallery(arg1, arg2) {
    if (!this.galleryService.isEnabled()) {
      return singlePagePager([]);
    }
    const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
    const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;
    options.text = options.text ? this.resolveQueryText(options.text) : options.text;
    options.includePreRelease = isUndefined(options.includePreRelease) ? this.preferPreReleases : options.includePreRelease;
    const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
    const pager = await this.galleryService.query(options, token);
    this.syncInstalledExtensionsWithGallery(pager.firstPage);
    return {
      firstPage: pager.firstPage.map((gallery) => this.fromGallery(gallery, extensionsControlManifest)),
      total: pager.total,
      pageSize: pager.pageSize,
      getPage: async (pageIndex, token2) => {
        const page = await pager.getPage(pageIndex, token2);
        this.syncInstalledExtensionsWithGallery(page);
        return page.map((gallery) => this.fromGallery(gallery, extensionsControlManifest));
      }
    };
  }
  async getExtensions(extensionInfos, arg1, arg2) {
    if (!this.galleryService.isEnabled()) {
      return [];
    }
    extensionInfos.forEach((e) => e.preRelease = e.preRelease ?? this.preferPreReleases);
    const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
    const galleryExtensions = await this.galleryService.getExtensions(extensionInfos, arg1, arg2);
    this.syncInstalledExtensionsWithGallery(galleryExtensions);
    return galleryExtensions.map((gallery) => this.fromGallery(gallery, extensionsControlManifest));
  }
  async getResourceExtensions(locations, isWorkspaceScoped) {
    const resourceExtensions = await this.extensionManagementService.getExtensions(locations);
    return resourceExtensions.map((resourceExtension) => this.getInstalledExtensionMatchingLocation(resourceExtension.location) ?? this.instantiationService.createInstance(Extension, (ext) => this.getExtensionState(ext), (ext) => this.getRuntimeState(ext), void 0, void 0, void 0, { resourceExtension, isWorkspaceScoped }));
  }
  onDidDismissedNotificationsValueChange() {
    if (this.dismissedNotificationsValue !== this.getDismissedNotificationsValue()) {
      this._dismissedNotificationsValue = void 0;
      this.updateExtensionsNotificaiton();
    }
  }
  updateExtensionsNotificaiton() {
    const computedNotificiations = this.computeExtensionsNotifications();
    const dismissedNotifications = [];
    let extensionsNotification;
    if (computedNotificiations.length) {
      for (const dismissedNotification of this.getDismissedNotifications()) {
        if (computedNotificiations.some((e) => e.key === dismissedNotification)) {
          dismissedNotifications.push(dismissedNotification);
        }
      }
      if (!dismissedNotifications.includes(computedNotificiations[0].key)) {
        extensionsNotification = {
          message: computedNotificiations[0].message,
          severity: computedNotificiations[0].severity,
          extensions: computedNotificiations[0].extensions,
          key: computedNotificiations[0].key,
          dismiss: () => {
            this.setDismissedNotifications([...this.getDismissedNotifications(), computedNotificiations[0].key]);
            this.updateExtensionsNotificaiton();
          }
        };
      }
    }
    this.setDismissedNotifications(dismissedNotifications);
    if (this.extensionsNotification?.key !== extensionsNotification?.key) {
      this.extensionsNotification = extensionsNotification;
      this._onDidChangeExtensionsNotification.fire(this.extensionsNotification);
    }
  }
  computeExtensionsNotifications() {
    const computedNotificiations = [];
    const disallowedExtensions = this.local.filter((e) => e.enablementState === EnablementState.DisabledByAllowlist);
    if (disallowedExtensions.length) {
      computedNotificiations.push({
        message: this.configurationService.inspect(AllowedExtensionsConfigKey).policy ? nls.localize("disallowed extensions by policy", "Some extensions are disabled because they are not allowed by your system administrator.") : nls.localize("disallowed extensions", "Some extensions are disabled because they are configured not to be allowed."),
        severity: Severity.Warning,
        extensions: disallowedExtensions,
        key: "disallowedExtensions:" + disallowedExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map((e) => e.identifier.id.toLowerCase()).join("-")
      });
    }
    const invalidExtensions = this.local.filter((e) => e.enablementState === EnablementState.DisabledByInvalidExtension && !e.isWorkspaceScoped);
    if (invalidExtensions.length) {
      if (invalidExtensions.some(
        (e) => e.local && e.local.manifest.engines?.vscode && (!isEngineValid(e.local.manifest.engines.vscode, this.productService.version, this.productService.date) || areApiProposalsCompatible([...e.local.manifest.enabledApiProposals ?? []]))
      )) {
        computedNotificiations.push({
          message: nls.localize("incompatibleExtensions", "Some extensions are disabled due to version incompatibility. Review and update them."),
          severity: Severity.Warning,
          extensions: invalidExtensions,
          key: "incompatibleExtensions:" + invalidExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map((e) => `${e.identifier.id.toLowerCase()}@${e.local?.manifest.version}`).join("-")
        });
      } else {
        computedNotificiations.push({
          message: nls.localize("invalidExtensions", "Invalid extensions detected. Review them."),
          severity: Severity.Warning,
          extensions: invalidExtensions,
          key: "invalidExtensions:" + invalidExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map((e) => `${e.identifier.id.toLowerCase()}@${e.local?.manifest.version}`).join("-")
        });
      }
    }
    const deprecatedExtensions = this.local.filter((e) => !!e.deprecationInfo && e.local && this.extensionEnablementService.isEnabled(e.local));
    if (deprecatedExtensions.length) {
      computedNotificiations.push({
        message: nls.localize("deprecated extensions", "Deprecated extensions detected. Review them and migrate to alternatives."),
        severity: Severity.Warning,
        extensions: deprecatedExtensions,
        key: "deprecatedExtensions:" + deprecatedExtensions.sort((a, b) => a.identifier.id.localeCompare(b.identifier.id)).map((e) => e.identifier.id.toLowerCase()).join("-")
      });
    }
    return computedNotificiations;
  }
  getExtensionsNotification() {
    return this.extensionsNotification;
  }
  resolveQueryText(text) {
    text = text.replace(/@web/g, `tag:"${WEB_EXTENSION_TAG}"`);
    const extensionRegex = /\bext:([^\s]+)\b/g;
    if (extensionRegex.test(text)) {
      text = text.replace(extensionRegex, (m, ext) => {
        const lookup = this.productService.extensionKeywords || {};
        const keywords = lookup[ext] || [];
        const languageId = this.languageService.guessLanguageIdByFilepathOrFirstLine(URI.file(`.${ext}`));
        const languageName = languageId && this.languageService.getLanguageName(languageId);
        const languageTag = languageName ? ` tag:"${languageName}"` : "";
        return `tag:"__ext_${ext}" tag:"__ext_.${ext}" ${keywords.map((tag) => `tag:"${tag}"`).join(" ")}${languageTag} tag:"${ext}"`;
      });
    }
    return text.substr(0, 350);
  }
  fromGallery(gallery, extensionsControlManifest) {
    let extension = this.getInstalledExtensionMatchingGallery(gallery);
    if (!extension) {
      extension = this.instantiationService.createInstance(Extension, (ext) => this.getExtensionState(ext), (ext) => this.getRuntimeState(ext), void 0, void 0, gallery, void 0);
      extension.setExtensionsControlManifest(extensionsControlManifest);
    }
    return extension;
  }
  getInstalledExtensionMatchingGallery(gallery) {
    for (const installed of this.local) {
      if (installed.identifier.uuid) {
        if (installed.identifier.uuid === gallery.identifier.uuid) {
          return installed;
        }
      } else if (installed.local?.source !== "resource") {
        if (areSameExtensions(installed.identifier, gallery.identifier)) {
          return installed;
        }
      }
    }
    return null;
  }
  getInstalledExtensionMatchingLocation(location) {
    return this.local.find((e) => e.local && this.uriIdentityService.extUri.isEqualOrParent(location, e.local?.location)) ?? null;
  }
  async open(extension, options) {
    if (typeof extension === "string") {
      const id = extension;
      extension = this.installed.find((e) => areSameExtensions(e.identifier, { id })) ?? (await this.getExtensions([{ id: extension }], CancellationToken.None))[0];
    }
    if (!extension) {
      throw new Error(`Extension not found. ${extension}`);
    }
    await this.editorService.openEditor(this.instantiationService.createInstance(ExtensionsInput, extension), options, options?.sideByside ? SIDE_GROUP : ACTIVE_GROUP);
  }
  async openSearch(searchValue, preserveFoucs) {
    const viewPaneContainer = (await this.viewsService.openViewContainer(VIEWLET_ID, true))?.getViewPaneContainer();
    viewPaneContainer.search(searchValue);
    if (!preserveFoucs) {
      viewPaneContainer.focus();
    }
  }
  getExtensionRuntimeStatus(extension) {
    const extensionsStatus = this.extensionService.getExtensionsStatus();
    for (const id of Object.keys(extensionsStatus)) {
      if (areSameExtensions({ id }, extension.identifier)) {
        return extensionsStatus[id];
      }
    }
    return void 0;
  }
  async updateRunningExtensions(auto = false) {
    const toAdd = [];
    const toRemove = [];
    const extensionsToCheck = [...this.local];
    for (const extension of extensionsToCheck) {
      const runtimeState = extension.runtimeState;
      if (!runtimeState || runtimeState.action !== ExtensionRuntimeActionType.RestartExtensions) {
        continue;
      }
      if (extension.state === ExtensionState.Uninstalled) {
        toRemove.push(extension.identifier.id);
        continue;
      }
      if (!extension.local) {
        continue;
      }
      const isEnabled = this.extensionEnablementService.isEnabled(extension.local);
      if (isEnabled) {
        const runningExtension = this.extensionService.extensions.find((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, extension.identifier));
        if (runningExtension) {
          toRemove.push(runningExtension.identifier.value);
        }
        toAdd.push(extension.local);
      } else {
        toRemove.push(extension.identifier.id);
      }
    }
    for (const extension of this.extensionService.extensions) {
      if (extension.isUnderDevelopment) {
        continue;
      }
      if (extensionsToCheck.some((e) => areSameExtensions({ id: extension.identifier.value, uuid: extension.uuid }, e.local?.identifier ?? e.identifier))) {
        continue;
      }
      toRemove.push(extension.identifier.value);
    }
    if (toAdd.length || toRemove.length) {
      if (await this.extensionService.stopExtensionHosts(nls.localize("restart", "Changing extension enablement"), auto)) {
        await this.extensionService.startExtensionHosts({ toAdd, toRemove });
        if (auto) {
          this.notificationService.notify({
            severity: Severity.Info,
            message: nls.localize("extensionsAutoRestart", "Extensions were auto restarted to enable updates."),
            priority: NotificationPriority.SILENT
          });
        }
        this.telemetryService.publicLog2("extensions:autorestart", { count: toAdd.length + toRemove.length, auto });
      }
    }
  }
  getRuntimeState(extension) {
    const isUninstalled = extension.state === ExtensionState.Uninstalled;
    const runningExtension = this.extensionService.extensions.find((e) => areSameExtensions({ id: e.identifier.value }, extension.identifier));
    const reloadAction = this.extensionManagementServerService.remoteExtensionManagementServer ? ExtensionRuntimeActionType.ReloadWindow : ExtensionRuntimeActionType.RestartExtensions;
    const reloadActionLabel = reloadAction === ExtensionRuntimeActionType.ReloadWindow ? nls.localize("reload", "reload window") : nls.localize("restart extensions", "restart extensions");
    if (isUninstalled) {
      const canRemoveRunningExtension = runningExtension && this.extensionService.canRemoveExtension(runningExtension);
      const isSameExtensionRunning = runningExtension && (!extension.server || extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension))) && (!extension.resourceExtension || this.uriIdentityService.extUri.isEqual(extension.resourceExtension.location, runningExtension.extensionLocation));
      if (!canRemoveRunningExtension && isSameExtensionRunning && !runningExtension.isUnderDevelopment) {
        return { action: reloadAction, reason: nls.localize("postUninstallTooltip", "Please {0} to complete the uninstallation of this extension.", reloadActionLabel) };
      }
      return void 0;
    }
    if (extension.local) {
      const isSameExtensionRunning = runningExtension && extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension));
      const isEnabled = this.extensionEnablementService.isEnabled(extension.local);
      if (runningExtension) {
        if (isEnabled) {
          if (this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
            return void 0;
          }
          const runningExtensionServer = this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension));
          if (isSameExtensionRunning) {
            if (!runningExtension.isUnderDevelopment && (extension.version !== runningExtension.version || extension.local.targetPlatform !== runningExtension.targetPlatform)) {
              const productCurrentVersion = this.getProductCurrentVersion();
              const productUpdateVersion = this.getProductUpdateVersion();
              if (productUpdateVersion && !isEngineValid(extension.local.manifest.engines.vscode, productCurrentVersion.version, productCurrentVersion.date) && isEngineValid(extension.local.manifest.engines.vscode, productUpdateVersion.version, productUpdateVersion.date)) {
                const state = this.updateService.state;
                if (state.type === StateType.AvailableForDownload) {
                  return { action: ExtensionRuntimeActionType.DownloadUpdate, reason: nls.localize("postUpdateDownloadTooltip", "Please update {0} to enable the updated extension.", this.productService.nameLong) };
                }
                if (state.type === StateType.Downloaded) {
                  return { action: ExtensionRuntimeActionType.ApplyUpdate, reason: nls.localize("postUpdateUpdateTooltip", "Please update {0} to enable the updated extension.", this.productService.nameLong) };
                }
                if (state.type === StateType.Ready) {
                  return { action: ExtensionRuntimeActionType.QuitAndInstall, reason: nls.localize("postUpdateRestartTooltip", "Please restart {0} to enable the updated extension.", this.productService.nameLong) };
                }
                return void 0;
              }
              return { action: reloadAction, reason: nls.localize("postUpdateTooltip", "Please {0} to enable the updated extension.", reloadActionLabel) };
            }
            if (this.extensionsServers.length > 1) {
              const extensionInOtherServer = this.installed.filter((e) => areSameExtensions(e.identifier, extension.identifier) && e.server !== extension.server)[0];
              if (extensionInOtherServer) {
                if (runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnUI(extension.local.manifest) && extensionInOtherServer.server === this.extensionManagementServerService.localExtensionManagementServer) {
                  return { action: reloadAction, reason: nls.localize("enable locally", "Please {0} to enable this extension locally.", reloadActionLabel) };
                }
                if (runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(extension.local.manifest) && extensionInOtherServer.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                  return { action: reloadAction, reason: nls.localize("enable remote", "Please {0} to enable this extension in {1}.", reloadActionLabel, this.extensionManagementServerService.remoteExtensionManagementServer?.label) };
                }
              }
            }
          } else {
            if (extension.server === this.extensionManagementServerService.localExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer) {
              if (this.extensionManifestPropertiesService.prefersExecuteOnUI(extension.local.manifest)) {
                return { action: reloadAction, reason: nls.localize("postEnableTooltip", "Please {0} to enable this extension.", reloadActionLabel) };
              }
            }
            if (extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer) {
              if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(extension.local.manifest)) {
                return { action: reloadAction, reason: nls.localize("postEnableTooltip", "Please {0} to enable this extension.", reloadActionLabel) };
              }
            }
          }
          return void 0;
        } else {
          if (isSameExtensionRunning) {
            return { action: reloadAction, reason: nls.localize("postDisableTooltip", "Please {0} to disable this extension.", reloadActionLabel) };
          }
        }
        return void 0;
      } else {
        if (isEnabled && !this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
          return { action: reloadAction, reason: nls.localize("postEnableTooltip", "Please {0} to enable this extension.", reloadActionLabel) };
        }
        const otherServer = extension.server ? extension.server === this.extensionManagementServerService.localExtensionManagementServer ? this.extensionManagementServerService.remoteExtensionManagementServer : this.extensionManagementServerService.localExtensionManagementServer : null;
        if (otherServer && extension.enablementState === EnablementState.DisabledByExtensionKind) {
          const extensionInOtherServer = this.local.filter((e) => areSameExtensions(e.identifier, extension.identifier) && e.server === otherServer)[0];
          if (extensionInOtherServer && extensionInOtherServer.local && this.extensionEnablementService.isEnabled(extensionInOtherServer.local)) {
            return { action: reloadAction, reason: nls.localize("postEnableTooltip", "Please {0} to enable this extension.", reloadActionLabel) };
          }
        }
      }
    }
    return void 0;
  }
  getPrimaryExtension(extensions) {
    if (extensions.length === 1) {
      return extensions[0];
    }
    const enabledExtensions = extensions.filter((e) => e.local && this.extensionEnablementService.isEnabled(e.local));
    if (enabledExtensions.length === 1) {
      return enabledExtensions[0];
    }
    const extensionsToChoose = enabledExtensions.length ? enabledExtensions : extensions;
    const manifest = extensionsToChoose.find((e) => e.local && e.local.manifest)?.local?.manifest;
    if (!manifest) {
      return extensionsToChoose[0];
    }
    const extensionKinds = this.extensionManifestPropertiesService.getExtensionKind(manifest);
    let extension = extensionsToChoose.find((extension2) => {
      for (const extensionKind of extensionKinds) {
        switch (extensionKind) {
          case "ui":
            if (extension2.server === this.extensionManagementServerService.localExtensionManagementServer) {
              return true;
            }
            return false;
          case "workspace":
            if (extension2.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
              return true;
            }
            return false;
          case "web":
            if (extension2.server === this.extensionManagementServerService.webExtensionManagementServer) {
              return true;
            }
            return false;
        }
      }
      return false;
    });
    if (!extension && this.extensionManagementServerService.localExtensionManagementServer) {
      extension = extensionsToChoose.find((extension2) => {
        for (const extensionKind of extensionKinds) {
          switch (extensionKind) {
            case "workspace":
              if (extension2.server === this.extensionManagementServerService.localExtensionManagementServer) {
                return true;
              }
              return false;
            case "web":
              if (extension2.server === this.extensionManagementServerService.localExtensionManagementServer) {
                return true;
              }
              return false;
          }
        }
        return false;
      });
    }
    if (!extension && this.extensionManagementServerService.webExtensionManagementServer) {
      extension = extensionsToChoose.find((extension2) => {
        for (const extensionKind of extensionKinds) {
          switch (extensionKind) {
            case "web":
              if (extension2.server === this.extensionManagementServerService.webExtensionManagementServer) {
                return true;
              }
              return false;
          }
        }
        return false;
      });
    }
    if (!extension && this.extensionManagementServerService.remoteExtensionManagementServer) {
      extension = extensionsToChoose.find((extension2) => {
        for (const extensionKind of extensionKinds) {
          switch (extensionKind) {
            case "web":
              if (extension2.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
                return true;
              }
              return false;
          }
        }
        return false;
      });
    }
    return extension || extensions[0];
  }
  getExtensionState(extension) {
    if (this.installing.some((i) => areSameExtensions(i.identifier, extension.identifier) && (!extension.server || i.server === extension.server))) {
      return ExtensionState.Installing;
    }
    if (this.remoteExtensions) {
      const state = this.remoteExtensions.getExtensionState(extension);
      if (state !== ExtensionState.Uninstalled) {
        return state;
      }
    }
    if (this.webExtensions) {
      const state = this.webExtensions.getExtensionState(extension);
      if (state !== ExtensionState.Uninstalled) {
        return state;
      }
    }
    if (this.localExtensions) {
      return this.localExtensions.getExtensionState(extension);
    }
    return ExtensionState.Uninstalled;
  }
  async checkForUpdates(reason, onlyBuiltin) {
    if (reason) {
      this.logService.info(`[Extensions]: Checking for updates. Reason: ${reason}`);
    } else {
      this.logService.trace(`[Extensions]: Checking for updates`);
    }
    if (!this.galleryService.isEnabled()) {
      return;
    }
    const extensions = [];
    if (this.localExtensions) {
      extensions.push(this.localExtensions);
    }
    if (this.remoteExtensions) {
      extensions.push(this.remoteExtensions);
    }
    if (this.webExtensions) {
      extensions.push(this.webExtensions);
    }
    if (!extensions.length) {
      return;
    }
    const infos = [];
    for (const installed of this.local) {
      if (onlyBuiltin && !installed.isBuiltin) {
        continue;
      }
      if (installed.isBuiltin && !installed.local?.pinned && (installed.type === ExtensionType.System || !installed.local?.identifier.uuid)) {
        continue;
      }
      if (installed.local?.source === "resource") {
        continue;
      }
      infos.push({ ...installed.identifier, preRelease: !!installed.local?.preRelease });
    }
    if (infos.length) {
      const targetPlatform = await extensions[0].server.extensionManagementService.getTargetPlatform();
      this.telemetryService.publicLog2("galleryService:checkingForUpdates", {
        count: infos.length
      });
      this.logService.trace(`Checking updates for extensions`, infos.map((e) => e.id).join(", "));
      const galleryExtensions = await this.galleryService.getExtensions(infos, { targetPlatform, compatible: true, productVersion: this.getProductVersion(), preferResourceApi: true }, CancellationToken.None);
      if (galleryExtensions.length) {
        await this.syncInstalledExtensionsWithGallery(galleryExtensions);
      }
    }
  }
  async updateAll() {
    const toUpdate = [];
    this.outdated.forEach((extension) => {
      if (extension.gallery) {
        toUpdate.push({
          extension: extension.gallery,
          options: {
            operation: InstallOperation.Update,
            installPreReleaseVersion: extension.local?.isPreReleaseVersion,
            profileLocation: this.userDataProfileService.currentProfile.extensionsResource,
            isApplicationScoped: extension.local?.isApplicationScoped,
            context: { [EXTENSION_INSTALL_SKIP_PUBLISHER_TRUST_CONTEXT]: true }
          }
        });
      }
    });
    return this.extensionManagementService.installGalleryExtensions(toUpdate);
  }
  async downloadVSIX(extensionId, preRelease) {
    let [galleryExtension] = await this.galleryService.getExtensions([{ id: extensionId, preRelease }], { compatible: true }, CancellationToken.None);
    if (!galleryExtension) {
      throw new Error(nls.localize("extension not found", "Extension '{0}' not found.", extensionId));
    }
    let targetPlatform = galleryExtension.properties.targetPlatform;
    const options = [];
    for (const targetPlatform2 of galleryExtension.allTargetPlatforms) {
      if (targetPlatform2 !== TargetPlatform.UNKNOWN && targetPlatform2 !== TargetPlatform.UNIVERSAL) {
        options.push({
          label: targetPlatform2 === TargetPlatform.UNDEFINED ? nls.localize("allplatforms", "All Platforms") : TargetPlatformToString(targetPlatform2),
          id: targetPlatform2
        });
      }
    }
    if (options.length) {
      const message = nls.localize("platform placeholder", "Please select the platform for which you want to download the VSIX");
      const option = await this.quickInputService.pick(options.sort((a, b) => a.label.localeCompare(b.label)), { placeHolder: message });
      if (!option) {
        return;
      }
      targetPlatform = option.id;
    }
    if (targetPlatform !== galleryExtension.properties.targetPlatform) {
      [galleryExtension] = await this.galleryService.getExtensions([{ id: extensionId, preRelease }], { compatible: true, targetPlatform }, CancellationToken.None);
    }
    const result = await this.fileDialogService.showOpenDialog({
      title: nls.localize("download title", "Select folder to download the VSIX"),
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: nls.localize("download", "Download")
    });
    if (!result?.[0]) {
      return;
    }
    this.progressService.withProgress({ location: ProgressLocation.Notification }, async (progress) => {
      progress.report({ message: nls.localize("downloading...", "Downloading VSIX...") });
      const name = `${galleryExtension.identifier.id}-${galleryExtension.version}${targetPlatform !== TargetPlatform.UNDEFINED && targetPlatform !== TargetPlatform.UNIVERSAL && targetPlatform !== TargetPlatform.UNKNOWN ? `-${targetPlatform}` : ""}.vsix`;
      await this.galleryService.download(galleryExtension, this.uriIdentityService.extUri.joinPath(result[0], name), InstallOperation.None);
      this.notificationService.info(nls.localize("download.completed", "Successfully downloaded the VSIX"));
    });
  }
  async syncInstalledExtensionsWithGallery(gallery) {
    const extensions = [];
    if (this.localExtensions) {
      extensions.push(this.localExtensions);
    }
    if (this.remoteExtensions) {
      extensions.push(this.remoteExtensions);
    }
    if (this.webExtensions) {
      extensions.push(this.webExtensions);
    }
    if (!extensions.length) {
      return;
    }
    await Promise.allSettled(extensions.map((extensions2) => extensions2.syncInstalledExtensionsWithGallery(gallery, this.getProductVersion())));
    if (this.outdated.length) {
      this.logService.info(`Auto updating outdated extensions.`, this.outdated.map((e) => e.identifier.id).join(", "));
      this.eventuallyAutoUpdateExtensions();
    }
  }
  isAutoCheckUpdatesEnabled() {
    return this.configurationService.getValue(AutoCheckUpdatesConfigurationKey);
  }
  eventuallyCheckForUpdates(immediate = false) {
    this.updatesCheckDelayer.cancel();
    this.updatesCheckDelayer.trigger(async () => {
      if (this.isAutoCheckUpdatesEnabled()) {
        await this.checkForUpdates();
      }
      this.eventuallyCheckForUpdates();
    }, immediate ? 0 : this.getUpdatesCheckInterval()).then(void 0, (err) => null);
  }
  getUpdatesCheckInterval() {
    if (this.productService.quality === "insider" && this.getProductUpdateVersion()) {
      return 1e3 * 60 * 60 * 1;
    }
    return ExtensionsWorkbenchService.UpdatesCheckInterval;
  }
  eventuallyAutoUpdateExtensions() {
    this.autoUpdateDelayer.trigger(() => this.autoUpdateExtensions()).then(void 0, (err) => null);
  }
  async autoUpdateBuiltinExtensions() {
    await this.checkForUpdates(void 0, true);
    const toUpdate = this.outdated.filter((e) => e.isBuiltin);
    await Promises.settled(toUpdate.map((e) => this.install(e, e.local?.preRelease ? { installPreReleaseVersion: true } : void 0)));
  }
  async syncPinnedBuiltinExtensions() {
    const infos = [];
    for (const installed of this.local) {
      if (installed.isBuiltin && installed.local?.pinned && installed.local?.identifier.uuid) {
        infos.push({ ...installed.identifier, version: installed.version });
      }
    }
    if (infos.length) {
      const galleryExtensions = await this.galleryService.getExtensions(infos, CancellationToken.None);
      if (galleryExtensions.length) {
        await this.syncInstalledExtensionsWithGallery(galleryExtensions);
      }
    }
  }
  async autoUpdateExtensions() {
    const toUpdate = [];
    for (const extension of this.outdated) {
      if (!this.shouldAutoUpdateExtension(extension)) {
        this.logService.info("Auto update disabled for extension", extension.identifier.id);
        continue;
      }
      if (await this.shouldRequireConsentToUpdate(extension)) {
        this.logService.info("Auto update consent required for extension", extension.identifier.id);
        continue;
      }
      toUpdate.push(extension);
    }
    if (!toUpdate.length) {
      return;
    }
    const productVersion = this.getProductVersion();
    await Promises.settled(toUpdate.map((e) => {
      this.logService.info("Auto updating extension", e.identifier.id);
      return this.install(e, e.local?.preRelease ? { installPreReleaseVersion: true, productVersion } : { productVersion });
    }));
  }
  getProductVersion() {
    return this.getProductUpdateVersion() ?? this.getProductCurrentVersion();
  }
  getProductCurrentVersion() {
    return { version: this.productService.version, date: this.productService.date };
  }
  getProductUpdateVersion() {
    switch (this.updateService.state.type) {
      case StateType.AvailableForDownload:
      case StateType.Downloaded:
      case StateType.Updating:
      case StateType.Ready: {
        const version = this.updateService.state.update.productVersion;
        if (version && semver.valid(version)) {
          return { version, date: this.updateService.state.update.timestamp ? new Date(this.updateService.state.update.timestamp).toISOString() : void 0 };
        }
      }
    }
    return void 0;
  }
  shouldAutoUpdateExtension(extension) {
    if (extension.deprecationInfo?.disallowInstall) {
      return false;
    }
    const autoUpdateValue = this.getAutoUpdateValue();
    if (autoUpdateValue === false) {
      const extensionsToAutoUpdate = this.getEnabledAutoUpdateExtensions();
      const extensionId = extension.identifier.id.toLowerCase();
      if (extensionsToAutoUpdate.includes(extensionId)) {
        return true;
      }
      if (this.isAutoUpdateEnabledForPublisher(extension.publisher) && !extensionsToAutoUpdate.includes(`-${extensionId}`)) {
        return true;
      }
      return false;
    }
    if (extension.pinned) {
      return false;
    }
    const disabledAutoUpdateExtensions = this.getDisabledAutoUpdateExtensions();
    if (disabledAutoUpdateExtensions.includes(extension.identifier.id.toLowerCase())) {
      return false;
    }
    if (autoUpdateValue === true) {
      return true;
    }
    if (autoUpdateValue === "onlyEnabledExtensions") {
      return this.extensionEnablementService.isEnabledEnablementState(extension.enablementState);
    }
    return false;
  }
  async shouldRequireConsentToUpdate(extension) {
    if (!extension.outdated) {
      return;
    }
    if (extension.local?.manifest.main || extension.local?.manifest.browser) {
      return;
    }
    if (!extension.gallery) {
      return;
    }
    if (isDefined(extension.gallery.properties?.executesCode)) {
      if (!extension.gallery.properties.executesCode) {
        return;
      }
    } else {
      const manifest = extension instanceof Extension ? await extension.getGalleryManifest() : await this.galleryService.getManifest(extension.gallery, CancellationToken.None);
      if (!manifest?.main && !manifest?.browser) {
        return;
      }
    }
    return nls.localize("consentRequiredToUpdate", "The update for {0} extension introduces executable code, which is not present in the currently installed version.", extension.displayName);
  }
  isAutoUpdateEnabledFor(extensionOrPublisher) {
    if (isString(extensionOrPublisher)) {
      if (EXTENSION_IDENTIFIER_REGEX.test(extensionOrPublisher)) {
        throw new Error("Expected publisher string, found extension identifier");
      }
      if (this.isAutoUpdateEnabled()) {
        return true;
      }
      return this.isAutoUpdateEnabledForPublisher(extensionOrPublisher);
    }
    return this.shouldAutoUpdateExtension(extensionOrPublisher);
  }
  isAutoUpdateEnabledForPublisher(publisher) {
    const publishersToAutoUpdate = this.getPublishersToAutoUpdate();
    return publishersToAutoUpdate.includes(publisher.toLowerCase());
  }
  async updateAutoUpdateEnablementFor(extensionOrPublisher, enable) {
    if (this.isAutoUpdateEnabled()) {
      if (isString(extensionOrPublisher)) {
        throw new Error("Expected extension, found publisher string");
      }
      const disabledAutoUpdateExtensions = this.getDisabledAutoUpdateExtensions();
      const extensionId = extensionOrPublisher.identifier.id.toLowerCase();
      const extensionIndex = disabledAutoUpdateExtensions.indexOf(extensionId);
      if (enable) {
        if (extensionIndex !== -1) {
          disabledAutoUpdateExtensions.splice(extensionIndex, 1);
        }
      } else {
        if (extensionIndex === -1) {
          disabledAutoUpdateExtensions.push(extensionId);
        }
      }
      this.setDisabledAutoUpdateExtensions(disabledAutoUpdateExtensions);
      if (enable && extensionOrPublisher.local && extensionOrPublisher.pinned) {
        await this.extensionManagementService.updateMetadata(extensionOrPublisher.local, { pinned: false });
      }
      this._onChange.fire(extensionOrPublisher);
    } else {
      const enabledAutoUpdateExtensions = this.getEnabledAutoUpdateExtensions();
      if (isString(extensionOrPublisher)) {
        if (EXTENSION_IDENTIFIER_REGEX.test(extensionOrPublisher)) {
          throw new Error("Expected publisher string, found extension identifier");
        }
        extensionOrPublisher = extensionOrPublisher.toLowerCase();
        if (this.isAutoUpdateEnabledFor(extensionOrPublisher) !== enable) {
          if (enable) {
            enabledAutoUpdateExtensions.push(extensionOrPublisher);
          } else {
            if (enabledAutoUpdateExtensions.includes(extensionOrPublisher)) {
              enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionOrPublisher), 1);
            }
          }
        }
        this.setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions);
        for (const e of this.installed) {
          if (e.publisher.toLowerCase() === extensionOrPublisher) {
            this._onChange.fire(e);
          }
        }
      } else {
        const extensionId = extensionOrPublisher.identifier.id.toLowerCase();
        const enableAutoUpdatesForPublisher = this.isAutoUpdateEnabledFor(extensionOrPublisher.publisher.toLowerCase());
        const enableAutoUpdatesForExtension = enabledAutoUpdateExtensions.includes(extensionId);
        const disableAutoUpdatesForExtension = enabledAutoUpdateExtensions.includes(`-${extensionId}`);
        if (enable) {
          if (disableAutoUpdatesForExtension) {
            enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(`-${extensionId}`), 1);
          }
          if (enableAutoUpdatesForPublisher) {
            if (enableAutoUpdatesForExtension) {
              enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionId), 1);
            }
          } else {
            if (!enableAutoUpdatesForExtension) {
              enabledAutoUpdateExtensions.push(extensionId);
            }
          }
        } else {
          if (enableAutoUpdatesForExtension) {
            enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(extensionId), 1);
          }
          if (enableAutoUpdatesForPublisher) {
            if (!disableAutoUpdatesForExtension) {
              enabledAutoUpdateExtensions.push(`-${extensionId}`);
            }
          } else {
            if (disableAutoUpdatesForExtension) {
              enabledAutoUpdateExtensions.splice(enabledAutoUpdateExtensions.indexOf(`-${extensionId}`), 1);
            }
          }
        }
        this.setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions);
        this._onChange.fire(extensionOrPublisher);
      }
    }
    if (enable) {
      this.autoUpdateExtensions();
    }
  }
  onDidSelectedExtensionToAutoUpdateValueChange() {
    if (this.enabledAuotUpdateExtensionsValue !== this.getEnabledAutoUpdateExtensionsValue() || this.disabledAutoUpdateExtensionsValue !== this.getDisabledAutoUpdateExtensionsValue()) {
      const userExtensions = this.installed.filter((e) => !e.isBuiltin);
      const groupBy = (extensions) => {
        const shouldAutoUpdate2 = [];
        const shouldNotAutoUpdate2 = [];
        for (const extension of extensions) {
          if (this.shouldAutoUpdateExtension(extension)) {
            shouldAutoUpdate2.push(extension);
          } else {
            shouldNotAutoUpdate2.push(extension);
          }
        }
        return [shouldAutoUpdate2, shouldNotAutoUpdate2];
      };
      const [wasShouldAutoUpdate, wasShouldNotAutoUpdate] = groupBy(userExtensions);
      this._enabledAutoUpdateExtensionsValue = void 0;
      this._disabledAutoUpdateExtensionsValue = void 0;
      const [shouldAutoUpdate, shouldNotAutoUpdate] = groupBy(userExtensions);
      for (const e of wasShouldAutoUpdate ?? []) {
        if (shouldNotAutoUpdate?.includes(e)) {
          this._onChange.fire(e);
        }
      }
      for (const e of wasShouldNotAutoUpdate ?? []) {
        if (shouldAutoUpdate?.includes(e)) {
          this._onChange.fire(e);
        }
      }
    }
  }
  async canInstall(extension) {
    if (!(extension instanceof Extension)) {
      return new MarkdownString().appendText(nls.localize("not an extension", "The provided object is not an extension."));
    }
    if (extension.isMalicious) {
      return new MarkdownString().appendText(nls.localize("malicious", "This extension is reported to be problematic."));
    }
    if (extension.deprecationInfo?.disallowInstall) {
      return new MarkdownString().appendText(nls.localize("disallowed", "This extension is disallowed to be installed."));
    }
    if (extension.gallery) {
      if (!extension.gallery.isSigned && (await this.extensionGalleryManifestService.getExtensionGalleryManifest())?.capabilities.signing?.allRepositorySigned) {
        return new MarkdownString().appendText(nls.localize("not signed", "This extension is not signed."));
      }
      const localResult = this.localExtensions ? await this.localExtensions.canInstall(extension.gallery) : void 0;
      if (localResult === true) {
        return true;
      }
      const remoteResult = this.remoteExtensions ? await this.remoteExtensions.canInstall(extension.gallery) : void 0;
      if (remoteResult === true) {
        return true;
      }
      const webResult = this.webExtensions ? await this.webExtensions.canInstall(extension.gallery) : void 0;
      if (webResult === true) {
        return true;
      }
      return localResult ?? remoteResult ?? webResult ?? new MarkdownString().appendText(nls.localize("cannot be installed", "Cannot install the '{0}' extension because it is not available in this setup.", extension.displayName ?? extension.identifier.id));
    }
    if (extension.resourceExtension && await this.extensionManagementService.canInstall(extension.resourceExtension) === true) {
      return true;
    }
    return new MarkdownString().appendText(nls.localize("cannot be installed", "Cannot install the '{0}' extension because it is not available in this setup.", extension.displayName ?? extension.identifier.id));
  }
  async install(arg, installOptions = {}, progressLocation) {
    let installable;
    let extension;
    let servers;
    if (arg instanceof URI) {
      installable = arg;
    } else {
      let installableInfo;
      let gallery;
      if (isString(arg)) {
        extension = this.local.find((e) => areSameExtensions(e.identifier, { id: arg }));
        if (!extension?.isBuiltin) {
          installableInfo = { id: arg, version: installOptions.version, preRelease: installOptions.installPreReleaseVersion ?? this.preferPreReleases };
        }
      } else if (arg.gallery) {
        extension = arg;
        gallery = arg.gallery;
        if (installOptions.version && installOptions.version !== gallery?.version) {
          installableInfo = { id: extension.identifier.id, version: installOptions.version };
        }
      } else if (arg.resourceExtension) {
        extension = arg;
        installable = arg.resourceExtension;
      }
      if (installableInfo) {
        const targetPlatform = extension?.server ? await extension.server.extensionManagementService.getTargetPlatform() : void 0;
        gallery = (await this.galleryService.getExtensions([installableInfo], { targetPlatform }, CancellationToken.None)).at(0);
      }
      if (!extension && gallery) {
        extension = this.instantiationService.createInstance(Extension, (ext) => this.getExtensionState(ext), (ext) => this.getRuntimeState(ext), void 0, void 0, gallery, void 0);
        extension.setExtensionsControlManifest(await this.extensionManagementService.getExtensionsControlManifest());
      }
      if (extension?.isMalicious) {
        throw new Error(nls.localize("malicious", "This extension is reported to be problematic."));
      }
      if (gallery) {
        if (installOptions.installEverywhere) {
          servers = [];
          const installableServers = await this.extensionManagementService.getInstallableServers(gallery);
          for (const extensionsServer of this.extensionsServers) {
            if (installableServers.includes(extensionsServer.server) && !extensionsServer.local.find((e) => areSameExtensions(e.identifier, gallery.identifier))) {
              servers.push(extensionsServer.server);
            }
          }
        } else if (installOptions.enable && extension?.local) {
          servers = [];
          if (extension.enablementState === EnablementState.DisabledByExtensionKind) {
            const [installableServer] = await this.extensionManagementService.getInstallableServers(gallery);
            if (installableServer) {
              servers.push(installableServer);
            }
          }
        }
      }
      if (!servers || servers.length) {
        if (!installable) {
          if (!gallery) {
            const id = isString(arg) ? arg : arg.identifier.id;
            const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
            const reportIssueUri = manifest ? getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ReportIssueUri) : void 0;
            const reportIssueMessage = reportIssueUri ? nls.localize("report issue", "If this issue persists, please report it at {0}", reportIssueUri.toString()) : "";
            if (installOptions.version) {
              const message = nls.localize("not found version", "The extension '{0}' cannot be installed because the requested version '{1}' was not found.", id, installOptions.version);
              throw new ExtensionManagementError(reportIssueMessage ? `${message} ${reportIssueMessage}` : message, ExtensionManagementErrorCode.NotFound);
            } else {
              const message = nls.localize("not found", "The extension '{0}' cannot be installed because it was not found.", id);
              throw new ExtensionManagementError(reportIssueMessage ? `${message} ${reportIssueMessage}` : message, ExtensionManagementErrorCode.NotFound);
            }
          }
          installable = gallery;
        }
        if (installOptions.version) {
          installOptions.installGivenVersion = true;
        }
        if (extension?.isWorkspaceScoped) {
          installOptions.isWorkspaceScoped = true;
        }
      }
    }
    if (installable) {
      if (installOptions.justification) {
        const syncCheck = isUndefined(installOptions.isMachineScoped) && this.userDataSyncEnablementService.isEnabled() && this.userDataSyncEnablementService.isResourceEnabled(SyncResource.Extensions);
        const buttons = [];
        buttons.push({
          label: isString(installOptions.justification) || !installOptions.justification.action ? nls.localize({ key: "installButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Install Extension") : nls.localize({ key: "installButtonLabelWithAction", comment: ["&& denotes a mnemonic"] }, "&&Install Extension and {0}", installOptions.justification.action),
          run: () => true
        });
        if (!extension) {
          buttons.push({ label: nls.localize("open", "Open Extension"), run: () => {
            this.open(extension);
            return false;
          } });
        }
        const result = await this.dialogService.prompt({
          title: nls.localize("installExtensionTitle", "Install Extension"),
          message: extension ? nls.localize("installExtensionMessage", "Would you like to install '{0}' extension from '{1}'?", extension.displayName, extension.publisherDisplayName) : nls.localize("installVSIXMessage", "Would you like to install the extension?"),
          detail: isString(installOptions.justification) ? installOptions.justification : installOptions.justification.reason,
          cancelButton: true,
          buttons,
          checkbox: syncCheck ? {
            label: nls.localize("sync extension", "Sync this extension"),
            checked: true
          } : void 0
        });
        if (!result.result) {
          throw new CancellationError();
        }
        if (syncCheck) {
          installOptions.isMachineScoped = !result.checkboxChecked;
        }
      }
      if (installable instanceof URI) {
        extension = await this.doInstall(void 0, () => this.installFromVSIX(installable, installOptions), progressLocation);
      } else if (extension) {
        if (extension.resourceExtension) {
          extension = await this.doInstall(extension, () => this.extensionManagementService.installResourceExtension(installable, installOptions), progressLocation);
        } else {
          extension = await this.doInstall(extension, () => this.installFromGallery(extension, installable, installOptions, servers), progressLocation);
        }
      }
    }
    if (!extension) {
      throw new Error(nls.localize("unknown", "Unable to install extension"));
    }
    if (installOptions.enable) {
      if (extension.enablementState === EnablementState.DisabledWorkspace || extension.enablementState === EnablementState.DisabledGlobally) {
        if (installOptions.justification) {
          const result = await this.dialogService.confirm({
            title: nls.localize("enableExtensionTitle", "Enable Extension"),
            message: nls.localize("enableExtensionMessage", "Would you like to enable '{0}' extension?", extension.displayName),
            detail: isString(installOptions.justification) ? installOptions.justification : installOptions.justification.reason,
            primaryButton: isString(installOptions.justification) ? nls.localize({ key: "enableButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Enable Extension") : nls.localize({ key: "enableButtonLabelWithAction", comment: ["&& denotes a mnemonic"] }, "&&Enable Extension and {0}", installOptions.justification.action)
          });
          if (!result.confirmed) {
            throw new CancellationError();
          }
        }
        await this.setEnablement(extension, extension.enablementState === EnablementState.DisabledWorkspace ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally);
      }
      await this.waitUntilExtensionIsEnabled(extension);
    }
    return extension;
  }
  async installInServer(extension, server, installOptions) {
    await this.doInstall(extension, async () => {
      const local = extension.local;
      if (!local) {
        throw new Error("Extension not found");
      }
      if (!extension.gallery) {
        extension = (await this.getExtensions([{ ...extension.identifier, preRelease: local.preRelease }], CancellationToken.None))[0] ?? extension;
      }
      if (extension.gallery) {
        return server.extensionManagementService.installFromGallery(extension.gallery, { installPreReleaseVersion: local.preRelease, ...installOptions });
      }
      const targetPlatform = await server.extensionManagementService.getTargetPlatform();
      if (!isTargetPlatformCompatible(local.targetPlatform, [local.targetPlatform], targetPlatform)) {
        throw new Error(nls.localize("incompatible", "Can't install '{0}' extension because it is not compatible.", extension.identifier.id));
      }
      const vsix = await this.extensionManagementService.zip(local);
      try {
        return await server.extensionManagementService.install(vsix);
      } finally {
        try {
          await this.fileService.del(vsix);
        } catch (error) {
          this.logService.error(error);
        }
      }
    });
  }
  canSetLanguage(extension) {
    if (!isWeb) {
      return false;
    }
    if (!extension.gallery) {
      return false;
    }
    const locale = getLocale(extension.gallery);
    if (!locale) {
      return false;
    }
    return true;
  }
  async setLanguage(extension) {
    if (!this.canSetLanguage(extension)) {
      throw new Error("Can not set language");
    }
    const locale = getLocale(extension.gallery);
    if (locale === language) {
      return;
    }
    const localizedLanguageName = extension.gallery?.properties?.localizedLanguages?.[0];
    return this.localeService.setLocale({ id: locale, galleryExtension: extension.gallery, extensionId: extension.identifier.id, label: localizedLanguageName ?? extension.displayName });
  }
  setEnablement(extensions, enablementState) {
    extensions = Array.isArray(extensions) ? extensions : [extensions];
    return this.promptAndSetEnablement(extensions, enablementState);
  }
  async uninstall(e) {
    const extension = e.local ? e : this.local.find((local) => areSameExtensions(local.identifier, e.identifier));
    if (!extension?.local) {
      throw new Error("Missing local");
    }
    const extensionsToUninstall = [{ extension: extension.local }];
    for (const packExtension of this.getAllPackExtensionsToUninstall(extension.local, this.local)) {
      if (!extensionsToUninstall.some((e2) => areSameExtensions(e2.extension.identifier, packExtension.identifier))) {
        extensionsToUninstall.push({ extension: packExtension });
      }
    }
    const dependents = [];
    for (const { extension: extension2 } of extensionsToUninstall) {
      for (const local of this.local) {
        if (!local.local) {
          continue;
        }
        if (areSameExtensions(local.identifier, extension2.identifier)) {
          continue;
        }
        if (local.dependencies.length === 0) {
          continue;
        }
        if (extension2.manifest.extensionPack?.some((id) => areSameExtensions({ id }, local.identifier))) {
          continue;
        }
        if (dependents.some((d) => d.extensionPack.some((id) => areSameExtensions({ id }, local.identifier)))) {
          continue;
        }
        if (local.dependencies.some((dep) => areSameExtensions(extension2.identifier, { id: dep }))) {
          dependents.push(local);
          extensionsToUninstall.push({ extension: local.local });
        }
      }
    }
    if (dependents.length) {
      const { result } = await this.dialogService.prompt({
        title: nls.localize("uninstallDependents", "Uninstall Extension with Dependents"),
        type: Severity.Warning,
        message: this.getErrorMessageForUninstallingAnExtensionWithDependents(extension, dependents),
        buttons: [{
          label: nls.localize("uninstallAll", "Uninstall All"),
          run: () => true
        }],
        cancelButton: {
          run: () => false
        }
      });
      if (!result) {
        throw new CancellationError();
      }
    }
    return this.withProgress({
      location: ProgressLocation.Extensions,
      title: nls.localize("uninstallingExtension", "Uninstalling extension...."),
      source: `${extension.identifier.id}`
    }, () => this.extensionManagementService.uninstallExtensions(extensionsToUninstall).then(() => void 0));
  }
  getAllPackExtensionsToUninstall(extension, installed, checked = []) {
    if (checked.some((e) => areSameExtensions(e.identifier, extension.identifier))) {
      return [];
    }
    checked.push(extension);
    const extensionsPack = extension.manifest.extensionPack ?? [];
    if (extensionsPack.length) {
      const packedExtensions = [];
      for (const i of installed) {
        if (i.local && !i.isBuiltin && extensionsPack.some((id) => areSameExtensions({ id }, i.identifier))) {
          packedExtensions.push(i.local);
        }
      }
      const packOfPackedExtensions = [];
      for (const packedExtension of packedExtensions) {
        packOfPackedExtensions.push(...this.getAllPackExtensionsToUninstall(packedExtension, installed, checked));
      }
      return [...packedExtensions, ...packOfPackedExtensions];
    }
    return [];
  }
  getErrorMessageForUninstallingAnExtensionWithDependents(extension, dependents) {
    if (dependents.length === 1) {
      return nls.localize("singleDependentUninstallError", "Cannot uninstall '{0}' extension alone. '{1}' extension depends on this. Do you want to uninstall all these extensions?", extension.displayName, dependents[0].displayName);
    }
    if (dependents.length === 2) {
      return nls.localize(
        "twoDependentsUninstallError",
        "Cannot uninstall '{0}' extension alone. '{1}' and '{2}' extensions depend on this. Do you want to uninstall all these extensions?",
        extension.displayName,
        dependents[0].displayName,
        dependents[1].displayName
      );
    }
    return nls.localize(
      "multipleDependentsUninstallError",
      "Cannot uninstall '{0}' extension alone. '{1}', '{2}' and other extensions depend on this. Do you want to uninstall all these extensions?",
      extension.displayName,
      dependents[0].displayName,
      dependents[1].displayName
    );
  }
  isExtensionIgnoredToSync(extension) {
    return extension.local ? !this.isInstalledExtensionSynced(extension.local) : this.extensionsSyncManagementService.hasToNeverSyncExtension(extension.identifier.id);
  }
  async togglePreRelease(extension) {
    if (!extension.local) {
      return;
    }
    if (extension.preRelease !== extension.isPreReleaseVersion) {
      await this.extensionManagementService.updateMetadata(extension.local, { preRelease: !extension.preRelease });
      return;
    }
    await this.install(extension, { installPreReleaseVersion: !extension.preRelease, preRelease: !extension.preRelease });
  }
  async toggleExtensionIgnoredToSync(extension) {
    const isIgnored = this.isExtensionIgnoredToSync(extension);
    if (extension.local && isIgnored) {
      extension.local = await this.updateSynchronizingInstalledExtension(extension.local, true);
      this._onChange.fire(extension);
    } else {
      this.extensionsSyncManagementService.updateIgnoredExtensions(extension.identifier.id, !isIgnored);
    }
    await this.userDataAutoSyncService.triggerSync(["IgnoredExtensionsUpdated"]);
  }
  async toggleApplyExtensionToAllProfiles(extension) {
    if (!extension.local || isApplicationScopedExtension(extension.local.manifest) || extension.isBuiltin) {
      return;
    }
    const isApplicationScoped = extension.local.isApplicationScoped;
    await Promise.all(this.getAllExtensions().map(async (extensions) => {
      const local = extensions.local.find((e) => areSameExtensions(e.identifier, extension.identifier))?.local;
      if (local && local.isApplicationScoped === isApplicationScoped) {
        await this.extensionManagementService.toggleAppliationScope(local, this.userDataProfileService.currentProfile.extensionsResource);
      }
    }));
  }
  getAllExtensions() {
    const extensions = [];
    if (this.localExtensions) {
      extensions.push(this.localExtensions);
    }
    if (this.remoteExtensions) {
      extensions.push(this.remoteExtensions);
    }
    if (this.webExtensions) {
      extensions.push(this.webExtensions);
    }
    return extensions;
  }
  isInstalledExtensionSynced(extension) {
    if (extension.isMachineScoped) {
      return false;
    }
    if (this.extensionsSyncManagementService.hasToAlwaysSyncExtension(extension.identifier.id)) {
      return true;
    }
    return !this.extensionsSyncManagementService.hasToNeverSyncExtension(extension.identifier.id);
  }
  async updateSynchronizingInstalledExtension(extension, sync) {
    const isMachineScoped = !sync;
    if (extension.isMachineScoped !== isMachineScoped) {
      extension = await this.extensionManagementService.updateMetadata(extension, { isMachineScoped });
    }
    if (sync) {
      this.extensionsSyncManagementService.updateIgnoredExtensions(extension.identifier.id, false);
    }
    return extension;
  }
  doInstall(extension, installTask, progressLocation) {
    const title = extension ? nls.localize("installing named extension", "Installing '{0}' extension....", extension.displayName) : nls.localize("installing extension", "Installing extension....");
    return this.withProgress({
      location: progressLocation ?? ProgressLocation.Extensions,
      title
    }, async () => {
      try {
        if (extension) {
          this.installing.push(extension);
          this._onChange.fire(extension);
        }
        const local = await installTask();
        return await this.waitAndGetInstalledExtension(local.identifier);
      } finally {
        if (extension) {
          this.installing = this.installing.filter((e) => e !== extension);
          this._onChange.fire(void 0);
        }
      }
    });
  }
  async installFromVSIX(vsix, installOptions) {
    const manifest = await this.extensionManagementService.getManifest(vsix);
    const existingExtension = this.local.find((local) => areSameExtensions(local.identifier, { id: getGalleryExtensionId(manifest.publisher, manifest.name) }));
    if (existingExtension) {
      installOptions = installOptions || {};
      if (existingExtension.latestVersion === manifest.version) {
        installOptions.pinned = existingExtension.local?.pinned || !this.shouldAutoUpdateExtension(existingExtension);
      } else {
        installOptions.installGivenVersion = true;
      }
    }
    return this.extensionManagementService.installVSIX(vsix, manifest, installOptions);
  }
  installFromGallery(extension, gallery, installOptions, servers) {
    installOptions = installOptions ?? {};
    installOptions.pinned = extension.local?.pinned || !this.shouldAutoUpdateExtension(extension);
    if (extension.local && !servers) {
      installOptions.productVersion = this.getProductVersion();
      installOptions.operation = InstallOperation.Update;
      return this.extensionManagementService.updateFromGallery(gallery, extension.local, installOptions);
    } else {
      return this.extensionManagementService.installFromGallery(gallery, installOptions, servers);
    }
  }
  async waitAndGetInstalledExtension(identifier) {
    let installedExtension = this.local.find((local) => areSameExtensions(local.identifier, identifier));
    if (!installedExtension) {
      await Event.toPromise(Event.filter(this.onChange, (e) => !!e && this.local.some((local) => areSameExtensions(local.identifier, identifier))));
    }
    installedExtension = this.local.find((local) => areSameExtensions(local.identifier, identifier));
    if (!installedExtension) {
      throw new Error("Extension should have been installed");
    }
    return installedExtension;
  }
  async waitUntilExtensionIsEnabled(extension) {
    if (this.extensionService.extensions.find((e) => ExtensionIdentifier.equals(e.identifier, extension.identifier.id))) {
      return;
    }
    if (!extension.local || !this.extensionService.canAddExtension(toExtensionDescription(extension.local))) {
      return;
    }
    await new Promise((c, e) => {
      const disposable = this.extensionService.onDidChangeExtensions(() => {
        try {
          if (this.extensionService.extensions.find((e2) => ExtensionIdentifier.equals(e2.identifier, extension.identifier.id))) {
            disposable.dispose();
            c();
          }
        } catch (error) {
          e(error);
        }
      });
    });
  }
  promptAndSetEnablement(extensions, enablementState) {
    const enable = enablementState === EnablementState.EnabledGlobally || enablementState === EnablementState.EnabledWorkspace;
    if (enable) {
      const allDependenciesAndPackedExtensions = this.getExtensionsRecursively(extensions, this.local, enablementState, { dependencies: true, pack: true });
      return this.checkAndSetEnablement(extensions, allDependenciesAndPackedExtensions, enablementState);
    } else {
      const packedExtensions = this.getExtensionsRecursively(extensions, this.local, enablementState, { dependencies: false, pack: true });
      if (packedExtensions.length) {
        return this.checkAndSetEnablement(extensions, packedExtensions, enablementState);
      }
      return this.checkAndSetEnablement(extensions, [], enablementState);
    }
  }
  async checkAndSetEnablement(extensions, otherExtensions, enablementState) {
    const allExtensions = [...extensions, ...otherExtensions];
    const enable = enablementState === EnablementState.EnabledGlobally || enablementState === EnablementState.EnabledWorkspace;
    if (!enable) {
      for (const extension of extensions) {
        const dependents = this.getDependentsAfterDisablement(extension, allExtensions, this.local);
        if (dependents.length) {
          const { result } = await this.dialogService.prompt({
            title: nls.localize("disableDependents", "Disable Extension with Dependents"),
            type: Severity.Warning,
            message: this.getDependentsErrorMessageForDisablement(extension, allExtensions, dependents),
            buttons: [{
              label: nls.localize("disable all", "Disable All"),
              run: () => true
            }],
            cancelButton: {
              run: () => false
            }
          });
          if (!result) {
            throw new CancellationError();
          }
          await this.checkAndSetEnablement(dependents, [extension], enablementState);
        }
      }
    }
    return this.doSetEnablement(allExtensions, enablementState);
  }
  getExtensionsRecursively(extensions, installed, enablementState, options, checked = []) {
    const toCheck = extensions.filter((e) => checked.indexOf(e) === -1);
    if (toCheck.length) {
      for (const extension of toCheck) {
        checked.push(extension);
      }
      const extensionsToEanbleOrDisable = installed.filter((i) => {
        if (checked.indexOf(i) !== -1) {
          return false;
        }
        const enable = enablementState === EnablementState.EnabledGlobally || enablementState === EnablementState.EnabledWorkspace;
        const isExtensionEnabled = i.enablementState === EnablementState.EnabledGlobally || i.enablementState === EnablementState.EnabledWorkspace;
        if (enable === isExtensionEnabled) {
          return false;
        }
        return (enable || !i.isBuiltin) && (options.dependencies || options.pack) && extensions.some(
          (extension) => options.dependencies && extension.dependencies.some((id) => areSameExtensions({ id }, i.identifier)) || options.pack && extension.extensionPack.some((id) => areSameExtensions({ id }, i.identifier))
        );
      });
      if (extensionsToEanbleOrDisable.length) {
        extensionsToEanbleOrDisable.push(...this.getExtensionsRecursively(extensionsToEanbleOrDisable, installed, enablementState, options, checked));
      }
      return extensionsToEanbleOrDisable;
    }
    return [];
  }
  getDependentsAfterDisablement(extension, extensionsToDisable, installed) {
    return installed.filter((i) => {
      if (i.dependencies.length === 0) {
        return false;
      }
      if (i === extension) {
        return false;
      }
      if (!this.extensionEnablementService.isEnabledEnablementState(i.enablementState)) {
        return false;
      }
      if (extensionsToDisable.indexOf(i) !== -1) {
        return false;
      }
      return i.dependencies.some((dep) => [extension, ...extensionsToDisable].some((d) => areSameExtensions(d.identifier, { id: dep })));
    });
  }
  getDependentsErrorMessageForDisablement(extension, allDisabledExtensions, dependents) {
    for (const e of [extension, ...allDisabledExtensions]) {
      const dependentsOfTheExtension = dependents.filter((d) => d.dependencies.some((id) => areSameExtensions({ id }, e.identifier)));
      if (dependentsOfTheExtension.length) {
        return this.getErrorMessageForDisablingAnExtensionWithDependents(e, dependentsOfTheExtension);
      }
    }
    return "";
  }
  getErrorMessageForDisablingAnExtensionWithDependents(extension, dependents) {
    if (dependents.length === 1) {
      return nls.localize("singleDependentError", "Cannot disable '{0}' extension alone. '{1}' extension depends on this. Do you want to disable all these extensions?", extension.displayName, dependents[0].displayName);
    }
    if (dependents.length === 2) {
      return nls.localize(
        "twoDependentsError",
        "Cannot disable '{0}' extension alone. '{1}' and '{2}' extensions depend on this. Do you want to disable all these extensions?",
        extension.displayName,
        dependents[0].displayName,
        dependents[1].displayName
      );
    }
    return nls.localize(
      "multipleDependentsError",
      "Cannot disable '{0}' extension alone. '{1}', '{2}' and other extensions depend on this. Do you want to disable all these extensions?",
      extension.displayName,
      dependents[0].displayName,
      dependents[1].displayName
    );
  }
  async doSetEnablement(extensions, enablementState) {
    return await this.extensionEnablementService.setEnablement(extensions.map((e) => e.local), enablementState);
  }
  reportProgressFromOtherSources() {
    if (this.installed.some((e) => e.state === ExtensionState.Installing || e.state === ExtensionState.Uninstalling)) {
      if (!this._activityCallBack) {
        this.withProgress({ location: ProgressLocation.Extensions }, () => new Promise((resolve) => this._activityCallBack = resolve));
      }
    } else {
      this._activityCallBack?.();
      this._activityCallBack = void 0;
    }
  }
  withProgress(options, task) {
    return this.progressService.withProgress(options, async () => {
      const cancelableTask = createCancelablePromise(() => task());
      this.tasksInProgress.push(cancelableTask);
      try {
        return await cancelableTask;
      } finally {
        const index2 = this.tasksInProgress.indexOf(cancelableTask);
        if (index2 !== -1) {
          this.tasksInProgress.splice(index2, 1);
        }
      }
    });
  }
  onError(err) {
    if (isCancellationError(err)) {
      return;
    }
    const message = err && err.message || "";
    if (/getaddrinfo ENOTFOUND|getaddrinfo ENOENT|connect EACCES|connect ECONNREFUSED/.test(message)) {
      return;
    }
    this.notificationService.error(err);
  }
  handleURL(uri, options) {
    if (!/^extension/.test(uri.path)) {
      return Promise.resolve(false);
    }
    this.onOpenExtensionUrl(uri);
    return Promise.resolve(true);
  }
  onOpenExtensionUrl(uri) {
    const match = /^extension\/([^/]+)$/.exec(uri.path);
    if (!match) {
      return;
    }
    const extensionId = match[1];
    this.queryLocal().then(async (local) => {
      let extension = local.find((local2) => areSameExtensions(local2.identifier, { id: extensionId }));
      if (!extension) {
        [extension] = await this.getExtensions([{ id: extensionId }], { source: "uri" }, CancellationToken.None);
      }
      if (extension) {
        await this.hostService.focus(mainWindow);
        await this.open(extension);
      }
    }).then(void 0, (error) => this.onError(error));
  }
  getPublishersToAutoUpdate() {
    return this.getEnabledAutoUpdateExtensions().filter((id) => !EXTENSION_IDENTIFIER_REGEX.test(id));
  }
  getEnabledAutoUpdateExtensions() {
    try {
      const parsedValue = JSON.parse(this.enabledAuotUpdateExtensionsValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue;
      }
    } catch (e) {
    }
    return [];
  }
  setEnabledAutoUpdateExtensions(enabledAutoUpdateExtensions) {
    this.enabledAuotUpdateExtensionsValue = JSON.stringify(enabledAutoUpdateExtensions);
  }
  get enabledAuotUpdateExtensionsValue() {
    if (!this._enabledAutoUpdateExtensionsValue) {
      this._enabledAutoUpdateExtensionsValue = this.getEnabledAutoUpdateExtensionsValue();
    }
    return this._enabledAutoUpdateExtensionsValue;
  }
  set enabledAuotUpdateExtensionsValue(enabledAuotUpdateExtensionsValue) {
    if (this.enabledAuotUpdateExtensionsValue !== enabledAuotUpdateExtensionsValue) {
      this._enabledAutoUpdateExtensionsValue = enabledAuotUpdateExtensionsValue;
      this.setEnabledAutoUpdateExtensionsValue(enabledAuotUpdateExtensionsValue);
    }
  }
  getEnabledAutoUpdateExtensionsValue() {
    return this.storageService.get(EXTENSIONS_AUTO_UPDATE_KEY, StorageScope.APPLICATION, "[]");
  }
  setEnabledAutoUpdateExtensionsValue(value) {
    this.storageService.store(EXTENSIONS_AUTO_UPDATE_KEY, value, StorageScope.APPLICATION, StorageTarget.USER);
  }
  getDisabledAutoUpdateExtensions() {
    try {
      const parsedValue = JSON.parse(this.disabledAutoUpdateExtensionsValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue;
      }
    } catch (e) {
    }
    return [];
  }
  setDisabledAutoUpdateExtensions(disabledAutoUpdateExtensions) {
    this.disabledAutoUpdateExtensionsValue = JSON.stringify(disabledAutoUpdateExtensions);
  }
  get disabledAutoUpdateExtensionsValue() {
    if (!this._disabledAutoUpdateExtensionsValue) {
      this._disabledAutoUpdateExtensionsValue = this.getDisabledAutoUpdateExtensionsValue();
    }
    return this._disabledAutoUpdateExtensionsValue;
  }
  set disabledAutoUpdateExtensionsValue(disabledAutoUpdateExtensionsValue) {
    if (this.disabledAutoUpdateExtensionsValue !== disabledAutoUpdateExtensionsValue) {
      this._disabledAutoUpdateExtensionsValue = disabledAutoUpdateExtensionsValue;
      this.setDisabledAutoUpdateExtensionsValue(disabledAutoUpdateExtensionsValue);
    }
  }
  getDisabledAutoUpdateExtensionsValue() {
    return this.storageService.get(EXTENSIONS_DONOT_AUTO_UPDATE_KEY, StorageScope.APPLICATION, "[]");
  }
  setDisabledAutoUpdateExtensionsValue(value) {
    this.storageService.store(EXTENSIONS_DONOT_AUTO_UPDATE_KEY, value, StorageScope.APPLICATION, StorageTarget.USER);
  }
  getDismissedNotifications() {
    try {
      const parsedValue = JSON.parse(this.dismissedNotificationsValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue;
      }
    } catch (e) {
    }
    return [];
  }
  setDismissedNotifications(dismissedNotifications) {
    this.dismissedNotificationsValue = JSON.stringify(dismissedNotifications);
  }
  get dismissedNotificationsValue() {
    if (!this._dismissedNotificationsValue) {
      this._dismissedNotificationsValue = this.getDismissedNotificationsValue();
    }
    return this._dismissedNotificationsValue;
  }
  set dismissedNotificationsValue(dismissedNotificationsValue) {
    if (this.dismissedNotificationsValue !== dismissedNotificationsValue) {
      this._dismissedNotificationsValue = dismissedNotificationsValue;
      this.setDismissedNotificationsValue(dismissedNotificationsValue);
    }
  }
  getDismissedNotificationsValue() {
    return this.storageService.get(EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, StorageScope.PROFILE, "[]");
  }
  setDismissedNotificationsValue(value) {
    this.storageService.store(EXTENSIONS_DISMISSED_NOTIFICATIONS_KEY, value, StorageScope.PROFILE, StorageTarget.USER);
  }
};
ExtensionsWorkbenchService.UpdatesCheckInterval = 1e3 * 60 * 60 * 12;
ExtensionsWorkbenchService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, IWorkbenchExtensionManagementService),
  __decorateParam(3, IExtensionGalleryService),
  __decorateParam(4, IExtensionGalleryManifestService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITelemetryService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IURLService),
  __decorateParam(9, IWorkbenchExtensionEnablementService),
  __decorateParam(10, IHostService),
  __decorateParam(11, IProgressService),
  __decorateParam(12, IExtensionManagementServerService),
  __decorateParam(13, ILanguageService),
  __decorateParam(14, IIgnoredExtensionsManagementService),
  __decorateParam(15, IUserDataAutoSyncService),
  __decorateParam(16, IProductService),
  __decorateParam(17, IContextKeyService),
  __decorateParam(18, IExtensionManifestPropertiesService),
  __decorateParam(19, ILogService),
  __decorateParam(20, IExtensionService),
  __decorateParam(21, ILocaleService),
  __decorateParam(22, ILifecycleService),
  __decorateParam(23, IFileService),
  __decorateParam(24, IUserDataProfileService),
  __decorateParam(25, IStorageService),
  __decorateParam(26, IDialogService),
  __decorateParam(27, IUserDataSyncEnablementService),
  __decorateParam(28, IUpdateService),
  __decorateParam(29, IUriIdentityService),
  __decorateParam(30, IWorkspaceContextService),
  __decorateParam(31, IViewsService),
  __decorateParam(32, IFileDialogService),
  __decorateParam(33, IQuickInputService),
  __decorateParam(34, IAllowedExtensionsService)
], ExtensionsWorkbenchService);
export {
  Extension,
  ExtensionsWorkbenchService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZW12ZXIvc2VtdmVyLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaW5kZXggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIFByb21pc2VzLCBUaHJvdHRsZWREZWxheWVyLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVBhZ2VyLCBzaW5nbGVQYWdlUGFnZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYWdpbmcuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQge1xuXHRJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiwgSUdhbGxlcnlFeHRlbnNpb24sIElRdWVyeU9wdGlvbnMsXG5cdEluc3RhbGxFeHRlbnNpb25FdmVudCwgRGlkVW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQsIEluc3RhbGxPcGVyYXRpb24sIFdFQl9FWFRFTlNJT05fVEFHLCBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0LFxuXHRJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCwgSUV4dGVuc2lvbkluZm8sIElFeHRlbnNpb25RdWVyeU9wdGlvbnMsIElEZXByZWNhdGlvbkluZm8sIGlzVGFyZ2V0UGxhdGZvcm1Db21wYXRpYmxlLCBJbnN0YWxsRXh0ZW5zaW9uSW5mbywgRVhURU5TSU9OX0lERU5USUZJRVJfUkVHRVgsXG5cdEluc3RhbGxPcHRpb25zLCBJUHJvZHVjdFZlcnNpb24sXG5cdFVuaW5zdGFsbEV4dGVuc2lvbkluZm8sXG5cdFRhcmdldFBsYXRmb3JtVG9TdHJpbmcsXG5cdElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsXG5cdEFsbG93ZWRFeHRlbnNpb25zQ29uZmlnS2V5LFxuXHRFWFRFTlNJT05fSU5TVEFMTF9TS0lQX1BVQkxJU0hFUl9UUlVTVF9DT05URVhULFxuXHRFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IsXG5cdEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGVcbn0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIEVuYWJsZW1lbnRTdGF0ZSwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciwgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBEZWZhdWx0SWNvblBhdGgsIElSZXNvdXJjZUV4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgZ2V0R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGEsIGdldExvY2FsRXh0ZW5zaW9uVGVsZW1ldHJ5RGF0YSwgYXJlU2FtZUV4dGVuc2lvbnMsIGdyb3VwQnlFeHRlbnNpb24sIGdldEdhbGxlcnlFeHRlbnNpb25JZCwgaXNNYWxpY2lvdXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb24sIEV4dGVuc2lvblN0YXRlLCBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIEF1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5LCBBdXRvQ2hlY2tVcGRhdGVzQ29uZmlndXJhdGlvbktleSwgSGFzT3V0ZGF0ZWRFeHRlbnNpb25zQ29udGV4dCwgQXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25WYWx1ZSwgSW5zdGFsbEV4dGVuc2lvbk9wdGlvbnMsIEV4dGVuc2lvblJ1bnRpbWVTdGF0ZSwgRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUsIEF1dG9SZXN0YXJ0Q29uZmlndXJhdGlvbktleSwgVklFV0xFVF9JRCwgSUV4dGVuc2lvbnNWaWV3UGFuZUNvbnRhaW5lciwgSUV4dGVuc2lvbnNOb3RpZmljYXRpb24gfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCwgQUNUSVZFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVUkxTZXJ2aWNlLCBJVVJMSGFuZGxlciwgSU9wZW5VUkxPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJsL2NvbW1vbi91cmwuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc0lucHV0LCBJRXh0ZW5zaW9uRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zSW5wdXQuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NPcHRpb25zLCBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBOb3RpZmljYXRpb25Qcmlvcml0eSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0LCBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uIGFzIElQbGF0Zm9ybUV4dGVuc2lvbiwgVGFyZ2V0UGxhdGZvcm0sIEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGlzQXBwbGljYXRpb25TY29wZWRFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBGaWxlQWNjZXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJSWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vaWdub3JlZEV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLCBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UsIFN5bmNSZXNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGlzQm9vbGVhbiwgaXNEZWZpbmVkLCBpc1N0cmluZywgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UsIElFeHRlbnNpb25zU3RhdHVzIGFzIElFeHRlbnNpb25SdW50aW1lU3RhdHVzLCB0b0V4dGVuc2lvbiwgdG9FeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgaXNXZWIsIGxhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZ2V0TG9jYWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFuZ3VhZ2VQYWNrcy9jb21tb24vbGFuZ3VhZ2VQYWNrcy5qcyc7XG5pbXBvcnQgeyBJTG9jYWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xvY2FsaXphdGlvbi9jb21tb24vbG9jYWxlLmpzJztcbmltcG9ydCB7IFRlbGVtZXRyeVRydXN0ZWRWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSUZpbGVEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJVXBkYXRlU2VydmljZSwgU3RhdGVUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZSwgaXNFbmdpbmVWYWxpZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvblZhbGlkYXRvci5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFNob3dDdXJyZW50UmVsZWFzZU5vdGVzQWN0aW9uSWQgfSBmcm9tICcuLi8uLi91cGRhdGUvY29tbW9uL3VwZGF0ZS5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLCBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaSwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuXG5pbnRlcmZhY2UgSUV4dGVuc2lvblN0YXRlUHJvdmlkZXI8VD4ge1xuXHQoZXh0ZW5zaW9uOiBFeHRlbnNpb24pOiBUO1xufVxuXG5pbnRlcmZhY2UgSW5zdGFsbGVkRXh0ZW5zaW9uc0V2ZW50IHtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uSWRzOiBUZWxlbWV0cnlUcnVzdGVkVmFsdWU8c3RyaW5nPjtcblx0cmVhZG9ubHkgY291bnQ6IG51bWJlcjtcbn1cbnR5cGUgRXh0ZW5zaW9uc0xvYWRDbGFzc2lmaWNhdGlvbiA9IHtcblx0b3duZXI6ICdkaWdpdGFyYWxkJztcblx0Y29tbWVudDogJ0hlbHBzIHRvIHVuZGVyc3RhbmQgd2hpY2ggZXh0ZW5zaW9ucyBhcmUgdGhlIG1vc3QgYWN0aXZlbHkgdXNlZC4nO1xuXHRyZWFkb25seSBleHRlbnNpb25JZHM6IHsgY2xhc3NpZmljYXRpb246ICdQdWJsaWNOb25QZXJzb25hbERhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGxpc3Qgb2YgZXh0ZW5zaW9uIGlkcyB0aGF0IGFyZSBpbnN0YWxsZWQuJyB9O1xuXHRyZWFkb25seSBjb3VudDogeyBjbGFzc2lmaWNhdGlvbjogJ1B1YmxpY05vblBlcnNvbmFsRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGV4dGVuc2lvbnMgdGhhdCBhcmUgaW5zdGFsbGVkLicgfTtcbn07XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb24gaW1wbGVtZW50cyBJRXh0ZW5zaW9uIHtcblxuXHRwdWJsaWMgZW5hYmxlbWVudFN0YXRlOiBFbmFibGVtZW50U3RhdGUgPSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5O1xuXG5cdHByaXZhdGUgZ2FsbGVyeVJlc291cmNlc0NhY2hlID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHN0YXRlUHJvdmlkZXI6IElFeHRlbnNpb25TdGF0ZVByb3ZpZGVyPEV4dGVuc2lvblN0YXRlPixcblx0XHRwcml2YXRlIHJ1bnRpbWVTdGF0ZVByb3ZpZGVyOiBJRXh0ZW5zaW9uU3RhdGVQcm92aWRlcjxFeHRlbnNpb25SdW50aW1lU3RhdGUgfCB1bmRlZmluZWQ+LFxuXHRcdHB1YmxpYyByZWFkb25seSBzZXJ2ZXI6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyIHwgdW5kZWZpbmVkLFxuXHRcdHB1YmxpYyBsb2NhbDogSUxvY2FsRXh0ZW5zaW9uIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgX2dhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VFeHRlbnNpb25JbmZvOiB7IHJlc291cmNlRXh0ZW5zaW9uOiBJUmVzb3VyY2VFeHRlbnNpb247IGlzV29ya3NwYWNlU2NvcGVkOiBib29sZWFuIH0gfCB1bmRlZmluZWQsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRnZXQgcmVzb3VyY2VFeHRlbnNpb24oKTogSVJlc291cmNlRXh0ZW5zaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5yZXNvdXJjZUV4dGVuc2lvbkluZm8pIHtcblx0XHRcdHJldHVybiB0aGlzLnJlc291cmNlRXh0ZW5zaW9uSW5mby5yZXNvdXJjZUV4dGVuc2lvbjtcblx0XHR9XG5cdFx0aWYgKHRoaXMubG9jYWw/LmlzV29ya3NwYWNlU2NvcGVkKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiAncmVzb3VyY2UnLFxuXHRcdFx0XHRpZGVudGlmaWVyOiB0aGlzLmxvY2FsLmlkZW50aWZpZXIsXG5cdFx0XHRcdGxvY2F0aW9uOiB0aGlzLmxvY2FsLmxvY2F0aW9uLFxuXHRcdFx0XHRtYW5pZmVzdDogdGhpcy5sb2NhbC5tYW5pZmVzdCxcblx0XHRcdFx0Y2hhbmdlbG9nVXJpOiB0aGlzLmxvY2FsLmNoYW5nZWxvZ1VybCxcblx0XHRcdFx0cmVhZG1lVXJpOiB0aGlzLmxvY2FsLnJlYWRtZVVybCxcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgZ2FsbGVyeSgpOiBJR2FsbGVyeUV4dGVuc2lvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2dhbGxlcnk7XG5cdH1cblxuXHRzZXQgZ2FsbGVyeShnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbiB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2dhbGxlcnkgPSBnYWxsZXJ5O1xuXHRcdHRoaXMuZ2FsbGVyeVJlc291cmNlc0NhY2hlLmNsZWFyKCk7XG5cdH1cblxuXHRnZXQgdHlwZSgpOiBFeHRlbnNpb25UeXBlIHtcblx0XHRyZXR1cm4gdGhpcy5sb2NhbCA/IHRoaXMubG9jYWwudHlwZSA6IEV4dGVuc2lvblR5cGUuVXNlcjtcblx0fVxuXG5cdGdldCBpc0J1aWx0aW4oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubG9jYWwgPyB0aGlzLmxvY2FsLmlzQnVpbHRpbiA6IGZhbHNlO1xuXHR9XG5cblx0Z2V0IGlzV29ya3NwYWNlU2NvcGVkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmxvY2FsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sb2NhbC5pc1dvcmtzcGFjZVNjb3BlZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMucmVzb3VyY2VFeHRlbnNpb25JbmZvKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvdXJjZUV4dGVuc2lvbkluZm8uaXNXb3Jrc3BhY2VTY29wZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuZ2FsbGVyeSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeS5uYW1lO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5nZXRNYW5pZmVzdEZyb21Mb2NhbE9yUmVzb3VyY2UoKT8ubmFtZSA/PyAnJztcblx0fVxuXG5cdGdldCBkaXNwbGF5TmFtZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLmdhbGxlcnkpIHtcblx0XHRcdHJldHVybiB0aGlzLmdhbGxlcnkuZGlzcGxheU5hbWUgfHwgdGhpcy5nYWxsZXJ5Lm5hbWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZ2V0TWFuaWZlc3RGcm9tTG9jYWxPclJlc291cmNlKCk/LmRpc3BsYXlOYW1lID8/IHRoaXMubmFtZTtcblx0fVxuXG5cdGdldCBpZGVudGlmaWVyKCk6IElFeHRlbnNpb25JZGVudGlmaWVyIHtcblx0XHRpZiAodGhpcy5nYWxsZXJ5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5LmlkZW50aWZpZXI7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvdXJjZUV4dGVuc2lvbi5pZGVudGlmaWVyO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5sb2NhbCEuaWRlbnRpZmllcjtcblx0fVxuXG5cdGdldCB1dWlkKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeSA/IHRoaXMuZ2FsbGVyeS5pZGVudGlmaWVyLnV1aWQgOiB0aGlzLmxvY2FsPy5pZGVudGlmaWVyLnV1aWQ7XG5cdH1cblxuXHRnZXQgcHVibGlzaGVyKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMuZ2FsbGVyeSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeS5wdWJsaXNoZXI7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmdldE1hbmlmZXN0RnJvbUxvY2FsT3JSZXNvdXJjZSgpPy5wdWJsaXNoZXIgPz8gJyc7XG5cdH1cblxuXHRnZXQgcHVibGlzaGVyRGlzcGxheU5hbWUoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5nYWxsZXJ5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5LnB1Ymxpc2hlckRpc3BsYXlOYW1lIHx8IHRoaXMuZ2FsbGVyeS5wdWJsaXNoZXI7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMubG9jYWw/LnB1Ymxpc2hlckRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sb2NhbC5wdWJsaXNoZXJEaXNwbGF5TmFtZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5wdWJsaXNoZXI7XG5cdH1cblxuXHRnZXQgcHVibGlzaGVyVXJsKCk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeT8ucHVibGlzaGVyTGluayA/IFVSSS5wYXJzZSh0aGlzLmdhbGxlcnkucHVibGlzaGVyTGluaykgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgcHVibGlzaGVyRG9tYWluKCk6IHsgbGluazogc3RyaW5nOyB2ZXJpZmllZDogYm9vbGVhbiB9IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5Py5wdWJsaXNoZXJEb21haW47XG5cdH1cblxuXHRnZXQgcHVibGlzaGVyU3BvbnNvckxpbmsoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5Py5wdWJsaXNoZXJTcG9uc29yTGluayA/IFVSSS5wYXJzZSh0aGlzLmdhbGxlcnkucHVibGlzaGVyU3BvbnNvckxpbmspIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHZlcnNpb24oKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5sb2NhbCA/IHRoaXMubG9jYWwubWFuaWZlc3QudmVyc2lvbiA6IHRoaXMubGF0ZXN0VmVyc2lvbjtcblx0fVxuXG5cdGdldCBwcml2YXRlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmxvY2FsID8gdGhpcy5sb2NhbC5wcml2YXRlIDogdGhpcy5nYWxsZXJ5ID8gdGhpcy5nYWxsZXJ5LnByaXZhdGUgOiBmYWxzZTtcblx0fVxuXG5cdGdldCBwaW5uZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5sb2NhbD8ucGlubmVkO1xuXHR9XG5cblx0Z2V0IGxhdGVzdFZlcnNpb24oKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5ID8gdGhpcy5nYWxsZXJ5LnZlcnNpb24gOiB0aGlzLmdldE1hbmlmZXN0RnJvbUxvY2FsT3JSZXNvdXJjZSgpPy52ZXJzaW9uID8/ICcnO1xuXHR9XG5cblx0Z2V0IGRlc2NyaXB0aW9uKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeSA/IHRoaXMuZ2FsbGVyeS5kZXNjcmlwdGlvbiA6IHRoaXMuZ2V0TWFuaWZlc3RGcm9tTG9jYWxPclJlc291cmNlKCk/LmRlc2NyaXB0aW9uID8/ICcnO1xuXHR9XG5cblx0Z2V0IHVybCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnk/LmRldGFpbHNMaW5rO1xuXHR9XG5cblx0Z2V0IGljb25VcmwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5SWNvblVybCB8fCB0aGlzLnJlc291cmNlRXh0ZW5zaW9uSWNvblVybCB8fCB0aGlzLmxvY2FsSWNvblVybCB8fCB0aGlzLmRlZmF1bHRJY29uVXJsO1xuXHR9XG5cblx0Z2V0IGljb25VcmxGYWxsYmFjaygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnlJY29uVXJsRmFsbGJhY2sgfHwgdGhpcy5yZXNvdXJjZUV4dGVuc2lvbkljb25VcmwgfHwgdGhpcy5sb2NhbEljb25VcmwgfHwgdGhpcy5kZWZhdWx0SWNvblVybDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGxvY2FsSWNvblVybCgpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAodGhpcy5sb2NhbCAmJiB0aGlzLmxvY2FsLm1hbmlmZXN0Lmljb24pIHtcblx0XHRcdHJldHVybiBGaWxlQWNjZXNzLnVyaVRvQnJvd3NlclVyaShyZXNvdXJjZXMuam9pblBhdGgodGhpcy5sb2NhbC5sb2NhdGlvbiwgdGhpcy5sb2NhbC5tYW5pZmVzdC5pY29uKSkudG9TdHJpbmcodHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgcmVzb3VyY2VFeHRlbnNpb25JY29uVXJsKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICh0aGlzLnJlc291cmNlRXh0ZW5zaW9uPy5tYW5pZmVzdC5pY29uKSB7XG5cdFx0XHRyZXR1cm4gRmlsZUFjY2Vzcy51cmlUb0Jyb3dzZXJVcmkocmVzb3VyY2VzLmpvaW5QYXRoKHRoaXMucmVzb3VyY2VFeHRlbnNpb24ubG9jYXRpb24sIHRoaXMucmVzb3VyY2VFeHRlbnNpb24ubWFuaWZlc3QuaWNvbikpLnRvU3RyaW5nKHRydWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGdhbGxlcnlJY29uVXJsKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnk/LmFzc2V0cy5pY29uID8gdGhpcy5nYWxsZXJ5LmFzc2V0cy5pY29uLnVyaSA6IG51bGw7XG5cdH1cblxuXHRwcml2YXRlIGdldCBnYWxsZXJ5SWNvblVybEZhbGxiYWNrKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnk/LmFzc2V0cy5pY29uID8gdGhpcy5nYWxsZXJ5LmFzc2V0cy5pY29uLmZhbGxiYWNrVXJpIDogbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGRlZmF1bHRJY29uVXJsKCk6IHN0cmluZyB7XG5cdFx0aWYgKHRoaXMudHlwZSA9PT0gRXh0ZW5zaW9uVHlwZS5TeXN0ZW0gJiYgdGhpcy5sb2NhbCkge1xuXHRcdFx0aWYgKHRoaXMubG9jYWwubWFuaWZlc3QgJiYgdGhpcy5sb2NhbC5tYW5pZmVzdC5jb250cmlidXRlcykge1xuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLnRoZW1lcykgJiYgdGhpcy5sb2NhbC5tYW5pZmVzdC5jb250cmlidXRlcy50aGVtZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIEZpbGVBY2Nlc3MuYXNCcm93c2VyVXJpKCd2cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvbWVkaWEvdGhlbWUtaWNvbi5wbmcnKS50b1N0cmluZyh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGlzLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLmdyYW1tYXJzKSAmJiB0aGlzLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLmdyYW1tYXJzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiBGaWxlQWNjZXNzLmFzQnJvd3NlclVyaSgndnMvd29ya2JlbmNoL2NvbnRyaWIvZXh0ZW5zaW9ucy9icm93c2VyL21lZGlhL2xhbmd1YWdlLWljb24uc3ZnJykudG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIERlZmF1bHRJY29uUGF0aDtcblx0fVxuXG5cdGdldCByZXBvc2l0b3J5KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeSAmJiB0aGlzLmdhbGxlcnkuYXNzZXRzLnJlcG9zaXRvcnkgPyB0aGlzLmdhbGxlcnkuYXNzZXRzLnJlcG9zaXRvcnkudXJpIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IGxpY2Vuc2VVcmwoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5ICYmIHRoaXMuZ2FsbGVyeS5hc3NldHMubGljZW5zZSA/IHRoaXMuZ2FsbGVyeS5hc3NldHMubGljZW5zZS51cmkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgc3VwcG9ydFVybCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnkgJiYgdGhpcy5nYWxsZXJ5LnN1cHBvcnRMaW5rID8gdGhpcy5nYWxsZXJ5LnN1cHBvcnRMaW5rIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHN0YXRlKCk6IEV4dGVuc2lvblN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5zdGF0ZVByb3ZpZGVyKHRoaXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBtYWxpY2lvdXM6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGdldCBpc01hbGljaW91cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tYWxpY2lvdXMgfHwgdGhpcy5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5TWFsaWNpb3VzO1xuXHR9XG5cblx0cHVibGljIGRlcHJlY2F0aW9uSW5mbzogSURlcHJlY2F0aW9uSW5mbyB8IHVuZGVmaW5lZDtcblxuXHRnZXQgaW5zdGFsbENvdW50KCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeSA/IHRoaXMuZ2FsbGVyeS5pbnN0YWxsQ291bnQgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgcmF0aW5nKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeSA/IHRoaXMuZ2FsbGVyeS5yYXRpbmcgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgcmF0aW5nQ291bnQoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5nYWxsZXJ5ID8gdGhpcy5nYWxsZXJ5LnJhdGluZ0NvdW50IDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHJhdGluZ1VybCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdhbGxlcnk/LnJhdGluZ0xpbms7XG5cdH1cblxuXHRnZXQgb3V0ZGF0ZWQoKTogYm9vbGVhbiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICghdGhpcy5nYWxsZXJ5IHx8ICF0aGlzLmxvY2FsKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdC8vIERvIG5vdCBhbGxvdyB1cGRhdGluZyBzeXN0ZW0gZXh0ZW5zaW9ucyBpbiBzdGFibGVcblx0XHRcdGlmICh0aGlzLnR5cGUgPT09IEV4dGVuc2lvblR5cGUuU3lzdGVtICYmIHRoaXMucHJvZHVjdFNlcnZpY2UucXVhbGl0eSA9PT0gJ3N0YWJsZScpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLmxvY2FsLnByZVJlbGVhc2UgJiYgdGhpcy5nYWxsZXJ5LnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc2VtdmVyLmd0KHRoaXMubGF0ZXN0VmVyc2lvbiwgdGhpcy52ZXJzaW9uKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLm91dGRhdGVkVGFyZ2V0UGxhdGZvcm0pIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8qIElnbm9yZSAqL1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRnZXQgb3V0ZGF0ZWRUYXJnZXRQbGF0Zm9ybSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLmxvY2FsICYmICEhdGhpcy5nYWxsZXJ5XG5cdFx0XHQmJiAhW1RhcmdldFBsYXRmb3JtLlVOREVGSU5FRCwgVGFyZ2V0UGxhdGZvcm0uV0VCXS5pbmNsdWRlcyh0aGlzLmxvY2FsLnRhcmdldFBsYXRmb3JtKVxuXHRcdFx0JiYgdGhpcy5nYWxsZXJ5LnByb3BlcnRpZXMudGFyZ2V0UGxhdGZvcm0gIT09IFRhcmdldFBsYXRmb3JtLldFQlxuXHRcdFx0JiYgdGhpcy5sb2NhbC50YXJnZXRQbGF0Zm9ybSAhPT0gdGhpcy5nYWxsZXJ5LnByb3BlcnRpZXMudGFyZ2V0UGxhdGZvcm1cblx0XHRcdCYmIHNlbXZlci5lcSh0aGlzLmxhdGVzdFZlcnNpb24sIHRoaXMudmVyc2lvbik7XG5cdH1cblxuXHRnZXQgcnVudGltZVN0YXRlKCk6IEV4dGVuc2lvblJ1bnRpbWVTdGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucnVudGltZVN0YXRlUHJvdmlkZXIodGhpcyk7XG5cdH1cblxuXHRnZXQgdGVsZW1ldHJ5RGF0YSgpOiBhbnkge1xuXHRcdGNvbnN0IHsgbG9jYWwsIGdhbGxlcnkgfSA9IHRoaXM7XG5cblx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0cmV0dXJuIGdldEdhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhKGdhbGxlcnkpO1xuXHRcdH0gZWxzZSBpZiAobG9jYWwpIHtcblx0XHRcdHJldHVybiBnZXRMb2NhbEV4dGVuc2lvblRlbGVtZXRyeURhdGEobG9jYWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHByZXZpZXcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMubG9jYWw/Lm1hbmlmZXN0LnByZXZpZXcgPz8gdGhpcy5nYWxsZXJ5Py5wcmV2aWV3ID8/IGZhbHNlO1xuXHR9XG5cblx0Z2V0IHByZVJlbGVhc2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5sb2NhbD8ucHJlUmVsZWFzZTtcblx0fVxuXG5cdGdldCBpc1ByZVJlbGVhc2VWZXJzaW9uKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmxvY2FsKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sb2NhbC5pc1ByZVJlbGVhc2VWZXJzaW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gISF0aGlzLmdhbGxlcnk/LnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbjtcblx0fVxuXG5cdHByaXZhdGUgX2V4dGVuc2lvbkVuYWJsZWRXaXRoUHJlUmVsZWFzZTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0Z2V0IGhhc1ByZVJlbGVhc2VWZXJzaW9uKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZ2FsbGVyeT8uaGFzUHJlUmVsZWFzZVZlcnNpb24gfHwgISF0aGlzLmxvY2FsPy5oYXNQcmVSZWxlYXNlVmVyc2lvbiB8fCAhIXRoaXMuX2V4dGVuc2lvbkVuYWJsZWRXaXRoUHJlUmVsZWFzZTtcblx0fVxuXG5cdGdldCBoYXNSZWxlYXNlVmVyc2lvbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnJlc291cmNlRXh0ZW5zaW9uIHx8ICEhdGhpcy5nYWxsZXJ5Py5oYXNSZWxlYXNlVmVyc2lvbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0TG9jYWwoKTogSUxvY2FsRXh0ZW5zaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5sb2NhbCAmJiAhdGhpcy5vdXRkYXRlZCA/IHRoaXMubG9jYWwgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBnZXRNYW5pZmVzdCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFeHRlbnNpb25NYW5pZmVzdCB8IG51bGw+IHtcblx0XHRjb25zdCBsb2NhbCA9IHRoaXMuZ2V0TG9jYWwoKTtcblx0XHRpZiAobG9jYWwpIHtcblx0XHRcdHJldHVybiBsb2NhbC5tYW5pZmVzdDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nYWxsZXJ5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRHYWxsZXJ5TWFuaWZlc3QodG9rZW4pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvdXJjZUV4dGVuc2lvbi5tYW5pZmVzdDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGFzeW5jIGdldEdhbGxlcnlNYW5pZmVzdCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTxJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsPiB7XG5cdFx0aWYgKHRoaXMuZ2FsbGVyeSkge1xuXHRcdFx0bGV0IGNhY2hlID0gdGhpcy5nYWxsZXJ5UmVzb3VyY2VzQ2FjaGUuZ2V0KCdtYW5pZmVzdCcpO1xuXHRcdFx0aWYgKCFjYWNoZSkge1xuXHRcdFx0XHRpZiAodGhpcy5nYWxsZXJ5LmFzc2V0cy5tYW5pZmVzdCkge1xuXHRcdFx0XHRcdHRoaXMuZ2FsbGVyeVJlc291cmNlc0NhY2hlLnNldCgnbWFuaWZlc3QnLCBjYWNoZSA9IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QodGhpcy5nYWxsZXJ5LCB0b2tlbilcblx0XHRcdFx0XHRcdC5jYXRjaChlID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5nYWxsZXJ5UmVzb3VyY2VzQ2FjaGUuZGVsZXRlKCdtYW5pZmVzdCcpO1xuXHRcdFx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihubHMubG9jYWxpemUoJ01hbmlmZXN0IGlzIG5vdCBmb3VuZCcsIFwiTWFuaWZlc3QgaXMgbm90IGZvdW5kXCIpLCB0aGlzLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY2FjaGU7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0aGFzUmVhZG1lKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmxvY2FsICYmIHRoaXMubG9jYWwucmVhZG1lVXJsKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nYWxsZXJ5ICYmIHRoaXMuZ2FsbGVyeS5hc3NldHMucmVhZG1lKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5yZXNvdXJjZUV4dGVuc2lvbj8ucmVhZG1lVXJpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy50eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbTtcblx0fVxuXG5cdGFzeW5jIGdldFJlYWRtZSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGxvY2FsID0gdGhpcy5nZXRMb2NhbCgpO1xuXHRcdGlmIChsb2NhbD8ucmVhZG1lVXJsKSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShsb2NhbC5yZWFkbWVVcmwpO1xuXHRcdFx0cmV0dXJuIGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nYWxsZXJ5KSB7XG5cdFx0XHRpZiAodGhpcy5nYWxsZXJ5LmFzc2V0cy5yZWFkbWUpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0UmVhZG1lKHRoaXMuZ2FsbGVyeSwgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnZXh0ZW5zaW9uczpOb3RGb3VuZFJlYWRNZScsIHRoaXMudGVsZW1ldHJ5RGF0YSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudHlwZSA9PT0gRXh0ZW5zaW9uVHlwZS5TeXN0ZW0pIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoYCMgJHt0aGlzLmRpc3BsYXlOYW1lIHx8IHRoaXMubmFtZX1cbioqTm90aWNlOioqIFRoaXMgZXh0ZW5zaW9uIGlzIGJ1bmRsZWQgd2l0aCBWaXN1YWwgU3R1ZGlvIENvZGUuIEl0IGNhbiBiZSBkaXNhYmxlZCBidXQgbm90IHVuaW5zdGFsbGVkLlxuIyMgRmVhdHVyZXNcbiR7dGhpcy5kZXNjcmlwdGlvbn1cbmApO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnJlc291cmNlRXh0ZW5zaW9uPy5yZWFkbWVVcmkpIHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRoaXMucmVzb3VyY2VFeHRlbnNpb24/LnJlYWRtZVVyaSk7XG5cdFx0XHRyZXR1cm4gY29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ25vdCBhdmFpbGFibGUnKSk7XG5cdH1cblxuXHRoYXNDaGFuZ2Vsb2coKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMubG9jYWwgJiYgdGhpcy5sb2NhbC5jaGFuZ2Vsb2dVcmwpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmdhbGxlcnkgJiYgdGhpcy5nYWxsZXJ5LmFzc2V0cy5jaGFuZ2Vsb2cpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnR5cGUgPT09IEV4dGVuc2lvblR5cGUuU3lzdGVtO1xuXHR9XG5cblx0YXN5bmMgZ2V0Q2hhbmdlbG9nKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgbG9jYWwgPSB0aGlzLmdldExvY2FsKCk7XG5cdFx0aWYgKGxvY2FsPy5jaGFuZ2Vsb2dVcmwpIHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGxvY2FsLmNoYW5nZWxvZ1VybCk7XG5cdFx0XHRyZXR1cm4gY29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmdhbGxlcnk/LmFzc2V0cy5jaGFuZ2Vsb2cpIHtcblx0XHRcdHJldHVybiB0aGlzLmdhbGxlcnlTZXJ2aWNlLmdldENoYW5nZWxvZyh0aGlzLmdhbGxlcnksIHRva2VuKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy50eXBlID09PSBFeHRlbnNpb25UeXBlLlN5c3RlbSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShgUGxlYXNlIGNoZWNrIHRoZSBbVlMgQ29kZSBSZWxlYXNlIE5vdGVzXShjb21tYW5kOiR7U2hvd0N1cnJlbnRSZWxlYXNlTm90ZXNBY3Rpb25JZH0pIGZvciBjaGFuZ2VzIHRvIHRoZSBidWlsdC1pbiBleHRlbnNpb25zLmApO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ25vdCBhdmFpbGFibGUnKSk7XG5cdH1cblxuXHRnZXQgY2F0ZWdvcmllcygpOiByZWFkb25seSBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgeyBsb2NhbCwgZ2FsbGVyeSwgcmVzb3VyY2VFeHRlbnNpb24gfSA9IHRoaXM7XG5cdFx0aWYgKGxvY2FsICYmIGxvY2FsLm1hbmlmZXN0LmNhdGVnb3JpZXMgJiYgIXRoaXMub3V0ZGF0ZWQpIHtcblx0XHRcdHJldHVybiBsb2NhbC5tYW5pZmVzdC5jYXRlZ29yaWVzO1xuXHRcdH1cblx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0cmV0dXJuIGdhbGxlcnkuY2F0ZWdvcmllcztcblx0XHR9XG5cdFx0aWYgKHJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2VFeHRlbnNpb24ubWFuaWZlc3QuY2F0ZWdvcmllcyA/PyBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Z2V0IHRhZ3MoKTogcmVhZG9ubHkgc3RyaW5nW10ge1xuXHRcdGNvbnN0IHsgZ2FsbGVyeSB9ID0gdGhpcztcblx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0cmV0dXJuIGdhbGxlcnkudGFncy5maWx0ZXIodGFnID0+ICF0YWcuc3RhcnRzV2l0aCgnXycpKTtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0Z2V0IGRlcGVuZGVuY2llcygpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgeyBsb2NhbCwgZ2FsbGVyeSwgcmVzb3VyY2VFeHRlbnNpb24gfSA9IHRoaXM7XG5cdFx0aWYgKGxvY2FsICYmIGxvY2FsLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcyAmJiAhdGhpcy5vdXRkYXRlZCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcztcblx0XHR9XG5cdFx0aWYgKGdhbGxlcnkpIHtcblx0XHRcdHJldHVybiBnYWxsZXJ5LnByb3BlcnRpZXMuZGVwZW5kZW5jaWVzIHx8IFtdO1xuXHRcdH1cblx0XHRpZiAocmVzb3VyY2VFeHRlbnNpb24pIHtcblx0XHRcdHJldHVybiByZXNvdXJjZUV4dGVuc2lvbi5tYW5pZmVzdC5leHRlbnNpb25EZXBlbmRlbmNpZXMgfHwgW107XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGdldCBleHRlbnNpb25QYWNrKCk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCB7IGxvY2FsLCBnYWxsZXJ5LCByZXNvdXJjZUV4dGVuc2lvbiB9ID0gdGhpcztcblx0XHRpZiAobG9jYWwgJiYgbG9jYWwubWFuaWZlc3QuZXh0ZW5zaW9uUGFjayAmJiAhdGhpcy5vdXRkYXRlZCkge1xuXHRcdFx0cmV0dXJuIGxvY2FsLm1hbmlmZXN0LmV4dGVuc2lvblBhY2s7XG5cdFx0fVxuXHRcdGlmIChnYWxsZXJ5KSB7XG5cdFx0XHRyZXR1cm4gZ2FsbGVyeS5wcm9wZXJ0aWVzLmV4dGVuc2lvblBhY2sgfHwgW107XG5cdFx0fVxuXHRcdGlmIChyZXNvdXJjZUV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuIHJlc291cmNlRXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvblBhY2sgfHwgW107XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHNldEV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QoZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdDogSUV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QpOiB2b2lkIHtcblx0XHR0aGlzLm1hbGljaW91cyA9IGlzTWFsaWNpb3VzKHRoaXMuaWRlbnRpZmllciwgZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdC5tYWxpY2lvdXMpO1xuXHRcdHRoaXMuZGVwcmVjYXRpb25JbmZvID0gZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdC5kZXByZWNhdGVkID8gZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdC5kZXByZWNhdGVkW3RoaXMuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpXSA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9leHRlbnNpb25FbmFibGVkV2l0aFByZVJlbGVhc2UgPSBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0Py5leHRlbnNpb25zRW5hYmxlZFdpdGhQcmVSZWxlYXNlPy5pbmNsdWRlcyh0aGlzLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdH1cblxuXHRwcml2YXRlIGdldE1hbmlmZXN0RnJvbUxvY2FsT3JSZXNvdXJjZSgpOiBJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsIHtcblx0XHRpZiAodGhpcy5sb2NhbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMubG9jYWwubWFuaWZlc3Q7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZXNvdXJjZUV4dGVuc2lvbi5tYW5pZmVzdDtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuY29uc3QgRVhURU5TSU9OU19BVVRPX1VQREFURV9LRVkgPSAnZXh0ZW5zaW9ucy5hdXRvVXBkYXRlJztcbmNvbnN0IEVYVEVOU0lPTlNfRE9OT1RfQVVUT19VUERBVEVfS0VZID0gJ2V4dGVuc2lvbnMuZG9ub3RBdXRvVXBkYXRlJztcbmNvbnN0IEVYVEVOU0lPTlNfRElTTUlTU0VEX05PVElGSUNBVElPTlNfS0VZID0gJ2V4dGVuc2lvbnMuZGlzbWlzc2VkTm90aWZpY2F0aW9ucyc7XG5cbmNsYXNzIEV4dGVuc2lvbnMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgZXh0ZW5zaW9uOiBFeHRlbnNpb247IG9wZXJhdGlvbj86IEluc3RhbGxPcGVyYXRpb24gfSB8IHVuZGVmaW5lZD4oKSk7XG5cdGdldCBvbkNoYW5nZSgpIHsgcmV0dXJuIHRoaXMuX29uQ2hhbmdlLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25SZXNldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25SZXNldCgpIHsgcmV0dXJuIHRoaXMuX29uUmVzZXQuZXZlbnQ7IH1cblxuXHRwcml2YXRlIGluc3RhbGxpbmc6IEV4dGVuc2lvbltdID0gW107XG5cdHByaXZhdGUgdW5pbnN0YWxsaW5nOiBFeHRlbnNpb25bXSA9IFtdO1xuXHRwcml2YXRlIGluc3RhbGxlZDogRXh0ZW5zaW9uW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBzZXJ2ZXI6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc3RhdGVQcm92aWRlcjogSUV4dGVuc2lvblN0YXRlUHJvdmlkZXI8RXh0ZW5zaW9uU3RhdGU+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcnVudGltZVN0YXRlUHJvdmlkZXI6IElFeHRlbnNpb25TdGF0ZVByb3ZpZGVyPEV4dGVuc2lvblJ1bnRpbWVTdGF0ZSB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpc1dvcmtzcGFjZVNlcnZlcjogYm9vbGVhbixcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZ2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkluc3RhbGxFeHRlbnNpb24oZSA9PiB0aGlzLm9uSW5zdGFsbEV4dGVuc2lvbihlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZEluc3RhbGxFeHRlbnNpb25zKGUgPT4gdGhpcy5vbkRpZEluc3RhbGxFeHRlbnNpb25zKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uVW5pbnN0YWxsRXh0ZW5zaW9uKGUgPT4gdGhpcy5vblVuaW5zdGFsbEV4dGVuc2lvbihlLmlkZW50aWZpZXIpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uKGUgPT4gdGhpcy5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbihlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhKGUgPT4gdGhpcy5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhKGUubG9jYWwpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZSgoKSA9PiB0aGlzLnJlc2V0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihleHRlbnNpb25FbmFibGVtZW50U2VydmljZS5vbkVuYWJsZW1lbnRDaGFuZ2VkKGUgPT4gdGhpcy5vbkVuYWJsZW1lbnRDaGFuZ2VkKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KHRoaXMub25DaGFuZ2UsIHRoaXMub25SZXNldCkoKCkgPT4gdGhpcy5fbG9jYWwgPSB1bmRlZmluZWQpKTtcblx0XHRpZiAodGhpcy5pc1dvcmtzcGFjZVNlcnZlcikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkluc3RhbGxFeHRlbnNpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLndvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0XHRcdHRoaXMub25JbnN0YWxsRXh0ZW5zaW9uKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkSW5zdGFsbEV4dGVuc2lvbnMoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGUuZmlsdGVyKGUgPT4gZS53b3Jrc3BhY2VTY29wZWQpO1xuXHRcdFx0XHRpZiAocmVzdWx0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMub25EaWRJbnN0YWxsRXh0ZW5zaW9ucyhyZXN1bHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uVW5pbnN0YWxsRXh0ZW5zaW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS53b3Jrc3BhY2VTY29wZWQpIHtcblx0XHRcdFx0XHR0aGlzLm9uVW5pbnN0YWxsRXh0ZW5zaW9uKGUuaWRlbnRpZmllcik7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uub25EaWRVbmluc3RhbGxFeHRlbnNpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLndvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0XHRcdHRoaXMub25EaWRVbmluc3RhbGxFeHRlbnNpb24oZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sb2NhbDogRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQ7XG5cdGdldCBsb2NhbCgpOiBFeHRlbnNpb25bXSB7XG5cdFx0aWYgKCF0aGlzLl9sb2NhbCkge1xuXHRcdFx0dGhpcy5fbG9jYWwgPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHRoaXMuaW5zdGFsbGVkKSB7XG5cdFx0XHRcdHRoaXMuX2xvY2FsLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHRoaXMuaW5zdGFsbGluZykge1xuXHRcdFx0XHRpZiAoIXRoaXMuaW5zdGFsbGVkLnNvbWUoaW5zdGFsbGVkID0+IGFyZVNhbWVFeHRlbnNpb25zKGluc3RhbGxlZC5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbG9jYWwucHVzaChleHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9sb2NhbDtcblx0fVxuXG5cdGFzeW5jIHF1ZXJ5SW5zdGFsbGVkKHByb2R1Y3RWZXJzaW9uOiBJUHJvZHVjdFZlcnNpb24pOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGF3YWl0IHRoaXMuZmV0Y2hJbnN0YWxsZWRFeHRlbnNpb25zKHByb2R1Y3RWZXJzaW9uKTtcblx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIHRoaXMubG9jYWw7XG5cdH1cblxuXHRhc3luYyBzeW5jSW5zdGFsbGVkRXh0ZW5zaW9uc1dpdGhHYWxsZXJ5KGdhbGxlcnlFeHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdLCBwcm9kdWN0VmVyc2lvbjogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMubWFwSW5zdGFsbGVkRXh0ZW5zaW9uV2l0aENvbXBhdGlibGVHYWxsZXJ5RXh0ZW5zaW9uKGdhbGxlcnlFeHRlbnNpb25zLCBwcm9kdWN0VmVyc2lvbik7XG5cdFx0Zm9yIChjb25zdCBbZXh0ZW5zaW9uLCBnYWxsZXJ5XSBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHQvLyB1cGRhdGUgbWV0YWRhdGEgb2YgdGhlIGV4dGVuc2lvbiBpZiBpdCBkb2VzIG5vdCBleGlzdFxuXHRcdFx0aWYgKGV4dGVuc2lvbi5sb2NhbCAmJiBleHRlbnNpb24ubG9jYWwuaWRlbnRpZmllci51dWlkICE9PSBnYWxsZXJ5LmlkZW50aWZpZXIudXVpZCkge1xuXHRcdFx0XHRleHRlbnNpb24ubG9jYWwgPSBhd2FpdCB0aGlzLnVwZGF0ZU1ldGFkYXRhKGV4dGVuc2lvbi5sb2NhbCwgZ2FsbGVyeSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWV4dGVuc2lvbi5nYWxsZXJ5IHx8IGV4dGVuc2lvbi5nYWxsZXJ5LnZlcnNpb24gIT09IGdhbGxlcnkudmVyc2lvbiB8fCBleHRlbnNpb24uZ2FsbGVyeS5wcm9wZXJ0aWVzLnRhcmdldFBsYXRmb3JtICE9PSBnYWxsZXJ5LnByb3BlcnRpZXMudGFyZ2V0UGxhdGZvcm0pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uLmdhbGxlcnkgPSBnYWxsZXJ5O1xuXHRcdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHsgZXh0ZW5zaW9uIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWFwSW5zdGFsbGVkRXh0ZW5zaW9uV2l0aENvbXBhdGlibGVHYWxsZXJ5RXh0ZW5zaW9uKGdhbGxlcnlFeHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdLCBwcm9kdWN0VmVyc2lvbjogSVByb2R1Y3RWZXJzaW9uKTogUHJvbWlzZTxbRXh0ZW5zaW9uLCBJR2FsbGVyeUV4dGVuc2lvbl1bXT4ge1xuXHRcdGNvbnN0IG1hcHBlZEV4dGVuc2lvbnMgPSB0aGlzLm1hcEluc3RhbGxlZEV4dGVuc2lvbldpdGhHYWxsZXJ5RXh0ZW5zaW9uKGdhbGxlcnlFeHRlbnNpb25zKTtcblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldFRhcmdldFBsYXRmb3JtKCk7XG5cdFx0Y29uc3QgY29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgY29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zVG9GZXRjaDogSUV4dGVuc2lvbkluZm9bXSA9IFtdO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChtYXBwZWRFeHRlbnNpb25zLm1hcChhc3luYyAoW2V4dGVuc2lvbiwgZ2FsbGVyeV0pID0+IHtcblx0XHRcdGlmIChleHRlbnNpb24ubG9jYWwpIHtcblx0XHRcdFx0aWYgKGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuaXNFeHRlbnNpb25Db21wYXRpYmxlKGdhbGxlcnksIGV4dGVuc2lvbi5sb2NhbC5wcmVSZWxlYXNlLCB0YXJnZXRQbGF0Zm9ybSwgcHJvZHVjdFZlcnNpb24pKSB7XG5cdFx0XHRcdFx0Y29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zLnB1c2goZ2FsbGVyeSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zVG9GZXRjaC5wdXNoKHsgLi4uZXh0ZW5zaW9uLmxvY2FsLmlkZW50aWZpZXIsIHByZVJlbGVhc2U6IGV4dGVuc2lvbi5sb2NhbC5wcmVSZWxlYXNlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGlmIChjb21wYXRpYmxlR2FsbGVyeUV4dGVuc2lvbnNUb0ZldGNoLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKGNvbXBhdGlibGVHYWxsZXJ5RXh0ZW5zaW9uc1RvRmV0Y2gsIHsgdGFyZ2V0UGxhdGZvcm0sIGNvbXBhdGlibGU6IHRydWUsIHF1ZXJ5QWxsVmVyc2lvbnM6IHRydWUsIHByb2R1Y3RWZXJzaW9uIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0Y29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zLnB1c2goLi4ucmVzdWx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMubWFwSW5zdGFsbGVkRXh0ZW5zaW9uV2l0aEdhbGxlcnlFeHRlbnNpb24oY29tcGF0aWJsZUdhbGxlcnlFeHRlbnNpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgbWFwSW5zdGFsbGVkRXh0ZW5zaW9uV2l0aEdhbGxlcnlFeHRlbnNpb24oZ2FsbGVyeUV4dGVuc2lvbnM6IElHYWxsZXJ5RXh0ZW5zaW9uW10pOiBbRXh0ZW5zaW9uLCBJR2FsbGVyeUV4dGVuc2lvbl1bXSB7XG5cdFx0Y29uc3QgbWFwcGVkRXh0ZW5zaW9uczogW0V4dGVuc2lvbiwgSUdhbGxlcnlFeHRlbnNpb25dW10gPSBbXTtcblx0XHRjb25zdCBieVVVSUQgPSBuZXcgTWFwPHN0cmluZywgSUdhbGxlcnlFeHRlbnNpb24+KCksIGJ5SUQgPSBuZXcgTWFwPHN0cmluZywgSUdhbGxlcnlFeHRlbnNpb24+KCk7XG5cdFx0Zm9yIChjb25zdCBnYWxsZXJ5IG9mIGdhbGxlcnlFeHRlbnNpb25zKSB7XG5cdFx0XHRieVVVSUQuc2V0KGdhbGxlcnkuaWRlbnRpZmllci51dWlkLCBnYWxsZXJ5KTtcblx0XHRcdGJ5SUQuc2V0KGdhbGxlcnkuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpLCBnYWxsZXJ5KTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBpbnN0YWxsZWQgb2YgdGhpcy5pbnN0YWxsZWQpIHtcblx0XHRcdGlmIChpbnN0YWxsZWQudXVpZCkge1xuXHRcdFx0XHRjb25zdCBnYWxsZXJ5ID0gYnlVVUlELmdldChpbnN0YWxsZWQudXVpZCk7XG5cdFx0XHRcdGlmIChnYWxsZXJ5KSB7XG5cdFx0XHRcdFx0bWFwcGVkRXh0ZW5zaW9ucy5wdXNoKFtpbnN0YWxsZWQsIGdhbGxlcnldKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGluc3RhbGxlZC5sb2NhbD8uc291cmNlICE9PSAncmVzb3VyY2UnKSB7XG5cdFx0XHRcdGNvbnN0IGdhbGxlcnkgPSBieUlELmdldChpbnN0YWxsZWQuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRcdFx0aWYgKGdhbGxlcnkpIHtcblx0XHRcdFx0XHRtYXBwZWRFeHRlbnNpb25zLnB1c2goW2luc3RhbGxlZCwgZ2FsbGVyeV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBtYXBwZWRFeHRlbnNpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVNZXRhZGF0YShsb2NhbEV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbik6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0bGV0IGlzUHJlUmVsZWFzZVZlcnNpb24gPSBmYWxzZTtcblx0XHRpZiAobG9jYWxFeHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbiAhPT0gZ2FsbGVyeS52ZXJzaW9uKSB7XG5cdFx0XHR0eXBlIEdhbGxlcnlTZXJ2aWNlTWF0Y2hJbnN0YWxsZWRFeHRlbnNpb25DbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdSZXBvcnQgd2hlbiBhIHJlcXVlc3QgaXMgbWFkZSB0byB1cGRhdGUgbWV0YWRhdGEgb2YgYW4gaW5zdGFsbGVkIGV4dGVuc2lvbic7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8e30sIEdhbGxlcnlTZXJ2aWNlTWF0Y2hJbnN0YWxsZWRFeHRlbnNpb25DbGFzc2lmaWNhdGlvbj4oJ2dhbGxlcnlTZXJ2aWNlOnVwZGF0ZU1ldGFkYXRhJyk7XG5cdFx0XHRjb25zdCBnYWxsZXJ5V2l0aExvY2FsVmVyc2lvbjogSUdhbGxlcnlFeHRlbnNpb24gfCB1bmRlZmluZWQgPSAoYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IC4uLmxvY2FsRXh0ZW5zaW9uLmlkZW50aWZpZXIsIHZlcnNpb246IGxvY2FsRXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24gfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXTtcblx0XHRcdGlzUHJlUmVsZWFzZVZlcnNpb24gPSAhIWdhbGxlcnlXaXRoTG9jYWxWZXJzaW9uPy5wcm9wZXJ0aWVzPy5pc1ByZVJlbGVhc2VWZXJzaW9uO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy53b3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS51cGRhdGVNZXRhZGF0YShsb2NhbEV4dGVuc2lvbiwgeyBpZDogZ2FsbGVyeS5pZGVudGlmaWVyLnV1aWQsIHB1Ymxpc2hlckRpc3BsYXlOYW1lOiBnYWxsZXJ5LnB1Ymxpc2hlckRpc3BsYXlOYW1lLCBwdWJsaXNoZXJJZDogZ2FsbGVyeS5wdWJsaXNoZXJJZCwgaXNQcmVSZWxlYXNlVmVyc2lvbiB9KTtcblx0fVxuXG5cdGNhbkluc3RhbGwoZ2FsbGVyeUV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24pOiBQcm9taXNlPHRydWUgfCBJTWFya2Rvd25TdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5zZXJ2ZXIuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuY2FuSW5zdGFsbChnYWxsZXJ5RXh0ZW5zaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgb25JbnN0YWxsRXh0ZW5zaW9uKGV2ZW50OiBJbnN0YWxsRXh0ZW5zaW9uRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCB7IHNvdXJjZSB9ID0gZXZlbnQ7XG5cdFx0aWYgKHNvdXJjZSAmJiAhVVJJLmlzVXJpKHNvdXJjZSkpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuaW5zdGFsbGVkLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHNvdXJjZS5pZGVudGlmaWVyKSlcblx0XHRcdFx0Pz8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb24sIHRoaXMuc3RhdGVQcm92aWRlciwgdGhpcy5ydW50aW1lU3RhdGVQcm92aWRlciwgdGhpcy5zZXJ2ZXIsIHVuZGVmaW5lZCwgc291cmNlLCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5pbnN0YWxsaW5nLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBleHRlbnNpb24gfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmZXRjaEluc3RhbGxlZEV4dGVuc2lvbnMocHJvZHVjdFZlcnNpb24/OiBJUHJvZHVjdFZlcnNpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0ID0gYXdhaXQgdGhpcy5zZXJ2ZXIuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCgpO1xuXHRcdGNvbnN0IGFsbCA9IGF3YWl0IHRoaXMuc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgcHJvZHVjdFZlcnNpb24pO1xuXHRcdGlmICh0aGlzLmlzV29ya3NwYWNlU2VydmVyKSB7XG5cdFx0XHRhbGwucHVzaCguLi5hd2FpdCB0aGlzLndvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZFdvcmtzcGFjZUV4dGVuc2lvbnModHJ1ZSkpO1xuXHRcdH1cblxuXHRcdC8vIGRlZHVwIHdvcmtzcGFjZSwgdXNlciBhbmQgc3lzdGVtIGV4dGVuc2lvbnMgYnkgZ2l2aW5nIHByaW9yaXR5IHRvIHdvcmtzcGFjZSBmaXJzdCBhbmQgdGhlbiB0byB1c2VyIGV4dGVuc2lvbi5cblx0XHRjb25zdCBpbnN0YWxsZWQgPSBncm91cEJ5RXh0ZW5zaW9uKGFsbCwgciA9PiByLmlkZW50aWZpZXIpLnJlZHVjZSgocmVzdWx0LCBleHRlbnNpb25zKSA9PiB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9ucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goZXh0ZW5zaW9uc1swXSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsZXQgd29ya3NwYWNlRXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24gfCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dXNlckV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uIHwgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHN5c3RlbUV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0XHRcdFx0d29ya3NwYWNlRXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZXh0ZW5zaW9uLnR5cGUgPT09IEV4dGVuc2lvblR5cGUuVXNlcikge1xuXHRcdFx0XHRcdFx0dXNlckV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c3lzdGVtRXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSB3b3Jrc3BhY2VFeHRlbnNpb24gPz8gdXNlckV4dGVuc2lvbiA/PyBzeXN0ZW1FeHRlbnNpb247XG5cdFx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChleHRlbnNpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0sIFtdKTtcblxuXHRcdGNvbnN0IGJ5SWQgPSBpbmRleCh0aGlzLmluc3RhbGxlZCwgZSA9PiBlLmxvY2FsID8gZS5sb2NhbC5pZGVudGlmaWVyLmlkIDogZS5pZGVudGlmaWVyLmlkKTtcblx0XHR0aGlzLmluc3RhbGxlZCA9IGluc3RhbGxlZC5tYXAobG9jYWwgPT4ge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gYnlJZFtsb2NhbC5pZGVudGlmaWVyLmlkXSB8fCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbiwgdGhpcy5zdGF0ZVByb3ZpZGVyLCB0aGlzLnJ1bnRpbWVTdGF0ZVByb3ZpZGVyLCB0aGlzLnNlcnZlciwgbG9jYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdGV4dGVuc2lvbi5sb2NhbCA9IGxvY2FsO1xuXHRcdFx0ZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RW5hYmxlbWVudFN0YXRlKGxvY2FsKTtcblx0XHRcdGV4dGVuc2lvbi5zZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QpO1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzZXQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5pbnN0YWxsZWQgPSBbXTtcblx0XHR0aGlzLmluc3RhbGxpbmcgPSBbXTtcblx0XHR0aGlzLnVuaW5zdGFsbGluZyA9IFtdO1xuXHRcdGF3YWl0IHRoaXMuZmV0Y2hJbnN0YWxsZWRFeHRlbnNpb25zKCk7XG5cdFx0dGhpcy5fb25SZXNldC5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkSW5zdGFsbEV4dGVuc2lvbnMocmVzdWx0czogcmVhZG9ubHkgSW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uczogRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIHJlc3VsdHMpIHtcblx0XHRcdGNvbnN0IHsgbG9jYWwsIHNvdXJjZSB9ID0gZXZlbnQ7XG5cdFx0XHRjb25zdCBnYWxsZXJ5ID0gc291cmNlICYmICFVUkkuaXNVcmkoc291cmNlKSA/IHNvdXJjZSA6IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGxvY2F0aW9uID0gc291cmNlICYmIFVSSS5pc1VyaShzb3VyY2UpID8gc291cmNlIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgaW5zdGFsbGluZ0V4dGVuc2lvbiA9IGdhbGxlcnkgPyB0aGlzLmluc3RhbGxpbmcuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBnYWxsZXJ5LmlkZW50aWZpZXIpKVswXSA6IG51bGw7XG5cdFx0XHR0aGlzLmluc3RhbGxpbmcgPSBpbnN0YWxsaW5nRXh0ZW5zaW9uID8gdGhpcy5pbnN0YWxsaW5nLmZpbHRlcihlID0+IGUgIT09IGluc3RhbGxpbmdFeHRlbnNpb24pIDogdGhpcy5pbnN0YWxsaW5nO1xuXG5cdFx0XHRsZXQgZXh0ZW5zaW9uOiBFeHRlbnNpb24gfCB1bmRlZmluZWQgPSBpbnN0YWxsaW5nRXh0ZW5zaW9uID8gaW5zdGFsbGluZ0V4dGVuc2lvblxuXHRcdFx0XHQ6IChsb2NhdGlvbiB8fCBsb2NhbCkgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbiwgdGhpcy5zdGF0ZVByb3ZpZGVyLCB0aGlzLnJ1bnRpbWVTdGF0ZVByb3ZpZGVyLCB0aGlzLnNlcnZlciwgbG9jYWwsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRpZiAobG9jYWwpIHtcblx0XHRcdFx0XHRjb25zdCBpbnN0YWxsZWQgPSB0aGlzLmluc3RhbGxlZC5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbiEuaWRlbnRpZmllcikpWzBdO1xuXHRcdFx0XHRcdGlmIChpbnN0YWxsZWQpIHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbiA9IGluc3RhbGxlZDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5pbnN0YWxsZWQucHVzaChleHRlbnNpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRleHRlbnNpb24ubG9jYWwgPSBsb2NhbDtcblx0XHRcdFx0XHRpZiAoIWV4dGVuc2lvbi5nYWxsZXJ5KSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb24uZ2FsbGVyeSA9IGdhbGxlcnk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPSB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmdldEVuYWJsZW1lbnRTdGF0ZShsb2NhbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKCFsb2NhbCB8fCAhZXh0ZW5zaW9uID8gdW5kZWZpbmVkIDogeyBleHRlbnNpb24sIG9wZXJhdGlvbjogZXZlbnQub3BlcmF0aW9uIH0pO1xuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbWFuaWZlc3QgPSBhd2FpdCB0aGlzLnNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGV4dGVuc2lvbi5zZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KG1hbmlmZXN0KTtcblx0XHRcdH1cblx0XHRcdHRoaXMubWF0Y2hJbnN0YWxsZWRFeHRlbnNpb25zV2l0aEdhbGxlcnkoZXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhKGxvY2FsOiBJTG9jYWxFeHRlbnNpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmluc3RhbGxlZC5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBsb2NhbC5pZGVudGlmaWVyKSk7XG5cdFx0aWYgKGV4dGVuc2lvbj8ubG9jYWwpIHtcblx0XHRcdGNvbnN0IGhhc0NoYW5nZWQgPSBleHRlbnNpb24ubG9jYWwucGlubmVkICE9PSBsb2NhbC5waW5uZWRcblx0XHRcdFx0fHwgZXh0ZW5zaW9uLmxvY2FsLnByZVJlbGVhc2UgIT09IGxvY2FsLnByZVJlbGVhc2U7XG5cdFx0XHRleHRlbnNpb24ubG9jYWwgPSBsb2NhbDtcblx0XHRcdGlmIChoYXNDaGFuZ2VkKSB7XG5cdFx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBleHRlbnNpb24gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBtYXRjaEluc3RhbGxlZEV4dGVuc2lvbnNXaXRoR2FsbGVyeShleHRlbnNpb25zOiBFeHRlbnNpb25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRvTWF0Y2ggPSBleHRlbnNpb25zLmZpbHRlcihlID0+IGUubG9jYWwgJiYgIWUuZ2FsbGVyeSAmJiBlLmxvY2FsLnNvdXJjZSAhPT0gJ3Jlc291cmNlJyk7XG5cdFx0aWYgKCF0b01hdGNoLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZ2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZ2FsbGVyeUV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLmdldEV4dGVuc2lvbnModG9NYXRjaC5tYXAoZSA9PiAoeyAuLi5lLmlkZW50aWZpZXIsIHByZVJlbGVhc2U6IGUubG9jYWw/LnByZVJlbGVhc2UgfSkpLCB7IGNvbXBhdGlibGU6IHRydWUsIHRhcmdldFBsYXRmb3JtOiBhd2FpdCB0aGlzLnNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdGNvbnN0IGNvbXBhdGlibGUgPSBnYWxsZXJ5RXh0ZW5zaW9ucy5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpO1xuXHRcdFx0aWYgKGNvbXBhdGlibGUpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uLmdhbGxlcnkgPSBjb21wYXRpYmxlO1xuXHRcdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHsgZXh0ZW5zaW9uIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Vbmluc3RhbGxFeHRlbnNpb24oaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpOiB2b2lkIHtcblx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmluc3RhbGxlZC5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGlkZW50aWZpZXIpKVswXTtcblx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRjb25zdCB1bmluc3RhbGxpbmcgPSB0aGlzLnVuaW5zdGFsbGluZy5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGlkZW50aWZpZXIpKVswXSB8fCBleHRlbnNpb247XG5cdFx0XHR0aGlzLnVuaW5zdGFsbGluZyA9IFt1bmluc3RhbGxpbmcsIC4uLnRoaXMudW5pbnN0YWxsaW5nLmZpbHRlcihlID0+ICFhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGlkZW50aWZpZXIpKV07XG5cdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHVuaW5zdGFsbGluZyA/IHsgZXh0ZW5zaW9uOiB1bmluc3RhbGxpbmcgfSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbih7IGlkZW50aWZpZXIsIGVycm9yIH06IERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgdW5pbnN0YWxsZWQgPSB0aGlzLnVuaW5zdGFsbGluZy5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBpZGVudGlmaWVyKSkgfHwgdGhpcy5pbnN0YWxsZWQuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgaWRlbnRpZmllcikpO1xuXHRcdHRoaXMudW5pbnN0YWxsaW5nID0gdGhpcy51bmluc3RhbGxpbmcuZmlsdGVyKGUgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgaWRlbnRpZmllcikpO1xuXHRcdGlmICghZXJyb3IpIHtcblx0XHRcdHRoaXMuaW5zdGFsbGVkID0gdGhpcy5pbnN0YWxsZWQuZmlsdGVyKGUgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgaWRlbnRpZmllcikpO1xuXHRcdH1cblx0XHRpZiAodW5pbnN0YWxsZWQpIHtcblx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBleHRlbnNpb246IHVuaW5zdGFsbGVkIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25FbmFibGVtZW50Q2hhbmdlZChwbGF0Zm9ybUV4dGVuc2lvbnM6IHJlYWRvbmx5IElQbGF0Zm9ybUV4dGVuc2lvbltdKSB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IHRoaXMubG9jYWwuZmlsdGVyKGUgPT4gcGxhdGZvcm1FeHRlbnNpb25zLnNvbWUocCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHAuaWRlbnRpZmllcikpKTtcblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLmxvY2FsKSB7XG5cdFx0XHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0XHRcdGlmIChlbmFibGVtZW50U3RhdGUgIT09IGV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUpIHtcblx0XHRcdFx0XHRleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID0gZW5hYmxlbWVudFN0YXRlO1xuXHRcdFx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBleHRlbnNpb24gfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRFeHRlbnNpb25TdGF0ZShleHRlbnNpb246IEV4dGVuc2lvbik6IEV4dGVuc2lvblN0YXRlIHtcblx0XHRpZiAoZXh0ZW5zaW9uLmdhbGxlcnkgJiYgdGhpcy5pbnN0YWxsaW5nLnNvbWUoZSA9PiAhIWUuZ2FsbGVyeSAmJiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmdhbGxlcnkuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmdhbGxlcnkhLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0cmV0dXJuIEV4dGVuc2lvblN0YXRlLkluc3RhbGxpbmc7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnVuaW5zdGFsbGluZy5zb21lKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpKSB7XG5cdFx0XHRyZXR1cm4gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsaW5nO1xuXHRcdH1cblx0XHRjb25zdCBsb2NhbCA9IHRoaXMuaW5zdGFsbGVkLmZpbHRlcihlID0+IGUgPT09IGV4dGVuc2lvbiB8fCAoZS5nYWxsZXJ5ICYmIGV4dGVuc2lvbi5nYWxsZXJ5ICYmIGFyZVNhbWVFeHRlbnNpb25zKGUuZ2FsbGVyeS5pZGVudGlmaWVyLCBleHRlbnNpb24uZ2FsbGVyeS5pZGVudGlmaWVyKSkpWzBdO1xuXHRcdHJldHVybiBsb2NhbCA/IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCA6IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIElVUkxIYW5kbGVyIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBVcGRhdGVzQ2hlY2tJbnRlcnZhbCA9IDEwMDAgKiA2MCAqIDYwICogMTI7IC8vIDEyIGhvdXJzXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgaGFzT3V0ZGF0ZWRFeHRlbnNpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBsb2NhbEV4dGVuc2lvbnM6IEV4dGVuc2lvbnMgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHRlbnNpb25zOiBFeHRlbnNpb25zIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2ViRXh0ZW5zaW9uczogRXh0ZW5zaW9ucyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNTZXJ2ZXJzOiBFeHRlbnNpb25zW10gPSBbXTtcblxuXHRwcml2YXRlIHVwZGF0ZXNDaGVja0RlbGF5ZXI6IFRocm90dGxlZERlbGF5ZXI8dm9pZD47XG5cdHByaXZhdGUgYXV0b1VwZGF0ZURlbGF5ZXI6IFRocm90dGxlZERlbGF5ZXI8dm9pZD47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25DaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRXh0ZW5zaW9uIHwgdW5kZWZpbmVkPigpKTtcblx0Z2V0IG9uQ2hhbmdlKCk6IEV2ZW50PElFeHRlbnNpb24gfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX29uQ2hhbmdlLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSBleHRlbnNpb25zTm90aWZpY2F0aW9uOiBJRXh0ZW5zaW9uc05vdGlmaWNhdGlvbiAmIHsgcmVhZG9ubHkga2V5OiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VFeHRlbnNpb25zTm90aWZpY2F0aW9uID0gbmV3IEVtaXR0ZXI8SUV4dGVuc2lvbnNOb3RpZmljYXRpb24gfCB1bmRlZmluZWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRXh0ZW5zaW9uc05vdGlmaWNhdGlvbiA9IHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9uc05vdGlmaWNhdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblJlc2V0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0Z2V0IG9uUmVzZXQoKSB7IHJldHVybiB0aGlzLl9vblJlc2V0LmV2ZW50OyB9XG5cblx0cmVhZG9ubHkgcHJlZmVyUHJlUmVsZWFzZXMgPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgIT09ICdzdGFibGUnO1xuXG5cdHByaXZhdGUgaW5zdGFsbGluZzogSUV4dGVuc2lvbltdID0gW107XG5cdHByaXZhdGUgdGFza3NJblByb2dyZXNzOiBDYW5jZWxhYmxlUHJvbWlzZTxhbnk+W10gPSBbXTtcblxuXHRyZWFkb25seSB3aGVuSW5pdGlhbGl6ZWQ6IFByb21pc2U8dm9pZD47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElVUkxTZXJ2aWNlIHVybFNlcnZpY2U6IElVUkxTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJSWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNTeW5jTWFuYWdlbWVudFNlcnZpY2U6IElJZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YUF1dG9TeW5jU2VydmljZTogSVVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUxvY2FsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2NhbGVTZXJ2aWNlOiBJTG9jYWxlU2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASVVwZGF0ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZURpYWxvZ1NlcnZpY2U6IElGaWxlRGlhbG9nU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBwcmVmZXJQcmVSZWxlYXNlc1ZhbHVlID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ19leHRlbnNpb25zLnByZWZlclByZVJlbGVhc2VzJyk7XG5cdFx0aWYgKCFpc1VuZGVmaW5lZChwcmVmZXJQcmVSZWxlYXNlc1ZhbHVlKSkge1xuXHRcdFx0dGhpcy5wcmVmZXJQcmVSZWxlYXNlcyA9ICEhcHJlZmVyUHJlUmVsZWFzZXNWYWx1ZTtcblx0XHR9XG5cdFx0dGhpcy5oYXNPdXRkYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5ID0gSGFzT3V0ZGF0ZWRFeHRlbnNpb25zQ29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGlmIChleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdHRoaXMubG9jYWxFeHRlbnNpb25zID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9ucyxcblx0XHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLFxuXHRcdFx0XHRleHQgPT4gdGhpcy5nZXRFeHRlbnNpb25TdGF0ZShleHQpLFxuXHRcdFx0XHRleHQgPT4gdGhpcy5nZXRSdW50aW1lU3RhdGUoZXh0KSxcblx0XHRcdFx0IWV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJcblx0XHRcdCkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sb2NhbEV4dGVuc2lvbnMub25DaGFuZ2UoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhlPy5leHRlbnNpb24pKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxvY2FsRXh0ZW5zaW9ucy5vblJlc2V0KGUgPT4gdGhpcy5yZXNldCgpKSk7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNTZXJ2ZXJzLnB1c2godGhpcy5sb2NhbEV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0dGhpcy5yZW1vdGVFeHRlbnNpb25zID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9ucyxcblx0XHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcixcblx0XHRcdFx0ZXh0ID0+IHRoaXMuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0KSxcblx0XHRcdFx0ZXh0ID0+IHRoaXMuZ2V0UnVudGltZVN0YXRlKGV4dCksXG5cdFx0XHRcdHRydWVcblx0XHRcdCkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZW1vdGVFeHRlbnNpb25zLm9uQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZENoYW5nZUV4dGVuc2lvbnMoZT8uZXh0ZW5zaW9uKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZW1vdGVFeHRlbnNpb25zLm9uUmVzZXQoZSA9PiB0aGlzLnJlc2V0KCkpKTtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uc1NlcnZlcnMucHVzaCh0aGlzLnJlbW90ZUV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0dGhpcy53ZWJFeHRlbnNpb25zID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9ucyxcblx0XHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcixcblx0XHRcdFx0ZXh0ID0+IHRoaXMuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0KSxcblx0XHRcdFx0ZXh0ID0+IHRoaXMuZ2V0UnVudGltZVN0YXRlKGV4dCksXG5cdFx0XHRcdCEoZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciB8fCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpXG5cdFx0XHQpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2ViRXh0ZW5zaW9ucy5vbkNoYW5nZShlID0+IHRoaXMub25EaWRDaGFuZ2VFeHRlbnNpb25zKGU/LmV4dGVuc2lvbikpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2ViRXh0ZW5zaW9ucy5vblJlc2V0KGUgPT4gdGhpcy5yZXNldCgpKSk7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNTZXJ2ZXJzLnB1c2godGhpcy53ZWJFeHRlbnNpb25zKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZXNDaGVja0RlbGF5ZXIgPSBuZXcgVGhyb3R0bGVkRGVsYXllcjx2b2lkPihFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5VcGRhdGVzQ2hlY2tJbnRlcnZhbCk7XG5cdFx0dGhpcy5hdXRvVXBkYXRlRGVsYXllciA9IG5ldyBUaHJvdHRsZWREZWxheWVyPHZvaWQ+KDEwMDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZXNDaGVja0RlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLmF1dG9VcGRhdGVEZWxheWVyLmNhbmNlbCgpO1xuXHRcdH0pKTtcblxuXHRcdHVybFNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpO1xuXG5cdFx0dGhpcy53aGVuSW5pdGlhbGl6ZWQgPSB0aGlzLmluaXRpYWxpemUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBpbml0aWFsaXplIGxvY2FsIGV4dGVuc2lvbnNcblx0XHRhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5xdWVyeUxvY2FsKCksIHRoaXMuZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKV0pO1xuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMub25EaWRDaGFuZ2VSdW5uaW5nRXh0ZW5zaW9ucyh0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucywgW10pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnMoKHsgYWRkZWQsIHJlbW92ZWQgfSkgPT4gdGhpcy5vbkRpZENoYW5nZVJ1bm5pbmdFeHRlbnNpb25zKGFkZGVkLCByZW1vdmVkKSkpO1xuXG5cdFx0YXdhaXQgdGhpcy5saWZlY3ljbGVTZXJ2aWNlLndoZW4oTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG5cdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmluaXRpYWxpemVBdXRvVXBkYXRlKCk7XG5cdFx0dGhpcy51cGRhdGVFeHRlbnNpb25zTm90aWZpY2FpdG9uKCk7XG5cdFx0dGhpcy5yZXBvcnRJbnN0YWxsZWRFeHRlbnNpb25zVGVsZW1ldHJ5KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBFWFRFTlNJT05TX0RJU01JU1NFRF9OT1RJRklDQVRJT05TX0tFWSwgdGhpcy5fc3RvcmUpKGUgPT4gdGhpcy5vbkRpZERpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZUNoYW5nZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgRVhURU5TSU9OU19BVVRPX1VQREFURV9LRVksIHRoaXMuX3N0b3JlKShlID0+IHRoaXMub25EaWRTZWxlY3RlZEV4dGVuc2lvblRvQXV0b1VwZGF0ZVZhbHVlQ2hhbmdlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBFWFRFTlNJT05TX0RPTk9UX0FVVE9fVVBEQVRFX0tFWSwgdGhpcy5fc3RvcmUpKGUgPT4gdGhpcy5vbkRpZFNlbGVjdGVkRXh0ZW5zaW9uVG9BdXRvVXBkYXRlVmFsdWVDaGFuZ2UoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmRlYm91bmNlKHRoaXMub25DaGFuZ2UsICgpID0+IHVuZGVmaW5lZCwgMTAwKSgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUV4dGVuc2lvbnNOb3RpZmljYWl0b24oKTtcblx0XHRcdHRoaXMucmVwb3J0UHJvZ3Jlc3NGcm9tT3RoZXJTb3VyY2VzKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplQXV0b1VwZGF0ZSgpOiB2b2lkIHtcblx0XHQvLyBSZWdpc3RlciBsaXN0ZW5lcnMgZm9yIGF1dG8gdXBkYXRlc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXkpKSB7XG5cdFx0XHRcdGlmICh0aGlzLmlzQXV0b1VwZGF0ZUVuYWJsZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMuZXZlbnR1YWxseUF1dG9VcGRhdGVFeHRlbnNpb25zKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEF1dG9DaGVja1VwZGF0ZXNDb25maWd1cmF0aW9uS2V5KSkge1xuXHRcdFx0XHRpZiAodGhpcy5pc0F1dG9DaGVja1VwZGF0ZXNFbmFibGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmNoZWNrRm9yVXBkYXRlcyhgRW5hYmxlZCBhdXRvIGNoZWNrIHVwZGF0ZXNgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLm9uRW5hYmxlbWVudENoYW5nZWQocGxhdGZvcm1FeHRlbnNpb25zID0+IHtcblx0XHRcdGlmICh0aGlzLmdldEF1dG9VcGRhdGVWYWx1ZSgpID09PSAnb25seUVuYWJsZWRFeHRlbnNpb25zJyAmJiBwbGF0Zm9ybUV4dGVuc2lvbnMuc29tZShlID0+IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGUpKSkge1xuXHRcdFx0XHR0aGlzLmNoZWNrRm9yVXBkYXRlcygnRXh0ZW5zaW9uIGVuYWJsZW1lbnQgY2hhbmdlZCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5kZWJvdW5jZSh0aGlzLm9uQ2hhbmdlLCAoKSA9PiB1bmRlZmluZWQsIDEwMCkoKCkgPT4gdGhpcy5oYXNPdXRkYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldCh0aGlzLm91dGRhdGVkLmxlbmd0aCA+IDApKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51cGRhdGVTZXJ2aWNlLm9uU3RhdGVDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoKGUudHlwZSA9PT0gU3RhdGVUeXBlLkNoZWNraW5nRm9yVXBkYXRlcyAmJiBlLmV4cGxpY2l0KSB8fCBlLnR5cGUgPT09IFN0YXRlVHlwZS5BdmFpbGFibGVGb3JEb3dubG9hZCB8fCBlLnR5cGUgPT09IFN0YXRlVHlwZS5Eb3dubG9hZGVkKSB7XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPHt9LCB7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1JlcG9ydCB3aGVuIHVwZGF0ZSBjaGVjayBpcyB0cmlnZ2VyZWQgb24gcHJvZHVjdCB1cGRhdGUnO1xuXHRcdFx0XHR9PignZXh0ZW5zaW9uczp1cGRhdGVjaGVja29ucHJvZHVjdHVwZGF0ZScpO1xuXHRcdFx0XHRpZiAodGhpcy5pc0F1dG9DaGVja1VwZGF0ZXNFbmFibGVkKCkpIHtcblx0XHRcdFx0XHR0aGlzLmNoZWNrRm9yVXBkYXRlcygnUHJvZHVjdCB1cGRhdGUnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlQWxsb3dlZEV4dGVuc2lvbnNDb25maWdWYWx1ZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc0F1dG9DaGVja1VwZGF0ZXNFbmFibGVkKCkpIHtcblx0XHRcdFx0dGhpcy5jaGVja0ZvclVwZGF0ZXMoJ0FsbG93ZWQgZXh0ZW5zaW9ucyBjaGFuZ2VkJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVXBkYXRlIEF1dG9VcGRhdGUgQ29udGV4dHNcblx0XHR0aGlzLmhhc091dGRhdGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkuc2V0KHRoaXMub3V0ZGF0ZWQubGVuZ3RoID4gMCk7XG5cblx0XHQvLyBDaGVjayBmb3IgdXBkYXRlc1xuXHRcdHRoaXMuZXZlbnR1YWxseUNoZWNrRm9yVXBkYXRlcyh0cnVlKTtcblxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0dGhpcy5zeW5jUGlubmVkQnVpbHRpbkV4dGVuc2lvbnMoKTtcblx0XHRcdC8vIEFsd2F5cyBhdXRvIHVwZGF0ZSBidWlsdGluIGV4dGVuc2lvbnMgaW4gd2ViXG5cdFx0XHRpZiAoIXRoaXMuaXNBdXRvVXBkYXRlRW5hYmxlZCgpKSB7XG5cdFx0XHRcdHRoaXMuYXV0b1VwZGF0ZUJ1aWx0aW5FeHRlbnNpb25zKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZWdpc3RlckF1dG9SZXN0YXJ0TGlzdGVuZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKEF1dG9SZXN0YXJ0Q29uZmlndXJhdGlvbktleSkpIHtcblx0XHRcdFx0dGhpcy5yZWdpc3RlckF1dG9SZXN0YXJ0TGlzdGVuZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGlzQXV0b1VwZGF0ZUVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXV0b1VwZGF0ZVZhbHVlKCkgIT09IGZhbHNlO1xuXHR9XG5cblx0Z2V0QXV0b1VwZGF0ZVZhbHVlKCk6IEF1dG9VcGRhdGVDb25maWd1cmF0aW9uVmFsdWUge1xuXHRcdGNvbnN0IGF1dG9VcGRhdGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPEF1dG9VcGRhdGVDb25maWd1cmF0aW9uVmFsdWU+KEF1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5KTtcblx0XHRpZiAoPGFueT5hdXRvVXBkYXRlID09PSAnb25seVNlbGVjdGVkRXh0ZW5zaW9ucycpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIGlzQm9vbGVhbihhdXRvVXBkYXRlKSB8fCBhdXRvVXBkYXRlID09PSAnb25seUVuYWJsZWRFeHRlbnNpb25zJyA/IGF1dG9VcGRhdGUgOiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlQXV0b1VwZGF0ZUZvckFsbEV4dGVuc2lvbnMoaXNBdXRvVXBkYXRlRW5hYmxlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHdhc0F1dG9VcGRhdGVFbmFibGVkID0gdGhpcy5pc0F1dG9VcGRhdGVFbmFibGVkKCk7XG5cdFx0aWYgKHdhc0F1dG9VcGRhdGVFbmFibGVkID09PSBpc0F1dG9VcGRhdGVFbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnY29uZmlybUVuYWJsZURpc2FibGVBdXRvVXBkYXRlJywgXCJBdXRvIFVwZGF0ZSBFeHRlbnNpb25zXCIpLFxuXHRcdFx0bWVzc2FnZTogaXNBdXRvVXBkYXRlRW5hYmxlZFxuXHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnY29uZmlybUVuYWJsZUF1dG9VcGRhdGUnLCBcIkRvIHlvdSB3YW50IHRvIGVuYWJsZSBhdXRvIHVwZGF0ZSBmb3IgYWxsIGV4dGVuc2lvbnM/XCIpXG5cdFx0XHRcdDogbmxzLmxvY2FsaXplKCdjb25maXJtRGlzYWJsZUF1dG9VcGRhdGUnLCBcIkRvIHlvdSB3YW50IHRvIGRpc2FibGUgYXV0byB1cGRhdGUgZm9yIGFsbCBleHRlbnNpb25zP1wiKSxcblx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdjb25maXJtRW5hYmxlRGlzYWJsZUF1dG9VcGRhdGVEZXRhaWwnLCBcIlRoaXMgd2lsbCByZXNldCBhbnkgYXV0byB1cGRhdGUgc2V0dGluZ3MgeW91IGhhdmUgc2V0IGZvciBpbmRpdmlkdWFsIGV4dGVuc2lvbnMuXCIpLFxuXHRcdH0pO1xuXHRcdGlmICghcmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFJlc2V0IGV4dGVuc2lvbnMgZW5hYmxlZCBmb3IgYXV0byB1cGRhdGUgZmlyc3QgdG8gcHJldmVudCB0aGVtIGZyb20gYmVpbmcgdXBkYXRlZFxuXHRcdHRoaXMuc2V0RW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKFtdKTtcblxuXHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoQXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXksIGlzQXV0b1VwZGF0ZUVuYWJsZWQpO1xuXG5cdFx0dGhpcy5zZXREaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKFtdKTtcblx0XHRhd2FpdCB0aGlzLnVwZGF0ZUV4dGVuc2lvbnNQaW5uZWRTdGF0ZSghaXNBdXRvVXBkYXRlRW5hYmxlZCk7XG5cdFx0dGhpcy5fb25DaGFuZ2UuZmlyZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBhdXRvUmVzdGFydExpc3RlbmVyRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWdpc3RlckF1dG9SZXN0YXJ0TGlzdGVuZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5hdXRvUmVzdGFydExpc3RlbmVyRGlzcG9zYWJsZS52YWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBdXRvUmVzdGFydENvbmZpZ3VyYXRpb25LZXkpID09PSB0cnVlKSB7XG5cdFx0XHR0aGlzLmF1dG9SZXN0YXJ0TGlzdGVuZXJEaXNwb3NhYmxlLnZhbHVlID0gdGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzKGZvY3VzID0+IHtcblx0XHRcdFx0aWYgKCFmb2N1cyAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEF1dG9SZXN0YXJ0Q29uZmlndXJhdGlvbktleSkgPT09IHRydWUpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVJ1bm5pbmdFeHRlbnNpb25zKHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlcG9ydEluc3RhbGxlZEV4dGVuc2lvbnNUZWxlbWV0cnkoKSB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWRzID0gdGhpcy5pbnN0YWxsZWQuZmlsdGVyKGV4dGVuc2lvbiA9PlxuXHRcdFx0IWV4dGVuc2lvbi5pc0J1aWx0aW4gJiZcblx0XHRcdChleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSB8fFxuXHRcdFx0XHRleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5KSlcblx0XHRcdC5tYXAoZXh0ZW5zaW9uID0+IEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpKTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxJbnN0YWxsZWRFeHRlbnNpb25zRXZlbnQsIEV4dGVuc2lvbnNMb2FkQ2xhc3NpZmljYXRpb24+KCdpbnN0YWxsZWRFeHRlbnNpb25zJywgeyBleHRlbnNpb25JZHM6IG5ldyBUZWxlbWV0cnlUcnVzdGVkVmFsdWUoZXh0ZW5zaW9uSWRzLmpvaW4oJzsnKSksIGNvdW50OiBleHRlbnNpb25JZHMubGVuZ3RoIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbkRpZENoYW5nZVJ1bm5pbmdFeHRlbnNpb25zKGFkZGVkOiBSZWFkb25seUFycmF5PElFeHRlbnNpb25EZXNjcmlwdGlvbj4sIHJlbW92ZWQ6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbkRlc2NyaXB0aW9uPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNoYW5nZWRFeHRlbnNpb25zOiBJRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCBleHRlbnNpb25zVG9GZXRjaDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgYWRkZWQpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuaW5zdGFsbGVkLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBkZXNjLmlkZW50aWZpZXIudmFsdWUsIHV1aWQ6IGRlc2MudXVpZCB9LCBlLmlkZW50aWZpZXIpKTtcblx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0Y2hhbmdlZEV4dGVuc2lvbnMucHVzaChleHRlbnNpb24pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvRmV0Y2gucHVzaChkZXNjKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgd29ya3NwYWNlRXh0ZW5zaW9uczogSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgcmVtb3ZlZCkge1xuXHRcdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UoZGVzYy5leHRlbnNpb25Mb2NhdGlvbikpIHtcblx0XHRcdFx0d29ya3NwYWNlRXh0ZW5zaW9ucy5wdXNoKGRlc2MpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvRmV0Y2gucHVzaChkZXNjKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbnNUb0ZldGNoLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9ucyhleHRlbnNpb25zVG9GZXRjaC5tYXAoZSA9PiAoeyBpZDogZS5pZGVudGlmaWVyLnZhbHVlLCB1dWlkOiBlLnV1aWQgfSkpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGNoYW5nZWRFeHRlbnNpb25zLnB1c2goLi4uZXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICh3b3Jrc3BhY2VFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2V0UmVzb3VyY2VFeHRlbnNpb25zKHdvcmtzcGFjZUV4dGVuc2lvbnMubWFwKGUgPT4gZS5leHRlbnNpb25Mb2NhdGlvbiksIHRydWUpO1xuXHRcdFx0Y2hhbmdlZEV4dGVuc2lvbnMucHVzaCguLi5leHRlbnNpb25zKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBjaGFuZ2VkRXh0ZW5zaW9uIG9mIGNoYW5nZWRFeHRlbnNpb25zKSB7XG5cdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKGNoYW5nZWRFeHRlbnNpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRXh0ZW5zaW9uc1Bpbm5lZFN0YXRlKHBpbm5lZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uRXh0ZW5zaW9ucyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3VwZGF0aW5nRXh0ZW5zaW9ucycsIFwiVXBkYXRpbmcgRXh0ZW5zaW9ucyBBdXRvIFVwZGF0ZSBTdGF0ZVwiKSxcblx0XHR9LCAoKSA9PiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnJlc2V0UGlubmVkU3RhdGVGb3JBbGxVc2VyRXh0ZW5zaW9ucyhwaW5uZWQpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVzZXQoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB0YXNrIG9mIHRoaXMudGFza3NJblByb2dyZXNzKSB7XG5cdFx0XHR0YXNrLmNhbmNlbCgpO1xuXHRcdH1cblx0XHR0aGlzLnRhc2tzSW5Qcm9ncmVzcyA9IFtdO1xuXHRcdHRoaXMuaW5zdGFsbGluZyA9IFtdO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VFeHRlbnNpb25zKCk7XG5cdFx0dGhpcy5fb25SZXNldC5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhleHRlbnNpb24/OiBJRXh0ZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5faW5zdGFsbGVkID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2xvY2FsID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoZXh0ZW5zaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgX2xvY2FsOiBJRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQ7XG5cdGdldCBsb2NhbCgpOiBJRXh0ZW5zaW9uW10ge1xuXHRcdGlmICghdGhpcy5fbG9jYWwpIHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbnNTZXJ2ZXJzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHR0aGlzLl9sb2NhbCA9IHRoaXMuaW5zdGFsbGVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbG9jYWwgPSBbXTtcblx0XHRcdFx0Y29uc3QgYnlJZCA9IGdyb3VwQnlFeHRlbnNpb24odGhpcy5pbnN0YWxsZWQsIHIgPT4gci5pZGVudGlmaWVyKTtcblx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb25zIG9mIGJ5SWQpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2NhbC5wdXNoKHRoaXMuZ2V0UHJpbWFyeUV4dGVuc2lvbihleHRlbnNpb25zKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2xvY2FsO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5zdGFsbGVkOiBJRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQ7XG5cdGdldCBpbnN0YWxsZWQoKTogSUV4dGVuc2lvbltdIHtcblx0XHRpZiAoIXRoaXMuX2luc3RhbGxlZCkge1xuXHRcdFx0dGhpcy5faW5zdGFsbGVkID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbnMgb2YgdGhpcy5leHRlbnNpb25zU2VydmVycykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zLmxvY2FsKSB7XG5cdFx0XHRcdFx0dGhpcy5faW5zdGFsbGVkLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5faW5zdGFsbGVkO1xuXHR9XG5cblx0Z2V0IG91dGRhdGVkKCk6IElFeHRlbnNpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFsbGVkLmZpbHRlcihlID0+IGUub3V0ZGF0ZWQgJiYgZS5sb2NhbCAmJiBlLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQpO1xuXHR9XG5cblx0YXN5bmMgcXVlcnlMb2NhbChzZXJ2ZXI/OiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcik6IFByb21pc2U8SUV4dGVuc2lvbltdPiB7XG5cdFx0aWYgKHNlcnZlcikge1xuXHRcdFx0aWYgKHRoaXMubG9jYWxFeHRlbnNpb25zICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyID09PSBzZXJ2ZXIpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubG9jYWxFeHRlbnNpb25zLnF1ZXJ5SW5zdGFsbGVkKHRoaXMuZ2V0UHJvZHVjdFZlcnNpb24oKSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5yZW1vdGVFeHRlbnNpb25zICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciA9PT0gc2VydmVyKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJlbW90ZUV4dGVuc2lvbnMucXVlcnlJbnN0YWxsZWQodGhpcy5nZXRQcm9kdWN0VmVyc2lvbigpKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLndlYkV4dGVuc2lvbnMgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS53ZWJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyID09PSBzZXJ2ZXIpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMud2ViRXh0ZW5zaW9ucy5xdWVyeUluc3RhbGxlZCh0aGlzLmdldFByb2R1Y3RWZXJzaW9uKCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmxvY2FsRXh0ZW5zaW9ucykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5sb2NhbEV4dGVuc2lvbnMucXVlcnlJbnN0YWxsZWQodGhpcy5nZXRQcm9kdWN0VmVyc2lvbigpKTtcblx0XHRcdH1cblx0XHRcdGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy5yZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbW90ZUV4dGVuc2lvbnMucXVlcnlJbnN0YWxsZWQodGhpcy5nZXRQcm9kdWN0VmVyc2lvbigpKTtcblx0XHRcdH1cblx0XHRcdGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy53ZWJFeHRlbnNpb25zKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndlYkV4dGVuc2lvbnMucXVlcnlJbnN0YWxsZWQodGhpcy5nZXRQcm9kdWN0VmVyc2lvbigpKTtcblx0XHRcdH1cblx0XHRcdGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5sb2NhbDtcblx0fVxuXG5cdHF1ZXJ5R2FsbGVyeSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQYWdlcjxJRXh0ZW5zaW9uPj47XG5cdHF1ZXJ5R2FsbGVyeShvcHRpb25zOiBJUXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQYWdlcjxJRXh0ZW5zaW9uPj47XG5cdGFzeW5jIHF1ZXJ5R2FsbGVyeShhcmcxOiBhbnksIGFyZzI/OiBhbnkpOiBQcm9taXNlPElQYWdlcjxJRXh0ZW5zaW9uPj4ge1xuXHRcdGlmICghdGhpcy5nYWxsZXJ5U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0cmV0dXJuIHNpbmdsZVBhZ2VQYWdlcihbXSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyA9IENhbmNlbGxhdGlvblRva2VuLmlzQ2FuY2VsbGF0aW9uVG9rZW4oYXJnMSkgPyB7fSA6IGFyZzE7XG5cdFx0Y29uc3QgdG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25Ub2tlbihhcmcxKSA/IGFyZzEgOiBhcmcyO1xuXHRcdG9wdGlvbnMudGV4dCA9IG9wdGlvbnMudGV4dCA/IHRoaXMucmVzb2x2ZVF1ZXJ5VGV4dChvcHRpb25zLnRleHQpIDogb3B0aW9ucy50ZXh0O1xuXHRcdG9wdGlvbnMuaW5jbHVkZVByZVJlbGVhc2UgPSBpc1VuZGVmaW5lZChvcHRpb25zLmluY2x1ZGVQcmVSZWxlYXNlKSA/IHRoaXMucHJlZmVyUHJlUmVsZWFzZXMgOiBvcHRpb25zLmluY2x1ZGVQcmVSZWxlYXNlO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCgpO1xuXHRcdGNvbnN0IHBhZ2VyID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5xdWVyeShvcHRpb25zLCB0b2tlbik7XG5cdFx0dGhpcy5zeW5jSW5zdGFsbGVkRXh0ZW5zaW9uc1dpdGhHYWxsZXJ5KHBhZ2VyLmZpcnN0UGFnZSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZpcnN0UGFnZTogcGFnZXIuZmlyc3RQYWdlLm1hcChnYWxsZXJ5ID0+IHRoaXMuZnJvbUdhbGxlcnkoZ2FsbGVyeSwgZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCkpLFxuXHRcdFx0dG90YWw6IHBhZ2VyLnRvdGFsLFxuXHRcdFx0cGFnZVNpemU6IHBhZ2VyLnBhZ2VTaXplLFxuXHRcdFx0Z2V0UGFnZTogYXN5bmMgKHBhZ2VJbmRleCwgdG9rZW4pID0+IHtcblx0XHRcdFx0Y29uc3QgcGFnZSA9IGF3YWl0IHBhZ2VyLmdldFBhZ2UocGFnZUluZGV4LCB0b2tlbik7XG5cdFx0XHRcdHRoaXMuc3luY0luc3RhbGxlZEV4dGVuc2lvbnNXaXRoR2FsbGVyeShwYWdlKTtcblx0XHRcdFx0cmV0dXJuIHBhZ2UubWFwKGdhbGxlcnkgPT4gdGhpcy5mcm9tR2FsbGVyeShnYWxsZXJ5LCBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGdldEV4dGVuc2lvbnMoZXh0ZW5zaW9uSW5mb3M6IElFeHRlbnNpb25JbmZvW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUV4dGVuc2lvbltdPjtcblx0Z2V0RXh0ZW5zaW9ucyhleHRlbnNpb25JbmZvczogSUV4dGVuc2lvbkluZm9bXSwgb3B0aW9uczogSUV4dGVuc2lvblF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRXh0ZW5zaW9uW10+O1xuXHRhc3luYyBnZXRFeHRlbnNpb25zKGV4dGVuc2lvbkluZm9zOiBJRXh0ZW5zaW9uSW5mb1tdLCBhcmcxOiBhbnksIGFyZzI/OiBhbnkpOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGlmICghdGhpcy5nYWxsZXJ5U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGV4dGVuc2lvbkluZm9zLmZvckVhY2goZSA9PiBlLnByZVJlbGVhc2UgPSBlLnByZVJlbGVhc2UgPz8gdGhpcy5wcmVmZXJQcmVSZWxlYXNlcyk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCgpO1xuXHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKGV4dGVuc2lvbkluZm9zLCBhcmcxLCBhcmcyKTtcblx0XHR0aGlzLnN5bmNJbnN0YWxsZWRFeHRlbnNpb25zV2l0aEdhbGxlcnkoZ2FsbGVyeUV4dGVuc2lvbnMpO1xuXHRcdHJldHVybiBnYWxsZXJ5RXh0ZW5zaW9ucy5tYXAoZ2FsbGVyeSA9PiB0aGlzLmZyb21HYWxsZXJ5KGdhbGxlcnksIGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QpKTtcblx0fVxuXG5cdGFzeW5jIGdldFJlc291cmNlRXh0ZW5zaW9ucyhsb2NhdGlvbnM6IFVSSVtdLCBpc1dvcmtzcGFjZVNjb3BlZDogYm9vbGVhbik6IFByb21pc2U8SUV4dGVuc2lvbltdPiB7XG5cdFx0Y29uc3QgcmVzb3VyY2VFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRFeHRlbnNpb25zKGxvY2F0aW9ucyk7XG5cdFx0cmV0dXJuIHJlc291cmNlRXh0ZW5zaW9ucy5tYXAocmVzb3VyY2VFeHRlbnNpb24gPT4gdGhpcy5nZXRJbnN0YWxsZWRFeHRlbnNpb25NYXRjaGluZ0xvY2F0aW9uKHJlc291cmNlRXh0ZW5zaW9uLmxvY2F0aW9uKVxuXHRcdFx0Pz8gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb24sIGV4dCA9PiB0aGlzLmdldEV4dGVuc2lvblN0YXRlKGV4dCksIGV4dCA9PiB0aGlzLmdldFJ1bnRpbWVTdGF0ZShleHQpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB7IHJlc291cmNlRXh0ZW5zaW9uLCBpc1dvcmtzcGFjZVNjb3BlZCB9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlQ2hhbmdlKCk6IHZvaWQge1xuXHRcdGlmIChcblx0XHRcdHRoaXMuZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlICE9PSB0aGlzLmdldERpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSgpIC8qIFRoaXMgY2hlY2tzIGlmIGN1cnJlbnQgd2luZG93IGNoYW5nZWQgdGhlIHZhbHVlIG9yIG5vdCAqL1xuXHRcdCkge1xuXHRcdFx0dGhpcy5fZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25zTm90aWZpY2FpdG9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFeHRlbnNpb25zTm90aWZpY2FpdG9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXB1dGVkTm90aWZpY2lhdGlvbnMgPSB0aGlzLmNvbXB1dGVFeHRlbnNpb25zTm90aWZpY2F0aW9ucygpO1xuXHRcdGNvbnN0IGRpc21pc3NlZE5vdGlmaWNhdGlvbnM6IHN0cmluZ1tdID0gW107XG5cblx0XHRsZXQgZXh0ZW5zaW9uc05vdGlmaWNhdGlvbjogSUV4dGVuc2lvbnNOb3RpZmljYXRpb24gJiB7IGtleTogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbXB1dGVkTm90aWZpY2lhdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHQvLyBwb3B1bGF0ZSBkaXNtaXNzZWQgbm90aWZpY2F0aW9ucyB3aXRoIHRoZSBvbmVzIHRoYXQgYXJlIHN0aWxsIHZhbGlkXG5cdFx0XHRmb3IgKGNvbnN0IGRpc21pc3NlZE5vdGlmaWNhdGlvbiBvZiB0aGlzLmdldERpc21pc3NlZE5vdGlmaWNhdGlvbnMoKSkge1xuXHRcdFx0XHRpZiAoY29tcHV0ZWROb3RpZmljaWF0aW9ucy5zb21lKGUgPT4gZS5rZXkgPT09IGRpc21pc3NlZE5vdGlmaWNhdGlvbikpIHtcblx0XHRcdFx0XHRkaXNtaXNzZWROb3RpZmljYXRpb25zLnB1c2goZGlzbWlzc2VkTm90aWZpY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFkaXNtaXNzZWROb3RpZmljYXRpb25zLmluY2x1ZGVzKGNvbXB1dGVkTm90aWZpY2lhdGlvbnNbMF0ua2V5KSkge1xuXHRcdFx0XHRleHRlbnNpb25zTm90aWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGNvbXB1dGVkTm90aWZpY2lhdGlvbnNbMF0ubWVzc2FnZSxcblx0XHRcdFx0XHRzZXZlcml0eTogY29tcHV0ZWROb3RpZmljaWF0aW9uc1swXS5zZXZlcml0eSxcblx0XHRcdFx0XHRleHRlbnNpb25zOiBjb21wdXRlZE5vdGlmaWNpYXRpb25zWzBdLmV4dGVuc2lvbnMsXG5cdFx0XHRcdFx0a2V5OiBjb21wdXRlZE5vdGlmaWNpYXRpb25zWzBdLmtleSxcblx0XHRcdFx0XHRkaXNtaXNzOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnNldERpc21pc3NlZE5vdGlmaWNhdGlvbnMoWy4uLnRoaXMuZ2V0RGlzbWlzc2VkTm90aWZpY2F0aW9ucygpLCBjb21wdXRlZE5vdGlmaWNpYXRpb25zWzBdLmtleV0pO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25zTm90aWZpY2FpdG9uKCk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5zZXREaXNtaXNzZWROb3RpZmljYXRpb25zKGRpc21pc3NlZE5vdGlmaWNhdGlvbnMpO1xuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uc05vdGlmaWNhdGlvbj8ua2V5ICE9PSBleHRlbnNpb25zTm90aWZpY2F0aW9uPy5rZXkpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uc05vdGlmaWNhdGlvbiA9IGV4dGVuc2lvbnNOb3RpZmljYXRpb247XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnNOb3RpZmljYXRpb24uZmlyZSh0aGlzLmV4dGVuc2lvbnNOb3RpZmljYXRpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUV4dGVuc2lvbnNOb3RpZmljYXRpb25zKCk6IEFycmF5PE9taXQ8SUV4dGVuc2lvbnNOb3RpZmljYXRpb24sICdkaXNtaXNzJz4gJiB7IGtleTogc3RyaW5nIH0+IHtcblx0XHRjb25zdCBjb21wdXRlZE5vdGlmaWNpYXRpb25zOiBBcnJheTxPbWl0PElFeHRlbnNpb25zTm90aWZpY2F0aW9uLCAnZGlzbWlzcyc+ICYgeyBrZXk6IHN0cmluZyB9PiA9IFtdO1xuXG5cdFx0Y29uc3QgZGlzYWxsb3dlZEV4dGVuc2lvbnMgPSB0aGlzLmxvY2FsLmZpbHRlcihlID0+IGUuZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUFsbG93bGlzdCk7XG5cdFx0aWYgKGRpc2FsbG93ZWRFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0Y29tcHV0ZWROb3RpZmljaWF0aW9ucy5wdXNoKHtcblx0XHRcdFx0bWVzc2FnZTogdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KEFsbG93ZWRFeHRlbnNpb25zQ29uZmlnS2V5KS5wb2xpY3lcblx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnZGlzYWxsb3dlZCBleHRlbnNpb25zIGJ5IHBvbGljeScsIFwiU29tZSBleHRlbnNpb25zIGFyZSBkaXNhYmxlZCBiZWNhdXNlIHRoZXkgYXJlIG5vdCBhbGxvd2VkIGJ5IHlvdXIgc3lzdGVtIGFkbWluaXN0cmF0b3IuXCIpXG5cdFx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2Rpc2FsbG93ZWQgZXh0ZW5zaW9ucycsIFwiU29tZSBleHRlbnNpb25zIGFyZSBkaXNhYmxlZCBiZWNhdXNlIHRoZXkgYXJlIGNvbmZpZ3VyZWQgbm90IHRvIGJlIGFsbG93ZWQuXCIpLFxuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0ZXh0ZW5zaW9uczogZGlzYWxsb3dlZEV4dGVuc2lvbnMsXG5cdFx0XHRcdGtleTogJ2Rpc2FsbG93ZWRFeHRlbnNpb25zOicgKyBkaXNhbGxvd2VkRXh0ZW5zaW9ucy5zb3J0KChhLCBiKSA9PiBhLmlkZW50aWZpZXIuaWQubG9jYWxlQ29tcGFyZShiLmlkZW50aWZpZXIuaWQpKS5tYXAoZSA9PiBlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSkuam9pbignLScpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW52YWxpZEV4dGVuc2lvbnMgPSB0aGlzLmxvY2FsLmZpbHRlcihlID0+IGUuZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUludmFsaWRFeHRlbnNpb24gJiYgIWUuaXNXb3Jrc3BhY2VTY29wZWQpO1xuXHRcdGlmIChpbnZhbGlkRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdGlmIChpbnZhbGlkRXh0ZW5zaW9ucy5zb21lKGUgPT4gZS5sb2NhbCAmJiBlLmxvY2FsLm1hbmlmZXN0LmVuZ2luZXM/LnZzY29kZSAmJlxuXHRcdFx0XHQoIWlzRW5naW5lVmFsaWQoZS5sb2NhbC5tYW5pZmVzdC5lbmdpbmVzLnZzY29kZSwgdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUpIHx8IGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoWy4uLmUubG9jYWwubWFuaWZlc3QuZW5hYmxlZEFwaVByb3Bvc2FscyA/PyBbXV0pKVxuXHRcdFx0KSkge1xuXHRcdFx0XHRjb21wdXRlZE5vdGlmaWNpYXRpb25zLnB1c2goe1xuXHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnaW5jb21wYXRpYmxlRXh0ZW5zaW9ucycsIFwiU29tZSBleHRlbnNpb25zIGFyZSBkaXNhYmxlZCBkdWUgdG8gdmVyc2lvbiBpbmNvbXBhdGliaWxpdHkuIFJldmlldyBhbmQgdXBkYXRlIHRoZW0uXCIpLFxuXHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdGV4dGVuc2lvbnM6IGludmFsaWRFeHRlbnNpb25zLFxuXHRcdFx0XHRcdGtleTogJ2luY29tcGF0aWJsZUV4dGVuc2lvbnM6JyArIGludmFsaWRFeHRlbnNpb25zLnNvcnQoKGEsIGIpID0+IGEuaWRlbnRpZmllci5pZC5sb2NhbGVDb21wYXJlKGIuaWRlbnRpZmllci5pZCkpLm1hcChlID0+IGAke2UuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfUAke2UubG9jYWw/Lm1hbmlmZXN0LnZlcnNpb259YCkuam9pbignLScpLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbXB1dGVkTm90aWZpY2lhdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdpbnZhbGlkRXh0ZW5zaW9ucycsIFwiSW52YWxpZCBleHRlbnNpb25zIGRldGVjdGVkLiBSZXZpZXcgdGhlbS5cIiksXG5cdFx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uczogaW52YWxpZEV4dGVuc2lvbnMsXG5cdFx0XHRcdFx0a2V5OiAnaW52YWxpZEV4dGVuc2lvbnM6JyArIGludmFsaWRFeHRlbnNpb25zLnNvcnQoKGEsIGIpID0+IGEuaWRlbnRpZmllci5pZC5sb2NhbGVDb21wYXJlKGIuaWRlbnRpZmllci5pZCkpLm1hcChlID0+IGAke2UuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpfUAke2UubG9jYWw/Lm1hbmlmZXN0LnZlcnNpb259YCkuam9pbignLScpLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBkZXByZWNhdGVkRXh0ZW5zaW9ucyA9IHRoaXMubG9jYWwuZmlsdGVyKGUgPT4gISFlLmRlcHJlY2F0aW9uSW5mbyAmJiBlLmxvY2FsICYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGUubG9jYWwpKTtcblx0XHRpZiAoZGVwcmVjYXRlZEV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRjb21wdXRlZE5vdGlmaWNpYXRpb25zLnB1c2goe1xuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ2RlcHJlY2F0ZWQgZXh0ZW5zaW9ucycsIFwiRGVwcmVjYXRlZCBleHRlbnNpb25zIGRldGVjdGVkLiBSZXZpZXcgdGhlbSBhbmQgbWlncmF0ZSB0byBhbHRlcm5hdGl2ZXMuXCIpLFxuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0ZXh0ZW5zaW9uczogZGVwcmVjYXRlZEV4dGVuc2lvbnMsXG5cdFx0XHRcdGtleTogJ2RlcHJlY2F0ZWRFeHRlbnNpb25zOicgKyBkZXByZWNhdGVkRXh0ZW5zaW9ucy5zb3J0KChhLCBiKSA9PiBhLmlkZW50aWZpZXIuaWQubG9jYWxlQ29tcGFyZShiLmlkZW50aWZpZXIuaWQpKS5tYXAoZSA9PiBlLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSkuam9pbignLScpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbXB1dGVkTm90aWZpY2lhdGlvbnM7XG5cdH1cblxuXHRnZXRFeHRlbnNpb25zTm90aWZpY2F0aW9uKCk6IElFeHRlbnNpb25zTm90aWZpY2F0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zTm90aWZpY2F0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlUXVlcnlUZXh0KHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvQHdlYi9nLCBgdGFnOlwiJHtXRUJfRVhURU5TSU9OX1RBR31cImApO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uUmVnZXggPSAvXFxiZXh0OihbXlxcc10rKVxcYi9nO1xuXHRcdGlmIChleHRlbnNpb25SZWdleC50ZXN0KHRleHQpKSB7XG5cdFx0XHR0ZXh0ID0gdGV4dC5yZXBsYWNlKGV4dGVuc2lvblJlZ2V4LCAobSwgZXh0KSA9PiB7XG5cblx0XHRcdFx0Ly8gR2V0IGN1cmF0ZWQga2V5d29yZHNcblx0XHRcdFx0Y29uc3QgbG9va3VwID0gdGhpcy5wcm9kdWN0U2VydmljZS5leHRlbnNpb25LZXl3b3JkcyB8fCB7fTtcblx0XHRcdFx0Y29uc3Qga2V5d29yZHMgPSBsb29rdXBbZXh0XSB8fCBbXTtcblxuXHRcdFx0XHQvLyBHZXQgbW9kZSBuYW1lXG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5ndWVzc0xhbmd1YWdlSWRCeUZpbGVwYXRoT3JGaXJzdExpbmUoVVJJLmZpbGUoYC4ke2V4dH1gKSk7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlTmFtZSA9IGxhbmd1YWdlSWQgJiYgdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VOYW1lKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVRhZyA9IGxhbmd1YWdlTmFtZSA/IGAgdGFnOlwiJHtsYW5ndWFnZU5hbWV9XCJgIDogJyc7XG5cblx0XHRcdFx0Ly8gQ29uc3RydWN0IGEgcmljaCBxdWVyeVxuXHRcdFx0XHRyZXR1cm4gYHRhZzpcIl9fZXh0XyR7ZXh0fVwiIHRhZzpcIl9fZXh0Xy4ke2V4dH1cIiAke2tleXdvcmRzLm1hcCh0YWcgPT4gYHRhZzpcIiR7dGFnfVwiYCkuam9pbignICcpfSR7bGFuZ3VhZ2VUYWd9IHRhZzpcIiR7ZXh0fVwiYDtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gdGV4dC5zdWJzdHIoMCwgMzUwKTtcblx0fVxuXG5cdHByaXZhdGUgZnJvbUdhbGxlcnkoZ2FsbGVyeTogSUdhbGxlcnlFeHRlbnNpb24sIGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q6IElFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KTogSUV4dGVuc2lvbiB7XG5cdFx0bGV0IGV4dGVuc2lvbiA9IHRoaXMuZ2V0SW5zdGFsbGVkRXh0ZW5zaW9uTWF0Y2hpbmdHYWxsZXJ5KGdhbGxlcnkpO1xuXHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHRleHRlbnNpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbiwgZXh0ID0+IHRoaXMuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0KSwgZXh0ID0+IHRoaXMuZ2V0UnVudGltZVN0YXRlKGV4dCksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBnYWxsZXJ5LCB1bmRlZmluZWQpO1xuXHRcdFx0KDxFeHRlbnNpb24+ZXh0ZW5zaW9uKS5zZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0ZW5zaW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbnN0YWxsZWRFeHRlbnNpb25NYXRjaGluZ0dhbGxlcnkoZ2FsbGVyeTogSUdhbGxlcnlFeHRlbnNpb24pOiBJRXh0ZW5zaW9uIHwgbnVsbCB7XG5cdFx0Zm9yIChjb25zdCBpbnN0YWxsZWQgb2YgdGhpcy5sb2NhbCkge1xuXHRcdFx0aWYgKGluc3RhbGxlZC5pZGVudGlmaWVyLnV1aWQpIHsgLy8gSW5zdGFsbGVkIGZyb20gR2FsbGVyeVxuXHRcdFx0XHRpZiAoaW5zdGFsbGVkLmlkZW50aWZpZXIudXVpZCA9PT0gZ2FsbGVyeS5pZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gaW5zdGFsbGVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGluc3RhbGxlZC5sb2NhbD8uc291cmNlICE9PSAncmVzb3VyY2UnKSB7XG5cdFx0XHRcdGlmIChhcmVTYW1lRXh0ZW5zaW9ucyhpbnN0YWxsZWQuaWRlbnRpZmllciwgZ2FsbGVyeS5pZGVudGlmaWVyKSkgeyAvLyBJbnN0YWxsZWQgZnJvbSBvdGhlciBzb3VyY2VzXG5cdFx0XHRcdFx0cmV0dXJuIGluc3RhbGxlZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5zdGFsbGVkRXh0ZW5zaW9uTWF0Y2hpbmdMb2NhdGlvbihsb2NhdGlvbjogVVJJKTogSUV4dGVuc2lvbiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLmxvY2FsLmZpbmQoZSA9PiBlLmxvY2FsICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQobG9jYXRpb24sIGUubG9jYWw/LmxvY2F0aW9uKSkgPz8gbnVsbDtcblx0fVxuXG5cdGFzeW5jIG9wZW4oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uIHwgc3RyaW5nLCBvcHRpb25zPzogSUV4dGVuc2lvbkVkaXRvck9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodHlwZW9mIGV4dGVuc2lvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdGNvbnN0IGlkID0gZXh0ZW5zaW9uO1xuXHRcdFx0ZXh0ZW5zaW9uID0gdGhpcy5pbnN0YWxsZWQuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZCB9KSkgPz8gKGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSlbMF07XG5cdFx0fVxuXHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4dGVuc2lvbiBub3QgZm91bmQuICR7ZXh0ZW5zaW9ufWApO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNJbnB1dCwgZXh0ZW5zaW9uKSwgb3B0aW9ucywgb3B0aW9ucz8uc2lkZUJ5c2lkZSA/IFNJREVfR1JPVVAgOiBBQ1RJVkVfR1JPVVApO1xuXHR9XG5cblx0YXN5bmMgb3BlblNlYXJjaChzZWFyY2hWYWx1ZTogc3RyaW5nLCBwcmVzZXJ2ZUZvdWNzPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZpZXdQYW5lQ29udGFpbmVyID0gKGF3YWl0IHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3Q29udGFpbmVyKFZJRVdMRVRfSUQsIHRydWUpKT8uZ2V0Vmlld1BhbmVDb250YWluZXIoKSBhcyBJRXh0ZW5zaW9uc1ZpZXdQYW5lQ29udGFpbmVyO1xuXHRcdHZpZXdQYW5lQ29udGFpbmVyLnNlYXJjaChzZWFyY2hWYWx1ZSk7XG5cdFx0aWYgKCFwcmVzZXJ2ZUZvdWNzKSB7XG5cdFx0XHR2aWV3UGFuZUNvbnRhaW5lci5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdGdldEV4dGVuc2lvblJ1bnRpbWVTdGF0dXMoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogSUV4dGVuc2lvblJ1bnRpbWVTdGF0dXMgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNTdGF0dXMgPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uc1N0YXR1cygpO1xuXHRcdGZvciAoY29uc3QgaWQgb2YgT2JqZWN0LmtleXMoZXh0ZW5zaW9uc1N0YXR1cykpIHtcblx0XHRcdGlmIChhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkIH0sIGV4dGVuc2lvbi5pZGVudGlmaWVyKSkge1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uc1N0YXR1c1tpZF07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVSdW5uaW5nRXh0ZW5zaW9ucyhhdXRvOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0b0FkZDogSUxvY2FsRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCB0b1JlbW92ZTogc3RyaW5nW10gPSBbXTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0NoZWNrID0gWy4uLnRoaXMubG9jYWxdO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnNUb0NoZWNrKSB7XG5cdFx0XHRjb25zdCBydW50aW1lU3RhdGUgPSBleHRlbnNpb24ucnVudGltZVN0YXRlO1xuXHRcdFx0aWYgKCFydW50aW1lU3RhdGUgfHwgcnVudGltZVN0YXRlLmFjdGlvbiAhPT0gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVzdGFydEV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5Vbmluc3RhbGxlZCkge1xuXHRcdFx0XHR0b1JlbW92ZS5wdXNoKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWV4dGVuc2lvbi5sb2NhbCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlzRW5hYmxlZCA9IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0XHRpZiAoaXNFbmFibGVkKSB7XG5cdFx0XHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogZS5pZGVudGlmaWVyLnZhbHVlLCB1dWlkOiBlLnV1aWQgfSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHRcdFx0aWYgKHJ1bm5pbmdFeHRlbnNpb24pIHtcblx0XHRcdFx0XHR0b1JlbW92ZS5wdXNoKHJ1bm5pbmdFeHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dG9BZGQucHVzaChleHRlbnNpb24ubG9jYWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dG9SZW1vdmUucHVzaChleHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgdGhpcy5leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMpIHtcblx0XHRcdGlmIChleHRlbnNpb24uaXNVbmRlckRldmVsb3BtZW50KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbnNUb0NoZWNrLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSwgdXVpZDogZXh0ZW5zaW9uLnV1aWQgfSwgZS5sb2NhbD8uaWRlbnRpZmllciA/PyBlLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdC8vIEV4dGVuc2lvbiBpcyBydW5uaW5nIGJ1dCBkb2Vzbid0IGV4aXN0IGxvY2FsbHkuIFJlbW92ZSBpdCBmcm9tIHJ1bm5pbmcgZXh0ZW5zaW9ucy5cblx0XHRcdHRvUmVtb3ZlLnB1c2goZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdH1cblxuXHRcdGlmICh0b0FkZC5sZW5ndGggfHwgdG9SZW1vdmUubGVuZ3RoKSB7XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLnN0b3BFeHRlbnNpb25Ib3N0cyhubHMubG9jYWxpemUoJ3Jlc3RhcnQnLCBcIkNoYW5naW5nIGV4dGVuc2lvbiBlbmFibGVtZW50XCIpLCBhdXRvKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uuc3RhcnRFeHRlbnNpb25Ib3N0cyh7IHRvQWRkLCB0b1JlbW92ZSB9KTtcblx0XHRcdFx0aWYgKGF1dG8pIHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdleHRlbnNpb25zQXV0b1Jlc3RhcnQnLCBcIkV4dGVuc2lvbnMgd2VyZSBhdXRvIHJlc3RhcnRlZCB0byBlbmFibGUgdXBkYXRlcy5cIiksXG5cdFx0XHRcdFx0XHRwcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHkuU0lMRU5UXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dHlwZSBFeHRlbnNpb25zQXV0b1Jlc3RhcnRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0XHRvd25lcjogJ3NhbmR5MDgxJztcblx0XHRcdFx0XHRjb21tZW50OiAnUmVwb3J0IHdoZW4gZXh0ZW5zaW9ucyBhcmUgYXV0byByZXN0YXJ0ZWQnO1xuXHRcdFx0XHRcdGNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIGV4dGVuc2lvbnMgYXV0byByZXN0YXJ0ZWQnIH07XG5cdFx0XHRcdFx0YXV0bzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHJlc3RhcnQgd2FzIHRyaWdnZXJlZCBhdXRvbWF0aWNhbGx5JyB9O1xuXHRcdFx0XHR9O1xuXHRcdFx0XHR0eXBlIEV4dGVuc2lvbnNBdXRvUmVzdGFydEV2ZW50ID0ge1xuXHRcdFx0XHRcdGNvdW50OiBudW1iZXI7XG5cdFx0XHRcdFx0YXV0bzogYm9vbGVhbjtcblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXh0ZW5zaW9uc0F1dG9SZXN0YXJ0RXZlbnQsIEV4dGVuc2lvbnNBdXRvUmVzdGFydENsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uczphdXRvcmVzdGFydCcsIHsgY291bnQ6IHRvQWRkLmxlbmd0aCArIHRvUmVtb3ZlLmxlbmd0aCwgYXV0byB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFJ1bnRpbWVTdGF0ZShleHRlbnNpb246IElFeHRlbnNpb24pOiBFeHRlbnNpb25SdW50aW1lU3RhdGUgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGlzVW5pbnN0YWxsZWQgPSBleHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkO1xuXHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogZS5pZGVudGlmaWVyLnZhbHVlIH0sIGV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0Y29uc3QgcmVsb2FkQWN0aW9uID0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyID8gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVsb2FkV2luZG93IDogRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVzdGFydEV4dGVuc2lvbnM7XG5cdFx0Y29uc3QgcmVsb2FkQWN0aW9uTGFiZWwgPSByZWxvYWRBY3Rpb24gPT09IEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLlJlbG9hZFdpbmRvdyA/IG5scy5sb2NhbGl6ZSgncmVsb2FkJywgXCJyZWxvYWQgd2luZG93XCIpIDogbmxzLmxvY2FsaXplKCdyZXN0YXJ0IGV4dGVuc2lvbnMnLCBcInJlc3RhcnQgZXh0ZW5zaW9uc1wiKTtcblxuXHRcdGlmIChpc1VuaW5zdGFsbGVkKSB7XG5cdFx0XHRjb25zdCBjYW5SZW1vdmVSdW5uaW5nRXh0ZW5zaW9uID0gcnVubmluZ0V4dGVuc2lvbiAmJiB0aGlzLmV4dGVuc2lvblNlcnZpY2UuY2FuUmVtb3ZlRXh0ZW5zaW9uKHJ1bm5pbmdFeHRlbnNpb24pO1xuXHRcdFx0Y29uc3QgaXNTYW1lRXh0ZW5zaW9uUnVubmluZyA9IHJ1bm5pbmdFeHRlbnNpb25cblx0XHRcdFx0JiYgKCFleHRlbnNpb24uc2VydmVyIHx8IGV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcih0b0V4dGVuc2lvbihydW5uaW5nRXh0ZW5zaW9uKSkpXG5cdFx0XHRcdCYmICghZXh0ZW5zaW9uLnJlc291cmNlRXh0ZW5zaW9uIHx8IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGV4dGVuc2lvbi5yZXNvdXJjZUV4dGVuc2lvbi5sb2NhdGlvbiwgcnVubmluZ0V4dGVuc2lvbi5leHRlbnNpb25Mb2NhdGlvbikpO1xuXHRcdFx0aWYgKCFjYW5SZW1vdmVSdW5uaW5nRXh0ZW5zaW9uICYmIGlzU2FtZUV4dGVuc2lvblJ1bm5pbmcgJiYgIXJ1bm5pbmdFeHRlbnNpb24uaXNVbmRlckRldmVsb3BtZW50KSB7XG5cdFx0XHRcdHJldHVybiB7IGFjdGlvbjogcmVsb2FkQWN0aW9uLCByZWFzb246IG5scy5sb2NhbGl6ZSgncG9zdFVuaW5zdGFsbFRvb2x0aXAnLCBcIlBsZWFzZSB7MH0gdG8gY29tcGxldGUgdGhlIHVuaW5zdGFsbGF0aW9uIG9mIHRoaXMgZXh0ZW5zaW9uLlwiLCByZWxvYWRBY3Rpb25MYWJlbCkgfTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb24ubG9jYWwpIHtcblx0XHRcdGNvbnN0IGlzU2FtZUV4dGVuc2lvblJ1bm5pbmcgPSBydW5uaW5nRXh0ZW5zaW9uICYmIGV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcih0b0V4dGVuc2lvbihydW5uaW5nRXh0ZW5zaW9uKSk7XG5cdFx0XHRjb25zdCBpc0VuYWJsZWQgPSB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChleHRlbnNpb24ubG9jYWwpO1xuXG5cdFx0XHQvLyBFeHRlbnNpb24gaXMgcnVubmluZ1xuXHRcdFx0aWYgKHJ1bm5pbmdFeHRlbnNpb24pIHtcblx0XHRcdFx0aWYgKGlzRW5hYmxlZCkge1xuXHRcdFx0XHRcdC8vIE5vIFJlbG9hZCBpcyByZXF1aXJlZCBpZiBleHRlbnNpb24gY2FuIHJ1biB3aXRob3V0IHJlbG9hZFxuXHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvblNlcnZpY2UuY2FuQWRkRXh0ZW5zaW9uKHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oZXh0ZW5zaW9uLmxvY2FsKSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb25TZXJ2ZXIgPSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmdldEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIodG9FeHRlbnNpb24ocnVubmluZ0V4dGVuc2lvbikpO1xuXG5cdFx0XHRcdFx0aWYgKGlzU2FtZUV4dGVuc2lvblJ1bm5pbmcpIHtcblx0XHRcdFx0XHRcdC8vIERpZmZlcmVudCB2ZXJzaW9uIG9yIHRhcmdldCBwbGF0Zm9ybSBvZiBzYW1lIGV4dGVuc2lvbiBpcyBydW5uaW5nLiBSZXF1aXJlcyByZWxvYWQgdG8gcnVuIHRoZSBjdXJyZW50IHZlcnNpb25cblx0XHRcdFx0XHRcdGlmICghcnVubmluZ0V4dGVuc2lvbi5pc1VuZGVyRGV2ZWxvcG1lbnQgJiYgKGV4dGVuc2lvbi52ZXJzaW9uICE9PSBydW5uaW5nRXh0ZW5zaW9uLnZlcnNpb24gfHwgZXh0ZW5zaW9uLmxvY2FsLnRhcmdldFBsYXRmb3JtICE9PSBydW5uaW5nRXh0ZW5zaW9uLnRhcmdldFBsYXRmb3JtKSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBwcm9kdWN0Q3VycmVudFZlcnNpb24gPSB0aGlzLmdldFByb2R1Y3RDdXJyZW50VmVyc2lvbigpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBwcm9kdWN0VXBkYXRlVmVyc2lvbiA9IHRoaXMuZ2V0UHJvZHVjdFVwZGF0ZVZlcnNpb24oKTtcblx0XHRcdFx0XHRcdFx0aWYgKHByb2R1Y3RVcGRhdGVWZXJzaW9uXG5cdFx0XHRcdFx0XHRcdFx0JiYgIWlzRW5naW5lVmFsaWQoZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmVuZ2luZXMudnNjb2RlLCBwcm9kdWN0Q3VycmVudFZlcnNpb24udmVyc2lvbiwgcHJvZHVjdEN1cnJlbnRWZXJzaW9uLmRhdGUpXG5cdFx0XHRcdFx0XHRcdFx0JiYgaXNFbmdpbmVWYWxpZChleHRlbnNpb24ubG9jYWwubWFuaWZlc3QuZW5naW5lcy52c2NvZGUsIHByb2R1Y3RVcGRhdGVWZXJzaW9uLnZlcnNpb24sIHByb2R1Y3RVcGRhdGVWZXJzaW9uLmRhdGUpXG5cdFx0XHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy51cGRhdGVTZXJ2aWNlLnN0YXRlO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzdGF0ZS50eXBlID09PSBTdGF0ZVR5cGUuQXZhaWxhYmxlRm9yRG93bmxvYWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB7IGFjdGlvbjogRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuRG93bmxvYWRVcGRhdGUsIHJlYXNvbjogbmxzLmxvY2FsaXplKCdwb3N0VXBkYXRlRG93bmxvYWRUb29sdGlwJywgXCJQbGVhc2UgdXBkYXRlIHswfSB0byBlbmFibGUgdGhlIHVwZGF0ZWQgZXh0ZW5zaW9uLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVMb25nKSB9O1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRpZiAoc3RhdGUudHlwZSA9PT0gU3RhdGVUeXBlLkRvd25sb2FkZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB7IGFjdGlvbjogRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuQXBwbHlVcGRhdGUsIHJlYXNvbjogbmxzLmxvY2FsaXplKCdwb3N0VXBkYXRlVXBkYXRlVG9vbHRpcCcsIFwiUGxlYXNlIHVwZGF0ZSB7MH0gdG8gZW5hYmxlIHRoZSB1cGRhdGVkIGV4dGVuc2lvbi5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZykgfTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHN0YXRlLnR5cGUgPT09IFN0YXRlVHlwZS5SZWFkeSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHsgYWN0aW9uOiBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5RdWl0QW5kSW5zdGFsbCwgcmVhc29uOiBubHMubG9jYWxpemUoJ3Bvc3RVcGRhdGVSZXN0YXJ0VG9vbHRpcCcsIFwiUGxlYXNlIHJlc3RhcnQgezB9IHRvIGVuYWJsZSB0aGUgdXBkYXRlZCBleHRlbnNpb24uXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpIH07XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIHsgYWN0aW9uOiByZWxvYWRBY3Rpb24sIHJlYXNvbjogbmxzLmxvY2FsaXplKCdwb3N0VXBkYXRlVG9vbHRpcCcsIFwiUGxlYXNlIHswfSB0byBlbmFibGUgdGhlIHVwZGF0ZWQgZXh0ZW5zaW9uLlwiLCByZWxvYWRBY3Rpb25MYWJlbCkgfTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uc1NlcnZlcnMubGVuZ3RoID4gMSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25Jbk90aGVyU2VydmVyID0gdGhpcy5pbnN0YWxsZWQuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikgJiYgZS5zZXJ2ZXIgIT09IGV4dGVuc2lvbi5zZXJ2ZXIpWzBdO1xuXHRcdFx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uSW5PdGhlclNlcnZlcikge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFRoaXMgZXh0ZW5zaW9uIHByZWZlcnMgdG8gcnVuIG9uIFVJL0xvY2FsIHNpZGUgYnV0IGlzIHJ1bm5pbmcgaW4gcmVtb3RlXG5cdFx0XHRcdFx0XHRcdFx0aWYgKHJ1bm5pbmdFeHRlbnNpb25TZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPblVJKGV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkgJiYgZXh0ZW5zaW9uSW5PdGhlclNlcnZlci5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246IHJlbG9hZEFjdGlvbiwgcmVhc29uOiBubHMubG9jYWxpemUoJ2VuYWJsZSBsb2NhbGx5JywgXCJQbGVhc2UgezB9IHRvIGVuYWJsZSB0aGlzIGV4dGVuc2lvbiBsb2NhbGx5LlwiLCByZWxvYWRBY3Rpb25MYWJlbCkgfTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHQvLyBUaGlzIGV4dGVuc2lvbiBwcmVmZXJzIHRvIHJ1biBvbiBXb3Jrc3BhY2UvUmVtb3RlIHNpZGUgYnV0IGlzIHJ1bm5pbmcgaW4gbG9jYWxcblx0XHRcdFx0XHRcdFx0XHRpZiAocnVubmluZ0V4dGVuc2lvblNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLnByZWZlcnNFeGVjdXRlT25Xb3Jrc3BhY2UoZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSAmJiBleHRlbnNpb25Jbk90aGVyU2VydmVyLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246IHJlbG9hZEFjdGlvbiwgcmVhc29uOiBubHMubG9jYWxpemUoJ2VuYWJsZSByZW1vdGUnLCBcIlBsZWFzZSB7MH0gdG8gZW5hYmxlIHRoaXMgZXh0ZW5zaW9uIGluIHsxfS5cIiwgcmVsb2FkQWN0aW9uTGFiZWwsIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcj8ubGFiZWwpIH07XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgcnVubmluZ0V4dGVuc2lvblNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFRoaXMgZXh0ZW5zaW9uIHByZWZlcnMgdG8gcnVuIG9uIFVJL0xvY2FsIHNpZGUgYnV0IGlzIHJ1bm5pbmcgaW4gcmVtb3RlXG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPblVJKGV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246IHJlbG9hZEFjdGlvbiwgcmVhc29uOiBubHMubG9jYWxpemUoJ3Bvc3RFbmFibGVUb29sdGlwJywgXCJQbGVhc2UgezB9IHRvIGVuYWJsZSB0aGlzIGV4dGVuc2lvbi5cIiwgcmVsb2FkQWN0aW9uTGFiZWwpIH07XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChleHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgcnVubmluZ0V4dGVuc2lvblNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0Ly8gVGhpcyBleHRlbnNpb24gcHJlZmVycyB0byBydW4gb24gV29ya3NwYWNlL1JlbW90ZSBzaWRlIGJ1dCBpcyBydW5uaW5nIGluIGxvY2FsXG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPbldvcmtzcGFjZShleHRlbnNpb24ubG9jYWwubWFuaWZlc3QpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHsgYWN0aW9uOiByZWxvYWRBY3Rpb24sIHJlYXNvbjogbmxzLmxvY2FsaXplKCdwb3N0RW5hYmxlVG9vbHRpcCcsIFwiUGxlYXNlIHswfSB0byBlbmFibGUgdGhpcyBleHRlbnNpb24uXCIsIHJlbG9hZEFjdGlvbkxhYmVsKSB9O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGlzU2FtZUV4dGVuc2lvblJ1bm5pbmcpIHtcblx0XHRcdFx0XHRcdHJldHVybiB7IGFjdGlvbjogcmVsb2FkQWN0aW9uLCByZWFzb246IG5scy5sb2NhbGl6ZSgncG9zdERpc2FibGVUb29sdGlwJywgXCJQbGVhc2UgezB9IHRvIGRpc2FibGUgdGhpcyBleHRlbnNpb24uXCIsIHJlbG9hZEFjdGlvbkxhYmVsKSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBFeHRlbnNpb24gaXMgbm90IHJ1bm5pbmdcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAoaXNFbmFibGVkICYmICF0aGlzLmV4dGVuc2lvblNlcnZpY2UuY2FuQWRkRXh0ZW5zaW9uKHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oZXh0ZW5zaW9uLmxvY2FsKSkpIHtcblx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246IHJlbG9hZEFjdGlvbiwgcmVhc29uOiBubHMubG9jYWxpemUoJ3Bvc3RFbmFibGVUb29sdGlwJywgXCJQbGVhc2UgezB9IHRvIGVuYWJsZSB0aGlzIGV4dGVuc2lvbi5cIiwgcmVsb2FkQWN0aW9uTGFiZWwpIH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBvdGhlclNlcnZlciA9IGV4dGVuc2lvbi5zZXJ2ZXIgPyBleHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciA/IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciA6IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyIDogbnVsbDtcblx0XHRcdFx0aWYgKG90aGVyU2VydmVyICYmIGV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvbkluT3RoZXJTZXJ2ZXIgPSB0aGlzLmxvY2FsLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpICYmIGUuc2VydmVyID09PSBvdGhlclNlcnZlcilbMF07XG5cdFx0XHRcdFx0Ly8gU2FtZSBleHRlbnNpb24gaW4gb3RoZXIgc2VydmVyIGV4aXN0cyBhbmRcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uSW5PdGhlclNlcnZlciAmJiBleHRlbnNpb25Jbk90aGVyU2VydmVyLmxvY2FsICYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGV4dGVuc2lvbkluT3RoZXJTZXJ2ZXIubG9jYWwpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyBhY3Rpb246IHJlbG9hZEFjdGlvbiwgcmVhc29uOiBubHMubG9jYWxpemUoJ3Bvc3RFbmFibGVUb29sdGlwJywgXCJQbGVhc2UgezB9IHRvIGVuYWJsZSB0aGlzIGV4dGVuc2lvbi5cIiwgcmVsb2FkQWN0aW9uTGFiZWwpIH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldFByaW1hcnlFeHRlbnNpb24oZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdKTogSUV4dGVuc2lvbiB7XG5cdFx0aWYgKGV4dGVuc2lvbnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gZXh0ZW5zaW9uc1swXTtcblx0XHR9XG5cblx0XHRjb25zdCBlbmFibGVkRXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMuZmlsdGVyKGUgPT4gZS5sb2NhbCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChlLmxvY2FsKSk7XG5cdFx0aWYgKGVuYWJsZWRFeHRlbnNpb25zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIGVuYWJsZWRFeHRlbnNpb25zWzBdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0Nob29zZSA9IGVuYWJsZWRFeHRlbnNpb25zLmxlbmd0aCA/IGVuYWJsZWRFeHRlbnNpb25zIDogZXh0ZW5zaW9ucztcblx0XHRjb25zdCBtYW5pZmVzdCA9IGV4dGVuc2lvbnNUb0Nob29zZS5maW5kKGUgPT4gZS5sb2NhbCAmJiBlLmxvY2FsLm1hbmlmZXN0KT8ubG9jYWw/Lm1hbmlmZXN0O1xuXG5cdFx0Ly8gTWFuaWZlc3QgaXMgbm90IGZvdW5kIHdoaWNoIHNob3VsZCBub3QgaGFwcGVuLlxuXHRcdC8vIEluIHdoaWNoIGNhc2UgcmV0dXJuIHRoZSBmaXJzdCBleHRlbnNpb24uXG5cdFx0aWYgKCFtYW5pZmVzdCkge1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbnNUb0Nob29zZVswXTtcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25LaW5kcyA9IHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5nZXRFeHRlbnNpb25LaW5kKG1hbmlmZXN0KTtcblxuXHRcdGxldCBleHRlbnNpb24gPSBleHRlbnNpb25zVG9DaG9vc2UuZmluZChleHRlbnNpb24gPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb25LaW5kIG9mIGV4dGVuc2lvbktpbmRzKSB7XG5cdFx0XHRcdHN3aXRjaCAoZXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRcdGNhc2UgJ3VpJzpcblx0XHRcdFx0XHRcdC8qIFVJIGV4dGVuc2lvbiBpcyBjaG9zZW4gb25seSBpZiBpdCBpcyBpbnN0YWxsZWQgbG9jYWxseSAqL1xuXHRcdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdGNhc2UgJ3dvcmtzcGFjZSc6XG5cdFx0XHRcdFx0XHQvKiBDaG9vc2UgcmVtb3RlIHdvcmtzcGFjZSBleHRlbnNpb24gaWYgZXhpc3RzICovXG5cdFx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdGNhc2UgJ3dlYic6XG5cdFx0XHRcdFx0XHQvKiBDaG9vc2Ugd2ViIGV4dGVuc2lvbiBpZiBleGlzdHMgKi9cblx0XHRcdFx0XHRcdGlmIChleHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9KTtcblxuXHRcdGlmICghZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRleHRlbnNpb24gPSBleHRlbnNpb25zVG9DaG9vc2UuZmluZChleHRlbnNpb24gPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbktpbmQgb2YgZXh0ZW5zaW9uS2luZHMpIHtcblx0XHRcdFx0XHRzd2l0Y2ggKGV4dGVuc2lvbktpbmQpIHtcblx0XHRcdFx0XHRcdGNhc2UgJ3dvcmtzcGFjZSc6XG5cdFx0XHRcdFx0XHRcdC8qIENob29zZSBsb2NhbCB3b3Jrc3BhY2UgZXh0ZW5zaW9uIGlmIGV4aXN0cyAqL1xuXHRcdFx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRjYXNlICd3ZWInOlxuXHRcdFx0XHRcdFx0XHQvKiBDaG9vc2UgbG9jYWwgd2ViIGV4dGVuc2lvbiBpZiBleGlzdHMgKi9cblx0XHRcdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIWV4dGVuc2lvbiAmJiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGV4dGVuc2lvbiA9IGV4dGVuc2lvbnNUb0Nob29zZS5maW5kKGV4dGVuc2lvbiA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uS2luZCBvZiBleHRlbnNpb25LaW5kcykge1xuXHRcdFx0XHRcdHN3aXRjaCAoZXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRcdFx0Y2FzZSAnd2ViJzpcblx0XHRcdFx0XHRcdFx0LyogQ2hvb3NlIHdlYiBleHRlbnNpb24gaWYgZXhpc3RzICovXG5cdFx0XHRcdFx0XHRcdGlmIChleHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0ZXh0ZW5zaW9uID0gZXh0ZW5zaW9uc1RvQ2hvb3NlLmZpbmQoZXh0ZW5zaW9uID0+IHtcblx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb25LaW5kIG9mIGV4dGVuc2lvbktpbmRzKSB7XG5cdFx0XHRcdFx0c3dpdGNoIChleHRlbnNpb25LaW5kKSB7XG5cdFx0XHRcdFx0XHRjYXNlICd3ZWInOlxuXHRcdFx0XHRcdFx0XHQvKiBDaG9vc2UgcmVtb3RlIHdlYiBleHRlbnNpb24gaWYgZXhpc3RzICovXG5cdFx0XHRcdFx0XHRcdGlmIChleHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBleHRlbnNpb24gfHwgZXh0ZW5zaW9uc1swXTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0ZW5zaW9uOiBFeHRlbnNpb24pOiBFeHRlbnNpb25TdGF0ZSB7XG5cdFx0aWYgKHRoaXMuaW5zdGFsbGluZy5zb21lKGkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikgJiYgKCFleHRlbnNpb24uc2VydmVyIHx8IGkuc2VydmVyID09PSBleHRlbnNpb24uc2VydmVyKSkpIHtcblx0XHRcdHJldHVybiBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsaW5nO1xuXHRcdH1cblx0XHRpZiAodGhpcy5yZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMucmVtb3RlRXh0ZW5zaW9ucy5nZXRFeHRlbnNpb25TdGF0ZShleHRlbnNpb24pO1xuXHRcdFx0aWYgKHN0YXRlICE9PSBFeHRlbnNpb25TdGF0ZS5Vbmluc3RhbGxlZCkge1xuXHRcdFx0XHRyZXR1cm4gc3RhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLndlYkV4dGVuc2lvbnMpIHtcblx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy53ZWJFeHRlbnNpb25zLmdldEV4dGVuc2lvblN0YXRlKGV4dGVuc2lvbik7XG5cdFx0XHRpZiAoc3RhdGUgIT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkKSB7XG5cdFx0XHRcdHJldHVybiBzdGF0ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRoaXMubG9jYWxFeHRlbnNpb25zKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sb2NhbEV4dGVuc2lvbnMuZ2V0RXh0ZW5zaW9uU3RhdGUoZXh0ZW5zaW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkO1xuXHR9XG5cblx0YXN5bmMgY2hlY2tGb3JVcGRhdGVzKHJlYXNvbj86IHN0cmluZywgb25seUJ1aWx0aW4/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHJlYXNvbikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYFtFeHRlbnNpb25zXTogQ2hlY2tpbmcgZm9yIHVwZGF0ZXMuIFJlYXNvbjogJHtyZWFzb259YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW0V4dGVuc2lvbnNdOiBDaGVja2luZyBmb3IgdXBkYXRlc2ApO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZ2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZXh0ZW5zaW9uczogRXh0ZW5zaW9uc1tdID0gW107XG5cdFx0aWYgKHRoaXMubG9jYWxFeHRlbnNpb25zKSB7XG5cdFx0XHRleHRlbnNpb25zLnB1c2godGhpcy5sb2NhbEV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5yZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0XHRleHRlbnNpb25zLnB1c2godGhpcy5yZW1vdGVFeHRlbnNpb25zKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMud2ViRXh0ZW5zaW9ucykge1xuXHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHRoaXMud2ViRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICghZXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5mb3M6IElFeHRlbnNpb25JbmZvW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGluc3RhbGxlZCBvZiB0aGlzLmxvY2FsKSB7XG5cdFx0XHRpZiAob25seUJ1aWx0aW4gJiYgIWluc3RhbGxlZC5pc0J1aWx0aW4pIHtcblx0XHRcdFx0Ly8gU2tpcCBpZiBjaGVjayB1cGRhdGVzIG9ubHkgZm9yIGJ1aWx0aW4gZXh0ZW5zaW9ucyBhbmQgY3VycmVudCBleHRlbnNpb24gaXMgbm90IGJ1aWx0aW4uXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGluc3RhbGxlZC5pc0J1aWx0aW4gJiYgIWluc3RhbGxlZC5sb2NhbD8ucGlubmVkICYmIChpbnN0YWxsZWQudHlwZSA9PT0gRXh0ZW5zaW9uVHlwZS5TeXN0ZW0gfHwgIWluc3RhbGxlZC5sb2NhbD8uaWRlbnRpZmllci51dWlkKSkge1xuXHRcdFx0XHQvLyBTa2lwIGNoZWNraW5nIHVwZGF0ZXMgZm9yIGEgYnVpbHRpbiBleHRlbnNpb24gaWYgaXQgaXMgYSBzeXN0ZW0gZXh0ZW5zaW9uIG9yIGlmIGl0IGRvZXMgbm90IGhhcyBNYXJrZXRwbGFjZSBpZGVudGlmaWVyXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGluc3RhbGxlZC5sb2NhbD8uc291cmNlID09PSAncmVzb3VyY2UnKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aW5mb3MucHVzaCh7IC4uLmluc3RhbGxlZC5pZGVudGlmaWVyLCBwcmVSZWxlYXNlOiAhIWluc3RhbGxlZC5sb2NhbD8ucHJlUmVsZWFzZSB9KTtcblx0XHR9XG5cdFx0aWYgKGluZm9zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgdGFyZ2V0UGxhdGZvcm0gPSBhd2FpdCBleHRlbnNpb25zWzBdLnNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpO1xuXHRcdFx0dHlwZSBHYWxsZXJ5U2VydmljZVVwZGF0ZXNDaGVja0NsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ3NhbmR5MDgxJztcblx0XHRcdFx0Y29tbWVudDogJ1JlcG9ydCB3aGVuIGEgcmVxdWVzdCBpcyBtYWRlIHRvIGNoZWNrIGZvciB1cGRhdGVzIG9mIGV4dGVuc2lvbnMnO1xuXHRcdFx0XHRjb3VudDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ051bWJlciBvZiBleHRlbnNpb25zIHRvIGNoZWNrIHVwZGF0ZScgfTtcblx0XHRcdH07XG5cdFx0XHR0eXBlIEdhbGxlcnlTZXJ2aWNlVXBkYXRlc0NoZWNrRXZlbnQgPSB7XG5cdFx0XHRcdGNvdW50OiBudW1iZXI7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2FsbGVyeVNlcnZpY2VVcGRhdGVzQ2hlY2tFdmVudCwgR2FsbGVyeVNlcnZpY2VVcGRhdGVzQ2hlY2tDbGFzc2lmaWNhdGlvbj4oJ2dhbGxlcnlTZXJ2aWNlOmNoZWNraW5nRm9yVXBkYXRlcycsIHtcblx0XHRcdFx0Y291bnQ6IGluZm9zLmxlbmd0aCxcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBDaGVja2luZyB1cGRhdGVzIGZvciBleHRlbnNpb25zYCwgaW5mb3MubWFwKGUgPT4gZS5pZCkuam9pbignLCAnKSk7XG5cdFx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhpbmZvcywgeyB0YXJnZXRQbGF0Zm9ybSwgY29tcGF0aWJsZTogdHJ1ZSwgcHJvZHVjdFZlcnNpb246IHRoaXMuZ2V0UHJvZHVjdFZlcnNpb24oKSwgcHJlZmVyUmVzb3VyY2VBcGk6IHRydWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoZ2FsbGVyeUV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3luY0luc3RhbGxlZEV4dGVuc2lvbnNXaXRoR2FsbGVyeShnYWxsZXJ5RXh0ZW5zaW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgdXBkYXRlQWxsKCk6IFByb21pc2U8SW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPiB7XG5cdFx0Y29uc3QgdG9VcGRhdGU6IEluc3RhbGxFeHRlbnNpb25JbmZvW10gPSBbXTtcblx0XHR0aGlzLm91dGRhdGVkLmZvckVhY2goKGV4dGVuc2lvbikgPT4ge1xuXHRcdFx0aWYgKGV4dGVuc2lvbi5nYWxsZXJ5KSB7XG5cdFx0XHRcdHRvVXBkYXRlLnB1c2goe1xuXHRcdFx0XHRcdGV4dGVuc2lvbjogZXh0ZW5zaW9uLmdhbGxlcnksXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0b3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLlVwZGF0ZSxcblx0XHRcdFx0XHRcdGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogZXh0ZW5zaW9uLmxvY2FsPy5pc1ByZVJlbGVhc2VWZXJzaW9uLFxuXHRcdFx0XHRcdFx0cHJvZmlsZUxvY2F0aW9uOiB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuZXh0ZW5zaW9uc1Jlc291cmNlLFxuXHRcdFx0XHRcdFx0aXNBcHBsaWNhdGlvblNjb3BlZDogZXh0ZW5zaW9uLmxvY2FsPy5pc0FwcGxpY2F0aW9uU2NvcGVkLFxuXHRcdFx0XHRcdFx0Y29udGV4dDogeyBbRVhURU5TSU9OX0lOU1RBTExfU0tJUF9QVUJMSVNIRVJfVFJVU1RfQ09OVEVYVF06IHRydWUgfVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEdhbGxlcnlFeHRlbnNpb25zKHRvVXBkYXRlKTtcblx0fVxuXG5cdGFzeW5jIGRvd25sb2FkVlNJWChleHRlbnNpb25JZDogc3RyaW5nLCBwcmVSZWxlYXNlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IFtnYWxsZXJ5RXh0ZW5zaW9uXSA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uSWQsIHByZVJlbGVhc2UgfV0sIHsgY29tcGF0aWJsZTogdHJ1ZSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRpZiAoIWdhbGxlcnlFeHRlbnNpb24pIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2V4dGVuc2lvbiBub3QgZm91bmQnLCBcIkV4dGVuc2lvbiAnezB9JyBub3QgZm91bmQuXCIsIGV4dGVuc2lvbklkKSk7XG5cdFx0fVxuXG5cdFx0bGV0IHRhcmdldFBsYXRmb3JtID0gZ2FsbGVyeUV4dGVuc2lvbi5wcm9wZXJ0aWVzLnRhcmdldFBsYXRmb3JtO1xuXHRcdGNvbnN0IG9wdGlvbnMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IHRhcmdldFBsYXRmb3JtIG9mIGdhbGxlcnlFeHRlbnNpb24uYWxsVGFyZ2V0UGxhdGZvcm1zKSB7XG5cdFx0XHRpZiAodGFyZ2V0UGxhdGZvcm0gIT09IFRhcmdldFBsYXRmb3JtLlVOS05PV04gJiYgdGFyZ2V0UGxhdGZvcm0gIT09IFRhcmdldFBsYXRmb3JtLlVOSVZFUlNBTCkge1xuXHRcdFx0XHRvcHRpb25zLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiB0YXJnZXRQbGF0Zm9ybSA9PT0gVGFyZ2V0UGxhdGZvcm0uVU5ERUZJTkVEID8gbmxzLmxvY2FsaXplKCdhbGxwbGF0Zm9ybXMnLCBcIkFsbCBQbGF0Zm9ybXNcIikgOiBUYXJnZXRQbGF0Zm9ybVRvU3RyaW5nKHRhcmdldFBsYXRmb3JtKSxcblx0XHRcdFx0XHRpZDogdGFyZ2V0UGxhdGZvcm1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgncGxhdGZvcm0gcGxhY2Vob2xkZXInLCBcIlBsZWFzZSBzZWxlY3QgdGhlIHBsYXRmb3JtIGZvciB3aGljaCB5b3Ugd2FudCB0byBkb3dubG9hZCB0aGUgVlNJWFwiKTtcblx0XHRcdGNvbnN0IG9wdGlvbiA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhvcHRpb25zLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSksIHsgcGxhY2VIb2xkZXI6IG1lc3NhZ2UgfSk7XG5cdFx0XHRpZiAoIW9wdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0YXJnZXRQbGF0Zm9ybSA9IG9wdGlvbi5pZDtcblx0XHR9XG5cblx0XHRpZiAodGFyZ2V0UGxhdGZvcm0gIT09IGdhbGxlcnlFeHRlbnNpb24ucHJvcGVydGllcy50YXJnZXRQbGF0Zm9ybSkge1xuXHRcdFx0W2dhbGxlcnlFeHRlbnNpb25dID0gYXdhaXQgdGhpcy5nYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiBleHRlbnNpb25JZCwgcHJlUmVsZWFzZSB9XSwgeyBjb21wYXRpYmxlOiB0cnVlLCB0YXJnZXRQbGF0Zm9ybSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHtcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2Rvd25sb2FkIHRpdGxlJywgXCJTZWxlY3QgZm9sZGVyIHRvIGRvd25sb2FkIHRoZSBWU0lYXCIpLFxuXHRcdFx0Y2FuU2VsZWN0RmlsZXM6IGZhbHNlLFxuXHRcdFx0Y2FuU2VsZWN0Rm9sZGVyczogdHJ1ZSxcblx0XHRcdGNhblNlbGVjdE1hbnk6IGZhbHNlLFxuXHRcdFx0b3BlbkxhYmVsOiBubHMubG9jYWxpemUoJ2Rvd25sb2FkJywgXCJEb3dubG9hZFwiKSxcblx0XHR9KTtcblxuXHRcdGlmICghcmVzdWx0Py5bMF0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24gfSwgYXN5bmMgcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogbmxzLmxvY2FsaXplKCdkb3dubG9hZGluZy4uLicsIFwiRG93bmxvYWRpbmcgVlNJWC4uLlwiKSB9KTtcblx0XHRcdGNvbnN0IG5hbWUgPSBgJHtnYWxsZXJ5RXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9LSR7Z2FsbGVyeUV4dGVuc2lvbi52ZXJzaW9ufSR7dGFyZ2V0UGxhdGZvcm0gIT09IFRhcmdldFBsYXRmb3JtLlVOREVGSU5FRCAmJiB0YXJnZXRQbGF0Zm9ybSAhPT0gVGFyZ2V0UGxhdGZvcm0uVU5JVkVSU0FMICYmIHRhcmdldFBsYXRmb3JtICE9PSBUYXJnZXRQbGF0Zm9ybS5VTktOT1dOID8gYC0ke3RhcmdldFBsYXRmb3JtfWAgOiAnJ30udnNpeGA7XG5cdFx0XHRhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLmRvd25sb2FkKGdhbGxlcnlFeHRlbnNpb24sIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aChyZXN1bHRbMF0sIG5hbWUpLCBJbnN0YWxsT3BlcmF0aW9uLk5vbmUpO1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdkb3dubG9hZC5jb21wbGV0ZWQnLCBcIlN1Y2Nlc3NmdWxseSBkb3dubG9hZGVkIHRoZSBWU0lYXCIpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3luY0luc3RhbGxlZEV4dGVuc2lvbnNXaXRoR2FsbGVyeShnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uczogRXh0ZW5zaW9uc1tdID0gW107XG5cdFx0aWYgKHRoaXMubG9jYWxFeHRlbnNpb25zKSB7XG5cdFx0XHRleHRlbnNpb25zLnB1c2godGhpcy5sb2NhbEV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5yZW1vdGVFeHRlbnNpb25zKSB7XG5cdFx0XHRleHRlbnNpb25zLnB1c2godGhpcy5yZW1vdGVFeHRlbnNpb25zKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMud2ViRXh0ZW5zaW9ucykge1xuXHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHRoaXMud2ViRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICghZXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGV4dGVuc2lvbnMubWFwKGV4dGVuc2lvbnMgPT4gZXh0ZW5zaW9ucy5zeW5jSW5zdGFsbGVkRXh0ZW5zaW9uc1dpdGhHYWxsZXJ5KGdhbGxlcnksIHRoaXMuZ2V0UHJvZHVjdFZlcnNpb24oKSkpKTtcblx0XHRpZiAodGhpcy5vdXRkYXRlZC5sZW5ndGgpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBBdXRvIHVwZGF0aW5nIG91dGRhdGVkIGV4dGVuc2lvbnMuYCwgdGhpcy5vdXRkYXRlZC5tYXAoZSA9PiBlLmlkZW50aWZpZXIuaWQpLmpvaW4oJywgJykpO1xuXHRcdFx0dGhpcy5ldmVudHVhbGx5QXV0b1VwZGF0ZUV4dGVuc2lvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzQXV0b0NoZWNrVXBkYXRlc0VuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQXV0b0NoZWNrVXBkYXRlc0NvbmZpZ3VyYXRpb25LZXkpO1xuXHR9XG5cblx0cHJpdmF0ZSBldmVudHVhbGx5Q2hlY2tGb3JVcGRhdGVzKGltbWVkaWF0ZSA9IGZhbHNlKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVzQ2hlY2tEZWxheWVyLmNhbmNlbCgpO1xuXHRcdHRoaXMudXBkYXRlc0NoZWNrRGVsYXllci50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzQXV0b0NoZWNrVXBkYXRlc0VuYWJsZWQoKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNoZWNrRm9yVXBkYXRlcygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5ldmVudHVhbGx5Q2hlY2tGb3JVcGRhdGVzKCk7XG5cdFx0fSwgaW1tZWRpYXRlID8gMCA6IHRoaXMuZ2V0VXBkYXRlc0NoZWNrSW50ZXJ2YWwoKSkudGhlbih1bmRlZmluZWQsIGVyciA9PiBudWxsKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VXBkYXRlc0NoZWNrSW50ZXJ2YWwoKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5ID09PSAnaW5zaWRlcicgJiYgdGhpcy5nZXRQcm9kdWN0VXBkYXRlVmVyc2lvbigpKSB7XG5cdFx0XHRyZXR1cm4gMTAwMCAqIDYwICogNjAgKiAxOyAvLyAxIGhvdXJcblx0XHR9XG5cdFx0cmV0dXJuIEV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLlVwZGF0ZXNDaGVja0ludGVydmFsO1xuXHR9XG5cblx0cHJpdmF0ZSBldmVudHVhbGx5QXV0b1VwZGF0ZUV4dGVuc2lvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5hdXRvVXBkYXRlRGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMuYXV0b1VwZGF0ZUV4dGVuc2lvbnMoKSlcblx0XHRcdC50aGVuKHVuZGVmaW5lZCwgZXJyID0+IG51bGwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhdXRvVXBkYXRlQnVpbHRpbkV4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5jaGVja0ZvclVwZGF0ZXModW5kZWZpbmVkLCB0cnVlKTtcblx0XHRjb25zdCB0b1VwZGF0ZSA9IHRoaXMub3V0ZGF0ZWQuZmlsdGVyKGUgPT4gZS5pc0J1aWx0aW4pO1xuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQodG9VcGRhdGUubWFwKGUgPT4gdGhpcy5pbnN0YWxsKGUsIGUubG9jYWw/LnByZVJlbGVhc2UgPyB7IGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogdHJ1ZSB9IDogdW5kZWZpbmVkKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzeW5jUGlubmVkQnVpbHRpbkV4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5mb3M6IElFeHRlbnNpb25JbmZvW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGluc3RhbGxlZCBvZiB0aGlzLmxvY2FsKSB7XG5cdFx0XHRpZiAoaW5zdGFsbGVkLmlzQnVpbHRpbiAmJiBpbnN0YWxsZWQubG9jYWw/LnBpbm5lZCAmJiBpbnN0YWxsZWQubG9jYWw/LmlkZW50aWZpZXIudXVpZCkge1xuXHRcdFx0XHRpbmZvcy5wdXNoKHsgLi4uaW5zdGFsbGVkLmlkZW50aWZpZXIsIHZlcnNpb246IGluc3RhbGxlZC52ZXJzaW9uIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoaW5mb3MubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhpbmZvcywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoZ2FsbGVyeUV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3luY0luc3RhbGxlZEV4dGVuc2lvbnNXaXRoR2FsbGVyeShnYWxsZXJ5RXh0ZW5zaW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhdXRvVXBkYXRlRXh0ZW5zaW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0b1VwZGF0ZTogSUV4dGVuc2lvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgdGhpcy5vdXRkYXRlZCkge1xuXHRcdFx0aWYgKCF0aGlzLnNob3VsZEF1dG9VcGRhdGVFeHRlbnNpb24oZXh0ZW5zaW9uKSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnQXV0byB1cGRhdGUgZGlzYWJsZWQgZm9yIGV4dGVuc2lvbicsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYXdhaXQgdGhpcy5zaG91bGRSZXF1aXJlQ29uc2VudFRvVXBkYXRlKGV4dGVuc2lvbikpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ0F1dG8gdXBkYXRlIGNvbnNlbnQgcmVxdWlyZWQgZm9yIGV4dGVuc2lvbicsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHR0b1VwZGF0ZS5wdXNoKGV4dGVuc2lvbik7XG5cdFx0fVxuXG5cdFx0aWYgKCF0b1VwZGF0ZS5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9kdWN0VmVyc2lvbiA9IHRoaXMuZ2V0UHJvZHVjdFZlcnNpb24oKTtcblx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKHRvVXBkYXRlLm1hcChlID0+IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdBdXRvIHVwZGF0aW5nIGV4dGVuc2lvbicsIGUuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YWxsKGUsIGUubG9jYWw/LnByZVJlbGVhc2UgPyB7IGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogdHJ1ZSwgcHJvZHVjdFZlcnNpb24gfSA6IHsgcHJvZHVjdFZlcnNpb24gfSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQcm9kdWN0VmVyc2lvbigpOiBJUHJvZHVjdFZlcnNpb24ge1xuXHRcdHJldHVybiB0aGlzLmdldFByb2R1Y3RVcGRhdGVWZXJzaW9uKCkgPz8gdGhpcy5nZXRQcm9kdWN0Q3VycmVudFZlcnNpb24oKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJvZHVjdEN1cnJlbnRWZXJzaW9uKCk6IElQcm9kdWN0VmVyc2lvbiB7XG5cdFx0cmV0dXJuIHsgdmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBkYXRlOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJvZHVjdFVwZGF0ZVZlcnNpb24oKTogSVByb2R1Y3RWZXJzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKHRoaXMudXBkYXRlU2VydmljZS5zdGF0ZS50eXBlKSB7XG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5BdmFpbGFibGVGb3JEb3dubG9hZDpcblx0XHRcdGNhc2UgU3RhdGVUeXBlLkRvd25sb2FkZWQ6XG5cdFx0XHRjYXNlIFN0YXRlVHlwZS5VcGRhdGluZzpcblx0XHRcdGNhc2UgU3RhdGVUeXBlLlJlYWR5OiB7XG5cdFx0XHRcdGNvbnN0IHZlcnNpb24gPSB0aGlzLnVwZGF0ZVNlcnZpY2Uuc3RhdGUudXBkYXRlLnByb2R1Y3RWZXJzaW9uO1xuXHRcdFx0XHRpZiAodmVyc2lvbiAmJiBzZW12ZXIudmFsaWQodmVyc2lvbikpIHtcblx0XHRcdFx0XHRyZXR1cm4geyB2ZXJzaW9uLCBkYXRlOiB0aGlzLnVwZGF0ZVNlcnZpY2Uuc3RhdGUudXBkYXRlLnRpbWVzdGFtcCA/IG5ldyBEYXRlKHRoaXMudXBkYXRlU2VydmljZS5zdGF0ZS51cGRhdGUudGltZXN0YW1wKS50b0lTT1N0cmluZygpIDogdW5kZWZpbmVkIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkQXV0b1VwZGF0ZUV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHRpZiAoZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mbz8uZGlzYWxsb3dJbnN0YWxsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYXV0b1VwZGF0ZVZhbHVlID0gdGhpcy5nZXRBdXRvVXBkYXRlVmFsdWUoKTtcblxuXHRcdGlmIChhdXRvVXBkYXRlVmFsdWUgPT09IGZhbHNlKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zVG9BdXRvVXBkYXRlID0gdGhpcy5nZXRFbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMoKTtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKTtcblx0XHRcdGlmIChleHRlbnNpb25zVG9BdXRvVXBkYXRlLmluY2x1ZGVzKGV4dGVuc2lvbklkKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmlzQXV0b1VwZGF0ZUVuYWJsZWRGb3JQdWJsaXNoZXIoZXh0ZW5zaW9uLnB1Ymxpc2hlcikgJiYgIWV4dGVuc2lvbnNUb0F1dG9VcGRhdGUuaW5jbHVkZXMoYC0ke2V4dGVuc2lvbklkfWApKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb24ucGlubmVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyA9IHRoaXMuZ2V0RGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucygpO1xuXHRcdGlmIChkaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGF1dG9VcGRhdGVWYWx1ZSA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGF1dG9VcGRhdGVWYWx1ZSA9PT0gJ29ubHlFbmFibGVkRXh0ZW5zaW9ucycpIHtcblx0XHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRhc3luYyBzaG91bGRSZXF1aXJlQ29uc2VudFRvVXBkYXRlKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFleHRlbnNpb24ub3V0ZGF0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZXh0ZW5zaW9uLmxvY2FsPy5tYW5pZmVzdC5tYWluIHx8IGV4dGVuc2lvbi5sb2NhbD8ubWFuaWZlc3QuYnJvd3Nlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uLmdhbGxlcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoaXNEZWZpbmVkKGV4dGVuc2lvbi5nYWxsZXJ5LnByb3BlcnRpZXM/LmV4ZWN1dGVzQ29kZSkpIHtcblx0XHRcdGlmICghZXh0ZW5zaW9uLmdhbGxlcnkucHJvcGVydGllcy5leGVjdXRlc0NvZGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IGV4dGVuc2lvbiBpbnN0YW5jZW9mIEV4dGVuc2lvblxuXHRcdFx0XHQ/IGF3YWl0IGV4dGVuc2lvbi5nZXRHYWxsZXJ5TWFuaWZlc3QoKVxuXHRcdFx0XHQ6IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QoZXh0ZW5zaW9uLmdhbGxlcnksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0aWYgKCFtYW5pZmVzdD8ubWFpbiAmJiAhbWFuaWZlc3Q/LmJyb3dzZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ2NvbnNlbnRSZXF1aXJlZFRvVXBkYXRlJywgXCJUaGUgdXBkYXRlIGZvciB7MH0gZXh0ZW5zaW9uIGludHJvZHVjZXMgZXhlY3V0YWJsZSBjb2RlLCB3aGljaCBpcyBub3QgcHJlc2VudCBpbiB0aGUgY3VycmVudGx5IGluc3RhbGxlZCB2ZXJzaW9uLlwiLCBleHRlbnNpb24uZGlzcGxheU5hbWUpO1xuXHR9XG5cblx0aXNBdXRvVXBkYXRlRW5hYmxlZEZvcihleHRlbnNpb25PclB1Ymxpc2hlcjogSUV4dGVuc2lvbiB8IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGlmIChpc1N0cmluZyhleHRlbnNpb25PclB1Ymxpc2hlcikpIHtcblx0XHRcdGlmIChFWFRFTlNJT05fSURFTlRJRklFUl9SRUdFWC50ZXN0KGV4dGVuc2lvbk9yUHVibGlzaGVyKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHB1Ymxpc2hlciBzdHJpbmcsIGZvdW5kIGV4dGVuc2lvbiBpZGVudGlmaWVyJyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5pc0F1dG9VcGRhdGVFbmFibGVkKCkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy5pc0F1dG9VcGRhdGVFbmFibGVkRm9yUHVibGlzaGVyKGV4dGVuc2lvbk9yUHVibGlzaGVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc2hvdWxkQXV0b1VwZGF0ZUV4dGVuc2lvbihleHRlbnNpb25PclB1Ymxpc2hlcik7XG5cdH1cblxuXHRwcml2YXRlIGlzQXV0b1VwZGF0ZUVuYWJsZWRGb3JQdWJsaXNoZXIocHVibGlzaGVyOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBwdWJsaXNoZXJzVG9BdXRvVXBkYXRlID0gdGhpcy5nZXRQdWJsaXNoZXJzVG9BdXRvVXBkYXRlKCk7XG5cdFx0cmV0dXJuIHB1Ymxpc2hlcnNUb0F1dG9VcGRhdGUuaW5jbHVkZXMocHVibGlzaGVyLnRvTG93ZXJDYXNlKCkpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlQXV0b1VwZGF0ZUVuYWJsZW1lbnRGb3IoZXh0ZW5zaW9uT3JQdWJsaXNoZXI6IElFeHRlbnNpb24gfCBzdHJpbmcsIGVuYWJsZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmlzQXV0b1VwZGF0ZUVuYWJsZWQoKSkge1xuXHRcdFx0aWYgKGlzU3RyaW5nKGV4dGVuc2lvbk9yUHVibGlzaGVyKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIGV4dGVuc2lvbiwgZm91bmQgcHVibGlzaGVyIHN0cmluZycpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyA9IHRoaXMuZ2V0RGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucygpO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBleHRlbnNpb25PclB1Ymxpc2hlci5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRjb25zdCBleHRlbnNpb25JbmRleCA9IGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMuaW5kZXhPZihleHRlbnNpb25JZCk7XG5cdFx0XHRpZiAoZW5hYmxlKSB7XG5cdFx0XHRcdGlmIChleHRlbnNpb25JbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRkaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLnNwbGljZShleHRlbnNpb25JbmRleCwgMSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uSW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0ZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbklkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZXREaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMpO1xuXHRcdFx0aWYgKGVuYWJsZSAmJiBleHRlbnNpb25PclB1Ymxpc2hlci5sb2NhbCAmJiBleHRlbnNpb25PclB1Ymxpc2hlci5waW5uZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS51cGRhdGVNZXRhZGF0YShleHRlbnNpb25PclB1Ymxpc2hlci5sb2NhbCwgeyBwaW5uZWQ6IGZhbHNlIH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25DaGFuZ2UuZmlyZShleHRlbnNpb25PclB1Ymxpc2hlcik7XG5cdFx0fVxuXG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCBlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMgPSB0aGlzLmdldEVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucygpO1xuXHRcdFx0aWYgKGlzU3RyaW5nKGV4dGVuc2lvbk9yUHVibGlzaGVyKSkge1xuXHRcdFx0XHRpZiAoRVhURU5TSU9OX0lERU5USUZJRVJfUkVHRVgudGVzdChleHRlbnNpb25PclB1Ymxpc2hlcikpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHB1Ymxpc2hlciBzdHJpbmcsIGZvdW5kIGV4dGVuc2lvbiBpZGVudGlmaWVyJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXh0ZW5zaW9uT3JQdWJsaXNoZXIgPSBleHRlbnNpb25PclB1Ymxpc2hlci50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRpZiAodGhpcy5pc0F1dG9VcGRhdGVFbmFibGVkRm9yKGV4dGVuc2lvbk9yUHVibGlzaGVyKSAhPT0gZW5hYmxlKSB7XG5cdFx0XHRcdFx0aWYgKGVuYWJsZSkge1xuXHRcdFx0XHRcdFx0ZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLnB1c2goZXh0ZW5zaW9uT3JQdWJsaXNoZXIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAoZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbk9yUHVibGlzaGVyKSkge1xuXHRcdFx0XHRcdFx0XHRlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMuc3BsaWNlKGVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucy5pbmRleE9mKGV4dGVuc2lvbk9yUHVibGlzaGVyKSwgMSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuc2V0RW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKGVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyk7XG5cdFx0XHRcdGZvciAoY29uc3QgZSBvZiB0aGlzLmluc3RhbGxlZCkge1xuXHRcdFx0XHRcdGlmIChlLnB1Ymxpc2hlci50b0xvd2VyQ2FzZSgpID09PSBleHRlbnNpb25PclB1Ymxpc2hlcikge1xuXHRcdFx0XHRcdFx0dGhpcy5fb25DaGFuZ2UuZmlyZShlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZXh0ZW5zaW9uT3JQdWJsaXNoZXIuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRjb25zdCBlbmFibGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlciA9IHRoaXMuaXNBdXRvVXBkYXRlRW5hYmxlZEZvcihleHRlbnNpb25PclB1Ymxpc2hlci5wdWJsaXNoZXIudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdGNvbnN0IGVuYWJsZUF1dG9VcGRhdGVzRm9yRXh0ZW5zaW9uID0gZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLmluY2x1ZGVzKGV4dGVuc2lvbklkKTtcblx0XHRcdFx0Y29uc3QgZGlzYWJsZUF1dG9VcGRhdGVzRm9yRXh0ZW5zaW9uID0gZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLmluY2x1ZGVzKGAtJHtleHRlbnNpb25JZH1gKTtcblxuXHRcdFx0XHRpZiAoZW5hYmxlKSB7XG5cdFx0XHRcdFx0aWYgKGRpc2FibGVBdXRvVXBkYXRlc0ZvckV4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0ZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLnNwbGljZShlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMuaW5kZXhPZihgLSR7ZXh0ZW5zaW9uSWR9YCksIDEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoZW5hYmxlQXV0b1VwZGF0ZXNGb3JQdWJsaXNoZXIpIHtcblx0XHRcdFx0XHRcdGlmIChlbmFibGVBdXRvVXBkYXRlc0ZvckV4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0XHRlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMuc3BsaWNlKGVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucy5pbmRleE9mKGV4dGVuc2lvbklkKSwgMSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmICghZW5hYmxlQXV0b1VwZGF0ZXNGb3JFeHRlbnNpb24pIHtcblx0XHRcdFx0XHRcdFx0ZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLnB1c2goZXh0ZW5zaW9uSWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBEaXNhYmxlIEF1dG8gVXBkYXRlc1xuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRpZiAoZW5hYmxlQXV0b1VwZGF0ZXNGb3JFeHRlbnNpb24pIHtcblx0XHRcdFx0XHRcdGVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucy5zcGxpY2UoZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLmluZGV4T2YoZXh0ZW5zaW9uSWQpLCAxKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVuYWJsZUF1dG9VcGRhdGVzRm9yUHVibGlzaGVyKSB7XG5cdFx0XHRcdFx0XHRpZiAoIWRpc2FibGVBdXRvVXBkYXRlc0ZvckV4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0XHRlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMucHVzaChgLSR7ZXh0ZW5zaW9uSWR9YCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGlmIChkaXNhYmxlQXV0b1VwZGF0ZXNGb3JFeHRlbnNpb24pIHtcblx0XHRcdFx0XHRcdFx0ZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zLnNwbGljZShlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMuaW5kZXhPZihgLSR7ZXh0ZW5zaW9uSWR9YCksIDEpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnNldEVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyhlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMpO1xuXHRcdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKGV4dGVuc2lvbk9yUHVibGlzaGVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZW5hYmxlKSB7XG5cdFx0XHR0aGlzLmF1dG9VcGRhdGVFeHRlbnNpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFNlbGVjdGVkRXh0ZW5zaW9uVG9BdXRvVXBkYXRlVmFsdWVDaGFuZ2UoKTogdm9pZCB7XG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5lbmFibGVkQXVvdFVwZGF0ZUV4dGVuc2lvbnNWYWx1ZSAhPT0gdGhpcy5nZXRFbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSgpIC8qIFRoaXMgY2hlY2tzIGlmIGN1cnJlbnQgd2luZG93IGNoYW5nZWQgdGhlIHZhbHVlIG9yIG5vdCAqL1xuXHRcdFx0fHwgdGhpcy5kaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUgIT09IHRoaXMuZ2V0RGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKCkgLyogVGhpcyBjaGVja3MgaWYgY3VycmVudCB3aW5kb3cgY2hhbmdlZCB0aGUgdmFsdWUgb3Igbm90ICovXG5cdFx0KSB7XG5cdFx0XHRjb25zdCB1c2VyRXh0ZW5zaW9ucyA9IHRoaXMuaW5zdGFsbGVkLmZpbHRlcihlID0+ICFlLmlzQnVpbHRpbik7XG5cdFx0XHRjb25zdCBncm91cEJ5ID0gKGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSk6IElFeHRlbnNpb25bXVtdID0+IHtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkQXV0b1VwZGF0ZTogSUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRcdGNvbnN0IHNob3VsZE5vdEF1dG9VcGRhdGU6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuc2hvdWxkQXV0b1VwZGF0ZUV4dGVuc2lvbihleHRlbnNpb24pKSB7XG5cdFx0XHRcdFx0XHRzaG91bGRBdXRvVXBkYXRlLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0c2hvdWxkTm90QXV0b1VwZGF0ZS5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBbc2hvdWxkQXV0b1VwZGF0ZSwgc2hvdWxkTm90QXV0b1VwZGF0ZV07XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBbd2FzU2hvdWxkQXV0b1VwZGF0ZSwgd2FzU2hvdWxkTm90QXV0b1VwZGF0ZV0gPSBncm91cEJ5KHVzZXJFeHRlbnNpb25zKTtcblx0XHRcdHRoaXMuX2VuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgW3Nob3VsZEF1dG9VcGRhdGUsIHNob3VsZE5vdEF1dG9VcGRhdGVdID0gZ3JvdXBCeSh1c2VyRXh0ZW5zaW9ucyk7XG5cblx0XHRcdGZvciAoY29uc3QgZSBvZiB3YXNTaG91bGRBdXRvVXBkYXRlID8/IFtdKSB7XG5cdFx0XHRcdGlmIChzaG91bGROb3RBdXRvVXBkYXRlPy5pbmNsdWRlcyhlKSkge1xuXHRcdFx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgZSBvZiB3YXNTaG91bGROb3RBdXRvVXBkYXRlID8/IFtdKSB7XG5cdFx0XHRcdGlmIChzaG91bGRBdXRvVXBkYXRlPy5pbmNsdWRlcyhlKSkge1xuXHRcdFx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBjYW5JbnN0YWxsKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IFByb21pc2U8dHJ1ZSB8IElNYXJrZG93blN0cmluZz4ge1xuXHRcdGlmICghKGV4dGVuc2lvbiBpbnN0YW5jZW9mIEV4dGVuc2lvbikpIHtcblx0XHRcdHJldHVybiBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRUZXh0KG5scy5sb2NhbGl6ZSgnbm90IGFuIGV4dGVuc2lvbicsIFwiVGhlIHByb3ZpZGVkIG9iamVjdCBpcyBub3QgYW4gZXh0ZW5zaW9uLlwiKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGV4dGVuc2lvbi5pc01hbGljaW91cykge1xuXHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQobmxzLmxvY2FsaXplKCdtYWxpY2lvdXMnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIHJlcG9ydGVkIHRvIGJlIHByb2JsZW1hdGljLlwiKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8/LmRpc2FsbG93SW5zdGFsbCkge1xuXHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQobmxzLmxvY2FsaXplKCdkaXNhbGxvd2VkJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBkaXNhbGxvd2VkIHRvIGJlIGluc3RhbGxlZC5cIikpO1xuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb24uZ2FsbGVyeSkge1xuXHRcdFx0aWYgKCFleHRlbnNpb24uZ2FsbGVyeS5pc1NpZ25lZCAmJiAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpKT8uY2FwYWJpbGl0aWVzLnNpZ25pbmc/LmFsbFJlcG9zaXRvcnlTaWduZWQpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQobmxzLmxvY2FsaXplKCdub3Qgc2lnbmVkJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBub3Qgc2lnbmVkLlwiKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGxvY2FsUmVzdWx0ID0gdGhpcy5sb2NhbEV4dGVuc2lvbnMgPyBhd2FpdCB0aGlzLmxvY2FsRXh0ZW5zaW9ucy5jYW5JbnN0YWxsKGV4dGVuc2lvbi5nYWxsZXJ5KSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChsb2NhbFJlc3VsdCA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVtb3RlUmVzdWx0ID0gdGhpcy5yZW1vdGVFeHRlbnNpb25zID8gYXdhaXQgdGhpcy5yZW1vdGVFeHRlbnNpb25zLmNhbkluc3RhbGwoZXh0ZW5zaW9uLmdhbGxlcnkpIDogdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHJlbW90ZVJlc3VsdCA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2ViUmVzdWx0ID0gdGhpcy53ZWJFeHRlbnNpb25zID8gYXdhaXQgdGhpcy53ZWJFeHRlbnNpb25zLmNhbkluc3RhbGwoZXh0ZW5zaW9uLmdhbGxlcnkpIDogdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHdlYlJlc3VsdCA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGxvY2FsUmVzdWx0ID8/IHJlbW90ZVJlc3VsdCA/PyB3ZWJSZXN1bHQgPz8gbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dChubHMubG9jYWxpemUoJ2Nhbm5vdCBiZSBpbnN0YWxsZWQnLCBcIkNhbm5vdCBpbnN0YWxsIHRoZSAnezB9JyBleHRlbnNpb24gYmVjYXVzZSBpdCBpcyBub3QgYXZhaWxhYmxlIGluIHRoaXMgc2V0dXAuXCIsIGV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb24ucmVzb3VyY2VFeHRlbnNpb24gJiYgYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5jYW5JbnN0YWxsKGV4dGVuc2lvbi5yZXNvdXJjZUV4dGVuc2lvbikgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRUZXh0KG5scy5sb2NhbGl6ZSgnY2Fubm90IGJlIGluc3RhbGxlZCcsIFwiQ2Fubm90IGluc3RhbGwgdGhlICd7MH0nIGV4dGVuc2lvbiBiZWNhdXNlIGl0IGlzIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBzZXR1cC5cIiwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsKGFyZzogc3RyaW5nIHwgVVJJIHwgSUV4dGVuc2lvbiwgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25PcHRpb25zID0ge30sIHByb2dyZXNzTG9jYXRpb24/OiBQcm9ncmVzc0xvY2F0aW9uIHwgc3RyaW5nKTogUHJvbWlzZTxJRXh0ZW5zaW9uPiB7XG5cdFx0bGV0IGluc3RhbGxhYmxlOiBVUkkgfCBJR2FsbGVyeUV4dGVuc2lvbiB8IElSZXNvdXJjZUV4dGVuc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzZXJ2ZXJzOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcltdIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGFyZyBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0aW5zdGFsbGFibGUgPSBhcmc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxldCBpbnN0YWxsYWJsZUluZm86IElFeHRlbnNpb25JbmZvIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGdhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBJbnN0YWxsIGJ5IGlkXG5cdFx0XHRpZiAoaXNTdHJpbmcoYXJnKSkge1xuXHRcdFx0XHRleHRlbnNpb24gPSB0aGlzLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQ6IGFyZyB9KSk7XG5cdFx0XHRcdGlmICghZXh0ZW5zaW9uPy5pc0J1aWx0aW4pIHtcblx0XHRcdFx0XHRpbnN0YWxsYWJsZUluZm8gPSB7IGlkOiBhcmcsIHZlcnNpb246IGluc3RhbGxPcHRpb25zLnZlcnNpb24sIHByZVJlbGVhc2U6IGluc3RhbGxPcHRpb25zLmluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbiA/PyB0aGlzLnByZWZlclByZVJlbGVhc2VzIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIEluc3RhbGwgYnkgZ2FsbGVyeVxuXHRcdFx0ZWxzZSBpZiAoYXJnLmdhbGxlcnkpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uID0gYXJnO1xuXHRcdFx0XHRnYWxsZXJ5ID0gYXJnLmdhbGxlcnk7XG5cdFx0XHRcdGlmIChpbnN0YWxsT3B0aW9ucy52ZXJzaW9uICYmIGluc3RhbGxPcHRpb25zLnZlcnNpb24gIT09IGdhbGxlcnk/LnZlcnNpb24pIHtcblx0XHRcdFx0XHRpbnN0YWxsYWJsZUluZm8gPSB7IGlkOiBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgdmVyc2lvbjogaW5zdGFsbE9wdGlvbnMudmVyc2lvbiB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBJbnN0YWxsIGJ5IHJlc291cmNlXG5cdFx0XHRlbHNlIGlmIChhcmcucmVzb3VyY2VFeHRlbnNpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uID0gYXJnO1xuXHRcdFx0XHRpbnN0YWxsYWJsZSA9IGFyZy5yZXNvdXJjZUV4dGVuc2lvbjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluc3RhbGxhYmxlSW5mbykge1xuXHRcdFx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGV4dGVuc2lvbj8uc2VydmVyID8gYXdhaXQgZXh0ZW5zaW9uLnNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRnYWxsZXJ5ID0gKGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbaW5zdGFsbGFibGVJbmZvXSwgeyB0YXJnZXRQbGF0Zm9ybSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSkuYXQoMCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZXh0ZW5zaW9uICYmIGdhbGxlcnkpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb24sIGV4dCA9PiB0aGlzLmdldEV4dGVuc2lvblN0YXRlKGV4dCksIGV4dCA9PiB0aGlzLmdldFJ1bnRpbWVTdGF0ZShleHQpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZ2FsbGVyeSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0KDxFeHRlbnNpb24+ZXh0ZW5zaW9uKS5zZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCgpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dGVuc2lvbj8uaXNNYWxpY2lvdXMpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnbWFsaWNpb3VzJywgXCJUaGlzIGV4dGVuc2lvbiBpcyByZXBvcnRlZCB0byBiZSBwcm9ibGVtYXRpYy5cIikpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0XHQvLyBJZiByZXF1ZXN0ZWQgdG8gaW5zdGFsbCBldmVyeXdoZXJlXG5cdFx0XHRcdC8vIHRoZW4gaW5zdGFsbCB0aGUgZXh0ZW5zaW9uIGluIGFsbCB0aGUgc2VydmVycyB3aGVyZSBpdCBpcyBub3QgaW5zdGFsbGVkXG5cdFx0XHRcdGlmIChpbnN0YWxsT3B0aW9ucy5pbnN0YWxsRXZlcnl3aGVyZSkge1xuXHRcdFx0XHRcdHNlcnZlcnMgPSBbXTtcblx0XHRcdFx0XHRjb25zdCBpbnN0YWxsYWJsZVNlcnZlcnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxhYmxlU2VydmVycyhnYWxsZXJ5KTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbnNTZXJ2ZXIgb2YgdGhpcy5leHRlbnNpb25zU2VydmVycykge1xuXHRcdFx0XHRcdFx0aWYgKGluc3RhbGxhYmxlU2VydmVycy5pbmNsdWRlcyhleHRlbnNpb25zU2VydmVyLnNlcnZlcikgJiYgIWV4dGVuc2lvbnNTZXJ2ZXIubG9jYWwuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZ2FsbGVyeS5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0XHRcdFx0c2VydmVycy5wdXNoKGV4dGVuc2lvbnNTZXJ2ZXIuc2VydmVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gSWYgcmVxdWVzdGVkIHRvIGVuYWJsZSBhbmQgZXh0ZW5zaW9uIGlzIGFscmVhZHkgaW5zdGFsbGVkXG5cdFx0XHRcdC8vIENoZWNrIGlmIHRoZSBleHRlbnNpb24gaXMgZGlzYWJsZWQgYmVjYXVzZSBvZiBleHRlbnNpb24ga2luZFxuXHRcdFx0XHQvLyBJZiBzbywgaW5zdGFsbCB0aGUgZXh0ZW5zaW9uIGluIHRoZSBzZXJ2ZXIgdGhhdCBpcyBjb21wYXRpYmxlLlxuXHRcdFx0XHRlbHNlIGlmIChpbnN0YWxsT3B0aW9ucy5lbmFibGUgJiYgZXh0ZW5zaW9uPy5sb2NhbCkge1xuXHRcdFx0XHRcdHNlcnZlcnMgPSBbXTtcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlFeHRlbnNpb25LaW5kKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBbaW5zdGFsbGFibGVTZXJ2ZXJdID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsYWJsZVNlcnZlcnMoZ2FsbGVyeSk7XG5cdFx0XHRcdFx0XHRpZiAoaW5zdGFsbGFibGVTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0c2VydmVycy5wdXNoKGluc3RhbGxhYmxlU2VydmVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFzZXJ2ZXJzIHx8IHNlcnZlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdGlmICghaW5zdGFsbGFibGUpIHtcblx0XHRcdFx0XHRpZiAoIWdhbGxlcnkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGlkID0gaXNTdHJpbmcoYXJnKSA/IGFyZyA6ICg8SUV4dGVuc2lvbj5hcmcpLmlkZW50aWZpZXIuaWQ7XG5cdFx0XHRcdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5nZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QoKTtcblx0XHRcdFx0XHRcdGNvbnN0IHJlcG9ydElzc3VlVXJpID0gbWFuaWZlc3QgPyBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaShtYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5SZXBvcnRJc3N1ZVVyaSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRjb25zdCByZXBvcnRJc3N1ZU1lc3NhZ2UgPSByZXBvcnRJc3N1ZVVyaSA/IG5scy5sb2NhbGl6ZSgncmVwb3J0IGlzc3VlJywgXCJJZiB0aGlzIGlzc3VlIHBlcnNpc3RzLCBwbGVhc2UgcmVwb3J0IGl0IGF0IHswfVwiLCByZXBvcnRJc3N1ZVVyaS50b1N0cmluZygpKSA6ICcnO1xuXHRcdFx0XHRcdFx0aWYgKGluc3RhbGxPcHRpb25zLnZlcnNpb24pIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm90IGZvdW5kIHZlcnNpb24nLCBcIlRoZSBleHRlbnNpb24gJ3swfScgY2Fubm90IGJlIGluc3RhbGxlZCBiZWNhdXNlIHRoZSByZXF1ZXN0ZWQgdmVyc2lvbiAnezF9JyB3YXMgbm90IGZvdW5kLlwiLCBpZCwgaW5zdGFsbE9wdGlvbnMudmVyc2lvbik7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IocmVwb3J0SXNzdWVNZXNzYWdlID8gYCR7bWVzc2FnZX0gJHtyZXBvcnRJc3N1ZU1lc3NhZ2V9YCA6IG1lc3NhZ2UsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuTm90Rm91bmQpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm90IGZvdW5kJywgXCJUaGUgZXh0ZW5zaW9uICd7MH0nIGNhbm5vdCBiZSBpbnN0YWxsZWQgYmVjYXVzZSBpdCB3YXMgbm90IGZvdW5kLlwiLCBpZCk7XG5cdFx0XHRcdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3IocmVwb3J0SXNzdWVNZXNzYWdlID8gYCR7bWVzc2FnZX0gJHtyZXBvcnRJc3N1ZU1lc3NhZ2V9YCA6IG1lc3NhZ2UsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuTm90Rm91bmQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpbnN0YWxsYWJsZSA9IGdhbGxlcnk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGluc3RhbGxPcHRpb25zLnZlcnNpb24pIHtcblx0XHRcdFx0XHRpbnN0YWxsT3B0aW9ucy5pbnN0YWxsR2l2ZW5WZXJzaW9uID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uPy5pc1dvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0XHRcdGluc3RhbGxPcHRpb25zLmlzV29ya3NwYWNlU2NvcGVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpbnN0YWxsYWJsZSkge1xuXHRcdFx0aWYgKGluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24pIHtcblx0XHRcdFx0Y29uc3Qgc3luY0NoZWNrID0gaXNVbmRlZmluZWQoaW5zdGFsbE9wdGlvbnMuaXNNYWNoaW5lU2NvcGVkKSAmJiB0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpICYmIHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNSZXNvdXJjZUVuYWJsZWQoU3luY1Jlc291cmNlLkV4dGVuc2lvbnMpO1xuXHRcdFx0XHRjb25zdCBidXR0b25zOiBJUHJvbXB0QnV0dG9uPGJvb2xlYW4+W10gPSBbXTtcblx0XHRcdFx0YnV0dG9ucy5wdXNoKHtcblx0XHRcdFx0XHRsYWJlbDogaXNTdHJpbmcoaW5zdGFsbE9wdGlvbnMuanVzdGlmaWNhdGlvbikgfHwgIWluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24uYWN0aW9uXG5cdFx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSh7IGtleTogJ2luc3RhbGxCdXR0b25MYWJlbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkluc3RhbGwgRXh0ZW5zaW9uXCIpXG5cdFx0XHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2luc3RhbGxCdXR0b25MYWJlbFdpdGhBY3Rpb24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZJbnN0YWxsIEV4dGVuc2lvbiBhbmQgezB9XCIsIGluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24uYWN0aW9uKSwgcnVuOiAoKSA9PiB0cnVlXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAoIWV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGJ1dHRvbnMucHVzaCh7IGxhYmVsOiBubHMubG9jYWxpemUoJ29wZW4nLCBcIk9wZW4gRXh0ZW5zaW9uXCIpLCBydW46ICgpID0+IHsgdGhpcy5vcGVuKGV4dGVuc2lvbiEpOyByZXR1cm4gZmFsc2U7IH0gfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdDxib29sZWFuPih7XG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvblRpdGxlJywgXCJJbnN0YWxsIEV4dGVuc2lvblwiKSxcblx0XHRcdFx0XHRtZXNzYWdlOiBleHRlbnNpb24gPyBubHMubG9jYWxpemUoJ2luc3RhbGxFeHRlbnNpb25NZXNzYWdlJywgXCJXb3VsZCB5b3UgbGlrZSB0byBpbnN0YWxsICd7MH0nIGV4dGVuc2lvbiBmcm9tICd7MX0nP1wiLCBleHRlbnNpb24uZGlzcGxheU5hbWUsIGV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSkgOiBubHMubG9jYWxpemUoJ2luc3RhbGxWU0lYTWVzc2FnZScsIFwiV291bGQgeW91IGxpa2UgdG8gaW5zdGFsbCB0aGUgZXh0ZW5zaW9uP1wiKSxcblx0XHRcdFx0XHRkZXRhaWw6IGlzU3RyaW5nKGluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24pID8gaW5zdGFsbE9wdGlvbnMuanVzdGlmaWNhdGlvbiA6IGluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24ucmVhc29uLFxuXHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjogdHJ1ZSxcblx0XHRcdFx0XHRidXR0b25zLFxuXHRcdFx0XHRcdGNoZWNrYm94OiBzeW5jQ2hlY2sgPyB7XG5cdFx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdzeW5jIGV4dGVuc2lvbicsIFwiU3luYyB0aGlzIGV4dGVuc2lvblwiKSxcblx0XHRcdFx0XHRcdGNoZWNrZWQ6IHRydWUsXG5cdFx0XHRcdFx0fSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmICghcmVzdWx0LnJlc3VsdCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChzeW5jQ2hlY2spIHtcblx0XHRcdFx0XHRpbnN0YWxsT3B0aW9ucy5pc01hY2hpbmVTY29wZWQgPSAhcmVzdWx0LmNoZWNrYm94Q2hlY2tlZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGluc3RhbGxhYmxlIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRcdGV4dGVuc2lvbiA9IGF3YWl0IHRoaXMuZG9JbnN0YWxsKHVuZGVmaW5lZCwgKCkgPT4gdGhpcy5pbnN0YWxsRnJvbVZTSVgoaW5zdGFsbGFibGUsIGluc3RhbGxPcHRpb25zKSwgcHJvZ3Jlc3NMb2NhdGlvbik7XG5cdFx0XHR9IGVsc2UgaWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLnJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5kb0luc3RhbGwoZXh0ZW5zaW9uLCAoKSA9PiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxSZXNvdXJjZUV4dGVuc2lvbihpbnN0YWxsYWJsZSBhcyBJUmVzb3VyY2VFeHRlbnNpb24sIGluc3RhbGxPcHRpb25zKSwgcHJvZ3Jlc3NMb2NhdGlvbik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5kb0luc3RhbGwoZXh0ZW5zaW9uLCAoKSA9PiB0aGlzLmluc3RhbGxGcm9tR2FsbGVyeShleHRlbnNpb24hLCBpbnN0YWxsYWJsZSBhcyBJR2FsbGVyeUV4dGVuc2lvbiwgaW5zdGFsbE9wdGlvbnMsIHNlcnZlcnMpLCBwcm9ncmVzc0xvY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobmxzLmxvY2FsaXplKCd1bmtub3duJywgXCJVbmFibGUgdG8gaW5zdGFsbCBleHRlbnNpb25cIikpO1xuXHRcdH1cblxuXHRcdGlmIChpbnN0YWxsT3B0aW9ucy5lbmFibGUpIHtcblx0XHRcdGlmIChleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRXb3Jrc3BhY2UgfHwgZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkR2xvYmFsbHkpIHtcblx0XHRcdFx0aWYgKGluc3RhbGxPcHRpb25zLmp1c3RpZmljYXRpb24pIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdlbmFibGVFeHRlbnNpb25UaXRsZScsIFwiRW5hYmxlIEV4dGVuc2lvblwiKSxcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnZW5hYmxlRXh0ZW5zaW9uTWVzc2FnZScsIFwiV291bGQgeW91IGxpa2UgdG8gZW5hYmxlICd7MH0nIGV4dGVuc2lvbj9cIiwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSxcblx0XHRcdFx0XHRcdGRldGFpbDogaXNTdHJpbmcoaW5zdGFsbE9wdGlvbnMuanVzdGlmaWNhdGlvbikgPyBpbnN0YWxsT3B0aW9ucy5qdXN0aWZpY2F0aW9uIDogaW5zdGFsbE9wdGlvbnMuanVzdGlmaWNhdGlvbi5yZWFzb24sXG5cdFx0XHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBpc1N0cmluZyhpbnN0YWxsT3B0aW9ucy5qdXN0aWZpY2F0aW9uKSA/IG5scy5sb2NhbGl6ZSh7IGtleTogJ2VuYWJsZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmRW5hYmxlIEV4dGVuc2lvblwiKSA6IG5scy5sb2NhbGl6ZSh7IGtleTogJ2VuYWJsZUJ1dHRvbkxhYmVsV2l0aEFjdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkVuYWJsZSBFeHRlbnNpb24gYW5kIHswfVwiLCBpbnN0YWxsT3B0aW9ucy5qdXN0aWZpY2F0aW9uLmFjdGlvbiksXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0aWYgKCFyZXN1bHQuY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgdGhpcy5zZXRFbmFibGVtZW50KGV4dGVuc2lvbiwgZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkV29ya3NwYWNlID8gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRXb3Jrc3BhY2UgOiBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5KTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMud2FpdFVudGlsRXh0ZW5zaW9uSXNFbmFibGVkKGV4dGVuc2lvbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0fVxuXG5cdGFzeW5jIGluc3RhbGxJblNlcnZlcihleHRlbnNpb246IElFeHRlbnNpb24sIHNlcnZlcjogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIsIGluc3RhbGxPcHRpb25zPzogSW5zdGFsbE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmRvSW5zdGFsbChleHRlbnNpb24sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGxvY2FsID0gZXh0ZW5zaW9uLmxvY2FsO1xuXHRcdFx0aWYgKCFsb2NhbCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4dGVuc2lvbiBub3QgZm91bmQnKTtcblx0XHRcdH1cblx0XHRcdGlmICghZXh0ZW5zaW9uLmdhbGxlcnkpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uID0gKGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9ucyhbeyAuLi5leHRlbnNpb24uaWRlbnRpZmllciwgcHJlUmVsZWFzZTogbG9jYWwucHJlUmVsZWFzZSB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdID8/IGV4dGVuc2lvbjtcblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb24uZ2FsbGVyeSkge1xuXHRcdFx0XHRyZXR1cm4gc2VydmVyLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxGcm9tR2FsbGVyeShleHRlbnNpb24uZ2FsbGVyeSwgeyBpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IGxvY2FsLnByZVJlbGVhc2UsIC4uLmluc3RhbGxPcHRpb25zIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpO1xuXHRcdFx0aWYgKCFpc1RhcmdldFBsYXRmb3JtQ29tcGF0aWJsZShsb2NhbC50YXJnZXRQbGF0Zm9ybSwgW2xvY2FsLnRhcmdldFBsYXRmb3JtXSwgdGFyZ2V0UGxhdGZvcm0pKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihubHMubG9jYWxpemUoJ2luY29tcGF0aWJsZScsIFwiQ2FuJ3QgaW5zdGFsbCAnezB9JyBleHRlbnNpb24gYmVjYXVzZSBpdCBpcyBub3QgY29tcGF0aWJsZS5cIiwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdnNpeCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuemlwKGxvY2FsKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiBhd2FpdCBzZXJ2ZXIuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbCh2c2l4KTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwodnNpeCk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0Y2FuU2V0TGFuZ3VhZ2UoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFpc1dlYikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uLmdhbGxlcnkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBsb2NhbGUgPSBnZXRMb2NhbGUoZXh0ZW5zaW9uLmdhbGxlcnkpO1xuXHRcdGlmICghbG9jYWxlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBzZXRMYW5ndWFnZShleHRlbnNpb246IElFeHRlbnNpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuY2FuU2V0TGFuZ3VhZ2UoZXh0ZW5zaW9uKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW4gbm90IHNldCBsYW5ndWFnZScpO1xuXHRcdH1cblx0XHRjb25zdCBsb2NhbGUgPSBnZXRMb2NhbGUoZXh0ZW5zaW9uLmdhbGxlcnkhKTtcblx0XHRpZiAobG9jYWxlID09PSBsYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBsb2NhbGl6ZWRMYW5ndWFnZU5hbWUgPSBleHRlbnNpb24uZ2FsbGVyeT8ucHJvcGVydGllcz8ubG9jYWxpemVkTGFuZ3VhZ2VzPy5bMF07XG5cdFx0cmV0dXJuIHRoaXMubG9jYWxlU2VydmljZS5zZXRMb2NhbGUoeyBpZDogbG9jYWxlLCBnYWxsZXJ5RXh0ZW5zaW9uOiBleHRlbnNpb24uZ2FsbGVyeSwgZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBsYWJlbDogbG9jYWxpemVkTGFuZ3VhZ2VOYW1lID8/IGV4dGVuc2lvbi5kaXNwbGF5TmFtZSB9KTtcblx0fVxuXG5cdHNldEVuYWJsZW1lbnQoZXh0ZW5zaW9uczogSUV4dGVuc2lvbiB8IElFeHRlbnNpb25bXSwgZW5hYmxlbWVudFN0YXRlOiBFbmFibGVtZW50U3RhdGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRleHRlbnNpb25zID0gQXJyYXkuaXNBcnJheShleHRlbnNpb25zKSA/IGV4dGVuc2lvbnMgOiBbZXh0ZW5zaW9uc107XG5cdFx0cmV0dXJuIHRoaXMucHJvbXB0QW5kU2V0RW5hYmxlbWVudChleHRlbnNpb25zLCBlbmFibGVtZW50U3RhdGUpO1xuXHR9XG5cblx0YXN5bmMgdW5pbnN0YWxsKGU6IElFeHRlbnNpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb24gPSBlLmxvY2FsID8gZSA6IHRoaXMubG9jYWwuZmluZChsb2NhbCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhsb2NhbC5pZGVudGlmaWVyLCBlLmlkZW50aWZpZXIpKTtcblx0XHRpZiAoIWV4dGVuc2lvbj8ubG9jYWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTWlzc2luZyBsb2NhbCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb1VuaW5zdGFsbDogVW5pbnN0YWxsRXh0ZW5zaW9uSW5mb1tdID0gW3sgZXh0ZW5zaW9uOiBleHRlbnNpb24ubG9jYWwgfV07XG5cdFx0Zm9yIChjb25zdCBwYWNrRXh0ZW5zaW9uIG9mIHRoaXMuZ2V0QWxsUGFja0V4dGVuc2lvbnNUb1VuaW5zdGFsbChleHRlbnNpb24ubG9jYWwsIHRoaXMubG9jYWwpKSB7XG5cdFx0XHRpZiAoIWV4dGVuc2lvbnNUb1VuaW5zdGFsbC5zb21lKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5leHRlbnNpb24uaWRlbnRpZmllciwgcGFja0V4dGVuc2lvbi5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0ZXh0ZW5zaW9uc1RvVW5pbnN0YWxsLnB1c2goeyBleHRlbnNpb246IHBhY2tFeHRlbnNpb24gfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVwZW5kZW50czogSUV4dGVuc2lvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCB7IGV4dGVuc2lvbiB9IG9mIGV4dGVuc2lvbnNUb1VuaW5zdGFsbCkge1xuXHRcdFx0Zm9yIChjb25zdCBsb2NhbCBvZiB0aGlzLmxvY2FsKSB7XG5cdFx0XHRcdGlmICghbG9jYWwubG9jYWwpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYXJlU2FtZUV4dGVuc2lvbnMobG9jYWwuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGxvY2FsLmRlcGVuZGVuY2llcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvblBhY2s/LnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBsb2NhbC5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZGVwZW5kZW50cy5zb21lKGQgPT4gZC5leHRlbnNpb25QYWNrLnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBsb2NhbC5pZGVudGlmaWVyKSkpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGxvY2FsLmRlcGVuZGVuY2llcy5zb21lKGRlcCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhleHRlbnNpb24uaWRlbnRpZmllciwgeyBpZDogZGVwIH0pKSkge1xuXHRcdFx0XHRcdGRlcGVuZGVudHMucHVzaChsb2NhbCk7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvVW5pbnN0YWxsLnB1c2goeyBleHRlbnNpb246IGxvY2FsLmxvY2FsIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRlcGVuZGVudHMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCB7IHJlc3VsdCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3VuaW5zdGFsbERlcGVuZGVudHMnLCBcIlVuaW5zdGFsbCBFeHRlbnNpb24gd2l0aCBEZXBlbmRlbnRzXCIpLFxuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRtZXNzYWdlOiB0aGlzLmdldEVycm9yTWVzc2FnZUZvclVuaW5zdGFsbGluZ0FuRXh0ZW5zaW9uV2l0aERlcGVuZGVudHMoZXh0ZW5zaW9uLCBkZXBlbmRlbnRzKSxcblx0XHRcdFx0YnV0dG9uczogW3tcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCd1bmluc3RhbGxBbGwnLCBcIlVuaW5zdGFsbCBBbGxcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB0cnVlXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0XHRydW46ICgpID0+IGZhbHNlXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMud2l0aFByb2dyZXNzKHtcblx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLkV4dGVuc2lvbnMsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd1bmluc3RhbGxpbmdFeHRlbnNpb24nLCAnVW5pbnN0YWxsaW5nIGV4dGVuc2lvbi4uLi4nKSxcblx0XHRcdHNvdXJjZTogYCR7ZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWR9YFxuXHRcdH0sICgpID0+IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudW5pbnN0YWxsRXh0ZW5zaW9ucyhleHRlbnNpb25zVG9Vbmluc3RhbGwpLnRoZW4oKCkgPT4gdW5kZWZpbmVkKSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFsbFBhY2tFeHRlbnNpb25zVG9Vbmluc3RhbGwoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIGluc3RhbGxlZDogSUV4dGVuc2lvbltdLCBjaGVja2VkOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdKTogSUxvY2FsRXh0ZW5zaW9uW10ge1xuXHRcdGlmIChjaGVja2VkLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y2hlY2tlZC5wdXNoKGV4dGVuc2lvbik7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1BhY2sgPSBleHRlbnNpb24ubWFuaWZlc3QuZXh0ZW5zaW9uUGFjayA/PyBbXTtcblx0XHRpZiAoZXh0ZW5zaW9uc1BhY2subGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBwYWNrZWRFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBpIG9mIGluc3RhbGxlZCkge1xuXHRcdFx0XHRpZiAoaS5sb2NhbCAmJiAhaS5pc0J1aWx0aW4gJiYgZXh0ZW5zaW9uc1BhY2suc29tZShpZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkIH0sIGkuaWRlbnRpZmllcikpKSB7XG5cdFx0XHRcdFx0cGFja2VkRXh0ZW5zaW9ucy5wdXNoKGkubG9jYWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwYWNrT2ZQYWNrZWRFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBwYWNrZWRFeHRlbnNpb24gb2YgcGFja2VkRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRwYWNrT2ZQYWNrZWRFeHRlbnNpb25zLnB1c2goLi4udGhpcy5nZXRBbGxQYWNrRXh0ZW5zaW9uc1RvVW5pbnN0YWxsKHBhY2tlZEV4dGVuc2lvbiwgaW5zdGFsbGVkLCBjaGVja2VkKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gWy4uLnBhY2tlZEV4dGVuc2lvbnMsIC4uLnBhY2tPZlBhY2tlZEV4dGVuc2lvbnNdO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIGdldEVycm9yTWVzc2FnZUZvclVuaW5zdGFsbGluZ0FuRXh0ZW5zaW9uV2l0aERlcGVuZGVudHMoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBkZXBlbmRlbnRzOiBJRXh0ZW5zaW9uW10pOiBzdHJpbmcge1xuXHRcdGlmIChkZXBlbmRlbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnc2luZ2xlRGVwZW5kZW50VW5pbnN0YWxsRXJyb3InLCBcIkNhbm5vdCB1bmluc3RhbGwgJ3swfScgZXh0ZW5zaW9uIGFsb25lLiAnezF9JyBleHRlbnNpb24gZGVwZW5kcyBvbiB0aGlzLiBEbyB5b3Ugd2FudCB0byB1bmluc3RhbGwgYWxsIHRoZXNlIGV4dGVuc2lvbnM/XCIsIGV4dGVuc2lvbi5kaXNwbGF5TmFtZSwgZGVwZW5kZW50c1swXS5kaXNwbGF5TmFtZSk7XG5cdFx0fVxuXHRcdGlmIChkZXBlbmRlbnRzLmxlbmd0aCA9PT0gMikge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgndHdvRGVwZW5kZW50c1VuaW5zdGFsbEVycm9yJywgXCJDYW5ub3QgdW5pbnN0YWxsICd7MH0nIGV4dGVuc2lvbiBhbG9uZS4gJ3sxfScgYW5kICd7Mn0nIGV4dGVuc2lvbnMgZGVwZW5kIG9uIHRoaXMuIERvIHlvdSB3YW50IHRvIHVuaW5zdGFsbCBhbGwgdGhlc2UgZXh0ZW5zaW9ucz9cIixcblx0XHRcdFx0ZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzBdLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzFdLmRpc3BsYXlOYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnbXVsdGlwbGVEZXBlbmRlbnRzVW5pbnN0YWxsRXJyb3InLCBcIkNhbm5vdCB1bmluc3RhbGwgJ3swfScgZXh0ZW5zaW9uIGFsb25lLiAnezF9JywgJ3syfScgYW5kIG90aGVyIGV4dGVuc2lvbnMgZGVwZW5kIG9uIHRoaXMuIERvIHlvdSB3YW50IHRvIHVuaW5zdGFsbCBhbGwgdGhlc2UgZXh0ZW5zaW9ucz9cIixcblx0XHRcdGV4dGVuc2lvbi5kaXNwbGF5TmFtZSwgZGVwZW5kZW50c1swXS5kaXNwbGF5TmFtZSwgZGVwZW5kZW50c1sxXS5kaXNwbGF5TmFtZSk7XG5cdH1cblxuXHRpc0V4dGVuc2lvbklnbm9yZWRUb1N5bmMoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGV4dGVuc2lvbi5sb2NhbCA/ICF0aGlzLmlzSW5zdGFsbGVkRXh0ZW5zaW9uU3luY2VkKGV4dGVuc2lvbi5sb2NhbClcblx0XHRcdDogdGhpcy5leHRlbnNpb25zU3luY01hbmFnZW1lbnRTZXJ2aWNlLmhhc1RvTmV2ZXJTeW5jRXh0ZW5zaW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0fVxuXG5cdGFzeW5jIHRvZ2dsZVByZVJlbGVhc2UoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFleHRlbnNpb24ubG9jYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5wcmVSZWxlYXNlICE9PSBleHRlbnNpb24uaXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS51cGRhdGVNZXRhZGF0YShleHRlbnNpb24ubG9jYWwsIHsgcHJlUmVsZWFzZTogIWV4dGVuc2lvbi5wcmVSZWxlYXNlIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLmluc3RhbGwoZXh0ZW5zaW9uLCB7IGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogIWV4dGVuc2lvbi5wcmVSZWxlYXNlLCBwcmVSZWxlYXNlOiAhZXh0ZW5zaW9uLnByZVJlbGVhc2UgfSk7XG5cdH1cblxuXHRhc3luYyB0b2dnbGVFeHRlbnNpb25JZ25vcmVkVG9TeW5jKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGlzSWdub3JlZCA9IHRoaXMuaXNFeHRlbnNpb25JZ25vcmVkVG9TeW5jKGV4dGVuc2lvbik7XG5cdFx0aWYgKGV4dGVuc2lvbi5sb2NhbCAmJiBpc0lnbm9yZWQpIHtcblx0XHRcdCg8RXh0ZW5zaW9uPmV4dGVuc2lvbikubG9jYWwgPSBhd2FpdCB0aGlzLnVwZGF0ZVN5bmNocm9uaXppbmdJbnN0YWxsZWRFeHRlbnNpb24oZXh0ZW5zaW9uLmxvY2FsLCB0cnVlKTtcblx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoZXh0ZW5zaW9uKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5leHRlbnNpb25zU3luY01hbmFnZW1lbnRTZXJ2aWNlLnVwZGF0ZUlnbm9yZWRFeHRlbnNpb25zKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCAhaXNJZ25vcmVkKTtcblx0XHR9XG5cdFx0YXdhaXQgdGhpcy51c2VyRGF0YUF1dG9TeW5jU2VydmljZS50cmlnZ2VyU3luYyhbJ0lnbm9yZWRFeHRlbnNpb25zVXBkYXRlZCddKTtcblx0fVxuXG5cdGFzeW5jIHRvZ2dsZUFwcGx5RXh0ZW5zaW9uVG9BbGxQcm9maWxlcyhleHRlbnNpb246IElFeHRlbnNpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIWV4dGVuc2lvbi5sb2NhbCB8fCBpc0FwcGxpY2F0aW9uU2NvcGVkRXh0ZW5zaW9uKGV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkgfHwgZXh0ZW5zaW9uLmlzQnVpbHRpbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpc0FwcGxpY2F0aW9uU2NvcGVkID0gZXh0ZW5zaW9uLmxvY2FsLmlzQXBwbGljYXRpb25TY29wZWQ7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5nZXRBbGxFeHRlbnNpb25zKCkubWFwKGFzeW5jIGV4dGVuc2lvbnMgPT4ge1xuXHRcdFx0Y29uc3QgbG9jYWwgPSBleHRlbnNpb25zLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSk/LmxvY2FsO1xuXHRcdFx0aWYgKGxvY2FsICYmIGxvY2FsLmlzQXBwbGljYXRpb25TY29wZWQgPT09IGlzQXBwbGljYXRpb25TY29wZWQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS50b2dnbGVBcHBsaWF0aW9uU2NvcGUobG9jYWwsIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWxsRXh0ZW5zaW9ucygpOiBFeHRlbnNpb25zW10ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnM6IEV4dGVuc2lvbnNbXSA9IFtdO1xuXHRcdGlmICh0aGlzLmxvY2FsRXh0ZW5zaW9ucykge1xuXHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHRoaXMubG9jYWxFeHRlbnNpb25zKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMucmVtb3RlRXh0ZW5zaW9ucykge1xuXHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHRoaXMucmVtb3RlRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLndlYkV4dGVuc2lvbnMpIHtcblx0XHRcdGV4dGVuc2lvbnMucHVzaCh0aGlzLndlYkV4dGVuc2lvbnMpO1xuXHRcdH1cblx0XHRyZXR1cm4gZXh0ZW5zaW9ucztcblx0fVxuXG5cdHByaXZhdGUgaXNJbnN0YWxsZWRFeHRlbnNpb25TeW5jZWQoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHRpZiAoZXh0ZW5zaW9uLmlzTWFjaGluZVNjb3BlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHRlbnNpb25zU3luY01hbmFnZW1lbnRTZXJ2aWNlLmhhc1RvQWx3YXlzU3luY0V4dGVuc2lvbihleHRlbnNpb24uaWRlbnRpZmllci5pZCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gIXRoaXMuZXh0ZW5zaW9uc1N5bmNNYW5hZ2VtZW50U2VydmljZS5oYXNUb05ldmVyU3luY0V4dGVuc2lvbihleHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVTeW5jaHJvbml6aW5nSW5zdGFsbGVkRXh0ZW5zaW9uKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBzeW5jOiBib29sZWFuKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRjb25zdCBpc01hY2hpbmVTY29wZWQgPSAhc3luYztcblx0XHRpZiAoZXh0ZW5zaW9uLmlzTWFjaGluZVNjb3BlZCAhPT0gaXNNYWNoaW5lU2NvcGVkKSB7XG5cdFx0XHRleHRlbnNpb24gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnVwZGF0ZU1ldGFkYXRhKGV4dGVuc2lvbiwgeyBpc01hY2hpbmVTY29wZWQgfSk7XG5cdFx0fVxuXHRcdGlmIChzeW5jKSB7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNTeW5jTWFuYWdlbWVudFNlcnZpY2UudXBkYXRlSWdub3JlZEV4dGVuc2lvbnMoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIGZhbHNlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0fVxuXG5cdHByaXZhdGUgZG9JbnN0YWxsKGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IHVuZGVmaW5lZCwgaW5zdGFsbFRhc2s6ICgpID0+IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiwgcHJvZ3Jlc3NMb2NhdGlvbj86IFByb2dyZXNzTG9jYXRpb24gfCBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb24+IHtcblx0XHRjb25zdCB0aXRsZSA9IGV4dGVuc2lvbiA/IG5scy5sb2NhbGl6ZSgnaW5zdGFsbGluZyBuYW1lZCBleHRlbnNpb24nLCBcIkluc3RhbGxpbmcgJ3swfScgZXh0ZW5zaW9uLi4uLlwiLCBleHRlbnNpb24uZGlzcGxheU5hbWUpIDogbmxzLmxvY2FsaXplKCdpbnN0YWxsaW5nIGV4dGVuc2lvbicsICdJbnN0YWxsaW5nIGV4dGVuc2lvbi4uLi4nKTtcblx0XHRyZXR1cm4gdGhpcy53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IHByb2dyZXNzTG9jYXRpb24gPz8gUHJvZ3Jlc3NMb2NhdGlvbi5FeHRlbnNpb25zLFxuXHRcdFx0dGl0bGVcblx0XHR9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5pbnN0YWxsaW5nLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKGV4dGVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbG9jYWwgPSBhd2FpdCBpbnN0YWxsVGFzaygpO1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy53YWl0QW5kR2V0SW5zdGFsbGVkRXh0ZW5zaW9uKGxvY2FsLmlkZW50aWZpZXIpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdHRoaXMuaW5zdGFsbGluZyA9IHRoaXMuaW5zdGFsbGluZy5maWx0ZXIoZSA9PiBlICE9PSBleHRlbnNpb24pO1xuXHRcdFx0XHRcdC8vIFRyaWdnZXIgdGhlIGNoYW5nZSB3aXRob3V0IHBhc3NpbmcgdGhlIGV4dGVuc2lvbiBiZWNhdXNlIGl0IGlzIHJlcGxhY2VkIGJ5IGEgbmV3IGluc3RhbmNlLlxuXHRcdFx0XHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbnN0YWxsRnJvbVZTSVgodnNpeDogVVJJLCBpbnN0YWxsT3B0aW9uczogSW5zdGFsbE9wdGlvbnMpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRNYW5pZmVzdCh2c2l4KTtcblx0XHRjb25zdCBleGlzdGluZ0V4dGVuc2lvbiA9IHRoaXMubG9jYWwuZmluZChsb2NhbCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhsb2NhbC5pZGVudGlmaWVyLCB7IGlkOiBnZXRHYWxsZXJ5RXh0ZW5zaW9uSWQobWFuaWZlc3QucHVibGlzaGVyLCBtYW5pZmVzdC5uYW1lKSB9KSk7XG5cdFx0aWYgKGV4aXN0aW5nRXh0ZW5zaW9uKSB7XG5cdFx0XHRpbnN0YWxsT3B0aW9ucyA9IGluc3RhbGxPcHRpb25zIHx8IHt9O1xuXHRcdFx0aWYgKGV4aXN0aW5nRXh0ZW5zaW9uLmxhdGVzdFZlcnNpb24gPT09IG1hbmlmZXN0LnZlcnNpb24pIHtcblx0XHRcdFx0aW5zdGFsbE9wdGlvbnMucGlubmVkID0gZXhpc3RpbmdFeHRlbnNpb24ubG9jYWw/LnBpbm5lZCB8fCAhdGhpcy5zaG91bGRBdXRvVXBkYXRlRXh0ZW5zaW9uKGV4aXN0aW5nRXh0ZW5zaW9uKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluc3RhbGxPcHRpb25zLmluc3RhbGxHaXZlblZlcnNpb24gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsVlNJWCh2c2l4LCBtYW5pZmVzdCwgaW5zdGFsbE9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbnN0YWxsRnJvbUdhbGxlcnkoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBnYWxsZXJ5OiBJR2FsbGVyeUV4dGVuc2lvbiwgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxFeHRlbnNpb25PcHRpb25zLCBzZXJ2ZXJzOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcltdIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRpbnN0YWxsT3B0aW9ucyA9IGluc3RhbGxPcHRpb25zID8/IHt9O1xuXHRcdGluc3RhbGxPcHRpb25zLnBpbm5lZCA9IGV4dGVuc2lvbi5sb2NhbD8ucGlubmVkIHx8ICF0aGlzLnNob3VsZEF1dG9VcGRhdGVFeHRlbnNpb24oZXh0ZW5zaW9uKTtcblx0XHRpZiAoZXh0ZW5zaW9uLmxvY2FsICYmICFzZXJ2ZXJzKSB7XG5cdFx0XHRpbnN0YWxsT3B0aW9ucy5wcm9kdWN0VmVyc2lvbiA9IHRoaXMuZ2V0UHJvZHVjdFZlcnNpb24oKTtcblx0XHRcdGluc3RhbGxPcHRpb25zLm9wZXJhdGlvbiA9IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlO1xuXHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudXBkYXRlRnJvbUdhbGxlcnkoZ2FsbGVyeSwgZXh0ZW5zaW9uLmxvY2FsLCBpbnN0YWxsT3B0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxGcm9tR2FsbGVyeShnYWxsZXJ5LCBpbnN0YWxsT3B0aW9ucywgc2VydmVycyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3YWl0QW5kR2V0SW5zdGFsbGVkRXh0ZW5zaW9uKGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyKTogUHJvbWlzZTxJRXh0ZW5zaW9uPiB7XG5cdFx0bGV0IGluc3RhbGxlZEV4dGVuc2lvbiA9IHRoaXMubG9jYWwuZmluZChsb2NhbCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhsb2NhbC5pZGVudGlmaWVyLCBpZGVudGlmaWVyKSk7XG5cdFx0aWYgKCFpbnN0YWxsZWRFeHRlbnNpb24pIHtcblx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShFdmVudC5maWx0ZXIodGhpcy5vbkNoYW5nZSwgZSA9PiAhIWUgJiYgdGhpcy5sb2NhbC5zb21lKGxvY2FsID0+IGFyZVNhbWVFeHRlbnNpb25zKGxvY2FsLmlkZW50aWZpZXIsIGlkZW50aWZpZXIpKSkpO1xuXHRcdH1cblx0XHRpbnN0YWxsZWRFeHRlbnNpb24gPSB0aGlzLmxvY2FsLmZpbmQobG9jYWwgPT4gYXJlU2FtZUV4dGVuc2lvbnMobG9jYWwuaWRlbnRpZmllciwgaWRlbnRpZmllcikpO1xuXHRcdGlmICghaW5zdGFsbGVkRXh0ZW5zaW9uKSB7XG5cdFx0XHQvLyBUaGlzIHNob3VsZCBub3QgaGFwcGVuXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4dGVuc2lvbiBzaG91bGQgaGF2ZSBiZWVuIGluc3RhbGxlZCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW5zdGFsbGVkRXh0ZW5zaW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3YWl0VW50aWxFeHRlbnNpb25Jc0VuYWJsZWQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLmZpbmQoZSA9PiBFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCFleHRlbnNpb24ubG9jYWwgfHwgIXRoaXMuZXh0ZW5zaW9uU2VydmljZS5jYW5BZGRFeHRlbnNpb24odG9FeHRlbnNpb25EZXNjcmlwdGlvbihleHRlbnNpb24ubG9jYWwpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPigoYywgZSkgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnMoKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maW5kKGUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllci5pZCkpKSB7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdGMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0ZShlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBwcm9tcHRBbmRTZXRFbmFibGVtZW50KGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSwgZW5hYmxlbWVudFN0YXRlOiBFbmFibGVtZW50U3RhdGUpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGVuYWJsZSA9IGVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSB8fCBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlO1xuXHRcdGlmIChlbmFibGUpIHtcblx0XHRcdGNvbnN0IGFsbERlcGVuZGVuY2llc0FuZFBhY2tlZEV4dGVuc2lvbnMgPSB0aGlzLmdldEV4dGVuc2lvbnNSZWN1cnNpdmVseShleHRlbnNpb25zLCB0aGlzLmxvY2FsLCBlbmFibGVtZW50U3RhdGUsIHsgZGVwZW5kZW5jaWVzOiB0cnVlLCBwYWNrOiB0cnVlIH0pO1xuXHRcdFx0cmV0dXJuIHRoaXMuY2hlY2tBbmRTZXRFbmFibGVtZW50KGV4dGVuc2lvbnMsIGFsbERlcGVuZGVuY2llc0FuZFBhY2tlZEV4dGVuc2lvbnMsIGVuYWJsZW1lbnRTdGF0ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHBhY2tlZEV4dGVuc2lvbnMgPSB0aGlzLmdldEV4dGVuc2lvbnNSZWN1cnNpdmVseShleHRlbnNpb25zLCB0aGlzLmxvY2FsLCBlbmFibGVtZW50U3RhdGUsIHsgZGVwZW5kZW5jaWVzOiBmYWxzZSwgcGFjazogdHJ1ZSB9KTtcblx0XHRcdGlmIChwYWNrZWRFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5jaGVja0FuZFNldEVuYWJsZW1lbnQoZXh0ZW5zaW9ucywgcGFja2VkRXh0ZW5zaW9ucywgZW5hYmxlbWVudFN0YXRlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLmNoZWNrQW5kU2V0RW5hYmxlbWVudChleHRlbnNpb25zLCBbXSwgZW5hYmxlbWVudFN0YXRlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNoZWNrQW5kU2V0RW5hYmxlbWVudChleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10sIG90aGVyRXh0ZW5zaW9uczogSUV4dGVuc2lvbltdLCBlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgYWxsRXh0ZW5zaW9ucyA9IFsuLi5leHRlbnNpb25zLCAuLi5vdGhlckV4dGVuc2lvbnNdO1xuXHRcdGNvbnN0IGVuYWJsZSA9IGVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSB8fCBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlO1xuXHRcdGlmICghZW5hYmxlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGRlcGVuZGVudHMgPSB0aGlzLmdldERlcGVuZGVudHNBZnRlckRpc2FibGVtZW50KGV4dGVuc2lvbiwgYWxsRXh0ZW5zaW9ucywgdGhpcy5sb2NhbCk7XG5cdFx0XHRcdGlmIChkZXBlbmRlbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2Rpc2FibGVEZXBlbmRlbnRzJywgXCJEaXNhYmxlIEV4dGVuc2lvbiB3aXRoIERlcGVuZGVudHNcIiksXG5cdFx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogdGhpcy5nZXREZXBlbmRlbnRzRXJyb3JNZXNzYWdlRm9yRGlzYWJsZW1lbnQoZXh0ZW5zaW9uLCBhbGxFeHRlbnNpb25zLCBkZXBlbmRlbnRzKSxcblx0XHRcdFx0XHRcdGJ1dHRvbnM6IFt7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2Rpc2FibGUgYWxsJywgJ0Rpc2FibGUgQWxsJyksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdHJ1ZVxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBmYWxzZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jaGVja0FuZFNldEVuYWJsZW1lbnQoZGVwZW5kZW50cywgW2V4dGVuc2lvbl0sIGVuYWJsZW1lbnRTdGF0ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZG9TZXRFbmFibGVtZW50KGFsbEV4dGVuc2lvbnMsIGVuYWJsZW1lbnRTdGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEV4dGVuc2lvbnNSZWN1cnNpdmVseShleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10sIGluc3RhbGxlZDogSUV4dGVuc2lvbltdLCBlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSwgb3B0aW9uczogeyBkZXBlbmRlbmNpZXM6IGJvb2xlYW47IHBhY2s6IGJvb2xlYW4gfSwgY2hlY2tlZDogSUV4dGVuc2lvbltdID0gW10pOiBJRXh0ZW5zaW9uW10ge1xuXHRcdGNvbnN0IHRvQ2hlY2sgPSBleHRlbnNpb25zLmZpbHRlcihlID0+IGNoZWNrZWQuaW5kZXhPZihlKSA9PT0gLTEpO1xuXHRcdGlmICh0b0NoZWNrLmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgdG9DaGVjaykge1xuXHRcdFx0XHRjaGVja2VkLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNUb0VhbmJsZU9yRGlzYWJsZSA9IGluc3RhbGxlZC5maWx0ZXIoaSA9PiB7XG5cdFx0XHRcdGlmIChjaGVja2VkLmluZGV4T2YoaSkgIT09IC0xKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGVuYWJsZSA9IGVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSB8fCBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlO1xuXHRcdFx0XHRjb25zdCBpc0V4dGVuc2lvbkVuYWJsZWQgPSBpLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSB8fCBpLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRXb3Jrc3BhY2U7XG5cdFx0XHRcdGlmIChlbmFibGUgPT09IGlzRXh0ZW5zaW9uRW5hYmxlZCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gKGVuYWJsZSB8fCAhaS5pc0J1aWx0aW4pIC8vIEluY2x1ZGUgYWxsIEV4dGVuc2lvbnMgZm9yIGVuYWJsZW1lbnQgYW5kIG9ubHkgbm9uIGJ1aWx0aW4gZXh0ZW5zaW9ucyBmb3IgZGlzYWJsZW1lbnRcblx0XHRcdFx0XHQmJiAob3B0aW9ucy5kZXBlbmRlbmNpZXMgfHwgb3B0aW9ucy5wYWNrKVxuXHRcdFx0XHRcdCYmIGV4dGVuc2lvbnMuc29tZShleHRlbnNpb24gPT5cblx0XHRcdFx0XHRcdChvcHRpb25zLmRlcGVuZGVuY2llcyAmJiBleHRlbnNpb24uZGVwZW5kZW5jaWVzLnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBpLmlkZW50aWZpZXIpKSlcblx0XHRcdFx0XHRcdHx8IChvcHRpb25zLnBhY2sgJiYgZXh0ZW5zaW9uLmV4dGVuc2lvblBhY2suc29tZShpZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkIH0sIGkuaWRlbnRpZmllcikpKVxuXHRcdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdGlmIChleHRlbnNpb25zVG9FYW5ibGVPckRpc2FibGUubGVuZ3RoKSB7XG5cdFx0XHRcdGV4dGVuc2lvbnNUb0VhbmJsZU9yRGlzYWJsZS5wdXNoKC4uLnRoaXMuZ2V0RXh0ZW5zaW9uc1JlY3Vyc2l2ZWx5KGV4dGVuc2lvbnNUb0VhbmJsZU9yRGlzYWJsZSwgaW5zdGFsbGVkLCBlbmFibGVtZW50U3RhdGUsIG9wdGlvbnMsIGNoZWNrZWQpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBleHRlbnNpb25zVG9FYW5ibGVPckRpc2FibGU7XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVwZW5kZW50c0FmdGVyRGlzYWJsZW1lbnQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBleHRlbnNpb25zVG9EaXNhYmxlOiBJRXh0ZW5zaW9uW10sIGluc3RhbGxlZDogSUV4dGVuc2lvbltdKTogSUV4dGVuc2lvbltdIHtcblx0XHRyZXR1cm4gaW5zdGFsbGVkLmZpbHRlcihpID0+IHtcblx0XHRcdGlmIChpLmRlcGVuZGVuY2llcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGkgPT09IGV4dGVuc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkRW5hYmxlbWVudFN0YXRlKGkuZW5hYmxlbWVudFN0YXRlKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9uc1RvRGlzYWJsZS5pbmRleE9mKGkpICE9PSAtMSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gaS5kZXBlbmRlbmNpZXMuc29tZShkZXAgPT4gW2V4dGVuc2lvbiwgLi4uZXh0ZW5zaW9uc1RvRGlzYWJsZV0uc29tZShkID0+IGFyZVNhbWVFeHRlbnNpb25zKGQuaWRlbnRpZmllciwgeyBpZDogZGVwIH0pKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldERlcGVuZGVudHNFcnJvck1lc3NhZ2VGb3JEaXNhYmxlbWVudChleHRlbnNpb246IElFeHRlbnNpb24sIGFsbERpc2FibGVkRXh0ZW5zaW9uczogSUV4dGVuc2lvbltdLCBkZXBlbmRlbnRzOiBJRXh0ZW5zaW9uW10pOiBzdHJpbmcge1xuXHRcdGZvciAoY29uc3QgZSBvZiBbZXh0ZW5zaW9uLCAuLi5hbGxEaXNhYmxlZEV4dGVuc2lvbnNdKSB7XG5cdFx0XHRjb25zdCBkZXBlbmRlbnRzT2ZUaGVFeHRlbnNpb24gPSBkZXBlbmRlbnRzLmZpbHRlcihkID0+IGQuZGVwZW5kZW5jaWVzLnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBlLmlkZW50aWZpZXIpKSk7XG5cdFx0XHRpZiAoZGVwZW5kZW50c09mVGhlRXh0ZW5zaW9uLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRFcnJvck1lc3NhZ2VGb3JEaXNhYmxpbmdBbkV4dGVuc2lvbldpdGhEZXBlbmRlbnRzKGUsIGRlcGVuZGVudHNPZlRoZUV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXJyb3JNZXNzYWdlRm9yRGlzYWJsaW5nQW5FeHRlbnNpb25XaXRoRGVwZW5kZW50cyhleHRlbnNpb246IElFeHRlbnNpb24sIGRlcGVuZGVudHM6IElFeHRlbnNpb25bXSk6IHN0cmluZyB7XG5cdFx0aWYgKGRlcGVuZGVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzaW5nbGVEZXBlbmRlbnRFcnJvcicsIFwiQ2Fubm90IGRpc2FibGUgJ3swfScgZXh0ZW5zaW9uIGFsb25lLiAnezF9JyBleHRlbnNpb24gZGVwZW5kcyBvbiB0aGlzLiBEbyB5b3Ugd2FudCB0byBkaXNhYmxlIGFsbCB0aGVzZSBleHRlbnNpb25zP1wiLCBleHRlbnNpb24uZGlzcGxheU5hbWUsIGRlcGVuZGVudHNbMF0uZGlzcGxheU5hbWUpO1xuXHRcdH1cblx0XHRpZiAoZGVwZW5kZW50cy5sZW5ndGggPT09IDIpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3R3b0RlcGVuZGVudHNFcnJvcicsIFwiQ2Fubm90IGRpc2FibGUgJ3swfScgZXh0ZW5zaW9uIGFsb25lLiAnezF9JyBhbmQgJ3syfScgZXh0ZW5zaW9ucyBkZXBlbmQgb24gdGhpcy4gRG8geW91IHdhbnQgdG8gZGlzYWJsZSBhbGwgdGhlc2UgZXh0ZW5zaW9ucz9cIixcblx0XHRcdFx0ZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzBdLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzFdLmRpc3BsYXlOYW1lKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnbXVsdGlwbGVEZXBlbmRlbnRzRXJyb3InLCBcIkNhbm5vdCBkaXNhYmxlICd7MH0nIGV4dGVuc2lvbiBhbG9uZS4gJ3sxfScsICd7Mn0nIGFuZCBvdGhlciBleHRlbnNpb25zIGRlcGVuZCBvbiB0aGlzLiBEbyB5b3Ugd2FudCB0byBkaXNhYmxlIGFsbCB0aGVzZSBleHRlbnNpb25zP1wiLFxuXHRcdFx0ZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzBdLmRpc3BsYXlOYW1lLCBkZXBlbmRlbnRzWzFdLmRpc3BsYXlOYW1lKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TZXRFbmFibGVtZW50KGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSwgZW5hYmxlbWVudFN0YXRlOiBFbmFibGVtZW50U3RhdGUpOiBQcm9taXNlPGJvb2xlYW5bXT4ge1xuXHRcdHJldHVybiBhd2FpdCB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLnNldEVuYWJsZW1lbnQoZXh0ZW5zaW9ucy5tYXAoZSA9PiBlLmxvY2FsISksIGVuYWJsZW1lbnRTdGF0ZSk7XG5cdH1cblxuXHQvLyBDdXJyZW50IHNlcnZpY2UgcmVwb3J0cyBwcm9ncmVzcyB3aGVuIGluc3RhbGxpbmcvdW5pbnN0YWxsaW5nIGV4dGVuc2lvbnNcblx0Ly8gVGhpcyBpcyB0byByZXBvcnQgcHJvZ3Jlc3MgZm9yIG90aGVyIHNvdXJjZXMgb2YgZXh0ZW5zaW9uIGluc3RhbGwvdW5pbnN0YWxsIGNoYW5nZXNcblx0Ly8gU2luY2Ugd2UgY2Fubm90IGRpZmZlcmVudGlhdGUgYmV0d2VlbiB0aGUgdHdvLCB3ZSByZXBvcnQgcHJvZ3Jlc3MgZm9yIGFsbCBleHRlbnNpb24gaW5zdGFsbC91bmluc3RhbGwgY2hhbmdlc1xuXHRwcml2YXRlIF9hY3Rpdml0eUNhbGxCYWNrOiAoKHZhbHVlOiB2b2lkKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXBvcnRQcm9ncmVzc0Zyb21PdGhlclNvdXJjZXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaW5zdGFsbGVkLnNvbWUoZSA9PiBlLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsaW5nIHx8IGUuc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGluZykpIHtcblx0XHRcdGlmICghdGhpcy5fYWN0aXZpdHlDYWxsQmFjaykge1xuXHRcdFx0XHR0aGlzLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLkV4dGVuc2lvbnMgfSwgKCkgPT4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB0aGlzLl9hY3Rpdml0eUNhbGxCYWNrID0gcmVzb2x2ZSkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hY3Rpdml0eUNhbGxCYWNrPy4oKTtcblx0XHRcdHRoaXMuX2FjdGl2aXR5Q2FsbEJhY2sgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB3aXRoUHJvZ3Jlc3M8VD4ob3B0aW9uczogSVByb2dyZXNzT3B0aW9ucywgdGFzazogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Mob3B0aW9ucywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FuY2VsYWJsZVRhc2sgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSgoKSA9PiB0YXNrKCkpO1xuXHRcdFx0dGhpcy50YXNrc0luUHJvZ3Jlc3MucHVzaChjYW5jZWxhYmxlVGFzayk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgY2FuY2VsYWJsZVRhc2s7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMudGFza3NJblByb2dyZXNzLmluZGV4T2YoY2FuY2VsYWJsZVRhc2spO1xuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdFx0dGhpcy50YXNrc0luUHJvZ3Jlc3Muc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVycm9yKGVycjogYW55KTogdm9pZCB7XG5cdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBlcnIgJiYgZXJyLm1lc3NhZ2UgfHwgJyc7XG5cblx0XHRpZiAoL2dldGFkZHJpbmZvIEVOT1RGT1VORHxnZXRhZGRyaW5mbyBFTk9FTlR8Y29ubmVjdCBFQUNDRVN8Y29ubmVjdCBFQ09OTlJFRlVTRUQvLnRlc3QobWVzc2FnZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UuZXJyb3IoZXJyKTtcblx0fVxuXG5cdGhhbmRsZVVSTCh1cmk6IFVSSSwgb3B0aW9ucz86IElPcGVuVVJMT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghL15leHRlbnNpb24vLnRlc3QodXJpLnBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHR9XG5cblx0XHR0aGlzLm9uT3BlbkV4dGVuc2lvblVybCh1cmkpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uT3BlbkV4dGVuc2lvblVybCh1cmk6IFVSSSk6IHZvaWQge1xuXHRcdGNvbnN0IG1hdGNoID0gL15leHRlbnNpb25cXC8oW14vXSspJC8uZXhlYyh1cmkucGF0aCk7XG5cblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uSWQgPSBtYXRjaFsxXTtcblxuXHRcdHRoaXMucXVlcnlMb2NhbCgpLnRoZW4oYXN5bmMgbG9jYWwgPT4ge1xuXHRcdFx0bGV0IGV4dGVuc2lvbiA9IGxvY2FsLmZpbmQobG9jYWwgPT4gYXJlU2FtZUV4dGVuc2lvbnMobG9jYWwuaWRlbnRpZmllciwgeyBpZDogZXh0ZW5zaW9uSWQgfSkpO1xuXHRcdFx0aWYgKCFleHRlbnNpb24pIHtcblx0XHRcdFx0W2V4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGV4dGVuc2lvbklkIH1dLCB7IHNvdXJjZTogJ3VyaScgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuaG9zdFNlcnZpY2UuZm9jdXMobWFpbldpbmRvdyk7XG5cdFx0XHRcdGF3YWl0IHRoaXMub3BlbihleHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH0pLnRoZW4odW5kZWZpbmVkLCBlcnJvciA9PiB0aGlzLm9uRXJyb3IoZXJyb3IpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHVibGlzaGVyc1RvQXV0b1VwZGF0ZSgpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0RW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKCkuZmlsdGVyKGlkID0+ICFFWFRFTlNJT05fSURFTlRJRklFUl9SRUdFWC50ZXN0KGlkKSk7XG5cdH1cblxuXHRnZXRFbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMoKTogc3RyaW5nW10ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWRWYWx1ZSA9IEpTT04ucGFyc2UodGhpcy5lbmFibGVkQXVvdFVwZGF0ZUV4dGVuc2lvbnNWYWx1ZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYXJzZWRWYWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnNlZFZhbHVlO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHsgLyogSWdub3JlICovIH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIHNldEVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyhlbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkQXVvdFVwZGF0ZUV4dGVuc2lvbnNWYWx1ZSA9IEpTT04uc3RyaW5naWZ5KGVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF9lbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBlbmFibGVkQXVvdFVwZGF0ZUV4dGVuc2lvbnNWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5fZW5hYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUpIHtcblx0XHRcdHRoaXMuX2VuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlID0gdGhpcy5nZXRFbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9lbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgc2V0IGVuYWJsZWRBdW90VXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKGVuYWJsZWRBdW90VXBkYXRlRXh0ZW5zaW9uc1ZhbHVlOiBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5lbmFibGVkQXVvdFVwZGF0ZUV4dGVuc2lvbnNWYWx1ZSAhPT0gZW5hYmxlZEF1b3RVcGRhdGVFeHRlbnNpb25zVmFsdWUpIHtcblx0XHRcdHRoaXMuX2VuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlID0gZW5hYmxlZEF1b3RVcGRhdGVFeHRlbnNpb25zVmFsdWU7XG5cdFx0XHR0aGlzLnNldEVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKGVuYWJsZWRBdW90VXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEVuYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KEVYVEVOU0lPTlNfQVVUT19VUERBVEVfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sICdbXScpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRFbmFibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFWFRFTlNJT05TX0FVVE9fVVBEQVRFX0tFWSwgdmFsdWUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdGdldERpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnMoKTogc3RyaW5nW10ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXJzZWRWYWx1ZSA9IEpTT04ucGFyc2UodGhpcy5kaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUpO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocGFyc2VkVmFsdWUpKSB7XG5cdFx0XHRcdHJldHVybiBwYXJzZWRWYWx1ZTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7IC8qIElnbm9yZSAqLyB9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXREaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUgPSBKU09OLnN0cmluZ2lmeShkaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBkaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMuX2Rpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSkge1xuXHRcdFx0dGhpcy5fZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlID0gdGhpcy5nZXREaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZTogc3RyaW5nKSB7XG5cdFx0aWYgKHRoaXMuZGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlICE9PSBkaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUpIHtcblx0XHRcdHRoaXMuX2Rpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSA9IGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZTtcblx0XHRcdHRoaXMuc2V0RGlzYWJsZWRBdXRvVXBkYXRlRXh0ZW5zaW9uc1ZhbHVlKGRpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXREaXNhYmxlZEF1dG9VcGRhdGVFeHRlbnNpb25zVmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoRVhURU5TSU9OU19ET05PVF9BVVRPX1VQREFURV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgJ1tdJyk7XG5cdH1cblxuXHRwcml2YXRlIHNldERpc2FibGVkQXV0b1VwZGF0ZUV4dGVuc2lvbnNWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShFWFRFTlNJT05TX0RPTk9UX0FVVE9fVVBEQVRFX0tFWSwgdmFsdWUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGlzbWlzc2VkTm90aWZpY2F0aW9ucygpOiBzdHJpbmdbXSB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcnNlZFZhbHVlID0gSlNPTi5wYXJzZSh0aGlzLmRpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYXJzZWRWYWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnNlZFZhbHVlO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHsgLyogSWdub3JlICovIH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIHNldERpc21pc3NlZE5vdGlmaWNhdGlvbnMoZGlzbWlzc2VkTm90aWZpY2F0aW9uczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLmRpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSA9IEpTT04uc3RyaW5naWZ5KGRpc21pc3NlZE5vdGlmaWNhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IGRpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdGlmICghdGhpcy5fZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlKSB7XG5cdFx0XHR0aGlzLl9kaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWUgPSB0aGlzLmdldERpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9kaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIHNldCBkaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWUoZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlOiBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5kaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWUgIT09IGRpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSkge1xuXHRcdFx0dGhpcy5fZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlID0gZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlO1xuXHRcdFx0dGhpcy5zZXREaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWUoZGlzbWlzc2VkTm90aWZpY2F0aW9uc1ZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldERpc21pc3NlZE5vdGlmaWNhdGlvbnNWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChFWFRFTlNJT05TX0RJU01JU1NFRF9OT1RJRklDQVRJT05TX0tFWSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdbXScpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXREaXNtaXNzZWROb3RpZmljYXRpb25zVmFsdWUodmFsdWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoRVhURU5TSU9OU19ESVNNSVNTRURfTk9USUZJQ0FUSU9OU19LRVksIHZhbHVlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFlBQVk7QUFDeEIsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBUyxhQUFhO0FBQ3RCLFNBQTRCLFVBQVUsa0JBQWtCLCtCQUErQjtBQUN2RixTQUFTLG1CQUFtQiwyQkFBMkI7QUFDdkQsU0FBUyxZQUFZLG1CQUFtQixvQkFBb0I7QUFDNUQsU0FBaUIsdUJBQXVCO0FBQ3hDLFNBQVMseUJBQXlCO0FBQ2xDO0FBQUEsRUFDQztBQUFBLEVBQ21EO0FBQUEsRUFBa0I7QUFBQSxFQUNpQjtBQUFBLEVBQWtEO0FBQUEsRUFHeEk7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BQ007QUFDUCxTQUFTLHNDQUFzQyxpQkFBaUIsbUNBQStELHNDQUFzQyx1QkFBMkM7QUFDaE4sU0FBUyxrQ0FBa0MsZ0NBQWdDLG1CQUFtQixrQkFBa0IsdUJBQXVCLG1CQUFtQjtBQUMxSixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVc7QUFDcEIsU0FBcUIsZ0JBQTZD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
