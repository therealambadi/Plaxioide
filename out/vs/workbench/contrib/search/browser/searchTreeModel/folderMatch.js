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
import { Emitter } from "../../../../../base/common/event.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { TernarySearchTree } from "../../../../../base/common/ternarySearchTree.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { IReplaceService } from "./../replace.js";
import { resultIsMatch } from "../../../../services/search/common/search.js";
import { isSearchTreeFolderMatchWorkspaceRoot, isSearchTreeFolderMatchNoRoot, FOLDER_MATCH_PREFIX, getFileMatches } from "./searchTreeCommon.js";
import { isINotebookFileMatchNoModel } from "../../common/searchNotebookHelpers.js";
import { NotebookCompatibleFileMatch } from "../notebookSearch/notebookSearchModel.js";
import { isINotebookFileMatchWithModel, getIDFromINotebookCellMatch } from "../notebookSearch/searchNotebookHelpers.js";
import { isNotebookFileMatch } from "../notebookSearch/notebookSearchModelBase.js";
import { textSearchResultToMatches } from "./match.js";
let FolderMatchImpl = class extends Disposable {
  constructor(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService) {
    super();
    this._resource = _resource;
    this._index = _index;
    this._query = _query;
    this._parent = _parent;
    this._searchResult = _searchResult;
    this._closestRoot = _closestRoot;
    this.replaceService = replaceService;
    this.instantiationService = instantiationService;
    this.uriIdentityService = uriIdentityService;
    this._onChange = this._register(new Emitter());
    this.onChange = this._onChange.event;
    this._onDispose = this._register(new Emitter());
    this.onDispose = this._onDispose.event;
    this._replacingAll = false;
    this._fileMatches = new ResourceMap();
    this._folderMatches = new ResourceMap();
    this._folderMatchesMap = TernarySearchTree.forUris((key) => this.uriIdentityService.extUri.ignorePathCasing(key));
    this._unDisposedFileMatches = new ResourceMap();
    this._unDisposedFolderMatches = new ResourceMap();
    this._name = new Lazy(() => this.resource ? labelService.getUriBasenameLabel(this.resource) : "");
    this._id = FOLDER_MATCH_PREFIX + _id;
  }
  get searchModel() {
    return this._searchResult.searchModel;
  }
  get showHighlights() {
    return this._parent.showHighlights;
  }
  get closestRoot() {
    return this._closestRoot;
  }
  set replacingAll(b) {
    this._replacingAll = b;
  }
  id() {
    return this._id;
  }
  get resource() {
    return this._resource;
  }
  index() {
    return this._index;
  }
  name() {
    return this._name.value;
  }
  parent() {
    return this._parent;
  }
  isAIContributed() {
    return false;
  }
  get hasChildren() {
    return this._fileMatches.size > 0 || this._folderMatches.size > 0;
  }
  bindModel(model) {
    const fileMatch = this._fileMatches.get(model.uri);
    if (fileMatch) {
      fileMatch.bindModel(model);
    } else {
      const folderMatch = this.getFolderMatch(model.uri);
      const match = folderMatch?.getDownstreamFileMatch(model.uri);
      match?.bindModel(model);
    }
  }
  createIntermediateFolderMatch(resource, id, index, query, baseWorkspaceFolder) {
    const folderMatch = this._register(this.instantiationService.createInstance(FolderMatchWithResourceImpl, resource, id, index, query, this, this._searchResult, baseWorkspaceFolder));
    this.configureIntermediateMatch(folderMatch);
    this.doAddFolder(folderMatch);
    return folderMatch;
  }
  configureIntermediateMatch(folderMatch) {
    const disposable = folderMatch.onChange((event) => this.onFolderChange(folderMatch, event));
    this._register(folderMatch.onDispose(() => disposable.dispose()));
  }
  clear(clearingAll = false) {
    const changed = this.allDownstreamFileMatches();
    this.disposeMatches();
    this._onChange.fire({ elements: changed, removed: true, added: false, clearingAll });
  }
  remove(matches) {
    if (!Array.isArray(matches)) {
      matches = [matches];
    }
    const allMatches = getFileMatches(matches);
    this.doRemoveFile(allMatches);
  }
  async replace(match) {
    return this.replaceService.replace([match]).then(() => {
      this.doRemoveFile([match], true, true, true);
    });
  }
  replaceAll() {
    const matches = this.matches();
    return this.batchReplace(matches);
  }
  matches() {
    return [...this.fileMatchesIterator(), ...this.folderMatchesIterator()];
  }
  fileMatchesIterator() {
    return this._fileMatches.values();
  }
  folderMatchesIterator() {
    return this._folderMatches.values();
  }
  isEmpty() {
    return this.fileCount() + this.folderCount() === 0;
  }
  getDownstreamFileMatch(uri) {
    const directChildFileMatch = this._fileMatches.get(uri);
    if (directChildFileMatch) {
      return directChildFileMatch;
    }
    const folderMatch = this.getFolderMatch(uri);
    const match = folderMatch?.getDownstreamFileMatch(uri);
    if (match) {
      return match;
    }
    return null;
  }
  allDownstreamFileMatches() {
    let recursiveChildren = [];
    const iterator = this.folderMatchesIterator();
    for (const elem of iterator) {
      recursiveChildren = recursiveChildren.concat(elem.allDownstreamFileMatches());
    }
    return [...this.fileMatchesIterator(), ...recursiveChildren];
  }
  fileCount() {
    return this._fileMatches.size;
  }
  folderCount() {
    return this._folderMatches.size;
  }
  count() {
    return this.fileCount() + this.folderCount();
  }
  recursiveFileCount() {
    return this.allDownstreamFileMatches().length;
  }
  recursiveMatchCount() {
    return this.allDownstreamFileMatches().reduce((prev, match) => prev + match.count(), 0);
  }
  get query() {
    return this._query;
  }
  doAddFile(fileMatch) {
    this._fileMatches.set(fileMatch.resource, fileMatch);
    if (this._unDisposedFileMatches.has(fileMatch.resource)) {
      this._unDisposedFileMatches.delete(fileMatch.resource);
    }
  }
  hasOnlyReadOnlyMatches() {
    return Array.from(this._fileMatches.values()).every((fm) => fm.hasOnlyReadOnlyMatches());
  }
  uriHasParent(parent, child) {
    return this.uriIdentityService.extUri.isEqualOrParent(child, parent) && !this.uriIdentityService.extUri.isEqual(child, parent);
  }
  isInParentChain(folderMatch) {
    let matchItem = this;
    while (matchItem instanceof FolderMatchImpl) {
      if (matchItem.id() === folderMatch.id()) {
        return true;
      }
      matchItem = matchItem.parent();
    }
    return false;
  }
  getFolderMatch(resource) {
    const folderMatch = this._folderMatchesMap.findSubstr(resource);
    return folderMatch;
  }
  doAddFolder(folderMatch) {
    if (this.resource && !this.uriHasParent(this.resource, folderMatch.resource)) {
      throw Error(`${folderMatch.resource} does not belong as a child of ${this.resource}`);
    } else if (this.isInParentChain(folderMatch)) {
      throw Error(`${folderMatch.resource} is a parent of ${this.resource}`);
    }
    this._folderMatches.set(folderMatch.resource, folderMatch);
    this._folderMatchesMap.set(folderMatch.resource, folderMatch);
    if (this._unDisposedFolderMatches.has(folderMatch.resource)) {
      this._unDisposedFolderMatches.delete(folderMatch.resource);
    }
  }
  async batchReplace(matches) {
    const allMatches = getFileMatches(matches);
    await this.replaceService.replace(allMatches);
    this.doRemoveFile(allMatches, true, true, true);
  }
  onFileChange(fileMatch, removed = false) {
    let added = false;
    if (!this._fileMatches.has(fileMatch.resource)) {
      this.doAddFile(fileMatch);
      added = true;
    }
    if (fileMatch.count() === 0) {
      this.doRemoveFile([fileMatch], false, false);
      added = false;
      removed = true;
    }
    if (!this._replacingAll) {
      this._onChange.fire({ elements: [fileMatch], added, removed });
    }
  }
  onFolderChange(folderMatch, event) {
    if (!this._folderMatches.has(folderMatch.resource)) {
      this.doAddFolder(folderMatch);
    }
    if (folderMatch.isEmpty()) {
      this._folderMatches.delete(folderMatch.resource);
      folderMatch.dispose();
    }
    this._onChange.fire(event);
  }
  doRemoveFile(fileMatches, dispose = true, trigger = true, keepReadonly = false) {
    const removed = [];
    for (const match of fileMatches) {
      if (this._fileMatches.get(match.resource)) {
        if (keepReadonly && match.hasReadonlyMatches()) {
          continue;
        }
        this._fileMatches.delete(match.resource);
        if (dispose) {
          match.dispose();
        } else {
          this._unDisposedFileMatches.set(match.resource, match);
        }
        removed.push(match);
      } else {
        const folder = this.getFolderMatch(match.resource);
        if (folder) {
          folder.doRemoveFile([match], dispose, trigger);
        } else {
          throw Error(`FileMatch ${match.resource} is not located within FolderMatch ${this.resource}`);
        }
      }
    }
    if (trigger) {
      this._onChange.fire({ elements: removed, removed: true });
    }
  }
  async bindNotebookEditorWidget(editor, resource) {
    const fileMatch = this._fileMatches.get(resource);
    if (isNotebookFileMatch(fileMatch)) {
      if (fileMatch) {
        fileMatch.bindNotebookEditorWidget(editor);
        await fileMatch.updateMatchesForEditorWidget();
      } else {
        const folderMatches = this.folderMatchesIterator();
        for (const elem of folderMatches) {
          await elem.bindNotebookEditorWidget(editor, resource);
        }
      }
    }
  }
  addFileMatch(raw, silent, searchInstanceID) {
    const added = [];
    const updated = [];
    raw.forEach((rawFileMatch) => {
      const existingFileMatch = this.getDownstreamFileMatch(rawFileMatch.resource);
      if (existingFileMatch) {
        if (rawFileMatch.results) {
          rawFileMatch.results.filter(resultIsMatch).forEach((m) => {
            textSearchResultToMatches(m, existingFileMatch, false).forEach((m2) => existingFileMatch.add(m2));
          });
        }
        if (isINotebookFileMatchWithModel(rawFileMatch) || isINotebookFileMatchNoModel(rawFileMatch)) {
          rawFileMatch.cellResults?.forEach((rawCellMatch) => {
            if (isNotebookFileMatch(existingFileMatch)) {
              const existingCellMatch = existingFileMatch.getCellMatch(getIDFromINotebookCellMatch(rawCellMatch));
              if (existingCellMatch) {
                existingCellMatch.addContentMatches(rawCellMatch.contentResults);
                existingCellMatch.addWebviewMatches(rawCellMatch.webviewResults);
              } else {
                existingFileMatch.addCellMatch(rawCellMatch);
              }
            }
          });
        }
        updated.push(existingFileMatch);
        if (rawFileMatch.results && rawFileMatch.results.length > 0) {
          existingFileMatch.addContext(rawFileMatch.results);
        }
      } else {
        if (isSearchTreeFolderMatchWorkspaceRoot(this) || isSearchTreeFolderMatchNoRoot(this)) {
          const fileMatch = this.createAndConfigureFileMatch(rawFileMatch, searchInstanceID);
          added.push(fileMatch);
        }
      }
    });
    const elements = [...added, ...updated];
    if (!silent && elements.length) {
      this._onChange.fire({ elements, added: !!added.length });
    }
  }
  unbindNotebookEditorWidget(editor, resource) {
    const fileMatch = this._fileMatches.get(resource);
    if (isNotebookFileMatch(fileMatch)) {
      if (fileMatch) {
        fileMatch.unbindNotebookEditorWidget(editor);
      } else {
        const folderMatches = this.folderMatchesIterator();
        for (const elem of folderMatches) {
          elem.unbindNotebookEditorWidget(editor, resource);
        }
      }
    }
  }
  disposeMatches() {
    [...this._fileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
    [...this._folderMatches.values()].forEach((folderMatch) => folderMatch.disposeMatches());
    [...this._unDisposedFileMatches.values()].forEach((fileMatch) => fileMatch.dispose());
    [...this._unDisposedFolderMatches.values()].forEach((folderMatch) => folderMatch.disposeMatches());
    this._fileMatches.clear();
    this._folderMatches.clear();
    this._unDisposedFileMatches.clear();
    this._unDisposedFolderMatches.clear();
  }
  dispose() {
    this.disposeMatches();
    this._onDispose.fire();
    super.dispose();
  }
};
FolderMatchImpl = __decorateClass([
  __decorateParam(7, IReplaceService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IUriIdentityService)
], FolderMatchImpl);
let FolderMatchWithResourceImpl = class extends FolderMatchImpl {
  constructor(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService) {
    super(_resource, _id, _index, _query, _parent, _searchResult, _closestRoot, replaceService, instantiationService, labelService, uriIdentityService);
    this._normalizedResource = new Lazy(() => this.uriIdentityService.extUri.removeTrailingPathSeparator(this.uriIdentityService.extUri.normalizePath(
      this.resource
    )));
  }
  get resource() {
    return this._resource;
  }
  get normalizedResource() {
    return this._normalizedResource.value;
  }
};
FolderMatchWithResourceImpl = __decorateClass([
  __decorateParam(7, IReplaceService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IUriIdentityService)
], FolderMatchWithResourceImpl);
let FolderMatchWorkspaceRootImpl = class extends FolderMatchWithResourceImpl {
  constructor(_resource, _id, _index, _query, _parent, replaceService, instantiationService, labelService, uriIdentityService) {
    super(_resource, _id, _index, _query, _parent, _parent.parent(), null, replaceService, instantiationService, labelService, uriIdentityService);
  }
  normalizedUriParent(uri) {
    return this.uriIdentityService.extUri.normalizePath(this.uriIdentityService.extUri.dirname(uri));
  }
  uriEquals(uri1, ur2) {
    return this.uriIdentityService.extUri.isEqual(uri1, ur2);
  }
  createFileMatch(query, previewOptions, maxResults, parent, rawFileMatch, closestRoot, searchInstanceID) {
    const fileMatch = this.instantiationService.createInstance(
      NotebookCompatibleFileMatch,
      query,
      previewOptions,
      maxResults,
      parent,
      rawFileMatch,
      closestRoot,
      searchInstanceID
    );
    fileMatch.createMatches();
    parent.doAddFile(fileMatch);
    const disposable = fileMatch.onChange(({ didRemove }) => parent.onFileChange(fileMatch, didRemove));
    this._register(fileMatch.onDispose(() => disposable.dispose()));
    return fileMatch;
  }
  createAndConfigureFileMatch(rawFileMatch, searchInstanceID) {
    if (!this.uriHasParent(this.resource, rawFileMatch.resource)) {
      throw Error(`${rawFileMatch.resource} is not a descendant of ${this.resource}`);
    }
    const fileMatchParentParts = [];
    let uri = this.normalizedUriParent(rawFileMatch.resource);
    while (!this.uriEquals(this.normalizedResource, uri)) {
      fileMatchParentParts.unshift(uri);
      const prevUri = uri;
      uri = this.uriIdentityService.extUri.removeTrailingPathSeparator(this.normalizedUriParent(uri));
      if (this.uriEquals(prevUri, uri)) {
        throw Error(`${rawFileMatch.resource} is not correctly configured as a child of ${this.normalizedResource}`);
      }
    }
    const root = this.closestRoot ?? this;
    let parent = this;
    for (let i = 0; i < fileMatchParentParts.length; i++) {
      let folderMatch = parent.getFolderMatch(fileMatchParentParts[i]);
      if (!folderMatch) {
        folderMatch = parent.createIntermediateFolderMatch(fileMatchParentParts[i], fileMatchParentParts[i].toString(), -1, this._query, root);
      }
      parent = folderMatch;
    }
    const contentPatternToUse = typeof this._query.contentPattern === "string" ? { pattern: this._query.contentPattern } : this._query.contentPattern;
    return this.createFileMatch(contentPatternToUse, this._query.previewOptions, this._query.maxResults, parent, rawFileMatch, root, searchInstanceID);
  }
};
FolderMatchWorkspaceRootImpl = __decorateClass([
  __decorateParam(5, IReplaceService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IUriIdentityService)
], FolderMatchWorkspaceRootImpl);
let FolderMatchNoRootImpl = class extends FolderMatchImpl {
  constructor(_id, _index, _query, _parent, replaceService, instantiationService, labelService, uriIdentityService) {
    super(null, _id, _index, _query, _parent, _parent.parent(), null, replaceService, instantiationService, labelService, uriIdentityService);
  }
  createAndConfigureFileMatch(rawFileMatch, searchInstanceID) {
    const contentPatternToUse = typeof this._query.contentPattern === "string" ? { pattern: this._query.contentPattern } : this._query.contentPattern;
    const fileMatch = this._register(this.instantiationService.createInstance(
      NotebookCompatibleFileMatch,
      contentPatternToUse,
      this._query.previewOptions,
      this._query.maxResults,
      this,
      rawFileMatch,
      null,
      searchInstanceID
    ));
    fileMatch.createMatches();
    this.doAddFile(fileMatch);
    const disposable = fileMatch.onChange(({ didRemove }) => this.onFileChange(fileMatch, didRemove));
    this._register(fileMatch.onDispose(() => disposable.dispose()));
    return fileMatch;
  }
};
FolderMatchNoRootImpl = __decorateClass([
  __decorateParam(4, IReplaceService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IUriIdentityService)
], FolderMatchNoRootImpl);
export {
  FolderMatchImpl,
  FolderMatchNoRootImpl,
  FolderMatchWithResourceImpl,
  FolderMatchWorkspaceRootImpl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvZm9sZGVyTWF0Y2gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgVGVybmFyeVNlYXJjaFRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90ZXJuYXJ5U2VhcmNoVHJlZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVJlcGxhY2VTZXJ2aWNlIH0gZnJvbSAnLi8uLi9yZXBsYWNlLmpzJztcbmltcG9ydCB7IElGaWxlTWF0Y2gsIElQYXR0ZXJuSW5mbywgSVRleHRRdWVyeSwgSVRleHRTZWFyY2hQcmV2aWV3T3B0aW9ucywgcmVzdWx0SXNNYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcblxuaW1wb3J0IHsgRmlsZU1hdGNoSW1wbCB9IGZyb20gJy4vZmlsZU1hdGNoLmpzJztcbmltcG9ydCB7IElDaGFuZ2VFdmVudCwgSVNlYXJjaFRyZWVGaWxlTWF0Y2gsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2gsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2UsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hOb1Jvb3QsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXb3Jrc3BhY2VSb290LCBJU2VhcmNoTW9kZWwsIElTZWFyY2hSZXN1bHQsIGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCwgSVRleHRTZWFyY2hIZWFkaW5nLCBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaE5vUm9vdCwgRk9MREVSX01BVENIX1BSRUZJWCwgZ2V0RmlsZU1hdGNoZXMgfSBmcm9tICcuL3NlYXJjaFRyZWVDb21tb24uanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IGlzSU5vdGVib29rRmlsZU1hdGNoTm9Nb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2hOb3RlYm9va0hlbHBlcnMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDb21wYXRpYmxlRmlsZU1hdGNoIH0gZnJvbSAnLi4vbm90ZWJvb2tTZWFyY2gvbm90ZWJvb2tTZWFyY2hNb2RlbC5qcyc7XG5pbXBvcnQgeyBpc0lOb3RlYm9va0ZpbGVNYXRjaFdpdGhNb2RlbCwgZ2V0SURGcm9tSU5vdGVib29rQ2VsbE1hdGNoIH0gZnJvbSAnLi4vbm90ZWJvb2tTZWFyY2gvc2VhcmNoTm90ZWJvb2tIZWxwZXJzLmpzJztcbmltcG9ydCB7IGlzTm90ZWJvb2tGaWxlTWF0Y2ggfSBmcm9tICcuLi9ub3RlYm9va1NlYXJjaC9ub3RlYm9va1NlYXJjaE1vZGVsQmFzZS5qcyc7XG5pbXBvcnQgeyB0ZXh0U2VhcmNoUmVzdWx0VG9NYXRjaGVzIH0gZnJvbSAnLi9tYXRjaC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBGb2xkZXJNYXRjaEltcGwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaCB7XG5cblx0cHJvdGVjdGVkIF9vbkNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uQ2hhbmdlOiBFdmVudDxJQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25DaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlzcG9zZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpc3Bvc2UuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIF9maWxlTWF0Y2hlczogUmVzb3VyY2VNYXA8SVNlYXJjaFRyZWVGaWxlTWF0Y2g+O1xuXHRwcm90ZWN0ZWQgX2ZvbGRlck1hdGNoZXM6IFJlc291cmNlTWFwPEZvbGRlck1hdGNoV2l0aFJlc291cmNlSW1wbD47XG5cdHByb3RlY3RlZCBfZm9sZGVyTWF0Y2hlc01hcDogVGVybmFyeVNlYXJjaFRyZWU8VVJJLCBGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUltcGw+O1xuXHRwcm90ZWN0ZWQgX3VuRGlzcG9zZWRGaWxlTWF0Y2hlczogUmVzb3VyY2VNYXA8SVNlYXJjaFRyZWVGaWxlTWF0Y2g+O1xuXHRwcm90ZWN0ZWQgX3VuRGlzcG9zZWRGb2xkZXJNYXRjaGVzOiBSZXNvdXJjZU1hcDxGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUltcGw+O1xuXHRwcml2YXRlIF9yZXBsYWNpbmdBbGw6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfbmFtZTogTGF6eTxzdHJpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCBfcmVzb3VyY2U6IFVSSSB8IG51bGwsXG5cdFx0X2lkOiBzdHJpbmcsXG5cdFx0cHJvdGVjdGVkIF9pbmRleDogbnVtYmVyLFxuXHRcdHByb3RlY3RlZCBfcXVlcnk6IElUZXh0UXVlcnksXG5cdFx0cHJpdmF0ZSBfcGFyZW50OiBJVGV4dFNlYXJjaEhlYWRpbmcgfCBGb2xkZXJNYXRjaEltcGwsXG5cdFx0cHJpdmF0ZSBfc2VhcmNoUmVzdWx0OiBJU2VhcmNoUmVzdWx0LFxuXHRcdHByaXZhdGUgX2Nsb3Nlc3RSb290OiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCB8IG51bGwsXG5cdFx0QElSZXBsYWNlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcGxhY2VTZXJ2aWNlOiBJUmVwbGFjZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2ZpbGVNYXRjaGVzID0gbmV3IFJlc291cmNlTWFwPElTZWFyY2hUcmVlRmlsZU1hdGNoPigpO1xuXHRcdHRoaXMuX2ZvbGRlck1hdGNoZXMgPSBuZXcgUmVzb3VyY2VNYXA8Rm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsPigpO1xuXHRcdHRoaXMuX2ZvbGRlck1hdGNoZXNNYXAgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPEZvbGRlck1hdGNoV2l0aFJlc291cmNlSW1wbD4oa2V5ID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pZ25vcmVQYXRoQ2FzaW5nKGtleSkpO1xuXHRcdHRoaXMuX3VuRGlzcG9zZWRGaWxlTWF0Y2hlcyA9IG5ldyBSZXNvdXJjZU1hcDxJU2VhcmNoVHJlZUZpbGVNYXRjaD4oKTtcblx0XHR0aGlzLl91bkRpc3Bvc2VkRm9sZGVyTWF0Y2hlcyA9IG5ldyBSZXNvdXJjZU1hcDxGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUltcGw+KCk7XG5cdFx0dGhpcy5fbmFtZSA9IG5ldyBMYXp5KCgpID0+IHRoaXMucmVzb3VyY2UgPyBsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh0aGlzLnJlc291cmNlKSA6ICcnKTtcblx0XHR0aGlzLl9pZCA9IEZPTERFUl9NQVRDSF9QUkVGSVggKyBfaWQ7XG5cdH1cblxuXHRnZXQgc2VhcmNoTW9kZWwoKTogSVNlYXJjaE1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5fc2VhcmNoUmVzdWx0LnNlYXJjaE1vZGVsO1xuXHR9XG5cblx0Z2V0IHNob3dIaWdobGlnaHRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9wYXJlbnQuc2hvd0hpZ2hsaWdodHM7XG5cdH1cblxuXHRnZXQgY2xvc2VzdFJvb3QoKTogSVNlYXJjaFRyZWVGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3QgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fY2xvc2VzdFJvb3Q7XG5cdH1cblxuXHRzZXQgcmVwbGFjaW5nQWxsKGI6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9yZXBsYWNpbmdBbGwgPSBiO1xuXHR9XG5cblx0aWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRnZXQgcmVzb3VyY2UoKTogVVJJIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc291cmNlO1xuXHR9XG5cblx0aW5kZXgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5faW5kZXg7XG5cdH1cblxuXHRuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWUudmFsdWU7XG5cdH1cblxuXHRwYXJlbnQoKTogSVRleHRTZWFyY2hIZWFkaW5nIHwgRm9sZGVyTWF0Y2hJbXBsIHtcblx0XHRyZXR1cm4gdGhpcy5fcGFyZW50O1xuXHR9XG5cblx0aXNBSUNvbnRyaWJ1dGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGdldCBoYXNDaGlsZHJlbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZmlsZU1hdGNoZXMuc2l6ZSA+IDAgfHwgdGhpcy5fZm9sZGVyTWF0Y2hlcy5zaXplID4gMDtcblx0fVxuXG5cdGJpbmRNb2RlbChtb2RlbDogSVRleHRNb2RlbCk6IHZvaWQge1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IHRoaXMuX2ZpbGVNYXRjaGVzLmdldChtb2RlbC51cmkpO1xuXG5cdFx0aWYgKGZpbGVNYXRjaCkge1xuXHRcdFx0ZmlsZU1hdGNoLmJpbmRNb2RlbChtb2RlbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGZvbGRlck1hdGNoID0gdGhpcy5nZXRGb2xkZXJNYXRjaChtb2RlbC51cmkpO1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSBmb2xkZXJNYXRjaD8uZ2V0RG93bnN0cmVhbUZpbGVNYXRjaChtb2RlbC51cmkpO1xuXHRcdFx0bWF0Y2g/LmJpbmRNb2RlbChtb2RlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGNyZWF0ZUludGVybWVkaWF0ZUZvbGRlck1hdGNoKHJlc291cmNlOiBVUkksIGlkOiBzdHJpbmcsIGluZGV4OiBudW1iZXIsIHF1ZXJ5OiBJVGV4dFF1ZXJ5LCBiYXNlV29ya3NwYWNlRm9sZGVyOiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCk6IEZvbGRlck1hdGNoV2l0aFJlc291cmNlSW1wbCB7XG5cdFx0Y29uc3QgZm9sZGVyTWF0Y2ggPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZvbGRlck1hdGNoV2l0aFJlc291cmNlSW1wbCwgcmVzb3VyY2UsIGlkLCBpbmRleCwgcXVlcnksIHRoaXMsIHRoaXMuX3NlYXJjaFJlc3VsdCwgYmFzZVdvcmtzcGFjZUZvbGRlcikpO1xuXHRcdHRoaXMuY29uZmlndXJlSW50ZXJtZWRpYXRlTWF0Y2goZm9sZGVyTWF0Y2gpO1xuXHRcdHRoaXMuZG9BZGRGb2xkZXIoZm9sZGVyTWF0Y2gpO1xuXHRcdHJldHVybiBmb2xkZXJNYXRjaDtcblx0fVxuXG5cdHB1YmxpYyBjb25maWd1cmVJbnRlcm1lZGlhdGVNYXRjaChmb2xkZXJNYXRjaDogRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsKSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGZvbGRlck1hdGNoLm9uQ2hhbmdlKChldmVudCkgPT4gdGhpcy5vbkZvbGRlckNoYW5nZShmb2xkZXJNYXRjaCwgZXZlbnQpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2xkZXJNYXRjaC5vbkRpc3Bvc2UoKCkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpKTtcblx0fVxuXG5cdGNsZWFyKGNsZWFyaW5nQWxsID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VkOiBJU2VhcmNoVHJlZUZpbGVNYXRjaFtdID0gdGhpcy5hbGxEb3duc3RyZWFtRmlsZU1hdGNoZXMoKTtcblx0XHR0aGlzLmRpc3Bvc2VNYXRjaGVzKCk7XG5cdFx0dGhpcy5fb25DaGFuZ2UuZmlyZSh7IGVsZW1lbnRzOiBjaGFuZ2VkLCByZW1vdmVkOiB0cnVlLCBhZGRlZDogZmFsc2UsIGNsZWFyaW5nQWxsIH0pO1xuXHR9XG5cblx0cmVtb3ZlKG1hdGNoZXM6IElTZWFyY2hUcmVlRmlsZU1hdGNoIHwgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZSB8IChJU2VhcmNoVHJlZUZpbGVNYXRjaCB8IElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2UpW10pOiB2b2lkIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkobWF0Y2hlcykpIHtcblx0XHRcdG1hdGNoZXMgPSBbbWF0Y2hlc107XG5cdFx0fVxuXHRcdGNvbnN0IGFsbE1hdGNoZXMgPSBnZXRGaWxlTWF0Y2hlcyhtYXRjaGVzKTtcblx0XHR0aGlzLmRvUmVtb3ZlRmlsZShhbGxNYXRjaGVzKTtcblx0fVxuXG5cdGFzeW5jIHJlcGxhY2UobWF0Y2g6IEZpbGVNYXRjaEltcGwpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLnJlcGxhY2VTZXJ2aWNlLnJlcGxhY2UoW21hdGNoXSkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLmRvUmVtb3ZlRmlsZShbbWF0Y2hdLCB0cnVlLCB0cnVlLCB0cnVlKTtcblx0XHR9KTtcblx0fVxuXG5cdHJlcGxhY2VBbGwoKTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBtYXRjaGVzID0gdGhpcy5tYXRjaGVzKCk7XG5cdFx0cmV0dXJuIHRoaXMuYmF0Y2hSZXBsYWNlKG1hdGNoZXMpO1xuXHR9XG5cblx0bWF0Y2hlcygpOiAoSVNlYXJjaFRyZWVGaWxlTWF0Y2ggfCBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlKVtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMuZmlsZU1hdGNoZXNJdGVyYXRvcigpLCAuLi50aGlzLmZvbGRlck1hdGNoZXNJdGVyYXRvcigpXTtcblx0fVxuXG5cdGZpbGVNYXRjaGVzSXRlcmF0b3IoKTogSXRlcmFibGVJdGVyYXRvcjxJU2VhcmNoVHJlZUZpbGVNYXRjaD4ge1xuXHRcdHJldHVybiB0aGlzLl9maWxlTWF0Y2hlcy52YWx1ZXMoKTtcblx0fVxuXG5cdGZvbGRlck1hdGNoZXNJdGVyYXRvcigpOiBJdGVyYWJsZUl0ZXJhdG9yPElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2U+IHtcblx0XHRyZXR1cm4gdGhpcy5fZm9sZGVyTWF0Y2hlcy52YWx1ZXMoKTtcblx0fVxuXG5cdGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICh0aGlzLmZpbGVDb3VudCgpICsgdGhpcy5mb2xkZXJDb3VudCgpKSA9PT0gMDtcblx0fVxuXG5cdGdldERvd25zdHJlYW1GaWxlTWF0Y2godXJpOiBVUkkpOiBJU2VhcmNoVHJlZUZpbGVNYXRjaCB8IG51bGwge1xuXHRcdGNvbnN0IGRpcmVjdENoaWxkRmlsZU1hdGNoID0gdGhpcy5fZmlsZU1hdGNoZXMuZ2V0KHVyaSk7XG5cdFx0aWYgKGRpcmVjdENoaWxkRmlsZU1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gZGlyZWN0Q2hpbGRGaWxlTWF0Y2g7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9sZGVyTWF0Y2ggPSB0aGlzLmdldEZvbGRlck1hdGNoKHVyaSk7XG5cdFx0Y29uc3QgbWF0Y2ggPSBmb2xkZXJNYXRjaD8uZ2V0RG93bnN0cmVhbUZpbGVNYXRjaCh1cmkpO1xuXHRcdGlmIChtYXRjaCkge1xuXHRcdFx0cmV0dXJuIG1hdGNoO1xuXHRcdH1cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0YWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCk6IElTZWFyY2hUcmVlRmlsZU1hdGNoW10ge1xuXHRcdGxldCByZWN1cnNpdmVDaGlsZHJlbjogSVNlYXJjaFRyZWVGaWxlTWF0Y2hbXSA9IFtdO1xuXHRcdGNvbnN0IGl0ZXJhdG9yID0gdGhpcy5mb2xkZXJNYXRjaGVzSXRlcmF0b3IoKTtcblx0XHRmb3IgKGNvbnN0IGVsZW0gb2YgaXRlcmF0b3IpIHtcblx0XHRcdHJlY3Vyc2l2ZUNoaWxkcmVuID0gcmVjdXJzaXZlQ2hpbGRyZW4uY29uY2F0KGVsZW0uYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBbLi4udGhpcy5maWxlTWF0Y2hlc0l0ZXJhdG9yKCksIC4uLnJlY3Vyc2l2ZUNoaWxkcmVuXTtcblx0fVxuXG5cdHByaXZhdGUgZmlsZUNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbGVNYXRjaGVzLnNpemU7XG5cdH1cblxuXHRwcml2YXRlIGZvbGRlckNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvbGRlck1hdGNoZXMuc2l6ZTtcblx0fVxuXG5cdGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZUNvdW50KCkgKyB0aGlzLmZvbGRlckNvdW50KCk7XG5cdH1cblxuXHRyZWN1cnNpdmVGaWxlQ291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5hbGxEb3duc3RyZWFtRmlsZU1hdGNoZXMoKS5sZW5ndGg7XG5cdH1cblxuXHRyZWN1cnNpdmVNYXRjaENvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCkucmVkdWNlPG51bWJlcj4oKHByZXYsIG1hdGNoKSA9PiBwcmV2ICsgbWF0Y2guY291bnQoKSwgMCk7XG5cdH1cblxuXHRnZXQgcXVlcnkoKTogSVRleHRRdWVyeSB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9xdWVyeTtcblx0fVxuXG5cdGRvQWRkRmlsZShmaWxlTWF0Y2g6IElTZWFyY2hUcmVlRmlsZU1hdGNoKTogdm9pZCB7XG5cdFx0dGhpcy5fZmlsZU1hdGNoZXMuc2V0KGZpbGVNYXRjaC5yZXNvdXJjZSwgZmlsZU1hdGNoKTtcblx0XHRpZiAodGhpcy5fdW5EaXNwb3NlZEZpbGVNYXRjaGVzLmhhcyhmaWxlTWF0Y2gucmVzb3VyY2UpKSB7XG5cdFx0XHR0aGlzLl91bkRpc3Bvc2VkRmlsZU1hdGNoZXMuZGVsZXRlKGZpbGVNYXRjaC5yZXNvdXJjZSk7XG5cdFx0fVxuXHR9XG5cblx0aGFzT25seVJlYWRPbmx5TWF0Y2hlcygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLl9maWxlTWF0Y2hlcy52YWx1ZXMoKSkuZXZlcnkoZm0gPT4gZm0uaGFzT25seVJlYWRPbmx5TWF0Y2hlcygpKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cmlIYXNQYXJlbnQocGFyZW50OiBVUkksIGNoaWxkOiBVUkkpIHtcblx0XHRyZXR1cm4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChjaGlsZCwgcGFyZW50KSAmJiAhdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoY2hpbGQsIHBhcmVudCk7XG5cdH1cblxuXHRwcml2YXRlIGlzSW5QYXJlbnRDaGFpbihmb2xkZXJNYXRjaDogRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsKSB7XG5cblx0XHRsZXQgbWF0Y2hJdGVtOiBGb2xkZXJNYXRjaEltcGwgfCBJVGV4dFNlYXJjaEhlYWRpbmcgPSB0aGlzO1xuXHRcdHdoaWxlIChtYXRjaEl0ZW0gaW5zdGFuY2VvZiBGb2xkZXJNYXRjaEltcGwpIHtcblx0XHRcdGlmIChtYXRjaEl0ZW0uaWQoKSA9PT0gZm9sZGVyTWF0Y2guaWQoKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdG1hdGNoSXRlbSA9IG1hdGNoSXRlbS5wYXJlbnQoKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGdldEZvbGRlck1hdGNoKHJlc291cmNlOiBVUkkpOiBGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUltcGwgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGZvbGRlck1hdGNoID0gdGhpcy5fZm9sZGVyTWF0Y2hlc01hcC5maW5kU3Vic3RyKHJlc291cmNlKTtcblx0XHRyZXR1cm4gZm9sZGVyTWF0Y2g7XG5cdH1cblxuXHRkb0FkZEZvbGRlcihmb2xkZXJNYXRjaDogRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsKSB7XG5cdFx0aWYgKHRoaXMucmVzb3VyY2UgJiYgIXRoaXMudXJpSGFzUGFyZW50KHRoaXMucmVzb3VyY2UsIGZvbGRlck1hdGNoLnJlc291cmNlKSkge1xuXHRcdFx0dGhyb3cgRXJyb3IoYCR7Zm9sZGVyTWF0Y2gucmVzb3VyY2V9IGRvZXMgbm90IGJlbG9uZyBhcyBhIGNoaWxkIG9mICR7dGhpcy5yZXNvdXJjZX1gKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaXNJblBhcmVudENoYWluKGZvbGRlck1hdGNoKSkge1xuXHRcdFx0dGhyb3cgRXJyb3IoYCR7Zm9sZGVyTWF0Y2gucmVzb3VyY2V9IGlzIGEgcGFyZW50IG9mICR7dGhpcy5yZXNvdXJjZX1gKTtcblx0XHR9XG5cblx0XHR0aGlzLl9mb2xkZXJNYXRjaGVzLnNldChmb2xkZXJNYXRjaC5yZXNvdXJjZSwgZm9sZGVyTWF0Y2gpO1xuXHRcdHRoaXMuX2ZvbGRlck1hdGNoZXNNYXAuc2V0KGZvbGRlck1hdGNoLnJlc291cmNlLCBmb2xkZXJNYXRjaCk7XG5cdFx0aWYgKHRoaXMuX3VuRGlzcG9zZWRGb2xkZXJNYXRjaGVzLmhhcyhmb2xkZXJNYXRjaC5yZXNvdXJjZSkpIHtcblx0XHRcdHRoaXMuX3VuRGlzcG9zZWRGb2xkZXJNYXRjaGVzLmRlbGV0ZShmb2xkZXJNYXRjaC5yZXNvdXJjZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBiYXRjaFJlcGxhY2UobWF0Y2hlczogKElTZWFyY2hUcmVlRmlsZU1hdGNoIHwgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZSlbXSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgYWxsTWF0Y2hlcyA9IGdldEZpbGVNYXRjaGVzKG1hdGNoZXMpO1xuXG5cdFx0YXdhaXQgdGhpcy5yZXBsYWNlU2VydmljZS5yZXBsYWNlKGFsbE1hdGNoZXMpO1xuXHRcdHRoaXMuZG9SZW1vdmVGaWxlKGFsbE1hdGNoZXMsIHRydWUsIHRydWUsIHRydWUpO1xuXHR9XG5cblx0cHVibGljIG9uRmlsZUNoYW5nZShmaWxlTWF0Y2g6IElTZWFyY2hUcmVlRmlsZU1hdGNoLCByZW1vdmVkID0gZmFsc2UpOiB2b2lkIHtcblx0XHRsZXQgYWRkZWQgPSBmYWxzZTtcblx0XHRpZiAoIXRoaXMuX2ZpbGVNYXRjaGVzLmhhcyhmaWxlTWF0Y2gucmVzb3VyY2UpKSB7XG5cdFx0XHR0aGlzLmRvQWRkRmlsZShmaWxlTWF0Y2gpO1xuXHRcdFx0YWRkZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoZmlsZU1hdGNoLmNvdW50KCkgPT09IDApIHtcblx0XHRcdHRoaXMuZG9SZW1vdmVGaWxlKFtmaWxlTWF0Y2hdLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0YWRkZWQgPSBmYWxzZTtcblx0XHRcdHJlbW92ZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX3JlcGxhY2luZ0FsbCkge1xuXHRcdFx0dGhpcy5fb25DaGFuZ2UuZmlyZSh7IGVsZW1lbnRzOiBbZmlsZU1hdGNoXSwgYWRkZWQ6IGFkZGVkLCByZW1vdmVkOiByZW1vdmVkIH0pO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvbkZvbGRlckNoYW5nZShmb2xkZXJNYXRjaDogRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsLCBldmVudDogSUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9mb2xkZXJNYXRjaGVzLmhhcyhmb2xkZXJNYXRjaC5yZXNvdXJjZSkpIHtcblx0XHRcdHRoaXMuZG9BZGRGb2xkZXIoZm9sZGVyTWF0Y2gpO1xuXHRcdH1cblx0XHRpZiAoZm9sZGVyTWF0Y2guaXNFbXB0eSgpKSB7XG5cdFx0XHR0aGlzLl9mb2xkZXJNYXRjaGVzLmRlbGV0ZShmb2xkZXJNYXRjaC5yZXNvdXJjZSk7XG5cdFx0XHRmb2xkZXJNYXRjaC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25DaGFuZ2UuZmlyZShldmVudCk7XG5cdH1cblxuXHRkb1JlbW92ZUZpbGUoZmlsZU1hdGNoZXM6IElTZWFyY2hUcmVlRmlsZU1hdGNoW10sIGRpc3Bvc2U6IGJvb2xlYW4gPSB0cnVlLCB0cmlnZ2VyOiBib29sZWFuID0gdHJ1ZSwga2VlcFJlYWRvbmx5ID0gZmFsc2UpOiB2b2lkIHtcblxuXHRcdGNvbnN0IHJlbW92ZWQgPSBbXTtcblx0XHRmb3IgKGNvbnN0IG1hdGNoIG9mIGZpbGVNYXRjaGVzIGFzIElTZWFyY2hUcmVlRmlsZU1hdGNoW10pIHtcblx0XHRcdGlmICh0aGlzLl9maWxlTWF0Y2hlcy5nZXQobWF0Y2gucmVzb3VyY2UpKSB7XG5cdFx0XHRcdGlmIChrZWVwUmVhZG9ubHkgJiYgbWF0Y2guaGFzUmVhZG9ubHlNYXRjaGVzKCkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9maWxlTWF0Y2hlcy5kZWxldGUobWF0Y2gucmVzb3VyY2UpO1xuXHRcdFx0XHRpZiAoZGlzcG9zZSkge1xuXHRcdFx0XHRcdG1hdGNoLmRpc3Bvc2UoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl91bkRpc3Bvc2VkRmlsZU1hdGNoZXMuc2V0KG1hdGNoLnJlc291cmNlLCBtYXRjaCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVtb3ZlZC5wdXNoKG1hdGNoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlciA9IHRoaXMuZ2V0Rm9sZGVyTWF0Y2gobWF0Y2gucmVzb3VyY2UpO1xuXHRcdFx0XHRpZiAoZm9sZGVyKSB7XG5cdFx0XHRcdFx0Zm9sZGVyLmRvUmVtb3ZlRmlsZShbbWF0Y2hdLCBkaXNwb3NlLCB0cmlnZ2VyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBFcnJvcihgRmlsZU1hdGNoICR7bWF0Y2gucmVzb3VyY2V9IGlzIG5vdCBsb2NhdGVkIHdpdGhpbiBGb2xkZXJNYXRjaCAke3RoaXMucmVzb3VyY2V9YCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodHJpZ2dlcikge1xuXHRcdFx0dGhpcy5fb25DaGFuZ2UuZmlyZSh7IGVsZW1lbnRzOiByZW1vdmVkLCByZW1vdmVkOiB0cnVlIH0pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGJpbmROb3RlYm9va0VkaXRvcldpZGdldChlZGl0b3I6IE5vdGVib29rRWRpdG9yV2lkZ2V0LCByZXNvdXJjZTogVVJJKSB7XG5cdFx0Y29uc3QgZmlsZU1hdGNoID0gdGhpcy5fZmlsZU1hdGNoZXMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoaXNOb3RlYm9va0ZpbGVNYXRjaChmaWxlTWF0Y2gpKSB7XG5cdFx0XHRpZiAoZmlsZU1hdGNoKSB7XG5cdFx0XHRcdGZpbGVNYXRjaC5iaW5kTm90ZWJvb2tFZGl0b3JXaWRnZXQoZWRpdG9yKTtcblx0XHRcdFx0YXdhaXQgZmlsZU1hdGNoLnVwZGF0ZU1hdGNoZXNGb3JFZGl0b3JXaWRnZXQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlck1hdGNoZXMgPSB0aGlzLmZvbGRlck1hdGNoZXNJdGVyYXRvcigpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVsZW0gb2YgZm9sZGVyTWF0Y2hlcykge1xuXHRcdFx0XHRcdGF3YWl0IGVsZW0uYmluZE5vdGVib29rRWRpdG9yV2lkZ2V0KGVkaXRvciwgcmVzb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YWRkRmlsZU1hdGNoKHJhdzogSUZpbGVNYXRjaFtdLCBzaWxlbnQ6IGJvb2xlYW4sIHNlYXJjaEluc3RhbmNlSUQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIHdoZW4gYWRkaW5nIGEgZmlsZU1hdGNoIHRoYXQgaGFzIGludGVybWVkaWF0ZSBkaXJlY3Rvcmllc1xuXHRcdGNvbnN0IGFkZGVkOiBJU2VhcmNoVHJlZUZpbGVNYXRjaFtdID0gW107XG5cdFx0Y29uc3QgdXBkYXRlZDogSVNlYXJjaFRyZWVGaWxlTWF0Y2hbXSA9IFtdO1xuXG5cdFx0cmF3LmZvckVhY2gocmF3RmlsZU1hdGNoID0+IHtcblx0XHRcdGNvbnN0IGV4aXN0aW5nRmlsZU1hdGNoID0gdGhpcy5nZXREb3duc3RyZWFtRmlsZU1hdGNoKHJhd0ZpbGVNYXRjaC5yZXNvdXJjZSk7XG5cdFx0XHRpZiAoZXhpc3RpbmdGaWxlTWF0Y2gpIHtcblxuXHRcdFx0XHRpZiAocmF3RmlsZU1hdGNoLnJlc3VsdHMpIHtcblx0XHRcdFx0XHRyYXdGaWxlTWF0Y2hcblx0XHRcdFx0XHRcdC5yZXN1bHRzXG5cdFx0XHRcdFx0XHQuZmlsdGVyKHJlc3VsdElzTWF0Y2gpXG5cdFx0XHRcdFx0XHQuZm9yRWFjaChtID0+IHtcblx0XHRcdFx0XHRcdFx0dGV4dFNlYXJjaFJlc3VsdFRvTWF0Y2hlcyhtLCBleGlzdGluZ0ZpbGVNYXRjaCwgZmFsc2UpXG5cdFx0XHRcdFx0XHRcdFx0LmZvckVhY2gobSA9PiBleGlzdGluZ0ZpbGVNYXRjaC5hZGQobSkpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBhZGQgY2VsbCBtYXRjaGVzXG5cdFx0XHRcdGlmIChpc0lOb3RlYm9va0ZpbGVNYXRjaFdpdGhNb2RlbChyYXdGaWxlTWF0Y2gpIHx8IGlzSU5vdGVib29rRmlsZU1hdGNoTm9Nb2RlbChyYXdGaWxlTWF0Y2gpKSB7XG5cdFx0XHRcdFx0cmF3RmlsZU1hdGNoLmNlbGxSZXN1bHRzPy5mb3JFYWNoKHJhd0NlbGxNYXRjaCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoaXNOb3RlYm9va0ZpbGVNYXRjaChleGlzdGluZ0ZpbGVNYXRjaCkpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgZXhpc3RpbmdDZWxsTWF0Y2ggPSBleGlzdGluZ0ZpbGVNYXRjaC5nZXRDZWxsTWF0Y2goZ2V0SURGcm9tSU5vdGVib29rQ2VsbE1hdGNoKHJhd0NlbGxNYXRjaCkpO1xuXHRcdFx0XHRcdFx0XHRpZiAoZXhpc3RpbmdDZWxsTWF0Y2gpIHtcblx0XHRcdFx0XHRcdFx0XHRleGlzdGluZ0NlbGxNYXRjaC5hZGRDb250ZW50TWF0Y2hlcyhyYXdDZWxsTWF0Y2guY29udGVudFJlc3VsdHMpO1xuXHRcdFx0XHRcdFx0XHRcdGV4aXN0aW5nQ2VsbE1hdGNoLmFkZFdlYnZpZXdNYXRjaGVzKHJhd0NlbGxNYXRjaC53ZWJ2aWV3UmVzdWx0cyk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0ZXhpc3RpbmdGaWxlTWF0Y2guYWRkQ2VsbE1hdGNoKHJhd0NlbGxNYXRjaCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHVwZGF0ZWQucHVzaChleGlzdGluZ0ZpbGVNYXRjaCk7XG5cblx0XHRcdFx0aWYgKHJhd0ZpbGVNYXRjaC5yZXN1bHRzICYmIHJhd0ZpbGVNYXRjaC5yZXN1bHRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRleGlzdGluZ0ZpbGVNYXRjaC5hZGRDb250ZXh0KHJhd0ZpbGVNYXRjaC5yZXN1bHRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCh0aGlzKSB8fCBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaE5vUm9vdCh0aGlzKSkge1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVNYXRjaCA9IHRoaXMuY3JlYXRlQW5kQ29uZmlndXJlRmlsZU1hdGNoKHJhd0ZpbGVNYXRjaCwgc2VhcmNoSW5zdGFuY2VJRCk7XG5cdFx0XHRcdFx0YWRkZWQucHVzaChmaWxlTWF0Y2gpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlbGVtZW50cyA9IFsuLi5hZGRlZCwgLi4udXBkYXRlZF07XG5cdFx0aWYgKCFzaWxlbnQgJiYgZWxlbWVudHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkNoYW5nZS5maXJlKHsgZWxlbWVudHMsIGFkZGVkOiAhIWFkZGVkLmxlbmd0aCB9KTtcblx0XHR9XG5cdH1cblxuXHR1bmJpbmROb3RlYm9va0VkaXRvcldpZGdldChlZGl0b3I6IE5vdGVib29rRWRpdG9yV2lkZ2V0LCByZXNvdXJjZTogVVJJKSB7XG5cdFx0Y29uc3QgZmlsZU1hdGNoID0gdGhpcy5fZmlsZU1hdGNoZXMuZ2V0KHJlc291cmNlKTtcblxuXHRcdGlmIChpc05vdGVib29rRmlsZU1hdGNoKGZpbGVNYXRjaCkpIHtcblx0XHRcdGlmIChmaWxlTWF0Y2gpIHtcblx0XHRcdFx0ZmlsZU1hdGNoLnVuYmluZE5vdGVib29rRWRpdG9yV2lkZ2V0KGVkaXRvcik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJNYXRjaGVzID0gdGhpcy5mb2xkZXJNYXRjaGVzSXRlcmF0b3IoKTtcblx0XHRcdFx0Zm9yIChjb25zdCBlbGVtIG9mIGZvbGRlck1hdGNoZXMpIHtcblx0XHRcdFx0XHRlbGVtLnVuYmluZE5vdGVib29rRWRpdG9yV2lkZ2V0KGVkaXRvciwgcmVzb3VyY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxuXHRkaXNwb3NlTWF0Y2hlcygpOiB2b2lkIHtcblx0XHRbLi4udGhpcy5fZmlsZU1hdGNoZXMudmFsdWVzKCldLmZvckVhY2goKGZpbGVNYXRjaDogSVNlYXJjaFRyZWVGaWxlTWF0Y2gpID0+IGZpbGVNYXRjaC5kaXNwb3NlKCkpO1xuXHRcdFsuLi50aGlzLl9mb2xkZXJNYXRjaGVzLnZhbHVlcygpXS5mb3JFYWNoKChmb2xkZXJNYXRjaDogRm9sZGVyTWF0Y2hJbXBsKSA9PiBmb2xkZXJNYXRjaC5kaXNwb3NlTWF0Y2hlcygpKTtcblx0XHRbLi4udGhpcy5fdW5EaXNwb3NlZEZpbGVNYXRjaGVzLnZhbHVlcygpXS5mb3JFYWNoKChmaWxlTWF0Y2g6IElTZWFyY2hUcmVlRmlsZU1hdGNoKSA9PiBmaWxlTWF0Y2guZGlzcG9zZSgpKTtcblx0XHRbLi4udGhpcy5fdW5EaXNwb3NlZEZvbGRlck1hdGNoZXMudmFsdWVzKCldLmZvckVhY2goKGZvbGRlck1hdGNoOiBGb2xkZXJNYXRjaEltcGwpID0+IGZvbGRlck1hdGNoLmRpc3Bvc2VNYXRjaGVzKCkpO1xuXHRcdHRoaXMuX2ZpbGVNYXRjaGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fZm9sZGVyTWF0Y2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3VuRGlzcG9zZWRGaWxlTWF0Y2hlcy5jbGVhcigpO1xuXHRcdHRoaXMuX3VuRGlzcG9zZWRGb2xkZXJNYXRjaGVzLmNsZWFyKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzcG9zZU1hdGNoZXMoKTtcblx0XHR0aGlzLl9vbkRpc3Bvc2UuZmlyZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsIGV4dGVuZHMgRm9sZGVyTWF0Y2hJbXBsIGltcGxlbWVudHMgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZSB7XG5cblx0cHJvdGVjdGVkIF9ub3JtYWxpemVkUmVzb3VyY2U6IExhenk8VVJJPjtcblxuXHRjb25zdHJ1Y3RvcihfcmVzb3VyY2U6IFVSSSxcblx0XHRfaWQ6IHN0cmluZyxcblx0XHRfaW5kZXg6IG51bWJlcixcblx0XHRfcXVlcnk6IElUZXh0UXVlcnksXG5cdFx0X3BhcmVudDogSVRleHRTZWFyY2hIZWFkaW5nIHwgRm9sZGVyTWF0Y2hJbXBsLFxuXHRcdF9zZWFyY2hSZXN1bHQ6IElTZWFyY2hSZXN1bHQsXG5cdFx0X2Nsb3Nlc3RSb290OiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCB8IG51bGwsXG5cdFx0QElSZXBsYWNlU2VydmljZSByZXBsYWNlU2VydmljZTogSVJlcGxhY2VTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKF9yZXNvdXJjZSwgX2lkLCBfaW5kZXgsIF9xdWVyeSwgX3BhcmVudCwgX3NlYXJjaFJlc3VsdCwgX2Nsb3Nlc3RSb290LCByZXBsYWNlU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGxhYmVsU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHR0aGlzLl9ub3JtYWxpemVkUmVzb3VyY2UgPSBuZXcgTGF6eSgoKSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkucmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5ub3JtYWxpemVQYXRoKFxuXHRcdFx0dGhpcy5yZXNvdXJjZSkpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCByZXNvdXJjZSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLl9yZXNvdXJjZSE7XG5cdH1cblxuXHRnZXQgbm9ybWFsaXplZFJlc291cmNlKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vcm1hbGl6ZWRSZXNvdXJjZS52YWx1ZTtcblx0fVxufVxuXG4vKipcbiAqIEZvbGRlck1hdGNoV29ya3NwYWNlUm9vdCA9PiBmb2xkZXIgZm9yIHdvcmtzcGFjZSByb290XG4gKi9cbmV4cG9ydCBjbGFzcyBGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3RJbXBsIGV4dGVuZHMgRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VJbXBsIGltcGxlbWVudHMgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3Qge1xuXHRjb25zdHJ1Y3RvcihfcmVzb3VyY2U6IFVSSSwgX2lkOiBzdHJpbmcsIF9pbmRleDogbnVtYmVyLCBfcXVlcnk6IElUZXh0UXVlcnksIF9wYXJlbnQ6IElUZXh0U2VhcmNoSGVhZGluZyxcblx0XHRASVJlcGxhY2VTZXJ2aWNlIHJlcGxhY2VTZXJ2aWNlOiBJUmVwbGFjZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoX3Jlc291cmNlLCBfaWQsIF9pbmRleCwgX3F1ZXJ5LCBfcGFyZW50LCBfcGFyZW50LnBhcmVudCgpLCBudWxsLCByZXBsYWNlU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGxhYmVsU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgbm9ybWFsaXplZFVyaVBhcmVudCh1cmk6IFVSSSk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5ub3JtYWxpemVQYXRoKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5kaXJuYW1lKHVyaSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cmlFcXVhbHModXJpMTogVVJJLCB1cjI6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh1cmkxLCB1cjIpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVGaWxlTWF0Y2gocXVlcnk6IElQYXR0ZXJuSW5mbywgcHJldmlld09wdGlvbnM6IElUZXh0U2VhcmNoUHJldmlld09wdGlvbnMgfCB1bmRlZmluZWQsIG1heFJlc3VsdHM6IG51bWJlciB8IHVuZGVmaW5lZCwgcGFyZW50OiBGb2xkZXJNYXRjaEltcGwsIHJhd0ZpbGVNYXRjaDogSUZpbGVNYXRjaCwgY2xvc2VzdFJvb3Q6IElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXb3Jrc3BhY2VSb290IHwgbnVsbCwgc2VhcmNoSW5zdGFuY2VJRDogc3RyaW5nKTogRmlsZU1hdGNoSW1wbCB7XG5cdFx0Ly8gVE9ETzogY2FuIHByb2JhYmx5IGp1c3QgY3JlYXRlIEZpbGVNYXRjaEltcGwgaWYgd2UgZG9uJ3QgZXhwZWN0IGNlbGwgcmVzdWx0cyBmcm9tIHRoZSBmaWxlLlxuXHRcdGNvbnN0IGZpbGVNYXRjaCA9XG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHROb3RlYm9va0NvbXBhdGlibGVGaWxlTWF0Y2gsXG5cdFx0XHRcdHF1ZXJ5LFxuXHRcdFx0XHRwcmV2aWV3T3B0aW9ucyxcblx0XHRcdFx0bWF4UmVzdWx0cyxcblx0XHRcdFx0cGFyZW50LFxuXHRcdFx0XHRyYXdGaWxlTWF0Y2gsXG5cdFx0XHRcdGNsb3Nlc3RSb290LFxuXHRcdFx0XHRzZWFyY2hJbnN0YW5jZUlELFxuXHRcdFx0KTtcblx0XHRmaWxlTWF0Y2guY3JlYXRlTWF0Y2hlcygpO1xuXHRcdHBhcmVudC5kb0FkZEZpbGUoZmlsZU1hdGNoKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gZmlsZU1hdGNoLm9uQ2hhbmdlKCh7IGRpZFJlbW92ZSB9KSA9PiBwYXJlbnQub25GaWxlQ2hhbmdlKGZpbGVNYXRjaCwgZGlkUmVtb3ZlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZmlsZU1hdGNoLm9uRGlzcG9zZSgoKSA9PiBkaXNwb3NhYmxlLmRpc3Bvc2UoKSkpO1xuXHRcdHJldHVybiBmaWxlTWF0Y2g7XG5cdH1cblxuXHRjcmVhdGVBbmRDb25maWd1cmVGaWxlTWF0Y2gocmF3RmlsZU1hdGNoOiBJRmlsZU1hdGNoPFVSST4sIHNlYXJjaEluc3RhbmNlSUQ6IHN0cmluZyk6IEZpbGVNYXRjaEltcGwge1xuXG5cdFx0aWYgKCF0aGlzLnVyaUhhc1BhcmVudCh0aGlzLnJlc291cmNlLCByYXdGaWxlTWF0Y2gucmVzb3VyY2UpKSB7XG5cdFx0XHR0aHJvdyBFcnJvcihgJHtyYXdGaWxlTWF0Y2gucmVzb3VyY2V9IGlzIG5vdCBhIGRlc2NlbmRhbnQgb2YgJHt0aGlzLnJlc291cmNlfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVNYXRjaFBhcmVudFBhcnRzOiBVUklbXSA9IFtdO1xuXHRcdGxldCB1cmkgPSB0aGlzLm5vcm1hbGl6ZWRVcmlQYXJlbnQocmF3RmlsZU1hdGNoLnJlc291cmNlKTtcblxuXHRcdHdoaWxlICghdGhpcy51cmlFcXVhbHModGhpcy5ub3JtYWxpemVkUmVzb3VyY2UsIHVyaSkpIHtcblx0XHRcdGZpbGVNYXRjaFBhcmVudFBhcnRzLnVuc2hpZnQodXJpKTtcblx0XHRcdGNvbnN0IHByZXZVcmkgPSB1cmk7XG5cdFx0XHR1cmkgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkucmVtb3ZlVHJhaWxpbmdQYXRoU2VwYXJhdG9yKHRoaXMubm9ybWFsaXplZFVyaVBhcmVudCh1cmkpKTtcblx0XHRcdGlmICh0aGlzLnVyaUVxdWFscyhwcmV2VXJpLCB1cmkpKSB7XG5cdFx0XHRcdHRocm93IEVycm9yKGAke3Jhd0ZpbGVNYXRjaC5yZXNvdXJjZX0gaXMgbm90IGNvcnJlY3RseSBjb25maWd1cmVkIGFzIGEgY2hpbGQgb2YgJHt0aGlzLm5vcm1hbGl6ZWRSZXNvdXJjZX1gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByb290ID0gdGhpcy5jbG9zZXN0Um9vdCA/PyB0aGlzO1xuXHRcdGxldCBwYXJlbnQ6IEZvbGRlck1hdGNoV2l0aFJlc291cmNlSW1wbCA9IHRoaXM7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlTWF0Y2hQYXJlbnRQYXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bGV0IGZvbGRlck1hdGNoOiBGb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUltcGwgfCB1bmRlZmluZWQgPSBwYXJlbnQuZ2V0Rm9sZGVyTWF0Y2goZmlsZU1hdGNoUGFyZW50UGFydHNbaV0pO1xuXHRcdFx0aWYgKCFmb2xkZXJNYXRjaCkge1xuXHRcdFx0XHRmb2xkZXJNYXRjaCA9IHBhcmVudC5jcmVhdGVJbnRlcm1lZGlhdGVGb2xkZXJNYXRjaChmaWxlTWF0Y2hQYXJlbnRQYXJ0c1tpXSwgZmlsZU1hdGNoUGFyZW50UGFydHNbaV0udG9TdHJpbmcoKSwgLTEsIHRoaXMuX3F1ZXJ5LCByb290KTtcblx0XHRcdH1cblx0XHRcdHBhcmVudCA9IGZvbGRlck1hdGNoO1xuXHRcdH1cblx0XHRjb25zdCBjb250ZW50UGF0dGVyblRvVXNlID0gdHlwZW9mICh0aGlzLl9xdWVyeS5jb250ZW50UGF0dGVybikgPT09ICdzdHJpbmcnID8geyBwYXR0ZXJuOiB0aGlzLl9xdWVyeS5jb250ZW50UGF0dGVybiB9IDogdGhpcy5fcXVlcnkuY29udGVudFBhdHRlcm47XG5cdFx0cmV0dXJuIHRoaXMuY3JlYXRlRmlsZU1hdGNoKGNvbnRlbnRQYXR0ZXJuVG9Vc2UsIHRoaXMuX3F1ZXJ5LnByZXZpZXdPcHRpb25zLCB0aGlzLl9xdWVyeS5tYXhSZXN1bHRzLCBwYXJlbnQsIHJhd0ZpbGVNYXRjaCwgcm9vdCwgc2VhcmNoSW5zdGFuY2VJRCk7XG5cdH1cbn1cblxuLy8gY3VycmVudGx5LCBubyBzdXBwb3J0IGZvciBBSSByZXN1bHRzIGluIG91dC1vZi13b3Jrc3BhY2UgZmlsZXNcbmV4cG9ydCBjbGFzcyBGb2xkZXJNYXRjaE5vUm9vdEltcGwgZXh0ZW5kcyBGb2xkZXJNYXRjaEltcGwgaW1wbGVtZW50cyBJU2VhcmNoVHJlZUZvbGRlck1hdGNoTm9Sb290IHtcblx0Y29uc3RydWN0b3IoX2lkOiBzdHJpbmcsIF9pbmRleDogbnVtYmVyLCBfcXVlcnk6IElUZXh0UXVlcnksIF9wYXJlbnQ6IElUZXh0U2VhcmNoSGVhZGluZyxcblx0XHRASVJlcGxhY2VTZXJ2aWNlIHJlcGxhY2VTZXJ2aWNlOiBJUmVwbGFjZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cblx0KSB7XG5cdFx0c3VwZXIobnVsbCwgX2lkLCBfaW5kZXgsIF9xdWVyeSwgX3BhcmVudCwgX3BhcmVudC5wYXJlbnQoKSwgbnVsbCwgcmVwbGFjZVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cdH1cblxuXHRjcmVhdGVBbmRDb25maWd1cmVGaWxlTWF0Y2gocmF3RmlsZU1hdGNoOiBJRmlsZU1hdGNoLCBzZWFyY2hJbnN0YW5jZUlEOiBzdHJpbmcpOiBJU2VhcmNoVHJlZUZpbGVNYXRjaCB7XG5cdFx0Y29uc3QgY29udGVudFBhdHRlcm5Ub1VzZSA9IHR5cGVvZiAodGhpcy5fcXVlcnkuY29udGVudFBhdHRlcm4pID09PSAnc3RyaW5nJyA/IHsgcGF0dGVybjogdGhpcy5fcXVlcnkuY29udGVudFBhdHRlcm4gfSA6IHRoaXMuX3F1ZXJ5LmNvbnRlbnRQYXR0ZXJuO1xuXHRcdC8vIFRPRE86IGNhbiBwcm9iYWJseSBqdXN0IGNyZWF0ZSBGaWxlTWF0Y2hJbXBsIGlmIHdlIGRvbid0IGV4cGVjdCBjZWxsIHJlc3VsdHMgZnJvbSB0aGUgZmlsZS5cblx0XHRjb25zdCBmaWxlTWF0Y2ggPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Tm90ZWJvb2tDb21wYXRpYmxlRmlsZU1hdGNoLFxuXHRcdFx0Y29udGVudFBhdHRlcm5Ub1VzZSxcblx0XHRcdHRoaXMuX3F1ZXJ5LnByZXZpZXdPcHRpb25zLFxuXHRcdFx0dGhpcy5fcXVlcnkubWF4UmVzdWx0cyxcblx0XHRcdHRoaXMsIHJhd0ZpbGVNYXRjaCxcblx0XHRcdG51bGwsXG5cdFx0XHRzZWFyY2hJbnN0YW5jZUlELFxuXHRcdCkpO1xuXHRcdGZpbGVNYXRjaC5jcmVhdGVNYXRjaGVzKCk7XG5cdFx0dGhpcy5kb0FkZEZpbGUoZmlsZU1hdGNoKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gZmlsZU1hdGNoLm9uQ2hhbmdlKCh7IGRpZFJlbW92ZSB9KSA9PiB0aGlzLm9uRmlsZUNoYW5nZShmaWxlTWF0Y2gsIGRpZFJlbW92ZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZpbGVNYXRjaC5vbkRpc3Bvc2UoKCkgPT4gZGlzcG9zYWJsZS5kaXNwb3NlKCkpKTtcblx0XHRyZXR1cm4gZmlsZU1hdGNoO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMseUJBQXlCO0FBR2xDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQTBFLHFCQUFxQjtBQUcvRixTQUF5TSxzQ0FBMEQsK0JBQStCLHFCQUFxQixzQkFBc0I7QUFFN1UsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUywrQkFBK0IsbUNBQW1DO0FB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
