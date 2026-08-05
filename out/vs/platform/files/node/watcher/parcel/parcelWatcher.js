import parcelWatcher from "@parcel/watcher";
import { promises } from "fs";
import { tmpdir, homedir } from "os";
import { URI } from "../../../../../base/common/uri.js";
import { DeferredPromise, RunOnceScheduler, RunOnceWorker, ThrottledWorker } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { randomPath, isEqual, isEqualOrParent } from "../../../../../base/common/extpath.js";
import { GLOBSTAR, patternsEquals } from "../../../../../base/common/glob.js";
import { BaseWatcher } from "../baseWatcher.js";
import { TernarySearchTree } from "../../../../../base/common/ternarySearchTree.js";
import { normalizeNFC } from "../../../../../base/common/normalization.js";
import { normalize, join } from "../../../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../../../base/common/platform.js";
import { realcase, realpath } from "../../../../../base/node/extpath.js";
import { FileChangeType } from "../../../common/files.js";
import { coalesceEvents, parseWatcherPatterns, isFiltered } from "../../../common/watcher.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
class ParcelWatcherInstance extends Disposable {
  constructor(ready, request, restarts, token, worker, stopFn) {
    super();
    this.ready = ready;
    this.request = request;
    this.restarts = restarts;
    this.token = token;
    this.worker = worker;
    this.stopFn = stopFn;
    this._onDidStop = this._register(new Emitter());
    this.onDidStop = this._onDidStop.event;
    this._onDidFail = this._register(new Emitter());
    this.onDidFail = this._onDidFail.event;
    this.didFail = false;
    this.didStop = false;
    this.subscriptions = /* @__PURE__ */ new Map();
    this.includes = this.request.includes ? parseWatcherPatterns(this.request.path, this.request.includes) : void 0;
    this.excludes = this.request.excludes ? parseWatcherPatterns(this.request.path, this.request.excludes) : void 0;
    this._register(toDisposable(() => this.subscriptions.clear()));
  }
  get failed() {
    return this.didFail;
  }
  get stopped() {
    return this.didStop;
  }
  subscribe(path, callback) {
    path = URI.file(path).fsPath;
    let subscriptions = this.subscriptions.get(path);
    if (!subscriptions) {
      subscriptions = /* @__PURE__ */ new Set();
      this.subscriptions.set(path, subscriptions);
    }
    subscriptions.add(callback);
    return toDisposable(() => {
      const subscriptions2 = this.subscriptions.get(path);
      if (subscriptions2) {
        subscriptions2.delete(callback);
        if (subscriptions2.size === 0) {
          this.subscriptions.delete(path);
        }
      }
    });
  }
  get subscriptionsCount() {
    return this.subscriptions.size;
  }
  notifyFileChange(path, change) {
    const subscriptions = this.subscriptions.get(path);
    if (subscriptions) {
      for (const subscription of subscriptions) {
        subscription(change);
      }
    }
  }
  notifyWatchFailed() {
    this.didFail = true;
    this._onDidFail.fire();
  }
  include(path) {
    if (!this.includes || this.includes.length === 0) {
      return true;
    }
    return this.includes.some((include) => include(path));
  }
  exclude(path) {
    return Boolean(this.excludes?.some((exclude) => exclude(path)));
  }
  async stop(joinRestart) {
    this.didStop = true;
    try {
      await this.stopFn();
    } finally {
      this._onDidStop.fire({ joinRestart });
      this.dispose();
    }
  }
}
const _ParcelWatcher = class _ParcelWatcher extends BaseWatcher {
  constructor() {
    super();
    this._onDidError = this._register(new Emitter());
    this.onDidError = this._onDidError.event;
    this._watchers = /* @__PURE__ */ new Map();
    // Reduce likelyhood of spam from file events via throttling.
    // (https://github.com/microsoft/vscode/issues/124723)
    this.throttledFileChangesEmitter = this._register(new ThrottledWorker(
      {
        maxWorkChunkSize: 500,
        // only process up to 500 changes at once before...
        throttleDelay: 200,
        // ...resting for 200ms until we process events again...
        maxBufferedWork: 3e4
        // ...but never buffering more than 30000 events in memory
      },
      (events) => this._onDidChangeFile.fire(events)
    ));
    this.enospcErrorLogged = false;
    this.registerListeners();
  }
  get watchers() {
    return this._watchers.values();
  }
  registerListeners() {
    const onUncaughtException = (error) => this.onUnexpectedError(error);
    const onUnhandledRejection = (error) => this.onUnexpectedError(error);
    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);
    this._register(toDisposable(() => {
      process.off("uncaughtException", onUncaughtException);
      process.off("unhandledRejection", onUnhandledRejection);
    }));
  }
  async doWatch(requests) {
    requests = await this.removeDuplicateRequests(requests);
    const requestsToStart = [];
    const watchersToStop = new Set(Array.from(this.watchers));
    for (const request of requests) {
      const watcher = this._watchers.get(this.requestToWatcherKey(request));
      if (watcher && patternsEquals(watcher.request.excludes, request.excludes) && patternsEquals(watcher.request.includes, request.includes) && watcher.request.pollingInterval === request.pollingInterval) {
        watchersToStop.delete(watcher);
      } else {
        requestsToStart.push(request);
      }
    }
    if (requestsToStart.length) {
      this.trace(`Request to start watching: ${requestsToStart.map((request) => this.requestToString(request)).join(",")}`);
    }
    if (watchersToStop.size) {
      this.trace(`Request to stop watching: ${Array.from(watchersToStop).map((watcher) => this.requestToString(watcher.request)).join(",")}`);
    }
    for (const watcher of watchersToStop) {
      await this.stopWatching(watcher);
    }
    for (const request of requestsToStart) {
      if (request.pollingInterval) {
        await this.startPolling(request, request.pollingInterval);
      } else {
        await this.startWatching(request);
      }
    }
  }
  requestToWatcherKey(request) {
    return typeof request.correlationId === "number" ? request.correlationId : this.pathToWatcherKey(request.path);
  }
  pathToWatcherKey(path) {
    return isLinux ? path : path.toLowerCase();
  }
  async startPolling(request, pollingInterval, restarts = 0) {
    const cts = new CancellationTokenSource();
    const instance = new DeferredPromise();
    const snapshotFile = randomPath(tmpdir(), "vscode-watcher-snapshot");
    const watcher = new ParcelWatcherInstance(
      instance.p,
      request,
      restarts,
      cts.token,
      new RunOnceWorker((events) => this.handleParcelEvents(events, watcher), _ParcelWatcher.FILE_CHANGES_HANDLER_DELAY),
      async () => {
        cts.dispose(true);
        watcher.worker.flush();
        watcher.worker.dispose();
        pollingWatcher.dispose();
        await promises.unlink(snapshotFile);
      }
    );
    this._watchers.set(this.requestToWatcherKey(request), watcher);
    const { realPath, realPathDiffers, realPathLength } = await this.normalizePath(request);
    this.trace(`Started watching: '${realPath}' with polling interval '${pollingInterval}'`);
    let counter = 0;
    const pollingWatcher = new RunOnceScheduler(async () => {
      counter++;
      if (cts.token.isCancellationRequested) {
        return;
      }
      const parcelWatcherLib = parcelWatcher;
      try {
        if (counter > 1) {
          const parcelEvents = await parcelWatcherLib.getEventsSince(realPath, snapshotFile, { ignore: this.addPredefinedExcludes(request.excludes), backend: _ParcelWatcher.PARCEL_WATCHER_BACKEND });
          if (cts.token.isCancellationRequested) {
            return;
          }
          this.onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength);
        }
        await parcelWatcherLib.writeSnapshot(realPath, snapshotFile, { ignore: this.addPredefinedExcludes(request.excludes), backend: _ParcelWatcher.PARCEL_WATCHER_BACKEND });
      } catch (error) {
        this.onUnexpectedError(error, request);
      }
      if (counter === 1) {
        instance.complete();
      }
      if (cts.token.isCancellationRequested) {
        return;
      }
      pollingWatcher.schedule();
    }, pollingInterval);
    pollingWatcher.schedule(0);
  }
  async startWatching(request, restarts = 0) {
    const cts = new CancellationTokenSource();
    const instance = new DeferredPromise();
    const watcher = new ParcelWatcherInstance(
      instance.p,
      request,
      restarts,
      cts.token,
      new RunOnceWorker((events) => this.handleParcelEvents(events, watcher), _ParcelWatcher.FILE_CHANGES_HANDLER_DELAY),
      async () => {
        cts.dispose(true);
        watcher.worker.flush();
        watcher.worker.dispose();
        const watcherInstance = await instance.p;
        await watcherInstance?.unsubscribe();
      }
    );
    this._watchers.set(this.requestToWatcherKey(request), watcher);
    const { realPath, realPathDiffers, realPathLength } = await this.normalizePath(request);
    try {
      const parcelWatcherLib = parcelWatcher;
      const parcelWatcherInstance = await parcelWatcherLib.subscribe(realPath, (error, parcelEvents) => {
        if (watcher.token.isCancellationRequested) {
          return;
        }
        if (error) {
          this.onUnexpectedError(error, request);
        }
        this.onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength);
      }, {
        backend: _ParcelWatcher.PARCEL_WATCHER_BACKEND,
        ignore: this.addPredefinedExcludes(watcher.request.excludes)
      });
      this.trace(`Started watching: '${realPath}' with backend '${_ParcelWatcher.PARCEL_WATCHER_BACKEND}'`);
      instance.complete(parcelWatcherInstance);
    } catch (error) {
      this.onUnexpectedError(error, request);
      instance.complete(void 0);
      watcher.notifyWatchFailed();
      this._onDidWatchFail.fire(request);
    }
  }
  addPredefinedExcludes(initialExcludes) {
    const excludes = [...initialExcludes];
    const predefinedExcludes = _ParcelWatcher.PREDEFINED_EXCLUDES[process.platform];
    if (Array.isArray(predefinedExcludes)) {
      for (const exclude of predefinedExcludes) {
        if (!excludes.includes(exclude)) {
          excludes.push(exclude);
        }
      }
    }
    return excludes;
  }
  onParcelEvents(parcelEvents, watcher, realPathDiffers, realPathLength) {
    if (parcelEvents.length === 0) {
      return;
    }
    this.normalizeEvents(parcelEvents, watcher.request, realPathDiffers, realPathLength);
    const includedEvents = this.handleIncludes(watcher, parcelEvents);
    for (const includedEvent of includedEvents) {
      watcher.worker.work(includedEvent);
    }
  }
  handleIncludes(watcher, parcelEvents) {
    const events = [];
    for (const { path, type: parcelEventType } of parcelEvents) {
      const type = _ParcelWatcher.MAP_PARCEL_WATCHER_ACTION_TO_FILE_CHANGE.get(parcelEventType);
      if (this.verboseLogging) {
        this.traceWithCorrelation(`${type === FileChangeType.ADDED ? "[ADDED]" : type === FileChangeType.DELETED ? "[DELETED]" : "[CHANGED]"} ${path}`, watcher.request);
      }
      if (!watcher.include(path)) {
        if (this.verboseLogging) {
          this.traceWithCorrelation(` >> ignored (not included) ${path}`, watcher.request);
        }
      } else {
        events.push({ type, resource: URI.file(path), cId: watcher.request.correlationId });
      }
    }
    return events;
  }
  handleParcelEvents(parcelEvents, watcher) {
    const coalescedEvents = coalesceEvents(parcelEvents);
    const { events: filteredEvents, rootDeleted } = this.filterEvents(coalescedEvents, watcher);
    this.emitEvents(filteredEvents, watcher);
    if (rootDeleted) {
      this.onWatchedPathDeleted(watcher);
    }
  }
  emitEvents(events, watcher) {
    if (events.length === 0) {
      return;
    }
    const worked = this.throttledFileChangesEmitter.work(events);
    if (!worked) {
      this.warn(`started ignoring events due to too many file change events at once (incoming: ${events.length}, most recent change: ${events[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`);
    } else {
      if (this.throttledFileChangesEmitter.pending > 0) {
        this.trace(`started throttling events due to large amount of file change events at once (pending: ${this.throttledFileChangesEmitter.pending}, most recent change: ${events[0].resource.fsPath}). Use 'files.watcherExclude' setting to exclude folders with lots of changing files (e.g. compilation output).`, watcher);
      }
    }
  }
  async normalizePath(request) {
    let realPath = request.path;
    let realPathDiffers = false;
    let realPathLength = request.path.length;
    try {
      realPath = await realpath(request.path);
      if (request.path === realPath) {
        realPath = await realcase(request.path) ?? request.path;
      }
      if (request.path !== realPath) {
        realPathLength = realPath.length;
        realPathDiffers = true;
        this.trace(`correcting a path to watch that seems to be a symbolic link or wrong casing (original: ${request.path}, real: ${realPath})`);
      }
    } catch (error) {
    }
    return { realPath, realPathDiffers, realPathLength };
  }
  normalizeEvents(events, request, realPathDiffers, realPathLength) {
    for (const event of events) {
      if (isMacintosh) {
        event.path = normalizeNFC(event.path);
      }
      if (isWindows) {
        if (request.path.length <= 3) {
          event.path = normalize(event.path);
        }
      }
      if (realPathDiffers) {
        event.path = request.path + event.path.substr(realPathLength);
      }
    }
  }
  filterEvents(events, watcher) {
    const filteredEvents = [];
    let rootDeleted = false;
    const filter = this.isCorrelated(watcher.request) ? watcher.request.filter : void 0;
    for (const event of events) {
      if (watcher.subscriptionsCount > 0) {
        watcher.notifyFileChange(event.resource.fsPath, event);
      }
      rootDeleted = event.type === FileChangeType.DELETED && isEqual(event.resource.fsPath, watcher.request.path, !isLinux);
      if (isFiltered(event, filter)) {
        if (this.verboseLogging) {
          this.traceWithCorrelation(` >> ignored (filtered) ${event.resource.fsPath}`, watcher.request);
        }
        continue;
      }
      this.traceEvent(event, watcher.request);
      filteredEvents.push(event);
    }
    return { events: filteredEvents, rootDeleted };
  }
  onWatchedPathDeleted(watcher) {
    this.warn("Watcher shutdown because watched path got deleted", watcher);
    watcher.notifyWatchFailed();
    this._onDidWatchFail.fire(watcher.request);
  }
  onUnexpectedError(error, request) {
    const msg = toErrorMessage(error);
    if (msg.indexOf("No space left on device") !== -1) {
      if (!this.enospcErrorLogged) {
        this.error("Inotify limit reached (ENOSPC)", request);
        this.enospcErrorLogged = true;
      }
    } else if (msg.indexOf("File system must be re-scanned") !== -1) {
      this.error(msg, request);
    } else {
      this.error(`Unexpected error: ${msg} (EUNKNOWN)`, request);
      this._onDidError.fire({ request, error: msg });
    }
  }
  async stop() {
    await super.stop();
    for (const watcher of this.watchers) {
      await this.stopWatching(watcher);
    }
  }
  restartWatching(watcher, delay = 800) {
    const scheduler = new RunOnceScheduler(async () => {
      if (watcher.token.isCancellationRequested) {
        return;
      }
      const restartPromise = new DeferredPromise();
      try {
        await this.stopWatching(watcher, restartPromise.p);
        if (watcher.request.pollingInterval) {
          await this.startPolling(watcher.request, watcher.request.pollingInterval, watcher.restarts + 1);
        } else {
          await this.startWatching(watcher.request, watcher.restarts + 1);
        }
      } finally {
        restartPromise.complete();
      }
    }, delay);
    scheduler.schedule();
    watcher.token.onCancellationRequested(() => scheduler.dispose());
  }
  async stopWatching(watcher, joinRestart) {
    this.trace(`stopping file watcher`, watcher);
    this._watchers.delete(this.requestToWatcherKey(watcher.request));
    try {
      await watcher.stop(joinRestart);
    } catch (error) {
      this.error(`Unexpected error stopping watcher: ${toErrorMessage(error)}`, watcher.request);
    }
  }
  async removeDuplicateRequests(requests, validatePaths = true) {
    requests.sort((requestA, requestB) => requestA.path.length - requestB.path.length);
    const mapCorrelationtoRequests = /* @__PURE__ */ new Map();
    for (const request of requests) {
      if (request.excludes.includes(GLOBSTAR)) {
        continue;
      }
      let requestsForCorrelation = mapCorrelationtoRequests.get(request.correlationId);
      if (!requestsForCorrelation) {
        requestsForCorrelation = /* @__PURE__ */ new Map();
        mapCorrelationtoRequests.set(request.correlationId, requestsForCorrelation);
      }
      const path = this.pathToWatcherKey(request.path);
      if (requestsForCorrelation.has(path)) {
        this.trace(`ignoring a request for watching who's path is already watched: ${this.requestToString(request)}`);
      }
      requestsForCorrelation.set(path, request);
    }
    const normalizedRequests = [];
    for (const requestsForCorrelation of mapCorrelationtoRequests.values()) {
      const requestTrie = TernarySearchTree.forPaths(!isLinux);
      for (const request of requestsForCorrelation.values()) {
        if (requestTrie.findSubstr(request.path)) {
          if (requestTrie.has(request.path)) {
            this.trace(`ignoring a request for watching who's path is already watched: ${this.requestToString(request)}`);
          } else {
            try {
              if (!(await promises.lstat(request.path)).isSymbolicLink()) {
                this.trace(`ignoring a request for watching who's parent is already watched: ${this.requestToString(request)}`);
                continue;
              }
            } catch (error) {
              this.trace(`ignoring a request for watching who's lstat failed to resolve: ${this.requestToString(request)} (error: ${error})`);
              this._onDidWatchFail.fire(request);
              continue;
            }
          }
        }
        if (validatePaths && !await this.isPathValid(request.path)) {
          this._onDidWatchFail.fire(request);
          continue;
        }
        requestTrie.set(request.path, request);
      }
      normalizedRequests.push(...Array.from(requestTrie).map(([, request]) => request));
    }
    return normalizedRequests;
  }
  async isPathValid(path) {
    try {
      const stat = await promises.stat(path);
      if (!stat.isDirectory()) {
        this.trace(`ignoring a path for watching that is a file and not a folder: ${path}`);
        return false;
      }
    } catch (error) {
      this.trace(`ignoring a path for watching who's stat info failed to resolve: ${path} (error: ${error})`);
      return false;
    }
    return true;
  }
  subscribe(path, callback) {
    for (const watcher of this.watchers) {
      if (watcher.failed) {
        continue;
      }
      if (!isEqualOrParent(path, watcher.request.path, !isLinux)) {
        continue;
      }
      if (watcher.exclude(path) || !watcher.include(path)) {
        continue;
      }
      const disposables = new DisposableStore();
      disposables.add(Event.once(watcher.onDidStop)(async (e) => {
        await e.joinRestart;
        if (disposables.isDisposed) {
          return;
        }
        callback(
          true
          /* error */
        );
      }));
      disposables.add(Event.once(watcher.onDidFail)(() => callback(
        true
        /* error */
      )));
      disposables.add(watcher.subscribe(path, (change) => callback(null, change)));
      return disposables;
    }
    return void 0;
  }
  trace(message, watcher) {
    if (this.verboseLogging) {
      this._onDidLogMessage.fire({ type: "trace", message: this.toMessage(message, watcher?.request) });
    }
  }
  warn(message, watcher) {
    this._onDidLogMessage.fire({ type: "warn", message: this.toMessage(message, watcher?.request) });
  }
  error(message, request) {
    this._onDidLogMessage.fire({ type: "error", message: this.toMessage(message, request) });
  }
  toMessage(message, request) {
    return request ? `[File Watcher] ${message} (path: ${request.path})` : `[File Watcher ('parcel')] ${message}`;
  }
  get recursiveWatcher() {
    return this;
  }
};
_ParcelWatcher.MAP_PARCEL_WATCHER_ACTION_TO_FILE_CHANGE = /* @__PURE__ */ new Map(
  [
    ["create", FileChangeType.ADDED],
    ["update", FileChangeType.UPDATED],
    ["delete", FileChangeType.DELETED]
  ]
);
_ParcelWatcher.PREDEFINED_EXCLUDES = {
  "win32": [],
  "darwin": [
    join(homedir(), "Library", "Containers")
    // Triggers access dialog from macOS 14 (https://github.com/microsoft/vscode/issues/208105)
  ],
  "linux": []
};
_ParcelWatcher.PARCEL_WATCHER_BACKEND = isWindows ? "windows" : isLinux ? "inotify" : "fs-events";
// A delay for collecting file changes from Parcel
// before collecting them for coalescing and emitting.
// Parcel internally uses 50ms as delay, so we use 75ms,
// to schedule sufficiently after Parcel.
//
// Note: since Parcel 2.0.7, the very first event is
// emitted without delay if no events occured over a
// duration of 500ms. But we always want to aggregate
// events to apply our coleasing logic.
//
_ParcelWatcher.FILE_CHANGES_HANDLER_DELAY = 75;
let ParcelWatcher = _ParcelWatcher;
export {
  ParcelWatcher,
  ParcelWatcherInstance
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9ub2RlL3dhdGNoZXIvcGFyY2VsL3BhcmNlbFdhdGNoZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgcGFyY2VsV2F0Y2hlciBmcm9tICdAcGFyY2VsL3dhdGNoZXInO1xuaW1wb3J0IHsgcHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyB0bXBkaXIsIGhvbWVkaXIgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCBSdW5PbmNlU2NoZWR1bGVyLCBSdW5PbmNlV29ya2VyLCBUaHJvdHRsZWRXb3JrZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyByYW5kb21QYXRoLCBpc0VxdWFsLCBpc0VxdWFsT3JQYXJlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IEdMT0JTVEFSLCBQYXJzZWRQYXR0ZXJuLCBwYXR0ZXJuc0VxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgQmFzZVdhdGNoZXIgfSBmcm9tICcuLi9iYXNlV2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBUZXJuYXJ5U2VhcmNoVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Rlcm5hcnlTZWFyY2hUcmVlLmpzJztcbmltcG9ydCB7IG5vcm1hbGl6ZU5GQyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25vcm1hbGl6YXRpb24uanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplLCBqb2luIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgcmVhbGNhc2UsIHJlYWxwYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9ub2RlL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZVR5cGUsIElGaWxlQ2hhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlRXZlbnRzLCBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0LCBwYXJzZVdhdGNoZXJQYXR0ZXJucywgSVJlY3Vyc2l2ZVdhdGNoZXJXaXRoU3Vic2NyaWJlLCBpc0ZpbHRlcmVkLCBJV2F0Y2hlckVycm9yRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vd2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgY2xhc3MgUGFyY2VsV2F0Y2hlckluc3RhbmNlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdG9wID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBqb2luUmVzdGFydD86IFByb21pc2U8dm9pZD4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU3RvcCA9IHRoaXMuX29uRGlkU3RvcC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZhaWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRGYWlsID0gdGhpcy5fb25EaWRGYWlsLmV2ZW50O1xuXG5cdHByaXZhdGUgZGlkRmFpbCA9IGZhbHNlO1xuXHRnZXQgZmFpbGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5kaWRGYWlsOyB9XG5cblx0cHJpdmF0ZSBkaWRTdG9wID0gZmFsc2U7XG5cdGdldCBzdG9wcGVkKCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5kaWRTdG9wOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBpbmNsdWRlczogUGFyc2VkUGF0dGVybltdIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGV4Y2x1ZGVzOiBQYXJzZWRQYXR0ZXJuW10gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdWJzY3JpcHRpb25zID0gbmV3IE1hcDxzdHJpbmcsIFNldDwoY2hhbmdlOiBJRmlsZUNoYW5nZSkgPT4gdm9pZD4+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0LyoqXG5cdFx0ICogU2lnbmFscyB3aGVuIHRoZSB3YXRjaGVyIGlzIHJlYWR5IHRvIHdhdGNoLlxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IHJlYWR5OiBQcm9taXNlPHVua25vd24+LFxuXHRcdHJlYWRvbmx5IHJlcXVlc3Q6IElSZWN1cnNpdmVXYXRjaFJlcXVlc3QsXG5cdFx0LyoqXG5cdFx0ICogSG93IG9mdGVuIHRoaXMgd2F0Y2hlciBoYXMgYmVlbiByZXN0YXJ0ZWQgaW4gY2FzZSBvZiBhbiB1bmV4cGVjdGVkXG5cdFx0ICogc2h1dGRvd24uXG5cdFx0ICovXG5cdFx0cmVhZG9ubHkgcmVzdGFydHM6IG51bWJlcixcblx0XHQvKipcblx0XHQgKiBUaGUgY2FuY2VsbGF0aW9uIHRva2VuIGFzc29jaWF0ZWQgd2l0aCB0aGUgbGlmZWN5Y2xlIG9mIHRoZSB3YXRjaGVyLlxuXHRcdCAqL1xuXHRcdHJlYWRvbmx5IHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbixcblx0XHQvKipcblx0XHQgKiBBbiBldmVudCBhZ2dyZWdhdG9yIHRvIGNvYWxlc2NlIGV2ZW50cyBhbmQgcmVkdWNlIGR1cGxpY2F0ZXMuXG5cdFx0ICovXG5cdFx0cmVhZG9ubHkgd29ya2VyOiBSdW5PbmNlV29ya2VyPElGaWxlQ2hhbmdlPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0b3BGbjogKCkgPT4gUHJvbWlzZTx2b2lkPlxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5pbmNsdWRlcyA9IHRoaXMucmVxdWVzdC5pbmNsdWRlcyA/IHBhcnNlV2F0Y2hlclBhdHRlcm5zKHRoaXMucmVxdWVzdC5wYXRoLCB0aGlzLnJlcXVlc3QuaW5jbHVkZXMpIDogdW5kZWZpbmVkO1xuXHRcdHRoaXMuZXhjbHVkZXMgPSB0aGlzLnJlcXVlc3QuZXhjbHVkZXMgPyBwYXJzZVdhdGNoZXJQYXR0ZXJucyh0aGlzLnJlcXVlc3QucGF0aCwgdGhpcy5yZXF1ZXN0LmV4Y2x1ZGVzKSA6IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLnN1YnNjcmlwdGlvbnMuY2xlYXIoKSkpO1xuXHR9XG5cblx0c3Vic2NyaWJlKHBhdGg6IHN0cmluZywgY2FsbGJhY2s6IChjaGFuZ2U6IElGaWxlQ2hhbmdlKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRcdHBhdGggPSBVUkkuZmlsZShwYXRoKS5mc1BhdGg7IC8vIG1ha2Ugc3VyZSB0byBzdG9yZSB0aGUgcGF0aCBpbiBgZnNQYXRoYCBmb3JtIHRvIG1hdGNoIGl0IHdpdGggZXZlbnRzIGxhdGVyXG5cblx0XHRsZXQgc3Vic2NyaXB0aW9ucyA9IHRoaXMuc3Vic2NyaXB0aW9ucy5nZXQocGF0aCk7XG5cdFx0aWYgKCFzdWJzY3JpcHRpb25zKSB7XG5cdFx0XHRzdWJzY3JpcHRpb25zID0gbmV3IFNldCgpO1xuXHRcdFx0dGhpcy5zdWJzY3JpcHRpb25zLnNldChwYXRoLCBzdWJzY3JpcHRpb25zKTtcblx0XHR9XG5cblx0XHRzdWJzY3JpcHRpb25zLmFkZChjYWxsYmFjayk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnN0IHN1YnNjcmlwdGlvbnMgPSB0aGlzLnN1YnNjcmlwdGlvbnMuZ2V0KHBhdGgpO1xuXHRcdFx0aWYgKHN1YnNjcmlwdGlvbnMpIHtcblx0XHRcdFx0c3Vic2NyaXB0aW9ucy5kZWxldGUoY2FsbGJhY2spO1xuXG5cdFx0XHRcdGlmIChzdWJzY3JpcHRpb25zLnNpemUgPT09IDApIHtcblx0XHRcdFx0XHR0aGlzLnN1YnNjcmlwdGlvbnMuZGVsZXRlKHBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRnZXQgc3Vic2NyaXB0aW9uc0NvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuc3Vic2NyaXB0aW9ucy5zaXplO1xuXHR9XG5cblx0bm90aWZ5RmlsZUNoYW5nZShwYXRoOiBzdHJpbmcsIGNoYW5nZTogSUZpbGVDaGFuZ2UpOiB2b2lkIHtcblx0XHRjb25zdCBzdWJzY3JpcHRpb25zID0gdGhpcy5zdWJzY3JpcHRpb25zLmdldChwYXRoKTtcblx0XHRpZiAoc3Vic2NyaXB0aW9ucykge1xuXHRcdFx0Zm9yIChjb25zdCBzdWJzY3JpcHRpb24gb2Ygc3Vic2NyaXB0aW9ucykge1xuXHRcdFx0XHRzdWJzY3JpcHRpb24oY2hhbmdlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRub3RpZnlXYXRjaEZhaWxlZCgpOiB2b2lkIHtcblx0XHR0aGlzLmRpZEZhaWwgPSB0cnVlO1xuXG5cdFx0dGhpcy5fb25EaWRGYWlsLmZpcmUoKTtcblx0fVxuXG5cdGluY2x1ZGUocGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmluY2x1ZGVzIHx8IHRoaXMuaW5jbHVkZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gbm8gc3BlY2lmaWMgaW5jbHVkZXMgZGVmaW5lZCwgaW5jbHVkZSBhbGxcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pbmNsdWRlcy5zb21lKGluY2x1ZGUgPT4gaW5jbHVkZShwYXRoKSk7XG5cdH1cblxuXHRleGNsdWRlKHBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBCb29sZWFuKHRoaXMuZXhjbHVkZXM/LnNvbWUoZXhjbHVkZSA9PiBleGNsdWRlKHBhdGgpKSk7XG5cdH1cblxuXHRhc3luYyBzdG9wKGpvaW5SZXN0YXJ0OiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5kaWRTdG9wID0gdHJ1ZTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnN0b3BGbigpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9vbkRpZFN0b3AuZmlyZSh7IGpvaW5SZXN0YXJ0IH0pO1xuXHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJjZWxXYXRjaGVyIGV4dGVuZHMgQmFzZVdhdGNoZXIgaW1wbGVtZW50cyBJUmVjdXJzaXZlV2F0Y2hlcldpdGhTdWJzY3JpYmUge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BUF9QQVJDRUxfV0FUQ0hFUl9BQ1RJT05fVE9fRklMRV9DSEFOR0UgPSBuZXcgTWFwPHBhcmNlbFdhdGNoZXIuRXZlbnRUeXBlLCBudW1iZXI+KFxuXHRcdFtcblx0XHRcdFsnY3JlYXRlJywgRmlsZUNoYW5nZVR5cGUuQURERURdLFxuXHRcdFx0Wyd1cGRhdGUnLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEXSxcblx0XHRcdFsnZGVsZXRlJywgRmlsZUNoYW5nZVR5cGUuREVMRVRFRF1cblx0XHRdXG5cdCk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUFJFREVGSU5FRF9FWENMVURFUzogeyBbcGxhdGZvcm06IHN0cmluZ106IHN0cmluZ1tdIH0gPSB7XG5cdFx0J3dpbjMyJzogW10sXG5cdFx0J2Rhcndpbic6IFtcblx0XHRcdGpvaW4oaG9tZWRpcigpLCAnTGlicmFyeScsICdDb250YWluZXJzJykgLy8gVHJpZ2dlcnMgYWNjZXNzIGRpYWxvZyBmcm9tIG1hY09TIDE0IChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA4MTA1KVxuXHRcdF0sXG5cdFx0J2xpbnV4JzogW11cblx0fTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBQQVJDRUxfV0FUQ0hFUl9CQUNLRU5EID0gaXNXaW5kb3dzID8gJ3dpbmRvd3MnIDogaXNMaW51eCA/ICdpbm90aWZ5JyA6ICdmcy1ldmVudHMnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRXJyb3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJV2F0Y2hlckVycm9yRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEVycm9yID0gdGhpcy5fb25EaWRFcnJvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93YXRjaGVycyA9IG5ldyBNYXA8c3RyaW5nIC8qIHBhdGggKi8gfCBudW1iZXIgLyogY29ycmVsYXRpb24gSUQgKi8sIFBhcmNlbFdhdGNoZXJJbnN0YW5jZT4oKTtcblx0Z2V0IHdhdGNoZXJzKCkgeyByZXR1cm4gdGhpcy5fd2F0Y2hlcnMudmFsdWVzKCk7IH1cblxuXHQvLyBBIGRlbGF5IGZvciBjb2xsZWN0aW5nIGZpbGUgY2hhbmdlcyBmcm9tIFBhcmNlbFxuXHQvLyBiZWZvcmUgY29sbGVjdGluZyB0aGVtIGZvciBjb2FsZXNjaW5nIGFuZCBlbWl0dGluZy5cblx0Ly8gUGFyY2VsIGludGVybmFsbHkgdXNlcyA1MG1zIGFzIGRlbGF5LCBzbyB3ZSB1c2UgNzVtcyxcblx0Ly8gdG8gc2NoZWR1bGUgc3VmZmljaWVudGx5IGFmdGVyIFBhcmNlbC5cblx0Ly9cblx0Ly8gTm90ZTogc2luY2UgUGFyY2VsIDIuMC43LCB0aGUgdmVyeSBmaXJzdCBldmVudCBpc1xuXHQvLyBlbWl0dGVkIHdpdGhvdXQgZGVsYXkgaWYgbm8gZXZlbnRzIG9jY3VyZWQgb3ZlciBhXG5cdC8vIGR1cmF0aW9uIG9mIDUwMG1zLiBCdXQgd2UgYWx3YXlzIHdhbnQgdG8gYWdncmVnYXRlXG5cdC8vIGV2ZW50cyB0byBhcHBseSBvdXIgY29sZWFzaW5nIGxvZ2ljLlxuXHQvL1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBGSUxFX0NIQU5HRVNfSEFORExFUl9ERUxBWSA9IDc1O1xuXG5cdC8vIFJlZHVjZSBsaWtlbHlob29kIG9mIHNwYW0gZnJvbSBmaWxlIGV2ZW50cyB2aWEgdGhyb3R0bGluZy5cblx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjQ3MjMpXG5cdHByaXZhdGUgcmVhZG9ubHkgdGhyb3R0bGVkRmlsZUNoYW5nZXNFbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRocm90dGxlZFdvcmtlcjxJRmlsZUNoYW5nZT4oXG5cdFx0e1xuXHRcdFx0bWF4V29ya0NodW5rU2l6ZTogNTAwLFx0Ly8gb25seSBwcm9jZXNzIHVwIHRvIDUwMCBjaGFuZ2VzIGF0IG9uY2UgYmVmb3JlLi4uXG5cdFx0XHR0aHJvdHRsZURlbGF5OiAyMDAsXHQgIFx0Ly8gLi4ucmVzdGluZyBmb3IgMjAwbXMgdW50aWwgd2UgcHJvY2VzcyBldmVudHMgYWdhaW4uLi5cblx0XHRcdG1heEJ1ZmZlcmVkV29yazogMzAwMDAgXHQvLyAuLi5idXQgbmV2ZXIgYnVmZmVyaW5nIG1vcmUgdGhhbiAzMDAwMCBldmVudHMgaW4gbWVtb3J5XG5cdFx0fSxcblx0XHRldmVudHMgPT4gdGhpcy5fb25EaWRDaGFuZ2VGaWxlLmZpcmUoZXZlbnRzKVxuXHQpKTtcblxuXHRwcml2YXRlIGVub3NwY0Vycm9yTG9nZ2VkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb25VbmNhdWdodEV4Y2VwdGlvbiA9IChlcnJvcjogdW5rbm93bikgPT4gdGhpcy5vblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWRSZWplY3Rpb24gPSAoZXJyb3I6IHVua25vd24pID0+IHRoaXMub25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xuXG5cdFx0cHJvY2Vzcy5vbigndW5jYXVnaHRFeGNlcHRpb24nLCBvblVuY2F1Z2h0RXhjZXB0aW9uKTtcblx0XHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZFJlamVjdGlvbik7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuY2F1Z2h0RXhjZXB0aW9uJywgb25VbmNhdWdodEV4Y2VwdGlvbik7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBkb1dhdGNoKHJlcXVlc3RzOiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0W10pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEZpZ3VyZSBvdXQgZHVwbGljYXRlcyB0byByZW1vdmUgZnJvbSB0aGUgcmVxdWVzdHNcblx0XHRyZXF1ZXN0cyA9IGF3YWl0IHRoaXMucmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMocmVxdWVzdHMpO1xuXG5cdFx0Ly8gRmlndXJlIG91dCB3aGljaCB3YXRjaGVycyB0byBzdGFydCBhbmQgd2hpY2ggdG8gc3RvcFxuXHRcdGNvbnN0IHJlcXVlc3RzVG9TdGFydDogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3Qgd2F0Y2hlcnNUb1N0b3AgPSBuZXcgU2V0KEFycmF5LmZyb20odGhpcy53YXRjaGVycykpO1xuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiByZXF1ZXN0cykge1xuXHRcdFx0Y29uc3Qgd2F0Y2hlciA9IHRoaXMuX3dhdGNoZXJzLmdldCh0aGlzLnJlcXVlc3RUb1dhdGNoZXJLZXkocmVxdWVzdCkpO1xuXHRcdFx0aWYgKHdhdGNoZXIgJiYgcGF0dGVybnNFcXVhbHMod2F0Y2hlci5yZXF1ZXN0LmV4Y2x1ZGVzLCByZXF1ZXN0LmV4Y2x1ZGVzKSAmJiBwYXR0ZXJuc0VxdWFscyh3YXRjaGVyLnJlcXVlc3QuaW5jbHVkZXMsIHJlcXVlc3QuaW5jbHVkZXMpICYmIHdhdGNoZXIucmVxdWVzdC5wb2xsaW5nSW50ZXJ2YWwgPT09IHJlcXVlc3QucG9sbGluZ0ludGVydmFsKSB7XG5cdFx0XHRcdHdhdGNoZXJzVG9TdG9wLmRlbGV0ZSh3YXRjaGVyKTsgLy8ga2VlcCB3YXRjaGVyXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXF1ZXN0c1RvU3RhcnQucHVzaChyZXF1ZXN0KTsgLy8gc3RhcnQgd2F0Y2hpbmdcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBMb2dnaW5nXG5cdFx0aWYgKHJlcXVlc3RzVG9TdGFydC5sZW5ndGgpIHtcblx0XHRcdHRoaXMudHJhY2UoYFJlcXVlc3QgdG8gc3RhcnQgd2F0Y2hpbmc6ICR7cmVxdWVzdHNUb1N0YXJ0Lm1hcChyZXF1ZXN0ID0+IHRoaXMucmVxdWVzdFRvU3RyaW5nKHJlcXVlc3QpKS5qb2luKCcsJyl9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKHdhdGNoZXJzVG9TdG9wLnNpemUpIHtcblx0XHRcdHRoaXMudHJhY2UoYFJlcXVlc3QgdG8gc3RvcCB3YXRjaGluZzogJHtBcnJheS5mcm9tKHdhdGNoZXJzVG9TdG9wKS5tYXAod2F0Y2hlciA9PiB0aGlzLnJlcXVlc3RUb1N0cmluZyh3YXRjaGVyLnJlcXVlc3QpKS5qb2luKCcsJyl9YCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RvcCB3YXRjaGluZyBhcyBpbnN0cnVjdGVkXG5cdFx0Zm9yIChjb25zdCB3YXRjaGVyIG9mIHdhdGNoZXJzVG9TdG9wKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnN0b3BXYXRjaGluZyh3YXRjaGVyKTtcblx0XHR9XG5cblx0XHQvLyBTdGFydCB3YXRjaGluZyBhcyBpbnN0cnVjdGVkXG5cdFx0Zm9yIChjb25zdCByZXF1ZXN0IG9mIHJlcXVlc3RzVG9TdGFydCkge1xuXHRcdFx0aWYgKHJlcXVlc3QucG9sbGluZ0ludGVydmFsKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3RhcnRQb2xsaW5nKHJlcXVlc3QsIHJlcXVlc3QucG9sbGluZ0ludGVydmFsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuc3RhcnRXYXRjaGluZyhyZXF1ZXN0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlcXVlc3RUb1dhdGNoZXJLZXkocmVxdWVzdDogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdCk6IHN0cmluZyB8IG51bWJlciB7XG5cdFx0cmV0dXJuIHR5cGVvZiByZXF1ZXN0LmNvcnJlbGF0aW9uSWQgPT09ICdudW1iZXInID8gcmVxdWVzdC5jb3JyZWxhdGlvbklkIDogdGhpcy5wYXRoVG9XYXRjaGVyS2V5KHJlcXVlc3QucGF0aCk7XG5cdH1cblxuXHRwcml2YXRlIHBhdGhUb1dhdGNoZXJLZXkocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gaXNMaW51eCA/IHBhdGggOiBwYXRoLnRvTG93ZXJDYXNlKCkgLyogaWdub3JlIHBhdGggY2FzaW5nICovO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzdGFydFBvbGxpbmcocmVxdWVzdDogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdCwgcG9sbGluZ0ludGVydmFsOiBudW1iZXIsIHJlc3RhcnRzID0gMCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cblx0XHRjb25zdCBzbmFwc2hvdEZpbGUgPSByYW5kb21QYXRoKHRtcGRpcigpLCAndnNjb2RlLXdhdGNoZXItc25hcHNob3QnKTtcblxuXHRcdC8vIFJlbWVtYmVyIGFzIHdhdGNoZXIgaW5zdGFuY2Vcblx0XHRjb25zdCB3YXRjaGVyOiBQYXJjZWxXYXRjaGVySW5zdGFuY2UgPSBuZXcgUGFyY2VsV2F0Y2hlckluc3RhbmNlKFxuXHRcdFx0aW5zdGFuY2UucCxcblx0XHRcdHJlcXVlc3QsXG5cdFx0XHRyZXN0YXJ0cyxcblx0XHRcdGN0cy50b2tlbixcblx0XHRcdG5ldyBSdW5PbmNlV29ya2VyPElGaWxlQ2hhbmdlPihldmVudHMgPT4gdGhpcy5oYW5kbGVQYXJjZWxFdmVudHMoZXZlbnRzLCB3YXRjaGVyKSwgUGFyY2VsV2F0Y2hlci5GSUxFX0NIQU5HRVNfSEFORExFUl9ERUxBWSksXG5cdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGN0cy5kaXNwb3NlKHRydWUpO1xuXG5cdFx0XHRcdHdhdGNoZXIud29ya2VyLmZsdXNoKCk7XG5cdFx0XHRcdHdhdGNoZXIud29ya2VyLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRwb2xsaW5nV2F0Y2hlci5kaXNwb3NlKCk7XG5cdFx0XHRcdGF3YWl0IHByb21pc2VzLnVubGluayhzbmFwc2hvdEZpbGUpO1xuXHRcdFx0fVxuXHRcdCk7XG5cdFx0dGhpcy5fd2F0Y2hlcnMuc2V0KHRoaXMucmVxdWVzdFRvV2F0Y2hlcktleShyZXF1ZXN0KSwgd2F0Y2hlcik7XG5cblx0XHQvLyBQYXRoIGNoZWNrcyBmb3Igc3ltYm9saWMgbGlua3MgLyB3cm9uZyBjYXNpbmdcblx0XHRjb25zdCB7IHJlYWxQYXRoLCByZWFsUGF0aERpZmZlcnMsIHJlYWxQYXRoTGVuZ3RoIH0gPSBhd2FpdCB0aGlzLm5vcm1hbGl6ZVBhdGgocmVxdWVzdCk7XG5cblx0XHR0aGlzLnRyYWNlKGBTdGFydGVkIHdhdGNoaW5nOiAnJHtyZWFsUGF0aH0nIHdpdGggcG9sbGluZyBpbnRlcnZhbCAnJHtwb2xsaW5nSW50ZXJ2YWx9J2ApO1xuXG5cdFx0bGV0IGNvdW50ZXIgPSAwO1xuXG5cdFx0Y29uc3QgcG9sbGluZ1dhdGNoZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcihhc3luYyAoKSA9PiB7XG5cdFx0XHRjb3VudGVyKys7XG5cblx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBXZSBhbHJlYWR5IHJhbiBiZWZvcmUsIGNoZWNrIGZvciBldmVudHMgc2luY2Vcblx0XHRcdGNvbnN0IHBhcmNlbFdhdGNoZXJMaWIgPSBwYXJjZWxXYXRjaGVyO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKGNvdW50ZXIgPiAxKSB7XG5cdFx0XHRcdFx0Y29uc3QgcGFyY2VsRXZlbnRzID0gYXdhaXQgcGFyY2VsV2F0Y2hlckxpYi5nZXRFdmVudHNTaW5jZShyZWFsUGF0aCwgc25hcHNob3RGaWxlLCB7IGlnbm9yZTogdGhpcy5hZGRQcmVkZWZpbmVkRXhjbHVkZXMocmVxdWVzdC5leGNsdWRlcyksIGJhY2tlbmQ6IFBhcmNlbFdhdGNoZXIuUEFSQ0VMX1dBVENIRVJfQkFDS0VORCB9KTtcblxuXHRcdFx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBIYW5kbGUgJiBlbWl0IGV2ZW50c1xuXHRcdFx0XHRcdHRoaXMub25QYXJjZWxFdmVudHMocGFyY2VsRXZlbnRzLCB3YXRjaGVyLCByZWFsUGF0aERpZmZlcnMsIHJlYWxQYXRoTGVuZ3RoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFN0b3JlIGEgc25hcHNob3Qgb2YgZmlsZXMgdG8gdGhlIHNuYXBzaG90IGZpbGVcblx0XHRcdFx0YXdhaXQgcGFyY2VsV2F0Y2hlckxpYi53cml0ZVNuYXBzaG90KHJlYWxQYXRoLCBzbmFwc2hvdEZpbGUsIHsgaWdub3JlOiB0aGlzLmFkZFByZWRlZmluZWRFeGNsdWRlcyhyZXF1ZXN0LmV4Y2x1ZGVzKSwgYmFja2VuZDogUGFyY2VsV2F0Y2hlci5QQVJDRUxfV0FUQ0hFUl9CQUNLRU5EIH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5vblVuZXhwZWN0ZWRFcnJvcihlcnJvciwgcmVxdWVzdCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNpZ25hbCB3ZSBhcmUgcmVhZHkgbm93IHdoZW4gdGhlIGZpcnN0IHNuYXBzaG90IHdhcyB3cml0dGVuXG5cdFx0XHRpZiAoY291bnRlciA9PT0gMSkge1xuXHRcdFx0XHRpbnN0YW5jZS5jb21wbGV0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2NoZWR1bGUgYWdhaW4gYXQgdGhlIG5leHQgaW50ZXJ2YWxcblx0XHRcdHBvbGxpbmdXYXRjaGVyLnNjaGVkdWxlKCk7XG5cdFx0fSwgcG9sbGluZ0ludGVydmFsKTtcblx0XHRwb2xsaW5nV2F0Y2hlci5zY2hlZHVsZSgwKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnRXYXRjaGluZyhyZXF1ZXN0OiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0LCByZXN0YXJ0cyA9IDApOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gbmV3IERlZmVycmVkUHJvbWlzZTxwYXJjZWxXYXRjaGVyLkFzeW5jU3Vic2NyaXB0aW9uIHwgdW5kZWZpbmVkPigpO1xuXG5cdFx0Ly8gUmVtZW1iZXIgYXMgd2F0Y2hlciBpbnN0YW5jZVxuXHRcdGNvbnN0IHdhdGNoZXI6IFBhcmNlbFdhdGNoZXJJbnN0YW5jZSA9IG5ldyBQYXJjZWxXYXRjaGVySW5zdGFuY2UoXG5cdFx0XHRpbnN0YW5jZS5wLFxuXHRcdFx0cmVxdWVzdCxcblx0XHRcdHJlc3RhcnRzLFxuXHRcdFx0Y3RzLnRva2VuLFxuXHRcdFx0bmV3IFJ1bk9uY2VXb3JrZXI8SUZpbGVDaGFuZ2U+KGV2ZW50cyA9PiB0aGlzLmhhbmRsZVBhcmNlbEV2ZW50cyhldmVudHMsIHdhdGNoZXIpLCBQYXJjZWxXYXRjaGVyLkZJTEVfQ0hBTkdFU19IQU5ETEVSX0RFTEFZKSxcblx0XHRcdGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y3RzLmRpc3Bvc2UodHJ1ZSk7XG5cblx0XHRcdFx0d2F0Y2hlci53b3JrZXIuZmx1c2goKTtcblx0XHRcdFx0d2F0Y2hlci53b3JrZXIuZGlzcG9zZSgpO1xuXG5cdFx0XHRcdGNvbnN0IHdhdGNoZXJJbnN0YW5jZSA9IGF3YWl0IGluc3RhbmNlLnA7XG5cdFx0XHRcdGF3YWl0IHdhdGNoZXJJbnN0YW5jZT8udW5zdWJzY3JpYmUoKTtcblx0XHRcdH1cblx0XHQpO1xuXHRcdHRoaXMuX3dhdGNoZXJzLnNldCh0aGlzLnJlcXVlc3RUb1dhdGNoZXJLZXkocmVxdWVzdCksIHdhdGNoZXIpO1xuXG5cdFx0Ly8gUGF0aCBjaGVja3MgZm9yIHN5bWJvbGljIGxpbmtzIC8gd3JvbmcgY2FzaW5nXG5cdFx0Y29uc3QgeyByZWFsUGF0aCwgcmVhbFBhdGhEaWZmZXJzLCByZWFsUGF0aExlbmd0aCB9ID0gYXdhaXQgdGhpcy5ub3JtYWxpemVQYXRoKHJlcXVlc3QpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBhcmNlbFdhdGNoZXJMaWIgPSBwYXJjZWxXYXRjaGVyO1xuXHRcdFx0Y29uc3QgcGFyY2VsV2F0Y2hlckluc3RhbmNlID0gYXdhaXQgcGFyY2VsV2F0Y2hlckxpYi5zdWJzY3JpYmUocmVhbFBhdGgsIChlcnJvciwgcGFyY2VsRXZlbnRzKSA9PiB7XG5cdFx0XHRcdGlmICh3YXRjaGVyLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgd2hlbiBkaXNwb3NlZFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gSW4gYW55IGNhc2Ugb2YgYW4gZXJyb3IsIHRyZWF0IHRoaXMgbGlrZSBhIHVuaGFuZGxlZCBleGNlcHRpb25cblx0XHRcdFx0Ly8gdGhhdCBtaWdodCByZXF1aXJlIHRoZSB3YXRjaGVyIHRvIHJlc3RhcnQuIFdlIGRvIG5vdCByZWFsbHkga25vd1xuXHRcdFx0XHQvLyB0aGUgc3RhdGUgb2YgcGFyY2VsIGF0IHRoaXMgcG9pbnQgYW5kIGFzIHN1Y2ggd2lsbCB0cnkgdG8gcmVzdGFydFxuXHRcdFx0XHQvLyB1cCB0byBvdXIgbWF4aW11bSBvZiByZXN0YXJ0cy5cblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5vblVuZXhwZWN0ZWRFcnJvcihlcnJvciwgcmVxdWVzdCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBIYW5kbGUgJiBlbWl0IGV2ZW50c1xuXHRcdFx0XHR0aGlzLm9uUGFyY2VsRXZlbnRzKHBhcmNlbEV2ZW50cywgd2F0Y2hlciwgcmVhbFBhdGhEaWZmZXJzLCByZWFsUGF0aExlbmd0aCk7XG5cdFx0XHR9LCB7XG5cdFx0XHRcdGJhY2tlbmQ6IFBhcmNlbFdhdGNoZXIuUEFSQ0VMX1dBVENIRVJfQkFDS0VORCxcblx0XHRcdFx0aWdub3JlOiB0aGlzLmFkZFByZWRlZmluZWRFeGNsdWRlcyh3YXRjaGVyLnJlcXVlc3QuZXhjbHVkZXMpXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy50cmFjZShgU3RhcnRlZCB3YXRjaGluZzogJyR7cmVhbFBhdGh9JyB3aXRoIGJhY2tlbmQgJyR7UGFyY2VsV2F0Y2hlci5QQVJDRUxfV0FUQ0hFUl9CQUNLRU5EfSdgKTtcblxuXHRcdFx0aW5zdGFuY2UuY29tcGxldGUocGFyY2VsV2F0Y2hlckluc3RhbmNlKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5vblVuZXhwZWN0ZWRFcnJvcihlcnJvciwgcmVxdWVzdCk7XG5cblx0XHRcdGluc3RhbmNlLmNvbXBsZXRlKHVuZGVmaW5lZCk7XG5cblx0XHRcdHdhdGNoZXIubm90aWZ5V2F0Y2hGYWlsZWQoKTtcblx0XHRcdHRoaXMuX29uRGlkV2F0Y2hGYWlsLmZpcmUocmVxdWVzdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhZGRQcmVkZWZpbmVkRXhjbHVkZXMoaW5pdGlhbEV4Y2x1ZGVzOiBzdHJpbmdbXSk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBleGNsdWRlcyA9IFsuLi5pbml0aWFsRXhjbHVkZXNdO1xuXG5cdFx0Y29uc3QgcHJlZGVmaW5lZEV4Y2x1ZGVzID0gUGFyY2VsV2F0Y2hlci5QUkVERUZJTkVEX0VYQ0xVREVTW3Byb2Nlc3MucGxhdGZvcm1dO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHByZWRlZmluZWRFeGNsdWRlcykpIHtcblx0XHRcdGZvciAoY29uc3QgZXhjbHVkZSBvZiBwcmVkZWZpbmVkRXhjbHVkZXMpIHtcblx0XHRcdFx0aWYgKCFleGNsdWRlcy5pbmNsdWRlcyhleGNsdWRlKSkge1xuXHRcdFx0XHRcdGV4Y2x1ZGVzLnB1c2goZXhjbHVkZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZXhjbHVkZXM7XG5cdH1cblxuXHRwcml2YXRlIG9uUGFyY2VsRXZlbnRzKHBhcmNlbEV2ZW50czogcGFyY2VsV2F0Y2hlci5FdmVudFtdLCB3YXRjaGVyOiBQYXJjZWxXYXRjaGVySW5zdGFuY2UsIHJlYWxQYXRoRGlmZmVyczogYm9vbGVhbiwgcmVhbFBhdGhMZW5ndGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChwYXJjZWxFdmVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTm9ybWFsaXplIGV2ZW50czogaGFuZGxlIE5GQyBub3JtYWxpemF0aW9uIGFuZCBzeW1saW5rc1xuXHRcdC8vIEl0IGlzIGltcG9ydGFudCB0byBkbyB0aGlzIGJlZm9yZSBjaGVja2luZyBmb3IgaW5jbHVkZXNcblx0XHQvLyB0byBjaGVjayBvbiB0aGUgb3JpZ2luYWwgcGF0aC5cblx0XHR0aGlzLm5vcm1hbGl6ZUV2ZW50cyhwYXJjZWxFdmVudHMsIHdhdGNoZXIucmVxdWVzdCwgcmVhbFBhdGhEaWZmZXJzLCByZWFsUGF0aExlbmd0aCk7XG5cblx0XHQvLyBDaGVjayBmb3IgaW5jbHVkZXNcblx0XHRjb25zdCBpbmNsdWRlZEV2ZW50cyA9IHRoaXMuaGFuZGxlSW5jbHVkZXMod2F0Y2hlciwgcGFyY2VsRXZlbnRzKTtcblxuXHRcdC8vIEFkZCB0byBldmVudCBhZ2dyZWdhdG9yIGZvciBsYXRlciBwcm9jZXNzaW5nXG5cdFx0Zm9yIChjb25zdCBpbmNsdWRlZEV2ZW50IG9mIGluY2x1ZGVkRXZlbnRzKSB7XG5cdFx0XHR3YXRjaGVyLndvcmtlci53b3JrKGluY2x1ZGVkRXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlSW5jbHVkZXMod2F0Y2hlcjogUGFyY2VsV2F0Y2hlckluc3RhbmNlLCBwYXJjZWxFdmVudHM6IHBhcmNlbFdhdGNoZXIuRXZlbnRbXSk6IElGaWxlQ2hhbmdlW10ge1xuXHRcdGNvbnN0IGV2ZW50czogSUZpbGVDaGFuZ2VbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCB7IHBhdGgsIHR5cGU6IHBhcmNlbEV2ZW50VHlwZSB9IG9mIHBhcmNlbEV2ZW50cykge1xuXHRcdFx0Y29uc3QgdHlwZSA9IFBhcmNlbFdhdGNoZXIuTUFQX1BBUkNFTF9XQVRDSEVSX0FDVElPTl9UT19GSUxFX0NIQU5HRS5nZXQocGFyY2VsRXZlbnRUeXBlKSE7XG5cdFx0XHRpZiAodGhpcy52ZXJib3NlTG9nZ2luZykge1xuXHRcdFx0XHR0aGlzLnRyYWNlV2l0aENvcnJlbGF0aW9uKGAke3R5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLkFEREVEID8gJ1tBRERFRF0nIDogdHlwZSA9PT0gRmlsZUNoYW5nZVR5cGUuREVMRVRFRCA/ICdbREVMRVRFRF0nIDogJ1tDSEFOR0VEXSd9ICR7cGF0aH1gLCB3YXRjaGVyLnJlcXVlc3QpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBcHBseSBpbmNsdWRlIGZpbHRlciBpZiBhbnlcblx0XHRcdGlmICghd2F0Y2hlci5pbmNsdWRlKHBhdGgpKSB7XG5cdFx0XHRcdGlmICh0aGlzLnZlcmJvc2VMb2dnaW5nKSB7XG5cdFx0XHRcdFx0dGhpcy50cmFjZVdpdGhDb3JyZWxhdGlvbihgID4+IGlnbm9yZWQgKG5vdCBpbmNsdWRlZCkgJHtwYXRofWAsIHdhdGNoZXIucmVxdWVzdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGV2ZW50cy5wdXNoKHsgdHlwZSwgcmVzb3VyY2U6IFVSSS5maWxlKHBhdGgpLCBjSWQ6IHdhdGNoZXIucmVxdWVzdC5jb3JyZWxhdGlvbklkIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBldmVudHM7XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZVBhcmNlbEV2ZW50cyhwYXJjZWxFdmVudHM6IElGaWxlQ2hhbmdlW10sIHdhdGNoZXI6IFBhcmNlbFdhdGNoZXJJbnN0YW5jZSk6IHZvaWQge1xuXG5cdFx0Ly8gQ29hbGVzY2UgZXZlbnRzOiBtZXJnZSBldmVudHMgb2Ygc2FtZSBraW5kXG5cdFx0Y29uc3QgY29hbGVzY2VkRXZlbnRzID0gY29hbGVzY2VFdmVudHMocGFyY2VsRXZlbnRzKTtcblxuXHRcdC8vIEZpbHRlciBldmVudHM6IGNoZWNrIGZvciBzcGVjaWZpYyBldmVudHMgd2Ugd2FudCB0byBleGNsdWRlXG5cdFx0Y29uc3QgeyBldmVudHM6IGZpbHRlcmVkRXZlbnRzLCByb290RGVsZXRlZCB9ID0gdGhpcy5maWx0ZXJFdmVudHMoY29hbGVzY2VkRXZlbnRzLCB3YXRjaGVyKTtcblxuXHRcdC8vIEJyb2FkY2FzdCB0byBjbGllbnRzXG5cdFx0dGhpcy5lbWl0RXZlbnRzKGZpbHRlcmVkRXZlbnRzLCB3YXRjaGVyKTtcblxuXHRcdC8vIEhhbmRsZSByb290IHBhdGggZGVsZXRlc1xuXHRcdGlmIChyb290RGVsZXRlZCkge1xuXHRcdFx0dGhpcy5vbldhdGNoZWRQYXRoRGVsZXRlZCh3YXRjaGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVtaXRFdmVudHMoZXZlbnRzOiBJRmlsZUNoYW5nZVtdLCB3YXRjaGVyOiBQYXJjZWxXYXRjaGVySW5zdGFuY2UpOiB2b2lkIHtcblx0XHRpZiAoZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEJyb2FkY2FzdCB0byBjbGllbnRzIHZpYSB0aHJvdHRsZXJcblx0XHRjb25zdCB3b3JrZWQgPSB0aGlzLnRocm90dGxlZEZpbGVDaGFuZ2VzRW1pdHRlci53b3JrKGV2ZW50cyk7XG5cblx0XHQvLyBMb2dnaW5nXG5cdFx0aWYgKCF3b3JrZWQpIHtcblx0XHRcdHRoaXMud2Fybihgc3RhcnRlZCBpZ25vcmluZyBldmVudHMgZHVlIHRvIHRvbyBtYW55IGZpbGUgY2hhbmdlIGV2ZW50cyBhdCBvbmNlIChpbmNvbWluZzogJHtldmVudHMubGVuZ3RofSwgbW9zdCByZWNlbnQgY2hhbmdlOiAke2V2ZW50c1swXS5yZXNvdXJjZS5mc1BhdGh9KS4gVXNlICdmaWxlcy53YXRjaGVyRXhjbHVkZScgc2V0dGluZyB0byBleGNsdWRlIGZvbGRlcnMgd2l0aCBsb3RzIG9mIGNoYW5naW5nIGZpbGVzIChlLmcuIGNvbXBpbGF0aW9uIG91dHB1dCkuYCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLnRocm90dGxlZEZpbGVDaGFuZ2VzRW1pdHRlci5wZW5kaW5nID4gMCkge1xuXHRcdFx0XHR0aGlzLnRyYWNlKGBzdGFydGVkIHRocm90dGxpbmcgZXZlbnRzIGR1ZSB0byBsYXJnZSBhbW91bnQgb2YgZmlsZSBjaGFuZ2UgZXZlbnRzIGF0IG9uY2UgKHBlbmRpbmc6ICR7dGhpcy50aHJvdHRsZWRGaWxlQ2hhbmdlc0VtaXR0ZXIucGVuZGluZ30sIG1vc3QgcmVjZW50IGNoYW5nZTogJHtldmVudHNbMF0ucmVzb3VyY2UuZnNQYXRofSkuIFVzZSAnZmlsZXMud2F0Y2hlckV4Y2x1ZGUnIHNldHRpbmcgdG8gZXhjbHVkZSBmb2xkZXJzIHdpdGggbG90cyBvZiBjaGFuZ2luZyBmaWxlcyAoZS5nLiBjb21waWxhdGlvbiBvdXRwdXQpLmAsIHdhdGNoZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbm9ybWFsaXplUGF0aChyZXF1ZXN0OiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0KTogUHJvbWlzZTx7IHJlYWxQYXRoOiBzdHJpbmc7IHJlYWxQYXRoRGlmZmVyczogYm9vbGVhbjsgcmVhbFBhdGhMZW5ndGg6IG51bWJlciB9PiB7XG5cdFx0bGV0IHJlYWxQYXRoID0gcmVxdWVzdC5wYXRoO1xuXHRcdGxldCByZWFsUGF0aERpZmZlcnMgPSBmYWxzZTtcblx0XHRsZXQgcmVhbFBhdGhMZW5ndGggPSByZXF1ZXN0LnBhdGgubGVuZ3RoO1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gRmlyc3QgY2hlY2sgZm9yIHN5bWJvbGljIGxpbmtcblx0XHRcdHJlYWxQYXRoID0gYXdhaXQgcmVhbHBhdGgocmVxdWVzdC5wYXRoKTtcblxuXHRcdFx0Ly8gU2Vjb25kIGNoZWNrIGZvciBjYXNpbmcgZGlmZmVyZW5jZVxuXHRcdFx0Ly8gTm90ZTogdGhpcyB3aWxsIGJlIGEgbm8tb3Agb24gTGludXggcGxhdGZvcm1zXG5cdFx0XHRpZiAocmVxdWVzdC5wYXRoID09PSByZWFsUGF0aCkge1xuXHRcdFx0XHRyZWFsUGF0aCA9IGF3YWl0IHJlYWxjYXNlKHJlcXVlc3QucGF0aCkgPz8gcmVxdWVzdC5wYXRoO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDb3JyZWN0IHdhdGNoIHBhdGggYXMgbmVlZGVkXG5cdFx0XHRpZiAocmVxdWVzdC5wYXRoICE9PSByZWFsUGF0aCkge1xuXHRcdFx0XHRyZWFsUGF0aExlbmd0aCA9IHJlYWxQYXRoLmxlbmd0aDtcblx0XHRcdFx0cmVhbFBhdGhEaWZmZXJzID0gdHJ1ZTtcblxuXHRcdFx0XHR0aGlzLnRyYWNlKGBjb3JyZWN0aW5nIGEgcGF0aCB0byB3YXRjaCB0aGF0IHNlZW1zIHRvIGJlIGEgc3ltYm9saWMgbGluayBvciB3cm9uZyBjYXNpbmcgKG9yaWdpbmFsOiAke3JlcXVlc3QucGF0aH0sIHJlYWw6ICR7cmVhbFBhdGh9KWApO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBpZ25vcmVcblx0XHR9XG5cblx0XHRyZXR1cm4geyByZWFsUGF0aCwgcmVhbFBhdGhEaWZmZXJzLCByZWFsUGF0aExlbmd0aCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBub3JtYWxpemVFdmVudHMoZXZlbnRzOiBwYXJjZWxXYXRjaGVyLkV2ZW50W10sIHJlcXVlc3Q6IElSZWN1cnNpdmVXYXRjaFJlcXVlc3QsIHJlYWxQYXRoRGlmZmVyczogYm9vbGVhbiwgcmVhbFBhdGhMZW5ndGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG5cblx0XHRcdC8vIE1hYyB1c2VzIE5GRCB1bmljb2RlIGZvcm0gb24gZGlzaywgYnV0IHdlIHdhbnQgTkZDXG5cdFx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0ZXZlbnQucGF0aCA9IG5vcm1hbGl6ZU5GQyhldmVudC5wYXRoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV29ya2Fyb3VuZCBmb3IgaHR0cHM6Ly9naXRodWIuY29tL3BhcmNlbC1idW5kbGVyL3dhdGNoZXIvaXNzdWVzLzY4XG5cdFx0XHQvLyB3aGVyZSB3YXRjaGluZyByb290IGRyaXZlIGxldHRlciBhZGRzIGV4dHJhIGJhY2tzbGFzaGVzLlxuXHRcdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0XHRpZiAocmVxdWVzdC5wYXRoLmxlbmd0aCA8PSAzKSB7IC8vIGZvciBleC4gYzosIEM6XFxcblx0XHRcdFx0XHRldmVudC5wYXRoID0gbm9ybWFsaXplKGV2ZW50LnBhdGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbnZlcnQgcGF0aHMgYmFjayB0byBvcmlnaW5hbCBmb3JtIGluIGNhc2UgaXQgZGlmZmVyc1xuXHRcdFx0aWYgKHJlYWxQYXRoRGlmZmVycykge1xuXHRcdFx0XHRldmVudC5wYXRoID0gcmVxdWVzdC5wYXRoICsgZXZlbnQucGF0aC5zdWJzdHIocmVhbFBhdGhMZW5ndGgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyRXZlbnRzKGV2ZW50czogSUZpbGVDaGFuZ2VbXSwgd2F0Y2hlcjogUGFyY2VsV2F0Y2hlckluc3RhbmNlKTogeyBldmVudHM6IElGaWxlQ2hhbmdlW107IHJvb3REZWxldGVkPzogYm9vbGVhbiB9IHtcblx0XHRjb25zdCBmaWx0ZXJlZEV2ZW50czogSUZpbGVDaGFuZ2VbXSA9IFtdO1xuXHRcdGxldCByb290RGVsZXRlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgZmlsdGVyID0gdGhpcy5pc0NvcnJlbGF0ZWQod2F0Y2hlci5yZXF1ZXN0KSA/IHdhdGNoZXIucmVxdWVzdC5maWx0ZXIgOiB1bmRlZmluZWQ7IC8vIGZpbHRlcmluZyBpcyBvbmx5IGVuYWJsZWQgd2hlbiBjb3JyZWxhdGluZyBiZWNhdXNlIHdhdGNoZXJzIGFyZSBvdGhlcndpc2UgcG90ZW50aWFsbHkgcmV1c2VkXG5cdFx0Zm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcblxuXHRcdFx0Ly8gRW1pdCB0byBpbnN0YW5jZSBzdWJzY3JpcHRpb25zIGlmIGFueSBiZWZvcmUgZmlsdGVyaW5nXG5cdFx0XHRpZiAod2F0Y2hlci5zdWJzY3JpcHRpb25zQ291bnQgPiAwKSB7XG5cdFx0XHRcdHdhdGNoZXIubm90aWZ5RmlsZUNoYW5nZShldmVudC5yZXNvdXJjZS5mc1BhdGgsIGV2ZW50KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlsdGVyaW5nXG5cdFx0XHRyb290RGVsZXRlZCA9IGV2ZW50LnR5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgJiYgaXNFcXVhbChldmVudC5yZXNvdXJjZS5mc1BhdGgsIHdhdGNoZXIucmVxdWVzdC5wYXRoLCAhaXNMaW51eCk7XG5cdFx0XHRpZiAoaXNGaWx0ZXJlZChldmVudCwgZmlsdGVyKSkge1xuXHRcdFx0XHRpZiAodGhpcy52ZXJib3NlTG9nZ2luZykge1xuXHRcdFx0XHRcdHRoaXMudHJhY2VXaXRoQ29ycmVsYXRpb24oYCA+PiBpZ25vcmVkIChmaWx0ZXJlZCkgJHtldmVudC5yZXNvdXJjZS5mc1BhdGh9YCwgd2F0Y2hlci5yZXF1ZXN0KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBMb2dnaW5nXG5cdFx0XHR0aGlzLnRyYWNlRXZlbnQoZXZlbnQsIHdhdGNoZXIucmVxdWVzdCk7XG5cblx0XHRcdGZpbHRlcmVkRXZlbnRzLnB1c2goZXZlbnQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGV2ZW50czogZmlsdGVyZWRFdmVudHMsIHJvb3REZWxldGVkIH07XG5cdH1cblxuXHRwcml2YXRlIG9uV2F0Y2hlZFBhdGhEZWxldGVkKHdhdGNoZXI6IFBhcmNlbFdhdGNoZXJJbnN0YW5jZSk6IHZvaWQge1xuXHRcdHRoaXMud2FybignV2F0Y2hlciBzaHV0ZG93biBiZWNhdXNlIHdhdGNoZWQgcGF0aCBnb3QgZGVsZXRlZCcsIHdhdGNoZXIpO1xuXG5cdFx0d2F0Y2hlci5ub3RpZnlXYXRjaEZhaWxlZCgpO1xuXHRcdHRoaXMuX29uRGlkV2F0Y2hGYWlsLmZpcmUod2F0Y2hlci5yZXF1ZXN0KTtcblx0fVxuXG5cdHByaXZhdGUgb25VbmV4cGVjdGVkRXJyb3IoZXJyb3I6IHVua25vd24sIHJlcXVlc3Q/OiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0KTogdm9pZCB7XG5cdFx0Y29uc3QgbXNnID0gdG9FcnJvck1lc3NhZ2UoZXJyb3IpO1xuXG5cdFx0Ly8gU3BlY2lhbGx5IGhhbmRsZSBFTk9TUEMgZXJyb3JzIHRoYXQgY2FuIGhhcHBlbiB3aGVuXG5cdFx0Ly8gdGhlIHdhdGNoZXIgY29uc3VtZXMgc28gbWFueSBmaWxlIGRlc2NyaXB0b3JzIHRoYXRcblx0XHQvLyB3ZSBhcmUgcnVubmluZyBpbnRvIGEgbGltaXQuIFdlIG9ubHkgd2FudCB0byB3YXJuXG5cdFx0Ly8gb25jZSBpbiB0aGlzIGNhc2UgdG8gYXZvaWQgbG9nIHNwYW0uXG5cdFx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy83OTUwXG5cdFx0aWYgKG1zZy5pbmRleE9mKCdObyBzcGFjZSBsZWZ0IG9uIGRldmljZScpICE9PSAtMSkge1xuXHRcdFx0aWYgKCF0aGlzLmVub3NwY0Vycm9yTG9nZ2VkKSB7XG5cdFx0XHRcdHRoaXMuZXJyb3IoJ0lub3RpZnkgbGltaXQgcmVhY2hlZCAoRU5PU1BDKScsIHJlcXVlc3QpO1xuXG5cdFx0XHRcdHRoaXMuZW5vc3BjRXJyb3JMb2dnZWQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFZlcnNpb24gMi41LjEgaW50cm9kdWNlcyAzIG5ldyBlcnJvcnMgb24gbWFjT1Ncblx0XHQvLyB2aWEgaHR0cHM6Ly9naXRodWIuZGV2L3BhcmNlbC1idW5kbGVyL3dhdGNoZXIvcHVsbC8xOTZcblx0XHRlbHNlIGlmIChtc2cuaW5kZXhPZignRmlsZSBzeXN0ZW0gbXVzdCBiZSByZS1zY2FubmVkJykgIT09IC0xKSB7XG5cdFx0XHR0aGlzLmVycm9yKG1zZywgcmVxdWVzdCk7XG5cdFx0fVxuXG5cdFx0Ly8gQW55IG90aGVyIGVycm9yIGlzIHVuZXhwZWN0ZWQgYW5kIHdlIHNob3VsZCB0cnkgdG9cblx0XHQvLyByZXN0YXJ0IHRoZSB3YXRjaGVyIGFzIGEgcmVzdWx0IHRvIGdldCBpbnRvIGhlYWx0aHlcblx0XHQvLyBzdGF0ZSBhZ2FpbiBpZiBwb3NzaWJsZSBhbmQgaWYgbm90IGF0dGVtcHRlZCB0b28gbXVjaFxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5lcnJvcihgVW5leHBlY3RlZCBlcnJvcjogJHttc2d9IChFVU5LTk9XTilgLCByZXF1ZXN0KTtcblxuXHRcdFx0dGhpcy5fb25EaWRFcnJvci5maXJlKHsgcmVxdWVzdCwgZXJyb3I6IG1zZyB9KTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLnN0b3AoKTtcblxuXHRcdGZvciAoY29uc3Qgd2F0Y2hlciBvZiB0aGlzLndhdGNoZXJzKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnN0b3BXYXRjaGluZyh3YXRjaGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVzdGFydFdhdGNoaW5nKHdhdGNoZXI6IFBhcmNlbFdhdGNoZXJJbnN0YW5jZSwgZGVsYXkgPSA4MDApOiB2b2lkIHtcblxuXHRcdC8vIFJlc3RhcnQgd2F0Y2hlciBkZWxheWVkIHRvIGFjY29tb2RhdGUgZm9yXG5cdFx0Ly8gY2hhbmdlcyBvbiBkaXNrIHRoYXQgaGF2ZSB0cmlnZ2VyZWQgdGhlXG5cdFx0Ly8gbmVlZCBmb3IgYSByZXN0YXJ0IGluIHRoZSBmaXJzdCBwbGFjZS5cblx0XHRjb25zdCBzY2hlZHVsZXIgPSBuZXcgUnVuT25jZVNjaGVkdWxlcihhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAod2F0Y2hlci50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIHJldHVybiBlYXJseSB3aGVuIGRpc3Bvc2VkXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3RhcnRQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0dHJ5IHtcblxuXHRcdFx0XHQvLyBBd2FpdCB0aGUgd2F0Y2hlciBoYXZpbmcgc3RvcHBlZCwgYXMgdGhpcyBpc1xuXHRcdFx0XHQvLyBuZWVkZWQgdG8gcHJvcGVybHkgcmUtd2F0Y2ggdGhlIHNhbWUgcGF0aFxuXHRcdFx0XHRhd2FpdCB0aGlzLnN0b3BXYXRjaGluZyh3YXRjaGVyLCByZXN0YXJ0UHJvbWlzZS5wKTtcblxuXHRcdFx0XHQvLyBTdGFydCB3YXRjaGVyIGFnYWluIGNvdW50aW5nIHRoZSByZXN0YXJ0c1xuXHRcdFx0XHRpZiAod2F0Y2hlci5yZXF1ZXN0LnBvbGxpbmdJbnRlcnZhbCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc3RhcnRQb2xsaW5nKHdhdGNoZXIucmVxdWVzdCwgd2F0Y2hlci5yZXF1ZXN0LnBvbGxpbmdJbnRlcnZhbCwgd2F0Y2hlci5yZXN0YXJ0cyArIDEpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuc3RhcnRXYXRjaGluZyh3YXRjaGVyLnJlcXVlc3QsIHdhdGNoZXIucmVzdGFydHMgKyAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0cmVzdGFydFByb21pc2UuY29tcGxldGUoKTtcblx0XHRcdH1cblx0XHR9LCBkZWxheSk7XG5cblx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR3YXRjaGVyLnRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHNjaGVkdWxlci5kaXNwb3NlKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzdG9wV2F0Y2hpbmcod2F0Y2hlcjogUGFyY2VsV2F0Y2hlckluc3RhbmNlLCBqb2luUmVzdGFydD86IFByb21pc2U8dm9pZD4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKGBzdG9wcGluZyBmaWxlIHdhdGNoZXJgLCB3YXRjaGVyKTtcblxuXHRcdHRoaXMuX3dhdGNoZXJzLmRlbGV0ZSh0aGlzLnJlcXVlc3RUb1dhdGNoZXJLZXkod2F0Y2hlci5yZXF1ZXN0KSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgd2F0Y2hlci5zdG9wKGpvaW5SZXN0YXJ0KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5lcnJvcihgVW5leHBlY3RlZCBlcnJvciBzdG9wcGluZyB3YXRjaGVyOiAke3RvRXJyb3JNZXNzYWdlKGVycm9yKX1gLCB3YXRjaGVyLnJlcXVlc3QpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyByZW1vdmVEdXBsaWNhdGVSZXF1ZXN0cyhyZXF1ZXN0czogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdLCB2YWxpZGF0ZVBhdGhzID0gdHJ1ZSk6IFByb21pc2U8SVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdPiB7XG5cblx0XHQvLyBTb3J0IHJlcXVlc3RzIGJ5IHBhdGggbGVuZ3RoIHRvIGhhdmUgc2hvcnRlc3QgZmlyc3Rcblx0XHQvLyB0byBoYXZlIGEgd2F5IHRvIHByZXZlbnQgY2hpbGRyZW4gdG8gYmUgd2F0Y2hlZCBpZlxuXHRcdC8vIHBhcmVudHMgZXhpc3QuXG5cdFx0cmVxdWVzdHMuc29ydCgocmVxdWVzdEEsIHJlcXVlc3RCKSA9PiByZXF1ZXN0QS5wYXRoLmxlbmd0aCAtIHJlcXVlc3RCLnBhdGgubGVuZ3RoKTtcblxuXHRcdC8vIElnbm9yZSByZXF1ZXN0cyBmb3IgdGhlIHNhbWUgcGF0aHMgdGhhdCBoYXZlIHRoZSBzYW1lIGNvcnJlbGF0aW9uXG5cdFx0Y29uc3QgbWFwQ29ycmVsYXRpb250b1JlcXVlc3RzID0gbmV3IE1hcDxudW1iZXIgfCB1bmRlZmluZWQgLyogY29ycmVsYXRpb24gKi8sIE1hcDxzdHJpbmcsIElSZWN1cnNpdmVXYXRjaFJlcXVlc3Q+PigpO1xuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiByZXF1ZXN0cykge1xuXHRcdFx0aWYgKHJlcXVlc3QuZXhjbHVkZXMuaW5jbHVkZXMoR0xPQlNUQVIpKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBwYXRoIGlzIGlnbm9yZWQgZW50aXJlbHkgKHZpYSBgKipgIGdsb2IgZXhjbHVkZSlcblx0XHRcdH1cblxuXG5cdFx0XHRsZXQgcmVxdWVzdHNGb3JDb3JyZWxhdGlvbiA9IG1hcENvcnJlbGF0aW9udG9SZXF1ZXN0cy5nZXQocmVxdWVzdC5jb3JyZWxhdGlvbklkKTtcblx0XHRcdGlmICghcmVxdWVzdHNGb3JDb3JyZWxhdGlvbikge1xuXHRcdFx0XHRyZXF1ZXN0c0ZvckNvcnJlbGF0aW9uID0gbmV3IE1hcDxzdHJpbmcsIElSZWN1cnNpdmVXYXRjaFJlcXVlc3Q+KCk7XG5cdFx0XHRcdG1hcENvcnJlbGF0aW9udG9SZXF1ZXN0cy5zZXQocmVxdWVzdC5jb3JyZWxhdGlvbklkLCByZXF1ZXN0c0ZvckNvcnJlbGF0aW9uKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcGF0aCA9IHRoaXMucGF0aFRvV2F0Y2hlcktleShyZXF1ZXN0LnBhdGgpO1xuXHRcdFx0aWYgKHJlcXVlc3RzRm9yQ29ycmVsYXRpb24uaGFzKHBhdGgpKSB7XG5cdFx0XHRcdHRoaXMudHJhY2UoYGlnbm9yaW5nIGEgcmVxdWVzdCBmb3Igd2F0Y2hpbmcgd2hvJ3MgcGF0aCBpcyBhbHJlYWR5IHdhdGNoZWQ6ICR7dGhpcy5yZXF1ZXN0VG9TdHJpbmcocmVxdWVzdCl9YCk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcXVlc3RzRm9yQ29ycmVsYXRpb24uc2V0KHBhdGgsIHJlcXVlc3QpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5vcm1hbGl6ZWRSZXF1ZXN0czogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHJlcXVlc3RzRm9yQ29ycmVsYXRpb24gb2YgbWFwQ29ycmVsYXRpb250b1JlcXVlc3RzLnZhbHVlcygpKSB7XG5cblx0XHRcdC8vIE9ubHkgY29uc2lkZXIgcmVxdWVzdHMgZm9yIHdhdGNoaW5nIHRoYXQgYXJlIG5vdFxuXHRcdFx0Ly8gYSBjaGlsZCBvZiBhbiBleGlzdGluZyByZXF1ZXN0IHBhdGggdG8gcHJldmVudFxuXHRcdFx0Ly8gZHVwbGljYXRpb24uIEluIGFkZGl0aW9uLCBkcm9wIGFueSByZXF1ZXN0IHdoZXJlXG5cdFx0XHQvLyBldmVyeXRoaW5nIGlzIGV4Y2x1ZGVkICh2aWEgYCoqYCBnbG9iKS5cblx0XHRcdC8vXG5cdFx0XHQvLyBIb3dldmVyLCBhbGxvdyBleHBsaWNpdCByZXF1ZXN0cyB0byB3YXRjaCBmb2xkZXJzXG5cdFx0XHQvLyB0aGF0IGFyZSBzeW1ib2xpYyBsaW5rcyBiZWNhdXNlIHRoZSBQYXJjZWwgd2F0Y2hlclxuXHRcdFx0Ly8gZG9lcyBub3QgYWxsb3cgdG8gcmVjdXJzaXZlbHkgd2F0Y2ggc3ltYm9saWMgbGlua3MuXG5cblx0XHRcdGNvbnN0IHJlcXVlc3RUcmllID0gVGVybmFyeVNlYXJjaFRyZWUuZm9yUGF0aHM8SVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdD4oIWlzTGludXgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgcmVxdWVzdHNGb3JDb3JyZWxhdGlvbi52YWx1ZXMoKSkge1xuXG5cdFx0XHRcdC8vIENoZWNrIGZvciBvdmVybGFwcGluZyByZXF1ZXN0IHBhdGhzIChidXQgcHJlc2VydmUgc3ltYm9saWMgbGlua3MpXG5cdFx0XHRcdGlmIChyZXF1ZXN0VHJpZS5maW5kU3Vic3RyKHJlcXVlc3QucGF0aCkpIHtcblx0XHRcdFx0XHRpZiAocmVxdWVzdFRyaWUuaGFzKHJlcXVlc3QucGF0aCkpIHtcblx0XHRcdFx0XHRcdHRoaXMudHJhY2UoYGlnbm9yaW5nIGEgcmVxdWVzdCBmb3Igd2F0Y2hpbmcgd2hvJ3MgcGF0aCBpcyBhbHJlYWR5IHdhdGNoZWQ6ICR7dGhpcy5yZXF1ZXN0VG9TdHJpbmcocmVxdWVzdCl9YCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGlmICghKGF3YWl0IHByb21pc2VzLmxzdGF0KHJlcXVlc3QucGF0aCkpLmlzU3ltYm9saWNMaW5rKCkpIHtcblx0XHRcdFx0XHRcdFx0XHR0aGlzLnRyYWNlKGBpZ25vcmluZyBhIHJlcXVlc3QgZm9yIHdhdGNoaW5nIHdobydzIHBhcmVudCBpcyBhbHJlYWR5IHdhdGNoZWQ6ICR7dGhpcy5yZXF1ZXN0VG9TdHJpbmcocmVxdWVzdCl9YCk7XG5cblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy50cmFjZShgaWdub3JpbmcgYSByZXF1ZXN0IGZvciB3YXRjaGluZyB3aG8ncyBsc3RhdCBmYWlsZWQgdG8gcmVzb2x2ZTogJHt0aGlzLnJlcXVlc3RUb1N0cmluZyhyZXF1ZXN0KX0gKGVycm9yOiAke2Vycm9yfSlgKTtcblxuXHRcdFx0XHRcdFx0XHR0aGlzLl9vbkRpZFdhdGNoRmFpbC5maXJlKHJlcXVlc3QpO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENoZWNrIGZvciBpbnZhbGlkIHBhdGhzXG5cdFx0XHRcdGlmICh2YWxpZGF0ZVBhdGhzICYmICEoYXdhaXQgdGhpcy5pc1BhdGhWYWxpZChyZXF1ZXN0LnBhdGgpKSkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkV2F0Y2hGYWlsLmZpcmUocmVxdWVzdCk7XG5cblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJlcXVlc3RUcmllLnNldChyZXF1ZXN0LnBhdGgsIHJlcXVlc3QpO1xuXHRcdFx0fVxuXG5cdFx0XHRub3JtYWxpemVkUmVxdWVzdHMucHVzaCguLi5BcnJheS5mcm9tKHJlcXVlc3RUcmllKS5tYXAoKFssIHJlcXVlc3RdKSA9PiByZXF1ZXN0KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vcm1hbGl6ZWRSZXF1ZXN0cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaXNQYXRoVmFsaWQocGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCBwcm9taXNlcy5zdGF0KHBhdGgpO1xuXHRcdFx0aWYgKCFzdGF0LmlzRGlyZWN0b3J5KCkpIHtcblx0XHRcdFx0dGhpcy50cmFjZShgaWdub3JpbmcgYSBwYXRoIGZvciB3YXRjaGluZyB0aGF0IGlzIGEgZmlsZSBhbmQgbm90IGEgZm9sZGVyOiAke3BhdGh9YCk7XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLnRyYWNlKGBpZ25vcmluZyBhIHBhdGggZm9yIHdhdGNoaW5nIHdobydzIHN0YXQgaW5mbyBmYWlsZWQgdG8gcmVzb2x2ZTogJHtwYXRofSAoZXJyb3I6ICR7ZXJyb3J9KWApO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRzdWJzY3JpYmUocGF0aDogc3RyaW5nLCBjYWxsYmFjazogKGVycm9yOiB0cnVlIHwgbnVsbCwgY2hhbmdlPzogSUZpbGVDaGFuZ2UpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZCB7XG5cdFx0Zm9yIChjb25zdCB3YXRjaGVyIG9mIHRoaXMud2F0Y2hlcnMpIHtcblx0XHRcdGlmICh3YXRjaGVyLmZhaWxlZCkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gd2F0Y2hlciBoYXMgYWxyZWFkeSBmYWlsZWRcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpc0VxdWFsT3JQYXJlbnQocGF0aCwgd2F0Y2hlci5yZXF1ZXN0LnBhdGgsICFpc0xpbnV4KSkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gd2F0Y2hlciBkb2VzIG5vdCBjb25zaWRlciB0aGlzIHBhdGhcblx0XHRcdH1cblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR3YXRjaGVyLmV4Y2x1ZGUocGF0aCkgfHxcblx0XHRcdFx0IXdhdGNoZXIuaW5jbHVkZShwYXRoKVxuXHRcdFx0KSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBwYXJjZWwgaW5zdGFuY2UgZG9lcyBub3QgY29uc2lkZXIgdGhpcyBwYXRoXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZSh3YXRjaGVyLm9uRGlkU3RvcCkoYXN5bmMgZSA9PiB7XG5cdFx0XHRcdGF3YWl0IGUuam9pblJlc3RhcnQ7IC8vIGlmIHdlIGFyZSByZXN0YXJ0aW5nLCBhd2FpdCB0aGF0IHNvIHRoYXQgd2UgY2FuIHBvc3NpYmx5IHJldXNlIHRoaXMgd2F0Y2hlciBhZ2FpblxuXHRcdFx0XHRpZiAoZGlzcG9zYWJsZXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNhbGxiYWNrKHRydWUgLyogZXJyb3IgKi8pO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKEV2ZW50Lm9uY2Uod2F0Y2hlci5vbkRpZEZhaWwpKCgpID0+IGNhbGxiYWNrKHRydWUgLyogZXJyb3IgKi8pKSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQod2F0Y2hlci5zdWJzY3JpYmUocGF0aCwgY2hhbmdlID0+IGNhbGxiYWNrKG51bGwsIGNoYW5nZSkpKTtcblxuXHRcdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdHJhY2UobWVzc2FnZTogc3RyaW5nLCB3YXRjaGVyPzogUGFyY2VsV2F0Y2hlckluc3RhbmNlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMudmVyYm9zZUxvZ2dpbmcpIHtcblx0XHRcdHRoaXMuX29uRGlkTG9nTWVzc2FnZS5maXJlKHsgdHlwZTogJ3RyYWNlJywgbWVzc2FnZTogdGhpcy50b01lc3NhZ2UobWVzc2FnZSwgd2F0Y2hlcj8ucmVxdWVzdCkgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHdhcm4obWVzc2FnZTogc3RyaW5nLCB3YXRjaGVyPzogUGFyY2VsV2F0Y2hlckluc3RhbmNlKSB7XG5cdFx0dGhpcy5fb25EaWRMb2dNZXNzYWdlLmZpcmUoeyB0eXBlOiAnd2FybicsIG1lc3NhZ2U6IHRoaXMudG9NZXNzYWdlKG1lc3NhZ2UsIHdhdGNoZXI/LnJlcXVlc3QpIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBlcnJvcihtZXNzYWdlOiBzdHJpbmcsIHJlcXVlc3Q/OiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0KSB7XG5cdFx0dGhpcy5fb25EaWRMb2dNZXNzYWdlLmZpcmUoeyB0eXBlOiAnZXJyb3InLCBtZXNzYWdlOiB0aGlzLnRvTWVzc2FnZShtZXNzYWdlLCByZXF1ZXN0KSB9KTtcblx0fVxuXG5cdHByaXZhdGUgdG9NZXNzYWdlKG1lc3NhZ2U6IHN0cmluZywgcmVxdWVzdD86IElSZWN1cnNpdmVXYXRjaFJlcXVlc3QpOiBzdHJpbmcge1xuXHRcdHJldHVybiByZXF1ZXN0ID8gYFtGaWxlIFdhdGNoZXJdICR7bWVzc2FnZX0gKHBhdGg6ICR7cmVxdWVzdC5wYXRofSlgIDogYFtGaWxlIFdhdGNoZXIgKCdwYXJjZWwnKV0gJHttZXNzYWdlfWA7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IHJlY3Vyc2l2ZVdhdGNoZXIoKSB7IHJldHVybiB0aGlzOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLG1CQUFtQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFFBQVEsZUFBZTtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUIsa0JBQWtCLGVBQWUsdUJBQXVCO0FBQ2xGLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksU0FBUyx1QkFBdUI7QUFDckQsU0FBUyxVQUF5QixzQkFBc0I7QUFDeEQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxXQUFXLFlBQVk7QUFDaEMsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQ2hELFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyxzQkFBbUM7QUFDNUMsU0FBUyxnQkFBd0Msc0JBQXNELGtCQUFzQztBQUM3SSxTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUVoRSxNQUFNLDhCQUE4QixXQUFXO0FBQUEsRUFtQnJELFlBSVUsT0FDQSxTQUtBLFVBSUEsT0FJQSxRQUNRLFFBQ2hCO0FBQ0QsVUFBTTtBQWpCRztBQUNBO0FBS0E7QUFJQTtBQUlBO0FBQ1E7QUFwQ2xCLFNBQWlCLGFBQWEsS0FBSyxVQUFVLElBQUksUUFBeUMsQ0FBQztBQUMzRixTQUFTLFlBQVksS0FBSyxXQUFXO0FBRXJDLFNBQWlCLGFBQWEsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ2hFLFNBQVMsWUFBWSxLQUFLLFdBQVc7QUFFckMsU0FBUSxVQUFVO0FBR2xCLFNBQVEsVUFBVTtBQU1sQixTQUFpQixnQkFBZ0Isb0JBQUksSUFBZ0Q7QUF5QnBGLFNBQUssV0FBVyxLQUFLLFFBQVEsV0FBVyxxQkFBcUIsS0FBSyxRQUFRLE1BQU0sS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUN6RyxTQUFLLFdB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
