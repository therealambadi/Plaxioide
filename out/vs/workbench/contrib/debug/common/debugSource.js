import * as nls from "../../../../nls.js";
import { URI } from "../../../../base/common/uri.js";
import { normalize, isAbsolute } from "../../../../base/common/path.js";
import * as resources from "../../../../base/common/resources.js";
import { DEBUG_SCHEME } from "./debug.js";
import { SIDE_GROUP, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { Schemas } from "../../../../base/common/network.js";
import { isUri } from "./debugUtils.js";
import { TextEditorSelectionRevealType } from "../../../../platform/editor/common/editor.js";
const UNKNOWN_SOURCE_LABEL = nls.localize("unknownSource", "Unknown Source");
class Source {
  constructor(raw_, sessionId, uriIdentityService, logService) {
    let path;
    if (raw_) {
      this.raw = raw_;
      path = this.raw.path || this.raw.name || "";
      this.available = true;
    } else {
      this.raw = { name: UNKNOWN_SOURCE_LABEL };
      this.available = false;
      path = `${DEBUG_SCHEME}:${UNKNOWN_SOURCE_LABEL}`;
    }
    this.uri = getUriFromSource(this.raw, path, sessionId, uriIdentityService, logService);
  }
  get name() {
    return this.raw.name || resources.basenameOrAuthority(this.uri);
  }
  get origin() {
    return this.raw.origin;
  }
  get presentationHint() {
    return this.raw.presentationHint;
  }
  get reference() {
    return this.raw.sourceReference;
  }
  get inMemory() {
    return this.uri.scheme === DEBUG_SCHEME;
  }
  openInEditor(editorService, selection, preserveFocus, sideBySide, pinned) {
    return !this.available ? Promise.resolve(void 0) : editorService.openEditor({
      resource: this.uri,
      description: this.origin,
      options: {
        preserveFocus,
        selection,
        revealIfOpened: true,
        selectionRevealType: TextEditorSelectionRevealType.CenterIfOutsideViewport,
        pinned
      }
    }, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
  }
  static getEncodedDebugData(modelUri) {
    let path;
    let sourceReference;
    let sessionId;
    switch (modelUri.scheme) {
      case Schemas.file:
        path = normalize(modelUri.fsPath);
        break;
      case DEBUG_SCHEME:
        path = modelUri.path;
        if (modelUri.query) {
          const keyvalues = modelUri.query.split("&");
          for (const keyvalue of keyvalues) {
            const pair = keyvalue.split("=");
            if (pair.length === 2) {
              switch (pair[0]) {
                case "session":
                  sessionId = pair[1];
                  break;
                case "ref":
                  sourceReference = parseInt(pair[1]);
                  break;
              }
            }
          }
        }
        break;
      default:
        path = modelUri.toString();
        break;
    }
    return {
      name: resources.basenameOrAuthority(modelUri),
      path,
      sourceReference,
      sessionId
    };
  }
}
function getUriFromSource(raw, path, sessionId, uriIdentityService, logService) {
  const _getUriFromSource = (path2) => {
    if (typeof raw.sourceReference === "number" && raw.sourceReference > 0) {
      return URI.from({
        scheme: DEBUG_SCHEME,
        path: path2?.replace(/^\/+/g, "/"),
        // #174054
        query: `session=${sessionId}&ref=${raw.sourceReference}`
      });
    }
    if (path2 && isUri(path2)) {
      return uriIdentityService.asCanonicalUri(URI.parse(path2));
    }
    if (path2 && isAbsolute(path2)) {
      return uriIdentityService.asCanonicalUri(URI.file(path2));
    }
    return uriIdentityService.asCanonicalUri(URI.from({
      scheme: DEBUG_SCHEME,
      path: path2,
      query: `session=${sessionId}`
    }));
  };
  try {
    return _getUriFromSource(path);
  } catch (err) {
    logService.error("Invalid path from debug adapter: " + path);
    return _getUriFromSource("/invalidDebugSource");
  }
}
export {
  Source,
  UNKNOWN_SOURCE_LABEL,
  getUriFromSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdTb3VyY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBub3JtYWxpemUsIGlzQWJzb2x1dGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgREVCVUdfU0NIRU1FIH0gZnJvbSAnLi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAsIEFDVElWRV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc1VyaSB9IGZyb20gJy4vZGVidWdVdGlscy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5leHBvcnQgY29uc3QgVU5LTk9XTl9TT1VSQ0VfTEFCRUwgPSBubHMubG9jYWxpemUoJ3Vua25vd25Tb3VyY2UnLCBcIlVua25vd24gU291cmNlXCIpO1xuXG4vKipcbiAqIERlYnVnIFVSSSBmb3JtYXRcbiAqXG4gKiBhIGRlYnVnIFVSSSByZXByZXNlbnRzIGEgU291cmNlIG9iamVjdCBhbmQgdGhlIGRlYnVnIHNlc3Npb24gd2hlcmUgdGhlIFNvdXJjZSBjb21lcyBmcm9tLlxuICpcbiAqICAgICAgIGRlYnVnOmFyYml0cmFyeV9wYXRoP3Nlc3Npb249MTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjU1NDQwMDAwJnJlZj0xMDE2XG4gKiAgICAgICBcXF9fXy8gXFxfX19fX19fX19fX18vIFxcX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fLyBcXF9fX19fXy9cbiAqICAgICAgICAgfCAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICB8ICAgICAgICAgICAgICAgICAgICAgICAgICB8XG4gKiAgICAgIHNjaGVtZSAgIHNvdXJjZS5wYXRoICAgICAgICAgICAgICAgICAgICBzZXNzaW9uIGlkICAgICAgICAgICAgc291cmNlLnJlZmVyZW5jZVxuICpcbiAqXG4gKi9cblxuZXhwb3J0IGNsYXNzIFNvdXJjZSB7XG5cblx0cmVhZG9ubHkgdXJpOiBVUkk7XG5cdGF2YWlsYWJsZTogYm9vbGVhbjtcblx0cmF3OiBEZWJ1Z1Byb3RvY29sLlNvdXJjZTtcblxuXHRjb25zdHJ1Y3RvcihyYXdfOiBEZWJ1Z1Byb3RvY29sLlNvdXJjZSB8IHVuZGVmaW5lZCwgc2Vzc2lvbklkOiBzdHJpbmcsIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpIHtcblx0XHRsZXQgcGF0aDogc3RyaW5nO1xuXHRcdGlmIChyYXdfKSB7XG5cdFx0XHR0aGlzLnJhdyA9IHJhd187XG5cdFx0XHRwYXRoID0gdGhpcy5yYXcucGF0aCB8fCB0aGlzLnJhdy5uYW1lIHx8ICcnO1xuXHRcdFx0dGhpcy5hdmFpbGFibGUgPSB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJhdyA9IHsgbmFtZTogVU5LTk9XTl9TT1VSQ0VfTEFCRUwgfTtcblx0XHRcdHRoaXMuYXZhaWxhYmxlID0gZmFsc2U7XG5cdFx0XHRwYXRoID0gYCR7REVCVUdfU0NIRU1FfToke1VOS05PV05fU09VUkNFX0xBQkVMfWA7XG5cdFx0fVxuXG5cdFx0dGhpcy51cmkgPSBnZXRVcmlGcm9tU291cmNlKHRoaXMucmF3LCBwYXRoLCBzZXNzaW9uSWQsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSk7XG5cdH1cblxuXHRnZXQgbmFtZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5yYXcubmFtZSB8fCByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eSh0aGlzLnVyaSk7XG5cdH1cblxuXHRnZXQgb3JpZ2luKCkge1xuXHRcdHJldHVybiB0aGlzLnJhdy5vcmlnaW47XG5cdH1cblxuXHRnZXQgcHJlc2VudGF0aW9uSGludCgpIHtcblx0XHRyZXR1cm4gdGhpcy5yYXcucHJlc2VudGF0aW9uSGludDtcblx0fVxuXG5cdGdldCByZWZlcmVuY2UoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmF3LnNvdXJjZVJlZmVyZW5jZTtcblx0fVxuXG5cdGdldCBpbk1lbW9yeSgpIHtcblx0XHRyZXR1cm4gdGhpcy51cmkuc2NoZW1lID09PSBERUJVR19TQ0hFTUU7XG5cdH1cblxuXHRvcGVuSW5FZGl0b3IoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIHNlbGVjdGlvbjogSVJhbmdlLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbiwgc2lkZUJ5U2lkZT86IGJvb2xlYW4sIHBpbm5lZD86IGJvb2xlYW4pOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuICF0aGlzLmF2YWlsYWJsZSA/IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpIDogZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdHJlc291cmNlOiB0aGlzLnVyaSxcblx0XHRcdGRlc2NyaXB0aW9uOiB0aGlzLm9yaWdpbixcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0cHJlc2VydmVGb2N1cyxcblx0XHRcdFx0c2VsZWN0aW9uLFxuXHRcdFx0XHRyZXZlYWxJZk9wZW5lZDogdHJ1ZSxcblx0XHRcdFx0c2VsZWN0aW9uUmV2ZWFsVHlwZTogVGV4dEVkaXRvclNlbGVjdGlvblJldmVhbFR5cGUuQ2VudGVySWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRcdHBpbm5lZFxuXHRcdFx0fVxuXHRcdH0sIHNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogQUNUSVZFX0dST1VQKTtcblx0fVxuXG5cdHN0YXRpYyBnZXRFbmNvZGVkRGVidWdEYXRhKG1vZGVsVXJpOiBVUkkpOiB7IG5hbWU6IHN0cmluZzsgcGF0aDogc3RyaW5nOyBzZXNzaW9uSWQ/OiBzdHJpbmc7IHNvdXJjZVJlZmVyZW5jZT86IG51bWJlciB9IHtcblx0XHRsZXQgcGF0aDogc3RyaW5nO1xuXHRcdGxldCBzb3VyY2VSZWZlcmVuY2U6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc2Vzc2lvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0XHRzd2l0Y2ggKG1vZGVsVXJpLnNjaGVtZSkge1xuXHRcdFx0Y2FzZSBTY2hlbWFzLmZpbGU6XG5cdFx0XHRcdHBhdGggPSBub3JtYWxpemUobW9kZWxVcmkuZnNQYXRoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIERFQlVHX1NDSEVNRTpcblx0XHRcdFx0cGF0aCA9IG1vZGVsVXJpLnBhdGg7XG5cdFx0XHRcdGlmIChtb2RlbFVyaS5xdWVyeSkge1xuXHRcdFx0XHRcdGNvbnN0IGtleXZhbHVlcyA9IG1vZGVsVXJpLnF1ZXJ5LnNwbGl0KCcmJyk7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBrZXl2YWx1ZSBvZiBrZXl2YWx1ZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhaXIgPSBrZXl2YWx1ZS5zcGxpdCgnPScpO1xuXHRcdFx0XHRcdFx0aWYgKHBhaXIubGVuZ3RoID09PSAyKSB7XG5cdFx0XHRcdFx0XHRcdHN3aXRjaCAocGFpclswXSkge1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3Nlc3Npb24nOlxuXHRcdFx0XHRcdFx0XHRcdFx0c2Vzc2lvbklkID0gcGFpclsxXTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3JlZic6XG5cdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2VSZWZlcmVuY2UgPSBwYXJzZUludChwYWlyWzFdKTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cGF0aCA9IG1vZGVsVXJpLnRvU3RyaW5nKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiByZXNvdXJjZXMuYmFzZW5hbWVPckF1dGhvcml0eShtb2RlbFVyaSksXG5cdFx0XHRwYXRoLFxuXHRcdFx0c291cmNlUmVmZXJlbmNlLFxuXHRcdFx0c2Vzc2lvbklkXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VXJpRnJvbVNvdXJjZShyYXc6IERlYnVnUHJvdG9jb2wuU291cmNlLCBwYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsIHNlc3Npb25JZDogc3RyaW5nLCB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKTogVVJJIHtcblx0Y29uc3QgX2dldFVyaUZyb21Tb3VyY2UgPSAocGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0aWYgKHR5cGVvZiByYXcuc291cmNlUmVmZXJlbmNlID09PSAnbnVtYmVyJyAmJiByYXcuc291cmNlUmVmZXJlbmNlID4gMCkge1xuXHRcdFx0cmV0dXJuIFVSSS5mcm9tKHtcblx0XHRcdFx0c2NoZW1lOiBERUJVR19TQ0hFTUUsXG5cdFx0XHRcdHBhdGg6IHBhdGg/LnJlcGxhY2UoL15cXC8rL2csICcvJyksIC8vICMxNzQwNTRcblx0XHRcdFx0cXVlcnk6IGBzZXNzaW9uPSR7c2Vzc2lvbklkfSZyZWY9JHtyYXcuc291cmNlUmVmZXJlbmNlfWBcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChwYXRoICYmIGlzVXJpKHBhdGgpKSB7XHQvLyBwYXRoIGxvb2tzIGxpa2UgYSB1cmlcblx0XHRcdHJldHVybiB1cmlJZGVudGl0eVNlcnZpY2UuYXNDYW5vbmljYWxVcmkoVVJJLnBhcnNlKHBhdGgpKTtcblx0XHR9XG5cdFx0Ly8gYXNzdW1lIGEgZmlsZXN5c3RlbSBwYXRoXG5cdFx0aWYgKHBhdGggJiYgaXNBYnNvbHV0ZShwYXRoKSkge1xuXHRcdFx0cmV0dXJuIHVyaUlkZW50aXR5U2VydmljZS5hc0Nhbm9uaWNhbFVyaShVUkkuZmlsZShwYXRoKSk7XG5cdFx0fVxuXHRcdC8vIHBhdGggaXMgcmVsYXRpdmU6IHNpbmNlIFZTIENvZGUgY2Fubm90IGRlYWwgd2l0aCB0aGlzIGJ5IGl0c2VsZlxuXHRcdC8vIGNyZWF0ZSBhIGRlYnVnIHVybCB0aGF0IHdpbGwgcmVzdWx0IGluIGEgREFQICdzb3VyY2UnIHJlcXVlc3Qgd2hlbiB0aGUgdXJsIGlzIHJlc29sdmVkLlxuXHRcdHJldHVybiB1cmlJZGVudGl0eVNlcnZpY2UuYXNDYW5vbmljYWxVcmkoVVJJLmZyb20oe1xuXHRcdFx0c2NoZW1lOiBERUJVR19TQ0hFTUUsXG5cdFx0XHRwYXRoLFxuXHRcdFx0cXVlcnk6IGBzZXNzaW9uPSR7c2Vzc2lvbklkfWBcblx0XHR9KSk7XG5cdH07XG5cblxuXHR0cnkge1xuXHRcdHJldHVybiBfZ2V0VXJpRnJvbVNvdXJjZShwYXRoKTtcblx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0bG9nU2VydmljZS5lcnJvcignSW52YWxpZCBwYXRoIGZyb20gZGVidWcgYWRhcHRlcjogJyArIHBhdGgpO1xuXHRcdHJldHVybiBfZ2V0VXJpRnJvbVNvdXJjZSgnL2ludmFsaWREZWJ1Z1NvdXJjZScpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsV0FBVyxrQkFBa0I7QUFDdEMsWUFBWSxlQUFlO0FBQzNCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQXlCLFlBQVksb0JBQW9CO0FBQ3pELFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFFdEIsU0FBUyxxQ0FBcUM7QUFJdkMsTUFBTSx1QkFBdUIsSUFBSSxTQUFTLGlCQUFpQixnQkFBZ0I7QUFlM0UsTUFBTSxPQUFPO0FBQUEsRUFNbkIsWUFBWSxNQUF3QyxXQUFtQixvQkFBeUMsWUFBeUI7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
