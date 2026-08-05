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
import { Dimension, WindowIntervalTimer, getWindow, scheduleAtNextAnimationFrame, trackFocus } from "../../../../../../base/browser/dom.js";
import { DeferredPromise, Queue, createCancelablePromise, disposableTimeout } from "../../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../../base/common/cancellation.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../../../base/common/map.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { MovingAverage } from "../../../../../../base/common/numbers.js";
import { isEqual } from "../../../../../../base/common/resources.js";
import { StopWatch } from "../../../../../../base/common/stopwatch.js";
import { assertType } from "../../../../../../base/common/types.js";
import { URI } from "../../../../../../base/common/uri.js";
import { CodeEditorWidget } from "../../../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { Selection } from "../../../../../../editor/common/core/selection.js";
import { TextEdit } from "../../../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../../../editor/common/languages/language.js";
import { IEditorWorkerService } from "../../../../../../editor/common/services/editorWorker.js";
import { IModelService } from "../../../../../../editor/common/services/model.js";
import { localize } from "../../../../../../nls.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../../platform/storage/common/storage.js";
import { ChatAgentLocation } from "../../../../chat/common/constants.js";
import { IChatService } from "../../../../chat/common/chatService.js";
import { countWords } from "../../../../chat/common/chatWordCounter.js";
import { InlineChatWidget } from "../../../../inlineChat/browser/inlineChatWidget.js";
import { asProgressiveEdit, performAsyncTextEdit } from "../../../../inlineChat/browser/utils.js";
import { insertCell, runDeleteAction } from "../cellOperations.js";
import { CTX_NOTEBOOK_CELL_CHAT_FOCUSED, CTX_NOTEBOOK_CHAT_HAS_ACTIVE_REQUEST, CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION, CTX_NOTEBOOK_CHAT_USER_DID_EDIT, MENU_CELL_CHAT_WIDGET_STATUS } from "./notebookChatContext.js";
import { registerNotebookContribution } from "../../notebookEditorExtensions.js";
import { CellKind } from "../../../common/notebookCommon.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
class NotebookChatWidget extends Disposable {
  constructor(_notebookEditor, id, notebookViewZone, domNode, widgetContainer, inlineChatWidget, parentEditor, _languageService) {
    super();
    this._notebookEditor = _notebookEditor;
    this.id = id;
    this.notebookViewZone = notebookViewZone;
    this.domNode = domNode;
    this.widgetContainer = widgetContainer;
    this.inlineChatWidget = inlineChatWidget;
    this.parentEditor = parentEditor;
    this._languageService = _languageService;
    this._editingCell = null;
    const updateHeight = () => {
      if (this.heightInPx === inlineChatWidget.contentHeight) {
        return;
      }
      this.heightInPx = inlineChatWidget.contentHeight;
      this._notebookEditor.changeViewZones((accessor) => {
        accessor.layoutZone(id);
      });
      this._layoutWidget(inlineChatWidget, widgetContainer);
    };
    this._register(inlineChatWidget.onDidChangeHeight(() => {
      updateHeight();
    }));
    this._register(inlineChatWidget.chatWidget.onDidChangeHeight(() => {
      updateHeight();
    }));
    this.heightInPx = inlineChatWidget.contentHeight;
    this._layoutWidget(inlineChatWidget, widgetContainer);
  }
  set afterModelPosition(afterModelPosition) {
    this.notebookViewZone.afterModelPosition = afterModelPosition;
  }
  get afterModelPosition() {
    return this.notebookViewZone.afterModelPosition;
  }
  set heightInPx(heightInPx) {
    this.notebookViewZone.heightInPx = heightInPx;
  }
  get heightInPx() {
    return this.notebookViewZone.heightInPx;
  }
  get editingCell() {
    return this._editingCell;
  }
  layout() {
    this._layoutWidget(this.inlineChatWidget, this.widgetContainer);
  }
  restoreEditingCell(initEditingCell) {
    this._editingCell = initEditingCell;
    const decorationIds = this._notebookEditor.deltaCellDecorations([], [{
      handle: this._editingCell.handle,
      options: { className: "nb-chatGenerationHighlight", outputClassName: "nb-chatGenerationHighlight" }
    }]);
    this._register(toDisposable(() => {
      this._notebookEditor.deltaCellDecorations(decorationIds, []);
    }));
  }
  hasFocus() {
    return this.inlineChatWidget.hasFocus();
  }
  focus() {
    this.updateNotebookEditorFocusNSelections();
    this.inlineChatWidget.focus();
  }
  updateNotebookEditorFocusNSelections() {
    this._notebookEditor.focusContainer(true);
    this._notebookEditor.setFocus({ start: this.afterModelPosition, end: this.afterModelPosition });
    this._notebookEditor.setSelections([{
      start: this.afterModelPosition,
      end: this.afterModelPosition
    }]);
  }
  getEditingCell() {
    return this._editingCell;
  }
  async getOrCreateEditingCell() {
    if (this._editingCell) {
      const codeEditor2 = this._notebookEditor.codeEditors.find((ce) => ce[0] === this._editingCell)?.[1];
      if (codeEditor2?.hasModel()) {
        return {
          cell: this._editingCell,
          editor: codeEditor2
        };
      } else {
        return void 0;
      }
    }
    if (!this._notebookEditor.hasModel()) {
      return void 0;
    }
    const widgetHasFocus = this.inlineChatWidget.hasFocus();
    this._editingCell = insertCell(this._languageService, this._notebookEditor, this.afterModelPosition, CellKind.Code, "above");
    if (!this._editingCell) {
      return void 0;
    }
    await this._notebookEditor.revealFirstLineIfOutsideViewport(this._editingCell);
    const decorationIds = this._notebookEditor.deltaCellDecorations([], [{
      handle: this._editingCell.handle,
      options: { className: "nb-chatGenerationHighlight", outputClassName: "nb-chatGenerationHighlight" }
    }]);
    this._register(toDisposable(() => {
      this._notebookEditor.deltaCellDecorations(decorationIds, []);
    }));
    if (widgetHasFocus) {
      this.focus();
    }
    const codeEditor = this._notebookEditor.codeEditors.find((ce) => ce[0] === this._editingCell)?.[1];
    if (codeEditor?.hasModel()) {
      return {
        cell: this._editingCell,
        editor: codeEditor
      };
    }
    return void 0;
  }
  async discardChange() {
    if (this._notebookEditor.hasModel() && this._editingCell) {
      runDeleteAction(this._notebookEditor, this._editingCell);
    }
  }
  _layoutWidget(inlineChatWidget, widgetContainer) {
    const layoutConfiguration = this._notebookEditor.notebookOptions.getLayoutConfiguration();
    const rightMargin = layoutConfiguration.cellRightMargin;
    const leftMargin = this._notebookEditor.notebookOptions.getCellEditorContainerLeftMargin();
    const maxWidth = 640;
    const width = Math.min(maxWidth, this._notebookEditor.getLayoutInfo().width - leftMargin - rightMargin);
    inlineChatWidget.layout(new Dimension(width, this.heightInPx));
    inlineChatWidget.domNode.style.width = `${width}px`;
    widgetContainer.style.left = `${leftMargin}px`;
  }
  dispose() {
    this._notebookEditor.changeViewZones((accessor) => {
      accessor.removeZone(this.id);
    });
    this.domNode.remove();
    super.dispose();
  }
}
class NotebookCellTextModelLikeId {
  static str(k) {
    return `${k.viewType}/${k.uri.toString()}`;
  }
  static obj(s) {
    const idx = s.indexOf("/");
    return {
      viewType: s.substring(0, idx),
      uri: URI.parse(s.substring(idx + 1))
    };
  }
}
let NotebookChatController = class extends Disposable {
  constructor(_notebookEditor, _instantiationService, _contextKeyService, _editorWorkerService, _modelService, _languageService, _executionStateService, _storageService, _chatService) {
    super();
    this._notebookEditor = _notebookEditor;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._editorWorkerService = _editorWorkerService;
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._executionStateService = _executionStateService;
    this._storageService = _storageService;
    this._chatService = _chatService;
    this._historyOffset = -1;
    this._historyCandidate = "";
    this._promptCache = new LRUCache(1e3, 0.7);
    this._onDidChangePromptCache = this._register(new Emitter());
    this.onDidChangePromptCache = this._onDidChangePromptCache.event;
    this._userEditingDisposables = this._register(new DisposableStore());
    this._widgetDisposableStore = this._register(new DisposableStore());
    this._model = this._register(new MutableDisposable());
    this._ctxHasActiveRequest = CTX_NOTEBOOK_CHAT_HAS_ACTIVE_REQUEST.bindTo(this._contextKeyService);
    this._ctxCellWidgetFocused = CTX_NOTEBOOK_CELL_CHAT_FOCUSED.bindTo(this._contextKeyService);
    this._ctxUserDidEdit = CTX_NOTEBOOK_CHAT_USER_DID_EDIT.bindTo(this._contextKeyService);
    this._ctxOuterFocusPosition = CTX_NOTEBOOK_CHAT_OUTER_FOCUS_POSITION.bindTo(this._contextKeyService);
    this._registerFocusTracker();
    NotebookChatController._promptHistory = JSON.parse(this._storageService.get(NotebookChatController._storageKey, StorageScope.PROFILE, "[]"));
    this._historyUpdate = (prompt) => {
      const idx = NotebookChatController._promptHistory.indexOf(prompt);
      if (idx >= 0) {
        NotebookChatController._promptHistory.splice(idx, 1);
      }
      NotebookChatController._promptHistory.unshift(prompt);
      this._historyOffset = -1;
      this._historyCandidate = "";
      this._storageService.store(NotebookChatController._storageKey, JSON.stringify(NotebookChatController._promptHistory), StorageScope.PROFILE, StorageTarget.USER);
    };
  }
  static get(editor) {
    return editor.getContribution(NotebookChatController.id);
  }
  _registerFocusTracker() {
    this._register(this._notebookEditor.onDidChangeFocus(() => {
      if (!this._widget) {
        this._ctxOuterFocusPosition.set("");
        return;
      }
      const widgetIndex = this._widget.afterModelPosition;
      const focus = this._notebookEditor.getFocus().start;
      if (focus + 1 === widgetIndex) {
        this._ctxOuterFocusPosition.set("above");
      } else if (focus === widgetIndex) {
        this._ctxOuterFocusPosition.set("below");
      } else {
        this._ctxOuterFocusPosition.set("");
      }
    }));
  }
  run(index, input, autoSend) {
    if (this._widget) {
      if (this._widget.afterModelPosition !== index) {
        const window = getWindow(this._widget.domNode);
        this._disposeWidget();
        scheduleAtNextAnimationFrame(window, () => {
          this._createWidget(index, input, autoSend, void 0);
        });
      }
      return;
    }
    this._createWidget(index, input, autoSend, void 0);
  }
  restore(editingCell, input) {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    const index = this._notebookEditor.textModel.cells.indexOf(editingCell.model);
    if (index < 0) {
      return;
    }
    if (this._widget) {
      if (this._widget.afterModelPosition !== index) {
        this._disposeWidget();
        const window = getWindow(this._widget.domNode);
        scheduleAtNextAnimationFrame(window, () => {
          this._createWidget(index, input, false, editingCell);
        });
      }
      return;
    }
    this._createWidget(index, input, false, editingCell);
  }
  _disposeWidget() {
    this._widget?.dispose();
    this._widget = void 0;
    this._widgetDisposableStore.clear();
    this._historyOffset = -1;
    this._historyCandidate = "";
  }
  _createWidget(index, input, autoSend, initEditingCell) {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    this._widgetDisposableStore.clear();
    const viewZoneContainer = document.createElement("div");
    viewZoneContainer.classList.add("monaco-editor");
    const widgetContainer = document.createElement("div");
    widgetContainer.style.position = "absolute";
    viewZoneContainer.appendChild(widgetContainer);
    this._focusTracker = this._widgetDisposableStore.add(trackFocus(viewZoneContainer));
    this._widgetDisposableStore.add(this._focusTracker.onDidFocus(() => {
      this._updateNotebookEditorFocusNSelections();
    }));
    const fakeParentEditorElement = document.createElement("div");
    const fakeParentEditor = this._widgetDisposableStore.add(this._instantiationService.createInstance(
      CodeEditorWidget,
      fakeParentEditorElement,
      {},
      { isSimpleWidget: true }
    ));
    const inputBoxFragment = `notebook-chat-input-${NotebookChatController.counter++}`;
    const notebookUri = this._notebookEditor.textModel.uri;
    const inputUri = notebookUri.with({ scheme: Schemas.untitled, fragment: inputBoxFragment });
    const result = this._modelService.createModel("", null, inputUri, false);
    fakeParentEditor.setModel(result);
    const inlineChatWidget = this._widgetDisposableStore.add(this._instantiationService.createInstance(
      InlineChatWidget,
      {
        location: ChatAgentLocation.Notebook,
        resolveData: () => {
          const sessionInputUri = this.getSessionInputUri();
          if (!sessionInputUri) {
            return void 0;
          }
          return {
            type: ChatAgentLocation.Notebook,
            sessionInputUri
          };
        }
      },
      {
        statusMenuId: MENU_CELL_CHAT_WIDGET_STATUS,
        chatWidgetViewOptions: {
          rendererOptions: {
            renderTextEditsAsSummary: (uri) => {
              return isEqual(uri, this._widget?.parentEditor.getModel()?.uri) || isEqual(uri, this._notebookEditor.textModel?.uri);
            }
          },
          menus: {
            telemetrySource: "notebook-generate-cell"
          }
        }
      }
    ));
    inlineChatWidget.placeholder = localize("default.placeholder", "Ask a question");
    inlineChatWidget.updateInfo(localize("welcome.1", "AI-generated code may be incorrect"));
    widgetContainer.appendChild(inlineChatWidget.domNode);
    this._notebookEditor.changeViewZones((accessor) => {
      const notebookViewZone = {
        afterModelPosition: index,
        heightInPx: 80,
        domNode: viewZoneContainer
      };
      const id = accessor.addZone(notebookViewZone);
      this._scrollWidgetIntoView(index);
      this._widget = new NotebookChatWidget(
        this._notebookEditor,
        id,
        notebookViewZone,
        viewZoneContainer,
        widgetContainer,
        inlineChatWidget,
        fakeParentEditor,
        this._languageService
      );
      if (initEditingCell) {
        this._widget.restoreEditingCell(initEditingCell);
        this._updateUserEditingState();
      }
      this._ctxCellWidgetFocused.set(true);
      disposableTimeout(() => {
        this._focusWidget();
      }, 0, this._store);
      this._sessionCtor = createCancelablePromise(async (token) => {
        await this._startSession(token);
        assertType(this._model.value);
        const model = this._model.value;
        this._widget?.inlineChatWidget.setChatModel(model);
        if (fakeParentEditor.hasModel()) {
          if (this._widget) {
            this._focusWidget();
          }
          if (this._widget && input) {
            this._widget.inlineChatWidget.value = input;
            if (autoSend) {
              this.acceptInput();
            }
          }
        }
      });
    });
  }
  async _startSession(token) {
    if (!this._model.value) {
      this._model.value = this._chatService.startSession(ChatAgentLocation.Editor, token);
      if (!this._model.value) {
        throw new Error("Failed to start chat session");
      }
    }
    this._strategy = new EditStrategy();
  }
  _scrollWidgetIntoView(index) {
    if (index === 0 || this._notebookEditor.getLength() === 0) {
      this._notebookEditor.revealOffsetInCenterIfOutsideViewport(0);
    } else {
      const previousCell = this._notebookEditor.cellAt(Math.min(index - 1, this._notebookEditor.getLength() - 1));
      if (previousCell) {
        const cellTop = this._notebookEditor.getAbsoluteTopOfElement(previousCell);
        const cellHeight = this._notebookEditor.getHeightOfElement(previousCell);
        this._notebookEditor.revealOffsetInCenterIfOutsideViewport(
          cellTop + cellHeight + 48
          /** center of the dialog */
        );
      }
    }
  }
  _focusWidget() {
    if (!this._widget) {
      return;
    }
    this._updateNotebookEditorFocusNSelections();
    this._widget.focus();
  }
  _updateNotebookEditorFocusNSelections() {
    if (!this._widget) {
      return;
    }
    this._widget.updateNotebookEditorFocusNSelections();
  }
  hasSession(chatModel) {
    return this._model.value === chatModel;
  }
  getSessionInputUri() {
    return this._widget?.parentEditor.getModel()?.uri;
  }
  async acceptInput() {
    assertType(this._widget);
    await this._sessionCtor;
    assertType(this._model.value);
    assertType(this._strategy);
    const lastInput = this._widget.inlineChatWidget.value;
    this._historyUpdate(lastInput);
    const editor = this._widget.parentEditor;
    const textModel = editor.getModel();
    if (!editor.hasModel() || !textModel) {
      return;
    }
    if (this._widget.editingCell && this._widget.editingCell.textBuffer.getLength() > 0) {
      const ref = await this._widget.editingCell.resolveTextModel();
      ref.setValue("");
    }
    const editingCellIndex = this._widget.editingCell ? this._notebookEditor.getCellIndex(this._widget.editingCell) : void 0;
    if (editingCellIndex !== void 0) {
      this._notebookEditor.setSelections([{
        start: editingCellIndex,
        end: editingCellIndex + 1
      }]);
    } else {
      this._notebookEditor.setSelections([{
        start: this._widget.afterModelPosition,
        end: this._widget.afterModelPosition
      }]);
    }
    this._ctxHasActiveRequest.set(true);
    this._activeRequestCts?.cancel();
    this._activeRequestCts = new CancellationTokenSource();
    const store = new DisposableStore();
    try {
      this._ctxHasActiveRequest.set(true);
      const progressiveEditsQueue = new Queue();
      const progressiveEditsClock = StopWatch.create();
      const progressiveEditsAvgDuration = new MovingAverage();
      const progressiveEditsCts = new CancellationTokenSource(this._activeRequestCts.token);
      const responsePromise = new DeferredPromise();
      const response = await this._widget.inlineChatWidget.chatWidget.acceptInput();
      if (response) {
        let lastLength = 0;
        store.add(response.onDidChange((e) => {
          if (response.isCanceled) {
            progressiveEditsCts.cancel();
            responsePromise.complete();
            return;
          }
          if (response.isComplete) {
            responsePromise.complete();
            return;
          }
          const edits = response.response.value.map((part) => {
            if (part.kind === "textEditGroup") {
              return part.edits;
            } else {
              return [];
            }
          }).flat();
          const newEdits = edits.slice(lastLength);
          if (newEdits.length === 0) {
            return;
          }
          lastLength = edits.length;
          progressiveEditsAvgDuration.update(progressiveEditsClock.elapsed());
          progressiveEditsClock.reset();
          progressiveEditsQueue.queue(async () => {
            for (const edits2 of newEdits) {
              await this._makeChanges(edits2, {
                duration: progressiveEditsAvgDuration.value,
                token: progressiveEditsCts.token
              });
            }
          });
        }));
      }
      await responsePromise.p;
      await progressiveEditsQueue.whenIdle();
      this._userEditingDisposables.clear();
      const editingCell = this._widget.getEditingCell();
      if (editingCell) {
        this._userEditingDisposables.add(editingCell.model.onDidChangeContent(() => this._updateUserEditingState()));
        this._userEditingDisposables.add(editingCell.model.onDidChangeLanguage(() => this._updateUserEditingState()));
        this._userEditingDisposables.add(editingCell.model.onDidChangeMetadata(() => this._updateUserEditingState()));
        this._userEditingDisposables.add(editingCell.model.onDidChangeInternalMetadata(() => this._updateUserEditingState()));
        this._userEditingDisposables.add(editingCell.model.onDidChangeOutputs(() => this._updateUserEditingState()));
        this._userEditingDisposables.add(this._executionStateService.onDidChangeExecution((e) => {
          if (e.type === NotebookExecutionType.cell && e.affectsCell(editingCell.uri)) {
            this._updateUserEditingState();
          }
        }));
      }
    } catch (e) {
    } finally {
      store.dispose();
      this._ctxHasActiveRequest.set(false);
      this._widget.inlineChatWidget.updateInfo("");
      this._widget.inlineChatWidget.updateToolbar(true);
    }
  }
  async _makeChanges(edits, opts) {
    assertType(this._strategy);
    assertType(this._widget);
    const editingCell = await this._widget.getOrCreateEditingCell();
    if (!editingCell) {
      return;
    }
    const editor = editingCell.editor;
    const moreMinimalEdits = await this._editorWorkerService.computeMoreMinimalEdits(editor.getModel().uri, edits);
    if (moreMinimalEdits?.length === 0) {
      return;
    }
    const actualEdits = !opts && moreMinimalEdits ? moreMinimalEdits : edits;
    const editOperations = actualEdits.map(TextEdit.asEditOperation);
    try {
      if (opts) {
        await this._strategy.makeProgressiveChanges(editor, editOperations, opts);
      } else {
        await this._strategy.makeChanges(editor, editOperations);
      }
    } finally {
    }
  }
  _updateUserEditingState() {
    this._ctxUserDidEdit.set(true);
  }
  async acceptSession() {
    assertType(this._model);
    assertType(this._strategy);
    const editor = this._widget?.parentEditor;
    if (!editor?.hasModel()) {
      return;
    }
    const editingCell = this._widget?.getEditingCell();
    if (editingCell && this._notebookEditor.hasModel()) {
      const cellId = NotebookCellTextModelLikeId.str({ uri: editingCell.uri, viewType: this._notebookEditor.textModel.viewType });
      if (this._widget?.inlineChatWidget.value) {
        this._promptCache.set(cellId, this._widget.inlineChatWidget.value);
      }
      this._onDidChangePromptCache.fire({ cell: editingCell.uri });
    }
    try {
      this._model.clear();
    } catch (_err) {
    }
    this.dismiss(false);
  }
  async focusAbove() {
    if (!this._widget) {
      return;
    }
    const index = this._widget.afterModelPosition;
    const prev = index - 1;
    if (prev < 0) {
      return;
    }
    const cell = this._notebookEditor.cellAt(prev);
    if (!cell) {
      return;
    }
    await this._notebookEditor.focusNotebookCell(cell, "editor");
  }
  async focusNext() {
    if (!this._widget) {
      return;
    }
    const index = this._widget.afterModelPosition;
    const cell = this._notebookEditor.cellAt(index);
    if (!cell) {
      return;
    }
    await this._notebookEditor.focusNotebookCell(cell, "editor");
  }
  hasFocus() {
    return this._widget?.hasFocus() ?? false;
  }
  focus() {
    this._focusWidget();
  }
  focusNearestWidget(index, direction) {
    switch (direction) {
      case "above":
        if (this._widget?.afterModelPosition === index) {
          this._focusWidget();
        }
        break;
      case "below":
        if (this._widget?.afterModelPosition === index + 1) {
          this._focusWidget();
        }
        break;
      default:
        break;
    }
  }
  populateHistory(up) {
    if (!this._widget) {
      return;
    }
    const len = NotebookChatController._promptHistory.length;
    if (len === 0) {
      return;
    }
    if (this._historyOffset === -1) {
      this._historyCandidate = this._widget.inlineChatWidget.value;
    }
    const newIdx = this._historyOffset + (up ? 1 : -1);
    if (newIdx >= len) {
      return;
    }
    let entry;
    if (newIdx < 0) {
      entry = this._historyCandidate;
      this._historyOffset = -1;
    } else {
      entry = NotebookChatController._promptHistory[newIdx];
      this._historyOffset = newIdx;
    }
    this._widget.inlineChatWidget.value = entry;
    this._widget.inlineChatWidget.selectAll();
  }
  async cancelCurrentRequest(discard) {
    this._activeRequestCts?.cancel();
  }
  getEditingCell() {
    return this._widget?.getEditingCell();
  }
  discard() {
    this._activeRequestCts?.cancel();
    this._widget?.discardChange();
    this.dismiss(true);
  }
  dismiss(discard) {
    const widget = this._widget;
    const widgetIndex = widget?.afterModelPosition;
    const currentFocus = this._notebookEditor.getFocus();
    const isWidgetFocused = currentFocus.start === widgetIndex && currentFocus.end === widgetIndex;
    if (widget && isWidgetFocused) {
      const editingCell = widget.getEditingCell();
      const shouldFocusEditingCell = editingCell && !discard;
      const shouldFocusTopCell = widgetIndex === 0 && this._notebookEditor.getLength() > 0;
      const shouldFocusAboveCell = widgetIndex !== 0 && this._notebookEditor.cellAt(widgetIndex - 1);
      if (shouldFocusEditingCell) {
        this._notebookEditor.focusNotebookCell(editingCell, "container");
      } else if (shouldFocusTopCell) {
        this._notebookEditor.focusNotebookCell(this._notebookEditor.cellAt(0), "container");
      } else if (shouldFocusAboveCell) {
        this._notebookEditor.focusNotebookCell(this._notebookEditor.cellAt(widgetIndex - 1), "container");
      }
    }
    this._ctxCellWidgetFocused.set(false);
    this._ctxUserDidEdit.set(false);
    this._sessionCtor?.cancel();
    this._sessionCtor = void 0;
    this._model.clear();
    this._widget?.dispose();
    this._widget = void 0;
    this._widgetDisposableStore.clear();
  }
  // check if a cell is generated by prompt by checking prompt cache
  isCellGeneratedByChat(cell) {
    if (!this._notebookEditor.hasModel()) {
      return false;
    }
    const cellId = NotebookCellTextModelLikeId.str({ uri: cell.uri, viewType: this._notebookEditor.textModel.viewType });
    return this._promptCache.has(cellId);
  }
  // get prompt from cache
  getPromptFromCache(cell) {
    if (!this._notebookEditor.hasModel()) {
      return void 0;
    }
    const cellId = NotebookCellTextModelLikeId.str({ uri: cell.uri, viewType: this._notebookEditor.textModel.viewType });
    return this._promptCache.get(cellId);
  }
  dispose() {
    this.dismiss(false);
    super.dispose();
  }
};
NotebookChatController.id = "workbench.notebook.chatController";
NotebookChatController.counter = 0;
// History
NotebookChatController._storageKey = "inline-chat-history";
NotebookChatController._promptHistory = [];
NotebookChatController = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IEditorWorkerService),
  __decorateParam(4, IModelService),
  __decorateParam(5, ILanguageService),
  __decorateParam(6, INotebookExecutionStateService),
  __decorateParam(7, IStorageService),
  __decorateParam(8, IChatService)
], NotebookChatController);
class EditStrategy {
  constructor() {
    this._editCount = 0;
  }
  async makeProgressiveChanges(editor, edits, opts) {
    if (++this._editCount === 1) {
      editor.pushUndoStop();
    }
    const durationInSec = opts.duration / 1e3;
    for (const edit of edits) {
      const wordCount = countWords(edit.text ?? "");
      const speed = wordCount / durationInSec;
      await performAsyncTextEdit(editor.getModel(), asProgressiveEdit(new WindowIntervalTimer(), edit, speed, opts.token));
    }
  }
  async makeChanges(editor, edits) {
    const cursorStateComputerAndInlineDiffCollection = (undoEdits) => {
      let last = null;
      for (const edit of undoEdits) {
        last = !last || last.isBefore(edit.range.getEndPosition()) ? edit.range.getEndPosition() : last;
      }
      return last && [Selection.fromPositions(last)];
    };
    if (++this._editCount === 1) {
      editor.pushUndoStop();
    }
    editor.executeEdits("inline-chat-live", edits, cursorStateComputerAndInlineDiffCollection);
  }
}
registerNotebookContribution(NotebookChatController.id, NotebookChatController);
export {
  EditStrategy,
  NotebookChatController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvY2hhdC9ub3RlYm9va0NoYXRDb250cm9sbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGltZW5zaW9uLCBJRm9jdXNUcmFja2VyLCBXaW5kb3dJbnRlcnZhbFRpbWVyLCBnZXRXaW5kb3csIHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUsIHRyYWNrRm9jdXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBEZWZlcnJlZFByb21pc2UsIFF1ZXVlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgZGlzcG9zYWJsZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMUlVDYWNoZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBNb3ZpbmdBdmVyYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9lZGl0T3BlcmF0aW9uLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgVGV4dEVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUN1cnNvclN0YXRlQ29tcHV0ZXIsIElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElFZGl0b3JXb3JrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGVsLCBJQ2hhdE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvdW50V29yZHMgfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0V29yZENvdW50ZXIuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3NpbmdFZGl0c09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFN0cmF0ZWdpZXMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ2hhdFdpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IGFzUHJvZ3Jlc3NpdmVFZGl0LCBwZXJmb3JtQXN5bmNUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci91dGlscy5qcyc7XG5pbXBvcnQgeyBpbnNlcnRDZWxsLCBydW5EZWxldGVBY3Rpb24gfSBmcm9tICcuLi9jZWxsT3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQsIENUWF9OT1RFQk9PS19DSEFUX0hBU19BQ1RJVkVfUkVRVUVTVCwgQ1RYX05PVEVCT09LX0NIQVRfT1VURVJfRk9DVVNfUE9TSVRJT04sIENUWF9OT1RFQk9PS19DSEFUX1VTRVJfRElEX0VESVQsIE1FTlVfQ0VMTF9DSEFUX1dJREdFVF9TVEFUVVMgfSBmcm9tICcuL25vdGVib29rQ2hhdENvbnRleHQuanMnO1xuaW1wb3J0IHsgSUNlbGxWaWV3TW9kZWwsIElOb3RlYm9va0VkaXRvciwgSU5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uLCBJTm90ZWJvb2tWaWV3Wm9uZSB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck5vdGVib29rQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tFZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENlbGxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLmpzJztcblxuY2xhc3MgTm90ZWJvb2tDaGF0V2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElOb3RlYm9va1ZpZXdab25lIHtcblx0c2V0IGFmdGVyTW9kZWxQb3NpdGlvbihhZnRlck1vZGVsUG9zaXRpb246IG51bWJlcikge1xuXHRcdHRoaXMubm90ZWJvb2tWaWV3Wm9uZS5hZnRlck1vZGVsUG9zaXRpb24gPSBhZnRlck1vZGVsUG9zaXRpb247XG5cdH1cblxuXHRnZXQgYWZ0ZXJNb2RlbFBvc2l0aW9uKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMubm90ZWJvb2tWaWV3Wm9uZS5hZnRlck1vZGVsUG9zaXRpb247XG5cdH1cblxuXHRzZXQgaGVpZ2h0SW5QeChoZWlnaHRJblB4OiBudW1iZXIpIHtcblx0XHR0aGlzLm5vdGVib29rVmlld1pvbmUuaGVpZ2h0SW5QeCA9IGhlaWdodEluUHg7XG5cdH1cblxuXHRnZXQgaGVpZ2h0SW5QeCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLm5vdGVib29rVmlld1pvbmUuaGVpZ2h0SW5QeDtcblx0fVxuXG5cdHByaXZhdGUgX2VkaXRpbmdDZWxsOiBJQ2VsbFZpZXdNb2RlbCB8IG51bGwgPSBudWxsO1xuXG5cdGdldCBlZGl0aW5nQ2VsbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdGluZ0NlbGw7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yLFxuXHRcdHJlYWRvbmx5IGlkOiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2tWaWV3Wm9uZTogSU5vdGVib29rVmlld1pvbmUsXG5cdFx0cmVhZG9ubHkgZG9tTm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgd2lkZ2V0Q29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRyZWFkb25seSBpbmxpbmVDaGF0V2lkZ2V0OiBJbmxpbmVDaGF0V2lkZ2V0LFxuXHRcdHJlYWRvbmx5IHBhcmVudEVkaXRvcjogQ29kZUVkaXRvcldpZGdldCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCB1cGRhdGVIZWlnaHQgPSAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5oZWlnaHRJblB4ID09PSBpbmxpbmVDaGF0V2lkZ2V0LmNvbnRlbnRIZWlnaHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmhlaWdodEluUHggPSBpbmxpbmVDaGF0V2lkZ2V0LmNvbnRlbnRIZWlnaHQ7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5sYXlvdXRab25lKGlkKTtcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fbGF5b3V0V2lkZ2V0KGlubGluZUNoYXRXaWRnZXQsIHdpZGdldENvbnRhaW5lcik7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGlubGluZUNoYXRXaWRnZXQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4ge1xuXHRcdFx0dXBkYXRlSGVpZ2h0KCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoaW5saW5lQ2hhdFdpZGdldC5jaGF0V2lkZ2V0Lm9uRGlkQ2hhbmdlSGVpZ2h0KCgpID0+IHtcblx0XHRcdHVwZGF0ZUhlaWdodCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuaGVpZ2h0SW5QeCA9IGlubGluZUNoYXRXaWRnZXQuY29udGVudEhlaWdodDtcblx0XHR0aGlzLl9sYXlvdXRXaWRnZXQoaW5saW5lQ2hhdFdpZGdldCwgd2lkZ2V0Q29udGFpbmVyKTtcblx0fVxuXG5cdGxheW91dCgpIHtcblx0XHR0aGlzLl9sYXlvdXRXaWRnZXQodGhpcy5pbmxpbmVDaGF0V2lkZ2V0LCB0aGlzLndpZGdldENvbnRhaW5lcik7XG5cdH1cblxuXHRyZXN0b3JlRWRpdGluZ0NlbGwoaW5pdEVkaXRpbmdDZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdHRoaXMuX2VkaXRpbmdDZWxsID0gaW5pdEVkaXRpbmdDZWxsO1xuXG5cdFx0Y29uc3QgZGVjb3JhdGlvbklkcyA9IHRoaXMuX25vdGVib29rRWRpdG9yLmRlbHRhQ2VsbERlY29yYXRpb25zKFtdLCBbe1xuXHRcdFx0aGFuZGxlOiB0aGlzLl9lZGl0aW5nQ2VsbC5oYW5kbGUsXG5cdFx0XHRvcHRpb25zOiB7IGNsYXNzTmFtZTogJ25iLWNoYXRHZW5lcmF0aW9uSGlnaGxpZ2h0Jywgb3V0cHV0Q2xhc3NOYW1lOiAnbmItY2hhdEdlbmVyYXRpb25IaWdobGlnaHQnIH1cblx0XHR9XSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsRGVjb3JhdGlvbnMoZGVjb3JhdGlvbklkcywgW10pO1xuXHRcdH0pKTtcblx0fVxuXG5cdGhhc0ZvY3VzKCkge1xuXHRcdHJldHVybiB0aGlzLmlubGluZUNoYXRXaWRnZXQuaGFzRm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzKCkge1xuXHRcdHRoaXMudXBkYXRlTm90ZWJvb2tFZGl0b3JGb2N1c05TZWxlY3Rpb25zKCk7XG5cdFx0dGhpcy5pbmxpbmVDaGF0V2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHR1cGRhdGVOb3RlYm9va0VkaXRvckZvY3VzTlNlbGVjdGlvbnMoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuZm9jdXNDb250YWluZXIodHJ1ZSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3Iuc2V0Rm9jdXMoeyBzdGFydDogdGhpcy5hZnRlck1vZGVsUG9zaXRpb24sIGVuZDogdGhpcy5hZnRlck1vZGVsUG9zaXRpb24gfSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3Iuc2V0U2VsZWN0aW9ucyhbe1xuXHRcdFx0c3RhcnQ6IHRoaXMuYWZ0ZXJNb2RlbFBvc2l0aW9uLFxuXHRcdFx0ZW5kOiB0aGlzLmFmdGVyTW9kZWxQb3NpdGlvblxuXHRcdH1dKTtcblx0fVxuXG5cdGdldEVkaXRpbmdDZWxsKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0aW5nQ2VsbDtcblx0fVxuXG5cdGFzeW5jIGdldE9yQ3JlYXRlRWRpdGluZ0NlbGwoKTogUHJvbWlzZTx7IGNlbGw6IElDZWxsVmlld01vZGVsOyBlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yIH0gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5fZWRpdGluZ0NlbGwpIHtcblx0XHRcdGNvbnN0IGNvZGVFZGl0b3IgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5jb2RlRWRpdG9ycy5maW5kKGNlID0+IGNlWzBdID09PSB0aGlzLl9lZGl0aW5nQ2VsbCk/LlsxXTtcblx0XHRcdGlmIChjb2RlRWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y2VsbDogdGhpcy5fZWRpdGluZ0NlbGwsXG5cdFx0XHRcdFx0ZWRpdG9yOiBjb2RlRWRpdG9yXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB3aWRnZXRIYXNGb2N1cyA9IHRoaXMuaW5saW5lQ2hhdFdpZGdldC5oYXNGb2N1cygpO1xuXG5cdFx0dGhpcy5fZWRpdGluZ0NlbGwgPSBpbnNlcnRDZWxsKHRoaXMuX2xhbmd1YWdlU2VydmljZSwgdGhpcy5fbm90ZWJvb2tFZGl0b3IsIHRoaXMuYWZ0ZXJNb2RlbFBvc2l0aW9uLCBDZWxsS2luZC5Db2RlLCAnYWJvdmUnKTtcblxuXHRcdGlmICghdGhpcy5fZWRpdGluZ0NlbGwpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fbm90ZWJvb2tFZGl0b3IucmV2ZWFsRmlyc3RMaW5lSWZPdXRzaWRlVmlld3BvcnQodGhpcy5fZWRpdGluZ0NlbGwpO1xuXG5cdFx0Ly8gdXBkYXRlIGRlY29yYXRpb25cblx0XHRjb25zdCBkZWNvcmF0aW9uSWRzID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsRGVjb3JhdGlvbnMoW10sIFt7XG5cdFx0XHRoYW5kbGU6IHRoaXMuX2VkaXRpbmdDZWxsLmhhbmRsZSxcblx0XHRcdG9wdGlvbnM6IHsgY2xhc3NOYW1lOiAnbmItY2hhdEdlbmVyYXRpb25IaWdobGlnaHQnLCBvdXRwdXRDbGFzc05hbWU6ICduYi1jaGF0R2VuZXJhdGlvbkhpZ2hsaWdodCcgfVxuXHRcdH1dKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5kZWx0YUNlbGxEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzLCBbXSk7XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHdpZGdldEhhc0ZvY3VzKSB7XG5cdFx0XHR0aGlzLmZvY3VzKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29kZUVkaXRvciA9IHRoaXMuX25vdGVib29rRWRpdG9yLmNvZGVFZGl0b3JzLmZpbmQoY2UgPT4gY2VbMF0gPT09IHRoaXMuX2VkaXRpbmdDZWxsKT8uWzFdO1xuXHRcdGlmIChjb2RlRWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjZWxsOiB0aGlzLl9lZGl0aW5nQ2VsbCxcblx0XHRcdFx0ZWRpdG9yOiBjb2RlRWRpdG9yXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBkaXNjYXJkQ2hhbmdlKCkge1xuXHRcdGlmICh0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpICYmIHRoaXMuX2VkaXRpbmdDZWxsKSB7XG5cdFx0XHQvLyByZW1vdmUgdGhlIGNlbGwgZnJvbSB0aGUgbm90ZWJvb2tcblx0XHRcdHJ1bkRlbGV0ZUFjdGlvbih0aGlzLl9ub3RlYm9va0VkaXRvciwgdGhpcy5fZWRpdGluZ0NlbGwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2xheW91dFdpZGdldChpbmxpbmVDaGF0V2lkZ2V0OiBJbmxpbmVDaGF0V2lkZ2V0LCB3aWRnZXRDb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgbGF5b3V0Q29uZmlndXJhdGlvbiA9IHRoaXMuX25vdGVib29rRWRpdG9yLm5vdGVib29rT3B0aW9ucy5nZXRMYXlvdXRDb25maWd1cmF0aW9uKCk7XG5cdFx0Y29uc3QgcmlnaHRNYXJnaW4gPSBsYXlvdXRDb25maWd1cmF0aW9uLmNlbGxSaWdodE1hcmdpbjtcblx0XHRjb25zdCBsZWZ0TWFyZ2luID0gdGhpcy5fbm90ZWJvb2tFZGl0b3Iubm90ZWJvb2tPcHRpb25zLmdldENlbGxFZGl0b3JDb250YWluZXJMZWZ0TWFyZ2luKCk7XG5cdFx0Y29uc3QgbWF4V2lkdGggPSA2NDA7XG5cdFx0Y29uc3Qgd2lkdGggPSBNYXRoLm1pbihtYXhXaWR0aCwgdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLndpZHRoIC0gbGVmdE1hcmdpbiAtIHJpZ2h0TWFyZ2luKTtcblxuXHRcdGlubGluZUNoYXRXaWRnZXQubGF5b3V0KG5ldyBEaW1lbnNpb24od2lkdGgsIHRoaXMuaGVpZ2h0SW5QeCkpO1xuXHRcdGlubGluZUNoYXRXaWRnZXQuZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHR3aWRnZXRDb250YWluZXIuc3R5bGUubGVmdCA9IGAke2xlZnRNYXJnaW59cHhgO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoYWNjZXNzb3IgPT4ge1xuXHRcdFx0YWNjZXNzb3IucmVtb3ZlWm9uZSh0aGlzLmlkKTtcblx0XHR9KTtcblx0XHR0aGlzLmRvbU5vZGUucmVtb3ZlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ2VsbFRleHRNb2RlbExpa2UgeyB1cmk6IFVSSTsgdmlld1R5cGU6IHN0cmluZyB9XG5jbGFzcyBOb3RlYm9va0NlbGxUZXh0TW9kZWxMaWtlSWQge1xuXHRzdGF0aWMgc3RyKGs6IElOb3RlYm9va0NlbGxUZXh0TW9kZWxMaWtlKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7ay52aWV3VHlwZX0vJHtrLnVyaS50b1N0cmluZygpfWA7XG5cdH1cblx0c3RhdGljIG9iaihzOiBzdHJpbmcpOiBJTm90ZWJvb2tDZWxsVGV4dE1vZGVsTGlrZSB7XG5cdFx0Y29uc3QgaWR4ID0gcy5pbmRleE9mKCcvJyk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHZpZXdUeXBlOiBzLnN1YnN0cmluZygwLCBpZHgpLFxuXHRcdFx0dXJpOiBVUkkucGFyc2Uocy5zdWJzdHJpbmcoaWR4ICsgMSkpXG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDaGF0Q29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ge1xuXHRzdGF0aWMgaWQ6IHN0cmluZyA9ICd3b3JrYmVuY2gubm90ZWJvb2suY2hhdENvbnRyb2xsZXInO1xuXHRzdGF0aWMgY291bnRlcjogbnVtYmVyID0gMDtcblxuXHRwdWJsaWMgc3RhdGljIGdldChlZGl0b3I6IElOb3RlYm9va0VkaXRvcik6IE5vdGVib29rQ2hhdENvbnRyb2xsZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gZWRpdG9yLmdldENvbnRyaWJ1dGlvbjxOb3RlYm9va0NoYXRDb250cm9sbGVyPihOb3RlYm9va0NoYXRDb250cm9sbGVyLmlkKTtcblx0fVxuXG5cdC8vIEhpc3Rvcnlcblx0cHJpdmF0ZSBzdGF0aWMgX3N0b3JhZ2VLZXkgPSAnaW5saW5lLWNoYXQtaGlzdG9yeSc7XG5cdHByaXZhdGUgc3RhdGljIF9wcm9tcHRIaXN0b3J5OiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIF9oaXN0b3J5T2Zmc2V0OiBudW1iZXIgPSAtMTtcblx0cHJpdmF0ZSBfaGlzdG9yeUNhbmRpZGF0ZTogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgX2hpc3RvcnlVcGRhdGU6IChwcm9tcHQ6IHN0cmluZykgPT4gdm9pZDtcblx0cHJpdmF0ZSBfcHJvbXB0Q2FjaGUgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBzdHJpbmc+KDEwMDAsIDAuNyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvbXB0Q2FjaGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGNlbGw6IFVSSSB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VQcm9tcHRDYWNoZSA9IHRoaXMuX29uRGlkQ2hhbmdlUHJvbXB0Q2FjaGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfc3RyYXRlZ3k6IEVkaXRTdHJhdGVneSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc2Vzc2lvbkN0b3I6IENhbmNlbGFibGVQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9hY3RpdmVSZXF1ZXN0Q3RzPzogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eEhhc0FjdGl2ZVJlcXVlc3Q6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhDZWxsV2lkZ2V0Rm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFVzZXJEaWRFZGl0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4T3V0ZXJGb2N1c1Bvc2l0aW9uOiBJQ29udGV4dEtleTwnYWJvdmUnIHwgJ2JlbG93JyB8ICcnPjtcblx0cHJpdmF0ZSByZWFkb25seSBfdXNlckVkaXRpbmdEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3dpZGdldERpc3Bvc2FibGVTdG9yZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgX2ZvY3VzVHJhY2tlcjogSUZvY3VzVHJhY2tlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd2lkZ2V0OiBOb3RlYm9va0NoYXRXaWRnZXQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IE11dGFibGVEaXNwb3NhYmxlPENoYXRNb2RlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUVkaXRvcldvcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yV29ya2VyU2VydmljZTogSUVkaXRvcldvcmtlclNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgX2V4ZWN1dGlvblN0YXRlU2VydmljZTogSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9jdHhIYXNBY3RpdmVSZXF1ZXN0ID0gQ1RYX05PVEVCT09LX0NIQVRfSEFTX0FDVElWRV9SRVFVRVNULmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY3R4Q2VsbFdpZGdldEZvY3VzZWQgPSBDVFhfTk9URUJPT0tfQ0VMTF9DSEFUX0ZPQ1VTRUQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhVc2VyRGlkRWRpdCA9IENUWF9OT1RFQk9PS19DSEFUX1VTRVJfRElEX0VESVQuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhPdXRlckZvY3VzUG9zaXRpb24gPSBDVFhfTk9URUJPT0tfQ0hBVF9PVVRFUl9GT0NVU19QT1NJVElPTi5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXJGb2N1c1RyYWNrZXIoKTtcblxuXHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3Byb21wdEhpc3RvcnkgPSBKU09OLnBhcnNlKHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChOb3RlYm9va0NoYXRDb250cm9sbGVyLl9zdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgJ1tdJykpO1xuXHRcdHRoaXMuX2hpc3RvcnlVcGRhdGUgPSAocHJvbXB0OiBzdHJpbmcpID0+IHtcblx0XHRcdGNvbnN0IGlkeCA9IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3Byb21wdEhpc3RvcnkuaW5kZXhPZihwcm9tcHQpO1xuXHRcdFx0aWYgKGlkeCA+PSAwKSB7XG5cdFx0XHRcdE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3Byb21wdEhpc3Rvcnkuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHR9XG5cdFx0XHROb3RlYm9va0NoYXRDb250cm9sbGVyLl9wcm9tcHRIaXN0b3J5LnVuc2hpZnQocHJvbXB0KTtcblx0XHRcdHRoaXMuX2hpc3RvcnlPZmZzZXQgPSAtMTtcblx0XHRcdHRoaXMuX2hpc3RvcnlDYW5kaWRhdGUgPSAnJztcblx0XHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3N0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3Byb21wdEhpc3RvcnkpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVnaXN0ZXJGb2N1c1RyYWNrZXIoKSB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbm90ZWJvb2tFZGl0b3Iub25EaWRDaGFuZ2VGb2N1cygoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0XHR0aGlzLl9jdHhPdXRlckZvY3VzUG9zaXRpb24uc2V0KCcnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB3aWRnZXRJbmRleCA9IHRoaXMuX3dpZGdldC5hZnRlck1vZGVsUG9zaXRpb247XG5cdFx0XHRjb25zdCBmb2N1cyA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldEZvY3VzKCkuc3RhcnQ7XG5cblx0XHRcdGlmIChmb2N1cyArIDEgPT09IHdpZGdldEluZGV4KSB7XG5cdFx0XHRcdHRoaXMuX2N0eE91dGVyRm9jdXNQb3NpdGlvbi5zZXQoJ2Fib3ZlJyk7XG5cdFx0XHR9IGVsc2UgaWYgKGZvY3VzID09PSB3aWRnZXRJbmRleCkge1xuXHRcdFx0XHR0aGlzLl9jdHhPdXRlckZvY3VzUG9zaXRpb24uc2V0KCdiZWxvdycpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY3R4T3V0ZXJGb2N1c1Bvc2l0aW9uLnNldCgnJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cnVuKGluZGV4OiBudW1iZXIsIGlucHV0OiBzdHJpbmcgfCB1bmRlZmluZWQsIGF1dG9TZW5kOiBib29sZWFuIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3dpZGdldCkge1xuXHRcdFx0aWYgKHRoaXMuX3dpZGdldC5hZnRlck1vZGVsUG9zaXRpb24gIT09IGluZGV4KSB7XG5cdFx0XHRcdGNvbnN0IHdpbmRvdyA9IGdldFdpbmRvdyh0aGlzLl93aWRnZXQuZG9tTm9kZSk7XG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2VXaWRnZXQoKTtcblxuXHRcdFx0XHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHdpbmRvdywgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZVdpZGdldChpbmRleCwgaW5wdXQsIGF1dG9TZW5kLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2NyZWF0ZVdpZGdldChpbmRleCwgaW5wdXQsIGF1dG9TZW5kLCB1bmRlZmluZWQpO1xuXHRcdC8vIFRPRE86IHJldmVhbCB3aWRnZXQgdG8gdGhlIGNlbnRlciBpZiBpdCdzIG91dCBvZiB0aGUgdmlld3BvcnRcblx0fVxuXG5cdHJlc3RvcmUoZWRpdGluZ0NlbGw6IElDZWxsVmlld01vZGVsLCBpbnB1dDogc3RyaW5nKSB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwuY2VsbHMuaW5kZXhPZihlZGl0aW5nQ2VsbC5tb2RlbCk7XG5cblx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3dpZGdldCkge1xuXHRcdFx0aWYgKHRoaXMuX3dpZGdldC5hZnRlck1vZGVsUG9zaXRpb24gIT09IGluZGV4KSB7XG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2VXaWRnZXQoKTtcblx0XHRcdFx0Y29uc3Qgd2luZG93ID0gZ2V0V2luZG93KHRoaXMuX3dpZGdldC5kb21Ob2RlKTtcblxuXHRcdFx0XHRzY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKHdpbmRvdywgKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZVdpZGdldChpbmRleCwgaW5wdXQsIGZhbHNlLCBlZGl0aW5nQ2VsbCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3JlYXRlV2lkZ2V0KGluZGV4LCBpbnB1dCwgZmFsc2UsIGVkaXRpbmdDZWxsKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VXaWRnZXQoKSB7XG5cdFx0dGhpcy5fd2lkZ2V0Py5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5jbGVhcigpO1xuXG5cdFx0dGhpcy5faGlzdG9yeU9mZnNldCA9IC0xO1xuXHRcdHRoaXMuX2hpc3RvcnlDYW5kaWRhdGUgPSAnJztcblx0fVxuXG5cblx0cHJpdmF0ZSBfY3JlYXRlV2lkZ2V0KGluZGV4OiBudW1iZXIsIGlucHV0OiBzdHJpbmcgfCB1bmRlZmluZWQsIGF1dG9TZW5kOiBib29sZWFuIHwgdW5kZWZpbmVkLCBpbml0RWRpdGluZ0NlbGw6IElDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgdGhlIHdpZGdldCBpZiBpdCdzIGFscmVhZHkgdGhlcmVcblx0XHR0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuY2xlYXIoKTtcblxuXHRcdGNvbnN0IHZpZXdab25lQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dmlld1pvbmVDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLWVkaXRvcicpO1xuXHRcdGNvbnN0IHdpZGdldENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHdpZGdldENvbnRhaW5lci5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG5cdFx0dmlld1pvbmVDb250YWluZXIuYXBwZW5kQ2hpbGQod2lkZ2V0Q29udGFpbmVyKTtcblxuXHRcdHRoaXMuX2ZvY3VzVHJhY2tlciA9IHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodHJhY2tGb2N1cyh2aWV3Wm9uZUNvbnRhaW5lcikpO1xuXHRcdHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdXBkYXRlTm90ZWJvb2tFZGl0b3JGb2N1c05TZWxlY3Rpb25zKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZmFrZVBhcmVudEVkaXRvckVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuXHRcdGNvbnN0IGZha2VQYXJlbnRFZGl0b3IgPSB0aGlzLl93aWRnZXREaXNwb3NhYmxlU3RvcmUuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q29kZUVkaXRvcldpZGdldCxcblx0XHRcdGZha2VQYXJlbnRFZGl0b3JFbGVtZW50LFxuXHRcdFx0e1xuXHRcdFx0fSxcblx0XHRcdHsgaXNTaW1wbGVXaWRnZXQ6IHRydWUgfVxuXHRcdCkpO1xuXG5cdFx0Y29uc3QgaW5wdXRCb3hGcmFnbWVudCA9IGBub3RlYm9vay1jaGF0LWlucHV0LSR7Tm90ZWJvb2tDaGF0Q29udHJvbGxlci5jb3VudGVyKyt9YDtcblx0XHRjb25zdCBub3RlYm9va1VyaSA9IHRoaXMuX25vdGVib29rRWRpdG9yLnRleHRNb2RlbC51cmk7XG5cdFx0Y29uc3QgaW5wdXRVcmkgPSBub3RlYm9va1VyaS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnVudGl0bGVkLCBmcmFnbWVudDogaW5wdXRCb3hGcmFnbWVudCB9KTtcblx0XHRjb25zdCByZXN1bHQ6IElUZXh0TW9kZWwgPSB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoJycsIG51bGwsIGlucHV0VXJpLCBmYWxzZSk7XG5cdFx0ZmFrZVBhcmVudEVkaXRvci5zZXRNb2RlbChyZXN1bHQpO1xuXG5cdFx0Y29uc3QgaW5saW5lQ2hhdFdpZGdldCA9IHRoaXMuX3dpZGdldERpc3Bvc2FibGVTdG9yZS5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRJbmxpbmVDaGF0V2lkZ2V0LFxuXHRcdFx0e1xuXHRcdFx0XHRsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24uTm90ZWJvb2ssXG5cdFx0XHRcdHJlc29sdmVEYXRhOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vzc2lvbklucHV0VXJpID0gdGhpcy5nZXRTZXNzaW9uSW5wdXRVcmkoKTtcblx0XHRcdFx0XHRpZiAoIXNlc3Npb25JbnB1dFVyaSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHR5cGU6IENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rLFxuXHRcdFx0XHRcdFx0c2Vzc2lvbklucHV0VXJpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0c3RhdHVzTWVudUlkOiBNRU5VX0NFTExfQ0hBVF9XSURHRVRfU1RBVFVTLFxuXHRcdFx0XHRjaGF0V2lkZ2V0Vmlld09wdGlvbnM6IHtcblx0XHRcdFx0XHRyZW5kZXJlck9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdHJlbmRlclRleHRFZGl0c0FzU3VtbWFyeTogKHVyaSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gaXNFcXVhbCh1cmksIHRoaXMuX3dpZGdldD8ucGFyZW50RWRpdG9yLmdldE1vZGVsKCk/LnVyaSlcblx0XHRcdFx0XHRcdFx0XHR8fCBpc0VxdWFsKHVyaSwgdGhpcy5fbm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy51cmkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWVudXM6IHtcblx0XHRcdFx0XHRcdHRlbGVtZXRyeVNvdXJjZTogJ25vdGVib29rLWdlbmVyYXRlLWNlbGwnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0aW5saW5lQ2hhdFdpZGdldC5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdkZWZhdWx0LnBsYWNlaG9sZGVyJywgXCJBc2sgYSBxdWVzdGlvblwiKTtcblx0XHRpbmxpbmVDaGF0V2lkZ2V0LnVwZGF0ZUluZm8obG9jYWxpemUoJ3dlbGNvbWUuMScsIFwiQUktZ2VuZXJhdGVkIGNvZGUgbWF5IGJlIGluY29ycmVjdFwiKSk7XG5cdFx0d2lkZ2V0Q29udGFpbmVyLmFwcGVuZENoaWxkKGlubGluZUNoYXRXaWRnZXQuZG9tTm9kZSk7XG5cblxuXHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmNoYW5nZVZpZXdab25lcyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRjb25zdCBub3RlYm9va1ZpZXdab25lID0ge1xuXHRcdFx0XHRhZnRlck1vZGVsUG9zaXRpb246IGluZGV4LFxuXHRcdFx0XHRoZWlnaHRJblB4OiA4MCxcblx0XHRcdFx0ZG9tTm9kZTogdmlld1pvbmVDb250YWluZXJcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGlkID0gYWNjZXNzb3IuYWRkWm9uZShub3RlYm9va1ZpZXdab25lKTtcblx0XHRcdHRoaXMuX3Njcm9sbFdpZGdldEludG9WaWV3KGluZGV4KTtcblxuXHRcdFx0dGhpcy5fd2lkZ2V0ID0gbmV3IE5vdGVib29rQ2hhdFdpZGdldChcblx0XHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IsXG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRub3RlYm9va1ZpZXdab25lLFxuXHRcdFx0XHR2aWV3Wm9uZUNvbnRhaW5lcixcblx0XHRcdFx0d2lkZ2V0Q29udGFpbmVyLFxuXHRcdFx0XHRpbmxpbmVDaGF0V2lkZ2V0LFxuXHRcdFx0XHRmYWtlUGFyZW50RWRpdG9yLFxuXHRcdFx0XHR0aGlzLl9sYW5ndWFnZVNlcnZpY2Vcblx0XHRcdCk7XG5cblx0XHRcdGlmIChpbml0RWRpdGluZ0NlbGwpIHtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnJlc3RvcmVFZGl0aW5nQ2VsbChpbml0RWRpdGluZ0NlbGwpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVVc2VyRWRpdGluZ1N0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2N0eENlbGxXaWRnZXRGb2N1c2VkLnNldCh0cnVlKTtcblxuXHRcdFx0ZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9mb2N1c1dpZGdldCgpO1xuXHRcdFx0fSwgMCwgdGhpcy5fc3RvcmUpO1xuXG5cdFx0XHR0aGlzLl9zZXNzaW9uQ3RvciA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlPHZvaWQ+KGFzeW5jIHRva2VuID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fc3RhcnRTZXNzaW9uKHRva2VuKTtcblx0XHRcdFx0YXNzZXJ0VHlwZSh0aGlzLl9tb2RlbC52YWx1ZSk7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwudmFsdWU7XG5cdFx0XHRcdHRoaXMuX3dpZGdldD8uaW5saW5lQ2hhdFdpZGdldC5zZXRDaGF0TW9kZWwobW9kZWwpO1xuXG5cdFx0XHRcdGlmIChmYWtlUGFyZW50RWRpdG9yLmhhc01vZGVsKCkpIHtcblxuXHRcdFx0XHRcdGlmICh0aGlzLl93aWRnZXQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2ZvY3VzV2lkZ2V0KCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX3dpZGdldCAmJiBpbnB1dCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fd2lkZ2V0LmlubGluZUNoYXRXaWRnZXQudmFsdWUgPSBpbnB1dDtcblxuXHRcdFx0XHRcdFx0aWYgKGF1dG9TZW5kKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuYWNjZXB0SW5wdXQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc3RhcnRTZXNzaW9uKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGlmICghdGhpcy5fbW9kZWwudmFsdWUpIHtcblx0XHRcdHRoaXMuX21vZGVsLnZhbHVlID0gdGhpcy5fY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciwgdG9rZW4pO1xuXG5cdFx0XHRpZiAoIXRoaXMuX21vZGVsLnZhbHVlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHN0YXJ0IGNoYXQgc2Vzc2lvbicpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3N0cmF0ZWd5ID0gbmV3IEVkaXRTdHJhdGVneSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2Nyb2xsV2lkZ2V0SW50b1ZpZXcoaW5kZXg6IG51bWJlcikge1xuXHRcdGlmIChpbmRleCA9PT0gMCB8fCB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRMZW5ndGgoKSA9PT0gMCkge1xuXHRcdFx0Ly8gdGhlIGNlbGwgaXMgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbm90ZWJvb2tcblx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLnJldmVhbE9mZnNldEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoMCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHRoZSBjZWxsIGlzIGF0IHRoZSBlbmQgb2YgdGhlIG5vdGVib29rXG5cdFx0XHRjb25zdCBwcmV2aW91c0NlbGwgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5jZWxsQXQoTWF0aC5taW4oaW5kZXggLSAxLCB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRMZW5ndGgoKSAtIDEpKTtcblx0XHRcdGlmIChwcmV2aW91c0NlbGwpIHtcblx0XHRcdFx0Y29uc3QgY2VsbFRvcCA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldEFic29sdXRlVG9wT2ZFbGVtZW50KHByZXZpb3VzQ2VsbCk7XG5cdFx0XHRcdGNvbnN0IGNlbGxIZWlnaHQgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRIZWlnaHRPZkVsZW1lbnQocHJldmlvdXNDZWxsKTtcblxuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5yZXZlYWxPZmZzZXRJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KGNlbGxUb3AgKyBjZWxsSGVpZ2h0ICsgNDggLyoqIGNlbnRlciBvZiB0aGUgZGlhbG9nICovKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9mb2N1c1dpZGdldCgpIHtcblx0XHRpZiAoIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3VwZGF0ZU5vdGVib29rRWRpdG9yRm9jdXNOU2VsZWN0aW9ucygpO1xuXHRcdHRoaXMuX3dpZGdldC5mb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlTm90ZWJvb2tFZGl0b3JGb2N1c05TZWxlY3Rpb25zKCkge1xuXHRcdGlmICghdGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fd2lkZ2V0LnVwZGF0ZU5vdGVib29rRWRpdG9yRm9jdXNOU2VsZWN0aW9ucygpO1xuXHR9XG5cblx0aGFzU2Vzc2lvbihjaGF0TW9kZWw6IElDaGF0TW9kZWwpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwudmFsdWUgPT09IGNoYXRNb2RlbDtcblx0fVxuXG5cdGdldFNlc3Npb25JbnB1dFVyaSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0Py5wYXJlbnRFZGl0b3IuZ2V0TW9kZWwoKT8udXJpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0SW5wdXQoKSB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl93aWRnZXQpO1xuXHRcdGF3YWl0IHRoaXMuX3Nlc3Npb25DdG9yO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fbW9kZWwudmFsdWUpO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fc3RyYXRlZ3kpO1xuXG5cdFx0Y29uc3QgbGFzdElucHV0ID0gdGhpcy5fd2lkZ2V0LmlubGluZUNoYXRXaWRnZXQudmFsdWU7XG5cdFx0dGhpcy5faGlzdG9yeVVwZGF0ZShsYXN0SW5wdXQpO1xuXG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fd2lkZ2V0LnBhcmVudEVkaXRvcjtcblx0XHRjb25zdCB0ZXh0TW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblxuXHRcdGlmICghZWRpdG9yLmhhc01vZGVsKCkgfHwgIXRleHRNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl93aWRnZXQuZWRpdGluZ0NlbGwgJiYgdGhpcy5fd2lkZ2V0LmVkaXRpbmdDZWxsLnRleHRCdWZmZXIuZ2V0TGVuZ3RoKCkgPiAwKSB7XG5cdFx0XHQvLyBpdCBhbHJlYWR5IGNvbnRhaW5zIHNvbWUgdGV4dCwgY2xlYXIgaXRcblx0XHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX3dpZGdldC5lZGl0aW5nQ2VsbC5yZXNvbHZlVGV4dE1vZGVsKCk7XG5cdFx0XHRyZWYuc2V0VmFsdWUoJycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRpbmdDZWxsSW5kZXggPSB0aGlzLl93aWRnZXQuZWRpdGluZ0NlbGwgPyB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRDZWxsSW5kZXgodGhpcy5fd2lkZ2V0LmVkaXRpbmdDZWxsKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoZWRpdGluZ0NlbGxJbmRleCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5zZXRTZWxlY3Rpb25zKFt7XG5cdFx0XHRcdHN0YXJ0OiBlZGl0aW5nQ2VsbEluZGV4LFxuXHRcdFx0XHRlbmQ6IGVkaXRpbmdDZWxsSW5kZXggKyAxXG5cdFx0XHR9XSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIFVwZGF0ZSBzZWxlY3Rpb24gdG8gdGhlIHdpZGdldCBpbmRleFxuXHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3Iuc2V0U2VsZWN0aW9ucyhbe1xuXHRcdFx0XHRzdGFydDogdGhpcy5fd2lkZ2V0LmFmdGVyTW9kZWxQb3NpdGlvbixcblx0XHRcdFx0ZW5kOiB0aGlzLl93aWRnZXQuYWZ0ZXJNb2RlbFBvc2l0aW9uXG5cdFx0XHR9XSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3R4SGFzQWN0aXZlUmVxdWVzdC5zZXQodHJ1ZSk7XG5cblx0XHR0aGlzLl9hY3RpdmVSZXF1ZXN0Q3RzPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9hY3RpdmVSZXF1ZXN0Q3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9jdHhIYXNBY3RpdmVSZXF1ZXN0LnNldCh0cnVlKTtcblxuXHRcdFx0Y29uc3QgcHJvZ3Jlc3NpdmVFZGl0c1F1ZXVlID0gbmV3IFF1ZXVlKCk7XG5cdFx0XHRjb25zdCBwcm9ncmVzc2l2ZUVkaXRzQ2xvY2sgPSBTdG9wV2F0Y2guY3JlYXRlKCk7XG5cdFx0XHRjb25zdCBwcm9ncmVzc2l2ZUVkaXRzQXZnRHVyYXRpb24gPSBuZXcgTW92aW5nQXZlcmFnZSgpO1xuXHRcdFx0Y29uc3QgcHJvZ3Jlc3NpdmVFZGl0c0N0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSh0aGlzLl9hY3RpdmVSZXF1ZXN0Q3RzLnRva2VuKTtcblxuXHRcdFx0Y29uc3QgcmVzcG9uc2VQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl93aWRnZXQuaW5saW5lQ2hhdFdpZGdldC5jaGF0V2lkZ2V0LmFjY2VwdElucHV0KCk7XG5cdFx0XHRpZiAocmVzcG9uc2UpIHtcblx0XHRcdFx0bGV0IGxhc3RMZW5ndGggPSAwO1xuXG5cdFx0XHRcdHN0b3JlLmFkZChyZXNwb25zZS5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UuaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRcdFx0cHJvZ3Jlc3NpdmVFZGl0c0N0cy5jYW5jZWwoKTtcblx0XHRcdFx0XHRcdHJlc3BvbnNlUHJvbWlzZS5jb21wbGV0ZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChyZXNwb25zZS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdFx0XHRyZXNwb25zZVByb21pc2UuY29tcGxldGUoKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBlZGl0cyA9IHJlc3BvbnNlLnJlc3BvbnNlLnZhbHVlLm1hcChwYXJ0ID0+IHtcblx0XHRcdFx0XHRcdGlmIChwYXJ0LmtpbmQgPT09ICd0ZXh0RWRpdEdyb3VwJ1xuXHRcdFx0XHRcdFx0XHQvLyAmJiBpc0VxdWFsKHBhcnQudXJpLCB0aGlzLl9zZXNzaW9uPy50ZXh0TW9kZWxOLnVyaSlcblx0XHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcGFydC5lZGl0cztcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KS5mbGF0KCk7XG5cblx0XHRcdFx0XHRjb25zdCBuZXdFZGl0cyA9IGVkaXRzLnNsaWNlKGxhc3RMZW5ndGgpO1xuXHRcdFx0XHRcdC8vIGNvbnNvbGUubG9nKCdORVcgZWRpdHMnLCBuZXdFZGl0cywgZWRpdHMpO1xuXHRcdFx0XHRcdGlmIChuZXdFZGl0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gTk8gY2hhbmdlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGxhc3RMZW5ndGggPSBlZGl0cy5sZW5ndGg7XG5cdFx0XHRcdFx0cHJvZ3Jlc3NpdmVFZGl0c0F2Z0R1cmF0aW9uLnVwZGF0ZShwcm9ncmVzc2l2ZUVkaXRzQ2xvY2suZWxhcHNlZCgpKTtcblx0XHRcdFx0XHRwcm9ncmVzc2l2ZUVkaXRzQ2xvY2sucmVzZXQoKTtcblxuXHRcdFx0XHRcdHByb2dyZXNzaXZlRWRpdHNRdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRzIG9mIG5ld0VkaXRzKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX21ha2VDaGFuZ2VzKGVkaXRzLCB7XG5cdFx0XHRcdFx0XHRcdFx0ZHVyYXRpb246IHByb2dyZXNzaXZlRWRpdHNBdmdEdXJhdGlvbi52YWx1ZSxcblx0XHRcdFx0XHRcdFx0XHR0b2tlbjogcHJvZ3Jlc3NpdmVFZGl0c0N0cy50b2tlblxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCByZXNwb25zZVByb21pc2UucDtcblx0XHRcdGF3YWl0IHByb2dyZXNzaXZlRWRpdHNRdWV1ZS53aGVuSWRsZSgpO1xuXG5cdFx0XHR0aGlzLl91c2VyRWRpdGluZ0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHQvLyBtb25pdG9yIHVzZXIgZWRpdHNcblx0XHRcdGNvbnN0IGVkaXRpbmdDZWxsID0gdGhpcy5fd2lkZ2V0LmdldEVkaXRpbmdDZWxsKCk7XG5cdFx0XHRpZiAoZWRpdGluZ0NlbGwpIHtcblx0XHRcdFx0dGhpcy5fdXNlckVkaXRpbmdEaXNwb3NhYmxlcy5hZGQoZWRpdGluZ0NlbGwubW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMuX3VwZGF0ZVVzZXJFZGl0aW5nU3RhdGUoKSkpO1xuXHRcdFx0XHR0aGlzLl91c2VyRWRpdGluZ0Rpc3Bvc2FibGVzLmFkZChlZGl0aW5nQ2VsbC5tb2RlbC5vbkRpZENoYW5nZUxhbmd1YWdlKCgpID0+IHRoaXMuX3VwZGF0ZVVzZXJFZGl0aW5nU3RhdGUoKSkpO1xuXHRcdFx0XHR0aGlzLl91c2VyRWRpdGluZ0Rpc3Bvc2FibGVzLmFkZChlZGl0aW5nQ2VsbC5tb2RlbC5vbkRpZENoYW5nZU1ldGFkYXRhKCgpID0+IHRoaXMuX3VwZGF0ZVVzZXJFZGl0aW5nU3RhdGUoKSkpO1xuXHRcdFx0XHR0aGlzLl91c2VyRWRpdGluZ0Rpc3Bvc2FibGVzLmFkZChlZGl0aW5nQ2VsbC5tb2RlbC5vbkRpZENoYW5nZUludGVybmFsTWV0YWRhdGEoKCkgPT4gdGhpcy5fdXBkYXRlVXNlckVkaXRpbmdTdGF0ZSgpKSk7XG5cdFx0XHRcdHRoaXMuX3VzZXJFZGl0aW5nRGlzcG9zYWJsZXMuYWRkKGVkaXRpbmdDZWxsLm1vZGVsLm9uRGlkQ2hhbmdlT3V0cHV0cygoKSA9PiB0aGlzLl91cGRhdGVVc2VyRWRpdGluZ1N0YXRlKCkpKTtcblx0XHRcdFx0dGhpcy5fdXNlckVkaXRpbmdEaXNwb3NhYmxlcy5hZGQodGhpcy5fZXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLnR5cGUgPT09IE5vdGVib29rRXhlY3V0aW9uVHlwZS5jZWxsICYmIGUuYWZmZWN0c0NlbGwoZWRpdGluZ0NlbGwudXJpKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdXBkYXRlVXNlckVkaXRpbmdTdGF0ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXG5cdFx0XHR0aGlzLl9jdHhIYXNBY3RpdmVSZXF1ZXN0LnNldChmYWxzZSk7XG5cdFx0XHR0aGlzLl93aWRnZXQuaW5saW5lQ2hhdFdpZGdldC51cGRhdGVJbmZvKCcnKTtcblx0XHRcdHRoaXMuX3dpZGdldC5pbmxpbmVDaGF0V2lkZ2V0LnVwZGF0ZVRvb2xiYXIodHJ1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfbWFrZUNoYW5nZXMoZWRpdHM6IFRleHRFZGl0W10sIG9wdHM6IFByb2dyZXNzaW5nRWRpdHNPcHRpb25zIHwgdW5kZWZpbmVkKSB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9zdHJhdGVneSk7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl93aWRnZXQpO1xuXG5cdFx0Y29uc3QgZWRpdGluZ0NlbGwgPSBhd2FpdCB0aGlzLl93aWRnZXQuZ2V0T3JDcmVhdGVFZGl0aW5nQ2VsbCgpO1xuXG5cdFx0aWYgKCFlZGl0aW5nQ2VsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IGVkaXRpbmdDZWxsLmVkaXRvcjtcblxuXHRcdGNvbnN0IG1vcmVNaW5pbWFsRWRpdHMgPSBhd2FpdCB0aGlzLl9lZGl0b3JXb3JrZXJTZXJ2aWNlLmNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKGVkaXRvci5nZXRNb2RlbCgpLnVyaSwgZWRpdHMpO1xuXHRcdC8vIHRoaXMuX2xvZygnZWRpdHMgZnJvbSBQUk9WSURFUiBhbmQgYWZ0ZXIgbWFraW5nIHRoZW0gTU9SRSBNSU5JTUFMJywgdGhpcy5fYWN0aXZlU2Vzc2lvbi5wcm92aWRlci5kZWJ1Z05hbWUsIGVkaXRzLCBtb3JlTWluaW1hbEVkaXRzKTtcblxuXHRcdGlmIChtb3JlTWluaW1hbEVkaXRzPy5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIG5vdGhpbmcgbGVmdCB0byBkb1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdHVhbEVkaXRzID0gIW9wdHMgJiYgbW9yZU1pbmltYWxFZGl0cyA/IG1vcmVNaW5pbWFsRWRpdHMgOiBlZGl0cztcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGFjdHVhbEVkaXRzLm1hcChUZXh0RWRpdC5hc0VkaXRPcGVyYXRpb24pO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmIChvcHRzKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3N0cmF0ZWd5Lm1ha2VQcm9ncmVzc2l2ZUNoYW5nZXMoZWRpdG9yLCBlZGl0T3BlcmF0aW9ucywgb3B0cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9zdHJhdGVneS5tYWtlQ2hhbmdlcyhlZGl0b3IsIGVkaXRPcGVyYXRpb25zKTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVVzZXJFZGl0aW5nU3RhdGUoKSB7XG5cdFx0dGhpcy5fY3R4VXNlckRpZEVkaXQuc2V0KHRydWUpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0U2Vzc2lvbigpIHtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX21vZGVsKTtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX3N0cmF0ZWd5KTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX3dpZGdldD8ucGFyZW50RWRpdG9yO1xuXHRcdGlmICghZWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdGluZ0NlbGwgPSB0aGlzLl93aWRnZXQ/LmdldEVkaXRpbmdDZWxsKCk7XG5cblx0XHRpZiAoZWRpdGluZ0NlbGwgJiYgdGhpcy5fbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0Y29uc3QgY2VsbElkID0gTm90ZWJvb2tDZWxsVGV4dE1vZGVsTGlrZUlkLnN0cih7IHVyaTogZWRpdGluZ0NlbGwudXJpLCB2aWV3VHlwZTogdGhpcy5fbm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsLnZpZXdUeXBlIH0pO1xuXHRcdFx0aWYgKHRoaXMuX3dpZGdldD8uaW5saW5lQ2hhdFdpZGdldC52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9wcm9tcHRDYWNoZS5zZXQoY2VsbElkLCB0aGlzLl93aWRnZXQuaW5saW5lQ2hhdFdpZGdldC52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb21wdENhY2hlLmZpcmUoeyBjZWxsOiBlZGl0aW5nQ2VsbC51cmkgfSk7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX21vZGVsLmNsZWFyKCk7XG5cdFx0fSBjYXRjaCAoX2VycikgeyB9XG5cblx0XHR0aGlzLmRpc21pc3MoZmFsc2UpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNBYm92ZSgpIHtcblx0XHRpZiAoIXRoaXMuX3dpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fd2lkZ2V0LmFmdGVyTW9kZWxQb3NpdGlvbjtcblx0XHRjb25zdCBwcmV2ID0gaW5kZXggLSAxO1xuXHRcdGlmIChwcmV2IDwgMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5jZWxsQXQocHJldik7XG5cdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fbm90ZWJvb2tFZGl0b3IuZm9jdXNOb3RlYm9va0NlbGwoY2VsbCwgJ2VkaXRvcicpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXNOZXh0KCkge1xuXHRcdGlmICghdGhpcy5fd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLl93aWRnZXQuYWZ0ZXJNb2RlbFBvc2l0aW9uO1xuXHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5jZWxsQXQoaW5kZXgpO1xuXHRcdGlmICghY2VsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX25vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGNlbGwsICdlZGl0b3InKTtcblx0fVxuXG5cdGhhc0ZvY3VzKCkge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQ/Lmhhc0ZvY3VzKCkgPz8gZmFsc2U7XG5cdH1cblxuXHRmb2N1cygpIHtcblx0XHR0aGlzLl9mb2N1c1dpZGdldCgpO1xuXHR9XG5cblx0Zm9jdXNOZWFyZXN0V2lkZ2V0KGluZGV4OiBudW1iZXIsIGRpcmVjdGlvbjogJ2Fib3ZlJyB8ICdiZWxvdycpIHtcblx0XHRzd2l0Y2ggKGRpcmVjdGlvbikge1xuXHRcdFx0Y2FzZSAnYWJvdmUnOlxuXHRcdFx0XHRpZiAodGhpcy5fd2lkZ2V0Py5hZnRlck1vZGVsUG9zaXRpb24gPT09IGluZGV4KSB7XG5cdFx0XHRcdFx0dGhpcy5fZm9jdXNXaWRnZXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2JlbG93Jzpcblx0XHRcdFx0aWYgKHRoaXMuX3dpZGdldD8uYWZ0ZXJNb2RlbFBvc2l0aW9uID09PSBpbmRleCArIDEpIHtcblx0XHRcdFx0XHR0aGlzLl9mb2N1c1dpZGdldCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG5cblx0cG9wdWxhdGVIaXN0b3J5KHVwOiBib29sZWFuKSB7XG5cdFx0aWYgKCF0aGlzLl93aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsZW4gPSBOb3RlYm9va0NoYXRDb250cm9sbGVyLl9wcm9tcHRIaXN0b3J5Lmxlbmd0aDtcblx0XHRpZiAobGVuID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2hpc3RvcnlPZmZzZXQgPT09IC0xKSB7XG5cdFx0XHQvLyByZW1lbWJlciB0aGUgY3VycmVudCB2YWx1ZVxuXHRcdFx0dGhpcy5faGlzdG9yeUNhbmRpZGF0ZSA9IHRoaXMuX3dpZGdldC5pbmxpbmVDaGF0V2lkZ2V0LnZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG5ld0lkeCA9IHRoaXMuX2hpc3RvcnlPZmZzZXQgKyAodXAgPyAxIDogLTEpO1xuXHRcdGlmIChuZXdJZHggPj0gbGVuKSB7XG5cdFx0XHQvLyByZWFjaGVkIHRoZSBlbmRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgZW50cnk6IHN0cmluZztcblx0XHRpZiAobmV3SWR4IDwgMCkge1xuXHRcdFx0ZW50cnkgPSB0aGlzLl9oaXN0b3J5Q2FuZGlkYXRlO1xuXHRcdFx0dGhpcy5faGlzdG9yeU9mZnNldCA9IC0xO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRlbnRyeSA9IE5vdGVib29rQ2hhdENvbnRyb2xsZXIuX3Byb21wdEhpc3RvcnlbbmV3SWR4XTtcblx0XHRcdHRoaXMuX2hpc3RvcnlPZmZzZXQgPSBuZXdJZHg7XG5cdFx0fVxuXG5cdFx0dGhpcy5fd2lkZ2V0LmlubGluZUNoYXRXaWRnZXQudmFsdWUgPSBlbnRyeTtcblx0XHR0aGlzLl93aWRnZXQuaW5saW5lQ2hhdFdpZGdldC5zZWxlY3RBbGwoKTtcblx0fVxuXG5cdGFzeW5jIGNhbmNlbEN1cnJlbnRSZXF1ZXN0KGRpc2NhcmQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9hY3RpdmVSZXF1ZXN0Q3RzPy5jYW5jZWwoKTtcblx0fVxuXG5cdGdldEVkaXRpbmdDZWxsKCkge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXQ/LmdldEVkaXRpbmdDZWxsKCk7XG5cdH1cblxuXHRkaXNjYXJkKCkge1xuXHRcdHRoaXMuX2FjdGl2ZVJlcXVlc3RDdHM/LmNhbmNlbCgpO1xuXHRcdHRoaXMuX3dpZGdldD8uZGlzY2FyZENoYW5nZSgpO1xuXHRcdHRoaXMuZGlzbWlzcyh0cnVlKTtcblx0fVxuXG5cdGRpc21pc3MoZGlzY2FyZDogYm9vbGVhbikge1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuX3dpZGdldDtcblx0XHRjb25zdCB3aWRnZXRJbmRleCA9IHdpZGdldD8uYWZ0ZXJNb2RlbFBvc2l0aW9uO1xuXHRcdGNvbnN0IGN1cnJlbnRGb2N1cyA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldEZvY3VzKCk7XG5cdFx0Y29uc3QgaXNXaWRnZXRGb2N1c2VkID0gY3VycmVudEZvY3VzLnN0YXJ0ID09PSB3aWRnZXRJbmRleCAmJiBjdXJyZW50Rm9jdXMuZW5kID09PSB3aWRnZXRJbmRleDtcblxuXHRcdGlmICh3aWRnZXQgJiYgaXNXaWRnZXRGb2N1c2VkKSB7XG5cdFx0XHQvLyBjaGFuZ2UgZm9jdXMgb25seSB3aGVuIHRoZSB3aWRnZXQgaXMgZm9jdXNlZFxuXHRcdFx0Y29uc3QgZWRpdGluZ0NlbGwgPSB3aWRnZXQuZ2V0RWRpdGluZ0NlbGwoKTtcblx0XHRcdGNvbnN0IHNob3VsZEZvY3VzRWRpdGluZ0NlbGwgPSBlZGl0aW5nQ2VsbCAmJiAhZGlzY2FyZDtcblx0XHRcdGNvbnN0IHNob3VsZEZvY3VzVG9wQ2VsbCA9IHdpZGdldEluZGV4ID09PSAwICYmIHRoaXMuX25vdGVib29rRWRpdG9yLmdldExlbmd0aCgpID4gMDtcblx0XHRcdGNvbnN0IHNob3VsZEZvY3VzQWJvdmVDZWxsID0gd2lkZ2V0SW5kZXggIT09IDAgJiYgdGhpcy5fbm90ZWJvb2tFZGl0b3IuY2VsbEF0KHdpZGdldEluZGV4IC0gMSk7XG5cblx0XHRcdGlmIChzaG91bGRGb2N1c0VkaXRpbmdDZWxsKSB7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKGVkaXRpbmdDZWxsLCAnY29udGFpbmVyJyk7XG5cdFx0XHR9IGVsc2UgaWYgKHNob3VsZEZvY3VzVG9wQ2VsbCkge1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5mb2N1c05vdGVib29rQ2VsbCh0aGlzLl9ub3RlYm9va0VkaXRvci5jZWxsQXQoMCkhLCAnY29udGFpbmVyJyk7XG5cdFx0XHR9IGVsc2UgaWYgKHNob3VsZEZvY3VzQWJvdmVDZWxsKSB7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmZvY3VzTm90ZWJvb2tDZWxsKHRoaXMuX25vdGVib29rRWRpdG9yLmNlbGxBdCh3aWRnZXRJbmRleCAtIDEpISwgJ2NvbnRhaW5lcicpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2N0eENlbGxXaWRnZXRGb2N1c2VkLnNldChmYWxzZSk7XG5cdFx0dGhpcy5fY3R4VXNlckRpZEVkaXQuc2V0KGZhbHNlKTtcblx0XHR0aGlzLl9zZXNzaW9uQ3Rvcj8uY2FuY2VsKCk7XG5cdFx0dGhpcy5fc2Vzc2lvbkN0b3IgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbW9kZWwuY2xlYXIoKTtcblx0XHR0aGlzLl93aWRnZXQ/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl93aWRnZXQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fd2lkZ2V0RGlzcG9zYWJsZVN0b3JlLmNsZWFyKCk7XG5cdH1cblxuXHQvLyBjaGVjayBpZiBhIGNlbGwgaXMgZ2VuZXJhdGVkIGJ5IHByb21wdCBieSBjaGVja2luZyBwcm9tcHQgY2FjaGVcblx0aXNDZWxsR2VuZXJhdGVkQnlDaGF0KGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBubyBtb2RlbCBhdHRhY2hlZCB5ZXRcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBjZWxsSWQgPSBOb3RlYm9va0NlbGxUZXh0TW9kZWxMaWtlSWQuc3RyKHsgdXJpOiBjZWxsLnVyaSwgdmlld1R5cGU6IHRoaXMuX25vdGVib29rRWRpdG9yLnRleHRNb2RlbC52aWV3VHlwZSB9KTtcblx0XHRyZXR1cm4gdGhpcy5fcHJvbXB0Q2FjaGUuaGFzKGNlbGxJZCk7XG5cdH1cblxuXHQvLyBnZXQgcHJvbXB0IGZyb20gY2FjaGVcblx0Z2V0UHJvbXB0RnJvbUNhY2hlKGNlbGw6IElDZWxsVmlld01vZGVsKSB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBubyBtb2RlbCBhdHRhY2hlZCB5ZXRcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2VsbElkID0gTm90ZWJvb2tDZWxsVGV4dE1vZGVsTGlrZUlkLnN0cih7IHVyaTogY2VsbC51cmksIHZpZXdUeXBlOiB0aGlzLl9ub3RlYm9va0VkaXRvci50ZXh0TW9kZWwudmlld1R5cGUgfSk7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb21wdENhY2hlLmdldChjZWxsSWQpO1xuXHR9XG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuZGlzbWlzcyhmYWxzZSk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0U3RyYXRlZ3kge1xuXHRwcml2YXRlIF9lZGl0Q291bnQ6IG51bWJlciA9IDA7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdH1cblxuXHRhc3luYyBtYWtlUHJvZ3Jlc3NpdmVDaGFuZ2VzKGVkaXRvcjogSUFjdGl2ZUNvZGVFZGl0b3IsIGVkaXRzOiBJU2luZ2xlRWRpdE9wZXJhdGlvbltdLCBvcHRzOiBQcm9ncmVzc2luZ0VkaXRzT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIHB1c2ggdW5kbyBzdG9wIGJlZm9yZSBmaXJzdCBlZGl0XG5cdFx0aWYgKCsrdGhpcy5fZWRpdENvdW50ID09PSAxKSB7XG5cdFx0XHRlZGl0b3IucHVzaFVuZG9TdG9wKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZHVyYXRpb25JblNlYyA9IG9wdHMuZHVyYXRpb24gLyAxMDAwO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiBlZGl0cykge1xuXHRcdFx0Y29uc3Qgd29yZENvdW50ID0gY291bnRXb3JkcyhlZGl0LnRleHQgPz8gJycpO1xuXHRcdFx0Y29uc3Qgc3BlZWQgPSB3b3JkQ291bnQgLyBkdXJhdGlvbkluU2VjO1xuXHRcdFx0Ly8gY29uc29sZS5sb2coeyBkdXJhdGlvbkluU2VjLCB3b3JkQ291bnQsIHNwZWVkOiB3b3JkQ291bnQgLyBkdXJhdGlvbkluU2VjIH0pO1xuXHRcdFx0YXdhaXQgcGVyZm9ybUFzeW5jVGV4dEVkaXQoZWRpdG9yLmdldE1vZGVsKCksIGFzUHJvZ3Jlc3NpdmVFZGl0KG5ldyBXaW5kb3dJbnRlcnZhbFRpbWVyKCksIGVkaXQsIHNwZWVkLCBvcHRzLnRva2VuKSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgbWFrZUNoYW5nZXMoZWRpdG9yOiBJQWN0aXZlQ29kZUVkaXRvciwgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjdXJzb3JTdGF0ZUNvbXB1dGVyQW5kSW5saW5lRGlmZkNvbGxlY3Rpb246IElDdXJzb3JTdGF0ZUNvbXB1dGVyID0gKHVuZG9FZGl0cykgPT4ge1xuXHRcdFx0bGV0IGxhc3Q6IFBvc2l0aW9uIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdW5kb0VkaXRzKSB7XG5cdFx0XHRcdGxhc3QgPSAhbGFzdCB8fCBsYXN0LmlzQmVmb3JlKGVkaXQucmFuZ2UuZ2V0RW5kUG9zaXRpb24oKSkgPyBlZGl0LnJhbmdlLmdldEVuZFBvc2l0aW9uKCkgOiBsYXN0O1xuXHRcdFx0XHQvLyB0aGlzLl9pbmxpbmVEaWZmRGVjb3JhdGlvbnMuY29sbGVjdEVkaXRPcGVyYXRpb24oZWRpdCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbGFzdCAmJiBbU2VsZWN0aW9uLmZyb21Qb3NpdGlvbnMobGFzdCldO1xuXHRcdH07XG5cblx0XHQvLyBwdXNoIHVuZG8gc3RvcCBiZWZvcmUgZmlyc3QgZWRpdFxuXHRcdGlmICgrK3RoaXMuX2VkaXRDb3VudCA9PT0gMSkge1xuXHRcdFx0ZWRpdG9yLnB1c2hVbmRvU3RvcCgpO1xuXHRcdH1cblx0XHRlZGl0b3IuZXhlY3V0ZUVkaXRzKCdpbmxpbmUtY2hhdC1saXZlJywgZWRpdHMsIGN1cnNvclN0YXRlQ29tcHV0ZXJBbmRJbmxpbmVEaWZmQ29sbGVjdGlvbik7XG5cdH1cbn1cblxuXG5yZWdpc3Rlck5vdGVib29rQ29udHJpYnV0aW9uKE5vdGVib29rQ2hhdENvbnRyb2xsZXIuaWQsIE5vdGVib29rQ2hhdENvbnRyb2xsZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQTBCLHFCQUFxQixXQUFXLDhCQUE4QixrQkFBa0I7QUFDbkgsU0FBNEIsaUJBQWlCLE9BQU8seUJBQXlCLHlCQUF5QjtBQUN0RyxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxpQkFBaUIsbUJBQW1CLG9CQUFvQjtBQUM3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
