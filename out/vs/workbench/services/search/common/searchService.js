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
import * as arrays from "../../../../base/common/arrays.js";
import { DeferredPromise, raceCancellationError } from "../../../../base/common/async.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import { randomChance } from "../../../../base/common/numbers.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { isNumber } from "../../../../base/common/types.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { DEFAULT_MAX_SEARCH_RESULTS, deserializeSearchError, FileMatch, isFileMatch, isProgressMessage, pathIncludedInQuery, QueryType, SEARCH_RESULT_LANGUAGE_ID, SearchErrorCode, SearchProviderType } from "./search.js";
import { getTextSearchMatchWithModelContext, editorMatchesToTextSearchResults } from "./searchHelpers.js";
let SearchService = class extends Disposable {
  constructor(modelService, editorService, telemetryService, logService, extensionService, fileService, uriIdentityService) {
    super();
    this.modelService = modelService;
    this.editorService = editorService;
    this.telemetryService = telemetryService;
    this.logService = logService;
    this.extensionService = extensionService;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.fileSearchProviders = /* @__PURE__ */ new Map();
    this.textSearchProviders = /* @__PURE__ */ new Map();
    this.aiTextSearchProviders = /* @__PURE__ */ new Map();
    this.deferredFileSearchesByScheme = /* @__PURE__ */ new Map();
    this.deferredTextSearchesByScheme = /* @__PURE__ */ new Map();
    this.deferredAITextSearchesByScheme = /* @__PURE__ */ new Map();
    this.loggedSchemesMissingProviders = /* @__PURE__ */ new Set();
  }
  registerSearchResultProvider(scheme, type, provider) {
    let list;
    let deferredMap;
    if (type === SearchProviderType.file) {
      list = this.fileSearchProviders;
      deferredMap = this.deferredFileSearchesByScheme;
    } else if (type === SearchProviderType.text) {
      list = this.textSearchProviders;
      deferredMap = this.deferredTextSearchesByScheme;
    } else if (type === SearchProviderType.aiText) {
      list = this.aiTextSearchProviders;
      deferredMap = this.deferredAITextSearchesByScheme;
    } else {
      throw new Error("Unknown SearchProviderType");
    }
    list.set(scheme, provider);
    if (deferredMap.has(scheme)) {
      deferredMap.get(scheme).complete(provider);
      deferredMap.delete(scheme);
    }
    return toDisposable(() => {
      list.delete(scheme);
    });
  }
  async textSearch(query, token, onProgress) {
    const results = this.textSearchSplitSyncAsync(query, token, onProgress);
    const openEditorResults = results.syncResults;
    const otherResults = await results.asyncResults;
    return {
      limitHit: otherResults.limitHit || openEditorResults.limitHit,
      results: [...otherResults.results, ...openEditorResults.results],
      messages: [...otherResults.messages, ...openEditorResults.messages]
    };
  }
  async aiTextSearch(query, token, onProgress) {
    const onProviderProgress = (progress) => {
      if (onProgress) {
        if (isFileMatch(progress)) {
          onProgress(progress);
        } else {
          onProgress(progress);
        }
      }
      if (isProgressMessage(progress)) {
        this.logService.debug("SearchService#search", progress.message);
      }
    };
    return this.doSearch(query, token, onProviderProgress);
  }
  async getAIName() {
    const provider = this.getSearchProvider(QueryType.aiText).get(Schemas.file);
    return await provider?.getAIName();
  }
  textSearchSplitSyncAsync(query, token, onProgress, notebookFilesToIgnore, asyncNotebookFilesToIgnore) {
    const openEditorResults = this.getOpenEditorResults(query);
    if (onProgress) {
      arrays.coalesce([...openEditorResults.results.values()]).filter((e) => !(notebookFilesToIgnore && notebookFilesToIgnore.has(e.resource))).forEach(onProgress);
    }
    const syncResults = {
      results: arrays.coalesce([...openEditorResults.results.values()]),
      limitHit: openEditorResults.limitHit ?? false,
      messages: []
    };
    const getAsyncResults = async () => {
      const resolvedAsyncNotebookFilesToIgnore = await asyncNotebookFilesToIgnore ?? new ResourceSet();
      const onProviderProgress = (progress) => {
        if (isFileMatch(progress)) {
          if (!openEditorResults.results.has(progress.resource) && !resolvedAsyncNotebookFilesToIgnore.has(progress.resource) && onProgress) {
            onProgress(progress);
          }
        } else if (onProgress) {
          onProgress(progress);
        }
        if (isProgressMessage(progress)) {
          this.logService.debug("SearchService#search", progress.message);
        }
      };
      return await this.doSearch(query, token, onProviderProgress);
    };
    return {
      syncResults,
      asyncResults: getAsyncResults()
    };
  }
  fileSearch(query, token) {
    return this.doSearch(query, token);
  }
  schemeHasFileSearchProvider(scheme) {
    return this.fileSearchProviders.has(scheme);
  }
  doSearch(query, token, onProgress) {
    this.logService.trace("SearchService#search", JSON.stringify(query));
    const schemesInQuery = this.getSchemesInQuery(query);
    const providerActivations = [Promise.resolve(null)];
    schemesInQuery.forEach((scheme) => providerActivations.push(this.extensionService.activateByEvent(`onSearch:${scheme}`)));
    providerActivations.push(this.extensionService.activateByEvent("onSearch:file"));
    const providerPromise = (async () => {
      await Promise.all(providerActivations);
      await this.extensionService.whenInstalledExtensionsRegistered();
      if (token && token.isCancellationRequested) {
        return Promise.reject(new CancellationError());
      }
      const progressCallback = (item) => {
        if (token && token.isCancellationRequested) {
          return;
        }
        onProgress?.(item);
      };
      const exists = await Promise.all(query.folderQueries.map((query2) => this.fileService.exists(query2.folder)));
      query.folderQueries = query.folderQueries.filter((_, i) => exists[i]);
      let completes = await this.searchWithProviders(query, progressCallback, token);
      completes = arrays.coalesce(completes);
      if (!completes.length) {
        return {
          limitHit: false,
          results: [],
          messages: []
        };
      }
      return {
        limitHit: completes[0] && completes[0].limitHit,
        stats: completes[0].stats,
        messages: arrays.coalesce(completes.flatMap((i) => i.messages)).filter(arrays.uniqueFilter((message) => message.type + message.text + message.trusted)),
        results: completes.flatMap((c) => c.results)
      };
    })();
    return token ? raceCancellationError(providerPromise, token) : providerPromise;
  }
  getSchemesInQuery(query) {
    const schemes = /* @__PURE__ */ new Set();
    query.folderQueries?.forEach((fq) => schemes.add(fq.folder.scheme));
    query.extraFileResources?.forEach((extraFile) => schemes.add(extraFile.scheme));
    return schemes;
  }
  async waitForProvider(queryType, scheme) {
    const deferredMap = this.getDeferredTextSearchesByScheme(queryType);
    if (deferredMap.has(scheme)) {
      return deferredMap.get(scheme).p;
    } else {
      const deferred = new DeferredPromise();
      deferredMap.set(scheme, deferred);
      return deferred.p;
    }
  }
  getSearchProvider(type) {
    switch (type) {
      case QueryType.File:
        return this.fileSearchProviders;
      case QueryType.Text:
        return this.textSearchProviders;
      case QueryType.aiText:
        return this.aiTextSearchProviders;
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  getDeferredTextSearchesByScheme(type) {
    switch (type) {
      case QueryType.File:
        return this.deferredFileSearchesByScheme;
      case QueryType.Text:
        return this.deferredTextSearchesByScheme;
      case QueryType.aiText:
        return this.deferredAITextSearchesByScheme;
      default:
        throw new Error(`Unknown query type: ${type}`);
    }
  }
  async searchWithProviders(query, onProviderProgress, token) {
    const e2eSW = StopWatch.create(false);
    const searchPs = [];
    const fqs = this.groupFolderQueriesByScheme(query);
    const someSchemeHasProvider = [...fqs.keys()].some((scheme) => {
      return this.getSearchProvider(query.type).has(scheme);
    });
    if (query.type === QueryType.aiText && !someSchemeHasProvider) {
      return [];
    }
    await Promise.all([...fqs.keys()].map(async (scheme) => {
      if (query.onlyFileScheme && scheme !== Schemas.file) {
        return;
      }
      const schemeFQs = fqs.get(scheme);
      let provider = this.getSearchProvider(query.type).get(scheme);
      if (!provider) {
        if (someSchemeHasProvider) {
          if (!this.loggedSchemesMissingProviders.has(scheme)) {
            this.logService.warn(`No search provider registered for scheme: ${scheme}. Another scheme has a provider, not waiting for ${scheme}`);
            this.loggedSchemesMissingProviders.add(scheme);
          }
          return;
        } else {
          if (!this.loggedSchemesMissingProviders.has(scheme)) {
            this.logService.warn(`No search provider registered for scheme: ${scheme}, waiting`);
            this.loggedSchemesMissingProviders.add(scheme);
          }
          provider = await this.waitForProvider(query.type, scheme);
        }
      }
      const oneSchemeQuery = {
        ...query,
        ...{
          folderQueries: schemeFQs
        }
      };
      const doProviderSearch = () => {
        switch (query.type) {
          case QueryType.File:
            return provider.fileSearch(oneSchemeQuery, token);
          case QueryType.Text:
            return provider.textSearch(oneSchemeQuery, onProviderProgress, token);
          default:
            return provider.textSearch(oneSchemeQuery, onProviderProgress, token);
        }
      };
      searchPs.push(doProviderSearch());
    }));
    return Promise.all(searchPs).then((completes) => {
      const endToEndTime = e2eSW.elapsed();
      this.logService.trace(`SearchService#search: ${endToEndTime}ms`);
      completes.forEach((complete) => {
        this.sendTelemetry(query, endToEndTime, complete);
      });
      return completes;
    }, (err) => {
      const endToEndTime = e2eSW.elapsed();
      this.logService.trace(`SearchService#search: ${endToEndTime}ms`);
      const searchError = deserializeSearchError(err);
      this.logService.trace(`SearchService#searchError: ${searchError.message}`);
      this.sendTelemetry(query, endToEndTime, void 0, searchError);
      throw searchError;
    });
  }
  groupFolderQueriesByScheme(query) {
    const queries = /* @__PURE__ */ new Map();
    query.folderQueries.forEach((fq) => {
      const schemeFQs = queries.get(fq.folder.scheme) || [];
      schemeFQs.push(fq);
      queries.set(fq.folder.scheme, schemeFQs);
    });
    return queries;
  }
  sendTelemetry(query, endToEndTime, complete, err) {
    if (!randomChance(5 / 100)) {
      return;
    }
    const fileSchemeOnly = query.folderQueries.every((fq) => fq.folder.scheme === Schemas.file);
    const otherSchemeOnly = query.folderQueries.every((fq) => fq.folder.scheme !== Schemas.file);
    const scheme = fileSchemeOnly ? Schemas.file : otherSchemeOnly ? "other" : "mixed";
    if (query.type === QueryType.File && complete && complete.stats) {
      const fileSearchStats = complete.stats;
      if (fileSearchStats.fromCache) {
        const cacheStats = fileSearchStats.detailStats;
        this.telemetryService.publicLog2("cachedSearchComplete", {
          reason: query._reason,
          resultCount: fileSearchStats.resultCount,
          workspaceFolderCount: query.folderQueries.length,
          endToEndTime,
          sortingTime: fileSearchStats.sortingTime,
          cacheWasResolved: cacheStats.cacheWasResolved,
          cacheLookupTime: cacheStats.cacheLookupTime,
          cacheFilterTime: cacheStats.cacheFilterTime,
          cacheEntryCount: cacheStats.cacheEntryCount,
          scheme
        });
      } else {
        const searchEngineStats = fileSearchStats.detailStats;
        this.telemetryService.publicLog2("searchComplete", {
          reason: query._reason,
          resultCount: fileSearchStats.resultCount,
          workspaceFolderCount: query.folderQueries.length,
          endToEndTime,
          sortingTime: fileSearchStats.sortingTime,
          fileWalkTime: searchEngineStats.fileWalkTime,
          directoriesWalked: searchEngineStats.directoriesWalked,
          filesWalked: searchEngineStats.filesWalked,
          cmdTime: searchEngineStats.cmdTime,
          cmdResultCount: searchEngineStats.cmdResultCount,
          scheme
        });
      }
    } else if (query.type === QueryType.Text) {
      let errorType;
      if (err) {
        errorType = err.code === SearchErrorCode.regexParseError ? "regex" : err.code === SearchErrorCode.unknownEncoding ? "encoding" : err.code === SearchErrorCode.globParseError ? "glob" : err.code === SearchErrorCode.invalidLiteral ? "literal" : err.code === SearchErrorCode.other ? "other" : err.code === SearchErrorCode.canceled ? "canceled" : "unknown";
      }
      this.telemetryService.publicLog2("textSearchComplete", {
        reason: query._reason,
        workspaceFolderCount: query.folderQueries.length,
        endToEndTime,
        scheme,
        error: errorType
      });
    }
  }
  getOpenEditorResults(query) {
    const openEditorResults = new ResourceMap((uri2) => this.uriIdentityService.extUri.getComparisonKey(uri2));
    let limitHit = false;
    if (query.type === QueryType.Text) {
      const canonicalToOriginalResources = new ResourceMap();
      for (const editorInput of this.editorService.editors) {
        const canonical = EditorResourceAccessor.getCanonicalUri(editorInput, { supportSideBySide: SideBySideEditor.PRIMARY });
        const original = EditorResourceAccessor.getOriginalUri(editorInput, { supportSideBySide: SideBySideEditor.PRIMARY });
        if (canonical) {
          canonicalToOriginalResources.set(canonical, original ?? canonical);
        }
      }
      const models = this.modelService.getModels();
      models.forEach((model) => {
        const resource = model.uri;
        if (!resource) {
          return;
        }
        if (limitHit) {
          return;
        }
        const originalResource = canonicalToOriginalResources.get(resource);
        if (!originalResource) {
          return;
        }
        if (model.getLanguageId() === SEARCH_RESULT_LANGUAGE_ID && !(query.includePattern && query.includePattern["**/*.code-search"])) {
          return;
        }
        if (originalResource.scheme !== Schemas.untitled && !this.fileService.hasProvider(originalResource)) {
          return;
        }
        if (originalResource.scheme === "git") {
          return;
        }
        if (!this.matches(originalResource, query)) {
          return;
        }
        const askMax = (isNumber(query.maxResults) ? query.maxResults : DEFAULT_MAX_SEARCH_RESULTS) + 1;
        let matches = model.findMatches(query.contentPattern.pattern, false, !!query.contentPattern.isRegExp, !!query.contentPattern.isCaseSensitive, query.contentPattern.isWordMatch ? query.contentPattern.wordSeparators : null, false, askMax);
        if (matches.length) {
          if (askMax && matches.length >= askMax) {
            limitHit = true;
            matches = matches.slice(0, askMax - 1);
          }
          const fileMatch = new FileMatch(originalResource);
          openEditorResults.set(originalResource, fileMatch);
          const textSearchResults = editorMatchesToTextSearchResults(matches, model, query.previewOptions);
          fileMatch.results = getTextSearchMatchWithModelContext(textSearchResults, model, query);
        } else {
          openEditorResults.set(originalResource, null);
        }
      });
    }
    return {
      results: openEditorResults,
      limitHit
    };
  }
  matches(resource, query) {
    return pathIncludedInQuery(query, resource.fsPath);
  }
  async clearCache(cacheKey) {
    const clearPs = Array.from(this.fileSearchProviders.values()).map((provider) => provider && provider.clearCache(cacheKey));
    await Promise.all(clearPs);
  }
};
SearchService = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IUriIdentityService)
], SearchService);
export {
  SearchService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2hTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHJhY2VDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IHJhbmRvbUNoYW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9NQVhfU0VBUkNIX1JFU1VMVFMsIGRlc2VyaWFsaXplU2VhcmNoRXJyb3IsIEZpbGVNYXRjaCwgSUFJVGV4dFF1ZXJ5LCBJQ2FjaGVkU2VhcmNoU3RhdHMsIElGaWxlTWF0Y2gsIElGaWxlUXVlcnksIElGaWxlU2VhcmNoU3RhdHMsIElGb2xkZXJRdWVyeSwgSVByb2dyZXNzTWVzc2FnZSwgSVNlYXJjaENvbXBsZXRlLCBJU2VhcmNoRW5naW5lU3RhdHMsIElTZWFyY2hQcm9ncmVzc0l0ZW0sIElTZWFyY2hRdWVyeSwgSVNlYXJjaFJlc3VsdFByb3ZpZGVyLCBJU2VhcmNoU2VydmljZSwgaXNGaWxlTWF0Y2gsIGlzUHJvZ3Jlc3NNZXNzYWdlLCBJVGV4dFF1ZXJ5LCBwYXRoSW5jbHVkZWRJblF1ZXJ5LCBRdWVyeVR5cGUsIFNFQVJDSF9SRVNVTFRfTEFOR1VBR0VfSUQsIFNlYXJjaEVycm9yLCBTZWFyY2hFcnJvckNvZGUsIFNlYXJjaFByb3ZpZGVyVHlwZSB9IGZyb20gJy4vc2VhcmNoLmpzJztcbmltcG9ydCB7IGdldFRleHRTZWFyY2hNYXRjaFdpdGhNb2RlbENvbnRleHQsIGVkaXRvck1hdGNoZXNUb1RleHRTZWFyY2hSZXN1bHRzIH0gZnJvbSAnLi9zZWFyY2hIZWxwZXJzLmpzJztcblxuZXhwb3J0IGNsYXNzIFNlYXJjaFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNlYXJjaFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlYXJjaFByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJU2VhcmNoUmVzdWx0UHJvdmlkZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGV4dFNlYXJjaFByb3ZpZGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJU2VhcmNoUmVzdWx0UHJvdmlkZXI+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgYWlUZXh0U2VhcmNoUHJvdmlkZXJzID0gbmV3IE1hcDxzdHJpbmcsIElTZWFyY2hSZXN1bHRQcm92aWRlcj4oKTtcblxuXHRwcml2YXRlIGRlZmVycmVkRmlsZVNlYXJjaGVzQnlTY2hlbWUgPSBuZXcgTWFwPHN0cmluZywgRGVmZXJyZWRQcm9taXNlPElTZWFyY2hSZXN1bHRQcm92aWRlcj4+KCk7XG5cdHByaXZhdGUgZGVmZXJyZWRUZXh0U2VhcmNoZXNCeVNjaGVtZSA9IG5ldyBNYXA8c3RyaW5nLCBEZWZlcnJlZFByb21pc2U8SVNlYXJjaFJlc3VsdFByb3ZpZGVyPj4oKTtcblx0cHJpdmF0ZSBkZWZlcnJlZEFJVGV4dFNlYXJjaGVzQnlTY2hlbWUgPSBuZXcgTWFwPHN0cmluZywgRGVmZXJyZWRQcm9taXNlPElTZWFyY2hSZXN1bHRQcm92aWRlcj4+KCk7XG5cblx0cHJpdmF0ZSBsb2dnZWRTY2hlbWVzTWlzc2luZ1Byb3ZpZGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVnaXN0ZXJTZWFyY2hSZXN1bHRQcm92aWRlcihzY2hlbWU6IHN0cmluZywgdHlwZTogU2VhcmNoUHJvdmlkZXJUeXBlLCBwcm92aWRlcjogSVNlYXJjaFJlc3VsdFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGxldCBsaXN0OiBNYXA8c3RyaW5nLCBJU2VhcmNoUmVzdWx0UHJvdmlkZXI+O1xuXHRcdGxldCBkZWZlcnJlZE1hcDogTWFwPHN0cmluZywgRGVmZXJyZWRQcm9taXNlPElTZWFyY2hSZXN1bHRQcm92aWRlcj4+O1xuXHRcdGlmICh0eXBlID09PSBTZWFyY2hQcm92aWRlclR5cGUuZmlsZSkge1xuXHRcdFx0bGlzdCA9IHRoaXMuZmlsZVNlYXJjaFByb3ZpZGVycztcblx0XHRcdGRlZmVycmVkTWFwID0gdGhpcy5kZWZlcnJlZEZpbGVTZWFyY2hlc0J5U2NoZW1lO1xuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gU2VhcmNoUHJvdmlkZXJUeXBlLnRleHQpIHtcblx0XHRcdGxpc3QgPSB0aGlzLnRleHRTZWFyY2hQcm92aWRlcnM7XG5cdFx0XHRkZWZlcnJlZE1hcCA9IHRoaXMuZGVmZXJyZWRUZXh0U2VhcmNoZXNCeVNjaGVtZTtcblx0XHR9IGVsc2UgaWYgKHR5cGUgPT09IFNlYXJjaFByb3ZpZGVyVHlwZS5haVRleHQpIHtcblx0XHRcdGxpc3QgPSB0aGlzLmFpVGV4dFNlYXJjaFByb3ZpZGVycztcblx0XHRcdGRlZmVycmVkTWFwID0gdGhpcy5kZWZlcnJlZEFJVGV4dFNlYXJjaGVzQnlTY2hlbWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBTZWFyY2hQcm92aWRlclR5cGUnKTtcblx0XHR9XG5cblx0XHRsaXN0LnNldChzY2hlbWUsIHByb3ZpZGVyKTtcblxuXHRcdGlmIChkZWZlcnJlZE1hcC5oYXMoc2NoZW1lKSkge1xuXHRcdFx0ZGVmZXJyZWRNYXAuZ2V0KHNjaGVtZSkhLmNvbXBsZXRlKHByb3ZpZGVyKTtcblx0XHRcdGRlZmVycmVkTWFwLmRlbGV0ZShzY2hlbWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0bGlzdC5kZWxldGUoc2NoZW1lKTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHRleHRTZWFyY2gocXVlcnk6IElUZXh0UXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sIG9uUHJvZ3Jlc3M/OiAoaXRlbTogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCk6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IHRoaXMudGV4dFNlYXJjaFNwbGl0U3luY0FzeW5jKHF1ZXJ5LCB0b2tlbiwgb25Qcm9ncmVzcyk7XG5cdFx0Y29uc3Qgb3BlbkVkaXRvclJlc3VsdHMgPSByZXN1bHRzLnN5bmNSZXN1bHRzO1xuXHRcdGNvbnN0IG90aGVyUmVzdWx0cyA9IGF3YWl0IHJlc3VsdHMuYXN5bmNSZXN1bHRzO1xuXHRcdHJldHVybiB7XG5cdFx0XHRsaW1pdEhpdDogb3RoZXJSZXN1bHRzLmxpbWl0SGl0IHx8IG9wZW5FZGl0b3JSZXN1bHRzLmxpbWl0SGl0LFxuXHRcdFx0cmVzdWx0czogWy4uLm90aGVyUmVzdWx0cy5yZXN1bHRzLCAuLi5vcGVuRWRpdG9yUmVzdWx0cy5yZXN1bHRzXSxcblx0XHRcdG1lc3NhZ2VzOiBbLi4ub3RoZXJSZXN1bHRzLm1lc3NhZ2VzLCAuLi5vcGVuRWRpdG9yUmVzdWx0cy5tZXNzYWdlc11cblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgYWlUZXh0U2VhcmNoKHF1ZXJ5OiBJQUlUZXh0UXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sIG9uUHJvZ3Jlc3M/OiAoaXRlbTogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCk6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPiB7XG5cdFx0Y29uc3Qgb25Qcm92aWRlclByb2dyZXNzID0gKHByb2dyZXNzOiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB7XG5cdFx0XHQvLyBNYXRjaFxuXHRcdFx0aWYgKG9uUHJvZ3Jlc3MpIHsgLy8gZG9uJ3Qgb3ZlcnJpZGUgb3BlbiBlZGl0b3IgcmVzdWx0c1xuXHRcdFx0XHRpZiAoaXNGaWxlTWF0Y2gocHJvZ3Jlc3MpKSB7XG5cdFx0XHRcdFx0b25Qcm9ncmVzcyhwcm9ncmVzcyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b25Qcm9ncmVzcyg8SVByb2dyZXNzTWVzc2FnZT5wcm9ncmVzcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGlzUHJvZ3Jlc3NNZXNzYWdlKHByb2dyZXNzKSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZGVidWcoJ1NlYXJjaFNlcnZpY2Ujc2VhcmNoJywgcHJvZ3Jlc3MubWVzc2FnZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gdGhpcy5kb1NlYXJjaChxdWVyeSwgdG9rZW4sIG9uUHJvdmlkZXJQcm9ncmVzcyk7XG5cdH1cblxuXHRhc3luYyBnZXRBSU5hbWUoKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0U2VhcmNoUHJvdmlkZXIoUXVlcnlUeXBlLmFpVGV4dCkuZ2V0KFNjaGVtYXMuZmlsZSk7XG5cdFx0cmV0dXJuIGF3YWl0IHByb3ZpZGVyPy5nZXRBSU5hbWUoKTtcblx0fVxuXG5cdHRleHRTZWFyY2hTcGxpdFN5bmNBc3luYyhcblx0XHRxdWVyeTogSVRleHRRdWVyeSxcblx0XHR0b2tlbj86IENhbmNlbGxhdGlvblRva2VuIHwgdW5kZWZpbmVkLFxuXHRcdG9uUHJvZ3Jlc3M/OiAoKHJlc3VsdDogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCkgfCB1bmRlZmluZWQsXG5cdFx0bm90ZWJvb2tGaWxlc1RvSWdub3JlPzogUmVzb3VyY2VTZXQsXG5cdFx0YXN5bmNOb3RlYm9va0ZpbGVzVG9JZ25vcmU/OiBQcm9taXNlPFJlc291cmNlU2V0PlxuXHQpOiB7XG5cdFx0c3luY1Jlc3VsdHM6IElTZWFyY2hDb21wbGV0ZTtcblx0XHRhc3luY1Jlc3VsdHM6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPjtcblx0fSB7XG5cdFx0Ly8gR2V0IG9wZW4gZWRpdG9yIHJlc3VsdHMgZnJvbSBkaXJ0eS91bnRpdGxlZFxuXHRcdGNvbnN0IG9wZW5FZGl0b3JSZXN1bHRzID0gdGhpcy5nZXRPcGVuRWRpdG9yUmVzdWx0cyhxdWVyeSk7XG5cblx0XHRpZiAob25Qcm9ncmVzcykge1xuXHRcdFx0YXJyYXlzLmNvYWxlc2NlKFsuLi5vcGVuRWRpdG9yUmVzdWx0cy5yZXN1bHRzLnZhbHVlcygpXSkuZmlsdGVyKGUgPT4gIShub3RlYm9va0ZpbGVzVG9JZ25vcmUgJiYgbm90ZWJvb2tGaWxlc1RvSWdub3JlLmhhcyhlLnJlc291cmNlKSkpLmZvckVhY2gob25Qcm9ncmVzcyk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3luY1Jlc3VsdHM6IElTZWFyY2hDb21wbGV0ZSA9IHtcblx0XHRcdHJlc3VsdHM6IGFycmF5cy5jb2FsZXNjZShbLi4ub3BlbkVkaXRvclJlc3VsdHMucmVzdWx0cy52YWx1ZXMoKV0pLFxuXHRcdFx0bGltaXRIaXQ6IG9wZW5FZGl0b3JSZXN1bHRzLmxpbWl0SGl0ID8/IGZhbHNlLFxuXHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0fTtcblxuXHRcdGNvbnN0IGdldEFzeW5jUmVzdWx0cyA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlc29sdmVkQXN5bmNOb3RlYm9va0ZpbGVzVG9JZ25vcmUgPSBhd2FpdCBhc3luY05vdGVib29rRmlsZXNUb0lnbm9yZSA/PyBuZXcgUmVzb3VyY2VTZXQoKTtcblx0XHRcdGNvbnN0IG9uUHJvdmlkZXJQcm9ncmVzcyA9IChwcm9ncmVzczogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4ge1xuXHRcdFx0XHRpZiAoaXNGaWxlTWF0Y2gocHJvZ3Jlc3MpKSB7XG5cdFx0XHRcdFx0Ly8gTWF0Y2hcblx0XHRcdFx0XHRpZiAoIW9wZW5FZGl0b3JSZXN1bHRzLnJlc3VsdHMuaGFzKHByb2dyZXNzLnJlc291cmNlKSAmJiAhcmVzb2x2ZWRBc3luY05vdGVib29rRmlsZXNUb0lnbm9yZS5oYXMocHJvZ3Jlc3MucmVzb3VyY2UpICYmIG9uUHJvZ3Jlc3MpIHsgLy8gZG9uJ3Qgb3ZlcnJpZGUgb3BlbiBlZGl0b3IgcmVzdWx0c1xuXHRcdFx0XHRcdFx0b25Qcm9ncmVzcyhwcm9ncmVzcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKG9uUHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHQvLyBQcm9ncmVzc1xuXHRcdFx0XHRcdG9uUHJvZ3Jlc3MoPElQcm9ncmVzc01lc3NhZ2U+cHJvZ3Jlc3MpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGlzUHJvZ3Jlc3NNZXNzYWdlKHByb2dyZXNzKSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZygnU2VhcmNoU2VydmljZSNzZWFyY2gnLCBwcm9ncmVzcy5tZXNzYWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmRvU2VhcmNoKHF1ZXJ5LCB0b2tlbiwgb25Qcm92aWRlclByb2dyZXNzKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN5bmNSZXN1bHRzLFxuXHRcdFx0YXN5bmNSZXN1bHRzOiBnZXRBc3luY1Jlc3VsdHMoKVxuXHRcdH07XG5cdH1cblxuXHRmaWxlU2VhcmNoKHF1ZXJ5OiBJRmlsZVF1ZXJ5LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHRyZXR1cm4gdGhpcy5kb1NlYXJjaChxdWVyeSwgdG9rZW4pO1xuXHR9XG5cblx0c2NoZW1lSGFzRmlsZVNlYXJjaFByb3ZpZGVyKHNjaGVtZTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZVNlYXJjaFByb3ZpZGVycy5oYXMoc2NoZW1lKTtcblx0fVxuXG5cdHByaXZhdGUgZG9TZWFyY2gocXVlcnk6IElTZWFyY2hRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiwgb25Qcm9ncmVzcz86IChpdGVtOiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1NlYXJjaFNlcnZpY2Ujc2VhcmNoJywgSlNPTi5zdHJpbmdpZnkocXVlcnkpKTtcblxuXHRcdGNvbnN0IHNjaGVtZXNJblF1ZXJ5ID0gdGhpcy5nZXRTY2hlbWVzSW5RdWVyeShxdWVyeSk7XG5cblx0XHRjb25zdCBwcm92aWRlckFjdGl2YXRpb25zOiBQcm9taXNlPGFueT5bXSA9IFtQcm9taXNlLnJlc29sdmUobnVsbCldO1xuXHRcdHNjaGVtZXNJblF1ZXJ5LmZvckVhY2goc2NoZW1lID0+IHByb3ZpZGVyQWN0aXZhdGlvbnMucHVzaCh0aGlzLmV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KGBvblNlYXJjaDoke3NjaGVtZX1gKSkpO1xuXHRcdHByb3ZpZGVyQWN0aXZhdGlvbnMucHVzaCh0aGlzLmV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KCdvblNlYXJjaDpmaWxlJykpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXJQcm9taXNlID0gKGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKHByb3ZpZGVyQWN0aXZhdGlvbnMpO1xuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXG5cdFx0XHQvLyBDYW5jZWwgZmFzdGVyIGlmIHNlYXJjaCB3YXMgY2FuY2VsZWQgd2hpbGUgd2FpdGluZyBmb3IgZXh0ZW5zaW9uc1xuXHRcdFx0aWYgKHRva2VuICYmIHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHByb2dyZXNzQ2FsbGJhY2sgPSAoaXRlbTogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4ge1xuXHRcdFx0XHRpZiAodG9rZW4gJiYgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRvblByb2dyZXNzPy4oaXRlbSk7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBleGlzdHMgPSBhd2FpdCBQcm9taXNlLmFsbChxdWVyeS5mb2xkZXJRdWVyaWVzLm1hcChxdWVyeSA9PiB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhxdWVyeS5mb2xkZXIpKSk7XG5cdFx0XHRxdWVyeS5mb2xkZXJRdWVyaWVzID0gcXVlcnkuZm9sZGVyUXVlcmllcy5maWx0ZXIoKF8sIGkpID0+IGV4aXN0c1tpXSk7XG5cblx0XHRcdGxldCBjb21wbGV0ZXMgPSBhd2FpdCB0aGlzLnNlYXJjaFdpdGhQcm92aWRlcnMocXVlcnksIHByb2dyZXNzQ2FsbGJhY2ssIHRva2VuKTtcblx0XHRcdGNvbXBsZXRlcyA9IGFycmF5cy5jb2FsZXNjZShjb21wbGV0ZXMpO1xuXHRcdFx0aWYgKCFjb21wbGV0ZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bGltaXRIaXQ6IGZhbHNlLFxuXHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdG1lc3NhZ2VzOiBbXSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGltaXRIaXQ6IGNvbXBsZXRlc1swXSAmJiBjb21wbGV0ZXNbMF0ubGltaXRIaXQsXG5cdFx0XHRcdHN0YXRzOiBjb21wbGV0ZXNbMF0uc3RhdHMsXG5cdFx0XHRcdG1lc3NhZ2VzOiBhcnJheXMuY29hbGVzY2UoY29tcGxldGVzLmZsYXRNYXAoaSA9PiBpLm1lc3NhZ2VzKSkuZmlsdGVyKGFycmF5cy51bmlxdWVGaWx0ZXIobWVzc2FnZSA9PiBtZXNzYWdlLnR5cGUgKyBtZXNzYWdlLnRleHQgKyBtZXNzYWdlLnRydXN0ZWQpKSxcblx0XHRcdFx0cmVzdWx0czogY29tcGxldGVzLmZsYXRNYXAoKGM6IElTZWFyY2hDb21wbGV0ZSkgPT4gYy5yZXN1bHRzKVxuXHRcdFx0fTtcblx0XHR9KSgpO1xuXG5cdFx0cmV0dXJuIHRva2VuID8gcmFjZUNhbmNlbGxhdGlvbkVycm9yPElTZWFyY2hDb21wbGV0ZT4ocHJvdmlkZXJQcm9taXNlLCB0b2tlbikgOiBwcm92aWRlclByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGdldFNjaGVtZXNJblF1ZXJ5KHF1ZXJ5OiBJU2VhcmNoUXVlcnkpOiBTZXQ8c3RyaW5nPiB7XG5cdFx0Y29uc3Qgc2NoZW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHF1ZXJ5LmZvbGRlclF1ZXJpZXM/LmZvckVhY2goZnEgPT4gc2NoZW1lcy5hZGQoZnEuZm9sZGVyLnNjaGVtZSkpO1xuXG5cdFx0cXVlcnkuZXh0cmFGaWxlUmVzb3VyY2VzPy5mb3JFYWNoKGV4dHJhRmlsZSA9PiBzY2hlbWVzLmFkZChleHRyYUZpbGUuc2NoZW1lKSk7XG5cblx0XHRyZXR1cm4gc2NoZW1lcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2FpdEZvclByb3ZpZGVyKHF1ZXJ5VHlwZTogUXVlcnlUeXBlLCBzY2hlbWU6IHN0cmluZyk6IFByb21pc2U8SVNlYXJjaFJlc3VsdFByb3ZpZGVyPiB7XG5cdFx0Y29uc3QgZGVmZXJyZWRNYXA6IE1hcDxzdHJpbmcsIERlZmVycmVkUHJvbWlzZTxJU2VhcmNoUmVzdWx0UHJvdmlkZXI+PiA9IHRoaXMuZ2V0RGVmZXJyZWRUZXh0U2VhcmNoZXNCeVNjaGVtZShxdWVyeVR5cGUpO1xuXG5cdFx0aWYgKGRlZmVycmVkTWFwLmhhcyhzY2hlbWUpKSB7XG5cdFx0XHRyZXR1cm4gZGVmZXJyZWRNYXAuZ2V0KHNjaGVtZSkhLnA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGRlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTxJU2VhcmNoUmVzdWx0UHJvdmlkZXI+KCk7XG5cdFx0XHRkZWZlcnJlZE1hcC5zZXQoc2NoZW1lLCBkZWZlcnJlZCk7XG5cdFx0XHRyZXR1cm4gZGVmZXJyZWQucDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFNlYXJjaFByb3ZpZGVyKHR5cGU6IFF1ZXJ5VHlwZSk6IE1hcDxzdHJpbmcsIElTZWFyY2hSZXN1bHRQcm92aWRlcj4ge1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBRdWVyeVR5cGUuRmlsZTpcblx0XHRcdFx0cmV0dXJuIHRoaXMuZmlsZVNlYXJjaFByb3ZpZGVycztcblx0XHRcdGNhc2UgUXVlcnlUeXBlLlRleHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLnRleHRTZWFyY2hQcm92aWRlcnM7XG5cdFx0XHRjYXNlIFF1ZXJ5VHlwZS5haVRleHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLmFpVGV4dFNlYXJjaFByb3ZpZGVycztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBxdWVyeSB0eXBlOiAke3R5cGV9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXREZWZlcnJlZFRleHRTZWFyY2hlc0J5U2NoZW1lKHR5cGU6IFF1ZXJ5VHlwZSk6IE1hcDxzdHJpbmcsIERlZmVycmVkUHJvbWlzZTxJU2VhcmNoUmVzdWx0UHJvdmlkZXI+PiB7XG5cdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRjYXNlIFF1ZXJ5VHlwZS5GaWxlOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5kZWZlcnJlZEZpbGVTZWFyY2hlc0J5U2NoZW1lO1xuXHRcdFx0Y2FzZSBRdWVyeVR5cGUuVGV4dDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGVmZXJyZWRUZXh0U2VhcmNoZXNCeVNjaGVtZTtcblx0XHRcdGNhc2UgUXVlcnlUeXBlLmFpVGV4dDpcblx0XHRcdFx0cmV0dXJuIHRoaXMuZGVmZXJyZWRBSVRleHRTZWFyY2hlc0J5U2NoZW1lO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHF1ZXJ5IHR5cGU6ICR7dHlwZX1gKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlYXJjaFdpdGhQcm92aWRlcnMocXVlcnk6IElTZWFyY2hRdWVyeSwgb25Qcm92aWRlclByb2dyZXNzOiAocHJvZ3Jlc3M6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRjb25zdCBlMmVTVyA9IFN0b3BXYXRjaC5jcmVhdGUoZmFsc2UpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoUHM6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPltdID0gW107XG5cblx0XHRjb25zdCBmcXMgPSB0aGlzLmdyb3VwRm9sZGVyUXVlcmllc0J5U2NoZW1lKHF1ZXJ5KTtcblx0XHRjb25zdCBzb21lU2NoZW1lSGFzUHJvdmlkZXIgPSBbLi4uZnFzLmtleXMoKV0uc29tZShzY2hlbWUgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0U2VhcmNoUHJvdmlkZXIocXVlcnkudHlwZSkuaGFzKHNjaGVtZSk7XG5cdFx0fSk7XG5cblx0XHRpZiAocXVlcnkudHlwZSA9PT0gUXVlcnlUeXBlLmFpVGV4dCAmJiAhc29tZVNjaGVtZUhhc1Byb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFsuLi5mcXMua2V5cygpXS5tYXAoYXN5bmMgc2NoZW1lID0+IHtcblx0XHRcdGlmIChxdWVyeS5vbmx5RmlsZVNjaGVtZSAmJiBzY2hlbWUgIT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzY2hlbWVGUXMgPSBmcXMuZ2V0KHNjaGVtZSkhO1xuXHRcdFx0bGV0IHByb3ZpZGVyID0gdGhpcy5nZXRTZWFyY2hQcm92aWRlcihxdWVyeS50eXBlKS5nZXQoc2NoZW1lKTtcblxuXHRcdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0XHRpZiAoc29tZVNjaGVtZUhhc1Byb3ZpZGVyKSB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLmxvZ2dlZFNjaGVtZXNNaXNzaW5nUHJvdmlkZXJzLmhhcyhzY2hlbWUpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgTm8gc2VhcmNoIHByb3ZpZGVyIHJlZ2lzdGVyZWQgZm9yIHNjaGVtZTogJHtzY2hlbWV9LiBBbm90aGVyIHNjaGVtZSBoYXMgYSBwcm92aWRlciwgbm90IHdhaXRpbmcgZm9yICR7c2NoZW1lfWApO1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZWRTY2hlbWVzTWlzc2luZ1Byb3ZpZGVycy5hZGQoc2NoZW1lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICghdGhpcy5sb2dnZWRTY2hlbWVzTWlzc2luZ1Byb3ZpZGVycy5oYXMoc2NoZW1lKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oYE5vIHNlYXJjaCBwcm92aWRlciByZWdpc3RlcmVkIGZvciBzY2hlbWU6ICR7c2NoZW1lfSwgd2FpdGluZ2ApO1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dnZWRTY2hlbWVzTWlzc2luZ1Byb3ZpZGVycy5hZGQoc2NoZW1lKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJvdmlkZXIgPSBhd2FpdCB0aGlzLndhaXRGb3JQcm92aWRlcihxdWVyeS50eXBlLCBzY2hlbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9uZVNjaGVtZVF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdC4uLnF1ZXJ5LFxuXHRcdFx0XHQuLi57XG5cdFx0XHRcdFx0Zm9sZGVyUXVlcmllczogc2NoZW1lRlFzXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRvUHJvdmlkZXJTZWFyY2ggPSAoKSA9PiB7XG5cdFx0XHRcdHN3aXRjaCAocXVlcnkudHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgUXVlcnlUeXBlLkZpbGU6XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvdmlkZXIuZmlsZVNlYXJjaCg8SUZpbGVRdWVyeT5vbmVTY2hlbWVRdWVyeSwgdG9rZW4pO1xuXHRcdFx0XHRcdGNhc2UgUXVlcnlUeXBlLlRleHQ6XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvdmlkZXIudGV4dFNlYXJjaCg8SVRleHRRdWVyeT5vbmVTY2hlbWVRdWVyeSwgb25Qcm92aWRlclByb2dyZXNzLCB0b2tlbik7XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdHJldHVybiBwcm92aWRlci50ZXh0U2VhcmNoKDxJVGV4dFF1ZXJ5Pm9uZVNjaGVtZVF1ZXJ5LCBvblByb3ZpZGVyUHJvZ3Jlc3MsIHRva2VuKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0c2VhcmNoUHMucHVzaChkb1Byb3ZpZGVyU2VhcmNoKCkpO1xuXHRcdH0pKTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChzZWFyY2hQcykudGhlbihjb21wbGV0ZXMgPT4ge1xuXHRcdFx0Y29uc3QgZW5kVG9FbmRUaW1lID0gZTJlU1cuZWxhcHNlZCgpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTZWFyY2hTZXJ2aWNlI3NlYXJjaDogJHtlbmRUb0VuZFRpbWV9bXNgKTtcblx0XHRcdGNvbXBsZXRlcy5mb3JFYWNoKGNvbXBsZXRlID0+IHtcblx0XHRcdFx0dGhpcy5zZW5kVGVsZW1ldHJ5KHF1ZXJ5LCBlbmRUb0VuZFRpbWUsIGNvbXBsZXRlKTtcblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuIGNvbXBsZXRlcztcblx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0Y29uc3QgZW5kVG9FbmRUaW1lID0gZTJlU1cuZWxhcHNlZCgpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTZWFyY2hTZXJ2aWNlI3NlYXJjaDogJHtlbmRUb0VuZFRpbWV9bXNgKTtcblx0XHRcdGNvbnN0IHNlYXJjaEVycm9yID0gZGVzZXJpYWxpemVTZWFyY2hFcnJvcihlcnIpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBTZWFyY2hTZXJ2aWNlI3NlYXJjaEVycm9yOiAke3NlYXJjaEVycm9yLm1lc3NhZ2V9YCk7XG5cdFx0XHR0aGlzLnNlbmRUZWxlbWV0cnkocXVlcnksIGVuZFRvRW5kVGltZSwgdW5kZWZpbmVkLCBzZWFyY2hFcnJvcik7XG5cblx0XHRcdHRocm93IHNlYXJjaEVycm9yO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBncm91cEZvbGRlclF1ZXJpZXNCeVNjaGVtZShxdWVyeTogSVNlYXJjaFF1ZXJ5KTogTWFwPHN0cmluZywgSUZvbGRlclF1ZXJ5W10+IHtcblx0XHRjb25zdCBxdWVyaWVzID0gbmV3IE1hcDxzdHJpbmcsIElGb2xkZXJRdWVyeVtdPigpO1xuXG5cdFx0cXVlcnkuZm9sZGVyUXVlcmllcy5mb3JFYWNoKGZxID0+IHtcblx0XHRcdGNvbnN0IHNjaGVtZUZRcyA9IHF1ZXJpZXMuZ2V0KGZxLmZvbGRlci5zY2hlbWUpIHx8IFtdO1xuXHRcdFx0c2NoZW1lRlFzLnB1c2goZnEpO1xuXG5cdFx0XHRxdWVyaWVzLnNldChmcS5mb2xkZXIuc2NoZW1lLCBzY2hlbWVGUXMpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHF1ZXJpZXM7XG5cdH1cblxuXHRwcml2YXRlIHNlbmRUZWxlbWV0cnkocXVlcnk6IElTZWFyY2hRdWVyeSwgZW5kVG9FbmRUaW1lOiBudW1iZXIsIGNvbXBsZXRlPzogSVNlYXJjaENvbXBsZXRlLCBlcnI/OiBTZWFyY2hFcnJvcik6IHZvaWQge1xuXHRcdGlmICghcmFuZG9tQ2hhbmNlKDUgLyAxMDApKSB7XG5cdFx0XHQvLyBOb2lzeSBldmVudHMsIG9ubHkgc2VuZCA1JSBvZiB0aGVtXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsZVNjaGVtZU9ubHkgPSBxdWVyeS5mb2xkZXJRdWVyaWVzLmV2ZXJ5KGZxID0+IGZxLmZvbGRlci5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSk7XG5cdFx0Y29uc3Qgb3RoZXJTY2hlbWVPbmx5ID0gcXVlcnkuZm9sZGVyUXVlcmllcy5ldmVyeShmcSA9PiBmcS5mb2xkZXIuc2NoZW1lICE9PSBTY2hlbWFzLmZpbGUpO1xuXHRcdGNvbnN0IHNjaGVtZSA9IGZpbGVTY2hlbWVPbmx5ID8gU2NoZW1hcy5maWxlIDpcblx0XHRcdG90aGVyU2NoZW1lT25seSA/ICdvdGhlcicgOlxuXHRcdFx0XHQnbWl4ZWQnO1xuXG5cdFx0aWYgKHF1ZXJ5LnR5cGUgPT09IFF1ZXJ5VHlwZS5GaWxlICYmIGNvbXBsZXRlICYmIGNvbXBsZXRlLnN0YXRzKSB7XG5cdFx0XHRjb25zdCBmaWxlU2VhcmNoU3RhdHMgPSBjb21wbGV0ZS5zdGF0cyBhcyBJRmlsZVNlYXJjaFN0YXRzO1xuXHRcdFx0aWYgKGZpbGVTZWFyY2hTdGF0cy5mcm9tQ2FjaGUpIHtcblx0XHRcdFx0Y29uc3QgY2FjaGVTdGF0czogSUNhY2hlZFNlYXJjaFN0YXRzID0gZmlsZVNlYXJjaFN0YXRzLmRldGFpbFN0YXRzIGFzIElDYWNoZWRTZWFyY2hTdGF0cztcblxuXHRcdFx0XHR0eXBlIENhY2hlZFNlYXJjaENvbXBsZXRlQ2xhc3NpZmNhdGlvbiA9IHtcblx0XHRcdFx0XHRvd25lcjogJ3JvYmxvdXJlbnMnO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdGaXJlZCB3aGVuIGEgZmlsZSBzZWFyY2ggaXMgY29tcGxldGVkIGZyb20gcHJldmlvdXNseSBjYWNoZWQgcmVzdWx0cyc7XG5cdFx0XHRcdFx0cmVhc29uPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0luZGljYXRlcyB3aGljaCBleHRlbnNpb24gb3IgVUkgZmVhdHVyZSB0cmlnZ2VyZWQgdGhpcyBzZWFyY2gnIH07XG5cdFx0XHRcdFx0cmVzdWx0Q291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIHNlYXJjaCByZXN1bHRzJyB9O1xuXHRcdFx0XHRcdHdvcmtzcGFjZUZvbGRlckNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiBmb2xkZXJzIGluIHRoZSB3b3Jrc3BhY2UnIH07XG5cdFx0XHRcdFx0ZW5kVG9FbmRUaW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHRvdGFsIHNlYXJjaCB0aW1lJyB9O1xuXHRcdFx0XHRcdHNvcnRpbmdUaW1lPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBhbW91bnQgb2YgdGltZSBzcGVudCBzb3J0aW5nIHJlc3VsdHMnIH07XG5cdFx0XHRcdFx0Y2FjaGVXYXNSZXNvbHZlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1doZXRoZXIgdGhlIGNhY2hlIHdhcyBhbHJlYWR5IHJlc29sdmVkIHdoZW4gdGhlIHNlYXJjaCBiZWdhbicgfTtcblx0XHRcdFx0XHRjYWNoZUxvb2t1cFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgbG9va2luZyB1cCB0aGUgY2FjaGUgdG8gdXNlIGZvciB0aGUgc2VhcmNoJyB9O1xuXHRcdFx0XHRcdGNhY2hlRmlsdGVyVGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBhbW91bnQgb2YgdGltZSBzcGVudCBzZWFyY2hpbmcgd2l0aGluIHRoZSBjYWNoZScgfTtcblx0XHRcdFx0XHRjYWNoZUVudHJ5Q291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhlIHNlYXJjaGVkLWluIGNhY2hlJyB9O1xuXHRcdFx0XHRcdHNjaGVtZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB1cmkgc2NoZW1lIG9mIHRoZSBmb2xkZXIgc2VhcmNoZWQgaW4nIH07XG5cdFx0XHRcdH07XG5cdFx0XHRcdHR5cGUgQ2FjaGVkU2VhcmNoQ29tcGxldGVFdmVudCA9IHtcblx0XHRcdFx0XHRyZWFzb24/OiBzdHJpbmc7XG5cdFx0XHRcdFx0cmVzdWx0Q291bnQ6IG51bWJlcjtcblx0XHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJDb3VudDogbnVtYmVyO1xuXHRcdFx0XHRcdGVuZFRvRW5kVGltZTogbnVtYmVyO1xuXHRcdFx0XHRcdHNvcnRpbmdUaW1lPzogbnVtYmVyO1xuXHRcdFx0XHRcdGNhY2hlV2FzUmVzb2x2ZWQ6IGJvb2xlYW47XG5cdFx0XHRcdFx0Y2FjaGVMb29rdXBUaW1lOiBudW1iZXI7XG5cdFx0XHRcdFx0Y2FjaGVGaWx0ZXJUaW1lOiBudW1iZXI7XG5cdFx0XHRcdFx0Y2FjaGVFbnRyeUNvdW50OiBudW1iZXI7XG5cdFx0XHRcdFx0c2NoZW1lOiBzdHJpbmc7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPENhY2hlZFNlYXJjaENvbXBsZXRlRXZlbnQsIENhY2hlZFNlYXJjaENvbXBsZXRlQ2xhc3NpZmNhdGlvbj4oJ2NhY2hlZFNlYXJjaENvbXBsZXRlJywge1xuXHRcdFx0XHRcdHJlYXNvbjogcXVlcnkuX3JlYXNvbixcblx0XHRcdFx0XHRyZXN1bHRDb3VudDogZmlsZVNlYXJjaFN0YXRzLnJlc3VsdENvdW50LFxuXHRcdFx0XHRcdHdvcmtzcGFjZUZvbGRlckNvdW50OiBxdWVyeS5mb2xkZXJRdWVyaWVzLmxlbmd0aCxcblx0XHRcdFx0XHRlbmRUb0VuZFRpbWU6IGVuZFRvRW5kVGltZSxcblx0XHRcdFx0XHRzb3J0aW5nVGltZTogZmlsZVNlYXJjaFN0YXRzLnNvcnRpbmdUaW1lLFxuXHRcdFx0XHRcdGNhY2hlV2FzUmVzb2x2ZWQ6IGNhY2hlU3RhdHMuY2FjaGVXYXNSZXNvbHZlZCxcblx0XHRcdFx0XHRjYWNoZUxvb2t1cFRpbWU6IGNhY2hlU3RhdHMuY2FjaGVMb29rdXBUaW1lLFxuXHRcdFx0XHRcdGNhY2hlRmlsdGVyVGltZTogY2FjaGVTdGF0cy5jYWNoZUZpbHRlclRpbWUsXG5cdFx0XHRcdFx0Y2FjaGVFbnRyeUNvdW50OiBjYWNoZVN0YXRzLmNhY2hlRW50cnlDb3VudCxcblx0XHRcdFx0XHRzY2hlbWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBzZWFyY2hFbmdpbmVTdGF0czogSVNlYXJjaEVuZ2luZVN0YXRzID0gZmlsZVNlYXJjaFN0YXRzLmRldGFpbFN0YXRzIGFzIElTZWFyY2hFbmdpbmVTdGF0cztcblxuXHRcdFx0XHR0eXBlIFNlYXJjaENvbXBsZXRlQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0b3duZXI6ICdyb2Jsb3VyZW5zJztcblx0XHRcdFx0XHRjb21tZW50OiAnRmlyZWQgd2hlbiBhIGZpbGUgc2VhcmNoIGlzIGNvbXBsZXRlZCc7XG5cdFx0XHRcdFx0cmVhc29uPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0luZGljYXRlcyB3aGljaCBleHRlbnNpb24gb3IgVUkgZmVhdHVyZSB0cmlnZ2VyZWQgdGhpcyBzZWFyY2gnIH07XG5cdFx0XHRcdFx0cmVzdWx0Q291bnQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIHNlYXJjaCByZXN1bHRzJyB9O1xuXHRcdFx0XHRcdHdvcmtzcGFjZUZvbGRlckNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiBmb2xkZXJzIGluIHRoZSB3b3Jrc3BhY2UnIH07XG5cdFx0XHRcdFx0ZW5kVG9FbmRUaW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHRvdGFsIHNlYXJjaCB0aW1lJyB9O1xuXHRcdFx0XHRcdHNvcnRpbmdUaW1lPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBhbW91bnQgb2YgdGltZSBzcGVudCBzb3J0aW5nIHJlc3VsdHMnIH07XG5cdFx0XHRcdFx0ZmlsZVdhbGtUaW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGFtb3VudCBvZiB0aW1lIHNwZW50IHdhbGtpbmcgZmlsZSBzeXN0ZW0nIH07XG5cdFx0XHRcdFx0ZGlyZWN0b3JpZXNXYWxrZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGRpcmVjdG9yaWVzIHdhbGtlZCcgfTtcblx0XHRcdFx0XHRmaWxlc1dhbGtlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgZmlsZXMgd2Fsa2VkJyB9O1xuXHRcdFx0XHRcdGNtZFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgYW1vdW50IG9mIHRpbWUgc3BlbnQgcnVubmluZyB0aGUgc2VhcmNoIGNvbW1hbmQnIH07XG5cdFx0XHRcdFx0Y21kUmVzdWx0Q291bnQ/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiByZXN1bHRzIHJldHVybmVkIGZyb20gdGhlIHNlYXJjaCBjb21tYW5kJyB9O1xuXHRcdFx0XHRcdHNjaGVtZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB1cmkgc2NoZW1lIG9mIHRoZSBmb2xkZXIgc2VhcmNoZWQgaW4nIH07XG5cdFx0XHRcdH07XG5cdFx0XHRcdHR5cGUgU2VhcmNoQ29tcGxldGVFdmVudCA9IHtcblx0XHRcdFx0XHRyZWFzb24/OiBzdHJpbmc7XG5cdFx0XHRcdFx0cmVzdWx0Q291bnQ6IG51bWJlcjtcblx0XHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJDb3VudDogbnVtYmVyO1xuXHRcdFx0XHRcdGVuZFRvRW5kVGltZTogbnVtYmVyO1xuXHRcdFx0XHRcdHNvcnRpbmdUaW1lPzogbnVtYmVyO1xuXHRcdFx0XHRcdGZpbGVXYWxrVGltZTogbnVtYmVyO1xuXHRcdFx0XHRcdGRpcmVjdG9yaWVzV2Fsa2VkOiBudW1iZXI7XG5cdFx0XHRcdFx0ZmlsZXNXYWxrZWQ6IG51bWJlcjtcblx0XHRcdFx0XHRjbWRUaW1lOiBudW1iZXI7XG5cdFx0XHRcdFx0Y21kUmVzdWx0Q291bnQ/OiBudW1iZXI7XG5cdFx0XHRcdFx0c2NoZW1lOiBzdHJpbmc7XG5cblx0XHRcdFx0fTtcblxuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTZWFyY2hDb21wbGV0ZUV2ZW50LCBTZWFyY2hDb21wbGV0ZUNsYXNzaWZpY2F0aW9uPignc2VhcmNoQ29tcGxldGUnLCB7XG5cdFx0XHRcdFx0cmVhc29uOiBxdWVyeS5fcmVhc29uLFxuXHRcdFx0XHRcdHJlc3VsdENvdW50OiBmaWxlU2VhcmNoU3RhdHMucmVzdWx0Q291bnQsXG5cdFx0XHRcdFx0d29ya3NwYWNlRm9sZGVyQ291bnQ6IHF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoLFxuXHRcdFx0XHRcdGVuZFRvRW5kVGltZTogZW5kVG9FbmRUaW1lLFxuXHRcdFx0XHRcdHNvcnRpbmdUaW1lOiBmaWxlU2VhcmNoU3RhdHMuc29ydGluZ1RpbWUsXG5cdFx0XHRcdFx0ZmlsZVdhbGtUaW1lOiBzZWFyY2hFbmdpbmVTdGF0cy5maWxlV2Fsa1RpbWUsXG5cdFx0XHRcdFx0ZGlyZWN0b3JpZXNXYWxrZWQ6IHNlYXJjaEVuZ2luZVN0YXRzLmRpcmVjdG9yaWVzV2Fsa2VkLFxuXHRcdFx0XHRcdGZpbGVzV2Fsa2VkOiBzZWFyY2hFbmdpbmVTdGF0cy5maWxlc1dhbGtlZCxcblx0XHRcdFx0XHRjbWRUaW1lOiBzZWFyY2hFbmdpbmVTdGF0cy5jbWRUaW1lLFxuXHRcdFx0XHRcdGNtZFJlc3VsdENvdW50OiBzZWFyY2hFbmdpbmVTdGF0cy5jbWRSZXN1bHRDb3VudCxcblx0XHRcdFx0XHRzY2hlbWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChxdWVyeS50eXBlID09PSBRdWVyeVR5cGUuVGV4dCkge1xuXHRcdFx0bGV0IGVycm9yVHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGVycikge1xuXHRcdFx0XHRlcnJvclR5cGUgPSBlcnIuY29kZSA9PT0gU2VhcmNoRXJyb3JDb2RlLnJlZ2V4UGFyc2VFcnJvciA/ICdyZWdleCcgOlxuXHRcdFx0XHRcdGVyci5jb2RlID09PSBTZWFyY2hFcnJvckNvZGUudW5rbm93bkVuY29kaW5nID8gJ2VuY29kaW5nJyA6XG5cdFx0XHRcdFx0XHRlcnIuY29kZSA9PT0gU2VhcmNoRXJyb3JDb2RlLmdsb2JQYXJzZUVycm9yID8gJ2dsb2InIDpcblx0XHRcdFx0XHRcdFx0ZXJyLmNvZGUgPT09IFNlYXJjaEVycm9yQ29kZS5pbnZhbGlkTGl0ZXJhbCA/ICdsaXRlcmFsJyA6XG5cdFx0XHRcdFx0XHRcdFx0ZXJyLmNvZGUgPT09IFNlYXJjaEVycm9yQ29kZS5vdGhlciA/ICdvdGhlcicgOlxuXHRcdFx0XHRcdFx0XHRcdFx0ZXJyLmNvZGUgPT09IFNlYXJjaEVycm9yQ29kZS5jYW5jZWxlZCA/ICdjYW5jZWxlZCcgOlxuXHRcdFx0XHRcdFx0XHRcdFx0XHQndW5rbm93bic7XG5cdFx0XHR9XG5cblx0XHRcdHR5cGUgVGV4dFNlYXJjaENvbXBsZXRlQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAncm9ibG91cmVucyc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdGaXJlZCB3aGVuIGEgdGV4dCBzZWFyY2ggaXMgY29tcGxldGVkJztcblx0XHRcdFx0cmVhc29uPzogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0luZGljYXRlcyB3aGljaCBleHRlbnNpb24gb3IgVUkgZmVhdHVyZSB0cmlnZ2VyZWQgdGhpcyBzZWFyY2gnIH07XG5cdFx0XHRcdHdvcmtzcGFjZUZvbGRlckNvdW50OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiBmb2xkZXJzIGluIHRoZSB3b3Jrc3BhY2UnIH07XG5cdFx0XHRcdGVuZFRvRW5kVGltZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB0b3RhbCBzZWFyY2ggdGltZScgfTtcblx0XHRcdFx0c2NoZW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHVyaSBzY2hlbWUgb2YgdGhlIGZvbGRlciBzZWFyY2hlZCBpbicgfTtcblx0XHRcdFx0ZXJyb3I/OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHR5cGUgb2YgdGhlIGVycm9yLCBpZiBhbnknIH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBUZXh0U2VhcmNoQ29tcGxldGVFdmVudCA9IHtcblx0XHRcdFx0cmVhc29uPzogc3RyaW5nO1xuXHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJDb3VudDogbnVtYmVyO1xuXHRcdFx0XHRlbmRUb0VuZFRpbWU6IG51bWJlcjtcblx0XHRcdFx0c2NoZW1lOiBzdHJpbmc7XG5cdFx0XHRcdGVycm9yPzogc3RyaW5nO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFRleHRTZWFyY2hDb21wbGV0ZUV2ZW50LCBUZXh0U2VhcmNoQ29tcGxldGVDbGFzc2lmaWNhdGlvbj4oJ3RleHRTZWFyY2hDb21wbGV0ZScsIHtcblx0XHRcdFx0cmVhc29uOiBxdWVyeS5fcmVhc29uLFxuXHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJDb3VudDogcXVlcnkuZm9sZGVyUXVlcmllcy5sZW5ndGgsXG5cdFx0XHRcdGVuZFRvRW5kVGltZTogZW5kVG9FbmRUaW1lLFxuXHRcdFx0XHRzY2hlbWUsXG5cdFx0XHRcdGVycm9yOiBlcnJvclR5cGUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE9wZW5FZGl0b3JSZXN1bHRzKHF1ZXJ5OiBJVGV4dFF1ZXJ5KTogeyByZXN1bHRzOiBSZXNvdXJjZU1hcDxJRmlsZU1hdGNoIHwgbnVsbD47IGxpbWl0SGl0OiBib29sZWFuIH0ge1xuXHRcdGNvbnN0IG9wZW5FZGl0b3JSZXN1bHRzID0gbmV3IFJlc291cmNlTWFwPElGaWxlTWF0Y2ggfCBudWxsPih1cmkgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmdldENvbXBhcmlzb25LZXkodXJpKSk7XG5cdFx0bGV0IGxpbWl0SGl0ID0gZmFsc2U7XG5cblx0XHRpZiAocXVlcnkudHlwZSA9PT0gUXVlcnlUeXBlLlRleHQpIHtcblx0XHRcdGNvbnN0IGNhbm9uaWNhbFRvT3JpZ2luYWxSZXNvdXJjZXMgPSBuZXcgUmVzb3VyY2VNYXA8VVJJPigpO1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3JJbnB1dCBvZiB0aGlzLmVkaXRvclNlcnZpY2UuZWRpdG9ycykge1xuXHRcdFx0XHRjb25zdCBjYW5vbmljYWwgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3JJbnB1dCwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdFx0XHRjb25zdCBvcmlnaW5hbCA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoZWRpdG9ySW5wdXQsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblxuXHRcdFx0XHRpZiAoY2Fub25pY2FsKSB7XG5cdFx0XHRcdFx0Y2Fub25pY2FsVG9PcmlnaW5hbFJlc291cmNlcy5zZXQoY2Fub25pY2FsLCBvcmlnaW5hbCA/PyBjYW5vbmljYWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1vZGVscyA9IHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVscygpO1xuXHRcdFx0bW9kZWxzLmZvckVhY2goKG1vZGVsKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc291cmNlID0gbW9kZWwudXJpO1xuXHRcdFx0XHRpZiAoIXJlc291cmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGxpbWl0SGl0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxSZXNvdXJjZSA9IGNhbm9uaWNhbFRvT3JpZ2luYWxSZXNvdXJjZXMuZ2V0KHJlc291cmNlKTtcblx0XHRcdFx0aWYgKCFvcmlnaW5hbFJlc291cmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU2tpcCBzZWFyY2ggcmVzdWx0c1xuXHRcdFx0XHRpZiAobW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpID09PSBTRUFSQ0hfUkVTVUxUX0xBTkdVQUdFX0lEICYmICEocXVlcnkuaW5jbHVkZVBhdHRlcm4gJiYgcXVlcnkuaW5jbHVkZVBhdHRlcm5bJyoqLyouY29kZS1zZWFyY2gnXSkpIHtcblx0XHRcdFx0XHQvLyBUT0RPOiB1bnRpdGxlZCBzZWFyY2ggZWRpdG9ycyB3aWxsIGJlIGV4Y2x1ZGVkIGZyb20gc2VhcmNoIGV2ZW4gd2hlbiBpbmNsdWRlICouY29kZS1zZWFyY2ggaXMgc3BlY2lmaWVkXG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQmxvY2sgd2Fsa3Rocm91Z2gsIHdlYnZpZXcsIGV0Yy5cblx0XHRcdFx0aWYgKG9yaWdpbmFsUmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLnVudGl0bGVkICYmICF0aGlzLmZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKG9yaWdpbmFsUmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRXhjbHVkZSBmaWxlcyBmcm9tIHRoZSBnaXQgRmlsZVN5c3RlbVByb3ZpZGVyLCBlLmcuIHRvIHByZXZlbnQgb3BlbiBzdGFnZWQgZmlsZXMgZnJvbSBzaG93aW5nIGluIHNlYXJjaCByZXN1bHRzXG5cdFx0XHRcdGlmIChvcmlnaW5hbFJlc291cmNlLnNjaGVtZSA9PT0gJ2dpdCcpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIXRoaXMubWF0Y2hlcyhvcmlnaW5hbFJlc291cmNlLCBxdWVyeSkpIHtcblx0XHRcdFx0XHRyZXR1cm47IC8vIHJlc3BlY3QgdXNlciBmaWx0ZXJzXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBVc2UgZWRpdG9yIEFQSSB0byBmaW5kIG1hdGNoZXNcblx0XHRcdFx0Y29uc3QgYXNrTWF4ID0gKGlzTnVtYmVyKHF1ZXJ5Lm1heFJlc3VsdHMpID8gcXVlcnkubWF4UmVzdWx0cyA6IERFRkFVTFRfTUFYX1NFQVJDSF9SRVNVTFRTKSArIDE7XG5cdFx0XHRcdGxldCBtYXRjaGVzID0gbW9kZWwuZmluZE1hdGNoZXMocXVlcnkuY29udGVudFBhdHRlcm4ucGF0dGVybiwgZmFsc2UsICEhcXVlcnkuY29udGVudFBhdHRlcm4uaXNSZWdFeHAsICEhcXVlcnkuY29udGVudFBhdHRlcm4uaXNDYXNlU2Vuc2l0aXZlLCBxdWVyeS5jb250ZW50UGF0dGVybi5pc1dvcmRNYXRjaCA/IHF1ZXJ5LmNvbnRlbnRQYXR0ZXJuLndvcmRTZXBhcmF0b3JzISA6IG51bGwsIGZhbHNlLCBhc2tNYXgpO1xuXHRcdFx0XHRpZiAobWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRpZiAoYXNrTWF4ICYmIG1hdGNoZXMubGVuZ3RoID49IGFza01heCkge1xuXHRcdFx0XHRcdFx0bGltaXRIaXQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0bWF0Y2hlcyA9IG1hdGNoZXMuc2xpY2UoMCwgYXNrTWF4IC0gMSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZmlsZU1hdGNoID0gbmV3IEZpbGVNYXRjaChvcmlnaW5hbFJlc291cmNlKTtcblx0XHRcdFx0XHRvcGVuRWRpdG9yUmVzdWx0cy5zZXQob3JpZ2luYWxSZXNvdXJjZSwgZmlsZU1hdGNoKTtcblxuXHRcdFx0XHRcdGNvbnN0IHRleHRTZWFyY2hSZXN1bHRzID0gZWRpdG9yTWF0Y2hlc1RvVGV4dFNlYXJjaFJlc3VsdHMobWF0Y2hlcywgbW9kZWwsIHF1ZXJ5LnByZXZpZXdPcHRpb25zKTtcblx0XHRcdFx0XHRmaWxlTWF0Y2gucmVzdWx0cyA9IGdldFRleHRTZWFyY2hNYXRjaFdpdGhNb2RlbENvbnRleHQodGV4dFNlYXJjaFJlc3VsdHMsIG1vZGVsLCBxdWVyeSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3BlbkVkaXRvclJlc3VsdHMuc2V0KG9yaWdpbmFsUmVzb3VyY2UsIG51bGwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdWx0czogb3BlbkVkaXRvclJlc3VsdHMsXG5cdFx0XHRsaW1pdEhpdFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIG1hdGNoZXMocmVzb3VyY2U6IHVyaSwgcXVlcnk6IElUZXh0UXVlcnkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcGF0aEluY2x1ZGVkSW5RdWVyeShxdWVyeSwgcmVzb3VyY2UuZnNQYXRoKTtcblx0fVxuXG5cdGFzeW5jIGNsZWFyQ2FjaGUoY2FjaGVLZXk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNsZWFyUHMgPSBBcnJheS5mcm9tKHRoaXMuZmlsZVNlYXJjaFByb3ZpZGVycy52YWx1ZXMoKSlcblx0XHRcdC5tYXAocHJvdmlkZXIgPT4gcHJvdmlkZXIgJiYgcHJvdmlkZXIuY2xlYXJDYWNoZShjYWNoZUtleSkpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGNsZWFyUHMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksWUFBWTtBQUN4QixTQUFTLGlCQUFpQiw2QkFBNkI7QUFFdkQsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxZQUF5QixvQkFBb0I7QUFDdEQsU0FBUyxhQUFhLG1CQUFtQjtBQUN6QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0Isd0JBQXdCO0FBQ3pELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCLHdCQUF3QixXQUFzTyxhQUFhLG1CQUErQixxQkFBcUIsV0FBVywyQkFBd0MsaUJBQWlCLDBCQUEwQjtBQUNsYyxTQUFTLG9DQUFvQyx3Q0FBd0M7QUFFOUUsSUFBTSxnQkFBTixjQUE0QixXQUFxQztBQUFBLEVBY3ZFLFlBQ2lDLGNBQ0MsZUFDRyxrQkFDTixZQUNNLGtCQUNMLGFBQ08sb0JBQ3JDO0FBQ0QsVUFBTTtBQVIwQjtBQUNDO0FBQ0c7QUFDTjtBQUNNO0FBQ0w7QUFDTztBQWpCdkMsU0FBaUIsc0JBQXNCLG9C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
