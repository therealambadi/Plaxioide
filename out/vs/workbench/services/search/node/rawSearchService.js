import * as arrays from "../../../../base/common/arrays.js";
import { createCancelablePromise } from "../../../../base/common/async.js";
import { canceled } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { compareItemsByFuzzyScore, prepareQuery } from "../../../../base/common/fuzzyScorer.js";
import { revive } from "../../../../base/common/marshalling.js";
import { basename, dirname, join, sep } from "../../../../base/common/path.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { URI } from "../../../../base/common/uri.js";
import { ByteSize } from "../../../../platform/files/common/files.js";
import { DEFAULT_MAX_SEARCH_RESULTS, isFilePatternMatch } from "../common/search.js";
import { Engine as FileSearchEngine } from "./fileSearch.js";
import { TextSearchEngineAdapter } from "./textSearchAdapter.js";
const _SearchService = class _SearchService {
  constructor(processType = "searchProcess", getNumThreads) {
    this.processType = processType;
    this.getNumThreads = getNumThreads;
    this.caches = /* @__PURE__ */ Object.create(null);
  }
  fileSearch(config) {
    let promise;
    const query = reviveQuery(config);
    const emitter = new Emitter({
      onDidAddFirstListener: () => {
        promise = createCancelablePromise(async (token) => {
          const numThreads = await this.getNumThreads?.();
          return this.doFileSearchWithEngine(FileSearchEngine, query, (p) => emitter.fire(p), token, _SearchService.BATCH_SIZE, numThreads);
        });
        promise.then(
          (c) => emitter.fire(c),
          (err) => emitter.fire({ type: "error", error: { message: err.message, stack: err.stack } })
        );
      },
      onDidRemoveLastListener: () => {
        promise.cancel();
      }
    });
    return emitter.event;
  }
  textSearch(rawQuery) {
    let promise;
    const query = reviveQuery(rawQuery);
    const emitter = new Emitter({
      onDidAddFirstListener: () => {
        promise = createCancelablePromise((token) => {
          return this.ripgrepTextSearch(query, (p) => emitter.fire(p), token);
        });
        promise.then(
          (c) => emitter.fire(c),
          (err) => emitter.fire({ type: "error", error: { message: err.message, stack: err.stack } })
        );
      },
      onDidRemoveLastListener: () => {
        promise.cancel();
      }
    });
    return emitter.event;
  }
  async ripgrepTextSearch(config, progressCallback, token) {
    config.maxFileSize = this.getPlatformFileLimits().maxFileSize;
    const numThreads = await this.getNumThreads?.();
    const engine = new TextSearchEngineAdapter(config, numThreads);
    return engine.search(token, progressCallback, progressCallback);
  }
  getPlatformFileLimits() {
    return {
      maxFileSize: 16 * ByteSize.GB
    };
  }
  doFileSearch(config, numThreads, progressCallback, token) {
    return this.doFileSearchWithEngine(FileSearchEngine, config, progressCallback, token, _SearchService.BATCH_SIZE, numThreads);
  }
  doFileSearchWithEngine(EngineClass, config, progressCallback, token, batchSize = _SearchService.BATCH_SIZE, threads) {
    let resultCount = 0;
    const fileProgressCallback = (progress) => {
      if (Array.isArray(progress)) {
        resultCount += progress.length;
        progressCallback(progress.map((m) => this.rawMatchToSearchItem(m)));
      } else if (progress.relativePath) {
        resultCount++;
        progressCallback(this.rawMatchToSearchItem(progress));
      } else {
        progressCallback(progress);
      }
    };
    if (config.sortByScore) {
      let sortedSearch = this.trySortedSearchFromCache(config, fileProgressCallback, token);
      if (!sortedSearch) {
        const walkerConfig = config.maxResults ? Object.assign({}, config, { maxResults: null }) : config;
        const engine2 = new EngineClass(walkerConfig, threads);
        sortedSearch = this.doSortedSearch(engine2, config, progressCallback, fileProgressCallback, token);
      }
      return new Promise((c, e) => {
        sortedSearch.then(([result, rawMatches]) => {
          const serializedMatches = rawMatches.map((rawMatch) => this.rawMatchToSearchItem(rawMatch));
          this.sendProgress(serializedMatches, progressCallback, batchSize);
          c(result);
        }, e);
      });
    }
    const engine = new EngineClass(config, threads);
    return this.doSearch(engine, fileProgressCallback, batchSize, token).then((complete) => {
      return {
        limitHit: complete.limitHit,
        type: "success",
        stats: {
          detailStats: complete.stats,
          type: this.processType,
          fromCache: false,
          resultCount,
          sortingTime: void 0
        },
        messages: []
      };
    });
  }
  rawMatchToSearchItem(match) {
    return { path: match.base ? join(match.base, match.relativePath) : match.relativePath };
  }
  doSortedSearch(engine, config, progressCallback, fileProgressCallback, token) {
    const emitter = new Emitter();
    let allResultsPromise = createCancelablePromise((token2) => {
      let results = [];
      const innerProgressCallback = (progress) => {
        if (Array.isArray(progress)) {
          results = progress;
        } else {
          fileProgressCallback(progress);
          emitter.fire(progress);
        }
      };
      return this.doSearch(engine, innerProgressCallback, -1, token2).then((result) => {
        return [result, results];
      });
    });
    let cache;
    if (config.cacheKey) {
      cache = this.getOrCreateCache(config.cacheKey);
      const cacheRow = {
        promise: allResultsPromise,
        event: emitter.event,
        resolved: false
      };
      cache.resultsToSearchCache[config.filePattern || ""] = cacheRow;
      allResultsPromise.then(() => {
        cacheRow.resolved = true;
      }, (err) => {
        delete cache.resultsToSearchCache[config.filePattern || ""];
      });
      allResultsPromise = this.preventCancellation(allResultsPromise);
    }
    return allResultsPromise.then(([result, results]) => {
      const scorerCache = cache ? cache.scorerCache : /* @__PURE__ */ Object.create(null);
      const sortSW = (typeof config.maxResults !== "number" || config.maxResults > 0) && StopWatch.create(false);
      return this.sortResults(config, results, scorerCache, token).then((sortedResults) => {
        const sortingTime = sortSW ? sortSW.elapsed() : -1;
        return [{
          type: "success",
          stats: {
            detailStats: result.stats,
            sortingTime,
            fromCache: false,
            type: this.processType,
            resultCount: sortedResults.length
          },
          messages: result.messages,
          limitHit: result.limitHit || typeof config.maxResults === "number" && results.length > config.maxResults
        }, sortedResults];
      });
    });
  }
  getOrCreateCache(cacheKey) {
    const existing = this.caches[cacheKey];
    if (existing) {
      return existing;
    }
    return this.caches[cacheKey] = new Cache();
  }
  trySortedSearchFromCache(config, progressCallback, token) {
    const cache = config.cacheKey && this.caches[config.cacheKey];
    if (!cache) {
      return void 0;
    }
    const cached = this.getResultsFromCache(cache, config.filePattern || "", progressCallback, token);
    if (cached) {
      return cached.then(([result, results, cacheStats]) => {
        const sortSW = StopWatch.create(false);
        return this.sortResults(config, results, cache.scorerCache, token).then((sortedResults) => {
          const sortingTime = sortSW.elapsed();
          const stats = {
            fromCache: true,
            detailStats: cacheStats,
            type: this.processType,
            resultCount: results.length,
            sortingTime
          };
          return [
            {
              type: "success",
              limitHit: result.limitHit || typeof config.maxResults === "number" && results.length > config.maxResults,
              stats,
              messages: []
            },
            sortedResults
          ];
        });
      });
    }
    return void 0;
  }
  sortResults(config, results, scorerCache, token) {
    const query = prepareQuery(config.filePattern || "");
    const compare = (matchA, matchB) => compareItemsByFuzzyScore(matchA, matchB, query, true, FileMatchItemAccessor, scorerCache);
    const maxResults = typeof config.maxResults === "number" ? config.maxResults : DEFAULT_MAX_SEARCH_RESULTS;
    return arrays.topAsync(results, compare, maxResults, 1e4, token);
  }
  sendProgress(results, progressCb, batchSize) {
    if (batchSize && batchSize > 0) {
      for (let i = 0; i < results.length; i += batchSize) {
        progressCb(results.slice(i, i + batchSize));
      }
    } else {
      progressCb(results);
    }
  }
  getResultsFromCache(cache, searchValue, progressCallback, token) {
    const cacheLookupSW = StopWatch.create(false);
    const hasPathSep = searchValue.indexOf(sep) >= 0;
    let cachedRow;
    for (const previousSearch in cache.resultsToSearchCache) {
      if (searchValue.startsWith(previousSearch)) {
        if (hasPathSep && previousSearch.indexOf(sep) < 0 && previousSearch !== "") {
          continue;
        }
        const row = cache.resultsToSearchCache[previousSearch];
        cachedRow = {
          promise: this.preventCancellation(row.promise),
          event: row.event,
          resolved: row.resolved
        };
        break;
      }
    }
    if (!cachedRow) {
      return null;
    }
    const cacheLookupTime = cacheLookupSW.elapsed();
    const cacheFilterSW = StopWatch.create(false);
    const listener = cachedRow.event(progressCallback);
    if (token) {
      token.onCancellationRequested(() => {
        listener.dispose();
      });
    }
    return cachedRow.promise.then(([complete, cachedEntries]) => {
      if (token && token.isCancellationRequested) {
        throw canceled();
      }
      const results = [];
      const normalizedSearchValueLowercase = prepareQuery(searchValue).normalizedLowercase;
      for (const entry of cachedEntries) {
        if (!isFilePatternMatch(entry, normalizedSearchValueLowercase)) {
          continue;
        }
        results.push(entry);
      }
      return [complete, results, {
        cacheWasResolved: cachedRow.resolved,
        cacheLookupTime,
        cacheFilterTime: cacheFilterSW.elapsed(),
        cacheEntryCount: cachedEntries.length
      }];
    });
  }
  doSearch(engine, progressCallback, batchSize, token) {
    return new Promise((c, e) => {
      let batch = [];
      token?.onCancellationRequested(() => engine.cancel());
      engine.search((match) => {
        if (match) {
          if (batchSize) {
            batch.push(match);
            if (batchSize > 0 && batch.length >= batchSize) {
              progressCallback(batch);
              batch = [];
            }
          } else {
            progressCallback(match);
          }
        }
      }, (progress) => {
        progressCallback(progress);
      }, (error, complete) => {
        if (batch.length) {
          progressCallback(batch);
        }
        if (error) {
          progressCallback({ message: "Search finished. Error: " + error.message });
          e(error);
        } else {
          progressCallback({ message: "Search finished. Stats: " + JSON.stringify(complete.stats) });
          c(complete);
        }
      });
    });
  }
  clearCache(cacheKey) {
    delete this.caches[cacheKey];
    return Promise.resolve(void 0);
  }
  /**
   * Return a CancelablePromise which is not actually cancelable
   * TODO@rob - Is this really needed?
   */
  preventCancellation(promise) {
    return new class {
      get [Symbol.toStringTag]() {
        return this.toString();
      }
      cancel() {
      }
      then(resolve, reject) {
        return promise.then(resolve, reject);
      }
      catch(reject) {
        return this.then(void 0, reject);
      }
      finally(onFinally) {
        return promise.finally(onFinally);
      }
    }();
  }
};
_SearchService.BATCH_SIZE = 512;
let SearchService = _SearchService;
class Cache {
  constructor() {
    this.resultsToSearchCache = /* @__PURE__ */ Object.create(null);
    this.scorerCache = /* @__PURE__ */ Object.create(null);
  }
}
const FileMatchItemAccessor = new class {
  getItemLabel(match) {
    return basename(match.relativePath);
  }
  getItemDescription(match) {
    return dirname(match.relativePath);
  }
  getItemPath(match) {
    return match.relativePath;
  }
}();
function reviveQuery(rawQuery) {
  return {
    ...rawQuery,
    // TODO
    ...{
      folderQueries: rawQuery.folderQueries && rawQuery.folderQueries.map(reviveFolderQuery),
      extraFileResources: rawQuery.extraFileResources && rawQuery.extraFileResources.map((components) => URI.revive(components))
    }
  };
}
function reviveFolderQuery(rawFolderQuery) {
  return revive(rawFolderQuery);
}
export {
  SearchService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL25vZGUvcmF3U2VhcmNoU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFycmF5cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgY2FuY2VsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlSXRlbXNCeUZ1enp5U2NvcmUsIEZ1enp5U2NvcmVyQ2FjaGUsIElJdGVtQWNjZXNzb3IsIHByZXBhcmVRdWVyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Z1enp5U2NvcmVyLmpzJztcbmltcG9ydCB7IHJldml2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBqb2luLCBzZXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQnl0ZVNpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9NQVhfU0VBUkNIX1JFU1VMVFMsIElDYWNoZWRTZWFyY2hTdGF0cywgSUZpbGVRdWVyeSwgSUZpbGVTZWFyY2hQcm9ncmVzc0l0ZW0sIElGaWxlU2VhcmNoU3RhdHMsIElGb2xkZXJRdWVyeSwgSVByb2dyZXNzTWVzc2FnZSwgSVJhd0ZpbGVNYXRjaCwgSVJhd0ZpbGVRdWVyeSwgSVJhd1F1ZXJ5LCBJUmF3U2VhcmNoU2VydmljZSwgSVJhd1RleHRRdWVyeSwgSVNlYXJjaEVuZ2luZSwgSVNlYXJjaEVuZ2luZVN1Y2Nlc3MsIElTZXJpYWxpemVkRmlsZU1hdGNoLCBJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlLCBJU2VyaWFsaXplZFNlYXJjaFByb2dyZXNzSXRlbSwgSVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzLCBpc0ZpbGVQYXR0ZXJuTWF0Y2gsIElUZXh0UXVlcnkgfSBmcm9tICcuLi9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IEVuZ2luZSBhcyBGaWxlU2VhcmNoRW5naW5lIH0gZnJvbSAnLi9maWxlU2VhcmNoLmpzJztcbmltcG9ydCB7IFRleHRTZWFyY2hFbmdpbmVBZGFwdGVyIH0gZnJvbSAnLi90ZXh0U2VhcmNoQWRhcHRlci5qcyc7XG5cbmV4cG9ydCB0eXBlIElQcm9ncmVzc0NhbGxiYWNrID0gKHA6IElTZXJpYWxpemVkU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkO1xudHlwZSBJRmlsZVByb2dyZXNzQ2FsbGJhY2sgPSAocDogSUZpbGVTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBTZWFyY2hTZXJ2aWNlIGltcGxlbWVudHMgSVJhd1NlYXJjaFNlcnZpY2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEJBVENIX1NJWkUgPSA1MTI7XG5cblx0cHJpdmF0ZSBjYWNoZXM6IHsgW2NhY2hlS2V5OiBzdHJpbmddOiBDYWNoZSB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHByb2Nlc3NUeXBlOiBJRmlsZVNlYXJjaFN0YXRzWyd0eXBlJ10gPSAnc2VhcmNoUHJvY2VzcycsIHByaXZhdGUgcmVhZG9ubHkgZ2V0TnVtVGhyZWFkcz86ICgpID0+IFByb21pc2U8bnVtYmVyIHwgdW5kZWZpbmVkPikgeyB9XG5cblx0ZmlsZVNlYXJjaChjb25maWc6IElSYXdGaWxlUXVlcnkpOiBFdmVudDxJU2VyaWFsaXplZFNlYXJjaFByb2dyZXNzSXRlbSB8IElTZXJpYWxpemVkU2VhcmNoQ29tcGxldGU+IHtcblx0XHRsZXQgcHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8SVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzPjtcblxuXHRcdGNvbnN0IHF1ZXJ5ID0gcmV2aXZlUXVlcnkoY29uZmlnKTtcblx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEVtaXR0ZXI8SVNlcmlhbGl6ZWRTZWFyY2hQcm9ncmVzc0l0ZW0gfCBJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlPih7XG5cdFx0XHRvbkRpZEFkZEZpcnN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0cHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIHRva2VuID0+IHtcblx0XHRcdFx0XHRjb25zdCBudW1UaHJlYWRzID0gYXdhaXQgdGhpcy5nZXROdW1UaHJlYWRzPy4oKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb0ZpbGVTZWFyY2hXaXRoRW5naW5lKEZpbGVTZWFyY2hFbmdpbmUsIHF1ZXJ5LCBwID0+IGVtaXR0ZXIuZmlyZShwKSwgdG9rZW4sIFNlYXJjaFNlcnZpY2UuQkFUQ0hfU0laRSwgbnVtVGhyZWFkcyk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHByb21pc2UudGhlbihcblx0XHRcdFx0XHRjID0+IGVtaXR0ZXIuZmlyZShjKSxcblx0XHRcdFx0XHRlcnIgPT4gZW1pdHRlci5maXJlKHsgdHlwZTogJ2Vycm9yJywgZXJyb3I6IHsgbWVzc2FnZTogZXJyLm1lc3NhZ2UsIHN0YWNrOiBlcnIuc3RhY2sgfSB9KSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRSZW1vdmVMYXN0TGlzdGVuZXI6ICgpID0+IHtcblx0XHRcdFx0cHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiBlbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0dGV4dFNlYXJjaChyYXdRdWVyeTogSVJhd1RleHRRdWVyeSk6IEV2ZW50PElTZXJpYWxpemVkU2VhcmNoUHJvZ3Jlc3NJdGVtIHwgSVNlcmlhbGl6ZWRTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdGxldCBwcm9taXNlOiBDYW5jZWxhYmxlUHJvbWlzZTxJU2VyaWFsaXplZFNlYXJjaENvbXBsZXRlPjtcblxuXHRcdGNvbnN0IHF1ZXJ5ID0gcmV2aXZlUXVlcnkocmF3UXVlcnkpO1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxJU2VyaWFsaXplZFNlYXJjaFByb2dyZXNzSXRlbSB8IElTZXJpYWxpemVkU2VhcmNoQ29tcGxldGU+KHtcblx0XHRcdG9uRGlkQWRkRmlyc3RMaXN0ZW5lcjogKCkgPT4ge1xuXHRcdFx0XHRwcm9taXNlID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UodG9rZW4gPT4ge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnJpcGdyZXBUZXh0U2VhcmNoKHF1ZXJ5LCBwID0+IGVtaXR0ZXIuZmlyZShwKSwgdG9rZW4pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRwcm9taXNlLnRoZW4oXG5cdFx0XHRcdFx0YyA9PiBlbWl0dGVyLmZpcmUoYyksXG5cdFx0XHRcdFx0ZXJyID0+IGVtaXR0ZXIuZmlyZSh7IHR5cGU6ICdlcnJvcicsIGVycm9yOiB7IG1lc3NhZ2U6IGVyci5tZXNzYWdlLCBzdGFjazogZXJyLnN0YWNrIH0gfSkpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkUmVtb3ZlTGFzdExpc3RlbmVyOiAoKSA9PiB7XG5cdFx0XHRcdHByb21pc2UuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gZW1pdHRlci5ldmVudDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmlwZ3JlcFRleHRTZWFyY2goY29uZmlnOiBJVGV4dFF1ZXJ5LCBwcm9ncmVzc0NhbGxiYWNrOiBJUHJvZ3Jlc3NDYWxsYmFjaywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VyaWFsaXplZFNlYXJjaFN1Y2Nlc3M+IHtcblx0XHRjb25maWcubWF4RmlsZVNpemUgPSB0aGlzLmdldFBsYXRmb3JtRmlsZUxpbWl0cygpLm1heEZpbGVTaXplO1xuXHRcdGNvbnN0IG51bVRocmVhZHMgPSBhd2FpdCB0aGlzLmdldE51bVRocmVhZHM/LigpO1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBUZXh0U2VhcmNoRW5naW5lQWRhcHRlcihjb25maWcsIG51bVRocmVhZHMpO1xuXG5cdFx0cmV0dXJuIGVuZ2luZS5zZWFyY2godG9rZW4sIHByb2dyZXNzQ2FsbGJhY2ssIHByb2dyZXNzQ2FsbGJhY2spO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQbGF0Zm9ybUZpbGVMaW1pdHMoKTogeyByZWFkb25seSBtYXhGaWxlU2l6ZTogbnVtYmVyIH0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRtYXhGaWxlU2l6ZTogMTYgKiBCeXRlU2l6ZS5HQlxuXHRcdH07XG5cdH1cblxuXHRkb0ZpbGVTZWFyY2goY29uZmlnOiBJRmlsZVF1ZXJ5LCBudW1UaHJlYWRzOiBudW1iZXIgfCB1bmRlZmluZWQsIHByb2dyZXNzQ2FsbGJhY2s6IElQcm9ncmVzc0NhbGxiYWNrLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJU2VyaWFsaXplZFNlYXJjaFN1Y2Nlc3M+IHtcblx0XHRyZXR1cm4gdGhpcy5kb0ZpbGVTZWFyY2hXaXRoRW5naW5lKEZpbGVTZWFyY2hFbmdpbmUsIGNvbmZpZywgcHJvZ3Jlc3NDYWxsYmFjaywgdG9rZW4sIFNlYXJjaFNlcnZpY2UuQkFUQ0hfU0laRSwgbnVtVGhyZWFkcyk7XG5cdH1cblxuXHRkb0ZpbGVTZWFyY2hXaXRoRW5naW5lKEVuZ2luZUNsYXNzOiB7IG5ldyhjb25maWc6IElGaWxlUXVlcnksIG51bVRocmVhZHM/OiBudW1iZXIgfCB1bmRlZmluZWQpOiBJU2VhcmNoRW5naW5lPElSYXdGaWxlTWF0Y2g+IH0sIGNvbmZpZzogSUZpbGVRdWVyeSwgcHJvZ3Jlc3NDYWxsYmFjazogSVByb2dyZXNzQ2FsbGJhY2ssIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sIGJhdGNoU2l6ZSA9IFNlYXJjaFNlcnZpY2UuQkFUQ0hfU0laRSwgdGhyZWFkcz86IG51bWJlcik6IFByb21pc2U8SVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzPiB7XG5cdFx0bGV0IHJlc3VsdENvdW50ID0gMDtcblx0XHRjb25zdCBmaWxlUHJvZ3Jlc3NDYWxsYmFjazogSUZpbGVQcm9ncmVzc0NhbGxiYWNrID0gcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocHJvZ3Jlc3MpKSB7XG5cdFx0XHRcdHJlc3VsdENvdW50ICs9IHByb2dyZXNzLmxlbmd0aDtcblx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhwcm9ncmVzcy5tYXAobSA9PiB0aGlzLnJhd01hdGNoVG9TZWFyY2hJdGVtKG0pKSk7XG5cdFx0XHR9IGVsc2UgaWYgKCg8SVJhd0ZpbGVNYXRjaD5wcm9ncmVzcykucmVsYXRpdmVQYXRoKSB7XG5cdFx0XHRcdHJlc3VsdENvdW50Kys7XG5cdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2sodGhpcy5yYXdNYXRjaFRvU2VhcmNoSXRlbSg8SVJhd0ZpbGVNYXRjaD5wcm9ncmVzcykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayg8SVByb2dyZXNzTWVzc2FnZT5wcm9ncmVzcyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGlmIChjb25maWcuc29ydEJ5U2NvcmUpIHtcblx0XHRcdGxldCBzb3J0ZWRTZWFyY2ggPSB0aGlzLnRyeVNvcnRlZFNlYXJjaEZyb21DYWNoZShjb25maWcsIGZpbGVQcm9ncmVzc0NhbGxiYWNrLCB0b2tlbik7XG5cdFx0XHRpZiAoIXNvcnRlZFNlYXJjaCkge1xuXHRcdFx0XHRjb25zdCB3YWxrZXJDb25maWcgPSBjb25maWcubWF4UmVzdWx0cyA/IE9iamVjdC5hc3NpZ24oe30sIGNvbmZpZywgeyBtYXhSZXN1bHRzOiBudWxsIH0pIDogY29uZmlnO1xuXHRcdFx0XHRjb25zdCBlbmdpbmUgPSBuZXcgRW5naW5lQ2xhc3Mod2Fsa2VyQ29uZmlnLCB0aHJlYWRzKTtcblx0XHRcdFx0c29ydGVkU2VhcmNoID0gdGhpcy5kb1NvcnRlZFNlYXJjaChlbmdpbmUsIGNvbmZpZywgcHJvZ3Jlc3NDYWxsYmFjaywgZmlsZVByb2dyZXNzQ2FsbGJhY2ssIHRva2VuKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPElTZXJpYWxpemVkU2VhcmNoU3VjY2Vzcz4oKGMsIGUpID0+IHtcblx0XHRcdFx0c29ydGVkU2VhcmNoLnRoZW4oKFtyZXN1bHQsIHJhd01hdGNoZXNdKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VyaWFsaXplZE1hdGNoZXMgPSByYXdNYXRjaGVzLm1hcChyYXdNYXRjaCA9PiB0aGlzLnJhd01hdGNoVG9TZWFyY2hJdGVtKHJhd01hdGNoKSk7XG5cdFx0XHRcdFx0dGhpcy5zZW5kUHJvZ3Jlc3Moc2VyaWFsaXplZE1hdGNoZXMsIHByb2dyZXNzQ2FsbGJhY2ssIGJhdGNoU2l6ZSk7XG5cdFx0XHRcdFx0YyhyZXN1bHQpO1xuXHRcdFx0XHR9LCBlKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBFbmdpbmVDbGFzcyhjb25maWcsIHRocmVhZHMpO1xuXG5cdFx0cmV0dXJuIHRoaXMuZG9TZWFyY2goZW5naW5lLCBmaWxlUHJvZ3Jlc3NDYWxsYmFjaywgYmF0Y2hTaXplLCB0b2tlbikudGhlbihjb21wbGV0ZSA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsaW1pdEhpdDogY29tcGxldGUubGltaXRIaXQsXG5cdFx0XHRcdHR5cGU6ICdzdWNjZXNzJyxcblx0XHRcdFx0c3RhdHM6IHtcblx0XHRcdFx0XHRkZXRhaWxTdGF0czogY29tcGxldGUuc3RhdHMsXG5cdFx0XHRcdFx0dHlwZTogdGhpcy5wcm9jZXNzVHlwZSxcblx0XHRcdFx0XHRmcm9tQ2FjaGU6IGZhbHNlLFxuXHRcdFx0XHRcdHJlc3VsdENvdW50LFxuXHRcdFx0XHRcdHNvcnRpbmdUaW1lOiB1bmRlZmluZWRcblx0XHRcdFx0fSxcblx0XHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByYXdNYXRjaFRvU2VhcmNoSXRlbShtYXRjaDogSVJhd0ZpbGVNYXRjaCk6IElTZXJpYWxpemVkRmlsZU1hdGNoIHtcblx0XHRyZXR1cm4geyBwYXRoOiBtYXRjaC5iYXNlID8gam9pbihtYXRjaC5iYXNlLCBtYXRjaC5yZWxhdGl2ZVBhdGgpIDogbWF0Y2gucmVsYXRpdmVQYXRoIH07XG5cdH1cblxuXHRwcml2YXRlIGRvU29ydGVkU2VhcmNoKGVuZ2luZTogSVNlYXJjaEVuZ2luZTxJUmF3RmlsZU1hdGNoPiwgY29uZmlnOiBJRmlsZVF1ZXJ5LCBwcm9ncmVzc0NhbGxiYWNrOiBJUHJvZ3Jlc3NDYWxsYmFjaywgZmlsZVByb2dyZXNzQ2FsbGJhY2s6IElGaWxlUHJvZ3Jlc3NDYWxsYmFjaywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8W0lTZXJpYWxpemVkU2VhcmNoU3VjY2VzcywgSVJhd0ZpbGVNYXRjaFtdXT4ge1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxJRmlsZVNlYXJjaFByb2dyZXNzSXRlbT4oKTtcblxuXHRcdGxldCBhbGxSZXN1bHRzUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHtcblx0XHRcdGxldCByZXN1bHRzOiBJUmF3RmlsZU1hdGNoW10gPSBbXTtcblxuXHRcdFx0Y29uc3QgaW5uZXJQcm9ncmVzc0NhbGxiYWNrOiBJRmlsZVByb2dyZXNzQ2FsbGJhY2sgPSBwcm9ncmVzcyA9PiB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHByb2dyZXNzKSkge1xuXHRcdFx0XHRcdHJlc3VsdHMgPSBwcm9ncmVzcztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRmaWxlUHJvZ3Jlc3NDYWxsYmFjayhwcm9ncmVzcyk7XG5cdFx0XHRcdFx0ZW1pdHRlci5maXJlKHByb2dyZXNzKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIHRoaXMuZG9TZWFyY2goZW5naW5lLCBpbm5lclByb2dyZXNzQ2FsbGJhY2ssIC0xLCB0b2tlbilcblx0XHRcdFx0LnRoZW48W0lTZWFyY2hFbmdpbmVTdWNjZXNzLCBJUmF3RmlsZU1hdGNoW11dPihyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBbcmVzdWx0LCByZXN1bHRzXTtcblx0XHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRsZXQgY2FjaGU6IENhY2hlO1xuXHRcdGlmIChjb25maWcuY2FjaGVLZXkpIHtcblx0XHRcdGNhY2hlID0gdGhpcy5nZXRPckNyZWF0ZUNhY2hlKGNvbmZpZy5jYWNoZUtleSk7XG5cdFx0XHRjb25zdCBjYWNoZVJvdzogSUNhY2hlUm93ID0ge1xuXHRcdFx0XHRwcm9taXNlOiBhbGxSZXN1bHRzUHJvbWlzZSxcblx0XHRcdFx0ZXZlbnQ6IGVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRcdHJlc29sdmVkOiBmYWxzZVxuXHRcdFx0fTtcblx0XHRcdGNhY2hlLnJlc3VsdHNUb1NlYXJjaENhY2hlW2NvbmZpZy5maWxlUGF0dGVybiB8fCAnJ10gPSBjYWNoZVJvdztcblx0XHRcdGFsbFJlc3VsdHNQcm9taXNlLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRjYWNoZVJvdy5yZXNvbHZlZCA9IHRydWU7XG5cdFx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0XHRkZWxldGUgY2FjaGUucmVzdWx0c1RvU2VhcmNoQ2FjaGVbY29uZmlnLmZpbGVQYXR0ZXJuIHx8ICcnXTtcblx0XHRcdH0pO1xuXG5cdFx0XHRhbGxSZXN1bHRzUHJvbWlzZSA9IHRoaXMucHJldmVudENhbmNlbGxhdGlvbihhbGxSZXN1bHRzUHJvbWlzZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFsbFJlc3VsdHNQcm9taXNlLnRoZW4oKFtyZXN1bHQsIHJlc3VsdHNdKSA9PiB7XG5cdFx0XHRjb25zdCBzY29yZXJDYWNoZTogRnV6enlTY29yZXJDYWNoZSA9IGNhY2hlID8gY2FjaGUuc2NvcmVyQ2FjaGUgOiBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdFx0Y29uc3Qgc29ydFNXID0gKHR5cGVvZiBjb25maWcubWF4UmVzdWx0cyAhPT0gJ251bWJlcicgfHwgY29uZmlnLm1heFJlc3VsdHMgPiAwKSAmJiBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblx0XHRcdHJldHVybiB0aGlzLnNvcnRSZXN1bHRzKGNvbmZpZywgcmVzdWx0cywgc2NvcmVyQ2FjaGUsIHRva2VuKVxuXHRcdFx0XHQudGhlbjxbSVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzLCBJUmF3RmlsZU1hdGNoW11dPihzb3J0ZWRSZXN1bHRzID0+IHtcblx0XHRcdFx0XHQvLyBzb3J0aW5nVGltZTogLTEgaW5kaWNhdGVzIGEgXCJzb3J0ZWRcIiBzZWFyY2ggdGhhdCB3YXMgbm90IHNvcnRlZCwgaS5lLiBwb3B1bGF0aW5nIHRoZSBjYWNoZSB3aGVuIHF1aWNrYWNjZXNzIGlzIG9wZW5lZC5cblx0XHRcdFx0XHQvLyBDb250cmFzdGluZyB3aXRoIGZpbmRGaWxlcyB3aGljaCBpcyBub3Qgc29ydGVkIGFuZCB3aWxsIGhhdmUgc29ydGluZ1RpbWU6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdGNvbnN0IHNvcnRpbmdUaW1lID0gc29ydFNXID8gc29ydFNXLmVsYXBzZWQoKSA6IC0xO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3VjY2VzcycsXG5cdFx0XHRcdFx0XHRzdGF0czoge1xuXHRcdFx0XHRcdFx0XHRkZXRhaWxTdGF0czogcmVzdWx0LnN0YXRzLFxuXHRcdFx0XHRcdFx0XHRzb3J0aW5nVGltZSxcblx0XHRcdFx0XHRcdFx0ZnJvbUNhY2hlOiBmYWxzZSxcblx0XHRcdFx0XHRcdFx0dHlwZTogdGhpcy5wcm9jZXNzVHlwZSxcblx0XHRcdFx0XHRcdFx0cmVzdWx0Q291bnQ6IHNvcnRlZFJlc3VsdHMubGVuZ3RoXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IHJlc3VsdC5tZXNzYWdlcyxcblx0XHRcdFx0XHRcdGxpbWl0SGl0OiByZXN1bHQubGltaXRIaXQgfHwgdHlwZW9mIGNvbmZpZy5tYXhSZXN1bHRzID09PSAnbnVtYmVyJyAmJiByZXN1bHRzLmxlbmd0aCA+IGNvbmZpZy5tYXhSZXN1bHRzXG5cdFx0XHRcdFx0fSwgc29ydGVkUmVzdWx0c107XG5cdFx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPckNyZWF0ZUNhY2hlKGNhY2hlS2V5OiBzdHJpbmcpOiBDYWNoZSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmNhY2hlc1tjYWNoZUtleV07XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmNhY2hlc1tjYWNoZUtleV0gPSBuZXcgQ2FjaGUoKTtcblx0fVxuXG5cdHByaXZhdGUgdHJ5U29ydGVkU2VhcmNoRnJvbUNhY2hlKGNvbmZpZzogSUZpbGVRdWVyeSwgcHJvZ3Jlc3NDYWxsYmFjazogSUZpbGVQcm9ncmVzc0NhbGxiYWNrLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxbSVNlcmlhbGl6ZWRTZWFyY2hTdWNjZXNzLCBJUmF3RmlsZU1hdGNoW11dPiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY2FjaGUgPSBjb25maWcuY2FjaGVLZXkgJiYgdGhpcy5jYWNoZXNbY29uZmlnLmNhY2hlS2V5XTtcblx0XHRpZiAoIWNhY2hlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhY2hlZCA9IHRoaXMuZ2V0UmVzdWx0c0Zyb21DYWNoZShjYWNoZSwgY29uZmlnLmZpbGVQYXR0ZXJuIHx8ICcnLCBwcm9ncmVzc0NhbGxiYWNrLCB0b2tlbik7XG5cdFx0aWYgKGNhY2hlZCkge1xuXHRcdFx0cmV0dXJuIGNhY2hlZC50aGVuKChbcmVzdWx0LCByZXN1bHRzLCBjYWNoZVN0YXRzXSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzb3J0U1cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc29ydFJlc3VsdHMoY29uZmlnLCByZXN1bHRzLCBjYWNoZS5zY29yZXJDYWNoZSwgdG9rZW4pXG5cdFx0XHRcdFx0LnRoZW48W0lTZXJpYWxpemVkU2VhcmNoU3VjY2VzcywgSVJhd0ZpbGVNYXRjaFtdXT4oc29ydGVkUmVzdWx0cyA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBzb3J0aW5nVGltZSA9IHNvcnRTVy5lbGFwc2VkKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBzdGF0czogSUZpbGVTZWFyY2hTdGF0cyA9IHtcblx0XHRcdFx0XHRcdFx0ZnJvbUNhY2hlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRkZXRhaWxTdGF0czogY2FjaGVTdGF0cyxcblx0XHRcdFx0XHRcdFx0dHlwZTogdGhpcy5wcm9jZXNzVHlwZSxcblx0XHRcdFx0XHRcdFx0cmVzdWx0Q291bnQ6IHJlc3VsdHMubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRzb3J0aW5nVGltZVxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdWNjZXNzJyxcblx0XHRcdFx0XHRcdFx0XHRsaW1pdEhpdDogcmVzdWx0LmxpbWl0SGl0IHx8IHR5cGVvZiBjb25maWcubWF4UmVzdWx0cyA9PT0gJ251bWJlcicgJiYgcmVzdWx0cy5sZW5ndGggPiBjb25maWcubWF4UmVzdWx0cyxcblx0XHRcdFx0XHRcdFx0XHRzdGF0cyxcblx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlczogW10sXG5cdFx0XHRcdFx0XHRcdH0gc2F0aXNmaWVzIElTZXJpYWxpemVkU2VhcmNoU3VjY2Vzcyxcblx0XHRcdFx0XHRcdFx0c29ydGVkUmVzdWx0c1xuXHRcdFx0XHRcdFx0XTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzb3J0UmVzdWx0cyhjb25maWc6IElGaWxlUXVlcnksIHJlc3VsdHM6IElSYXdGaWxlTWF0Y2hbXSwgc2NvcmVyQ2FjaGU6IEZ1enp5U2NvcmVyQ2FjaGUsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSYXdGaWxlTWF0Y2hbXT4ge1xuXHRcdC8vIHdlIHVzZSB0aGUgc2FtZSBjb21wYXJlIGZ1bmN0aW9uIHRoYXQgaXMgdXNlZCBsYXRlciB3aGVuIHNob3dpbmcgdGhlIHJlc3VsdHMgdXNpbmcgZnV6enkgc2NvcmluZ1xuXHRcdC8vIHRoaXMgaXMgdmVyeSBpbXBvcnRhbnQgYmVjYXVzZSB3ZSBhcmUgYWxzbyBsaW1pdGluZyB0aGUgbnVtYmVyIG9mIHJlc3VsdHMgYnkgY29uZmlnLm1heFJlc3VsdHNcblx0XHQvLyBhbmQgYXMgc3VjaCB3ZSB3YW50IHRoZSB0b3AgaXRlbXMgdG8gYmUgaW5jbHVkZWQgaW4gdGhpcyByZXN1bHQgc2V0IGlmIHRoZSBudW1iZXIgb2YgaXRlbXNcblx0XHQvLyBleGNlZWRzIGNvbmZpZy5tYXhSZXN1bHRzLlxuXHRcdGNvbnN0IHF1ZXJ5ID0gcHJlcGFyZVF1ZXJ5KGNvbmZpZy5maWxlUGF0dGVybiB8fCAnJyk7XG5cdFx0Y29uc3QgY29tcGFyZSA9IChtYXRjaEE6IElSYXdGaWxlTWF0Y2gsIG1hdGNoQjogSVJhd0ZpbGVNYXRjaCkgPT4gY29tcGFyZUl0ZW1zQnlGdXp6eVNjb3JlKG1hdGNoQSwgbWF0Y2hCLCBxdWVyeSwgdHJ1ZSwgRmlsZU1hdGNoSXRlbUFjY2Vzc29yLCBzY29yZXJDYWNoZSk7XG5cblx0XHRjb25zdCBtYXhSZXN1bHRzID0gdHlwZW9mIGNvbmZpZy5tYXhSZXN1bHRzID09PSAnbnVtYmVyJyA/IGNvbmZpZy5tYXhSZXN1bHRzIDogREVGQVVMVF9NQVhfU0VBUkNIX1JFU1VMVFM7XG5cdFx0cmV0dXJuIGFycmF5cy50b3BBc3luYyhyZXN1bHRzLCBjb21wYXJlLCBtYXhSZXN1bHRzLCAxMDAwMCwgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kUHJvZ3Jlc3MocmVzdWx0czogSVNlcmlhbGl6ZWRGaWxlTWF0Y2hbXSwgcHJvZ3Jlc3NDYjogSVByb2dyZXNzQ2FsbGJhY2ssIGJhdGNoU2l6ZTogbnVtYmVyKSB7XG5cdFx0aWYgKGJhdGNoU2l6ZSAmJiBiYXRjaFNpemUgPiAwKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpICs9IGJhdGNoU2l6ZSkge1xuXHRcdFx0XHRwcm9ncmVzc0NiKHJlc3VsdHMuc2xpY2UoaSwgaSArIGJhdGNoU2l6ZSkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRwcm9ncmVzc0NiKHJlc3VsdHMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVzdWx0c0Zyb21DYWNoZShjYWNoZTogQ2FjaGUsIHNlYXJjaFZhbHVlOiBzdHJpbmcsIHByb2dyZXNzQ2FsbGJhY2s6IElGaWxlUHJvZ3Jlc3NDYWxsYmFjaywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8W0lTZWFyY2hFbmdpbmVTdWNjZXNzLCBJUmF3RmlsZU1hdGNoW10sIElDYWNoZWRTZWFyY2hTdGF0c10+IHwgbnVsbCB7XG5cdFx0Y29uc3QgY2FjaGVMb29rdXBTVyA9IFN0b3BXYXRjaC5jcmVhdGUoZmFsc2UpO1xuXG5cdFx0Ly8gRmluZCBjYWNoZSBlbnRyaWVzIGJ5IHByZWZpeCBvZiBzZWFyY2ggdmFsdWVcblx0XHRjb25zdCBoYXNQYXRoU2VwID0gc2VhcmNoVmFsdWUuaW5kZXhPZihzZXApID49IDA7XG5cdFx0bGV0IGNhY2hlZFJvdzogSUNhY2hlUm93IHwgdW5kZWZpbmVkO1xuXHRcdGZvciAoY29uc3QgcHJldmlvdXNTZWFyY2ggaW4gY2FjaGUucmVzdWx0c1RvU2VhcmNoQ2FjaGUpIHtcblx0XHRcdC8vIElmIHdlIG5hcnJvdyBkb3duLCB3ZSBtaWdodCBiZSBhYmxlIHRvIHJldXNlIHRoZSBjYWNoZWQgcmVzdWx0c1xuXHRcdFx0aWYgKHNlYXJjaFZhbHVlLnN0YXJ0c1dpdGgocHJldmlvdXNTZWFyY2gpKSB7XG5cdFx0XHRcdGlmIChoYXNQYXRoU2VwICYmIHByZXZpb3VzU2VhcmNoLmluZGV4T2Yoc2VwKSA8IDAgJiYgcHJldmlvdXNTZWFyY2ggIT09ICcnKSB7XG5cdFx0XHRcdFx0Y29udGludWU7IC8vIHNpbmNlIGEgcGF0aCBjaGFyYWN0ZXIgd2lkZW5zIHRoZSBzZWFyY2ggZm9yIHBvdGVudGlhbCBtb3JlIG1hdGNoZXMsIHJlcXVpcmUgaXQgaW4gcHJldmlvdXMgc2VhcmNoIHRvb1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgcm93ID0gY2FjaGUucmVzdWx0c1RvU2VhcmNoQ2FjaGVbcHJldmlvdXNTZWFyY2hdO1xuXHRcdFx0XHRjYWNoZWRSb3cgPSB7XG5cdFx0XHRcdFx0cHJvbWlzZTogdGhpcy5wcmV2ZW50Q2FuY2VsbGF0aW9uKHJvdy5wcm9taXNlKSxcblx0XHRcdFx0XHRldmVudDogcm93LmV2ZW50LFxuXHRcdFx0XHRcdHJlc29sdmVkOiByb3cucmVzb2x2ZWRcblx0XHRcdFx0fTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFjYWNoZWRSb3cpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNhY2hlTG9va3VwVGltZSA9IGNhY2hlTG9va3VwU1cuZWxhcHNlZCgpO1xuXHRcdGNvbnN0IGNhY2hlRmlsdGVyU1cgPSBTdG9wV2F0Y2guY3JlYXRlKGZhbHNlKTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyID0gY2FjaGVkUm93LmV2ZW50KHByb2dyZXNzQ2FsbGJhY2spO1xuXHRcdGlmICh0b2tlbikge1xuXHRcdFx0dG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2FjaGVkUm93LnByb21pc2UudGhlbjxbSVNlYXJjaEVuZ2luZVN1Y2Nlc3MsIElSYXdGaWxlTWF0Y2hbXSwgSUNhY2hlZFNlYXJjaFN0YXRzXT4oKFtjb21wbGV0ZSwgY2FjaGVkRW50cmllc10pID0+IHtcblx0XHRcdGlmICh0b2tlbiAmJiB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHR0aHJvdyBjYW5jZWxlZCgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBQYXR0ZXJuIG1hdGNoIG9uIHJlc3VsdHNcblx0XHRcdGNvbnN0IHJlc3VsdHM6IElSYXdGaWxlTWF0Y2hbXSA9IFtdO1xuXHRcdFx0Y29uc3Qgbm9ybWFsaXplZFNlYXJjaFZhbHVlTG93ZXJjYXNlID0gcHJlcGFyZVF1ZXJ5KHNlYXJjaFZhbHVlKS5ub3JtYWxpemVkTG93ZXJjYXNlO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBjYWNoZWRFbnRyaWVzKSB7XG5cblx0XHRcdFx0Ly8gQ2hlY2sgaWYgdGhpcyBlbnRyeSBpcyBhIG1hdGNoIGZvciB0aGUgc2VhcmNoIHZhbHVlXG5cdFx0XHRcdGlmICghaXNGaWxlUGF0dGVybk1hdGNoKGVudHJ5LCBub3JtYWxpemVkU2VhcmNoVmFsdWVMb3dlcmNhc2UpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXN1bHRzLnB1c2goZW50cnkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gW2NvbXBsZXRlLCByZXN1bHRzLCB7XG5cdFx0XHRcdGNhY2hlV2FzUmVzb2x2ZWQ6IGNhY2hlZFJvdy5yZXNvbHZlZCxcblx0XHRcdFx0Y2FjaGVMb29rdXBUaW1lLFxuXHRcdFx0XHRjYWNoZUZpbHRlclRpbWU6IGNhY2hlRmlsdGVyU1cuZWxhcHNlZCgpLFxuXHRcdFx0XHRjYWNoZUVudHJ5Q291bnQ6IGNhY2hlZEVudHJpZXMubGVuZ3RoXG5cdFx0XHR9XTtcblx0XHR9KTtcblx0fVxuXG5cblxuXHRwcml2YXRlIGRvU2VhcmNoKGVuZ2luZTogSVNlYXJjaEVuZ2luZTxJUmF3RmlsZU1hdGNoPiwgcHJvZ3Jlc3NDYWxsYmFjazogSUZpbGVQcm9ncmVzc0NhbGxiYWNrLCBiYXRjaFNpemU6IG51bWJlciwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaEVuZ2luZVN1Y2Nlc3M+IHtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8SVNlYXJjaEVuZ2luZVN1Y2Nlc3M+KChjLCBlKSA9PiB7XG5cdFx0XHRsZXQgYmF0Y2g6IElSYXdGaWxlTWF0Y2hbXSA9IFtdO1xuXHRcdFx0dG9rZW4/Lm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGVuZ2luZS5jYW5jZWwoKSk7XG5cblx0XHRcdGVuZ2luZS5zZWFyY2goKG1hdGNoKSA9PiB7XG5cdFx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRcdGlmIChiYXRjaFNpemUpIHtcblx0XHRcdFx0XHRcdGJhdGNoLnB1c2gobWF0Y2gpO1xuXHRcdFx0XHRcdFx0aWYgKGJhdGNoU2l6ZSA+IDAgJiYgYmF0Y2gubGVuZ3RoID49IGJhdGNoU2l6ZSkge1xuXHRcdFx0XHRcdFx0XHRwcm9ncmVzc0NhbGxiYWNrKGJhdGNoKTtcblx0XHRcdFx0XHRcdFx0YmF0Y2ggPSBbXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhtYXRjaCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LCAocHJvZ3Jlc3MpID0+IHtcblx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhwcm9ncmVzcyk7XG5cdFx0XHR9LCAoZXJyb3IsIGNvbXBsZXRlKSA9PiB7XG5cdFx0XHRcdGlmIChiYXRjaC5sZW5ndGgpIHtcblx0XHRcdFx0XHRwcm9ncmVzc0NhbGxiYWNrKGJhdGNoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2soeyBtZXNzYWdlOiAnU2VhcmNoIGZpbmlzaGVkLiBFcnJvcjogJyArIGVycm9yLm1lc3NhZ2UgfSk7XG5cdFx0XHRcdFx0ZShlcnJvcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayh7IG1lc3NhZ2U6ICdTZWFyY2ggZmluaXNoZWQuIFN0YXRzOiAnICsgSlNPTi5zdHJpbmdpZnkoY29tcGxldGUuc3RhdHMpIH0pO1xuXHRcdFx0XHRcdGMoY29tcGxldGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdGNsZWFyQ2FjaGUoY2FjaGVLZXk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGRlbGV0ZSB0aGlzLmNhY2hlc1tjYWNoZUtleV07XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybiBhIENhbmNlbGFibGVQcm9taXNlIHdoaWNoIGlzIG5vdCBhY3R1YWxseSBjYW5jZWxhYmxlXG5cdCAqIFRPRE9Acm9iIC0gSXMgdGhpcyByZWFsbHkgbmVlZGVkP1xuXHQgKi9cblx0cHJpdmF0ZSBwcmV2ZW50Q2FuY2VsbGF0aW9uPEM+KHByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPEM+KTogQ2FuY2VsYWJsZVByb21pc2U8Qz4ge1xuXHRcdHJldHVybiBuZXcgY2xhc3MgaW1wbGVtZW50cyBDYW5jZWxhYmxlUHJvbWlzZTxDPiB7XG5cdFx0XHRnZXQgW1N5bWJvbC50b1N0cmluZ1RhZ10oKSB7IHJldHVybiB0aGlzLnRvU3RyaW5nKCk7IH1cblx0XHRcdGNhbmNlbCgpIHtcblx0XHRcdFx0Ly8gRG8gbm90aGluZ1xuXHRcdFx0fVxuXHRcdFx0dGhlbjxUUmVzdWx0MSA9IEMsIFRSZXN1bHQyID0gbmV2ZXI+KHJlc29sdmU/OiAoKHZhbHVlOiBDKSA9PiBUUmVzdWx0MSB8IFByb21pc2U8VFJlc3VsdDE+KSB8IHVuZGVmaW5lZCB8IG51bGwsIHJlamVjdD86ICgocmVhc29uOiBhbnkpID0+IFRSZXN1bHQyIHwgUHJvbWlzZTxUUmVzdWx0Mj4pIHwgdW5kZWZpbmVkIHwgbnVsbCk6IFByb21pc2U8VFJlc3VsdDEgfCBUUmVzdWx0Mj4ge1xuXHRcdFx0XHRyZXR1cm4gcHJvbWlzZS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG5cdFx0XHR9XG5cdFx0XHRjYXRjaChyZWplY3Q/OiBhbnkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudGhlbih1bmRlZmluZWQsIHJlamVjdCk7XG5cdFx0XHR9XG5cdFx0XHRmaW5hbGx5KG9uRmluYWxseTogYW55KSB7XG5cdFx0XHRcdHJldHVybiBwcm9taXNlLmZpbmFsbHkob25GaW5hbGx5KTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJQ2FjaGVSb3cge1xuXHQvLyBUT0RPQHJvYmxvdSAtIG5ldmVyIGFjdHVhbGx5IGNhbmNlbGVkXG5cdHByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPFtJU2VhcmNoRW5naW5lU3VjY2VzcywgSVJhd0ZpbGVNYXRjaFtdXT47XG5cdHJlc29sdmVkOiBib29sZWFuO1xuXHRldmVudDogRXZlbnQ8SUZpbGVTZWFyY2hQcm9ncmVzc0l0ZW0+O1xufVxuXG5jbGFzcyBDYWNoZSB7XG5cblx0cmVzdWx0c1RvU2VhcmNoQ2FjaGU6IHsgW3NlYXJjaFZhbHVlOiBzdHJpbmddOiBJQ2FjaGVSb3cgfSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0c2NvcmVyQ2FjaGU6IEZ1enp5U2NvcmVyQ2FjaGUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xufVxuXG5jb25zdCBGaWxlTWF0Y2hJdGVtQWNjZXNzb3IgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBJSXRlbUFjY2Vzc29yPElSYXdGaWxlTWF0Y2g+IHtcblxuXHRnZXRJdGVtTGFiZWwobWF0Y2g6IElSYXdGaWxlTWF0Y2gpOiBzdHJpbmcge1xuXHRcdHJldHVybiBiYXNlbmFtZShtYXRjaC5yZWxhdGl2ZVBhdGgpOyAvLyBlLmcuIG15RmlsZS50eHRcblx0fVxuXG5cdGdldEl0ZW1EZXNjcmlwdGlvbihtYXRjaDogSVJhd0ZpbGVNYXRjaCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGRpcm5hbWUobWF0Y2gucmVsYXRpdmVQYXRoKTsgLy8gZS5nLiBzb21lL3BhdGgvdG8vZmlsZVxuXHR9XG5cblx0Z2V0SXRlbVBhdGgobWF0Y2g6IElSYXdGaWxlTWF0Y2gpOiBzdHJpbmcge1xuXHRcdHJldHVybiBtYXRjaC5yZWxhdGl2ZVBhdGg7IC8vIGUuZy4gc29tZS9wYXRoL3RvL2ZpbGUvbXlGaWxlLnR4dFxuXHR9XG59O1xuXG5mdW5jdGlvbiByZXZpdmVRdWVyeTxVIGV4dGVuZHMgSVJhd1F1ZXJ5PihyYXdRdWVyeTogVSk6IFUgZXh0ZW5kcyBJUmF3VGV4dFF1ZXJ5ID8gSVRleHRRdWVyeSA6IElGaWxlUXVlcnkge1xuXHRyZXR1cm4ge1xuXHRcdC4uLjxhbnk+cmF3UXVlcnksIC8vIFRPRE9cblx0XHQuLi57XG5cdFx0XHRmb2xkZXJRdWVyaWVzOiByYXdRdWVyeS5mb2xkZXJRdWVyaWVzICYmIHJhd1F1ZXJ5LmZvbGRlclF1ZXJpZXMubWFwKHJldml2ZUZvbGRlclF1ZXJ5KSxcblx0XHRcdGV4dHJhRmlsZVJlc291cmNlczogcmF3UXVlcnkuZXh0cmFGaWxlUmVzb3VyY2VzICYmIHJhd1F1ZXJ5LmV4dHJhRmlsZVJlc291cmNlcy5tYXAoY29tcG9uZW50cyA9PiBVUkkucmV2aXZlKGNvbXBvbmVudHMpKVxuXHRcdH1cblx0fTtcbn1cblxuZnVuY3Rpb24gcmV2aXZlRm9sZGVyUXVlcnkocmF3Rm9sZGVyUXVlcnk6IElGb2xkZXJRdWVyeTxVcmlDb21wb25lbnRzPik6IElGb2xkZXJRdWVyeTxVUkk+IHtcblx0cmV0dXJuIHJldml2ZShyYXdGb2xkZXJRdWVyeSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFlBQVk7QUFDeEIsU0FBNEIsK0JBQStCO0FBRTNELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUywwQkFBMkQsb0JBQW9CO0FBQ3hGLFNBQVMsY0FBYztBQUN2QixTQUFTLFVBQVUsU0FBUyxNQUFNLFdBQVc7QUFDN0MsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUEwQjtBQUNuQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUFpVywwQkFBc0M7QUFDaFosU0FBUyxVQUFVLHdCQUF3QjtBQUMzQyxTQUFTLCtCQUErQjtBQUtqQyxNQUFNLGlCQUFOLE1BQU0sZUFBMkM7QUFBQSxFQU12RCxZ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
