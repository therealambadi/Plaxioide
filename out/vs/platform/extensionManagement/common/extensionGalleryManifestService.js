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
import { Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { IProductService } from "../../product/common/productService.js";
import { ExtensionGalleryResourceType, Flag } from "./extensionGalleryManifest.js";
import { FilterType, SortBy } from "./extensionManagement.js";
let ExtensionGalleryManifestService = class extends Disposable {
  constructor(productService) {
    super();
    this.productService = productService;
    this.onDidChangeExtensionGalleryManifest = Event.None;
  }
  isEnabled() {
    return !!this.productService.extensionsGallery?.serviceUrl;
  }
  async getExtensionGalleryManifest() {
    const extensionsGallery = this.productService.extensionsGallery;
    if (!extensionsGallery?.serviceUrl) {
      return null;
    }
    const resources = [
      {
        id: `${extensionsGallery.serviceUrl}/extensionquery`,
        type: ExtensionGalleryResourceType.ExtensionQueryService
      },
      {
        id: `${extensionsGallery.serviceUrl}/vscode/{publisher}/{name}/latest`,
        type: ExtensionGalleryResourceType.ExtensionLatestVersionUri
      },
      {
        id: `${extensionsGallery.serviceUrl}/publishers/{publisher}/extensions/{name}/{version}/stats?statType={statTypeName}`,
        type: ExtensionGalleryResourceType.ExtensionStatisticsUri
      },
      {
        id: `${extensionsGallery.serviceUrl}/itemName/{publisher}.{name}/version/{version}/statType/{statTypeValue}/vscodewebextension`,
        type: ExtensionGalleryResourceType.WebExtensionStatisticsUri
      }
    ];
    if (extensionsGallery.publisherUrl) {
      resources.push({
        id: `${extensionsGallery.publisherUrl}/{publisher}`,
        type: ExtensionGalleryResourceType.PublisherViewUri
      });
    }
    if (extensionsGallery.itemUrl) {
      resources.push({
        id: `${extensionsGallery.itemUrl}/?itemName={publisher}.{name}`,
        type: ExtensionGalleryResourceType.ExtensionDetailsViewUri
      });
      resources.push({
        id: `${extensionsGallery.itemUrl}/?itemName={publisher}.{name}&ssr=false#review-details`,
        type: ExtensionGalleryResourceType.ExtensionRatingViewUri
      });
    }
    if (extensionsGallery.resourceUrlTemplate) {
      resources.push({
        id: extensionsGallery.resourceUrlTemplate,
        type: ExtensionGalleryResourceType.ExtensionResourceUri
      });
    }
    const filtering = [
      {
        name: FilterType.Tag,
        value: 1
      },
      {
        name: FilterType.ExtensionId,
        value: 4
      },
      {
        name: FilterType.Category,
        value: 5
      },
      {
        name: FilterType.ExtensionName,
        value: 7
      },
      {
        name: FilterType.Target,
        value: 8
      },
      {
        name: FilterType.Featured,
        value: 9
      },
      {
        name: FilterType.SearchText,
        value: 10
      },
      {
        name: FilterType.ExcludeWithFlags,
        value: 12
      }
    ];
    const sorting = [
      {
        name: SortBy.NoneOrRelevance,
        value: 0
      },
      {
        name: SortBy.LastUpdatedDate,
        value: 1
      },
      {
        name: SortBy.Title,
        value: 2
      },
      {
        name: SortBy.PublisherName,
        value: 3
      },
      {
        name: SortBy.InstallCount,
        value: 4
      },
      {
        name: SortBy.AverageRating,
        value: 6
      },
      {
        name: SortBy.PublishedDate,
        value: 10
      },
      {
        name: SortBy.WeightedRating,
        value: 12
      }
    ];
    const flags = [
      {
        name: Flag.None,
        value: 0
      },
      {
        name: Flag.IncludeVersions,
        value: 1
      },
      {
        name: Flag.IncludeFiles,
        value: 2
      },
      {
        name: Flag.IncludeCategoryAndTags,
        value: 4
      },
      {
        name: Flag.IncludeSharedAccounts,
        value: 8
      },
      {
        name: Flag.IncludeVersionProperties,
        value: 16
      },
      {
        name: Flag.ExcludeNonValidated,
        value: 32
      },
      {
        name: Flag.IncludeInstallationTargets,
        value: 64
      },
      {
        name: Flag.IncludeAssetUri,
        value: 128
      },
      {
        name: Flag.IncludeStatistics,
        value: 256
      },
      {
        name: Flag.IncludeLatestVersionOnly,
        value: 512
      },
      {
        name: Flag.Unpublished,
        value: 4096
      },
      {
        name: Flag.IncludeNameConflictInfo,
        value: 32768
      },
      {
        name: Flag.IncludeLatestPrereleaseAndStableVersionOnly,
        value: 65536
      }
    ];
    return {
      version: "",
      resources,
      capabilities: {
        extensionQuery: {
          filtering,
          sorting,
          flags
        },
        signing: {
          allRepositorySigned: true
        }
      }
    };
  }
};
ExtensionGalleryManifestService = __decorateClass([
  __decorateParam(0, IProductService)
], ExtensionGalleryManifestService);
export {
  ExtensionGalleryManifestService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZVR5cGUsIEZsYWcsIElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QsIElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlIH0gZnJvbSAnLi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuaW1wb3J0IHsgRmlsdGVyVHlwZSwgU29ydEJ5IH0gZnJvbSAnLi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcblxudHlwZSBFeHRlbnNpb25HYWxsZXJ5Q29uZmlnID0ge1xuXHRyZWFkb25seSBzZXJ2aWNlVXJsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGl0ZW1Vcmw6IHN0cmluZztcblx0cmVhZG9ubHkgcHVibGlzaGVyVXJsOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHJlc291cmNlVXJsVGVtcGxhdGU6IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uVXJsVGVtcGxhdGU6IHN0cmluZztcblx0cmVhZG9ubHkgY29udHJvbFVybDogc3RyaW5nO1xuXHRyZWFkb25seSBubHNCYXNlVXJsOiBzdHJpbmc7XG59O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCA9IEV2ZW50Lk5vbmU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGlzRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnByb2R1Y3RTZXJ2aWNlLmV4dGVuc2lvbnNHYWxsZXJ5Py5zZXJ2aWNlVXJsO1xuXHR9XG5cblx0YXN5bmMgZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KCk6IFByb21pc2U8SUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCB8IG51bGw+IHtcblx0XHRjb25zdCBleHRlbnNpb25zR2FsbGVyeSA9IHRoaXMucHJvZHVjdFNlcnZpY2UuZXh0ZW5zaW9uc0dhbGxlcnkgYXMgRXh0ZW5zaW9uR2FsbGVyeUNvbmZpZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoIWV4dGVuc2lvbnNHYWxsZXJ5Py5zZXJ2aWNlVXJsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCByZXNvdXJjZXMgPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBgJHtleHRlbnNpb25zR2FsbGVyeS5zZXJ2aWNlVXJsfS9leHRlbnNpb25xdWVyeWAsXG5cdFx0XHRcdHR5cGU6IEV4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZVR5cGUuRXh0ZW5zaW9uUXVlcnlTZXJ2aWNlXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogYCR7ZXh0ZW5zaW9uc0dhbGxlcnkuc2VydmljZVVybH0vdnNjb2RlL3twdWJsaXNoZXJ9L3tuYW1lfS9sYXRlc3RgLFxuXHRcdFx0XHR0eXBlOiBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvbkxhdGVzdFZlcnNpb25Vcmlcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBgJHtleHRlbnNpb25zR2FsbGVyeS5zZXJ2aWNlVXJsfS9wdWJsaXNoZXJzL3twdWJsaXNoZXJ9L2V4dGVuc2lvbnMve25hbWV9L3t2ZXJzaW9ufS9zdGF0cz9zdGF0VHlwZT17c3RhdFR5cGVOYW1lfWAsXG5cdFx0XHRcdHR5cGU6IEV4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZVR5cGUuRXh0ZW5zaW9uU3RhdGlzdGljc1VyaVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0aWQ6IGAke2V4dGVuc2lvbnNHYWxsZXJ5LnNlcnZpY2VVcmx9L2l0ZW1OYW1lL3twdWJsaXNoZXJ9LntuYW1lfS92ZXJzaW9uL3t2ZXJzaW9ufS9zdGF0VHlwZS97c3RhdFR5cGVWYWx1ZX0vdnNjb2Rld2ViZXh0ZW5zaW9uYCxcblx0XHRcdFx0dHlwZTogRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5XZWJFeHRlbnNpb25TdGF0aXN0aWNzVXJpXG5cdFx0XHR9LFxuXHRcdF07XG5cblx0XHRpZiAoZXh0ZW5zaW9uc0dhbGxlcnkucHVibGlzaGVyVXJsKSB7XG5cdFx0XHRyZXNvdXJjZXMucHVzaCh7XG5cdFx0XHRcdGlkOiBgJHtleHRlbnNpb25zR2FsbGVyeS5wdWJsaXNoZXJVcmx9L3twdWJsaXNoZXJ9YCxcblx0XHRcdFx0dHlwZTogRXh0ZW5zaW9uR2FsbGVyeVJlc291cmNlVHlwZS5QdWJsaXNoZXJWaWV3VXJpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoZXh0ZW5zaW9uc0dhbGxlcnkuaXRlbVVybCkge1xuXHRcdFx0cmVzb3VyY2VzLnB1c2goe1xuXHRcdFx0XHRpZDogYCR7ZXh0ZW5zaW9uc0dhbGxlcnkuaXRlbVVybH0vP2l0ZW1OYW1lPXtwdWJsaXNoZXJ9LntuYW1lfWAsXG5cdFx0XHRcdHR5cGU6IEV4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZVR5cGUuRXh0ZW5zaW9uRGV0YWlsc1ZpZXdVcmlcblx0XHRcdH0pO1xuXHRcdFx0cmVzb3VyY2VzLnB1c2goe1xuXHRcdFx0XHRpZDogYCR7ZXh0ZW5zaW9uc0dhbGxlcnkuaXRlbVVybH0vP2l0ZW1OYW1lPXtwdWJsaXNoZXJ9LntuYW1lfSZzc3I9ZmFsc2UjcmV2aWV3LWRldGFpbHNgLFxuXHRcdFx0XHR0eXBlOiBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvblJhdGluZ1ZpZXdVcmlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChleHRlbnNpb25zR2FsbGVyeS5yZXNvdXJjZVVybFRlbXBsYXRlKSB7XG5cdFx0XHRyZXNvdXJjZXMucHVzaCh7XG5cdFx0XHRcdGlkOiBleHRlbnNpb25zR2FsbGVyeS5yZXNvdXJjZVVybFRlbXBsYXRlLFxuXHRcdFx0XHR0eXBlOiBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvblJlc291cmNlVXJpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBmaWx0ZXJpbmcgPSBbXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IEZpbHRlclR5cGUuVGFnLFxuXHRcdFx0XHR2YWx1ZTogMSxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IEZpbHRlclR5cGUuRXh0ZW5zaW9uSWQsXG5cdFx0XHRcdHZhbHVlOiA0LFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmlsdGVyVHlwZS5DYXRlZ29yeSxcblx0XHRcdFx0dmFsdWU6IDUsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGaWx0ZXJUeXBlLkV4dGVuc2lvbk5hbWUsXG5cdFx0XHRcdHZhbHVlOiA3LFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmlsdGVyVHlwZS5UYXJnZXQsXG5cdFx0XHRcdHZhbHVlOiA4LFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmlsdGVyVHlwZS5GZWF0dXJlZCxcblx0XHRcdFx0dmFsdWU6IDksXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGaWx0ZXJUeXBlLlNlYXJjaFRleHQsXG5cdFx0XHRcdHZhbHVlOiAxMCxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IEZpbHRlclR5cGUuRXhjbHVkZVdpdGhGbGFncyxcblx0XHRcdFx0dmFsdWU6IDEyLFxuXHRcdFx0fSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgc29ydGluZyA9IFtcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogU29ydEJ5Lk5vbmVPclJlbGV2YW5jZSxcblx0XHRcdFx0dmFsdWU6IDAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBTb3J0QnkuTGFzdFVwZGF0ZWREYXRlLFxuXHRcdFx0XHR2YWx1ZTogMSxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IFNvcnRCeS5UaXRsZSxcblx0XHRcdFx0dmFsdWU6IDIsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBTb3J0QnkuUHVibGlzaGVyTmFtZSxcblx0XHRcdFx0dmFsdWU6IDMsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBTb3J0QnkuSW5zdGFsbENvdW50LFxuXHRcdFx0XHR2YWx1ZTogNCxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IFNvcnRCeS5BdmVyYWdlUmF0aW5nLFxuXHRcdFx0XHR2YWx1ZTogNixcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IFNvcnRCeS5QdWJsaXNoZWREYXRlLFxuXHRcdFx0XHR2YWx1ZTogMTAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBTb3J0QnkuV2VpZ2h0ZWRSYXRpbmcsXG5cdFx0XHRcdHZhbHVlOiAxMixcblx0XHRcdH0sXG5cdFx0XTtcblxuXHRcdGNvbnN0IGZsYWdzID0gW1xuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLk5vbmUsXG5cdFx0XHRcdHZhbHVlOiAweDAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVWZXJzaW9ucyxcblx0XHRcdFx0dmFsdWU6IDB4MSxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IEZsYWcuSW5jbHVkZUZpbGVzLFxuXHRcdFx0XHR2YWx1ZTogMHgyLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmxhZy5JbmNsdWRlQ2F0ZWdvcnlBbmRUYWdzLFxuXHRcdFx0XHR2YWx1ZTogMHg0LFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmxhZy5JbmNsdWRlU2hhcmVkQWNjb3VudHMsXG5cdFx0XHRcdHZhbHVlOiAweDgsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVWZXJzaW9uUHJvcGVydGllcyxcblx0XHRcdFx0dmFsdWU6IDB4MTAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkV4Y2x1ZGVOb25WYWxpZGF0ZWQsXG5cdFx0XHRcdHZhbHVlOiAweDIwLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmxhZy5JbmNsdWRlSW5zdGFsbGF0aW9uVGFyZ2V0cyxcblx0XHRcdFx0dmFsdWU6IDB4NDAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVBc3NldFVyaSxcblx0XHRcdFx0dmFsdWU6IDB4ODAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVTdGF0aXN0aWNzLFxuXHRcdFx0XHR2YWx1ZTogMHgxMDAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVMYXRlc3RWZXJzaW9uT25seSxcblx0XHRcdFx0dmFsdWU6IDB4MjAwLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogRmxhZy5VbnB1Ymxpc2hlZCxcblx0XHRcdFx0dmFsdWU6IDB4MTAwMCxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IEZsYWcuSW5jbHVkZU5hbWVDb25mbGljdEluZm8sXG5cdFx0XHRcdHZhbHVlOiAweDgwMDAsXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBGbGFnLkluY2x1ZGVMYXRlc3RQcmVyZWxlYXNlQW5kU3RhYmxlVmVyc2lvbk9ubHksXG5cdFx0XHRcdHZhbHVlOiAweDEwMDAwLFxuXHRcdFx0fSxcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHZlcnNpb246ICcnLFxuXHRcdFx0cmVzb3VyY2VzLFxuXHRcdFx0Y2FwYWJpbGl0aWVzOiB7XG5cdFx0XHRcdGV4dGVuc2lvblF1ZXJ5OiB7XG5cdFx0XHRcdFx0ZmlsdGVyaW5nLFxuXHRcdFx0XHRcdHNvcnRpbmcsXG5cdFx0XHRcdFx0ZmxhZ3MsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNpZ25pbmc6IHtcblx0XHRcdFx0XHRhbGxSZXBvc2l0b3J5U2lnbmVkOiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjog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
