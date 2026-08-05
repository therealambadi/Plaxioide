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
import { localize } from "../../../../nls.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { WorkingCopyHistoryTracker } from "./workingCopyHistoryTracker.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { MAX_PARALLEL_HISTORY_IO_OPS } from "./workingCopyHistory.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../platform/files/common/files.js";
import { IRemoteAgentService } from "../../remote/common/remoteAgentService.js";
import { URI } from "../../../../base/common/uri.js";
import { DeferredPromise, Limiter, RunOnceScheduler } from "../../../../base/common/async.js";
import { dirname, extname, isEqual, joinPath } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { hash } from "../../../../base/common/hash.js";
import { indexOfPath, randomPath } from "../../../../base/common/extpath.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { distinct } from "../../../../base/common/arrays.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
const _WorkingCopyHistoryModel = class _WorkingCopyHistoryModel {
  constructor(workingCopyResource, historyHome, entryAddedEmitter, entryChangedEmitter, entryReplacedEmitter, entryRemovedEmitter, options, fileService, labelService, logService, configurationService) {
    this.historyHome = historyHome;
    this.entryAddedEmitter = entryAddedEmitter;
    this.entryChangedEmitter = entryChangedEmitter;
    this.entryReplacedEmitter = entryReplacedEmitter;
    this.entryRemovedEmitter = entryRemovedEmitter;
    this.options = options;
    this.fileService = fileService;
    this.labelService = labelService;
    this.logService = logService;
    this.configurationService = configurationService;
    this.entries = [];
    this.whenResolved = void 0;
    this.workingCopyResource = void 0;
    this.workingCopyName = void 0;
    this.historyEntriesFolder = void 0;
    this.historyEntriesListingFile = void 0;
    this.historyEntriesNameMatcher = void 0;
    this.versionId = 0;
    this.storedVersionId = this.versionId;
    this.storeLimiter = new Limiter(1);
    this.setWorkingCopy(workingCopyResource);
  }
  setWorkingCopy(workingCopyResource) {
    this.workingCopyResource = workingCopyResource;
    this.workingCopyName = this.labelService.getUriBasenameLabel(workingCopyResource);
    this.historyEntriesNameMatcher = new RegExp(`[A-Za-z0-9]{4}${escapeRegExpCharacters(extname(workingCopyResource))}`);
    this.historyEntriesFolder = this.toHistoryEntriesFolder(this.historyHome, workingCopyResource);
    this.historyEntriesListingFile = joinPath(this.historyEntriesFolder, _WorkingCopyHistoryModel.ENTRIES_FILE);
    this.entries = [];
    this.whenResolved = void 0;
  }
  toHistoryEntriesFolder(historyHome, workingCopyResource) {
    return joinPath(historyHome, hash(workingCopyResource.toString()).toString(16));
  }
  async addEntry(source = _WorkingCopyHistoryModel.FILE_SAVED_SOURCE, sourceDescription = void 0, timestamp = Date.now(), token) {
    let entryToReplace = void 0;
    const lastEntry = this.entries.at(-1);
    if (lastEntry && lastEntry.source === source) {
      const configuredReplaceInterval = this.configurationService.getValue(_WorkingCopyHistoryModel.SETTINGS.MERGE_PERIOD, { resource: this.workingCopyResource });
      if (timestamp - lastEntry.timestamp <= configuredReplaceInterval * 1e3) {
        entryToReplace = lastEntry;
      }
    }
    let entry;
    if (entryToReplace) {
      entry = await this.doReplaceEntry(entryToReplace, source, sourceDescription, timestamp, token);
    } else {
      entry = await this.doAddEntry(source, sourceDescription, timestamp, token);
    }
    if (this.options.flushOnChange && !token.isCancellationRequested) {
      await this.store(token);
    }
    return entry;
  }
  async doAddEntry(source, sourceDescription = void 0, timestamp, token) {
    const workingCopyResource = assertIsDefined(this.workingCopyResource);
    const workingCopyName = assertIsDefined(this.workingCopyName);
    const historyEntriesFolder = assertIsDefined(this.historyEntriesFolder);
    const id = `${randomPath(void 0, void 0, 4)}${extname(workingCopyResource)}`;
    const location = joinPath(historyEntriesFolder, id);
    await this.fileService.cloneFile(workingCopyResource, location);
    const entry = {
      id,
      workingCopy: { resource: workingCopyResource, name: workingCopyName },
      location,
      timestamp,
      source,
      sourceDescription
    };
    this.entries.push(entry);
    this.versionId++;
    this.entryAddedEmitter.fire({ entry });
    return entry;
  }
  async doReplaceEntry(entry, source, sourceDescription = void 0, timestamp, token) {
    const workingCopyResource = assertIsDefined(this.workingCopyResource);
    await this.fileService.cloneFile(workingCopyResource, entry.location);
    entry.source = source;
    entry.sourceDescription = sourceDescription;
    entry.timestamp = timestamp;
    this.versionId++;
    this.entryReplacedEmitter.fire({ entry });
    return entry;
  }
  async removeEntry(entry, token) {
    await this.resolveEntriesOnce();
    if (token.isCancellationRequested) {
      return false;
    }
    const index = this.entries.indexOf(entry);
    if (index === -1) {
      return false;
    }
    await this.deleteEntry(entry);
    this.entries.splice(index, 1);
    this.versionId++;
    this.entryRemovedEmitter.fire({ entry });
    if (this.options.flushOnChange && !token.isCancellationRequested) {
      await this.store(token);
    }
    return true;
  }
  async updateEntry(entry, properties, token) {
    await this.resolveEntriesOnce();
    if (token.isCancellationRequested) {
      return;
    }
    const index = this.entries.indexOf(entry);
    if (index === -1) {
      return;
    }
    entry.source = properties.source;
    this.versionId++;
    this.entryChangedEmitter.fire({ entry });
    if (this.options.flushOnChange && !token.isCancellationRequested) {
      await this.store(token);
    }
  }
  async getEntries() {
    await this.resolveEntriesOnce();
    const configuredMaxEntries = this.configurationService.getValue(_WorkingCopyHistoryModel.SETTINGS.MAX_ENTRIES, { resource: this.workingCopyResource });
    if (this.entries.length > configuredMaxEntries) {
      return this.entries.slice(this.entries.length - configuredMaxEntries);
    }
    return this.entries;
  }
  async hasEntries(skipResolve) {
    if (!skipResolve) {
      await this.resolveEntriesOnce();
    }
    return this.entries.length > 0;
  }
  resolveEntriesOnce() {
    if (!this.whenResolved) {
      this.whenResolved = this.doResolveEntries();
    }
    return this.whenResolved;
  }
  async doResolveEntries() {
    const entries = await this.resolveEntriesFromDisk();
    for (const entry of this.entries) {
      entries.set(entry.id, entry);
    }
    this.entries = Array.from(entries.values()).sort((entryA, entryB) => entryA.timestamp - entryB.timestamp);
  }
  async resolveEntriesFromDisk() {
    const workingCopyResource = assertIsDefined(this.workingCopyResource);
    const workingCopyName = assertIsDefined(this.workingCopyName);
    const [entryListing, entryStats] = await Promise.all([
      // Resolve entries listing file
      this.readEntriesFile(),
      // Resolve children of history folder
      this.readEntriesFolder()
    ]);
    const entries = /* @__PURE__ */ new Map();
    if (entryStats) {
      for (const entryStat of entryStats) {
        entries.set(entryStat.name, {
          id: entryStat.name,
          workingCopy: { resource: workingCopyResource, name: workingCopyName },
          location: entryStat.resource,
          timestamp: entryStat.mtime,
          source: _WorkingCopyHistoryModel.FILE_SAVED_SOURCE,
          sourceDescription: void 0
        });
      }
    }
    if (entryListing) {
      for (const entry of entryListing.entries) {
        const existingEntry = entries.get(entry.id);
        if (existingEntry) {
          entries.set(entry.id, {
            ...existingEntry,
            timestamp: entry.timestamp,
            source: entry.source ?? existingEntry.source,
            sourceDescription: entry.sourceDescription ?? existingEntry.sourceDescription
          });
        }
      }
    }
    return entries;
  }
  async moveEntries(target, source, token) {
    const timestamp = Date.now();
    const sourceDescription = this.labelService.getUriLabel(assertIsDefined(this.workingCopyResource));
    const sourceHistoryEntriesFolder = assertIsDefined(this.historyEntriesFolder);
    const targetHistoryEntriesFolder = assertIsDefined(target.historyEntriesFolder);
    try {
      for (const entry of this.entries) {
        await this.fileService.move(entry.location, joinPath(targetHistoryEntriesFolder, entry.id), true);
      }
      await this.fileService.del(sourceHistoryEntriesFolder, { recursive: true });
    } catch (error) {
      if (!this.isFileNotFound(error)) {
        try {
          await this.fileService.move(sourceHistoryEntriesFolder, targetHistoryEntriesFolder, true);
        } catch (error2) {
          if (!this.isFileNotFound(error2)) {
            this.traceError(error2);
          }
        }
      }
    }
    const allEntries = distinct([...this.entries, ...target.entries], (entry) => entry.id).sort((entryA, entryB) => entryA.timestamp - entryB.timestamp);
    const targetWorkingCopyResource = assertIsDefined(target.workingCopyResource);
    this.setWorkingCopy(targetWorkingCopyResource);
    const targetWorkingCopyName = assertIsDefined(target.workingCopyName);
    for (const entry of allEntries) {
      this.entries.push({
        id: entry.id,
        location: joinPath(targetHistoryEntriesFolder, entry.id),
        source: entry.source,
        sourceDescription: entry.sourceDescription,
        timestamp: entry.timestamp,
        workingCopy: {
          resource: targetWorkingCopyResource,
          name: targetWorkingCopyName
        }
      });
    }
    await this.addEntry(source, sourceDescription, timestamp, token);
    await this.store(token);
  }
  async store(token) {
    if (!this.shouldStore()) {
      return;
    }
    await this.storeLimiter.queue(async () => {
      if (token.isCancellationRequested || !this.shouldStore()) {
        return;
      }
      return this.doStore(token);
    });
  }
  shouldStore() {
    return this.storedVersionId !== this.versionId;
  }
  async doStore(token) {
    const historyEntriesFolder = assertIsDefined(this.historyEntriesFolder);
    await this.resolveEntriesOnce();
    if (token.isCancellationRequested) {
      return void 0;
    }
    await this.cleanUpEntries();
    const storedVersion = this.versionId;
    if (this.entries.length === 0) {
      try {
        await this.fileService.del(historyEntriesFolder, { recursive: true });
      } catch (error) {
        this.traceError(error);
      }
    } else {
      await this.writeEntriesFile();
    }
    this.storedVersionId = storedVersion;
  }
  async cleanUpEntries() {
    const configuredMaxEntries = this.configurationService.getValue(_WorkingCopyHistoryModel.SETTINGS.MAX_ENTRIES, { resource: this.workingCopyResource });
    if (this.entries.length <= configuredMaxEntries) {
      return;
    }
    const entriesToDelete = this.entries.slice(0, this.entries.length - configuredMaxEntries);
    const entriesToKeep = this.entries.slice(this.entries.length - configuredMaxEntries);
    for (const entryToDelete of entriesToDelete) {
      await this.deleteEntry(entryToDelete);
    }
    this.entries = entriesToKeep;
    for (const entry of entriesToDelete) {
      this.entryRemovedEmitter.fire({ entry });
    }
  }
  async deleteEntry(entry) {
    try {
      await this.fileService.del(entry.location);
    } catch (error) {
      this.traceError(error);
    }
  }
  async writeEntriesFile() {
    const workingCopyResource = assertIsDefined(this.workingCopyResource);
    const historyEntriesListingFile = assertIsDefined(this.historyEntriesListingFile);
    const serializedModel = {
      version: 1,
      resource: workingCopyResource.toString(),
      entries: this.entries.map((entry) => {
        return {
          id: entry.id,
          source: entry.source !== _WorkingCopyHistoryModel.FILE_SAVED_SOURCE ? entry.source : void 0,
          sourceDescription: entry.sourceDescription,
          timestamp: entry.timestamp
        };
      })
    };
    await this.fileService.writeFile(historyEntriesListingFile, VSBuffer.fromString(JSON.stringify(serializedModel)));
  }
  async readEntriesFile() {
    const historyEntriesListingFile = assertIsDefined(this.historyEntriesListingFile);
    let serializedModel = void 0;
    try {
      serializedModel = JSON.parse((await this.fileService.readFile(historyEntriesListingFile)).value.toString());
    } catch (error) {
      if (!this.isFileNotFound(error)) {
        this.traceError(error);
      }
    }
    return serializedModel;
  }
  async readEntriesFolder() {
    const historyEntriesFolder = assertIsDefined(this.historyEntriesFolder);
    const historyEntriesNameMatcher = assertIsDefined(this.historyEntriesNameMatcher);
    let rawEntries = void 0;
    try {
      rawEntries = (await this.fileService.resolve(historyEntriesFolder, { resolveMetadata: true })).children;
    } catch (error) {
      if (!this.isFileNotFound(error)) {
        this.traceError(error);
      }
    }
    if (!rawEntries) {
      return void 0;
    }
    return rawEntries.filter(
      (entry) => !isEqual(entry.resource, this.historyEntriesListingFile) && // not the listings file
      historyEntriesNameMatcher.test(entry.name)
      // matching our expected file pattern for entries
    );
  }
  isFileNotFound(error) {
    return error instanceof FileOperationError && error.fileOperationResult === FileOperationResult.FILE_NOT_FOUND;
  }
  traceError(error) {
    this.logService.trace("[Working Copy History Service]", error);
  }
};
_WorkingCopyHistoryModel.ENTRIES_FILE = "entries.json";
_WorkingCopyHistoryModel.FILE_SAVED_SOURCE = SaveSourceRegistry.registerSource("default.source", localize("default.source", "File Saved"));
_WorkingCopyHistoryModel.SETTINGS = {
  MAX_ENTRIES: "workbench.localHistory.maxFileEntries",
  MERGE_PERIOD: "workbench.localHistory.mergeWindow"
};
let WorkingCopyHistoryModel = _WorkingCopyHistoryModel;
let WorkingCopyHistoryService = class extends Disposable {
  constructor(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, logService, configurationService) {
    super();
    this.fileService = fileService;
    this.remoteAgentService = remoteAgentService;
    this.environmentService = environmentService;
    this.uriIdentityService = uriIdentityService;
    this.labelService = labelService;
    this.logService = logService;
    this.configurationService = configurationService;
    this._onDidAddEntry = this._register(new Emitter());
    this.onDidAddEntry = this._onDidAddEntry.event;
    this._onDidChangeEntry = this._register(new Emitter());
    this.onDidChangeEntry = this._onDidChangeEntry.event;
    this._onDidReplaceEntry = this._register(new Emitter());
    this.onDidReplaceEntry = this._onDidReplaceEntry.event;
    this._onDidMoveEntries = this._register(new Emitter());
    this.onDidMoveEntries = this._onDidMoveEntries.event;
    this._onDidRemoveEntry = this._register(new Emitter());
    this.onDidRemoveEntry = this._onDidRemoveEntry.event;
    this._onDidRemoveEntries = this._register(new Emitter());
    this.onDidRemoveEntries = this._onDidRemoveEntries.event;
    this.localHistoryHome = new DeferredPromise();
    this.models = new ResourceMap((resource) => this.uriIdentityService.extUri.getComparisonKey(resource));
    this.resolveLocalHistoryHome();
  }
  async resolveLocalHistoryHome() {
    let historyHome = void 0;
    try {
      const remoteEnv = await this.remoteAgentService.getEnvironment();
      if (remoteEnv) {
        historyHome = remoteEnv.localHistoryHome;
      }
    } catch (error) {
      this.logService.trace(error);
    }
    if (!historyHome) {
      historyHome = this.environmentService.localHistoryHome;
    }
    this.localHistoryHome.complete(historyHome);
  }
  async moveEntries(source, target) {
    const limiter = new Limiter(MAX_PARALLEL_HISTORY_IO_OPS);
    const promises = [];
    for (const [resource, model] of this.models) {
      if (!this.uriIdentityService.extUri.isEqualOrParent(resource, source)) {
        continue;
      }
      let targetResource;
      if (this.uriIdentityService.extUri.isEqual(source, resource)) {
        targetResource = target;
      } else {
        const index = indexOfPath(resource.path, source.path);
        targetResource = joinPath(target, resource.path.substr(index + source.path.length + 1));
      }
      let saveSource;
      if (this.uriIdentityService.extUri.isEqual(dirname(resource), dirname(targetResource))) {
        saveSource = WorkingCopyHistoryService.FILE_RENAMED_SOURCE;
      } else {
        saveSource = WorkingCopyHistoryService.FILE_MOVED_SOURCE;
      }
      promises.push(limiter.queue(() => this.doMoveEntries(model, saveSource, resource, targetResource)));
    }
    if (!promises.length) {
      return [];
    }
    const resources = await Promise.all(promises);
    this._onDidMoveEntries.fire();
    return resources;
  }
  async doMoveEntries(source, saveSource, sourceWorkingCopyResource, targetWorkingCopyResource) {
    const target = await this.getModel(targetWorkingCopyResource);
    await source.moveEntries(target, saveSource, CancellationToken.None);
    this.models.delete(sourceWorkingCopyResource);
    this.models.set(targetWorkingCopyResource, source);
    return targetWorkingCopyResource;
  }
  async addEntry({ resource, source, timestamp }, token) {
    if (!this.fileService.hasProvider(resource)) {
      return void 0;
    }
    const model = await this.getModel(resource);
    if (token.isCancellationRequested) {
      return void 0;
    }
    return model.addEntry(source, void 0, timestamp, token);
  }
  async updateEntry(entry, properties, token) {
    const model = await this.getModel(entry.workingCopy.resource);
    if (token.isCancellationRequested) {
      return;
    }
    return model.updateEntry(entry, properties, token);
  }
  async removeEntry(entry, token) {
    const model = await this.getModel(entry.workingCopy.resource);
    if (token.isCancellationRequested) {
      return false;
    }
    return model.removeEntry(entry, token);
  }
  async removeAll(token) {
    const historyHome = await this.localHistoryHome.p;
    if (token.isCancellationRequested) {
      return;
    }
    this.models.clear();
    await this.fileService.del(historyHome, { recursive: true });
    this._onDidRemoveEntries.fire();
  }
  async getEntries(resource, token) {
    const model = await this.getModel(resource);
    if (token.isCancellationRequested) {
      return [];
    }
    const entries = await model.getEntries();
    return entries ?? [];
  }
  async getAll(token) {
    const historyHome = await this.localHistoryHome.p;
    if (token.isCancellationRequested) {
      return [];
    }
    const all = new ResourceMap();
    for (const [resource, model] of this.models) {
      const hasInMemoryEntries = await model.hasEntries(
        true
        /* skip resolving because we resolve below from disk */
      );
      if (hasInMemoryEntries) {
        all.set(resource, true);
      }
    }
    try {
      const resolvedHistoryHome = await this.fileService.resolve(historyHome);
      if (resolvedHistoryHome.children) {
        const limiter = new Limiter(MAX_PARALLEL_HISTORY_IO_OPS);
        const promises = [];
        for (const child of resolvedHistoryHome.children) {
          promises.push(limiter.queue(async () => {
            if (token.isCancellationRequested) {
              return;
            }
            try {
              const serializedModel = JSON.parse((await this.fileService.readFile(joinPath(child.resource, WorkingCopyHistoryModel.ENTRIES_FILE))).value.toString());
              if (serializedModel.entries.length > 0) {
                all.set(URI.parse(serializedModel.resource), true);
              }
            } catch (error) {
            }
          }));
        }
        await Promise.all(promises);
      }
    } catch (error) {
    }
    return Array.from(all.keys());
  }
  async getModel(resource) {
    const historyHome = await this.localHistoryHome.p;
    let model = this.models.get(resource);
    if (!model) {
      model = new WorkingCopyHistoryModel(resource, historyHome, this._onDidAddEntry, this._onDidChangeEntry, this._onDidReplaceEntry, this._onDidRemoveEntry, this.getModelOptions(), this.fileService, this.labelService, this.logService, this.configurationService);
      this.models.set(resource, model);
    }
    return model;
  }
};
WorkingCopyHistoryService.FILE_MOVED_SOURCE = SaveSourceRegistry.registerSource("moved.source", localize("moved.source", "File Moved"));
WorkingCopyHistoryService.FILE_RENAMED_SOURCE = SaveSourceRegistry.registerSource("renamed.source", localize("renamed.source", "File Renamed"));
WorkingCopyHistoryService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IConfigurationService)
], WorkingCopyHistoryService);
let NativeWorkingCopyHistoryService = class extends WorkingCopyHistoryService {
  constructor(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, lifecycleService, logService, configurationService) {
    super(fileService, remoteAgentService, environmentService, uriIdentityService, labelService, logService, configurationService);
    this.lifecycleService = lifecycleService;
    // 5min
    this.isRemotelyStored = typeof this.environmentService.remoteAuthority === "string";
    this.storeAllCts = this._register(new CancellationTokenSource());
    this.storeAllScheduler = this._register(new RunOnceScheduler(() => this.storeAll(this.storeAllCts.token), NativeWorkingCopyHistoryService.STORE_ALL_INTERVAL));
    this.registerListeners();
  }
  registerListeners() {
    if (!this.isRemotelyStored) {
      this._register(this.lifecycleService.onWillShutdown((e) => this.onWillShutdown(e)));
      this._register(Event.any(this.onDidAddEntry, this.onDidChangeEntry, this.onDidReplaceEntry, this.onDidRemoveEntry)(() => this.onDidChangeModels()));
    }
  }
  getModelOptions() {
    return {
      flushOnChange: this.isRemotelyStored
      /* because the connection might drop anytime */
    };
  }
  onWillShutdown(e) {
    this.storeAllScheduler.dispose();
    this.storeAllCts.dispose(true);
    e.join(this.storeAll(e.token), { id: "join.workingCopyHistory", label: localize("join.workingCopyHistory", "Saving local history") });
  }
  onDidChangeModels() {
    if (!this.storeAllScheduler.isScheduled()) {
      this.storeAllScheduler.schedule();
    }
  }
  async storeAll(token) {
    const limiter = new Limiter(MAX_PARALLEL_HISTORY_IO_OPS);
    const promises = [];
    const models = Array.from(this.models.values());
    for (const model of models) {
      promises.push(limiter.queue(async () => {
        if (token.isCancellationRequested) {
          return;
        }
        try {
          await model.store(token);
        } catch (error) {
          this.logService.trace(error);
        }
      }));
    }
    await Promise.all(promises);
  }
};
NativeWorkingCopyHistoryService.STORE_ALL_INTERVAL = 5 * 60 * 1e3;
NativeWorkingCopyHistoryService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILifecycleService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService)
], NativeWorkingCopyHistoryService);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkingCopyHistoryTracker, LifecyclePhase.Restored);
export {
  NativeWorkingCopyHistoryService,
  WorkingCopyHistoryModel,
  WorkingCopyHistoryService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSwgV2lsbFNodXRkb3duRXZlbnQgfSBmcm9tICcuLi8uLi9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBXb3JraW5nQ29weUhpc3RvcnlUcmFja2VyIH0gZnJvbSAnLi93b3JraW5nQ29weUhpc3RvcnlUcmFja2VyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnlEZXNjcmlwdG9yLCBJV29ya2luZ0NvcHlIaXN0b3J5RXZlbnQsIElXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLCBNQVhfUEFSQUxMRUxfSElTVE9SWV9JT19PUFMgfSBmcm9tICcuL3dvcmtpbmdDb3B5SGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uRXJyb3IsIEZpbGVPcGVyYXRpb25SZXN1bHQsIElGaWxlU2VydmljZSwgSUZpbGVTdGF0V2l0aE1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCBMaW1pdGVyLCBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZGlybmFtZSwgZXh0bmFtZSwgaXNFcXVhbCwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgaW5kZXhPZlBhdGgsIHJhbmRvbVBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBTYXZlU291cmNlLCBTYXZlU291cmNlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuXG5pbnRlcmZhY2UgSVNlcmlhbGl6ZWRXb3JraW5nQ29weUhpc3RvcnlNb2RlbCB7XG5cdHJlYWRvbmx5IHZlcnNpb246IG51bWJlcjtcblx0cmVhZG9ubHkgcmVzb3VyY2U6IHN0cmluZztcblx0cmVhZG9ubHkgZW50cmllczogSVNlcmlhbGl6ZWRXb3JraW5nQ29weUhpc3RvcnlNb2RlbEVudHJ5W107XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsRW50cnkge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSB0aW1lc3RhbXA6IG51bWJlcjtcblx0cmVhZG9ubHkgc291cmNlPzogU2F2ZVNvdXJjZTtcblx0cmVhZG9ubHkgc291cmNlRGVzY3JpcHRpb24/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdG8gZmx1c2ggd2hlbiB0aGUgbW9kZWwgY2hhbmdlcy4gSWYgbm90XG5cdCAqIGNvbmZpZ3VyZWQsIGBtb2RlbC5zdG9yZSgpYCBoYXMgdG8gYmUgY2FsbGVkXG5cdCAqIGV4cGxpY2l0bHkuXG5cdCAqL1xuXHRmbHVzaE9uQ2hhbmdlOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwge1xuXG5cdHN0YXRpYyByZWFkb25seSBFTlRSSUVTX0ZJTEUgPSAnZW50cmllcy5qc29uJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBGSUxFX1NBVkVEX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgnZGVmYXVsdC5zb3VyY2UnLCBsb2NhbGl6ZSgnZGVmYXVsdC5zb3VyY2UnLCBcIkZpbGUgU2F2ZWRcIikpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNFVFRJTkdTID0ge1xuXHRcdE1BWF9FTlRSSUVTOiAnd29ya2JlbmNoLmxvY2FsSGlzdG9yeS5tYXhGaWxlRW50cmllcycsXG5cdFx0TUVSR0VfUEVSSU9EOiAnd29ya2JlbmNoLmxvY2FsSGlzdG9yeS5tZXJnZVdpbmRvdydcblx0fTtcblxuXHRwcml2YXRlIGVudHJpZXM6IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeVtdID0gW107XG5cblx0cHJpdmF0ZSB3aGVuUmVzb2x2ZWQ6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSB3b3JraW5nQ29weVJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgd29ya2luZ0NvcHlOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBoaXN0b3J5RW50cmllc0ZvbGRlcjogVVJJIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGhpc3RvcnlFbnRyaWVzTGlzdGluZ0ZpbGU6IFVSSSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGhpc3RvcnlFbnRyaWVzTmFtZU1hdGNoZXI6IFJlZ0V4cCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHZlcnNpb25JZCA9IDA7XG5cdHByaXZhdGUgc3RvcmVkVmVyc2lvbklkID0gdGhpcy52ZXJzaW9uSWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdG9yZUxpbWl0ZXIgPSBuZXcgTGltaXRlcigxKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR3b3JraW5nQ29weVJlc291cmNlOiBVUkksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBoaXN0b3J5SG9tZTogVVJJLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZW50cnlBZGRlZEVtaXR0ZXI6IEVtaXR0ZXI8SVdvcmtpbmdDb3B5SGlzdG9yeUV2ZW50Pixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVudHJ5Q2hhbmdlZEVtaXR0ZXI6IEVtaXR0ZXI8SVdvcmtpbmdDb3B5SGlzdG9yeUV2ZW50Pixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVudHJ5UmVwbGFjZWRFbWl0dGVyOiBFbWl0dGVyPElXb3JraW5nQ29weUhpc3RvcnlFdmVudD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlbnRyeVJlbW92ZWRFbWl0dGVyOiBFbWl0dGVyPElXb3JraW5nQ29weUhpc3RvcnlFdmVudD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvcHRpb25zOiBJV29ya2luZ0NvcHlIaXN0b3J5TW9kZWxPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLnNldFdvcmtpbmdDb3B5KHdvcmtpbmdDb3B5UmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRXb3JraW5nQ29weSh3b3JraW5nQ29weVJlc291cmNlOiBVUkkpOiB2b2lkIHtcblxuXHRcdC8vIFVwZGF0ZSB3b3JraW5nIGNvcHlcblx0XHR0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UgPSB3b3JraW5nQ29weVJlc291cmNlO1xuXHRcdHRoaXMud29ya2luZ0NvcHlOYW1lID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh3b3JraW5nQ29weVJlc291cmNlKTtcblxuXHRcdHRoaXMuaGlzdG9yeUVudHJpZXNOYW1lTWF0Y2hlciA9IG5ldyBSZWdFeHAoYFtBLVphLXowLTldezR9JHtlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzKGV4dG5hbWUod29ya2luZ0NvcHlSZXNvdXJjZSkpfWApO1xuXG5cdFx0Ly8gVXBkYXRlIGxvY2F0aW9uc1xuXHRcdHRoaXMuaGlzdG9yeUVudHJpZXNGb2xkZXIgPSB0aGlzLnRvSGlzdG9yeUVudHJpZXNGb2xkZXIodGhpcy5oaXN0b3J5SG9tZSwgd29ya2luZ0NvcHlSZXNvdXJjZSk7XG5cdFx0dGhpcy5oaXN0b3J5RW50cmllc0xpc3RpbmdGaWxlID0gam9pblBhdGgodGhpcy5oaXN0b3J5RW50cmllc0ZvbGRlciwgV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwuRU5UUklFU19GSUxFKTtcblxuXHRcdC8vIFJlc2V0IGVudHJpZXMgYW5kIHJlc29sdmVkIGNhY2hlXG5cdFx0dGhpcy5lbnRyaWVzID0gW107XG5cdFx0dGhpcy53aGVuUmVzb2x2ZWQgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHRvSGlzdG9yeUVudHJpZXNGb2xkZXIoaGlzdG9yeUhvbWU6IFVSSSwgd29ya2luZ0NvcHlSZXNvdXJjZTogVVJJKTogVVJJIHtcblx0XHRyZXR1cm4gam9pblBhdGgoaGlzdG9yeUhvbWUsIGhhc2god29ya2luZ0NvcHlSZXNvdXJjZS50b1N0cmluZygpKS50b1N0cmluZygxNikpO1xuXHR9XG5cblx0YXN5bmMgYWRkRW50cnkoc291cmNlID0gV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwuRklMRV9TQVZFRF9TT1VSQ0UsIHNvdXJjZURlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsIHRpbWVzdGFtcCA9IERhdGUubm93KCksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5PiB7XG5cdFx0bGV0IGVudHJ5VG9SZXBsYWNlOiBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBGaWd1cmUgb3V0IGlmIHRoZSBsYXN0IGVudHJ5IHNob3VsZCBiZSByZXBsYWNlZCBiYXNlZFxuXHRcdC8vIG9uIHNldHRpbmdzIHRoYXQgY2FuIGRlZmluZSBhIGludGVydmFsIGZvciB3aGVuIGFuXG5cdFx0Ly8gZW50cnkgaXMgbm90IGFkZGVkIGFzIG5ldyBlbnRyeSBidXQgc2hvdWxkIHJlcGxhY2UuXG5cdFx0Ly8gSG93ZXZlciwgd2hlbiBzYXZlIHNvdXJjZSBpcyBkaWZmZXJlbnQsIG5ldmVyIHJlcGxhY2UuXG5cdFx0Y29uc3QgbGFzdEVudHJ5ID0gdGhpcy5lbnRyaWVzLmF0KC0xKTtcblx0XHRpZiAobGFzdEVudHJ5ICYmIGxhc3RFbnRyeS5zb3VyY2UgPT09IHNvdXJjZSkge1xuXHRcdFx0Y29uc3QgY29uZmlndXJlZFJlcGxhY2VJbnRlcnZhbCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihXb3JraW5nQ29weUhpc3RvcnlNb2RlbC5TRVRUSU5HUy5NRVJHRV9QRVJJT0QsIHsgcmVzb3VyY2U6IHRoaXMud29ya2luZ0NvcHlSZXNvdXJjZSB9KTtcblx0XHRcdGlmICh0aW1lc3RhbXAgLSBsYXN0RW50cnkudGltZXN0YW1wIDw9IChjb25maWd1cmVkUmVwbGFjZUludGVydmFsICogMTAwMCAvKiBjb252ZXJ0IHRvIG1pbGxpZXMgKi8pKSB7XG5cdFx0XHRcdGVudHJ5VG9SZXBsYWNlID0gbGFzdEVudHJ5O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGxldCBlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5O1xuXG5cdFx0Ly8gUmVwbGFjZSBsYXN0ZXN0IGVudHJ5IGluIGhpc3Rvcnlcblx0XHRpZiAoZW50cnlUb1JlcGxhY2UpIHtcblx0XHRcdGVudHJ5ID0gYXdhaXQgdGhpcy5kb1JlcGxhY2VFbnRyeShlbnRyeVRvUmVwbGFjZSwgc291cmNlLCBzb3VyY2VEZXNjcmlwdGlvbiwgdGltZXN0YW1wLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIGVudHJ5IHRvIGhpc3Rvcnlcblx0XHRlbHNlIHtcblx0XHRcdGVudHJ5ID0gYXdhaXQgdGhpcy5kb0FkZEVudHJ5KHNvdXJjZSwgc291cmNlRGVzY3JpcHRpb24sIHRpbWVzdGFtcCwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdC8vIEZsdXNoIG5vdyBpZiBjb25maWd1cmVkXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5mbHVzaE9uQ2hhbmdlICYmICF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5zdG9yZSh0b2tlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVudHJ5O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0FkZEVudHJ5KHNvdXJjZTogU2F2ZVNvdXJjZSwgc291cmNlRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCwgdGltZXN0YW1wOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5PiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlSZXNvdXJjZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UpO1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5TmFtZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLndvcmtpbmdDb3B5TmFtZSk7XG5cdFx0Y29uc3QgaGlzdG9yeUVudHJpZXNGb2xkZXIgPSBhc3NlcnRJc0RlZmluZWQodGhpcy5oaXN0b3J5RW50cmllc0ZvbGRlcik7XG5cblx0XHQvLyBQZXJmb3JtIGEgZmFzdCBjbG9uZSBvcGVyYXRpb24gd2l0aCBtaW5pbWFsIG92ZXJoZWFkIHRvIGEgbmV3IHJhbmRvbSBsb2NhdGlvblxuXHRcdGNvbnN0IGlkID0gYCR7cmFuZG9tUGF0aCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgNCl9JHtleHRuYW1lKHdvcmtpbmdDb3B5UmVzb3VyY2UpfWA7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSBqb2luUGF0aChoaXN0b3J5RW50cmllc0ZvbGRlciwgaWQpO1xuXHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuY2xvbmVGaWxlKHdvcmtpbmdDb3B5UmVzb3VyY2UsIGxvY2F0aW9uKTtcblxuXHRcdC8vIEFkZCB0byBsaXN0IG9mIGVudHJpZXNcblx0XHRjb25zdCBlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5ID0ge1xuXHRcdFx0aWQsXG5cdFx0XHR3b3JraW5nQ29weTogeyByZXNvdXJjZTogd29ya2luZ0NvcHlSZXNvdXJjZSwgbmFtZTogd29ya2luZ0NvcHlOYW1lIH0sXG5cdFx0XHRsb2NhdGlvbixcblx0XHRcdHRpbWVzdGFtcCxcblx0XHRcdHNvdXJjZSxcblx0XHRcdHNvdXJjZURlc2NyaXB0aW9uXG5cdFx0fTtcblx0XHR0aGlzLmVudHJpZXMucHVzaChlbnRyeSk7XG5cblx0XHQvLyBVcGRhdGUgdmVyc2lvbiBJRCBvZiBtb2RlbCB0byB1c2UgZm9yIHN0b3JpbmcgbGF0ZXJcblx0XHR0aGlzLnZlcnNpb25JZCsrO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0dGhpcy5lbnRyeUFkZGVkRW1pdHRlci5maXJlKHsgZW50cnkgfSk7XG5cblx0XHRyZXR1cm4gZW50cnk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVwbGFjZUVudHJ5KGVudHJ5OiBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnksIHNvdXJjZTogU2F2ZVNvdXJjZSwgc291cmNlRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZCwgdGltZXN0YW1wOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5PiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlSZXNvdXJjZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UpO1xuXG5cdFx0Ly8gUGVyZm9ybSBhIGZhc3QgY2xvbmUgb3BlcmF0aW9uIHdpdGggbWluaW1hbCBvdmVyaGVhZCB0byB0aGUgZXhpc3RpbmcgbG9jYXRpb25cblx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmNsb25lRmlsZSh3b3JraW5nQ29weVJlc291cmNlLCBlbnRyeS5sb2NhdGlvbik7XG5cblx0XHQvLyBVcGRhdGUgZW50cnlcblx0XHRlbnRyeS5zb3VyY2UgPSBzb3VyY2U7XG5cdFx0ZW50cnkuc291cmNlRGVzY3JpcHRpb24gPSBzb3VyY2VEZXNjcmlwdGlvbjtcblx0XHRlbnRyeS50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG5cblx0XHQvLyBVcGRhdGUgdmVyc2lvbiBJRCBvZiBtb2RlbCB0byB1c2UgZm9yIHN0b3JpbmcgbGF0ZXJcblx0XHR0aGlzLnZlcnNpb25JZCsrO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0dGhpcy5lbnRyeVJlcGxhY2VkRW1pdHRlci5maXJlKHsgZW50cnkgfSk7XG5cblx0XHRyZXR1cm4gZW50cnk7XG5cdH1cblxuXHRhc3luYyByZW1vdmVFbnRyeShlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdC8vIE1ha2Ugc3VyZSB0byBhd2FpdCByZXNvbHZpbmcgd2hlbiByZW1vdmluZyBlbnRyaWVzXG5cdFx0YXdhaXQgdGhpcy5yZXNvbHZlRW50cmllc09uY2UoKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5lbnRyaWVzLmluZGV4T2YoZW50cnkpO1xuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBEZWxldGUgZnJvbSBkaXNrXG5cdFx0YXdhaXQgdGhpcy5kZWxldGVFbnRyeShlbnRyeSk7XG5cblx0XHQvLyBSZW1vdmUgZnJvbSBtb2RlbFxuXHRcdHRoaXMuZW50cmllcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG5cdFx0Ly8gVXBkYXRlIHZlcnNpb24gSUQgb2YgbW9kZWwgdG8gdXNlIGZvciBzdG9yaW5nIGxhdGVyXG5cdFx0dGhpcy52ZXJzaW9uSWQrKztcblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMuZW50cnlSZW1vdmVkRW1pdHRlci5maXJlKHsgZW50cnkgfSk7XG5cblx0XHQvLyBGbHVzaCBub3cgaWYgY29uZmlndXJlZFxuXHRcdGlmICh0aGlzLm9wdGlvbnMuZmx1c2hPbkNoYW5nZSAmJiAhdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdGF3YWl0IHRoaXMuc3RvcmUodG9rZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlRW50cnkoZW50cnk6IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeSwgcHJvcGVydGllczogeyBzb3VyY2U6IFNhdmVTb3VyY2UgfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gYXdhaXQgcmVzb2x2aW5nIHdoZW4gdXBkYXRpbmcgZW50cmllc1xuXHRcdGF3YWl0IHRoaXMucmVzb2x2ZUVudHJpZXNPbmNlKCk7XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZW50cmllcy5pbmRleE9mKGVudHJ5KTtcblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIGVudHJ5XG5cdFx0ZW50cnkuc291cmNlID0gcHJvcGVydGllcy5zb3VyY2U7XG5cblx0XHQvLyBVcGRhdGUgdmVyc2lvbiBJRCBvZiBtb2RlbCB0byB1c2UgZm9yIHN0b3JpbmcgbGF0ZXJcblx0XHR0aGlzLnZlcnNpb25JZCsrO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0dGhpcy5lbnRyeUNoYW5nZWRFbWl0dGVyLmZpcmUoeyBlbnRyeSB9KTtcblxuXHRcdC8vIEZsdXNoIG5vdyBpZiBjb25maWd1cmVkXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5mbHVzaE9uQ2hhbmdlICYmICF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5zdG9yZSh0b2tlbik7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0RW50cmllcygpOiBQcm9taXNlPHJlYWRvbmx5IElXb3JraW5nQ29weUhpc3RvcnlFbnRyeVtdPiB7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gYXdhaXQgcmVzb2x2aW5nIHdoZW4gYWxsIGVudHJpZXMgYXJlIGFza2VkIGZvclxuXHRcdGF3YWl0IHRoaXMucmVzb2x2ZUVudHJpZXNPbmNlKCk7XG5cblx0XHQvLyBSZXR1cm4gYXMgbWFueSBlbnRyaWVzIGFzIGNvbmZpZ3VyZWQgYnkgdXNlciBzZXR0aW5nc1xuXHRcdGNvbnN0IGNvbmZpZ3VyZWRNYXhFbnRyaWVzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsLlNFVFRJTkdTLk1BWF9FTlRSSUVTLCB7IHJlc291cmNlOiB0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UgfSk7XG5cdFx0aWYgKHRoaXMuZW50cmllcy5sZW5ndGggPiBjb25maWd1cmVkTWF4RW50cmllcykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZW50cmllcy5zbGljZSh0aGlzLmVudHJpZXMubGVuZ3RoIC0gY29uZmlndXJlZE1heEVudHJpZXMpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmVudHJpZXM7XG5cdH1cblxuXHRhc3luYyBoYXNFbnRyaWVzKHNraXBSZXNvbHZlOiBib29sZWFuKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBNYWtlIHN1cmUgdG8gYXdhaXQgcmVzb2x2aW5nIHVubGVzcyBleHBsaWNpdGx5IHNraXBwZWRcblx0XHRpZiAoIXNraXBSZXNvbHZlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlc29sdmVFbnRyaWVzT25jZSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmVudHJpZXMubGVuZ3RoID4gMDtcblx0fVxuXG5cdHByaXZhdGUgcmVzb2x2ZUVudHJpZXNPbmNlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy53aGVuUmVzb2x2ZWQpIHtcblx0XHRcdHRoaXMud2hlblJlc29sdmVkID0gdGhpcy5kb1Jlc29sdmVFbnRyaWVzKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMud2hlblJlc29sdmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmVFbnRyaWVzKCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gUmVzb2x2ZSBmcm9tIGRpc2tcblx0XHRjb25zdCBlbnRyaWVzID0gYXdhaXQgdGhpcy5yZXNvbHZlRW50cmllc0Zyb21EaXNrKCk7XG5cblx0XHQvLyBXZSBub3cgbmVlZCB0byBtZXJnZSBvdXIgaW4tbWVtb3J5IGVudHJpZXMgd2l0aCB0aGVcblx0XHQvLyBlbnRyaWVzIHdlIGhhdmUgZm91bmQgb24gZGlzayBiZWNhdXNlIGl0IGlzIHBvc3NpYmxlXG5cdFx0Ly8gdGhhdCBuZXcgZW50cmllcyBoYXZlIGJlZW4gYWRkZWQgYmVmb3JlIHRoZSBlbnRyaWVzXG5cdFx0Ly8gbGlzdGluZyBmaWxlIHdhcyB1cGRhdGVkXG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmVudHJpZXMpIHtcblx0XHRcdGVudHJpZXMuc2V0KGVudHJ5LmlkLCBlbnRyeSk7XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGFzIGVudHJpZXMsIHNvcnRlZCBieSB0aW1lc3RhbXBcblx0XHR0aGlzLmVudHJpZXMgPSBBcnJheS5mcm9tKGVudHJpZXMudmFsdWVzKCkpLnNvcnQoKGVudHJ5QSwgZW50cnlCKSA9PiBlbnRyeUEudGltZXN0YW1wIC0gZW50cnlCLnRpbWVzdGFtcCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmVFbnRyaWVzRnJvbURpc2soKTogUHJvbWlzZTxNYXA8c3RyaW5nIC8qIElEICovLCBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnk+PiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlSZXNvdXJjZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UpO1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5TmFtZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLndvcmtpbmdDb3B5TmFtZSk7XG5cblx0XHRjb25zdCBbZW50cnlMaXN0aW5nLCBlbnRyeVN0YXRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblxuXHRcdFx0Ly8gUmVzb2x2ZSBlbnRyaWVzIGxpc3RpbmcgZmlsZVxuXHRcdFx0dGhpcy5yZWFkRW50cmllc0ZpbGUoKSxcblxuXHRcdFx0Ly8gUmVzb2x2ZSBjaGlsZHJlbiBvZiBoaXN0b3J5IGZvbGRlclxuXHRcdFx0dGhpcy5yZWFkRW50cmllc0ZvbGRlcigpXG5cdFx0XSk7XG5cblx0XHQvLyBBZGQgZnJvbSByYXcgZm9sZGVyIGNoaWxkcmVuXG5cdFx0Y29uc3QgZW50cmllcyA9IG5ldyBNYXA8c3RyaW5nLCBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnk+KCk7XG5cdFx0aWYgKGVudHJ5U3RhdHMpIHtcblx0XHRcdGZvciAoY29uc3QgZW50cnlTdGF0IG9mIGVudHJ5U3RhdHMpIHtcblx0XHRcdFx0ZW50cmllcy5zZXQoZW50cnlTdGF0Lm5hbWUsIHtcblx0XHRcdFx0XHRpZDogZW50cnlTdGF0Lm5hbWUsXG5cdFx0XHRcdFx0d29ya2luZ0NvcHk6IHsgcmVzb3VyY2U6IHdvcmtpbmdDb3B5UmVzb3VyY2UsIG5hbWU6IHdvcmtpbmdDb3B5TmFtZSB9LFxuXHRcdFx0XHRcdGxvY2F0aW9uOiBlbnRyeVN0YXQucmVzb3VyY2UsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiBlbnRyeVN0YXQubXRpbWUsXG5cdFx0XHRcdFx0c291cmNlOiBXb3JraW5nQ29weUhpc3RvcnlNb2RlbC5GSUxFX1NBVkVEX1NPVVJDRSxcblx0XHRcdFx0XHRzb3VyY2VEZXNjcmlwdGlvbjogdW5kZWZpbmVkXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBmcm9tIGxpc3RpbmcgKHRvIGhhdmUgbW9yZSBzcGVjaWZpYyBtZXRhZGF0YSlcblx0XHRpZiAoZW50cnlMaXN0aW5nKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJ5TGlzdGluZy5lbnRyaWVzKSB7XG5cdFx0XHRcdGNvbnN0IGV4aXN0aW5nRW50cnkgPSBlbnRyaWVzLmdldChlbnRyeS5pZCk7XG5cdFx0XHRcdGlmIChleGlzdGluZ0VudHJ5KSB7XG5cdFx0XHRcdFx0ZW50cmllcy5zZXQoZW50cnkuaWQsIHtcblx0XHRcdFx0XHRcdC4uLmV4aXN0aW5nRW50cnksXG5cdFx0XHRcdFx0XHR0aW1lc3RhbXA6IGVudHJ5LnRpbWVzdGFtcCxcblx0XHRcdFx0XHRcdHNvdXJjZTogZW50cnkuc291cmNlID8/IGV4aXN0aW5nRW50cnkuc291cmNlLFxuXHRcdFx0XHRcdFx0c291cmNlRGVzY3JpcHRpb246IGVudHJ5LnNvdXJjZURlc2NyaXB0aW9uID8/IGV4aXN0aW5nRW50cnkuc291cmNlRGVzY3JpcHRpb25cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBlbnRyaWVzO1xuXHR9XG5cblx0YXN5bmMgbW92ZUVudHJpZXModGFyZ2V0OiBXb3JraW5nQ29weUhpc3RvcnlNb2RlbCwgc291cmNlOiBTYXZlU291cmNlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IHNvdXJjZURlc2NyaXB0aW9uID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoYXNzZXJ0SXNEZWZpbmVkKHRoaXMud29ya2luZ0NvcHlSZXNvdXJjZSkpO1xuXG5cdFx0Ly8gTW92ZSBhbGwgZW50cmllcyBpbnRvIHRoZSB0YXJnZXQgZm9sZGVyIHNvIHRoYXQgd2UgcHJlc2VydmVcblx0XHQvLyBhbnkgZXhpc3RpbmcgaGlzdG9yeSBlbnRyaWVzIHRoYXQgbWlnaHQgYWxyZWFkeSBiZSBwcmVzZW50XG5cblx0XHRjb25zdCBzb3VyY2VIaXN0b3J5RW50cmllc0ZvbGRlciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmhpc3RvcnlFbnRyaWVzRm9sZGVyKTtcblx0XHRjb25zdCB0YXJnZXRIaXN0b3J5RW50cmllc0ZvbGRlciA9IGFzc2VydElzRGVmaW5lZCh0YXJnZXQuaGlzdG9yeUVudHJpZXNGb2xkZXIpO1xuXHRcdHRyeSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMuZW50cmllcykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLm1vdmUoZW50cnkubG9jYXRpb24sIGpvaW5QYXRoKHRhcmdldEhpc3RvcnlFbnRyaWVzRm9sZGVyLCBlbnRyeS5pZCksIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwoc291cmNlSGlzdG9yeUVudHJpZXNGb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoIXRoaXMuaXNGaWxlTm90Rm91bmQoZXJyb3IpKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Ly8gSW4gY2FzZSBvZiBhbiBlcnJvciAodW5sZXNzIG5vdCBmb3VuZCksIGZhbGxiYWNrIHRvIG1vdmluZyB0aGUgZW50aXJlIGZvbGRlclxuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UubW92ZShzb3VyY2VIaXN0b3J5RW50cmllc0ZvbGRlciwgdGFyZ2V0SGlzdG9yeUVudHJpZXNGb2xkZXIsIHRydWUpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGlmICghdGhpcy5pc0ZpbGVOb3RGb3VuZChlcnJvcikpIHtcblx0XHRcdFx0XHRcdHRoaXMudHJhY2VFcnJvcihlcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gTWVyZ2Ugb3VyIGVudHJpZXMgd2l0aCB0YXJnZXQgZW50cmllcyBiZWZvcmUgdXBkYXRpbmcgYXNzb2NpYXRlZCB3b3JraW5nIGNvcHlcblx0XHRjb25zdCBhbGxFbnRyaWVzID0gZGlzdGluY3QoWy4uLnRoaXMuZW50cmllcywgLi4udGFyZ2V0LmVudHJpZXNdLCBlbnRyeSA9PiBlbnRyeS5pZCkuc29ydCgoZW50cnlBLCBlbnRyeUIpID0+IGVudHJ5QS50aW1lc3RhbXAgLSBlbnRyeUIudGltZXN0YW1wKTtcblxuXHRcdC8vIFVwZGF0ZSBvdXIgYXNzb2NpYXRlZCB3b3JraW5nIGNvcHlcblx0XHRjb25zdCB0YXJnZXRXb3JraW5nQ29weVJlc291cmNlID0gYXNzZXJ0SXNEZWZpbmVkKHRhcmdldC53b3JraW5nQ29weVJlc291cmNlKTtcblx0XHR0aGlzLnNldFdvcmtpbmdDb3B5KHRhcmdldFdvcmtpbmdDb3B5UmVzb3VyY2UpO1xuXG5cdFx0Ly8gUmVzdG9yZSBvdXIgZW50cmllcyBhbmQgZW5zdXJlIGNvcnJlY3QgbWV0YWRhdGFcblx0XHRjb25zdCB0YXJnZXRXb3JraW5nQ29weU5hbWUgPSBhc3NlcnRJc0RlZmluZWQodGFyZ2V0LndvcmtpbmdDb3B5TmFtZSk7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBhbGxFbnRyaWVzKSB7XG5cdFx0XHR0aGlzLmVudHJpZXMucHVzaCh7XG5cdFx0XHRcdGlkOiBlbnRyeS5pZCxcblx0XHRcdFx0bG9jYXRpb246IGpvaW5QYXRoKHRhcmdldEhpc3RvcnlFbnRyaWVzRm9sZGVyLCBlbnRyeS5pZCksXG5cdFx0XHRcdHNvdXJjZTogZW50cnkuc291cmNlLFxuXHRcdFx0XHRzb3VyY2VEZXNjcmlwdGlvbjogZW50cnkuc291cmNlRGVzY3JpcHRpb24sXG5cdFx0XHRcdHRpbWVzdGFtcDogZW50cnkudGltZXN0YW1wLFxuXHRcdFx0XHR3b3JraW5nQ29weToge1xuXHRcdFx0XHRcdHJlc291cmNlOiB0YXJnZXRXb3JraW5nQ29weVJlc291cmNlLFxuXHRcdFx0XHRcdG5hbWU6IHRhcmdldFdvcmtpbmdDb3B5TmFtZVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHQvLyBBZGQgZW50cnkgZm9yIHRoZSBtb3ZlXG5cdFx0YXdhaXQgdGhpcy5hZGRFbnRyeShzb3VyY2UsIHNvdXJjZURlc2NyaXB0aW9uLCB0aW1lc3RhbXAsIHRva2VuKTtcblxuXHRcdC8vIFN0b3JlIG1vZGVsIGFnYWluIHRvIHVwZGF0ZWQgbG9jYXRpb25cblx0XHRhd2FpdCB0aGlzLnN0b3JlKHRva2VuKTtcblx0fVxuXG5cdGFzeW5jIHN0b3JlKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5zaG91bGRTdG9yZSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXNlIGEgYExpbWl0ZXJgIHRvIHByZXZlbnQgbXVsdGlwbGUgYHN0b3JlYCBvcGVyYXRpb25zXG5cdFx0Ly8gcG90ZW50aWFsbHkgcnVubmluZyBhdCB0aGUgc2FtZSB0aW1lXG5cblx0XHRhd2FpdCB0aGlzLnN0b3JlTGltaXRlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgIXRoaXMuc2hvdWxkU3RvcmUoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLmRvU3RvcmUodG9rZW4pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRTdG9yZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yZWRWZXJzaW9uSWQgIT09IHRoaXMudmVyc2lvbklkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1N0b3JlKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpc3RvcnlFbnRyaWVzRm9sZGVyID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuaGlzdG9yeUVudHJpZXNGb2xkZXIpO1xuXG5cdFx0Ly8gTWFrZSBzdXJlIHRvIGF3YWl0IHJlc29sdmluZyB3aGVuIHBlcnNpc3Rpbmdcblx0XHRhd2FpdCB0aGlzLnJlc29sdmVFbnRyaWVzT25jZSgpO1xuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIENsZWFudXAgYmFzZWQgb24gbWF4LWVudHJpZXMgc2V0dGluZ1xuXHRcdGF3YWl0IHRoaXMuY2xlYW5VcEVudHJpZXMoKTtcblxuXHRcdC8vIFdpdGhvdXQgZW50cmllcywgcmVtb3ZlIHRoZSBoaXN0b3J5IGZvbGRlclxuXHRcdGNvbnN0IHN0b3JlZFZlcnNpb24gPSB0aGlzLnZlcnNpb25JZDtcblx0XHRpZiAodGhpcy5lbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwoaGlzdG9yeUVudHJpZXNGb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy50cmFjZUVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBzdGlsbCBoYXZlIGVudHJpZXMsIHVwZGF0ZSB0aGUgZW50cmllcyBtZXRhIGZpbGVcblx0XHRlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVFbnRyaWVzRmlsZSgpO1xuXHRcdH1cblxuXHRcdC8vIE1hcmsgYXMgc3RvcmVkIHZlcnNpb25cblx0XHR0aGlzLnN0b3JlZFZlcnNpb25JZCA9IHN0b3JlZFZlcnNpb247XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNsZWFuVXBFbnRyaWVzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyZWRNYXhFbnRyaWVzID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsLlNFVFRJTkdTLk1BWF9FTlRSSUVTLCB7IHJlc291cmNlOiB0aGlzLndvcmtpbmdDb3B5UmVzb3VyY2UgfSk7XG5cdFx0aWYgKHRoaXMuZW50cmllcy5sZW5ndGggPD0gY29uZmlndXJlZE1heEVudHJpZXMpIHtcblx0XHRcdHJldHVybjsgLy8gbm90aGluZyB0byBjbGVhbnVwXG5cdFx0fVxuXG5cdFx0Y29uc3QgZW50cmllc1RvRGVsZXRlID0gdGhpcy5lbnRyaWVzLnNsaWNlKDAsIHRoaXMuZW50cmllcy5sZW5ndGggLSBjb25maWd1cmVkTWF4RW50cmllcyk7XG5cdFx0Y29uc3QgZW50cmllc1RvS2VlcCA9IHRoaXMuZW50cmllcy5zbGljZSh0aGlzLmVudHJpZXMubGVuZ3RoIC0gY29uZmlndXJlZE1heEVudHJpZXMpO1xuXG5cdFx0Ly8gRGVsZXRlIGVudHJpZXMgZnJvbSBkaXNrIGFzIGluc3RydWN0ZWRcblx0XHRmb3IgKGNvbnN0IGVudHJ5VG9EZWxldGUgb2YgZW50cmllc1RvRGVsZXRlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRlbGV0ZUVudHJ5KGVudHJ5VG9EZWxldGUpO1xuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB0byB1cGRhdGUgb3VyIGluLW1lbW9yeSBtb2RlbCBhcyB3ZWxsXG5cdFx0Ly8gYmVjYXVzZSBpdCB3aWxsIGJlIHBlcnNpc3RlZCByaWdodCBhZnRlclxuXHRcdHRoaXMuZW50cmllcyA9IGVudHJpZXNUb0tlZXA7XG5cblx0XHQvLyBFdmVudHNcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXNUb0RlbGV0ZSkge1xuXHRcdFx0dGhpcy5lbnRyeVJlbW92ZWRFbWl0dGVyLmZpcmUoeyBlbnRyeSB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRlbGV0ZUVudHJ5KGVudHJ5OiBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwoZW50cnkubG9jYXRpb24pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLnRyYWNlRXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVFbnRyaWVzRmlsZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3JraW5nQ29weVJlc291cmNlID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMud29ya2luZ0NvcHlSZXNvdXJjZSk7XG5cdFx0Y29uc3QgaGlzdG9yeUVudHJpZXNMaXN0aW5nRmlsZSA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmhpc3RvcnlFbnRyaWVzTGlzdGluZ0ZpbGUpO1xuXG5cdFx0Y29uc3Qgc2VyaWFsaXplZE1vZGVsOiBJU2VyaWFsaXplZFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsID0ge1xuXHRcdFx0dmVyc2lvbjogMSxcblx0XHRcdHJlc291cmNlOiB3b3JraW5nQ29weVJlc291cmNlLnRvU3RyaW5nKCksXG5cdFx0XHRlbnRyaWVzOiB0aGlzLmVudHJpZXMubWFwKGVudHJ5ID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogZW50cnkuaWQsXG5cdFx0XHRcdFx0c291cmNlOiBlbnRyeS5zb3VyY2UgIT09IFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsLkZJTEVfU0FWRURfU09VUkNFID8gZW50cnkuc291cmNlIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHNvdXJjZURlc2NyaXB0aW9uOiBlbnRyeS5zb3VyY2VEZXNjcmlwdGlvbixcblx0XHRcdFx0XHR0aW1lc3RhbXA6IGVudHJ5LnRpbWVzdGFtcFxuXHRcdFx0XHR9O1xuXHRcdFx0fSlcblx0XHR9O1xuXG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUoaGlzdG9yeUVudHJpZXNMaXN0aW5nRmlsZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShzZXJpYWxpemVkTW9kZWwpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRFbnRyaWVzRmlsZSgpOiBQcm9taXNlPElTZXJpYWxpemVkV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5RW50cmllc0xpc3RpbmdGaWxlID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuaGlzdG9yeUVudHJpZXNMaXN0aW5nRmlsZSk7XG5cblx0XHRsZXQgc2VyaWFsaXplZE1vZGVsOiBJU2VyaWFsaXplZFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRzZXJpYWxpemVkTW9kZWwgPSBKU09OLnBhcnNlKChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGhpc3RvcnlFbnRyaWVzTGlzdGluZ0ZpbGUpKS52YWx1ZS50b1N0cmluZygpKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKCF0aGlzLmlzRmlsZU5vdEZvdW5kKGVycm9yKSkge1xuXHRcdFx0XHR0aGlzLnRyYWNlRXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBzZXJpYWxpemVkTW9kZWw7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlYWRFbnRyaWVzRm9sZGVyKCk6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBoaXN0b3J5RW50cmllc0ZvbGRlciA9IGFzc2VydElzRGVmaW5lZCh0aGlzLmhpc3RvcnlFbnRyaWVzRm9sZGVyKTtcblx0XHRjb25zdCBoaXN0b3J5RW50cmllc05hbWVNYXRjaGVyID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuaGlzdG9yeUVudHJpZXNOYW1lTWF0Y2hlcik7XG5cblx0XHRsZXQgcmF3RW50cmllczogSUZpbGVTdGF0V2l0aE1ldGFkYXRhW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBSZXNvbHZlIGNoaWxkcmVuIG9mIGZvbGRlciBvbiBkaXNrXG5cdFx0dHJ5IHtcblx0XHRcdHJhd0VudHJpZXMgPSAoYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKGhpc3RvcnlFbnRyaWVzRm9sZGVyLCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KSkuY2hpbGRyZW47XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghdGhpcy5pc0ZpbGVOb3RGb3VuZChlcnJvcikpIHtcblx0XHRcdFx0dGhpcy50cmFjZUVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXJhd0VudHJpZXMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gU2tpcCBlbnRyaWVzIHRoYXQgZG8gbm90IHNlZW0gdG8gaGF2ZSB2YWxpZCBmaWxlIG5hbWVcblx0XHRyZXR1cm4gcmF3RW50cmllcy5maWx0ZXIoZW50cnkgPT5cblx0XHRcdCFpc0VxdWFsKGVudHJ5LnJlc291cmNlLCB0aGlzLmhpc3RvcnlFbnRyaWVzTGlzdGluZ0ZpbGUpICYmIC8vIG5vdCB0aGUgbGlzdGluZ3MgZmlsZVxuXHRcdFx0aGlzdG9yeUVudHJpZXNOYW1lTWF0Y2hlci50ZXN0KGVudHJ5Lm5hbWUpXHRcdFx0XHRcdC8vIG1hdGNoaW5nIG91ciBleHBlY3RlZCBmaWxlIHBhdHRlcm4gZm9yIGVudHJpZXNcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0ZpbGVOb3RGb3VuZChlcnJvcjogdW5rbm93bik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FcnJvciAmJiBlcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0ID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZUVycm9yKGVycm9yOiBFcnJvcik6IHZvaWQge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW1dvcmtpbmcgQ29weSBIaXN0b3J5IFNlcnZpY2VdJywgZXJyb3IpO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBGSUxFX01PVkVEX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgnbW92ZWQuc291cmNlJywgbG9jYWxpemUoJ21vdmVkLnNvdXJjZScsIFwiRmlsZSBNb3ZlZFwiKSk7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEZJTEVfUkVOQU1FRF9TT1VSQ0UgPSBTYXZlU291cmNlUmVnaXN0cnkucmVnaXN0ZXJTb3VyY2UoJ3JlbmFtZWQuc291cmNlJywgbG9jYWxpemUoJ3JlbmFtZWQuc291cmNlJywgXCJGaWxlIFJlbmFtZWRcIikpO1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRBZGRFbnRyeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElXb3JraW5nQ29weUhpc3RvcnlFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQWRkRW50cnkgPSB0aGlzLl9vbkRpZEFkZEVudHJ5LmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VFbnRyeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElXb3JraW5nQ29weUhpc3RvcnlFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRW50cnkgPSB0aGlzLl9vbkRpZENoYW5nZUVudHJ5LmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRSZXBsYWNlRW50cnkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJV29ya2luZ0NvcHlIaXN0b3J5RXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcGxhY2VFbnRyeSA9IHRoaXMuX29uRGlkUmVwbGFjZUVudHJ5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkTW92ZUVudHJpZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRNb3ZlRW50cmllcyA9IHRoaXMuX29uRGlkTW92ZUVudHJpZXMuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFJlbW92ZUVudHJ5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVdvcmtpbmdDb3B5SGlzdG9yeUV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVFbnRyeSA9IHRoaXMuX29uRGlkUmVtb3ZlRW50cnkuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmVFbnRyaWVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlRW50cmllcyA9IHRoaXMuX29uRGlkUmVtb3ZlRW50cmllcy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxvY2FsSGlzdG9yeUhvbWUgPSBuZXcgRGVmZXJyZWRQcm9taXNlPFVSST4oKTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgbW9kZWxzID0gbmV3IFJlc291cmNlTWFwPFdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsPihyZXNvdXJjZSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZ2V0Q29tcGFyaXNvbktleShyZXNvdXJjZSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVzb2x2ZUxvY2FsSGlzdG9yeUhvbWUoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUxvY2FsSGlzdG9yeUhvbWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGhpc3RvcnlIb21lOiBVUkkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBQcmVmZXIgaGlzdG9yeSB0byBiZSBzdG9yZWQgaW4gdGhlIHJlbW90ZSBpZiB3ZSBhcmUgY29ubmVjdGVkIHRvIGEgcmVtb3RlXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlbW90ZUVudiA9IGF3YWl0IHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdFx0XHRpZiAocmVtb3RlRW52KSB7XG5cdFx0XHRcdGhpc3RvcnlIb21lID0gcmVtb3RlRW52LmxvY2FsSGlzdG9yeUhvbWU7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7IC8vIGlnbm9yZSBhbmQgZmFsbGJhY2sgdG8gbG9jYWxcblx0XHR9XG5cblx0XHQvLyBCdXQgZmFsbGJhY2sgdG8gbG9jYWwgaWYgdGhlcmUgaXMgbm8gcmVtb3RlXG5cdFx0aWYgKCFoaXN0b3J5SG9tZSkge1xuXHRcdFx0aGlzdG9yeUhvbWUgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5sb2NhbEhpc3RvcnlIb21lO1xuXHRcdH1cblxuXHRcdHRoaXMubG9jYWxIaXN0b3J5SG9tZS5jb21wbGV0ZShoaXN0b3J5SG9tZSk7XG5cdH1cblxuXHRhc3luYyBtb3ZlRW50cmllcyhzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0Y29uc3QgbGltaXRlciA9IG5ldyBMaW1pdGVyPFVSST4oTUFYX1BBUkFMTEVMX0hJU1RPUllfSU9fT1BTKTtcblx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxVUkk+W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgW3Jlc291cmNlLCBtb2RlbF0gb2YgdGhpcy5tb2RlbHMpIHtcblx0XHRcdGlmICghdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudChyZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gbW9kZWwgZG9lcyBub3QgbWF0Y2ggbW92ZWQgcmVzb3VyY2Vcblx0XHRcdH1cblxuXHRcdFx0Ly8gRGV0ZXJtaW5lIG5ldyByZXN1bHRpbmcgdGFyZ2V0IHJlc291cmNlXG5cdFx0XHRsZXQgdGFyZ2V0UmVzb3VyY2U6IFVSSTtcblx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChzb3VyY2UsIHJlc291cmNlKSkge1xuXHRcdFx0XHR0YXJnZXRSZXNvdXJjZSA9IHRhcmdldDsgLy8gZmlsZSBnb3QgbW92ZWRcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gaW5kZXhPZlBhdGgocmVzb3VyY2UucGF0aCwgc291cmNlLnBhdGgpO1xuXHRcdFx0XHR0YXJnZXRSZXNvdXJjZSA9IGpvaW5QYXRoKHRhcmdldCwgcmVzb3VyY2UucGF0aC5zdWJzdHIoaW5kZXggKyBzb3VyY2UucGF0aC5sZW5ndGggKyAxKSk7IC8vIHBhcmVudCBmb2xkZXIgZ290IG1vdmVkXG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpZ3VyZSBvdXQgc2F2ZSBzb3VyY2Vcblx0XHRcdGxldCBzYXZlU291cmNlOiBTYXZlU291cmNlO1xuXHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGRpcm5hbWUocmVzb3VyY2UpLCBkaXJuYW1lKHRhcmdldFJlc291cmNlKSkpIHtcblx0XHRcdFx0c2F2ZVNvdXJjZSA9IFdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2UuRklMRV9SRU5BTUVEX1NPVVJDRTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNhdmVTb3VyY2UgPSBXb3JraW5nQ29weUhpc3RvcnlTZXJ2aWNlLkZJTEVfTU9WRURfU09VUkNFO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBNb3ZlIGVudHJpZXMgdG8gdGFyZ2V0IHF1ZXVlZFxuXHRcdFx0cHJvbWlzZXMucHVzaChsaW1pdGVyLnF1ZXVlKCgpID0+IHRoaXMuZG9Nb3ZlRW50cmllcyhtb2RlbCwgc2F2ZVNvdXJjZSwgcmVzb3VyY2UsIHRhcmdldFJlc291cmNlKSkpO1xuXHRcdH1cblxuXHRcdGlmICghcHJvbWlzZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gQXdhaXQgbW92ZSBvcGVyYXRpb25zXG5cdFx0Y29uc3QgcmVzb3VyY2VzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXG5cdFx0Ly8gRXZlbnRzXG5cdFx0dGhpcy5fb25EaWRNb3ZlRW50cmllcy5maXJlKCk7XG5cblx0XHRyZXR1cm4gcmVzb3VyY2VzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb01vdmVFbnRyaWVzKHNvdXJjZTogV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwsIHNhdmVTb3VyY2U6IFNhdmVTb3VyY2UsIHNvdXJjZVdvcmtpbmdDb3B5UmVzb3VyY2U6IFVSSSwgdGFyZ2V0V29ya2luZ0NvcHlSZXNvdXJjZTogVVJJKTogUHJvbWlzZTxVUkk+IHtcblxuXHRcdC8vIE1vdmUgdG8gdGFyZ2V0IHZpYSBtb2RlbFxuXHRcdGNvbnN0IHRhcmdldCA9IGF3YWl0IHRoaXMuZ2V0TW9kZWwodGFyZ2V0V29ya2luZ0NvcHlSZXNvdXJjZSk7XG5cdFx0YXdhaXQgc291cmNlLm1vdmVFbnRyaWVzKHRhcmdldCwgc2F2ZVNvdXJjZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHQvLyBVcGRhdGUgbW9kZWwgaW4gb3VyIG1hcFxuXHRcdHRoaXMubW9kZWxzLmRlbGV0ZShzb3VyY2VXb3JraW5nQ29weVJlc291cmNlKTtcblx0XHR0aGlzLm1vZGVscy5zZXQodGFyZ2V0V29ya2luZ0NvcHlSZXNvdXJjZSwgc291cmNlKTtcblxuXHRcdHJldHVybiB0YXJnZXRXb3JraW5nQ29weVJlc291cmNlO1xuXHR9XG5cblx0YXN5bmMgYWRkRW50cnkoeyByZXNvdXJjZSwgc291cmNlLCB0aW1lc3RhbXAgfTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5RGVzY3JpcHRvciwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJV29ya2luZ0NvcHlIaXN0b3J5RW50cnkgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIocmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB3ZSByZXF1aXJlIHRoZSB3b3JraW5nIGNvcHkgcmVzb3VyY2UgdG8gYmUgZmlsZSBzZXJ2aWNlIGFjY2Vzc2libGVcblx0XHR9XG5cblx0XHQvLyBSZXNvbHZlIGhpc3RvcnkgbW9kZWwgZm9yIHdvcmtpbmcgY29weVxuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIEFkZCB0byBtb2RlbFxuXHRcdHJldHVybiBtb2RlbC5hZGRFbnRyeShzb3VyY2UsIHVuZGVmaW5lZCwgdGltZXN0YW1wLCB0b2tlbik7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVFbnRyeShlbnRyeTogSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5LCBwcm9wZXJ0aWVzOiB7IHNvdXJjZTogU2F2ZVNvdXJjZSB9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFJlc29sdmUgaGlzdG9yeSBtb2RlbCBmb3Igd29ya2luZyBjb3B5XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmdldE1vZGVsKGVudHJ5LndvcmtpbmdDb3B5LnJlc291cmNlKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZW5hbWUgaW4gbW9kZWxcblx0XHRyZXR1cm4gbW9kZWwudXBkYXRlRW50cnkoZW50cnksIHByb3BlcnRpZXMsIHRva2VuKTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUVudHJ5KGVudHJ5OiBJV29ya2luZ0NvcHlIaXN0b3J5RW50cnksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gUmVzb2x2ZSBoaXN0b3J5IG1vZGVsIGZvciB3b3JraW5nIGNvcHlcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMuZ2V0TW9kZWwoZW50cnkud29ya2luZ0NvcHkucmVzb3VyY2UpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBmcm9tIG1vZGVsXG5cdFx0cmV0dXJuIG1vZGVsLnJlbW92ZUVudHJ5KGVudHJ5LCB0b2tlbik7XG5cdH1cblxuXHRhc3luYyByZW1vdmVBbGwodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaGlzdG9yeUhvbWUgPSBhd2FpdCB0aGlzLmxvY2FsSGlzdG9yeUhvbWUucDtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDbGVhciBtb2RlbHNcblx0XHR0aGlzLm1vZGVscy5jbGVhcigpO1xuXG5cdFx0Ly8gUmVtb3ZlIGZyb20gZGlza1xuXHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuZGVsKGhpc3RvcnlIb21lLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMuX29uRGlkUmVtb3ZlRW50cmllcy5maXJlKCk7XG5cdH1cblxuXHRhc3luYyBnZXRFbnRyaWVzKHJlc291cmNlOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8cmVhZG9ubHkgSVdvcmtpbmdDb3B5SGlzdG9yeUVudHJ5W10+IHtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVudHJpZXMgPSBhd2FpdCBtb2RlbC5nZXRFbnRyaWVzKCk7XG5cdFx0cmV0dXJuIGVudHJpZXMgPz8gW107XG5cdH1cblxuXHRhc3luYyBnZXRBbGwodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxyZWFkb25seSBVUklbXT4ge1xuXHRcdGNvbnN0IGhpc3RvcnlIb21lID0gYXdhaXQgdGhpcy5sb2NhbEhpc3RvcnlIb21lLnA7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsID0gbmV3IFJlc291cmNlTWFwPHRydWU+KCk7XG5cblx0XHQvLyBGaWxsIGluIGFsbCBrbm93biBtb2RlbCByZXNvdXJjZXMgKHRoZXkgbWlnaHQgbm90IGhhdmUgeWV0IHBlcnNpc3RlZCB0byBkaXNrKVxuXHRcdGZvciAoY29uc3QgW3Jlc291cmNlLCBtb2RlbF0gb2YgdGhpcy5tb2RlbHMpIHtcblx0XHRcdGNvbnN0IGhhc0luTWVtb3J5RW50cmllcyA9IGF3YWl0IG1vZGVsLmhhc0VudHJpZXModHJ1ZSAvKiBza2lwIHJlc29sdmluZyBiZWNhdXNlIHdlIHJlc29sdmUgYmVsb3cgZnJvbSBkaXNrICovKTtcblx0XHRcdGlmIChoYXNJbk1lbW9yeUVudHJpZXMpIHtcblx0XHRcdFx0YWxsLnNldChyZXNvdXJjZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVzb2x2ZSBhbGwgb3RoZXIgcmVzb3VyY2VzIGJ5IGl0ZXJhdGluZyB0aGUgaGlzdG9yeSBob21lIGZvbGRlclxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZEhpc3RvcnlIb21lID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKGhpc3RvcnlIb21lKTtcblx0XHRcdGlmIChyZXNvbHZlZEhpc3RvcnlIb21lLmNoaWxkcmVuKSB7XG5cdFx0XHRcdGNvbnN0IGxpbWl0ZXIgPSBuZXcgTGltaXRlcihNQVhfUEFSQUxMRUxfSElTVE9SWV9JT19PUFMpO1xuXHRcdFx0XHRjb25zdCBwcm9taXNlcyA9IFtdO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgcmVzb2x2ZWRIaXN0b3J5SG9tZS5jaGlsZHJlbikge1xuXHRcdFx0XHRcdHByb21pc2VzLnB1c2gobGltaXRlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzZXJpYWxpemVkTW9kZWw6IElTZXJpYWxpemVkV29ya2luZ0NvcHlIaXN0b3J5TW9kZWwgPSBKU09OLnBhcnNlKChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGpvaW5QYXRoKGNoaWxkLnJlc291cmNlLCBXb3JraW5nQ29weUhpc3RvcnlNb2RlbC5FTlRSSUVTX0ZJTEUpKSkudmFsdWUudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0XHRcdGlmIChzZXJpYWxpemVkTW9kZWwuZW50cmllcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0YWxsLnNldChVUkkucGFyc2Uoc2VyaWFsaXplZE1vZGVsLnJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdC8vIGlnbm9yZSAtIG1vZGVsIG1pZ2h0IGJlIG1pc3Npbmcgb3IgY29ycnVwdCwgYnV0IHdlIG5lZWQgaXRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGlnbm9yZSAtIGhpc3RvcnkgbWlnaHQgYmUgZW50aXJlbHkgZW1wdHlcblx0XHR9XG5cblx0XHRyZXR1cm4gQXJyYXkuZnJvbShhbGwua2V5cygpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0TW9kZWwocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8V29ya2luZ0NvcHlIaXN0b3J5TW9kZWw+IHtcblx0XHRjb25zdCBoaXN0b3J5SG9tZSA9IGF3YWl0IHRoaXMubG9jYWxIaXN0b3J5SG9tZS5wO1xuXG5cdFx0bGV0IG1vZGVsID0gdGhpcy5tb2RlbHMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRtb2RlbCA9IG5ldyBXb3JraW5nQ29weUhpc3RvcnlNb2RlbChyZXNvdXJjZSwgaGlzdG9yeUhvbWUsIHRoaXMuX29uRGlkQWRkRW50cnksIHRoaXMuX29uRGlkQ2hhbmdlRW50cnksIHRoaXMuX29uRGlkUmVwbGFjZUVudHJ5LCB0aGlzLl9vbkRpZFJlbW92ZUVudHJ5LCB0aGlzLmdldE1vZGVsT3B0aW9ucygpLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLmxhYmVsU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdHRoaXMubW9kZWxzLnNldChyZXNvdXJjZSwgbW9kZWwpO1xuXHRcdH1cblxuXHRcdHJldHVybiBtb2RlbDtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRNb2RlbE9wdGlvbnMoKTogSVdvcmtpbmdDb3B5SGlzdG9yeU1vZGVsT3B0aW9ucztcblxufVxuXG5leHBvcnQgY2xhc3MgTmF0aXZlV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZSBleHRlbmRzIFdvcmtpbmdDb3B5SGlzdG9yeVNlcnZpY2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNUT1JFX0FMTF9JTlRFUlZBTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDVtaW5cblxuXHRwcml2YXRlIHJlYWRvbmx5IGlzUmVtb3RlbHlTdG9yZWQgPSB0eXBlb2YgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ID09PSAnc3RyaW5nJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0b3JlQWxsQ3RzID0gdGhpcy5fcmVnaXN0ZXIobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN0b3JlQWxsU2NoZWR1bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5zdG9yZUFsbCh0aGlzLnN0b3JlQWxsQ3RzLnRva2VuKSwgTmF0aXZlV29ya2luZ0NvcHlIaXN0b3J5U2VydmljZS5TVE9SRV9BTExfSU5URVJWQUwpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoZmlsZVNlcnZpY2UsIHJlbW90ZUFnZW50U2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxhYmVsU2VydmljZSwgbG9nU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNSZW1vdGVseVN0b3JlZCkge1xuXG5cdFx0XHQvLyBMb2NhbDogcGVyc2lzdCBhbGwgb24gc2h1dGRvd25cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bihlID0+IHRoaXMub25XaWxsU2h1dGRvd24oZSkpKTtcblxuXHRcdFx0Ly8gTG9jYWw6IHNjaGVkdWxlIHBlcnNpc3Qgb24gY2hhbmdlXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkodGhpcy5vbkRpZEFkZEVudHJ5LCB0aGlzLm9uRGlkQ2hhbmdlRW50cnksIHRoaXMub25EaWRSZXBsYWNlRW50cnksIHRoaXMub25EaWRSZW1vdmVFbnRyeSkoKCkgPT4gdGhpcy5vbkRpZENoYW5nZU1vZGVscygpKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIGdldE1vZGVsT3B0aW9ucygpOiBJV29ya2luZ0NvcHlIaXN0b3J5TW9kZWxPcHRpb25zIHtcblx0XHRyZXR1cm4geyBmbHVzaE9uQ2hhbmdlOiB0aGlzLmlzUmVtb3RlbHlTdG9yZWQgLyogYmVjYXVzZSB0aGUgY29ubmVjdGlvbiBtaWdodCBkcm9wIGFueXRpbWUgKi8gfTtcblx0fVxuXG5cdHByaXZhdGUgb25XaWxsU2h1dGRvd24oZTogV2lsbFNodXRkb3duRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIERpc3Bvc2UgdGhlIHNjaGVkdWxlci4uLlxuXHRcdHRoaXMuc3RvcmVBbGxTY2hlZHVsZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuc3RvcmVBbGxDdHMuZGlzcG9zZSh0cnVlKTtcblxuXHRcdC8vIC4uLmJlY2F1c2Ugd2Ugbm93IGV4cGxpY2l0bHkgc3RvcmUgYWxsIG1vZGVsc1xuXHRcdGUuam9pbih0aGlzLnN0b3JlQWxsKGUudG9rZW4pLCB7IGlkOiAnam9pbi53b3JraW5nQ29weUhpc3RvcnknLCBsYWJlbDogbG9jYWxpemUoJ2pvaW4ud29ya2luZ0NvcHlIaXN0b3J5JywgXCJTYXZpbmcgbG9jYWwgaGlzdG9yeVwiKSB9KTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VNb2RlbHMoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnN0b3JlQWxsU2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdHRoaXMuc3RvcmVBbGxTY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN0b3JlQWxsKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGxpbWl0ZXIgPSBuZXcgTGltaXRlcihNQVhfUEFSQUxMRUxfSElTVE9SWV9JT19PUFMpO1xuXHRcdGNvbnN0IHByb21pc2VzID0gW107XG5cblx0XHRjb25zdCBtb2RlbHMgPSBBcnJheS5mcm9tKHRoaXMubW9kZWxzLnZhbHVlcygpKTtcblx0XHRmb3IgKGNvbnN0IG1vZGVsIG9mIG1vZGVscykge1xuXHRcdFx0cHJvbWlzZXMucHVzaChsaW1pdGVyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBtb2RlbC5zdG9yZSh0b2tlbik7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0fVxufVxuXG4vLyBSZWdpc3RlciBIaXN0b3J5IFRyYWNrZXJcblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihXb3JraW5nQ29weUhpc3RvcnlUcmFja2VyLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTBDLGNBQWMsMkJBQTJCO0FBQ25GLFNBQVMsbUJBQW1CLHNCQUF5QztBQUNyRSxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGtCQUFrQjtBQUMzQixTQUE2SCxtQ0FBbUM7QUFDaEssU0FBUyxvQkFBb0IscUJBQXFCLG9CQUEyQztBQUM3RixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUIsU0FBUyx3QkFBd0I7QUFDM0QsU0FBUyxTQUFTLFNBQVMsU0FBUyxnQkFBZ0I7QUFDcEQsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsYUFBYSxrQkFBa0I7QUFDeEMsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQXFCLDBCQUEwQjtBQUMvQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDhCQUE4QjtBQXlCaEMsTUFBTSwyQkFBTixNQUFNLHlCQUF3QjtBQUFBLEVBNEJwQyxZQUNDLHFCQUNpQixhQUNBLG1CQUNBLHFCQUNBLHNCQUNBLHFCQUNBLFNBQ0EsYUFDQSxjQUNBLFlBQ0Esc0JBQ2hCO0FBVmdCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBNUJsQixTQUFRLFVBQXNDLENBQUM7QUFFL0MsU0FBUSxlQUEwQztBQUVsRCxTQUFRLHNCQUF1QztBQUMvQyxTQUFRLGtCQUFzQztB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RUFFUSxvQkFBMEI7QUFDakMsUUFBSSxDQUFDLEtBQUssa0JBQWtCO0FBRzNCLFdBQUssVUFBVSxLQUFLLGlCQUFpQixlQUFlLE9BQUssS0FBSyxlQUFlLENBQUMsQ0FBQyxDQUFDO0FBR2hGLFdBQUssVUFBVSxNQUFNLElBQUksS0FBSyxlQUFlLEtBQUssa0JBQWtCLEtBQUssbUJBQW1CLEtBQUssZ0JBQWdCLEVBQUUsTUFBTSxLQUFLLGtCQUFrQixDQUFDLENBQUM7QUFBQSxJQUNuSjtBQUFBLEVBQ0Q7QUFBQSxFQUVVLGtCQUFtRDtBQUM1RCxXQUFPO0FBQUEsTUFBRSxlQUFlLEtBQUs7QUFBQTtBQUFBLElBQWlFO0FBQUEsRUFDL0Y7QUFBQSxFQUVRLGVBQWUsR0FBNEI7QUFHbEQsU0FBSyxrQkFBa0IsUUFBUTtBQUMvQixTQUFLLFlBQVksUUFBUSxJQUFJO0FBRzdCLE1BQUUsS0FBSyxLQUFLLFNBQVMsRUFBRSxLQUFLLEdBQUcsRUFBRSxJQUFJLDJCQUEyQixPQUFPLFNBQVMsMkJBQTJCLHNCQUFzQixFQUFFLENBQUM7QUFBQSxFQUNySTtBQUFBLEVBRVEsb0JBQTBCO0FBQ2pDLFFBQUksQ0FBQyxLQUFLLGtCQUFrQixZQUFZLEdBQUc7QUFDMUMsV0FBSyxrQkFBa0IsU0FBUztBQUFBLElBQ2pDO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxTQUFTLE9BQXlDO0FBQy9ELFVBQU0sVUFBVSxJQUFJLFFBQVEsMkJBQTJCO0FBQ3ZELFVBQU0sV0FBVyxDQUFDO0FBRWxCLFVBQU0sU0FBUyxNQUFNLEtBQUssS0FBSyxPQUFPLE9BQU8sQ0FBQztBQUM5QyxlQUFXLFNBQVMsUUFBUTtBQUMzQixlQUFTLEtBQUssUUFBUSxNQUFNLFlBQVk7QUFDdkMsWUFBSSxNQUFNLHlCQUF5QjtBQUNsQztBQUFBLFFBQ0Q7QUFFQSxZQUFJO0FBQ0gsZ0JBQU0sTUFBTSxNQUFNLEtBQUs7QUFBQSxRQUN4QixTQUFTLE9BQU87QUFDZixlQUFLLFdBQVcsTUFBTSxLQUFLO0FBQUEsUUFDNUI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUFBLElBQ0g7QUFFQSxVQUFNLFFBQVEsSUFBSSxRQUFRO0FBQUEsRUFDM0I7QUFDRDtBQTVFYSxnQ0FFWSxxQkFBcUIsSUFBSSxLQUFLO0FBRjFDLGtDQUFOO0FBQUEsRUFVSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWpCVTtBQStFYixTQUFTLEdBQW9DLG9CQUFvQixTQUFTLEVBQUUsOEJBQThCLDJCQUEyQixlQUFlLFFBQVE7IiwKICAibmFtZXMiOiBbImVycm9yIl0KfQo=
