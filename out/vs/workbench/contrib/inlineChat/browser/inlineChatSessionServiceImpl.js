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
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import { autorun } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { assertType } from "../../../../base/common/types.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isCodeEditor, isCompositeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { createTextBufferFactoryFromSnapshot } from "../../../../editor/common/model/textModel.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { UntitledTextEditorInput } from "../../../services/untitled/common/untitledTextEditorInput.js";
import { IChatWidgetService } from "../../chat/browser/chat.js";
import { IChatAgentService } from "../../chat/common/chatAgents.js";
import { WorkingSetEntryState } from "../../chat/common/chatEditingService.js";
import { IChatService } from "../../chat/common/chatService.js";
import { ChatAgentLocation } from "../../chat/common/constants.js";
import { CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_HAS_AGENT2, CTX_INLINE_CHAT_POSSIBLE } from "../common/inlineChat.js";
import { HunkData, Session, SessionWholeRange, StashedSession } from "./inlineChatSession.js";
const _InlineChatError = class _InlineChatError extends Error {
  constructor(message) {
    super(message);
    this.name = _InlineChatError.code;
  }
};
_InlineChatError.code = "InlineChatError";
let InlineChatError = _InlineChatError;
let InlineChatSessionServiceImpl = class {
  constructor(_telemetryService, _modelService, _textModelService, _editorWorkerService, _logService, _instaService, _editorService, _textFileService, _languageService, _chatService, _chatAgentService, _chatWidgetService) {
    this._telemetryService = _telemetryService;
    this._modelService = _modelService;
    this._textModelService = _textModelService;
    this._editorWorkerService = _editorWorkerService;
    this._logService = _logService;
    this._instaService = _instaService;
    this._editorService = _editorService;
    this._textFileService = _textFileService;
    this._languageService = _languageService;
    this._chatService = _chatService;
    this._chatAgentService = _chatAgentService;
    this._chatWidgetService = _chatWidgetService;
    this._store = new DisposableStore();
    this._onWillStartSession = this._store.add(new Emitter());
    this.onWillStartSession = this._onWillStartSession.event;
    this._onDidMoveSession = this._store.add(new Emitter());
    this.onDidMoveSession = this._onDidMoveSession.event;
    this._onDidEndSession = this._store.add(new Emitter());
    this.onDidEndSession = this._onDidEndSession.event;
    this._onDidStashSession = this._store.add(new Emitter());
    this.onDidStashSession = this._onDidStashSession.event;
    this._sessions = /* @__PURE__ */ new Map();
    this._keyComputers = /* @__PURE__ */ new Map();
    // ---- NEW
    this._sessions2 = new ResourceMap();
    this._onDidChangeSessions = this._store.add(new Emitter());
    this.onDidChangeSessions = this._onDidChangeSessions.event;
  }
  dispose() {
    this._store.dispose();
    this._sessions.forEach((x) => x.store.dispose());
    this._sessions.clear();
  }
  async createSession(editor, options, token) {
    const agent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Editor);
    if (!agent) {
      this._logService.trace("[IE] NO agent found");
      return void 0;
    }
    this._onWillStartSession.fire(editor);
    const textModel = editor.getModel();
    const selection = editor.getSelection();
    const store = new DisposableStore();
    this._logService.trace(`[IE] creating NEW session for ${editor.getId()}, ${agent.extensionId}`);
    const chatModel = options.session?.chatModel ?? this._chatService.startSession(ChatAgentLocation.Editor, token);
    if (!chatModel) {
      this._logService.trace("[IE] NO chatModel found");
      return void 0;
    }
    store.add(toDisposable(() => {
      const doesOtherSessionUseChatModel = [...this._sessions.values()].some((data) => data.session !== session && data.session.chatModel === chatModel);
      if (!doesOtherSessionUseChatModel) {
        this._chatService.clearSession(chatModel.sessionId);
        chatModel.dispose();
      }
    }));
    const lastResponseListener = store.add(new MutableDisposable());
    store.add(chatModel.onDidChange((e) => {
      if (e.kind !== "addRequest" || !e.request.response) {
        return;
      }
      const { response } = e.request;
      session.markModelVersion(e.request);
      lastResponseListener.value = response.onDidChange(() => {
        if (!response.isComplete) {
          return;
        }
        lastResponseListener.clear();
        for (const part of response.response.value) {
          if (part.kind !== "textEditGroup" || part.uri.scheme !== Schemas.untitled || isEqual(part.uri, session.textModelN.uri)) {
            continue;
          }
          const langSelection = this._languageService.createByFilepathOrFirstLine(part.uri, void 0);
          const untitledTextModel = this._textFileService.untitled.create({
            associatedResource: part.uri,
            languageId: langSelection.languageId
          });
          untitledTextModel.resolve();
          this._textModelService.createModelReference(part.uri).then((ref) => {
            store.add(ref);
          });
        }
      });
    }));
    store.add(this._chatAgentService.onDidChangeAgents((e) => {
      if (e === void 0 && (!this._chatAgentService.getAgent(agent.id) || !this._chatAgentService.getActivatedAgents().map((agent2) => agent2.id).includes(agent.id))) {
        this._logService.trace(`[IE] provider GONE for ${editor.getId()}, ${agent.extensionId}`);
        this._releaseSession(session, true);
      }
    }));
    const id = generateUuid();
    const targetUri = textModel.uri;
    store.add(await this._textModelService.createModelReference(textModel.uri));
    const textModelN = textModel;
    const textModel0 = store.add(this._modelService.createModel(
      createTextBufferFactoryFromSnapshot(textModel.createSnapshot()),
      { languageId: textModel.getLanguageId(), onDidChange: Event.None },
      targetUri.with({ scheme: Schemas.vscode, authority: "inline-chat", path: "", query: new URLSearchParams({ id, "textModel0": "" }).toString() }),
      true
    ));
    if (targetUri.scheme === Schemas.untitled) {
      store.add(this._editorService.onDidCloseEditor(() => {
        if (!this._editorService.isOpened({ resource: targetUri, typeId: UntitledTextEditorInput.ID, editorId: DEFAULT_EDITOR_ASSOCIATION.id })) {
          this._releaseSession(session, true);
        }
      }));
    }
    let wholeRange = options.wholeRange;
    if (!wholeRange) {
      wholeRange = new Range(selection.selectionStartLineNumber, selection.selectionStartColumn, selection.positionLineNumber, selection.positionColumn);
    }
    if (token.isCancellationRequested) {
      store.dispose();
      return void 0;
    }
    const session = new Session(
      options.headless ?? false,
      targetUri,
      textModel0,
      textModelN,
      agent,
      store.add(new SessionWholeRange(textModelN, wholeRange)),
      store.add(new HunkData(this._editorWorkerService, textModel0, textModelN)),
      chatModel,
      options.session?.versionsByRequest
    );
    const key = this._key(editor, session.targetUri);
    if (this._sessions.has(key)) {
      store.dispose();
      throw new Error(`Session already stored for ${key}`);
    }
    this._sessions.set(key, { session, editor, store });
    return session;
  }
  moveSession(session, target) {
    const newKey = this._key(target, session.targetUri);
    const existing = this._sessions.get(newKey);
    if (existing) {
      if (existing.session !== session) {
        throw new Error(`Cannot move session because the target editor already/still has one`);
      } else {
        return;
      }
    }
    let found = false;
    for (const [oldKey, data] of this._sessions) {
      if (data.session === session) {
        found = true;
        this._sessions.delete(oldKey);
        this._sessions.set(newKey, { ...data, editor: target });
        this._logService.trace(`[IE] did MOVE session for ${data.editor.getId()} to NEW EDITOR ${target.getId()}, ${session.agent.extensionId}`);
        this._onDidMoveSession.fire({ session, editor: target });
        break;
      }
    }
    if (!found) {
      throw new Error(`Cannot move session because it is not stored`);
    }
  }
  releaseSession(session) {
    this._releaseSession(session, false);
  }
  _releaseSession(session, byServer) {
    let tuple;
    for (const candidate of this._sessions) {
      if (candidate[1].session === session) {
        tuple = candidate;
        break;
      }
    }
    if (!tuple) {
      return;
    }
    this._telemetryService.publicLog2("interactiveEditor/session", session.asTelemetryData());
    const [key, value] = tuple;
    this._sessions.delete(key);
    this._logService.trace(`[IE] did RELEASED session for ${value.editor.getId()}, ${session.agent.extensionId}`);
    this._onDidEndSession.fire({ editor: value.editor, session, endedByExternalCause: byServer });
    value.store.dispose();
  }
  stashSession(session, editor, undoCancelEdits) {
    const result = this._instaService.createInstance(StashedSession, editor, session, undoCancelEdits);
    this._onDidStashSession.fire({ editor, session });
    this._logService.trace(`[IE] did STASH session for ${editor.getId()}, ${session.agent.extensionId}`);
    return result;
  }
  getCodeEditor(session) {
    for (const [, data] of this._sessions) {
      if (data.session === session) {
        return data.editor;
      }
    }
    throw new Error("session not found");
  }
  getSession(editor, uri) {
    const key = this._key(editor, uri);
    return this._sessions.get(key)?.session;
  }
  _key(editor, uri) {
    const item = this._keyComputers.get(uri.scheme);
    return item ? item.getComparisonKey(editor, uri) : `${editor.getId()}@${uri.toString()}`;
  }
  registerSessionKeyComputer(scheme, value) {
    this._keyComputers.set(scheme, value);
    return toDisposable(() => this._keyComputers.delete(scheme));
  }
  async createSession2(editor, uri, token) {
    assertType(editor.hasModel());
    if (this._sessions2.has(uri)) {
      throw new Error("Session already exists");
    }
    this._onWillStartSession.fire(editor);
    const chatModel = this._chatService.startSession(ChatAgentLocation.EditingSession, token, false);
    const editingSession = await chatModel.editingSessionObs?.promise;
    const widget = this._chatWidgetService.getWidgetBySessionId(chatModel.sessionId);
    await widget?.attachmentModel.addFile(uri);
    const store = new DisposableStore();
    store.add(toDisposable(() => {
      this._chatService.cancelCurrentRequestForSession(chatModel.sessionId);
      editingSession.reject();
      this._sessions2.delete(uri);
      this._onDidChangeSessions.fire(this);
    }));
    store.add(chatModel);
    store.add(autorun((r) => {
      const entries = editingSession.entries.read(r);
      if (entries.length === 0) {
        return;
      }
      const allSettled = entries.every((entry) => {
        const state = entry.state.read(r);
        return (state === WorkingSetEntryState.Accepted || state === WorkingSetEntryState.Rejected) && !entry.isCurrentlyBeingModifiedBy.read(r);
      });
      if (allSettled && !chatModel.requestInProgress) {
        store.dispose();
      }
    }));
    const result = {
      uri,
      initialPosition: editor.getPosition().delta(-1),
      chatModel,
      editingSession,
      dispose: store.dispose.bind(store)
    };
    this._sessions2.set(uri, result);
    this._onDidChangeSessions.fire(this);
    return result;
  }
  getSession2(uri) {
    let result = this._sessions2.get(uri);
    if (!result) {
      for (const [_, candidate] of this._sessions2) {
        const entry = candidate.editingSession.getEntry(uri);
        if (entry) {
          result = candidate;
          break;
        }
      }
    }
    return result;
  }
};
InlineChatSessionServiceImpl = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ITextModelService),
  __decorateParam(3, IEditorWorkerService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IEditorService),
  __decorateParam(7, ITextFileService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IChatAgentService),
  __decorateParam(11, IChatWidgetService)
], InlineChatSessionServiceImpl);
let InlineChatEnabler = class {
  constructor(contextKeyService, chatAgentService, editorService) {
    this._store = new DisposableStore();
    this._ctxHasProvider = CTX_INLINE_CHAT_HAS_AGENT.bindTo(contextKeyService);
    this._ctxHasProvider2 = CTX_INLINE_CHAT_HAS_AGENT2.bindTo(contextKeyService);
    this._ctxPossible = CTX_INLINE_CHAT_POSSIBLE.bindTo(contextKeyService);
    const updateAgent = () => {
      const agent = chatAgentService.getDefaultAgent(ChatAgentLocation.Editor);
      if (agent?.id === "github.copilot.editor" || agent?.id === "setup.editor") {
        this._ctxHasProvider.set(true);
        this._ctxHasProvider2.reset();
      } else if (agent?.id === "github.copilot.editingSessionEditor") {
        this._ctxHasProvider.reset();
        this._ctxHasProvider2.set(true);
      } else {
        this._ctxHasProvider.reset();
        this._ctxHasProvider2.reset();
      }
    };
    this._store.add(chatAgentService.onDidChangeAgents(updateAgent));
    updateAgent();
    const updateEditor = () => {
      const ctrl = editorService.activeEditorPane?.getControl();
      const isCodeEditorLike = isCodeEditor(ctrl) || isDiffEditor(ctrl) || isCompositeEditor(ctrl);
      this._ctxPossible.set(isCodeEditorLike);
    };
    this._store.add(editorService.onDidActiveEditorChange(updateEditor));
    updateEditor();
  }
  dispose() {
    this._ctxPossible.reset();
    this._ctxHasProvider.reset();
    this._store.dispose();
  }
};
InlineChatEnabler.Id = "inlineChat.enabler";
InlineChatEnabler = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IEditorService)
], InlineChatEnabler);
export {
  InlineChatEnabler,
  InlineChatError,
  InlineChatSessionServiceImpl
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYXV0b3J1biB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUFjdGl2ZUNvZGVFZGl0b3IsIElDb2RlRWRpdG9yLCBpc0NvZGVFZGl0b3IsIGlzQ29tcG9zaXRlRWRpdG9yLCBpc0RpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJVmFsaWRFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TbmFwc2hvdCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0VESVRPUl9BU1NPQ0lBVElPTiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91bnRpdGxlZC9jb21tb24vdW50aXRsZWRUZXh0RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY2hhdC9icm93c2VyL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY2hhdEVkaXRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQsIENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQyLCBDVFhfSU5MSU5FX0NIQVRfUE9TU0lCTEUgfSBmcm9tICcuLi9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBIdW5rRGF0YSwgU2Vzc2lvbiwgU2Vzc2lvbldob2xlUmFuZ2UsIFN0YXNoZWRTZXNzaW9uLCBUZWxlbWV0cnlEYXRhLCBUZWxlbWV0cnlEYXRhQ2xhc3NpZmljYXRpb24gfSBmcm9tICcuL2lubGluZUNoYXRTZXNzaW9uLmpzJztcbmltcG9ydCB7IElJbmxpbmVDaGF0U2Vzc2lvbjIsIElJbmxpbmVDaGF0U2Vzc2lvbkVuZEV2ZW50LCBJSW5saW5lQ2hhdFNlc3Npb25FdmVudCwgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSwgSVNlc3Npb25LZXlDb21wdXRlciB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcblxuXG50eXBlIFNlc3Npb25EYXRhID0ge1xuXHRlZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRzZXNzaW9uOiBTZXNzaW9uO1xuXHRzdG9yZTogSURpc3Bvc2FibGU7XG59O1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQ2hhdEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuXHRzdGF0aWMgcmVhZG9ubHkgY29kZSA9ICdJbmxpbmVDaGF0RXJyb3InO1xuXHRjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0XHR0aGlzLm5hbWUgPSBJbmxpbmVDaGF0RXJyb3IuY29kZTtcblx0fVxufVxuXG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2VJbXBsIGltcGxlbWVudHMgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB7XG5cblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsU3RhcnRTZXNzaW9uID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBFbWl0dGVyPElBY3RpdmVDb2RlRWRpdG9yPigpKTtcblx0cmVhZG9ubHkgb25XaWxsU3RhcnRTZXNzaW9uOiBFdmVudDxJQWN0aXZlQ29kZUVkaXRvcj4gPSB0aGlzLl9vbldpbGxTdGFydFNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRNb3ZlU2Vzc2lvbiA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRW1pdHRlcjxJSW5saW5lQ2hhdFNlc3Npb25FdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTW92ZVNlc3Npb246IEV2ZW50PElJbmxpbmVDaGF0U2Vzc2lvbkV2ZW50PiA9IHRoaXMuX29uRGlkTW92ZVNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFbmRTZXNzaW9uID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBFbWl0dGVyPElJbmxpbmVDaGF0U2Vzc2lvbkVuZEV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRFbmRTZXNzaW9uOiBFdmVudDxJSW5saW5lQ2hhdFNlc3Npb25FbmRFdmVudD4gPSB0aGlzLl9vbkRpZEVuZFNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdGFzaFNlc3Npb24gPSB0aGlzLl9zdG9yZS5hZGQobmV3IEVtaXR0ZXI8SUlubGluZUNoYXRTZXNzaW9uRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFN0YXNoU2Vzc2lvbjogRXZlbnQ8SUlubGluZUNoYXRTZXNzaW9uRXZlbnQ+ID0gdGhpcy5fb25EaWRTdGFzaFNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgU2Vzc2lvbkRhdGE+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2tleUNvbXB1dGVycyA9IG5ldyBNYXA8c3RyaW5nLCBJU2Vzc2lvbktleUNvbXB1dGVyPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yV29ya2VyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JXb3JrZXJTZXJ2aWNlOiBJRWRpdG9yV29ya2VyU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0KSB7IH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zZXNzaW9ucy5mb3JFYWNoKHggPT4geC5zdG9yZS5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuX3Nlc3Npb25zLmNsZWFyKCk7XG5cdH1cblxuXHRhc3luYyBjcmVhdGVTZXNzaW9uKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsIG9wdGlvbnM6IHsgaGVhZGxlc3M/OiBib29sZWFuOyB3aG9sZVJhbmdlPzogUmFuZ2U7IHNlc3Npb24/OiBTZXNzaW9uIH0sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8U2Vzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IpO1xuXG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnW0lFXSBOTyBhZ2VudCBmb3VuZCcpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl9vbldpbGxTdGFydFNlc3Npb24uZmlyZShlZGl0b3IpO1xuXG5cdFx0Y29uc3QgdGV4dE1vZGVsID0gZWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgW0lFXSBjcmVhdGluZyBORVcgc2Vzc2lvbiBmb3IgJHtlZGl0b3IuZ2V0SWQoKX0sICR7YWdlbnQuZXh0ZW5zaW9uSWR9YCk7XG5cblx0XHRjb25zdCBjaGF0TW9kZWwgPSBvcHRpb25zLnNlc3Npb24/LmNoYXRNb2RlbCA/PyB0aGlzLl9jaGF0U2VydmljZS5zdGFydFNlc3Npb24oQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yLCB0b2tlbik7XG5cdFx0aWYgKCFjaGF0TW9kZWwpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1tJRV0gTk8gY2hhdE1vZGVsIGZvdW5kJyk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgZG9lc090aGVyU2Vzc2lvblVzZUNoYXRNb2RlbCA9IFsuLi50aGlzLl9zZXNzaW9ucy52YWx1ZXMoKV0uc29tZShkYXRhID0+IGRhdGEuc2Vzc2lvbiAhPT0gc2Vzc2lvbiAmJiBkYXRhLnNlc3Npb24uY2hhdE1vZGVsID09PSBjaGF0TW9kZWwpO1xuXG5cdFx0XHRpZiAoIWRvZXNPdGhlclNlc3Npb25Vc2VDaGF0TW9kZWwpIHtcblx0XHRcdFx0dGhpcy5fY2hhdFNlcnZpY2UuY2xlYXJTZXNzaW9uKGNoYXRNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdFx0XHRjaGF0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGxhc3RSZXNwb25zZUxpc3RlbmVyID0gc3RvcmUuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRzdG9yZS5hZGQoY2hhdE1vZGVsLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUua2luZCAhPT0gJ2FkZFJlcXVlc3QnIHx8ICFlLnJlcXVlc3QucmVzcG9uc2UpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB7IHJlc3BvbnNlIH0gPSBlLnJlcXVlc3Q7XG5cblx0XHRcdHNlc3Npb24ubWFya01vZGVsVmVyc2lvbihlLnJlcXVlc3QpO1xuXHRcdFx0bGFzdFJlc3BvbnNlTGlzdGVuZXIudmFsdWUgPSByZXNwb25zZS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cblx0XHRcdFx0aWYgKCFyZXNwb25zZS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGFzdFJlc3BvbnNlTGlzdGVuZXIuY2xlYXIoKTsgLy8gT05DRVxuXG5cdFx0XHRcdC8vIHNwZWNpYWwgaGFuZGxpbmcgZm9yIHVudGl0bGVkIGZpbGVzXG5cdFx0XHRcdGZvciAoY29uc3QgcGFydCBvZiByZXNwb25zZS5yZXNwb25zZS52YWx1ZSkge1xuXHRcdFx0XHRcdGlmIChwYXJ0LmtpbmQgIT09ICd0ZXh0RWRpdEdyb3VwJyB8fCBwYXJ0LnVyaS5zY2hlbWUgIT09IFNjaGVtYXMudW50aXRsZWQgfHwgaXNFcXVhbChwYXJ0LnVyaSwgc2Vzc2lvbi50ZXh0TW9kZWxOLnVyaSkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBsYW5nU2VsZWN0aW9uID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5RmlsZXBhdGhPckZpcnN0TGluZShwYXJ0LnVyaSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRjb25zdCB1bnRpdGxlZFRleHRNb2RlbCA9IHRoaXMuX3RleHRGaWxlU2VydmljZS51bnRpdGxlZC5jcmVhdGUoe1xuXHRcdFx0XHRcdFx0YXNzb2NpYXRlZFJlc291cmNlOiBwYXJ0LnVyaSxcblx0XHRcdFx0XHRcdGxhbmd1YWdlSWQ6IGxhbmdTZWxlY3Rpb24ubGFuZ3VhZ2VJZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHVudGl0bGVkVGV4dE1vZGVsLnJlc29sdmUoKTtcblx0XHRcdFx0XHR0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHBhcnQudXJpKS50aGVuKHJlZiA9PiB7XG5cdFx0XHRcdFx0XHRzdG9yZS5hZGQocmVmKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRzdG9yZS5hZGQodGhpcy5fY2hhdEFnZW50U2VydmljZS5vbkRpZENoYW5nZUFnZW50cyhlID0+IHtcblx0XHRcdGlmIChlID09PSB1bmRlZmluZWQgJiYgKCF0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KGFnZW50LmlkKSB8fCAhdGhpcy5fY2hhdEFnZW50U2VydmljZS5nZXRBY3RpdmF0ZWRBZ2VudHMoKS5tYXAoYWdlbnQgPT4gYWdlbnQuaWQpLmluY2x1ZGVzKGFnZW50LmlkKSkpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgW0lFXSBwcm92aWRlciBHT05FIGZvciAke2VkaXRvci5nZXRJZCgpfSwgJHthZ2VudC5leHRlbnNpb25JZH1gKTtcblx0XHRcdFx0dGhpcy5fcmVsZWFzZVNlc3Npb24oc2Vzc2lvbiwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgaWQgPSBnZW5lcmF0ZVV1aWQoKTtcblx0XHRjb25zdCB0YXJnZXRVcmkgPSB0ZXh0TW9kZWwudXJpO1xuXG5cdFx0Ly8gQUkgZWRpdHMgaGFwcGVuIGluIHRoZSBhY3R1YWwgbW9kZWwsIGtlZXAgYSByZWZlcmVuY2UgYnV0IG1ha2Ugbm8gY29weVxuXHRcdHN0b3JlLmFkZCgoYXdhaXQgdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZSh0ZXh0TW9kZWwudXJpKSkpO1xuXHRcdGNvbnN0IHRleHRNb2RlbE4gPSB0ZXh0TW9kZWw7XG5cblx0XHQvLyBjcmVhdGU6IGtlZXAgYSBzbmFwc2hvdCBvZiB0aGUgXCJhY3R1YWxcIiBtb2RlbFxuXHRcdGNvbnN0IHRleHRNb2RlbDAgPSBzdG9yZS5hZGQodGhpcy5fbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKFxuXHRcdFx0Y3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU25hcHNob3QodGV4dE1vZGVsLmNyZWF0ZVNuYXBzaG90KCkpLFxuXHRcdFx0eyBsYW5ndWFnZUlkOiB0ZXh0TW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLCBvbkRpZENoYW5nZTogRXZlbnQuTm9uZSB9LFxuXHRcdFx0dGFyZ2V0VXJpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlLCBhdXRob3JpdHk6ICdpbmxpbmUtY2hhdCcsIHBhdGg6ICcnLCBxdWVyeTogbmV3IFVSTFNlYXJjaFBhcmFtcyh7IGlkLCAndGV4dE1vZGVsMCc6ICcnIH0pLnRvU3RyaW5nKCkgfSksIHRydWVcblx0XHQpKTtcblxuXHRcdC8vIHVudGl0bGVkIGRvY3VtZW50cyBhcmUgc3BlY2lhbCBhbmQgd2UgYXJlIHJlbGVhc2luZyB0aGVpciBzZXNzaW9uIHdoZW4gdGhlaXIgbGFzdCBlZGl0b3IgY2xvc2VzXG5cdFx0aWYgKHRhcmdldFVyaS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdHN0b3JlLmFkZCh0aGlzLl9lZGl0b3JTZXJ2aWNlLm9uRGlkQ2xvc2VFZGl0b3IoKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2VkaXRvclNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogdGFyZ2V0VXJpLCB0eXBlSWQ6IFVudGl0bGVkVGV4dEVkaXRvcklucHV0LklELCBlZGl0b3JJZDogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQgfSkpIHtcblx0XHRcdFx0XHR0aGlzLl9yZWxlYXNlU2Vzc2lvbihzZXNzaW9uLCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGxldCB3aG9sZVJhbmdlID0gb3B0aW9ucy53aG9sZVJhbmdlO1xuXHRcdGlmICghd2hvbGVSYW5nZSkge1xuXHRcdFx0d2hvbGVSYW5nZSA9IG5ldyBSYW5nZShzZWxlY3Rpb24uc2VsZWN0aW9uU3RhcnRMaW5lTnVtYmVyLCBzZWxlY3Rpb24uc2VsZWN0aW9uU3RhcnRDb2x1bW4sIHNlbGVjdGlvbi5wb3NpdGlvbkxpbmVOdW1iZXIsIHNlbGVjdGlvbi5wb3NpdGlvbkNvbHVtbik7XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSBuZXcgU2Vzc2lvbihcblx0XHRcdG9wdGlvbnMuaGVhZGxlc3MgPz8gZmFsc2UsXG5cdFx0XHR0YXJnZXRVcmksXG5cdFx0XHR0ZXh0TW9kZWwwLFxuXHRcdFx0dGV4dE1vZGVsTixcblx0XHRcdGFnZW50LFxuXHRcdFx0c3RvcmUuYWRkKG5ldyBTZXNzaW9uV2hvbGVSYW5nZSh0ZXh0TW9kZWxOLCB3aG9sZVJhbmdlKSksXG5cdFx0XHRzdG9yZS5hZGQobmV3IEh1bmtEYXRhKHRoaXMuX2VkaXRvcldvcmtlclNlcnZpY2UsIHRleHRNb2RlbDAsIHRleHRNb2RlbE4pKSxcblx0XHRcdGNoYXRNb2RlbCxcblx0XHRcdG9wdGlvbnMuc2Vzc2lvbj8udmVyc2lvbnNCeVJlcXVlc3QsXG5cdFx0KTtcblxuXHRcdC8vIHN0b3JlOiBrZXkgLT4gc2Vzc2lvblxuXHRcdGNvbnN0IGtleSA9IHRoaXMuX2tleShlZGl0b3IsIHNlc3Npb24udGFyZ2V0VXJpKTtcblx0XHRpZiAodGhpcy5fc2Vzc2lvbnMuaGFzKGtleSkpIHtcblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgU2Vzc2lvbiBhbHJlYWR5IHN0b3JlZCBmb3IgJHtrZXl9YCk7XG5cdFx0fVxuXHRcdHRoaXMuX3Nlc3Npb25zLnNldChrZXksIHsgc2Vzc2lvbiwgZWRpdG9yLCBzdG9yZSB9KTtcblx0XHRyZXR1cm4gc2Vzc2lvbjtcblx0fVxuXG5cdG1vdmVTZXNzaW9uKHNlc3Npb246IFNlc3Npb24sIHRhcmdldDogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRjb25zdCBuZXdLZXkgPSB0aGlzLl9rZXkodGFyZ2V0LCBzZXNzaW9uLnRhcmdldFVyaSk7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9zZXNzaW9ucy5nZXQobmV3S2V5KTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdGlmIChleGlzdGluZy5zZXNzaW9uICE9PSBzZXNzaW9uKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IG1vdmUgc2Vzc2lvbiBiZWNhdXNlIHRoZSB0YXJnZXQgZWRpdG9yIGFscmVhZHkvc3RpbGwgaGFzIG9uZWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbm9vcFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0Zm9yIChjb25zdCBbb2xkS2V5LCBkYXRhXSBvZiB0aGlzLl9zZXNzaW9ucykge1xuXHRcdFx0aWYgKGRhdGEuc2Vzc2lvbiA9PT0gc2Vzc2lvbikge1xuXHRcdFx0XHRmb3VuZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3Nlc3Npb25zLmRlbGV0ZShvbGRLZXkpO1xuXHRcdFx0XHR0aGlzLl9zZXNzaW9ucy5zZXQobmV3S2V5LCB7IC4uLmRhdGEsIGVkaXRvcjogdGFyZ2V0IH0pO1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBbSUVdIGRpZCBNT1ZFIHNlc3Npb24gZm9yICR7ZGF0YS5lZGl0b3IuZ2V0SWQoKX0gdG8gTkVXIEVESVRPUiAke3RhcmdldC5nZXRJZCgpfSwgJHtzZXNzaW9uLmFnZW50LmV4dGVuc2lvbklkfWApO1xuXHRcdFx0XHR0aGlzLl9vbkRpZE1vdmVTZXNzaW9uLmZpcmUoeyBzZXNzaW9uLCBlZGl0b3I6IHRhcmdldCB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghZm91bmQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2Fubm90IG1vdmUgc2Vzc2lvbiBiZWNhdXNlIGl0IGlzIG5vdCBzdG9yZWRgKTtcblx0XHR9XG5cdH1cblxuXHRyZWxlYXNlU2Vzc2lvbihzZXNzaW9uOiBTZXNzaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVsZWFzZVNlc3Npb24oc2Vzc2lvbiwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVsZWFzZVNlc3Npb24oc2Vzc2lvbjogU2Vzc2lvbiwgYnlTZXJ2ZXI6IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdGxldCB0dXBsZTogW3N0cmluZywgU2Vzc2lvbkRhdGFdIHwgdW5kZWZpbmVkO1xuXG5cdFx0Ly8gY2xlYW51cFxuXHRcdGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIHRoaXMuX3Nlc3Npb25zKSB7XG5cdFx0XHRpZiAoY2FuZGlkYXRlWzFdLnNlc3Npb24gPT09IHNlc3Npb24pIHtcblx0XHRcdFx0Ly8gaWYgKHZhbHVlLnNlc3Npb24gPT09IHNlc3Npb24pIHtcblx0XHRcdFx0dHVwbGUgPSBjYW5kaWRhdGU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghdHVwbGUpIHtcblx0XHRcdC8vIGRvdWJsZSByZW1vdmVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8VGVsZW1ldHJ5RGF0YSwgVGVsZW1ldHJ5RGF0YUNsYXNzaWZpY2F0aW9uPignaW50ZXJhY3RpdmVFZGl0b3Ivc2Vzc2lvbicsIHNlc3Npb24uYXNUZWxlbWV0cnlEYXRhKCkpO1xuXG5cdFx0Y29uc3QgW2tleSwgdmFsdWVdID0gdHVwbGU7XG5cdFx0dGhpcy5fc2Vzc2lvbnMuZGVsZXRlKGtleSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgW0lFXSBkaWQgUkVMRUFTRUQgc2Vzc2lvbiBmb3IgJHt2YWx1ZS5lZGl0b3IuZ2V0SWQoKX0sICR7c2Vzc2lvbi5hZ2VudC5leHRlbnNpb25JZH1gKTtcblxuXHRcdHRoaXMuX29uRGlkRW5kU2Vzc2lvbi5maXJlKHsgZWRpdG9yOiB2YWx1ZS5lZGl0b3IsIHNlc3Npb24sIGVuZGVkQnlFeHRlcm5hbENhdXNlOiBieVNlcnZlciB9KTtcblx0XHR2YWx1ZS5zdG9yZS5kaXNwb3NlKCk7XG5cdH1cblxuXHRzdGFzaFNlc3Npb24oc2Vzc2lvbjogU2Vzc2lvbiwgZWRpdG9yOiBJQ29kZUVkaXRvciwgdW5kb0NhbmNlbEVkaXRzOiBJVmFsaWRFZGl0T3BlcmF0aW9uW10pOiBTdGFzaGVkU2Vzc2lvbiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5faW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN0YXNoZWRTZXNzaW9uLCBlZGl0b3IsIHNlc3Npb24sIHVuZG9DYW5jZWxFZGl0cyk7XG5cdFx0dGhpcy5fb25EaWRTdGFzaFNlc3Npb24uZmlyZSh7IGVkaXRvciwgc2Vzc2lvbiB9KTtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBbSUVdIGRpZCBTVEFTSCBzZXNzaW9uIGZvciAke2VkaXRvci5nZXRJZCgpfSwgJHtzZXNzaW9uLmFnZW50LmV4dGVuc2lvbklkfWApO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRnZXRDb2RlRWRpdG9yKHNlc3Npb246IFNlc3Npb24pOiBJQ29kZUVkaXRvciB7XG5cdFx0Zm9yIChjb25zdCBbLCBkYXRhXSBvZiB0aGlzLl9zZXNzaW9ucykge1xuXHRcdFx0aWYgKGRhdGEuc2Vzc2lvbiA9PT0gc2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5lZGl0b3I7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcignc2Vzc2lvbiBub3QgZm91bmQnKTtcblx0fVxuXG5cdGdldFNlc3Npb24oZWRpdG9yOiBJQ29kZUVkaXRvciwgdXJpOiBVUkkpOiBTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBrZXkgPSB0aGlzLl9rZXkoZWRpdG9yLCB1cmkpO1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9ucy5nZXQoa2V5KT8uc2Vzc2lvbjtcblx0fVxuXG5cdHByaXZhdGUgX2tleShlZGl0b3I6IElDb2RlRWRpdG9yLCB1cmk6IFVSSSk6IHN0cmluZyB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2tleUNvbXB1dGVycy5nZXQodXJpLnNjaGVtZSk7XG5cdFx0cmV0dXJuIGl0ZW1cblx0XHRcdD8gaXRlbS5nZXRDb21wYXJpc29uS2V5KGVkaXRvciwgdXJpKVxuXHRcdFx0OiBgJHtlZGl0b3IuZ2V0SWQoKX1AJHt1cmkudG9TdHJpbmcoKX1gO1xuXG5cdH1cblxuXHRyZWdpc3RlclNlc3Npb25LZXlDb21wdXRlcihzY2hlbWU6IHN0cmluZywgdmFsdWU6IElTZXNzaW9uS2V5Q29tcHV0ZXIpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhpcy5fa2V5Q29tcHV0ZXJzLnNldChzY2hlbWUsIHZhbHVlKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX2tleUNvbXB1dGVycy5kZWxldGUoc2NoZW1lKSk7XG5cdH1cblxuXHQvLyAtLS0tIE5FV1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nlc3Npb25zMiA9IG5ldyBSZXNvdXJjZU1hcDxJSW5saW5lQ2hhdFNlc3Npb24yPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2Vzc2lvbnMgPSB0aGlzLl9zdG9yZS5hZGQobmV3IEVtaXR0ZXI8dGhpcz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2Vzc2lvbnM6IEV2ZW50PHRoaXM+ID0gdGhpcy5fb25EaWRDaGFuZ2VTZXNzaW9ucy5ldmVudDtcblxuXG5cdGFzeW5jIGNyZWF0ZVNlc3Npb24yKGVkaXRvcjogSUNvZGVFZGl0b3IsIHVyaTogVVJJLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElJbmxpbmVDaGF0U2Vzc2lvbjI+IHtcblxuXHRcdGFzc2VydFR5cGUoZWRpdG9yLmhhc01vZGVsKCkpO1xuXG5cdFx0aWYgKHRoaXMuX3Nlc3Npb25zMi5oYXModXJpKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdTZXNzaW9uIGFscmVhZHkgZXhpc3RzJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25XaWxsU3RhcnRTZXNzaW9uLmZpcmUoZWRpdG9yIGFzIElBY3RpdmVDb2RlRWRpdG9yKTtcblxuXHRcdGNvbnN0IGNoYXRNb2RlbCA9IHRoaXMuX2NoYXRTZXJ2aWNlLnN0YXJ0U2Vzc2lvbihDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiwgdG9rZW4sIGZhbHNlKTtcblxuXHRcdGNvbnN0IGVkaXRpbmdTZXNzaW9uID0gYXdhaXQgY2hhdE1vZGVsLmVkaXRpbmdTZXNzaW9uT2JzPy5wcm9taXNlITtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChjaGF0TW9kZWwuc2Vzc2lvbklkKTtcblx0XHRhd2FpdCB3aWRnZXQ/LmF0dGFjaG1lbnRNb2RlbC5hZGRGaWxlKHVyaSk7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX2NoYXRTZXJ2aWNlLmNhbmNlbEN1cnJlbnRSZXF1ZXN0Rm9yU2Vzc2lvbihjaGF0TW9kZWwuc2Vzc2lvbklkKTtcblx0XHRcdGVkaXRpbmdTZXNzaW9uLnJlamVjdCgpO1xuXHRcdFx0dGhpcy5fc2Vzc2lvbnMyLmRlbGV0ZSh1cmkpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXNzaW9ucy5maXJlKHRoaXMpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQoY2hhdE1vZGVsKTtcblxuXHRcdHN0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXG5cdFx0XHRjb25zdCBlbnRyaWVzID0gZWRpdGluZ1Nlc3Npb24uZW50cmllcy5yZWFkKHIpO1xuXHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWxsU2V0dGxlZCA9IGVudHJpZXMuZXZlcnkoZW50cnkgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0ZSA9IGVudHJ5LnN0YXRlLnJlYWQocik7XG5cdFx0XHRcdHJldHVybiAoc3RhdGUgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLkFjY2VwdGVkIHx8IHN0YXRlID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5SZWplY3RlZClcblx0XHRcdFx0XHQmJiAhZW50cnkuaXNDdXJyZW50bHlCZWluZ01vZGlmaWVkQnkucmVhZChyKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoYWxsU2V0dGxlZCAmJiAhY2hhdE1vZGVsLnJlcXVlc3RJblByb2dyZXNzKSB7XG5cdFx0XHRcdC8vIHNlbGYgdGVybWluYXRlXG5cdFx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCByZXN1bHQ6IElJbmxpbmVDaGF0U2Vzc2lvbjIgPSB7XG5cdFx0XHR1cmksXG5cdFx0XHRpbml0aWFsUG9zaXRpb246IGVkaXRvci5nZXRQb3NpdGlvbigpLmRlbHRhKC0xKSxcblx0XHRcdGNoYXRNb2RlbCxcblx0XHRcdGVkaXRpbmdTZXNzaW9uLFxuXHRcdFx0ZGlzcG9zZTogc3RvcmUuZGlzcG9zZS5iaW5kKHN0b3JlKVxuXHRcdH07XG5cdFx0dGhpcy5fc2Vzc2lvbnMyLnNldCh1cmksIHJlc3VsdCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXNzaW9ucy5maXJlKHRoaXMpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRnZXRTZXNzaW9uMih1cmk6IFVSSSk6IElJbmxpbmVDaGF0U2Vzc2lvbjIgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9zZXNzaW9uczIuZ2V0KHVyaSk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdC8vIG5vIGRpcmVjdCBzZXNzaW9uLCB0cnkgdG8gZmluZCBhbiBlZGl0aW5nIHNlc3Npb24gd2hpY2ggaGFzIGEgZmlsZSBlbnRyeSBmb3IgdGhlIHVyaVxuXHRcdFx0Zm9yIChjb25zdCBbXywgY2FuZGlkYXRlXSBvZiB0aGlzLl9zZXNzaW9uczIpIHtcblx0XHRcdFx0Y29uc3QgZW50cnkgPSBjYW5kaWRhdGUuZWRpdGluZ1Nlc3Npb24uZ2V0RW50cnkodXJpKTtcblx0XHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdFx0cmVzdWx0ID0gY2FuZGlkYXRlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lQ2hhdEVuYWJsZXIge1xuXG5cdHN0YXRpYyBJZCA9ICdpbmxpbmVDaGF0LmVuYWJsZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eEhhc1Byb3ZpZGVyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4SGFzUHJvdmlkZXIyOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4UG9zc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9jdHhIYXNQcm92aWRlciA9IENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhIYXNQcm92aWRlcjIgPSBDVFhfSU5MSU5FX0NIQVRfSEFTX0FHRU5UMi5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2N0eFBvc3NpYmxlID0gQ1RYX0lOTElORV9DSEFUX1BPU1NJQkxFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCB1cGRhdGVBZ2VudCA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGFnZW50ID0gY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yKTtcblx0XHRcdGlmIChhZ2VudD8uaWQgPT09ICdnaXRodWIuY29waWxvdC5lZGl0b3InIHx8IGFnZW50Py5pZCA9PT0gJ3NldHVwLmVkaXRvcicpIHtcblx0XHRcdFx0dGhpcy5fY3R4SGFzUHJvdmlkZXIuc2V0KHRydWUpO1xuXHRcdFx0XHR0aGlzLl9jdHhIYXNQcm92aWRlcjIucmVzZXQoKTtcblx0XHRcdH0gZWxzZSBpZiAoYWdlbnQ/LmlkID09PSAnZ2l0aHViLmNvcGlsb3QuZWRpdGluZ1Nlc3Npb25FZGl0b3InKSB7XG5cdFx0XHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0XHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyMi5zZXQodHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9jdHhIYXNQcm92aWRlci5yZXNldCgpO1xuXHRcdFx0XHR0aGlzLl9jdHhIYXNQcm92aWRlcjIucmVzZXQoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKGNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHModXBkYXRlQWdlbnQpKTtcblx0XHR1cGRhdGVBZ2VudCgpO1xuXG5cdFx0Y29uc3QgdXBkYXRlRWRpdG9yID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgY3RybCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0Q29udHJvbCgpO1xuXHRcdFx0Y29uc3QgaXNDb2RlRWRpdG9yTGlrZSA9IGlzQ29kZUVkaXRvcihjdHJsKSB8fCBpc0RpZmZFZGl0b3IoY3RybCkgfHwgaXNDb21wb3NpdGVFZGl0b3IoY3RybCk7XG5cdFx0XHR0aGlzLl9jdHhQb3NzaWJsZS5zZXQoaXNDb2RlRWRpdG9yTGlrZSk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChlZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKHVwZGF0ZUVkaXRvcikpO1xuXHRcdHVwZGF0ZUVkaXRvcigpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9jdHhQb3NzaWJsZS5yZXNldCgpO1xuXHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyLnJlc2V0KCk7XG5cdFx0dGhpcy5fc3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsaUJBQThCLG1CQUFtQixvQkFBb0I7QUFDOUUsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBeUMsY0FBYyxtQkFBbUIsb0JBQW9CO0FBQzlGLFNBQVMsYUFBYTtBQUN0QixTQUFTLHdCQUF3QjtBQUVqQyxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx5QkFBeUI7QUFDbEMs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
