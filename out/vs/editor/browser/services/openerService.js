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
import * as dom from "../../../base/browser/dom.js";
import { mainWindow } from "../../../base/browser/window.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { LinkedList } from "../../../base/common/linkedList.js";
import { ResourceMap } from "../../../base/common/map.js";
import { parse } from "../../../base/common/marshalling.js";
import { matchesScheme, matchesSomeScheme, Schemas } from "../../../base/common/network.js";
import { normalizePath } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { ICodeEditorService } from "./codeEditorService.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
import { EditorOpenSource } from "../../../platform/editor/common/editor.js";
import { extractSelection } from "../../../platform/opener/common/opener.js";
let CommandOpener = class {
  constructor(_commandService) {
    this._commandService = _commandService;
  }
  async open(target, options) {
    if (!matchesScheme(target, Schemas.command)) {
      return false;
    }
    if (!options?.allowCommands) {
      return true;
    }
    if (typeof target === "string") {
      target = URI.parse(target);
    }
    if (Array.isArray(options.allowCommands)) {
      if (!options.allowCommands.includes(target.path)) {
        return true;
      }
    }
    let args = [];
    try {
      args = parse(decodeURIComponent(target.query));
    } catch {
      try {
        args = parse(target.query);
      } catch {
      }
    }
    if (!Array.isArray(args)) {
      args = [args];
    }
    await this._commandService.executeCommand(target.path, ...args);
    return true;
  }
};
CommandOpener = __decorateClass([
  __decorateParam(0, ICommandService)
], CommandOpener);
let EditorOpener = class {
  constructor(_editorService) {
    this._editorService = _editorService;
  }
  async open(target, options) {
    if (typeof target === "string") {
      target = URI.parse(target);
    }
    const { selection, uri } = extractSelection(target);
    target = uri;
    if (target.scheme === Schemas.file) {
      target = normalizePath(target);
    }
    await this._editorService.openCodeEditor(
      {
        resource: target,
        options: {
          selection,
          source: options?.fromUserGesture ? EditorOpenSource.USER : EditorOpenSource.API,
          ...options?.editorOptions
        }
      },
      this._editorService.getFocusedCodeEditor(),
      options?.openToSide
    );
    return true;
  }
};
EditorOpener = __decorateClass([
  __decorateParam(0, ICodeEditorService)
], EditorOpener);
let OpenerService = class {
  constructor(editorService, commandService) {
    this._openers = new LinkedList();
    this._validators = new LinkedList();
    this._resolvers = new LinkedList();
    this._resolvedUriTargets = new ResourceMap((uri) => uri.with({ path: null, fragment: null, query: null }).toString());
    this._externalOpeners = new LinkedList();
    this._defaultExternalOpener = {
      openExternal: async (href) => {
        if (matchesSomeScheme(href, Schemas.http, Schemas.https)) {
          dom.windowOpenNoOpener(href);
        } else {
          mainWindow.location.href = href;
        }
        return true;
      }
    };
    this._openers.push({
      open: async (target, options) => {
        if (options?.openExternal || matchesSomeScheme(target, Schemas.mailto, Schemas.http, Schemas.https, Schemas.vsls)) {
          await this._doOpenExternal(target, options);
          return true;
        }
        return false;
      }
    });
    this._openers.push(new CommandOpener(commandService));
    this._openers.push(new EditorOpener(editorService));
  }
  registerOpener(opener) {
    const remove = this._openers.unshift(opener);
    return { dispose: remove };
  }
  registerValidator(validator) {
    const remove = this._validators.push(validator);
    return { dispose: remove };
  }
  registerExternalUriResolver(resolver) {
    const remove = this._resolvers.push(resolver);
    return { dispose: remove };
  }
  setDefaultExternalOpener(externalOpener) {
    this._defaultExternalOpener = externalOpener;
  }
  registerExternalOpener(opener) {
    const remove = this._externalOpeners.push(opener);
    return { dispose: remove };
  }
  async open(target, options) {
    if (!options?.skipValidation) {
      const targetURI = typeof target === "string" ? URI.parse(target) : target;
      const validationTarget = this._resolvedUriTargets.get(targetURI) ?? target;
      for (const validator of this._validators) {
        if (!await validator.shouldOpen(validationTarget, options)) {
          return false;
        }
      }
    }
    for (const opener of this._openers) {
      const handled = await opener.open(target, options);
      if (handled) {
        return true;
      }
    }
    return false;
  }
  async resolveExternalUri(resource, options) {
    for (const resolver of this._resolvers) {
      try {
        const result = await resolver.resolveExternalUri(resource, options);
        if (result) {
          if (!this._resolvedUriTargets.has(result.resolved)) {
            this._resolvedUriTargets.set(result.resolved, resource);
          }
          return result;
        }
      } catch {
      }
    }
    throw new Error("Could not resolve external URI: " + resource.toString());
  }
  async _doOpenExternal(resource, options) {
    const uri = typeof resource === "string" ? URI.parse(resource) : resource;
    let externalUri;
    try {
      externalUri = (await this.resolveExternalUri(uri, options)).resolved;
    } catch {
      externalUri = uri;
    }
    let href;
    if (typeof resource === "string" && uri.toString() === externalUri.toString()) {
      href = resource;
    } else {
      href = encodeURI(externalUri.toString(true));
    }
    if (options?.allowContributedOpeners) {
      const preferredOpenerId = typeof options?.allowContributedOpeners === "string" ? options?.allowContributedOpeners : void 0;
      for (const opener of this._externalOpeners) {
        const didOpen = await opener.openExternal(href, {
          sourceUri: uri,
          preferredOpenerId
        }, CancellationToken.None);
        if (didOpen) {
          return true;
        }
      }
    }
    return this._defaultExternalOpener.openExternal(href, { sourceUri: uri }, CancellationToken.None);
  }
  dispose() {
    this._validators.clear();
  }
};
OpenerService = __decorateClass([
  __decorateParam(0, ICodeEditorService),
  __decorateParam(1, ICommandService)
], OpenerService);
export {
  OpenerService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9vcGVuZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZExpc3QuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBtYXRjaGVzU2NoZW1lLCBtYXRjaGVzU29tZVNjaGVtZSwgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3BlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGV4dHJhY3RTZWxlY3Rpb24sIElFeHRlcm5hbE9wZW5lciwgSUV4dGVybmFsVXJpUmVzb2x2ZXIsIElPcGVuZXIsIElPcGVuZXJTZXJ2aWNlLCBJUmVzb2x2ZWRFeHRlcm5hbFVyaSwgSVZhbGlkYXRvciwgT3Blbk9wdGlvbnMsIFJlc29sdmVFeHRlcm5hbFVyaU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5cbmNsYXNzIENvbW1hbmRPcGVuZXIgaW1wbGVtZW50cyBJT3BlbmVyIHtcblxuXHRjb25zdHJ1Y3RvcihASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UpIHsgfVxuXG5cdGFzeW5jIG9wZW4odGFyZ2V0OiBVUkkgfCBzdHJpbmcsIG9wdGlvbnM/OiBPcGVuT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghbWF0Y2hlc1NjaGVtZSh0YXJnZXQsIFNjaGVtYXMuY29tbWFuZCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIW9wdGlvbnM/LmFsbG93Q29tbWFuZHMpIHtcblx0XHRcdC8vIHNpbGVudGx5IGlnbm9yZSBjb21tYW5kcyB3aGVuIGNvbW1hbmQtbGlua3MgYXJlIGRpc2FibGVkLCBhbHNvXG5cdFx0XHQvLyBzdXBwcmVzcyBvdGhlciBvcGVuZXJzIGJ5IHJldHVybmluZyBUUlVFXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRhcmdldCA9IFVSSS5wYXJzZSh0YXJnZXQpO1xuXHRcdH1cblxuXHRcdGlmIChBcnJheS5pc0FycmF5KG9wdGlvbnMuYWxsb3dDb21tYW5kcykpIHtcblx0XHRcdC8vIE9ubHkgYWxsb3cgc3BlY2lmaWMgY29tbWFuZHNcblx0XHRcdGlmICghb3B0aW9ucy5hbGxvd0NvbW1hbmRzLmluY2x1ZGVzKHRhcmdldC5wYXRoKSkge1xuXHRcdFx0XHQvLyBTdXBwcmVzcyBvdGhlciBvcGVuZXJzIGJ5IHJldHVybmluZyBUUlVFXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGV4ZWN1dGUgYXMgY29tbWFuZFxuXHRcdGxldCBhcmdzOiBhbnkgPSBbXTtcblx0XHR0cnkge1xuXHRcdFx0YXJncyA9IHBhcnNlKGRlY29kZVVSSUNvbXBvbmVudCh0YXJnZXQucXVlcnkpKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIGlnbm9yZSBhbmQgcmV0cnlcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGFyZ3MgPSBwYXJzZSh0YXJnZXQucXVlcnkpO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIGlnbm9yZSBlcnJvclxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYXJncykpIHtcblx0XHRcdGFyZ3MgPSBbYXJnc107XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHRhcmdldC5wYXRoLCAuLi5hcmdzKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5jbGFzcyBFZGl0b3JPcGVuZXIgaW1wbGVtZW50cyBJT3BlbmVyIHtcblxuXHRjb25zdHJ1Y3RvcihASUNvZGVFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSkgeyB9XG5cblx0YXN5bmMgb3Blbih0YXJnZXQ6IFVSSSB8IHN0cmluZywgb3B0aW9uczogT3Blbk9wdGlvbnMpIHtcblx0XHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRhcmdldCA9IFVSSS5wYXJzZSh0YXJnZXQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgc2VsZWN0aW9uLCB1cmkgfSA9IGV4dHJhY3RTZWxlY3Rpb24odGFyZ2V0KTtcblx0XHR0YXJnZXQgPSB1cmk7XG5cblx0XHRpZiAodGFyZ2V0LnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHR0YXJnZXQgPSBub3JtYWxpemVQYXRoKHRhcmdldCk7IC8vIHdvcmthcm91bmQgZm9yIG5vbi1ub3JtYWxpemVkIHBhdGhzIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI5NTQpXG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fZWRpdG9yU2VydmljZS5vcGVuQ29kZUVkaXRvcihcblx0XHRcdHtcblx0XHRcdFx0cmVzb3VyY2U6IHRhcmdldCxcblx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdHNlbGVjdGlvbixcblx0XHRcdFx0XHRzb3VyY2U6IG9wdGlvbnM/LmZyb21Vc2VyR2VzdHVyZSA/IEVkaXRvck9wZW5Tb3VyY2UuVVNFUiA6IEVkaXRvck9wZW5Tb3VyY2UuQVBJLFxuXHRcdFx0XHRcdC4uLm9wdGlvbnM/LmVkaXRvck9wdGlvbnNcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSxcblx0XHRcdG9wdGlvbnM/Lm9wZW5Ub1NpZGVcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5lclNlcnZpY2UgaW1wbGVtZW50cyBJT3BlbmVyU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3BlbmVycyA9IG5ldyBMaW5rZWRMaXN0PElPcGVuZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3ZhbGlkYXRvcnMgPSBuZXcgTGlua2VkTGlzdDxJVmFsaWRhdG9yPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvbHZlcnMgPSBuZXcgTGlua2VkTGlzdDxJRXh0ZXJuYWxVcmlSZXNvbHZlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzb2x2ZWRVcmlUYXJnZXRzID0gbmV3IFJlc291cmNlTWFwPFVSST4odXJpID0+IHVyaS53aXRoKHsgcGF0aDogbnVsbCwgZnJhZ21lbnQ6IG51bGwsIHF1ZXJ5OiBudWxsIH0pLnRvU3RyaW5nKCkpO1xuXG5cdHByaXZhdGUgX2RlZmF1bHRFeHRlcm5hbE9wZW5lcjogSUV4dGVybmFsT3BlbmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRlcm5hbE9wZW5lcnMgPSBuZXcgTGlua2VkTGlzdDxJRXh0ZXJuYWxPcGVuZXI+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXHRcdC8vIERlZmF1bHQgZXh0ZXJuYWwgb3BlbmVyIGlzIGdvaW5nIHRocm91Z2ggd2luZG93Lm9wZW4oKVxuXHRcdHRoaXMuX2RlZmF1bHRFeHRlcm5hbE9wZW5lciA9IHtcblx0XHRcdG9wZW5FeHRlcm5hbDogYXN5bmMgaHJlZiA9PiB7XG5cdFx0XHRcdC8vIGVuc3VyZSB0byBvcGVuIEhUVFAvSFRUUFMgbGlua3MgaW50byBuZXcgd2luZG93c1xuXHRcdFx0XHQvLyB0byBub3QgdHJpZ2dlciBhIG5hdmlnYXRpb24uIEFueSBvdGhlciBsaW5rIGlzXG5cdFx0XHRcdC8vIHNhZmUgdG8gYmUgc2V0IGFzIEhSRUYgdG8gcHJldmVudCBhIGJsYW5rIHdpbmRvd1xuXHRcdFx0XHQvLyBmcm9tIG9wZW5pbmcuXG5cdFx0XHRcdGlmIChtYXRjaGVzU29tZVNjaGVtZShocmVmLCBTY2hlbWFzLmh0dHAsIFNjaGVtYXMuaHR0cHMpKSB7XG5cdFx0XHRcdFx0ZG9tLndpbmRvd09wZW5Ob09wZW5lcihocmVmKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtYWluV2luZG93LmxvY2F0aW9uLmhyZWYgPSBocmVmO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBEZWZhdWx0IG9wZW5lcjogYW55IGV4dGVybmFsLCBtYWl0bywgaHR0cChzKSwgY29tbWFuZCwgYW5kIGNhdGNoLWFsbC1lZGl0b3JzXG5cdFx0dGhpcy5fb3BlbmVycy5wdXNoKHtcblx0XHRcdG9wZW46IGFzeW5jICh0YXJnZXQ6IFVSSSB8IHN0cmluZywgb3B0aW9ucz86IE9wZW5PcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChvcHRpb25zPy5vcGVuRXh0ZXJuYWwgfHwgbWF0Y2hlc1NvbWVTY2hlbWUodGFyZ2V0LCBTY2hlbWFzLm1haWx0bywgU2NoZW1hcy5odHRwLCBTY2hlbWFzLmh0dHBzLCBTY2hlbWFzLnZzbHMpKSB7XG5cdFx0XHRcdFx0Ly8gb3BlbiBleHRlcm5hbGx5XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fZG9PcGVuRXh0ZXJuYWwodGFyZ2V0LCBvcHRpb25zKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5fb3BlbmVycy5wdXNoKG5ldyBDb21tYW5kT3BlbmVyKGNvbW1hbmRTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fb3BlbmVycy5wdXNoKG5ldyBFZGl0b3JPcGVuZXIoZWRpdG9yU2VydmljZSkpO1xuXHR9XG5cblx0cmVnaXN0ZXJPcGVuZXIob3BlbmVyOiBJT3BlbmVyKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlbW92ZSA9IHRoaXMuX29wZW5lcnMudW5zaGlmdChvcGVuZXIpO1xuXHRcdHJldHVybiB7IGRpc3Bvc2U6IHJlbW92ZSB9O1xuXHR9XG5cblx0cmVnaXN0ZXJWYWxpZGF0b3IodmFsaWRhdG9yOiBJVmFsaWRhdG9yKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHJlbW92ZSA9IHRoaXMuX3ZhbGlkYXRvcnMucHVzaCh2YWxpZGF0b3IpO1xuXHRcdHJldHVybiB7IGRpc3Bvc2U6IHJlbW92ZSB9O1xuXHR9XG5cblx0cmVnaXN0ZXJFeHRlcm5hbFVyaVJlc29sdmVyKHJlc29sdmVyOiBJRXh0ZXJuYWxVcmlSZXNvbHZlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCByZW1vdmUgPSB0aGlzLl9yZXNvbHZlcnMucHVzaChyZXNvbHZlcik7XG5cdFx0cmV0dXJuIHsgZGlzcG9zZTogcmVtb3ZlIH07XG5cdH1cblxuXHRzZXREZWZhdWx0RXh0ZXJuYWxPcGVuZXIoZXh0ZXJuYWxPcGVuZXI6IElFeHRlcm5hbE9wZW5lcik6IHZvaWQge1xuXHRcdHRoaXMuX2RlZmF1bHRFeHRlcm5hbE9wZW5lciA9IGV4dGVybmFsT3BlbmVyO1xuXHR9XG5cblx0cmVnaXN0ZXJFeHRlcm5hbE9wZW5lcihvcGVuZXI6IElFeHRlcm5hbE9wZW5lcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCByZW1vdmUgPSB0aGlzLl9leHRlcm5hbE9wZW5lcnMucHVzaChvcGVuZXIpO1xuXHRcdHJldHVybiB7IGRpc3Bvc2U6IHJlbW92ZSB9O1xuXHR9XG5cblx0YXN5bmMgb3Blbih0YXJnZXQ6IFVSSSB8IHN0cmluZywgb3B0aW9ucz86IE9wZW5PcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBjaGVjayB3aXRoIGNvbnRyaWJ1dGVkIHZhbGlkYXRvcnNcblx0XHRpZiAoIW9wdGlvbnM/LnNraXBWYWxpZGF0aW9uKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRVUkkgPSB0eXBlb2YgdGFyZ2V0ID09PSAnc3RyaW5nJyA/IFVSSS5wYXJzZSh0YXJnZXQpIDogdGFyZ2V0O1xuXHRcdFx0Y29uc3QgdmFsaWRhdGlvblRhcmdldCA9IHRoaXMuX3Jlc29sdmVkVXJpVGFyZ2V0cy5nZXQodGFyZ2V0VVJJKSA/PyB0YXJnZXQ7IC8vIHZhbGlkYXRlIGFnYWluc3QgdGhlIG9yaWdpbmFsIFVSSSB0aGF0IHRoaXMgVVJJIHJlc29sdmVzIHRvLCBpZiBvbmUgZXhpc3RzXG5cdFx0XHRmb3IgKGNvbnN0IHZhbGlkYXRvciBvZiB0aGlzLl92YWxpZGF0b3JzKSB7XG5cdFx0XHRcdGlmICghKGF3YWl0IHZhbGlkYXRvci5zaG91bGRPcGVuKHZhbGlkYXRpb25UYXJnZXQsIG9wdGlvbnMpKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGNoZWNrIHdpdGggY29udHJpYnV0ZWQgb3BlbmVyc1xuXHRcdGZvciAoY29uc3Qgb3BlbmVyIG9mIHRoaXMuX29wZW5lcnMpIHtcblx0XHRcdGNvbnN0IGhhbmRsZWQgPSBhd2FpdCBvcGVuZXIub3Blbih0YXJnZXQsIG9wdGlvbnMpO1xuXHRcdFx0aWYgKGhhbmRsZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUV4dGVybmFsVXJpKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBSZXNvbHZlRXh0ZXJuYWxVcmlPcHRpb25zKTogUHJvbWlzZTxJUmVzb2x2ZWRFeHRlcm5hbFVyaT4ge1xuXHRcdGZvciAoY29uc3QgcmVzb2x2ZXIgb2YgdGhpcy5fcmVzb2x2ZXJzKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCByZXNvbHZlci5yZXNvbHZlRXh0ZXJuYWxVcmkocmVzb3VyY2UsIG9wdGlvbnMpO1xuXHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLl9yZXNvbHZlZFVyaVRhcmdldHMuaGFzKHJlc3VsdC5yZXNvbHZlZCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Jlc29sdmVkVXJpVGFyZ2V0cy5zZXQocmVzdWx0LnJlc29sdmVkLCByZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBub29wXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgcmVzb2x2ZSBleHRlcm5hbCBVUkk6ICcgKyByZXNvdXJjZS50b1N0cmluZygpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2RvT3BlbkV4dGVybmFsKHJlc291cmNlOiBVUkkgfCBzdHJpbmcsIG9wdGlvbnM6IE9wZW5PcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvL3RvZG9AanJpZWtlbiBJRXh0ZXJuYWxVcmlSZXNvbHZlciBzaG91bGQgc3VwcG9ydCBgdXJpOiBVUkkgfCBzdHJpbmdgXG5cdFx0Y29uc3QgdXJpID0gdHlwZW9mIHJlc291cmNlID09PSAnc3RyaW5nJyA/IFVSSS5wYXJzZShyZXNvdXJjZSkgOiByZXNvdXJjZTtcblx0XHRsZXQgZXh0ZXJuYWxVcmk6IFVSSTtcblxuXHRcdHRyeSB7XG5cdFx0XHRleHRlcm5hbFVyaSA9IChhd2FpdCB0aGlzLnJlc29sdmVFeHRlcm5hbFVyaSh1cmksIG9wdGlvbnMpKS5yZXNvbHZlZDtcblx0XHR9IGNhdGNoIHtcblx0XHRcdGV4dGVybmFsVXJpID0gdXJpO1xuXHRcdH1cblxuXHRcdGxldCBocmVmOiBzdHJpbmc7XG5cdFx0aWYgKHR5cGVvZiByZXNvdXJjZSA9PT0gJ3N0cmluZycgJiYgdXJpLnRvU3RyaW5nKCkgPT09IGV4dGVybmFsVXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdC8vIG9wZW4gdGhlIHVybC1zdHJpbmcgQVMgSVNcblx0XHRcdGhyZWYgPSByZXNvdXJjZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gb3BlbiBVUkkgdXNpbmcgdGhlIHRvU3RyaW5nKG5vRW5jb2RlKStlbmNvZGVVUkktdHJpY2tcblx0XHRcdGhyZWYgPSBlbmNvZGVVUkkoZXh0ZXJuYWxVcmkudG9TdHJpbmcodHJ1ZSkpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy5hbGxvd0NvbnRyaWJ1dGVkT3BlbmVycykge1xuXHRcdFx0Y29uc3QgcHJlZmVycmVkT3BlbmVySWQgPSB0eXBlb2Ygb3B0aW9ucz8uYWxsb3dDb250cmlidXRlZE9wZW5lcnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucz8uYWxsb3dDb250cmlidXRlZE9wZW5lcnMgOiB1bmRlZmluZWQ7XG5cdFx0XHRmb3IgKGNvbnN0IG9wZW5lciBvZiB0aGlzLl9leHRlcm5hbE9wZW5lcnMpIHtcblx0XHRcdFx0Y29uc3QgZGlkT3BlbiA9IGF3YWl0IG9wZW5lci5vcGVuRXh0ZXJuYWwoaHJlZiwge1xuXHRcdFx0XHRcdHNvdXJjZVVyaTogdXJpLFxuXHRcdFx0XHRcdHByZWZlcnJlZE9wZW5lcklkLFxuXHRcdFx0XHR9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0aWYgKGRpZE9wZW4pIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9kZWZhdWx0RXh0ZXJuYWxPcGVuZXIub3BlbkV4dGVybmFsKGhyZWYsIHsgc291cmNlVXJpOiB1cmkgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3ZhbGlkYXRvcnMuY2xlYXIoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZUFBZSxtQkFBbUIsZUFBZTtBQUMxRCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLFdBQVc7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBa0s7QUFFM0ssSUFBTSxnQkFBTixNQUF1QztBQUFBLEVBRXRDLFlBQThDLGlCQUFrQztBQUFsQztBQUFBLEVBQW9DO0FBQUEsRUFFbEYsTUFBTSxLQUFLLFFBQXNCLFNBQXlDO0FBQ3pFLFFBQUksQ0FBQyxjQUFjLFFBQVEsUUFBUSxPQUFPLEdBQUc7QUFDNUMsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLENBQUMsU0FBUyxlQUFlO0FBRzVCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxPQUFPLFdBQVcsVUFBVTtBQUMvQixlQUFTLElBQUksTUFBTSxNQUFNO0FBQUEsSUFDMUI7QUFFQSxRQUFJLE1BQU0sUUFBUSxRQUFRLGFBQWEsR0FBRztBQUV6QyxVQUFJLENBQUMsUUFBUSxjQUFjLFNBQVMsT0FBTyxJQUFJLEdBQUc7QUFFakQsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBR0EsUUFBSSxPQUFZLENBQUM7QUFDakIsUUFBSTtBQUNILGFBQU8sTUFBTSxtQkFBbUIsT0FBTyxLQUFLLENBQUM7QUFBQSxJQUM5QyxRQUFRO0FBRVAsVUFB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
