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
let KeymapRecommendations = class extends ExtensionRecommendations {
  constructor(productService) {
    super();
    this.productService = productService;
    this._recommendations = [];
  }
  get recommendations() {
    return this._recommendations;
  }
  async doActivate() {
    if (this.productService.keymapExtensionTips) {
      this._recommendations = this.productService.keymapExtensionTips.map((extensionId) => ({
        extension: extensionId.toLowerCase(),
        reason: {
          reasonId: ExtensionRecommendationReason.Application,
          reasonText: ""
        }
      }));
    }
  }
};
KeymapRecommendations = __decorateClass([
  __decorateParam(0, IProductService)
], KeymapRecommendations);
export {
  KeymapRecommendations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIva2V5bWFwUmVjb21tZW5kYXRpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLCBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbiB9IGZyb20gJy4vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgS2V5bWFwUmVjb21tZW5kYXRpb25zIGV4dGVuZHMgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zIHtcblxuXHRwcml2YXRlIF9yZWNvbW1lbmRhdGlvbnM6IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uW10gPSBbXTtcblx0Z2V0IHJlY29tbWVuZGF0aW9ucygpOiBSZWFkb25seUFycmF5PEV4dGVuc2lvblJlY29tbWVuZGF0aW9uPiB7IHJldHVybiB0aGlzLl9yZWNvbW1lbmRhdGlvbnM7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBkb0FjdGl2YXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnByb2R1Y3RTZXJ2aWNlLmtleW1hcEV4dGVuc2lvblRpcHMpIHtcblx0XHRcdHRoaXMuX3JlY29tbWVuZGF0aW9ucyA9IHRoaXMucHJvZHVjdFNlcnZpY2Uua2V5bWFwRXh0ZW5zaW9uVGlwcy5tYXAoZXh0ZW5zaW9uSWQgPT4gKHtcblx0XHRcdFx0ZXh0ZW5zaW9uOiBleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpLFxuXHRcdFx0XHRyZWFzb246IHtcblx0XHRcdFx0XHRyZWFzb25JZDogRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24uQXBwbGljYXRpb24sXG5cdFx0XHRcdFx0cmVhc29uVGV4dDogJydcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQ0FBeUQ7QUFDbEUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQ0FBcUM7QUFFdkMsSUFBTSx3QkFBTixjQUFvQyx5QkFBeUI7QUFBQSxFQUtuRSxZQUNtQyxnQkFDakM7QUFDRCxVQUFNO0FBRjRCO0FBSm5DLFNBQVEsbUJBQThDLENBQUM7QUFBQSxFQU92RDtBQUFBLEVBTkEsSUFBSSxrQkFBMEQ7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFrQjtBQUFBLEVBUTlGLE1BQWdCLGFBQTRCO0FBQzNDLFFBQUksS0FBSyxlQUFlLHFCQUFxQjtBQUM1QyxXQUFLLG1CQUFtQixLQUFLLGVBQWUsb0JBQW9CLElBQUksa0JBQWdCO0FBQUEsUUFDbkYsV0FBVyxZQUFZLFlBQVk7QUFBQSxRQUNuQyxRQUFRO0FBQUEsVUFDUCxVQUFVLDhCQUE4QjtBQUFBLFVBQ3hDLFlBQVk7QUFBQSxRQUNiO0FBQUEsTUFDRCxFQUFFO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFFRDtBQXZCYSx3QkFBTjtBQUFBLEVBTUo7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
