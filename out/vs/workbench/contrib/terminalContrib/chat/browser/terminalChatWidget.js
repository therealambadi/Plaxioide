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
import { Dimension, getActiveWindow, trackFocus } from "../../../../../base/browser/dom.js";
import { createCancelablePromise, DeferredPromise } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { autorun, observableValue } from "../../../../../base/common/observable.js";
import { MicrotaskDelay } from "../../../../../base/common/symbols.js";
import { localize } from "../../../../../nls.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { showChatView } from "../../../chat/browser/chat.js";
import { IChatAgentService } from "../../../chat/common/chatAgents.js";
import { isCellTextEditOperation } from "../../../chat/common/chatModel.js";
import { IChatService } from "../../../chat/common/chatService.js";
import { ChatAgentLocation } from "../../../chat/common/constants.js";
import { InlineChatWidget } from "../../../inlineChat/browser/inlineChatWidget.js";
import { MENU_INLINE_CHAT_WIDGET_SECONDARY } from "../../../inlineChat/common/inlineChat.js";
import { TerminalStickyScrollContribution } from "../../stickyScroll/browser/terminalStickyScrollContribution.js";
import "./media/terminalChatWidget.css";
import { MENU_TERMINAL_CHAT_WIDGET_INPUT_SIDE_TOOLBAR, MENU_TERMINAL_CHAT_WIDGET_STATUS, TerminalChatCommandId, TerminalChatContextKeys } from "./terminalChat.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["HorizontalMargin"] = 10] = "HorizontalMargin";
  Constants2[Constants2["VerticalMargin"] = 30] = "VerticalMargin";
  Constants2[Constants2["RightPadding"] = 12] = "RightPadding";
  Constants2[Constants2["MaxHeight"] = 480] = "MaxHeight";
  Constants2[Constants2["MaxHeightPercentageOfViewport"] = 0.75] = "MaxHeightPercentageOfViewport";
  return Constants2;
})(Constants || {});
var Message = /* @__PURE__ */ ((Message2) => {
  Message2[Message2["None"] = 0] = "None";
  Message2[Message2["AcceptSession"] = 1] = "AcceptSession";
  Message2[Message2["CancelSession"] = 2] = "CancelSession";
  Message2[Message2["PauseSession"] = 4] = "PauseSession";
  Message2[Message2["CancelRequest"] = 8] = "CancelRequest";
  Message2[Message2["CancelInput"] = 16] = "CancelInput";
  Message2[Message2["AcceptInput"] = 32] = "AcceptInput";
  Message2[Message2["ReturnInput"] = 64] = "ReturnInput";
  return Message2;
})(Message || {});
let TerminalChatWidget = class extends Disposable {
  constructor(_terminalElement, _instance, _xterm, contextKeyService, _chatService, _storageService, _viewsService, instantiationService, _chatAgentService) {
    super();
    this._terminalElement = _terminalElement;
    this._instance = _instance;
    this._xterm = _xterm;
    this._chatService = _chatService;
    this._storageService = _storageService;
    this._viewsService = _viewsService;
    this._chatAgentService = _chatAgentService;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._messages = this._store.add(new Emitter());
    this._viewStateStorageKey = "terminal-inline-chat-view-state";
    this._terminalAgentName = "terminal";
    this._model = this._register(new MutableDisposable());
    this._requestInProgress = observableValue(this, false);
    this.requestInProgress = this._requestInProgress;
    this._focusedContextKey = TerminalChatContextKeys.focused.bindTo(contextKeyService);
    this._visibleContextKey = TerminalChatContextKeys.visible.bindTo(contextKeyService);
    this._requestActiveContextKey = TerminalChatContextKeys.requestActive.bindTo(contextKeyService);
    this._responseContainsCodeBlockContextKey = TerminalChatContextKeys.responseContainsCodeBlock.bindTo(contextKeyService);
    this._responseContainsMulitpleCodeBlocksContextKey = TerminalChatContextKeys.responseContainsMultipleCodeBlocks.bindTo(contextKeyService);
    this._container = document.createElement("div");
    this._container.classList.add("terminal-inline-chat");
    this._terminalElement.appendChild(this._container);
    this._inlineChatWidget = instantiationService.createInstance(
      InlineChatWidget,
      {
        location: ChatAgentLocation.Terminal,
        resolveData: () => {
          return void 0;
        }
      },
      {
        statusMenuId: {
          menu: MENU_TERMINAL_CHAT_WIDGET_STATUS,
          options: {
            buttonConfigProvider: (action) => ({
              showLabel: action.id !== TerminalChatCommandId.RerunRequest,
              showIcon: action.id === TerminalChatCommandId.RerunRequest,
              isSecondary: action.id !== TerminalChatCommandId.RunCommand && action.id !== TerminalChatCommandId.RunFirstCommand
            })
          }
        },
        secondaryMenuId: MENU_INLINE_CHAT_WIDGET_SECONDARY,
        chatWidgetViewOptions: {
          menus: {
            telemetrySource: "terminal-inline-chat",
            executeToolbar: MenuId.ChatExecute,
            inputSideToolbar: MENU_TERMINAL_CHAT_WIDGET_INPUT_SIDE_TOOLBAR
          }
        }
      }
    );
    this._register(this._inlineChatWidget.chatWidget.onDidChangeViewModel(() => this._saveViewState()));
    this._register(Event.any(
      this._inlineChatWidget.onDidChangeHeight,
      this._instance.onDimensionsChanged,
      this._inlineChatWidget.chatWidget.onDidChangeContentHeight,
      Event.debounce(this._xterm.raw.onCursorMove, () => void 0, MicrotaskDelay)
    )(() => this._relayout()));
    const observer = new ResizeObserver(() => this._relayout());
    observer.observe(this._terminalElement);
    this._register(toDisposable(() => observer.disconnect()));
    this._resetPlaceholder();
    this._container.appendChild(this._inlineChatWidget.domNode);
    this._focusTracker = this._register(trackFocus(this._container));
    this._register(this._focusTracker.onDidFocus(() => this._focusedContextKey.set(true)));
    this._register(this._focusTracker.onDidBlur(() => this._focusedContextKey.set(false)));
    this._register(autorun((r) => {
      const isBusy = this._inlineChatWidget.requestInProgress.read(r);
      this._container.classList.toggle("busy", isBusy);
      this._inlineChatWidget.toggleStatus(!!this._inlineChatWidget.responseContent);
      if (isBusy || !this._inlineChatWidget.responseContent) {
        this._responseContainsCodeBlockContextKey.set(false);
        this._responseContainsMulitpleCodeBlocksContextKey.set(false);
      } else {
        Promise.all([
          this._inlineChatWidget.getCodeBlockInfo(0),
          this._inlineChatWidget.getCodeBlockInfo(1)
        ]).then(([firstCodeBlock, secondCodeBlock]) => {
          this._responseContainsCodeBlockContextKey.set(!!firstCodeBlock);
          this._responseContainsMulitpleCodeBlocksContextKey.set(!!secondCodeBlock);
          this._inlineChatWidget.updateToolbar(true);
        });
      }
    }));
    this.hide();
  }
  get inlineChatWidget() {
    return this._inlineChatWidget;
  }
  get lastResponseContent() {
    return this._lastResponseContent;
  }
  _relayout() {
    if (this._dimension) {
      this._doLayout();
    }
  }
  _doLayout() {
    const xtermElement = this._xterm.raw.element;
    if (!xtermElement) {
      return;
    }
    const style = getActiveWindow().getComputedStyle(xtermElement);
    const xtermLeftPadding = parseInt(style.paddingLeft);
    const width = xtermElement.clientWidth - xtermLeftPadding - 12 /* RightPadding */;
    if (width === 0) {
      return;
    }
    const terminalViewportHeight = this._getTerminalViewportHeight();
    const widgetAllowedPercentBasedHeight = (terminalViewportHeight ?? 0) * 0.75 /* MaxHeightPercentageOfViewport */;
    const height = Math.max(Math.min(480 /* MaxHeight */, this._inlineChatWidget.contentHeight, widgetAllowedPercentBasedHeight), this._inlineChatWidget.minHeight);
    if (height === 0) {
      return;
    }
    this._dimension = new Dimension(width, height);
    this._inlineChatWidget.layout(this._dimension);
    this._inlineChatWidget.domNode.style.paddingLeft = `${xtermLeftPadding}px`;
    this._updateXtermViewportPosition();
  }
  _resetPlaceholder() {
    const defaultAgent = this._chatAgentService.getDefaultAgent(ChatAgentLocation.Terminal);
    this.inlineChatWidget.placeholder = defaultAgent?.description ?? localize("askAI", "Ask AI");
  }
  async reveal(viewState) {
    await this._createSession(viewState);
    this._doLayout();
    this._container.classList.remove("hide");
    this._visibleContextKey.set(true);
    this._resetPlaceholder();
    this._inlineChatWidget.focus();
    this._instance.scrollToBottom();
  }
  _getTerminalCursorTop() {
    const font = this._instance.xterm?.getFont();
    if (!font?.charHeight) {
      return;
    }
    const terminalWrapperHeight = this._getTerminalViewportHeight() ?? 0;
    const cellHeight = font.charHeight * font.lineHeight;
    const topPadding = terminalWrapperHeight - this._instance.rows * cellHeight;
    const cursorY = (this._instance.xterm?.raw.buffer.active.cursorY ?? 0) + 1;
    return topPadding + cursorY * cellHeight;
  }
  _updateXtermViewportPosition() {
    const top = this._getTerminalCursorTop();
    if (!top) {
      return;
    }
    this._container.style.top = `${top}px`;
    const terminalViewportHeight = this._getTerminalViewportHeight();
    if (!terminalViewportHeight) {
      return;
    }
    const widgetAllowedPercentBasedHeight = terminalViewportHeight * 0.75 /* MaxHeightPercentageOfViewport */;
    const height = Math.max(Math.min(480 /* MaxHeight */, this._inlineChatWidget.contentHeight, widgetAllowedPercentBasedHeight), this._inlineChatWidget.minHeight);
    if (top > terminalViewportHeight - height && terminalViewportHeight - height > 0) {
      this._setTerminalViewportOffset(top - (terminalViewportHeight - height));
    } else {
      this._setTerminalViewportOffset(void 0);
    }
  }
  _getTerminalViewportHeight() {
    return this._terminalElement.clientHeight;
  }
  hide() {
    this._container.classList.add("hide");
    this._inlineChatWidget.reset();
    this._resetPlaceholder();
    this._inlineChatWidget.updateToolbar(false);
    this._visibleContextKey.set(false);
    this._inlineChatWidget.value = "";
    this._instance.focus();
    this._setTerminalViewportOffset(void 0);
    this._onDidHide.fire();
  }
  _setTerminalViewportOffset(offset) {
    if (offset === void 0 || this._container.classList.contains("hide")) {
      this._terminalElement.style.position = "";
      this._terminalElement.style.bottom = "";
      TerminalStickyScrollContribution.get(this._instance)?.hideUnlock();
    } else {
      this._terminalElement.style.position = "relative";
      this._terminalElement.style.bottom = `${offset}px`;
      TerminalStickyScrollContribution.get(this._instance)?.hideLock();
    }
  }
  focus() {
    this.inlineChatWidget.focus();
  }
  hasFocus() {
    return this._inlineChatWidget.hasFocus();
  }
  setValue(value) {
    this._inlineChatWidget.value = value ?? "";
  }
  async acceptCommand(shouldExecute) {
    const code = await this.inlineChatWidget.getCodeBlockInfo(0);
    if (!code) {
      return;
    }
    const value = code.getValue();
    this._instance.runCommand(value, shouldExecute);
    this.clear();
  }
  get focusTracker() {
    return this._focusTracker;
  }
  async _createSession(viewState) {
    this._sessionCtor = createCancelablePromise(async (token) => {
      if (!this._model.value) {
        this._model.value = this._chatService.startSession(ChatAgentLocation.Terminal, token);
        const model = this._model.value;
        if (model) {
          this._inlineChatWidget.setChatModel(model, this._loadViewState());
          model.waitForInitialization().then(() => {
            if (token.isCancellationRequested) {
              return;
            }
            this._resetPlaceholder();
          });
        }
        if (!this._model.value) {
          throw new Error("Failed to start chat session");
        }
      }
    });
    this._register(toDisposable(() => this._sessionCtor?.cancel()));
  }
  _loadViewState() {
    const rawViewState = this._storageService.get(this._viewStateStorageKey, StorageScope.PROFILE, void 0);
    let viewState;
    if (rawViewState) {
      try {
        viewState = JSON.parse(rawViewState);
      } catch {
        viewState = void 0;
      }
    }
    return viewState;
  }
  _saveViewState() {
    this._storageService.store(this._viewStateStorageKey, JSON.stringify(this._inlineChatWidget.chatWidget.getViewState()), StorageScope.PROFILE, StorageTarget.USER);
  }
  clear() {
    this.cancel();
    this._model.clear();
    this._responseContainsCodeBlockContextKey.reset();
    this._requestActiveContextKey.reset();
    this.hide();
    this.setValue(void 0);
  }
  async acceptInput(query, options) {
    if (!this._model.value) {
      await this.reveal();
    }
    this._messages.fire(32 /* AcceptInput */);
    const lastInput = this._inlineChatWidget.value;
    if (!lastInput) {
      return;
    }
    this._activeRequestCts?.cancel();
    this._activeRequestCts = new CancellationTokenSource();
    const store = new DisposableStore();
    this._requestActiveContextKey.set(true);
    const response = await this._inlineChatWidget.chatWidget.acceptInput(lastInput, { isVoiceInput: options?.isVoiceInput });
    this._currentRequestId = response?.requestId;
    const responsePromise = new DeferredPromise();
    try {
      this._requestActiveContextKey.set(true);
      if (response) {
        store.add(response.onDidChange(async () => {
          if (response.isCanceled) {
            this._requestActiveContextKey.set(false);
            responsePromise.complete(void 0);
            return;
          }
          if (response.isComplete) {
            this._requestActiveContextKey.set(false);
            this._requestActiveContextKey.set(false);
            const firstCodeBlock = await this._inlineChatWidget.getCodeBlockInfo(0);
            const secondCodeBlock = await this._inlineChatWidget.getCodeBlockInfo(1);
            this._responseContainsCodeBlockContextKey.set(!!firstCodeBlock);
            this._responseContainsMulitpleCodeBlocksContextKey.set(!!secondCodeBlock);
            this._inlineChatWidget.updateToolbar(true);
            responsePromise.complete(response);
          }
        }));
      }
      await responsePromise.p;
      this._lastResponseContent = response?.response.getMarkdown();
      return response;
    } catch {
      this._lastResponseContent = void 0;
      return;
    } finally {
      store.dispose();
    }
  }
  cancel() {
    this._sessionCtor?.cancel();
    this._sessionCtor = void 0;
    this._activeRequestCts?.cancel();
    this._requestActiveContextKey.set(false);
    const model = this._inlineChatWidget.getChatModel();
    if (!model?.sessionId) {
      return;
    }
    this._chatService.cancelCurrentRequestForSession(model?.sessionId);
  }
  async viewInChat() {
    const widget = await showChatView(this._viewsService);
    const currentRequest = this._inlineChatWidget.chatWidget.viewModel?.model.getRequests().find((r) => r.id === this._currentRequestId);
    if (!widget || !currentRequest?.response) {
      return;
    }
    const message = [];
    for (const item of currentRequest.response.response.value) {
      if (item.kind === "textEditGroup") {
        for (const group of item.edits) {
          message.push({
            kind: "textEdit",
            edits: group,
            uri: item.uri
          });
        }
      } else if (item.kind === "notebookEditGroup") {
        for (const group of item.edits) {
          if (isCellTextEditOperation(group)) {
            message.push({
              kind: "textEdit",
              edits: [group.edit],
              uri: group.uri
            });
          } else {
            message.push({
              kind: "notebookEdit",
              edits: [group],
              uri: item.uri
            });
          }
        }
      } else {
        message.push(item);
      }
    }
    this._chatService.addCompleteRequest(
      widget.viewModel.sessionId,
      `@${this._terminalAgentName} ${currentRequest.message.text}`,
      currentRequest.variableData,
      currentRequest.attempt,
      {
        message,
        result: currentRequest.response.result,
        followups: currentRequest.response.followups
      }
    );
    widget.focusLastMessage();
    this.hide();
  }
};
TerminalChatWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IChatService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IViewsService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IChatAgentService)
], TerminalChatWidget);
export {
  TerminalChatWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvY2hhdC9icm93c2VyL3Rlcm1pbmFsQ2hhdFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgVGVybWluYWwgYXMgUmF3WHRlcm1UZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBEaW1lbnNpb24sIGdldEFjdGl2ZVdpbmRvdywgSUZvY3VzVHJhY2tlciwgdHJhY2tGb2N1cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBvYnNlcnZhYmxlVmFsdWUsIHR5cGUgSU9ic2VydmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IE1pY3JvdGFza0RlbGF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3ltYm9scy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0QWNjZXB0SW5wdXRPcHRpb25zLCBzaG93Q2hhdFZpZXcgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdC5qcyc7XG5pbXBvcnQgdHlwZSB7IElDaGF0Vmlld1N0YXRlIH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9icm93c2VyL2NoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IENoYXRNb2RlbCwgSUNoYXRSZXNwb25zZU1vZGVsLCBpc0NlbGxUZXh0RWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJQ2hhdFByb2dyZXNzLCBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NoYXQvY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0V2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9icm93c2VyL2lubGluZUNoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU0VDT05EQVJZIH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxJbnN0YW5jZSwgdHlwZSBJWHRlcm1UZXJtaW5hbCB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdGlja3lTY3JvbGxDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi9zdGlja3lTY3JvbGwvYnJvd3Nlci90ZXJtaW5hbFN0aWNreVNjcm9sbENvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvdGVybWluYWxDaGF0V2lkZ2V0LmNzcyc7XG5pbXBvcnQgeyBNRU5VX1RFUk1JTkFMX0NIQVRfV0lER0VUX0lOUFVUX1NJREVfVE9PTEJBUiwgTUVOVV9URVJNSU5BTF9DSEFUX1dJREdFVF9TVEFUVVMsIFRlcm1pbmFsQ2hhdENvbW1hbmRJZCwgVGVybWluYWxDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuL3Rlcm1pbmFsQ2hhdC5qcyc7XG5cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0SG9yaXpvbnRhbE1hcmdpbiA9IDEwLFxuXHRWZXJ0aWNhbE1hcmdpbiA9IDMwLFxuXHQvKiogVGhlIHJpZ2h0IHBhZGRpbmcgb2YgdGhlIHdpZGdldCwgdGhpcyBzaG91bGQgYWxpZ24gZXhhY3RseSB3aXRoIHRoYXQgaW4gdGhlIGVkaXRvci4gKi9cblx0UmlnaHRQYWRkaW5nID0gMTIsXG5cdC8qKiBUaGUgbWF4IGFsbG93ZWQgaGVpZ2h0IG9mIHRoZSB3aWRnZXQuICovXG5cdE1heEhlaWdodCA9IDQ4MCxcblx0LyoqIFRoZSBtYXggYWxsb3dlZCBoZWlnaHQgb2YgdGhlIHdpZGdldCBhcyBhIHBlcmNlbnRhZ2Ugb2YgdGhlIHRlcm1pbmFsIHZpZXdwb3J0LiAqL1xuXHRNYXhIZWlnaHRQZXJjZW50YWdlT2ZWaWV3cG9ydCA9IDAuNzUsXG59XG5cbmNvbnN0IGVudW0gTWVzc2FnZSB7XG5cdE5vbmUgPSAwLFxuXHRBY2NlcHRTZXNzaW9uID0gMSA8PCAwLFxuXHRDYW5jZWxTZXNzaW9uID0gMSA8PCAxLFxuXHRQYXVzZVNlc3Npb24gPSAxIDw8IDIsXG5cdENhbmNlbFJlcXVlc3QgPSAxIDw8IDMsXG5cdENhbmNlbElucHV0ID0gMSA8PCA0LFxuXHRBY2NlcHRJbnB1dCA9IDEgPDwgNSxcblx0UmV0dXJuSW5wdXQgPSAxIDw8IDYsXG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbENoYXRXaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250YWluZXI6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkSGlkZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEhpZGUgPSB0aGlzLl9vbkRpZEhpZGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lQ2hhdFdpZGdldDogSW5saW5lQ2hhdFdpZGdldDtcblx0cHVibGljIGdldCBpbmxpbmVDaGF0V2lkZ2V0KCk6IElubGluZUNoYXRXaWRnZXQgeyByZXR1cm4gdGhpcy5faW5saW5lQ2hhdFdpZGdldDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZvY3VzVHJhY2tlcjogSUZvY3VzVHJhY2tlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c2VkQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Zpc2libGVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0QWN0aXZlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc3BvbnNlQ29udGFpbnNDb2RlQmxvY2tDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVzcG9uc2VDb250YWluc011bGl0cGxlQ29kZUJsb2Nrc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgX21lc3NhZ2VzID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBFbWl0dGVyPE1lc3NhZ2U+KCkpO1xuXG5cdHByaXZhdGUgX3ZpZXdTdGF0ZVN0b3JhZ2VLZXkgPSAndGVybWluYWwtaW5saW5lLWNoYXQtdmlldy1zdGF0ZSc7XG5cblx0cHJpdmF0ZSBfbGFzdFJlc3BvbnNlQ29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbGFzdFJlc3BvbnNlQ29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9sYXN0UmVzcG9uc2VDb250ZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBfdGVybWluYWxBZ2VudE5hbWUgPSAndGVybWluYWwnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsOiBNdXRhYmxlRGlzcG9zYWJsZTxDaGF0TW9kZWw+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgX3Nlc3Npb25DdG9yOiBDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jdXJyZW50UmVxdWVzdElkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2FjdGl2ZVJlcXVlc3RDdHM/OiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0SW5Qcm9ncmVzcyA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cdHJlYWRvbmx5IHJlcXVlc3RJblByb2dyZXNzOiBJT2JzZXJ2YWJsZTxib29sZWFuPiA9IHRoaXMuX3JlcXVlc3RJblByb2dyZXNzO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsRWxlbWVudDogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3h0ZXJtOiBJWHRlcm1UZXJtaW5hbCAmIHsgcmF3OiBSYXdYdGVybVRlcm1pbmFsIH0sXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9mb2N1c2VkQ29udGV4dEtleSA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLmZvY3VzZWQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl92aXNpYmxlQ29udGV4dEtleSA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLnZpc2libGUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZXF1ZXN0QWN0aXZlQ29udGV4dEtleSA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLnJlcXVlc3RBY3RpdmUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZXNwb25zZUNvbnRhaW5zQ29kZUJsb2NrQ29udGV4dEtleSA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlQ29udGFpbnNDb2RlQmxvY2suYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZXNwb25zZUNvbnRhaW5zTXVsaXRwbGVDb2RlQmxvY2tzQ29udGV4dEtleSA9IFRlcm1pbmFsQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlQ29udGFpbnNNdWx0aXBsZUNvZGVCbG9ja3MuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX2NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCd0ZXJtaW5hbC1pbmxpbmUtY2hhdCcpO1xuXHRcdHRoaXMuX3Rlcm1pbmFsRWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLl9jb250YWluZXIpO1xuXG5cdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0SW5saW5lQ2hhdFdpZGdldCxcblx0XHRcdHtcblx0XHRcdFx0bG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsLFxuXHRcdFx0XHRyZXNvbHZlRGF0YTogKCkgPT4ge1xuXHRcdFx0XHRcdC8vIFRPRE9AbWVnYW5yb2dnZSByZXR1cm4gc29tZXRoaW5nIHRoYXQgaWRlbnRpZmllcyB0aGlzIHRlcm1pbmFsXG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0c3RhdHVzTWVudUlkOiB7XG5cdFx0XHRcdFx0bWVudTogTUVOVV9URVJNSU5BTF9DSEFUX1dJREdFVF9TVEFUVVMsXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0YnV0dG9uQ29uZmlnUHJvdmlkZXI6IGFjdGlvbiA9PiAoe1xuXHRcdFx0XHRcdFx0XHRzaG93TGFiZWw6IGFjdGlvbi5pZCAhPT0gVGVybWluYWxDaGF0Q29tbWFuZElkLlJlcnVuUmVxdWVzdCxcblx0XHRcdFx0XHRcdFx0c2hvd0ljb246IGFjdGlvbi5pZCA9PT0gVGVybWluYWxDaGF0Q29tbWFuZElkLlJlcnVuUmVxdWVzdCxcblx0XHRcdFx0XHRcdFx0aXNTZWNvbmRhcnk6IGFjdGlvbi5pZCAhPT0gVGVybWluYWxDaGF0Q29tbWFuZElkLlJ1bkNvbW1hbmQgJiYgYWN0aW9uLmlkICE9PSBUZXJtaW5hbENoYXRDb21tYW5kSWQuUnVuRmlyc3RDb21tYW5kXG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0c2Vjb25kYXJ5TWVudUlkOiBNRU5VX0lOTElORV9DSEFUX1dJREdFVF9TRUNPTkRBUlksXG5cdFx0XHRcdGNoYXRXaWRnZXRWaWV3T3B0aW9uczoge1xuXHRcdFx0XHRcdG1lbnVzOiB7XG5cdFx0XHRcdFx0XHR0ZWxlbWV0cnlTb3VyY2U6ICd0ZXJtaW5hbC1pbmxpbmUtY2hhdCcsXG5cdFx0XHRcdFx0XHRleGVjdXRlVG9vbGJhcjogTWVudUlkLkNoYXRFeGVjdXRlLFxuXHRcdFx0XHRcdFx0aW5wdXRTaWRlVG9vbGJhcjogTUVOVV9URVJNSU5BTF9DSEFUX1dJREdFVF9JTlBVVF9TSURFX1RPT0xCQVIsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5faW5saW5lQ2hhdFdpZGdldC5jaGF0V2lkZ2V0Lm9uRGlkQ2hhbmdlVmlld01vZGVsKCgpID0+IHRoaXMuX3NhdmVWaWV3U3RhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShcblx0XHRcdHRoaXMuX2lubGluZUNoYXRXaWRnZXQub25EaWRDaGFuZ2VIZWlnaHQsXG5cdFx0XHR0aGlzLl9pbnN0YW5jZS5vbkRpbWVuc2lvbnNDaGFuZ2VkLFxuXHRcdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldC5jaGF0V2lkZ2V0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCxcblx0XHRcdEV2ZW50LmRlYm91bmNlKHRoaXMuX3h0ZXJtLnJhdy5vbkN1cnNvck1vdmUsICgpID0+IHZvaWQgMCwgTWljcm90YXNrRGVsYXkpLFxuXHRcdCkoKCkgPT4gdGhpcy5fcmVsYXlvdXQoKSkpO1xuXG5cdFx0Y29uc3Qgb2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKCkgPT4gdGhpcy5fcmVsYXlvdXQoKSk7XG5cdFx0b2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLl90ZXJtaW5hbEVsZW1lbnQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBvYnNlcnZlci5kaXNjb25uZWN0KCkpKTtcblxuXHRcdHRoaXMuX3Jlc2V0UGxhY2Vob2xkZXIoKTtcblx0XHR0aGlzLl9jb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5faW5saW5lQ2hhdFdpZGdldC5kb21Ob2RlKTtcblxuXHRcdHRoaXMuX2ZvY3VzVHJhY2tlciA9IHRoaXMuX3JlZ2lzdGVyKHRyYWNrRm9jdXModGhpcy5fY29udGFpbmVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5fZm9jdXNlZENvbnRleHRLZXkuc2V0KHRydWUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB0aGlzLl9mb2N1c2VkQ29udGV4dEtleS5zZXQoZmFsc2UpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuKHIgPT4ge1xuXHRcdFx0Y29uc3QgaXNCdXN5ID0gdGhpcy5faW5saW5lQ2hhdFdpZGdldC5yZXF1ZXN0SW5Qcm9ncmVzcy5yZWFkKHIpO1xuXHRcdFx0dGhpcy5fY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2J1c3knLCBpc0J1c3kpO1xuXG5cdFx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LnRvZ2dsZVN0YXR1cyghIXRoaXMuX2lubGluZUNoYXRXaWRnZXQucmVzcG9uc2VDb250ZW50KTtcblxuXHRcdFx0aWYgKGlzQnVzeSB8fCAhdGhpcy5faW5saW5lQ2hhdFdpZGdldC5yZXNwb25zZUNvbnRlbnQpIHtcblx0XHRcdFx0dGhpcy5fcmVzcG9uc2VDb250YWluc0NvZGVCbG9ja0NvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fcmVzcG9uc2VDb250YWluc011bGl0cGxlQ29kZUJsb2Nrc0NvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFByb21pc2UuYWxsKFtcblx0XHRcdFx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LmdldENvZGVCbG9ja0luZm8oMCksXG5cdFx0XHRcdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldC5nZXRDb2RlQmxvY2tJbmZvKDEpXG5cdFx0XHRcdF0pLnRoZW4oKFtmaXJzdENvZGVCbG9jaywgc2Vjb25kQ29kZUJsb2NrXSkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX3Jlc3BvbnNlQ29udGFpbnNDb2RlQmxvY2tDb250ZXh0S2V5LnNldCghIWZpcnN0Q29kZUJsb2NrKTtcblx0XHRcdFx0XHR0aGlzLl9yZXNwb25zZUNvbnRhaW5zTXVsaXRwbGVDb2RlQmxvY2tzQ29udGV4dEtleS5zZXQoISFzZWNvbmRDb2RlQmxvY2spO1xuXHRcdFx0XHRcdHRoaXMuX2lubGluZUNoYXRXaWRnZXQudXBkYXRlVG9vbGJhcih0cnVlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5oaWRlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9kaW1lbnNpb24/OiBEaW1lbnNpb247XG5cblx0cHJpdmF0ZSBfcmVsYXlvdXQoKSB7XG5cdFx0aWYgKHRoaXMuX2RpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5fZG9MYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kb0xheW91dCgpIHtcblx0XHRjb25zdCB4dGVybUVsZW1lbnQgPSB0aGlzLl94dGVybS5yYXchLmVsZW1lbnQ7XG5cdFx0aWYgKCF4dGVybUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdHlsZSA9IGdldEFjdGl2ZVdpbmRvdygpLmdldENvbXB1dGVkU3R5bGUoeHRlcm1FbGVtZW50KTtcblxuXHRcdC8vIENhbGN1bGF0ZSB3aWR0aFxuXHRcdGNvbnN0IHh0ZXJtTGVmdFBhZGRpbmcgPSBwYXJzZUludChzdHlsZS5wYWRkaW5nTGVmdCk7XG5cdFx0Y29uc3Qgd2lkdGggPSB4dGVybUVsZW1lbnQuY2xpZW50V2lkdGggLSB4dGVybUxlZnRQYWRkaW5nIC0gQ29uc3RhbnRzLlJpZ2h0UGFkZGluZztcblx0XHRpZiAod2lkdGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBDYWxjdWxhdGUgaGVpZ2h0XG5cdFx0Y29uc3QgdGVybWluYWxWaWV3cG9ydEhlaWdodCA9IHRoaXMuX2dldFRlcm1pbmFsVmlld3BvcnRIZWlnaHQoKTtcblx0XHRjb25zdCB3aWRnZXRBbGxvd2VkUGVyY2VudEJhc2VkSGVpZ2h0ID0gKHRlcm1pbmFsVmlld3BvcnRIZWlnaHQgPz8gMCkgKiBDb25zdGFudHMuTWF4SGVpZ2h0UGVyY2VudGFnZU9mVmlld3BvcnQ7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoTWF0aC5taW4oQ29uc3RhbnRzLk1heEhlaWdodCwgdGhpcy5faW5saW5lQ2hhdFdpZGdldC5jb250ZW50SGVpZ2h0LCB3aWRnZXRBbGxvd2VkUGVyY2VudEJhc2VkSGVpZ2h0KSwgdGhpcy5faW5saW5lQ2hhdFdpZGdldC5taW5IZWlnaHQpO1xuXHRcdGlmIChoZWlnaHQgPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMYXlvdXRcblx0XHR0aGlzLl9kaW1lbnNpb24gPSBuZXcgRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdHRoaXMuX2lubGluZUNoYXRXaWRnZXQubGF5b3V0KHRoaXMuX2RpbWVuc2lvbik7XG5cdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldC5kb21Ob2RlLnN0eWxlLnBhZGRpbmdMZWZ0ID0gYCR7eHRlcm1MZWZ0UGFkZGluZ31weGA7XG5cdFx0dGhpcy5fdXBkYXRlWHRlcm1WaWV3cG9ydFBvc2l0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNldFBsYWNlaG9sZGVyKCkge1xuXHRcdGNvbnN0IGRlZmF1bHRBZ2VudCA9IHRoaXMuX2NoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsKTtcblx0XHR0aGlzLmlubGluZUNoYXRXaWRnZXQucGxhY2Vob2xkZXIgPSBkZWZhdWx0QWdlbnQ/LmRlc2NyaXB0aW9uID8/IGxvY2FsaXplKCdhc2tBSScsICdBc2sgQUknKTtcblx0fVxuXG5cdGFzeW5jIHJldmVhbCh2aWV3U3RhdGU/OiBJQ2hhdFZpZXdTdGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2NyZWF0ZVNlc3Npb24odmlld1N0YXRlKTtcblx0XHR0aGlzLl9kb0xheW91dCgpO1xuXHRcdHRoaXMuX2NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cdFx0dGhpcy5fdmlzaWJsZUNvbnRleHRLZXkuc2V0KHRydWUpO1xuXHRcdHRoaXMuX3Jlc2V0UGxhY2Vob2xkZXIoKTtcblx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LmZvY3VzKCk7XG5cdFx0dGhpcy5faW5zdGFuY2Uuc2Nyb2xsVG9Cb3R0b20oKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFRlcm1pbmFsQ3Vyc29yVG9wKCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZm9udCA9IHRoaXMuX2luc3RhbmNlLnh0ZXJtPy5nZXRGb250KCk7XG5cdFx0aWYgKCFmb250Py5jaGFySGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRlcm1pbmFsV3JhcHBlckhlaWdodCA9IHRoaXMuX2dldFRlcm1pbmFsVmlld3BvcnRIZWlnaHQoKSA/PyAwO1xuXHRcdGNvbnN0IGNlbGxIZWlnaHQgPSBmb250LmNoYXJIZWlnaHQgKiBmb250LmxpbmVIZWlnaHQ7XG5cdFx0Y29uc3QgdG9wUGFkZGluZyA9IHRlcm1pbmFsV3JhcHBlckhlaWdodCAtICh0aGlzLl9pbnN0YW5jZS5yb3dzICogY2VsbEhlaWdodCk7XG5cdFx0Y29uc3QgY3Vyc29yWSA9ICh0aGlzLl9pbnN0YW5jZS54dGVybT8ucmF3LmJ1ZmZlci5hY3RpdmUuY3Vyc29yWSA/PyAwKSArIDE7XG5cdFx0cmV0dXJuIHRvcFBhZGRpbmcgKyBjdXJzb3JZICogY2VsbEhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVh0ZXJtVmlld3BvcnRQb3NpdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0b3AgPSB0aGlzLl9nZXRUZXJtaW5hbEN1cnNvclRvcCgpO1xuXHRcdGlmICghdG9wKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2NvbnRhaW5lci5zdHlsZS50b3AgPSBgJHt0b3B9cHhgO1xuXHRcdGNvbnN0IHRlcm1pbmFsVmlld3BvcnRIZWlnaHQgPSB0aGlzLl9nZXRUZXJtaW5hbFZpZXdwb3J0SGVpZ2h0KCk7XG5cdFx0aWYgKCF0ZXJtaW5hbFZpZXdwb3J0SGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2lkZ2V0QWxsb3dlZFBlcmNlbnRCYXNlZEhlaWdodCA9IHRlcm1pbmFsVmlld3BvcnRIZWlnaHQgKiBDb25zdGFudHMuTWF4SGVpZ2h0UGVyY2VudGFnZU9mVmlld3BvcnQ7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5tYXgoTWF0aC5taW4oQ29uc3RhbnRzLk1heEhlaWdodCwgdGhpcy5faW5saW5lQ2hhdFdpZGdldC5jb250ZW50SGVpZ2h0LCB3aWRnZXRBbGxvd2VkUGVyY2VudEJhc2VkSGVpZ2h0KSwgdGhpcy5faW5saW5lQ2hhdFdpZGdldC5taW5IZWlnaHQpO1xuXHRcdGlmICh0b3AgPiB0ZXJtaW5hbFZpZXdwb3J0SGVpZ2h0IC0gaGVpZ2h0ICYmIHRlcm1pbmFsVmlld3BvcnRIZWlnaHQgLSBoZWlnaHQgPiAwKSB7XG5cdFx0XHR0aGlzLl9zZXRUZXJtaW5hbFZpZXdwb3J0T2Zmc2V0KHRvcCAtICh0ZXJtaW5hbFZpZXdwb3J0SGVpZ2h0IC0gaGVpZ2h0KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3NldFRlcm1pbmFsVmlld3BvcnRPZmZzZXQodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUZXJtaW5hbFZpZXdwb3J0SGVpZ2h0KCk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsRWxlbWVudC5jbGllbnRIZWlnaHQ7XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldC5yZXNldCgpO1xuXHRcdHRoaXMuX3Jlc2V0UGxhY2Vob2xkZXIoKTtcblx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LnVwZGF0ZVRvb2xiYXIoZmFsc2UpO1xuXHRcdHRoaXMuX3Zpc2libGVDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0dGhpcy5faW5saW5lQ2hhdFdpZGdldC52YWx1ZSA9ICcnO1xuXHRcdHRoaXMuX2luc3RhbmNlLmZvY3VzKCk7XG5cdFx0dGhpcy5fc2V0VGVybWluYWxWaWV3cG9ydE9mZnNldCh1bmRlZmluZWQpO1xuXHRcdHRoaXMuX29uRGlkSGlkZS5maXJlKCk7XG5cdH1cblx0cHJpdmF0ZSBfc2V0VGVybWluYWxWaWV3cG9ydE9mZnNldChvZmZzZXQ6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuXHRcdGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCB8fCB0aGlzLl9jb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRlJykpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsRWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICcnO1xuXHRcdFx0dGhpcy5fdGVybWluYWxFbGVtZW50LnN0eWxlLmJvdHRvbSA9ICcnO1xuXHRcdFx0VGVybWluYWxTdGlja3lTY3JvbGxDb250cmlidXRpb24uZ2V0KHRoaXMuX2luc3RhbmNlKT8uaGlkZVVubG9jaygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXHRcdFx0dGhpcy5fdGVybWluYWxFbGVtZW50LnN0eWxlLmJvdHRvbSA9IGAke29mZnNldH1weGA7XG5cdFx0XHRUZXJtaW5hbFN0aWNreVNjcm9sbENvbnRyaWJ1dGlvbi5nZXQodGhpcy5faW5zdGFuY2UpPy5oaWRlTG9jaygpO1xuXHRcdH1cblx0fVxuXHRmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLmlubGluZUNoYXRXaWRnZXQuZm9jdXMoKTtcblx0fVxuXHRoYXNGb2N1cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faW5saW5lQ2hhdFdpZGdldC5oYXNGb2N1cygpO1xuXHR9XG5cblx0c2V0VmFsdWUodmFsdWU/OiBzdHJpbmcpIHtcblx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LnZhbHVlID0gdmFsdWUgPz8gJyc7XG5cdH1cblxuXHRhc3luYyBhY2NlcHRDb21tYW5kKHNob3VsZEV4ZWN1dGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb2RlID0gYXdhaXQgdGhpcy5pbmxpbmVDaGF0V2lkZ2V0LmdldENvZGVCbG9ja0luZm8oMCk7XG5cdFx0aWYgKCFjb2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHZhbHVlID0gY29kZS5nZXRWYWx1ZSgpO1xuXHRcdHRoaXMuX2luc3RhbmNlLnJ1bkNvbW1hbmQodmFsdWUsIHNob3VsZEV4ZWN1dGUpO1xuXHRcdHRoaXMuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZm9jdXNUcmFja2VyKCk6IElGb2N1c1RyYWNrZXIge1xuXHRcdHJldHVybiB0aGlzLl9mb2N1c1RyYWNrZXI7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVTZXNzaW9uKHZpZXdTdGF0ZT86IElDaGF0Vmlld1N0YXRlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fc2Vzc2lvbkN0b3IgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZTx2b2lkPihhc3luYyB0b2tlbiA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX21vZGVsLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuX21vZGVsLnZhbHVlID0gdGhpcy5fY2hhdFNlcnZpY2Uuc3RhcnRTZXNzaW9uKENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsLCB0b2tlbik7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwudmFsdWU7XG5cdFx0XHRcdGlmIChtb2RlbCkge1xuXHRcdFx0XHRcdHRoaXMuX2lubGluZUNoYXRXaWRnZXQuc2V0Q2hhdE1vZGVsKG1vZGVsLCB0aGlzLl9sb2FkVmlld1N0YXRlKCkpO1xuXHRcdFx0XHRcdG1vZGVsLndhaXRGb3JJbml0aWFsaXphdGlvbigpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHRoaXMuX3Jlc2V0UGxhY2Vob2xkZXIoKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXRoaXMuX21vZGVsLnZhbHVlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gc3RhcnQgY2hhdCBzZXNzaW9uJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5fc2Vzc2lvbkN0b3I/LmNhbmNlbCgpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9sb2FkVmlld1N0YXRlKCkge1xuXHRcdGNvbnN0IHJhd1ZpZXdTdGF0ZSA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLl92aWV3U3RhdGVTdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgdW5kZWZpbmVkKTtcblx0XHRsZXQgdmlld1N0YXRlOiBJQ2hhdFZpZXdTdGF0ZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAocmF3Vmlld1N0YXRlKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR2aWV3U3RhdGUgPSBKU09OLnBhcnNlKHJhd1ZpZXdTdGF0ZSk7XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0dmlld1N0YXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdmlld1N0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2F2ZVZpZXdTdGF0ZSgpIHtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSh0aGlzLl92aWV3U3RhdGVTdG9yYWdlS2V5LCBKU09OLnN0cmluZ2lmeSh0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LmNoYXRXaWRnZXQuZ2V0Vmlld1N0YXRlKCkpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0dGhpcy5fbW9kZWwuY2xlYXIoKTtcblx0XHR0aGlzLl9yZXNwb25zZUNvbnRhaW5zQ29kZUJsb2NrQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdHRoaXMuX3JlcXVlc3RBY3RpdmVDb250ZXh0S2V5LnJlc2V0KCk7XG5cdFx0dGhpcy5oaWRlKCk7XG5cdFx0dGhpcy5zZXRWYWx1ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0SW5wdXQocXVlcnk/OiBzdHJpbmcsIG9wdGlvbnM/OiBJQ2hhdEFjY2VwdElucHV0T3B0aW9ucyk6IFByb21pc2U8SUNoYXRSZXNwb25zZU1vZGVsIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl9tb2RlbC52YWx1ZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5yZXZlYWwoKTtcblx0XHR9XG5cdFx0dGhpcy5fbWVzc2FnZXMuZmlyZShNZXNzYWdlLkFjY2VwdElucHV0KTtcblx0XHRjb25zdCBsYXN0SW5wdXQgPSB0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LnZhbHVlO1xuXHRcdGlmICghbGFzdElucHV0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2FjdGl2ZVJlcXVlc3RDdHM/LmNhbmNlbCgpO1xuXHRcdHRoaXMuX2FjdGl2ZVJlcXVlc3RDdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLl9yZXF1ZXN0QWN0aXZlQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LmNoYXRXaWRnZXQuYWNjZXB0SW5wdXQobGFzdElucHV0LCB7IGlzVm9pY2VJbnB1dDogb3B0aW9ucz8uaXNWb2ljZUlucHV0IH0pO1xuXHRcdHRoaXMuX2N1cnJlbnRSZXF1ZXN0SWQgPSByZXNwb25zZT8ucmVxdWVzdElkO1xuXHRcdGNvbnN0IHJlc3BvbnNlUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8SUNoYXRSZXNwb25zZU1vZGVsIHwgdW5kZWZpbmVkPigpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9yZXF1ZXN0QWN0aXZlQ29udGV4dEtleS5zZXQodHJ1ZSk7XG5cdFx0XHRpZiAocmVzcG9uc2UpIHtcblx0XHRcdFx0c3RvcmUuYWRkKHJlc3BvbnNlLm9uRGlkQ2hhbmdlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRpZiAocmVzcG9uc2UuaXNDYW5jZWxlZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVxdWVzdEFjdGl2ZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRcdHJlc3BvbnNlUHJvbWlzZS5jb21wbGV0ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAocmVzcG9uc2UuaXNDb21wbGV0ZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVxdWVzdEFjdGl2ZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRcdHRoaXMuX3JlcXVlc3RBY3RpdmVDb250ZXh0S2V5LnNldChmYWxzZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBmaXJzdENvZGVCbG9jayA9IGF3YWl0IHRoaXMuX2lubGluZUNoYXRXaWRnZXQuZ2V0Q29kZUJsb2NrSW5mbygwKTtcblx0XHRcdFx0XHRcdGNvbnN0IHNlY29uZENvZGVCbG9jayA9IGF3YWl0IHRoaXMuX2lubGluZUNoYXRXaWRnZXQuZ2V0Q29kZUJsb2NrSW5mbygxKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Jlc3BvbnNlQ29udGFpbnNDb2RlQmxvY2tDb250ZXh0S2V5LnNldCghIWZpcnN0Q29kZUJsb2NrKTtcblx0XHRcdFx0XHRcdHRoaXMuX3Jlc3BvbnNlQ29udGFpbnNNdWxpdHBsZUNvZGVCbG9ja3NDb250ZXh0S2V5LnNldCghIXNlY29uZENvZGVCbG9jayk7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbmxpbmVDaGF0V2lkZ2V0LnVwZGF0ZVRvb2xiYXIodHJ1ZSk7XG5cdFx0XHRcdFx0XHRyZXNwb25zZVByb21pc2UuY29tcGxldGUocmVzcG9uc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgcmVzcG9uc2VQcm9taXNlLnA7XG5cdFx0XHR0aGlzLl9sYXN0UmVzcG9uc2VDb250ZW50ID0gcmVzcG9uc2U/LnJlc3BvbnNlLmdldE1hcmtkb3duKCk7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHR0aGlzLl9sYXN0UmVzcG9uc2VDb250ZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0Y2FuY2VsKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nlc3Npb25DdG9yPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9zZXNzaW9uQ3RvciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9hY3RpdmVSZXF1ZXN0Q3RzPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9yZXF1ZXN0QWN0aXZlQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5faW5saW5lQ2hhdFdpZGdldC5nZXRDaGF0TW9kZWwoKTtcblx0XHRpZiAoIW1vZGVsPy5zZXNzaW9uSWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY2hhdFNlcnZpY2UuY2FuY2VsQ3VycmVudFJlcXVlc3RGb3JTZXNzaW9uKG1vZGVsPy5zZXNzaW9uSWQpO1xuXHR9XG5cblx0YXN5bmMgdmlld0luQ2hhdCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aWRnZXQgPSBhd2FpdCBzaG93Q2hhdFZpZXcodGhpcy5fdmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCBjdXJyZW50UmVxdWVzdCA9IHRoaXMuX2lubGluZUNoYXRXaWRnZXQuY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsLmdldFJlcXVlc3RzKCkuZmluZChyID0+IHIuaWQgPT09IHRoaXMuX2N1cnJlbnRSZXF1ZXN0SWQpO1xuXHRcdGlmICghd2lkZ2V0IHx8ICFjdXJyZW50UmVxdWVzdD8ucmVzcG9uc2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlOiBJQ2hhdFByb2dyZXNzW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgY3VycmVudFJlcXVlc3QucmVzcG9uc2UucmVzcG9uc2UudmFsdWUpIHtcblx0XHRcdGlmIChpdGVtLmtpbmQgPT09ICd0ZXh0RWRpdEdyb3VwJykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIGl0ZW0uZWRpdHMpIHtcblx0XHRcdFx0XHRtZXNzYWdlLnB1c2goe1xuXHRcdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHRcdGVkaXRzOiBncm91cCxcblx0XHRcdFx0XHRcdHVyaTogaXRlbS51cmlcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChpdGVtLmtpbmQgPT09ICdub3RlYm9va0VkaXRHcm91cCcpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBpdGVtLmVkaXRzKSB7XG5cdFx0XHRcdFx0aWYgKGlzQ2VsbFRleHRFZGl0T3BlcmF0aW9uKGdyb3VwKSkge1xuXHRcdFx0XHRcdFx0bWVzc2FnZS5wdXNoKHtcblx0XHRcdFx0XHRcdFx0a2luZDogJ3RleHRFZGl0Jyxcblx0XHRcdFx0XHRcdFx0ZWRpdHM6IFtncm91cC5lZGl0XSxcblx0XHRcdFx0XHRcdFx0dXJpOiBncm91cC51cmlcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRtZXNzYWdlLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRraW5kOiAnbm90ZWJvb2tFZGl0Jyxcblx0XHRcdFx0XHRcdFx0ZWRpdHM6IFtncm91cF0sXG5cdFx0XHRcdFx0XHRcdHVyaTogaXRlbS51cmlcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bWVzc2FnZS5wdXNoKGl0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX2NoYXRTZXJ2aWNlLmFkZENvbXBsZXRlUmVxdWVzdCh3aWRnZXQhLnZpZXdNb2RlbCEuc2Vzc2lvbklkLFxuXHRcdFx0YEAke3RoaXMuX3Rlcm1pbmFsQWdlbnROYW1lfSAke2N1cnJlbnRSZXF1ZXN0Lm1lc3NhZ2UudGV4dH1gLFxuXHRcdFx0Y3VycmVudFJlcXVlc3QudmFyaWFibGVEYXRhLFxuXHRcdFx0Y3VycmVudFJlcXVlc3QuYXR0ZW1wdCxcblx0XHRcdHtcblx0XHRcdFx0bWVzc2FnZSxcblx0XHRcdFx0cmVzdWx0OiBjdXJyZW50UmVxdWVzdC5yZXNwb25zZSEucmVzdWx0LFxuXHRcdFx0XHRmb2xsb3d1cHM6IGN1cnJlbnRSZXF1ZXN0LnJlc3BvbnNlIS5mb2xsb3d1cHNcblx0XHRcdH0pO1xuXHRcdHdpZGdldC5mb2N1c0xhc3RNZXNzYWdlKCk7XG5cdFx0dGhpcy5oaWRlKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBTUEsU0FBUyxXQUFX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
