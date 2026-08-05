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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { getMediaOrTextMime } from "../../../../base/common/mime.js";
import { URI } from "../../../../base/common/uri.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
let BrowserRemoteResourceLoader = class extends Disposable {
  constructor(fileService, provider) {
    super();
    this.provider = provider;
    this._register(provider.onDidReceiveRequest(async (request) => {
      let uri;
      try {
        uri = JSON.parse(decodeURIComponent(request.uri.query));
      } catch {
        return request.respondWith(404, new Uint8Array(), {});
      }
      let content;
      try {
        content = await fileService.readFile(URI.from(uri, true));
      } catch (e) {
        const str = VSBuffer.fromString(e.message).buffer;
        if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
          return request.respondWith(404, str, {});
        } else {
          return request.respondWith(500, str, {});
        }
      }
      const mime = uri.path && getMediaOrTextMime(uri.path);
      request.respondWith(200, content.value.buffer, mime ? { "content-type": mime } : {});
    }));
  }
  getResourceUriProvider() {
    const baseUri = URI.parse(document.location.href);
    return (uri) => baseUri.with({
      path: this.provider.path,
      query: JSON.stringify(uri)
    });
  }
};
BrowserRemoteResourceLoader = __decorateClass([
  __decorateParam(0, IFileService)
], BrowserRemoteResourceLoader);
export {
  BrowserRemoteResourceLoader
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcmVtb3RlL2Jyb3dzZXIvYnJvd3NlclJlbW90ZVJlc291cmNlSGFuZGxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2V0TWVkaWFPclRleHRNaW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBJRmlsZUNvbnRlbnQsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlUmVzb3VyY2VQcm92aWRlciwgSVJlc291cmNlVXJpUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3dlYi5hcGkuanMnO1xuXG5leHBvcnQgY2xhc3MgQnJvd3NlclJlbW90ZVJlc291cmNlTG9hZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3ZpZGVyOiBJUmVtb3RlUmVzb3VyY2VQcm92aWRlcixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHByb3ZpZGVyLm9uRGlkUmVjZWl2ZVJlcXVlc3QoYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRsZXQgdXJpOiBVcmlDb21wb25lbnRzO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dXJpID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQocmVxdWVzdC51cmkucXVlcnkpKTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5yZXNwb25kV2l0aCg0MDQsIG5ldyBVaW50OEFycmF5KCksIHt9KTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGNvbnRlbnQ6IElGaWxlQ29udGVudDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnRlbnQgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShVUkkuZnJvbSh1cmksIHRydWUpKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29uc3Qgc3RyID0gVlNCdWZmZXIuZnJvbVN0cmluZyhlLm1lc3NhZ2UpLmJ1ZmZlcjtcblx0XHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBGaWxlT3BlcmF0aW9uRXJyb3IgJiYgZS5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlcXVlc3QucmVzcG9uZFdpdGgoNDA0LCBzdHIsIHt9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5yZXNwb25kV2l0aCg1MDAsIHN0ciwge30pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1pbWUgPSB1cmkucGF0aCAmJiBnZXRNZWRpYU9yVGV4dE1pbWUodXJpLnBhdGgpO1xuXHRcdFx0cmVxdWVzdC5yZXNwb25kV2l0aCgyMDAsIGNvbnRlbnQudmFsdWUuYnVmZmVyLCBtaW1lID8geyAnY29udGVudC10eXBlJzogbWltZSB9IDoge30pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRSZXNvdXJjZVVyaVByb3ZpZGVyKCk6IElSZXNvdXJjZVVyaVByb3ZpZGVyIHtcblx0XHRjb25zdCBiYXNlVXJpID0gVVJJLnBhcnNlKGRvY3VtZW50LmxvY2F0aW9uLmhyZWYpO1xuXHRcdHJldHVybiB1cmkgPT4gYmFzZVVyaS53aXRoKHtcblx0XHRcdHBhdGg6IHRoaXMucHJvdmlkZXIucGF0aCxcblx0XHRcdHF1ZXJ5OiBKU09OLnN0cmluZ2lmeSh1cmkpLFxuXHRcdH0pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsV0FBMEI7QUFDbkMsU0FBUyxvQkFBb0IscUJBQW1DLG9CQUFvQjtBQUc3RSxJQUFNLDhCQUFOLGNBQTBDLFdBQVc7QUFBQSxFQUMzRCxZQUNlLGFBQ0csVUFDaEI7QUFDRCxVQUFNO0FBRlc7QUFJakIsU0FBSyxVQUFVLFNBQVMsb0JBQW9CLE9BQU0sWUFBVztBQUM1RCxVQUFJO0FBQ0osVUFBSTtBQUNILGNBQU0sS0FBSyxNQUFNLG1CQUFtQixRQUFRLElBQUksS0FBSyxDQUFDO0FBQUEsTUFDdkQsUUFBUTtBQUNQLGVBQU8sUUFBUSxZQUFZLEtBQUssSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDckQ7QUFFQSxVQUFJO0FBQ0osVUFBSTtBQUNILGtCQUFVLE1BQU0sWUFBWSxTQUFTLElBQUksS0FBSyxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3pELFNBQVMsR0FBRztBQUNYLGNBQU0sTUFBTSxTQUFTLFdBQVcsRUFBRSxPQUFPLEVBQUU7QUFDM0MsWUFBSSxhQUFhLHNCQUFzQixFQUFFLHdCQUF3QixvQkFBb0IsZ0JBQWdCO0FBQ3BHLGlCQUFPLFFBQVEsWUFBWSxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsUUFDeEMsT0FBTztBQUNOLGlCQUFPLFFBQVEsWUFBWSxLQUFLLEtBQUssQ0FBQyxDQUFDO0FBQUEsUUFDeEM7QUFBQSxNQUNEO0FBRUEsWUFBTSxPQUFPLElBQUksUUFBUSxtQkFBbUIsSUFBSSxJQUFJO0FBQ3BELGNBQVEsWUFBWSxLQUFLLFFBQVEsTUFBTSxRQUFRLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSyxJQUFJLENBQUMsQ0FBQztBQUFBLElBQ3BGLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVPLHlCQUErQztBQUNyRCxVQUFNLFVBQVUsSUFBSSxNQUFNLFNBQVMsU0FBUyxJQUFJO0FBQ2hELFdBQU8sU0FBTyxRQUFRLEtBQUs7QUFBQSxNQUMxQixNQUFNLEtBQUssU0FBUztBQUFBLE1BQ3BCLE9BQU8sS0FBSyxVQUFVLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBdkNhLDhCQUFOO0FBQUEsRUFFSjtBQUFBLEdBRlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
