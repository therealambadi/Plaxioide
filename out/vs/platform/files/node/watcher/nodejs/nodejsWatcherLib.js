import { watch, promises } from "fs";
import { RunOnceWorker, ThrottledWorker } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { isEqual, isEqualOrParent } from "../../../../../base/common/extpath.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { normalizeNFC } from "../../../../../base/common/normalization.js";
import { basename, dirname, join } from "../../../../../base/common/path.js";
import { isLinux, isMacintosh } from "../../../../../base/common/platform.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { realpath } from "../../../../../base/node/extpath.js";
import { Promises } from "../../../../../base/node/pfs.js";
import { FileChangeType } from "../../../common/files.js";
import { coalesceEvents, parseWatcherPatterns, isFiltered, isWatchRequestWithCorrelation } from "../../../common/watcher.js";
import { Lazy } from "../../../../../base/common/lazy.js";
const _NodeJSFileWatcherLibrary = class _NodeJSFileWatcherLibrary extends Disposable {
  constructor(request, recursiveWatcher, onDidFilesChange, onDidWatchFail, onLogMessage, verboseLogging) {
    super();
    this.request = request;
    this.recursiveWatcher = recursiveWatcher;
    this.onDidFilesChange = onDidFilesChange;
    this.onDidWatchFail = onDidWatchFail;
    this.onLogMessage = onLogMessage;
    this.verboseLogging = verboseLogging;
    // Reduce likelyhood of spam from file events via throttling.
    // These numbers are a bit more aggressive compared to the
    // recursive watcher because we can have many individual
    // node.js watchers per request.
    // (https://github.com/microsoft/vscode/issues/124723)
    this.throttledFileChangesEmitter = this._register(new ThrottledWorker(
      {
        maxWorkChunkSize: 100,
        // only process up to 100 changes at once before...
        throttleDelay: 200,
        // ...resting for 200ms until we process events again...
        maxBufferedWork: 1e4
        // ...but never buffering more than 10000 events in memory
      },
      (events) => this.onDidFilesChange(events)
    ));
    // Aggregate file changes over FILE_CHANGES_HANDLER_DELAY
    // to coalesce events and reduce spam.
    this.fileChangesAggregator = this._register(new RunOnceWorker((events) => this.handleFileChanges(events), _NodeJSFileWatcherLibrary.FILE_CHANGES_HANDLER_DELAY));
    this.cts = new CancellationTokenSource();
    this.realPath = new Lazy(async () => {
      let result = this.request.path;
      try {
        result = await realpath(this.request.path);
        if (this.request.path !== result) {
          this.trace(`correcting a path to watch that seems to be a symbolic link (original: ${this.request.path}, real: ${result})`);
        }
      } catch (error) {
      }
      return result;
    });
    this._isReusingRecursiveWatcher = false;
    this.didFail = false;
    this.excludes = parseWatcherPatterns(this.request.path, this.request.excludes);
    this.includes = this.request.includes ? parseWatcherPatterns(this.request.path, this.request.includes) : void 0;
    this.filter = isWatchRequestWithCorrelation(this.request) ? this.request.filter : void 0;
    this.ready = this.watch();
  }
  get isReusingRecursiveWatcher() {
    return this._isReusingRecursiveWatcher;
  }
  get failed() {
    return this.didFail;
  }
  async watch() {
    try {
      const stat = await promises.stat(this.request.path);
      if (this.cts.token.isCancellationRequested) {
        return;
      }
      this._register(await this.doWatch(stat.isDirectory()));
    } catch (error) {
      if (error.code !== "ENOENT") {
        this.error(error);
      } else {
        this.trace(`ignoring a path for watching who's stat info failed to resolve: ${this.request.path} (error: ${error})`);
      }
      this.notifyWatchFailed();
    }
  }
  notifyWatchFailed() {
    this.didFail = true;
    this.onDidWatchFail?.();
  }
  async doWatch(isDirectory) {
    const disposables = new DisposableStore();
    if (this.doWatchWithExistingWatcher(isDirectory, disposables)) {
      this.trace(`reusing an existing recursive watcher for ${this.request.path}`);
      this._isReusingRecursiveWatcher = true;
    } else {
      this._isReusingRecursiveWatcher = false;
      await this.doWatchWithNodeJS(isDirectory, disposables);
    }
    return disposables;
  }
  doWatchWithExistingWatcher(isDirectory, disposables) {
    if (isDirectory) {
      return false;
    }
    const resource = URI.file(this.request.path);
    const subscription = this.recursiveWatcher?.subscribe(this.request.path, async (error, change) => {
      if (disposables.isDisposed) {
        return;
      }
      if (error) {
        const watchDisposable = await this.doWatch(isDirectory);
        if (!disposables.isDisposed) {
          disposables.add(watchDisposable);
        } else {
          watchDisposable.dispose();
        }
      } else if (change) {
        if (typeof change.cId === "number" || typeof this.request.correlationId === "number") {
          this.onFileChange(
            { resource, type: change.type, cId: this.request.correlationId },
            true
            /* skip excludes/includes (file is explicitly watched) */
          );
        }
      }
    });
    if (subscription) {
      disposables.add(subscription);
      return true;
    }
    return false;
  }
  async doWatchWithNodeJS(isDirectory, disposables) {
    const realPath = await this.realPath.value;
    if (isMacintosh && isEqualOrParent(realPath, "/Volumes/", true)) {
      this.error(`Refusing to watch ${realPath} for changes using fs.watch() for possibly being a network share where watching is unreliable and unstable.`);
      return;
    }
    const cts = new CancellationTokenSource(this.cts.token);
    disposables.add(toDisposable(() => cts.dispose(true)));
    const watcherDisposables = new DisposableStore();
    disposables.add(watcherDisposables);
    try {
      const requestResource = URI.file(this.request.path);
      const pathBasename = basename(realPath);
      const watcher = watch(realPath);
      watcherDisposables.add(toDisposable(() => {
        watcher.removeAllListeners();
        watcher.close();
      }));
      this.trace(`Started watching: '${realPath}'`);
      const folderChildren = /* @__PURE__ */ new Set();
      if (isDirectory) {
        try {
          for (const child of await Promises.readdir(realPath)) {
            folderChildren.add(child);
          }
        } catch (error) {
          this.error(error);
        }
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      const mapPathToStatDisposable = /* @__PURE__ */ new Map();
      watcherDisposables.add(toDisposable(() => {
        for (const [, disposable] of mapPathToStatDisposable) {
          disposable.dispose();
        }
        mapPathToStatDisposable.clear();
      }));
      watcher.on("error", (code, signal) => {
        if (cts.token.isCancellationRequested) {
          return;
        }
        this.error(`Failed to watch ${realPath} for changes using fs.watch() (${code}, ${signal})`);
        this.notifyWatchFailed();
      });
      watcher.on("change", (type, raw) => {
        if (cts.token.isCancellationRequested) {
          return;
        }
        if (this.verboseLogging) {
          this.traceWithCorrelation(`[raw] ["${type}"] ${raw}`);
        }
        let changedFileName = "";
        if (raw) {
          changedFileName = raw.toString();
          if (isMacintosh) {
            changedFileName = normalizeNFC(changedFileName);
          }
        }
        if (!changedFileName || type !== "change" && type !== "rename") {
          return;
        }
        if (isDirectory) {
          if (type === "rename") {
            mapPathToStatDisposable.get(changedFileName)?.dispose();
            const timeoutHandle = setTimeout(async () => {
              mapPathToStatDisposable.delete(changedFileName);
              if (isEqual(changedFileName, pathBasename, !isLinux) && !await Promises.exists(realPath)) {
                this.onWatchedPathDeleted(requestResource);
                return;
              }
              if (cts.token.isCancellationRequested) {
                return;
              }
              const fileExists = await this.existsChildStrictCase(join(realPath, changedFileName));
              if (cts.token.isCancellationRequested) {
                return;
              }
              let type2;
              if (fileExists) {
                if (folderChildren.has(changedFileName)) {
                  type2 = FileChangeType.UPDATED;
                } else {
                  type2 = FileChangeType.ADDED;
                  folderChildren.add(changedFileName);
                }
              } else {
                folderChildren.delete(changedFileName);
                type2 = FileChangeType.DELETED;
              }
              this.onFileChange({ resource: joinPath(requestResource, changedFileName), type: type2, cId: this.request.correlationId });
            }, _NodeJSFileWatcherLibrary.FILE_DELETE_HANDLER_DELAY);
            mapPathToStatDisposable.set(changedFileName, toDisposable(() => clearTimeout(timeoutHandle)));
          } else {
            let type2;
            if (folderChildren.has(changedFileName)) {
              type2 = FileChangeType.UPDATED;
            } else {
              type2 = FileChangeType.ADDED;
              folderChildren.add(changedFileName);
            }
            this.onFileChange({ resource: joinPath(requestResource, changedFileName), type: type2, cId: this.request.correlationId });
          }
        } else {
          if (type === "rename" || !isEqual(changedFileName, pathBasename, !isLinux)) {
            const timeoutHandle = setTimeout(async () => {
              const fileExists = await Promises.exists(realPath);
              if (cts.token.isCancellationRequested) {
                return;
              }
              if (fileExists) {
                this.onFileChange(
                  { resource: requestResource, type: FileChangeType.UPDATED, cId: this.request.correlationId },
                  true
                  /* skip excludes/includes (file is explicitly watched) */
                );
                watcherDisposables.add(await this.doWatch(false));
              } else {
                this.onWatchedPathDeleted(requestResource);
              }
            }, _NodeJSFileWatcherLibrary.FILE_DELETE_HANDLER_DELAY);
            watcherDisposables.clear();
            watcherDisposables.add(toDisposable(() => clearTimeout(timeoutHandle)));
          } else {
            this.onFileChange(
              { resource: requestResource, type: FileChangeType.UPDATED, cId: this.request.correlationId },
              true
              /* skip excludes/includes (file is explicitly watched) */
            );
          }
        }
      });
    } catch (error) {
      if (!cts.token.isCancellationRequested) {
        this.error(`Failed to watch ${realPath} for changes using fs.watch() (${error.toString()})`);
      }
      this.notifyWatchFailed();
    }
  }
  onWatchedPathDeleted(resource) {
    this.warn("Watcher shutdown because watched path got deleted");
    this.onFileChange(
      { resource, type: FileChangeType.DELETED, cId: this.request.correlationId },
      true
      /* skip excludes/includes (file is explicitly watched) */
    );
    this.fileChangesAggregator.flush();
    this.notifyWatchFailed();
  }
  onFileChange(event, skipIncludeExcludeChecks = false) {
    if (this.cts.token.isCancellationRequested) {
      return;
    }
    if (this.verboseLogging) {
      this.traceWithCorrelation(`${event.type === FileChangeType.ADDED ? "[ADDED]" : event.type === FileChangeType.DELETED ? "[DELETED]" : "[CHANGED]"} ${event.resource.fsPath}`);
    }
    if (!skipIncludeExcludeChecks && this.excludes.some((exclude) => exclude(event.resource.fsPath))) {
      if (this.verboseLogging) {
        this.traceWithCorrelation(` >> ignored (excluded) ${event.resource.fsPath}`);
      }
    } else if (!skipIncludeExcludeChecks && this.includes && this.includes.length > 0 && !this.includes.some((include) => include(event.resource.fsPath))) {
      if (this.verboseLogging) {
        this.traceWithCorrelation(` >> ignored (not included) ${event.resource.fsPath}`);
      }
    } else {
      this.fileChangesAggregator.work(event);
    }
  }
  handleFileChanges(fileChanges) {
    const coalescedFileChanges = coalesceEvents(fileChanges);
    const filteredEvents = [];
    for (const event of coalescedFileChanges) {
      if (isFiltered(event, this.filter)) {
        if (this.verboseLogging) {
          this.traceWithCorrelation(` >> ignored (filtered) ${event.resource.fsPath}`);
        }
        continue;
      }
      filteredEvents.push(event);
    }
    if (filteredEvents.length === 0) {
      return;
    }
    if (this.verboseLogging) {
      for (const event of filteredEvents) {
        this.traceWithCorrelation(` >> normalized ${event.type === FileChangeType.ADDED ? "[ADDED]" : event.type === FileChangeType.DELETED ? "[DELETED]" : "[CHANGED]"} ${event.resource.fsPath}`);
      }
    }
    const worked = this.throttledFileChangesEmitter.work(filteredEvents);
    if (!worked) {
      this.warn(`started ignoring events due to too many file change events at once (incoming: ${filteredEvents.length}, most recent change: ${filteredEvents[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
    } else {
      if (this.throttledFileChangesEmitter.pending > 0) {
        this.trace(`started throttling events due to large amount of file change events at once (pending: ${this.throttledFileChangesEmitter.pending}, most recent change: ${filteredEvents[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
      }
    }
  }
  async existsChildStrictCase(path) {
    if (isLinux) {
      return Promises.exists(path);
    }
    try {
      const pathBasename = basename(path);
      const children = await Promises.readdir(dirname(path));
      return children.some((child) => child === pathBasename);
    } catch (error) {
      this.trace(error);
      return false;
    }
  }
  setVerboseLogging(verboseLogging) {
    this.verboseLogging = verboseLogging;
  }
  error(error) {
    if (!this.cts.token.isCancellationRequested) {
      this.onLogMessage?.({ type: "error", message: `[File Watcher (node.js)] ${error}` });
    }
  }
  warn(message) {
    if (!this.cts.token.isCancellationRequested) {
      this.onLogMessage?.({ type: "warn", message: `[File Watcher (node.js)] ${message}` });
    }
  }
  trace(message) {
    if (!this.cts.token.isCancellationRequested && this.verboseLogging) {
      this.onLogMessage?.({ type: "trace", message: `[File Watcher (node.js)] ${message}` });
    }
  }
  traceWithCorrelation(message) {
    if (!this.cts.token.isCancellationRequested && this.verboseLogging) {
      this.trace(`${message}${typeof this.request.correlationId === "number" ? ` <${this.request.correlationId}> ` : ``}`);
    }
  }
  dispose() {
    this.cts.dispose(true);
    super.dispose();
  }
};
// A delay in reacting to file deletes to support
// atomic save operations where a tool may chose
// to delete a file before creating it again for
// an update.
_NodeJSFileWatcherLibrary.FILE_DELETE_HANDLER_DELAY = 100;
// A delay for collecting file changes from node.js
// before collecting them for coalescing and emitting
// Same delay as used for the recursive watcher.
_NodeJSFileWatcherLibrary.FILE_CHANGES_HANDLER_DELAY = 75;
let NodeJSFileWatcherLibrary = _NodeJSFileWatcherLibrary;
async function watchFileContents(path, onData, onReady, token, bufferSize = 512) {
  const handle = await Promises.open(path, "r");
  const buffer = Buffer.allocUnsafe(bufferSize);
  const cts = new CancellationTokenSource(token);
  let error = void 0;
  let isReading = false;
  const request = { path, excludes: [], recursive: false };
  const watcher = new NodeJSFileWatcherLibrary(request, void 0, (changes) => {
    (async () => {
      for (const { type } of changes) {
        if (type === FileChangeType.UPDATED) {
          if (isReading) {
            return;
          }
          isReading = true;
          try {
            while (!cts.token.isCancellationRequested) {
              const { bytesRead } = await Promises.read(handle, buffer, 0, bufferSize, null);
              if (!bytesRead || cts.token.isCancellationRequested) {
                break;
              }
              onData(buffer.slice(0, bytesRead));
            }
          } catch (err) {
            error = new Error(err);
            cts.dispose(true);
          } finally {
            isReading = false;
          }
        }
      }
    })();
  });
  await watcher.ready;
  onReady();
  return new Promise((resolve, reject) => {
    cts.token.onCancellationRequested(async () => {
      watcher.dispose();
      try {
        await Promises.close(handle);
      } catch (err) {
        error = new Error(err);
      }
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}
export {
  NodeJSFileWatcherLibrary,
  watchFileContents
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9ub2RlL3dhdGNoZXIvbm9kZWpzL25vZGVqc1dhdGNoZXJMaWIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB3YXRjaCwgcHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBSdW5PbmNlV29ya2VyLCBUaHJvdHRsZWRXb3JrZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNFcXVhbCwgaXNFcXVhbE9yUGFyZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplTkZDIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbm9ybWFsaXphdGlvbi5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSwgam9pbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNMaW51eCwgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcmVhbHBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL25vZGUvZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZUZpbHRlciwgRmlsZUNoYW5nZVR5cGUsIElGaWxlQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2dNZXNzYWdlLCBjb2FsZXNjZUV2ZW50cywgSU5vblJlY3Vyc2l2ZVdhdGNoUmVxdWVzdCwgcGFyc2VXYXRjaGVyUGF0dGVybnMsIElSZWN1cnNpdmVXYXRjaGVyV2l0aFN1YnNjcmliZSwgaXNGaWx0ZXJlZCwgaXNXYXRjaFJlcXVlc3RXaXRoQ29ycmVsYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vd2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBQYXJzZWRQYXR0ZXJuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOb2RlSlNGaWxlV2F0Y2hlckxpYnJhcnkgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHQvLyBBIGRlbGF5IGluIHJlYWN0aW5nIHRvIGZpbGUgZGVsZXRlcyB0byBzdXBwb3J0XG5cdC8vIGF0b21pYyBzYXZlIG9wZXJhdGlvbnMgd2hlcmUgYSB0b29sIG1heSBjaG9zZVxuXHQvLyB0byBkZWxldGUgYSBmaWxlIGJlZm9yZSBjcmVhdGluZyBpdCBhZ2FpbiBmb3Jcblx0Ly8gYW4gdXBkYXRlLlxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBGSUxFX0RFTEVURV9IQU5ETEVSX0RFTEFZID0gMTAwO1xuXG5cdC8vIEEgZGVsYXkgZm9yIGNvbGxlY3RpbmcgZmlsZSBjaGFuZ2VzIGZyb20gbm9kZS5qc1xuXHQvLyBiZWZvcmUgY29sbGVjdGluZyB0aGVtIGZvciBjb2FsZXNjaW5nIGFuZCBlbWl0dGluZ1xuXHQvLyBTYW1lIGRlbGF5IGFzIHVzZWQgZm9yIHRoZSByZWN1cnNpdmUgd2F0Y2hlci5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRklMRV9DSEFOR0VTX0hBTkRMRVJfREVMQVkgPSA3NTtcblxuXHQvLyBSZWR1Y2UgbGlrZWx5aG9vZCBvZiBzcGFtIGZyb20gZmlsZSBldmVudHMgdmlhIHRocm90dGxpbmcuXG5cdC8vIFRoZXNlIG51bWJlcnMgYXJlIGEgYml0IG1vcmUgYWdncmVzc2l2ZSBjb21wYXJlZCB0byB0aGVcblx0Ly8gcmVjdXJzaXZlIHdhdGNoZXIgYmVjYXVzZSB3ZSBjYW4gaGF2ZSBtYW55IGluZGl2aWR1YWxcblx0Ly8gbm9kZS5qcyB3YXRjaGVycyBwZXIgcmVxdWVzdC5cblx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjQ3MjMpXG5cdHByaXZhdGUgcmVhZG9ubHkgdGhyb3R0bGVkRmlsZUNoYW5nZXNFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRocm90dGxlZFdvcmtlcjxJRmlsZUNoYW5nZT4oXG5cdFx0e1xuXHRcdFx0bWF4V29ya0NodW5rU2l6ZTogMTAwLFx0Ly8gb25seSBwcm9jZXNzIHVwIHRvIDEwMCBjaGFuZ2VzIGF0IG9uY2UgYmVmb3JlLi4uXG5cdFx0XHR0aHJvdHRsZURlbGF5OiAyMDAsXHQgIFx0Ly8gLi4ucmVzdGluZyBmb3IgMjAwbXMgdW50aWwgd2UgcHJvY2VzcyBldmVudHMgYWdhaW4uLi5cblx0XHRcdG1heEJ1ZmZlcmVkV29yazogMTAwMDAgXHQvLyAuLi5idXQgbmV2ZXIgYnVmZmVyaW5nIG1vcmUgdGhhbiAxMDAwMCBldmVudHMgaW4gbWVtb3J5XG5cdFx0fSxcblx0XHRldmVudHMgPT4gdGhpcy5vbkRpZEZpbGVzQ2hhbmdlKGV2ZW50cylcblx0KSk7XG5cblx0Ly8gQWdncmVnYXRlIGZpbGUgY2hhbmdlcyBvdmVyIEZJTEVfQ0hBTkdFU19IQU5ETEVSX0RFTEFZXG5cdC8vIHRvIGNvYWxlc2NlIGV2ZW50cyBhbmQgcmVkdWNlIHNwYW0uXG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZUNoYW5nZXNBZ2dyZWdhdG9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VXb3JrZXI8SUZpbGVDaGFuZ2U+KGV2ZW50cyA9PiB0aGlzLmhhbmRsZUZpbGVDaGFuZ2VzKGV2ZW50cyksIE5vZGVKU0ZpbGVXYXRjaGVyTGlicmFyeS5GSUxFX0NIQU5HRVNfSEFORExFUl9ERUxBWSkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZXhjbHVkZXM6IFBhcnNlZFBhdHRlcm5bXTtcblx0cHJpdmF0ZSByZWFkb25seSBpbmNsdWRlczogUGFyc2VkUGF0dGVybltdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGZpbHRlcjogRmlsZUNoYW5nZUZpbHRlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVhbFBhdGggPSBuZXcgTGF6eShhc3luYyAoKSA9PiB7XG5cblx0XHQvLyBUaGlzIHByb3BlcnR5IGlzIGludGVudGlvbmFsbHkgYExhenlgIGFuZCBub3QgdXNpbmcgYHJlYWxjYXNlKClgIGFzIHRoZSBjb3VudGVycGFydFxuXHRcdC8vIGluIHRoZSByZWN1cnNpdmUgd2F0Y2hlciBiZWNhdXNlIG9mIHRoZSBhbW91bnQgb2YgcGF0aHMgdGhpcyB3YXRjaGVyIGlzIGRlYWxpbmcgd2l0aC5cblx0XHQvLyBXZSB0cnkgYXMgbXVjaCBhcyBwb3NzaWJsZSB0byBhdm9pZCBldmVuIG5lZWRpbmcgYHJlYWxwYXRoKClgIGlmIHdlIGNhbiBiZWNhdXNlIGV2ZW5cblx0XHQvLyB0aGF0IG1ldGhvZCBkb2VzIGFuIGBsc3RhdCgpYCBwZXIgc2VnbWVudCBvZiB0aGUgcGF0aC5cblxuXHRcdGxldCByZXN1bHQgPSB0aGlzLnJlcXVlc3QucGF0aDtcblxuXHRcdHRyeSB7XG5cdFx0XHRyZXN1bHQgPSBhd2FpdCByZWFscGF0aCh0aGlzLnJlcXVlc3QucGF0aCk7XG5cblx0XHRcdGlmICh0aGlzLnJlcXVlc3QucGF0aCAhPT0gcmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoYGNvcnJlY3RpbmcgYSBwYXRoIHRvIHdhdGNoIHRoYXQgc2VlbXMgdG8gYmUgYSBzeW1ib2xpYyBsaW5rIChvcmlnaW5hbDogJHt0aGlzLnJlcXVlc3QucGF0aH0sIHJlYWw6ICR7cmVzdWx0fSlgKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSk7XG5cblx0cmVhZG9ubHkgcmVhZHk6IFByb21pc2U8dm9pZD47XG5cblx0cHJpdmF0ZSBfaXNSZXVzaW5nUmVjdXJzaXZlV2F0Y2hlciA9IGZhbHNlO1xuXHRnZXQgaXNSZXVzaW5nUmVjdXJzaXZlV2F0Y2hlcigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2lzUmV1c2luZ1JlY3Vyc2l2ZVdhdGNoZXI7IH1cblxuXHRwcml2YXRlIGRpZEZhaWwgPSBmYWxzZTtcblx0Z2V0IGZhaWxlZCgpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuZGlkRmFpbDsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdDogSU5vblJlY3Vyc2l2ZVdhdGNoUmVxdWVzdCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlY3Vyc2l2ZVdhdGNoZXI6IElSZWN1cnNpdmVXYXRjaGVyV2l0aFN1YnNjcmliZSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9uRGlkRmlsZXNDaGFuZ2U6IChjaGFuZ2VzOiBJRmlsZUNoYW5nZVtdKSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb25EaWRXYXRjaEZhaWw/OiAoKSA9PiB2b2lkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb25Mb2dNZXNzYWdlPzogKG1zZzogSUxvZ01lc3NhZ2UpID0+IHZvaWQsXG5cdFx0cHJpdmF0ZSB2ZXJib3NlTG9nZ2luZz86IGJvb2xlYW5cblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZXhjbHVkZXMgPSBwYXJzZVdhdGNoZXJQYXR0ZXJucyh0aGlzLnJlcXVlc3QucGF0aCwgdGhpcy5yZXF1ZXN0LmV4Y2x1ZGVzKTtcblx0XHR0aGlzLmluY2x1ZGVzID0gdGhpcy5yZXF1ZXN0LmluY2x1ZGVzID8gcGFyc2VXYXRjaGVyUGF0dGVybnModGhpcy5yZXF1ZXN0LnBhdGgsIHRoaXMucmVxdWVzdC5pbmNsdWRlcykgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy5maWx0ZXIgPSBpc1dhdGNoUmVxdWVzdFdpdGhDb3JyZWxhdGlvbih0aGlzLnJlcXVlc3QpID8gdGhpcy5yZXF1ZXN0LmZpbHRlciA6IHVuZGVmaW5lZDsgLy8gZmlsdGVyaW5nIGlzIG9ubHkgZW5hYmxlZCB3aGVuIGNvcnJlbGF0aW5nIGJlY2F1c2Ugd2F0Y2hlcnMgYXJlIG90aGVyd2lzZSBwb3RlbnRpYWxseSByZXVzZWRcblxuXHRcdHRoaXMucmVhZHkgPSB0aGlzLndhdGNoKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHdhdGNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvbWlzZXMuc3RhdCh0aGlzLnJlcXVlc3QucGF0aCk7XG5cblx0XHRcdGlmICh0aGlzLmN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGF3YWl0IHRoaXMuZG9XYXRjaChzdGF0LmlzRGlyZWN0b3J5KCkpKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy50cmFjZShgaWdub3JpbmcgYSBwYXRoIGZvciB3YXRjaGluZyB3aG8ncyBzdGF0IGluZm8gZmFpbGVkIHRvIHJlc29sdmU6ICR7dGhpcy5yZXF1ZXN0LnBhdGh9IChlcnJvcjogJHtlcnJvcn0pYCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubm90aWZ5V2F0Y2hGYWlsZWQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG5vdGlmeVdhdGNoRmFpbGVkKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlkRmFpbCA9IHRydWU7XG5cblx0XHR0aGlzLm9uRGlkV2F0Y2hGYWlsPy4oKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9XYXRjaChpc0RpcmVjdG9yeTogYm9vbGVhbik6IFByb21pc2U8SURpc3Bvc2FibGU+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGlmICh0aGlzLmRvV2F0Y2hXaXRoRXhpc3RpbmdXYXRjaGVyKGlzRGlyZWN0b3J5LCBkaXNwb3NhYmxlcykpIHtcblx0XHRcdHRoaXMudHJhY2UoYHJldXNpbmcgYW4gZXhpc3RpbmcgcmVjdXJzaXZlIHdhdGNoZXIgZm9yICR7dGhpcy5yZXF1ZXN0LnBhdGh9YCk7XG5cdFx0XHR0aGlzLl9pc1JldXNpbmdSZWN1cnNpdmVXYXRjaGVyID0gdHJ1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5faXNSZXVzaW5nUmVjdXJzaXZlV2F0Y2hlciA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgdGhpcy5kb1dhdGNoV2l0aE5vZGVKUyhpc0RpcmVjdG9yeSwgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG5cdHByaXZhdGUgZG9XYXRjaFdpdGhFeGlzdGluZ1dhdGNoZXIoaXNEaXJlY3Rvcnk6IGJvb2xlYW4sIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBib29sZWFuIHtcblx0XHRpZiAoaXNEaXJlY3RvcnkpIHtcblx0XHRcdC8vIFJlY3Vyc2l2ZSB3YXRjaGVyIHJlLXVzZSBpcyBjdXJyZW50bHkgbm90IGVuYWJsZWQgZm9yIHdoZW5cblx0XHRcdC8vIGZvbGRlcnMgYXJlIHdhdGNoZWQuIHRoaXMgaXMgYmVjYXVzZSB0aGUgZGlzcGF0Y2hpbmcgaW4gdGhlXG5cdFx0XHQvLyByZWN1cnNpdmUgd2F0Y2hlciBmb3Igbm9uLXJlY3VyaXZlIHJlcXVlc3RzIGlzIG9wdGltaXplZCBmb3Jcblx0XHRcdC8vIGZpbGUgY2hhbmdlcyAgd2hlcmUgd2UgcmVhbGx5IG9ubHkgbWF0Y2ggb24gdGhlIGV4YWN0IHBhdGhcblx0XHRcdC8vIGFuZCBub3QgY2hpbGQgcGF0aHMuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSh0aGlzLnJlcXVlc3QucGF0aCk7XG5cdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gdGhpcy5yZWN1cnNpdmVXYXRjaGVyPy5zdWJzY3JpYmUodGhpcy5yZXF1ZXN0LnBhdGgsIGFzeW5jIChlcnJvciwgY2hhbmdlKSA9PiB7XG5cdFx0XHRpZiAoZGlzcG9zYWJsZXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIHJldHVybiBlYXJseSBpZiBhbHJlYWR5IGRpc3Bvc2VkXG5cdFx0XHR9XG5cblx0XHRcdGlmIChlcnJvcikge1xuXHRcdFx0XHRjb25zdCB3YXRjaERpc3Bvc2FibGUgPSBhd2FpdCB0aGlzLmRvV2F0Y2goaXNEaXJlY3RvcnkpO1xuXHRcdFx0XHRpZiAoIWRpc3Bvc2FibGVzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQod2F0Y2hEaXNwb3NhYmxlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3YXRjaERpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGNoYW5nZSkge1xuXHRcdFx0XHRpZiAodHlwZW9mIGNoYW5nZS5jSWQgPT09ICdudW1iZXInIHx8IHR5cGVvZiB0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHQvLyBSZS1lbWl0IHRoaXMgY2hhbmdlIHdpdGggdGhlIGNvcnJlbGF0aW9uIGlkIG9mIHRoZSByZXF1ZXN0XG5cdFx0XHRcdFx0Ly8gc28gdGhhdCB0aGUgY2xpZW50IGNhbiBjb3JyZWxhdGUgdGhlIGV2ZW50IHdpdGggdGhlIHJlcXVlc3Rcblx0XHRcdFx0XHQvLyBwcm9wZXJseS4gV2l0aG91dCBjb3JyZWxhdGlvbiwgd2UgZG8gbm90IGhhdmUgdG8gZG8gdGhhdFxuXHRcdFx0XHRcdC8vIGJlY2F1c2UgdGhlIGV2ZW50IHdpbGwgYXBwZWFyIG9uIHRoZSBnbG9iYWwgbGlzdGVuZXIgYWxyZWFkeS5cblx0XHRcdFx0XHR0aGlzLm9uRmlsZUNoYW5nZSh7IHJlc291cmNlLCB0eXBlOiBjaGFuZ2UudHlwZSwgY0lkOiB0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZCB9LCB0cnVlIC8qIHNraXAgZXhjbHVkZXMvaW5jbHVkZXMgKGZpbGUgaXMgZXhwbGljaXRseSB3YXRjaGVkKSAqLyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmIChzdWJzY3JpcHRpb24pIHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChzdWJzY3JpcHRpb24pO1xuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvV2F0Y2hXaXRoTm9kZUpTKGlzRGlyZWN0b3J5OiBib29sZWFuLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVhbFBhdGggPSBhd2FpdCB0aGlzLnJlYWxQYXRoLnZhbHVlO1xuXG5cdFx0Ly8gbWFjT1M6IHdhdGNoaW5nIHNhbWJhIHNoYXJlcyBjYW4gY3Jhc2ggVlNDb2RlIHNvIHdlIGRvXG5cdFx0Ly8gYSBzaW1wbGUgY2hlY2sgZm9yIHRoZSBmaWxlIHBhdGggcG9pbnRpbmcgdG8gL1ZvbHVtZXNcblx0XHQvLyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwNjg3OSlcblx0XHQvLyBUT0RPQGVsZWN0cm9uIHRoaXMgbmVlZHMgYSByZXZpc2l0IHdoZW4gdGhlIGNyYXNoIGlzXG5cdFx0Ly8gZml4ZWQgb3IgbWl0aWdhdGVkIHVwc3RyZWFtLlxuXHRcdGlmIChpc01hY2ludG9zaCAmJiBpc0VxdWFsT3JQYXJlbnQocmVhbFBhdGgsICcvVm9sdW1lcy8nLCB0cnVlKSkge1xuXHRcdFx0dGhpcy5lcnJvcihgUmVmdXNpbmcgdG8gd2F0Y2ggJHtyZWFsUGF0aH0gZm9yIGNoYW5nZXMgdXNpbmcgZnMud2F0Y2goKSBmb3IgcG9zc2libHkgYmVpbmcgYSBuZXR3b3JrIHNoYXJlIHdoZXJlIHdhdGNoaW5nIGlzIHVucmVsaWFibGUgYW5kIHVuc3RhYmxlLmApO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKHRoaXMuY3RzLnRva2VuKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cblx0XHRjb25zdCB3YXRjaGVyRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7IC8vIHdlIG5lZWQgYSBzZXBhcmF0ZSBkaXNwb3NhYmxlIHN0b3JlIGJlY2F1c2Ugd2UgcmUtY3JlYXRlIHRoZSB3YXRjaGVyIGZyb20gd2l0aGluIGluIHNvbWUgY2FzZXNcblx0XHRkaXNwb3NhYmxlcy5hZGQod2F0Y2hlckRpc3Bvc2FibGVzKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXF1ZXN0UmVzb3VyY2UgPSBVUkkuZmlsZSh0aGlzLnJlcXVlc3QucGF0aCk7XG5cdFx0XHRjb25zdCBwYXRoQmFzZW5hbWUgPSBiYXNlbmFtZShyZWFsUGF0aCk7XG5cblx0XHRcdC8vIENyZWF0aW5nIHdhdGNoZXIgY2FuIGZhaWwgd2l0aCBhbiBleGNlcHRpb25cblx0XHRcdGNvbnN0IHdhdGNoZXIgPSB3YXRjaChyZWFsUGF0aCk7XG5cdFx0XHR3YXRjaGVyRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdHdhdGNoZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cdFx0XHRcdHdhdGNoZXIuY2xvc2UoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy50cmFjZShgU3RhcnRlZCB3YXRjaGluZzogJyR7cmVhbFBhdGh9J2ApO1xuXG5cdFx0XHQvLyBGb2xkZXI6IHJlc29sdmUgY2hpbGRyZW4gdG8gZW1pdCBwcm9wZXIgZXZlbnRzXG5cdFx0XHRjb25zdCBmb2xkZXJDaGlsZHJlbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0aWYgKGlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKHJlYWxQYXRoKSkge1xuXHRcdFx0XHRcdFx0Zm9sZGVyQ2hpbGRyZW4uYWRkKGNoaWxkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5lcnJvcihlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1hcFBhdGhUb1N0YXREaXNwb3NhYmxlID0gbmV3IE1hcDxzdHJpbmcsIElEaXNwb3NhYmxlPigpO1xuXHRcdFx0d2F0Y2hlckRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFssIGRpc3Bvc2FibGVdIG9mIG1hcFBhdGhUb1N0YXREaXNwb3NhYmxlKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bWFwUGF0aFRvU3RhdERpc3Bvc2FibGUuY2xlYXIoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0d2F0Y2hlci5vbignZXJyb3InLCAoY29kZTogbnVtYmVyLCBzaWduYWw6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5lcnJvcihgRmFpbGVkIHRvIHdhdGNoICR7cmVhbFBhdGh9IGZvciBjaGFuZ2VzIHVzaW5nIGZzLndhdGNoKCkgKCR7Y29kZX0sICR7c2lnbmFsfSlgKTtcblxuXHRcdFx0XHR0aGlzLm5vdGlmeVdhdGNoRmFpbGVkKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0d2F0Y2hlci5vbignY2hhbmdlJywgKHR5cGUsIHJhdykgPT4ge1xuXHRcdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBpZ25vcmUgaWYgYWxyZWFkeSBkaXNwb3NlZFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMudmVyYm9zZUxvZ2dpbmcpIHtcblx0XHRcdFx0XHR0aGlzLnRyYWNlV2l0aENvcnJlbGF0aW9uKGBbcmF3XSBbXCIke3R5cGV9XCJdICR7cmF3fWApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTm9ybWFsaXplIGZpbGUgbmFtZVxuXHRcdFx0XHRsZXQgY2hhbmdlZEZpbGVOYW1lID0gJyc7XG5cdFx0XHRcdGlmIChyYXcpIHsgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzM4MTkxXG5cdFx0XHRcdFx0Y2hhbmdlZEZpbGVOYW1lID0gcmF3LnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdFx0XHQvLyBNYWM6IHVzZXMgTkZEIHVuaWNvZGUgZm9ybSBvbiBkaXNrLCBidXQgd2Ugd2FudCBORkNcblx0XHRcdFx0XHRcdC8vIFNlZSBhbHNvIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXMvMjE2NVxuXHRcdFx0XHRcdFx0Y2hhbmdlZEZpbGVOYW1lID0gbm9ybWFsaXplTkZDKGNoYW5nZWRGaWxlTmFtZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFjaGFuZ2VkRmlsZU5hbWUgfHwgKHR5cGUgIT09ICdjaGFuZ2UnICYmIHR5cGUgIT09ICdyZW5hbWUnKSkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gaWdub3JlIHVuZXhwZWN0ZWQgZXZlbnRzXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBGb2xkZXJcblx0XHRcdFx0aWYgKGlzRGlyZWN0b3J5KSB7XG5cblx0XHRcdFx0XHQvLyBGb2xkZXIgY2hpbGQgYWRkZWQvZGVsZXRlZFxuXHRcdFx0XHRcdGlmICh0eXBlID09PSAncmVuYW1lJykge1xuXG5cdFx0XHRcdFx0XHQvLyBDYW5jZWwgYW55IHByZXZpb3VzIHN0YXRzIGZvciB0aGlzIGZpbGUgaWYgZXhpc3Rpbmdcblx0XHRcdFx0XHRcdG1hcFBhdGhUb1N0YXREaXNwb3NhYmxlLmdldChjaGFuZ2VkRmlsZU5hbWUpPy5kaXNwb3NlKCk7XG5cblx0XHRcdFx0XHRcdC8vIFdhaXQgYSBiaXQgYW5kIHRyeSBzZWUgaWYgdGhlIGZpbGUgc3RpbGwgZXhpc3RzIG9uIGRpc2tcblx0XHRcdFx0XHRcdC8vIHRvIGRlY2lkZSBvbiB0aGUgcmVzdWx0aW5nIGV2ZW50XG5cdFx0XHRcdFx0XHRjb25zdCB0aW1lb3V0SGFuZGxlID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdG1hcFBhdGhUb1N0YXREaXNwb3NhYmxlLmRlbGV0ZShjaGFuZ2VkRmlsZU5hbWUpO1xuXG5cdFx0XHRcdFx0XHRcdC8vIERlcGVuZGluZyBvbiB0aGUgT1MgdGhlIHdhdGNoZXIgcnVucyBvbiwgdGhlcmVcblx0XHRcdFx0XHRcdFx0Ly8gaXMgZGlmZmVyZW50IGJlaGF2aW91ciBmb3Igd2hlbiB0aGUgd2F0Y2hlZFxuXHRcdFx0XHRcdFx0XHQvLyBmb2xkZXIgcGF0aCBpcyBiZWluZyBkZWxldGVkOlxuXHRcdFx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdFx0XHQvLyAtICAgbWFjT1M6IG5vdCByZXBvcnRlZCBidXQgZXZlbnRzIGNvbnRpbnVlIHRvXG5cdFx0XHRcdFx0XHRcdC8vICAgICAgICAgICAgd29yayBldmVuIHdoZW4gdGhlIGZvbGRlciBpcyBicm91Z2h0XG5cdFx0XHRcdFx0XHRcdC8vICAgICAgICAgICAgYmFjaywgdGhvdWdoIGl0IHNlZW1zIGV2ZXJ5IGNoYW5nZVxuXHRcdFx0XHRcdFx0XHQvLyAgICAgICAgICAgIHRvIGEgZmlsZSBpcyByZXBvcnRlZCBhcyBcInJlbmFtZVwiXG5cdFx0XHRcdFx0XHRcdC8vIC0gICBMaW51eDogXCJyZW5hbWVcIiBldmVudCBpcyByZXBvcnRlZCB3aXRoIHRoZVxuXHRcdFx0XHRcdFx0XHQvLyAgICAgICAgICAgIG5hbWUgb2YgdGhlIGZvbGRlciBhbmQgZXZlbnRzIHN0b3Bcblx0XHRcdFx0XHRcdFx0Ly8gICAgICAgICAgICB3b3JraW5nXG5cdFx0XHRcdFx0XHRcdC8vIC0gV2luZG93czogYW4gRVBFUk0gZXJyb3IgaXMgdGhyb3duIHRoYXQgd2Vcblx0XHRcdFx0XHRcdFx0Ly8gICAgICAgICAgICBoYW5kbGUgZnJvbSB0aGUgYG9uKCdlcnJvcicpYCBldmVudFxuXHRcdFx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdFx0XHQvLyBXZSBkbyBub3QgcmUtYXR0YWNoIHRoZSB3YXRjaGVyIGFmdGVyIHRpbWVvdXRcblx0XHRcdFx0XHRcdFx0Ly8gdGhvdWdoIGFzIHdlIGRvIGZvciBmaWxlIHdhdGNoZXMgYmVjYXVzZSBmb3Jcblx0XHRcdFx0XHRcdFx0Ly8gZmlsZSB3YXRjaGluZyBzcGVjaWZpY2FsbHkgd2Ugd2FudCB0byBoYW5kbGVcblx0XHRcdFx0XHRcdFx0Ly8gdGhlIGF0b21pYy13cml0ZSBjYXNlcyB3aGVyZSB0aGUgZmlsZSBpcyBiZWluZ1xuXHRcdFx0XHRcdFx0XHQvLyBkZWxldGVkIGFuZCByZWNyZWF0ZWQgd2l0aCBkaWZmZXJlbnQgY29udGVudHMuXG5cdFx0XHRcdFx0XHRcdGlmIChpc0VxdWFsKGNoYW5nZWRGaWxlTmFtZSwgcGF0aEJhc2VuYW1lLCAhaXNMaW51eCkgJiYgIWF3YWl0IFByb21pc2VzLmV4aXN0cyhyZWFsUGF0aCkpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLm9uV2F0Y2hlZFBhdGhEZWxldGVkKHJlcXVlc3RSZXNvdXJjZSk7XG5cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Ly8gSW4gb3JkZXIgdG8gcHJvcGVybHkgZGV0ZWN0IHJlbmFtZXMgb24gYSBjYXNlLWluc2Vuc2l0aXZlXG5cdFx0XHRcdFx0XHRcdC8vIGZpbGUgc3lzdGVtLCB3ZSBuZWVkIHRvIHVzZSBgZXhpc3RzQ2hpbGRTdHJpY3RDYXNlYCBoZWxwZXJcblx0XHRcdFx0XHRcdFx0Ly8gYmVjYXVzZSBvdGhlcndpc2Ugd2Ugd291bGQgd3JvbmdseSBhc3N1bWUgYSBmaWxlIGV4aXN0c1xuXHRcdFx0XHRcdFx0XHQvLyB3aGVuIGl0IHdhcyByZW5hbWVkIHRvIHNhbWUgbmFtZSBidXQgZGlmZmVyZW50IGNhc2UuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZpbGVFeGlzdHMgPSBhd2FpdCB0aGlzLmV4aXN0c0NoaWxkU3RyaWN0Q2FzZShqb2luKHJlYWxQYXRoLCBjaGFuZ2VkRmlsZU5hbWUpKTtcblxuXHRcdFx0XHRcdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBpZ25vcmUgaWYgZGlzcG9zZWQgYnkgbm93XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHQvLyBGaWd1cmUgb3V0IHRoZSBjb3JyZWN0IGV2ZW50IHR5cGU6XG5cdFx0XHRcdFx0XHRcdC8vIEZpbGUgRXhpc3RzOiBlaXRoZXIgJ2FkZGVkJyBvciAndXBkYXRlZCcgaWYga25vd24gYmVmb3JlXG5cdFx0XHRcdFx0XHRcdC8vIEZpbGUgRG9lcyBub3QgRXhpc3Q6IGFsd2F5cyAnZGVsZXRlZCdcblx0XHRcdFx0XHRcdFx0bGV0IHR5cGU6IEZpbGVDaGFuZ2VUeXBlO1xuXHRcdFx0XHRcdFx0XHRpZiAoZmlsZUV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChmb2xkZXJDaGlsZHJlbi5oYXMoY2hhbmdlZEZpbGVOYW1lKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZSA9IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGUgPSBGaWxlQ2hhbmdlVHlwZS5BRERFRDtcblx0XHRcdFx0XHRcdFx0XHRcdGZvbGRlckNoaWxkcmVuLmFkZChjaGFuZ2VkRmlsZU5hbWUpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRmb2xkZXJDaGlsZHJlbi5kZWxldGUoY2hhbmdlZEZpbGVOYW1lKTtcblx0XHRcdFx0XHRcdFx0XHR0eXBlID0gRmlsZUNoYW5nZVR5cGUuREVMRVRFRDtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHRoaXMub25GaWxlQ2hhbmdlKHsgcmVzb3VyY2U6IGpvaW5QYXRoKHJlcXVlc3RSZXNvdXJjZSwgY2hhbmdlZEZpbGVOYW1lKSwgdHlwZSwgY0lkOiB0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZCB9KTtcblx0XHRcdFx0XHRcdH0sIE5vZGVKU0ZpbGVXYXRjaGVyTGlicmFyeS5GSUxFX0RFTEVURV9IQU5ETEVSX0RFTEFZKTtcblxuXHRcdFx0XHRcdFx0bWFwUGF0aFRvU3RhdERpc3Bvc2FibGUuc2V0KGNoYW5nZWRGaWxlTmFtZSwgdG9EaXNwb3NhYmxlKCgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0SGFuZGxlKSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEZvbGRlciBjaGlsZCBjaGFuZ2VkXG5cdFx0XHRcdFx0ZWxzZSB7XG5cblx0XHRcdFx0XHRcdC8vIEZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgZXZlbnQgdHlwZTogaWYgdGhpcyBpcyB0aGVcblx0XHRcdFx0XHRcdC8vIGZpcnN0IHRpbWUgd2Ugc2VlIHRoaXMgY2hpbGQsIGl0IGNhbiBvbmx5IGJlIGFkZGVkXG5cdFx0XHRcdFx0XHRsZXQgdHlwZTogRmlsZUNoYW5nZVR5cGU7XG5cdFx0XHRcdFx0XHRpZiAoZm9sZGVyQ2hpbGRyZW4uaGFzKGNoYW5nZWRGaWxlTmFtZSkpIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQ7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gRmlsZUNoYW5nZVR5cGUuQURERUQ7XG5cdFx0XHRcdFx0XHRcdGZvbGRlckNoaWxkcmVuLmFkZChjaGFuZ2VkRmlsZU5hbWUpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0aGlzLm9uRmlsZUNoYW5nZSh7IHJlc291cmNlOiBqb2luUGF0aChyZXF1ZXN0UmVzb3VyY2UsIGNoYW5nZWRGaWxlTmFtZSksIHR5cGUsIGNJZDogdGhpcy5yZXF1ZXN0LmNvcnJlbGF0aW9uSWQgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRmlsZVxuXHRcdFx0XHRlbHNlIHtcblxuXHRcdFx0XHRcdC8vIEZpbGUgYWRkZWQvZGVsZXRlZFxuXHRcdFx0XHRcdGlmICh0eXBlID09PSAncmVuYW1lJyB8fCAhaXNFcXVhbChjaGFuZ2VkRmlsZU5hbWUsIHBhdGhCYXNlbmFtZSwgIWlzTGludXgpKSB7XG5cblx0XHRcdFx0XHRcdC8vIERlcGVuZGluZyBvbiB0aGUgT1MgdGhlIHdhdGNoZXIgcnVucyBvbiwgdGhlcmVcblx0XHRcdFx0XHRcdC8vIGlzIGRpZmZlcmVudCBiZWhhdmlvdXIgZm9yIHdoZW4gdGhlIHdhdGNoZWRcblx0XHRcdFx0XHRcdC8vIGZpbGUgcGF0aCBpcyBiZWluZyBkZWxldGVkOlxuXHRcdFx0XHRcdFx0Ly9cblx0XHRcdFx0XHRcdC8vIC0gICBtYWNPUzogXCJyZW5hbWVcIiBldmVudCBpcyByZXBvcnRlZCBhbmQgZXZlbnRzXG5cdFx0XHRcdFx0XHQvLyAgICAgICAgICAgIHN0b3Agd29ya2luZ1xuXHRcdFx0XHRcdFx0Ly8gLSAgIExpbnV4OiBcInJlbmFtZVwiIGV2ZW50IGlzIHJlcG9ydGVkIGFuZCBldmVudHNcblx0XHRcdFx0XHRcdC8vICAgICAgICAgICAgc3RvcCB3b3JraW5nXG5cdFx0XHRcdFx0XHQvLyAtIFdpbmRvd3M6IFwicmVuYW1lXCIgZXZlbnQgaXMgcmVwb3J0ZWQgYW5kIGV2ZW50c1xuXHRcdFx0XHRcdFx0Ly8gICAgICAgICAgICBjb250aW51ZSB0byB3b3JrIHdoZW4gZmlsZSBpcyByZXN0b3JlZFxuXHRcdFx0XHRcdFx0Ly9cblx0XHRcdFx0XHRcdC8vIEFzIG9wcG9zZWQgdG8gZm9sZGVyIHdhdGNoaW5nLCB3ZSByZS1hdHRhY2ggdGhlXG5cdFx0XHRcdFx0XHQvLyB3YXRjaGVyIGFmdGVyIGJyaWVmIHRpbWVvdXQgdG8gc3VwcG9ydCBcImF0b21pYyBzYXZlXCJcblx0XHRcdFx0XHRcdC8vIG9wZXJhdGlvbnMgd2hlcmUgYSB0b29sIG1heSBkZWNpZGUgdG8gZGVsZXRlIGEgZmlsZVxuXHRcdFx0XHRcdFx0Ly8gYW5kIHRoZW4gY3JlYXRlIGl0IHdpdGggdGhlIHVwZGF0ZWQgY29udGVudHMuXG5cdFx0XHRcdFx0XHQvL1xuXHRcdFx0XHRcdFx0Ly8gRGlmZmVyZW50IHRvIGZvbGRlciB3YXRjaGluZywgd2UgZW1pdCBhIGRlbGV0ZSBldmVudFxuXHRcdFx0XHRcdFx0Ly8gdGhvdWdoIHdlIG5ldmVyIGRldGVjdCB3aGVuIHRoZSBmaWxlIGlzIGJyb3VnaHQgYmFja1xuXHRcdFx0XHRcdFx0Ly8gYmVjYXVzZSB0aGUgd2F0Y2hlciBpcyBkaXNwb3NlZCB0aGVuLlxuXG5cdFx0XHRcdFx0XHRjb25zdCB0aW1lb3V0SGFuZGxlID0gc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGZpbGVFeGlzdHMgPSBhd2FpdCBQcm9taXNlcy5leGlzdHMocmVhbFBhdGgpO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47IC8vIGlnbm9yZSBpZiBkaXNwb3NlZCBieSBub3dcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vIEZpbGUgc3RpbGwgZXhpc3RzLCBzbyBlbWl0IGFzIGNoYW5nZSBldmVudCBhbmQgcmVhcHBseSB0aGUgd2F0Y2hlclxuXHRcdFx0XHRcdFx0XHRpZiAoZmlsZUV4aXN0cykge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMub25GaWxlQ2hhbmdlKHsgcmVzb3VyY2U6IHJlcXVlc3RSZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgY0lkOiB0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZCB9LCB0cnVlIC8qIHNraXAgZXhjbHVkZXMvaW5jbHVkZXMgKGZpbGUgaXMgZXhwbGljaXRseSB3YXRjaGVkKSAqLyk7XG5cblx0XHRcdFx0XHRcdFx0XHR3YXRjaGVyRGlzcG9zYWJsZXMuYWRkKGF3YWl0IHRoaXMuZG9XYXRjaChmYWxzZSkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Ly8gRmlsZSBzZWVtcyB0byBiZSByZWFsbHkgZ29uZSwgc28gZW1pdCBhIGRlbGV0ZWQgYW5kIGZhaWxlZCBldmVudFxuXHRcdFx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLm9uV2F0Y2hlZFBhdGhEZWxldGVkKHJlcXVlc3RSZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0sIE5vZGVKU0ZpbGVXYXRjaGVyTGlicmFyeS5GSUxFX0RFTEVURV9IQU5ETEVSX0RFTEFZKTtcblxuXHRcdFx0XHRcdFx0Ly8gVmVyeSBpbXBvcnRhbnQgdG8gZGlzcG9zZSB0aGUgd2F0Y2hlciB3aGljaCBub3cgcG9pbnRzIHRvIGEgc3RhbGUgaW5vZGVcblx0XHRcdFx0XHRcdC8vIGFuZCB3aXJlIGluIGEgbmV3IGRpc3Bvc2FibGUgdGhhdCB0cmFja3Mgb3VyIHRpbWVvdXQgdGhhdCBpcyBpbnN0YWxsZWRcblx0XHRcdFx0XHRcdHdhdGNoZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0XHRcdFx0d2F0Y2hlckRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gRmlsZSBjaGFuZ2VkXG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9uRmlsZUNoYW5nZSh7IHJlc291cmNlOiByZXF1ZXN0UmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsIGNJZDogdGhpcy5yZXF1ZXN0LmNvcnJlbGF0aW9uSWQgfSwgdHJ1ZSAvKiBza2lwIGV4Y2x1ZGVzL2luY2x1ZGVzIChmaWxlIGlzIGV4cGxpY2l0bHkgd2F0Y2hlZCkgKi8pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IoYEZhaWxlZCB0byB3YXRjaCAke3JlYWxQYXRofSBmb3IgY2hhbmdlcyB1c2luZyBmcy53YXRjaCgpICgke2Vycm9yLnRvU3RyaW5nKCl9KWApO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm5vdGlmeVdhdGNoRmFpbGVkKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbldhdGNoZWRQYXRoRGVsZXRlZChyZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy53YXJuKCdXYXRjaGVyIHNodXRkb3duIGJlY2F1c2Ugd2F0Y2hlZCBwYXRoIGdvdCBkZWxldGVkJyk7XG5cblx0XHQvLyBFbWl0IGV2ZW50cyBhbmQgZmx1c2ggaW4gY2FzZSB0aGUgd2F0Y2hlciBnZXRzIGRpc3Bvc2VkXG5cdFx0dGhpcy5vbkZpbGVDaGFuZ2UoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCwgY0lkOiB0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZCB9LCB0cnVlIC8qIHNraXAgZXhjbHVkZXMvaW5jbHVkZXMgKGZpbGUgaXMgZXhwbGljaXRseSB3YXRjaGVkKSAqLyk7XG5cdFx0dGhpcy5maWxlQ2hhbmdlc0FnZ3JlZ2F0b3IuZmx1c2goKTtcblxuXHRcdHRoaXMubm90aWZ5V2F0Y2hGYWlsZWQoKTtcblx0fVxuXG5cdHByaXZhdGUgb25GaWxlQ2hhbmdlKGV2ZW50OiBJRmlsZUNoYW5nZSwgc2tpcEluY2x1ZGVFeGNsdWRlQ2hlY2tzID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMb2dnaW5nXG5cdFx0aWYgKHRoaXMudmVyYm9zZUxvZ2dpbmcpIHtcblx0XHRcdHRoaXMudHJhY2VXaXRoQ29ycmVsYXRpb24oYCR7ZXZlbnQudHlwZSA9PT0gRmlsZUNoYW5nZVR5cGUuQURERUQgPyAnW0FEREVEXScgOiBldmVudC50eXBlID09PSBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEID8gJ1tERUxFVEVEXScgOiAnW0NIQU5HRURdJ30gJHtldmVudC5yZXNvdXJjZS5mc1BhdGh9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIHRvIGFnZ3JlZ2F0b3IgdW5sZXNzIGV4Y2x1ZGVkIG9yIG5vdCBpbmNsdWRlZCAobm90IGlmIGV4cGxpY2l0bHkgZGlzYWJsZWQpXG5cdFx0aWYgKCFza2lwSW5jbHVkZUV4Y2x1ZGVDaGVja3MgJiYgdGhpcy5leGNsdWRlcy5zb21lKGV4Y2x1ZGUgPT4gZXhjbHVkZShldmVudC5yZXNvdXJjZS5mc1BhdGgpKSkge1xuXHRcdFx0aWYgKHRoaXMudmVyYm9zZUxvZ2dpbmcpIHtcblx0XHRcdFx0dGhpcy50cmFjZVdpdGhDb3JyZWxhdGlvbihgID4+IGlnbm9yZWQgKGV4Y2x1ZGVkKSAke2V2ZW50LnJlc291cmNlLmZzUGF0aH1gKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFza2lwSW5jbHVkZUV4Y2x1ZGVDaGVja3MgJiYgdGhpcy5pbmNsdWRlcyAmJiB0aGlzLmluY2x1ZGVzLmxlbmd0aCA+IDAgJiYgIXRoaXMuaW5jbHVkZXMuc29tZShpbmNsdWRlID0+IGluY2x1ZGUoZXZlbnQucmVzb3VyY2UuZnNQYXRoKSkpIHtcblx0XHRcdGlmICh0aGlzLnZlcmJvc2VMb2dnaW5nKSB7XG5cdFx0XHRcdHRoaXMudHJhY2VXaXRoQ29ycmVsYXRpb24oYCA+PiBpZ25vcmVkIChub3QgaW5jbHVkZWQpICR7ZXZlbnQucmVzb3VyY2UuZnNQYXRofWApO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmZpbGVDaGFuZ2VzQWdncmVnYXRvci53b3JrKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUZpbGVDaGFuZ2VzKGZpbGVDaGFuZ2VzOiBJRmlsZUNoYW5nZVtdKTogdm9pZCB7XG5cblx0XHQvLyBDb2FsZXNjZSBldmVudHM6IG1lcmdlIGV2ZW50cyBvZiBzYW1lIGtpbmRcblx0XHRjb25zdCBjb2FsZXNjZWRGaWxlQ2hhbmdlcyA9IGNvYWxlc2NlRXZlbnRzKGZpbGVDaGFuZ2VzKTtcblxuXHRcdC8vIEZpbHRlciBldmVudHM6IGJhc2VkIG9uIHJlcXVlc3QgZmlsdGVyIHByb3BlcnR5XG5cdFx0Y29uc3QgZmlsdGVyZWRFdmVudHM6IElGaWxlQ2hhbmdlW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIGNvYWxlc2NlZEZpbGVDaGFuZ2VzKSB7XG5cdFx0XHRpZiAoaXNGaWx0ZXJlZChldmVudCwgdGhpcy5maWx0ZXIpKSB7XG5cdFx0XHRcdGlmICh0aGlzLnZlcmJvc2VMb2dnaW5nKSB7XG5cdFx0XHRcdFx0dGhpcy50cmFjZVdpdGhDb3JyZWxhdGlvbihgID4+IGlnbm9yZWQgKGZpbHRlcmVkKSAke2V2ZW50LnJlc291cmNlLmZzUGF0aH1gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRmaWx0ZXJlZEV2ZW50cy5wdXNoKGV2ZW50KTtcblx0XHR9XG5cblx0XHRpZiAoZmlsdGVyZWRFdmVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTG9nZ2luZ1xuXHRcdGlmICh0aGlzLnZlcmJvc2VMb2dnaW5nKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIGZpbHRlcmVkRXZlbnRzKSB7XG5cdFx0XHRcdHRoaXMudHJhY2VXaXRoQ29ycmVsYXRpb24oYCA+PiBub3JtYWxpemVkICR7ZXZlbnQudHlwZSA9PT0gRmlsZUNoYW5nZVR5cGUuQURERUQgPyAnW0FEREVEXScgOiBldmVudC50eXBlID09PSBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEID8gJ1tERUxFVEVEXScgOiAnW0NIQU5HRURdJ30gJHtldmVudC5yZXNvdXJjZS5mc1BhdGh9YCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQnJvYWRjYXN0IHRvIGNsaWVudHMgdmlhIHRocm90dGxlZCBlbWl0dGVyXG5cdFx0Y29uc3Qgd29ya2VkID0gdGhpcy50aHJvdHRsZWRGaWxlQ2hhbmdlc0VtaXR0ZXIud29yayhmaWx0ZXJlZEV2ZW50cyk7XG5cblx0XHQvLyBMb2dnaW5nXG5cdFx0aWYgKCF3b3JrZWQpIHtcblx0XHRcdHRoaXMud2Fybihgc3RhcnRlZCBpZ25vcmluZyBldmVudHMgZHVlIHRvIHRvbyBtYW55IGZpbGUgY2hhbmdlIGV2ZW50cyBhdCBvbmNlIChpbmNvbWluZzogJHtmaWx0ZXJlZEV2ZW50cy5sZW5ndGh9LCBtb3N0IHJlY2VudCBjaGFuZ2U6ICR7ZmlsdGVyZWRFdmVudHNbMF0ucmVzb3VyY2UuZnNQYXRofSkuIFVzZSAnZmlsZXMud2F0Y2hlckV4Y2x1ZGUnIHNldHRpbmcgdG8gZXhjbHVkZSBmb2xkZXJzIHdpdGggbG90cyBvZiBjaGFuZ2luZyBmaWxlcyAoZS5nLiBjb21waWxhdGlvbiBvdXRwdXQpLmApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy50aHJvdHRsZWRGaWxlQ2hhbmdlc0VtaXR0ZXIucGVuZGluZyA+IDApIHtcblx0XHRcdFx0dGhpcy50cmFjZShgc3RhcnRlZCB0aHJvdHRsaW5nIGV2ZW50cyBkdWUgdG8gbGFyZ2UgYW1vdW50IG9mIGZpbGUgY2hhbmdlIGV2ZW50cyBhdCBvbmNlIChwZW5kaW5nOiAke3RoaXMudGhyb3R0bGVkRmlsZUNoYW5nZXNFbWl0dGVyLnBlbmRpbmd9LCBtb3N0IHJlY2VudCBjaGFuZ2U6ICR7ZmlsdGVyZWRFdmVudHNbMF0ucmVzb3VyY2UuZnNQYXRofSkuIFVzZSAnZmlsZXMud2F0Y2hlckV4Y2x1ZGUnIHNldHRpbmcgdG8gZXhjbHVkZSBmb2xkZXJzIHdpdGggbG90cyBvZiBjaGFuZ2luZyBmaWxlcyAoZS5nLiBjb21waWxhdGlvbiBvdXRwdXQpLmApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZXhpc3RzQ2hpbGRTdHJpY3RDYXNlKHBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmIChpc0xpbnV4KSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZXMuZXhpc3RzKHBhdGgpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwYXRoQmFzZW5hbWUgPSBiYXNlbmFtZShwYXRoKTtcblx0XHRcdGNvbnN0IGNoaWxkcmVuID0gYXdhaXQgUHJvbWlzZXMucmVhZGRpcihkaXJuYW1lKHBhdGgpKTtcblxuXHRcdFx0cmV0dXJuIGNoaWxkcmVuLnNvbWUoY2hpbGQgPT4gY2hpbGQgPT09IHBhdGhCYXNlbmFtZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMudHJhY2UoZXJyb3IpO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0c2V0VmVyYm9zZUxvZ2dpbmcodmVyYm9zZUxvZ2dpbmc6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLnZlcmJvc2VMb2dnaW5nID0gdmVyYm9zZUxvZ2dpbmc7XG5cdH1cblxuXHRwcml2YXRlIGVycm9yKGVycm9yOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHR0aGlzLm9uTG9nTWVzc2FnZT8uKHsgdHlwZTogJ2Vycm9yJywgbWVzc2FnZTogYFtGaWxlIFdhdGNoZXIgKG5vZGUuanMpXSAke2Vycm9yfWAgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHRoaXMub25Mb2dNZXNzYWdlPy4oeyB0eXBlOiAnd2FybicsIG1lc3NhZ2U6IGBbRmlsZSBXYXRjaGVyIChub2RlLmpzKV0gJHttZXNzYWdlfWAgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkICYmIHRoaXMudmVyYm9zZUxvZ2dpbmcpIHtcblx0XHRcdHRoaXMub25Mb2dNZXNzYWdlPy4oeyB0eXBlOiAndHJhY2UnLCBtZXNzYWdlOiBgW0ZpbGUgV2F0Y2hlciAobm9kZS5qcyldICR7bWVzc2FnZX1gIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdHJhY2VXaXRoQ29ycmVsYXRpb24obWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCAmJiB0aGlzLnZlcmJvc2VMb2dnaW5nKSB7XG5cdFx0XHR0aGlzLnRyYWNlKGAke21lc3NhZ2V9JHt0eXBlb2YgdGhpcy5yZXF1ZXN0LmNvcnJlbGF0aW9uSWQgPT09ICdudW1iZXInID8gYCA8JHt0aGlzLnJlcXVlc3QuY29ycmVsYXRpb25JZH0+IGAgOiBgYH1gKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuY3RzLmRpc3Bvc2UodHJ1ZSk7XG5cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuLyoqXG4gKiBXYXRjaCB0aGUgcHJvdmlkZWQgYHBhdGhgIGZvciBjaGFuZ2VzIGFuZCByZXR1cm5cbiAqIHRoZSBkYXRhIGluIGNodW5rcyBvZiBgVWludDhBcnJheWAgZm9yIGZ1cnRoZXIgdXNlLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2F0Y2hGaWxlQ29udGVudHMocGF0aDogc3RyaW5nLCBvbkRhdGE6IChjaHVuazogVWludDhBcnJheSkgPT4gdm9pZCwgb25SZWFkeTogKCkgPT4gdm9pZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBidWZmZXJTaXplID0gNTEyKTogUHJvbWlzZTx2b2lkPiB7XG5cdGNvbnN0IGhhbmRsZSA9IGF3YWl0IFByb21pc2VzLm9wZW4ocGF0aCwgJ3InKTtcblx0Y29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGJ1ZmZlclNpemUpO1xuXG5cdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0b2tlbik7XG5cblx0bGV0IGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0bGV0IGlzUmVhZGluZyA9IGZhbHNlO1xuXG5cdGNvbnN0IHJlcXVlc3Q6IElOb25SZWN1cnNpdmVXYXRjaFJlcXVlc3QgPSB7IHBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9O1xuXHRjb25zdCB3YXRjaGVyID0gbmV3IE5vZGVKU0ZpbGVXYXRjaGVyTGlicmFyeShyZXF1ZXN0LCB1bmRlZmluZWQsIGNoYW5nZXMgPT4ge1xuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IHsgdHlwZSB9IG9mIGNoYW5nZXMpIHtcblx0XHRcdFx0aWYgKHR5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpIHtcblxuXHRcdFx0XHRcdGlmIChpc1JlYWRpbmcpIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gcmV0dXJuIGVhcmx5IGlmIHdlIGFyZSBhbHJlYWR5IHJlYWRpbmcgdGhlIG91dHB1dFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlzUmVhZGluZyA9IHRydWU7XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Ly8gQ29uc3VtZSB0aGUgbmV3IGNvbnRlbnRzIG9mIHRoZSBmaWxlIHVudGlsIGZpbmlzaGVkXG5cdFx0XHRcdFx0XHQvLyBldmVyeXRpbWUgdGhlcmUgaXMgYSBjaGFuZ2UgZXZlbnQgc2lnbmFsbGluZyBhIGNoYW5nZVxuXHRcdFx0XHRcdFx0d2hpbGUgKCFjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBieXRlc1JlYWQgfSA9IGF3YWl0IFByb21pc2VzLnJlYWQoaGFuZGxlLCBidWZmZXIsIDAsIGJ1ZmZlclNpemUsIG51bGwpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIWJ5dGVzUmVhZCB8fCBjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdG9uRGF0YShidWZmZXIuc2xpY2UoMCwgYnl0ZXNSZWFkKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRlcnJvciA9IG5ldyBFcnJvcihlcnIpO1xuXHRcdFx0XHRcdFx0Y3RzLmRpc3Bvc2UodHJ1ZSk7XG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdGlzUmVhZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKCk7XG5cdH0pO1xuXG5cdGF3YWl0IHdhdGNoZXIucmVhZHk7XG5cdG9uUmVhZHkoKTtcblxuXHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGN0cy50b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZChhc3luYyAoKSA9PiB7XG5cdFx0XHR3YXRjaGVyLmRpc3Bvc2UoKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZXMuY2xvc2UoaGFuZGxlKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRlcnJvciA9IG5ldyBFcnJvcihlcnIpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLE9BQU8sZ0JBQWdCO0FBQ2hDLFNBQVMsZUFBZSx1QkFBdUI7QUFDL0MsU0FBNEIsK0JBQStCO0FBQzNELFNBQVMsU0FBUyx1QkFBdUI7QUFDekMsU0FBUyxZQUFZLGlCQUE4QixvQkFBb0I7QUFDdkUsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxVQUFVLFNBQVMsWUFBWTtBQUN4QyxTQUFTLFNBQVMsbUJBQW1CO0FBQ3JDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUEyQixzQkFBbUM7QUFDOUQsU0FBc0IsZ0JBQTJDLHNCQUFzRCxZQUFZLHFDQUFxQztBQUN4SyxTQUFTLFlBQVk7QUFHZCxNQUFNLDRCQUFOLE1BQU0sa0NBQWlDLFdBQVc7QUFBQSxFQW1FeEQsWUFDa0IsU0FDQSxrQkFDQSxrQkFDQSxnQkFDQSxjQUNULGdCQUNQO0FBQ0QsVUFBTTtBQVBXO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDVDtBQXZEVDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBaUIsOEJBQThCLEtBQUssVUFBVSxJQUFJO0FBQUEsTUFDakU7QUFBQSxRQUNDLGtCQUFrQjtBQUFBO0FBQUEsUUFDbEIsZUFBZTtBQUFBO0FBQUEsUUFDZixpQkFBaUI7QUFBQTtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxZQUFVLEtBQUssaUJBQWlCLE1BQU07QUFBQSxJ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
