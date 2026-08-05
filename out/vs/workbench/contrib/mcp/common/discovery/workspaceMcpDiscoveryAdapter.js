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
import { DisposableMap } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { StorageScope } from "../../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { DiscoverySource } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { McpCollectionSortOrder } from "../mcpTypes.js";
import { FilesystemMcpDiscovery } from "./nativeMcpDiscoveryAbstract.js";
import { claudeConfigToServerDefinition } from "./nativeMcpDiscoveryAdapters.js";
let CursorWorkspaceMcpDiscoveryAdapter = class extends FilesystemMcpDiscovery {
  constructor(fileService, _workspaceContextService, mcpRegistry, configurationService, _remoteAgentService) {
    super(configurationService, fileService, mcpRegistry);
    this._workspaceContextService = _workspaceContextService;
    this._remoteAgentService = _remoteAgentService;
    this._collections = this._register(new DisposableMap());
  }
  start() {
    this._register(this._workspaceContextService.onDidChangeWorkspaceFolders((e) => {
      for (const removed of e.removed) {
        this._collections.deleteAndDispose(removed.uri.toString());
      }
      for (const added of e.added) {
        this.watchFolder(added);
      }
    }));
    for (const folder of this._workspaceContextService.getWorkspace().folders) {
      this.watchFolder(folder);
    }
  }
  watchFolder(folder) {
    const configFile = joinPath(folder.uri, ".cursor", "mcp.json");
    const collection = {
      id: `cursor-workspace.${folder.index}`,
      label: `${folder.name}/.cursor/mcp.json`,
      remoteAuthority: this._remoteAgentService.getConnection()?.remoteAuthority || null,
      scope: StorageScope.WORKSPACE,
      isTrustedByDefault: false,
      serverDefinitions: observableValue(this, []),
      presentation: {
        origin: configFile,
        order: McpCollectionSortOrder.WorkspaceFolder + 1
      }
    };
    this._collections.set(folder.uri.toString(), this.watchFile(
      URI.joinPath(folder.uri, ".cursor", "mcp.json"),
      collection,
      DiscoverySource.CursorWorkspace,
      (contents) => {
        const defs = claudeConfigToServerDefinition(collection.id, contents, folder.uri);
        defs?.forEach((d) => d.roots = [folder.uri]);
        return defs;
      }
    ));
  }
};
CursorWorkspaceMcpDiscoveryAdapter = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IMcpRegistry),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IRemoteAgentService)
], CursorWorkspaceMcpDiscoveryAdapter);
export {
  CursorWorkspaceMcpDiscoveryAdapter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS93b3Jrc3BhY2VNY3BEaXNjb3ZlcnlBZGFwdGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZU1hcCwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlzY292ZXJ5U291cmNlIH0gZnJvbSAnLi4vbWNwQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9tY3BSZWdpc3RyeVR5cGVzLmpzJztcbmltcG9ydCB7IE1jcENvbGxlY3Rpb25Tb3J0T3JkZXIgfSBmcm9tICcuLi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTWNwRGlzY292ZXJ5IH0gZnJvbSAnLi9tY3BEaXNjb3ZlcnkuanMnO1xuaW1wb3J0IHsgRmlsZXN5c3RlbU1jcERpc2NvdmVyeSwgV3JpdGFibGVNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbiB9IGZyb20gJy4vbmF0aXZlTWNwRGlzY292ZXJ5QWJzdHJhY3QuanMnO1xuaW1wb3J0IHsgY2xhdWRlQ29uZmlnVG9TZXJ2ZXJEZWZpbml0aW9uIH0gZnJvbSAnLi9uYXRpdmVNY3BEaXNjb3ZlcnlBZGFwdGVycy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBDdXJzb3JXb3Jrc3BhY2VNY3BEaXNjb3ZlcnlBZGFwdGVyIGV4dGVuZHMgRmlsZXN5c3RlbU1jcERpc2NvdmVyeSBpbXBsZW1lbnRzIElNY3BEaXNjb3Zlcnkge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb2xsZWN0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElNY3BSZWdpc3RyeSBtY3BSZWdpc3RyeTogSU1jcFJlZ2lzdHJ5LFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBmaWxlU2VydmljZSwgbWNwUmVnaXN0cnkpO1xuXHR9XG5cblx0c3RhcnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKGUgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCByZW1vdmVkIG9mIGUucmVtb3ZlZCkge1xuXHRcdFx0XHR0aGlzLl9jb2xsZWN0aW9ucy5kZWxldGVBbmREaXNwb3NlKHJlbW92ZWQudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBhZGRlZCBvZiBlLmFkZGVkKSB7XG5cdFx0XHRcdHRoaXMud2F0Y2hGb2xkZXIoYWRkZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMpIHtcblx0XHRcdHRoaXMud2F0Y2hGb2xkZXIoZm9sZGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHdhdGNoRm9sZGVyKGZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcikge1xuXHRcdGNvbnN0IGNvbmZpZ0ZpbGUgPSBqb2luUGF0aChmb2xkZXIudXJpLCAnLmN1cnNvcicsICdtY3AuanNvbicpO1xuXHRcdGNvbnN0IGNvbGxlY3Rpb246IFdyaXRhYmxlTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gPSB7XG5cdFx0XHRpZDogYGN1cnNvci13b3Jrc3BhY2UuJHtmb2xkZXIuaW5kZXh9YCxcblx0XHRcdGxhYmVsOiBgJHtmb2xkZXIubmFtZX0vLmN1cnNvci9tY3AuanNvbmAsXG5cdFx0XHRyZW1vdGVBdXRob3JpdHk6IHRoaXMuX3JlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk/LnJlbW90ZUF1dGhvcml0eSB8fCBudWxsLFxuXHRcdFx0c2NvcGU6IFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsXG5cdFx0XHRpc1RydXN0ZWRCeURlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0c2VydmVyRGVmaW5pdGlvbnM6IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBbXSksXG5cdFx0XHRwcmVzZW50YXRpb246IHtcblx0XHRcdFx0b3JpZ2luOiBjb25maWdGaWxlLFxuXHRcdFx0XHRvcmRlcjogTWNwQ29sbGVjdGlvblNvcnRPcmRlci5Xb3Jrc3BhY2VGb2xkZXIgKyAxLFxuXHRcdFx0fSxcblx0XHR9O1xuXG5cdFx0dGhpcy5fY29sbGVjdGlvbnMuc2V0KGZvbGRlci51cmkudG9TdHJpbmcoKSwgdGhpcy53YXRjaEZpbGUoXG5cdFx0XHRVUkkuam9pblBhdGgoZm9sZGVyLnVyaSwgJy5jdXJzb3InLCAnbWNwLmpzb24nKSxcblx0XHRcdGNvbGxlY3Rpb24sXG5cdFx0XHREaXNjb3ZlcnlTb3VyY2UuQ3Vyc29yV29ya3NwYWNlLFxuXHRcdFx0Y29udGVudHMgPT4ge1xuXHRcdFx0XHRjb25zdCBkZWZzID0gY2xhdWRlQ29uZmlnVG9TZXJ2ZXJEZWZpbml0aW9uKGNvbGxlY3Rpb24uaWQsIGNvbnRlbnRzLCBmb2xkZXIudXJpKTtcblx0XHRcdFx0ZGVmcz8uZm9yRWFjaChkID0+IGQucm9vdHMgPSBbZm9sZGVyLnVyaV0pO1xuXHRcdFx0XHRyZXR1cm4gZGVmcztcblx0XHRcdH1cblx0XHQpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHFCQUFrQztBQUMzQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQ0FBa0Q7QUFDM0QsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw4QkFBOEI7QUFFdkMsU0FBUyw4QkFBK0Q7QUFDeEUsU0FBUyxzQ0FBc0M7QUFFeEMsSUFBTSxxQ0FBTixjQUFpRCx1QkFBZ0Q7QUFBQSxFQUd2RyxZQUNlLGFBQzZCLDBCQUM3QixhQUNTLHNCQUNlLHFCQUNyQztBQUNELFVBQU0sc0JBQXNCLGFBQWEsV0FBVztBQUxUO0FBR0w7QUFQdkMsU0FBaUIsZUFBZSxLQUFLLFVBQVUsSUFBSSxjQUFtQyxDQUFDO0FBQUEsRUFVdkY7QUFBQSxFQUVBLFFBQWM7QUFDYixTQUFLLFVBQVUsS0FBSyx5QkFBeUIsNEJBQTRCLE9BQUs7QUFDN0UsaUJBQVcsV0FBVyxFQUFFLFNBQVM7QUFDaEMsYUFBSyxhQUFhLGlCQUFpQixRQUFRLElBQUksU0FBUyxDQUFDO0FBQUEsTUFDMUQ7QUFDQSxpQkFBVyxTQUFTLEVBQUUsT0FBTztBQUM1QixhQUFLLFlBQVksS0FBSztBQUFBLE1BQ3ZCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixlQUFXLFVBQVUsS0FBSyx5QkFBeUIsYUFBYSxFQUFFLFNBQVM7QUFDMUUsV0FBSyxZQUFZLE1BQU07QUFBQSxJQUN4QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLFlBQVksUUFBMEI7QUFDN0MsVUFBTSxhQUFhLFNBQVMsT0FBTyxLQUFLLFdBQVcsVUFBVTtBQUM3RCxVQUFNLGFBQThDO0FBQUEsTUFDbkQsSUFBSSxvQkFBb0IsT0FBTyxLQUFLO0FBQUEsTUFDcEMsT0FBTyxHQUFHLE9BQU8sSUFBSTtBQUFBLE1BQ3JCLGlCQUFpQixLQUFLLG9CQUFvQixjQUFjLEdBQUcsbUJBQW1CO0FBQUEsTUFDOUUsT0FBTyxhQUFhO0FBQUEsTUFDcEIsb0JBQW9CO0FBQUEsTUFDcEIsbUJBQW1CLGdCQUFnQixNQUFNLENBQUMsQ0FBQztBQUFBLE1BQzNDLGNBQWM7QUFBQSxRQUNiLFFBQVE7QUFBQSxRQUNSLE9BQU8sdUJBQXVCLGtCQUFrQjtBQUFBLE1BQ2pEO0FBQUEsSUFDRDtBQUVBLFNBQUssYUFBYSxJQUFJLE9BQU8sSUFBSSxTQUFTLEdBQUcsS0FBSztBQUFBLE1BQ2pELElBQUksU0FBUyxPQUFPLEtBQUssV0FBVyxVQUFVO0FBQUEsTUFDOUM7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLE1BQ2hCLGNBQVk7QUFDWCxjQUFNLE9BQU8sK0JBQStCLFdBQVcsSUFBSSxVQUFVLE9BQU8sR0FBRztBQUMvRSxjQUFNLFFBQVEsT0FBSyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEdBQUcsQ0FBQztBQUN6QyxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQXREYSxxQ0FBTjtBQUFBLEVBSUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FSVTsiLAogICJuYW1lcyI6IFtdCn0K
