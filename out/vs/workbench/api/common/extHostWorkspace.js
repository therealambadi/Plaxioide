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
import { delta as arrayDelta, mapArrayOrNot } from "../../../base/common/arrays.js";
import { AsyncIterableObject, Barrier } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { AsyncEmitter, Emitter } from "../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { Schemas } from "../../../base/common/network.js";
import { Counter } from "../../../base/common/numbers.js";
import { basename, basenameOrAuthority, dirname, ExtUri, relativePath } from "../../../base/common/resources.js";
import { compare } from "../../../base/common/strings.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { FileSystemProviderCapabilities } from "../../../platform/files/common/files.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { Severity } from "../../../platform/notification/common/notification.js";
import { Workspace, WorkspaceFolder } from "../../../platform/workspace/common/workspace.js";
import { IExtHostFileSystemInfo } from "./extHostFileSystemInfo.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { GlobPattern } from "./extHostTypeConverters.js";
import { Range } from "./extHostTypes.js";
import { IURITransformerService } from "./extHostUriTransformerService.js";
import { resultIsMatch } from "../../services/search/common/search.js";
import { MainContext } from "./extHost.protocol.js";
import { revive } from "../../../base/common/marshalling.js";
import { ExcludeSettingOptions, TextSearchContext2, TextSearchMatch2 } from "../../services/search/common/searchExtTypes.js";
import { VSBuffer } from "../../../base/common/buffer.js";
function isFolderEqual(folderA, folderB, extHostFileSystemInfo) {
  return new ExtUri((uri) => ignorePathCasing(uri, extHostFileSystemInfo)).isEqual(folderA, folderB);
}
function compareWorkspaceFolderByUri(a, b, extHostFileSystemInfo) {
  return isFolderEqual(a.uri, b.uri, extHostFileSystemInfo) ? 0 : compare(a.uri.toString(), b.uri.toString());
}
function compareWorkspaceFolderByUriAndNameAndIndex(a, b, extHostFileSystemInfo) {
  if (a.index !== b.index) {
    return a.index < b.index ? -1 : 1;
  }
  return isFolderEqual(a.uri, b.uri, extHostFileSystemInfo) ? compare(a.name, b.name) : compare(a.uri.toString(), b.uri.toString());
}
function delta(oldFolders, newFolders, compare2, extHostFileSystemInfo) {
  const oldSortedFolders = oldFolders.slice(0).sort((a, b) => compare2(a, b, extHostFileSystemInfo));
  const newSortedFolders = newFolders.slice(0).sort((a, b) => compare2(a, b, extHostFileSystemInfo));
  return arrayDelta(oldSortedFolders, newSortedFolders, (a, b) => compare2(a, b, extHostFileSystemInfo));
}
function ignorePathCasing(uri, extHostFileSystemInfo) {
  const capabilities = extHostFileSystemInfo.getCapabilities(uri.scheme);
  return !(capabilities && capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
}
class ExtHostWorkspaceImpl extends Workspace {
  constructor(id, _name, folders, transient, configuration, _isUntitled, ignorePathCasing2) {
    super(id, folders.map((f) => new WorkspaceFolder(f)), transient, configuration, ignorePathCasing2);
    this._name = _name;
    this._isUntitled = _isUntitled;
    this._workspaceFolders = [];
    this._structure = TernarySearchTree.forUris(ignorePathCasing2, () => true);
    folders.forEach((folder) => {
      this._workspaceFolders.push(folder);
      this._structure.set(folder.uri, folder);
    });
  }
  static toExtHostWorkspace(data, previousConfirmedWorkspace, previousUnconfirmedWorkspace, extHostFileSystemInfo) {
    if (!data) {
      return { workspace: null, added: [], removed: [] };
    }
    const { id, name, folders, configuration, transient, isUntitled } = data;
    const newWorkspaceFolders = [];
    const oldWorkspace = previousConfirmedWorkspace;
    if (previousConfirmedWorkspace) {
      folders.forEach((folderData, index) => {
        const folderUri = URI.revive(folderData.uri);
        const existingFolder = ExtHostWorkspaceImpl._findFolder(previousUnconfirmedWorkspace || previousConfirmedWorkspace, folderUri, extHostFileSystemInfo);
        if (existingFolder) {
          existingFolder.name = folderData.name;
          existingFolder.index = folderData.index;
          newWorkspaceFolders.push(existingFolder);
        } else {
          newWorkspaceFolders.push({ uri: folderUri, name: folderData.name, index });
        }
      });
    } else {
      newWorkspaceFolders.push(...folders.map(({ uri, name: name2, index }) => ({ uri: URI.revive(uri), name: name2, index })));
    }
    newWorkspaceFolders.sort((f1, f2) => f1.index < f2.index ? -1 : 1);
    const workspace = new ExtHostWorkspaceImpl(id, name, newWorkspaceFolders, !!transient, configuration ? URI.revive(configuration) : null, !!isUntitled, (uri) => ignorePathCasing(uri, extHostFileSystemInfo));
    const { added, removed } = delta(oldWorkspace ? oldWorkspace.workspaceFolders : [], workspace.workspaceFolders, compareWorkspaceFolderByUri, extHostFileSystemInfo);
    return { workspace, added, removed };
  }
  static _findFolder(workspace, folderUriToFind, extHostFileSystemInfo) {
    for (let i = 0; i < workspace.folders.length; i++) {
      const folder = workspace.workspaceFolders[i];
      if (isFolderEqual(folder.uri, folderUriToFind, extHostFileSystemInfo)) {
        return folder;
      }
    }
    return void 0;
  }
  get name() {
    return this._name;
  }
  get isUntitled() {
    return this._isUntitled;
  }
  get workspaceFolders() {
    return this._workspaceFolders.slice(0);
  }
  getWorkspaceFolder(uri, resolveParent) {
    if (resolveParent && this._structure.get(uri)) {
      uri = dirname(uri);
    }
    return this._structure.findSubstr(uri);
  }
  resolveWorkspaceFolder(uri) {
    return this._structure.get(uri);
  }
}
let ExtHostWorkspace = class {
  constructor(extHostRpc, initData, extHostFileSystemInfo, logService, uriTransformerService) {
    this._onDidChangeWorkspace = new Emitter();
    this.onDidChangeWorkspace = this._onDidChangeWorkspace.event;
    this._onDidGrantWorkspaceTrust = new Emitter();
    this.onDidGrantWorkspaceTrust = this._onDidGrantWorkspaceTrust.event;
    this._activeSearchCallbacks = [];
    this._trusted = false;
    this._editSessionIdentityProviders = /* @__PURE__ */ new Map();
    // --- edit sessions ---
    this._providerHandlePool = 0;
    this._onWillCreateEditSessionIdentityEvent = new AsyncEmitter();
    // --- canonical uri identity ---
    this._canonicalUriProviders = /* @__PURE__ */ new Map();
    this._logService = logService;
    this._extHostFileSystemInfo = extHostFileSystemInfo;
    this._uriTransformerService = uriTransformerService;
    this._requestIdProvider = new Counter();
    this._barrier = new Barrier();
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadWorkspace);
    this._messageService = extHostRpc.getProxy(MainContext.MainThreadMessageService);
    const data = initData.workspace;
    this._confirmedWorkspace = data ? new ExtHostWorkspaceImpl(data.id, data.name, [], !!data.transient, data.configuration ? URI.revive(data.configuration) : null, !!data.isUntitled, (uri) => ignorePathCasing(uri, extHostFileSystemInfo)) : void 0;
  }
  $initializeWorkspace(data, trusted) {
    this._trusted = trusted;
    this.$acceptWorkspaceData(data);
    this._barrier.open();
  }
  waitForInitializeCall() {
    return this._barrier.wait();
  }
  // --- workspace ---
  get workspace() {
    return this._actualWorkspace;
  }
  get name() {
    return this._actualWorkspace ? this._actualWorkspace.name : void 0;
  }
  get workspaceFile() {
    if (this._actualWorkspace) {
      if (this._actualWorkspace.configuration) {
        if (this._actualWorkspace.isUntitled) {
          return URI.from({ scheme: Schemas.untitled, path: basename(dirname(this._actualWorkspace.configuration)) });
        }
        return this._actualWorkspace.configuration;
      }
    }
    return void 0;
  }
  get _actualWorkspace() {
    return this._unconfirmedWorkspace || this._confirmedWorkspace;
  }
  getWorkspaceFolders() {
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.workspaceFolders.slice(0);
  }
  async getWorkspaceFolders2() {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.workspaceFolders.slice(0);
  }
  updateWorkspaceFolders(extension, index, deleteCount, ...workspaceFoldersToAdd) {
    const validatedDistinctWorkspaceFoldersToAdd = [];
    if (Array.isArray(workspaceFoldersToAdd)) {
      workspaceFoldersToAdd.forEach((folderToAdd) => {
        if (URI.isUri(folderToAdd.uri) && !validatedDistinctWorkspaceFoldersToAdd.some((f) => isFolderEqual(f.uri, folderToAdd.uri, this._extHostFileSystemInfo))) {
          validatedDistinctWorkspaceFoldersToAdd.push({ uri: folderToAdd.uri, name: folderToAdd.name || basenameOrAuthority(folderToAdd.uri) });
        }
      });
    }
    if (!!this._unconfirmedWorkspace) {
      return false;
    }
    if ([index, deleteCount].some((i) => typeof i !== "number" || i < 0)) {
      return false;
    }
    if (deleteCount === 0 && validatedDistinctWorkspaceFoldersToAdd.length === 0) {
      return false;
    }
    const currentWorkspaceFolders = this._actualWorkspace ? this._actualWorkspace.workspaceFolders : [];
    if (index + deleteCount > currentWorkspaceFolders.length) {
      return false;
    }
    const newWorkspaceFolders = currentWorkspaceFolders.slice(0);
    newWorkspaceFolders.splice(index, deleteCount, ...validatedDistinctWorkspaceFoldersToAdd.map((f) => ({
      uri: f.uri,
      name: f.name || basenameOrAuthority(f.uri),
      index: void 0
      /* fixed later */
    })));
    for (let i = 0; i < newWorkspaceFolders.length; i++) {
      const folder = newWorkspaceFolders[i];
      if (newWorkspaceFolders.some((otherFolder, index2) => index2 !== i && isFolderEqual(folder.uri, otherFolder.uri, this._extHostFileSystemInfo))) {
        return false;
      }
    }
    newWorkspaceFolders.forEach((f, index2) => f.index = index2);
    const { added, removed } = delta(currentWorkspaceFolders, newWorkspaceFolders, compareWorkspaceFolderByUriAndNameAndIndex, this._extHostFileSystemInfo);
    if (added.length === 0 && removed.length === 0) {
      return false;
    }
    if (this._proxy) {
      const extName = extension.displayName || extension.name;
      this._proxy.$updateWorkspaceFolders(extName, index, deleteCount, validatedDistinctWorkspaceFoldersToAdd).then(void 0, (error) => {
        this._unconfirmedWorkspace = void 0;
        const options = { source: { identifier: extension.identifier, label: extension.displayName || extension.name } };
        this._messageService.$showMessage(Severity.Error, localize("updateerror", "Extension '{0}' failed to update workspace folders: {1}", extName, error.toString()), options, []);
      });
    }
    this.trySetWorkspaceFolders(newWorkspaceFolders);
    return true;
  }
  getWorkspaceFolder(uri, resolveParent) {
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.getWorkspaceFolder(uri, resolveParent);
  }
  async getWorkspaceFolder2(uri, resolveParent) {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.getWorkspaceFolder(uri, resolveParent);
  }
  async resolveWorkspaceFolder(uri) {
    await this._barrier.wait();
    if (!this._actualWorkspace) {
      return void 0;
    }
    return this._actualWorkspace.resolveWorkspaceFolder(uri);
  }
  getPath() {
    if (!this._actualWorkspace) {
      return void 0;
    }
    const { folders } = this._actualWorkspace;
    if (folders.length === 0) {
      return void 0;
    }
    return folders[0].uri.fsPath;
  }
  getRelativePath(pathOrUri, includeWorkspace) {
    let resource;
    let path = "";
    if (typeof pathOrUri === "string") {
      resource = URI.file(pathOrUri);
      path = pathOrUri;
    } else if (typeof pathOrUri !== "undefined") {
      resource = pathOrUri;
      path = pathOrUri.fsPath;
    }
    if (!resource) {
      return path;
    }
    const folder = this.getWorkspaceFolder(
      resource,
      true
    );
    if (!folder) {
      return path;
    }
    if (typeof includeWorkspace === "undefined" && this._actualWorkspace) {
      includeWorkspace = this._actualWorkspace.folders.length > 1;
    }
    let result = relativePath(folder.uri, resource);
    if (includeWorkspace && folder.name) {
      result = `${folder.name}/${result}`;
    }
    return result;
  }
  trySetWorkspaceFolders(folders) {
    if (this._actualWorkspace) {
      this._unconfirmedWorkspace = ExtHostWorkspaceImpl.toExtHostWorkspace({
        id: this._actualWorkspace.id,
        name: this._actualWorkspace.name,
        configuration: this._actualWorkspace.configuration,
        folders,
        isUntitled: this._actualWorkspace.isUntitled
      }, this._actualWorkspace, void 0, this._extHostFileSystemInfo).workspace || void 0;
    }
  }
  $acceptWorkspaceData(data) {
    const { workspace, added, removed } = ExtHostWorkspaceImpl.toExtHostWorkspace(data, this._confirmedWorkspace, this._unconfirmedWorkspace, this._extHostFileSystemInfo);
    this._confirmedWorkspace = workspace || void 0;
    this._unconfirmedWorkspace = void 0;
    this._onDidChangeWorkspace.fire(Object.freeze({
      added,
      removed
    }));
  }
  // --- search ---
  /**
   * Note, null/undefined have different and important meanings for "exclude"
   */
  findFiles(include, exclude, maxResults, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findFiles: fileSearch, extension: ${extensionId.value}, entryPoint: findFiles`);
    let excludeString = "";
    let useFileExcludes = true;
    if (exclude === null) {
      useFileExcludes = false;
    } else if (exclude !== void 0) {
      if (typeof exclude === "string") {
        excludeString = exclude;
      } else {
        excludeString = exclude.pattern;
      }
    }
    return this._findFilesImpl({ type: "include", value: include }, {
      exclude: [excludeString],
      maxResults,
      useExcludeSettings: useFileExcludes ? ExcludeSettingOptions.FilesExclude : ExcludeSettingOptions.None,
      useIgnoreFiles: {
        local: false
      }
    }, token);
  }
  findFiles2(filePatterns, options = {}, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findFiles2New: fileSearch, extension: ${extensionId.value}, entryPoint: findFiles2New`);
    return this._findFilesImpl({ type: "filePatterns", value: filePatterns }, options, token);
  }
  async _findFilesImpl(query, options, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve([]);
    }
    const filePatternsToUse = query.type === "include" ? [query.value] : query.value ?? [];
    if (!Array.isArray(filePatternsToUse)) {
      console.error("Invalid file pattern provided", filePatternsToUse);
      throw new Error(`Invalid file pattern provided ${JSON.stringify(filePatternsToUse)}`);
    }
    const queryOptions = filePatternsToUse.map((filePattern) => {
      const excludePatterns = globsToISearchPatternBuilder(options.exclude);
      const fileQueries = {
        ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
        disregardIgnoreFiles: typeof options.useIgnoreFiles?.local === "boolean" ? !options.useIgnoreFiles.local : void 0,
        disregardGlobalIgnoreFiles: typeof options.useIgnoreFiles?.global === "boolean" ? !options.useIgnoreFiles.global : void 0,
        disregardParentIgnoreFiles: typeof options.useIgnoreFiles?.parent === "boolean" ? !options.useIgnoreFiles.parent : void 0,
        disregardExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings === ExcludeSettingOptions.None,
        disregardSearchExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings !== ExcludeSettingOptions.SearchAndFilesExclude,
        maxResults: options.maxResults,
        excludePattern: excludePatterns.length > 0 ? excludePatterns : void 0,
        _reason: "startFileSearch",
        shouldGlobSearch: query.type === "include" ? void 0 : true
      };
      const parseInclude = parseSearchExcludeInclude(GlobPattern.from(filePattern));
      const folderToUse = parseInclude?.folder;
      if (query.type === "include") {
        fileQueries.includePattern = parseInclude?.pattern;
      } else {
        fileQueries.filePattern = parseInclude?.pattern;
      }
      return {
        folder: folderToUse,
        options: fileQueries
      };
    });
    return this._findFilesBase(queryOptions, token);
  }
  async _findFilesBase(queryOptions, token) {
    const result = await Promise.all(queryOptions?.map(
      (option) => this._proxy.$startFileSearch(
        option.folder ?? null,
        option.options,
        token
      ).then((data) => Array.isArray(data) ? data.map((d) => URI.revive(d)) : [])
    ) ?? []);
    return result.flat();
  }
  findTextInFiles2(query, options, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findTextInFiles2: textSearch, extension: ${extensionId.value}, entryPoint: findTextInFiles2`);
    const getOptions = (include) => {
      if (!options) {
        return {
          folder: void 0,
          options: {}
        };
      }
      const parsedInclude = include ? parseSearchExcludeInclude(GlobPattern.from(include)) : void 0;
      const excludePatterns = options.exclude ? globsToISearchPatternBuilder(options.exclude) : void 0;
      return {
        options: {
          ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
          disregardIgnoreFiles: typeof options.useIgnoreFiles === "boolean" ? !options.useIgnoreFiles : void 0,
          disregardGlobalIgnoreFiles: typeof options.useIgnoreFiles?.global === "boolean" ? !options.useIgnoreFiles?.global : void 0,
          disregardParentIgnoreFiles: typeof options.useIgnoreFiles?.parent === "boolean" ? !options.useIgnoreFiles?.parent : void 0,
          disregardExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings === ExcludeSettingOptions.None,
          disregardSearchExcludeSettings: options.useExcludeSettings !== void 0 && options.useExcludeSettings !== ExcludeSettingOptions.SearchAndFilesExclude,
          fileEncoding: options.encoding,
          maxResults: options.maxResults,
          previewOptions: options.previewOptions ? {
            matchLines: options.previewOptions?.numMatchLines ?? 100,
            charsPerLine: options.previewOptions?.charsPerLine ?? 1e4
          } : void 0,
          surroundingContext: options.surroundingContext,
          includePattern: parsedInclude?.pattern,
          excludePattern: excludePatterns
        },
        folder: parsedInclude?.folder
      };
    };
    const queryOptionsRaw = options?.include?.map((include) => getOptions(include)) ?? [getOptions(void 0)];
    const queryOptions = queryOptionsRaw.filter((queryOps) => !!queryOps);
    const disposables = new DisposableStore();
    const progressEmitter = disposables.add(new Emitter());
    const complete = this.findTextInFilesBase(
      query,
      queryOptions,
      (result, uri) => progressEmitter.fire({ result, uri }),
      token
    );
    const asyncIterable = new AsyncIterableObject(async (emitter) => {
      disposables.add(progressEmitter.event((e) => {
        const result = e.result;
        const uri = e.uri;
        if (resultIsMatch(result)) {
          emitter.emitOne(new TextSearchMatch2(
            uri,
            result.rangeLocations.map((range) => ({
              previewRange: new Range(range.preview.startLineNumber, range.preview.startColumn, range.preview.endLineNumber, range.preview.endColumn),
              sourceRange: new Range(range.source.startLineNumber, range.source.startColumn, range.source.endLineNumber, range.source.endColumn)
            })),
            result.previewText
          ));
        } else {
          emitter.emitOne(new TextSearchContext2(
            uri,
            result.text,
            result.lineNumber
          ));
        }
      }));
      await complete;
    });
    return {
      results: asyncIterable,
      complete: complete.then((e) => {
        disposables.dispose();
        return {
          limitHit: e?.limitHit ?? false
        };
      })
    };
  }
  async findTextInFilesBase(query, queryOptions, callback, token = CancellationToken.None) {
    const requestId = this._requestIdProvider.getNext();
    let isCanceled = false;
    token.onCancellationRequested((_) => {
      isCanceled = true;
    });
    this._activeSearchCallbacks[requestId] = (p) => {
      if (isCanceled) {
        return;
      }
      const uri = URI.revive(p.resource);
      p.results.forEach((rawResult) => {
        const result = revive(rawResult);
        callback(result, uri);
      });
    };
    if (token.isCancellationRequested) {
      return {};
    }
    try {
      const result = await Promise.all(queryOptions?.map(
        (option) => this._proxy.$startTextSearch(
          query,
          option.folder ?? null,
          option.options,
          requestId,
          token
        ) || {}
      ) ?? []);
      delete this._activeSearchCallbacks[requestId];
      return result.reduce((acc, val) => {
        return {
          limitHit: acc?.limitHit || (val?.limitHit ?? false),
          message: [acc?.message ?? [], val?.message ?? []].flat()
        };
      }, {}) ?? { limitHit: false };
    } catch (err) {
      delete this._activeSearchCallbacks[requestId];
      throw err;
    }
  }
  async findTextInFiles(query, options, callback, extensionId, token = CancellationToken.None) {
    this._logService.trace(`extHostWorkspace#findTextInFiles: textSearch, extension: ${extensionId.value}, entryPoint: findTextInFiles`);
    const previewOptions = typeof options.previewOptions === "undefined" ? {
      matchLines: 100,
      charsPerLine: 1e4
    } : options.previewOptions;
    const parsedInclude = parseSearchExcludeInclude(GlobPattern.from(options.include));
    const excludePattern = typeof options.exclude === "string" ? options.exclude : options.exclude ? options.exclude.pattern : void 0;
    const queryOptions = {
      ignoreSymlinks: typeof options.followSymlinks === "boolean" ? !options.followSymlinks : void 0,
      disregardIgnoreFiles: typeof options.useIgnoreFiles === "boolean" ? !options.useIgnoreFiles : void 0,
      disregardGlobalIgnoreFiles: typeof options.useGlobalIgnoreFiles === "boolean" ? !options.useGlobalIgnoreFiles : void 0,
      disregardParentIgnoreFiles: typeof options.useParentIgnoreFiles === "boolean" ? !options.useParentIgnoreFiles : void 0,
      disregardExcludeSettings: typeof options.useDefaultExcludes === "boolean" ? !options.useDefaultExcludes : true,
      disregardSearchExcludeSettings: typeof options.useSearchExclude === "boolean" ? !options.useSearchExclude : true,
      fileEncoding: options.encoding,
      maxResults: options.maxResults,
      previewOptions,
      surroundingContext: options.afterContext,
      // TODO: remove ability to have before/after context separately
      includePattern: parsedInclude?.pattern,
      excludePattern: excludePattern ? [{ pattern: excludePattern }] : void 0
    };
    const progress = (result, uri) => {
      if (resultIsMatch(result)) {
        callback({
          uri,
          preview: {
            text: result.previewText,
            matches: mapArrayOrNot(
              result.rangeLocations,
              (m) => new Range(m.preview.startLineNumber, m.preview.startColumn, m.preview.endLineNumber, m.preview.endColumn)
            )
          },
          ranges: mapArrayOrNot(
            result.rangeLocations,
            (r) => new Range(r.source.startLineNumber, r.source.startColumn, r.source.endLineNumber, r.source.endColumn)
          )
        });
      } else {
        callback({
          uri,
          text: result.text,
          lineNumber: result.lineNumber
        });
      }
    };
    return this.findTextInFilesBase(query, [{ options: queryOptions, folder: parsedInclude?.folder }], progress, token);
  }
  $handleTextSearchResult(result, requestId) {
    this._activeSearchCallbacks[requestId]?.(result);
  }
  async save(uri) {
    const result = await this._proxy.$save(uri, { saveAs: false });
    return URI.revive(result);
  }
  async saveAs(uri) {
    const result = await this._proxy.$save(uri, { saveAs: true });
    return URI.revive(result);
  }
  saveAll(includeUntitled) {
    return this._proxy.$saveAll(includeUntitled);
  }
  resolveProxy(url) {
    return this._proxy.$resolveProxy(url);
  }
  lookupAuthorization(authInfo) {
    return this._proxy.$lookupAuthorization(authInfo);
  }
  lookupKerberosAuthorization(url) {
    return this._proxy.$lookupKerberosAuthorization(url);
  }
  loadCertificates() {
    return this._proxy.$loadCertificates();
  }
  // --- trust ---
  get trusted() {
    return this._trusted;
  }
  requestWorkspaceTrust(options) {
    return this._proxy.$requestWorkspaceTrust(options);
  }
  $onDidGrantWorkspaceTrust() {
    if (!this._trusted) {
      this._trusted = true;
      this._onDidGrantWorkspaceTrust.fire();
    }
  }
  // called by ext host
  registerEditSessionIdentityProvider(scheme, provider) {
    if (this._editSessionIdentityProviders.has(scheme)) {
      throw new Error(`A provider has already been registered for scheme ${scheme}`);
    }
    this._editSessionIdentityProviders.set(scheme, provider);
    const outgoingScheme = this._uriTransformerService.transformOutgoingScheme(scheme);
    const handle = this._providerHandlePool++;
    this._proxy.$registerEditSessionIdentityProvider(handle, outgoingScheme);
    return toDisposable(() => {
      this._editSessionIdentityProviders.delete(scheme);
      this._proxy.$unregisterEditSessionIdentityProvider(handle);
    });
  }
  // called by main thread
  async $getEditSessionIdentifier(workspaceFolder, cancellationToken) {
    this._logService.info("Getting edit session identifier for workspaceFolder", workspaceFolder);
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (!folder) {
      this._logService.warn("Unable to resolve workspace folder");
      return void 0;
    }
    this._logService.info("Invoking #provideEditSessionIdentity for workspaceFolder", folder);
    const provider = this._editSessionIdentityProviders.get(folder.uri.scheme);
    this._logService.info(`Provider for scheme ${folder.uri.scheme} is defined: `, !!provider);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideEditSessionIdentity(folder, cancellationToken);
    this._logService.info("Provider returned edit session identifier: ", result);
    if (!result) {
      return void 0;
    }
    return result;
  }
  async $provideEditSessionIdentityMatch(workspaceFolder, identity1, identity2, cancellationToken) {
    this._logService.info("Getting edit session identifier for workspaceFolder", workspaceFolder);
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (!folder) {
      this._logService.warn("Unable to resolve workspace folder");
      return void 0;
    }
    this._logService.info("Invoking #provideEditSessionIdentity for workspaceFolder", folder);
    const provider = this._editSessionIdentityProviders.get(folder.uri.scheme);
    this._logService.info(`Provider for scheme ${folder.uri.scheme} is defined: `, !!provider);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideEditSessionIdentityMatch?.(identity1, identity2, cancellationToken);
    this._logService.info("Provider returned edit session identifier match result: ", result);
    if (!result) {
      return void 0;
    }
    return result;
  }
  getOnWillCreateEditSessionIdentityEvent(extension) {
    return (listener, thisArg, disposables) => {
      const wrappedListener = function wrapped(e) {
        listener.call(thisArg, e);
      };
      wrappedListener.extension = extension;
      return this._onWillCreateEditSessionIdentityEvent.event(wrappedListener, void 0, disposables);
    };
  }
  // main thread calls this to trigger participants
  async $onWillCreateEditSessionIdentity(workspaceFolder, token, timeout) {
    const folder = await this.resolveWorkspaceFolder(URI.revive(workspaceFolder));
    if (folder === void 0) {
      throw new Error("Unable to resolve workspace folder");
    }
    await this._onWillCreateEditSessionIdentityEvent.fireAsync({ workspaceFolder: folder }, token, async (thenable, listener) => {
      const now = Date.now();
      await Promise.resolve(thenable);
      if (Date.now() - now > timeout) {
        this._logService.warn("SLOW edit session create-participant", listener.extension.identifier);
      }
    });
    if (token.isCancellationRequested) {
      return void 0;
    }
  }
  // called by ext host
  registerCanonicalUriProvider(scheme, provider) {
    if (this._canonicalUriProviders.has(scheme)) {
      throw new Error(`A provider has already been registered for scheme ${scheme}`);
    }
    this._canonicalUriProviders.set(scheme, provider);
    const outgoingScheme = this._uriTransformerService.transformOutgoingScheme(scheme);
    const handle = this._providerHandlePool++;
    this._proxy.$registerCanonicalUriProvider(handle, outgoingScheme);
    return toDisposable(() => {
      this._canonicalUriProviders.delete(scheme);
      this._proxy.$unregisterCanonicalUriProvider(handle);
    });
  }
  async provideCanonicalUri(uri, options, cancellationToken) {
    const provider = this._canonicalUriProviders.get(uri.scheme);
    if (!provider) {
      return void 0;
    }
    const result = await provider.provideCanonicalUri?.(URI.revive(uri), options, cancellationToken);
    if (!result) {
      return void 0;
    }
    return result;
  }
  // called by main thread
  async $provideCanonicalUri(uri, targetScheme, cancellationToken) {
    return this.provideCanonicalUri(URI.revive(uri), { targetScheme }, cancellationToken);
  }
  // --- encodings ---
  decode(content, uri, options) {
    return this._proxy.$decode(VSBuffer.wrap(content), uri, options);
  }
  async encode(content, uri, options) {
    const buff = await this._proxy.$encode(content, uri, options);
    return buff.buffer;
  }
};
ExtHostWorkspace = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostInitDataService),
  __decorateParam(2, IExtHostFileSystemInfo),
  __decorateParam(3, ILogService),
  __decorateParam(4, IURITransformerService)
], ExtHostWorkspace);
const IExtHostWorkspace = createDecorator("IExtHostWorkspace");
function parseSearchExcludeInclude(include) {
  let pattern;
  let includeFolder;
  if (include) {
    if (typeof include === "string") {
      pattern = include;
    } else {
      pattern = include.pattern;
      includeFolder = URI.revive(include.baseUri);
    }
    return {
      pattern,
      folder: includeFolder
    };
  }
  return void 0;
}
function globsToISearchPatternBuilder(excludes) {
  return (excludes?.map((exclude) => {
    if (typeof exclude === "string") {
      if (exclude === "") {
        return void 0;
      }
      return {
        pattern: exclude,
        uri: void 0
      };
    } else {
      const parsedExclude = parseSearchExcludeInclude(exclude);
      if (!parsedExclude) {
        return void 0;
      }
      return {
        pattern: parsedExclude.pattern,
        uri: parsedExclude.folder
      };
    }
  }) ?? []).filter((e) => !!e);
}
export {
  ExtHostWorkspace,
  IExtHostWorkspace
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0V29ya3NwYWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGVsdGEgYXMgYXJyYXlEZWx0YSwgbWFwQXJyYXlPck5vdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBBc3luY0l0ZXJhYmxlT2JqZWN0LCBCYXJyaWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQXN5bmNFbWl0dGVyLCBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRlcm5hcnlTZWFyY2hUcmVlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGVybmFyeVNlYXJjaFRyZWUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgQ291bnRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGJhc2VuYW1lT3JBdXRob3JpdHksIGRpcm5hbWUsIEV4dFVyaSwgcmVsYXRpdmVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGNvbXBhcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBFZGl0U2Vzc2lvbklkZW50aXR5TWF0Y2ggfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2UsIFdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0RmlsZVN5c3RlbUluZm8gfSBmcm9tICcuL2V4dEhvc3RGaWxlU3lzdGVtSW5mby5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdEluaXREYXRhU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdEluaXREYXRhU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFJwY1NlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RScGNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEdsb2JQYXR0ZXJuIH0gZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVVJJVHJhbnNmb3JtZXJTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0VXJpVHJhbnNmb3JtZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlUXVlcnlCdWlsZGVyT3B0aW9ucywgSVNlYXJjaFBhdHRlcm5CdWlsZGVyLCBJVGV4dFF1ZXJ5QnVpbGRlck9wdGlvbnMgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3F1ZXJ5QnVpbGRlci5qcyc7XG5pbXBvcnQgeyBJUmF3RmlsZU1hdGNoMiwgSVRleHRTZWFyY2hSZXN1bHQsIHJlc3VsdElzTWF0Y2ggfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgRXh0SG9zdFdvcmtzcGFjZVNoYXBlLCBJUmVsYXRpdmVQYXR0ZXJuRHRvLCBJV29ya3NwYWNlRGF0YSwgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRNZXNzYWdlT3B0aW9ucywgTWFpblRocmVhZE1lc3NhZ2VTZXJ2aWNlU2hhcGUsIE1haW5UaHJlYWRXb3Jrc3BhY2VTaGFwZSB9IGZyb20gJy4vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBBdXRoSW5mbywgQ3JlZGVudGlhbHMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucywgVGV4dFNlYXJjaENvbnRleHQyLCBUZXh0U2VhcmNoTWF0Y2gyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2hFeHRUeXBlcy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dEhvc3RXb3Jrc3BhY2VQcm92aWRlciB7XG5cdGdldFdvcmtzcGFjZUZvbGRlcjIodXJpOiB2c2NvZGUuVXJpLCByZXNvbHZlUGFyZW50PzogYm9vbGVhbik6IFByb21pc2U8dnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZD47XG5cdHJlc29sdmVXb3Jrc3BhY2VGb2xkZXIodXJpOiB2c2NvZGUuVXJpKTogUHJvbWlzZTx2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkPjtcblx0Z2V0V29ya3NwYWNlRm9sZGVyczIoKTogUHJvbWlzZTx2c2NvZGUuV29ya3NwYWNlRm9sZGVyW10gfCB1bmRlZmluZWQ+O1xuXHRyZXNvbHZlUHJveHkodXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdGxvb2t1cEF1dGhvcml6YXRpb24oYXV0aEluZm86IEF1dGhJbmZvKTogUHJvbWlzZTxDcmVkZW50aWFscyB8IHVuZGVmaW5lZD47XG5cdGxvb2t1cEtlcmJlcm9zQXV0aG9yaXphdGlvbih1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0bG9hZENlcnRpZmljYXRlcygpOiBQcm9taXNlPHN0cmluZ1tdPjtcbn1cblxuZnVuY3Rpb24gaXNGb2xkZXJFcXVhbChmb2xkZXJBOiBVUkksIGZvbGRlckI6IFVSSSwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvOiBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvKTogYm9vbGVhbiB7XG5cdHJldHVybiBuZXcgRXh0VXJpKHVyaSA9PiBpZ25vcmVQYXRoQ2FzaW5nKHVyaSwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvKSkuaXNFcXVhbChmb2xkZXJBLCBmb2xkZXJCKTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZVdvcmtzcGFjZUZvbGRlckJ5VXJpKGE6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIsIGI6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbzogSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyk6IG51bWJlciB7XG5cdHJldHVybiBpc0ZvbGRlckVxdWFsKGEudXJpLCBiLnVyaSwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvKSA/IDAgOiBjb21wYXJlKGEudXJpLnRvU3RyaW5nKCksIGIudXJpLnRvU3RyaW5nKCkpO1xufVxuXG5mdW5jdGlvbiBjb21wYXJlV29ya3NwYWNlRm9sZGVyQnlVcmlBbmROYW1lQW5kSW5kZXgoYTogdnNjb2RlLldvcmtzcGFjZUZvbGRlciwgYjogdnNjb2RlLldvcmtzcGFjZUZvbGRlciwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvOiBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvKTogbnVtYmVyIHtcblx0aWYgKGEuaW5kZXggIT09IGIuaW5kZXgpIHtcblx0XHRyZXR1cm4gYS5pbmRleCA8IGIuaW5kZXggPyAtMSA6IDE7XG5cdH1cblxuXHRyZXR1cm4gaXNGb2xkZXJFcXVhbChhLnVyaSwgYi51cmksIGV4dEhvc3RGaWxlU3lzdGVtSW5mbykgPyBjb21wYXJlKGEubmFtZSwgYi5uYW1lKSA6IGNvbXBhcmUoYS51cmkudG9TdHJpbmcoKSwgYi51cmkudG9TdHJpbmcoKSk7XG59XG5cbmZ1bmN0aW9uIGRlbHRhKG9sZEZvbGRlcnM6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXSwgbmV3Rm9sZGVyczogdnNjb2RlLldvcmtzcGFjZUZvbGRlcltdLCBjb21wYXJlOiAoYTogdnNjb2RlLldvcmtzcGFjZUZvbGRlciwgYjogdnNjb2RlLldvcmtzcGFjZUZvbGRlciwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvOiBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvKSA9PiBudW1iZXIsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbzogSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyk6IHsgcmVtb3ZlZDogdnNjb2RlLldvcmtzcGFjZUZvbGRlcltdOyBhZGRlZDogdnNjb2RlLldvcmtzcGFjZUZvbGRlcltdIH0ge1xuXHRjb25zdCBvbGRTb3J0ZWRGb2xkZXJzID0gb2xkRm9sZGVycy5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiBjb21wYXJlKGEsIGIsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbykpO1xuXHRjb25zdCBuZXdTb3J0ZWRGb2xkZXJzID0gbmV3Rm9sZGVycy5zbGljZSgwKS5zb3J0KChhLCBiKSA9PiBjb21wYXJlKGEsIGIsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbykpO1xuXG5cdHJldHVybiBhcnJheURlbHRhKG9sZFNvcnRlZEZvbGRlcnMsIG5ld1NvcnRlZEZvbGRlcnMsIChhLCBiKSA9PiBjb21wYXJlKGEsIGIsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbykpO1xufVxuXG5mdW5jdGlvbiBpZ25vcmVQYXRoQ2FzaW5nKHVyaTogVVJJLCBleHRIb3N0RmlsZVN5c3RlbUluZm86IElFeHRIb3N0RmlsZVN5c3RlbUluZm8pOiBib29sZWFuIHtcblx0Y29uc3QgY2FwYWJpbGl0aWVzID0gZXh0SG9zdEZpbGVTeXN0ZW1JbmZvLmdldENhcGFiaWxpdGllcyh1cmkuc2NoZW1lKTtcblx0cmV0dXJuICEoY2FwYWJpbGl0aWVzICYmIChjYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpKTtcbn1cblxuaW50ZXJmYWNlIE11dGFibGVXb3Jrc3BhY2VGb2xkZXIgZXh0ZW5kcyB2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHtcblx0bmFtZTogc3RyaW5nO1xuXHRpbmRleDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgUXVlcnlPcHRpb25zPFQ+IHtcblx0b3B0aW9uczogVDtcblx0Zm9sZGVyOiBVUkkgfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIEV4dEhvc3RXb3Jrc3BhY2VJbXBsIGV4dGVuZHMgV29ya3NwYWNlIHtcblxuXHRzdGF0aWMgdG9FeHRIb3N0V29ya3NwYWNlKGRhdGE6IElXb3Jrc3BhY2VEYXRhIHwgbnVsbCwgcHJldmlvdXNDb25maXJtZWRXb3Jrc3BhY2U6IEV4dEhvc3RXb3Jrc3BhY2VJbXBsIHwgdW5kZWZpbmVkLCBwcmV2aW91c1VuY29uZmlybWVkV29ya3NwYWNlOiBFeHRIb3N0V29ya3NwYWNlSW1wbCB8IHVuZGVmaW5lZCwgZXh0SG9zdEZpbGVTeXN0ZW1JbmZvOiBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvKTogeyB3b3Jrc3BhY2U6IEV4dEhvc3RXb3Jrc3BhY2VJbXBsIHwgbnVsbDsgYWRkZWQ6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXTsgcmVtb3ZlZDogdnNjb2RlLldvcmtzcGFjZUZvbGRlcltdIH0ge1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIHsgd29ya3NwYWNlOiBudWxsLCBhZGRlZDogW10sIHJlbW92ZWQ6IFtdIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBpZCwgbmFtZSwgZm9sZGVycywgY29uZmlndXJhdGlvbiwgdHJhbnNpZW50LCBpc1VudGl0bGVkIH0gPSBkYXRhO1xuXHRcdGNvbnN0IG5ld1dvcmtzcGFjZUZvbGRlcnM6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXSA9IFtdO1xuXG5cdFx0Ly8gSWYgd2UgaGF2ZSBhbiBleGlzdGluZyB3b3Jrc3BhY2UsIHdlIHRyeSB0byBmaW5kIHRoZSBmb2xkZXJzIHRoYXQgbWF0Y2ggb3VyXG5cdFx0Ly8gZGF0YSBhbmQgdXBkYXRlIHRoZWlyIHByb3BlcnRpZXMuIEl0IGNvdWxkIGJlIHRoYXQgYW4gZXh0ZW5zaW9uIHN0b3JlZCB0aGVtXG5cdFx0Ly8gZm9yIGxhdGVyIHVzZSBhbmQgd2Ugd2FudCB0byBrZWVwIHRoZW0gXCJsaXZlXCIgaWYgdGhleSBhcmUgc3RpbGwgcHJlc2VudC5cblx0XHRjb25zdCBvbGRXb3Jrc3BhY2UgPSBwcmV2aW91c0NvbmZpcm1lZFdvcmtzcGFjZTtcblx0XHRpZiAocHJldmlvdXNDb25maXJtZWRXb3Jrc3BhY2UpIHtcblx0XHRcdGZvbGRlcnMuZm9yRWFjaCgoZm9sZGVyRGF0YSwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyVXJpID0gVVJJLnJldml2ZShmb2xkZXJEYXRhLnVyaSk7XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nRm9sZGVyID0gRXh0SG9zdFdvcmtzcGFjZUltcGwuX2ZpbmRGb2xkZXIocHJldmlvdXNVbmNvbmZpcm1lZFdvcmtzcGFjZSB8fCBwcmV2aW91c0NvbmZpcm1lZFdvcmtzcGFjZSwgZm9sZGVyVXJpLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pO1xuXG5cdFx0XHRcdGlmIChleGlzdGluZ0ZvbGRlcikge1xuXHRcdFx0XHRcdGV4aXN0aW5nRm9sZGVyLm5hbWUgPSBmb2xkZXJEYXRhLm5hbWU7XG5cdFx0XHRcdFx0ZXhpc3RpbmdGb2xkZXIuaW5kZXggPSBmb2xkZXJEYXRhLmluZGV4O1xuXG5cdFx0XHRcdFx0bmV3V29ya3NwYWNlRm9sZGVycy5wdXNoKGV4aXN0aW5nRm9sZGVyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXdXb3Jrc3BhY2VGb2xkZXJzLnB1c2goeyB1cmk6IGZvbGRlclVyaSwgbmFtZTogZm9sZGVyRGF0YS5uYW1lLCBpbmRleCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1dvcmtzcGFjZUZvbGRlcnMucHVzaCguLi5mb2xkZXJzLm1hcCgoeyB1cmksIG5hbWUsIGluZGV4IH0pID0+ICh7IHVyaTogVVJJLnJldml2ZSh1cmkpLCBuYW1lLCBpbmRleCB9KSkpO1xuXHRcdH1cblxuXHRcdC8vIG1ha2Ugc3VyZSB0byByZXN0b3JlIHNvcnQgb3JkZXIgYmFzZWQgb24gaW5kZXhcblx0XHRuZXdXb3Jrc3BhY2VGb2xkZXJzLnNvcnQoKGYxLCBmMikgPT4gZjEuaW5kZXggPCBmMi5pbmRleCA/IC0xIDogMSk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBuZXcgRXh0SG9zdFdvcmtzcGFjZUltcGwoaWQsIG5hbWUsIG5ld1dvcmtzcGFjZUZvbGRlcnMsICEhdHJhbnNpZW50LCBjb25maWd1cmF0aW9uID8gVVJJLnJldml2ZShjb25maWd1cmF0aW9uKSA6IG51bGwsICEhaXNVbnRpdGxlZCwgdXJpID0+IGlnbm9yZVBhdGhDYXNpbmcodXJpLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pKTtcblx0XHRjb25zdCB7IGFkZGVkLCByZW1vdmVkIH0gPSBkZWx0YShvbGRXb3Jrc3BhY2UgPyBvbGRXb3Jrc3BhY2Uud29ya3NwYWNlRm9sZGVycyA6IFtdLCB3b3Jrc3BhY2Uud29ya3NwYWNlRm9sZGVycywgY29tcGFyZVdvcmtzcGFjZUZvbGRlckJ5VXJpLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pO1xuXG5cdFx0cmV0dXJuIHsgd29ya3NwYWNlLCBhZGRlZCwgcmVtb3ZlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpbmRGb2xkZXIod29ya3NwYWNlOiBFeHRIb3N0V29ya3NwYWNlSW1wbCwgZm9sZGVyVXJpVG9GaW5kOiBVUkksIGV4dEhvc3RGaWxlU3lzdGVtSW5mbzogSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyk6IE11dGFibGVXb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgd29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGZvbGRlciA9IHdvcmtzcGFjZS53b3Jrc3BhY2VGb2xkZXJzW2ldO1xuXHRcdFx0aWYgKGlzRm9sZGVyRXF1YWwoZm9sZGVyLnVyaSwgZm9sZGVyVXJpVG9GaW5kLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pKSB7XG5cdFx0XHRcdHJldHVybiBmb2xkZXI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZUZvbGRlcnM6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdHJ1Y3R1cmU6IFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgdnNjb2RlLldvcmtzcGFjZUZvbGRlcj47XG5cblx0Y29uc3RydWN0b3IoaWQ6IHN0cmluZywgcHJpdmF0ZSBfbmFtZTogc3RyaW5nLCBmb2xkZXJzOiB2c2NvZGUuV29ya3NwYWNlRm9sZGVyW10sIHRyYW5zaWVudDogYm9vbGVhbiwgY29uZmlndXJhdGlvbjogVVJJIHwgbnVsbCwgcHJpdmF0ZSBfaXNVbnRpdGxlZDogYm9vbGVhbiwgaWdub3JlUGF0aENhc2luZzogKGtleTogVVJJKSA9PiBib29sZWFuKSB7XG5cdFx0c3VwZXIoaWQsIGZvbGRlcnMubWFwKGYgPT4gbmV3IFdvcmtzcGFjZUZvbGRlcihmKSksIHRyYW5zaWVudCwgY29uZmlndXJhdGlvbiwgaWdub3JlUGF0aENhc2luZyk7XG5cdFx0dGhpcy5fc3RydWN0dXJlID0gVGVybmFyeVNlYXJjaFRyZWUuZm9yVXJpczx2c2NvZGUuV29ya3NwYWNlRm9sZGVyPihpZ25vcmVQYXRoQ2FzaW5nLCAoKSA9PiB0cnVlKTtcblxuXHRcdC8vIHNldHVwIHRoZSB3b3Jrc3BhY2UgZm9sZGVyIGRhdGEgc3RydWN0dXJlXG5cdFx0Zm9sZGVycy5mb3JFYWNoKGZvbGRlciA9PiB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VGb2xkZXJzLnB1c2goZm9sZGVyKTtcblx0XHRcdHRoaXMuX3N0cnVjdHVyZS5zZXQoZm9sZGVyLnVyaSwgZm9sZGVyKTtcblx0XHR9KTtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWU7XG5cdH1cblxuXHRnZXQgaXNVbnRpdGxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNVbnRpdGxlZDtcblx0fVxuXG5cdGdldCB3b3Jrc3BhY2VGb2xkZXJzKCk6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZUZvbGRlcnMuc2xpY2UoMCk7XG5cdH1cblxuXHRnZXRXb3Jrc3BhY2VGb2xkZXIodXJpOiBVUkksIHJlc29sdmVQYXJlbnQ/OiBib29sZWFuKTogdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHJlc29sdmVQYXJlbnQgJiYgdGhpcy5fc3RydWN0dXJlLmdldCh1cmkpKSB7XG5cdFx0XHQvLyBgdXJpYCBpcyBhIHdvcmtzcGFjZSBmb2xkZXIgc28gd2UgY2hlY2sgZm9yIGl0cyBwYXJlbnRcblx0XHRcdHVyaSA9IGRpcm5hbWUodXJpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3N0cnVjdHVyZS5maW5kU3Vic3RyKHVyaSk7XG5cdH1cblxuXHRyZXNvbHZlV29ya3NwYWNlRm9sZGVyKHVyaTogVVJJKTogdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0cnVjdHVyZS5nZXQodXJpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdFdvcmtzcGFjZSBpbXBsZW1lbnRzIEV4dEhvc3RXb3Jrc3BhY2VTaGFwZSwgSUV4dEhvc3RXb3Jrc3BhY2VQcm92aWRlciB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV29ya3NwYWNlID0gbmV3IEVtaXR0ZXI8dnNjb2RlLldvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VXb3Jrc3BhY2U6IEV2ZW50PHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRHcmFudFdvcmtzcGFjZVRydXN0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRHcmFudFdvcmtzcGFjZVRydXN0OiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkR3JhbnRXb3Jrc3BhY2VUcnVzdC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdElkUHJvdmlkZXI6IENvdW50ZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2JhcnJpZXI6IEJhcnJpZXI7XG5cblx0cHJpdmF0ZSBfY29uZmlybWVkV29ya3NwYWNlPzogRXh0SG9zdFdvcmtzcGFjZUltcGw7XG5cdHByaXZhdGUgX3VuY29uZmlybWVkV29ya3NwYWNlPzogRXh0SG9zdFdvcmtzcGFjZUltcGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRXb3Jrc3BhY2VTaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZVNlcnZpY2U6IE1haW5UaHJlYWRNZXNzYWdlU2VydmljZVNoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRIb3N0RmlsZVN5c3RlbUluZm86IElFeHRIb3N0RmlsZVN5c3RlbUluZm87XG5cdHByaXZhdGUgcmVhZG9ubHkgX3VyaVRyYW5zZm9ybWVyU2VydmljZTogSVVSSVRyYW5zZm9ybWVyU2VydmljZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3RpdmVTZWFyY2hDYWxsYmFja3M6ICgobWF0Y2g6IElSYXdGaWxlTWF0Y2gyKSA9PiBhbnkpW10gPSBbXTtcblxuXHRwcml2YXRlIF90cnVzdGVkOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCB2c2NvZGUuRWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEluaXREYXRhU2VydmljZSBpbml0RGF0YTogSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UsXG5cdFx0QElFeHRIb3N0RmlsZVN5c3RlbUluZm8gZXh0SG9zdEZpbGVTeXN0ZW1JbmZvOiBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVVSSVRyYW5zZm9ybWVyU2VydmljZSB1cmlUcmFuc2Zvcm1lclNlcnZpY2U6IElVUklUcmFuc2Zvcm1lclNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UgPSBsb2dTZXJ2aWNlO1xuXHRcdHRoaXMuX2V4dEhvc3RGaWxlU3lzdGVtSW5mbyA9IGV4dEhvc3RGaWxlU3lzdGVtSW5mbztcblx0XHR0aGlzLl91cmlUcmFuc2Zvcm1lclNlcnZpY2UgPSB1cmlUcmFuc2Zvcm1lclNlcnZpY2U7XG5cdFx0dGhpcy5fcmVxdWVzdElkUHJvdmlkZXIgPSBuZXcgQ291bnRlcigpO1xuXHRcdHRoaXMuX2JhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0UnBjLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRXb3Jrc3BhY2UpO1xuXHRcdHRoaXMuX21lc3NhZ2VTZXJ2aWNlID0gZXh0SG9zdFJwYy5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkTWVzc2FnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGRhdGEgPSBpbml0RGF0YS53b3Jrc3BhY2U7XG5cdFx0dGhpcy5fY29uZmlybWVkV29ya3NwYWNlID0gZGF0YSA/IG5ldyBFeHRIb3N0V29ya3NwYWNlSW1wbChkYXRhLmlkLCBkYXRhLm5hbWUsIFtdLCAhIWRhdGEudHJhbnNpZW50LCBkYXRhLmNvbmZpZ3VyYXRpb24gPyBVUkkucmV2aXZlKGRhdGEuY29uZmlndXJhdGlvbikgOiBudWxsLCAhIWRhdGEuaXNVbnRpdGxlZCwgdXJpID0+IGlnbm9yZVBhdGhDYXNpbmcodXJpLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pKSA6IHVuZGVmaW5lZDtcblx0fVxuXG5cdCRpbml0aWFsaXplV29ya3NwYWNlKGRhdGE6IElXb3Jrc3BhY2VEYXRhIHwgbnVsbCwgdHJ1c3RlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3RydXN0ZWQgPSB0cnVzdGVkO1xuXHRcdHRoaXMuJGFjY2VwdFdvcmtzcGFjZURhdGEoZGF0YSk7XG5cdFx0dGhpcy5fYmFycmllci5vcGVuKCk7XG5cdH1cblxuXHR3YWl0Rm9ySW5pdGlhbGl6ZUNhbGwoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2JhcnJpZXIud2FpdCgpO1xuXHR9XG5cblx0Ly8gLS0tIHdvcmtzcGFjZSAtLS1cblxuXHRnZXQgd29ya3NwYWNlKCk6IFdvcmtzcGFjZSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFdvcmtzcGFjZTtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFdvcmtzcGFjZSA/IHRoaXMuX2FjdHVhbFdvcmtzcGFjZS5uYW1lIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZUZpbGUoKTogdnNjb2RlLlVyaSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2FjdHVhbFdvcmtzcGFjZSkge1xuXHRcdFx0aWYgKHRoaXMuX2FjdHVhbFdvcmtzcGFjZS5jb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuaXNVbnRpdGxlZCkge1xuXHRcdFx0XHRcdHJldHVybiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCwgcGF0aDogYmFzZW5hbWUoZGlybmFtZSh0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuY29uZmlndXJhdGlvbikpIH0pOyAvLyBVbnRpdGxlZCBXb3Jrc3BhY2U6IHJldHVybiB1bnRpdGxlZCBVUklcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuY29uZmlndXJhdGlvbjsgLy8gV29ya3NwYWNlOiByZXR1cm4gdGhlIGNvbmZpZ3VyYXRpb24gbG9jYXRpb25cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgX2FjdHVhbFdvcmtzcGFjZSgpOiBFeHRIb3N0V29ya3NwYWNlSW1wbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3VuY29uZmlybWVkV29ya3NwYWNlIHx8IHRoaXMuX2NvbmZpcm1lZFdvcmtzcGFjZTtcblx0fVxuXG5cdGdldFdvcmtzcGFjZUZvbGRlcnMoKTogdnNjb2RlLldvcmtzcGFjZUZvbGRlcltdIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX2FjdHVhbFdvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFdvcmtzcGFjZS53b3Jrc3BhY2VGb2xkZXJzLnNsaWNlKDApO1xuXHR9XG5cblx0YXN5bmMgZ2V0V29ya3NwYWNlRm9sZGVyczIoKTogUHJvbWlzZTx2c2NvZGUuV29ya3NwYWNlRm9sZGVyW10gfCB1bmRlZmluZWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9iYXJyaWVyLndhaXQoKTtcblx0XHRpZiAoIXRoaXMuX2FjdHVhbFdvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFdvcmtzcGFjZS53b3Jrc3BhY2VGb2xkZXJzLnNsaWNlKDApO1xuXHR9XG5cblx0dXBkYXRlV29ya3NwYWNlRm9sZGVycyhleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaW5kZXg6IG51bWJlciwgZGVsZXRlQ291bnQ6IG51bWJlciwgLi4ud29ya3NwYWNlRm9sZGVyc1RvQWRkOiB7IHVyaTogdnNjb2RlLlVyaTsgbmFtZT86IHN0cmluZyB9W10pOiBib29sZWFuIHtcblx0XHRjb25zdCB2YWxpZGF0ZWREaXN0aW5jdFdvcmtzcGFjZUZvbGRlcnNUb0FkZDogeyB1cmk6IHZzY29kZS5Vcmk7IG5hbWU/OiBzdHJpbmcgfVtdID0gW107XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkod29ya3NwYWNlRm9sZGVyc1RvQWRkKSkge1xuXHRcdFx0d29ya3NwYWNlRm9sZGVyc1RvQWRkLmZvckVhY2goZm9sZGVyVG9BZGQgPT4ge1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKGZvbGRlclRvQWRkLnVyaSkgJiYgIXZhbGlkYXRlZERpc3RpbmN0V29ya3NwYWNlRm9sZGVyc1RvQWRkLnNvbWUoZiA9PiBpc0ZvbGRlckVxdWFsKGYudXJpLCBmb2xkZXJUb0FkZC51cmksIHRoaXMuX2V4dEhvc3RGaWxlU3lzdGVtSW5mbykpKSB7XG5cdFx0XHRcdFx0dmFsaWRhdGVkRGlzdGluY3RXb3Jrc3BhY2VGb2xkZXJzVG9BZGQucHVzaCh7IHVyaTogZm9sZGVyVG9BZGQudXJpLCBuYW1lOiBmb2xkZXJUb0FkZC5uYW1lIHx8IGJhc2VuYW1lT3JBdXRob3JpdHkoZm9sZGVyVG9BZGQudXJpKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKCEhdGhpcy5fdW5jb25maXJtZWRXb3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gcHJldmVudCBhY2N1bXVsYXRlZCBjYWxscyB3aXRob3V0IGEgY29uZmlybWVkIHdvcmtzcGFjZVxuXHRcdH1cblxuXHRcdGlmIChbaW5kZXgsIGRlbGV0ZUNvdW50XS5zb21lKGkgPT4gdHlwZW9mIGkgIT09ICdudW1iZXInIHx8IGkgPCAwKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyB2YWxpZGF0ZSBudW1iZXJzXG5cdFx0fVxuXG5cdFx0aWYgKGRlbGV0ZUNvdW50ID09PSAwICYmIHZhbGlkYXRlZERpc3RpbmN0V29ya3NwYWNlRm9sZGVyc1RvQWRkLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBub3RoaW5nIHRvIGRlbGV0ZSBvciBhZGRcblx0XHR9XG5cblx0XHRjb25zdCBjdXJyZW50V29ya3NwYWNlRm9sZGVyczogTXV0YWJsZVdvcmtzcGFjZUZvbGRlcltdID0gdGhpcy5fYWN0dWFsV29ya3NwYWNlID8gdGhpcy5fYWN0dWFsV29ya3NwYWNlLndvcmtzcGFjZUZvbGRlcnMgOiBbXTtcblx0XHRpZiAoaW5kZXggKyBkZWxldGVDb3VudCA+IGN1cnJlbnRXb3Jrc3BhY2VGb2xkZXJzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBjYW5ub3QgZGVsZXRlIG1vcmUgdGhhbiB3ZSBoYXZlXG5cdFx0fVxuXG5cdFx0Ly8gU2ltdWxhdGUgdGhlIHVwZGF0ZVdvcmtzcGFjZUZvbGRlcnMgbWV0aG9kIG9uIG91ciBkYXRhIHRvIGRvIG1vcmUgdmFsaWRhdGlvblxuXHRcdGNvbnN0IG5ld1dvcmtzcGFjZUZvbGRlcnMgPSBjdXJyZW50V29ya3NwYWNlRm9sZGVycy5zbGljZSgwKTtcblx0XHRuZXdXb3Jrc3BhY2VGb2xkZXJzLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLnZhbGlkYXRlZERpc3RpbmN0V29ya3NwYWNlRm9sZGVyc1RvQWRkLm1hcChmID0+ICh7IHVyaTogZi51cmksIG5hbWU6IGYubmFtZSB8fCBiYXNlbmFtZU9yQXV0aG9yaXR5KGYudXJpKSwgaW5kZXg6IHVuZGVmaW5lZCEgLyogZml4ZWQgbGF0ZXIgKi8gfSkpKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbmV3V29ya3NwYWNlRm9sZGVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgZm9sZGVyID0gbmV3V29ya3NwYWNlRm9sZGVyc1tpXTtcblx0XHRcdGlmIChuZXdXb3Jrc3BhY2VGb2xkZXJzLnNvbWUoKG90aGVyRm9sZGVyLCBpbmRleCkgPT4gaW5kZXggIT09IGkgJiYgaXNGb2xkZXJFcXVhbChmb2xkZXIudXJpLCBvdGhlckZvbGRlci51cmksIHRoaXMuX2V4dEhvc3RGaWxlU3lzdGVtSW5mbykpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gY2Fubm90IGFkZCB0aGUgc2FtZSBmb2xkZXIgbXVsdGlwbGUgdGltZXNcblx0XHRcdH1cblx0XHR9XG5cblx0XHRuZXdXb3Jrc3BhY2VGb2xkZXJzLmZvckVhY2goKGYsIGluZGV4KSA9PiBmLmluZGV4ID0gaW5kZXgpOyAvLyBmaXggaW5kZXhcblx0XHRjb25zdCB7IGFkZGVkLCByZW1vdmVkIH0gPSBkZWx0YShjdXJyZW50V29ya3NwYWNlRm9sZGVycywgbmV3V29ya3NwYWNlRm9sZGVycywgY29tcGFyZVdvcmtzcGFjZUZvbGRlckJ5VXJpQW5kTmFtZUFuZEluZGV4LCB0aGlzLl9leHRIb3N0RmlsZVN5c3RlbUluZm8pO1xuXHRcdGlmIChhZGRlZC5sZW5ndGggPT09IDAgJiYgcmVtb3ZlZC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gbm90aGluZyBhY3R1YWxseSBjaGFuZ2VkXG5cdFx0fVxuXG5cdFx0Ly8gVHJpZ2dlciBvbiBtYWluIHNpZGVcblx0XHRpZiAodGhpcy5fcHJveHkpIHtcblx0XHRcdGNvbnN0IGV4dE5hbWUgPSBleHRlbnNpb24uZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uLm5hbWU7XG5cdFx0XHR0aGlzLl9wcm94eS4kdXBkYXRlV29ya3NwYWNlRm9sZGVycyhleHROYW1lLCBpbmRleCwgZGVsZXRlQ291bnQsIHZhbGlkYXRlZERpc3RpbmN0V29ya3NwYWNlRm9sZGVyc1RvQWRkKS50aGVuKHVuZGVmaW5lZCwgZXJyb3IgPT4ge1xuXG5cdFx0XHRcdC8vIGluIGNhc2Ugb2YgYW4gZXJyb3IsIG1ha2Ugc3VyZSB0byBjbGVhciBvdXQgdGhlIHVuY29uZmlybWVkIHdvcmtzcGFjZVxuXHRcdFx0XHQvLyBiZWNhdXNlIHdlIGNhbm5vdCBleHBlY3QgdGhlIGFja25vd2xlZGdlbWVudCBmcm9tIHRoZSBtYWluIHNpZGUgZm9yIHRoaXNcblx0XHRcdFx0dGhpcy5fdW5jb25maXJtZWRXb3Jrc3BhY2UgPSB1bmRlZmluZWQ7XG5cblx0XHRcdFx0Ly8gc2hvdyBlcnJvciB0byB1c2VyXG5cdFx0XHRcdGNvbnN0IG9wdGlvbnM6IE1haW5UaHJlYWRNZXNzYWdlT3B0aW9ucyA9IHsgc291cmNlOiB7IGlkZW50aWZpZXI6IGV4dGVuc2lvbi5pZGVudGlmaWVyLCBsYWJlbDogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lIH0gfTtcblx0XHRcdFx0dGhpcy5fbWVzc2FnZVNlcnZpY2UuJHNob3dNZXNzYWdlKFNldmVyaXR5LkVycm9yLCBsb2NhbGl6ZSgndXBkYXRlZXJyb3InLCBcIkV4dGVuc2lvbiAnezB9JyBmYWlsZWQgdG8gdXBkYXRlIHdvcmtzcGFjZSBmb2xkZXJzOiB7MX1cIiwgZXh0TmFtZSwgZXJyb3IudG9TdHJpbmcoKSksIG9wdGlvbnMsIFtdKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFRyeSB0byBhY2NlcHQgZGlyZWN0bHlcblx0XHR0aGlzLnRyeVNldFdvcmtzcGFjZUZvbGRlcnMobmV3V29ya3NwYWNlRm9sZGVycyk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGdldFdvcmtzcGFjZUZvbGRlcih1cmk6IHZzY29kZS5VcmksIHJlc29sdmVQYXJlbnQ/OiBib29sZWFuKTogdnNjb2RlLldvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9hY3R1YWxXb3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHVyaSwgcmVzb2x2ZVBhcmVudCk7XG5cdH1cblxuXHRhc3luYyBnZXRXb3Jrc3BhY2VGb2xkZXIyKHVyaTogdnNjb2RlLlVyaSwgcmVzb2x2ZVBhcmVudD86IGJvb2xlYW4pOiBQcm9taXNlPHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9iYXJyaWVyLndhaXQoKTtcblx0XHRpZiAoIXRoaXMuX2FjdHVhbFdvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2FjdHVhbFdvcmtzcGFjZS5nZXRXb3Jrc3BhY2VGb2xkZXIodXJpLCByZXNvbHZlUGFyZW50KTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVXb3Jrc3BhY2VGb2xkZXIodXJpOiB2c2NvZGUuVXJpKTogUHJvbWlzZTx2c2NvZGUuV29ya3NwYWNlRm9sZGVyIHwgdW5kZWZpbmVkPiB7XG5cdFx0YXdhaXQgdGhpcy5fYmFycmllci53YWl0KCk7XG5cdFx0aWYgKCF0aGlzLl9hY3R1YWxXb3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9hY3R1YWxXb3Jrc3BhY2UucmVzb2x2ZVdvcmtzcGFjZUZvbGRlcih1cmkpO1xuXHR9XG5cblx0Z2V0UGF0aCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXG5cdFx0Ly8gdGhpcyBpcyBsZWdhY3kgZnJvbSB0aGUgZGF5cyBiZWZvcmUgaGF2aW5nXG5cdFx0Ly8gbXVsdGktcm9vdCBhbmQgd2Uga2VlcCBpdCBvbmx5IGFsaXZlIGlmIHRoZXJlXG5cdFx0Ly8gaXMganVzdCBvbmUgd29ya3NwYWNlIGZvbGRlci5cblx0XHRpZiAoIXRoaXMuX2FjdHVhbFdvcmtzcGFjZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB7IGZvbGRlcnMgfSA9IHRoaXMuX2FjdHVhbFdvcmtzcGFjZTtcblx0XHRpZiAoZm9sZGVycy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdC8vICM1NDQ4MyBASm9oIFdoeSBhcmUgd2Ugc3RpbGwgdXNpbmcgZnNQYXRoP1xuXHRcdHJldHVybiBmb2xkZXJzWzBdLnVyaS5mc1BhdGg7XG5cdH1cblxuXHRnZXRSZWxhdGl2ZVBhdGgocGF0aE9yVXJpOiBzdHJpbmcgfCB2c2NvZGUuVXJpLCBpbmNsdWRlV29ya3NwYWNlPzogYm9vbGVhbik6IHN0cmluZyB7XG5cblx0XHRsZXQgcmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcGF0aDogc3RyaW5nID0gJyc7XG5cdFx0aWYgKHR5cGVvZiBwYXRoT3JVcmkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXNvdXJjZSA9IFVSSS5maWxlKHBhdGhPclVyaSk7XG5cdFx0XHRwYXRoID0gcGF0aE9yVXJpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHBhdGhPclVyaSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJlc291cmNlID0gcGF0aE9yVXJpO1xuXHRcdFx0cGF0aCA9IHBhdGhPclVyaS5mc1BhdGg7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXNvdXJjZSkge1xuXHRcdFx0cmV0dXJuIHBhdGg7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZm9sZGVyID0gdGhpcy5nZXRXb3Jrc3BhY2VGb2xkZXIoXG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdHRydWVcblx0XHQpO1xuXG5cdFx0aWYgKCFmb2xkZXIpIHtcblx0XHRcdHJldHVybiBwYXRoO1xuXHRcdH1cblxuXHRcdGlmICh0eXBlb2YgaW5jbHVkZVdvcmtzcGFjZSA9PT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5fYWN0dWFsV29ya3NwYWNlKSB7XG5cdFx0XHRpbmNsdWRlV29ya3NwYWNlID0gdGhpcy5fYWN0dWFsV29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoID4gMTtcblx0XHR9XG5cblx0XHRsZXQgcmVzdWx0ID0gcmVsYXRpdmVQYXRoKGZvbGRlci51cmksIHJlc291cmNlKTtcblx0XHRpZiAoaW5jbHVkZVdvcmtzcGFjZSAmJiBmb2xkZXIubmFtZSkge1xuXHRcdFx0cmVzdWx0ID0gYCR7Zm9sZGVyLm5hbWV9LyR7cmVzdWx0fWA7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQhO1xuXHR9XG5cblx0cHJpdmF0ZSB0cnlTZXRXb3Jrc3BhY2VGb2xkZXJzKGZvbGRlcnM6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXJbXSk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlIGRpcmVjdGx5IGhlcmUuIFRoZSB3b3Jrc3BhY2UgaXMgdW5jb25maXJtZWQgYXMgbG9uZyBhcyB3ZSBkaWQgbm90IGdldCBhblxuXHRcdC8vIGFja25vd2xlZGdlbWVudCBmcm9tIHRoZSBtYWluIHNpZGUgKHZpYSAkYWNjZXB0V29ya3NwYWNlRGF0YSlcblx0XHRpZiAodGhpcy5fYWN0dWFsV29ya3NwYWNlKSB7XG5cdFx0XHR0aGlzLl91bmNvbmZpcm1lZFdvcmtzcGFjZSA9IEV4dEhvc3RXb3Jrc3BhY2VJbXBsLnRvRXh0SG9zdFdvcmtzcGFjZSh7XG5cdFx0XHRcdGlkOiB0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuaWQsXG5cdFx0XHRcdG5hbWU6IHRoaXMuX2FjdHVhbFdvcmtzcGFjZS5uYW1lLFxuXHRcdFx0XHRjb25maWd1cmF0aW9uOiB0aGlzLl9hY3R1YWxXb3Jrc3BhY2UuY29uZmlndXJhdGlvbixcblx0XHRcdFx0Zm9sZGVycyxcblx0XHRcdFx0aXNVbnRpdGxlZDogdGhpcy5fYWN0dWFsV29ya3NwYWNlLmlzVW50aXRsZWRcblx0XHRcdH0sIHRoaXMuX2FjdHVhbFdvcmtzcGFjZSwgdW5kZWZpbmVkLCB0aGlzLl9leHRIb3N0RmlsZVN5c3RlbUluZm8pLndvcmtzcGFjZSB8fCB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0JGFjY2VwdFdvcmtzcGFjZURhdGEoZGF0YTogSVdvcmtzcGFjZURhdGEgfCBudWxsKTogdm9pZCB7XG5cblx0XHRjb25zdCB7IHdvcmtzcGFjZSwgYWRkZWQsIHJlbW92ZWQgfSA9IEV4dEhvc3RXb3Jrc3BhY2VJbXBsLnRvRXh0SG9zdFdvcmtzcGFjZShkYXRhLCB0aGlzLl9jb25maXJtZWRXb3Jrc3BhY2UsIHRoaXMuX3VuY29uZmlybWVkV29ya3NwYWNlLCB0aGlzLl9leHRIb3N0RmlsZVN5c3RlbUluZm8pO1xuXG5cdFx0Ly8gVXBkYXRlIG91ciB3b3Jrc3BhY2Ugb2JqZWN0LiBXZSBoYXZlIGEgY29uZmlybWVkIHdvcmtzcGFjZSwgc28gd2UgZHJvcCBvdXJcblx0XHQvLyB1bmNvbmZpcm1lZCB3b3Jrc3BhY2UuXG5cdFx0dGhpcy5fY29uZmlybWVkV29ya3NwYWNlID0gd29ya3NwYWNlIHx8IHVuZGVmaW5lZDtcblx0XHR0aGlzLl91bmNvbmZpcm1lZFdvcmtzcGFjZSA9IHVuZGVmaW5lZDtcblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlV29ya3NwYWNlLmZpcmUoT2JqZWN0LmZyZWV6ZSh7XG5cdFx0XHRhZGRlZCxcblx0XHRcdHJlbW92ZWQsXG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tIHNlYXJjaCAtLS1cblxuXHQvKipcblx0ICogTm90ZSwgbnVsbC91bmRlZmluZWQgaGF2ZSBkaWZmZXJlbnQgYW5kIGltcG9ydGFudCBtZWFuaW5ncyBmb3IgXCJleGNsdWRlXCJcblx0ICovXG5cdGZpbmRGaWxlcyhpbmNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQsIGV4Y2x1ZGU6IHZzY29kZS5HbG9iUGF0dGVybiB8IG51bGwgfCB1bmRlZmluZWQsIG1heFJlc3VsdHM6IG51bWJlciB8IHVuZGVmaW5lZCwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTx2c2NvZGUuVXJpW10+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBleHRIb3N0V29ya3NwYWNlI2ZpbmRGaWxlczogZmlsZVNlYXJjaCwgZXh0ZW5zaW9uOiAke2V4dGVuc2lvbklkLnZhbHVlfSwgZW50cnlQb2ludDogZmluZEZpbGVzYCk7XG5cblx0XHRsZXQgZXhjbHVkZVN0cmluZzogc3RyaW5nID0gJyc7XG5cdFx0bGV0IHVzZUZpbGVFeGNsdWRlcyA9IHRydWU7XG5cdFx0aWYgKGV4Y2x1ZGUgPT09IG51bGwpIHtcblx0XHRcdHVzZUZpbGVFeGNsdWRlcyA9IGZhbHNlO1xuXHRcdH0gZWxzZSBpZiAoZXhjbHVkZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpZiAodHlwZW9mIGV4Y2x1ZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGV4Y2x1ZGVTdHJpbmcgPSBleGNsdWRlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZXhjbHVkZVN0cmluZyA9IGV4Y2x1ZGUucGF0dGVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyB0b2RvOiBjb25zaWRlciBleGNsdWRlIGJhc2VVUkkgaWYgYXZhaWxhYmxlXG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRGaWxlc0ltcGwoeyB0eXBlOiAnaW5jbHVkZScsIHZhbHVlOiBpbmNsdWRlIH0sIHtcblx0XHRcdGV4Y2x1ZGU6IFtleGNsdWRlU3RyaW5nXSxcblx0XHRcdG1heFJlc3VsdHMsXG5cdFx0XHR1c2VFeGNsdWRlU2V0dGluZ3M6IHVzZUZpbGVFeGNsdWRlcyA/IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucy5GaWxlc0V4Y2x1ZGUgOiBFeGNsdWRlU2V0dGluZ09wdGlvbnMuTm9uZSxcblx0XHRcdHVzZUlnbm9yZUZpbGVzOiB7XG5cdFx0XHRcdGxvY2FsOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH0sIHRva2VuKTtcblx0fVxuXG5cblx0ZmluZEZpbGVzMihmaWxlUGF0dGVybnM6IHJlYWRvbmx5IHZzY29kZS5HbG9iUGF0dGVybltdLFxuXHRcdG9wdGlvbnM6IHZzY29kZS5GaW5kRmlsZXMyT3B0aW9ucyA9IHt9LFxuXHRcdGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLFxuXHRcdHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTx2c2NvZGUuVXJpW10+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBleHRIb3N0V29ya3NwYWNlI2ZpbmRGaWxlczJOZXc6IGZpbGVTZWFyY2gsIGV4dGVuc2lvbjogJHtleHRlbnNpb25JZC52YWx1ZX0sIGVudHJ5UG9pbnQ6IGZpbmRGaWxlczJOZXdgKTtcblx0XHRyZXR1cm4gdGhpcy5fZmluZEZpbGVzSW1wbCh7IHR5cGU6ICdmaWxlUGF0dGVybnMnLCB2YWx1ZTogZmlsZVBhdHRlcm5zIH0sIG9wdGlvbnMsIHRva2VuKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2ZpbmRGaWxlc0ltcGwoXG5cdFx0Ly8gdGhlIG9sZCBgZmluZEZpbGVzYCB1c2VkIGBpbmNsdWRlYCB0byBxdWVyeSwgYnV0IHRoZSBuZXcgYGZpbmRGaWxlczJgIHVzZXMgYGZpbGVQYXR0ZXJuYCB0byBxdWVyeS5cblx0XHQvLyBgZmlsZVBhdHRlcm5gIGlzIHRoZSBwcm9wZXIgd2F5IHRvIGhhbmRsZSB0aGlzLCBzaW5jZSBpdCB0YWtlcyBsZXNzIHByZWNlZGVuY2UgdGhhbiB0aGUgaWdub3JlIGZpbGVzLlxuXHRcdHF1ZXJ5OiB7IHJlYWRvbmx5IHR5cGU6ICdpbmNsdWRlJzsgcmVhZG9ubHkgdmFsdWU6IHZzY29kZS5HbG9iUGF0dGVybiB8IHVuZGVmaW5lZCB9IHwgeyByZWFkb25seSB0eXBlOiAnZmlsZVBhdHRlcm5zJzsgcmVhZG9ubHkgdmFsdWU6IHJlYWRvbmx5IHZzY29kZS5HbG9iUGF0dGVybltdIH0sXG5cdFx0b3B0aW9uczogdnNjb2RlLkZpbmRGaWxlczJPcHRpb25zLFxuXHRcdHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW5cblx0KTogUHJvbWlzZTx2c2NvZGUuVXJpW10+IHtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW10pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVQYXR0ZXJuc1RvVXNlID0gcXVlcnkudHlwZSA9PT0gJ2luY2x1ZGUnID8gW3F1ZXJ5LnZhbHVlXSA6IHF1ZXJ5LnZhbHVlID8/IFtdO1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShmaWxlUGF0dGVybnNUb1VzZSkpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0ludmFsaWQgZmlsZSBwYXR0ZXJuIHByb3ZpZGVkJywgZmlsZVBhdHRlcm5zVG9Vc2UpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGZpbGUgcGF0dGVybiBwcm92aWRlZCAke0pTT04uc3RyaW5naWZ5KGZpbGVQYXR0ZXJuc1RvVXNlKX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBxdWVyeU9wdGlvbnM6IFF1ZXJ5T3B0aW9uczxJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnM+W10gPSBmaWxlUGF0dGVybnNUb1VzZS5tYXAoZmlsZVBhdHRlcm4gPT4ge1xuXG5cdFx0XHRjb25zdCBleGNsdWRlUGF0dGVybnMgPSBnbG9ic1RvSVNlYXJjaFBhdHRlcm5CdWlsZGVyKG9wdGlvbnMuZXhjbHVkZSk7XG5cblx0XHRcdGNvbnN0IGZpbGVRdWVyaWVzOiBJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnMgPSB7XG5cdFx0XHRcdGlnbm9yZVN5bWxpbmtzOiB0eXBlb2Ygb3B0aW9ucy5mb2xsb3dTeW1saW5rcyA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMuZm9sbG93U3ltbGlua3MgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGRpc3JlZ2FyZElnbm9yZUZpbGVzOiB0eXBlb2Ygb3B0aW9ucy51c2VJZ25vcmVGaWxlcz8ubG9jYWwgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnVzZUlnbm9yZUZpbGVzLmxvY2FsIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRkaXNyZWdhcmRHbG9iYWxJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMudXNlSWdub3JlRmlsZXM/Lmdsb2JhbCA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMudXNlSWdub3JlRmlsZXMuZ2xvYmFsIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRkaXNyZWdhcmRQYXJlbnRJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMudXNlSWdub3JlRmlsZXM/LnBhcmVudCA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMudXNlSWdub3JlRmlsZXMucGFyZW50IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRkaXNyZWdhcmRFeGNsdWRlU2V0dGluZ3M6IG9wdGlvbnMudXNlRXhjbHVkZVNldHRpbmdzICE9PSB1bmRlZmluZWQgJiYgb3B0aW9ucy51c2VFeGNsdWRlU2V0dGluZ3MgPT09IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucy5Ob25lLFxuXHRcdFx0XHRkaXNyZWdhcmRTZWFyY2hFeGNsdWRlU2V0dGluZ3M6IG9wdGlvbnMudXNlRXhjbHVkZVNldHRpbmdzICE9PSB1bmRlZmluZWQgJiYgKG9wdGlvbnMudXNlRXhjbHVkZVNldHRpbmdzICE9PSBFeGNsdWRlU2V0dGluZ09wdGlvbnMuU2VhcmNoQW5kRmlsZXNFeGNsdWRlKSxcblx0XHRcdFx0bWF4UmVzdWx0czogb3B0aW9ucy5tYXhSZXN1bHRzLFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjogZXhjbHVkZVBhdHRlcm5zLmxlbmd0aCA+IDAgPyBleGNsdWRlUGF0dGVybnMgOiB1bmRlZmluZWQsXG5cdFx0XHRcdF9yZWFzb246ICdzdGFydEZpbGVTZWFyY2gnLFxuXHRcdFx0XHRzaG91bGRHbG9iU2VhcmNoOiBxdWVyeS50eXBlID09PSAnaW5jbHVkZScgPyB1bmRlZmluZWQgOiB0cnVlLFxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgcGFyc2VJbmNsdWRlID0gcGFyc2VTZWFyY2hFeGNsdWRlSW5jbHVkZShHbG9iUGF0dGVybi5mcm9tKGZpbGVQYXR0ZXJuKSk7XG5cdFx0XHRjb25zdCBmb2xkZXJUb1VzZSA9IHBhcnNlSW5jbHVkZT8uZm9sZGVyO1xuXHRcdFx0aWYgKHF1ZXJ5LnR5cGUgPT09ICdpbmNsdWRlJykge1xuXHRcdFx0XHRmaWxlUXVlcmllcy5pbmNsdWRlUGF0dGVybiA9IHBhcnNlSW5jbHVkZT8ucGF0dGVybjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZpbGVRdWVyaWVzLmZpbGVQYXR0ZXJuID0gcGFyc2VJbmNsdWRlPy5wYXR0ZXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRmb2xkZXI6IGZvbGRlclRvVXNlLFxuXHRcdFx0XHRvcHRpb25zOiBmaWxlUXVlcmllc1xuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB0aGlzLl9maW5kRmlsZXNCYXNlKHF1ZXJ5T3B0aW9ucywgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZmluZEZpbGVzQmFzZShcblx0XHRxdWVyeU9wdGlvbnM6IFF1ZXJ5T3B0aW9uczxJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnM+W10gfCB1bmRlZmluZWQsXG5cdFx0dG9rZW46IENhbmNlbGxhdGlvblRva2VuXG5cdCk6IFByb21pc2U8dnNjb2RlLlVyaVtdPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwocXVlcnlPcHRpb25zPy5tYXAob3B0aW9uID0+IHRoaXMuX3Byb3h5LiRzdGFydEZpbGVTZWFyY2goXG5cdFx0XHRvcHRpb24uZm9sZGVyID8/IG51bGwsXG5cdFx0XHRvcHRpb24ub3B0aW9ucyxcblx0XHRcdHRva2VuKS50aGVuKGRhdGEgPT4gQXJyYXkuaXNBcnJheShkYXRhKSA/IGRhdGEubWFwKGQgPT4gVVJJLnJldml2ZShkKSkgOiBbXSlcblx0XHQpID8/IFtdKTtcblxuXHRcdHJldHVybiByZXN1bHQuZmxhdCgpO1xuXHR9XG5cblx0ZmluZFRleHRJbkZpbGVzMihxdWVyeTogdnNjb2RlLlRleHRTZWFyY2hRdWVyeTIsIG9wdGlvbnM6IHZzY29kZS5GaW5kVGV4dEluRmlsZXNPcHRpb25zMiB8IHVuZGVmaW5lZCwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogdnNjb2RlLkZpbmRUZXh0SW5GaWxlc1Jlc3BvbnNlIHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBleHRIb3N0V29ya3NwYWNlI2ZpbmRUZXh0SW5GaWxlczI6IHRleHRTZWFyY2gsIGV4dGVuc2lvbjogJHtleHRlbnNpb25JZC52YWx1ZX0sIGVudHJ5UG9pbnQ6IGZpbmRUZXh0SW5GaWxlczJgKTtcblxuXG5cdFx0Y29uc3QgZ2V0T3B0aW9ucyA9IChpbmNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfCB1bmRlZmluZWQpOiBRdWVyeU9wdGlvbnM8SVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zPiA9PiB7XG5cdFx0XHRpZiAoIW9wdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRmb2xkZXI6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRvcHRpb25zOiB7fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGFyc2VkSW5jbHVkZSA9IGluY2x1ZGUgPyBwYXJzZVNlYXJjaEV4Y2x1ZGVJbmNsdWRlKEdsb2JQYXR0ZXJuLmZyb20oaW5jbHVkZSkpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBleGNsdWRlUGF0dGVybnMgPSBvcHRpb25zLmV4Y2x1ZGUgPyBnbG9ic1RvSVNlYXJjaFBhdHRlcm5CdWlsZGVyKG9wdGlvbnMuZXhjbHVkZSkgOiB1bmRlZmluZWQ7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG9wdGlvbnM6IHtcblxuXHRcdFx0XHRcdGlnbm9yZVN5bWxpbmtzOiB0eXBlb2Ygb3B0aW9ucy5mb2xsb3dTeW1saW5rcyA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMuZm9sbG93U3ltbGlua3MgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0ZGlzcmVnYXJkSWdub3JlRmlsZXM6IHR5cGVvZiBvcHRpb25zLnVzZUlnbm9yZUZpbGVzID09PSAnYm9vbGVhbicgPyAhb3B0aW9ucy51c2VJZ25vcmVGaWxlcyA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRkaXNyZWdhcmRHbG9iYWxJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMudXNlSWdub3JlRmlsZXM/Lmdsb2JhbCA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMudXNlSWdub3JlRmlsZXM/Lmdsb2JhbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRkaXNyZWdhcmRQYXJlbnRJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMudXNlSWdub3JlRmlsZXM/LnBhcmVudCA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMudXNlSWdub3JlRmlsZXM/LnBhcmVudCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRkaXNyZWdhcmRFeGNsdWRlU2V0dGluZ3M6IG9wdGlvbnMudXNlRXhjbHVkZVNldHRpbmdzICE9PSB1bmRlZmluZWQgJiYgb3B0aW9ucy51c2VFeGNsdWRlU2V0dGluZ3MgPT09IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucy5Ob25lLFxuXHRcdFx0XHRcdGRpc3JlZ2FyZFNlYXJjaEV4Y2x1ZGVTZXR0aW5nczogb3B0aW9ucy51c2VFeGNsdWRlU2V0dGluZ3MgIT09IHVuZGVmaW5lZCAmJiAob3B0aW9ucy51c2VFeGNsdWRlU2V0dGluZ3MgIT09IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucy5TZWFyY2hBbmRGaWxlc0V4Y2x1ZGUpLFxuXHRcdFx0XHRcdGZpbGVFbmNvZGluZzogb3B0aW9ucy5lbmNvZGluZyxcblx0XHRcdFx0XHRtYXhSZXN1bHRzOiBvcHRpb25zLm1heFJlc3VsdHMsXG5cdFx0XHRcdFx0cHJldmlld09wdGlvbnM6IG9wdGlvbnMucHJldmlld09wdGlvbnMgPyB7XG5cdFx0XHRcdFx0XHRtYXRjaExpbmVzOiBvcHRpb25zLnByZXZpZXdPcHRpb25zPy5udW1NYXRjaExpbmVzID8/IDEwMCxcblx0XHRcdFx0XHRcdGNoYXJzUGVyTGluZTogb3B0aW9ucy5wcmV2aWV3T3B0aW9ucz8uY2hhcnNQZXJMaW5lID8/IDEwMDAwLFxuXHRcdFx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0c3Vycm91bmRpbmdDb250ZXh0OiBvcHRpb25zLnN1cnJvdW5kaW5nQ29udGV4dCxcblxuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiBwYXJzZWRJbmNsdWRlPy5wYXR0ZXJuLFxuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBleGNsdWRlUGF0dGVybnNcblx0XHRcdFx0fSBzYXRpc2ZpZXMgSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zLFxuXHRcdFx0XHRmb2xkZXI6IHBhcnNlZEluY2x1ZGU/LmZvbGRlclxuXHRcdFx0fSBzYXRpc2ZpZXMgUXVlcnlPcHRpb25zPElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucz47XG5cdFx0fTtcblxuXHRcdGNvbnN0IHF1ZXJ5T3B0aW9uc1JhdzogKFF1ZXJ5T3B0aW9uczxJVGV4dFF1ZXJ5QnVpbGRlck9wdGlvbnM+IHwgdW5kZWZpbmVkKVtdID0gKChvcHRpb25zPy5pbmNsdWRlPy5tYXAoKGluY2x1ZGUpID0+XG5cdFx0XHRnZXRPcHRpb25zKGluY2x1ZGUpKSkpID8/IFtnZXRPcHRpb25zKHVuZGVmaW5lZCldO1xuXG5cdFx0Y29uc3QgcXVlcnlPcHRpb25zID0gcXVlcnlPcHRpb25zUmF3LmZpbHRlcigocXVlcnlPcHMpOiBxdWVyeU9wcyBpcyBRdWVyeU9wdGlvbnM8SVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zPiA9PiAhIXF1ZXJ5T3BzKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHByb2dyZXNzRW1pdHRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjx7IHJlc3VsdDogSVRleHRTZWFyY2hSZXN1bHQ8VVJJPjsgdXJpOiBVUkkgfT4oKSk7XG5cdFx0Y29uc3QgY29tcGxldGUgPSB0aGlzLmZpbmRUZXh0SW5GaWxlc0Jhc2UoXG5cdFx0XHRxdWVyeSxcblx0XHRcdHF1ZXJ5T3B0aW9ucyxcblx0XHRcdChyZXN1bHQsIHVyaSkgPT4gcHJvZ3Jlc3NFbWl0dGVyLmZpcmUoeyByZXN1bHQsIHVyaSB9KSxcblx0XHRcdHRva2VuXG5cdFx0KTtcblx0XHRjb25zdCBhc3luY0l0ZXJhYmxlID0gbmV3IEFzeW5jSXRlcmFibGVPYmplY3Q8dnNjb2RlLlRleHRTZWFyY2hSZXN1bHQyPihhc3luYyBlbWl0dGVyID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChwcm9ncmVzc0VtaXR0ZXIuZXZlbnQoZSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGUucmVzdWx0O1xuXHRcdFx0XHRjb25zdCB1cmkgPSBlLnVyaTtcblx0XHRcdFx0aWYgKHJlc3VsdElzTWF0Y2gocmVzdWx0KSkge1xuXHRcdFx0XHRcdGVtaXR0ZXIuZW1pdE9uZShuZXcgVGV4dFNlYXJjaE1hdGNoMihcblx0XHRcdFx0XHRcdHVyaSxcblx0XHRcdFx0XHRcdHJlc3VsdC5yYW5nZUxvY2F0aW9ucy5tYXAoKHJhbmdlKSA9PiAoe1xuXHRcdFx0XHRcdFx0XHRwcmV2aWV3UmFuZ2U6IG5ldyBSYW5nZShyYW5nZS5wcmV2aWV3LnN0YXJ0TGluZU51bWJlciwgcmFuZ2UucHJldmlldy5zdGFydENvbHVtbiwgcmFuZ2UucHJldmlldy5lbmRMaW5lTnVtYmVyLCByYW5nZS5wcmV2aWV3LmVuZENvbHVtbiksXG5cdFx0XHRcdFx0XHRcdHNvdXJjZVJhbmdlOiBuZXcgUmFuZ2UocmFuZ2Uuc291cmNlLnN0YXJ0TGluZU51bWJlciwgcmFuZ2Uuc291cmNlLnN0YXJ0Q29sdW1uLCByYW5nZS5zb3VyY2UuZW5kTGluZU51bWJlciwgcmFuZ2Uuc291cmNlLmVuZENvbHVtbilcblx0XHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0XHRcdHJlc3VsdC5wcmV2aWV3VGV4dFxuXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZW1pdHRlci5lbWl0T25lKG5ldyBUZXh0U2VhcmNoQ29udGV4dDIoXG5cdFx0XHRcdFx0XHR1cmksXG5cdFx0XHRcdFx0XHRyZXN1bHQudGV4dCxcblx0XHRcdFx0XHRcdHJlc3VsdC5saW5lTnVtYmVyXG5cdFx0XHRcdFx0KSk7XG5cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0YXdhaXQgY29tcGxldGU7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdWx0czogYXN5bmNJdGVyYWJsZSxcblx0XHRcdGNvbXBsZXRlOiBjb21wbGV0ZS50aGVuKChlKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsaW1pdEhpdDogZT8ubGltaXRIaXQgPz8gZmFsc2Vcblx0XHRcdFx0fTtcblx0XHRcdH0pLFxuXHRcdH07XG5cdH1cblxuXG5cdGFzeW5jIGZpbmRUZXh0SW5GaWxlc0Jhc2UocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIHF1ZXJ5T3B0aW9uczogUXVlcnlPcHRpb25zPElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucz5bXSB8IHVuZGVmaW5lZCwgY2FsbGJhY2s6IChyZXN1bHQ6IElUZXh0U2VhcmNoUmVzdWx0PFVSST4sIHVyaTogVVJJKSA9PiB2b2lkLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk6IFByb21pc2U8dnNjb2RlLlRleHRTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdGNvbnN0IHJlcXVlc3RJZCA9IHRoaXMuX3JlcXVlc3RJZFByb3ZpZGVyLmdldE5leHQoKTtcblxuXHRcdGxldCBpc0NhbmNlbGVkID0gZmFsc2U7XG5cdFx0dG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoXyA9PiB7XG5cdFx0XHRpc0NhbmNlbGVkID0gdHJ1ZTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX2FjdGl2ZVNlYXJjaENhbGxiYWNrc1tyZXF1ZXN0SWRdID0gcCA9PiB7XG5cdFx0XHRpZiAoaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUocC5yZXNvdXJjZSk7XG5cdFx0XHRwLnJlc3VsdHMhLmZvckVhY2gocmF3UmVzdWx0ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0OiBJVGV4dFNlYXJjaFJlc3VsdDxVUkk+ID0gcmV2aXZlKHJhd1Jlc3VsdCk7XG5cdFx0XHRcdGNhbGxiYWNrKHJlc3VsdCwgdXJpKTtcblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5hbGwocXVlcnlPcHRpb25zPy5tYXAob3B0aW9uID0+IHRoaXMuX3Byb3h5LiRzdGFydFRleHRTZWFyY2goXG5cdFx0XHRcdHF1ZXJ5LFxuXHRcdFx0XHRvcHRpb24uZm9sZGVyID8/IG51bGwsXG5cdFx0XHRcdG9wdGlvbi5vcHRpb25zLFxuXHRcdFx0XHRyZXF1ZXN0SWQsXG5cdFx0XHRcdHRva2VuKSB8fCB7fVxuXHRcdFx0KSA/PyBbXSk7XG5cdFx0XHRkZWxldGUgdGhpcy5fYWN0aXZlU2VhcmNoQ2FsbGJhY2tzW3JlcXVlc3RJZF07XG5cdFx0XHRyZXR1cm4gcmVzdWx0LnJlZHVjZSgoYWNjLCB2YWwpID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsaW1pdEhpdDogYWNjPy5saW1pdEhpdCB8fCAodmFsPy5saW1pdEhpdCA/PyBmYWxzZSksXG5cdFx0XHRcdFx0bWVzc2FnZTogW2FjYz8ubWVzc2FnZSA/PyBbXSwgdmFsPy5tZXNzYWdlID8/IFtdXS5mbGF0KCksXG5cdFx0XHRcdH07XG5cdFx0XHR9LCB7fSkgPz8geyBsaW1pdEhpdDogZmFsc2UgfTtcblxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0ZGVsZXRlIHRoaXMuX2FjdGl2ZVNlYXJjaENhbGxiYWNrc1tyZXF1ZXN0SWRdO1xuXHRcdFx0dGhyb3cgZXJyO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZpbmRUZXh0SW5GaWxlcyhxdWVyeTogdnNjb2RlLlRleHRTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbmRUZXh0SW5GaWxlc09wdGlvbnMgJiB7IHVzZVNlYXJjaEV4Y2x1ZGU/OiBib29sZWFuIH0sIGNhbGxiYWNrOiAocmVzdWx0OiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdCkgPT4gdm9pZCwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTx2c2NvZGUuVGV4dFNlYXJjaENvbXBsZXRlPiB7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgZXh0SG9zdFdvcmtzcGFjZSNmaW5kVGV4dEluRmlsZXM6IHRleHRTZWFyY2gsIGV4dGVuc2lvbjogJHtleHRlbnNpb25JZC52YWx1ZX0sIGVudHJ5UG9pbnQ6IGZpbmRUZXh0SW5GaWxlc2ApO1xuXG5cdFx0Y29uc3QgcHJldmlld09wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoUHJldmlld09wdGlvbnMgPSB0eXBlb2Ygb3B0aW9ucy5wcmV2aWV3T3B0aW9ucyA9PT0gJ3VuZGVmaW5lZCcgP1xuXHRcdFx0e1xuXHRcdFx0XHRtYXRjaExpbmVzOiAxMDAsXG5cdFx0XHRcdGNoYXJzUGVyTGluZTogMTAwMDBcblx0XHRcdH0gOlxuXHRcdFx0b3B0aW9ucy5wcmV2aWV3T3B0aW9ucztcblxuXHRcdGNvbnN0IHBhcnNlZEluY2x1ZGUgPSBwYXJzZVNlYXJjaEV4Y2x1ZGVJbmNsdWRlKEdsb2JQYXR0ZXJuLmZyb20ob3B0aW9ucy5pbmNsdWRlKSk7XG5cblx0XHRjb25zdCBleGNsdWRlUGF0dGVybiA9ICh0eXBlb2Ygb3B0aW9ucy5leGNsdWRlID09PSAnc3RyaW5nJykgPyBvcHRpb25zLmV4Y2x1ZGUgOlxuXHRcdFx0b3B0aW9ucy5leGNsdWRlID8gb3B0aW9ucy5leGNsdWRlLnBhdHRlcm4gOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcXVlcnlPcHRpb25zOiBJVGV4dFF1ZXJ5QnVpbGRlck9wdGlvbnMgPSB7XG5cdFx0XHRpZ25vcmVTeW1saW5rczogdHlwZW9mIG9wdGlvbnMuZm9sbG93U3ltbGlua3MgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLmZvbGxvd1N5bWxpbmtzIDogdW5kZWZpbmVkLFxuXHRcdFx0ZGlzcmVnYXJkSWdub3JlRmlsZXM6IHR5cGVvZiBvcHRpb25zLnVzZUlnbm9yZUZpbGVzID09PSAnYm9vbGVhbicgPyAhb3B0aW9ucy51c2VJZ25vcmVGaWxlcyA6IHVuZGVmaW5lZCxcblx0XHRcdGRpc3JlZ2FyZEdsb2JhbElnbm9yZUZpbGVzOiB0eXBlb2Ygb3B0aW9ucy51c2VHbG9iYWxJZ25vcmVGaWxlcyA9PT0gJ2Jvb2xlYW4nID8gIW9wdGlvbnMudXNlR2xvYmFsSWdub3JlRmlsZXMgOiB1bmRlZmluZWQsXG5cdFx0XHRkaXNyZWdhcmRQYXJlbnRJZ25vcmVGaWxlczogdHlwZW9mIG9wdGlvbnMudXNlUGFyZW50SWdub3JlRmlsZXMgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnVzZVBhcmVudElnbm9yZUZpbGVzIDogdW5kZWZpbmVkLFxuXHRcdFx0ZGlzcmVnYXJkRXhjbHVkZVNldHRpbmdzOiB0eXBlb2Ygb3B0aW9ucy51c2VEZWZhdWx0RXhjbHVkZXMgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnVzZURlZmF1bHRFeGNsdWRlcyA6IHRydWUsXG5cdFx0XHRkaXNyZWdhcmRTZWFyY2hFeGNsdWRlU2V0dGluZ3M6IHR5cGVvZiBvcHRpb25zLnVzZVNlYXJjaEV4Y2x1ZGUgPT09ICdib29sZWFuJyA/ICFvcHRpb25zLnVzZVNlYXJjaEV4Y2x1ZGUgOiB0cnVlLFxuXHRcdFx0ZmlsZUVuY29kaW5nOiBvcHRpb25zLmVuY29kaW5nLFxuXHRcdFx0bWF4UmVzdWx0czogb3B0aW9ucy5tYXhSZXN1bHRzLFxuXHRcdFx0cHJldmlld09wdGlvbnMsXG5cdFx0XHRzdXJyb3VuZGluZ0NvbnRleHQ6IG9wdGlvbnMuYWZ0ZXJDb250ZXh0LCAvLyBUT0RPOiByZW1vdmUgYWJpbGl0eSB0byBoYXZlIGJlZm9yZS9hZnRlciBjb250ZXh0IHNlcGFyYXRlbHlcblxuXHRcdFx0aW5jbHVkZVBhdHRlcm46IHBhcnNlZEluY2x1ZGU/LnBhdHRlcm4sXG5cdFx0XHRleGNsdWRlUGF0dGVybjogZXhjbHVkZVBhdHRlcm4gPyBbeyBwYXR0ZXJuOiBleGNsdWRlUGF0dGVybiB9XSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvZ3Jlc3MgPSAocmVzdWx0OiBJVGV4dFNlYXJjaFJlc3VsdDxVUkk+LCB1cmk6IFVSSSkgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdElzTWF0Y2gocmVzdWx0KSkge1xuXHRcdFx0XHRjYWxsYmFjayh7XG5cdFx0XHRcdFx0dXJpLFxuXHRcdFx0XHRcdHByZXZpZXc6IHtcblx0XHRcdFx0XHRcdHRleHQ6IHJlc3VsdC5wcmV2aWV3VGV4dCxcblx0XHRcdFx0XHRcdG1hdGNoZXM6IG1hcEFycmF5T3JOb3QoXG5cdFx0XHRcdFx0XHRcdHJlc3VsdC5yYW5nZUxvY2F0aW9ucyxcblx0XHRcdFx0XHRcdFx0bSA9PiBuZXcgUmFuZ2UobS5wcmV2aWV3LnN0YXJ0TGluZU51bWJlciwgbS5wcmV2aWV3LnN0YXJ0Q29sdW1uLCBtLnByZXZpZXcuZW5kTGluZU51bWJlciwgbS5wcmV2aWV3LmVuZENvbHVtbikpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRyYW5nZXM6IG1hcEFycmF5T3JOb3QoXG5cdFx0XHRcdFx0XHRyZXN1bHQucmFuZ2VMb2NhdGlvbnMsXG5cdFx0XHRcdFx0XHRyID0+IG5ldyBSYW5nZShyLnNvdXJjZS5zdGFydExpbmVOdW1iZXIsIHIuc291cmNlLnN0YXJ0Q29sdW1uLCByLnNvdXJjZS5lbmRMaW5lTnVtYmVyLCByLnNvdXJjZS5lbmRDb2x1bW4pKVxuXHRcdFx0XHR9IHNhdGlzZmllcyB2c2NvZGUuVGV4dFNlYXJjaE1hdGNoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNhbGxiYWNrKHtcblx0XHRcdFx0XHR1cmksXG5cdFx0XHRcdFx0dGV4dDogcmVzdWx0LnRleHQsXG5cdFx0XHRcdFx0bGluZU51bWJlcjogcmVzdWx0LmxpbmVOdW1iZXJcblx0XHRcdFx0fSBzYXRpc2ZpZXMgdnNjb2RlLlRleHRTZWFyY2hDb250ZXh0KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZmluZFRleHRJbkZpbGVzQmFzZShxdWVyeSwgW3sgb3B0aW9uczogcXVlcnlPcHRpb25zLCBmb2xkZXI6IHBhcnNlZEluY2x1ZGU/LmZvbGRlciB9XSwgcHJvZ3Jlc3MsIHRva2VuKTtcblx0fVxuXG5cdCRoYW5kbGVUZXh0U2VhcmNoUmVzdWx0KHJlc3VsdDogSVJhd0ZpbGVNYXRjaDIsIHJlcXVlc3RJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYWN0aXZlU2VhcmNoQ2FsbGJhY2tzW3JlcXVlc3RJZF0/LihyZXN1bHQpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZSh1cmk6IFVSSSk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHNhdmUodXJpLCB7IHNhdmVBczogZmFsc2UgfSk7XG5cblx0XHRyZXR1cm4gVVJJLnJldml2ZShyZXN1bHQpO1xuXHR9XG5cblx0YXN5bmMgc2F2ZUFzKHVyaTogVVJJKTogUHJvbWlzZTxVUkkgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9wcm94eS4kc2F2ZSh1cmksIHsgc2F2ZUFzOiB0cnVlIH0pO1xuXG5cdFx0cmV0dXJuIFVSSS5yZXZpdmUocmVzdWx0KTtcblx0fVxuXG5cdHNhdmVBbGwoaW5jbHVkZVVudGl0bGVkPzogYm9vbGVhbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kc2F2ZUFsbChpbmNsdWRlVW50aXRsZWQpO1xuXHR9XG5cblx0cmVzb2x2ZVByb3h5KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHJlc29sdmVQcm94eSh1cmwpO1xuXHR9XG5cblx0bG9va3VwQXV0aG9yaXphdGlvbihhdXRoSW5mbzogQXV0aEluZm8pOiBQcm9taXNlPENyZWRlbnRpYWxzIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRsb29rdXBBdXRob3JpemF0aW9uKGF1dGhJbmZvKTtcblx0fVxuXG5cdGxvb2t1cEtlcmJlcm9zQXV0aG9yaXphdGlvbih1cmw6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRsb29rdXBLZXJiZXJvc0F1dGhvcml6YXRpb24odXJsKTtcblx0fVxuXG5cdGxvYWRDZXJ0aWZpY2F0ZXMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kbG9hZENlcnRpZmljYXRlcygpO1xuXHR9XG5cblx0Ly8gLS0tIHRydXN0IC0tLVxuXG5cdGdldCB0cnVzdGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl90cnVzdGVkO1xuXHR9XG5cblx0cmVxdWVzdFdvcmtzcGFjZVRydXN0KG9wdGlvbnM/OiB2c2NvZGUuV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kcmVxdWVzdFdvcmtzcGFjZVRydXN0KG9wdGlvbnMpO1xuXHR9XG5cblx0JG9uRGlkR3JhbnRXb3Jrc3BhY2VUcnVzdCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX3RydXN0ZWQpIHtcblx0XHRcdHRoaXMuX3RydXN0ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5fb25EaWRHcmFudFdvcmtzcGFjZVRydXN0LmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gZWRpdCBzZXNzaW9ucyAtLS1cblxuXHRwcml2YXRlIF9wcm92aWRlckhhbmRsZVBvb2wgPSAwO1xuXG5cdC8vIGNhbGxlZCBieSBleHQgaG9zdFxuXHRyZWdpc3RlckVkaXRTZXNzaW9uSWRlbnRpdHlQcm92aWRlcihzY2hlbWU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5FZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXIpIHtcblx0XHRpZiAodGhpcy5fZWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVycy5oYXMoc2NoZW1lKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBIHByb3ZpZGVyIGhhcyBhbHJlYWR5IGJlZW4gcmVnaXN0ZXJlZCBmb3Igc2NoZW1lICR7c2NoZW1lfWApO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VkaXRTZXNzaW9uSWRlbnRpdHlQcm92aWRlcnMuc2V0KHNjaGVtZSwgcHJvdmlkZXIpO1xuXHRcdGNvbnN0IG91dGdvaW5nU2NoZW1lID0gdGhpcy5fdXJpVHJhbnNmb3JtZXJTZXJ2aWNlLnRyYW5zZm9ybU91dGdvaW5nU2NoZW1lKHNjaGVtZSk7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fcHJvdmlkZXJIYW5kbGVQb29sKys7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyRWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVyKGhhbmRsZSwgb3V0Z29pbmdTY2hlbWUpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9lZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXJzLmRlbGV0ZShzY2hlbWUpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXJFZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXIoaGFuZGxlKTtcblx0XHR9KTtcblx0fVxuXG5cdC8vIGNhbGxlZCBieSBtYWluIHRocmVhZFxuXHRhc3luYyAkZ2V0RWRpdFNlc3Npb25JZGVudGlmaWVyKHdvcmtzcGFjZUZvbGRlcjogVXJpQ29tcG9uZW50cywgY2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oJ0dldHRpbmcgZWRpdCBzZXNzaW9uIGlkZW50aWZpZXIgZm9yIHdvcmtzcGFjZUZvbGRlcicsIHdvcmtzcGFjZUZvbGRlcik7XG5cdFx0Y29uc3QgZm9sZGVyID0gYXdhaXQgdGhpcy5yZXNvbHZlV29ya3NwYWNlRm9sZGVyKFVSSS5yZXZpdmUod29ya3NwYWNlRm9sZGVyKSk7XG5cdFx0aWYgKCFmb2xkZXIpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybignVW5hYmxlIHRvIHJlc29sdmUgd29ya3NwYWNlIGZvbGRlcicpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLmluZm8oJ0ludm9raW5nICNwcm92aWRlRWRpdFNlc3Npb25JZGVudGl0eSBmb3Igd29ya3NwYWNlRm9sZGVyJywgZm9sZGVyKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fZWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVycy5nZXQoZm9sZGVyLnVyaS5zY2hlbWUpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbyhgUHJvdmlkZXIgZm9yIHNjaGVtZSAke2ZvbGRlci51cmkuc2NoZW1lfSBpcyBkZWZpbmVkOiBgLCAhIXByb3ZpZGVyKTtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVFZGl0U2Vzc2lvbklkZW50aXR5KGZvbGRlciwgY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbygnUHJvdmlkZXIgcmV0dXJuZWQgZWRpdCBzZXNzaW9uIGlkZW50aWZpZXI6ICcsIHJlc3VsdCk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jICRwcm92aWRlRWRpdFNlc3Npb25JZGVudGl0eU1hdGNoKHdvcmtzcGFjZUZvbGRlcjogVXJpQ29tcG9uZW50cywgaWRlbnRpdHkxOiBzdHJpbmcsIGlkZW50aXR5Mjogc3RyaW5nLCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPEVkaXRTZXNzaW9uSWRlbnRpdHlNYXRjaCB8IHVuZGVmaW5lZD4ge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbygnR2V0dGluZyBlZGl0IHNlc3Npb24gaWRlbnRpZmllciBmb3Igd29ya3NwYWNlRm9sZGVyJywgd29ya3NwYWNlRm9sZGVyKTtcblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLnJlc29sdmVXb3Jrc3BhY2VGb2xkZXIoVVJJLnJldml2ZSh3b3Jrc3BhY2VGb2xkZXIpKTtcblx0XHRpZiAoIWZvbGRlcikge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdVbmFibGUgdG8gcmVzb2x2ZSB3b3Jrc3BhY2UgZm9sZGVyJyk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UuaW5mbygnSW52b2tpbmcgI3Byb3ZpZGVFZGl0U2Vzc2lvbklkZW50aXR5IGZvciB3b3Jrc3BhY2VGb2xkZXInLCBmb2xkZXIpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9lZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXJzLmdldChmb2xkZXIudXJpLnNjaGVtZSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKGBQcm92aWRlciBmb3Igc2NoZW1lICR7Zm9sZGVyLnVyaS5zY2hlbWV9IGlzIGRlZmluZWQ6IGAsICEhcHJvdmlkZXIpO1xuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUVkaXRTZXNzaW9uSWRlbnRpdHlNYXRjaD8uKGlkZW50aXR5MSwgaWRlbnRpdHkyLCBjYW5jZWxsYXRpb25Ub2tlbik7XG5cdFx0dGhpcy5fbG9nU2VydmljZS5pbmZvKCdQcm92aWRlciByZXR1cm5lZCBlZGl0IHNlc3Npb24gaWRlbnRpZmllciBtYXRjaCByZXN1bHQ6ICcsIHJlc3VsdCk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbENyZWF0ZUVkaXRTZXNzaW9uSWRlbnRpdHlFdmVudCA9IG5ldyBBc3luY0VtaXR0ZXI8dnNjb2RlLkVkaXRTZXNzaW9uSWRlbnRpdHlXaWxsQ3JlYXRlRXZlbnQ+KCk7XG5cblx0Z2V0T25XaWxsQ3JlYXRlRWRpdFNlc3Npb25JZGVudGl0eUV2ZW50KGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogRXZlbnQ8dnNjb2RlLkVkaXRTZXNzaW9uSWRlbnRpdHlXaWxsQ3JlYXRlRXZlbnQ+IHtcblx0XHRyZXR1cm4gKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcykgPT4ge1xuXHRcdFx0Y29uc3Qgd3JhcHBlZExpc3RlbmVyOiBJRXh0ZW5zaW9uTGlzdGVuZXI8dnNjb2RlLkVkaXRTZXNzaW9uSWRlbnRpdHlXaWxsQ3JlYXRlRXZlbnQ+ID0gZnVuY3Rpb24gd3JhcHBlZChlKSB7IGxpc3RlbmVyLmNhbGwodGhpc0FyZywgZSk7IH07XG5cdFx0XHR3cmFwcGVkTGlzdGVuZXIuZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0cmV0dXJuIHRoaXMuX29uV2lsbENyZWF0ZUVkaXRTZXNzaW9uSWRlbnRpdHlFdmVudC5ldmVudCh3cmFwcGVkTGlzdGVuZXIsIHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdH07XG5cdH1cblxuXHQvLyBtYWluIHRocmVhZCBjYWxscyB0aGlzIHRvIHRyaWdnZXIgcGFydGljaXBhbnRzXG5cdGFzeW5jICRvbldpbGxDcmVhdGVFZGl0U2Vzc2lvbklkZW50aXR5KHdvcmtzcGFjZUZvbGRlcjogVXJpQ29tcG9uZW50cywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCB0aW1lb3V0OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCB0aGlzLnJlc29sdmVXb3Jrc3BhY2VGb2xkZXIoVVJJLnJldml2ZSh3b3Jrc3BhY2VGb2xkZXIpKTtcblxuXHRcdGlmIChmb2xkZXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcmVzb2x2ZSB3b3Jrc3BhY2UgZm9sZGVyJyk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fb25XaWxsQ3JlYXRlRWRpdFNlc3Npb25JZGVudGl0eUV2ZW50LmZpcmVBc3luYyh7IHdvcmtzcGFjZUZvbGRlcjogZm9sZGVyIH0sIHRva2VuLCBhc3luYyAodGhlbmFibGU6IFByb21pc2U8dW5rbm93bj4sIGxpc3RlbmVyKSA9PiB7XG5cdFx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKHRoZW5hYmxlKTtcblx0XHRcdGlmIChEYXRlLm5vdygpIC0gbm93ID4gdGltZW91dCkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ1NMT1cgZWRpdCBzZXNzaW9uIGNyZWF0ZS1wYXJ0aWNpcGFudCcsICg8SUV4dGVuc2lvbkxpc3RlbmVyPHZzY29kZS5FZGl0U2Vzc2lvbklkZW50aXR5V2lsbENyZWF0ZUV2ZW50Pj5saXN0ZW5lcikuZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBjYW5vbmljYWwgdXJpIGlkZW50aXR5IC0tLVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Nhbm9uaWNhbFVyaVByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCB2c2NvZGUuQ2Fub25pY2FsVXJpUHJvdmlkZXI+KCk7XG5cblx0Ly8gY2FsbGVkIGJ5IGV4dCBob3N0XG5cdHJlZ2lzdGVyQ2Fub25pY2FsVXJpUHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuQ2Fub25pY2FsVXJpUHJvdmlkZXIpIHtcblx0XHRpZiAodGhpcy5fY2Fub25pY2FsVXJpUHJvdmlkZXJzLmhhcyhzY2hlbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEEgcHJvdmlkZXIgaGFzIGFscmVhZHkgYmVlbiByZWdpc3RlcmVkIGZvciBzY2hlbWUgJHtzY2hlbWV9YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY2Fub25pY2FsVXJpUHJvdmlkZXJzLnNldChzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRjb25zdCBvdXRnb2luZ1NjaGVtZSA9IHRoaXMuX3VyaVRyYW5zZm9ybWVyU2VydmljZS50cmFuc2Zvcm1PdXRnb2luZ1NjaGVtZShzY2hlbWUpO1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX3Byb3ZpZGVySGFuZGxlUG9vbCsrO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckNhbm9uaWNhbFVyaVByb3ZpZGVyKGhhbmRsZSwgb3V0Z29pbmdTY2hlbWUpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jYW5vbmljYWxVcmlQcm92aWRlcnMuZGVsZXRlKHNjaGVtZSk7XG5cdFx0XHR0aGlzLl9wcm94eS4kdW5yZWdpc3RlckNhbm9uaWNhbFVyaVByb3ZpZGVyKGhhbmRsZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlQ2Fub25pY2FsVXJpKHVyaTogVVJJLCBvcHRpb25zOiB2c2NvZGUuQ2Fub25pY2FsVXJpUmVxdWVzdE9wdGlvbnMsIGNhbmNlbGxhdGlvblRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jYW5vbmljYWxVcmlQcm92aWRlcnMuZ2V0KHVyaS5zY2hlbWUpO1xuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZUNhbm9uaWNhbFVyaT8uKFVSSS5yZXZpdmUodXJpKSwgb3B0aW9ucywgY2FuY2VsbGF0aW9uVG9rZW4pO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvLyBjYWxsZWQgYnkgbWFpbiB0aHJlYWRcblx0YXN5bmMgJHByb3ZpZGVDYW5vbmljYWxVcmkodXJpOiBVcmlDb21wb25lbnRzLCB0YXJnZXRTY2hlbWU6IHN0cmluZywgY2FuY2VsbGF0aW9uVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMucHJvdmlkZUNhbm9uaWNhbFVyaShVUkkucmV2aXZlKHVyaSksIHsgdGFyZ2V0U2NoZW1lIH0sIGNhbmNlbGxhdGlvblRva2VuKTtcblx0fVxuXG5cdC8vIC0tLSBlbmNvZGluZ3MgLS0tXG5cblx0ZGVjb2RlKGNvbnRlbnQ6IFVpbnQ4QXJyYXksIHVyaTogVXJpQ29tcG9uZW50cyB8IHVuZGVmaW5lZCwgb3B0aW9ucz86IHsgZW5jb2Rpbmc6IHN0cmluZyB9KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJGRlY29kZShWU0J1ZmZlci53cmFwKGNvbnRlbnQpLCB1cmksIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgZW5jb2RlKGNvbnRlbnQ6IHN0cmluZywgdXJpOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogeyBlbmNvZGluZzogc3RyaW5nIH0pOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcblx0XHRjb25zdCBidWZmID0gYXdhaXQgdGhpcy5fcHJveHkuJGVuY29kZShjb250ZW50LCB1cmksIG9wdGlvbnMpO1xuXHRcdHJldHVybiBidWZmLmJ1ZmZlcjtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSUV4dEhvc3RXb3Jrc3BhY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUV4dEhvc3RXb3Jrc3BhY2U+KCdJRXh0SG9zdFdvcmtzcGFjZScpO1xuZXhwb3J0IGludGVyZmFjZSBJRXh0SG9zdFdvcmtzcGFjZSBleHRlbmRzIEV4dEhvc3RXb3Jrc3BhY2UsIEV4dEhvc3RXb3Jrc3BhY2VTaGFwZSwgSUV4dEhvc3RXb3Jrc3BhY2VQcm92aWRlciB7IH1cblxuZnVuY3Rpb24gcGFyc2VTZWFyY2hFeGNsdWRlSW5jbHVkZShpbmNsdWRlOiBzdHJpbmcgfCBJUmVsYXRpdmVQYXR0ZXJuRHRvIHwgdW5kZWZpbmVkIHwgbnVsbCk6IHsgcGF0dGVybjogc3RyaW5nOyBmb2xkZXI/OiBVUkkgfSB8IHVuZGVmaW5lZCB7XG5cdGxldCBwYXR0ZXJuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGxldCBpbmNsdWRlRm9sZGVyOiBVUkkgfCB1bmRlZmluZWQ7XG5cdGlmIChpbmNsdWRlKSB7XG5cdFx0aWYgKHR5cGVvZiBpbmNsdWRlID09PSAnc3RyaW5nJykge1xuXHRcdFx0cGF0dGVybiA9IGluY2x1ZGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBhdHRlcm4gPSBpbmNsdWRlLnBhdHRlcm47XG5cdFx0XHRpbmNsdWRlRm9sZGVyID0gVVJJLnJldml2ZShpbmNsdWRlLmJhc2VVcmkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRwYXR0ZXJuLFxuXHRcdFx0Zm9sZGVyOiBpbmNsdWRlRm9sZGVyXG5cdFx0fTtcblx0fVxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgSUV4dGVuc2lvbkxpc3RlbmVyPEU+IHtcblx0ZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb247XG5cdChlOiBFKTogYW55O1xufVxuXG5mdW5jdGlvbiBnbG9ic1RvSVNlYXJjaFBhdHRlcm5CdWlsZGVyKGV4Y2x1ZGVzOiB2c2NvZGUuR2xvYlBhdHRlcm5bXSB8IHVuZGVmaW5lZCk6IElTZWFyY2hQYXR0ZXJuQnVpbGRlcjxVUkk+W10ge1xuXHRyZXR1cm4gKFxuXHRcdGV4Y2x1ZGVzPy5tYXAoKGV4Y2x1ZGUpOiBJU2VhcmNoUGF0dGVybkJ1aWxkZXI8VVJJPiB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRpZiAodHlwZW9mIGV4Y2x1ZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdGlmIChleGNsdWRlID09PSAnJykge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRwYXR0ZXJuOiBleGNsdWRlLFxuXHRcdFx0XHRcdHVyaTogdW5kZWZpbmVkXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElTZWFyY2hQYXR0ZXJuQnVpbGRlcjxVUkk+O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcGFyc2VkRXhjbHVkZSA9IHBhcnNlU2VhcmNoRXhjbHVkZUluY2x1ZGUoZXhjbHVkZSk7XG5cdFx0XHRcdGlmICghcGFyc2VkRXhjbHVkZSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRwYXR0ZXJuOiBwYXJzZWRFeGNsdWRlLnBhdHRlcm4sXG5cdFx0XHRcdFx0dXJpOiBwYXJzZWRFeGNsdWRlLmZvbGRlclxuXHRcdFx0XHR9IHNhdGlzZmllcyBJU2VhcmNoUGF0dGVybkJ1aWxkZXI8VVJJPjtcblx0XHRcdH1cblx0XHR9KSA/PyBbXVxuXHQpLmZpbHRlcigoZSk6IGUgaXMgSVNlYXJjaFBhdHRlcm5CdWlsZGVyPFVSST4gPT4gISFlKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLFlBQVkscUJBQXFCO0FBQ25ELFNBQVMscUJBQXFCLGVBQWU7QUFDN0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxjQUFjLGVBQXNCO0FBQzdDLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsVUFBVSxxQkFBcUIsU0FBUyxRQUFRLG9CQUFvQjtBQUM3RSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHNDQUFzQztBQUMvQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLFdBQVcsdUJBQXVCO0FBQzNDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QixTQUFTLDhCQUE4QjtBQUV2QyxTQUE0QyxxQkFBcUI7QUFFakUsU0FBcUUsbUJBQXNHO0FBQzNLLFNBQVMs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
