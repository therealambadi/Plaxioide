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
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ITextResourcePropertiesService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { OperatingSystem, OS } from "../../../../base/common/platform.js";
import { Schemas } from "../../../../base/common/network.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
let TextResourcePropertiesService = class {
  constructor(configurationService, remoteAgentService, environmentService, storageService) {
    this.configurationService = configurationService;
    this.environmentService = environmentService;
    this.storageService = storageService;
    this.remoteEnvironment = null;
    remoteAgentService.getEnvironment().then((remoteEnv) => this.remoteEnvironment = remoteEnv);
  }
  getEOL(resource, language) {
    const eol = this.configurationService.getValue("files.eol", { overrideIdentifier: language, resource });
    if (eol && typeof eol === "string" && eol !== "auto") {
      return eol;
    }
    const os = this.getOS(resource);
    return os === OperatingSystem.Linux || os === OperatingSystem.Macintosh ? "\n" : "\r\n";
  }
  getOS(resource) {
    let os = OS;
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (remoteAuthority) {
      if (resource && resource.scheme !== Schemas.file) {
        const osCacheKey = `resource.authority.os.${remoteAuthority}`;
        os = this.remoteEnvironment ? this.remoteEnvironment.os : (
          /* Get it from cache */
          this.storageService.getNumber(osCacheKey, StorageScope.WORKSPACE, OS)
        );
        this.storageService.store(osCacheKey, os, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    }
    return os;
  }
};
TextResourcePropertiesService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IStorageService)
], TextResourcePropertiesService);
registerSingleton(ITextResourcePropertiesService, TextResourcePropertiesService, InstantiationType.Delayed);
export {
  TextResourcePropertiesService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dHJlc291cmNlUHJvcGVydGllcy9jb21tb24vdGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgT3BlcmF0aW5nU3lzdGVtLCBPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudEVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSBpbXBsZW1lbnRzIElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZW1vdGVFbnZpcm9ubWVudDogSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2Vcblx0KSB7XG5cdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkudGhlbihyZW1vdGVFbnYgPT4gdGhpcy5yZW1vdGVFbnZpcm9ubWVudCA9IHJlbW90ZUVudik7XG5cdH1cblxuXHRnZXRFT0wocmVzb3VyY2U/OiBVUkksIGxhbmd1YWdlPzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBlb2wgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdmaWxlcy5lb2wnLCB7IG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UsIHJlc291cmNlIH0pO1xuXHRcdGlmIChlb2wgJiYgdHlwZW9mIGVvbCA9PT0gJ3N0cmluZycgJiYgZW9sICE9PSAnYXV0bycpIHtcblx0XHRcdHJldHVybiBlb2w7XG5cdFx0fVxuXHRcdGNvbnN0IG9zID0gdGhpcy5nZXRPUyhyZXNvdXJjZSk7XG5cdFx0cmV0dXJuIG9zID09PSBPcGVyYXRpbmdTeXN0ZW0uTGludXggfHwgb3MgPT09IE9wZXJhdGluZ1N5c3RlbS5NYWNpbnRvc2ggPyAnXFxuJyA6ICdcXHJcXG4nO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPUyhyZXNvdXJjZT86IFVSSSk6IE9wZXJhdGluZ1N5c3RlbSB7XG5cdFx0bGV0IG9zID0gT1M7XG5cblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0aWYgKHJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0aWYgKHJlc291cmNlICYmIHJlc291cmNlLnNjaGVtZSAhPT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGNvbnN0IG9zQ2FjaGVLZXkgPSBgcmVzb3VyY2UuYXV0aG9yaXR5Lm9zLiR7cmVtb3RlQXV0aG9yaXR5fWA7XG5cdFx0XHRcdG9zID0gdGhpcy5yZW1vdGVFbnZpcm9ubWVudCA/IHRoaXMucmVtb3RlRW52aXJvbm1lbnQub3MgOiAvKiBHZXQgaXQgZnJvbSBjYWNoZSAqLyB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihvc0NhY2hlS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBPUyk7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUob3NDYWNoZUtleSwgb3MsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9zO1xuXHR9XG59XG5cbnJlZ2lzdGVyU2luZ2xldG9uKElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSwgVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGlCQUFpQixVQUFVO0FBQ3BDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLG1CQUFtQix5QkFBeUI7QUFFckQsU0FBUywyQkFBMkI7QUFFN0IsSUFBTSxnQ0FBTixNQUE4RTtBQUFBLEVBTXBGLFlBQ3lDLHNCQUNuQixvQkFDMEIsb0JBQ2IsZ0JBQ2pDO0FBSnVDO0FBRU87QUFDYjtBQU5uQyxTQUFRLG9CQUFvRDtBQVEzRCx1QkFBbUIsZUFBZSxFQUFFLEtBQUssZUFBYSxLQUFLLG9CQUFvQixTQUFTO0FBQUEsRUFDekY7QUFBQSxFQUVBLE9BQU8sVUFBZ0IsVUFBMkI7QUFDakQsVUFBTSxNQUFNLEtBQUsscUJBQXFCLFNBQVMsYUFBYSxFQUFFLG9CQUFvQixVQUFVLFNBQVMsQ0FBQztBQUN0RyxRQUFJLE9BQU8sT0FBTyxRQUFRLFlBQVksUUFBUSxRQUFRO0FBQ3JELGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxLQUFLLEtBQUssTUFBTSxRQUFRO0FBQzlCLFdBQU8sT0FBTyxnQkFBZ0IsU0FBUyxPQUFPLGdCQUFnQixZQUFZLE9BQU87QUFBQSxFQUNsRjtBQUFBLEVBRVEsTUFBTSxVQUFpQztBQUM5QyxRQUFJLEtBQUs7QUFFVCxVQUFNLGtCQUFrQixLQUFLLG1CQUFtQjtBQUNoRCxRQUFJLGlCQUFpQjtBQUNwQixVQUFJLFlBQVksU0FBUyxXQUFXLFFBQVEsTUFBTTtBQUNqRCxjQUFNLGFBQWEseUJBQXlCLGVBQWU7QUFDM0QsYUFBSyxLQUFLLG9CQUFvQixLQUFLLGtCQUFrQjtBQUFBO0FBQUEsVUFBNkIsS0FBSyxlQUFlLFVBQVUsWUFBWSxhQUFhLFdBQVcsRUFBRTtBQUFBO0FBQ3RKLGFBQUssZUFBZSxNQUFNLFlBQVksSUFBSSxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQUEsTUFDeEY7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQXRDYSxnQ0FBTjtBQUFBLEVBT0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZVO0FBd0NiLGtCQUFrQixnQ0FBZ0MsK0JBQStCLGtCQUFrQixPQUFPOyIsCiAgIm5hbWVzIjogW10KfQo=
