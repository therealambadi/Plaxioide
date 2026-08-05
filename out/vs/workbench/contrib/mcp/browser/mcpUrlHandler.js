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
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { InMemoryFileSystemProvider } from "../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IURLService } from "../../../../platform/url/common/url.js";
import { McpAddConfigurationCommand } from "./mcpCommandsAddConfiguration.js";
const providerScheme = "mcp-install";
let McpUrlHandler = class extends Disposable {
  constructor(urlService, _instaService, _fileService) {
    super();
    this._instaService = _instaService;
    this._fileService = _fileService;
    this._fileSystemProvider = new Lazy(() => {
      return this._instaService.invokeFunction((accessor) => {
        const fileService = accessor.get(IFileService);
        const filesystem = new InMemoryFileSystemProvider();
        this._register(fileService.registerProvider(providerScheme, filesystem));
        return providerScheme;
      });
    });
    this._register(urlService.registerHandler(this));
  }
  async handleURL(uri, options) {
    if (uri.path !== "mcp/install") {
      return false;
    }
    let parsed;
    try {
      parsed = JSON.parse(decodeURIComponent(uri.query));
    } catch (e) {
      return false;
    }
    const { name, ...rest } = parsed;
    const scheme = this._fileSystemProvider.value;
    const fileUri = URI.from({ scheme, path: `/${encodeURIComponent(name)}.json` });
    await this._fileService.writeFile(
      fileUri,
      VSBuffer.fromString(JSON.stringify(rest, null, "	"))
    );
    const addConfigHelper = this._instaService.createInstance(McpAddConfigurationCommand, void 0);
    addConfigHelper.pickForUrlHandler(fileUri, true);
    return Promise.resolve(true);
  }
};
McpUrlHandler.scheme = providerScheme;
McpUrlHandler = __decorateClass([
  __decorateParam(0, IURLService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IFileService)
], McpUrlHandler);
export {
  McpUrlHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BVcmxIYW5kbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2luTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgTWNwQ29uZmlndXJhdGlvblNlcnZlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21jcC9jb21tb24vbWNwUGxhdGZvcm1UeXBlcy5qcyc7XG5pbXBvcnQgeyBJT3BlblVSTE9wdGlvbnMsIElVUkxIYW5kbGVyLCBJVVJMU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VybC9jb21tb24vdXJsLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBNY3BBZGRDb25maWd1cmF0aW9uQ29tbWFuZCB9IGZyb20gJy4vbWNwQ29tbWFuZHNBZGRDb25maWd1cmF0aW9uLmpzJztcblxuY29uc3QgcHJvdmlkZXJTY2hlbWUgPSAnbWNwLWluc3RhbGwnO1xuXG5leHBvcnQgY2xhc3MgTWNwVXJsSGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJVVJMSGFuZGxlciB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgc2NoZW1lID0gcHJvdmlkZXJTY2hlbWU7XG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9maWxlU3lzdGVtUHJvdmlkZXIgPSBuZXcgTGF6eSgoKSA9PiB7XG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmlsZXN5c3RlbSA9IG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihwcm92aWRlclNjaGVtZSwgZmlsZXN5c3RlbSkpO1xuXHRcdFx0cmV0dXJuIHByb3ZpZGVyU2NoZW1lO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVSTFNlcnZpY2UgdXJsU2VydmljZTogSVVSTFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodXJsU2VydmljZS5yZWdpc3RlckhhbmRsZXIodGhpcykpO1xuXHR9XG5cblx0YXN5bmMgaGFuZGxlVVJMKHVyaTogVVJJLCBvcHRpb25zPzogSU9wZW5VUkxPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHVyaS5wYXRoICE9PSAnbWNwL2luc3RhbGwnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IHBhcnNlZDogTWNwQ29uZmlndXJhdGlvblNlcnZlciAmIHsgbmFtZTogc3RyaW5nIH07XG5cdFx0dHJ5IHtcblx0XHRcdHBhcnNlZCA9IEpTT04ucGFyc2UoZGVjb2RlVVJJQ29tcG9uZW50KHVyaS5xdWVyeSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB7IG5hbWUsIC4uLnJlc3QgfSA9IHBhcnNlZDtcblxuXHRcdGNvbnN0IHNjaGVtZSA9IHRoaXMuX2ZpbGVTeXN0ZW1Qcm92aWRlci52YWx1ZTtcblx0XHRjb25zdCBmaWxlVXJpID0gVVJJLmZyb20oeyBzY2hlbWUsIHBhdGg6IGAvJHtlbmNvZGVVUklDb21wb25lbnQobmFtZSl9Lmpzb25gIH0pO1xuXG5cdFx0YXdhaXQgdGhpcy5fZmlsZVNlcnZpY2Uud3JpdGVGaWxlKFxuXHRcdFx0ZmlsZVVyaSxcblx0XHRcdFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkocmVzdCwgbnVsbCwgJ1xcdCcpKSxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWRkQ29uZmlnSGVscGVyID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1jcEFkZENvbmZpZ3VyYXRpb25Db21tYW5kLCB1bmRlZmluZWQpO1xuXHRcdGFkZENvbmZpZ0hlbHBlci5waWNrRm9yVXJsSGFuZGxlcihmaWxlVXJpLCB0cnVlKTtcblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDZCQUE2QjtBQUV0QyxTQUF1QyxtQkFBbUI7QUFFMUQsU0FBUyxrQ0FBa0M7QUFFM0MsTUFBTSxpQkFBaUI7QUFFaEIsSUFBTSxnQkFBTixjQUE0QixXQUEwRDtBQUFBLEVBYTVGLFlBQ2MsWUFDMkIsZUFDVCxjQUM5QjtBQUNELFVBQU07QUFIa0M7QUFDVDtBQVpoQyxTQUFpQixzQkFBc0IsSUFBSSxLQUFLLE1BQU07QUFDckQsYUFBTyxLQUFLLGNBQWMsZUFBZSxjQUFZO0FBQ3BELGNBQU0sY0FBYyxTQUFTLElBQUksWUFBWTtBQUM3QyxjQUFNLGFBQWEsSUFBSSwyQkFBMkI7QUFDbEQsYUFBSyxVQUFVLFlBQVksaUJBQWlCLGdCQUFnQixVQUFVLENBQUM7QUFDdkUsZUFBTztBQUFBLE1BQ1IsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQVFBLFNBQUssVUFBVSxXQUFXLGdCQUFnQixJQUFJLENBQUM7QUFBQSxFQUNoRDtBQUFBLEVBRUEsTUFBTSxVQUFVLEtBQVUsU0FBNkM7QUFDdEUsUUFBSSxJQUFJLFNBQVMsZUFBZTtBQUMvQixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUk7QUFDSixRQUFJO0FBQ0gsZUFBUyxLQUFLLE1BQU0sbUJBQW1CLElBQUksS0FBSyxDQUFDO0FBQUEsSUFDbEQsU0FBUyxHQUFHO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLEVBQUUsTUFBTSxHQUFHLEtBQUssSUFBSTtBQUUxQixVQUFNLFNBQVMsS0FBSyxvQkFBb0I7QUFDeEMsVUFBTSxVQUFVLElBQUksS0FBSyxFQUFFLFFBQVEsTUFBTSxJQUFJLG1CQUFtQixJQUFJLENBQUMsUUFBUSxDQUFDO0FBRTlFLFVBQU0sS0FBSyxhQUFhO0FBQUEsTUFDdkI7QUFBQSxNQUNBLFNBQVMsV0FBVyxLQUFLLFVBQVUsTUFBTSxNQUFNLEdBQUksQ0FBQztBQUFBLElBQ3JEO0FBRUEsVUFBTSxrQkFBa0IsS0FBSyxjQUFjLGVBQWUsNEJBQTRCLE1BQVM7QUFDL0Ysb0JBQWdCLGtCQUFrQixTQUFTLElBQUk7QUFFL0MsV0FBTyxRQUFRLFFBQVEsSUFBSTtBQUFBLEVBQzVCO0FBQ0Q7QUFqRGEsY0FDVyxTQUFTO0FBRHBCLGdCQUFOO0FBQUEsRUFjSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FoQlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
