import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/chatContextKeys.js";
import { WorkingSetEntryState } from "../../common/chatEditingService.js";
import { chatVariableLeader } from "../../common/chatParserTypes.js";
import { IChatService } from "../../common/chatService.js";
import { ChatAgentLocation, ChatConfiguration, ChatMode, validateChatMode } from "../../common/constants.js";
import { ILanguageModelToolsService } from "../../common/languageModelToolsService.js";
import { EditsViewId, IChatWidgetService } from "../chat.js";
import { getEditingSessionContext } from "../chatEditing/chatEditingActions.js";
import { CHAT_CATEGORY, handleCurrentEditingSession } from "./chatActions.js";
import { ACTION_ID_NEW_CHAT, ChatDoneActionId, waitForChatSessionCleared } from "./chatClearActions.js";
class SubmitAction extends Action2 {
  run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    widget?.acceptInput(context?.inputValue);
  }
}
const whenNotInProgressOrPaused = ContextKeyExpr.or(ChatContextKeys.isRequestPaused, ChatContextKeys.requestInProgress.negate());
const _ChatSubmitAction = class _ChatSubmitAction extends SubmitAction {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      whenNotInProgressOrPaused,
      ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask)
    );
    super({
      id: _ChatSubmitAction.ID,
      title: localize2("interactive.submit.label", "Send and Dispatch"),
      f1: false,
      category: CHAT_CATEGORY,
      icon: Codicon.send,
      precondition,
      keybinding: {
        when: ChatContextKeys.inChatInput,
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [
        {
          id: MenuId.ChatExecuteSecondary,
          group: "group_1",
          order: 1,
          when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask)
        },
        {
          id: MenuId.ChatExecute,
          order: 4,
          when: ContextKeyExpr.and(
            whenNotInProgressOrPaused,
            ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask)
          ),
          group: "navigation"
        }
      ]
    });
  }
};
_ChatSubmitAction.ID = "workbench.action.chat.submit";
let ChatSubmitAction = _ChatSubmitAction;
const ToggleAgentModeActionId = "workbench.action.chat.toggleAgentMode";
const _ToggleChatModeAction = class _ToggleChatModeAction extends Action2 {
  constructor() {
    super({
      id: _ToggleChatModeAction.ID,
      title: localize2("interactive.toggleAgent.label", "Set Chat Mode"),
      f1: true,
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.or(
          ChatContextKeys.Editing.hasToolsAgent,
          ChatContextKeyExprs.unifiedChatEnabled
        ),
        ChatContextKeys.requestInProgress.negate()
      ),
      tooltip: localize("setChatMode", "Set Mode"),
      keybinding: {
        when: ContextKeyExpr.and(
          ChatContextKeys.inChatInput,
          ChatContextKeyExprs.inEditsOrUnified
        ),
        primary: KeyMod.CtrlCmd | KeyCode.Period,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [
        {
          id: MenuId.ChatExecute,
          order: 1,
          // Either in edits with agent mode available, or in unified chat view
          when: ContextKeyExpr.and(
            ChatContextKeys.enabled,
            ContextKeyExpr.or(
              ContextKeyExpr.and(
                ChatContextKeys.location.isEqualTo(ChatAgentLocation.EditingSession),
                ChatContextKeys.Editing.hasToolsAgent
              ),
              ChatContextKeys.inUnifiedChat
            )
          ),
          group: "navigation"
        }
      ]
    });
  }
  async run(accessor, ...args) {
    const chatService = accessor.get(IChatService);
    const commandService = accessor.get(ICommandService);
    const configurationService = accessor.get(IConfigurationService);
    const dialogService = accessor.get(IDialogService);
    const context = getEditingSessionContext(accessor, args);
    if (!context?.chatWidget) {
      return;
    }
    const arg = args.at(0);
    const chatSession = context.chatWidget.viewModel?.model;
    const requestCount = chatSession?.getRequests().length ?? 0;
    const switchToMode = validateChatMode(arg?.mode) ?? this.getNextMode(context.chatWidget, requestCount, configurationService);
    const needToClearEdits = (!chatService.unifiedViewEnabled || !configurationService.getValue(ChatConfiguration.Edits2Enabled) && (context.chatWidget.input.currentMode === ChatMode.Edit || switchToMode === ChatMode.Edit)) && requestCount > 0;
    if (switchToMode === context.chatWidget.input.currentMode) {
      return;
    }
    if (needToClearEdits) {
      const phrase = localize("switchMode.confirmPhrase", "Switching chat modes will end your current edit session.");
      if (!context.editingSession) {
        return;
      }
      const currentEdits = context.editingSession.entries.get();
      const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === WorkingSetEntryState.Modified);
      if (undecidedEdits.length > 0) {
        if (!await handleCurrentEditingSession(context.editingSession, phrase, dialogService)) {
          return;
        }
      } else {
        const confirmation = await dialogService.confirm({
          title: localize("agent.newSession", "Start new session?"),
          message: localize("agent.newSessionMessage", "Changing the chat mode will end your current edit session. Would you like to continue?"),
          primaryButton: localize("agent.newSession.confirm", "Yes"),
          type: "info"
        });
        if (!confirmation.confirmed) {
          return;
        }
      }
    }
    context.chatWidget.input.setChatMode(switchToMode);
    if (needToClearEdits) {
      const clearAction = chatService.unifiedViewEnabled ? ACTION_ID_NEW_CHAT : ChatDoneActionId;
      await commandService.executeCommand(clearAction);
    }
  }
  getNextMode(chatWidget, requestCount, configurationService) {
    const modes = [ChatMode.Agent];
    if (configurationService.getValue(ChatConfiguration.Edits2Enabled) || requestCount === 0) {
      modes.push(ChatMode.Edit);
    }
    if (chatWidget.location === ChatAgentLocation.Panel) {
      modes.push(ChatMode.Ask);
    }
    const modeIndex = modes.indexOf(chatWidget.input.currentMode);
    const newMode = modes[(modeIndex + 1) % modes.length];
    return newMode;
  }
};
_ToggleChatModeAction.ID = ToggleAgentModeActionId;
let ToggleChatModeAction = _ToggleChatModeAction;
const ToggleRequestPausedActionId = "workbench.action.chat.toggleRequestPaused";
const _ToggleRequestPausedAction = class _ToggleRequestPausedAction extends Action2 {
  constructor() {
    super({
      id: _ToggleRequestPausedAction.ID,
      title: localize2("interactive.toggleRequestPausd.label", "Toggle Request Paused"),
      category: CHAT_CATEGORY,
      icon: Codicon.debugPause,
      toggled: {
        condition: ChatContextKeys.isRequestPaused,
        icon: Codicon.play,
        tooltip: localize("requestIsPaused", "Resume Request")
      },
      tooltip: localize("requestNotPaused", "Pause Request"),
      menu: [
        {
          id: MenuId.ChatExecute,
          order: 3.5,
          when: ContextKeyExpr.and(
            ChatContextKeys.canRequestBePaused,
            ChatContextKeys.chatMode.isEqualTo(ChatMode.Agent),
            ChatContextKeyExprs.inEditsOrUnified,
            ContextKeyExpr.or(ChatContextKeys.isRequestPaused.negate(), ChatContextKeys.inputHasText.negate())
          ),
          group: "navigation"
        }
      ]
    });
  }
  run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    widget?.togglePaused();
  }
};
_ToggleRequestPausedAction.ID = ToggleRequestPausedActionId;
let ToggleRequestPausedAction = _ToggleRequestPausedAction;
const ChatSwitchToNextModelActionId = "workbench.action.chat.switchToNextModel";
const _SwitchToNextModelAction = class _SwitchToNextModelAction extends Action2 {
  constructor() {
    super({
      id: _SwitchToNextModelAction.ID,
      title: localize2("interactive.switchToNextModel.label", "Switch to Next Model"),
      category: CHAT_CATEGORY,
      f1: true,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Period,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ChatContextKeys.inChatInput
      },
      precondition: ChatContextKeys.enabled,
      menu: {
        id: MenuId.ChatExecute,
        order: 3,
        group: "navigation",
        when: ContextKeyExpr.and(
          ChatContextKeys.languageModelsAreUserSelectable,
          ContextKeyExpr.or(
            ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel),
            ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.EditingSession),
            ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Editor),
            ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Notebook),
            ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Terminal)
          )
        )
      }
    });
  }
  run(accessor, ...args) {
    const widgetService = accessor.get(IChatWidgetService);
    const widget = widgetService.lastFocusedWidget;
    widget?.input.switchToNextModel();
  }
};
_SwitchToNextModelAction.ID = ChatSwitchToNextModelActionId;
let SwitchToNextModelAction = _SwitchToNextModelAction;
const _ChatEditingSessionSubmitAction = class _ChatEditingSessionSubmitAction extends SubmitAction {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      whenNotInProgressOrPaused,
      ChatContextKeys.chatMode.notEqualsTo(ChatMode.Ask)
    );
    super({
      id: _ChatEditingSessionSubmitAction.ID,
      title: localize2("edits.submit.label", "Send"),
      f1: false,
      category: CHAT_CATEGORY,
      icon: Codicon.send,
      precondition,
      keybinding: {
        when: ChatContextKeys.inChatInput,
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [
        {
          id: MenuId.ChatExecuteSecondary,
          group: "group_1",
          when: ContextKeyExpr.and(whenNotInProgressOrPaused, ChatContextKeys.chatMode.notEqualsTo(ChatMode.Ask)),
          order: 1
        },
        {
          id: MenuId.ChatExecute,
          order: 4,
          when: ContextKeyExpr.and(
            ContextKeyExpr.or(
              ContextKeyExpr.and(ChatContextKeys.isRequestPaused, ChatContextKeys.inputHasText),
              ChatContextKeys.requestInProgress.negate()
            ),
            ChatContextKeys.chatMode.notEqualsTo(ChatMode.Ask)
          ),
          group: "navigation"
        }
      ]
    });
  }
};
_ChatEditingSessionSubmitAction.ID = "workbench.action.edits.submit";
let ChatEditingSessionSubmitAction = _ChatEditingSessionSubmitAction;
const _SubmitWithoutDispatchingAction = class _SubmitWithoutDispatchingAction extends Action2 {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      whenNotInProgressOrPaused,
      ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask)
    );
    super({
      id: _SubmitWithoutDispatchingAction.ID,
      title: localize2("interactive.submitWithoutDispatch.label", "Send"),
      f1: false,
      category: CHAT_CATEGORY,
      precondition,
      keybinding: {
        when: ChatContextKeys.inChatInput,
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      },
      menu: [
        {
          id: MenuId.ChatExecuteSecondary,
          group: "group_1",
          order: 2,
          when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask)
        }
      ]
    });
  }
  run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    widget?.acceptInput(context?.inputValue, { noCommandDetection: true });
  }
};
_SubmitWithoutDispatchingAction.ID = "workbench.action.chat.submitWithoutDispatching";
let SubmitWithoutDispatchingAction = _SubmitWithoutDispatchingAction;
const _ChatSubmitWithCodebaseAction = class _ChatSubmitWithCodebaseAction extends Action2 {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      whenNotInProgressOrPaused
    );
    super({
      id: _ChatSubmitWithCodebaseAction.ID,
      title: localize2("actions.chat.submitWithCodebase", "Send with {0}", `${chatVariableLeader}codebase`),
      precondition,
      menu: {
        id: MenuId.ChatExecuteSecondary,
        group: "group_1",
        order: 3,
        when: ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel)
      },
      keybinding: {
        when: ChatContextKeys.inChatInput,
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    const languageModelToolsService = accessor.get(ILanguageModelToolsService);
    const codebaseTool = languageModelToolsService.getToolByName("codebase");
    if (!codebaseTool) {
      return;
    }
    widget.input.attachmentModel.addContext({
      id: codebaseTool.id,
      name: codebaseTool.displayName ?? "",
      fullName: codebaseTool.displayName ?? "",
      value: void 0,
      icon: ThemeIcon.isThemeIcon(codebaseTool.icon) ? codebaseTool.icon : void 0,
      isTool: true
    });
    widget.acceptInput();
  }
};
_ChatSubmitWithCodebaseAction.ID = "workbench.action.chat.submitWithCodebase";
let ChatSubmitWithCodebaseAction = _ChatSubmitWithCodebaseAction;
class SendToChatEditingAction extends Action2 {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      ChatContextKeys.inputHasAgent.negate(),
      whenNotInProgressOrPaused,
      ChatContextKeyExprs.inNonUnifiedPanel
    );
    super({
      id: "workbench.action.chat.sendToChatEditing",
      title: localize2("chat.sendToChatEditing.label", "Send to Copilot Edits"),
      precondition,
      category: CHAT_CATEGORY,
      f1: false,
      menu: {
        id: MenuId.ChatExecuteSecondary,
        group: "group_1",
        order: 4,
        when: ContextKeyExpr.and(
          ChatContextKeys.enabled,
          ChatContextKeys.editingParticipantRegistered,
          ChatContextKeys.location.notEqualsTo(ChatAgentLocation.EditingSession),
          ChatContextKeys.location.notEqualsTo(ChatAgentLocation.Editor),
          ChatContextKeyExprs.inNonUnifiedPanel
        )
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.Enter,
        when: ContextKeyExpr.and(
          ChatContextKeys.enabled,
          ChatContextKeys.editingParticipantRegistered,
          ChatContextKeys.location.notEqualsTo(ChatAgentLocation.EditingSession),
          ChatContextKeys.location.notEqualsTo(ChatAgentLocation.Editor)
        )
      }
    });
  }
  async run(accessor, ...args) {
    if (!accessor.get(IChatAgentService).getDefaultAgent(ChatAgentLocation.EditingSession)) {
      return;
    }
    const widget = args.length > 0 && args[0].widget ? args[0].widget : accessor.get(IChatWidgetService).lastFocusedWidget;
    const viewsService = accessor.get(IViewsService);
    const dialogService = accessor.get(IDialogService);
    const { widget: editingWidget } = await viewsService.openView(EditsViewId);
    if (!editingWidget.viewModel?.sessionId) {
      return;
    }
    const currentEditingSession = editingWidget.viewModel.model.editingSession;
    if (!currentEditingSession) {
      return;
    }
    const currentEditCount = currentEditingSession?.entries.get().length;
    if (currentEditCount) {
      const result = await dialogService.confirm({
        title: localize("chat.startEditing.confirmation.title", "Start new editing session?"),
        message: currentEditCount === 1 ? localize("chat.startEditing.confirmation.message.one", "Starting a new editing session will end your current editing session containing {0} file. Do you wish to proceed?", currentEditCount) : localize("chat.startEditing.confirmation.message.many", "Starting a new editing session will end your current editing session containing {0} files. Do you wish to proceed?", currentEditCount),
        type: "info",
        primaryButton: localize("chat.startEditing.confirmation.primaryButton", "Yes")
      });
      if (!result.confirmed) {
        return;
      }
      await currentEditingSession.stop(true);
      editingWidget.clear();
    }
    for (const attachment of widget.attachmentModel.attachments) {
      editingWidget.attachmentModel.addContext(attachment);
    }
    editingWidget.setInput(widget.getInput());
    widget.setInput("");
    widget.attachmentModel.clear();
    editingWidget.acceptInput();
    editingWidget.focusInput();
  }
}
class SendToNewChatAction extends Action2 {
  constructor() {
    const precondition = ContextKeyExpr.and(
      // if the input has prompt instructions attached, allow submitting requests even
      // without text present - having instructions is enough context for a request
      ContextKeyExpr.or(ChatContextKeys.inputHasText, ChatContextKeys.instructionsAttached),
      whenNotInProgressOrPaused
    );
    super({
      id: "workbench.action.chat.sendToNewChat",
      title: localize2("chat.newChat.label", "Send to New Chat"),
      precondition,
      category: CHAT_CATEGORY,
      f1: false,
      menu: {
        id: MenuId.ChatExecuteSecondary,
        group: "group_2",
        when: ContextKeyExpr.equals(ChatContextKeys.location.key, ChatAgentLocation.Panel)
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
        when: ChatContextKeys.inChatInput
      }
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const chatService = accessor.get(IChatService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    widget.clear();
    if (widget.viewModel) {
      await waitForChatSessionCleared(widget.viewModel.sessionId, chatService);
    }
    widget.acceptInput(context?.inputValue);
  }
}
const CancelChatActionId = "workbench.action.chat.cancel";
const _CancelAction = class _CancelAction extends Action2 {
  constructor() {
    super({
      id: _CancelAction.ID,
      title: localize2("interactive.cancel.label", "Cancel"),
      f1: false,
      category: CHAT_CATEGORY,
      icon: Codicon.stopCircle,
      menu: {
        id: MenuId.ChatExecute,
        when: ContextKeyExpr.and(ChatContextKeys.isRequestPaused.negate(), ChatContextKeys.requestInProgress),
        order: 4,
        group: "navigation"
      },
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Escape,
        win: { primary: KeyMod.Alt | KeyCode.Backspace }
      }
    });
  }
  run(accessor, ...args) {
    const context = args[0];
    const widgetService = accessor.get(IChatWidgetService);
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    const chatService = accessor.get(IChatService);
    if (widget.viewModel) {
      chatService.cancelCurrentRequestForSession(widget.viewModel.sessionId);
    }
  }
};
_CancelAction.ID = CancelChatActionId;
let CancelAction = _CancelAction;
function registerChatExecuteActions() {
  registerAction2(ChatSubmitAction);
  registerAction2(ChatEditingSessionSubmitAction);
  registerAction2(SubmitWithoutDispatchingAction);
  registerAction2(CancelAction);
  registerAction2(SendToNewChatAction);
  registerAction2(ChatSubmitWithCodebaseAction);
  registerAction2(SendToChatEditingAction);
  registerAction2(ToggleChatModeAction);
  registerAction2(ToggleRequestPausedAction);
  registerAction2(SwitchToNextModelAction);
}
export {
  CancelAction,
  CancelChatActionId,
  ChatEditingSessionSubmitAction,
  ChatSubmitAction,
  ChatSubmitWithCodebaseAction,
  ChatSwitchToNextModelActionId,
  SwitchToNextModelAction,
  ToggleAgentModeActionId,
  ToggleRequestPausedAction,
  ToggleRequestPausedActionId,
  registerChatExecuteActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0RXhlY3V0ZUFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleUV4cHJzLCBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjaGF0VmFyaWFibGVMZWFkZXIgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdENvbmZpZ3VyYXRpb24sIENoYXRNb2RlLCB2YWxpZGF0ZUNoYXRNb2RlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRzVmlld0lkLCBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBnZXRFZGl0aW5nU2Vzc2lvbkNvbnRleHQgfSBmcm9tICcuLi9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdQYW5lIH0gZnJvbSAnLi4vY2hhdFZpZXdQYW5lLmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlksIGhhbmRsZUN1cnJlbnRFZGl0aW5nU2Vzc2lvbiB9IGZyb20gJy4vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQUNUSU9OX0lEX05FV19DSEFULCBDaGF0RG9uZUFjdGlvbklkLCB3YWl0Rm9yQ2hhdFNlc3Npb25DbGVhcmVkIH0gZnJvbSAnLi9jaGF0Q2xlYXJBY3Rpb25zLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJVm9pY2VDaGF0RXhlY3V0ZUFjdGlvbkNvbnRleHQge1xuXHRyZWFkb25seSBkaXNhYmxlVGltZW91dD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCB7XG5cdHdpZGdldD86IElDaGF0V2lkZ2V0O1xuXHRpbnB1dFZhbHVlPzogc3RyaW5nO1xuXHR2b2ljZT86IElWb2ljZUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dDtcbn1cblxuYWJzdHJhY3QgY2xhc3MgU3VibWl0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblxuXHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCB3aWRnZXQgPSBjb250ZXh0Py53aWRnZXQgPz8gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHR3aWRnZXQ/LmFjY2VwdElucHV0KGNvbnRleHQ/LmlucHV0VmFsdWUpO1xuXHR9XG59XG5cbmNvbnN0IHdoZW5Ob3RJblByb2dyZXNzT3JQYXVzZWQgPSBDb250ZXh0S2V5RXhwci5vcihDaGF0Q29udGV4dEtleXMuaXNSZXF1ZXN0UGF1c2VkLCBDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpO1xuXG5leHBvcnQgY2xhc3MgQ2hhdFN1Ym1pdEFjdGlvbiBleHRlbmRzIFN1Ym1pdEFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc3VibWl0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBwcmVjb25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHQvLyBpZiB0aGUgaW5wdXQgaGFzIHByb21wdCBpbnN0cnVjdGlvbnMgYXR0YWNoZWQsIGFsbG93IHN1Ym1pdHRpbmcgcmVxdWVzdHMgZXZlblxuXHRcdFx0Ly8gd2l0aG91dCB0ZXh0IHByZXNlbnQgLSBoYXZpbmcgaW5zdHJ1Y3Rpb25zIGlzIGVub3VnaCBjb250ZXh0IGZvciBhIHJlcXVlc3Rcblx0XHRcdENvbnRleHRLZXlFeHByLm9yKENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc1RleHQsIENoYXRDb250ZXh0S2V5cy5pbnN0cnVjdGlvbnNBdHRhY2hlZCksXG5cdFx0XHR3aGVuTm90SW5Qcm9ncmVzc09yUGF1c2VkLFxuXHRcdFx0Q2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLFxuXHRcdCk7XG5cblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ2hhdFN1Ym1pdEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLnN1Ym1pdC5sYWJlbCcsIFwiU2VuZCBhbmQgRGlzcGF0Y2hcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdGljb246IENvZGljb24uc2VuZCxcblx0XHRcdHByZWNvbmRpdGlvbixcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0LFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEV4ZWN1dGVTZWNvbmRhcnksXG5cdFx0XHRcdFx0Z3JvdXA6ICdncm91cF8xJyxcblx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuY2hhdE1vZGUuaXNFcXVhbFRvKENoYXRNb2RlLkFzaylcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEV4ZWN1dGUsXG5cdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0d2hlbk5vdEluUHJvZ3Jlc3NPclBhdXNlZCxcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5pc0VxdWFsVG8oQ2hhdE1vZGUuQXNrKSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdH0sXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFRvZ2dsZUFnZW50TW9kZUFjdGlvbklkID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC50b2dnbGVBZ2VudE1vZGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElUb2dnbGVDaGF0TW9kZUFyZ3Mge1xuXHRtb2RlOiBDaGF0TW9kZTtcbn1cblxuY2xhc3MgVG9nZ2xlQ2hhdE1vZGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSBUb2dnbGVBZ2VudE1vZGVBY3Rpb25JZDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogVG9nZ2xlQ2hhdE1vZGVBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS50b2dnbGVBZ2VudC5sYWJlbCcsIFwiU2V0IENoYXQgTW9kZVwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5FZGl0aW5nLmhhc1Rvb2xzQWdlbnQsXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlFeHBycy51bmlmaWVkQ2hhdEVuYWJsZWQpLFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3NldENoYXRNb2RlJywgXCJTZXQgTW9kZVwiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCxcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleUV4cHJzLmluRWRpdHNPclVuaWZpZWQpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuUGVyaW9kLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEV4ZWN1dGUsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0Ly8gRWl0aGVyIGluIGVkaXRzIHdpdGggYWdlbnQgbW9kZSBhdmFpbGFibGUsIG9yIGluIHVuaWZpZWQgY2hhdCB2aWV3XG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5pc0VxdWFsVG8oQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pLFxuXHRcdFx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5FZGl0aW5nLmhhc1Rvb2xzQWdlbnQsXG5cdFx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5pblVuaWZpZWRDaGF0KSksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRleHQgPSBnZXRFZGl0aW5nU2Vzc2lvbkNvbnRleHQoYWNjZXNzb3IsIGFyZ3MpO1xuXHRcdGlmICghY29udGV4dD8uY2hhdFdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFyZyA9IGFyZ3MuYXQoMCkgYXMgSVRvZ2dsZUNoYXRNb2RlQXJncyB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjaGF0U2Vzc2lvbiA9IGNvbnRleHQuY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsO1xuXHRcdGNvbnN0IHJlcXVlc3RDb3VudCA9IGNoYXRTZXNzaW9uPy5nZXRSZXF1ZXN0cygpLmxlbmd0aCA/PyAwO1xuXHRcdGNvbnN0IHN3aXRjaFRvTW9kZSA9IHZhbGlkYXRlQ2hhdE1vZGUoYXJnPy5tb2RlKSA/PyB0aGlzLmdldE5leHRNb2RlKGNvbnRleHQuY2hhdFdpZGdldCwgcmVxdWVzdENvdW50LCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgbmVlZFRvQ2xlYXJFZGl0cyA9ICghY2hhdFNlcnZpY2UudW5pZmllZFZpZXdFbmFibGVkIHx8ICghY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQ2hhdENvbmZpZ3VyYXRpb24uRWRpdHMyRW5hYmxlZCkgJiYgKGNvbnRleHQuY2hhdFdpZGdldC5pbnB1dC5jdXJyZW50TW9kZSA9PT0gQ2hhdE1vZGUuRWRpdCB8fCBzd2l0Y2hUb01vZGUgPT09IENoYXRNb2RlLkVkaXQpKSkgJiYgcmVxdWVzdENvdW50ID4gMDtcblxuXHRcdGlmIChzd2l0Y2hUb01vZGUgPT09IGNvbnRleHQuY2hhdFdpZGdldC5pbnB1dC5jdXJyZW50TW9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChuZWVkVG9DbGVhckVkaXRzKSB7XG5cdFx0XHQvLyBJZiBub3QgaW4gdW5pZmllZCB2aWV3LCBvciBub3QgdXNpbmcgZWRpdHMyIGFuZCBzd2l0Y2hpbmcgaW50byBvciBvdXQgb2YgZWRpdCBtb2RlLCBhc2sgdG8gZGlzY2FyZCB0aGUgc2Vzc2lvblxuXHRcdFx0Y29uc3QgcGhyYXNlID0gbG9jYWxpemUoJ3N3aXRjaE1vZGUuY29uZmlybVBocmFzZScsIFwiU3dpdGNoaW5nIGNoYXQgbW9kZXMgd2lsbCBlbmQgeW91ciBjdXJyZW50IGVkaXQgc2Vzc2lvbi5cIik7XG5cdFx0XHRpZiAoIWNvbnRleHQuZWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjdXJyZW50RWRpdHMgPSBjb250ZXh0LmVkaXRpbmdTZXNzaW9uLmVudHJpZXMuZ2V0KCk7XG5cdFx0XHRjb25zdCB1bmRlY2lkZWRFZGl0cyA9IGN1cnJlbnRFZGl0cy5maWx0ZXIoKGVkaXQpID0+IGVkaXQuc3RhdGUuZ2V0KCkgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkKTtcblx0XHRcdGlmICh1bmRlY2lkZWRFZGl0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGlmICghYXdhaXQgaGFuZGxlQ3VycmVudEVkaXRpbmdTZXNzaW9uKGNvbnRleHQuZWRpdGluZ1Nlc3Npb24sIHBocmFzZSwgZGlhbG9nU2VydmljZSkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpcm1hdGlvbiA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdhZ2VudC5uZXdTZXNzaW9uJywgXCJTdGFydCBuZXcgc2Vzc2lvbj9cIiksXG5cdFx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2FnZW50Lm5ld1Nlc3Npb25NZXNzYWdlJywgXCJDaGFuZ2luZyB0aGUgY2hhdCBtb2RlIHdpbGwgZW5kIHlvdXIgY3VycmVudCBlZGl0IHNlc3Npb24uIFdvdWxkIHlvdSBsaWtlIHRvIGNvbnRpbnVlP1wiKSxcblx0XHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgnYWdlbnQubmV3U2Vzc2lvbi5jb25maXJtJywgXCJZZXNcIiksXG5cdFx0XHRcdFx0dHlwZTogJ2luZm8nXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpZiAoIWNvbmZpcm1hdGlvbi5jb25maXJtZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb250ZXh0LmNoYXRXaWRnZXQuaW5wdXQuc2V0Q2hhdE1vZGUoc3dpdGNoVG9Nb2RlKTtcblxuXHRcdGlmIChuZWVkVG9DbGVhckVkaXRzKSB7XG5cdFx0XHRjb25zdCBjbGVhckFjdGlvbiA9IGNoYXRTZXJ2aWNlLnVuaWZpZWRWaWV3RW5hYmxlZCA/IEFDVElPTl9JRF9ORVdfQ0hBVCA6IENoYXREb25lQWN0aW9uSWQ7XG5cdFx0XHRhd2FpdCBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjbGVhckFjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXROZXh0TW9kZShjaGF0V2lkZ2V0OiBJQ2hhdFdpZGdldCwgcmVxdWVzdENvdW50OiBudW1iZXIsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBDaGF0TW9kZSB7XG5cdFx0Y29uc3QgbW9kZXMgPSBbQ2hhdE1vZGUuQWdlbnRdO1xuXHRcdGlmIChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShDaGF0Q29uZmlndXJhdGlvbi5FZGl0czJFbmFibGVkKSB8fCByZXF1ZXN0Q291bnQgPT09IDApIHtcblx0XHRcdG1vZGVzLnB1c2goQ2hhdE1vZGUuRWRpdCk7XG5cdFx0fVxuXHRcdGlmIChjaGF0V2lkZ2V0LmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCkge1xuXHRcdFx0bW9kZXMucHVzaChDaGF0TW9kZS5Bc2spO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVJbmRleCA9IG1vZGVzLmluZGV4T2YoY2hhdFdpZGdldC5pbnB1dC5jdXJyZW50TW9kZSk7XG5cdFx0Y29uc3QgbmV3TW9kZSA9IG1vZGVzWyhtb2RlSW5kZXggKyAxKSAlIG1vZGVzLmxlbmd0aF07XG5cdFx0cmV0dXJuIG5ld01vZGU7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFRvZ2dsZVJlcXVlc3RQYXVzZWRBY3Rpb25JZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudG9nZ2xlUmVxdWVzdFBhdXNlZCc7XG5leHBvcnQgY2xhc3MgVG9nZ2xlUmVxdWVzdFBhdXNlZEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSBUb2dnbGVSZXF1ZXN0UGF1c2VkQWN0aW9uSWQ7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRvZ2dsZVJlcXVlc3RQYXVzZWRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS50b2dnbGVSZXF1ZXN0UGF1c2QubGFiZWwnLCBcIlRvZ2dsZSBSZXF1ZXN0IFBhdXNlZFwiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5kZWJ1Z1BhdXNlLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5pc1JlcXVlc3RQYXVzZWQsXG5cdFx0XHRcdGljb246IENvZGljb24ucGxheSxcblx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JlcXVlc3RJc1BhdXNlZCcsIFwiUmVzdW1lIFJlcXVlc3RcIiksXG5cdFx0XHR9LFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JlcXVlc3ROb3RQYXVzZWQnLCBcIlBhdXNlIFJlcXVlc3RcIiksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlLFxuXHRcdFx0XHRcdG9yZGVyOiAzLjUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmNhblJlcXVlc3RCZVBhdXNlZCxcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5pc0VxdWFsVG8oQ2hhdE1vZGUuQWdlbnQpLFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlFeHBycy5pbkVkaXRzT3JVbmlmaWVkLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoQ2hhdENvbnRleHRLZXlzLmlzUmVxdWVzdFBhdXNlZC5uZWdhdGUoKSwgQ2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR9LFxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRleHQ6IElDaGF0RXhlY3V0ZUFjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQgPSBhcmdzWzBdO1xuXHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCB3aWRnZXQgPSBjb250ZXh0Py53aWRnZXQgPz8gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHR3aWRnZXQ/LnRvZ2dsZVBhdXNlZCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBDaGF0U3dpdGNoVG9OZXh0TW9kZWxBY3Rpb25JZCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc3dpdGNoVG9OZXh0TW9kZWwnO1xuZXhwb3J0IGNsYXNzIFN3aXRjaFRvTmV4dE1vZGVsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9IENoYXRTd2l0Y2hUb05leHRNb2RlbEFjdGlvbklkO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTd2l0Y2hUb05leHRNb2RlbEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLnN3aXRjaFRvTmV4dE1vZGVsLmxhYmVsJywgXCJTd2l0Y2ggdG8gTmV4dCBNb2RlbFwiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuUGVyaW9kLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0XG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RXhlY3V0ZSxcblx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMubGFuZ3VhZ2VNb2RlbHNBcmVVc2VyU2VsZWN0YWJsZSxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscyhDaGF0Q29udGV4dEtleXMubG9jYXRpb24ua2V5LCBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoQ2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmtleSwgQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5rZXksIENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciksXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoQ2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmtleSwgQ2hhdEFnZW50TG9jYXRpb24uTm90ZWJvb2spLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5rZXksIENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsKVxuXHRcdFx0XHRcdClcblx0XHRcdFx0KSxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRjb25zdCB3aWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHR3aWRnZXQ/LmlucHV0LnN3aXRjaFRvTmV4dE1vZGVsKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nU2Vzc2lvblN1Ym1pdEFjdGlvbiBleHRlbmRzIFN1Ym1pdEFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRzLnN1Ym1pdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgcHJlY29uZGl0aW9uID0gQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0Ly8gaWYgdGhlIGlucHV0IGhhcyBwcm9tcHQgaW5zdHJ1Y3Rpb25zIGF0dGFjaGVkLCBhbGxvdyBzdWJtaXR0aW5nIHJlcXVlc3RzIGV2ZW5cblx0XHRcdC8vIHdpdGhvdXQgdGV4dCBwcmVzZW50IC0gaGF2aW5nIGluc3RydWN0aW9ucyBpcyBlbm91Z2ggY29udGV4dCBmb3IgYSByZXF1ZXN0XG5cdFx0XHRDb250ZXh0S2V5RXhwci5vcihDaGF0Q29udGV4dEtleXMuaW5wdXRIYXNUZXh0LCBDaGF0Q29udGV4dEtleXMuaW5zdHJ1Y3Rpb25zQXR0YWNoZWQpLFxuXHRcdFx0d2hlbk5vdEluUHJvZ3Jlc3NPclBhdXNlZCxcblx0XHRcdENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5ub3RFcXVhbHNUbyhDaGF0TW9kZS5Bc2spLFxuXHRcdCk7XG5cblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ2hhdEVkaXRpbmdTZXNzaW9uU3VibWl0QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZWRpdHMuc3VibWl0LmxhYmVsJywgXCJTZW5kXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRpY29uOiBDb2RpY29uLnNlbmQsXG5cdFx0XHRwcmVjb25kaXRpb24sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LFxuXHRcdFx0XHRcdGdyb3VwOiAnZ3JvdXBfMScsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKHdoZW5Ob3RJblByb2dyZXNzT3JQYXVzZWQsIENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5ub3RFcXVhbHNUbyhDaGF0TW9kZS5Bc2spLCksXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEV4ZWN1dGUsXG5cdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaXNSZXF1ZXN0UGF1c2VkLCBDaGF0Q29udGV4dEtleXMuaW5wdXRIYXNUZXh0KSxcblx0XHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpLFxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5jaGF0TW9kZS5ub3RFcXVhbHNUbyhDaGF0TW9kZS5Bc2spLCksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0fSxcblx0XHRcdF1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBTdWJtaXRXaXRob3V0RGlzcGF0Y2hpbmdBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdWJtaXRXaXRob3V0RGlzcGF0Y2hpbmcnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IHByZWNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdC8vIGlmIHRoZSBpbnB1dCBoYXMgcHJvbXB0IGluc3RydWN0aW9ucyBhdHRhY2hlZCwgYWxsb3cgc3VibWl0dGluZyByZXF1ZXN0cyBldmVuXG5cdFx0XHQvLyB3aXRob3V0IHRleHQgcHJlc2VudCAtIGhhdmluZyBpbnN0cnVjdGlvbnMgaXMgZW5vdWdoIGNvbnRleHQgZm9yIGEgcmVxdWVzdFxuXHRcdFx0Q29udGV4dEtleUV4cHIub3IoQ2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dCwgQ2hhdENvbnRleHRLZXlzLmluc3RydWN0aW9uc0F0dGFjaGVkKSxcblx0XHRcdHdoZW5Ob3RJblByb2dyZXNzT3JQYXVzZWQsXG5cdFx0XHRDaGF0Q29udGV4dEtleXMuY2hhdE1vZGUuaXNFcXVhbFRvKENoYXRNb2RlLkFzayksXG5cdFx0KTtcblxuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTdWJtaXRXaXRob3V0RGlzcGF0Y2hpbmdBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZS5zdWJtaXRXaXRob3V0RGlzcGF0Y2gubGFiZWwnLCBcIlNlbmRcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbixcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0LFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LFxuXHRcdFx0XHRcdGdyb3VwOiAnZ3JvdXBfMScsXG5cdFx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgY29udGV4dDogSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCA9IGFyZ3NbMF07XG5cblx0XHRjb25zdCB3aWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gY29udGV4dD8ud2lkZ2V0ID8/IHdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0d2lkZ2V0Py5hY2NlcHRJbnB1dChjb250ZXh0Py5pbnB1dFZhbHVlLCB7IG5vQ29tbWFuZERldGVjdGlvbjogdHJ1ZSB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFN1Ym1pdFdpdGhDb2RlYmFzZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnN1Ym1pdFdpdGhDb2RlYmFzZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3QgcHJlY29uZGl0aW9uID0gQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0Ly8gaWYgdGhlIGlucHV0IGhhcyBwcm9tcHQgaW5zdHJ1Y3Rpb25zIGF0dGFjaGVkLCBhbGxvdyBzdWJtaXR0aW5nIHJlcXVlc3RzIGV2ZW5cblx0XHRcdC8vIHdpdGhvdXQgdGV4dCBwcmVzZW50IC0gaGF2aW5nIGluc3RydWN0aW9ucyBpcyBlbm91Z2ggY29udGV4dCBmb3IgYSByZXF1ZXN0XG5cdFx0XHRDb250ZXh0S2V5RXhwci5vcihDaGF0Q29udGV4dEtleXMuaW5wdXRIYXNUZXh0LCBDaGF0Q29udGV4dEtleXMuaW5zdHJ1Y3Rpb25zQXR0YWNoZWQpLFxuXHRcdFx0d2hlbk5vdEluUHJvZ3Jlc3NPclBhdXNlZCxcblx0XHQpO1xuXG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENoYXRTdWJtaXRXaXRoQ29kZWJhc2VBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdhY3Rpb25zLmNoYXQuc3VibWl0V2l0aENvZGViYXNlJywgXCJTZW5kIHdpdGggezB9XCIsIGAke2NoYXRWYXJpYWJsZUxlYWRlcn1jb2RlYmFzZWApLFxuXHRcdFx0cHJlY29uZGl0aW9uLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LFxuXHRcdFx0XHRncm91cDogJ2dyb3VwXzEnLFxuXHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5rZXksIENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKSxcblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblxuXHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCB3aWRnZXQgPSBjb250ZXh0Py53aWRnZXQgPz8gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvZGViYXNlVG9vbCA9IGxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuZ2V0VG9vbEJ5TmFtZSgnY29kZWJhc2UnKTtcblx0XHRpZiAoIWNvZGViYXNlVG9vbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHdpZGdldC5pbnB1dC5hdHRhY2htZW50TW9kZWwuYWRkQ29udGV4dCh7XG5cdFx0XHRpZDogY29kZWJhc2VUb29sLmlkLFxuXHRcdFx0bmFtZTogY29kZWJhc2VUb29sLmRpc3BsYXlOYW1lID8/ICcnLFxuXHRcdFx0ZnVsbE5hbWU6IGNvZGViYXNlVG9vbC5kaXNwbGF5TmFtZSA/PyAnJyxcblx0XHRcdHZhbHVlOiB1bmRlZmluZWQsXG5cdFx0XHRpY29uOiBUaGVtZUljb24uaXNUaGVtZUljb24oY29kZWJhc2VUb29sLmljb24pID8gY29kZWJhc2VUb29sLmljb24gOiB1bmRlZmluZWQsXG5cdFx0XHRpc1Rvb2w6IHRydWVcblx0XHR9KTtcblx0XHR3aWRnZXQuYWNjZXB0SW5wdXQoKTtcblx0fVxufVxuXG5jbGFzcyBTZW5kVG9DaGF0RWRpdGluZ0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBwcmVjb25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHQvLyBpZiB0aGUgaW5wdXQgaGFzIHByb21wdCBpbnN0cnVjdGlvbnMgYXR0YWNoZWQsIGFsbG93IHN1Ym1pdHRpbmcgcmVxdWVzdHMgZXZlblxuXHRcdFx0Ly8gd2l0aG91dCB0ZXh0IHByZXNlbnQgLSBoYXZpbmcgaW5zdHJ1Y3Rpb25zIGlzIGVub3VnaCBjb250ZXh0IGZvciBhIHJlcXVlc3Rcblx0XHRcdENvbnRleHRLZXlFeHByLm9yKENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc1RleHQsIENoYXRDb250ZXh0S2V5cy5pbnN0cnVjdGlvbnNBdHRhY2hlZCksXG5cdFx0XHRDaGF0Q29udGV4dEtleXMuaW5wdXRIYXNBZ2VudC5uZWdhdGUoKSxcblx0XHRcdHdoZW5Ob3RJblByb2dyZXNzT3JQYXVzZWQsXG5cdFx0XHRDaGF0Q29udGV4dEtleUV4cHJzLmluTm9uVW5pZmllZFBhbmVsXG5cdFx0KTtcblxuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnNlbmRUb0NoYXRFZGl0aW5nJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQuc2VuZFRvQ2hhdEVkaXRpbmcubGFiZWwnLCBcIlNlbmQgdG8gQ29waWxvdCBFZGl0c1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbixcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LFxuXHRcdFx0XHRncm91cDogJ2dyb3VwXzEnLFxuXHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lZGl0aW5nUGFydGljaXBhbnRSZWdpc3RlcmVkLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5ub3RFcXVhbHNUbyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiksXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLm5vdEVxdWFsc1RvKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvciksXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlFeHBycy5pbk5vblVuaWZpZWRQYW5lbFxuXHRcdFx0XHQpXG5cdFx0XHR9LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lZGl0aW5nUGFydGljaXBhbnRSZWdpc3RlcmVkLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5ub3RFcXVhbHNUbyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiksXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLm5vdEVxdWFsc1RvKENoYXRBZ2VudExvY2F0aW9uLkVkaXRvcilcblx0XHRcdFx0KVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGlmICghYWNjZXNzb3IuZ2V0KElDaGF0QWdlbnRTZXJ2aWNlKS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2lkZ2V0ID0gYXJncy5sZW5ndGggPiAwICYmIGFyZ3NbMF0ud2lkZ2V0ID8gYXJnc1swXS53aWRnZXQgOiBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKS5sYXN0Rm9jdXNlZFdpZGdldDtcblxuXHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCB7IHdpZGdldDogZWRpdGluZ1dpZGdldCB9ID0gYXdhaXQgdmlld3NTZXJ2aWNlLm9wZW5WaWV3KEVkaXRzVmlld0lkKSBhcyBDaGF0Vmlld1BhbmU7XG5cdFx0aWYgKCFlZGl0aW5nV2lkZ2V0LnZpZXdNb2RlbD8uc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbiA9IGVkaXRpbmdXaWRnZXQudmlld01vZGVsLm1vZGVsLmVkaXRpbmdTZXNzaW9uO1xuXHRcdGlmICghY3VycmVudEVkaXRpbmdTZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudEVkaXRDb3VudCA9IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbj8uZW50cmllcy5nZXQoKS5sZW5ndGg7XG5cdFx0aWYgKGN1cnJlbnRFZGl0Q291bnQpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2hhdC5zdGFydEVkaXRpbmcuY29uZmlybWF0aW9uLnRpdGxlJywgXCJTdGFydCBuZXcgZWRpdGluZyBzZXNzaW9uP1wiKSxcblx0XHRcdFx0bWVzc2FnZTogY3VycmVudEVkaXRDb3VudCA9PT0gMVxuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2NoYXQuc3RhcnRFZGl0aW5nLmNvbmZpcm1hdGlvbi5tZXNzYWdlLm9uZScsIFwiU3RhcnRpbmcgYSBuZXcgZWRpdGluZyBzZXNzaW9uIHdpbGwgZW5kIHlvdXIgY3VycmVudCBlZGl0aW5nIHNlc3Npb24gY29udGFpbmluZyB7MH0gZmlsZS4gRG8geW91IHdpc2ggdG8gcHJvY2VlZD9cIiwgY3VycmVudEVkaXRDb3VudClcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5jb25maXJtYXRpb24ubWVzc2FnZS5tYW55JywgXCJTdGFydGluZyBhIG5ldyBlZGl0aW5nIHNlc3Npb24gd2lsbCBlbmQgeW91ciBjdXJyZW50IGVkaXRpbmcgc2Vzc2lvbiBjb250YWluaW5nIHswfSBmaWxlcy4gRG8geW91IHdpc2ggdG8gcHJvY2VlZD9cIiwgY3VycmVudEVkaXRDb3VudCksXG5cdFx0XHRcdHR5cGU6ICdpbmZvJyxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ2NoYXQuc3RhcnRFZGl0aW5nLmNvbmZpcm1hdGlvbi5wcmltYXJ5QnV0dG9uJywgXCJZZXNcIilcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoIXJlc3VsdC5jb25maXJtZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCBjdXJyZW50RWRpdGluZ1Nlc3Npb24uc3RvcCh0cnVlKTtcblx0XHRcdGVkaXRpbmdXaWRnZXQuY2xlYXIoKTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGF0dGFjaG1lbnQgb2Ygd2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hdHRhY2htZW50cykge1xuXHRcdFx0ZWRpdGluZ1dpZGdldC5hdHRhY2htZW50TW9kZWwuYWRkQ29udGV4dChhdHRhY2htZW50KTtcblx0XHR9XG5cblx0XHRlZGl0aW5nV2lkZ2V0LnNldElucHV0KHdpZGdldC5nZXRJbnB1dCgpKTtcblx0XHR3aWRnZXQuc2V0SW5wdXQoJycpO1xuXHRcdHdpZGdldC5hdHRhY2htZW50TW9kZWwuY2xlYXIoKTtcblx0XHRlZGl0aW5nV2lkZ2V0LmFjY2VwdElucHV0KCk7XG5cdFx0ZWRpdGluZ1dpZGdldC5mb2N1c0lucHV0KCk7XG5cdH1cbn1cblxuY2xhc3MgU2VuZFRvTmV3Q2hhdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCBwcmVjb25kaXRpb24gPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHQvLyBpZiB0aGUgaW5wdXQgaGFzIHByb21wdCBpbnN0cnVjdGlvbnMgYXR0YWNoZWQsIGFsbG93IHN1Ym1pdHRpbmcgcmVxdWVzdHMgZXZlblxuXHRcdFx0Ly8gd2l0aG91dCB0ZXh0IHByZXNlbnQgLSBoYXZpbmcgaW5zdHJ1Y3Rpb25zIGlzIGVub3VnaCBjb250ZXh0IGZvciBhIHJlcXVlc3Rcblx0XHRcdENvbnRleHRLZXlFeHByLm9yKENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc1RleHQsIENoYXRDb250ZXh0S2V5cy5pbnN0cnVjdGlvbnNBdHRhY2hlZCksXG5cdFx0XHR3aGVuTm90SW5Qcm9ncmVzc09yUGF1c2VkLFxuXHRcdCk7XG5cblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zZW5kVG9OZXdDaGF0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQubmV3Q2hhdC5sYWJlbCcsIFwiU2VuZCB0byBOZXcgQ2hhdFwiKSxcblx0XHRcdHByZWNvbmRpdGlvbixcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFeGVjdXRlU2Vjb25kYXJ5LFxuXHRcdFx0XHRncm91cDogJ2dyb3VwXzInLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoQ2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmtleSwgQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpXG5cblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblxuXHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdGNvbnN0IHdpZGdldCA9IGNvbnRleHQ/LndpZGdldCA/PyB3aWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0d2lkZ2V0LmNsZWFyKCk7XG5cdFx0aWYgKHdpZGdldC52aWV3TW9kZWwpIHtcblx0XHRcdGF3YWl0IHdhaXRGb3JDaGF0U2Vzc2lvbkNsZWFyZWQod2lkZ2V0LnZpZXdNb2RlbC5zZXNzaW9uSWQsIGNoYXRTZXJ2aWNlKTtcblx0XHR9XG5cdFx0d2lkZ2V0LmFjY2VwdElucHV0KGNvbnRleHQ/LmlucHV0VmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBDYW5jZWxDaGF0QWN0aW9uSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmNhbmNlbCc7XG5leHBvcnQgY2xhc3MgQ2FuY2VsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9IENhbmNlbENoYXRBY3Rpb25JZDtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENhbmNlbEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2ludGVyYWN0aXZlLmNhbmNlbC5sYWJlbCcsIFwiQ2FuY2VsXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRpY29uOiBDb2RpY29uLnN0b3BDaXJjbGUsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEV4ZWN1dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaXNSZXF1ZXN0UGF1c2VkLm5lZ2F0ZSgpLCBDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MpLFxuXHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdH0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHR3aW46IHsgcHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuQmFja3NwYWNlIH0sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgY29udGV4dDogSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCA9IGFyZ3NbMF07XG5cblx0XHRjb25zdCB3aWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gY29udGV4dD8ud2lkZ2V0ID8/IHdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdGlmICh3aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRjaGF0U2VydmljZS5jYW5jZWxDdXJyZW50UmVxdWVzdEZvclNlc3Npb24od2lkZ2V0LnZpZXdNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJDaGF0RXhlY3V0ZUFjdGlvbnMoKSB7XG5cdHJlZ2lzdGVyQWN0aW9uMihDaGF0U3VibWl0QWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKENoYXRFZGl0aW5nU2Vzc2lvblN1Ym1pdEFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihTdWJtaXRXaXRob3V0RGlzcGF0Y2hpbmdBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQ2FuY2VsQWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKFNlbmRUb05ld0NoYXRBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQ2hhdFN1Ym1pdFdpdGhDb2RlYmFzZUFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihTZW5kVG9DaGF0RWRpdGluZ0FjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihUb2dnbGVDaGF0TW9kZUFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihUb2dnbGVSZXF1ZXN0UGF1c2VkQWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKFN3aXRjaFRvTmV4dE1vZGVsQWN0aW9uKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLGlCQUFpQjtBQUUxQixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUNqRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQix1QkFBdUI7QUFDckQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIsbUJBQW1CLFVBQVUsd0JBQXdCO0FBQ2pGLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsYUFBMEIsMEJBQTBCO0FBQzdELFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsZUFBZSxtQ0FBbUM7QUFDM0QsU0FBUyxvQkFBb0Isa0JBQWtCLGlDQUFpQztBQVloRixNQUFlLHFCQUFxQixRQUFRO0FBQUEsRUFDM0MsSUFBSSxhQUErQixNQUFhO0FBQy9DLFVBQU0sVUFBaUQsS0FBSyxDQUFDO0FBRTdELFVBQU0sZ0JBQWdCLFNBQVMsSUFBSSxrQkFBa0I7QUFDckQsVUFBTSxTQUFTLFNBQVMsVUFBVSxjQUFjO0FBQ2hELFlBQVEsWUFBWSxTQUFTLFVBQVU7QUFBQSxFQUN4QztBQUNEO0FBRUEsTUFB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
