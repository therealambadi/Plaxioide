import { raceTimeout } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { localize2 } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ActiveEditorContext } from "../../../../common/contextkeys.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { isChatViewTitleActionContext } from "../../common/chatActions.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/chatContextKeys.js";
import { hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { ChatAgentLocation, ChatMode } from "../../common/constants.js";
import { ChatViewId, EditsViewId, IChatWidgetService } from "../chat.js";
import { EditingSessionAction } from "../chatEditing/chatEditingActions.js";
import { ctxIsGlobalEditingSession } from "../chatEditing/chatEditingEditorContextKeys.js";
import { ChatEditorInput } from "../chatEditorInput.js";
import { CHAT_CATEGORY, handleCurrentEditingSession } from "./chatActions.js";
import { clearChatEditor } from "./chatClear.js";
const ACTION_ID_NEW_CHAT = `workbench.action.chat.newChat`;
const ACTION_ID_NEW_EDIT_SESSION = `workbench.action.chat.newEditSession`;
const ChatDoneActionId = "workbench.action.chat.done";
function registerNewChatActions() {
  registerAction2(class NewChatEditorAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chatEditor.newChat",
        title: localize2("chat.newChat.label", "New Chat"),
        icon: Codicon.plus,
        f1: false,
        precondition: ChatContextKeys.enabled,
        menu: [{
          id: MenuId.EditorTitle,
          group: "navigation",
          order: 0,
          when: ActiveEditorContext.isEqualTo(ChatEditorInput.EditorID)
        }]
      });
    }
    async run(accessor, ...args) {
      announceChatCleared(accessor.get(IAccessibilitySignalService));
      await clearChatEditor(accessor);
    }
  });
  registerAction2(class GlobalClearChatAction extends Action2 {
    constructor() {
      super({
        id: ACTION_ID_NEW_CHAT,
        title: localize2("chat.newChat.label", "New Chat"),
        category: CHAT_CATEGORY,
        icon: Codicon.plus,
        precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.location.notEqualsTo(ChatAgentLocation.EditingSession), ChatContextKeyExprs.unifiedChatEnabled.negate()),
        f1: true,
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyCode.KeyL,
          mac: {
            primary: KeyMod.WinCtrl | KeyCode.KeyL
          },
          when: ChatContextKeys.inChatSession
        },
        menu: [
          {
            id: MenuId.ChatContext,
            group: "z_clear",
            when: ContextKeyExpr.and(
              ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel),
              ChatContextKeys.inUnifiedChat.negate()
            )
          },
          {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.and(
              ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel),
              ChatContextKeys.inUnifiedChat.negate()
            ),
            group: "navigation",
            order: -1
          }
        ]
      });
    }
    async run(accessor, ...args) {
      const context = args[0];
      const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
      const widgetService = accessor.get(IChatWidgetService);
      let widget = widgetService.lastFocusedWidget;
      if (isChatViewTitleActionContext(context)) {
        widget = widgetService.getWidgetBySessionId(context.sessionId);
      }
      if (widget) {
        announceChatCleared(accessibilitySignalService);
        widget.clear();
        widget.focusInput();
      }
    }
  });
  registerAction2(class NewEditSessionAction extends EditingSessionAction {
    constructor() {
      super({
        id: ACTION_ID_NEW_EDIT_SESSION,
        title: localize2("chat.newEdits.label", "New Chat"),
        category: CHAT_CATEGORY,
        icon: Codicon.plus,
        precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
        f1: true,
        menu: [
          {
            id: MenuId.ChatContext,
            group: "z_clear"
          },
          {
            id: MenuId.ViewTitle,
            when: ChatContextKeyExprs.inEditsOrUnified,
            group: "navigation",
            order: -1
          }
        ],
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyCode.KeyL,
          mac: {
            primary: KeyMod.WinCtrl | KeyCode.KeyL
          },
          when: ChatContextKeys.inChatSession
        }
      });
    }
    async runEditingSessionAction(accessor, editingSession, widget, ...args) {
      const context = args[0];
      const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
      const dialogService = accessor.get(IDialogService);
      const chatService = accessor.get(IChatService);
      if (!await handleCurrentEditingSession(editingSession, void 0, dialogService)) {
        return;
      }
      announceChatCleared(accessibilitySignalService);
      await editingSession.stop();
      widget.clear();
      await waitForChatSessionCleared(editingSession.chatSessionId, chatService);
      widget.attachmentModel.clear();
      widget.input.relatedFiles?.clear();
      widget.focusInput();
      if (!context) {
        return;
      }
      if (typeof context.agentMode === "boolean") {
        widget.input.setChatMode(context.agentMode ? ChatMode.Agent : ChatMode.Edit);
      }
      if (context.inputValue) {
        if (context.isPartialQuery) {
          widget.setInput(context.inputValue);
        } else {
          widget.acceptInput(context.inputValue);
        }
      }
    }
  });
  registerAction2(class GlobalEditsDoneAction extends EditingSessionAction {
    constructor() {
      super({
        id: ChatDoneActionId,
        title: localize2("chat.done.label", "Done"),
        category: CHAT_CATEGORY,
        precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
        f1: false,
        menu: [{
          id: MenuId.ChatEditingWidgetToolbar,
          when: ContextKeyExpr.and(hasUndecidedChatEditingResourceContextKey.negate(), hasAppliedChatEditsContextKey, ChatContextKeys.editingParticipantRegistered, ChatContextKeyExprs.inEditsOrUnified),
          group: "navigation",
          order: 0
        }]
      });
    }
    async runEditingSessionAction(accessor, editingSession, widget, ...args) {
      const context = args[0];
      const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
      if (isChatViewTitleActionContext(context)) {
        announceChatCleared(accessibilitySignalService);
        if (widget) {
          widget.clear();
          widget.attachmentModel.clear();
          widget.focusInput();
        }
      } else {
        announceChatCleared(accessibilitySignalService);
        widget.clear();
        widget.attachmentModel.clear();
        widget.focusInput();
      }
    }
  });
  registerAction2(class UndoChatEditInteractionAction extends EditingSessionAction {
    constructor() {
      super({
        id: "workbench.action.chat.undoEdit",
        title: localize2("chat.undoEdit.label", "Undo Last Request"),
        category: CHAT_CATEGORY,
        icon: Codicon.discard,
        precondition: ContextKeyExpr.and(ChatContextKeys.chatEditingCanUndo, ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
        f1: true,
        menu: [{
          id: MenuId.ViewTitle,
          when: ChatContextKeyExprs.inEditsOrUnified,
          group: "navigation",
          order: -3
        }]
      });
    }
    async runEditingSessionAction(accessor, editingSession) {
      await editingSession.undoInteraction();
    }
  });
  registerAction2(class RedoChatEditInteractionAction extends EditingSessionAction {
    constructor() {
      super({
        id: "workbench.action.chat.redoEdit",
        title: localize2("chat.redoEdit.label", "Redo Last Request"),
        category: CHAT_CATEGORY,
        icon: Codicon.redo,
        precondition: ContextKeyExpr.and(ChatContextKeys.chatEditingCanRedo, ChatContextKeys.enabled, ChatContextKeys.editingParticipantRegistered),
        f1: true,
        menu: [{
          id: MenuId.ViewTitle,
          when: ChatContextKeyExprs.inEditsOrUnified,
          group: "navigation",
          order: -2
        }]
      });
    }
    async runEditingSessionAction(accessor, editingSession) {
      await editingSession.redoInteraction();
    }
  });
  registerAction2(class GlobalOpenEditsAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.openEditSession",
        title: localize2("chat.openEdits.label", "Open {0}", "Copilot Edits"),
        category: CHAT_CATEGORY,
        icon: Codicon.goToEditingSession,
        f1: true,
        precondition: ChatContextKeys.Setup.hidden.toNegated(),
        menu: [{
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.and(
            ContextKeyExpr.equals("view", ChatViewId),
            ChatContextKeys.editingParticipantRegistered,
            ContextKeyExpr.equals(`view.${EditsViewId}.visible`, false),
            ContextKeyExpr.or(
              ContextKeyExpr.and(ContextKeyExpr.equals(`workbench.panel.chat.defaultViewContainerLocation`, true), ContextKeyExpr.equals(`workbench.panel.chatEditing.defaultViewContainerLocation`, false)),
              ContextKeyExpr.and(ContextKeyExpr.equals(`workbench.panel.chat.defaultViewContainerLocation`, false), ContextKeyExpr.equals(`workbench.panel.chatEditing.defaultViewContainerLocation`, true))
            ),
            ChatContextKeys.inUnifiedChat.negate()
          ),
          group: "navigation",
          order: 1
        }, {
          id: MenuId.ChatTitleBarMenu,
          group: "a_open",
          order: 2,
          when: ChatContextKeyExprs.unifiedChatEnabled.negate()
        }, {
          id: MenuId.ChatEditingEditorContent,
          when: ctxIsGlobalEditingSession,
          group: "navigate",
          order: 4
        }],
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI,
          linux: {
            primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyMod.Shift | KeyCode.KeyI
          },
          when: ContextKeyExpr.and(ContextKeyExpr.notEquals("view", EditsViewId), ChatContextKeys.editingParticipantRegistered)
        }
      });
    }
    async run(accessor, opts) {
      opts = typeof opts === "string" ? { query: opts } : opts;
      const viewsService = accessor.get(IViewsService);
      const chatView = await viewsService.openView(EditsViewId) ?? await viewsService.openView(ChatViewId);
      if (!chatView?.widget) {
        return;
      }
      if (!chatView.widget.viewModel) {
        await Event.toPromise(
          Event.filter(chatView.widget.onDidChangeViewModel, () => !!chatView.widget.viewModel)
        );
      }
      if (opts?.query) {
        if (opts.isPartialQuery) {
          chatView.widget.setInput(opts.query);
        } else {
          chatView.widget.acceptInput(opts.query);
        }
      }
      chatView.widget.focusInput();
    }
  });
}
function announceChatCleared(accessibilitySignalService) {
  accessibilitySignalService.playSignal(AccessibilitySignal.clear);
}
async function waitForChatSessionCleared(sessionId, chatService) {
  if (!chatService.getSession(sessionId)) {
    return;
  }
  await raceTimeout(Event.toPromise(
    Event.filter(chatService.onDidDisposeSession, (e) => e.sessionId === sessionId)
  ), 2e3);
}
export {
  ACTION_ID_NEW_CHAT,
  ACTION_ID_NEW_EDIT_SESSION,
  ChatDoneActionId,
  registerNewChatActions,
  waitForChatSessionCleared
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0Q2xlYXJBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgcmFjZVRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNDaGF0Vmlld1RpdGxlQWN0aW9uQ29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleUV4cHJzLCBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGhhc0FwcGxpZWRDaGF0RWRpdHNDb250ZXh0S2V5LCBoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgSUNoYXRFZGl0aW5nU2Vzc2lvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uLCBDaGF0TW9kZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdJZCwgRWRpdHNWaWV3SWQsIElDaGF0V2lkZ2V0LCBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IEVkaXRpbmdTZXNzaW9uQWN0aW9uIH0gZnJvbSAnLi4vY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdBY3Rpb25zLmpzJztcbmltcG9ydCB7IGN0eElzR2xvYmFsRWRpdGluZ1Nlc3Npb24gfSBmcm9tICcuLi9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENoYXRFZGl0b3JJbnB1dCB9IGZyb20gJy4uL2NoYXRFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBDaGF0Vmlld1BhbmUgfSBmcm9tICcuLi9jaGF0Vmlld1BhbmUuanMnO1xuaW1wb3J0IHsgQ0hBVF9DQVRFR09SWSwgaGFuZGxlQ3VycmVudEVkaXRpbmdTZXNzaW9uLCBJQ2hhdFZpZXdPcGVuT3B0aW9ucyB9IGZyb20gJy4vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgY2xlYXJDaGF0RWRpdG9yIH0gZnJvbSAnLi9jaGF0Q2xlYXIuanMnO1xuXG5leHBvcnQgY29uc3QgQUNUSU9OX0lEX05FV19DSEFUID0gYHdvcmtiZW5jaC5hY3Rpb24uY2hhdC5uZXdDaGF0YDtcbmV4cG9ydCBjb25zdCBBQ1RJT05fSURfTkVXX0VESVRfU0VTU0lPTiA9IGB3b3JrYmVuY2guYWN0aW9uLmNoYXQubmV3RWRpdFNlc3Npb25gO1xuZXhwb3J0IGNvbnN0IENoYXREb25lQWN0aW9uSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmRvbmUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElOZXdFZGl0U2Vzc2lvbkFjdGlvbkNvbnRleHQge1xuXHQvKipcblx0ICogQW4gaW5pdGlhbCBwcm9tcHQgdG8gd3JpdGUgdG8gdGhlIGNoYXQuXG5cdCAqL1xuXHRpbnB1dFZhbHVlPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBTZWxlY3RzIG9wZW5pbmcgaW4gYWdlbnQgbW9kZSBvciBub3QuIElmIG5vdCBzZXQsIHRoZSBjdXJyZW50IG1vZGUgaXMgdXNlZC5cblx0ICogVGhpcyBpcyBpZ25vcmVkIHdoZW4gY29taW5nIGZyb20gYSBjaGF0IHZpZXcgdGl0bGUgY29udGV4dC5cblx0ICovXG5cdGFnZW50TW9kZT86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIGlucHV0VmFsdWUgaXMgcGFydGlhbCBhbmQgc2hvdWxkIHdhaXQgZm9yIGZ1cnRoZXIgdXNlciBpbnB1dC4gSWYgZmFsc2Ugb3Igbm90IHNldCwgdGhlIHByb21wdCBpcyBzZW50IGltbWVkaWF0ZWx5LlxuXHQgKi9cblx0aXNQYXJ0aWFsUXVlcnk/OiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJOZXdDaGF0QWN0aW9ucygpIHtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE5ld0NoYXRFZGl0b3JBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXRFZGl0b3IubmV3Q2hhdCcsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQubmV3Q2hhdC5sYWJlbCcsIFwiTmV3IENoYXRcIiksXG5cdFx0XHRcdGljb246IENvZGljb24ucGx1cyxcblx0XHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0XHR3aGVuOiBBY3RpdmVFZGl0b3JDb250ZXh0LmlzRXF1YWxUbyhDaGF0RWRpdG9ySW5wdXQuRWRpdG9ySUQpLFxuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGFubm91bmNlQ2hhdENsZWFyZWQoYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSkpO1xuXHRcdFx0YXdhaXQgY2xlYXJDaGF0RWRpdG9yKGFjY2Vzc29yKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBHbG9iYWxDbGVhckNoYXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IEFDVElPTl9JRF9ORVdfQ0hBVCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC5uZXdDaGF0LmxhYmVsJywgXCJOZXcgQ2hhdFwiKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24ucGx1cyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsIENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5ub3RFcXVhbHNUbyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiksIENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpKSxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5TCxcblx0XHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlMXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvblxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdENvbnRleHQsXG5cdFx0XHRcdFx0Z3JvdXA6ICd6X2NsZWFyJyxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMubG9jYXRpb24uaXNFcXVhbFRvKENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKSxcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pblVuaWZpZWRDaGF0Lm5lZ2F0ZSgpKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5pc0VxdWFsVG8oQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpLFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmluVW5pZmllZENoYXQubmVnYXRlKCkpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IC0xXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRjb25zdCBjb250ZXh0ID0gYXJnc1swXTtcblx0XHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRjb25zdCB3aWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cblx0XHRcdGxldCB3aWRnZXQgPSB3aWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXG5cdFx0XHRpZiAoaXNDaGF0Vmlld1RpdGxlQWN0aW9uQ29udGV4dChjb250ZXh0KSkge1xuXHRcdFx0XHQvLyBJcyBydW5uaW5nIGluIHRoZSBDaGF0IHZpZXcgdGl0bGVcblx0XHRcdFx0d2lkZ2V0ID0gd2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChjb250ZXh0LnNlc3Npb25JZCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh3aWRnZXQpIHtcblx0XHRcdFx0YW5ub3VuY2VDaGF0Q2xlYXJlZChhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRcdHdpZGdldC5jbGVhcigpO1xuXHRcdFx0XHR3aWRnZXQuZm9jdXNJbnB1dCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE5ld0VkaXRTZXNzaW9uQWN0aW9uIGV4dGVuZHMgRWRpdGluZ1Nlc3Npb25BY3Rpb24ge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogQUNUSU9OX0lEX05FV19FRElUX1NFU1NJT04sXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQubmV3RWRpdHMubGFiZWwnLCBcIk5ldyBDaGF0XCIpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5wbHVzLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuZW5hYmxlZCwgQ2hhdENvbnRleHRLZXlzLmVkaXRpbmdQYXJ0aWNpcGFudFJlZ2lzdGVyZWQpLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRDb250ZXh0LFxuXHRcdFx0XHRcdGdyb3VwOiAnel9jbGVhcidcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5RXhwcnMuaW5FZGl0c09yVW5pZmllZCxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAtMVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlMLFxuXHRcdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleUxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXG5cdFx0YXN5bmMgcnVuRWRpdGluZ1Nlc3Npb25BY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRpbmdTZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCB3aWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgY29udGV4dDogSU5ld0VkaXRTZXNzaW9uQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCA9IGFyZ3NbMF07XG5cdFx0XHRjb25zdCBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSA9IGFjY2Vzc29yLmdldChJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXG5cdFx0XHRpZiAoIShhd2FpdCBoYW5kbGVDdXJyZW50RWRpdGluZ1Nlc3Npb24oZWRpdGluZ1Nlc3Npb24sIHVuZGVmaW5lZCwgZGlhbG9nU2VydmljZSkpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YW5ub3VuY2VDaGF0Q2xlYXJlZChhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cblx0XHRcdGF3YWl0IGVkaXRpbmdTZXNzaW9uLnN0b3AoKTtcblx0XHRcdHdpZGdldC5jbGVhcigpO1xuXHRcdFx0YXdhaXQgd2FpdEZvckNoYXRTZXNzaW9uQ2xlYXJlZChlZGl0aW5nU2Vzc2lvbi5jaGF0U2Vzc2lvbklkLCBjaGF0U2VydmljZSk7XG5cdFx0XHR3aWRnZXQuYXR0YWNobWVudE1vZGVsLmNsZWFyKCk7XG5cdFx0XHR3aWRnZXQuaW5wdXQucmVsYXRlZEZpbGVzPy5jbGVhcigpO1xuXHRcdFx0d2lkZ2V0LmZvY3VzSW5wdXQoKTtcblxuXHRcdFx0aWYgKCFjb250ZXh0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHR5cGVvZiBjb250ZXh0LmFnZW50TW9kZSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRcdHdpZGdldC5pbnB1dC5zZXRDaGF0TW9kZShjb250ZXh0LmFnZW50TW9kZSA/IENoYXRNb2RlLkFnZW50IDogQ2hhdE1vZGUuRWRpdCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb250ZXh0LmlucHV0VmFsdWUpIHtcblx0XHRcdFx0aWYgKGNvbnRleHQuaXNQYXJ0aWFsUXVlcnkpIHtcblx0XHRcdFx0XHR3aWRnZXQuc2V0SW5wdXQoY29udGV4dC5pbnB1dFZhbHVlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR3aWRnZXQuYWNjZXB0SW5wdXQoY29udGV4dC5pbnB1dFZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEdsb2JhbEVkaXRzRG9uZUFjdGlvbiBleHRlbmRzIEVkaXRpbmdTZXNzaW9uQWN0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IENoYXREb25lQWN0aW9uSWQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQuZG9uZS5sYWJlbCcsIFwiRG9uZVwiKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5lbmFibGVkLCBDaGF0Q29udGV4dEtleXMuZWRpdGluZ1BhcnRpY2lwYW50UmVnaXN0ZXJlZCksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nV2lkZ2V0VG9vbGJhcixcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoaGFzVW5kZWNpZGVkQ2hhdEVkaXRpbmdSZXNvdXJjZUNvbnRleHRLZXkubmVnYXRlKCksIGhhc0FwcGxpZWRDaGF0RWRpdHNDb250ZXh0S2V5LCBDaGF0Q29udGV4dEtleXMuZWRpdGluZ1BhcnRpY2lwYW50UmVnaXN0ZXJlZCwgQ2hhdENvbnRleHRLZXlFeHBycy5pbkVkaXRzT3JVbmlmaWVkKSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAwXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRvdmVycmlkZSBhc3luYyBydW5FZGl0aW5nU2Vzc2lvbkFjdGlvbihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIHdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRjb25zdCBjb250ZXh0ID0gYXJnc1swXTtcblx0XHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRpZiAoaXNDaGF0Vmlld1RpdGxlQWN0aW9uQ29udGV4dChjb250ZXh0KSkge1xuXHRcdFx0XHQvLyBJcyBydW5uaW5nIGluIHRoZSBDaGF0IHZpZXcgdGl0bGVcblx0XHRcdFx0YW5ub3VuY2VDaGF0Q2xlYXJlZChhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRcdGlmICh3aWRnZXQpIHtcblx0XHRcdFx0XHR3aWRnZXQuY2xlYXIoKTtcblx0XHRcdFx0XHR3aWRnZXQuYXR0YWNobWVudE1vZGVsLmNsZWFyKCk7XG5cdFx0XHRcdFx0d2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gSXMgcnVubmluZyBmcm9tIGYxIG9yIGtleWJpbmRpbmdcblx0XHRcdFx0YW5ub3VuY2VDaGF0Q2xlYXJlZChhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRcdHdpZGdldC5jbGVhcigpO1xuXHRcdFx0XHR3aWRnZXQuYXR0YWNobWVudE1vZGVsLmNsZWFyKCk7XG5cdFx0XHRcdHdpZGdldC5mb2N1c0lucHV0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgVW5kb0NoYXRFZGl0SW50ZXJhY3Rpb25BY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnVuZG9FZGl0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC51bmRvRWRpdC5sYWJlbCcsIFwiVW5kbyBMYXN0IFJlcXVlc3RcIiksXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmRpc2NhcmQsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5jaGF0RWRpdGluZ0NhblVuZG8sIENoYXRDb250ZXh0S2V5cy5lbmFibGVkLCBDaGF0Q29udGV4dEtleXMuZWRpdGluZ1BhcnRpY2lwYW50UmVnaXN0ZXJlZCksXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5RXhwcnMuaW5FZGl0c09yVW5pZmllZCxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAtM1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuRWRpdGluZ1Nlc3Npb25BY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRpbmdTZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uKSB7XG5cdFx0XHRhd2FpdCBlZGl0aW5nU2Vzc2lvbi51bmRvSW50ZXJhY3Rpb24oKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZWRvQ2hhdEVkaXRJbnRlcmFjdGlvbkFjdGlvbiBleHRlbmRzIEVkaXRpbmdTZXNzaW9uQWN0aW9uIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQucmVkb0VkaXQnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0LnJlZG9FZGl0LmxhYmVsJywgXCJSZWRvIExhc3QgUmVxdWVzdFwiKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24ucmVkbyxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmNoYXRFZGl0aW5nQ2FuUmVkbywgQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsIENoYXRDb250ZXh0S2V5cy5lZGl0aW5nUGFydGljaXBhbnRSZWdpc3RlcmVkKSxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlFeHBycy5pbkVkaXRzT3JVbmlmaWVkLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IC0yXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhc3luYyBydW5FZGl0aW5nU2Vzc2lvbkFjdGlvbihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdGF3YWl0IGVkaXRpbmdTZXNzaW9uLnJlZG9JbnRlcmFjdGlvbigpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEdsb2JhbE9wZW5FZGl0c0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5vcGVuRWRpdFNlc3Npb24nLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0Lm9wZW5FZGl0cy5sYWJlbCcsIFwiT3BlbiB7MH1cIiwgJ0NvcGlsb3QgRWRpdHMnKSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGljb246IENvZGljb24uZ29Ub0VkaXRpbmdTZXNzaW9uLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuU2V0dXAuaGlkZGVuLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIENoYXRWaWV3SWQpLFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmVkaXRpbmdQYXJ0aWNpcGFudFJlZ2lzdGVyZWQsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYHZpZXcuJHtFZGl0c1ZpZXdJZH0udmlzaWJsZWAsIGZhbHNlKSxcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKGB3b3JrYmVuY2gucGFuZWwuY2hhdC5kZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uYCwgdHJ1ZSksIENvbnRleHRLZXlFeHByLmVxdWFscyhgd29ya2JlbmNoLnBhbmVsLmNoYXRFZGl0aW5nLmRlZmF1bHRWaWV3Q29udGFpbmVyTG9jYXRpb25gLCBmYWxzZSkpLFxuXHRcdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKGB3b3JrYmVuY2gucGFuZWwuY2hhdC5kZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uYCwgZmFsc2UpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoYHdvcmtiZW5jaC5wYW5lbC5jaGF0RWRpdGluZy5kZWZhdWx0Vmlld0NvbnRhaW5lckxvY2F0aW9uYCwgdHJ1ZSkpLFxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pblVuaWZpZWRDaGF0Lm5lZ2F0ZSgpXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRUaXRsZUJhck1lbnUsXG5cdFx0XHRcdFx0Z3JvdXA6ICdhX29wZW4nLFxuXHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9yQ29udGVudCxcblx0XHRcdFx0XHR3aGVuOiBjdHhJc0dsb2JhbEVkaXRpbmdTZXNzaW9uLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGUnLFxuXHRcdFx0XHRcdG9yZGVyOiA0LFxuXHRcdFx0XHR9XSxcblx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlJLFxuXHRcdFx0XHRcdGxpbnV4OiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUlcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ3ZpZXcnLCBFZGl0c1ZpZXdJZCksIENoYXRDb250ZXh0S2V5cy5lZGl0aW5nUGFydGljaXBhbnRSZWdpc3RlcmVkKVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9wdHM/OiBzdHJpbmcgfCBJQ2hhdFZpZXdPcGVuT3B0aW9ucykge1xuXHRcdFx0b3B0cyA9IHR5cGVvZiBvcHRzID09PSAnc3RyaW5nJyA/IHsgcXVlcnk6IG9wdHMgfSA6IG9wdHM7XG5cdFx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBjaGF0VmlldyA9IGF3YWl0IHZpZXdzU2VydmljZS5vcGVuVmlldzxDaGF0Vmlld1BhbmU+KEVkaXRzVmlld0lkKVxuXHRcdFx0XHQ/PyBhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXc8Q2hhdFZpZXdQYW5lPihDaGF0Vmlld0lkKTtcblxuXHRcdFx0aWYgKCFjaGF0Vmlldz8ud2lkZ2V0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFjaGF0Vmlldy53aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZShcblx0XHRcdFx0XHRFdmVudC5maWx0ZXIoY2hhdFZpZXcud2lkZ2V0Lm9uRGlkQ2hhbmdlVmlld01vZGVsLCAoKSA9PiAhIWNoYXRWaWV3LndpZGdldC52aWV3TW9kZWwpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvcHRzPy5xdWVyeSkge1xuXHRcdFx0XHRpZiAob3B0cy5pc1BhcnRpYWxRdWVyeSkge1xuXHRcdFx0XHRcdGNoYXRWaWV3LndpZGdldC5zZXRJbnB1dChvcHRzLnF1ZXJ5KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjaGF0Vmlldy53aWRnZXQuYWNjZXB0SW5wdXQob3B0cy5xdWVyeSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y2hhdFZpZXcud2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBhbm5vdW5jZUNoYXRDbGVhcmVkKGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UpOiB2b2lkIHtcblx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmNsZWFyKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JDaGF0U2Vzc2lvbkNsZWFyZWQoc2Vzc2lvbklkOiBzdHJpbmcsIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0aWYgKCFjaGF0U2VydmljZS5nZXRTZXNzaW9uKHNlc3Npb25JZCkpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyBUaGUgQ2hhdFdpZGdldCBqdXN0IHNpZ25hbHMgY2FuY2VsbGF0aW9uIHRvIGl0cyBob3N0IHZpZXdwYW5lIG9yIGVkaXRvci4gQ2xlYXJpbmcgdGhlIHNlc3Npb24gaXMgbm93IGFzeW5jLCB3ZSBuZWVkIHRvIHdhaXQgZm9yIGl0IHRvIGZpbmlzaC5cblx0Ly8gVGhpcyBpcyBleHBlY3RlZCB0byBhbHdheXMgaGFwcGVuLlxuXHRhd2FpdCByYWNlVGltZW91dChFdmVudC50b1Byb21pc2UoXG5cdFx0RXZlbnQuZmlsdGVyKGNoYXRTZXJ2aWNlLm9uRGlkRGlzcG9zZVNlc3Npb24sIGUgPT4gZS5zZXNzaW9uSWQgPT09IHNlc3Npb25JZCksXG5cdCksIDIwMDApO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFNBQVMsY0FBYztBQUVoQyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHFCQUFxQixtQ0FBbUM7QUFDakUsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMscUJBQXFCLHVCQUF1QjtBQUNyRCxTQUFTLCtCQUErQixpREFBc0U7QUFDOUcsU0FBUyxvQkFBb0I7QUFD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
