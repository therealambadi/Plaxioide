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
import { INativeWorkbenchEnvironmentService } from "../../environment/electron-sandbox/environmentService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IConfigurationResolverService } from "../common/configurationResolver.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { BaseConfigurationResolverService } from "../browser/baseConfigurationResolverService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IShellEnvironmentService } from "../../environment/electron-sandbox/shellEnvironmentService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let ConfigurationResolverService = class extends BaseConfigurationResolverService {
  constructor(editorService, environmentService, configurationService, commandService, workspaceContextService, quickInputService, labelService, shellEnvironmentService, pathService, extensionService, storageService) {
    super(
      {
        getAppRoot: () => {
          return environmentService.appRoot;
        },
        getExecPath: () => {
          return environmentService.execPath;
        }
      },
      shellEnvironmentService.getShellEnv(),
      editorService,
      configurationService,
      commandService,
      workspaceContextService,
      quickInputService,
      labelService,
      pathService,
      extensionService,
      storageService
    );
  }
};
ConfigurationResolverService = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, INativeWorkbenchEnvironmentService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IShellEnvironmentService),
  __decorateParam(8, IPathService),
  __decorateParam(9, IExtensionService),
  __decorateParam(10, IStorageService)
], ConfigurationResolverService);
registerSingleton(IConfigurationResolverService, ConfigurationResolverService, InstantiationType.Delayed);
export {
  ConfigurationResolverService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2VsZWN0cm9uLXNhbmRib3gvY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9lbGVjdHJvbi1zYW5kYm94L2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEJhc2VDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vYnJvd3Nlci9iYXNlQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElTaGVsbEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2VsZWN0cm9uLXNhbmRib3gvc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhdGhTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGF0aC9jb21tb24vcGF0aFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSBleHRlbmRzIEJhc2VDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElTaGVsbEVudmlyb25tZW50U2VydmljZSBzaGVsbEVudmlyb25tZW50U2VydmljZTogSVNoZWxsRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJUGF0aFNlcnZpY2UgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRnZXRBcHBSb290OiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0cmV0dXJuIGVudmlyb25tZW50U2VydmljZS5hcHBSb290O1xuXHRcdFx0fSxcblx0XHRcdGdldEV4ZWNQYXRoOiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0cmV0dXJuIGVudmlyb25tZW50U2VydmljZS5leGVjUGF0aDtcblx0XHRcdH0sXG5cdFx0fSwgc2hlbGxFbnZpcm9ubWVudFNlcnZpY2UuZ2V0U2hlbGxFbnYoKSwgZWRpdG9yU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0d29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIHF1aWNrSW5wdXRTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHBhdGhTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsIENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFFekIsSUFBTSwrQkFBTixjQUEyQyxpQ0FBaUM7QUFBQSxFQUVsRixZQUNpQixlQUNvQixvQkFDYixzQkFDTixnQkFDUyx5QkFDTixtQkFDTCxjQUNXLHlCQUNaLGFBQ0ssa0JBQ0YsZ0JBQ2hCO0FBQ0Q7QUFBQSxNQUFNO0FBQUEsUUFDTCxZQUFZLE1BQTBCO0FBQ3JDLGlCQUFPLG1CQUFtQjtBQUFBLFFBQzNCO0FBQUEsUUFDQSxhQUFhLE1BQTBCO0FBQ3RDLGlCQUFPLG1CQUFtQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQUcsd0JBQXdCLFlBQVk7QUFBQSxNQUFHO0FBQUEsTUFBZTtBQUFBLE1BQXNCO0FBQUEsTUFDOUU7QUFBQSxNQUF5QjtBQUFBLE1BQW1CO0FBQUEsTUFBYztBQUFBLE1BQWE7QUFBQSxNQUFrQjtBQUFBLElBQWM7QUFBQSxFQUN6RztBQUNEO0FBekJhLCtCQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWJVO0FBMkJiLGtCQUFrQiwrQkFBK0IsOEJBQThCLGtCQUFrQixPQUFPOyIsCiAgIm5hbWVzIjogW10KfQo=
