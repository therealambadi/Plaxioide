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
let LanguageRecommendations = class extends ExtensionRecommendations {
  constructor(productService) {
    super();
    this.productService = productService;
    this._recommendations = [];
  }
  get recommendations() {
    return this._recommendations;
  }
  async doActivate() {
    if (this.productService.languageExtensionTips) {
      this._recommendations = this.productService.languageExtensionTips.map((extensionId) => ({
        extension: extensionId.toLowerCase(),
        reason: {
          reasonId: ExtensionRecommendationReason.Application,
          reasonText: ""
        }
      }));
    }
  }
};
LanguageRecommendations = __decorateClass([
  __decorateParam(0, IProductService)
], LanguageRecommendations);
export {
  LanguageRecommendations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvbGFuZ3VhZ2VSZWNvbW1lbmRhdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnMsIEV4dGVuc2lvblJlY29tbWVuZGF0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25SZWFzb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMvY29tbW9uL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBMYW5ndWFnZVJlY29tbWVuZGF0aW9ucyBleHRlbmRzIEV4dGVuc2lvblJlY29tbWVuZGF0aW9ucyB7XG5cblx0cHJpdmF0ZSBfcmVjb21tZW5kYXRpb25zOiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbltdID0gW107XG5cdGdldCByZWNvbW1lbmRhdGlvbnMoKTogUmVhZG9ubHlBcnJheTxFeHRlbnNpb25SZWNvbW1lbmRhdGlvbj4geyByZXR1cm4gdGhpcy5fcmVjb21tZW5kYXRpb25zOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZG9BY3RpdmF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5wcm9kdWN0U2VydmljZS5sYW5ndWFnZUV4dGVuc2lvblRpcHMpIHtcblx0XHRcdHRoaXMuX3JlY29tbWVuZGF0aW9ucyA9IHRoaXMucHJvZHVjdFNlcnZpY2UubGFuZ3VhZ2VFeHRlbnNpb25UaXBzLm1hcCgoZXh0ZW5zaW9uSWQpOiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbiA9PiAoe1xuXHRcdFx0XHRleHRlbnNpb246IGV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCksXG5cdFx0XHRcdHJlYXNvbjoge1xuXHRcdFx0XHRcdHJlYXNvbklkOiBFeHRlbnNpb25SZWNvbW1lbmRhdGlvblJlYXNvbi5BcHBsaWNhdGlvbixcblx0XHRcdFx0XHRyZWFzb25UZXh0OiAnJ1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0NBQXlEO0FBQ2xFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUNBQXFDO0FBRXZDLElBQU0sMEJBQU4sY0FBc0MseUJBQXlCO0FBQUEsRUFLckUsWUFDbUMsZ0JBQ2pDO0FBQ0QsVUFBTTtBQUY0QjtBQUpuQyxTQUFRLG1CQUE4QyxDQUFDO0FBQUEsRUFPdkQ7QUFBQSxFQU5BLElBQUksa0JBQTBEO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBa0I7QUFBQSxFQVE5RixNQUFnQixhQUE0QjtBQUMzQyxRQUFJLEtBQUssZUFBZSx1QkFBdUI7QUFDOUMsV0FBSyxtQkFBbUIsS0FBSyxlQUFlLHNCQUFzQixJQUFJLENBQUMsaUJBQTBDO0FBQUEsUUFDaEgsV0FBVyxZQUFZLFlBQVk7QUFBQSxRQUNuQyxRQUFRO0FBQUEsVUFDUCxVQUFVLDhCQUE4QjtBQUFBLFVBQ3hDLFlBQVk7QUFBQSxRQUNiO0FBQUEsTUFDRCxFQUFFO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFDRDtBQXRCYSwwQkFBTjtBQUFBLEVBTUo7QUFBQSxHQU5VOyIsCiAgIm5hbWVzIjogW10KfQo=
