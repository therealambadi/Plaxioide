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
import "./media/voiceChatActions.css";
import { RunOnceScheduler, disposableTimeout, raceCancellation } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Event } from "../../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { isNumber } from "../../../../../base/common/types.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { Extensions } from "../../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ProgressLocation } from "../../../../../platform/progress/common/progress.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { contrastBorder, focusBorder } from "../../../../../platform/theme/common/colorRegistry.js";
import { spinningLoading, syncing } from "../../../../../platform/theme/common/iconRegistry.js";
import { ColorScheme } from "../../../../../platform/theme/common/theme.js";
import { registerThemingParticipant } from "../../../../../platform/theme/common/themeService.js";
import { ActiveEditorContext } from "../../../../common/contextkeys.js";
import { ACTIVITY_BAR_BADGE_BACKGROUND } from "../../../../common/theme.js";
import { AccessibilityVoiceSettingId, SpeechTimeoutDefault, accessibilityConfigurationNodeBase } from "../../../accessibility/browser/accessibilityConfiguration.js";
import { CHAT_CATEGORY } from "../../browser/actions/chatActions.js";
import { IChatWidgetService, IQuickChatService, showChatView } from "../../browser/chat.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { KEYWORD_ACTIVIATION_SETTING_ID } from "../../common/chatService.js";
import { ChatResponseViewModel, isResponseVM } from "../../common/chatViewModel.js";
import { IVoiceChatService, VoiceChatInProgress as GlobalVoiceChatInProgress } from "../../common/voiceChatService.js";
import { IExtensionsWorkbenchService } from "../../../extensions/common/extensions.js";
import { InlineChatController } from "../../../inlineChat/browser/inlineChatController.js";
import { CTX_INLINE_CHAT_FOCUSED, MENU_INLINE_CHAT_WIDGET_SECONDARY } from "../../../inlineChat/common/inlineChat.js";
import { NOTEBOOK_EDITOR_FOCUSED } from "../../../notebook/common/notebookContextKeys.js";
import { HasSpeechProvider, ISpeechService, KeywordRecognitionStatus, SpeechToTextInProgress, SpeechToTextStatus, TextToSpeechStatus, TextToSpeechInProgress as GlobalTextToSpeechInProgress } from "../../../speech/common/speechService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../../services/layout/browser/layoutService.js";
import { IStatusbarService, StatusbarAlignment } from "../../../../services/statusbar/browser/statusbar.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { IAccessibilityService } from "../../../../../platform/accessibility/common/accessibility.js";
import { renderStringAsPlaintext } from "../../../../../base/browser/markdownRenderer.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { SearchContext } from "../../../search/common/constants.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../../../base/common/severity.js";
import { isCancellationError } from "../../../../../base/common/errors.js";
import { toErrorMessage } from "../../../../../base/common/errorMessage.js";
const VoiceChatSessionContexts = ["view", "inline", "quick", "editor"];
const CanVoiceChat = ContextKeyExpr.and(ChatContextKeys.enabled, HasSpeechProvider);
const FocusInChatInput = ContextKeyExpr.or(CTX_INLINE_CHAT_FOCUSED, ChatContextKeys.inChatInput);
const AnyChatRequestInProgress = ChatContextKeys.requestInProgress;
const ScopedVoiceChatGettingReady = new RawContextKey("scopedVoiceChatGettingReady", false, { type: "boolean", description: localize("scopedVoiceChatGettingReady", "True when getting ready for receiving voice input from the microphone for voice chat. This key is only defined scoped, per chat context.") });
const ScopedVoiceChatInProgress = new RawContextKey("scopedVoiceChatInProgress", void 0, { type: "string", description: localize("scopedVoiceChatInProgress", "Defined as a location where voice recording from microphone is in progress for voice chat. This key is only defined scoped, per chat context.") });
const AnyScopedVoiceChatInProgress = ContextKeyExpr.or(...VoiceChatSessionContexts.map((context) => ScopedVoiceChatInProgress.isEqualTo(context)));
var VoiceChatSessionState = /* @__PURE__ */ ((VoiceChatSessionState2) => {
  VoiceChatSessionState2[VoiceChatSessionState2["Stopped"] = 1] = "Stopped";
  VoiceChatSessionState2[VoiceChatSessionState2["GettingReady"] = 2] = "GettingReady";
  VoiceChatSessionState2[VoiceChatSessionState2["Started"] = 3] = "Started";
  return VoiceChatSessionState2;
})(VoiceChatSessionState || {});
class VoiceChatSessionControllerFactory {
  static async create(accessor, context) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const quickChatService = accessor.get(IQuickChatService);
    const layoutService = accessor.get(IWorkbenchLayoutService);
    const editorService = accessor.get(IEditorService);
    const viewsService = accessor.get(IViewsService);
    switch (context) {
      case "focused": {
        const controller = VoiceChatSessionControllerFactory.doCreateForFocusedChat(chatWidgetService, layoutService);
        return controller ?? VoiceChatSessionControllerFactory.create(accessor, "view");
      }
      case "view": {
        const chatWidget = await showChatView(viewsService);
        if (chatWidget) {
          return VoiceChatSessionControllerFactory.doCreateForChatWidget("view", chatWidget);
        }
        break;
      }
      case "inline": {
        const activeCodeEditor = getCodeEditor(editorService.activeTextEditorControl);
        if (activeCodeEditor) {
          const inlineChat = InlineChatController.get(activeCodeEditor);
          if (inlineChat) {
            if (!inlineChat.isActive) {
              inlineChat.run();
            }
            return VoiceChatSessionControllerFactory.doCreateForChatWidget("inline", inlineChat.widget.chatWidget);
          }
        }
        break;
      }
      case "quick": {
        quickChatService.open();
        return VoiceChatSessionControllerFactory.create(accessor, "focused");
      }
    }
    return void 0;
  }
  static doCreateForFocusedChat(chatWidgetService, layoutService) {
    const chatWidget = chatWidgetService.lastFocusedWidget;
    if (chatWidget?.hasInputFocus()) {
      let context;
      if (layoutService.hasFocus(Parts.EDITOR_PART)) {
        context = chatWidget.location === ChatAgentLocation.Panel ? "editor" : "inline";
      } else if ([Parts.SIDEBAR_PART, Parts.PANEL_PART, Parts.AUXILIARYBAR_PART, Parts.TITLEBAR_PART, Parts.STATUSBAR_PART, Parts.BANNER_PART, Parts.ACTIVITYBAR_PART].some((part) => layoutService.hasFocus(part))) {
        context = "view";
      } else {
        context = "quick";
      }
      return VoiceChatSessionControllerFactory.doCreateForChatWidget(context, chatWidget);
    }
    return void 0;
  }
  static createChatContextKeyController(contextKeyService, context) {
    const contextVoiceChatGettingReady = ScopedVoiceChatGettingReady.bindTo(contextKeyService);
    const contextVoiceChatInProgress = ScopedVoiceChatInProgress.bindTo(contextKeyService);
    return (state) => {
      switch (state) {
        case 2 /* GettingReady */:
          contextVoiceChatGettingReady.set(true);
          contextVoiceChatInProgress.reset();
          break;
        case 3 /* Started */:
          contextVoiceChatGettingReady.reset();
          contextVoiceChatInProgress.set(context);
          break;
        case 1 /* Stopped */:
          contextVoiceChatGettingReady.reset();
          contextVoiceChatInProgress.reset();
          break;
      }
    };
  }
  static doCreateForChatWidget(context, chatWidget) {
    return {
      context,
      scopedContextKeyService: chatWidget.scopedContextKeyService,
      onDidAcceptInput: chatWidget.onDidAcceptInput,
      onDidHideInput: chatWidget.onDidHide,
      focusInput: () => chatWidget.focusInput(),
      acceptInput: () => chatWidget.acceptInput(void 0, { isVoiceInput: true }),
      updateInput: (text) => chatWidget.setInput(text),
      getInput: () => chatWidget.getInput(),
      setInputPlaceholder: (text) => chatWidget.setInputPlaceholder(text),
      clearInputPlaceholder: () => chatWidget.resetInputPlaceholder(),
      updateState: VoiceChatSessionControllerFactory.createChatContextKeyController(chatWidget.scopedContextKeyService, context)
    };
  }
}
let VoiceChatSessions = class {
  constructor(voiceChatService, configurationService, instantiationService, accessibilityService) {
    this.voiceChatService = voiceChatService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.accessibilityService = accessibilityService;
    this.currentVoiceChatSession = void 0;
    this.voiceChatSessionIds = 0;
  }
  static getInstance(instantiationService) {
    if (!VoiceChatSessions.instance) {
      VoiceChatSessions.instance = instantiationService.createInstance(VoiceChatSessions);
    }
    return VoiceChatSessions.instance;
  }
  async start(controller, context) {
    this.stop();
    ChatSynthesizerSessions.getInstance(this.instantiationService).stop();
    let disableTimeout = false;
    const sessionId = ++this.voiceChatSessionIds;
    const session = this.currentVoiceChatSession = {
      id: sessionId,
      controller,
      hasRecognizedInput: false,
      disposables: new DisposableStore(),
      setTimeoutDisabled: (disabled) => {
        disableTimeout = disabled;
      },
      accept: () => this.accept(sessionId),
      stop: () => this.stop(sessionId, controller.context)
    };
    const cts = new CancellationTokenSource();
    session.disposables.add(toDisposable(() => cts.dispose(true)));
    session.disposables.add(controller.onDidAcceptInput(() => this.stop(sessionId, controller.context)));
    session.disposables.add(controller.onDidHideInput(() => this.stop(sessionId, controller.context)));
    controller.focusInput();
    controller.updateState(2 /* GettingReady */);
    const voiceChatSession = await this.voiceChatService.createVoiceChatSession(cts.token, { usesAgents: controller.context !== "inline", model: context?.widget?.viewModel?.model });
    let inputValue = controller.getInput();
    let voiceChatTimeout = this.configurationService.getValue(AccessibilityVoiceSettingId.SpeechTimeout);
    if (!isNumber(voiceChatTimeout) || voiceChatTimeout < 0) {
      voiceChatTimeout = SpeechTimeoutDefault;
    }
    const acceptTranscriptionScheduler = session.disposables.add(new RunOnceScheduler(() => this.accept(sessionId), voiceChatTimeout));
    session.disposables.add(voiceChatSession.onDidChange(({ status, text, waitingForInput }) => {
      if (cts.token.isCancellationRequested) {
        return;
      }
      switch (status) {
        case SpeechToTextStatus.Started:
          this.onDidSpeechToTextSessionStart(controller, session.disposables);
          break;
        case SpeechToTextStatus.Recognizing:
          if (text) {
            session.hasRecognizedInput = true;
            session.controller.updateInput(inputValue ? [inputValue, text].join(" ") : text);
            if (voiceChatTimeout > 0 && context?.voice?.disableTimeout !== true && !disableTimeout) {
              acceptTranscriptionScheduler.cancel();
            }
          }
          break;
        case SpeechToTextStatus.Recognized:
          if (text) {
            session.hasRecognizedInput = true;
            inputValue = inputValue ? [inputValue, text].join(" ") : text;
            session.controller.updateInput(inputValue);
            if (voiceChatTimeout > 0 && context?.voice?.disableTimeout !== true && !waitingForInput && !disableTimeout) {
              acceptTranscriptionScheduler.schedule();
            }
          }
          break;
        case SpeechToTextStatus.Stopped:
          this.stop(session.id, controller.context);
          break;
      }
    }));
    return session;
  }
  onDidSpeechToTextSessionStart(controller, disposables) {
    controller.updateState(3 /* Started */);
    let dotCount = 0;
    const updatePlaceholder = () => {
      dotCount = (dotCount + 1) % 4;
      controller.setInputPlaceholder(`${localize("listening", "I'm listening")}${".".repeat(dotCount)}`);
      placeholderScheduler.schedule();
    };
    const placeholderScheduler = disposables.add(new RunOnceScheduler(updatePlaceholder, 500));
    updatePlaceholder();
  }
  stop(voiceChatSessionId = this.voiceChatSessionIds, context) {
    if (!this.currentVoiceChatSession || this.voiceChatSessionIds !== voiceChatSessionId || context && this.currentVoiceChatSession.controller.context !== context) {
      return;
    }
    this.currentVoiceChatSession.controller.clearInputPlaceholder();
    this.currentVoiceChatSession.controller.updateState(1 /* Stopped */);
    this.currentVoiceChatSession.disposables.dispose();
    this.currentVoiceChatSession = void 0;
  }
  async accept(voiceChatSessionId = this.voiceChatSessionIds) {
    if (!this.currentVoiceChatSession || this.voiceChatSessionIds !== voiceChatSessionId) {
      return;
    }
    if (!this.currentVoiceChatSession.hasRecognizedInput) {
      this.stop(voiceChatSessionId, this.currentVoiceChatSession.controller.context);
      return;
    }
    const controller = this.currentVoiceChatSession.controller;
    const response = await controller.acceptInput();
    if (!response) {
      return;
    }
    const autoSynthesize = this.configurationService.getValue(AccessibilityVoiceSettingId.AutoSynthesize);
    if (autoSynthesize === "on" || autoSynthesize !== "off" && !this.accessibilityService.isScreenReaderOptimized()) {
      let context;
      if (controller.context === "inline") {
        context = "focused";
      } else {
        context = controller;
      }
      ChatSynthesizerSessions.getInstance(this.instantiationService).start(this.instantiationService.invokeFunction((accessor) => ChatSynthesizerSessionController.create(accessor, context, response)));
    }
  }
};
VoiceChatSessions.instance = void 0;
VoiceChatSessions = __decorateClass([
  __decorateParam(0, IVoiceChatService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IAccessibilityService)
], VoiceChatSessions);
const VOICE_KEY_HOLD_THRESHOLD = 500;
async function startVoiceChatWithHoldMode(id, accessor, target, context) {
  const instantiationService = accessor.get(IInstantiationService);
  const keybindingService = accessor.get(IKeybindingService);
  const holdMode = keybindingService.enableKeybindingHoldMode(id);
  const controller = await VoiceChatSessionControllerFactory.create(accessor, target);
  if (!controller) {
    return;
  }
  const session = await VoiceChatSessions.getInstance(instantiationService).start(controller, context);
  let acceptVoice = false;
  const handle = disposableTimeout(() => {
    acceptVoice = true;
    session?.setTimeoutDisabled(true);
  }, VOICE_KEY_HOLD_THRESHOLD);
  await holdMode;
  handle.dispose();
  if (acceptVoice) {
    session.accept();
  }
}
class VoiceChatWithHoldModeAction extends Action2 {
  constructor(desc, target) {
    super(desc);
    this.target = target;
  }
  run(accessor, context) {
    return startVoiceChatWithHoldMode(this.desc.id, accessor, this.target, context);
  }
}
const _VoiceChatInChatViewAction = class _VoiceChatInChatViewAction extends VoiceChatWithHoldModeAction {
  constructor() {
    super({
      id: _VoiceChatInChatViewAction.ID,
      title: localize2("workbench.action.chat.voiceChatInView.label", "Voice Chat in Chat View"),
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(
        CanVoiceChat,
        ChatContextKeys.requestInProgress.negate()
        // disable when a chat request is in progress
      ),
      f1: true
    }, "view");
  }
};
_VoiceChatInChatViewAction.ID = "workbench.action.chat.voiceChatInChatView";
let VoiceChatInChatViewAction = _VoiceChatInChatViewAction;
const _HoldToVoiceChatInChatViewAction = class _HoldToVoiceChatInChatViewAction extends Action2 {
  constructor() {
    super({
      id: _HoldToVoiceChatInChatViewAction.ID,
      title: localize2("workbench.action.chat.holdToVoiceChatInChatView.label", "Hold to Voice Chat in Chat View"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          CanVoiceChat,
          ChatContextKeys.requestInProgress.negate(),
          // disable when a chat request is in progress
          FocusInChatInput?.negate(),
          // when already in chat input, disable this action and prefer to start voice chat directly
          EditorContextKeys.focus.negate(),
          // do not steal the inline-chat keybinding
          NOTEBOOK_EDITOR_FOCUSED.negate(),
          // do not steal the notebook keybinding
          SearchContext.SearchViewFocusedKey.negate()
          // do not steal the search keybinding
        ),
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      }
    });
  }
  async run(accessor, context) {
    const instantiationService = accessor.get(IInstantiationService);
    const keybindingService = accessor.get(IKeybindingService);
    const viewsService = accessor.get(IViewsService);
    const holdMode = keybindingService.enableKeybindingHoldMode(_HoldToVoiceChatInChatViewAction.ID);
    let session;
    const handle = disposableTimeout(async () => {
      const controller = await VoiceChatSessionControllerFactory.create(accessor, "view");
      if (controller) {
        session = await VoiceChatSessions.getInstance(instantiationService).start(controller, context);
        session.setTimeoutDisabled(true);
      }
    }, VOICE_KEY_HOLD_THRESHOLD);
    (await showChatView(viewsService))?.focusInput();
    await holdMode;
    handle.dispose();
    if (session) {
      session.accept();
    }
  }
};
_HoldToVoiceChatInChatViewAction.ID = "workbench.action.chat.holdToVoiceChatInChatView";
let HoldToVoiceChatInChatViewAction = _HoldToVoiceChatInChatViewAction;
const _InlineVoiceChatAction = class _InlineVoiceChatAction extends VoiceChatWithHoldModeAction {
  constructor() {
    super({
      id: _InlineVoiceChatAction.ID,
      title: localize2("workbench.action.chat.inlineVoiceChat", "Inline Voice Chat"),
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(
        CanVoiceChat,
        ActiveEditorContext,
        ChatContextKeys.requestInProgress.negate()
        // disable when a chat request is in progress
      ),
      f1: true
    }, "inline");
  }
};
_InlineVoiceChatAction.ID = "workbench.action.chat.inlineVoiceChat";
let InlineVoiceChatAction = _InlineVoiceChatAction;
const _QuickVoiceChatAction = class _QuickVoiceChatAction extends VoiceChatWithHoldModeAction {
  constructor() {
    super({
      id: _QuickVoiceChatAction.ID,
      title: localize2("workbench.action.chat.quickVoiceChat.label", "Quick Voice Chat"),
      category: CHAT_CATEGORY,
      precondition: ContextKeyExpr.and(
        CanVoiceChat,
        ChatContextKeys.requestInProgress.negate()
        // disable when a chat request is in progress
      ),
      f1: true
    }, "quick");
  }
};
_QuickVoiceChatAction.ID = "workbench.action.chat.quickVoiceChat";
let QuickVoiceChatAction = _QuickVoiceChatAction;
const primaryVoiceActionMenu = (when) => {
  return [
    {
      id: MenuId.ChatInput,
      when: ContextKeyExpr.and(ContextKeyExpr.or(ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel), ChatContextKeys.location.isEqualTo(ChatAgentLocation.EditingSession)), when),
      group: "navigation",
      order: 3
    },
    {
      id: MenuId.ChatExecute,
      when: ContextKeyExpr.and(ChatContextKeys.location.isEqualTo(ChatAgentLocation.Panel).negate(), ChatContextKeys.location.isEqualTo(ChatAgentLocation.EditingSession).negate(), when),
      group: "navigation",
      order: 2
    }
  ];
};
const _StartVoiceChatAction = class _StartVoiceChatAction extends Action2 {
  constructor() {
    super({
      id: _StartVoiceChatAction.ID,
      title: localize2("workbench.action.chat.startVoiceChat.label", "Start Voice Chat"),
      category: CHAT_CATEGORY,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          FocusInChatInput,
          // scope this action to chat input fields only
          EditorContextKeys.focus.negate(),
          // do not steal the editor inline-chat keybinding
          NOTEBOOK_EDITOR_FOCUSED.negate()
          // do not steal the notebook inline-chat keybinding
        ),
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      },
      icon: Codicon.mic,
      precondition: ContextKeyExpr.and(
        CanVoiceChat,
        ScopedVoiceChatGettingReady.negate(),
        // disable when voice chat is getting ready
        AnyChatRequestInProgress?.negate(),
        // disable when any chat request is in progress
        SpeechToTextInProgress.negate()
        // disable when speech to text is in progress
      ),
      menu: primaryVoiceActionMenu(ContextKeyExpr.and(
        HasSpeechProvider,
        ScopedChatSynthesisInProgress.negate(),
        // hide when text to speech is in progress
        AnyScopedVoiceChatInProgress?.negate()
        // hide when voice chat is in progress
      ))
    });
  }
  async run(accessor, context) {
    const widget = context?.widget;
    if (widget) {
      widget.focusInput();
    }
    return startVoiceChatWithHoldMode(this.desc.id, accessor, "focused", context);
  }
};
_StartVoiceChatAction.ID = "workbench.action.chat.startVoiceChat";
let StartVoiceChatAction = _StartVoiceChatAction;
const _StopListeningAction = class _StopListeningAction extends Action2 {
  constructor() {
    super({
      id: _StopListeningAction.ID,
      title: localize2("workbench.action.chat.stopListening.label", "Stop Listening"),
      category: CHAT_CATEGORY,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 100,
        primary: KeyCode.Escape,
        when: AnyScopedVoiceChatInProgress
      },
      icon: spinningLoading,
      precondition: GlobalVoiceChatInProgress,
      // need global context here because of `f1: true`
      menu: primaryVoiceActionMenu(AnyScopedVoiceChatInProgress)
    });
  }
  async run(accessor) {
    VoiceChatSessions.getInstance(accessor.get(IInstantiationService)).stop();
  }
};
_StopListeningAction.ID = "workbench.action.chat.stopListening";
let StopListeningAction = _StopListeningAction;
const _StopListeningAndSubmitAction = class _StopListeningAndSubmitAction extends Action2 {
  constructor() {
    super({
      id: _StopListeningAndSubmitAction.ID,
      title: localize2("workbench.action.chat.stopListeningAndSubmit.label", "Stop Listening and Submit"),
      category: CHAT_CATEGORY,
      f1: true,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          FocusInChatInput,
          AnyScopedVoiceChatInProgress
        ),
        primary: KeyMod.CtrlCmd | KeyCode.KeyI
      },
      precondition: GlobalVoiceChatInProgress
      // need global context here because of `f1: true`
    });
  }
  run(accessor) {
    VoiceChatSessions.getInstance(accessor.get(IInstantiationService)).accept();
  }
};
_StopListeningAndSubmitAction.ID = "workbench.action.chat.stopListeningAndSubmit";
let StopListeningAndSubmitAction = _StopListeningAndSubmitAction;
const ScopedChatSynthesisInProgress = new RawContextKey("scopedChatSynthesisInProgress", false, { type: "boolean", description: localize("scopedChatSynthesisInProgress", "Defined as a location where voice recording from microphone is in progress for voice chat. This key is only defined scoped, per chat context.") });
class ChatSynthesizerSessionController {
  static create(accessor, context, response) {
    if (context === "focused") {
      return ChatSynthesizerSessionController.doCreateForFocusedChat(accessor, response);
    } else {
      return {
        onDidHideChat: context.onDidHideInput,
        contextKeyService: context.scopedContextKeyService,
        response
      };
    }
  }
  static doCreateForFocusedChat(accessor, response) {
    const chatWidgetService = accessor.get(IChatWidgetService);
    const contextKeyService = accessor.get(IContextKeyService);
    let chatWidget = chatWidgetService.getWidgetBySessionId(response.session.sessionId);
    if (chatWidget?.location === ChatAgentLocation.Editor) {
      chatWidget = chatWidgetService.lastFocusedWidget;
    }
    return {
      onDidHideChat: chatWidget?.onDidHide ?? Event.None,
      contextKeyService: chatWidget?.scopedContextKeyService ?? contextKeyService,
      response
    };
  }
}
let ChatSynthesizerSessions = class {
  constructor(speechService, configurationService, instantiationService) {
    this.speechService = speechService;
    this.configurationService = configurationService;
    this.instantiationService = instantiationService;
    this.activeSession = void 0;
  }
  static getInstance(instantiationService) {
    if (!ChatSynthesizerSessions.instance) {
      ChatSynthesizerSessions.instance = instantiationService.createInstance(ChatSynthesizerSessions);
    }
    return ChatSynthesizerSessions.instance;
  }
  async start(controller) {
    this.stop();
    VoiceChatSessions.getInstance(this.instantiationService).stop();
    const activeSession = this.activeSession = new CancellationTokenSource();
    const disposables = new DisposableStore();
    activeSession.token.onCancellationRequested(() => disposables.dispose());
    const session = await this.speechService.createTextToSpeechSession(activeSession.token, "chat");
    if (activeSession.token.isCancellationRequested) {
      return;
    }
    disposables.add(controller.onDidHideChat(() => this.stop()));
    const scopedChatToSpeechInProgress = ScopedChatSynthesisInProgress.bindTo(controller.contextKeyService);
    disposables.add(toDisposable(() => scopedChatToSpeechInProgress.reset()));
    disposables.add(session.onDidChange((e) => {
      switch (e.status) {
        case TextToSpeechStatus.Started:
          scopedChatToSpeechInProgress.set(true);
          break;
        case TextToSpeechStatus.Stopped:
          scopedChatToSpeechInProgress.reset();
          break;
      }
    }));
    for await (const chunk of this.nextChatResponseChunk(controller.response, activeSession.token)) {
      if (activeSession.token.isCancellationRequested) {
        return;
      }
      await raceCancellation(session.synthesize(chunk), activeSession.token);
    }
  }
  async *nextChatResponseChunk(response, token) {
    const context = {
      ignoreCodeBlocks: this.configurationService.getValue(AccessibilityVoiceSettingId.IgnoreCodeBlocks),
      insideCodeBlock: false
    };
    let totalOffset = 0;
    let complete = false;
    do {
      const responseLength = response.response.toString().length;
      const { chunk, offset } = this.parseNextChatResponseChunk(response, totalOffset, context);
      totalOffset = offset;
      complete = response.isComplete;
      if (chunk) {
        yield chunk;
      }
      if (token.isCancellationRequested) {
        return;
      }
      if (!complete && responseLength === response.response.toString().length) {
        await raceCancellation(Event.toPromise(response.onDidChange), token);
      }
    } while (!token.isCancellationRequested && !complete);
  }
  parseNextChatResponseChunk(response, offset, context) {
    let chunk = void 0;
    const text = response.response.toString();
    if (response.isComplete) {
      chunk = text.substring(offset);
      offset = text.length + 1;
    } else {
      const res = parseNextChatResponseChunk(text, offset);
      chunk = res.chunk;
      offset = res.offset;
    }
    if (chunk && context.ignoreCodeBlocks) {
      chunk = this.filterCodeBlocks(chunk, context);
    }
    return {
      chunk: chunk ? renderStringAsPlaintext({ value: chunk }) : chunk,
      // convert markdown to plain text
      offset
    };
  }
  filterCodeBlocks(chunk, context) {
    return chunk.split("\n").filter((line) => {
      if (line.trimStart().startsWith("```")) {
        context.insideCodeBlock = !context.insideCodeBlock;
        return false;
      }
      return !context.insideCodeBlock;
    }).join("\n");
  }
  stop() {
    this.activeSession?.dispose(true);
    this.activeSession = void 0;
  }
};
ChatSynthesizerSessions.instance = void 0;
ChatSynthesizerSessions = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IInstantiationService)
], ChatSynthesizerSessions);
const sentenceDelimiter = [".", "!", "?", ":"];
const lineDelimiter = "\n";
const wordDelimiter = " ";
function parseNextChatResponseChunk(text, offset) {
  let chunk = void 0;
  for (let i = text.length - 1; i >= offset; i--) {
    const cur = text[i];
    const next = text[i + 1];
    if (sentenceDelimiter.includes(cur) && next === wordDelimiter || // end of sentence
    lineDelimiter === cur) {
      chunk = text.substring(offset, i + 1).trim();
      offset = i + 1;
      break;
    }
  }
  return { chunk, offset };
}
class ReadChatResponseAloud extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.readChatResponseAloud",
      title: localize2("workbench.action.chat.readChatResponseAloud", "Read Aloud"),
      icon: Codicon.unmute,
      precondition: CanVoiceChat,
      menu: [{
        id: MenuId.ChatMessageFooter,
        when: ContextKeyExpr.and(
          CanVoiceChat,
          ChatContextKeys.isResponse,
          // only for responses
          ScopedChatSynthesisInProgress.negate(),
          // but not when already in progress
          ChatContextKeys.responseIsFiltered.negate()
          // and not when response is filtered
        ),
        group: "navigation",
        order: -10
        // first
      }, {
        id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
        when: ContextKeyExpr.and(
          CanVoiceChat,
          ChatContextKeys.isResponse,
          // only for responses
          ScopedChatSynthesisInProgress.negate(),
          // but not when already in progress
          ChatContextKeys.responseIsFiltered.negate()
          // and not when response is filtered
        ),
        group: "navigation",
        order: -10
        // first
      }]
    });
  }
  run(accessor, ...args) {
    const instantiationService = accessor.get(IInstantiationService);
    const chatWidgetService = accessor.get(IChatWidgetService);
    let response = void 0;
    if (args.length > 0) {
      const responseArg = args[0];
      if (isResponseVM(responseArg)) {
        response = responseArg;
      }
    } else {
      const chatWidget = chatWidgetService.lastFocusedWidget;
      if (chatWidget) {
        const focus = chatWidget.getFocus();
        if (focus instanceof ChatResponseViewModel) {
          response = focus;
        } else {
          const chatViewModel = chatWidget.viewModel;
          if (chatViewModel) {
            const items = chatViewModel.getItems();
            for (let i = items.length - 1; i >= 0; i--) {
              const item = items[i];
              if (isResponseVM(item)) {
                response = item;
                break;
              }
            }
          }
        }
      }
    }
    if (!response) {
      return;
    }
    const controller = ChatSynthesizerSessionController.create(accessor, "focused", response.model);
    ChatSynthesizerSessions.getInstance(instantiationService).start(controller);
  }
}
const _StopReadAloud = class _StopReadAloud extends Action2 {
  constructor() {
    super({
      id: _StopReadAloud.ID,
      icon: syncing,
      title: localize2("workbench.action.speech.stopReadAloud", "Stop Reading Aloud"),
      f1: true,
      category: CHAT_CATEGORY,
      precondition: GlobalTextToSpeechInProgress,
      // need global context here because of `f1: true`
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 100,
        primary: KeyCode.Escape,
        when: ScopedChatSynthesisInProgress
      },
      menu: primaryVoiceActionMenu(ScopedChatSynthesisInProgress)
    });
  }
  async run(accessor) {
    ChatSynthesizerSessions.getInstance(accessor.get(IInstantiationService)).stop();
  }
};
_StopReadAloud.ID = "workbench.action.speech.stopReadAloud";
let StopReadAloud = _StopReadAloud;
const _StopReadChatItemAloud = class _StopReadChatItemAloud extends Action2 {
  constructor() {
    super({
      id: _StopReadChatItemAloud.ID,
      icon: Codicon.mute,
      title: localize2("workbench.action.chat.stopReadChatItemAloud", "Stop Reading Aloud"),
      precondition: ScopedChatSynthesisInProgress,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib + 100,
        primary: KeyCode.Escape
      },
      menu: [
        {
          id: MenuId.ChatMessageFooter,
          when: ContextKeyExpr.and(
            ScopedChatSynthesisInProgress,
            // only when in progress
            ChatContextKeys.isResponse,
            // only for responses
            ChatContextKeys.responseIsFiltered.negate()
            // but not when response is filtered
          ),
          group: "navigation",
          order: -10
          // first
        },
        {
          id: MENU_INLINE_CHAT_WIDGET_SECONDARY,
          when: ContextKeyExpr.and(
            ScopedChatSynthesisInProgress,
            // only when in progress
            ChatContextKeys.isResponse,
            // only for responses
            ChatContextKeys.responseIsFiltered.negate()
            // but not when response is filtered
          ),
          group: "navigation",
          order: -10
          // first
        }
      ]
    });
  }
  async run(accessor, ...args) {
    ChatSynthesizerSessions.getInstance(accessor.get(IInstantiationService)).stop();
  }
};
_StopReadChatItemAloud.ID = "workbench.action.chat.stopReadChatItemAloud";
let StopReadChatItemAloud = _StopReadChatItemAloud;
function supportsKeywordActivation(configurationService, speechService, chatAgentService) {
  if (!speechService.hasSpeechProvider || !chatAgentService.getDefaultAgent(ChatAgentLocation.Panel)) {
    return false;
  }
  const value = configurationService.getValue(KEYWORD_ACTIVIATION_SETTING_ID);
  return typeof value === "string" && value !== KeywordActivationContribution.SETTINGS_VALUE.OFF;
}
let KeywordActivationContribution = class extends Disposable {
  constructor(speechService, configurationService, commandService, instantiationService, editorService, hostService, chatAgentService) {
    super();
    this.speechService = speechService;
    this.configurationService = configurationService;
    this.commandService = commandService;
    this.editorService = editorService;
    this.hostService = hostService;
    this.chatAgentService = chatAgentService;
    this.activeSession = void 0;
    this._register(instantiationService.createInstance(KeywordActivationStatusEntry));
    this.registerListeners();
  }
  registerListeners() {
    this._register(Event.runAndSubscribe(this.speechService.onDidChangeHasSpeechProvider, () => {
      this.updateConfiguration();
      this.handleKeywordActivation();
    }));
    const onDidAddDefaultAgent = this._register(this.chatAgentService.onDidChangeAgents(() => {
      if (this.chatAgentService.getDefaultAgent(ChatAgentLocation.Panel)) {
        this.updateConfiguration();
        this.handleKeywordActivation();
        onDidAddDefaultAgent.dispose();
      }
    }));
    this._register(this.speechService.onDidStartSpeechToTextSession(() => this.handleKeywordActivation()));
    this._register(this.speechService.onDidEndSpeechToTextSession(() => this.handleKeywordActivation()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(KEYWORD_ACTIVIATION_SETTING_ID)) {
        this.handleKeywordActivation();
      }
    }));
  }
  updateConfiguration() {
    if (!this.speechService.hasSpeechProvider || !this.chatAgentService.getDefaultAgent(ChatAgentLocation.Panel)) {
      return;
    }
    const registry = Registry.as(Extensions.Configuration);
    registry.registerConfiguration({
      ...accessibilityConfigurationNodeBase,
      properties: {
        [KEYWORD_ACTIVIATION_SETTING_ID]: {
          "type": "string",
          "enum": [
            KeywordActivationContribution.SETTINGS_VALUE.OFF,
            KeywordActivationContribution.SETTINGS_VALUE.VIEW_CHAT,
            KeywordActivationContribution.SETTINGS_VALUE.QUICK_CHAT,
            KeywordActivationContribution.SETTINGS_VALUE.INLINE_CHAT,
            KeywordActivationContribution.SETTINGS_VALUE.CHAT_IN_CONTEXT
          ],
          "enumDescriptions": [
            localize("voice.keywordActivation.off", "Keyword activation is disabled."),
            localize("voice.keywordActivation.chatInView", "Keyword activation is enabled and listening for 'Hey Code' to start a voice chat session in the chat view."),
            localize("voice.keywordActivation.quickChat", "Keyword activation is enabled and listening for 'Hey Code' to start a voice chat session in the quick chat."),
            localize("voice.keywordActivation.inlineChat", "Keyword activation is enabled and listening for 'Hey Code' to start a voice chat session in the active editor if possible."),
            localize("voice.keywordActivation.chatInContext", "Keyword activation is enabled and listening for 'Hey Code' to start a voice chat session in the active editor or view depending on keyboard focus.")
          ],
          "description": localize("voice.keywordActivation", "Controls whether the keyword phrase 'Hey Code' is recognized to start a voice chat session. Enabling this will start recording from the microphone but the audio is processed locally and never sent to a server."),
          "default": "off",
          "tags": ["accessibility"]
        }
      }
    });
  }
  handleKeywordActivation() {
    const enabled = supportsKeywordActivation(this.configurationService, this.speechService, this.chatAgentService) && !this.speechService.hasActiveSpeechToTextSession;
    if (enabled && this.activeSession || !enabled && !this.activeSession) {
      return;
    }
    if (enabled) {
      this.enableKeywordActivation();
    } else {
      this.disableKeywordActivation();
    }
  }
  async enableKeywordActivation() {
    const session = this.activeSession = new CancellationTokenSource();
    const result = await this.speechService.recognizeKeyword(session.token);
    if (session.token.isCancellationRequested || session !== this.activeSession) {
      return;
    }
    this.activeSession = void 0;
    if (result === KeywordRecognitionStatus.Recognized) {
      if (this.hostService.hasFocus) {
        this.commandService.executeCommand(this.getKeywordCommand());
      }
      this.handleKeywordActivation();
    }
  }
  getKeywordCommand() {
    const setting = this.configurationService.getValue(KEYWORD_ACTIVIATION_SETTING_ID);
    switch (setting) {
      case KeywordActivationContribution.SETTINGS_VALUE.INLINE_CHAT:
        return InlineVoiceChatAction.ID;
      case KeywordActivationContribution.SETTINGS_VALUE.QUICK_CHAT:
        return QuickVoiceChatAction.ID;
      case KeywordActivationContribution.SETTINGS_VALUE.CHAT_IN_CONTEXT: {
        const activeCodeEditor = getCodeEditor(this.editorService.activeTextEditorControl);
        if (activeCodeEditor?.hasWidgetFocus()) {
          return InlineVoiceChatAction.ID;
        }
      }
      default:
        return VoiceChatInChatViewAction.ID;
    }
  }
  disableKeywordActivation() {
    this.activeSession?.dispose(true);
    this.activeSession = void 0;
  }
  dispose() {
    this.activeSession?.dispose();
    super.dispose();
  }
};
KeywordActivationContribution.ID = "workbench.contrib.keywordActivation";
KeywordActivationContribution.SETTINGS_VALUE = {
  OFF: "off",
  INLINE_CHAT: "inlineChat",
  QUICK_CHAT: "quickChat",
  VIEW_CHAT: "chatInView",
  CHAT_IN_CONTEXT: "chatInContext"
};
KeywordActivationContribution = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IHostService),
  __decorateParam(6, IChatAgentService)
], KeywordActivationContribution);
let KeywordActivationStatusEntry = class extends Disposable {
  constructor(speechService, statusbarService, commandService, configurationService, chatAgentService) {
    super();
    this.speechService = speechService;
    this.statusbarService = statusbarService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.chatAgentService = chatAgentService;
    this.entry = this._register(new MutableDisposable());
    this._register(CommandsRegistry.registerCommand(KeywordActivationStatusEntry.STATUS_COMMAND, () => this.commandService.executeCommand("workbench.action.openSettings", KEYWORD_ACTIVIATION_SETTING_ID)));
    this.registerListeners();
    this.updateStatusEntry();
  }
  registerListeners() {
    this._register(this.speechService.onDidStartKeywordRecognition(() => this.updateStatusEntry()));
    this._register(this.speechService.onDidEndKeywordRecognition(() => this.updateStatusEntry()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(KEYWORD_ACTIVIATION_SETTING_ID)) {
        this.updateStatusEntry();
      }
    }));
  }
  updateStatusEntry() {
    const visible = supportsKeywordActivation(this.configurationService, this.speechService, this.chatAgentService);
    if (visible) {
      if (!this.entry.value) {
        this.createStatusEntry();
      }
      this.updateStatusLabel();
    } else {
      this.entry.clear();
    }
  }
  createStatusEntry() {
    this.entry.value = this.statusbarService.addEntry(this.getStatusEntryProperties(), "status.voiceKeywordActivation", StatusbarAlignment.RIGHT, 103);
  }
  getStatusEntryProperties() {
    return {
      name: KeywordActivationStatusEntry.STATUS_NAME,
      text: this.speechService.hasActiveKeywordRecognition ? "$(mic-filled)" : "$(mic)",
      tooltip: this.speechService.hasActiveKeywordRecognition ? KeywordActivationStatusEntry.STATUS_ACTIVE : KeywordActivationStatusEntry.STATUS_INACTIVE,
      ariaLabel: this.speechService.hasActiveKeywordRecognition ? KeywordActivationStatusEntry.STATUS_ACTIVE : KeywordActivationStatusEntry.STATUS_INACTIVE,
      command: KeywordActivationStatusEntry.STATUS_COMMAND,
      kind: "prominent",
      showInAllWindows: true
    };
  }
  updateStatusLabel() {
    this.entry.value?.update(this.getStatusEntryProperties());
  }
};
KeywordActivationStatusEntry.STATUS_NAME = localize("keywordActivation.status.name", "Voice Keyword Activation");
KeywordActivationStatusEntry.STATUS_COMMAND = "keywordActivation.status.command";
KeywordActivationStatusEntry.STATUS_ACTIVE = localize("keywordActivation.status.active", "Listening to 'Hey Code'...");
KeywordActivationStatusEntry.STATUS_INACTIVE = localize("keywordActivation.status.inactive", "Waiting for voice chat to end...");
KeywordActivationStatusEntry = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IStatusbarService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IChatAgentService)
], KeywordActivationStatusEntry);
const InstallingSpeechProvider = new RawContextKey("installingSpeechProvider", false, true);
const _BaseInstallSpeechProviderAction = class _BaseInstallSpeechProviderAction extends Action2 {
  async run(accessor) {
    const contextKeyService = accessor.get(IContextKeyService);
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const dialogService = accessor.get(IDialogService);
    try {
      InstallingSpeechProvider.bindTo(contextKeyService).set(true);
      await this.installExtension(extensionsWorkbenchService, dialogService);
    } finally {
      InstallingSpeechProvider.bindTo(contextKeyService).reset();
    }
  }
  async installExtension(extensionsWorkbenchService, dialogService) {
    try {
      await extensionsWorkbenchService.install(_BaseInstallSpeechProviderAction.SPEECH_EXTENSION_ID, {
        justification: this.getJustification(),
        enable: true
      }, ProgressLocation.Notification);
    } catch (error) {
      const { confirmed } = await dialogService.confirm({
        type: Severity.Error,
        message: localize("unknownSetupError", "An error occurred while setting up voice chat. Would you like to try again?"),
        detail: error && !isCancellationError(error) ? toErrorMessage(error) : void 0,
        primaryButton: localize("retry", "Retry")
      });
      if (confirmed) {
        return this.installExtension(extensionsWorkbenchService, dialogService);
      }
    }
  }
};
_BaseInstallSpeechProviderAction.SPEECH_EXTENSION_ID = "ms-vscode.vscode-speech";
let BaseInstallSpeechProviderAction = _BaseInstallSpeechProviderAction;
const _InstallSpeechProviderForVoiceChatAction = class _InstallSpeechProviderForVoiceChatAction extends BaseInstallSpeechProviderAction {
  constructor() {
    super({
      id: _InstallSpeechProviderForVoiceChatAction.ID,
      title: localize2("workbench.action.chat.installProviderForVoiceChat.label", "Start Voice Chat"),
      icon: Codicon.mic,
      precondition: InstallingSpeechProvider.negate(),
      menu: primaryVoiceActionMenu(HasSpeechProvider.negate())
    });
  }
  getJustification() {
    return localize("installProviderForVoiceChat.justification", "Microphone support requires this extension.");
  }
};
_InstallSpeechProviderForVoiceChatAction.ID = "workbench.action.chat.installProviderForVoiceChat";
let InstallSpeechProviderForVoiceChatAction = _InstallSpeechProviderForVoiceChatAction;
registerThemingParticipant((theme, collector) => {
  let activeRecordingColor;
  let activeRecordingDimmedColor;
  if (theme.type === ColorScheme.LIGHT || theme.type === ColorScheme.DARK) {
    activeRecordingColor = theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND) ?? theme.getColor(focusBorder);
    activeRecordingDimmedColor = activeRecordingColor?.transparent(0.38);
  } else {
    activeRecordingColor = theme.getColor(contrastBorder);
    activeRecordingDimmedColor = theme.getColor(contrastBorder);
  }
  collector.addRule(`
		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-sync.codicon-modifier-spin:not(.disabled),
		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-loading.codicon-modifier-spin:not(.disabled) {
			color: ${activeRecordingColor};
			outline: 1px solid ${activeRecordingColor};
			outline-offset: -1px;
			animation: pulseAnimation 1s infinite;
			border-radius: 50%;
		}

		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-sync.codicon-modifier-spin:not(.disabled)::before,
		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-loading.codicon-modifier-spin:not(.disabled)::before {
			position: absolute;
			outline: 1px solid ${activeRecordingColor};
			outline-offset: 2px;
			border-radius: 50%;
			width: 16px;
			height: 16px;
		}

		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-sync.codicon-modifier-spin:not(.disabled)::after,
		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-loading.codicon-modifier-spin:not(.disabled)::after {
			outline: 2px solid ${activeRecordingColor};
			outline-offset: -1px;
			animation: pulseAnimation 1500ms cubic-bezier(0.75, 0, 0.25, 1) infinite;
		}

		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-sync.codicon-modifier-spin:not(.disabled)::before,
		.monaco-workbench:not(.reduce-motion) .interactive-input-part .monaco-action-bar .action-label.codicon-loading.codicon-modifier-spin:not(.disabled)::before {
			position: absolute;
			outline: 1px solid ${activeRecordingColor};
			outline-offset: 2px;
			border-radius: 50%;
			width: 16px;
			height: 16px;
		}

		@keyframes pulseAnimation {
			0% {
				outline-width: 2px;
			}
			62% {
				outline-width: 5px;
				outline-color: ${activeRecordingDimmedColor};
			}
			100% {
				outline-width: 2px;
			}
		}
	`);
});
export {
  HoldToVoiceChatInChatViewAction,
  InlineVoiceChatAction,
  InstallSpeechProviderForVoiceChatAction,
  KeywordActivationContribution,
  QuickVoiceChatAction,
  ReadChatResponseAloud,
  StartVoiceChatAction,
  StopListeningAction,
  StopListeningAndSubmitAction,
  StopReadAloud,
  StopReadChatItemAloud,
  VOICE_KEY_HOLD_THRESHOLD,
  VoiceChatInChatViewAction,
  parseNextChatResponseChunk
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2VsZWN0cm9uLXNhbmRib3gvYWN0aW9ucy92b2ljZUNoYXRBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL3ZvaWNlQ2hhdEFjdGlvbnMuY3NzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIsIGRpc3Bvc2FibGVUaW1lb3V0LCByYWNlQ2FuY2VsbGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSUFjdGlvbjJPcHRpb25zLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIENvbnRleHRLZXlFeHByZXNzaW9uLCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGNvbnRyYXN0Qm9yZGVyLCBmb2N1c0JvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHNwaW5uaW5nTG9hZGluZywgc3luY2luZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEFDVElWSVRZX0JBUl9CQURHRV9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWb2ljZVNldHRpbmdJZCwgU3BlZWNoVGltZW91dERlZmF1bHQsIGFjY2Vzc2liaWxpdHlDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ0hBVF9DQVRFR09SWSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy9jaGF0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEV4ZWN1dGVBY3Rpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9hY3Rpb25zL2NoYXRFeGVjdXRlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlLCBJUXVpY2tDaGF0U2VydmljZSwgc2hvd0NoYXRWaWV3IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jaGF0LmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBLRVlXT1JEX0FDVElWSUFUSU9OX1NFVFRJTkdfSUQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFJlc3BvbnNlVmlld01vZGVsLCBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCBpc1Jlc3BvbnNlVk0gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJVm9pY2VDaGF0U2VydmljZSwgVm9pY2VDaGF0SW5Qcm9ncmVzcyBhcyBHbG9iYWxWb2ljZUNoYXRJblByb2dyZXNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ZvaWNlQ2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDaGF0Q29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uL2lubGluZUNoYXQvYnJvd3Nlci9pbmxpbmVDaGF0Q29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgTUVOVV9JTkxJTkVfQ0hBVF9XSURHRVRfU0VDT05EQVJZIH0gZnJvbSAnLi4vLi4vLi4vaW5saW5lQ2hhdC9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19FRElUT1JfRk9DVVNFRCB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEhhc1NwZWVjaFByb3ZpZGVyLCBJU3BlZWNoU2VydmljZSwgS2V5d29yZFJlY29nbml0aW9uU3RhdHVzLCBTcGVlY2hUb1RleHRJblByb2dyZXNzLCBTcGVlY2hUb1RleHRTdGF0dXMsIFRleHRUb1NwZWVjaFN0YXR1cywgVGV4dFRvU3BlZWNoSW5Qcm9ncmVzcyBhcyBHbG9iYWxUZXh0VG9TcGVlY2hJblByb2dyZXNzIH0gZnJvbSAnLi4vLi4vLi4vc3BlZWNoL2NvbW1vbi9zcGVlY2hTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBQYXJ0cyB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0YXR1c2JhckVudHJ5LCBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciwgSVN0YXR1c2JhclNlcnZpY2UsIFN0YXR1c2JhckFsaWdubWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlc3BvbnNlTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgcmVuZGVyU3RyaW5nQXNQbGFpbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2VhcmNoQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3NlYXJjaC9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5cbi8vI3JlZ2lvbiBTcGVlY2ggdG8gVGV4dFxuXG50eXBlIFZvaWNlQ2hhdFNlc3Npb25Db250ZXh0ID0gJ3ZpZXcnIHwgJ2lubGluZScgfCAncXVpY2snIHwgJ2VkaXRvcic7XG5jb25zdCBWb2ljZUNoYXRTZXNzaW9uQ29udGV4dHM6IFZvaWNlQ2hhdFNlc3Npb25Db250ZXh0W10gPSBbJ3ZpZXcnLCAnaW5saW5lJywgJ3F1aWNrJywgJ2VkaXRvciddO1xuXG4vLyBHbG9iYWwgQ29udGV4dCBLZXlzIChzZXQgb24gZ2xvYmFsIGNvbnRleHQga2V5IHNlcnZpY2UpXG5jb25zdCBDYW5Wb2ljZUNoYXQgPSBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsIEhhc1NwZWVjaFByb3ZpZGVyKTtcbmNvbnN0IEZvY3VzSW5DaGF0SW5wdXQgPSBDb250ZXh0S2V5RXhwci5vcihDVFhfSU5MSU5FX0NIQVRfRk9DVVNFRCwgQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0KTtcbmNvbnN0IEFueUNoYXRSZXF1ZXN0SW5Qcm9ncmVzcyA9IENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcztcblxuLy8gU2NvcGVkIENvbnRleHQgS2V5cyAoc2V0IG9uIHBlci1jaGF0LWNvbnRleHQgc2NvcGVkIGNvbnRleHQga2V5IHNlcnZpY2UpXG5jb25zdCBTY29wZWRWb2ljZUNoYXRHZXR0aW5nUmVhZHkgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2NvcGVkVm9pY2VDaGF0R2V0dGluZ1JlYWR5JywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Njb3BlZFZvaWNlQ2hhdEdldHRpbmdSZWFkeScsIFwiVHJ1ZSB3aGVuIGdldHRpbmcgcmVhZHkgZm9yIHJlY2VpdmluZyB2b2ljZSBpbnB1dCBmcm9tIHRoZSBtaWNyb3Bob25lIGZvciB2b2ljZSBjaGF0LiBUaGlzIGtleSBpcyBvbmx5IGRlZmluZWQgc2NvcGVkLCBwZXIgY2hhdCBjb250ZXh0LlwiKSB9KTtcbmNvbnN0IFNjb3BlZFZvaWNlQ2hhdEluUHJvZ3Jlc3MgPSBuZXcgUmF3Q29udGV4dEtleTxWb2ljZUNoYXRTZXNzaW9uQ29udGV4dCB8IHVuZGVmaW5lZD4oJ3Njb3BlZFZvaWNlQ2hhdEluUHJvZ3Jlc3MnLCB1bmRlZmluZWQsIHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2NvcGVkVm9pY2VDaGF0SW5Qcm9ncmVzcycsIFwiRGVmaW5lZCBhcyBhIGxvY2F0aW9uIHdoZXJlIHZvaWNlIHJlY29yZGluZyBmcm9tIG1pY3JvcGhvbmUgaXMgaW4gcHJvZ3Jlc3MgZm9yIHZvaWNlIGNoYXQuIFRoaXMga2V5IGlzIG9ubHkgZGVmaW5lZCBzY29wZWQsIHBlciBjaGF0IGNvbnRleHQuXCIpIH0pO1xuY29uc3QgQW55U2NvcGVkVm9pY2VDaGF0SW5Qcm9ncmVzcyA9IENvbnRleHRLZXlFeHByLm9yKC4uLlZvaWNlQ2hhdFNlc3Npb25Db250ZXh0cy5tYXAoY29udGV4dCA9PiBTY29wZWRWb2ljZUNoYXRJblByb2dyZXNzLmlzRXF1YWxUbyhjb250ZXh0KSkpO1xuXG5lbnVtIFZvaWNlQ2hhdFNlc3Npb25TdGF0ZSB7XG5cdFN0b3BwZWQgPSAxLFxuXHRHZXR0aW5nUmVhZHksXG5cdFN0YXJ0ZWRcbn1cblxuaW50ZXJmYWNlIElWb2ljZUNoYXRTZXNzaW9uQ29udHJvbGxlciB7XG5cblx0cmVhZG9ubHkgb25EaWRBY2NlcHRJbnB1dDogRXZlbnQ8dW5rbm93bj47XG5cdHJlYWRvbmx5IG9uRGlkSGlkZUlucHV0OiBFdmVudDx1bmtub3duPjtcblxuXHRyZWFkb25seSBjb250ZXh0OiBWb2ljZUNoYXRTZXNzaW9uQ29udGV4dDtcblx0cmVhZG9ubHkgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblxuXHR1cGRhdGVTdGF0ZShzdGF0ZTogVm9pY2VDaGF0U2Vzc2lvblN0YXRlKTogdm9pZDtcblxuXHRmb2N1c0lucHV0KCk6IHZvaWQ7XG5cdGFjY2VwdElucHV0KCk6IFByb21pc2U8SUNoYXRSZXNwb25zZU1vZGVsIHwgdW5kZWZpbmVkPjtcblx0dXBkYXRlSW5wdXQodGV4dDogc3RyaW5nKTogdm9pZDtcblx0Z2V0SW5wdXQoKTogc3RyaW5nO1xuXG5cdHNldElucHV0UGxhY2Vob2xkZXIodGV4dDogc3RyaW5nKTogdm9pZDtcblx0Y2xlYXJJbnB1dFBsYWNlaG9sZGVyKCk6IHZvaWQ7XG59XG5cbmNsYXNzIFZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyRmFjdG9yeSB7XG5cblx0c3RhdGljIGFzeW5jIGNyZWF0ZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogJ3ZpZXcnIHwgJ2lubGluZScgfCAncXVpY2snIHwgJ2ZvY3VzZWQnKTogUHJvbWlzZTxJVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrQ2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrQ2hhdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxheW91dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaExheW91dFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblxuXHRcdHN3aXRjaCAoY29udGV4dCkge1xuXHRcdFx0Y2FzZSAnZm9jdXNlZCc6IHtcblx0XHRcdFx0Y29uc3QgY29udHJvbGxlciA9IFZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyRmFjdG9yeS5kb0NyZWF0ZUZvckZvY3VzZWRDaGF0KGNoYXRXaWRnZXRTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlKTtcblx0XHRcdFx0cmV0dXJuIGNvbnRyb2xsZXIgPz8gVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXJGYWN0b3J5LmNyZWF0ZShhY2Nlc3NvciwgJ3ZpZXcnKTsgLy8gZmFsbGJhY2sgdG8gJ3ZpZXcnXG5cdFx0XHR9XG5cdFx0XHRjYXNlICd2aWV3Jzoge1xuXHRcdFx0XHRjb25zdCBjaGF0V2lkZ2V0ID0gYXdhaXQgc2hvd0NoYXRWaWV3KHZpZXdzU2VydmljZSk7XG5cdFx0XHRcdGlmIChjaGF0V2lkZ2V0KSB7XG5cdFx0XHRcdFx0cmV0dXJuIFZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyRmFjdG9yeS5kb0NyZWF0ZUZvckNoYXRXaWRnZXQoJ3ZpZXcnLCBjaGF0V2lkZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2lubGluZSc6IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IGdldENvZGVFZGl0b3IoZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCk7XG5cdFx0XHRcdGlmIChhY3RpdmVDb2RlRWRpdG9yKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5saW5lQ2hhdCA9IElubGluZUNoYXRDb250cm9sbGVyLmdldChhY3RpdmVDb2RlRWRpdG9yKTtcblx0XHRcdFx0XHRpZiAoaW5saW5lQ2hhdCkge1xuXHRcdFx0XHRcdFx0aWYgKCFpbmxpbmVDaGF0LmlzQWN0aXZlKSB7XG5cdFx0XHRcdFx0XHRcdGlubGluZUNoYXQucnVuKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXJGYWN0b3J5LmRvQ3JlYXRlRm9yQ2hhdFdpZGdldCgnaW5saW5lJywgaW5saW5lQ2hhdC53aWRnZXQuY2hhdFdpZGdldCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAncXVpY2snOiB7XG5cdFx0XHRcdHF1aWNrQ2hhdFNlcnZpY2Uub3BlbigpOyAvLyB0aGlzIHdpbGwgcG9wdWxhdGUgZm9jdXNlZCBjaGF0IHdpZGdldCBpbiB0aGUgY2hhdCB3aWRnZXQgc2VydmljZVxuXHRcdFx0XHRyZXR1cm4gVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXJGYWN0b3J5LmNyZWF0ZShhY2Nlc3NvciwgJ2ZvY3VzZWQnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgZG9DcmVhdGVGb3JGb2N1c2VkQ2hhdChjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSk6IElWb2ljZUNoYXRTZXNzaW9uQ29udHJvbGxlciB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY2hhdFdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdGlmIChjaGF0V2lkZ2V0Py5oYXNJbnB1dEZvY3VzKCkpIHtcblxuXHRcdFx0Ly8gRmlndXJlIG91dCB0aGUgY29udGV4dCBvZiB0aGUgY2hhdCB3aWRnZXQgYnkgYXNraW5nXG5cdFx0XHQvLyBsYXlvdXQgc2VydmljZSBmb3IgdGhlIHBhcnQgdGhhdCBoYXMgZm9jdXMuIFVuZm9ydHVuYXRlbHlcblx0XHRcdC8vIHRoZXJlIGlzIG5vIGJldHRlciB3YXkgYmVjYXVzZSB0aGUgd2lkZ2V0IGRvZXMgbm90IGtub3dcblx0XHRcdC8vIGl0cyBsb2NhdGlvbi5cblxuXHRcdFx0bGV0IGNvbnRleHQ6IFZvaWNlQ2hhdFNlc3Npb25Db250ZXh0O1xuXHRcdFx0aWYgKGxheW91dFNlcnZpY2UuaGFzRm9jdXMoUGFydHMuRURJVE9SX1BBUlQpKSB7XG5cdFx0XHRcdGNvbnRleHQgPSBjaGF0V2lkZ2V0LmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCA/ICdlZGl0b3InIDogJ2lubGluZSc7XG5cdFx0XHR9IGVsc2UgaWYgKFxuXHRcdFx0XHRbUGFydHMuU0lERUJBUl9QQVJULCBQYXJ0cy5QQU5FTF9QQVJULCBQYXJ0cy5BVVhJTElBUllCQVJfUEFSVCwgUGFydHMuVElUTEVCQVJfUEFSVCwgUGFydHMuU1RBVFVTQkFSX1BBUlQsIFBhcnRzLkJBTk5FUl9QQVJULCBQYXJ0cy5BQ1RJVklUWUJBUl9QQVJUXS5zb21lKHBhcnQgPT4gbGF5b3V0U2VydmljZS5oYXNGb2N1cyhwYXJ0KSlcblx0XHRcdCkge1xuXHRcdFx0XHRjb250ZXh0ID0gJ3ZpZXcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGV4dCA9ICdxdWljayc7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBWb2ljZUNoYXRTZXNzaW9uQ29udHJvbGxlckZhY3RvcnkuZG9DcmVhdGVGb3JDaGF0V2lkZ2V0KGNvbnRleHQsIGNoYXRXaWRnZXQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBjcmVhdGVDaGF0Q29udGV4dEtleUNvbnRyb2xsZXIoY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgY29udGV4dDogVm9pY2VDaGF0U2Vzc2lvbkNvbnRleHQpOiAoc3RhdGU6IFZvaWNlQ2hhdFNlc3Npb25TdGF0ZSkgPT4gdm9pZCB7XG5cdFx0Y29uc3QgY29udGV4dFZvaWNlQ2hhdEdldHRpbmdSZWFkeSA9IFNjb3BlZFZvaWNlQ2hhdEdldHRpbmdSZWFkeS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRWb2ljZUNoYXRJblByb2dyZXNzID0gU2NvcGVkVm9pY2VDaGF0SW5Qcm9ncmVzcy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0cmV0dXJuIChzdGF0ZTogVm9pY2VDaGF0U2Vzc2lvblN0YXRlKSA9PiB7XG5cdFx0XHRzd2l0Y2ggKHN0YXRlKSB7XG5cdFx0XHRcdGNhc2UgVm9pY2VDaGF0U2Vzc2lvblN0YXRlLkdldHRpbmdSZWFkeTpcblx0XHRcdFx0XHRjb250ZXh0Vm9pY2VDaGF0R2V0dGluZ1JlYWR5LnNldCh0cnVlKTtcblx0XHRcdFx0XHRjb250ZXh0Vm9pY2VDaGF0SW5Qcm9ncmVzcy5yZXNldCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFZvaWNlQ2hhdFNlc3Npb25TdGF0ZS5TdGFydGVkOlxuXHRcdFx0XHRcdGNvbnRleHRWb2ljZUNoYXRHZXR0aW5nUmVhZHkucmVzZXQoKTtcblx0XHRcdFx0XHRjb250ZXh0Vm9pY2VDaGF0SW5Qcm9ncmVzcy5zZXQoY29udGV4dCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVm9pY2VDaGF0U2Vzc2lvblN0YXRlLlN0b3BwZWQ6XG5cdFx0XHRcdFx0Y29udGV4dFZvaWNlQ2hhdEdldHRpbmdSZWFkeS5yZXNldCgpO1xuXHRcdFx0XHRcdGNvbnRleHRWb2ljZUNoYXRJblByb2dyZXNzLnJlc2V0KCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIGRvQ3JlYXRlRm9yQ2hhdFdpZGdldChjb250ZXh0OiBWb2ljZUNoYXRTZXNzaW9uQ29udGV4dCwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQpOiBJVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXIge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZXh0LFxuXHRcdFx0c2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IGNoYXRXaWRnZXQuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRvbkRpZEFjY2VwdElucHV0OiBjaGF0V2lkZ2V0Lm9uRGlkQWNjZXB0SW5wdXQsXG5cdFx0XHRvbkRpZEhpZGVJbnB1dDogY2hhdFdpZGdldC5vbkRpZEhpZGUsXG5cdFx0XHRmb2N1c0lucHV0OiAoKSA9PiBjaGF0V2lkZ2V0LmZvY3VzSW5wdXQoKSxcblx0XHRcdGFjY2VwdElucHV0OiAoKSA9PiBjaGF0V2lkZ2V0LmFjY2VwdElucHV0KHVuZGVmaW5lZCwgeyBpc1ZvaWNlSW5wdXQ6IHRydWUgfSksXG5cdFx0XHR1cGRhdGVJbnB1dDogdGV4dCA9PiBjaGF0V2lkZ2V0LnNldElucHV0KHRleHQpLFxuXHRcdFx0Z2V0SW5wdXQ6ICgpID0+IGNoYXRXaWRnZXQuZ2V0SW5wdXQoKSxcblx0XHRcdHNldElucHV0UGxhY2Vob2xkZXI6IHRleHQgPT4gY2hhdFdpZGdldC5zZXRJbnB1dFBsYWNlaG9sZGVyKHRleHQpLFxuXHRcdFx0Y2xlYXJJbnB1dFBsYWNlaG9sZGVyOiAoKSA9PiBjaGF0V2lkZ2V0LnJlc2V0SW5wdXRQbGFjZWhvbGRlcigpLFxuXHRcdFx0dXBkYXRlU3RhdGU6IFZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyRmFjdG9yeS5jcmVhdGVDaGF0Q29udGV4dEtleUNvbnRyb2xsZXIoY2hhdFdpZGdldC5zY29wZWRDb250ZXh0S2V5U2VydmljZSwgY29udGV4dClcblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJVm9pY2VDaGF0U2Vzc2lvbiB7XG5cdHNldFRpbWVvdXREaXNhYmxlZChkaXNhYmxlZDogYm9vbGVhbik6IHZvaWQ7XG5cblx0YWNjZXB0KCk6IHZvaWQ7XG5cdHN0b3AoKTogdm9pZDtcbn1cblxuaW50ZXJmYWNlIElBY3RpdmVWb2ljZUNoYXRTZXNzaW9uIGV4dGVuZHMgSVZvaWNlQ2hhdFNlc3Npb24ge1xuXHRyZWFkb25seSBpZDogbnVtYmVyO1xuXHRyZWFkb25seSBjb250cm9sbGVyOiBJVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXI7XG5cdHJlYWRvbmx5IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cblx0aGFzUmVjb2duaXplZElucHV0OiBib29sZWFuO1xufVxuXG5jbGFzcyBWb2ljZUNoYXRTZXNzaW9ucyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IFZvaWNlQ2hhdFNlc3Npb25zIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRzdGF0aWMgZ2V0SW5zdGFuY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IFZvaWNlQ2hhdFNlc3Npb25zIHtcblx0XHRpZiAoIVZvaWNlQ2hhdFNlc3Npb25zLmluc3RhbmNlKSB7XG5cdFx0XHRWb2ljZUNoYXRTZXNzaW9ucy5pbnN0YW5jZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZvaWNlQ2hhdFNlc3Npb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gVm9pY2VDaGF0U2Vzc2lvbnMuaW5zdGFuY2U7XG5cdH1cblxuXHRwcml2YXRlIGN1cnJlbnRWb2ljZUNoYXRTZXNzaW9uOiBJQWN0aXZlVm9pY2VDaGF0U2Vzc2lvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB2b2ljZUNoYXRTZXNzaW9uSWRzID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVZvaWNlQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2b2ljZUNoYXRTZXJ2aWNlOiBJVm9pY2VDaGF0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHsgfVxuXG5cdGFzeW5jIHN0YXJ0KGNvbnRyb2xsZXI6IElWb2ljZUNoYXRTZXNzaW9uQ29udHJvbGxlciwgY29udGV4dD86IElDaGF0RXhlY3V0ZUFjdGlvbkNvbnRleHQpOiBQcm9taXNlPElWb2ljZUNoYXRTZXNzaW9uPiB7XG5cblx0XHQvLyBTdG9wIHJ1bm5pbmcgdGV4dC10by1zcGVlY2ggb3Igc3BlZWNoLXRvLXRleHQgc2Vzc2lvbnMgaW4gY2hhdHNcblx0XHR0aGlzLnN0b3AoKTtcblx0XHRDaGF0U3ludGhlc2l6ZXJTZXNzaW9ucy5nZXRJbnN0YW5jZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKS5zdG9wKCk7XG5cblx0XHRsZXQgZGlzYWJsZVRpbWVvdXQgPSBmYWxzZTtcblxuXHRcdGNvbnN0IHNlc3Npb25JZCA9ICsrdGhpcy52b2ljZUNoYXRTZXNzaW9uSWRzO1xuXHRcdGNvbnN0IHNlc3Npb246IElBY3RpdmVWb2ljZUNoYXRTZXNzaW9uID0gdGhpcy5jdXJyZW50Vm9pY2VDaGF0U2Vzc2lvbiA9IHtcblx0XHRcdGlkOiBzZXNzaW9uSWQsXG5cdFx0XHRjb250cm9sbGVyLFxuXHRcdFx0aGFzUmVjb2duaXplZElucHV0OiBmYWxzZSxcblx0XHRcdGRpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCksXG5cdFx0XHRzZXRUaW1lb3V0RGlzYWJsZWQ6IChkaXNhYmxlZDogYm9vbGVhbikgPT4geyBkaXNhYmxlVGltZW91dCA9IGRpc2FibGVkOyB9LFxuXHRcdFx0YWNjZXB0OiAoKSA9PiB0aGlzLmFjY2VwdChzZXNzaW9uSWQpLFxuXHRcdFx0c3RvcDogKCkgPT4gdGhpcy5zdG9wKHNlc3Npb25JZCwgY29udHJvbGxlci5jb250ZXh0KVxuXHRcdH07XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRzZXNzaW9uLmRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY3RzLmRpc3Bvc2UodHJ1ZSkpKTtcblxuXHRcdHNlc3Npb24uZGlzcG9zYWJsZXMuYWRkKGNvbnRyb2xsZXIub25EaWRBY2NlcHRJbnB1dCgoKSA9PiB0aGlzLnN0b3Aoc2Vzc2lvbklkLCBjb250cm9sbGVyLmNvbnRleHQpKSk7XG5cdFx0c2Vzc2lvbi5kaXNwb3NhYmxlcy5hZGQoY29udHJvbGxlci5vbkRpZEhpZGVJbnB1dCgoKSA9PiB0aGlzLnN0b3Aoc2Vzc2lvbklkLCBjb250cm9sbGVyLmNvbnRleHQpKSk7XG5cblx0XHRjb250cm9sbGVyLmZvY3VzSW5wdXQoKTtcblxuXHRcdGNvbnRyb2xsZXIudXBkYXRlU3RhdGUoVm9pY2VDaGF0U2Vzc2lvblN0YXRlLkdldHRpbmdSZWFkeSk7XG5cblx0XHRjb25zdCB2b2ljZUNoYXRTZXNzaW9uID0gYXdhaXQgdGhpcy52b2ljZUNoYXRTZXJ2aWNlLmNyZWF0ZVZvaWNlQ2hhdFNlc3Npb24oY3RzLnRva2VuLCB7IHVzZXNBZ2VudHM6IGNvbnRyb2xsZXIuY29udGV4dCAhPT0gJ2lubGluZScsIG1vZGVsOiBjb250ZXh0Py53aWRnZXQ/LnZpZXdNb2RlbD8ubW9kZWwgfSk7XG5cblx0XHRsZXQgaW5wdXRWYWx1ZSA9IGNvbnRyb2xsZXIuZ2V0SW5wdXQoKTtcblxuXHRcdGxldCB2b2ljZUNoYXRUaW1lb3V0ID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KEFjY2Vzc2liaWxpdHlWb2ljZVNldHRpbmdJZC5TcGVlY2hUaW1lb3V0KTtcblx0XHRpZiAoIWlzTnVtYmVyKHZvaWNlQ2hhdFRpbWVvdXQpIHx8IHZvaWNlQ2hhdFRpbWVvdXQgPCAwKSB7XG5cdFx0XHR2b2ljZUNoYXRUaW1lb3V0ID0gU3BlZWNoVGltZW91dERlZmF1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWNjZXB0VHJhbnNjcmlwdGlvblNjaGVkdWxlciA9IHNlc3Npb24uZGlzcG9zYWJsZXMuYWRkKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuYWNjZXB0KHNlc3Npb25JZCksIHZvaWNlQ2hhdFRpbWVvdXQpKTtcblx0XHRzZXNzaW9uLmRpc3Bvc2FibGVzLmFkZCh2b2ljZUNoYXRTZXNzaW9uLm9uRGlkQ2hhbmdlKCh7IHN0YXR1cywgdGV4dCwgd2FpdGluZ0ZvcklucHV0IH0pID0+IHtcblx0XHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzd2l0Y2ggKHN0YXR1cykge1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5TdGFydGVkOlxuXHRcdFx0XHRcdHRoaXMub25EaWRTcGVlY2hUb1RleHRTZXNzaW9uU3RhcnQoY29udHJvbGxlciwgc2Vzc2lvbi5kaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nOlxuXHRcdFx0XHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uLmhhc1JlY29nbml6ZWRJbnB1dCA9IHRydWU7XG5cdFx0XHRcdFx0XHRzZXNzaW9uLmNvbnRyb2xsZXIudXBkYXRlSW5wdXQoaW5wdXRWYWx1ZSA/IFtpbnB1dFZhbHVlLCB0ZXh0XS5qb2luKCcgJykgOiB0ZXh0KTtcblx0XHRcdFx0XHRcdGlmICh2b2ljZUNoYXRUaW1lb3V0ID4gMCAmJiBjb250ZXh0Py52b2ljZT8uZGlzYWJsZVRpbWVvdXQgIT09IHRydWUgJiYgIWRpc2FibGVUaW1lb3V0KSB7XG5cdFx0XHRcdFx0XHRcdGFjY2VwdFRyYW5zY3JpcHRpb25TY2hlZHVsZXIuY2FuY2VsKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkOlxuXHRcdFx0XHRcdGlmICh0ZXh0KSB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uLmhhc1JlY29nbml6ZWRJbnB1dCA9IHRydWU7XG5cdFx0XHRcdFx0XHRpbnB1dFZhbHVlID0gaW5wdXRWYWx1ZSA/IFtpbnB1dFZhbHVlLCB0ZXh0XS5qb2luKCcgJykgOiB0ZXh0O1xuXHRcdFx0XHRcdFx0c2Vzc2lvbi5jb250cm9sbGVyLnVwZGF0ZUlucHV0KGlucHV0VmFsdWUpO1xuXHRcdFx0XHRcdFx0aWYgKHZvaWNlQ2hhdFRpbWVvdXQgPiAwICYmIGNvbnRleHQ/LnZvaWNlPy5kaXNhYmxlVGltZW91dCAhPT0gdHJ1ZSAmJiAhd2FpdGluZ0ZvcklucHV0ICYmICFkaXNhYmxlVGltZW91dCkge1xuXHRcdFx0XHRcdFx0XHRhY2NlcHRUcmFuc2NyaXB0aW9uU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5TdG9wcGVkOlxuXHRcdFx0XHRcdHRoaXMuc3RvcChzZXNzaW9uLmlkLCBjb250cm9sbGVyLmNvbnRleHQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBzZXNzaW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpZFNwZWVjaFRvVGV4dFNlc3Npb25TdGFydChjb250cm9sbGVyOiBJVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXIsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb250cm9sbGVyLnVwZGF0ZVN0YXRlKFZvaWNlQ2hhdFNlc3Npb25TdGF0ZS5TdGFydGVkKTtcblxuXHRcdGxldCBkb3RDb3VudCA9IDA7XG5cblx0XHRjb25zdCB1cGRhdGVQbGFjZWhvbGRlciA9ICgpID0+IHtcblx0XHRcdGRvdENvdW50ID0gKGRvdENvdW50ICsgMSkgJSA0O1xuXHRcdFx0Y29udHJvbGxlci5zZXRJbnB1dFBsYWNlaG9sZGVyKGAke2xvY2FsaXplKCdsaXN0ZW5pbmcnLCBcIkknbSBsaXN0ZW5pbmdcIil9JHsnLicucmVwZWF0KGRvdENvdW50KX1gKTtcblx0XHRcdHBsYWNlaG9sZGVyU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHBsYWNlaG9sZGVyU2NoZWR1bGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBSdW5PbmNlU2NoZWR1bGVyKHVwZGF0ZVBsYWNlaG9sZGVyLCA1MDApKTtcblx0XHR1cGRhdGVQbGFjZWhvbGRlcigpO1xuXHR9XG5cblx0c3RvcCh2b2ljZUNoYXRTZXNzaW9uSWQgPSB0aGlzLnZvaWNlQ2hhdFNlc3Npb25JZHMsIGNvbnRleHQ/OiBWb2ljZUNoYXRTZXNzaW9uQ29udGV4dCk6IHZvaWQge1xuXHRcdGlmIChcblx0XHRcdCF0aGlzLmN1cnJlbnRWb2ljZUNoYXRTZXNzaW9uIHx8XG5cdFx0XHR0aGlzLnZvaWNlQ2hhdFNlc3Npb25JZHMgIT09IHZvaWNlQ2hhdFNlc3Npb25JZCB8fFxuXHRcdFx0KGNvbnRleHQgJiYgdGhpcy5jdXJyZW50Vm9pY2VDaGF0U2Vzc2lvbi5jb250cm9sbGVyLmNvbnRleHQgIT09IGNvbnRleHQpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jdXJyZW50Vm9pY2VDaGF0U2Vzc2lvbi5jb250cm9sbGVyLmNsZWFySW5wdXRQbGFjZWhvbGRlcigpO1xuXG5cdFx0dGhpcy5jdXJyZW50Vm9pY2VDaGF0U2Vzc2lvbi5jb250cm9sbGVyLnVwZGF0ZVN0YXRlKFZvaWNlQ2hhdFNlc3Npb25TdGF0ZS5TdG9wcGVkKTtcblxuXHRcdHRoaXMuY3VycmVudFZvaWNlQ2hhdFNlc3Npb24uZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuY3VycmVudFZvaWNlQ2hhdFNlc3Npb24gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBhY2NlcHQodm9pY2VDaGF0U2Vzc2lvbklkID0gdGhpcy52b2ljZUNoYXRTZXNzaW9uSWRzKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKFxuXHRcdFx0IXRoaXMuY3VycmVudFZvaWNlQ2hhdFNlc3Npb24gfHxcblx0XHRcdHRoaXMudm9pY2VDaGF0U2Vzc2lvbklkcyAhPT0gdm9pY2VDaGF0U2Vzc2lvbklkXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmN1cnJlbnRWb2ljZUNoYXRTZXNzaW9uLmhhc1JlY29nbml6ZWRJbnB1dCkge1xuXHRcdFx0Ly8gSWYgd2UgaGF2ZSBhbiBhY3RpdmUgc2Vzc2lvbiBidXQgd2l0aG91dCByZWNvZ25pemVkXG5cdFx0XHQvLyBpbnB1dCwgd2UgZG8gbm90IHdhbnQgdG8ganVzdCBhY2NlcHQgdGhlIGlucHV0IHRoYXRcblx0XHRcdC8vIHdhcyBtYXliZSB0eXBlZCBiZWZvcmUuIEJ1dCB3ZSBzdGlsbCB3YW50IHRvIHN0b3AgdGhlXG5cdFx0XHQvLyB2b2ljZSBzZXNzaW9uIGJlY2F1c2UgYGFjY2VwdElucHV0YCB3b3VsZCBkbyB0aGF0LlxuXHRcdFx0dGhpcy5zdG9wKHZvaWNlQ2hhdFNlc3Npb25JZCwgdGhpcy5jdXJyZW50Vm9pY2VDaGF0U2Vzc2lvbi5jb250cm9sbGVyLmNvbnRleHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmN1cnJlbnRWb2ljZUNoYXRTZXNzaW9uLmNvbnRyb2xsZXI7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjb250cm9sbGVyLmFjY2VwdElucHV0KCk7XG5cdFx0aWYgKCFyZXNwb25zZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBhdXRvU3ludGhlc2l6ZSA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J29uJyB8ICdvZmYnPihBY2Nlc3NpYmlsaXR5Vm9pY2VTZXR0aW5nSWQuQXV0b1N5bnRoZXNpemUpO1xuXHRcdGlmIChhdXRvU3ludGhlc2l6ZSA9PT0gJ29uJyB8fCAoYXV0b1N5bnRoZXNpemUgIT09ICdvZmYnICYmICF0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpKSB7XG5cdFx0XHRsZXQgY29udGV4dDogSVZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyIHwgJ2ZvY3VzZWQnO1xuXHRcdFx0aWYgKGNvbnRyb2xsZXIuY29udGV4dCA9PT0gJ2lubGluZScpIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyB1Z2x5LCBidXQgdGhlIGxpZ2h0d2VpZ2h0IGlubGluZSBjaGF0IHR1cm5zIGludG9cblx0XHRcdFx0Ly8gYSBkaWZmZXJlbnQgd2lkZ2V0IGFzIHNvb24gYXMgYSByZXNwb25zZSBjb21lcyBpbiwgc28gd2UgZmFsbGJhY2sgdG9cblx0XHRcdFx0Ly8gcGlja2luZyB1cCBmcm9tIHRoZSBmb2N1c2VkIGNoYXQgd2lkZ2V0XG5cdFx0XHRcdGNvbnRleHQgPSAnZm9jdXNlZCc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250ZXh0ID0gY29udHJvbGxlcjtcblx0XHRcdH1cblx0XHRcdENoYXRTeW50aGVzaXplclNlc3Npb25zLmdldEluc3RhbmNlKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpLnN0YXJ0KHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gQ2hhdFN5bnRoZXNpemVyU2Vzc2lvbkNvbnRyb2xsZXIuY3JlYXRlKGFjY2Vzc29yLCBjb250ZXh0LCByZXNwb25zZSkpKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFZPSUNFX0tFWV9IT0xEX1RIUkVTSE9MRCA9IDUwMDtcblxuYXN5bmMgZnVuY3Rpb24gc3RhcnRWb2ljZUNoYXRXaXRoSG9sZE1vZGUoaWQ6IHN0cmluZywgYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHRhcmdldDogJ3ZpZXcnIHwgJ2lubGluZScgfCAncXVpY2snIHwgJ2ZvY3VzZWQnLCBjb250ZXh0PzogSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRjb25zdCBrZXliaW5kaW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJS2V5YmluZGluZ1NlcnZpY2UpO1xuXG5cdGNvbnN0IGhvbGRNb2RlID0ga2V5YmluZGluZ1NlcnZpY2UuZW5hYmxlS2V5YmluZGluZ0hvbGRNb2RlKGlkKTtcblxuXHRjb25zdCBjb250cm9sbGVyID0gYXdhaXQgVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXJGYWN0b3J5LmNyZWF0ZShhY2Nlc3NvciwgdGFyZ2V0KTtcblx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IFZvaWNlQ2hhdFNlc3Npb25zLmdldEluc3RhbmNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKS5zdGFydChjb250cm9sbGVyLCBjb250ZXh0KTtcblxuXHRsZXQgYWNjZXB0Vm9pY2UgPSBmYWxzZTtcblx0Y29uc3QgaGFuZGxlID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdGFjY2VwdFZvaWNlID0gdHJ1ZTtcblx0XHRzZXNzaW9uPy5zZXRUaW1lb3V0RGlzYWJsZWQodHJ1ZSk7IC8vIGRpc2FibGUgYWNjZXB0IG9uIHRpbWVvdXQgd2hlbiBob2xkIG1vZGUgcnVucyBmb3IgVk9JQ0VfS0VZX0hPTERfVEhSRVNIT0xEXG5cdH0sIFZPSUNFX0tFWV9IT0xEX1RIUkVTSE9MRCk7XG5cdGF3YWl0IGhvbGRNb2RlO1xuXHRoYW5kbGUuZGlzcG9zZSgpO1xuXG5cdGlmIChhY2NlcHRWb2ljZSkge1xuXHRcdHNlc3Npb24uYWNjZXB0KCk7XG5cdH1cbn1cblxuY2xhc3MgVm9pY2VDaGF0V2l0aEhvbGRNb2RlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoZGVzYzogUmVhZG9ubHk8SUFjdGlvbjJPcHRpb25zPiwgcHJpdmF0ZSByZWFkb25seSB0YXJnZXQ6ICd2aWV3JyB8ICdpbmxpbmUnIHwgJ3F1aWNrJykge1xuXHRcdHN1cGVyKGRlc2MpO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBzdGFydFZvaWNlQ2hhdFdpdGhIb2xkTW9kZSh0aGlzLmRlc2MuaWQsIGFjY2Vzc29yLCB0aGlzLnRhcmdldCwgY29udGV4dCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFZvaWNlQ2hhdEluQ2hhdFZpZXdBY3Rpb24gZXh0ZW5kcyBWb2ljZUNoYXRXaXRoSG9sZE1vZGVBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudm9pY2VDaGF0SW5DaGF0Vmlldyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZvaWNlQ2hhdEluQ2hhdFZpZXdBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQudm9pY2VDaGF0SW5WaWV3LmxhYmVsJywgXCJWb2ljZSBDaGF0IGluIENoYXQgVmlld1wiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdENhblZvaWNlQ2hhdCxcblx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpIC8vIGRpc2FibGUgd2hlbiBhIGNoYXQgcmVxdWVzdCBpcyBpbiBwcm9ncmVzc1xuXHRcdFx0KSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSwgJ3ZpZXcnKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSG9sZFRvVm9pY2VDaGF0SW5DaGF0Vmlld0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuaG9sZFRvVm9pY2VDaGF0SW5DaGF0Vmlldyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEhvbGRUb1ZvaWNlQ2hhdEluQ2hhdFZpZXdBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQuaG9sZFRvVm9pY2VDaGF0SW5DaGF0Vmlldy5sYWJlbCcsIFwiSG9sZCB0byBWb2ljZSBDaGF0IGluIENoYXQgVmlld1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRDYW5Wb2ljZUNoYXQsXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpLCBcdC8vIGRpc2FibGUgd2hlbiBhIGNoYXQgcmVxdWVzdCBpcyBpbiBwcm9ncmVzc1xuXHRcdFx0XHRcdEZvY3VzSW5DaGF0SW5wdXQ/Lm5lZ2F0ZSgpLFx0XHRcdFx0XHQvLyB3aGVuIGFscmVhZHkgaW4gY2hhdCBpbnB1dCwgZGlzYWJsZSB0aGlzIGFjdGlvbiBhbmQgcHJlZmVyIHRvIHN0YXJ0IHZvaWNlIGNoYXQgZGlyZWN0bHlcblx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5mb2N1cy5uZWdhdGUoKSwgXHRcdFx0Ly8gZG8gbm90IHN0ZWFsIHRoZSBpbmxpbmUtY2hhdCBrZXliaW5kaW5nXG5cdFx0XHRcdFx0Tk9URUJPT0tfRURJVE9SX0ZPQ1VTRUQubmVnYXRlKCksXHRcdFx0Ly8gZG8gbm90IHN0ZWFsIHRoZSBub3RlYm9vayBrZXliaW5kaW5nXG5cdFx0XHRcdFx0U2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3Rm9jdXNlZEtleS5uZWdhdGUoKVx0Ly8gZG8gbm90IHN0ZWFsIHRoZSBzZWFyY2gga2V5YmluZGluZ1xuXHRcdFx0XHQpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0PzogSUNoYXRFeGVjdXRlQWN0aW9uQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gVGhlIGludGVudCBvZiB0aGlzIGFjdGlvbiBpcyB0byBwcm92aWRlIDIgbW9kZXMgdG8gYWxpZ24gd2l0aCB3aGF0IGBDdHJsY21kK0lgIGluIGlubGluZSBjaGF0OlxuXHRcdC8vIC0gaWYgdGhlIHVzZXIgcHJlc3MgYW5kIGhvbGRzLCB3ZSBzdGFydCB2b2ljZSBjaGF0IGluIHRoZSBjaGF0IHZpZXdcblx0XHQvLyAtIGlmIHRoZSB1c2VyIHByZXNzIGFuZCByZWxlYXNlcyBxdWlja2x5IGVub3VnaCwgd2UganVzdCBvcGVuIHRoZSBjaGF0IHZpZXcgd2l0aG91dCB2b2ljZSBjaGF0XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGtleWJpbmRpbmdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElLZXliaW5kaW5nU2VydmljZSk7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgaG9sZE1vZGUgPSBrZXliaW5kaW5nU2VydmljZS5lbmFibGVLZXliaW5kaW5nSG9sZE1vZGUoSG9sZFRvVm9pY2VDaGF0SW5DaGF0Vmlld0FjdGlvbi5JRCk7XG5cblx0XHRsZXQgc2Vzc2lvbjogSVZvaWNlQ2hhdFNlc3Npb24gfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaGFuZGxlID0gZGlzcG9zYWJsZVRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udHJvbGxlciA9IGF3YWl0IFZvaWNlQ2hhdFNlc3Npb25Db250cm9sbGVyRmFjdG9yeS5jcmVhdGUoYWNjZXNzb3IsICd2aWV3Jyk7XG5cdFx0XHRpZiAoY29udHJvbGxlcikge1xuXHRcdFx0XHRzZXNzaW9uID0gYXdhaXQgVm9pY2VDaGF0U2Vzc2lvbnMuZ2V0SW5zdGFuY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpLnN0YXJ0KGNvbnRyb2xsZXIsIGNvbnRleHQpO1xuXHRcdFx0XHRzZXNzaW9uLnNldFRpbWVvdXREaXNhYmxlZCh0cnVlKTtcblx0XHRcdH1cblx0XHR9LCBWT0lDRV9LRVlfSE9MRF9USFJFU0hPTEQpO1xuXG5cdFx0KGF3YWl0IHNob3dDaGF0Vmlldyh2aWV3c1NlcnZpY2UpKT8uZm9jdXNJbnB1dCgpO1xuXG5cdFx0YXdhaXQgaG9sZE1vZGU7XG5cdFx0aGFuZGxlLmRpc3Bvc2UoKTtcblxuXHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRzZXNzaW9uLmFjY2VwdCgpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5saW5lVm9pY2VDaGF0QWN0aW9uIGV4dGVuZHMgVm9pY2VDaGF0V2l0aEhvbGRNb2RlQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmlubGluZVZvaWNlQ2hhdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IElubGluZVZvaWNlQ2hhdEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5pbmxpbmVWb2ljZUNoYXQnLCBcIklubGluZSBWb2ljZSBDaGF0XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q2FuVm9pY2VDaGF0LFxuXHRcdFx0XHRBY3RpdmVFZGl0b3JDb250ZXh0LFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkgLy8gZGlzYWJsZSB3aGVuIGEgY2hhdCByZXF1ZXN0IGlzIGluIHByb2dyZXNzXG5cdFx0XHQpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9LCAnaW5saW5lJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFF1aWNrVm9pY2VDaGF0QWN0aW9uIGV4dGVuZHMgVm9pY2VDaGF0V2l0aEhvbGRNb2RlQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnF1aWNrVm9pY2VDaGF0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogUXVpY2tWb2ljZUNoYXRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQucXVpY2tWb2ljZUNoYXQubGFiZWwnLCBcIlF1aWNrIFZvaWNlIENoYXRcIiksXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDYW5Wb2ljZUNoYXQsXG5cdFx0XHRcdENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSAvLyBkaXNhYmxlIHdoZW4gYSBjaGF0IHJlcXVlc3QgaXMgaW4gcHJvZ3Jlc3Ncblx0XHRcdCksXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0sICdxdWljaycpO1xuXHR9XG59XG5cbmNvbnN0IHByaW1hcnlWb2ljZUFjdGlvbk1lbnUgPSAod2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQpID0+IHtcblx0cmV0dXJuIFtcblx0XHR7XG5cdFx0XHRpZDogTWVudUlkLkNoYXRJbnB1dCxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihDaGF0Q29udGV4dEtleXMubG9jYXRpb24uaXNFcXVhbFRvKENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKSwgQ2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmlzRXF1YWxUbyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbikpLCB3aGVuKSxcblx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRvcmRlcjogM1xuXHRcdH0sXG5cdFx0e1xuXHRcdFx0aWQ6IE1lbnVJZC5DaGF0RXhlY3V0ZSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMubG9jYXRpb24uaXNFcXVhbFRvKENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKS5uZWdhdGUoKSwgQ2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmlzRXF1YWxUbyhDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbikubmVnYXRlKCksIHdoZW4pLFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiAyXG5cdFx0fVxuXHRdO1xufTtcblxuZXhwb3J0IGNsYXNzIFN0YXJ0Vm9pY2VDaGF0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdGFydFZvaWNlQ2hhdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFN0YXJ0Vm9pY2VDaGF0QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0LnN0YXJ0Vm9pY2VDaGF0LmxhYmVsJywgXCJTdGFydCBWb2ljZSBDaGF0XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRGb2N1c0luQ2hhdElucHV0LFx0XHRcdFx0XHQvLyBzY29wZSB0aGlzIGFjdGlvbiB0byBjaGF0IGlucHV0IGZpZWxkcyBvbmx5XG5cdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuZm9jdXMubmVnYXRlKCksIFx0Ly8gZG8gbm90IHN0ZWFsIHRoZSBlZGl0b3IgaW5saW5lLWNoYXQga2V5YmluZGluZ1xuXHRcdFx0XHRcdE5PVEVCT09LX0VESVRPUl9GT0NVU0VELm5lZ2F0ZSgpXHQvLyBkbyBub3Qgc3RlYWwgdGhlIG5vdGVib29rIGlubGluZS1jaGF0IGtleWJpbmRpbmdcblx0XHRcdFx0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUlcblx0XHRcdH0sXG5cdFx0XHRpY29uOiBDb2RpY29uLm1pYyxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDYW5Wb2ljZUNoYXQsXG5cdFx0XHRcdFNjb3BlZFZvaWNlQ2hhdEdldHRpbmdSZWFkeS5uZWdhdGUoKSxcdC8vIGRpc2FibGUgd2hlbiB2b2ljZSBjaGF0IGlzIGdldHRpbmcgcmVhZHlcblx0XHRcdFx0QW55Q2hhdFJlcXVlc3RJblByb2dyZXNzPy5uZWdhdGUoKSxcdFx0Ly8gZGlzYWJsZSB3aGVuIGFueSBjaGF0IHJlcXVlc3QgaXMgaW4gcHJvZ3Jlc3Ncblx0XHRcdFx0U3BlZWNoVG9UZXh0SW5Qcm9ncmVzcy5uZWdhdGUoKVx0XHRcdC8vIGRpc2FibGUgd2hlbiBzcGVlY2ggdG8gdGV4dCBpcyBpbiBwcm9ncmVzc1xuXHRcdFx0KSxcblx0XHRcdG1lbnU6IHByaW1hcnlWb2ljZUFjdGlvbk1lbnUoQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRIYXNTcGVlY2hQcm92aWRlcixcblx0XHRcdFx0U2NvcGVkQ2hhdFN5bnRoZXNpc0luUHJvZ3Jlc3MubmVnYXRlKCksXHQvLyBoaWRlIHdoZW4gdGV4dCB0byBzcGVlY2ggaXMgaW4gcHJvZ3Jlc3Ncblx0XHRcdFx0QW55U2NvcGVkVm9pY2VDaGF0SW5Qcm9ncmVzcz8ubmVnYXRlKCksXHQvLyBoaWRlIHdoZW4gdm9pY2UgY2hhdCBpcyBpbiBwcm9ncmVzc1xuXHRcdFx0KSlcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dD86IElDaGF0RXhlY3V0ZUFjdGlvbkNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3aWRnZXQgPSBjb250ZXh0Py53aWRnZXQ7XG5cdFx0aWYgKHdpZGdldCkge1xuXHRcdFx0Ly8gaWYgd2UgYWxyZWFkeSBnZXQgYSBjb250ZXh0IHdoZW4gdGhlIGFjdGlvbiBpcyBleGVjdXRlZFxuXHRcdFx0Ly8gZnJvbSBhIHRvb2xiYXIgd2l0aGluIHRoZSBjaGF0IHdpZGdldCwgdGhlbiBtYWtlIHN1cmVcblx0XHRcdC8vIHRvIG1vdmUgZm9jdXMgaW50byB0aGUgaW5wdXQgZmllbGQgc28gdGhhdCB0aGUgY29udHJvbGxlclxuXHRcdFx0Ly8gaXMgcHJvcGVybHkgcmV0cmlldmVkXG5cdFx0XHR3aWRnZXQuZm9jdXNJbnB1dCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdGFydFZvaWNlQ2hhdFdpdGhIb2xkTW9kZSh0aGlzLmRlc2MuaWQsIGFjY2Vzc29yLCAnZm9jdXNlZCcsIGNvbnRleHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9wTGlzdGVuaW5nQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdG9wTGlzdGVuaW5nJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU3RvcExpc3RlbmluZ0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdG9wTGlzdGVuaW5nLmxhYmVsJywgXCJTdG9wIExpc3RlbmluZ1wiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMTAwLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0d2hlbjogQW55U2NvcGVkVm9pY2VDaGF0SW5Qcm9ncmVzc1xuXHRcdFx0fSxcblx0XHRcdGljb246IHNwaW5uaW5nTG9hZGluZyxcblx0XHRcdHByZWNvbmRpdGlvbjogR2xvYmFsVm9pY2VDaGF0SW5Qcm9ncmVzcywgLy8gbmVlZCBnbG9iYWwgY29udGV4dCBoZXJlIGJlY2F1c2Ugb2YgYGYxOiB0cnVlYFxuXHRcdFx0bWVudTogcHJpbWFyeVZvaWNlQWN0aW9uTWVudShBbnlTY29wZWRWb2ljZUNoYXRJblByb2dyZXNzKVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Vm9pY2VDaGF0U2Vzc2lvbnMuZ2V0SW5zdGFuY2UoYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkpLnN0b3AoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcExpc3RlbmluZ0FuZFN1Ym1pdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc3RvcExpc3RlbmluZ0FuZFN1Ym1pdCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFN0b3BMaXN0ZW5pbmdBbmRTdWJtaXRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc3RvcExpc3RlbmluZ0FuZFN1Ym1pdC5sYWJlbCcsIFwiU3RvcCBMaXN0ZW5pbmcgYW5kIFN1Ym1pdFwiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Rm9jdXNJbkNoYXRJbnB1dCxcblx0XHRcdFx0XHRBbnlTY29wZWRWb2ljZUNoYXRJblByb2dyZXNzXG5cdFx0XHRcdCksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlJXG5cdFx0XHR9LFxuXHRcdFx0cHJlY29uZGl0aW9uOiBHbG9iYWxWb2ljZUNoYXRJblByb2dyZXNzIC8vIG5lZWQgZ2xvYmFsIGNvbnRleHQgaGVyZSBiZWNhdXNlIG9mIGBmMTogdHJ1ZWBcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdFZvaWNlQ2hhdFNlc3Npb25zLmdldEluc3RhbmNlKGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpKS5hY2NlcHQoKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFRleHQgdG8gU3BlZWNoXG5cbmNvbnN0IFNjb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3Njb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzJywgZmFsc2UsIHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3Njb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzJywgXCJEZWZpbmVkIGFzIGEgbG9jYXRpb24gd2hlcmUgdm9pY2UgcmVjb3JkaW5nIGZyb20gbWljcm9waG9uZSBpcyBpbiBwcm9ncmVzcyBmb3Igdm9pY2UgY2hhdC4gVGhpcyBrZXkgaXMgb25seSBkZWZpbmVkIHNjb3BlZCwgcGVyIGNoYXQgY29udGV4dC5cIikgfSk7XG5cbmludGVyZmFjZSBJQ2hhdFN5bnRoZXNpemVyU2Vzc2lvbkNvbnRyb2xsZXIge1xuXG5cdHJlYWRvbmx5IG9uRGlkSGlkZUNoYXQ6IEV2ZW50PHVua25vd24+O1xuXG5cdHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cdHJlYWRvbmx5IHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWw7XG59XG5cbmNsYXNzIENoYXRTeW50aGVzaXplclNlc3Npb25Db250cm9sbGVyIHtcblxuXHRzdGF0aWMgY3JlYXRlKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJVm9pY2VDaGF0U2Vzc2lvbkNvbnRyb2xsZXIgfCAnZm9jdXNlZCcsIHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWwpOiBJQ2hhdFN5bnRoZXNpemVyU2Vzc2lvbkNvbnRyb2xsZXIge1xuXHRcdGlmIChjb250ZXh0ID09PSAnZm9jdXNlZCcpIHtcblx0XHRcdHJldHVybiBDaGF0U3ludGhlc2l6ZXJTZXNzaW9uQ29udHJvbGxlci5kb0NyZWF0ZUZvckZvY3VzZWRDaGF0KGFjY2Vzc29yLCByZXNwb25zZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdG9uRGlkSGlkZUNoYXQ6IGNvbnRleHQub25EaWRIaWRlSW5wdXQsXG5cdFx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBjb250ZXh0LnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0XHRyZXNwb25zZVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBkb0NyZWF0ZUZvckZvY3VzZWRDaGF0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNwb25zZTogSUNoYXRSZXNwb25zZU1vZGVsKTogSUNoYXRTeW50aGVzaXplclNlc3Npb25Db250cm9sbGVyIHtcblx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0bGV0IGNoYXRXaWRnZXQgPSBjaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChyZXNwb25zZS5zZXNzaW9uLnNlc3Npb25JZCk7XG5cdFx0aWYgKGNoYXRXaWRnZXQ/LmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdC8vIHdvcmthcm91bmQgZm9yIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMTI3ODVcblx0XHRcdGNoYXRXaWRnZXQgPSBjaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0b25EaWRIaWRlQ2hhdDogY2hhdFdpZGdldD8ub25EaWRIaWRlID8/IEV2ZW50Lk5vbmUsXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZTogY2hhdFdpZGdldD8uc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgPz8gY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRyZXNwb25zZVxuXHRcdH07XG5cdH1cbn1cblxuaW50ZXJmYWNlIElDaGF0U3ludGhlc2l6ZXJDb250ZXh0IHtcblx0cmVhZG9ubHkgaWdub3JlQ29kZUJsb2NrczogYm9vbGVhbjtcblx0aW5zaWRlQ29kZUJsb2NrOiBib29sZWFuO1xufVxuXG5jbGFzcyBDaGF0U3ludGhlc2l6ZXJTZXNzaW9ucyB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2U6IENoYXRTeW50aGVzaXplclNlc3Npb25zIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRzdGF0aWMgZ2V0SW5zdGFuY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IENoYXRTeW50aGVzaXplclNlc3Npb25zIHtcblx0XHRpZiAoIUNoYXRTeW50aGVzaXplclNlc3Npb25zLmluc3RhbmNlKSB7XG5cdFx0XHRDaGF0U3ludGhlc2l6ZXJTZXNzaW9ucy5pbnN0YW5jZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRTeW50aGVzaXplclNlc3Npb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gQ2hhdFN5bnRoZXNpemVyU2Vzc2lvbnMuaW5zdGFuY2U7XG5cdH1cblxuXHRwcml2YXRlIGFjdGl2ZVNlc3Npb246IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3BlZWNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNwZWVjaFNlcnZpY2U6IElTcGVlY2hTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgc3RhcnQoY29udHJvbGxlcjogSUNoYXRTeW50aGVzaXplclNlc3Npb25Db250cm9sbGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBTdG9wIHJ1bm5pbmcgdGV4dC10by1zcGVlY2ggb3Igc3BlZWNoLXRvLXRleHQgc2Vzc2lvbnMgaW4gY2hhdHNcblx0XHR0aGlzLnN0b3AoKTtcblx0XHRWb2ljZUNoYXRTZXNzaW9ucy5nZXRJbnN0YW5jZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKS5zdG9wKCk7XG5cblx0XHRjb25zdCBhY3RpdmVTZXNzaW9uID0gdGhpcy5hY3RpdmVTZXNzaW9uID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRhY3RpdmVTZXNzaW9uLnRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5zcGVlY2hTZXJ2aWNlLmNyZWF0ZVRleHRUb1NwZWVjaFNlc3Npb24oYWN0aXZlU2Vzc2lvbi50b2tlbiwgJ2NoYXQnKTtcblxuXHRcdGlmIChhY3RpdmVTZXNzaW9uLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGNvbnRyb2xsZXIub25EaWRIaWRlQ2hhdCgoKSA9PiB0aGlzLnN0b3AoKSkpO1xuXG5cdFx0Y29uc3Qgc2NvcGVkQ2hhdFRvU3BlZWNoSW5Qcm9ncmVzcyA9IFNjb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzLmJpbmRUbyhjb250cm9sbGVyLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHNjb3BlZENoYXRUb1NwZWVjaEluUHJvZ3Jlc3MucmVzZXQoKSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24ub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUuc3RhdHVzKSB7XG5cdFx0XHRcdGNhc2UgVGV4dFRvU3BlZWNoU3RhdHVzLlN0YXJ0ZWQ6XG5cdFx0XHRcdFx0c2NvcGVkQ2hhdFRvU3BlZWNoSW5Qcm9ncmVzcy5zZXQodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVGV4dFRvU3BlZWNoU3RhdHVzLlN0b3BwZWQ6XG5cdFx0XHRcdFx0c2NvcGVkQ2hhdFRvU3BlZWNoSW5Qcm9ncmVzcy5yZXNldCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgdGhpcy5uZXh0Q2hhdFJlc3BvbnNlQ2h1bmsoY29udHJvbGxlci5yZXNwb25zZSwgYWN0aXZlU2Vzc2lvbi50b2tlbikpIHtcblx0XHRcdGlmIChhY3RpdmVTZXNzaW9uLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgcmFjZUNhbmNlbGxhdGlvbihzZXNzaW9uLnN5bnRoZXNpemUoY2h1bmspLCBhY3RpdmVTZXNzaW9uLnRva2VuKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jICpuZXh0Q2hhdFJlc3BvbnNlQ2h1bmsocmVzcG9uc2U6IElDaGF0UmVzcG9uc2VNb2RlbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogQXN5bmNJdGVyYWJsZTxzdHJpbmc+IHtcblx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdFN5bnRoZXNpemVyQ29udGV4dCA9IHtcblx0XHRcdGlnbm9yZUNvZGVCbG9ja3M6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oQWNjZXNzaWJpbGl0eVZvaWNlU2V0dGluZ0lkLklnbm9yZUNvZGVCbG9ja3MpLFxuXHRcdFx0aW5zaWRlQ29kZUJsb2NrOiBmYWxzZVxuXHRcdH07XG5cblx0XHRsZXQgdG90YWxPZmZzZXQgPSAwO1xuXHRcdGxldCBjb21wbGV0ZSA9IGZhbHNlO1xuXHRcdGRvIHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlTGVuZ3RoID0gcmVzcG9uc2UucmVzcG9uc2UudG9TdHJpbmcoKS5sZW5ndGg7XG5cdFx0XHRjb25zdCB7IGNodW5rLCBvZmZzZXQgfSA9IHRoaXMucGFyc2VOZXh0Q2hhdFJlc3BvbnNlQ2h1bmsocmVzcG9uc2UsIHRvdGFsT2Zmc2V0LCBjb250ZXh0KTtcblx0XHRcdHRvdGFsT2Zmc2V0ID0gb2Zmc2V0O1xuXHRcdFx0Y29tcGxldGUgPSByZXNwb25zZS5pc0NvbXBsZXRlO1xuXG5cdFx0XHRpZiAoY2h1bmspIHtcblx0XHRcdFx0eWllbGQgY2h1bms7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICghY29tcGxldGUgJiYgcmVzcG9uc2VMZW5ndGggPT09IHJlc3BvbnNlLnJlc3BvbnNlLnRvU3RyaW5nKCkubGVuZ3RoKSB7XG5cdFx0XHRcdGF3YWl0IHJhY2VDYW5jZWxsYXRpb24oRXZlbnQudG9Qcm9taXNlKHJlc3BvbnNlLm9uRGlkQ2hhbmdlKSwgdG9rZW4pOyAvLyB3YWl0IGZvciB0aGUgcmVzcG9uc2UgdG8gY2hhbmdlXG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoIXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkICYmICFjb21wbGV0ZSk7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlTmV4dENoYXRSZXNwb25zZUNodW5rKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlTW9kZWwsIG9mZnNldDogbnVtYmVyLCBjb250ZXh0OiBJQ2hhdFN5bnRoZXNpemVyQ29udGV4dCk6IHsgcmVhZG9ubHkgY2h1bms6IHN0cmluZyB8IHVuZGVmaW5lZDsgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXIgfSB7XG5cdFx0bGV0IGNodW5rOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB0ZXh0ID0gcmVzcG9uc2UucmVzcG9uc2UudG9TdHJpbmcoKTtcblxuXHRcdGlmIChyZXNwb25zZS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRjaHVuayA9IHRleHQuc3Vic3RyaW5nKG9mZnNldCk7XG5cdFx0XHRvZmZzZXQgPSB0ZXh0Lmxlbmd0aCArIDE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHJlcyA9IHBhcnNlTmV4dENoYXRSZXNwb25zZUNodW5rKHRleHQsIG9mZnNldCk7XG5cdFx0XHRjaHVuayA9IHJlcy5jaHVuaztcblx0XHRcdG9mZnNldCA9IHJlcy5vZmZzZXQ7XG5cdFx0fVxuXG5cdFx0aWYgKGNodW5rICYmIGNvbnRleHQuaWdub3JlQ29kZUJsb2Nrcykge1xuXHRcdFx0Y2h1bmsgPSB0aGlzLmZpbHRlckNvZGVCbG9ja3MoY2h1bmssIGNvbnRleHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRjaHVuazogY2h1bmsgPyByZW5kZXJTdHJpbmdBc1BsYWludGV4dCh7IHZhbHVlOiBjaHVuayB9KSA6IGNodW5rLCAvLyBjb252ZXJ0IG1hcmtkb3duIHRvIHBsYWluIHRleHRcblx0XHRcdG9mZnNldFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckNvZGVCbG9ja3MoY2h1bms6IHN0cmluZywgY29udGV4dDogSUNoYXRTeW50aGVzaXplckNvbnRleHQpOiBzdHJpbmcge1xuXHRcdHJldHVybiBjaHVuay5zcGxpdCgnXFxuJylcblx0XHRcdC5maWx0ZXIobGluZSA9PiB7XG5cdFx0XHRcdGlmIChsaW5lLnRyaW1TdGFydCgpLnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG5cdFx0XHRcdFx0Y29udGV4dC5pbnNpZGVDb2RlQmxvY2sgPSAhY29udGV4dC5pbnNpZGVDb2RlQmxvY2s7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAhY29udGV4dC5pbnNpZGVDb2RlQmxvY2s7XG5cdFx0XHR9KVxuXHRcdFx0LmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0c3RvcCgpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVNlc3Npb24/LmRpc3Bvc2UodHJ1ZSk7XG5cdFx0dGhpcy5hY3RpdmVTZXNzaW9uID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmNvbnN0IHNlbnRlbmNlRGVsaW1pdGVyID0gWycuJywgJyEnLCAnPycsICc6J107XG5jb25zdCBsaW5lRGVsaW1pdGVyID0gJ1xcbic7XG5jb25zdCB3b3JkRGVsaW1pdGVyID0gJyAnO1xuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VOZXh0Q2hhdFJlc3BvbnNlQ2h1bmsodGV4dDogc3RyaW5nLCBvZmZzZXQ6IG51bWJlcik6IHsgcmVhZG9ubHkgY2h1bms6IHN0cmluZyB8IHVuZGVmaW5lZDsgcmVhZG9ubHkgb2Zmc2V0OiBudW1iZXIgfSB7XG5cdGxldCBjaHVuazogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGZvciAobGV0IGkgPSB0ZXh0Lmxlbmd0aCAtIDE7IGkgPj0gb2Zmc2V0OyBpLS0pIHsgLy8gZ29pbmcgZnJvbSBlbmQgdG8gc3RhcnQgdG8gcHJvZHVjZSBsYXJnZXN0IGNodW5rc1xuXHRcdGNvbnN0IGN1ciA9IHRleHRbaV07XG5cdFx0Y29uc3QgbmV4dCA9IHRleHRbaSArIDFdO1xuXHRcdGlmIChcblx0XHRcdHNlbnRlbmNlRGVsaW1pdGVyLmluY2x1ZGVzKGN1cikgJiYgbmV4dCA9PT0gd29yZERlbGltaXRlciB8fFx0Ly8gZW5kIG9mIHNlbnRlbmNlXG5cdFx0XHRsaW5lRGVsaW1pdGVyID09PSBjdXJcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZW5kIG9mIGxpbmVcblx0XHQpIHtcblx0XHRcdGNodW5rID0gdGV4dC5zdWJzdHJpbmcob2Zmc2V0LCBpICsgMSkudHJpbSgpO1xuXHRcdFx0b2Zmc2V0ID0gaSArIDE7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBjaHVuaywgb2Zmc2V0IH07XG59XG5cbmV4cG9ydCBjbGFzcyBSZWFkQ2hhdFJlc3BvbnNlQWxvdWQgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQucmVhZENoYXRSZXNwb25zZUFsb3VkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5yZWFkQ2hhdFJlc3BvbnNlQWxvdWQnLCBcIlJlYWQgQWxvdWRcIiksXG5cdFx0XHRpY29uOiBDb2RpY29uLnVubXV0ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ2FuVm9pY2VDaGF0LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0TWVzc2FnZUZvb3Rlcixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENhblZvaWNlQ2hhdCxcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSxcdFx0XHRcdFx0XHQvLyBvbmx5IGZvciByZXNwb25zZXNcblx0XHRcdFx0XHRTY29wZWRDaGF0U3ludGhlc2lzSW5Qcm9ncmVzcy5uZWdhdGUoKSxcdC8vIGJ1dCBub3Qgd2hlbiBhbHJlYWR5IGluIHByb2dyZXNzXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSXNGaWx0ZXJlZC5uZWdhdGUoKSxcdFx0Ly8gYW5kIG5vdCB3aGVuIHJlc3BvbnNlIGlzIGZpbHRlcmVkXG5cdFx0XHRcdCksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAtMTAgLy8gZmlyc3Rcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1FTlVfSU5MSU5FX0NIQVRfV0lER0VUX1NFQ09OREFSWSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENhblZvaWNlQ2hhdCxcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSxcdFx0XHRcdFx0XHQvLyBvbmx5IGZvciByZXNwb25zZXNcblx0XHRcdFx0XHRTY29wZWRDaGF0U3ludGhlc2lzSW5Qcm9ncmVzcy5uZWdhdGUoKSxcdC8vIGJ1dCBub3Qgd2hlbiBhbHJlYWR5IGluIHByb2dyZXNzXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSXNGaWx0ZXJlZC5uZWdhdGUoKVx0XHQvLyBhbmQgbm90IHdoZW4gcmVzcG9uc2UgaXMgZmlsdGVyZWRcblx0XHRcdFx0KSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IC0xMCAvLyBmaXJzdFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNoYXRXaWRnZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0V2lkZ2V0U2VydmljZSk7XG5cblx0XHRsZXQgcmVzcG9uc2U6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGFyZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2VBcmcgPSBhcmdzWzBdO1xuXHRcdFx0aWYgKGlzUmVzcG9uc2VWTShyZXNwb25zZUFyZykpIHtcblx0XHRcdFx0cmVzcG9uc2UgPSByZXNwb25zZUFyZztcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgY2hhdFdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdFx0aWYgKGNoYXRXaWRnZXQpIHtcblxuXHRcdFx0XHQvLyBwaWNrIGZvY3VzZWQgcmVzcG9uc2Vcblx0XHRcdFx0Y29uc3QgZm9jdXMgPSBjaGF0V2lkZ2V0LmdldEZvY3VzKCk7XG5cdFx0XHRcdGlmIChmb2N1cyBpbnN0YW5jZW9mIENoYXRSZXNwb25zZVZpZXdNb2RlbCkge1xuXHRcdFx0XHRcdHJlc3BvbnNlID0gZm9jdXM7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBwaWNrIHRoZSBsYXN0IHJlc3BvbnNlXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGNoYXRWaWV3TW9kZWwgPSBjaGF0V2lkZ2V0LnZpZXdNb2RlbDtcblx0XHRcdFx0XHRpZiAoY2hhdFZpZXdNb2RlbCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbXMgPSBjaGF0Vmlld01vZGVsLmdldEl0ZW1zKCk7XG5cdFx0XHRcdFx0XHRmb3IgKGxldCBpID0gaXRlbXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zW2ldO1xuXHRcdFx0XHRcdFx0XHRpZiAoaXNSZXNwb25zZVZNKGl0ZW0pKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmVzcG9uc2UgPSBpdGVtO1xuXHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXNwb25zZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDaGF0U3ludGhlc2l6ZXJTZXNzaW9uQ29udHJvbGxlci5jcmVhdGUoYWNjZXNzb3IsICdmb2N1c2VkJywgcmVzcG9uc2UubW9kZWwpO1xuXHRcdENoYXRTeW50aGVzaXplclNlc3Npb25zLmdldEluc3RhbmNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKS5zdGFydChjb250cm9sbGVyKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcFJlYWRBbG91ZCBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnNwZWVjaC5zdG9wUmVhZEFsb3VkJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU3RvcFJlYWRBbG91ZC5JRCxcblx0XHRcdGljb246IHN5bmNpbmcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLnNwZWVjaC5zdG9wUmVhZEFsb3VkJywgXCJTdG9wIFJlYWRpbmcgQWxvdWRcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBHbG9iYWxUZXh0VG9TcGVlY2hJblByb2dyZXNzLCAvLyBuZWVkIGdsb2JhbCBjb250ZXh0IGhlcmUgYmVjYXVzZSBvZiBgZjE6IHRydWVgXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgMTAwLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0d2hlbjogU2NvcGVkQ2hhdFN5bnRoZXNpc0luUHJvZ3Jlc3Ncblx0XHRcdH0sXG5cdFx0XHRtZW51OiBwcmltYXJ5Vm9pY2VBY3Rpb25NZW51KFNjb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzKVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Q2hhdFN5bnRoZXNpemVyU2Vzc2lvbnMuZ2V0SW5zdGFuY2UoYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkpLnN0b3AoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcFJlYWRDaGF0SXRlbUFsb3VkIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5zdG9wUmVhZENoYXRJdGVtQWxvdWQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTdG9wUmVhZENoYXRJdGVtQWxvdWQuSUQsXG5cdFx0XHRpY29uOiBDb2RpY29uLm11dGUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQuc3RvcFJlYWRDaGF0SXRlbUFsb3VkJywgXCJTdG9wIFJlYWRpbmcgQWxvdWRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IFNjb3BlZENoYXRTeW50aGVzaXNJblByb2dyZXNzLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEwMCxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0TWVzc2FnZUZvb3Rlcixcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRTY29wZWRDaGF0U3ludGhlc2lzSW5Qcm9ncmVzcyxcdFx0Ly8gb25seSB3aGVuIGluIHByb2dyZXNzXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSxcdFx0XHRcdFx0Ly8gb25seSBmb3IgcmVzcG9uc2VzXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VJc0ZpbHRlcmVkLm5lZ2F0ZSgpXHQvLyBidXQgbm90IHdoZW4gcmVzcG9uc2UgaXMgZmlsdGVyZWRcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IC0xMCAvLyBmaXJzdFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1FTlVfSU5MSU5FX0NIQVRfV0lER0VUX1NFQ09OREFSWSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRTY29wZWRDaGF0U3ludGhlc2lzSW5Qcm9ncmVzcyxcdFx0Ly8gb25seSB3aGVuIGluIHByb2dyZXNzXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZSxcdFx0XHRcdFx0Ly8gb25seSBmb3IgcmVzcG9uc2VzXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VJc0ZpbHRlcmVkLm5lZ2F0ZSgpXHQvLyBidXQgbm90IHdoZW4gcmVzcG9uc2UgaXMgZmlsdGVyZWRcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IC0xMCAvLyBmaXJzdFxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Q2hhdFN5bnRoZXNpemVyU2Vzc2lvbnMuZ2V0SW5zdGFuY2UoYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkpLnN0b3AoKTtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIEtleXdvcmQgUmVjb2duaXRpb25cblxuZnVuY3Rpb24gc3VwcG9ydHNLZXl3b3JkQWN0aXZhdGlvbihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzcGVlY2hTZXJ2aWNlOiBJU3BlZWNoU2VydmljZSwgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UpOiBib29sZWFuIHtcblx0aWYgKCFzcGVlY2hTZXJ2aWNlLmhhc1NwZWVjaFByb3ZpZGVyIHx8ICFjaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCB2YWx1ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEtFWVdPUkRfQUNUSVZJQVRJT05fU0VUVElOR19JRCk7XG5cblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUgIT09IEtleXdvcmRBY3RpdmF0aW9uQ29udHJpYnV0aW9uLlNFVFRJTkdTX1ZBTFVFLk9GRjtcbn1cblxuZXhwb3J0IGNsYXNzIEtleXdvcmRBY3RpdmF0aW9uQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5rZXl3b3JkQWN0aXZhdGlvbic7XG5cblx0c3RhdGljIFNFVFRJTkdTX1ZBTFVFID0ge1xuXHRcdE9GRjogJ29mZicsXG5cdFx0SU5MSU5FX0NIQVQ6ICdpbmxpbmVDaGF0Jyxcblx0XHRRVUlDS19DSEFUOiAncXVpY2tDaGF0Jyxcblx0XHRWSUVXX0NIQVQ6ICdjaGF0SW5WaWV3Jyxcblx0XHRDSEFUX0lOX0NPTlRFWFQ6ICdjaGF0SW5Db250ZXh0J1xuXHR9O1xuXG5cdHByaXZhdGUgYWN0aXZlU2Vzc2lvbjogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTcGVlY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3BlZWNoU2VydmljZTogSVNwZWVjaFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoS2V5d29yZEFjdGl2YXRpb25TdGF0dXNFbnRyeSkpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5zcGVlY2hTZXJ2aWNlLm9uRGlkQ2hhbmdlSGFzU3BlZWNoUHJvdmlkZXIsICgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0dGhpcy5oYW5kbGVLZXl3b3JkQWN0aXZhdGlvbigpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG9uRGlkQWRkRGVmYXVsdEFnZW50ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5jaGF0QWdlbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWdlbnRzKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdFx0dGhpcy5oYW5kbGVLZXl3b3JkQWN0aXZhdGlvbigpO1xuXG5cdFx0XHRcdG9uRGlkQWRkRGVmYXVsdEFnZW50LmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNwZWVjaFNlcnZpY2Uub25EaWRTdGFydFNwZWVjaFRvVGV4dFNlc3Npb24oKCkgPT4gdGhpcy5oYW5kbGVLZXl3b3JkQWN0aXZhdGlvbigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zcGVlY2hTZXJ2aWNlLm9uRGlkRW5kU3BlZWNoVG9UZXh0U2Vzc2lvbigoKSA9PiB0aGlzLmhhbmRsZUtleXdvcmRBY3RpdmF0aW9uKCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oS0VZV09SRF9BQ1RJVklBVElPTl9TRVRUSU5HX0lEKSkge1xuXHRcdFx0XHR0aGlzLmhhbmRsZUtleXdvcmRBY3RpdmF0aW9uKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb25maWd1cmF0aW9uKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5zcGVlY2hTZXJ2aWNlLmhhc1NwZWVjaFByb3ZpZGVyIHx8ICF0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKSkge1xuXHRcdFx0cmV0dXJuOyAvLyB0aGVzZSBzZXR0aW5ncyByZXF1aXJlIGEgc3BlZWNoIGFuZCBjaGF0IHByb3ZpZGVyXG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0XHQuLi5hY2Nlc3NpYmlsaXR5Q29uZmlndXJhdGlvbk5vZGVCYXNlLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRbS0VZV09SRF9BQ1RJVklBVElPTl9TRVRUSU5HX0lEXToge1xuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdFx0J2VudW0nOiBbXG5cdFx0XHRcdFx0XHRLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5PRkYsXG5cdFx0XHRcdFx0XHRLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5WSUVXX0NIQVQsXG5cdFx0XHRcdFx0XHRLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5RVUlDS19DSEFULFxuXHRcdFx0XHRcdFx0S2V5d29yZEFjdGl2YXRpb25Db250cmlidXRpb24uU0VUVElOR1NfVkFMVUUuSU5MSU5FX0NIQVQsXG5cdFx0XHRcdFx0XHRLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5DSEFUX0lOX0NPTlRFWFRcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3ZvaWNlLmtleXdvcmRBY3RpdmF0aW9uLm9mZicsIFwiS2V5d29yZCBhY3RpdmF0aW9uIGlzIGRpc2FibGVkLlwiKSxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCd2b2ljZS5rZXl3b3JkQWN0aXZhdGlvbi5jaGF0SW5WaWV3JywgXCJLZXl3b3JkIGFjdGl2YXRpb24gaXMgZW5hYmxlZCBhbmQgbGlzdGVuaW5nIGZvciAnSGV5IENvZGUnIHRvIHN0YXJ0IGEgdm9pY2UgY2hhdCBzZXNzaW9uIGluIHRoZSBjaGF0IHZpZXcuXCIpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3ZvaWNlLmtleXdvcmRBY3RpdmF0aW9uLnF1aWNrQ2hhdCcsIFwiS2V5d29yZCBhY3RpdmF0aW9uIGlzIGVuYWJsZWQgYW5kIGxpc3RlbmluZyBmb3IgJ0hleSBDb2RlJyB0byBzdGFydCBhIHZvaWNlIGNoYXQgc2Vzc2lvbiBpbiB0aGUgcXVpY2sgY2hhdC5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgndm9pY2Uua2V5d29yZEFjdGl2YXRpb24uaW5saW5lQ2hhdCcsIFwiS2V5d29yZCBhY3RpdmF0aW9uIGlzIGVuYWJsZWQgYW5kIGxpc3RlbmluZyBmb3IgJ0hleSBDb2RlJyB0byBzdGFydCBhIHZvaWNlIGNoYXQgc2Vzc2lvbiBpbiB0aGUgYWN0aXZlIGVkaXRvciBpZiBwb3NzaWJsZS5cIiksXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgndm9pY2Uua2V5d29yZEFjdGl2YXRpb24uY2hhdEluQ29udGV4dCcsIFwiS2V5d29yZCBhY3RpdmF0aW9uIGlzIGVuYWJsZWQgYW5kIGxpc3RlbmluZyBmb3IgJ0hleSBDb2RlJyB0byBzdGFydCBhIHZvaWNlIGNoYXQgc2Vzc2lvbiBpbiB0aGUgYWN0aXZlIGVkaXRvciBvciB2aWV3IGRlcGVuZGluZyBvbiBrZXlib2FyZCBmb2N1cy5cIilcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd2b2ljZS5rZXl3b3JkQWN0aXZhdGlvbicsIFwiQ29udHJvbHMgd2hldGhlciB0aGUga2V5d29yZCBwaHJhc2UgJ0hleSBDb2RlJyBpcyByZWNvZ25pemVkIHRvIHN0YXJ0IGEgdm9pY2UgY2hhdCBzZXNzaW9uLiBFbmFibGluZyB0aGlzIHdpbGwgc3RhcnQgcmVjb3JkaW5nIGZyb20gdGhlIG1pY3JvcGhvbmUgYnV0IHRoZSBhdWRpbyBpcyBwcm9jZXNzZWQgbG9jYWxseSBhbmQgbmV2ZXIgc2VudCB0byBhIHNlcnZlci5cIiksXG5cdFx0XHRcdFx0J2RlZmF1bHQnOiAnb2ZmJyxcblx0XHRcdFx0XHQndGFncyc6IFsnYWNjZXNzaWJpbGl0eSddXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlS2V5d29yZEFjdGl2YXRpb24oKTogdm9pZCB7XG5cdFx0Y29uc3QgZW5hYmxlZCA9XG5cdFx0XHRzdXBwb3J0c0tleXdvcmRBY3RpdmF0aW9uKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuc3BlZWNoU2VydmljZSwgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlKSAmJlxuXHRcdFx0IXRoaXMuc3BlZWNoU2VydmljZS5oYXNBY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9uO1xuXHRcdGlmIChcblx0XHRcdChlbmFibGVkICYmIHRoaXMuYWN0aXZlU2Vzc2lvbikgfHxcblx0XHRcdCghZW5hYmxlZCAmJiAhdGhpcy5hY3RpdmVTZXNzaW9uKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuOyAvLyBhbHJlYWR5IHJ1bm5pbmcgb3Igc3RvcHBlZFxuXHRcdH1cblxuXHRcdC8vIFN0YXJ0IGtleXdvcmQgYWN0aXZhdGlvblxuXHRcdGlmIChlbmFibGVkKSB7XG5cdFx0XHR0aGlzLmVuYWJsZUtleXdvcmRBY3RpdmF0aW9uKCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RvcCBrZXl3b3JkIGFjdGl2YXRpb25cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuZGlzYWJsZUtleXdvcmRBY3RpdmF0aW9uKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBlbmFibGVLZXl3b3JkQWN0aXZhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5hY3RpdmVTZXNzaW9uID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5zcGVlY2hTZXJ2aWNlLnJlY29nbml6ZUtleXdvcmQoc2Vzc2lvbi50b2tlbik7XG5cdFx0aWYgKHNlc3Npb24udG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgc2Vzc2lvbiAhPT0gdGhpcy5hY3RpdmVTZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47IC8vIGNhbmNlbGxlZFxuXHRcdH1cblxuXHRcdHRoaXMuYWN0aXZlU2Vzc2lvbiA9IHVuZGVmaW5lZDtcblxuXHRcdGlmIChyZXN1bHQgPT09IEtleXdvcmRSZWNvZ25pdGlvblN0YXR1cy5SZWNvZ25pemVkKSB7XG5cdFx0XHRpZiAodGhpcy5ob3N0U2VydmljZS5oYXNGb2N1cykge1xuXHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHRoaXMuZ2V0S2V5d29yZENvbW1hbmQoKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEltbWVkaWF0ZWx5IHN0YXJ0IGFub3RoZXIga2V5Ym9hcmQgYWN0aXZhdGlvbiBzZXNzaW9uXG5cdFx0XHQvLyBiZWNhdXNlIHdlIGNhbm5vdCBhc3N1bWUgdGhhdCB0aGUgY29tbWFuZCB3ZSBleGVjdXRlXG5cdFx0XHQvLyB3aWxsIHRyaWdnZXIgYSBzcGVlY2ggcmVjb2duaXRpb24gc2Vzc2lvbi5cblxuXHRcdFx0dGhpcy5oYW5kbGVLZXl3b3JkQWN0aXZhdGlvbigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5d29yZENvbW1hbmQoKTogc3RyaW5nIHtcblx0XHRjb25zdCBzZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShLRVlXT1JEX0FDVElWSUFUSU9OX1NFVFRJTkdfSUQpO1xuXHRcdHN3aXRjaCAoc2V0dGluZykge1xuXHRcdFx0Y2FzZSBLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5JTkxJTkVfQ0hBVDpcblx0XHRcdFx0cmV0dXJuIElubGluZVZvaWNlQ2hhdEFjdGlvbi5JRDtcblx0XHRcdGNhc2UgS2V5d29yZEFjdGl2YXRpb25Db250cmlidXRpb24uU0VUVElOR1NfVkFMVUUuUVVJQ0tfQ0hBVDpcblx0XHRcdFx0cmV0dXJuIFF1aWNrVm9pY2VDaGF0QWN0aW9uLklEO1xuXHRcdFx0Y2FzZSBLZXl3b3JkQWN0aXZhdGlvbkNvbnRyaWJ1dGlvbi5TRVRUSU5HU19WQUxVRS5DSEFUX0lOX0NPTlRFWFQ6IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IGdldENvZGVFZGl0b3IodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sKTtcblx0XHRcdFx0aWYgKGFjdGl2ZUNvZGVFZGl0b3I/Lmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gSW5saW5lVm9pY2VDaGF0QWN0aW9uLklEO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gVm9pY2VDaGF0SW5DaGF0Vmlld0FjdGlvbi5JRDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRpc2FibGVLZXl3b3JkQWN0aXZhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVNlc3Npb24/LmRpc3Bvc2UodHJ1ZSk7XG5cdFx0dGhpcy5hY3RpdmVTZXNzaW9uID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVNlc3Npb24/LmRpc3Bvc2UoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBLZXl3b3JkQWN0aXZhdGlvblN0YXR1c0VudHJ5IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBlbnRyeSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj4oKSk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgU1RBVFVTX05BTUUgPSBsb2NhbGl6ZSgna2V5d29yZEFjdGl2YXRpb24uc3RhdHVzLm5hbWUnLCBcIlZvaWNlIEtleXdvcmQgQWN0aXZhdGlvblwiKTtcblx0cHJpdmF0ZSBzdGF0aWMgU1RBVFVTX0NPTU1BTkQgPSAna2V5d29yZEFjdGl2YXRpb24uc3RhdHVzLmNvbW1hbmQnO1xuXHRwcml2YXRlIHN0YXRpYyBTVEFUVVNfQUNUSVZFID0gbG9jYWxpemUoJ2tleXdvcmRBY3RpdmF0aW9uLnN0YXR1cy5hY3RpdmUnLCBcIkxpc3RlbmluZyB0byAnSGV5IENvZGUnLi4uXCIpO1xuXHRwcml2YXRlIHN0YXRpYyBTVEFUVVNfSU5BQ1RJVkUgPSBsb2NhbGl6ZSgna2V5d29yZEFjdGl2YXRpb24uc3RhdHVzLmluYWN0aXZlJywgXCJXYWl0aW5nIGZvciB2b2ljZSBjaGF0IHRvIGVuZC4uLlwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVNwZWVjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzcGVlY2hTZXJ2aWNlOiBJU3BlZWNoU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoS2V5d29yZEFjdGl2YXRpb25TdGF0dXNFbnRyeS5TVEFUVVNfQ09NTUFORCwgKCkgPT4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MnLCBLRVlXT1JEX0FDVElWSUFUSU9OX1NFVFRJTkdfSUQpKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy51cGRhdGVTdGF0dXNFbnRyeSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNwZWVjaFNlcnZpY2Uub25EaWRTdGFydEtleXdvcmRSZWNvZ25pdGlvbigoKSA9PiB0aGlzLnVwZGF0ZVN0YXR1c0VudHJ5KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNwZWVjaFNlcnZpY2Uub25EaWRFbmRLZXl3b3JkUmVjb2duaXRpb24oKCkgPT4gdGhpcy51cGRhdGVTdGF0dXNFbnRyeSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihLRVlXT1JEX0FDVElWSUFUSU9OX1NFVFRJTkdfSUQpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzRW50cnkoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0YXR1c0VudHJ5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpc2libGUgPSBzdXBwb3J0c0tleXdvcmRBY3RpdmF0aW9uKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuc3BlZWNoU2VydmljZSwgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlKTtcblx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0aWYgKCF0aGlzLmVudHJ5LnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlU3RhdHVzRW50cnkoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVTdGF0dXNMYWJlbCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmVudHJ5LmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTdGF0dXNFbnRyeSgpIHtcblx0XHR0aGlzLmVudHJ5LnZhbHVlID0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KHRoaXMuZ2V0U3RhdHVzRW50cnlQcm9wZXJ0aWVzKCksICdzdGF0dXMudm9pY2VLZXl3b3JkQWN0aXZhdGlvbicsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgMTAzKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RhdHVzRW50cnlQcm9wZXJ0aWVzKCk6IElTdGF0dXNiYXJFbnRyeSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6IEtleXdvcmRBY3RpdmF0aW9uU3RhdHVzRW50cnkuU1RBVFVTX05BTUUsXG5cdFx0XHR0ZXh0OiB0aGlzLnNwZWVjaFNlcnZpY2UuaGFzQWN0aXZlS2V5d29yZFJlY29nbml0aW9uID8gJyQobWljLWZpbGxlZCknIDogJyQobWljKScsXG5cdFx0XHR0b29sdGlwOiB0aGlzLnNwZWVjaFNlcnZpY2UuaGFzQWN0aXZlS2V5d29yZFJlY29nbml0aW9uID8gS2V5d29yZEFjdGl2YXRpb25TdGF0dXNFbnRyeS5TVEFUVVNfQUNUSVZFIDogS2V5d29yZEFjdGl2YXRpb25TdGF0dXNFbnRyeS5TVEFUVVNfSU5BQ1RJVkUsXG5cdFx0XHRhcmlhTGFiZWw6IHRoaXMuc3BlZWNoU2VydmljZS5oYXNBY3RpdmVLZXl3b3JkUmVjb2duaXRpb24gPyBLZXl3b3JkQWN0aXZhdGlvblN0YXR1c0VudHJ5LlNUQVRVU19BQ1RJVkUgOiBLZXl3b3JkQWN0aXZhdGlvblN0YXR1c0VudHJ5LlNUQVRVU19JTkFDVElWRSxcblx0XHRcdGNvbW1hbmQ6IEtleXdvcmRBY3RpdmF0aW9uU3RhdHVzRW50cnkuU1RBVFVTX0NPTU1BTkQsXG5cdFx0XHRraW5kOiAncHJvbWluZW50Jyxcblx0XHRcdHNob3dJbkFsbFdpbmRvd3M6IHRydWVcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdGF0dXNMYWJlbCgpOiB2b2lkIHtcblx0XHR0aGlzLmVudHJ5LnZhbHVlPy51cGRhdGUodGhpcy5nZXRTdGF0dXNFbnRyeVByb3BlcnRpZXMoKSk7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBJbnN0YWxsIFByb3ZpZGVyIEFjdGlvbnNcblxuY29uc3QgSW5zdGFsbGluZ1NwZWVjaFByb3ZpZGVyID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2luc3RhbGxpbmdTcGVlY2hQcm92aWRlcicsIGZhbHNlLCB0cnVlKTtcblxuYWJzdHJhY3QgY2xhc3MgQmFzZUluc3RhbGxTcGVlY2hQcm92aWRlckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNQRUVDSF9FWFRFTlNJT05fSUQgPSAnbXMtdnNjb2RlLnZzY29kZS1zcGVlY2gnO1xuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHR0cnkge1xuXHRcdFx0SW5zdGFsbGluZ1NwZWVjaFByb3ZpZGVyLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdFx0YXdhaXQgdGhpcy5pbnN0YWxsRXh0ZW5zaW9uKGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBkaWFsb2dTZXJ2aWNlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0SW5zdGFsbGluZ1NwZWVjaFByb3ZpZGVyLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSkucmVzZXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxFeHRlbnNpb24oZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSwgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbChCYXNlSW5zdGFsbFNwZWVjaFByb3ZpZGVyQWN0aW9uLlNQRUVDSF9FWFRFTlNJT05fSUQsIHtcblx0XHRcdFx0anVzdGlmaWNhdGlvbjogdGhpcy5nZXRKdXN0aWZpY2F0aW9uKCksXG5cdFx0XHRcdGVuYWJsZTogdHJ1ZVxuXHRcdFx0fSwgUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd1bmtub3duU2V0dXBFcnJvcicsIFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2V0dGluZyB1cCB2b2ljZSBjaGF0LiBXb3VsZCB5b3UgbGlrZSB0byB0cnkgYWdhaW4/XCIpLFxuXHRcdFx0XHRkZXRhaWw6IGVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSA/IHRvRXJyb3JNZXNzYWdlKGVycm9yKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ3JldHJ5JywgXCJSZXRyeVwiKVxuXHRcdFx0fSk7XG5cdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbGxFeHRlbnNpb24oZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIGRpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRKdXN0aWZpY2F0aW9uKCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEluc3RhbGxTcGVlY2hQcm92aWRlckZvclZvaWNlQ2hhdEFjdGlvbiBleHRlbmRzIEJhc2VJbnN0YWxsU3BlZWNoUHJvdmlkZXJBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuaW5zdGFsbFByb3ZpZGVyRm9yVm9pY2VDaGF0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogSW5zdGFsbFNwZWVjaFByb3ZpZGVyRm9yVm9pY2VDaGF0QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc3RhbGxQcm92aWRlckZvclZvaWNlQ2hhdC5sYWJlbCcsIFwiU3RhcnQgVm9pY2UgQ2hhdFwiKSxcblx0XHRcdGljb246IENvZGljb24ubWljLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBJbnN0YWxsaW5nU3BlZWNoUHJvdmlkZXIubmVnYXRlKCksXG5cdFx0XHRtZW51OiBwcmltYXJ5Vm9pY2VBY3Rpb25NZW51KEhhc1NwZWVjaFByb3ZpZGVyLm5lZ2F0ZSgpKVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEp1c3RpZmljYXRpb24oKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2luc3RhbGxQcm92aWRlckZvclZvaWNlQ2hhdC5qdXN0aWZpY2F0aW9uJywgXCJNaWNyb3Bob25lIHN1cHBvcnQgcmVxdWlyZXMgdGhpcyBleHRlbnNpb24uXCIpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXHRsZXQgYWN0aXZlUmVjb3JkaW5nQ29sb3I6IENvbG9yIHwgdW5kZWZpbmVkO1xuXHRsZXQgYWN0aXZlUmVjb3JkaW5nRGltbWVkQ29sb3I6IENvbG9yIHwgdW5kZWZpbmVkO1xuXHRpZiAodGhlbWUudHlwZSA9PT0gQ29sb3JTY2hlbWUuTElHSFQgfHwgdGhlbWUudHlwZSA9PT0gQ29sb3JTY2hlbWUuREFSSykge1xuXHRcdGFjdGl2ZVJlY29yZGluZ0NvbG9yID0gdGhlbWUuZ2V0Q29sb3IoQUNUSVZJVFlfQkFSX0JBREdFX0JBQ0tHUk9VTkQpID8/IHRoZW1lLmdldENvbG9yKGZvY3VzQm9yZGVyKTtcblx0XHRhY3RpdmVSZWNvcmRpbmdEaW1tZWRDb2xvciA9IGFjdGl2ZVJlY29yZGluZ0NvbG9yPy50cmFuc3BhcmVudCgwLjM4KTtcblx0fSBlbHNlIHtcblx0XHRhY3RpdmVSZWNvcmRpbmdDb2xvciA9IHRoZW1lLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblx0XHRhY3RpdmVSZWNvcmRpbmdEaW1tZWRDb2xvciA9IHRoZW1lLmdldENvbG9yKGNvbnRyYXN0Qm9yZGVyKTtcblx0fVxuXG5cdC8vIFNob3cgYSBcIm1pY3JvcGhvbmVcIiBvciBcInB1bHNlXCIgaWNvbiB3aGVuIHNwZWVjaC10by10ZXh0IG9yIHRleHQtdG8tc3BlZWNoIGlzIGluIHByb2dyZXNzIHRoYXQgZ2xvd3MgdmlhIG91dGxpbmUuXG5cdGNvbGxlY3Rvci5hZGRSdWxlKGBcblx0XHQubW9uYWNvLXdvcmtiZW5jaDpub3QoLnJlZHVjZS1tb3Rpb24pIC5pbnRlcmFjdGl2ZS1pbnB1dC1wYXJ0IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWxhYmVsLmNvZGljb24tc3luYy5jb2RpY29uLW1vZGlmaWVyLXNwaW46bm90KC5kaXNhYmxlZCksXG5cdFx0Lm1vbmFjby13b3JrYmVuY2g6bm90KC5yZWR1Y2UtbW90aW9uKSAuaW50ZXJhY3RpdmUtaW5wdXQtcGFydCAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1sYWJlbC5jb2RpY29uLWxvYWRpbmcuY29kaWNvbi1tb2RpZmllci1zcGluOm5vdCguZGlzYWJsZWQpIHtcblx0XHRcdGNvbG9yOiAke2FjdGl2ZVJlY29yZGluZ0NvbG9yfTtcblx0XHRcdG91dGxpbmU6IDFweCBzb2xpZCAke2FjdGl2ZVJlY29yZGluZ0NvbG9yfTtcblx0XHRcdG91dGxpbmUtb2Zmc2V0OiAtMXB4O1xuXHRcdFx0YW5pbWF0aW9uOiBwdWxzZUFuaW1hdGlvbiAxcyBpbmZpbml0ZTtcblx0XHRcdGJvcmRlci1yYWRpdXM6IDUwJTtcblx0XHR9XG5cblx0XHQubW9uYWNvLXdvcmtiZW5jaDpub3QoLnJlZHVjZS1tb3Rpb24pIC5pbnRlcmFjdGl2ZS1pbnB1dC1wYXJ0IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWxhYmVsLmNvZGljb24tc3luYy5jb2RpY29uLW1vZGlmaWVyLXNwaW46bm90KC5kaXNhYmxlZCk6OmJlZm9yZSxcblx0XHQubW9uYWNvLXdvcmtiZW5jaDpub3QoLnJlZHVjZS1tb3Rpb24pIC5pbnRlcmFjdGl2ZS1pbnB1dC1wYXJ0IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWxhYmVsLmNvZGljb24tbG9hZGluZy5jb2RpY29uLW1vZGlmaWVyLXNwaW46bm90KC5kaXNhYmxlZCk6OmJlZm9yZSB7XG5cdFx0XHRwb3NpdGlvbjogYWJzb2x1dGU7XG5cdFx0XHRvdXRsaW5lOiAxcHggc29saWQgJHthY3RpdmVSZWNvcmRpbmdDb2xvcn07XG5cdFx0XHRvdXRsaW5lLW9mZnNldDogMnB4O1xuXHRcdFx0Ym9yZGVyLXJhZGl1czogNTAlO1xuXHRcdFx0d2lkdGg6IDE2cHg7XG5cdFx0XHRoZWlnaHQ6IDE2cHg7XG5cdFx0fVxuXG5cdFx0Lm1vbmFjby13b3JrYmVuY2g6bm90KC5yZWR1Y2UtbW90aW9uKSAuaW50ZXJhY3RpdmUtaW5wdXQtcGFydCAubW9uYWNvLWFjdGlvbi1iYXIgLmFjdGlvbi1sYWJlbC5jb2RpY29uLXN5bmMuY29kaWNvbi1tb2RpZmllci1zcGluOm5vdCguZGlzYWJsZWQpOjphZnRlcixcblx0XHQubW9uYWNvLXdvcmtiZW5jaDpub3QoLnJlZHVjZS1tb3Rpb24pIC5pbnRlcmFjdGl2ZS1pbnB1dC1wYXJ0IC5tb25hY28tYWN0aW9uLWJhciAuYWN0aW9uLWxhYmVsLmNvZGljb24tbG9hZGluZy5jb2RpY29uLW1vZGlmaWVyLXNwaW46bm90KC5kaXNhYmxlZCk6OmFmdGVyIHtcblx0XHRcdG91dGxpbmU6IDJweCBzb2xpZCAke2FjdGl2ZVJlY29yZGluZ0NvbG9yfTtcblx0XHRcdG91dGxpbmUtb2Zmc2V0OiAtMXB4O1xuXHRcdFx0YW5pbWF0aW9uOiBwdWxzZUFuaW1hdGlvbiAxNTAwbXMgY3ViaWMtYmV6aWVyKDAuNzUsIDAsIDAuMjUsIDEpIGluZmluaXRlO1xuXHRcdH1cblxuXHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLmludGVyYWN0aXZlLWlucHV0LXBhcnQgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24tbGFiZWwuY29kaWNvbi1zeW5jLmNvZGljb24tbW9kaWZpZXItc3Bpbjpub3QoLmRpc2FibGVkKTo6YmVmb3JlLFxuXHRcdC5tb25hY28td29ya2JlbmNoOm5vdCgucmVkdWNlLW1vdGlvbikgLmludGVyYWN0aXZlLWlucHV0LXBhcnQgLm1vbmFjby1hY3Rpb24tYmFyIC5hY3Rpb24tbGFiZWwuY29kaWNvbi1sb2FkaW5nLmNvZGljb24tbW9kaWZpZXItc3Bpbjpub3QoLmRpc2FibGVkKTo6YmVmb3JlIHtcblx0XHRcdHBvc2l0aW9uOiBhYnNvbHV0ZTtcblx0XHRcdG91dGxpbmU6IDFweCBzb2xpZCAke2FjdGl2ZVJlY29yZGluZ0NvbG9yfTtcblx0XHRcdG91dGxpbmUtb2Zmc2V0OiAycHg7XG5cdFx0XHRib3JkZXItcmFkaXVzOiA1MCU7XG5cdFx0XHR3aWR0aDogMTZweDtcblx0XHRcdGhlaWdodDogMTZweDtcblx0XHR9XG5cblx0XHRAa2V5ZnJhbWVzIHB1bHNlQW5pbWF0aW9uIHtcblx0XHRcdDAlIHtcblx0XHRcdFx0b3V0bGluZS13aWR0aDogMnB4O1xuXHRcdFx0fVxuXHRcdFx0NjIlIHtcblx0XHRcdFx0b3V0bGluZS13aWR0aDogNXB4O1xuXHRcdFx0XHRvdXRsaW5lLWNvbG9yOiAke2FjdGl2ZVJlY29yZGluZ0RpbW1lZENvbG9yfTtcblx0XHRcdH1cblx0XHRcdDEwMCUge1xuXHRcdFx0XHRvdXRsaW5lLXdpZHRoOiAycHg7XG5cdFx0XHR9XG5cdFx0fVxuXHRgKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxrQkFBa0IsbUJBQW1CLHdCQUF3QjtBQUN0RSxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFlO0FBRXhCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFlBQVksaUJBQWlCLG1CQUFtQixvQkFBb0I7QUFDN0UsU0FB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
