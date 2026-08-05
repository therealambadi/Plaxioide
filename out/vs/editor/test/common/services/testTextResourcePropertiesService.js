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
import * as platform from "../../../../base/common/platform.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
let TestTextResourcePropertiesService = class {
  constructor(configurationService) {
    this.configurationService = configurationService;
  }
  getEOL(resource, language) {
    const eol = this.configurationService.getValue("files.eol", { overrideIdentifier: language, resource });
    if (eol && typeof eol === "string" && eol !== "auto") {
      return eol;
    }
    return platform.isLinux || platform.isMacintosh ? "\n" : "\r\n";
  }
};
TestTextResourcePropertiesService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], TestTextResourcePropertiesService);
export {
  TestTextResourcePropertiesService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvdGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuXG5leHBvcnQgY2xhc3MgVGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIGltcGxlbWVudHMgSVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdH1cblxuXHRnZXRFT0wocmVzb3VyY2U6IFVSSSwgbGFuZ3VhZ2U/OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGVvbCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2ZpbGVzLmVvbCcsIHsgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSwgcmVzb3VyY2UgfSk7XG5cdFx0aWYgKGVvbCAmJiB0eXBlb2YgZW9sID09PSAnc3RyaW5nJyAmJiBlb2wgIT09ICdhdXRvJykge1xuXHRcdFx0cmV0dXJuIGVvbDtcblx0XHR9XG5cdFx0cmV0dXJuIChwbGF0Zm9ybS5pc0xpbnV4IHx8IHBsYXRmb3JtLmlzTWFjaW50b3NoKSA/ICdcXG4nIDogJ1xcclxcbic7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxjQUFjO0FBRzFCLFNBQVMsNkJBQTZCO0FBRS9CLElBQU0sb0NBQU4sTUFBa0Y7QUFBQSxFQUl4RixZQUN5QyxzQkFDdkM7QUFEdUM7QUFBQSxFQUV6QztBQUFBLEVBRUEsT0FBTyxVQUFlLFVBQTJCO0FBQ2hELFVBQU0sTUFBTSxLQUFLLHFCQUFxQixTQUFTLGFBQWEsRUFBRSxvQkFBb0IsVUFBVSxTQUFTLENBQUM7QUFDdEcsUUFBSSxPQUFPLE9BQU8sUUFBUSxZQUFZLFFBQVEsUUFBUTtBQUNyRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQVEsU0FBUyxXQUFXLFNBQVMsY0FBZSxPQUFPO0FBQUEsRUFDNUQ7QUFDRDtBQWhCYSxvQ0FBTjtBQUFBLEVBS0o7QUFBQSxHQUxVOyIsCiAgIm5hbWVzIjogW10KfQo=
