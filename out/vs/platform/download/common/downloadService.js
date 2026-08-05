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
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Schemas } from "../../../base/common/network.js";
import { IFileService } from "../../files/common/files.js";
import { asTextOrError, IRequestService } from "../../request/common/request.js";
let DownloadService = class {
  constructor(requestService, fileService) {
    this.requestService = requestService;
    this.fileService = fileService;
  }
  async download(resource, target, cancellationToken = CancellationToken.None) {
    if (resource.scheme === Schemas.file || resource.scheme === Schemas.vscodeRemote) {
      await this.fileService.copy(resource, target);
      return;
    }
    const options = { type: "GET", url: resource.toString(true) };
    const context = await this.requestService.request(options, cancellationToken);
    if (context.res.statusCode === 200) {
      await this.fileService.writeFile(target, context.stream);
    } else {
      const message = await asTextOrError(context);
      throw new Error(`Expected 200, got back ${context.res.statusCode} instead.

${message}`);
    }
  }
};
DownloadService = __decorateClass([
  __decorateParam(0, IRequestService),
  __decorateParam(1, IFileService)
], DownloadService);
export {
  DownloadService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9kb3dubG9hZC9jb21tb24vZG93bmxvYWRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElEb3dubG9hZFNlcnZpY2UgfSBmcm9tICcuL2Rvd25sb2FkLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBhc1RleHRPckVycm9yLCBJUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcblxuZXhwb3J0IGNsYXNzIERvd25sb2FkU2VydmljZSBpbXBsZW1lbnRzIElEb3dubG9hZFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZXF1ZXN0U2VydmljZTogSVJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgZG93bmxvYWQocmVzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAocmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgfHwgcmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXHRcdFx0Ly8gSW50ZW50aW9uYWxseSBvbmx5IHN1cHBvcnQgdGhpcyBmb3IgZmlsZXxyZW1vdGU8LT5maWxlfHJlbW90ZSBzY2VuYXJpb3Ncblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuY29weShyZXNvdXJjZSwgdGFyZ2V0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHsgdHlwZTogJ0dFVCcsIHVybDogcmVzb3VyY2UudG9TdHJpbmcodHJ1ZSkgfTtcblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KG9wdGlvbnMsIGNhbmNlbGxhdGlvblRva2VuKTtcblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0YXJnZXQsIGNvbnRleHQuc3RyZWFtKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGF3YWl0IGFzVGV4dE9yRXJyb3IoY29udGV4dCk7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIDIwMCwgZ290IGJhY2sgJHtjb250ZXh0LnJlcy5zdGF0dXNDb2RlfSBpbnN0ZWFkLlxcblxcbiR7bWVzc2FnZX1gKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBR3hCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZSx1QkFBdUI7QUFFeEMsSUFBTSxrQkFBTixNQUFrRDtBQUFBLEVBSXhELFlBQ21DLGdCQUNILGFBQzlCO0FBRmlDO0FBQ0g7QUFBQSxFQUM1QjtBQUFBLEVBRUosTUFBTSxTQUFTLFVBQWUsUUFBYSxvQkFBdUMsa0JBQWtCLE1BQXFCO0FBQ3hILFFBQUksU0FBUyxXQUFXLFFBQVEsUUFBUSxTQUFTLFdBQVcsUUFBUSxjQUFjO0FBRWpGLFlBQU0sS0FBSyxZQUFZLEtBQUssVUFBVSxNQUFNO0FBQzVDO0FBQUEsSUFDRDtBQUNBLFVBQU0sVUFBVSxFQUFFLE1BQU0sT0FBTyxLQUFLLFNBQVMsU0FBUyxJQUFJLEVBQUU7QUFDNUQsVUFBTSxVQUFVLE1BQU0sS0FBSyxlQUFlLFFBQVEsU0FBUyxpQkFBaUI7QUFDNUUsUUFBSSxRQUFRLElBQUksZUFBZSxLQUFLO0FBQ25DLFlBQU0sS0FBSyxZQUFZLFVBQVUsUUFBUSxRQUFRLE1BQU07QUFBQSxJQUN4RCxPQUFPO0FBQ04sWUFBTSxVQUFVLE1BQU0sY0FBYyxPQUFPO0FBQzNDLFlBQU0sSUFBSSxNQUFNLDBCQUEwQixRQUFRLElBQUksVUFBVTtBQUFBO0FBQUEsRUFBZ0IsT0FBTyxFQUFFO0FBQUEsSUFDMUY7QUFBQSxFQUNEO0FBQ0Q7QUF4QmEsa0JBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
