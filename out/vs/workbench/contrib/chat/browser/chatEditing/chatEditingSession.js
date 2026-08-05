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
import { equals as arraysEqual, binarySearch2 } from "../../../../../base/common/arrays.js";
import { DeferredPromise, Sequencer, SequencerByKey, timeout } from "../../../../../base/common/async.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { BugIndicatingError } from "../../../../../base/common/errors.js";
import { Emitter } from "../../../../../base/common/event.js";
import { StringSHA1 } from "../../../../../base/common/hash.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, dispose } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { asyncTransaction, autorun, derived, derivedOpts, derivedWithStore, ObservablePromise, observableValue, transaction } from "../../../../../base/common/observable.js";
import { isEqual, joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IBulkEditService } from "../../../../../editor/browser/services/bulkEditService.js";
import { OffsetEdit } from "../../../../../editor/common/core/offsetEdit.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IEditorWorkerService } from "../../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { EditorActivation } from "../../../../../platform/editor/common/editor.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { observableConfigValue } from "../../../../../platform/observable/common/platformObservableUtils.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { MultiDiffEditorInput } from "../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { ChatEditingSessionChangeType, ChatEditingSessionState, ChatEditKind, getMultiDiffSourceUri, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingModifiedDocumentEntry } from "./chatEditingModifiedDocumentEntry.js";
import { ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { ChatEditingModifiedNotebookEntry } from "./chatEditingModifiedNotebookEntry.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { ChatEditingModifiedNotebookDiff } from "./notebook/chatEditingModifiedNotebookDiff.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
const STORAGE_CONTENTS_FOLDER = "contents";
const STORAGE_STATE_FILE = "state.json";
const POST_EDIT_STOP_ID = "d19944f6-f46c-4e17-911b-79a8e843c7c0";
class ThrottledSequencer extends Sequencer {
  constructor(_minDuration, _maxOverallDelay) {
    super();
    this._minDuration = _minDuration;
    this._maxOverallDelay = _maxOverallDelay;
    this._size = 0;
  }
  queue(promiseTask) {
    this._size += 1;
    const noDelay = this._size * this._minDuration > this._maxOverallDelay;
    return super.queue(async () => {
      try {
        const p1 = promiseTask();
        const p2 = noDelay ? Promise.resolve(void 0) : timeout(this._minDuration, CancellationToken.None);
        const [result] = await Promise.all([p1, p2]);
        return result;
      } finally {
        this._size -= 1;
      }
    });
  }
}
function getMaxHistoryIndex(history) {
  const lastHistory = history.at(-1);
  return lastHistory ? lastHistory.startIndex + lastHistory.stops.length : 0;
}
function snapshotsEqualForDiff(a, b) {
  if (!a || !b) {
    return a === b;
  }
  return isEqual(a.snapshotUri, b.snapshotUri) && a.current === b.current;
}
function getCurrentAndNextStop(requestId, stopId, history) {
  const snapshotIndex = history.findIndex((s) => s.requestId === requestId);
  if (snapshotIndex === -1) {
    return void 0;
  }
  const snapshot = history[snapshotIndex];
  const stopIndex = snapshot.stops.findIndex((s) => s.stopId === stopId);
  if (stopIndex === -1) {
    return void 0;
  }
  const current = snapshot.stops[stopIndex].entries;
  const next = stopIndex < snapshot.stops.length - 1 ? snapshot.stops[stopIndex + 1].entries : snapshot.postEdit || history[snapshotIndex + 1]?.stops[0].entries;
  if (!next) {
    return void 0;
  }
  return { current, next };
}
let ChatEditingSession = class extends Disposable {
  constructor(chatSessionId, isGlobalEditingSession, _lookupExternalEntry, _instantiationService, _modelService, _languageService, _textModelService, _bulkEditService, _editorGroupsService, _editorService, _chatService, _notebookService, _editorWorkerService, _configurationService, _accessibilitySignalService) {
    super();
    this.chatSessionId = chatSessionId;
    this.isGlobalEditingSession = isGlobalEditingSession;
    this._lookupExternalEntry = _lookupExternalEntry;
    this._instantiationService = _instantiationService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._textModelService = _textModelService;
    this._bulkEditService = _bulkEditService;
    this._editorGroupsService = _editorGroupsService;
    this._editorService = _editorService;
    this._chatService = _chatService;
    this._notebookService = _notebookService;
    this._editorWorkerService = _editorWorkerService;
    this._configurationService = _configurationService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._state = observableValue(this, ChatEditingSessionState.Initial);
    this._linearHistory = observableValue(this, []);
    this._linearHistoryIndex = observableValue(this, 0);
    /**
     * Contains the contents of a file when the AI first began doing edits to it.
     */
    this._initialFileContents = new ResourceMap();
    this._entriesObs = observableValue(this, []);
    this._workingSet = new ResourceMap();
    this.canUndo = derived((r) => {
      if (this.state.read(r) !== ChatEditingSessionState.Idle) {
        return false;
      }
      const linearHistoryIndex = this._linearHistoryIndex.read(r);
      return linearHistoryIndex > 0;
    });
    this.canRedo = derived((r) => {
      if (this.state.read(r) !== ChatEditingSessionState.Idle) {
        return false;
      }
      const linearHistoryIndex = this._linearHistoryIndex.read(r);
      return linearHistoryIndex < getMaxHistoryIndex(this._linearHistory.read(r));
    });
    // public hiddenRequestIds = derived<string[]>((r) => {
    // 	const linearHistory = this._linearHistory.read(r);
    // 	const linearHistoryIndex = this._linearHistoryIndex.read(r);
    // 	return linearHistory.slice(linearHistoryIndex).map(s => s.requestId).filter((r): r is string => !!r);
    // });
    this._onDidChange = this._register(new Emitter());
    this._onDidDispose = new Emitter();
    this._diffsBetweenStops = /* @__PURE__ */ new Map();
    this._ignoreTrimWhitespaceObservable = observableConfigValue("diffEditor.ignoreTrimWhitespace", true, this._configurationService);
    this._streamingEditLocks = new SequencerByKey();
  }
  get entries() {
    this._assertNotDisposed();
    return this._entriesObs;
  }
  get state() {
    return this._state;
  }
  get onDidChange() {
    this._assertNotDisposed();
    return this._onDidChange.event;
  }
  get onDidDispose() {
    this._assertNotDisposed();
    return this._onDidDispose.event;
  }
  async init() {
    const restoredSessionState = await this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId).restoreState();
    if (restoredSessionState) {
      for (const [uri, content] of restoredSessionState.initialFileContents) {
        this._initialFileContents.set(uri, content);
      }
      await asyncTransaction(async (tx) => {
        this._pendingSnapshot = restoredSessionState.pendingSnapshot;
        await this._restoreSnapshot(restoredSessionState.recentSnapshot, tx, false);
        this._linearHistory.set(restoredSessionState.linearHistory, tx);
        this._linearHistoryIndex.set(restoredSessionState.linearHistoryIndex, tx);
        this._state.set(ChatEditingSessionState.Idle, tx);
      });
    } else {
      this._state.set(ChatEditingSessionState.Idle, void 0);
    }
    this._register(autorun((reader) => {
      const entries = this.entries.read(reader);
      entries.forEach((entry) => {
        entry.state.read(reader);
      });
      this._onDidChange.fire(ChatEditingSessionChangeType.WorkingSet);
    }));
  }
  _getEntry(uri) {
    uri = CellUri.parse(uri)?.notebook ?? uri;
    return this._entriesObs.get().find((e) => isEqual(e.modifiedURI, uri));
  }
  getEntry(uri) {
    return this._getEntry(uri);
  }
  readEntry(uri, reader) {
    uri = CellUri.parse(uri)?.notebook ?? uri;
    return this._entriesObs.read(reader).find((e) => isEqual(e.modifiedURI, uri));
  }
  storeState() {
    const storage = this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId);
    const state = {
      initialFileContents: this._initialFileContents,
      pendingSnapshot: this._pendingSnapshot,
      recentSnapshot: this._createSnapshot(void 0, void 0),
      linearHistoryIndex: this._linearHistoryIndex.get(),
      linearHistory: this._linearHistory.get()
    };
    return storage.storeState(state);
  }
  _findSnapshot(requestId) {
    return this._linearHistory.get().find((s) => s.requestId === requestId);
  }
  _findEditStop(requestId, undoStop) {
    const snapshot = this._findSnapshot(requestId);
    if (!snapshot) {
      return void 0;
    }
    const idx = snapshot.stops.findIndex((s) => s.stopId === undoStop);
    return idx === -1 ? void 0 : { stop: snapshot.stops[idx], snapshot, historyIndex: snapshot.startIndex + idx };
  }
  _ensurePendingSnapshot() {
    this._pendingSnapshot ??= this._createSnapshot(void 0, void 0);
  }
  /**
   * Gets diff for text entries between stops.
   * @param entriesContent Observable that observes either snapshot entry
   * @param modelUrisObservable Observable that observes only the snapshot URIs.
   */
  _entryDiffBetweenTextStops(entriesContent, modelUrisObservable) {
    const modelRefsPromise = derivedWithStore(this, (reader, store) => {
      const modelUris = modelUrisObservable.read(reader);
      if (!modelUris) {
        return void 0;
      }
      const promise = Promise.all(modelUris.map((u) => this._textModelService.createModelReference(u))).then((refs) => {
        if (store.isDisposed) {
          refs.forEach((r) => r.dispose());
        } else {
          refs.forEach((r) => store.add(r));
        }
        return refs;
      });
      return new ObservablePromise(promise);
    });
    return derived((reader) => {
      const refs = modelRefsPromise.read(reader)?.promiseResult.read(reader)?.data;
      if (!refs) {
        return;
      }
      const entries = entriesContent.read(reader);
      if (entries?.before && ChatEditingModifiedNotebookEntry.canHandleSnapshot(entries.before)) {
        const diffService = this._instantiationService.createInstance(ChatEditingModifiedNotebookDiff, entries.before, entries.after);
        return new ObservablePromise(diffService.computeDiff());
      }
      const ignoreTrimWhitespace = this._ignoreTrimWhitespaceObservable.read(reader);
      const promise = this._editorWorkerService.computeDiff(
        refs[0].object.textEditorModel.uri,
        refs[1].object.textEditorModel.uri,
        { ignoreTrimWhitespace, computeMoves: false, maxComputationTimeMs: 3e3 },
        "advanced"
      ).then((diff) => {
        const entryDiff = {
          originalURI: refs[0].object.textEditorModel.uri,
          modifiedURI: refs[1].object.textEditorModel.uri,
          identical: !!diff?.identical,
          quitEarly: !diff || diff.quitEarly,
          added: 0,
          removed: 0
        };
        if (diff) {
          for (const change of diff.changes) {
            entryDiff.removed += change.original.endLineNumberExclusive - change.original.startLineNumber;
            entryDiff.added += change.modified.endLineNumberExclusive - change.modified.startLineNumber;
          }
        }
        return entryDiff;
      });
      return new ObservablePromise(promise);
    });
  }
  _createDiffBetweenStopsObservable(uri, requestId, stopId) {
    const entries = derivedOpts(
      {
        equalsFn: (a, b) => snapshotsEqualForDiff(a?.before, b?.before) && snapshotsEqualForDiff(a?.after, b?.after)
      },
      (reader) => {
        const stops = getCurrentAndNextStop(requestId, stopId, this._linearHistory.read(reader));
        if (!stops) {
          return void 0;
        }
        const before = stops.current.get(uri);
        const after = stops.next.get(uri);
        if (!before || !after) {
          return void 0;
        }
        return { before, after };
      }
    );
    const modelUrisObservable = derivedOpts({ equalsFn: (a, b) => arraysEqual(a, b, isEqual) }, (reader) => {
      const entriesValue = entries.read(reader);
      if (!entriesValue) {
        return void 0;
      }
      return [entriesValue.before.snapshotUri, entriesValue.after.snapshotUri];
    });
    const diff = this._entryDiffBetweenTextStops(entries, modelUrisObservable);
    return derived((reader) => {
      return diff.read(reader)?.promiseResult.read(reader)?.data || void 0;
    });
  }
  getEntryDiffBetweenStops(uri, requestId, stopId) {
    const key = `${uri}\0${requestId}\0${stopId}`;
    let observable = this._diffsBetweenStops.get(key);
    if (!observable) {
      observable = this._createDiffBetweenStopsObservable(uri, requestId, stopId);
      this._diffsBetweenStops.set(key, observable);
    }
    return observable;
  }
  createSnapshot(requestId, undoStop) {
    const snapshot = this._createSnapshot(requestId, undoStop);
    for (const [uri, _] of this._workingSet) {
      this._workingSet.set(uri, { state: WorkingSetEntryState.Sent });
    }
    const linearHistoryPtr = this._linearHistoryIndex.get();
    const newLinearHistory = [];
    for (const entry of this._linearHistory.get()) {
      if (linearHistoryPtr - entry.startIndex < entry.stops.length) {
        newLinearHistory.push({ requestId: entry.requestId, stops: entry.stops.slice(0, linearHistoryPtr - entry.startIndex), startIndex: entry.startIndex, postEdit: void 0 });
      } else {
        newLinearHistory.push(entry);
      }
    }
    const lastEntry = newLinearHistory.at(-1);
    if (requestId && lastEntry?.requestId === requestId) {
      newLinearHistory[newLinearHistory.length - 1] = { ...lastEntry, stops: [...lastEntry.stops, snapshot], postEdit: void 0 };
    } else {
      newLinearHistory.push({ requestId, startIndex: lastEntry ? lastEntry.startIndex + lastEntry.stops.length : 0, stops: [snapshot], postEdit: void 0 });
    }
    transaction((tx) => {
      const last = newLinearHistory[newLinearHistory.length - 1];
      this._linearHistory.set(newLinearHistory, tx);
      this._linearHistoryIndex.set(last.startIndex + last.stops.length, tx);
    });
  }
  _createSnapshot(requestId, undoStop) {
    const workingSet = new ResourceMap(this._workingSet);
    const entries = new ResourceMap();
    for (const entry of this._entriesObs.get()) {
      entries.set(entry.modifiedURI, entry.createSnapshot(requestId, undoStop));
    }
    return {
      stopId: undoStop,
      workingSet,
      entries
    };
  }
  getSnapshot(requestId, undoStop, snapshotUri) {
    const entries = undoStop === POST_EDIT_STOP_ID ? this._findSnapshot(requestId)?.postEdit : this._findEditStop(requestId, undoStop)?.stop.entries;
    return entries && [...entries.values()].find((e) => isEqual(e.snapshotUri, snapshotUri));
  }
  async getSnapshotModel(requestId, undoStop, snapshotUri) {
    const snapshotEntry = this.getSnapshot(requestId, undoStop, snapshotUri);
    if (!snapshotEntry) {
      return null;
    }
    return this._modelService.createModel(snapshotEntry.current, this._languageService.createById(snapshotEntry.languageId), snapshotUri, false);
  }
  getSnapshotUri(requestId, uri, stopId) {
    const stops = getCurrentAndNextStop(requestId, stopId, this._linearHistory.get());
    return stops?.next.get(uri)?.snapshotUri;
  }
  async restoreSnapshot(requestId, stopId) {
    if (requestId !== void 0) {
      const stopRef = this._findEditStop(requestId, stopId);
      if (stopRef) {
        this._ensurePendingSnapshot();
        await asyncTransaction(async (tx) => {
          this._linearHistoryIndex.set(stopRef.historyIndex, tx);
          await this._restoreSnapshot(stopRef.stop, tx);
        });
        this._updateRequestHiddenState();
      }
    } else {
      const pendingSnapshot = this._pendingSnapshot;
      if (!pendingSnapshot) {
        return;
      }
      this._pendingSnapshot = void 0;
      await this._restoreSnapshot(pendingSnapshot, void 0);
    }
  }
  async _restoreSnapshot({ workingSet, entries }, tx, restoreResolvedToDisk = true) {
    this._workingSet = new ResourceMap(workingSet);
    for (const entry of this._entriesObs.get()) {
      const snapshotEntry = entries.get(entry.modifiedURI);
      if (!snapshotEntry) {
        entry.resetToInitialContent();
        entry.dispose();
      }
    }
    const entriesArr = [];
    for (const snapshotEntry of entries.values()) {
      const entry = await this._getOrCreateModifiedFileEntry(snapshotEntry.resource, snapshotEntry.telemetryInfo);
      const restoreToDisk = snapshotEntry.state === WorkingSetEntryState.Modified || restoreResolvedToDisk;
      entry.restoreFromSnapshot(snapshotEntry, restoreToDisk);
      entriesArr.push(entry);
    }
    this._entriesObs.set(entriesArr, tx);
  }
  remove(reason, ...uris) {
    this._assertNotDisposed();
    let didRemoveUris = false;
    for (const uri of uris) {
      const entry = this._entriesObs.get().find((e) => isEqual(e.modifiedURI, uri));
      if (entry) {
        entry.dispose();
        const newEntries = this._entriesObs.get().filter((e) => !isEqual(e.modifiedURI, uri));
        this._entriesObs.set(newEntries, void 0);
        didRemoveUris = true;
      }
      const state = this._workingSet.get(uri);
      if (state !== void 0) {
        didRemoveUris = this._workingSet.delete(uri) || didRemoveUris;
      }
    }
    if (!didRemoveUris) {
      return;
    }
    this._onDidChange.fire(ChatEditingSessionChangeType.WorkingSet);
  }
  _assertNotDisposed() {
    if (this._state.get() === ChatEditingSessionState.Disposed) {
      throw new BugIndicatingError(`Cannot access a disposed editing session`);
    }
  }
  async accept(...uris) {
    this._assertNotDisposed();
    await asyncTransaction(async (tx) => {
      if (uris.length === 0) {
        await Promise.all(this._entriesObs.get().map((entry) => entry.accept(tx)));
      }
      for (const uri of uris) {
        const entry = this._entriesObs.get().find((e) => isEqual(e.modifiedURI, uri));
        if (entry) {
          await entry.accept(tx);
        }
      }
    });
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsKept, { allowManyInParallel: true });
    this._onDidChange.fire(ChatEditingSessionChangeType.Other);
  }
  async reject(...uris) {
    this._assertNotDisposed();
    await asyncTransaction(async (tx) => {
      if (uris.length === 0) {
        await Promise.all(this._entriesObs.get().map((entry) => entry.reject(tx)));
      }
      for (const uri of uris) {
        const entry = this._entriesObs.get().find((e) => isEqual(e.modifiedURI, uri));
        if (entry) {
          await entry.reject(tx);
        }
      }
    });
    this._accessibilitySignalService.playSignal(AccessibilitySignal.editsUndone, { allowManyInParallel: true });
    this._onDidChange.fire(ChatEditingSessionChangeType.Other);
  }
  async show() {
    this._assertNotDisposed();
    if (this._editorPane) {
      if (this._editorPane.isVisible()) {
        return;
      } else if (this._editorPane.input) {
        await this._editorGroupsService.activeGroup.openEditor(this._editorPane.input, { pinned: true, activation: EditorActivation.ACTIVATE });
        return;
      }
    }
    const input = MultiDiffEditorInput.fromResourceMultiDiffEditorInput({
      multiDiffSource: getMultiDiffSourceUri(this),
      label: localize("multiDiffEditorInput.name", "Suggested Edits")
    }, this._instantiationService);
    this._editorPane = await this._editorGroupsService.activeGroup.openEditor(input, { pinned: true, activation: EditorActivation.ACTIVATE });
  }
  async stop(clearState = false) {
    this._stopPromise ??= Promise.allSettled([this._performStop(), this.storeState()]).then(() => {
    });
    await this._stopPromise;
    if (clearState) {
      await this._instantiationService.createInstance(ChatEditingSessionStorage, this.chatSessionId).clearState();
    }
  }
  async _performStop() {
    const schemes = [AbstractChatEditingModifiedFileEntry.scheme, ChatEditingTextModelContentProvider.scheme];
    await Promise.allSettled(this._editorGroupsService.groups.flatMap(async (g) => {
      return g.editors.map(async (e) => {
        if (e instanceof MultiDiffEditorInput && e.initialResources?.some((r) => r.originalUri && schemes.indexOf(r.originalUri.scheme) !== -1) || e instanceof DiffEditorInput && e.original.resource && schemes.indexOf(e.original.resource.scheme) !== -1) {
          await g.closeEditor(e);
        }
      });
    }));
  }
  dispose() {
    this._assertNotDisposed();
    this._chatService.cancelCurrentRequestForSession(this.chatSessionId);
    dispose(this._entriesObs.get());
    super.dispose();
    this._state.set(ChatEditingSessionState.Disposed, void 0);
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
  }
  get isDisposed() {
    return this._state.get() === ChatEditingSessionState.Disposed;
  }
  startStreamingEdits(resource, responseModel, inUndoStop) {
    const completePromise = new DeferredPromise();
    const startPromise = new DeferredPromise();
    const sequencer = new ThrottledSequencer(15, 1e3);
    sequencer.queue(() => startPromise.p);
    this._streamingEditLocks.queue(resource.toString(), async () => {
      if (!this.isDisposed) {
        await this._acceptStreamingEditsStart(responseModel, inUndoStop, resource);
      }
      startPromise.complete();
      return completePromise.p;
    });
    let didComplete = false;
    return {
      pushText: (edits) => {
        sequencer.queue(async () => {
          if (!this.isDisposed) {
            await this._acceptEdits(resource, edits, false, responseModel);
          }
        });
      },
      pushNotebookCellText: (cell, edits) => {
        sequencer.queue(async () => {
          if (!this.isDisposed) {
            await this._acceptEdits(cell, edits, false, responseModel);
          }
        });
      },
      pushNotebook: (edits) => {
        sequencer.queue(async () => {
          if (!this.isDisposed) {
            await this._acceptEdits(resource, edits, false, responseModel);
          }
        });
      },
      complete: () => {
        if (didComplete) {
          return;
        }
        didComplete = true;
        sequencer.queue(async () => {
          if (!this.isDisposed) {
            await this._acceptEdits(resource, [], true, responseModel);
            await this._resolve(responseModel.requestId, inUndoStop, resource);
            completePromise.complete();
          }
        });
      }
    };
  }
  _getHistoryEntryByLinearIndex(index) {
    const history = this._linearHistory.get();
    const searchedIndex = binarySearch2(history.length, (e) => history[e].startIndex - index);
    const entry = history[searchedIndex < 0 ? ~searchedIndex - 1 : searchedIndex];
    if (!entry || index - entry.startIndex >= entry.stops.length) {
      return void 0;
    }
    return {
      entry,
      stop: entry.stops[index - entry.startIndex]
    };
  }
  async undoInteraction() {
    const newIndex = this._linearHistoryIndex.get() - 1;
    const previousSnapshot = this._getHistoryEntryByLinearIndex(newIndex);
    if (!previousSnapshot) {
      return;
    }
    this._ensurePendingSnapshot();
    await asyncTransaction(async (tx) => {
      await this._restoreSnapshot(previousSnapshot.stop, tx);
      this._linearHistoryIndex.set(newIndex, tx);
    });
    this._updateRequestHiddenState();
  }
  async redoInteraction() {
    const maxIndex = getMaxHistoryIndex(this._linearHistory.get());
    const newIndex = this._linearHistoryIndex.get() + 1;
    if (newIndex > maxIndex) {
      return;
    }
    const nextSnapshot = newIndex === maxIndex ? this._pendingSnapshot : this._getHistoryEntryByLinearIndex(newIndex)?.stop;
    if (!nextSnapshot) {
      return;
    }
    await asyncTransaction(async (tx) => {
      await this._restoreSnapshot(nextSnapshot, tx);
      this._linearHistoryIndex.set(newIndex, tx);
    });
    this._updateRequestHiddenState();
  }
  _updateRequestHiddenState() {
    const history = this._linearHistory.get();
    const index = this._linearHistoryIndex.get();
    const undoRequests = [];
    for (const entry of history) {
      if (!entry.requestId) {
      } else if (entry.startIndex >= index) {
        undoRequests.push({ requestId: entry.requestId });
      } else if (entry.startIndex + entry.stops.length > index) {
        undoRequests.push({ requestId: entry.requestId, afterUndoStop: entry.stops[index - entry.startIndex].stopId });
      }
    }
    this._chatService.getSession(this.chatSessionId)?.setDisabledRequests(undoRequests);
  }
  async _acceptStreamingEditsStart(responseModel, undoStop, resource) {
    const entry = await this._getOrCreateModifiedFileEntry(resource, this._getTelemetryInfoForModel(responseModel));
    transaction((tx) => {
      this._state.set(ChatEditingSessionState.StreamingEdits, tx);
      entry.acceptStreamingEditsStart(responseModel, tx);
      this.ensureEditInUndoStopMatches(responseModel.requestId, undoStop, entry, false, tx);
    });
  }
  /**
   * Ensures the state of the file in the given snapshot matches the current
   * state of the {@param entry}. This is used to handle concurrent file edits.
   *
   * Given the case of two different edits, we will place and undo stop right
   * before we `textEditGroup` in the underlying markdown stream, but at the
   * time those are added the edits haven't been made yet, so both files will
   * simply have the unmodified state.
   *
   * This method is called after each edit, so after the first file finishes
   * being edits, it will update its content in the second undo snapshot such
   * that it can be undone successfully.
   *
   * We ensure that the same file is not concurrently edited via the
   * {@link _streamingEditLocks}, avoiding race conditions.
   *
   * @param next If true, this will edit the snapshot _after_ the undo stop
   */
  ensureEditInUndoStopMatches(requestId, undoStop, entry, next, tx) {
    const history = this._linearHistory.get();
    const snapIndex = history.findIndex((s) => s.requestId === requestId);
    if (snapIndex === -1) {
      return;
    }
    const snap = history[snapIndex];
    let stopIndex = snap.stops.findIndex((s) => s.stopId === undoStop);
    if (stopIndex === -1) {
      return;
    }
    if (next) {
      if (stopIndex === snap.stops.length - 1) {
        const postEdit = new ResourceMap(snap.postEdit || this._createSnapshot(void 0, void 0).entries);
        if (!snap.postEdit || !entry.equalsSnapshot(postEdit.get(entry.modifiedURI))) {
          postEdit.set(entry.modifiedURI, entry.createSnapshot(requestId, POST_EDIT_STOP_ID));
          const newHistory2 = history.slice();
          newHistory2[snapIndex] = { ...snap, postEdit };
          this._linearHistory.set(newHistory2, tx);
        }
        return;
      }
      stopIndex++;
    }
    const stop = snap.stops[stopIndex];
    if (entry.equalsSnapshot(stop.entries.get(entry.modifiedURI))) {
      return;
    }
    const newMap = new ResourceMap(stop.entries);
    newMap.set(entry.modifiedURI, entry.createSnapshot(requestId, stop.stopId));
    const newStop = snap.stops.slice();
    newStop[stopIndex] = { ...stop, entries: newMap };
    const newHistory = history.slice();
    newHistory[snapIndex] = { ...snap, stops: newStop };
    this._linearHistory.set(newHistory, tx);
  }
  async _acceptEdits(resource, textEdits, isLastEdits, responseModel) {
    const entry = await this._getOrCreateModifiedFileEntry(resource, this._getTelemetryInfoForModel(responseModel));
    await entry.acceptAgentEdits(resource, textEdits, isLastEdits, responseModel);
  }
  _getTelemetryInfoForModel(responseModel) {
    return new class {
      get agentId() {
        return responseModel.agent?.id;
      }
      get command() {
        return responseModel.slashCommand?.name;
      }
      get sessionId() {
        return responseModel.session.sessionId;
      }
      get requestId() {
        return responseModel.requestId;
      }
      get result() {
        return responseModel.result;
      }
    }();
  }
  async _resolve(requestId, undoStop, resource) {
    await asyncTransaction(async (tx) => {
      const hasOtherTasks = Iterable.some(this._streamingEditLocks.keys(), (k) => k !== resource.toString());
      if (!hasOtherTasks) {
        this._state.set(ChatEditingSessionState.Idle, tx);
      }
      const entry = this._getEntry(resource);
      if (!entry) {
        return;
      }
      this.ensureEditInUndoStopMatches(
        requestId,
        undoStop,
        entry,
        /* next= */
        true,
        tx
      );
      return entry.acceptStreamingEditsEnd(tx);
    });
    this._onDidChange.fire(ChatEditingSessionChangeType.Other);
  }
  /**
   * Retrieves or creates a modified file entry.
   *
   * @returns The modified file entry.
   */
  async _getOrCreateModifiedFileEntry(resource, telemetryInfo) {
    resource = CellUri.parse(resource)?.notebook ?? resource;
    const existingEntry = this._entriesObs.get().find((e) => isEqual(e.modifiedURI, resource));
    if (existingEntry) {
      if (telemetryInfo.requestId !== existingEntry.telemetryInfo.requestId) {
        existingEntry.updateTelemetryInfo(telemetryInfo);
      }
      return existingEntry;
    }
    let entry;
    const existingExternalEntry = this._lookupExternalEntry(resource);
    if (existingExternalEntry) {
      entry = existingExternalEntry;
    } else {
      const initialContent = this._initialFileContents.get(resource);
      entry = await this._createModifiedFileEntry(resource, telemetryInfo, false, initialContent);
      if (!initialContent) {
        this._initialFileContents.set(resource, entry.initialContent);
      }
    }
    const listener = entry.onDidDelete(() => {
      const newEntries = this._entriesObs.get().filter((e) => !isEqual(e.modifiedURI, entry.modifiedURI));
      this._entriesObs.set(newEntries, void 0);
      this._workingSet.delete(entry.modifiedURI);
      this._editorService.closeEditors(this._editorService.findEditors(entry.modifiedURI));
      if (!existingExternalEntry) {
        entry.dispose();
      }
      this._store.delete(listener);
      this._onDidChange.fire(ChatEditingSessionChangeType.WorkingSet);
    });
    this._store.add(listener);
    const entriesArr = [...this._entriesObs.get(), entry];
    this._entriesObs.set(entriesArr, void 0);
    this._onDidChange.fire(ChatEditingSessionChangeType.WorkingSet);
    return entry;
  }
  async _createModifiedFileEntry(resource, telemetryInfo, mustExist = false, initialContent) {
    const multiDiffEntryDelegate = { collapse: (transaction2) => this._collapse(resource, transaction2) };
    const chatKind = mustExist ? ChatEditKind.Created : ChatEditKind.Modified;
    const notebookUri = CellUri.parse(resource)?.notebook || resource;
    try {
      if (this._notebookService.hasSupportedNotebooks(notebookUri) && (this._notebookService.getNotebookTextModel(notebookUri) || ChatEditingModifiedNotebookEntry.canHandleSnapshotContent(initialContent))) {
        return await ChatEditingModifiedNotebookEntry.create(notebookUri, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent, this._instantiationService);
      } else {
        const ref = await this._textModelService.createModelReference(resource);
        return this._instantiationService.createInstance(ChatEditingModifiedDocumentEntry, ref, multiDiffEntryDelegate, telemetryInfo, chatKind, initialContent);
      }
    } catch (err) {
      if (mustExist) {
        throw err;
      }
      await this._bulkEditService.apply({ edits: [{ newResource: resource }] });
      this._editorService.openEditor({ resource, options: { inactive: true, preserveFocus: true, pinned: true } });
      if (this._notebookService.hasSupportedNotebooks(notebookUri)) {
        return await ChatEditingModifiedNotebookEntry.create(resource, multiDiffEntryDelegate, telemetryInfo, ChatEditKind.Created, initialContent, this._instantiationService);
      } else {
        return this._createModifiedFileEntry(resource, telemetryInfo, true, initialContent);
      }
    }
  }
  _collapse(resource, transaction2) {
    const multiDiffItem = this._editorPane?.findDocumentDiffItem(resource);
    if (multiDiffItem) {
      this._editorPane?.viewModel?.items.get().find((documentDiffItem) => isEqual(documentDiffItem.originalUri, multiDiffItem.originalUri) && isEqual(documentDiffItem.modifiedUri, multiDiffItem.modifiedUri))?.collapsed.set(true, transaction2);
    }
  }
};
ChatEditingSession = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IBulkEditService),
  __decorateParam(8, IEditorGroupsService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IChatService),
  __decorateParam(11, INotebookService),
  __decorateParam(12, IEditorWorkerService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IAccessibilitySignalService)
], ChatEditingSession);
let ChatEditingSessionStorage = class {
  constructor(chatSessionId, _fileService, _environmentService, _logService, _workspaceContextService) {
    this.chatSessionId = chatSessionId;
    this._fileService = _fileService;
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._workspaceContextService = _workspaceContextService;
  }
  _getStorageLocation() {
    const workspaceId = this._workspaceContextService.getWorkspace().id;
    return joinPath(this._environmentService.workspaceStorageHome, workspaceId, "chatEditingSessions", this.chatSessionId);
  }
  async restoreState() {
    const storageLocation = this._getStorageLocation();
    const fileContents = /* @__PURE__ */ new Map();
    const getFileContent = (hash) => {
      let readPromise = fileContents.get(hash);
      if (!readPromise) {
        readPromise = this._fileService.readFile(joinPath(storageLocation, STORAGE_CONTENTS_FOLDER, hash)).then((content) => content.value.toString());
        fileContents.set(hash, readPromise);
      }
      return readPromise;
    };
    const deserializeResourceMap = (resourceMap, deserialize, result) => {
      resourceMap.forEach(([resourceURI, value]) => {
        result.set(URI.parse(resourceURI), deserialize(value));
      });
      return result;
    };
    const deserializeSnapshotEntriesDTO = async (dtoEntries) => {
      const entries = new ResourceMap();
      for (const entryDTO of dtoEntries) {
        const entry = await deserializeSnapshotEntry(entryDTO);
        entries.set(entry.resource, entry);
      }
      return entries;
    };
    const deserializeChatEditingStopDTO = async (stopDTO) => {
      const entries = await deserializeSnapshotEntriesDTO(stopDTO.entries);
      const workingSet = deserializeResourceMap(stopDTO.workingSet, (value) => value, new ResourceMap());
      return { stopId: "stopId" in stopDTO ? stopDTO.stopId : void 0, workingSet, entries };
    };
    const normalizeSnapshotDtos = (snapshot) => {
      if ("stops" in snapshot) {
        return snapshot;
      }
      return { requestId: snapshot.requestId, stops: [{ stopId: void 0, entries: snapshot.entries, workingSet: snapshot.workingSet }], postEdit: void 0 };
    };
    const deserializeChatEditingSessionSnapshot = async (startIndex, snapshot) => {
      const stops = await Promise.all(snapshot.stops.map(deserializeChatEditingStopDTO));
      return { startIndex, requestId: snapshot.requestId, stops, postEdit: snapshot.postEdit && await deserializeSnapshotEntriesDTO(snapshot.postEdit) };
    };
    const deserializeSnapshotEntry = async (entry) => {
      return {
        resource: URI.parse(entry.resource),
        languageId: entry.languageId,
        original: await getFileContent(entry.originalHash),
        current: await getFileContent(entry.currentHash),
        originalToCurrentEdit: OffsetEdit.fromJson(entry.originalToCurrentEdit),
        state: entry.state,
        snapshotUri: URI.parse(entry.snapshotUri),
        telemetryInfo: { requestId: entry.telemetryInfo.requestId, agentId: entry.telemetryInfo.agentId, command: entry.telemetryInfo.command, sessionId: this.chatSessionId, result: void 0 }
      };
    };
    try {
      const stateFilePath = joinPath(storageLocation, STORAGE_STATE_FILE);
      if (!await this._fileService.exists(stateFilePath)) {
        this._logService.debug(`chatEditingSession: No editing session state found at ${stateFilePath.toString()}`);
        return void 0;
      }
      this._logService.debug(`chatEditingSession: Restoring editing session at ${stateFilePath.toString()}`);
      const stateFileContent = await this._fileService.readFile(stateFilePath);
      const data = JSON.parse(stateFileContent.value.toString());
      if (!COMPATIBLE_STORAGE_VERSIONS.includes(data.version)) {
        return void 0;
      }
      let linearHistoryIndex = 0;
      const linearHistory = await Promise.all(data.linearHistory.map((snapshot) => {
        const norm = normalizeSnapshotDtos(snapshot);
        const result = deserializeChatEditingSessionSnapshot(linearHistoryIndex, norm);
        linearHistoryIndex += norm.stops.length;
        return result;
      }));
      const initialFileContents = new ResourceMap();
      for (const fileContentDTO of data.initialFileContents) {
        initialFileContents.set(URI.parse(fileContentDTO[0]), await getFileContent(fileContentDTO[1]));
      }
      const pendingSnapshot = data.pendingSnapshot ? await deserializeChatEditingStopDTO(data.pendingSnapshot) : void 0;
      const recentSnapshot = await deserializeChatEditingStopDTO(data.recentSnapshot);
      return {
        initialFileContents,
        pendingSnapshot,
        recentSnapshot,
        linearHistoryIndex: data.linearHistoryIndex,
        linearHistory
      };
    } catch (e) {
      this._logService.error(`Error restoring chat editing session from ${storageLocation.toString()}`, e);
    }
    return void 0;
  }
  async storeState(state) {
    const storageFolder = this._getStorageLocation();
    const contentsFolder = URI.joinPath(storageFolder, STORAGE_CONTENTS_FOLDER);
    const existingContents = /* @__PURE__ */ new Set();
    try {
      const stat = await this._fileService.resolve(contentsFolder);
      stat.children?.forEach((child) => {
        if (child.isFile) {
          existingContents.add(child.name);
        }
      });
    } catch (e) {
      try {
        await this._fileService.createFolder(contentsFolder);
      } catch (e2) {
        this._logService.error(`Error creating chat editing session content folder ${contentsFolder.toString()}`, e2);
        return;
      }
    }
    const fileContents = /* @__PURE__ */ new Map();
    const addFileContent = (content) => {
      const shaComputer = new StringSHA1();
      shaComputer.update(content);
      const sha = shaComputer.digest().substring(0, 7);
      fileContents.set(sha, content);
      return sha;
    };
    const serializeResourceMap = (resourceMap, serialize) => {
      return Array.from(resourceMap.entries()).map(([resourceURI, value]) => [resourceURI.toString(), serialize(value)]);
    };
    const serializeChatEditingSessionStop = (stop) => {
      return {
        stopId: stop.stopId,
        workingSet: serializeResourceMap(stop.workingSet, (value) => value),
        entries: Array.from(stop.entries.values()).map(serializeSnapshotEntry)
      };
    };
    const serializeChatEditingSessionSnapshot = (snapshot) => {
      return {
        requestId: snapshot.requestId,
        stops: snapshot.stops.map(serializeChatEditingSessionStop),
        postEdit: snapshot.postEdit ? Array.from(snapshot.postEdit.values()).map(serializeSnapshotEntry) : void 0
      };
    };
    const serializeSnapshotEntry = (entry) => {
      return {
        resource: entry.resource.toString(),
        languageId: entry.languageId,
        originalHash: addFileContent(entry.original),
        currentHash: addFileContent(entry.current),
        originalToCurrentEdit: entry.originalToCurrentEdit.edits.map((edit) => ({ pos: edit.replaceRange.start, len: edit.replaceRange.length, txt: edit.newText })),
        state: entry.state,
        snapshotUri: entry.snapshotUri.toString(),
        telemetryInfo: { requestId: entry.telemetryInfo.requestId, agentId: entry.telemetryInfo.agentId, command: entry.telemetryInfo.command }
      };
    };
    try {
      const data = {
        version: STORAGE_VERSION,
        sessionId: this.chatSessionId,
        linearHistory: state.linearHistory.map(serializeChatEditingSessionSnapshot),
        linearHistoryIndex: state.linearHistoryIndex,
        initialFileContents: serializeResourceMap(state.initialFileContents, (value) => addFileContent(value)),
        pendingSnapshot: state.pendingSnapshot ? serializeChatEditingSessionStop(state.pendingSnapshot) : void 0,
        recentSnapshot: serializeChatEditingSessionStop(state.recentSnapshot)
      };
      this._logService.debug(`chatEditingSession: Storing editing session at ${storageFolder.toString()}: ${fileContents.size} files`);
      for (const [hash, content] of fileContents) {
        if (!existingContents.has(hash)) {
          await this._fileService.writeFile(joinPath(contentsFolder, hash), VSBuffer.fromString(content));
        }
      }
      await this._fileService.writeFile(joinPath(storageFolder, STORAGE_STATE_FILE), VSBuffer.fromString(JSON.stringify(data, void 0, 2)));
    } catch (e) {
      this._logService.debug(`Error storing chat editing session to ${storageFolder.toString()}`, e);
    }
  }
  async clearState() {
    const storageFolder = this._getStorageLocation();
    if (await this._fileService.exists(storageFolder)) {
      this._logService.debug(`chatEditingSession: Clearing editing session at ${storageFolder.toString()}`);
      try {
        await this._fileService.del(storageFolder, { recursive: true });
      } catch (e) {
        this._logService.debug(`Error clearing chat editing session from ${storageFolder.toString()}`, e);
      }
    }
  }
};
ChatEditingSessionStorage = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IEnvironmentService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IWorkspaceContextService)
], ChatEditingSessionStorage);
const COMPATIBLE_STORAGE_VERSIONS = [1, 2];
const STORAGE_VERSION = 2;
export {
  ChatEditingSession
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdTZXNzaW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXF1YWxzIGFzIGFycmF5c0VxdWFsLCBiaW5hcnlTZWFyY2gyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgSVRhc2ssIFNlcXVlbmNlciwgU2VxdWVuY2VyQnlLZXksIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFN0cmluZ1NIQTEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBhc3luY1RyYW5zYWN0aW9uLCBhdXRvcnVuLCBkZXJpdmVkLCBkZXJpdmVkT3B0cywgZGVyaXZlZFdpdGhTdG9yZSwgSU9ic2VydmFibGUsIElSZWFkZXIsIElUcmFuc2FjdGlvbiwgT2JzZXJ2YWJsZVByb21pc2UsIG9ic2VydmFibGVWYWx1ZSwgdHJhbnNhY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGlzRXF1YWwsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQnVsa0VkaXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPZmZzZXRFZGl0LCBJU2luZ2xlT2Zmc2V0RWRpdCwgT2Zmc2V0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9vZmZzZXRFZGl0LmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGl2YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb2JzZXJ2YWJsZS9jb21tb24vcGxhdGZvcm1PYnNlcnZhYmxlVXRpbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTXVsdGlEaWZmRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vbXVsdGlEaWZmRWRpdG9yL2Jyb3dzZXIvbXVsdGlEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IE11bHRpRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vbXVsdGlEaWZmRWRpdG9yL2Jyb3dzZXIvbXVsdGlEaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZSwgQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUsIENoYXRFZGl0S2luZCwgZ2V0TXVsdGlEaWZmU291cmNlVXJpLCBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBJRWRpdFNlc3Npb25FbnRyeURpZmYsIElNb2RpZmllZEZpbGVFbnRyeSwgSVN0cmVhbWluZ0VkaXRzLCBXb3JraW5nU2V0RGlzcGxheU1ldGFkYXRhLCBXb3JraW5nU2V0RW50cnlSZW1vdmFsUmVhc29uLCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQsIElDaGF0UmVzcG9uc2VNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFic3RyYWN0Q2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeSwgSU1vZGlmaWVkRW50cnlUZWxlbWV0cnlJbmZvLCBJU25hcHNob3RFbnRyeSB9IGZyb20gJy4vY2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ01vZGlmaWVkRG9jdW1lbnRFbnRyeSB9IGZyb20gJy4vY2hhdEVkaXRpbmdNb2RpZmllZERvY3VtZW50RW50cnkuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIgfSBmcm9tICcuL2NoYXRFZGl0aW5nVGV4dE1vZGVsQ29udGVudFByb3ZpZGVycy5qcyc7XG5pbXBvcnQgeyBDZWxsVXJpLCBJQ2VsbEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnkgfSBmcm9tICcuL2NoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0RpZmYgfSBmcm9tICcuL25vdGVib29rL2NoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0RpZmYuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcblxuY29uc3QgU1RPUkFHRV9DT05URU5UU19GT0xERVIgPSAnY29udGVudHMnO1xuY29uc3QgU1RPUkFHRV9TVEFURV9GSUxFID0gJ3N0YXRlLmpzb24nO1xuY29uc3QgUE9TVF9FRElUX1NUT1BfSUQgPSAnZDE5OTQ0ZjYtZjQ2Yy00ZTE3LTkxMWItNzlhOGU4NDNjN2MwJzsgLy8gcmFuZG9tbHkgZ2VuZXJhdGVkXG5cbmNsYXNzIFRocm90dGxlZFNlcXVlbmNlciBleHRlbmRzIFNlcXVlbmNlciB7XG5cblx0cHJpdmF0ZSBfc2l6ZSA9IDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWluRHVyYXRpb246IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXhPdmVyYWxsRGVsYXk6IG51bWJlclxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcXVldWU8VD4ocHJvbWlzZVRhc2s6IElUYXNrPFByb21pc2U8VD4+KTogUHJvbWlzZTxUPiB7XG5cblx0XHR0aGlzLl9zaXplICs9IDE7XG5cblx0XHRjb25zdCBub0RlbGF5ID0gdGhpcy5fc2l6ZSAqIHRoaXMuX21pbkR1cmF0aW9uID4gdGhpcy5fbWF4T3ZlcmFsbERlbGF5O1xuXG5cdFx0cmV0dXJuIHN1cGVyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHAxID0gcHJvbWlzZVRhc2soKTtcblx0XHRcdFx0Y29uc3QgcDIgPSBub0RlbGF5XG5cdFx0XHRcdFx0PyBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKVxuXHRcdFx0XHRcdDogdGltZW91dCh0aGlzLl9taW5EdXJhdGlvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRcdFx0Y29uc3QgW3Jlc3VsdF0gPSBhd2FpdCBQcm9taXNlLmFsbChbcDEsIHAyXSk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX3NpemUgLT0gMTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRNYXhIaXN0b3J5SW5kZXgoaGlzdG9yeTogcmVhZG9ubHkgSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90W10pIHtcblx0Y29uc3QgbGFzdEhpc3RvcnkgPSBoaXN0b3J5LmF0KC0xKTtcblx0cmV0dXJuIGxhc3RIaXN0b3J5ID8gbGFzdEhpc3Rvcnkuc3RhcnRJbmRleCArIGxhc3RIaXN0b3J5LnN0b3BzLmxlbmd0aCA6IDA7XG59XG5cbmZ1bmN0aW9uIHNuYXBzaG90c0VxdWFsRm9yRGlmZihhOiBJU25hcHNob3RFbnRyeSB8IHVuZGVmaW5lZCwgYjogSVNuYXBzaG90RW50cnkgfCB1bmRlZmluZWQpIHtcblx0aWYgKCFhIHx8ICFiKSB7XG5cdFx0cmV0dXJuIGEgPT09IGI7XG5cdH1cblxuXHRyZXR1cm4gaXNFcXVhbChhLnNuYXBzaG90VXJpLCBiLnNuYXBzaG90VXJpKSAmJiBhLmN1cnJlbnQgPT09IGIuY3VycmVudDtcbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudEFuZE5leHRTdG9wKHJlcXVlc3RJZDogc3RyaW5nLCBzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgaGlzdG9yeTogcmVhZG9ubHkgSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90W10pIHtcblx0Y29uc3Qgc25hcHNob3RJbmRleCA9IGhpc3RvcnkuZmluZEluZGV4KHMgPT4gcy5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCk7XG5cdGlmIChzbmFwc2hvdEluZGV4ID09PSAtMSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGNvbnN0IHNuYXBzaG90ID0gaGlzdG9yeVtzbmFwc2hvdEluZGV4XTtcblx0Y29uc3Qgc3RvcEluZGV4ID0gc25hcHNob3Quc3RvcHMuZmluZEluZGV4KHMgPT4gcy5zdG9wSWQgPT09IHN0b3BJZCk7XG5cdGlmIChzdG9wSW5kZXggPT09IC0xKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRjb25zdCBjdXJyZW50ID0gc25hcHNob3Quc3RvcHNbc3RvcEluZGV4XS5lbnRyaWVzO1xuXHRjb25zdCBuZXh0ID0gc3RvcEluZGV4IDwgc25hcHNob3Quc3RvcHMubGVuZ3RoIC0gMVxuXHRcdD8gc25hcHNob3Quc3RvcHNbc3RvcEluZGV4ICsgMV0uZW50cmllc1xuXHRcdDogc25hcHNob3QucG9zdEVkaXQgfHwgaGlzdG9yeVtzbmFwc2hvdEluZGV4ICsgMV0/LnN0b3BzWzBdLmVudHJpZXM7XG5cblxuXHRpZiAoIW5leHQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmV0dXJuIHsgY3VycmVudCwgbmV4dCB9O1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdTZXNzaW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDaGF0RWRpdGluZ1Nlc3Npb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlID0gb2JzZXJ2YWJsZVZhbHVlPENoYXRFZGl0aW5nU2Vzc2lvblN0YXRlPih0aGlzLCBDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZS5Jbml0aWFsKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGluZWFySGlzdG9yeSA9IG9ic2VydmFibGVWYWx1ZTxyZWFkb25seSBJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3RbXT4odGhpcywgW10pO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saW5lYXJIaXN0b3J5SW5kZXggPSBvYnNlcnZhYmxlVmFsdWU8bnVtYmVyPih0aGlzLCAwKTtcblxuXHQvKipcblx0ICogQ29udGFpbnMgdGhlIGNvbnRlbnRzIG9mIGEgZmlsZSB3aGVuIHRoZSBBSSBmaXJzdCBiZWdhbiBkb2luZyBlZGl0cyB0byBpdC5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX2luaXRpYWxGaWxlQ29udGVudHMgPSBuZXcgUmVzb3VyY2VNYXA8c3RyaW5nPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VudHJpZXNPYnMgPSBvYnNlcnZhYmxlVmFsdWU8cmVhZG9ubHkgQWJzdHJhY3RDaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5W10+KHRoaXMsIFtdKTtcblx0cHVibGljIGdldCBlbnRyaWVzKCk6IElPYnNlcnZhYmxlPHJlYWRvbmx5IElNb2RpZmllZEZpbGVFbnRyeVtdPiB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fZW50cmllc09icztcblx0fVxuXG5cdHByaXZhdGUgX3dvcmtpbmdTZXQgPSBuZXcgUmVzb3VyY2VNYXA8V29ya2luZ1NldERpc3BsYXlNZXRhZGF0YT4oKTtcblxuXHRwcml2YXRlIF9lZGl0b3JQYW5lOiBNdWx0aURpZmZFZGl0b3IgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IHN0YXRlKCk6IElPYnNlcnZhYmxlPENoYXRFZGl0aW5nU2Vzc2lvblN0YXRlPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IGNhblVuZG8gPSBkZXJpdmVkPGJvb2xlYW4+KChyKSA9PiB7XG5cdFx0aWYgKHRoaXMuc3RhdGUucmVhZChyKSAhPT0gQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuSWRsZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lYXJIaXN0b3J5SW5kZXggPSB0aGlzLl9saW5lYXJIaXN0b3J5SW5kZXgucmVhZChyKTtcblx0XHRyZXR1cm4gbGluZWFySGlzdG9yeUluZGV4ID4gMDtcblx0fSk7XG5cblx0cHVibGljIHJlYWRvbmx5IGNhblJlZG8gPSBkZXJpdmVkPGJvb2xlYW4+KChyKSA9PiB7XG5cdFx0aWYgKHRoaXMuc3RhdGUucmVhZChyKSAhPT0gQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuSWRsZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBsaW5lYXJIaXN0b3J5SW5kZXggPSB0aGlzLl9saW5lYXJIaXN0b3J5SW5kZXgucmVhZChyKTtcblx0XHRyZXR1cm4gbGluZWFySGlzdG9yeUluZGV4IDwgZ2V0TWF4SGlzdG9yeUluZGV4KHRoaXMuX2xpbmVhckhpc3RvcnkucmVhZChyKSk7XG5cdH0pO1xuXG5cdC8vIHB1YmxpYyBoaWRkZW5SZXF1ZXN0SWRzID0gZGVyaXZlZDxzdHJpbmdbXT4oKHIpID0+IHtcblx0Ly8gXHRjb25zdCBsaW5lYXJIaXN0b3J5ID0gdGhpcy5fbGluZWFySGlzdG9yeS5yZWFkKHIpO1xuXHQvLyBcdGNvbnN0IGxpbmVhckhpc3RvcnlJbmRleCA9IHRoaXMuX2xpbmVhckhpc3RvcnlJbmRleC5yZWFkKHIpO1xuXHQvLyBcdHJldHVybiBsaW5lYXJIaXN0b3J5LnNsaWNlKGxpbmVhckhpc3RvcnlJbmRleCkubWFwKHMgPT4gcy5yZXF1ZXN0SWQpLmZpbHRlcigocik6IHIgaXMgc3RyaW5nID0+ICEhcik7XG5cdC8vIH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Q2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZT4oKSk7XG5cdGdldCBvbkRpZENoYW5nZSgpIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdGdldCBvbkRpZERpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWREaXNwb3NlLmV2ZW50O1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgY2hhdFNlc3Npb25JZDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGlzR2xvYmFsRWRpdGluZ1Nlc3Npb246IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSBfbG9va3VwRXh0ZXJuYWxFbnRyeTogKHVyaTogVVJJKSA9PiBBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnkgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJQnVsa0VkaXRTZXJ2aWNlIHB1YmxpYyByZWFkb25seSBfYnVsa0VkaXRTZXJ2aWNlOiBJQnVsa0VkaXRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JHcm91cHNTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDaGF0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBpbml0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc3RvcmVkU2Vzc2lvblN0YXRlID0gYXdhaXQgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZSwgdGhpcy5jaGF0U2Vzc2lvbklkKS5yZXN0b3JlU3RhdGUoKTtcblx0XHRpZiAocmVzdG9yZWRTZXNzaW9uU3RhdGUpIHtcblx0XHRcdGZvciAoY29uc3QgW3VyaSwgY29udGVudF0gb2YgcmVzdG9yZWRTZXNzaW9uU3RhdGUuaW5pdGlhbEZpbGVDb250ZW50cykge1xuXHRcdFx0XHR0aGlzLl9pbml0aWFsRmlsZUNvbnRlbnRzLnNldCh1cmksIGNvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgYXN5bmNUcmFuc2FjdGlvbihhc3luYyB0eCA9PiB7XG5cdFx0XHRcdHRoaXMuX3BlbmRpbmdTbmFwc2hvdCA9IHJlc3RvcmVkU2Vzc2lvblN0YXRlLnBlbmRpbmdTbmFwc2hvdDtcblx0XHRcdFx0YXdhaXQgdGhpcy5fcmVzdG9yZVNuYXBzaG90KHJlc3RvcmVkU2Vzc2lvblN0YXRlLnJlY2VudFNuYXBzaG90LCB0eCwgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl9saW5lYXJIaXN0b3J5LnNldChyZXN0b3JlZFNlc3Npb25TdGF0ZS5saW5lYXJIaXN0b3J5LCB0eCk7XG5cdFx0XHRcdHRoaXMuX2xpbmVhckhpc3RvcnlJbmRleC5zZXQocmVzdG9yZWRTZXNzaW9uU3RhdGUubGluZWFySGlzdG9yeUluZGV4LCB0eCk7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLnNldChDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZS5JZGxlLCB0eCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc3RhdGUuc2V0KENoYXRFZGl0aW5nU2Vzc2lvblN0YXRlLklkbGUsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IHRoaXMuZW50cmllcy5yZWFkKHJlYWRlcik7XG5cdFx0XHRlbnRyaWVzLmZvckVhY2goZW50cnkgPT4ge1xuXHRcdFx0XHRlbnRyeS5zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5Xb3JraW5nU2V0KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFbnRyeSh1cmk6IFVSSSk6IEFic3RyYWN0Q2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeSB8IHVuZGVmaW5lZCB7XG5cdFx0dXJpID0gQ2VsbFVyaS5wYXJzZSh1cmkpPy5ub3RlYm9vayA/PyB1cmk7XG5cdFx0cmV0dXJuIHRoaXMuX2VudHJpZXNPYnMuZ2V0KCkuZmluZChlID0+IGlzRXF1YWwoZS5tb2RpZmllZFVSSSwgdXJpKSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RW50cnkodXJpOiBVUkkpOiBJTW9kaWZpZWRGaWxlRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9nZXRFbnRyeSh1cmkpO1xuXHR9XG5cblx0cHVibGljIHJlYWRFbnRyeSh1cmk6IFVSSSwgcmVhZGVyOiBJUmVhZGVyIHwgdW5kZWZpbmVkKTogSU1vZGlmaWVkRmlsZUVudHJ5IHwgdW5kZWZpbmVkIHtcblx0XHR1cmkgPSBDZWxsVXJpLnBhcnNlKHVyaSk/Lm5vdGVib29rID8/IHVyaTtcblx0XHRyZXR1cm4gdGhpcy5fZW50cmllc09icy5yZWFkKHJlYWRlcikuZmluZChlID0+IGlzRXF1YWwoZS5tb2RpZmllZFVSSSwgdXJpKSk7XG5cdH1cblxuXHRwdWJsaWMgc3RvcmVTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdG9yYWdlID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZSwgdGhpcy5jaGF0U2Vzc2lvbklkKTtcblx0XHRjb25zdCBzdGF0ZTogU3RvcmVkU2Vzc2lvblN0YXRlID0ge1xuXHRcdFx0aW5pdGlhbEZpbGVDb250ZW50czogdGhpcy5faW5pdGlhbEZpbGVDb250ZW50cyxcblx0XHRcdHBlbmRpbmdTbmFwc2hvdDogdGhpcy5fcGVuZGluZ1NuYXBzaG90LFxuXHRcdFx0cmVjZW50U25hcHNob3Q6IHRoaXMuX2NyZWF0ZVNuYXBzaG90KHVuZGVmaW5lZCwgdW5kZWZpbmVkKSxcblx0XHRcdGxpbmVhckhpc3RvcnlJbmRleDogdGhpcy5fbGluZWFySGlzdG9yeUluZGV4LmdldCgpLFxuXHRcdFx0bGluZWFySGlzdG9yeTogdGhpcy5fbGluZWFySGlzdG9yeS5nZXQoKSxcblx0XHR9O1xuXHRcdHJldHVybiBzdG9yYWdlLnN0b3JlU3RhdGUoc3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZmluZFNuYXBzaG90KHJlcXVlc3RJZDogc3RyaW5nKTogSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGluZWFySGlzdG9yeS5nZXQoKS5maW5kKHMgPT4gcy5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCk7XG5cdH1cblxuXHRwcml2YXRlIF9maW5kRWRpdFN0b3AocmVxdWVzdElkOiBzdHJpbmcsIHVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBzbmFwc2hvdCA9IHRoaXMuX2ZpbmRTbmFwc2hvdChyZXF1ZXN0SWQpO1xuXHRcdGlmICghc25hcHNob3QpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGlkeCA9IHNuYXBzaG90LnN0b3BzLmZpbmRJbmRleChzID0+IHMuc3RvcElkID09PSB1bmRvU3RvcCk7XG5cdFx0cmV0dXJuIGlkeCA9PT0gLTEgPyB1bmRlZmluZWQgOiB7IHN0b3A6IHNuYXBzaG90LnN0b3BzW2lkeF0sIHNuYXBzaG90LCBoaXN0b3J5SW5kZXg6IHNuYXBzaG90LnN0YXJ0SW5kZXggKyBpZHggfTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZVBlbmRpbmdTbmFwc2hvdCgpIHtcblx0XHR0aGlzLl9wZW5kaW5nU25hcHNob3QgPz89IHRoaXMuX2NyZWF0ZVNuYXBzaG90KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgX2RpZmZzQmV0d2VlblN0b3BzID0gbmV3IE1hcDxzdHJpbmcsIElPYnNlcnZhYmxlPElFZGl0U2Vzc2lvbkVudHJ5RGlmZiB8IHVuZGVmaW5lZD4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaWdub3JlVHJpbVdoaXRlc3BhY2VPYnNlcnZhYmxlID0gb2JzZXJ2YWJsZUNvbmZpZ1ZhbHVlKCdkaWZmRWRpdG9yLmlnbm9yZVRyaW1XaGl0ZXNwYWNlJywgdHJ1ZSwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdC8qKlxuXHQgKiBHZXRzIGRpZmYgZm9yIHRleHQgZW50cmllcyBiZXR3ZWVuIHN0b3BzLlxuXHQgKiBAcGFyYW0gZW50cmllc0NvbnRlbnQgT2JzZXJ2YWJsZSB0aGF0IG9ic2VydmVzIGVpdGhlciBzbmFwc2hvdCBlbnRyeVxuXHQgKiBAcGFyYW0gbW9kZWxVcmlzT2JzZXJ2YWJsZSBPYnNlcnZhYmxlIHRoYXQgb2JzZXJ2ZXMgb25seSB0aGUgc25hcHNob3QgVVJJcy5cblx0ICovXG5cdHByaXZhdGUgX2VudHJ5RGlmZkJldHdlZW5UZXh0U3RvcHMoXG5cdFx0ZW50cmllc0NvbnRlbnQ6IElPYnNlcnZhYmxlPHsgYmVmb3JlOiBJU25hcHNob3RFbnRyeTsgYWZ0ZXI6IElTbmFwc2hvdEVudHJ5IH0gfCB1bmRlZmluZWQ+LFxuXHRcdG1vZGVsVXJpc09ic2VydmFibGU6IElPYnNlcnZhYmxlPFtVUkksIFVSSV0gfCB1bmRlZmluZWQ+LFxuXHQpOiBJT2JzZXJ2YWJsZTxPYnNlcnZhYmxlUHJvbWlzZTxJRWRpdFNlc3Npb25FbnRyeURpZmY+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgbW9kZWxSZWZzUHJvbWlzZSA9IGRlcml2ZWRXaXRoU3RvcmUodGhpcywgKHJlYWRlciwgc3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsVXJpcyA9IG1vZGVsVXJpc09ic2VydmFibGUucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFtb2RlbFVyaXMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0XHRjb25zdCBwcm9taXNlID0gUHJvbWlzZS5hbGwobW9kZWxVcmlzLm1hcCh1ID0+IHRoaXMuX3RleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UodSkpKS50aGVuKHJlZnMgPT4ge1xuXHRcdFx0XHRpZiAoc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdHJlZnMuZm9yRWFjaChyID0+IHIuZGlzcG9zZSgpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZWZzLmZvckVhY2gociA9PiBzdG9yZS5hZGQocikpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHJlZnM7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIG5ldyBPYnNlcnZhYmxlUHJvbWlzZShwcm9taXNlKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBkZXJpdmVkKChyZWFkZXIpOiBPYnNlcnZhYmxlUHJvbWlzZTxJRWRpdFNlc3Npb25FbnRyeURpZmY+IHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdGNvbnN0IHJlZnMgPSBtb2RlbFJlZnNQcm9taXNlLnJlYWQocmVhZGVyKT8ucHJvbWlzZVJlc3VsdC5yZWFkKHJlYWRlcik/LmRhdGE7XG5cdFx0XHRpZiAoIXJlZnMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlbnRyaWVzID0gZW50cmllc0NvbnRlbnQucmVhZChyZWFkZXIpOyAvLyB0cmlnZ2VyIHJlLWRpZmZpbmcgd2hlbiBjb250ZW50cyBjaGFuZ2VcblxuXHRcdFx0aWYgKGVudHJpZXM/LmJlZm9yZSAmJiBDaGF0RWRpdGluZ01vZGlmaWVkTm90ZWJvb2tFbnRyeS5jYW5IYW5kbGVTbmFwc2hvdChlbnRyaWVzLmJlZm9yZSkpIHtcblx0XHRcdFx0Y29uc3QgZGlmZlNlcnZpY2UgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ01vZGlmaWVkTm90ZWJvb2tEaWZmLCBlbnRyaWVzLmJlZm9yZSwgZW50cmllcy5hZnRlcik7XG5cdFx0XHRcdHJldHVybiBuZXcgT2JzZXJ2YWJsZVByb21pc2UoZGlmZlNlcnZpY2UuY29tcHV0ZURpZmYoKSk7XG5cblx0XHRcdH1cblx0XHRcdGNvbnN0IGlnbm9yZVRyaW1XaGl0ZXNwYWNlID0gdGhpcy5faWdub3JlVHJpbVdoaXRlc3BhY2VPYnNlcnZhYmxlLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IHByb21pc2UgPSB0aGlzLl9lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVEaWZmKFxuXHRcdFx0XHRyZWZzWzBdLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwudXJpLFxuXHRcdFx0XHRyZWZzWzFdLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwudXJpLFxuXHRcdFx0XHR7IGlnbm9yZVRyaW1XaGl0ZXNwYWNlLCBjb21wdXRlTW92ZXM6IGZhbHNlLCBtYXhDb21wdXRhdGlvblRpbWVNczogMzAwMCB9LFxuXHRcdFx0XHQnYWR2YW5jZWQnXG5cdFx0XHQpLnRoZW4oKGRpZmYpOiBJRWRpdFNlc3Npb25FbnRyeURpZmYgPT4ge1xuXHRcdFx0XHRjb25zdCBlbnRyeURpZmY6IElFZGl0U2Vzc2lvbkVudHJ5RGlmZiA9IHtcblx0XHRcdFx0XHRvcmlnaW5hbFVSSTogcmVmc1swXS5vYmplY3QudGV4dEVkaXRvck1vZGVsLnVyaSxcblx0XHRcdFx0XHRtb2RpZmllZFVSSTogcmVmc1sxXS5vYmplY3QudGV4dEVkaXRvck1vZGVsLnVyaSxcblx0XHRcdFx0XHRpZGVudGljYWw6ICEhZGlmZj8uaWRlbnRpY2FsLFxuXHRcdFx0XHRcdHF1aXRFYXJseTogIWRpZmYgfHwgZGlmZi5xdWl0RWFybHksXG5cdFx0XHRcdFx0YWRkZWQ6IDAsXG5cdFx0XHRcdFx0cmVtb3ZlZDogMCxcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKGRpZmYpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBkaWZmLmNoYW5nZXMpIHtcblx0XHRcdFx0XHRcdGVudHJ5RGlmZi5yZW1vdmVkICs9IGNoYW5nZS5vcmlnaW5hbC5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gY2hhbmdlLm9yaWdpbmFsLnN0YXJ0TGluZU51bWJlcjtcblx0XHRcdFx0XHRcdGVudHJ5RGlmZi5hZGRlZCArPSBjaGFuZ2UubW9kaWZpZWQuZW5kTGluZU51bWJlckV4Y2x1c2l2ZSAtIGNoYW5nZS5tb2RpZmllZC5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGVudHJ5RGlmZjtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gbmV3IE9ic2VydmFibGVQcm9taXNlKHByb21pc2UpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRGlmZkJldHdlZW5TdG9wc09ic2VydmFibGUodXJpOiBVUkksIHJlcXVlc3RJZDogc3RyaW5nLCBzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IElPYnNlcnZhYmxlPElFZGl0U2Vzc2lvbkVudHJ5RGlmZiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGVudHJpZXMgPSBkZXJpdmVkT3B0czx1bmRlZmluZWQgfCB7IGJlZm9yZTogSVNuYXBzaG90RW50cnk7IGFmdGVyOiBJU25hcHNob3RFbnRyeSB9Pihcblx0XHRcdHtcblx0XHRcdFx0ZXF1YWxzRm46IChhLCBiKSA9PiBzbmFwc2hvdHNFcXVhbEZvckRpZmYoYT8uYmVmb3JlLCBiPy5iZWZvcmUpICYmIHNuYXBzaG90c0VxdWFsRm9yRGlmZihhPy5hZnRlciwgYj8uYWZ0ZXIpLFxuXHRcdFx0fSxcblx0XHRcdHJlYWRlciA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0b3BzID0gZ2V0Q3VycmVudEFuZE5leHRTdG9wKHJlcXVlc3RJZCwgc3RvcElkLCB0aGlzLl9saW5lYXJIaXN0b3J5LnJlYWQocmVhZGVyKSk7XG5cdFx0XHRcdGlmICghc3RvcHMpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdFx0XHRjb25zdCBiZWZvcmUgPSBzdG9wcy5jdXJyZW50LmdldCh1cmkpO1xuXHRcdFx0XHRjb25zdCBhZnRlciA9IHN0b3BzLm5leHQuZ2V0KHVyaSk7XG5cdFx0XHRcdGlmICghYmVmb3JlIHx8ICFhZnRlcikgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0XHRcdHJldHVybiB7IGJlZm9yZSwgYWZ0ZXIgfTtcblx0XHRcdH0sXG5cdFx0KTtcblxuXHRcdC8vIFNlcGFyYXRlIG9ic2VydmFibGUgZm9yIG1vZGVsIHJlZnMgdG8gYXZvaWQgdW5uZWNlc3NhcnkgZGlzcG9zYWxcblx0XHRjb25zdCBtb2RlbFVyaXNPYnNlcnZhYmxlID0gZGVyaXZlZE9wdHM8W1VSSSwgVVJJXSB8IHVuZGVmaW5lZD4oeyBlcXVhbHNGbjogKGEsIGIpID0+IGFycmF5c0VxdWFsKGEsIGIsIGlzRXF1YWwpIH0sIHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBlbnRyaWVzVmFsdWUgPSBlbnRyaWVzLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghZW50cmllc1ZhbHVlKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRcdHJldHVybiBbZW50cmllc1ZhbHVlLmJlZm9yZS5zbmFwc2hvdFVyaSwgZW50cmllc1ZhbHVlLmFmdGVyLnNuYXBzaG90VXJpXTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmYgPSB0aGlzLl9lbnRyeURpZmZCZXR3ZWVuVGV4dFN0b3BzKGVudHJpZXMsIG1vZGVsVXJpc09ic2VydmFibGUpO1xuXG5cdFx0cmV0dXJuIGRlcml2ZWQocmVhZGVyID0+IHtcblx0XHRcdHJldHVybiBkaWZmLnJlYWQocmVhZGVyKT8ucHJvbWlzZVJlc3VsdC5yZWFkKHJlYWRlcik/LmRhdGEgfHwgdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGdldEVudHJ5RGlmZkJldHdlZW5TdG9wcyh1cmk6IFVSSSwgcmVxdWVzdElkOiBzdHJpbmcsIHN0b3BJZDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3Qga2V5ID0gYCR7dXJpfVxcMCR7cmVxdWVzdElkfVxcMCR7c3RvcElkfWA7XG5cdFx0bGV0IG9ic2VydmFibGUgPSB0aGlzLl9kaWZmc0JldHdlZW5TdG9wcy5nZXQoa2V5KTtcblx0XHRpZiAoIW9ic2VydmFibGUpIHtcblx0XHRcdG9ic2VydmFibGUgPSB0aGlzLl9jcmVhdGVEaWZmQmV0d2VlblN0b3BzT2JzZXJ2YWJsZSh1cmksIHJlcXVlc3RJZCwgc3RvcElkKTtcblx0XHRcdHRoaXMuX2RpZmZzQmV0d2VlblN0b3BzLnNldChrZXksIG9ic2VydmFibGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBvYnNlcnZhYmxlO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZVNuYXBzaG90KHJlcXVlc3RJZDogc3RyaW5nLCB1bmRvU3RvcDogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSB0aGlzLl9jcmVhdGVTbmFwc2hvdChyZXF1ZXN0SWQsIHVuZG9TdG9wKTtcblx0XHRmb3IgKGNvbnN0IFt1cmksIF9dIG9mIHRoaXMuX3dvcmtpbmdTZXQpIHtcblx0XHRcdHRoaXMuX3dvcmtpbmdTZXQuc2V0KHVyaSwgeyBzdGF0ZTogV29ya2luZ1NldEVudHJ5U3RhdGUuU2VudCB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lYXJIaXN0b3J5UHRyID0gdGhpcy5fbGluZWFySGlzdG9yeUluZGV4LmdldCgpO1xuXHRcdGNvbnN0IG5ld0xpbmVhckhpc3Rvcnk6IElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLl9saW5lYXJIaXN0b3J5LmdldCgpKSB7XG5cdFx0XHRpZiAobGluZWFySGlzdG9yeVB0ciAtIGVudHJ5LnN0YXJ0SW5kZXggPCBlbnRyeS5zdG9wcy5sZW5ndGgpIHtcblx0XHRcdFx0bmV3TGluZWFySGlzdG9yeS5wdXNoKHsgcmVxdWVzdElkOiBlbnRyeS5yZXF1ZXN0SWQsIHN0b3BzOiBlbnRyeS5zdG9wcy5zbGljZSgwLCBsaW5lYXJIaXN0b3J5UHRyIC0gZW50cnkuc3RhcnRJbmRleCksIHN0YXJ0SW5kZXg6IGVudHJ5LnN0YXJ0SW5kZXgsIHBvc3RFZGl0OiB1bmRlZmluZWQgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdMaW5lYXJIaXN0b3J5LnB1c2goZW50cnkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3RFbnRyeSA9IG5ld0xpbmVhckhpc3RvcnkuYXQoLTEpO1xuXHRcdGlmIChyZXF1ZXN0SWQgJiYgbGFzdEVudHJ5Py5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCkge1xuXHRcdFx0bmV3TGluZWFySGlzdG9yeVtuZXdMaW5lYXJIaXN0b3J5Lmxlbmd0aCAtIDFdID0geyAuLi5sYXN0RW50cnksIHN0b3BzOiBbLi4ubGFzdEVudHJ5LnN0b3BzLCBzbmFwc2hvdF0sIHBvc3RFZGl0OiB1bmRlZmluZWQgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3TGluZWFySGlzdG9yeS5wdXNoKHsgcmVxdWVzdElkLCBzdGFydEluZGV4OiBsYXN0RW50cnkgPyBsYXN0RW50cnkuc3RhcnRJbmRleCArIGxhc3RFbnRyeS5zdG9wcy5sZW5ndGggOiAwLCBzdG9wczogW3NuYXBzaG90XSwgcG9zdEVkaXQ6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cblx0XHR0cmFuc2FjdGlvbigodHgpID0+IHtcblx0XHRcdGNvbnN0IGxhc3QgPSBuZXdMaW5lYXJIaXN0b3J5W25ld0xpbmVhckhpc3RvcnkubGVuZ3RoIC0gMV07XG5cdFx0XHR0aGlzLl9saW5lYXJIaXN0b3J5LnNldChuZXdMaW5lYXJIaXN0b3J5LCB0eCk7XG5cdFx0XHR0aGlzLl9saW5lYXJIaXN0b3J5SW5kZXguc2V0KGxhc3Quc3RhcnRJbmRleCArIGxhc3Quc3RvcHMubGVuZ3RoLCB0eCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVTbmFwc2hvdChyZXF1ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCwgdW5kb1N0b3A6IHN0cmluZyB8IHVuZGVmaW5lZCk6IElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wIHtcblx0XHRjb25zdCB3b3JraW5nU2V0ID0gbmV3IFJlc291cmNlTWFwPFdvcmtpbmdTZXREaXNwbGF5TWV0YWRhdGE+KHRoaXMuX3dvcmtpbmdTZXQpO1xuXHRcdGNvbnN0IGVudHJpZXMgPSBuZXcgUmVzb3VyY2VNYXA8SVNuYXBzaG90RW50cnk+KCk7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLl9lbnRyaWVzT2JzLmdldCgpKSB7XG5cdFx0XHRlbnRyaWVzLnNldChlbnRyeS5tb2RpZmllZFVSSSwgZW50cnkuY3JlYXRlU25hcHNob3QocmVxdWVzdElkLCB1bmRvU3RvcCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRzdG9wSWQ6IHVuZG9TdG9wLFxuXHRcdFx0d29ya2luZ1NldCxcblx0XHRcdGVudHJpZXMsXG5cdFx0fTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTbmFwc2hvdChyZXF1ZXN0SWQ6IHN0cmluZywgdW5kb1N0b3A6IHN0cmluZyB8IHVuZGVmaW5lZCwgc25hcHNob3RVcmk6IFVSSSk6IElTbmFwc2hvdEVudHJ5IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBlbnRyaWVzID0gdW5kb1N0b3AgPT09IFBPU1RfRURJVF9TVE9QX0lEXG5cdFx0XHQ/IHRoaXMuX2ZpbmRTbmFwc2hvdChyZXF1ZXN0SWQpPy5wb3N0RWRpdFxuXHRcdFx0OiB0aGlzLl9maW5kRWRpdFN0b3AocmVxdWVzdElkLCB1bmRvU3RvcCk/LnN0b3AuZW50cmllcztcblx0XHRyZXR1cm4gZW50cmllcyAmJiBbLi4uZW50cmllcy52YWx1ZXMoKV0uZmluZCgoZSkgPT4gaXNFcXVhbChlLnNuYXBzaG90VXJpLCBzbmFwc2hvdFVyaSkpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGdldFNuYXBzaG90TW9kZWwocmVxdWVzdElkOiBzdHJpbmcsIHVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQsIHNuYXBzaG90VXJpOiBVUkkpOiBQcm9taXNlPElUZXh0TW9kZWwgfCBudWxsPiB7XG5cdFx0Y29uc3Qgc25hcHNob3RFbnRyeSA9IHRoaXMuZ2V0U25hcHNob3QocmVxdWVzdElkLCB1bmRvU3RvcCwgc25hcHNob3RVcmkpO1xuXHRcdGlmICghc25hcHNob3RFbnRyeSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbChzbmFwc2hvdEVudHJ5LmN1cnJlbnQsIHRoaXMuX2xhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKHNuYXBzaG90RW50cnkubGFuZ3VhZ2VJZCksIHNuYXBzaG90VXJpLCBmYWxzZSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0U25hcHNob3RVcmkocmVxdWVzdElkOiBzdHJpbmcsIHVyaTogVVJJLCBzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc3RvcHMgPSBnZXRDdXJyZW50QW5kTmV4dFN0b3AocmVxdWVzdElkLCBzdG9wSWQsIHRoaXMuX2xpbmVhckhpc3RvcnkuZ2V0KCkpO1xuXHRcdHJldHVybiBzdG9wcz8ubmV4dC5nZXQodXJpKT8uc25hcHNob3RVcmk7XG5cdH1cblxuXHQvKipcblx0ICogQSBzbmFwc2hvdCByZXByZXNlbnRpbmcgdGhlIHN0YXRlIG9mIHRoZSB3b3JraW5nIHNldCBiZWZvcmUgYSBuZXcgcmVxdWVzdCBoYXMgYmVlbiBzZW50XG5cdCAqL1xuXHRwcml2YXRlIF9wZW5kaW5nU25hcHNob3Q6IElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgYXN5bmMgcmVzdG9yZVNuYXBzaG90KHJlcXVlc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChyZXF1ZXN0SWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3Qgc3RvcFJlZiA9IHRoaXMuX2ZpbmRFZGl0U3RvcChyZXF1ZXN0SWQsIHN0b3BJZCk7XG5cdFx0XHRpZiAoc3RvcFJlZikge1xuXHRcdFx0XHR0aGlzLl9lbnN1cmVQZW5kaW5nU25hcHNob3QoKTtcblx0XHRcdFx0YXdhaXQgYXN5bmNUcmFuc2FjdGlvbihhc3luYyB0eCA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fbGluZWFySGlzdG9yeUluZGV4LnNldChzdG9wUmVmLmhpc3RvcnlJbmRleCwgdHgpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX3Jlc3RvcmVTbmFwc2hvdChzdG9wUmVmLnN0b3AsIHR4KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVJlcXVlc3RIaWRkZW5TdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwZW5kaW5nU25hcHNob3QgPSB0aGlzLl9wZW5kaW5nU25hcHNob3Q7XG5cdFx0XHRpZiAoIXBlbmRpbmdTbmFwc2hvdCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIFdlIGRvbid0IGhhdmUgYSBwZW5kaW5nIHNuYXBzaG90IHRoYXQgd2UgY2FuIHJlc3RvcmVcblx0XHRcdH1cblx0XHRcdHRoaXMuX3BlbmRpbmdTbmFwc2hvdCA9IHVuZGVmaW5lZDtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc3RvcmVTbmFwc2hvdChwZW5kaW5nU25hcHNob3QsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzdG9yZVNuYXBzaG90KHsgd29ya2luZ1NldCwgZW50cmllcyB9OiBJQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcCwgdHg6IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCwgcmVzdG9yZVJlc29sdmVkVG9EaXNrID0gdHJ1ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3dvcmtpbmdTZXQgPSBuZXcgUmVzb3VyY2VNYXAod29ya2luZ1NldCk7XG5cblx0XHQvLyBSZXNldCBhbGwgdGhlIGZpbGVzIHdoaWNoIGFyZSBtb2RpZmllZCBpbiB0aGlzIHNlc3Npb24gc3RhdGVcblx0XHQvLyBidXQgd2hpY2ggYXJlIG5vdCBmb3VuZCBpbiB0aGUgc25hcHNob3Rcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMuX2VudHJpZXNPYnMuZ2V0KCkpIHtcblx0XHRcdGNvbnN0IHNuYXBzaG90RW50cnkgPSBlbnRyaWVzLmdldChlbnRyeS5tb2RpZmllZFVSSSk7XG5cdFx0XHRpZiAoIXNuYXBzaG90RW50cnkpIHtcblx0XHRcdFx0ZW50cnkucmVzZXRUb0luaXRpYWxDb250ZW50KCk7XG5cdFx0XHRcdGVudHJ5LmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBlbnRyaWVzQXJyOiBBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnlbXSA9IFtdO1xuXHRcdC8vIFJlc3RvcmUgYWxsIGVudHJpZXMgZnJvbSB0aGUgc25hcHNob3Rcblx0XHRmb3IgKGNvbnN0IHNuYXBzaG90RW50cnkgb2YgZW50cmllcy52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3QgZW50cnkgPSBhd2FpdCB0aGlzLl9nZXRPckNyZWF0ZU1vZGlmaWVkRmlsZUVudHJ5KHNuYXBzaG90RW50cnkucmVzb3VyY2UsIHNuYXBzaG90RW50cnkudGVsZW1ldHJ5SW5mbyk7XG5cdFx0XHRjb25zdCByZXN0b3JlVG9EaXNrID0gc25hcHNob3RFbnRyeS5zdGF0ZSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQgfHwgcmVzdG9yZVJlc29sdmVkVG9EaXNrO1xuXHRcdFx0ZW50cnkucmVzdG9yZUZyb21TbmFwc2hvdChzbmFwc2hvdEVudHJ5LCByZXN0b3JlVG9EaXNrKTtcblx0XHRcdGVudHJpZXNBcnIucHVzaChlbnRyeSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZW50cmllc09icy5zZXQoZW50cmllc0FyciwgdHgpO1xuXHR9XG5cblx0cmVtb3ZlKHJlYXNvbjogV29ya2luZ1NldEVudHJ5UmVtb3ZhbFJlYXNvbiwgLi4udXJpczogVVJJW10pOiB2b2lkIHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXG5cdFx0bGV0IGRpZFJlbW92ZVVyaXMgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IHVyaSBvZiB1cmlzKSB7XG5cblx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fZW50cmllc09icy5nZXQoKS5maW5kKGUgPT4gaXNFcXVhbChlLm1vZGlmaWVkVVJJLCB1cmkpKTtcblx0XHRcdGlmIChlbnRyeSkge1xuXHRcdFx0XHRlbnRyeS5kaXNwb3NlKCk7XG5cdFx0XHRcdGNvbnN0IG5ld0VudHJpZXMgPSB0aGlzLl9lbnRyaWVzT2JzLmdldCgpLmZpbHRlcihlID0+ICFpc0VxdWFsKGUubW9kaWZpZWRVUkksIHVyaSkpO1xuXHRcdFx0XHR0aGlzLl9lbnRyaWVzT2JzLnNldChuZXdFbnRyaWVzLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRkaWRSZW1vdmVVcmlzID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl93b3JraW5nU2V0LmdldCh1cmkpO1xuXHRcdFx0aWYgKHN0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0ZGlkUmVtb3ZlVXJpcyA9IHRoaXMuX3dvcmtpbmdTZXQuZGVsZXRlKHVyaSkgfHwgZGlkUmVtb3ZlVXJpcztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWRpZFJlbW92ZVVyaXMpIHtcblx0XHRcdHJldHVybjsgLy8gbm9vcFxuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5Xb3JraW5nU2V0KTtcblx0fVxuXG5cdHByaXZhdGUgX2Fzc2VydE5vdERpc3Bvc2VkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGF0ZS5nZXQoKSA9PT0gQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuRGlzcG9zZWQpIHtcblx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoYENhbm5vdCBhY2Nlc3MgYSBkaXNwb3NlZCBlZGl0aW5nIHNlc3Npb25gKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBhY2NlcHQoLi4udXJpczogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXG5cdFx0YXdhaXQgYXN5bmNUcmFuc2FjdGlvbihhc3luYyB0eCA9PiB7XG5cblx0XHRcdGlmICh1cmlzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbCh0aGlzLl9lbnRyaWVzT2JzLmdldCgpLm1hcChlbnRyeSA9PiBlbnRyeS5hY2NlcHQodHgpKSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgdXJpIG9mIHVyaXMpIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLl9lbnRyaWVzT2JzLmdldCgpLmZpbmQoZSA9PiBpc0VxdWFsKGUubW9kaWZpZWRVUkksIHVyaSkpO1xuXHRcdFx0XHRpZiAoZW50cnkpIHtcblx0XHRcdFx0XHRhd2FpdCBlbnRyeS5hY2NlcHQodHgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmVkaXRzS2VwdCwgeyBhbGxvd01hbnlJblBhcmFsbGVsOiB0cnVlIH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5PdGhlcik7XG5cdH1cblxuXHRhc3luYyByZWplY3QoLi4udXJpczogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9hc3NlcnROb3REaXNwb3NlZCgpO1xuXG5cdFx0YXdhaXQgYXN5bmNUcmFuc2FjdGlvbihhc3luYyB0eCA9PiB7XG5cdFx0XHRpZiAodXJpcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwodGhpcy5fZW50cmllc09icy5nZXQoKS5tYXAoZW50cnkgPT4gZW50cnkucmVqZWN0KHR4KSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiB1cmlzKSB7XG5cdFx0XHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fZW50cmllc09icy5nZXQoKS5maW5kKGUgPT4gaXNFcXVhbChlLm1vZGlmaWVkVVJJLCB1cmkpKTtcblx0XHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdFx0YXdhaXQgZW50cnkucmVqZWN0KHR4KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC5lZGl0c1VuZG9uZSwgeyBhbGxvd01hbnlJblBhcmFsbGVsOiB0cnVlIH0pO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5PdGhlcik7XG5cdH1cblxuXHRhc3luYyBzaG93KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2Fzc2VydE5vdERpc3Bvc2VkKCk7XG5cdFx0aWYgKHRoaXMuX2VkaXRvclBhbmUpIHtcblx0XHRcdGlmICh0aGlzLl9lZGl0b3JQYW5lLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5fZWRpdG9yUGFuZS5pbnB1dCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmFjdGl2ZUdyb3VwLm9wZW5FZGl0b3IodGhpcy5fZWRpdG9yUGFuZS5pbnB1dCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uQUNUSVZBVEUgfSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgaW5wdXQgPSBNdWx0aURpZmZFZGl0b3JJbnB1dC5mcm9tUmVzb3VyY2VNdWx0aURpZmZFZGl0b3JJbnB1dCh7XG5cdFx0XHRtdWx0aURpZmZTb3VyY2U6IGdldE11bHRpRGlmZlNvdXJjZVVyaSh0aGlzKSxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbXVsdGlEaWZmRWRpdG9ySW5wdXQubmFtZScsIFwiU3VnZ2VzdGVkIEVkaXRzXCIpXG5cdFx0fSwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fZWRpdG9yUGFuZSA9IGF3YWl0IHRoaXMuX2VkaXRvckdyb3Vwc1NlcnZpY2UuYWN0aXZlR3JvdXAub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uQUNUSVZBVEUgfSkgYXMgTXVsdGlEaWZmRWRpdG9yIHwgdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RvcFByb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cblx0YXN5bmMgc3RvcChjbGVhclN0YXRlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9zdG9wUHJvbWlzZSA/Pz0gUHJvbWlzZS5hbGxTZXR0bGVkKFt0aGlzLl9wZXJmb3JtU3RvcCgpLCB0aGlzLnN0b3JlU3RhdGUoKV0pLnRoZW4oKCkgPT4geyB9KTtcblx0XHRhd2FpdCB0aGlzLl9zdG9wUHJvbWlzZTtcblx0XHRpZiAoY2xlYXJTdGF0ZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZSwgdGhpcy5jaGF0U2Vzc2lvbklkKS5jbGVhclN0YXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcGVyZm9ybVN0b3AoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQ2xvc2Ugb3V0IGFsbCBvcGVuIGZpbGVzXG5cdFx0Y29uc3Qgc2NoZW1lcyA9IFtBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnkuc2NoZW1lLCBDaGF0RWRpdGluZ1RleHRNb2RlbENvbnRlbnRQcm92aWRlci5zY2hlbWVdO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZCh0aGlzLl9lZGl0b3JHcm91cHNTZXJ2aWNlLmdyb3Vwcy5mbGF0TWFwKGFzeW5jIChnKSA9PiB7XG5cdFx0XHRyZXR1cm4gZy5lZGl0b3JzLm1hcChhc3luYyAoZSkgPT4ge1xuXHRcdFx0XHRpZiAoKGUgaW5zdGFuY2VvZiBNdWx0aURpZmZFZGl0b3JJbnB1dCAmJiBlLmluaXRpYWxSZXNvdXJjZXM/LnNvbWUociA9PiByLm9yaWdpbmFsVXJpICYmIHNjaGVtZXMuaW5kZXhPZihyLm9yaWdpbmFsVXJpLnNjaGVtZSkgIT09IC0xKSlcblx0XHRcdFx0XHR8fCAoZSBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCAmJiBlLm9yaWdpbmFsLnJlc291cmNlICYmIHNjaGVtZXMuaW5kZXhPZihlLm9yaWdpbmFsLnJlc291cmNlLnNjaGVtZSkgIT09IC0xKSkge1xuXHRcdFx0XHRcdGF3YWl0IGcuY2xvc2VFZGl0b3IoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fYXNzZXJ0Tm90RGlzcG9zZWQoKTtcblxuXHRcdHRoaXMuX2NoYXRTZXJ2aWNlLmNhbmNlbEN1cnJlbnRSZXF1ZXN0Rm9yU2Vzc2lvbih0aGlzLmNoYXRTZXNzaW9uSWQpO1xuXG5cdFx0ZGlzcG9zZSh0aGlzLl9lbnRyaWVzT2JzLmdldCgpKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3RhdGUuc2V0KENoYXRFZGl0aW5nU2Vzc2lvblN0YXRlLkRpc3Bvc2VkLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMuX29uRGlkRGlzcG9zZS5maXJlKCk7XG5cdFx0dGhpcy5fb25EaWREaXNwb3NlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX3N0cmVhbWluZ0VkaXRMb2NrcyA9IG5ldyBTZXF1ZW5jZXJCeUtleTwvKiBVUkkgKi8gc3RyaW5nPigpO1xuXG5cdHByaXZhdGUgZ2V0IGlzRGlzcG9zZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0YXRlLmdldCgpID09PSBDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZS5EaXNwb3NlZDtcblx0fVxuXG5cdHN0YXJ0U3RyZWFtaW5nRWRpdHMocmVzb3VyY2U6IFVSSSwgcmVzcG9uc2VNb2RlbDogSUNoYXRSZXNwb25zZU1vZGVsLCBpblVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBJU3RyZWFtaW5nRWRpdHMge1xuXHRcdGNvbnN0IGNvbXBsZXRlUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRjb25zdCBzdGFydFByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cblx0XHQvLyBTZXF1ZW5jZSBhbGwgZWRpdHMgbWFkZSB0aGlzIHRoaXMgcmVzb3VyY2UgaW4gdGhpcyBzdHJlYW1pbmcgZWRpdHMgaW5zdGFuY2UsXG5cdFx0Ly8gYW5kIGFsc28gc2VxdWVuY2UgdGhlIHJlc291cmNlIG92ZXJhbGwgaW4gdGhlIHJhcmUgKGN1cnJlbnRseSBpbnZhbGlkPykgY2FzZVxuXHRcdC8vIHRoYXQgZWRpdHMgYXJlIG1hZGUgaW4gcGFyYWxsZWwgdG8gdGhlIHNhbWUgcmVzb3VyY2UsXG5cdFx0Y29uc3Qgc2VxdWVuY2VyID0gbmV3IFRocm90dGxlZFNlcXVlbmNlcigxNSwgMTAwMCk7XG5cdFx0c2VxdWVuY2VyLnF1ZXVlKCgpID0+IHN0YXJ0UHJvbWlzZS5wKTtcblxuXHRcdHRoaXMuX3N0cmVhbWluZ0VkaXRMb2Nrcy5xdWV1ZShyZXNvdXJjZS50b1N0cmluZygpLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9hY2NlcHRTdHJlYW1pbmdFZGl0c1N0YXJ0KHJlc3BvbnNlTW9kZWwsIGluVW5kb1N0b3AsIHJlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0c3RhcnRQcm9taXNlLmNvbXBsZXRlKCk7XG5cdFx0XHRyZXR1cm4gY29tcGxldGVQcm9taXNlLnA7XG5cdFx0fSk7XG5cblxuXHRcdGxldCBkaWRDb21wbGV0ZSA9IGZhbHNlO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHB1c2hUZXh0OiAoZWRpdHMpID0+IHtcblx0XHRcdFx0c2VxdWVuY2VyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fYWNjZXB0RWRpdHMocmVzb3VyY2UsIGVkaXRzLCBmYWxzZSwgcmVzcG9uc2VNb2RlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRwdXNoTm90ZWJvb2tDZWxsVGV4dDogKGNlbGwsIGVkaXRzKSA9PiB7XG5cdFx0XHRcdHNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2FjY2VwdEVkaXRzKGNlbGwsIGVkaXRzLCBmYWxzZSwgcmVzcG9uc2VNb2RlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRwdXNoTm90ZWJvb2s6IGVkaXRzID0+IHtcblx0XHRcdFx0c2VxdWVuY2VyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAoIXRoaXMuaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5fYWNjZXB0RWRpdHMocmVzb3VyY2UsIGVkaXRzLCBmYWxzZSwgcmVzcG9uc2VNb2RlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRjb21wbGV0ZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAoZGlkQ29tcGxldGUpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkaWRDb21wbGV0ZSA9IHRydWU7XG5cdFx0XHRcdHNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCF0aGlzLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX2FjY2VwdEVkaXRzKHJlc291cmNlLCBbXSwgdHJ1ZSwgcmVzcG9uc2VNb2RlbCk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9yZXNvbHZlKHJlc3BvbnNlTW9kZWwucmVxdWVzdElkLCBpblVuZG9TdG9wLCByZXNvdXJjZSk7XG5cdFx0XHRcdFx0XHRjb21wbGV0ZVByb21pc2UuY29tcGxldGUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SGlzdG9yeUVudHJ5QnlMaW5lYXJJbmRleChpbmRleDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgaGlzdG9yeSA9IHRoaXMuX2xpbmVhckhpc3RvcnkuZ2V0KCk7XG5cdFx0Y29uc3Qgc2VhcmNoZWRJbmRleCA9IGJpbmFyeVNlYXJjaDIoaGlzdG9yeS5sZW5ndGgsIChlKSA9PiBoaXN0b3J5W2VdLnN0YXJ0SW5kZXggLSBpbmRleCk7XG5cdFx0Y29uc3QgZW50cnkgPSBoaXN0b3J5W3NlYXJjaGVkSW5kZXggPCAwID8gKH5zZWFyY2hlZEluZGV4KSAtIDEgOiBzZWFyY2hlZEluZGV4XTtcblx0XHRpZiAoIWVudHJ5IHx8IGluZGV4IC0gZW50cnkuc3RhcnRJbmRleCA+PSBlbnRyeS5zdG9wcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVudHJ5LFxuXHRcdFx0c3RvcDogZW50cnkuc3RvcHNbaW5kZXggLSBlbnRyeS5zdGFydEluZGV4XVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyB1bmRvSW50ZXJhY3Rpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbmV3SW5kZXggPSB0aGlzLl9saW5lYXJIaXN0b3J5SW5kZXguZ2V0KCkgLSAxO1xuXHRcdGNvbnN0IHByZXZpb3VzU25hcHNob3QgPSB0aGlzLl9nZXRIaXN0b3J5RW50cnlCeUxpbmVhckluZGV4KG5ld0luZGV4KTtcblx0XHRpZiAoIXByZXZpb3VzU25hcHNob3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9lbnN1cmVQZW5kaW5nU25hcHNob3QoKTtcblx0XHRhd2FpdCBhc3luY1RyYW5zYWN0aW9uKGFzeW5jIHR4ID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc3RvcmVTbmFwc2hvdChwcmV2aW91c1NuYXBzaG90LnN0b3AsIHR4KTtcblx0XHRcdHRoaXMuX2xpbmVhckhpc3RvcnlJbmRleC5zZXQobmV3SW5kZXgsIHR4KTtcblx0XHR9KTtcblx0XHR0aGlzLl91cGRhdGVSZXF1ZXN0SGlkZGVuU3RhdGUoKTtcblx0fVxuXG5cdGFzeW5jIHJlZG9JbnRlcmFjdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtYXhJbmRleCA9IGdldE1heEhpc3RvcnlJbmRleCh0aGlzLl9saW5lYXJIaXN0b3J5LmdldCgpKTtcblx0XHRjb25zdCBuZXdJbmRleCA9IHRoaXMuX2xpbmVhckhpc3RvcnlJbmRleC5nZXQoKSArIDE7XG5cdFx0aWYgKG5ld0luZGV4ID4gbWF4SW5kZXgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBuZXh0U25hcHNob3QgPSBuZXdJbmRleCA9PT0gbWF4SW5kZXggPyB0aGlzLl9wZW5kaW5nU25hcHNob3QgOiB0aGlzLl9nZXRIaXN0b3J5RW50cnlCeUxpbmVhckluZGV4KG5ld0luZGV4KT8uc3RvcDtcblx0XHRpZiAoIW5leHRTbmFwc2hvdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhd2FpdCBhc3luY1RyYW5zYWN0aW9uKGFzeW5jIHR4ID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc3RvcmVTbmFwc2hvdChuZXh0U25hcHNob3QsIHR4KTtcblx0XHRcdHRoaXMuX2xpbmVhckhpc3RvcnlJbmRleC5zZXQobmV3SW5kZXgsIHR4KTtcblx0XHR9KTtcblx0XHR0aGlzLl91cGRhdGVSZXF1ZXN0SGlkZGVuU3RhdGUoKTtcblx0fVxuXG5cblx0cHJpdmF0ZSBfdXBkYXRlUmVxdWVzdEhpZGRlblN0YXRlKCkge1xuXHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLl9saW5lYXJIaXN0b3J5LmdldCgpO1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fbGluZWFySGlzdG9yeUluZGV4LmdldCgpO1xuXG5cdFx0Y29uc3QgdW5kb1JlcXVlc3RzOiBJQ2hhdFJlcXVlc3REaXNhYmxlbWVudFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBoaXN0b3J5KSB7XG5cdFx0XHRpZiAoIWVudHJ5LnJlcXVlc3RJZCkge1xuXHRcdFx0XHQvLyBpZ25vcmVkXG5cdFx0XHR9IGVsc2UgaWYgKGVudHJ5LnN0YXJ0SW5kZXggPj0gaW5kZXgpIHtcblx0XHRcdFx0dW5kb1JlcXVlc3RzLnB1c2goeyByZXF1ZXN0SWQ6IGVudHJ5LnJlcXVlc3RJZCB9KTtcblx0XHRcdH0gZWxzZSBpZiAoZW50cnkuc3RhcnRJbmRleCArIGVudHJ5LnN0b3BzLmxlbmd0aCA+IGluZGV4KSB7XG5cdFx0XHRcdHVuZG9SZXF1ZXN0cy5wdXNoKHsgcmVxdWVzdElkOiBlbnRyeS5yZXF1ZXN0SWQsIGFmdGVyVW5kb1N0b3A6IGVudHJ5LnN0b3BzW2luZGV4IC0gZW50cnkuc3RhcnRJbmRleF0uc3RvcElkIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2NoYXRTZXJ2aWNlLmdldFNlc3Npb24odGhpcy5jaGF0U2Vzc2lvbklkKT8uc2V0RGlzYWJsZWRSZXF1ZXN0cyh1bmRvUmVxdWVzdHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYWNjZXB0U3RyZWFtaW5nRWRpdHNTdGFydChyZXNwb25zZU1vZGVsOiBJQ2hhdFJlc3BvbnNlTW9kZWwsIHVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlc291cmNlOiBVUkkpIHtcblx0XHRjb25zdCBlbnRyeSA9IGF3YWl0IHRoaXMuX2dldE9yQ3JlYXRlTW9kaWZpZWRGaWxlRW50cnkocmVzb3VyY2UsIHRoaXMuX2dldFRlbGVtZXRyeUluZm9Gb3JNb2RlbChyZXNwb25zZU1vZGVsKSk7XG5cdFx0dHJhbnNhY3Rpb24oKHR4KSA9PiB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5zZXQoQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuU3RyZWFtaW5nRWRpdHMsIHR4KTtcblx0XHRcdGVudHJ5LmFjY2VwdFN0cmVhbWluZ0VkaXRzU3RhcnQocmVzcG9uc2VNb2RlbCwgdHgpO1xuXHRcdFx0dGhpcy5lbnN1cmVFZGl0SW5VbmRvU3RvcE1hdGNoZXMocmVzcG9uc2VNb2RlbC5yZXF1ZXN0SWQsIHVuZG9TdG9wLCBlbnRyeSwgZmFsc2UsIHR4KTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFbnN1cmVzIHRoZSBzdGF0ZSBvZiB0aGUgZmlsZSBpbiB0aGUgZ2l2ZW4gc25hcHNob3QgbWF0Y2hlcyB0aGUgY3VycmVudFxuXHQgKiBzdGF0ZSBvZiB0aGUge0BwYXJhbSBlbnRyeX0uIFRoaXMgaXMgdXNlZCB0byBoYW5kbGUgY29uY3VycmVudCBmaWxlIGVkaXRzLlxuXHQgKlxuXHQgKiBHaXZlbiB0aGUgY2FzZSBvZiB0d28gZGlmZmVyZW50IGVkaXRzLCB3ZSB3aWxsIHBsYWNlIGFuZCB1bmRvIHN0b3AgcmlnaHRcblx0ICogYmVmb3JlIHdlIGB0ZXh0RWRpdEdyb3VwYCBpbiB0aGUgdW5kZXJseWluZyBtYXJrZG93biBzdHJlYW0sIGJ1dCBhdCB0aGVcblx0ICogdGltZSB0aG9zZSBhcmUgYWRkZWQgdGhlIGVkaXRzIGhhdmVuJ3QgYmVlbiBtYWRlIHlldCwgc28gYm90aCBmaWxlcyB3aWxsXG5cdCAqIHNpbXBseSBoYXZlIHRoZSB1bm1vZGlmaWVkIHN0YXRlLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgYWZ0ZXIgZWFjaCBlZGl0LCBzbyBhZnRlciB0aGUgZmlyc3QgZmlsZSBmaW5pc2hlc1xuXHQgKiBiZWluZyBlZGl0cywgaXQgd2lsbCB1cGRhdGUgaXRzIGNvbnRlbnQgaW4gdGhlIHNlY29uZCB1bmRvIHNuYXBzaG90IHN1Y2hcblx0ICogdGhhdCBpdCBjYW4gYmUgdW5kb25lIHN1Y2Nlc3NmdWxseS5cblx0ICpcblx0ICogV2UgZW5zdXJlIHRoYXQgdGhlIHNhbWUgZmlsZSBpcyBub3QgY29uY3VycmVudGx5IGVkaXRlZCB2aWEgdGhlXG5cdCAqIHtAbGluayBfc3RyZWFtaW5nRWRpdExvY2tzfSwgYXZvaWRpbmcgcmFjZSBjb25kaXRpb25zLlxuXHQgKlxuXHQgKiBAcGFyYW0gbmV4dCBJZiB0cnVlLCB0aGlzIHdpbGwgZWRpdCB0aGUgc25hcHNob3QgX2FmdGVyXyB0aGUgdW5kbyBzdG9wXG5cdCAqL1xuXHRwcml2YXRlIGVuc3VyZUVkaXRJblVuZG9TdG9wTWF0Y2hlcyhyZXF1ZXN0SWQ6IHN0cmluZywgdW5kb1N0b3A6IHN0cmluZyB8IHVuZGVmaW5lZCwgZW50cnk6IEFic3RyYWN0Q2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeSwgbmV4dDogYm9vbGVhbiwgdHg6IElUcmFuc2FjdGlvbikge1xuXHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLl9saW5lYXJIaXN0b3J5LmdldCgpO1xuXHRcdGNvbnN0IHNuYXBJbmRleCA9IGhpc3RvcnkuZmluZEluZGV4KHMgPT4gcy5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCk7XG5cdFx0aWYgKHNuYXBJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzbmFwID0gaGlzdG9yeVtzbmFwSW5kZXhdO1xuXHRcdGxldCBzdG9wSW5kZXggPSBzbmFwLnN0b3BzLmZpbmRJbmRleChzID0+IHMuc3RvcElkID09PSB1bmRvU3RvcCk7XG5cdFx0aWYgKHN0b3BJbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBzcGVjaWFsIGNhc2U6IHB1dCB0aGUgbGFzdCBjaGFuZ2UgaW4gdGhlIHBlbmRpbmdTbmFwc2hvdCBhcyBuZWVkZWRcblx0XHRpZiAobmV4dCkge1xuXHRcdFx0aWYgKHN0b3BJbmRleCA9PT0gc25hcC5zdG9wcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdGNvbnN0IHBvc3RFZGl0ID0gbmV3IFJlc291cmNlTWFwKHNuYXAucG9zdEVkaXQgfHwgdGhpcy5fY3JlYXRlU25hcHNob3QodW5kZWZpbmVkLCB1bmRlZmluZWQpLmVudHJpZXMpO1xuXHRcdFx0XHRpZiAoIXNuYXAucG9zdEVkaXQgfHwgIWVudHJ5LmVxdWFsc1NuYXBzaG90KHBvc3RFZGl0LmdldChlbnRyeS5tb2RpZmllZFVSSSkpKSB7XG5cdFx0XHRcdFx0cG9zdEVkaXQuc2V0KGVudHJ5Lm1vZGlmaWVkVVJJLCBlbnRyeS5jcmVhdGVTbmFwc2hvdChyZXF1ZXN0SWQsIFBPU1RfRURJVF9TVE9QX0lEKSk7XG5cdFx0XHRcdFx0Y29uc3QgbmV3SGlzdG9yeSA9IGhpc3Rvcnkuc2xpY2UoKTtcblx0XHRcdFx0XHRuZXdIaXN0b3J5W3NuYXBJbmRleF0gPSB7IC4uLnNuYXAsIHBvc3RFZGl0IH07XG5cdFx0XHRcdFx0dGhpcy5fbGluZWFySGlzdG9yeS5zZXQobmV3SGlzdG9yeSwgdHgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHN0b3BJbmRleCsrO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0b3AgPSBzbmFwLnN0b3BzW3N0b3BJbmRleF07XG5cdFx0aWYgKGVudHJ5LmVxdWFsc1NuYXBzaG90KHN0b3AuZW50cmllcy5nZXQoZW50cnkubW9kaWZpZWRVUkkpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld01hcCA9IG5ldyBSZXNvdXJjZU1hcChzdG9wLmVudHJpZXMpO1xuXHRcdG5ld01hcC5zZXQoZW50cnkubW9kaWZpZWRVUkksIGVudHJ5LmNyZWF0ZVNuYXBzaG90KHJlcXVlc3RJZCwgc3RvcC5zdG9wSWQpKTtcblxuXHRcdGNvbnN0IG5ld1N0b3AgPSBzbmFwLnN0b3BzLnNsaWNlKCk7XG5cdFx0bmV3U3RvcFtzdG9wSW5kZXhdID0geyAuLi5zdG9wLCBlbnRyaWVzOiBuZXdNYXAgfTtcblxuXHRcdGNvbnN0IG5ld0hpc3RvcnkgPSBoaXN0b3J5LnNsaWNlKCk7XG5cdFx0bmV3SGlzdG9yeVtzbmFwSW5kZXhdID0geyAuLi5zbmFwLCBzdG9wczogbmV3U3RvcCB9O1xuXHRcdHRoaXMuX2xpbmVhckhpc3Rvcnkuc2V0KG5ld0hpc3RvcnksIHR4KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FjY2VwdEVkaXRzKHJlc291cmNlOiBVUkksIHRleHRFZGl0czogKFRleHRFZGl0IHwgSUNlbGxFZGl0T3BlcmF0aW9uKVtdLCBpc0xhc3RFZGl0czogYm9vbGVhbiwgcmVzcG9uc2VNb2RlbDogSUNoYXRSZXNwb25zZU1vZGVsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZW50cnkgPSBhd2FpdCB0aGlzLl9nZXRPckNyZWF0ZU1vZGlmaWVkRmlsZUVudHJ5KHJlc291cmNlLCB0aGlzLl9nZXRUZWxlbWV0cnlJbmZvRm9yTW9kZWwocmVzcG9uc2VNb2RlbCkpO1xuXHRcdGF3YWl0IGVudHJ5LmFjY2VwdEFnZW50RWRpdHMocmVzb3VyY2UsIHRleHRFZGl0cywgaXNMYXN0RWRpdHMsIHJlc3BvbnNlTW9kZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VGVsZW1ldHJ5SW5mb0Zvck1vZGVsKHJlc3BvbnNlTW9kZWw6IElDaGF0UmVzcG9uc2VNb2RlbCk6IElNb2RpZmllZEVudHJ5VGVsZW1ldHJ5SW5mbyB7XG5cdFx0Ly8gTWFrZSB0aGVzZSBnZXR0ZXJzIGJlY2F1c2UgdGhlIHJlc3BvbnNlIHJlc3VsdCBpcyBub3QgYXZhaWxhYmxlIHdoZW4gdGhlIGZpbGUgZmlyc3Qgc3RhcnRzIHRvIGJlIGVkaXRlZFxuXHRcdHJldHVybiBuZXcgY2xhc3Mge1xuXHRcdFx0Z2V0IGFnZW50SWQoKSB7IHJldHVybiByZXNwb25zZU1vZGVsLmFnZW50Py5pZDsgfVxuXHRcdFx0Z2V0IGNvbW1hbmQoKSB7IHJldHVybiByZXNwb25zZU1vZGVsLnNsYXNoQ29tbWFuZD8ubmFtZTsgfVxuXHRcdFx0Z2V0IHNlc3Npb25JZCgpIHsgcmV0dXJuIHJlc3BvbnNlTW9kZWwuc2Vzc2lvbi5zZXNzaW9uSWQ7IH1cblx0XHRcdGdldCByZXF1ZXN0SWQoKSB7IHJldHVybiByZXNwb25zZU1vZGVsLnJlcXVlc3RJZDsgfVxuXHRcdFx0Z2V0IHJlc3VsdCgpIHsgcmV0dXJuIHJlc3BvbnNlTW9kZWwucmVzdWx0OyB9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmUocmVxdWVzdElkOiBzdHJpbmcsIHVuZG9TdG9wOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBhc3luY1RyYW5zYWN0aW9uKGFzeW5jICh0eCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFzT3RoZXJUYXNrcyA9IEl0ZXJhYmxlLnNvbWUodGhpcy5fc3RyZWFtaW5nRWRpdExvY2tzLmtleXMoKSwgayA9PiBrICE9PSByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdGlmICghaGFzT3RoZXJUYXNrcykge1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5zZXQoQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuSWRsZSwgdHgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuX2dldEVudHJ5KHJlc291cmNlKTtcblx0XHRcdGlmICghZW50cnkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVuc3VyZUVkaXRJblVuZG9TdG9wTWF0Y2hlcyhyZXF1ZXN0SWQsIHVuZG9TdG9wLCBlbnRyeSwgLyogbmV4dD0gKi8gdHJ1ZSwgdHgpO1xuXHRcdFx0cmV0dXJuIGVudHJ5LmFjY2VwdFN0cmVhbWluZ0VkaXRzRW5kKHR4KTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5PdGhlcik7XG5cdH1cblxuXHQvKipcblx0ICogUmV0cmlldmVzIG9yIGNyZWF0ZXMgYSBtb2RpZmllZCBmaWxlIGVudHJ5LlxuXHQgKlxuXHQgKiBAcmV0dXJucyBUaGUgbW9kaWZpZWQgZmlsZSBlbnRyeS5cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgX2dldE9yQ3JlYXRlTW9kaWZpZWRGaWxlRW50cnkocmVzb3VyY2U6IFVSSSwgdGVsZW1ldHJ5SW5mbzogSU1vZGlmaWVkRW50cnlUZWxlbWV0cnlJbmZvKTogUHJvbWlzZTxBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnk+IHtcblxuXHRcdHJlc291cmNlID0gQ2VsbFVyaS5wYXJzZShyZXNvdXJjZSk/Lm5vdGVib29rID8/IHJlc291cmNlO1xuXG5cdFx0Y29uc3QgZXhpc3RpbmdFbnRyeSA9IHRoaXMuX2VudHJpZXNPYnMuZ2V0KCkuZmluZChlID0+IGlzRXF1YWwoZS5tb2RpZmllZFVSSSwgcmVzb3VyY2UpKTtcblx0XHRpZiAoZXhpc3RpbmdFbnRyeSkge1xuXHRcdFx0aWYgKHRlbGVtZXRyeUluZm8ucmVxdWVzdElkICE9PSBleGlzdGluZ0VudHJ5LnRlbGVtZXRyeUluZm8ucmVxdWVzdElkKSB7XG5cdFx0XHRcdGV4aXN0aW5nRW50cnkudXBkYXRlVGVsZW1ldHJ5SW5mbyh0ZWxlbWV0cnlJbmZvKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBleGlzdGluZ0VudHJ5O1xuXHRcdH1cblxuXHRcdGxldCBlbnRyeTogQWJzdHJhY3RDaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5O1xuXHRcdGNvbnN0IGV4aXN0aW5nRXh0ZXJuYWxFbnRyeSA9IHRoaXMuX2xvb2t1cEV4dGVybmFsRW50cnkocmVzb3VyY2UpO1xuXHRcdGlmIChleGlzdGluZ0V4dGVybmFsRW50cnkpIHtcblx0XHRcdGVudHJ5ID0gZXhpc3RpbmdFeHRlcm5hbEVudHJ5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBpbml0aWFsQ29udGVudCA9IHRoaXMuX2luaXRpYWxGaWxlQ29udGVudHMuZ2V0KHJlc291cmNlKTtcblx0XHRcdC8vIFRoaXMgZ2V0cyBtYW51YWxseSBkaXNwb3NlZCBpbiAuZGlzcG9zZSgpIG9yIGluIC5yZXN0b3JlU25hcHNob3QoKVxuXHRcdFx0ZW50cnkgPSBhd2FpdCB0aGlzLl9jcmVhdGVNb2RpZmllZEZpbGVFbnRyeShyZXNvdXJjZSwgdGVsZW1ldHJ5SW5mbywgZmFsc2UsIGluaXRpYWxDb250ZW50KTtcblx0XHRcdGlmICghaW5pdGlhbENvbnRlbnQpIHtcblx0XHRcdFx0dGhpcy5faW5pdGlhbEZpbGVDb250ZW50cy5zZXQocmVzb3VyY2UsIGVudHJ5LmluaXRpYWxDb250ZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiBhbiBlbnRyeSBpcyBkZWxldGVkIGUuZy4gcmV2ZXJ0aW5nIGEgY3JlYXRlZCBmaWxlLFxuXHRcdC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBlbnRyaWVzIGFuZCBkb24ndCBzaG93IGl0IGluIHRoZSB3b3JraW5nIHNldCBhbnltb3JlXG5cdFx0Ly8gc28gdGhhdCBpdCBjYW4gYmUgcmVjcmVhdGVkIGUuZy4gdGhyb3VnaCByZXRyeVxuXHRcdGNvbnN0IGxpc3RlbmVyID0gZW50cnkub25EaWREZWxldGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3RW50cmllcyA9IHRoaXMuX2VudHJpZXNPYnMuZ2V0KCkuZmlsdGVyKGUgPT4gIWlzRXF1YWwoZS5tb2RpZmllZFVSSSwgZW50cnkubW9kaWZpZWRVUkkpKTtcblx0XHRcdHRoaXMuX2VudHJpZXNPYnMuc2V0KG5ld0VudHJpZXMsIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl93b3JraW5nU2V0LmRlbGV0ZShlbnRyeS5tb2RpZmllZFVSSSk7XG5cdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLmNsb3NlRWRpdG9ycyh0aGlzLl9lZGl0b3JTZXJ2aWNlLmZpbmRFZGl0b3JzKGVudHJ5Lm1vZGlmaWVkVVJJKSk7XG5cblx0XHRcdGlmICghZXhpc3RpbmdFeHRlcm5hbEVudHJ5KSB7XG5cdFx0XHRcdC8vIGRvbid0IGRpc3Bvc2UgZW50cmllcyB0aGF0IGFyZSBub3QgeW91cnMhXG5cdFx0XHRcdGVudHJ5LmRpc3Bvc2UoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fc3RvcmUuZGVsZXRlKGxpc3RlbmVyKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoQ2hhdEVkaXRpbmdTZXNzaW9uQ2hhbmdlVHlwZS5Xb3JraW5nU2V0KTtcblx0XHR9KTtcblx0XHR0aGlzLl9zdG9yZS5hZGQobGlzdGVuZXIpO1xuXG5cdFx0Y29uc3QgZW50cmllc0FyciA9IFsuLi50aGlzLl9lbnRyaWVzT2JzLmdldCgpLCBlbnRyeV07XG5cdFx0dGhpcy5fZW50cmllc09icy5zZXQoZW50cmllc0FyciwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKENoYXRFZGl0aW5nU2Vzc2lvbkNoYW5nZVR5cGUuV29ya2luZ1NldCk7XG5cblx0XHRyZXR1cm4gZW50cnk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVNb2RpZmllZEZpbGVFbnRyeShyZXNvdXJjZTogVVJJLCB0ZWxlbWV0cnlJbmZvOiBJTW9kaWZpZWRFbnRyeVRlbGVtZXRyeUluZm8sIG11c3RFeGlzdCA9IGZhbHNlLCBpbml0aWFsQ29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBYnN0cmFjdENoYXRFZGl0aW5nTW9kaWZpZWRGaWxlRW50cnk+IHtcblx0XHRjb25zdCBtdWx0aURpZmZFbnRyeURlbGVnYXRlID0geyBjb2xsYXBzZTogKHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpID0+IHRoaXMuX2NvbGxhcHNlKHJlc291cmNlLCB0cmFuc2FjdGlvbikgfTtcblx0XHRjb25zdCBjaGF0S2luZCA9IG11c3RFeGlzdCA/IENoYXRFZGl0S2luZC5DcmVhdGVkIDogQ2hhdEVkaXRLaW5kLk1vZGlmaWVkO1xuXHRcdGNvbnN0IG5vdGVib29rVXJpID0gQ2VsbFVyaS5wYXJzZShyZXNvdXJjZSk/Lm5vdGVib29rIHx8IHJlc291cmNlO1xuXHRcdHRyeSB7XG5cdFx0XHQvLyBJZiBhIG5vdGVib29rIGlzbid0IG9wZW4sIHRoZW4gdXNlIHRoZSBvbGQgc3luY2hyb25pemF0aW9uIGFwcHJvYWNoLlxuXHRcdFx0aWYgKHRoaXMuX25vdGVib29rU2VydmljZS5oYXNTdXBwb3J0ZWROb3RlYm9va3Mobm90ZWJvb2tVcmkpICYmICh0aGlzLl9ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwobm90ZWJvb2tVcmkpIHx8IENoYXRFZGl0aW5nTW9kaWZpZWROb3RlYm9va0VudHJ5LmNhbkhhbmRsZVNuYXBzaG90Q29udGVudChpbml0aWFsQ29udGVudCkpKSB7XG5cdFx0XHRcdHJldHVybiBhd2FpdCBDaGF0RWRpdGluZ01vZGlmaWVkTm90ZWJvb2tFbnRyeS5jcmVhdGUobm90ZWJvb2tVcmksIG11bHRpRGlmZkVudHJ5RGVsZWdhdGUsIHRlbGVtZXRyeUluZm8sIGNoYXRLaW5kLCBpbml0aWFsQ29udGVudCwgdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcmVmID0gYXdhaXQgdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyZXNvdXJjZSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ01vZGlmaWVkRG9jdW1lbnRFbnRyeSwgcmVmLCBtdWx0aURpZmZFbnRyeURlbGVnYXRlLCB0ZWxlbWV0cnlJbmZvLCBjaGF0S2luZCwgaW5pdGlhbENvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aWYgKG11c3RFeGlzdCkge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cdFx0XHQvLyB0aGlzIGZpbGUgZG9lcyBub3QgZXhpc3QgeWV0LCBjcmVhdGUgaXQgYW5kIHRyeSBhZ2FpblxuXHRcdFx0YXdhaXQgdGhpcy5fYnVsa0VkaXRTZXJ2aWNlLmFwcGx5KHsgZWRpdHM6IFt7IG5ld1Jlc291cmNlOiByZXNvdXJjZSB9XSB9KTtcblx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlLCBvcHRpb25zOiB7IGluYWN0aXZlOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSB9KTtcblx0XHRcdGlmICh0aGlzLl9ub3RlYm9va1NlcnZpY2UuaGFzU3VwcG9ydGVkTm90ZWJvb2tzKG5vdGVib29rVXJpKSkge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgQ2hhdEVkaXRpbmdNb2RpZmllZE5vdGVib29rRW50cnkuY3JlYXRlKHJlc291cmNlLCBtdWx0aURpZmZFbnRyeURlbGVnYXRlLCB0ZWxlbWV0cnlJbmZvLCBDaGF0RWRpdEtpbmQuQ3JlYXRlZCwgaW5pdGlhbENvbnRlbnQsIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVNb2RpZmllZEZpbGVFbnRyeShyZXNvdXJjZSwgdGVsZW1ldHJ5SW5mbywgdHJ1ZSwgaW5pdGlhbENvbnRlbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NvbGxhcHNlKHJlc291cmNlOiBVUkksIHRyYW5zYWN0aW9uOiBJVHJhbnNhY3Rpb24gfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBtdWx0aURpZmZJdGVtID0gdGhpcy5fZWRpdG9yUGFuZT8uZmluZERvY3VtZW50RGlmZkl0ZW0ocmVzb3VyY2UpO1xuXHRcdGlmIChtdWx0aURpZmZJdGVtKSB7XG5cdFx0XHR0aGlzLl9lZGl0b3JQYW5lPy52aWV3TW9kZWw/Lml0ZW1zLmdldCgpLmZpbmQoKGRvY3VtZW50RGlmZkl0ZW0pID0+XG5cdFx0XHRcdGlzRXF1YWwoZG9jdW1lbnREaWZmSXRlbS5vcmlnaW5hbFVyaSwgbXVsdGlEaWZmSXRlbS5vcmlnaW5hbFVyaSkgJiZcblx0XHRcdFx0aXNFcXVhbChkb2N1bWVudERpZmZJdGVtLm1vZGlmaWVkVXJpLCBtdWx0aURpZmZJdGVtLm1vZGlmaWVkVXJpKSlcblx0XHRcdFx0Py5jb2xsYXBzZWQuc2V0KHRydWUsIHRyYW5zYWN0aW9uKTtcblx0XHR9XG5cdH1cbn1cblxuaW50ZXJmYWNlIFN0b3JlZFNlc3Npb25TdGF0ZSB7XG5cdHJlYWRvbmx5IGluaXRpYWxGaWxlQ29udGVudHM6IFJlc291cmNlTWFwPHN0cmluZz47XG5cdHJlYWRvbmx5IHBlbmRpbmdTbmFwc2hvdD86IElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wO1xuXHRyZWFkb25seSByZWNlbnRTbmFwc2hvdDogSUNoYXRFZGl0aW5nU2Vzc2lvblN0b3A7XG5cdHJlYWRvbmx5IGxpbmVhckhpc3RvcnlJbmRleDogbnVtYmVyO1xuXHRyZWFkb25seSBsaW5lYXJIaXN0b3J5OiByZWFkb25seSBJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3RbXTtcbn1cblxuY2xhc3MgQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlc3Npb25JZDogc3RyaW5nLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0KSB7IH1cblxuXHRwcml2YXRlIF9nZXRTdG9yYWdlTG9jYXRpb24oKTogVVJJIHtcblx0XHRjb25zdCB3b3Jrc3BhY2VJZCA9IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmlkO1xuXHRcdHJldHVybiBqb2luUGF0aCh0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsIHdvcmtzcGFjZUlkLCAnY2hhdEVkaXRpbmdTZXNzaW9ucycsIHRoaXMuY2hhdFNlc3Npb25JZCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcmVzdG9yZVN0YXRlKCk6IFByb21pc2U8U3RvcmVkU2Vzc2lvblN0YXRlIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc3RvcmFnZUxvY2F0aW9uID0gdGhpcy5fZ2V0U3RvcmFnZUxvY2F0aW9uKCk7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnRzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8c3RyaW5nPj4oKTtcblx0XHRjb25zdCBnZXRGaWxlQ29udGVudCA9IChoYXNoOiBzdHJpbmcpID0+IHtcblx0XHRcdGxldCByZWFkUHJvbWlzZSA9IGZpbGVDb250ZW50cy5nZXQoaGFzaCk7XG5cdFx0XHRpZiAoIXJlYWRQcm9taXNlKSB7XG5cdFx0XHRcdHJlYWRQcm9taXNlID0gdGhpcy5fZmlsZVNlcnZpY2UucmVhZEZpbGUoam9pblBhdGgoc3RvcmFnZUxvY2F0aW9uLCBTVE9SQUdFX0NPTlRFTlRTX0ZPTERFUiwgaGFzaCkpLnRoZW4oY29udGVudCA9PiBjb250ZW50LnZhbHVlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRmaWxlQ29udGVudHMuc2V0KGhhc2gsIHJlYWRQcm9taXNlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZWFkUHJvbWlzZTtcblx0XHR9O1xuXHRcdGNvbnN0IGRlc2VyaWFsaXplUmVzb3VyY2VNYXAgPSA8VD4ocmVzb3VyY2VNYXA6IFJlc291cmNlTWFwRFRPPFQ+LCBkZXNlcmlhbGl6ZTogKHZhbHVlOiBhbnkpID0+IFQsIHJlc3VsdDogUmVzb3VyY2VNYXA8VD4pOiBSZXNvdXJjZU1hcDxUPiA9PiB7XG5cdFx0XHRyZXNvdXJjZU1hcC5mb3JFYWNoKChbcmVzb3VyY2VVUkksIHZhbHVlXSkgPT4ge1xuXHRcdFx0XHRyZXN1bHQuc2V0KFVSSS5wYXJzZShyZXNvdXJjZVVSSSksIGRlc2VyaWFsaXplKHZhbHVlKSk7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fTtcblx0XHRjb25zdCBkZXNlcmlhbGl6ZVNuYXBzaG90RW50cmllc0RUTyA9IGFzeW5jIChkdG9FbnRyaWVzOiBJU25hcHNob3RFbnRyeURUT1tdKTogUHJvbWlzZTxSZXNvdXJjZU1hcDxJU25hcHNob3RFbnRyeT4+ID0+IHtcblx0XHRcdGNvbnN0IGVudHJpZXMgPSBuZXcgUmVzb3VyY2VNYXA8SVNuYXBzaG90RW50cnk+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5RFRPIG9mIGR0b0VudHJpZXMpIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBhd2FpdCBkZXNlcmlhbGl6ZVNuYXBzaG90RW50cnkoZW50cnlEVE8pO1xuXHRcdFx0XHRlbnRyaWVzLnNldChlbnRyeS5yZXNvdXJjZSwgZW50cnkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGVudHJpZXM7XG5cdFx0fTtcblx0XHRjb25zdCBkZXNlcmlhbGl6ZUNoYXRFZGl0aW5nU3RvcERUTyA9IGFzeW5jIChzdG9wRFRPOiBJQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcERUTyB8IElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTyk6IFByb21pc2U8SUNoYXRFZGl0aW5nU2Vzc2lvblN0b3A+ID0+IHtcblx0XHRcdGNvbnN0IGVudHJpZXMgPSBhd2FpdCBkZXNlcmlhbGl6ZVNuYXBzaG90RW50cmllc0RUTyhzdG9wRFRPLmVudHJpZXMpO1xuXHRcdFx0Y29uc3Qgd29ya2luZ1NldCA9IGRlc2VyaWFsaXplUmVzb3VyY2VNYXAoc3RvcERUTy53b3JraW5nU2V0LCAodmFsdWUpID0+IHZhbHVlLCBuZXcgUmVzb3VyY2VNYXAoKSk7XG5cdFx0XHRyZXR1cm4geyBzdG9wSWQ6ICdzdG9wSWQnIGluIHN0b3BEVE8gPyBzdG9wRFRPLnN0b3BJZCA6IHVuZGVmaW5lZCwgd29ya2luZ1NldCwgZW50cmllcyB9O1xuXHRcdH07XG5cdFx0Y29uc3Qgbm9ybWFsaXplU25hcHNob3REdG9zID0gKHNuYXBzaG90OiBJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3REVE8gfCBJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3REVE8yKTogSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90RFRPMiA9PiB7XG5cdFx0XHRpZiAoJ3N0b3BzJyBpbiBzbmFwc2hvdCkge1xuXHRcdFx0XHRyZXR1cm4gc25hcHNob3Q7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4geyByZXF1ZXN0SWQ6IHNuYXBzaG90LnJlcXVlc3RJZCwgc3RvcHM6IFt7IHN0b3BJZDogdW5kZWZpbmVkLCBlbnRyaWVzOiBzbmFwc2hvdC5lbnRyaWVzLCB3b3JraW5nU2V0OiBzbmFwc2hvdC53b3JraW5nU2V0IH1dLCBwb3N0RWRpdDogdW5kZWZpbmVkIH07XG5cdFx0fTtcblx0XHRjb25zdCBkZXNlcmlhbGl6ZUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90ID0gYXN5bmMgKHN0YXJ0SW5kZXg6IG51bWJlciwgc25hcHNob3Q6IElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTzIpOiBQcm9taXNlPElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdD4gPT4ge1xuXHRcdFx0Y29uc3Qgc3RvcHMgPSBhd2FpdCBQcm9taXNlLmFsbChzbmFwc2hvdC5zdG9wcy5tYXAoZGVzZXJpYWxpemVDaGF0RWRpdGluZ1N0b3BEVE8pKTtcblx0XHRcdHJldHVybiB7IHN0YXJ0SW5kZXgsIHJlcXVlc3RJZDogc25hcHNob3QucmVxdWVzdElkLCBzdG9wcywgcG9zdEVkaXQ6IHNuYXBzaG90LnBvc3RFZGl0ICYmIGF3YWl0IGRlc2VyaWFsaXplU25hcHNob3RFbnRyaWVzRFRPKHNuYXBzaG90LnBvc3RFZGl0KSB9O1xuXHRcdH07XG5cdFx0Y29uc3QgZGVzZXJpYWxpemVTbmFwc2hvdEVudHJ5ID0gYXN5bmMgKGVudHJ5OiBJU25hcHNob3RFbnRyeURUTykgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVzb3VyY2U6IFVSSS5wYXJzZShlbnRyeS5yZXNvdXJjZSksXG5cdFx0XHRcdGxhbmd1YWdlSWQ6IGVudHJ5Lmxhbmd1YWdlSWQsXG5cdFx0XHRcdG9yaWdpbmFsOiBhd2FpdCBnZXRGaWxlQ29udGVudChlbnRyeS5vcmlnaW5hbEhhc2gpLFxuXHRcdFx0XHRjdXJyZW50OiBhd2FpdCBnZXRGaWxlQ29udGVudChlbnRyeS5jdXJyZW50SGFzaCksXG5cdFx0XHRcdG9yaWdpbmFsVG9DdXJyZW50RWRpdDogT2Zmc2V0RWRpdC5mcm9tSnNvbihlbnRyeS5vcmlnaW5hbFRvQ3VycmVudEVkaXQpLFxuXHRcdFx0XHRzdGF0ZTogZW50cnkuc3RhdGUsXG5cdFx0XHRcdHNuYXBzaG90VXJpOiBVUkkucGFyc2UoZW50cnkuc25hcHNob3RVcmkpLFxuXHRcdFx0XHR0ZWxlbWV0cnlJbmZvOiB7IHJlcXVlc3RJZDogZW50cnkudGVsZW1ldHJ5SW5mby5yZXF1ZXN0SWQsIGFnZW50SWQ6IGVudHJ5LnRlbGVtZXRyeUluZm8uYWdlbnRJZCwgY29tbWFuZDogZW50cnkudGVsZW1ldHJ5SW5mby5jb21tYW5kLCBzZXNzaW9uSWQ6IHRoaXMuY2hhdFNlc3Npb25JZCwgcmVzdWx0OiB1bmRlZmluZWQgfVxuXHRcdFx0fSBzYXRpc2ZpZXMgSVNuYXBzaG90RW50cnk7XG5cdFx0fTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qgc3RhdGVGaWxlUGF0aCA9IGpvaW5QYXRoKHN0b3JhZ2VMb2NhdGlvbiwgU1RPUkFHRV9TVEFURV9GSUxFKTtcblx0XHRcdGlmICghIGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmV4aXN0cyhzdGF0ZUZpbGVQYXRoKSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBjaGF0RWRpdGluZ1Nlc3Npb246IE5vIGVkaXRpbmcgc2Vzc2lvbiBzdGF0ZSBmb3VuZCBhdCAke3N0YXRlRmlsZVBhdGgudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYGNoYXRFZGl0aW5nU2Vzc2lvbjogUmVzdG9yaW5nIGVkaXRpbmcgc2Vzc2lvbiBhdCAke3N0YXRlRmlsZVBhdGgudG9TdHJpbmcoKX1gKTtcblx0XHRcdGNvbnN0IHN0YXRlRmlsZUNvbnRlbnQgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5yZWFkRmlsZShzdGF0ZUZpbGVQYXRoKTtcblx0XHRcdGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHN0YXRlRmlsZUNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSkgYXMgSUNoYXRFZGl0aW5nU2Vzc2lvbkRUTztcblx0XHRcdGlmICghQ09NUEFUSUJMRV9TVE9SQUdFX1ZFUlNJT05TLmluY2x1ZGVzKGRhdGEudmVyc2lvbikpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGxpbmVhckhpc3RvcnlJbmRleCA9IDA7XG5cdFx0XHRjb25zdCBsaW5lYXJIaXN0b3J5ID0gYXdhaXQgUHJvbWlzZS5hbGwoZGF0YS5saW5lYXJIaXN0b3J5Lm1hcChzbmFwc2hvdCA9PiB7XG5cdFx0XHRcdGNvbnN0IG5vcm0gPSBub3JtYWxpemVTbmFwc2hvdER0b3Moc25hcHNob3QpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBkZXNlcmlhbGl6ZUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90KGxpbmVhckhpc3RvcnlJbmRleCwgbm9ybSk7XG5cdFx0XHRcdGxpbmVhckhpc3RvcnlJbmRleCArPSBub3JtLnN0b3BzLmxlbmd0aDtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3QgaW5pdGlhbEZpbGVDb250ZW50cyA9IG5ldyBSZXNvdXJjZU1hcDxzdHJpbmc+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGZpbGVDb250ZW50RFRPIG9mIGRhdGEuaW5pdGlhbEZpbGVDb250ZW50cykge1xuXHRcdFx0XHRpbml0aWFsRmlsZUNvbnRlbnRzLnNldChVUkkucGFyc2UoZmlsZUNvbnRlbnREVE9bMF0pLCBhd2FpdCBnZXRGaWxlQ29udGVudChmaWxlQ29udGVudERUT1sxXSkpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGVuZGluZ1NuYXBzaG90ID0gZGF0YS5wZW5kaW5nU25hcHNob3QgPyBhd2FpdCBkZXNlcmlhbGl6ZUNoYXRFZGl0aW5nU3RvcERUTyhkYXRhLnBlbmRpbmdTbmFwc2hvdCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCByZWNlbnRTbmFwc2hvdCA9IGF3YWl0IGRlc2VyaWFsaXplQ2hhdEVkaXRpbmdTdG9wRFRPKGRhdGEucmVjZW50U25hcHNob3QpO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpbml0aWFsRmlsZUNvbnRlbnRzLFxuXHRcdFx0XHRwZW5kaW5nU25hcHNob3QsXG5cdFx0XHRcdHJlY2VudFNuYXBzaG90LFxuXHRcdFx0XHRsaW5lYXJIaXN0b3J5SW5kZXg6IGRhdGEubGluZWFySGlzdG9yeUluZGV4LFxuXHRcdFx0XHRsaW5lYXJIaXN0b3J5XG5cdFx0XHR9O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHJlc3RvcmluZyBjaGF0IGVkaXRpbmcgc2Vzc2lvbiBmcm9tICR7c3RvcmFnZUxvY2F0aW9uLnRvU3RyaW5nKCl9YCwgZSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc3RvcmVTdGF0ZShzdGF0ZTogU3RvcmVkU2Vzc2lvblN0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc3RvcmFnZUZvbGRlciA9IHRoaXMuX2dldFN0b3JhZ2VMb2NhdGlvbigpO1xuXHRcdGNvbnN0IGNvbnRlbnRzRm9sZGVyID0gVVJJLmpvaW5QYXRoKHN0b3JhZ2VGb2xkZXIsIFNUT1JBR0VfQ09OVEVOVFNfRk9MREVSKTtcblxuXHRcdC8vIHByZXBhcmUgdGhlIGNvbnRlbnQgZm9sZGVyXG5cdFx0Y29uc3QgZXhpc3RpbmdDb250ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UucmVzb2x2ZShjb250ZW50c0ZvbGRlcik7XG5cdFx0XHRzdGF0LmNoaWxkcmVuPy5mb3JFYWNoKGNoaWxkID0+IHtcblx0XHRcdFx0aWYgKGNoaWxkLmlzRmlsZSkge1xuXHRcdFx0XHRcdGV4aXN0aW5nQ29udGVudHMuYWRkKGNoaWxkLm5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHQvLyBkb2VzIG5vdCBleGlzdCwgY3JlYXRlXG5cdFx0XHRcdGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihjb250ZW50c0ZvbGRlcik7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIGNyZWF0aW5nIGNoYXQgZWRpdGluZyBzZXNzaW9uIGNvbnRlbnQgZm9sZGVyICR7Y29udGVudHNGb2xkZXIudG9TdHJpbmcoKX1gLCBlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVDb250ZW50cyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0Y29uc3QgYWRkRmlsZUNvbnRlbnQgPSAoY29udGVudDogc3RyaW5nKTogc3RyaW5nID0+IHtcblx0XHRcdGNvbnN0IHNoYUNvbXB1dGVyID0gbmV3IFN0cmluZ1NIQTEoKTtcblx0XHRcdHNoYUNvbXB1dGVyLnVwZGF0ZShjb250ZW50KTtcblx0XHRcdGNvbnN0IHNoYSA9IHNoYUNvbXB1dGVyLmRpZ2VzdCgpLnN1YnN0cmluZygwLCA3KTtcblx0XHRcdGZpbGVDb250ZW50cy5zZXQoc2hhLCBjb250ZW50KTtcblx0XHRcdHJldHVybiBzaGE7XG5cdFx0fTtcblx0XHRjb25zdCBzZXJpYWxpemVSZXNvdXJjZU1hcCA9IDxUPihyZXNvdXJjZU1hcDogUmVzb3VyY2VNYXA8VD4sIHNlcmlhbGl6ZTogKHZhbHVlOiBUKSA9PiBhbnkpOiBSZXNvdXJjZU1hcERUTzxUPiA9PiB7XG5cdFx0XHRyZXR1cm4gQXJyYXkuZnJvbShyZXNvdXJjZU1hcC5lbnRyaWVzKCkpLm1hcCgoW3Jlc291cmNlVVJJLCB2YWx1ZV0pID0+IFtyZXNvdXJjZVVSSS50b1N0cmluZygpLCBzZXJpYWxpemUodmFsdWUpXSk7XG5cdFx0fTtcblx0XHRjb25zdCBzZXJpYWxpemVDaGF0RWRpdGluZ1Nlc3Npb25TdG9wID0gKHN0b3A6IElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wKTogSUNoYXRFZGl0aW5nU2Vzc2lvblN0b3BEVE8gPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0c3RvcElkOiBzdG9wLnN0b3BJZCxcblx0XHRcdFx0d29ya2luZ1NldDogc2VyaWFsaXplUmVzb3VyY2VNYXAoc3RvcC53b3JraW5nU2V0LCB2YWx1ZSA9PiB2YWx1ZSksXG5cdFx0XHRcdGVudHJpZXM6IEFycmF5LmZyb20oc3RvcC5lbnRyaWVzLnZhbHVlcygpKS5tYXAoc2VyaWFsaXplU25hcHNob3RFbnRyeSlcblx0XHRcdH07XG5cdFx0fTtcblx0XHRjb25zdCBzZXJpYWxpemVDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdCA9IChzbmFwc2hvdDogSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90KTogSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90RFRPMiA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXF1ZXN0SWQ6IHNuYXBzaG90LnJlcXVlc3RJZCxcblx0XHRcdFx0c3RvcHM6IHNuYXBzaG90LnN0b3BzLm1hcChzZXJpYWxpemVDaGF0RWRpdGluZ1Nlc3Npb25TdG9wKSxcblx0XHRcdFx0cG9zdEVkaXQ6IHNuYXBzaG90LnBvc3RFZGl0ID8gQXJyYXkuZnJvbShzbmFwc2hvdC5wb3N0RWRpdC52YWx1ZXMoKSkubWFwKHNlcmlhbGl6ZVNuYXBzaG90RW50cnkpIDogdW5kZWZpbmVkXG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0Y29uc3Qgc2VyaWFsaXplU25hcHNob3RFbnRyeSA9IChlbnRyeTogSVNuYXBzaG90RW50cnkpOiBJU25hcHNob3RFbnRyeURUTyA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXNvdXJjZTogZW50cnkucmVzb3VyY2UudG9TdHJpbmcoKSxcblx0XHRcdFx0bGFuZ3VhZ2VJZDogZW50cnkubGFuZ3VhZ2VJZCxcblx0XHRcdFx0b3JpZ2luYWxIYXNoOiBhZGRGaWxlQ29udGVudChlbnRyeS5vcmlnaW5hbCksXG5cdFx0XHRcdGN1cnJlbnRIYXNoOiBhZGRGaWxlQ29udGVudChlbnRyeS5jdXJyZW50KSxcblx0XHRcdFx0b3JpZ2luYWxUb0N1cnJlbnRFZGl0OiBlbnRyeS5vcmlnaW5hbFRvQ3VycmVudEVkaXQuZWRpdHMubWFwKGVkaXQgPT4gKHsgcG9zOiBlZGl0LnJlcGxhY2VSYW5nZS5zdGFydCwgbGVuOiBlZGl0LnJlcGxhY2VSYW5nZS5sZW5ndGgsIHR4dDogZWRpdC5uZXdUZXh0IH0gc2F0aXNmaWVzIElTaW5nbGVPZmZzZXRFZGl0KSksXG5cdFx0XHRcdHN0YXRlOiBlbnRyeS5zdGF0ZSxcblx0XHRcdFx0c25hcHNob3RVcmk6IGVudHJ5LnNuYXBzaG90VXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdHRlbGVtZXRyeUluZm86IHsgcmVxdWVzdElkOiBlbnRyeS50ZWxlbWV0cnlJbmZvLnJlcXVlc3RJZCwgYWdlbnRJZDogZW50cnkudGVsZW1ldHJ5SW5mby5hZ2VudElkLCBjb21tYW5kOiBlbnRyeS50ZWxlbWV0cnlJbmZvLmNvbW1hbmQgfVxuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGRhdGE6IElDaGF0RWRpdGluZ1Nlc3Npb25EVE8gPSB7XG5cdFx0XHRcdHZlcnNpb246IFNUT1JBR0VfVkVSU0lPTixcblx0XHRcdFx0c2Vzc2lvbklkOiB0aGlzLmNoYXRTZXNzaW9uSWQsXG5cdFx0XHRcdGxpbmVhckhpc3Rvcnk6IHN0YXRlLmxpbmVhckhpc3RvcnkubWFwKHNlcmlhbGl6ZUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90KSxcblx0XHRcdFx0bGluZWFySGlzdG9yeUluZGV4OiBzdGF0ZS5saW5lYXJIaXN0b3J5SW5kZXgsXG5cdFx0XHRcdGluaXRpYWxGaWxlQ29udGVudHM6IHNlcmlhbGl6ZVJlc291cmNlTWFwKHN0YXRlLmluaXRpYWxGaWxlQ29udGVudHMsIHZhbHVlID0+IGFkZEZpbGVDb250ZW50KHZhbHVlKSksXG5cdFx0XHRcdHBlbmRpbmdTbmFwc2hvdDogc3RhdGUucGVuZGluZ1NuYXBzaG90ID8gc2VyaWFsaXplQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcChzdGF0ZS5wZW5kaW5nU25hcHNob3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRyZWNlbnRTbmFwc2hvdDogc2VyaWFsaXplQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcChzdGF0ZS5yZWNlbnRTbmFwc2hvdCksXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmRlYnVnKGBjaGF0RWRpdGluZ1Nlc3Npb246IFN0b3JpbmcgZWRpdGluZyBzZXNzaW9uIGF0ICR7c3RvcmFnZUZvbGRlci50b1N0cmluZygpfTogJHtmaWxlQ29udGVudHMuc2l6ZX0gZmlsZXNgKTtcblxuXHRcdFx0Zm9yIChjb25zdCBbaGFzaCwgY29udGVudF0gb2YgZmlsZUNvbnRlbnRzKSB7XG5cdFx0XHRcdGlmICghZXhpc3RpbmdDb250ZW50cy5oYXMoaGFzaCkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS53cml0ZUZpbGUoam9pblBhdGgoY29udGVudHNGb2xkZXIsIGhhc2gpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS53cml0ZUZpbGUoam9pblBhdGgoc3RvcmFnZUZvbGRlciwgU1RPUkFHRV9TVEFURV9GSUxFKSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShkYXRhLCB1bmRlZmluZWQsIDIpKSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgRXJyb3Igc3RvcmluZyBjaGF0IGVkaXRpbmcgc2Vzc2lvbiB0byAke3N0b3JhZ2VGb2xkZXIudG9TdHJpbmcoKX1gLCBlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY2xlYXJTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdG9yYWdlRm9sZGVyID0gdGhpcy5fZ2V0U3RvcmFnZUxvY2F0aW9uKCk7XG5cdFx0aWYgKGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLmV4aXN0cyhzdG9yYWdlRm9sZGVyKSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgY2hhdEVkaXRpbmdTZXNzaW9uOiBDbGVhcmluZyBlZGl0aW5nIHNlc3Npb24gYXQgJHtzdG9yYWdlRm9sZGVyLnRvU3RyaW5nKCl9YCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9maWxlU2VydmljZS5kZWwoc3RvcmFnZUZvbGRlciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZGVidWcoYEVycm9yIGNsZWFyaW5nIGNoYXQgZWRpdGluZyBzZXNzaW9uIGZyb20gJHtzdG9yYWdlRm9sZGVyLnRvU3RyaW5nKCl9YCwgZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90IHtcblx0LyoqXG5cdCAqIEluZGV4IG9mIHRoaXMgc2Vzc2lvbiBpbiB0aGUgbGluZWFyIGhpc3RvcnkuIEl0J3MgdGhlIHN1bSBvZiB0aGUgbGVuZ3Roc1xuXHQgKiBvZiBhbGwge0BsaW5rIHN0b3BzfSBwcmlvciB0aGlzIG9uZS5cblx0ICovXG5cdHJlYWRvbmx5IHN0YXJ0SW5kZXg6IG51bWJlcjtcblxuXHRyZWFkb25seSByZXF1ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0LyoqXG5cdCAqIEVkaXQgc3RvcHMgaW4gdGhlIHJlcXVlc3QuIEFsd2F5cyBpbml0aWFsbHkgcG9wdWxhdGQgd2l0aCBzdG9wSWQ6IHVuZGVmaW5kXG5cdCAqIGZvciB0aCByZXF1ZXN0J3MgaW5pdGlhbCBzdGF0ZS5cblx0ICpcblx0ICogSW52YXJpYW50OiBuZXZlciBlbXB0eS5cblx0ICovXG5cdHJlYWRvbmx5IHN0b3BzOiBJQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcFtdO1xuXG5cdC8qKiBTdG9wIHRoYXQgcmVwcmVzZW50cyBjaGFuZ2VzIGFmdGVyIHRoZSBsYXN0IHVuZG8gc3RvcCwga2VwdCBmb3IgZGlmZmluZyBwdXJwb3Nlcy4gKi9cblx0cmVhZG9ubHkgcG9zdEVkaXQ6IFJlc291cmNlTWFwPElTbmFwc2hvdEVudHJ5PiB8IHVuZGVmaW5lZDtcbn1cblxuaW50ZXJmYWNlIElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wIHtcblx0LyoqIEVkaXQgc3RvcCBJRCwgZmlyc3QgZm9yIGEgcmVxdWVzdCBpcyBhbHdheXMgdW5kZWZpbmVkLiAqL1xuXHRzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSB3b3JraW5nU2V0OiBSZXNvdXJjZU1hcDxXb3JraW5nU2V0RGlzcGxheU1ldGFkYXRhPjtcblx0cmVhZG9ubHkgZW50cmllczogUmVzb3VyY2VNYXA8SVNuYXBzaG90RW50cnk+O1xufVxuXG5pbnRlcmZhY2UgSUNoYXRFZGl0aW5nU2Vzc2lvblN0b3BEVE8ge1xuXHRyZWFkb25seSBzdG9wSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgd29ya2luZ1NldDogUmVzb3VyY2VNYXBEVE88V29ya2luZ1NldERpc3BsYXlNZXRhZGF0YT47XG5cdHJlYWRvbmx5IGVudHJpZXM6IElTbmFwc2hvdEVudHJ5RFRPW107XG59XG5cblxuaW50ZXJmYWNlIElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTyB7XG5cdHJlYWRvbmx5IHJlcXVlc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB3b3JraW5nU2V0OiBSZXNvdXJjZU1hcERUTzxXb3JraW5nU2V0RGlzcGxheU1ldGFkYXRhPjtcblx0cmVhZG9ubHkgZW50cmllczogSVNuYXBzaG90RW50cnlEVE9bXTtcbn1cblxuaW50ZXJmYWNlIElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTzIge1xuXHRyZWFkb25seSByZXF1ZXN0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgc3RvcHM6IElDaGF0RWRpdGluZ1Nlc3Npb25TdG9wRFRPW107XG5cdHJlYWRvbmx5IHBvc3RFZGl0OiBJU25hcHNob3RFbnRyeURUT1tdIHwgdW5kZWZpbmVkO1xufVxuXG5pbnRlcmZhY2UgSVNuYXBzaG90RW50cnlEVE8ge1xuXHRyZWFkb25seSByZXNvdXJjZTogc3RyaW5nO1xuXHRyZWFkb25seSBsYW5ndWFnZUlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IG9yaWdpbmFsSGFzaDogc3RyaW5nO1xuXHRyZWFkb25seSBjdXJyZW50SGFzaDogc3RyaW5nO1xuXHRyZWFkb25seSBvcmlnaW5hbFRvQ3VycmVudEVkaXQ6IElPZmZzZXRFZGl0O1xuXHRyZWFkb25seSBzdGF0ZTogV29ya2luZ1NldEVudHJ5U3RhdGU7XG5cdHJlYWRvbmx5IHNuYXBzaG90VXJpOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHRlbGVtZXRyeUluZm86IElNb2RpZmllZEVudHJ5VGVsZW1ldHJ5SW5mb0RUTztcbn1cblxuaW50ZXJmYWNlIElNb2RpZmllZEVudHJ5VGVsZW1ldHJ5SW5mb0RUTyB7XG5cdHJlYWRvbmx5IHJlcXVlc3RJZDogc3RyaW5nO1xuXHRyZWFkb25seSBhZ2VudElkPzogc3RyaW5nO1xuXHRyZWFkb25seSBjb21tYW5kPzogc3RyaW5nO1xufVxuXG50eXBlIFJlc291cmNlTWFwRFRPPFQ+ID0gW3N0cmluZywgVF1bXTtcblxuY29uc3QgQ09NUEFUSUJMRV9TVE9SQUdFX1ZFUlNJT05TID0gWzEsIDJdO1xuY29uc3QgU1RPUkFHRV9WRVJTSU9OID0gMjtcblxuLyoqIE9sZCBoaXN0b3J5IHVzZXMgSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90RFRPLCBuZXcgaGlzdG9yeSB1c2VzIElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTy4gKi9cbmludGVyZmFjZSBJQ2hhdEVkaXRpbmdTZXNzaW9uRFRPIHtcblx0cmVhZG9ubHkgdmVyc2lvbjogbnVtYmVyO1xuXHRyZWFkb25seSBzZXNzaW9uSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgcmVjZW50U25hcHNob3Q6IChJQ2hhdEVkaXRpbmdTZXNzaW9uU3RvcERUTyB8IElDaGF0RWRpdGluZ1Nlc3Npb25TbmFwc2hvdERUTyk7XG5cdHJlYWRvbmx5IGxpbmVhckhpc3Rvcnk6IChJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3REVE8yIHwgSUNoYXRFZGl0aW5nU2Vzc2lvblNuYXBzaG90RFRPKVtdO1xuXHRyZWFkb25seSBsaW5lYXJIaXN0b3J5SW5kZXg6IG51bWJlcjtcblx0cmVhZG9ubHkgcGVuZGluZ1NuYXBzaG90OiAoSUNoYXRFZGl0aW5nU2Vzc2lvblN0b3BEVE8gfCBJQ2hhdEVkaXRpbmdTZXNzaW9uU25hcHNob3REVE8pIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpbml0aWFsRmlsZUNvbnRlbnRzOiBSZXNvdXJjZU1hcERUTzxzdHJpbmc+O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsYUFBYSxxQkFBcUI7QUFDckQsU0FBUyxpQkFBd0IsV0FBVyxnQkFBZ0IsZUFBZTtBQUMzRSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FB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QWMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUFBLElBQzlGO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYSxhQUE0QjtBQUN4QyxVQUFNLGdCQUFnQixLQUFLLG9CQUFvQjtBQUMvQyxRQUFJLE1BQU0sS0FBSyxhQUFhLE9BQU8sYUFBYSxHQUFHO0FBQ2xELFdBQUssWUFBWSxNQUFNLG1EQUFtRCxjQUFjLFNBQVMsQ0FBQyxFQUFFO0FBQ3BHLFVBQUk7QUFDSCxjQUFNLEtBQUssYUFBYSxJQUFJLGVBQWUsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLE1BQy9ELFNBQVMsR0FBRztBQUNYLGFBQUssWUFBWSxNQUFNLDRDQUE0QyxjQUFjLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFBQSxNQUNqRztBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUE1TU0sNEJBQU47QUFBQSxFQUdHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FORztBQWdSTixNQUFNLDhCQUE4QixDQUFDLEdBQUcsQ0FBQztBQUN6QyxNQUFNLGtCQUFrQjsiLAogICJuYW1lcyI6IFsibmV3SGlzdG9yeSIsICJ0cmFuc2FjdGlvbiIsICJlIl0KfQo=
