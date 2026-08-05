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
import { OS } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { TerminalBuiltinLinkType } from "./links.js";
import { convertLinkRangeToBuffer, getXtermLineContent, getXtermRangesByAttr, osPathModule, updateLinkWithRelativeCwd } from "./terminalLinkHelpers.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { detectLinks } from "./terminalLinkParsing.js";
import { ITerminalLogService } from "../../../../../platform/terminal/common/terminal.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["MaxLineLength"] = 2e3] = "MaxLineLength";
  Constants2[Constants2["MaxResolvedLinksInLine"] = 10] = "MaxResolvedLinksInLine";
  Constants2[Constants2["MaxResolvedLinkLength"] = 1024] = "MaxResolvedLinkLength";
  return Constants2;
})(Constants || {});
const fallbackMatchers = [
  // Python style error: File "<path>", line <line>
  /^ *File (?<link>"(?<path>.+)"(, line (?<line>\d+))?)/,
  // Unknown tool #200166: FILE  <path>:<line>:<col>
  /^ +FILE +(?<link>(?<path>.+)(?::(?<line>\d+)(?::(?<col>\d+))?)?)/,
  // Some C++ compile error formats:
  // C:\foo\bar baz(339) : error ...
  // C:\foo\bar baz(339,12) : error ...
  // C:\foo\bar baz(339, 12) : error ...
  // C:\foo\bar baz(339): error ...       [#178584, Visual Studio CL/NVIDIA CUDA compiler]
  // C:\foo\bar baz(339,12): ...
  // C:\foo\bar baz(339, 12): ...
  /^(?<link>(?<path>.+)\((?<line>\d+)(?:, ?(?<col>\d+))?\)) ?:/,
  // C:\foo/bar baz:339 : error ...
  // C:\foo/bar baz:339:12 : error ...
  // C:\foo/bar baz:339: error ...
  // C:\foo/bar baz:339:12: error ...     [#178584, Clang]
  /^(?<link>(?<path>.+):(?<line>\d+)(?::(?<col>\d+))?) ?:/,
  // Cmd prompt
  /^(?<link>(?<path>.+))>/,
  // The whole line is the path
  /^ *(?<link>(?<path>.+))/
];
let TerminalLocalLinkDetector = class {
  constructor(xterm, _capabilities, _processManager, _linkResolver, _logService, _uriIdentityService, _workspaceContextService) {
    this.xterm = xterm;
    this._capabilities = _capabilities;
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
    let stringIndex = -1;
    let resolvedLinkCount = 0;
    const os = this._processManager.os || OS;
    const parsedLinks = detectLinks(text, os);
    this._logService.trace("terminalLocalLinkDetector#detect text", text);
    this._logService.trace("terminalLocalLinkDetector#detect parsedLinks", parsedLinks);
    for (const parsedLink of parsedLinks) {
      if (parsedLink.path.text.length > 1024 /* MaxResolvedLinkLength */) {
        continue;
      }
      const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
        startColumn: (parsedLink.prefix?.index ?? parsedLink.path.index) + 1,
        startLineNumber: 1,
        endColumn: parsedLink.path.index + parsedLink.path.text.length + (parsedLink.suffix?.suffix.text.length ?? 0) + 1,
        endLineNumber: 1
      }, startLine);
      const linkCandidates = [];
      const osPath = osPathModule(os);
      const isUri = parsedLink.path.text.startsWith("file://");
      if (osPath.isAbsolute(parsedLink.path.text) || parsedLink.path.text.startsWith("~") || isUri) {
        linkCandidates.push(parsedLink.path.text);
      } else {
        if (this._capabilities.has(TerminalCapability.CommandDetection)) {
          const absolutePath = updateLinkWithRelativeCwd(this._capabilities, bufferRange.start.y, parsedLink.path.text, osPath, this._logService);
          if (absolutePath) {
            linkCandidates.push(...absolutePath);
          }
        }
        if (linkCandidates.length === 0) {
          linkCandidates.push(parsedLink.path.text);
          if (parsedLink.path.text.match(/^(\.\.[\/\\])+/)) {
            linkCandidates.push(parsedLink.path.text.replace(/^(\.\.[\/\\])+/, ""));
          }
        }
      }
      const specialEndCharRegex = /[\[\]"'\.]$/;
      const trimRangeMap = /* @__PURE__ */ new Map();
      const specialEndLinkCandidates = [];
      for (const candidate of linkCandidates) {
        let previous = candidate;
        let removed = previous.replace(specialEndCharRegex, "");
        let trimRange = 0;
        while (removed !== previous) {
          if (!parsedLink.suffix) {
            trimRange++;
          }
          specialEndLinkCandidates.push(removed);
          trimRangeMap.set(removed, trimRange);
          previous = removed;
          removed = removed.replace(specialEndCharRegex, "");
        }
      }
      linkCandidates.push(...specialEndLinkCandidates);
      this._logService.trace("terminalLocalLinkDetector#detect linkCandidates", linkCandidates);
      const simpleLink = await this._validateAndGetLink(void 0, bufferRange, linkCandidates, trimRangeMap);
      if (simpleLink) {
        simpleLink.parsedLink = parsedLink;
        simpleLink.text = text.substring(
          parsedLink.prefix?.index ?? parsedLink.path.index,
          parsedLink.suffix ? parsedLink.suffix.suffix.index + parsedLink.suffix.suffix.text.length : parsedLink.path.index + parsedLink.path.text.length
        );
        this._logService.trace("terminalLocalLinkDetector#detect verified link", simpleLink);
        links.push(simpleLink);
      }
      if (++resolvedLinkCount >= 10 /* MaxResolvedLinksInLine */) {
        break;
      }
    }
    if (links.length === 0) {
      for (const matcher of fallbackMatchers) {
        const match = text.match(matcher);
        const group = match?.groups;
        if (!group) {
          continue;
        }
        const link = group?.link;
        const path = group?.path;
        const line = group?.line;
        const col = group?.col;
        if (!link || !path) {
          continue;
        }
        if (link.length > 1024 /* MaxResolvedLinkLength */) {
          continue;
        }
        stringIndex = text.indexOf(link);
        const bufferRange = convertLinkRangeToBuffer(lines, this.xterm.cols, {
          startColumn: stringIndex + 1,
          startLineNumber: 1,
          endColumn: stringIndex + link.length + 1,
          endLineNumber: 1
        }, startLine);
        const suffix = line ? `:${line}${col ? `:${col}` : ""}` : "";
        const simpleLink = await this._validateAndGetLink(`${path}${suffix}`, bufferRange, [path]);
        if (simpleLink) {
          links.push(simpleLink);
        }
        break;
      }
    }
    if (links.length === 0) {
      const rangeCandidates = getXtermRangesByAttr(this.xterm.buffer.active, startLine, endLine, this.xterm.cols);
      for (const rangeCandidate of rangeCandidates) {
        let text2 = "";
        for (let y = rangeCandidate.start.y; y <= rangeCandidate.end.y; y++) {
          const line = this.xterm.buffer.active.getLine(y);
          if (!line) {
            break;
          }
          const lineStartX = y === rangeCandidate.start.y ? rangeCandidate.start.x : 0;
          const lineEndX = y === rangeCandidate.end.y ? rangeCandidate.end.x : this.xterm.cols - 1;
          text2 += line.translateToString(false, lineStartX, lineEndX);
        }
        rangeCandidate.start.x++;
        rangeCandidate.start.y++;
        rangeCandidate.end.y++;
        const simpleLink = await this._validateAndGetLink(text2, rangeCandidate, [text2]);
        if (simpleLink) {
          links.push(simpleLink);
        }
        if (++resolvedLinkCount >= 10 /* MaxResolvedLinksInLine */) {
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
  async _validateLinkCandidates(linkCandidates) {
    for (const link of linkCandidates) {
      let uri;
      if (link.startsWith("file://")) {
        uri = URI.parse(link);
      }
      const result = await this._linkResolver.resolveLink(this._processManager, link, uri);
      if (result) {
        return result;
      }
    }
    return void 0;
  }
  /**
   * Validates a set of link candidates and returns a link if validated.
   * @param linkText The link text, this should be undefined to use the link stat value
   * @param trimRangeMap A map of link candidates to the amount of buffer range they need trimmed.
   */
  async _validateAndGetLink(linkText, bufferRange, linkCandidates, trimRangeMap) {
    const linkStat = await this._validateLinkCandidates(linkCandidates);
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
      const trimRange = trimRangeMap?.get(linkStat.link);
      if (trimRange) {
        bufferRange.end.x -= trimRange;
        if (bufferRange.end.x < 0) {
          bufferRange.end.y--;
          bufferRange.end.x += this.xterm.cols;
        }
      }
      return {
        text: linkText ?? linkStat.link,
        uri: linkStat.uri,
        bufferRange,
        type
      };
    }
    return void 0;
  }
};
TerminalLocalLinkDetector.id = "local";
TerminalLocalLinkDetector = __decorateClass([
  __decorateParam(4, ITerminalLogService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IWorkspaceContextService)
], TerminalLocalLinkDetector);
export {
  TerminalLocalLinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExvY2FsTGlua0RldGVjdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxMaW5rRGV0ZWN0b3IsIElUZXJtaW5hbExpbmtSZXNvbHZlciwgSVRlcm1pbmFsU2ltcGxlTGluaywgUmVzb2x2ZWRMaW5rLCBUZXJtaW5hbEJ1aWx0aW5MaW5rVHlwZSB9IGZyb20gJy4vbGlua3MuanMnO1xuaW1wb3J0IHsgY29udmVydExpbmtSYW5nZVRvQnVmZmVyLCBnZXRYdGVybUxpbmVDb250ZW50LCBnZXRYdGVybVJhbmdlc0J5QXR0ciwgb3NQYXRoTW9kdWxlLCB1cGRhdGVMaW5rV2l0aFJlbGF0aXZlQ3dkIH0gZnJvbSAnLi90ZXJtaW5hbExpbmtIZWxwZXJzLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHR5cGUgeyBJQnVmZmVyTGluZSwgSUJ1ZmZlclJhbmdlLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9jZXNzTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBkZXRlY3RMaW5rcyB9IGZyb20gJy4vdGVybWluYWxMaW5rUGFyc2luZy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxCYWNrZW5kLCBJVGVybWluYWxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcblxuY29uc3QgZW51bSBDb25zdGFudHMge1xuXHQvKipcblx0ICogVGhlIG1heCBsaW5lIGxlbmd0aCB0byB0cnkgZXh0cmFjdCB3b3JkIGxpbmtzIGZyb20uXG5cdCAqL1xuXHRNYXhMaW5lTGVuZ3RoID0gMjAwMCxcblxuXHQvKipcblx0ICogVGhlIG1heGltdW0gbnVtYmVyIG9mIGxpbmtzIGluIGEgbGluZSB0byByZXNvbHZlIGFnYWluc3QgdGhlIGZpbGUgc3lzdGVtLiBUaGlzIGxpbWl0IGlzIHB1dFxuXHQgKiBpbiBwbGFjZSB0byBhdm9pZCBzZW5kaW5nIGV4Y2Vzc2l2ZSBkYXRhIHdoZW4gcmVtb3RlIGNvbm5lY3Rpb25zIGFyZSBpbiBwbGFjZS5cblx0ICovXG5cdE1heFJlc29sdmVkTGlua3NJbkxpbmUgPSAxMCxcblxuXHQvKipcblx0ICogVGhlIG1heGltdW0gbGVuZ3RoIG9mIGEgbGluayB0byByZXNvbHZlIGFnYWluc3QgdGhlIGZpbGUgc3lzdGVtLiBUaGlzIGxpbWl0IGlzIHB1dCBpbiBwbGFjZVxuXHQgKiB0byBhdm9pZCBzZW5kaW5nIGV4Y2Vzc2l2ZSBkYXRhIHdoZW4gcmVtb3RlIGNvbm5lY3Rpb25zIGFyZSBpbiBwbGFjZS5cblx0ICovXG5cdE1heFJlc29sdmVkTGlua0xlbmd0aCA9IDEwMjQsXG59XG5cbmNvbnN0IGZhbGxiYWNrTWF0Y2hlcnM6IFJlZ0V4cFtdID0gW1xuXHQvLyBQeXRob24gc3R5bGUgZXJyb3I6IEZpbGUgXCI8cGF0aD5cIiwgbGluZSA8bGluZT5cblx0L14gKkZpbGUgKD88bGluaz5cIig/PHBhdGg+LispXCIoLCBsaW5lICg/PGxpbmU+XFxkKykpPykvLFxuXHQvLyBVbmtub3duIHRvb2wgIzIwMDE2NjogRklMRSAgPHBhdGg+OjxsaW5lPjo8Y29sPlxuXHQvXiArRklMRSArKD88bGluaz4oPzxwYXRoPi4rKSg/OjooPzxsaW5lPlxcZCspKD86Oig/PGNvbD5cXGQrKSk/KT8pLyxcblx0Ly8gU29tZSBDKysgY29tcGlsZSBlcnJvciBmb3JtYXRzOlxuXHQvLyBDOlxcZm9vXFxiYXIgYmF6KDMzOSkgOiBlcnJvciAuLi5cblx0Ly8gQzpcXGZvb1xcYmFyIGJheigzMzksMTIpIDogZXJyb3IgLi4uXG5cdC8vIEM6XFxmb29cXGJhciBiYXooMzM5LCAxMikgOiBlcnJvciAuLi5cblx0Ly8gQzpcXGZvb1xcYmFyIGJheigzMzkpOiBlcnJvciAuLi4gICAgICAgWyMxNzg1ODQsIFZpc3VhbCBTdHVkaW8gQ0wvTlZJRElBIENVREEgY29tcGlsZXJdXG5cdC8vIEM6XFxmb29cXGJhciBiYXooMzM5LDEyKTogLi4uXG5cdC8vIEM6XFxmb29cXGJhciBiYXooMzM5LCAxMik6IC4uLlxuXHQvXig/PGxpbms+KD88cGF0aD4uKylcXCgoPzxsaW5lPlxcZCspKD86LCA/KD88Y29sPlxcZCspKT9cXCkpID86Lyxcblx0Ly8gQzpcXGZvby9iYXIgYmF6OjMzOSA6IGVycm9yIC4uLlxuXHQvLyBDOlxcZm9vL2JhciBiYXo6MzM5OjEyIDogZXJyb3IgLi4uXG5cdC8vIEM6XFxmb28vYmFyIGJhejozMzk6IGVycm9yIC4uLlxuXHQvLyBDOlxcZm9vL2JhciBiYXo6MzM5OjEyOiBlcnJvciAuLi4gICAgIFsjMTc4NTg0LCBDbGFuZ11cblx0L14oPzxsaW5rPig/PHBhdGg+LispOig/PGxpbmU+XFxkKykoPzo6KD88Y29sPlxcZCspKT8pID86Lyxcblx0Ly8gQ21kIHByb21wdFxuXHQvXig/PGxpbms+KD88cGF0aD4uKykpPi8sXG5cdC8vIFRoZSB3aG9sZSBsaW5lIGlzIHRoZSBwYXRoXG5cdC9eICooPzxsaW5rPig/PHBhdGg+LispKS9cbl07XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExvY2FsTGlua0RldGVjdG9yIGltcGxlbWVudHMgSVRlcm1pbmFsTGlua0RldGVjdG9yIHtcblx0c3RhdGljIGlkID0gJ2xvY2FsJztcblxuXHQvLyBUaGlzIHdhcyBjaG9zZW4gYXMgYSByZWFzb25hYmxlIG1heGltdW0gbGluZSBsZW5ndGggZ2l2ZW4gdGhlIHRyYWRlb2ZmIGJldHdlZW4gcGVyZm9ybWFuY2Vcblx0Ly8gYW5kIGhvdyBsaWtlbHkgaXQgaXMgdG8gZW5jb3VudGVyIHN1Y2ggYSBsYXJnZSBsaW5lIGxlbmd0aC4gU29tZSB1c2VmdWwgcmVmZXJlbmNlIHBvaW50czpcblx0Ly8gLSBXaW5kb3cgb2xkIG1heCBsZW5ndGg6IDI2MCAoJE1BWF9QQVRIKVxuXHQvLyAtIExpbnV4IG1heCBsZW5ndGg6IDQwOTYgKCRQQVRIX01BWClcblx0cmVhZG9ubHkgbWF4TGlua0xlbmd0aCA9IDUwMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB4dGVybTogVGVybWluYWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvY2Vzc01hbmFnZXI6IFBpY2s8SVRlcm1pbmFsUHJvY2Vzc01hbmFnZXIsICdpbml0aWFsQ3dkJyB8ICdvcycgfCAncmVtb3RlQXV0aG9yaXR5JyB8ICd1c2VySG9tZSc+ICYgeyBiYWNrZW5kPzogUGljazxJVGVybWluYWxCYWNrZW5kLCAnZ2V0V3NsUGF0aCc+IH0sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGlua1Jlc29sdmVyOiBJVGVybWluYWxMaW5rUmVzb2x2ZXIsXG5cdFx0QElUZXJtaW5hbExvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSVRlcm1pbmFsTG9nU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlXG5cdCkge1xuXHR9XG5cblx0YXN5bmMgZGV0ZWN0KGxpbmVzOiBJQnVmZmVyTGluZVtdLCBzdGFydExpbmU6IG51bWJlciwgZW5kTGluZTogbnVtYmVyKTogUHJvbWlzZTxJVGVybWluYWxTaW1wbGVMaW5rW10+IHtcblx0XHRjb25zdCBsaW5rczogSVRlcm1pbmFsU2ltcGxlTGlua1tdID0gW107XG5cblx0XHQvLyBHZXQgdGhlIHRleHQgcmVwcmVzZW50YXRpb24gb2YgdGhlIHdyYXBwZWQgbGluZVxuXHRcdGNvbnN0IHRleHQgPSBnZXRYdGVybUxpbmVDb250ZW50KHRoaXMueHRlcm0uYnVmZmVyLmFjdGl2ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLCB0aGlzLnh0ZXJtLmNvbHMpO1xuXHRcdGlmICh0ZXh0ID09PSAnJyB8fCB0ZXh0Lmxlbmd0aCA+IENvbnN0YW50cy5NYXhMaW5lTGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0bGV0IHN0cmluZ0luZGV4ID0gLTE7XG5cdFx0bGV0IHJlc29sdmVkTGlua0NvdW50ID0gMDtcblxuXHRcdGNvbnN0IG9zID0gdGhpcy5fcHJvY2Vzc01hbmFnZXIub3MgfHwgT1M7XG5cdFx0Y29uc3QgcGFyc2VkTGlua3MgPSBkZXRlY3RMaW5rcyh0ZXh0LCBvcyk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgndGVybWluYWxMb2NhbExpbmtEZXRlY3RvciNkZXRlY3QgdGV4dCcsIHRleHQpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ3Rlcm1pbmFsTG9jYWxMaW5rRGV0ZWN0b3IjZGV0ZWN0IHBhcnNlZExpbmtzJywgcGFyc2VkTGlua3MpO1xuXHRcdGZvciAoY29uc3QgcGFyc2VkTGluayBvZiBwYXJzZWRMaW5rcykge1xuXG5cdFx0XHQvLyBEb24ndCB0cnkgcmVzb2x2ZSBhbnkgbGlua3Mgb2YgZXhjZXNzaXZlIGxlbmd0aFxuXHRcdFx0aWYgKHBhcnNlZExpbmsucGF0aC50ZXh0Lmxlbmd0aCA+IENvbnN0YW50cy5NYXhSZXNvbHZlZExpbmtMZW5ndGgpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbnZlcnQgdGhlIGxpbmsgdGV4dCdzIHN0cmluZyBpbmRleCBpbnRvIGEgd3JhcHBlZCBidWZmZXIgcmFuZ2Vcblx0XHRcdGNvbnN0IGJ1ZmZlclJhbmdlID0gY29udmVydExpbmtSYW5nZVRvQnVmZmVyKGxpbmVzLCB0aGlzLnh0ZXJtLmNvbHMsIHtcblx0XHRcdFx0c3RhcnRDb2x1bW46IChwYXJzZWRMaW5rLnByZWZpeD8uaW5kZXggPz8gcGFyc2VkTGluay5wYXRoLmluZGV4KSArIDEsXG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiBwYXJzZWRMaW5rLnBhdGguaW5kZXggKyBwYXJzZWRMaW5rLnBhdGgudGV4dC5sZW5ndGggKyAocGFyc2VkTGluay5zdWZmaXg/LnN1ZmZpeC50ZXh0Lmxlbmd0aCA/PyAwKSArIDEsXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IDFcblx0XHRcdH0sIHN0YXJ0TGluZSk7XG5cblx0XHRcdC8vIEdldCBhIHNpbmdsZSBsaW5rIGNhbmRpZGF0ZSBpZiB0aGUgY3dkIG9mIHRoZSBsaW5lIGlzIGtub3duXG5cdFx0XHRjb25zdCBsaW5rQ2FuZGlkYXRlczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGNvbnN0IG9zUGF0aCA9IG9zUGF0aE1vZHVsZShvcyk7XG5cdFx0XHRjb25zdCBpc1VyaSA9IHBhcnNlZExpbmsucGF0aC50ZXh0LnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKTtcblx0XHRcdGlmIChvc1BhdGguaXNBYnNvbHV0ZShwYXJzZWRMaW5rLnBhdGgudGV4dCkgfHwgcGFyc2VkTGluay5wYXRoLnRleHQuc3RhcnRzV2l0aCgnficpIHx8IGlzVXJpKSB7XG5cdFx0XHRcdGxpbmtDYW5kaWRhdGVzLnB1c2gocGFyc2VkTGluay5wYXRoLnRleHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRoaXMuX2NhcGFiaWxpdGllcy5oYXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWJzb2x1dGVQYXRoID0gdXBkYXRlTGlua1dpdGhSZWxhdGl2ZUN3ZCh0aGlzLl9jYXBhYmlsaXRpZXMsIGJ1ZmZlclJhbmdlLnN0YXJ0LnksIHBhcnNlZExpbmsucGF0aC50ZXh0LCBvc1BhdGgsIHRoaXMuX2xvZ1NlcnZpY2UpO1xuXHRcdFx0XHRcdC8vIE9ubHkgYWRkIGEgc2luZ2xlIGV4YWN0IGxpbmsgY2FuZGlkYXRlIGlmIHRoZSBjd2QgaXMgYXZhaWxhYmxlLCB0aGlzIG1heSBjYXVzZVxuXHRcdFx0XHRcdC8vIHRoZSBsaW5rIHRvIG5vdCBiZSByZXNvbHZlZCBidXQgdGhhdCBzaG91bGQgb25seSBvY2N1ciB3aGVuIHRoZSBhY3R1YWwgZmlsZSBkb2VzXG5cdFx0XHRcdFx0Ly8gbm90IGV4aXN0LiBEb2luZyBvdGhlcndpc2UgY291bGQgY2F1c2UgdW5leHBlY3RlZCByZXN1bHRzIHdoZXJlIGhhbmRsaW5nIHZpYSB0aGVcblx0XHRcdFx0XHQvLyB3b3JkIGxpbmsgZGV0ZWN0b3IgaXMgcHJlZmVyYWJsZS5cblx0XHRcdFx0XHRpZiAoYWJzb2x1dGVQYXRoKSB7XG5cdFx0XHRcdFx0XHRsaW5rQ2FuZGlkYXRlcy5wdXNoKC4uLmFic29sdXRlUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIEZhbGxiYWNrIHRvIHJlc29sdmluZyBhZ2FpbnN0IHRoZSBpbml0aWFsIGN3ZCwgcmVtb3ZpbmcgYW55IHJlbGF0aXZlIGRpcmVjdG9yeSBwcmVmaXhlc1xuXHRcdFx0XHRpZiAobGlua0NhbmRpZGF0ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0bGlua0NhbmRpZGF0ZXMucHVzaChwYXJzZWRMaW5rLnBhdGgudGV4dCk7XG5cdFx0XHRcdFx0aWYgKHBhcnNlZExpbmsucGF0aC50ZXh0Lm1hdGNoKC9eKFxcLlxcLltcXC9cXFxcXSkrLykpIHtcblx0XHRcdFx0XHRcdGxpbmtDYW5kaWRhdGVzLnB1c2gocGFyc2VkTGluay5wYXRoLnRleHQucmVwbGFjZSgvXihcXC5cXC5bXFwvXFxcXF0pKy8sICcnKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGFueSBjYW5kaWRhdGVzIGVuZCB3aXRoIHNwZWNpYWwgY2hhcmFjdGVycyB0aGF0IGFyZSBsaWtlbHkgdG8gbm90IGJlIHBhcnQgb2YgdGhlXG5cdFx0XHQvLyBsaW5rLCBhZGQgYSBjYW5kaWRhdGUgZXhjbHVkaW5nIHRoZW0uXG5cdFx0XHRjb25zdCBzcGVjaWFsRW5kQ2hhclJlZ2V4ID0gL1tcXFtcXF1cIidcXC5dJC87XG5cdFx0XHRjb25zdCB0cmltUmFuZ2VNYXA6IE1hcDxzdHJpbmcsIG51bWJlcj4gPSBuZXcgTWFwKCk7XG5cdFx0XHRjb25zdCBzcGVjaWFsRW5kTGlua0NhbmRpZGF0ZXM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBsaW5rQ2FuZGlkYXRlcykge1xuXHRcdFx0XHRsZXQgcHJldmlvdXMgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdGxldCByZW1vdmVkID0gcHJldmlvdXMucmVwbGFjZShzcGVjaWFsRW5kQ2hhclJlZ2V4LCAnJyk7XG5cdFx0XHRcdGxldCB0cmltUmFuZ2UgPSAwO1xuXHRcdFx0XHR3aGlsZSAocmVtb3ZlZCAhPT0gcHJldmlvdXMpIHtcblx0XHRcdFx0XHQvLyBPbmx5IHRyaW0gdGhlIGxpbmsgaWYgdGhlcmUgaXMgbm8gc3VmZml4LCBvdGhlcndpc2UgdGhlIHVuZGVybGluZSB3b3VsZCBiZSBpbmNvcnJlY3Rcblx0XHRcdFx0XHRpZiAoIXBhcnNlZExpbmsuc3VmZml4KSB7XG5cdFx0XHRcdFx0XHR0cmltUmFuZ2UrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c3BlY2lhbEVuZExpbmtDYW5kaWRhdGVzLnB1c2gocmVtb3ZlZCk7XG5cdFx0XHRcdFx0dHJpbVJhbmdlTWFwLnNldChyZW1vdmVkLCB0cmltUmFuZ2UpO1xuXHRcdFx0XHRcdHByZXZpb3VzID0gcmVtb3ZlZDtcblx0XHRcdFx0XHRyZW1vdmVkID0gcmVtb3ZlZC5yZXBsYWNlKHNwZWNpYWxFbmRDaGFyUmVnZXgsICcnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bGlua0NhbmRpZGF0ZXMucHVzaCguLi5zcGVjaWFsRW5kTGlua0NhbmRpZGF0ZXMpO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgndGVybWluYWxMb2NhbExpbmtEZXRlY3RvciNkZXRlY3QgbGlua0NhbmRpZGF0ZXMnLCBsaW5rQ2FuZGlkYXRlcyk7XG5cblx0XHRcdC8vIFZhbGlkYXRlIHRoZSBwYXRoIGFuZCBjb252ZXJ0IHRvIHRoZSBvdXRnb2luZyB0eXBlXG5cdFx0XHRjb25zdCBzaW1wbGVMaW5rID0gYXdhaXQgdGhpcy5fdmFsaWRhdGVBbmRHZXRMaW5rKHVuZGVmaW5lZCwgYnVmZmVyUmFuZ2UsIGxpbmtDYW5kaWRhdGVzLCB0cmltUmFuZ2VNYXApO1xuXHRcdFx0aWYgKHNpbXBsZUxpbmspIHtcblx0XHRcdFx0c2ltcGxlTGluay5wYXJzZWRMaW5rID0gcGFyc2VkTGluaztcblx0XHRcdFx0c2ltcGxlTGluay50ZXh0ID0gdGV4dC5zdWJzdHJpbmcoXG5cdFx0XHRcdFx0cGFyc2VkTGluay5wcmVmaXg/LmluZGV4ID8/IHBhcnNlZExpbmsucGF0aC5pbmRleCxcblx0XHRcdFx0XHRwYXJzZWRMaW5rLnN1ZmZpeCA/IHBhcnNlZExpbmsuc3VmZml4LnN1ZmZpeC5pbmRleCArIHBhcnNlZExpbmsuc3VmZml4LnN1ZmZpeC50ZXh0Lmxlbmd0aCA6IHBhcnNlZExpbmsucGF0aC5pbmRleCArIHBhcnNlZExpbmsucGF0aC50ZXh0Lmxlbmd0aFxuXHRcdFx0XHQpO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCd0ZXJtaW5hbExvY2FsTGlua0RldGVjdG9yI2RldGVjdCB2ZXJpZmllZCBsaW5rJywgc2ltcGxlTGluayk7XG5cdFx0XHRcdGxpbmtzLnB1c2goc2ltcGxlTGluayk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN0b3AgZWFybHkgaWYgdG9vIG1hbnkgbGlua3MgZXhpc3QgaW4gdGhlIGxpbmVcblx0XHRcdGlmICgrK3Jlc29sdmVkTGlua0NvdW50ID49IENvbnN0YW50cy5NYXhSZXNvbHZlZExpbmtzSW5MaW5lKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIE1hdGNoIGFnYWluc3QgdGhlIGZhbGxiYWNrIG1hdGNoZXJzIHdoaWNoIGFyZSBtYWlubHkgZGVzaWduZWQgdG8gY2F0Y2ggcGF0aHMgd2l0aCBzcGFjZXNcblx0XHQvLyB0aGF0IGFyZW4ndCBwb3NzaWJsZSB1c2luZyB0aGUgcmVndWxhciBtZWNoYW5pc20uXG5cdFx0aWYgKGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Zm9yIChjb25zdCBtYXRjaGVyIG9mIGZhbGxiYWNrTWF0Y2hlcnMpIHtcblx0XHRcdFx0Y29uc3QgbWF0Y2ggPSB0ZXh0Lm1hdGNoKG1hdGNoZXIpO1xuXHRcdFx0XHRjb25zdCBncm91cCA9IG1hdGNoPy5ncm91cHM7XG5cdFx0XHRcdGlmICghZ3JvdXApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBsaW5rID0gZ3JvdXA/Lmxpbms7XG5cdFx0XHRcdGNvbnN0IHBhdGggPSBncm91cD8ucGF0aDtcblx0XHRcdFx0Y29uc3QgbGluZSA9IGdyb3VwPy5saW5lO1xuXHRcdFx0XHRjb25zdCBjb2wgPSBncm91cD8uY29sO1xuXHRcdFx0XHRpZiAoIWxpbmsgfHwgIXBhdGgpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERvbid0IHRyeSByZXNvbHZlIGFueSBsaW5rcyBvZiBleGNlc3NpdmUgbGVuZ3RoXG5cdFx0XHRcdGlmIChsaW5rLmxlbmd0aCA+IENvbnN0YW50cy5NYXhSZXNvbHZlZExpbmtMZW5ndGgpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENvbnZlcnQgdGhlIGxpbmsgdGV4dCdzIHN0cmluZyBpbmRleCBpbnRvIGEgd3JhcHBlZCBidWZmZXIgcmFuZ2Vcblx0XHRcdFx0c3RyaW5nSW5kZXggPSB0ZXh0LmluZGV4T2YobGluayk7XG5cdFx0XHRcdGNvbnN0IGJ1ZmZlclJhbmdlID0gY29udmVydExpbmtSYW5nZVRvQnVmZmVyKGxpbmVzLCB0aGlzLnh0ZXJtLmNvbHMsIHtcblx0XHRcdFx0XHRzdGFydENvbHVtbjogc3RyaW5nSW5kZXggKyAxLFxuXHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRlbmRDb2x1bW46IHN0cmluZ0luZGV4ICsgbGluay5sZW5ndGggKyAxLFxuXHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDFcblx0XHRcdFx0fSwgc3RhcnRMaW5lKTtcblxuXHRcdFx0XHQvLyBWYWxpZGF0ZSBhbmQgYWRkIGxpbmtcblx0XHRcdFx0Y29uc3Qgc3VmZml4ID0gbGluZSA/IGA6JHtsaW5lfSR7Y29sID8gYDoke2NvbH1gIDogJyd9YCA6ICcnO1xuXHRcdFx0XHRjb25zdCBzaW1wbGVMaW5rID0gYXdhaXQgdGhpcy5fdmFsaWRhdGVBbmRHZXRMaW5rKGAke3BhdGh9JHtzdWZmaXh9YCwgYnVmZmVyUmFuZ2UsIFtwYXRoXSk7XG5cdFx0XHRcdGlmIChzaW1wbGVMaW5rKSB7XG5cdFx0XHRcdFx0bGlua3MucHVzaChzaW1wbGVMaW5rKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE9ubHkgbWF0Y2ggYSBzaW5nbGUgZmFsbGJhY2sgbWF0Y2hlclxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTb21ldGltZXMgbGlua3MgYXJlIHN0eWxlZCBzcGVjaWFsbHkgaW4gdGhlIHRlcm1pbmFsIGxpa2UgdW5kZXJsaW5lZCBvciBib2xkZWQsIHRyeSBzcGxpdFxuXHRcdC8vIHRoZSBsaW5lIGJ5IGF0dHJpYnV0ZXMgYW5kIHRlc3Qgd2hldGhlciBpdCBtYXRjaGVzIGEgcGF0aFxuXHRcdGlmIChsaW5rcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGNvbnN0IHJhbmdlQ2FuZGlkYXRlcyA9IGdldFh0ZXJtUmFuZ2VzQnlBdHRyKHRoaXMueHRlcm0uYnVmZmVyLmFjdGl2ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLCB0aGlzLnh0ZXJtLmNvbHMpO1xuXHRcdFx0Zm9yIChjb25zdCByYW5nZUNhbmRpZGF0ZSBvZiByYW5nZUNhbmRpZGF0ZXMpIHtcblx0XHRcdFx0bGV0IHRleHQgPSAnJztcblx0XHRcdFx0Zm9yIChsZXQgeSA9IHJhbmdlQ2FuZGlkYXRlLnN0YXJ0Lnk7IHkgPD0gcmFuZ2VDYW5kaWRhdGUuZW5kLnk7IHkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGxpbmUgPSB0aGlzLnh0ZXJtLmJ1ZmZlci5hY3RpdmUuZ2V0TGluZSh5KTtcblx0XHRcdFx0XHRpZiAoIWxpbmUpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBsaW5lU3RhcnRYID0geSA9PT0gcmFuZ2VDYW5kaWRhdGUuc3RhcnQueSA/IHJhbmdlQ2FuZGlkYXRlLnN0YXJ0LnggOiAwO1xuXHRcdFx0XHRcdGNvbnN0IGxpbmVFbmRYID0geSA9PT0gcmFuZ2VDYW5kaWRhdGUuZW5kLnkgPyByYW5nZUNhbmRpZGF0ZS5lbmQueCA6IHRoaXMueHRlcm0uY29scyAtIDE7XG5cdFx0XHRcdFx0dGV4dCArPSBsaW5lLnRyYW5zbGF0ZVRvU3RyaW5nKGZhbHNlLCBsaW5lU3RhcnRYLCBsaW5lRW5kWCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBIQUNLOiBBZGp1c3QgdG8gMS1iYXNlZCBmb3IgbGluayBBUElcblx0XHRcdFx0cmFuZ2VDYW5kaWRhdGUuc3RhcnQueCsrO1xuXHRcdFx0XHRyYW5nZUNhbmRpZGF0ZS5zdGFydC55Kys7XG5cdFx0XHRcdHJhbmdlQ2FuZGlkYXRlLmVuZC55Kys7XG5cblx0XHRcdFx0Ly8gVmFsaWRhdGUgYW5kIGFkZCBsaW5rXG5cdFx0XHRcdGNvbnN0IHNpbXBsZUxpbmsgPSBhd2FpdCB0aGlzLl92YWxpZGF0ZUFuZEdldExpbmsodGV4dCwgcmFuZ2VDYW5kaWRhdGUsIFt0ZXh0XSk7XG5cdFx0XHRcdGlmIChzaW1wbGVMaW5rKSB7XG5cdFx0XHRcdFx0bGlua3MucHVzaChzaW1wbGVMaW5rKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFN0b3AgZWFybHkgaWYgdG9vIG1hbnkgbGlua3MgZXhpc3QgaW4gdGhlIGxpbmVcblx0XHRcdFx0aWYgKCsrcmVzb2x2ZWRMaW5rQ291bnQgPj0gQ29uc3RhbnRzLk1heFJlc29sdmVkTGlua3NJbkxpbmUpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBsaW5rcztcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlyZWN0b3J5SW5zaWRlV29ya3NwYWNlKHVyaTogVVJJKSB7XG5cdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5fdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQodXJpLCBmb2xkZXJzW2ldLnVyaSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3ZhbGlkYXRlTGlua0NhbmRpZGF0ZXMobGlua0NhbmRpZGF0ZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxSZXNvbHZlZExpbmsgfCB1bmRlZmluZWQ+IHtcblx0XHRmb3IgKGNvbnN0IGxpbmsgb2YgbGlua0NhbmRpZGF0ZXMpIHtcblx0XHRcdGxldCB1cmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChsaW5rLnN0YXJ0c1dpdGgoJ2ZpbGU6Ly8nKSkge1xuXHRcdFx0XHR1cmkgPSBVUkkucGFyc2UobGluayk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9saW5rUmVzb2x2ZXIucmVzb2x2ZUxpbmsodGhpcy5fcHJvY2Vzc01hbmFnZXIsIGxpbmssIHVyaSk7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogVmFsaWRhdGVzIGEgc2V0IG9mIGxpbmsgY2FuZGlkYXRlcyBhbmQgcmV0dXJucyBhIGxpbmsgaWYgdmFsaWRhdGVkLlxuXHQgKiBAcGFyYW0gbGlua1RleHQgVGhlIGxpbmsgdGV4dCwgdGhpcyBzaG91bGQgYmUgdW5kZWZpbmVkIHRvIHVzZSB0aGUgbGluayBzdGF0IHZhbHVlXG5cdCAqIEBwYXJhbSB0cmltUmFuZ2VNYXAgQSBtYXAgb2YgbGluayBjYW5kaWRhdGVzIHRvIHRoZSBhbW91bnQgb2YgYnVmZmVyIHJhbmdlIHRoZXkgbmVlZCB0cmltbWVkLlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBfdmFsaWRhdGVBbmRHZXRMaW5rKGxpbmtUZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQsIGJ1ZmZlclJhbmdlOiBJQnVmZmVyUmFuZ2UsIGxpbmtDYW5kaWRhdGVzOiBzdHJpbmdbXSwgdHJpbVJhbmdlTWFwPzogTWFwPHN0cmluZywgbnVtYmVyPik6IFByb21pc2U8SVRlcm1pbmFsU2ltcGxlTGluayB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGxpbmtTdGF0ID0gYXdhaXQgdGhpcy5fdmFsaWRhdGVMaW5rQ2FuZGlkYXRlcyhsaW5rQ2FuZGlkYXRlcyk7XG5cdFx0aWYgKGxpbmtTdGF0KSB7XG5cdFx0XHRsZXQgdHlwZTogVGVybWluYWxCdWlsdGluTGlua1R5cGU7XG5cdFx0XHRpZiAobGlua1N0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2lzRGlyZWN0b3J5SW5zaWRlV29ya3NwYWNlKGxpbmtTdGF0LnVyaSkpIHtcblx0XHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGb2xkZXJJbldvcmtzcGFjZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGb2xkZXJPdXRzaWRlV29ya3NwYWNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0eXBlID0gVGVybWluYWxCdWlsdGluTGlua1R5cGUuTG9jYWxGaWxlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPZmZzZXQgdGhlIGJ1ZmZlciByYW5nZSBpZiB0aGUgbGluayByYW5nZSB3YXMgdHJpbW1lZFxuXHRcdFx0Y29uc3QgdHJpbVJhbmdlID0gdHJpbVJhbmdlTWFwPy5nZXQobGlua1N0YXQubGluayk7XG5cdFx0XHRpZiAodHJpbVJhbmdlKSB7XG5cdFx0XHRcdGJ1ZmZlclJhbmdlLmVuZC54IC09IHRyaW1SYW5nZTtcblx0XHRcdFx0aWYgKGJ1ZmZlclJhbmdlLmVuZC54IDwgMCkge1xuXHRcdFx0XHRcdGJ1ZmZlclJhbmdlLmVuZC55LS07XG5cdFx0XHRcdFx0YnVmZmVyUmFuZ2UuZW5kLnggKz0gdGhpcy54dGVybS5jb2xzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHRleHQ6IGxpbmtUZXh0ID8/IGxpbmtTdGF0LmxpbmssXG5cdFx0XHRcdHVyaTogbGlua1N0YXQudXJpLFxuXHRcdFx0XHRidWZmZXJSYW5nZTogYnVmZmVyUmFuZ2UsXG5cdFx0XHRcdHR5cGVcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVO0FBQ25CLFNBQVMsV0FBVztBQUNwQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdDQUFnQztBQUN6QyxTQUEwRiwrQkFBK0I7QUFDekgsU0FBUywwQkFBMEIscUJBQXFCLHNCQUFzQixjQUFjLGlDQUFpQztBQUM3SCxTQUFtQywwQkFBMEI7QUFHN0QsU0FBUyxtQkFBbUI7QUFDNUIsU0FBMkIsMkJBQTJCO0FBRXRELElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUlDLEVBQUFBLHNCQUFBLG1CQUFnQixPQUFoQjtBQU1BLEVBQUFBLHNCQUFBLDRCQUF5QixNQUF6QjtBQU1BLEVB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
