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
import { ExtensionRecommendations } from "./extensionRecommendations.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ExtensionRecommendationReason } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { PlatformToString, platform } from "../../../../base/common/platform.js";
let RemoteRecommendations = class extends ExtensionRecommendations {
  constructor(productService) {
    super();
    this.productService = productService;
    this._recommendations = [];
  }
  get recommendations() {
    return this._recommendations;
  }
  async doActivate() {
    const extensionTips = { ...this.productService.remoteExtensionTips, ...this.productService.virtualWorkspaceExtensionTips };
    const currentPlatform = PlatformToString(platform);
    this._recommendations = Object.values(extensionTips).filter(({ supportedPlatforms }) => !supportedPlatforms || supportedPlatforms.includes(currentPlatform)).map((extension) => ({
      extension: extension.extensionId.toLowerCase(),
      reason: {
        reasonId: ExtensionRecommendationReason.Application,
        reasonText: ""
      }
    }));
  }
};
RemoteRecommendations = __decorateClass([
  __decorateParam(0, IProductService)
], RemoteRecommendations);
export {
  RemoteRecommendations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvcmVtb3RlUmVjb21tZW5kYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLCBHYWxsZXJ5RXh0ZW5zaW9uUmVjb21tZW5kYXRpb24gfSBmcm9tICcuL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvblJlYXNvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLmpzJztcbmltcG9ydCB7IFBsYXRmb3JtVG9TdHJpbmcsIHBsYXRmb3JtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuXG5leHBvcnQgY2xhc3MgUmVtb3RlUmVjb21tZW5kYXRpb25zIGV4dGVuZHMgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zIHtcblxuXHRwcml2YXRlIF9yZWNvbW1lbmRhdGlvbnM6IEdhbGxlcnlFeHRlbnNpb25SZWNvbW1lbmRhdGlvbltdID0gW107XG5cdGdldCByZWNvbW1lbmRhdGlvbnMoKTogUmVhZG9ubHlBcnJheTxHYWxsZXJ5RXh0ZW5zaW9uUmVjb21tZW5kYXRpb24+IHsgcmV0dXJuIHRoaXMuX3JlY29tbWVuZGF0aW9uczsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGRvQWN0aXZhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uVGlwcyA9IHsgLi4udGhpcy5wcm9kdWN0U2VydmljZS5yZW1vdGVFeHRlbnNpb25UaXBzLCAuLi50aGlzLnByb2R1Y3RTZXJ2aWNlLnZpcnR1YWxXb3Jrc3BhY2VFeHRlbnNpb25UaXBzIH07XG5cdFx0Y29uc3QgY3VycmVudFBsYXRmb3JtID0gUGxhdGZvcm1Ub1N0cmluZyhwbGF0Zm9ybSk7XG5cdFx0dGhpcy5fcmVjb21tZW5kYXRpb25zID0gT2JqZWN0LnZhbHVlcyhleHRlbnNpb25UaXBzKS5maWx0ZXIoKHsgc3VwcG9ydGVkUGxhdGZvcm1zIH0pID0+ICFzdXBwb3J0ZWRQbGF0Zm9ybXMgfHwgc3VwcG9ydGVkUGxhdGZvcm1zLmluY2x1ZGVzKGN1cnJlbnRQbGF0Zm9ybSkpLm1hcChleHRlbnNpb24gPT4gKHtcblx0XHRcdGV4dGVuc2lvbjogZXh0ZW5zaW9uLmV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCksXG5cdFx0XHRyZWFzb246IHtcblx0XHRcdFx0cmVhc29uSWQ6IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uLkFwcGxpY2F0aW9uLFxuXHRcdFx0XHRyZWFzb25UZXh0OiAnJ1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0NBQWdFO0FBQ3pFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsa0JBQWtCLGdCQUFnQjtBQUVwQyxJQUFNLHdCQUFOLGNBQW9DLHlCQUF5QjtBQUFBLEVBS25FLFlBQ21DLGdCQUNqQztBQUNELFVBQU07QUFGNEI7QUFKbkMsU0FBUSxtQkFBcUQsQ0FBQztBQUFBLEVBTzlEO0FBQUEsRUFOQSxJQUFJLGtCQUFpRTtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQWtCO0FBQUEsRUFRckcsTUFBZ0IsYUFBNEI7QUFDM0MsVUFBTSxnQkFBZ0IsRUFBRSxHQUFHLEtBQUssZUFBZSxxQkFBcUIsR0FBRyxLQUFLLGVBQWUsOEJBQThCO0FBQ3pILFVBQU0sa0JBQWtCLGlCQUFpQixRQUFRO0FBQ2pELFNBQUssbUJBQW1CLE9BQU8sT0FBTyxhQUFhLEVBQUUsT0FBTyxDQUFDLEVBQUUsbUJBQW1CLE1BQU0sQ0FBQyxzQkFBc0IsbUJBQW1CLFNBQVMsZUFBZSxDQUFDLEVBQUUsSUFBSSxnQkFBYztBQUFBLE1BQzlLLFdBQVcsVUFBVSxZQUFZLFlBQVk7QUFBQSxNQUM3QyxRQUFRO0FBQUEsUUFDUCxVQUFVLDhCQUE4QjtBQUFBLFFBQ3hDLFlBQVk7QUFBQSxNQUNiO0FBQUEsSUFDRCxFQUFFO0FBQUEsRUFDSDtBQUNEO0FBdEJhLHdCQUFOO0FBQUEsRUFNSjtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
