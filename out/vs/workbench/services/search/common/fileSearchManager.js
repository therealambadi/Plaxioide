import * as path from "../../../../base/common/path.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import * as glob from "../../../../base/common/glob.js";
import * as resources from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { QueryGlobTester, resolvePatternsForProvider, hasSiblingFn, excludeToGlobPattern, DEFAULT_MAX_SEARCH_RESULTS } from "./search.js";
import { OldFileSearchProviderConverter } from "./searchExtConversionTypes.js";
import { FolderQuerySearchTree } from "./folderQuerySearchTree.js";
class FileSearchEngine {
  constructor(config, provider, sessionLifecycle) {
    this.config = config;
    this.provider = provider;
    this.sessionLifecycle = sessionLifecycle;
    this.isLimitHit = false;
    this.resultCount = 0;
    this.isCanceled = false;
    this.filePattern = config.filePattern;
    this.includePattern = config.includePattern && glob.parse(config.includePattern);
    this.maxResults = config.maxResults || void 0;
    this.exists = config.exists;
    this.activeCancellationTokens = /* @__PURE__ */ new Set();
    this.globalExcludePattern = config.excludePattern && glob.parse(config.excludePattern);
  }
  cancel() {
    this.isCanceled = true;
    this.activeCancellationTokens.forEach((t) => t.cancel());
    this.activeCancellationTokens = /* @__PURE__ */ new Set();
  }
  search(_onResult) {
    const folderQueries = this.config.folderQueries || [];
    return new Promise((resolve, reject) => {
      const onResult = (match) => {
        this.resultCount++;
        _onResult(match);
      };
      if (this.isCanceled) {
        return resolve({ limitHit: this.isLimitHit });
      }
      if (this.config.extraFileResources) {
        this.config.extraFileResources.forEach((extraFile) => {
          const extraFileStr = extraFile.toString();
          const basename = path.basename(extraFileStr);
          if (this.globalExcludePattern && this.globalExcludePattern(extraFileStr, basename)) {
            return;
          }
          this.matchFile(onResult, { base: extraFile, basename });
        });
      }
      this.doSearch(folderQueries, onResult).then((stats) => {
        resolve({
          limitHit: this.isLimitHit,
          stats: stats || void 0
          // Only looking at single-folder workspace stats...
        });
      }, (err) => {
        reject(new Error(toErrorMessage(err)));
      });
    });
  }
  async doSearch(fqs, onResult) {
    const cancellation = new CancellationTokenSource();
    const folderOptions = fqs.map((fq) => this.getSearchOptionsForFolder(fq));
    const session = this.provider instanceof OldFileSearchProviderConverter ? this.sessionLifecycle?.tokenSource.token : this.sessionLifecycle?.obj;
    const options = {
      folderOptions,
      maxResults: this.config.maxResults ?? DEFAULT_MAX_SEARCH_RESULTS,
      session
    };
    const getFolderQueryInfo = (fq) => {
      const queryTester = new QueryGlobTester(this.config, fq);
      const noSiblingsClauses = !queryTester.hasSiblingExcludeClauses();
      return { queryTester, noSiblingsClauses, folder: fq.folder, tree: this.initDirectoryTree() };
    };
    const folderMappings = new FolderQuerySearchTree(fqs, getFolderQueryInfo);
    let providerSW;
    try {
      this.activeCancellationTokens.add(cancellation);
      providerSW = StopWatch.create();
      const results = await this.provider.provideFileSearchResults(
        this.config.filePattern || "",
        options,
        cancellation.token
      );
      const providerTime = providerSW.elapsed();
      const postProcessSW = StopWatch.create();
      if (this.isCanceled && !this.isLimitHit) {
        return null;
      }
      if (results) {
        results.forEach((result) => {
          const fqFolderInfo = folderMappings.findQueryFragmentAwareSubstr(result);
          const relativePath = path.posix.relative(fqFolderInfo.folder.path, result.path);
          if (fqFolderInfo.noSiblingsClauses) {
            const basename = path.basename(result.path);
            this.matchFile(onResult, { base: fqFolderInfo.folder, relativePath, basename });
            return;
          }
          this.addDirectoryEntries(fqFolderInfo.tree, fqFolderInfo.folder, relativePath, onResult);
        });
      }
      if (this.isCanceled && !this.isLimitHit) {
        return null;
      }
      folderMappings.forEachFolderQueryInfo((e) => {
        this.matchDirectoryTree(e.tree, e.queryTester, onResult);
      });
      return {
        providerTime,
        postProcessTime: postProcessSW.elapsed()
      };
    } finally {
      cancellation.dispose();
      this.activeCancellationTokens.delete(cancellation);
    }
  }
  getSearchOptionsForFolder(fq) {
    const includes = resolvePatternsForProvider(this.config.includePattern, fq.includePattern);
    let excludePattern = fq.excludePattern?.map((e) => ({
      folder: e.folder,
      patterns: resolvePatternsForProvider(this.config.excludePattern, e.pattern)
    }));
    if (!excludePattern?.length) {
      excludePattern = [{
        folder: void 0,
        patterns: resolvePatternsForProvider(this.config.excludePattern, void 0)
      }];
    }
    const excludes = excludeToGlobPattern(excludePattern);
    return {
      folder: fq.folder,
      excludes,
      includes,
      useIgnoreFiles: {
        local: !fq.disregardIgnoreFiles,
        parent: !fq.disregardParentIgnoreFiles,
        global: !fq.disregardGlobalIgnoreFiles
      },
      followSymlinks: !fq.ignoreSymlinks
    };
  }
  initDirectoryTree() {
    const tree = {
      rootEntries: [],
      pathToEntries: /* @__PURE__ */ Object.create(null)
    };
    tree.pathToEntries["."] = tree.rootEntries;
    return tree;
  }
  addDirectoryEntries({ pathToEntries }, base, relativeFile, onResult) {
    if (relativeFile === this.filePattern) {
      const basename = path.basename(this.filePattern);
      this.matchFile(onResult, { base, relativePath: this.filePattern, basename });
    }
    function add(relativePath) {
      const basename = path.basename(relativePath);
      const dirname = path.dirname(relativePath);
      let entries = pathToEntries[dirname];
      if (!entries) {
        entries = pathToEntries[dirname] = [];
        add(dirname);
      }
      entries.push({
        base,
        relativePath,
        basename
      });
    }
    add(relativeFile);
  }
  matchDirectoryTree({ rootEntries, pathToEntries }, queryTester, onResult) {
    const self = this;
    const filePattern = this.filePattern;
    function matchDirectory(entries) {
      const hasSibling = hasSiblingFn(() => entries.map((entry) => entry.basename));
      for (let i = 0, n = entries.length; i < n; i++) {
        const entry = entries[i];
        const { relativePath, basename } = entry;
        if (queryTester.matchesExcludesSync(relativePath, basename, filePattern !== basename ? hasSibling : void 0)) {
          continue;
        }
        const sub = pathToEntries[relativePath];
        if (sub) {
          matchDirectory(sub);
        } else {
          if (relativePath === filePattern) {
            continue;
          }
          self.matchFile(onResult, entry);
        }
        if (self.isLimitHit) {
          break;
        }
      }
    }
    matchDirectory(rootEntries);
  }
  matchFile(onResult, candidate) {
    if (!this.includePattern || candidate.relativePath && this.includePattern(candidate.relativePath, candidate.basename)) {
      if (this.exists || this.maxResults && this.resultCount >= this.maxResults) {
        this.isLimitHit = true;
        this.cancel();
      }
      if (!this.isLimitHit) {
        onResult(candidate);
      }
    }
  }
}
class SessionLifecycle {
  constructor() {
    this._obj = new Object();
    this.tokenSource = new CancellationTokenSource();
  }
  get obj() {
    if (this._obj) {
      return this._obj;
    }
    throw new Error("Session object has been dereferenced.");
  }
  cancel() {
    this.tokenSource.cancel();
    this._obj = void 0;
  }
}
const _FileSearchManager = class _FileSearchManager {
  constructor() {
    this.sessions = /* @__PURE__ */ new Map();
  }
  fileSearch(config, provider, onBatch, token) {
    const sessionTokenSource = this.getSessionTokenSource(config.cacheKey);
    const engine = new FileSearchEngine(config, provider, sessionTokenSource);
    let resultCount = 0;
    const onInternalResult = (batch) => {
      resultCount += batch.length;
      onBatch(batch.map((m) => this.rawMatchToSearchItem(m)));
    };
    return this.doSearch(engine, _FileSearchManager.BATCH_SIZE, onInternalResult, token).then(
      (result) => {
        return {
          limitHit: result.limitHit,
          stats: result.stats ? {
            fromCache: false,
            type: "fileSearchProvider",
            resultCount,
            detailStats: result.stats
          } : void 0,
          messages: []
        };
      }
    );
  }
  clearCache(cacheKey) {
    this.sessions.get(cacheKey)?.cancel();
    this.sessions.delete(cacheKey);
  }
  getSessionTokenSource(cacheKey) {
    if (!cacheKey) {
      return void 0;
    }
    if (!this.sessions.has(cacheKey)) {
      this.sessions.set(cacheKey, new SessionLifecycle());
    }
    return this.sessions.get(cacheKey);
  }
  rawMatchToSearchItem(match) {
    if (match.relativePath) {
      return {
        resource: resources.joinPath(match.base, match.relativePath)
      };
    } else {
      return {
        resource: match.base
      };
    }
  }
  doSearch(engine, batchSize, onResultBatch, token) {
    const listener = token.onCancellationRequested(() => {
      engine.cancel();
    });
    const _onResult = (match) => {
      if (match) {
        batch.push(match);
        if (batchSize > 0 && batch.length >= batchSize) {
          onResultBatch(batch);
          batch = [];
        }
      }
    };
    let batch = [];
    return engine.search(_onResult).then((result) => {
      if (batch.length) {
        onResultBatch(batch);
      }
      listener.dispose();
      return result;
    }, (error) => {
      if (batch.length) {
        onResultBatch(batch);
      }
      listener.dispose();
      return Promise.reject(error);
    });
  }
};
_FileSearchManager.BATCH_SIZE = 512;
let FileSearchManager = _FileSearchManager;
export {
  FileSearchManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2NvbW1vbi9maWxlU2VhcmNoTWFuYWdlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0ICogYXMgZ2xvYiBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCAqIGFzIHJlc291cmNlcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZU1hdGNoLCBJRmlsZVNlYXJjaFByb3ZpZGVyU3RhdHMsIElGb2xkZXJRdWVyeSwgSVNlYXJjaENvbXBsZXRlU3RhdHMsIElGaWxlUXVlcnksIFF1ZXJ5R2xvYlRlc3RlciwgcmVzb2x2ZVBhdHRlcm5zRm9yUHJvdmlkZXIsIGhhc1NpYmxpbmdGbiwgZXhjbHVkZVRvR2xvYlBhdHRlcm4sIERFRkFVTFRfTUFYX1NFQVJDSF9SRVNVTFRTIH0gZnJvbSAnLi9zZWFyY2guanMnO1xuaW1wb3J0IHsgRmlsZVNlYXJjaFByb3ZpZGVyRm9sZGVyT3B0aW9ucywgRmlsZVNlYXJjaFByb3ZpZGVyMiwgRmlsZVNlYXJjaFByb3ZpZGVyT3B0aW9ucyB9IGZyb20gJy4vc2VhcmNoRXh0VHlwZXMuanMnO1xuaW1wb3J0IHsgT2xkRmlsZVNlYXJjaFByb3ZpZGVyQ29udmVydGVyIH0gZnJvbSAnLi9zZWFyY2hFeHRDb252ZXJzaW9uVHlwZXMuanMnO1xuaW1wb3J0IHsgRm9sZGVyUXVlcnlTZWFyY2hUcmVlIH0gZnJvbSAnLi9mb2xkZXJRdWVyeVNlYXJjaFRyZWUuanMnO1xuXG5pbnRlcmZhY2UgSUludGVybmFsRmlsZU1hdGNoIHtcblx0YmFzZTogVVJJO1xuXHRvcmlnaW5hbD86IFVSSTtcblx0cmVsYXRpdmVQYXRoPzogc3RyaW5nOyAvLyBOb3QgcHJlc2VudCBmb3IgZXh0cmFGaWxlcyBvciBhYnNvbHV0ZSBwYXRoIG1hdGNoZXNcblx0YmFzZW5hbWU6IHN0cmluZztcblx0c2l6ZT86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElEaXJlY3RvcnlFbnRyeSB7XG5cdGJhc2U6IFVSSTtcblx0cmVsYXRpdmVQYXRoOiBzdHJpbmc7XG5cdGJhc2VuYW1lOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBGb2xkZXJRdWVyeUluZm8ge1xuXHRxdWVyeVRlc3RlcjogUXVlcnlHbG9iVGVzdGVyO1xuXHRub1NpYmxpbmdzQ2xhdXNlczogYm9vbGVhbjtcblx0Zm9sZGVyOiBVUkk7XG5cdHRyZWU6IElEaXJlY3RvcnlUcmVlO1xufVxuXG5pbnRlcmZhY2UgSURpcmVjdG9yeVRyZWUge1xuXHRyb290RW50cmllczogSURpcmVjdG9yeUVudHJ5W107XG5cdHBhdGhUb0VudHJpZXM6IHsgW3JlbGF0aXZlUGF0aDogc3RyaW5nXTogSURpcmVjdG9yeUVudHJ5W10gfTtcbn1cblxuY2xhc3MgRmlsZVNlYXJjaEVuZ2luZSB7XG5cdHByaXZhdGUgZmlsZVBhdHRlcm4/OiBzdHJpbmc7XG5cdHByaXZhdGUgaW5jbHVkZVBhdHRlcm4/OiBnbG9iLlBhcnNlZEV4cHJlc3Npb247XG5cdHByaXZhdGUgbWF4UmVzdWx0cz86IG51bWJlcjtcblx0cHJpdmF0ZSBleGlzdHM/OiBib29sZWFuO1xuXHRwcml2YXRlIGlzTGltaXRIaXQgPSBmYWxzZTtcblx0cHJpdmF0ZSByZXN1bHRDb3VudCA9IDA7XG5cdHByaXZhdGUgaXNDYW5jZWxlZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgYWN0aXZlQ2FuY2VsbGF0aW9uVG9rZW5zOiBTZXQ8Q2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U+O1xuXG5cdHByaXZhdGUgZ2xvYmFsRXhjbHVkZVBhdHRlcm4/OiBnbG9iLlBhcnNlZEV4cHJlc3Npb247XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBjb25maWc6IElGaWxlUXVlcnksIHByaXZhdGUgcHJvdmlkZXI6IEZpbGVTZWFyY2hQcm92aWRlcjIsIHByaXZhdGUgc2Vzc2lvbkxpZmVjeWNsZT86IFNlc3Npb25MaWZlY3ljbGUpIHtcblx0XHR0aGlzLmZpbGVQYXR0ZXJuID0gY29uZmlnLmZpbGVQYXR0ZXJuO1xuXHRcdHRoaXMuaW5jbHVkZVBhdHRlcm4gPSBjb25maWcuaW5jbHVkZVBhdHRlcm4gJiYgZ2xvYi5wYXJzZShjb25maWcuaW5jbHVkZVBhdHRlcm4pO1xuXHRcdHRoaXMubWF4UmVzdWx0cyA9IGNvbmZpZy5tYXhSZXN1bHRzIHx8IHVuZGVmaW5lZDtcblx0XHR0aGlzLmV4aXN0cyA9IGNvbmZpZy5leGlzdHM7XG5cdFx0dGhpcy5hY3RpdmVDYW5jZWxsYXRpb25Ub2tlbnMgPSBuZXcgU2V0PENhbmNlbGxhdGlvblRva2VuU291cmNlPigpO1xuXG5cdFx0dGhpcy5nbG9iYWxFeGNsdWRlUGF0dGVybiA9IGNvbmZpZy5leGNsdWRlUGF0dGVybiAmJiBnbG9iLnBhcnNlKGNvbmZpZy5leGNsdWRlUGF0dGVybik7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5pc0NhbmNlbGVkID0gdHJ1ZTtcblx0XHR0aGlzLmFjdGl2ZUNhbmNlbGxhdGlvblRva2Vucy5mb3JFYWNoKHQgPT4gdC5jYW5jZWwoKSk7XG5cdFx0dGhpcy5hY3RpdmVDYW5jZWxsYXRpb25Ub2tlbnMgPSBuZXcgU2V0KCk7XG5cdH1cblxuXHRzZWFyY2goX29uUmVzdWx0OiAobWF0Y2g6IElJbnRlcm5hbEZpbGVNYXRjaCkgPT4gdm9pZCk6IFByb21pc2U8SUludGVybmFsU2VhcmNoQ29tcGxldGU+IHtcblx0XHRjb25zdCBmb2xkZXJRdWVyaWVzID0gdGhpcy5jb25maWcuZm9sZGVyUXVlcmllcyB8fCBbXTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRjb25zdCBvblJlc3VsdCA9IChtYXRjaDogSUludGVybmFsRmlsZU1hdGNoKSA9PiB7XG5cdFx0XHRcdHRoaXMucmVzdWx0Q291bnQrKztcblx0XHRcdFx0X29uUmVzdWx0KG1hdGNoKTtcblx0XHRcdH07XG5cblx0XHRcdC8vIFN1cHBvcnQgdGhhdCB0aGUgZmlsZSBwYXR0ZXJuIGlzIGEgZnVsbCBwYXRoIHRvIGEgZmlsZSB0aGF0IGV4aXN0c1xuXHRcdFx0aWYgKHRoaXMuaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSh7IGxpbWl0SGl0OiB0aGlzLmlzTGltaXRIaXQgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZvciBlYWNoIGV4dHJhIGZpbGVcblx0XHRcdGlmICh0aGlzLmNvbmZpZy5leHRyYUZpbGVSZXNvdXJjZXMpIHtcblx0XHRcdFx0dGhpcy5jb25maWcuZXh0cmFGaWxlUmVzb3VyY2VzXG5cdFx0XHRcdFx0LmZvckVhY2goZXh0cmFGaWxlID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGV4dHJhRmlsZVN0ciA9IGV4dHJhRmlsZS50b1N0cmluZygpOyAvLyA/XG5cdFx0XHRcdFx0XHRjb25zdCBiYXNlbmFtZSA9IHBhdGguYmFzZW5hbWUoZXh0cmFGaWxlU3RyKTtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmdsb2JhbEV4Y2x1ZGVQYXR0ZXJuICYmIHRoaXMuZ2xvYmFsRXhjbHVkZVBhdHRlcm4oZXh0cmFGaWxlU3RyLCBiYXNlbmFtZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBleGNsdWRlZFxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBGaWxlOiBDaGVjayBmb3IgbWF0Y2ggb24gZmlsZSBwYXR0ZXJuIGFuZCBpbmNsdWRlIHBhdHRlcm5cblx0XHRcdFx0XHRcdHRoaXMubWF0Y2hGaWxlKG9uUmVzdWx0LCB7IGJhc2U6IGV4dHJhRmlsZSwgYmFzZW5hbWUgfSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZvciBlYWNoIHJvb3QgZm9sZGVyJ1xuXG5cdFx0XHQvLyBORVc6IGNhbiBqdXN0IGNhbGwgd2l0aCBhbiBhcnJheSBvZiBmb2xkZXIgaW5mb1xuXHRcdFx0dGhpcy5kb1NlYXJjaChmb2xkZXJRdWVyaWVzLCBvblJlc3VsdCkudGhlbihzdGF0cyA9PiB7XG5cdFx0XHRcdHJlc29sdmUoe1xuXHRcdFx0XHRcdGxpbWl0SGl0OiB0aGlzLmlzTGltaXRIaXQsXG5cdFx0XHRcdFx0c3RhdHM6IHN0YXRzIHx8IHVuZGVmaW5lZCAvLyBPbmx5IGxvb2tpbmcgYXQgc2luZ2xlLWZvbGRlciB3b3Jrc3BhY2Ugc3RhdHMuLi5cblx0XHRcdFx0fSk7XG5cdFx0XHR9LCAoZXJyOiBFcnJvcikgPT4ge1xuXHRcdFx0XHRyZWplY3QobmV3IEVycm9yKHRvRXJyb3JNZXNzYWdlKGVycikpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIGRvU2VhcmNoKGZxczogSUZvbGRlclF1ZXJ5PFVSST5bXSwgb25SZXN1bHQ6IChtYXRjaDogSUludGVybmFsRmlsZU1hdGNoKSA9PiB2b2lkKTogUHJvbWlzZTxJRmlsZVNlYXJjaFByb3ZpZGVyU3RhdHMgfCBudWxsPiB7XG5cdFx0Y29uc3QgY2FuY2VsbGF0aW9uID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgZm9sZGVyT3B0aW9ucyA9IGZxcy5tYXAoZnEgPT4gdGhpcy5nZXRTZWFyY2hPcHRpb25zRm9yRm9sZGVyKGZxKSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMucHJvdmlkZXIgaW5zdGFuY2VvZiBPbGRGaWxlU2VhcmNoUHJvdmlkZXJDb252ZXJ0ZXIgPyB0aGlzLnNlc3Npb25MaWZlY3ljbGU/LnRva2VuU291cmNlLnRva2VuIDogdGhpcy5zZXNzaW9uTGlmZWN5Y2xlPy5vYmo7XG5cdFx0Y29uc3Qgb3B0aW9uczogRmlsZVNlYXJjaFByb3ZpZGVyT3B0aW9ucyA9IHtcblx0XHRcdGZvbGRlck9wdGlvbnMsXG5cdFx0XHRtYXhSZXN1bHRzOiB0aGlzLmNvbmZpZy5tYXhSZXN1bHRzID8/IERFRkFVTFRfTUFYX1NFQVJDSF9SRVNVTFRTLFxuXHRcdFx0c2Vzc2lvblxuXHRcdH07XG5cblxuXHRcdGNvbnN0IGdldEZvbGRlclF1ZXJ5SW5mbyA9IChmcTogSUZvbGRlclF1ZXJ5KSA9PiB7XG5cdFx0XHRjb25zdCBxdWVyeVRlc3RlciA9IG5ldyBRdWVyeUdsb2JUZXN0ZXIodGhpcy5jb25maWcsIGZxKTtcblx0XHRcdGNvbnN0IG5vU2libGluZ3NDbGF1c2VzID0gIXF1ZXJ5VGVzdGVyLmhhc1NpYmxpbmdFeGNsdWRlQ2xhdXNlcygpO1xuXHRcdFx0cmV0dXJuIHsgcXVlcnlUZXN0ZXIsIG5vU2libGluZ3NDbGF1c2VzLCBmb2xkZXI6IGZxLmZvbGRlciwgdHJlZTogdGhpcy5pbml0RGlyZWN0b3J5VHJlZSgpIH07XG5cdFx0fTtcblxuXHRcdGNvbnN0IGZvbGRlck1hcHBpbmdzOiBGb2xkZXJRdWVyeVNlYXJjaFRyZWU8Rm9sZGVyUXVlcnlJbmZvPiA9IG5ldyBGb2xkZXJRdWVyeVNlYXJjaFRyZWU8Rm9sZGVyUXVlcnlJbmZvPihmcXMsIGdldEZvbGRlclF1ZXJ5SW5mbyk7XG5cblx0XHRsZXQgcHJvdmlkZXJTVzogU3RvcFdhdGNoO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuYWN0aXZlQ2FuY2VsbGF0aW9uVG9rZW5zLmFkZChjYW5jZWxsYXRpb24pO1xuXG5cdFx0XHRwcm92aWRlclNXID0gU3RvcFdhdGNoLmNyZWF0ZSgpO1xuXHRcdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMucHJvdmlkZXIucHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKFxuXHRcdFx0XHR0aGlzLmNvbmZpZy5maWxlUGF0dGVybiB8fCAnJyxcblx0XHRcdFx0b3B0aW9ucyxcblx0XHRcdFx0Y2FuY2VsbGF0aW9uLnRva2VuKTtcblx0XHRcdGNvbnN0IHByb3ZpZGVyVGltZSA9IHByb3ZpZGVyU1cuZWxhcHNlZCgpO1xuXHRcdFx0Y29uc3QgcG9zdFByb2Nlc3NTVyA9IFN0b3BXYXRjaC5jcmVhdGUoKTtcblxuXHRcdFx0aWYgKHRoaXMuaXNDYW5jZWxlZCAmJiAhdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cblx0XHRcdGlmIChyZXN1bHRzKSB7XG5cdFx0XHRcdHJlc3VsdHMuZm9yRWFjaChyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGZxRm9sZGVySW5mbyA9IGZvbGRlck1hcHBpbmdzLmZpbmRRdWVyeUZyYWdtZW50QXdhcmVTdWJzdHIocmVzdWx0KSE7XG5cdFx0XHRcdFx0Y29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5wb3NpeC5yZWxhdGl2ZShmcUZvbGRlckluZm8uZm9sZGVyLnBhdGgsIHJlc3VsdC5wYXRoKTtcblxuXHRcdFx0XHRcdGlmIChmcUZvbGRlckluZm8ubm9TaWJsaW5nc0NsYXVzZXMpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShyZXN1bHQucGF0aCk7XG5cdFx0XHRcdFx0XHR0aGlzLm1hdGNoRmlsZShvblJlc3VsdCwgeyBiYXNlOiBmcUZvbGRlckluZm8uZm9sZGVyLCByZWxhdGl2ZVBhdGgsIGJhc2VuYW1lIH0pO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gVE9ETzogT3B0aW1pemUgc2libGluZ3MgY2xhdXNlcyB3aXRoIHJpcGdyZXAgaGVyZS5cblx0XHRcdFx0XHR0aGlzLmFkZERpcmVjdG9yeUVudHJpZXMoZnFGb2xkZXJJbmZvLnRyZWUsIGZxRm9sZGVySW5mby5mb2xkZXIsIHJlbGF0aXZlUGF0aCwgb25SZXN1bHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuaXNDYW5jZWxlZCAmJiAhdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRmb2xkZXJNYXBwaW5ncy5mb3JFYWNoRm9sZGVyUXVlcnlJbmZvKGUgPT4ge1xuXHRcdFx0XHR0aGlzLm1hdGNoRGlyZWN0b3J5VHJlZShlLnRyZWUsIGUucXVlcnlUZXN0ZXIsIG9uUmVzdWx0KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRwcm92aWRlclRpbWUsXG5cdFx0XHRcdHBvc3RQcm9jZXNzVGltZTogcG9zdFByb2Nlc3NTVy5lbGFwc2VkKClcblx0XHRcdH07XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNhbmNlbGxhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLmFjdGl2ZUNhbmNlbGxhdGlvblRva2Vucy5kZWxldGUoY2FuY2VsbGF0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFNlYXJjaE9wdGlvbnNGb3JGb2xkZXIoZnE6IElGb2xkZXJRdWVyeTxVUkk+KTogRmlsZVNlYXJjaFByb3ZpZGVyRm9sZGVyT3B0aW9ucyB7XG5cdFx0Y29uc3QgaW5jbHVkZXMgPSByZXNvbHZlUGF0dGVybnNGb3JQcm92aWRlcih0aGlzLmNvbmZpZy5pbmNsdWRlUGF0dGVybiwgZnEuaW5jbHVkZVBhdHRlcm4pO1xuXHRcdGxldCBleGNsdWRlUGF0dGVybiA9IGZxLmV4Y2x1ZGVQYXR0ZXJuPy5tYXAoZSA9PiAoe1xuXHRcdFx0Zm9sZGVyOiBlLmZvbGRlcixcblx0XHRcdHBhdHRlcm5zOiByZXNvbHZlUGF0dGVybnNGb3JQcm92aWRlcih0aGlzLmNvbmZpZy5leGNsdWRlUGF0dGVybiwgZS5wYXR0ZXJuKVxuXHRcdH0pKTtcblx0XHRpZiAoIWV4Y2x1ZGVQYXR0ZXJuPy5sZW5ndGgpIHtcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuID0gW3tcblx0XHRcdFx0Zm9sZGVyOiB1bmRlZmluZWQsXG5cdFx0XHRcdHBhdHRlcm5zOiByZXNvbHZlUGF0dGVybnNGb3JQcm92aWRlcih0aGlzLmNvbmZpZy5leGNsdWRlUGF0dGVybiwgdW5kZWZpbmVkKVxuXHRcdFx0fV07XG5cdFx0fVxuXHRcdGNvbnN0IGV4Y2x1ZGVzID0gZXhjbHVkZVRvR2xvYlBhdHRlcm4oZXhjbHVkZVBhdHRlcm4pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGZvbGRlcjogZnEuZm9sZGVyLFxuXHRcdFx0ZXhjbHVkZXMsXG5cdFx0XHRpbmNsdWRlcyxcblx0XHRcdHVzZUlnbm9yZUZpbGVzOiB7XG5cdFx0XHRcdGxvY2FsOiAhZnEuZGlzcmVnYXJkSWdub3JlRmlsZXMsXG5cdFx0XHRcdHBhcmVudDogIWZxLmRpc3JlZ2FyZFBhcmVudElnbm9yZUZpbGVzLFxuXHRcdFx0XHRnbG9iYWw6ICFmcS5kaXNyZWdhcmRHbG9iYWxJZ25vcmVGaWxlc1xuXHRcdFx0fSxcblx0XHRcdGZvbGxvd1N5bWxpbmtzOiAhZnEuaWdub3JlU3ltbGlua3MsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdERpcmVjdG9yeVRyZWUoKTogSURpcmVjdG9yeVRyZWUge1xuXHRcdGNvbnN0IHRyZWU6IElEaXJlY3RvcnlUcmVlID0ge1xuXHRcdFx0cm9vdEVudHJpZXM6IFtdLFxuXHRcdFx0cGF0aFRvRW50cmllczogT2JqZWN0LmNyZWF0ZShudWxsKVxuXHRcdH07XG5cdFx0dHJlZS5wYXRoVG9FbnRyaWVzWycuJ10gPSB0cmVlLnJvb3RFbnRyaWVzO1xuXHRcdHJldHVybiB0cmVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGREaXJlY3RvcnlFbnRyaWVzKHsgcGF0aFRvRW50cmllcyB9OiBJRGlyZWN0b3J5VHJlZSwgYmFzZTogVVJJLCByZWxhdGl2ZUZpbGU6IHN0cmluZywgb25SZXN1bHQ6IChyZXN1bHQ6IElJbnRlcm5hbEZpbGVNYXRjaCkgPT4gdm9pZCkge1xuXHRcdC8vIFN1cHBvcnQgcmVsYXRpdmUgcGF0aHMgdG8gZmlsZXMgZnJvbSBhIHJvb3QgcmVzb3VyY2UgKGlnbm9yZXMgZXhjbHVkZXMpXG5cdFx0aWYgKHJlbGF0aXZlRmlsZSA9PT0gdGhpcy5maWxlUGF0dGVybikge1xuXHRcdFx0Y29uc3QgYmFzZW5hbWUgPSBwYXRoLmJhc2VuYW1lKHRoaXMuZmlsZVBhdHRlcm4pO1xuXHRcdFx0dGhpcy5tYXRjaEZpbGUob25SZXN1bHQsIHsgYmFzZTogYmFzZSwgcmVsYXRpdmVQYXRoOiB0aGlzLmZpbGVQYXR0ZXJuLCBiYXNlbmFtZSB9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBhZGQocmVsYXRpdmVQYXRoOiBzdHJpbmcpIHtcblx0XHRcdGNvbnN0IGJhc2VuYW1lID0gcGF0aC5iYXNlbmFtZShyZWxhdGl2ZVBhdGgpO1xuXHRcdFx0Y29uc3QgZGlybmFtZSA9IHBhdGguZGlybmFtZShyZWxhdGl2ZVBhdGgpO1xuXHRcdFx0bGV0IGVudHJpZXMgPSBwYXRoVG9FbnRyaWVzW2Rpcm5hbWVdO1xuXHRcdFx0aWYgKCFlbnRyaWVzKSB7XG5cdFx0XHRcdGVudHJpZXMgPSBwYXRoVG9FbnRyaWVzW2Rpcm5hbWVdID0gW107XG5cdFx0XHRcdGFkZChkaXJuYW1lKTtcblx0XHRcdH1cblx0XHRcdGVudHJpZXMucHVzaCh7XG5cdFx0XHRcdGJhc2UsXG5cdFx0XHRcdHJlbGF0aXZlUGF0aCxcblx0XHRcdFx0YmFzZW5hbWVcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGFkZChyZWxhdGl2ZUZpbGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaERpcmVjdG9yeVRyZWUoeyByb290RW50cmllcywgcGF0aFRvRW50cmllcyB9OiBJRGlyZWN0b3J5VHJlZSwgcXVlcnlUZXN0ZXI6IFF1ZXJ5R2xvYlRlc3Rlciwgb25SZXN1bHQ6IChyZXN1bHQ6IElJbnRlcm5hbEZpbGVNYXRjaCkgPT4gdm9pZCkge1xuXHRcdGNvbnN0IHNlbGYgPSB0aGlzO1xuXHRcdGNvbnN0IGZpbGVQYXR0ZXJuID0gdGhpcy5maWxlUGF0dGVybjtcblx0XHRmdW5jdGlvbiBtYXRjaERpcmVjdG9yeShlbnRyaWVzOiBJRGlyZWN0b3J5RW50cnlbXSkge1xuXHRcdFx0Y29uc3QgaGFzU2libGluZyA9IGhhc1NpYmxpbmdGbigoKSA9PiBlbnRyaWVzLm1hcChlbnRyeSA9PiBlbnRyeS5iYXNlbmFtZSkpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIG4gPSBlbnRyaWVzLmxlbmd0aDsgaSA8IG47IGkrKykge1xuXHRcdFx0XHRjb25zdCBlbnRyeSA9IGVudHJpZXNbaV07XG5cdFx0XHRcdGNvbnN0IHsgcmVsYXRpdmVQYXRoLCBiYXNlbmFtZSB9ID0gZW50cnk7XG5cblx0XHRcdFx0Ly8gQ2hlY2sgZXhjbHVkZSBwYXR0ZXJuXG5cdFx0XHRcdC8vIElmIHRoZSB1c2VyIHNlYXJjaGVzIGZvciB0aGUgZXhhY3QgZmlsZSBuYW1lLCB3ZSBhZGp1c3QgdGhlIGdsb2IgbWF0Y2hpbmdcblx0XHRcdFx0Ly8gdG8gaWdub3JlIGZpbHRlcmluZyBieSBzaWJsaW5ncyBiZWNhdXNlIHRoZSB1c2VyIHNlZW1zIHRvIGtub3cgd2hhdCB0aGV5XG5cdFx0XHRcdC8vIGFyZSBzZWFyY2hpbmcgZm9yIGFuZCB3ZSB3YW50IHRvIGluY2x1ZGUgdGhlIHJlc3VsdCBpbiB0aGF0IGNhc2UgYW55d2F5XG5cdFx0XHRcdGlmIChxdWVyeVRlc3Rlci5tYXRjaGVzRXhjbHVkZXNTeW5jKHJlbGF0aXZlUGF0aCwgYmFzZW5hbWUsIGZpbGVQYXR0ZXJuICE9PSBiYXNlbmFtZSA/IGhhc1NpYmxpbmcgOiB1bmRlZmluZWQpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzdWIgPSBwYXRoVG9FbnRyaWVzW3JlbGF0aXZlUGF0aF07XG5cdFx0XHRcdGlmIChzdWIpIHtcblx0XHRcdFx0XHRtYXRjaERpcmVjdG9yeShzdWIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChyZWxhdGl2ZVBhdGggPT09IGZpbGVQYXR0ZXJuKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTsgLy8gaWdub3JlIGZpbGUgaWYgaXRzIHBhdGggbWF0Y2hlcyB3aXRoIHRoZSBmaWxlIHBhdHRlcm4gYmVjYXVzZSB0aGF0IGlzIGFscmVhZHkgbWF0Y2hlZCBhYm92ZVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHNlbGYubWF0Y2hGaWxlKG9uUmVzdWx0LCBlbnRyeSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoc2VsZi5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0bWF0Y2hEaXJlY3Rvcnkocm9vdEVudHJpZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBtYXRjaEZpbGUob25SZXN1bHQ6IChyZXN1bHQ6IElJbnRlcm5hbEZpbGVNYXRjaCkgPT4gdm9pZCwgY2FuZGlkYXRlOiBJSW50ZXJuYWxGaWxlTWF0Y2gpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaW5jbHVkZVBhdHRlcm4gfHwgKGNhbmRpZGF0ZS5yZWxhdGl2ZVBhdGggJiYgdGhpcy5pbmNsdWRlUGF0dGVybihjYW5kaWRhdGUucmVsYXRpdmVQYXRoLCBjYW5kaWRhdGUuYmFzZW5hbWUpKSkge1xuXHRcdFx0aWYgKHRoaXMuZXhpc3RzIHx8ICh0aGlzLm1heFJlc3VsdHMgJiYgdGhpcy5yZXN1bHRDb3VudCA+PSB0aGlzLm1heFJlc3VsdHMpKSB7XG5cdFx0XHRcdHRoaXMuaXNMaW1pdEhpdCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdGhpcy5pc0xpbWl0SGl0KSB7XG5cdFx0XHRcdG9uUmVzdWx0KGNhbmRpZGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmludGVyZmFjZSBJSW50ZXJuYWxTZWFyY2hDb21wbGV0ZSB7XG5cdGxpbWl0SGl0OiBib29sZWFuO1xuXHRzdGF0cz86IElGaWxlU2VhcmNoUHJvdmlkZXJTdGF0cztcbn1cblxuLyoqXG4gKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHksIHN0b3JlIGJvdGggYSBjYW5jZWxsYXRpb24gdG9rZW4gYW5kIGEgc2Vzc2lvbiBvYmplY3QuIFRoZSBzZXNzaW9uIG9iamVjdCBpcyB0aGUgbmV3IGltcGxlbWVudGF0aW9uLCB3aGVyZVxuICovXG5jbGFzcyBTZXNzaW9uTGlmZWN5Y2xlIHtcblx0cHJpdmF0ZSBfb2JqOiBvYmplY3QgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyByZWFkb25seSB0b2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fb2JqID0gbmV3IE9iamVjdCgpO1xuXHRcdHRoaXMudG9rZW5Tb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgb2JqKCkge1xuXHRcdGlmICh0aGlzLl9vYmopIHtcblx0XHRcdHJldHVybiB0aGlzLl9vYmo7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKCdTZXNzaW9uIG9iamVjdCBoYXMgYmVlbiBkZXJlZmVyZW5jZWQuJyk7XG5cdH1cblxuXHRjYW5jZWwoKSB7XG5cdFx0dGhpcy50b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHR0aGlzLl9vYmogPSB1bmRlZmluZWQ7IC8vIGRlcmVmZXJlbmNlXG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVTZWFyY2hNYW5hZ2VyIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBCQVRDSF9TSVpFID0gNTEyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgU2Vzc2lvbkxpZmVjeWNsZT4oKTtcblxuXHRmaWxlU2VhcmNoKGNvbmZpZzogSUZpbGVRdWVyeSwgcHJvdmlkZXI6IEZpbGVTZWFyY2hQcm92aWRlcjIsIG9uQmF0Y2g6IChtYXRjaGVzOiBJRmlsZU1hdGNoW10pID0+IHZvaWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlU3RhdHM+IHtcblx0XHRjb25zdCBzZXNzaW9uVG9rZW5Tb3VyY2UgPSB0aGlzLmdldFNlc3Npb25Ub2tlblNvdXJjZShjb25maWcuY2FjaGVLZXkpO1xuXHRcdGNvbnN0IGVuZ2luZSA9IG5ldyBGaWxlU2VhcmNoRW5naW5lKGNvbmZpZywgcHJvdmlkZXIsIHNlc3Npb25Ub2tlblNvdXJjZSk7XG5cblx0XHRsZXQgcmVzdWx0Q291bnQgPSAwO1xuXHRcdGNvbnN0IG9uSW50ZXJuYWxSZXN1bHQgPSAoYmF0Y2g6IElJbnRlcm5hbEZpbGVNYXRjaFtdKSA9PiB7XG5cdFx0XHRyZXN1bHRDb3VudCArPSBiYXRjaC5sZW5ndGg7XG5cdFx0XHRvbkJhdGNoKGJhdGNoLm1hcChtID0+IHRoaXMucmF3TWF0Y2hUb1NlYXJjaEl0ZW0obSkpKTtcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHRoaXMuZG9TZWFyY2goZW5naW5lLCBGaWxlU2VhcmNoTWFuYWdlci5CQVRDSF9TSVpFLCBvbkludGVybmFsUmVzdWx0LCB0b2tlbikudGhlbihcblx0XHRcdHJlc3VsdCA9PiB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0bGltaXRIaXQ6IHJlc3VsdC5saW1pdEhpdCxcblx0XHRcdFx0XHRzdGF0czogcmVzdWx0LnN0YXRzID8ge1xuXHRcdFx0XHRcdFx0ZnJvbUNhY2hlOiBmYWxzZSxcblx0XHRcdFx0XHRcdHR5cGU6ICdmaWxlU2VhcmNoUHJvdmlkZXInLFxuXHRcdFx0XHRcdFx0cmVzdWx0Q291bnQsXG5cdFx0XHRcdFx0XHRkZXRhaWxTdGF0czogcmVzdWx0LnN0YXRzXG5cdFx0XHRcdFx0fSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRtZXNzYWdlczogW11cblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHR9XG5cblx0Y2xlYXJDYWNoZShjYWNoZUtleTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Ly8gY2FuY2VsIHRoZSB0b2tlblxuXHRcdHRoaXMuc2Vzc2lvbnMuZ2V0KGNhY2hlS2V5KT8uY2FuY2VsKCk7XG5cdFx0Ly8gd2l0aCBubyByZWZlcmVuY2UgdG8gdGhpcywgaXQgd2lsbCBiZSByZW1vdmVkIGZyb20gV2Vha01hcHNcblx0XHR0aGlzLnNlc3Npb25zLmRlbGV0ZShjYWNoZUtleSk7XG5cdH1cblxuXHRwcml2YXRlIGdldFNlc3Npb25Ub2tlblNvdXJjZShjYWNoZUtleTogc3RyaW5nIHwgdW5kZWZpbmVkKTogU2Vzc2lvbkxpZmVjeWNsZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFjYWNoZUtleSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuc2Vzc2lvbnMuaGFzKGNhY2hlS2V5KSkge1xuXHRcdFx0dGhpcy5zZXNzaW9ucy5zZXQoY2FjaGVLZXksIG5ldyBTZXNzaW9uTGlmZWN5Y2xlKCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnNlc3Npb25zLmdldChjYWNoZUtleSk7XG5cdH1cblxuXHRwcml2YXRlIHJhd01hdGNoVG9TZWFyY2hJdGVtKG1hdGNoOiBJSW50ZXJuYWxGaWxlTWF0Y2gpOiBJRmlsZU1hdGNoIHtcblx0XHRpZiAobWF0Y2gucmVsYXRpdmVQYXRoKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZTogcmVzb3VyY2VzLmpvaW5QYXRoKG1hdGNoLmJhc2UsIG1hdGNoLnJlbGF0aXZlUGF0aClcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGV4dHJhRmlsZVJlc291cmNlc1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVzb3VyY2U6IG1hdGNoLmJhc2Vcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBkb1NlYXJjaChlbmdpbmU6IEZpbGVTZWFyY2hFbmdpbmUsIGJhdGNoU2l6ZTogbnVtYmVyLCBvblJlc3VsdEJhdGNoOiAobWF0Y2hlczogSUludGVybmFsRmlsZU1hdGNoW10pID0+IHZvaWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUludGVybmFsU2VhcmNoQ29tcGxldGU+IHtcblx0XHRjb25zdCBsaXN0ZW5lciA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdGVuZ2luZS5jYW5jZWwoKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IF9vblJlc3VsdCA9IChtYXRjaDogSUludGVybmFsRmlsZU1hdGNoKSA9PiB7XG5cdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0YmF0Y2gucHVzaChtYXRjaCk7XG5cdFx0XHRcdGlmIChiYXRjaFNpemUgPiAwICYmIGJhdGNoLmxlbmd0aCA+PSBiYXRjaFNpemUpIHtcblx0XHRcdFx0XHRvblJlc3VsdEJhdGNoKGJhdGNoKTtcblx0XHRcdFx0XHRiYXRjaCA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGxldCBiYXRjaDogSUludGVybmFsRmlsZU1hdGNoW10gPSBbXTtcblx0XHRyZXR1cm4gZW5naW5lLnNlYXJjaChfb25SZXN1bHQpLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdGlmIChiYXRjaC5sZW5ndGgpIHtcblx0XHRcdFx0b25SZXN1bHRCYXRjaChiYXRjaCk7XG5cdFx0XHR9XG5cblx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSwgZXJyb3IgPT4ge1xuXHRcdFx0aWYgKGJhdGNoLmxlbmd0aCkge1xuXHRcdFx0XHRvblJlc3VsdEJhdGNoKGJhdGNoKTtcblx0XHRcdH1cblxuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxVQUFVO0FBQ3RCLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLHNCQUFzQjtBQUMvQixZQUFZLFVBQVU7QUFDdEIsWUFBWSxlQUFlO0FBQzNCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQStGLGlCQUFpQiw0QkFBNEIsY0FBYyxzQkFBc0Isa0NBQWtDO0FBRWxOLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsNkJBQTZCO0FBNEJ0QyxNQUFNLGlCQUFpQjtBQUFBLEVBYXRCLFlBQW9CLFFBQTRCLFVBQXVDLGtCQUFxQztBQUF4RztBQUE0QjtBQUF1QztBQVJ2RixTQUFRLGFBQWE7QUFDckIsU0FBUSxjQUFjO0FBQ3RCLFNBQVEsYUFBYTtBQU9wQixTQUFLLGNBQWMsT0FBTztBQUMxQixTQUFLLGlCQUFpQixPQUFPLGtCQUFrQixLQUFLLE1BQU0sT0FBTyxjQUFjO0FBQy9FLFNBQUssYUFBYSxPQUFPLGNBQWM7QUFDdkMsU0FBSyxTQUFTLE9BQU87QUFDckIsU0FBSywyQkFBMkIsb0JBQUksSUFBNkI7QUFFakUsU0FBSyx1QkFBdUIsT0FBTyxrQkFBa0IsS0FBSyxNQUFNLE9BQU8s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
