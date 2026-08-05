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
import { ErrorNoTelemetry } from "../../../../base/common/errors.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ITerminalLogService } from "../../../../platform/terminal/common/terminal.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ITerminalInstanceService } from "../browser/terminal.js";
import { BaseTerminalProfileResolverService } from "../browser/terminalProfileResolverService.js";
import { ITerminalProfileService } from "../common/terminal.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
let ElectronTerminalProfileResolverService = class extends BaseTerminalProfileResolverService {
  constructor(configurationResolverService, configurationService, historyService, logService, workspaceContextService, terminalProfileService, remoteAgentService, terminalInstanceService) {
    super(
      {
        getDefaultSystemShell: async (remoteAuthority, platform) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!backend) {
            throw new ErrorNoTelemetry(`Cannot get default system shell when there is no backend for remote authority '${remoteAuthority}'`);
          }
          return backend.getDefaultSystemShell(platform);
        },
        getEnvironment: async (remoteAuthority) => {
          const backend = await terminalInstanceService.getBackend(remoteAuthority);
          if (!backend) {
            throw new ErrorNoTelemetry(`Cannot get environment when there is no backend for remote authority '${remoteAuthority}'`);
          }
          return backend.getEnvironment();
        }
      },
      configurationService,
      configurationResolverService,
      historyService,
      logService,
      terminalProfileService,
      workspaceContextService,
      remoteAgentService
    );
  }
};
ElectronTerminalProfileResolverService = __decorateClass([
  __decorateParam(0, IConfigurationResolverService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IHistoryService),
  __decorateParam(3, ITerminalLogService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, ITerminalProfileService),
  __decorateParam(6, IRemoteAgentService),
  __decorateParam(7, ITerminalInstanceService)
], ElectronTerminalProfileResolverService);
export {
  ElectronTerminalProfileResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9lbGVjdHJvbi1zYW5kYm94L3Rlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVycm9yTm9UZWxlbWV0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB9IGZyb20gJy4uL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgQmFzZVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uL2Jyb3dzZXIvdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgRWxlY3Ryb25UZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UgZXh0ZW5kcyBCYXNlVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSGlzdG9yeVNlcnZpY2UgaGlzdG9yeVNlcnZpY2U6IElIaXN0b3J5U2VydmljZSxcblx0XHRASVRlcm1pbmFsTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJVGVybWluYWxMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Ugd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgdGVybWluYWxQcm9maWxlU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxJbnN0YW5jZVNlcnZpY2UgdGVybWluYWxJbnN0YW5jZVNlcnZpY2U6IElUZXJtaW5hbEluc3RhbmNlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihcblx0XHRcdHtcblx0XHRcdFx0Z2V0RGVmYXVsdFN5c3RlbVNoZWxsOiBhc3luYyAocmVtb3RlQXV0aG9yaXR5LCBwbGF0Zm9ybSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGJhY2tlbmQgPSBhd2FpdCB0ZXJtaW5hbEluc3RhbmNlU2VydmljZS5nZXRCYWNrZW5kKHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdFx0aWYgKCFiYWNrZW5kKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3JOb1RlbGVtZXRyeShgQ2Fubm90IGdldCBkZWZhdWx0IHN5c3RlbSBzaGVsbCB3aGVuIHRoZXJlIGlzIG5vIGJhY2tlbmQgZm9yIHJlbW90ZSBhdXRob3JpdHkgJyR7cmVtb3RlQXV0aG9yaXR5fSdgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGJhY2tlbmQuZ2V0RGVmYXVsdFN5c3RlbVNoZWxsKHBsYXRmb3JtKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0RW52aXJvbm1lbnQ6IGFzeW5jIChyZW1vdGVBdXRob3JpdHkpID0+IHtcblx0XHRcdFx0XHRjb25zdCBiYWNrZW5kID0gYXdhaXQgdGVybWluYWxJbnN0YW5jZVNlcnZpY2UuZ2V0QmFja2VuZChyZW1vdGVBdXRob3JpdHkpO1xuXHRcdFx0XHRcdGlmICghYmFja2VuZCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yTm9UZWxlbWV0cnkoYENhbm5vdCBnZXQgZW52aXJvbm1lbnQgd2hlbiB0aGVyZSBpcyBubyBiYWNrZW5kIGZvciByZW1vdGUgYXV0aG9yaXR5ICcke3JlbW90ZUF1dGhvcml0eX0nYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBiYWNrZW5kLmdldEVudmlyb25tZW50KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0XHRoaXN0b3J5U2VydmljZSxcblx0XHRcdGxvZ1NlcnZpY2UsXG5cdFx0XHR0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLFxuXHRcdFx0d29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0XHRyZW1vdGVBZ2VudFNlcnZpY2Vcblx0XHQpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBRTdCLElBQU0seUNBQU4sY0FBcUQsbUNBQW1DO0FBQUEsRUFFOUYsWUFDZ0MsOEJBQ1Isc0JBQ04sZ0JBQ0ksWUFDSyx5QkFDRCx3QkFDSixvQkFDSyx5QkFDekI7QUFDRDtBQUFBLE1BQ0M7QUFBQSxRQUNDLHVCQUF1QixPQUFPLGlCQUFpQixhQUFhO0FBQzNELGdCQUFNLFVBQVUsTUFBTSx3QkFBd0IsV0FBVyxlQUFlO0FBQ3hFLGNBQUksQ0FBQyxTQUFTO0FBQ2Isa0JBQU0sSUFBSSxpQkFBaUIsa0ZBQWtGLGVBQWUsR0FBRztBQUFBLFVBQ2hJO0FBQ0EsaUJBQU8sUUFBUSxzQkFBc0IsUUFBUTtBQUFBLFFBQzlDO0FBQUEsUUFDQSxnQkFBZ0IsT0FBTyxvQkFBb0I7QUFDMUMsZ0JBQU0sVUFBVSxNQUFNLHdCQUF3QixXQUFXLGVBQWU7QUFDeEUsY0FBSSxDQUFDLFNBQVM7QUFDYixrQkFBTSxJQUFJLGlCQUFpQix5RUFBeUUsZUFBZSxHQUFHO0FBQUEsVUFDdkg7QUFDQSxpQkFBTyxRQUFRLGVBQWU7QUFBQSxRQUMvQjtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQXRDYSx5Q0FBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FWVTsiLAogICJuYW1lcyI6IFtdCn0K
