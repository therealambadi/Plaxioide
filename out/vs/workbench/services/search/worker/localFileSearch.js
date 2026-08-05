import * as glob from "../../../../base/common/glob.js";
import { URI } from "../../../../base/common/uri.js";
import { LocalFileSearchWorkerHost } from "../common/localFileSearchWorkerTypes.js";
import * as paths from "../../../../base/common/path.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { getFileResults } from "../common/getFileResults.js";
import { IgnoreFile } from "../common/ignoreFile.js";
import { createRegExp } from "../../../../base/common/strings.js";
import { Promises } from "../../../../base/common/async.js";
import { ExtUri } from "../../../../base/common/resources.js";
import { revive } from "../../../../base/common/marshalling.js";
const PERF = false;
const globalStart = +/* @__PURE__ */ new Date();
const itrcount = {};
const time = async (name, task) => {
  if (!PERF) {
    return task();
  }
  const start = Date.now();
  const itr = (itrcount[name] ?? 0) + 1;
  console.info(name, itr, "starting", Math.round((start - globalStart) * 10) / 1e4);
  itrcount[name] = itr;
  const r = await task();
  const end = Date.now();
  console.info(name, itr, "took", end - start);
  return r;
};
function create(workerServer) {
  return new LocalFileSearchWorker(workerServer);
}
class LocalFileSearchWorker {
  constructor(workerServer) {
    this.cancellationTokens = /* @__PURE__ */ new Map();
    this.host = LocalFileSearchWorkerHost.getChannel(workerServer);
  }
  $cancelQuery(queryId) {
    this.cancellationTokens.get(queryId)?.cancel();
  }
  registerCancellationToken(queryId) {
    const source = new CancellationTokenSource();
    this.cancellationTokens.set(queryId, source);
    return source;
  }
  async $listDirectory(handle, query, folderQuery, ignorePathCasing, queryId) {
    const revivedFolderQuery = reviveFolderQuery(folderQuery);
    const extUri = new ExtUri(() => ignorePathCasing);
    const token = this.registerCancellationToken(queryId);
    const entries = [];
    let limitHit = false;
    let count = 0;
    const max = query.maxResults || 512;
    const filePatternMatcher = query.filePattern ? (name) => query.filePattern.split("").every((c) => name.includes(c)) : (name) => true;
    await time("listDirectory", () => this.walkFolderQuery(handle, reviveQueryProps(query), revivedFolderQuery, extUri, (file) => {
      if (!filePatternMatcher(file.name)) {
        return;
      }
      count++;
      if (max && count > max) {
        limitHit = true;
        token.cancel();
      }
      return entries.push(file.path);
    }, token.token));
    return {
      results: entries,
      limitHit
    };
  }
  async $searchDirectory(handle, query, folderQuery, ignorePathCasing, queryId) {
    const revivedQuery = reviveFolderQuery(folderQuery);
    const extUri = new ExtUri(() => ignorePathCasing);
    return time("searchInFiles", async () => {
      const token = this.registerCancellationToken(queryId);
      const results = [];
      const pattern = createSearchRegExp(query.contentPattern);
      const onGoingProcesses = [];
      let fileCount = 0;
      let resultCount = 0;
      const limitHit = false;
      const processFile = async (file) => {
        if (token.token.isCancellationRequested) {
          return;
        }
        fileCount++;
        const contents = await file.resolve();
        if (token.token.isCancellationRequested) {
          return;
        }
        const bytes = new Uint8Array(contents);
        const fileResults = getFileResults(bytes, pattern, {
          surroundingContext: query.surroundingContext ?? 0,
          previewOptions: query.previewOptions,
          remainingResultQuota: query.maxResults ? query.maxResults - resultCount : 1e4
        });
        if (fileResults.length) {
          resultCount += fileResults.length;
          if (query.maxResults && resultCount > query.maxResults) {
            token.cancel();
          }
          const match = {
            resource: URI.joinPath(revivedQuery.folder, file.path),
            results: fileResults
          };
          this.host.$sendTextSearchMatch(match, queryId);
          results.push(match);
        }
      };
      await time(
        "walkFolderToResolve",
        () => this.walkFolderQuery(handle, reviveQueryProps(query), revivedQuery, extUri, async (file) => onGoingProcesses.push(processFile(file)), token.token)
      );
      await time("resolveOngoingProcesses", () => Promise.all(onGoingProcesses));
      if (PERF) {
        console.log("Searched in", fileCount, "files");
      }
      return {
        results,
        limitHit
      };
    });
  }
  async walkFolderQuery(handle, queryProps, folderQuery, extUri, onFile, token) {
    const folderExcludes = folderQuery.excludePattern?.map((excludePattern) => glob.parse(excludePattern.pattern ?? {}, { trimForExclusions: true }));
    const evalFolderExcludes = (path, basename, hasSibling) => {
      return folderExcludes?.some((folderExclude) => {
        return folderExclude(path, basename, hasSibling);
      });
    };
    const isFolderExcluded = (path, basename, hasSibling) => {
      path = path.slice(1);
      if (evalFolderExcludes(path, basename, hasSibling)) {
        return true;
      }
      if (pathExcludedInQuery(queryProps, path)) {
        return true;
      }
      return false;
    };
    const isFileIncluded = (path, basename, hasSibling) => {
      path = path.slice(1);
      if (evalFolderExcludes(path, basename, hasSibling)) {
        return false;
      }
      if (!pathIncludedInQuery(queryProps, path, extUri)) {
        return false;
      }
      return true;
    };
    const processFile = (file, prior) => {
      const resolved = {
        type: "file",
        name: file.name,
        path: prior,
        resolve: () => file.getFile().then((r) => r.arrayBuffer())
      };
      return resolved;
    };
    const isFileSystemDirectoryHandle = (handle2) => {
      return handle2.kind === "directory";
    };
    const isFileSystemFileHandle = (handle2) => {
      return handle2.kind === "file";
    };
    const processDirectory = async (directory, prior, ignoreFile) => {
      if (!folderQuery.disregardIgnoreFiles) {
        const ignoreFiles = await Promise.all([
          directory.getFileHandle(".gitignore").catch((e) => void 0),
          directory.getFileHandle(".ignore").catch((e) => void 0)
        ]);
        await Promise.all(ignoreFiles.map(async (file) => {
          if (!file) {
            return;
          }
          const ignoreContents = new TextDecoder("utf8").decode(new Uint8Array(await (await file.getFile()).arrayBuffer()));
          ignoreFile = new IgnoreFile(ignoreContents, prior, ignoreFile);
        }));
      }
      const entries = Promises.withAsyncBody(async (c) => {
        const files = [];
        const dirs = [];
        const entries2 = [];
        const sibilings = /* @__PURE__ */ new Set();
        for await (const entry of directory.entries()) {
          entries2.push(entry);
          sibilings.add(entry[0]);
        }
        for (const [basename, handle2] of entries2) {
          if (token.isCancellationRequested) {
            break;
          }
          const path = prior + basename;
          if (ignoreFile && !ignoreFile.isPathIncludedInTraversal(path, handle2.kind === "directory")) {
            continue;
          }
          const hasSibling = (query) => sibilings.has(query);
          if (isFileSystemDirectoryHandle(handle2) && !isFolderExcluded(path, basename, hasSibling)) {
            dirs.push(processDirectory(handle2, path + "/", ignoreFile));
          } else if (isFileSystemFileHandle(handle2) && isFileIncluded(path, basename, hasSibling)) {
            files.push(processFile(handle2, path));
          }
        }
        c([...await Promise.all(dirs), ...files]);
      });
      return {
        type: "dir",
        name: directory.name,
        entries
      };
    };
    const resolveDirectory = async (directory, onFile2) => {
      if (token.isCancellationRequested) {
        return;
      }
      await Promise.all(
        (await directory.entries).sort((a, b) => -(a.type === "dir" ? 0 : 1) + (b.type === "dir" ? 0 : 1)).map(async (entry) => {
          if (entry.type === "dir") {
            return resolveDirectory(entry, onFile2);
          } else {
            return onFile2(entry);
          }
        })
      );
    };
    const processed = await time("process", () => processDirectory(handle, "/"));
    await time("resolve", () => resolveDirectory(processed, onFile));
  }
}
function createSearchRegExp(options) {
  return createRegExp(options.pattern, !!options.isRegExp, {
    wholeWord: options.isWordMatch,
    global: true,
    matchCase: options.isCaseSensitive,
    multiline: true,
    unicode: true
  });
}
function reviveFolderQuery(folderQuery) {
  return revive({
    ...revive(folderQuery),
    excludePattern: folderQuery.excludePattern?.map((ep) => ({ folder: URI.revive(ep.folder), pattern: ep.pattern })),
    folder: URI.revive(folderQuery.folder)
  });
}
function reviveQueryProps(queryProps) {
  return {
    ...queryProps,
    extraFileResources: queryProps.extraFileResources?.map((r) => URI.revive(r)),
    folderQueries: queryProps.folderQueries.map((fq) => reviveFolderQuery(fq))
  };
}
function pathExcludedInQuery(queryProps, fsPath) {
  if (queryProps.excludePattern && glob.match(queryProps.excludePattern, fsPath)) {
    return true;
  }
  return false;
}
function pathIncludedInQuery(queryProps, path, extUri) {
  if (queryProps.excludePattern && glob.match(queryProps.excludePattern, path)) {
    return false;
  }
  if (queryProps.includePattern || queryProps.usingSearchPaths) {
    if (queryProps.includePattern && glob.match(queryProps.includePattern, path)) {
      return true;
    }
    if (queryProps.usingSearchPaths) {
      return !!queryProps.folderQueries && queryProps.folderQueries.some((fq) => {
        const searchPath = fq.folder;
        const uri = URI.file(path);
        if (extUri.isEqualOrParent(uri, searchPath)) {
          const relPath = paths.relative(searchPath.path, uri.path);
          return !fq.includePattern || !!glob.match(fq.includePattern, relPath);
        } else {
          return false;
        }
      });
    }
    return false;
  }
  return true;
}
export {
  LocalFileSearchWorker,
  create
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3dvcmtlci9sb2NhbEZpbGVTZWFyY2gudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgVXJpQ29tcG9uZW50cywgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciwgSVdlYldvcmtlclNlcnZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3dvcmtlci93ZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgSUxvY2FsRmlsZVNlYXJjaFdvcmtlciwgTG9jYWxGaWxlU2VhcmNoV29ya2VySG9zdCwgSVdvcmtlckZpbGVTZWFyY2hDb21wbGV0ZSwgSVdvcmtlckZpbGVTeXN0ZW1EaXJlY3RvcnlIYW5kbGUsIElXb3JrZXJGaWxlU3lzdGVtSGFuZGxlLCBJV29ya2VyVGV4dFNlYXJjaENvbXBsZXRlIH0gZnJvbSAnLi4vY29tbW9uL2xvY2FsRmlsZVNlYXJjaFdvcmtlclR5cGVzLmpzJztcbmltcG9ydCB7IElDb21tb25RdWVyeVByb3BzLCBJRmlsZU1hdGNoLCBJRmlsZVF1ZXJ5UHJvcHMsIElGb2xkZXJRdWVyeSwgSVBhdHRlcm5JbmZvLCBJVGV4dFF1ZXJ5UHJvcHMsIH0gZnJvbSAnLi4vY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgKiBhcyBwYXRocyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRGaWxlUmVzdWx0cyB9IGZyb20gJy4uL2NvbW1vbi9nZXRGaWxlUmVzdWx0cy5qcyc7XG5pbXBvcnQgeyBJZ25vcmVGaWxlIH0gZnJvbSAnLi4vY29tbW9uL2lnbm9yZUZpbGUuanMnO1xuaW1wb3J0IHsgY3JlYXRlUmVnRXhwIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV4dFVyaSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5cbmNvbnN0IFBFUkYgPSBmYWxzZTtcblxudHlwZSBGaWxlTm9kZSA9IHtcblx0dHlwZTogJ2ZpbGUnO1xuXHRuYW1lOiBzdHJpbmc7XG5cdHBhdGg6IHN0cmluZztcblx0cmVzb2x2ZTogKCkgPT4gUHJvbWlzZTxBcnJheUJ1ZmZlcj47XG59O1xuXG50eXBlIERpck5vZGUgPSB7XG5cdHR5cGU6ICdkaXInO1xuXHRuYW1lOiBzdHJpbmc7XG5cdGVudHJpZXM6IFByb21pc2U8KERpck5vZGUgfCBGaWxlTm9kZSlbXT47XG59O1xuXG5jb25zdCBnbG9iYWxTdGFydCA9ICtuZXcgRGF0ZSgpO1xuY29uc3QgaXRyY291bnQ6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7fTtcbmNvbnN0IHRpbWUgPSBhc3luYyA8VD4obmFtZTogc3RyaW5nLCB0YXNrOiAoKSA9PiBQcm9taXNlPFQ+IHwgVCkgPT4ge1xuXHRpZiAoIVBFUkYpIHsgcmV0dXJuIHRhc2soKTsgfVxuXG5cdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblx0Y29uc3QgaXRyID0gKGl0cmNvdW50W25hbWVdID8/IDApICsgMTtcblx0Y29uc29sZS5pbmZvKG5hbWUsIGl0ciwgJ3N0YXJ0aW5nJywgTWF0aC5yb3VuZCgoc3RhcnQgLSBnbG9iYWxTdGFydCkgKiAxMCkgLyAxMDAwMCk7XG5cblx0aXRyY291bnRbbmFtZV0gPSBpdHI7XG5cdGNvbnN0IHIgPSBhd2FpdCB0YXNrKCk7XG5cdGNvbnN0IGVuZCA9IERhdGUubm93KCk7XG5cdGNvbnNvbGUuaW5mbyhuYW1lLCBpdHIsICd0b29rJywgZW5kIC0gc3RhcnQpO1xuXHRyZXR1cm4gcjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGUod29ya2VyU2VydmVyOiBJV2ViV29ya2VyU2VydmVyKTogSVdlYldvcmtlclNlcnZlclJlcXVlc3RIYW5kbGVyIHtcblx0cmV0dXJuIG5ldyBMb2NhbEZpbGVTZWFyY2hXb3JrZXIod29ya2VyU2VydmVyKTtcbn1cblxuZXhwb3J0IGNsYXNzIExvY2FsRmlsZVNlYXJjaFdvcmtlciBpbXBsZW1lbnRzIElMb2NhbEZpbGVTZWFyY2hXb3JrZXIsIElXZWJXb3JrZXJTZXJ2ZXJSZXF1ZXN0SGFuZGxlciB7XG5cdF9yZXF1ZXN0SGFuZGxlckJyYW5kOiBhbnk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBob3N0OiBMb2NhbEZpbGVTZWFyY2hXb3JrZXJIb3N0O1xuXHRjYW5jZWxsYXRpb25Ub2tlbnM6IE1hcDxudW1iZXIsIENhbmNlbGxhdGlvblRva2VuU291cmNlPiA9IG5ldyBNYXAoKTtcblxuXHRjb25zdHJ1Y3Rvcih3b3JrZXJTZXJ2ZXI6IElXZWJXb3JrZXJTZXJ2ZXIpIHtcblx0XHR0aGlzLmhvc3QgPSBMb2NhbEZpbGVTZWFyY2hXb3JrZXJIb3N0LmdldENoYW5uZWwod29ya2VyU2VydmVyKTtcblx0fVxuXG5cdCRjYW5jZWxRdWVyeShxdWVyeUlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLmNhbmNlbGxhdGlvblRva2Vucy5nZXQocXVlcnlJZCk/LmNhbmNlbCgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNhbmNlbGxhdGlvblRva2VuKHF1ZXJ5SWQ6IG51bWJlcik6IENhbmNlbGxhdGlvblRva2VuU291cmNlIHtcblx0XHRjb25zdCBzb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHR0aGlzLmNhbmNlbGxhdGlvblRva2Vucy5zZXQocXVlcnlJZCwgc291cmNlKTtcblx0XHRyZXR1cm4gc291cmNlO1xuXHR9XG5cblx0YXN5bmMgJGxpc3REaXJlY3RvcnkoaGFuZGxlOiBJV29ya2VyRmlsZVN5c3RlbURpcmVjdG9yeUhhbmRsZSwgcXVlcnk6IElGaWxlUXVlcnlQcm9wczxVcmlDb21wb25lbnRzPiwgZm9sZGVyUXVlcnk6IElGb2xkZXJRdWVyeTxVcmlDb21wb25lbnRzPiwgaWdub3JlUGF0aENhc2luZzogYm9vbGVhbiwgcXVlcnlJZDogbnVtYmVyKTogUHJvbWlzZTxJV29ya2VyRmlsZVNlYXJjaENvbXBsZXRlPiB7XG5cdFx0Y29uc3QgcmV2aXZlZEZvbGRlclF1ZXJ5ID0gcmV2aXZlRm9sZGVyUXVlcnkoZm9sZGVyUXVlcnkpO1xuXHRcdGNvbnN0IGV4dFVyaSA9IG5ldyBFeHRVcmkoKCkgPT4gaWdub3JlUGF0aENhc2luZyk7XG5cblx0XHRjb25zdCB0b2tlbiA9IHRoaXMucmVnaXN0ZXJDYW5jZWxsYXRpb25Ub2tlbihxdWVyeUlkKTtcblx0XHRjb25zdCBlbnRyaWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBsaW1pdEhpdCA9IGZhbHNlO1xuXHRcdGxldCBjb3VudCA9IDA7XG5cblx0XHRjb25zdCBtYXggPSBxdWVyeS5tYXhSZXN1bHRzIHx8IDUxMjtcblxuXHRcdGNvbnN0IGZpbGVQYXR0ZXJuTWF0Y2hlciA9IHF1ZXJ5LmZpbGVQYXR0ZXJuXG5cdFx0XHQ/IChuYW1lOiBzdHJpbmcpID0+IHF1ZXJ5LmZpbGVQYXR0ZXJuIS5zcGxpdCgnJykuZXZlcnkoYyA9PiBuYW1lLmluY2x1ZGVzKGMpKVxuXHRcdFx0OiAobmFtZTogc3RyaW5nKSA9PiB0cnVlO1xuXG5cdFx0YXdhaXQgdGltZSgnbGlzdERpcmVjdG9yeScsICgpID0+IHRoaXMud2Fsa0ZvbGRlclF1ZXJ5KGhhbmRsZSwgcmV2aXZlUXVlcnlQcm9wcyhxdWVyeSksIHJldml2ZWRGb2xkZXJRdWVyeSwgZXh0VXJpLCBmaWxlID0+IHtcblx0XHRcdGlmICghZmlsZVBhdHRlcm5NYXRjaGVyKGZpbGUubmFtZSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb3VudCsrO1xuXG5cdFx0XHRpZiAobWF4ICYmIGNvdW50ID4gbWF4KSB7XG5cdFx0XHRcdGxpbWl0SGl0ID0gdHJ1ZTtcblx0XHRcdFx0dG9rZW4uY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZW50cmllcy5wdXNoKGZpbGUucGF0aCk7XG5cdFx0fSwgdG9rZW4udG9rZW4pKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN1bHRzOiBlbnRyaWVzLFxuXHRcdFx0bGltaXRIaXRcblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgJHNlYXJjaERpcmVjdG9yeShoYW5kbGU6IElXb3JrZXJGaWxlU3lzdGVtRGlyZWN0b3J5SGFuZGxlLCBxdWVyeTogSVRleHRRdWVyeVByb3BzPFVyaUNvbXBvbmVudHM+LCBmb2xkZXJRdWVyeTogSUZvbGRlclF1ZXJ5PFVyaUNvbXBvbmVudHM+LCBpZ25vcmVQYXRoQ2FzaW5nOiBib29sZWFuLCBxdWVyeUlkOiBudW1iZXIpOiBQcm9taXNlPElXb3JrZXJUZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRjb25zdCByZXZpdmVkUXVlcnkgPSByZXZpdmVGb2xkZXJRdWVyeShmb2xkZXJRdWVyeSk7XG5cdFx0Y29uc3QgZXh0VXJpID0gbmV3IEV4dFVyaSgoKSA9PiBpZ25vcmVQYXRoQ2FzaW5nKTtcblxuXHRcdHJldHVybiB0aW1lKCdzZWFyY2hJbkZpbGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdG9rZW4gPSB0aGlzLnJlZ2lzdGVyQ2FuY2VsbGF0aW9uVG9rZW4ocXVlcnlJZCk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdHM6IElGaWxlTWF0Y2hbXSA9IFtdO1xuXG5cdFx0XHRjb25zdCBwYXR0ZXJuID0gY3JlYXRlU2VhcmNoUmVnRXhwKHF1ZXJ5LmNvbnRlbnRQYXR0ZXJuKTtcblxuXHRcdFx0Y29uc3Qgb25Hb2luZ1Byb2Nlc3NlczogUHJvbWlzZTx2b2lkPltdID0gW107XG5cblx0XHRcdGxldCBmaWxlQ291bnQgPSAwO1xuXHRcdFx0bGV0IHJlc3VsdENvdW50ID0gMDtcblx0XHRcdGNvbnN0IGxpbWl0SGl0ID0gZmFsc2U7XG5cblx0XHRcdGNvbnN0IHByb2Nlc3NGaWxlID0gYXN5bmMgKGZpbGU6IEZpbGVOb2RlKSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZpbGVDb3VudCsrO1xuXG5cdFx0XHRcdGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgZmlsZS5yZXNvbHZlKCk7XG5cdFx0XHRcdGlmICh0b2tlbi50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoY29udGVudHMpO1xuXHRcdFx0XHRjb25zdCBmaWxlUmVzdWx0cyA9IGdldEZpbGVSZXN1bHRzKGJ5dGVzLCBwYXR0ZXJuLCB7XG5cdFx0XHRcdFx0c3Vycm91bmRpbmdDb250ZXh0OiBxdWVyeS5zdXJyb3VuZGluZ0NvbnRleHQgPz8gMCxcblx0XHRcdFx0XHRwcmV2aWV3T3B0aW9uczogcXVlcnkucHJldmlld09wdGlvbnMsXG5cdFx0XHRcdFx0cmVtYWluaW5nUmVzdWx0UXVvdGE6IHF1ZXJ5Lm1heFJlc3VsdHMgPyAocXVlcnkubWF4UmVzdWx0cyAtIHJlc3VsdENvdW50KSA6IDEwMDAwLFxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAoZmlsZVJlc3VsdHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmVzdWx0Q291bnQgKz0gZmlsZVJlc3VsdHMubGVuZ3RoO1xuXHRcdFx0XHRcdGlmIChxdWVyeS5tYXhSZXN1bHRzICYmIHJlc3VsdENvdW50ID4gcXVlcnkubWF4UmVzdWx0cykge1xuXHRcdFx0XHRcdFx0dG9rZW4uY2FuY2VsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0ge1xuXHRcdFx0XHRcdFx0cmVzb3VyY2U6IFVSSS5qb2luUGF0aChyZXZpdmVkUXVlcnkuZm9sZGVyLCBmaWxlLnBhdGgpLFxuXHRcdFx0XHRcdFx0cmVzdWx0czogZmlsZVJlc3VsdHMsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLmhvc3QuJHNlbmRUZXh0U2VhcmNoTWF0Y2gobWF0Y2gsIHF1ZXJ5SWQpO1xuXHRcdFx0XHRcdHJlc3VsdHMucHVzaChtYXRjaCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGF3YWl0IHRpbWUoJ3dhbGtGb2xkZXJUb1Jlc29sdmUnLCAoKSA9PlxuXHRcdFx0XHR0aGlzLndhbGtGb2xkZXJRdWVyeShoYW5kbGUsIHJldml2ZVF1ZXJ5UHJvcHMocXVlcnkpLCByZXZpdmVkUXVlcnksIGV4dFVyaSwgYXN5bmMgZmlsZSA9PiBvbkdvaW5nUHJvY2Vzc2VzLnB1c2gocHJvY2Vzc0ZpbGUoZmlsZSkpLCB0b2tlbi50b2tlbilcblx0XHRcdCk7XG5cblx0XHRcdGF3YWl0IHRpbWUoJ3Jlc29sdmVPbmdvaW5nUHJvY2Vzc2VzJywgKCkgPT4gUHJvbWlzZS5hbGwob25Hb2luZ1Byb2Nlc3NlcykpO1xuXG5cdFx0XHRpZiAoUEVSRikgeyBjb25zb2xlLmxvZygnU2VhcmNoZWQgaW4nLCBmaWxlQ291bnQsICdmaWxlcycpOyB9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc3VsdHMsXG5cdFx0XHRcdGxpbWl0SGl0LFxuXHRcdFx0fTtcblx0XHR9KTtcblxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3YWxrRm9sZGVyUXVlcnkoaGFuZGxlOiBJV29ya2VyRmlsZVN5c3RlbURpcmVjdG9yeUhhbmRsZSwgcXVlcnlQcm9wczogSUNvbW1vblF1ZXJ5UHJvcHM8VVJJPiwgZm9sZGVyUXVlcnk6IElGb2xkZXJRdWVyeTxVUkk+LCBleHRVcmk6IEV4dFVyaSwgb25GaWxlOiAoZmlsZTogRmlsZU5vZGUpID0+IGFueSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCBmb2xkZXJFeGNsdWRlcyA9IGZvbGRlclF1ZXJ5LmV4Y2x1ZGVQYXR0ZXJuPy5tYXAoZXhjbHVkZVBhdHRlcm4gPT4gZ2xvYi5wYXJzZShleGNsdWRlUGF0dGVybi5wYXR0ZXJuID8/IHt9LCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pIGFzIGdsb2IuUGFyc2VkRXhwcmVzc2lvbik7XG5cblx0XHRjb25zdCBldmFsRm9sZGVyRXhjbHVkZXMgPSAocGF0aDogc3RyaW5nLCBiYXNlbmFtZTogc3RyaW5nLCBoYXNTaWJsaW5nOiAocXVlcnk6IHN0cmluZykgPT4gYm9vbGVhbikgPT4ge1xuXHRcdFx0cmV0dXJuIGZvbGRlckV4Y2x1ZGVzPy5zb21lKGZvbGRlckV4Y2x1ZGUgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZm9sZGVyRXhjbHVkZShwYXRoLCBiYXNlbmFtZSwgaGFzU2libGluZyk7XG5cdFx0XHR9KTtcblxuXHRcdH07XG5cdFx0Ly8gRm9yIGZvbGRlcnMsIG9ubHkgY2hlY2sgaWYgdGhlIGZvbGRlciBpcyBleHBsaWNpdGx5IGV4Y2x1ZGVkIHNvIHdhbGtpbmcgY29udGludWVzLlxuXHRcdGNvbnN0IGlzRm9sZGVyRXhjbHVkZWQgPSAocGF0aDogc3RyaW5nLCBiYXNlbmFtZTogc3RyaW5nLCBoYXNTaWJsaW5nOiAocXVlcnk6IHN0cmluZykgPT4gYm9vbGVhbikgPT4ge1xuXHRcdFx0cGF0aCA9IHBhdGguc2xpY2UoMSk7XG5cdFx0XHRpZiAoZXZhbEZvbGRlckV4Y2x1ZGVzKHBhdGgsIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSkgeyByZXR1cm4gdHJ1ZTsgfVxuXHRcdFx0aWYgKHBhdGhFeGNsdWRlZEluUXVlcnkocXVlcnlQcm9wcywgcGF0aCkpIHsgcmV0dXJuIHRydWU7IH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0Ly8gRm9yIGZpbGVzIGVuc3VyZSB0aGUgZnVsbCBjaGVjayB0YWtlcyBwbGFjZS5cblx0XHRjb25zdCBpc0ZpbGVJbmNsdWRlZCA9IChwYXRoOiBzdHJpbmcsIGJhc2VuYW1lOiBzdHJpbmcsIGhhc1NpYmxpbmc6IChxdWVyeTogc3RyaW5nKSA9PiBib29sZWFuKSA9PiB7XG5cdFx0XHRwYXRoID0gcGF0aC5zbGljZSgxKTtcblx0XHRcdGlmIChldmFsRm9sZGVyRXhjbHVkZXMocGF0aCwgYmFzZW5hbWUsIGhhc1NpYmxpbmcpKSB7IHJldHVybiBmYWxzZTsgfVxuXHRcdFx0aWYgKCFwYXRoSW5jbHVkZWRJblF1ZXJ5KHF1ZXJ5UHJvcHMsIHBhdGgsIGV4dFVyaSkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvY2Vzc0ZpbGUgPSAoZmlsZTogRmlsZVN5c3RlbUZpbGVIYW5kbGUsIHByaW9yOiBzdHJpbmcpOiBGaWxlTm9kZSA9PiB7XG5cblx0XHRcdGNvbnN0IHJlc29sdmVkOiBGaWxlTm9kZSA9IHtcblx0XHRcdFx0dHlwZTogJ2ZpbGUnLFxuXHRcdFx0XHRuYW1lOiBmaWxlLm5hbWUsXG5cdFx0XHRcdHBhdGg6IHByaW9yLFxuXHRcdFx0XHRyZXNvbHZlOiAoKSA9PiBmaWxlLmdldEZpbGUoKS50aGVuKHIgPT4gci5hcnJheUJ1ZmZlcigpKVxuXHRcdFx0fSBhcyBjb25zdDtcblxuXHRcdFx0cmV0dXJuIHJlc29sdmVkO1xuXHRcdH07XG5cblx0XHRjb25zdCBpc0ZpbGVTeXN0ZW1EaXJlY3RvcnlIYW5kbGUgPSAoaGFuZGxlOiBJV29ya2VyRmlsZVN5c3RlbUhhbmRsZSk6IGhhbmRsZSBpcyBGaWxlU3lzdGVtRGlyZWN0b3J5SGFuZGxlID0+IHtcblx0XHRcdHJldHVybiBoYW5kbGUua2luZCA9PT0gJ2RpcmVjdG9yeSc7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGlzRmlsZVN5c3RlbUZpbGVIYW5kbGUgPSAoaGFuZGxlOiBJV29ya2VyRmlsZVN5c3RlbUhhbmRsZSk6IGhhbmRsZSBpcyBGaWxlU3lzdGVtRmlsZUhhbmRsZSA9PiB7XG5cdFx0XHRyZXR1cm4gaGFuZGxlLmtpbmQgPT09ICdmaWxlJztcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvY2Vzc0RpcmVjdG9yeSA9IGFzeW5jIChkaXJlY3Rvcnk6IElXb3JrZXJGaWxlU3lzdGVtRGlyZWN0b3J5SGFuZGxlLCBwcmlvcjogc3RyaW5nLCBpZ25vcmVGaWxlPzogSWdub3JlRmlsZSk6IFByb21pc2U8RGlyTm9kZT4gPT4ge1xuXG5cdFx0XHRpZiAoIWZvbGRlclF1ZXJ5LmRpc3JlZ2FyZElnbm9yZUZpbGVzKSB7XG5cdFx0XHRcdGNvbnN0IGlnbm9yZUZpbGVzID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRcdGRpcmVjdG9yeS5nZXRGaWxlSGFuZGxlKCcuZ2l0aWdub3JlJykuY2F0Y2goZSA9PiB1bmRlZmluZWQpLFxuXHRcdFx0XHRcdGRpcmVjdG9yeS5nZXRGaWxlSGFuZGxlKCcuaWdub3JlJykuY2F0Y2goZSA9PiB1bmRlZmluZWQpLFxuXHRcdFx0XHRdKTtcblxuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChpZ25vcmVGaWxlcy5tYXAoYXN5bmMgZmlsZSA9PiB7XG5cdFx0XHRcdFx0aWYgKCFmaWxlKSB7IHJldHVybjsgfVxuXG5cdFx0XHRcdFx0Y29uc3QgaWdub3JlQ29udGVudHMgPSBuZXcgVGV4dERlY29kZXIoJ3V0ZjgnKS5kZWNvZGUobmV3IFVpbnQ4QXJyYXkoYXdhaXQgKGF3YWl0IGZpbGUuZ2V0RmlsZSgpKS5hcnJheUJ1ZmZlcigpKSk7XG5cdFx0XHRcdFx0aWdub3JlRmlsZSA9IG5ldyBJZ25vcmVGaWxlKGlnbm9yZUNvbnRlbnRzLCBwcmlvciwgaWdub3JlRmlsZSk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZW50cmllcyA9IFByb21pc2VzLndpdGhBc3luY0JvZHk8KEZpbGVOb2RlIHwgRGlyTm9kZSlbXT4oYXN5bmMgYyA9PiB7XG5cdFx0XHRcdGNvbnN0IGZpbGVzOiBGaWxlTm9kZVtdID0gW107XG5cdFx0XHRcdGNvbnN0IGRpcnM6IFByb21pc2U8RGlyTm9kZT5bXSA9IFtdO1xuXG5cdFx0XHRcdGNvbnN0IGVudHJpZXM6IFtzdHJpbmcsIElXb3JrZXJGaWxlU3lzdGVtSGFuZGxlXVtdID0gW107XG5cdFx0XHRcdGNvbnN0IHNpYmlsaW5ncyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdFx0XHRcdGZvciBhd2FpdCAoY29uc3QgZW50cnkgb2YgZGlyZWN0b3J5LmVudHJpZXMoKSkge1xuXHRcdFx0XHRcdGVudHJpZXMucHVzaChlbnRyeSk7XG5cdFx0XHRcdFx0c2liaWxpbmdzLmFkZChlbnRyeVswXSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IFtiYXNlbmFtZSwgaGFuZGxlXSBvZiBlbnRyaWVzKSB7XG5cdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBwYXRoID0gcHJpb3IgKyBiYXNlbmFtZTtcblxuXHRcdFx0XHRcdGlmIChpZ25vcmVGaWxlICYmICFpZ25vcmVGaWxlLmlzUGF0aEluY2x1ZGVkSW5UcmF2ZXJzYWwocGF0aCwgaGFuZGxlLmtpbmQgPT09ICdkaXJlY3RvcnknKSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgaGFzU2libGluZyA9IChxdWVyeTogc3RyaW5nKSA9PiBzaWJpbGluZ3MuaGFzKHF1ZXJ5KTtcblxuXHRcdFx0XHRcdGlmIChpc0ZpbGVTeXN0ZW1EaXJlY3RvcnlIYW5kbGUoaGFuZGxlKSAmJiAhaXNGb2xkZXJFeGNsdWRlZChwYXRoLCBiYXNlbmFtZSwgaGFzU2libGluZykpIHtcblx0XHRcdFx0XHRcdGRpcnMucHVzaChwcm9jZXNzRGlyZWN0b3J5KGhhbmRsZSwgcGF0aCArICcvJywgaWdub3JlRmlsZSkpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNGaWxlU3lzdGVtRmlsZUhhbmRsZShoYW5kbGUpICYmIGlzRmlsZUluY2x1ZGVkKHBhdGgsIGJhc2VuYW1lLCBoYXNTaWJsaW5nKSkge1xuXHRcdFx0XHRcdFx0ZmlsZXMucHVzaChwcm9jZXNzRmlsZShoYW5kbGUsIHBhdGgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0YyhbLi4uYXdhaXQgUHJvbWlzZS5hbGwoZGlycyksIC4uLmZpbGVzXSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogJ2RpcicsXG5cdFx0XHRcdG5hbWU6IGRpcmVjdG9yeS5uYW1lLFxuXHRcdFx0XHRlbnRyaWVzXG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCByZXNvbHZlRGlyZWN0b3J5ID0gYXN5bmMgKGRpcmVjdG9yeTogRGlyTm9kZSwgb25GaWxlOiAoZjogRmlsZU5vZGUpID0+IGFueSkgPT4ge1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7IHJldHVybjsgfVxuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChcblx0XHRcdFx0KGF3YWl0IGRpcmVjdG9yeS5lbnRyaWVzKVxuXHRcdFx0XHRcdC5zb3J0KChhLCBiKSA9PiAtKGEudHlwZSA9PT0gJ2RpcicgPyAwIDogMSkgKyAoYi50eXBlID09PSAnZGlyJyA/IDAgOiAxKSlcblx0XHRcdFx0XHQubWFwKGFzeW5jIGVudHJ5ID0+IHtcblx0XHRcdFx0XHRcdGlmIChlbnRyeS50eXBlID09PSAnZGlyJykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzb2x2ZURpcmVjdG9yeShlbnRyeSwgb25GaWxlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gb25GaWxlKGVudHJ5KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHByb2Nlc3NlZCA9IGF3YWl0IHRpbWUoJ3Byb2Nlc3MnLCAoKSA9PiBwcm9jZXNzRGlyZWN0b3J5KGhhbmRsZSwgJy8nKSk7XG5cdFx0YXdhaXQgdGltZSgncmVzb2x2ZScsICgpID0+IHJlc29sdmVEaXJlY3RvcnkocHJvY2Vzc2VkLCBvbkZpbGUpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTZWFyY2hSZWdFeHAob3B0aW9uczogSVBhdHRlcm5JbmZvKTogUmVnRXhwIHtcblx0cmV0dXJuIGNyZWF0ZVJlZ0V4cChvcHRpb25zLnBhdHRlcm4sICEhb3B0aW9ucy5pc1JlZ0V4cCwge1xuXHRcdHdob2xlV29yZDogb3B0aW9ucy5pc1dvcmRNYXRjaCxcblx0XHRnbG9iYWw6IHRydWUsXG5cdFx0bWF0Y2hDYXNlOiBvcHRpb25zLmlzQ2FzZVNlbnNpdGl2ZSxcblx0XHRtdWx0aWxpbmU6IHRydWUsXG5cdFx0dW5pY29kZTogdHJ1ZSxcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJldml2ZUZvbGRlclF1ZXJ5KGZvbGRlclF1ZXJ5OiBJRm9sZGVyUXVlcnk8VXJpQ29tcG9uZW50cz4pOiBJRm9sZGVyUXVlcnk8VVJJPiB7XG5cdC8vIEB0b2RvOiBhbmRyZWEgLSB0cnkgdG8gc2VlIHdoeSB3ZSBjYW4ndCBqdXN0IGNhbGwgJ3Jldml2ZScgaGVyZVxuXHRyZXR1cm4gcmV2aXZlKHtcblx0XHQuLi5yZXZpdmUoZm9sZGVyUXVlcnkpLFxuXHRcdGV4Y2x1ZGVQYXR0ZXJuOiBmb2xkZXJRdWVyeS5leGNsdWRlUGF0dGVybj8ubWFwKGVwID0+ICh7IGZvbGRlcjogVVJJLnJldml2ZShlcC5mb2xkZXIpLCBwYXR0ZXJuOiBlcC5wYXR0ZXJuIH0pKSxcblx0XHRmb2xkZXI6IFVSSS5yZXZpdmUoZm9sZGVyUXVlcnkuZm9sZGVyKSxcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHJldml2ZVF1ZXJ5UHJvcHMocXVlcnlQcm9wczogSUNvbW1vblF1ZXJ5UHJvcHM8VXJpQ29tcG9uZW50cz4pOiBJQ29tbW9uUXVlcnlQcm9wczxVUkk+IHtcblx0cmV0dXJuIHtcblx0XHQuLi5xdWVyeVByb3BzLFxuXHRcdGV4dHJhRmlsZVJlc291cmNlczogcXVlcnlQcm9wcy5leHRyYUZpbGVSZXNvdXJjZXM/Lm1hcChyID0+IFVSSS5yZXZpdmUocikpLFxuXHRcdGZvbGRlclF1ZXJpZXM6IHF1ZXJ5UHJvcHMuZm9sZGVyUXVlcmllcy5tYXAoZnEgPT4gcmV2aXZlRm9sZGVyUXVlcnkoZnEpKSxcblx0fTtcbn1cblxuXG5mdW5jdGlvbiBwYXRoRXhjbHVkZWRJblF1ZXJ5KHF1ZXJ5UHJvcHM6IElDb21tb25RdWVyeVByb3BzPFVSST4sIGZzUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdGlmIChxdWVyeVByb3BzLmV4Y2x1ZGVQYXR0ZXJuICYmIGdsb2IubWF0Y2gocXVlcnlQcm9wcy5leGNsdWRlUGF0dGVybiwgZnNQYXRoKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gcGF0aEluY2x1ZGVkSW5RdWVyeShxdWVyeVByb3BzOiBJQ29tbW9uUXVlcnlQcm9wczxVUkk+LCBwYXRoOiBzdHJpbmcsIGV4dFVyaTogRXh0VXJpKTogYm9vbGVhbiB7XG5cdGlmIChxdWVyeVByb3BzLmV4Y2x1ZGVQYXR0ZXJuICYmIGdsb2IubWF0Y2gocXVlcnlQcm9wcy5leGNsdWRlUGF0dGVybiwgcGF0aCkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAocXVlcnlQcm9wcy5pbmNsdWRlUGF0dGVybiB8fCBxdWVyeVByb3BzLnVzaW5nU2VhcmNoUGF0aHMpIHtcblx0XHRpZiAocXVlcnlQcm9wcy5pbmNsdWRlUGF0dGVybiAmJiBnbG9iLm1hdGNoKHF1ZXJ5UHJvcHMuaW5jbHVkZVBhdHRlcm4sIHBhdGgpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBJZiBzZWFyY2hQYXRocyBhcmUgYmVpbmcgdXNlZCwgdGhlIGV4dHJhIGZpbGUgbXVzdCBiZSBpbiBhIHN1YmZvbGRlciBhbmQgbWF0Y2ggdGhlIHBhdHRlcm4sIGlmIHByZXNlbnRcblx0XHRpZiAocXVlcnlQcm9wcy51c2luZ1NlYXJjaFBhdGhzKSB7XG5cblx0XHRcdHJldHVybiAhIXF1ZXJ5UHJvcHMuZm9sZGVyUXVlcmllcyAmJiBxdWVyeVByb3BzLmZvbGRlclF1ZXJpZXMuc29tZShmcSA9PiB7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaFBhdGggPSBmcS5mb2xkZXI7XG5cdFx0XHRcdGNvbnN0IHVyaSA9IFVSSS5maWxlKHBhdGgpO1xuXHRcdFx0XHRpZiAoZXh0VXJpLmlzRXF1YWxPclBhcmVudCh1cmksIHNlYXJjaFBhdGgpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVsUGF0aCA9IHBhdGhzLnJlbGF0aXZlKHNlYXJjaFBhdGgucGF0aCwgdXJpLnBhdGgpO1xuXHRcdFx0XHRcdHJldHVybiAhZnEuaW5jbHVkZVBhdHRlcm4gfHwgISFnbG9iLm1hdGNoKGZxLmluY2x1ZGVQYXR0ZXJuLCByZWxQYXRoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxVQUFVO0FBQ3RCLFNBQXdCLFdBQVc7QUFFbkMsU0FBaUMsaUNBQWtKO0FBRW5MLFlBQVksV0FBVztBQUN2QixTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsY0FBYztBQUV2QixNQUFNLE9BQU87QUFlYixNQUFNLGNBQWMsQ0FBQyxvQkFBSSxLQUFLO0FBQzlCLE1BQU0sV0FBbUMsQ0FBQztBQUMxQyxNQUFNLE9BQU8sT0FBVSxNQUFjLFNBQStCO0FBQ25FLE1BQUksQ0FBQyxNQUFNO0FBQUUsV0FBTyxLQUFLO0FBQUEsRUFBRztBQUU1QixRQUFNLFFBQVEsS0FBSyxJQUFJO0FBQ3ZCLFFBQU0sT0FBTyxTQUFTLElBQUksS0FBSyxLQUFLO0FBQ3BDLFVBQVEsS0FBSyxNQUFNLEtBQUssWUFBWSxLQUFLLE9BQU8sUUFBUSxlQUFlLEVBQUUsSUFBSSxHQUFLO0FBRWxGLFdBQVMsSUFBSSxJQUFJO0FBQ2pCLFFBQU0sSUFBSSxNQUFNLEtBQUs7QUFDckIsUUFBTSxNQUFNLEtBQUssSUFBSTtBQUNyQixVQUFRLEtBQUssTUFBTSxLQUFLLFFBQVEsTUFBTSxLQUFLO0FBQzNDLFNBQU87QUFDUjtBQUVPLFNBQVMsT0FBTyxjQUFnRTtBQUN0RixTQUFPLElBQUksc0JBQXNCLFlBQVk7QUFDOUM7QUFFTyxNQUFNLHNCQUF3RjtBQUFBLEVBTXBHLFlBQVksY0FBZ0M7QUFGNUMsOEJBQTJE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
