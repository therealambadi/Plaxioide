import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { marked } from "../../../../../base/common/marked/marked.js";
import { observableFromEvent, waitForState } from "../../../../../base/common/observable.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { IBulkEditService } from "../../../../../editor/browser/services/bulkEditService.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { ResourceNotebookCellEdit } from "../../../bulkEdit/browser/bulkCellEdits.js";
import { MENU_INLINE_CHAT_WIDGET_SECONDARY } from "../../../inlineChat/common/inlineChat.js";
import { CellEditType, CellKind, NOTEBOOK_EDITOR_ID } from "../../../notebook/common/notebookCommon.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../notebook/common/notebookContextKeys.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/chatContextKeys.js";
import { applyingChatEditsFailedContextKey, ChatEditingSessionState, IChatEditingService, isChatEditingActionContext } from "../../common/chatEditingService.js";
import { ChatAgentVoteDirection, IChatService } from "../../common/chatService.js";
import { isRequestVM, isResponseVM } from "../../common/chatViewModel.js";
import { ChatAgentLocation, ChatMode } from "../../common/constants.js";
import { EditsViewId, IChatWidgetService } from "../chat.js";
import { ChatViewPane } from "../chatViewPane.js";
import { CHAT_CATEGORY } from "./chatActions.js";
const MarkUnhelpfulActionId = "workbench.action.chat.markUnhelpful";
const enableFeedbackConfig = "config.telemetry.feedback.enabled";
function registerChatTitleActions() {
  registerAction2(class MarkHelpfulAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.markHelpful",
        title: localize2("interactive.helpful.label", "Helpful"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.thumbsup,
        toggled: ChatContextKeys.responseVote.isEqualTo("up"),
        menu: [{
          id: MenuId.ChatMessageFooter,
          group: "navigation",
          order: 1,
          when: ContextKeyExpr.and(ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
        }, {
          id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
          group: "navigation",
          order: 1,
          when: ContextKeyExpr.and(ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
        }]
      });
    }
    run(accessor, ...args) {
      const item = args[0];
      if (!isResponseVM(item)) {
        return;
      }
      const chatService = accessor.get(IChatService);
      chatService.notifyUserAction({
        agentId: item.agent?.id,
        command: item.slashCommand?.name,
        sessionId: item.sessionId,
        requestId: item.requestId,
        result: item.result,
        action: {
          kind: "vote",
          direction: ChatAgentVoteDirection.Up,
          reason: void 0
        }
      });
      item.setVote(ChatAgentVoteDirection.Up);
      item.setVoteDownReason(void 0);
    }
  });
  registerAction2(class MarkUnhelpfulAction extends Action2 {
    constructor() {
      super({
        id: MarkUnhelpfulActionId,
        title: localize2("interactive.unhelpful.label", "Unhelpful"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.thumbsdown,
        toggled: ChatContextKeys.responseVote.isEqualTo("down"),
        menu: [{
          id: MenuId.ChatMessageFooter,
          group: "navigation",
          order: 2,
          when: ContextKeyExpr.and(ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
        }, {
          id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
          group: "navigation",
          order: 2,
          when: ContextKeyExpr.and(ChatContextKeys.isResponse, ChatContextKeys.responseHasError.negate(), ContextKeyExpr.has(enableFeedbackConfig))
        }]
      });
    }
    run(accessor, ...args) {
      const item = args[0];
      if (!isResponseVM(item)) {
        return;
      }
      const reason = args[1];
      if (typeof reason !== "string") {
        return;
      }
      item.setVote(ChatAgentVoteDirection.Down);
      item.setVoteDownReason(reason);
      const chatService = accessor.get(IChatService);
      chatService.notifyUserAction({
        agentId: item.agent?.id,
        command: item.slashCommand?.name,
        sessionId: item.sessionId,
        requestId: item.requestId,
        result: item.result,
        action: {
          kind: "vote",
          direction: ChatAgentVoteDirection.Down,
          reason: item.voteDownReason
        }
      });
    }
  });
  registerAction2(class ReportIssueForBugAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.reportIssueForBug",
        title: localize2("interactive.reportIssueForBug.label", "Report Issue"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.report,
        menu: [{
          id: MenuId.ChatMessageFooter,
          group: "navigation",
          order: 3,
          when: ContextKeyExpr.and(ChatContextKeys.responseSupportsIssueReporting, ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
        }, {
          id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
          group: "navigation",
          order: 3,
          when: ContextKeyExpr.and(ChatContextKeys.responseSupportsIssueReporting, ChatContextKeys.isResponse, ContextKeyExpr.has(enableFeedbackConfig))
        }]
      });
    }
    run(accessor, ...args) {
      const item = args[0];
      if (!isResponseVM(item)) {
        return;
      }
      const chatService = accessor.get(IChatService);
      chatService.notifyUserAction({
        agentId: item.agent?.id,
        command: item.slashCommand?.name,
        sessionId: item.sessionId,
        requestId: item.requestId,
        result: item.result,
        action: {
          kind: "bug"
        }
      });
    }
  });
  registerAction2(class RetryChatAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.retry",
        title: localize2("chat.retry.label", "Retry"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.refresh,
        menu: [
          {
            id: MenuId.ChatMessageFooter,
            group: "navigation",
            when: ContextKeyExpr.and(
              ChatContextKeys.isResponse,
              ContextKeyExpr.in(ChatContextKeys.itemId.key, ChatContextKeys.lastItemId.key)
            )
          },
          {
            id: MenuId.ChatEditingWidgetToolbar,
            group: "navigation",
            when: applyingChatEditsFailedContextKey,
            order: 0
          }
        ]
      });
    }
    async run(accessor, ...args) {
      const chatWidgetService = accessor.get(IChatWidgetService);
      let item = args[0];
      if (isChatEditingActionContext(item)) {
        item = chatWidgetService.getWidgetBySessionId(item.sessionId)?.viewModel?.getItems().at(-1);
      }
      if (!isResponseVM(item)) {
        return;
      }
      const chatService = accessor.get(IChatService);
      const chatModel = chatService.getSession(item.sessionId);
      const chatRequests = chatModel?.getRequests();
      if (!chatRequests) {
        return;
      }
      const itemIndex = chatRequests?.findIndex((request2) => request2.id === item.requestId);
      const widget = chatWidgetService.getWidgetBySessionId(item.sessionId);
      const mode = widget?.input.currentMode;
      if (chatModel?.initialLocation === ChatAgentLocation.EditingSession || chatModel && (mode === ChatMode.Edit || mode === ChatMode.Agent)) {
        const configurationService = accessor.get(IConfigurationService);
        const dialogService = accessor.get(IDialogService);
        const currentEditingSession = widget?.viewModel?.model.editingSession;
        if (!currentEditingSession) {
          return;
        }
        const entriesModifiedInLastRequest = currentEditingSession.entries.get().filter((entry) => entry.lastModifyingRequestId === item.requestId);
        const shouldPrompt = entriesModifiedInLastRequest.length > 0 && configurationService.getValue("chat.editing.confirmEditRequestRetry") === true;
        const confirmation = shouldPrompt ? await dialogService.confirm({
          title: localize("chat.retryLast.confirmation.title2", "Do you want to retry your last request?"),
          message: entriesModifiedInLastRequest.length === 1 ? localize("chat.retry.confirmation.message2", "This will undo edits made to {0} since this request.", basename(entriesModifiedInLastRequest[0].modifiedURI)) : localize("chat.retryLast.confirmation.message2", "This will undo edits made to {0} files in your working set since this request. Do you want to proceed?", entriesModifiedInLastRequest.length),
          primaryButton: localize("chat.retry.confirmation.primaryButton", "Yes"),
          checkbox: { label: localize("chat.retry.confirmation.checkbox", "Don't ask again"), checked: false },
          type: "info"
        }) : { confirmed: true };
        if (!confirmation.confirmed) {
          return;
        }
        if (confirmation.checkboxChecked) {
          await configurationService.updateValue("chat.editing.confirmEditRequestRetry", false);
        }
        const snapshotRequest = chatRequests[itemIndex];
        if (snapshotRequest) {
          await currentEditingSession.restoreSnapshot(snapshotRequest.id, void 0);
        }
      }
      const request = chatModel?.getRequests().find((candidate) => candidate.id === item.requestId);
      const languageModelId = widget?.input.currentLanguageModel;
      const userSelectedTools = widget?.input.currentMode === ChatMode.Agent ? widget.input.selectedToolsModel.tools.get().map((tool) => tool.id) : void 0;
      chatService.resendRequest(request, {
        userSelectedModelId: languageModelId,
        userSelectedTools,
        attempt: (request?.attempt ?? -1) + 1,
        mode: widget?.input.currentMode
      });
    }
  });
  registerAction2(class InsertToNotebookAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.insertIntoNotebook",
        title: localize2("interactive.insertIntoNotebook.label", "Insert into Notebook"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.insert,
        menu: {
          id: MenuId.ChatMessageFooter,
          group: "navigation",
          isHiddenByDefault: true,
          when: ContextKeyExpr.and(NOTEBOOK_IS_ACTIVE_EDITOR, ChatContextKeys.isResponse, ChatContextKeys.responseIsFiltered.negate())
        }
      });
    }
    async run(accessor, ...args) {
      const item = args[0];
      if (!isResponseVM(item)) {
        return;
      }
      const editorService = accessor.get(IEditorService);
      if (editorService.activeEditorPane?.getId() === NOTEBOOK_EDITOR_ID) {
        const notebookEditor = editorService.activeEditorPane.getControl();
        if (!notebookEditor.hasModel()) {
          return;
        }
        if (notebookEditor.isReadOnly) {
          return;
        }
        const value = item.response.toString();
        const splitContents = splitMarkdownAndCodeBlocks(value);
        const focusRange = notebookEditor.getFocus();
        const index = Math.max(focusRange.end, 0);
        const bulkEditService = accessor.get(IBulkEditService);
        await bulkEditService.apply(
          [
            new ResourceNotebookCellEdit(
              notebookEditor.textModel.uri,
              {
                editType: CellEditType.Replace,
                index,
                count: 0,
                cells: splitContents.map((content) => {
                  const kind = content.type === "markdown" ? CellKind.Markup : CellKind.Code;
                  const language = content.type === "markdown" ? "markdown" : content.language;
                  const mime = content.type === "markdown" ? "text/markdown" : `text/x-${content.language}`;
                  return {
                    cellKind: kind,
                    language,
                    mime,
                    source: content.content,
                    outputs: [],
                    metadata: {}
                  };
                })
              }
            )
          ],
          { quotableLabel: "Insert into Notebook" }
        );
      }
    }
  });
  registerAction2(class RemoveAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.remove",
        title: localize2("chat.removeRequest.label", "Remove Request"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.x,
        precondition: ContextKeyExpr.and(ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask), ChatContextKeyExprs.unifiedChatEnabled.negate()),
        keybinding: {
          primary: KeyCode.Delete,
          mac: {
            primary: KeyMod.CtrlCmd | KeyCode.Backspace
          },
          when: ContextKeyExpr.and(ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask), ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate()),
          weight: KeybindingWeight.WorkbenchContrib
        },
        menu: {
          id: MenuId.ChatMessageTitle,
          group: "navigation",
          order: 2,
          when: ContextKeyExpr.and(ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask), ChatContextKeys.isRequest, ChatContextKeyExprs.unifiedChatEnabled.negate())
        }
      });
    }
    run(accessor, ...args) {
      let item = args[0];
      if (!isRequestVM(item)) {
        const chatWidgetService = accessor.get(IChatWidgetService);
        const widget = chatWidgetService.lastFocusedWidget;
        item = widget?.getFocus();
      }
      if (!item) {
        return;
      }
      const chatService = accessor.get(IChatService);
      const chatModel = chatService.getSession(item.sessionId);
      if (chatModel?.initialLocation === ChatAgentLocation.EditingSession) {
        return;
      }
      const requestId = isRequestVM(item) ? item.id : isResponseVM(item) ? item.requestId : void 0;
      if (requestId) {
        const chatService2 = accessor.get(IChatService);
        chatService2.removeRequest(item.sessionId, requestId);
      }
    }
  });
  registerAction2(class ContinueEditingAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.startEditing",
        title: localize2("chat.startEditing.label2", "Edit with Copilot"),
        f1: false,
        category: CHAT_CATEGORY,
        icon: Codicon.goToEditingSession,
        precondition: ContextKeyExpr.and(
          ChatContextKeys.editingParticipantRegistered,
          ChatContextKeys.requestInProgress.toNegated(),
          ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel),
          ChatContextKeyExprs.unifiedChatEnabled.negate()
        ),
        menu: {
          id: MenuId.ChatMessageFooter,
          group: "navigation",
          order: 4,
          when: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.isResponse, ChatContextKeys.editingParticipantRegistered, ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel), ChatContextKeyExprs.unifiedChatEnabled.negate())
        }
      });
    }
    async run(accessor, ...args) {
      const logService = accessor.get(ILogService);
      const chatWidgetService = accessor.get(IChatWidgetService);
      const chatService = accessor.get(IChatService);
      const chatAgentService = accessor.get(IChatAgentService);
      const viewsService = accessor.get(IViewsService);
      const chatEditingService = accessor.get(IChatEditingService);
      const quickPickService = accessor.get(IQuickInputService);
      const editAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.EditingSession);
      if (!editAgent) {
        logService.trace("[CHAT_MOVE] No edit agent found");
        return;
      }
      const sourceWidget = chatWidgetService.lastFocusedWidget;
      if (!sourceWidget || !sourceWidget.viewModel) {
        logService.trace("[CHAT_MOVE] NO source model");
        return;
      }
      const sourceModel = sourceWidget.viewModel.model;
      let sourceRequests = sourceModel.getRequests().slice();
      const [first] = args;
      if (isResponseVM(first)) {
        const idx = sourceRequests.findIndex((candidate) => candidate.id === first.requestId);
        if (idx >= 0) {
          sourceRequests.length = idx + 1;
        }
      }
      if (sourceRequests.length > 1) {
        sourceRequests = await this._pickTurns(quickPickService, sourceRequests);
      }
      if (sourceRequests.length === 0) {
        logService.trace("[CHAT_MOVE] NO requests to move");
        return;
      }
      const editsView = await viewsService.openView(EditsViewId);
      if (!(editsView instanceof ChatViewPane)) {
        return;
      }
      const viewModelObs = observableFromEvent(this, editsView.widget.onDidChangeViewModel, () => editsView.widget.viewModel);
      const chatSessionId = (await waitForState(viewModelObs)).sessionId;
      const editingSession = chatEditingService.getEditingSession(chatSessionId);
      if (!editingSession) {
        return;
      }
      const state = editingSession.state.get();
      if (state === ChatEditingSessionState.Disposed) {
        return;
      }
      const workingSetAdditions = new ResourceSet();
      for (const request of sourceRequests) {
        await chatService.adoptRequest(editingSession.chatSessionId, request);
        this._collectWorkingSetAdditions(request, workingSetAdditions);
      }
      await Promise.all(Array.from(workingSetAdditions, async (uri) => editsView.widget.attachmentModel.addFile(uri)));
      await chatService.sendRequest(editingSession.chatSessionId, "", {
        agentId: editAgent.id,
        acceptedConfirmationData: [{ _type: "toEditTransfer", transferredTurnResults: sourceRequests.map((v) => v.response?.result) }],
        // TODO@jrieken HACKY
        confirmation: typeof this.desc.title === "string" ? this.desc.title : this.desc.title.value
      });
    }
    _collectWorkingSetAdditions(request, bucket) {
      for (const item of request.response?.response.value ?? []) {
        if (item.kind === "inlineReference") {
          bucket.add(
            isLocation(item.inlineReference) ? item.inlineReference.uri : URI.isUri(item.inlineReference) ? item.inlineReference : item.inlineReference.location.uri
          );
        }
      }
    }
    async _pickTurns(quickPickService, requests) {
      const timeThreshold = 2 * 6e4;
      const lastRequestTimestamp = requests[requests.length - 1].timestamp;
      const relatedRequests = requests.filter((request) => request.timestamp >= 0 && lastRequestTimestamp - request.timestamp <= timeThreshold);
      const lastPick = {
        label: localize("chat.startEditing.last", "The last {0} requests", relatedRequests.length),
        detail: relatedRequests.map((req) => req.message.text).join(", ")
      };
      const allPick = {
        label: localize("chat.startEditing.pickAll", "All requests from the conversation")
      };
      const customPick = {
        label: localize("chat.startEditing.pickCustom", "Manually select requests...")
      };
      const picks = relatedRequests.length !== 0 ? [lastPick, allPick, customPick] : [allPick, customPick];
      const firstPick = await quickPickService.pick(picks, {
        placeHolder: localize("chat.startEditing.pickRequest", "Select requests that you want to use for editing")
      });
      if (!firstPick) {
        return [];
      } else if (firstPick === allPick) {
        return requests;
      } else if (firstPick === lastPick) {
        return relatedRequests;
      }
      const customPicks = requests.map((request) => ({
        picked: false,
        request,
        label: request.message.text,
        detail: request.response?.response.toString()
      }));
      return await new Promise((_resolve) => {
        const resolve = (value) => {
          store.dispose();
          _resolve(value);
          qp.hide();
        };
        const store = new DisposableStore();
        const qp = quickPickService.createQuickPick();
        qp.placeholder = localize("chat.startEditing.pickRequest", "Select requests that you want to use for editing");
        qp.canSelectMany = true;
        qp.items = customPicks;
        let ignore = false;
        store.add(qp.onDidChangeSelection((e) => {
          if (ignore) {
            return;
          }
          ignore = true;
          try {
            const [first] = e;
            const selected = [];
            let disabled = false;
            for (let i = 0; i < customPicks.length; i++) {
              const oldItem = customPicks[i];
              customPicks[i] = {
                ...oldItem,
                disabled
              };
              disabled = disabled || oldItem === first;
              if (disabled) {
                selected.push(customPicks[i]);
              }
            }
            qp.items = customPicks;
            qp.selectedItems = selected;
          } finally {
            ignore = false;
          }
        }));
        store.add(qp.onDidAccept((_e) => resolve(qp.selectedItems.map((i) => i.request))));
        store.add(qp.onDidHide((_) => resolve([])));
        store.add(qp);
        qp.show();
      });
    }
  });
}
function splitMarkdownAndCodeBlocks(markdown) {
  const lexer = new marked.Lexer();
  const tokens = lexer.lex(markdown);
  const splitContent = [];
  let markdownPart = "";
  tokens.forEach((token) => {
    if (token.type === "code") {
      if (markdownPart.trim()) {
        splitContent.push({ type: "markdown", content: markdownPart });
        markdownPart = "";
      }
      splitContent.push({
        type: "code",
        language: token.lang || "",
        content: token.text
      });
    } else {
      markdownPart += token.raw;
    }
  });
  if (markdownPart.trim()) {
    splitContent.push({ type: "markdown", content: markdownPart });
  }
  return splitContent;
}
export {
  MarkUnhelpfulActionId,
  registerChatTitleActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VGl0bGVBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZVNldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBtYXJrZWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJrZWQvbWFya2VkLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVGcm9tRXZlbnQsIHdhaXRGb3JTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElCdWxrRWRpdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9idWxrRWRpdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTm90ZWJvb2tDZWxsRWRpdCB9IGZyb20gJy4uLy4uLy4uL2J1bGtFZGl0L2Jyb3dzZXIvYnVsa0NlbGxFZGl0cy5qcyc7XG5pbXBvcnQgeyBNRU5VX0lOTElORV9DSEFUX1dJREdFVF9TRUNPTkRBUlkgfSBmcm9tICcuLi8uLi8uLi9pbmxpbmVDaGF0L2NvbW1vbi9pbmxpbmVDaGF0LmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvciB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IENlbGxFZGl0VHlwZSwgQ2VsbEtpbmQsIE5PVEVCT09LX0VESVRPUl9JRCB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleUV4cHJzLCBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGFwcGx5aW5nQ2hhdEVkaXRzRmFpbGVkQ29udGV4dEtleSwgQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUsIElDaGF0RWRpdGluZ1NlcnZpY2UsIGlzQ2hhdEVkaXRpbmdBY3Rpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50Vm90ZURpcmVjdGlvbiwgQ2hhdEFnZW50Vm90ZURvd25SZWFzb24sIElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1JlcXVlc3RWTSwgaXNSZXNwb25zZVZNIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUl0ZW0sIEVkaXRzVmlld0lkLCBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IENoYXRWaWV3UGFuZSB9IGZyb20gJy4uL2NoYXRWaWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBDSEFUX0NBVEVHT1JZIH0gZnJvbSAnLi9jaGF0QWN0aW9ucy5qcyc7XG5cbmV4cG9ydCBjb25zdCBNYXJrVW5oZWxwZnVsQWN0aW9uSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lm1hcmtVbmhlbHBmdWwnO1xuY29uc3QgZW5hYmxlRmVlZGJhY2tDb25maWcgPSAnY29uZmlnLnRlbGVtZXRyeS5mZWVkYmFjay5lbmFibGVkJztcblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ2hhdFRpdGxlQWN0aW9ucygpIHtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE1hcmtIZWxwZnVsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lm1hcmtIZWxwZnVsJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmUuaGVscGZ1bC5sYWJlbCcsIFwiSGVscGZ1bFwiKSxcblx0XHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi50aHVtYnN1cCxcblx0XHRcdFx0dG9nZ2xlZDogQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlVm90ZS5pc0VxdWFsVG8oJ3VwJyksXG5cdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0TWVzc2FnZUZvb3Rlcixcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSwgQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSGFzRXJyb3IubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmhhcyhlbmFibGVGZWVkYmFja0NvbmZpZykpXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU0VDT05EQVJZLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pc1Jlc3BvbnNlLCBDaGF0Q29udGV4dEtleXMucmVzcG9uc2VIYXNFcnJvci5uZWdhdGUoKSwgQ29udGV4dEtleUV4cHIuaGFzKGVuYWJsZUZlZWRiYWNrQ29uZmlnKSlcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBhcmdzWzBdO1xuXHRcdFx0aWYgKCFpc1Jlc3BvbnNlVk0oaXRlbSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdFx0Y2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdGFnZW50SWQ6IGl0ZW0uYWdlbnQ/LmlkLFxuXHRcdFx0XHRjb21tYW5kOiBpdGVtLnNsYXNoQ29tbWFuZD8ubmFtZSxcblx0XHRcdFx0c2Vzc2lvbklkOiBpdGVtLnNlc3Npb25JZCxcblx0XHRcdFx0cmVxdWVzdElkOiBpdGVtLnJlcXVlc3RJZCxcblx0XHRcdFx0cmVzdWx0OiBpdGVtLnJlc3VsdCxcblx0XHRcdFx0YWN0aW9uOiB7XG5cdFx0XHRcdFx0a2luZDogJ3ZvdGUnLFxuXHRcdFx0XHRcdGRpcmVjdGlvbjogQ2hhdEFnZW50Vm90ZURpcmVjdGlvbi5VcCxcblx0XHRcdFx0XHRyZWFzb246IHVuZGVmaW5lZFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGl0ZW0uc2V0Vm90ZShDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLlVwKTtcblx0XHRcdGl0ZW0uc2V0Vm90ZURvd25SZWFzb24odW5kZWZpbmVkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBNYXJrVW5oZWxwZnVsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBNYXJrVW5oZWxwZnVsQWN0aW9uSWQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLnVuaGVscGZ1bC5sYWJlbCcsIFwiVW5oZWxwZnVsXCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLnRodW1ic2Rvd24sXG5cdFx0XHRcdHRvZ2dsZWQ6IENoYXRDb250ZXh0S2V5cy5yZXNwb25zZVZvdGUuaXNFcXVhbFRvKCdkb3duJyksXG5cdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0TWVzc2FnZUZvb3Rlcixcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSwgQ29udGV4dEtleUV4cHIuaGFzKGVuYWJsZUZlZWRiYWNrQ29uZmlnKSlcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdGlkOiBNRU5VX0lOTElORV9DSEFUX1dJREdFVF9TRUNPTkRBUlksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmlzUmVzcG9uc2UsIENoYXRDb250ZXh0S2V5cy5yZXNwb25zZUhhc0Vycm9yLm5lZ2F0ZSgpLCBDb250ZXh0S2V5RXhwci5oYXMoZW5hYmxlRmVlZGJhY2tDb25maWcpKVxuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGFyZ3NbMF07XG5cdFx0XHRpZiAoIWlzUmVzcG9uc2VWTShpdGVtKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlYXNvbiA9IGFyZ3NbMV07XG5cdFx0XHRpZiAodHlwZW9mIHJlYXNvbiAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVtLnNldFZvdGUoQ2hhdEFnZW50Vm90ZURpcmVjdGlvbi5Eb3duKTtcblx0XHRcdGl0ZW0uc2V0Vm90ZURvd25SZWFzb24ocmVhc29uIGFzIENoYXRBZ2VudFZvdGVEb3duUmVhc29uKTtcblxuXHRcdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0XHRcdGNoYXRTZXJ2aWNlLm5vdGlmeVVzZXJBY3Rpb24oe1xuXHRcdFx0XHRhZ2VudElkOiBpdGVtLmFnZW50Py5pZCxcblx0XHRcdFx0Y29tbWFuZDogaXRlbS5zbGFzaENvbW1hbmQ/Lm5hbWUsXG5cdFx0XHRcdHNlc3Npb25JZDogaXRlbS5zZXNzaW9uSWQsXG5cdFx0XHRcdHJlcXVlc3RJZDogaXRlbS5yZXF1ZXN0SWQsXG5cdFx0XHRcdHJlc3VsdDogaXRlbS5yZXN1bHQsXG5cdFx0XHRcdGFjdGlvbjoge1xuXHRcdFx0XHRcdGtpbmQ6ICd2b3RlJyxcblx0XHRcdFx0XHRkaXJlY3Rpb246IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24uRG93bixcblx0XHRcdFx0XHRyZWFzb246IGl0ZW0udm90ZURvd25SZWFzb25cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVwb3J0SXNzdWVGb3JCdWdBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQucmVwb3J0SXNzdWVGb3JCdWcnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5yZXBvcnRJc3N1ZUZvckJ1Zy5sYWJlbCcsIFwiUmVwb3J0IElzc3VlXCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLnJlcG9ydCxcblx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRNZXNzYWdlRm9vdGVyLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5yZXNwb25zZVN1cHBvcnRzSXNzdWVSZXBvcnRpbmcsIENoYXRDb250ZXh0S2V5cy5pc1Jlc3BvbnNlLCBDb250ZXh0S2V5RXhwci5oYXMoZW5hYmxlRmVlZGJhY2tDb25maWcpKVxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0aWQ6IE1FTlVfSU5MSU5FX0NIQVRfV0lER0VUX1NFQ09OREFSWSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAzLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMucmVzcG9uc2VTdXBwb3J0c0lzc3VlUmVwb3J0aW5nLCBDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSwgQ29udGV4dEtleUV4cHIuaGFzKGVuYWJsZUZlZWRiYWNrQ29uZmlnKSlcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBhcmdzWzBdO1xuXHRcdFx0aWYgKCFpc1Jlc3BvbnNlVk0oaXRlbSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdFx0Y2hhdFNlcnZpY2Uubm90aWZ5VXNlckFjdGlvbih7XG5cdFx0XHRcdGFnZW50SWQ6IGl0ZW0uYWdlbnQ/LmlkLFxuXHRcdFx0XHRjb21tYW5kOiBpdGVtLnNsYXNoQ29tbWFuZD8ubmFtZSxcblx0XHRcdFx0c2Vzc2lvbklkOiBpdGVtLnNlc3Npb25JZCxcblx0XHRcdFx0cmVxdWVzdElkOiBpdGVtLnJlcXVlc3RJZCxcblx0XHRcdFx0cmVzdWx0OiBpdGVtLnJlc3VsdCxcblx0XHRcdFx0YWN0aW9uOiB7XG5cdFx0XHRcdFx0a2luZDogJ2J1Zydcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgUmV0cnlDaGF0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnJldHJ5Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC5yZXRyeS5sYWJlbCcsIFwiUmV0cnlcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24ucmVmcmVzaCxcblx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdE1lc3NhZ2VGb290ZXIsXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSxcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuaW4oQ2hhdENvbnRleHRLZXlzLml0ZW1JZC5rZXksIENoYXRDb250ZXh0S2V5cy5sYXN0SXRlbUlkLmtleSkpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nV2lkZ2V0VG9vbGJhcixcblx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHR3aGVuOiBhcHBseWluZ0NoYXRFZGl0c0ZhaWxlZENvbnRleHRLZXksXG5cdFx0XHRcdFx0XHRvcmRlcjogMFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblxuXHRcdFx0bGV0IGl0ZW0gPSBhcmdzWzBdO1xuXHRcdFx0aWYgKGlzQ2hhdEVkaXRpbmdBY3Rpb25Db250ZXh0KGl0ZW0pKSB7XG5cdFx0XHRcdC8vIFJlc29sdmUgY2hhdCBlZGl0aW5nIGFjdGlvbiBjb250ZXh0IHRvIHRoZSBsYXN0IHJlc3BvbnNlIFZNXG5cdFx0XHRcdGl0ZW0gPSBjaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChpdGVtLnNlc3Npb25JZCk/LnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5hdCgtMSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWlzUmVzcG9uc2VWTShpdGVtKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0TW9kZWwgPSBjaGF0U2VydmljZS5nZXRTZXNzaW9uKGl0ZW0uc2Vzc2lvbklkKTtcblx0XHRcdGNvbnN0IGNoYXRSZXF1ZXN0cyA9IGNoYXRNb2RlbD8uZ2V0UmVxdWVzdHMoKTtcblx0XHRcdGlmICghY2hhdFJlcXVlc3RzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGl0ZW1JbmRleCA9IGNoYXRSZXF1ZXN0cz8uZmluZEluZGV4KHJlcXVlc3QgPT4gcmVxdWVzdC5pZCA9PT0gaXRlbS5yZXF1ZXN0SWQpO1xuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlTZXNzaW9uSWQoaXRlbS5zZXNzaW9uSWQpO1xuXHRcdFx0Y29uc3QgbW9kZSA9IHdpZGdldD8uaW5wdXQuY3VycmVudE1vZGU7XG5cdFx0XHRpZiAoY2hhdE1vZGVsPy5pbml0aWFsTG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uIHx8IGNoYXRNb2RlbCAmJiAobW9kZSA9PT0gQ2hhdE1vZGUuRWRpdCB8fCBtb2RlID09PSBDaGF0TW9kZS5BZ2VudCkpIHtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbiA9IHdpZGdldD8udmlld01vZGVsPy5tb2RlbC5lZGl0aW5nU2Vzc2lvbjtcblx0XHRcdFx0aWYgKCFjdXJyZW50RWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBQcm9tcHQgaWYgdGhlIGxhc3QgcmVxdWVzdCBtb2RpZmllZCB0aGUgd29ya2luZyBzZXQgYW5kIHRoZSB1c2VyIGhhc24ndCBhbHJlYWR5IGRpc2FibGVkIHRoZSBkaWFsb2dcblx0XHRcdFx0Y29uc3QgZW50cmllc01vZGlmaWVkSW5MYXN0UmVxdWVzdCA9IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5lbnRyaWVzLmdldCgpLmZpbHRlcigoZW50cnkpID0+IGVudHJ5Lmxhc3RNb2RpZnlpbmdSZXF1ZXN0SWQgPT09IGl0ZW0ucmVxdWVzdElkKTtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkUHJvbXB0ID0gZW50cmllc01vZGlmaWVkSW5MYXN0UmVxdWVzdC5sZW5ndGggPiAwICYmIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdjaGF0LmVkaXRpbmcuY29uZmlybUVkaXRSZXF1ZXN0UmV0cnknKSA9PT0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgY29uZmlybWF0aW9uID0gc2hvdWxkUHJvbXB0XG5cdFx0XHRcdFx0PyBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjaGF0LnJldHJ5TGFzdC5jb25maXJtYXRpb24udGl0bGUyJywgXCJEbyB5b3Ugd2FudCB0byByZXRyeSB5b3VyIGxhc3QgcmVxdWVzdD9cIiksXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBlbnRyaWVzTW9kaWZpZWRJbkxhc3RSZXF1ZXN0Lmxlbmd0aCA9PT0gMVxuXHRcdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCdjaGF0LnJldHJ5LmNvbmZpcm1hdGlvbi5tZXNzYWdlMicsIFwiVGhpcyB3aWxsIHVuZG8gZWRpdHMgbWFkZSB0byB7MH0gc2luY2UgdGhpcyByZXF1ZXN0LlwiLCBiYXNlbmFtZShlbnRyaWVzTW9kaWZpZWRJbkxhc3RSZXF1ZXN0WzBdLm1vZGlmaWVkVVJJKSlcblx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnY2hhdC5yZXRyeUxhc3QuY29uZmlybWF0aW9uLm1lc3NhZ2UyJywgXCJUaGlzIHdpbGwgdW5kbyBlZGl0cyBtYWRlIHRvIHswfSBmaWxlcyBpbiB5b3VyIHdvcmtpbmcgc2V0IHNpbmNlIHRoaXMgcmVxdWVzdC4gRG8geW91IHdhbnQgdG8gcHJvY2VlZD9cIiwgZW50cmllc01vZGlmaWVkSW5MYXN0UmVxdWVzdC5sZW5ndGgpLFxuXHRcdFx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ2NoYXQucmV0cnkuY29uZmlybWF0aW9uLnByaW1hcnlCdXR0b24nLCBcIlllc1wiKSxcblx0XHRcdFx0XHRcdGNoZWNrYm94OiB7IGxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5yZXRyeS5jb25maXJtYXRpb24uY2hlY2tib3gnLCBcIkRvbid0IGFzayBhZ2FpblwiKSwgY2hlY2tlZDogZmFsc2UgfSxcblx0XHRcdFx0XHRcdHR5cGU6ICdpbmZvJ1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0OiB7IGNvbmZpcm1lZDogdHJ1ZSB9O1xuXG5cdFx0XHRcdGlmICghY29uZmlybWF0aW9uLmNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjb25maXJtYXRpb24uY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2NoYXQuZWRpdGluZy5jb25maXJtRWRpdFJlcXVlc3RSZXRyeScsIGZhbHNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlc2V0IHRoZSBzbmFwc2hvdCB0byB0aGUgZmlyc3Qgc3RvcCAodW5kZWZpbmVkIHVuZG8gaW5kZXgpXG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90UmVxdWVzdCA9IGNoYXRSZXF1ZXN0c1tpdGVtSW5kZXhdO1xuXHRcdFx0XHRpZiAoc25hcHNob3RSZXF1ZXN0KSB7XG5cdFx0XHRcdFx0YXdhaXQgY3VycmVudEVkaXRpbmdTZXNzaW9uLnJlc3RvcmVTbmFwc2hvdChzbmFwc2hvdFJlcXVlc3QuaWQsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlcXVlc3QgPSBjaGF0TW9kZWw/LmdldFJlcXVlc3RzKCkuZmluZChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmlkID09PSBpdGVtLnJlcXVlc3RJZCk7XG5cdFx0XHRjb25zdCBsYW5ndWFnZU1vZGVsSWQgPSB3aWRnZXQ/LmlucHV0LmN1cnJlbnRMYW5ndWFnZU1vZGVsO1xuXHRcdFx0Y29uc3QgdXNlclNlbGVjdGVkVG9vbHMgPSB3aWRnZXQ/LmlucHV0LmN1cnJlbnRNb2RlID09PSBDaGF0TW9kZS5BZ2VudCA/IHdpZGdldC5pbnB1dC5zZWxlY3RlZFRvb2xzTW9kZWwudG9vbHMuZ2V0KCkubWFwKHRvb2wgPT4gdG9vbC5pZCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjaGF0U2VydmljZS5yZXNlbmRSZXF1ZXN0KHJlcXVlc3QhLCB7XG5cdFx0XHRcdHVzZXJTZWxlY3RlZE1vZGVsSWQ6IGxhbmd1YWdlTW9kZWxJZCxcblx0XHRcdFx0dXNlclNlbGVjdGVkVG9vbHMsXG5cdFx0XHRcdGF0dGVtcHQ6IChyZXF1ZXN0Py5hdHRlbXB0ID8/IC0xKSArIDEsXG5cdFx0XHRcdG1vZGU6IHdpZGdldD8uaW5wdXQuY3VycmVudE1vZGUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBJbnNlcnRUb05vdGVib29rQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc2VydEludG9Ob3RlYm9vaycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLmluc2VydEludG9Ob3RlYm9vay5sYWJlbCcsIFwiSW5zZXJ0IGludG8gTm90ZWJvb2tcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24uaW5zZXJ0LFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0TWVzc2FnZUZvb3Rlcixcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdGlzSGlkZGVuQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChOT1RFQk9PS19JU19BQ1RJVkVfRURJVE9SLCBDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSwgQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSXNGaWx0ZXJlZC5uZWdhdGUoKSlcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGFyZ3NbMF07XG5cdFx0XHRpZiAoIWlzUmVzcG9uc2VWTShpdGVtKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0XHRpZiAoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5nZXRJZCgpID09PSBOT1RFQk9PS19FRElUT1JfSUQpIHtcblx0XHRcdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3IgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUuZ2V0Q29udHJvbCgpIGFzIElOb3RlYm9va0VkaXRvcjtcblxuXHRcdFx0XHRpZiAoIW5vdGVib29rRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobm90ZWJvb2tFZGl0b3IuaXNSZWFkT25seSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gaXRlbS5yZXNwb25zZS50b1N0cmluZygpO1xuXHRcdFx0XHRjb25zdCBzcGxpdENvbnRlbnRzID0gc3BsaXRNYXJrZG93bkFuZENvZGVCbG9ja3ModmFsdWUpO1xuXG5cdFx0XHRcdGNvbnN0IGZvY3VzUmFuZ2UgPSBub3RlYm9va0VkaXRvci5nZXRGb2N1cygpO1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IE1hdGgubWF4KGZvY3VzUmFuZ2UuZW5kLCAwKTtcblx0XHRcdFx0Y29uc3QgYnVsa0VkaXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElCdWxrRWRpdFNlcnZpY2UpO1xuXG5cdFx0XHRcdGF3YWl0IGJ1bGtFZGl0U2VydmljZS5hcHBseShcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRuZXcgUmVzb3VyY2VOb3RlYm9va0NlbGxFZGl0KG5vdGVib29rRWRpdG9yLnRleHRNb2RlbC51cmksXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEVkaXRUeXBlLlJlcGxhY2UsXG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRcdFx0XHRcdGNvdW50OiAwLFxuXHRcdFx0XHRcdFx0XHRcdGNlbGxzOiBzcGxpdENvbnRlbnRzLm1hcChjb250ZW50ID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGtpbmQgPSBjb250ZW50LnR5cGUgPT09ICdtYXJrZG93bicgPyBDZWxsS2luZC5NYXJrdXAgOiBDZWxsS2luZC5Db2RlO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2UgPSBjb250ZW50LnR5cGUgPT09ICdtYXJrZG93bicgPyAnbWFya2Rvd24nIDogY29udGVudC5sYW5ndWFnZTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1pbWUgPSBjb250ZW50LnR5cGUgPT09ICdtYXJrZG93bicgPyAndGV4dC9tYXJrZG93bicgOiBgdGV4dC94LSR7Y29udGVudC5sYW5ndWFnZX1gO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2VsbEtpbmQ6IGtpbmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGxhbmd1YWdlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRtaW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2U6IGNvbnRlbnQuY29udGVudCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0b3V0cHV0czogW10sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdG1ldGFkYXRhOiB7fVxuXHRcdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0XHR7IHF1b3RhYmxlTGFiZWw6ICdJbnNlcnQgaW50byBOb3RlYm9vaycgfVxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVtb3ZlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnJlbW92ZScsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQucmVtb3ZlUmVxdWVzdC5sYWJlbCcsIFwiUmVtb3ZlIFJlcXVlc3RcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24ueCxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLCBDaGF0Q29udGV4dEtleUV4cHJzLnVuaWZpZWRDaGF0RW5hYmxlZC5uZWdhdGUoKSksXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRlbGV0ZSxcblx0XHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLCBDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvbiwgQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0Lm5lZ2F0ZSgpKSxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0fSxcblx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdE1lc3NhZ2VUaXRsZSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuY2hhdE1vZGUuaXNFcXVhbFRvKENoYXRNb2RlLkFzayksIENoYXRDb250ZXh0S2V5cy5pc1JlcXVlc3QsIENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpKVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRsZXQgaXRlbTogQ2hhdFRyZWVJdGVtIHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblx0XHRcdGlmICghaXNSZXF1ZXN0Vk0oaXRlbSkpIHtcblx0XHRcdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0XHRcdGl0ZW0gPSB3aWRnZXQ/LmdldEZvY3VzKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghaXRlbSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0TW9kZWwgPSBjaGF0U2VydmljZS5nZXRTZXNzaW9uKGl0ZW0uc2Vzc2lvbklkKTtcblx0XHRcdGlmIChjaGF0TW9kZWw/LmluaXRpYWxMb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXF1ZXN0SWQgPSBpc1JlcXVlc3RWTShpdGVtKSA/IGl0ZW0uaWQgOlxuXHRcdFx0XHRpc1Jlc3BvbnNlVk0oaXRlbSkgPyBpdGVtLnJlcXVlc3RJZCA6IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHJlcXVlc3RJZCkge1xuXHRcdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdFx0XHRjaGF0U2VydmljZS5yZW1vdmVSZXF1ZXN0KGl0ZW0uc2Vzc2lvbklkLCByZXF1ZXN0SWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENvbnRpbnVlRWRpdGluZ0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdGFydEVkaXRpbmcnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0LnN0YXJ0RWRpdGluZy5sYWJlbDInLCBcIkVkaXQgd2l0aCBDb3BpbG90XCIpLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmdvVG9FZGl0aW5nU2Vzc2lvbixcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmVkaXRpbmdQYXJ0aWNpcGFudFJlZ2lzdGVyZWQsXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5pc0VxdWFsVG8oQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpXG5cdFx0XHRcdCksXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRNZXNzYWdlRm9vdGVyLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5lbmFibGVkLCBDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSwgQ2hhdENvbnRleHRLZXlzLmVkaXRpbmdQYXJ0aWNpcGFudFJlZ2lzdGVyZWQsIENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5pc0VxdWFsVG8oQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpLCBDaGF0Q29udGV4dEtleUV4cHJzLnVuaWZpZWRDaGF0RW5hYmxlZC5uZWdhdGUoKSlcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXG5cdFx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNoYXRXaWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2hhdEFnZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdEFnZW50U2VydmljZSk7XG5cdFx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0RWRpdGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRFZGl0aW5nU2VydmljZSk7XG5cdFx0XHRjb25zdCBxdWlja1BpY2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cblx0XHRcdGNvbnN0IGVkaXRBZ2VudCA9IGNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKTtcblx0XHRcdGlmICghZWRpdEFnZW50KSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ1tDSEFUX01PVkVdIE5vIGVkaXQgYWdlbnQgZm91bmQnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzb3VyY2VXaWRnZXQgPSBjaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRcdGlmICghc291cmNlV2lkZ2V0IHx8ICFzb3VyY2VXaWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ1tDSEFUX01PVkVdIE5PIHNvdXJjZSBtb2RlbCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNvdXJjZU1vZGVsID0gc291cmNlV2lkZ2V0LnZpZXdNb2RlbC5tb2RlbDtcblx0XHRcdGxldCBzb3VyY2VSZXF1ZXN0cyA9IHNvdXJjZU1vZGVsLmdldFJlcXVlc3RzKCkuc2xpY2UoKTtcblxuXHRcdFx0Ly8gd2hlbiBhIHJlc3BvbnNlIGlzIHBhc3NlZCAoY2xpY2tlZCBvbikgaWdub3JlIGFsbCBpdGVtIGFmdGVyIGl0XG5cdFx0XHRjb25zdCBbZmlyc3RdID0gYXJncztcblx0XHRcdGlmIChpc1Jlc3BvbnNlVk0oZmlyc3QpKSB7XG5cdFx0XHRcdGNvbnN0IGlkeCA9IHNvdXJjZVJlcXVlc3RzLmZpbmRJbmRleChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmlkID09PSBmaXJzdC5yZXF1ZXN0SWQpO1xuXHRcdFx0XHRpZiAoaWR4ID49IDApIHtcblx0XHRcdFx0XHRzb3VyY2VSZXF1ZXN0cy5sZW5ndGggPSBpZHggKyAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHdoZW4gaGF2aW5nIG11bHRpcGxlIHR1cm5zLCBsZXQgdGhlIHVzZXIgcGlja1xuXHRcdFx0aWYgKHNvdXJjZVJlcXVlc3RzLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0c291cmNlUmVxdWVzdHMgPSBhd2FpdCB0aGlzLl9waWNrVHVybnMocXVpY2tQaWNrU2VydmljZSwgc291cmNlUmVxdWVzdHMpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoc291cmNlUmVxdWVzdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoJ1tDSEFUX01PVkVdIE5PIHJlcXVlc3RzIHRvIG1vdmUnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlZGl0c1ZpZXcgPSBhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXcoRWRpdHNWaWV3SWQpO1xuXG5cdFx0XHRpZiAoIShlZGl0c1ZpZXcgaW5zdGFuY2VvZiBDaGF0Vmlld1BhbmUpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgdmlld01vZGVsT2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCBlZGl0c1ZpZXcud2lkZ2V0Lm9uRGlkQ2hhbmdlVmlld01vZGVsLCAoKSA9PiBlZGl0c1ZpZXcud2lkZ2V0LnZpZXdNb2RlbCk7XG5cdFx0XHRjb25zdCBjaGF0U2Vzc2lvbklkID0gKGF3YWl0IHdhaXRGb3JTdGF0ZSh2aWV3TW9kZWxPYnMpKS5zZXNzaW9uSWQ7XG5cdFx0XHRjb25zdCBlZGl0aW5nU2Vzc2lvbiA9IGNoYXRFZGl0aW5nU2VydmljZS5nZXRFZGl0aW5nU2Vzc2lvbihjaGF0U2Vzc2lvbklkKTtcblxuXHRcdFx0aWYgKCFlZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN0YXRlID0gZWRpdGluZ1Nlc3Npb24uc3RhdGUuZ2V0KCk7XG5cdFx0XHRpZiAoc3RhdGUgPT09IENoYXRFZGl0aW5nU2Vzc2lvblN0YXRlLkRpc3Bvc2VkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYWRvcHQgcmVxdWVzdCBpdGVtcyBhbmQgY29sbGVjdCBuZXcgd29ya2luZyBzZXQgZW50cmllc1xuXHRcdFx0Y29uc3Qgd29ya2luZ1NldEFkZGl0aW9ucyA9IG5ldyBSZXNvdXJjZVNldCgpO1xuXHRcdFx0Zm9yIChjb25zdCByZXF1ZXN0IG9mIHNvdXJjZVJlcXVlc3RzKSB7XG5cdFx0XHRcdGF3YWl0IGNoYXRTZXJ2aWNlLmFkb3B0UmVxdWVzdChlZGl0aW5nU2Vzc2lvbi5jaGF0U2Vzc2lvbklkLCByZXF1ZXN0KTtcblx0XHRcdFx0dGhpcy5fY29sbGVjdFdvcmtpbmdTZXRBZGRpdGlvbnMocmVxdWVzdCwgd29ya2luZ1NldEFkZGl0aW9ucyk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChBcnJheS5mcm9tKHdvcmtpbmdTZXRBZGRpdGlvbnMsIGFzeW5jIHVyaSA9PiBlZGl0c1ZpZXcud2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRGaWxlKHVyaSkpKTtcblxuXHRcdFx0Ly8gbWFrZSByZXF1ZXN0XG5cdFx0XHRhd2FpdCBjaGF0U2VydmljZS5zZW5kUmVxdWVzdChlZGl0aW5nU2Vzc2lvbi5jaGF0U2Vzc2lvbklkLCAnJywge1xuXHRcdFx0XHRhZ2VudElkOiBlZGl0QWdlbnQuaWQsXG5cdFx0XHRcdGFjY2VwdGVkQ29uZmlybWF0aW9uRGF0YTogW3sgX3R5cGU6ICd0b0VkaXRUcmFuc2ZlcicsIHRyYW5zZmVycmVkVHVyblJlc3VsdHM6IHNvdXJjZVJlcXVlc3RzLm1hcCh2ID0+IHYucmVzcG9uc2U/LnJlc3VsdCkgfV0sIC8vIFRPRE9AanJpZWtlbiBIQUNLWVxuXHRcdFx0XHRjb25maXJtYXRpb246IHR5cGVvZiB0aGlzLmRlc2MudGl0bGUgPT09ICdzdHJpbmcnID8gdGhpcy5kZXNjLnRpdGxlIDogdGhpcy5kZXNjLnRpdGxlLnZhbHVlXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRwcml2YXRlIF9jb2xsZWN0V29ya2luZ1NldEFkZGl0aW9ucyhyZXF1ZXN0OiBJQ2hhdFJlcXVlc3RNb2RlbCwgYnVja2V0OiBSZXNvdXJjZVNldCkge1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHJlcXVlc3QucmVzcG9uc2U/LnJlc3BvbnNlLnZhbHVlID8/IFtdKSB7XG5cdFx0XHRcdGlmIChpdGVtLmtpbmQgPT09ICdpbmxpbmVSZWZlcmVuY2UnKSB7XG5cdFx0XHRcdFx0YnVja2V0LmFkZChpc0xvY2F0aW9uKGl0ZW0uaW5saW5lUmVmZXJlbmNlKVxuXHRcdFx0XHRcdFx0PyBpdGVtLmlubGluZVJlZmVyZW5jZS51cmlcblx0XHRcdFx0XHRcdDogVVJJLmlzVXJpKGl0ZW0uaW5saW5lUmVmZXJlbmNlKVxuXHRcdFx0XHRcdFx0XHQ/IGl0ZW0uaW5saW5lUmVmZXJlbmNlXG5cdFx0XHRcdFx0XHRcdDogaXRlbS5pbmxpbmVSZWZlcmVuY2UubG9jYXRpb24udXJpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByaXZhdGUgYXN5bmMgX3BpY2tUdXJucyhxdWlja1BpY2tTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsIHJlcXVlc3RzOiBJQ2hhdFJlcXVlc3RNb2RlbFtdKTogUHJvbWlzZTxJQ2hhdFJlcXVlc3RNb2RlbFtdPiB7XG5cblx0XHRcdGNvbnN0IHRpbWVUaHJlc2hvbGQgPSAyICogNjAwMDA7IC8vIDIgbWludXRlc1xuXHRcdFx0Y29uc3QgbGFzdFJlcXVlc3RUaW1lc3RhbXAgPSByZXF1ZXN0c1tyZXF1ZXN0cy5sZW5ndGggLSAxXS50aW1lc3RhbXA7XG5cdFx0XHRjb25zdCByZWxhdGVkUmVxdWVzdHMgPSByZXF1ZXN0cy5maWx0ZXIocmVxdWVzdCA9PiByZXF1ZXN0LnRpbWVzdGFtcCA+PSAwICYmIGxhc3RSZXF1ZXN0VGltZXN0YW1wIC0gcmVxdWVzdC50aW1lc3RhbXAgPD0gdGltZVRocmVzaG9sZCk7XG5cblx0XHRcdGNvbnN0IGxhc3RQaWNrOiBJUXVpY2tQaWNrSXRlbSA9IHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5sYXN0JywgXCJUaGUgbGFzdCB7MH0gcmVxdWVzdHNcIiwgcmVsYXRlZFJlcXVlc3RzLmxlbmd0aCksXG5cdFx0XHRcdGRldGFpbDogcmVsYXRlZFJlcXVlc3RzLm1hcChyZXEgPT4gcmVxLm1lc3NhZ2UudGV4dCkuam9pbignLCAnKVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgYWxsUGljazogSVF1aWNrUGlja0l0ZW0gPSB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5zdGFydEVkaXRpbmcucGlja0FsbCcsIFwiQWxsIHJlcXVlc3RzIGZyb20gdGhlIGNvbnZlcnNhdGlvblwiKVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgY3VzdG9tUGljazogSVF1aWNrUGlja0l0ZW0gPSB7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5zdGFydEVkaXRpbmcucGlja0N1c3RvbScsIFwiTWFudWFsbHkgc2VsZWN0IHJlcXVlc3RzLi4uXCIpXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBwaWNrczogSVF1aWNrUGlja0l0ZW1bXSA9IHJlbGF0ZWRSZXF1ZXN0cy5sZW5ndGggIT09IDBcblx0XHRcdFx0PyBbbGFzdFBpY2ssIGFsbFBpY2ssIGN1c3RvbVBpY2tdXG5cdFx0XHRcdDogW2FsbFBpY2ssIGN1c3RvbVBpY2tdO1xuXG5cdFx0XHRjb25zdCBmaXJzdFBpY2sgPSBhd2FpdCBxdWlja1BpY2tTZXJ2aWNlLnBpY2socGlja3MsIHtcblx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5waWNrUmVxdWVzdCcsIFwiU2VsZWN0IHJlcXVlc3RzIHRoYXQgeW91IHdhbnQgdG8gdXNlIGZvciBlZGl0aW5nXCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFmaXJzdFBpY2spIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fSBlbHNlIGlmIChmaXJzdFBpY2sgPT09IGFsbFBpY2spIHtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3RzO1xuXHRcdFx0fSBlbHNlIGlmIChmaXJzdFBpY2sgPT09IGxhc3RQaWNrKSB7XG5cdFx0XHRcdHJldHVybiByZWxhdGVkUmVxdWVzdHM7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGN1c3RvbSBwaWNrXG5cdFx0XHR0eXBlIFBpY2tUeXBlID0gKElRdWlja1BpY2tJdGVtICYgeyByZXF1ZXN0OiBJQ2hhdFJlcXVlc3RNb2RlbCB9KTtcblx0XHRcdGNvbnN0IGN1c3RvbVBpY2tzOiAoSVF1aWNrUGlja0l0ZW0gJiB7IHJlcXVlc3Q6IElDaGF0UmVxdWVzdE1vZGVsIH0pW10gPSByZXF1ZXN0cy5tYXAocmVxdWVzdCA9PiAoe1xuXG5cdFx0XHRcdHBpY2tlZDogZmFsc2UsXG5cdFx0XHRcdHJlcXVlc3Q6IHJlcXVlc3QsXG5cdFx0XHRcdGxhYmVsOiByZXF1ZXN0Lm1lc3NhZ2UudGV4dCxcblx0XHRcdFx0ZGV0YWlsOiByZXF1ZXN0LnJlc3BvbnNlPy5yZXNwb25zZS50b1N0cmluZygpLFxuXHRcdFx0fSkpO1xuXG5cblx0XHRcdHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxJQ2hhdFJlcXVlc3RNb2RlbFtdPihfcmVzb2x2ZSA9PiB7XG5cblx0XHRcdFx0Y29uc3QgcmVzb2x2ZSA9ICh2YWx1ZTogSUNoYXRSZXF1ZXN0TW9kZWxbXSkgPT4ge1xuXHRcdFx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRfcmVzb2x2ZSh2YWx1ZSk7XG5cdFx0XHRcdFx0cXAuaGlkZSgpO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0XHRcdGNvbnN0IHFwID0gcXVpY2tQaWNrU2VydmljZS5jcmVhdGVRdWlja1BpY2s8UGlja1R5cGU+KCk7XG5cdFx0XHRcdHFwLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ2NoYXQuc3RhcnRFZGl0aW5nLnBpY2tSZXF1ZXN0JywgXCJTZWxlY3QgcmVxdWVzdHMgdGhhdCB5b3Ugd2FudCB0byB1c2UgZm9yIGVkaXRpbmdcIik7XG5cdFx0XHRcdHFwLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdFx0XHRxcC5pdGVtcyA9IGN1c3RvbVBpY2tzO1xuXG5cdFx0XHRcdGxldCBpZ25vcmUgPSBmYWxzZTtcblx0XHRcdFx0c3RvcmUuYWRkKHFwLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChpZ25vcmUpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWdub3JlID0gdHJ1ZTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IGU7XG5cblx0XHRcdFx0XHRcdGNvbnN0IHNlbGVjdGVkOiB0eXBlb2YgY3VzdG9tUGlja3MgPSBbXTtcblx0XHRcdFx0XHRcdGxldCBkaXNhYmxlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGN1c3RvbVBpY2tzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG9sZEl0ZW0gPSBjdXN0b21QaWNrc1tpXTtcblx0XHRcdFx0XHRcdFx0Y3VzdG9tUGlja3NbaV0gPSB7XG5cdFx0XHRcdFx0XHRcdFx0Li4ub2xkSXRlbSxcblx0XHRcdFx0XHRcdFx0XHRkaXNhYmxlZCxcblx0XHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0XHRkaXNhYmxlZCA9IGRpc2FibGVkIHx8IG9sZEl0ZW0gPT09IGZpcnN0O1xuXG5cdFx0XHRcdFx0XHRcdGlmIChkaXNhYmxlZCkge1xuXHRcdFx0XHRcdFx0XHRcdHNlbGVjdGVkLnB1c2goY3VzdG9tUGlja3NbaV0pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRxcC5pdGVtcyA9IGN1c3RvbVBpY2tzO1xuXHRcdFx0XHRcdFx0cXAuc2VsZWN0ZWRJdGVtcyA9IHNlbGVjdGVkO1xuXG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdGlnbm9yZSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHN0b3JlLmFkZChxcC5vbkRpZEFjY2VwdChfZSA9PiByZXNvbHZlKHFwLnNlbGVjdGVkSXRlbXMubWFwKGkgPT4gaS5yZXF1ZXN0KSkpKTtcblx0XHRcdFx0c3RvcmUuYWRkKHFwLm9uRGlkSGlkZShfID0+IHJlc29sdmUoW10pKSk7XG5cdFx0XHRcdHN0b3JlLmFkZChxcCk7XG5cdFx0XHRcdHFwLnNob3coKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHR9KTtcbn1cblxuaW50ZXJmYWNlIE1hcmtkb3duQ29udGVudCB7XG5cdHR5cGU6ICdtYXJrZG93bic7XG5cdGNvbnRlbnQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIENvZGVDb250ZW50IHtcblx0dHlwZTogJ2NvZGUnO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xuXHRjb250ZW50OiBzdHJpbmc7XG59XG5cbnR5cGUgQ29udGVudCA9IE1hcmtkb3duQ29udGVudCB8IENvZGVDb250ZW50O1xuXG5mdW5jdGlvbiBzcGxpdE1hcmtkb3duQW5kQ29kZUJsb2NrcyhtYXJrZG93bjogc3RyaW5nKTogQ29udGVudFtdIHtcblx0Y29uc3QgbGV4ZXIgPSBuZXcgbWFya2VkLkxleGVyKCk7XG5cdGNvbnN0IHRva2VucyA9IGxleGVyLmxleChtYXJrZG93bik7XG5cblx0Y29uc3Qgc3BsaXRDb250ZW50OiBDb250ZW50W10gPSBbXTtcblxuXHRsZXQgbWFya2Rvd25QYXJ0ID0gJyc7XG5cdHRva2Vucy5mb3JFYWNoKCh0b2tlbikgPT4ge1xuXHRcdGlmICh0b2tlbi50eXBlID09PSAnY29kZScpIHtcblx0XHRcdGlmIChtYXJrZG93blBhcnQudHJpbSgpKSB7XG5cdFx0XHRcdHNwbGl0Q29udGVudC5wdXNoKHsgdHlwZTogJ21hcmtkb3duJywgY29udGVudDogbWFya2Rvd25QYXJ0IH0pO1xuXHRcdFx0XHRtYXJrZG93blBhcnQgPSAnJztcblx0XHRcdH1cblx0XHRcdHNwbGl0Q29udGVudC5wdXNoKHtcblx0XHRcdFx0dHlwZTogJ2NvZGUnLFxuXHRcdFx0XHRsYW5ndWFnZTogdG9rZW4ubGFuZyB8fCAnJyxcblx0XHRcdFx0Y29udGVudDogdG9rZW4udGV4dCxcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtYXJrZG93blBhcnQgKz0gdG9rZW4ucmF3O1xuXHRcdH1cblx0fSk7XG5cblx0aWYgKG1hcmtkb3duUGFydC50cmltKCkpIHtcblx0XHRzcGxpdENvbnRlbnQucHVzaCh7IHR5cGU6ICdtYXJrZG93bicsIGNvbnRlbnQ6IG1hcmtkb3duUGFydCB9KTtcblx0fVxuXG5cdHJldHVybiBzcGxpdENvbnRlbnQ7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMscUJBQXFCLG9CQUFvQjtBQUNsRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFFcEIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywwQkFBMEM7QUFDbkQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx5Q0FBeUM7QUFFbEQsU0FBUyxjQUFjLFVBQVUsMEJBQTBCO0FBQzNELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCLHVCQUF1QjtBQUNyRCxTQUFTLG1DQUFtQyx5QkFBeUIscUJB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
