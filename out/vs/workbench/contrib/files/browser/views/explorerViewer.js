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
import * as DOM from "../../../../../base/browser/dom.js";
import * as glob from "../../../../../base/common/glob.js";
import { ListDragOverEffectPosition, ListDragOverEffectType } from "../../../../../base/browser/ui/list/list.js";
import { IProgressService, ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IFileService, FileKind, FileOperationResult, FileChangeType } from "../../../../../platform/files/common/files.js";
import { IWorkbenchLayoutService } from "../../../../services/layout/browser/layoutService.js";
import { isTemporaryWorkspace, IWorkspaceContextService, WorkbenchState } from "../../../../../platform/workspace/common/workspace.js";
import { Disposable, dispose, toDisposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { TreeVisibility, TreeDragOverBubble } from "../../../../../base/browser/ui/tree/tree.js";
import { IContextMenuService, IContextViewService } from "../../../../../platform/contextview/browser/contextView.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ExplorerFindProviderActive, UndoConfirmLevel } from "../../common/files.js";
import { dirname, joinPath, distinctParents, relativePath } from "../../../../../base/common/resources.js";
import { InputBox, MessageType } from "../../../../../base/browser/ui/inputbox/inputBox.js";
import { localize } from "../../../../../nls.js";
import { createSingleCallFunction } from "../../../../../base/common/functional.js";
import { equals, deepClone } from "../../../../../base/common/objects.js";
import * as path from "../../../../../base/common/path.js";
import { ExplorerItem, NewExplorerItem } from "../../common/explorerModel.js";
import { compareFileExtensionsDefault, compareFileNamesDefault, compareFileNamesUpper, compareFileExtensionsUpper, compareFileNamesLower, compareFileExtensionsLower, compareFileNamesUnicode, compareFileExtensionsUnicode } from "../../../../../base/common/comparers.js";
import { CodeDataTransfers, containsDragType } from "../../../../../platform/dnd/browser/dnd.js";
import { fillEditorsDragData } from "../../../../browser/dnd.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { DataTransfers } from "../../../../../base/browser/dnd.js";
import { Schemas } from "../../../../../base/common/network.js";
import { NativeDragAndDropData, ExternalElementsDragAndDropData, ListViewTargetSector } from "../../../../../base/browser/ui/list/listView.js";
import { isMacintosh, isWeb } from "../../../../../base/common/platform.js";
import { IDialogService, getFileNamesMessage } from "../../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceEditingService } from "../../../../services/workspaces/common/workspaceEditing.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { findValidPasteFileTarget } from "../fileActions.js";
import { createMatches } from "../../../../../base/common/filters.js";
import { Emitter, Event, EventMultiplexer } from "../../../../../base/common/event.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { isNumber } from "../../../../../base/common/types.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { ResourceFileEdit } from "../../../../../editor/browser/services/bulkEditService.js";
import { IExplorerService } from "../files.js";
import { BrowserFileUpload, ExternalFileImport, getMultipleFilesOverwriteConfirm } from "../fileImportExport.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { WebFileSystemAccess } from "../../../../../platform/files/browser/webFileSystemAccess.js";
import { IgnoreFile } from "../../../../services/search/common/ignoreFile.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { TernarySearchTree } from "../../../../../base/common/ternarySearchTree.js";
import { defaultCountBadgeStyles, defaultInputBoxStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { timeout } from "../../../../../base/common/async.js";
import { IFilesConfigurationService } from "../../../../services/filesConfiguration/common/filesConfigurationService.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { explorerFileContribRegistry } from "../explorerFileContrib.js";
import { ISearchService, QueryType, getExcludes } from "../../../../services/search/common/search.js";
import { TreeFindMatchType, TreeFindMode } from "../../../../../base/browser/ui/tree/abstractTree.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { CountBadge } from "../../../../../base/browser/ui/countBadge/countBadge.js";
import { listFilterMatchHighlight, listFilterMatchHighlightBorder } from "../../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../../platform/theme/common/colorUtils.js";
const _ExplorerDelegate = class _ExplorerDelegate {
  getHeight(element) {
    return _ExplorerDelegate.ITEM_HEIGHT;
  }
  getTemplateId(element) {
    return FilesRenderer.ID;
  }
};
_ExplorerDelegate.ITEM_HEIGHT = 22;
let ExplorerDelegate = _ExplorerDelegate;
const explorerRootErrorEmitter = new Emitter();
let ExplorerDataSource = class {
  constructor(fileFilter, findProvider, progressService, configService, notificationService, layoutService, fileService, explorerService, contextService, filesConfigService) {
    this.fileFilter = fileFilter;
    this.findProvider = findProvider;
    this.progressService = progressService;
    this.configService = configService;
    this.notificationService = notificationService;
    this.layoutService = layoutService;
    this.fileService = fileService;
    this.explorerService = explorerService;
    this.contextService = contextService;
    this.filesConfigService = filesConfigService;
  }
  getParent(element) {
    if (element.parent) {
      return element.parent;
    }
    throw new Error("getParent only supported for cached parents");
  }
  hasChildren(element) {
    return Array.isArray(element) || element.hasChildren((stat) => this.fileFilter.filter(stat, TreeVisibility.Visible));
  }
  getChildren(element) {
    if (Array.isArray(element)) {
      return element;
    }
    if (this.findProvider.isShowingFilterResults()) {
      return Array.from(element.children.values());
    }
    const hasError = element.error;
    const sortOrder = this.explorerService.sortOrderConfiguration.sortOrder;
    const children = element.fetchChildren(sortOrder);
    if (Array.isArray(children)) {
      return children;
    }
    const promise = children.then(
      (children2) => {
        if (element instanceof ExplorerItem && element.isRoot && !element.error && hasError && this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER) {
          explorerRootErrorEmitter.fire(element.resource);
        }
        return children2;
      },
      (e) => {
        if (element instanceof ExplorerItem && element.isRoot) {
          if (this.contextService.getWorkbenchState() === WorkbenchState.FOLDER) {
            const placeholder = new ExplorerItem(element.resource, this.fileService, this.configService, this.filesConfigService, void 0, void 0, false);
            placeholder.error = e;
            return [placeholder];
          } else {
            explorerRootErrorEmitter.fire(element.resource);
          }
        } else {
          this.notificationService.error(e);
        }
        return [];
      }
    );
    this.progressService.withProgress({
      location: ProgressLocation.Explorer,
      delay: this.layoutService.isRestored() ? 800 : 1500
      // reduce progress visibility when still restoring
    }, (_progress) => promise);
    return promise;
  }
};
ExplorerDataSource = __decorateClass([
  __decorateParam(2, IProgressService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IWorkbenchLayoutService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IExplorerService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IFilesConfigurationService)
], ExplorerDataSource);
class PhantomExplorerItem extends ExplorerItem {
  constructor(resource, fileService, configService, filesConfigService, _parent, _isDirectory) {
    super(resource, fileService, configService, filesConfigService, _parent, _isDirectory);
  }
}
class ExplorerFindHighlightTree {
  constructor() {
    this._tree = /* @__PURE__ */ new Map();
    this._highlightedItems = /* @__PURE__ */ new Map();
  }
  get highlightedItems() {
    return Array.from(this._highlightedItems.values());
  }
  get(item) {
    const result = this.find(item);
    if (result === void 0) {
      return 0;
    }
    const { treeLayer, relPath } = result;
    this._highlightedItems.set(relPath, item);
    return treeLayer.childMatches;
  }
  find(item) {
    const rootLayer = this._tree.get(item.root.name);
    if (rootLayer === void 0) {
      return void 0;
    }
    const relPath = relativePath(item.root.resource, item.resource);
    if (relPath === void 0 || relPath.startsWith("..")) {
      throw new Error("Resource is not a child of the root");
    }
    if (relPath === "") {
      return { treeLayer: rootLayer, relPath };
    }
    let treeLayer = rootLayer;
    for (const segment of relPath.split("/")) {
      if (!treeLayer.stats[segment]) {
        return void 0;
      }
      treeLayer = treeLayer.stats[segment];
    }
    return { treeLayer, relPath };
  }
  add(resource, root) {
    const relPath = relativePath(root.resource, resource);
    if (relPath === void 0 || relPath.startsWith("..")) {
      throw new Error("Resource is not a child of the root");
    }
    let rootLayer = this._tree.get(root.name);
    if (!rootLayer) {
      rootLayer = { childMatches: 0, stats: {}, isMatch: false };
      this._tree.set(root.name, rootLayer);
    }
    rootLayer.childMatches++;
    let treeLayer = rootLayer;
    for (const stat of relPath.split("/")) {
      if (!treeLayer.stats[stat]) {
        treeLayer.stats[stat] = { childMatches: 0, stats: {}, isMatch: false };
      }
      treeLayer = treeLayer.stats[stat];
      treeLayer.childMatches++;
    }
    treeLayer.childMatches--;
    treeLayer.isMatch = true;
  }
  isMatch(item) {
    const result = this.find(item);
    if (result === void 0) {
      return false;
    }
    const { treeLayer } = result;
    return treeLayer.isMatch;
  }
  clear() {
    this._tree.clear();
  }
}
let ExplorerFindProvider = class {
  constructor(filesFilter, treeProvider, searchService, fileService, configurationService, filesConfigService, progressService, explorerService, contextKeyService) {
    this.filesFilter = filesFilter;
    this.treeProvider = treeProvider;
    this.searchService = searchService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.filesConfigService = filesConfigService;
    this.progressService = progressService;
    this.explorerService = explorerService;
    this.sessionId = 0;
    this.phantomParents = /* @__PURE__ */ new Set();
    this.findHighlightTree = new ExplorerFindHighlightTree();
    this.explorerFindActiveContextKey = ExplorerFindProviderActive.bindTo(contextKeyService);
  }
  get highlightTree() {
    return this.findHighlightTree;
  }
  isShowingFilterResults() {
    return !!this.filterSessionStartState;
  }
  isVisible(element) {
    if (!this.filterSessionStartState) {
      return true;
    }
    if (this.explorerService.isEditable(element)) {
      return true;
    }
    return this.filterSessionStartState.rootsWithProviders.has(element.root) ? element.isMarkedAsFiltered() : true;
  }
  startSession() {
    this.sessionId++;
  }
  async endSession() {
    if (this.filterSessionStartState) {
      await this.endFilterSession();
    }
    if (this.highlightSessionStartState) {
      this.endHighlightSession();
    }
  }
  async find(pattern, toggles, token) {
    const promise = this.doFind(pattern, toggles, token);
    return await this.progressService.withProgress({
      location: ProgressLocation.Explorer,
      delay: 750
    }, (_progress) => promise);
  }
  async doFind(pattern, toggles, token) {
    if (toggles.findMode === TreeFindMode.Highlight) {
      if (this.filterSessionStartState) {
        await this.endFilterSession();
      }
      if (!this.highlightSessionStartState) {
        this.startHighlightSession();
      }
      return await this.doHighlightFind(pattern, toggles.matchType, token);
    }
    if (this.highlightSessionStartState) {
      this.endHighlightSession();
    }
    if (!this.filterSessionStartState) {
      this.startFilterSession();
    }
    return await this.doFilterFind(pattern, toggles.matchType, token);
  }
  // Filter
  startFilterSession() {
    const tree = this.treeProvider();
    const input = tree.getInput();
    if (!input) {
      return;
    }
    const roots = this.explorerService.roots.filter((root) => this.searchSupportsScheme(root.resource.scheme));
    this.filterSessionStartState = { viewState: tree.getViewState(), input, rootsWithProviders: new Set(roots) };
    this.explorerFindActiveContextKey.set(true);
  }
  async doFilterFind(pattern, matchType, token) {
    if (!this.filterSessionStartState) {
      throw new Error("ExplorerFindProvider: no session state");
    }
    const roots = Array.from(this.filterSessionStartState.rootsWithProviders);
    const searchResults = await this.getSearchResults(pattern, roots, matchType, token);
    if (token.isCancellationRequested) {
      return void 0;
    }
    this.clearPhantomElements();
    for (const { explorerRoot, files, directories } of searchResults) {
      this.addWorkspaceFilterResults(explorerRoot, files, directories);
    }
    const tree = this.treeProvider();
    await tree.setInput(this.filterSessionStartState.input);
    const hitMaxResults = searchResults.some(({ hitMaxResults: hitMaxResults2 }) => hitMaxResults2);
    return {
      isMatch: (item) => item.isMarkedAsFiltered(),
      matchCount: searchResults.reduce((acc, { files, directories }) => acc + files.length + directories.length, 0),
      warningMessage: hitMaxResults ? localize("searchMaxResultsWarning", "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.") : void 0
    };
  }
  addWorkspaceFilterResults(root, files, directories) {
    const results = [
      ...files.map((file) => ({ resource: file, isDirectory: false })),
      ...directories.map((directory) => ({ resource: directory, isDirectory: true }))
    ];
    for (const { resource, isDirectory } of results) {
      const element = root.find(resource);
      if (element && element.root === root) {
        element.markItemAndParentsAsFiltered();
        continue;
      }
      const phantomElements = this.createPhantomItems(resource, root, isDirectory);
      if (phantomElements.length === 0) {
        throw new Error("Phantom item was not created even though it is not in the model");
      }
      const firstPhantomParent = phantomElements[0].parent;
      if (!(firstPhantomParent instanceof PhantomExplorerItem)) {
        this.phantomParents.add(firstPhantomParent);
      }
      const phantomFileElement = phantomElements[phantomElements.length - 1];
      phantomFileElement.markItemAndParentsAsFiltered();
    }
  }
  createPhantomItems(resource, root, resourceIsDirectory) {
    const relativePathToRoot = relativePath(root.resource, resource);
    if (!relativePathToRoot) {
      throw new Error("Resource is not a child of the root");
    }
    const phantomElements = [];
    let currentItem = root;
    let currentResource = root.resource;
    const pathSegments = relativePathToRoot.split("/");
    for (const stat of pathSegments) {
      currentResource = currentResource.with({ path: `${currentResource.path}/${stat}` });
      let child = currentItem.getChild(stat);
      if (!child) {
        const isDirectory = pathSegments[pathSegments.length - 1] === stat ? resourceIsDirectory : true;
        child = new PhantomExplorerItem(currentResource, this.fileService, this.configurationService, this.filesConfigService, currentItem, isDirectory);
        currentItem.addChild(child);
        phantomElements.push(child);
      }
      currentItem = child;
    }
    return phantomElements;
  }
  async endFilterSession() {
    this.clearPhantomElements();
    this.explorerFindActiveContextKey.set(false);
    if (!this.filterSessionStartState) {
      throw new Error("ExplorerFindProvider: no session state to restore");
    }
    const tree = this.treeProvider();
    await tree.setInput(this.filterSessionStartState.input, this.filterSessionStartState.viewState);
    this.filterSessionStartState = void 0;
    this.explorerService.refresh();
  }
  clearPhantomElements() {
    for (const phantomParent of this.phantomParents) {
      phantomParent.forgetChildren();
    }
    this.phantomParents.clear();
    this.explorerService.roots.forEach((root) => root.unmarkItemAndChildren());
  }
  // Highlight
  startHighlightSession() {
    const roots = this.explorerService.roots.filter((root) => this.searchSupportsScheme(root.resource.scheme));
    this.highlightSessionStartState = { rootsWithProviders: new Set(roots) };
  }
  async doHighlightFind(pattern, matchType, token) {
    if (!this.highlightSessionStartState) {
      throw new Error("ExplorerFindProvider: no highlight session state");
    }
    const roots = Array.from(this.highlightSessionStartState.rootsWithProviders);
    const searchResults = await this.getSearchResults(pattern, roots, matchType, token);
    if (token.isCancellationRequested) {
      return void 0;
    }
    this.clearHighlights();
    for (const { explorerRoot, files, directories } of searchResults) {
      this.addWorkspaceHighlightResults(explorerRoot, files.concat(directories));
    }
    const hitMaxResults = searchResults.some(({ hitMaxResults: hitMaxResults2 }) => hitMaxResults2);
    return {
      isMatch: (item) => this.findHighlightTree.isMatch(item) || this.findHighlightTree.get(item) > 0 && this.treeProvider().isCollapsed(item),
      matchCount: searchResults.reduce((acc, { files, directories }) => acc + files.length + directories.length, 0),
      warningMessage: hitMaxResults ? localize("searchMaxResultsWarning", "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.") : void 0
    };
  }
  addWorkspaceHighlightResults(root, resources) {
    const highlightedDirectories = /* @__PURE__ */ new Set();
    const storeDirectories = (item) => {
      while (item) {
        highlightedDirectories.add(item);
        item = item.parent;
      }
    };
    for (const resource of resources) {
      const element = root.find(resource);
      if (element && element.root === root) {
        this.findHighlightTree.add(resource, root);
        storeDirectories(element.parent);
        continue;
      }
      const firstParent = findFirstParent(resource, root);
      if (firstParent) {
        this.findHighlightTree.add(resource, root);
        storeDirectories(firstParent.parent);
      }
    }
    const tree = this.treeProvider();
    for (const directory of highlightedDirectories) {
      if (tree.hasNode(directory)) {
        tree.rerender(directory);
      }
    }
  }
  endHighlightSession() {
    this.highlightSessionStartState = void 0;
    this.clearHighlights();
  }
  clearHighlights() {
    const tree = this.treeProvider();
    for (const item of this.findHighlightTree.highlightedItems) {
      if (tree.hasNode(item)) {
        tree.rerender(item);
      }
    }
    this.findHighlightTree.clear();
  }
  // Search
  searchSupportsScheme(scheme) {
    if (scheme !== Schemas.file && scheme !== Schemas.vscodeRemote) {
      return false;
    }
    return this.searchService.schemeHasFileSearchProvider(scheme);
  }
  async getSearchResults(pattern, roots, matchType, token) {
    const patternLowercase = pattern.toLowerCase();
    const isFuzzyMatch = matchType === TreeFindMatchType.Fuzzy;
    return await Promise.all(roots.map((root, index) => this.searchInWorkspace(patternLowercase, root, index, isFuzzyMatch, token)));
  }
  async searchInWorkspace(patternLowercase, root, rootIndex, isFuzzyMatch, token) {
    const segmentMatchPattern = caseInsensitiveGlobPattern(isFuzzyMatch ? fuzzyMatchingGlobPattern(patternLowercase) : continousMatchingGlobPattern(patternLowercase));
    const searchExcludePattern = getExcludes(this.configurationService.getValue({ resource: root.resource })) || {};
    const searchOptions = {
      folderQueries: [{
        folder: root.resource,
        disregardIgnoreFiles: !this.configurationService.getValue("explorer.excludeGitIgnore")
      }],
      type: QueryType.File,
      shouldGlobMatchFilePattern: true,
      cacheKey: `explorerfindprovider:${root.name}:${rootIndex}:${this.sessionId}`,
      excludePattern: searchExcludePattern
    };
    let fileResults;
    let folderResults;
    try {
      [fileResults, folderResults] = await Promise.all([
        this.searchService.fileSearch({ ...searchOptions, filePattern: `**/${segmentMatchPattern}`, maxResults: 512 }, token),
        this.searchService.fileSearch({ ...searchOptions, filePattern: `**/${segmentMatchPattern}/**` }, token)
      ]);
    } catch (e) {
      if (!isCancellationError(e)) {
        throw e;
      }
    }
    if (!fileResults || !folderResults || token.isCancellationRequested) {
      return { explorerRoot: root, files: [], directories: [], hitMaxResults: false };
    }
    const fileResultResources = fileResults.results.map((result) => result.resource);
    const directoryResources = getMatchingDirectoriesFromFiles(folderResults.results.map((result) => result.resource), root, segmentMatchPattern);
    const filteredFileResources = fileResultResources.filter((resource) => !this.filesFilter.isIgnored(resource, root.resource, false));
    const filteredDirectoryResources = directoryResources.filter((resource) => !this.filesFilter.isIgnored(resource, root.resource, true));
    return { explorerRoot: root, files: filteredFileResources, directories: filteredDirectoryResources, hitMaxResults: !!fileResults.limitHit || !!folderResults.limitHit };
  }
};
ExplorerFindProvider = __decorateClass([
  __decorateParam(2, ISearchService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IFilesConfigurationService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, IExplorerService),
  __decorateParam(8, IContextKeyService)
], ExplorerFindProvider);
function getMatchingDirectoriesFromFiles(resources, root, segmentMatchPattern) {
  const uniqueDirectories = new ResourceSet();
  for (const resource of resources) {
    const relativePathToRoot = relativePath(root.resource, resource);
    if (!relativePathToRoot) {
      throw new Error("Resource is not a child of the root");
    }
    let dirResource = root.resource;
    const stats = relativePathToRoot.split("/").slice(0, -1);
    for (const stat of stats) {
      dirResource = dirResource.with({ path: `${dirResource.path}/${stat}` });
      uniqueDirectories.add(dirResource);
    }
  }
  const matchingDirectories = [];
  for (const dirResource of uniqueDirectories) {
    const stats = dirResource.path.split("/");
    const dirStat = stats[stats.length - 1];
    if (!dirStat || !glob.match(segmentMatchPattern, dirStat)) {
      continue;
    }
    matchingDirectories.push(dirResource);
  }
  return matchingDirectories;
}
function findFirstParent(resource, root) {
  const relativePathToRoot = relativePath(root.resource, resource);
  if (!relativePathToRoot) {
    throw new Error("Resource is not a child of the root");
  }
  let currentItem = root;
  let currentResource = root.resource;
  const pathSegments = relativePathToRoot.split("/");
  for (const stat of pathSegments) {
    currentResource = currentResource.with({ path: `${currentResource.path}/${stat}` });
    const child = currentItem.getChild(stat);
    if (!child) {
      return currentItem;
    }
    currentItem = child;
  }
  return void 0;
}
function fuzzyMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern.split("").join("*") + "*";
}
function continousMatchingGlobPattern(pattern) {
  if (!pattern) {
    return "*";
  }
  return "*" + pattern + "*";
}
function caseInsensitiveGlobPattern(pattern) {
  let caseInsensitiveFilePattern = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (/[a-zA-Z]/.test(char)) {
      caseInsensitiveFilePattern += `[${char.toLowerCase()}${char.toUpperCase()}]`;
    } else {
      caseInsensitiveFilePattern += char;
    }
  }
  return caseInsensitiveFilePattern;
}
class CompressedNavigationController {
  constructor(id, items, templateData, depth, collapsed) {
    this.id = id;
    this.items = items;
    this.depth = depth;
    this.collapsed = collapsed;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._index = items.length - 1;
    this.updateLabels(templateData);
    this._updateLabelDisposable = templateData.label.onDidRender(() => this.updateLabels(templateData));
  }
  get index() {
    return this._index;
  }
  get count() {
    return this.items.length;
  }
  get current() {
    return this.items[this._index];
  }
  get currentId() {
    return `${this.id}_${this.index}`;
  }
  get labels() {
    return this._labels;
  }
  updateLabels(templateData) {
    this._labels = Array.from(templateData.container.querySelectorAll(".label-name"));
    let parents = "";
    for (let i = 0; i < this.labels.length; i++) {
      const ariaLabel = parents.length ? `${this.items[i].name}, compact, ${parents}` : this.items[i].name;
      this.labels[i].setAttribute("aria-label", ariaLabel);
      this.labels[i].setAttribute("aria-level", `${this.depth + i}`);
      parents = parents.length ? `${this.items[i].name} ${parents}` : this.items[i].name;
    }
    this.updateCollapsed(this.collapsed);
    if (this._index < this.labels.length) {
      this.labels[this._index].classList.add("active");
    }
  }
  previous() {
    if (this._index <= 0) {
      return;
    }
    this.setIndex(this._index - 1);
  }
  next() {
    if (this._index >= this.items.length - 1) {
      return;
    }
    this.setIndex(this._index + 1);
  }
  first() {
    if (this._index === 0) {
      return;
    }
    this.setIndex(0);
  }
  last() {
    if (this._index === this.items.length - 1) {
      return;
    }
    this.setIndex(this.items.length - 1);
  }
  setIndex(index) {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    this.labels[this._index].classList.remove("active");
    this._index = index;
    this.labels[this._index].classList.add("active");
    this._onDidChange.fire();
  }
  updateCollapsed(collapsed) {
    this.collapsed = collapsed;
    for (let i = 0; i < this.labels.length; i++) {
      this.labels[i].setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }
  dispose() {
    this._onDidChange.dispose();
    this._updateLabelDisposable.dispose();
  }
}
CompressedNavigationController.ID = 0;
let FilesRenderer = class {
  constructor(container, labels, highlightTree, updateWidth, contextViewService, themeService, configurationService, explorerService, labelService, contextService, contextMenuService, instantiationService) {
    this.labels = labels;
    this.highlightTree = highlightTree;
    this.updateWidth = updateWidth;
    this.contextViewService = contextViewService;
    this.themeService = themeService;
    this.configurationService = configurationService;
    this.explorerService = explorerService;
    this.labelService = labelService;
    this.contextService = contextService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.compressedNavigationControllers = /* @__PURE__ */ new Map();
    this._onDidChangeActiveDescendant = new EventMultiplexer();
    this.onDidChangeActiveDescendant = this._onDidChangeActiveDescendant.event;
    this.config = this.configurationService.getValue();
    const updateOffsetStyles = () => {
      const indent = this.configurationService.getValue("workbench.tree.indent");
      const offset = Math.max(22 - indent, 0);
      container.style.setProperty(`--vscode-explorer-align-offset-margin-left`, `${offset}px`);
    };
    this.configListener = this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("explorer")) {
        this.config = this.configurationService.getValue();
      }
      if (e.affectsConfiguration("workbench.tree.indent")) {
        updateOffsetStyles();
      }
    });
    updateOffsetStyles();
  }
  getWidgetAriaLabel() {
    return localize("treeAriaLabel", "Files Explorer");
  }
  get templateId() {
    return FilesRenderer.ID;
  }
  // Void added this
  // // Create void buttons container
  // const voidButtonsContainer = DOM.append(container, DOM.$('div'));
  // voidButtonsContainer.style.position = 'absolute'
  // voidButtonsContainer.style.top = '0'
  // voidButtonsContainer.style.right = '0'
  // // const voidButtons = DOM.append(voidButtonsContainer, DOM.$('span'));
  // // voidButtons.textContent = 'voidbuttons'
  // // voidButtons.addEventListener('click', () => {
  // // 	console.log('ON CLICK', templateData.currentContext?.children)
  // // })
  // const voidLabels = this.labels.create(voidButtonsContainer, { supportHighlights: false, supportIcons: false, });
  // voidLabels.element.textContent = 'hi333'
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const label = templateDisposables.add(this.labels.create(container, { supportHighlights: true }));
    templateDisposables.add(label.onDidRender(() => {
      try {
        if (templateData.currentContext) {
          this.updateWidth(templateData.currentContext);
        }
      } catch (e) {
      }
    }));
    const contribs = explorerFileContribRegistry.create(this.instantiationService, container, templateDisposables);
    templateDisposables.add(explorerFileContribRegistry.onDidRegisterDescriptor((d) => {
      const contr = d.create(this.instantiationService, container);
      contribs.push(templateDisposables.add(contr));
      contr.setResource(templateData.currentContext?.resource);
    }));
    const templateData = { templateDisposables, elementDisposables: templateDisposables.add(new DisposableStore()), label, container, contribs };
    return templateData;
  }
  // Void cares about this function, this is where elements in the tree are rendered
  renderElement(node, index, templateData) {
    const stat = node.element;
    templateData.currentContext = stat;
    const editableData = this.explorerService.getEditableData(stat);
    templateData.label.element.classList.remove("compressed");
    if (!editableData) {
      templateData.label.element.style.display = "flex";
      this.renderStat(stat, stat.name, void 0, node.filterData, templateData);
    } else {
      templateData.label.element.style.display = "none";
      templateData.contribs.forEach((c) => c.setResource(void 0));
      templateData.elementDisposables.add(this.renderInputBox(templateData.container, stat, editableData));
    }
  }
  renderCompressedElements(node, index, templateData, height) {
    const stat = node.element.elements[node.element.elements.length - 1];
    templateData.currentContext = stat;
    const editable = node.element.elements.filter((e) => this.explorerService.isEditable(e));
    const editableData = editable.length === 0 ? void 0 : this.explorerService.getEditableData(editable[0]);
    if (!editableData) {
      templateData.label.element.classList.add("compressed");
      templateData.label.element.style.display = "flex";
      const id = `compressed-explorer_${CompressedNavigationController.ID++}`;
      const labels = node.element.elements.map((e) => e.name);
      let fuzzyScore = node.filterData;
      if (fuzzyScore && fuzzyScore.length > 2) {
        const filterDataOffset = labels.join("/").length - labels[labels.length - 1].length;
        fuzzyScore = [fuzzyScore[0], fuzzyScore[1] + filterDataOffset, ...fuzzyScore.slice(2)];
      }
      this.renderStat(stat, labels, id, fuzzyScore, templateData);
      const compressedNavigationController = new CompressedNavigationController(id, node.element.elements, templateData, node.depth, node.collapsed);
      templateData.elementDisposables.add(compressedNavigationController);
      const nodeControllers = this.compressedNavigationControllers.get(stat) ?? [];
      this.compressedNavigationControllers.set(stat, [...nodeControllers, compressedNavigationController]);
      templateData.elementDisposables.add(this._onDidChangeActiveDescendant.add(compressedNavigationController.onDidChange));
      templateData.elementDisposables.add(DOM.addDisposableListener(templateData.container, "mousedown", (e) => {
        const result = getIconLabelNameFromHTMLElement(e.target);
        if (result) {
          compressedNavigationController.setIndex(result.index);
        }
      }));
      templateData.elementDisposables.add(toDisposable(() => {
        const nodeControllers2 = this.compressedNavigationControllers.get(stat) ?? [];
        const renderedIndex = nodeControllers2.findIndex((controller) => controller === compressedNavigationController);
        if (renderedIndex < 0) {
          throw new Error("Disposing unknown navigation controller");
        }
        if (nodeControllers2.length === 1) {
          this.compressedNavigationControllers.delete(stat);
        } else {
          nodeControllers2.splice(renderedIndex, 1);
        }
      }));
    } else {
      templateData.label.element.classList.remove("compressed");
      templateData.label.element.style.display = "none";
      templateData.contribs.forEach((c) => c.setResource(void 0));
      templateData.elementDisposables.add(this.renderInputBox(templateData.container, editable[0], editableData));
    }
  }
  renderStat(stat, label, domId, filterData, templateData) {
    templateData.label.element.style.display = "flex";
    const extraClasses = ["explorer-item"];
    if (this.explorerService.isCut(stat)) {
      extraClasses.push("cut");
    }
    const theme = this.themeService.getFileIconTheme();
    const twistieContainer = templateData.container.parentElement?.parentElement?.querySelector(".monaco-tl-twistie");
    twistieContainer?.classList.toggle("force-twistie", stat.hasNests && theme.hidesExplorerArrows);
    const themeIsUnhappyWithNesting = theme.hasFileIcons && (theme.hidesExplorerArrows || !theme.hasFolderIcons);
    const realignNestedChildren = stat.nestedParent && themeIsUnhappyWithNesting;
    templateData.contribs.forEach((c) => c.setResource(stat.resource));
    templateData.label.setResource({ resource: stat.resource, name: label }, {
      fileKind: stat.isRoot ? FileKind.ROOT_FOLDER : stat.isDirectory ? FileKind.FOLDER : FileKind.FILE,
      extraClasses: realignNestedChildren ? [...extraClasses, "align-nest-icon-with-parent-icon"] : extraClasses,
      fileDecorations: this.config.explorer.decorations,
      matches: createMatches(filterData),
      separator: this.labelService.getSeparator(stat.resource.scheme, stat.resource.authority),
      domId
    });
    const highlightResults = stat.isDirectory ? this.highlightTree.get(stat) : 0;
    if (highlightResults > 0) {
      const badge = new CountBadge(templateData.label.element.lastElementChild, {}, { ...defaultCountBadgeStyles, badgeBackground: asCssVariable(listFilterMatchHighlight), badgeBorder: asCssVariable(listFilterMatchHighlightBorder) });
      badge.setCount(highlightResults);
      badge.setTitleFormat(localize("explorerHighlightFolderBadgeTitle", "Directory contains {0} matches", highlightResults));
      templateData.elementDisposables.add(badge);
    }
    templateData.label.element.classList.toggle("highlight-badge", highlightResults > 0);
  }
  renderInputBox(container, stat, editableData) {
    const label = this.labels.create(container);
    const extraClasses = ["explorer-item", "explorer-item-edited"];
    const fileKind = stat.isRoot ? FileKind.ROOT_FOLDER : stat.isDirectory ? FileKind.FOLDER : FileKind.FILE;
    const theme = this.themeService.getFileIconTheme();
    const themeIsUnhappyWithNesting = theme.hasFileIcons && (theme.hidesExplorerArrows || !theme.hasFolderIcons);
    const realignNestedChildren = stat.nestedParent && themeIsUnhappyWithNesting;
    const labelOptions = {
      hidePath: true,
      hideLabel: true,
      fileKind,
      extraClasses: realignNestedChildren ? [...extraClasses, "align-nest-icon-with-parent-icon"] : extraClasses
    };
    const parent = stat.name ? dirname(stat.resource) : stat.resource;
    const value = stat.name || "";
    label.setFile(joinPath(parent, value || " "), labelOptions);
    label.element.firstElementChild.style.display = "none";
    const inputBox = new InputBox(label.element, this.contextViewService, {
      validationOptions: {
        validation: (value2) => {
          const message = editableData.validationMessage(value2);
          if (!message || message.severity !== Severity.Error) {
            return null;
          }
          return {
            content: message.content,
            formatContent: true,
            type: MessageType.ERROR
          };
        }
      },
      ariaLabel: localize("fileInputAriaLabel", "Type file name. Press Enter to confirm or Escape to cancel."),
      inputBoxStyles: defaultInputBoxStyles
    });
    const lastDot = value.lastIndexOf(".");
    let currentSelectionState = "prefix";
    inputBox.value = value;
    inputBox.focus();
    inputBox.select({ start: 0, end: lastDot > 0 && !stat.isDirectory ? lastDot : value.length });
    const done = createSingleCallFunction((success, finishEditing) => {
      label.element.style.display = "none";
      const value2 = inputBox.value;
      dispose(toDispose);
      label.element.remove();
      if (finishEditing) {
        editableData.onFinish(value2, success);
      }
    });
    const showInputBoxNotification = () => {
      if (inputBox.isInputValid()) {
        const message = editableData.validationMessage(inputBox.value);
        if (message) {
          inputBox.showMessage({
            content: message.content,
            formatContent: true,
            type: message.severity === Severity.Info ? MessageType.INFO : message.severity === Severity.Warning ? MessageType.WARNING : MessageType.ERROR
          });
        } else {
          inputBox.hideMessage();
        }
      }
    };
    showInputBoxNotification();
    const toDispose = [
      inputBox,
      inputBox.onDidChange((value2) => {
        label.setFile(joinPath(parent, value2 || " "), labelOptions);
      }),
      DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_DOWN, (e) => {
        if (e.equals(KeyCode.F2)) {
          const dotIndex = inputBox.value.lastIndexOf(".");
          if (stat.isDirectory || dotIndex === -1) {
            return;
          }
          if (currentSelectionState === "prefix") {
            currentSelectionState = "all";
            inputBox.select({ start: 0, end: inputBox.value.length });
          } else if (currentSelectionState === "all") {
            currentSelectionState = "suffix";
            inputBox.select({ start: dotIndex + 1, end: inputBox.value.length });
          } else {
            currentSelectionState = "prefix";
            inputBox.select({ start: 0, end: dotIndex });
          }
        } else if (e.equals(KeyCode.Enter)) {
          if (!inputBox.validate()) {
            done(true, true);
          }
        } else if (e.equals(KeyCode.Escape)) {
          done(false, true);
        }
      }),
      DOM.addStandardDisposableListener(inputBox.inputElement, DOM.EventType.KEY_UP, (e) => {
        showInputBoxNotification();
      }),
      DOM.addDisposableListener(inputBox.inputElement, DOM.EventType.BLUR, async () => {
        while (true) {
          await timeout(0);
          const ownerDocument = inputBox.inputElement.ownerDocument;
          if (!ownerDocument.hasFocus()) {
            break;
          }
          if (DOM.isActiveElement(inputBox.inputElement)) {
            return;
          } else if (DOM.isHTMLElement(ownerDocument.activeElement) && DOM.hasParentWithClass(ownerDocument.activeElement, "context-view")) {
            await Event.toPromise(this.contextMenuService.onDidHideContextMenu);
          } else {
            break;
          }
        }
        done(inputBox.isInputValid(), true);
      }),
      label
    ];
    return toDisposable(() => {
      done(false, false);
    });
  }
  disposeElement(element, index, templateData) {
    templateData.currentContext = void 0;
    templateData.elementDisposables.clear();
  }
  disposeCompressedElements(node, index, templateData) {
    templateData.currentContext = void 0;
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
  getCompressedNavigationController(stat) {
    return this.compressedNavigationControllers.get(stat);
  }
  // IAccessibilityProvider
  getAriaLabel(element) {
    return element.name;
  }
  getAriaLevel(element) {
    let depth = 0;
    let parent = element.parent;
    while (parent) {
      parent = parent.parent;
      depth++;
    }
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      depth = depth + 1;
    }
    return depth;
  }
  getActiveDescendantId(stat) {
    return this.compressedNavigationControllers.get(stat)?.[0]?.currentId ?? void 0;
  }
  dispose() {
    this.configListener.dispose();
  }
};
FilesRenderer.ID = "file";
FilesRenderer = __decorateClass([
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IExplorerService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IContextMenuService),
  __decorateParam(11, IInstantiationService)
], FilesRenderer);
let FilesFilter = class {
  constructor(contextService, configurationService, explorerService, editorService, uriIdentityService, fileService) {
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.explorerService = explorerService;
    this.editorService = editorService;
    this.uriIdentityService = uriIdentityService;
    this.fileService = fileService;
    this.hiddenExpressionPerRoot = /* @__PURE__ */ new Map();
    this.editorsAffectingFilter = /* @__PURE__ */ new Set();
    this._onDidChange = new Emitter();
    this.toDispose = [];
    // List of ignoreFile resources. Used to detect changes to the ignoreFiles.
    this.ignoreFileResourcesPerRoot = /* @__PURE__ */ new Map();
    // Ignore tree per root. Similar to `hiddenExpressionPerRoot`
    // Note: URI in the ternary search tree is the URI of the folder containing the ignore file
    // It is not the ignore file itself. This is because of the way the IgnoreFile works and nested paths
    this.ignoreTreesPerRoot = /* @__PURE__ */ new Map();
    this.toDispose.push(this.contextService.onDidChangeWorkspaceFolders(() => this.updateConfiguration()));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("files.exclude") || e.affectsConfiguration("explorer.excludeGitIgnore")) {
        this.updateConfiguration();
      }
    }));
    this.toDispose.push(this.fileService.onDidFilesChange((e) => {
      for (const [root, ignoreFileResourceSet] of this.ignoreFileResourcesPerRoot.entries()) {
        ignoreFileResourceSet.forEach(async (ignoreResource) => {
          if (e.contains(ignoreResource, FileChangeType.UPDATED)) {
            await this.processIgnoreFile(root, ignoreResource, true);
          }
          if (e.contains(ignoreResource, FileChangeType.DELETED)) {
            this.ignoreTreesPerRoot.get(root)?.delete(dirname(ignoreResource));
            ignoreFileResourceSet.delete(ignoreResource);
            this._onDidChange.fire();
          }
        });
      }
    }));
    this.toDispose.push(this.editorService.onDidVisibleEditorsChange(() => {
      const editors = this.editorService.visibleEditors;
      let shouldFire = false;
      for (const e of editors) {
        if (!e.resource) {
          continue;
        }
        const stat = this.explorerService.findClosest(e.resource);
        if (stat && stat.isExcluded) {
          shouldFire = true;
          break;
        }
      }
      for (const e of this.editorsAffectingFilter) {
        if (!editors.includes(e)) {
          shouldFire = true;
          break;
        }
      }
      if (shouldFire) {
        this.editorsAffectingFilter.clear();
        this._onDidChange.fire();
      }
    }));
    this.updateConfiguration();
  }
  get onDidChange() {
    return this._onDidChange.event;
  }
  updateConfiguration() {
    let shouldFire = false;
    let updatedGitIgnoreSetting = false;
    this.contextService.getWorkspace().folders.forEach((folder) => {
      const configuration = this.configurationService.getValue({ resource: folder.uri });
      const excludesConfig = configuration?.files?.exclude || /* @__PURE__ */ Object.create(null);
      const parseIgnoreFile = configuration.explorer.excludeGitIgnore;
      if (parseIgnoreFile && !this.ignoreTreesPerRoot.has(folder.uri.toString())) {
        updatedGitIgnoreSetting = true;
        this.ignoreFileResourcesPerRoot.set(folder.uri.toString(), new ResourceSet());
        this.ignoreTreesPerRoot.set(folder.uri.toString(), TernarySearchTree.forUris((uri) => this.uriIdentityService.extUri.ignorePathCasing(uri)));
      }
      if (!parseIgnoreFile && this.ignoreTreesPerRoot.has(folder.uri.toString())) {
        updatedGitIgnoreSetting = true;
        this.ignoreFileResourcesPerRoot.delete(folder.uri.toString());
        this.ignoreTreesPerRoot.delete(folder.uri.toString());
      }
      if (!shouldFire) {
        const cached = this.hiddenExpressionPerRoot.get(folder.uri.toString());
        shouldFire = !cached || !equals(cached.original, excludesConfig);
      }
      const excludesConfigCopy = deepClone(excludesConfig);
      this.hiddenExpressionPerRoot.set(folder.uri.toString(), { original: excludesConfigCopy, parsed: glob.parse(excludesConfigCopy) });
    });
    if (shouldFire || updatedGitIgnoreSetting) {
      this.editorsAffectingFilter.clear();
      this._onDidChange.fire();
    }
  }
  /**
   * Given a .gitignore file resource, processes the resource and adds it to the ignore tree which hides explorer items
   * @param root The root folder of the workspace as a string. Used for lookup key for ignore tree and resource list
   * @param ignoreFileResource The resource of the .gitignore file
   * @param update Whether or not we're updating an existing ignore file. If true it deletes the old entry
   */
  async processIgnoreFile(root, ignoreFileResource, update) {
    const dirUri = dirname(ignoreFileResource);
    const ignoreTree = this.ignoreTreesPerRoot.get(root);
    if (!ignoreTree) {
      return;
    }
    if (!update && ignoreTree.has(dirUri)) {
      return;
    }
    const content = await this.fileService.readFile(ignoreFileResource);
    if (update) {
      const ignoreFile = ignoreTree.get(dirUri);
      ignoreFile?.updateContents(content.value.toString());
    } else {
      const ignoreParent = ignoreTree.findSubstr(dirUri);
      const ignoreFile = new IgnoreFile(content.value.toString(), dirUri.path, ignoreParent);
      ignoreTree.set(dirUri, ignoreFile);
      if (!this.ignoreFileResourcesPerRoot.get(root)?.has(ignoreFileResource)) {
        this.ignoreFileResourcesPerRoot.get(root)?.add(ignoreFileResource);
      }
    }
    this._onDidChange.fire();
  }
  filter(stat, parentVisibility) {
    if (stat.name === ".gitignore" && this.ignoreTreesPerRoot.has(stat.root.resource.toString())) {
      this.processIgnoreFile(stat.root.resource.toString(), stat.resource, false);
      return true;
    }
    return this.isVisible(stat, parentVisibility);
  }
  isVisible(stat, parentVisibility) {
    stat.isExcluded = false;
    if (parentVisibility === TreeVisibility.Hidden) {
      stat.isExcluded = true;
      return false;
    }
    if (this.explorerService.getEditableData(stat)) {
      return true;
    }
    const cached = this.hiddenExpressionPerRoot.get(stat.root.resource.toString());
    const globMatch = cached?.parsed(path.relative(stat.root.resource.path, stat.resource.path), stat.name, (name) => !!(stat.parent && stat.parent.getChild(name)));
    const isHiddenResource = !!globMatch ? true : this.isIgnored(stat.resource, stat.root.resource, stat.isDirectory);
    if (isHiddenResource || stat.parent?.isExcluded) {
      stat.isExcluded = true;
      const editors = this.editorService.visibleEditors;
      const editor = editors.find((e) => e.resource && this.uriIdentityService.extUri.isEqualOrParent(e.resource, stat.resource));
      if (editor && stat.root === this.explorerService.findClosestRoot(stat.resource)) {
        this.editorsAffectingFilter.add(editor);
        return true;
      }
      return false;
    }
    return true;
  }
  isIgnored(resource, rootResource, isDirectory) {
    const ignoreFile = this.ignoreTreesPerRoot.get(rootResource.toString())?.findSubstr(resource);
    const isIncludedInTraversal = ignoreFile?.isPathIncludedInTraversal(resource.path, isDirectory);
    return isIncludedInTraversal === void 0 ? false : !isIncludedInTraversal;
  }
  dispose() {
    dispose(this.toDispose);
  }
};
FilesFilter = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IExplorerService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IFileService)
], FilesFilter);
let FileSorter = class {
  constructor(explorerService, contextService) {
    this.explorerService = explorerService;
    this.contextService = contextService;
  }
  compare(statA, statB) {
    if (statA.isRoot) {
      if (statB.isRoot) {
        const workspaceA = this.contextService.getWorkspaceFolder(statA.resource);
        const workspaceB = this.contextService.getWorkspaceFolder(statB.resource);
        return workspaceA && workspaceB ? workspaceA.index - workspaceB.index : -1;
      }
      return -1;
    }
    if (statB.isRoot) {
      return 1;
    }
    const sortOrder = this.explorerService.sortOrderConfiguration.sortOrder;
    const lexicographicOptions = this.explorerService.sortOrderConfiguration.lexicographicOptions;
    const reverse = this.explorerService.sortOrderConfiguration.reverse;
    if (reverse) {
      [statA, statB] = [statB, statA];
    }
    let compareFileNames;
    let compareFileExtensions;
    switch (lexicographicOptions) {
      case "upper":
        compareFileNames = compareFileNamesUpper;
        compareFileExtensions = compareFileExtensionsUpper;
        break;
      case "lower":
        compareFileNames = compareFileNamesLower;
        compareFileExtensions = compareFileExtensionsLower;
        break;
      case "unicode":
        compareFileNames = compareFileNamesUnicode;
        compareFileExtensions = compareFileExtensionsUnicode;
        break;
      default:
        compareFileNames = compareFileNamesDefault;
        compareFileExtensions = compareFileExtensionsDefault;
    }
    switch (sortOrder) {
      case "type":
        if (statA.isDirectory && !statB.isDirectory) {
          return -1;
        }
        if (statB.isDirectory && !statA.isDirectory) {
          return 1;
        }
        if (statA.isDirectory && statB.isDirectory) {
          return compareFileNames(statA.name, statB.name);
        }
        break;
      case "filesFirst":
        if (statA.isDirectory && !statB.isDirectory) {
          return 1;
        }
        if (statB.isDirectory && !statA.isDirectory) {
          return -1;
        }
        break;
      case "foldersNestsFiles":
        if (statA.isDirectory && !statB.isDirectory) {
          return -1;
        }
        if (statB.isDirectory && !statA.isDirectory) {
          return 1;
        }
        if (statA.hasNests && !statB.hasNests) {
          return -1;
        }
        if (statB.hasNests && !statA.hasNests) {
          return 1;
        }
        break;
      case "mixed":
        break;
      // not sorting when "mixed" is on
      default:
        if (statA.isDirectory && !statB.isDirectory) {
          return -1;
        }
        if (statB.isDirectory && !statA.isDirectory) {
          return 1;
        }
        break;
    }
    switch (sortOrder) {
      case "type":
        return compareFileExtensions(statA.name, statB.name);
      case "modified":
        if (statA.mtime !== statB.mtime) {
          return statA.mtime && statB.mtime && statA.mtime < statB.mtime ? 1 : -1;
        }
        return compareFileNames(statA.name, statB.name);
      default:
        return compareFileNames(statA.name, statB.name);
    }
  }
};
FileSorter = __decorateClass([
  __decorateParam(0, IExplorerService),
  __decorateParam(1, IWorkspaceContextService)
], FileSorter);
let FileDragAndDrop = class {
  constructor(isCollapsed, explorerService, editorService, dialogService, contextService, fileService, configurationService, instantiationService, workspaceEditingService, uriIdentityService) {
    this.isCollapsed = isCollapsed;
    this.explorerService = explorerService;
    this.editorService = editorService;
    this.dialogService = dialogService;
    this.contextService = contextService;
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.workspaceEditingService = workspaceEditingService;
    this.uriIdentityService = uriIdentityService;
    this.compressedDropTargetDisposable = Disposable.None;
    this.disposables = new DisposableStore();
    this.dropEnabled = false;
    const updateDropEnablement = (e) => {
      if (!e || e.affectsConfiguration("explorer.enableDragAndDrop")) {
        this.dropEnabled = this.configurationService.getValue("explorer.enableDragAndDrop");
      }
    };
    updateDropEnablement(void 0);
    this.disposables.add(this.configurationService.onDidChangeConfiguration((e) => updateDropEnablement(e)));
  }
  onDragOver(data, target, targetIndex, targetSector, originalEvent) {
    if (!this.dropEnabled) {
      return false;
    }
    if (target) {
      const compressedTarget = FileDragAndDrop.getCompressedStatFromDragEvent(target, originalEvent);
      if (compressedTarget) {
        const iconLabelName = getIconLabelNameFromHTMLElement(originalEvent.target);
        if (iconLabelName && iconLabelName.index < iconLabelName.count - 1) {
          const result = this.handleDragOver(data, compressedTarget, targetIndex, targetSector, originalEvent);
          if (result) {
            if (iconLabelName.element !== this.compressedDragOverElement) {
              this.compressedDragOverElement = iconLabelName.element;
              this.compressedDropTargetDisposable.dispose();
              this.compressedDropTargetDisposable = toDisposable(() => {
                iconLabelName.element.classList.remove("drop-target");
                this.compressedDragOverElement = void 0;
              });
              iconLabelName.element.classList.add("drop-target");
            }
            return typeof result === "boolean" ? result : { ...result, feedback: [] };
          }
          this.compressedDropTargetDisposable.dispose();
          return false;
        }
      }
    }
    this.compressedDropTargetDisposable.dispose();
    return this.handleDragOver(data, target, targetIndex, targetSector, originalEvent);
  }
  handleDragOver(data, target, targetIndex, targetSector, originalEvent) {
    const isCopy = originalEvent && (originalEvent.ctrlKey && !isMacintosh || originalEvent.altKey && isMacintosh);
    const isNative = data instanceof NativeDragAndDropData;
    const effectType = isNative || isCopy ? ListDragOverEffectType.Copy : ListDragOverEffectType.Move;
    const effect = { type: effectType, position: ListDragOverEffectPosition.Over };
    if (isNative) {
      if (!containsDragType(originalEvent, DataTransfers.FILES, CodeDataTransfers.FILES, DataTransfers.RESOURCES)) {
        return false;
      }
    } else if (data instanceof ExternalElementsDragAndDropData) {
      return false;
    } else {
      const items = FileDragAndDrop.getStatsFromDragAndDropData(data);
      const isRootsReorder = items.every((item) => item.isRoot);
      if (!target) {
        if (!isCopy && items.every((i) => !!i.parent && i.parent.isRoot)) {
          return false;
        }
        if (isRootsReorder) {
          return { accept: true, effect: { type: ListDragOverEffectType.Move, position: ListDragOverEffectPosition.After } };
        }
        return { accept: true, bubble: TreeDragOverBubble.Down, effect, autoExpand: false };
      }
      if (!Array.isArray(items)) {
        return false;
      }
      if (!isCopy && items.every((source) => source.isReadonly)) {
        return false;
      }
      if (items.some((source) => {
        if (source.isRoot) {
          return false;
        }
        if (this.uriIdentityService.extUri.isEqual(source.resource, target.resource)) {
          return true;
        }
        if (!isCopy && this.uriIdentityService.extUri.isEqual(dirname(source.resource), target.resource)) {
          return true;
        }
        if (this.uriIdentityService.extUri.isEqualOrParent(target.resource, source.resource)) {
          return true;
        }
        return false;
      })) {
        return false;
      }
      if (isRootsReorder) {
        if (!target.isRoot) {
          return false;
        }
        let dropEffectPosition = void 0;
        switch (targetSector) {
          case ListViewTargetSector.TOP:
          case ListViewTargetSector.CENTER_TOP:
            dropEffectPosition = ListDragOverEffectPosition.Before;
            break;
          case ListViewTargetSector.CENTER_BOTTOM:
          case ListViewTargetSector.BOTTOM:
            dropEffectPosition = ListDragOverEffectPosition.After;
            break;
        }
        return { accept: true, effect: { type: ListDragOverEffectType.Move, position: dropEffectPosition } };
      }
    }
    if (!target) {
      return { accept: true, bubble: TreeDragOverBubble.Down, effect };
    } else {
      if (target.isDirectory) {
        if (target.isReadonly) {
          return false;
        }
        return { accept: true, bubble: TreeDragOverBubble.Down, effect, autoExpand: true };
      }
      if (this.contextService.getWorkspace().folders.every((folder) => folder.uri.toString() !== target.resource.toString())) {
        return { accept: true, bubble: TreeDragOverBubble.Up, effect };
      }
    }
    return false;
  }
  getDragURI(element) {
    if (this.explorerService.isEditable(element)) {
      return null;
    }
    return element.resource.toString();
  }
  getDragLabel(elements, originalEvent) {
    if (elements.length === 1) {
      const stat = FileDragAndDrop.getCompressedStatFromDragEvent(elements[0], originalEvent);
      return stat.name;
    }
    return String(elements.length);
  }
  onDragStart(data, originalEvent) {
    const items = FileDragAndDrop.getStatsFromDragAndDropData(data, originalEvent);
    if (items && items.length && originalEvent.dataTransfer) {
      this.instantiationService.invokeFunction((accessor) => fillEditorsDragData(accessor, items, originalEvent));
      const fileResources = items.filter((s) => s.resource.scheme === Schemas.file).map((r) => r.resource.fsPath);
      if (fileResources.length) {
        originalEvent.dataTransfer.setData(CodeDataTransfers.FILES, JSON.stringify(fileResources));
      }
    }
  }
  async drop(data, target, targetIndex, targetSector, originalEvent) {
    this.compressedDropTargetDisposable.dispose();
    if (target) {
      const compressedTarget = FileDragAndDrop.getCompressedStatFromDragEvent(target, originalEvent);
      if (compressedTarget) {
        target = compressedTarget;
      }
    }
    if (!target) {
      target = this.explorerService.roots[this.explorerService.roots.length - 1];
      targetSector = ListViewTargetSector.BOTTOM;
    }
    if (!target.isDirectory && target.parent) {
      target = target.parent;
    }
    if (target.isReadonly) {
      return;
    }
    const resolvedTarget = target;
    if (!resolvedTarget) {
      return;
    }
    try {
      if (data instanceof NativeDragAndDropData) {
        if (!isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) && WebFileSystemAccess.supported(mainWindow)) {
          const fileImport = this.instantiationService.createInstance(ExternalFileImport);
          await fileImport.import(resolvedTarget, originalEvent, mainWindow);
        } else {
          const browserUpload = this.instantiationService.createInstance(BrowserFileUpload);
          await browserUpload.upload(target, originalEvent);
        }
      } else {
        await this.handleExplorerDrop(data, resolvedTarget, targetIndex, targetSector, originalEvent);
      }
    } catch (error) {
      this.dialogService.error(toErrorMessage(error));
    }
  }
  async handleExplorerDrop(data, target, targetIndex, targetSector, originalEvent) {
    const elementsData = FileDragAndDrop.getStatsFromDragAndDropData(data);
    const distinctItems = new Map(elementsData.map((element) => [element, this.isCollapsed(element)]));
    for (const [item, collapsed] of distinctItems) {
      if (collapsed) {
        const nestedChildren = item.nestedChildren;
        if (nestedChildren) {
          for (const child of nestedChildren) {
            distinctItems.set(child, true);
          }
        }
      }
    }
    const items = distinctParents([...distinctItems.keys()], (s) => s.resource);
    const isCopy = originalEvent.ctrlKey && !isMacintosh || originalEvent.altKey && isMacintosh;
    const confirmDragAndDrop = !isCopy && this.configurationService.getValue(FileDragAndDrop.CONFIRM_DND_SETTING_KEY);
    if (confirmDragAndDrop) {
      const message = items.length > 1 && items.every((s) => s.isRoot) ? localize("confirmRootsMove", "Are you sure you want to change the order of multiple root folders in your workspace?") : items.length > 1 ? localize("confirmMultiMove", "Are you sure you want to move the following {0} files into '{1}'?", items.length, target.name) : items[0].isRoot ? localize("confirmRootMove", "Are you sure you want to change the order of root folder '{0}' in your workspace?", items[0].name) : localize("confirmMove", "Are you sure you want to move '{0}' into '{1}'?", items[0].name, target.name);
      const detail = items.length > 1 && !items.every((s) => s.isRoot) ? getFileNamesMessage(items.map((i) => i.resource)) : void 0;
      const confirmation = await this.dialogService.confirm({
        message,
        detail,
        checkbox: {
          label: localize("doNotAskAgain", "Do not ask me again")
        },
        primaryButton: localize({ key: "moveButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Move")
      });
      if (!confirmation.confirmed) {
        return;
      }
      if (confirmation.checkboxChecked === true) {
        await this.configurationService.updateValue(FileDragAndDrop.CONFIRM_DND_SETTING_KEY, false);
      }
    }
    await this.doHandleRootDrop(items.filter((s) => s.isRoot), target, targetSector);
    const sources = items.filter((s) => !s.isRoot);
    if (isCopy) {
      return this.doHandleExplorerDropOnCopy(sources, target);
    }
    return this.doHandleExplorerDropOnMove(sources, target);
  }
  async doHandleRootDrop(roots, target, targetSector) {
    if (roots.length === 0) {
      return;
    }
    const folders = this.contextService.getWorkspace().folders;
    let targetIndex;
    const sourceIndices = [];
    const workspaceCreationData = [];
    const rootsToMove = [];
    for (let index = 0; index < folders.length; index++) {
      const data = {
        uri: folders[index].uri,
        name: folders[index].name
      };
      if (target instanceof ExplorerItem && this.uriIdentityService.extUri.isEqual(folders[index].uri, target.resource)) {
        targetIndex = index;
      }
      for (const root of roots) {
        if (this.uriIdentityService.extUri.isEqual(folders[index].uri, root.resource)) {
          sourceIndices.push(index);
          break;
        }
      }
      if (roots.every((r) => r.resource.toString() !== folders[index].uri.toString())) {
        workspaceCreationData.push(data);
      } else {
        rootsToMove.push(data);
      }
    }
    if (targetIndex === void 0) {
      targetIndex = workspaceCreationData.length;
    } else {
      switch (targetSector) {
        case ListViewTargetSector.BOTTOM:
        case ListViewTargetSector.CENTER_BOTTOM:
          targetIndex++;
          break;
      }
      for (const sourceIndex of sourceIndices) {
        if (sourceIndex < targetIndex) {
          targetIndex--;
        }
      }
    }
    workspaceCreationData.splice(targetIndex, 0, ...rootsToMove);
    return this.workspaceEditingService.updateFolders(0, workspaceCreationData.length, workspaceCreationData);
  }
  async doHandleExplorerDropOnCopy(sources, target) {
    const explorerConfig = this.configurationService.getValue().explorer;
    const resourceFileEdits = [];
    for (const { resource, isDirectory } of sources) {
      const allowOverwrite = explorerConfig.incrementalNaming === "disabled";
      const newResource = await findValidPasteFileTarget(
        this.explorerService,
        this.fileService,
        this.dialogService,
        target,
        { resource, isDirectory, allowOverwrite },
        explorerConfig.incrementalNaming
      );
      if (!newResource) {
        continue;
      }
      const resourceEdit = new ResourceFileEdit(resource, newResource, { copy: true, overwrite: allowOverwrite });
      resourceFileEdits.push(resourceEdit);
    }
    const labelSuffix = getFileOrFolderLabelSuffix(sources);
    await this.explorerService.applyBulkEdit(resourceFileEdits, {
      confirmBeforeUndo: explorerConfig.confirmUndo === UndoConfirmLevel.Default || explorerConfig.confirmUndo === UndoConfirmLevel.Verbose,
      undoLabel: localize("copy", "Copy {0}", labelSuffix),
      progressLabel: localize("copying", "Copying {0}", labelSuffix)
    });
    const editors = resourceFileEdits.filter((edit) => {
      const item = edit.newResource ? this.explorerService.findClosest(edit.newResource) : void 0;
      return item && !item.isDirectory;
    }).map((edit) => ({ resource: edit.newResource, options: { pinned: true } }));
    await this.editorService.openEditors(editors);
  }
  async doHandleExplorerDropOnMove(sources, target) {
    const resourceFileEdits = sources.filter((source) => !source.isReadonly).map((source) => new ResourceFileEdit(source.resource, joinPath(target.resource, source.name)));
    const labelSuffix = getFileOrFolderLabelSuffix(sources);
    const options = {
      confirmBeforeUndo: this.configurationService.getValue().explorer.confirmUndo === UndoConfirmLevel.Verbose,
      undoLabel: localize("move", "Move {0}", labelSuffix),
      progressLabel: localize("moving", "Moving {0}", labelSuffix)
    };
    try {
      await this.explorerService.applyBulkEdit(resourceFileEdits, options);
    } catch (error) {
      if (error.fileOperationResult === FileOperationResult.FILE_MOVE_CONFLICT) {
        const overwrites = [];
        for (const edit of resourceFileEdits) {
          if (edit.newResource && await this.fileService.exists(edit.newResource)) {
            overwrites.push(edit.newResource);
          }
        }
        const confirm = getMultipleFilesOverwriteConfirm(overwrites);
        const { confirmed } = await this.dialogService.confirm(confirm);
        if (confirmed) {
          await this.explorerService.applyBulkEdit(resourceFileEdits.map((re) => new ResourceFileEdit(re.oldResource, re.newResource, { overwrite: true })), options);
        }
      } else {
        throw error;
      }
    }
  }
  static getStatsFromDragAndDropData(data, dragStartEvent) {
    if (data.context) {
      return data.context;
    }
    if (dragStartEvent && data.elements.length === 1) {
      data.context = [FileDragAndDrop.getCompressedStatFromDragEvent(data.elements[0], dragStartEvent)];
      return data.context;
    }
    return data.elements;
  }
  static getCompressedStatFromDragEvent(stat, dragEvent) {
    const target = DOM.getWindow(dragEvent).document.elementFromPoint(dragEvent.clientX, dragEvent.clientY);
    const iconLabelName = getIconLabelNameFromHTMLElement(target);
    if (iconLabelName) {
      const { count, index } = iconLabelName;
      let i = count - 1;
      while (i > index && stat.parent) {
        stat = stat.parent;
        i--;
      }
      return stat;
    }
    return stat;
  }
  onDragEnd() {
    this.compressedDropTargetDisposable.dispose();
  }
  dispose() {
    this.compressedDropTargetDisposable.dispose();
  }
};
FileDragAndDrop.CONFIRM_DND_SETTING_KEY = "explorer.confirmDragAndDrop";
FileDragAndDrop = __decorateClass([
  __decorateParam(1, IExplorerService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IDialogService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IWorkspaceEditingService),
  __decorateParam(9, IUriIdentityService)
], FileDragAndDrop);
function getIconLabelNameFromHTMLElement(target) {
  if (!DOM.isHTMLElement(target)) {
    return null;
  }
  let element = target;
  while (element && !element.classList.contains("monaco-list-row")) {
    if (element.classList.contains("label-name") && element.hasAttribute("data-icon-label-count")) {
      const count = Number(element.getAttribute("data-icon-label-count"));
      const index = Number(element.getAttribute("data-icon-label-index"));
      if (isNumber(count) && isNumber(index)) {
        return { element, count, index };
      }
    }
    element = element.parentElement;
  }
  return null;
}
function isCompressedFolderName(target) {
  return !!getIconLabelNameFromHTMLElement(target);
}
class ExplorerCompressionDelegate {
  isIncompressible(stat) {
    return stat.isRoot || !stat.isDirectory || stat instanceof NewExplorerItem || (!stat.parent || stat.parent.isRoot);
  }
}
function getFileOrFolderLabelSuffix(items) {
  if (items.length === 1) {
    return items[0].name;
  }
  if (items.every((i) => i.isDirectory)) {
    return localize("numberOfFolders", "{0} folders", items.length);
  }
  if (items.every((i) => !i.isDirectory)) {
    return localize("numberOfFiles", "{0} files", items.length);
  }
  return `${items.length} files and folders`;
}
export {
  CompressedNavigationController,
  ExplorerCompressionDelegate,
  ExplorerDataSource,
  ExplorerDelegate,
  ExplorerFindProvider,
  FileDragAndDrop,
  FileSorter,
  FilesFilter,
  FilesRenderer,
  PhantomExplorerItem,
  explorerRootErrorEmitter,
  isCompressedFolderName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL3ZpZXdzL2V4cGxvcmVyVmlld2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgTGlzdERyYWdPdmVyRWZmZWN0UG9zaXRpb24sIExpc3REcmFnT3ZlckVmZmVjdFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24sIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRmlsZUtpbmQsIEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvblJlc3VsdCwgRmlsZUNoYW5nZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzVGVtcG9yYXJ5V29ya3NwYWNlLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGUsIGRpc3Bvc2UsIHRvRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJRmlsZUxhYmVsT3B0aW9ucywgSVJlc291cmNlTGFiZWwsIFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9sYWJlbHMuanMnO1xuaW1wb3J0IHsgSVRyZWVOb2RlLCBJVHJlZUZpbHRlciwgVHJlZVZpc2liaWxpdHksIElBc3luY0RhdGFTb3VyY2UsIElUcmVlU29ydGVyLCBJVHJlZURyYWdBbmREcm9wLCBJVHJlZURyYWdPdmVyUmVhY3Rpb24sIFRyZWVEcmFnT3ZlckJ1YmJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHBsb3JlckZpbmRQcm92aWRlckFjdGl2ZSwgSUZpbGVzQ29uZmlndXJhdGlvbiwgVW5kb0NvbmZpcm1MZXZlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luUGF0aCwgZGlzdGluY3RQYXJlbnRzLCByZWxhdGl2ZVBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSW5wdXRCb3gsIE1lc3NhZ2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Z1bmN0aW9uYWwuanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBlcXVhbHMsIGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IEV4cGxvcmVySXRlbSwgTmV3RXhwbG9yZXJJdGVtIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4cGxvcmVyTW9kZWwuanMnO1xuaW1wb3J0IHsgY29tcGFyZUZpbGVFeHRlbnNpb25zRGVmYXVsdCwgY29tcGFyZUZpbGVOYW1lc0RlZmF1bHQsIGNvbXBhcmVGaWxlTmFtZXNVcHBlciwgY29tcGFyZUZpbGVFeHRlbnNpb25zVXBwZXIsIGNvbXBhcmVGaWxlTmFtZXNMb3dlciwgY29tcGFyZUZpbGVFeHRlbnNpb25zTG93ZXIsIGNvbXBhcmVGaWxlTmFtZXNVbmljb2RlLCBjb21wYXJlRmlsZUV4dGVuc2lvbnNVbmljb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29tcGFyZXJzLmpzJztcbmltcG9ydCB7IENvZGVEYXRhVHJhbnNmZXJzLCBjb250YWluc0RyYWdUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZG5kL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IGZpbGxFZGl0b3JzRHJhZ0RhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElEcmFnQW5kRHJvcERhdGEsIERhdGFUcmFuc2ZlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IE5hdGl2ZURyYWdBbmREcm9wRGF0YSwgRXh0ZXJuYWxFbGVtZW50c0RyYWdBbmREcm9wRGF0YSwgRWxlbWVudHNEcmFnQW5kRHJvcERhdGEsIExpc3RWaWV3VGFyZ2V0U2VjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFZpZXcuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2ViIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UsIGdldEZpbGVOYW1lc01lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZUVkaXRpbmcuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VzLmpzJztcbmltcG9ydCB7IGZpbmRWYWxpZFBhc3RlRmlsZVRhcmdldCB9IGZyb20gJy4uL2ZpbGVBY3Rpb25zLmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUsIGNyZWF0ZU1hdGNoZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBFdmVudE11bHRpcGxleGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVRyZWVWaWV3U3RhdGUsIElBc3luY0ZpbmRQcm92aWRlciwgSUFzeW5jRmluZFJlc3VsdCwgSUFzeW5jRmluZFRvZ2dsZXMsIElUcmVlQ29tcHJlc3Npb25EZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2FzeW5jRGF0YVRyZWUuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUNvbXByZXNzZWRUcmVlTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2NvbXByZXNzZWRPYmplY3RUcmVlTW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBpc051bWJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElFZGl0YWJsZURhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VGaWxlRWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vZmlsZXMuanMnO1xuaW1wb3J0IHsgQnJvd3NlckZpbGVVcGxvYWQsIEV4dGVybmFsRmlsZUltcG9ydCwgZ2V0TXVsdGlwbGVGaWxlc092ZXJ3cml0ZUNvbmZpcm0gfSBmcm9tICcuLi9maWxlSW1wb3J0RXhwb3J0LmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IFdlYkZpbGVTeXN0ZW1BY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9icm93c2VyL3dlYkZpbGVTeXN0ZW1BY2Nlc3MuanMnO1xuaW1wb3J0IHsgSWdub3JlRmlsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vaWdub3JlRmlsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVNldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBUZXJuYXJ5U2VhcmNoVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Rlcm5hcnlTZWFyY2hUcmVlLmpzJztcbmltcG9ydCB7IGRlZmF1bHRDb3VudEJhZGdlU3R5bGVzLCBkZWZhdWx0SW5wdXRCb3hTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElFeHBsb3JlckZpbGVDb250cmlidXRpb24sIGV4cGxvcmVyRmlsZUNvbnRyaWJSZWdpc3RyeSB9IGZyb20gJy4uL2V4cGxvcmVyRmlsZUNvbnRyaWIuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoU2VydmljZSwgUXVlcnlUeXBlLCBnZXRFeGNsdWRlcywgSVNlYXJjaENvbmZpZ3VyYXRpb24sIElTZWFyY2hDb21wbGV0ZSwgSUZpbGVRdWVyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IFRyZWVGaW5kTWF0Y2hUeXBlLCBUcmVlRmluZE1vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb3VudEJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBsaXN0RmlsdGVyTWF0Y2hIaWdobGlnaHQsIGxpc3RGaWx0ZXJNYXRjaEhpZ2hsaWdodEJvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JVdGlscy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFeHBsb3JlckRlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8RXhwbG9yZXJJdGVtPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElURU1fSEVJR0hUID0gMjI7XG5cblx0Z2V0SGVpZ2h0KGVsZW1lbnQ6IEV4cGxvcmVySXRlbSk6IG51bWJlciB7XG5cdFx0cmV0dXJuIEV4cGxvcmVyRGVsZWdhdGUuSVRFTV9IRUlHSFQ7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IEV4cGxvcmVySXRlbSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEZpbGVzUmVuZGVyZXIuSUQ7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGV4cGxvcmVyUm9vdEVycm9yRW1pdHRlciA9IG5ldyBFbWl0dGVyPFVSST4oKTtcbmV4cG9ydCBjbGFzcyBFeHBsb3JlckRhdGFTb3VyY2UgaW1wbGVtZW50cyBJQXN5bmNEYXRhU291cmNlPEV4cGxvcmVySXRlbSB8IEV4cGxvcmVySXRlbVtdLCBFeHBsb3Jlckl0ZW0+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGVGaWx0ZXI6IEZpbGVzRmlsdGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmluZFByb3ZpZGVyOiBFeHBsb3JlckZpbmRQcm92aWRlcixcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlnU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRXhwbG9yZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXhwbG9yZXJTZXJ2aWNlOiBJRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXRQYXJlbnQoZWxlbWVudDogRXhwbG9yZXJJdGVtKTogRXhwbG9yZXJJdGVtIHtcblx0XHRpZiAoZWxlbWVudC5wYXJlbnQpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LnBhcmVudDtcblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ2dldFBhcmVudCBvbmx5IHN1cHBvcnRlZCBmb3IgY2FjaGVkIHBhcmVudHMnKTtcblx0fVxuXG5cdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEV4cGxvcmVySXRlbSB8IEV4cGxvcmVySXRlbVtdKTogYm9vbGVhbiB7XG5cdFx0Ly8gZG9uJ3QgcmVuZGVyIG5lc3QgcGFyZW50cyBhcyBjb250YWluaW5nIGNoaWxkcmVuIHdoZW4gYWxsIHRoZSBjaGlsZHJlbiBhcmUgZmlsdGVyZWQgb3V0XG5cdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkoZWxlbWVudCkgfHwgZWxlbWVudC5oYXNDaGlsZHJlbigoc3RhdCkgPT4gdGhpcy5maWxlRmlsdGVyLmZpbHRlcihzdGF0LCBUcmVlVmlzaWJpbGl0eS5WaXNpYmxlKSk7XG5cdH1cblxuXHRnZXRDaGlsZHJlbihlbGVtZW50OiBFeHBsb3Jlckl0ZW0gfCBFeHBsb3Jlckl0ZW1bXSk6IEV4cGxvcmVySXRlbVtdIHwgUHJvbWlzZTxFeHBsb3Jlckl0ZW1bXT4ge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5maW5kUHJvdmlkZXIuaXNTaG93aW5nRmlsdGVyUmVzdWx0cygpKSB7XG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbShlbGVtZW50LmNoaWxkcmVuLnZhbHVlcygpKTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNFcnJvciA9IGVsZW1lbnQuZXJyb3I7XG5cdFx0Y29uc3Qgc29ydE9yZGVyID0gdGhpcy5leHBsb3JlclNlcnZpY2Uuc29ydE9yZGVyQ29uZmlndXJhdGlvbi5zb3J0T3JkZXI7XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSBlbGVtZW50LmZldGNoQ2hpbGRyZW4oc29ydE9yZGVyKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShjaGlsZHJlbikpIHtcblx0XHRcdC8vIGZhc3QgcGF0aCB3aGVuIGNoaWxkcmVuIGFyZSBrbm93biBzeW5jIChpLmUuIG5lc3RlZCBjaGlsZHJlbilcblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9XG5cdFx0Y29uc3QgcHJvbWlzZSA9IGNoaWxkcmVuLnRoZW4oXG5cdFx0XHRjaGlsZHJlbiA9PiB7XG5cdFx0XHRcdC8vIENsZWFyIHByZXZpb3VzIGVycm9yIGRlY29yYXRpb24gb24gcm9vdCBmb2xkZXJcblx0XHRcdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBFeHBsb3Jlckl0ZW0gJiYgZWxlbWVudC5pc1Jvb3QgJiYgIWVsZW1lbnQuZXJyb3IgJiYgaGFzRXJyb3IgJiYgdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIpIHtcblx0XHRcdFx0XHRleHBsb3JlclJvb3RFcnJvckVtaXR0ZXIuZmlyZShlbGVtZW50LnJlc291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY2hpbGRyZW47XG5cdFx0XHR9XG5cdFx0XHQsIGUgPT4ge1xuXG5cdFx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgRXhwbG9yZXJJdGVtICYmIGVsZW1lbnQuaXNSb290KSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRk9MREVSKSB7XG5cdFx0XHRcdFx0XHQvLyBTaW5nbGUgZm9sZGVyIGNyZWF0ZSBhIGR1bW15IGV4cGxvcmVyIGl0ZW0gdG8gc2hvdyBlcnJvclxuXHRcdFx0XHRcdFx0Y29uc3QgcGxhY2Vob2xkZXIgPSBuZXcgRXhwbG9yZXJJdGVtKGVsZW1lbnQucmVzb3VyY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMuY29uZmlnU2VydmljZSwgdGhpcy5maWxlc0NvbmZpZ1NlcnZpY2UsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRwbGFjZWhvbGRlci5lcnJvciA9IGU7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW3BsYWNlaG9sZGVyXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZXhwbG9yZXJSb290RXJyb3JFbWl0dGVyLmZpcmUoZWxlbWVudC5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIERvIG5vdCBzaG93IGVycm9yIGZvciByb290cyBzaW5jZSB3ZSBhbHJlYWR5IHVzZSBhbiBleHBsb3JlciBkZWNvcmF0aW9uIHRvIG5vdGlmeSB1c2VyXG5cdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIFtdOyAvLyB3ZSBjb3VsZCBub3QgcmVzb2x2ZSBhbnkgY2hpbGRyZW4gYmVjYXVzZSBvZiBhbiBlcnJvclxuXHRcdFx0fSk7XG5cblx0XHR0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uRXhwbG9yZXIsXG5cdFx0XHRkZWxheTogdGhpcy5sYXlvdXRTZXJ2aWNlLmlzUmVzdG9yZWQoKSA/IDgwMCA6IDE1MDAgLy8gcmVkdWNlIHByb2dyZXNzIHZpc2liaWxpdHkgd2hlbiBzdGlsbCByZXN0b3Jpbmdcblx0XHR9LCBfcHJvZ3Jlc3MgPT4gcHJvbWlzZSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUGhhbnRvbUV4cGxvcmVySXRlbSBleHRlbmRzIEV4cGxvcmVySXRlbSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlc291cmNlOiBVUkksXG5cdFx0ZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRjb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0ZmlsZXNDb25maWdTZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRfcGFyZW50OiBFeHBsb3Jlckl0ZW0gfCB1bmRlZmluZWQsXG5cdFx0X2lzRGlyZWN0b3J5PzogYm9vbGVhbixcblx0KSB7XG5cdFx0c3VwZXIocmVzb3VyY2UsIGZpbGVTZXJ2aWNlLCBjb25maWdTZXJ2aWNlLCBmaWxlc0NvbmZpZ1NlcnZpY2UsIF9wYXJlbnQsIF9pc0RpcmVjdG9yeSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIEZpbmRIaWdobGlnaHRMYXllciB7XG5cdGNoaWxkTWF0Y2hlczogbnVtYmVyO1xuXHRpc01hdGNoOiBib29sZWFuO1xuXHRzdGF0czoge1xuXHRcdFtzdGF0TmFtZTogc3RyaW5nXTogRmluZEhpZ2hsaWdodExheWVyO1xuXHR9O1xufVxuXG5pbnRlcmZhY2UgSUV4cGxvcmVyRmluZEhpZ2hsaWdodFRyZWUge1xuXHRnZXQoaXRlbTogRXhwbG9yZXJJdGVtKTogbnVtYmVyO1xuXHRpc01hdGNoKGl0ZW06IEV4cGxvcmVySXRlbSk6IGJvb2xlYW47XG59XG5cbmNsYXNzIEV4cGxvcmVyRmluZEhpZ2hsaWdodFRyZWUgaW1wbGVtZW50cyBJRXhwbG9yZXJGaW5kSGlnaGxpZ2h0VHJlZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdHJlZSA9IG5ldyBNYXA8c3RyaW5nLCBGaW5kSGlnaGxpZ2h0TGF5ZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2hpZ2hsaWdodGVkSXRlbXMgPSBuZXcgTWFwPHN0cmluZywgRXhwbG9yZXJJdGVtPigpO1xuXHRnZXQgaGlnaGxpZ2h0ZWRJdGVtcygpOiBFeHBsb3Jlckl0ZW1bXSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5faGlnaGxpZ2h0ZWRJdGVtcy52YWx1ZXMoKSk7XG5cdH1cblxuXHRnZXQoaXRlbTogRXhwbG9yZXJJdGVtKTogbnVtYmVyIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmZpbmQoaXRlbSk7XG5cdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRjb25zdCB7IHRyZWVMYXllciwgcmVsUGF0aCB9ID0gcmVzdWx0O1xuXHRcdHRoaXMuX2hpZ2hsaWdodGVkSXRlbXMuc2V0KHJlbFBhdGgsIGl0ZW0pO1xuXG5cdFx0cmV0dXJuIHRyZWVMYXllci5jaGlsZE1hdGNoZXM7XG5cdH1cblxuXHRwcml2YXRlIGZpbmQoaXRlbTogRXhwbG9yZXJJdGVtKTogeyB0cmVlTGF5ZXI6IEZpbmRIaWdobGlnaHRMYXllcjsgcmVsUGF0aDogc3RyaW5nIH0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJvb3RMYXllciA9IHRoaXMuX3RyZWUuZ2V0KGl0ZW0ucm9vdC5uYW1lKTtcblx0XHRpZiAocm9vdExheWVyID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVsUGF0aCA9IHJlbGF0aXZlUGF0aChpdGVtLnJvb3QucmVzb3VyY2UsIGl0ZW0ucmVzb3VyY2UpO1xuXHRcdGlmIChyZWxQYXRoID09PSB1bmRlZmluZWQgfHwgcmVsUGF0aC5zdGFydHNXaXRoKCcuLicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Jlc291cmNlIGlzIG5vdCBhIGNoaWxkIG9mIHRoZSByb290Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlbFBhdGggPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4geyB0cmVlTGF5ZXI6IHJvb3RMYXllciwgcmVsUGF0aCB9O1xuXHRcdH1cblxuXHRcdGxldCB0cmVlTGF5ZXIgPSByb290TGF5ZXI7XG5cdFx0Zm9yIChjb25zdCBzZWdtZW50IG9mIHJlbFBhdGguc3BsaXQoJy8nKSkge1xuXHRcdFx0aWYgKCF0cmVlTGF5ZXIuc3RhdHNbc2VnbWVudF0pIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0dHJlZUxheWVyID0gdHJlZUxheWVyLnN0YXRzW3NlZ21lbnRdO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHRyZWVMYXllciwgcmVsUGF0aCB9O1xuXHR9XG5cblx0YWRkKHJlc291cmNlOiBVUkksIHJvb3Q6IEV4cGxvcmVySXRlbSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbFBhdGggPSByZWxhdGl2ZVBhdGgocm9vdC5yZXNvdXJjZSwgcmVzb3VyY2UpO1xuXHRcdGlmIChyZWxQYXRoID09PSB1bmRlZmluZWQgfHwgcmVsUGF0aC5zdGFydHNXaXRoKCcuLicpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Jlc291cmNlIGlzIG5vdCBhIGNoaWxkIG9mIHRoZSByb290Jyk7XG5cdFx0fVxuXG5cdFx0bGV0IHJvb3RMYXllciA9IHRoaXMuX3RyZWUuZ2V0KHJvb3QubmFtZSk7XG5cdFx0aWYgKCFyb290TGF5ZXIpIHtcblx0XHRcdHJvb3RMYXllciA9IHsgY2hpbGRNYXRjaGVzOiAwLCBzdGF0czoge30sIGlzTWF0Y2g6IGZhbHNlIH07XG5cdFx0XHR0aGlzLl90cmVlLnNldChyb290Lm5hbWUsIHJvb3RMYXllcik7XG5cdFx0fVxuXHRcdHJvb3RMYXllci5jaGlsZE1hdGNoZXMrKztcblxuXHRcdGxldCB0cmVlTGF5ZXIgPSByb290TGF5ZXI7XG5cdFx0Zm9yIChjb25zdCBzdGF0IG9mIHJlbFBhdGguc3BsaXQoJy8nKSkge1xuXHRcdFx0aWYgKCF0cmVlTGF5ZXIuc3RhdHNbc3RhdF0pIHtcblx0XHRcdFx0dHJlZUxheWVyLnN0YXRzW3N0YXRdID0geyBjaGlsZE1hdGNoZXM6IDAsIHN0YXRzOiB7fSwgaXNNYXRjaDogZmFsc2UgfTtcblx0XHRcdH1cblxuXHRcdFx0dHJlZUxheWVyID0gdHJlZUxheWVyLnN0YXRzW3N0YXRdO1xuXHRcdFx0dHJlZUxheWVyLmNoaWxkTWF0Y2hlcysrO1xuXHRcdH1cblxuXHRcdHRyZWVMYXllci5jaGlsZE1hdGNoZXMtLTsgLy8gdGhlIGxhc3Qgc2VnbWVudCBpcyB0aGUgZmlsZSBpdHNlbGZcblx0XHR0cmVlTGF5ZXIuaXNNYXRjaCA9IHRydWU7XG5cdH1cblxuXHRpc01hdGNoKGl0ZW06IEV4cGxvcmVySXRlbSk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuZmluZChpdGVtKTtcblx0XHRpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB7IHRyZWVMYXllciB9ID0gcmVzdWx0O1xuXHRcdHJldHVybiB0cmVlTGF5ZXIuaXNNYXRjaDtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3RyZWUuY2xlYXIoKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHBsb3JlckZpbmRQcm92aWRlciBpbXBsZW1lbnRzIElBc3luY0ZpbmRQcm92aWRlcjxFeHBsb3Jlckl0ZW0+IHtcblxuXHRwcml2YXRlIHNlc3Npb25JZDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBmaWx0ZXJTZXNzaW9uU3RhcnRTdGF0ZTogeyB2aWV3U3RhdGU6IElBc3luY0RhdGFUcmVlVmlld1N0YXRlOyBpbnB1dDogRXhwbG9yZXJJdGVtW10gfCBFeHBsb3Jlckl0ZW07IHJvb3RzV2l0aFByb3ZpZGVyczogU2V0PEV4cGxvcmVySXRlbT4gfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBoaWdobGlnaHRTZXNzaW9uU3RhcnRTdGF0ZTogeyByb290c1dpdGhQcm92aWRlcnM6IFNldDxFeHBsb3Jlckl0ZW0+IH0gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZXhwbG9yZXJGaW5kQWN0aXZlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcGhhbnRvbVBhcmVudHMgPSBuZXcgU2V0PEV4cGxvcmVySXRlbT4oKTtcblx0cHJpdmF0ZSBmaW5kSGlnaGxpZ2h0VHJlZSA9IG5ldyBFeHBsb3JlckZpbmRIaWdobGlnaHRUcmVlKCk7XG5cdGdldCBoaWdobGlnaHRUcmVlKCk6IElFeHBsb3JlckZpbmRIaWdobGlnaHRUcmVlIHtcblx0XHRyZXR1cm4gdGhpcy5maW5kSGlnaGxpZ2h0VHJlZTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZXNGaWx0ZXI6IEZpbGVzRmlsdGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdHJlZVByb3ZpZGVyOiAoKSA9PiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPEV4cGxvcmVySXRlbSB8IEV4cGxvcmVySXRlbVtdLCBFeHBsb3Jlckl0ZW0sIEZ1enp5U2NvcmU+LFxuXHRcdEBJU2VhcmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNlYXJjaFNlcnZpY2U6IElTZWFyY2hTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlnU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHBsb3JlclNlcnZpY2U6IElFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuZXhwbG9yZXJGaW5kQWN0aXZlQ29udGV4dEtleSA9IEV4cGxvcmVyRmluZFByb3ZpZGVyQWN0aXZlLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRpc1Nob3dpbmdGaWx0ZXJSZXN1bHRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGU7XG5cdH1cblxuXHRpc1Zpc2libGUoZWxlbWVudDogRXhwbG9yZXJJdGVtKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmZpbHRlclNlc3Npb25TdGFydFN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHBsb3JlclNlcnZpY2UuaXNFZGl0YWJsZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGUucm9vdHNXaXRoUHJvdmlkZXJzLmhhcyhlbGVtZW50LnJvb3QpID8gZWxlbWVudC5pc01hcmtlZEFzRmlsdGVyZWQoKSA6IHRydWU7XG5cdH1cblxuXHRzdGFydFNlc3Npb24oKTogdm9pZCB7XG5cdFx0dGhpcy5zZXNzaW9uSWQrKztcblx0fVxuXG5cdGFzeW5jIGVuZFNlc3Npb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gUmVzdG9yZSB2aWV3IHN0YXRlXG5cdFx0aWYgKHRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGUpIHtcblx0XHRcdGF3YWl0IHRoaXMuZW5kRmlsdGVyU2Vzc2lvbigpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFNlc3Npb25TdGFydFN0YXRlKSB7XG5cdFx0XHR0aGlzLmVuZEhpZ2hsaWdodFNlc3Npb24oKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmaW5kKHBhdHRlcm46IHN0cmluZywgdG9nZ2xlczogSUFzeW5jRmluZFRvZ2dsZXMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFzeW5jRmluZFJlc3VsdDxFeHBsb3Jlckl0ZW0+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcHJvbWlzZSA9IHRoaXMuZG9GaW5kKHBhdHRlcm4sIHRvZ2dsZXMsIHRva2VuKTtcblxuXHRcdHJldHVybiBhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uRXhwbG9yZXIsXG5cdFx0XHRkZWxheTogNzUwLFxuXHRcdH0sIF9wcm9ncmVzcyA9PiBwcm9taXNlKTtcblx0fVxuXG5cdGFzeW5jIGRvRmluZChwYXR0ZXJuOiBzdHJpbmcsIHRvZ2dsZXM6IElBc3luY0ZpbmRUb2dnbGVzLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElBc3luY0ZpbmRSZXN1bHQ8RXhwbG9yZXJJdGVtPiB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0b2dnbGVzLmZpbmRNb2RlID09PSBUcmVlRmluZE1vZGUuSGlnaGxpZ2h0KSB7XG5cdFx0XHRpZiAodGhpcy5maWx0ZXJTZXNzaW9uU3RhcnRTdGF0ZSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmVuZEZpbHRlclNlc3Npb24oKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCF0aGlzLmhpZ2hsaWdodFNlc3Npb25TdGFydFN0YXRlKSB7XG5cdFx0XHRcdHRoaXMuc3RhcnRIaWdobGlnaHRTZXNzaW9uKCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRvSGlnaGxpZ2h0RmluZChwYXR0ZXJuLCB0b2dnbGVzLm1hdGNoVHlwZSwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmhpZ2hsaWdodFNlc3Npb25TdGFydFN0YXRlKSB7XG5cdFx0XHR0aGlzLmVuZEhpZ2hsaWdodFNlc3Npb24oKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGUpIHtcblx0XHRcdHRoaXMuc3RhcnRGaWx0ZXJTZXNzaW9uKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuZG9GaWx0ZXJGaW5kKHBhdHRlcm4sIHRvZ2dsZXMubWF0Y2hUeXBlLCB0b2tlbik7XG5cdH1cblxuXHQvLyBGaWx0ZXJcblxuXHRwcml2YXRlIHN0YXJ0RmlsdGVyU2Vzc2lvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0cmVlID0gdGhpcy50cmVlUHJvdmlkZXIoKTtcblx0XHRjb25zdCBpbnB1dCA9IHRyZWUuZ2V0SW5wdXQoKTtcblx0XHRpZiAoIWlucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vdHMgPSB0aGlzLmV4cGxvcmVyU2VydmljZS5yb290cy5maWx0ZXIocm9vdCA9PiB0aGlzLnNlYXJjaFN1cHBvcnRzU2NoZW1lKHJvb3QucmVzb3VyY2Uuc2NoZW1lKSk7XG5cdFx0dGhpcy5maWx0ZXJTZXNzaW9uU3RhcnRTdGF0ZSA9IHsgdmlld1N0YXRlOiB0cmVlLmdldFZpZXdTdGF0ZSgpLCBpbnB1dCwgcm9vdHNXaXRoUHJvdmlkZXJzOiBuZXcgU2V0KHJvb3RzKSB9O1xuXG5cdFx0dGhpcy5leHBsb3JlckZpbmRBY3RpdmVDb250ZXh0S2V5LnNldCh0cnVlKTtcblx0fVxuXG5cdGFzeW5jIGRvRmlsdGVyRmluZChwYXR0ZXJuOiBzdHJpbmcsIG1hdGNoVHlwZTogVHJlZUZpbmRNYXRjaFR5cGUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFzeW5jRmluZFJlc3VsdDxFeHBsb3Jlckl0ZW0+IHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLmZpbHRlclNlc3Npb25TdGFydFN0YXRlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4cGxvcmVyRmluZFByb3ZpZGVyOiBubyBzZXNzaW9uIHN0YXRlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vdHMgPSBBcnJheS5mcm9tKHRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGUucm9vdHNXaXRoUHJvdmlkZXJzKTtcblx0XHRjb25zdCBzZWFyY2hSZXN1bHRzID0gYXdhaXQgdGhpcy5nZXRTZWFyY2hSZXN1bHRzKHBhdHRlcm4sIHJvb3RzLCBtYXRjaFR5cGUsIHRva2VuKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLmNsZWFyUGhhbnRvbUVsZW1lbnRzKCk7XG5cdFx0Zm9yIChjb25zdCB7IGV4cGxvcmVyUm9vdCwgZmlsZXMsIGRpcmVjdG9yaWVzIH0gb2Ygc2VhcmNoUmVzdWx0cykge1xuXHRcdFx0dGhpcy5hZGRXb3Jrc3BhY2VGaWx0ZXJSZXN1bHRzKGV4cGxvcmVyUm9vdCwgZmlsZXMsIGRpcmVjdG9yaWVzKTtcblx0XHR9XG5cblx0XHRjb25zdCB0cmVlID0gdGhpcy50cmVlUHJvdmlkZXIoKTtcblx0XHRhd2FpdCB0cmVlLnNldElucHV0KHRoaXMuZmlsdGVyU2Vzc2lvblN0YXJ0U3RhdGUuaW5wdXQpO1xuXG5cdFx0Y29uc3QgaGl0TWF4UmVzdWx0cyA9IHNlYXJjaFJlc3VsdHMuc29tZSgoeyBoaXRNYXhSZXN1bHRzIH0pID0+IGhpdE1heFJlc3VsdHMpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc01hdGNoOiAoaXRlbTogRXhwbG9yZXJJdGVtKSA9PiBpdGVtLmlzTWFya2VkQXNGaWx0ZXJlZCgpLFxuXHRcdFx0bWF0Y2hDb3VudDogc2VhcmNoUmVzdWx0cy5yZWR1Y2UoKGFjYywgeyBmaWxlcywgZGlyZWN0b3JpZXMgfSkgPT4gYWNjICsgZmlsZXMubGVuZ3RoICsgZGlyZWN0b3JpZXMubGVuZ3RoLCAwKSxcblx0XHRcdHdhcm5pbmdNZXNzYWdlOiBoaXRNYXhSZXN1bHRzID8gbG9jYWxpemUoJ3NlYXJjaE1heFJlc3VsdHNXYXJuaW5nJywgXCJUaGUgcmVzdWx0IHNldCBvbmx5IGNvbnRhaW5zIGEgc3Vic2V0IG9mIGFsbCBtYXRjaGVzLiBCZSBtb3JlIHNwZWNpZmljIGluIHlvdXIgc2VhcmNoIHRvIG5hcnJvdyBkb3duIHRoZSByZXN1bHRzLlwiKSA6IHVuZGVmaW5lZFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFkZFdvcmtzcGFjZUZpbHRlclJlc3VsdHMocm9vdDogRXhwbG9yZXJJdGVtLCBmaWxlczogVVJJW10sIGRpcmVjdG9yaWVzOiBVUklbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBbXG5cdFx0XHQuLi5maWxlcy5tYXAoZmlsZSA9PiAoeyByZXNvdXJjZTogZmlsZSwgaXNEaXJlY3Rvcnk6IGZhbHNlIH0pKSxcblx0XHRcdC4uLmRpcmVjdG9yaWVzLm1hcChkaXJlY3RvcnkgPT4gKHsgcmVzb3VyY2U6IGRpcmVjdG9yeSwgaXNEaXJlY3Rvcnk6IHRydWUgfSkpXG5cdFx0XTtcblxuXHRcdGZvciAoY29uc3QgeyByZXNvdXJjZSwgaXNEaXJlY3RvcnkgfSBvZiByZXN1bHRzKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gcm9vdC5maW5kKHJlc291cmNlKTtcblx0XHRcdGlmIChlbGVtZW50ICYmIGVsZW1lbnQucm9vdCA9PT0gcm9vdCkge1xuXHRcdFx0XHQvLyBGaWxlIGlzIGFscmVhZHkgaW4gdGhlIG1vZGVsXG5cdFx0XHRcdGVsZW1lbnQubWFya0l0ZW1BbmRQYXJlbnRzQXNGaWx0ZXJlZCgpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlsZSBpcyBub3QgaW4gdGhlIG1vZGVsLCBjcmVhdGUgcGhhbnRvbSBpdGVtcyBmb3IgdGhlIGZpbGUgYW5kIGl0J3MgcGFyZW50c1xuXHRcdFx0Y29uc3QgcGhhbnRvbUVsZW1lbnRzID0gdGhpcy5jcmVhdGVQaGFudG9tSXRlbXMocmVzb3VyY2UsIHJvb3QsIGlzRGlyZWN0b3J5KTtcblx0XHRcdGlmIChwaGFudG9tRWxlbWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignUGhhbnRvbSBpdGVtIHdhcyBub3QgY3JlYXRlZCBldmVuIHRob3VnaCBpdCBpcyBub3QgaW4gdGhlIG1vZGVsJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFN0b3JlIHRoZSBmaXJzdCBhbmNlc3RvciBvZiB0aGUgZmlsZSB3aGljaCBpcyBhbHJlYWR5IHByZXNlbnQgaW4gdGhlIG1vZGVsXG5cdFx0XHRjb25zdCBmaXJzdFBoYW50b21QYXJlbnQgPSBwaGFudG9tRWxlbWVudHNbMF0ucGFyZW50ITtcblx0XHRcdGlmICghKGZpcnN0UGhhbnRvbVBhcmVudCBpbnN0YW5jZW9mIFBoYW50b21FeHBsb3Jlckl0ZW0pKSB7XG5cdFx0XHRcdHRoaXMucGhhbnRvbVBhcmVudHMuYWRkKGZpcnN0UGhhbnRvbVBhcmVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBoYW50b21GaWxlRWxlbWVudCA9IHBoYW50b21FbGVtZW50c1twaGFudG9tRWxlbWVudHMubGVuZ3RoIC0gMV07XG5cdFx0XHRwaGFudG9tRmlsZUVsZW1lbnQubWFya0l0ZW1BbmRQYXJlbnRzQXNGaWx0ZXJlZCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUGhhbnRvbUl0ZW1zKHJlc291cmNlOiBVUkksIHJvb3Q6IEV4cGxvcmVySXRlbSwgcmVzb3VyY2VJc0RpcmVjdG9yeTogYm9vbGVhbik6IFBoYW50b21FeHBsb3Jlckl0ZW1bXSB7XG5cdFx0Y29uc3QgcmVsYXRpdmVQYXRoVG9Sb290ID0gcmVsYXRpdmVQYXRoKHJvb3QucmVzb3VyY2UsIHJlc291cmNlKTtcblx0XHRpZiAoIXJlbGF0aXZlUGF0aFRvUm9vdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdSZXNvdXJjZSBpcyBub3QgYSBjaGlsZCBvZiB0aGUgcm9vdCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBoYW50b21FbGVtZW50czogUGhhbnRvbUV4cGxvcmVySXRlbVtdID0gW107XG5cblx0XHRsZXQgY3VycmVudEl0ZW0gPSByb290O1xuXHRcdGxldCBjdXJyZW50UmVzb3VyY2UgPSByb290LnJlc291cmNlO1xuXHRcdGNvbnN0IHBhdGhTZWdtZW50cyA9IHJlbGF0aXZlUGF0aFRvUm9vdC5zcGxpdCgnLycpO1xuXHRcdGZvciAoY29uc3Qgc3RhdCBvZiBwYXRoU2VnbWVudHMpIHtcblx0XHRcdGN1cnJlbnRSZXNvdXJjZSA9IGN1cnJlbnRSZXNvdXJjZS53aXRoKHsgcGF0aDogYCR7Y3VycmVudFJlc291cmNlLnBhdGh9LyR7c3RhdH1gIH0pO1xuXG5cdFx0XHRsZXQgY2hpbGQgPSBjdXJyZW50SXRlbS5nZXRDaGlsZChzdGF0KTtcblx0XHRcdGlmICghY2hpbGQpIHtcblx0XHRcdFx0Y29uc3QgaXNEaXJlY3RvcnkgPSBwYXRoU2VnbWVudHNbcGF0aFNlZ21lbnRzLmxlbmd0aCAtIDFdID09PSBzdGF0ID8gcmVzb3VyY2VJc0RpcmVjdG9yeSA6IHRydWU7XG5cdFx0XHRcdGNoaWxkID0gbmV3IFBoYW50b21FeHBsb3Jlckl0ZW0oY3VycmVudFJlc291cmNlLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLmZpbGVzQ29uZmlnU2VydmljZSwgY3VycmVudEl0ZW0sIGlzRGlyZWN0b3J5KTtcblx0XHRcdFx0Y3VycmVudEl0ZW0uYWRkQ2hpbGQoY2hpbGQpO1xuXHRcdFx0XHRwaGFudG9tRWxlbWVudHMucHVzaChjaGlsZCBhcyBQaGFudG9tRXhwbG9yZXJJdGVtKTtcblx0XHRcdH1cblxuXHRcdFx0Y3VycmVudEl0ZW0gPSBjaGlsZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGhhbnRvbUVsZW1lbnRzO1xuXHR9XG5cblx0YXN5bmMgZW5kRmlsdGVyU2Vzc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNsZWFyUGhhbnRvbUVsZW1lbnRzKCk7XG5cblx0XHR0aGlzLmV4cGxvcmVyRmluZEFjdGl2ZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblxuXHRcdC8vIFJlc3RvcmUgdmlldyBzdGF0ZVxuXHRcdGlmICghdGhpcy5maWx0ZXJTZXNzaW9uU3RhcnRTdGF0ZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdFeHBsb3JlckZpbmRQcm92aWRlcjogbm8gc2Vzc2lvbiBzdGF0ZSB0byByZXN0b3JlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdHJlZSA9IHRoaXMudHJlZVByb3ZpZGVyKCk7XG5cdFx0YXdhaXQgdHJlZS5zZXRJbnB1dCh0aGlzLmZpbHRlclNlc3Npb25TdGFydFN0YXRlLmlucHV0LCB0aGlzLmZpbHRlclNlc3Npb25TdGFydFN0YXRlLnZpZXdTdGF0ZSk7XG5cblx0XHR0aGlzLmZpbHRlclNlc3Npb25TdGFydFN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXhwbG9yZXJTZXJ2aWNlLnJlZnJlc2goKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJQaGFudG9tRWxlbWVudHMoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBwaGFudG9tUGFyZW50IG9mIHRoaXMucGhhbnRvbVBhcmVudHMpIHtcblx0XHRcdC8vIENsZWFyIHBoYW50b20gbm9kZXMgZnJvbSBtb2RlbFxuXHRcdFx0cGhhbnRvbVBhcmVudC5mb3JnZXRDaGlsZHJlbigpO1xuXHRcdH1cblx0XHR0aGlzLnBoYW50b21QYXJlbnRzLmNsZWFyKCk7XG5cdFx0dGhpcy5leHBsb3JlclNlcnZpY2Uucm9vdHMuZm9yRWFjaChyb290ID0+IHJvb3QudW5tYXJrSXRlbUFuZENoaWxkcmVuKCkpO1xuXHR9XG5cblx0Ly8gSGlnaGxpZ2h0XG5cblx0cHJpdmF0ZSBzdGFydEhpZ2hsaWdodFNlc3Npb24oKTogdm9pZCB7XG5cdFx0Y29uc3Qgcm9vdHMgPSB0aGlzLmV4cGxvcmVyU2VydmljZS5yb290cy5maWx0ZXIocm9vdCA9PiB0aGlzLnNlYXJjaFN1cHBvcnRzU2NoZW1lKHJvb3QucmVzb3VyY2Uuc2NoZW1lKSk7XG5cdFx0dGhpcy5oaWdobGlnaHRTZXNzaW9uU3RhcnRTdGF0ZSA9IHsgcm9vdHNXaXRoUHJvdmlkZXJzOiBuZXcgU2V0KHJvb3RzKSB9O1xuXHR9XG5cblx0YXN5bmMgZG9IaWdobGlnaHRGaW5kKHBhdHRlcm46IHN0cmluZywgbWF0Y2hUeXBlOiBUcmVlRmluZE1hdGNoVHlwZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQXN5bmNGaW5kUmVzdWx0PEV4cGxvcmVySXRlbT4gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuaGlnaGxpZ2h0U2Vzc2lvblN0YXJ0U3RhdGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRXhwbG9yZXJGaW5kUHJvdmlkZXI6IG5vIGhpZ2hsaWdodCBzZXNzaW9uIHN0YXRlJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vdHMgPSBBcnJheS5mcm9tKHRoaXMuaGlnaGxpZ2h0U2Vzc2lvblN0YXJ0U3RhdGUucm9vdHNXaXRoUHJvdmlkZXJzKTtcblx0XHRjb25zdCBzZWFyY2hSZXN1bHRzID0gYXdhaXQgdGhpcy5nZXRTZWFyY2hSZXN1bHRzKHBhdHRlcm4sIHJvb3RzLCBtYXRjaFR5cGUsIHRva2VuKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLmNsZWFySGlnaGxpZ2h0cygpO1xuXHRcdGZvciAoY29uc3QgeyBleHBsb3JlclJvb3QsIGZpbGVzLCBkaXJlY3RvcmllcyB9IG9mIHNlYXJjaFJlc3VsdHMpIHtcblx0XHRcdHRoaXMuYWRkV29ya3NwYWNlSGlnaGxpZ2h0UmVzdWx0cyhleHBsb3JlclJvb3QsIGZpbGVzLmNvbmNhdChkaXJlY3RvcmllcykpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhpdE1heFJlc3VsdHMgPSBzZWFyY2hSZXN1bHRzLnNvbWUoKHsgaGl0TWF4UmVzdWx0cyB9KSA9PiBoaXRNYXhSZXN1bHRzKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aXNNYXRjaDogKGl0ZW06IEV4cGxvcmVySXRlbSkgPT4gdGhpcy5maW5kSGlnaGxpZ2h0VHJlZS5pc01hdGNoKGl0ZW0pIHx8ICh0aGlzLmZpbmRIaWdobGlnaHRUcmVlLmdldChpdGVtKSA+IDAgJiYgdGhpcy50cmVlUHJvdmlkZXIoKS5pc0NvbGxhcHNlZChpdGVtKSksXG5cdFx0XHRtYXRjaENvdW50OiBzZWFyY2hSZXN1bHRzLnJlZHVjZSgoYWNjLCB7IGZpbGVzLCBkaXJlY3RvcmllcyB9KSA9PiBhY2MgKyBmaWxlcy5sZW5ndGggKyBkaXJlY3Rvcmllcy5sZW5ndGgsIDApLFxuXHRcdFx0d2FybmluZ01lc3NhZ2U6IGhpdE1heFJlc3VsdHMgPyBsb2NhbGl6ZSgnc2VhcmNoTWF4UmVzdWx0c1dhcm5pbmcnLCBcIlRoZSByZXN1bHQgc2V0IG9ubHkgY29udGFpbnMgYSBzdWJzZXQgb2YgYWxsIG1hdGNoZXMuIEJlIG1vcmUgc3BlY2lmaWMgaW4geW91ciBzZWFyY2ggdG8gbmFycm93IGRvd24gdGhlIHJlc3VsdHMuXCIpIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYWRkV29ya3NwYWNlSGlnaGxpZ2h0UmVzdWx0cyhyb290OiBFeHBsb3Jlckl0ZW0sIHJlc291cmNlczogVVJJW10pOiB2b2lkIHtcblx0XHRjb25zdCBoaWdobGlnaHRlZERpcmVjdG9yaWVzID0gbmV3IFNldDxFeHBsb3Jlckl0ZW0+KCk7XG5cdFx0Y29uc3Qgc3RvcmVEaXJlY3RvcmllcyA9IChpdGVtOiBFeHBsb3Jlckl0ZW0gfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdHdoaWxlIChpdGVtKSB7XG5cdFx0XHRcdGhpZ2hsaWdodGVkRGlyZWN0b3JpZXMuYWRkKGl0ZW0pO1xuXHRcdFx0XHRpdGVtID0gaXRlbS5wYXJlbnQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgcmVzb3VyY2VzKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gcm9vdC5maW5kKHJlc291cmNlKTtcblx0XHRcdGlmIChlbGVtZW50ICYmIGVsZW1lbnQucm9vdCA9PT0gcm9vdCkge1xuXHRcdFx0XHQvLyBGaWxlIGlzIGFscmVhZHkgaW4gdGhlIG1vZGVsXG5cdFx0XHRcdHRoaXMuZmluZEhpZ2hsaWdodFRyZWUuYWRkKHJlc291cmNlLCByb290KTtcblx0XHRcdFx0c3RvcmVEaXJlY3RvcmllcyhlbGVtZW50LnBhcmVudCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaXJzdFBhcmVudCA9IGZpbmRGaXJzdFBhcmVudChyZXNvdXJjZSwgcm9vdCk7XG5cdFx0XHRpZiAoZmlyc3RQYXJlbnQpIHtcblx0XHRcdFx0dGhpcy5maW5kSGlnaGxpZ2h0VHJlZS5hZGQocmVzb3VyY2UsIHJvb3QpO1xuXHRcdFx0XHRzdG9yZURpcmVjdG9yaWVzKGZpcnN0UGFyZW50LnBhcmVudCEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHRyZWUgPSB0aGlzLnRyZWVQcm92aWRlcigpO1xuXHRcdGZvciAoY29uc3QgZGlyZWN0b3J5IG9mIGhpZ2hsaWdodGVkRGlyZWN0b3JpZXMpIHtcblx0XHRcdGlmICh0cmVlLmhhc05vZGUoZGlyZWN0b3J5KSkge1xuXHRcdFx0XHR0cmVlLnJlcmVuZGVyKGRpcmVjdG9yeSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBlbmRIaWdobGlnaHRTZXNzaW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuaGlnaGxpZ2h0U2Vzc2lvblN0YXJ0U3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jbGVhckhpZ2hsaWdodHMoKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJIaWdobGlnaHRzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRyZWUgPSB0aGlzLnRyZWVQcm92aWRlcigpO1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmZpbmRIaWdobGlnaHRUcmVlLmhpZ2hsaWdodGVkSXRlbXMpIHtcblx0XHRcdGlmICh0cmVlLmhhc05vZGUoaXRlbSkpIHtcblx0XHRcdFx0dHJlZS5yZXJlbmRlcihpdGVtKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5maW5kSGlnaGxpZ2h0VHJlZS5jbGVhcigpO1xuXHR9XG5cblx0Ly8gU2VhcmNoXG5cblx0cHJpdmF0ZSBzZWFyY2hTdXBwb3J0c1NjaGVtZShzY2hlbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdC8vIExpbWl0ZWQgYnkgdGhlIHNlYXJjaCBBUElcblx0XHRpZiAoc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUgJiYgc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hTZXJ2aWNlLnNjaGVtZUhhc0ZpbGVTZWFyY2hQcm92aWRlcihzY2hlbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRTZWFyY2hSZXN1bHRzKHBhdHRlcm46IHN0cmluZywgcm9vdHM6IEV4cGxvcmVySXRlbVtdLCBtYXRjaFR5cGU6IFRyZWVGaW5kTWF0Y2hUeXBlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHsgZXhwbG9yZXJSb290OiBFeHBsb3Jlckl0ZW07IGZpbGVzOiBVUklbXTsgZGlyZWN0b3JpZXM6IFVSSVtdOyBoaXRNYXhSZXN1bHRzOiBib29sZWFuIH1bXT4ge1xuXHRcdGNvbnN0IHBhdHRlcm5Mb3dlcmNhc2UgPSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCk7XG5cdFx0Y29uc3QgaXNGdXp6eU1hdGNoID0gbWF0Y2hUeXBlID09PSBUcmVlRmluZE1hdGNoVHlwZS5GdXp6eTtcblx0XHRyZXR1cm4gYXdhaXQgUHJvbWlzZS5hbGwocm9vdHMubWFwKChyb290LCBpbmRleCkgPT4gdGhpcy5zZWFyY2hJbldvcmtzcGFjZShwYXR0ZXJuTG93ZXJjYXNlLCByb290LCBpbmRleCwgaXNGdXp6eU1hdGNoLCB0b2tlbikpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VhcmNoSW5Xb3Jrc3BhY2UocGF0dGVybkxvd2VyY2FzZTogc3RyaW5nLCByb290OiBFeHBsb3Jlckl0ZW0sIHJvb3RJbmRleDogbnVtYmVyLCBpc0Z1enp5TWF0Y2g6IGJvb2xlYW4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBleHBsb3JlclJvb3Q6IEV4cGxvcmVySXRlbTsgZmlsZXM6IFVSSVtdOyBkaXJlY3RvcmllczogVVJJW107IGhpdE1heFJlc3VsdHM6IGJvb2xlYW4gfT4ge1xuXHRcdGNvbnN0IHNlZ21lbnRNYXRjaFBhdHRlcm4gPSBjYXNlSW5zZW5zaXRpdmVHbG9iUGF0dGVybihpc0Z1enp5TWF0Y2ggPyBmdXp6eU1hdGNoaW5nR2xvYlBhdHRlcm4ocGF0dGVybkxvd2VyY2FzZSkgOiBjb250aW5vdXNNYXRjaGluZ0dsb2JQYXR0ZXJuKHBhdHRlcm5Mb3dlcmNhc2UpKTtcblxuXHRcdGNvbnN0IHNlYXJjaEV4Y2x1ZGVQYXR0ZXJuID0gZ2V0RXhjbHVkZXModGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvbj4oeyByZXNvdXJjZTogcm9vdC5yZXNvdXJjZSB9KSkgfHwge307XG5cdFx0Y29uc3Qgc2VhcmNoT3B0aW9uczogSUZpbGVRdWVyeSA9IHtcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdGZvbGRlcjogcm9vdC5yZXNvdXJjZSxcblx0XHRcdFx0ZGlzcmVnYXJkSWdub3JlRmlsZXM6ICF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdleHBsb3Jlci5leGNsdWRlR2l0SWdub3JlJyksXG5cdFx0XHR9XSxcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0c2hvdWxkR2xvYk1hdGNoRmlsZVBhdHRlcm46IHRydWUsXG5cdFx0XHRjYWNoZUtleTogYGV4cGxvcmVyZmluZHByb3ZpZGVyOiR7cm9vdC5uYW1lfToke3Jvb3RJbmRleH06JHt0aGlzLnNlc3Npb25JZH1gLFxuXHRcdFx0ZXhjbHVkZVBhdHRlcm46IHNlYXJjaEV4Y2x1ZGVQYXR0ZXJuLFxuXHRcdH07XG5cblx0XHRsZXQgZmlsZVJlc3VsdHM6IElTZWFyY2hDb21wbGV0ZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZm9sZGVyUmVzdWx0czogSVNlYXJjaENvbXBsZXRlIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRbZmlsZVJlc3VsdHMsIGZvbGRlclJlc3VsdHNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHR0aGlzLnNlYXJjaFNlcnZpY2UuZmlsZVNlYXJjaCh7IC4uLnNlYXJjaE9wdGlvbnMsIGZpbGVQYXR0ZXJuOiBgKiovJHtzZWdtZW50TWF0Y2hQYXR0ZXJufWAsIG1heFJlc3VsdHM6IDUxMiB9LCB0b2tlbiksXG5cdFx0XHRcdHRoaXMuc2VhcmNoU2VydmljZS5maWxlU2VhcmNoKHsgLi4uc2VhcmNoT3B0aW9ucywgZmlsZVBhdHRlcm46IGAqKi8ke3NlZ21lbnRNYXRjaFBhdHRlcm59LyoqYCB9LCB0b2tlbilcblx0XHRcdF0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghZmlsZVJlc3VsdHMgfHwgIWZvbGRlclJlc3VsdHMgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiB7IGV4cGxvcmVyUm9vdDogcm9vdCwgZmlsZXM6IFtdLCBkaXJlY3RvcmllczogW10sIGhpdE1heFJlc3VsdHM6IGZhbHNlIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZVJlc3VsdFJlc291cmNlcyA9IGZpbGVSZXN1bHRzLnJlc3VsdHMubWFwKHJlc3VsdCA9PiByZXN1bHQucmVzb3VyY2UpO1xuXHRcdGNvbnN0IGRpcmVjdG9yeVJlc291cmNlcyA9IGdldE1hdGNoaW5nRGlyZWN0b3JpZXNGcm9tRmlsZXMoZm9sZGVyUmVzdWx0cy5yZXN1bHRzLm1hcChyZXN1bHQgPT4gcmVzdWx0LnJlc291cmNlKSwgcm9vdCwgc2VnbWVudE1hdGNoUGF0dGVybik7XG5cblx0XHRjb25zdCBmaWx0ZXJlZEZpbGVSZXNvdXJjZXMgPSBmaWxlUmVzdWx0UmVzb3VyY2VzLmZpbHRlcihyZXNvdXJjZSA9PiAhdGhpcy5maWxlc0ZpbHRlci5pc0lnbm9yZWQocmVzb3VyY2UsIHJvb3QucmVzb3VyY2UsIGZhbHNlKSk7XG5cdFx0Y29uc3QgZmlsdGVyZWREaXJlY3RvcnlSZXNvdXJjZXMgPSBkaXJlY3RvcnlSZXNvdXJjZXMuZmlsdGVyKHJlc291cmNlID0+ICF0aGlzLmZpbGVzRmlsdGVyLmlzSWdub3JlZChyZXNvdXJjZSwgcm9vdC5yZXNvdXJjZSwgdHJ1ZSkpO1xuXG5cdFx0cmV0dXJuIHsgZXhwbG9yZXJSb290OiByb290LCBmaWxlczogZmlsdGVyZWRGaWxlUmVzb3VyY2VzLCBkaXJlY3RvcmllczogZmlsdGVyZWREaXJlY3RvcnlSZXNvdXJjZXMsIGhpdE1heFJlc3VsdHM6ICEhZmlsZVJlc3VsdHMubGltaXRIaXQgfHwgISFmb2xkZXJSZXN1bHRzLmxpbWl0SGl0IH07XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0TWF0Y2hpbmdEaXJlY3Rvcmllc0Zyb21GaWxlcyhyZXNvdXJjZXM6IFVSSVtdLCByb290OiBFeHBsb3Jlckl0ZW0sIHNlZ21lbnRNYXRjaFBhdHRlcm46IHN0cmluZyk6IFVSSVtdIHtcblx0Y29uc3QgdW5pcXVlRGlyZWN0b3JpZXMgPSBuZXcgUmVzb3VyY2VTZXQoKTtcblx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRjb25zdCByZWxhdGl2ZVBhdGhUb1Jvb3QgPSByZWxhdGl2ZVBhdGgocm9vdC5yZXNvdXJjZSwgcmVzb3VyY2UpO1xuXHRcdGlmICghcmVsYXRpdmVQYXRoVG9Sb290KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Jlc291cmNlIGlzIG5vdCBhIGNoaWxkIG9mIHRoZSByb290Jyk7XG5cdFx0fVxuXG5cdFx0bGV0IGRpclJlc291cmNlID0gcm9vdC5yZXNvdXJjZTtcblx0XHRjb25zdCBzdGF0cyA9IHJlbGF0aXZlUGF0aFRvUm9vdC5zcGxpdCgnLycpLnNsaWNlKDAsIC0xKTtcblx0XHRmb3IgKGNvbnN0IHN0YXQgb2Ygc3RhdHMpIHtcblx0XHRcdGRpclJlc291cmNlID0gZGlyUmVzb3VyY2Uud2l0aCh7IHBhdGg6IGAke2RpclJlc291cmNlLnBhdGh9LyR7c3RhdH1gIH0pO1xuXHRcdFx0dW5pcXVlRGlyZWN0b3JpZXMuYWRkKGRpclJlc291cmNlKTtcblx0XHR9XG5cdH1cblxuXHRjb25zdCBtYXRjaGluZ0RpcmVjdG9yaWVzOiBVUklbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGRpclJlc291cmNlIG9mIHVuaXF1ZURpcmVjdG9yaWVzKSB7XG5cdFx0Y29uc3Qgc3RhdHMgPSBkaXJSZXNvdXJjZS5wYXRoLnNwbGl0KCcvJyk7XG5cdFx0Y29uc3QgZGlyU3RhdCA9IHN0YXRzW3N0YXRzLmxlbmd0aCAtIDFdO1xuXHRcdGlmICghZGlyU3RhdCB8fCAhZ2xvYi5tYXRjaChzZWdtZW50TWF0Y2hQYXR0ZXJuLCBkaXJTdGF0KSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0bWF0Y2hpbmdEaXJlY3Rvcmllcy5wdXNoKGRpclJlc291cmNlKTtcblx0fVxuXG5cdHJldHVybiBtYXRjaGluZ0RpcmVjdG9yaWVzO1xufVxuXG5mdW5jdGlvbiBmaW5kRmlyc3RQYXJlbnQocmVzb3VyY2U6IFVSSSwgcm9vdDogRXhwbG9yZXJJdGVtKTogRXhwbG9yZXJJdGVtIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgcmVsYXRpdmVQYXRoVG9Sb290ID0gcmVsYXRpdmVQYXRoKHJvb3QucmVzb3VyY2UsIHJlc291cmNlKTtcblx0aWYgKCFyZWxhdGl2ZVBhdGhUb1Jvb3QpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Jlc291cmNlIGlzIG5vdCBhIGNoaWxkIG9mIHRoZSByb290Jyk7XG5cdH1cblxuXHRsZXQgY3VycmVudEl0ZW0gPSByb290O1xuXHRsZXQgY3VycmVudFJlc291cmNlID0gcm9vdC5yZXNvdXJjZTtcblx0Y29uc3QgcGF0aFNlZ21lbnRzID0gcmVsYXRpdmVQYXRoVG9Sb290LnNwbGl0KCcvJyk7XG5cdGZvciAoY29uc3Qgc3RhdCBvZiBwYXRoU2VnbWVudHMpIHtcblx0XHRjdXJyZW50UmVzb3VyY2UgPSBjdXJyZW50UmVzb3VyY2Uud2l0aCh7IHBhdGg6IGAke2N1cnJlbnRSZXNvdXJjZS5wYXRofS8ke3N0YXR9YCB9KTtcblx0XHRjb25zdCBjaGlsZCA9IGN1cnJlbnRJdGVtLmdldENoaWxkKHN0YXQpO1xuXHRcdGlmICghY2hpbGQpIHtcblx0XHRcdHJldHVybiBjdXJyZW50SXRlbTtcblx0XHR9XG5cblx0XHRjdXJyZW50SXRlbSA9IGNoaWxkO1xuXHR9XG5cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZnV6enlNYXRjaGluZ0dsb2JQYXR0ZXJuKHBhdHRlcm46IHN0cmluZyk6IHN0cmluZyB7XG5cdGlmICghcGF0dGVybikge1xuXHRcdHJldHVybiAnKic7XG5cdH1cblx0cmV0dXJuICcqJyArIHBhdHRlcm4uc3BsaXQoJycpLmpvaW4oJyonKSArICcqJztcbn1cblxuZnVuY3Rpb24gY29udGlub3VzTWF0Y2hpbmdHbG9iUGF0dGVybihwYXR0ZXJuOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAoIXBhdHRlcm4pIHtcblx0XHRyZXR1cm4gJyonO1xuXHR9XG5cdHJldHVybiAnKicgKyBwYXR0ZXJuICsgJyonO1xufVxuXG5mdW5jdGlvbiBjYXNlSW5zZW5zaXRpdmVHbG9iUGF0dGVybihwYXR0ZXJuOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRsZXQgY2FzZUluc2Vuc2l0aXZlRmlsZVBhdHRlcm4gPSAnJztcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBwYXR0ZXJuLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgY2hhciA9IHBhdHRlcm5baV07XG5cdFx0aWYgKC9bYS16QS1aXS8udGVzdChjaGFyKSkge1xuXHRcdFx0Y2FzZUluc2Vuc2l0aXZlRmlsZVBhdHRlcm4gKz0gYFske2NoYXIudG9Mb3dlckNhc2UoKX0ke2NoYXIudG9VcHBlckNhc2UoKX1dYDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y2FzZUluc2Vuc2l0aXZlRmlsZVBhdHRlcm4gKz0gY2hhcjtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGNhc2VJbnNlbnNpdGl2ZUZpbGVQYXR0ZXJuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21wcmVzc2VkTmF2aWdhdGlvbkNvbnRyb2xsZXIge1xuXHRyZWFkb25seSBjdXJyZW50OiBFeHBsb3Jlckl0ZW07XG5cdHJlYWRvbmx5IGN1cnJlbnRJZDogc3RyaW5nO1xuXHRyZWFkb25seSBpdGVtczogRXhwbG9yZXJJdGVtW107XG5cdHJlYWRvbmx5IGxhYmVsczogSFRNTEVsZW1lbnRbXTtcblx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgY291bnQ6IG51bWJlcjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXHRwcmV2aW91cygpOiB2b2lkO1xuXHRuZXh0KCk6IHZvaWQ7XG5cdGZpcnN0KCk6IHZvaWQ7XG5cdGxhc3QoKTogdm9pZDtcblx0c2V0SW5kZXgoaW5kZXg6IG51bWJlcik6IHZvaWQ7XG5cdHVwZGF0ZUNvbGxhcHNlZChjb2xsYXBzZWQ6IGJvb2xlYW4pOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQ29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVyIGltcGxlbWVudHMgSUNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlciwgSURpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyBJRCA9IDA7XG5cblx0cHJpdmF0ZSBfaW5kZXg6IG51bWJlcjtcblx0cHJpdmF0ZSBfbGFiZWxzITogSFRNTEVsZW1lbnRbXTtcblx0cHJpdmF0ZSBfdXBkYXRlTGFiZWxEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblxuXHRnZXQgaW5kZXgoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuX2luZGV4OyB9XG5cdGdldCBjb3VudCgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy5pdGVtcy5sZW5ndGg7IH1cblx0Z2V0IGN1cnJlbnQoKTogRXhwbG9yZXJJdGVtIHsgcmV0dXJuIHRoaXMuaXRlbXNbdGhpcy5faW5kZXhdITsgfVxuXHRnZXQgY3VycmVudElkKCk6IHN0cmluZyB7IHJldHVybiBgJHt0aGlzLmlkfV8ke3RoaXMuaW5kZXh9YDsgfVxuXHRnZXQgbGFiZWxzKCk6IEhUTUxFbGVtZW50W10geyByZXR1cm4gdGhpcy5fbGFiZWxzOyB9XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgaWQ6IHN0cmluZywgcmVhZG9ubHkgaXRlbXM6IEV4cGxvcmVySXRlbVtdLCB0ZW1wbGF0ZURhdGE6IElGaWxlVGVtcGxhdGVEYXRhLCBwcml2YXRlIGRlcHRoOiBudW1iZXIsIHByaXZhdGUgY29sbGFwc2VkOiBib29sZWFuKSB7XG5cdFx0dGhpcy5faW5kZXggPSBpdGVtcy5sZW5ndGggLSAxO1xuXG5cdFx0dGhpcy51cGRhdGVMYWJlbHModGVtcGxhdGVEYXRhKTtcblx0XHR0aGlzLl91cGRhdGVMYWJlbERpc3Bvc2FibGUgPSB0ZW1wbGF0ZURhdGEubGFiZWwub25EaWRSZW5kZXIoKCkgPT4gdGhpcy51cGRhdGVMYWJlbHModGVtcGxhdGVEYXRhKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxhYmVscyh0ZW1wbGF0ZURhdGE6IElGaWxlVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGhpcy5fbGFiZWxzID0gQXJyYXkuZnJvbSh0ZW1wbGF0ZURhdGEuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5sYWJlbC1uYW1lJykpIGFzIEhUTUxFbGVtZW50W107XG5cdFx0bGV0IHBhcmVudHMgPSAnJztcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGFiZWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBhcmlhTGFiZWwgPSBwYXJlbnRzLmxlbmd0aCA/IGAke3RoaXMuaXRlbXNbaV0ubmFtZX0sIGNvbXBhY3QsICR7cGFyZW50c31gIDogdGhpcy5pdGVtc1tpXS5uYW1lO1xuXHRcdFx0dGhpcy5sYWJlbHNbaV0uc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgYXJpYUxhYmVsKTtcblx0XHRcdHRoaXMubGFiZWxzW2ldLnNldEF0dHJpYnV0ZSgnYXJpYS1sZXZlbCcsIGAke3RoaXMuZGVwdGggKyBpfWApO1xuXHRcdFx0cGFyZW50cyA9IHBhcmVudHMubGVuZ3RoID8gYCR7dGhpcy5pdGVtc1tpXS5uYW1lfSAke3BhcmVudHN9YCA6IHRoaXMuaXRlbXNbaV0ubmFtZTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVDb2xsYXBzZWQodGhpcy5jb2xsYXBzZWQpO1xuXG5cdFx0aWYgKHRoaXMuX2luZGV4IDwgdGhpcy5sYWJlbHMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmxhYmVsc1t0aGlzLl9pbmRleF0uY2xhc3NMaXN0LmFkZCgnYWN0aXZlJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJldmlvdXMoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2luZGV4IDw9IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEluZGV4KHRoaXMuX2luZGV4IC0gMSk7XG5cdH1cblxuXHRuZXh0KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pbmRleCA+PSB0aGlzLml0ZW1zLmxlbmd0aCAtIDEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEluZGV4KHRoaXMuX2luZGV4ICsgMSk7XG5cdH1cblxuXHRmaXJzdCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5kZXggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldEluZGV4KDApO1xuXHR9XG5cblx0bGFzdCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faW5kZXggPT09IHRoaXMuaXRlbXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc2V0SW5kZXgodGhpcy5pdGVtcy5sZW5ndGggLSAxKTtcblx0fVxuXG5cdHNldEluZGV4KGluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoaW5kZXggPCAwIHx8IGluZGV4ID49IHRoaXMuaXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYWJlbHNbdGhpcy5faW5kZXhdLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXHRcdHRoaXMuX2luZGV4ID0gaW5kZXg7XG5cdFx0dGhpcy5sYWJlbHNbdGhpcy5faW5kZXhdLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0dXBkYXRlQ29sbGFwc2VkKGNvbGxhcHNlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuY29sbGFwc2VkID0gY29sbGFwc2VkO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYWJlbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMubGFiZWxzW2ldLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIGNvbGxhcHNlZCA/ICdmYWxzZScgOiAndHJ1ZScpO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3VwZGF0ZUxhYmVsRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVRlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IHRlbXBsYXRlRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IGxhYmVsOiBJUmVzb3VyY2VMYWJlbDtcblx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgY29udHJpYnM6IElFeHBsb3JlckZpbGVDb250cmlidXRpb25bXTtcblx0Y3VycmVudENvbnRleHQ/OiBFeHBsb3Jlckl0ZW07XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlc1JlbmRlcmVyIGltcGxlbWVudHMgSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxFeHBsb3Jlckl0ZW0sIEZ1enp5U2NvcmUsIElGaWxlVGVtcGxhdGVEYXRhPiwgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8RXhwbG9yZXJJdGVtPiwgSURpc3Bvc2FibGUge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZmlsZSc7XG5cblx0cHJpdmF0ZSBjb25maWc6IElGaWxlc0NvbmZpZ3VyYXRpb247XG5cdHByaXZhdGUgY29uZmlnTGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXHRwcml2YXRlIGNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcnMgPSBuZXcgTWFwPEV4cGxvcmVySXRlbSwgQ29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVyW10+KCk7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VBY3RpdmVEZXNjZW5kYW50ID0gbmV3IEV2ZW50TXVsdGlwbGV4ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVEZXNjZW5kYW50ID0gdGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVEZXNjZW5kYW50LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBsYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdHByaXZhdGUgaGlnaGxpZ2h0VHJlZTogSUV4cGxvcmVyRmluZEhpZ2hsaWdodFRyZWUsXG5cdFx0cHJpdmF0ZSB1cGRhdGVXaWR0aDogKHN0YXQ6IEV4cGxvcmVySXRlbSkgPT4gdm9pZCxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4cGxvcmVyU2VydmljZTogSUV4cGxvcmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmNvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKTtcblxuXHRcdGNvbnN0IHVwZGF0ZU9mZnNldFN0eWxlcyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGluZGVudCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignd29ya2JlbmNoLnRyZWUuaW5kZW50Jyk7XG5cdFx0XHRjb25zdCBvZmZzZXQgPSBNYXRoLm1heCgyMiAtIGluZGVudCwgMCk7IC8vIGRlcml2ZWQgdmlhIGluc3BlY3Rpb25cblx0XHRcdGNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eShgLS12c2NvZGUtZXhwbG9yZXItYWxpZ24tb2Zmc2V0LW1hcmdpbi1sZWZ0YCwgYCR7b2Zmc2V0fXB4YCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuY29uZmlnTGlzdGVuZXIgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdleHBsb3JlcicpKSB7XG5cdFx0XHRcdHRoaXMuY29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC50cmVlLmluZGVudCcpKSB7XG5cdFx0XHRcdHVwZGF0ZU9mZnNldFN0eWxlcygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dXBkYXRlT2Zmc2V0U3R5bGVzKCk7XG5cdH1cblxuXHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ3RyZWVBcmlhTGFiZWwnLCBcIkZpbGVzIEV4cGxvcmVyXCIpO1xuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gRmlsZXNSZW5kZXJlci5JRDtcblx0fVxuXG5cdC8vIFZvaWQgYWRkZWQgdGhpc1xuXHQvLyAvLyBDcmVhdGUgdm9pZCBidXR0b25zIGNvbnRhaW5lclxuXHQvLyBjb25zdCB2b2lkQnV0dG9uc0NvbnRhaW5lciA9IERPTS5hcHBlbmQoY29udGFpbmVyLCBET00uJCgnZGl2JykpO1xuXHQvLyB2b2lkQnV0dG9uc0NvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSdcblx0Ly8gdm9pZEJ1dHRvbnNDb250YWluZXIuc3R5bGUudG9wID0gJzAnXG5cdC8vIHZvaWRCdXR0b25zQ29udGFpbmVyLnN0eWxlLnJpZ2h0ID0gJzAnXG5cdC8vIC8vIGNvbnN0IHZvaWRCdXR0b25zID0gRE9NLmFwcGVuZCh2b2lkQnV0dG9uc0NvbnRhaW5lciwgRE9NLiQoJ3NwYW4nKSk7XG5cdC8vIC8vIHZvaWRCdXR0b25zLnRleHRDb250ZW50ID0gJ3ZvaWRidXR0b25zJ1xuXHQvLyAvLyB2b2lkQnV0dG9ucy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcblx0Ly8gLy8gXHRjb25zb2xlLmxvZygnT04gQ0xJQ0snLCB0ZW1wbGF0ZURhdGEuY3VycmVudENvbnRleHQ/LmNoaWxkcmVuKVxuXHQvLyAvLyB9KVxuXHQvLyBjb25zdCB2b2lkTGFiZWxzID0gdGhpcy5sYWJlbHMuY3JlYXRlKHZvaWRCdXR0b25zQ29udGFpbmVyLCB7IHN1cHBvcnRIaWdobGlnaHRzOiBmYWxzZSwgc3VwcG9ydEljb25zOiBmYWxzZSwgfSk7XG5cdC8vIHZvaWRMYWJlbHMuZWxlbWVudC50ZXh0Q29udGVudCA9ICdoaTMzMydcblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElGaWxlVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhYmVsID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5sYWJlbHMuY3JlYXRlKGNvbnRhaW5lciwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSB9KSk7XG5cdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobGFiZWwub25EaWRSZW5kZXIoKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHRlbXBsYXRlRGF0YS5jdXJyZW50Q29udGV4dCkge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlV2lkdGgodGVtcGxhdGVEYXRhLmN1cnJlbnRDb250ZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHQvLyBub29wIHNpbmNlIHRoZSBlbGVtZW50IG1pZ2h0IG5vIGxvbmdlciBiZSBpbiB0aGUgdHJlZSwgbm8gdXBkYXRlIG9mIHdpZHRoIG5lY2Vzc2FyeVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGNvbnRyaWJzID0gZXhwbG9yZXJGaWxlQ29udHJpYlJlZ2lzdHJ5LmNyZWF0ZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb250YWluZXIsIHRlbXBsYXRlRGlzcG9zYWJsZXMpO1xuXHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKGV4cGxvcmVyRmlsZUNvbnRyaWJSZWdpc3RyeS5vbkRpZFJlZ2lzdGVyRGVzY3JpcHRvcihkID0+IHtcblx0XHRcdGNvbnN0IGNvbnRyID0gZC5jcmVhdGUodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgY29udGFpbmVyKTtcblx0XHRcdGNvbnRyaWJzLnB1c2godGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoY29udHIpKTtcblx0XHRcdGNvbnRyLnNldFJlc291cmNlKHRlbXBsYXRlRGF0YS5jdXJyZW50Q29udGV4dD8ucmVzb3VyY2UpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHRlbXBsYXRlRGF0YTogSUZpbGVUZW1wbGF0ZURhdGEgPSB7IHRlbXBsYXRlRGlzcG9zYWJsZXMsIGVsZW1lbnREaXNwb3NhYmxlczogdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSwgbGFiZWwsIGNvbnRhaW5lciwgY29udHJpYnMgfTtcblx0XHRyZXR1cm4gdGVtcGxhdGVEYXRhO1xuXHR9XG5cblx0Ly8gVm9pZCBjYXJlcyBhYm91dCB0aGlzIGZ1bmN0aW9uLCB0aGlzIGlzIHdoZXJlIGVsZW1lbnRzIGluIHRoZSB0cmVlIGFyZSByZW5kZXJlZFxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxFeHBsb3Jlckl0ZW0sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGaWxlVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhdCA9IG5vZGUuZWxlbWVudDtcblx0XHR0ZW1wbGF0ZURhdGEuY3VycmVudENvbnRleHQgPSBzdGF0O1xuXG5cdFx0Y29uc3QgZWRpdGFibGVEYXRhID0gdGhpcy5leHBsb3JlclNlcnZpY2UuZ2V0RWRpdGFibGVEYXRhKHN0YXQpO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnY29tcHJlc3NlZCcpO1xuXG5cdFx0Ly8gRmlsZSBMYWJlbFxuXHRcdGlmICghZWRpdGFibGVEYXRhKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdFx0dGhpcy5yZW5kZXJTdGF0KHN0YXQsIHN0YXQubmFtZSwgdW5kZWZpbmVkLCBub2RlLmZpbHRlckRhdGEsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fVxuXG5cdFx0Ly8gSW5wdXQgQm94XG5cdFx0ZWxzZSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNvbnRyaWJzLmZvckVhY2goYyA9PiBjLnNldFJlc291cmNlKHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGhpcy5yZW5kZXJJbnB1dEJveCh0ZW1wbGF0ZURhdGEuY29udGFpbmVyLCBzdGF0LCBlZGl0YWJsZURhdGEpKTtcblx0XHR9XG5cdH1cblxuXHRyZW5kZXJDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8RXhwbG9yZXJJdGVtPiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZpbGVUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RhdCA9IG5vZGUuZWxlbWVudC5lbGVtZW50c1tub2RlLmVsZW1lbnQuZWxlbWVudHMubGVuZ3RoIC0gMV07XG5cdFx0dGVtcGxhdGVEYXRhLmN1cnJlbnRDb250ZXh0ID0gc3RhdDtcblxuXHRcdGNvbnN0IGVkaXRhYmxlID0gbm9kZS5lbGVtZW50LmVsZW1lbnRzLmZpbHRlcihlID0+IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLmlzRWRpdGFibGUoZSkpO1xuXHRcdGNvbnN0IGVkaXRhYmxlRGF0YSA9IGVkaXRhYmxlLmxlbmd0aCA9PT0gMCA/IHVuZGVmaW5lZCA6IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLmdldEVkaXRhYmxlRGF0YShlZGl0YWJsZVswXSk7XG5cblx0XHQvLyBGaWxlIExhYmVsXG5cdFx0aWYgKCFlZGl0YWJsZURhdGEpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NvbXByZXNzZWQnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cblx0XHRcdGNvbnN0IGlkID0gYGNvbXByZXNzZWQtZXhwbG9yZXJfJHtDb21wcmVzc2VkTmF2aWdhdGlvbkNvbnRyb2xsZXIuSUQrK31gO1xuXHRcdFx0Y29uc3QgbGFiZWxzID0gbm9kZS5lbGVtZW50LmVsZW1lbnRzLm1hcChlID0+IGUubmFtZSk7XG5cblx0XHRcdC8vIElmIHRoZXJlIGlzIGEgZnV6enkgc2NvcmUsIHdlIG5lZWQgdG8gYWRqdXN0IHRoZSBvZmZzZXQgb2YgdGhlIHNjb3JlXG5cdFx0XHQvLyB0byBhbGlnbiB3aXRoIHRoZSBsYXN0IHN0YXQgb2YgdGhlIGNvbXByZXNzZWQgbGFiZWxcblx0XHRcdGxldCBmdXp6eVNjb3JlID0gbm9kZS5maWx0ZXJEYXRhIGFzIEZ1enp5U2NvcmUgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZnV6enlTY29yZSAmJiBmdXp6eVNjb3JlLmxlbmd0aCA+IDIpIHtcblx0XHRcdFx0Y29uc3QgZmlsdGVyRGF0YU9mZnNldCA9IGxhYmVscy5qb2luKCcvJykubGVuZ3RoIC0gbGFiZWxzW2xhYmVscy5sZW5ndGggLSAxXS5sZW5ndGg7XG5cdFx0XHRcdGZ1enp5U2NvcmUgPSBbZnV6enlTY29yZVswXSwgZnV6enlTY29yZVsxXSArIGZpbHRlckRhdGFPZmZzZXQsIC4uLmZ1enp5U2NvcmUuc2xpY2UoMildO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnJlbmRlclN0YXQoc3RhdCwgbGFiZWxzLCBpZCwgZnV6enlTY29yZSwgdGVtcGxhdGVEYXRhKTtcblxuXHRcdFx0Y29uc3QgY29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVyID0gbmV3IENvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcihpZCwgbm9kZS5lbGVtZW50LmVsZW1lbnRzLCB0ZW1wbGF0ZURhdGEsIG5vZGUuZGVwdGgsIG5vZGUuY29sbGFwc2VkKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcik7XG5cblx0XHRcdGNvbnN0IG5vZGVDb250cm9sbGVycyA9IHRoaXMuY29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVycy5nZXQoc3RhdCkgPz8gW107XG5cdFx0XHR0aGlzLmNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcnMuc2V0KHN0YXQsIFsuLi5ub2RlQ29udHJvbGxlcnMsIGNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcl0pO1xuXG5cdFx0XHQvLyBhY2Nlc3NpYmlsaXR5XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZURlc2NlbmRhbnQuYWRkKGNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlci5vbkRpZENoYW5nZSkpO1xuXG5cdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlRGF0YS5jb250YWluZXIsICdtb3VzZWRvd24nLCBlID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gZ2V0SWNvbkxhYmVsTmFtZUZyb21IVE1MRWxlbWVudChlLnRhcmdldCk7XG5cblx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdGNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlci5zZXRJbmRleChyZXN1bHQuaW5kZXgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG5vZGVDb250cm9sbGVycyA9IHRoaXMuY29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVycy5nZXQoc3RhdCkgPz8gW107XG5cdFx0XHRcdGNvbnN0IHJlbmRlcmVkSW5kZXggPSBub2RlQ29udHJvbGxlcnMuZmluZEluZGV4KGNvbnRyb2xsZXIgPT4gY29udHJvbGxlciA9PT0gY29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVyKTtcblxuXHRcdFx0XHRpZiAocmVuZGVyZWRJbmRleCA8IDApIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Rpc3Bvc2luZyB1bmtub3duIG5hdmlnYXRpb24gY29udHJvbGxlcicpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKG5vZGVDb250cm9sbGVycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHR0aGlzLmNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcnMuZGVsZXRlKHN0YXQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5vZGVDb250cm9sbGVycy5zcGxpY2UocmVuZGVyZWRJbmRleCwgMSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBJbnB1dCBCb3hcblx0XHRlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2NvbXByZXNzZWQnKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuY29udHJpYnMuZm9yRWFjaChjID0+IGMuc2V0UmVzb3VyY2UodW5kZWZpbmVkKSk7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLnJlbmRlcklucHV0Qm94KHRlbXBsYXRlRGF0YS5jb250YWluZXIsIGVkaXRhYmxlWzBdLCBlZGl0YWJsZURhdGEpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclN0YXQoc3RhdDogRXhwbG9yZXJJdGVtLCBsYWJlbDogc3RyaW5nIHwgc3RyaW5nW10sIGRvbUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGZpbHRlckRhdGE6IEZ1enp5U2NvcmUgfCB1bmRlZmluZWQsIHRlbXBsYXRlRGF0YTogSUZpbGVUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdGNvbnN0IGV4dHJhQ2xhc3NlcyA9IFsnZXhwbG9yZXItaXRlbSddO1xuXHRcdGlmICh0aGlzLmV4cGxvcmVyU2VydmljZS5pc0N1dChzdGF0KSkge1xuXHRcdFx0ZXh0cmFDbGFzc2VzLnB1c2goJ2N1dCcpO1xuXHRcdH1cblxuXHRcdC8vIE9mZnNldCBuZXN0ZWQgY2hpbGRyZW4gdW5sZXNzIGZvbGRlcnMgaGF2ZSBib3RoIGNoZXZyb25zIGFuZCBpY29ucywgb3RoZXJ3aXNlIGFsaWdubWVudCBicmVha3Ncblx0XHRjb25zdCB0aGVtZSA9IHRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKTtcblxuXHRcdC8vIEhhY2sgdG8gYWx3YXlzIHJlbmRlciBjaGV2cm9ucyBmb3IgZmlsZSBuZXN0cywgb3IgZWxzZSBtYXkgbm90IGJlIGFibGUgdG8gaWRlbnRpZnkgdGhlbS5cblx0XHRjb25zdCB0d2lzdGllQ29udGFpbmVyID0gdGVtcGxhdGVEYXRhLmNvbnRhaW5lci5wYXJlbnRFbGVtZW50Py5wYXJlbnRFbGVtZW50Py5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLXRsLXR3aXN0aWUnKTtcblx0XHR0d2lzdGllQ29udGFpbmVyPy5jbGFzc0xpc3QudG9nZ2xlKCdmb3JjZS10d2lzdGllJywgc3RhdC5oYXNOZXN0cyAmJiB0aGVtZS5oaWRlc0V4cGxvcmVyQXJyb3dzKTtcblxuXHRcdC8vIHdoZW4gZXhwbG9yZXIgYXJyb3dzIGFyZSBoaWRkZW4gb3IgdGhlcmUgYXJlIG5vIGZvbGRlciBpY29ucywgbmVzdHMgZ2V0IG1pc2FsaWduZWQgYXMgdGhleSBhcmUgZm9yY2VkIHRvIGhhdmUgYXJyb3dzIGFuZCBmaWxlcyB0eXBpY2FsbHkgaGF2ZSBpY29uc1xuXHRcdC8vIEFwcGx5IHNvbWUgQ1NTIG1hZ2ljIHRvIGdldCB0aGluZ3MgbG9va2luZyBhcyByZWFzb25hYmxlIGFzIHBvc3NpYmxlLlxuXHRcdGNvbnN0IHRoZW1lSXNVbmhhcHB5V2l0aE5lc3RpbmcgPSB0aGVtZS5oYXNGaWxlSWNvbnMgJiYgKHRoZW1lLmhpZGVzRXhwbG9yZXJBcnJvd3MgfHwgIXRoZW1lLmhhc0ZvbGRlckljb25zKTtcblx0XHRjb25zdCByZWFsaWduTmVzdGVkQ2hpbGRyZW4gPSBzdGF0Lm5lc3RlZFBhcmVudCAmJiB0aGVtZUlzVW5oYXBweVdpdGhOZXN0aW5nO1xuXHRcdHRlbXBsYXRlRGF0YS5jb250cmlicy5mb3JFYWNoKGMgPT4gYy5zZXRSZXNvdXJjZShzdGF0LnJlc291cmNlKSk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnNldFJlc291cmNlKHsgcmVzb3VyY2U6IHN0YXQucmVzb3VyY2UsIG5hbWU6IGxhYmVsIH0sIHtcblx0XHRcdGZpbGVLaW5kOiBzdGF0LmlzUm9vdCA/IEZpbGVLaW5kLlJPT1RfRk9MREVSIDogc3RhdC5pc0RpcmVjdG9yeSA/IEZpbGVLaW5kLkZPTERFUiA6IEZpbGVLaW5kLkZJTEUsXG5cdFx0XHRleHRyYUNsYXNzZXM6IHJlYWxpZ25OZXN0ZWRDaGlsZHJlbiA/IFsuLi5leHRyYUNsYXNzZXMsICdhbGlnbi1uZXN0LWljb24td2l0aC1wYXJlbnQtaWNvbiddIDogZXh0cmFDbGFzc2VzLFxuXHRcdFx0ZmlsZURlY29yYXRpb25zOiB0aGlzLmNvbmZpZy5leHBsb3Jlci5kZWNvcmF0aW9ucyxcblx0XHRcdG1hdGNoZXM6IGNyZWF0ZU1hdGNoZXMoZmlsdGVyRGF0YSksXG5cdFx0XHRzZXBhcmF0b3I6IHRoaXMubGFiZWxTZXJ2aWNlLmdldFNlcGFyYXRvcihzdGF0LnJlc291cmNlLnNjaGVtZSwgc3RhdC5yZXNvdXJjZS5hdXRob3JpdHkpLFxuXHRcdFx0ZG9tSWRcblx0XHR9KTtcblxuXHRcdGNvbnN0IGhpZ2hsaWdodFJlc3VsdHMgPSBzdGF0LmlzRGlyZWN0b3J5ID8gdGhpcy5oaWdobGlnaHRUcmVlLmdldChzdGF0KSA6IDA7XG5cdFx0aWYgKGhpZ2hsaWdodFJlc3VsdHMgPiAwKSB7XG5cdFx0XHRjb25zdCBiYWRnZSA9IG5ldyBDb3VudEJhZGdlKHRlbXBsYXRlRGF0YS5sYWJlbC5lbGVtZW50Lmxhc3RFbGVtZW50Q2hpbGQgYXMgSFRNTEVsZW1lbnQsIHt9LCB7IC4uLmRlZmF1bHRDb3VudEJhZGdlU3R5bGVzLCBiYWRnZUJhY2tncm91bmQ6IGFzQ3NzVmFyaWFibGUobGlzdEZpbHRlck1hdGNoSGlnaGxpZ2h0KSwgYmFkZ2VCb3JkZXI6IGFzQ3NzVmFyaWFibGUobGlzdEZpbHRlck1hdGNoSGlnaGxpZ2h0Qm9yZGVyKSB9KTtcblx0XHRcdGJhZGdlLnNldENvdW50KGhpZ2hsaWdodFJlc3VsdHMpO1xuXHRcdFx0YmFkZ2Uuc2V0VGl0bGVGb3JtYXQobG9jYWxpemUoJ2V4cGxvcmVySGlnaGxpZ2h0Rm9sZGVyQmFkZ2VUaXRsZScsIFwiRGlyZWN0b3J5IGNvbnRhaW5zIHswfSBtYXRjaGVzXCIsIGhpZ2hsaWdodFJlc3VsdHMpKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGJhZGdlKTtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnaGlnaGxpZ2h0LWJhZGdlJywgaGlnaGxpZ2h0UmVzdWx0cyA+IDApO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJJbnB1dEJveChjb250YWluZXI6IEhUTUxFbGVtZW50LCBzdGF0OiBFeHBsb3Jlckl0ZW0sIGVkaXRhYmxlRGF0YTogSUVkaXRhYmxlRGF0YSk6IElEaXNwb3NhYmxlIHtcblxuXHRcdC8vIFVzZSBhIGZpbGUgbGFiZWwgb25seSBmb3IgdGhlIGljb24gbmV4dCB0byB0aGUgaW5wdXQgYm94XG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLmxhYmVscy5jcmVhdGUoY29udGFpbmVyKTtcblx0XHRjb25zdCBleHRyYUNsYXNzZXMgPSBbJ2V4cGxvcmVyLWl0ZW0nLCAnZXhwbG9yZXItaXRlbS1lZGl0ZWQnXTtcblx0XHRjb25zdCBmaWxlS2luZCA9IHN0YXQuaXNSb290ID8gRmlsZUtpbmQuUk9PVF9GT0xERVIgOiBzdGF0LmlzRGlyZWN0b3J5ID8gRmlsZUtpbmQuRk9MREVSIDogRmlsZUtpbmQuRklMRTtcblxuXHRcdGNvbnN0IHRoZW1lID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZSgpO1xuXHRcdGNvbnN0IHRoZW1lSXNVbmhhcHB5V2l0aE5lc3RpbmcgPSB0aGVtZS5oYXNGaWxlSWNvbnMgJiYgKHRoZW1lLmhpZGVzRXhwbG9yZXJBcnJvd3MgfHwgIXRoZW1lLmhhc0ZvbGRlckljb25zKTtcblx0XHRjb25zdCByZWFsaWduTmVzdGVkQ2hpbGRyZW4gPSBzdGF0Lm5lc3RlZFBhcmVudCAmJiB0aGVtZUlzVW5oYXBweVdpdGhOZXN0aW5nO1xuXG5cdFx0Y29uc3QgbGFiZWxPcHRpb25zOiBJRmlsZUxhYmVsT3B0aW9ucyA9IHtcblx0XHRcdGhpZGVQYXRoOiB0cnVlLFxuXHRcdFx0aGlkZUxhYmVsOiB0cnVlLFxuXHRcdFx0ZmlsZUtpbmQsXG5cdFx0XHRleHRyYUNsYXNzZXM6IHJlYWxpZ25OZXN0ZWRDaGlsZHJlbiA/IFsuLi5leHRyYUNsYXNzZXMsICdhbGlnbi1uZXN0LWljb24td2l0aC1wYXJlbnQtaWNvbiddIDogZXh0cmFDbGFzc2VzLFxuXHRcdH07XG5cblxuXHRcdGNvbnN0IHBhcmVudCA9IHN0YXQubmFtZSA/IGRpcm5hbWUoc3RhdC5yZXNvdXJjZSkgOiBzdGF0LnJlc291cmNlO1xuXHRcdGNvbnN0IHZhbHVlID0gc3RhdC5uYW1lIHx8ICcnO1xuXG5cdFx0bGFiZWwuc2V0RmlsZShqb2luUGF0aChwYXJlbnQsIHZhbHVlIHx8ICcgJyksIGxhYmVsT3B0aW9ucyk7IC8vIFVzZSBpY29uIGZvciAnICcgaWYgbmFtZSBpcyBlbXB0eS5cblxuXHRcdC8vIGhhY2s6IGhpZGUgbGFiZWxcblx0XHQobGFiZWwuZWxlbWVudC5maXJzdEVsZW1lbnRDaGlsZCBhcyBIVE1MRWxlbWVudCkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdC8vIElucHV0IGZpZWxkIGZvciBuYW1lXG5cdFx0Y29uc3QgaW5wdXRCb3ggPSBuZXcgSW5wdXRCb3gobGFiZWwuZWxlbWVudCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdHZhbGlkYXRpb25PcHRpb25zOiB7XG5cdFx0XHRcdHZhbGlkYXRpb246ICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBlZGl0YWJsZURhdGEudmFsaWRhdGlvbk1lc3NhZ2UodmFsdWUpO1xuXHRcdFx0XHRcdGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnNldmVyaXR5ICE9PSBTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IG1lc3NhZ2UuY29udGVudCxcblx0XHRcdFx0XHRcdGZvcm1hdENvbnRlbnQ6IHRydWUsXG5cdFx0XHRcdFx0XHR0eXBlOiBNZXNzYWdlVHlwZS5FUlJPUlxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdmaWxlSW5wdXRBcmlhTGFiZWwnLCBcIlR5cGUgZmlsZSBuYW1lLiBQcmVzcyBFbnRlciB0byBjb25maXJtIG9yIEVzY2FwZSB0byBjYW5jZWwuXCIpLFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlcyxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxhc3REb3QgPSB2YWx1ZS5sYXN0SW5kZXhPZignLicpO1xuXHRcdGxldCBjdXJyZW50U2VsZWN0aW9uU3RhdGUgPSAncHJlZml4JztcblxuXHRcdGlucHV0Qm94LnZhbHVlID0gdmFsdWU7XG5cdFx0aW5wdXRCb3guZm9jdXMoKTtcblx0XHRpbnB1dEJveC5zZWxlY3QoeyBzdGFydDogMCwgZW5kOiBsYXN0RG90ID4gMCAmJiAhc3RhdC5pc0RpcmVjdG9yeSA/IGxhc3REb3QgOiB2YWx1ZS5sZW5ndGggfSk7XG5cblx0XHRjb25zdCBkb25lID0gY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uKChzdWNjZXNzOiBib29sZWFuLCBmaW5pc2hFZGl0aW5nOiBib29sZWFuKSA9PiB7XG5cdFx0XHRsYWJlbC5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGlucHV0Qm94LnZhbHVlO1xuXHRcdFx0ZGlzcG9zZSh0b0Rpc3Bvc2UpO1xuXHRcdFx0bGFiZWwuZWxlbWVudC5yZW1vdmUoKTtcblx0XHRcdGlmIChmaW5pc2hFZGl0aW5nKSB7XG5cdFx0XHRcdGVkaXRhYmxlRGF0YS5vbkZpbmlzaCh2YWx1ZSwgc3VjY2Vzcyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzaG93SW5wdXRCb3hOb3RpZmljYXRpb24gPSAoKSA9PiB7XG5cdFx0XHRpZiAoaW5wdXRCb3guaXNJbnB1dFZhbGlkKCkpIHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IGVkaXRhYmxlRGF0YS52YWxpZGF0aW9uTWVzc2FnZShpbnB1dEJveC52YWx1ZSk7XG5cdFx0XHRcdGlmIChtZXNzYWdlKSB7XG5cdFx0XHRcdFx0aW5wdXRCb3guc2hvd01lc3NhZ2Uoe1xuXHRcdFx0XHRcdFx0Y29udGVudDogbWVzc2FnZS5jb250ZW50LFxuXHRcdFx0XHRcdFx0Zm9ybWF0Q29udGVudDogdHJ1ZSxcblx0XHRcdFx0XHRcdHR5cGU6IG1lc3NhZ2Uuc2V2ZXJpdHkgPT09IFNldmVyaXR5LkluZm8gPyBNZXNzYWdlVHlwZS5JTkZPIDogbWVzc2FnZS5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuV2FybmluZyA/IE1lc3NhZ2VUeXBlLldBUk5JTkcgOiBNZXNzYWdlVHlwZS5FUlJPUlxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlucHV0Qm94LmhpZGVNZXNzYWdlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHRcdHNob3dJbnB1dEJveE5vdGlmaWNhdGlvbigpO1xuXG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gW1xuXHRcdFx0aW5wdXRCb3gsXG5cdFx0XHRpbnB1dEJveC5vbkRpZENoYW5nZSh2YWx1ZSA9PiB7XG5cdFx0XHRcdGxhYmVsLnNldEZpbGUoam9pblBhdGgocGFyZW50LCB2YWx1ZSB8fCAnICcpLCBsYWJlbE9wdGlvbnMpOyAvLyB1cGRhdGUgbGFiZWwgaWNvbiB3aGlsZSB0eXBpbmchXG5cdFx0XHR9KSxcblx0XHRcdERPTS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsIERPTS5FdmVudFR5cGUuS0VZX0RPV04sIChlOiBJS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5GMikpIHtcblx0XHRcdFx0XHRjb25zdCBkb3RJbmRleCA9IGlucHV0Qm94LnZhbHVlLmxhc3RJbmRleE9mKCcuJyk7XG5cdFx0XHRcdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkgfHwgZG90SW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChjdXJyZW50U2VsZWN0aW9uU3RhdGUgPT09ICdwcmVmaXgnKSB7XG5cdFx0XHRcdFx0XHRjdXJyZW50U2VsZWN0aW9uU3RhdGUgPSAnYWxsJztcblx0XHRcdFx0XHRcdGlucHV0Qm94LnNlbGVjdCh7IHN0YXJ0OiAwLCBlbmQ6IGlucHV0Qm94LnZhbHVlLmxlbmd0aCB9KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGN1cnJlbnRTZWxlY3Rpb25TdGF0ZSA9PT0gJ2FsbCcpIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRTZWxlY3Rpb25TdGF0ZSA9ICdzdWZmaXgnO1xuXHRcdFx0XHRcdFx0aW5wdXRCb3guc2VsZWN0KHsgc3RhcnQ6IGRvdEluZGV4ICsgMSwgZW5kOiBpbnB1dEJveC52YWx1ZS5sZW5ndGggfSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGN1cnJlbnRTZWxlY3Rpb25TdGF0ZSA9ICdwcmVmaXgnO1xuXHRcdFx0XHRcdFx0aW5wdXRCb3guc2VsZWN0KHsgc3RhcnQ6IDAsIGVuZDogZG90SW5kZXggfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGUuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdFx0aWYgKCFpbnB1dEJveC52YWxpZGF0ZSgpKSB7XG5cdFx0XHRcdFx0XHRkb25lKHRydWUsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChlLmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0XHRkb25lKGZhbHNlLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHRET00uYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCBET00uRXZlbnRUeXBlLktFWV9VUCwgKGU6IElLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRcdHNob3dJbnB1dEJveE5vdGlmaWNhdGlvbigpO1xuXHRcdFx0fSksXG5cdFx0XHRET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGlucHV0Qm94LmlucHV0RWxlbWVudCwgRE9NLkV2ZW50VHlwZS5CTFVSLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdFx0XHRcdGNvbnN0IG93bmVyRG9jdW1lbnQgPSBpbnB1dEJveC5pbnB1dEVsZW1lbnQub3duZXJEb2N1bWVudDtcblx0XHRcdFx0XHRpZiAoIW93bmVyRG9jdW1lbnQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fSBpZiAoRE9NLmlzQWN0aXZlRWxlbWVudChpbnB1dEJveC5pbnB1dEVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChET00uaXNIVE1MRWxlbWVudChvd25lckRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpICYmIERPTS5oYXNQYXJlbnRXaXRoQ2xhc3Mob3duZXJEb2N1bWVudC5hY3RpdmVFbGVtZW50LCAnY29udGV4dC12aWV3JykpIHtcblx0XHRcdFx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh0aGlzLmNvbnRleHRNZW51U2VydmljZS5vbkRpZEhpZGVDb250ZXh0TWVudSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRvbmUoaW5wdXRCb3guaXNJbnB1dFZhbGlkKCksIHRydWUpO1xuXHRcdFx0fSksXG5cdFx0XHRsYWJlbFxuXHRcdF07XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGRvbmUoZmFsc2UsIGZhbHNlKTtcblx0XHR9KTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxFeHBsb3Jlckl0ZW0sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElGaWxlVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmN1cnJlbnRDb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VDb21wcmVzc2VkRWxlbWVudHMobm9kZTogSVRyZWVOb2RlPElDb21wcmVzc2VkVHJlZU5vZGU8RXhwbG9yZXJJdGVtPiwgRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUZpbGVUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuY3VycmVudENvbnRleHQgPSB1bmRlZmluZWQ7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUZpbGVUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEudGVtcGxhdGVEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRDb21wcmVzc2VkTmF2aWdhdGlvbkNvbnRyb2xsZXIoc3RhdDogRXhwbG9yZXJJdGVtKTogSUNvbXByZXNzZWROYXZpZ2F0aW9uQ29udHJvbGxlcltdIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jb21wcmVzc2VkTmF2aWdhdGlvbkNvbnRyb2xsZXJzLmdldChzdGF0KTtcblx0fVxuXG5cdC8vIElBY2Nlc3NpYmlsaXR5UHJvdmlkZXJcblxuXHRnZXRBcmlhTGFiZWwoZWxlbWVudDogRXhwbG9yZXJJdGVtKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZWxlbWVudC5uYW1lO1xuXHR9XG5cblx0Z2V0QXJpYUxldmVsKGVsZW1lbnQ6IEV4cGxvcmVySXRlbSk6IG51bWJlciB7XG5cdFx0Ly8gV2UgbmVlZCB0byBjb21wdXQgYXJpYSBsZXZlbCBvbiBvdXIgb3duIHNpbmNlIGNoaWxkcmVuIG9mIGNvbXBhY3QgZm9sZGVycyB3aWxsIG90aGVyd2lzZSBoYXZlIGFuIGluY29ycmVjdCBsZXZlbFx0IzEwNzIzNVxuXHRcdGxldCBkZXB0aCA9IDA7XG5cdFx0bGV0IHBhcmVudCA9IGVsZW1lbnQucGFyZW50O1xuXHRcdHdoaWxlIChwYXJlbnQpIHtcblx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG5cdFx0XHRkZXB0aCsrO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0ZGVwdGggPSBkZXB0aCArIDE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRlcHRoO1xuXHR9XG5cblx0Z2V0QWN0aXZlRGVzY2VuZGFudElkKHN0YXQ6IEV4cGxvcmVySXRlbSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcHJlc3NlZE5hdmlnYXRpb25Db250cm9sbGVycy5nZXQoc3RhdCk/LlswXT8uY3VycmVudElkID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jb25maWdMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIENhY2hlZFBhcnNlZEV4cHJlc3Npb24ge1xuXHRvcmlnaW5hbDogZ2xvYi5JRXhwcmVzc2lvbjtcblx0cGFyc2VkOiBnbG9iLlBhcnNlZEV4cHJlc3Npb247XG59XG5cbi8qKlxuICogUmVzcGVjdHMgZmlsZXMuZXhjbHVkZSBzZXR0aW5nIGluIGZpbHRlcmluZyBvdXQgY29udGVudCBmcm9tIHRoZSBleHBsb3Jlci5cbiAqIE1ha2VzIHN1cmUgdGhhdCB2aXNpYmxlIGVkaXRvcnMgYXJlIGFsd2F5cyBzaG93biBpbiB0aGUgZXhwbG9yZXIgZXZlbiBpZiB0aGV5IGFyZSBmaWx0ZXJlZCBvdXQgYnkgc2V0dGluZ3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBGaWxlc0ZpbHRlciBpbXBsZW1lbnRzIElUcmVlRmlsdGVyPEV4cGxvcmVySXRlbSwgRnV6enlTY29yZT4ge1xuXHRwcml2YXRlIGhpZGRlbkV4cHJlc3Npb25QZXJSb290ID0gbmV3IE1hcDxzdHJpbmcsIENhY2hlZFBhcnNlZEV4cHJlc3Npb24+KCk7XG5cdHByaXZhdGUgZWRpdG9yc0FmZmVjdGluZ0ZpbHRlciA9IG5ldyBTZXQ8RWRpdG9ySW5wdXQ+KCk7XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cHJpdmF0ZSB0b0Rpc3Bvc2U6IElEaXNwb3NhYmxlW10gPSBbXTtcblx0Ly8gTGlzdCBvZiBpZ25vcmVGaWxlIHJlc291cmNlcy4gVXNlZCB0byBkZXRlY3QgY2hhbmdlcyB0byB0aGUgaWdub3JlRmlsZXMuXG5cdHByaXZhdGUgaWdub3JlRmlsZVJlc291cmNlc1BlclJvb3QgPSBuZXcgTWFwPHN0cmluZywgUmVzb3VyY2VTZXQ+KCk7XG5cdC8vIElnbm9yZSB0cmVlIHBlciByb290LiBTaW1pbGFyIHRvIGBoaWRkZW5FeHByZXNzaW9uUGVyUm9vdGBcblx0Ly8gTm90ZTogVVJJIGluIHRoZSB0ZXJuYXJ5IHNlYXJjaCB0cmVlIGlzIHRoZSBVUkkgb2YgdGhlIGZvbGRlciBjb250YWluaW5nIHRoZSBpZ25vcmUgZmlsZVxuXHQvLyBJdCBpcyBub3QgdGhlIGlnbm9yZSBmaWxlIGl0c2VsZi4gVGhpcyBpcyBiZWNhdXNlIG9mIHRoZSB3YXkgdGhlIElnbm9yZUZpbGUgd29ya3MgYW5kIG5lc3RlZCBwYXRoc1xuXHRwcml2YXRlIGlnbm9yZVRyZWVzUGVyUm9vdCA9IG5ldyBNYXA8c3RyaW5nLCBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIElnbm9yZUZpbGU+PigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXhwbG9yZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXhwbG9yZXJTZXJ2aWNlOiBJRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoKCkgPT4gdGhpcy51cGRhdGVDb25maWd1cmF0aW9uKCkpKTtcblx0XHR0aGlzLnRvRGlzcG9zZS5wdXNoKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmlsZXMuZXhjbHVkZScpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2V4cGxvcmVyLmV4Y2x1ZGVHaXRJZ25vcmUnKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB7XG5cdFx0XHQvLyBDaGVjayB0byBzZWUgaWYgdGhlIHVwZGF0ZSBjb250YWlucyBhbnkgb2YgdGhlIGlnbm9yZUZpbGVSZXNvdXJjZXNcblx0XHRcdGZvciAoY29uc3QgW3Jvb3QsIGlnbm9yZUZpbGVSZXNvdXJjZVNldF0gb2YgdGhpcy5pZ25vcmVGaWxlUmVzb3VyY2VzUGVyUm9vdC5lbnRyaWVzKCkpIHtcblx0XHRcdFx0aWdub3JlRmlsZVJlc291cmNlU2V0LmZvckVhY2goYXN5bmMgaWdub3JlUmVzb3VyY2UgPT4ge1xuXHRcdFx0XHRcdGlmIChlLmNvbnRhaW5zKGlnbm9yZVJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wcm9jZXNzSWdub3JlRmlsZShyb290LCBpZ25vcmVSZXNvdXJjZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlLmNvbnRhaW5zKGlnbm9yZVJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5pZ25vcmVUcmVlc1BlclJvb3QuZ2V0KHJvb3QpPy5kZWxldGUoZGlybmFtZShpZ25vcmVSZXNvdXJjZSkpO1xuXHRcdFx0XHRcdFx0aWdub3JlRmlsZVJlc291cmNlU2V0LmRlbGV0ZShpZ25vcmVSZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaCh0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRWaXNpYmxlRWRpdG9yc0NoYW5nZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gdGhpcy5lZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JzO1xuXHRcdFx0bGV0IHNob3VsZEZpcmUgPSBmYWxzZTtcblxuXHRcdFx0Zm9yIChjb25zdCBlIG9mIGVkaXRvcnMpIHtcblx0XHRcdFx0aWYgKCFlLnJlc291cmNlKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdGF0ID0gdGhpcy5leHBsb3JlclNlcnZpY2UuZmluZENsb3Nlc3QoZS5yZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChzdGF0ICYmIHN0YXQuaXNFeGNsdWRlZCkge1xuXHRcdFx0XHRcdC8vIEEgZmlsdGVyZWQgcmVzb3VyY2Ugc3VkZGVubHkgYmVjYW1lIHZpc2libGUgc2luY2UgdXNlciBvcGVuZWQgYW4gZWRpdG9yXG5cdFx0XHRcdFx0c2hvdWxkRmlyZSA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBlIG9mIHRoaXMuZWRpdG9yc0FmZmVjdGluZ0ZpbHRlcikge1xuXHRcdFx0XHRpZiAoIWVkaXRvcnMuaW5jbHVkZXMoZSkpIHtcblx0XHRcdFx0XHQvLyBFZGl0b3IgdGhhdCB3YXMgYWZmZWN0aW5nIGZpbHRlcmluZyBpcyBubyBsb25nZXIgdmlzaWJsZVxuXHRcdFx0XHRcdHNob3VsZEZpcmUgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzaG91bGRGaXJlKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yc0FmZmVjdGluZ0ZpbHRlci5jbGVhcigpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudXBkYXRlQ29uZmlndXJhdGlvbigpO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlKCk6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbmZpZ3VyYXRpb24oKTogdm9pZCB7XG5cdFx0bGV0IHNob3VsZEZpcmUgPSBmYWxzZTtcblx0XHRsZXQgdXBkYXRlZEdpdElnbm9yZVNldHRpbmcgPSBmYWxzZTtcblx0XHR0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMuZm9yRWFjaChmb2xkZXIgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oeyByZXNvdXJjZTogZm9sZGVyLnVyaSB9KTtcblx0XHRcdGNvbnN0IGV4Y2x1ZGVzQ29uZmlnOiBnbG9iLklFeHByZXNzaW9uID0gY29uZmlndXJhdGlvbj8uZmlsZXM/LmV4Y2x1ZGUgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdGNvbnN0IHBhcnNlSWdub3JlRmlsZTogYm9vbGVhbiA9IGNvbmZpZ3VyYXRpb24uZXhwbG9yZXIuZXhjbHVkZUdpdElnbm9yZTtcblxuXHRcdFx0Ly8gSWYgd2Ugc2hvdWxkIGJlIHBhcnNpbmcgaWdub3JlRmlsZXMgZm9yIHRoaXMgd29ya3NwYWNlIGFuZCBkb24ndCBoYXZlIGFuIGlnbm9yZSB0cmVlIGluaXRpYWxpemUgb25lXG5cdFx0XHRpZiAocGFyc2VJZ25vcmVGaWxlICYmICF0aGlzLmlnbm9yZVRyZWVzUGVyUm9vdC5oYXMoZm9sZGVyLnVyaS50b1N0cmluZygpKSkge1xuXHRcdFx0XHR1cGRhdGVkR2l0SWdub3JlU2V0dGluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuaWdub3JlRmlsZVJlc291cmNlc1BlclJvb3Quc2V0KGZvbGRlci51cmkudG9TdHJpbmcoKSwgbmV3IFJlc291cmNlU2V0KCkpO1xuXHRcdFx0XHR0aGlzLmlnbm9yZVRyZWVzUGVyUm9vdC5zZXQoZm9sZGVyLnVyaS50b1N0cmluZygpLCBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzKCh1cmkpID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pZ25vcmVQYXRoQ2FzaW5nKHVyaSkpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgd2Ugc2hvdWxkbid0IGJlIHBhcnNpbmcgaWdub3JlIGZpbGVzIGJ1dCBoYXZlIGFuIGlnbm9yZSB0cmVlLCBjbGVhciB0aGUgaWdub3JlIHRyZWVcblx0XHRcdGlmICghcGFyc2VJZ25vcmVGaWxlICYmIHRoaXMuaWdub3JlVHJlZXNQZXJSb290Lmhhcyhmb2xkZXIudXJpLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHRcdHVwZGF0ZWRHaXRJZ25vcmVTZXR0aW5nID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5pZ25vcmVGaWxlUmVzb3VyY2VzUGVyUm9vdC5kZWxldGUoZm9sZGVyLnVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0dGhpcy5pZ25vcmVUcmVlc1BlclJvb3QuZGVsZXRlKGZvbGRlci51cmkudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghc2hvdWxkRmlyZSkge1xuXHRcdFx0XHRjb25zdCBjYWNoZWQgPSB0aGlzLmhpZGRlbkV4cHJlc3Npb25QZXJSb290LmdldChmb2xkZXIudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRzaG91bGRGaXJlID0gIWNhY2hlZCB8fCAhZXF1YWxzKGNhY2hlZC5vcmlnaW5hbCwgZXhjbHVkZXNDb25maWcpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBleGNsdWRlc0NvbmZpZ0NvcHkgPSBkZWVwQ2xvbmUoZXhjbHVkZXNDb25maWcpOyAvLyBkbyBub3Qga2VlcCB0aGUgY29uZmlnLCBhcyBpdCBnZXRzIG11dGF0ZWQgdW5kZXIgb3VyIGhvb2RzXG5cblx0XHRcdHRoaXMuaGlkZGVuRXhwcmVzc2lvblBlclJvb3Quc2V0KGZvbGRlci51cmkudG9TdHJpbmcoKSwgeyBvcmlnaW5hbDogZXhjbHVkZXNDb25maWdDb3B5LCBwYXJzZWQ6IGdsb2IucGFyc2UoZXhjbHVkZXNDb25maWdDb3B5KSB9KTtcblx0XHR9KTtcblxuXHRcdGlmIChzaG91bGRGaXJlIHx8IHVwZGF0ZWRHaXRJZ25vcmVTZXR0aW5nKSB7XG5cdFx0XHR0aGlzLmVkaXRvcnNBZmZlY3RpbmdGaWx0ZXIuY2xlYXIoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSAuZ2l0aWdub3JlIGZpbGUgcmVzb3VyY2UsIHByb2Nlc3NlcyB0aGUgcmVzb3VyY2UgYW5kIGFkZHMgaXQgdG8gdGhlIGlnbm9yZSB0cmVlIHdoaWNoIGhpZGVzIGV4cGxvcmVyIGl0ZW1zXG5cdCAqIEBwYXJhbSByb290IFRoZSByb290IGZvbGRlciBvZiB0aGUgd29ya3NwYWNlIGFzIGEgc3RyaW5nLiBVc2VkIGZvciBsb29rdXAga2V5IGZvciBpZ25vcmUgdHJlZSBhbmQgcmVzb3VyY2UgbGlzdFxuXHQgKiBAcGFyYW0gaWdub3JlRmlsZVJlc291cmNlIFRoZSByZXNvdXJjZSBvZiB0aGUgLmdpdGlnbm9yZSBmaWxlXG5cdCAqIEBwYXJhbSB1cGRhdGUgV2hldGhlciBvciBub3Qgd2UncmUgdXBkYXRpbmcgYW4gZXhpc3RpbmcgaWdub3JlIGZpbGUuIElmIHRydWUgaXQgZGVsZXRlcyB0aGUgb2xkIGVudHJ5XG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIHByb2Nlc3NJZ25vcmVGaWxlKHJvb3Q6IHN0cmluZywgaWdub3JlRmlsZVJlc291cmNlOiBVUkksIHVwZGF0ZT86IGJvb2xlYW4pIHtcblx0XHQvLyBHZXQgdGhlIG5hbWUgb2YgdGhlIGRpcmVjdG9yeSB3aGljaCB0aGUgaWdub3JlIGZpbGUgaXMgaW5cblx0XHRjb25zdCBkaXJVcmkgPSBkaXJuYW1lKGlnbm9yZUZpbGVSZXNvdXJjZSk7XG5cdFx0Y29uc3QgaWdub3JlVHJlZSA9IHRoaXMuaWdub3JlVHJlZXNQZXJSb290LmdldChyb290KTtcblx0XHRpZiAoIWlnbm9yZVRyZWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBEb24ndCBwcm9jZXNzIGEgZGlyZWN0b3J5IGlmIHdlIGFscmVhZHkgaGF2ZSBpdCBpbiB0aGUgdHJlZVxuXHRcdGlmICghdXBkYXRlICYmIGlnbm9yZVRyZWUuaGFzKGRpclVyaSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gTWF5YmUgd2UgbmVlZCBhIGNhbmNlbGxhdGlvbiB0b2tlbiBoZXJlIGluIGNhc2UgaXQncyBzdXBlciBsb25nP1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGlnbm9yZUZpbGVSZXNvdXJjZSk7XG5cblx0XHQvLyBJZiBpdCdzIGp1c3QgYW4gdXBkYXRlIHdlIHVwZGF0ZSB0aGUgY29udGVudHMga2VlcGluZyBhbGwgcmVmZXJlbmNlcyB0aGUgc2FtZVxuXHRcdGlmICh1cGRhdGUpIHtcblx0XHRcdGNvbnN0IGlnbm9yZUZpbGUgPSBpZ25vcmVUcmVlLmdldChkaXJVcmkpO1xuXHRcdFx0aWdub3JlRmlsZT8udXBkYXRlQ29udGVudHMoY29udGVudC52YWx1ZS50b1N0cmluZygpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gT3RoZXJ3aXNlIHdlIGNyZWF0ZSBhIG5ldyBpZ25vcmVmaWxlIGFuZCBhZGQgaXQgdG8gdGhlIHRyZWVcblx0XHRcdGNvbnN0IGlnbm9yZVBhcmVudCA9IGlnbm9yZVRyZWUuZmluZFN1YnN0cihkaXJVcmkpO1xuXHRcdFx0Y29uc3QgaWdub3JlRmlsZSA9IG5ldyBJZ25vcmVGaWxlKGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSwgZGlyVXJpLnBhdGgsIGlnbm9yZVBhcmVudCk7XG5cdFx0XHRpZ25vcmVUcmVlLnNldChkaXJVcmksIGlnbm9yZUZpbGUpO1xuXHRcdFx0Ly8gSWYgd2UgaGF2ZW4ndCBzZWVuIHRoaXMgcmVzb3VyY2UgYmVmb3JlIHRoZW4gd2UgbmVlZCB0byBhZGQgaXQgdG8gdGhlIGxpc3Qgb2YgcmVzb3VyY2VzIHdlJ3JlIHRyYWNraW5nXG5cdFx0XHRpZiAoIXRoaXMuaWdub3JlRmlsZVJlc291cmNlc1BlclJvb3QuZ2V0KHJvb3QpPy5oYXMoaWdub3JlRmlsZVJlc291cmNlKSkge1xuXHRcdFx0XHR0aGlzLmlnbm9yZUZpbGVSZXNvdXJjZXNQZXJSb290LmdldChyb290KT8uYWRkKGlnbm9yZUZpbGVSZXNvdXJjZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTm90aWZ5IHRoZSBleHBsb3JlciBvZiB0aGUgY2hhbmdlIHNvIHdlIG1heSBpZ25vcmUgdGhlc2UgZmlsZXNcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cblxuXHRmaWx0ZXIoc3RhdDogRXhwbG9yZXJJdGVtLCBwYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IGJvb2xlYW4ge1xuXHRcdC8vIEFkZCBuZXdseSB2aXNpdGVkIC5naXRpZ25vcmUgZmlsZXMgdG8gdGhlIGlnbm9yZSB0cmVlXG5cdFx0aWYgKHN0YXQubmFtZSA9PT0gJy5naXRpZ25vcmUnICYmIHRoaXMuaWdub3JlVHJlZXNQZXJSb290LmhhcyhzdGF0LnJvb3QucmVzb3VyY2UudG9TdHJpbmcoKSkpIHtcblx0XHRcdHRoaXMucHJvY2Vzc0lnbm9yZUZpbGUoc3RhdC5yb290LnJlc291cmNlLnRvU3RyaW5nKCksIHN0YXQucmVzb3VyY2UsIGZhbHNlKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmlzVmlzaWJsZShzdGF0LCBwYXJlbnRWaXNpYmlsaXR5KTtcblx0fVxuXG5cdHByaXZhdGUgaXNWaXNpYmxlKHN0YXQ6IEV4cGxvcmVySXRlbSwgcGFyZW50VmlzaWJpbGl0eTogVHJlZVZpc2liaWxpdHkpOiBib29sZWFuIHtcblx0XHRzdGF0LmlzRXhjbHVkZWQgPSBmYWxzZTtcblx0XHRpZiAocGFyZW50VmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuSGlkZGVuKSB7XG5cdFx0XHRzdGF0LmlzRXhjbHVkZWQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHBsb3JlclNlcnZpY2UuZ2V0RWRpdGFibGVEYXRhKHN0YXQpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gYWx3YXlzIHZpc2libGVcblx0XHR9XG5cblx0XHQvLyBIaWRlIHRob3NlIHRoYXQgbWF0Y2ggSGlkZGVuIFBhdHRlcm5zXG5cdFx0Y29uc3QgY2FjaGVkID0gdGhpcy5oaWRkZW5FeHByZXNzaW9uUGVyUm9vdC5nZXQoc3RhdC5yb290LnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IGdsb2JNYXRjaCA9IGNhY2hlZD8ucGFyc2VkKHBhdGgucmVsYXRpdmUoc3RhdC5yb290LnJlc291cmNlLnBhdGgsIHN0YXQucmVzb3VyY2UucGF0aCksIHN0YXQubmFtZSwgbmFtZSA9PiAhIShzdGF0LnBhcmVudCAmJiBzdGF0LnBhcmVudC5nZXRDaGlsZChuYW1lKSkpO1xuXHRcdC8vIFNtYWxsIG9wdGltaXphdGlvbiB0byBvbmx5IHJ1biBpc0hpZGRlblJlc291cmNlICh0cmF2ZXJzZSBnaXRJZ25vcmUpIGlmIHRoZSBnbG9iTWF0Y2ggZnJvbSBmaWxlRXhjbHVkZSByZXR1cm5lZCBub3RoaW5nXG5cdFx0Y29uc3QgaXNIaWRkZW5SZXNvdXJjZSA9ICEhZ2xvYk1hdGNoID8gdHJ1ZSA6IHRoaXMuaXNJZ25vcmVkKHN0YXQucmVzb3VyY2UsIHN0YXQucm9vdC5yZXNvdXJjZSwgc3RhdC5pc0RpcmVjdG9yeSk7XG5cdFx0aWYgKGlzSGlkZGVuUmVzb3VyY2UgfHwgc3RhdC5wYXJlbnQ/LmlzRXhjbHVkZWQpIHtcblx0XHRcdHN0YXQuaXNFeGNsdWRlZCA9IHRydWU7XG5cdFx0XHRjb25zdCBlZGl0b3JzID0gdGhpcy5lZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JzO1xuXHRcdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9ycy5maW5kKGUgPT4gZS5yZXNvdXJjZSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbE9yUGFyZW50KGUucmVzb3VyY2UsIHN0YXQucmVzb3VyY2UpKTtcblx0XHRcdGlmIChlZGl0b3IgJiYgc3RhdC5yb290ID09PSB0aGlzLmV4cGxvcmVyU2VydmljZS5maW5kQ2xvc2VzdFJvb3Qoc3RhdC5yZXNvdXJjZSkpIHtcblx0XHRcdFx0dGhpcy5lZGl0b3JzQWZmZWN0aW5nRmlsdGVyLmFkZChlZGl0b3IpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gU2hvdyBhbGwgb3BlbmVkIGZpbGVzIGFuZCB0aGVpciBwYXJlbnRzXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTsgLy8gaGlkZGVuIHRocm91Z2ggcGF0dGVyblxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aXNJZ25vcmVkKHJlc291cmNlOiBVUkksIHJvb3RSZXNvdXJjZTogVVJJLCBpc0RpcmVjdG9yeTogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGlnbm9yZUZpbGUgPSB0aGlzLmlnbm9yZVRyZWVzUGVyUm9vdC5nZXQocm9vdFJlc291cmNlLnRvU3RyaW5nKCkpPy5maW5kU3Vic3RyKHJlc291cmNlKTtcblx0XHRjb25zdCBpc0luY2x1ZGVkSW5UcmF2ZXJzYWwgPSBpZ25vcmVGaWxlPy5pc1BhdGhJbmNsdWRlZEluVHJhdmVyc2FsKHJlc291cmNlLnBhdGgsIGlzRGlyZWN0b3J5KTtcblxuXHRcdC8vIERvaW5nICF1bmRlZmluZWQgcmV0dXJucyB0cnVlIGFuZCB3ZSB3YW50IGl0IHRvIGJlIGZhbHNlIHdoZW4gdW5kZWZpbmVkIGJlY2F1c2UgdGhhdCBtZWFucyBpdCdzIG5vdCBpbmNsdWRlZCBpbiB0aGUgaWdub3JlIGZpbGVcblx0XHRyZXR1cm4gaXNJbmNsdWRlZEluVHJhdmVyc2FsID09PSB1bmRlZmluZWQgPyBmYWxzZSA6ICFpc0luY2x1ZGVkSW5UcmF2ZXJzYWw7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbi8vIEV4cGxvcmVyIFNvcnRlclxuZXhwb3J0IGNsYXNzIEZpbGVTb3J0ZXIgaW1wbGVtZW50cyBJVHJlZVNvcnRlcjxFeHBsb3Jlckl0ZW0+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4cGxvcmVyU2VydmljZTogSUV4cGxvcmVyU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHsgfVxuXG5cdGNvbXBhcmUoc3RhdEE6IEV4cGxvcmVySXRlbSwgc3RhdEI6IEV4cGxvcmVySXRlbSk6IG51bWJlciB7XG5cdFx0Ly8gRG8gbm90IHNvcnQgcm9vdHNcblx0XHRpZiAoc3RhdEEuaXNSb290KSB7XG5cdFx0XHRpZiAoc3RhdEIuaXNSb290KSB7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUEgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihzdGF0QS5yZXNvdXJjZSk7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihzdGF0Qi5yZXNvdXJjZSk7XG5cdFx0XHRcdHJldHVybiB3b3Jrc3BhY2VBICYmIHdvcmtzcGFjZUIgPyAod29ya3NwYWNlQS5pbmRleCAtIHdvcmtzcGFjZUIuaW5kZXgpIDogLTE7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cblx0XHRpZiAoc3RhdEIuaXNSb290KSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cblx0XHRjb25zdCBzb3J0T3JkZXIgPSB0aGlzLmV4cGxvcmVyU2VydmljZS5zb3J0T3JkZXJDb25maWd1cmF0aW9uLnNvcnRPcmRlcjtcblx0XHRjb25zdCBsZXhpY29ncmFwaGljT3B0aW9ucyA9IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLnNvcnRPcmRlckNvbmZpZ3VyYXRpb24ubGV4aWNvZ3JhcGhpY09wdGlvbnM7XG5cdFx0Y29uc3QgcmV2ZXJzZSA9IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLnNvcnRPcmRlckNvbmZpZ3VyYXRpb24ucmV2ZXJzZTtcblx0XHRpZiAocmV2ZXJzZSkge1xuXHRcdFx0W3N0YXRBLCBzdGF0Ql0gPSBbc3RhdEIsIHN0YXRBXTtcblx0XHR9XG5cblx0XHRsZXQgY29tcGFyZUZpbGVOYW1lcztcblx0XHRsZXQgY29tcGFyZUZpbGVFeHRlbnNpb25zO1xuXHRcdHN3aXRjaCAobGV4aWNvZ3JhcGhpY09wdGlvbnMpIHtcblx0XHRcdGNhc2UgJ3VwcGVyJzpcblx0XHRcdFx0Y29tcGFyZUZpbGVOYW1lcyA9IGNvbXBhcmVGaWxlTmFtZXNVcHBlcjtcblx0XHRcdFx0Y29tcGFyZUZpbGVFeHRlbnNpb25zID0gY29tcGFyZUZpbGVFeHRlbnNpb25zVXBwZXI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnbG93ZXInOlxuXHRcdFx0XHRjb21wYXJlRmlsZU5hbWVzID0gY29tcGFyZUZpbGVOYW1lc0xvd2VyO1xuXHRcdFx0XHRjb21wYXJlRmlsZUV4dGVuc2lvbnMgPSBjb21wYXJlRmlsZUV4dGVuc2lvbnNMb3dlcjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICd1bmljb2RlJzpcblx0XHRcdFx0Y29tcGFyZUZpbGVOYW1lcyA9IGNvbXBhcmVGaWxlTmFtZXNVbmljb2RlO1xuXHRcdFx0XHRjb21wYXJlRmlsZUV4dGVuc2lvbnMgPSBjb21wYXJlRmlsZUV4dGVuc2lvbnNVbmljb2RlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdC8vICdkZWZhdWx0J1xuXHRcdFx0XHRjb21wYXJlRmlsZU5hbWVzID0gY29tcGFyZUZpbGVOYW1lc0RlZmF1bHQ7XG5cdFx0XHRcdGNvbXBhcmVGaWxlRXh0ZW5zaW9ucyA9IGNvbXBhcmVGaWxlRXh0ZW5zaW9uc0RlZmF1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gU29ydCBEaXJlY3Rvcmllc1xuXHRcdHN3aXRjaCAoc29ydE9yZGVyKSB7XG5cdFx0XHRjYXNlICd0eXBlJzpcblx0XHRcdFx0aWYgKHN0YXRBLmlzRGlyZWN0b3J5ICYmICFzdGF0Qi5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzdGF0Qi5pc0RpcmVjdG9yeSAmJiAhc3RhdEEuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzdGF0QS5pc0RpcmVjdG9yeSAmJiBzdGF0Qi5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzKHN0YXRBLm5hbWUsIHN0YXRCLm5hbWUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2ZpbGVzRmlyc3QnOlxuXHRcdFx0XHRpZiAoc3RhdEEuaXNEaXJlY3RvcnkgJiYgIXN0YXRCLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc3RhdEIuaXNEaXJlY3RvcnkgJiYgIXN0YXRBLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2ZvbGRlcnNOZXN0c0ZpbGVzJzpcblx0XHRcdFx0aWYgKHN0YXRBLmlzRGlyZWN0b3J5ICYmICFzdGF0Qi5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzdGF0Qi5pc0RpcmVjdG9yeSAmJiAhc3RhdEEuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChzdGF0QS5oYXNOZXN0cyAmJiAhc3RhdEIuaGFzTmVzdHMpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc3RhdEIuaGFzTmVzdHMgJiYgIXN0YXRBLmhhc05lc3RzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Y2FzZSAnbWl4ZWQnOlxuXHRcdFx0XHRicmVhazsgLy8gbm90IHNvcnRpbmcgd2hlbiBcIm1peGVkXCIgaXMgb25cblxuXHRcdFx0ZGVmYXVsdDogLyogJ2RlZmF1bHQnLCAnbW9kaWZpZWQnICovXG5cdFx0XHRcdGlmIChzdGF0QS5pc0RpcmVjdG9yeSAmJiAhc3RhdEIuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc3RhdEIuaXNEaXJlY3RvcnkgJiYgIXN0YXRBLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHQvLyBTb3J0IEZpbGVzXG5cdFx0c3dpdGNoIChzb3J0T3JkZXIpIHtcblx0XHRcdGNhc2UgJ3R5cGUnOlxuXHRcdFx0XHRyZXR1cm4gY29tcGFyZUZpbGVFeHRlbnNpb25zKHN0YXRBLm5hbWUsIHN0YXRCLm5hbWUpO1xuXG5cdFx0XHRjYXNlICdtb2RpZmllZCc6XG5cdFx0XHRcdGlmIChzdGF0QS5tdGltZSAhPT0gc3RhdEIubXRpbWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gKHN0YXRBLm10aW1lICYmIHN0YXRCLm10aW1lICYmIHN0YXRBLm10aW1lIDwgc3RhdEIubXRpbWUpID8gMSA6IC0xO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGNvbXBhcmVGaWxlTmFtZXMoc3RhdEEubmFtZSwgc3RhdEIubmFtZSk7XG5cblx0XHRcdGRlZmF1bHQ6IC8qICdkZWZhdWx0JywgJ21peGVkJywgJ2ZpbGVzRmlyc3QnICovXG5cdFx0XHRcdHJldHVybiBjb21wYXJlRmlsZU5hbWVzKHN0YXRBLm5hbWUsIHN0YXRCLm5hbWUpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZURyYWdBbmREcm9wIGltcGxlbWVudHMgSVRyZWVEcmFnQW5kRHJvcDxFeHBsb3Jlckl0ZW0+IHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ09ORklSTV9ETkRfU0VUVElOR19LRVkgPSAnZXhwbG9yZXIuY29uZmlybURyYWdBbmREcm9wJztcblxuXHRwcml2YXRlIGNvbXByZXNzZWREcmFnT3ZlckVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbXByZXNzZWREcm9wVGFyZ2V0RGlzcG9zYWJsZTogSURpc3Bvc2FibGUgPSBEaXNwb3NhYmxlLk5vbmU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBkcm9wRW5hYmxlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgaXNDb2xsYXBzZWQ6IChpdGVtOiBFeHBsb3Jlckl0ZW0pID0+IGJvb2xlYW4sXG5cdFx0QElFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSBleHBsb3JlclNlcnZpY2U6IElFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VFZGl0aW5nU2VydmljZSBwcml2YXRlIHdvcmtzcGFjZUVkaXRpbmdTZXJ2aWNlOiBJV29ya3NwYWNlRWRpdGluZ1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgdXBkYXRlRHJvcEVuYWJsZW1lbnQgPSAoZTogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0aWYgKCFlIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2V4cGxvcmVyLmVuYWJsZURyYWdBbmREcm9wJykpIHtcblx0XHRcdFx0dGhpcy5kcm9wRW5hYmxlZCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2V4cGxvcmVyLmVuYWJsZURyYWdBbmREcm9wJyk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR1cGRhdGVEcm9wRW5hYmxlbWVudCh1bmRlZmluZWQpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdXBkYXRlRHJvcEVuYWJsZW1lbnQoZSkpKTtcblx0fVxuXG5cdG9uRHJhZ092ZXIoZGF0YTogSURyYWdBbmREcm9wRGF0YSwgdGFyZ2V0OiBFeHBsb3Jlckl0ZW0gfCB1bmRlZmluZWQsIHRhcmdldEluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQsIHRhcmdldFNlY3RvcjogTGlzdFZpZXdUYXJnZXRTZWN0b3IgfCB1bmRlZmluZWQsIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IGJvb2xlYW4gfCBJVHJlZURyYWdPdmVyUmVhY3Rpb24ge1xuXHRcdGlmICghdGhpcy5kcm9wRW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIENvbXByZXNzZWQgZm9sZGVyc1xuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdGNvbnN0IGNvbXByZXNzZWRUYXJnZXQgPSBGaWxlRHJhZ0FuZERyb3AuZ2V0Q29tcHJlc3NlZFN0YXRGcm9tRHJhZ0V2ZW50KHRhcmdldCwgb3JpZ2luYWxFdmVudCk7XG5cblx0XHRcdGlmIChjb21wcmVzc2VkVGFyZ2V0KSB7XG5cdFx0XHRcdGNvbnN0IGljb25MYWJlbE5hbWUgPSBnZXRJY29uTGFiZWxOYW1lRnJvbUhUTUxFbGVtZW50KG9yaWdpbmFsRXZlbnQudGFyZ2V0KTtcblxuXHRcdFx0XHRpZiAoaWNvbkxhYmVsTmFtZSAmJiBpY29uTGFiZWxOYW1lLmluZGV4IDwgaWNvbkxhYmVsTmFtZS5jb3VudCAtIDEpIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmhhbmRsZURyYWdPdmVyKGRhdGEsIGNvbXByZXNzZWRUYXJnZXQsIHRhcmdldEluZGV4LCB0YXJnZXRTZWN0b3IsIG9yaWdpbmFsRXZlbnQpO1xuXG5cdFx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0aWYgKGljb25MYWJlbE5hbWUuZWxlbWVudCAhPT0gdGhpcy5jb21wcmVzc2VkRHJhZ092ZXJFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY29tcHJlc3NlZERyYWdPdmVyRWxlbWVudCA9IGljb25MYWJlbE5hbWUuZWxlbWVudDtcblx0XHRcdFx0XHRcdFx0dGhpcy5jb21wcmVzc2VkRHJvcFRhcmdldERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHR0aGlzLmNvbXByZXNzZWREcm9wVGFyZ2V0RGlzcG9zYWJsZSA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWNvbkxhYmVsTmFtZS5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoJ2Ryb3AtdGFyZ2V0Jyk7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5jb21wcmVzc2VkRHJhZ092ZXJFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHRpY29uTGFiZWxOYW1lLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnZHJvcC10YXJnZXQnKTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIHR5cGVvZiByZXN1bHQgPT09ICdib29sZWFuJyA/IHJlc3VsdCA6IHsgLi4ucmVzdWx0LCBmZWVkYmFjazogW10gfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLmNvbXByZXNzZWREcm9wVGFyZ2V0RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5jb21wcmVzc2VkRHJvcFRhcmdldERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdHJldHVybiB0aGlzLmhhbmRsZURyYWdPdmVyKGRhdGEsIHRhcmdldCwgdGFyZ2V0SW5kZXgsIHRhcmdldFNlY3Rvciwgb3JpZ2luYWxFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZURyYWdPdmVyKGRhdGE6IElEcmFnQW5kRHJvcERhdGEsIHRhcmdldDogRXhwbG9yZXJJdGVtIHwgdW5kZWZpbmVkLCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0YXJnZXRTZWN0b3I6IExpc3RWaWV3VGFyZ2V0U2VjdG9yIHwgdW5kZWZpbmVkLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiBib29sZWFuIHwgSVRyZWVEcmFnT3ZlclJlYWN0aW9uIHtcblx0XHRjb25zdCBpc0NvcHkgPSBvcmlnaW5hbEV2ZW50ICYmICgob3JpZ2luYWxFdmVudC5jdHJsS2V5ICYmICFpc01hY2ludG9zaCkgfHwgKG9yaWdpbmFsRXZlbnQuYWx0S2V5ICYmIGlzTWFjaW50b3NoKSk7XG5cdFx0Y29uc3QgaXNOYXRpdmUgPSBkYXRhIGluc3RhbmNlb2YgTmF0aXZlRHJhZ0FuZERyb3BEYXRhO1xuXHRcdGNvbnN0IGVmZmVjdFR5cGUgPSAoaXNOYXRpdmUgfHwgaXNDb3B5KSA/IExpc3REcmFnT3ZlckVmZmVjdFR5cGUuQ29weSA6IExpc3REcmFnT3ZlckVmZmVjdFR5cGUuTW92ZTtcblx0XHRjb25zdCBlZmZlY3QgPSB7IHR5cGU6IGVmZmVjdFR5cGUsIHBvc2l0aW9uOiBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5PdmVyIH07XG5cblx0XHQvLyBOYXRpdmUgRE5EXG5cdFx0aWYgKGlzTmF0aXZlKSB7XG5cdFx0XHRpZiAoIWNvbnRhaW5zRHJhZ1R5cGUob3JpZ2luYWxFdmVudCwgRGF0YVRyYW5zZmVycy5GSUxFUywgQ29kZURhdGFUcmFuc2ZlcnMuRklMRVMsIERhdGFUcmFuc2ZlcnMuUkVTT1VSQ0VTKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXItVHJlZSBETkRcblx0XHRlbHNlIGlmIChkYXRhIGluc3RhbmNlb2YgRXh0ZXJuYWxFbGVtZW50c0RyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIEluLUV4cGxvcmVyIERORFxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3QgaXRlbXMgPSBGaWxlRHJhZ0FuZERyb3AuZ2V0U3RhdHNGcm9tRHJhZ0FuZERyb3BEYXRhKGRhdGEgYXMgRWxlbWVudHNEcmFnQW5kRHJvcERhdGE8RXhwbG9yZXJJdGVtLCBFeHBsb3Jlckl0ZW1bXT4pO1xuXHRcdFx0Y29uc3QgaXNSb290c1Jlb3JkZXIgPSBpdGVtcy5ldmVyeShpdGVtID0+IGl0ZW0uaXNSb290KTtcblxuXHRcdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdFx0Ly8gRHJvcHBpbmcgb250byB0aGUgZW1wdHkgYXJlYS4gRG8gbm90IGFjY2VwdCBpZiBpdGVtcyBkcmFnZ2VkIGFyZSBhbHJlYWR5XG5cdFx0XHRcdC8vIGNoaWxkcmVuIG9mIHRoZSByb290IHVubGVzcyB3ZSBhcmUgY29weWluZyB0aGUgZmlsZVxuXHRcdFx0XHRpZiAoIWlzQ29weSAmJiBpdGVtcy5ldmVyeShpID0+ICEhaS5wYXJlbnQgJiYgaS5wYXJlbnQuaXNSb290KSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHJvb3QgaXMgYWRkZWQgYWZ0ZXIgbGFzdCByb290IGZvbGRlciB3aGVuIGhvdmVyaW5nIG9uIGVtcHR5IGJhY2tncm91bmRcblx0XHRcdFx0aWYgKGlzUm9vdHNSZW9yZGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBlZmZlY3Q6IHsgdHlwZTogTGlzdERyYWdPdmVyRWZmZWN0VHlwZS5Nb3ZlLCBwb3NpdGlvbjogTGlzdERyYWdPdmVyRWZmZWN0UG9zaXRpb24uQWZ0ZXIgfSB9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBidWJibGU6IFRyZWVEcmFnT3ZlckJ1YmJsZS5Eb3duLCBlZmZlY3QsIGF1dG9FeHBhbmQ6IGZhbHNlIH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICghQXJyYXkuaXNBcnJheShpdGVtcykpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWlzQ29weSAmJiBpdGVtcy5ldmVyeSgoc291cmNlKSA9PiBzb3VyY2UuaXNSZWFkb25seSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBDYW5ub3QgbW92ZSByZWFkb25seSBpdGVtcyB1bmxlc3Mgd2UgY29weVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXRlbXMuc29tZSgoc291cmNlKSA9PiB7XG5cdFx0XHRcdGlmIChzb3VyY2UuaXNSb290KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBSb290IGZvbGRlcnMgYXJlIGhhbmRsZWQgc2VwZXJhdGVseVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHNvdXJjZS5yZXNvdXJjZSwgdGFyZ2V0LnJlc291cmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlOyAvLyBDYW4gbm90IG1vdmUgYW55dGhpbmcgb250byBpdHNlbGYgZXhjcGV0IGZvciByb290IGZvbGRlcnNcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghaXNDb3B5ICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGRpcm5hbWUoc291cmNlLnJlc291cmNlKSwgdGFyZ2V0LnJlc291cmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlOyAvLyBDYW4gbm90IG1vdmUgYSBmaWxlIHRvIHRoZSBzYW1lIHBhcmVudCB1bmxlc3Mgd2UgY29weVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQodGFyZ2V0LnJlc291cmNlLCBzb3VyY2UucmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIENhbiBub3QgbW92ZSBhIHBhcmVudCBmb2xkZXIgaW50byBvbmUgb2YgaXRzIGNoaWxkcmVuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9KSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlb3JkZXJpbmcgcm9vdHNcblx0XHRcdGlmIChpc1Jvb3RzUmVvcmRlcikge1xuXHRcdFx0XHRpZiAoIXRhcmdldC5pc1Jvb3QpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgZHJvcEVmZmVjdFBvc2l0aW9uOiBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0c3dpdGNoICh0YXJnZXRTZWN0b3IpIHtcblx0XHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLlRPUDpcblx0XHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkNFTlRFUl9UT1A6XG5cdFx0XHRcdFx0XHRkcm9wRWZmZWN0UG9zaXRpb24gPSBMaXN0RHJhZ092ZXJFZmZlY3RQb3NpdGlvbi5CZWZvcmU7IGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgTGlzdFZpZXdUYXJnZXRTZWN0b3IuQ0VOVEVSX0JPVFRPTTpcblx0XHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkJPVFRPTTpcblx0XHRcdFx0XHRcdGRyb3BFZmZlY3RQb3NpdGlvbiA9IExpc3REcmFnT3ZlckVmZmVjdFBvc2l0aW9uLkFmdGVyOyBicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHQ6IHRydWUsIGVmZmVjdDogeyB0eXBlOiBMaXN0RHJhZ092ZXJFZmZlY3RUeXBlLk1vdmUsIHBvc2l0aW9uOiBkcm9wRWZmZWN0UG9zaXRpb24gfSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFsbCAodGFyZ2V0ID0gbW9kZWwpXG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHJldHVybiB7IGFjY2VwdDogdHJ1ZSwgYnViYmxlOiBUcmVlRHJhZ092ZXJCdWJibGUuRG93biwgZWZmZWN0IH07XG5cdFx0fVxuXG5cdFx0Ly8gQWxsICh0YXJnZXQgPSBmaWxlL2ZvbGRlcilcblx0XHRlbHNlIHtcblx0XHRcdGlmICh0YXJnZXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0aWYgKHRhcmdldC5pc1JlYWRvbmx5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBidWJibGU6IFRyZWVEcmFnT3ZlckJ1YmJsZS5Eb3duLCBlZmZlY3QsIGF1dG9FeHBhbmQ6IHRydWUgfTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5ldmVyeShmb2xkZXIgPT4gZm9sZGVyLnVyaS50b1N0cmluZygpICE9PSB0YXJnZXQucmVzb3VyY2UudG9TdHJpbmcoKSkpIHtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0OiB0cnVlLCBidWJibGU6IFRyZWVEcmFnT3ZlckJ1YmJsZS5VcCwgZWZmZWN0IH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0RHJhZ1VSSShlbGVtZW50OiBFeHBsb3Jlckl0ZW0pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAodGhpcy5leHBsb3JlclNlcnZpY2UuaXNFZGl0YWJsZShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVsZW1lbnQucmVzb3VyY2UudG9TdHJpbmcoKTtcblx0fVxuXG5cdGdldERyYWdMYWJlbChlbGVtZW50czogRXhwbG9yZXJJdGVtW10sIG9yaWdpbmFsRXZlbnQ6IERyYWdFdmVudCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3Qgc3RhdCA9IEZpbGVEcmFnQW5kRHJvcC5nZXRDb21wcmVzc2VkU3RhdEZyb21EcmFnRXZlbnQoZWxlbWVudHNbMF0sIG9yaWdpbmFsRXZlbnQpO1xuXHRcdFx0cmV0dXJuIHN0YXQubmFtZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gU3RyaW5nKGVsZW1lbnRzLmxlbmd0aCk7XG5cdH1cblxuXHRvbkRyYWdTdGFydChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCBvcmlnaW5hbEV2ZW50OiBEcmFnRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBpdGVtcyA9IEZpbGVEcmFnQW5kRHJvcC5nZXRTdGF0c0Zyb21EcmFnQW5kRHJvcERhdGEoZGF0YSBhcyBFbGVtZW50c0RyYWdBbmREcm9wRGF0YTxFeHBsb3Jlckl0ZW0sIEV4cGxvcmVySXRlbVtdPiwgb3JpZ2luYWxFdmVudCk7XG5cdFx0aWYgKGl0ZW1zICYmIGl0ZW1zLmxlbmd0aCAmJiBvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlcikge1xuXHRcdFx0Ly8gQXBwbHkgc29tZSBkYXRhdHJhbnNmZXIgdHlwZXMgdG8gYWxsb3cgZm9yIGRyYWdnaW5nIHRoZSBlbGVtZW50IG91dHNpZGUgb2YgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3IsIGl0ZW1zLCBvcmlnaW5hbEV2ZW50KSk7XG5cblx0XHRcdC8vIFRoZSBvbmx5IGN1c3RvbSBkYXRhIHRyYW5zZmVyIHdlIHNldCBmcm9tIHRoZSBleHBsb3JlciBpcyBhIGZpbGUgdHJhbnNmZXJcblx0XHRcdC8vIHRvIGJlIGFibGUgdG8gRE5EIGJldHdlZW4gbXVsdGlwbGUgY29kZSBmaWxlIGV4cGxvcmVycyBhY3Jvc3Mgd2luZG93c1xuXHRcdFx0Y29uc3QgZmlsZVJlc291cmNlcyA9IGl0ZW1zLmZpbHRlcihzID0+IHMucmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpLm1hcChyID0+IHIucmVzb3VyY2UuZnNQYXRoKTtcblx0XHRcdGlmIChmaWxlUmVzb3VyY2VzLmxlbmd0aCkge1xuXHRcdFx0XHRvcmlnaW5hbEV2ZW50LmRhdGFUcmFuc2Zlci5zZXREYXRhKENvZGVEYXRhVHJhbnNmZXJzLkZJTEVTLCBKU09OLnN0cmluZ2lmeShmaWxlUmVzb3VyY2VzKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZHJvcChkYXRhOiBJRHJhZ0FuZERyb3BEYXRhLCB0YXJnZXQ6IEV4cGxvcmVySXRlbSB8IHVuZGVmaW5lZCwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5jb21wcmVzc2VkRHJvcFRhcmdldERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gRmluZCBjb21wcmVzc2VkIHRhcmdldFxuXHRcdGlmICh0YXJnZXQpIHtcblx0XHRcdGNvbnN0IGNvbXByZXNzZWRUYXJnZXQgPSBGaWxlRHJhZ0FuZERyb3AuZ2V0Q29tcHJlc3NlZFN0YXRGcm9tRHJhZ0V2ZW50KHRhcmdldCwgb3JpZ2luYWxFdmVudCk7XG5cblx0XHRcdGlmIChjb21wcmVzc2VkVGFyZ2V0KSB7XG5cdFx0XHRcdHRhcmdldCA9IGNvbXByZXNzZWRUYXJnZXQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmluZCBwYXJlbnQgdG8gYWRkIHRvXG5cdFx0aWYgKCF0YXJnZXQpIHtcblx0XHRcdHRhcmdldCA9IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLnJvb3RzW3RoaXMuZXhwbG9yZXJTZXJ2aWNlLnJvb3RzLmxlbmd0aCAtIDFdO1xuXHRcdFx0dGFyZ2V0U2VjdG9yID0gTGlzdFZpZXdUYXJnZXRTZWN0b3IuQk9UVE9NO1xuXHRcdH1cblx0XHRpZiAoIXRhcmdldC5pc0RpcmVjdG9yeSAmJiB0YXJnZXQucGFyZW50KSB7XG5cdFx0XHR0YXJnZXQgPSB0YXJnZXQucGFyZW50O1xuXHRcdH1cblx0XHRpZiAodGFyZ2V0LmlzUmVhZG9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmVzb2x2ZWRUYXJnZXQgPSB0YXJnZXQ7XG5cdFx0aWYgKCFyZXNvbHZlZFRhcmdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cblx0XHRcdC8vIEV4dGVybmFsIGZpbGUgRE5EIChJbXBvcnQvVXBsb2FkIGZpbGUpXG5cdFx0XHRpZiAoZGF0YSBpbnN0YW5jZW9mIE5hdGl2ZURyYWdBbmREcm9wRGF0YSkge1xuXHRcdFx0XHQvLyBVc2UgbG9jYWwgZmlsZSBpbXBvcnQgd2hlbiBzdXBwb3J0ZWRcblx0XHRcdFx0aWYgKCFpc1dlYiB8fCAoaXNUZW1wb3JhcnlXb3Jrc3BhY2UodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSkgJiYgV2ViRmlsZVN5c3RlbUFjY2Vzcy5zdXBwb3J0ZWQobWFpbldpbmRvdykpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZUltcG9ydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZXJuYWxGaWxlSW1wb3J0KTtcblx0XHRcdFx0XHRhd2FpdCBmaWxlSW1wb3J0LmltcG9ydChyZXNvbHZlZFRhcmdldCwgb3JpZ2luYWxFdmVudCwgbWFpbldpbmRvdyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlIGZhbGxiYWNrIHRvIGJyb3dzZXIgYmFzZWQgZmlsZSB1cGxvYWRcblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgYnJvd3NlclVwbG9hZCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQnJvd3NlckZpbGVVcGxvYWQpO1xuXHRcdFx0XHRcdGF3YWl0IGJyb3dzZXJVcGxvYWQudXBsb2FkKHRhcmdldCwgb3JpZ2luYWxFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSW4tRXhwbG9yZXIgRE5EIChNb3ZlL0NvcHkgZmlsZSlcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmhhbmRsZUV4cGxvcmVyRHJvcChkYXRhIGFzIEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhPEV4cGxvcmVySXRlbSwgRXhwbG9yZXJJdGVtW10+LCByZXNvbHZlZFRhcmdldCwgdGFyZ2V0SW5kZXgsIHRhcmdldFNlY3Rvciwgb3JpZ2luYWxFdmVudCk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMuZGlhbG9nU2VydmljZS5lcnJvcih0b0Vycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlRXhwbG9yZXJEcm9wKGRhdGE6IEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhPEV4cGxvcmVySXRlbSwgRXhwbG9yZXJJdGVtW10+LCB0YXJnZXQ6IEV4cGxvcmVySXRlbSwgdGFyZ2V0SW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCwgb3JpZ2luYWxFdmVudDogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZWxlbWVudHNEYXRhID0gRmlsZURyYWdBbmREcm9wLmdldFN0YXRzRnJvbURyYWdBbmREcm9wRGF0YShkYXRhKTtcblx0XHRjb25zdCBkaXN0aW5jdEl0ZW1zID0gbmV3IE1hcChlbGVtZW50c0RhdGEubWFwKGVsZW1lbnQgPT4gW2VsZW1lbnQsIHRoaXMuaXNDb2xsYXBzZWQoZWxlbWVudCldKSk7XG5cblx0XHRmb3IgKGNvbnN0IFtpdGVtLCBjb2xsYXBzZWRdIG9mIGRpc3RpbmN0SXRlbXMpIHtcblx0XHRcdGlmIChjb2xsYXBzZWQpIHtcblx0XHRcdFx0Y29uc3QgbmVzdGVkQ2hpbGRyZW4gPSBpdGVtLm5lc3RlZENoaWxkcmVuO1xuXHRcdFx0XHRpZiAobmVzdGVkQ2hpbGRyZW4pIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG5lc3RlZENoaWxkcmVuKSB7XG5cdFx0XHRcdFx0XHQvLyBpZiBwYXJlbnQgaXMgY29sbGFwc2VkLCB0aGVuIHRoZSBuZXN0ZWQgY2hpbGRyZW4gaXMgY29uc2lkZXJlZCBjb2xsYXBzZWQgdG8gb3BlcmF0ZSBhcyBhIGdyb3VwXG5cdFx0XHRcdFx0XHQvLyBhbmQgc2tpcCBjb2xsYXBzZWQgc3RhdGUgY2hlY2sgc2luY2UgdGhleSdyZSBub3QgaW4gdGhlIHRyZWVcblx0XHRcdFx0XHRcdGRpc3RpbmN0SXRlbXMuc2V0KGNoaWxkLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBpdGVtcyA9IGRpc3RpbmN0UGFyZW50cyhbLi4uZGlzdGluY3RJdGVtcy5rZXlzKCldLCBzID0+IHMucmVzb3VyY2UpO1xuXHRcdGNvbnN0IGlzQ29weSA9IChvcmlnaW5hbEV2ZW50LmN0cmxLZXkgJiYgIWlzTWFjaW50b3NoKSB8fCAob3JpZ2luYWxFdmVudC5hbHRLZXkgJiYgaXNNYWNpbnRvc2gpO1xuXG5cdFx0Ly8gSGFuZGxlIGNvbmZpcm0gc2V0dGluZ1xuXHRcdGNvbnN0IGNvbmZpcm1EcmFnQW5kRHJvcCA9ICFpc0NvcHkgJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihGaWxlRHJhZ0FuZERyb3AuQ09ORklSTV9ETkRfU0VUVElOR19LRVkpO1xuXHRcdGlmIChjb25maXJtRHJhZ0FuZERyb3ApIHtcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBpdGVtcy5sZW5ndGggPiAxICYmIGl0ZW1zLmV2ZXJ5KHMgPT4gcy5pc1Jvb3QpID8gbG9jYWxpemUoJ2NvbmZpcm1Sb290c01vdmUnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBjaGFuZ2UgdGhlIG9yZGVyIG9mIG11bHRpcGxlIHJvb3QgZm9sZGVycyBpbiB5b3VyIHdvcmtzcGFjZT9cIilcblx0XHRcdFx0OiBpdGVtcy5sZW5ndGggPiAxID8gbG9jYWxpemUoJ2NvbmZpcm1NdWx0aU1vdmUnLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBtb3ZlIHRoZSBmb2xsb3dpbmcgezB9IGZpbGVzIGludG8gJ3sxfSc/XCIsIGl0ZW1zLmxlbmd0aCwgdGFyZ2V0Lm5hbWUpXG5cdFx0XHRcdFx0OiBpdGVtc1swXS5pc1Jvb3QgPyBsb2NhbGl6ZSgnY29uZmlybVJvb3RNb3ZlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gY2hhbmdlIHRoZSBvcmRlciBvZiByb290IGZvbGRlciAnezB9JyBpbiB5b3VyIHdvcmtzcGFjZT9cIiwgaXRlbXNbMF0ubmFtZSlcblx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2NvbmZpcm1Nb3ZlJywgXCJBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gbW92ZSAnezB9JyBpbnRvICd7MX0nP1wiLCBpdGVtc1swXS5uYW1lLCB0YXJnZXQubmFtZSk7XG5cdFx0XHRjb25zdCBkZXRhaWwgPSBpdGVtcy5sZW5ndGggPiAxICYmICFpdGVtcy5ldmVyeShzID0+IHMuaXNSb290KSA/IGdldEZpbGVOYW1lc01lc3NhZ2UoaXRlbXMubWFwKGkgPT4gaS5yZXNvdXJjZSkpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBjb25maXJtYXRpb24gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdGRldGFpbCxcblx0XHRcdFx0Y2hlY2tib3g6IHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2RvTm90QXNrQWdhaW4nLCBcIkRvIG5vdCBhc2sgbWUgYWdhaW5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdtb3ZlQnV0dG9uTGFiZWwnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZNb3ZlXCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFjb25maXJtYXRpb24uY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIGNvbmZpcm1hdGlvbiBjaGVja2JveFxuXHRcdFx0aWYgKGNvbmZpcm1hdGlvbi5jaGVja2JveENoZWNrZWQgPT09IHRydWUpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShGaWxlRHJhZ0FuZERyb3AuQ09ORklSTV9ETkRfU0VUVElOR19LRVksIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmRvSGFuZGxlUm9vdERyb3AoaXRlbXMuZmlsdGVyKHMgPT4gcy5pc1Jvb3QpLCB0YXJnZXQsIHRhcmdldFNlY3Rvcik7XG5cblx0XHRjb25zdCBzb3VyY2VzID0gaXRlbXMuZmlsdGVyKHMgPT4gIXMuaXNSb290KTtcblx0XHRpZiAoaXNDb3B5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb0hhbmRsZUV4cGxvcmVyRHJvcE9uQ29weShzb3VyY2VzLCB0YXJnZXQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvSGFuZGxlRXhwbG9yZXJEcm9wT25Nb3ZlKHNvdXJjZXMsIHRhcmdldCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSGFuZGxlUm9vdERyb3Aocm9vdHM6IEV4cGxvcmVySXRlbVtdLCB0YXJnZXQ6IEV4cGxvcmVySXRlbSwgdGFyZ2V0U2VjdG9yOiBMaXN0Vmlld1RhcmdldFNlY3RvciB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChyb290cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdGxldCB0YXJnZXRJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHNvdXJjZUluZGljZXM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3Qgd29ya3NwYWNlQ3JlYXRpb25EYXRhOiBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhW10gPSBbXTtcblx0XHRjb25zdCByb290c1RvTW92ZTogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdID0gW107XG5cblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZm9sZGVycy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGRhdGEgPSB7XG5cdFx0XHRcdHVyaTogZm9sZGVyc1tpbmRleF0udXJpLFxuXHRcdFx0XHRuYW1lOiBmb2xkZXJzW2luZGV4XS5uYW1lXG5cdFx0XHR9O1xuXG5cdFx0XHQvLyBJcyBjdXJyZW50IHRhcmdldFxuXHRcdFx0aWYgKHRhcmdldCBpbnN0YW5jZW9mIEV4cGxvcmVySXRlbSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChmb2xkZXJzW2luZGV4XS51cmksIHRhcmdldC5yZXNvdXJjZSkpIHtcblx0XHRcdFx0dGFyZ2V0SW5kZXggPSBpbmRleDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSXMgY3VycmVudCBzb3VyY2Vcblx0XHRcdGZvciAoY29uc3Qgcm9vdCBvZiByb290cykge1xuXHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZm9sZGVyc1tpbmRleF0udXJpLCByb290LnJlc291cmNlKSkge1xuXHRcdFx0XHRcdHNvdXJjZUluZGljZXMucHVzaChpbmRleCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHJvb3RzLmV2ZXJ5KHIgPT4gci5yZXNvdXJjZS50b1N0cmluZygpICE9PSBmb2xkZXJzW2luZGV4XS51cmkudG9TdHJpbmcoKSkpIHtcblx0XHRcdFx0d29ya3NwYWNlQ3JlYXRpb25EYXRhLnB1c2goZGF0YSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyb290c1RvTW92ZS5wdXNoKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGFyZ2V0SW5kZXggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGFyZ2V0SW5kZXggPSB3b3Jrc3BhY2VDcmVhdGlvbkRhdGEubGVuZ3RoO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzd2l0Y2ggKHRhcmdldFNlY3Rvcikge1xuXHRcdFx0XHRjYXNlIExpc3RWaWV3VGFyZ2V0U2VjdG9yLkJPVFRPTTpcblx0XHRcdFx0Y2FzZSBMaXN0Vmlld1RhcmdldFNlY3Rvci5DRU5URVJfQk9UVE9NOlxuXHRcdFx0XHRcdHRhcmdldEluZGV4Kys7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHQvLyBBZGp1c3QgdGFyZ2V0IGluZGV4IGlmIHNvdXJjZSB3YXMgbG9jYXRlZCBiZWZvcmUgdGFyZ2V0LlxuXHRcdFx0Ly8gVGhlIG1vdmUgd2lsbCBjYXVzZSB0aGUgaW5kZXggdG8gY2hhbmdlXG5cdFx0XHRmb3IgKGNvbnN0IHNvdXJjZUluZGV4IG9mIHNvdXJjZUluZGljZXMpIHtcblx0XHRcdFx0aWYgKHNvdXJjZUluZGV4IDwgdGFyZ2V0SW5kZXgpIHtcblx0XHRcdFx0XHR0YXJnZXRJbmRleC0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0d29ya3NwYWNlQ3JlYXRpb25EYXRhLnNwbGljZSh0YXJnZXRJbmRleCwgMCwgLi4ucm9vdHNUb01vdmUpO1xuXG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlRWRpdGluZ1NlcnZpY2UudXBkYXRlRm9sZGVycygwLCB3b3Jrc3BhY2VDcmVhdGlvbkRhdGEubGVuZ3RoLCB3b3Jrc3BhY2VDcmVhdGlvbkRhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0hhbmRsZUV4cGxvcmVyRHJvcE9uQ29weShzb3VyY2VzOiBFeHBsb3Jlckl0ZW1bXSwgdGFyZ2V0OiBFeHBsb3Jlckl0ZW0pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFJldXNlIGR1cGxpY2F0ZSBhY3Rpb24gd2hlbiB1c2VyIGNvcGllc1xuXHRcdGNvbnN0IGV4cGxvcmVyQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uPigpLmV4cGxvcmVyO1xuXHRcdGNvbnN0IHJlc291cmNlRmlsZUVkaXRzOiBSZXNvdXJjZUZpbGVFZGl0W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHsgcmVzb3VyY2UsIGlzRGlyZWN0b3J5IH0gb2Ygc291cmNlcykge1xuXHRcdFx0Y29uc3QgYWxsb3dPdmVyd3JpdGUgPSBleHBsb3JlckNvbmZpZy5pbmNyZW1lbnRhbE5hbWluZyA9PT0gJ2Rpc2FibGVkJztcblx0XHRcdGNvbnN0IG5ld1Jlc291cmNlID0gYXdhaXQgZmluZFZhbGlkUGFzdGVGaWxlVGFyZ2V0KHRoaXMuZXhwbG9yZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmZpbGVTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmRpYWxvZ1NlcnZpY2UsXG5cdFx0XHRcdHRhcmdldCxcblx0XHRcdFx0eyByZXNvdXJjZSwgaXNEaXJlY3RvcnksIGFsbG93T3ZlcndyaXRlIH0sXG5cdFx0XHRcdGV4cGxvcmVyQ29uZmlnLmluY3JlbWVudGFsTmFtaW5nXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCFuZXdSZXNvdXJjZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlc291cmNlRWRpdCA9IG5ldyBSZXNvdXJjZUZpbGVFZGl0KHJlc291cmNlLCBuZXdSZXNvdXJjZSwgeyBjb3B5OiB0cnVlLCBvdmVyd3JpdGU6IGFsbG93T3ZlcndyaXRlIH0pO1xuXHRcdFx0cmVzb3VyY2VGaWxlRWRpdHMucHVzaChyZXNvdXJjZUVkaXQpO1xuXHRcdH1cblx0XHRjb25zdCBsYWJlbFN1ZmZpeCA9IGdldEZpbGVPckZvbGRlckxhYmVsU3VmZml4KHNvdXJjZXMpO1xuXHRcdGF3YWl0IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLmFwcGx5QnVsa0VkaXQocmVzb3VyY2VGaWxlRWRpdHMsIHtcblx0XHRcdGNvbmZpcm1CZWZvcmVVbmRvOiBleHBsb3JlckNvbmZpZy5jb25maXJtVW5kbyA9PT0gVW5kb0NvbmZpcm1MZXZlbC5EZWZhdWx0IHx8IGV4cGxvcmVyQ29uZmlnLmNvbmZpcm1VbmRvID09PSBVbmRvQ29uZmlybUxldmVsLlZlcmJvc2UsXG5cdFx0XHR1bmRvTGFiZWw6IGxvY2FsaXplKCdjb3B5JywgXCJDb3B5IHswfVwiLCBsYWJlbFN1ZmZpeCksXG5cdFx0XHRwcm9ncmVzc0xhYmVsOiBsb2NhbGl6ZSgnY29weWluZycsIFwiQ29weWluZyB7MH1cIiwgbGFiZWxTdWZmaXgpLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZWRpdG9ycyA9IHJlc291cmNlRmlsZUVkaXRzLmZpbHRlcihlZGl0ID0+IHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBlZGl0Lm5ld1Jlc291cmNlID8gdGhpcy5leHBsb3JlclNlcnZpY2UuZmluZENsb3Nlc3QoZWRpdC5uZXdSZXNvdXJjZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gaXRlbSAmJiAhaXRlbS5pc0RpcmVjdG9yeTtcblx0XHR9KS5tYXAoZWRpdCA9PiAoeyByZXNvdXJjZTogZWRpdC5uZXdSZXNvdXJjZSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9KSk7XG5cblx0XHRhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcnMoZWRpdG9ycyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSGFuZGxlRXhwbG9yZXJEcm9wT25Nb3ZlKHNvdXJjZXM6IEV4cGxvcmVySXRlbVtdLCB0YXJnZXQ6IEV4cGxvcmVySXRlbSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gRG8gbm90IGFsbG93IG1vdmluZyByZWFkb25seSBpdGVtc1xuXHRcdGNvbnN0IHJlc291cmNlRmlsZUVkaXRzID0gc291cmNlcy5maWx0ZXIoc291cmNlID0+ICFzb3VyY2UuaXNSZWFkb25seSkubWFwKHNvdXJjZSA9PiBuZXcgUmVzb3VyY2VGaWxlRWRpdChzb3VyY2UucmVzb3VyY2UsIGpvaW5QYXRoKHRhcmdldC5yZXNvdXJjZSwgc291cmNlLm5hbWUpKSk7XG5cdFx0Y29uc3QgbGFiZWxTdWZmaXggPSBnZXRGaWxlT3JGb2xkZXJMYWJlbFN1ZmZpeChzb3VyY2VzKTtcblx0XHRjb25zdCBvcHRpb25zID0ge1xuXHRcdFx0Y29uZmlybUJlZm9yZVVuZG86IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUZpbGVzQ29uZmlndXJhdGlvbj4oKS5leHBsb3Jlci5jb25maXJtVW5kbyA9PT0gVW5kb0NvbmZpcm1MZXZlbC5WZXJib3NlLFxuXHRcdFx0dW5kb0xhYmVsOiBsb2NhbGl6ZSgnbW92ZScsIFwiTW92ZSB7MH1cIiwgbGFiZWxTdWZmaXgpLFxuXHRcdFx0cHJvZ3Jlc3NMYWJlbDogbG9jYWxpemUoJ21vdmluZycsIFwiTW92aW5nIHswfVwiLCBsYWJlbFN1ZmZpeClcblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZXhwbG9yZXJTZXJ2aWNlLmFwcGx5QnVsa0VkaXQocmVzb3VyY2VGaWxlRWRpdHMsIG9wdGlvbnMpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdC8vIENvbmZsaWN0XG5cdFx0XHRpZiAoKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT1ZFX0NPTkZMSUNUKSB7XG5cblx0XHRcdFx0Y29uc3Qgb3ZlcndyaXRlczogVVJJW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0IG9mIHJlc291cmNlRmlsZUVkaXRzKSB7XG5cdFx0XHRcdFx0aWYgKGVkaXQubmV3UmVzb3VyY2UgJiYgYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMoZWRpdC5uZXdSZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdG92ZXJ3cml0ZXMucHVzaChlZGl0Lm5ld1Jlc291cmNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBNb3ZlIHdpdGggb3ZlcndyaXRlIGlmIHRoZSB1c2VyIGNvbmZpcm1zXG5cdFx0XHRcdGNvbnN0IGNvbmZpcm0gPSBnZXRNdWx0aXBsZUZpbGVzT3ZlcndyaXRlQ29uZmlybShvdmVyd3JpdGVzKTtcblx0XHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKGNvbmZpcm0pO1xuXHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5leHBsb3JlclNlcnZpY2UuYXBwbHlCdWxrRWRpdChyZXNvdXJjZUZpbGVFZGl0cy5tYXAocmUgPT4gbmV3IFJlc291cmNlRmlsZUVkaXQocmUub2xkUmVzb3VyY2UsIHJlLm5ld1Jlc291cmNlLCB7IG92ZXJ3cml0ZTogdHJ1ZSB9KSksIG9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEFueSBvdGhlciBlcnJvcjogYnViYmxlIHVwXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgZ2V0U3RhdHNGcm9tRHJhZ0FuZERyb3BEYXRhKGRhdGE6IEVsZW1lbnRzRHJhZ0FuZERyb3BEYXRhPEV4cGxvcmVySXRlbSwgRXhwbG9yZXJJdGVtW10+LCBkcmFnU3RhcnRFdmVudD86IERyYWdFdmVudCk6IEV4cGxvcmVySXRlbVtdIHtcblx0XHRpZiAoZGF0YS5jb250ZXh0KSB7XG5cdFx0XHRyZXR1cm4gZGF0YS5jb250ZXh0O1xuXHRcdH1cblxuXHRcdC8vIERldGVjdCBjb21wcmVzc2VkIGZvbGRlciBkcmFnZ2luZ1xuXHRcdGlmIChkcmFnU3RhcnRFdmVudCAmJiBkYXRhLmVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0ZGF0YS5jb250ZXh0ID0gW0ZpbGVEcmFnQW5kRHJvcC5nZXRDb21wcmVzc2VkU3RhdEZyb21EcmFnRXZlbnQoZGF0YS5lbGVtZW50c1swXSwgZHJhZ1N0YXJ0RXZlbnQpXTtcblx0XHRcdHJldHVybiBkYXRhLmNvbnRleHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRhdGEuZWxlbWVudHM7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRDb21wcmVzc2VkU3RhdEZyb21EcmFnRXZlbnQoc3RhdDogRXhwbG9yZXJJdGVtLCBkcmFnRXZlbnQ6IERyYWdFdmVudCk6IEV4cGxvcmVySXRlbSB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gRE9NLmdldFdpbmRvdyhkcmFnRXZlbnQpLmRvY3VtZW50LmVsZW1lbnRGcm9tUG9pbnQoZHJhZ0V2ZW50LmNsaWVudFgsIGRyYWdFdmVudC5jbGllbnRZKTtcblx0XHRjb25zdCBpY29uTGFiZWxOYW1lID0gZ2V0SWNvbkxhYmVsTmFtZUZyb21IVE1MRWxlbWVudCh0YXJnZXQpO1xuXG5cdFx0aWYgKGljb25MYWJlbE5hbWUpIHtcblx0XHRcdGNvbnN0IHsgY291bnQsIGluZGV4IH0gPSBpY29uTGFiZWxOYW1lO1xuXG5cdFx0XHRsZXQgaSA9IGNvdW50IC0gMTtcblx0XHRcdHdoaWxlIChpID4gaW5kZXggJiYgc3RhdC5wYXJlbnQpIHtcblx0XHRcdFx0c3RhdCA9IHN0YXQucGFyZW50O1xuXHRcdFx0XHRpLS07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzdGF0O1xuXHRcdH1cblxuXHRcdHJldHVybiBzdGF0O1xuXHR9XG5cblx0b25EcmFnRW5kKCk6IHZvaWQge1xuXHRcdHRoaXMuY29tcHJlc3NlZERyb3BUYXJnZXREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jb21wcmVzc2VkRHJvcFRhcmdldERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEljb25MYWJlbE5hbWVGcm9tSFRNTEVsZW1lbnQodGFyZ2V0OiBIVE1MRWxlbWVudCB8IEV2ZW50VGFyZ2V0IHwgRWxlbWVudCB8IG51bGwpOiB7IGVsZW1lbnQ6IEhUTUxFbGVtZW50OyBjb3VudDogbnVtYmVyOyBpbmRleDogbnVtYmVyIH0gfCBudWxsIHtcblx0aWYgKCEoRE9NLmlzSFRNTEVsZW1lbnQodGFyZ2V0KSkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGxldCBlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwgPSB0YXJnZXQ7XG5cblx0d2hpbGUgKGVsZW1lbnQgJiYgIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28tbGlzdC1yb3cnKSkge1xuXHRcdGlmIChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnbGFiZWwtbmFtZScpICYmIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdkYXRhLWljb24tbGFiZWwtY291bnQnKSkge1xuXHRcdFx0Y29uc3QgY291bnQgPSBOdW1iZXIoZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWNvbi1sYWJlbC1jb3VudCcpKTtcblx0XHRcdGNvbnN0IGluZGV4ID0gTnVtYmVyKGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdkYXRhLWljb24tbGFiZWwtaW5kZXgnKSk7XG5cblx0XHRcdGlmIChpc051bWJlcihjb3VudCkgJiYgaXNOdW1iZXIoaW5kZXgpKSB7XG5cdFx0XHRcdHJldHVybiB7IGVsZW1lbnQ6IGVsZW1lbnQsIGNvdW50LCBpbmRleCB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGVsZW1lbnQgPSBlbGVtZW50LnBhcmVudEVsZW1lbnQ7XG5cdH1cblxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQ29tcHJlc3NlZEZvbGRlck5hbWUodGFyZ2V0OiBIVE1MRWxlbWVudCB8IEV2ZW50VGFyZ2V0IHwgRWxlbWVudCB8IG51bGwpOiBib29sZWFuIHtcblx0cmV0dXJuICEhZ2V0SWNvbkxhYmVsTmFtZUZyb21IVE1MRWxlbWVudCh0YXJnZXQpO1xufVxuXG5leHBvcnQgY2xhc3MgRXhwbG9yZXJDb21wcmVzc2lvbkRlbGVnYXRlIGltcGxlbWVudHMgSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlPEV4cGxvcmVySXRlbT4ge1xuXG5cdGlzSW5jb21wcmVzc2libGUoc3RhdDogRXhwbG9yZXJJdGVtKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHN0YXQuaXNSb290IHx8ICFzdGF0LmlzRGlyZWN0b3J5IHx8IHN0YXQgaW5zdGFuY2VvZiBOZXdFeHBsb3Jlckl0ZW0gfHwgKCFzdGF0LnBhcmVudCB8fCBzdGF0LnBhcmVudC5pc1Jvb3QpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVPckZvbGRlckxhYmVsU3VmZml4KGl0ZW1zOiBFeHBsb3Jlckl0ZW1bXSk6IHN0cmluZyB7XG5cdGlmIChpdGVtcy5sZW5ndGggPT09IDEpIHtcblx0XHRyZXR1cm4gaXRlbXNbMF0ubmFtZTtcblx0fVxuXG5cdGlmIChpdGVtcy5ldmVyeShpID0+IGkuaXNEaXJlY3RvcnkpKSB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdudW1iZXJPZkZvbGRlcnMnLCBcInswfSBmb2xkZXJzXCIsIGl0ZW1zLmxlbmd0aCk7XG5cdH1cblx0aWYgKGl0ZW1zLmV2ZXJ5KGkgPT4gIWkuaXNEaXJlY3RvcnkpKSB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdudW1iZXJPZkZpbGVzJywgXCJ7MH0gZmlsZXNcIiwgaXRlbXMubGVuZ3RoKTtcblx0fVxuXG5cdHJldHVybiBgJHtpdGVtcy5sZW5ndGh9IGZpbGVzIGFuZCBmb2xkZXJzYDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsWUFBWSxTQUFTO0FBQ3JCLFlBQVksVUFBVTtBQUN0QixTQUErQiw0QkFBNEIsOEJBQThCO0FBQ3pGLFNBQVMsa0JBQWtCLHdCQUF5QjtBQUNwRCxTQUFTLHNCQUFzQixnQkFBZ0I7QUFDL0MsU0FBUyxjQUFjLFVBQThCLHFCQUFxQixzQkFBc0I7QUFDaEcsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxzQkFBc0IsMEJBQTBCLHNCQUFzQjtBQUMvRSxTQUFzQixZQUFZLFNBQVMsY0FBYyx1QkFBdUI7QUFDaEYsU0FBUyxlQUFlO0FBRXhCLFNBQWlDLGdCQUF3RiwwQkFBMEI7QUFDbkosU0FBUyxxQkFBcUIsMkJBQTJCO0FBQ3pELFNBQVMscUJBQXFCO0FBQzlCLFNBQW9DLDZCQUE2QjtBQUNqRSxTQUFTLDRCQUFpRCx3QkFBd0I7QUFDbEYsU0FBUyxTQUFTLFVBQVUsaUJBQWlCLG9CQUFvQjtBQUNqRSxTQUFTLFVBQVUsbUJBQW1CO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsUUFBUSxpQkFBaUI7QUFDbEMsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsY0FBYyx1QkFBdUI7QUFDOUMsU0FBUyw4QkFBOEIseUJBQXlCLHVCQUF1Qiw0QkFBNEIsdUJBQXVCLDRCQUE0Qix5QkFBeUIsb0NBQW9DO0FBQ25PLFNBQVMsbUJBQW1CLHdCQUF3QjtBQUNwRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUEyQixxQkFBcUI7QUFDaEQsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsdUJBQXVCLGlDQUEwRCw0QkFBNEI7QUFDdEgsU0FBUyxhQUFhLGFBQWE7QUFDbkMsU0FBUyxnQkFBZ0IsMkJBQTJCO0FBQ3BELFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQXFCLHFCQUFxQjtBQUMxQyxTQUFTLFNBQVMsT0FBTyx3QkFBd0I7QUFJakQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQkFBbUIsb0JBQW9CLHdDQUF3QztBQUN4RixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlCQUF5Qiw2QkFBNkI7QUFDL0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQW9DLG1DQUFtQztBQUV2RSxTQUFTLGdCQUFnQixXQUFXLG1CQUFzRTtBQUUxRyxTQUFTLG1CQUFtQixvQkFBb0I7QUFDaEQsU0FBUywyQkFBMkI7QUFDcEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMEJBQTBCLHNDQUFzQztBQUN6RSxTQUFTLHFCQUFxQjtBQUV2QixNQUFNLG9CQUFOLE1BQU0sa0JBQStEO0FBQUEsRUFJM0UsVUFBVSxTQUErQjtBQUN4QyxXQUFPLGtCQUFpQjtBQUFBLEVBQ3pCO0FBQUEsRUFFQSxjQUFjLFNBQStCO0FBQzVDLFdBQU8sY0FBYztBQUFBLEVBQ3RCO0FBQ0Q7QUFYYSxrQkFFSSxjQUFjO0FBRnhCLElBQU0sbUJBQU47QUFhQSxNQUFNLDJCQUEyQixJQUFJLFFBQWE7QUFDbEQsSUFBTSxxQkFBTixNQUFrRztBQUFBLEVBRXhHLFlBQ2tCLFlBQ0EsY0FDa0IsaUJBQ0ssZUFDRCxxQkFDRyxlQUNYLGFBQ0ksaUJBQ1EsZ0JBQ0Usb0JBQzVDO0FBVmdCO0FBQ0E7QUFDa0I7QUFDSztBQUNEO0FBQ0c7QUFDWDtBQUNJO0FBQ1E7QUFDRTtBQUFBLEVBQzFDO0FBQUEsRUFFSixVQUFVLFNBQXFDO0FBQzlDLFFBQUksUUFBUSxRQUFRO0FBQ25CLGFBQU8sUUFBUTtBQUFBLElBQ2hCO0FBRUEsVUFBTSxJQUFJLE1BQU0sNkNBQTZDO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLFlBQVksU0FBaUQ7QUFFNUQsV0FBTyxNQUFNLFFBQVEsT0FBTyxLQUFLLFFBQVEsWUFBWSxDQUFDLFNBQVMsS0FBSyxXQUFXLE9BQU8sTUFBTSxlQUFlLE9BQU8sQ0FBQztBQUFBLEVBQ3BIO0FBQUEsRUFFQSxZQUFZLFNBQWtGO0FBQzdGLFFBQUksTUFBTSxRQUFRLE9BQU8sR0FBRztBQUMzQixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksS0FBSyxhQUFhLHVCQUF1QixHQUFHO0FBQy9DLGFBQU8sTUFBTSxLQUFLLFFBQVEsU0FBUyxPQUFPLENBQUM7QUFBQSxJQUM1QztBQUVBLFVBQU0sV0FBVyxRQUFRO0FBQ3pCLFVBQU0sWUFBWSxLQUFLLGdCQUFnQix1QkFBdUI7QUFDOUQsVUFBTSxXQUFXLFFBQVEsY0FBYyxTQUFTO0FBQ2hELFFBQUksTUFBTSxRQUFRLFFBQVEsR0FBRztBQUU1QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sVUFBVSxTQUFTO0FBQUEsTUFDeEIsQ0FBQUEsY0FBWTtBQUVYLFlBQUksbUJBQW1CLGdCQUFnQixRQUFRLFVBQVUsQ0FBQyxRQUFRLFNBQVMsWUFBWSxLQUFLLGVBQWUsa0JBQWtCLE1BQU0sZUFBZSxRQUFRO0FBQ3pKLG1DQUF5QixLQUFLLFFBQVEsUUFBUTtBQUFBLFFBQy9DO0FBQ0EsZUFBT0E7QUFBQSxNQUNSO0FBQUEsTUFDRSxPQUFLO0FBRU4sWUFBSSxtQkFBbUIsZ0JBQWdCLFFBQVEsUUFBUTtBQUN0RCxjQUFJLEtBQUssZUFBZSxrQkFBa0IsTUFBTSxlQUFlLFFBQVE7QUFFdEUsa0JBQU0sY0FBYyxJQUFJLGFBQWEsUUFBUSxVQUFVLEtBQUssYUFBYSxLQUFLLGVBQWUsS0FBSyxvQkFBb0IsUUFBVyxRQUFXLEtBQUs7QUFDakosd0JBQVksUUFBUTtBQUNwQixtQkFBTyxDQUFDLFdBQVc7QUFBQSxVQUNwQixPQUFPO0FBQ04scUNBQXlCLEtBQUssUUFBUSxRQUFRO0FBQUEsVUFDL0M7QUFBQSxRQUNELE9BQU87QUFFTixlQUFLLG9CQUFvQixNQUFNLENBQUM7QUFBQSxRQUNqQztBQUVBLGVBQU8sQ0FBQztBQUFBLE1BQ1Q7QUFBQSxJQUFDO0FBRUYsU0FBSyxnQkFBZ0IsYUFBYTtBQUFBLE1BQ2pDLFVBQVUsaUJBQWlCO0FBQUEsTUFDM0IsT0FBTyxLQUFLLGNBQWMsV0FBVyxJQUFJLE1BQU07QUFBQTtBQUFBLElBQ2hELEdBQUcsZUFBYSxPQUFPO0FBRXZCLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUE5RWEscUJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBWlU7QUFnRk4sTUFBTSw0QkFBNEIsYUFBYTtBQUFBLEVBQ3JELFlBQ0MsVUFDQSxhQUNBLGVBQ0Esb0JBQ0EsU0FDQSxjQUNDO0FBQ0QsVUFBTSxVQUFVLGFBQWEsZUFBZSxvQkFBb0IsU0FBUyxZQUFZO0FBQUEsRUFDdEY7QUFDRDtBQWVBLE1BQU0sMEJBQWdFO0FBQUEsRUFBdEU7QUFFQyxTQUFpQixRQUFRLG9CQUFJLElBQWdDO0FBQzdELFNBQWlCLG9CQUFvQixvQkFBSSxJQUEwQjtBQUFBO0FBQUEsRUFDbkUsSUFBSSxtQkFBbUM7QUFDdEMsV0FBTyxNQUFNLEtBQUssS0FBSyxrQkFBa0IsT0FBTyxDQUFDO0FBQUEsRUFDbEQ7QUFBQSxFQUVBLElBQUksTUFBNEI7QUFDL0IsVUFBTSxTQUFTLEtBQUssS0FBSyxJQUFJO0FBQzdCLFFBQUksV0FBVyxRQUFXO0FBQ3pCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxFQUFFLFdBQVcsUUFBUSxJQUFJO0FBQy9CLFNBQUssa0JBQWtCLElBQUksU0FBUyxJQUFJO0FBRXhDLFdBQU8sVUFBVTtBQUFBLEVBQ2xCO0FBQUEsRUFFUSxLQUFLLE1BQW9GO0FBQ2hHLFVBQU0sWUFBWSxLQUFLLE1BQU0sSUFBSSxLQUFLLEtBQUssSUFBSTtBQUMvQyxRQUFJLGNBQWMsUUFBVztBQUM1QixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sVUFBVSxhQUFhLEtBQUssS0FBSyxVQUFVLEtBQUssUUFBUTtBQUM5RCxRQUFJLFlBQVksVUFBYSxRQUFRLFdBQVcsSUFBSSxHQUFHO0FBQ3RELFlBQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLElBQ3REO0FBRUEsUUFBSSxZQUFZLElBQUk7QUFDbkIsYUFBTyxFQUFFLFdBQVcsV0FBVyxRQUFRO0FBQUEsSUFDeEM7QUFFQSxRQUFJLFlBQVk7QUFDaEIsZUFBVyxXQUFXLFFBQVEsTUFBTSxHQUFHLEdBQUc7QUFDekMsVUFBSSxDQUFDLFVBQVUsTUFBTSxPQUFPLEdBQUc7QUFDOUIsZUFBTztBQUFBLE1BQ1I7QUFFQSxrQkFBWSxVQUFVLE1BQU0sT0FBTztBQUFBLElBQ3BDO0FBRUEsV0FBTyxFQUFFLFdBQVcsUUFBUTtBQUFBLEVBQzdCO0FBQUEsRUFFQSxJQUFJLFVBQWUsTUFBMEI7QUFDNUMsVUFBTSxVQUFVLGFBQWEsS0FBSyxVQUFVLFFBQVE7QUFDcEQsUUFBSSxZQUFZLFVBQWEsUUFBUSxXQUFXLElBQUksR0FBRztBQUN0RCxZQUFNLElBQUksTUFBTSxxQ0FBcUM7QUFBQSxJQUN0RDtBQUVBLFFBQUksWUFBWSxLQUFLLE1BQU0sSUFBSSxLQUFLLElBQUk7QUFDeEMsUUFBSSxDQUFDLFdBQVc7QUFDZixrQkFBWSxFQUFFLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxTQUFTLE1BQU07QUFDekQsV0FBSyxNQUFNLElBQUksS0FBSyxNQUFNLFNBQVM7QUFBQSxJQUNwQztBQUNBLGNBQVU7QUFFVixRQUFJLFlBQVk7QUFDaEIsZUFBVyxRQUFRLFFBQVEsTUFBTSxHQUFHLEdBQUc7QUFDdEMsVUFBSSxDQUFDLFVBQVUsTUFBTSxJQUFJLEdBQUc7QUFDM0Isa0JBQVUsTUFBTSxJQUFJLElBQUksRUFBRSxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsU0FBUyxNQUFNO0FBQUEsTUFDdEU7QUFFQSxrQkFBWSxVQUFVLE1BQU0sSUFBSTtBQUNoQyxnQkFBVTtBQUFBLElBQ1g7QUFFQSxjQUFVO0FBQ1YsY0FBVSxVQUFVO0FBQUEsRUFDckI7QUFBQSxFQUVBLFFBQVEsTUFBNkI7QUFDcEMsVUFBTSxTQUFTLEtBQUssS0FBSyxJQUFJO0FBQzdCLFFBQUksV0FBVyxRQUFXO0FBQ3pCLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxFQUFFLFVBQVUsSUFBSTtBQUN0QixXQUFPLFVBQVU7QUFBQSxFQUNsQjtBQUFBLEVBRUEsUUFBYztBQUNiLFNBQUssTUFBTSxNQUFNO0FBQUEsRUFDbEI7QUFFRDtBQUVPLElBQU0sdUJBQU4sTUFBdUU7QUFBQSxFQVk3RSxZQUNrQixhQUNBLGNBQ2dCLGVBQ0YsYUFDUyxzQkFDSyxvQkFDVixpQkFDQSxpQkFDZixtQkFDbkI7QUFUZ0I7QUFDQTtBQUNnQjtBQUNGO0FBQ1M7QUFDSztBQUNWO0FBQ0E7QUFsQnBDLFNBQVEsWUFBb0I7QUFJNUIsU0FBUSxpQkFBaUIsb0JBQUksSUFBa0I7QUFDL0MsU0FBUSxvQkFBb0IsSUFBSSwwQkFBMEI7QUFnQnpELFNBQUssK0JBQStCLDJCQUEyQixPQUFPLGlCQUFpQjtBQUFBLEVBQ3hGO0FBQUEsRUFoQkEsSUFBSSxnQkFBNEM7QUFDL0MsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBZ0JBLHlCQUFrQztBQUNqQyxXQUFPLENBQUMsQ0FBQyxLQUFLO0FBQUEsRUFDZjtBQUFBLEVBRUEsVUFBVSxTQUFnQztBQUN6QyxRQUFJLENBQUMsS0FBSyx5QkFBeUI7QUFDbEMsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLEtBQUssZ0JBQWdCLFdBQVcsT0FBTyxHQUFHO0FBQzdDLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLHdCQUF3QixtQkFBbUIsSUFBSSxRQUFRLElBQUksSUFBSSxRQUFRLG1CQUFtQixJQUFJO0FBQUEsRUFDM0c7QUFBQSxFQUVBLGVBQXFCO0FBQ3BCLFNBQUs7QUFBQSxFQUNOO0FBQUEsRUFFQSxNQUFNLGFBQTRCO0FBRWpDLFFBQUksS0FBSyx5QkFBeUI7QUFDakMsWUFBTSxLQUFLLGlCQUFpQjtBQUFBLElBQzdCO0FBRUEsUUFBSSxLQUFLLDRCQUE0QjtBQUNwQyxXQUFLLG9CQUFvQjtBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxLQUFLLFNBQWlCLFNBQTRCLE9BQStFO0FBQ3RJLFVBQU0sVUFBVSxLQUFLLE9BQU8sU0FBUyxTQUFTLEtBQUs7QUFFbkQsV0FBTyxNQUFNLEtBQUssZ0JBQWdCLGFBQWE7QUFBQSxNQUM5QyxVQUFVLGlCQUFpQjtBQUFBLE1BQzNCLE9BQU87QUFBQSxJQUNSLEdBQUcsZUFBYSxPQUFPO0FBQUEsRUFDeEI7QUFBQSxFQUVBLE1BQU0sT0FBTyxTQUFpQixTQUE0QixPQUErRTtBQUN4SSxRQUFJLFFBQVEsYUFBYSxhQUFhLFdBQVc7QUFDaEQsVUFBSSxLQUFLLHlCQUF5QjtBQUNqQyxjQUFNLEtBQUssaUJBQWlCO0FBQUEsTUFDN0I7QUFFQSxVQUFJLENBQUMsS0FBSyw0QkFBNEI7QUFDckMsYUFBSyxzQkFBc0I7QUFBQSxNQUM1QjtBQUVBLGFBQU8sTUFBTSxLQUFLLGdCQUFnQixTQUFTLFFBQVEsV0FBVyxLQUFLO0FBQUEsSUFDcEU7QUFFQSxRQUFJLEtBQUssNEJBQTRCO0FBQ3BDLFdBQUssb0JBQW9CO0FBQUEsSUFDMUI7QUFFQSxRQUFJLENBQUMsS0FBSyx5QkFBeUI7QUFDbEMsV0FBSyxtQkFBbUI7QUFBQSxJQUN6QjtBQUVBLFdBQU8sTUFBTSxLQUFLLGFBQWEsU0FBUyxRQUFRLFdBQVcsS0FBSztBQUFBLEVBQ2pFO0FBQUE7QUFBQSxFQUlRLHFCQUEyQjtBQUNsQyxVQUFNLE9BQU8sS0FBSyxhQUFhO0FBQy9CLFVBQU0sUUFBUSxLQUFLLFNBQVM7QUFDNUIsUUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFFBQVEsS0FBSyxnQkFBZ0IsTUFBTSxPQUFPLFVBQVEsS0FBSyxxQkFBcUIsS0FBSyxTQUFTLE1BQU0sQ0FBQztBQUN2RyxTQUFLLDBCQUEwQixFQUFFLFdBQVcsS0FBSyxhQUFhLEdBQUcsT0FBTyxvQkFBb0IsSUFBSSxJQUFJLEtBQUssRUFBRTtBQUUzRyxTQUFLLDZCQUE2QixJQUFJLElBQUk7QUFBQSxFQUMzQztBQUFBLEVBRUEsTUFBTSxhQUFhLFNBQWlCLFdBQThCLE9BQStFO0FBQ2hKLFFBQUksQ0FBQyxLQUFLLHlCQUF5QjtBQUNsQyxZQUFNLElBQUksTUFBTSx3Q0FBd0M7QUFBQSxJQUN6RDtBQUVBLFVBQU0sUUFBUSxNQUFNLEtBQUssS0FBSyx3QkFBd0Isa0JBQWtCO0FBQ3hFLFVBQU0sZ0JBQWdCLE1BQU0sS0FBSyxpQkFBaUIsU0FBUyxPQUFPLFdBQVcsS0FBSztBQUVsRixRQUFJLE1BQU0seUJBQXlCO0FBQ2xDLGFBQU87QUFBQSxJQUNSO0FBRUEsU0FBSyxxQkFBcUI7QUFDMUIsZUFBVyxFQUFFLGNBQWMsT0FBTyxZQUFZLEtBQUssZUFBZTtBQUNqRSxXQUFLLDBCQUEwQixjQUFjLE9BQU8sV0FBVztBQUFBLElBQ2hFO0FBRUEsVUFBTSxPQUFPLEtBQUssYUFBYTtBQUMvQixVQUFNLEtBQUssU0FBUyxLQUFLLHdCQUF3QixLQUFLO0FBRXRELFVBQU0sZ0JBQWdCLGNBQWMsS0FBSyxDQUFDLEVBQUUsZUFBQUMsZUFBYyxNQUFNQSxjQUFhO0FBQzdFLFdBQU87QUFBQSxNQUNOLFNBQVMsQ0FBQyxTQUF1QixLQUFLLG1CQUFtQjtBQUFBLE1BQ3pELFlBQVksY0FBYyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sWUFBWSxNQUFNLE1BQU0sTUFBTSxTQUFTLFlBQVksUUFBUSxDQUFDO0FBQUEsTUFDNUcsZ0JBQWdCLGdCQUFnQixTQUFTLDJCQUEyQixtSEFBbUgsSUFBSTtBQUFBLElBQzVMO0FBQUEsRUFDRDtBQUFBLEVBRVEsMEJBQTBCLE1BQW9CLE9BQWMsYUFBMEI7QUFDN0YsVUFBTSxVQUFVO0FBQUEsTUFDZixHQUFHLE1BQU0sSUFBSSxXQUFTLEVBQUUsVUFBVSxNQUFNLGFBQWEsTUFBTSxFQUFFO0FBQUEsTUFDN0QsR0FBRyxZQUFZLElBQUksZ0JBQWMsRUFBRSxVQUFVLFdBQVcsYUFBYSxLQUFLLEVBQUU7QUFBQSxJQUM3RTtBQUVBLGVBQVcsRUFBRSxVQUFVLFlBQVksS0FBSyxTQUFTO0FBQ2hELFlBQU0sVUFBVSxLQUFLLEtBQUssUUFBUTtBQUNsQyxVQUFJLFdBQVcsUUFBUSxTQUFTLE1BQU07QUFFckMsZ0JBQVEsNkJBQTZCO0FBQ3JDO0FBQUEsTUFDRDtBQUdBLFlBQU0sa0JBQWtCLEtBQUssbUJBQW1CLFVBQVUsTUFBTSxXQUFXO0FBQzNFLFVBQUksZ0JBQWdCLFdBQVcsR0FBRztBQUNqQyxjQUFNLElBQUksTUFBTSxpRUFBaUU7QUFBQSxNQUNsRjtBQUdBLFlBQU0scUJBQXFCLGdCQUFnQixDQUFDLEVBQUU7QUFDOUMsVUFBSSxFQUFFLDhCQUE4QixzQkFBc0I7QUFDekQsYUFBSyxlQUFlLElBQUksa0JBQWtCO0FBQUEsTUFDM0M7QUFFQSxZQUFNLHFCQUFxQixnQkFBZ0IsZ0JBQWdCLFNBQVMsQ0FBQztBQUNyRSx5QkFBbUIsNkJBQTZCO0FBQUEsSUFDakQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxtQkFBbUIsVUFBZSxNQUFvQixxQkFBcUQ7QUFDbEgsVUFBTSxxQkFBcUIsYUFBYSxLQUFLLFVBQVUsUUFBUTtBQUMvRCxRQUFJLENBQUMsb0JBQW9CO0FBQ3hCLFlBQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLElBQ3REO0FBRUEsVUFBTSxrQkFBeUMsQ0FBQztBQUVoRCxRQUFJLGNBQWM7QUFDbEIsUUFBSSxrQkFBa0IsS0FBSztBQUMzQixVQUFNLGVBQWUsbUJBQW1CLE1BQU0sR0FBRztBQUNqRCxlQUFXLFFBQVEsY0FBYztBQUNoQyx3QkFBa0IsZ0JBQWdCLEtBQUssRUFBRSxNQUFNLEdBQUcsZ0JBQWdCLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUVsRixVQUFJLFFBQVEsWUFBWSxTQUFTLElBQUk7QUFDckMsVUFBSSxDQUFDLE9BQU87QUFDWCxjQUFNLGNBQWMsYUFBYSxhQUFhLFNBQVMsQ0FBQyxNQUFNLE9BQU8sc0JBQXNCO0FBQzNGLGdCQUFRLElBQUksb0JBQW9CLGlCQUFpQixLQUFLLGFBQWEsS0FBSyxzQkFBc0IsS0FBSyxvQkFBb0IsYUFBYSxXQUFXO0FBQy9JLG9CQUFZLFNBQVMsS0FBSztBQUMxQix3QkFBZ0IsS0FBSyxLQUE0QjtBQUFBLE1BQ2xEO0FBRUEsb0JBQWM7QUFBQSxJQUNmO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQU0sbUJBQWtDO0FBQ3ZDLFNBQUsscUJBQXFCO0FBRTFCLFNBQUssNkJBQTZCLElBQUksS0FBSztBQUczQyxRQUFJLENBQUMsS0FBSyx5QkFBeUI7QUFDbEMsWUFBTSxJQUFJLE1BQU0sbURBQW1EO0FBQUEsSUFDcEU7QUFFQSxVQUFNLE9BQU8sS0FBSyxhQUFhO0FBQy9CLFVBQU0sS0FBSyxTQUFTLEtBQUssd0JBQXdCLE9BQU8sS0FBSyx3QkFBd0IsU0FBUztBQUU5RixTQUFLLDBCQUEwQjtBQUMvQixTQUFLLGdCQUFnQixRQUFRO0FBQUEsRUFDOUI7QUFBQSxFQUVRLHVCQUE2QjtBQUNwQyxlQUFXLGlCQUFpQixLQUFLLGdCQUFnQjtBQUVoRCxvQkFBYyxlQUFlO0FBQUEsSUFDOUI7QUFDQSxTQUFLLGVBQWUsTUFBTTtBQUMxQixTQUFLLGdCQUFnQixNQUFNLFFBQVEsVUFBUSxLQUFLLHNCQUFzQixDQUFDO0FBQUEsRUFDeEU7QUFBQTtBQUFBLEVBSVEsd0JBQThCO0FBQ3JDLFVBQU0sUUFBUSxLQUFLLGdCQUFnQixNQUFNLE9BQU8sVUFBUSxLQUFLLHFCQUFxQixLQUFLLFNBQVMsTUFBTSxDQUFDO0FBQ3ZHLFNBQUssNkJBQTZCLEVBQUUsb0JBQW9CLElBQUksSUFBSSxLQUFLLEVBQUU7QUFBQSxFQUN4RTtBQUFBLEVBRUEsTUFBTSxnQkFBZ0IsU0FBaUIsV0FBOEIsT0FBK0U7QUFDbkosUUFBSSxDQUFDLEtBQUssNEJBQTRCO0FBQ3JDLFlBQU0sSUFBSSxNQUFNLGtEQUFrRDtBQUFBLElBQ25FO0FBRUEsVUFBTSxRQUFRLE1BQU0sS0FBSyxLQUFLLDJCQUEyQixrQkFBa0I7QUFDM0UsVUFBTSxnQkFBZ0IsTUFBTSxLQUFLLGlCQUFpQixTQUFTLE9BQU8sV0FBVyxLQUFLO0FBRWxGLFFBQUksTUFBTSx5QkFBeUI7QUFDbEMsYUFBTztBQUFBLElBQ1I7QUFFQSxTQUFLLGdCQUFnQjtBQUNyQixlQUFXLEVBQUUsY0FBYyxPQUFPLFlBQVksS0FBSyxlQUFlO0FBQ2pFLFdBQUssNkJBQTZCLGNBQWMsTUFBTSxPQUFPLFdBQVcsQ0FBQztBQUFBLElBQzFFO0FBRUEsVUFBTSxnQkFBZ0IsY0FBYyxLQUFLLENBQUMsRUFBRSxlQUFBQSxlQUFjLE1BQU1BLGNBQWE7QUFDN0UsV0FBTztBQUFBLE1BQ04sU0FBUyxDQUFDLFNBQXVCLEtBQUssa0JBQWtCLFFBQVEsSUFBSSxLQUFNLEtBQUssa0JBQWtCLElBQUksSUFBSSxJQUFJLEtBQUssS0FBSyxhQUFhLEVBQUUsWUFBWSxJQUFJO0FBQUEsTUFDdEosWUFBWSxjQUFjLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxZQUFZLE1BQU0sTUFBTSxNQUFNLFNBQVMsWUFBWSxRQUFRLENBQUM7QUFBQSxNQUM1RyxnQkFBZ0IsZ0JBQWdCLFNBQVMsMkJBQTJCLG1IQUFtSCxJQUFJO0FBQUEsSUFDNUw7QUFBQSxFQUNEO0FBQUEsRUFFUSw2QkFBNkIsTUFBb0IsV0FBd0I7QUFDaEYsVUFBTSx5QkFBeUIsb0JBQUksSUFBa0I7QUFDckQsVUFBTSxtQkFBbUIsQ0FBQyxTQUFtQztBQUM1RCxhQUFPLE1BQU07QUFDWiwrQkFBdUIsSUFBSSxJQUFJO0FBQy9CLGVBQU8sS0FBSztBQUFBLE1BQ2I7QUFBQSxJQUNEO0FBRUEsZUFBVyxZQUFZLFdBQVc7QUFDakMsWUFBTSxVQUFVLEtBQUssS0FBSyxRQUFRO0FBQ2xDLFVBQUksV0FBVyxRQUFRLFNBQVMsTUFBTTtBQUVyQyxhQUFLLGtCQUFrQixJQUFJLFVBQVUsSUFBSTtBQUN6Qyx5QkFBaUIsUUFBUSxNQUFNO0FBQy9CO0FBQUEsTUFDRDtBQUVBLFlBQU0sY0FBYyxnQkFBZ0IsVUFBVSxJQUFJO0FBQ2xELFVBQUksYUFBYTtBQUNoQixhQUFLLGtCQUFrQixJQUFJLFVBQVUsSUFBSTtBQUN6Qyx5QkFBaUIsWUFBWSxNQUFPO0FBQUEsTUFDckM7QUFBQSxJQUNEO0FBRUEsVUFBTSxPQUFPLEtBQUssYUFBYTtBQUMvQixlQUFXLGFBQWEsd0JBQXdCO0FBQy9DLFVBQUksS0FBSyxRQUFRLFNBQVMsR0FBRztBQUM1QixhQUFLLFNBQVMsU0FBUztBQUFBLE1BQ3hCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHNCQUE0QjtBQUNuQyxTQUFLLDZCQUE2QjtBQUNsQyxTQUFLLGdCQUFnQjtBQUFBLEVBQ3RCO0FBQUEsRUFFUSxrQkFBd0I7QUFDL0IsVUFBTSxPQUFPLEtBQUssYUFBYTtBQUMvQixlQUFXLFFBQVEsS0FBSyxrQkFBa0Isa0JBQWtCO0FBQzNELFVBQUksS0FBSyxRQUFRLElBQUksR0FBRztBQUN2QixhQUFLLFNBQVMsSUFBSTtBQUFBLE1BQ25CO0FBQUEsSUFDRDtBQUNBLFNBQUssa0JBQWtCLE1BQU07QUFBQSxFQUM5QjtBQUFBO0FBQUEsRUFJUSxxQkFBcUIsUUFBeUI7QUFFckQsUUFBSSxXQUFXLFFBQVEsUUFBUSxXQUFXLFFBQVEsY0FBYztBQUMvRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sS0FBSyxjQUFjLDRCQUE0QixNQUFNO0FBQUEsRUFDN0Q7QUFBQSxFQUVBLE1BQWMsaUJBQWlCLFNBQWlCLE9BQXVCLFdBQThCLE9BQStIO0FBQ25PLFVBQU0sbUJBQW1CLFFBQVEsWUFBWTtBQUM3QyxVQUFNLGVBQWUsY0FBYyxrQkFBa0I7QUFDckQsV0FBTyxNQUFNLFFBQVEsSUFBSSxNQUFNLElBQUksQ0FBQyxNQUFNLFVBQVUsS0FBSyxrQkFBa0Isa0JBQWtCLE1BQU0sT0FBTyxjQUFjLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDaEk7QUFBQSxFQUVBLE1BQWMsa0JBQWtCLGtCQUEwQixNQUFvQixXQUFtQixjQUF1QixPQUE2SDtBQUNwUCxVQUFNLHNCQUFzQiwyQkFBMkIsZUFBZSx5QkFBeUIsZ0JBQWdCLElBQUksNkJBQTZCLGdCQUFnQixDQUFDO0FBRWpLLFVBQU0sdUJBQXVCLFlBQVksS0FBSyxxQkFBcUIsU0FBK0IsRUFBRSxVQUFVLEtBQUssU0FBUyxDQUFDLENBQUMsS0FBSyxDQUFDO0FBQ3BJLFVBQU0sZ0JBQTRCO0FBQUEsTUFDakMsZUFBZSxDQUFDO0FBQUEsUUFDZixRQUFRLEtBQUs7QUFBQSxRQUNiLHNCQUFzQixDQUFDLEtBQUsscUJBQXFCLFNBQWtCLDJCQUEyQjtBQUFBLE1BQy9GLENBQUM7QUFBQSxNQUNELE1BQU0sVUFBVTtBQUFBLE1BQ2hCLDRCQUE0QjtBQUFBLE1BQzVCLFVBQVUsd0JBQXdCLEtBQUssSUFBSSxJQUFJLFNBQVMsSUFBSSxLQUFLLFNBQVM7QUFBQSxNQUMxRSxnQkFBZ0I7QUFBQSxJQUNqQjtBQUVBLFFBQUk7QUFDSixRQUFJO0FBQ0osUUFBSTtBQUNILE9BQUMsYUFBYSxhQUFhLElBQUksTUFBTSxRQUFRLElBQUk7QUFBQSxRQUNoRCxLQUFLLGNBQWMsV0FBVyxFQUFFLEdBQUcsZUFBZSxhQUFhLE1BQU0sbUJBQW1CLElBQUksWUFBWSxJQUFJLEdBQUcsS0FBSztBQUFBLFFBQ3BILEtBQUssY0FBYyxXQUFXLEVBQUUsR0FBRyxlQUFlLGFBQWEsTUFBTSxtQkFBbUIsTUFBTSxHQUFHLEtBQUs7QUFBQSxNQUN2RyxDQUFDO0FBQUEsSUFDRixTQUFTLEdBQUc7QUFDWCxVQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRztBQUM1QixjQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0Q7QUFFQSxRQUFJLENBQUMsZUFBZSxDQUFDLGlCQUFpQixNQUFNLHlCQUF5QjtBQUNwRSxhQUFPLEVBQUUsY0FBYyxNQUFNLE9BQU8sQ0FBQyxHQUFHLGFBQWEsQ0FBQyxHQUFHLGVBQWUsTUFBTTtBQUFBLElBQy9FO0FBRUEsVUFBTSxzQkFBc0IsWUFBWSxRQUFRLElBQUksWUFBVSxPQUFPLFFBQVE7QUFDN0UsVUFBTSxxQkFBcUIsZ0NBQWdDLGNBQWMsUUFBUSxJQUFJLFlBQVUsT0FBTyxRQUFRLEdBQUcsTUFBTSxtQkFBbUI7QUFFMUksVUFBTSx3QkFBd0Isb0JBQW9CLE9BQU8sY0FBWSxDQUFDLEtBQUssWUFBWSxVQUFVLFVBQVUsS0FBSyxVQUFVLEtBQUssQ0FBQztBQUNoSSxVQUFNLDZCQUE2QixtQkFBbUIsT0FBTyxjQUFZLENBQUMsS0FBSyxZQUFZLFVBQVUsVUFBVSxLQUFLLFVBQVUsSUFBSSxDQUFDO0FBRW5JLFdBQU8sRUFBRSxjQUFjLE1BQU0sT0FBTyx1QkFBdUIsYUFBYSw0QkFBNEIsZUFBZSxDQUFDLENBQUMsWUFBWSxZQUFZLENBQUMsQ0FBQyxjQUFjLFNBQVM7QUFBQSxFQUN2SztBQUNEO0FBbFdhLHVCQUFOO0FBQUEsRUFlSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBckJVO0FBb1diLFNBQVMsZ0NBQWdDLFdBQWtCLE1BQW9CLHFCQUFvQztBQUNsSCxRQUFNLG9CQUFvQixJQUFJLFlBQVk7QUFDMUMsYUFBVyxZQUFZLFdBQVc7QUFDakMsVUFBTSxxQkFBcUIsYUFBYSxLQUFLLFVBQVUsUUFBUTtBQUMvRCxRQUFJLENBQUMsb0JBQW9CO0FBQ3hCLFlBQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLElBQ3REO0FBRUEsUUFBSSxjQUFjLEtBQUs7QUFDdkIsVUFBTSxRQUFRLG1CQUFtQixNQUFNLEdBQUcsRUFBRSxNQUFNLEdBQUcsRUFBRTtBQUN2RCxlQUFXLFFBQVEsT0FBTztBQUN6QixvQkFBYyxZQUFZLEtBQUssRUFBRSxNQUFNLEdBQUcsWUFBWSxJQUFJLElBQUksSUFBSSxHQUFHLENBQUM7QUFDdEUsd0JBQWtCLElBQUksV0FBVztBQUFBLElBQ2xDO0FBQUEsRUFDRDtBQUVBLFFBQU0sc0JBQTZCLENBQUM7QUFDcEMsYUFBVyxlQUFlLG1CQUFtQjtBQUM1QyxVQUFNLFFBQVEsWUFBWSxLQUFLLE1BQU0sR0FBRztBQUN4QyxVQUFNLFVBQVUsTUFBTSxNQUFNLFNBQVMsQ0FBQztBQUN0QyxRQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssTUFBTSxxQkFBcUIsT0FBTyxHQUFHO0FBQzFEO0FBQUEsSUFDRDtBQUVBLHdCQUFvQixLQUFLLFdBQVc7QUFBQSxFQUNyQztBQUVBLFNBQU87QUFDUjtBQUVBLFNBQVMsZ0JBQWdCLFVBQWUsTUFBOEM7QUFDckYsUUFBTSxxQkFBcUIsYUFBYSxLQUFLLFVBQVUsUUFBUTtBQUMvRCxNQUFJLENBQUMsb0JBQW9CO0FBQ3hCLFVBQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLEVBQ3REO0FBRUEsTUFBSSxjQUFjO0FBQ2xCLE1BQUksa0JBQWtCLEtBQUs7QUFDM0IsUUFBTSxlQUFlLG1CQUFtQixNQUFNLEdBQUc7QUFDakQsYUFBVyxRQUFRLGNBQWM7QUFDaEMsc0JBQWtCLGdCQUFnQixLQUFLLEVBQUUsTUFBTSxHQUFHLGdCQUFnQixJQUFJLElBQUksSUFBSSxHQUFHLENBQUM7QUFDbEYsVUFBTSxRQUFRLFlBQVksU0FBUyxJQUFJO0FBQ3ZDLFFBQUksQ0FBQyxPQUFPO0FBQ1gsYUFBTztBQUFBLElBQ1I7QUFFQSxrQkFBYztBQUFBLEVBQ2Y7QUFFQSxTQUFPO0FBQ1I7QUFFQSxTQUFTLHlCQUF5QixTQUF5QjtBQUMxRCxNQUFJLENBQUMsU0FBUztBQUNiLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTyxNQUFNLFFBQVEsTUFBTSxFQUFFLEVBQUUsS0FBSyxHQUFHLElBQUk7QUFDNUM7QUFFQSxTQUFTLDZCQUE2QixTQUF5QjtBQUM5RCxNQUFJLENBQUMsU0FBUztBQUNiLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTyxNQUFNLFVBQVU7QUFDeEI7QUFFQSxTQUFTLDJCQUEyQixTQUF5QjtBQUM1RCxNQUFJLDZCQUE2QjtBQUNqQyxXQUFTLElBQUksR0FBRyxJQUFJLFFBQVEsUUFBUSxLQUFLO0FBQ3hDLFVBQU0sT0FBTyxRQUFRLENBQUM7QUFDdEIsUUFBSSxXQUFXLEtBQUssSUFBSSxHQUFHO0FBQzFCLG9DQUE4QixJQUFJLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxZQUFZLENBQUM7QUFBQSxJQUMxRSxPQUFPO0FBQ04sb0NBQThCO0FBQUEsSUFDL0I7QUFBQSxFQUNEO0FBQ0EsU0FBTztBQUNSO0FBa0JPLE1BQU0sK0JBQXVGO0FBQUEsRUFpQm5HLFlBQW9CLElBQXFCLE9BQXVCLGNBQXlDLE9BQXVCLFdBQW9CO0FBQWhJO0FBQXFCO0FBQWdFO0FBQXVCO0FBSGhJLFNBQVEsZUFBZSxJQUFJLFFBQWM7QUFDekMsU0FBUyxjQUFjLEtBQUssYUFBYTtBQUd4QyxTQUFLLFNBQVMsTUFBTSxTQUFTO0FBRTdCLFNBQUssYUFBYSxZQUFZO0FBQzlCLFNBQUsseUJBQXlCLGFBQWEsTUFBTSxZQUFZLE1BQU0sS0FBSyxhQUFhLFlBQVksQ0FBQztBQUFBLEVBQ25HO0FBQUEsRUFkQSxJQUFJLFFBQWdCO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBUTtBQUFBLEVBQzFDLElBQUksUUFBZ0I7QUFBRSxXQUFPLEtBQUssTUFBTTtBQUFBLEVBQVE7QUFBQSxFQUNoRCxJQUFJLFVBQXdCO0FBQUUsV0FBTyxLQUFLLE1BQU0sS0FBSyxNQUFNO0FBQUEsRUFBSTtBQUFBLEVBQy9ELElBQUksWUFBb0I7QUFBRSxXQUFPLEdBQUcsS0FBSyxFQUFFLElBQUksS0FBSyxLQUFLO0FBQUEsRUFBSTtBQUFBLEVBQzdELElBQUksU0FBd0I7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFTO0FBQUEsRUFZM0MsYUFBYSxjQUF1QztBQUMzRCxTQUFLLFVBQVUsTUFBTSxLQUFLLGFBQWEsVUFBVSxpQkFBaUIsYUFBYSxDQUFDO0FBQ2hGLFFBQUksVUFBVTtBQUNkLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxPQUFPLFFBQVEsS0FBSztBQUM1QyxZQUFNLFlBQVksUUFBUSxTQUFTLEdBQUcsS0FBSyxNQUFNLENBQUMsRUFBRSxJQUFJLGNBQWMsT0FBTyxLQUFLLEtBQUssTUFBTSxDQUFDLEVBQUU7QUFDaEcsV0FBSyxPQUFPLENBQUMsRUFBRSxhQUFhLGNBQWMsU0FBUztBQUNuRCxXQUFLLE9BQU8sQ0FBQyxFQUFFLGFBQWEsY0FBYyxHQUFHLEtBQUssUUFBUSxDQUFDLEVBQUU7QUFDN0QsZ0JBQVUsUUFBUSxTQUFTLEdBQUcsS0FBSyxNQUFNLENBQUMsRUFBRSxJQUFJLElBQUksT0FBTyxLQUFLLEtBQUssTUFBTSxDQUFDLEVBQUU7QUFBQSxJQUMvRTtBQUNBLFNBQUssZ0JBQWdCLEtBQUssU0FBUztBQUVuQyxRQUFJLEtBQUssU0FBUyxLQUFLLE9BQU8sUUFBUTtBQUNyQyxXQUFLLE9BQU8sS0FBSyxNQUFNLEVBQUUsVUFBVSxJQUFJLFFBQVE7QUFBQSxJQUNoRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFdBQWlCO0FBQ2hCLFFBQUksS0FBSyxVQUFVLEdBQUc7QUFDckI7QUFBQSxJQUNEO0FBRUEsU0FBSyxTQUFTLEtBQUssU0FBUyxDQUFDO0FBQUEsRUFDOUI7QUFBQSxFQUVBLE9BQWE7QUFDWixRQUFJLEtBQUssVUFBVSxLQUFLLE1BQU0sU0FBUyxHQUFHO0FBQ3pDO0FBQUEsSUFDRDtBQUVBLFNBQUssU0FBUyxLQUFLLFNBQVMsQ0FBQztBQUFBLEVBQzlCO0FBQUEsRUFFQSxRQUFjO0FBQ2IsUUFBSSxLQUFLLFdBQVcsR0FBRztBQUN0QjtBQUFBLElBQ0Q7QUFFQSxTQUFLLFNBQVMsQ0FBQztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxPQUFhO0FBQ1osUUFBSSxLQUFLLFdBQVcsS0FBSyxNQUFNLFNBQVMsR0FBRztBQUMxQztBQUFBLElBQ0Q7QUFFQSxTQUFLLFNBQVMsS0FBSyxNQUFNLFNBQVMsQ0FBQztBQUFBLEVBQ3BDO0FBQUEsRUFFQSxTQUFTLE9BQXFCO0FBQzdCLFFBQUksUUFBUSxLQUFLLFNBQVMsS0FBSyxNQUFNLFFBQVE7QUFDNUM7QUFBQSxJQUNEO0FBRUEsU0FBSyxPQUFPLEtBQUssTUFBTSxFQUFFLFVBQVUsT0FBTyxRQUFRO0FBQ2xELFNBQUssU0FBUztBQUNkLFNBQUssT0FBTyxLQUFLLE1BQU0sRUFBRSxVQUFVLElBQUksUUFBUTtBQUUvQyxTQUFLLGFBQWEsS0FBSztBQUFBLEVBQ3hCO0FBQUEsRUFFQSxnQkFBZ0IsV0FBMEI7QUFDekMsU0FBSyxZQUFZO0FBQ2pCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxPQUFPLFFBQVEsS0FBSztBQUM1QyxXQUFLLE9BQU8sQ0FBQyxFQUFFLGFBQWEsaUJBQWlCLFlBQVksVUFBVSxNQUFNO0FBQUEsSUFDMUU7QUFBQSxFQUNEO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFNBQUssYUFBYSxRQUFRO0FBQzFCLFNBQUssdUJBQXVCLFFBQVE7QUFBQSxFQUNyQztBQUNEO0FBL0ZhLCtCQUVMLEtBQUs7QUF3R04sSUFBTSxnQkFBTixNQUE2SjtBQUFBLEVBVW5LLFlBQ0MsV0FDUSxRQUNBLGVBQ0EsYUFDOEIsb0JBQ04sY0FDUSxzQkFDTCxpQkFDSCxjQUNXLGdCQUNMLG9CQUNFLHNCQUN2QztBQVhPO0FBQ0E7QUFDQTtBQUM4QjtBQUNOO0FBQ1E7QUFDTDtBQUNIO0FBQ1c7QUFDTDtBQUNFO0FBakJ6QyxTQUFRLGtDQUFrQyxvQkFBSSxJQUFvRDtBQUVsRyxTQUFRLCtCQUErQixJQUFJLGlCQUF1QjtBQUNsRSxTQUFTLDhCQUE4QixLQUFLLDZCQUE2QjtBQWdCeEUsU0FBSyxTQUFTLEtBQUsscUJBQXFCLFNBQThCO0FBRXRFLFVBQU0scUJBQXFCLE1BQU07QUFDaEMsWUFBTSxTQUFTLEtBQUsscUJBQXFCLFNBQWlCLHVCQUF1QjtBQUNqRixZQUFNLFNBQVMsS0FBSyxJQUFJLEtBQUssUUFBUSxDQUFDO0FBQ3RDLGdCQUFVLE1BQU0sWUFBWSw4Q0FBOEMsR0FBRyxNQUFNLElBQUk7QUFBQSxJQUN4RjtBQUVBLFNBQUssaUJBQWlCLEtBQUsscUJBQXFCLHlCQUF5QixPQUFLO0FBQzdFLFVBQUksRUFBRSxxQkFBcUIsVUFBVSxHQUFHO0FBQ3ZDLGFBQUssU0FBUyxLQUFLLHFCQUFxQixTQUFTO0FBQUEsTUFDbEQ7QUFDQSxVQUFJLEVBQUUscUJBQXFCLHVCQUF1QixHQUFHO0FBQ3BELDJCQUFtQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBRUQsdUJBQW1CO0FBQUEsRUFDcEI7QUFBQSxFQUVBLHFCQUE2QjtBQUM1QixXQUFPLFNBQVMsaUJBQWlCLGdCQUFnQjtBQUFBLEVBQ2xEO0FBQUEsRUFFQSxJQUFJLGFBQXFCO0FBQ3hCLFdBQU8sY0FBYztBQUFBLEVBQ3RCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQWVBLGVBQWUsV0FBMkM7QUFDekQsVUFBTSxzQkFBc0IsSUFBSSxnQkFBZ0I7QUFDaEQsVUFBTSxRQUFRLG9CQUFvQixJQUFJLEtBQUssT0FBTyxPQUFPLFdBQVcsRUFBRSxtQkFBbUIsS0FBSyxDQUFDLENBQUM7QUFDaEcsd0JBQW9CLElBQUksTUFBTSxZQUFZLE1BQU07QUFDL0MsVUFBSTtBQUNILFlBQUksYUFBYSxnQkFBZ0I7QUFDaEMsZUFBSyxZQUFZLGFBQWEsY0FBYztBQUFBLFFBQzdDO0FBQUEsTUFDRCxTQUFTLEdBQUc7QUFBQSxNQUVaO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixVQUFNLFdBQVcsNEJBQTRCLE9BQU8sS0FBSyxzQkFBc0IsV0FBVyxtQkFBbUI7QUFDN0csd0JBQW9CLElBQUksNEJBQTRCLHdCQUF3QixPQUFLO0FBQ2hGLFlBQU0sUUFBUSxFQUFFLE9BQU8sS0FBSyxzQkFBc0IsU0FBUztBQUMzRCxlQUFTLEtBQUssb0JBQW9CLElBQUksS0FBSyxDQUFDO0FBQzVDLFlBQU0sWUFBWSxhQUFhLGdCQUFnQixRQUFRO0FBQUEsSUFDeEQsQ0FBQyxDQUFDO0FBRUYsVUFBTSxlQUFrQyxFQUFFLHFCQUFxQixvQkFBb0Isb0JBQW9CLElBQUksSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLE9BQU8sV0FBVyxTQUFTO0FBQzlKLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUdBLGNBQWMsTUFBMkMsT0FBZSxjQUF1QztBQUM5RyxVQUFNLE9BQU8sS0FBSztBQUNsQixpQkFBYSxpQkFBaUI7QUFFOUIsVUFBTSxlQUFlLEtBQUssZ0JBQWdCLGdCQUFnQixJQUFJO0FBRTlELGlCQUFhLE1BQU0sUUFBUSxVQUFVLE9BQU8sWUFBWTtBQUd4RCxRQUFJLENBQUMsY0FBYztBQUNsQixtQkFBYSxNQUFNLFFBQVEsTUFBTSxVQUFVO0FBQzNDLFdBQUssV0FBVyxNQUFNLEtBQUssTUFBTSxRQUFXLEtBQUssWUFBWSxZQUFZO0FBQUEsSUFDMUUsT0FHSztBQUNKLG1CQUFhLE1BQU0sUUFBUSxNQUFNLFVBQVU7QUFDM0MsbUJBQWEsU0FBUyxRQUFRLE9BQUssRUFBRSxZQUFZLE1BQVMsQ0FBQztBQUMzRCxtQkFBYSxtQkFBbUIsSUFBSSxLQUFLLGVBQWUsYUFBYSxXQUFXLE1BQU0sWUFBWSxDQUFDO0FBQUEsSUFDcEc7QUFBQSxFQUNEO0FBQUEsRUFFQSx5QkFBeUIsTUFBZ0UsT0FBZSxjQUFpQyxRQUFrQztBQUMxSyxVQUFNLE9BQU8sS0FBSyxRQUFRLFNBQVMsS0FBSyxRQUFRLFNBQVMsU0FBUyxDQUFDO0FBQ25FLGlCQUFhLGlCQUFpQjtBQUU5QixVQUFNLFdBQVcsS0FBSyxRQUFRLFNBQVMsT0FBTyxPQUFLLEtBQUssZ0JBQWdCLFdBQVcsQ0FBQyxDQUFDO0FBQ3JGLFVBQU0sZUFBZSxTQUFTLFdBQVcsSUFBSSxTQUFZLEtBQUssZ0JBQWdCLGdCQUFnQixTQUFTLENBQUMsQ0FBQztBQUd6RyxRQUFJLENBQUMsY0FBYztBQUNsQixtQkFBYSxNQUFNLFFBQVEsVUFBVSxJQUFJLFlBQVk7QUFDckQsbUJBQWEsTUFBTSxRQUFRLE1BQU0sVUFBVTtBQUUzQyxZQUFNLEtBQUssdUJBQXVCLCtCQUErQixJQUFJO0FBQ3JFLFlBQU0sU0FBUyxLQUFLLFFBQVEsU0FBUyxJQUFJLE9BQUssRUFBRSxJQUFJO0FBSXBELFVBQUksYUFBYSxLQUFLO0FBQ3RCLFVBQUksY0FBYyxXQUFXLFNBQVMsR0FBRztBQUN4QyxjQUFNLG1CQUFtQixPQUFPLEtBQUssR0FBRyxFQUFFLFNBQVMsT0FBTyxPQUFPLFNBQVMsQ0FBQyxFQUFFO0FBQzdFLHFCQUFhLENBQUMsV0FBVyxDQUFDLEdBQUcsV0FBVyxDQUFDLElBQUksa0JBQWtCLEdBQUcsV0FBVyxNQUFNLENBQUMsQ0FBQztBQUFBLE1BQ3RGO0FBRUEsV0FBSyxXQUFXLE1BQU0sUUFBUSxJQUFJLFlBQVksWUFBWTtBQUUxRCxZQUFNLGlDQUFpQyxJQUFJLCtCQUErQixJQUFJLEtBQUssUUFBUSxVQUFVLGNBQWMsS0FBSyxPQUFPLEtBQUssU0FBUztBQUM3SSxtQkFBYSxtQkFBbUIsSUFBSSw4QkFBOEI7QUFFbEUsWUFBTSxrQkFBa0IsS0FBSyxnQ0FBZ0MsSUFBSSxJQUFJLEtBQUssQ0FBQztBQUMzRSxXQUFLLGdDQUFnQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLGlCQUFpQiw4QkFBOEIsQ0FBQztBQUduRyxtQkFBYSxtQkFBbUIsSUFBSSxLQUFLLDZCQUE2QixJQUFJLCtCQUErQixXQUFXLENBQUM7QUFFckgsbUJBQWEsbUJBQW1CLElBQUksSUFBSSxzQkFBc0IsYUFBYSxXQUFXLGFBQWEsT0FBSztBQUN2RyxjQUFNLFNBQVMsZ0NBQWdDLEVBQUUsTUFBTTtBQUV2RCxZQUFJLFFBQVE7QUFDWCx5Q0FBK0IsU0FBUyxPQUFPLEtBQUs7QUFBQSxRQUNyRDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBRUYsbUJBQWEsbUJBQW1CLElBQUksYUFBYSxNQUFNO0FBQ3RELGNBQU1DLG1CQUFrQixLQUFLLGdDQUFnQyxJQUFJLElBQUksS0FBSyxDQUFDO0FBQzNFLGNBQU0sZ0JBQWdCQSxpQkFBZ0IsVUFBVSxnQkFBYyxlQUFlLDhCQUE4QjtBQUUzRyxZQUFJLGdCQUFnQixHQUFHO0FBQ3RCLGdCQUFNLElBQUksTUFBTSx5Q0FBeUM7QUFBQSxRQUMxRDtBQUVBLFlBQUlBLGlCQUFnQixXQUFXLEdBQUc7QUFDakMsZUFBSyxnQ0FBZ0MsT0FBTyxJQUFJO0FBQUEsUUFDakQsT0FBTztBQUNOLFVBQUFBLGlCQUFnQixPQUFPLGVBQWUsQ0FBQztBQUFBLFFBQ3hDO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNILE9BR0s7QUFDSixtQkFBYSxNQUFNLFFBQVEsVUFBVSxPQUFPLFlBQVk7QUFDeEQsbUJBQWEsTUFBTSxRQUFRLE1BQU0sVUFBVTtBQUMzQyxtQkFBYSxTQUFTLFFBQVEsT0FBSyxFQUFFLFlBQVksTUFBUyxDQUFDO0FBQzNELG1CQUFhLG1CQUFtQixJQUFJLEtBQUssZUFBZSxhQUFhLFdBQVcsU0FBUyxDQUFDLEdBQUcsWUFBWSxDQUFDO0FBQUEsSUFDM0c7QUFBQSxFQUNEO0FBQUEsRUFFUSxXQUFXLE1BQW9CLE9BQTBCLE9BQTJCLFlBQW9DLGNBQXVDO0FBQ3RLLGlCQUFhLE1BQU0sUUFBUSxNQUFNLFVBQVU7QUFDM0MsVUFBTSxlQUFlLENBQUMsZUFBZTtBQUNyQyxRQUFJLEtBQUssZ0JBQWdCLE1BQU0sSUFBSSxHQUFHO0FBQ3JDLG1CQUFhLEtBQUssS0FBSztBQUFBLElBQ3hCO0FBR0EsVUFBTSxRQUFRLEtBQUssYUFBYSxpQkFBaUI7QUFHakQsVUFBTSxtQkFBbUIsYUFBYSxVQUFVLGVBQWUsZUFBZSxjQUFjLG9CQUFvQjtBQUNoSCxzQkFBa0IsVUFBVSxPQUFPLGlCQUFpQixLQUFLLFlBQVksTUFBTSxtQkFBbUI7QUFJOUYsVUFBTSw0QkFBNEIsTUFBTSxpQkFBaUIsTUFBTSx1QkFBdUIsQ0FBQyxNQUFNO0FBQzdGLFVBQU0sd0JBQXdCLEtBQUssZ0JBQWdCO0FBQ25ELGlCQUFhLFNBQVMsUUFBUSxPQUFLLEVBQUUsWUFBWSxLQUFLLFFBQVEsQ0FBQztBQUMvRCxpQkFBYSxNQUFNLFlBQVksRUFBRSxVQUFVLEtBQUssVUFBVSxNQUFNLE1BQU0sR0FBRztBQUFBLE1BQ3hFLFVBQVUsS0FBSyxTQUFTLFNBQVMsY0FBYyxLQUFLLGNBQWMsU0FBUyxTQUFTLFNBQVM7QUFBQSxNQUM3RixjQUFjLHdCQUF3QixDQUFDLEdBQUcsY0FBYyxrQ0FBa0MsSUFBSTtBQUFBLE1BQzlGLGlCQUFpQixLQUFLLE9BQU8sU0FBUztBQUFBLE1BQ3RDLFNBQVMsY0FBYyxVQUFVO0FBQUEsTUFDakMsV0FBVyxLQUFLLGFBQWEsYUFBYSxLQUFLLFNBQVMsUUFBUSxLQUFLLFNBQVMsU0FBUztBQUFBLE1BQ3ZGO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSxtQkFBbUIsS0FBSyxjQUFjLEtBQUssY0FBYyxJQUFJLElBQUksSUFBSTtBQUMzRSxRQUFJLG1CQUFtQixHQUFHO0FBQ3pCLFlBQU0sUUFBUSxJQUFJLFdBQVcsYUFBYSxNQUFNLFFBQVEsa0JBQWlDLENBQUMsR0FBRyxFQUFFLEdBQUcseUJBQXlCLGlCQUFpQixjQUFjLHdCQUF3QixHQUFHLGFBQWEsY0FBYyw4QkFBOEIsRUFBRSxDQUFDO0FBQ2pQLFlBQU0sU0FBUyxnQkFBZ0I7QUFDL0IsWUFBTSxlQUFlLFNBQVMscUNBQXFDLGtDQUFrQyxnQkFBZ0IsQ0FBQztBQUN0SCxtQkFBYSxtQkFBbUIsSUFBSSxLQUFLO0FBQUEsSUFDMUM7QUFDQSxpQkFBYSxNQUFNLFFBQVEsVUFBVSxPQUFPLG1CQUFtQixtQkFBbUIsQ0FBQztBQUFBLEVBQ3BGO0FBQUEsRUFFUSxlQUFlLFdBQXdCLE1BQW9CLGNBQTBDO0FBRzVHLFVBQU0sUUFBUSxLQUFLLE9BQU8sT0FBTyxTQUFTO0FBQzFDLFVBQU0sZUFBZSxDQUFDLGlCQUFpQixzQkFBc0I7QUFDN0QsVUFBTSxXQUFXLEtBQUssU0FBUyxTQUFTLGNBQWMsS0FBSyxjQUFjLFNBQVMsU0FBUyxTQUFTO0FBRXBHLFVBQU0sUUFBUSxLQUFLLGFBQWEsaUJBQWlCO0FBQ2pELFVBQU0sNEJBQTRCLE1BQU0saUJBQWlCLE1BQU0sdUJBQXVCLENBQUMsTUFBTTtBQUM3RixVQUFNLHdCQUF3QixLQUFLLGdCQUFnQjtBQUVuRCxVQUFNLGVBQWtDO0FBQUEsTUFDdkMsVUFBVTtBQUFBLE1BQ1YsV0FBVztBQUFBLE1BQ1g7QUFBQSxNQUNBLGNBQWMsd0JBQXdCLENBQUMsR0FBRyxjQUFjLGtDQUFrQyxJQUFJO0FBQUEsSUFDL0Y7QUFHQSxVQUFNLFNBQVMsS0FBSyxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksS0FBSztBQUN6RCxVQUFNLFFBQVEsS0FBSyxRQUFRO0FBRTNCLFVBQU0sUUFBUSxTQUFTLFFBQVEsU0FBUyxHQUFHLEdBQUcsWUFBWTtBQUcxRCxJQUFDLE1BQU0sUUFBUSxrQkFBa0MsTUFBTSxVQUFVO0FBR2pFLFVBQU0sV0FBVyxJQUFJLFNBQVMsTUFBTSxTQUFTLEtBQUssb0JBQW9CO0FBQUEsTUFDckUsbUJBQW1CO0FBQUEsUUFDbEIsWUFBWSxDQUFDQyxXQUFVO0FBQ3RCLGdCQUFNLFVBQVUsYUFBYSxrQkFBa0JBLE1BQUs7QUFDcEQsY0FBSSxDQUFDLFdBQVcsUUFBUSxhQUFhLFNBQVMsT0FBTztBQUNwRCxtQkFBTztBQUFBLFVBQ1I7QUFFQSxpQkFBTztBQUFBLFlBQ04sU0FBUyxRQUFRO0FBQUEsWUFDakIsZUFBZTtBQUFBLFlBQ2YsTUFBTSxZQUFZO0FBQUEsVUFDbkI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0EsV0FBVyxTQUFTLHNCQUFzQiw2REFBNkQ7QUFBQSxNQUN2RyxnQkFBZ0I7QUFBQSxJQUNqQixDQUFDO0FBRUQsVUFBTSxVQUFVLE1BQU0sWUFBWSxHQUFHO0FBQ3JDLFFBQUksd0JBQXdCO0FBRTVCLGFBQVMsUUFBUTtBQUNqQixhQUFTLE1BQU07QUFDZixhQUFTLE9BQU8sRUFBRSxPQUFPLEdBQUcsS0FBSyxVQUFVLEtBQUssQ0FBQyxLQUFLLGNBQWMsVUFBVSxNQUFNLE9BQU8sQ0FBQztBQUU1RixVQUFNLE9BQU8seUJBQXlCLENBQUMsU0FBa0Isa0JBQTJCO0FBQ25GLFlBQU0sUUFBUSxNQUFNLFVBQVU7QUFDOUIsWUFBTUEsU0FBUSxTQUFTO0FBQ3ZCLGNBQVEsU0FBUztBQUNqQixZQUFNLFFBQVEsT0FBTztBQUNyQixVQUFJLGVBQWU7QUFDbEIscUJBQWEsU0FBU0EsUUFBTyxPQUFPO0FBQUEsTUFDckM7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLDJCQUEyQixNQUFNO0FBQ3RDLFVBQUksU0FBUyxhQUFhLEdBQUc7QUFDNUIsY0FBTSxVQUFVLGFBQWEsa0JBQWtCLFNBQVMsS0FBSztBQUM3RCxZQUFJLFNBQVM7QUFDWixtQkFBUyxZQUFZO0FBQUEsWUFDcEIsU0FBUyxRQUFRO0FBQUEsWUFDakIsZUFBZTtBQUFBLFlBQ2YsTUFBTSxRQUFRLGFBQWEsU0FBUyxPQUFPLFlBQVksT0FBTyxRQUFRLGFBQWEsU0FBUyxVQUFVLFlBQVksVUFBVSxZQUFZO0FBQUEsVUFDekksQ0FBQztBQUFBLFFBQ0YsT0FBTztBQUNOLG1CQUFTLFlBQVk7QUFBQSxRQUN0QjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsNkJBQXlCO0FBRXpCLFVBQU0sWUFBWTtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxTQUFTLFlBQVksQ0FBQUEsV0FBUztBQUM3QixjQUFNLFFBQVEsU0FBUyxRQUFRQSxVQUFTLEdBQUcsR0FBRyxZQUFZO0FBQUEsTUFDM0QsQ0FBQztBQUFBLE1BQ0QsSUFBSSw4QkFBOEIsU0FBUyxjQUFjLElBQUksVUFBVSxVQUFVLENBQUMsTUFBc0I7QUFDdkcsWUFBSSxFQUFFLE9BQU8sUUFBUSxFQUFFLEdBQUc7QUFDekIsZ0JBQU0sV0FBVyxTQUFTLE1BQU0sWUFBWSxHQUFHO0FBQy9DLGNBQUksS0FBSyxlQUFlLGFBQWEsSUFBSTtBQUN4QztBQUFBLFVBQ0Q7QUFDQSxjQUFJLDBCQUEwQixVQUFVO0FBQ3ZDLG9DQUF3QjtBQUN4QixxQkFBUyxPQUFPLEVBQUUsT0FBTyxHQUFHLEtBQUssU0FBUyxNQUFNLE9BQU8sQ0FBQztBQUFBLFVBQ3pELFdBQVcsMEJBQTBCLE9BQU87QUFDM0Msb0NBQXdCO0FBQ3hCLHFCQUFTLE9BQU8sRUFBRSxPQUFPLFdBQVcsR0FBRyxLQUFLLFNBQVMsTUFBTSxPQUFPLENBQUM7QUFBQSxVQUNwRSxPQUFPO0FBQ04sb0NBQXdCO0FBQ3hCLHFCQUFTLE9BQU8sRUFBRSxPQUFPLEdBQUcsS0FBSyxTQUFTLENBQUM7QUFBQSxVQUM1QztBQUFBLFFBQ0QsV0FBVyxFQUFFLE9BQU8sUUFBUSxLQUFLLEdBQUc7QUFDbkMsY0FBSSxDQUFDLFNBQVMsU0FBUyxHQUFHO0FBQ3pCLGlCQUFLLE1BQU0sSUFBSTtBQUFBLFVBQ2hCO0FBQUEsUUFDRCxXQUFXLEVBQUUsT0FBTyxRQUFRLE1BQU0sR0FBRztBQUNwQyxlQUFLLE9BQU8sSUFBSTtBQUFBLFFBQ2pCO0FBQUEsTUFDRCxDQUFDO0FBQUEsTUFDRCxJQUFJLDhCQUE4QixTQUFTLGNBQWMsSUFBSSxVQUFVLFFBQVEsQ0FBQyxNQUFzQjtBQUNyRyxpQ0FBeUI7QUFBQSxNQUMxQixDQUFDO0FBQUEsTUFDRCxJQUFJLHNCQUFzQixTQUFTLGNBQWMsSUFBSSxVQUFVLE1BQU0sWUFBWTtBQUNoRixlQUFPLE1BQU07QUFDWixnQkFBTSxRQUFRLENBQUM7QUFFZixnQkFBTSxnQkFBZ0IsU0FBUyxhQUFhO0FBQzVDLGNBQUksQ0FBQyxjQUFjLFNBQVMsR0FBRztBQUM5QjtBQUFBLFVBQ0Q7QUFBRSxjQUFJLElBQUksZ0JBQWdCLFNBQVMsWUFBWSxHQUFHO0FBQ2pEO0FBQUEsVUFDRCxXQUFXLElBQUksY0FBYyxjQUFjLGFBQWEsS0FBSyxJQUFJLG1CQUFtQixjQUFjLGVBQWUsY0FBYyxHQUFHO0FBQ2pJLGtCQUFNLE1BQU0sVUFBVSxLQUFLLG1CQUFtQixvQkFBb0I7QUFBQSxVQUNuRSxPQUFPO0FBQ047QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUVBLGFBQUssU0FBUyxhQUFhLEdBQUcsSUFBSTtBQUFBLE1BQ25DLENBQUM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU8sYUFBYSxNQUFNO0FBQ3pCLFdBQUssT0FBTyxLQUFLO0FBQUEsSUFDbEIsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLGVBQWUsU0FBOEMsT0FBZSxjQUF1QztBQUNsSCxpQkFBYSxpQkFBaUI7QUFDOUIsaUJBQWEsbUJBQW1CLE1BQU07QUFBQSxFQUN2QztBQUFBLEVBRUEsMEJBQTBCLE1BQWdFLE9BQWUsY0FBdUM7QUFDL0ksaUJBQWEsaUJBQWlCO0FBQzlCLGlCQUFhLG1CQUFtQixNQUFNO0FBQUEsRUFDdkM7QUFBQSxFQUVBLGdCQUFnQixjQUF1QztBQUN0RCxpQkFBYSxvQkFBb0IsUUFBUTtBQUFBLEVBQzFDO0FBQUEsRUFFQSxrQ0FBa0MsTUFBbUU7QUFDcEcsV0FBTyxLQUFLLGdDQUFnQyxJQUFJLElBQUk7QUFBQSxFQUNyRDtBQUFBO0FBQUEsRUFJQSxhQUFhLFNBQStCO0FBQzNDLFdBQU8sUUFBUTtBQUFBLEVBQ2hCO0FBQUEsRUFFQSxhQUFhLFNBQStCO0FBRTNDLFFBQUksUUFBUTtBQUNaLFFBQUksU0FBUyxRQUFRO0FBQ3JCLFdBQU8sUUFBUTtBQUNkLGVBQVMsT0FBTztBQUNoQjtBQUFBLElBQ0Q7QUFFQSxRQUFJLEtBQUssZUFBZSxrQkFBa0IsTUFBTSxlQUFlLFdBQVc7QUFDekUsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsc0JBQXNCLE1BQXdDO0FBQzdELFdBQU8sS0FBSyxnQ0FBZ0MsSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLGFBQWE7QUFBQSxFQUMxRTtBQUFBLEVBRUEsVUFBZ0I7QUFDZixTQUFLLGVBQWUsUUFBUTtBQUFBLEVBQzdCO0FBQ0Q7QUFsWmEsY0FDSSxLQUFLO0FBRFQsZ0JBQU47QUFBQSxFQWVKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBdEJVO0FBNlpOLElBQU0sY0FBTixNQUFtRTtBQUFBLEVBWXpFLFlBQzRDLGdCQUNILHNCQUNMLGlCQUNGLGVBQ0ssb0JBQ1AsYUFDOUI7QUFOMEM7QUFDSDtBQUNMO0FBQ0Y7QUFDSztBQUNQO0FBakJoQyxTQUFRLDBCQUEwQixvQkFBSSxJQUFvQztBQUMxRSxTQUFRLHlCQUF5QixvQkFBSSxJQUFpQjtBQUN0RCxTQUFRLGVBQWUsSUFBSSxRQUFjO0FBQ3pDLFNBQVEsWUFBMkIsQ0FBQztBQUVwQztBQUFBLFNBQVEsNkJBQTZCLG9CQUFJLElBQXlCO0FBSWxFO0FBQUE7QUFBQTtBQUFBLFNBQVEscUJBQXFCLG9CQUFJLElBQWdEO0FBVWhGLFNBQUssVUFBVSxLQUFLLEtBQUssZUFBZSw0QkFBNEIsTUFBTSxLQUFLLG9CQUFvQixDQUFDLENBQUM7QUFDckcsU0FBSyxVQUFVLEtBQUssS0FBSyxxQkFBcUIseUJBQXlCLENBQUMsTUFBTTtBQUM3RSxVQUFJLEVBQUUscUJBQXFCLGVBQWUsS0FBSyxFQUFFLHFCQUFxQiwyQkFBMkIsR0FBRztBQUNuRyxhQUFLLG9CQUFvQjtBQUFBLE1BQzFCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsS0FBSyxLQUFLLFlBQVksaUJBQWlCLE9BQUs7QUFFMUQsaUJBQVcsQ0FBQyxNQUFNLHFCQUFxQixLQUFLLEtBQUssMkJBQTJCLFFBQVEsR0FBRztBQUN0Riw4QkFBc0IsUUFBUSxPQUFNLG1CQUFrQjtBQUNyRCxjQUFJLEVBQUUsU0FBUyxnQkFBZ0IsZUFBZSxPQUFPLEdBQUc7QUFDdkQsa0JBQU0sS0FBSyxrQkFBa0IsTUFBTSxnQkFBZ0IsSUFBSTtBQUFBLFVBQ3hEO0FBQ0EsY0FBSSxFQUFFLFNBQVMsZ0JBQWdCLGVBQWUsT0FBTyxHQUFHO0FBQ3ZELGlCQUFLLG1CQUFtQixJQUFJLElBQUksR0FBRyxPQUFPLFFBQVEsY0FBYyxDQUFDO0FBQ2pFLGtDQUFzQixPQUFPLGNBQWM7QUFDM0MsaUJBQUssYUFBYSxLQUFLO0FBQUEsVUFDeEI7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixTQUFLLFVBQVUsS0FBSyxLQUFLLGNBQWMsMEJBQTBCLE1BQU07QUFDdEUsWUFBTSxVQUFVLEtBQUssY0FBYztBQUNuQyxVQUFJLGFBQWE7QUFFakIsaUJBQVcsS0FBSyxTQUFTO0FBQ3hCLFlBQUksQ0FBQyxFQUFFLFVBQVU7QUFDaEI7QUFBQSxRQUNEO0FBRUEsY0FBTSxPQUFPLEtBQUssZ0JBQWdCLFlBQVksRUFBRSxRQUFRO0FBQ3hELFlBQUksUUFBUSxLQUFLLFlBQVk7QUFFNUIsdUJBQWE7QUFDYjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsaUJBQVcsS0FBSyxLQUFLLHdCQUF3QjtBQUM1QyxZQUFJLENBQUMsUUFBUSxTQUFTLENBQUMsR0FBRztBQUV6Qix1QkFBYTtBQUNiO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxVQUFJLFlBQVk7QUFDZixhQUFLLHVCQUF1QixNQUFNO0FBQ2xDLGFBQUssYUFBYSxLQUFLO0FBQUEsTUFDeEI7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFNBQUssb0JBQW9CO0FBQUEsRUFDMUI7QUFBQSxFQUVBLElBQUksY0FBMkI7QUFDOUIsV0FBTyxLQUFLLGFBQWE7QUFBQSxFQUMxQjtBQUFBLEVBRVEsc0JBQTRCO0FBQ25DLFFBQUksYUFBYTtBQUNqQixRQUFJLDBCQUEwQjtBQUM5QixTQUFLLGVBQWUsYUFBYSxFQUFFLFFBQVEsUUFBUSxZQUFVO0FBQzVELFlBQU0sZ0JBQWdCLEtBQUsscUJBQXFCLFNBQThCLEVBQUUsVUFBVSxPQUFPLElBQUksQ0FBQztBQUN0RyxZQUFNLGlCQUFtQyxlQUFlLE9BQU8sV0FBVyx1QkFBTyxPQUFPLElBQUk7QUFDNUYsWUFBTSxrQkFBMkIsY0FBYyxTQUFTO0FBR3hELFVBQUksbUJBQW1CLENBQUMsS0FBSyxtQkFBbUIsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDLEdBQUc7QUFDM0Usa0NBQTBCO0FBQzFCLGFBQUssMkJBQTJCLElBQUksT0FBTyxJQUFJLFNBQVMsR0FBRyxJQUFJLFlBQVksQ0FBQztBQUM1RSxhQUFLLG1CQUFtQixJQUFJLE9BQU8sSUFBSSxTQUFTLEdBQUcsa0JBQWtCLFFBQVEsQ0FBQyxRQUFRLEtBQUssbUJBQW1CLE9BQU8saUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDNUk7QUFHQSxVQUFJLENBQUMsbUJBQW1CLEtBQUssbUJBQW1CLElBQUksT0FBTyxJQUFJLFNBQVMsQ0FBQyxHQUFHO0FBQzNFLGtDQUEwQjtBQUMxQixhQUFLLDJCQUEyQixPQUFPLE9BQU8sSUFBSSxTQUFTLENBQUM7QUFDNUQsYUFBSyxtQkFBbUIsT0FBTyxPQUFPLElBQUksU0FBUyxDQUFDO0FBQUEsTUFDckQ7QUFFQSxVQUFJLENBQUMsWUFBWTtBQUNoQixjQUFNLFNBQVMsS0FBSyx3QkFBd0IsSUFBSSxPQUFPLElBQUksU0FBUyxDQUFDO0FBQ3JFLHFCQUFhLENBQUMsVUFBVSxDQUFDLE9BQU8sT0FBTyxVQUFVLGNBQWM7QUFBQSxNQUNoRTtBQUVBLFlBQU0scUJBQXFCLFVBQVUsY0FBYztBQUVuRCxXQUFLLHdCQUF3QixJQUFJLE9BQU8sSUFBSSxTQUFTLEdBQUcsRUFBRSxVQUFVLG9CQUFvQixRQUFRLEtBQUssTUFBTSxrQkFBa0IsRUFBRSxDQUFDO0FBQUEsSUFDakksQ0FBQztBQUVELFFBQUksY0FBYyx5QkFBeUI7QUFDMUMsV0FBSyx1QkFBdUIsTUFBTTtBQUNsQyxXQUFLLGFBQWEsS0FBSztBQUFBLElBQ3hCO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBUUEsTUFBYyxrQkFBa0IsTUFBYyxvQkFBeUIsUUFBa0I7QUFFeEYsVUFBTSxTQUFTLFFBQVEsa0JBQWtCO0FBQ3pDLFVBQU0sYUFBYSxLQUFLLG1CQUFtQixJQUFJLElBQUk7QUFDbkQsUUFBSSxDQUFDLFlBQVk7QUFDaEI7QUFBQSxJQUNEO0FBR0EsUUFBSSxDQUFDLFVBQVUsV0FBVyxJQUFJLE1BQU0sR0FBRztBQUN0QztBQUFBLElBQ0Q7QUFFQSxVQUFNLFVBQVUsTUFBTSxLQUFLLFlBQVksU0FBUyxrQkFBa0I7QUFHbEUsUUFBSSxRQUFRO0FBQ1gsWUFBTSxhQUFhLFdBQVcsSUFBSSxNQUFNO0FBQ3hDLGtCQUFZLGVBQWUsUUFBUSxNQUFNLFNBQVMsQ0FBQztBQUFBLElBQ3BELE9BQU87QUFFTixZQUFNLGVBQWUsV0FBVyxXQUFXLE1BQU07QUFDakQsWUFBTSxhQUFhLElBQUksV0FBVyxRQUFRLE1BQU0sU0FBUyxHQUFHLE9BQU8sTUFBTSxZQUFZO0FBQ3JGLGlCQUFXLElBQUksUUFBUSxVQUFVO0FBRWpDLFVBQUksQ0FBQyxLQUFLLDJCQUEyQixJQUFJLElBQUksR0FBRyxJQUFJLGtCQUFrQixHQUFHO0FBQ3hFLGFBQUssMkJBQTJCLElBQUksSUFBSSxHQUFHLElBQUksa0JBQWtCO0FBQUEsTUFDbEU7QUFBQSxJQUNEO0FBR0EsU0FBSyxhQUFhLEtBQUs7QUFBQSxFQUN4QjtBQUFBLEVBRUEsT0FBTyxNQUFvQixrQkFBMkM7QUFFckUsUUFBSSxLQUFLLFNBQVMsZ0JBQWdCLEtBQUssbUJBQW1CLElBQUksS0FBSyxLQUFLLFNBQVMsU0FBUyxDQUFDLEdBQUc7QUFDN0YsV0FBSyxrQkFBa0IsS0FBSyxLQUFLLFNBQVMsU0FBUyxHQUFHLEtBQUssVUFBVSxLQUFLO0FBQzFFLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLFVBQVUsTUFBTSxnQkFBZ0I7QUFBQSxFQUM3QztBQUFBLEVBRVEsVUFBVSxNQUFvQixrQkFBMkM7QUFDaEYsU0FBSyxhQUFhO0FBQ2xCLFFBQUkscUJBQXFCLGVBQWUsUUFBUTtBQUMvQyxXQUFLLGFBQWE7QUFDbEIsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFJLEtBQUssZ0JBQWdCLGdCQUFnQixJQUFJLEdBQUc7QUFDL0MsYUFBTztBQUFBLElBQ1I7QUFHQSxVQUFNLFNBQVMsS0FBSyx3QkFBd0IsSUFBSSxLQUFLLEtBQUssU0FBUyxTQUFTLENBQUM7QUFDN0UsVUFBTSxZQUFZLFFBQVEsT0FBTyxLQUFLLFNBQVMsS0FBSyxLQUFLLFNBQVMsTUFBTSxLQUFLLFNBQVMsSUFBSSxHQUFHLEtBQUssTUFBTSxVQUFRLENBQUMsRUFBRSxLQUFLLFVBQVUsS0FBSyxPQUFPLFNBQVMsSUFBSSxFQUFFO0FBRTdKLFVBQU0sbUJBQW1CLENBQUMsQ0FBQyxZQUFZLE9BQU8sS0FBSyxVQUFVLEtBQUssVUFBVSxLQUFLLEtBQUssVUFBVSxLQUFLLFdBQVc7QUFDaEgsUUFBSSxvQkFBb0IsS0FBSyxRQUFRLFlBQVk7QUFDaEQsV0FBSyxhQUFhO0FBQ2xCLFlBQU0sVUFBVSxLQUFLLGNBQWM7QUFDbkMsWUFBTSxTQUFTLFFBQVEsS0FBSyxPQUFLLEVBQUUsWUFBWSxLQUFLLG1CQUFtQixPQUFPLGdCQUFnQixFQUFFLFVBQVUsS0FBSyxRQUFRLENBQUM7QUFDeEgsVUFBSSxVQUFVLEtBQUssU0FBUyxLQUFLLGdCQUFnQixnQkFBZ0IsS0FBSyxRQUFRLEdBQUc7QUFDaEYsYUFBSyx1QkFBdUIsSUFBSSxNQUFNO0FBQ3RDLGVBQU87QUFBQSxNQUNSO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsVUFBVSxVQUFlLGNBQW1CLGFBQStCO0FBQzFFLFVBQU0sYUFBYSxLQUFLLG1CQUFtQixJQUFJLGFBQWEsU0FBUyxDQUFDLEdBQUcsV0FBVyxRQUFRO0FBQzVGLFVBQU0sd0JBQXdCLFlBQVksMEJBQTBCLFNBQVMsTUFBTSxXQUFXO0FBRzlGLFdBQU8sMEJBQTBCLFNBQVksUUFBUSxDQUFDO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsWUFBUSxLQUFLLFNBQVM7QUFBQSxFQUN2QjtBQUNEO0FBL01hLGNBQU47QUFBQSxFQWFKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWxCVTtBQWtOTixJQUFNLGFBQU4sTUFBc0Q7QUFBQSxFQUU1RCxZQUNvQyxpQkFDUSxnQkFDMUM7QUFGa0M7QUFDUTtBQUFBLEVBQ3hDO0FBQUEsRUFFSixRQUFRLE9BQXFCLE9BQTZCO0FBRXpELFFBQUksTUFBTSxRQUFRO0FBQ2pCLFVBQUksTUFBTSxRQUFRO0FBQ2pCLGNBQU0sYUFBYSxLQUFLLGVBQWUsbUJBQW1CLE1BQU0sUUFBUTtBQUN4RSxjQUFNLGFBQWEsS0FBSyxlQUFlLG1CQUFtQixNQUFNLFFBQVE7QUFDeEUsZUFBTyxjQUFjLGFBQWMsV0FBVyxRQUFRLFdBQVcsUUFBUztBQUFBLE1BQzNFO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLE1BQU0sUUFBUTtBQUNqQixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sWUFBWSxLQUFLLGdCQUFnQix1QkFBdUI7QUFDOUQsVUFBTSx1QkFBdUIsS0FBSyxnQkFBZ0IsdUJBQXVCO0FBQ3pFLFVBQU0sVUFBVSxLQUFLLGdCQUFnQix1QkFBdUI7QUFDNUQsUUFBSSxTQUFTO0FBQ1osT0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLE9BQU8sS0FBSztBQUFBLElBQy9CO0FBRUEsUUFBSTtBQUNKLFFBQUk7QUFDSixZQUFRLHNCQUFzQjtBQUFBLE1BQzdCLEtBQUs7QUFDSiwyQkFBbUI7QUFDbkIsZ0NBQXdCO0FBQ3hCO0FBQUEsTUFDRCxLQUFLO0FBQ0osMkJBQW1CO0FBQ25CLGdDQUF3QjtBQUN4QjtBQUFBLE1BQ0QsS0FBSztBQUNKLDJCQUFtQjtBQUNuQixnQ0FBd0I7QUFDeEI7QUFBQSxNQUNEO0FBRUMsMkJBQW1CO0FBQ25CLGdDQUF3QjtBQUFBLElBQzFCO0FBR0EsWUFBUSxXQUFXO0FBQUEsTUFDbEIsS0FBSztBQUNKLFlBQUksTUFBTSxlQUFlLENBQUMsTUFBTSxhQUFhO0FBQzVDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksTUFBTSxlQUFlLENBQUMsTUFBTSxhQUFhO0FBQzVDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksTUFBTSxlQUFlLE1BQU0sYUFBYTtBQUMzQyxpQkFBTyxpQkFBaUIsTUFBTSxNQUFNLE1BQU0sSUFBSTtBQUFBLFFBQy9DO0FBRUE7QUFBQSxNQUVELEtBQUs7QUFDSixZQUFJLE1BQU0sZUFBZSxDQUFDLE1BQU0sYUFBYTtBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFFQSxZQUFJLE1BQU0sZUFBZSxDQUFDLE1BQU0sYUFBYTtBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFFQTtBQUFBLE1BRUQsS0FBSztBQUNKLFlBQUksTUFBTSxlQUFlLENBQUMsTUFBTSxhQUFhO0FBQzVDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksTUFBTSxlQUFlLENBQUMsTUFBTSxhQUFhO0FBQzVDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksTUFBTSxZQUFZLENBQUMsTUFBTSxVQUFVO0FBQ3RDLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUksTUFBTSxZQUFZLENBQUMsTUFBTSxVQUFVO0FBQ3RDLGlCQUFPO0FBQUEsUUFDUjtBQUVBO0FBQUEsTUFFRCxLQUFLO0FBQ0o7QUFBQTtBQUFBLE1BRUQ7QUFDQyxZQUFJLE1BQU0sZUFBZSxDQUFDLE1BQU0sYUFBYTtBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFFQSxZQUFJLE1BQU0sZUFBZSxDQUFDLE1BQU0sYUFBYTtBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFFQTtBQUFBLElBQ0Y7QUFHQSxZQUFRLFdBQVc7QUFBQSxNQUNsQixLQUFLO0FBQ0osZUFBTyxzQkFBc0IsTUFBTSxNQUFNLE1BQU0sSUFBSTtBQUFBLE1BRXBELEtBQUs7QUFDSixZQUFJLE1BQU0sVUFBVSxNQUFNLE9BQU87QUFDaEMsaUJBQVEsTUFBTSxTQUFTLE1BQU0sU0FBUyxNQUFNLFFBQVEsTUFBTSxRQUFTLElBQUk7QUFBQSxRQUN4RTtBQUVBLGVBQU8saUJBQWlCLE1BQU0sTUFBTSxNQUFNLElBQUk7QUFBQSxNQUUvQztBQUNDLGVBQU8saUJBQWlCLE1BQU0sTUFBTSxNQUFNLElBQUk7QUFBQSxJQUNoRDtBQUFBLEVBQ0Q7QUFDRDtBQWpJYSxhQUFOO0FBQUEsRUFHSjtBQUFBLEVBQ0E7QUFBQSxHQUpVO0FBbUlOLElBQU0sa0JBQU4sTUFBZ0U7QUFBQSxFQVN0RSxZQUNTLGFBQ2tCLGlCQUNGLGVBQ0EsZUFDVSxnQkFDWixhQUNTLHNCQUNBLHNCQUNHLHlCQUNJLG9CQUNyQztBQVZPO0FBQ2tCO0FBQ0Y7QUFDQTtBQUNVO0FBQ1o7QUFDUztBQUNBO0FBQ0c7QUFDSTtBQWZ2QyxTQUFRLGlDQUE4QyxXQUFXO0FBRWpFLFNBQWlCLGNBQWMsSUFBSSxnQkFBZ0I7QUFDbkQsU0FBUSxjQUFjO0FBY3JCLFVBQU0sdUJBQXVCLENBQUMsTUFBNkM7QUFDMUUsVUFBSSxDQUFDLEtBQUssRUFBRSxxQkFBcUIsNEJBQTRCLEdBQUc7QUFDL0QsYUFBSyxjQUFjLEtBQUsscUJBQXFCLFNBQVMsNEJBQTRCO0FBQUEsTUFDbkY7QUFBQSxJQUNEO0FBQ0EseUJBQXFCLE1BQVM7QUFDOUIsU0FBSyxZQUFZLElBQUksS0FBSyxxQkFBcUIseUJBQXlCLE9BQUsscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0FBQUEsRUFDdEc7QUFBQSxFQUVBLFdBQVcsTUFBd0IsUUFBa0MsYUFBaUMsY0FBZ0QsZUFBMkQ7QUFDaE4sUUFBSSxDQUFDLEtBQUssYUFBYTtBQUN0QixhQUFPO0FBQUEsSUFDUjtBQUdBLFFBQUksUUFBUTtBQUNYLFlBQU0sbUJBQW1CLGdCQUFnQiwrQkFBK0IsUUFBUSxhQUFhO0FBRTdGLFVBQUksa0JBQWtCO0FBQ3JCLGNBQU0sZ0JBQWdCLGdDQUFnQyxjQUFjLE1BQU07QUFFMUUsWUFBSSxpQkFBaUIsY0FBYyxRQUFRLGNBQWMsUUFBUSxHQUFHO0FBQ25FLGdCQUFNLFNBQVMsS0FBSyxlQUFlLE1BQU0sa0JBQWtCLGFBQWEsY0FBYyxhQUFhO0FBRW5HLGNBQUksUUFBUTtBQUNYLGdCQUFJLGNBQWMsWUFBWSxLQUFLLDJCQUEyQjtBQUM3RCxtQkFBSyw0QkFBNEIsY0FBYztBQUMvQyxtQkFBSywrQkFBK0IsUUFBUTtBQUM1QyxtQkFBSyxpQ0FBaUMsYUFBYSxNQUFNO0FBQ3hELDhCQUFjLFFBQVEsVUFBVSxPQUFPLGFBQWE7QUFDcEQscUJBQUssNEJBQTRCO0FBQUEsY0FDbEMsQ0FBQztBQUVELDRCQUFjLFFBQVEsVUFBVSxJQUFJLGFBQWE7QUFBQSxZQUNsRDtBQUVBLG1CQUFPLE9BQU8sV0FBVyxZQUFZLFNBQVMsRUFBRSxHQUFHLFFBQVEsVUFBVSxDQUFDLEVBQUU7QUFBQSxVQUN6RTtBQUVBLGVBQUssK0JBQStCLFFBQVE7QUFDNUMsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLCtCQUErQixRQUFRO0FBQzVDLFdBQU8sS0FBSyxlQUFlLE1BQU0sUUFBUSxhQUFhLGNBQWMsYUFBYTtBQUFBLEVBQ2xGO0FBQUEsRUFFUSxlQUFlLE1BQXdCLFFBQWtDLGFBQWlDLGNBQWdELGVBQTJEO0FBQzVOLFVBQU0sU0FBUyxrQkFBbUIsY0FBYyxXQUFXLENBQUMsZUFBaUIsY0FBYyxVQUFVO0FBQ3JHLFVBQU0sV0FBVyxnQkFBZ0I7QUFDakMsVUFBTSxhQUFjLFlBQVksU0FBVSx1QkFBdUIsT0FBTyx1QkFBdUI7QUFDL0YsVUFBTSxTQUFTLEVBQUUsTUFBTSxZQUFZLFVBQVUsMkJBQTJCLEtBQUs7QUFHN0UsUUFBSSxVQUFVO0FBQ2IsVUFBSSxDQUFDLGlCQUFpQixlQUFlLGNBQWMsT0FBTyxrQkFBa0IsT0FBTyxjQUFjLFNBQVMsR0FBRztBQUM1RyxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsV0FHUyxnQkFBZ0IsaUNBQWlDO0FBQ3pELGFBQU87QUFBQSxJQUNSLE9BR0s7QUFDSixZQUFNLFFBQVEsZ0JBQWdCLDRCQUE0QixJQUE2RDtBQUN2SCxZQUFNLGlCQUFpQixNQUFNLE1BQU0sVUFBUSxLQUFLLE1BQU07QUFFdEQsVUFBSSxDQUFDLFFBQVE7QUFHWixZQUFJLENBQUMsVUFBVSxNQUFNLE1BQU0sT0FBSyxDQUFDLENBQUMsRUFBRSxVQUFVLEVBQUUsT0FBTyxNQUFNLEdBQUc7QUFDL0QsaUJBQU87QUFBQSxRQUNSO0FBR0EsWUFBSSxnQkFBZ0I7QUFDbkIsaUJBQU8sRUFBRSxRQUFRLE1BQU0sUUFBUSxFQUFFLE1BQU0sdUJBQXVCLE1BQU0sVUFBVSwyQkFBMkIsTUFBTSxFQUFFO0FBQUEsUUFDbEg7QUFFQSxlQUFPLEVBQUUsUUFBUSxNQUFNLFFBQVEsbUJBQW1CLE1BQU0sUUFBUSxZQUFZLE1BQU07QUFBQSxNQUNuRjtBQUVBLFVBQUksQ0FBQyxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQzFCLGVBQU87QUFBQSxNQUNSO0FBRUEsVUFBSSxDQUFDLFVBQVUsTUFBTSxNQUFNLENBQUMsV0FBVyxPQUFPLFVBQVUsR0FBRztBQUMxRCxlQUFPO0FBQUEsTUFDUjtBQUVBLFVBQUksTUFBTSxLQUFLLENBQUMsV0FBVztBQUMxQixZQUFJLE9BQU8sUUFBUTtBQUNsQixpQkFBTztBQUFBLFFBQ1I7QUFFQSxZQUFJLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxPQUFPLFVBQVUsT0FBTyxRQUFRLEdBQUc7QUFDN0UsaUJBQU87QUFBQSxRQUNSO0FBRUEsWUFBSSxDQUFDLFVBQVUsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLFFBQVEsT0FBTyxRQUFRLEdBQUcsT0FBTyxRQUFRLEdBQUc7QUFDakcsaUJBQU87QUFBQSxRQUNSO0FBRUEsWUFBSSxLQUFLLG1CQUFtQixPQUFPLGdCQUFnQixPQUFPLFVBQVUsT0FBTyxRQUFRLEdBQUc7QUFDckYsaUJBQU87QUFBQSxRQUNSO0FBRUEsZUFBTztBQUFBLE1BQ1IsQ0FBQyxHQUFHO0FBQ0gsZUFBTztBQUFBLE1BQ1I7QUFHQSxVQUFJLGdCQUFnQjtBQUNuQixZQUFJLENBQUMsT0FBTyxRQUFRO0FBQ25CLGlCQUFPO0FBQUEsUUFDUjtBQUVBLFlBQUkscUJBQTZEO0FBQ2pFLGdCQUFRLGNBQWM7QUFBQSxVQUNyQixLQUFLLHFCQUFxQjtBQUFBLFVBQzFCLEtBQUsscUJBQXFCO0FBQ3pCLGlDQUFxQiwyQkFBMkI7QUFBUTtBQUFBLFVBQ3pELEtBQUsscUJBQXFCO0FBQUEsVUFDMUIsS0FBSyxxQkFBcUI7QUFDekIsaUNBQXFCLDJCQUEyQjtBQUFPO0FBQUEsUUFDekQ7QUFDQSxlQUFPLEVBQUUsUUFBUSxNQUFNLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixNQUFNLFVBQVUsbUJBQW1CLEVBQUU7QUFBQSxNQUNwRztBQUFBLElBQ0Q7QUFHQSxRQUFJLENBQUMsUUFBUTtBQUNaLGFBQU8sRUFBRSxRQUFRLE1BQU0sUUFBUSxtQkFBbUIsTUFBTSxPQUFPO0FBQUEsSUFDaEUsT0FHSztBQUNKLFVBQUksT0FBTyxhQUFhO0FBQ3ZCLFlBQUksT0FBTyxZQUFZO0FBQ3RCLGlCQUFPO0FBQUEsUUFDUjtBQUVBLGVBQU8sRUFBRSxRQUFRLE1BQU0sUUFBUSxtQkFBbUIsTUFBTSxRQUFRLFlBQVksS0FBSztBQUFBLE1BQ2xGO0FBRUEsVUFBSSxLQUFLLGVBQWUsYUFBYSxFQUFFLFFBQVEsTUFBTSxZQUFVLE9BQU8sSUFBSSxTQUFTLE1BQU0sT0FBTyxTQUFTLFNBQVMsQ0FBQyxHQUFHO0FBQ3JILGVBQU8sRUFBRSxRQUFRLE1BQU0sUUFBUSxtQkFBbUIsSUFBSSxPQUFPO0FBQUEsTUFDOUQ7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFdBQVcsU0FBc0M7QUFDaEQsUUFBSSxLQUFLLGdCQUFnQixXQUFXLE9BQU8sR0FBRztBQUM3QyxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sUUFBUSxTQUFTLFNBQVM7QUFBQSxFQUNsQztBQUFBLEVBRUEsYUFBYSxVQUEwQixlQUE4QztBQUNwRixRQUFJLFNBQVMsV0FBVyxHQUFHO0FBQzFCLFlBQU0sT0FBTyxnQkFBZ0IsK0JBQStCLFNBQVMsQ0FBQyxHQUFHLGFBQWE7QUFDdEYsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFdBQU8sT0FBTyxTQUFTLE1BQU07QUFBQSxFQUM5QjtBQUFBLEVBRUEsWUFBWSxNQUF3QixlQUFnQztBQUNuRSxVQUFNLFFBQVEsZ0JBQWdCLDRCQUE0QixNQUErRCxhQUFhO0FBQ3RJLFFBQUksU0FBUyxNQUFNLFVBQVUsY0FBYyxjQUFjO0FBRXhELFdBQUsscUJBQXFCLGVBQWUsY0FBWSxvQkFBb0IsVUFBVSxPQUFPLGFBQWEsQ0FBQztBQUl4RyxZQUFNLGdCQUFnQixNQUFNLE9BQU8sT0FBSyxFQUFFLFNBQVMsV0FBVyxRQUFRLElBQUksRUFBRSxJQUFJLE9BQUssRUFBRSxTQUFTLE1BQU07QUFDdEcsVUFBSSxjQUFjLFFBQVE7QUFDekIsc0JBQWMsYUFBYSxRQUFRLGtCQUFrQixPQUFPLEtBQUssVUFBVSxhQUFhLENBQUM7QUFBQSxNQUMxRjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLEtBQUssTUFBd0IsUUFBa0MsYUFBaUMsY0FBZ0QsZUFBeUM7QUFDOUwsU0FBSywrQkFBK0IsUUFBUTtBQUc1QyxRQUFJLFFBQVE7QUFDWCxZQUFNLG1CQUFtQixnQkFBZ0IsK0JBQStCLFFBQVEsYUFBYTtBQUU3RixVQUFJLGtCQUFrQjtBQUNyQixpQkFBUztBQUFBLE1BQ1Y7QUFBQSxJQUNEO0FBR0EsUUFBSSxDQUFDLFFBQVE7QUFDWixlQUFTLEtBQUssZ0JBQWdCLE1BQU0sS0FBSyxnQkFBZ0IsTUFBTSxTQUFTLENBQUM7QUFDekUscUJBQWUscUJBQXFCO0FBQUEsSUFDckM7QUFDQSxRQUFJLENBQUMsT0FBTyxlQUFlLE9BQU8sUUFBUTtBQUN6QyxlQUFTLE9BQU87QUFBQSxJQUNqQjtBQUNBLFFBQUksT0FBTyxZQUFZO0FBQ3RCO0FBQUEsSUFDRDtBQUNBLFVBQU0saUJBQWlCO0FBQ3ZCLFFBQUksQ0FBQyxnQkFBZ0I7QUFDcEI7QUFBQSxJQUNEO0FBRUEsUUFBSTtBQUdILFVBQUksZ0JBQWdCLHVCQUF1QjtBQUUxQyxZQUFJLENBQUMsU0FBVSxxQkFBcUIsS0FBSyxlQUFlLGFBQWEsQ0FBQyxLQUFLLG9CQUFvQixVQUFVLFVBQVUsR0FBSTtBQUN0SCxnQkFBTSxhQUFhLEtBQUsscUJBQXFCLGVBQWUsa0JBQWtCO0FBQzlFLGdCQUFNLFdBQVcsT0FBTyxnQkFBZ0IsZUFBZSxVQUFVO0FBQUEsUUFDbEUsT0FFSztBQUNKLGdCQUFNLGdCQUFnQixLQUFLLHFCQUFxQixlQUFlLGlCQUFpQjtBQUNoRixnQkFBTSxjQUFjLE9BQU8sUUFBUSxhQUFhO0FBQUEsUUFDakQ7QUFBQSxNQUNELE9BR0s7QUFDSixjQUFNLEtBQUssbUJBQW1CLE1BQStELGdCQUFnQixhQUFhLGNBQWMsYUFBYTtBQUFBLE1BQ3RKO0FBQUEsSUFDRCxTQUFTLE9BQU87QUFDZixXQUFLLGNBQWMsTUFBTSxlQUFlLEtBQUssQ0FBQztBQUFBLElBQy9DO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxtQkFBbUIsTUFBNkQsUUFBc0IsYUFBaUMsY0FBZ0QsZUFBeUM7QUFDN08sVUFBTSxlQUFlLGdCQUFnQiw0QkFBNEIsSUFBSTtBQUNyRSxVQUFNLGdCQUFnQixJQUFJLElBQUksYUFBYSxJQUFJLGFBQVcsQ0FBQyxTQUFTLEtBQUssWUFBWSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBRS9GLGVBQVcsQ0FBQyxNQUFNLFNBQVMsS0FBSyxlQUFlO0FBQzlDLFVBQUksV0FBVztBQUNkLGNBQU0saUJBQWlCLEtBQUs7QUFDNUIsWUFBSSxnQkFBZ0I7QUFDbkIscUJBQVcsU0FBUyxnQkFBZ0I7QUFHbkMsMEJBQWMsSUFBSSxPQUFPLElBQUk7QUFBQSxVQUM5QjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFVBQU0sUUFBUSxnQkFBZ0IsQ0FBQyxHQUFHLGNBQWMsS0FBSyxDQUFDLEdBQUcsT0FBSyxFQUFFLFFBQVE7QUFDeEUsVUFBTSxTQUFVLGNBQWMsV0FBVyxDQUFDLGVBQWlCLGNBQWMsVUFBVTtBQUduRixVQUFNLHFCQUFxQixDQUFDLFVBQVUsS0FBSyxxQkFBcUIsU0FBa0IsZ0JBQWdCLHVCQUF1QjtBQUN6SCxRQUFJLG9CQUFvQjtBQUN2QixZQUFNLFVBQVUsTUFBTSxTQUFTLEtBQUssTUFBTSxNQUFNLE9BQUssRUFBRSxNQUFNLElBQUksU0FBUyxvQkFBb0IsdUZBQXVGLElBQ2xMLE1BQU0sU0FBUyxJQUFJLFNBQVMsb0JBQW9CLHFFQUFxRSxNQUFNLFFBQVEsT0FBTyxJQUFJLElBQzdJLE1BQU0sQ0FBQyxFQUFFLFNBQVMsU0FBUyxtQkFBbUIscUZBQXFGLE1BQU0sQ0FBQyxFQUFFLElBQUksSUFDL0ksU0FBUyxlQUFlLG1EQUFtRCxNQUFNLENBQUMsRUFBRSxNQUFNLE9BQU8sSUFBSTtBQUMxRyxZQUFNLFNBQVMsTUFBTSxTQUFTLEtBQUssQ0FBQyxNQUFNLE1BQU0sT0FBSyxFQUFFLE1BQU0sSUFBSSxvQkFBb0IsTUFBTSxJQUFJLE9BQUssRUFBRSxRQUFRLENBQUMsSUFBSTtBQUVuSCxZQUFNLGVBQWUsTUFBTSxLQUFLLGNBQWMsUUFBUTtBQUFBLFFBQ3JEO0FBQUEsUUFDQTtBQUFBLFFBQ0EsVUFBVTtBQUFBLFVBQ1QsT0FBTyxTQUFTLGlCQUFpQixxQkFBcUI7QUFBQSxRQUN2RDtBQUFBLFFBQ0EsZUFBZSxTQUFTLEVBQUUsS0FBSyxtQkFBbUIsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsUUFBUTtBQUFBLE1BQ2pHLENBQUM7QUFFRCxVQUFJLENBQUMsYUFBYSxXQUFXO0FBQzVCO0FBQUEsTUFDRDtBQUdBLFVBQUksYUFBYSxvQkFBb0IsTUFBTTtBQUMxQyxjQUFNLEtBQUsscUJBQXFCLFlBQVksZ0JBQWdCLHlCQUF5QixLQUFLO0FBQUEsTUFDM0Y7QUFBQSxJQUNEO0FBRUEsVUFBTSxLQUFLLGlCQUFpQixNQUFNLE9BQU8sT0FBSyxFQUFFLE1BQU0sR0FBRyxRQUFRLFlBQVk7QUFFN0UsVUFBTSxVQUFVLE1BQU0sT0FBTyxPQUFLLENBQUMsRUFBRSxNQUFNO0FBQzNDLFFBQUksUUFBUTtBQUNYLGFBQU8sS0FBSywyQkFBMkIsU0FBUyxNQUFNO0FBQUEsSUFDdkQ7QUFFQSxXQUFPLEtBQUssMkJBQTJCLFNBQVMsTUFBTTtBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxNQUFjLGlCQUFpQixPQUF1QixRQUFzQixjQUErRDtBQUMxSSxRQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3ZCO0FBQUEsSUFDRDtBQUVBLFVBQU0sVUFBVSxLQUFLLGVBQWUsYUFBYSxFQUFFO0FBQ25ELFFBQUk7QUFDSixVQUFNLGdCQUEwQixDQUFDO0FBQ2pDLFVBQU0sd0JBQXdELENBQUM7QUFDL0QsVUFBTSxjQUE4QyxDQUFDO0FBRXJELGFBQVMsUUFBUSxHQUFHLFFBQVEsUUFBUSxRQUFRLFNBQVM7QUFDcEQsWUFBTSxPQUFPO0FBQUEsUUFDWixLQUFLLFFBQVEsS0FBSyxFQUFFO0FBQUEsUUFDcEIsTUFBTSxRQUFRLEtBQUssRUFBRTtBQUFBLE1BQ3RCO0FBR0EsVUFBSSxrQkFBa0IsZ0JBQWdCLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxRQUFRLEtBQUssRUFBRSxLQUFLLE9BQU8sUUFBUSxHQUFHO0FBQ2xILHNCQUFjO0FBQUEsTUFDZjtBQUdBLGlCQUFXLFFBQVEsT0FBTztBQUN6QixZQUFJLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxRQUFRLEtBQUssRUFBRSxLQUFLLEtBQUssUUFBUSxHQUFHO0FBQzlFLHdCQUFjLEtBQUssS0FBSztBQUN4QjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsVUFBSSxNQUFNLE1BQU0sT0FBSyxFQUFFLFNBQVMsU0FBUyxNQUFNLFFBQVEsS0FBSyxFQUFFLElBQUksU0FBUyxDQUFDLEdBQUc7QUFDOUUsOEJBQXNCLEtBQUssSUFBSTtBQUFBLE1BQ2hDLE9BQU87QUFDTixvQkFBWSxLQUFLLElBQUk7QUFBQSxNQUN0QjtBQUFBLElBQ0Q7QUFDQSxRQUFJLGdCQUFnQixRQUFXO0FBQzlCLG9CQUFjLHNCQUFzQjtBQUFBLElBQ3JDLE9BQU87QUFDTixjQUFRLGNBQWM7QUFBQSxRQUNyQixLQUFLLHFCQUFxQjtBQUFBLFFBQzFCLEtBQUsscUJBQXFCO0FBQ3pCO0FBQ0E7QUFBQSxNQUNGO0FBR0EsaUJBQVcsZUFBZSxlQUFlO0FBQ3hDLFlBQUksY0FBYyxhQUFhO0FBQzlCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsMEJBQXNCLE9BQU8sYUFBYSxHQUFHLEdBQUcsV0FBVztBQUUzRCxXQUFPLEtBQUssd0JBQXdCLGNBQWMsR0FBRyxzQkFBc0IsUUFBUSxxQkFBcUI7QUFBQSxFQUN6RztBQUFBLEVBRUEsTUFBYywyQkFBMkIsU0FBeUIsUUFBcUM7QUFHdEcsVUFBTSxpQkFBaUIsS0FBSyxxQkFBcUIsU0FBOEIsRUFBRTtBQUNqRixVQUFNLG9CQUF3QyxDQUFDO0FBQy9DLGVBQVcsRUFBRSxVQUFVLFlBQVksS0FBSyxTQUFTO0FBQ2hELFlBQU0saUJBQWlCLGVBQWUsc0JBQXNCO0FBQzVELFlBQU0sY0FBYyxNQUFNO0FBQUEsUUFBeUIsS0FBSztBQUFBLFFBQ3ZELEtBQUs7QUFBQSxRQUNMLEtBQUs7QUFBQSxRQUNMO0FBQUEsUUFDQSxFQUFFLFVBQVUsYUFBYSxlQUFlO0FBQUEsUUFDeEMsZUFBZTtBQUFBLE1BQ2hCO0FBQ0EsVUFBSSxDQUFDLGFBQWE7QUFDakI7QUFBQSxNQUNEO0FBQ0EsWUFBTSxlQUFlLElBQUksaUJBQWlCLFVBQVUsYUFBYSxFQUFFLE1BQU0sTUFBTSxXQUFXLGVBQWUsQ0FBQztBQUMxRyx3QkFBa0IsS0FBSyxZQUFZO0FBQUEsSUFDcEM7QUFDQSxVQUFNLGNBQWMsMkJBQTJCLE9BQU87QUFDdEQsVUFBTSxLQUFLLGdCQUFnQixjQUFjLG1CQUFtQjtBQUFBLE1BQzNELG1CQUFtQixlQUFlLGdCQUFnQixpQkFBaUIsV0FBVyxlQUFlLGdCQUFnQixpQkFBaUI7QUFBQSxNQUM5SCxXQUFXLFNBQVMsUUFBUSxZQUFZLFdBQVc7QUFBQSxNQUNuRCxlQUFlLFNBQVMsV0FBVyxlQUFlLFdBQVc7QUFBQSxJQUM5RCxDQUFDO0FBRUQsVUFBTSxVQUFVLGtCQUFrQixPQUFPLFVBQVE7QUFDaEQsWUFBTSxPQUFPLEtBQUssY0FBYyxLQUFLLGdCQUFnQixZQUFZLEtBQUssV0FBVyxJQUFJO0FBQ3JGLGFBQU8sUUFBUSxDQUFDLEtBQUs7QUFBQSxJQUN0QixDQUFDLEVBQUUsSUFBSSxXQUFTLEVBQUUsVUFBVSxLQUFLLGFBQWEsU0FBUyxFQUFFLFFBQVEsS0FBSyxFQUFFLEVBQUU7QUFFMUUsVUFBTSxLQUFLLGNBQWMsWUFBWSxPQUFPO0FBQUEsRUFDN0M7QUFBQSxFQUVBLE1BQWMsMkJBQTJCLFNBQXlCLFFBQXFDO0FBR3RHLFVBQU0sb0JBQW9CLFFBQVEsT0FBTyxZQUFVLENBQUMsT0FBTyxVQUFVLEVBQUUsSUFBSSxZQUFVLElBQUksaUJBQWlCLE9BQU8sVUFBVSxTQUFTLE9BQU8sVUFBVSxPQUFPLElBQUksQ0FBQyxDQUFDO0FBQ2xLLFVBQU0sY0FBYywyQkFBMkIsT0FBTztBQUN0RCxVQUFNLFVBQVU7QUFBQSxNQUNmLG1CQUFtQixLQUFLLHFCQUFxQixTQUE4QixFQUFFLFNBQVMsZ0JBQWdCLGlCQUFpQjtBQUFBLE1BQ3ZILFdBQVcsU0FBUyxRQUFRLFlBQVksV0FBVztBQUFBLE1BQ25ELGVBQWUsU0FBUyxVQUFVLGNBQWMsV0FBVztBQUFBLElBQzVEO0FBRUEsUUFBSTtBQUNILFlBQU0sS0FBSyxnQkFBZ0IsY0FBYyxtQkFBbUIsT0FBTztBQUFBLElBQ3BFLFNBQVMsT0FBTztBQUdmLFVBQXlCLE1BQU8sd0JBQXdCLG9CQUFvQixvQkFBb0I7QUFFL0YsY0FBTSxhQUFvQixDQUFDO0FBQzNCLG1CQUFXLFFBQVEsbUJBQW1CO0FBQ3JDLGNBQUksS0FBSyxlQUFlLE1BQU0sS0FBSyxZQUFZLE9BQU8sS0FBSyxXQUFXLEdBQUc7QUFDeEUsdUJBQVcsS0FBSyxLQUFLLFdBQVc7QUFBQSxVQUNqQztBQUFBLFFBQ0Q7QUFHQSxjQUFNLFVBQVUsaUNBQWlDLFVBQVU7QUFDM0QsY0FBTSxFQUFFLFVBQVUsSUFBSSxNQUFNLEtBQUssY0FBYyxRQUFRLE9BQU87QUFDOUQsWUFBSSxXQUFXO0FBQ2QsZ0JBQU0sS0FBSyxnQkFBZ0IsY0FBYyxrQkFBa0IsSUFBSSxRQUFNLElBQUksaUJBQWlCLEdBQUcsYUFBYSxHQUFHLGFBQWEsRUFBRSxXQUFXLEtBQUssQ0FBQyxDQUFDLEdBQUcsT0FBTztBQUFBLFFBQ3pKO0FBQUEsTUFDRCxPQUdLO0FBQ0osY0FBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBZSw0QkFBNEIsTUFBNkQsZ0JBQTRDO0FBQ25KLFFBQUksS0FBSyxTQUFTO0FBQ2pCLGFBQU8sS0FBSztBQUFBLElBQ2I7QUFHQSxRQUFJLGtCQUFrQixLQUFLLFNBQVMsV0FBVyxHQUFHO0FBQ2pELFdBQUssVUFBVSxDQUFDLGdCQUFnQiwrQkFBK0IsS0FBSyxTQUFTLENBQUMsR0FBRyxjQUFjLENBQUM7QUFDaEcsYUFBTyxLQUFLO0FBQUEsSUFDYjtBQUVBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLE9BQWUsK0JBQStCLE1BQW9CLFdBQW9DO0FBQ3JHLFVBQU0sU0FBUyxJQUFJLFVBQVUsU0FBUyxFQUFFLFNBQVMsaUJBQWlCLFVBQVUsU0FBUyxVQUFVLE9BQU87QUFDdEcsVUFBTSxnQkFBZ0IsZ0NBQWdDLE1BQU07QUFFNUQsUUFBSSxlQUFlO0FBQ2xCLFlBQU0sRUFBRSxPQUFPLE1BQU0sSUFBSTtBQUV6QixVQUFJLElBQUksUUFBUTtBQUNoQixhQUFPLElBQUksU0FBUyxLQUFLLFFBQVE7QUFDaEMsZUFBTyxLQUFLO0FBQ1o7QUFBQSxNQUNEO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsWUFBa0I7QUFDakIsU0FBSywrQkFBK0IsUUFBUTtBQUFBLEVBQzdDO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFNBQUssK0JBQStCLFFBQVE7QUFBQSxFQUM3QztBQUNEO0FBamZhLGdCQUNZLDBCQUEwQjtBQUR0QyxrQkFBTjtBQUFBLEVBV0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBbkJVO0FBbWZiLFNBQVMsZ0NBQWdDLFFBQW1IO0FBQzNKLE1BQUksQ0FBRSxJQUFJLGNBQWMsTUFBTSxHQUFJO0FBQ2pDLFdBQU87QUFBQSxFQUNSO0FBRUEsTUFBSSxVQUE4QjtBQUVsQyxTQUFPLFdBQVcsQ0FBQyxRQUFRLFVBQVUsU0FBUyxpQkFBaUIsR0FBRztBQUNqRSxRQUFJLFFBQVEsVUFBVSxTQUFTLFlBQVksS0FBSyxRQUFRLGFBQWEsdUJBQXVCLEdBQUc7QUFDOUYsWUFBTSxRQUFRLE9BQU8sUUFBUSxhQUFhLHVCQUF1QixDQUFDO0FBQ2xFLFlBQU0sUUFBUSxPQUFPLFFBQVEsYUFBYSx1QkFBdUIsQ0FBQztBQUVsRSxVQUFJLFNBQVMsS0FBSyxLQUFLLFNBQVMsS0FBSyxHQUFHO0FBQ3ZDLGVBQU8sRUFBRSxTQUFrQixPQUFPLE1BQU07QUFBQSxNQUN6QztBQUFBLElBQ0Q7QUFFQSxjQUFVLFFBQVE7QUFBQSxFQUNuQjtBQUVBLFNBQU87QUFDUjtBQUVPLFNBQVMsdUJBQXVCLFFBQTZEO0FBQ25HLFNBQU8sQ0FBQyxDQUFDLGdDQUFnQyxNQUFNO0FBQ2hEO0FBRU8sTUFBTSw0QkFBOEU7QUFBQSxFQUUxRixpQkFBaUIsTUFBNkI7QUFDN0MsV0FBTyxLQUFLLFVBQVUsQ0FBQyxLQUFLLGVBQWUsZ0JBQWdCLG9CQUFvQixDQUFDLEtBQUssVUFBVSxLQUFLLE9BQU87QUFBQSxFQUM1RztBQUNEO0FBRUEsU0FBUywyQkFBMkIsT0FBK0I7QUFDbEUsTUFBSSxNQUFNLFdBQVcsR0FBRztBQUN2QixXQUFPLE1BQU0sQ0FBQyxFQUFFO0FBQUEsRUFDakI7QUFFQSxNQUFJLE1BQU0sTUFBTSxPQUFLLEVBQUUsV0FBVyxHQUFHO0FBQ3BDLFdBQU8sU0FBUyxtQkFBbUIsZUFBZSxNQUFNLE1BQU07QUFBQSxFQUMvRDtBQUNBLE1BQUksTUFBTSxNQUFNLE9BQUssQ0FBQyxFQUFFLFdBQVcsR0FBRztBQUNyQyxXQUFPLFNBQVMsaUJBQWlCLGFBQWEsTUFBTSxNQUFNO0FBQUEsRUFDM0Q7QUFFQSxTQUFPLEdBQUcsTUFBTSxNQUFNO0FBQ3ZCOyIsCiAgIm5hbWVzIjogWyJjaGlsZHJlbiIsICJoaXRNYXhSZXN1bHRzIiwgIm5vZGVDb250cm9sbGVycyIsICJ2YWx1ZSJdCn0K
