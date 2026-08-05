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
import { coalesce, compareBy, delta } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ErrorNoTelemetry } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Iterable } from "../../../../../base/common/iterator.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../../base/common/linkedList.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { derived, observableValueOpts, runOnChange, ValueWithChangeEventFromObservable } from "../../../../../base/common/observable.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { compare } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { assertType } from "../../../../../base/common/types.js";
import { TextEdit } from "../../../../../editor/common/languages.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IDecorationsService } from "../../../../services/decorations/common/decorations.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IMultiDiffSourceResolverService, MultiDiffEditorItem } from "../../../multiDiffEditor/browser/multiDiffSourceResolverService.js";
import { CellUri } from "../../../notebook/common/notebookCommon.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, chatEditingAgentSupportsReadonlyReferencesContextKey, chatEditingResourceContextKey, ChatEditingSessionState, chatEditingSnapshotScheme, inChatEditingSessionContextKey, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { isCellTextEditOperation } from "../../common/chatModel.js";
import { IChatService } from "../../common/chatService.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ChatEditorInput } from "../chatEditorInput.js";
import { AbstractChatEditingModifiedFileEntry } from "./chatEditingModifiedFileEntry.js";
import { ChatEditingSession } from "./chatEditingSession.js";
import { ChatEditingSnapshotTextModelContentProvider, ChatEditingTextModelContentProvider } from "./chatEditingTextModelContentProviders.js";
let ChatEditingService = class extends Disposable {
  constructor(_instantiationService, multiDiffSourceResolverService, textModelService, contextKeyService, _chatService, _editorService, decorationsService, _fileService, lifecycleService, storageService, logService, extensionService, productService, notebookService) {
    super();
    this._instantiationService = _instantiationService;
    this._chatService = _chatService;
    this._editorService = _editorService;
    this._fileService = _fileService;
    this.lifecycleService = lifecycleService;
    this.notebookService = notebookService;
    this._sessionsObs = observableValueOpts({ equalsFn: (a, b) => false }, new LinkedList());
    this.editingSessionsObs = derived((r) => {
      const result = Array.from(this._sessionsObs.read(r));
      return result;
    });
    this._chatRelatedFilesProviders = /* @__PURE__ */ new Map();
    this._register(decorationsService.registerDecorationsProvider(_instantiationService.createInstance(ChatDecorationsProvider, this.editingSessionsObs)));
    this._register(multiDiffSourceResolverService.registerResolver(_instantiationService.createInstance(ChatEditingMultiDiffSourceResolver, this.editingSessionsObs)));
    this._register(textModelService.registerTextModelContentProvider(ChatEditingTextModelContentProvider.scheme, _instantiationService.createInstance(ChatEditingTextModelContentProvider, this)));
    this._register(textModelService.registerTextModelContentProvider(chatEditingSnapshotScheme, _instantiationService.createInstance(ChatEditingSnapshotTextModelContentProvider, this)));
    this._register(this._chatService.onDidDisposeSession((e) => {
      if (e.reason === "cleared") {
        this.getEditingSession(e.sessionId)?.stop();
      }
    }));
    const readonlyEnabledContextKey = chatEditingAgentSupportsReadonlyReferencesContextKey.bindTo(contextKeyService);
    const setReadonlyFilesEnabled = () => {
      const enabled = productService.quality !== "stable" && extensionService.extensions.some((e) => e.enabledApiProposals?.includes("chatReadonlyPromptReference"));
      readonlyEnabledContextKey.set(enabled);
    };
    setReadonlyFilesEnabled();
    this._register(extensionService.onDidRegisterExtensions(setReadonlyFilesEnabled));
    this._register(extensionService.onDidChangeExtensions(setReadonlyFilesEnabled));
    let storageTask;
    this._register(storageService.onWillSaveState(() => {
      const tasks = [];
      for (const session of this.editingSessionsObs.get()) {
        if (!session.isGlobalEditingSession) {
          continue;
        }
        tasks.push(session.storeState());
      }
      storageTask = Promise.resolve(storageTask).then(() => Promise.all(tasks)).finally(() => storageTask = void 0);
    }));
    this._register(this.lifecycleService.onWillShutdown((e) => {
      if (!storageTask) {
        return;
      }
      e.join(storageTask, {
        id: "join.chatEditingSession",
        label: localize("join.chatEditingSession", "Saving chat edits history")
      });
    }));
  }
  dispose() {
    dispose(this._sessionsObs.get());
    super.dispose();
  }
  async startOrContinueGlobalEditingSession(chatModel, waitForRestore = true) {
    if (waitForRestore) {
      await this._restoringEditingSession;
    }
    const session = this.getEditingSession(chatModel.sessionId);
    if (session) {
      return session;
    }
    const result = await this.createEditingSession(chatModel, true);
    return result;
  }
  _lookupEntry(uri) {
    for (const item of Iterable.concat(this.editingSessionsObs.get())) {
      const candidate = item.getEntry(uri);
      if (candidate instanceof AbstractChatEditingModifiedFileEntry) {
        return candidate.acquire();
      }
    }
    return void 0;
  }
  getEditingSession(chatSessionId) {
    return this.editingSessionsObs.get().find((candidate) => candidate.chatSessionId === chatSessionId);
  }
  async createEditingSession(chatModel, global = false) {
    assertType(this.getEditingSession(chatModel.sessionId) === void 0, "CANNOT have more than one editing session per chat session");
    const session = this._instantiationService.createInstance(ChatEditingSession, chatModel.sessionId, global, this._lookupEntry.bind(this));
    await session.init();
    const list = this._sessionsObs.get();
    const removeSession = list.unshift(session);
    const store = new DisposableStore();
    this._store.add(store);
    store.add(this.installAutoApplyObserver(session, chatModel));
    store.add(session.onDidDispose((e) => {
      removeSession();
      this._sessionsObs.set(list, void 0);
      this._store.delete(store);
    }));
    this._sessionsObs.set(list, void 0);
    return session;
  }
  installAutoApplyObserver(session, chatModel) {
    if (!chatModel) {
      throw new ErrorNoTelemetry(`Edit session was created for a non-existing chat session: ${session.chatSessionId}`);
    }
    const observerDisposables = new DisposableStore();
    observerDisposables.add(chatModel.onDidChange(async (e) => {
      if (e.kind !== "addRequest") {
        return;
      }
      session.createSnapshot(e.request.id, void 0);
      const responseModel = e.request.response;
      if (responseModel) {
        this.observerEditsInResponse(e.request.id, responseModel, session, observerDisposables);
      }
    }));
    observerDisposables.add(chatModel.onDidDispose(() => observerDisposables.dispose()));
    return observerDisposables;
  }
  observerEditsInResponse(requestId, responseModel, session, observerDisposables) {
    const editsSeen = [];
    const editedFilesExist = new ResourceMap();
    const ensureEditorOpen = (partUri) => {
      const uri = CellUri.parse(partUri)?.notebook ?? partUri;
      if (editedFilesExist.has(uri)) {
        return;
      }
      const fileExists = this.notebookService.getNotebookTextModel(uri) ? Promise.resolve(true) : this._fileService.exists(uri);
      editedFilesExist.set(uri, fileExists.then((e) => {
        if (!e) {
          return;
        }
        const activeUri = this._editorService.activeEditorPane?.input.resource;
        const inactive = this._editorService.activeEditorPane?.input instanceof ChatEditorInput && this._editorService.activeEditorPane.input.sessionId === session.chatSessionId || Boolean(activeUri && session.entries.get().find((entry) => isEqual(activeUri, entry.modifiedURI)));
        this._editorService.openEditor({ resource: uri, options: { inactive, preserveFocus: true, pinned: true } });
      }));
    };
    const onResponseComplete = () => {
      for (const remaining of editsSeen) {
        remaining?.streaming.complete();
      }
      if (responseModel.result?.errorDetails && !responseModel.result.errorDetails.responseIsIncomplete) {
        session.restoreSnapshot(responseModel.requestId, void 0);
      }
      editsSeen.length = 0;
      editedFilesExist.clear();
    };
    const handleResponseParts = async () => {
      if (responseModel.isCanceled) {
        return;
      }
      let undoStop;
      for (let i = 0; i < responseModel.response.value.length; i++) {
        const part = responseModel.response.value[i];
        if (part.kind === "undoStop") {
          undoStop = part.id;
          continue;
        }
        if (part.kind !== "textEditGroup" && part.kind !== "notebookEditGroup") {
          continue;
        }
        ensureEditorOpen(part.uri);
        let entry = editsSeen[i];
        if (!entry) {
          entry = { seen: 0, streaming: session.startStreamingEdits(CellUri.parse(part.uri)?.notebook ?? part.uri, responseModel, undoStop) };
          editsSeen[i] = entry;
        }
        const isFirst = entry.seen === 0;
        const newEdits = part.edits.slice(entry.seen).flat();
        entry.seen = part.edits.length;
        if (newEdits.length > 0 || isFirst) {
          if (part.kind === "notebookEditGroup") {
            newEdits.forEach((edit) => {
              if (TextEdit.isTextEdit(edit)) {
                return;
              } else if (isCellTextEditOperation(edit)) {
                entry.streaming.pushNotebookCellText(edit.uri, [edit.edit]);
              } else {
                entry.streaming.pushNotebook([edit]);
              }
            });
          } else if (part.kind === "textEditGroup") {
            entry.streaming.pushText(newEdits);
          }
        }
        if (part.done) {
          entry.streaming.complete();
        }
      }
    };
    if (responseModel.isComplete) {
      handleResponseParts().then(() => {
        onResponseComplete();
      });
    } else {
      const disposable = observerDisposables.add(responseModel.onDidChange((e2) => {
        if (e2.reason === "undoStop") {
          session.createSnapshot(requestId, e2.id);
        } else {
          handleResponseParts().then(() => {
            if (responseModel.isComplete) {
              onResponseComplete();
              observerDisposables.delete(disposable);
            }
          });
        }
      }));
    }
  }
  hasRelatedFilesProviders() {
    return this._chatRelatedFilesProviders.size > 0;
  }
  registerRelatedFilesProvider(handle, provider) {
    this._chatRelatedFilesProviders.set(handle, provider);
    return toDisposable(() => {
      this._chatRelatedFilesProviders.delete(handle);
    });
  }
  async getRelatedFiles(chatSessionId, prompt, files, token) {
    const providers = Array.from(this._chatRelatedFilesProviders.values());
    const result = await Promise.all(providers.map(async (provider) => {
      try {
        const relatedFiles = await provider.provideRelatedFiles({ prompt, files }, token);
        if (relatedFiles?.length) {
          return { group: provider.description, files: relatedFiles };
        }
        return void 0;
      } catch (e) {
        return void 0;
      }
    }));
    return coalesce(result);
  }
};
ChatEditingService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IMultiDiffSourceResolverService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IDecorationsService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILifecycleService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IExtensionService),
  __decorateParam(12, IProductService),
  __decorateParam(13, INotebookService)
], ChatEditingService);
function observeArrayChanges(obs, compare2, store) {
  const emitter = store.add(new Emitter());
  store.add(runOnChange(obs, (newArr, oldArr) => {
    const change = delta(oldArr || [], newArr, compare2);
    const changedElements = [].concat(change.added).concat(change.removed);
    emitter.fire(changedElements);
  }));
  return emitter.event;
}
let ChatDecorationsProvider = class extends Disposable {
  constructor(_sessions, _chatAgentService) {
    super();
    this._sessions = _sessions;
    this._chatAgentService = _chatAgentService;
    this.label = localize("chat", "Chat Editing");
    this._currentEntries = derived(this, (r) => {
      const sessions = this._sessions.read(r);
      if (!sessions) {
        return [];
      }
      const result = [];
      for (const session of sessions) {
        if (session.state.read(r) !== ChatEditingSessionState.Disposed) {
          const entries = session.entries.read(r);
          result.push(...entries);
        }
      }
      return result;
    });
    this._currentlyEditingUris = derived(this, (r) => {
      const uri = this._currentEntries.read(r);
      return uri.filter((entry) => entry.isCurrentlyBeingModifiedBy.read(r)).map((entry) => entry.modifiedURI);
    });
    this._modifiedUris = derived(this, (r) => {
      const uri = this._currentEntries.read(r);
      return uri.filter((entry) => !entry.isCurrentlyBeingModifiedBy.read(r) && entry.state.read(r) === WorkingSetEntryState.Modified).map((entry) => entry.modifiedURI);
    });
    this.onDidChange = Event.any(
      observeArrayChanges(this._currentlyEditingUris, compareBy((uri) => uri.toString(), compare), this._store),
      observeArrayChanges(this._modifiedUris, compareBy((uri) => uri.toString(), compare), this._store)
    );
  }
  provideDecorations(uri, _token) {
    const isCurrentlyBeingModified = this._currentlyEditingUris.get().some((e) => e.toString() === uri.toString());
    if (isCurrentlyBeingModified) {
      return {
        weight: 1e3,
        letter: ThemeIcon.modify(Codicon.loading, "spin"),
        bubble: false
      };
    }
    const isModified = this._modifiedUris.get().some((e) => e.toString() === uri.toString());
    if (isModified) {
      const defaultAgentName = this._chatAgentService.getDefaultAgent(ChatAgentLocation.EditingSession)?.fullName;
      return {
        weight: 1e3,
        letter: Codicon.diffModified,
        tooltip: defaultAgentName ? localize("chatEditing.modified", "Pending changes from {0}", defaultAgentName) : localize("chatEditing.modified2", "Pending changes from chat"),
        bubble: true
      };
    }
    return void 0;
  }
};
ChatDecorationsProvider = __decorateClass([
  __decorateParam(1, IChatAgentService)
], ChatDecorationsProvider);
let ChatEditingMultiDiffSourceResolver = class {
  constructor(_editingSessionsObs, _instantiationService) {
    this._editingSessionsObs = _editingSessionsObs;
    this._instantiationService = _instantiationService;
  }
  canHandleUri(uri) {
    return uri.scheme === CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME;
  }
  async resolveDiffSource(uri) {
    const thisSession = derived(this, (r) => {
      return this._editingSessionsObs.read(r).find((candidate) => candidate.chatSessionId === uri.authority);
    });
    return this._instantiationService.createInstance(ChatEditingMultiDiffSource, thisSession);
  }
};
ChatEditingMultiDiffSourceResolver = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ChatEditingMultiDiffSourceResolver);
class ChatEditingMultiDiffSource {
  constructor(_currentSession) {
    this._currentSession = _currentSession;
    this._resources = derived(this, (reader) => {
      const currentSession = this._currentSession.read(reader);
      if (!currentSession) {
        return [];
      }
      const entries = currentSession.entries.read(reader);
      return entries.map((entry) => {
        return new MultiDiffEditorItem(
          entry.originalURI,
          entry.modifiedURI,
          void 0,
          {
            [chatEditingResourceContextKey.key]: entry.entryId
            // [inChatEditingSessionContextKey.key]: true
          }
        );
      });
    });
    this.resources = new ValueWithChangeEventFromObservable(this._resources);
    this.contextKeys = {
      [inChatEditingSessionContextKey.key]: true
    };
  }
}
export {
  ChatEditingMultiDiffSourceResolver,
  ChatEditingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdTZXJ2aWNlSW1wbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNvYWxlc2NlLCBjb21wYXJlQnksIGRlbHRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFcnJvck5vVGVsZW1ldHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTGlua2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZExpc3QuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgZGVyaXZlZCwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZU9wdHMsIHJ1bk9uQ2hhbmdlLCBWYWx1ZVdpdGhDaGFuZ2VFdmVudEZyb21PYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGNvbXBhcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbkRhdGEsIElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElNdWx0aURpZmZTb3VyY2VSZXNvbHZlciwgSU11bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZSwgSVJlc29sdmVkTXVsdGlEaWZmU291cmNlLCBNdWx0aURpZmZFZGl0b3JJdGVtIH0gZnJvbSAnLi4vLi4vLi4vbXVsdGlEaWZmRWRpdG9yL2Jyb3dzZXIvbXVsdGlEaWZmU291cmNlUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENlbGxVcmkgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDSEFUX0VESVRJTkdfTVVMVElfRElGRl9TT1VSQ0VfUkVTT0xWRVJfU0NIRU1FLCBjaGF0RWRpdGluZ0FnZW50U3VwcG9ydHNSZWFkb25seVJlZmVyZW5jZXNDb250ZXh0S2V5LCBjaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUsIGNoYXRFZGl0aW5nU25hcHNob3RTY2hlbWUsIElDaGF0RWRpdGluZ1NlcnZpY2UsIElDaGF0RWRpdGluZ1Nlc3Npb24sIElDaGF0UmVsYXRlZEZpbGUsIElDaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXIsIElNb2RpZmllZEZpbGVFbnRyeSwgaW5DaGF0RWRpdGluZ1Nlc3Npb25Db250ZXh0S2V5LCBJU3RyZWFtaW5nRWRpdHMsIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZWwsIElDaGF0UmVzcG9uc2VNb2RlbCwgaXNDZWxsVGV4dEVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvcklucHV0IH0gZnJvbSAnLi4vY2hhdEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEFic3RyYWN0Q2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeSB9IGZyb20gJy4vY2hhdEVkaXRpbmdNb2RpZmllZEZpbGVFbnRyeS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ1Nlc3Npb24gfSBmcm9tICcuL2NoYXRFZGl0aW5nU2Vzc2lvbi5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ1NuYXBzaG90VGV4dE1vZGVsQ29udGVudFByb3ZpZGVyLCBDaGF0RWRpdGluZ1RleHRNb2RlbENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4vY2hhdEVkaXRpbmdUZXh0TW9kZWxDb250ZW50UHJvdmlkZXJzLmpzJztcblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2hhdEVkaXRpbmdTZXJ2aWNlIHtcblxuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uc09icyA9IG9ic2VydmFibGVWYWx1ZU9wdHM8TGlua2VkTGlzdDxDaGF0RWRpdGluZ1Nlc3Npb24+Pih7IGVxdWFsc0ZuOiAoYSwgYikgPT4gZmFsc2UgfSwgbmV3IExpbmtlZExpc3QoKSk7XG5cblx0cmVhZG9ubHkgZWRpdGluZ1Nlc3Npb25zT2JzOiBJT2JzZXJ2YWJsZTxyZWFkb25seSBJQ2hhdEVkaXRpbmdTZXNzaW9uW10+ID0gZGVyaXZlZChyID0+IHtcblx0XHRjb25zdCByZXN1bHQgPSBBcnJheS5mcm9tKHRoaXMuX3Nlc3Npb25zT2JzLnJlYWQocikpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH0pO1xuXG5cdHByaXZhdGUgX3Jlc3RvcmluZ0VkaXRpbmdTZXNzaW9uOiBQcm9taXNlPGFueT4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfY2hhdFJlbGF0ZWRGaWxlc1Byb3ZpZGVycyA9IG5ldyBNYXA8bnVtYmVyLCBJQ2hhdFJlbGF0ZWRGaWxlc1Byb3ZpZGVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU11bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZSBtdWx0aURpZmZTb3VyY2VSZXNvbHZlclNlcnZpY2U6IElNdWx0aURpZmZTb3VyY2VSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRGVjb3JhdGlvbnNTZXJ2aWNlIGRlY29yYXRpb25zU2VydmljZTogSURlY29yYXRpb25zU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGVjb3JhdGlvbnNTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvbnNQcm92aWRlcihfaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdERlY29yYXRpb25zUHJvdmlkZXIsIHRoaXMuZWRpdGluZ1Nlc3Npb25zT2JzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG11bHRpRGlmZlNvdXJjZVJlc29sdmVyU2VydmljZS5yZWdpc3RlclJlc29sdmVyKF9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ011bHRpRGlmZlNvdXJjZVJlc29sdmVyLCB0aGlzLmVkaXRpbmdTZXNzaW9uc09icykpKTtcblxuXHRcdC8vIFRPRE9AanJpZWtlblxuXHRcdC8vIHNvbWUgdWdseSBjYXN0aW5nIHNvIHRoYXQgdGhpcyBzZXJ2aWNlIGNhbiBwYXNzIGl0c2VsZiBhcyBhcmd1bWVudCBpbnN0YWQgYXMgc2VydmljZSBkZXBlbmRlbnlcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXh0TW9kZWxTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKENoYXRFZGl0aW5nVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyLnNjaGVtZSwgX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIGFzIGFueSwgdGhpcykpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXh0TW9kZWxTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKGNoYXRFZGl0aW5nU25hcHNob3RTY2hlbWUsIF9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0RWRpdGluZ1NuYXBzaG90VGV4dE1vZGVsQ29udGVudFByb3ZpZGVyIGFzIGFueSwgdGhpcykpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NoYXRTZXJ2aWNlLm9uRGlkRGlzcG9zZVNlc3Npb24oKGUpID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiA9PT0gJ2NsZWFyZWQnKSB7XG5cdFx0XHRcdHRoaXMuZ2V0RWRpdGluZ1Nlc3Npb24oZS5zZXNzaW9uSWQpPy5zdG9wKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gdG9kb0Bjb25ub3I0MzEyOiB0ZW1wb3JhcnkgdW50aWwgY2hhdFJlYWRvbmx5UHJvbXB0UmVmZXJlbmNlIHByb3Bvc2FsIGlzIGZpbmFsaXplZFxuXHRcdGNvbnN0IHJlYWRvbmx5RW5hYmxlZENvbnRleHRLZXkgPSBjaGF0RWRpdGluZ0FnZW50U3VwcG9ydHNSZWFkb25seVJlZmVyZW5jZXNDb250ZXh0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3Qgc2V0UmVhZG9ubHlGaWxlc0VuYWJsZWQgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBlbmFibGVkID0gcHJvZHVjdFNlcnZpY2UucXVhbGl0eSAhPT0gJ3N0YWJsZScgJiYgZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLnNvbWUoZSA9PiBlLmVuYWJsZWRBcGlQcm9wb3NhbHM/LmluY2x1ZGVzKCdjaGF0UmVhZG9ubHlQcm9tcHRSZWZlcmVuY2UnKSk7XG5cdFx0XHRyZWFkb25seUVuYWJsZWRDb250ZXh0S2V5LnNldChlbmFibGVkKTtcblx0XHR9O1xuXHRcdHNldFJlYWRvbmx5RmlsZXNFbmFibGVkKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uU2VydmljZS5vbkRpZFJlZ2lzdGVyRXh0ZW5zaW9ucyhzZXRSZWFkb25seUZpbGVzRW5hYmxlZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGV4dGVuc2lvblNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25zKHNldFJlYWRvbmx5RmlsZXNFbmFibGVkKSk7XG5cblxuXHRcdGxldCBzdG9yYWdlVGFzazogUHJvbWlzZTxhbnk+IHwgdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHtcblx0XHRcdGNvbnN0IHRhc2tzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IHNlc3Npb24gb2YgdGhpcy5lZGl0aW5nU2Vzc2lvbnNPYnMuZ2V0KCkpIHtcblx0XHRcdFx0aWYgKCFzZXNzaW9uLmlzR2xvYmFsRWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0YXNrcy5wdXNoKChzZXNzaW9uIGFzIENoYXRFZGl0aW5nU2Vzc2lvbikuc3RvcmVTdGF0ZSgpKTtcblx0XHRcdH1cblxuXHRcdFx0c3RvcmFnZVRhc2sgPSBQcm9taXNlLnJlc29sdmUoc3RvcmFnZVRhc2spXG5cdFx0XHRcdC50aGVuKCgpID0+IFByb21pc2UuYWxsKHRhc2tzKSlcblx0XHRcdFx0LmZpbmFsbHkoKCkgPT4gc3RvcmFnZVRhc2sgPSB1bmRlZmluZWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bihlID0+IHtcblx0XHRcdGlmICghc3RvcmFnZVRhc2spIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0ZS5qb2luKHN0b3JhZ2VUYXNrLCB7XG5cdFx0XHRcdGlkOiAnam9pbi5jaGF0RWRpdGluZ1Nlc3Npb24nLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2pvaW4uY2hhdEVkaXRpbmdTZXNzaW9uJywgXCJTYXZpbmcgY2hhdCBlZGl0cyBoaXN0b3J5XCIpXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGRpc3Bvc2UodGhpcy5fc2Vzc2lvbnNPYnMuZ2V0KCkpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGFzeW5jIHN0YXJ0T3JDb250aW51ZUdsb2JhbEVkaXRpbmdTZXNzaW9uKGNoYXRNb2RlbDogQ2hhdE1vZGVsLCB3YWl0Rm9yUmVzdG9yZSA9IHRydWUpOiBQcm9taXNlPElDaGF0RWRpdGluZ1Nlc3Npb24+IHtcblx0XHRpZiAod2FpdEZvclJlc3RvcmUpIHtcblx0XHRcdGF3YWl0IHRoaXMuX3Jlc3RvcmluZ0VkaXRpbmdTZXNzaW9uO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLmdldEVkaXRpbmdTZXNzaW9uKGNoYXRNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm4gc2Vzc2lvbjtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVFZGl0aW5nU2Vzc2lvbihjaGF0TW9kZWwsIHRydWUpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXG5cdHByaXZhdGUgX2xvb2t1cEVudHJ5KHVyaTogVVJJKTogQWJzdHJhY3RDaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5IHwgdW5kZWZpbmVkIHtcblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBJdGVyYWJsZS5jb25jYXQodGhpcy5lZGl0aW5nU2Vzc2lvbnNPYnMuZ2V0KCkpKSB7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGUgPSBpdGVtLmdldEVudHJ5KHVyaSk7XG5cdFx0XHRpZiAoY2FuZGlkYXRlIGluc3RhbmNlb2YgQWJzdHJhY3RDaGF0RWRpdGluZ01vZGlmaWVkRmlsZUVudHJ5KSB7XG5cdFx0XHRcdC8vIG1ha2Ugc3VyZSB0byByZWYtY291bnQgdGhpcyBvYmplY3Rcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZS5hY3F1aXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRFZGl0aW5nU2Vzc2lvbihjaGF0U2Vzc2lvbklkOiBzdHJpbmcpOiBJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5lZGl0aW5nU2Vzc2lvbnNPYnMuZ2V0KClcblx0XHRcdC5maW5kKGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUuY2hhdFNlc3Npb25JZCA9PT0gY2hhdFNlc3Npb25JZCk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVFZGl0aW5nU2Vzc2lvbihjaGF0TW9kZWw6IENoYXRNb2RlbCwgZ2xvYmFsOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPElDaGF0RWRpdGluZ1Nlc3Npb24+IHtcblxuXHRcdGFzc2VydFR5cGUodGhpcy5nZXRFZGl0aW5nU2Vzc2lvbihjaGF0TW9kZWwuc2Vzc2lvbklkKSA9PT0gdW5kZWZpbmVkLCAnQ0FOTk9UIGhhdmUgbW9yZSB0aGFuIG9uZSBlZGl0aW5nIHNlc3Npb24gcGVyIGNoYXQgc2Vzc2lvbicpO1xuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdE1vZGVsLnNlc3Npb25JZCwgZ2xvYmFsLCB0aGlzLl9sb29rdXBFbnRyeS5iaW5kKHRoaXMpKTtcblx0XHRhd2FpdCBzZXNzaW9uLmluaXQoKTtcblxuXHRcdGNvbnN0IGxpc3QgPSB0aGlzLl9zZXNzaW9uc09icy5nZXQoKTtcblx0XHRjb25zdCByZW1vdmVTZXNzaW9uID0gbGlzdC51bnNoaWZ0KHNlc3Npb24pO1xuXG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHN0b3JlKTtcblxuXHRcdHN0b3JlLmFkZCh0aGlzLmluc3RhbGxBdXRvQXBwbHlPYnNlcnZlcihzZXNzaW9uLCBjaGF0TW9kZWwpKTtcblxuXHRcdHN0b3JlLmFkZChzZXNzaW9uLm9uRGlkRGlzcG9zZShlID0+IHtcblx0XHRcdHJlbW92ZVNlc3Npb24oKTtcblx0XHRcdHRoaXMuX3Nlc3Npb25zT2JzLnNldChsaXN0LCB1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5fc3RvcmUuZGVsZXRlKHN0b3JlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zZXNzaW9uc09icy5zZXQobGlzdCwgdW5kZWZpbmVkKTtcblxuXHRcdHJldHVybiBzZXNzaW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBpbnN0YWxsQXV0b0FwcGx5T2JzZXJ2ZXIoc2Vzc2lvbjogQ2hhdEVkaXRpbmdTZXNzaW9uLCBjaGF0TW9kZWw6IENoYXRNb2RlbCk6IElEaXNwb3NhYmxlIHtcblx0XHRpZiAoIWNoYXRNb2RlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yTm9UZWxlbWV0cnkoYEVkaXQgc2Vzc2lvbiB3YXMgY3JlYXRlZCBmb3IgYSBub24tZXhpc3RpbmcgY2hhdCBzZXNzaW9uOiAke3Nlc3Npb24uY2hhdFNlc3Npb25JZH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBvYnNlcnZlckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0b2JzZXJ2ZXJEaXNwb3NhYmxlcy5hZGQoY2hhdE1vZGVsLm9uRGlkQ2hhbmdlKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKGUua2luZCAhPT0gJ2FkZFJlcXVlc3QnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHNlc3Npb24uY3JlYXRlU25hcHNob3QoZS5yZXF1ZXN0LmlkLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgcmVzcG9uc2VNb2RlbCA9IGUucmVxdWVzdC5yZXNwb25zZTtcblx0XHRcdGlmIChyZXNwb25zZU1vZGVsKSB7XG5cdFx0XHRcdHRoaXMub2JzZXJ2ZXJFZGl0c0luUmVzcG9uc2UoZS5yZXF1ZXN0LmlkLCByZXNwb25zZU1vZGVsLCBzZXNzaW9uLCBvYnNlcnZlckRpc3Bvc2FibGVzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0b2JzZXJ2ZXJEaXNwb3NhYmxlcy5hZGQoY2hhdE1vZGVsLm9uRGlkRGlzcG9zZSgoKSA9PiBvYnNlcnZlckRpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXHRcdHJldHVybiBvYnNlcnZlckRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBvYnNlcnZlckVkaXRzSW5SZXNwb25zZShyZXF1ZXN0SWQ6IHN0cmluZywgcmVzcG9uc2VNb2RlbDogSUNoYXRSZXNwb25zZU1vZGVsLCBzZXNzaW9uOiBDaGF0RWRpdGluZ1Nlc3Npb24sIG9ic2VydmVyRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSkge1xuXHRcdC8vIFNwYXJzZSBhcnJheTogdGhlIGluZGljaWVzIGFyZSBpbmRleGVzIG9mIGByZXNwb25zZU1vZGVsLnJlc3BvbnNlLnZhbHVlYFxuXHRcdC8vIHRoYXQgYXJlIGVkaXQgZ3JvdXBzLCBhbmQgdGhlbiB0aGlzIHRyYWNrcyB0aGUgZWRpdCBhcHBsaWNhdGlvbiBmb3Jcblx0XHQvLyBlYWNoIG9mIHRoZW0uIE5vdGUgdGhhdCB0ZXh0IGVkaXQgZ3JvdXBzIGNhbiBiZSB1cGRhdGVkXG5cdFx0Ly8gbXVsdGlwbGUgdGltZXMgZHVyaW5nIHRoZSBwcm9jZXNzIG9mIHJlc3BvbnNlIHN0cmVhbWluZy5cblx0XHRjb25zdCBlZGl0c1NlZW46ICh7IHNlZW46IG51bWJlcjsgc3RyZWFtaW5nOiBJU3RyZWFtaW5nRWRpdHMgfSB8IHVuZGVmaW5lZClbXSA9IFtdO1xuXG5cdFx0Y29uc3QgZWRpdGVkRmlsZXNFeGlzdCA9IG5ldyBSZXNvdXJjZU1hcDxQcm9taXNlPHZvaWQ+PigpO1xuXHRcdGNvbnN0IGVuc3VyZUVkaXRvck9wZW4gPSAocGFydFVyaTogVVJJKSA9PiB7XG5cdFx0XHRjb25zdCB1cmkgPSBDZWxsVXJpLnBhcnNlKHBhcnRVcmkpPy5ub3RlYm9vayA/PyBwYXJ0VXJpO1xuXHRcdFx0aWYgKGVkaXRlZEZpbGVzRXhpc3QuaGFzKHVyaSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaWxlRXhpc3RzID0gdGhpcy5ub3RlYm9va1NlcnZpY2UuZ2V0Tm90ZWJvb2tUZXh0TW9kZWwodXJpKSA/IFByb21pc2UucmVzb2x2ZSh0cnVlKSA6IHRoaXMuX2ZpbGVTZXJ2aWNlLmV4aXN0cyh1cmkpO1xuXHRcdFx0ZWRpdGVkRmlsZXNFeGlzdC5zZXQodXJpLCBmaWxlRXhpc3RzLnRoZW4oKGUpID0+IHtcblx0XHRcdFx0aWYgKCFlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZVVyaSA9IHRoaXMuX2VkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uaW5wdXQucmVzb3VyY2U7XG5cdFx0XHRcdGNvbnN0IGluYWN0aXZlID0gdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5pbnB1dCBpbnN0YW5jZW9mIENoYXRFZGl0b3JJbnB1dCAmJiB0aGlzLl9lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUuaW5wdXQuc2Vzc2lvbklkID09PSBzZXNzaW9uLmNoYXRTZXNzaW9uSWQgfHxcblx0XHRcdFx0XHRCb29sZWFuKGFjdGl2ZVVyaSAmJiBzZXNzaW9uLmVudHJpZXMuZ2V0KCkuZmluZChlbnRyeSA9PiBpc0VxdWFsKGFjdGl2ZVVyaSwgZW50cnkubW9kaWZpZWRVUkkpKSk7XG5cdFx0XHRcdHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiB1cmksIG9wdGlvbnM6IHsgaW5hY3RpdmUsIHByZXNlcnZlRm9jdXM6IHRydWUsIHBpbm5lZDogdHJ1ZSB9IH0pO1xuXHRcdFx0fSkpO1xuXHRcdH07XG5cblx0XHRjb25zdCBvblJlc3BvbnNlQ29tcGxldGUgPSAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IHJlbWFpbmluZyBvZiBlZGl0c1NlZW4pIHtcblx0XHRcdFx0cmVtYWluaW5nPy5zdHJlYW1pbmcuY29tcGxldGUoKTtcblx0XHRcdH1cblx0XHRcdGlmIChyZXNwb25zZU1vZGVsLnJlc3VsdD8uZXJyb3JEZXRhaWxzICYmICFyZXNwb25zZU1vZGVsLnJlc3VsdC5lcnJvckRldGFpbHMucmVzcG9uc2VJc0luY29tcGxldGUpIHtcblx0XHRcdFx0Ly8gUm9sbCBiYWNrIGV2ZXJ5dGhpbmdcblx0XHRcdFx0c2Vzc2lvbi5yZXN0b3JlU25hcHNob3QocmVzcG9uc2VNb2RlbC5yZXF1ZXN0SWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRzU2Vlbi5sZW5ndGggPSAwO1xuXHRcdFx0ZWRpdGVkRmlsZXNFeGlzdC5jbGVhcigpO1xuXHRcdH07XG5cblx0XHRjb25zdCBoYW5kbGVSZXNwb25zZVBhcnRzID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHJlc3BvbnNlTW9kZWwuaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxldCB1bmRvU3RvcDogdW5kZWZpbmVkIHwgc3RyaW5nO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXNwb25zZU1vZGVsLnJlc3BvbnNlLnZhbHVlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHBhcnQgPSByZXNwb25zZU1vZGVsLnJlc3BvbnNlLnZhbHVlW2ldO1xuXG5cdFx0XHRcdGlmIChwYXJ0LmtpbmQgPT09ICd1bmRvU3RvcCcpIHtcblx0XHRcdFx0XHR1bmRvU3RvcCA9IHBhcnQuaWQ7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocGFydC5raW5kICE9PSAndGV4dEVkaXRHcm91cCcgJiYgcGFydC5raW5kICE9PSAnbm90ZWJvb2tFZGl0R3JvdXAnKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlbnN1cmVFZGl0b3JPcGVuKHBhcnQudXJpKTtcblxuXHRcdFx0XHQvLyBnZXQgbmV3IGVkaXRzIGFuZCBzdGFydCBlZGl0aW5nIHNlc3Npb25cblx0XHRcdFx0bGV0IGVudHJ5ID0gZWRpdHNTZWVuW2ldO1xuXHRcdFx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRcdFx0ZW50cnkgPSB7IHNlZW46IDAsIHN0cmVhbWluZzogc2Vzc2lvbi5zdGFydFN0cmVhbWluZ0VkaXRzKENlbGxVcmkucGFyc2UocGFydC51cmkpPy5ub3RlYm9vayA/PyBwYXJ0LnVyaSwgcmVzcG9uc2VNb2RlbCwgdW5kb1N0b3ApIH07XG5cdFx0XHRcdFx0ZWRpdHNTZWVuW2ldID0gZW50cnk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBpc0ZpcnN0ID0gZW50cnkuc2VlbiA9PT0gMDtcblx0XHRcdFx0Y29uc3QgbmV3RWRpdHMgPSBwYXJ0LmVkaXRzLnNsaWNlKGVudHJ5LnNlZW4pLmZsYXQoKTtcblx0XHRcdFx0ZW50cnkuc2VlbiA9IHBhcnQuZWRpdHMubGVuZ3RoO1xuXG5cdFx0XHRcdGlmIChuZXdFZGl0cy5sZW5ndGggPiAwIHx8IGlzRmlyc3QpIHtcblx0XHRcdFx0XHRpZiAocGFydC5raW5kID09PSAnbm90ZWJvb2tFZGl0R3JvdXAnKSB7XG5cdFx0XHRcdFx0XHRuZXdFZGl0cy5mb3JFYWNoKGVkaXQgPT4ge1xuXHRcdFx0XHRcdFx0XHRpZiAoVGV4dEVkaXQuaXNUZXh0RWRpdChlZGl0KSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBwb3NzaWJsZSwgYXMgTm90ZWJvb2tzIHdvdWxkIGhhdmUgYSBkaWZmZXJlbnQgdHlwZS5cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNDZWxsVGV4dEVkaXRPcGVyYXRpb24oZWRpdCkpIHtcblx0XHRcdFx0XHRcdFx0XHRlbnRyeS5zdHJlYW1pbmcucHVzaE5vdGVib29rQ2VsbFRleHQoZWRpdC51cmksIFtlZGl0LmVkaXRdKTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRlbnRyeS5zdHJlYW1pbmcucHVzaE5vdGVib29rKFtlZGl0XSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocGFydC5raW5kID09PSAndGV4dEVkaXRHcm91cCcpIHtcblx0XHRcdFx0XHRcdGVudHJ5LnN0cmVhbWluZy5wdXNoVGV4dChuZXdFZGl0cyBhcyBUZXh0RWRpdFtdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAocGFydC5kb25lKSB7XG5cdFx0XHRcdFx0ZW50cnkuc3RyZWFtaW5nLmNvbXBsZXRlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHJlc3BvbnNlTW9kZWwuaXNDb21wbGV0ZSkge1xuXHRcdFx0aGFuZGxlUmVzcG9uc2VQYXJ0cygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRvblJlc3BvbnNlQ29tcGxldGUoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gb2JzZXJ2ZXJEaXNwb3NhYmxlcy5hZGQocmVzcG9uc2VNb2RlbC5vbkRpZENoYW5nZShlMiA9PiB7XG5cdFx0XHRcdGlmIChlMi5yZWFzb24gPT09ICd1bmRvU3RvcCcpIHtcblx0XHRcdFx0XHRzZXNzaW9uLmNyZWF0ZVNuYXBzaG90KHJlcXVlc3RJZCwgZTIuaWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGhhbmRsZVJlc3BvbnNlUGFydHMoKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRcdGlmIChyZXNwb25zZU1vZGVsLmlzQ29tcGxldGUpIHtcblx0XHRcdFx0XHRcdFx0b25SZXNwb25zZUNvbXBsZXRlKCk7XG5cdFx0XHRcdFx0XHRcdG9ic2VydmVyRGlzcG9zYWJsZXMuZGVsZXRlKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0aGFzUmVsYXRlZEZpbGVzUHJvdmlkZXJzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9jaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJzLnNpemUgPiAwO1xuXHR9XG5cblx0cmVnaXN0ZXJSZWxhdGVkRmlsZXNQcm92aWRlcihoYW5kbGU6IG51bWJlciwgcHJvdmlkZXI6IElDaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5fY2hhdFJlbGF0ZWRGaWxlc1Byb3ZpZGVycy5zZXQoaGFuZGxlLCBwcm92aWRlcik7XG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgZ2V0UmVsYXRlZEZpbGVzKGNoYXRTZXNzaW9uSWQ6IHN0cmluZywgcHJvbXB0OiBzdHJpbmcsIGZpbGVzOiBVUklbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGdyb3VwOiBzdHJpbmc7IGZpbGVzOiBJQ2hhdFJlbGF0ZWRGaWxlW10gfVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gQXJyYXkuZnJvbSh0aGlzLl9jaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJzLnZhbHVlcygpKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbChwcm92aWRlcnMubWFwKGFzeW5jIHByb3ZpZGVyID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHJlbGF0ZWRGaWxlcyA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVSZWxhdGVkRmlsZXMoeyBwcm9tcHQsIGZpbGVzIH0sIHRva2VuKTtcblx0XHRcdFx0aWYgKHJlbGF0ZWRGaWxlcz8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZ3JvdXA6IHByb3ZpZGVyLmRlc2NyaXB0aW9uLCBmaWxlczogcmVsYXRlZEZpbGVzIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gY29hbGVzY2UocmVzdWx0KTtcblx0fVxufVxuXG4vKipcbiAqIEVtaXRzIGFuIGV2ZW50IGNvbnRhaW5pbmcgdGhlIGFkZGVkIG9yIHJlbW92ZWQgZWxlbWVudHMgb2YgdGhlIG9ic2VydmFibGUuXG4gKi9cbmZ1bmN0aW9uIG9ic2VydmVBcnJheUNoYW5nZXM8VD4ob2JzOiBJT2JzZXJ2YWJsZTxUW10+LCBjb21wYXJlOiAoYTogVCwgYjogVCkgPT4gbnVtYmVyLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8VFtdPiB7XG5cdGNvbnN0IGVtaXR0ZXIgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8VFtdPigpKTtcblx0c3RvcmUuYWRkKHJ1bk9uQ2hhbmdlKG9icywgKG5ld0Fyciwgb2xkQXJyKSA9PiB7XG5cdFx0Y29uc3QgY2hhbmdlID0gZGVsdGEob2xkQXJyIHx8IFtdLCBuZXdBcnIsIGNvbXBhcmUpO1xuXHRcdGNvbnN0IGNoYW5nZWRFbGVtZW50cyA9IChbXSBhcyBUW10pLmNvbmNhdChjaGFuZ2UuYWRkZWQpLmNvbmNhdChjaGFuZ2UucmVtb3ZlZCk7XG5cdFx0ZW1pdHRlci5maXJlKGNoYW5nZWRFbGVtZW50cyk7XG5cdH0pKTtcblx0cmV0dXJuIGVtaXR0ZXIuZXZlbnQ7XG59XG5cbmNsYXNzIENoYXREZWNvcmF0aW9uc1Byb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElEZWNvcmF0aW9uc1Byb3ZpZGVyIHtcblxuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gbG9jYWxpemUoJ2NoYXQnLCBcIkNoYXQgRWRpdGluZ1wiKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50RW50cmllcyA9IGRlcml2ZWQ8cmVhZG9ubHkgSU1vZGlmaWVkRmlsZUVudHJ5W10+KHRoaXMsIChyKSA9PiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbnMgPSB0aGlzLl9zZXNzaW9ucy5yZWFkKHIpO1xuXHRcdGlmICghc2Vzc2lvbnMpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0OiBJTW9kaWZpZWRGaWxlRW50cnlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc2Vzc2lvbiBvZiBzZXNzaW9ucykge1xuXHRcdFx0aWYgKHNlc3Npb24uc3RhdGUucmVhZChyKSAhPT0gQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUuRGlzcG9zZWQpIHtcblx0XHRcdFx0Y29uc3QgZW50cmllcyA9IHNlc3Npb24uZW50cmllcy5yZWFkKHIpO1xuXHRcdFx0XHRyZXN1bHQucHVzaCguLi5lbnRyaWVzKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3VycmVudGx5RWRpdGluZ1VyaXMgPSBkZXJpdmVkPFVSSVtdPih0aGlzLCAocikgPT4ge1xuXHRcdGNvbnN0IHVyaSA9IHRoaXMuX2N1cnJlbnRFbnRyaWVzLnJlYWQocik7XG5cdFx0cmV0dXJuIHVyaS5maWx0ZXIoZW50cnkgPT4gZW50cnkuaXNDdXJyZW50bHlCZWluZ01vZGlmaWVkQnkucmVhZChyKSkubWFwKGVudHJ5ID0+IGVudHJ5Lm1vZGlmaWVkVVJJKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kaWZpZWRVcmlzID0gZGVyaXZlZDxVUklbXT4odGhpcywgKHIpID0+IHtcblx0XHRjb25zdCB1cmkgPSB0aGlzLl9jdXJyZW50RW50cmllcy5yZWFkKHIpO1xuXHRcdHJldHVybiB1cmkuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5pc0N1cnJlbnRseUJlaW5nTW9kaWZpZWRCeS5yZWFkKHIpICYmIGVudHJ5LnN0YXRlLnJlYWQocikgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkKS5tYXAoZW50cnkgPT4gZW50cnkubW9kaWZpZWRVUkkpO1xuXHR9KTtcblxuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSBFdmVudC5hbnkoXG5cdFx0b2JzZXJ2ZUFycmF5Q2hhbmdlcyh0aGlzLl9jdXJyZW50bHlFZGl0aW5nVXJpcywgY29tcGFyZUJ5KHVyaSA9PiB1cmkudG9TdHJpbmcoKSwgY29tcGFyZSksIHRoaXMuX3N0b3JlKSxcblx0XHRvYnNlcnZlQXJyYXlDaGFuZ2VzKHRoaXMuX21vZGlmaWVkVXJpcywgY29tcGFyZUJ5KHVyaSA9PiB1cmkudG9TdHJpbmcoKSwgY29tcGFyZSksIHRoaXMuX3N0b3JlKSxcblx0KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uczogSU9ic2VydmFibGU8cmVhZG9ubHkgSUNoYXRFZGl0aW5nU2Vzc2lvbltdPixcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHByb3ZpZGVEZWNvcmF0aW9ucyh1cmk6IFVSSSwgX3Rva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IElEZWNvcmF0aW9uRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaXNDdXJyZW50bHlCZWluZ01vZGlmaWVkID0gdGhpcy5fY3VycmVudGx5RWRpdGluZ1VyaXMuZ2V0KCkuc29tZShlID0+IGUudG9TdHJpbmcoKSA9PT0gdXJpLnRvU3RyaW5nKCkpO1xuXHRcdGlmIChpc0N1cnJlbnRseUJlaW5nTW9kaWZpZWQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHdlaWdodDogMTAwMCxcblx0XHRcdFx0bGV0dGVyOiBUaGVtZUljb24ubW9kaWZ5KENvZGljb24ubG9hZGluZywgJ3NwaW4nKSxcblx0XHRcdFx0YnViYmxlOiBmYWxzZVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0Y29uc3QgaXNNb2RpZmllZCA9IHRoaXMuX21vZGlmaWVkVXJpcy5nZXQoKS5zb21lKGUgPT4gZS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSk7XG5cdFx0aWYgKGlzTW9kaWZpZWQpIHtcblx0XHRcdGNvbnN0IGRlZmF1bHRBZ2VudE5hbWUgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbik/LmZ1bGxOYW1lO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0d2VpZ2h0OiAxMDAwLFxuXHRcdFx0XHRsZXR0ZXI6IENvZGljb24uZGlmZk1vZGlmaWVkLFxuXHRcdFx0XHR0b29sdGlwOiBkZWZhdWx0QWdlbnROYW1lID8gbG9jYWxpemUoJ2NoYXRFZGl0aW5nLm1vZGlmaWVkJywgXCJQZW5kaW5nIGNoYW5nZXMgZnJvbSB7MH1cIiwgZGVmYXVsdEFnZW50TmFtZSkgOiBsb2NhbGl6ZSgnY2hhdEVkaXRpbmcubW9kaWZpZWQyJywgXCJQZW5kaW5nIGNoYW5nZXMgZnJvbSBjaGF0XCIpLFxuXHRcdFx0XHRidWJibGU6IHRydWVcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nTXVsdGlEaWZmU291cmNlUmVzb2x2ZXIgaW1wbGVtZW50cyBJTXVsdGlEaWZmU291cmNlUmVzb2x2ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRpbmdTZXNzaW9uc09iczogSU9ic2VydmFibGU8cmVhZG9ubHkgSUNoYXRFZGl0aW5nU2Vzc2lvbltdPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0Y2FuSGFuZGxlVXJpKHVyaTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHVyaS5zY2hlbWUgPT09IENIQVRfRURJVElOR19NVUxUSV9ESUZGX1NPVVJDRV9SRVNPTFZFUl9TQ0hFTUU7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlRGlmZlNvdXJjZSh1cmk6IFVSSSk6IFByb21pc2U8SVJlc29sdmVkTXVsdGlEaWZmU291cmNlPiB7XG5cblx0XHRjb25zdCB0aGlzU2Vzc2lvbiA9IGRlcml2ZWQodGhpcywgciA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZWRpdGluZ1Nlc3Npb25zT2JzLnJlYWQocikuZmluZChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmNoYXRTZXNzaW9uSWQgPT09IHVyaS5hdXRob3JpdHkpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0aW5nTXVsdGlEaWZmU291cmNlLCB0aGlzU2Vzc2lvbik7XG5cdH1cbn1cblxuY2xhc3MgQ2hhdEVkaXRpbmdNdWx0aURpZmZTb3VyY2UgaW1wbGVtZW50cyBJUmVzb2x2ZWRNdWx0aURpZmZTb3VyY2Uge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvdXJjZXMgPSBkZXJpdmVkPHJlYWRvbmx5IE11bHRpRGlmZkVkaXRvckl0ZW1bXT4odGhpcywgKHJlYWRlcikgPT4ge1xuXHRcdGNvbnN0IGN1cnJlbnRTZXNzaW9uID0gdGhpcy5fY3VycmVudFNlc3Npb24ucmVhZChyZWFkZXIpO1xuXHRcdGlmICghY3VycmVudFNlc3Npb24pIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgZW50cmllcyA9IGN1cnJlbnRTZXNzaW9uLmVudHJpZXMucmVhZChyZWFkZXIpO1xuXHRcdHJldHVybiBlbnRyaWVzLm1hcCgoZW50cnkpID0+IHtcblx0XHRcdHJldHVybiBuZXcgTXVsdGlEaWZmRWRpdG9ySXRlbShcblx0XHRcdFx0ZW50cnkub3JpZ2luYWxVUkksXG5cdFx0XHRcdGVudHJ5Lm1vZGlmaWVkVVJJLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRbY2hhdEVkaXRpbmdSZXNvdXJjZUNvbnRleHRLZXkua2V5XTogZW50cnkuZW50cnlJZCxcblx0XHRcdFx0XHQvLyBbaW5DaGF0RWRpdGluZ1Nlc3Npb25Db250ZXh0S2V5LmtleV06IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXHRyZWFkb25seSByZXNvdXJjZXMgPSBuZXcgVmFsdWVXaXRoQ2hhbmdlRXZlbnRGcm9tT2JzZXJ2YWJsZSh0aGlzLl9yZXNvdXJjZXMpO1xuXG5cdHJlYWRvbmx5IGNvbnRleHRLZXlzID0ge1xuXHRcdFtpbkNoYXRFZGl0aW5nU2Vzc2lvbkNvbnRleHRLZXkua2V5XTogdHJ1ZVxuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRTZXNzaW9uOiBJT2JzZXJ2YWJsZTxJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgdW5kZWZpbmVkPlxuXHQpIHsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsV0FBVyxhQUFhO0FBRTNDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVksaUJBQWlCLFNBQXNCLG9CQUFvQjtBQUNoRixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFNB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
