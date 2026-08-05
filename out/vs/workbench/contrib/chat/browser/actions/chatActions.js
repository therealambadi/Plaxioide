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
import { toAction } from "../../../../../base/common/actions.js";
import { coalesce } from "../../../../../base/common/arrays.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { fromNowByDay, safeIntl } from "../../../../../base/common/date.js";
import { Event } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, markAsSingleton } from "../../../../../base/common/lifecycle.js";
import { language } from "../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { EditorAction2 } from "../../../../../editor/browser/editorExtensions.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { SuggestController } from "../../../../../editor/contrib/suggest/browser/suggestController.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IActionViewItemService } from "../../../../../platform/actions/browser/actionViewItemService.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { Action2, MenuId, MenuItemAction, registerAction2, SubmenuItemAction } from "../../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IsLinuxContext, IsWindowsContext } from "../../../../../platform/contextkey/common/contextkeys.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import product from "../../../../../platform/product/common/product.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { ToggleTitleBarConfigAction } from "../../../../browser/parts/titlebar/titlebarActions.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService } from "../../../../services/editor/common/editorService.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../../services/layout/browser/layoutService.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { EXTENSIONS_CATEGORY, IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { WorkingSetEntryState } from "../../common/chatEditingService.js";
import { ChatEntitlement, ChatSentiment, IChatEntitlementService } from "../../common/chatEntitlementService.js";
import { extractAgentAndCommand } from "../../common/chatParserTypes.js";
import { IChatService } from "../../common/chatService.js";
import { isRequestVM } from "../../common/chatViewModel.js";
import { IChatWidgetHistoryService } from "../../common/chatWidgetHistoryService.js";
import { ChatMode, validateChatMode } from "../../common/constants.js";
import { CopilotUsageExtensionFeatureId } from "../../common/languageModelStats.js";
import { ILanguageModelToolsService } from "../../common/languageModelToolsService.js";
import { ChatViewId, EditsViewId, IChatWidgetService, showChatView, showCopilotView } from "../chat.js";
import { ChatEditorInput } from "../chatEditorInput.js";
import { convertBufferToScreenshotVariable } from "../contrib/screenshot.js";
import { clearChatEditor } from "./chatClear.js";
const CHAT_CATEGORY = localize2("chat.category", "Chat");
const CHAT_OPEN_ACTION_ID = "workbench.action.chat.open";
const CHAT_SETUP_ACTION_ID = "workbench.action.chat.triggerSetup";
const TOGGLE_CHAT_ACTION_ID = "workbench.action.chat.toggle";
const OPEN_CHAT_QUOTA_EXCEEDED_DIALOG = "workbench.action.chat.openQuotaExceededDialog";
function registerChatActions() {
  registerAction2(class OpenChatGlobalAction extends Action2 {
    constructor() {
      super({
        id: CHAT_OPEN_ACTION_ID,
        title: localize2("openChat", "Open Chat"),
        icon: Codicon.copilot,
        f1: true,
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.Setup.hidden.toNegated(),
        keybinding: {
          weight: KeybindingWeight.WorkbenchContrib,
          primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
          mac: {
            primary: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.KeyI
          }
        },
        menu: {
          id: MenuId.ChatTitleBarMenu,
          group: "a_open",
          order: 1
        }
      });
    }
    async run(accessor, opts) {
      opts = typeof opts === "string" ? { query: opts } : opts;
      const chatService = accessor.get(IChatService);
      const toolsService = accessor.get(ILanguageModelToolsService);
      const viewsService = accessor.get(IViewsService);
      const hostService = accessor.get(IHostService);
      const chatWidget = await showChatView(viewsService);
      if (!chatWidget) {
        return;
      }
      if (opts?.mode && validateChatMode(opts.mode)) {
        chatWidget.input.setChatMode(opts.mode);
      }
      if (opts?.previousRequests?.length && chatWidget.viewModel) {
        for (const { request, response } of opts.previousRequests) {
          chatService.addCompleteRequest(chatWidget.viewModel.sessionId, request, void 0, 0, { message: response });
        }
      }
      if (opts?.attachScreenshot) {
        const screenshot = await hostService.getScreenshot();
        if (screenshot) {
          chatWidget.attachmentModel.addContext(convertBufferToScreenshotVariable(screenshot));
        }
      }
      if (opts?.query) {
        if (opts.isPartialQuery) {
          chatWidget.setInput(opts.query);
        } else {
          chatWidget.acceptInput(opts.query);
        }
      }
      if (opts?.toolIds && opts.toolIds.length > 0) {
        for (const toolId of opts.toolIds) {
          const tool = toolsService.getTool(toolId);
          if (tool) {
            chatWidget.attachmentModel.addContext({
              id: tool.id,
              name: tool.displayName,
              fullName: tool.displayName,
              value: void 0,
              icon: ThemeIcon.isThemeIcon(tool.icon) ? tool.icon : void 0,
              isTool: true
            });
          }
        }
      }
      chatWidget.focusInput();
    }
  });
  registerAction2(class ToggleChatAction extends Action2 {
    constructor() {
      super({
        id: TOGGLE_CHAT_ACTION_ID,
        title: localize2("toggleChat", "Toggle Chat"),
        category: CHAT_CATEGORY
      });
    }
    async run(accessor) {
      const layoutService = accessor.get(IWorkbenchLayoutService);
      const viewsService = accessor.get(IViewsService);
      const viewDescriptorService = accessor.get(IViewDescriptorService);
      const chatLocation = viewDescriptorService.getViewLocationById(ChatViewId);
      const editsLocation = viewDescriptorService.getViewLocationById(EditsViewId);
      if (viewsService.isViewVisible(ChatViewId) || chatLocation === editsLocation && viewsService.isViewVisible(EditsViewId)) {
        this.updatePartVisibility(layoutService, chatLocation, false);
      } else {
        this.updatePartVisibility(layoutService, chatLocation, true);
        (await showCopilotView(viewsService, layoutService))?.focusInput();
      }
    }
    updatePartVisibility(layoutService, location, visible) {
      let part;
      switch (location) {
        case ViewContainerLocation.Panel:
          part = Parts.PANEL_PART;
          break;
        case ViewContainerLocation.Sidebar:
          part = Parts.SIDEBAR_PART;
          break;
        case ViewContainerLocation.AuxiliaryBar:
          part = Parts.AUXILIARYBAR_PART;
          break;
      }
      if (part) {
        layoutService.setPartHidden(!visible, part);
      }
    }
  });
  registerAction2(class ChatHistoryAction extends Action2 {
    constructor() {
      super({
        id: `workbench.action.chat.history`,
        title: localize2("chat.history.label", "Show Chats..."),
        menu: {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.equals("view", ChatViewId),
          group: "navigation",
          order: 2
        },
        category: CHAT_CATEGORY,
        icon: Codicon.history,
        f1: true,
        precondition: ChatContextKeys.enabled
      });
    }
    async run(accessor) {
      const chatService = accessor.get(IChatService);
      const quickInputService = accessor.get(IQuickInputService);
      const viewsService = accessor.get(IViewsService);
      const editorService = accessor.get(IEditorService);
      const dialogService = accessor.get(IDialogService);
      const view = await viewsService.openView(ChatViewId);
      if (!view) {
        return;
      }
      const chatSessionId = view.widget.viewModel?.model.sessionId;
      if (!chatSessionId) {
        return;
      }
      const editingSession = view.widget.viewModel?.model.editingSession;
      if (editingSession) {
        const phrase = localize("switchChat.confirmPhrase", "Switching chats will end your current edit session.");
        if (!await handleCurrentEditingSession(editingSession, phrase, dialogService)) {
          return;
        }
      }
      const showPicker = async () => {
        const openInEditorButton = {
          iconClass: ThemeIcon.asClassName(Codicon.file),
          tooltip: localize("interactiveSession.history.editor", "Open in Editor")
        };
        const deleteButton = {
          iconClass: ThemeIcon.asClassName(Codicon.x),
          tooltip: localize("interactiveSession.history.delete", "Delete")
        };
        const renameButton = {
          iconClass: ThemeIcon.asClassName(Codicon.pencil),
          tooltip: localize("chat.history.rename", "Rename")
        };
        const getPicks = async () => {
          const items = await chatService.getHistory();
          items.sort((a, b) => (b.lastMessageDate ?? 0) - (a.lastMessageDate ?? 0));
          let lastDate = void 0;
          const picks2 = items.flatMap((i) => {
            const timeAgoStr = fromNowByDay(i.lastMessageDate, true, true);
            const separator = timeAgoStr !== lastDate ? {
              type: "separator",
              label: timeAgoStr
            } : void 0;
            lastDate = timeAgoStr;
            return [
              separator,
              {
                label: i.title,
                description: i.isActive ? `(${localize("currentChatLabel", "current")})` : "",
                chat: i,
                buttons: i.isActive ? [renameButton] : [
                  renameButton,
                  openInEditorButton,
                  deleteButton
                ]
              }
            ];
          });
          return coalesce(picks2);
        };
        const store = new DisposableStore();
        const picker = store.add(quickInputService.createQuickPick({ useSeparators: true }));
        picker.placeholder = localize("interactiveSession.history.pick", "Switch to chat");
        const picks = await getPicks();
        picker.items = picks;
        store.add(picker.onDidTriggerItemButton(async (context) => {
          if (context.button === openInEditorButton) {
            const options = { target: { sessionId: context.item.chat.sessionId }, pinned: true };
            editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options }, ACTIVE_GROUP);
            picker.hide();
          } else if (context.button === deleteButton) {
            chatService.removeHistoryEntry(context.item.chat.sessionId);
            picker.items = await getPicks();
          } else if (context.button === renameButton) {
            const title = await quickInputService.input({ title: localize("newChatTitle", "New chat title"), value: context.item.chat.title });
            if (title) {
              chatService.setChatSessionTitle(context.item.chat.sessionId, title);
            }
            await showPicker();
          }
        }));
        store.add(picker.onDidAccept(async () => {
          try {
            const item = picker.selectedItems[0];
            const sessionId = item.chat.sessionId;
            await view.loadSession(sessionId);
          } finally {
            picker.hide();
          }
        }));
        store.add(picker.onDidHide(() => store.dispose()));
        picker.show();
      };
      await showPicker();
    }
  });
  registerAction2(class OpenChatEditorAction extends Action2 {
    constructor() {
      super({
        id: `workbench.action.openChat`,
        title: localize2("interactiveSession.open", "Open Editor"),
        f1: true,
        category: CHAT_CATEGORY,
        precondition: ChatContextKeys.enabled
      });
    }
    async run(accessor) {
      const editorService = accessor.get(IEditorService);
      await editorService.openEditor({ resource: ChatEditorInput.getNewEditorUri(), options: { pinned: true } });
    }
  });
  registerAction2(class ChatAddAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.addParticipant",
        title: localize2("chatWith", "Chat with Extension"),
        icon: Codicon.mention,
        f1: false,
        category: CHAT_CATEGORY,
        menu: {
          id: MenuId.ChatInput,
          when: ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask),
          group: "navigation",
          order: 1
        }
      });
    }
    async run(accessor, ...args) {
      const widgetService = accessor.get(IChatWidgetService);
      const context = args[0];
      const widget = context?.widget ?? widgetService.lastFocusedWidget;
      if (!widget) {
        return;
      }
      const hasAgentOrCommand = extractAgentAndCommand(widget.parsedInput);
      if (hasAgentOrCommand?.agentPart || hasAgentOrCommand?.commandPart) {
        return;
      }
      const suggestCtrl = SuggestController.get(widget.inputEditor);
      if (suggestCtrl) {
        const curText = widget.inputEditor.getValue();
        const newValue = curText ? `@ ${curText}` : "@";
        if (!curText.startsWith("@")) {
          widget.inputEditor.setValue(newValue);
        }
        widget.inputEditor.setPosition(new Position(1, 2));
        suggestCtrl.triggerSuggest(void 0, true);
      }
    }
  });
  registerAction2(class ClearChatInputHistoryAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.clearInputHistory",
        title: localize2("interactiveSession.clearHistory.label", "Clear Input History"),
        precondition: ChatContextKeys.enabled,
        category: CHAT_CATEGORY,
        f1: true
      });
    }
    async run(accessor, ...args) {
      const historyService = accessor.get(IChatWidgetHistoryService);
      historyService.clearHistory();
    }
  });
  registerAction2(class ClearChatHistoryAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.clearHistory",
        title: localize2("chat.clear.label", "Clear All Workspace Chats"),
        precondition: ChatContextKeys.enabled,
        category: CHAT_CATEGORY,
        f1: true
      });
    }
    async run(accessor, ...args) {
      const editorGroupsService = accessor.get(IEditorGroupsService);
      const chatService = accessor.get(IChatService);
      const instantiationService = accessor.get(IInstantiationService);
      const widgetService = accessor.get(IChatWidgetService);
      await chatService.clearAllHistoryEntries();
      widgetService.getAllWidgets().forEach((widget) => {
        widget.clear();
      });
      editorGroupsService.groups.forEach((group) => {
        group.editors.forEach((editor) => {
          if (editor instanceof ChatEditorInput) {
            instantiationService.invokeFunction(clearChatEditor, editor);
          }
        });
      });
    }
  });
  registerAction2(class FocusChatAction extends EditorAction2 {
    constructor() {
      super({
        id: "chat.action.focus",
        title: localize2("actions.interactiveSession.focus", "Focus Chat List"),
        precondition: ContextKeyExpr.and(ChatContextKeys.inChatInput),
        category: CHAT_CATEGORY,
        keybinding: [
          // On mac, require that the cursor is at the top of the input, to avoid stealing cmd+up to move the cursor to the top
          {
            when: ContextKeyExpr.and(ChatContextKeys.inputCursorAtTop, ChatContextKeys.inQuickChat.negate()),
            primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
            weight: KeybindingWeight.EditorContrib
          },
          // On win/linux, ctrl+up can always focus the chat list
          {
            when: ContextKeyExpr.and(ContextKeyExpr.or(IsWindowsContext, IsLinuxContext), ChatContextKeys.inQuickChat.negate()),
            primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
            weight: KeybindingWeight.EditorContrib
          },
          {
            when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inQuickChat),
            primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
            weight: KeybindingWeight.WorkbenchContrib
          }
        ]
      });
    }
    runEditorCommand(accessor, editor) {
      const editorUri = editor.getModel()?.uri;
      if (editorUri) {
        const widgetService = accessor.get(IChatWidgetService);
        widgetService.getWidgetByInputUri(editorUri)?.focusLastMessage();
      }
    }
  });
  registerAction2(class FocusChatInputAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.focusInput",
        title: localize2("interactiveSession.focusInput.label", "Focus Chat Input"),
        f1: false,
        keybinding: [
          {
            primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
            weight: KeybindingWeight.WorkbenchContrib,
            when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat.negate())
          },
          {
            when: ContextKeyExpr.and(ChatContextKeys.inChatSession, ChatContextKeys.inChatInput.negate(), ChatContextKeys.inQuickChat),
            primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
            weight: KeybindingWeight.WorkbenchContrib
          }
        ]
      });
    }
    run(accessor, ...args) {
      const widgetService = accessor.get(IChatWidgetService);
      widgetService.lastFocusedWidget?.focusInput();
    }
  });
  const nonEnterpriseCopilotUsers = ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.notEquals(`config.${defaultChat.completionsAdvancedSetting}.authProvider`, defaultChat.enterpriseProviderId));
  registerAction2(class extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.manageSettings",
        title: localize2("manageCopilot", "Manage Copilot"),
        category: CHAT_CATEGORY,
        f1: true,
        precondition: ContextKeyExpr.and(
          ContextKeyExpr.or(
            ChatContextKeys.Entitlement.limited,
            ChatContextKeys.Entitlement.pro
          ),
          nonEnterpriseCopilotUsers
        ),
        menu: {
          id: MenuId.ChatTitleBarMenu,
          group: "y_manage",
          order: 1,
          when: nonEnterpriseCopilotUsers
        }
      });
    }
    async run(accessor) {
      const openerService = accessor.get(IOpenerService);
      openerService.open(URI.parse(defaultChat.manageSettingsUrl));
    }
  });
  registerAction2(class ShowExtensionsUsingCopilot extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.showExtensionsUsingCopilot",
        title: localize2("showCopilotUsageExtensions", "Show Extensions using Copilot"),
        f1: true,
        category: EXTENSIONS_CATEGORY,
        precondition: ChatContextKeys.enabled
      });
    }
    async run(accessor) {
      const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
      extensionsWorkbenchService.openSearch(`@feature:${CopilotUsageExtensionFeatureId}`);
    }
  });
  registerAction2(class ConfigureCopilotCompletions extends Action2 {
    constructor() {
      super({
        id: "workbench.action.chat.configureCodeCompletions",
        title: localize2("configureCompletions", "Configure Code Completions..."),
        precondition: ChatContextKeys.Setup.installed,
        menu: {
          id: MenuId.ChatTitleBarMenu,
          group: "f_completions",
          order: 10
        }
      });
    }
    async run(accessor) {
      const commandService = accessor.get(ICommandService);
      commandService.executeCommand(defaultChat.completionsMenuCommand);
    }
  });
  registerAction2(class ShowLimitReachedDialogAction extends Action2 {
    constructor() {
      super({
        id: OPEN_CHAT_QUOTA_EXCEEDED_DIALOG,
        title: localize("upgradeChat", "Upgrade to Copilot Pro")
      });
    }
    async run(accessor) {
      const chatEntitlementService = accessor.get(IChatEntitlementService);
      const commandService = accessor.get(ICommandService);
      const dialogService = accessor.get(IDialogService);
      const telemetryService = accessor.get(ITelemetryService);
      const dateFormatter = safeIntl.DateTimeFormat(language, { year: "numeric", month: "long", day: "numeric" });
      let message;
      const { chatQuotaExceeded, completionsQuotaExceeded } = chatEntitlementService.quotas;
      if (chatQuotaExceeded && !completionsQuotaExceeded) {
        message = localize("chatQuotaExceeded", "You've run out of free chat messages. You still have free code completions available in the Copilot Free plan. These limits will reset on {0}.", dateFormatter.format(chatEntitlementService.quotas.quotaResetDate));
      } else if (completionsQuotaExceeded && !chatQuotaExceeded) {
        message = localize("completionsQuotaExceeded", "You've run out of free code completions. You still have free chat messages available in the Copilot Free plan. These limits will reset on {0}.", dateFormatter.format(chatEntitlementService.quotas.quotaResetDate));
      } else {
        message = localize("chatAndCompletionsQuotaExceeded", "You've reached the limit of the Copilot Free plan. These limits will reset on {0}.", dateFormatter.format(chatEntitlementService.quotas.quotaResetDate));
      }
      const upgradeToPro = localize("upgradeToPro", "Upgrade to Copilot Pro (your first 30 days are free) for:\n- Unlimited code completions\n- Unlimited chat messages\n- Access to additional models");
      await dialogService.prompt({
        type: "none",
        message: localize("copilotFree", "Copilot Limit Reached"),
        cancelButton: {
          label: localize("dismiss", "Dismiss"),
          run: () => {
          }
        },
        buttons: [
          {
            label: localize("upgradePro", "Upgrade to Copilot Pro"),
            run: () => {
              const commandId = "workbench.action.chat.upgradePlan";
              telemetryService.publicLog2("workbenchActionExecuted", { id: commandId, from: "chat-dialog" });
              commandService.executeCommand(commandId);
            }
          }
        ],
        custom: {
          icon: Codicon.copilotWarningLarge,
          markdownDetails: [
            { markdown: new MarkdownString(message, true) },
            { markdown: new MarkdownString(upgradeToPro, true) }
          ]
        }
      });
    }
  });
}
function stringifyItem(item, includeName = true) {
  if (isRequestVM(item)) {
    return (includeName ? `${item.username}: ` : "") + item.messageText;
  } else {
    return (includeName ? `${item.username}: ` : "") + item.response.toString();
  }
}
const defaultChat = {
  documentationUrl: product.defaultChatAgent?.documentationUrl ?? "",
  manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? "",
  managePlanUrl: product.defaultChatAgent?.managePlanUrl ?? "",
  enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? "",
  completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? "",
  completionsMenuCommand: product.defaultChatAgent?.completionsMenuCommand ?? ""
};
registerAction2(class ToggleCopilotControl extends ToggleTitleBarConfigAction {
  constructor() {
    super(
      "chat.commandCenter.enabled",
      localize("toggle.chatControl", "Copilot Controls"),
      localize("toggle.chatControlsDescription", "Toggle visibility of the Copilot Controls in title bar"),
      5,
      false,
      ChatContextKeys.supported
    );
  }
});
registerAction2(class ResetTrustedToolsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.resetTrustedTools",
      title: localize2("resetTrustedTools", "Reset Tool Confirmations"),
      category: CHAT_CATEGORY,
      f1: true
    });
  }
  run(accessor) {
    accessor.get(ILanguageModelToolsService).resetToolAutoConfirmation();
    accessor.get(INotificationService).info(localize("resetTrustedToolsSuccess", "Tool confirmation preferences have been reset."));
  }
});
let CopilotTitleBarMenuRendering = class extends Disposable {
  constructor(actionViewItemService, instantiationService, chatEntitlementService, configurationService) {
    super();
    const disposable = actionViewItemService.register(MenuId.CommandCenter, MenuId.ChatTitleBarMenu, (action, options) => {
      if (!(action instanceof SubmenuItemAction)) {
        return void 0;
      }
      const dropdownAction = toAction({
        id: "copilot.titleBarMenuRendering.more",
        label: localize("more", "More..."),
        run() {
        }
      });
      const chatExtensionInstalled = chatEntitlementService.sentiment === ChatSentiment.Installed;
      const chatHidden = chatEntitlementService.sentiment === ChatSentiment.Disabled;
      const { chatQuotaExceeded, completionsQuotaExceeded } = chatEntitlementService.quotas;
      const signedOut = chatEntitlementService.entitlement === ChatEntitlement.Unknown;
      const setupFromDialog = configurationService.getValue("chat.setupFromDialog");
      let primaryActionId = TOGGLE_CHAT_ACTION_ID;
      let primaryActionTitle = localize("toggleChat", "Toggle Chat");
      let primaryActionIcon = Codicon.copilot;
      if (!chatExtensionInstalled && (!setupFromDialog || chatHidden)) {
        primaryActionId = CHAT_SETUP_ACTION_ID;
        primaryActionTitle = localize("triggerChatSetup", "Use AI Features with Copilot for free...");
      } else if (chatExtensionInstalled && signedOut) {
        primaryActionId = setupFromDialog ? CHAT_SETUP_ACTION_ID : TOGGLE_CHAT_ACTION_ID;
        primaryActionTitle = localize("signInToChatSetup", "Sign in to use Copilot...");
        primaryActionIcon = Codicon.copilotNotConnected;
      } else if (chatExtensionInstalled && (chatQuotaExceeded || completionsQuotaExceeded)) {
        primaryActionId = OPEN_CHAT_QUOTA_EXCEEDED_DIALOG;
        if (chatQuotaExceeded && !completionsQuotaExceeded) {
          primaryActionTitle = localize("chatQuotaExceededButton", "Monthly chat messages limit reached. Click for details.");
        } else if (completionsQuotaExceeded && !chatQuotaExceeded) {
          primaryActionTitle = localize("completionsQuotaExceededButton", "Monthly code completions limit reached. Click for details.");
        } else {
          primaryActionTitle = localize("chatAndCompletionsQuotaExceededButton", "Copilot Free plan limit reached. Click for details.");
        }
        primaryActionIcon = Codicon.copilotWarning;
      }
      return instantiationService.createInstance(DropdownWithPrimaryActionViewItem, instantiationService.createInstance(MenuItemAction, {
        id: primaryActionId,
        title: primaryActionTitle,
        icon: primaryActionIcon
      }, void 0, void 0, void 0, void 0), dropdownAction, action.actions, "", { ...options, skipTelemetry: true });
    }, Event.any(
      chatEntitlementService.onDidChangeSentiment,
      chatEntitlementService.onDidChangeQuotaExceeded,
      chatEntitlementService.onDidChangeEntitlement,
      Event.filter(configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("chat.setupFromDialog"))
    ));
    markAsSingleton(disposable);
  }
};
CopilotTitleBarMenuRendering.ID = "workbench.contrib.copilotTitleBarMenuRendering";
CopilotTitleBarMenuRendering = __decorateClass([
  __decorateParam(0, IActionViewItemService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IChatEntitlementService),
  __decorateParam(3, IConfigurationService)
], CopilotTitleBarMenuRendering);
function getEditsViewId(accessor) {
  const chatService = accessor.get(IChatService);
  return chatService.unifiedViewEnabled ? ChatViewId : EditsViewId;
}
async function handleCurrentEditingSession(currentEditingSession, phrase, dialogService) {
  if (shouldShowClearEditingSessionConfirmation(currentEditingSession)) {
    return showClearEditingSessionConfirmation(currentEditingSession, dialogService, { messageOverride: phrase });
  }
  return true;
}
async function showClearEditingSessionConfirmation(editingSession, dialogService, options) {
  const defaultPhrase = localize("chat.startEditing.confirmation.pending.message.default", "Starting a new chat will end your current edit session.");
  const defaultTitle = localize("chat.startEditing.confirmation.title", "Start new chat?");
  const phrase = options?.messageOverride ?? defaultPhrase;
  const title = options?.titleOverride ?? defaultTitle;
  const currentEdits = editingSession.entries.get();
  const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === WorkingSetEntryState.Modified);
  const { result } = await dialogService.prompt({
    title,
    message: phrase + " " + localize("chat.startEditing.confirmation.pending.message.2", "Do you want to keep pending edits to {0} files?", undecidedEdits.length),
    type: "info",
    cancelButton: true,
    buttons: [
      {
        label: localize("chat.startEditing.confirmation.acceptEdits", "Keep & Continue"),
        run: async () => {
          await editingSession.accept();
          return true;
        }
      },
      {
        label: localize("chat.startEditing.confirmation.discardEdits", "Undo & Continue"),
        run: async () => {
          await editingSession.reject();
          return true;
        }
      }
    ]
  });
  return Boolean(result);
}
function shouldShowClearEditingSessionConfirmation(editingSession) {
  const currentEdits = editingSession.entries.get();
  const currentEditCount = currentEdits.length;
  if (currentEditCount) {
    const undecidedEdits = currentEdits.filter((edit) => edit.state.get() === WorkingSetEntryState.Modified);
    return !!undecidedEdits.length;
  }
  return false;
}
export {
  CHAT_CATEGORY,
  CHAT_OPEN_ACTION_ID,
  CHAT_SETUP_ACTION_ID,
  CopilotTitleBarMenuRendering,
  OPEN_CHAT_QUOTA_EXCEEDED_DIALOG,
  getEditsViewId,
  handleCurrentEditingSession,
  registerChatActions,
  shouldShowClearEditingSessionConfirmation,
  showClearEditingSessionConfirmation,
  stringifyItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0QWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHRvQWN0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgZnJvbU5vd0J5RGF5LCBzYWZlSW50bCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGUuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgbWFya0FzU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxhbmd1YWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU3VnZ2VzdENvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdENvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW1TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2FjdGlvblZpZXdJdGVtU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvZHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24sIHJlZ2lzdGVyQWN0aW9uMiwgU3VibWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJc0xpbnV4Q29udGV4dCwgSXNXaW5kb3dzQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0QnV0dG9uLCBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IFRvZ2dsZVRpdGxlQmFyQ29uZmlnQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy90aXRsZWJhci90aXRsZWJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBQ1RJVkVfR1JPVVAsIElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBQYXJ0cyB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRVhURU5TSU9OU19DQVRFR09SWSwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElDaGF0RWRpdGluZ1Nlc3Npb24sIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0RW50aXRsZW1lbnQsIENoYXRTZW50aW1lbnQsIElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFbnRpdGxlbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZXh0cmFjdEFnZW50QW5kQ29tbWFuZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXREZXRhaWwsIElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RWaWV3TW9kZWwsIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwsIGlzUmVxdWVzdFZNIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXRIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0V2lkZ2V0SGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGUsIHZhbGlkYXRlQ2hhdE1vZGUgfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvcGlsb3RVc2FnZUV4dGVuc2lvbkZlYXR1cmVJZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZU1vZGVsU3RhdHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0Vmlld0lkLCBFZGl0c1ZpZXdJZCwgSUNoYXRXaWRnZXQsIElDaGF0V2lkZ2V0U2VydmljZSwgc2hvd0NoYXRWaWV3LCBzaG93Q29waWxvdFZpZXcgfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IElDaGF0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL2NoYXRFZGl0b3IuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvcklucHV0IH0gZnJvbSAnLi4vY2hhdEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IENoYXRWaWV3UGFuZSB9IGZyb20gJy4uL2NoYXRWaWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBjb252ZXJ0QnVmZmVyVG9TY3JlZW5zaG90VmFyaWFibGUgfSBmcm9tICcuLi9jb250cmliL3NjcmVlbnNob3QuanMnO1xuaW1wb3J0IHsgY2xlYXJDaGF0RWRpdG9yIH0gZnJvbSAnLi9jaGF0Q2xlYXIuanMnO1xuXG5leHBvcnQgY29uc3QgQ0hBVF9DQVRFR09SWSA9IGxvY2FsaXplMignY2hhdC5jYXRlZ29yeScsICdDaGF0Jyk7XG5cbmV4cG9ydCBjb25zdCBDSEFUX09QRU5fQUNUSU9OX0lEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5vcGVuJztcbmV4cG9ydCBjb25zdCBDSEFUX1NFVFVQX0FDVElPTl9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudHJpZ2dlclNldHVwJztcbmNvbnN0IFRPR0dMRV9DSEFUX0FDVElPTl9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudG9nZ2xlJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFZpZXdPcGVuT3B0aW9ucyB7XG5cdC8qKlxuXHQgKiBUaGUgcXVlcnkgZm9yIGNoYXQuXG5cdCAqL1xuXHRxdWVyeTogc3RyaW5nO1xuXHQvKipcblx0ICogV2hldGhlciB0aGUgcXVlcnkgaXMgcGFydGlhbCBhbmQgd2lsbCBhd2FpdCBtb3JlIGlucHV0IGZyb20gdGhlIHVzZXIuXG5cdCAqL1xuXHRpc1BhcnRpYWxRdWVyeT86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBBIGxpc3Qgb2YgdG9vbHMgSURzIHdpdGggYGNhbkJlUmVmZXJlbmNlZEluUHJvbXB0YCB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgYW5kIGF0dGFjaGVkIGlmIHRoZXkgZXhpc3QuXG5cdCAqL1xuXHR0b29sSWRzPzogc3RyaW5nW107XG5cdC8qKlxuXHQgKiBBbnkgcHJldmlvdXMgY2hhdCByZXF1ZXN0cyBhbmQgcmVzcG9uc2VzIHRoYXQgc2hvdWxkIGJlIHNob3duIGluIHRoZSBjaGF0IHZpZXcuXG5cdCAqL1xuXHRwcmV2aW91c1JlcXVlc3RzPzogSUNoYXRWaWV3T3BlblJlcXVlc3RFbnRyeVtdO1xuXHQvKipcblx0ICogV2hldGhlciBhIHNjcmVlbnNob3Qgb2YgdGhlIGZvY3VzZWQgd2luZG93IHNob3VsZCBiZSB0YWtlbiBhbmQgYXR0YWNoZWRcblx0ICovXG5cdGF0dGFjaFNjcmVlbnNob3Q/OiBib29sZWFuO1xuXHQvKipcblx0ICogVGhlIG1vZGUgdG8gb3BlbiB0aGUgY2hhdCBpbi5cblx0ICovXG5cdG1vZGU/OiBDaGF0TW9kZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFZpZXdPcGVuUmVxdWVzdEVudHJ5IHtcblx0cmVxdWVzdDogc3RyaW5nO1xuXHRyZXNwb25zZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgT1BFTl9DSEFUX1FVT1RBX0VYQ0VFREVEX0RJQUxPRyA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQub3BlblF1b3RhRXhjZWVkZWREaWFsb2cnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJDaGF0QWN0aW9ucygpIHtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5DaGF0R2xvYmFsQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6IENIQVRfT1BFTl9BQ1RJT05fSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ29wZW5DaGF0JywgXCJPcGVuIENoYXRcIiksXG5cdFx0XHRcdGljb246IENvZGljb24uY29waWxvdCxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5TZXR1cC5oaWRkZW4udG9OZWdhdGVkKCksXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUksXG5cdFx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5LZXlJXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0VGl0bGVCYXJNZW51LFxuXHRcdFx0XHRcdGdyb3VwOiAnYV9vcGVuJyxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG9wdHM/OiBzdHJpbmcgfCBJQ2hhdFZpZXdPcGVuT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0b3B0cyA9IHR5cGVvZiBvcHRzID09PSAnc3RyaW5nJyA/IHsgcXVlcnk6IG9wdHMgfSA6IG9wdHM7XG5cblx0XHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0XHRjb25zdCB0b29sc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgY2hhdFdpZGdldCA9IGF3YWl0IHNob3dDaGF0Vmlldyh2aWV3c1NlcnZpY2UpO1xuXHRcdFx0aWYgKCFjaGF0V2lkZ2V0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChvcHRzPy5tb2RlICYmIHZhbGlkYXRlQ2hhdE1vZGUob3B0cy5tb2RlKSkge1xuXHRcdFx0XHRjaGF0V2lkZ2V0LmlucHV0LnNldENoYXRNb2RlKG9wdHMubW9kZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAob3B0cz8ucHJldmlvdXNSZXF1ZXN0cz8ubGVuZ3RoICYmIGNoYXRXaWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgeyByZXF1ZXN0LCByZXNwb25zZSB9IG9mIG9wdHMucHJldmlvdXNSZXF1ZXN0cykge1xuXHRcdFx0XHRcdGNoYXRTZXJ2aWNlLmFkZENvbXBsZXRlUmVxdWVzdChjaGF0V2lkZ2V0LnZpZXdNb2RlbC5zZXNzaW9uSWQsIHJlcXVlc3QsIHVuZGVmaW5lZCwgMCwgeyBtZXNzYWdlOiByZXNwb25zZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdHM/LmF0dGFjaFNjcmVlbnNob3QpIHtcblx0XHRcdFx0Y29uc3Qgc2NyZWVuc2hvdCA9IGF3YWl0IGhvc3RTZXJ2aWNlLmdldFNjcmVlbnNob3QoKTtcblx0XHRcdFx0aWYgKHNjcmVlbnNob3QpIHtcblx0XHRcdFx0XHRjaGF0V2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRDb250ZXh0KGNvbnZlcnRCdWZmZXJUb1NjcmVlbnNob3RWYXJpYWJsZShzY3JlZW5zaG90KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChvcHRzPy5xdWVyeSkge1xuXHRcdFx0XHRpZiAob3B0cy5pc1BhcnRpYWxRdWVyeSkge1xuXHRcdFx0XHRcdGNoYXRXaWRnZXQuc2V0SW5wdXQob3B0cy5xdWVyeSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hhdFdpZGdldC5hY2NlcHRJbnB1dChvcHRzLnF1ZXJ5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdHM/LnRvb2xJZHMgJiYgb3B0cy50b29sSWRzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0Zm9yIChjb25zdCB0b29sSWQgb2Ygb3B0cy50b29sSWRzKSB7XG5cdFx0XHRcdFx0Y29uc3QgdG9vbCA9IHRvb2xzU2VydmljZS5nZXRUb29sKHRvb2xJZCk7XG5cdFx0XHRcdFx0aWYgKHRvb2wpIHtcblx0XHRcdFx0XHRcdGNoYXRXaWRnZXQuYXR0YWNobWVudE1vZGVsLmFkZENvbnRleHQoe1xuXHRcdFx0XHRcdFx0XHRpZDogdG9vbC5pZCxcblx0XHRcdFx0XHRcdFx0bmFtZTogdG9vbC5kaXNwbGF5TmFtZSxcblx0XHRcdFx0XHRcdFx0ZnVsbE5hbWU6IHRvb2wuZGlzcGxheU5hbWUsXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGljb246IFRoZW1lSWNvbi5pc1RoZW1lSWNvbih0b29sLmljb24pID8gdG9vbC5pY29uIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRpc1Rvb2w6IHRydWVcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjaGF0V2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVDaGF0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiBUT0dHTEVfQ0hBVF9BQ1RJT05fSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3RvZ2dsZUNoYXQnLCBcIlRvZ2dsZSBDaGF0XCIpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgY2hhdExvY2F0aW9uID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQoQ2hhdFZpZXdJZCk7XG5cdFx0XHRjb25zdCBlZGl0c0xvY2F0aW9uID0gdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQoRWRpdHNWaWV3SWQpO1xuXG5cdFx0XHRpZiAodmlld3NTZXJ2aWNlLmlzVmlld1Zpc2libGUoQ2hhdFZpZXdJZCkgfHwgKGNoYXRMb2NhdGlvbiA9PT0gZWRpdHNMb2NhdGlvbiAmJiB2aWV3c1NlcnZpY2UuaXNWaWV3VmlzaWJsZShFZGl0c1ZpZXdJZCkpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlUGFydFZpc2liaWxpdHkobGF5b3V0U2VydmljZSwgY2hhdExvY2F0aW9uLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVBhcnRWaXNpYmlsaXR5KGxheW91dFNlcnZpY2UsIGNoYXRMb2NhdGlvbiwgdHJ1ZSk7XG5cdFx0XHRcdChhd2FpdCBzaG93Q29waWxvdFZpZXcodmlld3NTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlKSk/LmZvY3VzSW5wdXQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRwcml2YXRlIHVwZGF0ZVBhcnRWaXNpYmlsaXR5KGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBsb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uIHwgbnVsbCwgdmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0bGV0IHBhcnQ6IFBhcnRzLlBBTkVMX1BBUlQgfCBQYXJ0cy5TSURFQkFSX1BBUlQgfCBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCB8IHVuZGVmaW5lZDtcblx0XHRcdHN3aXRjaCAobG9jYXRpb24pIHtcblx0XHRcdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWw6XG5cdFx0XHRcdFx0cGFydCA9IFBhcnRzLlBBTkVMX1BBUlQ7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXI6XG5cdFx0XHRcdFx0cGFydCA9IFBhcnRzLlNJREVCQVJfUEFSVDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyOlxuXHRcdFx0XHRcdHBhcnQgPSBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhcnQpIHtcblx0XHRcdFx0bGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKCF2aXNpYmxlLCBwYXJ0KTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDaGF0SGlzdG9yeUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24uY2hhdC5oaXN0b3J5YCxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hhdC5oaXN0b3J5LmxhYmVsJywgXCJTaG93IENoYXRzLi4uXCIpLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgQ2hhdFZpZXdJZCksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5oaXN0b3J5LFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXc8Q2hhdFZpZXdQYW5lPihDaGF0Vmlld0lkKTtcblx0XHRcdGlmICghdmlldykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNoYXRTZXNzaW9uSWQgPSB2aWV3LndpZGdldC52aWV3TW9kZWw/Lm1vZGVsLnNlc3Npb25JZDtcblx0XHRcdGlmICghY2hhdFNlc3Npb25JZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRpbmdTZXNzaW9uID0gdmlldy53aWRnZXQudmlld01vZGVsPy5tb2RlbC5lZGl0aW5nU2Vzc2lvbjtcblx0XHRcdGlmIChlZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0XHRjb25zdCBwaHJhc2UgPSBsb2NhbGl6ZSgnc3dpdGNoQ2hhdC5jb25maXJtUGhyYXNlJywgXCJTd2l0Y2hpbmcgY2hhdHMgd2lsbCBlbmQgeW91ciBjdXJyZW50IGVkaXQgc2Vzc2lvbi5cIik7XG5cdFx0XHRcdGlmICghYXdhaXQgaGFuZGxlQ3VycmVudEVkaXRpbmdTZXNzaW9uKGVkaXRpbmdTZXNzaW9uLCBwaHJhc2UsIGRpYWxvZ1NlcnZpY2UpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNob3dQaWNrZXIgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG9wZW5JbkVkaXRvckJ1dHRvbjogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdFx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5maWxlKSxcblx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnaW50ZXJhY3RpdmVTZXNzaW9uLmhpc3RvcnkuZWRpdG9yJywgXCJPcGVuIGluIEVkaXRvclwiKSxcblx0XHRcdFx0fTtcblx0XHRcdFx0Y29uc3QgZGVsZXRlQnV0dG9uOiBJUXVpY2tJbnB1dEJ1dHRvbiA9IHtcblx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLngpLFxuXHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdpbnRlcmFjdGl2ZVNlc3Npb24uaGlzdG9yeS5kZWxldGUnLCBcIkRlbGV0ZVwiKSxcblx0XHRcdFx0fTtcblx0XHRcdFx0Y29uc3QgcmVuYW1lQnV0dG9uOiBJUXVpY2tJbnB1dEJ1dHRvbiA9IHtcblx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnBlbmNpbCksXG5cdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2NoYXQuaGlzdG9yeS5yZW5hbWUnLCBcIlJlbmFtZVwiKSxcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRpbnRlcmZhY2UgSUNoYXRQaWNrZXJJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRcdFx0XHRcdGNoYXQ6IElDaGF0RGV0YWlsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZ2V0UGlja3MgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCBjaGF0U2VydmljZS5nZXRIaXN0b3J5KCk7XG5cdFx0XHRcdFx0aXRlbXMuc29ydCgoYSwgYikgPT4gKGIubGFzdE1lc3NhZ2VEYXRlID8/IDApIC0gKGEubGFzdE1lc3NhZ2VEYXRlID8/IDApKTtcblxuXHRcdFx0XHRcdGxldCBsYXN0RGF0ZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGNvbnN0IHBpY2tzID0gaXRlbXMuZmxhdE1hcCgoaSk6IFtJUXVpY2tQaWNrU2VwYXJhdG9yIHwgdW5kZWZpbmVkLCBJQ2hhdFBpY2tlckl0ZW1dID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHRpbWVBZ29TdHIgPSBmcm9tTm93QnlEYXkoaS5sYXN0TWVzc2FnZURhdGUsIHRydWUsIHRydWUpO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VwYXJhdG9yOiBJUXVpY2tQaWNrU2VwYXJhdG9yIHwgdW5kZWZpbmVkID0gdGltZUFnb1N0ciAhPT0gbGFzdERhdGUgPyB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogdGltZUFnb1N0cixcblx0XHRcdFx0XHRcdH0gOiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRsYXN0RGF0ZSA9IHRpbWVBZ29TdHI7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdFx0XHRzZXBhcmF0b3IsXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogaS50aXRsZSxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogaS5pc0FjdGl2ZSA/IGAoJHtsb2NhbGl6ZSgnY3VycmVudENoYXRMYWJlbCcsICdjdXJyZW50Jyl9KWAgOiAnJyxcblx0XHRcdFx0XHRcdFx0XHRjaGF0OiBpLFxuXHRcdFx0XHRcdFx0XHRcdGJ1dHRvbnM6IGkuaXNBY3RpdmUgPyBbcmVuYW1lQnV0dG9uXSA6IFtcblx0XHRcdFx0XHRcdFx0XHRcdHJlbmFtZUJ1dHRvbixcblx0XHRcdFx0XHRcdFx0XHRcdG9wZW5JbkVkaXRvckJ1dHRvbixcblx0XHRcdFx0XHRcdFx0XHRcdGRlbGV0ZUJ1dHRvbixcblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF07XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRyZXR1cm4gY29hbGVzY2UocGlja3MpO1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRjb25zdCBwaWNrZXIgPSBzdG9yZS5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElDaGF0UGlja2VySXRlbT4oeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pKTtcblx0XHRcdFx0cGlja2VyLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ2ludGVyYWN0aXZlU2Vzc2lvbi5oaXN0b3J5LnBpY2snLCBcIlN3aXRjaCB0byBjaGF0XCIpO1xuXHRcdFx0XHRjb25zdCBwaWNrcyA9IGF3YWl0IGdldFBpY2tzKCk7XG5cdFx0XHRcdHBpY2tlci5pdGVtcyA9IHBpY2tzO1xuXHRcdFx0XHRzdG9yZS5hZGQocGlja2VyLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oYXN5bmMgY29udGV4dCA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbnRleHQuYnV0dG9uID09PSBvcGVuSW5FZGl0b3JCdXR0b24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IG9wdGlvbnM6IElDaGF0RWRpdG9yT3B0aW9ucyA9IHsgdGFyZ2V0OiB7IHNlc3Npb25JZDogY29udGV4dC5pdGVtLmNoYXQuc2Vzc2lvbklkIH0sIHBpbm5lZDogdHJ1ZSB9O1xuXHRcdFx0XHRcdFx0ZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IENoYXRFZGl0b3JJbnB1dC5nZXROZXdFZGl0b3JVcmkoKSwgb3B0aW9ucyB9LCBBQ1RJVkVfR1JPVVApO1xuXHRcdFx0XHRcdFx0cGlja2VyLmhpZGUoKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbnRleHQuYnV0dG9uID09PSBkZWxldGVCdXR0b24pIHtcblx0XHRcdFx0XHRcdGNoYXRTZXJ2aWNlLnJlbW92ZUhpc3RvcnlFbnRyeShjb250ZXh0Lml0ZW0uY2hhdC5zZXNzaW9uSWQpO1xuXHRcdFx0XHRcdFx0cGlja2VyLml0ZW1zID0gYXdhaXQgZ2V0UGlja3MoKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKGNvbnRleHQuYnV0dG9uID09PSByZW5hbWVCdXR0b24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRpdGxlID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoeyB0aXRsZTogbG9jYWxpemUoJ25ld0NoYXRUaXRsZScsIFwiTmV3IGNoYXQgdGl0bGVcIiksIHZhbHVlOiBjb250ZXh0Lml0ZW0uY2hhdC50aXRsZSB9KTtcblx0XHRcdFx0XHRcdGlmICh0aXRsZSkge1xuXHRcdFx0XHRcdFx0XHRjaGF0U2VydmljZS5zZXRDaGF0U2Vzc2lvblRpdGxlKGNvbnRleHQuaXRlbS5jaGF0LnNlc3Npb25JZCwgdGl0bGUpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHQvLyBUaGUgcXVpY2sgaW5wdXQgaGlkZXMgdGhlIHBpY2tlciwgaXQgZ2V0cyBkaXNwb3NlZCwgc28gd2Uga2ljayBpdCBvZmYgZnJvbSBzY3JhdGNoXG5cdFx0XHRcdFx0XHRhd2FpdCBzaG93UGlja2VyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHN0b3JlLmFkZChwaWNrZXIub25EaWRBY2NlcHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtID0gcGlja2VyLnNlbGVjdGVkSXRlbXNbMF07XG5cdFx0XHRcdFx0XHRjb25zdCBzZXNzaW9uSWQgPSBpdGVtLmNoYXQuc2Vzc2lvbklkO1xuXHRcdFx0XHRcdFx0YXdhaXQgdmlldy5sb2FkU2Vzc2lvbihzZXNzaW9uSWQpO1xuXHRcdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0XHRwaWNrZXIuaGlkZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRzdG9yZS5hZGQocGlja2VyLm9uRGlkSGlkZSgoKSA9PiBzdG9yZS5kaXNwb3NlKCkpKTtcblxuXHRcdFx0XHRwaWNrZXIuc2hvdygpO1xuXHRcdFx0fTtcblx0XHRcdGF3YWl0IHNob3dQaWNrZXIoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBPcGVuQ2hhdEVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24ub3BlbkNoYXRgLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZVNlc3Npb24ub3BlbicsIFwiT3BlbiBFZGl0b3JcIiksXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBDaGF0RWRpdG9ySW5wdXQuZ2V0TmV3RWRpdG9yVXJpKCksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gc2F0aXNmaWVzIElDaGF0RWRpdG9yT3B0aW9ucyB9KTtcblx0XHR9XG5cdH0pO1xuXG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENoYXRBZGRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWRkUGFydGljaXBhbnQnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0V2l0aCcsIFwiQ2hhdCB3aXRoIEV4dGVuc2lvblwiKSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5tZW50aW9uLFxuXHRcdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0SW5wdXQsXG5cdFx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29udGV4dDogeyB3aWRnZXQ/OiBJQ2hhdFdpZGdldCB9IHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblx0XHRcdGNvbnN0IHdpZGdldCA9IGNvbnRleHQ/LndpZGdldCA/PyB3aWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBoYXNBZ2VudE9yQ29tbWFuZCA9IGV4dHJhY3RBZ2VudEFuZENvbW1hbmQod2lkZ2V0LnBhcnNlZElucHV0KTtcblx0XHRcdGlmIChoYXNBZ2VudE9yQ29tbWFuZD8uYWdlbnRQYXJ0IHx8IGhhc0FnZW50T3JDb21tYW5kPy5jb21tYW5kUGFydCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHN1Z2dlc3RDdHJsID0gU3VnZ2VzdENvbnRyb2xsZXIuZ2V0KHdpZGdldC5pbnB1dEVkaXRvcik7XG5cdFx0XHRpZiAoc3VnZ2VzdEN0cmwpIHtcblx0XHRcdFx0Y29uc3QgY3VyVGV4dCA9IHdpZGdldC5pbnB1dEVkaXRvci5nZXRWYWx1ZSgpO1xuXHRcdFx0XHRjb25zdCBuZXdWYWx1ZSA9IGN1clRleHQgPyBgQCAke2N1clRleHR9YCA6ICdAJztcblx0XHRcdFx0aWYgKCFjdXJUZXh0LnN0YXJ0c1dpdGgoJ0AnKSkge1xuXHRcdFx0XHRcdHdpZGdldC5pbnB1dEVkaXRvci5zZXRWYWx1ZShuZXdWYWx1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR3aWRnZXQuaW5wdXRFZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKDEsIDIpKTtcblx0XHRcdFx0c3VnZ2VzdEN0cmwudHJpZ2dlclN1Z2dlc3QodW5kZWZpbmVkLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDbGVhckNoYXRJbnB1dEhpc3RvcnlBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuY2xlYXJJbnB1dEhpc3RvcnknLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdpbnRlcmFjdGl2ZVNlc3Npb24uY2xlYXJIaXN0b3J5LmxhYmVsJywgXCJDbGVhciBJbnB1dCBIaXN0b3J5XCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0Y29uc3QgaGlzdG9yeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRIaXN0b3J5U2VydmljZSk7XG5cdFx0XHRoaXN0b3J5U2VydmljZS5jbGVhckhpc3RvcnkoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBDbGVhckNoYXRIaXN0b3J5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmNsZWFySGlzdG9yeScsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2NoYXQuY2xlYXIubGFiZWwnLCBcIkNsZWFyIEFsbCBXb3Jrc3BhY2UgQ2hhdHNcIiksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgd2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXG5cdFx0XHRhd2FpdCBjaGF0U2VydmljZS5jbGVhckFsbEhpc3RvcnlFbnRyaWVzKCk7XG5cblx0XHRcdHdpZGdldFNlcnZpY2UuZ2V0QWxsV2lkZ2V0cygpLmZvckVhY2god2lkZ2V0ID0+IHtcblx0XHRcdFx0d2lkZ2V0LmNsZWFyKCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gQ2xlYXIgYWxsIGNoYXQgZWRpdG9ycy4gSGF2ZSB0byBnbyB0aGlzIHJvdXRlIGJlY2F1c2UgdGhlIGNoYXQgZWRpdG9yIG1heSBiZSBpbiB0aGUgYmFja2dyb3VuZCBhbmRcblx0XHRcdC8vIG5vdCBoYXZlIGEgQ2hhdEVkaXRvcklucHV0LlxuXHRcdFx0ZWRpdG9yR3JvdXBzU2VydmljZS5ncm91cHMuZm9yRWFjaChncm91cCA9PiB7XG5cdFx0XHRcdGdyb3VwLmVkaXRvcnMuZm9yRWFjaChlZGl0b3IgPT4ge1xuXHRcdFx0XHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBDaGF0RWRpdG9ySW5wdXQpIHtcblx0XHRcdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGNsZWFyQ2hhdEVkaXRvciwgZWRpdG9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgRm9jdXNDaGF0QWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnY2hhdC5hY3Rpb24uZm9jdXMnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdhY3Rpb25zLmludGVyYWN0aXZlU2Vzc2lvbi5mb2N1cycsICdGb2N1cyBDaGF0IExpc3QnKSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0KSxcblx0XHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRcdGtleWJpbmRpbmc6IFtcblx0XHRcdFx0XHQvLyBPbiBtYWMsIHJlcXVpcmUgdGhhdCB0aGUgY3Vyc29yIGlzIGF0IHRoZSB0b3Agb2YgdGhlIGlucHV0LCB0byBhdm9pZCBzdGVhbGluZyBjbWQrdXAgdG8gbW92ZSB0aGUgY3Vyc29yIHRvIHRoZSB0b3Bcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmlucHV0Q3Vyc29yQXRUb3AsIENoYXRDb250ZXh0S2V5cy5pblF1aWNrQ2hhdC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Ly8gT24gd2luL2xpbnV4LCBjdHJsK3VwIGNhbiBhbHdheXMgZm9jdXMgdGhlIGNoYXQgbGlzdFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihJc1dpbmRvd3NDb250ZXh0LCBJc0xpbnV4Q29udGV4dCksIENoYXRDb250ZXh0S2V5cy5pblF1aWNrQ2hhdC5uZWdhdGUoKSksXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBDaGF0Q29udGV4dEtleXMuaW5RdWlja0NoYXQpLFxuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cnVuRWRpdG9yQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGVkaXRvclVyaSA9IGVkaXRvci5nZXRNb2RlbCgpPy51cmk7XG5cdFx0XHRpZiAoZWRpdG9yVXJpKSB7XG5cdFx0XHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdFx0d2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeUlucHV0VXJpKGVkaXRvclVyaSk/LmZvY3VzTGFzdE1lc3NhZ2UoKTtcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2N1c0NoYXRJbnB1dEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5mb2N1c0lucHV0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW50ZXJhY3RpdmVTZXNzaW9uLmZvY3VzSW5wdXQubGFiZWwnLCBcIkZvY3VzIENoYXQgSW5wdXRcIiksXG5cdFx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdFx0a2V5YmluZGluZzogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5Eb3duQXJyb3csXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuaW5DaGF0U2Vzc2lvbiwgQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0Lm5lZ2F0ZSgpLCBDaGF0Q29udGV4dEtleXMuaW5RdWlja0NoYXQubmVnYXRlKCkpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBDaGF0Q29udGV4dEtleXMuaW5DaGF0SW5wdXQubmVnYXRlKCksIENoYXRDb250ZXh0S2V5cy5pblF1aWNrQ2hhdCksXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdHdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ/LmZvY3VzSW5wdXQoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGNvbnN0IG5vbkVudGVycHJpc2VDb3BpbG90VXNlcnMgPSBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsIENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhgY29uZmlnLiR7ZGVmYXVsdENoYXQuY29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmd9LmF1dGhQcm92aWRlcmAsIGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlcklkKSk7XG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5tYW5hZ2VTZXR0aW5ncycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21hbmFnZUNvcGlsb3QnLCBcIk1hbmFnZSBDb3BpbG90XCIpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLkVudGl0bGVtZW50LmxpbWl0ZWQsXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQucHJvXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRub25FbnRlcnByaXNlQ29waWxvdFVzZXJzXG5cdFx0XHRcdCksXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRUaXRsZUJhck1lbnUsXG5cdFx0XHRcdFx0Z3JvdXA6ICd5X21hbmFnZScsXG5cdFx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdFx0d2hlbjogbm9uRW50ZXJwcmlzZUNvcGlsb3RVc2Vyc1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IG9wZW5lclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpO1xuXHRcdFx0b3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZShkZWZhdWx0Q2hhdC5tYW5hZ2VTZXR0aW5nc1VybCkpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNob3dFeHRlbnNpb25zVXNpbmdDb3BpbG90IGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc2hvd0V4dGVuc2lvbnNVc2luZ0NvcGlsb3QnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93Q29waWxvdFVzYWdlRXh0ZW5zaW9ucycsIFwiU2hvdyBFeHRlbnNpb25zIHVzaW5nIENvcGlsb3RcIiksXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRjYXRlZ29yeTogRVhURU5TSU9OU19DQVRFR09SWSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDaGF0Q29udGV4dEtleXMuZW5hYmxlZFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0ZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaChgQGZlYXR1cmU6JHtDb3BpbG90VXNhZ2VFeHRlbnNpb25GZWF0dXJlSWR9YCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29uZmlndXJlQ29waWxvdENvbXBsZXRpb25zIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuY29uZmlndXJlQ29kZUNvbXBsZXRpb25zJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMignY29uZmlndXJlQ29tcGxldGlvbnMnLCBcIkNvbmZpZ3VyZSBDb2RlIENvbXBsZXRpb25zLi4uXCIpLFxuXHRcdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5TZXR1cC5pbnN0YWxsZWQsXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRUaXRsZUJhck1lbnUsXG5cdFx0XHRcdFx0Z3JvdXA6ICdmX2NvbXBsZXRpb25zJyxcblx0XHRcdFx0XHRvcmRlcjogMTAsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGRlZmF1bHRDaGF0LmNvbXBsZXRpb25zTWVudUNvbW1hbmQpO1xuXHRcdH1cblx0fSk7XG5cblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNob3dMaW1pdFJlYWNoZWREaWFsb2dBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRpZDogT1BFTl9DSEFUX1FVT1RBX0VYQ0VFREVEX0RJQUxPRyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd1cGdyYWRlQ2hhdCcsIFwiVXBncmFkZSB0byBDb3BpbG90IFByb1wiKVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRlbGVtZXRyeVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBkYXRlRm9ybWF0dGVyID0gc2FmZUludGwuRGF0ZVRpbWVGb3JtYXQobGFuZ3VhZ2UsIHsgeWVhcjogJ251bWVyaWMnLCBtb250aDogJ2xvbmcnLCBkYXk6ICdudW1lcmljJyB9KTtcblxuXHRcdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblx0XHRcdGNvbnN0IHsgY2hhdFF1b3RhRXhjZWVkZWQsIGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCB9ID0gY2hhdEVudGl0bGVtZW50U2VydmljZS5xdW90YXM7XG5cdFx0XHRpZiAoY2hhdFF1b3RhRXhjZWVkZWQgJiYgIWNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCkge1xuXHRcdFx0XHRtZXNzYWdlID0gbG9jYWxpemUoJ2NoYXRRdW90YUV4Y2VlZGVkJywgXCJZb3UndmUgcnVuIG91dCBvZiBmcmVlIGNoYXQgbWVzc2FnZXMuIFlvdSBzdGlsbCBoYXZlIGZyZWUgY29kZSBjb21wbGV0aW9ucyBhdmFpbGFibGUgaW4gdGhlIENvcGlsb3QgRnJlZSBwbGFuLiBUaGVzZSBsaW1pdHMgd2lsbCByZXNldCBvbiB7MH0uXCIsIGRhdGVGb3JtYXR0ZXIuZm9ybWF0KGNoYXRFbnRpdGxlbWVudFNlcnZpY2UucXVvdGFzLnF1b3RhUmVzZXREYXRlKSk7XG5cdFx0XHR9IGVsc2UgaWYgKGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCAmJiAhY2hhdFF1b3RhRXhjZWVkZWQpIHtcblx0XHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQnLCBcIllvdSd2ZSBydW4gb3V0IG9mIGZyZWUgY29kZSBjb21wbGV0aW9ucy4gWW91IHN0aWxsIGhhdmUgZnJlZSBjaGF0IG1lc3NhZ2VzIGF2YWlsYWJsZSBpbiB0aGUgQ29waWxvdCBGcmVlIHBsYW4uIFRoZXNlIGxpbWl0cyB3aWxsIHJlc2V0IG9uIHswfS5cIiwgZGF0ZUZvcm1hdHRlci5mb3JtYXQoY2hhdEVudGl0bGVtZW50U2VydmljZS5xdW90YXMucXVvdGFSZXNldERhdGUpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hhdEFuZENvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCcsIFwiWW91J3ZlIHJlYWNoZWQgdGhlIGxpbWl0IG9mIHRoZSBDb3BpbG90IEZyZWUgcGxhbi4gVGhlc2UgbGltaXRzIHdpbGwgcmVzZXQgb24gezB9LlwiLCBkYXRlRm9ybWF0dGVyLmZvcm1hdChjaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnF1b3Rhcy5xdW90YVJlc2V0RGF0ZSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1cGdyYWRlVG9Qcm8gPSBsb2NhbGl6ZSgndXBncmFkZVRvUHJvJywgXCJVcGdyYWRlIHRvIENvcGlsb3QgUHJvICh5b3VyIGZpcnN0IDMwIGRheXMgYXJlIGZyZWUpIGZvcjpcXG4tIFVubGltaXRlZCBjb2RlIGNvbXBsZXRpb25zXFxuLSBVbmxpbWl0ZWQgY2hhdCBtZXNzYWdlc1xcbi0gQWNjZXNzIHRvIGFkZGl0aW9uYWwgbW9kZWxzXCIpO1xuXG5cdFx0XHRhd2FpdCBkaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdHR5cGU6ICdub25lJyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvcGlsb3RGcmVlJywgXCJDb3BpbG90IExpbWl0IFJlYWNoZWRcIiksXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjoge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZGlzbWlzcycsIFwiRGlzbWlzc1wiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHsgLyogbm9vcCAqLyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJ1dHRvbnM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3VwZ3JhZGVQcm8nLCBcIlVwZ3JhZGUgdG8gQ29waWxvdCBQcm9cIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY29tbWFuZElkID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC51cGdyYWRlUGxhbic7XG5cdFx0XHRcdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBjb21tYW5kSWQsIGZyb206ICdjaGF0LWRpYWxvZycgfSk7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRJZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdFx0Y3VzdG9tOiB7XG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5jb3BpbG90V2FybmluZ0xhcmdlLFxuXHRcdFx0XHRcdG1hcmtkb3duRGV0YWlsczogW1xuXHRcdFx0XHRcdFx0eyBtYXJrZG93bjogbmV3IE1hcmtkb3duU3RyaW5nKG1lc3NhZ2UsIHRydWUpIH0sXG5cdFx0XHRcdFx0XHR7IG1hcmtkb3duOiBuZXcgTWFya2Rvd25TdHJpbmcodXBncmFkZVRvUHJvLCB0cnVlKSB9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5naWZ5SXRlbShpdGVtOiBJQ2hhdFJlcXVlc3RWaWV3TW9kZWwgfCBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCBpbmNsdWRlTmFtZSA9IHRydWUpOiBzdHJpbmcge1xuXHRpZiAoaXNSZXF1ZXN0Vk0oaXRlbSkpIHtcblx0XHRyZXR1cm4gKGluY2x1ZGVOYW1lID8gYCR7aXRlbS51c2VybmFtZX06IGAgOiAnJykgKyBpdGVtLm1lc3NhZ2VUZXh0O1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiAoaW5jbHVkZU5hbWUgPyBgJHtpdGVtLnVzZXJuYW1lfTogYCA6ICcnKSArIGl0ZW0ucmVzcG9uc2UudG9TdHJpbmcoKTtcblx0fVxufVxuXG5cbi8vIC0tLSBUaXRsZSBCYXIgQ29waWxvdCBDb250cm9sc1xuXG5jb25zdCBkZWZhdWx0Q2hhdCA9IHtcblx0ZG9jdW1lbnRhdGlvblVybDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5kb2N1bWVudGF0aW9uVXJsID8/ICcnLFxuXHRtYW5hZ2VTZXR0aW5nc1VybDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5tYW5hZ2VTZXR0aW5nc1VybCA/PyAnJyxcblx0bWFuYWdlUGxhblVybDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5tYW5hZ2VQbGFuVXJsID8/ICcnLFxuXHRlbnRlcnByaXNlUHJvdmlkZXJJZDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5lbnRlcnByaXNlUHJvdmlkZXJJZCA/PyAnJyxcblx0Y29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmc6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmcgPz8gJycsXG5cdGNvbXBsZXRpb25zTWVudUNvbW1hbmQ6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY29tcGxldGlvbnNNZW51Q29tbWFuZCA/PyAnJyxcbn07XG5cbi8vIC8vIEFkZCBuZXh0IHRvIHRoZSBjb21tYW5kIGNlbnRlciBpZiBjb21tYW5kIGNlbnRlciBpcyBkaXNhYmxlZFxuLy8gVm9pZCBjb21tZW50ZWQgdGhpcyBvdXQgd2l0aCAvKiAqLyAtIGNvcGlsb3QgaGVhZFxuLyogTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kQ2VudGVyLCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5DaGF0VGl0bGVCYXJNZW51LFxuXHR0aXRsZTogbG9jYWxpemUoJ3RpdGxlNCcsIFwiQ29waWxvdFwiKSxcblx0aWNvbjogQ29kaWNvbi5jb3BpbG90LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0Q2hhdENvbnRleHRLZXlzLnN1cHBvcnRlZCxcblx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2NvbmZpZy5jaGF0LmNvbW1hbmRDZW50ZXIuZW5hYmxlZCcpXG5cdCksXG5cdG9yZGVyOiAxMDAwMSAvLyB0byB0aGUgcmlnaHQgb2YgY29tbWFuZCBjZW50ZXJcbn0pO1xuXG4vLyBBZGQgdG8gdGhlIGdsb2JhbCB0aXRsZSBiYXIgaWYgY29tbWFuZCBjZW50ZXIgaXMgZGlzYWJsZWRcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVGl0bGVCYXIsIHtcblx0c3VibWVudTogTWVudUlkLkNoYXRUaXRsZUJhck1lbnUsXG5cdHRpdGxlOiBsb2NhbGl6ZSgndGl0bGU0JywgXCJDb3BpbG90XCIpLFxuXHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRpY29uOiBDb2RpY29uLmNvcGlsb3QsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRDaGF0Q29udGV4dEtleXMuc3VwcG9ydGVkLFxuXHRcdENvbnRleHRLZXlFeHByLmhhcygnY29uZmlnLmNoYXQuY29tbWFuZENlbnRlci5lbmFibGVkJyksXG5cdFx0Q29udGV4dEtleUV4cHIuaGFzKCdjb25maWcud2luZG93LmNvbW1hbmRDZW50ZXInKS5uZWdhdGUoKSxcblx0KSxcblx0b3JkZXI6IDFcbn0pOyAqL1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ29waWxvdENvbnRyb2wgZXh0ZW5kcyBUb2dnbGVUaXRsZUJhckNvbmZpZ0FjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFxuXHRcdFx0J2NoYXQuY29tbWFuZENlbnRlci5lbmFibGVkJyxcblx0XHRcdGxvY2FsaXplKCd0b2dnbGUuY2hhdENvbnRyb2wnLCAnQ29waWxvdCBDb250cm9scycpLFxuXHRcdFx0bG9jYWxpemUoJ3RvZ2dsZS5jaGF0Q29udHJvbHNEZXNjcmlwdGlvbicsIFwiVG9nZ2xlIHZpc2liaWxpdHkgb2YgdGhlIENvcGlsb3QgQ29udHJvbHMgaW4gdGl0bGUgYmFyXCIpLCA1LCBmYWxzZSxcblx0XHRcdENoYXRDb250ZXh0S2V5cy5zdXBwb3J0ZWRcblx0XHQpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJlc2V0VHJ1c3RlZFRvb2xzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnJlc2V0VHJ1c3RlZFRvb2xzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Jlc2V0VHJ1c3RlZFRvb2xzJywgXCJSZXNldCBUb29sIENvbmZpcm1hdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSkucmVzZXRUb29sQXV0b0NvbmZpcm1hdGlvbigpO1xuXHRcdGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSkuaW5mbyhsb2NhbGl6ZSgncmVzZXRUcnVzdGVkVG9vbHNTdWNjZXNzJywgXCJUb29sIGNvbmZpcm1hdGlvbiBwcmVmZXJlbmNlcyBoYXZlIGJlZW4gcmVzZXQuXCIpKTtcblx0fVxufSk7XG5cbmV4cG9ydCBjbGFzcyBDb3BpbG90VGl0bGVCYXJNZW51UmVuZGVyaW5nIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5jb3BpbG90VGl0bGVCYXJNZW51UmVuZGVyaW5nJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUFjdGlvblZpZXdJdGVtU2VydmljZSBhY3Rpb25WaWV3SXRlbVNlcnZpY2U6IElBY3Rpb25WaWV3SXRlbVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ2hhdEVudGl0bGVtZW50U2VydmljZSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlOiBJQ2hhdEVudGl0bGVtZW50U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYWN0aW9uVmlld0l0ZW1TZXJ2aWNlLnJlZ2lzdGVyKE1lbnVJZC5Db21tYW5kQ2VudGVyLCBNZW51SWQuQ2hhdFRpdGxlQmFyTWVudSwgKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0aWYgKCEoYWN0aW9uIGluc3RhbmNlb2YgU3VibWVudUl0ZW1BY3Rpb24pKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGRyb3Bkb3duQWN0aW9uID0gdG9BY3Rpb24oe1xuXHRcdFx0XHRpZDogJ2NvcGlsb3QudGl0bGVCYXJNZW51UmVuZGVyaW5nLm1vcmUnLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21vcmUnLCBcIk1vcmUuLi5cIiksXG5cdFx0XHRcdHJ1bigpIHsgfVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGNoYXRFeHRlbnNpb25JbnN0YWxsZWQgPSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnNlbnRpbWVudCA9PT0gQ2hhdFNlbnRpbWVudC5JbnN0YWxsZWQ7XG5cdFx0XHRjb25zdCBjaGF0SGlkZGVuID0gY2hhdEVudGl0bGVtZW50U2VydmljZS5zZW50aW1lbnQgPT09IENoYXRTZW50aW1lbnQuRGlzYWJsZWQ7XG5cdFx0XHRjb25zdCB7IGNoYXRRdW90YUV4Y2VlZGVkLCBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQgfSA9IGNoYXRFbnRpdGxlbWVudFNlcnZpY2UucXVvdGFzO1xuXHRcdFx0Y29uc3Qgc2lnbmVkT3V0ID0gY2hhdEVudGl0bGVtZW50U2VydmljZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LlVua25vd247XG5cdFx0XHRjb25zdCBzZXR1cEZyb21EaWFsb2cgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5zZXR1cEZyb21EaWFsb2cnKTtcblxuXHRcdFx0bGV0IHByaW1hcnlBY3Rpb25JZCA9IFRPR0dMRV9DSEFUX0FDVElPTl9JRDtcblx0XHRcdGxldCBwcmltYXJ5QWN0aW9uVGl0bGUgPSBsb2NhbGl6ZSgndG9nZ2xlQ2hhdCcsIFwiVG9nZ2xlIENoYXRcIik7XG5cdFx0XHRsZXQgcHJpbWFyeUFjdGlvbkljb24gPSBDb2RpY29uLmNvcGlsb3Q7XG5cdFx0XHRpZiAoIWNoYXRFeHRlbnNpb25JbnN0YWxsZWQgJiYgKCFzZXR1cEZyb21EaWFsb2cgfHwgY2hhdEhpZGRlbikpIHtcblx0XHRcdFx0cHJpbWFyeUFjdGlvbklkID0gQ0hBVF9TRVRVUF9BQ1RJT05fSUQ7XG5cdFx0XHRcdHByaW1hcnlBY3Rpb25UaXRsZSA9IGxvY2FsaXplKCd0cmlnZ2VyQ2hhdFNldHVwJywgXCJVc2UgQUkgRmVhdHVyZXMgd2l0aCBDb3BpbG90IGZvciBmcmVlLi4uXCIpO1xuXHRcdFx0fSBlbHNlIGlmIChjaGF0RXh0ZW5zaW9uSW5zdGFsbGVkICYmIHNpZ25lZE91dCkge1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9uSWQgPSBzZXR1cEZyb21EaWFsb2cgPyBDSEFUX1NFVFVQX0FDVElPTl9JRCA6IFRPR0dMRV9DSEFUX0FDVElPTl9JRDtcblx0XHRcdFx0cHJpbWFyeUFjdGlvblRpdGxlID0gbG9jYWxpemUoJ3NpZ25JblRvQ2hhdFNldHVwJywgXCJTaWduIGluIHRvIHVzZSBDb3BpbG90Li4uXCIpO1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9uSWNvbiA9IENvZGljb24uY29waWxvdE5vdENvbm5lY3RlZDtcblx0XHRcdH0gZWxzZSBpZiAoY2hhdEV4dGVuc2lvbkluc3RhbGxlZCAmJiAoY2hhdFF1b3RhRXhjZWVkZWQgfHwgY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkKSkge1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9uSWQgPSBPUEVOX0NIQVRfUVVPVEFfRVhDRUVERURfRElBTE9HO1xuXHRcdFx0XHRpZiAoY2hhdFF1b3RhRXhjZWVkZWQgJiYgIWNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCkge1xuXHRcdFx0XHRcdHByaW1hcnlBY3Rpb25UaXRsZSA9IGxvY2FsaXplKCdjaGF0UXVvdGFFeGNlZWRlZEJ1dHRvbicsIFwiTW9udGhseSBjaGF0IG1lc3NhZ2VzIGxpbWl0IHJlYWNoZWQuIENsaWNrIGZvciBkZXRhaWxzLlwiKTtcblx0XHRcdFx0fSBlbHNlIGlmIChjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQgJiYgIWNoYXRRdW90YUV4Y2VlZGVkKSB7XG5cdFx0XHRcdFx0cHJpbWFyeUFjdGlvblRpdGxlID0gbG9jYWxpemUoJ2NvbXBsZXRpb25zUXVvdGFFeGNlZWRlZEJ1dHRvbicsIFwiTW9udGhseSBjb2RlIGNvbXBsZXRpb25zIGxpbWl0IHJlYWNoZWQuIENsaWNrIGZvciBkZXRhaWxzLlwiKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcmltYXJ5QWN0aW9uVGl0bGUgPSBsb2NhbGl6ZSgnY2hhdEFuZENvbXBsZXRpb25zUXVvdGFFeGNlZWRlZEJ1dHRvbicsIFwiQ29waWxvdCBGcmVlIHBsYW4gbGltaXQgcmVhY2hlZC4gQ2xpY2sgZm9yIGRldGFpbHMuXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByaW1hcnlBY3Rpb25JY29uID0gQ29kaWNvbi5jb3BpbG90V2FybmluZztcblx0XHRcdH1cblx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0sIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVJdGVtQWN0aW9uLCB7XG5cdFx0XHRcdGlkOiBwcmltYXJ5QWN0aW9uSWQsXG5cdFx0XHRcdHRpdGxlOiBwcmltYXJ5QWN0aW9uVGl0bGUsXG5cdFx0XHRcdGljb246IHByaW1hcnlBY3Rpb25JY29uLFxuXHRcdFx0fSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSwgZHJvcGRvd25BY3Rpb24sIGFjdGlvbi5hY3Rpb25zLCAnJywgeyAuLi5vcHRpb25zLCBza2lwVGVsZW1ldHJ5OiB0cnVlIH0pO1xuXHRcdH0sIEV2ZW50LmFueShcblx0XHRcdGNoYXRFbnRpdGxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VTZW50aW1lbnQsXG5cdFx0XHRjaGF0RW50aXRsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlUXVvdGFFeGNlZWRlZCxcblx0XHRcdGNoYXRFbnRpdGxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VFbnRpdGxlbWVudCxcblx0XHRcdEV2ZW50LmZpbHRlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignY2hhdC5zZXR1cEZyb21EaWFsb2cnKSlcblx0XHQpKTtcblxuXHRcdC8vIFJlZHVjZXMgZmxpY2tlciBhIGJpdCBvbiByZWxvYWQvcmVzdGFydFxuXHRcdG1hcmtBc1NpbmdsZXRvbihkaXNwb3NhYmxlKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWRpdHNWaWV3SWQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBzdHJpbmcge1xuXHRjb25zdCBjaGF0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFNlcnZpY2UpO1xuXHRyZXR1cm4gY2hhdFNlcnZpY2UudW5pZmllZFZpZXdFbmFibGVkID8gQ2hhdFZpZXdJZCA6IEVkaXRzVmlld0lkO1xufVxuXG4vKipcbiAqIFJldHVybnMgd2hldGhlciB3ZSBjYW4gY29udGludWUgY2xlYXJpbmcvc3dpdGNoaW5nIGNoYXQgc2Vzc2lvbnMsIGZhbHNlIHRvIGNhbmNlbC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZUN1cnJlbnRFZGl0aW5nU2Vzc2lvbihjdXJyZW50RWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIHBocmFzZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRpZiAoc2hvdWxkU2hvd0NsZWFyRWRpdGluZ1Nlc3Npb25Db25maXJtYXRpb24oY3VycmVudEVkaXRpbmdTZXNzaW9uKSkge1xuXHRcdHJldHVybiBzaG93Q2xlYXJFZGl0aW5nU2Vzc2lvbkNvbmZpcm1hdGlvbihjdXJyZW50RWRpdGluZ1Nlc3Npb24sIGRpYWxvZ1NlcnZpY2UsIHsgbWVzc2FnZU92ZXJyaWRlOiBwaHJhc2UgfSk7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2xlYXJFZGl0aW5nU2Vzc2lvbkNvbmZpcm1hdGlvbk9wdGlvbnMge1xuXHR0aXRsZU92ZXJyaWRlPzogc3RyaW5nO1xuXHRtZXNzYWdlT3ZlcnJpZGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaG93Q2xlYXJFZGl0aW5nU2Vzc2lvbkNvbmZpcm1hdGlvbihlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsIG9wdGlvbnM/OiBJQ2xlYXJFZGl0aW5nU2Vzc2lvbkNvbmZpcm1hdGlvbk9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0Y29uc3QgZGVmYXVsdFBocmFzZSA9IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5jb25maXJtYXRpb24ucGVuZGluZy5tZXNzYWdlLmRlZmF1bHQnLCBcIlN0YXJ0aW5nIGEgbmV3IGNoYXQgd2lsbCBlbmQgeW91ciBjdXJyZW50IGVkaXQgc2Vzc2lvbi5cIik7XG5cdGNvbnN0IGRlZmF1bHRUaXRsZSA9IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5jb25maXJtYXRpb24udGl0bGUnLCBcIlN0YXJ0IG5ldyBjaGF0P1wiKTtcblx0Y29uc3QgcGhyYXNlID0gb3B0aW9ucz8ubWVzc2FnZU92ZXJyaWRlID8/IGRlZmF1bHRQaHJhc2U7XG5cdGNvbnN0IHRpdGxlID0gb3B0aW9ucz8udGl0bGVPdmVycmlkZSA/PyBkZWZhdWx0VGl0bGU7XG5cblx0Y29uc3QgY3VycmVudEVkaXRzID0gZWRpdGluZ1Nlc3Npb24uZW50cmllcy5nZXQoKTtcblx0Y29uc3QgdW5kZWNpZGVkRWRpdHMgPSBjdXJyZW50RWRpdHMuZmlsdGVyKChlZGl0KSA9PiBlZGl0LnN0YXRlLmdldCgpID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCk7XG5cblx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IGRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHR0aXRsZSxcblx0XHRtZXNzYWdlOiBwaHJhc2UgKyAnICcgKyBsb2NhbGl6ZSgnY2hhdC5zdGFydEVkaXRpbmcuY29uZmlybWF0aW9uLnBlbmRpbmcubWVzc2FnZS4yJywgXCJEbyB5b3Ugd2FudCB0byBrZWVwIHBlbmRpbmcgZWRpdHMgdG8gezB9IGZpbGVzP1wiLCB1bmRlY2lkZWRFZGl0cy5sZW5ndGgpLFxuXHRcdHR5cGU6ICdpbmZvJyxcblx0XHRjYW5jZWxCdXR0b246IHRydWUsXG5cdFx0YnV0dG9uczogW1xuXHRcdFx0e1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXQuc3RhcnRFZGl0aW5nLmNvbmZpcm1hdGlvbi5hY2NlcHRFZGl0cycsIFwiS2VlcCAmIENvbnRpbnVlXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCBlZGl0aW5nU2Vzc2lvbi5hY2NlcHQoKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjaGF0LnN0YXJ0RWRpdGluZy5jb25maXJtYXRpb24uZGlzY2FyZEVkaXRzJywgXCJVbmRvICYgQ29udGludWVcIiksXG5cdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGF3YWl0IGVkaXRpbmdTZXNzaW9uLnJlamVjdCgpO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XSxcblx0fSk7XG5cblx0cmV0dXJuIEJvb2xlYW4ocmVzdWx0KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZFNob3dDbGVhckVkaXRpbmdTZXNzaW9uQ29uZmlybWF0aW9uKGVkaXRpbmdTZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uKTogYm9vbGVhbiB7XG5cdGNvbnN0IGN1cnJlbnRFZGl0cyA9IGVkaXRpbmdTZXNzaW9uLmVudHJpZXMuZ2V0KCk7XG5cdGNvbnN0IGN1cnJlbnRFZGl0Q291bnQgPSBjdXJyZW50RWRpdHMubGVuZ3RoO1xuXG5cdGlmIChjdXJyZW50RWRpdENvdW50KSB7XG5cdFx0Y29uc3QgdW5kZWNpZGVkRWRpdHMgPSBjdXJyZW50RWRpdHMuZmlsdGVyKChlZGl0KSA9PiBlZGl0LnN0YXRlLmdldCgpID09PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCk7XG5cdFx0cmV0dXJuICEhdW5kZWNpZGVkRWRpdHMubGVuZ3RoO1xuXHR9XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFxRjtBQUM5RixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjLGdCQUFnQjtBQUN2QyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxZQUFZLGlCQUFpQix1QkFBdUI7QUFDN0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBRXBCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxTQUFTLFFBQVEsZ0JBQWdCLGlCQUFpQix5QkFBeUI7QUFDcEYsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0Isd0JBQXdCO0FBQ2pELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStD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QzFLLE1BQUksMENBQTBDLHFCQUFxQixHQUFHO0FBQ3JFLFdBQU8sb0NBQW9DLHVCQUF1QixlQUFlLEVBQUUsaUJBQWlCLE9BQU8sQ0FBQztBQUFBLEVBQzdHO0FBRUEsU0FBTztBQUNSO0FBT0EsZUFBc0Isb0NBQW9DLGdCQUFxQyxlQUErQixTQUFxRTtBQUNsTSxRQUFNLGdCQUFnQixTQUFTLDBEQUEwRCx5REFBeUQ7QUFDbEosUUFBTSxlQUFlLFNBQVMsd0NBQXdDLGlCQUFpQjtBQUN2RixRQUFNLFNBQVMsU0FBUyxtQkFBbUI7QUFDM0MsUUFBTSxRQUFRLFNBQVMsaUJBQWlCO0FBRXhDLFFBQU0sZUFBZSxlQUFlLFFBQVEsSUFBSTtBQUNoRCxRQUFNLGlCQUFpQixhQUFhLE9BQU8sQ0FBQyxTQUFTLEtBQUssTUFBTSxJQUFJLE1BQU0scUJBQXFCLFFBQVE7QUFFdkcsUUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNLGNBQWMsT0FBTztBQUFBLElBQzdDO0FBQUEsSUFDQSxTQUFTLFNBQVMsTUFBTSxTQUFTLG9EQUFvRCxtREFBbUQsZUFBZSxNQUFNO0FBQUEsSUFDN0osTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsU0FBUztBQUFBLE1BQ1I7QUFBQSxRQUNDLE9BQU8sU0FBUyw4Q0FBOEMsaUJBQWlCO0FBQUEsUUFDL0UsS0FBSyxZQUFZO0FBQ2hCLGdCQUFNLGVBQWUsT0FBTztBQUM1QixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsT0FBTyxTQUFTLCtDQUErQyxpQkFBaUI7QUFBQSxRQUNoRixLQUFLLFlBQVk7QUFDaEIsZ0JBQU0sZUFBZSxPQUFPO0FBQzVCLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsU0FBTyxRQUFRLE1BQU07QUFDdEI7QUFFTyxTQUFTLDBDQUEwQyxnQkFBOEM7QUFDdkcsUUFBTSxlQUFlLGVBQWUsUUFBUSxJQUFJO0FBQ2hELFFBQU0sbUJBQW1CLGFBQWE7QUFFdEMsTUFBSSxrQkFBa0I7QUFDckIsVUFBTSxpQkFBaUIsYUFBYSxPQUFPLENBQUMsU0FBUyxLQUFLLE1BQU0sSUFBSSxNQUFNLHFCQUFxQixRQUFRO0FBQ3ZHLFdBQU8sQ0FBQyxDQUFDLGVBQWU7QUFBQSxFQUN6QjtBQUVBLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsicGlja3MiXQp9Cg==
