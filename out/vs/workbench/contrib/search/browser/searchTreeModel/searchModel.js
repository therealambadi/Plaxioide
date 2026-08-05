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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import * as errors from "../../../../../base/common/errors.js";
import { Emitter, Event, PauseableEmitter } from "../../../../../base/common/event.js";
import { Lazy } from "../../../../../base/common/lazy.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { INotebookSearchService } from "../../common/notebookSearch.js";
import { ReplacePattern } from "../../../../services/search/common/replace.js";
import { ISearchService, QueryType, SearchCompletionExitCode } from "../../../../services/search/common/search.js";
import { mergeSearchResultEvents, SearchModelLocation, SEARCH_MODEL_PREFIX } from "./searchTreeCommon.js";
import { SearchResultImpl } from "./searchResult.js";
let SearchModelImpl = class extends Disposable {
  constructor(searchService, telemetryService, configurationService, instantiationService, logService, notebookSearchService) {
    super();
    this.searchService = searchService;
    this.telemetryService = telemetryService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.notebookSearchService = notebookSearchService;
    this._searchQuery = null;
    this._replaceActive = false;
    this._replaceString = null;
    this._replacePattern = null;
    this._preserveCase = false;
    this._startStreamDelay = Promise.resolve();
    this._resultQueue = [];
    this._aiResultQueue = [];
    this._onReplaceTermChanged = this._register(new Emitter());
    this.onReplaceTermChanged = this._onReplaceTermChanged.event;
    this._onSearchResultChanged = this._register(new PauseableEmitter({
      merge: mergeSearchResultEvents
    }));
    this.onSearchResultChanged = this._onSearchResultChanged.event;
    this.currentCancelTokenSource = null;
    this.currentAICancelTokenSource = null;
    this.searchCancelledForNewSearch = false;
    this.aiSearchCancelledForNewSearch = false;
    this.location = SearchModelLocation.PANEL;
    this._searchResult = this.instantiationService.createInstance(SearchResultImpl, this);
    this._register(this._searchResult.onChange((e) => this._onSearchResultChanged.fire(e)));
    this._aiTextResultProviderName = new Lazy(async () => this.searchService.getAIName());
    this._id = SEARCH_MODEL_PREFIX + Date.now().toString();
  }
  id() {
    return this._id;
  }
  async getAITextResultProviderName() {
    const result = await this._aiTextResultProviderName.value;
    if (!result) {
      throw Error("Fetching AI name when no provider present.");
    }
    return result;
  }
  isReplaceActive() {
    return this._replaceActive;
  }
  set replaceActive(replaceActive) {
    this._replaceActive = replaceActive;
  }
  get replacePattern() {
    return this._replacePattern;
  }
  get replaceString() {
    return this._replaceString || "";
  }
  set preserveCase(value) {
    this._preserveCase = value;
  }
  get preserveCase() {
    return this._preserveCase;
  }
  set replaceString(replaceString) {
    this._replaceString = replaceString;
    if (this._searchQuery) {
      this._replacePattern = new ReplacePattern(replaceString, this._searchQuery.contentPattern);
    }
    this._onReplaceTermChanged.fire();
  }
  get searchResult() {
    return this._searchResult;
  }
  async addAIResults(onProgress) {
    if (this.hasAIResults) {
      throw Error("AI results already exist");
    } else {
      if (this._searchQuery) {
        return this.aiSearch(
          { ...this._searchQuery, contentPattern: this._searchQuery.contentPattern.pattern, type: QueryType.aiText },
          onProgress
        );
      } else {
        throw Error("No search query");
      }
    }
  }
  aiSearch(query, onProgress) {
    const searchInstanceID = Date.now().toString();
    const tokenSource = new CancellationTokenSource();
    this.currentAICancelTokenSource = tokenSource;
    const start = Date.now();
    const asyncAIResults = this.searchService.aiTextSearch(
      query,
      tokenSource.token,
      async (p) => {
        this.onSearchProgress(p, searchInstanceID, false, true);
        onProgress?.(p);
      }
    ).finally(() => {
      tokenSource.dispose(true);
    }).then(
      (value) => {
        this.onSearchCompleted(value, Date.now() - start, searchInstanceID, true);
        return value;
      },
      (e) => {
        this.onSearchError(e, Date.now() - start, true);
        throw e;
      }
    );
    return asyncAIResults;
  }
  doSearch(query, progressEmitter, searchQuery, searchInstanceID, onProgress, callerToken) {
    const asyncGenerateOnProgress = async (p) => {
      progressEmitter.fire();
      this.onSearchProgress(p, searchInstanceID, false, false);
      onProgress?.(p);
    };
    const syncGenerateOnProgress = (p) => {
      progressEmitter.fire();
      this.onSearchProgress(p, searchInstanceID, true);
      onProgress?.(p);
    };
    const tokenSource = this.currentCancelTokenSource = new CancellationTokenSource(callerToken);
    const notebookResult = this.notebookSearchService.notebookSearch(query, tokenSource.token, searchInstanceID, asyncGenerateOnProgress);
    const textResult = this.searchService.textSearchSplitSyncAsync(
      searchQuery,
      tokenSource.token,
      asyncGenerateOnProgress,
      notebookResult.openFilesToScan,
      notebookResult.allScannedFiles
    );
    const syncResults = textResult.syncResults.results;
    syncResults.forEach((p) => {
      if (p) {
        syncGenerateOnProgress(p);
      }
    });
    const getAsyncResults = async () => {
      const searchStart = Date.now();
      const allClosedEditorResults = await textResult.asyncResults;
      const resolvedNotebookResults = await notebookResult.completeData;
      const searchLength = Date.now() - searchStart;
      const resolvedResult = {
        results: [...allClosedEditorResults.results, ...resolvedNotebookResults.results],
        messages: [...allClosedEditorResults.messages, ...resolvedNotebookResults.messages],
        limitHit: allClosedEditorResults.limitHit || resolvedNotebookResults.limitHit,
        exit: allClosedEditorResults.exit,
        stats: allClosedEditorResults.stats
      };
      this.logService.trace(`whole search time | ${searchLength}ms`);
      return resolvedResult;
    };
    return {
      asyncResults: getAsyncResults().finally(() => tokenSource.dispose(true)),
      syncResults
    };
  }
  get hasAIResults() {
    return !!this.searchResult.getCachedSearchComplete(true) || !!this.currentAICancelTokenSource && !this.currentAICancelTokenSource.token.isCancellationRequested;
  }
  get hasPlainResults() {
    return !!this.searchResult.getCachedSearchComplete(false) || !!this.currentCancelTokenSource && !this.currentCancelTokenSource.token.isCancellationRequested;
  }
  search(query, onProgress, callerToken) {
    this.cancelSearch(true);
    this._searchQuery = query;
    if (!this.searchConfig.searchOnType) {
      this.searchResult.clear();
    }
    const searchInstanceID = Date.now().toString();
    this._searchResult.query = this._searchQuery;
    const progressEmitter = this._register(new Emitter());
    this._replacePattern = new ReplacePattern(this.replaceString, this._searchQuery.contentPattern);
    this._startStreamDelay = new Promise((resolve) => setTimeout(resolve, this.searchConfig.searchOnType ? 150 : 0));
    const req = this.doSearch(query, progressEmitter, this._searchQuery, searchInstanceID, onProgress, callerToken);
    const asyncResults = req.asyncResults;
    const syncResults = req.syncResults;
    if (onProgress) {
      syncResults.forEach((p) => {
        if (p) {
          onProgress(p);
        }
      });
    }
    const start = Date.now();
    let event;
    const progressEmitterPromise = new Promise((resolve) => {
      event = Event.once(progressEmitter.event)(resolve);
      return event;
    });
    Promise.race([asyncResults, progressEmitterPromise]).finally(() => {
      event?.dispose();
      this.telemetryService.publicLog("searchResultsFirstRender", { duration: Date.now() - start });
    });
    try {
      return {
        asyncResults: asyncResults.then(
          (value) => {
            this.onSearchCompleted(value, Date.now() - start, searchInstanceID, false);
            return value;
          },
          (e) => {
            this.onSearchError(e, Date.now() - start, false);
            throw e;
          }
        ),
        syncResults
      };
    } finally {
      this.telemetryService.publicLog("searchResultsFinished", { duration: Date.now() - start });
    }
  }
  onSearchCompleted(completed, duration, searchInstanceID, ai) {
    if (!this._searchQuery) {
      throw new Error("onSearchCompleted must be called after a search is started");
    }
    if (ai) {
      this._searchResult.add(this._aiResultQueue, searchInstanceID, true);
      this._aiResultQueue.length = 0;
    } else {
      this._searchResult.add(this._resultQueue, searchInstanceID, false);
      this._resultQueue.length = 0;
    }
    this.searchResult.setCachedSearchComplete(completed, ai);
    const options = Object.assign({}, this._searchQuery.contentPattern);
    delete options.pattern;
    const stats = completed && completed.stats;
    const fileSchemeOnly = this._searchQuery.folderQueries.every((fq) => fq.folder.scheme === Schemas.file);
    const otherSchemeOnly = this._searchQuery.folderQueries.every((fq) => fq.folder.scheme !== Schemas.file);
    const scheme = fileSchemeOnly ? Schemas.file : otherSchemeOnly ? "other" : "mixed";
    this.telemetryService.publicLog("searchResultsShown", {
      count: this._searchResult.count(),
      fileCount: this._searchResult.fileCount(),
      options,
      duration,
      type: stats && stats.type,
      scheme,
      searchOnTypeEnabled: this.searchConfig.searchOnType
    });
    return completed;
  }
  onSearchError(e, duration, ai) {
    if (errors.isCancellationError(e)) {
      this.onSearchCompleted(
        (ai ? this.aiSearchCancelledForNewSearch : this.searchCancelledForNewSearch) ? { exit: SearchCompletionExitCode.NewSearchStarted, results: [], messages: [] } : void 0,
        duration,
        "",
        ai
      );
      if (ai) {
        this.aiSearchCancelledForNewSearch = false;
      } else {
        this.searchCancelledForNewSearch = false;
      }
    }
  }
  onSearchProgress(p, searchInstanceID, sync = true, ai = false) {
    const targetQueue = ai ? this._aiResultQueue : this._resultQueue;
    if (p.resource) {
      targetQueue.push(p);
      if (sync) {
        if (targetQueue.length) {
          this._searchResult.add(targetQueue, searchInstanceID, false, true);
          targetQueue.length = 0;
        }
      } else {
        this._startStreamDelay.then(() => {
          if (targetQueue.length) {
            this._searchResult.add(targetQueue, searchInstanceID, ai, true);
            targetQueue.length = 0;
          }
        });
      }
    }
  }
  get searchConfig() {
    return this.configurationService.getValue("search");
  }
  cancelSearch(cancelledForNewSearch = false) {
    if (this.currentCancelTokenSource) {
      this.searchCancelledForNewSearch = cancelledForNewSearch;
      this.currentCancelTokenSource.cancel();
      return true;
    }
    return false;
  }
  cancelAISearch(cancelledForNewSearch = false) {
    if (this.currentAICancelTokenSource) {
      this.aiSearchCancelledForNewSearch = cancelledForNewSearch;
      this.currentAICancelTokenSource.cancel();
      return true;
    }
    return false;
  }
  clearAiSearchResults() {
    this._aiResultQueue.length = 0;
    this._searchResult.aiTextSearchResult.clear(false);
  }
  dispose() {
    this.cancelSearch();
    this.cancelAISearch();
    this.searchResult.dispose();
    super.dispose();
  }
};
SearchModelImpl = __decorateClass([
  __decorateParam(0, ISearchService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, INotebookSearchService)
], SearchModelImpl);
let SearchViewModelWorkbenchService = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this._searchModel = null;
  }
  get searchModel() {
    if (!this._searchModel) {
      this._searchModel = this.instantiationService.createInstance(SearchModelImpl);
    }
    return this._searchModel;
  }
  set searchModel(searchModel) {
    this._searchModel?.dispose();
    this._searchModel = searchModel;
  }
};
SearchViewModelWorkbenchService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], SearchViewModelWorkbenchService);
export {
  SearchModelImpl,
  SearchViewModelWorkbenchService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoTW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBlcnJvcnMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBQYXVzZWFibGVFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VhcmNoU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va1NlYXJjaC5qcyc7XG5pbXBvcnQgeyBSZXBsYWNlUGF0dGVybiB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vcmVwbGFjZS5qcyc7XG5pbXBvcnQgeyBJQUlUZXh0UXVlcnksIElGaWxlTWF0Y2gsIElQYXR0ZXJuSW5mbywgSVNlYXJjaENvbXBsZXRlLCBJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXMsIElTZWFyY2hQcm9ncmVzc0l0ZW0sIElTZWFyY2hTZXJ2aWNlLCBJVGV4dFF1ZXJ5LCBJVGV4dFNlYXJjaFN0YXRzLCBRdWVyeVR5cGUsIFNlYXJjaENvbXBsZXRpb25FeGl0Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElDaGFuZ2VFdmVudCwgbWVyZ2VTZWFyY2hSZXN1bHRFdmVudHMsIFNlYXJjaE1vZGVsTG9jYXRpb24sIElTZWFyY2hNb2RlbCwgSVNlYXJjaFJlc3VsdCwgU0VBUkNIX01PREVMX1BSRUZJWCB9IGZyb20gJy4vc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5pbXBvcnQgeyBTZWFyY2hSZXN1bHRJbXBsIH0gZnJvbSAnLi9zZWFyY2hSZXN1bHQuanMnO1xuaW1wb3J0IHsgSVNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UgfSBmcm9tICcuL3NlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgU2VhcmNoTW9kZWxJbXBsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTZWFyY2hNb2RlbCB7XG5cblx0cHJpdmF0ZSBfc2VhcmNoUmVzdWx0OiBJU2VhcmNoUmVzdWx0O1xuXHRwcml2YXRlIF9zZWFyY2hRdWVyeTogSVRleHRRdWVyeSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9yZXBsYWNlQWN0aXZlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3JlcGxhY2VTdHJpbmc6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9yZXBsYWNlUGF0dGVybjogUmVwbGFjZVBhdHRlcm4gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfcHJlc2VydmVDYXNlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3N0YXJ0U3RyZWFtRGVsYXk6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzdWx0UXVldWU6IElGaWxlTWF0Y2hbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9haVJlc3VsdFF1ZXVlOiBJRmlsZU1hdGNoW10gPSBbXTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblJlcGxhY2VUZXJtQ2hhbmdlZDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblJlcGxhY2VUZXJtQ2hhbmdlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vblJlcGxhY2VUZXJtQ2hhbmdlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vblNlYXJjaFJlc3VsdENoYW5nZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgUGF1c2VhYmxlRW1pdHRlcjxJQ2hhbmdlRXZlbnQ+KHtcblx0XHRtZXJnZTogbWVyZ2VTZWFyY2hSZXN1bHRFdmVudHNcblx0fSkpO1xuXHRyZWFkb25seSBvblNlYXJjaFJlc3VsdENoYW5nZWQ6IEV2ZW50PElDaGFuZ2VFdmVudD4gPSB0aGlzLl9vblNlYXJjaFJlc3VsdENoYW5nZWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBjdXJyZW50Q2FuY2VsVG9rZW5Tb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgY3VycmVudEFJQ2FuY2VsVG9rZW5Tb3VyY2U6IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgc2VhcmNoQ2FuY2VsbGVkRm9yTmV3U2VhcmNoOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgYWlTZWFyY2hDYW5jZWxsZWRGb3JOZXdTZWFyY2g6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGxvY2F0aW9uOiBTZWFyY2hNb2RlbExvY2F0aW9uID0gU2VhcmNoTW9kZWxMb2NhdGlvbi5QQU5FTDtcblx0cHJpdmF0ZSByZWFkb25seSBfYWlUZXh0UmVzdWx0UHJvdmlkZXJOYW1lOiBMYXp5PFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IHN0cmluZztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVNlYXJjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzZWFyY2hTZXJ2aWNlOiBJU2VhcmNoU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASU5vdGVib29rU2VhcmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rU2VhcmNoU2VydmljZTogSU5vdGVib29rU2VhcmNoU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9zZWFyY2hSZXN1bHQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaFJlc3VsdEltcGwsIHRoaXMpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3NlYXJjaFJlc3VsdC5vbkNoYW5nZSgoZSkgPT4gdGhpcy5fb25TZWFyY2hSZXN1bHRDaGFuZ2VkLmZpcmUoZSkpKTtcblxuXHRcdHRoaXMuX2FpVGV4dFJlc3VsdFByb3ZpZGVyTmFtZSA9IG5ldyBMYXp5KGFzeW5jICgpID0+IHRoaXMuc2VhcmNoU2VydmljZS5nZXRBSU5hbWUoKSk7XG5cdFx0dGhpcy5faWQgPSBTRUFSQ0hfTU9ERUxfUFJFRklYICsgRGF0ZS5ub3coKS50b1N0cmluZygpO1xuXHR9XG5cblx0aWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRhc3luYyBnZXRBSVRleHRSZXN1bHRQcm92aWRlck5hbWUoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9haVRleHRSZXN1bHRQcm92aWRlck5hbWUudmFsdWU7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHRocm93IEVycm9yKCdGZXRjaGluZyBBSSBuYW1lIHdoZW4gbm8gcHJvdmlkZXIgcHJlc2VudC4nKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGlzUmVwbGFjZUFjdGl2ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVwbGFjZUFjdGl2ZTtcblx0fVxuXG5cdHNldCByZXBsYWNlQWN0aXZlKHJlcGxhY2VBY3RpdmU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9yZXBsYWNlQWN0aXZlID0gcmVwbGFjZUFjdGl2ZTtcblx0fVxuXG5cdGdldCByZXBsYWNlUGF0dGVybigpOiBSZXBsYWNlUGF0dGVybiB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9yZXBsYWNlUGF0dGVybjtcblx0fVxuXG5cdGdldCByZXBsYWNlU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlcGxhY2VTdHJpbmcgfHwgJyc7XG5cdH1cblxuXHRzZXQgcHJlc2VydmVDYXNlKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fcHJlc2VydmVDYXNlID0gdmFsdWU7XG5cdH1cblxuXHRnZXQgcHJlc2VydmVDYXNlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9wcmVzZXJ2ZUNhc2U7XG5cdH1cblxuXHRzZXQgcmVwbGFjZVN0cmluZyhyZXBsYWNlU3RyaW5nOiBzdHJpbmcpIHtcblx0XHR0aGlzLl9yZXBsYWNlU3RyaW5nID0gcmVwbGFjZVN0cmluZztcblx0XHRpZiAodGhpcy5fc2VhcmNoUXVlcnkpIHtcblx0XHRcdHRoaXMuX3JlcGxhY2VQYXR0ZXJuID0gbmV3IFJlcGxhY2VQYXR0ZXJuKHJlcGxhY2VTdHJpbmcsIHRoaXMuX3NlYXJjaFF1ZXJ5LmNvbnRlbnRQYXR0ZXJuKTtcblx0XHR9XG5cdFx0dGhpcy5fb25SZXBsYWNlVGVybUNoYW5nZWQuZmlyZSgpO1xuXHR9XG5cblx0Z2V0IHNlYXJjaFJlc3VsdCgpOiBJU2VhcmNoUmVzdWx0IHtcblx0XHRyZXR1cm4gdGhpcy5fc2VhcmNoUmVzdWx0O1xuXHR9XG5cblx0YXN5bmMgYWRkQUlSZXN1bHRzKG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHRpZiAodGhpcy5oYXNBSVJlc3VsdHMpIHtcblx0XHRcdC8vIGFscmVhZHkgaGFzIG1hdGNoZXMgb3IgcGVuZGluZyBtYXRjaGVzXG5cdFx0XHR0aHJvdyBFcnJvcignQUkgcmVzdWx0cyBhbHJlYWR5IGV4aXN0Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLl9zZWFyY2hRdWVyeSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5haVNlYXJjaChcblx0XHRcdFx0XHR7IC4uLnRoaXMuX3NlYXJjaFF1ZXJ5LCBjb250ZW50UGF0dGVybjogdGhpcy5fc2VhcmNoUXVlcnkuY29udGVudFBhdHRlcm4ucGF0dGVybiwgdHlwZTogUXVlcnlUeXBlLmFpVGV4dCB9LFxuXHRcdFx0XHRcdG9uUHJvZ3Jlc3MsXG5cdFx0XHRcdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBFcnJvcignTm8gc2VhcmNoIHF1ZXJ5Jyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YWlTZWFyY2gocXVlcnk6IElBSVRleHRRdWVyeSwgb25Qcm9ncmVzcz86IChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXG5cdFx0Y29uc3Qgc2VhcmNoSW5zdGFuY2VJRCA9IERhdGUubm93KCkudG9TdHJpbmcoKTtcblx0XHRjb25zdCB0b2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHRoaXMuY3VycmVudEFJQ2FuY2VsVG9rZW5Tb3VyY2UgPSB0b2tlblNvdXJjZTtcblx0XHRjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG5cdFx0Y29uc3QgYXN5bmNBSVJlc3VsdHMgPSB0aGlzLnNlYXJjaFNlcnZpY2UuYWlUZXh0U2VhcmNoKFxuXHRcdFx0cXVlcnksXG5cdFx0XHR0b2tlblNvdXJjZS50b2tlbixcblx0XHRcdGFzeW5jIChwOiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB7XG5cdFx0XHRcdHRoaXMub25TZWFyY2hQcm9ncmVzcyhwLCBzZWFyY2hJbnN0YW5jZUlELCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHRcdG9uUHJvZ3Jlc3M/LihwKTtcblx0XHRcdH0pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0XHR0b2tlblNvdXJjZS5kaXNwb3NlKHRydWUpO1xuXHRcdFx0fSkudGhlbihcblx0XHRcdFx0dmFsdWUgPT4ge1xuXHRcdFx0XHRcdHRoaXMub25TZWFyY2hDb21wbGV0ZWQodmFsdWUsIERhdGUubm93KCkgLSBzdGFydCwgc2VhcmNoSW5zdGFuY2VJRCwgdHJ1ZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlID0+IHtcblx0XHRcdFx0XHR0aGlzLm9uU2VhcmNoRXJyb3IoZSwgRGF0ZS5ub3coKSAtIHN0YXJ0LCB0cnVlKTtcblx0XHRcdFx0XHR0aHJvdyBlO1xuXHRcdFx0XHR9KTtcblx0XHRyZXR1cm4gYXN5bmNBSVJlc3VsdHM7XG5cdH1cblxuXHRwcml2YXRlIGRvU2VhcmNoKHF1ZXJ5OiBJVGV4dFF1ZXJ5LCBwcm9ncmVzc0VtaXR0ZXI6IEVtaXR0ZXI8dm9pZD4sIHNlYXJjaFF1ZXJ5OiBJVGV4dFF1ZXJ5LCBzZWFyY2hJbnN0YW5jZUlEOiBzdHJpbmcsIG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkLCBjYWxsZXJUb2tlbj86IENhbmNlbGxhdGlvblRva2VuKToge1xuXHRcdGFzeW5jUmVzdWx0czogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+O1xuXHRcdHN5bmNSZXN1bHRzOiBJRmlsZU1hdGNoPFVSST5bXTtcblx0fSB7XG5cdFx0Y29uc3QgYXN5bmNHZW5lcmF0ZU9uUHJvZ3Jlc3MgPSBhc3luYyAocDogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4ge1xuXHRcdFx0cHJvZ3Jlc3NFbWl0dGVyLmZpcmUoKTtcblx0XHRcdHRoaXMub25TZWFyY2hQcm9ncmVzcyhwLCBzZWFyY2hJbnN0YW5jZUlELCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0b25Qcm9ncmVzcz8uKHApO1xuXHRcdH07XG5cblx0XHRjb25zdCBzeW5jR2VuZXJhdGVPblByb2dyZXNzID0gKHA6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHtcblx0XHRcdHByb2dyZXNzRW1pdHRlci5maXJlKCk7XG5cdFx0XHR0aGlzLm9uU2VhcmNoUHJvZ3Jlc3MocCwgc2VhcmNoSW5zdGFuY2VJRCwgdHJ1ZSk7XG5cdFx0XHRvblByb2dyZXNzPy4ocCk7XG5cdFx0fTtcblx0XHRjb25zdCB0b2tlblNvdXJjZSA9IHRoaXMuY3VycmVudENhbmNlbFRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKGNhbGxlclRva2VuKTtcblxuXHRcdGNvbnN0IG5vdGVib29rUmVzdWx0ID0gdGhpcy5ub3RlYm9va1NlYXJjaFNlcnZpY2Uubm90ZWJvb2tTZWFyY2gocXVlcnksIHRva2VuU291cmNlLnRva2VuLCBzZWFyY2hJbnN0YW5jZUlELCBhc3luY0dlbmVyYXRlT25Qcm9ncmVzcyk7XG5cdFx0Y29uc3QgdGV4dFJlc3VsdCA9IHRoaXMuc2VhcmNoU2VydmljZS50ZXh0U2VhcmNoU3BsaXRTeW5jQXN5bmMoXG5cdFx0XHRzZWFyY2hRdWVyeSxcblx0XHRcdHRva2VuU291cmNlLnRva2VuLCBhc3luY0dlbmVyYXRlT25Qcm9ncmVzcyxcblx0XHRcdG5vdGVib29rUmVzdWx0Lm9wZW5GaWxlc1RvU2Nhbixcblx0XHRcdG5vdGVib29rUmVzdWx0LmFsbFNjYW5uZWRGaWxlcyxcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc3luY1Jlc3VsdHMgPSB0ZXh0UmVzdWx0LnN5bmNSZXN1bHRzLnJlc3VsdHM7XG5cdFx0c3luY1Jlc3VsdHMuZm9yRWFjaChwID0+IHsgaWYgKHApIHsgc3luY0dlbmVyYXRlT25Qcm9ncmVzcyhwKTsgfSB9KTtcblxuXHRcdGNvbnN0IGdldEFzeW5jUmVzdWx0cyA9IGFzeW5jICgpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4gPT4ge1xuXHRcdFx0Y29uc3Qgc2VhcmNoU3RhcnQgPSBEYXRlLm5vdygpO1xuXG5cdFx0XHQvLyByZXNvbHZlIGFzeW5jIHBhcnRzIG9mIHNlYXJjaFxuXHRcdFx0Y29uc3QgYWxsQ2xvc2VkRWRpdG9yUmVzdWx0cyA9IGF3YWl0IHRleHRSZXN1bHQuYXN5bmNSZXN1bHRzO1xuXHRcdFx0Y29uc3QgcmVzb2x2ZWROb3RlYm9va1Jlc3VsdHMgPSBhd2FpdCBub3RlYm9va1Jlc3VsdC5jb21wbGV0ZURhdGE7XG5cdFx0XHRjb25zdCBzZWFyY2hMZW5ndGggPSBEYXRlLm5vdygpIC0gc2VhcmNoU3RhcnQ7XG5cdFx0XHRjb25zdCByZXNvbHZlZFJlc3VsdDogSVNlYXJjaENvbXBsZXRlID0ge1xuXHRcdFx0XHRyZXN1bHRzOiBbLi4uYWxsQ2xvc2VkRWRpdG9yUmVzdWx0cy5yZXN1bHRzLCAuLi5yZXNvbHZlZE5vdGVib29rUmVzdWx0cy5yZXN1bHRzXSxcblx0XHRcdFx0bWVzc2FnZXM6IFsuLi5hbGxDbG9zZWRFZGl0b3JSZXN1bHRzLm1lc3NhZ2VzLCAuLi5yZXNvbHZlZE5vdGVib29rUmVzdWx0cy5tZXNzYWdlc10sXG5cdFx0XHRcdGxpbWl0SGl0OiBhbGxDbG9zZWRFZGl0b3JSZXN1bHRzLmxpbWl0SGl0IHx8IHJlc29sdmVkTm90ZWJvb2tSZXN1bHRzLmxpbWl0SGl0LFxuXHRcdFx0XHRleGl0OiBhbGxDbG9zZWRFZGl0b3JSZXN1bHRzLmV4aXQsXG5cdFx0XHRcdHN0YXRzOiBhbGxDbG9zZWRFZGl0b3JSZXN1bHRzLnN0YXRzLFxuXHRcdFx0fTtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgd2hvbGUgc2VhcmNoIHRpbWUgfCAke3NlYXJjaExlbmd0aH1tc2ApO1xuXHRcdFx0cmV0dXJuIHJlc29sdmVkUmVzdWx0O1xuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGFzeW5jUmVzdWx0czogZ2V0QXN5bmNSZXN1bHRzKClcblx0XHRcdFx0LmZpbmFsbHkoKCkgPT4gdG9rZW5Tb3VyY2UuZGlzcG9zZSh0cnVlKSksXG5cdFx0XHRzeW5jUmVzdWx0c1xuXHRcdH07XG5cdH1cblxuXHRnZXQgaGFzQUlSZXN1bHRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhISh0aGlzLnNlYXJjaFJlc3VsdC5nZXRDYWNoZWRTZWFyY2hDb21wbGV0ZSh0cnVlKSkgfHwgKCEhdGhpcy5jdXJyZW50QUlDYW5jZWxUb2tlblNvdXJjZSAmJiAhdGhpcy5jdXJyZW50QUlDYW5jZWxUb2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCk7XG5cdH1cblxuXHRnZXQgaGFzUGxhaW5SZXN1bHRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhISh0aGlzLnNlYXJjaFJlc3VsdC5nZXRDYWNoZWRTZWFyY2hDb21wbGV0ZShmYWxzZSkpIHx8ICghIXRoaXMuY3VycmVudENhbmNlbFRva2VuU291cmNlICYmICF0aGlzLmN1cnJlbnRDYW5jZWxUb2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCk7XG5cdH1cblxuXHRzZWFyY2gocXVlcnk6IElUZXh0UXVlcnksIG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkLCBjYWxsZXJUb2tlbj86IENhbmNlbGxhdGlvblRva2VuKToge1xuXHRcdGFzeW5jUmVzdWx0czogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+O1xuXHRcdHN5bmNSZXN1bHRzOiBJRmlsZU1hdGNoPFVSST5bXTtcblx0fSB7XG5cdFx0dGhpcy5jYW5jZWxTZWFyY2godHJ1ZSk7XG5cblx0XHR0aGlzLl9zZWFyY2hRdWVyeSA9IHF1ZXJ5O1xuXHRcdGlmICghdGhpcy5zZWFyY2hDb25maWcuc2VhcmNoT25UeXBlKSB7XG5cdFx0XHR0aGlzLnNlYXJjaFJlc3VsdC5jbGVhcigpO1xuXHRcdH1cblx0XHRjb25zdCBzZWFyY2hJbnN0YW5jZUlEID0gRGF0ZS5ub3coKS50b1N0cmluZygpO1xuXG5cdFx0dGhpcy5fc2VhcmNoUmVzdWx0LnF1ZXJ5ID0gdGhpcy5fc2VhcmNoUXVlcnk7XG5cblx0XHRjb25zdCBwcm9ncmVzc0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0XHR0aGlzLl9yZXBsYWNlUGF0dGVybiA9IG5ldyBSZXBsYWNlUGF0dGVybih0aGlzLnJlcGxhY2VTdHJpbmcsIHRoaXMuX3NlYXJjaFF1ZXJ5LmNvbnRlbnRQYXR0ZXJuKTtcblxuXHRcdC8vIEluIHNlYXJjaCBvbiB0eXBlIGNhc2UsIGRlbGF5IHRoZSBzdHJlYW1pbmcgb2YgcmVzdWx0cyBqdXN0IGEgYml0LCBzbyB0aGF0IHdlIGRvbid0IGZsYXNoIHRoZSBvbmx5IFwibG9jYWwgcmVzdWx0c1wiIGZhc3QgcGF0aFxuXHRcdHRoaXMuX3N0YXJ0U3RyZWFtRGVsYXkgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgdGhpcy5zZWFyY2hDb25maWcuc2VhcmNoT25UeXBlID8gMTUwIDogMCkpO1xuXG5cdFx0Y29uc3QgcmVxID0gdGhpcy5kb1NlYXJjaChxdWVyeSwgcHJvZ3Jlc3NFbWl0dGVyLCB0aGlzLl9zZWFyY2hRdWVyeSwgc2VhcmNoSW5zdGFuY2VJRCwgb25Qcm9ncmVzcywgY2FsbGVyVG9rZW4pO1xuXHRcdGNvbnN0IGFzeW5jUmVzdWx0cyA9IHJlcS5hc3luY1Jlc3VsdHM7XG5cdFx0Y29uc3Qgc3luY1Jlc3VsdHMgPSByZXEuc3luY1Jlc3VsdHM7XG5cblx0XHRpZiAob25Qcm9ncmVzcykge1xuXHRcdFx0c3luY1Jlc3VsdHMuZm9yRWFjaChwID0+IHtcblx0XHRcdFx0aWYgKHApIHtcblx0XHRcdFx0XHRvblByb2dyZXNzKHApO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRjb25zdCBzdGFydCA9IERhdGUubm93KCk7XG5cdFx0bGV0IGV2ZW50OiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHByb2dyZXNzRW1pdHRlclByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdGV2ZW50ID0gRXZlbnQub25jZShwcm9ncmVzc0VtaXR0ZXIuZXZlbnQpKHJlc29sdmUpO1xuXHRcdFx0cmV0dXJuIGV2ZW50O1xuXHRcdH0pO1xuXG5cdFx0UHJvbWlzZS5yYWNlKFthc3luY1Jlc3VsdHMsIHByb2dyZXNzRW1pdHRlclByb21pc2VdKS5maW5hbGx5KCgpID0+IHtcblx0XHRcdC8qIF9fR0RQUl9fXG5cdFx0XHRcdFwic2VhcmNoUmVzdWx0c0ZpcnN0UmVuZGVyXCIgOiB7XG5cdFx0XHRcdFx0XCJvd25lclwiOiBcInJvYmxvdXJlbnNcIixcblx0XHRcdFx0XHRcImR1cmF0aW9uXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9XG5cdFx0XHRcdH1cblx0XHRcdCovXG5cdFx0XHRldmVudD8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnc2VhcmNoUmVzdWx0c0ZpcnN0UmVuZGVyJywgeyBkdXJhdGlvbjogRGF0ZS5ub3coKSAtIHN0YXJ0IH0pO1xuXHRcdH0pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGFzeW5jUmVzdWx0czogYXN5bmNSZXN1bHRzLnRoZW4oXG5cdFx0XHRcdFx0dmFsdWUgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5vblNlYXJjaENvbXBsZXRlZCh2YWx1ZSwgRGF0ZS5ub3coKSAtIHN0YXJ0LCBzZWFyY2hJbnN0YW5jZUlELCBmYWxzZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRlID0+IHtcblx0XHRcdFx0XHRcdHRoaXMub25TZWFyY2hFcnJvcihlLCBEYXRlLm5vdygpIC0gc3RhcnQsIGZhbHNlKTtcblx0XHRcdFx0XHRcdHRocm93IGU7XG5cdFx0XHRcdFx0fSksXG5cdFx0XHRcdHN5bmNSZXN1bHRzXG5cdFx0XHR9O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHQvKiBfX0dEUFJfX1xuXHRcdFx0XHRcInNlYXJjaFJlc3VsdHNGaW5pc2hlZFwiIDoge1xuXHRcdFx0XHRcdFwib3duZXJcIjogXCJyb2Jsb3VyZW5zXCIsXG5cdFx0XHRcdFx0XCJkdXJhdGlvblwiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiUGVyZm9ybWFuY2VBbmRIZWFsdGhcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHQqL1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZygnc2VhcmNoUmVzdWx0c0ZpbmlzaGVkJywgeyBkdXJhdGlvbjogRGF0ZS5ub3coKSAtIHN0YXJ0IH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25TZWFyY2hDb21wbGV0ZWQoY29tcGxldGVkOiBJU2VhcmNoQ29tcGxldGUgfCB1bmRlZmluZWQsIGR1cmF0aW9uOiBudW1iZXIsIHNlYXJjaEluc3RhbmNlSUQ6IHN0cmluZywgYWk6IGJvb2xlYW4pOiBJU2VhcmNoQ29tcGxldGUgfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fc2VhcmNoUXVlcnkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignb25TZWFyY2hDb21wbGV0ZWQgbXVzdCBiZSBjYWxsZWQgYWZ0ZXIgYSBzZWFyY2ggaXMgc3RhcnRlZCcpO1xuXHRcdH1cblxuXHRcdGlmIChhaSkge1xuXHRcdFx0dGhpcy5fc2VhcmNoUmVzdWx0LmFkZCh0aGlzLl9haVJlc3VsdFF1ZXVlLCBzZWFyY2hJbnN0YW5jZUlELCB0cnVlKTtcblx0XHRcdHRoaXMuX2FpUmVzdWx0UXVldWUubGVuZ3RoID0gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2VhcmNoUmVzdWx0LmFkZCh0aGlzLl9yZXN1bHRRdWV1ZSwgc2VhcmNoSW5zdGFuY2VJRCwgZmFsc2UpO1xuXHRcdFx0dGhpcy5fcmVzdWx0UXVldWUubGVuZ3RoID0gMDtcblx0XHR9XG5cblx0XHR0aGlzLnNlYXJjaFJlc3VsdC5zZXRDYWNoZWRTZWFyY2hDb21wbGV0ZShjb21wbGV0ZWQsIGFpKTtcblxuXHRcdGNvbnN0IG9wdGlvbnM6IElQYXR0ZXJuSW5mbyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuX3NlYXJjaFF1ZXJ5LmNvbnRlbnRQYXR0ZXJuKTtcblx0XHRkZWxldGUgKG9wdGlvbnMgYXMgYW55KS5wYXR0ZXJuO1xuXG5cdFx0Y29uc3Qgc3RhdHMgPSBjb21wbGV0ZWQgJiYgY29tcGxldGVkLnN0YXRzIGFzIElUZXh0U2VhcmNoU3RhdHM7XG5cblx0XHRjb25zdCBmaWxlU2NoZW1lT25seSA9IHRoaXMuX3NlYXJjaFF1ZXJ5LmZvbGRlclF1ZXJpZXMuZXZlcnkoZnEgPT4gZnEuZm9sZGVyLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKTtcblx0XHRjb25zdCBvdGhlclNjaGVtZU9ubHkgPSB0aGlzLl9zZWFyY2hRdWVyeS5mb2xkZXJRdWVyaWVzLmV2ZXJ5KGZxID0+IGZxLmZvbGRlci5zY2hlbWUgIT09IFNjaGVtYXMuZmlsZSk7XG5cdFx0Y29uc3Qgc2NoZW1lID0gZmlsZVNjaGVtZU9ubHkgPyBTY2hlbWFzLmZpbGUgOlxuXHRcdFx0b3RoZXJTY2hlbWVPbmx5ID8gJ290aGVyJyA6XG5cdFx0XHRcdCdtaXhlZCc7XG5cblx0XHQvKiBfX0dEUFJfX1xuXHRcdFx0XCJzZWFyY2hSZXN1bHRzU2hvd25cIiA6IHtcblx0XHRcdFx0XCJvd25lclwiOiBcInJvYmxvdXJlbnNcIixcblx0XHRcdFx0XCJjb3VudFwiIDogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFx0XCJmaWxlQ291bnRcIjogeyBcImNsYXNzaWZpY2F0aW9uXCI6IFwiU3lzdGVtTWV0YURhdGFcIiwgXCJwdXJwb3NlXCI6IFwiRmVhdHVyZUluc2lnaHRcIiwgXCJpc01lYXN1cmVtZW50XCI6IHRydWUgfSxcblx0XHRcdFx0XCJvcHRpb25zXCI6IHsgXCIke2lubGluZX1cIjogWyBcIiR7SVBhdHRlcm5JbmZvfVwiIF0gfSxcblx0XHRcdFx0XCJkdXJhdGlvblwiOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJQZXJmb3JtYW5jZUFuZEhlYWx0aFwiLCBcImlzTWVhc3VyZW1lbnRcIjogdHJ1ZSB9LFxuXHRcdFx0XHRcInR5cGVcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIgfSxcblx0XHRcdFx0XCJzY2hlbWVcIiA6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIlBlcmZvcm1hbmNlQW5kSGVhbHRoXCIgfSxcblx0XHRcdFx0XCJzZWFyY2hPblR5cGVFbmFibGVkXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiIH1cblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2coJ3NlYXJjaFJlc3VsdHNTaG93bicsIHtcblx0XHRcdGNvdW50OiB0aGlzLl9zZWFyY2hSZXN1bHQuY291bnQoKSxcblx0XHRcdGZpbGVDb3VudDogdGhpcy5fc2VhcmNoUmVzdWx0LmZpbGVDb3VudCgpLFxuXHRcdFx0b3B0aW9ucyxcblx0XHRcdGR1cmF0aW9uLFxuXHRcdFx0dHlwZTogc3RhdHMgJiYgc3RhdHMudHlwZSxcblx0XHRcdHNjaGVtZSxcblx0XHRcdHNlYXJjaE9uVHlwZUVuYWJsZWQ6IHRoaXMuc2VhcmNoQ29uZmlnLnNlYXJjaE9uVHlwZVxuXHRcdH0pO1xuXHRcdHJldHVybiBjb21wbGV0ZWQ7XG5cdH1cblxuXHRwcml2YXRlIG9uU2VhcmNoRXJyb3IoZTogYW55LCBkdXJhdGlvbjogbnVtYmVyLCBhaTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChlcnJvcnMuaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0dGhpcy5vblNlYXJjaENvbXBsZXRlZChcblx0XHRcdFx0KGFpID8gdGhpcy5haVNlYXJjaENhbmNlbGxlZEZvck5ld1NlYXJjaCA6IHRoaXMuc2VhcmNoQ2FuY2VsbGVkRm9yTmV3U2VhcmNoKVxuXHRcdFx0XHRcdD8geyBleGl0OiBTZWFyY2hDb21wbGV0aW9uRXhpdENvZGUuTmV3U2VhcmNoU3RhcnRlZCwgcmVzdWx0czogW10sIG1lc3NhZ2VzOiBbXSB9XG5cdFx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHRcdGR1cmF0aW9uLCAnJywgYWkpO1xuXHRcdFx0aWYgKGFpKSB7XG5cdFx0XHRcdHRoaXMuYWlTZWFyY2hDYW5jZWxsZWRGb3JOZXdTZWFyY2ggPSBmYWxzZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuc2VhcmNoQ2FuY2VsbGVkRm9yTmV3U2VhcmNoID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblNlYXJjaFByb2dyZXNzKHA6IElTZWFyY2hQcm9ncmVzc0l0ZW0sIHNlYXJjaEluc3RhbmNlSUQ6IHN0cmluZywgc3luYyA9IHRydWUsIGFpOiBib29sZWFuID0gZmFsc2UpIHtcblx0XHRjb25zdCB0YXJnZXRRdWV1ZSA9IGFpID8gdGhpcy5fYWlSZXN1bHRRdWV1ZSA6IHRoaXMuX3Jlc3VsdFF1ZXVlO1xuXHRcdGlmICgoPElGaWxlTWF0Y2g+cCkucmVzb3VyY2UpIHtcblx0XHRcdHRhcmdldFF1ZXVlLnB1c2goPElGaWxlTWF0Y2g+cCk7XG5cdFx0XHRpZiAoc3luYykge1xuXHRcdFx0XHRpZiAodGFyZ2V0UXVldWUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2VhcmNoUmVzdWx0LmFkZCh0YXJnZXRRdWV1ZSwgc2VhcmNoSW5zdGFuY2VJRCwgZmFsc2UsIHRydWUpO1xuXHRcdFx0XHRcdHRhcmdldFF1ZXVlLmxlbmd0aCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3N0YXJ0U3RyZWFtRGVsYXkudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRhcmdldFF1ZXVlLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2VhcmNoUmVzdWx0LmFkZCh0YXJnZXRRdWV1ZSwgc2VhcmNoSW5zdGFuY2VJRCwgYWksIHRydWUpO1xuXHRcdFx0XHRcdFx0dGFyZ2V0UXVldWUubGVuZ3RoID0gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgc2VhcmNoQ29uZmlnKCkge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcz4oJ3NlYXJjaCcpO1xuXHR9XG5cblx0Y2FuY2VsU2VhcmNoKGNhbmNlbGxlZEZvck5ld1NlYXJjaCA9IGZhbHNlKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuY3VycmVudENhbmNlbFRva2VuU291cmNlKSB7XG5cdFx0XHR0aGlzLnNlYXJjaENhbmNlbGxlZEZvck5ld1NlYXJjaCA9IGNhbmNlbGxlZEZvck5ld1NlYXJjaDtcblx0XHRcdHRoaXMuY3VycmVudENhbmNlbFRva2VuU291cmNlLmNhbmNlbCgpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRjYW5jZWxBSVNlYXJjaChjYW5jZWxsZWRGb3JOZXdTZWFyY2ggPSBmYWxzZSk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmN1cnJlbnRBSUNhbmNlbFRva2VuU291cmNlKSB7XG5cdFx0XHR0aGlzLmFpU2VhcmNoQ2FuY2VsbGVkRm9yTmV3U2VhcmNoID0gY2FuY2VsbGVkRm9yTmV3U2VhcmNoO1xuXHRcdFx0dGhpcy5jdXJyZW50QUlDYW5jZWxUb2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y2xlYXJBaVNlYXJjaFJlc3VsdHMoKTogdm9pZCB7XG5cdFx0dGhpcy5fYWlSZXN1bHRRdWV1ZS5sZW5ndGggPSAwO1xuXHRcdC8vIGl0J3Mgbm90IGNsZWFyIGFsbCBhcyB3ZSBhcmUgb25seSBjbGVhcmluZyB0aGUgQUkgcmVzdWx0c1xuXHRcdHRoaXMuX3NlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQuY2xlYXIoZmFsc2UpO1xuXHR9XG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5jYW5jZWxTZWFyY2goKTtcblx0XHR0aGlzLmNhbmNlbEFJU2VhcmNoKCk7XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHQuZGlzcG9zZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cblxuZXhwb3J0IGNsYXNzIFNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UgaW1wbGVtZW50cyBJU2VhcmNoVmlld01vZGVsV29ya2JlbmNoU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3NlYXJjaE1vZGVsOiBTZWFyY2hNb2RlbEltcGwgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSkge1xuXHR9XG5cblx0Z2V0IHNlYXJjaE1vZGVsKCk6IFNlYXJjaE1vZGVsSW1wbCB7XG5cdFx0aWYgKCF0aGlzLl9zZWFyY2hNb2RlbCkge1xuXHRcdFx0dGhpcy5fc2VhcmNoTW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9zZWFyY2hNb2RlbDtcblx0fVxuXG5cdHNldCBzZWFyY2hNb2RlbChzZWFyY2hNb2RlbDogU2VhcmNoTW9kZWxJbXBsKSB7XG5cdFx0dGhpcy5fc2VhcmNoTW9kZWw/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zZWFyY2hNb2RlbCA9IHNlYXJjaE1vZGVsO1xuXHR9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBNEIsK0JBQStCO0FBQzNELFlBQVksWUFBWTtBQUN4QixTQUFTLFNBQVMsT0FBTyx3QkFBd0I7QUFDakQsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUV4QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHNCQUFzQjtBQUMvQixTQUF1SCxnQkFBOEMsV0FBVyxnQ0FBZ0M7QUFDaE4sU0FBdUIseUJBQXlCLHFCQUFrRCwyQkFBMkI7QUFDN0gsU0FBUyx3QkFBd0I7QUFHMUIsSUFBTSxrQkFBTixjQUE4QixXQUFtQztBQUFBLEVBNkJ2RSxZQUNrQyxlQUNHLGtCQUNJ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
