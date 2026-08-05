import { parse as jsonParse, getNodeType } from "../../../../base/common/json.js";
import { localize } from "../../../../nls.js";
import { extname, basename } from "../../../../base/common/path.js";
import { SnippetParser, Variable, Placeholder, Text } from "../../../../editor/contrib/snippet/browser/snippetParser.js";
import { KnownSnippetVariableNames } from "../../../../editor/contrib/snippet/browser/snippetVariables.js";
import { relativePath } from "../../../../base/common/resources.js";
import { isObject } from "../../../../base/common/types.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { WindowIdleValue, getActiveWindow } from "../../../../base/browser/dom.js";
class SnippetBodyInsights {
  constructor(body) {
    this.isBogous = false;
    this.isTrivial = false;
    this.usesClipboardVariable = false;
    this.usesSelectionVariable = false;
    this.codeSnippet = body;
    const textmateSnippet = new SnippetParser().parse(body, false);
    const placeholders = /* @__PURE__ */ new Map();
    let placeholderMax = 0;
    for (const placeholder of textmateSnippet.placeholders) {
      placeholderMax = Math.max(placeholderMax, placeholder.index);
    }
    if (textmateSnippet.placeholders.length === 0) {
      this.isTrivial = true;
    } else if (placeholderMax === 0) {
      const last = textmateSnippet.children.at(-1);
      this.isTrivial = last instanceof Placeholder && last.isFinalTabstop;
    }
    const stack = [...textmateSnippet.children];
    while (stack.length > 0) {
      const marker = stack.shift();
      if (marker instanceof Variable) {
        if (marker.children.length === 0 && !KnownSnippetVariableNames[marker.name]) {
          const index = placeholders.has(marker.name) ? placeholders.get(marker.name) : ++placeholderMax;
          placeholders.set(marker.name, index);
          const synthetic = new Placeholder(index).appendChild(new Text(marker.name));
          textmateSnippet.replace(marker, [synthetic]);
          this.isBogous = true;
        }
        switch (marker.name) {
          case "CLIPBOARD":
            this.usesClipboardVariable = true;
            break;
          case "SELECTION":
          case "TM_SELECTED_TEXT":
            this.usesSelectionVariable = true;
            break;
        }
      } else {
        stack.push(...marker.children);
      }
    }
    if (this.isBogous) {
      this.codeSnippet = textmateSnippet.toTextmateString();
    }
  }
}
class Snippet {
  constructor(isFileTemplate, scopes, name, prefix, description, body, source, snippetSource, snippetIdentifier, extensionId) {
    this.isFileTemplate = isFileTemplate;
    this.scopes = scopes;
    this.name = name;
    this.prefix = prefix;
    this.description = description;
    this.body = body;
    this.source = source;
    this.snippetSource = snippetSource;
    this.snippetIdentifier = snippetIdentifier;
    this.extensionId = extensionId;
    this.prefixLow = prefix.toLowerCase();
    this._bodyInsights = new WindowIdleValue(getActiveWindow(), () => new SnippetBodyInsights(this.body));
  }
  get codeSnippet() {
    return this._bodyInsights.value.codeSnippet;
  }
  get isBogous() {
    return this._bodyInsights.value.isBogous;
  }
  get isTrivial() {
    return this._bodyInsights.value.isTrivial;
  }
  get needsClipboard() {
    return this._bodyInsights.value.usesClipboardVariable;
  }
  get usesSelection() {
    return this._bodyInsights.value.usesSelectionVariable;
  }
}
function isJsonSerializedSnippet(thing) {
  return isObject(thing) && Boolean(thing.body);
}
var SnippetSource = /* @__PURE__ */ ((SnippetSource2) => {
  SnippetSource2[SnippetSource2["User"] = 1] = "User";
  SnippetSource2[SnippetSource2["Workspace"] = 2] = "Workspace";
  SnippetSource2[SnippetSource2["Extension"] = 3] = "Extension";
  return SnippetSource2;
})(SnippetSource || {});
class SnippetFile {
  constructor(source, location, defaultScopes, _extension, _fileService, _extensionResourceLoaderService) {
    this.source = source;
    this.location = location;
    this.defaultScopes = defaultScopes;
    this._extension = _extension;
    this._fileService = _fileService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this.data = [];
    this.isGlobalSnippets = extname(location.path) === ".code-snippets";
    this.isUserSnippets = !this._extension;
  }
  select(selector, bucket) {
    if (this.isGlobalSnippets || !this.isUserSnippets) {
      this._scopeSelect(selector, bucket);
    } else {
      this._filepathSelect(selector, bucket);
    }
  }
  _filepathSelect(selector, bucket) {
    if (selector + ".json" === basename(this.location.path)) {
      bucket.push(...this.data);
    }
  }
  _scopeSelect(selector, bucket) {
    for (const snippet of this.data) {
      const len = snippet.scopes.length;
      if (len === 0) {
        bucket.push(snippet);
      } else {
        for (let i = 0; i < len; i++) {
          if (snippet.scopes[i] === selector) {
            bucket.push(snippet);
            break;
          }
        }
      }
    }
    const idx = selector.lastIndexOf(".");
    if (idx >= 0) {
      this._scopeSelect(selector.substring(0, idx), bucket);
    }
  }
  async _load() {
    if (this._extension) {
      return this._extensionResourceLoaderService.readExtensionResource(this.location);
    } else {
      const content = await this._fileService.readFile(this.location);
      return content.value.toString();
    }
  }
  load() {
    if (!this._loadPromise) {
      this._loadPromise = Promise.resolve(this._load()).then((content) => {
        const data = jsonParse(content);
        if (getNodeType(data) === "object") {
          for (const [name, scopeOrTemplate] of Object.entries(data)) {
            if (isJsonSerializedSnippet(scopeOrTemplate)) {
              this._parseSnippet(name, scopeOrTemplate, this.data);
            } else {
              for (const [name2, template] of Object.entries(scopeOrTemplate)) {
                this._parseSnippet(name2, template, this.data);
              }
            }
          }
        }
        return this;
      });
    }
    return this._loadPromise;
  }
  reset() {
    this._loadPromise = void 0;
    this.data.length = 0;
  }
  _parseSnippet(name, snippet, bucket) {
    let { isFileTemplate, prefix, body, description } = snippet;
    if (!prefix) {
      prefix = "";
    }
    if (Array.isArray(body)) {
      body = body.join("\n");
    }
    if (typeof body !== "string") {
      return;
    }
    if (Array.isArray(description)) {
      description = description.join("\n");
    }
    let scopes;
    if (this.defaultScopes) {
      scopes = this.defaultScopes;
    } else if (typeof snippet.scope === "string") {
      scopes = snippet.scope.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      scopes = [];
    }
    let source;
    if (this._extension) {
      source = this._extension.displayName || this._extension.name;
    } else if (this.source === 2 /* Workspace */) {
      source = localize("source.workspaceSnippetGlobal", "Workspace Snippet");
    } else {
      if (this.isGlobalSnippets) {
        source = localize("source.userSnippetGlobal", "Global User Snippet");
      } else {
        source = localize("source.userSnippet", "User Snippet");
      }
    }
    for (const _prefix of Iterable.wrap(prefix)) {
      bucket.push(new Snippet(
        Boolean(isFileTemplate),
        scopes,
        name,
        _prefix,
        description,
        body,
        source,
        this.source,
        this._extension ? `${relativePath(this._extension.extensionLocation, this.location)}/${name}` : `${basename(this.location.path)}/${name}`,
        this._extension?.identifier
      ));
    }
  }
}
export {
  Snippet,
  SnippetFile,
  SnippetSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy9icm93c2VyL3NuaXBwZXRzRmlsZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHBhcnNlIGFzIGpzb25QYXJzZSwgZ2V0Tm9kZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGV4dG5hbWUsIGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0UGFyc2VyLCBWYXJpYWJsZSwgUGxhY2Vob2xkZXIsIFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFBhcnNlci5qcyc7XG5pbXBvcnQgeyBLbm93blNuaXBwZXRWYXJpYWJsZU5hbWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc25pcHBldC9icm93c2VyL3NuaXBwZXRWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25SZXNvdXJjZUxvYWRlci9jb21tb24vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIuanMnO1xuaW1wb3J0IHsgcmVsYXRpdmVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBXaW5kb3dJZGxlVmFsdWUsIGdldEFjdGl2ZVdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5jbGFzcyBTbmlwcGV0Qm9keUluc2lnaHRzIHtcblxuXHRyZWFkb25seSBjb2RlU25pcHBldDogc3RyaW5nO1xuXG5cdC8qKiBUaGUgc25pcHBldCB1c2VzIGJhZCBwbGFjZWhvbGRlcnMgd2hpY2ggY29sbGlkZSB3aXRoIHZhcmlhYmxlIG5hbWVzICovXG5cdHJlYWRvbmx5IGlzQm9nb3VzOiBib29sZWFuO1xuXG5cdC8qKiBUaGUgc25pcHBldCBoYXMgbm8gcGxhY2Vob2xkZXIgb2YgdGhlIGZpbmFsIHBsYWNlaG9sZGVyIGlzIGF0IHRoZSBlbmQgKi9cblx0cmVhZG9ubHkgaXNUcml2aWFsOiBib29sZWFuO1xuXG5cdHJlYWRvbmx5IHVzZXNDbGlwYm9hcmRWYXJpYWJsZTogYm9vbGVhbjtcblx0cmVhZG9ubHkgdXNlc1NlbGVjdGlvblZhcmlhYmxlOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKGJvZHk6IHN0cmluZykge1xuXG5cdFx0Ly8gaW5pdCB3aXRoIGRlZmF1bHRzXG5cdFx0dGhpcy5pc0JvZ291cyA9IGZhbHNlO1xuXHRcdHRoaXMuaXNUcml2aWFsID0gZmFsc2U7XG5cdFx0dGhpcy51c2VzQ2xpcGJvYXJkVmFyaWFibGUgPSBmYWxzZTtcblx0XHR0aGlzLnVzZXNTZWxlY3Rpb25WYXJpYWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuY29kZVNuaXBwZXQgPSBib2R5O1xuXG5cdFx0Ly8gY2hlY2sgc25pcHBldC4uLlxuXHRcdGNvbnN0IHRleHRtYXRlU25pcHBldCA9IG5ldyBTbmlwcGV0UGFyc2VyKCkucGFyc2UoYm9keSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgcGxhY2Vob2xkZXJzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRsZXQgcGxhY2Vob2xkZXJNYXggPSAwO1xuXHRcdGZvciAoY29uc3QgcGxhY2Vob2xkZXIgb2YgdGV4dG1hdGVTbmlwcGV0LnBsYWNlaG9sZGVycykge1xuXHRcdFx0cGxhY2Vob2xkZXJNYXggPSBNYXRoLm1heChwbGFjZWhvbGRlck1heCwgcGxhY2Vob2xkZXIuaW5kZXgpO1xuXHRcdH1cblxuXHRcdC8vIG1hcmsgc25pcHBldCBhcyB0cml2aWFsIHdoZW4gdGhlcmUgaXMgbm8gcGxhY2Vob2xkZXJzIG9yIHdoZW4gdGhlIG9ubHlcblx0XHQvLyBwbGFjZWhvbGRlciBpcyB0aGUgZmluYWwgdGFic3RvcCBhbmQgaXQgaXMgYXQgdGhlIHZlcnkgZW5kLlxuXHRcdGlmICh0ZXh0bWF0ZVNuaXBwZXQucGxhY2Vob2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5pc1RyaXZpYWwgPSB0cnVlO1xuXHRcdH0gZWxzZSBpZiAocGxhY2Vob2xkZXJNYXggPT09IDApIHtcblx0XHRcdGNvbnN0IGxhc3QgPSB0ZXh0bWF0ZVNuaXBwZXQuY2hpbGRyZW4uYXQoLTEpO1xuXHRcdFx0dGhpcy5pc1RyaXZpYWwgPSBsYXN0IGluc3RhbmNlb2YgUGxhY2Vob2xkZXIgJiYgbGFzdC5pc0ZpbmFsVGFic3RvcDtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFjayA9IFsuLi50ZXh0bWF0ZVNuaXBwZXQuY2hpbGRyZW5dO1xuXHRcdHdoaWxlIChzdGFjay5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBtYXJrZXIgPSBzdGFjay5zaGlmdCgpITtcblx0XHRcdGlmIChtYXJrZXIgaW5zdGFuY2VvZiBWYXJpYWJsZSkge1xuXG5cdFx0XHRcdGlmIChtYXJrZXIuY2hpbGRyZW4ubGVuZ3RoID09PSAwICYmICFLbm93blNuaXBwZXRWYXJpYWJsZU5hbWVzW21hcmtlci5uYW1lXSkge1xuXHRcdFx0XHRcdC8vIGEgJ3ZhcmlhYmxlJyB3aXRob3V0IGEgZGVmYXVsdCB2YWx1ZSBhbmQgbm90IGJlaW5nIG9uZSBvZiBvdXIgc3VwcG9ydGVkXG5cdFx0XHRcdFx0Ly8gdmFyaWFibGVzIGlzIGF1dG9tYXRpY2FsbHkgdHVybmVkIGludG8gYSBwbGFjZWhvbGRlci4gVGhpcyBpcyB0byByZXN0b3JlXG5cdFx0XHRcdFx0Ly8gYSBidWcgd2UgaGFkIGJlZm9yZS4gU28gYCR7Zm9vfWAgYmVjb21lcyBgJHtOOmZvb31gXG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBwbGFjZWhvbGRlcnMuaGFzKG1hcmtlci5uYW1lKSA/IHBsYWNlaG9sZGVycy5nZXQobWFya2VyLm5hbWUpISA6ICsrcGxhY2Vob2xkZXJNYXg7XG5cdFx0XHRcdFx0cGxhY2Vob2xkZXJzLnNldChtYXJrZXIubmFtZSwgaW5kZXgpO1xuXG5cdFx0XHRcdFx0Y29uc3Qgc3ludGhldGljID0gbmV3IFBsYWNlaG9sZGVyKGluZGV4KS5hcHBlbmRDaGlsZChuZXcgVGV4dChtYXJrZXIubmFtZSkpO1xuXHRcdFx0XHRcdHRleHRtYXRlU25pcHBldC5yZXBsYWNlKG1hcmtlciwgW3N5bnRoZXRpY10pO1xuXHRcdFx0XHRcdHRoaXMuaXNCb2dvdXMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3dpdGNoIChtYXJrZXIubmFtZSkge1xuXHRcdFx0XHRcdGNhc2UgJ0NMSVBCT0FSRCc6XG5cdFx0XHRcdFx0XHR0aGlzLnVzZXNDbGlwYm9hcmRWYXJpYWJsZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdTRUxFQ1RJT04nOlxuXHRcdFx0XHRcdGNhc2UgJ1RNX1NFTEVDVEVEX1RFWFQnOlxuXHRcdFx0XHRcdFx0dGhpcy51c2VzU2VsZWN0aW9uVmFyaWFibGUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gcmVjdXJzZVxuXHRcdFx0XHRzdGFjay5wdXNoKC4uLm1hcmtlci5jaGlsZHJlbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNCb2dvdXMpIHtcblx0XHRcdHRoaXMuY29kZVNuaXBwZXQgPSB0ZXh0bWF0ZVNuaXBwZXQudG9UZXh0bWF0ZVN0cmluZygpO1xuXHRcdH1cblxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTbmlwcGV0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ib2R5SW5zaWdodHM6IFdpbmRvd0lkbGVWYWx1ZTxTbmlwcGV0Qm9keUluc2lnaHRzPjtcblxuXHRyZWFkb25seSBwcmVmaXhMb3c6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBpc0ZpbGVUZW1wbGF0ZTogYm9vbGVhbixcblx0XHRyZWFkb25seSBzY29wZXM6IHN0cmluZ1tdLFxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyxcblx0XHRyZWFkb25seSBwcmVmaXg6IHN0cmluZyxcblx0XHRyZWFkb25seSBkZXNjcmlwdGlvbjogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGJvZHk6IHN0cmluZyxcblx0XHRyZWFkb25seSBzb3VyY2U6IHN0cmluZyxcblx0XHRyZWFkb25seSBzbmlwcGV0U291cmNlOiBTbmlwcGV0U291cmNlLFxuXHRcdHJlYWRvbmx5IHNuaXBwZXRJZGVudGlmaWVyOiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgZXh0ZW5zaW9uSWQ/OiBFeHRlbnNpb25JZGVudGlmaWVyLFxuXHQpIHtcblx0XHR0aGlzLnByZWZpeExvdyA9IHByZWZpeC50b0xvd2VyQ2FzZSgpO1xuXHRcdHRoaXMuX2JvZHlJbnNpZ2h0cyA9IG5ldyBXaW5kb3dJZGxlVmFsdWUoZ2V0QWN0aXZlV2luZG93KCksICgpID0+IG5ldyBTbmlwcGV0Qm9keUluc2lnaHRzKHRoaXMuYm9keSkpO1xuXHR9XG5cblx0Z2V0IGNvZGVTbmlwcGV0KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2JvZHlJbnNpZ2h0cy52YWx1ZS5jb2RlU25pcHBldDtcblx0fVxuXG5cdGdldCBpc0JvZ291cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYm9keUluc2lnaHRzLnZhbHVlLmlzQm9nb3VzO1xuXHR9XG5cblx0Z2V0IGlzVHJpdmlhbCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYm9keUluc2lnaHRzLnZhbHVlLmlzVHJpdmlhbDtcblx0fVxuXG5cdGdldCBuZWVkc0NsaXBib2FyZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fYm9keUluc2lnaHRzLnZhbHVlLnVzZXNDbGlwYm9hcmRWYXJpYWJsZTtcblx0fVxuXG5cdGdldCB1c2VzU2VsZWN0aW9uKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9ib2R5SW5zaWdodHMudmFsdWUudXNlc1NlbGVjdGlvblZhcmlhYmxlO1xuXHR9XG59XG5cblxuaW50ZXJmYWNlIEpzb25TZXJpYWxpemVkU25pcHBldCB7XG5cdGlzRmlsZVRlbXBsYXRlPzogYm9vbGVhbjtcblx0Ym9keTogc3RyaW5nIHwgc3RyaW5nW107XG5cdHNjb3BlPzogc3RyaW5nO1xuXHRwcmVmaXg6IHN0cmluZyB8IHN0cmluZ1tdIHwgdW5kZWZpbmVkO1xuXHRkZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG5mdW5jdGlvbiBpc0pzb25TZXJpYWxpemVkU25pcHBldCh0aGluZzogYW55KTogdGhpbmcgaXMgSnNvblNlcmlhbGl6ZWRTbmlwcGV0IHtcblx0cmV0dXJuIGlzT2JqZWN0KHRoaW5nKSAmJiBCb29sZWFuKCg8SnNvblNlcmlhbGl6ZWRTbmlwcGV0PnRoaW5nKS5ib2R5KTtcbn1cblxuaW50ZXJmYWNlIEpzb25TZXJpYWxpemVkU25pcHBldHMge1xuXHRbbmFtZTogc3RyaW5nXTogSnNvblNlcmlhbGl6ZWRTbmlwcGV0IHwgeyBbbmFtZTogc3RyaW5nXTogSnNvblNlcmlhbGl6ZWRTbmlwcGV0IH07XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIFNuaXBwZXRTb3VyY2Uge1xuXHRVc2VyID0gMSxcblx0V29ya3NwYWNlID0gMixcblx0RXh0ZW5zaW9uID0gMyxcbn1cblxuZXhwb3J0IGNsYXNzIFNuaXBwZXRGaWxlIHtcblxuXHRyZWFkb25seSBkYXRhOiBTbmlwcGV0W10gPSBbXTtcblx0cmVhZG9ubHkgaXNHbG9iYWxTbmlwcGV0czogYm9vbGVhbjtcblx0cmVhZG9ubHkgaXNVc2VyU25pcHBldHM6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfbG9hZFByb21pc2U/OiBQcm9taXNlPHRoaXM+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHNvdXJjZTogU25pcHBldFNvdXJjZSxcblx0XHRyZWFkb25seSBsb2NhdGlvbjogVVJJLFxuXHRcdHB1YmxpYyBkZWZhdWx0U2NvcGVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZTogSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5pc0dsb2JhbFNuaXBwZXRzID0gZXh0bmFtZShsb2NhdGlvbi5wYXRoKSA9PT0gJy5jb2RlLXNuaXBwZXRzJztcblx0XHR0aGlzLmlzVXNlclNuaXBwZXRzID0gIXRoaXMuX2V4dGVuc2lvbjtcblx0fVxuXG5cdHNlbGVjdChzZWxlY3Rvcjogc3RyaW5nLCBidWNrZXQ6IFNuaXBwZXRbXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzR2xvYmFsU25pcHBldHMgfHwgIXRoaXMuaXNVc2VyU25pcHBldHMpIHtcblx0XHRcdHRoaXMuX3Njb3BlU2VsZWN0KHNlbGVjdG9yLCBidWNrZXQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9maWxlcGF0aFNlbGVjdChzZWxlY3RvciwgYnVja2V0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9maWxlcGF0aFNlbGVjdChzZWxlY3Rvcjogc3RyaW5nLCBidWNrZXQ6IFNuaXBwZXRbXSk6IHZvaWQge1xuXHRcdC8vIGZvciBgZm9vTGFuZy5qc29uYCBmaWxlcyBhbGwgc25pcHBldHMgYXJlIGFjY2VwdGVkXG5cdFx0aWYgKHNlbGVjdG9yICsgJy5qc29uJyA9PT0gYmFzZW5hbWUodGhpcy5sb2NhdGlvbi5wYXRoKSkge1xuXHRcdFx0YnVja2V0LnB1c2goLi4udGhpcy5kYXRhKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zY29wZVNlbGVjdChzZWxlY3Rvcjogc3RyaW5nLCBidWNrZXQ6IFNuaXBwZXRbXSk6IHZvaWQge1xuXHRcdC8vIGZvciBgbXkuY29kZS1zbmlwcGV0c2AgZmlsZXMgd2UgbmVlZCB0byBsb29rIGF0IGVhY2ggc25pcHBldFxuXHRcdGZvciAoY29uc3Qgc25pcHBldCBvZiB0aGlzLmRhdGEpIHtcblx0XHRcdGNvbnN0IGxlbiA9IHNuaXBwZXQuc2NvcGVzLmxlbmd0aDtcblx0XHRcdGlmIChsZW4gPT09IDApIHtcblx0XHRcdFx0Ly8gYWx3YXlzIGFjY2VwdFxuXHRcdFx0XHRidWNrZXQucHVzaChzbmlwcGV0KTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdC8vIG1hdGNoXG5cdFx0XHRcdFx0aWYgKHNuaXBwZXQuc2NvcGVzW2ldID09PSBzZWxlY3Rvcikge1xuXHRcdFx0XHRcdFx0YnVja2V0LnB1c2goc25pcHBldCk7XG5cdFx0XHRcdFx0XHRicmVhazsgLy8gbWF0Y2ggb25seSBvbmNlIVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGlkeCA9IHNlbGVjdG9yLmxhc3RJbmRleE9mKCcuJyk7XG5cdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHR0aGlzLl9zY29wZVNlbGVjdChzZWxlY3Rvci5zdWJzdHJpbmcoMCwgaWR4KSwgYnVja2V0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9sb2FkKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX2V4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZS5yZWFkRXh0ZW5zaW9uUmVzb3VyY2UodGhpcy5sb2NhdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5yZWFkRmlsZSh0aGlzLmxvY2F0aW9uKTtcblx0XHRcdHJldHVybiBjb250ZW50LnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0fVxuXHR9XG5cblx0bG9hZCgpOiBQcm9taXNlPHRoaXM+IHtcblx0XHRpZiAoIXRoaXMuX2xvYWRQcm9taXNlKSB7XG5cdFx0XHR0aGlzLl9sb2FkUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSh0aGlzLl9sb2FkKCkpLnRoZW4oY29udGVudCA9PiB7XG5cdFx0XHRcdGNvbnN0IGRhdGEgPSA8SnNvblNlcmlhbGl6ZWRTbmlwcGV0cz5qc29uUGFyc2UoY29udGVudCk7XG5cdFx0XHRcdGlmIChnZXROb2RlVHlwZShkYXRhKSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IFtuYW1lLCBzY29wZU9yVGVtcGxhdGVdIG9mIE9iamVjdC5lbnRyaWVzKGRhdGEpKSB7XG5cdFx0XHRcdFx0XHRpZiAoaXNKc29uU2VyaWFsaXplZFNuaXBwZXQoc2NvcGVPclRlbXBsYXRlKSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9wYXJzZVNuaXBwZXQobmFtZSwgc2NvcGVPclRlbXBsYXRlLCB0aGlzLmRhdGEpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBbbmFtZSwgdGVtcGxhdGVdIG9mIE9iamVjdC5lbnRyaWVzKHNjb3BlT3JUZW1wbGF0ZSkpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLl9wYXJzZVNuaXBwZXQobmFtZSwgdGVtcGxhdGUsIHRoaXMuZGF0YSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2xvYWRQcm9taXNlO1xuXHR9XG5cblx0cmVzZXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fbG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5kYXRhLmxlbmd0aCA9IDA7XG5cdH1cblxuXHRwcml2YXRlIF9wYXJzZVNuaXBwZXQobmFtZTogc3RyaW5nLCBzbmlwcGV0OiBKc29uU2VyaWFsaXplZFNuaXBwZXQsIGJ1Y2tldDogU25pcHBldFtdKTogdm9pZCB7XG5cblx0XHRsZXQgeyBpc0ZpbGVUZW1wbGF0ZSwgcHJlZml4LCBib2R5LCBkZXNjcmlwdGlvbiB9ID0gc25pcHBldDtcblxuXHRcdGlmICghcHJlZml4KSB7XG5cdFx0XHRwcmVmaXggPSAnJztcblx0XHR9XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShib2R5KSkge1xuXHRcdFx0Ym9keSA9IGJvZHkuam9pbignXFxuJyk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgYm9keSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShkZXNjcmlwdGlvbikpIHtcblx0XHRcdGRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24uam9pbignXFxuJyk7XG5cdFx0fVxuXG5cdFx0bGV0IHNjb3Blczogc3RyaW5nW107XG5cdFx0aWYgKHRoaXMuZGVmYXVsdFNjb3Blcykge1xuXHRcdFx0c2NvcGVzID0gdGhpcy5kZWZhdWx0U2NvcGVzO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHNuaXBwZXQuc2NvcGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzY29wZXMgPSBzbmlwcGV0LnNjb3BlLnNwbGl0KCcsJykubWFwKHMgPT4gcy50cmltKCkpLmZpbHRlcihCb29sZWFuKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2NvcGVzID0gW107XG5cdFx0fVxuXG5cdFx0bGV0IHNvdXJjZTogc3RyaW5nO1xuXHRcdGlmICh0aGlzLl9leHRlbnNpb24pIHtcblx0XHRcdC8vIGV4dGVuc2lvbiBzbmlwcGV0IC0+IHNob3cgdGhlIG5hbWUgb2YgdGhlIGV4dGVuc2lvblxuXHRcdFx0c291cmNlID0gdGhpcy5fZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IHRoaXMuX2V4dGVuc2lvbi5uYW1lO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLnNvdXJjZSA9PT0gU25pcHBldFNvdXJjZS5Xb3Jrc3BhY2UpIHtcblx0XHRcdC8vIHdvcmtzcGFjZSAtPiBvbmx5ICouY29kZS1zbmlwcGV0cyBmaWxlc1xuXHRcdFx0c291cmNlID0gbG9jYWxpemUoJ3NvdXJjZS53b3Jrc3BhY2VTbmlwcGV0R2xvYmFsJywgXCJXb3Jrc3BhY2UgU25pcHBldFwiKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdXNlciAtPiBnbG9iYWwgKCouY29kZS1zbmlwcGV0cykgYW5kIGxhbmd1YWdlIHNuaXBwZXRzXG5cdFx0XHRpZiAodGhpcy5pc0dsb2JhbFNuaXBwZXRzKSB7XG5cdFx0XHRcdHNvdXJjZSA9IGxvY2FsaXplKCdzb3VyY2UudXNlclNuaXBwZXRHbG9iYWwnLCBcIkdsb2JhbCBVc2VyIFNuaXBwZXRcIik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzb3VyY2UgPSBsb2NhbGl6ZSgnc291cmNlLnVzZXJTbmlwcGV0JywgXCJVc2VyIFNuaXBwZXRcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBfcHJlZml4IG9mIEl0ZXJhYmxlLndyYXAocHJlZml4KSkge1xuXHRcdFx0YnVja2V0LnB1c2gobmV3IFNuaXBwZXQoXG5cdFx0XHRcdEJvb2xlYW4oaXNGaWxlVGVtcGxhdGUpLFxuXHRcdFx0XHRzY29wZXMsXG5cdFx0XHRcdG5hbWUsXG5cdFx0XHRcdF9wcmVmaXgsXG5cdFx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRib2R5LFxuXHRcdFx0XHRzb3VyY2UsXG5cdFx0XHRcdHRoaXMuc291cmNlLFxuXHRcdFx0XHR0aGlzLl9leHRlbnNpb24gPyBgJHtyZWxhdGl2ZVBhdGgodGhpcy5fZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uLCB0aGlzLmxvY2F0aW9uKX0vJHtuYW1lfWAgOiBgJHtiYXNlbmFtZSh0aGlzLmxvY2F0aW9uLnBhdGgpfS8ke25hbWV9YCxcblx0XHRcdFx0dGhpcy5fZXh0ZW5zaW9uPy5pZGVudGlmaWVyLFxuXHRcdFx0KSk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQVMsV0FBVyxtQkFBbUI7QUFD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QUssZUFBZTtBQUNwQixTQUFLLEtBQUssU0FBUztBQUFBLEVBQ3BCO0FBQUEsRUFFUSxjQUFjLE1BQWMsU0FBZ0MsUUFBeUI7QUFFNUYsUUFBSSxFQUFFLGdCQUFnQixRQUFRLE1BQU0sWUFBWSxJQUFJO0FBRXBELFFBQUksQ0FBQyxRQUFRO0FBQ1osZUFBUztBQUFBLElBQ1Y7QUFFQSxRQUFJLE1BQU0sUUFBUSxJQUFJLEdBQUc7QUFDeEIsYUFBTyxLQUFLLEtBQUssSUFBSTtBQUFBLElBQ3RCO0FBQ0EsUUFBSSxPQUFPLFNBQVMsVUFBVTtBQUM3QjtBQUFBLElBQ0Q7QUFFQSxRQUFJLE1BQU0sUUFBUSxXQUFXLEdBQUc7QUFDL0Isb0JBQWMsWUFBWSxLQUFLLElBQUk7QUFBQSxJQUNwQztBQUVBLFFBQUk7QUFDSixRQUFJLEtBQUssZUFBZTtBQUN2QixlQUFTLEtBQUs7QUFBQSxJQUNmLFdBQVcsT0FBTyxRQUFRLFVBQVUsVUFBVTtBQUM3QyxlQUFTLFFBQVEsTUFBTSxNQUFNLEdBQUcsRUFBRSxJQUFJLE9BQUssRUFBRSxLQUFLLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxJQUNwRSxPQUFPO0FBQ04sZUFBUyxDQUFDO0FBQUEsSUFDWDtBQUVBLFFBQUk7QUFDSixRQUFJLEtBQUssWUFBWTtBQUVwQixlQUFTLEtBQUssV0FBVyxlQUFlLEtBQUssV0FBVztBQUFBLElBRXpELFdBQVcsS0FBSyxXQUFXLG1CQUF5QjtBQUVuRCxlQUFTLFNBQVMsaUNBQWlDLG1CQUFtQjtBQUFBLElBQ3ZFLE9BQU87QUFFTixVQUFJLEtBQUssa0JBQWtCO0FBQzFCLGlCQUFTLFNBQVMsNEJBQTRCLHFCQUFxQjtBQUFBLE1BQ3BFLE9BQU87QUFDTixpQkFBUyxTQUFTLHNCQUFzQixjQUFjO0FBQUEsTUFDdkQ7QUFBQSxJQUNEO0FBRUEsZUFBVyxXQUFXLFNBQVMsS0FBSyxNQUFNLEdBQUc7QUFDNUMsYUFBTyxLQUFLLElBQUk7QUFBQSxRQUNmLFFBQVEsY0FBYztBQUFBLFFBQ3RCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLEtBQUs7QUFBQSxRQUNMLEtBQUssYUFBYSxHQUFHLGFBQWEsS0FBSyxXQUFXLG1CQUFtQixLQUFLLFFBQVEsQ0FBQyxJQUFJLElBQUksS0FBSyxHQUFHLFNBQVMsS0FBSyxTQUFTLElBQUksQ0FBQyxJQUFJLElBQUk7QUFBQSxRQUN2SSxLQUFLLFlBQVk7QUFBQSxNQUNsQixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFsiU25pcHBldFNvdXJjZSIsICJuYW1lIl0KfQo=
