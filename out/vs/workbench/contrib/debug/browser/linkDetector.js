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
import { getWindow, isHTMLElement, reset } from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Schemas } from "../../../../base/common/network.js";
import * as osPath from "../../../../base/common/path.js";
import * as platform from "../../../../base/common/platform.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITunnelService } from "../../../../platform/tunnel/common/tunnel.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { Iterable } from "../../../../base/common/iterator.js";
const CONTROL_CODES = "\\u0000-\\u0020\\u007f-\\u009f";
const WEB_LINK_REGEX = new RegExp("(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|data:|www\\.)[^\\s" + CONTROL_CODES + '"]{2,}[^\\s' + CONTROL_CODES + `"')}\\],:;.!?]`, "ug");
const WIN_ABSOLUTE_PATH = /(?:[a-zA-Z]:(?:(?:\\|\/)[\w\.-]*)+)/;
const WIN_RELATIVE_PATH = /(?:(?:\~|\.)(?:(?:\\|\/)[\w\.-]*)+)/;
const WIN_PATH = new RegExp(`(${WIN_ABSOLUTE_PATH.source}|${WIN_RELATIVE_PATH.source})`);
const POSIX_PATH = /((?:\~|\.)?(?:\/[\w\.-]*)+)/;
const LINE_COLUMN = /(?:\:([\d]+))?(?:\:([\d]+))?/;
const PATH_LINK_REGEX = new RegExp(`${platform.isWindows ? WIN_PATH.source : POSIX_PATH.source}${LINE_COLUMN.source}`, "g");
const LINE_COLUMN_REGEX = /:([\d]+)(?::([\d]+))?$/;
const MAX_LENGTH = 2e3;
var DebugLinkHoverBehavior = /* @__PURE__ */ ((DebugLinkHoverBehavior2) => {
  DebugLinkHoverBehavior2[DebugLinkHoverBehavior2["Rich"] = 0] = "Rich";
  DebugLinkHoverBehavior2[DebugLinkHoverBehavior2["Basic"] = 1] = "Basic";
  DebugLinkHoverBehavior2[DebugLinkHoverBehavior2["None"] = 2] = "None";
  return DebugLinkHoverBehavior2;
})(DebugLinkHoverBehavior || {});
let LinkDetector = class {
  constructor(editorService, fileService, openerService, pathService, tunnelService, environmentService, configurationService, hoverService) {
    this.editorService = editorService;
    this.fileService = fileService;
    this.openerService = openerService;
    this.pathService = pathService;
    this.tunnelService = tunnelService;
    this.environmentService = environmentService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
  }
  /**
   * Matches and handles web urls, absolute and relative file links in the string provided.
   * Returns <span/> element that wraps the processed string, where matched links are replaced by <a/>.
   * 'onclick' event is attached to all anchored links that opens them in the editor.
   * When splitLines is true, each line of the text, even if it contains no links, is wrapped in a <span>
   * and added as a child of the returned <span>.
   * If a `hoverBehavior` is passed, hovers may be added using the workbench hover service.
   * This should be preferred for new code where hovers are desirable.
   */
  linkify(text, splitLines, workspaceFolder, includeFulltext, hoverBehavior, highlights) {
    return this._linkify(text, splitLines, workspaceFolder, includeFulltext, hoverBehavior, highlights);
  }
  _linkify(text, splitLines, workspaceFolder, includeFulltext, hoverBehavior, highlights, defaultRef) {
    if (splitLines) {
      const lines = text.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        lines[i] = lines[i] + "\n";
      }
      if (!lines[lines.length - 1]) {
        lines.pop();
      }
      const elements = lines.map((line) => this._linkify(line, false, workspaceFolder, includeFulltext, hoverBehavior, highlights, defaultRef));
      if (elements.length === 1) {
        return elements[0];
      }
      const container2 = document.createElement("span");
      elements.forEach((e) => container2.appendChild(e));
      return container2;
    }
    const container = document.createElement("span");
    for (const part of this.detectLinks(text)) {
      try {
        let node;
        switch (part.kind) {
          case "text":
            node = defaultRef ? this.linkifyLocation(part.value, defaultRef.locationReference, defaultRef.session, hoverBehavior) : document.createTextNode(part.value);
            break;
          case "web":
            node = this.createWebLink(includeFulltext ? text : void 0, part.value, hoverBehavior);
            break;
          case "path": {
            const path = part.captures[0];
            const lineNumber = part.captures[1] ? Number(part.captures[1]) : 0;
            const columnNumber = part.captures[2] ? Number(part.captures[2]) : 0;
            node = this.createPathLink(includeFulltext ? text : void 0, part.value, path, lineNumber, columnNumber, workspaceFolder, hoverBehavior);
            break;
          }
          default:
            node = document.createTextNode(part.value);
        }
        container.append(...this.applyHighlights(node, part.index, part.value.length, highlights));
      } catch (e) {
        container.appendChild(document.createTextNode(part.value));
      }
    }
    return container;
  }
  applyHighlights(node, startIndex, length, highlights) {
    const children = [];
    let currentIndex = startIndex;
    const endIndex = startIndex + length;
    for (const highlight of highlights || []) {
      if (highlight.end <= currentIndex || highlight.start >= endIndex) {
        continue;
      }
      if (highlight.start > currentIndex) {
        children.push(node.textContent.substring(currentIndex - startIndex, highlight.start - startIndex));
        currentIndex = highlight.start;
      }
      const highlightEnd = Math.min(highlight.end, endIndex);
      const highlightedText = node.textContent.substring(currentIndex - startIndex, highlightEnd - startIndex);
      const highlightSpan = document.createElement("span");
      highlightSpan.classList.add("highlight");
      if (highlight.extraClasses) {
        highlightSpan.classList.add(...highlight.extraClasses);
      }
      highlightSpan.textContent = highlightedText;
      children.push(highlightSpan);
      currentIndex = highlightEnd;
    }
    if (currentIndex === startIndex) {
      return Iterable.single(node);
    }
    if (currentIndex < endIndex) {
      children.push(node.textContent.substring(currentIndex - startIndex));
    }
    if (isHTMLElement(node)) {
      reset(node, ...children);
      return Iterable.single(node);
    }
    return children;
  }
  /**
   * Linkifies a location reference.
   */
  linkifyLocation(text, locationReference, session, hoverBehavior) {
    const link = this.createLink(text);
    this.decorateLink(link, void 0, text, hoverBehavior, async (preserveFocus) => {
      const location = await session.resolveLocationReference(locationReference);
      await location.source.openInEditor(this.editorService, {
        startLineNumber: location.line,
        startColumn: location.column,
        endLineNumber: location.endLine ?? location.line,
        endColumn: location.endColumn ?? location.column
      }, preserveFocus);
    });
    return link;
  }
  /**
   * Makes an {@link ILinkDetector} that links everything in the output to the
   * reference if they don't have other explicit links.
   */
  makeReferencedLinkDetector(locationReference, session) {
    return {
      linkify: (text, splitLines, workspaceFolder, includeFulltext, hoverBehavior, highlights) => this._linkify(text, splitLines, workspaceFolder, includeFulltext, hoverBehavior, highlights, { locationReference, session }),
      linkifyLocation: this.linkifyLocation.bind(this)
    };
  }
  createWebLink(fulltext, url, hoverBehavior) {
    const link = this.createLink(url);
    let uri = URI.parse(url);
    const lineCol = LINE_COLUMN_REGEX.exec(uri.path);
    if (lineCol) {
      uri = uri.with({
        path: uri.path.slice(0, lineCol.index),
        fragment: `L${lineCol[0].slice(1)}`
      });
    }
    this.decorateLink(link, uri, fulltext, hoverBehavior, async () => {
      if (uri.scheme === Schemas.file) {
        const fsPath = uri.fsPath;
        const path = await this.pathService.path;
        const fileUrl = osPath.normalize(path.sep === osPath.posix.sep && platform.isWindows ? fsPath.replace(/\\/g, osPath.posix.sep) : fsPath);
        const fileUri = URI.parse(fileUrl);
        const exists = await this.fileService.exists(fileUri);
        if (!exists) {
          return;
        }
        await this.editorService.openEditor({
          resource: fileUri,
          options: {
            pinned: true,
            selection: lineCol ? { startLineNumber: +lineCol[1], startColumn: +lineCol[2] } : void 0
          }
        });
        return;
      }
      this.openerService.open(url, { allowTunneling: !!this.environmentService.remoteAuthority && this.configurationService.getValue("remote.forwardOnOpen") });
    });
    return link;
  }
  createPathLink(fulltext, text, path, lineNumber, columnNumber, workspaceFolder, hoverBehavior) {
    if (path[0] === "/" && path[1] === "/") {
      return document.createTextNode(text);
    }
    const options = { selection: { startLineNumber: lineNumber, startColumn: columnNumber } };
    if (path[0] === ".") {
      if (!workspaceFolder) {
        return document.createTextNode(text);
      }
      const uri2 = workspaceFolder.toResource(path);
      const link2 = this.createLink(text);
      this.decorateLink(link2, uri2, fulltext, hoverBehavior, (preserveFocus) => this.editorService.openEditor({ resource: uri2, options: { ...options, preserveFocus } }));
      return link2;
    }
    if (path[0] === "~") {
      const userHome = this.pathService.resolvedUserHome;
      if (userHome) {
        path = osPath.join(userHome.fsPath, path.substring(1));
      }
    }
    const link = this.createLink(text);
    link.tabIndex = 0;
    const uri = URI.file(osPath.normalize(path));
    this.fileService.stat(uri).then((stat) => {
      if (stat.isDirectory) {
        return;
      }
      this.decorateLink(link, uri, fulltext, hoverBehavior, (preserveFocus) => this.editorService.openEditor({ resource: uri, options: { ...options, preserveFocus } }));
    }).catch(() => {
    });
    return link;
  }
  createLink(text) {
    const link = document.createElement("a");
    link.textContent = text;
    return link;
  }
  decorateLink(link, uri, fulltext, hoverBehavior, onClick) {
    link.classList.add("link");
    const followLink = uri && this.tunnelService.canTunnel(uri) ? localize("followForwardedLink", "follow link using forwarded port") : localize("followLink", "follow link");
    const title = link.ariaLabel = fulltext ? platform.isMacintosh ? localize("fileLinkWithPathMac", "Cmd + click to {0}\n{1}", followLink, fulltext) : localize("fileLinkWithPath", "Ctrl + click to {0}\n{1}", followLink, fulltext) : platform.isMacintosh ? localize("fileLinkMac", "Cmd + click to {0}", followLink) : localize("fileLink", "Ctrl + click to {0}", followLink);
    if (hoverBehavior?.type === 0 /* Rich */) {
      hoverBehavior.store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), link, title));
    } else if (hoverBehavior?.type !== 2 /* None */) {
      link.title = title;
    }
    link.onmousemove = (event) => {
      link.classList.toggle("pointer", platform.isMacintosh ? event.metaKey : event.ctrlKey);
    };
    link.onmouseleave = () => link.classList.remove("pointer");
    link.onclick = (event) => {
      const selection = getWindow(link).getSelection();
      if (!selection || selection.type === "Range") {
        return;
      }
      if (!(platform.isMacintosh ? event.metaKey : event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onClick(false);
    };
    link.onkeydown = (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.keyCode === KeyCode.Enter || event.keyCode === KeyCode.Space) {
        event.preventDefault();
        event.stopPropagation();
        onClick(event.keyCode === KeyCode.Space);
      }
    };
  }
  detectLinks(text) {
    if (text.length > MAX_LENGTH) {
      return [{ kind: "text", value: text, captures: [], index: 0 }];
    }
    const regexes = [WEB_LINK_REGEX, PATH_LINK_REGEX];
    const kinds = ["web", "path"];
    const result = [];
    const splitOne = (text2, regexIndex, baseIndex) => {
      if (regexIndex >= regexes.length) {
        result.push({ value: text2, kind: "text", captures: [], index: baseIndex });
        return;
      }
      const regex = regexes[regexIndex];
      let currentIndex = 0;
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(text2)) !== null) {
        const stringBeforeMatch = text2.substring(currentIndex, match.index);
        if (stringBeforeMatch) {
          splitOne(stringBeforeMatch, regexIndex + 1, baseIndex + currentIndex);
        }
        const value = match[0];
        result.push({
          value,
          kind: kinds[regexIndex],
          captures: match.slice(1),
          index: baseIndex + match.index
        });
        currentIndex = match.index + value.length;
      }
      const stringAfterMatches = text2.substring(currentIndex);
      if (stringAfterMatches) {
        splitOne(stringAfterMatches, regexIndex + 1, baseIndex + currentIndex);
      }
    };
    splitOne(text, 0, 0);
    return result;
  }
};
LinkDetector = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, IFileService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IPathService),
  __decorateParam(4, ITunnelService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IHoverService)
], LinkDetector);
export {
  DebugLinkHoverBehavior,
  LinkDetector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2xpbmtEZXRlY3Rvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGdldFdpbmRvdywgaXNIVE1MRWxlbWVudCwgcmVzZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0ICogYXMgb3NQYXRoIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVR1bm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlRm9sZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSURlYnVnU2Vzc2lvbiB9IGZyb20gJy4uL2NvbW1vbi9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSGlnaGxpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hpZ2hsaWdodGVkbGFiZWwvaGlnaGxpZ2h0ZWRMYWJlbC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcblxuY29uc3QgQ09OVFJPTF9DT0RFUyA9ICdcXFxcdTAwMDAtXFxcXHUwMDIwXFxcXHUwMDdmLVxcXFx1MDA5Zic7XG5jb25zdCBXRUJfTElOS19SRUdFWCA9IG5ldyBSZWdFeHAoJyg/OlthLXpBLVpdW2EtekEtWjAtOSsuLV17Mix9OlxcXFwvXFxcXC98ZGF0YTp8d3d3XFxcXC4pW15cXFxccycgKyBDT05UUk9MX0NPREVTICsgJ1wiXXsyLH1bXlxcXFxzJyArIENPTlRST0xfQ09ERVMgKyAnXCJcXCcpfVxcXFxdLDo7LiE/XScsICd1ZycpO1xuXG5jb25zdCBXSU5fQUJTT0xVVEVfUEFUSCA9IC8oPzpbYS16QS1aXTooPzooPzpcXFxcfFxcLylbXFx3XFwuLV0qKSspLztcbmNvbnN0IFdJTl9SRUxBVElWRV9QQVRIID0gLyg/Oig/OlxcfnxcXC4pKD86KD86XFxcXHxcXC8pW1xcd1xcLi1dKikrKS87XG5jb25zdCBXSU5fUEFUSCA9IG5ldyBSZWdFeHAoYCgke1dJTl9BQlNPTFVURV9QQVRILnNvdXJjZX18JHtXSU5fUkVMQVRJVkVfUEFUSC5zb3VyY2V9KWApO1xuY29uc3QgUE9TSVhfUEFUSCA9IC8oKD86XFx+fFxcLik/KD86XFwvW1xcd1xcLi1dKikrKS87XG5jb25zdCBMSU5FX0NPTFVNTiA9IC8oPzpcXDooW1xcZF0rKSk/KD86XFw6KFtcXGRdKykpPy87XG5jb25zdCBQQVRIX0xJTktfUkVHRVggPSBuZXcgUmVnRXhwKGAke3BsYXRmb3JtLmlzV2luZG93cyA/IFdJTl9QQVRILnNvdXJjZSA6IFBPU0lYX1BBVEguc291cmNlfSR7TElORV9DT0xVTU4uc291cmNlfWAsICdnJyk7XG5jb25zdCBMSU5FX0NPTFVNTl9SRUdFWCA9IC86KFtcXGRdKykoPzo6KFtcXGRdKykpPyQvO1xuXG5jb25zdCBNQVhfTEVOR1RIID0gMjAwMDtcblxudHlwZSBMaW5rS2luZCA9ICd3ZWInIHwgJ3BhdGgnIHwgJ3RleHQnO1xudHlwZSBMaW5rUGFydCA9IHtcblx0a2luZDogTGlua0tpbmQ7XG5cdHZhbHVlOiBzdHJpbmc7XG5cdGNhcHR1cmVzOiBzdHJpbmdbXTtcblx0aW5kZXg6IG51bWJlcjtcbn07XG5cbmV4cG9ydCBjb25zdCBlbnVtIERlYnVnTGlua0hvdmVyQmVoYXZpb3Ige1xuXHQvKiogQSBuaWNlIHdvcmtiZW5jaCBob3ZlciAqL1xuXHRSaWNoLFxuXHQvKipcblx0ICogQmFzaWMgYnJvd3NlciBob3ZlclxuXHQgKiBAZGVwcmVjYXRlZCBDb25zdW1lcnMgc2hvdWxkIGFkb3B0IGByaWNoYCBieSBwcm9wYWdhdGluZyBkaXNwb3NhYmxlcyBhcHByb3ByaWF0ZWx5XG5cdCAqL1xuXHRCYXNpYyxcblx0LyoqIE5vIGhvdmVyICovXG5cdE5vbmVcbn1cblxuLyoqIFN0b3JlIGltcGxpZXMgSG92ZXJCZWhhdmlvcj1yaWNoICovXG5leHBvcnQgdHlwZSBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yVHlwZURhdGEgPSB7IHR5cGU6IERlYnVnTGlua0hvdmVyQmVoYXZpb3IuTm9uZSB8IERlYnVnTGlua0hvdmVyQmVoYXZpb3IuQmFzaWMgfVxuXHR8IHsgdHlwZTogRGVidWdMaW5rSG92ZXJCZWhhdmlvci5SaWNoOyBzdG9yZTogRGlzcG9zYWJsZVN0b3JlIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUxpbmtEZXRlY3RvciB7XG5cdGxpbmtpZnkodGV4dDogc3RyaW5nLCBzcGxpdExpbmVzPzogYm9vbGVhbiwgd29ya3NwYWNlRm9sZGVyPzogSVdvcmtzcGFjZUZvbGRlciwgaW5jbHVkZUZ1bGx0ZXh0PzogYm9vbGVhbiwgaG92ZXJCZWhhdmlvcj86IERlYnVnTGlua0hvdmVyQmVoYXZpb3JUeXBlRGF0YSwgaGlnaGxpZ2h0cz86IElIaWdobGlnaHRbXSk6IEhUTUxFbGVtZW50O1xuXHRsaW5raWZ5TG9jYXRpb24odGV4dDogc3RyaW5nLCBsb2NhdGlvblJlZmVyZW5jZTogbnVtYmVyLCBzZXNzaW9uOiBJRGVidWdTZXNzaW9uLCBob3ZlckJlaGF2aW9yPzogRGVidWdMaW5rSG92ZXJCZWhhdmlvclR5cGVEYXRhKTogSFRNTEVsZW1lbnQ7XG59XG5cbmV4cG9ydCBjbGFzcyBMaW5rRGV0ZWN0b3IgaW1wbGVtZW50cyBJTGlua0RldGVjdG9yIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElUdW5uZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdC8vIG5vb3Bcblx0fVxuXG5cdC8qKlxuXHQgKiBNYXRjaGVzIGFuZCBoYW5kbGVzIHdlYiB1cmxzLCBhYnNvbHV0ZSBhbmQgcmVsYXRpdmUgZmlsZSBsaW5rcyBpbiB0aGUgc3RyaW5nIHByb3ZpZGVkLlxuXHQgKiBSZXR1cm5zIDxzcGFuLz4gZWxlbWVudCB0aGF0IHdyYXBzIHRoZSBwcm9jZXNzZWQgc3RyaW5nLCB3aGVyZSBtYXRjaGVkIGxpbmtzIGFyZSByZXBsYWNlZCBieSA8YS8+LlxuXHQgKiAnb25jbGljaycgZXZlbnQgaXMgYXR0YWNoZWQgdG8gYWxsIGFuY2hvcmVkIGxpbmtzIHRoYXQgb3BlbnMgdGhlbSBpbiB0aGUgZWRpdG9yLlxuXHQgKiBXaGVuIHNwbGl0TGluZXMgaXMgdHJ1ZSwgZWFjaCBsaW5lIG9mIHRoZSB0ZXh0LCBldmVuIGlmIGl0IGNvbnRhaW5zIG5vIGxpbmtzLCBpcyB3cmFwcGVkIGluIGEgPHNwYW4+XG5cdCAqIGFuZCBhZGRlZCBhcyBhIGNoaWxkIG9mIHRoZSByZXR1cm5lZCA8c3Bhbj4uXG5cdCAqIElmIGEgYGhvdmVyQmVoYXZpb3JgIGlzIHBhc3NlZCwgaG92ZXJzIG1heSBiZSBhZGRlZCB1c2luZyB0aGUgd29ya2JlbmNoIGhvdmVyIHNlcnZpY2UuXG5cdCAqIFRoaXMgc2hvdWxkIGJlIHByZWZlcnJlZCBmb3IgbmV3IGNvZGUgd2hlcmUgaG92ZXJzIGFyZSBkZXNpcmFibGUuXG5cdCAqL1xuXHRsaW5raWZ5KHRleHQ6IHN0cmluZywgc3BsaXRMaW5lcz86IGJvb2xlYW4sIHdvcmtzcGFjZUZvbGRlcj86IElXb3Jrc3BhY2VGb2xkZXIsIGluY2x1ZGVGdWxsdGV4dD86IGJvb2xlYW4sIGhvdmVyQmVoYXZpb3I/OiBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yVHlwZURhdGEsIGhpZ2hsaWdodHM/OiBJSGlnaGxpZ2h0W10pOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmtpZnkodGV4dCwgc3BsaXRMaW5lcywgd29ya3NwYWNlRm9sZGVyLCBpbmNsdWRlRnVsbHRleHQsIGhvdmVyQmVoYXZpb3IsIGhpZ2hsaWdodHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGlua2lmeSh0ZXh0OiBzdHJpbmcsIHNwbGl0TGluZXM/OiBib29sZWFuLCB3b3Jrc3BhY2VGb2xkZXI/OiBJV29ya3NwYWNlRm9sZGVyLCBpbmNsdWRlRnVsbHRleHQ/OiBib29sZWFuLCBob3ZlckJlaGF2aW9yPzogRGVidWdMaW5rSG92ZXJCZWhhdmlvclR5cGVEYXRhLCBoaWdobGlnaHRzPzogSUhpZ2hsaWdodFtdLCBkZWZhdWx0UmVmPzogeyBsb2NhdGlvblJlZmVyZW5jZTogbnVtYmVyOyBzZXNzaW9uOiBJRGVidWdTZXNzaW9uIH0pOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKHNwbGl0TGluZXMpIHtcblx0XHRcdGNvbnN0IGxpbmVzID0gdGV4dC5zcGxpdCgnXFxuJyk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdFx0XHRsaW5lc1tpXSA9IGxpbmVzW2ldICsgJ1xcbic7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdKSB7XG5cdFx0XHRcdC8vIFJlbW92ZSB0aGUgbGFzdCBlbGVtZW50ICgnJykgdGhhdCBzcGxpdCBhZGRlZC5cblx0XHRcdFx0bGluZXMucG9wKCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbGVtZW50cyA9IGxpbmVzLm1hcChsaW5lID0+IHRoaXMuX2xpbmtpZnkobGluZSwgZmFsc2UsIHdvcmtzcGFjZUZvbGRlciwgaW5jbHVkZUZ1bGx0ZXh0LCBob3ZlckJlaGF2aW9yLCBoaWdobGlnaHRzLCBkZWZhdWx0UmVmKSk7XG5cdFx0XHRpZiAoZWxlbWVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdC8vIERvIG5vdCB3cmFwIHNpbmdsZSBsaW5lIHdpdGggZXh0cmEgc3Bhbi5cblx0XHRcdFx0cmV0dXJuIGVsZW1lbnRzWzBdO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdFx0ZWxlbWVudHMuZm9yRWFjaChlID0+IGNvbnRhaW5lci5hcHBlbmRDaGlsZChlKSk7XG5cdFx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgdGhpcy5kZXRlY3RMaW5rcyh0ZXh0KSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IG5vZGU6IE5vZGU7XG5cdFx0XHRcdHN3aXRjaCAocGFydC5raW5kKSB7XG5cdFx0XHRcdFx0Y2FzZSAndGV4dCc6XG5cdFx0XHRcdFx0XHRub2RlID0gZGVmYXVsdFJlZiA/IHRoaXMubGlua2lmeUxvY2F0aW9uKHBhcnQudmFsdWUsIGRlZmF1bHRSZWYubG9jYXRpb25SZWZlcmVuY2UsIGRlZmF1bHRSZWYuc2Vzc2lvbiwgaG92ZXJCZWhhdmlvcikgOiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwYXJ0LnZhbHVlKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ3dlYic6XG5cdFx0XHRcdFx0XHRub2RlID0gdGhpcy5jcmVhdGVXZWJMaW5rKGluY2x1ZGVGdWxsdGV4dCA/IHRleHQgOiB1bmRlZmluZWQsIHBhcnQudmFsdWUsIGhvdmVyQmVoYXZpb3IpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAncGF0aCc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhdGggPSBwYXJ0LmNhcHR1cmVzWzBdO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHBhcnQuY2FwdHVyZXNbMV0gPyBOdW1iZXIocGFydC5jYXB0dXJlc1sxXSkgOiAwO1xuXHRcdFx0XHRcdFx0Y29uc3QgY29sdW1uTnVtYmVyID0gcGFydC5jYXB0dXJlc1syXSA/IE51bWJlcihwYXJ0LmNhcHR1cmVzWzJdKSA6IDA7XG5cdFx0XHRcdFx0XHRub2RlID0gdGhpcy5jcmVhdGVQYXRoTGluayhpbmNsdWRlRnVsbHRleHQgPyB0ZXh0IDogdW5kZWZpbmVkLCBwYXJ0LnZhbHVlLCBwYXRoLCBsaW5lTnVtYmVyLCBjb2x1bW5OdW1iZXIsIHdvcmtzcGFjZUZvbGRlciwgaG92ZXJCZWhhdmlvcik7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwYXJ0LnZhbHVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnRhaW5lci5hcHBlbmQoLi4udGhpcy5hcHBseUhpZ2hsaWdodHMobm9kZSwgcGFydC5pbmRleCwgcGFydC52YWx1ZS5sZW5ndGgsIGhpZ2hsaWdodHMpKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHBhcnQudmFsdWUpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgYXBwbHlIaWdobGlnaHRzKG5vZGU6IE5vZGUsIHN0YXJ0SW5kZXg6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIsIGhpZ2hsaWdodHM6IElIaWdobGlnaHRbXSB8IHVuZGVmaW5lZCk6IEl0ZXJhYmxlPE5vZGUgfCBzdHJpbmc+IHtcblx0XHRjb25zdCBjaGlsZHJlbjogKE5vZGUgfCBzdHJpbmcpW10gPSBbXTtcblx0XHRsZXQgY3VycmVudEluZGV4ID0gc3RhcnRJbmRleDtcblx0XHRjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsZW5ndGg7XG5cblx0XHRmb3IgKGNvbnN0IGhpZ2hsaWdodCBvZiBoaWdobGlnaHRzIHx8IFtdKSB7XG5cdFx0XHRpZiAoaGlnaGxpZ2h0LmVuZCA8PSBjdXJyZW50SW5kZXggfHwgaGlnaGxpZ2h0LnN0YXJ0ID49IGVuZEluZGV4KSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaGlnaGxpZ2h0LnN0YXJ0ID4gY3VycmVudEluZGV4KSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2gobm9kZS50ZXh0Q29udGVudCEuc3Vic3RyaW5nKGN1cnJlbnRJbmRleCAtIHN0YXJ0SW5kZXgsIGhpZ2hsaWdodC5zdGFydCAtIHN0YXJ0SW5kZXgpKTtcblx0XHRcdFx0Y3VycmVudEluZGV4ID0gaGlnaGxpZ2h0LnN0YXJ0O1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoaWdobGlnaHRFbmQgPSBNYXRoLm1pbihoaWdobGlnaHQuZW5kLCBlbmRJbmRleCk7XG5cdFx0XHRjb25zdCBoaWdobGlnaHRlZFRleHQgPSBub2RlLnRleHRDb250ZW50IS5zdWJzdHJpbmcoY3VycmVudEluZGV4IC0gc3RhcnRJbmRleCwgaGlnaGxpZ2h0RW5kIC0gc3RhcnRJbmRleCk7XG5cdFx0XHRjb25zdCBoaWdobGlnaHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdFx0aGlnaGxpZ2h0U3Bhbi5jbGFzc0xpc3QuYWRkKCdoaWdobGlnaHQnKTtcblx0XHRcdGlmIChoaWdobGlnaHQuZXh0cmFDbGFzc2VzKSB7XG5cdFx0XHRcdGhpZ2hsaWdodFNwYW4uY2xhc3NMaXN0LmFkZCguLi5oaWdobGlnaHQuZXh0cmFDbGFzc2VzKTtcblx0XHRcdH1cblx0XHRcdGhpZ2hsaWdodFNwYW4udGV4dENvbnRlbnQgPSBoaWdobGlnaHRlZFRleHQ7XG5cdFx0XHRjaGlsZHJlbi5wdXNoKGhpZ2hsaWdodFNwYW4pO1xuXHRcdFx0Y3VycmVudEluZGV4ID0gaGlnaGxpZ2h0RW5kO1xuXHRcdH1cblxuXHRcdGlmIChjdXJyZW50SW5kZXggPT09IHN0YXJ0SW5kZXgpIHtcblx0XHRcdHJldHVybiBJdGVyYWJsZS5zaW5nbGUobm9kZSk7IC8vIG5vIGNoYW5nZXMgbWFkZVxuXHRcdH1cblxuXHRcdGlmIChjdXJyZW50SW5kZXggPCBlbmRJbmRleCkge1xuXHRcdFx0Y2hpbGRyZW4ucHVzaChub2RlLnRleHRDb250ZW50IS5zdWJzdHJpbmcoY3VycmVudEluZGV4IC0gc3RhcnRJbmRleCkpO1xuXHRcdH1cblxuXHRcdC8vIHJldXNlIHRoZSBlbGVtZW50IGlmIGl0J3MgYSBsaW5rXG5cdFx0aWYgKGlzSFRNTEVsZW1lbnQobm9kZSkpIHtcblx0XHRcdHJlc2V0KG5vZGUsIC4uLmNoaWxkcmVuKTtcblx0XHRcdHJldHVybiBJdGVyYWJsZS5zaW5nbGUobm9kZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNoaWxkcmVuO1xuXHR9XG5cblx0LyoqXG5cdCAqIExpbmtpZmllcyBhIGxvY2F0aW9uIHJlZmVyZW5jZS5cblx0ICovXG5cdGxpbmtpZnlMb2NhdGlvbih0ZXh0OiBzdHJpbmcsIGxvY2F0aW9uUmVmZXJlbmNlOiBudW1iZXIsIHNlc3Npb246IElEZWJ1Z1Nlc3Npb24sIGhvdmVyQmVoYXZpb3I/OiBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yVHlwZURhdGEpIHtcblx0XHRjb25zdCBsaW5rID0gdGhpcy5jcmVhdGVMaW5rKHRleHQpO1xuXHRcdHRoaXMuZGVjb3JhdGVMaW5rKGxpbmssIHVuZGVmaW5lZCwgdGV4dCwgaG92ZXJCZWhhdmlvciwgYXN5bmMgKHByZXNlcnZlRm9jdXM6IGJvb2xlYW4pID0+IHtcblx0XHRcdGNvbnN0IGxvY2F0aW9uID0gYXdhaXQgc2Vzc2lvbi5yZXNvbHZlTG9jYXRpb25SZWZlcmVuY2UobG9jYXRpb25SZWZlcmVuY2UpO1xuXHRcdFx0YXdhaXQgbG9jYXRpb24uc291cmNlLm9wZW5JbkVkaXRvcih0aGlzLmVkaXRvclNlcnZpY2UsIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBsb2NhdGlvbi5saW5lLFxuXHRcdFx0XHRzdGFydENvbHVtbjogbG9jYXRpb24uY29sdW1uLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBsb2NhdGlvbi5lbmRMaW5lID8/IGxvY2F0aW9uLmxpbmUsXG5cdFx0XHRcdGVuZENvbHVtbjogbG9jYXRpb24uZW5kQ29sdW1uID8/IGxvY2F0aW9uLmNvbHVtbixcblx0XHRcdH0sIHByZXNlcnZlRm9jdXMpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblxuXHQvKipcblx0ICogTWFrZXMgYW4ge0BsaW5rIElMaW5rRGV0ZWN0b3J9IHRoYXQgbGlua3MgZXZlcnl0aGluZyBpbiB0aGUgb3V0cHV0IHRvIHRoZVxuXHQgKiByZWZlcmVuY2UgaWYgdGhleSBkb24ndCBoYXZlIG90aGVyIGV4cGxpY2l0IGxpbmtzLlxuXHQgKi9cblx0bWFrZVJlZmVyZW5jZWRMaW5rRGV0ZWN0b3IobG9jYXRpb25SZWZlcmVuY2U6IG51bWJlciwgc2Vzc2lvbjogSURlYnVnU2Vzc2lvbik6IElMaW5rRGV0ZWN0b3Ige1xuXHRcdHJldHVybiB7XG5cdFx0XHRsaW5raWZ5OiAodGV4dCwgc3BsaXRMaW5lcywgd29ya3NwYWNlRm9sZGVyLCBpbmNsdWRlRnVsbHRleHQsIGhvdmVyQmVoYXZpb3IsIGhpZ2hsaWdodHMpID0+XG5cdFx0XHRcdHRoaXMuX2xpbmtpZnkodGV4dCwgc3BsaXRMaW5lcywgd29ya3NwYWNlRm9sZGVyLCBpbmNsdWRlRnVsbHRleHQsIGhvdmVyQmVoYXZpb3IsIGhpZ2hsaWdodHMsIHsgbG9jYXRpb25SZWZlcmVuY2UsIHNlc3Npb24gfSksXG5cdFx0XHRsaW5raWZ5TG9jYXRpb246IHRoaXMubGlua2lmeUxvY2F0aW9uLmJpbmQodGhpcyksXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlV2ViTGluayhmdWxsdGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkLCB1cmw6IHN0cmluZywgaG92ZXJCZWhhdmlvcj86IERlYnVnTGlua0hvdmVyQmVoYXZpb3JUeXBlRGF0YSk6IE5vZGUge1xuXHRcdGNvbnN0IGxpbmsgPSB0aGlzLmNyZWF0ZUxpbmsodXJsKTtcblxuXHRcdGxldCB1cmkgPSBVUkkucGFyc2UodXJsKTtcblx0XHQvLyBpZiB0aGUgVVJJIGVuZHMgd2l0aCBzb21ldGhpbmcgbGlrZSBgZm9vLmpzOjEyOjNgLCBwYXJzZVxuXHRcdC8vIHRoYXQgaW50byBhIGZyYWdtZW50IHRvIHJldmVhbCB0aGF0IGxvY2F0aW9uICgjMTUwNzAyKVxuXHRcdGNvbnN0IGxpbmVDb2wgPSBMSU5FX0NPTFVNTl9SRUdFWC5leGVjKHVyaS5wYXRoKTtcblx0XHRpZiAobGluZUNvbCkge1xuXHRcdFx0dXJpID0gdXJpLndpdGgoe1xuXHRcdFx0XHRwYXRoOiB1cmkucGF0aC5zbGljZSgwLCBsaW5lQ29sLmluZGV4KSxcblx0XHRcdFx0ZnJhZ21lbnQ6IGBMJHtsaW5lQ29sWzBdLnNsaWNlKDEpfWBcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRoaXMuZGVjb3JhdGVMaW5rKGxpbmssIHVyaSwgZnVsbHRleHQsIGhvdmVyQmVoYXZpb3IsIGFzeW5jICgpID0+IHtcblxuXHRcdFx0aWYgKHVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHQvLyBKdXN0IHVzaW5nIGZzUGF0aCBoZXJlIGlzIHVuc2FmZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwOTA3NlxuXHRcdFx0XHRjb25zdCBmc1BhdGggPSB1cmkuZnNQYXRoO1xuXHRcdFx0XHRjb25zdCBwYXRoID0gYXdhaXQgdGhpcy5wYXRoU2VydmljZS5wYXRoO1xuXHRcdFx0XHRjb25zdCBmaWxlVXJsID0gb3NQYXRoLm5vcm1hbGl6ZSgoKHBhdGguc2VwID09PSBvc1BhdGgucG9zaXguc2VwKSAmJiBwbGF0Zm9ybS5pc1dpbmRvd3MpID8gZnNQYXRoLnJlcGxhY2UoL1xcXFwvZywgb3NQYXRoLnBvc2l4LnNlcCkgOiBmc1BhdGgpO1xuXG5cdFx0XHRcdGNvbnN0IGZpbGVVcmkgPSBVUkkucGFyc2UoZmlsZVVybCk7XG5cdFx0XHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZXhpc3RzKGZpbGVVcmkpO1xuXHRcdFx0XHRpZiAoIWV4aXN0cykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRyZXNvdXJjZTogZmlsZVVyaSxcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRwaW5uZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IGxpbmVDb2wgPyB7IHN0YXJ0TGluZU51bWJlcjogK2xpbmVDb2xbMV0sIHN0YXJ0Q29sdW1uOiArbGluZUNvbFsyXSB9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHVybCwgeyBhbGxvd1R1bm5lbGluZzogKCEhdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3JlbW90ZS5mb3J3YXJkT25PcGVuJykpIH0pO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVBhdGhMaW5rKGZ1bGx0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQsIHRleHQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbk51bWJlcjogbnVtYmVyLCB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIGhvdmVyQmVoYXZpb3I/OiBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yVHlwZURhdGEpOiBOb2RlIHtcblx0XHRpZiAocGF0aFswXSA9PT0gJy8nICYmIHBhdGhbMV0gPT09ICcvJykge1xuXHRcdFx0Ly8gTW9zdCBsaWtlbHkgYSB1cmwgcGFydCB3aGljaCBkaWQgbm90IG1hdGNoLCBmb3IgZXhhbXBsZSBmdHA6Ly9wYXRoLlxuXHRcdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRleHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7IHNlbGVjdGlvbjogeyBzdGFydExpbmVOdW1iZXI6IGxpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiBjb2x1bW5OdW1iZXIgfSB9O1xuXHRcdGlmIChwYXRoWzBdID09PSAnLicpIHtcblx0XHRcdGlmICghd29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHVyaSA9IHdvcmtzcGFjZUZvbGRlci50b1Jlc291cmNlKHBhdGgpO1xuXHRcdFx0Y29uc3QgbGluayA9IHRoaXMuY3JlYXRlTGluayh0ZXh0KTtcblx0XHRcdHRoaXMuZGVjb3JhdGVMaW5rKGxpbmssIHVyaSwgZnVsbHRleHQsIGhvdmVyQmVoYXZpb3IsIChwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKSA9PiB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB1cmksIG9wdGlvbnM6IHsgLi4ub3B0aW9ucywgcHJlc2VydmVGb2N1cyB9IH0pKTtcblx0XHRcdHJldHVybiBsaW5rO1xuXHRcdH1cblxuXHRcdGlmIChwYXRoWzBdID09PSAnficpIHtcblx0XHRcdGNvbnN0IHVzZXJIb21lID0gdGhpcy5wYXRoU2VydmljZS5yZXNvbHZlZFVzZXJIb21lO1xuXHRcdFx0aWYgKHVzZXJIb21lKSB7XG5cdFx0XHRcdHBhdGggPSBvc1BhdGguam9pbih1c2VySG9tZS5mc1BhdGgsIHBhdGguc3Vic3RyaW5nKDEpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBsaW5rID0gdGhpcy5jcmVhdGVMaW5rKHRleHQpO1xuXHRcdGxpbmsudGFiSW5kZXggPSAwO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5maWxlKG9zUGF0aC5ub3JtYWxpemUocGF0aCkpO1xuXHRcdHRoaXMuZmlsZVNlcnZpY2Uuc3RhdCh1cmkpLnRoZW4oc3RhdCA9PiB7XG5cdFx0XHRpZiAoc3RhdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmRlY29yYXRlTGluayhsaW5rLCB1cmksIGZ1bGx0ZXh0LCBob3ZlckJlaGF2aW9yLCAocHJlc2VydmVGb2N1czogYm9vbGVhbikgPT4gdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdXJpLCBvcHRpb25zOiB7IC4uLm9wdGlvbnMsIHByZXNlcnZlRm9jdXMgfSB9KSk7XG5cdFx0fSkuY2F0Y2goKCkgPT4ge1xuXHRcdFx0Ly8gSWYgdGhlIHVyaSBjYW4gbm90IGJlIHJlc29sdmVkIHdlIHNob3VsZCBub3Qgc3BhbSB0aGUgY29uc29sZSB3aXRoIGVycm9yLCByZW1haW4gcXVpdGUgIzg2NTg3XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUxpbmsodGV4dDogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG5cdFx0bGluay50ZXh0Q29udGVudCA9IHRleHQ7XG5cdFx0cmV0dXJuIGxpbms7XG5cdH1cblxuXHRwcml2YXRlIGRlY29yYXRlTGluayhsaW5rOiBIVE1MRWxlbWVudCwgdXJpOiBVUkkgfCB1bmRlZmluZWQsIGZ1bGx0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQsIGhvdmVyQmVoYXZpb3I6IERlYnVnTGlua0hvdmVyQmVoYXZpb3JUeXBlRGF0YSB8IHVuZGVmaW5lZCwgb25DbGljazogKHByZXNlcnZlRm9jdXM6IGJvb2xlYW4pID0+IHZvaWQpIHtcblx0XHRsaW5rLmNsYXNzTGlzdC5hZGQoJ2xpbmsnKTtcblx0XHRjb25zdCBmb2xsb3dMaW5rID0gdXJpICYmIHRoaXMudHVubmVsU2VydmljZS5jYW5UdW5uZWwodXJpKSA/IGxvY2FsaXplKCdmb2xsb3dGb3J3YXJkZWRMaW5rJywgXCJmb2xsb3cgbGluayB1c2luZyBmb3J3YXJkZWQgcG9ydFwiKSA6IGxvY2FsaXplKCdmb2xsb3dMaW5rJywgXCJmb2xsb3cgbGlua1wiKTtcblx0XHRjb25zdCB0aXRsZSA9IGxpbmsuYXJpYUxhYmVsID0gZnVsbHRleHRcblx0XHRcdD8gKHBsYXRmb3JtLmlzTWFjaW50b3NoID8gbG9jYWxpemUoJ2ZpbGVMaW5rV2l0aFBhdGhNYWMnLCBcIkNtZCArIGNsaWNrIHRvIHswfVxcbnsxfVwiLCBmb2xsb3dMaW5rLCBmdWxsdGV4dCkgOiBsb2NhbGl6ZSgnZmlsZUxpbmtXaXRoUGF0aCcsIFwiQ3RybCArIGNsaWNrIHRvIHswfVxcbnsxfVwiLCBmb2xsb3dMaW5rLCBmdWxsdGV4dCkpXG5cdFx0XHQ6IChwbGF0Zm9ybS5pc01hY2ludG9zaCA/IGxvY2FsaXplKCdmaWxlTGlua01hYycsIFwiQ21kICsgY2xpY2sgdG8gezB9XCIsIGZvbGxvd0xpbmspIDogbG9jYWxpemUoJ2ZpbGVMaW5rJywgXCJDdHJsICsgY2xpY2sgdG8gezB9XCIsIGZvbGxvd0xpbmspKTtcblxuXHRcdGlmIChob3ZlckJlaGF2aW9yPy50eXBlID09PSBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yLlJpY2gpIHtcblx0XHRcdGhvdmVyQmVoYXZpb3Iuc3RvcmUuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIGxpbmssIHRpdGxlKSk7XG5cdFx0fSBlbHNlIGlmIChob3ZlckJlaGF2aW9yPy50eXBlICE9PSBEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yLk5vbmUpIHtcblx0XHRcdGxpbmsudGl0bGUgPSB0aXRsZTtcblx0XHR9XG5cblx0XHRsaW5rLm9ubW91c2Vtb3ZlID0gKGV2ZW50KSA9PiB7IGxpbmsuY2xhc3NMaXN0LnRvZ2dsZSgncG9pbnRlcicsIHBsYXRmb3JtLmlzTWFjaW50b3NoID8gZXZlbnQubWV0YUtleSA6IGV2ZW50LmN0cmxLZXkpOyB9O1xuXHRcdGxpbmsub25tb3VzZWxlYXZlID0gKCkgPT4gbGluay5jbGFzc0xpc3QucmVtb3ZlKCdwb2ludGVyJyk7XG5cdFx0bGluay5vbmNsaWNrID0gKGV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBnZXRXaW5kb3cobGluaykuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoIXNlbGVjdGlvbiB8fCBzZWxlY3Rpb24udHlwZSA9PT0gJ1JhbmdlJykge1xuXHRcdFx0XHRyZXR1cm47IC8vIGRvIG5vdCBuYXZpZ2F0ZSB3aGVuIHVzZXIgaXMgc2VsZWN0aW5nXG5cdFx0XHR9XG5cdFx0XHRpZiAoIShwbGF0Zm9ybS5pc01hY2ludG9zaCA/IGV2ZW50Lm1ldGFLZXkgOiBldmVudC5jdHJsS2V5KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdG9uQ2xpY2soZmFsc2UpO1xuXHRcdH07XG5cdFx0bGluay5vbmtleWRvd24gPSBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyIHx8IGV2ZW50LmtleUNvZGUgPT09IEtleUNvZGUuU3BhY2UpIHtcblx0XHRcdFx0ZXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdG9uQ2xpY2soZXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5TcGFjZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZGV0ZWN0TGlua3ModGV4dDogc3RyaW5nKTogTGlua1BhcnRbXSB7XG5cdFx0aWYgKHRleHQubGVuZ3RoID4gTUFYX0xFTkdUSCkge1xuXHRcdFx0cmV0dXJuIFt7IGtpbmQ6ICd0ZXh0JywgdmFsdWU6IHRleHQsIGNhcHR1cmVzOiBbXSwgaW5kZXg6IDAgfV07XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVnZXhlczogUmVnRXhwW10gPSBbV0VCX0xJTktfUkVHRVgsIFBBVEhfTElOS19SRUdFWF07XG5cdFx0Y29uc3Qga2luZHM6IExpbmtLaW5kW10gPSBbJ3dlYicsICdwYXRoJ107XG5cdFx0Y29uc3QgcmVzdWx0OiBMaW5rUGFydFtdID0gW107XG5cblx0XHRjb25zdCBzcGxpdE9uZSA9ICh0ZXh0OiBzdHJpbmcsIHJlZ2V4SW5kZXg6IG51bWJlciwgYmFzZUluZGV4OiBudW1iZXIpID0+IHtcblx0XHRcdGlmIChyZWdleEluZGV4ID49IHJlZ2V4ZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHsgdmFsdWU6IHRleHQsIGtpbmQ6ICd0ZXh0JywgY2FwdHVyZXM6IFtdLCBpbmRleDogYmFzZUluZGV4IH0pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZWdleCA9IHJlZ2V4ZXNbcmVnZXhJbmRleF07XG5cdFx0XHRsZXQgY3VycmVudEluZGV4ID0gMDtcblx0XHRcdGxldCBtYXRjaDtcblx0XHRcdHJlZ2V4Lmxhc3RJbmRleCA9IDA7XG5cdFx0XHR3aGlsZSAoKG1hdGNoID0gcmVnZXguZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcblx0XHRcdFx0Y29uc3Qgc3RyaW5nQmVmb3JlTWF0Y2ggPSB0ZXh0LnN1YnN0cmluZyhjdXJyZW50SW5kZXgsIG1hdGNoLmluZGV4KTtcblx0XHRcdFx0aWYgKHN0cmluZ0JlZm9yZU1hdGNoKSB7XG5cdFx0XHRcdFx0c3BsaXRPbmUoc3RyaW5nQmVmb3JlTWF0Y2gsIHJlZ2V4SW5kZXggKyAxLCBiYXNlSW5kZXggKyBjdXJyZW50SW5kZXgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gbWF0Y2hbMF07XG5cdFx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0XHR2YWx1ZTogdmFsdWUsXG5cdFx0XHRcdFx0a2luZDoga2luZHNbcmVnZXhJbmRleF0sXG5cdFx0XHRcdFx0Y2FwdHVyZXM6IG1hdGNoLnNsaWNlKDEpLFxuXHRcdFx0XHRcdGluZGV4OiBiYXNlSW5kZXggKyBtYXRjaC5pbmRleFxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y3VycmVudEluZGV4ID0gbWF0Y2guaW5kZXggKyB2YWx1ZS5sZW5ndGg7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzdHJpbmdBZnRlck1hdGNoZXMgPSB0ZXh0LnN1YnN0cmluZyhjdXJyZW50SW5kZXgpO1xuXHRcdFx0aWYgKHN0cmluZ0FmdGVyTWF0Y2hlcykge1xuXHRcdFx0XHRzcGxpdE9uZShzdHJpbmdBZnRlck1hdGNoZXMsIHJlZ2V4SW5kZXggKyAxLCBiYXNlSW5kZXggKyBjdXJyZW50SW5kZXgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRzcGxpdE9uZSh0ZXh0LCAwLCAwKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsV0FBVyxlQUFlLGFBQWE7QUFDaEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsZUFBZTtBQUN4QixZQUFZLFlBQVk7QUFDeEIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUcvQixTQUFT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RyxZQUFZLFlBQVk7QUFBQSxRQUNyRTtBQUNBLGNBQU0sUUFBUSxNQUFNLENBQUM7QUFDckIsZUFBTyxLQUFLO0FBQUEsVUFDWDtBQUFBLFVBQ0EsTUFBTSxNQUFNLFVBQVU7QUFBQSxVQUN0QixVQUFVLE1BQU0sTUFBTSxDQUFDO0FBQUEsVUFDdkIsT0FBTyxZQUFZLE1BQU07QUFBQSxRQUMxQixDQUFDO0FBQ0QsdUJBQWUsTUFBTSxRQUFRLE1BQU07QUFBQSxNQUNwQztBQUNBLFlBQU0scUJBQXFCQSxNQUFLLFVBQVUsWUFBWTtBQUN0RCxVQUFJLG9CQUFvQjtBQUN2QixpQkFBUyxvQkFBb0IsYUFBYSxHQUFHLFlBQVksWUFBWTtBQUFBLE1BQ3RFO0FBQUEsSUFDRDtBQUVBLGFBQVMsTUFBTSxHQUFHLENBQUM7QUFDbkIsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQTlUYSxlQUFOO0FBQUEsRUFFSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVRVOyIsCiAgIm5hbWVzIjogWyJEZWJ1Z0xpbmtIb3ZlckJlaGF2aW9yIiwgImNvbnRhaW5lciIsICJ1cmkiLCAibGluayIsICJ0ZXh0Il0KfQo=
