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
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { Barrier, DeferredPromise, Queue, raceCancellation } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { MovingAverage } from "../../../../base/common/numbers.js";
import { autorun, autorunWithStore, derived, observableFromEvent, observableSignalFromEvent, observableValue, transaction, waitForState } from "../../../../base/common/observable.js";
import { isEqual } from "../../../../base/common/resources.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { assertType } from "../../../../base/common/types.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection, SelectionDirection } from "../../../../editor/common/core/selection.js";
import { TextEdit } from "../../../../editor/common/languages.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { DefaultModelSHA1Computer } from "../../../../editor/common/services/modelService.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { MessageController } from "../../../../editor/contrib/message/browser/messageController.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { showChatView } from "../../chat/browser/chat.js";
import { ChatRequestRemovalReason } from "../../chat/common/chatModel.js";
import { IChatService } from "../../chat/common/chatService.js";
import { INotebookEditorService } from "../../notebook/browser/services/notebookEditorService.js";
import { CTX_INLINE_CHAT_EDITING, CTX_INLINE_CHAT_HAS_AGENT2, CTX_INLINE_CHAT_REQUEST_IN_PROGRESS, CTX_INLINE_CHAT_RESPONSE_TYPE, CTX_INLINE_CHAT_VISIBLE, INLINE_CHAT_ID, InlineChatConfigKeys, InlineChatResponseType } from "../common/inlineChat.js";
import { Session } from "./inlineChatSession.js";
import { IInlineChatSessionService } from "./inlineChatSessionService.js";
import { InlineChatError } from "./inlineChatSessionServiceImpl.js";
import { HunkAction, LiveStrategy } from "./inlineChatStrategies.js";
import { InlineChatZoneWidget } from "./inlineChatZoneWidget.js";
import { ChatAgentLocation } from "../../chat/common/constants.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { IChatEditingService, WorkingSetEntryState } from "../../chat/common/chatEditingService.js";
var State = /* @__PURE__ */ ((State2) => {
  State2["CREATE_SESSION"] = "CREATE_SESSION";
  State2["INIT_UI"] = "INIT_UI";
  State2["WAIT_FOR_INPUT"] = "WAIT_FOR_INPUT";
  State2["SHOW_REQUEST"] = "SHOW_REQUEST";
  State2["PAUSE"] = "PAUSE";
  State2["CANCEL"] = "CANCEL";
  State2["ACCEPT"] = "DONE";
  return State2;
})(State || {});
var Message = /* @__PURE__ */ ((Message2) => {
  Message2[Message2["NONE"] = 0] = "NONE";
  Message2[Message2["ACCEPT_SESSION"] = 1] = "ACCEPT_SESSION";
  Message2[Message2["CANCEL_SESSION"] = 2] = "CANCEL_SESSION";
  Message2[Message2["PAUSE_SESSION"] = 4] = "PAUSE_SESSION";
  Message2[Message2["CANCEL_REQUEST"] = 8] = "CANCEL_REQUEST";
  Message2[Message2["CANCEL_INPUT"] = 16] = "CANCEL_INPUT";
  Message2[Message2["ACCEPT_INPUT"] = 32] = "ACCEPT_INPUT";
  return Message2;
})(Message || {});
class InlineChatRunOptions {
  static isInlineChatRunOptions(options) {
    const { initialSelection, initialRange, message, autoSend, position, existingSession } = options;
    if (typeof message !== "undefined" && typeof message !== "string" || typeof autoSend !== "undefined" && typeof autoSend !== "boolean" || typeof initialRange !== "undefined" && !Range.isIRange(initialRange) || typeof initialSelection !== "undefined" && !Selection.isISelection(initialSelection) || typeof position !== "undefined" && !Position.isIPosition(position) || typeof existingSession !== "undefined" && !(existingSession instanceof Session)) {
      return false;
    }
    return true;
  }
}
let InlineChatController = class {
  static get(editor) {
    return editor.getContribution(InlineChatController.ID);
  }
  constructor(editor, contextKeyService) {
    const inlineChat2 = observableFromEvent(this, Event.filter(contextKeyService.onDidChangeContext, (e) => e.affectsSome(new Set(CTX_INLINE_CHAT_HAS_AGENT2.keys()))), () => contextKeyService.contextMatchesRules(CTX_INLINE_CHAT_HAS_AGENT2));
    this._delegate = derived((r) => {
      if (inlineChat2.read(r)) {
        return InlineChatController2.get(editor);
      } else {
        return InlineChatController1.get(editor);
      }
    });
  }
  dispose() {
  }
  get isActive() {
    return this._delegate.get().isActive;
  }
  async run(arg) {
    return this._delegate.get().run(arg);
  }
  focus() {
    return this._delegate.get().focus();
  }
  get widget() {
    return this._delegate.get().widget;
  }
  getWidgetPosition() {
    return this._delegate.get().getWidgetPosition();
  }
  acceptSession() {
    return this._delegate.get().acceptSession();
  }
};
InlineChatController.ID = "editor.contrib.inlineChatController";
InlineChatController = __decorateClass([
  __decorateParam(1, IContextKeyService)
], InlineChatController);
let InlineChatController1 = class {
  constructor(_editor, _instaService, _inlineChatSessionService, _editorWorkerService, _logService, _configurationService, _dialogService, contextKeyService, _chatService, _editorService, notebookEditorService) {
    this._editor = _editor;
    this._instaService = _instaService;
    this._inlineChatSessionService = _inlineChatSessionService;
    this._editorWorkerService = _editorWorkerService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._dialogService = _dialogService;
    this._chatService = _chatService;
    this._editorService = _editorService;
    this._isDisposed = false;
    this._store = new DisposableStore();
    this._messages = this._store.add(new Emitter());
    this._onDidEnterState = this._store.add(new Emitter());
    this._sessionStore = this._store.add(new DisposableStore());
    this._stashedSession = this._store.add(new MutableDisposable());
    this._ctxVisible = CTX_INLINE_CHAT_VISIBLE.bindTo(contextKeyService);
    this._ctxEditing = CTX_INLINE_CHAT_EDITING.bindTo(contextKeyService);
    this._ctxResponseType = CTX_INLINE_CHAT_RESPONSE_TYPE.bindTo(contextKeyService);
    this._ctxRequestInProgress = CTX_INLINE_CHAT_REQUEST_IN_PROGRESS.bindTo(contextKeyService);
    this._ctxResponse = ChatContextKeys.isResponse.bindTo(contextKeyService);
    ChatContextKeys.responseHasError.bindTo(contextKeyService);
    this._ui = new Lazy(() => {
      const location = {
        location: ChatAgentLocation.Editor,
        resolveData: () => {
          assertType(this._editor.hasModel());
          assertType(this._session);
          return {
            type: ChatAgentLocation.Editor,
            selection: this._editor.getSelection(),
            document: this._session.textModelN.uri,
            wholeRange: this._session?.wholeRange.trackedInitialRange
          };
        }
      };
      for (const notebookEditor of notebookEditorService.listNotebookEditors()) {
        for (const [, codeEditor] of notebookEditor.codeEditors) {
          if (codeEditor === this._editor) {
            location.location = ChatAgentLocation.Notebook;
            break;
          }
        }
      }
      const zone = _instaService.createInstance(InlineChatZoneWidget, location, void 0, this._editor);
      this._store.add(zone);
      this._store.add(zone.widget.chatWidget.onDidClear(async () => {
        const r = this.joinCurrentRun();
        this.cancelSession();
        await r;
        this.run();
      }));
      return zone;
    });
    this._store.add(this._editor.onDidChangeModel(async (e) => {
      if (this._session || !e.newModelUrl) {
        return;
      }
      const existingSession = this._inlineChatSessionService.getSession(this._editor, e.newModelUrl);
      if (!existingSession) {
        return;
      }
      this._log("session RESUMING after model change", e);
      await this.run({ existingSession });
    }));
    this._store.add(this._inlineChatSessionService.onDidEndSession((e) => {
      if (e.session === this._session && e.endedByExternalCause) {
        this._log("session ENDED by external cause");
        this.acceptSession();
      }
    }));
    this._store.add(this._inlineChatSessionService.onDidMoveSession(async (e) => {
      if (e.editor === this._editor) {
        this._log("session RESUMING after move", e);
        await this.run({ existingSession: e.session });
      }
    }));
    this._log(`NEW controller`);
  }
  static get(editor) {
    return editor.getContribution(INLINE_CHAT_ID);
  }
  get chatWidget() {
    return this._ui.value.widget.chatWidget;
  }
  dispose() {
    if (this._currentRun) {
      this._messages.fire(this._session?.chatModel.hasRequests ? 4 /* PAUSE_SESSION */ : 2 /* CANCEL_SESSION */);
    }
    this._store.dispose();
    this._isDisposed = true;
    this._log("DISPOSED controller");
  }
  _log(message, ...more) {
    if (message instanceof Error) {
      this._logService.error(message, ...more);
    } else {
      this._logService.trace(`[IE] (editor:${this._editor.getId()}) ${message}`, ...more);
    }
  }
  get widget() {
    return this._ui.value.widget;
  }
  getId() {
    return INLINE_CHAT_ID;
  }
  getWidgetPosition() {
    return this._ui.value.position;
  }
  async run(options = {}) {
    let lastState;
    const d = this._onDidEnterState.event((e) => lastState = e);
    try {
      this.acceptSession();
      if (this._currentRun) {
        await this._currentRun;
      }
      if (options.initialSelection) {
        this._editor.setSelection(options.initialSelection);
      }
      this._stashedSession.clear();
      this._currentRun = this._nextState("CREATE_SESSION" /* CREATE_SESSION */, options);
      await this._currentRun;
    } catch (error) {
      this._log("error during run", error);
      onUnexpectedError(error);
      if (this._session) {
        this._inlineChatSessionService.releaseSession(this._session);
      }
      this["PAUSE" /* PAUSE */]();
    } finally {
      this._currentRun = void 0;
      d.dispose();
    }
    return lastState !== "CANCEL" /* CANCEL */;
  }
  // ---- state machine
  async _nextState(state, options) {
    let nextState = state;
    while (nextState && !this._isDisposed) {
      this._log("setState to ", nextState);
      const p = this[nextState](options);
      this._onDidEnterState.fire(nextState);
      nextState = await p;
    }
  }
  async ["CREATE_SESSION" /* CREATE_SESSION */](options) {
    assertType(this._session === void 0);
    assertType(this._editor.hasModel());
    let session = options.existingSession;
    let initPosition;
    if (options.position) {
      initPosition = Position.lift(options.position).delta(-1);
      delete options.position;
    }
    const widgetPosition = this._showWidget(session?.headless, true, initPosition);
    let errorMessage = localize("create.fail", "Failed to start editor chat");
    if (!session) {
      const createSessionCts = new CancellationTokenSource();
      const msgListener = Event.once(this._messages.event)((m) => {
        this._log("state=_createSession) message received", m);
        if (m === 32 /* ACCEPT_INPUT */) {
          options.autoSend = true;
          this._ui.value.widget.updateInfo(localize("welcome.2", "Getting ready..."));
        } else {
          createSessionCts.cancel();
        }
      });
      try {
        session = await this._inlineChatSessionService.createSession(
          this._editor,
          { wholeRange: options.initialRange },
          createSessionCts.token
        );
      } catch (error) {
        if (error instanceof InlineChatError || error?.name === InlineChatError.code) {
          errorMessage = error.message;
        }
      }
      createSessionCts.dispose();
      msgListener.dispose();
      if (createSessionCts.token.isCancellationRequested) {
        if (session) {
          this._inlineChatSessionService.releaseSession(session);
        }
        return "CANCEL" /* CANCEL */;
      }
    }
    delete options.initialRange;
    delete options.existingSession;
    if (!session) {
      MessageController.get(this._editor)?.showMessage(errorMessage, widgetPosition);
      this._log("Failed to start editor chat");
      return "CANCEL" /* CANCEL */;
    }
    await session.chatModel.waitForInitialization();
    this._strategy = this._instaService.createInstance(LiveStrategy, session, this._editor, this._ui.value, session.headless);
    this._session = session;
    return "INIT_UI" /* INIT_UI */;
  }
  async ["INIT_UI" /* INIT_UI */](options) {
    assertType(this._session);
    assertType(this._strategy);
    InlineCompletionsController.get(this._editor)?.reject();
    this._sessionStore.clear();
    const wholeRangeDecoration = this._editor.createDecorationsCollection();
    const handleWholeRangeChange = () => {
      const newDecorations = this._strategy?.getWholeRangeDecoration() ?? [];
      wholeRangeDecoration.set(newDecorations);
      this._ctxEditing.set(!this._session?.wholeRange.trackedInitialRange.isEmpty());
    };
    this._sessionStore.add(toDisposable(() => {
      wholeRangeDecoration.clear();
      this._ctxEditing.reset();
    }));
    this._sessionStore.add(this._session.wholeRange.onDidChange(handleWholeRangeChange));
    handleWholeRangeChange();
    this._ui.value.widget.setChatModel(this._session.chatModel);
    this._updatePlaceholder();
    const isModelEmpty = !this._session.chatModel.hasRequests;
    this._ui.value.widget.updateToolbar(true);
    this._ui.value.widget.toggleStatus(!isModelEmpty);
    this._showWidget(this._session.headless, isModelEmpty);
    this._sessionStore.add(this._editor.onDidChangeModel((e) => {
      const msg = this._session?.chatModel.hasRequests ? 4 /* PAUSE_SESSION */ : 2 /* CANCEL_SESSION */;
      this._log("model changed, pause or cancel session", msg, e);
      this._messages.fire(msg);
    }));
    this._sessionStore.add(this._editor.onDidChangeModelContent((e) => {
      if (this._session?.hunkData.ignoreTextModelNChanges || this._ui.value.widget.hasFocus()) {
        return;
      }
      const wholeRange = this._session.wholeRange;
      let shouldFinishSession = false;
      if (this._configurationService.getValue(InlineChatConfigKeys.FinishOnType)) {
        for (const { range } of e.changes) {
          shouldFinishSession = !Range.areIntersectingOrTouching(range, wholeRange.value);
        }
      }
      this._session.recordExternalEditOccurred(shouldFinishSession);
      if (shouldFinishSession) {
        this._log("text changed outside of whole range, FINISH session");
        this.acceptSession();
      }
    }));
    this._sessionStore.add(this._session.chatModel.onDidChange(async (e) => {
      if (e.kind === "removeRequest") {
        await this._session.undoChangesUntil(e.requestId);
      }
    }));
    const editState = this._createChatTextEditGroupState();
    let didEdit = false;
    for (const request of this._session.chatModel.getRequests()) {
      if (!request.response || request.response.result?.errorDetails) {
        break;
      }
      for (const part of request.response.response.value) {
        if (part.kind !== "textEditGroup" || !isEqual(part.uri, this._session.textModelN.uri)) {
          continue;
        }
        if (part.state?.applied) {
          continue;
        }
        for (const edit of part.edits) {
          this._makeChanges(edit, void 0, !didEdit);
          didEdit = true;
        }
        part.state ??= editState;
      }
    }
    if (didEdit) {
      const diff = await this._editorWorkerService.computeDiff(this._session.textModel0.uri, this._session.textModelN.uri, { computeMoves: false, maxComputationTimeMs: Number.MAX_SAFE_INTEGER, ignoreTrimWhitespace: false }, "advanced");
      this._session.wholeRange.fixup(diff?.changes ?? []);
      await this._session.hunkData.recompute(editState, diff);
      this._updateCtxResponseType();
    }
    options.position = await this._strategy.renderChanges();
    if (this._session.chatModel.requestInProgress) {
      return "SHOW_REQUEST" /* SHOW_REQUEST */;
    } else {
      return "WAIT_FOR_INPUT" /* WAIT_FOR_INPUT */;
    }
  }
  async ["WAIT_FOR_INPUT" /* WAIT_FOR_INPUT */](options) {
    assertType(this._session);
    assertType(this._strategy);
    this._updatePlaceholder();
    if (options.message) {
      this._updateInput(options.message);
      aria.alert(options.message);
      delete options.message;
      this._showWidget(this._session.headless, false);
    }
    let message = 0 /* NONE */;
    let request;
    const barrier = new Barrier();
    const store = new DisposableStore();
    store.add(this._session.chatModel.onDidChange((e) => {
      if (e.kind === "addRequest") {
        request = e.request;
        message = 32 /* ACCEPT_INPUT */;
        barrier.open();
      }
    }));
    store.add(this._strategy.onDidAccept(() => this.acceptSession()));
    store.add(this._strategy.onDidDiscard(() => this.cancelSession()));
    store.add(Event.once(this._messages.event)((m) => {
      this._log("state=_waitForInput) message received", m);
      message = m;
      barrier.open();
    }));
    if (options.autoSend) {
      delete options.autoSend;
      this._showWidget(this._session.headless, false);
      this._ui.value.widget.chatWidget.acceptInput();
    }
    await barrier.wait();
    store.dispose();
    if (message & (16 /* CANCEL_INPUT */ | 2 /* CANCEL_SESSION */)) {
      return "CANCEL" /* CANCEL */;
    }
    if (message & 4 /* PAUSE_SESSION */) {
      return "PAUSE" /* PAUSE */;
    }
    if (message & 1 /* ACCEPT_SESSION */) {
      this._ui.value.widget.selectAll();
      return "DONE" /* ACCEPT */;
    }
    if (!request?.message.text) {
      return "WAIT_FOR_INPUT" /* WAIT_FOR_INPUT */;
    }
    return "SHOW_REQUEST" /* SHOW_REQUEST */;
  }
  async ["SHOW_REQUEST" /* SHOW_REQUEST */](options) {
    assertType(this._session);
    assertType(this._strategy);
    assertType(this._session.chatModel.requestInProgress);
    this._ctxRequestInProgress.set(true);
    const { chatModel } = this._session;
    const request = chatModel.lastRequest;
    assertType(request);
    assertType(request.response);
    this._showWidget(this._session.headless, false);
    this._ui.value.widget.selectAll();
    this._ui.value.widget.updateInfo("");
    this._ui.value.widget.toggleStatus(true);
    const { response } = request;
    const responsePromise = new DeferredPromise();
    const store = new DisposableStore();
    const progressiveEditsCts = store.add(new CancellationTokenSource());
    const progressiveEditsAvgDuration = new MovingAverage();
    const progressiveEditsClock = StopWatch.create();
    const progressiveEditsQueue = new Queue();
    const origDeco = this._editor.getOption(EditorOption.renderValidationDecorations);
    this._editor.updateOptions({
      renderValidationDecorations: "off"
    });
    store.add(toDisposable(() => {
      this._editor.updateOptions({
        renderValidationDecorations: origDeco
      });
    }));
    let next = "WAIT_FOR_INPUT" /* WAIT_FOR_INPUT */;
    store.add(Event.once(this._messages.event)((message) => {
      this._log("state=_makeRequest) message received", message);
      this._chatService.cancelCurrentRequestForSession(chatModel.sessionId);
      if (message & 2 /* CANCEL_SESSION */) {
        next = "CANCEL" /* CANCEL */;
      } else if (message & 4 /* PAUSE_SESSION */) {
        next = "PAUSE" /* PAUSE */;
      } else if (message & 1 /* ACCEPT_SESSION */) {
        next = "DONE" /* ACCEPT */;
      }
    }));
    store.add(chatModel.onDidChange(async (e) => {
      if (e.kind === "removeRequest" && e.requestId === request.id) {
        progressiveEditsCts.cancel();
        responsePromise.complete();
        if (e.reason === ChatRequestRemovalReason.Resend) {
          next = "SHOW_REQUEST" /* SHOW_REQUEST */;
        } else {
          next = "CANCEL" /* CANCEL */;
        }
        return;
      }
      if (e.kind === "move") {
        assertType(this._session);
        const log = (msg, ...args) => this._log("state=_showRequest) moving inline chat", msg, ...args);
        log("move was requested", e.target, e.range);
        const initialSelection = Selection.fromRange(Range.lift(e.range), SelectionDirection.LTR);
        const editorPane = await this._editorService.openEditor({ resource: e.target, options: { selection: initialSelection } }, SIDE_GROUP);
        if (!editorPane) {
          log("opening editor failed");
          return;
        }
        const newEditor = editorPane.getControl();
        if (!isCodeEditor(newEditor) || !newEditor.hasModel()) {
          log("new editor is either missing or not a code editor or does not have a model");
          return;
        }
        if (this._inlineChatSessionService.getSession(newEditor, e.target)) {
          log("new editor ALREADY has a session");
          return;
        }
        const newSession = await this._inlineChatSessionService.createSession(
          newEditor,
          {
            session: this._session
          },
          CancellationToken.None
        );
        InlineChatController1.get(newEditor)?.run({ existingSession: newSession });
        next = "CANCEL" /* CANCEL */;
        responsePromise.complete();
        return;
      }
    }));
    store.add(this._ui.value.widget.chatWidget.inputEditor.onDidChangeModelContent(() => {
      this._chatService.cancelCurrentRequestForSession(chatModel.sessionId);
    }));
    let lastLength = 0;
    let isFirstChange = true;
    const editState = this._createChatTextEditGroupState();
    let localEditGroup;
    const handleResponse = () => {
      this._updateCtxResponseType();
      if (!localEditGroup) {
        localEditGroup = response.response.value.find((part) => part.kind === "textEditGroup" && isEqual(part.uri, this._session?.textModelN.uri));
      }
      if (localEditGroup) {
        localEditGroup.state ??= editState;
        const edits = localEditGroup.edits;
        const newEdits = edits.slice(lastLength);
        if (newEdits.length > 0) {
          this._log(`${this._session?.textModelN.uri.toString()} received ${newEdits.length} edits`);
          lastLength = edits.length;
          progressiveEditsAvgDuration.update(progressiveEditsClock.elapsed());
          progressiveEditsClock.reset();
          progressiveEditsQueue.queue(async () => {
            const startThen = this._session.wholeRange.value.getStartPosition();
            for (const edits2 of newEdits) {
              await this._makeChanges(edits2, {
                duration: progressiveEditsAvgDuration.value,
                token: progressiveEditsCts.token
              }, isFirstChange);
              isFirstChange = false;
            }
            const startNow = this._session.wholeRange.value.getStartPosition();
            if (!startNow.equals(startThen) || !this._ui.value.position?.equals(startNow)) {
              this._showWidget(this._session.headless, false, startNow.delta(-1));
            }
          });
        }
      }
      if (response.isCanceled) {
        progressiveEditsCts.cancel();
        responsePromise.complete();
      } else if (response.isComplete) {
        responsePromise.complete();
      }
    };
    store.add(response.onDidChange(handleResponse));
    handleResponse();
    await responsePromise.p;
    await progressiveEditsQueue.whenIdle();
    if (response.result?.errorDetails && !response.result.errorDetails.responseIsFiltered) {
      await this._session.undoChangesUntil(response.requestId);
    }
    store.dispose();
    const diff = await this._editorWorkerService.computeDiff(this._session.textModel0.uri, this._session.textModelN.uri, { computeMoves: false, maxComputationTimeMs: Number.MAX_SAFE_INTEGER, ignoreTrimWhitespace: false }, "advanced");
    this._session.wholeRange.fixup(diff?.changes ?? []);
    await this._session.hunkData.recompute(editState, diff);
    this._ctxRequestInProgress.set(false);
    let newPosition;
    if (response.result?.errorDetails) {
    } else if (response.response.value.length === 0) {
      const status = localize("empty", "No results, please refine your input and try again");
      this._ui.value.widget.updateStatus(status, { classes: ["warn"] });
    } else {
      this._ui.value.widget.updateStatus("");
    }
    const position = await this._strategy.renderChanges();
    if (position) {
      const selection = this._editor.getSelection();
      if (selection?.containsPosition(position)) {
        if (position.lineNumber - selection.startLineNumber > 8) {
          newPosition = position;
        }
      } else {
        newPosition = position;
      }
    }
    this._showWidget(this._session.headless, false, newPosition);
    return next;
  }
  async ["PAUSE" /* PAUSE */]() {
    this._resetWidget();
    this._strategy?.dispose?.();
    this._session = void 0;
  }
  async ["DONE" /* ACCEPT */]() {
    assertType(this._session);
    assertType(this._strategy);
    this._sessionStore.clear();
    try {
      await this._strategy.apply();
    } catch (err) {
      this._dialogService.error(localize("err.apply", "Failed to apply changes.", toErrorMessage(err)));
      this._log("FAILED to apply changes");
      this._log(err);
    }
    this._resetWidget();
    this._inlineChatSessionService.releaseSession(this._session);
    this._strategy?.dispose();
    this._strategy = void 0;
    this._session = void 0;
  }
  async ["CANCEL" /* CANCEL */]() {
    this._resetWidget();
    if (this._session) {
      assertType(this._strategy);
      this._sessionStore.clear();
      const shouldStash = !this._session.isUnstashed && this._session.chatModel.hasRequests && this._session.hunkData.size === this._session.hunkData.pending;
      let undoCancelEdits = [];
      try {
        undoCancelEdits = this._strategy.cancel();
      } catch (err) {
        this._dialogService.error(localize("err.discard", "Failed to discard changes.", toErrorMessage(err)));
        this._log("FAILED to discard changes");
        this._log(err);
      }
      this._stashedSession.clear();
      if (shouldStash) {
        this._stashedSession.value = this._inlineChatSessionService.stashSession(this._session, this._editor, undoCancelEdits);
      } else {
        this._inlineChatSessionService.releaseSession(this._session);
      }
    }
    this._strategy?.dispose();
    this._strategy = void 0;
    this._session = void 0;
  }
  // ----
  _showWidget(headless = false, initialRender = false, position) {
    assertType(this._editor.hasModel());
    this._ctxVisible.set(true);
    let widgetPosition;
    if (position) {
      widgetPosition = position;
    } else if (this._ui.rawValue?.position) {
      if (this._ui.rawValue?.position.lineNumber === 1) {
        widgetPosition = this._ui.rawValue?.position.delta(-1);
      } else {
        widgetPosition = this._ui.rawValue?.position;
      }
    } else {
      widgetPosition = this._editor.getSelection().getStartPosition().delta(-1);
    }
    if (this._session && !position && (this._session.hasChangedText || this._session.chatModel.hasRequests)) {
      widgetPosition = this._session.wholeRange.trackedInitialRange.getStartPosition().delta(-1);
    }
    if (initialRender && this._editor.getOption(EditorOption.stickyScroll).enabled) {
      this._editor.revealLine(widgetPosition.lineNumber);
    }
    if (!headless) {
      if (this._ui.rawValue?.position) {
        this._ui.value.updatePositionAndHeight(widgetPosition);
      } else {
        this._ui.value.show(widgetPosition);
      }
    }
    return widgetPosition;
  }
  _resetWidget() {
    this._sessionStore.clear();
    this._ctxVisible.reset();
    this._ui.rawValue?.hide();
    if (this._editor.hasWidgetFocus()) {
      this._editor.focus();
    }
  }
  _updateCtxResponseType() {
    if (!this._session) {
      this._ctxResponseType.set(InlineChatResponseType.None);
      return;
    }
    const hasLocalEdit = (response) => {
      return response.value.some((part) => part.kind === "textEditGroup" && isEqual(part.uri, this._session?.textModelN.uri));
    };
    let responseType = InlineChatResponseType.None;
    for (const request of this._session.chatModel.getRequests()) {
      if (!request.response) {
        continue;
      }
      responseType = InlineChatResponseType.Messages;
      if (hasLocalEdit(request.response.response)) {
        responseType = InlineChatResponseType.MessagesAndEdits;
        break;
      }
    }
    this._ctxResponseType.set(responseType);
    this._ctxResponse.set(responseType !== InlineChatResponseType.None);
  }
  _createChatTextEditGroupState() {
    assertType(this._session);
    const sha1 = new DefaultModelSHA1Computer();
    const textModel0Sha1 = sha1.canComputeSHA1(this._session.textModel0) ? sha1.computeSHA1(this._session.textModel0) : generateUuid();
    return {
      sha1: textModel0Sha1,
      applied: 0
    };
  }
  async _makeChanges(edits, opts, undoStopBefore) {
    assertType(this._session);
    assertType(this._strategy);
    const moreMinimalEdits = await this._editorWorkerService.computeMoreMinimalEdits(this._session.textModelN.uri, edits);
    this._log("edits from PROVIDER and after making them MORE MINIMAL", this._session.agent.extensionId, edits, moreMinimalEdits);
    if (moreMinimalEdits?.length === 0) {
      return;
    }
    const actualEdits = !opts && moreMinimalEdits ? moreMinimalEdits : edits;
    const editOperations = actualEdits.map(TextEdit.asEditOperation);
    const editsObserver = {
      start: () => this._session.hunkData.ignoreTextModelNChanges = true,
      stop: () => this._session.hunkData.ignoreTextModelNChanges = false
    };
    if (opts) {
      await this._strategy.makeProgressiveChanges(editOperations, editsObserver, opts, undoStopBefore);
    } else {
      await this._strategy.makeChanges(editOperations, editsObserver, undoStopBefore);
    }
  }
  _updatePlaceholder() {
    this._ui.value.widget.placeholder = this._session?.agent.description ?? "";
  }
  _updateInput(text, selectAll = true) {
    this._ui.value.widget.chatWidget.setInput(text);
    if (selectAll) {
      const newSelection = new Selection(1, 1, Number.MAX_SAFE_INTEGER, 1);
      this._ui.value.widget.chatWidget.inputEditor.setSelection(newSelection);
    }
  }
  // ---- controller API
  arrowOut(up) {
    if (this._ui.value.position && this._editor.hasModel()) {
      const { column } = this._editor.getPosition();
      const { lineNumber } = this._ui.value.position;
      const newLine = up ? lineNumber : lineNumber + 1;
      this._editor.setPosition({ lineNumber: newLine, column });
      this._editor.focus();
    }
  }
  focus() {
    this._ui.value.widget.focus();
  }
  async viewInChat() {
    if (!this._strategy || !this._session) {
      return;
    }
    let someApplied = false;
    let lastEdit;
    const uri = this._editor.getModel()?.uri;
    const requests = this._session.chatModel.getRequests();
    for (const request of requests) {
      if (!request.response) {
        continue;
      }
      for (const part of request.response.response.value) {
        if (part.kind === "textEditGroup" && isEqual(part.uri, uri)) {
          someApplied = someApplied || Boolean(part.state?.applied);
          lastEdit = part;
        }
      }
    }
    const doEdits = this._strategy.cancel();
    if (someApplied) {
      assertType(lastEdit);
      lastEdit.edits = [doEdits];
      lastEdit.state.applied = 0;
    }
    await this._instaService.invokeFunction(moveToPanelChat, this._session?.chatModel);
    this.cancelSession();
  }
  acceptSession() {
    const response = this._session?.chatModel.getRequests().at(-1)?.response;
    if (response) {
      this._chatService.notifyUserAction({
        sessionId: response.session.sessionId,
        requestId: response.requestId,
        agentId: response.agent?.id,
        command: response.slashCommand?.name,
        result: response.result,
        action: {
          kind: "inlineChat",
          action: "accepted"
        }
      });
    }
    this._messages.fire(1 /* ACCEPT_SESSION */);
  }
  acceptHunk(hunkInfo) {
    return this._strategy?.performHunkAction(hunkInfo, HunkAction.Accept);
  }
  discardHunk(hunkInfo) {
    return this._strategy?.performHunkAction(hunkInfo, HunkAction.Discard);
  }
  toggleDiff(hunkInfo) {
    return this._strategy?.performHunkAction(hunkInfo, HunkAction.ToggleDiff);
  }
  moveHunk(next) {
    this.focus();
    this._strategy?.performHunkAction(void 0, next ? HunkAction.MoveNext : HunkAction.MovePrev);
  }
  async cancelSession() {
    const response = this._session?.chatModel.lastRequest?.response;
    if (response) {
      this._chatService.notifyUserAction({
        sessionId: response.session.sessionId,
        requestId: response.requestId,
        agentId: response.agent?.id,
        command: response.slashCommand?.name,
        result: response.result,
        action: {
          kind: "inlineChat",
          action: "discarded"
        }
      });
    }
    this._messages.fire(2 /* CANCEL_SESSION */);
  }
  reportIssue() {
    const response = this._session?.chatModel.lastRequest?.response;
    if (response) {
      this._chatService.notifyUserAction({
        sessionId: response.session.sessionId,
        requestId: response.requestId,
        agentId: response.agent?.id,
        command: response.slashCommand?.name,
        result: response.result,
        action: { kind: "bug" }
      });
    }
  }
  unstashLastSession() {
    const result = this._stashedSession.value?.unstash();
    return result;
  }
  joinCurrentRun() {
    return this._currentRun;
  }
  get isActive() {
    return Boolean(this._currentRun);
  }
};
InlineChatController1 = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IInlineChatSessionService),
  __decorateParam(3, IEditorWorkerService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IChatService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, INotebookEditorService)
], InlineChatController1);
let InlineChatController2 = class {
  constructor(_editor, _instaService, _notebookEditorService, _inlineChatSessions, codeEditorService, contextKeyService) {
    this._editor = _editor;
    this._instaService = _instaService;
    this._notebookEditorService = _notebookEditorService;
    this._inlineChatSessions = _inlineChatSessions;
    this._store = new DisposableStore();
    this._showWidgetOverrideObs = observableValue(this, false);
    this._isActiveController = observableValue(this, false);
    const ctxInlineChatVisible = CTX_INLINE_CHAT_VISIBLE.bindTo(contextKeyService);
    this._zone = new Lazy(() => {
      const location = {
        location: ChatAgentLocation.Editor,
        resolveData: () => {
          assertType(this._editor.hasModel());
          return {
            type: ChatAgentLocation.Editor,
            selection: this._editor.getSelection(),
            document: this._editor.getModel().uri,
            wholeRange: this._editor.getSelection()
          };
        }
      };
      for (const notebookEditor of this._notebookEditorService.listNotebookEditors()) {
        for (const [, codeEditor] of notebookEditor.codeEditors) {
          if (codeEditor === this._editor) {
            location.location = ChatAgentLocation.Notebook;
            break;
          }
        }
      }
      const result = this._instaService.createInstance(
        InlineChatZoneWidget,
        location,
        {
          enableWorkingSet: "implicit",
          rendererOptions: {
            renderTextEditsAsSummary: (_uri) => true
          }
        },
        this._editor
      );
      result.domNode.classList.add("inline-chat-2");
      return result;
    });
    const editorObs = observableCodeEditor(_editor);
    const sessionsSignal = observableSignalFromEvent(this, _inlineChatSessions.onDidChangeSessions);
    this._currentSession = derived((r) => {
      sessionsSignal.read(r);
      const model = editorObs.model.read(r);
      const value = model && _inlineChatSessions.getSession2(model.uri);
      return value ?? void 0;
    });
    this._store.add(autorun((r) => {
      const session = this._currentSession.read(r);
      if (!session) {
        this._isActiveController.set(false, void 0);
        return;
      }
      let foundOne = false;
      for (const editor of codeEditorService.listCodeEditors()) {
        if (Boolean(InlineChatController2.get(editor)?._isActiveController.get())) {
          foundOne = true;
          break;
        }
      }
      if (!foundOne && _editor.hasWidgetFocus()) {
        this._isActiveController.set(true, void 0);
      }
    }));
    const visibleSessionObs = observableValue(this, void 0);
    this._store.add(autorunWithStore((r, store) => {
      const model = editorObs.model.read(r);
      const session = this._currentSession.read(r);
      const isActive = this._isActiveController.read(r);
      if (!session || !isActive || !model) {
        visibleSessionObs.set(void 0, void 0);
        return;
      }
      const { chatModel } = session;
      const showShowUntil = this._showWidgetOverrideObs.read(r);
      const hasNoRequests = chatModel.getRequests().length === 0;
      const responseListener = store.add(new MutableDisposable());
      store.add(chatModel.onDidChange((e) => {
        if (e.kind === "addRequest") {
          transaction((tx) => {
            this._showWidgetOverrideObs.set(false, tx);
            visibleSessionObs.set(void 0, tx);
          });
          const { response } = e.request;
          if (!response) {
            return;
          }
          responseListener.value = response.onDidChange(async (e2) => {
            if (!response.isComplete) {
              return;
            }
            const shouldShow = response.isCanceled || response.result?.errorDetails || !response.response.value.find((part) => part.kind === "textEditGroup" && part.edits.length > 0 && isEqual(part.uri, model.uri));
            if (shouldShow) {
              visibleSessionObs.set(session, void 0);
            }
          });
        }
      }));
      if (showShowUntil || hasNoRequests) {
        visibleSessionObs.set(session, void 0);
      } else {
        visibleSessionObs.set(void 0, void 0);
      }
    }));
    this._store.add(autorun((r) => {
      const session = visibleSessionObs.read(r);
      if (!session) {
        this._zone.rawValue?.hide();
        _editor.focus();
        ctxInlineChatVisible.reset();
      } else {
        ctxInlineChatVisible.set(true);
        this._zone.value.widget.setChatModel(session.chatModel);
        if (!this._zone.value.position) {
          this._zone.value.show(session.initialPosition);
        }
        this._zone.value.reveal(this._zone.value.position);
        this._zone.value.widget.focus();
        session.editingSession.getEntry(session.uri)?.autoAcceptController.get()?.cancel();
      }
    }));
  }
  static get(editor) {
    return editor.getContribution(InlineChatController2.ID) ?? void 0;
  }
  get widget() {
    return this._zone.value.widget;
  }
  get isActive() {
    return Boolean(this._currentSession.get());
  }
  dispose() {
    this._store.dispose();
  }
  toggleWidgetUntilNextRequest() {
    const value = this._showWidgetOverrideObs.get();
    this._showWidgetOverrideObs.set(!value, void 0);
  }
  getWidgetPosition() {
    return this._zone.rawValue?.position;
  }
  focus() {
    this._zone.rawValue?.widget.focus();
  }
  markActiveController() {
    this._isActiveController.set(true, void 0);
  }
  async run(arg) {
    assertType(this._editor.hasModel());
    this.markActiveController();
    const uri = this._editor.getModel().uri;
    const session = this._inlineChatSessions.getSession2(uri) ?? await this._inlineChatSessions.createSession2(this._editor, uri, CancellationToken.None);
    if (arg && InlineChatRunOptions.isInlineChatRunOptions(arg)) {
      if (arg.initialRange) {
        this._editor.revealRange(arg.initialRange);
      }
      if (arg.initialSelection) {
        this._editor.setSelection(arg.initialSelection);
      }
      if (arg.message) {
        this._zone.value.widget.chatWidget.setInput(arg.message);
        if (arg.autoSend) {
          await this._zone.value.widget.chatWidget.acceptInput();
        }
      }
    }
    await Event.toPromise(session.editingSession.onDidDispose);
    const rejected = session.editingSession.getEntry(uri)?.state.get() === WorkingSetEntryState.Rejected;
    return !rejected;
  }
  acceptSession() {
    const value = this._currentSession.get();
    value?.editingSession.accept();
  }
};
InlineChatController2.ID = "editor.contrib.inlineChatController2";
InlineChatController2 = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, INotebookEditorService),
  __decorateParam(3, IInlineChatSessionService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IContextKeyService)
], InlineChatController2);
async function reviewEdits(accessor, editor, stream, token) {
  if (!editor.hasModel()) {
    return false;
  }
  const chatService = accessor.get(IChatService);
  const chatEditingService = accessor.get(IChatEditingService);
  const uri = editor.getModel().uri;
  const chatModel = chatService.startSession(ChatAgentLocation.Editor, token, false);
  const editSession = await chatEditingService.createEditingSession(chatModel);
  const store = new DisposableStore();
  store.add(chatModel);
  store.add(editSession);
  const chatRequest = chatModel?.addRequest({ text: "", parts: [] }, { variables: [] }, 0);
  assertType(chatRequest.response);
  chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: false });
  for await (const chunk of stream) {
    if (token.isCancellationRequested) {
      chatRequest.response.cancel();
      break;
    }
    chatRequest.response.updateContent({ kind: "textEdit", uri, edits: chunk, done: false });
  }
  chatRequest.response.updateContent({ kind: "textEdit", uri, edits: [], done: true });
  if (!token.isCancellationRequested) {
    chatRequest.response.complete();
  }
  const isSettled = derived((r) => {
    const entry = editSession.readEntry(uri, r);
    if (!entry) {
      return false;
    }
    const state = entry.state.read(r);
    return state === WorkingSetEntryState.Accepted || state === WorkingSetEntryState.Rejected;
  });
  const whenDecided = waitForState(isSettled, Boolean);
  await raceCancellation(whenDecided, token);
  store.dispose();
  return true;
}
async function moveToPanelChat(accessor, model) {
  const viewsService = accessor.get(IViewsService);
  const chatService = accessor.get(IChatService);
  const widget = await showChatView(viewsService);
  if (widget && widget.viewModel && model) {
    for (const request of model.getRequests().slice()) {
      await chatService.adoptRequest(widget.viewModel.model.sessionId, request);
    }
    widget.focusLastMessage();
  }
}
export {
  InlineChatController,
  InlineChatController1,
  InlineChatController2,
  InlineChatRunOptions,
  State,
  reviewEdits
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdENvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBhcmlhIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgQmFycmllciwgRGVmZXJyZWRQcm9taXNlLCBRdWV1ZSwgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNb3ZpbmdBdmVyYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBhdXRvcnVuV2l0aFN0b3JlLCBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCwgb2JzZXJ2YWJsZVZhbHVlLCB0cmFuc2FjdGlvbiwgd2FpdEZvclN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciwgaXNDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBvYnNlcnZhYmxlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElTZWxlY3Rpb24sIFNlbGVjdGlvbiwgU2VsZWN0aW9uRGlyZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJVmFsaWRFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IERlZmF1bHRNb2RlbFNIQTFDb21wdXRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvY29udHJvbGxlci9pbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgTWVzc2FnZUNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9tZXNzYWdlL2Jyb3dzZXIvbWVzc2FnZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNob3dDaGF0VmlldyB9IGZyb20gJy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0LmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0TG9jYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vY2hhdC9icm93c2VyL2NoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGVsLCBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24sIElDaGF0UmVxdWVzdE1vZGVsLCBJQ2hhdFRleHRFZGl0R3JvdXAsIElDaGF0VGV4dEVkaXRHcm91cFN0YXRlLCBJUmVzcG9uc2UgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENUWF9JTkxJTkVfQ0hBVF9FRElUSU5HLCBDVFhfSU5MSU5FX0NIQVRfSEFTX0FHRU5UMiwgQ1RYX0lOTElORV9DSEFUX1JFUVVFU1RfSU5fUFJPR1JFU1MsIENUWF9JTkxJTkVfQ0hBVF9SRVNQT05TRV9UWVBFLCBDVFhfSU5MSU5FX0NIQVRfVklTSUJMRSwgSU5MSU5FX0NIQVRfSUQsIElubGluZUNoYXRDb25maWdLZXlzLCBJbmxpbmVDaGF0UmVzcG9uc2VUeXBlIH0gZnJvbSAnLi4vY29tbW9uL2lubGluZUNoYXQuanMnO1xuaW1wb3J0IHsgSHVua0luZm9ybWF0aW9uLCBTZXNzaW9uLCBTdGFzaGVkU2Vzc2lvbiB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb24uanMnO1xuaW1wb3J0IHsgSUlubGluZUNoYXRTZXNzaW9uMiwgSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElubGluZUNoYXRFcnJvciB9IGZyb20gJy4vaW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBIdW5rQWN0aW9uLCBJRWRpdE9ic2VydmVyLCBMaXZlU3RyYXRlZ3ksIFByb2dyZXNzaW5nRWRpdHNPcHRpb25zIH0gZnJvbSAnLi9pbmxpbmVDaGF0U3RyYXRlZ2llcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JCYXNlZElubGluZUNoYXRXaWRnZXQgfSBmcm9tICcuL2lubGluZUNoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgSW5saW5lQ2hhdFpvbmVXaWRnZXQgfSBmcm9tICcuL2lubGluZUNoYXRab25lV2lkZ2V0LmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFN0YXRlIHtcblx0Q1JFQVRFX1NFU1NJT04gPSAnQ1JFQVRFX1NFU1NJT04nLFxuXHRJTklUX1VJID0gJ0lOSVRfVUknLFxuXHRXQUlUX0ZPUl9JTlBVVCA9ICdXQUlUX0ZPUl9JTlBVVCcsXG5cdFNIT1dfUkVRVUVTVCA9ICdTSE9XX1JFUVVFU1QnLFxuXHRQQVVTRSA9ICdQQVVTRScsXG5cdENBTkNFTCA9ICdDQU5DRUwnLFxuXHRBQ0NFUFQgPSAnRE9ORScsXG59XG5cbmNvbnN0IGVudW0gTWVzc2FnZSB7XG5cdE5PTkUgPSAwLFxuXHRBQ0NFUFRfU0VTU0lPTiA9IDEgPDwgMCxcblx0Q0FOQ0VMX1NFU1NJT04gPSAxIDw8IDEsXG5cdFBBVVNFX1NFU1NJT04gPSAxIDw8IDIsXG5cdENBTkNFTF9SRVFVRVNUID0gMSA8PCAzLFxuXHRDQU5DRUxfSU5QVVQgPSAxIDw8IDQsXG5cdEFDQ0VQVF9JTlBVVCA9IDEgPDwgNSxcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIElubGluZUNoYXRSdW5PcHRpb25zIHtcblx0aW5pdGlhbFNlbGVjdGlvbj86IElTZWxlY3Rpb247XG5cdGluaXRpYWxSYW5nZT86IElSYW5nZTtcblx0bWVzc2FnZT86IHN0cmluZztcblx0YXV0b1NlbmQ/OiBib29sZWFuO1xuXHRleGlzdGluZ1Nlc3Npb24/OiBTZXNzaW9uO1xuXHRwb3NpdGlvbj86IElQb3NpdGlvbjtcblxuXHRzdGF0aWMgaXNJbmxpbmVDaGF0UnVuT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBvcHRpb25zIGlzIElubGluZUNoYXRSdW5PcHRpb25zIHtcblx0XHRjb25zdCB7IGluaXRpYWxTZWxlY3Rpb24sIGluaXRpYWxSYW5nZSwgbWVzc2FnZSwgYXV0b1NlbmQsIHBvc2l0aW9uLCBleGlzdGluZ1Nlc3Npb24gfSA9IDxJbmxpbmVDaGF0UnVuT3B0aW9ucz5vcHRpb25zO1xuXHRcdGlmIChcblx0XHRcdHR5cGVvZiBtZXNzYWdlICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbWVzc2FnZSAhPT0gJ3N0cmluZydcblx0XHRcdHx8IHR5cGVvZiBhdXRvU2VuZCAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGF1dG9TZW5kICE9PSAnYm9vbGVhbidcblx0XHRcdHx8IHR5cGVvZiBpbml0aWFsUmFuZ2UgIT09ICd1bmRlZmluZWQnICYmICFSYW5nZS5pc0lSYW5nZShpbml0aWFsUmFuZ2UpXG5cdFx0XHR8fCB0eXBlb2YgaW5pdGlhbFNlbGVjdGlvbiAhPT0gJ3VuZGVmaW5lZCcgJiYgIVNlbGVjdGlvbi5pc0lTZWxlY3Rpb24oaW5pdGlhbFNlbGVjdGlvbilcblx0XHRcdHx8IHR5cGVvZiBwb3NpdGlvbiAhPT0gJ3VuZGVmaW5lZCcgJiYgIVBvc2l0aW9uLmlzSVBvc2l0aW9uKHBvc2l0aW9uKVxuXHRcdFx0fHwgdHlwZW9mIGV4aXN0aW5nU2Vzc2lvbiAhPT0gJ3VuZGVmaW5lZCcgJiYgIShleGlzdGluZ1Nlc3Npb24gaW5zdGFuY2VvZiBTZXNzaW9uKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lQ2hhdENvbnRyb2xsZXIgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgSUQgPSAnZWRpdG9yLmNvbnRyaWIuaW5saW5lQ2hhdENvbnRyb2xsZXInO1xuXG5cdHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcikge1xuXHRcdHJldHVybiBlZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElubGluZUNoYXRDb250cm9sbGVyPihJbmxpbmVDaGF0Q29udHJvbGxlci5JRCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWxlZ2F0ZTogSU9ic2VydmFibGU8SW5saW5lQ2hhdENvbnRyb2xsZXIxIHwgSW5saW5lQ2hhdENvbnRyb2xsZXIyPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cblx0XHRjb25zdCBpbmxpbmVDaGF0MiA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcywgRXZlbnQuZmlsdGVyKGNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dCwgZSA9PiBlLmFmZmVjdHNTb21lKG5ldyBTZXQoQ1RYX0lOTElORV9DSEFUX0hBU19BR0VOVDIua2V5cygpKSkpLCAoKSA9PiBjb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKENUWF9JTkxJTkVfQ0hBVF9IQVNfQUdFTlQyKSk7XG5cblx0XHR0aGlzLl9kZWxlZ2F0ZSA9IGRlcml2ZWQociA9PiB7XG5cdFx0XHRpZiAoaW5saW5lQ2hhdDIucmVhZChyKSkge1xuXHRcdFx0XHRyZXR1cm4gSW5saW5lQ2hhdENvbnRyb2xsZXIyLmdldChlZGl0b3IpITtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBJbmxpbmVDaGF0Q29udHJvbGxlcjEuZ2V0KGVkaXRvcikhO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblxuXHR9XG5cblx0Z2V0IGlzQWN0aXZlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5nZXQoKS5pc0FjdGl2ZTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhcmc/OiBJbmxpbmVDaGF0UnVuT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5nZXQoKS5ydW4oYXJnKTtcblx0fVxuXG5cdGZvY3VzKCkge1xuXHRcdHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5nZXQoKS5mb2N1cygpO1xuXHR9XG5cblx0Z2V0IHdpZGdldCgpOiBFZGl0b3JCYXNlZElubGluZUNoYXRXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLl9kZWxlZ2F0ZS5nZXQoKS53aWRnZXQ7XG5cdH1cblxuXHRnZXRXaWRnZXRQb3NpdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVsZWdhdGUuZ2V0KCkuZ2V0V2lkZ2V0UG9zaXRpb24oKTtcblx0fVxuXG5cdGFjY2VwdFNlc3Npb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlbGVnYXRlLmdldCgpLmFjY2VwdFNlc3Npb24oKTtcblx0fVxufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKi9cbmV4cG9ydCBjbGFzcyBJbmxpbmVDaGF0Q29udHJvbGxlcjEgaW1wbGVtZW50cyBJRWRpdG9yQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgZ2V0KGVkaXRvcjogSUNvZGVFZGl0b3IpIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxJbmxpbmVDaGF0Q29udHJvbGxlcjE+KElOTElORV9DSEFUX0lEKTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlzcG9zZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdWk6IExhenk8SW5saW5lQ2hhdFpvbmVXaWRnZXQ+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFZpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhFZGl0aW5nOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4UmVzcG9uc2VUeXBlOiBJQ29udGV4dEtleTx1bmRlZmluZWQgfCBJbmxpbmVDaGF0UmVzcG9uc2VUeXBlPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4UmVxdWVzdEluUHJvZ3Jlc3M6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFJlc3BvbnNlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tZXNzYWdlcyA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRW1pdHRlcjxNZXNzYWdlPigpKTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZEVudGVyU3RhdGUgPSB0aGlzLl9zdG9yZS5hZGQobmV3IEVtaXR0ZXI8U3RhdGU+KCkpO1xuXG5cdGdldCBjaGF0V2lkZ2V0KCkge1xuXHRcdHJldHVybiB0aGlzLl91aS52YWx1ZS53aWRnZXQuY2hhdFdpZGdldDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Nlc3Npb25TdG9yZSA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFzaGVkU2Vzc2lvbiA9IHRoaXMuX3N0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGU8U3Rhc2hlZFNlc3Npb24+KCkpO1xuXHRwcml2YXRlIF9zZXNzaW9uPzogU2Vzc2lvbjtcblx0cHJpdmF0ZSBfc3RyYXRlZ3k/OiBMaXZlU3RyYXRlZ3k7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUNoYXRTZXNzaW9uU2VydmljZTogSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSxcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvclNlcnZpY2Ugbm90ZWJvb2tFZGl0b3JTZXJ2aWNlOiBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9jdHhWaXNpYmxlID0gQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhFZGl0aW5nID0gQ1RYX0lOTElORV9DSEFUX0VESVRJTkcuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhSZXNwb25zZVR5cGUgPSBDVFhfSU5MSU5FX0NIQVRfUkVTUE9OU0VfVFlQRS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2N0eFJlcXVlc3RJblByb2dyZXNzID0gQ1RYX0lOTElORV9DSEFUX1JFUVVFU1RfSU5fUFJPR1JFU1MuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2N0eFJlc3BvbnNlID0gQ2hhdENvbnRleHRLZXlzLmlzUmVzcG9uc2UuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VIYXNFcnJvci5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fdWkgPSBuZXcgTGF6eSgoKSA9PiB7XG5cblx0XHRcdGNvbnN0IGxvY2F0aW9uOiBJQ2hhdFdpZGdldExvY2F0aW9uT3B0aW9ucyA9IHtcblx0XHRcdFx0bG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLkVkaXRvcixcblx0XHRcdFx0cmVzb2x2ZURhdGE6ICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRUeXBlKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKTtcblx0XHRcdFx0XHRhc3NlcnRUeXBlKHRoaXMuX3Nlc3Npb24pO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKSxcblx0XHRcdFx0XHRcdGRvY3VtZW50OiB0aGlzLl9zZXNzaW9uLnRleHRNb2RlbE4udXJpLFxuXHRcdFx0XHRcdFx0d2hvbGVSYW5nZTogdGhpcy5fc2Vzc2lvbj8ud2hvbGVSYW5nZS50cmFja2VkSW5pdGlhbFJhbmdlLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdC8vIGlubGluZSBjaGF0IGluIG5vdGVib29rc1xuXHRcdFx0Ly8gY2hlY2sgaWYgdGhpcyBlZGl0b3IgaXMgcGFydCBvZiBhIG5vdGVib29rIGVkaXRvclxuXHRcdFx0Ly8gYW5kIGlmZiBzbywgdXNlIHRoZSBub3RlYm9vayBsb2NhdGlvbiBidXQga2VlcCB0aGUgcmVzb2x2ZURhdGFcblx0XHRcdC8vIHRhbGsgYWJvdXQgZWRpdG9yIGRhdGFcblx0XHRcdGZvciAoY29uc3Qgbm90ZWJvb2tFZGl0b3Igb2Ygbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmxpc3ROb3RlYm9va0VkaXRvcnMoKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFssIGNvZGVFZGl0b3JdIG9mIG5vdGVib29rRWRpdG9yLmNvZGVFZGl0b3JzKSB7XG5cdFx0XHRcdFx0aWYgKGNvZGVFZGl0b3IgPT09IHRoaXMuX2VkaXRvcikge1xuXHRcdFx0XHRcdFx0bG9jYXRpb24ubG9jYXRpb24gPSBDaGF0QWdlbnRMb2NhdGlvbi5Ob3RlYm9vaztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB6b25lID0gX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVDaGF0Wm9uZVdpZGdldCwgbG9jYXRpb24sIHVuZGVmaW5lZCwgdGhpcy5fZWRpdG9yKTtcblx0XHRcdHRoaXMuX3N0b3JlLmFkZCh6b25lKTtcblx0XHRcdHRoaXMuX3N0b3JlLmFkZCh6b25lLndpZGdldC5jaGF0V2lkZ2V0Lm9uRGlkQ2xlYXIoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByID0gdGhpcy5qb2luQ3VycmVudFJ1bigpO1xuXHRcdFx0XHR0aGlzLmNhbmNlbFNlc3Npb24oKTtcblx0XHRcdFx0YXdhaXQgcjtcblx0XHRcdFx0dGhpcy5ydW4oKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0cmV0dXJuIHpvbmU7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5fZWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWwoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fc2Vzc2lvbiB8fCAhZS5uZXdNb2RlbFVybCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGV4aXN0aW5nU2Vzc2lvbiA9IHRoaXMuX2lubGluZUNoYXRTZXNzaW9uU2VydmljZS5nZXRTZXNzaW9uKHRoaXMuX2VkaXRvciwgZS5uZXdNb2RlbFVybCk7XG5cdFx0XHRpZiAoIWV4aXN0aW5nU2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2xvZygnc2Vzc2lvbiBSRVNVTUlORyBhZnRlciBtb2RlbCBjaGFuZ2UnLCBlKTtcblx0XHRcdGF3YWl0IHRoaXMucnVuKHsgZXhpc3RpbmdTZXNzaW9uIH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZCh0aGlzLl9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2Uub25EaWRFbmRTZXNzaW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuc2Vzc2lvbiA9PT0gdGhpcy5fc2Vzc2lvbiAmJiBlLmVuZGVkQnlFeHRlcm5hbENhdXNlKSB7XG5cdFx0XHRcdHRoaXMuX2xvZygnc2Vzc2lvbiBFTkRFRCBieSBleHRlcm5hbCBjYXVzZScpO1xuXHRcdFx0XHR0aGlzLmFjY2VwdFNlc3Npb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5faW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLm9uRGlkTW92ZVNlc3Npb24oYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS5lZGl0b3IgPT09IHRoaXMuX2VkaXRvcikge1xuXHRcdFx0XHR0aGlzLl9sb2coJ3Nlc3Npb24gUkVTVU1JTkcgYWZ0ZXIgbW92ZScsIGUpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJ1bih7IGV4aXN0aW5nU2Vzc2lvbjogZS5zZXNzaW9uIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2xvZyhgTkVXIGNvbnRyb2xsZXJgKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRSdW4pIHtcblx0XHRcdHRoaXMuX21lc3NhZ2VzLmZpcmUodGhpcy5fc2Vzc2lvbj8uY2hhdE1vZGVsLmhhc1JlcXVlc3RzXG5cdFx0XHRcdD8gTWVzc2FnZS5QQVVTRV9TRVNTSU9OXG5cdFx0XHRcdDogTWVzc2FnZS5DQU5DRUxfU0VTU0lPTik7XG5cdFx0fVxuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLl9sb2coJ0RJU1BPU0VEIGNvbnRyb2xsZXInKTtcblx0fVxuXG5cdHByaXZhdGUgX2xvZyhtZXNzYWdlOiBzdHJpbmcgfCBFcnJvciwgLi4ubW9yZTogYW55W10pOiB2b2lkIHtcblx0XHRpZiAobWVzc2FnZSBpbnN0YW5jZW9mIEVycm9yKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKG1lc3NhZ2UsIC4uLm1vcmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBbSUVdIChlZGl0b3I6JHt0aGlzLl9lZGl0b3IuZ2V0SWQoKX0pICR7bWVzc2FnZX1gLCAuLi5tb3JlKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgd2lkZ2V0KCk6IEVkaXRvckJhc2VkSW5saW5lQ2hhdFdpZGdldCB7XG5cdFx0cmV0dXJuIHRoaXMuX3VpLnZhbHVlLndpZGdldDtcblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIElOTElORV9DSEFUX0lEO1xuXHR9XG5cblx0Z2V0V2lkZ2V0UG9zaXRpb24oKTogUG9zaXRpb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl91aS52YWx1ZS5wb3NpdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgX2N1cnJlbnRSdW4/OiBQcm9taXNlPHZvaWQ+O1xuXG5cdGFzeW5jIHJ1bihvcHRpb25zOiBJbmxpbmVDaGF0UnVuT3B0aW9ucyB8IHVuZGVmaW5lZCA9IHt9KTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHRsZXQgbGFzdFN0YXRlOiBTdGF0ZSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBkID0gdGhpcy5fb25EaWRFbnRlclN0YXRlLmV2ZW50KGUgPT4gbGFzdFN0YXRlID0gZSk7XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5hY2NlcHRTZXNzaW9uKCk7XG5cdFx0XHRpZiAodGhpcy5fY3VycmVudFJ1bikge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9jdXJyZW50UnVuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdGlvbnMuaW5pdGlhbFNlbGVjdGlvbikge1xuXHRcdFx0XHR0aGlzLl9lZGl0b3Iuc2V0U2VsZWN0aW9uKG9wdGlvbnMuaW5pdGlhbFNlbGVjdGlvbik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9zdGFzaGVkU2Vzc2lvbi5jbGVhcigpO1xuXHRcdFx0dGhpcy5fY3VycmVudFJ1biA9IHRoaXMuX25leHRTdGF0ZShTdGF0ZS5DUkVBVEVfU0VTU0lPTiwgb3B0aW9ucyk7XG5cdFx0XHRhd2FpdCB0aGlzLl9jdXJyZW50UnVuO1xuXG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIHRoaXMgc2hvdWxkIG5vdCBoYXBwZW4gYnV0IHdoZW4gaXQgZG9lcyBtYWtlIHN1cmUgdG8gdGVhciBkb3duIHRoZSBVSSBhbmQgZXZlcnl0aGluZ1xuXHRcdFx0dGhpcy5fbG9nKCdlcnJvciBkdXJpbmcgcnVuJywgZXJyb3IpO1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpO1xuXHRcdFx0aWYgKHRoaXMuX3Nlc3Npb24pIHtcblx0XHRcdFx0dGhpcy5faW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnJlbGVhc2VTZXNzaW9uKHRoaXMuX3Nlc3Npb24pO1xuXHRcdFx0fVxuXHRcdFx0dGhpc1tTdGF0ZS5QQVVTRV0oKTtcblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UnVuID0gdW5kZWZpbmVkO1xuXHRcdFx0ZC5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxhc3RTdGF0ZSAhPT0gU3RhdGUuQ0FOQ0VMO1xuXHR9XG5cblx0Ly8gLS0tLSBzdGF0ZSBtYWNoaW5lXG5cblx0cHJvdGVjdGVkIGFzeW5jIF9uZXh0U3RhdGUoc3RhdGU6IFN0YXRlLCBvcHRpb25zOiBJbmxpbmVDaGF0UnVuT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBuZXh0U3RhdGU6IFN0YXRlIHwgdm9pZCA9IHN0YXRlO1xuXHRcdHdoaWxlIChuZXh0U3RhdGUgJiYgIXRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHRoaXMuX2xvZygnc2V0U3RhdGUgdG8gJywgbmV4dFN0YXRlKTtcblx0XHRcdGNvbnN0IHA6IFN0YXRlIHwgUHJvbWlzZTxTdGF0ZT4gfCBQcm9taXNlPHZvaWQ+ID0gdGhpc1tuZXh0U3RhdGVdKG9wdGlvbnMpO1xuXHRcdFx0dGhpcy5fb25EaWRFbnRlclN0YXRlLmZpcmUobmV4dFN0YXRlKTtcblx0XHRcdG5leHRTdGF0ZSA9IGF3YWl0IHA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBbU3RhdGUuQ1JFQVRFX1NFU1NJT05dKG9wdGlvbnM6IElubGluZUNoYXRSdW5PcHRpb25zKTogUHJvbWlzZTxTdGF0ZS5DQU5DRUwgfCBTdGF0ZS5JTklUX1VJPiB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zZXNzaW9uID09PSB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpO1xuXG5cdFx0bGV0IHNlc3Npb246IFNlc3Npb24gfCB1bmRlZmluZWQgPSBvcHRpb25zLmV4aXN0aW5nU2Vzc2lvbjtcblxuXHRcdGxldCBpbml0UG9zaXRpb246IFBvc2l0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChvcHRpb25zLnBvc2l0aW9uKSB7XG5cdFx0XHRpbml0UG9zaXRpb24gPSBQb3NpdGlvbi5saWZ0KG9wdGlvbnMucG9zaXRpb24pLmRlbHRhKC0xKTtcblx0XHRcdGRlbGV0ZSBvcHRpb25zLnBvc2l0aW9uO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldFBvc2l0aW9uID0gdGhpcy5fc2hvd1dpZGdldChzZXNzaW9uPy5oZWFkbGVzcywgdHJ1ZSwgaW5pdFBvc2l0aW9uKTtcblxuXHRcdC8vIHRoaXMuX3VwZGF0ZVBsYWNlaG9sZGVyKCk7XG5cdFx0bGV0IGVycm9yTWVzc2FnZSA9IGxvY2FsaXplKCdjcmVhdGUuZmFpbCcsIFwiRmFpbGVkIHRvIHN0YXJ0IGVkaXRvciBjaGF0XCIpO1xuXG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRjb25zdCBjcmVhdGVTZXNzaW9uQ3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRjb25zdCBtc2dMaXN0ZW5lciA9IEV2ZW50Lm9uY2UodGhpcy5fbWVzc2FnZXMuZXZlbnQpKG0gPT4ge1xuXHRcdFx0XHR0aGlzLl9sb2coJ3N0YXRlPV9jcmVhdGVTZXNzaW9uKSBtZXNzYWdlIHJlY2VpdmVkJywgbSk7XG5cdFx0XHRcdGlmIChtID09PSBNZXNzYWdlLkFDQ0VQVF9JTlBVVCkge1xuXHRcdFx0XHRcdC8vIHVzZXIgYWNjZXB0ZWQgdGhlIGlucHV0IGJlZm9yZSBoYXZpbmcgYSBzZXNzaW9uXG5cdFx0XHRcdFx0b3B0aW9ucy5hdXRvU2VuZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5fdWkudmFsdWUud2lkZ2V0LnVwZGF0ZUluZm8obG9jYWxpemUoJ3dlbGNvbWUuMicsIFwiR2V0dGluZyByZWFkeS4uLlwiKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y3JlYXRlU2Vzc2lvbkN0cy5jYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHNlc3Npb24gPSBhd2FpdCB0aGlzLl9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihcblx0XHRcdFx0XHR0aGlzLl9lZGl0b3IsXG5cdFx0XHRcdFx0eyB3aG9sZVJhbmdlOiBvcHRpb25zLmluaXRpYWxSYW5nZSB9LFxuXHRcdFx0XHRcdGNyZWF0ZVNlc3Npb25DdHMudG9rZW5cblx0XHRcdFx0KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIElubGluZSBjaGF0IGVycm9ycyBhcmUgZnJvbSB0aGUgcHJvdmlkZXIgYW5kIGhhdmUgdGhlaXIgZXJyb3IgbWVzc2FnZXMgc2hvd24gdG8gdGhlIHVzZXJcblx0XHRcdFx0aWYgKGVycm9yIGluc3RhbmNlb2YgSW5saW5lQ2hhdEVycm9yIHx8IGVycm9yPy5uYW1lID09PSBJbmxpbmVDaGF0RXJyb3IuY29kZSkge1xuXHRcdFx0XHRcdGVycm9yTWVzc2FnZSA9IGVycm9yLm1lc3NhZ2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y3JlYXRlU2Vzc2lvbkN0cy5kaXNwb3NlKCk7XG5cdFx0XHRtc2dMaXN0ZW5lci5kaXNwb3NlKCk7XG5cblx0XHRcdGlmIChjcmVhdGVTZXNzaW9uQ3RzLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5faW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnJlbGVhc2VTZXNzaW9uKHNlc3Npb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBTdGF0ZS5DQU5DRUw7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZGVsZXRlIG9wdGlvbnMuaW5pdGlhbFJhbmdlO1xuXHRcdGRlbGV0ZSBvcHRpb25zLmV4aXN0aW5nU2Vzc2lvbjtcblxuXHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0TWVzc2FnZUNvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik/LnNob3dNZXNzYWdlKGVycm9yTWVzc2FnZSwgd2lkZ2V0UG9zaXRpb24pO1xuXHRcdFx0dGhpcy5fbG9nKCdGYWlsZWQgdG8gc3RhcnQgZWRpdG9yIGNoYXQnKTtcblx0XHRcdHJldHVybiBTdGF0ZS5DQU5DRUw7XG5cdFx0fVxuXG5cdFx0YXdhaXQgc2Vzc2lvbi5jaGF0TW9kZWwud2FpdEZvckluaXRpYWxpemF0aW9uKCk7XG5cblx0XHQvLyBjcmVhdGUgYSBuZXcgc3RyYXRlZ3lcblx0XHR0aGlzLl9zdHJhdGVneSA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaXZlU3RyYXRlZ3ksIHNlc3Npb24sIHRoaXMuX2VkaXRvciwgdGhpcy5fdWkudmFsdWUsIHNlc3Npb24uaGVhZGxlc3MpO1xuXG5cdFx0dGhpcy5fc2Vzc2lvbiA9IHNlc3Npb247XG5cdFx0cmV0dXJuIFN0YXRlLklOSVRfVUk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIFtTdGF0ZS5JTklUX1VJXShvcHRpb25zOiBJbmxpbmVDaGF0UnVuT3B0aW9ucyk6IFByb21pc2U8U3RhdGUuV0FJVF9GT1JfSU5QVVQgfCBTdGF0ZS5TSE9XX1JFUVVFU1Q+IHtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX3Nlc3Npb24pO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fc3RyYXRlZ3kpO1xuXG5cdFx0Ly8gaGlkZS9jYW5jZWwgaW5saW5lIGNvbXBsZXRpb25zIHdoZW4gaW52b2tpbmcgSUVcblx0XHRJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0KHRoaXMuX2VkaXRvcik/LnJlamVjdCgpO1xuXG5cdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmNsZWFyKCk7XG5cblx0XHRjb25zdCB3aG9sZVJhbmdlRGVjb3JhdGlvbiA9IHRoaXMuX2VkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHRjb25zdCBoYW5kbGVXaG9sZVJhbmdlQ2hhbmdlID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3RGVjb3JhdGlvbnMgPSB0aGlzLl9zdHJhdGVneT8uZ2V0V2hvbGVSYW5nZURlY29yYXRpb24oKSA/PyBbXTtcblx0XHRcdHdob2xlUmFuZ2VEZWNvcmF0aW9uLnNldChuZXdEZWNvcmF0aW9ucyk7XG5cblx0XHRcdHRoaXMuX2N0eEVkaXRpbmcuc2V0KCF0aGlzLl9zZXNzaW9uPy53aG9sZVJhbmdlLnRyYWNrZWRJbml0aWFsUmFuZ2UuaXNFbXB0eSgpKTtcblx0XHR9O1xuXHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHdob2xlUmFuZ2VEZWNvcmF0aW9uLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9jdHhFZGl0aW5nLnJlc2V0KCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5hZGQodGhpcy5fc2Vzc2lvbi53aG9sZVJhbmdlLm9uRGlkQ2hhbmdlKGhhbmRsZVdob2xlUmFuZ2VDaGFuZ2UpKTtcblx0XHRoYW5kbGVXaG9sZVJhbmdlQ2hhbmdlKCk7XG5cblx0XHR0aGlzLl91aS52YWx1ZS53aWRnZXQuc2V0Q2hhdE1vZGVsKHRoaXMuX3Nlc3Npb24uY2hhdE1vZGVsKTtcblx0XHR0aGlzLl91cGRhdGVQbGFjZWhvbGRlcigpO1xuXG5cdFx0Y29uc3QgaXNNb2RlbEVtcHR5ID0gIXRoaXMuX3Nlc3Npb24uY2hhdE1vZGVsLmhhc1JlcXVlc3RzO1xuXHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC51cGRhdGVUb29sYmFyKHRydWUpO1xuXHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC50b2dnbGVTdGF0dXMoIWlzTW9kZWxFbXB0eSk7XG5cdFx0dGhpcy5fc2hvd1dpZGdldCh0aGlzLl9zZXNzaW9uLmhlYWRsZXNzLCBpc01vZGVsRW1wdHkpO1xuXG5cdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoZSkgPT4ge1xuXHRcdFx0Y29uc3QgbXNnID0gdGhpcy5fc2Vzc2lvbj8uY2hhdE1vZGVsLmhhc1JlcXVlc3RzXG5cdFx0XHRcdD8gTWVzc2FnZS5QQVVTRV9TRVNTSU9OIC8vIHBhdXNlIHdoZW4gc3dpdGNoaW5nIG1vZGVscy90YWJzIGFuZCB3aGVuIGhhdmluZyBhIHByZXZpb3VzIGV4Y2hhbmdlXG5cdFx0XHRcdDogTWVzc2FnZS5DQU5DRUxfU0VTU0lPTjtcblx0XHRcdHRoaXMuX2xvZygnbW9kZWwgY2hhbmdlZCwgcGF1c2Ugb3IgY2FuY2VsIHNlc3Npb24nLCBtc2csIGUpO1xuXHRcdFx0dGhpcy5fbWVzc2FnZXMuZmlyZShtc2cpO1xuXHRcdH0pKTtcblxuXG5cdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoZSA9PiB7XG5cblxuXHRcdFx0aWYgKHRoaXMuX3Nlc3Npb24/Lmh1bmtEYXRhLmlnbm9yZVRleHRNb2RlbE5DaGFuZ2VzIHx8IHRoaXMuX3VpLnZhbHVlLndpZGdldC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2hvbGVSYW5nZSA9IHRoaXMuX3Nlc3Npb24hLndob2xlUmFuZ2U7XG5cdFx0XHRsZXQgc2hvdWxkRmluaXNoU2Vzc2lvbiA9IGZhbHNlO1xuXHRcdFx0aWYgKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KElubGluZUNoYXRDb25maWdLZXlzLkZpbmlzaE9uVHlwZSkpIHtcblx0XHRcdFx0Zm9yIChjb25zdCB7IHJhbmdlIH0gb2YgZS5jaGFuZ2VzKSB7XG5cdFx0XHRcdFx0c2hvdWxkRmluaXNoU2Vzc2lvbiA9ICFSYW5nZS5hcmVJbnRlcnNlY3RpbmdPclRvdWNoaW5nKHJhbmdlLCB3aG9sZVJhbmdlLnZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zZXNzaW9uIS5yZWNvcmRFeHRlcm5hbEVkaXRPY2N1cnJlZChzaG91bGRGaW5pc2hTZXNzaW9uKTtcblxuXHRcdFx0aWYgKHNob3VsZEZpbmlzaFNlc3Npb24pIHtcblx0XHRcdFx0dGhpcy5fbG9nKCd0ZXh0IGNoYW5nZWQgb3V0c2lkZSBvZiB3aG9sZSByYW5nZSwgRklOSVNIIHNlc3Npb24nKTtcblx0XHRcdFx0dGhpcy5hY2NlcHRTZXNzaW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmFkZCh0aGlzLl9zZXNzaW9uLmNoYXRNb2RlbC5vbkRpZENoYW5nZShhc3luYyBlID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09ICdyZW1vdmVSZXF1ZXN0Jykge1xuXHRcdFx0XHQvLyBUT0RPQGpyaWVrZW4gdGhlcmUgaXMgc3RpbGwgc29tZSB3b3JrIGxlZnQgZm9yIHdoZW4gYSByZXF1ZXN0IFwiaW4gdGhlIG1pZGRsZVwiXG5cdFx0XHRcdC8vIGlzIHJlbW92ZWQuIFdlIHdpbGwgdW5kbyBhbGwgY2hhbmdlcyB0aWxsIHRoYXQgcG9pbnQgYnV0IG5vdCByZW1vdmUgdGhvc2Vcblx0XHRcdFx0Ly8gbGF0ZXIgcmVxdWVzdFxuXHRcdFx0XHRhd2FpdCB0aGlzLl9zZXNzaW9uIS51bmRvQ2hhbmdlc1VudGlsKGUucmVxdWVzdElkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBhcHBseSBlZGl0cyBmcm9tIGNvbXBsZXRlZCByZXF1ZXN0cyB0aGF0IGhhdmVuJ3QgYmVlbiBhcHBsaWVkIHlldFxuXHRcdGNvbnN0IGVkaXRTdGF0ZSA9IHRoaXMuX2NyZWF0ZUNoYXRUZXh0RWRpdEdyb3VwU3RhdGUoKTtcblx0XHRsZXQgZGlkRWRpdCA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiB0aGlzLl9zZXNzaW9uLmNoYXRNb2RlbC5nZXRSZXF1ZXN0cygpKSB7XG5cdFx0XHRpZiAoIXJlcXVlc3QucmVzcG9uc2UgfHwgcmVxdWVzdC5yZXNwb25zZS5yZXN1bHQ/LmVycm9yRGV0YWlscykge1xuXHRcdFx0XHQvLyBkb25lIHdoZW4gc2VlaW5nIHRoZSBmaXJzdCByZXF1ZXN0IHRoYXQgaXMgc3RpbGwgcGVuZGluZyAobm8gcmVzcG9uc2UpLlxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgcGFydCBvZiByZXF1ZXN0LnJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlKSB7XG5cdFx0XHRcdGlmIChwYXJ0LmtpbmQgIT09ICd0ZXh0RWRpdEdyb3VwJyB8fCAhaXNFcXVhbChwYXJ0LnVyaSwgdGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWxOLnVyaSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocGFydC5zdGF0ZT8uYXBwbGllZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgZWRpdCBvZiBwYXJ0LmVkaXRzKSB7XG5cdFx0XHRcdFx0dGhpcy5fbWFrZUNoYW5nZXMoZWRpdCwgdW5kZWZpbmVkLCAhZGlkRWRpdCk7XG5cdFx0XHRcdFx0ZGlkRWRpdCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGFydC5zdGF0ZSA/Pz0gZWRpdFN0YXRlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoZGlkRWRpdCkge1xuXHRcdFx0Y29uc3QgZGlmZiA9IGF3YWl0IHRoaXMuX2VkaXRvcldvcmtlclNlcnZpY2UuY29tcHV0ZURpZmYodGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWwwLnVyaSwgdGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWxOLnVyaSwgeyBjb21wdXRlTW92ZXM6IGZhbHNlLCBtYXhDb21wdXRhdGlvblRpbWVNczogTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIGlnbm9yZVRyaW1XaGl0ZXNwYWNlOiBmYWxzZSB9LCAnYWR2YW5jZWQnKTtcblx0XHRcdHRoaXMuX3Nlc3Npb24ud2hvbGVSYW5nZS5maXh1cChkaWZmPy5jaGFuZ2VzID8/IFtdKTtcblx0XHRcdGF3YWl0IHRoaXMuX3Nlc3Npb24uaHVua0RhdGEucmVjb21wdXRlKGVkaXRTdGF0ZSwgZGlmZik7XG5cblx0XHRcdHRoaXMuX3VwZGF0ZUN0eFJlc3BvbnNlVHlwZSgpO1xuXHRcdH1cblx0XHRvcHRpb25zLnBvc2l0aW9uID0gYXdhaXQgdGhpcy5fc3RyYXRlZ3kucmVuZGVyQ2hhbmdlcygpO1xuXG5cdFx0aWYgKHRoaXMuX3Nlc3Npb24uY2hhdE1vZGVsLnJlcXVlc3RJblByb2dyZXNzKSB7XG5cdFx0XHRyZXR1cm4gU3RhdGUuU0hPV19SRVFVRVNUO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gU3RhdGUuV0FJVF9GT1JfSU5QVVQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBbU3RhdGUuV0FJVF9GT1JfSU5QVVRdKG9wdGlvbnM6IElubGluZUNoYXRSdW5PcHRpb25zKTogUHJvbWlzZTxTdGF0ZS5BQ0NFUFQgfCBTdGF0ZS5DQU5DRUwgfCBTdGF0ZS5QQVVTRSB8IFN0YXRlLldBSVRfRk9SX0lOUFVUIHwgU3RhdGUuU0hPV19SRVFVRVNUPiB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zZXNzaW9uKTtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX3N0cmF0ZWd5KTtcblxuXHRcdHRoaXMuX3VwZGF0ZVBsYWNlaG9sZGVyKCk7XG5cblx0XHRpZiAob3B0aW9ucy5tZXNzYWdlKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVJbnB1dChvcHRpb25zLm1lc3NhZ2UpO1xuXHRcdFx0YXJpYS5hbGVydChvcHRpb25zLm1lc3NhZ2UpO1xuXHRcdFx0ZGVsZXRlIG9wdGlvbnMubWVzc2FnZTtcblx0XHRcdHRoaXMuX3Nob3dXaWRnZXQodGhpcy5fc2Vzc2lvbi5oZWFkbGVzcywgZmFsc2UpO1xuXHRcdH1cblxuXHRcdGxldCBtZXNzYWdlID0gTWVzc2FnZS5OT05FO1xuXHRcdGxldCByZXF1ZXN0OiBJQ2hhdFJlcXVlc3RNb2RlbCB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGJhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN0b3JlLmFkZCh0aGlzLl9zZXNzaW9uLmNoYXRNb2RlbC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09ICdhZGRSZXF1ZXN0Jykge1xuXHRcdFx0XHRyZXF1ZXN0ID0gZS5yZXF1ZXN0O1xuXHRcdFx0XHRtZXNzYWdlID0gTWVzc2FnZS5BQ0NFUFRfSU5QVVQ7XG5cdFx0XHRcdGJhcnJpZXIub3BlbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQodGhpcy5fc3RyYXRlZ3kub25EaWRBY2NlcHQoKCkgPT4gdGhpcy5hY2NlcHRTZXNzaW9uKCkpKTtcblx0XHRzdG9yZS5hZGQodGhpcy5fc3RyYXRlZ3kub25EaWREaXNjYXJkKCgpID0+IHRoaXMuY2FuY2VsU2Vzc2lvbigpKSk7XG5cdFx0c3RvcmUuYWRkKEV2ZW50Lm9uY2UodGhpcy5fbWVzc2FnZXMuZXZlbnQpKG0gPT4ge1xuXHRcdFx0dGhpcy5fbG9nKCdzdGF0ZT1fd2FpdEZvcklucHV0KSBtZXNzYWdlIHJlY2VpdmVkJywgbSk7XG5cdFx0XHRtZXNzYWdlID0gbTtcblx0XHRcdGJhcnJpZXIub3BlbigpO1xuXHRcdH0pKTtcblxuXHRcdGlmIChvcHRpb25zLmF1dG9TZW5kKSB7XG5cdFx0XHRkZWxldGUgb3B0aW9ucy5hdXRvU2VuZDtcblx0XHRcdHRoaXMuX3Nob3dXaWRnZXQodGhpcy5fc2Vzc2lvbi5oZWFkbGVzcywgZmFsc2UpO1xuXHRcdFx0dGhpcy5fdWkudmFsdWUud2lkZ2V0LmNoYXRXaWRnZXQuYWNjZXB0SW5wdXQoKTtcblx0XHR9XG5cblx0XHRhd2FpdCBiYXJyaWVyLndhaXQoKTtcblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cblxuXHRcdGlmIChtZXNzYWdlICYgKE1lc3NhZ2UuQ0FOQ0VMX0lOUFVUIHwgTWVzc2FnZS5DQU5DRUxfU0VTU0lPTikpIHtcblx0XHRcdHJldHVybiBTdGF0ZS5DQU5DRUw7XG5cdFx0fVxuXG5cdFx0aWYgKG1lc3NhZ2UgJiBNZXNzYWdlLlBBVVNFX1NFU1NJT04pIHtcblx0XHRcdHJldHVybiBTdGF0ZS5QQVVTRTtcblx0XHR9XG5cblx0XHRpZiAobWVzc2FnZSAmIE1lc3NhZ2UuQUNDRVBUX1NFU1NJT04pIHtcblx0XHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC5zZWxlY3RBbGwoKTtcblx0XHRcdHJldHVybiBTdGF0ZS5BQ0NFUFQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXF1ZXN0Py5tZXNzYWdlLnRleHQpIHtcblx0XHRcdHJldHVybiBTdGF0ZS5XQUlUX0ZPUl9JTlBVVDtcblx0XHR9XG5cblxuXHRcdHJldHVybiBTdGF0ZS5TSE9XX1JFUVVFU1Q7XG5cdH1cblxuXG5cdHByaXZhdGUgYXN5bmMgW1N0YXRlLlNIT1dfUkVRVUVTVF0ob3B0aW9uczogSW5saW5lQ2hhdFJ1bk9wdGlvbnMpOiBQcm9taXNlPFN0YXRlLldBSVRfRk9SX0lOUFVUIHwgU3RhdGUuQ0FOQ0VMIHwgU3RhdGUuUEFVU0UgfCBTdGF0ZS5BQ0NFUFQ+IHtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX3Nlc3Npb24pO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fc3RyYXRlZ3kpO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fc2Vzc2lvbi5jaGF0TW9kZWwucmVxdWVzdEluUHJvZ3Jlc3MpO1xuXG5cdFx0dGhpcy5fY3R4UmVxdWVzdEluUHJvZ3Jlc3Muc2V0KHRydWUpO1xuXG5cdFx0Y29uc3QgeyBjaGF0TW9kZWwgfSA9IHRoaXMuX3Nlc3Npb247XG5cdFx0Y29uc3QgcmVxdWVzdCA9IGNoYXRNb2RlbC5sYXN0UmVxdWVzdDtcblxuXHRcdGFzc2VydFR5cGUocmVxdWVzdCk7XG5cdFx0YXNzZXJ0VHlwZShyZXF1ZXN0LnJlc3BvbnNlKTtcblxuXHRcdHRoaXMuX3Nob3dXaWRnZXQodGhpcy5fc2Vzc2lvbi5oZWFkbGVzcywgZmFsc2UpO1xuXHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC5zZWxlY3RBbGwoKTtcblx0XHR0aGlzLl91aS52YWx1ZS53aWRnZXQudXBkYXRlSW5mbygnJyk7XG5cdFx0dGhpcy5fdWkudmFsdWUud2lkZ2V0LnRvZ2dsZVN0YXR1cyh0cnVlKTtcblxuXHRcdGNvbnN0IHsgcmVzcG9uc2UgfSA9IHJlcXVlc3Q7XG5cdFx0Y29uc3QgcmVzcG9uc2VQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBwcm9ncmVzc2l2ZUVkaXRzQ3RzID0gc3RvcmUuYWRkKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpKTtcblx0XHRjb25zdCBwcm9ncmVzc2l2ZUVkaXRzQXZnRHVyYXRpb24gPSBuZXcgTW92aW5nQXZlcmFnZSgpO1xuXHRcdGNvbnN0IHByb2dyZXNzaXZlRWRpdHNDbG9jayA9IFN0b3BXYXRjaC5jcmVhdGUoKTtcblx0XHRjb25zdCBwcm9ncmVzc2l2ZUVkaXRzUXVldWUgPSBuZXcgUXVldWUoKTtcblxuXHRcdC8vIGRpc2FibGUgdHlwaW5nIGFuZCBzcXVpZ2dsZXMgd2hpbGUgc3RyZWFtaW5nIGEgcmVwbHlcblx0XHRjb25zdCBvcmlnRGVjbyA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnJlbmRlclZhbGlkYXRpb25EZWNvcmF0aW9ucyk7XG5cdFx0dGhpcy5fZWRpdG9yLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0cmVuZGVyVmFsaWRhdGlvbkRlY29yYXRpb25zOiAnb2ZmJ1xuXHRcdH0pO1xuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZWRpdG9yLnVwZGF0ZU9wdGlvbnMoe1xuXHRcdFx0XHRyZW5kZXJWYWxpZGF0aW9uRGVjb3JhdGlvbnM6IG9yaWdEZWNvXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblxuXHRcdGxldCBuZXh0OiBTdGF0ZS5XQUlUX0ZPUl9JTlBVVCB8IFN0YXRlLlNIT1dfUkVRVUVTVCB8IFN0YXRlLkNBTkNFTCB8IFN0YXRlLlBBVVNFIHwgU3RhdGUuQUNDRVBUID0gU3RhdGUuV0FJVF9GT1JfSU5QVVQ7XG5cdFx0c3RvcmUuYWRkKEV2ZW50Lm9uY2UodGhpcy5fbWVzc2FnZXMuZXZlbnQpKG1lc3NhZ2UgPT4ge1xuXHRcdFx0dGhpcy5fbG9nKCdzdGF0ZT1fbWFrZVJlcXVlc3QpIG1lc3NhZ2UgcmVjZWl2ZWQnLCBtZXNzYWdlKTtcblx0XHRcdHRoaXMuX2NoYXRTZXJ2aWNlLmNhbmNlbEN1cnJlbnRSZXF1ZXN0Rm9yU2Vzc2lvbihjaGF0TW9kZWwuc2Vzc2lvbklkKTtcblx0XHRcdGlmIChtZXNzYWdlICYgTWVzc2FnZS5DQU5DRUxfU0VTU0lPTikge1xuXHRcdFx0XHRuZXh0ID0gU3RhdGUuQ0FOQ0VMO1xuXHRcdFx0fSBlbHNlIGlmIChtZXNzYWdlICYgTWVzc2FnZS5QQVVTRV9TRVNTSU9OKSB7XG5cdFx0XHRcdG5leHQgPSBTdGF0ZS5QQVVTRTtcblx0XHRcdH0gZWxzZSBpZiAobWVzc2FnZSAmIE1lc3NhZ2UuQUNDRVBUX1NFU1NJT04pIHtcblx0XHRcdFx0bmV4dCA9IFN0YXRlLkFDQ0VQVDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRzdG9yZS5hZGQoY2hhdE1vZGVsLm9uRGlkQ2hhbmdlKGFzeW5jIGUgPT4ge1xuXHRcdFx0aWYgKGUua2luZCA9PT0gJ3JlbW92ZVJlcXVlc3QnICYmIGUucmVxdWVzdElkID09PSByZXF1ZXN0LmlkKSB7XG5cdFx0XHRcdHByb2dyZXNzaXZlRWRpdHNDdHMuY2FuY2VsKCk7XG5cdFx0XHRcdHJlc3BvbnNlUHJvbWlzZS5jb21wbGV0ZSgpO1xuXHRcdFx0XHRpZiAoZS5yZWFzb24gPT09IENoYXRSZXF1ZXN0UmVtb3ZhbFJlYXNvbi5SZXNlbmQpIHtcblx0XHRcdFx0XHRuZXh0ID0gU3RhdGUuU0hPV19SRVFVRVNUO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG5leHQgPSBTdGF0ZS5DQU5DRUw7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUua2luZCA9PT0gJ21vdmUnKSB7XG5cdFx0XHRcdGFzc2VydFR5cGUodGhpcy5fc2Vzc2lvbik7XG5cdFx0XHRcdGNvbnN0IGxvZzogdHlwZW9mIHRoaXMuX2xvZyA9IChtc2c6IHN0cmluZywgLi4uYXJnczogYW55W10pID0+IHRoaXMuX2xvZygnc3RhdGU9X3Nob3dSZXF1ZXN0KSBtb3ZpbmcgaW5saW5lIGNoYXQnLCBtc2csIC4uLmFyZ3MpO1xuXG5cdFx0XHRcdGxvZygnbW92ZSB3YXMgcmVxdWVzdGVkJywgZS50YXJnZXQsIGUucmFuZ2UpO1xuXG5cdFx0XHRcdC8vIGlmIHRoZXJlJ3MgYWxyZWFkeSBhIHRhYiBvcGVuIGZvciB0YXJnZXRVcmksIHNob3cgaXQgYW5kIG1vdmUgaW5saW5lIGNoYXQgdG8gdGhhdCB0YWJcblx0XHRcdFx0Ly8gb3RoZXJ3aXNlLCBvcGVuIHRoZSB0YWIgdG8gdGhlIHNpZGVcblx0XHRcdFx0Y29uc3QgaW5pdGlhbFNlbGVjdGlvbiA9IFNlbGVjdGlvbi5mcm9tUmFuZ2UoUmFuZ2UubGlmdChlLnJhbmdlKSwgU2VsZWN0aW9uRGlyZWN0aW9uLkxUUik7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogZS50YXJnZXQsIG9wdGlvbnM6IHsgc2VsZWN0aW9uOiBpbml0aWFsU2VsZWN0aW9uIH0gfSwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0aWYgKCFlZGl0b3JQYW5lKSB7XG5cdFx0XHRcdFx0bG9nKCdvcGVuaW5nIGVkaXRvciBmYWlsZWQnKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBuZXdFZGl0b3IgPSBlZGl0b3JQYW5lLmdldENvbnRyb2woKTtcblx0XHRcdFx0aWYgKCFpc0NvZGVFZGl0b3IobmV3RWRpdG9yKSB8fCAhbmV3RWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHRsb2coJ25ldyBlZGl0b3IgaXMgZWl0aGVyIG1pc3Npbmcgb3Igbm90IGEgY29kZSBlZGl0b3Igb3IgZG9lcyBub3QgaGF2ZSBhIG1vZGVsJyk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX2lubGluZUNoYXRTZXNzaW9uU2VydmljZS5nZXRTZXNzaW9uKG5ld0VkaXRvciwgZS50YXJnZXQpKSB7XG5cdFx0XHRcdFx0bG9nKCduZXcgZWRpdG9yIEFMUkVBRFkgaGFzIGEgc2Vzc2lvbicpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5ld1Nlc3Npb24gPSBhd2FpdCB0aGlzLl9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihcblx0XHRcdFx0XHRuZXdFZGl0b3IsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2Vzc2lvbjogdGhpcy5fc2Vzc2lvbixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdENhbmNlbGxhdGlvblRva2VuLk5vbmUpOyAvLyBUT0RPQHVsdWdiZWtuYTogYWRkIHByb3BlciBjYW5jZWxsYXRpb24/XG5cblxuXHRcdFx0XHRJbmxpbmVDaGF0Q29udHJvbGxlcjEuZ2V0KG5ld0VkaXRvcik/LnJ1bih7IGV4aXN0aW5nU2Vzc2lvbjogbmV3U2Vzc2lvbiB9KTtcblxuXHRcdFx0XHRuZXh0ID0gU3RhdGUuQ0FOQ0VMO1xuXHRcdFx0XHRyZXNwb25zZVByb21pc2UuY29tcGxldGUoKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gY2FuY2VsIHRoZSByZXF1ZXN0IHdoZW4gdGhlIHVzZXIgdHlwZXNcblx0XHRzdG9yZS5hZGQodGhpcy5fdWkudmFsdWUud2lkZ2V0LmNoYXRXaWRnZXQuaW5wdXRFZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY2hhdFNlcnZpY2UuY2FuY2VsQ3VycmVudFJlcXVlc3RGb3JTZXNzaW9uKGNoYXRNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdH0pKTtcblxuXHRcdGxldCBsYXN0TGVuZ3RoID0gMDtcblx0XHRsZXQgaXNGaXJzdENoYW5nZSA9IHRydWU7XG5cblx0XHRjb25zdCBlZGl0U3RhdGUgPSB0aGlzLl9jcmVhdGVDaGF0VGV4dEVkaXRHcm91cFN0YXRlKCk7XG5cdFx0bGV0IGxvY2FsRWRpdEdyb3VwOiBJQ2hhdFRleHRFZGl0R3JvdXAgfCB1bmRlZmluZWQ7XG5cblx0XHQvLyBhcHBseSBlZGl0c1xuXHRcdGNvbnN0IGhhbmRsZVJlc3BvbnNlID0gKCkgPT4ge1xuXG5cdFx0XHR0aGlzLl91cGRhdGVDdHhSZXNwb25zZVR5cGUoKTtcblxuXHRcdFx0aWYgKCFsb2NhbEVkaXRHcm91cCkge1xuXHRcdFx0XHRsb2NhbEVkaXRHcm91cCA9IDxJQ2hhdFRleHRFZGl0R3JvdXAgfCB1bmRlZmluZWQ+cmVzcG9uc2UucmVzcG9uc2UudmFsdWUuZmluZChwYXJ0ID0+IHBhcnQua2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnICYmIGlzRXF1YWwocGFydC51cmksIHRoaXMuX3Nlc3Npb24/LnRleHRNb2RlbE4udXJpKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChsb2NhbEVkaXRHcm91cCkge1xuXG5cdFx0XHRcdGxvY2FsRWRpdEdyb3VwLnN0YXRlID8/PSBlZGl0U3RhdGU7XG5cblx0XHRcdFx0Y29uc3QgZWRpdHMgPSBsb2NhbEVkaXRHcm91cC5lZGl0cztcblx0XHRcdFx0Y29uc3QgbmV3RWRpdHMgPSBlZGl0cy5zbGljZShsYXN0TGVuZ3RoKTtcblx0XHRcdFx0aWYgKG5ld0VkaXRzLmxlbmd0aCA+IDApIHtcblxuXHRcdFx0XHRcdHRoaXMuX2xvZyhgJHt0aGlzLl9zZXNzaW9uPy50ZXh0TW9kZWxOLnVyaS50b1N0cmluZygpfSByZWNlaXZlZCAke25ld0VkaXRzLmxlbmd0aH0gZWRpdHNgKTtcblxuXHRcdFx0XHRcdC8vIE5FVyBjaGFuZ2VzXG5cdFx0XHRcdFx0bGFzdExlbmd0aCA9IGVkaXRzLmxlbmd0aDtcblx0XHRcdFx0XHRwcm9ncmVzc2l2ZUVkaXRzQXZnRHVyYXRpb24udXBkYXRlKHByb2dyZXNzaXZlRWRpdHNDbG9jay5lbGFwc2VkKCkpO1xuXHRcdFx0XHRcdHByb2dyZXNzaXZlRWRpdHNDbG9jay5yZXNldCgpO1xuXG5cdFx0XHRcdFx0cHJvZ3Jlc3NpdmVFZGl0c1F1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblxuXHRcdFx0XHRcdFx0Y29uc3Qgc3RhcnRUaGVuID0gdGhpcy5fc2Vzc2lvbiEud2hvbGVSYW5nZS52YWx1ZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cblx0XHRcdFx0XHRcdC8vIG1ha2luZyBjaGFuZ2VzIGdvZXMgaW50byBhIHF1ZXVlIGJlY2F1c2Ugb3RoZXJ3aXNlIHRoZSBhc3luYy1wcm9ncmVzcyB0aW1lIHdpbGxcblx0XHRcdFx0XHRcdC8vIGluZmx1ZW5jZSB0aGUgdGltZSBpdCB0YWtlcyB0byByZWNlaXZlIHRoZSBjaGFuZ2VzIGFuZCBwcm9ncmVzc2l2ZSB0eXBpbmcgd2lsbFxuXHRcdFx0XHRcdFx0Ly8gYmVjb21lIGluZmluaXRlbHkgZmFzdFxuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBlZGl0cyBvZiBuZXdFZGl0cykge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLl9tYWtlQ2hhbmdlcyhlZGl0cywge1xuXHRcdFx0XHRcdFx0XHRcdGR1cmF0aW9uOiBwcm9ncmVzc2l2ZUVkaXRzQXZnRHVyYXRpb24udmFsdWUsXG5cdFx0XHRcdFx0XHRcdFx0dG9rZW46IHByb2dyZXNzaXZlRWRpdHNDdHMudG9rZW5cblx0XHRcdFx0XHRcdFx0fSwgaXNGaXJzdENoYW5nZSk7XG5cblx0XHRcdFx0XHRcdFx0aXNGaXJzdENoYW5nZSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyByZXNob3cgdGhlIHdpZGdldCBpZiB0aGUgc3RhcnQgcG9zaXRpb24gY2hhbmdlZCBvciBzaG93cyBhdCB0aGUgd3JvbmcgcG9zaXRpb25cblx0XHRcdFx0XHRcdGNvbnN0IHN0YXJ0Tm93ID0gdGhpcy5fc2Vzc2lvbiEud2hvbGVSYW5nZS52YWx1ZS5nZXRTdGFydFBvc2l0aW9uKCk7XG5cdFx0XHRcdFx0XHRpZiAoIXN0YXJ0Tm93LmVxdWFscyhzdGFydFRoZW4pIHx8ICF0aGlzLl91aS52YWx1ZS5wb3NpdGlvbj8uZXF1YWxzKHN0YXJ0Tm93KSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9zaG93V2lkZ2V0KHRoaXMuX3Nlc3Npb24hLmhlYWRsZXNzLCBmYWxzZSwgc3RhcnROb3cuZGVsdGEoLTEpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVzcG9uc2UuaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRwcm9ncmVzc2l2ZUVkaXRzQ3RzLmNhbmNlbCgpO1xuXHRcdFx0XHRyZXNwb25zZVByb21pc2UuY29tcGxldGUoKTtcblxuXHRcdFx0fSBlbHNlIGlmIChyZXNwb25zZS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdHJlc3BvbnNlUHJvbWlzZS5jb21wbGV0ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0c3RvcmUuYWRkKHJlc3BvbnNlLm9uRGlkQ2hhbmdlKGhhbmRsZVJlc3BvbnNlKSk7XG5cdFx0aGFuZGxlUmVzcG9uc2UoKTtcblxuXHRcdC8vICgxKSB3ZSBtdXN0IHdhaXQgZm9yIHRoZSByZXF1ZXN0IHRvIGZpbmlzaFxuXHRcdC8vICgyKSB3ZSBtdXN0IHdhaXQgZm9yIGFsbCBlZGl0cyB0aGF0IGNhbWUgaW4gdmlhIHByb2dyZXNzIHRvIGNvbXBsZXRlXG5cdFx0YXdhaXQgcmVzcG9uc2VQcm9taXNlLnA7XG5cdFx0YXdhaXQgcHJvZ3Jlc3NpdmVFZGl0c1F1ZXVlLndoZW5JZGxlKCk7XG5cblx0XHRpZiAocmVzcG9uc2UucmVzdWx0Py5lcnJvckRldGFpbHMgJiYgIXJlc3BvbnNlLnJlc3VsdC5lcnJvckRldGFpbHMucmVzcG9uc2VJc0ZpbHRlcmVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9zZXNzaW9uLnVuZG9DaGFuZ2VzVW50aWwocmVzcG9uc2UucmVxdWVzdElkKTtcblx0XHR9XG5cblx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCBkaWZmID0gYXdhaXQgdGhpcy5fZWRpdG9yV29ya2VyU2VydmljZS5jb21wdXRlRGlmZih0aGlzLl9zZXNzaW9uLnRleHRNb2RlbDAudXJpLCB0aGlzLl9zZXNzaW9uLnRleHRNb2RlbE4udXJpLCB7IGNvbXB1dGVNb3ZlczogZmFsc2UsIG1heENvbXB1dGF0aW9uVGltZU1zOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgaWdub3JlVHJpbVdoaXRlc3BhY2U6IGZhbHNlIH0sICdhZHZhbmNlZCcpO1xuXHRcdHRoaXMuX3Nlc3Npb24ud2hvbGVSYW5nZS5maXh1cChkaWZmPy5jaGFuZ2VzID8/IFtdKTtcblx0XHRhd2FpdCB0aGlzLl9zZXNzaW9uLmh1bmtEYXRhLnJlY29tcHV0ZShlZGl0U3RhdGUsIGRpZmYpO1xuXG5cdFx0dGhpcy5fY3R4UmVxdWVzdEluUHJvZ3Jlc3Muc2V0KGZhbHNlKTtcblxuXG5cdFx0bGV0IG5ld1Bvc2l0aW9uOiBQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRcdGlmIChyZXNwb25zZS5yZXN1bHQ/LmVycm9yRGV0YWlscykge1xuXHRcdFx0Ly8gZXJyb3IgLT4gbm8gbWVzc2FnZSwgZXJyb3JzIGFyZSBzaG93biB3aXRoIHRoZSByZXF1ZXN0XG5cblx0XHR9IGVsc2UgaWYgKHJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gZW1wdHkgLT4gc2hvdyBtZXNzYWdlXG5cdFx0XHRjb25zdCBzdGF0dXMgPSBsb2NhbGl6ZSgnZW1wdHknLCBcIk5vIHJlc3VsdHMsIHBsZWFzZSByZWZpbmUgeW91ciBpbnB1dCBhbmQgdHJ5IGFnYWluXCIpO1xuXHRcdFx0dGhpcy5fdWkudmFsdWUud2lkZ2V0LnVwZGF0ZVN0YXR1cyhzdGF0dXMsIHsgY2xhc3NlczogWyd3YXJuJ10gfSk7XG5cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gcmVhbCByZXNwb25zZSAtPiBubyBtZXNzYWdlXG5cdFx0XHR0aGlzLl91aS52YWx1ZS53aWRnZXQudXBkYXRlU3RhdHVzKCcnKTtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IGF3YWl0IHRoaXMuX3N0cmF0ZWd5LnJlbmRlckNoYW5nZXMoKTtcblx0XHRpZiAocG9zaXRpb24pIHtcblx0XHRcdC8vIGlmIHRoZSBzZWxlY3Rpb24gZG9lc24ndCBzdGFydCBmYXIgb2ZmIHdlIGtlZXAgdGhlIHdpZGdldCBhdCBpdHMgY3VycmVudCBwb3NpdGlvblxuXHRcdFx0Ly8gYmVjYXVzZSBpdCBtYWtlcyByZWFkaW5nIHRoaXMgbmljZXJcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGlmIChzZWxlY3Rpb24/LmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pKSB7XG5cdFx0XHRcdGlmIChwb3NpdGlvbi5saW5lTnVtYmVyIC0gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciA+IDgpIHtcblx0XHRcdFx0XHRuZXdQb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuZXdQb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9zaG93V2lkZ2V0KHRoaXMuX3Nlc3Npb24uaGVhZGxlc3MsIGZhbHNlLCBuZXdQb3NpdGlvbik7XG5cblx0XHRyZXR1cm4gbmV4dDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmNbU3RhdGUuUEFVU0VdKCkge1xuXG5cdFx0dGhpcy5fcmVzZXRXaWRnZXQoKTtcblxuXHRcdHRoaXMuX3N0cmF0ZWd5Py5kaXNwb3NlPy4oKTtcblx0XHR0aGlzLl9zZXNzaW9uID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luY1tTdGF0ZS5BQ0NFUFRdKCkge1xuXHRcdGFzc2VydFR5cGUodGhpcy5fc2Vzc2lvbik7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zdHJhdGVneSk7XG5cdFx0dGhpcy5fc2Vzc2lvblN0b3JlLmNsZWFyKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fc3RyYXRlZ3kuYXBwbHkoKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuX2RpYWxvZ1NlcnZpY2UuZXJyb3IobG9jYWxpemUoJ2Vyci5hcHBseScsIFwiRmFpbGVkIHRvIGFwcGx5IGNoYW5nZXMuXCIsIHRvRXJyb3JNZXNzYWdlKGVycikpKTtcblx0XHRcdHRoaXMuX2xvZygnRkFJTEVEIHRvIGFwcGx5IGNoYW5nZXMnKTtcblx0XHRcdHRoaXMuX2xvZyhlcnIpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Jlc2V0V2lkZ2V0KCk7XG5cdFx0dGhpcy5faW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnJlbGVhc2VTZXNzaW9uKHRoaXMuX3Nlc3Npb24pO1xuXG5cblx0XHR0aGlzLl9zdHJhdGVneT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Nlc3Npb24gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jW1N0YXRlLkNBTkNFTF0oKSB7XG5cblx0XHR0aGlzLl9yZXNldFdpZGdldCgpO1xuXG5cdFx0aWYgKHRoaXMuX3Nlc3Npb24pIHtcblx0XHRcdC8vIGFzc2VydFR5cGUodGhpcy5fc2Vzc2lvbik7XG5cdFx0XHRhc3NlcnRUeXBlKHRoaXMuX3N0cmF0ZWd5KTtcblx0XHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5jbGVhcigpO1xuXG5cdFx0XHQvLyBvbmx5IHN0YXNoIHNlc3Npb25zIHRoYXQgd2VyZSBub3QgdW5zdGFzaGVkLCBub3QgXCJlbXB0eVwiLCBhbmQgbm90IGludGVyYWN0ZWQgd2l0aFxuXHRcdFx0Y29uc3Qgc2hvdWxkU3Rhc2ggPSAhdGhpcy5fc2Vzc2lvbi5pc1Vuc3Rhc2hlZCAmJiB0aGlzLl9zZXNzaW9uLmNoYXRNb2RlbC5oYXNSZXF1ZXN0cyAmJiB0aGlzLl9zZXNzaW9uLmh1bmtEYXRhLnNpemUgPT09IHRoaXMuX3Nlc3Npb24uaHVua0RhdGEucGVuZGluZztcblx0XHRcdGxldCB1bmRvQ2FuY2VsRWRpdHM6IElWYWxpZEVkaXRPcGVyYXRpb25bXSA9IFtdO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dW5kb0NhbmNlbEVkaXRzID0gdGhpcy5fc3RyYXRlZ3kuY2FuY2VsKCk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5fZGlhbG9nU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnZXJyLmRpc2NhcmQnLCBcIkZhaWxlZCB0byBkaXNjYXJkIGNoYW5nZXMuXCIsIHRvRXJyb3JNZXNzYWdlKGVycikpKTtcblx0XHRcdFx0dGhpcy5fbG9nKCdGQUlMRUQgdG8gZGlzY2FyZCBjaGFuZ2VzJyk7XG5cdFx0XHRcdHRoaXMuX2xvZyhlcnIpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zdGFzaGVkU2Vzc2lvbi5jbGVhcigpO1xuXHRcdFx0aWYgKHNob3VsZFN0YXNoKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXNoZWRTZXNzaW9uLnZhbHVlID0gdGhpcy5faW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlLnN0YXNoU2Vzc2lvbih0aGlzLl9zZXNzaW9uLCB0aGlzLl9lZGl0b3IsIHVuZG9DYW5jZWxFZGl0cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9pbmxpbmVDaGF0U2Vzc2lvblNlcnZpY2UucmVsZWFzZVNlc3Npb24odGhpcy5fc2Vzc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cblx0XHR0aGlzLl9zdHJhdGVneT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3Nlc3Npb24gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyAtLS0tXG5cblx0cHJpdmF0ZSBfc2hvd1dpZGdldChoZWFkbGVzczogYm9vbGVhbiA9IGZhbHNlLCBpbml0aWFsUmVuZGVyOiBib29sZWFuID0gZmFsc2UsIHBvc2l0aW9uPzogUG9zaXRpb24pIHtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKTtcblx0XHR0aGlzLl9jdHhWaXNpYmxlLnNldCh0cnVlKTtcblxuXHRcdGxldCB3aWRnZXRQb3NpdGlvbjogUG9zaXRpb247XG5cdFx0aWYgKHBvc2l0aW9uKSB7XG5cdFx0XHQvLyBleHBsaWNpdCBwb3NpdGlvbiB3aW5zXG5cdFx0XHR3aWRnZXRQb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fdWkucmF3VmFsdWU/LnBvc2l0aW9uKSB7XG5cdFx0XHQvLyBhbHJlYWR5IHNob3dpbmcgLSBzcGVjaWFsIGNhc2Ugb2YgbGluZSAxXG5cdFx0XHRpZiAodGhpcy5fdWkucmF3VmFsdWU/LnBvc2l0aW9uLmxpbmVOdW1iZXIgPT09IDEpIHtcblx0XHRcdFx0d2lkZ2V0UG9zaXRpb24gPSB0aGlzLl91aS5yYXdWYWx1ZT8ucG9zaXRpb24uZGVsdGEoLTEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0d2lkZ2V0UG9zaXRpb24gPSB0aGlzLl91aS5yYXdWYWx1ZT8ucG9zaXRpb247XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGRlZmF1bHQgdG8gQUJPVkUgdGhlIHNlbGVjdGlvblxuXHRcdFx0d2lkZ2V0UG9zaXRpb24gPSB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9uKCkuZ2V0U3RhcnRQb3NpdGlvbigpLmRlbHRhKC0xKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc2Vzc2lvbiAmJiAhcG9zaXRpb24gJiYgKHRoaXMuX3Nlc3Npb24uaGFzQ2hhbmdlZFRleHQgfHwgdGhpcy5fc2Vzc2lvbi5jaGF0TW9kZWwuaGFzUmVxdWVzdHMpKSB7XG5cdFx0XHR3aWRnZXRQb3NpdGlvbiA9IHRoaXMuX3Nlc3Npb24ud2hvbGVSYW5nZS50cmFja2VkSW5pdGlhbFJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKS5kZWx0YSgtMSk7XG5cdFx0fVxuXG5cdFx0aWYgKGluaXRpYWxSZW5kZXIgJiYgKHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN0aWNreVNjcm9sbCkpLmVuYWJsZWQpIHtcblx0XHRcdHRoaXMuX2VkaXRvci5yZXZlYWxMaW5lKHdpZGdldFBvc2l0aW9uLmxpbmVOdW1iZXIpOyAvLyBkbyBOT1Qgc3Vic3RyYWN0IGB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdGlja3lTY3JvbGwpLm1heExpbmVDb3VudGAgYmVjYXVzZSB0aGUgZWRpdG9yIGFscmVhZHkgZG9lcyB0aGF0XG5cdFx0fVxuXG5cdFx0aWYgKCFoZWFkbGVzcykge1xuXHRcdFx0aWYgKHRoaXMuX3VpLnJhd1ZhbHVlPy5wb3NpdGlvbikge1xuXHRcdFx0XHR0aGlzLl91aS52YWx1ZS51cGRhdGVQb3NpdGlvbkFuZEhlaWdodCh3aWRnZXRQb3NpdGlvbik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl91aS52YWx1ZS5zaG93KHdpZGdldFBvc2l0aW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gd2lkZ2V0UG9zaXRpb247XG5cdH1cblxuXHRwcml2YXRlIF9yZXNldFdpZGdldCgpIHtcblxuXHRcdHRoaXMuX3Nlc3Npb25TdG9yZS5jbGVhcigpO1xuXHRcdHRoaXMuX2N0eFZpc2libGUucmVzZXQoKTtcblxuXHRcdHRoaXMuX3VpLnJhd1ZhbHVlPy5oaWRlKCk7XG5cblx0XHQvLyBSZXR1cm4gZm9jdXMgdG8gdGhlIGVkaXRvciBvbmx5IGlmIHRoZSBjdXJyZW50IGZvY3VzIGlzIHdpdGhpbiB0aGUgZWRpdG9yIHdpZGdldFxuXHRcdGlmICh0aGlzLl9lZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSkge1xuXHRcdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ3R4UmVzcG9uc2VUeXBlKCk6IHZvaWQge1xuXG5cdFx0aWYgKCF0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHR0aGlzLl9jdHhSZXNwb25zZVR5cGUuc2V0KElubGluZUNoYXRSZXNwb25zZVR5cGUuTm9uZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzTG9jYWxFZGl0ID0gKHJlc3BvbnNlOiBJUmVzcG9uc2UpOiBib29sZWFuID0+IHtcblx0XHRcdHJldHVybiByZXNwb25zZS52YWx1ZS5zb21lKHBhcnQgPT4gcGFydC5raW5kID09PSAndGV4dEVkaXRHcm91cCcgJiYgaXNFcXVhbChwYXJ0LnVyaSwgdGhpcy5fc2Vzc2lvbj8udGV4dE1vZGVsTi51cmkpKTtcblx0XHR9O1xuXG5cdFx0bGV0IHJlc3BvbnNlVHlwZSA9IElubGluZUNoYXRSZXNwb25zZVR5cGUuTm9uZTtcblx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgdGhpcy5fc2Vzc2lvbi5jaGF0TW9kZWwuZ2V0UmVxdWVzdHMoKSkge1xuXHRcdFx0aWYgKCFyZXF1ZXN0LnJlc3BvbnNlKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVzcG9uc2VUeXBlID0gSW5saW5lQ2hhdFJlc3BvbnNlVHlwZS5NZXNzYWdlcztcblx0XHRcdGlmIChoYXNMb2NhbEVkaXQocmVxdWVzdC5yZXNwb25zZS5yZXNwb25zZSkpIHtcblx0XHRcdFx0cmVzcG9uc2VUeXBlID0gSW5saW5lQ2hhdFJlc3BvbnNlVHlwZS5NZXNzYWdlc0FuZEVkaXRzO1xuXHRcdFx0XHRicmVhazsgLy8gbm8gbmVlZCB0byBjaGVjayBmdXJ0aGVyXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2N0eFJlc3BvbnNlVHlwZS5zZXQocmVzcG9uc2VUeXBlKTtcblx0XHR0aGlzLl9jdHhSZXNwb25zZS5zZXQocmVzcG9uc2VUeXBlICE9PSBJbmxpbmVDaGF0UmVzcG9uc2VUeXBlLk5vbmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlQ2hhdFRleHRFZGl0R3JvdXBTdGF0ZSgpOiBJQ2hhdFRleHRFZGl0R3JvdXBTdGF0ZSB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zZXNzaW9uKTtcblxuXHRcdGNvbnN0IHNoYTEgPSBuZXcgRGVmYXVsdE1vZGVsU0hBMUNvbXB1dGVyKCk7XG5cdFx0Y29uc3QgdGV4dE1vZGVsMFNoYTEgPSBzaGExLmNhbkNvbXB1dGVTSEExKHRoaXMuX3Nlc3Npb24udGV4dE1vZGVsMClcblx0XHRcdD8gc2hhMS5jb21wdXRlU0hBMSh0aGlzLl9zZXNzaW9uLnRleHRNb2RlbDApXG5cdFx0XHQ6IGdlbmVyYXRlVXVpZCgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNoYTE6IHRleHRNb2RlbDBTaGExLFxuXHRcdFx0YXBwbGllZDogMFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9tYWtlQ2hhbmdlcyhlZGl0czogVGV4dEVkaXRbXSwgb3B0czogUHJvZ3Jlc3NpbmdFZGl0c09wdGlvbnMgfCB1bmRlZmluZWQsIHVuZG9TdG9wQmVmb3JlOiBib29sZWFuKSB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zZXNzaW9uKTtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX3N0cmF0ZWd5KTtcblxuXHRcdGNvbnN0IG1vcmVNaW5pbWFsRWRpdHMgPSBhd2FpdCB0aGlzLl9lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKHRoaXMuX3Nlc3Npb24udGV4dE1vZGVsTi51cmksIGVkaXRzKTtcblx0XHR0aGlzLl9sb2coJ2VkaXRzIGZyb20gUFJPVklERVIgYW5kIGFmdGVyIG1ha2luZyB0aGVtIE1PUkUgTUlOSU1BTCcsIHRoaXMuX3Nlc3Npb24uYWdlbnQuZXh0ZW5zaW9uSWQsIGVkaXRzLCBtb3JlTWluaW1hbEVkaXRzKTtcblxuXHRcdGlmIChtb3JlTWluaW1hbEVkaXRzPy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIG5vdGhpbmcgbGVmdCB0byBkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdHVhbEVkaXRzID0gIW9wdHMgJiYgbW9yZU1pbmltYWxFZGl0cyA/IG1vcmVNaW5pbWFsRWRpdHMgOiBlZGl0cztcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGFjdHVhbEVkaXRzLm1hcChUZXh0RWRpdC5hc0VkaXRPcGVyYXRpb24pO1xuXG5cdFx0Y29uc3QgZWRpdHNPYnNlcnZlcjogSUVkaXRPYnNlcnZlciA9IHtcblx0XHRcdHN0YXJ0OiAoKSA9PiB0aGlzLl9zZXNzaW9uIS5odW5rRGF0YS5pZ25vcmVUZXh0TW9kZWxOQ2hhbmdlcyA9IHRydWUsXG5cdFx0XHRzdG9wOiAoKSA9PiB0aGlzLl9zZXNzaW9uIS5odW5rRGF0YS5pZ25vcmVUZXh0TW9kZWxOQ2hhbmdlcyA9IGZhbHNlLFxuXHRcdH07XG5cblx0XHRpZiAob3B0cykge1xuXHRcdFx0YXdhaXQgdGhpcy5fc3RyYXRlZ3kubWFrZVByb2dyZXNzaXZlQ2hhbmdlcyhlZGl0T3BlcmF0aW9ucywgZWRpdHNPYnNlcnZlciwgb3B0cywgdW5kb1N0b3BCZWZvcmUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9zdHJhdGVneS5tYWtlQ2hhbmdlcyhlZGl0T3BlcmF0aW9ucywgZWRpdHNPYnNlcnZlciwgdW5kb1N0b3BCZWZvcmUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVBsYWNlaG9sZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC5wbGFjZWhvbGRlciA9IHRoaXMuX3Nlc3Npb24/LmFnZW50LmRlc2NyaXB0aW9uID8/ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlSW5wdXQodGV4dDogc3RyaW5nLCBzZWxlY3RBbGwgPSB0cnVlKTogdm9pZCB7XG5cblx0XHR0aGlzLl91aS52YWx1ZS53aWRnZXQuY2hhdFdpZGdldC5zZXRJbnB1dCh0ZXh0KTtcblx0XHRpZiAoc2VsZWN0QWxsKSB7XG5cdFx0XHRjb25zdCBuZXdTZWxlY3Rpb24gPSBuZXcgU2VsZWN0aW9uKDEsIDEsIE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCAxKTtcblx0XHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC5jaGF0V2lkZ2V0LmlucHV0RWRpdG9yLnNldFNlbGVjdGlvbihuZXdTZWxlY3Rpb24pO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLS0gY29udHJvbGxlciBBUElcblxuXHRhcnJvd091dCh1cDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl91aS52YWx1ZS5wb3NpdGlvbiAmJiB0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0Y29uc3QgeyBjb2x1bW4gfSA9IHRoaXMuX2VkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3QgeyBsaW5lTnVtYmVyIH0gPSB0aGlzLl91aS52YWx1ZS5wb3NpdGlvbjtcblx0XHRcdGNvbnN0IG5ld0xpbmUgPSB1cCA/IGxpbmVOdW1iZXIgOiBsaW5lTnVtYmVyICsgMTtcblx0XHRcdHRoaXMuX2VkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IG5ld0xpbmUsIGNvbHVtbiB9KTtcblx0XHRcdHRoaXMuX2VkaXRvci5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3VpLnZhbHVlLndpZGdldC5mb2N1cygpO1xuXHR9XG5cblx0YXN5bmMgdmlld0luQ2hhdCgpIHtcblx0XHRpZiAoIXRoaXMuX3N0cmF0ZWd5IHx8ICF0aGlzLl9zZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IHNvbWVBcHBsaWVkID0gZmFsc2U7XG5cdFx0bGV0IGxhc3RFZGl0OiBJQ2hhdFRleHRFZGl0R3JvdXAgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB1cmkgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXHRcdGNvbnN0IHJlcXVlc3RzID0gdGhpcy5fc2Vzc2lvbi5jaGF0TW9kZWwuZ2V0UmVxdWVzdHMoKTtcblx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgcmVxdWVzdHMpIHtcblx0XHRcdGlmICghcmVxdWVzdC5yZXNwb25zZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGZvciAoY29uc3QgcGFydCBvZiByZXF1ZXN0LnJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlKSB7XG5cdFx0XHRcdGlmIChwYXJ0LmtpbmQgPT09ICd0ZXh0RWRpdEdyb3VwJyAmJiBpc0VxdWFsKHBhcnQudXJpLCB1cmkpKSB7XG5cdFx0XHRcdFx0Ly8gZnVsbHkgb3IgcGFydGlhbGx5IGFwcGxpZWQgZWRpdHNcblx0XHRcdFx0XHRzb21lQXBwbGllZCA9IHNvbWVBcHBsaWVkIHx8IEJvb2xlYW4ocGFydC5zdGF0ZT8uYXBwbGllZCk7XG5cdFx0XHRcdFx0bGFzdEVkaXQgPSBwYXJ0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9FZGl0cyA9IHRoaXMuX3N0cmF0ZWd5LmNhbmNlbCgpO1xuXG5cdFx0aWYgKHNvbWVBcHBsaWVkKSB7XG5cdFx0XHRhc3NlcnRUeXBlKGxhc3RFZGl0KTtcblx0XHRcdGxhc3RFZGl0LmVkaXRzID0gW2RvRWRpdHNdO1xuXHRcdFx0bGFzdEVkaXQuc3RhdGUhLmFwcGxpZWQgPSAwO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX2luc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbihtb3ZlVG9QYW5lbENoYXQsIHRoaXMuX3Nlc3Npb24/LmNoYXRNb2RlbCk7XG5cblx0XHR0aGlzLmNhbmNlbFNlc3Npb24oKTtcblx0fVxuXG5cdGFjY2VwdFNlc3Npb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSB0aGlzLl9zZXNzaW9uPy5jaGF0TW9kZWwuZ2V0UmVxdWVzdHMoKS5hdCgtMSk/LnJlc3BvbnNlO1xuXHRcdGlmIChyZXNwb25zZSkge1xuXHRcdFx0dGhpcy5fY2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdHNlc3Npb25JZDogcmVzcG9uc2Uuc2Vzc2lvbi5zZXNzaW9uSWQsXG5cdFx0XHRcdHJlcXVlc3RJZDogcmVzcG9uc2UucmVxdWVzdElkLFxuXHRcdFx0XHRhZ2VudElkOiByZXNwb25zZS5hZ2VudD8uaWQsXG5cdFx0XHRcdGNvbW1hbmQ6IHJlc3BvbnNlLnNsYXNoQ29tbWFuZD8ubmFtZSxcblx0XHRcdFx0cmVzdWx0OiByZXNwb25zZS5yZXN1bHQsXG5cdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdGtpbmQ6ICdpbmxpbmVDaGF0Jyxcblx0XHRcdFx0XHRhY3Rpb246ICdhY2NlcHRlZCdcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHRoaXMuX21lc3NhZ2VzLmZpcmUoTWVzc2FnZS5BQ0NFUFRfU0VTU0lPTik7XG5cdH1cblxuXHRhY2NlcHRIdW5rKGh1bmtJbmZvPzogSHVua0luZm9ybWF0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3N0cmF0ZWd5Py5wZXJmb3JtSHVua0FjdGlvbihodW5rSW5mbywgSHVua0FjdGlvbi5BY2NlcHQpO1xuXHR9XG5cblx0ZGlzY2FyZEh1bmsoaHVua0luZm8/OiBIdW5rSW5mb3JtYXRpb24pIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RyYXRlZ3k/LnBlcmZvcm1IdW5rQWN0aW9uKGh1bmtJbmZvLCBIdW5rQWN0aW9uLkRpc2NhcmQpO1xuXHR9XG5cblx0dG9nZ2xlRGlmZihodW5rSW5mbz86IEh1bmtJbmZvcm1hdGlvbikge1xuXHRcdHJldHVybiB0aGlzLl9zdHJhdGVneT8ucGVyZm9ybUh1bmtBY3Rpb24oaHVua0luZm8sIEh1bmtBY3Rpb24uVG9nZ2xlRGlmZik7XG5cdH1cblxuXHRtb3ZlSHVuayhuZXh0OiBib29sZWFuKSB7XG5cdFx0dGhpcy5mb2N1cygpO1xuXHRcdHRoaXMuX3N0cmF0ZWd5Py5wZXJmb3JtSHVua0FjdGlvbih1bmRlZmluZWQsIG5leHQgPyBIdW5rQWN0aW9uLk1vdmVOZXh0IDogSHVua0FjdGlvbi5Nb3ZlUHJldik7XG5cdH1cblxuXHRhc3luYyBjYW5jZWxTZXNzaW9uKCkge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gdGhpcy5fc2Vzc2lvbj8uY2hhdE1vZGVsLmxhc3RSZXF1ZXN0Py5yZXNwb25zZTtcblx0XHRpZiAocmVzcG9uc2UpIHtcblx0XHRcdHRoaXMuX2NoYXRTZXJ2aWNlLm5vdGlmeVVzZXJBY3Rpb24oe1xuXHRcdFx0XHRzZXNzaW9uSWQ6IHJlc3BvbnNlLnNlc3Npb24uc2Vzc2lvbklkLFxuXHRcdFx0XHRyZXF1ZXN0SWQ6IHJlc3BvbnNlLnJlcXVlc3RJZCxcblx0XHRcdFx0YWdlbnRJZDogcmVzcG9uc2UuYWdlbnQ/LmlkLFxuXHRcdFx0XHRjb21tYW5kOiByZXNwb25zZS5zbGFzaENvbW1hbmQ/Lm5hbWUsXG5cdFx0XHRcdHJlc3VsdDogcmVzcG9uc2UucmVzdWx0LFxuXHRcdFx0XHRhY3Rpb246IHtcblx0XHRcdFx0XHRraW5kOiAnaW5saW5lQ2hhdCcsXG5cdFx0XHRcdFx0YWN0aW9uOiAnZGlzY2FyZGVkJ1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLl9tZXNzYWdlcy5maXJlKE1lc3NhZ2UuQ0FOQ0VMX1NFU1NJT04pO1xuXHR9XG5cblx0cmVwb3J0SXNzdWUoKSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSB0aGlzLl9zZXNzaW9uPy5jaGF0TW9kZWwubGFzdFJlcXVlc3Q/LnJlc3BvbnNlO1xuXHRcdGlmIChyZXNwb25zZSkge1xuXHRcdFx0dGhpcy5fY2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdHNlc3Npb25JZDogcmVzcG9uc2Uuc2Vzc2lvbi5zZXNzaW9uSWQsXG5cdFx0XHRcdHJlcXVlc3RJZDogcmVzcG9uc2UucmVxdWVzdElkLFxuXHRcdFx0XHRhZ2VudElkOiByZXNwb25zZS5hZ2VudD8uaWQsXG5cdFx0XHRcdGNvbW1hbmQ6IHJlc3BvbnNlLnNsYXNoQ29tbWFuZD8ubmFtZSxcblx0XHRcdFx0cmVzdWx0OiByZXNwb25zZS5yZXN1bHQsXG5cdFx0XHRcdGFjdGlvbjogeyBraW5kOiAnYnVnJyB9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHR1bnN0YXNoTGFzdFNlc3Npb24oKTogU2Vzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fc3Rhc2hlZFNlc3Npb24udmFsdWU/LnVuc3Rhc2goKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0am9pbkN1cnJlbnRSdW4oKTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnJlbnRSdW47XG5cdH1cblxuXHRnZXQgaXNBY3RpdmUoKSB7XG5cdFx0cmV0dXJuIEJvb2xlYW4odGhpcy5fY3VycmVudFJ1bik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUNoYXRDb250cm9sbGVyMiBpbXBsZW1lbnRzIElFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5pbmxpbmVDaGF0Q29udHJvbGxlcjInO1xuXG5cdHN0YXRpYyBnZXQoZWRpdG9yOiBJQ29kZUVkaXRvcik6IElubGluZUNoYXRDb250cm9sbGVyMiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGVkaXRvci5nZXRDb250cmlidXRpb248SW5saW5lQ2hhdENvbnRyb2xsZXIyPihJbmxpbmVDaGF0Q29udHJvbGxlcjIuSUQpID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zaG93V2lkZ2V0T3ZlcnJpZGVPYnMgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pc0FjdGl2ZUNvbnRyb2xsZXIgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF96b25lOiBMYXp5PElubGluZUNoYXRab25lV2lkZ2V0PjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50U2Vzc2lvbjogSU9ic2VydmFibGU8SUlubGluZUNoYXRTZXNzaW9uMiB8IHVuZGVmaW5lZD47XG5cblx0Z2V0IHdpZGdldCgpOiBFZGl0b3JCYXNlZElubGluZUNoYXRXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLl96b25lLnZhbHVlLndpZGdldDtcblx0fVxuXG5cdGdldCBpc0FjdGl2ZSgpIHtcblx0XHRyZXR1cm4gQm9vbGVhbih0aGlzLl9jdXJyZW50U2Vzc2lvbi5nZXQoKSk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tFZGl0b3JTZXJ2aWNlOiBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJSW5saW5lQ2hhdFNlc3Npb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUNoYXRTZXNzaW9uczogSUlubGluZUNoYXRTZXNzaW9uU2VydmljZSxcblx0XHRASUNvZGVFZGl0b3JTZXJ2aWNlIGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblxuXHRcdGNvbnN0IGN0eElubGluZUNoYXRWaXNpYmxlID0gQ1RYX0lOTElORV9DSEFUX1ZJU0lCTEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3pvbmUgPSBuZXcgTGF6eTxJbmxpbmVDaGF0Wm9uZVdpZGdldD4oKCkgPT4ge1xuXG5cblx0XHRcdGNvbnN0IGxvY2F0aW9uOiBJQ2hhdFdpZGdldExvY2F0aW9uT3B0aW9ucyA9IHtcblx0XHRcdFx0bG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLkVkaXRvcixcblx0XHRcdFx0cmVzb2x2ZURhdGE6ICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnRUeXBlKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKTtcblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IsXG5cdFx0XHRcdFx0XHRzZWxlY3Rpb246IHRoaXMuX2VkaXRvci5nZXRTZWxlY3Rpb24oKSxcblx0XHRcdFx0XHRcdGRvY3VtZW50OiB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKS51cmksXG5cdFx0XHRcdFx0XHR3aG9sZVJhbmdlOiB0aGlzLl9lZGl0b3IuZ2V0U2VsZWN0aW9uKCksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Ly8gaW5saW5lIGNoYXQgaW4gbm90ZWJvb2tzXG5cdFx0XHQvLyBjaGVjayBpZiB0aGlzIGVkaXRvciBpcyBwYXJ0IG9mIGEgbm90ZWJvb2sgZWRpdG9yXG5cdFx0XHQvLyBhbmQgaWZmIHNvLCB1c2UgdGhlIG5vdGVib29rIGxvY2F0aW9uIGJ1dCBrZWVwIHRoZSByZXNvbHZlRGF0YVxuXHRcdFx0Ly8gdGFsayBhYm91dCBlZGl0b3IgZGF0YVxuXHRcdFx0Zm9yIChjb25zdCBub3RlYm9va0VkaXRvciBvZiB0aGlzLl9ub3RlYm9va0VkaXRvclNlcnZpY2UubGlzdE5vdGVib29rRWRpdG9ycygpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgWywgY29kZUVkaXRvcl0gb2Ygbm90ZWJvb2tFZGl0b3IuY29kZUVkaXRvcnMpIHtcblx0XHRcdFx0XHRpZiAoY29kZUVkaXRvciA9PT0gdGhpcy5fZWRpdG9yKSB7XG5cdFx0XHRcdFx0XHRsb2NhdGlvbi5sb2NhdGlvbiA9IENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVDaGF0Wm9uZVdpZGdldCxcblx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRlbmFibGVXb3JraW5nU2V0OiAnaW1wbGljaXQnLFxuXHRcdFx0XHRcdHJlbmRlcmVyT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0cmVuZGVyVGV4dEVkaXRzQXNTdW1tYXJ5OiBfdXJpID0+IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRoaXMuX2VkaXRvclxuXHRcdFx0KTtcblxuXHRcdFx0cmVzdWx0LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnaW5saW5lLWNoYXQtMicpO1xuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pO1xuXG5cblx0XHRjb25zdCBlZGl0b3JPYnMgPSBvYnNlcnZhYmxlQ29kZUVkaXRvcihfZWRpdG9yKTtcblxuXHRcdGNvbnN0IHNlc3Npb25zU2lnbmFsID0gb2JzZXJ2YWJsZVNpZ25hbEZyb21FdmVudCh0aGlzLCBfaW5saW5lQ2hhdFNlc3Npb25zLm9uRGlkQ2hhbmdlU2Vzc2lvbnMpO1xuXG5cdFx0dGhpcy5fY3VycmVudFNlc3Npb24gPSBkZXJpdmVkKHIgPT4ge1xuXHRcdFx0c2Vzc2lvbnNTaWduYWwucmVhZChyKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gZWRpdG9yT2JzLm1vZGVsLnJlYWQocik7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IG1vZGVsICYmIF9pbmxpbmVDaGF0U2Vzc2lvbnMuZ2V0U2Vzc2lvbjIobW9kZWwudXJpKTtcblx0XHRcdHJldHVybiB2YWx1ZSA/PyB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX2N1cnJlbnRTZXNzaW9uLnJlYWQocik7XG5cdFx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdFx0dGhpcy5faXNBY3RpdmVDb250cm9sbGVyLnNldChmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGV0IGZvdW5kT25lID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBjb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKSkge1xuXHRcdFx0XHRpZiAoQm9vbGVhbihJbmxpbmVDaGF0Q29udHJvbGxlcjIuZ2V0KGVkaXRvcik/Ll9pc0FjdGl2ZUNvbnRyb2xsZXIuZ2V0KCkpKSB7XG5cdFx0XHRcdFx0Zm91bmRPbmUgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWZvdW5kT25lICYmIF9lZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSkge1xuXHRcdFx0XHR0aGlzLl9pc0FjdGl2ZUNvbnRyb2xsZXIuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgdmlzaWJsZVNlc3Npb25PYnMgPSBvYnNlcnZhYmxlVmFsdWU8SUlubGluZUNoYXRTZXNzaW9uMiB8IHVuZGVmaW5lZD4odGhpcywgdW5kZWZpbmVkKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuV2l0aFN0b3JlKChyLCBzdG9yZSkgPT4ge1xuXG5cdFx0XHRjb25zdCBtb2RlbCA9IGVkaXRvck9icy5tb2RlbC5yZWFkKHIpO1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX2N1cnJlbnRTZXNzaW9uLnJlYWQocik7XG5cdFx0XHRjb25zdCBpc0FjdGl2ZSA9IHRoaXMuX2lzQWN0aXZlQ29udHJvbGxlci5yZWFkKHIpO1xuXG5cdFx0XHRpZiAoIXNlc3Npb24gfHwgIWlzQWN0aXZlIHx8ICFtb2RlbCkge1xuXHRcdFx0XHR2aXNpYmxlU2Vzc2lvbk9icy5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHsgY2hhdE1vZGVsIH0gPSBzZXNzaW9uO1xuXHRcdFx0Y29uc3Qgc2hvd1Nob3dVbnRpbCA9IHRoaXMuX3Nob3dXaWRnZXRPdmVycmlkZU9icy5yZWFkKHIpO1xuXHRcdFx0Y29uc3QgaGFzTm9SZXF1ZXN0cyA9IGNoYXRNb2RlbC5nZXRSZXF1ZXN0cygpLmxlbmd0aCA9PT0gMDtcblxuXG5cdFx0XHRjb25zdCByZXNwb25zZUxpc3RlbmVyID0gc3RvcmUuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRcdFx0c3RvcmUuYWRkKGNoYXRNb2RlbC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0aWYgKGUua2luZCA9PT0gJ2FkZFJlcXVlc3QnKSB7XG5cdFx0XHRcdFx0dHJhbnNhY3Rpb24odHggPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2hvd1dpZGdldE92ZXJyaWRlT2JzLnNldChmYWxzZSwgdHgpO1xuXHRcdFx0XHRcdFx0dmlzaWJsZVNlc3Npb25PYnMuc2V0KHVuZGVmaW5lZCwgdHgpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGNvbnN0IHsgcmVzcG9uc2UgfSA9IGUucmVxdWVzdDtcblx0XHRcdFx0XHRpZiAoIXJlc3BvbnNlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJlc3BvbnNlTGlzdGVuZXIudmFsdWUgPSByZXNwb25zZS5vbkRpZENoYW5nZShhc3luYyBlID0+IHtcblxuXHRcdFx0XHRcdFx0aWYgKCFyZXNwb25zZS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3Qgc2hvdWxkU2hvdyA9IHJlc3BvbnNlLmlzQ2FuY2VsZWQgLy8gY2FuY2VsbGVkXG5cdFx0XHRcdFx0XHRcdHx8IHJlc3BvbnNlLnJlc3VsdD8uZXJyb3JEZXRhaWxzIC8vIGVycm9yc1xuXHRcdFx0XHRcdFx0XHR8fCAhcmVzcG9uc2UucmVzcG9uc2UudmFsdWUuZmluZChwYXJ0ID0+IHBhcnQua2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnXG5cdFx0XHRcdFx0XHRcdFx0JiYgcGFydC5lZGl0cy5sZW5ndGggPiAwXG5cdFx0XHRcdFx0XHRcdFx0JiYgaXNFcXVhbChwYXJ0LnVyaSwgbW9kZWwudXJpKSk7IC8vIE5PIGVkaXRzIGZvciBmaWxlXG5cblx0XHRcdFx0XHRcdGlmIChzaG91bGRTaG93KSB7XG5cdFx0XHRcdFx0XHRcdHZpc2libGVTZXNzaW9uT2JzLnNldChzZXNzaW9uLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGlmIChzaG93U2hvd1VudGlsIHx8IGhhc05vUmVxdWVzdHMpIHtcblx0XHRcdFx0dmlzaWJsZVNlc3Npb25PYnMuc2V0KHNlc3Npb24sIHVuZGVmaW5lZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR2aXNpYmxlU2Vzc2lvbk9icy5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChhdXRvcnVuKHIgPT4ge1xuXG5cdFx0XHRjb25zdCBzZXNzaW9uID0gdmlzaWJsZVNlc3Npb25PYnMucmVhZChyKTtcblxuXHRcdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRcdHRoaXMuX3pvbmUucmF3VmFsdWU/LmhpZGUoKTtcblx0XHRcdFx0X2VkaXRvci5mb2N1cygpO1xuXHRcdFx0XHRjdHhJbmxpbmVDaGF0VmlzaWJsZS5yZXNldCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y3R4SW5saW5lQ2hhdFZpc2libGUuc2V0KHRydWUpO1xuXHRcdFx0XHR0aGlzLl96b25lLnZhbHVlLndpZGdldC5zZXRDaGF0TW9kZWwoc2Vzc2lvbi5jaGF0TW9kZWwpO1xuXHRcdFx0XHRpZiAoIXRoaXMuX3pvbmUudmFsdWUucG9zaXRpb24pIHtcblx0XHRcdFx0XHR0aGlzLl96b25lLnZhbHVlLnNob3coc2Vzc2lvbi5pbml0aWFsUG9zaXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3pvbmUudmFsdWUucmV2ZWFsKHRoaXMuX3pvbmUudmFsdWUucG9zaXRpb24hKTtcblx0XHRcdFx0dGhpcy5fem9uZS52YWx1ZS53aWRnZXQuZm9jdXMoKTtcblx0XHRcdFx0c2Vzc2lvbi5lZGl0aW5nU2Vzc2lvbi5nZXRFbnRyeShzZXNzaW9uLnVyaSk/LmF1dG9BY2NlcHRDb250cm9sbGVyLmdldCgpPy5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHRvZ2dsZVdpZGdldFVudGlsTmV4dFJlcXVlc3QoKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl9zaG93V2lkZ2V0T3ZlcnJpZGVPYnMuZ2V0KCk7XG5cdFx0dGhpcy5fc2hvd1dpZGdldE92ZXJyaWRlT2JzLnNldCghdmFsdWUsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRnZXRXaWRnZXRQb3NpdGlvbigpOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3pvbmUucmF3VmFsdWU/LnBvc2l0aW9uO1xuXHR9XG5cblx0Zm9jdXMoKSB7XG5cdFx0dGhpcy5fem9uZS5yYXdWYWx1ZT8ud2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHRtYXJrQWN0aXZlQ29udHJvbGxlcigpIHtcblx0XHR0aGlzLl9pc0FjdGl2ZUNvbnRyb2xsZXIuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRhc3luYyBydW4oYXJnPzogSW5saW5lQ2hhdFJ1bk9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX2VkaXRvci5oYXNNb2RlbCgpKTtcblxuXHRcdHRoaXMubWFya0FjdGl2ZUNvbnRyb2xsZXIoKTtcblxuXHRcdGNvbnN0IHVyaSA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpLnVyaTtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5faW5saW5lQ2hhdFNlc3Npb25zLmdldFNlc3Npb24yKHVyaSlcblx0XHRcdD8/IGF3YWl0IHRoaXMuX2lubGluZUNoYXRTZXNzaW9ucy5jcmVhdGVTZXNzaW9uMih0aGlzLl9lZGl0b3IsIHVyaSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRpZiAoYXJnICYmIElubGluZUNoYXRSdW5PcHRpb25zLmlzSW5saW5lQ2hhdFJ1bk9wdGlvbnMoYXJnKSkge1xuXHRcdFx0aWYgKGFyZy5pbml0aWFsUmFuZ2UpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9yLnJldmVhbFJhbmdlKGFyZy5pbml0aWFsUmFuZ2UpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFyZy5pbml0aWFsU2VsZWN0aW9uKSB7XG5cdFx0XHRcdHRoaXMuX2VkaXRvci5zZXRTZWxlY3Rpb24oYXJnLmluaXRpYWxTZWxlY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFyZy5tZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMuX3pvbmUudmFsdWUud2lkZ2V0LmNoYXRXaWRnZXQuc2V0SW5wdXQoYXJnLm1lc3NhZ2UpO1xuXHRcdFx0XHRpZiAoYXJnLmF1dG9TZW5kKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fem9uZS52YWx1ZS53aWRnZXQuY2hhdFdpZGdldC5hY2NlcHRJbnB1dCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHNlc3Npb24uZWRpdGluZ1Nlc3Npb24ub25EaWREaXNwb3NlKTtcblxuXHRcdGNvbnN0IHJlamVjdGVkID0gc2Vzc2lvbi5lZGl0aW5nU2Vzc2lvbi5nZXRFbnRyeSh1cmkpPy5zdGF0ZS5nZXQoKSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQ7XG5cdFx0cmV0dXJuICFyZWplY3RlZDtcblx0fVxuXG5cdGFjY2VwdFNlc3Npb24oKSB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl9jdXJyZW50U2Vzc2lvbi5nZXQoKTtcblx0XHR2YWx1ZT8uZWRpdGluZ1Nlc3Npb24uYWNjZXB0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJldmlld0VkaXRzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBzdHJlYW06IEFzeW5jSXRlcmFibGU8VGV4dEVkaXRbXT4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRpZiAoIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0Y29uc3QgY2hhdEVkaXRpbmdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0RWRpdGluZ1NlcnZpY2UpO1xuXG5cdGNvbnN0IHVyaSA9IGVkaXRvci5nZXRNb2RlbCgpLnVyaTtcblx0Y29uc3QgY2hhdE1vZGVsID0gY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciwgdG9rZW4sIGZhbHNlKTtcblxuXHRjb25zdCBlZGl0U2Vzc2lvbiA9IGF3YWl0IGNoYXRFZGl0aW5nU2VydmljZS5jcmVhdGVFZGl0aW5nU2Vzc2lvbihjaGF0TW9kZWwpO1xuXG5cdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRzdG9yZS5hZGQoY2hhdE1vZGVsKTtcblx0c3RvcmUuYWRkKGVkaXRTZXNzaW9uKTtcblxuXHQvLyBTVFJFQU1cblx0Y29uc3QgY2hhdFJlcXVlc3QgPSBjaGF0TW9kZWw/LmFkZFJlcXVlc3QoeyB0ZXh0OiAnJywgcGFydHM6IFtdIH0sIHsgdmFyaWFibGVzOiBbXSB9LCAwKTtcblx0YXNzZXJ0VHlwZShjaGF0UmVxdWVzdC5yZXNwb25zZSk7XG5cdGNoYXRSZXF1ZXN0LnJlc3BvbnNlLnVwZGF0ZUNvbnRlbnQoeyBraW5kOiAndGV4dEVkaXQnLCB1cmksIGVkaXRzOiBbXSwgZG9uZTogZmFsc2UgfSk7XG5cdGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2Ygc3RyZWFtKSB7XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdGNoYXRSZXF1ZXN0LnJlc3BvbnNlLmNhbmNlbCgpO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y2hhdFJlcXVlc3QucmVzcG9uc2UudXBkYXRlQ29udGVudCh7IGtpbmQ6ICd0ZXh0RWRpdCcsIHVyaSwgZWRpdHM6IGNodW5rLCBkb25lOiBmYWxzZSB9KTtcblx0fVxuXHRjaGF0UmVxdWVzdC5yZXNwb25zZS51cGRhdGVDb250ZW50KHsga2luZDogJ3RleHRFZGl0JywgdXJpLCBlZGl0czogW10sIGRvbmU6IHRydWUgfSk7XG5cblx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdGNoYXRSZXF1ZXN0LnJlc3BvbnNlLmNvbXBsZXRlKCk7XG5cdH1cblxuXHRjb25zdCBpc1NldHRsZWQgPSBkZXJpdmVkKHIgPT4ge1xuXHRcdGNvbnN0IGVudHJ5ID0gZWRpdFNlc3Npb24ucmVhZEVudHJ5KHVyaSwgcik7XG5cdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBzdGF0ZSA9IGVudHJ5LnN0YXRlLnJlYWQocik7XG5cdFx0cmV0dXJuIHN0YXRlID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5BY2NlcHRlZCB8fCBzdGF0ZSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuUmVqZWN0ZWQ7XG5cdH0pO1xuXG5cdGNvbnN0IHdoZW5EZWNpZGVkID0gd2FpdEZvclN0YXRlKGlzU2V0dGxlZCwgQm9vbGVhbik7XG5cblx0YXdhaXQgcmFjZUNhbmNlbGxhdGlvbih3aGVuRGVjaWRlZCwgdG9rZW4pO1xuXG5cdHN0b3JlLmRpc3Bvc2UoKTtcblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuXG5hc3luYyBmdW5jdGlvbiBtb3ZlVG9QYW5lbENoYXQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1vZGVsOiBDaGF0TW9kZWwgfCB1bmRlZmluZWQpIHtcblxuXHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cblx0Y29uc3Qgd2lkZ2V0ID0gYXdhaXQgc2hvd0NoYXRWaWV3KHZpZXdzU2VydmljZSk7XG5cblx0aWYgKHdpZGdldCAmJiB3aWRnZXQudmlld01vZGVsICYmIG1vZGVsKSB7XG5cdFx0Zm9yIChjb25zdCByZXF1ZXN0IG9mIG1vZGVsLmdldFJlcXVlc3RzKCkuc2xpY2UoKSkge1xuXHRcdFx0YXdhaXQgY2hhdFNlcnZpY2UuYWRvcHRSZXF1ZXN0KHdpZGdldC52aWV3TW9kZWwubW9kZWwuc2Vzc2lvbklkLCByZXF1ZXN0KTtcblx0XHR9XG5cdFx0d2lkZ2V0LmZvY3VzTGFzdE1lc3NhZ2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFVBQVU7QUFDdEIsU0FBUyxTQUFTLGlCQUFpQixPQUFPLHdCQUF3QjtBQUNsRSxTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsaUJBQWlCLG1CQUFtQixvQkFBb0I7QUFDakUsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxTQUFTLGtCQUFrQixTQUFzQixxQkFBcUIsMkJBQTJCLGlCQUFpQixhQUFhLG9CQUFvQjtBQUM1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QUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sUUFBUSxNQUFNLE1BQU0sS0FBSyxDQUFDO0FBQ2hDLFdBQU8sVUFBVSxxQkFBcUIsWUFBWSxVQUFVLHFCQUFxQjtBQUFBLEVBQ2xGLENBQUM7QUFFRCxRQUFNLGNBQWMsYUFBYSxXQUFXLE9BQU87QUFFbkQsUUFBTSxpQkFBaUIsYUFBYSxLQUFLO0FBRXpDLFFBQU0sUUFBUTtBQUVkLFNBQU87QUFDUjtBQUdBLGVBQWUsZ0JBQWdCLFVBQTRCLE9BQThCO0FBRXhGLFFBQU0sZUFBZSxTQUFTLElBQUksYUFBYTtBQUMvQyxRQUFNLGNBQWMsU0FBUyxJQUFJLFlBQVk7QUFFN0MsUUFBTSxTQUFTLE1BQU0sYUFBYSxZQUFZO0FBRTlDLE1BQUksVUFBVSxPQUFPLGFBQWEsT0FBTztBQUN4QyxlQUFXLFdBQVcsTUFBTSxZQUFZLEVBQUUsTUFBTSxHQUFHO0FBQ2xELFlBQU0sWUFBWSxhQUFhLE9BQU8sVUFBVSxNQUFNLFdBQVcsT0FBTztBQUFBLElBQ3pFO0FBQ0EsV0FBTyxpQkFBaUI7QUFBQSxFQUN6QjtBQUNEOyIsCiAgIm5hbWVzIjogWyJTdGF0ZSIsICJNZXNzYWdlIiwgImVkaXRzIiwgImUiXQp9Cg==
