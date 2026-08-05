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
import { URI } from "../../../../base/common/uri.js";
import { isEqual } from "../../../../base/common/extpath.js";
import { posix } from "../../../../base/common/path.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { FileSystemProviderCapabilities } from "../../../../platform/files/common/files.js";
import { rtrim, startsWithIgnoreCase, equalsIgnoreCase } from "../../../../base/common/strings.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { memoize } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { joinPath, isEqualOrParent, basenameOrAuthority } from "../../../../base/common/resources.js";
import { SortOrder } from "./files.js";
import { ExplorerFileNestingTrie } from "./explorerFileNestingTrie.js";
import { assertIsDefined } from "../../../../base/common/types.js";
class ExplorerModel {
  constructor(contextService, uriIdentityService, fileService, configService, filesConfigService) {
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this._onDidChangeRoots = new Emitter();
    const setRoots = () => this._roots = this.contextService.getWorkspace().folders.map((folder) => new ExplorerItem(folder.uri, fileService, configService, filesConfigService, void 0, true, false, false, false, folder.name));
    setRoots();
    this._listener = this.contextService.onDidChangeWorkspaceFolders(() => {
      setRoots();
      this._onDidChangeRoots.fire();
    });
  }
  get roots() {
    return this._roots;
  }
  get onDidChangeRoots() {
    return this._onDidChangeRoots.event;
  }
  /**
   * Returns an array of child stat from this stat that matches with the provided path.
   * Starts matching from the first root.
   * Will return empty array in case the FileStat does not exist.
   */
  findAll(resource) {
    return coalesce(this.roots.map((root) => root.find(resource)));
  }
  /**
   * Returns a FileStat that matches the passed resource.
   * In case multiple FileStat are matching the resource (same folder opened multiple times) returns the FileStat that has the closest root.
   * Will return undefined in case the FileStat does not exist.
   */
  findClosest(resource) {
    const folder = this.contextService.getWorkspaceFolder(resource);
    if (folder) {
      const root = this.roots.find((r) => this.uriIdentityService.extUri.isEqual(r.resource, folder.uri));
      if (root) {
        return root.find(resource);
      }
    }
    return null;
  }
  dispose() {
    dispose(this._listener);
  }
}
const _ExplorerItem = class _ExplorerItem {
  constructor(resource, fileService, configService, filesConfigService, _parent, _isDirectory, _isSymbolicLink, _readonly, _locked, _name = basenameOrAuthority(resource), _mtime, _unknown = false) {
    this.resource = resource;
    this.fileService = fileService;
    this.configService = configService;
    this.filesConfigService = filesConfigService;
    this._parent = _parent;
    this._isDirectory = _isDirectory;
    this._isSymbolicLink = _isSymbolicLink;
    this._readonly = _readonly;
    this._locked = _locked;
    this._name = _name;
    this._mtime = _mtime;
    this._unknown = _unknown;
    // used in tests
    this.error = void 0;
    this._isExcluded = false;
    // Find
    this.markedAsFindResult = false;
    this._isDirectoryResolved = false;
  }
  get isExcluded() {
    if (this._isExcluded) {
      return true;
    }
    if (!this._parent) {
      return false;
    }
    return this._parent.isExcluded;
  }
  set isExcluded(value) {
    this._isExcluded = value;
  }
  hasChildren(filter) {
    if (this.hasNests) {
      return this.nestedChildren?.some((c) => filter(c)) ?? false;
    } else {
      return this.isDirectory;
    }
  }
  get hasNests() {
    return !!this.nestedChildren?.length;
  }
  get isDirectoryResolved() {
    return this._isDirectoryResolved;
  }
  get isSymbolicLink() {
    return !!this._isSymbolicLink;
  }
  get isDirectory() {
    return !!this._isDirectory;
  }
  get isReadonly() {
    return this.filesConfigService.isReadonly(this.resource, { resource: this.resource, name: this.name, readonly: this._readonly, locked: this._locked });
  }
  get mtime() {
    return this._mtime;
  }
  get name() {
    return this._name;
  }
  get isUnknown() {
    return this._unknown;
  }
  get parent() {
    return this._parent;
  }
  get root() {
    if (!this._parent) {
      return this;
    }
    return this._parent.root;
  }
  get children() {
    return /* @__PURE__ */ new Map();
  }
  updateName(value) {
    this._parent?.removeChild(this);
    this._name = value;
    this._parent?.addChild(this);
  }
  getId() {
    let id = this.root.resource.toString() + "::" + this.resource.toString();
    if (this.isMarkedAsFiltered()) {
      id += "::findFilterResult";
    }
    return id;
  }
  toString() {
    return `ExplorerItem: ${this.name}`;
  }
  get isRoot() {
    return this === this.root;
  }
  static create(fileService, configService, filesConfigService, raw, parent, resolveTo) {
    const stat = new _ExplorerItem(raw.resource, fileService, configService, filesConfigService, parent, raw.isDirectory, raw.isSymbolicLink, raw.readonly, raw.locked, raw.name, raw.mtime, !raw.isFile && !raw.isDirectory);
    if (stat.isDirectory) {
      stat._isDirectoryResolved = !!raw.children || !!resolveTo && resolveTo.some((r) => {
        return isEqualOrParent(r, stat.resource);
      });
      if (raw.children) {
        for (let i = 0, len = raw.children.length; i < len; i++) {
          const child = _ExplorerItem.create(fileService, configService, filesConfigService, raw.children[i], stat, resolveTo);
          stat.addChild(child);
        }
      }
    }
    return stat;
  }
  /**
   * Merges the stat which was resolved from the disk with the local stat by copying over properties
   * and children. The merge will only consider resolved stat elements to avoid overwriting data which
   * exists locally.
   */
  static mergeLocalWithDisk(disk, local) {
    if (disk.resource.toString() !== local.resource.toString()) {
      return;
    }
    const mergingDirectories = disk.isDirectory || local.isDirectory;
    if (mergingDirectories && local._isDirectoryResolved && !disk._isDirectoryResolved) {
      return;
    }
    local.resource = disk.resource;
    if (!local.isRoot) {
      local.updateName(disk.name);
    }
    local._isDirectory = disk.isDirectory;
    local._mtime = disk.mtime;
    local._isDirectoryResolved = disk._isDirectoryResolved;
    local._isSymbolicLink = disk.isSymbolicLink;
    local.error = disk.error;
    if (mergingDirectories && disk._isDirectoryResolved) {
      const oldLocalChildren = new ResourceMap();
      local.children.forEach((child) => {
        oldLocalChildren.set(child.resource, child);
      });
      local.children.clear();
      disk.children.forEach((diskChild) => {
        const formerLocalChild = oldLocalChildren.get(diskChild.resource);
        if (formerLocalChild) {
          _ExplorerItem.mergeLocalWithDisk(diskChild, formerLocalChild);
          local.addChild(formerLocalChild);
          oldLocalChildren.delete(diskChild.resource);
        } else {
          local.addChild(diskChild);
        }
      });
      oldLocalChildren.forEach((oldChild) => {
        if (oldChild instanceof NewExplorerItem) {
          local.addChild(oldChild);
        }
      });
    }
  }
  /**
   * Adds a child element to this folder.
   */
  addChild(child) {
    child._parent = this;
    child.updateResource(false);
    this.children.set(this.getPlatformAwareName(child.name), child);
  }
  getChild(name) {
    return this.children.get(this.getPlatformAwareName(name));
  }
  fetchChildren(sortOrder) {
    const nestingConfig = this.configService.getValue({ resource: this.root.resource }).explorer.fileNesting;
    if (nestingConfig.enabled && this.nestedChildren) {
      return this.nestedChildren;
    }
    return (async () => {
      if (!this._isDirectoryResolved) {
        const resolveMetadata = sortOrder === SortOrder.Modified;
        this.error = void 0;
        try {
          const stat = await this.fileService.resolve(this.resource, { resolveSingleChildDescendants: true, resolveMetadata });
          const resolved = _ExplorerItem.create(this.fileService, this.configService, this.filesConfigService, stat, this);
          _ExplorerItem.mergeLocalWithDisk(resolved, this);
        } catch (e) {
          this.error = e;
          throw e;
        }
        this._isDirectoryResolved = true;
      }
      const items = [];
      if (nestingConfig.enabled) {
        const fileChildren = [];
        const dirChildren = [];
        for (const child of this.children.entries()) {
          child[1].nestedParent = void 0;
          if (child[1].isDirectory) {
            dirChildren.push(child);
          } else {
            fileChildren.push(child);
          }
        }
        const nested = this.fileNester.nest(
          fileChildren.map(([name]) => name),
          this.getPlatformAwareName(this.name)
        );
        for (const [fileEntryName, fileEntryItem] of fileChildren) {
          const nestedItems = nested.get(fileEntryName);
          if (nestedItems !== void 0) {
            fileEntryItem.nestedChildren = [];
            for (const name of nestedItems.keys()) {
              const child = assertIsDefined(this.children.get(name));
              fileEntryItem.nestedChildren.push(child);
              child.nestedParent = fileEntryItem;
            }
            items.push(fileEntryItem);
          } else {
            fileEntryItem.nestedChildren = void 0;
          }
        }
        for (const [_, dirEntryItem] of dirChildren.values()) {
          items.push(dirEntryItem);
        }
      } else {
        this.children.forEach((child) => {
          items.push(child);
        });
      }
      return items;
    })();
  }
  get fileNester() {
    if (!this.root._fileNester) {
      const nestingConfig = this.configService.getValue({ resource: this.root.resource }).explorer.fileNesting;
      const patterns = Object.entries(nestingConfig.patterns).filter((entry) => typeof entry[0] === "string" && typeof entry[1] === "string" && entry[0] && entry[1]).map(([parentPattern, childrenPatterns]) => [
        this.getPlatformAwareName(parentPattern.trim()),
        childrenPatterns.split(",").map((p) => this.getPlatformAwareName(p.trim().replace(/\u200b/g, "").trim())).filter((p) => p !== "")
      ]);
      this.root._fileNester = new ExplorerFileNestingTrie(patterns);
    }
    return this.root._fileNester;
  }
  /**
   * Removes a child element from this folder.
   */
  removeChild(child) {
    this.nestedChildren = void 0;
    this.children.delete(this.getPlatformAwareName(child.name));
  }
  forgetChildren() {
    this.children.clear();
    this.nestedChildren = void 0;
    this._isDirectoryResolved = false;
    this._fileNester = void 0;
  }
  getPlatformAwareName(name) {
    return this.fileService.hasCapability(this.resource, FileSystemProviderCapabilities.PathCaseSensitive) ? name : name.toLowerCase();
  }
  /**
   * Moves this element under a new parent element.
   */
  move(newParent) {
    this.nestedParent?.removeChild(this);
    this._parent?.removeChild(this);
    newParent.removeChild(this);
    newParent.addChild(this);
    this.updateResource(true);
  }
  updateResource(recursive) {
    if (this._parent) {
      this.resource = joinPath(this._parent.resource, this.name);
    }
    if (recursive) {
      if (this.isDirectory) {
        this.children.forEach((child) => {
          child.updateResource(true);
        });
      }
    }
  }
  /**
   * Tells this stat that it was renamed. This requires changes to all children of this stat (if any)
   * so that the path property can be updated properly.
   */
  rename(renamedStat) {
    this.updateName(renamedStat.name);
    this._mtime = renamedStat.mtime;
    this.updateResource(true);
  }
  /**
   * Returns a child stat from this stat that matches with the provided path.
   * Will return "null" in case the child does not exist.
   */
  find(resource) {
    const ignoreCase = !this.fileService.hasCapability(resource, FileSystemProviderCapabilities.PathCaseSensitive);
    if (resource && this.resource.scheme === resource.scheme && equalsIgnoreCase(this.resource.authority, resource.authority) && (ignoreCase ? startsWithIgnoreCase(resource.path, this.resource.path) : resource.path.startsWith(this.resource.path))) {
      return this.findByPath(rtrim(resource.path, posix.sep), this.resource.path.length, ignoreCase);
    }
    return null;
  }
  findByPath(path, index, ignoreCase) {
    if (isEqual(rtrim(this.resource.path, posix.sep), path, ignoreCase)) {
      return this;
    }
    if (this.isDirectory) {
      while (index < path.length && path[index] === posix.sep) {
        index++;
      }
      let indexOfNextSep = path.indexOf(posix.sep, index);
      if (indexOfNextSep === -1) {
        indexOfNextSep = path.length;
      }
      const name = path.substring(index, indexOfNextSep);
      const child = this.children.get(this.getPlatformAwareName(name));
      if (child) {
        return child.findByPath(path, indexOfNextSep, ignoreCase);
      }
    }
    return null;
  }
  isMarkedAsFiltered() {
    return this.markedAsFindResult;
  }
  markItemAndParentsAsFiltered() {
    this.markedAsFindResult = true;
    this.parent?.markItemAndParentsAsFiltered();
  }
  unmarkItemAndChildren() {
    this.markedAsFindResult = false;
    this.children.forEach((child) => child.unmarkItemAndChildren());
  }
};
__decorateClass([
  memoize
], _ExplorerItem.prototype, "children", 1);
let ExplorerItem = _ExplorerItem;
class NewExplorerItem extends ExplorerItem {
  constructor(fileService, configService, filesConfigService, parent, isDirectory) {
    super(URI.file(""), fileService, configService, filesConfigService, parent, isDirectory);
    this._isDirectoryResolved = true;
  }
}
export {
  ExplorerItem,
  ExplorerModel,
  NewExplorerItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9jb21tb24vZXhwbG9yZXJNb2RlbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBwb3NpeCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgSUZpbGVTdGF0LCBJRmlsZVNlcnZpY2UsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBydHJpbSwgc3RhcnRzV2l0aElnbm9yZUNhc2UsIGVxdWFsc0lnbm9yZUNhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1lbW9pemUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgam9pblBhdGgsIGlzRXF1YWxPclBhcmVudCwgYmFzZW5hbWVPckF1dGhvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uLCBTb3J0T3JkZXIgfSBmcm9tICcuL2ZpbGVzLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUgfSBmcm9tICcuL2V4cGxvcmVyRmlsZU5lc3RpbmdUcmllLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuXG5leHBvcnQgY2xhc3MgRXhwbG9yZXJNb2RlbCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9yb290cyE6IEV4cGxvcmVySXRlbVtdO1xuXHRwcml2YXRlIF9saXN0ZW5lcjogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUm9vdHMgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRmaWxlc0NvbmZpZ1NlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBzZXRSb290cyA9ICgpID0+IHRoaXMuX3Jvb3RzID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzXG5cdFx0XHQubWFwKGZvbGRlciA9PiBuZXcgRXhwbG9yZXJJdGVtKGZvbGRlci51cmksIGZpbGVTZXJ2aWNlLCBjb25maWdTZXJ2aWNlLCBmaWxlc0NvbmZpZ1NlcnZpY2UsIHVuZGVmaW5lZCwgdHJ1ZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZm9sZGVyLm5hbWUpKTtcblx0XHRzZXRSb290cygpO1xuXG5cdFx0dGhpcy5fbGlzdGVuZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB7XG5cdFx0XHRzZXRSb290cygpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VSb290cy5maXJlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXQgcm9vdHMoKTogRXhwbG9yZXJJdGVtW10ge1xuXHRcdHJldHVybiB0aGlzLl9yb290cztcblx0fVxuXG5cdGdldCBvbkRpZENoYW5nZVJvb3RzKCk6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VSb290cy5ldmVudDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGNoaWxkIHN0YXQgZnJvbSB0aGlzIHN0YXQgdGhhdCBtYXRjaGVzIHdpdGggdGhlIHByb3ZpZGVkIHBhdGguXG5cdCAqIFN0YXJ0cyBtYXRjaGluZyBmcm9tIHRoZSBmaXJzdCByb290LlxuXHQgKiBXaWxsIHJldHVybiBlbXB0eSBhcnJheSBpbiBjYXNlIHRoZSBGaWxlU3RhdCBkb2VzIG5vdCBleGlzdC5cblx0ICovXG5cdGZpbmRBbGwocmVzb3VyY2U6IFVSSSk6IEV4cGxvcmVySXRlbVtdIHtcblx0XHRyZXR1cm4gY29hbGVzY2UodGhpcy5yb290cy5tYXAocm9vdCA9PiByb290LmZpbmQocmVzb3VyY2UpKSk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIEZpbGVTdGF0IHRoYXQgbWF0Y2hlcyB0aGUgcGFzc2VkIHJlc291cmNlLlxuXHQgKiBJbiBjYXNlIG11bHRpcGxlIEZpbGVTdGF0IGFyZSBtYXRjaGluZyB0aGUgcmVzb3VyY2UgKHNhbWUgZm9sZGVyIG9wZW5lZCBtdWx0aXBsZSB0aW1lcykgcmV0dXJucyB0aGUgRmlsZVN0YXQgdGhhdCBoYXMgdGhlIGNsb3Nlc3Qgcm9vdC5cblx0ICogV2lsbCByZXR1cm4gdW5kZWZpbmVkIGluIGNhc2UgdGhlIEZpbGVTdGF0IGRvZXMgbm90IGV4aXN0LlxuXHQgKi9cblx0ZmluZENsb3Nlc3QocmVzb3VyY2U6IFVSSSk6IEV4cGxvcmVySXRlbSB8IG51bGwge1xuXHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJlc291cmNlKTtcblx0XHRpZiAoZm9sZGVyKSB7XG5cdFx0XHRjb25zdCByb290ID0gdGhpcy5yb290cy5maW5kKHIgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoci5yZXNvdXJjZSwgZm9sZGVyLnVyaSkpO1xuXHRcdFx0aWYgKHJvb3QpIHtcblx0XHRcdFx0cmV0dXJuIHJvb3QuZmluZChyZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGRpc3Bvc2UodGhpcy5fbGlzdGVuZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHBsb3Jlckl0ZW0ge1xuXHRfaXNEaXJlY3RvcnlSZXNvbHZlZDogYm9vbGVhbjsgLy8gdXNlZCBpbiB0ZXN0c1xuXHRwdWJsaWMgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pc0V4Y2x1ZGVkID0gZmFsc2U7XG5cblx0cHVibGljIG5lc3RlZFBhcmVudDogRXhwbG9yZXJJdGVtIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgbmVzdGVkQ2hpbGRyZW46IEV4cGxvcmVySXRlbVtdIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZXNvdXJjZTogVVJJLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBfcGFyZW50OiBFeHBsb3Jlckl0ZW0gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfaXNEaXJlY3Rvcnk/OiBib29sZWFuLFxuXHRcdHByaXZhdGUgX2lzU3ltYm9saWNMaW5rPzogYm9vbGVhbixcblx0XHRwcml2YXRlIF9yZWFkb25seT86IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSBfbG9ja2VkPzogYm9vbGVhbixcblx0XHRwcml2YXRlIF9uYW1lOiBzdHJpbmcgPSBiYXNlbmFtZU9yQXV0aG9yaXR5KHJlc291cmNlKSxcblx0XHRwcml2YXRlIF9tdGltZT86IG51bWJlcixcblx0XHRwcml2YXRlIF91bmtub3duID0gZmFsc2Vcblx0KSB7XG5cdFx0dGhpcy5faXNEaXJlY3RvcnlSZXNvbHZlZCA9IGZhbHNlO1xuXHR9XG5cblx0Z2V0IGlzRXhjbHVkZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2lzRXhjbHVkZWQpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3BhcmVudCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9wYXJlbnQuaXNFeGNsdWRlZDtcblx0fVxuXG5cdHNldCBpc0V4Y2x1ZGVkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5faXNFeGNsdWRlZCA9IHZhbHVlO1xuXHR9XG5cblx0aGFzQ2hpbGRyZW4oZmlsdGVyOiAoc3RhdDogRXhwbG9yZXJJdGVtKSA9PiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuaGFzTmVzdHMpIHtcblx0XHRcdHJldHVybiB0aGlzLm5lc3RlZENoaWxkcmVuPy5zb21lKGMgPT4gZmlsdGVyKGMpKSA/PyBmYWxzZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuaXNEaXJlY3Rvcnk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGhhc05lc3RzKCkge1xuXHRcdHJldHVybiAhISh0aGlzLm5lc3RlZENoaWxkcmVuPy5sZW5ndGgpO1xuXHR9XG5cblx0Z2V0IGlzRGlyZWN0b3J5UmVzb2x2ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzRGlyZWN0b3J5UmVzb2x2ZWQ7XG5cdH1cblxuXHRnZXQgaXNTeW1ib2xpY0xpbmsoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5faXNTeW1ib2xpY0xpbms7XG5cdH1cblxuXHRnZXQgaXNEaXJlY3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5faXNEaXJlY3Rvcnk7XG5cdH1cblxuXHRnZXQgaXNSZWFkb25seSgpOiBib29sZWFuIHwgSU1hcmtkb3duU3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5maWxlc0NvbmZpZ1NlcnZpY2UuaXNSZWFkb25seSh0aGlzLnJlc291cmNlLCB7IHJlc291cmNlOiB0aGlzLnJlc291cmNlLCBuYW1lOiB0aGlzLm5hbWUsIHJlYWRvbmx5OiB0aGlzLl9yZWFkb25seSwgbG9ja2VkOiB0aGlzLl9sb2NrZWQgfSk7XG5cdH1cblxuXHRnZXQgbXRpbWUoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbXRpbWU7XG5cdH1cblxuXHRnZXQgbmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9uYW1lO1xuXHR9XG5cblx0Z2V0IGlzVW5rbm93bigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdW5rbm93bjtcblx0fVxuXG5cdGdldCBwYXJlbnQoKTogRXhwbG9yZXJJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcGFyZW50O1xuXHR9XG5cblx0Z2V0IHJvb3QoKTogRXhwbG9yZXJJdGVtIHtcblx0XHRpZiAoIXRoaXMuX3BhcmVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3BhcmVudC5yb290O1xuXHR9XG5cblx0QG1lbW9pemUgZ2V0IGNoaWxkcmVuKCk6IE1hcDxzdHJpbmcsIEV4cGxvcmVySXRlbT4ge1xuXHRcdHJldHVybiBuZXcgTWFwPHN0cmluZywgRXhwbG9yZXJJdGVtPigpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVOYW1lKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBSZS1hZGQgdG8gcGFyZW50IHNpbmNlIHRoZSBwYXJlbnQgaGFzIGEgbmFtZSBtYXAgdG8gY2hpbGRyZW4gYW5kIHRoZSBuYW1lIG1pZ2h0IGhhdmUgY2hhbmdlZFxuXHRcdHRoaXMuX3BhcmVudD8ucmVtb3ZlQ2hpbGQodGhpcyk7XG5cdFx0dGhpcy5fbmFtZSA9IHZhbHVlO1xuXHRcdHRoaXMuX3BhcmVudD8uYWRkQ2hpbGQodGhpcyk7XG5cdH1cblxuXHRnZXRJZCgpOiBzdHJpbmcge1xuXHRcdGxldCBpZCA9IHRoaXMucm9vdC5yZXNvdXJjZS50b1N0cmluZygpICsgJzo6JyArIHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKTtcblxuXHRcdGlmICh0aGlzLmlzTWFya2VkQXNGaWx0ZXJlZCgpKSB7XG5cdFx0XHRpZCArPSAnOjpmaW5kRmlsdGVyUmVzdWx0Jztcblx0XHR9XG5cblx0XHRyZXR1cm4gaWQ7XG5cdH1cblxuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgRXhwbG9yZXJJdGVtOiAke3RoaXMubmFtZX1gO1xuXHR9XG5cblx0Z2V0IGlzUm9vdCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcyA9PT0gdGhpcy5yb290O1xuXHR9XG5cblx0c3RhdGljIGNyZWF0ZShmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLCBjb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGZpbGVzQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIHJhdzogSUZpbGVTdGF0LCBwYXJlbnQ6IEV4cGxvcmVySXRlbSB8IHVuZGVmaW5lZCwgcmVzb2x2ZVRvPzogcmVhZG9ubHkgVVJJW10pOiBFeHBsb3Jlckl0ZW0ge1xuXHRcdGNvbnN0IHN0YXQgPSBuZXcgRXhwbG9yZXJJdGVtKHJhdy5yZXNvdXJjZSwgZmlsZVNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UsIGZpbGVzQ29uZmlnU2VydmljZSwgcGFyZW50LCByYXcuaXNEaXJlY3RvcnksIHJhdy5pc1N5bWJvbGljTGluaywgcmF3LnJlYWRvbmx5LCByYXcubG9ja2VkLCByYXcubmFtZSwgcmF3Lm10aW1lLCAhcmF3LmlzRmlsZSAmJiAhcmF3LmlzRGlyZWN0b3J5KTtcblxuXHRcdC8vIFJlY3Vyc2l2ZWx5IGFkZCBjaGlsZHJlbiBpZiBwcmVzZW50XG5cdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkpIHtcblxuXHRcdFx0Ly8gaXNEaXJlY3RvcnlSZXNvbHZlZCBpcyBhIHZlcnkgaW1wb3J0YW50IGluZGljYXRvciBpbiB0aGUgc3RhdCBtb2RlbCB0aGF0IHRlbGxzIGlmIHRoZSBmb2xkZXIgd2FzIGZ1bGx5IHJlc29sdmVkXG5cdFx0XHQvLyB0aGUgZm9sZGVyIGlzIGZ1bGx5IHJlc29sdmVkIGlmIGVpdGhlciBpdCBoYXMgYSBsaXN0IG9mIGNoaWxkcmVuIG9yIHRoZSBjbGllbnQgcmVxdWVzdGVkIHRoaXMgYnkgdXNpbmcgdGhlIHJlc29sdmVUb1xuXHRcdFx0Ly8gYXJyYXkgb2YgcmVzb3VyY2UgcGF0aCB0byByZXNvbHZlLlxuXHRcdFx0c3RhdC5faXNEaXJlY3RvcnlSZXNvbHZlZCA9ICEhcmF3LmNoaWxkcmVuIHx8ICghIXJlc29sdmVUbyAmJiByZXNvbHZlVG8uc29tZSgocikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gaXNFcXVhbE9yUGFyZW50KHIsIHN0YXQucmVzb3VyY2UpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHQvLyBSZWN1cnNlIGludG8gY2hpbGRyZW5cblx0XHRcdGlmIChyYXcuY2hpbGRyZW4pIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IHJhdy5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGNoaWxkID0gRXhwbG9yZXJJdGVtLmNyZWF0ZShmaWxlU2VydmljZSwgY29uZmlnU2VydmljZSwgZmlsZXNDb25maWdTZXJ2aWNlLCByYXcuY2hpbGRyZW5baV0sIHN0YXQsIHJlc29sdmVUbyk7XG5cdFx0XHRcdFx0c3RhdC5hZGRDaGlsZChjaGlsZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc3RhdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBNZXJnZXMgdGhlIHN0YXQgd2hpY2ggd2FzIHJlc29sdmVkIGZyb20gdGhlIGRpc2sgd2l0aCB0aGUgbG9jYWwgc3RhdCBieSBjb3B5aW5nIG92ZXIgcHJvcGVydGllc1xuXHQgKiBhbmQgY2hpbGRyZW4uIFRoZSBtZXJnZSB3aWxsIG9ubHkgY29uc2lkZXIgcmVzb2x2ZWQgc3RhdCBlbGVtZW50cyB0byBhdm9pZCBvdmVyd3JpdGluZyBkYXRhIHdoaWNoXG5cdCAqIGV4aXN0cyBsb2NhbGx5LlxuXHQgKi9cblx0c3RhdGljIG1lcmdlTG9jYWxXaXRoRGlzayhkaXNrOiBFeHBsb3Jlckl0ZW0sIGxvY2FsOiBFeHBsb3Jlckl0ZW0pOiB2b2lkIHtcblx0XHRpZiAoZGlzay5yZXNvdXJjZS50b1N0cmluZygpICE9PSBsb2NhbC5yZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRyZXR1cm47IC8vIE1lcmdpbmcgb25seSBzdXBwb3J0ZWQgZm9yIHN0YXRzIHdpdGggdGhlIHNhbWUgcmVzb3VyY2Vcblx0XHR9XG5cblx0XHQvLyBTdG9wIG1lcmdpbmcgd2hlbiBhIGZvbGRlciBpcyBub3QgcmVzb2x2ZWQgdG8gYXZvaWQgbG9vc2luZyBsb2NhbCBkYXRhXG5cdFx0Y29uc3QgbWVyZ2luZ0RpcmVjdG9yaWVzID0gZGlzay5pc0RpcmVjdG9yeSB8fCBsb2NhbC5pc0RpcmVjdG9yeTtcblx0XHRpZiAobWVyZ2luZ0RpcmVjdG9yaWVzICYmIGxvY2FsLl9pc0RpcmVjdG9yeVJlc29sdmVkICYmICFkaXNrLl9pc0RpcmVjdG9yeVJlc29sdmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUHJvcGVydGllc1xuXHRcdGxvY2FsLnJlc291cmNlID0gZGlzay5yZXNvdXJjZTtcblx0XHRpZiAoIWxvY2FsLmlzUm9vdCkge1xuXHRcdFx0bG9jYWwudXBkYXRlTmFtZShkaXNrLm5hbWUpO1xuXHRcdH1cblx0XHRsb2NhbC5faXNEaXJlY3RvcnkgPSBkaXNrLmlzRGlyZWN0b3J5O1xuXHRcdGxvY2FsLl9tdGltZSA9IGRpc2subXRpbWU7XG5cdFx0bG9jYWwuX2lzRGlyZWN0b3J5UmVzb2x2ZWQgPSBkaXNrLl9pc0RpcmVjdG9yeVJlc29sdmVkO1xuXHRcdGxvY2FsLl9pc1N5bWJvbGljTGluayA9IGRpc2suaXNTeW1ib2xpY0xpbms7XG5cdFx0bG9jYWwuZXJyb3IgPSBkaXNrLmVycm9yO1xuXG5cdFx0Ly8gTWVyZ2UgQ2hpbGRyZW4gaWYgcmVzb2x2ZWRcblx0XHRpZiAobWVyZ2luZ0RpcmVjdG9yaWVzICYmIGRpc2suX2lzRGlyZWN0b3J5UmVzb2x2ZWQpIHtcblxuXHRcdFx0Ly8gTWFwIHJlc291cmNlID0+IHN0YXRcblx0XHRcdGNvbnN0IG9sZExvY2FsQ2hpbGRyZW4gPSBuZXcgUmVzb3VyY2VNYXA8RXhwbG9yZXJJdGVtPigpO1xuXHRcdFx0bG9jYWwuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7XG5cdFx0XHRcdG9sZExvY2FsQ2hpbGRyZW4uc2V0KGNoaWxkLnJlc291cmNlLCBjaGlsZCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gQ2xlYXIgY3VycmVudCBjaGlsZHJlblxuXHRcdFx0bG9jYWwuY2hpbGRyZW4uY2xlYXIoKTtcblxuXHRcdFx0Ly8gTWVyZ2UgcmVjZWl2ZWQgY2hpbGRyZW5cblx0XHRcdGRpc2suY2hpbGRyZW4uZm9yRWFjaChkaXNrQ2hpbGQgPT4ge1xuXHRcdFx0XHRjb25zdCBmb3JtZXJMb2NhbENoaWxkID0gb2xkTG9jYWxDaGlsZHJlbi5nZXQoZGlza0NoaWxkLnJlc291cmNlKTtcblx0XHRcdFx0Ly8gRXhpc3RpbmcgY2hpbGQ6IG1lcmdlXG5cdFx0XHRcdGlmIChmb3JtZXJMb2NhbENoaWxkKSB7XG5cdFx0XHRcdFx0RXhwbG9yZXJJdGVtLm1lcmdlTG9jYWxXaXRoRGlzayhkaXNrQ2hpbGQsIGZvcm1lckxvY2FsQ2hpbGQpO1xuXHRcdFx0XHRcdGxvY2FsLmFkZENoaWxkKGZvcm1lckxvY2FsQ2hpbGQpO1xuXHRcdFx0XHRcdG9sZExvY2FsQ2hpbGRyZW4uZGVsZXRlKGRpc2tDaGlsZC5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBOZXcgY2hpbGQ6IGFkZFxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRsb2NhbC5hZGRDaGlsZChkaXNrQ2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0b2xkTG9jYWxDaGlsZHJlbi5mb3JFYWNoKG9sZENoaWxkID0+IHtcblx0XHRcdFx0aWYgKG9sZENoaWxkIGluc3RhbmNlb2YgTmV3RXhwbG9yZXJJdGVtKSB7XG5cdFx0XHRcdFx0bG9jYWwuYWRkQ2hpbGQob2xkQ2hpbGQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQWRkcyBhIGNoaWxkIGVsZW1lbnQgdG8gdGhpcyBmb2xkZXIuXG5cdCAqL1xuXHRhZGRDaGlsZChjaGlsZDogRXhwbG9yZXJJdGVtKTogdm9pZCB7XG5cdFx0Ly8gSW5oZXJpdCBzb21lIHBhcmVudCBwcm9wZXJ0aWVzIHRvIGNoaWxkXG5cdFx0Y2hpbGQuX3BhcmVudCA9IHRoaXM7XG5cdFx0Y2hpbGQudXBkYXRlUmVzb3VyY2UoZmFsc2UpO1xuXHRcdHRoaXMuY2hpbGRyZW4uc2V0KHRoaXMuZ2V0UGxhdGZvcm1Bd2FyZU5hbWUoY2hpbGQubmFtZSksIGNoaWxkKTtcblx0fVxuXG5cdGdldENoaWxkKG5hbWU6IHN0cmluZyk6IEV4cGxvcmVySXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY2hpbGRyZW4uZ2V0KHRoaXMuZ2V0UGxhdGZvcm1Bd2FyZU5hbWUobmFtZSkpO1xuXHR9XG5cblx0ZmV0Y2hDaGlsZHJlbihzb3J0T3JkZXI6IFNvcnRPcmRlcik6IEV4cGxvcmVySXRlbVtdIHwgUHJvbWlzZTxFeHBsb3Jlckl0ZW1bXT4ge1xuXHRcdGNvbnN0IG5lc3RpbmdDb25maWcgPSB0aGlzLmNvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oeyByZXNvdXJjZTogdGhpcy5yb290LnJlc291cmNlIH0pLmV4cGxvcmVyLmZpbGVOZXN0aW5nO1xuXG5cdFx0Ly8gZmFzdCBwYXRoIHdoZW4gdGhlIGNoaWxkcmVuIGNhbiBiZSByZXNvbHZlZCBzeW5jXG5cdFx0aWYgKG5lc3RpbmdDb25maWcuZW5hYmxlZCAmJiB0aGlzLm5lc3RlZENoaWxkcmVuKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5uZXN0ZWRDaGlsZHJlbjtcblx0XHR9XG5cblx0XHRyZXR1cm4gKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5faXNEaXJlY3RvcnlSZXNvbHZlZCkge1xuXHRcdFx0XHQvLyBSZXNvbHZlIG1ldGFkYXRhIG9ubHkgd2hlbiB0aGUgbXRpbWUgaXMgbmVlZGVkIHNpbmNlIHRoaXMgY2FuIGJlIGV4cGVuc2l2ZVxuXHRcdFx0XHQvLyBNdGltZSBpcyBvbmx5IHVzZWQgd2hlbiB0aGUgc29ydCBvcmRlciBpcyAnbW9kaWZpZWQnXG5cdFx0XHRcdGNvbnN0IHJlc29sdmVNZXRhZGF0YSA9IHNvcnRPcmRlciA9PT0gU29ydE9yZGVyLk1vZGlmaWVkO1xuXHRcdFx0XHR0aGlzLmVycm9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlc29sdmUodGhpcy5yZXNvdXJjZSwgeyByZXNvbHZlU2luZ2xlQ2hpbGREZXNjZW5kYW50czogdHJ1ZSwgcmVzb2x2ZU1ldGFkYXRhIH0pO1xuXHRcdFx0XHRcdGNvbnN0IHJlc29sdmVkID0gRXhwbG9yZXJJdGVtLmNyZWF0ZSh0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmNvbmZpZ1NlcnZpY2UsIHRoaXMuZmlsZXNDb25maWdTZXJ2aWNlLCBzdGF0LCB0aGlzKTtcblx0XHRcdFx0XHRFeHBsb3Jlckl0ZW0ubWVyZ2VMb2NhbFdpdGhEaXNrKHJlc29sdmVkLCB0aGlzKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMuZXJyb3IgPSBlO1xuXHRcdFx0XHRcdHRocm93IGU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5faXNEaXJlY3RvcnlSZXNvbHZlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGl0ZW1zOiBFeHBsb3Jlckl0ZW1bXSA9IFtdO1xuXHRcdFx0aWYgKG5lc3RpbmdDb25maWcuZW5hYmxlZCkge1xuXHRcdFx0XHRjb25zdCBmaWxlQ2hpbGRyZW46IFtzdHJpbmcsIEV4cGxvcmVySXRlbV1bXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBkaXJDaGlsZHJlbjogW3N0cmluZywgRXhwbG9yZXJJdGVtXVtdID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgdGhpcy5jaGlsZHJlbi5lbnRyaWVzKCkpIHtcblx0XHRcdFx0XHRjaGlsZFsxXS5uZXN0ZWRQYXJlbnQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKGNoaWxkWzFdLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0XHRkaXJDaGlsZHJlbi5wdXNoKGNoaWxkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZmlsZUNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5lc3RlZCA9IHRoaXMuZmlsZU5lc3Rlci5uZXN0KFxuXHRcdFx0XHRcdGZpbGVDaGlsZHJlbi5tYXAoKFtuYW1lXSkgPT4gbmFtZSksXG5cdFx0XHRcdFx0dGhpcy5nZXRQbGF0Zm9ybUF3YXJlTmFtZSh0aGlzLm5hbWUpKTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IFtmaWxlRW50cnlOYW1lLCBmaWxlRW50cnlJdGVtXSBvZiBmaWxlQ2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb25zdCBuZXN0ZWRJdGVtcyA9IG5lc3RlZC5nZXQoZmlsZUVudHJ5TmFtZSk7XG5cdFx0XHRcdFx0aWYgKG5lc3RlZEl0ZW1zICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdGZpbGVFbnRyeUl0ZW0ubmVzdGVkQ2hpbGRyZW4gPSBbXTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgbmFtZSBvZiBuZXN0ZWRJdGVtcy5rZXlzKCkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY2hpbGQgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5jaGlsZHJlbi5nZXQobmFtZSkpO1xuXHRcdFx0XHRcdFx0XHRmaWxlRW50cnlJdGVtLm5lc3RlZENoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0XHRcdFx0XHRjaGlsZC5uZXN0ZWRQYXJlbnQgPSBmaWxlRW50cnlJdGVtO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aXRlbXMucHVzaChmaWxlRW50cnlJdGVtKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZmlsZUVudHJ5SXRlbS5uZXN0ZWRDaGlsZHJlbiA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IFtfLCBkaXJFbnRyeUl0ZW1dIG9mIGRpckNoaWxkcmVuLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0aXRlbXMucHVzaChkaXJFbnRyeUl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4ge1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goY2hpbGQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpdGVtcztcblx0XHR9KSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmlsZU5lc3RlcjogRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IGZpbGVOZXN0ZXIoKTogRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUge1xuXHRcdGlmICghdGhpcy5yb290Ll9maWxlTmVzdGVyKSB7XG5cdFx0XHRjb25zdCBuZXN0aW5nQ29uZmlnID0gdGhpcy5jb25maWdTZXJ2aWNlLmdldFZhbHVlPElGaWxlc0NvbmZpZ3VyYXRpb24+KHsgcmVzb3VyY2U6IHRoaXMucm9vdC5yZXNvdXJjZSB9KS5leHBsb3Jlci5maWxlTmVzdGluZztcblx0XHRcdGNvbnN0IHBhdHRlcm5zID0gT2JqZWN0LmVudHJpZXMobmVzdGluZ0NvbmZpZy5wYXR0ZXJucylcblx0XHRcdFx0LmZpbHRlcihlbnRyeSA9PlxuXHRcdFx0XHRcdHR5cGVvZiAoZW50cnlbMF0pID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgKGVudHJ5WzFdKSA9PT0gJ3N0cmluZycgJiYgZW50cnlbMF0gJiYgZW50cnlbMV0pXG5cdFx0XHRcdC5tYXAoKFtwYXJlbnRQYXR0ZXJuLCBjaGlsZHJlblBhdHRlcm5zXSkgPT5cblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR0aGlzLmdldFBsYXRmb3JtQXdhcmVOYW1lKHBhcmVudFBhdHRlcm4udHJpbSgpKSxcblx0XHRcdFx0XHRcdGNoaWxkcmVuUGF0dGVybnMuc3BsaXQoJywnKS5tYXAocCA9PiB0aGlzLmdldFBsYXRmb3JtQXdhcmVOYW1lKHAudHJpbSgpLnJlcGxhY2UoL1xcdTIwMGIvZywgJycpLnRyaW0oKSkpXG5cdFx0XHRcdFx0XHRcdC5maWx0ZXIocCA9PiBwICE9PSAnJylcblx0XHRcdFx0XHRdIGFzIFtzdHJpbmcsIHN0cmluZ1tdXSk7XG5cblx0XHRcdHRoaXMucm9vdC5fZmlsZU5lc3RlciA9IG5ldyBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZShwYXR0ZXJucyk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJvb3QuX2ZpbGVOZXN0ZXI7XG5cdH1cblxuXHQvKipcblx0ICogUmVtb3ZlcyBhIGNoaWxkIGVsZW1lbnQgZnJvbSB0aGlzIGZvbGRlci5cblx0ICovXG5cdHJlbW92ZUNoaWxkKGNoaWxkOiBFeHBsb3Jlckl0ZW0pOiB2b2lkIHtcblx0XHR0aGlzLm5lc3RlZENoaWxkcmVuID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuY2hpbGRyZW4uZGVsZXRlKHRoaXMuZ2V0UGxhdGZvcm1Bd2FyZU5hbWUoY2hpbGQubmFtZSkpO1xuXHR9XG5cblx0Zm9yZ2V0Q2hpbGRyZW4oKTogdm9pZCB7XG5cdFx0dGhpcy5jaGlsZHJlbi5jbGVhcigpO1xuXHRcdHRoaXMubmVzdGVkQ2hpbGRyZW4gPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5faXNEaXJlY3RvcnlSZXNvbHZlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2ZpbGVOZXN0ZXIgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGdldFBsYXRmb3JtQXdhcmVOYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZVNlcnZpY2UuaGFzQ2FwYWJpbGl0eSh0aGlzLnJlc291cmNlLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpID8gbmFtZSA6IG5hbWUudG9Mb3dlckNhc2UoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBNb3ZlcyB0aGlzIGVsZW1lbnQgdW5kZXIgYSBuZXcgcGFyZW50IGVsZW1lbnQuXG5cdCAqL1xuXHRtb3ZlKG5ld1BhcmVudDogRXhwbG9yZXJJdGVtKTogdm9pZCB7XG5cdFx0dGhpcy5uZXN0ZWRQYXJlbnQ/LnJlbW92ZUNoaWxkKHRoaXMpO1xuXHRcdHRoaXMuX3BhcmVudD8ucmVtb3ZlQ2hpbGQodGhpcyk7XG5cdFx0bmV3UGFyZW50LnJlbW92ZUNoaWxkKHRoaXMpOyAvLyBtYWtlIHN1cmUgdG8gcmVtb3ZlIGFueSBwcmV2aW91cyB2ZXJzaW9uIG9mIHRoZSBmaWxlIGlmIGFueVxuXHRcdG5ld1BhcmVudC5hZGRDaGlsZCh0aGlzKTtcblx0XHR0aGlzLnVwZGF0ZVJlc291cmNlKHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZXNvdXJjZShyZWN1cnNpdmU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcGFyZW50KSB7XG5cdFx0XHR0aGlzLnJlc291cmNlID0gam9pblBhdGgodGhpcy5fcGFyZW50LnJlc291cmNlLCB0aGlzLm5hbWUpO1xuXHRcdH1cblxuXHRcdGlmIChyZWN1cnNpdmUpIHtcblx0XHRcdGlmICh0aGlzLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRoaXMuY2hpbGRyZW4uZm9yRWFjaChjaGlsZCA9PiB7XG5cdFx0XHRcdFx0Y2hpbGQudXBkYXRlUmVzb3VyY2UodHJ1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBUZWxscyB0aGlzIHN0YXQgdGhhdCBpdCB3YXMgcmVuYW1lZC4gVGhpcyByZXF1aXJlcyBjaGFuZ2VzIHRvIGFsbCBjaGlsZHJlbiBvZiB0aGlzIHN0YXQgKGlmIGFueSlcblx0ICogc28gdGhhdCB0aGUgcGF0aCBwcm9wZXJ0eSBjYW4gYmUgdXBkYXRlZCBwcm9wZXJseS5cblx0ICovXG5cdHJlbmFtZShyZW5hbWVkU3RhdDogeyBuYW1lOiBzdHJpbmc7IG10aW1lPzogbnVtYmVyIH0pOiB2b2lkIHtcblxuXHRcdC8vIE1lcmdlIGEgc3Vic2V0IG9mIFByb3BlcnRpZXMgdGhhdCBjYW4gY2hhbmdlIG9uIHJlbmFtZVxuXHRcdHRoaXMudXBkYXRlTmFtZShyZW5hbWVkU3RhdC5uYW1lKTtcblx0XHR0aGlzLl9tdGltZSA9IHJlbmFtZWRTdGF0Lm10aW1lO1xuXG5cdFx0Ly8gVXBkYXRlIFBhdGhzIGluY2x1ZGluZyBjaGlsZHJlblxuXHRcdHRoaXMudXBkYXRlUmVzb3VyY2UodHJ1ZSk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIGNoaWxkIHN0YXQgZnJvbSB0aGlzIHN0YXQgdGhhdCBtYXRjaGVzIHdpdGggdGhlIHByb3ZpZGVkIHBhdGguXG5cdCAqIFdpbGwgcmV0dXJuIFwibnVsbFwiIGluIGNhc2UgdGhlIGNoaWxkIGRvZXMgbm90IGV4aXN0LlxuXHQgKi9cblx0ZmluZChyZXNvdXJjZTogVVJJKTogRXhwbG9yZXJJdGVtIHwgbnVsbCB7XG5cdFx0Ly8gUmV0dXJuIGlmIHBhdGggZm91bmRcblx0XHQvLyBGb3IgcGVyZm9ybWFuY2UgcmVhc29ucyB0cnkgdG8gZG8gdGhlIGNvbXBhcmlzb24gYXMgZmFzdCBhcyBwb3NzaWJsZVxuXHRcdGNvbnN0IGlnbm9yZUNhc2UgPSAhdGhpcy5maWxlU2VydmljZS5oYXNDYXBhYmlsaXR5KHJlc291cmNlLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpO1xuXHRcdGlmIChyZXNvdXJjZSAmJiB0aGlzLnJlc291cmNlLnNjaGVtZSA9PT0gcmVzb3VyY2Uuc2NoZW1lICYmIGVxdWFsc0lnbm9yZUNhc2UodGhpcy5yZXNvdXJjZS5hdXRob3JpdHksIHJlc291cmNlLmF1dGhvcml0eSkgJiZcblx0XHRcdChpZ25vcmVDYXNlID8gc3RhcnRzV2l0aElnbm9yZUNhc2UocmVzb3VyY2UucGF0aCwgdGhpcy5yZXNvdXJjZS5wYXRoKSA6IHJlc291cmNlLnBhdGguc3RhcnRzV2l0aCh0aGlzLnJlc291cmNlLnBhdGgpKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmluZEJ5UGF0aChydHJpbShyZXNvdXJjZS5wYXRoLCBwb3NpeC5zZXApLCB0aGlzLnJlc291cmNlLnBhdGgubGVuZ3RoLCBpZ25vcmVDYXNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDsgLy9VbmFibGUgdG8gZmluZFxuXHR9XG5cblx0cHJpdmF0ZSBmaW5kQnlQYXRoKHBhdGg6IHN0cmluZywgaW5kZXg6IG51bWJlciwgaWdub3JlQ2FzZTogYm9vbGVhbik6IEV4cGxvcmVySXRlbSB8IG51bGwge1xuXHRcdGlmIChpc0VxdWFsKHJ0cmltKHRoaXMucmVzb3VyY2UucGF0aCwgcG9zaXguc2VwKSwgcGF0aCwgaWdub3JlQ2FzZSkpIHtcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHQvLyBJZ25vcmUgc2VwYXJ0b3IgdG8gbW9yZSBlYXNpbHkgZGVkdWN0IHRoZSBuZXh0IG5hbWUgdG8gc2VhcmNoXG5cdFx0XHR3aGlsZSAoaW5kZXggPCBwYXRoLmxlbmd0aCAmJiBwYXRoW2luZGV4XSA9PT0gcG9zaXguc2VwKSB7XG5cdFx0XHRcdGluZGV4Kys7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBpbmRleE9mTmV4dFNlcCA9IHBhdGguaW5kZXhPZihwb3NpeC5zZXAsIGluZGV4KTtcblx0XHRcdGlmIChpbmRleE9mTmV4dFNlcCA9PT0gLTEpIHtcblx0XHRcdFx0Ly8gSWYgdGhlcmUgaXMgbm8gc2VwYXJhdG9yIHRha2UgdGhlIHJlbWFpbmRlciBvZiB0aGUgcGF0aFxuXHRcdFx0XHRpbmRleE9mTmV4dFNlcCA9IHBhdGgubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdFx0Ly8gVGhlIG5hbWUgdG8gc2VhcmNoIGlzIGJldHdlZW4gdHdvIHNlcGFyYXRvcnNcblx0XHRcdGNvbnN0IG5hbWUgPSBwYXRoLnN1YnN0cmluZyhpbmRleCwgaW5kZXhPZk5leHRTZXApO1xuXG5cdFx0XHRjb25zdCBjaGlsZCA9IHRoaXMuY2hpbGRyZW4uZ2V0KHRoaXMuZ2V0UGxhdGZvcm1Bd2FyZU5hbWUobmFtZSkpO1xuXG5cdFx0XHRpZiAoY2hpbGQpIHtcblx0XHRcdFx0Ly8gV2UgZm91bmQgYSBjaGlsZCB3aXRoIHRoZSBnaXZlbiBuYW1lLCBzZWFyY2ggaW5zaWRlIGl0XG5cdFx0XHRcdHJldHVybiBjaGlsZC5maW5kQnlQYXRoKHBhdGgsIGluZGV4T2ZOZXh0U2VwLCBpZ25vcmVDYXNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdC8vIEZpbmRcblx0cHJpdmF0ZSBtYXJrZWRBc0ZpbmRSZXN1bHQgPSBmYWxzZTtcblx0aXNNYXJrZWRBc0ZpbHRlcmVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLm1hcmtlZEFzRmluZFJlc3VsdDtcblx0fVxuXG5cdG1hcmtJdGVtQW5kUGFyZW50c0FzRmlsdGVyZWQoKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrZWRBc0ZpbmRSZXN1bHQgPSB0cnVlO1xuXHRcdHRoaXMucGFyZW50Py5tYXJrSXRlbUFuZFBhcmVudHNBc0ZpbHRlcmVkKCk7XG5cdH1cblxuXHR1bm1hcmtJdGVtQW5kQ2hpbGRyZW4oKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrZWRBc0ZpbmRSZXN1bHQgPSBmYWxzZTtcblx0XHR0aGlzLmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQudW5tYXJrSXRlbUFuZENoaWxkcmVuKCkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOZXdFeHBsb3Jlckl0ZW0gZXh0ZW5kcyBFeHBsb3Jlckl0ZW0ge1xuXHRjb25zdHJ1Y3RvcihmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLCBjb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIGZpbGVzQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIHBhcmVudDogRXhwbG9yZXJJdGVtLCBpc0RpcmVjdG9yeTogYm9vbGVhbikge1xuXHRcdHN1cGVyKFVSSS5maWxlKCcnKSwgZmlsZVNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UsIGZpbGVzQ29uZmlnU2VydmljZSwgcGFyZW50LCBpc0RpcmVjdG9yeSk7XG5cdFx0dGhpcy5faXNEaXJlY3RvcnlSZXNvbHZlZCA9IHRydWU7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLG1CQUFtQjtBQUM1QixTQUFrQyxz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
