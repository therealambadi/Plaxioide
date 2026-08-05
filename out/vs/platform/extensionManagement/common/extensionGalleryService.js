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
import { distinct } from "../../../base/common/arrays.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { CancellationError, getErrorMessage, isCancellationError } from "../../../base/common/errors.js";
import { isWeb, platform } from "../../../base/common/platform.js";
import { arch } from "../../../base/common/process.js";
import { isBoolean, isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { isOfflineError } from "../../../base/parts/request/common/request.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { getTargetPlatform, InstallOperation, isNotWebExtensionInWebTargetPlatform, isTargetPlatformCompatible, SortOrder, StatisticType, toTargetPlatform, WEB_EXTENSION_TAG, ExtensionGalleryError, ExtensionGalleryErrorCode, UseUnpkgResourceApiConfigKey, IAllowedExtensionsService, EXTENSION_IDENTIFIER_REGEX, SortBy, FilterType } from "./extensionManagement.js";
import { adoptToGalleryExtensionId, areSameExtensions, getGalleryExtensionId, getGalleryExtensionTelemetryData } from "./extensionManagementUtil.js";
import { TargetPlatform } from "../../extensions/common/extensions.js";
import { areApiProposalsCompatible, isEngineValid } from "../../extensions/common/extensionValidator.js";
import { IFileService } from "../../files/common/files.js";
import { ILogService } from "../../log/common/log.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, asTextOrError, IRequestService, isSuccess } from "../../request/common/request.js";
import { resolveMarketplaceHeaders } from "../../externalServices/common/marketplace.js";
import { IStorageService } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { format2 } from "../../../base/common/strings.js";
import { ExtensionGalleryResourceType, Flag, getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from "./extensionGalleryManifest.js";
const CURRENT_TARGET_PLATFORM = isWeb ? TargetPlatform.WEB : getTargetPlatform(platform, arch);
const SEARCH_ACTIVITY_HEADER_NAME = "X-Market-Search-Activity-Id";
const ACTIVITY_HEADER_NAME = "Activityid";
const SERVER_HEADER_NAME = "Server";
const END_END_ID_HEADER_NAME = "X-Vss-E2eid";
const AssetType = {
  Icon: "Microsoft.VisualStudio.Services.Icons.Default",
  Details: "Microsoft.VisualStudio.Services.Content.Details",
  Changelog: "Microsoft.VisualStudio.Services.Content.Changelog",
  Manifest: "Microsoft.VisualStudio.Code.Manifest",
  VSIX: "Microsoft.VisualStudio.Services.VSIXPackage",
  License: "Microsoft.VisualStudio.Services.Content.License",
  Repository: "Microsoft.VisualStudio.Services.Links.Source",
  Signature: "Microsoft.VisualStudio.Services.VsixSignature"
};
const PropertyType = {
  Dependency: "Microsoft.VisualStudio.Code.ExtensionDependencies",
  ExtensionPack: "Microsoft.VisualStudio.Code.ExtensionPack",
  Engine: "Microsoft.VisualStudio.Code.Engine",
  PreRelease: "Microsoft.VisualStudio.Code.PreRelease",
  EnabledApiProposals: "Microsoft.VisualStudio.Code.EnabledApiProposals",
  LocalizedLanguages: "Microsoft.VisualStudio.Code.LocalizedLanguages",
  WebExtension: "Microsoft.VisualStudio.Code.WebExtension",
  SponsorLink: "Microsoft.VisualStudio.Code.SponsorLink",
  SupportLink: "Microsoft.VisualStudio.Services.Links.Support",
  ExecutesCode: "Microsoft.VisualStudio.Code.ExecutesCode",
  Private: "PrivateMarketplace"
};
const DefaultPageSize = 10;
const DefaultQueryState = {
  pageNumber: 1,
  pageSize: DefaultPageSize,
  sortBy: SortBy.NoneOrRelevance,
  sortOrder: SortOrder.Default,
  flags: [],
  criteria: [],
  assetTypes: []
};
var VersionKind = /* @__PURE__ */ ((VersionKind2) => {
  VersionKind2[VersionKind2["Release"] = 0] = "Release";
  VersionKind2[VersionKind2["Prerelease"] = 1] = "Prerelease";
  VersionKind2[VersionKind2["Latest"] = 2] = "Latest";
  return VersionKind2;
})(VersionKind || {});
class Query {
  constructor(state = DefaultQueryState) {
    this.state = state;
  }
  get pageNumber() {
    return this.state.pageNumber;
  }
  get pageSize() {
    return this.state.pageSize;
  }
  get sortBy() {
    return this.state.sortBy;
  }
  get sortOrder() {
    return this.state.sortOrder;
  }
  get flags() {
    return this.state.flags;
  }
  get criteria() {
    return this.state.criteria;
  }
  get assetTypes() {
    return this.state.assetTypes;
  }
  get source() {
    return this.state.source;
  }
  get searchText() {
    const criterium = this.state.criteria.filter((criterium2) => criterium2.filterType === FilterType.SearchText)[0];
    return criterium && criterium.value ? criterium.value : "";
  }
  withPage(pageNumber, pageSize = this.state.pageSize) {
    return new Query({ ...this.state, pageNumber, pageSize });
  }
  withFilter(filterType, ...values) {
    const criteria = [
      ...this.state.criteria,
      ...values.length ? values.map((value) => ({ filterType, value })) : [{ filterType }]
    ];
    return new Query({ ...this.state, criteria });
  }
  withSortBy(sortBy) {
    return new Query({ ...this.state, sortBy });
  }
  withSortOrder(sortOrder) {
    return new Query({ ...this.state, sortOrder });
  }
  withFlags(...flags) {
    return new Query({ ...this.state, flags: distinct(flags) });
  }
  withAssetTypes(...assetTypes) {
    return new Query({ ...this.state, assetTypes });
  }
  withSource(source) {
    return new Query({ ...this.state, source });
  }
}
function getStatistic(statistics, name) {
  const result = (statistics || []).filter((s) => s.statisticName === name)[0];
  return result ? result.value : 0;
}
function getCoreTranslationAssets(version) {
  const coreTranslationAssetPrefix = "Microsoft.VisualStudio.Code.Translation.";
  const result = version.files.filter((f) => f.assetType.indexOf(coreTranslationAssetPrefix) === 0);
  return result.reduce((result2, file) => {
    const asset = getVersionAsset(version, file.assetType);
    if (asset) {
      result2.push([file.assetType.substring(coreTranslationAssetPrefix.length), asset]);
    }
    return result2;
  }, []);
}
function getRepositoryAsset(version) {
  if (version.properties) {
    const results = version.properties.filter((p) => p.key === AssetType.Repository);
    const gitRegExp = new RegExp("((git|ssh|http(s)?)|(git@[\\w.]+))(:(//)?)([\\w.@:/\\-~]+)(.git)(/)?");
    const uri = results.filter((r) => gitRegExp.test(r.value))[0];
    return uri ? { uri: uri.value, fallbackUri: uri.value } : null;
  }
  return getVersionAsset(version, AssetType.Repository);
}
function getDownloadAsset(version) {
  return {
    // always use fallbackAssetUri for download asset to hit the Marketplace API so that downloads are counted
    uri: `${version.fallbackAssetUri}/${AssetType.VSIX}?redirect=true${version.targetPlatform ? `&targetPlatform=${version.targetPlatform}` : ""}`,
    fallbackUri: `${version.fallbackAssetUri}/${AssetType.VSIX}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`
  };
}
function getVersionAsset(version, type) {
  const result = version.files.filter((f) => f.assetType === type)[0];
  return result ? {
    uri: `${version.assetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`,
    fallbackUri: `${version.fallbackAssetUri}/${type}${version.targetPlatform ? `?targetPlatform=${version.targetPlatform}` : ""}`
  } : null;
}
function getExtensions(version, property) {
  const values = version.properties ? version.properties.filter((p) => p.key === property) : [];
  const value = values.length > 0 && values[0].value;
  return value ? value.split(",").map((v) => adoptToGalleryExtensionId(v)) : [];
}
function getEngine(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.Engine) : [];
  return values.length > 0 && values[0].value || "";
}
function isPreReleaseVersion(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.PreRelease) : [];
  return values.length > 0 && values[0].value === "true";
}
function isPrivateExtension(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.Private) : [];
  return values.length > 0 && values[0].value === "true";
}
function executesCode(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.ExecutesCode) : [];
  return values.length > 0 ? values[0].value === "true" : void 0;
}
function getEnabledApiProposals(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.EnabledApiProposals) : [];
  const value = values.length > 0 && values[0].value || "";
  return value ? value.split(",") : [];
}
function getLocalizedLanguages(version) {
  const values = version.properties ? version.properties.filter((p) => p.key === PropertyType.LocalizedLanguages) : [];
  const value = values.length > 0 && values[0].value || "";
  return value ? value.split(",") : [];
}
function getSponsorLink(version) {
  return version.properties?.find((p) => p.key === PropertyType.SponsorLink)?.value;
}
function getSupportLink(version) {
  return version.properties?.find((p) => p.key === PropertyType.SupportLink)?.value;
}
function getIsPreview(flags) {
  return flags.indexOf("preview") !== -1;
}
function getTargetPlatformForExtensionVersion(version) {
  return version.targetPlatform ? toTargetPlatform(version.targetPlatform) : TargetPlatform.UNDEFINED;
}
function getAllTargetPlatforms(rawGalleryExtension) {
  const allTargetPlatforms = distinct(rawGalleryExtension.versions.map(getTargetPlatformForExtensionVersion));
  const isWebExtension = !!rawGalleryExtension.tags?.includes(WEB_EXTENSION_TAG);
  const webTargetPlatformIndex = allTargetPlatforms.indexOf(TargetPlatform.WEB);
  if (isWebExtension) {
    if (webTargetPlatformIndex === -1) {
      allTargetPlatforms.push(TargetPlatform.WEB);
    }
  } else {
    if (webTargetPlatformIndex !== -1) {
      allTargetPlatforms.splice(webTargetPlatformIndex, 1);
    }
  }
  return allTargetPlatforms;
}
function sortExtensionVersions(versions, preferredTargetPlatform) {
  for (let index = 0; index < versions.length; index++) {
    const version = versions[index];
    if (version.version === versions[index - 1]?.version) {
      let insertionIndex = index;
      const versionTargetPlatform = getTargetPlatformForExtensionVersion(version);
      if (versionTargetPlatform === preferredTargetPlatform) {
        while (insertionIndex > 0 && versions[insertionIndex - 1].version === version.version) {
          insertionIndex--;
        }
      }
      if (insertionIndex !== index) {
        versions.splice(index, 1);
        versions.splice(insertionIndex, 0, version);
      }
    }
  }
  return versions;
}
function setTelemetry(extension, index, querySource) {
  extension.telemetryData = { index, querySource, queryActivityId: extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME] };
}
function toExtension(galleryExtension, version, allTargetPlatforms, extensionGalleryManifest, queryContext) {
  const latestVersion = galleryExtension.versions[0];
  const assets = {
    manifest: getVersionAsset(version, AssetType.Manifest),
    readme: getVersionAsset(version, AssetType.Details),
    changelog: getVersionAsset(version, AssetType.Changelog),
    license: getVersionAsset(version, AssetType.License),
    repository: getRepositoryAsset(version),
    download: getDownloadAsset(version),
    icon: getVersionAsset(version, AssetType.Icon),
    signature: getVersionAsset(version, AssetType.Signature),
    coreTranslations: getCoreTranslationAssets(version)
  };
  const detailsViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionDetailsViewUri);
  const publisherViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.PublisherViewUri);
  const ratingViewUri = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionRatingViewUri);
  return {
    type: "gallery",
    identifier: {
      id: getGalleryExtensionId(galleryExtension.publisher.publisherName, galleryExtension.extensionName),
      uuid: galleryExtension.extensionId
    },
    name: galleryExtension.extensionName,
    version: version.version,
    displayName: galleryExtension.displayName,
    publisherId: galleryExtension.publisher.publisherId,
    publisher: galleryExtension.publisher.publisherName,
    publisherDisplayName: galleryExtension.publisher.displayName,
    publisherDomain: galleryExtension.publisher.domain ? { link: galleryExtension.publisher.domain, verified: !!galleryExtension.publisher.isDomainVerified } : void 0,
    publisherSponsorLink: getSponsorLink(latestVersion),
    description: galleryExtension.shortDescription ?? "",
    installCount: getStatistic(galleryExtension.statistics, "install"),
    rating: getStatistic(galleryExtension.statistics, "averagerating"),
    ratingCount: getStatistic(galleryExtension.statistics, "ratingcount"),
    categories: galleryExtension.categories || [],
    tags: galleryExtension.tags || [],
    releaseDate: Date.parse(galleryExtension.releaseDate),
    lastUpdated: Date.parse(galleryExtension.lastUpdated),
    allTargetPlatforms,
    assets,
    properties: {
      dependencies: getExtensions(version, PropertyType.Dependency),
      extensionPack: getExtensions(version, PropertyType.ExtensionPack),
      engine: getEngine(version),
      enabledApiProposals: getEnabledApiProposals(version),
      localizedLanguages: getLocalizedLanguages(version),
      targetPlatform: getTargetPlatformForExtensionVersion(version),
      isPreReleaseVersion: isPreReleaseVersion(version),
      executesCode: executesCode(version)
    },
    hasPreReleaseVersion: isPreReleaseVersion(latestVersion),
    hasReleaseVersion: true,
    private: isPrivateExtension(latestVersion),
    preview: getIsPreview(galleryExtension.flags),
    isSigned: !!assets.signature,
    queryContext,
    supportLink: getSupportLink(latestVersion),
    detailsLink: detailsViewUri ? format2(detailsViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : void 0,
    publisherLink: publisherViewUri ? format2(publisherViewUri, { publisher: galleryExtension.publisher.publisherName }) : void 0,
    ratingLink: ratingViewUri ? format2(ratingViewUri, { publisher: galleryExtension.publisher.publisherName, name: galleryExtension.extensionName }) : void 0
  };
}
let AbstractExtensionGalleryService = class {
  constructor(storageService, assignmentService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    this.assignmentService = assignmentService;
    this.requestService = requestService;
    this.logService = logService;
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.fileService = fileService;
    this.productService = productService;
    this.configurationService = configurationService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.extensionsControlUrl = productService.extensionsGallery?.controlUrl;
    this.unpkgResourceApi = productService.extensionsGallery?.extensionUrlTemplate;
    this.extensionsEnabledWithApiProposalVersion = productService.extensionsEnabledWithApiProposalVersion?.map((id) => id.toLowerCase()) ?? [];
    this.commonHeadersPromise = resolveMarketplaceHeaders(
      productService.version,
      productService,
      this.environmentService,
      this.configurationService,
      this.fileService,
      storageService,
      this.telemetryService
    );
  }
  isEnabled() {
    return this.extensionGalleryManifestService.isEnabled();
  }
  async getExtensions(extensionInfos, arg1, arg2) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    const options = CancellationToken.isCancellationToken(arg1) ? {} : arg1;
    const token = CancellationToken.isCancellationToken(arg1) ? arg1 : arg2;
    const resourceApi = options.preferResourceApi && (this.configurationService.getValue(UseUnpkgResourceApiConfigKey) ?? false) ? await this.getResourceApi(extensionGalleryManifest) : void 0;
    const result = resourceApi ? await this.getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token) : await this.getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token);
    const uuids = result.map((r) => r.identifier.uuid);
    const extensionInfosByName = [];
    for (const e of extensionInfos) {
      if (e.uuid && !uuids.includes(e.uuid)) {
        extensionInfosByName.push({ ...e, uuid: void 0 });
      }
    }
    if (extensionInfosByName.length) {
      this.telemetryService.publicLog2("galleryService:additionalQueryByName", {
        count: extensionInfosByName.length
      });
      const extensions = await this.getExtensionsUsingQueryApi(extensionInfosByName, options, extensionGalleryManifest, token);
      result.push(...extensions);
    }
    return result;
  }
  async getResourceApi(extensionGalleryManifest) {
    const latestVersionResource = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionLatestVersionUri);
    if (!latestVersionResource) {
      return void 0;
    }
    if (this.productService.quality !== "stable") {
      return {
        uri: latestVersionResource,
        fallback: this.unpkgResourceApi
      };
    }
    const value = await this.assignmentService?.getTreatment("extensions.gallery.useResourceApi") ?? "unpkg";
    if (value === "marketplace") {
      return {
        uri: latestVersionResource,
        fallback: this.unpkgResourceApi
      };
    }
    if (value === "unpkg" && this.unpkgResourceApi) {
      return { uri: this.unpkgResourceApi };
    }
    return void 0;
  }
  async getExtensionsUsingQueryApi(extensionInfos, options, extensionGalleryManifest, token) {
    const names = [], ids = [], includePreRelease = [], versions = [];
    let isQueryForReleaseVersionFromPreReleaseVersion = true;
    for (const extensionInfo of extensionInfos) {
      if (extensionInfo.uuid) {
        ids.push(extensionInfo.uuid);
      } else {
        names.push(extensionInfo.id);
      }
      if (extensionInfo.version) {
        versions.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, version: extensionInfo.version });
      } else {
        includePreRelease.push({ id: extensionInfo.id, uuid: extensionInfo.uuid, includePreRelease: !!extensionInfo.preRelease });
      }
      isQueryForReleaseVersionFromPreReleaseVersion = isQueryForReleaseVersionFromPreReleaseVersion && (!!extensionInfo.hasPreRelease && !extensionInfo.preRelease);
    }
    if (!ids.length && !names.length) {
      return [];
    }
    let query = new Query().withPage(1, extensionInfos.length);
    if (ids.length) {
      query = query.withFilter(FilterType.ExtensionId, ...ids);
    }
    if (names.length) {
      query = query.withFilter(FilterType.ExtensionName, ...names);
    }
    if (options.queryAllVersions) {
      query = query.withFlags(...query.flags, Flag.IncludeVersions);
    }
    if (options.source) {
      query = query.withSource(options.source);
    }
    const { extensions } = await this.queryGalleryExtensions(
      query,
      {
        targetPlatform: options.targetPlatform ?? CURRENT_TARGET_PLATFORM,
        includePreRelease,
        versions,
        compatible: !!options.compatible,
        productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date },
        isQueryForReleaseVersionFromPreReleaseVersion
      },
      extensionGalleryManifest,
      token
    );
    if (options.source) {
      extensions.forEach((e, index) => setTelemetry(e, index, options.source));
    }
    return extensions;
  }
  async getExtensionsUsingResourceApi(extensionInfos, options, resourceApi, extensionGalleryManifest, token) {
    const result = [];
    const toQuery = [];
    const toFetchLatest = [];
    for (const extensionInfo of extensionInfos) {
      if (!EXTENSION_IDENTIFIER_REGEX.test(extensionInfo.id)) {
        continue;
      }
      if (extensionInfo.version) {
        toQuery.push(extensionInfo);
      } else {
        toFetchLatest.push(extensionInfo);
      }
    }
    await Promise.allSettled(toFetchLatest.map(async (extensionInfo) => {
      let galleryExtension;
      try {
        try {
          galleryExtension = await this.getLatestGalleryExtension(extensionInfo, options, resourceApi.uri, extensionGalleryManifest, token);
        } catch (error) {
          if (!resourceApi.fallback) {
            throw error;
          }
          this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id} from ${resourceApi.uri}. Trying the fallback ${resourceApi.fallback}`, getErrorMessage(error));
          this.telemetryService.publicLog2("galleryService:fallbacktounpkg", {
            extension: extensionInfo.id,
            preRelease: !!extensionInfo.preRelease,
            compatible: !!options.compatible
          });
          galleryExtension = await this.getLatestGalleryExtension(extensionInfo, options, resourceApi.fallback, extensionGalleryManifest, token);
        }
        if (galleryExtension === "NOT_FOUND") {
          if (extensionInfo.uuid) {
            toQuery.push(extensionInfo);
          }
          return;
        }
        if (galleryExtension) {
          result.push(galleryExtension);
        }
      } catch (error) {
        this.logService.error(`Error while getting the latest version for the extension ${extensionInfo.id}.`, getErrorMessage(error));
        this.telemetryService.publicLog2("galleryService:fallbacktoquery", {
          extension: extensionInfo.id,
          preRelease: !!extensionInfo.preRelease,
          compatible: !!options.compatible,
          fromFallback: !!resourceApi.fallback
        });
        toQuery.push(extensionInfo);
      }
    }));
    if (toQuery.length) {
      const extensions = await this.getExtensionsUsingQueryApi(toQuery, options, extensionGalleryManifest, token);
      result.push(...extensions);
    }
    return result;
  }
  async getLatestGalleryExtension(extensionInfo, options, resourceUriTemplate, extensionGalleryManifest, token) {
    const [publisher, name] = extensionInfo.id.split(".");
    const uri = URI.parse(format2(resourceUriTemplate, { publisher, name }));
    const rawGalleryExtension = await this.getLatestRawGalleryExtension(extensionInfo.id, uri, token);
    if (!rawGalleryExtension) {
      return "NOT_FOUND";
    }
    const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
    const rawGalleryExtensionVersion = await this.getRawGalleryExtensionVersion(
      rawGalleryExtension,
      {
        targetPlatform: options.targetPlatform ?? CURRENT_TARGET_PLATFORM,
        compatible: !!options.compatible,
        productVersion: options.productVersion ?? {
          version: this.productService.version,
          date: this.productService.date
        },
        version: extensionInfo.preRelease ? 1 /* Prerelease */ : 0 /* Release */
      },
      allTargetPlatforms
    );
    if (rawGalleryExtensionVersion) {
      return toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest);
    }
    return null;
  }
  async getCompatibleExtension(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
    if (isNotWebExtensionInWebTargetPlatform(extension.allTargetPlatforms, targetPlatform)) {
      return null;
    }
    if (await this.isExtensionCompatible(extension, includePreRelease, targetPlatform)) {
      return extension;
    }
    if (this.allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) !== true) {
      return null;
    }
    const result = await this.getExtensions([{
      ...extension.identifier,
      preRelease: includePreRelease,
      hasPreRelease: extension.hasPreReleaseVersion
    }], {
      compatible: true,
      productVersion,
      queryAllVersions: true,
      targetPlatform
    }, CancellationToken.None);
    return result[0] ?? null;
  }
  async isExtensionCompatible(extension, includePreRelease, targetPlatform, productVersion = { version: this.productService.version, date: this.productService.date }) {
    if (this.allowedExtensionsService.isAllowed(extension) !== true) {
      return false;
    }
    if (!isTargetPlatformCompatible(extension.properties.targetPlatform, extension.allTargetPlatforms, targetPlatform)) {
      return false;
    }
    if (!includePreRelease && extension.properties.isPreReleaseVersion) {
      return false;
    }
    let engine = extension.properties.engine;
    if (!engine) {
      const manifest = await this.getManifest(extension, CancellationToken.None);
      if (!manifest) {
        throw new Error("Manifest was not found");
      }
      engine = manifest.engines.vscode;
    }
    if (!isEngineValid(engine, productVersion.version, productVersion.date)) {
      return false;
    }
    if (!this.areApiProposalsCompatible(extension.identifier, extension.properties.enabledApiProposals)) {
      return false;
    }
    return true;
  }
  areApiProposalsCompatible(extensionIdentifier, enabledApiProposals) {
    if (!enabledApiProposals) {
      return true;
    }
    if (!this.extensionsEnabledWithApiProposalVersion.includes(extensionIdentifier.id.toLowerCase())) {
      return true;
    }
    return areApiProposalsCompatible(enabledApiProposals);
  }
  async isValidVersion(extension, rawGalleryExtensionVersion, { targetPlatform, compatible, productVersion, version }, publisherDisplayName, allTargetPlatforms) {
    if (isString(version)) {
      if (rawGalleryExtensionVersion.version !== version) {
        return false;
      }
    } else if (version === 0 /* Release */ || version === 1 /* Prerelease */) {
      if (isPreReleaseVersion(rawGalleryExtensionVersion) !== (version === 1 /* Prerelease */)) {
        return false;
      }
    }
    const targetPlatformForExtension = getTargetPlatformForExtensionVersion(rawGalleryExtensionVersion);
    if (!isTargetPlatformCompatible(targetPlatformForExtension, allTargetPlatforms, targetPlatform)) {
      return false;
    }
    if (compatible) {
      if (this.allowedExtensionsService.isAllowed({ id: extension, publisherDisplayName, version: rawGalleryExtensionVersion.version, prerelease: isPreReleaseVersion(rawGalleryExtensionVersion), targetPlatform: targetPlatformForExtension }) !== true) {
        return false;
      }
      try {
        const engine = await this.getEngine(extension, rawGalleryExtensionVersion);
        if (!isEngineValid(engine, productVersion.version, productVersion.date)) {
          return false;
        }
      } catch (error) {
        this.logService.error(`Error while getting the engine for the version ${rawGalleryExtensionVersion.version}.`, getErrorMessage(error));
        return false;
      }
    }
    return true;
  }
  async query(options, token) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    let text = options.text || "";
    const pageSize = options.pageSize ?? 50;
    let query = new Query().withPage(1, pageSize);
    if (text) {
      text = text.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
        query = query.withFilter(FilterType.Category, category || quotedCategory);
        return "";
      });
      text = text.replace(/\btag:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedTag, tag) => {
        query = query.withFilter(FilterType.Tag, tag || quotedTag);
        return "";
      });
      text = text.replace(/\bfeatured(\s+|\b|$)/g, () => {
        query = query.withFilter(FilterType.Featured);
        return "";
      });
      text = text.trim();
      if (text) {
        text = text.length < 200 ? text : text.substring(0, 200);
        query = query.withFilter(FilterType.SearchText, text);
      }
      if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === SortBy.NoneOrRelevance)) {
        query = query.withSortBy(SortBy.NoneOrRelevance);
      }
    } else {
      if (extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === SortBy.InstallCount)) {
        query = query.withSortBy(SortBy.InstallCount);
      }
    }
    if (options.sortBy && extensionGalleryManifest.capabilities.extensionQuery.sorting?.some((c) => c.name === options.sortBy)) {
      query = query.withSortBy(options.sortBy);
    }
    if (typeof options.sortOrder === "number") {
      query = query.withSortOrder(options.sortOrder);
    }
    if (options.source) {
      query = query.withSource(options.source);
    }
    const runQuery = async (query2, token2) => {
      const { extensions: extensions2, total: total2 } = await this.queryGalleryExtensions(query2, { targetPlatform: CURRENT_TARGET_PLATFORM, compatible: false, includePreRelease: !!options.includePreRelease, productVersion: options.productVersion ?? { version: this.productService.version, date: this.productService.date } }, extensionGalleryManifest, token2);
      extensions2.forEach((e, index) => setTelemetry(e, (query2.pageNumber - 1) * query2.pageSize + index, options.source));
      return { extensions: extensions2, total: total2 };
    };
    const { extensions, total } = await runQuery(query, token);
    const getPage = async (pageIndex, ct) => {
      if (ct.isCancellationRequested) {
        throw new CancellationError();
      }
      const { extensions: extensions2 } = await runQuery(query.withPage(pageIndex + 1), ct);
      return extensions2;
    };
    return { firstPage: extensions, total, pageSize: query.pageSize, getPage };
  }
  async queryGalleryExtensions(query, criteria, extensionGalleryManifest, token) {
    if (this.productService.quality !== "stable" && await this.assignmentService?.getTreatment("useLatestPrereleaseAndStableVersionFlag")) {
      return this.queryGalleryExtensionsUsingIncludeLatestPrereleaseAndStableVersionFlag(query, criteria, extensionGalleryManifest, token);
    }
    return this.queryGalleryExtensionsWithAllVersionsAsFallback(query, criteria, extensionGalleryManifest, token);
  }
  async queryGalleryExtensionsWithAllVersionsAsFallback(query, criteria, extensionGalleryManifest, token) {
    const flags = query.flags;
    if (query.flags.includes(Flag.IncludeLatestVersionOnly) && query.flags.includes(Flag.IncludeVersions)) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeVersions));
    }
    if (!query.flags.includes(Flag.IncludeLatestVersionOnly) && !query.flags.includes(Flag.IncludeVersions)) {
      query = query.withFlags(...query.flags, Flag.IncludeLatestVersionOnly);
    }
    if (criteria.versions?.length || criteria.isQueryForReleaseVersionFromPreReleaseVersion) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly), Flag.IncludeVersions);
    }
    query = query.withFlags(...query.flags, Flag.IncludeAssetUri, Flag.IncludeCategoryAndTags, Flag.IncludeFiles, Flag.IncludeStatistics, Flag.IncludeVersionProperties);
    const { galleryExtensions: rawGalleryExtensions, total, context } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, token);
    const hasAllVersions = !query.flags.includes(Flag.IncludeLatestVersionOnly);
    if (hasAllVersions) {
      const extensions = [];
      for (const rawGalleryExtension of rawGalleryExtensions) {
        const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
        const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
        const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find((extensionIdentifierWithPreRelease) => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
        const rawGalleryExtensionVersion = await this.getRawGalleryExtensionVersion(
          rawGalleryExtension,
          {
            compatible: criteria.compatible,
            targetPlatform: criteria.targetPlatform,
            productVersion: criteria.productVersion,
            version: criteria.versions?.find((extensionIdentifierWithVersion) => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version ?? (includePreRelease ? 2 /* Latest */ : 0 /* Release */)
          },
          allTargetPlatforms
        );
        if (rawGalleryExtensionVersion) {
          extensions.push(toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, context));
        }
      }
      return { extensions, total };
    }
    const result = [];
    const needAllVersions = /* @__PURE__ */ new Map();
    for (let index = 0; index < rawGalleryExtensions.length; index++) {
      const rawGalleryExtension = rawGalleryExtensions[index];
      const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
      const includePreRelease = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find((extensionIdentifierWithPreRelease) => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease;
      const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
      if (criteria.compatible) {
        if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
          continue;
        }
        if (this.allowedExtensionsService.isAllowed({ id: extensionIdentifier.id, publisherDisplayName: rawGalleryExtension.publisher.displayName }) !== true) {
          continue;
        }
      }
      const rawGalleryExtensionVersion = await this.getRawGalleryExtensionVersion(
        rawGalleryExtension,
        {
          compatible: criteria.compatible,
          targetPlatform: criteria.targetPlatform,
          productVersion: criteria.productVersion,
          version: criteria.versions?.find((extensionIdentifierWithVersion) => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version ?? (includePreRelease ? 2 /* Latest */ : 0 /* Release */)
        },
        allTargetPlatforms
      );
      const extension = rawGalleryExtensionVersion ? toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, context) : null;
      if (!extension || extension.properties.isPreReleaseVersion && (!includePreRelease || !extension.hasReleaseVersion) || !extension.properties.isPreReleaseVersion && extension.properties.targetPlatform !== criteria.targetPlatform && extension.hasPreReleaseVersion) {
        needAllVersions.set(rawGalleryExtension.extensionId, index);
      } else {
        result.push([index, extension]);
      }
    }
    if (needAllVersions.size) {
      const stopWatch = new StopWatch();
      const query2 = new Query().withFlags(...flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly), Flag.IncludeVersions).withPage(1, needAllVersions.size).withFilter(FilterType.ExtensionId, ...needAllVersions.keys());
      const { extensions } = await this.queryGalleryExtensions(query2, criteria, extensionGalleryManifest, token);
      this.telemetryService.publicLog2("galleryService:additionalQuery", {
        duration: stopWatch.elapsed(),
        count: needAllVersions.size
      });
      for (const extension of extensions) {
        const index = needAllVersions.get(extension.identifier.uuid);
        result.push([index, extension]);
      }
    }
    return { extensions: result.sort((a, b) => a[0] - b[0]).map(([, extension]) => extension), total };
  }
  async queryGalleryExtensionsUsingIncludeLatestPrereleaseAndStableVersionFlag(query, criteria, extensionGalleryManifest, token) {
    if (criteria.versions?.length) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly && flag !== Flag.IncludeLatestPrereleaseAndStableVersionOnly), Flag.IncludeVersions);
    } else if (!query.flags.includes(Flag.IncludeVersions)) {
      const includeLatest = isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : criteria.includePreRelease.every(({ includePreRelease }) => includePreRelease);
      query = includeLatest ? query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestPrereleaseAndStableVersionOnly), Flag.IncludeLatestVersionOnly) : query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly), Flag.IncludeLatestPrereleaseAndStableVersionOnly);
    }
    if (query.flags.includes(Flag.IncludeVersions) && (query.flags.includes(Flag.IncludeLatestVersionOnly) || query.flags.includes(Flag.IncludeLatestPrereleaseAndStableVersionOnly))) {
      query = query.withFlags(...query.flags.filter((flag) => flag !== Flag.IncludeLatestVersionOnly && flag !== Flag.IncludeLatestPrereleaseAndStableVersionOnly), Flag.IncludeVersions);
    }
    query = query.withFlags(...query.flags, Flag.IncludeAssetUri, Flag.IncludeCategoryAndTags, Flag.IncludeFiles, Flag.IncludeStatistics, Flag.IncludeVersionProperties);
    const { galleryExtensions: rawGalleryExtensions, total, context } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, token);
    const extensions = [];
    for (let index = 0; index < rawGalleryExtensions.length; index++) {
      const rawGalleryExtension = rawGalleryExtensions[index];
      const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
      const allTargetPlatforms = getAllTargetPlatforms(rawGalleryExtension);
      if (criteria.compatible) {
        if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
          continue;
        }
        if (this.allowedExtensionsService.isAllowed({ id: extensionIdentifier.id, publisherDisplayName: rawGalleryExtension.publisher.displayName }) !== true) {
          continue;
        }
      }
      const version = criteria.versions?.find((extensionIdentifierWithVersion) => areSameExtensions(extensionIdentifierWithVersion, extensionIdentifier))?.version ?? ((isBoolean(criteria.includePreRelease) ? criteria.includePreRelease : !!criteria.includePreRelease.find((extensionIdentifierWithPreRelease) => areSameExtensions(extensionIdentifierWithPreRelease, extensionIdentifier))?.includePreRelease) ? 2 /* Latest */ : 0 /* Release */);
      const rawGalleryExtensionVersion = await this.getRawGalleryExtensionVersion(
        rawGalleryExtension,
        {
          compatible: criteria.compatible,
          targetPlatform: criteria.targetPlatform,
          productVersion: criteria.productVersion,
          version
        },
        allTargetPlatforms
      );
      if (rawGalleryExtensionVersion) {
        extensions.push(toExtension(rawGalleryExtension, rawGalleryExtensionVersion, allTargetPlatforms, extensionGalleryManifest, context));
      }
    }
    return { extensions, total };
  }
  async getRawGalleryExtensionVersion(rawGalleryExtension, criteria, allTargetPlatforms) {
    const extensionIdentifier = { id: getGalleryExtensionId(rawGalleryExtension.publisher.publisherName, rawGalleryExtension.extensionName), uuid: rawGalleryExtension.extensionId };
    const rawGalleryExtensionVersions = sortExtensionVersions(rawGalleryExtension.versions, criteria.targetPlatform);
    if (criteria.compatible && isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, criteria.targetPlatform)) {
      return null;
    }
    const version = isString(criteria.version) ? criteria.version : void 0;
    for (let index = 0; index < rawGalleryExtensionVersions.length; index++) {
      const rawGalleryExtensionVersion = rawGalleryExtensionVersions[index];
      if (await this.isValidVersion(
        extensionIdentifier.id,
        rawGalleryExtensionVersion,
        criteria,
        rawGalleryExtension.publisher.displayName,
        allTargetPlatforms
      )) {
        if (criteria.compatible && !this.areApiProposalsCompatible(extensionIdentifier, getEnabledApiProposals(rawGalleryExtensionVersion))) {
          continue;
        }
        return rawGalleryExtensionVersion;
      }
      if (version && rawGalleryExtensionVersion.version === version) {
        return null;
      }
    }
    if (version || criteria.compatible) {
      return null;
    }
    return rawGalleryExtension.versions[0];
  }
  async queryRawGalleryExtensions(query, extensionGalleryManifest, token) {
    const extensionsQueryApi = getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionQueryService);
    if (!extensionsQueryApi) {
      throw new Error("No extension gallery query service configured.");
    }
    query = query.withFlags(...query.flags, Flag.ExcludeNonValidated).withFilter(FilterType.Target, "Microsoft.VisualStudio.Code");
    const unpublishedFlag = extensionGalleryManifest.capabilities.extensionQuery.flags?.find((f) => f.name === Flag.Unpublished);
    if (unpublishedFlag) {
      query = query.withFilter(FilterType.ExcludeWithFlags, String(unpublishedFlag.value));
    }
    const data = JSON.stringify({
      filters: [
        {
          criteria: query.criteria.reduce((criteria, c) => {
            const criterium = extensionGalleryManifest.capabilities.extensionQuery.filtering?.find((f) => f.name === c.filterType);
            if (criterium) {
              criteria.push({
                filterType: criterium.value,
                value: c.value
              });
            }
            return criteria;
          }, []),
          pageNumber: query.pageNumber,
          pageSize: query.pageSize,
          sortBy: extensionGalleryManifest.capabilities.extensionQuery.sorting?.find((s) => s.name === query.sortBy)?.value,
          sortOrder: query.sortOrder
        }
      ],
      assetTypes: query.assetTypes,
      flags: query.flags.reduce((flags, flag) => {
        const flagValue = extensionGalleryManifest.capabilities.extensionQuery.flags?.find((f) => f.name === flag);
        if (flagValue) {
          flags |= flagValue.value;
        }
        return flags;
      }, 0)
    });
    const commonHeaders = await this.commonHeadersPromise;
    const headers = {
      ...commonHeaders,
      "Content-Type": "application/json",
      "Accept": "application/json;api-version=3.0-preview.1",
      "Accept-Encoding": "gzip",
      "Content-Length": String(data.length)
    };
    const stopWatch = new StopWatch();
    let context, errorCode, total = 0;
    try {
      context = await this.requestService.request({
        type: "POST",
        url: extensionsQueryApi,
        data,
        headers
      }, token);
      if (context.res.statusCode && context.res.statusCode >= 400 && context.res.statusCode < 500) {
        return { galleryExtensions: [], total };
      }
      const result = await asJson(context);
      if (result) {
        const r = result.results[0];
        const galleryExtensions = r.extensions;
        const resultCount = r.resultMetadata && r.resultMetadata.filter((m) => m.metadataType === "ResultCount")[0];
        total = resultCount && resultCount.metadataItems.filter((i) => i.name === "TotalCount")[0].count || 0;
        return {
          galleryExtensions,
          total,
          context: context.res.headers["activityid"] ? {
            [SEARCH_ACTIVITY_HEADER_NAME]: context.res.headers["activityid"]
          } : {}
        };
      }
      return { galleryExtensions: [], total };
    } catch (e) {
      if (isCancellationError(e)) {
        errorCode = ExtensionGalleryErrorCode.Cancelled;
        throw e;
      } else {
        const errorMessage = getErrorMessage(e);
        errorCode = isOfflineError(e) ? ExtensionGalleryErrorCode.Offline : errorMessage.startsWith("XHR timeout") ? ExtensionGalleryErrorCode.Timeout : ExtensionGalleryErrorCode.Failed;
        throw new ExtensionGalleryError(errorMessage, errorCode);
      }
    } finally {
      this.telemetryService.publicLog2("galleryService:query", {
        filterTypes: query.criteria.map((criterium) => criterium.filterType),
        flags: query.flags,
        sortBy: query.sortBy,
        sortOrder: String(query.sortOrder),
        pageNumber: String(query.pageNumber),
        source: query.source,
        searchTextLength: query.searchText.length,
        requestBodySize: String(data.length),
        duration: stopWatch.elapsed(),
        success: !!context && isSuccess(context),
        responseBodySize: context?.res.headers["Content-Length"],
        statusCode: context ? String(context.res.statusCode) : void 0,
        errorCode,
        count: String(total),
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
    }
  }
  getHeaderValue(headers, name) {
    const value = headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }
  async getLatestRawGalleryExtension(extension, uri, token) {
    let errorCode;
    const stopWatch = new StopWatch();
    let context;
    try {
      const commonHeaders = await this.commonHeadersPromise;
      const headers = {
        ...commonHeaders,
        "Content-Type": "application/json",
        "Accept": "application/json;api-version=7.2-preview",
        "Accept-Encoding": "gzip"
      };
      context = await this.requestService.request({
        type: "GET",
        url: uri.toString(true),
        headers,
        timeout: 1e4
        /*10s*/
      }, token);
      if (context.res.statusCode === 404) {
        errorCode = "NotFound";
        return null;
      }
      if (context.res.statusCode && context.res.statusCode !== 200) {
        errorCode = `GalleryServiceError:` + context.res.statusCode;
        throw new Error("Unexpected HTTP response: " + context.res.statusCode);
      }
      const result = await asJson(context);
      if (!result) {
        errorCode = "NoData";
      }
      return result;
    } catch (error) {
      if (isCancellationError(error)) {
        errorCode = ExtensionGalleryErrorCode.Cancelled;
      } else {
        const errorMessage = getErrorMessage(error);
        errorCode = isOfflineError(error) ? ExtensionGalleryErrorCode.Offline : errorMessage.startsWith("XHR timeout") ? ExtensionGalleryErrorCode.Timeout : ExtensionGalleryErrorCode.Failed;
      }
      throw error;
    } finally {
      this.telemetryService.publicLog2("galleryService:getLatest", {
        extension,
        host: uri.authority,
        duration: stopWatch.elapsed(),
        errorCode,
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
    }
  }
  async reportStatistic(publisher, name, version, type) {
    const manifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!manifest) {
      return void 0;
    }
    let url;
    if (isWeb) {
      const resource = getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.WebExtensionStatisticsUri);
      if (!resource) {
        return;
      }
      url = format2(resource, { publisher, name, version, statTypeValue: type === StatisticType.Install ? "1" : "3" });
    } else {
      const resource = getExtensionGalleryManifestResourceUri(manifest, ExtensionGalleryResourceType.ExtensionStatisticsUri);
      if (!resource) {
        return;
      }
      url = format2(resource, { publisher, name, version, statTypeName: type });
    }
    const Accept = isWeb ? "api-version=6.1-preview.1" : "*/*;api-version=4.0-preview.1";
    const commonHeaders = await this.commonHeadersPromise;
    const headers = { ...commonHeaders, Accept };
    try {
      await this.requestService.request({
        type: "POST",
        url,
        headers
      }, CancellationToken.None);
    } catch (error) {
    }
  }
  async download(extension, location, operation) {
    this.logService.trace("ExtensionGalleryService#download", extension.identifier.id);
    const data = getGalleryExtensionTelemetryData(extension);
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    const operationParam = operation === InstallOperation.Install ? "install" : operation === InstallOperation.Update ? "update" : "";
    const downloadAsset = operationParam ? {
      uri: `${extension.assets.download.uri}${URI.parse(extension.assets.download.uri).query ? "&" : "?"}${operationParam}=true`,
      fallbackUri: `${extension.assets.download.fallbackUri}${URI.parse(extension.assets.download.fallbackUri).query ? "&" : "?"}${operationParam}=true`
    } : extension.assets.download;
    const headers = extension.queryContext?.[SEARCH_ACTIVITY_HEADER_NAME] ? { [SEARCH_ACTIVITY_HEADER_NAME]: extension.queryContext[SEARCH_ACTIVITY_HEADER_NAME] } : void 0;
    const context = await this.getAsset(extension.identifier.id, downloadAsset, AssetType.VSIX, extension.version, headers ? { headers } : void 0);
    try {
      await this.fileService.writeFile(location, context.stream);
    } catch (error) {
      try {
        await this.fileService.del(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
      }
      throw new ExtensionGalleryError(getErrorMessage(error), ExtensionGalleryErrorCode.DownloadFailedWriting);
    }
    this.telemetryService.publicLog("galleryService:downloadVSIX", { ...data, duration: (/* @__PURE__ */ new Date()).getTime() - startTime });
  }
  async downloadSignatureArchive(extension, location) {
    if (!extension.assets.signature) {
      throw new Error("No signature asset found");
    }
    this.logService.trace("ExtensionGalleryService#downloadSignatureArchive", extension.identifier.id);
    const context = await this.getAsset(extension.identifier.id, extension.assets.signature, AssetType.Signature, extension.version);
    try {
      await this.fileService.writeFile(location, context.stream);
    } catch (error) {
      try {
        await this.fileService.del(location);
      } catch (e) {
        this.logService.warn(`Error while deleting the file ${location.toString()}`, getErrorMessage(e));
      }
      throw new ExtensionGalleryError(getErrorMessage(error), ExtensionGalleryErrorCode.DownloadFailedWriting);
    }
  }
  async getReadme(extension, token) {
    if (extension.assets.readme) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.readme, AssetType.Details, extension.version, {}, token);
      const content = await asTextOrError(context);
      return content || "";
    }
    return "";
  }
  async getManifest(extension, token) {
    if (extension.assets.manifest) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.manifest, AssetType.Manifest, extension.version, {}, token);
      const text = await asTextOrError(context);
      return text ? JSON.parse(text) : null;
    }
    return null;
  }
  async getManifestFromRawExtensionVersion(extension, rawExtensionVersion, token) {
    const manifestAsset = getVersionAsset(rawExtensionVersion, AssetType.Manifest);
    if (!manifestAsset) {
      throw new Error("Manifest was not found");
    }
    const headers = { "Accept-Encoding": "gzip" };
    const context = await this.getAsset(extension, manifestAsset, AssetType.Manifest, rawExtensionVersion.version, { headers });
    return await asJson(context);
  }
  async getCoreTranslation(extension, languageId) {
    const asset = extension.assets.coreTranslations.filter((t) => t[0] === languageId.toUpperCase())[0];
    if (asset) {
      const context = await this.getAsset(extension.identifier.id, asset[1], asset[0], extension.version);
      const text = await asTextOrError(context);
      return text ? JSON.parse(text) : null;
    }
    return null;
  }
  async getChangelog(extension, token) {
    if (extension.assets.changelog) {
      const context = await this.getAsset(extension.identifier.id, extension.assets.changelog, AssetType.Changelog, extension.version, {}, token);
      const content = await asTextOrError(context);
      return content || "";
    }
    return "";
  }
  async getAllCompatibleVersions(extensionIdentifier, includePreRelease, targetPlatform) {
    const extensionGalleryManifest = await this.extensionGalleryManifestService.getExtensionGalleryManifest();
    if (!extensionGalleryManifest) {
      throw new Error("No extension gallery service configured.");
    }
    let query = new Query().withFlags(Flag.IncludeVersions, Flag.IncludeCategoryAndTags, Flag.IncludeFiles, Flag.IncludeVersionProperties).withPage(1, 1);
    if (extensionIdentifier.uuid) {
      query = query.withFilter(FilterType.ExtensionId, extensionIdentifier.uuid);
    } else {
      query = query.withFilter(FilterType.ExtensionName, extensionIdentifier.id);
    }
    const { galleryExtensions } = await this.queryRawGalleryExtensions(query, extensionGalleryManifest, CancellationToken.None);
    if (!galleryExtensions.length) {
      return [];
    }
    const allTargetPlatforms = getAllTargetPlatforms(galleryExtensions[0]);
    if (isNotWebExtensionInWebTargetPlatform(allTargetPlatforms, targetPlatform)) {
      return [];
    }
    const validVersions = [];
    const productVersion = { version: this.productService.version, date: this.productService.date };
    await Promise.all(galleryExtensions[0].versions.map(async (version) => {
      try {
        if (await this.isValidVersion(
          extensionIdentifier.id,
          version,
          {
            compatible: true,
            productVersion,
            targetPlatform,
            version: includePreRelease ? 2 /* Latest */ : 0 /* Release */
          },
          galleryExtensions[0].publisher.displayName,
          allTargetPlatforms
        ) && this.areApiProposalsCompatible(extensionIdentifier, getEnabledApiProposals(version))) {
          validVersions.push(version);
        }
      } catch (error) {
      }
    }));
    const result = [];
    const seen = /* @__PURE__ */ new Set();
    for (const version of sortExtensionVersions(validVersions, targetPlatform)) {
      if (!seen.has(version.version)) {
        seen.add(version.version);
        result.push({ version: version.version, date: version.lastUpdated, isPreReleaseVersion: isPreReleaseVersion(version) });
      }
    }
    return result;
  }
  async getAsset(extension, asset, assetType, extensionVersion, options = {}, token = CancellationToken.None) {
    const commonHeaders = await this.commonHeadersPromise;
    const baseOptions = { type: "GET" };
    const headers = { ...commonHeaders, ...options.headers || {} };
    options = { ...options, ...baseOptions, headers };
    const url = asset.uri;
    const fallbackUrl = asset.fallbackUri;
    const firstOptions = { ...options, url };
    let context;
    try {
      context = await this.requestService.request(firstOptions, token);
      if (context.res.statusCode === 200) {
        return context;
      }
      const message = await asTextOrError(context);
      throw new Error(`Expected 200, got back ${context.res.statusCode} instead.

${message}`);
    } catch (err) {
      if (isCancellationError(err)) {
        throw err;
      }
      const message = getErrorMessage(err);
      this.telemetryService.publicLog2("galleryService:cdnFallback", {
        extension,
        assetType,
        message,
        extensionVersion,
        server: this.getHeaderValue(context?.res.headers, SERVER_HEADER_NAME),
        activityId: this.getHeaderValue(context?.res.headers, ACTIVITY_HEADER_NAME),
        endToEndId: this.getHeaderValue(context?.res.headers, END_END_ID_HEADER_NAME)
      });
      const fallbackOptions = { ...options, url: fallbackUrl };
      return this.requestService.request(fallbackOptions, token);
    }
  }
  async getEngine(extension, rawExtensionVersion) {
    let engine = getEngine(rawExtensionVersion);
    if (!engine) {
      this.telemetryService.publicLog2("galleryService:engineFallback", { extension, extensionVersion: rawExtensionVersion.version });
      const manifest = await this.getManifestFromRawExtensionVersion(extension, rawExtensionVersion, CancellationToken.None);
      if (!manifest) {
        throw new Error("Manifest was not found");
      }
      engine = manifest.engines.vscode;
    }
    return engine;
  }
  async getExtensionsControlManifest() {
    if (!this.isEnabled()) {
      throw new Error("No extension gallery service configured.");
    }
    if (!this.extensionsControlUrl) {
      return { malicious: [], deprecated: {}, search: [] };
    }
    const context = await this.requestService.request({
      type: "GET",
      url: this.extensionsControlUrl,
      timeout: 1e4
      /*10s*/
    }, CancellationToken.None);
    if (context.res.statusCode !== 200) {
      throw new Error("Could not get extensions report.");
    }
    const result = await asJson(context);
    const malicious = [];
    const deprecated = {};
    const search = [];
    const extensionsEnabledWithPreRelease = [];
    if (result) {
      for (const id of result.malicious) {
        if (EXTENSION_IDENTIFIER_REGEX.test(id)) {
          malicious.push({ id });
        } else {
          malicious.push(id);
        }
      }
      if (result.migrateToPreRelease) {
        for (const [unsupportedPreReleaseExtensionId, preReleaseExtensionInfo] of Object.entries(result.migrateToPreRelease)) {
          if (!preReleaseExtensionInfo.engine || isEngineValid(preReleaseExtensionInfo.engine, this.productService.version, this.productService.date)) {
            deprecated[unsupportedPreReleaseExtensionId.toLowerCase()] = {
              disallowInstall: true,
              extension: {
                id: preReleaseExtensionInfo.id,
                displayName: preReleaseExtensionInfo.displayName,
                autoMigrate: { storage: !!preReleaseExtensionInfo.migrateStorage },
                preRelease: true
              }
            };
          }
        }
      }
      if (result.deprecated) {
        for (const [deprecatedExtensionId, deprecationInfo] of Object.entries(result.deprecated)) {
          if (deprecationInfo) {
            deprecated[deprecatedExtensionId.toLowerCase()] = isBoolean(deprecationInfo) ? {} : deprecationInfo;
          }
        }
      }
      if (result.search) {
        for (const s of result.search) {
          search.push(s);
        }
      }
      if (Array.isArray(result.extensionsEnabledWithPreRelease)) {
        for (const id of result.extensionsEnabledWithPreRelease) {
          extensionsEnabledWithPreRelease.push(id.toLowerCase());
        }
      }
    }
    return { malicious, deprecated, search, extensionsEnabledWithPreRelease };
  }
};
AbstractExtensionGalleryService = __decorateClass([
  __decorateParam(2, IRequestService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IProductService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IAllowedExtensionsService),
  __decorateParam(10, IExtensionGalleryManifestService)
], AbstractExtensionGalleryService);
let ExtensionGalleryService = class extends AbstractExtensionGalleryService {
  constructor(storageService, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    super(storageService, void 0, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
  }
};
ExtensionGalleryService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IEnvironmentService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IProductService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAllowedExtensionsService),
  __decorateParam(9, IExtensionGalleryManifestService)
], ExtensionGalleryService);
let ExtensionGalleryServiceWithNoStorageService = class extends AbstractExtensionGalleryService {
  constructor(requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService) {
    super(void 0, void 0, requestService, logService, environmentService, telemetryService, fileService, productService, configurationService, allowedExtensionsService, extensionGalleryManifestService);
  }
};
ExtensionGalleryServiceWithNoStorageService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IFileService),
  __decorateParam(5, IProductService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAllowedExtensionsService),
  __decorateParam(8, IExtensionGalleryManifestService)
], ExtensionGalleryServiceWithNoStorageService);
export {
  AbstractExtensionGalleryService,
  ExtensionGalleryService,
  ExtensionGalleryServiceWithNoStorageService,
  sortExtensionVersions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5U2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IsIGdldEVycm9yTWVzc2FnZSwgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJUGFnZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wYWdpbmcuanMnO1xuaW1wb3J0IHsgaXNXZWIsIHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgYXJjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgaXNCb29sZWFuLCBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJSGVhZGVycywgSVJlcXVlc3RDb250ZXh0LCBJUmVxdWVzdE9wdGlvbnMsIGlzT2ZmbGluZUVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBnZXRUYXJnZXRQbGF0Zm9ybSwgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkluZm8sIElHYWxsZXJ5RXh0ZW5zaW9uLCBJR2FsbGVyeUV4dGVuc2lvbkFzc2V0LCBJR2FsbGVyeUV4dGVuc2lvbkFzc2V0cywgSUdhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCBJbnN0YWxsT3BlcmF0aW9uLCBJUXVlcnlPcHRpb25zLCBJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCwgaXNOb3RXZWJFeHRlbnNpb25JbldlYlRhcmdldFBsYXRmb3JtLCBpc1RhcmdldFBsYXRmb3JtQ29tcGF0aWJsZSwgSVRyYW5zbGF0aW9uLCBTb3J0T3JkZXIsIFN0YXRpc3RpY1R5cGUsIHRvVGFyZ2V0UGxhdGZvcm0sIFdFQl9FWFRFTlNJT05fVEFHLCBJRXh0ZW5zaW9uUXVlcnlPcHRpb25zLCBJRGVwcmVjYXRpb25JbmZvLCBJU2VhcmNoUHJlZmZlcmVkUmVzdWx0cywgRXh0ZW5zaW9uR2FsbGVyeUVycm9yLCBFeHRlbnNpb25HYWxsZXJ5RXJyb3JDb2RlLCBJUHJvZHVjdFZlcnNpb24sIFVzZVVucGtnUmVzb3VyY2VBcGlDb25maWdLZXksIElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsIEVYVEVOU0lPTl9JREVOVElGSUVSX1JFR0VYLCBTb3J0QnksIEZpbHRlclR5cGUgfSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgYWRvcHRUb0dhbGxlcnlFeHRlbnNpb25JZCwgYXJlU2FtZUV4dGVuc2lvbnMsIGdldEdhbGxlcnlFeHRlbnNpb25JZCwgZ2V0R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGEgfSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5pZmVzdCwgVGFyZ2V0UGxhdGZvcm0gfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUsIGlzRW5naW5lVmFsaWQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25WYWxpZGF0b3IuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNKc29uLCBhc1RleHRPckVycm9yLCBJUmVxdWVzdFNlcnZpY2UsIGlzU3VjY2VzcyB9IGZyb20gJy4uLy4uL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZU1hcmtldHBsYWNlSGVhZGVycyB9IGZyb20gJy4uLy4uL2V4dGVybmFsU2VydmljZXMvY29tbW9uL21hcmtldHBsYWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgZm9ybWF0MiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSUFzc2lnbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYXNzaWdubWVudC9jb21tb24vYXNzaWdubWVudC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLCBGbGFnLCBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaSwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuL2V4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdC5qcyc7XG5cbmNvbnN0IENVUlJFTlRfVEFSR0VUX1BMQVRGT1JNID0gaXNXZWIgPyBUYXJnZXRQbGF0Zm9ybS5XRUIgOiBnZXRUYXJnZXRQbGF0Zm9ybShwbGF0Zm9ybSwgYXJjaCk7XG5jb25zdCBTRUFSQ0hfQUNUSVZJVFlfSEVBREVSX05BTUUgPSAnWC1NYXJrZXQtU2VhcmNoLUFjdGl2aXR5LUlkJztcbmNvbnN0IEFDVElWSVRZX0hFQURFUl9OQU1FID0gJ0FjdGl2aXR5aWQnO1xuY29uc3QgU0VSVkVSX0hFQURFUl9OQU1FID0gJ1NlcnZlcic7XG5jb25zdCBFTkRfRU5EX0lEX0hFQURFUl9OQU1FID0gJ1gtVnNzLUUyZWlkJztcblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uRmlsZSB7XG5cdHJlYWRvbmx5IGFzc2V0VHlwZTogc3RyaW5nO1xuXHRyZWFkb25seSBzb3VyY2U6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uUHJvcGVydHkge1xuXHRyZWFkb25seSBrZXk6IHN0cmluZztcblx0cmVhZG9ubHkgdmFsdWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24ge1xuXHRyZWFkb25seSB2ZXJzaW9uOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGxhc3RVcGRhdGVkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGFzc2V0VXJpOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGZhbGxiYWNrQXNzZXRVcmk6IHN0cmluZztcblx0cmVhZG9ubHkgZmlsZXM6IElSYXdHYWxsZXJ5RXh0ZW5zaW9uRmlsZVtdO1xuXHRyZWFkb25seSBwcm9wZXJ0aWVzPzogSVJhd0dhbGxlcnlFeHRlbnNpb25Qcm9wZXJ0eVtdO1xuXHRyZWFkb25seSB0YXJnZXRQbGF0Zm9ybT86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uU3RhdGlzdGljcyB7XG5cdHJlYWRvbmx5IHN0YXRpc3RpY05hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgdmFsdWU6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uUHVibGlzaGVyIHtcblx0cmVhZG9ubHkgZGlzcGxheU5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgcHVibGlzaGVySWQ6IHN0cmluZztcblx0cmVhZG9ubHkgcHVibGlzaGVyTmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBkb21haW4/OiBzdHJpbmcgfCBudWxsO1xuXHRyZWFkb25seSBpc0RvbWFpblZlcmlmaWVkPzogYm9vbGVhbjtcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uIHtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uTmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBkaXNwbGF5TmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBzaG9ydERlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBwdWJsaXNoZXI6IElSYXdHYWxsZXJ5RXh0ZW5zaW9uUHVibGlzaGVyO1xuXHRyZWFkb25seSB2ZXJzaW9uczogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uW107XG5cdHJlYWRvbmx5IHN0YXRpc3RpY3M6IElSYXdHYWxsZXJ5RXh0ZW5zaW9uU3RhdGlzdGljc1tdO1xuXHRyZWFkb25seSB0YWdzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcmVsZWFzZURhdGU6IHN0cmluZztcblx0cmVhZG9ubHkgcHVibGlzaGVkRGF0ZTogc3RyaW5nO1xuXHRyZWFkb25seSBsYXN0VXBkYXRlZDogc3RyaW5nO1xuXHRyZWFkb25seSBjYXRlZ29yaWVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZmxhZ3M6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5RXh0ZW5zaW9uc1Jlc3VsdCB7XG5cdHJlYWRvbmx5IGdhbGxlcnlFeHRlbnNpb25zOiBJUmF3R2FsbGVyeUV4dGVuc2lvbltdO1xuXHRyZWFkb25seSB0b3RhbDogbnVtYmVyO1xuXHRyZWFkb25seSBjb250ZXh0PzogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPjtcbn1cblxuaW50ZXJmYWNlIElSYXdHYWxsZXJ5UXVlcnlSZXN1bHQge1xuXHRyZWFkb25seSByZXN1bHRzOiB7XG5cdFx0cmVhZG9ubHkgZXh0ZW5zaW9uczogSVJhd0dhbGxlcnlFeHRlbnNpb25bXTtcblx0XHRyZWFkb25seSByZXN1bHRNZXRhZGF0YToge1xuXHRcdFx0cmVhZG9ubHkgbWV0YWRhdGFUeXBlOiBzdHJpbmc7XG5cdFx0XHRyZWFkb25seSBtZXRhZGF0YUl0ZW1zOiB7XG5cdFx0XHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0XHRcdFx0cmVhZG9ubHkgY291bnQ6IG51bWJlcjtcblx0XHRcdH1bXTtcblx0XHR9W107XG5cdH1bXTtcbn1cblxuY29uc3QgQXNzZXRUeXBlID0ge1xuXHRJY29uOiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5TZXJ2aWNlcy5JY29ucy5EZWZhdWx0Jyxcblx0RGV0YWlsczogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uU2VydmljZXMuQ29udGVudC5EZXRhaWxzJyxcblx0Q2hhbmdlbG9nOiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5TZXJ2aWNlcy5Db250ZW50LkNoYW5nZWxvZycsXG5cdE1hbmlmZXN0OiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5Db2RlLk1hbmlmZXN0Jyxcblx0VlNJWDogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uU2VydmljZXMuVlNJWFBhY2thZ2UnLFxuXHRMaWNlbnNlOiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5TZXJ2aWNlcy5Db250ZW50LkxpY2Vuc2UnLFxuXHRSZXBvc2l0b3J5OiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5TZXJ2aWNlcy5MaW5rcy5Tb3VyY2UnLFxuXHRTaWduYXR1cmU6ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLlNlcnZpY2VzLlZzaXhTaWduYXR1cmUnXG59O1xuXG5jb25zdCBQcm9wZXJ0eVR5cGUgPSB7XG5cdERlcGVuZGVuY3k6ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuRXh0ZW5zaW9uRGVwZW5kZW5jaWVzJyxcblx0RXh0ZW5zaW9uUGFjazogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uQ29kZS5FeHRlbnNpb25QYWNrJyxcblx0RW5naW5lOiAnTWljcm9zb2Z0LlZpc3VhbFN0dWRpby5Db2RlLkVuZ2luZScsXG5cdFByZVJlbGVhc2U6ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuUHJlUmVsZWFzZScsXG5cdEVuYWJsZWRBcGlQcm9wb3NhbHM6ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuRW5hYmxlZEFwaVByb3Bvc2FscycsXG5cdExvY2FsaXplZExhbmd1YWdlczogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uQ29kZS5Mb2NhbGl6ZWRMYW5ndWFnZXMnLFxuXHRXZWJFeHRlbnNpb246ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuV2ViRXh0ZW5zaW9uJyxcblx0U3BvbnNvckxpbms6ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuU3BvbnNvckxpbmsnLFxuXHRTdXBwb3J0TGluazogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uU2VydmljZXMuTGlua3MuU3VwcG9ydCcsXG5cdEV4ZWN1dGVzQ29kZTogJ01pY3Jvc29mdC5WaXN1YWxTdHVkaW8uQ29kZS5FeGVjdXRlc0NvZGUnLFxuXHRQcml2YXRlOiAnUHJpdmF0ZU1hcmtldHBsYWNlJyxcbn07XG5cbmludGVyZmFjZSBJQ3JpdGVyaXVtIHtcblx0cmVhZG9ubHkgZmlsdGVyVHlwZTogRmlsdGVyVHlwZTtcblx0cmVhZG9ubHkgdmFsdWU/OiBzdHJpbmc7XG59XG5cbmNvbnN0IERlZmF1bHRQYWdlU2l6ZSA9IDEwO1xuXG5pbnRlcmZhY2UgSVF1ZXJ5U3RhdGUge1xuXHRyZWFkb25seSBwYWdlTnVtYmVyOiBudW1iZXI7XG5cdHJlYWRvbmx5IHBhZ2VTaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IHNvcnRCeTogU29ydEJ5O1xuXHRyZWFkb25seSBzb3J0T3JkZXI6IFNvcnRPcmRlcjtcblx0cmVhZG9ubHkgZmxhZ3M6IEZsYWdbXTtcblx0cmVhZG9ubHkgY3JpdGVyaWE6IElDcml0ZXJpdW1bXTtcblx0cmVhZG9ubHkgYXNzZXRUeXBlczogc3RyaW5nW107XG5cdHJlYWRvbmx5IHNvdXJjZT86IHN0cmluZztcbn1cblxuY29uc3QgRGVmYXVsdFF1ZXJ5U3RhdGU6IElRdWVyeVN0YXRlID0ge1xuXHRwYWdlTnVtYmVyOiAxLFxuXHRwYWdlU2l6ZTogRGVmYXVsdFBhZ2VTaXplLFxuXHRzb3J0Qnk6IFNvcnRCeS5Ob25lT3JSZWxldmFuY2UsXG5cdHNvcnRPcmRlcjogU29ydE9yZGVyLkRlZmF1bHQsXG5cdGZsYWdzOiBbXSxcblx0Y3JpdGVyaWE6IFtdLFxuXHRhc3NldFR5cGVzOiBbXVxufTtcblxudHlwZSBHYWxsZXJ5U2VydmljZVF1ZXJ5Q2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnc2FuZHkwODEnO1xuXHRjb21tZW50OiAnSW5mb3JtYXRpb24gYWJvdXQgTWFya2V0cGxhY2UgcXVlcnkgYW5kIGl0cyByZXNwb25zZSc7XG5cdHJlYWRvbmx5IGZpbHRlclR5cGVzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRmlsdGVyIHR5cGVzIHVzZWQgaW4gdGhlIHF1ZXJ5LicgfTtcblx0cmVhZG9ubHkgZmxhZ3M6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdGbGFncyBwYXNzZWQgaW4gdGhlIHF1ZXJ5LicgfTtcblx0cmVhZG9ubHkgc29ydEJ5OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc29ydGVkIGJ5IG9wdGlvbiBwYXNzZWQgaW4gdGhlIHF1ZXJ5JyB9O1xuXHRyZWFkb25seSBzb3J0T3JkZXI6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdzb3J0IG9yZGVyIG9wdGlvbiBwYXNzZWQgaW4gdGhlIHF1ZXJ5JyB9O1xuXHRyZWFkb25seSBwYWdlTnVtYmVyOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAncmVxdWVzdGVkIHBhZ2UgbnVtYmVyIGluIHRoZSBxdWVyeScgfTtcblx0cmVhZG9ubHkgZHVyYXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7ICdpc01lYXN1cmVtZW50JzogdHJ1ZTsgY29tbWVudDogJ2Ftb3VudCBvZiB0aW1lIHRha2VuIGJ5IHRoZSBxdWVyeSByZXF1ZXN0JyB9O1xuXHRyZWFkb25seSBzdWNjZXNzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnd2hldGhlciB0aGUgcXVlcnkgcmVxdWVzdCBpcyBzdWNjZXNzIG9yIG5vdCcgfTtcblx0cmVhZG9ubHkgcmVxdWVzdEJvZHlTaXplOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc2l6ZSBvZiB0aGUgcmVxdWVzdCBib2R5JyB9O1xuXHRyZWFkb25seSByZXNwb25zZUJvZHlTaXplPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3NpemUgb2YgdGhlIHJlc3BvbnNlIGJvZHknIH07XG5cdHJlYWRvbmx5IHN0YXR1c0NvZGU/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnc3RhdHVzIGNvZGUgb2YgdGhlIHJlc3BvbnNlJyB9O1xuXHRyZWFkb25seSBlcnJvckNvZGU/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnZXJyb3IgY29kZSBvZiB0aGUgcmVzcG9uc2UnIH07XG5cdHJlYWRvbmx5IGNvdW50PzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3RvdGFsIG51bWJlciBvZiBleHRlbnNpb25zIG1hdGNoaW5nIHRoZSBxdWVyeScgfTtcblx0cmVhZG9ubHkgc291cmNlPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3NvdXJjZSB0aGF0IHJlcXVlc3RlZCB0aGlzIHF1ZXJ5LCBlZy4sIHJlY29tbWVuZGF0aW9ucywgdmlld2xldCcgfTtcblx0cmVhZG9ubHkgc2VhcmNoVGV4dExlbmd0aD86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdsZW5ndGggb2YgdGhlIHNlYXJjaCB0ZXh0IGluIHRoZSBxdWVyeScgfTtcblx0cmVhZG9ubHkgc2VydmVyPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3NlcnZlciB0aGF0IGhhbmRsZWQgdGhlIHF1ZXJ5JyB9O1xuXHRyZWFkb25seSBlbmRUb0VuZElkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2VuZCB0byBlbmQgb3BlcmF0aW9uIGlkJyB9O1xuXHRyZWFkb25seSBhY3Rpdml0eUlkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2FjdGl2aXR5IGlkJyB9O1xufTtcblxudHlwZSBRdWVyeVRlbGVtZXRyeURhdGEgPSB7XG5cdHJlYWRvbmx5IGZpbHRlclR5cGVzOiBzdHJpbmdbXTtcblx0cmVhZG9ubHkgZmxhZ3M6IHN0cmluZ1tdO1xuXHRyZWFkb25seSBzb3J0Qnk6IHN0cmluZztcblx0cmVhZG9ubHkgc29ydE9yZGVyOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHBhZ2VOdW1iZXI6IHN0cmluZztcblx0cmVhZG9ubHkgc291cmNlPzogc3RyaW5nO1xuXHRyZWFkb25seSBzZWFyY2hUZXh0TGVuZ3RoPzogbnVtYmVyO1xufTtcblxudHlwZSBHYWxsZXJ5U2VydmljZVF1ZXJ5RXZlbnQgPSBRdWVyeVRlbGVtZXRyeURhdGEgJiB7XG5cdHJlYWRvbmx5IGR1cmF0aW9uOiBudW1iZXI7XG5cdHJlYWRvbmx5IHN1Y2Nlc3M6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHJlcXVlc3RCb2R5U2l6ZTogc3RyaW5nO1xuXHRyZWFkb25seSByZXNwb25zZUJvZHlTaXplPzogc3RyaW5nO1xuXHRyZWFkb25seSBzdGF0dXNDb2RlPzogc3RyaW5nO1xuXHRyZWFkb25seSBlcnJvckNvZGU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNvdW50Pzogc3RyaW5nO1xuXHRyZWFkb25seSBzZXJ2ZXI/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGVuZFRvRW5kSWQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGFjdGl2aXR5SWQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIEdhbGxlcnlTZXJ2aWNlQWRkaXRpb25hbFF1ZXJ5Q2xhc3NpZmljYXRpb24gPSB7XG5cdG93bmVyOiAnc2FuZHkwODEnO1xuXHRjb21tZW50OiAnUmVzcG9uc2UgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGFkZGl0aW9uYWwgcXVlcnkgdG8gdGhlIE1hcmtldHBsYWNlIGZvciBmZXRjaGluZyBhbGwgdmVyc2lvbnMgdG8gZ2V0IHJlbGVhc2UgdmVyc2lvbic7XG5cdHJlYWRvbmx5IGR1cmF0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyAnaXNNZWFzdXJlbWVudCc6IHRydWU7IGNvbW1lbnQ6ICdBbW91bnQgb2YgdGltZSB0YWtlbiBieSB0aGUgYWRkaXRpb25hbCBxdWVyeScgfTtcblx0cmVhZG9ubHkgY291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUb3RhbCBudW1iZXIgb2YgZXh0ZW5zaW9ucyByZXR1cm5lZCBieSB0aGlzIGFkZGl0aW9uYWwgcXVlcnknIH07XG59O1xuXG50eXBlIEdhbGxlcnlTZXJ2aWNlQWRkaXRpb25hbFF1ZXJ5RXZlbnQgPSB7XG5cdHJlYWRvbmx5IGR1cmF0aW9uOiBudW1iZXI7XG5cdHJlYWRvbmx5IGNvdW50OiBudW1iZXI7XG59O1xuXG50eXBlIEV4dGVuc2lvbnNDcml0ZXJpYSA9IHtcblx0cmVhZG9ubHkgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbjtcblx0cmVhZG9ubHkgdGFyZ2V0UGxhdGZvcm06IFRhcmdldFBsYXRmb3JtO1xuXHRyZWFkb25seSBjb21wYXRpYmxlOiBib29sZWFuO1xuXHRyZWFkb25seSBpbmNsdWRlUHJlUmVsZWFzZTogYm9vbGVhbiB8IChJRXh0ZW5zaW9uSWRlbnRpZmllciAmIHsgaW5jbHVkZVByZVJlbGVhc2U6IGJvb2xlYW4gfSlbXTtcblx0cmVhZG9ubHkgdmVyc2lvbnM/OiAoSUV4dGVuc2lvbklkZW50aWZpZXIgJiB7IHZlcnNpb246IHN0cmluZyB9KVtdO1xuXHRyZWFkb25seSBpc1F1ZXJ5Rm9yUmVsZWFzZVZlcnNpb25Gcm9tUHJlUmVsZWFzZVZlcnNpb24/OiBib29sZWFuO1xufTtcblxuY29uc3QgZW51bSBWZXJzaW9uS2luZCB7XG5cdFJlbGVhc2UsXG5cdFByZXJlbGVhc2UsXG5cdExhdGVzdFxufVxuXG50eXBlIEV4dGVuc2lvblZlcnNpb25Dcml0ZXJpYSA9IHtcblx0cmVhZG9ubHkgcHJvZHVjdFZlcnNpb246IElQcm9kdWN0VmVyc2lvbjtcblx0cmVhZG9ubHkgdGFyZ2V0UGxhdGZvcm06IFRhcmdldFBsYXRmb3JtO1xuXHRyZWFkb25seSBjb21wYXRpYmxlOiBib29sZWFuO1xuXHRyZWFkb25seSB2ZXJzaW9uOiBWZXJzaW9uS2luZCB8IHN0cmluZztcbn07XG5cbmNsYXNzIFF1ZXJ5IHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHN0YXRlID0gRGVmYXVsdFF1ZXJ5U3RhdGUpIHsgfVxuXG5cdGdldCBwYWdlTnVtYmVyKCk6IG51bWJlciB7IHJldHVybiB0aGlzLnN0YXRlLnBhZ2VOdW1iZXI7IH1cblx0Z2V0IHBhZ2VTaXplKCk6IG51bWJlciB7IHJldHVybiB0aGlzLnN0YXRlLnBhZ2VTaXplOyB9XG5cdGdldCBzb3J0QnkoKTogU29ydEJ5IHsgcmV0dXJuIHRoaXMuc3RhdGUuc29ydEJ5OyB9XG5cdGdldCBzb3J0T3JkZXIoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuc3RhdGUuc29ydE9yZGVyOyB9XG5cdGdldCBmbGFncygpOiBGbGFnW10geyByZXR1cm4gdGhpcy5zdGF0ZS5mbGFnczsgfVxuXHRnZXQgY3JpdGVyaWEoKTogSUNyaXRlcml1bVtdIHsgcmV0dXJuIHRoaXMuc3RhdGUuY3JpdGVyaWE7IH1cblx0Z2V0IGFzc2V0VHlwZXMoKTogc3RyaW5nW10geyByZXR1cm4gdGhpcy5zdGF0ZS5hc3NldFR5cGVzOyB9XG5cdGdldCBzb3VyY2UoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuc3RhdGUuc291cmNlOyB9XG5cdGdldCBzZWFyY2hUZXh0KCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgY3JpdGVyaXVtID0gdGhpcy5zdGF0ZS5jcml0ZXJpYS5maWx0ZXIoY3JpdGVyaXVtID0+IGNyaXRlcml1bS5maWx0ZXJUeXBlID09PSBGaWx0ZXJUeXBlLlNlYXJjaFRleHQpWzBdO1xuXHRcdHJldHVybiBjcml0ZXJpdW0gJiYgY3JpdGVyaXVtLnZhbHVlID8gY3JpdGVyaXVtLnZhbHVlIDogJyc7XG5cdH1cblxuXG5cdHdpdGhQYWdlKHBhZ2VOdW1iZXI6IG51bWJlciwgcGFnZVNpemU6IG51bWJlciA9IHRoaXMuc3RhdGUucGFnZVNpemUpOiBRdWVyeSB7XG5cdFx0cmV0dXJuIG5ldyBRdWVyeSh7IC4uLnRoaXMuc3RhdGUsIHBhZ2VOdW1iZXIsIHBhZ2VTaXplIH0pO1xuXHR9XG5cblx0d2l0aEZpbHRlcihmaWx0ZXJUeXBlOiBGaWx0ZXJUeXBlLCAuLi52YWx1ZXM6IHN0cmluZ1tdKTogUXVlcnkge1xuXHRcdGNvbnN0IGNyaXRlcmlhID0gW1xuXHRcdFx0Li4udGhpcy5zdGF0ZS5jcml0ZXJpYSxcblx0XHRcdC4uLnZhbHVlcy5sZW5ndGggPyB2YWx1ZXMubWFwKHZhbHVlID0+ICh7IGZpbHRlclR5cGUsIHZhbHVlIH0pKSA6IFt7IGZpbHRlclR5cGUgfV1cblx0XHRdO1xuXG5cdFx0cmV0dXJuIG5ldyBRdWVyeSh7IC4uLnRoaXMuc3RhdGUsIGNyaXRlcmlhIH0pO1xuXHR9XG5cblx0d2l0aFNvcnRCeShzb3J0Qnk6IFNvcnRCeSk6IFF1ZXJ5IHtcblx0XHRyZXR1cm4gbmV3IFF1ZXJ5KHsgLi4udGhpcy5zdGF0ZSwgc29ydEJ5IH0pO1xuXHR9XG5cblx0d2l0aFNvcnRPcmRlcihzb3J0T3JkZXI6IFNvcnRPcmRlcik6IFF1ZXJ5IHtcblx0XHRyZXR1cm4gbmV3IFF1ZXJ5KHsgLi4udGhpcy5zdGF0ZSwgc29ydE9yZGVyIH0pO1xuXHR9XG5cblx0d2l0aEZsYWdzKC4uLmZsYWdzOiBGbGFnW10pOiBRdWVyeSB7XG5cdFx0cmV0dXJuIG5ldyBRdWVyeSh7IC4uLnRoaXMuc3RhdGUsIGZsYWdzOiBkaXN0aW5jdChmbGFncykgfSk7XG5cdH1cblxuXHR3aXRoQXNzZXRUeXBlcyguLi5hc3NldFR5cGVzOiBzdHJpbmdbXSk6IFF1ZXJ5IHtcblx0XHRyZXR1cm4gbmV3IFF1ZXJ5KHsgLi4udGhpcy5zdGF0ZSwgYXNzZXRUeXBlcyB9KTtcblx0fVxuXG5cdHdpdGhTb3VyY2Uoc291cmNlOiBzdHJpbmcpOiBRdWVyeSB7XG5cdFx0cmV0dXJuIG5ldyBRdWVyeSh7IC4uLnRoaXMuc3RhdGUsIHNvdXJjZSB9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRTdGF0aXN0aWMoc3RhdGlzdGljczogSVJhd0dhbGxlcnlFeHRlbnNpb25TdGF0aXN0aWNzW10sIG5hbWU6IHN0cmluZyk6IG51bWJlciB7XG5cdGNvbnN0IHJlc3VsdCA9IChzdGF0aXN0aWNzIHx8IFtdKS5maWx0ZXIocyA9PiBzLnN0YXRpc3RpY05hbWUgPT09IG5hbWUpWzBdO1xuXHRyZXR1cm4gcmVzdWx0ID8gcmVzdWx0LnZhbHVlIDogMDtcbn1cblxuZnVuY3Rpb24gZ2V0Q29yZVRyYW5zbGF0aW9uQXNzZXRzKHZlcnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik6IFtzdHJpbmcsIElHYWxsZXJ5RXh0ZW5zaW9uQXNzZXRdW10ge1xuXHRjb25zdCBjb3JlVHJhbnNsYXRpb25Bc3NldFByZWZpeCA9ICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUuVHJhbnNsYXRpb24uJztcblx0Y29uc3QgcmVzdWx0ID0gdmVyc2lvbi5maWxlcy5maWx0ZXIoZiA9PiBmLmFzc2V0VHlwZS5pbmRleE9mKGNvcmVUcmFuc2xhdGlvbkFzc2V0UHJlZml4KSA9PT0gMCk7XG5cdHJldHVybiByZXN1bHQucmVkdWNlPFtzdHJpbmcsIElHYWxsZXJ5RXh0ZW5zaW9uQXNzZXRdW10+KChyZXN1bHQsIGZpbGUpID0+IHtcblx0XHRjb25zdCBhc3NldCA9IGdldFZlcnNpb25Bc3NldCh2ZXJzaW9uLCBmaWxlLmFzc2V0VHlwZSk7XG5cdFx0aWYgKGFzc2V0KSB7XG5cdFx0XHRyZXN1bHQucHVzaChbZmlsZS5hc3NldFR5cGUuc3Vic3RyaW5nKGNvcmVUcmFuc2xhdGlvbkFzc2V0UHJlZml4Lmxlbmd0aCksIGFzc2V0XSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH0sIFtdKTtcbn1cblxuZnVuY3Rpb24gZ2V0UmVwb3NpdG9yeUFzc2V0KHZlcnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik6IElHYWxsZXJ5RXh0ZW5zaW9uQXNzZXQgfCBudWxsIHtcblx0aWYgKHZlcnNpb24ucHJvcGVydGllcykge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSB2ZXJzaW9uLnByb3BlcnRpZXMuZmlsdGVyKHAgPT4gcC5rZXkgPT09IEFzc2V0VHlwZS5SZXBvc2l0b3J5KTtcblx0XHRjb25zdCBnaXRSZWdFeHAgPSBuZXcgUmVnRXhwKCcoKGdpdHxzc2h8aHR0cChzKT8pfChnaXRAW1xcXFx3Ll0rKSkoOigvLyk/KShbXFxcXHcuQDovXFxcXC1+XSspKC5naXQpKC8pPycpO1xuXG5cdFx0Y29uc3QgdXJpID0gcmVzdWx0cy5maWx0ZXIociA9PiBnaXRSZWdFeHAudGVzdChyLnZhbHVlKSlbMF07XG5cdFx0cmV0dXJuIHVyaSA/IHsgdXJpOiB1cmkudmFsdWUsIGZhbGxiYWNrVXJpOiB1cmkudmFsdWUgfSA6IG51bGw7XG5cdH1cblx0cmV0dXJuIGdldFZlcnNpb25Bc3NldCh2ZXJzaW9uLCBBc3NldFR5cGUuUmVwb3NpdG9yeSk7XG59XG5cbmZ1bmN0aW9uIGdldERvd25sb2FkQXNzZXQodmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKTogSUdhbGxlcnlFeHRlbnNpb25Bc3NldCB7XG5cdHJldHVybiB7XG5cdFx0Ly8gYWx3YXlzIHVzZSBmYWxsYmFja0Fzc2V0VXJpIGZvciBkb3dubG9hZCBhc3NldCB0byBoaXQgdGhlIE1hcmtldHBsYWNlIEFQSSBzbyB0aGF0IGRvd25sb2FkcyBhcmUgY291bnRlZFxuXHRcdHVyaTogYCR7dmVyc2lvbi5mYWxsYmFja0Fzc2V0VXJpfS8ke0Fzc2V0VHlwZS5WU0lYfT9yZWRpcmVjdD10cnVlJHt2ZXJzaW9uLnRhcmdldFBsYXRmb3JtID8gYCZ0YXJnZXRQbGF0Zm9ybT0ke3ZlcnNpb24udGFyZ2V0UGxhdGZvcm19YCA6ICcnfWAsXG5cdFx0ZmFsbGJhY2tVcmk6IGAke3ZlcnNpb24uZmFsbGJhY2tBc3NldFVyaX0vJHtBc3NldFR5cGUuVlNJWH0ke3ZlcnNpb24udGFyZ2V0UGxhdGZvcm0gPyBgP3RhcmdldFBsYXRmb3JtPSR7dmVyc2lvbi50YXJnZXRQbGF0Zm9ybX1gIDogJyd9YFxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRWZXJzaW9uQXNzZXQodmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCB0eXBlOiBzdHJpbmcpOiBJR2FsbGVyeUV4dGVuc2lvbkFzc2V0IHwgbnVsbCB7XG5cdGNvbnN0IHJlc3VsdCA9IHZlcnNpb24uZmlsZXMuZmlsdGVyKGYgPT4gZi5hc3NldFR5cGUgPT09IHR5cGUpWzBdO1xuXHRyZXR1cm4gcmVzdWx0ID8ge1xuXHRcdHVyaTogYCR7dmVyc2lvbi5hc3NldFVyaX0vJHt0eXBlfSR7dmVyc2lvbi50YXJnZXRQbGF0Zm9ybSA/IGA/dGFyZ2V0UGxhdGZvcm09JHt2ZXJzaW9uLnRhcmdldFBsYXRmb3JtfWAgOiAnJ31gLFxuXHRcdGZhbGxiYWNrVXJpOiBgJHt2ZXJzaW9uLmZhbGxiYWNrQXNzZXRVcml9LyR7dHlwZX0ke3ZlcnNpb24udGFyZ2V0UGxhdGZvcm0gPyBgP3RhcmdldFBsYXRmb3JtPSR7dmVyc2lvbi50YXJnZXRQbGF0Zm9ybX1gIDogJyd9YFxuXHR9IDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0RXh0ZW5zaW9ucyh2ZXJzaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24sIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IHZhbHVlcyA9IHZlcnNpb24ucHJvcGVydGllcyA/IHZlcnNpb24ucHJvcGVydGllcy5maWx0ZXIocCA9PiBwLmtleSA9PT0gcHJvcGVydHkpIDogW107XG5cdGNvbnN0IHZhbHVlID0gdmFsdWVzLmxlbmd0aCA+IDAgJiYgdmFsdWVzWzBdLnZhbHVlO1xuXHRyZXR1cm4gdmFsdWUgPyB2YWx1ZS5zcGxpdCgnLCcpLm1hcCh2ID0+IGFkb3B0VG9HYWxsZXJ5RXh0ZW5zaW9uSWQodikpIDogW107XG59XG5cbmZ1bmN0aW9uIGdldEVuZ2luZSh2ZXJzaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24pOiBzdHJpbmcge1xuXHRjb25zdCB2YWx1ZXMgPSB2ZXJzaW9uLnByb3BlcnRpZXMgPyB2ZXJzaW9uLnByb3BlcnRpZXMuZmlsdGVyKHAgPT4gcC5rZXkgPT09IFByb3BlcnR5VHlwZS5FbmdpbmUpIDogW107XG5cdHJldHVybiAodmFsdWVzLmxlbmd0aCA+IDAgJiYgdmFsdWVzWzBdLnZhbHVlKSB8fCAnJztcbn1cblxuZnVuY3Rpb24gaXNQcmVSZWxlYXNlVmVyc2lvbih2ZXJzaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24pOiBib29sZWFuIHtcblx0Y29uc3QgdmFsdWVzID0gdmVyc2lvbi5wcm9wZXJ0aWVzID8gdmVyc2lvbi5wcm9wZXJ0aWVzLmZpbHRlcihwID0+IHAua2V5ID09PSBQcm9wZXJ0eVR5cGUuUHJlUmVsZWFzZSkgOiBbXTtcblx0cmV0dXJuIHZhbHVlcy5sZW5ndGggPiAwICYmIHZhbHVlc1swXS52YWx1ZSA9PT0gJ3RydWUnO1xufVxuXG5mdW5jdGlvbiBpc1ByaXZhdGVFeHRlbnNpb24odmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKTogYm9vbGVhbiB7XG5cdGNvbnN0IHZhbHVlcyA9IHZlcnNpb24ucHJvcGVydGllcyA/IHZlcnNpb24ucHJvcGVydGllcy5maWx0ZXIocCA9PiBwLmtleSA9PT0gUHJvcGVydHlUeXBlLlByaXZhdGUpIDogW107XG5cdHJldHVybiB2YWx1ZXMubGVuZ3RoID4gMCAmJiB2YWx1ZXNbMF0udmFsdWUgPT09ICd0cnVlJztcbn1cblxuZnVuY3Rpb24gZXhlY3V0ZXNDb2RlKHZlcnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRjb25zdCB2YWx1ZXMgPSB2ZXJzaW9uLnByb3BlcnRpZXMgPyB2ZXJzaW9uLnByb3BlcnRpZXMuZmlsdGVyKHAgPT4gcC5rZXkgPT09IFByb3BlcnR5VHlwZS5FeGVjdXRlc0NvZGUpIDogW107XG5cdHJldHVybiB2YWx1ZXMubGVuZ3RoID4gMCA/IHZhbHVlc1swXS52YWx1ZSA9PT0gJ3RydWUnIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBnZXRFbmFibGVkQXBpUHJvcG9zYWxzKHZlcnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik6IHN0cmluZ1tdIHtcblx0Y29uc3QgdmFsdWVzID0gdmVyc2lvbi5wcm9wZXJ0aWVzID8gdmVyc2lvbi5wcm9wZXJ0aWVzLmZpbHRlcihwID0+IHAua2V5ID09PSBQcm9wZXJ0eVR5cGUuRW5hYmxlZEFwaVByb3Bvc2FscykgOiBbXTtcblx0Y29uc3QgdmFsdWUgPSAodmFsdWVzLmxlbmd0aCA+IDAgJiYgdmFsdWVzWzBdLnZhbHVlKSB8fCAnJztcblx0cmV0dXJuIHZhbHVlID8gdmFsdWUuc3BsaXQoJywnKSA6IFtdO1xufVxuXG5mdW5jdGlvbiBnZXRMb2NhbGl6ZWRMYW5ndWFnZXModmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKTogc3RyaW5nW10ge1xuXHRjb25zdCB2YWx1ZXMgPSB2ZXJzaW9uLnByb3BlcnRpZXMgPyB2ZXJzaW9uLnByb3BlcnRpZXMuZmlsdGVyKHAgPT4gcC5rZXkgPT09IFByb3BlcnR5VHlwZS5Mb2NhbGl6ZWRMYW5ndWFnZXMpIDogW107XG5cdGNvbnN0IHZhbHVlID0gKHZhbHVlcy5sZW5ndGggPiAwICYmIHZhbHVlc1swXS52YWx1ZSkgfHwgJyc7XG5cdHJldHVybiB2YWx1ZSA/IHZhbHVlLnNwbGl0KCcsJykgOiBbXTtcbn1cblxuZnVuY3Rpb24gZ2V0U3BvbnNvckxpbmsodmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIHZlcnNpb24ucHJvcGVydGllcz8uZmluZChwID0+IHAua2V5ID09PSBQcm9wZXJ0eVR5cGUuU3BvbnNvckxpbmspPy52YWx1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U3VwcG9ydExpbmsodmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIHZlcnNpb24ucHJvcGVydGllcz8uZmluZChwID0+IHAua2V5ID09PSBQcm9wZXJ0eVR5cGUuU3VwcG9ydExpbmspPy52YWx1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0SXNQcmV2aWV3KGZsYWdzOiBzdHJpbmcpOiBib29sZWFuIHtcblx0cmV0dXJuIGZsYWdzLmluZGV4T2YoJ3ByZXZpZXcnKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldFBsYXRmb3JtRm9yRXh0ZW5zaW9uVmVyc2lvbih2ZXJzaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24pOiBUYXJnZXRQbGF0Zm9ybSB7XG5cdHJldHVybiB2ZXJzaW9uLnRhcmdldFBsYXRmb3JtID8gdG9UYXJnZXRQbGF0Zm9ybSh2ZXJzaW9uLnRhcmdldFBsYXRmb3JtKSA6IFRhcmdldFBsYXRmb3JtLlVOREVGSU5FRDtcbn1cblxuZnVuY3Rpb24gZ2V0QWxsVGFyZ2V0UGxhdGZvcm1zKHJhd0dhbGxlcnlFeHRlbnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uKTogVGFyZ2V0UGxhdGZvcm1bXSB7XG5cdGNvbnN0IGFsbFRhcmdldFBsYXRmb3JtcyA9IGRpc3RpbmN0KHJhd0dhbGxlcnlFeHRlbnNpb24udmVyc2lvbnMubWFwKGdldFRhcmdldFBsYXRmb3JtRm9yRXh0ZW5zaW9uVmVyc2lvbikpO1xuXG5cdC8vIElzIGEgd2ViIGV4dGVuc2lvbiBvbmx5IGlmIGl0IGhhcyBXRUJfRVhURU5TSU9OX1RBR1xuXHRjb25zdCBpc1dlYkV4dGVuc2lvbiA9ICEhcmF3R2FsbGVyeUV4dGVuc2lvbi50YWdzPy5pbmNsdWRlcyhXRUJfRVhURU5TSU9OX1RBRyk7XG5cblx0Ly8gSW5jbHVkZSBXZWIgVGFyZ2V0IFBsYXRmb3JtIG9ubHkgaWYgaXQgaXMgYSB3ZWIgZXh0ZW5zaW9uXG5cdGNvbnN0IHdlYlRhcmdldFBsYXRmb3JtSW5kZXggPSBhbGxUYXJnZXRQbGF0Zm9ybXMuaW5kZXhPZihUYXJnZXRQbGF0Zm9ybS5XRUIpO1xuXHRpZiAoaXNXZWJFeHRlbnNpb24pIHtcblx0XHRpZiAod2ViVGFyZ2V0UGxhdGZvcm1JbmRleCA9PT0gLTEpIHtcblx0XHRcdC8vIFdlYiBleHRlbnNpb24gYnV0IGRvZXMgbm90IGhhcyB3ZWIgdGFyZ2V0IHBsYXRmb3JtIC0+IGFkZCBpdFxuXHRcdFx0YWxsVGFyZ2V0UGxhdGZvcm1zLnB1c2goVGFyZ2V0UGxhdGZvcm0uV0VCKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0aWYgKHdlYlRhcmdldFBsYXRmb3JtSW5kZXggIT09IC0xKSB7XG5cdFx0XHQvLyBOb3QgYSB3ZWIgZXh0ZW5zaW9uIGJ1dCBoYXMgd2ViIHRhcmdldCBwbGF0Zm9ybSAtPiByZW1vdmUgaXRcblx0XHRcdGFsbFRhcmdldFBsYXRmb3Jtcy5zcGxpY2Uod2ViVGFyZ2V0UGxhdGZvcm1JbmRleCwgMSk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGFsbFRhcmdldFBsYXRmb3Jtcztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNvcnRFeHRlbnNpb25WZXJzaW9ucyh2ZXJzaW9uczogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uW10sIHByZWZlcnJlZFRhcmdldFBsYXRmb3JtOiBUYXJnZXRQbGF0Zm9ybSk6IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbltdIHtcblx0LyogSXQgaXMgZXhwZWN0ZWQgdGhhdCB2ZXJzaW9ucyBmcm9tIE1hcmtldHBsYWNlIGFyZSBzb3J0ZWQgYnkgdmVyc2lvbi4gU28gd2UgYXJlIGp1c3Qgc29ydGluZyBieSBwcmVmZXJyZWQgdGFyZ2V0UGxhdGZvcm0gKi9cblx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHZlcnNpb25zLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdGNvbnN0IHZlcnNpb24gPSB2ZXJzaW9uc1tpbmRleF07XG5cdFx0aWYgKHZlcnNpb24udmVyc2lvbiA9PT0gdmVyc2lvbnNbaW5kZXggLSAxXT8udmVyc2lvbikge1xuXHRcdFx0bGV0IGluc2VydGlvbkluZGV4ID0gaW5kZXg7XG5cdFx0XHRjb25zdCB2ZXJzaW9uVGFyZ2V0UGxhdGZvcm0gPSBnZXRUYXJnZXRQbGF0Zm9ybUZvckV4dGVuc2lvblZlcnNpb24odmVyc2lvbik7XG5cdFx0XHQvKiBwdXQgaXQgYXQgdGhlIGJlZ2lubmluZyAqL1xuXHRcdFx0aWYgKHZlcnNpb25UYXJnZXRQbGF0Zm9ybSA9PT0gcHJlZmVycmVkVGFyZ2V0UGxhdGZvcm0pIHtcblx0XHRcdFx0d2hpbGUgKGluc2VydGlvbkluZGV4ID4gMCAmJiB2ZXJzaW9uc1tpbnNlcnRpb25JbmRleCAtIDFdLnZlcnNpb24gPT09IHZlcnNpb24udmVyc2lvbikgeyBpbnNlcnRpb25JbmRleC0tOyB9XG5cdFx0XHR9XG5cdFx0XHRpZiAoaW5zZXJ0aW9uSW5kZXggIT09IGluZGV4KSB7XG5cdFx0XHRcdHZlcnNpb25zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdHZlcnNpb25zLnNwbGljZShpbnNlcnRpb25JbmRleCwgMCwgdmVyc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiB2ZXJzaW9ucztcbn1cblxuZnVuY3Rpb24gc2V0VGVsZW1ldHJ5KGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIGluZGV4OiBudW1iZXIsIHF1ZXJ5U291cmNlPzogc3RyaW5nKTogdm9pZCB7XG5cdC8qIF9fR0RQUl9fRlJBR01FTlRfX1xuXHRcIkdhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhMlwiIDoge1xuXHRcdFwiaW5kZXhcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XCJxdWVyeVNvdXJjZVwiOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiIH0sXG5cdFx0XCJxdWVyeUFjdGl2aXR5SWRcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiB9XG5cdH1cblx0Ki9cblx0ZXh0ZW5zaW9uLnRlbGVtZXRyeURhdGEgPSB7IGluZGV4LCBxdWVyeVNvdXJjZSwgcXVlcnlBY3Rpdml0eUlkOiBleHRlbnNpb24ucXVlcnlDb250ZXh0Py5bU0VBUkNIX0FDVElWSVRZX0hFQURFUl9OQU1FXSB9O1xufVxuXG5mdW5jdGlvbiB0b0V4dGVuc2lvbihnYWxsZXJ5RXh0ZW5zaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvbiwgdmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCBhbGxUYXJnZXRQbGF0Zm9ybXM6IFRhcmdldFBsYXRmb3JtW10sIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdDogSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgcXVlcnlDb250ZXh0PzogSVN0cmluZ0RpY3Rpb25hcnk8YW55Pik6IElHYWxsZXJ5RXh0ZW5zaW9uIHtcblx0Y29uc3QgbGF0ZXN0VmVyc2lvbiA9IGdhbGxlcnlFeHRlbnNpb24udmVyc2lvbnNbMF07XG5cdGNvbnN0IGFzc2V0czogSUdhbGxlcnlFeHRlbnNpb25Bc3NldHMgPSB7XG5cdFx0bWFuaWZlc3Q6IGdldFZlcnNpb25Bc3NldCh2ZXJzaW9uLCBBc3NldFR5cGUuTWFuaWZlc3QpLFxuXHRcdHJlYWRtZTogZ2V0VmVyc2lvbkFzc2V0KHZlcnNpb24sIEFzc2V0VHlwZS5EZXRhaWxzKSxcblx0XHRjaGFuZ2Vsb2c6IGdldFZlcnNpb25Bc3NldCh2ZXJzaW9uLCBBc3NldFR5cGUuQ2hhbmdlbG9nKSxcblx0XHRsaWNlbnNlOiBnZXRWZXJzaW9uQXNzZXQodmVyc2lvbiwgQXNzZXRUeXBlLkxpY2Vuc2UpLFxuXHRcdHJlcG9zaXRvcnk6IGdldFJlcG9zaXRvcnlBc3NldCh2ZXJzaW9uKSxcblx0XHRkb3dubG9hZDogZ2V0RG93bmxvYWRBc3NldCh2ZXJzaW9uKSxcblx0XHRpY29uOiBnZXRWZXJzaW9uQXNzZXQodmVyc2lvbiwgQXNzZXRUeXBlLkljb24pLFxuXHRcdHNpZ25hdHVyZTogZ2V0VmVyc2lvbkFzc2V0KHZlcnNpb24sIEFzc2V0VHlwZS5TaWduYXR1cmUpLFxuXHRcdGNvcmVUcmFuc2xhdGlvbnM6IGdldENvcmVUcmFuc2xhdGlvbkFzc2V0cyh2ZXJzaW9uKVxuXHR9O1xuXG5cdGNvbnN0IGRldGFpbHNWaWV3VXJpID0gZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0UmVzb3VyY2VVcmkoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvbkRldGFpbHNWaWV3VXJpKTtcblx0Y29uc3QgcHVibGlzaGVyVmlld1VyaSA9IGdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFJlc291cmNlVXJpKGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5QdWJsaXNoZXJWaWV3VXJpKTtcblx0Y29uc3QgcmF0aW5nVmlld1VyaSA9IGdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFJlc291cmNlVXJpKGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5FeHRlbnNpb25SYXRpbmdWaWV3VXJpKTtcblxuXHRyZXR1cm4ge1xuXHRcdHR5cGU6ICdnYWxsZXJ5Jyxcblx0XHRpZGVudGlmaWVyOiB7XG5cdFx0XHRpZDogZ2V0R2FsbGVyeUV4dGVuc2lvbklkKGdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLnB1Ymxpc2hlck5hbWUsIGdhbGxlcnlFeHRlbnNpb24uZXh0ZW5zaW9uTmFtZSksXG5cdFx0XHR1dWlkOiBnYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbklkXG5cdFx0fSxcblx0XHRuYW1lOiBnYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbk5hbWUsXG5cdFx0dmVyc2lvbjogdmVyc2lvbi52ZXJzaW9uLFxuXHRcdGRpc3BsYXlOYW1lOiBnYWxsZXJ5RXh0ZW5zaW9uLmRpc3BsYXlOYW1lLFxuXHRcdHB1Ymxpc2hlcklkOiBnYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5wdWJsaXNoZXJJZCxcblx0XHRwdWJsaXNoZXI6IGdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLnB1Ymxpc2hlck5hbWUsXG5cdFx0cHVibGlzaGVyRGlzcGxheU5hbWU6IGdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLmRpc3BsYXlOYW1lLFxuXHRcdHB1Ymxpc2hlckRvbWFpbjogZ2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXIuZG9tYWluID8geyBsaW5rOiBnYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5kb21haW4sIHZlcmlmaWVkOiAhIWdhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLmlzRG9tYWluVmVyaWZpZWQgfSA6IHVuZGVmaW5lZCxcblx0XHRwdWJsaXNoZXJTcG9uc29yTGluazogZ2V0U3BvbnNvckxpbmsobGF0ZXN0VmVyc2lvbiksXG5cdFx0ZGVzY3JpcHRpb246IGdhbGxlcnlFeHRlbnNpb24uc2hvcnREZXNjcmlwdGlvbiA/PyAnJyxcblx0XHRpbnN0YWxsQ291bnQ6IGdldFN0YXRpc3RpYyhnYWxsZXJ5RXh0ZW5zaW9uLnN0YXRpc3RpY3MsICdpbnN0YWxsJyksXG5cdFx0cmF0aW5nOiBnZXRTdGF0aXN0aWMoZ2FsbGVyeUV4dGVuc2lvbi5zdGF0aXN0aWNzLCAnYXZlcmFnZXJhdGluZycpLFxuXHRcdHJhdGluZ0NvdW50OiBnZXRTdGF0aXN0aWMoZ2FsbGVyeUV4dGVuc2lvbi5zdGF0aXN0aWNzLCAncmF0aW5nY291bnQnKSxcblx0XHRjYXRlZ29yaWVzOiBnYWxsZXJ5RXh0ZW5zaW9uLmNhdGVnb3JpZXMgfHwgW10sXG5cdFx0dGFnczogZ2FsbGVyeUV4dGVuc2lvbi50YWdzIHx8IFtdLFxuXHRcdHJlbGVhc2VEYXRlOiBEYXRlLnBhcnNlKGdhbGxlcnlFeHRlbnNpb24ucmVsZWFzZURhdGUpLFxuXHRcdGxhc3RVcGRhdGVkOiBEYXRlLnBhcnNlKGdhbGxlcnlFeHRlbnNpb24ubGFzdFVwZGF0ZWQpLFxuXHRcdGFsbFRhcmdldFBsYXRmb3Jtcyxcblx0XHRhc3NldHMsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0ZGVwZW5kZW5jaWVzOiBnZXRFeHRlbnNpb25zKHZlcnNpb24sIFByb3BlcnR5VHlwZS5EZXBlbmRlbmN5KSxcblx0XHRcdGV4dGVuc2lvblBhY2s6IGdldEV4dGVuc2lvbnModmVyc2lvbiwgUHJvcGVydHlUeXBlLkV4dGVuc2lvblBhY2spLFxuXHRcdFx0ZW5naW5lOiBnZXRFbmdpbmUodmVyc2lvbiksXG5cdFx0XHRlbmFibGVkQXBpUHJvcG9zYWxzOiBnZXRFbmFibGVkQXBpUHJvcG9zYWxzKHZlcnNpb24pLFxuXHRcdFx0bG9jYWxpemVkTGFuZ3VhZ2VzOiBnZXRMb2NhbGl6ZWRMYW5ndWFnZXModmVyc2lvbiksXG5cdFx0XHR0YXJnZXRQbGF0Zm9ybTogZ2V0VGFyZ2V0UGxhdGZvcm1Gb3JFeHRlbnNpb25WZXJzaW9uKHZlcnNpb24pLFxuXHRcdFx0aXNQcmVSZWxlYXNlVmVyc2lvbjogaXNQcmVSZWxlYXNlVmVyc2lvbih2ZXJzaW9uKSxcblx0XHRcdGV4ZWN1dGVzQ29kZTogZXhlY3V0ZXNDb2RlKHZlcnNpb24pXG5cdFx0fSxcblx0XHRoYXNQcmVSZWxlYXNlVmVyc2lvbjogaXNQcmVSZWxlYXNlVmVyc2lvbihsYXRlc3RWZXJzaW9uKSxcblx0XHRoYXNSZWxlYXNlVmVyc2lvbjogdHJ1ZSxcblx0XHRwcml2YXRlOiBpc1ByaXZhdGVFeHRlbnNpb24obGF0ZXN0VmVyc2lvbiksXG5cdFx0cHJldmlldzogZ2V0SXNQcmV2aWV3KGdhbGxlcnlFeHRlbnNpb24uZmxhZ3MpLFxuXHRcdGlzU2lnbmVkOiAhIWFzc2V0cy5zaWduYXR1cmUsXG5cdFx0cXVlcnlDb250ZXh0LFxuXHRcdHN1cHBvcnRMaW5rOiBnZXRTdXBwb3J0TGluayhsYXRlc3RWZXJzaW9uKSxcblx0XHRkZXRhaWxzTGluazogZGV0YWlsc1ZpZXdVcmkgPyBmb3JtYXQyKGRldGFpbHNWaWV3VXJpLCB7IHB1Ymxpc2hlcjogZ2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXIucHVibGlzaGVyTmFtZSwgbmFtZTogZ2FsbGVyeUV4dGVuc2lvbi5leHRlbnNpb25OYW1lIH0pIDogdW5kZWZpbmVkLFxuXHRcdHB1Ymxpc2hlckxpbms6IHB1Ymxpc2hlclZpZXdVcmkgPyBmb3JtYXQyKHB1Ymxpc2hlclZpZXdVcmksIHsgcHVibGlzaGVyOiBnYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5wdWJsaXNoZXJOYW1lIH0pIDogdW5kZWZpbmVkLFxuXHRcdHJhdGluZ0xpbms6IHJhdGluZ1ZpZXdVcmkgPyBmb3JtYXQyKHJhdGluZ1ZpZXdVcmksIHsgcHVibGlzaGVyOiBnYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5wdWJsaXNoZXJOYW1lLCBuYW1lOiBnYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbk5hbWUgfSkgOiB1bmRlZmluZWQsXG5cdH07XG59XG5cbmludGVyZmFjZSBJUmF3RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCB7XG5cdG1hbGljaW91czogc3RyaW5nW107XG5cdG1pZ3JhdGVUb1ByZVJlbGVhc2U/OiBJU3RyaW5nRGljdGlvbmFyeTx7XG5cdFx0aWQ6IHN0cmluZztcblx0XHRkaXNwbGF5TmFtZTogc3RyaW5nO1xuXHRcdG1pZ3JhdGVTdG9yYWdlPzogYm9vbGVhbjtcblx0XHRlbmdpbmU/OiBzdHJpbmc7XG5cdH0+O1xuXHRkZXByZWNhdGVkPzogSVN0cmluZ0RpY3Rpb25hcnk8Ym9vbGVhbiB8IHtcblx0XHRkaXNhbGxvd0luc3RhbGw/OiBib29sZWFuO1xuXHRcdGV4dGVuc2lvbj86IHtcblx0XHRcdGlkOiBzdHJpbmc7XG5cdFx0XHRkaXNwbGF5TmFtZTogc3RyaW5nO1xuXHRcdH07XG5cdFx0c2V0dGluZ3M/OiBzdHJpbmdbXTtcblx0XHRhZGRpdGlvbmFsSW5mbz86IHN0cmluZztcblx0fT47XG5cdHNlYXJjaD86IElTZWFyY2hQcmVmZmVyZWRSZXN1bHRzW107XG5cdGV4dGVuc2lvbnNFbmFibGVkV2l0aFByZVJlbGVhc2U/OiBzdHJpbmdbXTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgaW1wbGVtZW50cyBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc0NvbnRyb2xVcmw6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSB1bnBrZ1Jlc291cmNlQXBpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb21tb25IZWFkZXJzUHJvbWlzZTogUHJvbWlzZTxJSGVhZGVycz47XG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc0VuYWJsZWRXaXRoQXBpUHJvcG9zYWxWZXJzaW9uOiBzdHJpbmdbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYXNzaWdubWVudFNlcnZpY2U6IElBc3NpZ25tZW50U2VydmljZSB8IHVuZGVmaW5lZCxcblx0XHRASVJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5leHRlbnNpb25zQ29udHJvbFVybCA9IHByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvbnNHYWxsZXJ5Py5jb250cm9sVXJsO1xuXHRcdHRoaXMudW5wa2dSZXNvdXJjZUFwaSA9IHByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvbnNHYWxsZXJ5Py5leHRlbnNpb25VcmxUZW1wbGF0ZTtcblx0XHR0aGlzLmV4dGVuc2lvbnNFbmFibGVkV2l0aEFwaVByb3Bvc2FsVmVyc2lvbiA9IHByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvbnNFbmFibGVkV2l0aEFwaVByb3Bvc2FsVmVyc2lvbj8ubWFwKGlkID0+IGlkLnRvTG93ZXJDYXNlKCkpID8/IFtdO1xuXHRcdHRoaXMuY29tbW9uSGVhZGVyc1Byb21pc2UgPSByZXNvbHZlTWFya2V0cGxhY2VIZWFkZXJzKFxuXHRcdFx0cHJvZHVjdFNlcnZpY2UudmVyc2lvbixcblx0XHRcdHByb2R1Y3RTZXJ2aWNlLFxuXHRcdFx0dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdFx0dGhpcy5maWxlU2VydmljZSxcblx0XHRcdHN0b3JhZ2VTZXJ2aWNlLFxuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlKTtcblx0fVxuXG5cdGlzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmlzRW5hYmxlZCgpO1xuXHR9XG5cblx0Z2V0RXh0ZW5zaW9ucyhleHRlbnNpb25JbmZvczogUmVhZG9ubHlBcnJheTxJRXh0ZW5zaW9uSW5mbz4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUdhbGxlcnlFeHRlbnNpb25bXT47XG5cdGdldEV4dGVuc2lvbnMoZXh0ZW5zaW9uSW5mb3M6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbkluZm8+LCBvcHRpb25zOiBJRXh0ZW5zaW9uUXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uW10+O1xuXHRhc3luYyBnZXRFeHRlbnNpb25zKGV4dGVuc2lvbkluZm9zOiBSZWFkb25seUFycmF5PElFeHRlbnNpb25JbmZvPiwgYXJnMTogYW55LCBhcmcyPzogYW55KTogUHJvbWlzZTxJR2FsbGVyeUV4dGVuc2lvbltdPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpO1xuXHRcdGlmICghZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIGV4dGVuc2lvbiBnYWxsZXJ5IHNlcnZpY2UgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCBvcHRpb25zID0gQ2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25Ub2tlbihhcmcxKSA/IHt9IDogYXJnMSBhcyBJRXh0ZW5zaW9uUXVlcnlPcHRpb25zO1xuXHRcdGNvbnN0IHRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25Ub2tlbihhcmcxKSA/IGFyZzEgOiBhcmcyIGFzIENhbmNlbGxhdGlvblRva2VuO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2VBcGkgPSAob3B0aW9ucy5wcmVmZXJSZXNvdXJjZUFwaSAmJiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShVc2VVbnBrZ1Jlc291cmNlQXBpQ29uZmlnS2V5KSA/PyBmYWxzZSkpID8gYXdhaXQgdGhpcy5nZXRSZXNvdXJjZUFwaShleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHJlc291cmNlQXBpXG5cdFx0XHQ/IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uc1VzaW5nUmVzb3VyY2VBcGkoZXh0ZW5zaW9uSW5mb3MsIG9wdGlvbnMsIHJlc291cmNlQXBpLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKVxuXHRcdFx0OiBhd2FpdCB0aGlzLmdldEV4dGVuc2lvbnNVc2luZ1F1ZXJ5QXBpKGV4dGVuc2lvbkluZm9zLCBvcHRpb25zLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblxuXHRcdGNvbnN0IHV1aWRzID0gcmVzdWx0Lm1hcChyID0+IHIuaWRlbnRpZmllci51dWlkKTtcblx0XHRjb25zdCBleHRlbnNpb25JbmZvc0J5TmFtZTogSUV4dGVuc2lvbkluZm9bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZSBvZiBleHRlbnNpb25JbmZvcykge1xuXHRcdFx0aWYgKGUudXVpZCAmJiAhdXVpZHMuaW5jbHVkZXMoZS51dWlkKSkge1xuXHRcdFx0XHRleHRlbnNpb25JbmZvc0J5TmFtZS5wdXNoKHsgLi4uZSwgdXVpZDogdW5kZWZpbmVkIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb25JbmZvc0J5TmFtZS5sZW5ndGgpIHtcblx0XHRcdC8vIHJlcG9ydCB0ZWxlbWV0cnkgZGF0YSBmb3IgYWRkaXRpb25hbCBxdWVyeVxuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8XG5cdFx0XHRcdHsgY291bnQ6IG51bWJlciB9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdFx0Y29tbWVudDogJ1JlcG9ydCB0aGUgcXVlcnkgdG8gdGhlIE1hcmtldHBsYWNlIGZvciBmZXRjaGluZyBleHRlbnNpb25zIGJ5IG5hbWUnO1xuXHRcdFx0XHRcdHJlYWRvbmx5IGNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnTnVtYmVyIG9mIGV4dGVuc2lvbnMgdG8gZmV0Y2gnIH07XG5cdFx0XHRcdH0+KCdnYWxsZXJ5U2VydmljZTphZGRpdGlvbmFsUXVlcnlCeU5hbWUnLCB7XG5cdFx0XHRcdFx0Y291bnQ6IGV4dGVuc2lvbkluZm9zQnlOYW1lLmxlbmd0aFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9uc1VzaW5nUXVlcnlBcGkoZXh0ZW5zaW9uSW5mb3NCeU5hbWUsIG9wdGlvbnMsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgdG9rZW4pO1xuXHRcdFx0cmVzdWx0LnB1c2goLi4uZXh0ZW5zaW9ucyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UmVzb3VyY2VBcGkoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0OiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KTogUHJvbWlzZTx7IHVyaTogc3RyaW5nOyBmYWxsYmFjaz86IHN0cmluZyB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgbGF0ZXN0VmVyc2lvblJlc291cmNlID0gZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0UmVzb3VyY2VVcmkoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvbkxhdGVzdFZlcnNpb25VcmkpO1xuXHRcdGlmICghbGF0ZXN0VmVyc2lvblJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgIT09ICdzdGFibGUnKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR1cmk6IGxhdGVzdFZlcnNpb25SZXNvdXJjZSxcblx0XHRcdFx0ZmFsbGJhY2s6IHRoaXMudW5wa2dSZXNvdXJjZUFwaVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuYXNzaWdubWVudFNlcnZpY2U/LmdldFRyZWF0bWVudDwndW5wa2cnIHwgJ21hcmtldHBsYWNlJyB8ICdub25lJz4oJ2V4dGVuc2lvbnMuZ2FsbGVyeS51c2VSZXNvdXJjZUFwaScpID8/ICd1bnBrZyc7XG5cblx0XHRpZiAodmFsdWUgPT09ICdtYXJrZXRwbGFjZScpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHVyaTogbGF0ZXN0VmVyc2lvblJlc291cmNlLFxuXHRcdFx0XHRmYWxsYmFjazogdGhpcy51bnBrZ1Jlc291cmNlQXBpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZSA9PT0gJ3VucGtnJyAmJiB0aGlzLnVucGtnUmVzb3VyY2VBcGkpIHtcblx0XHRcdHJldHVybiB7IHVyaTogdGhpcy51bnBrZ1Jlc291cmNlQXBpIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0RXh0ZW5zaW9uc1VzaW5nUXVlcnlBcGkoZXh0ZW5zaW9uSW5mb3M6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbkluZm8+LCBvcHRpb25zOiBJRXh0ZW5zaW9uUXVlcnlPcHRpb25zLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUdhbGxlcnlFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IG5hbWVzOiBzdHJpbmdbXSA9IFtdLFxuXHRcdFx0aWRzOiBzdHJpbmdbXSA9IFtdLFxuXHRcdFx0aW5jbHVkZVByZVJlbGVhc2U6IChJRXh0ZW5zaW9uSWRlbnRpZmllciAmIHsgaW5jbHVkZVByZVJlbGVhc2U6IGJvb2xlYW4gfSlbXSA9IFtdLFxuXHRcdFx0dmVyc2lvbnM6IChJRXh0ZW5zaW9uSWRlbnRpZmllciAmIHsgdmVyc2lvbjogc3RyaW5nIH0pW10gPSBbXTtcblx0XHRsZXQgaXNRdWVyeUZvclJlbGVhc2VWZXJzaW9uRnJvbVByZVJlbGVhc2VWZXJzaW9uID0gdHJ1ZTtcblxuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uSW5mbyBvZiBleHRlbnNpb25JbmZvcykge1xuXHRcdFx0aWYgKGV4dGVuc2lvbkluZm8udXVpZCkge1xuXHRcdFx0XHRpZHMucHVzaChleHRlbnNpb25JbmZvLnV1aWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmFtZXMucHVzaChleHRlbnNpb25JbmZvLmlkKTtcblx0XHRcdH1cblx0XHRcdGlmIChleHRlbnNpb25JbmZvLnZlcnNpb24pIHtcblx0XHRcdFx0dmVyc2lvbnMucHVzaCh7IGlkOiBleHRlbnNpb25JbmZvLmlkLCB1dWlkOiBleHRlbnNpb25JbmZvLnV1aWQsIHZlcnNpb246IGV4dGVuc2lvbkluZm8udmVyc2lvbiB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGluY2x1ZGVQcmVSZWxlYXNlLnB1c2goeyBpZDogZXh0ZW5zaW9uSW5mby5pZCwgdXVpZDogZXh0ZW5zaW9uSW5mby51dWlkLCBpbmNsdWRlUHJlUmVsZWFzZTogISFleHRlbnNpb25JbmZvLnByZVJlbGVhc2UgfSk7XG5cdFx0XHR9XG5cdFx0XHRpc1F1ZXJ5Rm9yUmVsZWFzZVZlcnNpb25Gcm9tUHJlUmVsZWFzZVZlcnNpb24gPSBpc1F1ZXJ5Rm9yUmVsZWFzZVZlcnNpb25Gcm9tUHJlUmVsZWFzZVZlcnNpb24gJiYgKCEhZXh0ZW5zaW9uSW5mby5oYXNQcmVSZWxlYXNlICYmICFleHRlbnNpb25JbmZvLnByZVJlbGVhc2UpO1xuXHRcdH1cblxuXHRcdGlmICghaWRzLmxlbmd0aCAmJiAhbmFtZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0bGV0IHF1ZXJ5ID0gbmV3IFF1ZXJ5KCkud2l0aFBhZ2UoMSwgZXh0ZW5zaW9uSW5mb3MubGVuZ3RoKTtcblx0XHRpZiAoaWRzLmxlbmd0aCkge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoRmlsdGVyKEZpbHRlclR5cGUuRXh0ZW5zaW9uSWQsIC4uLmlkcyk7XG5cdFx0fVxuXHRcdGlmIChuYW1lcy5sZW5ndGgpIHtcblx0XHRcdHF1ZXJ5ID0gcXVlcnkud2l0aEZpbHRlcihGaWx0ZXJUeXBlLkV4dGVuc2lvbk5hbWUsIC4uLm5hbWVzKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMucXVlcnlBbGxWZXJzaW9ucykge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoRmxhZ3MoLi4ucXVlcnkuZmxhZ3MsIEZsYWcuSW5jbHVkZVZlcnNpb25zKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMuc291cmNlKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhTb3VyY2Uob3B0aW9ucy5zb3VyY2UpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgZXh0ZW5zaW9ucyB9ID0gYXdhaXQgdGhpcy5xdWVyeUdhbGxlcnlFeHRlbnNpb25zKFxuXHRcdFx0cXVlcnksXG5cdFx0XHR7XG5cdFx0XHRcdHRhcmdldFBsYXRmb3JtOiBvcHRpb25zLnRhcmdldFBsYXRmb3JtID8/IENVUlJFTlRfVEFSR0VUX1BMQVRGT1JNLFxuXHRcdFx0XHRpbmNsdWRlUHJlUmVsZWFzZSxcblx0XHRcdFx0dmVyc2lvbnMsXG5cdFx0XHRcdGNvbXBhdGlibGU6ICEhb3B0aW9ucy5jb21wYXRpYmxlLFxuXHRcdFx0XHRwcm9kdWN0VmVyc2lvbjogb3B0aW9ucy5wcm9kdWN0VmVyc2lvbiA/PyB7IHZlcnNpb246IHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgZGF0ZTogdGhpcy5wcm9kdWN0U2VydmljZS5kYXRlIH0sXG5cdFx0XHRcdGlzUXVlcnlGb3JSZWxlYXNlVmVyc2lvbkZyb21QcmVSZWxlYXNlVmVyc2lvblxuXHRcdFx0fSxcblx0XHRcdGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCxcblx0XHRcdHRva2VuKTtcblxuXHRcdGlmIChvcHRpb25zLnNvdXJjZSkge1xuXHRcdFx0ZXh0ZW5zaW9ucy5mb3JFYWNoKChlLCBpbmRleCkgPT4gc2V0VGVsZW1ldHJ5KGUsIGluZGV4LCBvcHRpb25zLnNvdXJjZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBleHRlbnNpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRFeHRlbnNpb25zVXNpbmdSZXNvdXJjZUFwaShleHRlbnNpb25JbmZvczogUmVhZG9ubHlBcnJheTxJRXh0ZW5zaW9uSW5mbz4sIG9wdGlvbnM6IElFeHRlbnNpb25RdWVyeU9wdGlvbnMsIHJlc291cmNlQXBpOiB7IHVyaTogc3RyaW5nOyBmYWxsYmFjaz86IHN0cmluZyB9LCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUdhbGxlcnlFeHRlbnNpb25bXT4ge1xuXG5cdFx0Y29uc3QgcmVzdWx0OiBJR2FsbGVyeUV4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgdG9RdWVyeTogSUV4dGVuc2lvbkluZm9bXSA9IFtdO1xuXHRcdGNvbnN0IHRvRmV0Y2hMYXRlc3Q6IElFeHRlbnNpb25JbmZvW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uSW5mbyBvZiBleHRlbnNpb25JbmZvcykge1xuXHRcdFx0aWYgKCFFWFRFTlNJT05fSURFTlRJRklFUl9SRUdFWC50ZXN0KGV4dGVuc2lvbkluZm8uaWQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbkluZm8udmVyc2lvbikge1xuXHRcdFx0XHR0b1F1ZXJ5LnB1c2goZXh0ZW5zaW9uSW5mbyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0b0ZldGNoTGF0ZXN0LnB1c2goZXh0ZW5zaW9uSW5mbyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHRvRmV0Y2hMYXRlc3QubWFwKGFzeW5jIGV4dGVuc2lvbkluZm8gPT4ge1xuXHRcdFx0bGV0IGdhbGxlcnlFeHRlbnNpb246IElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCB8ICdOT1RfRk9VTkQnO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRnYWxsZXJ5RXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RHYWxsZXJ5RXh0ZW5zaW9uKGV4dGVuc2lvbkluZm8sIG9wdGlvbnMsIHJlc291cmNlQXBpLnVyaSwgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCB0b2tlbik7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0aWYgKCFyZXNvdXJjZUFwaS5mYWxsYmFjaykge1xuXHRcdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gZmFsbGJhY2sgdG8gdW5wa2dcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHdoaWxlIGdldHRpbmcgdGhlIGxhdGVzdCB2ZXJzaW9uIGZvciB0aGUgZXh0ZW5zaW9uICR7ZXh0ZW5zaW9uSW5mby5pZH0gZnJvbSAke3Jlc291cmNlQXBpLnVyaX0uIFRyeWluZyB0aGUgZmFsbGJhY2sgJHtyZXNvdXJjZUFwaS5mYWxsYmFja31gLCBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uOiBzdHJpbmc7XG5cdFx0XHRcdFx0XHRcdHByZVJlbGVhc2U6IGJvb2xlYW47XG5cdFx0XHRcdFx0XHRcdGNvbXBhdGlibGU6IGJvb2xlYW47XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRvd25lcjogJ3NhbmR5MDgxJztcblx0XHRcdFx0XHRcdFx0Y29tbWVudDogJ1JlcG9ydCB0aGUgZmFsbGJhY2sgdG8gdGhlIHVucGtnIHNlcnZpY2UgZm9yIGdldHRpbmcgbGF0ZXN0IGV4dGVuc2lvbic7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0V4dGVuc2lvbiBpZCcgfTtcblx0XHRcdFx0XHRcdFx0cHJlUmVsZWFzZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0dldCBwcmUtcmVsZWFzZSB2ZXJzaW9uJyB9O1xuXHRcdFx0XHRcdFx0XHRjb21wYXRpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnR2V0IGNvbXBhdGlibGUgdmVyc2lvbicgfTtcblx0XHRcdFx0XHRcdH0+KCdnYWxsZXJ5U2VydmljZTpmYWxsYmFja3RvdW5wa2cnLCB7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbjogZXh0ZW5zaW9uSW5mby5pZCxcblx0XHRcdFx0XHRcdFx0cHJlUmVsZWFzZTogISFleHRlbnNpb25JbmZvLnByZVJlbGVhc2UsXG5cdFx0XHRcdFx0XHRcdGNvbXBhdGlibGU6ICEhb3B0aW9ucy5jb21wYXRpYmxlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRnYWxsZXJ5RXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5nZXRMYXRlc3RHYWxsZXJ5RXh0ZW5zaW9uKGV4dGVuc2lvbkluZm8sIG9wdGlvbnMsIHJlc291cmNlQXBpLmZhbGxiYWNrLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChnYWxsZXJ5RXh0ZW5zaW9uID09PSAnTk9UX0ZPVU5EJykge1xuXHRcdFx0XHRcdGlmIChleHRlbnNpb25JbmZvLnV1aWQpIHtcblx0XHRcdFx0XHRcdC8vIEZhbGxiYWNrIHRvIHF1ZXJ5IGlmIGV4dGVuc2lvbiB3aXRoIFVVSUQgaXMgbm90IGZvdW5kLiBQcm9iYWJseSBleHRlbnNpb24gaXMgcmVuYW1lZC5cblx0XHRcdFx0XHRcdHRvUXVlcnkucHVzaChleHRlbnNpb25JbmZvKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGdhbGxlcnlFeHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChnYWxsZXJ5RXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBmYWxsYmFjayB0byBxdWVyeVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHdoaWxlIGdldHRpbmcgdGhlIGxhdGVzdCB2ZXJzaW9uIGZvciB0aGUgZXh0ZW5zaW9uICR7ZXh0ZW5zaW9uSW5mby5pZH0uYCwgZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbjogc3RyaW5nO1xuXHRcdFx0XHRcdFx0cHJlUmVsZWFzZTogYm9vbGVhbjtcblx0XHRcdFx0XHRcdGNvbXBhdGlibGU6IGJvb2xlYW47XG5cdFx0XHRcdFx0XHRmcm9tRmFsbGJhY2s6IGJvb2xlYW47XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRvd25lcjogJ3NhbmR5MDgxJztcblx0XHRcdFx0XHRcdGNvbW1lbnQ6ICdSZXBvcnQgdGhlIGZhbGxiYWNrIHRvIHRoZSBNYXJrZXRwbGFjZSBxdWVyeSBmb3IgZmV0Y2hpbmcgZXh0ZW5zaW9ucyc7XG5cdFx0XHRcdFx0XHRleHRlbnNpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdFeHRlbnNpb24gaWQnIH07XG5cdFx0XHRcdFx0XHRwcmVSZWxlYXNlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnR2V0IHByZS1yZWxlYXNlIHZlcnNpb24nIH07XG5cdFx0XHRcdFx0XHRjb21wYXRpYmxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnR2V0IGNvbXBhdGlibGUgdmVyc2lvbicgfTtcblx0XHRcdFx0XHRcdGZyb21GYWxsYmFjazogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0Zyb20gZmFsbGJhY2snIH07XG5cdFx0XHRcdFx0fT4oJ2dhbGxlcnlTZXJ2aWNlOmZhbGxiYWNrdG9xdWVyeScsIHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbjogZXh0ZW5zaW9uSW5mby5pZCxcblx0XHRcdFx0XHRcdHByZVJlbGVhc2U6ICEhZXh0ZW5zaW9uSW5mby5wcmVSZWxlYXNlLFxuXHRcdFx0XHRcdFx0Y29tcGF0aWJsZTogISFvcHRpb25zLmNvbXBhdGlibGUsXG5cdFx0XHRcdFx0XHRmcm9tRmFsbGJhY2s6ICEhcmVzb3VyY2VBcGkuZmFsbGJhY2tcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0dG9RdWVyeS5wdXNoKGV4dGVuc2lvbkluZm8pO1xuXHRcdFx0fVxuXG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRvUXVlcnkubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5nZXRFeHRlbnNpb25zVXNpbmdRdWVyeUFwaSh0b1F1ZXJ5LCBvcHRpb25zLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblx0XHRcdHJlc3VsdC5wdXNoKC4uLmV4dGVuc2lvbnMpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldExhdGVzdEdhbGxlcnlFeHRlbnNpb24oZXh0ZW5zaW9uSW5mbzogSUV4dGVuc2lvbkluZm8sIG9wdGlvbnM6IElFeHRlbnNpb25RdWVyeU9wdGlvbnMsIHJlc291cmNlVXJpVGVtcGxhdGU6IHN0cmluZywgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0OiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCB8ICdOT1RfRk9VTkQnPiB7XG5cdFx0Y29uc3QgW3B1Ymxpc2hlciwgbmFtZV0gPSBleHRlbnNpb25JbmZvLmlkLnNwbGl0KCcuJyk7XG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKGZvcm1hdDIocmVzb3VyY2VVcmlUZW1wbGF0ZSwgeyBwdWJsaXNoZXIsIG5hbWUgfSkpO1xuXHRcdGNvbnN0IHJhd0dhbGxlcnlFeHRlbnNpb24gPSBhd2FpdCB0aGlzLmdldExhdGVzdFJhd0dhbGxlcnlFeHRlbnNpb24oZXh0ZW5zaW9uSW5mby5pZCwgdXJpLCB0b2tlbik7XG5cblx0XHRpZiAoIXJhd0dhbGxlcnlFeHRlbnNpb24pIHtcblx0XHRcdHJldHVybiAnTk9UX0ZPVU5EJztcblx0XHR9XG5cblx0XHRjb25zdCBhbGxUYXJnZXRQbGF0Zm9ybXMgPSBnZXRBbGxUYXJnZXRQbGF0Zm9ybXMocmF3R2FsbGVyeUV4dGVuc2lvbik7XG5cdFx0Y29uc3QgcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24gPSBhd2FpdCB0aGlzLmdldFJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKFxuXHRcdFx0cmF3R2FsbGVyeUV4dGVuc2lvbixcblx0XHRcdHtcblx0XHRcdFx0dGFyZ2V0UGxhdGZvcm06IG9wdGlvbnMudGFyZ2V0UGxhdGZvcm0gPz8gQ1VSUkVOVF9UQVJHRVRfUExBVEZPUk0sXG5cdFx0XHRcdGNvbXBhdGlibGU6ICEhb3B0aW9ucy5jb21wYXRpYmxlLFxuXHRcdFx0XHRwcm9kdWN0VmVyc2lvbjogb3B0aW9ucy5wcm9kdWN0VmVyc2lvbiA/PyB7XG5cdFx0XHRcdFx0dmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLFxuXHRcdFx0XHRcdGRhdGU6IHRoaXMucHJvZHVjdFNlcnZpY2UuZGF0ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR2ZXJzaW9uOiBleHRlbnNpb25JbmZvLnByZVJlbGVhc2UgPyBWZXJzaW9uS2luZC5QcmVyZWxlYXNlIDogVmVyc2lvbktpbmQuUmVsZWFzZVxuXHRcdFx0fSwgYWxsVGFyZ2V0UGxhdGZvcm1zKTtcblxuXHRcdGlmIChyYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIHRvRXh0ZW5zaW9uKHJhd0dhbGxlcnlFeHRlbnNpb24sIHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCBhbGxUYXJnZXRQbGF0Zm9ybXMsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyBnZXRDb21wYXRpYmxlRXh0ZW5zaW9uKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIGluY2x1ZGVQcmVSZWxlYXNlOiBib29sZWFuLCB0YXJnZXRQbGF0Zm9ybTogVGFyZ2V0UGxhdGZvcm0sIHByb2R1Y3RWZXJzaW9uOiBJUHJvZHVjdFZlcnNpb24gPSB7IHZlcnNpb246IHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgZGF0ZTogdGhpcy5wcm9kdWN0U2VydmljZS5kYXRlIH0pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbD4ge1xuXHRcdGlmIChpc05vdFdlYkV4dGVuc2lvbkluV2ViVGFyZ2V0UGxhdGZvcm0oZXh0ZW5zaW9uLmFsbFRhcmdldFBsYXRmb3JtcywgdGFyZ2V0UGxhdGZvcm0pKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKGF3YWl0IHRoaXMuaXNFeHRlbnNpb25Db21wYXRpYmxlKGV4dGVuc2lvbiwgaW5jbHVkZVByZVJlbGVhc2UsIHRhcmdldFBsYXRmb3JtKSkge1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmlzQWxsb3dlZCh7IGlkOiBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgcHVibGlzaGVyRGlzcGxheU5hbWU6IGV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSB9KSAhPT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0RXh0ZW5zaW9ucyhbe1xuXHRcdFx0Li4uZXh0ZW5zaW9uLmlkZW50aWZpZXIsXG5cdFx0XHRwcmVSZWxlYXNlOiBpbmNsdWRlUHJlUmVsZWFzZSxcblx0XHRcdGhhc1ByZVJlbGVhc2U6IGV4dGVuc2lvbi5oYXNQcmVSZWxlYXNlVmVyc2lvbixcblx0XHR9XSwge1xuXHRcdFx0Y29tcGF0aWJsZTogdHJ1ZSxcblx0XHRcdHByb2R1Y3RWZXJzaW9uLFxuXHRcdFx0cXVlcnlBbGxWZXJzaW9uczogdHJ1ZSxcblx0XHRcdHRhcmdldFBsYXRmb3JtLFxuXHRcdH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdFswXSA/PyBudWxsO1xuXHR9XG5cblx0YXN5bmMgaXNFeHRlbnNpb25Db21wYXRpYmxlKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIGluY2x1ZGVQcmVSZWxlYXNlOiBib29sZWFuLCB0YXJnZXRQbGF0Zm9ybTogVGFyZ2V0UGxhdGZvcm0sIHByb2R1Y3RWZXJzaW9uOiBJUHJvZHVjdFZlcnNpb24gPSB7IHZlcnNpb246IHRoaXMucHJvZHVjdFNlcnZpY2UudmVyc2lvbiwgZGF0ZTogdGhpcy5wcm9kdWN0U2VydmljZS5kYXRlIH0pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAodGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKGV4dGVuc2lvbikgIT09IHRydWUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIWlzVGFyZ2V0UGxhdGZvcm1Db21wYXRpYmxlKGV4dGVuc2lvbi5wcm9wZXJ0aWVzLnRhcmdldFBsYXRmb3JtLCBleHRlbnNpb24uYWxsVGFyZ2V0UGxhdGZvcm1zLCB0YXJnZXRQbGF0Zm9ybSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIWluY2x1ZGVQcmVSZWxlYXNlICYmIGV4dGVuc2lvbi5wcm9wZXJ0aWVzLmlzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdC8vIFByZS1yZWxlYXNlcyBhcmUgbm90IGFsbG93ZWQgd2hlbiBpbmNsdWRlIHByZS1yZWxlYXNlIGZsYWcgaXMgbm90IHNldFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCBlbmdpbmUgPSBleHRlbnNpb24ucHJvcGVydGllcy5lbmdpbmU7XG5cdFx0aWYgKCFlbmdpbmUpIHtcblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5nZXRNYW5pZmVzdChleHRlbnNpb24sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0aWYgKCFtYW5pZmVzdCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01hbmlmZXN0IHdhcyBub3QgZm91bmQnKTtcblx0XHRcdH1cblx0XHRcdGVuZ2luZSA9IG1hbmlmZXN0LmVuZ2luZXMudnNjb2RlO1xuXHRcdH1cblxuXHRcdGlmICghaXNFbmdpbmVWYWxpZChlbmdpbmUsIHByb2R1Y3RWZXJzaW9uLnZlcnNpb24sIHByb2R1Y3RWZXJzaW9uLmRhdGUpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5wcm9wZXJ0aWVzLmVuYWJsZWRBcGlQcm9wb3NhbHMpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoZXh0ZW5zaW9uSWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIsIGVuYWJsZWRBcGlQcm9wb3NhbHM6IHN0cmluZ1tdIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFlbmFibGVkQXBpUHJvcG9zYWxzKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbnNFbmFibGVkV2l0aEFwaVByb3Bvc2FsVmVyc2lvbi5pbmNsdWRlcyhleHRlbnNpb25JZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoZW5hYmxlZEFwaVByb3Bvc2Fscyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGlzVmFsaWRWZXJzaW9uKFxuXHRcdGV4dGVuc2lvbjogc3RyaW5nLFxuXHRcdHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uOiBJUmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24sXG5cdFx0eyB0YXJnZXRQbGF0Zm9ybSwgY29tcGF0aWJsZSwgcHJvZHVjdFZlcnNpb24sIHZlcnNpb24gfTogRXh0ZW5zaW9uVmVyc2lvbkNyaXRlcmlhLFxuXHRcdHB1Ymxpc2hlckRpc3BsYXlOYW1lOiBzdHJpbmcsXG5cdFx0YWxsVGFyZ2V0UGxhdGZvcm1zOiBUYXJnZXRQbGF0Zm9ybVtdXG5cdCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gU3BlY2lmaWMgdmVyc2lvblxuXHRcdGlmIChpc1N0cmluZyh2ZXJzaW9uKSkge1xuXHRcdFx0aWYgKHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLnZlcnNpb24gIT09IHZlcnNpb24pIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFByZXJlbGVhc2Ugb3IgcmVsZWFzZSB2ZXJzaW9uIGtpbmRcblx0XHRlbHNlIGlmICh2ZXJzaW9uID09PSBWZXJzaW9uS2luZC5SZWxlYXNlIHx8IHZlcnNpb24gPT09IFZlcnNpb25LaW5kLlByZXJlbGVhc2UpIHtcblx0XHRcdGlmIChpc1ByZVJlbGVhc2VWZXJzaW9uKHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKSAhPT0gKHZlcnNpb24gPT09IFZlcnNpb25LaW5kLlByZXJlbGVhc2UpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybUZvckV4dGVuc2lvbiA9IGdldFRhcmdldFBsYXRmb3JtRm9yRXh0ZW5zaW9uVmVyc2lvbihyYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik7XG5cdFx0aWYgKCFpc1RhcmdldFBsYXRmb3JtQ29tcGF0aWJsZSh0YXJnZXRQbGF0Zm9ybUZvckV4dGVuc2lvbiwgYWxsVGFyZ2V0UGxhdGZvcm1zLCB0YXJnZXRQbGF0Zm9ybSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoY29tcGF0aWJsZSkge1xuXHRcdFx0aWYgKHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmlzQWxsb3dlZCh7IGlkOiBleHRlbnNpb24sIHB1Ymxpc2hlckRpc3BsYXlOYW1lLCB2ZXJzaW9uOiByYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbi52ZXJzaW9uLCBwcmVyZWxlYXNlOiBpc1ByZVJlbGVhc2VWZXJzaW9uKHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKSwgdGFyZ2V0UGxhdGZvcm06IHRhcmdldFBsYXRmb3JtRm9yRXh0ZW5zaW9uIH0pICE9PSB0cnVlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGVuZ2luZSA9IGF3YWl0IHRoaXMuZ2V0RW5naW5lKGV4dGVuc2lvbiwgcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24pO1xuXHRcdFx0XHRpZiAoIWlzRW5naW5lVmFsaWQoZW5naW5lLCBwcm9kdWN0VmVyc2lvbi52ZXJzaW9uLCBwcm9kdWN0VmVyc2lvbi5kYXRlKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBFcnJvciB3aGlsZSBnZXR0aW5nIHRoZSBlbmdpbmUgZm9yIHRoZSB2ZXJzaW9uICR7cmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24udmVyc2lvbn0uYCwgZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGFzeW5jIHF1ZXJ5KG9wdGlvbnM6IElRdWVyeU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVBhZ2VyPElHYWxsZXJ5RXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5nZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QoKTtcblxuXHRcdGlmICghZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIGV4dGVuc2lvbiBnYWxsZXJ5IHNlcnZpY2UgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRsZXQgdGV4dCA9IG9wdGlvbnMudGV4dCB8fCAnJztcblx0XHRjb25zdCBwYWdlU2l6ZSA9IG9wdGlvbnMucGFnZVNpemUgPz8gNTA7XG5cblx0XHRsZXQgcXVlcnkgPSBuZXcgUXVlcnkoKVxuXHRcdFx0LndpdGhQYWdlKDEsIHBhZ2VTaXplKTtcblxuXHRcdGlmICh0ZXh0KSB7XG5cdFx0XHQvLyBVc2UgY2F0ZWdvcnkgZmlsdGVyIGluc3RlYWQgb2YgXCJjYXRlZ29yeTp0aGVtZXNcIlxuXHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxiY2F0ZWdvcnk6KFwiKFteXCJdKilcInwoW15cIl1cXFMqKSkoXFxzK3xcXGJ8JCkvZywgKF8sIHF1b3RlZENhdGVnb3J5LCBjYXRlZ29yeSkgPT4ge1xuXHRcdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5DYXRlZ29yeSwgY2F0ZWdvcnkgfHwgcXVvdGVkQ2F0ZWdvcnkpO1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gVXNlIHRhZyBmaWx0ZXIgaW5zdGVhZCBvZiBcInRhZzpkZWJ1Z2dlcnNcIlxuXHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxidGFnOihcIihbXlwiXSopXCJ8KFteXCJdXFxTKikpKFxccyt8XFxifCQpL2csIChfLCBxdW90ZWRUYWcsIHRhZykgPT4ge1xuXHRcdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5UYWcsIHRhZyB8fCBxdW90ZWRUYWcpO1xuXHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gVXNlIGZlYXR1cmVkIGZpbHRlclxuXHRcdFx0dGV4dCA9IHRleHQucmVwbGFjZSgvXFxiZmVhdHVyZWQoXFxzK3xcXGJ8JCkvZywgKCkgPT4ge1xuXHRcdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5GZWF0dXJlZCk7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH0pO1xuXG5cdFx0XHR0ZXh0ID0gdGV4dC50cmltKCk7XG5cblx0XHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRcdHRleHQgPSB0ZXh0Lmxlbmd0aCA8IDIwMCA/IHRleHQgOiB0ZXh0LnN1YnN0cmluZygwLCAyMDApO1xuXHRcdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5TZWFyY2hUZXh0LCB0ZXh0KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdC5jYXBhYmlsaXRpZXMuZXh0ZW5zaW9uUXVlcnkuc29ydGluZz8uc29tZShjID0+IGMubmFtZSA9PT0gU29ydEJ5Lk5vbmVPclJlbGV2YW5jZSkpIHtcblx0XHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoU29ydEJ5KFNvcnRCeS5Ob25lT3JSZWxldmFuY2UpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LmNhcGFiaWxpdGllcy5leHRlbnNpb25RdWVyeS5zb3J0aW5nPy5zb21lKGMgPT4gYy5uYW1lID09PSBTb3J0QnkuSW5zdGFsbENvdW50KSkge1xuXHRcdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhTb3J0QnkoU29ydEJ5Lkluc3RhbGxDb3VudCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMuc29ydEJ5ICYmIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdC5jYXBhYmlsaXRpZXMuZXh0ZW5zaW9uUXVlcnkuc29ydGluZz8uc29tZShjID0+IGMubmFtZSA9PT0gb3B0aW9ucy5zb3J0QnkpKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhTb3J0Qnkob3B0aW9ucy5zb3J0QnkpO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucy5zb3J0T3JkZXIgPT09ICdudW1iZXInKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhTb3J0T3JkZXIob3B0aW9ucy5zb3J0T3JkZXIpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLnNvdXJjZSkge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoU291cmNlKG9wdGlvbnMuc291cmNlKTtcblx0XHR9XG5cblx0XHRjb25zdCBydW5RdWVyeSA9IGFzeW5jIChxdWVyeTogUXVlcnksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0Y29uc3QgeyBleHRlbnNpb25zLCB0b3RhbCB9ID0gYXdhaXQgdGhpcy5xdWVyeUdhbGxlcnlFeHRlbnNpb25zKHF1ZXJ5LCB7IHRhcmdldFBsYXRmb3JtOiBDVVJSRU5UX1RBUkdFVF9QTEFURk9STSwgY29tcGF0aWJsZTogZmFsc2UsIGluY2x1ZGVQcmVSZWxlYXNlOiAhIW9wdGlvbnMuaW5jbHVkZVByZVJlbGVhc2UsIHByb2R1Y3RWZXJzaW9uOiBvcHRpb25zLnByb2R1Y3RWZXJzaW9uID8/IHsgdmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBkYXRlOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfSB9LCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblx0XHRcdGV4dGVuc2lvbnMuZm9yRWFjaCgoZSwgaW5kZXgpID0+IHNldFRlbGVtZXRyeShlLCAoKHF1ZXJ5LnBhZ2VOdW1iZXIgLSAxKSAqIHF1ZXJ5LnBhZ2VTaXplKSArIGluZGV4LCBvcHRpb25zLnNvdXJjZSkpO1xuXHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucywgdG90YWwgfTtcblx0XHR9O1xuXHRcdGNvbnN0IHsgZXh0ZW5zaW9ucywgdG90YWwgfSA9IGF3YWl0IHJ1blF1ZXJ5KHF1ZXJ5LCB0b2tlbik7XG5cdFx0Y29uc3QgZ2V0UGFnZSA9IGFzeW5jIChwYWdlSW5kZXg6IG51bWJlciwgY3Q6IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRpZiAoY3QuaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB7IGV4dGVuc2lvbnMgfSA9IGF3YWl0IHJ1blF1ZXJ5KHF1ZXJ5LndpdGhQYWdlKHBhZ2VJbmRleCArIDEpLCBjdCk7XG5cdFx0XHRyZXR1cm4gZXh0ZW5zaW9ucztcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHsgZmlyc3RQYWdlOiBleHRlbnNpb25zLCB0b3RhbCwgcGFnZVNpemU6IHF1ZXJ5LnBhZ2VTaXplLCBnZXRQYWdlIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHF1ZXJ5R2FsbGVyeUV4dGVuc2lvbnMocXVlcnk6IFF1ZXJ5LCBjcml0ZXJpYTogRXh0ZW5zaW9uc0NyaXRlcmlhLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBleHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdOyB0b3RhbDogbnVtYmVyIH0+IHtcblx0XHRpZiAoXG5cdFx0XHR0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgIT09ICdzdGFibGUnXG5cdFx0XHQmJiAoYXdhaXQgdGhpcy5hc3NpZ25tZW50U2VydmljZT8uZ2V0VHJlYXRtZW50PGJvb2xlYW4+KCd1c2VMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbkZsYWcnKSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB0aGlzLnF1ZXJ5R2FsbGVyeUV4dGVuc2lvbnNVc2luZ0luY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbkZsYWcocXVlcnksIGNyaXRlcmlhLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5xdWVyeUdhbGxlcnlFeHRlbnNpb25zV2l0aEFsbFZlcnNpb25zQXNGYWxsYmFjayhxdWVyeSwgY3JpdGVyaWEsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBxdWVyeUdhbGxlcnlFeHRlbnNpb25zV2l0aEFsbFZlcnNpb25zQXNGYWxsYmFjayhxdWVyeTogUXVlcnksIGNyaXRlcmlhOiBFeHRlbnNpb25zQ3JpdGVyaWEsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdDogSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGV4dGVuc2lvbnM6IElHYWxsZXJ5RXh0ZW5zaW9uW107IHRvdGFsOiBudW1iZXIgfT4ge1xuXHRcdGNvbnN0IGZsYWdzID0gcXVlcnkuZmxhZ3M7XG5cblx0XHQvKipcblx0XHQgKiBJZiBib3RoIHZlcnNpb24gZmxhZ3MgKEluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSBhbmQgSW5jbHVkZVZlcnNpb25zKSBhcmUgaW5jbHVkZWQsIHRoZW4gb25seSBpbmNsdWRlIGxhdGVzdCB2ZXJzaW9ucyAoSW5jbHVkZUxhdGVzdFZlcnNpb25Pbmx5KSBmbGFnLlxuXHRcdCAqL1xuXHRcdGlmIChxdWVyeS5mbGFncy5pbmNsdWRlcyhGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSkgJiYgcXVlcnkuZmxhZ3MuaW5jbHVkZXMoRmxhZy5JbmNsdWRlVmVyc2lvbnMpKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGbGFncyguLi5xdWVyeS5mbGFncy5maWx0ZXIoZmxhZyA9PiBmbGFnICE9PSBGbGFnLkluY2x1ZGVWZXJzaW9ucykpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIElmIHZlcnNpb24gZmxhZ3MgKEluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSBhbmQgSW5jbHVkZVZlcnNpb25zKSBhcmUgbm90IGluY2x1ZGVkLCBkZWZhdWx0IGlzIHRvIHF1ZXJ5IGZvciBsYXRlc3QgdmVyc2lvbnMgKEluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSkuXG5cdFx0ICovXG5cdFx0aWYgKCFxdWVyeS5mbGFncy5pbmNsdWRlcyhGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSkgJiYgIXF1ZXJ5LmZsYWdzLmluY2x1ZGVzKEZsYWcuSW5jbHVkZVZlcnNpb25zKSkge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoRmxhZ3MoLi4ucXVlcnkuZmxhZ3MsIEZsYWcuSW5jbHVkZUxhdGVzdFZlcnNpb25Pbmx5KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBJZiB2ZXJzaW9ucyBjcml0ZXJpYSBleGlzdCBvciBldmVyeSByZXF1ZXN0ZWQgZXh0ZW5zaW9uIGlzIGZvciByZWxlYXNlIHZlcnNpb24gYW5kIGhhcyBhIHByZS1yZWxlYXNlIHZlcnNpb24sIHRoZW4gcmVtb3ZlIGxhdGVzdCBmbGFncyBhbmQgYWRkIGFsbCB2ZXJzaW9ucyBmbGFnLlxuXHRcdCAqL1xuXHRcdGlmIChjcml0ZXJpYS52ZXJzaW9ucz8ubGVuZ3RoIHx8IGNyaXRlcmlhLmlzUXVlcnlGb3JSZWxlYXNlVmVyc2lvbkZyb21QcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoRmxhZ3MoLi4ucXVlcnkuZmxhZ3MuZmlsdGVyKGZsYWcgPT4gZmxhZyAhPT0gRmxhZy5JbmNsdWRlTGF0ZXN0VmVyc2lvbk9ubHkpLCBGbGFnLkluY2x1ZGVWZXJzaW9ucyk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQWRkIG5lY2Vzc2FyeSBleHRlbnNpb24gZmxhZ3Ncblx0XHQgKi9cblx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGbGFncyguLi5xdWVyeS5mbGFncywgRmxhZy5JbmNsdWRlQXNzZXRVcmksIEZsYWcuSW5jbHVkZUNhdGVnb3J5QW5kVGFncywgRmxhZy5JbmNsdWRlRmlsZXMsIEZsYWcuSW5jbHVkZVN0YXRpc3RpY3MsIEZsYWcuSW5jbHVkZVZlcnNpb25Qcm9wZXJ0aWVzKTtcblx0XHRjb25zdCB7IGdhbGxlcnlFeHRlbnNpb25zOiByYXdHYWxsZXJ5RXh0ZW5zaW9ucywgdG90YWwsIGNvbnRleHQgfSA9IGF3YWl0IHRoaXMucXVlcnlSYXdHYWxsZXJ5RXh0ZW5zaW9ucyhxdWVyeSwgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCB0b2tlbik7XG5cblx0XHRjb25zdCBoYXNBbGxWZXJzaW9uczogYm9vbGVhbiA9ICFxdWVyeS5mbGFncy5pbmNsdWRlcyhGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSk7XG5cdFx0aWYgKGhhc0FsbFZlcnNpb25zKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHJhd0dhbGxlcnlFeHRlbnNpb24gb2YgcmF3R2FsbGVyeUV4dGVuc2lvbnMpIHtcblx0XHRcdFx0Y29uc3QgYWxsVGFyZ2V0UGxhdGZvcm1zID0gZ2V0QWxsVGFyZ2V0UGxhdGZvcm1zKHJhd0dhbGxlcnlFeHRlbnNpb24pO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25JZGVudGlmaWVyID0geyBpZDogZ2V0R2FsbGVyeUV4dGVuc2lvbklkKHJhd0dhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLnB1Ymxpc2hlck5hbWUsIHJhd0dhbGxlcnlFeHRlbnNpb24uZXh0ZW5zaW9uTmFtZSksIHV1aWQ6IHJhd0dhbGxlcnlFeHRlbnNpb24uZXh0ZW5zaW9uSWQgfTtcblx0XHRcdFx0Y29uc3QgaW5jbHVkZVByZVJlbGVhc2UgPSBpc0Jvb2xlYW4oY3JpdGVyaWEuaW5jbHVkZVByZVJlbGVhc2UpID8gY3JpdGVyaWEuaW5jbHVkZVByZVJlbGVhc2UgOiAhIWNyaXRlcmlhLmluY2x1ZGVQcmVSZWxlYXNlLmZpbmQoZXh0ZW5zaW9uSWRlbnRpZmllcldpdGhQcmVSZWxlYXNlID0+IGFyZVNhbWVFeHRlbnNpb25zKGV4dGVuc2lvbklkZW50aWZpZXJXaXRoUHJlUmVsZWFzZSwgZXh0ZW5zaW9uSWRlbnRpZmllcikpPy5pbmNsdWRlUHJlUmVsZWFzZTtcblx0XHRcdFx0Y29uc3QgcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24gPSBhd2FpdCB0aGlzLmdldFJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKFxuXHRcdFx0XHRcdHJhd0dhbGxlcnlFeHRlbnNpb24sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Y29tcGF0aWJsZTogY3JpdGVyaWEuY29tcGF0aWJsZSxcblx0XHRcdFx0XHRcdHRhcmdldFBsYXRmb3JtOiBjcml0ZXJpYS50YXJnZXRQbGF0Zm9ybSxcblx0XHRcdFx0XHRcdHByb2R1Y3RWZXJzaW9uOiBjcml0ZXJpYS5wcm9kdWN0VmVyc2lvbixcblx0XHRcdFx0XHRcdHZlcnNpb246IGNyaXRlcmlhLnZlcnNpb25zPy5maW5kKGV4dGVuc2lvbklkZW50aWZpZXJXaXRoVmVyc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhleHRlbnNpb25JZGVudGlmaWVyV2l0aFZlcnNpb24sIGV4dGVuc2lvbklkZW50aWZpZXIpKT8udmVyc2lvblxuXHRcdFx0XHRcdFx0XHQ/PyAoaW5jbHVkZVByZVJlbGVhc2UgPyBWZXJzaW9uS2luZC5MYXRlc3QgOiBWZXJzaW9uS2luZC5SZWxlYXNlKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0YWxsVGFyZ2V0UGxhdGZvcm1zXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmIChyYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbikge1xuXHRcdFx0XHRcdGV4dGVuc2lvbnMucHVzaCh0b0V4dGVuc2lvbihyYXdHYWxsZXJ5RXh0ZW5zaW9uLCByYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbiwgYWxsVGFyZ2V0UGxhdGZvcm1zLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIGNvbnRleHQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgZXh0ZW5zaW9ucywgdG90YWwgfTtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IFtudW1iZXIsIElHYWxsZXJ5RXh0ZW5zaW9uXVtdID0gW107XG5cdFx0Y29uc3QgbmVlZEFsbFZlcnNpb25zID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcmF3R2FsbGVyeUV4dGVuc2lvbnMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCByYXdHYWxsZXJ5RXh0ZW5zaW9uID0gcmF3R2FsbGVyeUV4dGVuc2lvbnNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uSWRlbnRpZmllciA9IHsgaWQ6IGdldEdhbGxlcnlFeHRlbnNpb25JZChyYXdHYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5wdWJsaXNoZXJOYW1lLCByYXdHYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbk5hbWUpLCB1dWlkOiByYXdHYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbklkIH07XG5cdFx0XHRjb25zdCBpbmNsdWRlUHJlUmVsZWFzZSA9IGlzQm9vbGVhbihjcml0ZXJpYS5pbmNsdWRlUHJlUmVsZWFzZSkgPyBjcml0ZXJpYS5pbmNsdWRlUHJlUmVsZWFzZSA6ICEhY3JpdGVyaWEuaW5jbHVkZVByZVJlbGVhc2UuZmluZChleHRlbnNpb25JZGVudGlmaWVyV2l0aFByZVJlbGVhc2UgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZXh0ZW5zaW9uSWRlbnRpZmllcldpdGhQcmVSZWxlYXNlLCBleHRlbnNpb25JZGVudGlmaWVyKSk/LmluY2x1ZGVQcmVSZWxlYXNlO1xuXHRcdFx0Y29uc3QgYWxsVGFyZ2V0UGxhdGZvcm1zID0gZ2V0QWxsVGFyZ2V0UGxhdGZvcm1zKHJhd0dhbGxlcnlFeHRlbnNpb24pO1xuXHRcdFx0aWYgKGNyaXRlcmlhLmNvbXBhdGlibGUpIHtcblx0XHRcdFx0Ly8gU2tpcCBsb29raW5nIGZvciBhbGwgdmVyc2lvbnMgaWYgcmVxdWVzdGVkIGZvciBhIHdlYi1jb21wYXRpYmxlIGV4dGVuc2lvbiBhbmQgaXQgaXMgbm90IGEgd2ViIGV4dGVuc2lvbi5cblx0XHRcdFx0aWYgKGlzTm90V2ViRXh0ZW5zaW9uSW5XZWJUYXJnZXRQbGF0Zm9ybShhbGxUYXJnZXRQbGF0Zm9ybXMsIGNyaXRlcmlhLnRhcmdldFBsYXRmb3JtKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFNraXAgbG9va2luZyBmb3IgYWxsIHZlcnNpb25zIGlmIHRoZSBleHRlbnNpb24gaXMgbm90IGFsbG93ZWQuXG5cdFx0XHRcdGlmICh0aGlzLmFsbG93ZWRFeHRlbnNpb25zU2VydmljZS5pc0FsbG93ZWQoeyBpZDogZXh0ZW5zaW9uSWRlbnRpZmllci5pZCwgcHVibGlzaGVyRGlzcGxheU5hbWU6IHJhd0dhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLmRpc3BsYXlOYW1lIH0pICE9PSB0cnVlKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uID0gYXdhaXQgdGhpcy5nZXRSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbihcblx0XHRcdFx0cmF3R2FsbGVyeUV4dGVuc2lvbixcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbXBhdGlibGU6IGNyaXRlcmlhLmNvbXBhdGlibGUsXG5cdFx0XHRcdFx0dGFyZ2V0UGxhdGZvcm06IGNyaXRlcmlhLnRhcmdldFBsYXRmb3JtLFxuXHRcdFx0XHRcdHByb2R1Y3RWZXJzaW9uOiBjcml0ZXJpYS5wcm9kdWN0VmVyc2lvbixcblx0XHRcdFx0XHR2ZXJzaW9uOiBjcml0ZXJpYS52ZXJzaW9ucz8uZmluZChleHRlbnNpb25JZGVudGlmaWVyV2l0aFZlcnNpb24gPT4gYXJlU2FtZUV4dGVuc2lvbnMoZXh0ZW5zaW9uSWRlbnRpZmllcldpdGhWZXJzaW9uLCBleHRlbnNpb25JZGVudGlmaWVyKSk/LnZlcnNpb25cblx0XHRcdFx0XHRcdD8/IChpbmNsdWRlUHJlUmVsZWFzZSA/IFZlcnNpb25LaW5kLkxhdGVzdCA6IFZlcnNpb25LaW5kLlJlbGVhc2UpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFsbFRhcmdldFBsYXRmb3Jtc1xuXHRcdFx0KTtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uID8gdG9FeHRlbnNpb24ocmF3R2FsbGVyeUV4dGVuc2lvbiwgcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24sIGFsbFRhcmdldFBsYXRmb3JtcywgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCBjb250ZXh0KSA6IG51bGw7XG5cdFx0XHRpZiAoIWV4dGVuc2lvblxuXHRcdFx0XHQvKiogTmVlZCBhbGwgdmVyc2lvbnMgaWYgdGhlIGV4dGVuc2lvbiBpcyBhIHByZS1yZWxlYXNlIHZlcnNpb24gYnV0XG5cdFx0XHRcdCAqIFx0XHQtIHRoZSBxdWVyeSBpcyB0byBsb29rIGZvciBhIHJlbGVhc2UgdmVyc2lvbiBvclxuXHRcdFx0XHQgKiBcdFx0LSB0aGUgZXh0ZW5zaW9uIGhhcyBubyByZWxlYXNlIHZlcnNpb25cblx0XHRcdFx0ICogR2V0IGFsbCB2ZXJzaW9ucyB0byBnZXQgb3IgY2hlY2sgdGhlIHJlbGVhc2UgdmVyc2lvblxuXHRcdFx0XHQqL1xuXHRcdFx0XHR8fCAoZXh0ZW5zaW9uLnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbiAmJiAoIWluY2x1ZGVQcmVSZWxlYXNlIHx8ICFleHRlbnNpb24uaGFzUmVsZWFzZVZlcnNpb24pKVxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogTmVlZCBhbGwgdmVyc2lvbnMgaWYgdGhlIGV4dGVuc2lvbiBpcyBhIHJlbGVhc2UgdmVyc2lvbiB3aXRoIGEgZGlmZmVyZW50IHRhcmdldCBwbGF0Zm9ybSB0aGFuIHJlcXVlc3RlZCBhbmQgYWxzbyBoYXMgYSBwcmUtcmVsZWFzZSB2ZXJzaW9uXG5cdFx0XHRcdCAqIEJlY2F1c2UsIHRoaXMgaXMgYSBwbGF0Zm9ybSBzcGVjaWZpYyBleHRlbnNpb24gYW5kIGNhbiBoYXZlIGEgbmV3ZXIgcmVsZWFzZSB2ZXJzaW9uIHN1cHBvcnRpbmcgdGhpcyBwbGF0Zm9ybS5cblx0XHRcdFx0ICogU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzk2Mjhcblx0XHRcdFx0Ki9cblx0XHRcdFx0fHwgKCFleHRlbnNpb24ucHJvcGVydGllcy5pc1ByZVJlbGVhc2VWZXJzaW9uICYmIGV4dGVuc2lvbi5wcm9wZXJ0aWVzLnRhcmdldFBsYXRmb3JtICE9PSBjcml0ZXJpYS50YXJnZXRQbGF0Zm9ybSAmJiBleHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24pXG5cdFx0XHQpIHtcblx0XHRcdFx0bmVlZEFsbFZlcnNpb25zLnNldChyYXdHYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbklkLCBpbmRleCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChbaW5kZXgsIGV4dGVuc2lvbl0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChuZWVkQWxsVmVyc2lvbnMuc2l6ZSkge1xuXHRcdFx0Y29uc3Qgc3RvcFdhdGNoID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBuZXcgUXVlcnkoKVxuXHRcdFx0XHQud2l0aEZsYWdzKC4uLmZsYWdzLmZpbHRlcihmbGFnID0+IGZsYWcgIT09IEZsYWcuSW5jbHVkZUxhdGVzdFZlcnNpb25Pbmx5KSwgRmxhZy5JbmNsdWRlVmVyc2lvbnMpXG5cdFx0XHRcdC53aXRoUGFnZSgxLCBuZWVkQWxsVmVyc2lvbnMuc2l6ZSlcblx0XHRcdFx0LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5FeHRlbnNpb25JZCwgLi4ubmVlZEFsbFZlcnNpb25zLmtleXMoKSk7XG5cdFx0XHRjb25zdCB7IGV4dGVuc2lvbnMgfSA9IGF3YWl0IHRoaXMucXVlcnlHYWxsZXJ5RXh0ZW5zaW9ucyhxdWVyeSwgY3JpdGVyaWEsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgdG9rZW4pO1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2FsbGVyeVNlcnZpY2VBZGRpdGlvbmFsUXVlcnlFdmVudCwgR2FsbGVyeVNlcnZpY2VBZGRpdGlvbmFsUXVlcnlDbGFzc2lmaWNhdGlvbj4oJ2dhbGxlcnlTZXJ2aWNlOmFkZGl0aW9uYWxRdWVyeScsIHtcblx0XHRcdFx0ZHVyYXRpb246IHN0b3BXYXRjaC5lbGFwc2VkKCksXG5cdFx0XHRcdGNvdW50OiBuZWVkQWxsVmVyc2lvbnMuc2l6ZVxuXHRcdFx0fSk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gbmVlZEFsbFZlcnNpb25zLmdldChleHRlbnNpb24uaWRlbnRpZmllci51dWlkKSE7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKFtpbmRleCwgZXh0ZW5zaW9uXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgZXh0ZW5zaW9uczogcmVzdWx0LnNvcnQoKGEsIGIpID0+IGFbMF0gLSBiWzBdKS5tYXAoKFssIGV4dGVuc2lvbl0pID0+IGV4dGVuc2lvbiksIHRvdGFsIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHF1ZXJ5R2FsbGVyeUV4dGVuc2lvbnNVc2luZ0luY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbkZsYWcocXVlcnk6IFF1ZXJ5LCBjcml0ZXJpYTogRXh0ZW5zaW9uc0NyaXRlcmlhLCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBleHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdOyB0b3RhbDogbnVtYmVyIH0+IHtcblxuXHRcdC8qKlxuXHRcdCAqIElmIHZlcnNpb25zIGNyaXRlcmlhIGV4aXN0LCB0aGVuIHJlbW92ZSBsYXRlc3QgZmxhZ3MgYW5kIGFkZCBhbGwgdmVyc2lvbnMgZmxhZy5cblx0XHQqL1xuXHRcdGlmIChjcml0ZXJpYS52ZXJzaW9ucz8ubGVuZ3RoKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGbGFncyguLi5xdWVyeS5mbGFncy5maWx0ZXIoZmxhZyA9PiBmbGFnICE9PSBGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSAmJiBmbGFnICE9PSBGbGFnLkluY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbk9ubHkpLCBGbGFnLkluY2x1ZGVWZXJzaW9ucyk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogSWYgdGhlIHF1ZXJ5IGRvZXMgbm90IHNwZWNpZnkgYWxsIHZlcnNpb25zIGZsYWcsIGhhbmRsZSBsYXRlc3QgdmVyc2lvbnMuXG5cdFx0ICovXG5cdFx0ZWxzZSBpZiAoIXF1ZXJ5LmZsYWdzLmluY2x1ZGVzKEZsYWcuSW5jbHVkZVZlcnNpb25zKSkge1xuXHRcdFx0Y29uc3QgaW5jbHVkZUxhdGVzdCA9IGlzQm9vbGVhbihjcml0ZXJpYS5pbmNsdWRlUHJlUmVsZWFzZSkgPyBjcml0ZXJpYS5pbmNsdWRlUHJlUmVsZWFzZSA6IGNyaXRlcmlhLmluY2x1ZGVQcmVSZWxlYXNlLmV2ZXJ5KCh7IGluY2x1ZGVQcmVSZWxlYXNlIH0pID0+IGluY2x1ZGVQcmVSZWxlYXNlKTtcblx0XHRcdHF1ZXJ5ID0gaW5jbHVkZUxhdGVzdCA/IHF1ZXJ5LndpdGhGbGFncyguLi5xdWVyeS5mbGFncy5maWx0ZXIoZmxhZyA9PiBmbGFnICE9PSBGbGFnLkluY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbk9ubHkpLCBGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSkgOiBxdWVyeS53aXRoRmxhZ3MoLi4ucXVlcnkuZmxhZ3MuZmlsdGVyKGZsYWcgPT4gZmxhZyAhPT0gRmxhZy5JbmNsdWRlTGF0ZXN0VmVyc2lvbk9ubHkpLCBGbGFnLkluY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbk9ubHkpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIElmIGFsbCB2ZXJzaW9ucyBmbGFnIGlzIHNldCwgcmVtb3ZlIGxhdGVzdCBmbGFncy5cblx0XHQgKi9cblx0XHRpZiAocXVlcnkuZmxhZ3MuaW5jbHVkZXMoRmxhZy5JbmNsdWRlVmVyc2lvbnMpICYmIChxdWVyeS5mbGFncy5pbmNsdWRlcyhGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSkgfHwgcXVlcnkuZmxhZ3MuaW5jbHVkZXMoRmxhZy5JbmNsdWRlTGF0ZXN0UHJlcmVsZWFzZUFuZFN0YWJsZVZlcnNpb25Pbmx5KSkpIHtcblx0XHRcdHF1ZXJ5ID0gcXVlcnkud2l0aEZsYWdzKC4uLnF1ZXJ5LmZsYWdzLmZpbHRlcihmbGFnID0+IGZsYWcgIT09IEZsYWcuSW5jbHVkZUxhdGVzdFZlcnNpb25Pbmx5ICYmIGZsYWcgIT09IEZsYWcuSW5jbHVkZUxhdGVzdFByZXJlbGVhc2VBbmRTdGFibGVWZXJzaW9uT25seSksIEZsYWcuSW5jbHVkZVZlcnNpb25zKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBBZGQgbmVjZXNzYXJ5IGV4dGVuc2lvbiBmbGFnc1xuXHRcdCAqL1xuXHRcdHF1ZXJ5ID0gcXVlcnkud2l0aEZsYWdzKC4uLnF1ZXJ5LmZsYWdzLCBGbGFnLkluY2x1ZGVBc3NldFVyaSwgRmxhZy5JbmNsdWRlQ2F0ZWdvcnlBbmRUYWdzLCBGbGFnLkluY2x1ZGVGaWxlcywgRmxhZy5JbmNsdWRlU3RhdGlzdGljcywgRmxhZy5JbmNsdWRlVmVyc2lvblByb3BlcnRpZXMpO1xuXHRcdGNvbnN0IHsgZ2FsbGVyeUV4dGVuc2lvbnM6IHJhd0dhbGxlcnlFeHRlbnNpb25zLCB0b3RhbCwgY29udGV4dCB9ID0gYXdhaXQgdGhpcy5xdWVyeVJhd0dhbGxlcnlFeHRlbnNpb25zKHF1ZXJ5LCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIHRva2VuKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbnM6IElHYWxsZXJ5RXh0ZW5zaW9uW10gPSBbXTtcblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcmF3R2FsbGVyeUV4dGVuc2lvbnMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCByYXdHYWxsZXJ5RXh0ZW5zaW9uID0gcmF3R2FsbGVyeUV4dGVuc2lvbnNbaW5kZXhdO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uSWRlbnRpZmllciA9IHsgaWQ6IGdldEdhbGxlcnlFeHRlbnNpb25JZChyYXdHYWxsZXJ5RXh0ZW5zaW9uLnB1Ymxpc2hlci5wdWJsaXNoZXJOYW1lLCByYXdHYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbk5hbWUpLCB1dWlkOiByYXdHYWxsZXJ5RXh0ZW5zaW9uLmV4dGVuc2lvbklkIH07XG5cdFx0XHRjb25zdCBhbGxUYXJnZXRQbGF0Zm9ybXMgPSBnZXRBbGxUYXJnZXRQbGF0Zm9ybXMocmF3R2FsbGVyeUV4dGVuc2lvbik7XG5cdFx0XHRpZiAoY3JpdGVyaWEuY29tcGF0aWJsZSkge1xuXHRcdFx0XHQvLyBTa2lwIGxvb2tpbmcgZm9yIGFsbCB2ZXJzaW9ucyBpZiByZXF1ZXN0ZWQgZm9yIGEgd2ViLWNvbXBhdGlibGUgZXh0ZW5zaW9uIGFuZCBpdCBpcyBub3QgYSB3ZWIgZXh0ZW5zaW9uLlxuXHRcdFx0XHRpZiAoaXNOb3RXZWJFeHRlbnNpb25JbldlYlRhcmdldFBsYXRmb3JtKGFsbFRhcmdldFBsYXRmb3JtcywgY3JpdGVyaWEudGFyZ2V0UGxhdGZvcm0pKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gU2tpcCBsb29raW5nIGZvciBhbGwgdmVyc2lvbnMgaWYgdGhlIGV4dGVuc2lvbiBpcyBub3QgYWxsb3dlZC5cblx0XHRcdFx0aWYgKHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmlzQWxsb3dlZCh7IGlkOiBleHRlbnNpb25JZGVudGlmaWVyLmlkLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogcmF3R2FsbGVyeUV4dGVuc2lvbi5wdWJsaXNoZXIuZGlzcGxheU5hbWUgfSkgIT09IHRydWUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2ZXJzaW9uID0gY3JpdGVyaWEudmVyc2lvbnM/LmZpbmQoZXh0ZW5zaW9uSWRlbnRpZmllcldpdGhWZXJzaW9uID0+IGFyZVNhbWVFeHRlbnNpb25zKGV4dGVuc2lvbklkZW50aWZpZXJXaXRoVmVyc2lvbiwgZXh0ZW5zaW9uSWRlbnRpZmllcikpPy52ZXJzaW9uXG5cdFx0XHRcdD8/ICgoaXNCb29sZWFuKGNyaXRlcmlhLmluY2x1ZGVQcmVSZWxlYXNlKSA/IGNyaXRlcmlhLmluY2x1ZGVQcmVSZWxlYXNlIDogISFjcml0ZXJpYS5pbmNsdWRlUHJlUmVsZWFzZS5maW5kKGV4dGVuc2lvbklkZW50aWZpZXJXaXRoUHJlUmVsZWFzZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhleHRlbnNpb25JZGVudGlmaWVyV2l0aFByZVJlbGVhc2UsIGV4dGVuc2lvbklkZW50aWZpZXIpKT8uaW5jbHVkZVByZVJlbGVhc2UpID8gVmVyc2lvbktpbmQuTGF0ZXN0IDogVmVyc2lvbktpbmQuUmVsZWFzZSk7XG5cdFx0XHRjb25zdCByYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbiA9IGF3YWl0IHRoaXMuZ2V0UmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24oXG5cdFx0XHRcdHJhd0dhbGxlcnlFeHRlbnNpb24sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb21wYXRpYmxlOiBjcml0ZXJpYS5jb21wYXRpYmxlLFxuXHRcdFx0XHRcdHRhcmdldFBsYXRmb3JtOiBjcml0ZXJpYS50YXJnZXRQbGF0Zm9ybSxcblx0XHRcdFx0XHRwcm9kdWN0VmVyc2lvbjogY3JpdGVyaWEucHJvZHVjdFZlcnNpb24sXG5cdFx0XHRcdFx0dmVyc2lvblxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhbGxUYXJnZXRQbGF0Zm9ybXNcblx0XHRcdCk7XG5cdFx0XHRpZiAocmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHRvRXh0ZW5zaW9uKHJhd0dhbGxlcnlFeHRlbnNpb24sIHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCBhbGxUYXJnZXRQbGF0Zm9ybXMsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgY29udGV4dCkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IGV4dGVuc2lvbnMsIHRvdGFsIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKHJhd0dhbGxlcnlFeHRlbnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uLCBjcml0ZXJpYTogRXh0ZW5zaW9uVmVyc2lvbkNyaXRlcmlhLCBhbGxUYXJnZXRQbGF0Zm9ybXM6IFRhcmdldFBsYXRmb3JtW10pOiBQcm9taXNlPElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbiB8IG51bGw+IHtcblx0XHRjb25zdCBleHRlbnNpb25JZGVudGlmaWVyID0geyBpZDogZ2V0R2FsbGVyeUV4dGVuc2lvbklkKHJhd0dhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLnB1Ymxpc2hlck5hbWUsIHJhd0dhbGxlcnlFeHRlbnNpb24uZXh0ZW5zaW9uTmFtZSksIHV1aWQ6IHJhd0dhbGxlcnlFeHRlbnNpb24uZXh0ZW5zaW9uSWQgfTtcblx0XHRjb25zdCByYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbnMgPSBzb3J0RXh0ZW5zaW9uVmVyc2lvbnMocmF3R2FsbGVyeUV4dGVuc2lvbi52ZXJzaW9ucywgY3JpdGVyaWEudGFyZ2V0UGxhdGZvcm0pO1xuXG5cdFx0aWYgKGNyaXRlcmlhLmNvbXBhdGlibGUgJiYgaXNOb3RXZWJFeHRlbnNpb25JbldlYlRhcmdldFBsYXRmb3JtKGFsbFRhcmdldFBsYXRmb3JtcywgY3JpdGVyaWEudGFyZ2V0UGxhdGZvcm0pKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCB2ZXJzaW9uID0gaXNTdHJpbmcoY3JpdGVyaWEudmVyc2lvbikgPyBjcml0ZXJpYS52ZXJzaW9uIDogdW5kZWZpbmVkO1xuXG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9ucy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uID0gcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb25zW2luZGV4XTtcblx0XHRcdGlmIChhd2FpdCB0aGlzLmlzVmFsaWRWZXJzaW9uKFxuXHRcdFx0XHRleHRlbnNpb25JZGVudGlmaWVyLmlkLFxuXHRcdFx0XHRyYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbixcblx0XHRcdFx0Y3JpdGVyaWEsXG5cdFx0XHRcdHJhd0dhbGxlcnlFeHRlbnNpb24ucHVibGlzaGVyLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRhbGxUYXJnZXRQbGF0Zm9ybXMpXG5cdFx0XHQpIHtcblx0XHRcdFx0aWYgKGNyaXRlcmlhLmNvbXBhdGlibGUgJiYgIXRoaXMuYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShleHRlbnNpb25JZGVudGlmaWVyLCBnZXRFbmFibGVkQXBpUHJvcG9zYWxzKHJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uKSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmF3R2FsbGVyeUV4dGVuc2lvblZlcnNpb247XG5cdFx0XHR9XG5cdFx0XHRpZiAodmVyc2lvbiAmJiByYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbi52ZXJzaW9uID09PSB2ZXJzaW9uKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh2ZXJzaW9uIHx8IGNyaXRlcmlhLmNvbXBhdGlibGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEZhbGxiYWNrOiBSZXR1cm4gdGhlIGxhdGVzdCB2ZXJzaW9uXG5cdFx0ICogVGhpcyBjYW4gaGFwcGVuIHdoZW4gdGhlIGV4dGVuc2lvbiBkb2VzIG5vdCBoYXZlIGEgcmVsZWFzZSB2ZXJzaW9uIG9yIGRvZXMgbm90IGhhdmUgYSB2ZXJzaW9uIGNvbXBhdGlibGUgd2l0aCB0aGUgZ2l2ZW4gdGFyZ2V0IHBsYXRmb3JtLlxuXHRcdCAqL1xuXHRcdHJldHVybiByYXdHYWxsZXJ5RXh0ZW5zaW9uLnZlcnNpb25zWzBdO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBxdWVyeVJhd0dhbGxlcnlFeHRlbnNpb25zKHF1ZXJ5OiBRdWVyeSwgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0OiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSYXdHYWxsZXJ5RXh0ZW5zaW9uc1Jlc3VsdD4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNRdWVyeUFwaSA9IGdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFJlc291cmNlVXJpKGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5FeHRlbnNpb25RdWVyeVNlcnZpY2UpO1xuXG5cdFx0aWYgKCFleHRlbnNpb25zUXVlcnlBcGkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gZXh0ZW5zaW9uIGdhbGxlcnkgcXVlcnkgc2VydmljZSBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdHF1ZXJ5ID0gcXVlcnlcblx0XHRcdC8qIEFsd2F5cyBleGNsdWRlIG5vbiB2YWxpZGF0ZWQgZXh0ZW5zaW9ucyAqL1xuXHRcdFx0LndpdGhGbGFncyguLi5xdWVyeS5mbGFncywgRmxhZy5FeGNsdWRlTm9uVmFsaWRhdGVkKVxuXHRcdFx0LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5UYXJnZXQsICdNaWNyb3NvZnQuVmlzdWFsU3R1ZGlvLkNvZGUnKTtcblxuXHRcdGNvbnN0IHVucHVibGlzaGVkRmxhZyA9IGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdC5jYXBhYmlsaXRpZXMuZXh0ZW5zaW9uUXVlcnkuZmxhZ3M/LmZpbmQoZiA9PiBmLm5hbWUgPT09IEZsYWcuVW5wdWJsaXNoZWQpO1xuXHRcdC8qIEFsd2F5cyBleGNsdWRlIHVucHVibGlzaGVkIGV4dGVuc2lvbnMgKi9cblx0XHRpZiAodW5wdWJsaXNoZWRGbGFnKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5FeGNsdWRlV2l0aEZsYWdzLCBTdHJpbmcodW5wdWJsaXNoZWRGbGFnLnZhbHVlKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdGZpbHRlcnM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNyaXRlcmlhOiBxdWVyeS5jcml0ZXJpYS5yZWR1Y2U8eyBmaWx0ZXJUeXBlOiBudW1iZXI7IHZhbHVlPzogc3RyaW5nIH1bXT4oKGNyaXRlcmlhLCBjKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBjcml0ZXJpdW0gPSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuY2FwYWJpbGl0aWVzLmV4dGVuc2lvblF1ZXJ5LmZpbHRlcmluZz8uZmluZChmID0+IGYubmFtZSA9PT0gYy5maWx0ZXJUeXBlKTtcblx0XHRcdFx0XHRcdGlmIChjcml0ZXJpdW0pIHtcblx0XHRcdFx0XHRcdFx0Y3JpdGVyaWEucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0ZmlsdGVyVHlwZTogY3JpdGVyaXVtLnZhbHVlLFxuXHRcdFx0XHRcdFx0XHRcdHZhbHVlOiBjLnZhbHVlLFxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBjcml0ZXJpYTtcblx0XHRcdFx0XHR9LCBbXSksXG5cdFx0XHRcdFx0cGFnZU51bWJlcjogcXVlcnkucGFnZU51bWJlcixcblx0XHRcdFx0XHRwYWdlU2l6ZTogcXVlcnkucGFnZVNpemUsXG5cdFx0XHRcdFx0c29ydEJ5OiBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuY2FwYWJpbGl0aWVzLmV4dGVuc2lvblF1ZXJ5LnNvcnRpbmc/LmZpbmQocyA9PiBzLm5hbWUgPT09IHF1ZXJ5LnNvcnRCeSk/LnZhbHVlLFxuXHRcdFx0XHRcdHNvcnRPcmRlcjogcXVlcnkuc29ydE9yZGVyLFxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0YXNzZXRUeXBlczogcXVlcnkuYXNzZXRUeXBlcyxcblx0XHRcdGZsYWdzOiBxdWVyeS5mbGFncy5yZWR1Y2U8bnVtYmVyPigoZmxhZ3MsIGZsYWcpID0+IHtcblx0XHRcdFx0Y29uc3QgZmxhZ1ZhbHVlID0gZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LmNhcGFiaWxpdGllcy5leHRlbnNpb25RdWVyeS5mbGFncz8uZmluZChmID0+IGYubmFtZSA9PT0gZmxhZyk7XG5cdFx0XHRcdGlmIChmbGFnVmFsdWUpIHtcblx0XHRcdFx0XHRmbGFncyB8PSBmbGFnVmFsdWUudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZsYWdzO1xuXHRcdFx0fSwgMClcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbW1vbkhlYWRlcnMgPSBhd2FpdCB0aGlzLmNvbW1vbkhlYWRlcnNQcm9taXNlO1xuXHRcdGNvbnN0IGhlYWRlcnMgPSB7XG5cdFx0XHQuLi5jb21tb25IZWFkZXJzLFxuXHRcdFx0J0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdCdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbjthcGktdmVyc2lvbj0zLjAtcHJldmlldy4xJyxcblx0XHRcdCdBY2NlcHQtRW5jb2RpbmcnOiAnZ3ppcCcsXG5cdFx0XHQnQ29udGVudC1MZW5ndGgnOiBTdHJpbmcoZGF0YS5sZW5ndGgpLFxuXHRcdH07XG5cblx0XHRjb25zdCBzdG9wV2F0Y2ggPSBuZXcgU3RvcFdhdGNoKCk7XG5cdFx0bGV0IGNvbnRleHQ6IElSZXF1ZXN0Q29udGV4dCB8IHVuZGVmaW5lZCwgZXJyb3JDb2RlOiBFeHRlbnNpb25HYWxsZXJ5RXJyb3JDb2RlIHwgdW5kZWZpbmVkLCB0b3RhbDogbnVtYmVyID0gMDtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHtcblx0XHRcdFx0dHlwZTogJ1BPU1QnLFxuXHRcdFx0XHR1cmw6IGV4dGVuc2lvbnNRdWVyeUFwaSxcblx0XHRcdFx0ZGF0YSxcblx0XHRcdFx0aGVhZGVyc1xuXHRcdFx0fSwgdG9rZW4pO1xuXG5cdFx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSAmJiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlID49IDQwMCAmJiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlIDwgNTAwKSB7XG5cdFx0XHRcdHJldHVybiB7IGdhbGxlcnlFeHRlbnNpb25zOiBbXSwgdG90YWwgfTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYXNKc29uPElSYXdHYWxsZXJ5UXVlcnlSZXN1bHQ+KGNvbnRleHQpO1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRjb25zdCByID0gcmVzdWx0LnJlc3VsdHNbMF07XG5cdFx0XHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zID0gci5leHRlbnNpb25zO1xuXHRcdFx0XHRjb25zdCByZXN1bHRDb3VudCA9IHIucmVzdWx0TWV0YWRhdGEgJiYgci5yZXN1bHRNZXRhZGF0YS5maWx0ZXIobSA9PiBtLm1ldGFkYXRhVHlwZSA9PT0gJ1Jlc3VsdENvdW50JylbMF07XG5cdFx0XHRcdHRvdGFsID0gcmVzdWx0Q291bnQgJiYgcmVzdWx0Q291bnQubWV0YWRhdGFJdGVtcy5maWx0ZXIoaSA9PiBpLm5hbWUgPT09ICdUb3RhbENvdW50JylbMF0uY291bnQgfHwgMDtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGdhbGxlcnlFeHRlbnNpb25zLFxuXHRcdFx0XHRcdHRvdGFsLFxuXHRcdFx0XHRcdGNvbnRleHQ6IGNvbnRleHQucmVzLmhlYWRlcnNbJ2FjdGl2aXR5aWQnXSA/IHtcblx0XHRcdFx0XHRcdFtTRUFSQ0hfQUNUSVZJVFlfSEVBREVSX05BTUVdOiBjb250ZXh0LnJlcy5oZWFkZXJzWydhY3Rpdml0eWlkJ11cblx0XHRcdFx0XHR9IDoge31cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7IGdhbGxlcnlFeHRlbnNpb25zOiBbXSwgdG90YWwgfTtcblxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdGVycm9yQ29kZSA9IEV4dGVuc2lvbkdhbGxlcnlFcnJvckNvZGUuQ2FuY2VsbGVkO1xuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gZ2V0RXJyb3JNZXNzYWdlKGUpO1xuXHRcdFx0XHRlcnJvckNvZGUgPSBpc09mZmxpbmVFcnJvcihlKVxuXHRcdFx0XHRcdD8gRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZS5PZmZsaW5lXG5cdFx0XHRcdFx0OiBlcnJvck1lc3NhZ2Uuc3RhcnRzV2l0aCgnWEhSIHRpbWVvdXQnKVxuXHRcdFx0XHRcdFx0PyBFeHRlbnNpb25HYWxsZXJ5RXJyb3JDb2RlLlRpbWVvdXRcblx0XHRcdFx0XHRcdDogRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZS5GYWlsZWQ7XG5cdFx0XHRcdHRocm93IG5ldyBFeHRlbnNpb25HYWxsZXJ5RXJyb3IoZXJyb3JNZXNzYWdlLCBlcnJvckNvZGUpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxHYWxsZXJ5U2VydmljZVF1ZXJ5RXZlbnQsIEdhbGxlcnlTZXJ2aWNlUXVlcnlDbGFzc2lmaWNhdGlvbj4oJ2dhbGxlcnlTZXJ2aWNlOnF1ZXJ5Jywge1xuXHRcdFx0XHRmaWx0ZXJUeXBlczogcXVlcnkuY3JpdGVyaWEubWFwKGNyaXRlcml1bSA9PiBjcml0ZXJpdW0uZmlsdGVyVHlwZSksXG5cdFx0XHRcdGZsYWdzOiBxdWVyeS5mbGFncyxcblx0XHRcdFx0c29ydEJ5OiBxdWVyeS5zb3J0QnksXG5cdFx0XHRcdHNvcnRPcmRlcjogU3RyaW5nKHF1ZXJ5LnNvcnRPcmRlciksXG5cdFx0XHRcdHBhZ2VOdW1iZXI6IFN0cmluZyhxdWVyeS5wYWdlTnVtYmVyKSxcblx0XHRcdFx0c291cmNlOiBxdWVyeS5zb3VyY2UsXG5cdFx0XHRcdHNlYXJjaFRleHRMZW5ndGg6IHF1ZXJ5LnNlYXJjaFRleHQubGVuZ3RoLFxuXHRcdFx0XHRyZXF1ZXN0Qm9keVNpemU6IFN0cmluZyhkYXRhLmxlbmd0aCksXG5cdFx0XHRcdGR1cmF0aW9uOiBzdG9wV2F0Y2guZWxhcHNlZCgpLFxuXHRcdFx0XHRzdWNjZXNzOiAhIWNvbnRleHQgJiYgaXNTdWNjZXNzKGNvbnRleHQpLFxuXHRcdFx0XHRyZXNwb25zZUJvZHlTaXplOiBjb250ZXh0Py5yZXMuaGVhZGVyc1snQ29udGVudC1MZW5ndGgnXSxcblx0XHRcdFx0c3RhdHVzQ29kZTogY29udGV4dCA/IFN0cmluZyhjb250ZXh0LnJlcy5zdGF0dXNDb2RlKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZXJyb3JDb2RlLFxuXHRcdFx0XHRjb3VudDogU3RyaW5nKHRvdGFsKSxcblx0XHRcdFx0c2VydmVyOiB0aGlzLmdldEhlYWRlclZhbHVlKGNvbnRleHQ/LnJlcy5oZWFkZXJzLCBTRVJWRVJfSEVBREVSX05BTUUpLFxuXHRcdFx0XHRhY3Rpdml0eUlkOiB0aGlzLmdldEhlYWRlclZhbHVlKGNvbnRleHQ/LnJlcy5oZWFkZXJzLCBBQ1RJVklUWV9IRUFERVJfTkFNRSksXG5cdFx0XHRcdGVuZFRvRW5kSWQ6IHRoaXMuZ2V0SGVhZGVyVmFsdWUoY29udGV4dD8ucmVzLmhlYWRlcnMsIEVORF9FTkRfSURfSEVBREVSX05BTUUpLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRIZWFkZXJWYWx1ZShoZWFkZXJzOiBJSGVhZGVycyB8IHVuZGVmaW5lZCwgbmFtZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB2YWx1ZSA9IGhlYWRlcnM/LltuYW1lLnRvTG93ZXJDYXNlKCldO1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KHZhbHVlKSA/IHZhbHVlWzBdIDogdmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldExhdGVzdFJhd0dhbGxlcnlFeHRlbnNpb24oZXh0ZW5zaW9uOiBzdHJpbmcsIHVyaTogVVJJLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSYXdHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbD4ge1xuXHRcdGxldCBlcnJvckNvZGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzdG9wV2F0Y2ggPSBuZXcgU3RvcFdhdGNoKCk7XG5cblx0XHRsZXQgY29udGV4dDtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY29tbW9uSGVhZGVycyA9IGF3YWl0IHRoaXMuY29tbW9uSGVhZGVyc1Byb21pc2U7XG5cdFx0XHRjb25zdCBoZWFkZXJzID0ge1xuXHRcdFx0XHQuLi5jb21tb25IZWFkZXJzLFxuXHRcdFx0XHQnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHQnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb247YXBpLXZlcnNpb249Ny4yLXByZXZpZXcnLFxuXHRcdFx0XHQnQWNjZXB0LUVuY29kaW5nJzogJ2d6aXAnLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29udGV4dCA9IGF3YWl0IHRoaXMucmVxdWVzdFNlcnZpY2UucmVxdWVzdCh7XG5cdFx0XHRcdHR5cGU6ICdHRVQnLFxuXHRcdFx0XHR1cmw6IHVyaS50b1N0cmluZyh0cnVlKSxcblx0XHRcdFx0aGVhZGVycyxcblx0XHRcdFx0dGltZW91dDogMTAwMDAgLyoxMHMqL1xuXHRcdFx0fSwgdG9rZW4pO1xuXG5cdFx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDA0KSB7XG5cdFx0XHRcdGVycm9yQ29kZSA9ICdOb3RGb3VuZCc7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSAmJiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlICE9PSAyMDApIHtcblx0XHRcdFx0ZXJyb3JDb2RlID0gYEdhbGxlcnlTZXJ2aWNlRXJyb3I6YCArIGNvbnRleHQucmVzLnN0YXR1c0NvZGU7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBIVFRQIHJlc3BvbnNlOiAnICsgY29udGV4dC5yZXMuc3RhdHVzQ29kZSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFzSnNvbjxJUmF3R2FsbGVyeUV4dGVuc2lvbj4oY29udGV4dCk7XG5cdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRlcnJvckNvZGUgPSAnTm9EYXRhJztcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Y2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoaXNDYW5jZWxsYXRpb25FcnJvcihlcnJvcikpIHtcblx0XHRcdFx0ZXJyb3JDb2RlID0gRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZS5DYW5jZWxsZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpO1xuXHRcdFx0XHRlcnJvckNvZGUgPSBpc09mZmxpbmVFcnJvcihlcnJvcilcblx0XHRcdFx0XHQ/IEV4dGVuc2lvbkdhbGxlcnlFcnJvckNvZGUuT2ZmbGluZVxuXHRcdFx0XHRcdDogZXJyb3JNZXNzYWdlLnN0YXJ0c1dpdGgoJ1hIUiB0aW1lb3V0Jylcblx0XHRcdFx0XHRcdD8gRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZS5UaW1lb3V0XG5cdFx0XHRcdFx0XHQ6IEV4dGVuc2lvbkdhbGxlcnlFcnJvckNvZGUuRmFpbGVkO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXG5cdFx0ZmluYWxseSB7XG5cdFx0XHR0eXBlIEdhbGxlcnlTZXJ2aWNlR2V0TGF0ZXN0RXZlbnRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdSZXBvcnQgdGhlIHF1ZXJ5IHRvIHRoZSBNYXJrZXRwbGFjZSBmb3IgZmV0Y2hpbmcgbGF0ZXN0IHZlcnNpb24gb2YgYW4gZXh0ZW5zaW9uJztcblx0XHRcdFx0aG9zdDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBob3N0IG9mIHRoZSBlbmQgcG9pbnQnIH07XG5cdFx0XHRcdGV4dGVuc2lvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBleHRlbnNpb24nIH07XG5cdFx0XHRcdGR1cmF0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBpc01lYXN1cmVtZW50OiB0cnVlOyBjb21tZW50OiAnRHVyYXRpb24gaW4gbXMgZm9yIHRoZSBxdWVyeScgfTtcblx0XHRcdFx0ZXJyb3JDb2RlPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBlcnJvciBjb2RlIGluIGNhc2Ugb2YgZXJyb3InIH07XG5cdFx0XHRcdHNlcnZlcj86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgc2VydmVyIG9mIHRoZSBlbmQgcG9pbnQnIH07XG5cdFx0XHRcdGFjdGl2aXR5SWQ/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGFjdGl2aXR5IElEIG9mIHRoZSByZXF1ZXN0JyB9O1xuXHRcdFx0XHRlbmRUb0VuZElkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBlbmQtdG8tZW5kIElEIG9mIHRoZSByZXF1ZXN0JyB9O1xuXHRcdFx0fTtcblx0XHRcdHR5cGUgR2FsbGVyeVNlcnZpY2VHZXRMYXRlc3RFdmVudCA9IHtcblx0XHRcdFx0ZXh0ZW5zaW9uOiBzdHJpbmc7XG5cdFx0XHRcdGhvc3Q6IHN0cmluZztcblx0XHRcdFx0ZHVyYXRpb246IG51bWJlcjtcblx0XHRcdFx0ZXJyb3JDb2RlPzogc3RyaW5nO1xuXHRcdFx0XHRzZXJ2ZXI/OiBzdHJpbmc7XG5cdFx0XHRcdGFjdGl2aXR5SWQ/OiBzdHJpbmc7XG5cdFx0XHRcdGVuZFRvRW5kSWQ/OiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2FsbGVyeVNlcnZpY2VHZXRMYXRlc3RFdmVudCwgR2FsbGVyeVNlcnZpY2VHZXRMYXRlc3RFdmVudENsYXNzaWZpY2F0aW9uPignZ2FsbGVyeVNlcnZpY2U6Z2V0TGF0ZXN0Jywge1xuXHRcdFx0XHRleHRlbnNpb24sXG5cdFx0XHRcdGhvc3Q6IHVyaS5hdXRob3JpdHksXG5cdFx0XHRcdGR1cmF0aW9uOiBzdG9wV2F0Y2guZWxhcHNlZCgpLFxuXHRcdFx0XHRlcnJvckNvZGUsXG5cdFx0XHRcdHNlcnZlcjogdGhpcy5nZXRIZWFkZXJWYWx1ZShjb250ZXh0Py5yZXMuaGVhZGVycywgU0VSVkVSX0hFQURFUl9OQU1FKSxcblx0XHRcdFx0YWN0aXZpdHlJZDogdGhpcy5nZXRIZWFkZXJWYWx1ZShjb250ZXh0Py5yZXMuaGVhZGVycywgQUNUSVZJVFlfSEVBREVSX05BTUUpLFxuXHRcdFx0XHRlbmRUb0VuZElkOiB0aGlzLmdldEhlYWRlclZhbHVlKGNvbnRleHQ/LnJlcy5oZWFkZXJzLCBFTkRfRU5EX0lEX0hFQURFUl9OQU1FKSxcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlcG9ydFN0YXRpc3RpYyhwdWJsaXNoZXI6IHN0cmluZywgbmFtZTogc3RyaW5nLCB2ZXJzaW9uOiBzdHJpbmcsIHR5cGU6IFN0YXRpc3RpY1R5cGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5nZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QoKTtcblx0XHRpZiAoIW1hbmlmZXN0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGxldCB1cmw6IHN0cmluZztcblxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaShtYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5XZWJFeHRlbnNpb25TdGF0aXN0aWNzVXJpKTtcblx0XHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dXJsID0gZm9ybWF0MihyZXNvdXJjZSwgeyBwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24sIHN0YXRUeXBlVmFsdWU6IHR5cGUgPT09IFN0YXRpc3RpY1R5cGUuSW5zdGFsbCA/ICcxJyA6ICczJyB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaShtYW5pZmVzdCwgRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5FeHRlbnNpb25TdGF0aXN0aWNzVXJpKTtcblx0XHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dXJsID0gZm9ybWF0MihyZXNvdXJjZSwgeyBwdWJsaXNoZXIsIG5hbWUsIHZlcnNpb24sIHN0YXRUeXBlTmFtZTogdHlwZSB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBBY2NlcHQgPSBpc1dlYiA/ICdhcGktdmVyc2lvbj02LjEtcHJldmlldy4xJyA6ICcqLyo7YXBpLXZlcnNpb249NC4wLXByZXZpZXcuMSc7XG5cdFx0Y29uc3QgY29tbW9uSGVhZGVycyA9IGF3YWl0IHRoaXMuY29tbW9uSGVhZGVyc1Byb21pc2U7XG5cdFx0Y29uc3QgaGVhZGVycyA9IHsgLi4uY29tbW9uSGVhZGVycywgQWNjZXB0IH07XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMucmVxdWVzdFNlcnZpY2UucmVxdWVzdCh7XG5cdFx0XHRcdHR5cGU6ICdQT1NUJyxcblx0XHRcdFx0dXJsLFxuXHRcdFx0XHRoZWFkZXJzXG5cdFx0XHR9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9IGNhdGNoIChlcnJvcikgeyAvKiBJZ25vcmUgKi8gfVxuXHR9XG5cblx0YXN5bmMgZG93bmxvYWQoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgbG9jYXRpb246IFVSSSwgb3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRlbnNpb25HYWxsZXJ5U2VydmljZSNkb3dubG9hZCcsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRjb25zdCBkYXRhID0gZ2V0R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGEoZXh0ZW5zaW9uKTtcblx0XHRjb25zdCBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcblxuXHRcdGNvbnN0IG9wZXJhdGlvblBhcmFtID0gb3BlcmF0aW9uID09PSBJbnN0YWxsT3BlcmF0aW9uLkluc3RhbGwgPyAnaW5zdGFsbCcgOiBvcGVyYXRpb24gPT09IEluc3RhbGxPcGVyYXRpb24uVXBkYXRlID8gJ3VwZGF0ZScgOiAnJztcblx0XHRjb25zdCBkb3dubG9hZEFzc2V0ID0gb3BlcmF0aW9uUGFyYW0gPyB7XG5cdFx0XHR1cmk6IGAke2V4dGVuc2lvbi5hc3NldHMuZG93bmxvYWQudXJpfSR7VVJJLnBhcnNlKGV4dGVuc2lvbi5hc3NldHMuZG93bmxvYWQudXJpKS5xdWVyeSA/ICcmJyA6ICc/J30ke29wZXJhdGlvblBhcmFtfT10cnVlYCxcblx0XHRcdGZhbGxiYWNrVXJpOiBgJHtleHRlbnNpb24uYXNzZXRzLmRvd25sb2FkLmZhbGxiYWNrVXJpfSR7VVJJLnBhcnNlKGV4dGVuc2lvbi5hc3NldHMuZG93bmxvYWQuZmFsbGJhY2tVcmkpLnF1ZXJ5ID8gJyYnIDogJz8nfSR7b3BlcmF0aW9uUGFyYW19PXRydWVgXG5cdFx0fSA6IGV4dGVuc2lvbi5hc3NldHMuZG93bmxvYWQ7XG5cblx0XHRjb25zdCBoZWFkZXJzOiBJSGVhZGVycyB8IHVuZGVmaW5lZCA9IGV4dGVuc2lvbi5xdWVyeUNvbnRleHQ/LltTRUFSQ0hfQUNUSVZJVFlfSEVBREVSX05BTUVdID8geyBbU0VBUkNIX0FDVElWSVRZX0hFQURFUl9OQU1FXTogZXh0ZW5zaW9uLnF1ZXJ5Q29udGV4dFtTRUFSQ0hfQUNUSVZJVFlfSEVBREVSX05BTUVdIH0gOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXQoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIGRvd25sb2FkQXNzZXQsIEFzc2V0VHlwZS5WU0lYLCBleHRlbnNpb24udmVyc2lvbiwgaGVhZGVycyA/IHsgaGVhZGVycyB9IDogdW5kZWZpbmVkKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShsb2NhdGlvbiwgY29udGV4dC5zdHJlYW0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbChsb2NhdGlvbik7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8qIGlnbm9yZSAqL1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgRXJyb3Igd2hpbGUgZGVsZXRpbmcgdGhlIGZpbGUgJHtsb2NhdGlvbi50b1N0cmluZygpfWAsIGdldEVycm9yTWVzc2FnZShlKSk7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgRXh0ZW5zaW9uR2FsbGVyeUVycm9yKGdldEVycm9yTWVzc2FnZShlcnJvciksIEV4dGVuc2lvbkdhbGxlcnlFcnJvckNvZGUuRG93bmxvYWRGYWlsZWRXcml0aW5nKTtcblx0XHR9XG5cblx0XHQvKiBfX0dEUFJfX1xuXHRcdFx0XCJnYWxsZXJ5U2VydmljZTpkb3dubG9hZFZTSVhcIiA6IHtcblx0XHRcdFx0XCJvd25lclwiOiBcInNhbmR5MDgxXCIsXG5cdFx0XHRcdFwiZHVyYXRpb25cIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFx0XCIke2luY2x1ZGV9XCI6IFtcblx0XHRcdFx0XHRcIiR7R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGF9XCJcblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCovXG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnZ2FsbGVyeVNlcnZpY2U6ZG93bmxvYWRWU0lYJywgeyAuLi5kYXRhLCBkdXJhdGlvbjogbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBzdGFydFRpbWUgfSk7XG5cdH1cblxuXHRhc3luYyBkb3dubG9hZFNpZ25hdHVyZUFyY2hpdmUoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgbG9jYXRpb246IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghZXh0ZW5zaW9uLmFzc2V0cy5zaWduYXR1cmUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gc2lnbmF0dXJlIGFzc2V0IGZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdFeHRlbnNpb25HYWxsZXJ5U2VydmljZSNkb3dubG9hZFNpZ25hdHVyZUFyY2hpdmUnLCBleHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5nZXRBc3NldChleHRlbnNpb24uaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uLmFzc2V0cy5zaWduYXR1cmUsIEFzc2V0VHlwZS5TaWduYXR1cmUsIGV4dGVuc2lvbi52ZXJzaW9uKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUobG9jYXRpb24sIGNvbnRleHQuc3RyZWFtKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwobG9jYXRpb24pO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvKiBpZ25vcmUgKi9cblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYEVycm9yIHdoaWxlIGRlbGV0aW5nIHRoZSBmaWxlICR7bG9jYXRpb24udG9TdHJpbmcoKX1gLCBnZXRFcnJvck1lc3NhZ2UoZSkpO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbkdhbGxlcnlFcnJvcihnZXRFcnJvck1lc3NhZ2UoZXJyb3IpLCBFeHRlbnNpb25HYWxsZXJ5RXJyb3JDb2RlLkRvd25sb2FkRmFpbGVkV3JpdGluZyk7XG5cdFx0fVxuXG5cdH1cblxuXHRhc3luYyBnZXRSZWFkbWUoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoZXh0ZW5zaW9uLmFzc2V0cy5yZWFkbWUpIHtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBleHRlbnNpb24uYXNzZXRzLnJlYWRtZSwgQXNzZXRUeXBlLkRldGFpbHMsIGV4dGVuc2lvbi52ZXJzaW9uLCB7fSwgdG9rZW4pO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGFzVGV4dE9yRXJyb3IoY29udGV4dCk7XG5cdFx0XHRyZXR1cm4gY29udGVudCB8fCAnJztcblx0XHR9XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0YXN5bmMgZ2V0TWFuaWZlc3QoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsPiB7XG5cdFx0aWYgKGV4dGVuc2lvbi5hc3NldHMubWFuaWZlc3QpIHtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBleHRlbnNpb24uYXNzZXRzLm1hbmlmZXN0LCBBc3NldFR5cGUuTWFuaWZlc3QsIGV4dGVuc2lvbi52ZXJzaW9uLCB7fSwgdG9rZW4pO1xuXHRcdFx0Y29uc3QgdGV4dCA9IGF3YWl0IGFzVGV4dE9yRXJyb3IoY29udGV4dCk7XG5cdFx0XHRyZXR1cm4gdGV4dCA/IEpTT04ucGFyc2UodGV4dCkgOiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0TWFuaWZlc3RGcm9tUmF3RXh0ZW5zaW9uVmVyc2lvbihleHRlbnNpb246IHN0cmluZywgcmF3RXh0ZW5zaW9uVmVyc2lvbjogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFeHRlbnNpb25NYW5pZmVzdCB8IG51bGw+IHtcblx0XHRjb25zdCBtYW5pZmVzdEFzc2V0ID0gZ2V0VmVyc2lvbkFzc2V0KHJhd0V4dGVuc2lvblZlcnNpb24sIEFzc2V0VHlwZS5NYW5pZmVzdCk7XG5cdFx0aWYgKCFtYW5pZmVzdEFzc2V0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01hbmlmZXN0IHdhcyBub3QgZm91bmQnKTtcblx0XHR9XG5cdFx0Y29uc3QgaGVhZGVycyA9IHsgJ0FjY2VwdC1FbmNvZGluZyc6ICdnemlwJyB9O1xuXHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0KGV4dGVuc2lvbiwgbWFuaWZlc3RBc3NldCwgQXNzZXRUeXBlLk1hbmlmZXN0LCByYXdFeHRlbnNpb25WZXJzaW9uLnZlcnNpb24sIHsgaGVhZGVycyB9KTtcblx0XHRyZXR1cm4gYXdhaXQgYXNKc29uPElFeHRlbnNpb25NYW5pZmVzdD4oY29udGV4dCk7XG5cdH1cblxuXHRhc3luYyBnZXRDb3JlVHJhbnNsYXRpb24oZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgbGFuZ3VhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTxJVHJhbnNsYXRpb24gfCBudWxsPiB7XG5cdFx0Y29uc3QgYXNzZXQgPSBleHRlbnNpb24uYXNzZXRzLmNvcmVUcmFuc2xhdGlvbnMuZmlsdGVyKHQgPT4gdFswXSA9PT0gbGFuZ3VhZ2VJZC50b1VwcGVyQ2FzZSgpKVswXTtcblx0XHRpZiAoYXNzZXQpIHtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBhc3NldFsxXSwgYXNzZXRbMF0sIGV4dGVuc2lvbi52ZXJzaW9uKTtcblx0XHRcdGNvbnN0IHRleHQgPSBhd2FpdCBhc1RleHRPckVycm9yKGNvbnRleHQpO1xuXHRcdFx0cmV0dXJuIHRleHQgPyBKU09OLnBhcnNlKHRleHQpIDogbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRhc3luYyBnZXRDaGFuZ2Vsb2coZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRpZiAoZXh0ZW5zaW9uLmFzc2V0cy5jaGFuZ2Vsb2cpIHtcblx0XHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBleHRlbnNpb24uYXNzZXRzLmNoYW5nZWxvZywgQXNzZXRUeXBlLkNoYW5nZWxvZywgZXh0ZW5zaW9uLnZlcnNpb24sIHt9LCB0b2tlbik7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgYXNUZXh0T3JFcnJvcihjb250ZXh0KTtcblx0XHRcdHJldHVybiBjb250ZW50IHx8ICcnO1xuXHRcdH1cblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRhc3luYyBnZXRBbGxDb21wYXRpYmxlVmVyc2lvbnMoZXh0ZW5zaW9uSWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIsIGluY2x1ZGVQcmVSZWxlYXNlOiBib29sZWFuLCB0YXJnZXRQbGF0Zm9ybTogVGFyZ2V0UGxhdGZvcm0pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbltdPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpO1xuXHRcdGlmICghZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIGV4dGVuc2lvbiBnYWxsZXJ5IHNlcnZpY2UgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRsZXQgcXVlcnkgPSBuZXcgUXVlcnkoKVxuXHRcdFx0LndpdGhGbGFncyhGbGFnLkluY2x1ZGVWZXJzaW9ucywgRmxhZy5JbmNsdWRlQ2F0ZWdvcnlBbmRUYWdzLCBGbGFnLkluY2x1ZGVGaWxlcywgRmxhZy5JbmNsdWRlVmVyc2lvblByb3BlcnRpZXMpXG5cdFx0XHQud2l0aFBhZ2UoMSwgMSk7XG5cblx0XHRpZiAoZXh0ZW5zaW9uSWRlbnRpZmllci51dWlkKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LndpdGhGaWx0ZXIoRmlsdGVyVHlwZS5FeHRlbnNpb25JZCwgZXh0ZW5zaW9uSWRlbnRpZmllci51dWlkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS53aXRoRmlsdGVyKEZpbHRlclR5cGUuRXh0ZW5zaW9uTmFtZSwgZXh0ZW5zaW9uSWRlbnRpZmllci5pZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBnYWxsZXJ5RXh0ZW5zaW9ucyB9ID0gYXdhaXQgdGhpcy5xdWVyeVJhd0dhbGxlcnlFeHRlbnNpb25zKHF1ZXJ5LCBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGlmICghZ2FsbGVyeUV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsVGFyZ2V0UGxhdGZvcm1zID0gZ2V0QWxsVGFyZ2V0UGxhdGZvcm1zKGdhbGxlcnlFeHRlbnNpb25zWzBdKTtcblx0XHRpZiAoaXNOb3RXZWJFeHRlbnNpb25JbldlYlRhcmdldFBsYXRmb3JtKGFsbFRhcmdldFBsYXRmb3JtcywgdGFyZ2V0UGxhdGZvcm0pKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFsaWRWZXJzaW9uczogSVJhd0dhbGxlcnlFeHRlbnNpb25WZXJzaW9uW10gPSBbXTtcblx0XHRjb25zdCBwcm9kdWN0VmVyc2lvbiA9IHsgdmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCBkYXRlOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUgfTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChnYWxsZXJ5RXh0ZW5zaW9uc1swXS52ZXJzaW9ucy5tYXAoYXN5bmMgKHZlcnNpb24pID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGlmIChcblx0XHRcdFx0XHQoYXdhaXQgdGhpcy5pc1ZhbGlkVmVyc2lvbihcblx0XHRcdFx0XHRcdGV4dGVuc2lvbklkZW50aWZpZXIuaWQsXG5cdFx0XHRcdFx0XHR2ZXJzaW9uLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRjb21wYXRpYmxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRwcm9kdWN0VmVyc2lvbixcblx0XHRcdFx0XHRcdFx0dGFyZ2V0UGxhdGZvcm0sXG5cdFx0XHRcdFx0XHRcdHZlcnNpb246IGluY2x1ZGVQcmVSZWxlYXNlID8gVmVyc2lvbktpbmQuTGF0ZXN0IDogVmVyc2lvbktpbmQuUmVsZWFzZVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGdhbGxlcnlFeHRlbnNpb25zWzBdLnB1Ymxpc2hlci5kaXNwbGF5TmFtZSxcblx0XHRcdFx0XHRcdGFsbFRhcmdldFBsYXRmb3JtcykpXG5cdFx0XHRcdFx0JiYgdGhpcy5hcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlKGV4dGVuc2lvbklkZW50aWZpZXIsIGdldEVuYWJsZWRBcGlQcm9wb3NhbHModmVyc2lvbikpXG5cdFx0XHRcdCkge1xuXHRcdFx0XHRcdHZhbGlkVmVyc2lvbnMucHVzaCh2ZXJzaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHsgLyogSWdub3JlIGVycm9yIGFuZCBza2lwIHZlcnNpb24gKi8gfVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHJlc3VsdDogSUdhbGxlcnlFeHRlbnNpb25WZXJzaW9uW10gPSBbXTtcblx0XHRjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCB2ZXJzaW9uIG9mIHNvcnRFeHRlbnNpb25WZXJzaW9ucyh2YWxpZFZlcnNpb25zLCB0YXJnZXRQbGF0Zm9ybSkpIHtcblx0XHRcdGlmICghc2Vlbi5oYXModmVyc2lvbi52ZXJzaW9uKSkge1xuXHRcdFx0XHRzZWVuLmFkZCh2ZXJzaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRyZXN1bHQucHVzaCh7IHZlcnNpb246IHZlcnNpb24udmVyc2lvbiwgZGF0ZTogdmVyc2lvbi5sYXN0VXBkYXRlZCwgaXNQcmVSZWxlYXNlVmVyc2lvbjogaXNQcmVSZWxlYXNlVmVyc2lvbih2ZXJzaW9uKSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBc3NldChleHRlbnNpb246IHN0cmluZywgYXNzZXQ6IElHYWxsZXJ5RXh0ZW5zaW9uQXNzZXQsIGFzc2V0VHlwZTogc3RyaW5nLCBleHRlbnNpb25WZXJzaW9uOiBzdHJpbmcsIG9wdGlvbnM6IElSZXF1ZXN0T3B0aW9ucyA9IHt9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+IHtcblx0XHRjb25zdCBjb21tb25IZWFkZXJzID0gYXdhaXQgdGhpcy5jb21tb25IZWFkZXJzUHJvbWlzZTtcblx0XHRjb25zdCBiYXNlT3B0aW9ucyA9IHsgdHlwZTogJ0dFVCcgfTtcblx0XHRjb25zdCBoZWFkZXJzID0geyAuLi5jb21tb25IZWFkZXJzLCAuLi4ob3B0aW9ucy5oZWFkZXJzIHx8IHt9KSB9O1xuXHRcdG9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIC4uLmJhc2VPcHRpb25zLCBoZWFkZXJzIH07XG5cblx0XHRjb25zdCB1cmwgPSBhc3NldC51cmk7XG5cdFx0Y29uc3QgZmFsbGJhY2tVcmwgPSBhc3NldC5mYWxsYmFja1VyaTtcblx0XHRjb25zdCBmaXJzdE9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIHVybCB9O1xuXG5cdFx0bGV0IGNvbnRleHQ7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlcXVlc3RTZXJ2aWNlLnJlcXVlc3QoZmlyc3RPcHRpb25zLCB0b2tlbik7XG5cdFx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG5cdFx0XHRcdHJldHVybiBjb250ZXh0O1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGF3YWl0IGFzVGV4dE9yRXJyb3IoY29udGV4dCk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIDIwMCwgZ290IGJhY2sgJHtjb250ZXh0LnJlcy5zdGF0dXNDb2RlfSBpbnN0ZWFkLlxcblxcbiR7bWVzc2FnZX1gKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpIHtcblx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtZXNzYWdlID0gZ2V0RXJyb3JNZXNzYWdlKGVycik7XG5cdFx0XHR0eXBlIEdhbGxlcnlTZXJ2aWNlQ0RORmFsbGJhY2tDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdzYW5keTA4MSc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdGYWxsYmFjayByZXF1ZXN0IGluZm9ybWF0aW9uIHdoZW4gdGhlIHByaW1hcnkgYXNzZXQgcmVxdWVzdCB0byBDRE4gZmFpbHMnO1xuXHRcdFx0XHRleHRlbnNpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdleHRlbnNpb24gbmFtZScgfTtcblx0XHRcdFx0YXNzZXRUeXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnYXNzZXQgdGhhdCBmYWlsZWQnIH07XG5cdFx0XHRcdG1lc3NhZ2U6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdlcnJvciBtZXNzYWdlJyB9O1xuXHRcdFx0XHRleHRlbnNpb25WZXJzaW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmVyc2lvbicgfTtcblx0XHRcdFx0cmVhZG9ubHkgc2VydmVyPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3NlcnZlciB0aGF0IGhhbmRsZWQgdGhlIHF1ZXJ5JyB9O1xuXHRcdFx0XHRyZWFkb25seSBlbmRUb0VuZElkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2VuZCB0byBlbmQgb3BlcmF0aW9uIGlkJyB9O1xuXHRcdFx0XHRyZWFkb25seSBhY3Rpdml0eUlkPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2FjdGl2aXR5IGlkJyB9O1xuXHRcdFx0fTtcblx0XHRcdHR5cGUgR2FsbGVyeVNlcnZpY2VDRE5GYWxsYmFja0V2ZW50ID0ge1xuXHRcdFx0XHRleHRlbnNpb246IHN0cmluZztcblx0XHRcdFx0YXNzZXRUeXBlOiBzdHJpbmc7XG5cdFx0XHRcdG1lc3NhZ2U6IHN0cmluZztcblx0XHRcdFx0ZXh0ZW5zaW9uVmVyc2lvbjogc3RyaW5nO1xuXHRcdFx0XHRzZXJ2ZXI/OiBzdHJpbmc7XG5cdFx0XHRcdGVuZFRvRW5kSWQ/OiBzdHJpbmc7XG5cdFx0XHRcdGFjdGl2aXR5SWQ/OiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8R2FsbGVyeVNlcnZpY2VDRE5GYWxsYmFja0V2ZW50LCBHYWxsZXJ5U2VydmljZUNETkZhbGxiYWNrQ2xhc3NpZmljYXRpb24+KCdnYWxsZXJ5U2VydmljZTpjZG5GYWxsYmFjaycsIHtcblx0XHRcdFx0ZXh0ZW5zaW9uLFxuXHRcdFx0XHRhc3NldFR5cGUsXG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdGV4dGVuc2lvblZlcnNpb24sXG5cdFx0XHRcdHNlcnZlcjogdGhpcy5nZXRIZWFkZXJWYWx1ZShjb250ZXh0Py5yZXMuaGVhZGVycywgU0VSVkVSX0hFQURFUl9OQU1FKSxcblx0XHRcdFx0YWN0aXZpdHlJZDogdGhpcy5nZXRIZWFkZXJWYWx1ZShjb250ZXh0Py5yZXMuaGVhZGVycywgQUNUSVZJVFlfSEVBREVSX05BTUUpLFxuXHRcdFx0XHRlbmRUb0VuZElkOiB0aGlzLmdldEhlYWRlclZhbHVlKGNvbnRleHQ/LnJlcy5oZWFkZXJzLCBFTkRfRU5EX0lEX0hFQURFUl9OQU1FKSxcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBmYWxsYmFja09wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIHVybDogZmFsbGJhY2tVcmwgfTtcblx0XHRcdHJldHVybiB0aGlzLnJlcXVlc3RTZXJ2aWNlLnJlcXVlc3QoZmFsbGJhY2tPcHRpb25zLCB0b2tlbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRFbmdpbmUoZXh0ZW5zaW9uOiBzdHJpbmcsIHJhd0V4dGVuc2lvblZlcnNpb246IElSYXdHYWxsZXJ5RXh0ZW5zaW9uVmVyc2lvbik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0bGV0IGVuZ2luZSA9IGdldEVuZ2luZShyYXdFeHRlbnNpb25WZXJzaW9uKTtcblx0XHRpZiAoIWVuZ2luZSkge1xuXHRcdFx0dHlwZSBHYWxsZXJ5U2VydmljZUVuZ2luZUZhbGxiYWNrQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAnc2FuZHkwODEnO1xuXHRcdFx0XHRjb21tZW50OiAnRmFsbGJhY2sgcmVxdWVzdCB3aGVuIGVuZ2luZSBpcyBub3QgZm91bmQgaW4gcHJvcGVydGllcyBvZiBhbiBleHRlbnNpb24gdmVyc2lvbic7XG5cdFx0XHRcdGV4dGVuc2lvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ2V4dGVuc2lvbiBuYW1lJyB9O1xuXHRcdFx0XHRleHRlbnNpb25WZXJzaW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAndmVyc2lvbicgfTtcblx0XHRcdH07XG5cdFx0XHR0eXBlIEdhbGxlcnlTZXJ2aWNlRW5naW5lRmFsbGJhY2tFdmVudCA9IHtcblx0XHRcdFx0ZXh0ZW5zaW9uOiBzdHJpbmc7XG5cdFx0XHRcdGV4dGVuc2lvblZlcnNpb246IHN0cmluZztcblx0XHRcdH07XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxHYWxsZXJ5U2VydmljZUVuZ2luZUZhbGxiYWNrRXZlbnQsIEdhbGxlcnlTZXJ2aWNlRW5naW5lRmFsbGJhY2tDbGFzc2lmaWNhdGlvbj4oJ2dhbGxlcnlTZXJ2aWNlOmVuZ2luZUZhbGxiYWNrJywgeyBleHRlbnNpb24sIGV4dGVuc2lvblZlcnNpb246IHJhd0V4dGVuc2lvblZlcnNpb24udmVyc2lvbiB9KTtcblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5nZXRNYW5pZmVzdEZyb21SYXdFeHRlbnNpb25WZXJzaW9uKGV4dGVuc2lvbiwgcmF3RXh0ZW5zaW9uVmVyc2lvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRpZiAoIW1hbmlmZXN0KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTWFuaWZlc3Qgd2FzIG5vdCBmb3VuZCcpO1xuXHRcdFx0fVxuXHRcdFx0ZW5naW5lID0gbWFuaWZlc3QuZW5naW5lcy52c2NvZGU7XG5cdFx0fVxuXHRcdHJldHVybiBlbmdpbmU7XG5cdH1cblxuXHRhc3luYyBnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk6IFByb21pc2U8SUV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q+IHtcblx0XHRpZiAoIXRoaXMuaXNFbmFibGVkKCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gZXh0ZW5zaW9uIGdhbGxlcnkgc2VydmljZSBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5leHRlbnNpb25zQ29udHJvbFVybCkge1xuXHRcdFx0cmV0dXJuIHsgbWFsaWNpb3VzOiBbXSwgZGVwcmVjYXRlZDoge30sIHNlYXJjaDogW10gfTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHtcblx0XHRcdHR5cGU6ICdHRVQnLFxuXHRcdFx0dXJsOiB0aGlzLmV4dGVuc2lvbnNDb250cm9sVXJsLFxuXHRcdFx0dGltZW91dDogMTAwMDAgLyoxMHMqL1xuXHRcdH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgIT09IDIwMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZ2V0IGV4dGVuc2lvbnMgcmVwb3J0LicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGFzSnNvbjxJUmF3RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdD4oY29udGV4dCk7XG5cdFx0Y29uc3QgbWFsaWNpb3VzOiBBcnJheTxJRXh0ZW5zaW9uSWRlbnRpZmllciB8IHN0cmluZz4gPSBbXTtcblx0XHRjb25zdCBkZXByZWNhdGVkOiBJU3RyaW5nRGljdGlvbmFyeTxJRGVwcmVjYXRpb25JbmZvPiA9IHt9O1xuXHRcdGNvbnN0IHNlYXJjaDogSVNlYXJjaFByZWZmZXJlZFJlc3VsdHNbXSA9IFtdO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNFbmFibGVkV2l0aFByZVJlbGVhc2U6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0Zm9yIChjb25zdCBpZCBvZiByZXN1bHQubWFsaWNpb3VzKSB7XG5cdFx0XHRcdGlmIChFWFRFTlNJT05fSURFTlRJRklFUl9SRUdFWC50ZXN0KGlkKSkge1xuXHRcdFx0XHRcdG1hbGljaW91cy5wdXNoKHsgaWQgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWFsaWNpb3VzLnB1c2goaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzdWx0Lm1pZ3JhdGVUb1ByZVJlbGVhc2UpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBbdW5zdXBwb3J0ZWRQcmVSZWxlYXNlRXh0ZW5zaW9uSWQsIHByZVJlbGVhc2VFeHRlbnNpb25JbmZvXSBvZiBPYmplY3QuZW50cmllcyhyZXN1bHQubWlncmF0ZVRvUHJlUmVsZWFzZSkpIHtcblx0XHRcdFx0XHRpZiAoIXByZVJlbGVhc2VFeHRlbnNpb25JbmZvLmVuZ2luZSB8fCBpc0VuZ2luZVZhbGlkKHByZVJlbGVhc2VFeHRlbnNpb25JbmZvLmVuZ2luZSwgdGhpcy5wcm9kdWN0U2VydmljZS52ZXJzaW9uLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLmRhdGUpKSB7XG5cdFx0XHRcdFx0XHRkZXByZWNhdGVkW3Vuc3VwcG9ydGVkUHJlUmVsZWFzZUV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCldID0ge1xuXHRcdFx0XHRcdFx0XHRkaXNhbGxvd0luc3RhbGw6IHRydWUsXG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbjoge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBwcmVSZWxlYXNlRXh0ZW5zaW9uSW5mby5pZCxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5TmFtZTogcHJlUmVsZWFzZUV4dGVuc2lvbkluZm8uZGlzcGxheU5hbWUsXG5cdFx0XHRcdFx0XHRcdFx0YXV0b01pZ3JhdGU6IHsgc3RvcmFnZTogISFwcmVSZWxlYXNlRXh0ZW5zaW9uSW5mby5taWdyYXRlU3RvcmFnZSB9LFxuXHRcdFx0XHRcdFx0XHRcdHByZVJlbGVhc2U6IHRydWVcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChyZXN1bHQuZGVwcmVjYXRlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtkZXByZWNhdGVkRXh0ZW5zaW9uSWQsIGRlcHJlY2F0aW9uSW5mb10gb2YgT2JqZWN0LmVudHJpZXMocmVzdWx0LmRlcHJlY2F0ZWQpKSB7XG5cdFx0XHRcdFx0aWYgKGRlcHJlY2F0aW9uSW5mbykge1xuXHRcdFx0XHRcdFx0ZGVwcmVjYXRlZFtkZXByZWNhdGVkRXh0ZW5zaW9uSWQudG9Mb3dlckNhc2UoKV0gPSBpc0Jvb2xlYW4oZGVwcmVjYXRpb25JbmZvKSA/IHt9IDogZGVwcmVjYXRpb25JbmZvO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3VsdC5zZWFyY2gpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBzIG9mIHJlc3VsdC5zZWFyY2gpIHtcblx0XHRcdFx0XHRzZWFyY2gucHVzaChzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocmVzdWx0LmV4dGVuc2lvbnNFbmFibGVkV2l0aFByZVJlbGVhc2UpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgaWQgb2YgcmVzdWx0LmV4dGVuc2lvbnNFbmFibGVkV2l0aFByZVJlbGVhc2UpIHtcblx0XHRcdFx0XHRleHRlbnNpb25zRW5hYmxlZFdpdGhQcmVSZWxlYXNlLnB1c2goaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBtYWxpY2lvdXMsIGRlcHJlY2F0ZWQsIHNlYXJjaCwgZXh0ZW5zaW9uc0VuYWJsZWRXaXRoUHJlUmVsZWFzZSB9O1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25HYWxsZXJ5U2VydmljZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJUmVxdWVzdFNlcnZpY2UgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2U6IElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihzdG9yYWdlU2VydmljZSwgdW5kZWZpbmVkLCByZXF1ZXN0U2VydmljZSwgbG9nU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBmaWxlU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25HYWxsZXJ5U2VydmljZVdpdGhOb1N0b3JhZ2VTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RFeHRlbnNpb25HYWxsZXJ5U2VydmljZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElSZXF1ZXN0U2VydmljZSByZXF1ZXN0U2VydmljZTogSVJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlIGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCByZXF1ZXN0U2VydmljZSwgbG9nU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBmaWxlU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UsIGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UpO1xuXHR9XG59XG4i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
