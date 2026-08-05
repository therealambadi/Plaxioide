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
import { removeLinkSuffix, removeLinkQueryString, winDrivePrefix } from "./terminalLinkParsing.js";
import { URI } from "../../../../../base/common/uri.js";
import { Schemas } from "../../../../../base/common/network.js";
import { isWindows, OperatingSystem, OS } from "../../../../../base/common/platform.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { posix, win32 } from "../../../../../base/common/path.js";
import { mainWindow } from "../../../../../base/browser/window.js";
let TerminalLinkResolver = class {
  constructor(_fileService) {
    this._fileService = _fileService;
    // Link cache could be shared across all terminals, but that could lead to weird results when
    // both local and remote terminals are present
    this._resolvedLinkCaches = /* @__PURE__ */ new Map();
  }
  async resolveLink(processManager, link, uri) {
    if (uri && uri.scheme === Schemas.file && processManager.remoteAuthority) {
      uri = uri.with({
        scheme: Schemas.vscodeRemote,
        authority: processManager.remoteAuthority
      });
    }
    let cache = this._resolvedLinkCaches.get(processManager.remoteAuthority ?? "");
    if (!cache) {
      cache = new LinkCache();
      this._resolvedLinkCaches.set(processManager.remoteAuthority ?? "", cache);
    }
    const cached = cache.get(uri || link);
    if (cached !== void 0) {
      return cached;
    }
    if (uri) {
      try {
        const stat = await this._fileService.stat(uri);
        const result = { uri, link, isDirectory: stat.isDirectory };
        cache.set(uri, result);
        return result;
      } catch (e) {
        cache.set(uri, null);
        return null;
      }
    }
    let linkUrl = removeLinkSuffix(link);
    linkUrl = removeLinkQueryString(linkUrl);
    if (linkUrl.length === 0) {
      cache.set(link, null);
      return null;
    }
    if (isWindows && link.match(/^\/mnt\/[a-z]/i) && processManager.backend) {
      linkUrl = await processManager.backend.getWslPath(linkUrl, "unix-to-win");
    } else if (isWindows && link.match(/^(?:\/\/|\\\\)wsl(?:\$|\.localhost)(\/|\\)/)) {
    } else {
      const preprocessedLink = this._preprocessPath(linkUrl, processManager.initialCwd, processManager.os, processManager.userHome);
      if (!preprocessedLink) {
        cache.set(link, null);
        return null;
      }
      linkUrl = preprocessedLink;
    }
    try {
      let uri2;
      if (processManager.remoteAuthority) {
        uri2 = URI.from({
          scheme: Schemas.vscodeRemote,
          authority: processManager.remoteAuthority,
          path: linkUrl
        });
      } else {
        uri2 = URI.file(linkUrl);
      }
      try {
        const stat = await this._fileService.stat(uri2);
        const result = { uri: uri2, link, isDirectory: stat.isDirectory };
        cache.set(link, result);
        return result;
      } catch (e) {
        cache.set(link, null);
        return null;
      }
    } catch {
      cache.set(link, null);
      return null;
    }
  }
  _preprocessPath(link, initialCwd, os, userHome) {
    const osPath = this._getOsPath(os);
    if (link.charAt(0) === "~") {
      if (!userHome) {
        return null;
      }
      link = osPath.join(userHome, link.substring(1));
    } else if (link.charAt(0) !== "/" && link.charAt(0) !== "~") {
      if (os === OperatingSystem.Windows) {
        if (!link.match("^" + winDrivePrefix) && !link.startsWith("\\\\?\\")) {
          if (!initialCwd) {
            return null;
          }
          link = osPath.join(initialCwd, link);
        } else {
          link = link.replace(/^\\\\\?\\/, "");
        }
      } else {
        if (!initialCwd) {
          return null;
        }
        link = osPath.join(initialCwd, link);
      }
    }
    link = osPath.normalize(link);
    return link;
  }
  _getOsPath(os) {
    return (os ?? OS) === OperatingSystem.Windows ? win32 : posix;
  }
};
TerminalLinkResolver = __decorateClass([
  __decorateParam(0, IFileService)
], TerminalLinkResolver);
var LinkCacheConstants = /* @__PURE__ */ ((LinkCacheConstants2) => {
  LinkCacheConstants2[LinkCacheConstants2["TTL"] = 1e4] = "TTL";
  return LinkCacheConstants2;
})(LinkCacheConstants || {});
class LinkCache {
  constructor() {
    this._cache = /* @__PURE__ */ new Map();
    this._cacheTilTimeout = 0;
  }
  set(link, value) {
    if (this._cacheTilTimeout) {
      mainWindow.clearTimeout(this._cacheTilTimeout);
    }
    this._cacheTilTimeout = mainWindow.setTimeout(() => this._cache.clear(), 1e4 /* TTL */);
    this._cache.set(this._getKey(link), value);
  }
  get(link) {
    return this._cache.get(this._getKey(link));
  }
  _getKey(link) {
    if (URI.isUri(link)) {
      return link.toString();
    }
    return link;
  }
}
export {
  TerminalLinkResolver
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci90ZXJtaW5hbExpbmtSZXNvbHZlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElUZXJtaW5hbExpbmtSZXNvbHZlciwgUmVzb2x2ZWRMaW5rIH0gZnJvbSAnLi9saW5rcy5qcyc7XG5pbXBvcnQgeyByZW1vdmVMaW5rU3VmZml4LCByZW1vdmVMaW5rUXVlcnlTdHJpbmcsIHdpbkRyaXZlUHJlZml4IH0gZnJvbSAnLi90ZXJtaW5hbExpbmtQYXJzaW5nLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9jZXNzTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSwgT1MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVBhdGgsIHBvc2l4LCB3aW4zMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQmFja2VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbExpbmtSZXNvbHZlciBpbXBsZW1lbnRzIElUZXJtaW5hbExpbmtSZXNvbHZlciB7XG5cdC8vIExpbmsgY2FjaGUgY291bGQgYmUgc2hhcmVkIGFjcm9zcyBhbGwgdGVybWluYWxzLCBidXQgdGhhdCBjb3VsZCBsZWFkIHRvIHdlaXJkIHJlc3VsdHMgd2hlblxuXHQvLyBib3RoIGxvY2FsIGFuZCByZW1vdGUgdGVybWluYWxzIGFyZSBwcmVzZW50XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc29sdmVkTGlua0NhY2hlczogTWFwPHN0cmluZywgTGlua0NhY2hlPiA9IG5ldyBNYXAoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdCkge1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUxpbmsocHJvY2Vzc01hbmFnZXI6IFBpY2s8SVRlcm1pbmFsUHJvY2Vzc01hbmFnZXIsICdpbml0aWFsQ3dkJyB8ICdvcycgfCAncmVtb3RlQXV0aG9yaXR5JyB8ICd1c2VySG9tZSc+ICYgeyBiYWNrZW5kPzogUGljazxJVGVybWluYWxCYWNrZW5kLCAnZ2V0V3NsUGF0aCc+IH0sIGxpbms6IHN0cmluZywgdXJpPzogVVJJKTogUHJvbWlzZTxSZXNvbHZlZExpbms+IHtcblx0XHQvLyBDb3JyZWN0IHNjaGVtZSBhbmQgYXV0aG9yaXR5IGZvciByZW1vdGUgdGVybWluYWxzXG5cdFx0aWYgKHVyaSAmJiB1cmkuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUgJiYgcHJvY2Vzc01hbmFnZXIucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHR1cmkgPSB1cmkud2l0aCh7XG5cdFx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVSZW1vdGUsXG5cdFx0XHRcdGF1dGhvcml0eTogcHJvY2Vzc01hbmFnZXIucmVtb3RlQXV0aG9yaXR5XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBHZXQgdGhlIGxpbmsgY2FjaGVcblx0XHRsZXQgY2FjaGUgPSB0aGlzLl9yZXNvbHZlZExpbmtDYWNoZXMuZ2V0KHByb2Nlc3NNYW5hZ2VyLnJlbW90ZUF1dGhvcml0eSA/PyAnJyk7XG5cdFx0aWYgKCFjYWNoZSkge1xuXHRcdFx0Y2FjaGUgPSBuZXcgTGlua0NhY2hlKCk7XG5cdFx0XHR0aGlzLl9yZXNvbHZlZExpbmtDYWNoZXMuc2V0KHByb2Nlc3NNYW5hZ2VyLnJlbW90ZUF1dGhvcml0eSA/PyAnJywgY2FjaGUpO1xuXHRcdH1cblxuXHRcdC8vIENoZWNrIHJlc29sdmVkIGxpbmsgY2FjaGUgZmlyc3Rcblx0XHRjb25zdCBjYWNoZWQgPSBjYWNoZS5nZXQodXJpIHx8IGxpbmspO1xuXHRcdGlmIChjYWNoZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGNhY2hlZDtcblx0XHR9XG5cblx0XHRpZiAodXJpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2Uuc3RhdCh1cmkpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB7IHVyaSwgbGluaywgaXNEaXJlY3Rvcnk6IHN0YXQuaXNEaXJlY3RvcnkgfTtcblx0XHRcdFx0Y2FjaGUuc2V0KHVyaSwgcmVzdWx0KTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHRcdGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIERvZXMgbm90IGV4aXN0XG5cdFx0XHRcdGNhY2hlLnNldCh1cmksIG51bGwpO1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBSZW1vdmUgYW55IGxpbmUvY29sIHN1ZmZpeFxuXHRcdGxldCBsaW5rVXJsID0gcmVtb3ZlTGlua1N1ZmZpeChsaW5rKTtcblxuXHRcdC8vIFJlbW92ZSBhbnkgcXVlcnkgc3RyaW5nXG5cdFx0bGlua1VybCA9IHJlbW92ZUxpbmtRdWVyeVN0cmluZyhsaW5rVXJsKTtcblxuXHRcdC8vIEV4aXQgZWFybHkgaWYgdGhlIGxpbmsgaXMgZGV0ZXJtaW5lcyBhcyBub3QgdmFsaWQgYWxyZWFkeVxuXHRcdGlmIChsaW5rVXJsLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Y2FjaGUuc2V0KGxpbmssIG51bGwpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGxpbmsgbG9va3MgbGlrZSBhIC9tbnQvIFdTTCBwYXRoIGFuZCB0aGlzIGlzIGEgV2luZG93cyBmcm9udGVuZCwgdXNlIHRoZSBiYWNrZW5kXG5cdFx0Ly8gdG8gZ2V0IHRoZSByZXNvbHZlZCBwYXRoIGZyb20gdGhlIHdzbHBhdGggdXRpbC5cblx0XHRpZiAoaXNXaW5kb3dzICYmIGxpbmsubWF0Y2goL15cXC9tbnRcXC9bYS16XS9pKSAmJiBwcm9jZXNzTWFuYWdlci5iYWNrZW5kKSB7XG5cdFx0XHRsaW5rVXJsID0gYXdhaXQgcHJvY2Vzc01hbmFnZXIuYmFja2VuZC5nZXRXc2xQYXRoKGxpbmtVcmwsICd1bml4LXRvLXdpbicpO1xuXHRcdH1cblx0XHQvLyBTa2lwIHByZXByb2Nlc3NpbmcgaWYgaXQgbG9va3MgbGlrZSBhIHNwZWNpYWwgV2luZG93cyAtPiBXU0wgbGlua1xuXHRcdGVsc2UgaWYgKGlzV2luZG93cyAmJiBsaW5rLm1hdGNoKC9eKD86XFwvXFwvfFxcXFxcXFxcKXdzbCg/OlxcJHxcXC5sb2NhbGhvc3QpKFxcL3xcXFxcKS8pKSB7XG5cdFx0XHQvLyBOby1vcCwgaXQncyBhbHJlYWR5IHRoZSByaWdodCBmb3JtYXRcblx0XHR9XG5cdFx0Ly8gSGFuZGxlIGFsbCBub24tV1NMIGxpbmtzXG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25zdCBwcmVwcm9jZXNzZWRMaW5rID0gdGhpcy5fcHJlcHJvY2Vzc1BhdGgobGlua1VybCwgcHJvY2Vzc01hbmFnZXIuaW5pdGlhbEN3ZCwgcHJvY2Vzc01hbmFnZXIub3MsIHByb2Nlc3NNYW5hZ2VyLnVzZXJIb21lKTtcblx0XHRcdGlmICghcHJlcHJvY2Vzc2VkTGluaykge1xuXHRcdFx0XHRjYWNoZS5zZXQobGluaywgbnVsbCk7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0bGlua1VybCA9IHByZXByb2Nlc3NlZExpbms7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGxldCB1cmk6IFVSSTtcblx0XHRcdGlmIChwcm9jZXNzTWFuYWdlci5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0dXJpID0gVVJJLmZyb20oe1xuXHRcdFx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVSZW1vdGUsXG5cdFx0XHRcdFx0YXV0aG9yaXR5OiBwcm9jZXNzTWFuYWdlci5yZW1vdGVBdXRob3JpdHksXG5cdFx0XHRcdFx0cGF0aDogbGlua1VybFxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVyaSA9IFVSSS5maWxlKGxpbmtVcmwpO1xuXHRcdFx0fVxuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2Uuc3RhdCh1cmkpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB7IHVyaSwgbGluaywgaXNEaXJlY3Rvcnk6IHN0YXQuaXNEaXJlY3RvcnkgfTtcblx0XHRcdFx0Y2FjaGUuc2V0KGxpbmssIHJlc3VsdCk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0XHRjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBEb2VzIG5vdCBleGlzdFxuXHRcdFx0XHRjYWNoZS5zZXQobGluaywgbnVsbCk7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gRXJyb3JzIGluIHBhcnNpbmcgdGhlIHBhdGhcblx0XHRcdGNhY2hlLnNldChsaW5rLCBudWxsKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfcHJlcHJvY2Vzc1BhdGgobGluazogc3RyaW5nLCBpbml0aWFsQ3dkOiBzdHJpbmcsIG9zOiBPcGVyYXRpbmdTeXN0ZW0gfCB1bmRlZmluZWQsIHVzZXJIb21lOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRjb25zdCBvc1BhdGggPSB0aGlzLl9nZXRPc1BhdGgob3MpO1xuXHRcdGlmIChsaW5rLmNoYXJBdCgwKSA9PT0gJ34nKSB7XG5cdFx0XHQvLyBSZXNvbHZlIH4gLT4gdXNlckhvbWVcblx0XHRcdGlmICghdXNlckhvbWUpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRsaW5rID0gb3NQYXRoLmpvaW4odXNlckhvbWUsIGxpbmsuc3Vic3RyaW5nKDEpKTtcblx0XHR9IGVsc2UgaWYgKGxpbmsuY2hhckF0KDApICE9PSAnLycgJiYgbGluay5jaGFyQXQoMCkgIT09ICd+Jykge1xuXHRcdFx0Ly8gUmVzb2x2ZSB3b3Jrc3BhY2UgcGF0aCAuIHwgLi4gfCA8cmVsYXRpdmVfcGF0aD4gLT4gPHBhdGg+Ly4gfCA8cGF0aD4vLi4gfCA8cGF0aD4vPHJlbGF0aXZlX3BhdGg+XG5cdFx0XHRpZiAob3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSB7XG5cdFx0XHRcdGlmICghbGluay5tYXRjaCgnXicgKyB3aW5Ecml2ZVByZWZpeCkgJiYgIWxpbmsuc3RhcnRzV2l0aCgnXFxcXFxcXFw/XFxcXCcpKSB7XG5cdFx0XHRcdFx0aWYgKCFpbml0aWFsQ3dkKSB7XG5cdFx0XHRcdFx0XHQvLyBBYm9ydCBpZiBubyB3b3Jrc3BhY2UgaXMgb3BlblxuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGxpbmsgPSBvc1BhdGguam9pbihpbml0aWFsQ3dkLCBsaW5rKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBSZW1vdmUgXFxcXD9cXCBmcm9tIHBhdGhzIHNvIHRoYXQgdGhleSBzaGFyZSB0aGUgc2FtZSB1bmRlcmx5aW5nXG5cdFx0XHRcdFx0Ly8gdXJpIGFuZCBkb24ndCBvcGVuIG11bHRpcGxlIHRhYnMgZm9yIHRoZSBzYW1lIGZpbGVcblx0XHRcdFx0XHRsaW5rID0gbGluay5yZXBsYWNlKC9eXFxcXFxcXFxcXD9cXFxcLywgJycpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoIWluaXRpYWxDd2QpIHtcblx0XHRcdFx0XHQvLyBBYm9ydCBpZiBubyB3b3Jrc3BhY2UgaXMgb3BlblxuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpbmsgPSBvc1BhdGguam9pbihpbml0aWFsQ3dkLCBsaW5rKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0bGluayA9IG9zUGF0aC5ub3JtYWxpemUobGluayk7XG5cblx0XHRyZXR1cm4gbGluaztcblx0fVxuXG5cdHByaXZhdGUgX2dldE9zUGF0aChvczogT3BlcmF0aW5nU3lzdGVtIHwgdW5kZWZpbmVkKTogSVBhdGgge1xuXHRcdHJldHVybiAob3MgPz8gT1MpID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyA/IHdpbjMyIDogcG9zaXg7XG5cdH1cbn1cblxuY29uc3QgZW51bSBMaW5rQ2FjaGVDb25zdGFudHMge1xuXHQvKipcblx0ICogSG93IGxvbmcgdG8gY2FjaGUgbGlua3MgZm9yIGluIG1pbGxpc2Vjb25kcywgdGhlIFRUTCByZXNldHMgd2hlbmV2ZXIgYSBuZXcgdmFsdWUgaXMgc2V0IGluXG5cdCAqIHRoZSBjYWNoZS5cblx0ICovXG5cdFRUTCA9IDEwMDAwXG59XG5cbmNsYXNzIExpbmtDYWNoZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IE1hcDxzdHJpbmcsIFJlc29sdmVkTGluaz4oKTtcblx0cHJpdmF0ZSBfY2FjaGVUaWxUaW1lb3V0ID0gMDtcblxuXHRzZXQobGluazogc3RyaW5nIHwgVVJJLCB2YWx1ZTogUmVzb2x2ZWRMaW5rKSB7XG5cdFx0Ly8gUmVzZXQgY2FjaGVkIGxpbmsgVFRMIG9uIGFueSBzZXRcblx0XHRpZiAodGhpcy5fY2FjaGVUaWxUaW1lb3V0KSB7XG5cdFx0XHRtYWluV2luZG93LmNsZWFyVGltZW91dCh0aGlzLl9jYWNoZVRpbFRpbWVvdXQpO1xuXHRcdH1cblx0XHR0aGlzLl9jYWNoZVRpbFRpbWVvdXQgPSBtYWluV2luZG93LnNldFRpbWVvdXQoKCkgPT4gdGhpcy5fY2FjaGUuY2xlYXIoKSwgTGlua0NhY2hlQ29uc3RhbnRzLlRUTCk7XG5cdFx0dGhpcy5fY2FjaGUuc2V0KHRoaXMuX2dldEtleShsaW5rKSwgdmFsdWUpO1xuXHR9XG5cblx0Z2V0KGxpbms6IHN0cmluZyB8IFVSSSk6IFJlc29sdmVkTGluayB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlLmdldCh0aGlzLl9nZXRLZXkobGluaykpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0S2V5KGxpbms6IHN0cmluZyB8IFVSSSk6IHN0cmluZyB7XG5cdFx0aWYgKFVSSS5pc1VyaShsaW5rKSkge1xuXHRcdFx0cmV0dXJuIGxpbmsudG9TdHJpbmcoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cbn1cbiJdLAog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QUFBQSxFQUVVLGdCQUFnQixNQUFjLFlBQW9CLElBQWlDLFVBQTZDO0FBQ3pJLFVBQU0sU0FBUyxLQUFLLFdBQVcsRUFBRTtBQUNqQyxRQUFJLEtBQUssT0FBTyxDQUFDLE1BQU0sS0FBSztBQUUzQixVQUFJLENBQUMsVUFBVTtBQUNkLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyxPQUFPLEtBQUssVUFBVSxLQUFLLFVBQVUsQ0FBQyxDQUFDO0FBQUEsSUFDL0MsV0FBVyxLQUFLLE9BQU8sQ0FBQyxNQUFNLE9BQU8sS0FBSyxPQUFPLENBQUMsTUFBTSxLQUFLO0FBRTVELFVBQUksT0FBTyxnQkFBZ0IsU0FBUztBQUNuQyxZQUFJLENBQUMsS0FBSyxNQUFNLE1BQU0sY0FBYyxLQUFLLENBQUMsS0FBSyxXQUFXLFNBQVMsR0FBRztBQUNyRSxjQUFJLENBQUMsWUFBWTtBQUVoQixtQkFBTztBQUFBLFVBQ1I7QUFDQSxpQkFBTyxPQUFPLEtBQUssWUFBWSxJQUFJO0FBQUEsUUFDcEMsT0FBTztBQUdOLGlCQUFPLEtBQUssUUFBUSxhQUFhLEVBQUU7QUFBQSxRQUNwQztBQUFBLE1BQ0QsT0FBTztBQUNOLFlBQUksQ0FBQyxZQUFZO0FBRWhCLGlCQUFPO0FBQUEsUUFDUjtBQUNBLGVBQU8sT0FBTyxLQUFLLFlBQVksSUFBSTtBQUFBLE1BQ3BDO0FBQUEsSUFDRDtBQUNBLFdBQU8sT0FBTyxVQUFVLElBQUk7QUFFNUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFdBQVcsSUFBd0M7QUFDMUQsWUFBUSxNQUFNLFFBQVEsZ0JBQWdCLFVBQVUsUUFBUTtBQUFBLEVBQ3pEO0FBQ0Q7QUFqSmEsdUJBQU47QUFBQSxFQU1KO0FBQUEsR0FOVTtBQW1KYixJQUFXLHFCQUFYLGtCQUFXQyx3QkFBWDtBQUtDLEVBQUFBLHdDQUFBLFNBQU0sT0FBTjtBQUxVLFNBQUFBO0FBQUEsR0FBQTtBQVFYLE1BQU0sVUFBVTtBQUFBLEVBQWhCO0FBQ0MsU0FBaUIsU0FBUyxvQkFBSSxJQUEwQjtBQUN4RCxTQUFRLG1CQUFtQjtBQUFBO0FBQUEsRUFFM0IsSUFBSSxNQUFvQixPQUFxQjtBQUU1QyxRQUFJLEtBQUssa0JBQWtCO0FBQzFCLGlCQUFXLGFBQWEsS0FBSyxnQkFBZ0I7QUFBQSxJQUM5QztBQUNBLFNBQUssbUJBQW1CLFdBQVcsV0FBVyxNQUFNLEtBQUssT0FBTyxNQUFNLEdBQUcsYUFBc0I7QUFDL0YsU0FBSyxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksR0FBRyxLQUFLO0FBQUEsRUFDMUM7QUFBQSxFQUVBLElBQUksTUFBOEM7QUFDakQsV0FBTyxLQUFLLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDO0FBQUEsRUFDMUM7QUFBQSxFQUVRLFFBQVEsTUFBNEI7QUFDM0MsUUFBSSxJQUFJLE1BQU0sSUFBSSxHQUFHO0FBQ3BCLGFBQU8sS0FBSyxTQUFTO0FBQUEsSUFDdEI7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNEOyIsCiAgIm5hbWVzIjogWyJ1cmkiLCAiTGlua0NhY2hlQ29uc3RhbnRzIl0KfQo=
