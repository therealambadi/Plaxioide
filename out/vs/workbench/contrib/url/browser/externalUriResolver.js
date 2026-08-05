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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
let ExternalUriResolverContribution = class extends Disposable {
  constructor(_openerService, _workbenchEnvironmentService) {
    super();
    if (_workbenchEnvironmentService.options?.resolveExternalUri) {
      this._register(_openerService.registerExternalUriResolver({
        resolveExternalUri: async (resource) => {
          return {
            resolved: await _workbenchEnvironmentService.options.resolveExternalUri(resource),
            dispose: () => {
            }
          };
        }
      }));
    }
  }
};
ExternalUriResolverContribution.ID = "workbench.contrib.externalUriResolver";
ExternalUriResolverContribution = __decorateClass([
  __decorateParam(0, IOpenerService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService)
], ExternalUriResolverContribution);
export {
  ExternalUriResolverContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91cmwvYnJvd3Nlci9leHRlcm5hbFVyaVJlc29sdmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dGVybmFsVXJpUmVzb2x2ZXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmV4dGVybmFsVXJpUmVzb2x2ZXInO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3BlbmVyU2VydmljZSBfb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIF93b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2U6IElCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKF93b3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2Uub3B0aW9ucz8ucmVzb2x2ZUV4dGVybmFsVXJpKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihfb3BlbmVyU2VydmljZS5yZWdpc3RlckV4dGVybmFsVXJpUmVzb2x2ZXIoe1xuXHRcdFx0XHRyZXNvbHZlRXh0ZXJuYWxVcmk6IGFzeW5jIChyZXNvdXJjZSkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlZDogYXdhaXQgX3dvcmtiZW5jaEVudmlyb25tZW50U2VydmljZS5vcHRpb25zIS5yZXNvbHZlRXh0ZXJuYWxVcmkhKHJlc291cmNlKSxcblx0XHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gVE9ET0BtamJ2eiAtIGRvIHdlIG5lZWQgdG8gZG8gYW55dGhpbmcgaGVyZT9cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsMkNBQTJDO0FBRTdDLElBQU0sa0NBQU4sY0FBOEMsV0FBNkM7QUFBQSxFQUlqRyxZQUNpQixnQkFDcUIsOEJBQ3BDO0FBQ0QsVUFBTTtBQUVOLFFBQUksNkJBQTZCLFNBQVMsb0JBQW9CO0FBQzdELFdBQUssVUFBVSxlQUFlLDRCQUE0QjtBQUFBLFFBQ3pELG9CQUFvQixPQUFPLGFBQWE7QUFDdkMsaUJBQU87QUFBQSxZQUNOLFVBQVUsTUFBTSw2QkFBNkIsUUFBUyxtQkFBb0IsUUFBUTtBQUFBLFlBQ2xGLFNBQVMsTUFBTTtBQUFBLFlBRWY7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFDRDtBQXZCYSxnQ0FFSSxLQUFLO0FBRlQsa0NBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
