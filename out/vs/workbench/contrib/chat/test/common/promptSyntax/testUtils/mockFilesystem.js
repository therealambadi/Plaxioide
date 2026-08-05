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
import { URI } from "../../../../../../../base/common/uri.js";
import { assert } from "../../../../../../../base/common/assert.js";
import { VSBuffer } from "../../../../../../../base/common/buffer.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
let MockFilesystem = class {
  constructor(folders, fileService) {
    this.folders = folders;
    this.fileService = fileService;
  }
  /**
   * Starts the mock process.
   */
  async mock() {
    return await Promise.all(
      this.folders.map((folder) => {
        return this.mockFolder(folder);
      })
    );
  }
  /**
   * The internal implementation of the filesystem mocking process.
   *
   * @throws If a folder or file in the filesystem structure already exists.
   * 		   This is to prevent subtle errors caused by overwriting existing files.
   */
  async mockFolder(folder, parentFolder) {
    const folderUri = parentFolder ? URI.joinPath(parentFolder, folder.name) : URI.file(folder.name);
    assert(
      !await this.fileService.exists(folderUri),
      `Folder '${folderUri.path}' already exists.`
    );
    try {
      await this.fileService.createFolder(folderUri);
    } catch (error) {
      throw new Error(`Failed to create folder '${folderUri.fsPath}': ${error}.`);
    }
    const resolvedChildren = [];
    for (const child of folder.children) {
      const childUri = URI.joinPath(folderUri, child.name);
      if ("contents" in child) {
        assert(
          !await this.fileService.exists(childUri),
          `File '${folderUri.path}' already exists.`
        );
        await this.fileService.writeFile(childUri, VSBuffer.fromString(child.contents));
        resolvedChildren.push({
          ...child,
          uri: childUri
        });
        continue;
      }
      resolvedChildren.push(await this.mockFolder(child, folderUri));
    }
    return {
      ...folder,
      uri: folderUri
    };
  }
};
MockFilesystem = __decorateClass([
  __decorateParam(1, IFileService)
], MockFilesystem);
export {
  MockFilesystem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC90ZXN0VXRpbHMvbW9ja0ZpbGVzeXN0ZW0udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGdlbmVyaWMgZmlsZSBzeXN0ZW0gbm9kZS5cbiAqL1xuaW50ZXJmYWNlIElNb2NrRmlsZXN5c3RlbU5vZGUge1xuXHRuYW1lOiBzdHJpbmc7XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGBmaWxlYCBub2RlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElNb2NrRmlsZSBleHRlbmRzIElNb2NrRmlsZXN5c3RlbU5vZGUge1xuXHRjb250ZW50czogc3RyaW5nO1xufVxuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBgZm9sZGVyYCBub2RlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElNb2NrRm9sZGVyIGV4dGVuZHMgSU1vY2tGaWxlc3lzdGVtTm9kZSB7XG5cdGNoaWxkcmVuOiAoSU1vY2tGb2xkZXIgfCBJTW9ja0ZpbGUpW107XG59XG5cbi8qKlxuICogVHlwZSBmb3IgYSBtb2NrZWQgZmlsZSBvciBhIGZvbGRlciB0aGF0IGhhcyBhYnNvbHV0ZSBwYXRoIFVSSS5cbiAqL1xudHlwZSBUV2l0aFVSSTxUIGV4dGVuZHMgSU1vY2tGaWxlc3lzdGVtTm9kZT4gPSBUICYgeyB1cmk6IFVSSSB9O1xuXG4vKipcbiAqIFV0aWxpdHkgdG8gcmVjdXJzaXZlbHkgY3JlYXRlcyBwcm92aWRlZCBmaWxlc3lzdGVtIHN0cnVjdHVyZS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1vY2tGaWxlc3lzdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmb2xkZXJzOiBJTW9ja0ZvbGRlcltdLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdC8qKlxuXHQgKiBTdGFydHMgdGhlIG1vY2sgcHJvY2Vzcy5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBtb2NrKCk6IFByb21pc2U8VFdpdGhVUkk8SU1vY2tGb2xkZXI+W10+IHtcblx0XHRyZXR1cm4gYXdhaXQgUHJvbWlzZS5hbGwoXG5cdFx0XHR0aGlzLmZvbGRlcnNcblx0XHRcdFx0Lm1hcCgoZm9sZGVyKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMubW9ja0ZvbGRlcihmb2xkZXIpO1xuXHRcdFx0XHR9KSxcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBpbnRlcm5hbCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgZmlsZXN5c3RlbSBtb2NraW5nIHByb2Nlc3MuXG5cdCAqXG5cdCAqIEB0aHJvd3MgSWYgYSBmb2xkZXIgb3IgZmlsZSBpbiB0aGUgZmlsZXN5c3RlbSBzdHJ1Y3R1cmUgYWxyZWFkeSBleGlzdHMuXG5cdCAqIFx0XHQgICBUaGlzIGlzIHRvIHByZXZlbnQgc3VidGxlIGVycm9ycyBjYXVzZWQgYnkgb3ZlcndyaXRpbmcgZXhpc3RpbmcgZmlsZXMuXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIG1vY2tGb2xkZXIoXG5cdFx0Zm9sZGVyOiBJTW9ja0ZvbGRlcixcblx0XHRwYXJlbnRGb2xkZXI/OiBVUkksXG5cdCk6IFByb21pc2U8VFdpdGhVUkk8SU1vY2tGb2xkZXI+PiB7XG5cdFx0Y29uc3QgZm9sZGVyVXJpID0gcGFyZW50Rm9sZGVyXG5cdFx0XHQ/IFVSSS5qb2luUGF0aChwYXJlbnRGb2xkZXIsIGZvbGRlci5uYW1lKVxuXHRcdFx0OiBVUkkuZmlsZShmb2xkZXIubmFtZSk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHQhKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKGZvbGRlclVyaSkpLFxuXHRcdFx0YEZvbGRlciAnJHtmb2xkZXJVcmkucGF0aH0nIGFscmVhZHkgZXhpc3RzLmAsXG5cdFx0KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihmb2xkZXJVcmkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgZm9sZGVyICcke2ZvbGRlclVyaS5mc1BhdGh9JzogJHtlcnJvcn0uYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRDaGlsZHJlbjogKFRXaXRoVVJJPElNb2NrRm9sZGVyPiB8IFRXaXRoVVJJPElNb2NrRmlsZT4pW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIGZvbGRlci5jaGlsZHJlbikge1xuXHRcdFx0Y29uc3QgY2hpbGRVcmkgPSBVUkkuam9pblBhdGgoZm9sZGVyVXJpLCBjaGlsZC5uYW1lKTtcblx0XHRcdC8vIGNyZWF0ZSBjaGlsZCBmaWxlXG5cdFx0XHRpZiAoJ2NvbnRlbnRzJyBpbiBjaGlsZCkge1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0IShhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhjaGlsZFVyaSkpLFxuXHRcdFx0XHRcdGBGaWxlICcke2ZvbGRlclVyaS5wYXRofScgYWxyZWFkeSBleGlzdHMuYCxcblx0XHRcdFx0KTtcblxuXHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShjaGlsZFVyaSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjaGlsZC5jb250ZW50cykpO1xuXG5cdFx0XHRcdHJlc29sdmVkQ2hpbGRyZW4ucHVzaCh7XG5cdFx0XHRcdFx0Li4uY2hpbGQsXG5cdFx0XHRcdFx0dXJpOiBjaGlsZFVyaSxcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlY3Vyc2l2ZWx5IGNyZWF0ZSBjaGlsZCBmaWxlc3lzdGVtIHN0cnVjdHVyZVxuXHRcdFx0cmVzb2x2ZWRDaGlsZHJlbi5wdXNoKGF3YWl0IHRoaXMubW9ja0ZvbGRlcihjaGlsZCwgZm9sZGVyVXJpKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLmZvbGRlcixcblx0XHRcdHVyaTogZm9sZGVyVXJpLFxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsY0FBYztBQUN2QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG9CQUFvQjtBQStCdEIsSUFBTSxpQkFBTixNQUFxQjtBQUFBLEVBQzNCLFlBQ2tCLFNBQ2MsYUFDOUI7QUFGZ0I7QUFDYztBQUFBLEVBQzVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLSixNQUFhLE9BQXlDO0FBQ3JELFdBQU8sTUFBTSxRQUFRO0FBQUEsTUFDcEIsS0FBSyxRQUNILElBQUksQ0FBQyxXQUFXO0FBQ2hCLGVBQU8sS0FBSyxXQUFXLE1BQU07QUFBQSxNQUM5QixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFBLE1BQWMsV0FDYixRQUNBLGNBQ2lDO0FBQ2pDLFVBQU0sWUFBWSxlQUNmLElBQUksU0FBUyxjQUFjLE9BQU8sSUFBSSxJQUN0QyxJQUFJLEtBQUssT0FBTyxJQUFJO0FBRXZCO0FBQUEsTUFDQyxDQUFFLE1BQU0sS0FBSyxZQUFZLE9BQU8sU0FBUztBQUFBLE1BQ3pDLFdBQVcsVUFBVSxJQUFJO0FBQUEsSUFDMUI7QUFFQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLFlBQVksYUFBYSxTQUFTO0FBQUEsSUFDOUMsU0FBUyxPQUFPO0FBQ2YsWUFBTSxJQUFJLE1BQU0sNEJBQTRCLFVBQVUsTUFBTSxNQUFNLEtBQUssR0FBRztBQUFBLElBQzNFO0FBRUEsVUFBTSxtQkFBb0UsQ0FBQztBQUMzRSxlQUFXLFNBQVMsT0FBTyxVQUFVO0FBQ3BDLFlBQU0sV0FBVyxJQUFJLFNBQVMsV0FBVyxNQUFNLElBQUk7QUFFbkQsVUFBSSxjQUFjLE9BQU87QUFDeEI7QUFBQSxVQUNDLENBQUUsTUFBTSxLQUFLLFlBQVksT0FBTyxRQUFRO0FBQUEsVUFDeEMsU0FBUyxVQUFVLElBQUk7QUFBQSxRQUN4QjtBQUVBLGNBQU0sS0FBSyxZQUFZLFVBQVUsVUFBVSxTQUFTLFdBQVcsTUFBTSxRQUFRLENBQUM7QUFFOUUseUJBQWlCLEtBQUs7QUFBQSxVQUNyQixHQUFHO0FBQUEsVUFDSCxLQUFLO0FBQUEsUUFDTixDQUFDO0FBRUQ7QUFBQSxNQUNEO0FBR0EsdUJBQWlCLEtBQUssTUFBTSxLQUFLLFdBQVcsT0FBTyxTQUFTLENBQUM7QUFBQSxJQUM5RDtBQUVBLFdBQU87QUFBQSxNQUNOLEdBQUc7QUFBQSxNQUNILEtBQUs7QUFBQSxJQUNOO0FBQUEsRUFDRDtBQUNEO0FBeEVhLGlCQUFOO0FBQUEsRUFHSjtBQUFBLEdBSFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
