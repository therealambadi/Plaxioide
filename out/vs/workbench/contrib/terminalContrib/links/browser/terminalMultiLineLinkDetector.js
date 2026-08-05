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
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { convertLinkRangeToBuffer, getXtermLineContent } from "./terminalLinkHelpers.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxLineLength"] = 2e3] = "MaxLineLength";
  Constants2[Constants2["MaxResolvedLinkLength"] = 1024] = "MaxResolvedLinkLength";
  return Constants2;
})(Constants || {});
const lineNumberPrefixMatchers = [
  // Ripgrep:
  //   /some/file
  //   16:searchresult
  //   16:    searchresult
  // Eslint:
  //   /some/file
  //     16:5  error ...
  /^ *(?<link>(?<line>\d+):(?<col>\d+)?)/
];
const gitDiffMatchers = [
  // --- a/some/file
  // +++ b/some/file
  // @@ -8,11 +8,11 @@ file content...
  /^(?<link>@@ .+ \+(?<toFileLine>\d+),(?<toFileCount>\d+) @@)/
];
let TerminalMultiLineLinkDetector = class {
  constructor(xterm, _processManager, _linkResolver, _logService, _uriIdentityService, _workspaceContextService) {
    this.xterm = xterm;
    this._processManager = _processManager;
    this._linkResolver = _linkResolver;
    this._logService = _logService;
    this._uriIdentityService = _uriIdentityService;
    this._workspaceContextService = _workspaceContextService;
    // This was chosen as a reasonable maximum line length given the tradeoff between performance
    // and how likely it is to encounter such a large line length. Some useful reference points:
    // - Window old max length: 260 ($MAX_PATH)
    // - Linux max length: 4096 ($PATH_MAX)
    this.maxLinkLength = 500;
  }
  async detect(lines, startLine, endLine) {
    const links = [];
    const text = getXtermLineContent(this.xterm.buffer.active, startLine, endLine, this.xterm.cols);
    if (text === "" || text.length > 2e3 /* MaxLineLength */) {
      return [];
    }
    this._logService.trace("terminalMultiLineLinkDetector#detect text", text);
    for (const matcher of lineNumberPrefixMatchers) {
      const match = text.match(matcher);
      const group = match?.groups;
      if (!group) {
        continue;
      }
      const link = group?.link;
      const line = group?.line;
      const col = group?.col;
      if (!link || line === void 0) {
        continue;
      }
      if (link.length > 1024 /* MaxResolvedLinkLength */) {
        continue;
      }
      this._logService.trace("terminalMultiLineLinkDetector#detect candidate", link);
      let possiblePath;
      for (let index = startLine - 1; index >= 0; index--) {
        if (this.xterm.buffer.active.getLine(index).isWrapped) {
          continue;
        }
        const text2 = getXtermLineContent(this.xterm.buffer.active, index, index, this.xterm.cols);
        if (!text2.match(/^\s*\d/)) {
          possiblePath = text2;
          break;
        }
      }
      if (!possiblePath) {
        continue;
      }
      const linkStat = await this._linkResolver.resolveLink(this._processManager, possiblePath);
      if (linkStat) {
        let type;
        if (linkStat.isDirectory) {
          if (this._isDirectoryInsideWorkspace(linkStat.uri)) {
            type = TerminalBuiltinLinkType.LocalFolderInWorkspace;
          } else {
            type = TerminalBuiltinLinkType.LocalFolderOutsideWorkspace;
          }
        } else {
          type = TerminalBuiltinLinkType.LocalFile;
        }
        const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
          startColumn: 1,
          startLineNumber: 1,
          endColumn: 1 + text.length,
          endLineNumber: 1
        }, startLine);
        const simpleLink = {
          text: link,
          uri: linkStat.uri,
          selection: {
            startLineNumber: parseInt(line),
            startColumn: col ? parseInt(col) : 1
          },
          disableTrimColon: true,
          bufferRange,
          type
        };
        this._logService.trace("terminalMultiLineLinkDetector#detect verified link", simpleLink);
        links.push(simpleLink);
        break;
      }
    }
    if (links.length === 0) {
      for (const matcher of gitDiffMatchers) {
        const match = text.match(matcher);
        const group = match?.groups;
        if (!group) {
          continue;
        }
        const link = group?.link;
        const toFileLine = group?.toFileLine;
        const toFileCount = group?.toFileCount;
        if (!link || toFileLine === void 0) {
          continue;
        }
        if (link.length > 1024 /* MaxResolvedLinkLength */) {
          continue;
        }
        this._logService.trace("terminalMultiLineLinkDetector#detect candidate", link);
        let possiblePath;
        for (let index = startLine - 1; index >= 0; index--) {
          if (this.xterm.buffer.active.getLine(index).isWrapped) {
            continue;
          }
          const text2 = getXtermLineContent(this.xterm.buffer.active, index, index, this.xterm.cols);
          const match2 = text2.match(/\+\+\+ b\/(?<path>.+)/);
          if (match2) {
            possiblePath = match2.groups?.path;
            break;
          }
        }
        if (!possiblePath) {
          continue;
        }
        const linkStat = await this._linkResolver.resolveLink(this._processManager, possiblePath);
        if (linkStat) {
          let type;
          if (linkStat.isDirectory) {
            if (this._isDirectoryInsideWorkspace(linkStat.uri)) {
              type = TerminalBuiltinLinkType.LocalFolderInWorkspace;
            } else {
              type = TerminalBuiltinLinkType.LocalFolderOutsideWorkspace;
            }
          } else {
            type = TerminalBuiltinLinkType.LocalFile;
          }
          const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
            startColumn: 1,
            startLineNumber: 1,
            endColumn: 1 + link.length,
            endLineNumber: 1
          }, startLine);
          const simpleLink = {
            text: link,
            uri: linkStat.uri,
            selection: {
              startLineNumber: parseInt(toFileLine),
              startColumn: 1,
              endLineNumber: parseInt(toFileLine) + parseInt(toFileCount)
            },
            bufferRange,
            type
          };
          this._logService.trace("terminalMultiLineLinkDetector#detect verified link", simpleLink);
          links.push(simpleLink);
          break;
        }
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
};
TerminalMultiLineLinkDetector.id = "multiline";
TerminalMultiLineLinkDetector = __decorateClass([
  __decorateParam(3, ITerminalLogService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IWorkspaceContextService)
], TerminalMultiLineLinkDetector);
export {
  TerminalMultiLineLinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3Rvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbExpbmtEZXRlY3RvciwgSVRlcm1pbmFsTGlua1Jlc29sdmVyLCBJVGVybWluYWxTaW1wbGVMaW5rLCBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZSB9IGZyb20gJy4vbGlua3MuanMnO1xuaW1wb3J0IHsgY29udmVydExpbmtSYW5nZVRvQnVmZmVyLCBnZXRYdGVybUxpbmVDb250ZW50IH0gZnJvbSAnLi90ZXJtaW5hbExpbmtIZWxwZXJzLmpzJztcbmltcG9ydCB0eXBlIHsgSUJ1ZmZlckxpbmUsIFRlcm1pbmFsIH0gZnJvbSAnQHh0ZXJtL3h0ZXJtJztcbmltcG9ydCB7IElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdC8qKlxuXHQgKiBUaGUgbWF4IGxpbmUgbGVuZ3RoIHRvIHRyeSBleHRyYWN0IHdvcmQgbGlua3MgZnJvbS5cblx0ICovXG5cdE1heExpbmVMZW5ndGggPSAyMDAwLFxuXG5cdC8qKlxuXHQgKiBUaGUgbWF4aW11bSBsZW5ndGggb2YgYSBsaW5rIHRvIHJlc29sdmUgYWdhaW5zdCB0aGUgZmlsZSBzeXN0ZW0uIFRoaXMgbGltaXQgaXMgcHV0IGluIHBsYWNlXG5cdCAqIHRvIGF2b2lkIHNlbmRpbmcgZXhjZXNzaXZlIGRhdGEgd2hlbiByZW1vdGUgY29ubmVjdGlvbnMgYXJlIGluIHBsYWNlLlxuXHQgKi9cblx0TWF4UmVzb2x2ZWRMaW5rTGVuZ3RoID0gMTAyNCxcbn1cblxuY29uc3QgbGluZU51bWJlclByZWZpeE1hdGNoZXJzID0gW1xuXHQvLyBSaXBncmVwOlxuXHQvLyAgIC9zb21lL2ZpbGVcblx0Ly8gICAxNjpzZWFyY2hyZXN1bHRcblx0Ly8gICAxNjogICAgc2VhcmNocmVzdWx0XG5cdC8vIEVzbGludDpcblx0Ly8gICAvc29tZS9maWxlXG5cdC8vICAgICAxNjo1ICBlcnJvciAuLi5cblx0L14gKig/PGxpbms+KD88bGluZT5cXGQrKTooPzxjb2w+XFxkKyk/KS9cbl07XG5cbmNvbnN0IGdpdERpZmZNYXRjaGVycyA9IFtcblx0Ly8gLS0tIGEvc29tZS9maWxlXG5cdC8vICsrKyBiL3NvbWUvZmlsZVxuXHQvLyBAQCAtOCwxMSArOCwxMSBAQCBmaWxlIGNvbnRlbnQuLi5cblx0L14oPzxsaW5rPkBAIC4rIFxcKyg/PHRvRmlsZUxpbmU+XFxkKyksKD88dG9GaWxlQ291bnQ+XFxkKykgQEApL1xuXTtcblxuZXhwb3J0IGNsYXNzIFRlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yIGltcGxlbWVudHMgSVRlcm1pbmFsTGlua0RldGVjdG9yIHtcblx0c3RhdGljIGlkID0gJ211bHRpbGluZSc7XG5cblx0Ly8gVGhpcyB3YXMgY2hvc2VuIGFzIGEgcmVhc29uYWJsZSBtYXhpbXVtIGxpbmUgbGVuZ3RoIGdpdmVuIHRoZSB0cmFkZW9mZiBiZXR3ZWVuIHBlcmZvcm1hbmNlXG5cdC8vIGFuZCBob3cgbGlrZWx5IGl0IGlzIHRvIGVuY291bnRlciBzdWNoIGEgbGFyZ2UgbGluZSBsZW5ndGguIFNvbWUgdXNlZnVsIHJlZmVyZW5jZSBwb2ludHM6XG5cdC8vIC0gV2luZG93IG9sZCBtYXggbGVuZ3RoOiAyNjAgKCRNQVhfUEFUSClcblx0Ly8gLSBMaW51eCBtYXggbGVuZ3RoOiA0MDk2ICgkUEFUSF9NQVgpXG5cdHJlYWRvbmx5IG1heExpbmtMZW5ndGggPSA1MDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgeHRlcm06IFRlcm1pbmFsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2Nlc3NNYW5hZ2VyOiBQaWNrPElUZXJtaW5hbFByb2Nlc3NNYW5hZ2VyLCAnaW5pdGlhbEN3ZCcgfCAnb3MnIHwgJ3JlbW90ZUF1dGhvcml0eScgfCAndXNlckhvbWUnPiAmIHsgYmFja2VuZD86IFBpY2s8SVRlcm1pbmFsQmFja2VuZCwgJ2dldFdzbFBhdGgnPiB9LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xpbmtSZXNvbHZlcjogSVRlcm1pbmFsTGlua1Jlc29sdmVyLFxuXHRcdEBJVGVybWluYWxMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElUZXJtaW5hbExvZ1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGFzeW5jIGRldGVjdChsaW5lczogSUJ1ZmZlckxpbmVbXSwgc3RhcnRMaW5lOiBudW1iZXIsIGVuZExpbmU6IG51bWJlcik6IFByb21pc2U8SVRlcm1pbmFsU2ltcGxlTGlua1tdPiB7XG5cdFx0Y29uc3QgbGlua3M6IElUZXJtaW5hbFNpbXBsZUxpbmtbXSA9IFtdO1xuXG5cdFx0Ly8gR2V0IHRoZSB0ZXh0IHJlcHJlc2VudGF0aW9uIG9mIHRoZSB3cmFwcGVkIGxpbmVcblx0XHRjb25zdCB0ZXh0ID0gZ2V0WHRlcm1MaW5lQ29udGVudCh0aGlzLnh0ZXJtLmJ1ZmZlci5hY3RpdmUsIHN0YXJ0TGluZSwgZW5kTGluZSwgdGhpcy54dGVybS5jb2xzKTtcblx0XHRpZiAodGV4dCA9PT0gJycgfHwgdGV4dC5sZW5ndGggPiBDb25zdGFudHMuTWF4TGluZUxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ3Rlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yI2RldGVjdCB0ZXh0JywgdGV4dCk7XG5cblx0XHQvLyBNYXRjaCBhZ2FpbnN0IHRoZSBmYWxsYmFjayBtYXRjaGVycyB3aGljaCBhcmUgbWFpbmx5IGRlc2lnbmVkIHRvIGNhdGNoIHBhdGhzIHdpdGggc3BhY2VzXG5cdFx0Ly8gdGhhdCBhcmVuJ3QgcG9zc2libGUgdXNpbmcgdGhlIHJlZ3VsYXIgbWVjaGFuaXNtLlxuXHRcdGZvciAoY29uc3QgbWF0Y2hlciBvZiBsaW5lTnVtYmVyUHJlZml4TWF0Y2hlcnMpIHtcblx0XHRcdGNvbnN0IG1hdGNoID0gdGV4dC5tYXRjaChtYXRjaGVyKTtcblx0XHRcdGNvbnN0IGdyb3VwID0gbWF0Y2g/Lmdyb3Vwcztcblx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBsaW5rID0gZ3JvdXA/Lmxpbms7XG5cdFx0XHRjb25zdCBsaW5lID0gZ3JvdXA/LmxpbmU7XG5cdFx0XHRjb25zdCBjb2wgPSBncm91cD8uY29sO1xuXHRcdFx0aWYgKCFsaW5rIHx8IGxpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRG9uJ3QgdHJ5IHJlc29sdmUgYW55IGxpbmtzIG9mIGV4Y2Vzc2l2ZSBsZW5ndGhcblx0XHRcdGlmIChsaW5rLmxlbmd0aCA+IENvbnN0YW50cy5NYXhSZXNvbHZlZExpbmtMZW5ndGgpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ3Rlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yI2RldGVjdCBjYW5kaWRhdGUnLCBsaW5rKTtcblxuXHRcdFx0Ly8gU2NhbiB1cCBsb29raW5nIGZvciB0aGUgZmlyc3QgbGluZSB0aGF0IGNvdWxkIGJlIGEgcGF0aFxuXHRcdFx0bGV0IHBvc3NpYmxlUGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0Zm9yIChsZXQgaW5kZXggPSBzdGFydExpbmUgLSAxOyBpbmRleCA+PSAwOyBpbmRleC0tKSB7XG5cdFx0XHRcdC8vIElnbm9yZSBsaW5lcyB0aGF0IGFyZW4ndCBhdCB0aGUgYmVnaW5uaW5nIG9mIGEgd3JhcHBlZCBsaW5lXG5cdFx0XHRcdGlmICh0aGlzLnh0ZXJtLmJ1ZmZlci5hY3RpdmUuZ2V0TGluZShpbmRleCkhLmlzV3JhcHBlZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHRleHQgPSBnZXRYdGVybUxpbmVDb250ZW50KHRoaXMueHRlcm0uYnVmZmVyLmFjdGl2ZSwgaW5kZXgsIGluZGV4LCB0aGlzLnh0ZXJtLmNvbHMpO1xuXHRcdFx0XHRpZiAoIXRleHQubWF0Y2goL15cXHMqXFxkLykpIHtcblx0XHRcdFx0XHRwb3NzaWJsZVBhdGggPSB0ZXh0O1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXBvc3NpYmxlUGF0aCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGZpcnN0IG5vbi1tYXRjaGluZyBsaW5lIGlzIGFuIGFic29sdXRlIG9yIHJlbGF0aXZlIGxpbmtcblx0XHRcdGNvbnN0IGxpbmtTdGF0ID0gYXdhaXQgdGhpcy5fbGlua1Jlc29sdmVyLnJlc29sdmVMaW5rKHRoaXMuX3Byb2Nlc3NNYW5hZ2VyLCBwb3NzaWJsZVBhdGgpO1xuXHRcdFx0aWYgKGxpbmtTdGF0KSB7XG5cdFx0XHRcdGxldCB0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZTtcblx0XHRcdFx0aWYgKGxpbmtTdGF0LmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2lzRGlyZWN0b3J5SW5zaWRlV29ya3NwYWNlKGxpbmtTdGF0LnVyaSkpIHtcblx0XHRcdFx0XHRcdHR5cGUgPSBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZvbGRlckluV29ya3NwYWNlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGb2xkZXJPdXRzaWRlV29ya3NwYWNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ29udmVydCB0aGUgZW50aXJlIGxpbmUncyB0ZXh0IHN0cmluZyBpbmRleCBpbnRvIGEgd3JhcHBlZCBidWZmZXIgcmFuZ2Vcblx0XHRcdFx0Y29uc3QgYnVmZmVyUmFuZ2UgPSBjb252ZXJ0TGlua1JhbmdlVG9CdWZmZXIobGluZXMsIHRoaXMueHRlcm0uY29scywge1xuXHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRlbmRDb2x1bW46IDEgKyB0ZXh0Lmxlbmd0aCxcblx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAxXG5cdFx0XHRcdH0sIHN0YXJ0TGluZSk7XG5cblx0XHRcdFx0Y29uc3Qgc2ltcGxlTGluazogSVRlcm1pbmFsU2ltcGxlTGluayA9IHtcblx0XHRcdFx0XHR0ZXh0OiBsaW5rLFxuXHRcdFx0XHRcdHVyaTogbGlua1N0YXQudXJpLFxuXHRcdFx0XHRcdHNlbGVjdGlvbjoge1xuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBwYXJzZUludChsaW5lKSxcblx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiBjb2wgPyBwYXJzZUludChjb2wpIDogMVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGlzYWJsZVRyaW1Db2xvbjogdHJ1ZSxcblx0XHRcdFx0XHRidWZmZXJSYW5nZTogYnVmZmVyUmFuZ2UsXG5cdFx0XHRcdFx0dHlwZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCd0ZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3RvciNkZXRlY3QgdmVyaWZpZWQgbGluaycsIHNpbXBsZUxpbmspO1xuXHRcdFx0XHRsaW5rcy5wdXNoKHNpbXBsZUxpbmspO1xuXG5cdFx0XHRcdC8vIEJyZWFrIG9uIHRoZSBmaXJzdCBtYXRjaFxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobGlua3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG1hdGNoZXIgb2YgZ2l0RGlmZk1hdGNoZXJzKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gdGV4dC5tYXRjaChtYXRjaGVyKTtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBtYXRjaD8uZ3JvdXBzO1xuXHRcdFx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbGluayA9IGdyb3VwPy5saW5rO1xuXHRcdFx0XHRjb25zdCB0b0ZpbGVMaW5lID0gZ3JvdXA/LnRvRmlsZUxpbmU7XG5cdFx0XHRcdGNvbnN0IHRvRmlsZUNvdW50ID0gZ3JvdXA/LnRvRmlsZUNvdW50O1xuXHRcdFx0XHRpZiAoIWxpbmsgfHwgdG9GaWxlTGluZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBEb24ndCB0cnkgcmVzb2x2ZSBhbnkgbGlua3Mgb2YgZXhjZXNzaXZlIGxlbmd0aFxuXHRcdFx0XHRpZiAobGluay5sZW5ndGggPiBDb25zdGFudHMuTWF4UmVzb2x2ZWRMaW5rTGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCd0ZXJtaW5hbE11bHRpTGluZUxpbmtEZXRlY3RvciNkZXRlY3QgY2FuZGlkYXRlJywgbGluayk7XG5cblxuXHRcdFx0XHQvLyBTY2FuIHVwIGxvb2tpbmcgZm9yIHRoZSBmaXJzdCBsaW5lIHRoYXQgY291bGQgYmUgYSBwYXRoXG5cdFx0XHRcdGxldCBwb3NzaWJsZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdFx0Zm9yIChsZXQgaW5kZXggPSBzdGFydExpbmUgLSAxOyBpbmRleCA+PSAwOyBpbmRleC0tKSB7XG5cdFx0XHRcdFx0Ly8gSWdub3JlIGxpbmVzIHRoYXQgYXJlbid0IGF0IHRoZSBiZWdpbm5pbmcgb2YgYSB3cmFwcGVkIGxpbmVcblx0XHRcdFx0XHRpZiAodGhpcy54dGVybS5idWZmZXIuYWN0aXZlLmdldExpbmUoaW5kZXgpIS5pc1dyYXBwZWQpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCB0ZXh0ID0gZ2V0WHRlcm1MaW5lQ29udGVudCh0aGlzLnh0ZXJtLmJ1ZmZlci5hY3RpdmUsIGluZGV4LCBpbmRleCwgdGhpcy54dGVybS5jb2xzKTtcblx0XHRcdFx0XHRjb25zdCBtYXRjaCA9IHRleHQubWF0Y2goL1xcK1xcK1xcKyBiXFwvKD88cGF0aD4uKykvKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdHBvc3NpYmxlUGF0aCA9IG1hdGNoLmdyb3Vwcz8ucGF0aDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXBvc3NpYmxlUGF0aCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGZpcnN0IG5vbi1tYXRjaGluZyBsaW5lIGlzIGFuIGFic29sdXRlIG9yIHJlbGF0aXZlIGxpbmtcblx0XHRcdFx0Y29uc3QgbGlua1N0YXQgPSBhd2FpdCB0aGlzLl9saW5rUmVzb2x2ZXIucmVzb2x2ZUxpbmsodGhpcy5fcHJvY2Vzc01hbmFnZXIsIHBvc3NpYmxlUGF0aCk7XG5cdFx0XHRcdGlmIChsaW5rU3RhdCkge1xuXHRcdFx0XHRcdGxldCB0eXBlOiBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZTtcblx0XHRcdFx0XHRpZiAobGlua1N0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLl9pc0RpcmVjdG9yeUluc2lkZVdvcmtzcGFjZShsaW5rU3RhdC51cmkpKSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZS5Mb2NhbEZvbGRlckluV29ya3NwYWNlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRm9sZGVyT3V0c2lkZVdvcmtzcGFjZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dHlwZSA9IFRlcm1pbmFsQnVpbHRpbkxpbmtUeXBlLkxvY2FsRmlsZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBDb252ZXJ0IHRoZSBsaW5rIHRvIHRoZSBidWZmZXIgcmFuZ2Vcblx0XHRcdFx0XHRjb25zdCBidWZmZXJSYW5nZSA9IGNvbnZlcnRMaW5rUmFuZ2VUb0J1ZmZlcihsaW5lcywgdGhpcy54dGVybS5jb2xzLCB7XG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogMSArIGxpbmsubGVuZ3RoLFxuXHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogMVxuXHRcdFx0XHRcdH0sIHN0YXJ0TGluZSk7XG5cblx0XHRcdFx0XHRjb25zdCBzaW1wbGVMaW5rOiBJVGVybWluYWxTaW1wbGVMaW5rID0ge1xuXHRcdFx0XHRcdFx0dGV4dDogbGluayxcblx0XHRcdFx0XHRcdHVyaTogbGlua1N0YXQudXJpLFxuXHRcdFx0XHRcdFx0c2VsZWN0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogcGFyc2VJbnQodG9GaWxlTGluZSksXG5cdFx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBwYXJzZUludCh0b0ZpbGVMaW5lKSArIHBhcnNlSW50KHRvRmlsZUNvdW50KVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGJ1ZmZlclJhbmdlOiBidWZmZXJSYW5nZSxcblx0XHRcdFx0XHRcdHR5cGVcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ3Rlcm1pbmFsTXVsdGlMaW5lTGlua0RldGVjdG9yI2RldGVjdCB2ZXJpZmllZCBsaW5rJywgc2ltcGxlTGluayk7XG5cdFx0XHRcdFx0bGlua3MucHVzaChzaW1wbGVMaW5rKTtcblxuXHRcdFx0XHRcdC8vIEJyZWFrIG9uIHRoZSBmaXJzdCBtYXRjaFxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxpbmtzO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXJlY3RvcnlJbnNpZGVXb3Jrc3BhY2UodXJpOiBVUkkpIHtcblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZvbGRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGlmICh0aGlzLl91cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudCh1cmksIGZvbGRlcnNbaV0udXJpKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQTRFLCtCQUErQjtBQUMzRyxTQUFTLDBCQUEwQiwyQkFBMkI7QUFHOUQsU0FBMkIsMkJBQTJCO0FBRXRELElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUlDLEVBQUFBLHNCQUFBLG1CQUFnQixPQUFoQjtBQU1BLEVBQUFBLHNCQUFBLDJCQUF3QixRQUF4QjtBQVZVLFNBQUFBO0FBQUEsR0FBQTtBQWFYLE1BQU0sMkJBQTJCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVFoQztBQUNEO0FBRUEsTUFBTSxrQkFBa0I7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
