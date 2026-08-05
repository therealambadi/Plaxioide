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
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { LinkComputer } from "../../../../../editor/common/languages/linkComputer.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { convertLinkRangeToBuffer, getXtermLineContent } from "./terminalLinkHelpers.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxResolvedLinksInLine"] = 10] = "MaxResolvedLinksInLine";
  return Constants2;
})(Constants || {});
let TerminalUriLinkDetector = class {
  constructor(xterm, _processManager, _linkResolver, _logService, _uriIdentityService, _workspaceContextService) {
    this.xterm = xterm;
    this._processManager = _processManager;
    this._linkResolver = _linkResolver;
    this._logService = _logService;
    this._uriIdentityService = _uriIdentityService;
    this._workspaceContextService = _workspaceContextService;
    // 2048 is the maximum URL length
    this.maxLinkLength = 2048;
  }
  async detect(lines, startLine, endLine) {
    const links = [];
    const linkComputerTarget = new TerminalLinkAdapter(this.xterm, startLine, endLine);
    const computedLinks = LinkComputer.computeLinks(linkComputerTarget);
    let resolvedLinkCount = 0;
    this._logService.trace("terminalUriLinkDetector#detect computedLinks", computedLinks);
    for (const computedLink of computedLinks) {
      const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, computedLink.range, startLine);
      const uri = computedLink.url ? typeof computedLink.url === "string" ? URI.parse(this._excludeLineAndColSuffix(computedLink.url)) : computedLink.url : void 0;
      if (!uri) {
        continue;
      }
      const text = computedLink.url?.toString() || "";
      if (text.length > this.maxLinkLength) {
        continue;
      }
      if (uri.scheme !== Schemas.file) {
        links.push({
          text,
          uri,
          bufferRange,
          type: TerminalBuiltinLinkType.Url
        });
        continue;
      }
      if (uri.authority.length !== 2 && uri.authority.endsWith(":")) {
        continue;
      }
      const uriCandidates = [uri];
      if (uri.authority.length > 0) {
        uriCandidates.push(URI.from({ ...uri, authority: void 0 }));
      }
      this._logService.trace("terminalUriLinkDetector#detect uriCandidates", uriCandidates);
      for (const uriCandidate of uriCandidates) {
        const linkStat = await this._linkResolver.resolveLink(this._processManager, text, uriCandidate);
        if (linkStat) {
          let type;
          if (linkStat.isDirectory) {
            if (this._isDirectoryInsideWorkspace(uriCandidate)) {
              type = TerminalBuiltinLinkType.LocalFolderInWorkspace;
            } else {
              type = TerminalBuiltinLinkType.LocalFolderOutsideWorkspace;
            }
          } else {
            type = TerminalBuiltinLinkType.LocalFile;
          }
          const simpleLink = {
            // Use computedLink.url if it's a string to retain the line/col suffix
            text: typeof computedLink.url === "string" ? computedLink.url : linkStat.link,
            uri: uriCandidate,
            bufferRange,
            type
          };
          this._logService.trace("terminalUriLinkDetector#detect verified link", simpleLink);
          links.push(simpleLink);
          resolvedLinkCount++;
          break;
        }
      }
      if (++resolvedLinkCount >= 10 /* MaxResolvedLinksInLine */) {
        break;
      }
    }
    return links;
  }
  _isDirectoryInsideWorkspace(uri) {
    const folders = this._workspaceContextService.getWorkspace().folders;
    for (let i = 0; i < folders.length; i++) {
      if (this._uriIdentityService.extUri.isEqualOrParent(uri, folders[i].uri)) {
        return true;
      }
    }
    return false;
  }
  _excludeLineAndColSuffix(path) {
    return path.replace(/:\d+(:\d+)?$/, "");
  }
};
TerminalUriLinkDetector.id = "uri";
TerminalUriLinkDetector = __decorateClass([
  __decorateParam(3, ITerminalLogService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IWorkspaceContextService)
], TerminalUriLinkDetector);
class TerminalLinkAdapter {
  constructor(_xterm, _lineStart, _lineEnd) {
    this._xterm = _xterm;
    this._lineStart = _lineStart;
    this._lineEnd = _lineEnd;
  }
  getLineCount() {
    return 1;
  }
  getLineContent() {
    return getXtermLineContent(this._xterm.buffer.active, this._lineStart, this._lineEnd, this._xterm.cols);
  }
}
export {
  TerminalUriLinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbFVyaUxpbmtEZXRlY3Rvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJTGlua0NvbXB1dGVyVGFyZ2V0LCBMaW5rQ29tcHV0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9saW5rQ29tcHV0ZXIuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxMaW5rRGV0ZWN0b3IsIElUZXJtaW5hbExpbmtSZXNvbHZlciwgSVRlcm1pbmFsU2ltcGxlTGluaywgVGVybWluYWxCdWlsdGluTGlua1R5cGUgfSBmcm9tICcuL2xpbmtzLmpzJztcbmltcG9ydCB7IGNvbnZlcnRMaW5rUmFuZ2VUb0J1ZmZlciwgZ2V0WHRlcm1MaW5lQ29udGVudCB9IGZyb20gJy4vdGVybWluYWxMaW5rSGVscGVycy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9jZXNzTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgdHlwZSB7IElCdWZmZXJMaW5lLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBJVGVybWluYWxCYWNrZW5kLCBJVGVybWluYWxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHQvKipcblx0ICogVGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmtzIGluIGEgbGluZSB0byByZXNvbHZlIGFnYWluc3QgdGhlIGZpbGUgc3lzdGVtLiBUaGlzIGxpbWl0IGlzIHB1dFxuXHQgKiBpbiBwbGFjZSB0byBhdm9pZCBzZW5kaW5nIGV4Y2Vzc2l2ZSBkYXRhIHdoZW4gcmVtb3RlIGNvbm5lY3Rpb25zIGFyZSBpbiBwbGFjZS5cblx0ICovXG5cdE1heFJlc29sdmVkTGlua3NJbkxpbmUgPSAxMFxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxVcmlMaW5rRGV0ZWN0b3IgaW1wbGVtZW50cyBJVGVybWluYWxMaW5rRGV0ZWN0b3Ige1xuXHRzdGF0aWMgaWQgPSAndXJpJztcblxuXHQvLyAyMDQ4IGlzIHRoZSBtYXhpbXVtIFVSTCBsZW5ndGhcblx0cmVhZG9ubHkgbWF4TGlua0xlbmd0aCA9IDIwNDg7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgeHRlcm06IFRlcm1pbmFsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2Nlc3NNYW5hZ2VyOiBQaWNrPElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyLCAnaW5pdGlhbEN3ZCcgfCAnb3MnIHwgJ3JlbW90ZUF1dGhvcml0eScgfCAndXNlckhvbWUnPiAmIHsgYmFja2VuZD86IFBpY2s8SVRlcm1pbmFsQmFja2VuZCwgJ2dldFdzbFBhdGgnPiB9LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmtSZXNvbHZlcjogSVRlcm1pbmFsTGlua1Jlc29sdmVyLFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGRldGVjdChsaW5lczogSUJ1ZmZlckxpbmVbXSwgc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlcik6IFByb21pc2U8SVRlcm1pbmFsU2ltcGxlTGlua1tdPiB7XG5cdFx0Y29uc3QgbGlua3M6IElUZXJtaW5hbFNpbXBsZUxpbmtbXSA9IFtdO1xuXG5cdFx0Y29uc3QgbGlua0NvbXB1dGVyVGFyZ2V0ID0gbmV3IFRlcm1pbmFsTGlua0FkYXB0ZXIodGhpcy54dGVybSwgc3RhcnRMaW5lLCBlbmRMaW5lKTtcblx0XHRjb25zdCBjb21wdXRlZExpbmtzID0gTGlua0NvbXB1dGVyLmNvbXB1dGVMaW5rcyhsaW5rQ29tcHV0ZXJUYXJnZXQpO1xuXG5cdFx0bGV0IHJlc29sdmVkTGlua0NvdW50ID0gMDtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCd0ZXJtaW5hbFVyaUxpbmtEZXRlY3RvciNkZXRlY3QgY29tcHV0ZWRMaW5rcycsIGNvbXB1dGVkTGlua3MpO1xuXHRcdGZvciAoY29uc3QgY29tcHV0ZWRMaW5rIG9mIGNvbXB1dGVkTGlua3MpIHtcblx0XHRcdGNvbnN0IGJ1ZmZlclJhbmdlID0gY29udmVydExpbmtSYW5nZVRvQnVmZmVyKGxpbmVzLCB0aGlzLnh0ZXJtLmNvbHMsIGNvbXB1dGVkTGluay5yYW5nZSwgc3RhcnRMaW5lKTtcblxuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGxpbmsgaXMgd2l0aGluIHRoZSBtb3VzZSBwb3NpdGlvblxuXHRcdFx0Y29uc3QgdXJpID0gY29tcHV0ZWRMaW5rLnVybFxuXHRcdFx0XHQ/ICh0eXBlb2YgY29tcHV0ZWRMaW5rLnVybCA9PT0gJ3N0cmluZycgPyBVUkkucGFyc2UodGhpcy5fZXhjbHVkZUxpbmVBbmRDb2xTdWZmaXgoY29tcHV0ZWRMaW5rLnVybCkpIDogY29tcHV0ZWRMaW5rLnVybClcblx0XHRcdFx0OiB1bmRlZmluZWQ7XG5cblx0XHRcdGlmICghdXJpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0ZXh0ID0gY29tcHV0ZWRMaW5rLnVybD8udG9TdHJpbmcoKSB8fCAnJztcblxuXHRcdFx0Ly8gRG9uJ3QgdHJ5IHJlc29sdmUgYW55IGxpbmtzIG9mIGV4Y2Vzc2l2ZSBsZW5ndGhcblx0XHRcdGlmICh0ZXh0Lmxlbmd0aCA+IHRoaXMubWF4TGlua0xlbmd0aCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIG5vbi1maWxlIHNjaGVtZSBsaW5rc1xuXHRcdFx0aWYgKHVyaS5zY2hlbWUgIT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRsaW5rcy5wdXNoKHtcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdHVyaSxcblx0XHRcdFx0XHRidWZmZXJSYW5nZSxcblx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Vcmxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IFVSSSB3aXRoIHVucmVjb2duaXplZCBhdXRob3JpdGllc1xuXHRcdFx0aWYgKHVyaS5hdXRob3JpdHkubGVuZ3RoICE9PSAyICYmIHVyaS5hdXRob3JpdHkuZW5kc1dpdGgoJzonKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXMgYSBmYWxsYmFjayBVUkksIHRyZWF0IHRoZSBhdXRob3JpdHkgYXMgbG9jYWwgdG8gdGhlIHdvcmtzcGFjZS4gVGhpcyBpcyByZXF1aXJlZFxuXHRcdFx0Ly8gZm9yIGBscyAtLWh5cGVybGlua2Agc3VwcG9ydCBmb3IgZXhhbXBsZSB3aGljaCBpbmNsdWRlcyB0aGUgaG9zdG5hbWUgaW4gdGhlIFVSSSBsaWtlXG5cdFx0XHQvLyBgZmlsZTovL1NvbWUtSG9zdG5hbWUvbW50L2MvZm9vL2JhcmAuXG5cdFx0XHRjb25zdCB1cmlDYW5kaWRhdGVzOiBVUklbXSA9IFt1cmldO1xuXHRcdFx0aWYgKHVyaS5hdXRob3JpdHkubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR1cmlDYW5kaWRhdGVzLnB1c2goVVJJLmZyb20oeyAuLi51cmksIGF1dGhvcml0eTogdW5kZWZpbmVkIH0pKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSXRlcmF0ZSBvdmVyIGFsbCBjYW5kaWRhdGVzLCBwdXNoaW5nIHRoZSBjYW5kaWRhdGUgb24gdGhlIGZpcnN0IHRoYXQncyB2ZXJpZmllZFxuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgndGVybWluYWxVcmlMaW5rRGV0ZWN0b3IjZGV0ZWN0IHVyaUNhbmRpZGF0ZXMnLCB1cmlDYW5kaWRhdGVzKTtcblx0XHRcdGZvciAoY29uc3QgdXJpQ2FuZGlkYXRlIG9mIHVyaUNhbmRpZGF0ZXMpIHtcblx0XHRcdFx0Y29uc3QgbGlua1N0YXQgPSBhd2FpdCB0aGlzLl9saW5rUmVzb2x2ZXIucmVzb2x2ZUxpbmsodGhpcy5fcHJvY2Vzc01hbmFnZXIsIHRleHQsIHVyaUNhbmRpZGF0ZSk7XG5cblx0XHRcdFx0Ly8gQ3JlYXRlIHRoZSBsaW5rIGlmIHZhbGlkYXRlZFxuXHRcdFx0XHRpZiAobGlua1N0YXQpIHtcblx0XHRcdFx0XHRsZXQgdHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGU7XG5cdFx0XHRcdFx0aWYgKGxpbmtTdGF0LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5faXNEaXJlY3RvcnlJbnNpZGVXb3Jrc3BhY2UodXJpQ2FuZGlkYXRlKSkge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGb2xkZXJJbldvcmtzcGFjZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZvbGRlck91dHNpZGVXb3Jrc3BhY2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHR5cGUgPSBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZpbGU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHNpbXBsZUxpbms6IElUZXJtaW5hbFNpbXBsZUxpbmsgPSB7XG5cdFx0XHRcdFx0XHQvLyBVc2UgY29tcHV0ZWRMaW5rLnVybCBpZiBpdCdzIGEgc3RyaW5nIHRvIHJldGFpbiB0aGUgbGluZS9jb2wgc3VmZml4XG5cdFx0XHRcdFx0XHR0ZXh0OiB0eXBlb2YgY29tcHV0ZWRMaW5rLnVybCA9PT0gJ3N0cmluZycgPyBjb21wdXRlZExpbmsudXJsIDogbGlua1N0YXQubGluayxcblx0XHRcdFx0XHRcdHVyaTogdXJpQ2FuZGlkYXRlLFxuXHRcdFx0XHRcdFx0YnVmZmVyUmFuZ2UsXG5cdFx0XHRcdFx0XHR0eXBlXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCd0ZXJtaW5hbFVyaUxpbmtEZXRlY3RvciNkZXRlY3QgdmVyaWZpZWQgbGluaycsIHNpbXBsZUxpbmspO1xuXHRcdFx0XHRcdGxpbmtzLnB1c2goc2ltcGxlTGluayk7XG5cdFx0XHRcdFx0cmVzb2x2ZWRMaW5rQ291bnQrKztcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBTdG9wIGVhcmx5IGlmIHRvbyBtYW55IGxpbmtzIGV4aXN0IGluIHRoZSBsaW5lXG5cdFx0XHRpZiAoKytyZXNvbHZlZExpbmtDb3VudCA+PSBDb25zdGFudHMuTWF4UmVzb2x2ZWRMaW5rc0luTGluZSkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbGlua3M7XG5cdH1cblxuXHRwcml2YXRlIF9pc0RpcmVjdG9yeUluc2lkZVdvcmtzcGFjZSh1cmk6IFVSSSkge1xuXHRcdGNvbnN0IGZvbGRlcnMgPSB0aGlzLl93b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZm9sZGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHRoaXMuX3VyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbE9yUGFyZW50KHVyaSwgZm9sZGVyc1tpXS51cmkpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9leGNsdWRlTGluZUFuZENvbFN1ZmZpeChwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBwYXRoLnJlcGxhY2UoLzpcXGQrKDpcXGQrKT8kLywgJycpO1xuXHR9XG59XG5cbmNsYXNzIFRlcm1pbmFsTGlua0FkYXB0ZXIgaW1wbGVtZW50cyBJTGlua0NvbXB1dGVyVGFyZ2V0IHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBfeHRlcm06IFRlcm1pbmFsLFxuXHRcdHByaXZhdGUgX2xpbmVTdGFydDogbnVtYmVyLFxuXHRcdHByaXZhdGUgX2xpbmVFbmQ6IG51bWJlclxuXHQpIHsgfVxuXG5cdGdldExpbmVDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiAxO1xuXHR9XG5cblx0Z2V0TGluZUNvbnRlbnQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZ2V0WHRlcm1MaW5lQ29udGVudCh0aGlzLl94dGVybS5idWZmZXIuYWN0aXZlLCB0aGlzLl9saW5lU3RhcnQsIHRoaXMuX2xpbmVFbmQsIHRoaXMuX3h0ZXJtLmNvbHMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLFdBQVc7QUFDcEIsU0FBOEIsb0JBQW9CO0FBQ2xELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQTRFLCtCQUErQjtBQUMzRyxTQUFTLDBCQUEwQiwyQkFBMkI7QUFHOUQsU0FBMkIsMkJBQTJCO0FBRXRELElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUtDLEVBQUFBLHNCQUFBLDRCQUF5QixNQUF6QjtBQUxVLFNBQUFBO0FBQUEsR0FBQTtBQVFKLElBQU0sMEJBQU4sTUFBK0Q7QUFBQSxFQU1yRSxZQUNVLE9BQ1EsaUJBQ0EsZUFDcUIsYUFDQSxxQkFDSywwQkFDMUM7QUFOUTtBQUNRO0FBQ0E7QUFDcUI7QUFDQTtBQUNLO0FBUjVDO0FBQUEsU0FBUyxnQkFBZ0I7QUFBQSxFQVV6QjtBQUFBLEVBRUEsTUFBTSxPQUFPLE9BQXNCLFdBQW1CLFNBQWlEO0FBQ3RHLFVBQU0sUUFBK0IsQ0FBQztBQUV0QyxVQUFNLHFCQUFxQixJQUFJLG9CQUFvQixLQUFLLE9BQU8sV0FBVyxPQUFPO0FBQ2pGLFVBQU0sZ0JBQWdCLGFBQWEsYUFB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
