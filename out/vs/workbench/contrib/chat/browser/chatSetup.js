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
import "./media/chatSetup.css";
import { $, getActiveElement, setVisibility } from "../../../../base/browser/dom.js";
import { ButtonWithDropdown } from "../../../../base/browser/ui/button/button.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { toAction } from "../../../../base/common/actions.js";
import { timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { combinedDisposable, Disposable, DisposableStore, markAsSingleton, MutableDisposable } from "../../../../base/common/lifecycle.js";
import Severity from "../../../../base/common/severity.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import { isObject } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { MarkdownRenderer } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import product from "../../../../platform/product/common/product.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ITelemetryService, TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { defaultButtonStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IActivityService, ProgressBadge } from "../../../services/activity/common/activity.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { ExtensionUrlHandlerOverrideRegistry } from "../../../services/extensions/browser/extensionUrlHandler.js";
import { nullExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { IChatAgentService } from "../common/chatAgents.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { ChatEntitlement, ChatEntitlementRequests, IChatEntitlementService } from "../common/chatEntitlementService.js";
import { IChatService } from "../common/chatService.js";
import { CHAT_CATEGORY, CHAT_OPEN_ACTION_ID, CHAT_SETUP_ACTION_ID } from "./actions/chatActions.js";
import { ChatViewId, EditsViewId, ensureSideBarChatViewSize, IChatWidgetService, preferCopilotEditsView, showCopilotView } from "./chat.js";
import { CHAT_EDITING_SIDEBAR_PANEL_ID, CHAT_SIDEBAR_PANEL_ID } from "./chatViewPane.js";
import { ChatViewsWelcomeExtensions } from "./viewsWelcome/chatViewsWelcome.js";
import { ChatAgentLocation, ChatConfiguration, validateChatMode } from "../common/constants.js";
import { ILanguageModelsService } from "../common/languageModels.js";
import { Dialog } from "../../../../base/browser/ui/dialog/dialog.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { createWorkbenchDialogOptions } from "../../../../platform/dialogs/browser/dialog.js";
const defaultChat = {
  extensionId: product.defaultChatAgent?.extensionId ?? "",
  chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? "",
  documentationUrl: product.defaultChatAgent?.documentationUrl ?? "",
  termsStatementUrl: product.defaultChatAgent?.termsStatementUrl ?? "",
  privacyStatementUrl: product.defaultChatAgent?.privacyStatementUrl ?? "",
  skusDocumentationUrl: product.defaultChatAgent?.skusDocumentationUrl ?? "",
  publicCodeMatchesUrl: product.defaultChatAgent?.publicCodeMatchesUrl ?? "",
  upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? "",
  providerName: product.defaultChatAgent?.providerName ?? "",
  enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? "",
  enterpriseProviderName: product.defaultChatAgent?.enterpriseProviderName ?? "",
  providerUriSetting: product.defaultChatAgent?.providerUriSetting ?? "",
  providerScopes: product.defaultChatAgent?.providerScopes ?? [[]],
  manageSettingsUrl: product.defaultChatAgent?.manageSettingsUrl ?? "",
  completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? "",
  walkthroughCommand: product.defaultChatAgent?.walkthroughCommand ?? "",
  completionsRefreshTokenCommand: product.defaultChatAgent?.completionsRefreshTokenCommand ?? "",
  chatRefreshTokenCommand: product.defaultChatAgent?.chatRefreshTokenCommand ?? ""
};
const ToolsAgentWhen = ContextKeyExpr.and(
  ContextKeyExpr.equals(`config.${ChatConfiguration.AgentEnabled}`, true),
  ChatContextKeys.Editing.agentModeDisallowed.negate(),
  ContextKeyExpr.not(`previewFeaturesDisabled`)
  // Set by extension
);
let SetupChatAgentImplementation = class extends Disposable {
  constructor(context, controller, location, instantiationService, logService, configurationService, telemetryService) {
    super();
    this.context = context;
    this.controller = controller;
    this.location = location;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this._onUnresolvableError = this._register(new Emitter());
    this.onUnresolvableError = this._onUnresolvableError.event;
  }
  static register(instantiationService, location, isToolsAgent, context, controller) {
    return instantiationService.invokeFunction((accessor) => {
      const chatAgentService = accessor.get(IChatAgentService);
      let id;
      let description = localize("chatDescription", "Ask Copilot");
      let welcomeMessageContent;
      const baseMessage = localize("chatMessage", "Copilot is powered by AI, so mistakes are possible. Review output carefully before use.");
      switch (location) {
        case ChatAgentLocation.Panel:
          id = "setup.chat";
          welcomeMessageContent = {
            title: description,
            message: new MarkdownString(baseMessage),
            icon: Codicon.copilotLarge
          };
          break;
        case ChatAgentLocation.EditingSession:
          id = isToolsAgent ? "setup.agent" : "setup.edits";
          description = isToolsAgent ? localize("agentDescription", "Edit files in your workspace in agent mode") : localize("editsDescription", "Edit files in your workspace");
          welcomeMessageContent = isToolsAgent ? {
            title: localize("editsTitle", "Edit with Copilot"),
            message: new MarkdownString(localize("agentMessage", "Ask Copilot to edit your files in [agent mode]({0}). Copilot will automatically use multiple requests to pick files to edit, run terminal commands, and iterate on errors.", `https://aka.ms/vscode-copilot-agent`) + `

${baseMessage}`),
            icon: Codicon.copilotLarge
          } : {
            title: localize("editsTitle", "Edit with Copilot"),
            message: new MarkdownString(localize("editsMessage", "Start your editing session by defining a set of files that you want to work with. Then ask Copilot for the changes you want to make.") + `

${baseMessage}`),
            icon: Codicon.copilotLarge
          };
          break;
        case ChatAgentLocation.Terminal:
          id = "setup.terminal";
          break;
        case ChatAgentLocation.Editor:
          id = "setup.editor";
          break;
        case ChatAgentLocation.Notebook:
          id = "setup.notebook";
          break;
      }
      const disposable = new DisposableStore();
      disposable.add(chatAgentService.registerAgent(id, {
        id,
        name: `${defaultChat.providerName} Copilot`,
        isDefault: true,
        isCore: true,
        isToolsAgent,
        when: isToolsAgent ? ToolsAgentWhen?.serialize() : void 0,
        slashCommands: [],
        disambiguation: [],
        locations: [location],
        metadata: {
          welcomeMessageContent,
          helpTextPrefix: SetupChatAgentImplementation.SETUP_NEEDED_MESSAGE
        },
        description,
        extensionId: nullExtensionDescription.identifier,
        extensionDisplayName: nullExtensionDescription.name,
        extensionPublisherId: nullExtensionDescription.publisher
      }));
      const agent = disposable.add(instantiationService.createInstance(SetupChatAgentImplementation, context, controller, location));
      disposable.add(chatAgentService.registerAgentImplementation(id, agent));
      return { agent, disposable };
    });
  }
  async invoke(request, progress) {
    return this.instantiationService.invokeFunction(async (accessor) => {
      const chatService = accessor.get(IChatService);
      const languageModelsService = accessor.get(ILanguageModelsService);
      const chatWidgetService = accessor.get(IChatWidgetService);
      const chatAgentService = accessor.get(IChatAgentService);
      return this.doInvoke(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService);
    });
  }
  async doInvoke(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService) {
    if (!this.context.state.installed || this.context.state.entitlement === ChatEntitlement.Available || this.context.state.entitlement === ChatEntitlement.Unknown) {
      return this.doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService);
    }
    return this.doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService);
  }
  async doInvokeWithoutSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService) {
    const requestModel = chatWidgetService.getWidgetBySessionId(request.sessionId)?.viewModel?.model.getRequests().at(-1);
    if (!requestModel) {
      this.logService.error("[chat setup] Request model not found, cannot redispatch request.");
      return {};
    }
    progress({
      kind: "progressMessage",
      content: new MarkdownString(localize("waitingCopilot", "Getting Copilot ready."))
    });
    await this.forwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService);
    return {};
  }
  async forwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService) {
    if (this._handlingForwardedRequest === requestModel.message.text) {
      throw new Error("Already handling this request");
    }
    this._handlingForwardedRequest = requestModel.message.text;
    const whenLanguageModelReady = this.whenLanguageModelReady(languageModelsService);
    const whenAgentReady = this.whenAgentReady(chatAgentService);
    if (whenLanguageModelReady instanceof Promise || whenAgentReady instanceof Promise) {
      const timeoutHandle = setTimeout(() => {
        progress({
          kind: "progressMessage",
          content: new MarkdownString(localize("waitingCopilot2", "Copilot is almost ready."))
        });
      }, 1e4);
      try {
        const ready = await Promise.race([
          timeout(2e4).then(() => "timedout"),
          Promise.allSettled([whenLanguageModelReady, whenAgentReady])
        ]);
        if (ready === "timedout") {
          progress({
            kind: "warning",
            content: new MarkdownString(localize("copilotTookLongWarning", "Copilot took too long to get ready. Please try again."))
          });
          this._onUnresolvableError.fire();
          return;
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    }
    const widget = chatWidgetService.getWidgetBySessionId(requestModel.session.sessionId);
    chatService.resendRequest(requestModel, {
      mode: widget?.input.currentMode,
      userSelectedModelId: widget?.input.currentLanguageModel
    });
  }
  whenLanguageModelReady(languageModelsService) {
    for (const id of languageModelsService.getLanguageModelIds()) {
      const model = languageModelsService.lookupLanguageModel(id);
      if (model && model.isDefault) {
        return;
      }
    }
    return Event.toPromise(Event.filter(languageModelsService.onDidChangeLanguageModels, (e) => e.added?.some((added) => added.metadata.isDefault) ?? false));
  }
  whenAgentReady(chatAgentService) {
    const defaultAgent = chatAgentService.getDefaultAgent(this.location);
    if (defaultAgent && !defaultAgent.isCore) {
      return;
    }
    return Event.toPromise(Event.filter(chatAgentService.onDidChangeAgents, () => {
      const defaultAgent2 = chatAgentService.getDefaultAgent(this.location);
      return Boolean(defaultAgent2 && !defaultAgent2.isCore);
    }));
  }
  async doInvokeWithSetup(request, progress, chatService, languageModelsService, chatWidgetService, chatAgentService) {
    this.telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "chat" });
    const requestModel = chatWidgetService.getWidgetBySessionId(request.sessionId)?.viewModel?.model.getRequests().at(-1);
    const setupListener = Event.runAndSubscribe(this.controller.value.onDidChange, () => {
      switch (this.controller.value.step) {
        case 2 /* SigningIn */:
          progress({
            kind: "progressMessage",
            content: new MarkdownString(localize("setupChatSignIn2", "Signing in to {0}.", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId ? defaultChat.enterpriseProviderName : defaultChat.providerName))
          });
          break;
        case 3 /* Installing */:
          progress({
            kind: "progressMessage",
            content: new MarkdownString(localize("installingCopilot", "Getting Copilot ready."))
          });
          break;
      }
    });
    let success = void 0;
    try {
      success = await ChatSetup.getInstance(this.instantiationService, this.context, this.controller).run();
    } catch (error) {
      this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
    } finally {
      setupListener.dispose();
    }
    if (typeof success === "boolean") {
      if (success) {
        if (requestModel) {
          await this.forwardRequestToCopilot(requestModel, progress, chatService, languageModelsService, chatAgentService, chatWidgetService);
        }
      } else {
        progress({
          kind: "warning",
          content: new MarkdownString(localize("copilotSetupError", "Copilot setup failed."))
        });
      }
    } else {
      progress({
        kind: "markdownContent",
        content: SetupChatAgentImplementation.SETUP_NEEDED_MESSAGE
      });
    }
    return {};
  }
};
SetupChatAgentImplementation.SETUP_NEEDED_MESSAGE = new MarkdownString(localize("settingUpCopilotNeeded", "You need to set up Copilot to use Chat."));
SetupChatAgentImplementation = __decorateClass([
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ITelemetryService)
], SetupChatAgentImplementation);
var ChatSetupStrategy = /* @__PURE__ */ ((ChatSetupStrategy2) => {
  ChatSetupStrategy2[ChatSetupStrategy2["Canceled"] = 0] = "Canceled";
  ChatSetupStrategy2[ChatSetupStrategy2["DefaultSetup"] = 1] = "DefaultSetup";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithoutEnterpriseProvider"] = 2] = "SetupWithoutEnterpriseProvider";
  ChatSetupStrategy2[ChatSetupStrategy2["SetupWithEnterpriseProvider"] = 3] = "SetupWithEnterpriseProvider";
  return ChatSetupStrategy2;
})(ChatSetupStrategy || {});
let ChatSetup = class {
  constructor(context, controller, instantiationService, telemetryService, contextMenuService, layoutService, keybindingService, chatEntitlementService, logService) {
    this.context = context;
    this.controller = controller;
    this.instantiationService = instantiationService;
    this.telemetryService = telemetryService;
    this.contextMenuService = contextMenuService;
    this.layoutService = layoutService;
    this.keybindingService = keybindingService;
    this.chatEntitlementService = chatEntitlementService;
    this.logService = logService;
    this.pendingRun = void 0;
  }
  static getInstance(instantiationService, context, controller) {
    let instance = ChatSetup.instance;
    if (!instance) {
      instance = ChatSetup.instance = instantiationService.invokeFunction((accessor) => {
        return new ChatSetup(context, controller, instantiationService, accessor.get(ITelemetryService), accessor.get(IContextMenuService), accessor.get(IWorkbenchLayoutService), accessor.get(IKeybindingService), accessor.get(IChatEntitlementService), accessor.get(ILogService));
      });
    }
    return instance;
  }
  async run() {
    if (this.pendingRun) {
      return this.pendingRun;
    }
    this.pendingRun = this.doRun();
    try {
      return await this.pendingRun;
    } finally {
      this.pendingRun = void 0;
    }
  }
  async doRun() {
    let setupStrategy;
    if (this.chatEntitlementService.entitlement === ChatEntitlement.Pro || this.chatEntitlementService.entitlement === ChatEntitlement.Limited) {
      setupStrategy = 1 /* DefaultSetup */;
    } else {
      setupStrategy = await this.showDialog();
    }
    let success = void 0;
    try {
      switch (setupStrategy) {
        case 3 /* SetupWithEnterpriseProvider */:
          success = await this.controller.value.setupWithProvider({ setupFromDialog: true, useEnterpriseProvider: true });
          break;
        case 2 /* SetupWithoutEnterpriseProvider */:
          success = await this.controller.value.setupWithProvider({ setupFromDialog: true, useEnterpriseProvider: false });
          break;
        case 1 /* DefaultSetup */:
          success = await this.controller.value.setup({ setupFromDialog: true });
          break;
      }
    } catch (error) {
      this.logService.error(`[chat setup] Error during setup: ${toErrorMessage(error)}`);
      success = false;
    }
    return success;
  }
  async showDialog() {
    const disposables = new DisposableStore();
    let result = void 0;
    const buttons = [this.getPrimaryButton(), localize("maybeLater", "Maybe Later")];
    const dialog = disposables.add(new Dialog(
      this.layoutService.activeContainer,
      this.getDialogTitle(),
      buttons,
      createWorkbenchDialogOptions({
        type: "none",
        icon: Codicon.copilotLarge,
        cancelId: buttons.length - 1,
        renderBody: (body) => body.appendChild(this.createDialog(disposables)),
        primaryButtonDropdown: {
          contextMenuProvider: this.contextMenuService,
          addPrimaryActionToDropdown: false,
          actions: [
            toAction({ id: "setupWithProvider", label: localize("setupWithProvider", "Sign in with a {0} Account", defaultChat.providerName), run: () => result = 2 /* SetupWithoutEnterpriseProvider */ }),
            toAction({ id: "setupWithEnterpriseProvider", label: localize("setupWithEnterpriseProvider", "Sign in with a {0} Account", defaultChat.enterpriseProviderName), run: () => result = 3 /* SetupWithEnterpriseProvider */ })
          ]
        }
      }, this.keybindingService, this.layoutService)
    ));
    const { button } = await dialog.show();
    disposables.dispose();
    return button === 0 ? result ?? 1 /* DefaultSetup */ : 0 /* Canceled */;
  }
  getPrimaryButton() {
    if (this.context.state.entitlement === ChatEntitlement.Unknown) {
      return localize("signInButton", "Sign in");
    }
    return localize("useCopilotButton", "Use Copilot");
  }
  getDialogTitle() {
    if (this.context.state.entitlement === ChatEntitlement.Unknown) {
      return this.context.state.registered ? localize("signUp", "Sign in to use Copilot") : localize("signUpFree", "Sign in to use Copilot for free");
    }
    if (this.context.state.entitlement === ChatEntitlement.Pro) {
      return localize("copilotProTitle", "Start using Copilot Pro");
    }
    return this.context.state.registered ? localize("copilotTitle", "Start using Copilot") : localize("copilotFreeTitle", "Start using Copilot for free");
  }
  createDialog(disposables) {
    const element = $(".chat-setup-view");
    const markdown = this.instantiationService.createInstance(MarkdownRenderer, {});
    const header = localize({ key: "headerDialog", comment: ['{Locked="[Copilot]({0})"}'] }, "[Copilot]({0}) is your AI pair programmer. Write code faster with completions, fix bugs and build new features across multiple files, and learn about your codebase through chat.", defaultChat.documentationUrl);
    element.appendChild($("p.setup-header", void 0, disposables.add(markdown.render(new MarkdownString(header, { isTrusted: true }))).element));
    const terms = localize({ key: "terms", comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "By continuing, you agree to the [Terms]({0}) and [Privacy Policy]({1}).", defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
    element.appendChild($("p.setup-legal", void 0, disposables.add(markdown.render(new MarkdownString(terms, { isTrusted: true }))).element));
    if (this.telemetryService.telemetryLevel !== TelemetryLevel.NONE) {
      const settings = localize({ key: "settings", comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "Copilot Free and Pro may show [public code]({0}) suggestions and we may use your data for product improvement. You can change these [settings]({1}) at any time.", defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
      element.appendChild($("p.setup-settings", void 0, disposables.add(markdown.render(new MarkdownString(settings, { isTrusted: true }))).element));
    }
    return element;
  }
};
ChatSetup.instance = void 0;
ChatSetup = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, ILayoutService),
  __decorateParam(6, IKeybindingService),
  __decorateParam(7, IChatEntitlementService),
  __decorateParam(8, ILogService)
], ChatSetup);
let ChatSetupContribution = class extends Disposable {
  constructor(productService, instantiationService, commandService, telemetryService, chatEntitlementService, configurationService, logService) {
    super();
    this.productService = productService;
    this.instantiationService = instantiationService;
    this.commandService = commandService;
    this.telemetryService = telemetryService;
    this.configurationService = configurationService;
    this.logService = logService;
    const context = chatEntitlementService.context?.value;
    const requests = chatEntitlementService.requests?.value;
    if (!context || !requests) {
      return;
    }
    const controller = new Lazy(() => this._register(this.instantiationService.createInstance(ChatSetupController, context, requests)));
    this.registerSetupAgents(context, controller);
    this.registerChatWelcome(context, controller);
    this.registerActions(context, requests, controller);
    this.registerUrlLinkHandler();
  }
  registerSetupAgents(context, controller) {
    const registration = markAsSingleton(new MutableDisposable());
    const updateRegistration = () => {
      const disabled = context.state.hidden || !this.configurationService.getValue("chat.setupFromDialog");
      if (!disabled && !registration.value) {
        const { agent: panelAgent, disposable: panelDisposable } = SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.Panel, false, context, controller);
        registration.value = combinedDisposable(
          panelDisposable,
          SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.Terminal, false, context, controller).disposable,
          SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.Notebook, false, context, controller).disposable,
          SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.Editor, false, context, controller).disposable,
          SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.EditingSession, false, context, controller).disposable,
          SetupChatAgentImplementation.register(this.instantiationService, ChatAgentLocation.EditingSession, true, context, controller).disposable,
          panelAgent.onUnresolvableError(() => {
            this.logService.error("[chat setup] Unresolvable error from Copilot agent registration, clearing registration.");
            panelDisposable.dispose();
          })
        );
      } else if (disabled && registration.value) {
        registration.clear();
      }
    };
    this._register(Event.runAndSubscribe(Event.any(
      context.onDidChange,
      Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("chat.setupFromDialog"))
    ), () => updateRegistration()));
  }
  registerChatWelcome(context, controller) {
    Registry.as(ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry).register({
      title: localize("welcomeChat", "Welcome to Copilot"),
      when: ChatContextKeys.SetupViewCondition,
      icon: Codicon.copilotLarge,
      content: (disposables) => disposables.add(this.instantiationService.createInstance(ChatSetupWelcomeContent, controller.value, context)).element
    });
  }
  registerActions(context, requests, controller) {
    const chatSetupTriggerContext = ContextKeyExpr.or(
      ChatContextKeys.Setup.installed.negate(),
      ChatContextKeys.Entitlement.canSignUp
    );
    const CHAT_SETUP_ACTION_LABEL = localize2("triggerChatSetup", "Use AI Features with Copilot for free...");
    class ChatSetupTriggerAction extends Action2 {
      constructor() {
        super({
          id: CHAT_SETUP_ACTION_ID,
          title: CHAT_SETUP_ACTION_LABEL,
          category: CHAT_CATEGORY,
          f1: true,
          precondition: chatSetupTriggerContext,
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "a_last",
            order: 1,
            when: ContextKeyExpr.and(
              chatSetupTriggerContext,
              ContextKeyExpr.or(
                ChatContextKeys.Setup.fromDialog.negate(),
                // reduce noise when using the skeleton-view approach
                ChatContextKeys.Setup.hidden
                // but enforce it if copilot is hidden
              )
            )
          }
        });
      }
      async run(accessor, mode) {
        const viewsService = accessor.get(IViewsService);
        const viewDescriptorService = accessor.get(IViewDescriptorService);
        const configurationService = accessor.get(IConfigurationService);
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const statusbarService = accessor.get(IStatusbarService);
        const instantiationService = accessor.get(IInstantiationService);
        const dialogService = accessor.get(IDialogService);
        const commandService = accessor.get(ICommandService);
        const lifecycleService = accessor.get(ILifecycleService);
        await context.update({ hidden: false });
        const chatWidgetPromise = showCopilotView(viewsService, layoutService);
        if (mode) {
          const chatWidget = await chatWidgetPromise;
          chatWidget?.input.setChatMode(mode);
        }
        const setupFromDialog = configurationService.getValue("chat.setupFromDialog");
        if (!setupFromDialog) {
          ensureSideBarChatViewSize(viewDescriptorService, layoutService, viewsService);
        }
        statusbarService.updateEntryVisibility("chat.statusBarEntry", true);
        configurationService.updateValue("chat.commandCenter.enabled", true);
        if (setupFromDialog) {
          const setup = ChatSetup.getInstance(instantiationService, context, controller);
          const result = await setup.run();
          if (result === false && !lifecycleService.willShutdown) {
            const { confirmed } = await dialogService.confirm({
              type: Severity.Error,
              message: localize("setupErrorDialog", "Copilot setup failed. Would you like to try again?"),
              primaryButton: localize("retry", "Retry")
            });
            if (confirmed) {
              commandService.executeCommand(CHAT_SETUP_ACTION_ID);
            }
          }
        }
      }
    }
    const _ChatSetupHideAction = class _ChatSetupHideAction extends Action2 {
      constructor() {
        super({
          id: _ChatSetupHideAction.ID,
          title: _ChatSetupHideAction.TITLE,
          f1: true,
          category: CHAT_CATEGORY,
          precondition: ContextKeyExpr.and(ChatContextKeys.Setup.installed.negate(), ChatContextKeys.Setup.hidden.negate()),
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "z_hide",
            order: 1,
            when: ChatContextKeys.Setup.installed.negate()
          }
        });
      }
      async run(accessor) {
        const viewsDescriptorService = accessor.get(IViewDescriptorService);
        const layoutService = accessor.get(IWorkbenchLayoutService);
        const configurationService = accessor.get(IConfigurationService);
        const dialogService = accessor.get(IDialogService);
        const statusbarService = accessor.get(IStatusbarService);
        const { confirmed } = await dialogService.confirm({
          message: localize("hideChatSetupConfirm", "Are you sure you want to hide Copilot?"),
          detail: localize("hideChatSetupDetail", "You can restore Copilot by running the '{0}' command.", CHAT_SETUP_ACTION_LABEL.value),
          primaryButton: localize("hideChatSetupButton", "Hide Copilot")
        });
        if (!confirmed) {
          return;
        }
        const location = viewsDescriptorService.getViewLocationById(ChatViewId);
        await context.update({ hidden: true });
        if (location === ViewContainerLocation.AuxiliaryBar) {
          const activeContainers = viewsDescriptorService.getViewContainersByLocation(location).filter((container) => viewsDescriptorService.getViewContainerModel(container).activeViewDescriptors.length > 0);
          if (activeContainers.length === 0) {
            layoutService.setPartHidden(true, Parts.AUXILIARYBAR_PART);
          }
        }
        statusbarService.updateEntryVisibility("chat.statusBarEntry", false);
        configurationService.updateValue("chat.commandCenter.enabled", false);
      }
    };
    _ChatSetupHideAction.ID = "workbench.action.chat.hideSetup";
    _ChatSetupHideAction.TITLE = localize2("hideChatSetup", "Hide Copilot");
    let ChatSetupHideAction = _ChatSetupHideAction;
    const windowFocusListener = this._register(new MutableDisposable());
    class UpgradePlanAction extends Action2 {
      constructor() {
        super({
          id: "workbench.action.chat.upgradePlan",
          title: localize2("managePlan", "Upgrade to Copilot Pro"),
          category: localize2("chat.category", "Chat"),
          f1: true,
          precondition: ContextKeyExpr.or(
            ChatContextKeys.Entitlement.canSignUp,
            ChatContextKeys.Entitlement.limited
          ),
          menu: {
            id: MenuId.ChatTitleBarMenu,
            group: "a_first",
            order: 1,
            when: ContextKeyExpr.or(
              ChatContextKeys.chatQuotaExceeded,
              ChatContextKeys.completionsQuotaExceeded
            )
          }
        });
      }
      async run(accessor, from) {
        const openerService = accessor.get(IOpenerService);
        const hostService = accessor.get(IHostService);
        const commandService = accessor.get(ICommandService);
        openerService.open(URI.parse(defaultChat.upgradePlanUrl));
        const entitlement = context.state.entitlement;
        if (entitlement !== ChatEntitlement.Pro) {
          windowFocusListener.value = hostService.onDidChangeFocus((focus) => this.onWindowFocus(focus, commandService));
        }
      }
      async onWindowFocus(focus, commandService) {
        if (focus) {
          windowFocusListener.clear();
          const entitlements = await requests.forceResolveEntitlement(void 0);
          if (entitlements?.entitlement === ChatEntitlement.Pro) {
            refreshTokens(commandService);
          }
        }
      }
    }
    registerAction2(ChatSetupTriggerAction);
    registerAction2(ChatSetupHideAction);
    registerAction2(UpgradePlanAction);
  }
  registerUrlLinkHandler() {
    this._register(ExtensionUrlHandlerOverrideRegistry.registerHandler({
      canHandleURL: (url) => {
        return url.scheme === this.productService.urlProtocol && equalsIgnoreCase(url.authority, defaultChat.chatExtensionId);
      },
      handleURL: async (url) => {
        const params = new URLSearchParams(url.query);
        this.telemetryService.publicLog2("workbenchActionExecuted", { id: CHAT_SETUP_ACTION_ID, from: "url", detail: params.get("referrer") ?? void 0 });
        await this.commandService.executeCommand(CHAT_SETUP_ACTION_ID, validateChatMode(params.get("mode")));
        return true;
      }
    }));
  }
};
ChatSetupContribution.ID = "workbench.contrib.chatSetup";
ChatSetupContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IChatEntitlementService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILogService)
], ChatSetupContribution);
var ChatSetupStep = /* @__PURE__ */ ((ChatSetupStep2) => {
  ChatSetupStep2[ChatSetupStep2["Initial"] = 1] = "Initial";
  ChatSetupStep2[ChatSetupStep2["SigningIn"] = 2] = "SigningIn";
  ChatSetupStep2[ChatSetupStep2["Installing"] = 3] = "Installing";
  return ChatSetupStep2;
})(ChatSetupStep || {});
let ChatSetupController = class extends Disposable {
  constructor(context, requests, telemetryService, authenticationService, viewsService, extensionsWorkbenchService, productService, logService, progressService, chatAgentService, activityService, commandService, layoutService, workspaceTrustRequestService, dialogService, configurationService, lifecycleService, quickInputService) {
    super();
    this.context = context;
    this.requests = requests;
    this.telemetryService = telemetryService;
    this.authenticationService = authenticationService;
    this.viewsService = viewsService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.productService = productService;
    this.logService = logService;
    this.progressService = progressService;
    this.chatAgentService = chatAgentService;
    this.activityService = activityService;
    this.commandService = commandService;
    this.layoutService = layoutService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.dialogService = dialogService;
    this.configurationService = configurationService;
    this.lifecycleService = lifecycleService;
    this.quickInputService = quickInputService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._step = 1 /* Initial */;
    this.registerListeners();
  }
  get step() {
    return this._step;
  }
  registerListeners() {
    this._register(this.context.onDidChange(() => this._onDidChange.fire()));
  }
  setStep(step) {
    if (this._step === step) {
      return;
    }
    this._step = step;
    this._onDidChange.fire();
  }
  async setup(options) {
    const watch = new StopWatch(false);
    const title = localize("setupChatProgress", "Getting Copilot ready...");
    const badge = this.activityService.showViewContainerActivity(preferCopilotEditsView(this.viewsService) ? CHAT_EDITING_SIDEBAR_PANEL_ID : CHAT_SIDEBAR_PANEL_ID, {
      badge: new ProgressBadge(() => title)
    });
    try {
      return await this.progressService.withProgress({
        location: ProgressLocation.Window,
        command: CHAT_OPEN_ACTION_ID,
        title
      }, () => this.doSetup(options ?? {}, watch));
    } finally {
      badge.dispose();
    }
  }
  async doSetup(options, watch) {
    this.context.suspend();
    let focusChatInput = false;
    let success = false;
    try {
      const providerId = ChatEntitlementRequests.providerId(this.configurationService);
      let session;
      let entitlement;
      if (this.context.state.entitlement === ChatEntitlement.Unknown || options.forceSignIn) {
        this.setStep(2 /* SigningIn */);
        const result = await this.signIn(providerId, options);
        if (!result.session) {
          this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedNotSignedIn", installDuration: watch.elapsed(), signUpErrorCode: void 0, setupFromDialog: Boolean(options.setupFromDialog) });
          return false;
        }
        session = result.session;
        entitlement = result.entitlement;
      }
      const trusted = await this.workspaceTrustRequestService.requestWorkspaceTrust({
        message: localize("copilotWorkspaceTrust", "Copilot is currently only supported in trusted workspaces.")
      });
      if (!trusted) {
        this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedNotTrusted", installDuration: watch.elapsed(), signUpErrorCode: void 0, setupFromDialog: Boolean(options.setupFromDialog) });
        return false;
      }
      const activeElement = getActiveElement();
      this.setStep(3 /* Installing */);
      success = await this.install(session, entitlement ?? this.context.state.entitlement, providerId, options, watch);
      const currentActiveElement = getActiveElement();
      focusChatInput = activeElement === currentActiveElement || currentActiveElement === mainWindow.document.body;
    } finally {
      this.setStep(1 /* Initial */);
      this.context.resume();
    }
    if (focusChatInput && !options.setupFromDialog) {
      (await showCopilotView(this.viewsService, this.layoutService))?.focusInput();
    }
    return success;
  }
  async signIn(providerId, options) {
    let session;
    let entitlements;
    try {
      if (!options?.setupFromDialog) {
        showCopilotView(this.viewsService, this.layoutService);
      }
      ({ session, entitlements } = await this.requests.signIn());
    } catch (e) {
      this.logService.error(`[chat setup] signIn: error ${e}`);
    }
    if (!session && !this.lifecycleService.willShutdown) {
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Error,
        message: localize("unknownSignInError", "Failed to sign in to {0}. Would you like to try again?", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId ? defaultChat.enterpriseProviderName : defaultChat.providerName),
        detail: localize("unknownSignInErrorDetail", "You must be signed in to use Copilot."),
        primaryButton: localize("retry", "Retry")
      });
      if (confirmed) {
        return this.signIn(providerId, options);
      }
    }
    return { session, entitlement: entitlements?.entitlement };
  }
  async install(session, entitlement, providerId, options, watch) {
    const wasInstalled = this.context.state.installed;
    let signUpResult = void 0;
    try {
      if (!options?.setupFromDialog) {
        showCopilotView(this.viewsService, this.layoutService);
      }
      if (entitlement !== ChatEntitlement.Limited && // User is not signed up to Copilot Free
      entitlement !== ChatEntitlement.Pro && // User is not signed up to Copilot Pro
      entitlement !== ChatEntitlement.Unavailable) {
        if (!session) {
          try {
            session = (await this.authenticationService.getSessions(providerId)).at(0);
          } catch (error) {
          }
          if (!session) {
            this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedNoSession", installDuration: watch.elapsed(), signUpErrorCode: void 0, setupFromDialog: Boolean(options.setupFromDialog) });
            return false;
          }
        }
        signUpResult = await this.requests.signUpLimited(session);
        if (typeof signUpResult !== "boolean") {
          this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: "failedSignUp", installDuration: watch.elapsed(), signUpErrorCode: signUpResult.errorCode, setupFromDialog: Boolean(options.setupFromDialog) });
        }
      }
      await this.doInstall();
    } catch (error) {
      this.logService.error(`[chat setup] install: error ${error}`);
      this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: isCancellationError(error) ? "cancelled" : "failedInstall", installDuration: watch.elapsed(), signUpErrorCode: void 0, setupFromDialog: Boolean(options.setupFromDialog) });
      return false;
    }
    this.telemetryService.publicLog2("commandCenter.chatInstall", { installResult: wasInstalled ? "alreadyInstalled" : "installed", installDuration: watch.elapsed(), signUpErrorCode: void 0, setupFromDialog: Boolean(options.setupFromDialog) });
    if (wasInstalled && signUpResult === true) {
      refreshTokens(this.commandService);
    }
    if (!options?.setupFromDialog) {
      await Promise.race([
        timeout(5e3),
        // helps prevent flicker with sign-in welcome view
        Event.toPromise(this.chatAgentService.onDidChangeAgents)
        // https://github.com/microsoft/vscode-copilot/issues/9274
      ]);
    }
    return true;
  }
  async doInstall() {
    let error;
    try {
      await this.extensionsWorkbenchService.install(defaultChat.extensionId, {
        enable: true,
        isApplicationScoped: true,
        // install into all profiles
        isMachineScoped: false,
        // do not ask to sync
        installEverywhere: true,
        // install in local and remote
        installPreReleaseVersion: this.productService.quality !== "stable"
      }, preferCopilotEditsView(this.viewsService) ? EditsViewId : ChatViewId);
    } catch (e) {
      this.logService.error(`[chat setup] install: error ${error}`);
      error = e;
    }
    if (error) {
      if (!this.lifecycleService.willShutdown) {
        const { confirmed } = await this.dialogService.confirm({
          type: Severity.Error,
          message: localize("unknownSetupError", "An error occurred while setting up Copilot. Would you like to try again?"),
          detail: error && !isCancellationError(error) ? toErrorMessage(error) : void 0,
          primaryButton: localize("retry", "Retry")
        });
        if (confirmed) {
          return this.doInstall();
        }
      }
      throw error;
    }
  }
  async setupWithProvider(options) {
    const registry = Registry.as(ConfigurationExtensions.Configuration);
    registry.registerConfiguration({
      "id": "copilot.setup",
      "type": "object",
      "properties": {
        [defaultChat.completionsAdvancedSetting]: {
          "type": "object",
          "properties": {
            "authProvider": {
              "type": "string"
            }
          }
        },
        [defaultChat.providerUriSetting]: {
          "type": "string"
        }
      }
    });
    if (options.useEnterpriseProvider) {
      const success = await this.handleEnterpriseInstance();
      if (!success) {
        return false;
      }
    }
    let existingAdvancedSetting = this.configurationService.inspect(defaultChat.completionsAdvancedSetting).user?.value;
    if (!isObject(existingAdvancedSetting)) {
      existingAdvancedSetting = {};
    }
    if (options.useEnterpriseProvider) {
      await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, {
        ...existingAdvancedSetting,
        "authProvider": defaultChat.enterpriseProviderId
      }, ConfigurationTarget.USER);
    } else {
      await this.configurationService.updateValue(`${defaultChat.completionsAdvancedSetting}`, Object.keys(existingAdvancedSetting).length > 0 ? {
        ...existingAdvancedSetting,
        "authProvider": void 0
      } : void 0, ConfigurationTarget.USER);
      await this.configurationService.updateValue(defaultChat.providerUriSetting, void 0, ConfigurationTarget.USER);
    }
    return this.setup({ ...options, forceSignIn: true });
  }
  async handleEnterpriseInstance() {
    const domainRegEx = /^[a-zA-Z\-_]+$/;
    const fullUriRegEx = /^(https:\/\/)?([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.ghe\.com\/?$/;
    const uri = this.configurationService.getValue(defaultChat.providerUriSetting);
    if (typeof uri === "string" && fullUriRegEx.test(uri)) {
      return true;
    }
    let isSingleWord = false;
    const result = await this.quickInputService.input({
      prompt: localize("enterpriseInstance", "What is your {0} instance?", defaultChat.enterpriseProviderName),
      placeHolder: localize("enterpriseInstancePlaceholder", 'i.e. "octocat" or "https://octocat.ghe.com"...'),
      ignoreFocusLost: true,
      value: uri,
      validateInput: async (value) => {
        isSingleWord = false;
        if (!value) {
          return void 0;
        }
        if (domainRegEx.test(value)) {
          isSingleWord = true;
          return {
            content: localize("willResolveTo", "Will resolve to {0}", `https://${value}.ghe.com`),
            severity: Severity.Info
          };
        }
        if (!fullUriRegEx.test(value)) {
          return {
            content: localize("invalidEnterpriseInstance", 'You must enter a valid {0} instance (i.e. "octocat" or "https://octocat.ghe.com")', defaultChat.enterpriseProviderName),
            severity: Severity.Error
          };
        }
        return void 0;
      }
    });
    if (!result) {
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Error,
        message: localize("enterpriseSetupError", "The provided {0} instance is invalid. Would you like to enter it again?", defaultChat.enterpriseProviderName),
        primaryButton: localize("retry", "Retry")
      });
      if (confirmed) {
        return this.handleEnterpriseInstance();
      }
      return false;
    }
    let resolvedUri = result;
    if (isSingleWord) {
      resolvedUri = `https://${resolvedUri}.ghe.com`;
    } else {
      const normalizedUri = result.toLowerCase();
      const hasHttps = normalizedUri.startsWith("https://");
      if (!hasHttps) {
        resolvedUri = `https://${result}`;
      }
    }
    await this.configurationService.updateValue(defaultChat.providerUriSetting, resolvedUri, ConfigurationTarget.USER);
    return true;
  }
};
ChatSetupController = __decorateClass([
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IProductService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IProgressService),
  __decorateParam(9, IChatAgentService),
  __decorateParam(10, IActivityService),
  __decorateParam(11, ICommandService),
  __decorateParam(12, IWorkbenchLayoutService),
  __decorateParam(13, IWorkspaceTrustRequestService),
  __decorateParam(14, IDialogService),
  __decorateParam(15, IConfigurationService),
  __decorateParam(16, ILifecycleService),
  __decorateParam(17, IQuickInputService)
], ChatSetupController);
let ChatSetupWelcomeContent = class extends Disposable {
  constructor(controller, context, instantiationService, contextMenuService, configurationService, telemetryService) {
    super();
    this.controller = controller;
    this.context = context;
    this.instantiationService = instantiationService;
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.telemetryService = telemetryService;
    this.element = $(".chat-setup-view");
    this.create();
  }
  create() {
    const markdown = this.instantiationService.createInstance(MarkdownRenderer, {});
    {
      const header = localize({ key: "header", comment: ['{Locked="[Copilot]({0})"}'] }, "[Copilot]({0}) is your AI pair programmer.", this.context.state.installed ? `command:${defaultChat.walkthroughCommand}` : defaultChat.documentationUrl);
      this.element.appendChild($("p", void 0, this._register(markdown.render(new MarkdownString(header, { isTrusted: true }))).element));
      this.element.appendChild(
        $(
          "div.chat-features-container",
          void 0,
          $(
            "div",
            void 0,
            $(
              "div.chat-feature-container",
              void 0,
              renderIcon(Codicon.code),
              $("span", void 0, localize("featureChat", "Code faster with Completions"))
            ),
            $(
              "div.chat-feature-container",
              void 0,
              renderIcon(Codicon.editSession),
              $("span", void 0, localize("featureEdits", "Build features with Copilot Edits"))
            ),
            $(
              "div.chat-feature-container",
              void 0,
              renderIcon(Codicon.commentDiscussion),
              $("span", void 0, localize("featureExplore", "Explore your codebase with Chat"))
            )
          )
        )
      );
    }
    const free = localize({ key: "free", comment: ['{Locked="[]({0})"}'] }, "$(sparkle-filled) We now offer [Copilot for free]({0}).", defaultChat.skusDocumentationUrl);
    const freeContainer = this.element.appendChild($("p", void 0, this._register(markdown.render(new MarkdownString(free, { isTrusted: true, supportThemeIcons: true }))).element));
    const buttonContainer = this.element.appendChild($("p"));
    buttonContainer.classList.add("button-container");
    const button = this._register(new ButtonWithDropdown(buttonContainer, {
      actions: [
        toAction({ id: "chatSetup.setupWithProvider", label: localize("setupWithProvider", "Sign in with a {0} Account", defaultChat.providerName), run: () => this.controller.setupWithProvider({ useEnterpriseProvider: false }) }),
        toAction({ id: "chatSetup.setupWithEnterpriseProvider", label: localize("setupWithEnterpriseProvider", "Sign in with a {0} Account", defaultChat.enterpriseProviderName), run: () => this.controller.setupWithProvider({ useEnterpriseProvider: true }) })
      ],
      addPrimaryActionToDropdown: false,
      contextMenuProvider: this.contextMenuService,
      supportIcons: true,
      ...defaultButtonStyles
    }));
    this._register(button.onDidClick(() => this.controller.setup()));
    const terms = localize({ key: "terms", comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "By continuing, you agree to the [Terms]({0}) and [Privacy Policy]({1}).", defaultChat.termsStatementUrl, defaultChat.privacyStatementUrl);
    this.element.appendChild($("p", void 0, this._register(markdown.render(new MarkdownString(terms, { isTrusted: true }))).element));
    const settings = localize({ key: "settings", comment: ['{Locked="["}', '{Locked="]({0})"}', '{Locked="]({1})"}'] }, "Copilot Free and Pro may show [public code]({0}) suggestions and we may use your data for product improvement. You can change these [settings]({1}) at any time.", defaultChat.publicCodeMatchesUrl, defaultChat.manageSettingsUrl);
    const settingsContainer = this.element.appendChild($("p", void 0, this._register(markdown.render(new MarkdownString(settings, { isTrusted: true }))).element));
    this._register(Event.runAndSubscribe(this.controller.onDidChange, () => this.update(freeContainer, settingsContainer, button)));
  }
  update(freeContainer, settingsContainer, button) {
    const showSettings = this.telemetryService.telemetryLevel !== TelemetryLevel.NONE;
    let showFree;
    let buttonLabel;
    switch (this.context.state.entitlement) {
      case ChatEntitlement.Unknown:
        showFree = true;
        buttonLabel = this.context.state.registered ? localize("signUp", "Sign in to use Copilot") : localize("signUpFree", "Sign in to use Copilot for free");
        break;
      case ChatEntitlement.Unresolved:
        showFree = true;
        buttonLabel = this.context.state.registered ? localize("startUp", "Use Copilot") : localize("startUpLimited", "Use Copilot for free");
        break;
      case ChatEntitlement.Available:
      case ChatEntitlement.Limited:
        showFree = true;
        buttonLabel = localize("startUpLimited", "Use Copilot for free");
        break;
      case ChatEntitlement.Pro:
      case ChatEntitlement.Unavailable:
        showFree = false;
        buttonLabel = localize("startUp", "Use Copilot");
        break;
    }
    switch (this.controller.step) {
      case 2 /* SigningIn */:
        buttonLabel = localize("setupChatSignIn", "$(loading~spin) Signing in to {0}...", ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId ? defaultChat.enterpriseProviderName : defaultChat.providerName);
        break;
      case 3 /* Installing */:
        buttonLabel = localize("setupChatInstalling", "$(loading~spin) Getting Copilot Ready...");
        break;
    }
    setVisibility(showFree, freeContainer);
    setVisibility(showSettings, settingsContainer);
    button.label = buttonLabel;
    button.enabled = this.controller.step === 1 /* Initial */;
  }
};
ChatSetupWelcomeContent = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, ITelemetryService)
], ChatSetupWelcomeContent);
function refreshTokens(commandService) {
  commandService.executeCommand(defaultChat.completionsRefreshTokenCommand);
  commandService.executeCommand(defaultChat.chatRefreshTokenCommand);
}
export {
  ChatSetupContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFNldHVwLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2NoYXRTZXR1cC5jc3MnO1xuaW1wb3J0IHsgJCwgZ2V0QWN0aXZlRWxlbWVudCwgc2V0VmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQnV0dG9uV2l0aERyb3Bkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgcmVuZGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyB0b0FjdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbiwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIG1hcmtBc1NpbmdsZXRvbiwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBlcXVhbHNJZ25vcmVDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBpc09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSwgVGVsZW1ldHJ5TGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0QnV0dG9uU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElBY3Rpdml0eVNlcnZpY2UsIFByb2dyZXNzQmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hY3Rpdml0eS9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25TZXNzaW9uLCBJQXV0aGVudGljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblVybEhhbmRsZXJPdmVycmlkZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9icm93c2VyL2V4dGVuc2lvblVybEhhbmRsZXIuanMnO1xuaW1wb3J0IHsgbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSwgUGFydHMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVN0YXR1c2JhclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50SW1wbGVtZW50YXRpb24sIElDaGF0QWdlbnRSZXF1ZXN0LCBJQ2hhdEFnZW50UmVzdWx0LCBJQ2hhdEFnZW50U2VydmljZSwgSUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQgfSBmcm9tICcuLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENoYXRFbnRpdGxlbWVudCwgQ2hhdEVudGl0bGVtZW50Q29udGV4dCwgQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMsIENoYXRFbnRpdGxlbWVudFNlcnZpY2UsIElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRFbnRpdGxlbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRQcm9ncmVzcywgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlksIENIQVRfT1BFTl9BQ1RJT05fSUQsIENIQVRfU0VUVVBfQUNUSU9OX0lEIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IENoYXRWaWV3SWQsIEVkaXRzVmlld0lkLCBlbnN1cmVTaWRlQmFyQ2hhdFZpZXdTaXplLCBJQ2hhdFdpZGdldFNlcnZpY2UsIHByZWZlckNvcGlsb3RFZGl0c1ZpZXcsIHNob3dDb3BpbG90VmlldyB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDSEFUX0VESVRJTkdfU0lERUJBUl9QQU5FTF9JRCwgQ0hBVF9TSURFQkFSX1BBTkVMX0lEIH0gZnJvbSAnLi9jaGF0Vmlld1BhbmUuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdzV2VsY29tZUV4dGVuc2lvbnMsIElDaGF0Vmlld3NXZWxjb21lQ29udHJpYnV0aW9uUmVnaXN0cnkgfSBmcm9tICcuL3ZpZXdzV2VsY29tZS9jaGF0Vmlld3NXZWxjb21lLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uLCBDaGF0Q29uZmlndXJhdGlvbiwgQ2hhdE1vZGUsIHZhbGlkYXRlQ2hhdE1vZGUgfSBmcm9tICcuLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgRGlhbG9nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2RpYWxvZy9kaWFsb2cuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgY3JlYXRlV29ya2JlbmNoRGlhbG9nT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvYnJvd3Nlci9kaWFsb2cuanMnO1xuaW1wb3J0IHsgSUNoYXRSZXF1ZXN0TW9kZWwgfSBmcm9tICcuLi9jb21tb24vY2hhdE1vZGVsLmpzJztcblxuY29uc3QgZGVmYXVsdENoYXQgPSB7XG5cdGV4dGVuc2lvbklkOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmV4dGVuc2lvbklkID8/ICcnLFxuXHRjaGF0RXh0ZW5zaW9uSWQ6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY2hhdEV4dGVuc2lvbklkID8/ICcnLFxuXHRkb2N1bWVudGF0aW9uVXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmRvY3VtZW50YXRpb25VcmwgPz8gJycsXG5cdHRlcm1zU3RhdGVtZW50VXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnRlcm1zU3RhdGVtZW50VXJsID8/ICcnLFxuXHRwcml2YWN5U3RhdGVtZW50VXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnByaXZhY3lTdGF0ZW1lbnRVcmwgPz8gJycsXG5cdHNrdXNEb2N1bWVudGF0aW9uVXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnNrdXNEb2N1bWVudGF0aW9uVXJsID8/ICcnLFxuXHRwdWJsaWNDb2RlTWF0Y2hlc1VybDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5wdWJsaWNDb2RlTWF0Y2hlc1VybCA/PyAnJyxcblx0dXBncmFkZVBsYW5Vcmw6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8udXBncmFkZVBsYW5VcmwgPz8gJycsXG5cdHByb3ZpZGVyTmFtZTogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5wcm92aWRlck5hbWUgPz8gJycsXG5cdGVudGVycHJpc2VQcm92aWRlcklkOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmVudGVycHJpc2VQcm92aWRlcklkID8/ICcnLFxuXHRlbnRlcnByaXNlUHJvdmlkZXJOYW1lOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmVudGVycHJpc2VQcm92aWRlck5hbWUgPz8gJycsXG5cdHByb3ZpZGVyVXJpU2V0dGluZzogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5wcm92aWRlclVyaVNldHRpbmcgPz8gJycsXG5cdHByb3ZpZGVyU2NvcGVzOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnByb3ZpZGVyU2NvcGVzID8/IFtbXV0sXG5cdG1hbmFnZVNldHRpbmdzVXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/Lm1hbmFnZVNldHRpbmdzVXJsID8/ICcnLFxuXHRjb21wbGV0aW9uc0FkdmFuY2VkU2V0dGluZzogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5jb21wbGV0aW9uc0FkdmFuY2VkU2V0dGluZyA/PyAnJyxcblx0d2Fsa3Rocm91Z2hDb21tYW5kOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LndhbGt0aHJvdWdoQ29tbWFuZCA/PyAnJyxcblx0Y29tcGxldGlvbnNSZWZyZXNoVG9rZW5Db21tYW5kOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmNvbXBsZXRpb25zUmVmcmVzaFRva2VuQ29tbWFuZCA/PyAnJyxcblx0Y2hhdFJlZnJlc2hUb2tlbkNvbW1hbmQ6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY2hhdFJlZnJlc2hUb2tlbkNvbW1hbmQgPz8gJycsXG59O1xuXG4vLyNyZWdpb24gQ29udHJpYnV0aW9uXG5cbmNvbnN0IFRvb2xzQWdlbnRXaGVuID0gQ29udGV4dEtleUV4cHIuYW5kKFxuXHRDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0NoYXRDb25maWd1cmF0aW9uLkFnZW50RW5hYmxlZH1gLCB0cnVlKSxcblx0Q2hhdENvbnRleHRLZXlzLkVkaXRpbmcuYWdlbnRNb2RlRGlzYWxsb3dlZC5uZWdhdGUoKSxcblx0Q29udGV4dEtleUV4cHIubm90KGBwcmV2aWV3RmVhdHVyZXNEaXNhYmxlZGApIC8vIFNldCBieSBleHRlbnNpb25cbik7XG5cbmNsYXNzIFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uIHtcblxuXHRzdGF0aWMgcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLCBpc1Rvb2xzQWdlbnQ6IGJvb2xlYW4sIGNvbnRleHQ6IENoYXRFbnRpdGxlbWVudENvbnRleHQsIGNvbnRyb2xsZXI6IExhenk8Q2hhdFNldHVwQ29udHJvbGxlcj4pOiB7IGRpc3Bvc2FibGU6IElEaXNwb3NhYmxlOyBhZ2VudDogU2V0dXBDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbiB9IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3QgY2hhdEFnZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdEFnZW50U2VydmljZSk7XG5cblx0XHRcdGxldCBpZDogc3RyaW5nO1xuXHRcdFx0bGV0IGRlc2NyaXB0aW9uID0gbG9jYWxpemUoJ2NoYXREZXNjcmlwdGlvbicsIFwiQXNrIENvcGlsb3RcIik7XG5cdFx0XHRsZXQgd2VsY29tZU1lc3NhZ2VDb250ZW50OiBJQ2hhdFdlbGNvbWVNZXNzYWdlQ29udGVudCB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGJhc2VNZXNzYWdlID0gbG9jYWxpemUoJ2NoYXRNZXNzYWdlJywgXCJDb3BpbG90IGlzIHBvd2VyZWQgYnkgQUksIHNvIG1pc3Rha2VzIGFyZSBwb3NzaWJsZS4gUmV2aWV3IG91dHB1dCBjYXJlZnVsbHkgYmVmb3JlIHVzZS5cIik7XG5cdFx0XHRzd2l0Y2ggKGxvY2F0aW9uKSB7XG5cdFx0XHRcdGNhc2UgQ2hhdEFnZW50TG9jYXRpb24uUGFuZWw6XG5cdFx0XHRcdFx0aWQgPSAnc2V0dXAuY2hhdCc7XG5cdFx0XHRcdFx0d2VsY29tZU1lc3NhZ2VDb250ZW50ID0ge1xuXHRcdFx0XHRcdFx0dGl0bGU6IGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGJhc2VNZXNzYWdlKSxcblx0XHRcdFx0XHRcdGljb246IENvZGljb24uY29waWxvdExhcmdlXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbjpcblx0XHRcdFx0XHRpZCA9IGlzVG9vbHNBZ2VudCA/ICdzZXR1cC5hZ2VudCcgOiAnc2V0dXAuZWRpdHMnO1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uID0gaXNUb29sc0FnZW50ID8gbG9jYWxpemUoJ2FnZW50RGVzY3JpcHRpb24nLCBcIkVkaXQgZmlsZXMgaW4geW91ciB3b3Jrc3BhY2UgaW4gYWdlbnQgbW9kZVwiKSA6IGxvY2FsaXplKCdlZGl0c0Rlc2NyaXB0aW9uJywgXCJFZGl0IGZpbGVzIGluIHlvdXIgd29ya3NwYWNlXCIpO1xuXHRcdFx0XHRcdHdlbGNvbWVNZXNzYWdlQ29udGVudCA9IGlzVG9vbHNBZ2VudCA/XG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZWRpdHNUaXRsZScsIFwiRWRpdCB3aXRoIENvcGlsb3RcIiksXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnYWdlbnRNZXNzYWdlJywgXCJBc2sgQ29waWxvdCB0byBlZGl0IHlvdXIgZmlsZXMgaW4gW2FnZW50IG1vZGVdKHswfSkuIENvcGlsb3Qgd2lsbCBhdXRvbWF0aWNhbGx5IHVzZSBtdWx0aXBsZSByZXF1ZXN0cyB0byBwaWNrIGZpbGVzIHRvIGVkaXQsIHJ1biB0ZXJtaW5hbCBjb21tYW5kcywgYW5kIGl0ZXJhdGUgb24gZXJyb3JzLlwiLCBgaHR0cHM6Ly9ha2EubXMvdnNjb2RlLWNvcGlsb3QtYWdlbnRgKSArIGBcXG5cXG4ke2Jhc2VNZXNzYWdlfWApLFxuXHRcdFx0XHRcdFx0XHRpY29uOiBDb2RpY29uLmNvcGlsb3RMYXJnZVxuXHRcdFx0XHRcdFx0fSA6XG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZWRpdHNUaXRsZScsIFwiRWRpdCB3aXRoIENvcGlsb3RcIiksXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnZWRpdHNNZXNzYWdlJywgXCJTdGFydCB5b3VyIGVkaXRpbmcgc2Vzc2lvbiBieSBkZWZpbmluZyBhIHNldCBvZiBmaWxlcyB0aGF0IHlvdSB3YW50IHRvIHdvcmsgd2l0aC4gVGhlbiBhc2sgQ29waWxvdCBmb3IgdGhlIGNoYW5nZXMgeW91IHdhbnQgdG8gbWFrZS5cIikgKyBgXFxuXFxuJHtiYXNlTWVzc2FnZX1gKSxcblx0XHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5jb3BpbG90TGFyZ2Vcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWw6XG5cdFx0XHRcdFx0aWQgPSAnc2V0dXAudGVybWluYWwnO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENoYXRBZ2VudExvY2F0aW9uLkVkaXRvcjpcblx0XHRcdFx0XHRpZCA9ICdzZXR1cC5lZGl0b3InO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rOlxuXHRcdFx0XHRcdGlkID0gJ3NldHVwLm5vdGVib29rJztcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0ZGlzcG9zYWJsZS5hZGQoY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckFnZW50KGlkLCB7XG5cdFx0XHRcdGlkLFxuXHRcdFx0XHRuYW1lOiBgJHtkZWZhdWx0Q2hhdC5wcm92aWRlck5hbWV9IENvcGlsb3RgLFxuXHRcdFx0XHRpc0RlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdGlzQ29yZTogdHJ1ZSxcblx0XHRcdFx0aXNUb29sc0FnZW50LFxuXHRcdFx0XHR3aGVuOiBpc1Rvb2xzQWdlbnQgPyBUb29sc0FnZW50V2hlbj8uc2VyaWFsaXplKCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHNsYXNoQ29tbWFuZHM6IFtdLFxuXHRcdFx0XHRkaXNhbWJpZ3VhdGlvbjogW10sXG5cdFx0XHRcdGxvY2F0aW9uczogW2xvY2F0aW9uXSxcblx0XHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0XHR3ZWxjb21lTWVzc2FnZUNvbnRlbnQsXG5cdFx0XHRcdFx0aGVscFRleHRQcmVmaXg6IFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24uU0VUVVBfTkVFREVEX01FU1NBR0Vcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVzY3JpcHRpb24sXG5cdFx0XHRcdGV4dGVuc2lvbklkOiBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRcdFx0ZXh0ZW5zaW9uRGlzcGxheU5hbWU6IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbi5uYW1lLFxuXHRcdFx0XHRleHRlbnNpb25QdWJsaXNoZXJJZDogbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLnB1Ymxpc2hlclxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBhZ2VudCA9IGRpc3Bvc2FibGUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24sIGNvbnRleHQsIGNvbnRyb2xsZXIsIGxvY2F0aW9uKSk7XG5cdFx0XHRkaXNwb3NhYmxlLmFkZChjaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyQWdlbnRJbXBsZW1lbnRhdGlvbihpZCwgYWdlbnQpKTtcblxuXHRcdFx0cmV0dXJuIHsgYWdlbnQsIGRpc3Bvc2FibGUgfTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNFVFVQX05FRURFRF9NRVNTQUdFID0gbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdzZXR0aW5nVXBDb3BpbG90TmVlZGVkJywgXCJZb3UgbmVlZCB0byBzZXQgdXAgQ29waWxvdCB0byB1c2UgQ2hhdC5cIikpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uVW5yZXNvbHZhYmxlRXJyb3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25VbnJlc29sdmFibGVFcnJvciA9IHRoaXMuX29uVW5yZXNvbHZhYmxlRXJyb3IuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udHJvbGxlcjogTGF6eTxDaGF0U2V0dXBDb250cm9sbGVyPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIGludm9rZShyZXF1ZXN0OiBJQ2hhdEFnZW50UmVxdWVzdCwgcHJvZ3Jlc3M6IChwYXJ0OiBJQ2hhdFByb2dyZXNzKSA9PiB2b2lkKTogUHJvbWlzZTxJQ2hhdEFnZW50UmVzdWx0PiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcdFx0XHRcdFx0XHQvLyB1c2UgYWNjZXNzb3IgZm9yIGxhenkgbG9hZGluZ1xuXHRcdFx0Y29uc3QgbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZU1vZGVsc1NlcnZpY2UpO1x0Ly8gb2YgY2hhdCByZWxhdGVkIHNlcnZpY2VzXG5cdFx0XHRjb25zdCBjaGF0V2lkZ2V0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFdpZGdldFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY2hhdEFnZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdEFnZW50U2VydmljZSk7XG5cblx0XHRcdHJldHVybiB0aGlzLmRvSW52b2tlKHJlcXVlc3QsIHByb2dyZXNzLCBjaGF0U2VydmljZSwgbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBjaGF0V2lkZ2V0U2VydmljZSwgY2hhdEFnZW50U2VydmljZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSW52b2tlKHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsIGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSwgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSwgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UpOiBQcm9taXNlPElDaGF0QWdlbnRSZXN1bHQ+IHtcblx0XHRpZiAoIXRoaXMuY29udGV4dC5zdGF0ZS5pbnN0YWxsZWQgfHwgdGhpcy5jb250ZXh0LnN0YXRlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuQXZhaWxhYmxlIHx8IHRoaXMuY29udGV4dC5zdGF0ZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LlVua25vd24pIHtcblx0XHRcdHJldHVybiB0aGlzLmRvSW52b2tlV2l0aFNldHVwKHJlcXVlc3QsIHByb2dyZXNzLCBjaGF0U2VydmljZSwgbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBjaGF0V2lkZ2V0U2VydmljZSwgY2hhdEFnZW50U2VydmljZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZG9JbnZva2VXaXRob3V0U2V0dXAocmVxdWVzdCwgcHJvZ3Jlc3MsIGNoYXRTZXJ2aWNlLCBsYW5ndWFnZU1vZGVsc1NlcnZpY2UsIGNoYXRXaWRnZXRTZXJ2aWNlLCBjaGF0QWdlbnRTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9JbnZva2VXaXRob3V0U2V0dXAocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHByb2dyZXNzOiAocGFydDogSUNoYXRQcm9ncmVzcykgPT4gdm9pZCwgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSwgbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlOiBJTGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLCBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSk6IFByb21pc2U8SUNoYXRBZ2VudFJlc3VsdD4ge1xuXHRcdGNvbnN0IHJlcXVlc3RNb2RlbCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5U2Vzc2lvbklkKHJlcXVlc3Quc2Vzc2lvbklkKT8udmlld01vZGVsPy5tb2RlbC5nZXRSZXF1ZXN0cygpLmF0KC0xKTtcblx0XHRpZiAoIXJlcXVlc3RNb2RlbCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdbY2hhdCBzZXR1cF0gUmVxdWVzdCBtb2RlbCBub3QgZm91bmQsIGNhbm5vdCByZWRpc3BhdGNoIHJlcXVlc3QuJyk7XG5cdFx0XHRyZXR1cm4ge307IC8vIHRoaXMgc2hvdWxkIG5vdCBoYXBwZW5cblx0XHR9XG5cblx0XHRwcm9ncmVzcyh7XG5cdFx0XHRraW5kOiAncHJvZ3Jlc3NNZXNzYWdlJyxcblx0XHRcdGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnd2FpdGluZ0NvcGlsb3QnLCBcIkdldHRpbmcgQ29waWxvdCByZWFkeS5cIikpLFxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGhpcy5mb3J3YXJkUmVxdWVzdFRvQ29waWxvdChyZXF1ZXN0TW9kZWwsIHByb2dyZXNzLCBjaGF0U2VydmljZSwgbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBjaGF0QWdlbnRTZXJ2aWNlLCBjaGF0V2lkZ2V0U2VydmljZSk7XG5cblx0XHRyZXR1cm4ge307XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGluZ0ZvcndhcmRlZFJlcXVlc3Q6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhc3luYyBmb3J3YXJkUmVxdWVzdFRvQ29waWxvdChyZXF1ZXN0TW9kZWw6IElDaGF0UmVxdWVzdE1vZGVsLCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsIGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSwgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsIGNoYXRXaWRnZXRTZXJ2aWNlOiBJQ2hhdFdpZGdldFNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGlmICh0aGlzLl9oYW5kbGluZ0ZvcndhcmRlZFJlcXVlc3QgPT09IHJlcXVlc3RNb2RlbC5tZXNzYWdlLnRleHQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQWxyZWFkeSBoYW5kbGluZyB0aGlzIHJlcXVlc3QnKTtcblx0XHR9XG5cblx0XHR0aGlzLl9oYW5kbGluZ0ZvcndhcmRlZFJlcXVlc3QgPSByZXF1ZXN0TW9kZWwubWVzc2FnZS50ZXh0O1xuXG5cdFx0Ly8gV2UgbmVlZCBhIHNpZ25hbCB0byBrbm93IHdoZW4gd2UgY2FuIHJlc2VuZCB0aGUgcmVxdWVzdCB0b1xuXHRcdC8vIENvcGlsb3QuIFdhaXRpbmcgZm9yIHRoZSByZWdpc3RyYXRpb24gb2YgdGhlIGFnZW50IGlzIG5vdFxuXHRcdC8vIGVub3VnaCwgd2UgYWxzbyBuZWVkIGEgbGFuZ3VhZ2UgbW9kZWwgdG8gYmUgYXZhaWxhYmxlLlxuXG5cdFx0Y29uc3Qgd2hlbkxhbmd1YWdlTW9kZWxSZWFkeSA9IHRoaXMud2hlbkxhbmd1YWdlTW9kZWxSZWFkeShsYW5ndWFnZU1vZGVsc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHdoZW5BZ2VudFJlYWR5ID0gdGhpcy53aGVuQWdlbnRSZWFkeShjaGF0QWdlbnRTZXJ2aWNlKTtcblxuXHRcdGlmICh3aGVuTGFuZ3VhZ2VNb2RlbFJlYWR5IGluc3RhbmNlb2YgUHJvbWlzZSB8fCB3aGVuQWdlbnRSZWFkeSBpbnN0YW5jZW9mIFByb21pc2UpIHtcblx0XHRcdGNvbnN0IHRpbWVvdXRIYW5kbGUgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0cHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdGtpbmQ6ICdwcm9ncmVzc01lc3NhZ2UnLFxuXHRcdFx0XHRcdGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnd2FpdGluZ0NvcGlsb3QyJywgXCJDb3BpbG90IGlzIGFsbW9zdCByZWFkeS5cIikpLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0sIDEwMDAwKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcmVhZHkgPSBhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHRcdHRpbWVvdXQoMjAwMDApLnRoZW4oKCkgPT4gJ3RpbWVkb3V0JyksXG5cdFx0XHRcdFx0UHJvbWlzZS5hbGxTZXR0bGVkKFt3aGVuTGFuZ3VhZ2VNb2RlbFJlYWR5LCB3aGVuQWdlbnRSZWFkeV0pXG5cdFx0XHRcdF0pO1xuXG5cdFx0XHRcdGlmIChyZWFkeSA9PT0gJ3RpbWVkb3V0Jykge1xuXHRcdFx0XHRcdHByb2dyZXNzKHtcblx0XHRcdFx0XHRcdGtpbmQ6ICd3YXJuaW5nJyxcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnY29waWxvdFRvb2tMb25nV2FybmluZycsIFwiQ29waWxvdCB0b29rIHRvbyBsb25nIHRvIGdldCByZWFkeS4gUGxlYXNlIHRyeSBhZ2Fpbi5cIikpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHQvLyBUaGlzIG1lYW5zIENvcGlsb3QgaXMgdW5oZWFsdGh5IGFuZCB3ZSBjYW5ub3QgcmV0cnkgdGhlXG5cdFx0XHRcdFx0Ly8gcmVxdWVzdC4gU2lnbmFsIHRoaXMgdG8gdGhlIG91dHNpZGUgdmlhIGFuIGV2ZW50LlxuXHRcdFx0XHRcdHRoaXMuX29uVW5yZXNvbHZhYmxlRXJyb3IuZmlyZSgpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0Y2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5U2Vzc2lvbklkKHJlcXVlc3RNb2RlbC5zZXNzaW9uLnNlc3Npb25JZCk7XG5cdFx0Y2hhdFNlcnZpY2UucmVzZW5kUmVxdWVzdChyZXF1ZXN0TW9kZWwsIHtcblx0XHRcdG1vZGU6IHdpZGdldD8uaW5wdXQuY3VycmVudE1vZGUsXG5cdFx0XHR1c2VyU2VsZWN0ZWRNb2RlbElkOiB3aWRnZXQ/LmlucHV0LmN1cnJlbnRMYW5ndWFnZU1vZGVsLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB3aGVuTGFuZ3VhZ2VNb2RlbFJlYWR5KGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSk6IFByb21pc2U8dW5rbm93bj4gfCB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGlkIG9mIGxhbmd1YWdlTW9kZWxzU2VydmljZS5nZXRMYW5ndWFnZU1vZGVsSWRzKCkpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gbGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLmxvb2t1cExhbmd1YWdlTW9kZWwoaWQpO1xuXHRcdFx0aWYgKG1vZGVsICYmIG1vZGVsLmlzRGVmYXVsdCkge1xuXHRcdFx0XHRyZXR1cm47IC8vIHdlIGhhdmUgbGFuZ3VhZ2UgbW9kZWxzIVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKGxhbmd1YWdlTW9kZWxzU2VydmljZS5vbkRpZENoYW5nZUxhbmd1YWdlTW9kZWxzLCBlID0+IGUuYWRkZWQ/LnNvbWUoYWRkZWQgPT4gYWRkZWQubWV0YWRhdGEuaXNEZWZhdWx0KSA/PyBmYWxzZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB3aGVuQWdlbnRSZWFkeShjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSk6IFByb21pc2U8dW5rbm93bj4gfCB2b2lkIHtcblx0XHRjb25zdCBkZWZhdWx0QWdlbnQgPSBjaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudCh0aGlzLmxvY2F0aW9uKTtcblx0XHRpZiAoZGVmYXVsdEFnZW50ICYmICFkZWZhdWx0QWdlbnQuaXNDb3JlKSB7XG5cdFx0XHRyZXR1cm47IC8vIHdlIGhhdmUgYSBkZWZhdWx0IGFnZW50IGZyb20gYW4gZXh0ZW5zaW9uIVxuXHRcdH1cblxuXHRcdHJldHVybiBFdmVudC50b1Byb21pc2UoRXZlbnQuZmlsdGVyKGNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHMsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRBZ2VudCA9IGNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KHRoaXMubG9jYXRpb24pO1xuXHRcdFx0cmV0dXJuIEJvb2xlYW4oZGVmYXVsdEFnZW50ICYmICFkZWZhdWx0QWdlbnQuaXNDb3JlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSW52b2tlV2l0aFNldHVwKHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsIGxhbmd1YWdlTW9kZWxzU2VydmljZTogSUxhbmd1YWdlTW9kZWxzU2VydmljZSwgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSwgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UpOiBQcm9taXNlPElDaGF0QWdlbnRSZXN1bHQ+IHtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBDSEFUX1NFVFVQX0FDVElPTl9JRCwgZnJvbTogJ2NoYXQnIH0pO1xuXG5cdFx0Y29uc3QgcmVxdWVzdE1vZGVsID0gY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlTZXNzaW9uSWQocmVxdWVzdC5zZXNzaW9uSWQpPy52aWV3TW9kZWw/Lm1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpO1xuXG5cdFx0Y29uc3Qgc2V0dXBMaXN0ZW5lciA9IEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aGlzLmNvbnRyb2xsZXIudmFsdWUub25EaWRDaGFuZ2UsICgoKSA9PiB7XG5cdFx0XHRzd2l0Y2ggKHRoaXMuY29udHJvbGxlci52YWx1ZS5zdGVwKSB7XG5cdFx0XHRcdGNhc2UgQ2hhdFNldHVwU3RlcC5TaWduaW5nSW46XG5cdFx0XHRcdFx0cHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdFx0a2luZDogJ3Byb2dyZXNzTWVzc2FnZScsXG5cdFx0XHRcdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ3NldHVwQ2hhdFNpZ25JbjInLCBcIlNpZ25pbmcgaW4gdG8gezB9LlwiLCBDaGF0RW50aXRsZW1lbnRSZXF1ZXN0cy5wcm92aWRlcklkKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpID09PSBkZWZhdWx0Q2hhdC5lbnRlcnByaXNlUHJvdmlkZXJJZCA/IGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlck5hbWUgOiBkZWZhdWx0Q2hhdC5wcm92aWRlck5hbWUpKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBDaGF0U2V0dXBTdGVwLkluc3RhbGxpbmc6XG5cdFx0XHRcdFx0cHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdFx0a2luZDogJ3Byb2dyZXNzTWVzc2FnZScsXG5cdFx0XHRcdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ2luc3RhbGxpbmdDb3BpbG90JywgXCJHZXR0aW5nIENvcGlsb3QgcmVhZHkuXCIpKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgc3VjY2VzcyA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0c3VjY2VzcyA9IGF3YWl0IENoYXRTZXR1cC5nZXRJbnN0YW5jZSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLmNvbnRleHQsIHRoaXMuY29udHJvbGxlcikucnVuKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2NoYXQgc2V0dXBdIEVycm9yIGR1cmluZyBzZXR1cDogJHt0b0Vycm9yTWVzc2FnZShlcnJvcil9YCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHNldHVwTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdC8vIFVzZXIgaGFzIGFncmVlZCB0byBydW4gdGhlIHNldHVwXG5cdFx0aWYgKHR5cGVvZiBzdWNjZXNzID09PSAnYm9vbGVhbicpIHtcblx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdGlmIChyZXF1ZXN0TW9kZWwpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmZvcndhcmRSZXF1ZXN0VG9Db3BpbG90KHJlcXVlc3RNb2RlbCwgcHJvZ3Jlc3MsIGNoYXRTZXJ2aWNlLCBsYW5ndWFnZU1vZGVsc1NlcnZpY2UsIGNoYXRBZ2VudFNlcnZpY2UsIGNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvZ3Jlc3Moe1xuXHRcdFx0XHRcdGtpbmQ6ICd3YXJuaW5nJyxcblx0XHRcdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ2NvcGlsb3RTZXR1cEVycm9yJywgXCJDb3BpbG90IHNldHVwIGZhaWxlZC5cIikpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVzZXIgaGFzIGNhbmNlbGxlZCB0aGUgc2V0dXBcblx0XHRlbHNlIHtcblx0XHRcdHByb2dyZXNzKHtcblx0XHRcdFx0a2luZDogJ21hcmtkb3duQ29udGVudCcsXG5cdFx0XHRcdGNvbnRlbnQ6IFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24uU0VUVVBfTkVFREVEX01FU1NBR0UsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge307XG5cdH1cbn1cblxuZW51bSBDaGF0U2V0dXBTdHJhdGVneSB7XG5cdENhbmNlbGVkID0gMCxcblx0RGVmYXVsdFNldHVwID0gMSxcblx0U2V0dXBXaXRob3V0RW50ZXJwcmlzZVByb3ZpZGVyID0gMixcblx0U2V0dXBXaXRoRW50ZXJwcmlzZVByb3ZpZGVyID0gM1xufVxuXG5jbGFzcyBDaGF0U2V0dXAge1xuXG5cdHByaXZhdGUgc3RhdGljIGluc3RhbmNlOiBDaGF0U2V0dXAgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHN0YXRpYyBnZXRJbnN0YW5jZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LCBjb250cm9sbGVyOiBMYXp5PENoYXRTZXR1cENvbnRyb2xsZXI+KTogQ2hhdFNldHVwIHtcblx0XHRsZXQgaW5zdGFuY2UgPSBDaGF0U2V0dXAuaW5zdGFuY2U7XG5cdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0aW5zdGFuY2UgPSBDaGF0U2V0dXAuaW5zdGFuY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgQ2hhdFNldHVwKGNvbnRleHQsIGNvbnRyb2xsZXIsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBhY2Nlc3Nvci5nZXQoSVRlbGVtZXRyeVNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUNvbnRleHRNZW51U2VydmljZSksIGFjY2Vzc29yLmdldChJV29ya2JlbmNoTGF5b3V0U2VydmljZSksIGFjY2Vzc29yLmdldChJS2V5YmluZGluZ1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUNoYXRFbnRpdGxlbWVudFNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbnN0YW5jZTtcblx0fVxuXG5cdHByaXZhdGUgcGVuZGluZ1J1bjogUHJvbWlzZTxib29sZWFuIHwgdW5kZWZpbmVkPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dDogQ2hhdEVudGl0bGVtZW50Q29udGV4dCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRyb2xsZXI6IExhenk8Q2hhdFNldHVwQ29udHJvbGxlcj4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEVudGl0bGVtZW50U2VydmljZTogSUNoYXRFbnRpdGxlbWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgcnVuKCk6IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLnBlbmRpbmdSdW4pIHtcblx0XHRcdHJldHVybiB0aGlzLnBlbmRpbmdSdW47XG5cdFx0fVxuXG5cdFx0dGhpcy5wZW5kaW5nUnVuID0gdGhpcy5kb1J1bigpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLnBlbmRpbmdSdW47XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMucGVuZGluZ1J1biA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUnVuKCk6IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBzZXR1cFN0cmF0ZWd5OiBDaGF0U2V0dXBTdHJhdGVneTtcblx0XHRpZiAodGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuUHJvIHx8IHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQpIHtcblx0XHRcdHNldHVwU3RyYXRlZ3kgPSBDaGF0U2V0dXBTdHJhdGVneS5EZWZhdWx0U2V0dXA7IC8vIGV4aXN0aW5nIHByby9mcmVlIHVzZXJzIHNldHVwIHdpdGhvdXQgYSBkaWFsb2dcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2V0dXBTdHJhdGVneSA9IGF3YWl0IHRoaXMuc2hvd0RpYWxvZygpO1xuXHRcdH1cblxuXHRcdGxldCBzdWNjZXNzID0gdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRzd2l0Y2ggKHNldHVwU3RyYXRlZ3kpIHtcblx0XHRcdFx0Y2FzZSBDaGF0U2V0dXBTdHJhdGVneS5TZXR1cFdpdGhFbnRlcnByaXNlUHJvdmlkZXI6XG5cdFx0XHRcdFx0c3VjY2VzcyA9IGF3YWl0IHRoaXMuY29udHJvbGxlci52YWx1ZS5zZXR1cFdpdGhQcm92aWRlcih7IHNldHVwRnJvbURpYWxvZzogdHJ1ZSwgdXNlRW50ZXJwcmlzZVByb3ZpZGVyOiB0cnVlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENoYXRTZXR1cFN0cmF0ZWd5LlNldHVwV2l0aG91dEVudGVycHJpc2VQcm92aWRlcjpcblx0XHRcdFx0XHRzdWNjZXNzID0gYXdhaXQgdGhpcy5jb250cm9sbGVyLnZhbHVlLnNldHVwV2l0aFByb3ZpZGVyKHsgc2V0dXBGcm9tRGlhbG9nOiB0cnVlLCB1c2VFbnRlcnByaXNlUHJvdmlkZXI6IGZhbHNlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENoYXRTZXR1cFN0cmF0ZWd5LkRlZmF1bHRTZXR1cDpcblx0XHRcdFx0XHRzdWNjZXNzID0gYXdhaXQgdGhpcy5jb250cm9sbGVyLnZhbHVlLnNldHVwKHsgc2V0dXBGcm9tRGlhbG9nOiB0cnVlIH0pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtjaGF0IHNldHVwXSBFcnJvciBkdXJpbmcgc2V0dXA6ICR7dG9FcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdFx0c3VjY2VzcyA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdWNjZXNzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG93RGlhbG9nKCk6IFByb21pc2U8Q2hhdFNldHVwU3RyYXRlZ3k+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGxldCByZXN1bHQ6IENoYXRTZXR1cFN0cmF0ZWd5IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgYnV0dG9ucyA9IFt0aGlzLmdldFByaW1hcnlCdXR0b24oKSwgbG9jYWxpemUoJ21heWJlTGF0ZXInLCBcIk1heWJlIExhdGVyXCIpXTtcblxuXHRcdGNvbnN0IGRpYWxvZyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlhbG9nKFxuXHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lcixcblx0XHRcdHRoaXMuZ2V0RGlhbG9nVGl0bGUoKSxcblx0XHRcdGJ1dHRvbnMsXG5cdFx0XHRjcmVhdGVXb3JrYmVuY2hEaWFsb2dPcHRpb25zKHtcblx0XHRcdFx0dHlwZTogJ25vbmUnLFxuXHRcdFx0XHRpY29uOiBDb2RpY29uLmNvcGlsb3RMYXJnZSxcblx0XHRcdFx0Y2FuY2VsSWQ6IGJ1dHRvbnMubGVuZ3RoIC0gMSxcblx0XHRcdFx0cmVuZGVyQm9keTogYm9keSA9PiBib2R5LmFwcGVuZENoaWxkKHRoaXMuY3JlYXRlRGlhbG9nKGRpc3Bvc2FibGVzKSksXG5cdFx0XHRcdHByaW1hcnlCdXR0b25Ecm9wZG93bjoge1xuXHRcdFx0XHRcdGNvbnRleHRNZW51UHJvdmlkZXI6IHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0XHRcdGFkZFByaW1hcnlBY3Rpb25Ub0Ryb3Bkb3duOiBmYWxzZSxcblx0XHRcdFx0XHRhY3Rpb25zOiBbXG5cdFx0XHRcdFx0XHR0b0FjdGlvbih7IGlkOiAnc2V0dXBXaXRoUHJvdmlkZXInLCBsYWJlbDogbG9jYWxpemUoJ3NldHVwV2l0aFByb3ZpZGVyJywgXCJTaWduIGluIHdpdGggYSB7MH0gQWNjb3VudFwiLCBkZWZhdWx0Q2hhdC5wcm92aWRlck5hbWUpLCBydW46ICgpID0+IHJlc3VsdCA9IENoYXRTZXR1cFN0cmF0ZWd5LlNldHVwV2l0aG91dEVudGVycHJpc2VQcm92aWRlciB9KSxcblx0XHRcdFx0XHRcdHRvQWN0aW9uKHsgaWQ6ICdzZXR1cFdpdGhFbnRlcnByaXNlUHJvdmlkZXInLCBsYWJlbDogbG9jYWxpemUoJ3NldHVwV2l0aEVudGVycHJpc2VQcm92aWRlcicsIFwiU2lnbiBpbiB3aXRoIGEgezB9IEFjY291bnRcIiwgZGVmYXVsdENoYXQuZW50ZXJwcmlzZVByb3ZpZGVyTmFtZSksIHJ1bjogKCkgPT4gcmVzdWx0ID0gQ2hhdFNldHVwU3RyYXRlZ3kuU2V0dXBXaXRoRW50ZXJwcmlzZVByb3ZpZGVyIH0pLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0fSwgdGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5sYXlvdXRTZXJ2aWNlKVxuXHRcdCkpO1xuXG5cdFx0Y29uc3QgeyBidXR0b24gfSA9IGF3YWl0IGRpYWxvZy5zaG93KCk7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXG5cdFx0cmV0dXJuIGJ1dHRvbiA9PT0gMCA/IHJlc3VsdCA/PyBDaGF0U2V0dXBTdHJhdGVneS5EZWZhdWx0U2V0dXAgOiBDaGF0U2V0dXBTdHJhdGVneS5DYW5jZWxlZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJpbWFyeUJ1dHRvbigpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NpZ25JbkJ1dHRvbicsIFwiU2lnbiBpblwiKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbG9jYWxpemUoJ3VzZUNvcGlsb3RCdXR0b24nLCBcIlVzZSBDb3BpbG90XCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREaWFsb2dUaXRsZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb250ZXh0LnN0YXRlLnJlZ2lzdGVyZWQgPyBsb2NhbGl6ZSgnc2lnblVwJywgXCJTaWduIGluIHRvIHVzZSBDb3BpbG90XCIpIDogbG9jYWxpemUoJ3NpZ25VcEZyZWUnLCBcIlNpZ24gaW4gdG8gdXNlIENvcGlsb3QgZm9yIGZyZWVcIik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29udGV4dC5zdGF0ZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LlBybykge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdjb3BpbG90UHJvVGl0bGUnLCBcIlN0YXJ0IHVzaW5nIENvcGlsb3QgUHJvXCIpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNvbnRleHQuc3RhdGUucmVnaXN0ZXJlZCA/IGxvY2FsaXplKCdjb3BpbG90VGl0bGUnLCBcIlN0YXJ0IHVzaW5nIENvcGlsb3RcIikgOiBsb2NhbGl6ZSgnY29waWxvdEZyZWVUaXRsZScsIFwiU3RhcnQgdXNpbmcgQ29waWxvdCBmb3IgZnJlZVwiKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRGlhbG9nKGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9ICQoJy5jaGF0LXNldHVwLXZpZXcnKTtcblxuXHRcdGNvbnN0IG1hcmtkb3duID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cblx0XHQvLyBIZWFkZXJcblx0XHRjb25zdCBoZWFkZXIgPSBsb2NhbGl6ZSh7IGtleTogJ2hlYWRlckRpYWxvZycsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltDb3BpbG90XSh7MH0pXCJ9J10gfSwgXCJbQ29waWxvdF0oezB9KSBpcyB5b3VyIEFJIHBhaXIgcHJvZ3JhbW1lci4gV3JpdGUgY29kZSBmYXN0ZXIgd2l0aCBjb21wbGV0aW9ucywgZml4IGJ1Z3MgYW5kIGJ1aWxkIG5ldyBmZWF0dXJlcyBhY3Jvc3MgbXVsdGlwbGUgZmlsZXMsIGFuZCBsZWFybiBhYm91dCB5b3VyIGNvZGViYXNlIHRocm91Z2ggY2hhdC5cIiwgZGVmYXVsdENoYXQuZG9jdW1lbnRhdGlvblVybCk7XG5cdFx0ZWxlbWVudC5hcHBlbmRDaGlsZCgkKCdwLnNldHVwLWhlYWRlcicsIHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMuYWRkKG1hcmtkb3duLnJlbmRlcihuZXcgTWFya2Rvd25TdHJpbmcoaGVhZGVyLCB7IGlzVHJ1c3RlZDogdHJ1ZSB9KSkpLmVsZW1lbnQpKTtcblxuXHRcdC8vIFRlcm1zXG5cdFx0Y29uc3QgdGVybXMgPSBsb2NhbGl6ZSh7IGtleTogJ3Rlcm1zJywgY29tbWVudDogWyd7TG9ja2VkPVwiW1wifScsICd7TG9ja2VkPVwiXSh7MH0pXCJ9JywgJ3tMb2NrZWQ9XCJdKHsxfSlcIn0nXSB9LCBcIkJ5IGNvbnRpbnVpbmcsIHlvdSBhZ3JlZSB0byB0aGUgW1Rlcm1zXSh7MH0pIGFuZCBbUHJpdmFjeSBQb2xpY3ldKHsxfSkuXCIsIGRlZmF1bHRDaGF0LnRlcm1zU3RhdGVtZW50VXJsLCBkZWZhdWx0Q2hhdC5wcml2YWN5U3RhdGVtZW50VXJsKTtcblx0XHRlbGVtZW50LmFwcGVuZENoaWxkKCQoJ3Auc2V0dXAtbGVnYWwnLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzLmFkZChtYXJrZG93bi5yZW5kZXIobmV3IE1hcmtkb3duU3RyaW5nKHRlcm1zLCB7IGlzVHJ1c3RlZDogdHJ1ZSB9KSkpLmVsZW1lbnQpKTtcblxuXHRcdC8vIFNLVSBTZXR0aW5nc1xuXHRcdGlmICh0aGlzLnRlbGVtZXRyeVNlcnZpY2UudGVsZW1ldHJ5TGV2ZWwgIT09IFRlbGVtZXRyeUxldmVsLk5PTkUpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdzID0gbG9jYWxpemUoeyBrZXk6ICdzZXR0aW5ncycsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltcIn0nLCAne0xvY2tlZD1cIl0oezB9KVwifScsICd7TG9ja2VkPVwiXSh7MX0pXCJ9J10gfSwgXCJDb3BpbG90IEZyZWUgYW5kIFBybyBtYXkgc2hvdyBbcHVibGljIGNvZGVdKHswfSkgc3VnZ2VzdGlvbnMgYW5kIHdlIG1heSB1c2UgeW91ciBkYXRhIGZvciBwcm9kdWN0IGltcHJvdmVtZW50LiBZb3UgY2FuIGNoYW5nZSB0aGVzZSBbc2V0dGluZ3NdKHsxfSkgYXQgYW55IHRpbWUuXCIsIGRlZmF1bHRDaGF0LnB1YmxpY0NvZGVNYXRjaGVzVXJsLCBkZWZhdWx0Q2hhdC5tYW5hZ2VTZXR0aW5nc1VybCk7XG5cdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKCQoJ3Auc2V0dXAtc2V0dGluZ3MnLCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzLmFkZChtYXJrZG93bi5yZW5kZXIobmV3IE1hcmtkb3duU3RyaW5nKHNldHRpbmdzLCB7IGlzVHJ1c3RlZDogdHJ1ZSB9KSkpLmVsZW1lbnQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFNldHVwQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5jaGF0U2V0dXAnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJQ2hhdEVudGl0bGVtZW50U2VydmljZSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlOiBDaGF0RW50aXRsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3QgY29udGV4dCA9IGNoYXRFbnRpdGxlbWVudFNlcnZpY2UuY29udGV4dD8udmFsdWU7XG5cdFx0Y29uc3QgcmVxdWVzdHMgPSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnJlcXVlc3RzPy52YWx1ZTtcblx0XHRpZiAoIWNvbnRleHQgfHwgIXJlcXVlc3RzKSB7XG5cdFx0XHRyZXR1cm47IC8vIGRpc2FibGVkXG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IG5ldyBMYXp5KCgpID0+IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFNldHVwQ29udHJvbGxlciwgY29udGV4dCwgcmVxdWVzdHMpKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyU2V0dXBBZ2VudHMoY29udGV4dCwgY29udHJvbGxlcik7XG5cdFx0dGhpcy5yZWdpc3RlckNoYXRXZWxjb21lKGNvbnRleHQsIGNvbnRyb2xsZXIpO1xuXHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKGNvbnRleHQsIHJlcXVlc3RzLCBjb250cm9sbGVyKTtcblx0XHR0aGlzLnJlZ2lzdGVyVXJsTGlua0hhbmRsZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTZXR1cEFnZW50cyhjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LCBjb250cm9sbGVyOiBMYXp5PENoYXRTZXR1cENvbnRyb2xsZXI+KTogdm9pZCB7XG5cdFx0Y29uc3QgcmVnaXN0cmF0aW9uID0gbWFya0FzU2luZ2xldG9uKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTsgLy8gcHJldmVudHMgZmxpY2tlciBvbiB3aW5kb3cgcmVsb2FkXG5cblx0XHRjb25zdCB1cGRhdGVSZWdpc3RyYXRpb24gPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBkaXNhYmxlZCA9IGNvbnRleHQuc3RhdGUuaGlkZGVuIHx8ICF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdjaGF0LnNldHVwRnJvbURpYWxvZycpO1xuXHRcdFx0aWYgKCFkaXNhYmxlZCAmJiAhcmVnaXN0cmF0aW9uLnZhbHVlKSB7XG5cdFx0XHRcdGNvbnN0IHsgYWdlbnQ6IHBhbmVsQWdlbnQsIGRpc3Bvc2FibGU6IHBhbmVsRGlzcG9zYWJsZSB9ID0gU2V0dXBDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbi5yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCwgZmFsc2UsIGNvbnRleHQsIGNvbnRyb2xsZXIpO1xuXHRcdFx0XHRyZWdpc3RyYXRpb24udmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRcdFx0cGFuZWxEaXNwb3NhYmxlLFxuXHRcdFx0XHRcdFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24ucmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgQ2hhdEFnZW50TG9jYXRpb24uVGVybWluYWwsIGZhbHNlLCBjb250ZXh0LCBjb250cm9sbGVyKS5kaXNwb3NhYmxlLFxuXHRcdFx0XHRcdFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24ucmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgQ2hhdEFnZW50TG9jYXRpb24uTm90ZWJvb2ssIGZhbHNlLCBjb250ZXh0LCBjb250cm9sbGVyKS5kaXNwb3NhYmxlLFxuXHRcdFx0XHRcdFNldHVwQ2hhdEFnZW50SW1wbGVtZW50YXRpb24ucmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yLCBmYWxzZSwgY29udGV4dCwgY29udHJvbGxlcikuZGlzcG9zYWJsZSxcblx0XHRcdFx0XHRTZXR1cENoYXRBZ2VudEltcGxlbWVudGF0aW9uLnJlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uLCBmYWxzZSwgY29udGV4dCwgY29udHJvbGxlcikuZGlzcG9zYWJsZSxcblx0XHRcdFx0XHRTZXR1cENoYXRBZ2VudEltcGxlbWVudGF0aW9uLnJlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uLCB0cnVlLCBjb250ZXh0LCBjb250cm9sbGVyKS5kaXNwb3NhYmxlLFxuXHRcdFx0XHRcdHBhbmVsQWdlbnQub25VbnJlc29sdmFibGVFcnJvcigoKSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBBbiB1bnJlc29sdmFibGUgZXJyb3IgZnJvbSBvdXIgYWdlbnQgcmVnaXN0cmF0aW9ucyBtZWFucyB0aGF0XG5cdFx0XHRcdFx0XHQvLyBDb3BpbG90IGlzIHVuaGVhbHRoeSBmb3Igc29tZSByZWFzb24uIFdlIGNsZWFyIG91ciBwYW5lbFxuXHRcdFx0XHRcdFx0Ly8gcmVnaXN0cmF0aW9uIHRvIGdpdmUgQ29waWxvdCBhIGNoYW5jZSB0byBzaG93IGEgY3VzdG9tIG1lc3NhZ2Vcblx0XHRcdFx0XHRcdC8vIHRvIHRoZSB1c2VyIGZyb20gdGhlIHZpZXdzIGFuZCBzdG9wIHByZXRlbmRpbmcgYXMgaWYgdGhlcmUgd2FzXG5cdFx0XHRcdFx0XHQvLyBhIGZ1bmN0aW9uYWwgYWdlbnQuXG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ1tjaGF0IHNldHVwXSBVbnJlc29sdmFibGUgZXJyb3IgZnJvbSBDb3BpbG90IGFnZW50IHJlZ2lzdHJhdGlvbiwgY2xlYXJpbmcgcmVnaXN0cmF0aW9uLicpO1xuXHRcdFx0XHRcdFx0cGFuZWxEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHQpO1xuXHRcdFx0fSBlbHNlIGlmIChkaXNhYmxlZCAmJiByZWdpc3RyYXRpb24udmFsdWUpIHtcblx0XHRcdFx0cmVnaXN0cmF0aW9uLmNsZWFyKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShFdmVudC5hbnkoXG5cdFx0XHRjb250ZXh0Lm9uRGlkQ2hhbmdlLFxuXHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2NoYXQuc2V0dXBGcm9tRGlhbG9nJykpXG5cdFx0KSwgKCkgPT4gdXBkYXRlUmVnaXN0cmF0aW9uKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDaGF0V2VsY29tZShjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LCBjb250cm9sbGVyOiBMYXp5PENoYXRTZXR1cENvbnRyb2xsZXI+KTogdm9pZCB7XG5cdFx0UmVnaXN0cnkuYXM8SUNoYXRWaWV3c1dlbGNvbWVDb250cmlidXRpb25SZWdpc3RyeT4oQ2hhdFZpZXdzV2VsY29tZUV4dGVuc2lvbnMuQ2hhdFZpZXdzV2VsY29tZVJlZ2lzdHJ5KS5yZWdpc3Rlcih7XG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3dlbGNvbWVDaGF0JywgXCJXZWxjb21lIHRvIENvcGlsb3RcIiksXG5cdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleXMuU2V0dXBWaWV3Q29uZGl0aW9uLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jb3BpbG90TGFyZ2UsXG5cdFx0XHRjb250ZW50OiBkaXNwb3NhYmxlcyA9PiBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0U2V0dXBXZWxjb21lQ29udGVudCwgY29udHJvbGxlci52YWx1ZSwgY29udGV4dCkpLmVsZW1lbnQsXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWN0aW9ucyhjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LCByZXF1ZXN0czogQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMsIGNvbnRyb2xsZXI6IExhenk8Q2hhdFNldHVwQ29udHJvbGxlcj4pOiB2b2lkIHtcblx0XHRjb25zdCBjaGF0U2V0dXBUcmlnZ2VyQ29udGV4dCA9IENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZC5uZWdhdGUoKSxcblx0XHRcdENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5jYW5TaWduVXBcblx0XHQpO1xuXG5cdFx0Y29uc3QgQ0hBVF9TRVRVUF9BQ1RJT05fTEFCRUwgPSBsb2NhbGl6ZTIoJ3RyaWdnZXJDaGF0U2V0dXAnLCBcIlVzZSBBSSBGZWF0dXJlcyB3aXRoIENvcGlsb3QgZm9yIGZyZWUuLi5cIik7XG5cblx0XHRjbGFzcyBDaGF0U2V0dXBUcmlnZ2VyQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IENIQVRfU0VUVVBfQUNUSU9OX0lELFxuXHRcdFx0XHRcdHRpdGxlOiBDSEFUX1NFVFVQX0FDVElPTl9MQUJFTCxcblx0XHRcdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0XHRwcmVjb25kaXRpb246IGNoYXRTZXR1cFRyaWdnZXJDb250ZXh0LFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdFRpdGxlQmFyTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnYV9sYXN0Jyxcblx0XHRcdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0XHRjaGF0U2V0dXBUcmlnZ2VyQ29udGV4dCxcblx0XHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmZyb21EaWFsb2cubmVnYXRlKCksXHQvLyByZWR1Y2Ugbm9pc2Ugd2hlbiB1c2luZyB0aGUgc2tlbGV0b24tdmlldyBhcHByb2FjaFxuXHRcdFx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5TZXR1cC5oaWRkZW5cdFx0XHRcdC8vIGJ1dCBlbmZvcmNlIGl0IGlmIGNvcGlsb3QgaXMgaGlkZGVuXG5cdFx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG1vZGU6IENoYXRNb2RlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3RGVzY3JpcHRvclNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgc3RhdHVzYmFyU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RhdHVzYmFyU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsaWZlY3ljbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMaWZlY3ljbGVTZXJ2aWNlKTtcblxuXHRcdFx0XHRhd2FpdCBjb250ZXh0LnVwZGF0ZSh7IGhpZGRlbjogZmFsc2UgfSk7XG5cblx0XHRcdFx0Y29uc3QgY2hhdFdpZGdldFByb21pc2UgPSBzaG93Q29waWxvdFZpZXcodmlld3NTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKG1vZGUpIHtcblx0XHRcdFx0XHRjb25zdCBjaGF0V2lkZ2V0ID0gYXdhaXQgY2hhdFdpZGdldFByb21pc2U7XG5cdFx0XHRcdFx0Y2hhdFdpZGdldD8uaW5wdXQuc2V0Q2hhdE1vZGUobW9kZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzZXR1cEZyb21EaWFsb2cgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5zZXR1cEZyb21EaWFsb2cnKTtcblx0XHRcdFx0aWYgKCFzZXR1cEZyb21EaWFsb2cpIHtcblx0XHRcdFx0XHRlbnN1cmVTaWRlQmFyQ2hhdFZpZXdTaXplKHZpZXdEZXNjcmlwdG9yU2VydmljZSwgbGF5b3V0U2VydmljZSwgdmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN0YXR1c2JhclNlcnZpY2UudXBkYXRlRW50cnlWaXNpYmlsaXR5KCdjaGF0LnN0YXR1c0JhckVudHJ5JywgdHJ1ZSk7XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKCdjaGF0LmNvbW1hbmRDZW50ZXIuZW5hYmxlZCcsIHRydWUpO1xuXG5cdFx0XHRcdGlmIChzZXR1cEZyb21EaWFsb2cpIHtcblx0XHRcdFx0XHRjb25zdCBzZXR1cCA9IENoYXRTZXR1cC5nZXRJbnN0YW5jZShpbnN0YW50aWF0aW9uU2VydmljZSwgY29udGV4dCwgY29udHJvbGxlcik7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2V0dXAucnVuKCk7XG5cdFx0XHRcdFx0aWYgKHJlc3VsdCA9PT0gZmFsc2UgJiYgIWxpZmVjeWNsZVNlcnZpY2Uud2lsbFNodXRkb3duKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdzZXR1cEVycm9yRGlhbG9nJywgXCJDb3BpbG90IHNldHVwIGZhaWxlZC4gV291bGQgeW91IGxpa2UgdG8gdHJ5IGFnYWluP1wiKSxcblx0XHRcdFx0XHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoJ3JldHJ5JywgXCJSZXRyeVwiKSxcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKENIQVRfU0VUVVBfQUNUSU9OX0lEKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjbGFzcyBDaGF0U2V0dXBIaWRlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0XHRcdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuaGlkZVNldHVwJztcblx0XHRcdHN0YXRpYyByZWFkb25seSBUSVRMRSA9IGxvY2FsaXplMignaGlkZUNoYXRTZXR1cCcsIFwiSGlkZSBDb3BpbG90XCIpO1xuXG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBDaGF0U2V0dXBIaWRlQWN0aW9uLklELFxuXHRcdFx0XHRcdHRpdGxlOiBDaGF0U2V0dXBIaWRlQWN0aW9uLlRJVExFLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5TZXR1cC5pbnN0YWxsZWQubmVnYXRlKCksIENoYXRDb250ZXh0S2V5cy5TZXR1cC5oaWRkZW4ubmVnYXRlKCkpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdFRpdGxlQmFyTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnel9oaWRlJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZC5uZWdhdGUoKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCB2aWV3c0Rlc2NyaXB0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3RGVzY3JpcHRvclNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsYXlvdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHN0YXR1c2JhclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVN0YXR1c2JhclNlcnZpY2UpO1xuXG5cdFx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdoaWRlQ2hhdFNldHVwQ29uZmlybScsIFwiQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGhpZGUgQ29waWxvdD9cIiksXG5cdFx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnaGlkZUNoYXRTZXR1cERldGFpbCcsIFwiWW91IGNhbiByZXN0b3JlIENvcGlsb3QgYnkgcnVubmluZyB0aGUgJ3swfScgY29tbWFuZC5cIiwgQ0hBVF9TRVRVUF9BQ1RJT05fTEFCRUwudmFsdWUpLFxuXHRcdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKCdoaWRlQ2hhdFNldHVwQnV0dG9uJywgXCJIaWRlIENvcGlsb3RcIilcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKCFjb25maXJtZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBsb2NhdGlvbiA9IHZpZXdzRGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZChDaGF0Vmlld0lkKTtcblxuXHRcdFx0XHRhd2FpdCBjb250ZXh0LnVwZGF0ZSh7IGhpZGRlbjogdHJ1ZSB9KTtcblxuXHRcdFx0XHRpZiAobG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5BdXhpbGlhcnlCYXIpIHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmVDb250YWluZXJzID0gdmlld3NEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyc0J5TG9jYXRpb24obG9jYXRpb24pLmZpbHRlcihjb250YWluZXIgPT4gdmlld3NEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwoY29udGFpbmVyKS5hY3RpdmVWaWV3RGVzY3JpcHRvcnMubGVuZ3RoID4gMCk7XG5cdFx0XHRcdFx0aWYgKGFjdGl2ZUNvbnRhaW5lcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRsYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQpOyAvLyBoaWRlIGlmIHRoZXJlIGFyZSBubyB2aWV3cyBpbiB0aGUgc2Vjb25kYXJ5IHNpZGViYXJcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzdGF0dXNiYXJTZXJ2aWNlLnVwZGF0ZUVudHJ5VmlzaWJpbGl0eSgnY2hhdC5zdGF0dXNCYXJFbnRyeScsIGZhbHNlKTtcblx0XHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2NoYXQuY29tbWFuZENlbnRlci5lbmFibGVkJywgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHdpbmRvd0ZvY3VzTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdFx0Y2xhc3MgVXBncmFkZVBsYW5BY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQudXBncmFkZVBsYW4nLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21hbmFnZVBsYW4nLCBcIlVwZ3JhZGUgdG8gQ29waWxvdCBQcm9cIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IGxvY2FsaXplMignY2hhdC5jYXRlZ29yeScsICdDaGF0JyksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5jYW5TaWduVXAsXG5cdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQubGltaXRlZCxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdFRpdGxlQmFyTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnYV9maXJzdCcsXG5cdFx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuY2hhdFF1b3RhRXhjZWVkZWQsXG5cdFx0XHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5jb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGZyb20/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIb3N0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cblx0XHRcdFx0b3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZShkZWZhdWx0Q2hhdC51cGdyYWRlUGxhblVybCkpO1xuXG5cdFx0XHRcdGNvbnN0IGVudGl0bGVtZW50ID0gY29udGV4dC5zdGF0ZS5lbnRpdGxlbWVudDtcblx0XHRcdFx0aWYgKGVudGl0bGVtZW50ICE9PSBDaGF0RW50aXRsZW1lbnQuUHJvKSB7XG5cdFx0XHRcdFx0Ly8gSWYgdGhlIHVzZXIgaXMgbm90IHlldCBQcm8sIHdlIGxpc3RlbiB0byB3aW5kb3cgZm9jdXMgdG8gcmVmcmVzaCB0aGUgdG9rZW5cblx0XHRcdFx0XHQvLyB3aGVuIHRoZSB1c2VyIGhhcyBjb21lIGJhY2sgdG8gdGhlIHdpbmRvdyBhc3N1bWluZyB0aGUgdXNlciBzaWduZWQgdXAuXG5cdFx0XHRcdFx0d2luZG93Rm9jdXNMaXN0ZW5lci52YWx1ZSA9IGhvc3RTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9jdXMoZm9jdXMgPT4gdGhpcy5vbldpbmRvd0ZvY3VzKGZvY3VzLCBjb21tYW5kU2VydmljZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHByaXZhdGUgYXN5bmMgb25XaW5kb3dGb2N1cyhmb2N1czogYm9vbGVhbiwgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdFx0XHR3aW5kb3dGb2N1c0xpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHRcdFx0XHRjb25zdCBlbnRpdGxlbWVudHMgPSBhd2FpdCByZXF1ZXN0cy5mb3JjZVJlc29sdmVFbnRpdGxlbWVudCh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGlmIChlbnRpdGxlbWVudHM/LmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuUHJvKSB7XG5cdFx0XHRcdFx0XHRyZWZyZXNoVG9rZW5zKGNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZWdpc3RlckFjdGlvbjIoQ2hhdFNldHVwVHJpZ2dlckFjdGlvbik7XG5cdFx0cmVnaXN0ZXJBY3Rpb24yKENoYXRTZXR1cEhpZGVBY3Rpb24pO1xuXHRcdHJlZ2lzdGVyQWN0aW9uMihVcGdyYWRlUGxhbkFjdGlvbik7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVXJsTGlua0hhbmRsZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXh0ZW5zaW9uVXJsSGFuZGxlck92ZXJyaWRlUmVnaXN0cnkucmVnaXN0ZXJIYW5kbGVyKHtcblx0XHRcdGNhbkhhbmRsZVVSTDogdXJsID0+IHtcblx0XHRcdFx0cmV0dXJuIHVybC5zY2hlbWUgPT09IHRoaXMucHJvZHVjdFNlcnZpY2UudXJsUHJvdG9jb2wgJiYgZXF1YWxzSWdub3JlQ2FzZSh1cmwuYXV0aG9yaXR5LCBkZWZhdWx0Q2hhdC5jaGF0RXh0ZW5zaW9uSWQpO1xuXHRcdFx0fSxcblx0XHRcdGhhbmRsZVVSTDogYXN5bmMgdXJsID0+IHtcblx0XHRcdFx0Y29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh1cmwucXVlcnkpO1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBDSEFUX1NFVFVQX0FDVElPTl9JRCwgZnJvbTogJ3VybCcsIGRldGFpbDogcGFyYW1zLmdldCgncmVmZXJyZXInKSA/PyB1bmRlZmluZWQgfSk7XG5cblx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChDSEFUX1NFVFVQX0FDVElPTl9JRCwgdmFsaWRhdGVDaGF0TW9kZShwYXJhbXMuZ2V0KCdtb2RlJykpKTtcblxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBTZXR1cCBDb250cm9sbGVyXG5cbnR5cGUgSW5zdGFsbENoYXRDbGFzc2lmaWNhdGlvbiA9IHtcblx0b3duZXI6ICdicGFzZXJvJztcblx0Y29tbWVudDogJ1Byb3ZpZGVzIGluc2lnaHQgaW50byBjaGF0IGluc3RhbGxhdGlvbi4nO1xuXHRpbnN0YWxsUmVzdWx0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciB0aGUgZXh0ZW5zaW9uIHdhcyBpbnN0YWxsZWQgc3VjY2Vzc2Z1bGx5LCBjYW5jZWxsZWQgb3IgZmFpbGVkIHRvIGluc3RhbGwuJyB9O1xuXHRpbnN0YWxsRHVyYXRpb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZHVyYXRpb24gaXQgdG9vayB0byBpbnN0YWxsIHRoZSBleHRlbnNpb24uJyB9O1xuXHRzaWduVXBFcnJvckNvZGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZXJyb3IgY29kZSBpbiBjYXNlIG9mIGFuIGVycm9yIHNpZ25pbmcgdXAuJyB9O1xuXHRzZXR1cEZyb21EaWFsb2c6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSBzZXR1cCB3YXMgdHJpZ2dlcmVkIGZyb20gdGhlIGRpYWxvZyBvciBub3QuJyB9O1xufTtcbnR5cGUgSW5zdGFsbENoYXRFdmVudCA9IHtcblx0aW5zdGFsbFJlc3VsdDogJ2luc3RhbGxlZCcgfCAnYWxyZWFkeUluc3RhbGxlZCcgfCAnY2FuY2VsbGVkJyB8ICdmYWlsZWRJbnN0YWxsJyB8ICdmYWlsZWROb3RTaWduZWRJbicgfCAnZmFpbGVkU2lnblVwJyB8ICdmYWlsZWROb3RUcnVzdGVkJyB8ICdmYWlsZWROb1Nlc3Npb24nO1xuXHRpbnN0YWxsRHVyYXRpb246IG51bWJlcjtcblx0c2lnblVwRXJyb3JDb2RlOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHNldHVwRnJvbURpYWxvZzogYm9vbGVhbjtcbn07XG5cbmVudW0gQ2hhdFNldHVwU3RlcCB7XG5cdEluaXRpYWwgPSAxLFxuXHRTaWduaW5nSW4sXG5cdEluc3RhbGxpbmdcbn1cblxuY2xhc3MgQ2hhdFNldHVwQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfc3RlcCA9IENoYXRTZXR1cFN0ZXAuSW5pdGlhbDtcblx0Z2V0IHN0ZXAoKTogQ2hhdFNldHVwU3RlcCB7IHJldHVybiB0aGlzLl9zdGVwOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdHM6IENoYXRFbnRpdGxlbWVudFJlcXVlc3RzLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJQXV0aGVudGljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYXV0aGVudGljYXRpb25TZXJ2aWNlOiBJQXV0aGVudGljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJQWN0aXZpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWN0aXZpdHlTZXJ2aWNlOiBJQWN0aXZpdHlTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHQub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIHNldFN0ZXAoc3RlcDogQ2hhdFNldHVwU3RlcCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zdGVwID09PSBzdGVwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fc3RlcCA9IHN0ZXA7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHR9XG5cblx0YXN5bmMgc2V0dXAob3B0aW9ucz86IHsgZm9yY2VTaWduSW4/OiBib29sZWFuOyBzZXR1cEZyb21EaWFsb2c/OiBib29sZWFuIH0pOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB3YXRjaCA9IG5ldyBTdG9wV2F0Y2goZmFsc2UpO1xuXHRcdGNvbnN0IHRpdGxlID0gbG9jYWxpemUoJ3NldHVwQ2hhdFByb2dyZXNzJywgXCJHZXR0aW5nIENvcGlsb3QgcmVhZHkuLi5cIik7XG5cdFx0Y29uc3QgYmFkZ2UgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0NvbnRhaW5lckFjdGl2aXR5KHByZWZlckNvcGlsb3RFZGl0c1ZpZXcodGhpcy52aWV3c1NlcnZpY2UpID8gQ0hBVF9FRElUSU5HX1NJREVCQVJfUEFORUxfSUQgOiBDSEFUX1NJREVCQVJfUEFORUxfSUQsIHtcblx0XHRcdGJhZGdlOiBuZXcgUHJvZ3Jlc3NCYWRnZSgoKSA9PiB0aXRsZSksXG5cdFx0fSk7XG5cblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyxcblx0XHRcdFx0Y29tbWFuZDogQ0hBVF9PUEVOX0FDVElPTl9JRCxcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHR9LCAoKSA9PiB0aGlzLmRvU2V0dXAob3B0aW9ucyA/PyB7fSwgd2F0Y2gpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YmFkZ2UuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TZXR1cChvcHRpb25zOiB7IGZvcmNlU2lnbkluPzogYm9vbGVhbjsgc2V0dXBGcm9tRGlhbG9nPzogYm9vbGVhbiB9LCB3YXRjaDogU3RvcFdhdGNoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dGhpcy5jb250ZXh0LnN1c3BlbmQoKTsgIC8vIHJlZHVjZXMgZmxpY2tlclxuXG5cdFx0bGV0IGZvY3VzQ2hhdElucHV0ID0gZmFsc2U7XG5cdFx0bGV0IHN1Y2Nlc3MgPSBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXJJZCA9IENoYXRFbnRpdGxlbWVudFJlcXVlc3RzLnByb3ZpZGVySWQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRsZXQgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0XHRcdC8vIEVudGl0bGVtZW50IFVua25vd24gb3IgYGZvcmNlU2lnbkluYDogd2UgbmVlZCB0byBzaWduLWluIHVzZXJcblx0XHRcdGlmICh0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duIHx8IG9wdGlvbnMuZm9yY2VTaWduSW4pIHtcblx0XHRcdFx0dGhpcy5zZXRTdGVwKENoYXRTZXR1cFN0ZXAuU2lnbmluZ0luKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5zaWduSW4ocHJvdmlkZXJJZCwgb3B0aW9ucyk7XG5cdFx0XHRcdGlmICghcmVzdWx0LnNlc3Npb24pIHtcblx0XHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxJbnN0YWxsQ2hhdEV2ZW50LCBJbnN0YWxsQ2hhdENsYXNzaWZpY2F0aW9uPignY29tbWFuZENlbnRlci5jaGF0SW5zdGFsbCcsIHsgaW5zdGFsbFJlc3VsdDogJ2ZhaWxlZE5vdFNpZ25lZEluJywgaW5zdGFsbER1cmF0aW9uOiB3YXRjaC5lbGFwc2VkKCksIHNpZ25VcEVycm9yQ29kZTogdW5kZWZpbmVkLCBzZXR1cEZyb21EaWFsb2c6IEJvb2xlYW4ob3B0aW9ucy5zZXR1cEZyb21EaWFsb2cpIH0pO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNlc3Npb24gPSByZXN1bHQuc2Vzc2lvbjtcblx0XHRcdFx0ZW50aXRsZW1lbnQgPSByZXN1bHQuZW50aXRsZW1lbnQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRydXN0ZWQgPSBhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdFdvcmtzcGFjZVRydXN0KHtcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvcGlsb3RXb3Jrc3BhY2VUcnVzdCcsIFwiQ29waWxvdCBpcyBjdXJyZW50bHkgb25seSBzdXBwb3J0ZWQgaW4gdHJ1c3RlZCB3b3Jrc3BhY2VzLlwiKVxuXHRcdFx0fSk7XG5cdFx0XHRpZiAoIXRydXN0ZWQpIHtcblx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8SW5zdGFsbENoYXRFdmVudCwgSW5zdGFsbENoYXRDbGFzc2lmaWNhdGlvbj4oJ2NvbW1hbmRDZW50ZXIuY2hhdEluc3RhbGwnLCB7IGluc3RhbGxSZXN1bHQ6ICdmYWlsZWROb3RUcnVzdGVkJywgaW5zdGFsbER1cmF0aW9uOiB3YXRjaC5lbGFwc2VkKCksIHNpZ25VcEVycm9yQ29kZTogdW5kZWZpbmVkLCBzZXR1cEZyb21EaWFsb2c6IEJvb2xlYW4ob3B0aW9ucy5zZXR1cEZyb21EaWFsb2cpIH0pO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFjdGl2ZUVsZW1lbnQgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cblx0XHRcdC8vIEluc3RhbGxcblx0XHRcdHRoaXMuc2V0U3RlcChDaGF0U2V0dXBTdGVwLkluc3RhbGxpbmcpO1xuXHRcdFx0c3VjY2VzcyA9IGF3YWl0IHRoaXMuaW5zdGFsbChzZXNzaW9uLCBlbnRpdGxlbWVudCA/PyB0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQsIHByb3ZpZGVySWQsIG9wdGlvbnMsIHdhdGNoKTtcblxuXHRcdFx0Y29uc3QgY3VycmVudEFjdGl2ZUVsZW1lbnQgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0XHRmb2N1c0NoYXRJbnB1dCA9IGFjdGl2ZUVsZW1lbnQgPT09IGN1cnJlbnRBY3RpdmVFbGVtZW50IHx8IGN1cnJlbnRBY3RpdmVFbGVtZW50ID09PSBtYWluV2luZG93LmRvY3VtZW50LmJvZHk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc2V0U3RlcChDaGF0U2V0dXBTdGVwLkluaXRpYWwpO1xuXHRcdFx0dGhpcy5jb250ZXh0LnJlc3VtZSgpO1xuXHRcdH1cblxuXHRcdGlmIChmb2N1c0NoYXRJbnB1dCAmJiAhb3B0aW9ucy5zZXR1cEZyb21EaWFsb2cpIHtcblx0XHRcdChhd2FpdCBzaG93Q29waWxvdFZpZXcodGhpcy52aWV3c1NlcnZpY2UsIHRoaXMubGF5b3V0U2VydmljZSkpPy5mb2N1c0lucHV0KCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1Y2Nlc3M7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNpZ25Jbihwcm92aWRlcklkOiBzdHJpbmcsIG9wdGlvbnM/OiB7IHNldHVwRnJvbURpYWxvZz86IGJvb2xlYW4gfSk6IFByb21pc2U8eyBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24gfCB1bmRlZmluZWQ7IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQgfCB1bmRlZmluZWQgfT4ge1xuXHRcdGxldCBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGVudGl0bGVtZW50cztcblx0XHR0cnkge1xuXHRcdFx0aWYgKCFvcHRpb25zPy5zZXR1cEZyb21EaWFsb2cpIHtcblx0XHRcdFx0c2hvd0NvcGlsb3RWaWV3KHRoaXMudmlld3NTZXJ2aWNlLCB0aGlzLmxheW91dFNlcnZpY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHQoeyBzZXNzaW9uLCBlbnRpdGxlbWVudHMgfSA9IGF3YWl0IHRoaXMucmVxdWVzdHMuc2lnbkluKCkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2NoYXQgc2V0dXBdIHNpZ25JbjogZXJyb3IgJHtlfWApO1xuXHRcdH1cblxuXHRcdGlmICghc2Vzc2lvbiAmJiAhdGhpcy5saWZlY3ljbGVTZXJ2aWNlLndpbGxTaHV0ZG93bikge1xuXHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd1bmtub3duU2lnbkluRXJyb3InLCBcIkZhaWxlZCB0byBzaWduIGluIHRvIHswfS4gV291bGQgeW91IGxpa2UgdG8gdHJ5IGFnYWluP1wiLCBDaGF0RW50aXRsZW1lbnRSZXF1ZXN0cy5wcm92aWRlcklkKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpID09PSBkZWZhdWx0Q2hhdC5lbnRlcnByaXNlUHJvdmlkZXJJZCA/IGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlck5hbWUgOiBkZWZhdWx0Q2hhdC5wcm92aWRlck5hbWUpLFxuXHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCd1bmtub3duU2lnbkluRXJyb3JEZXRhaWwnLCBcIllvdSBtdXN0IGJlIHNpZ25lZCBpbiB0byB1c2UgQ29waWxvdC5cIiksXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKCdyZXRyeScsIFwiUmV0cnlcIilcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNpZ25Jbihwcm92aWRlcklkLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBzZXNzaW9uLCBlbnRpdGxlbWVudDogZW50aXRsZW1lbnRzPy5lbnRpdGxlbWVudCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbnN0YWxsKHNlc3Npb246IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiB8IHVuZGVmaW5lZCwgZW50aXRsZW1lbnQ6IENoYXRFbnRpdGxlbWVudCwgcHJvdmlkZXJJZDogc3RyaW5nLCBvcHRpb25zOiB7IHNldHVwRnJvbURpYWxvZz86IGJvb2xlYW4gfSwgd2F0Y2g6IFN0b3BXYXRjaCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHdhc0luc3RhbGxlZCA9IHRoaXMuY29udGV4dC5zdGF0ZS5pbnN0YWxsZWQ7XG5cdFx0bGV0IHNpZ25VcFJlc3VsdDogYm9vbGVhbiB8IHsgZXJyb3JDb2RlOiBudW1iZXIgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoIW9wdGlvbnM/LnNldHVwRnJvbURpYWxvZykge1xuXHRcdFx0XHRzaG93Q29waWxvdFZpZXcodGhpcy52aWV3c1NlcnZpY2UsIHRoaXMubGF5b3V0U2VydmljZSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChcblx0XHRcdFx0ZW50aXRsZW1lbnQgIT09IENoYXRFbnRpdGxlbWVudC5MaW1pdGVkICYmXHQvLyBVc2VyIGlzIG5vdCBzaWduZWQgdXAgdG8gQ29waWxvdCBGcmVlXG5cdFx0XHRcdGVudGl0bGVtZW50ICE9PSBDaGF0RW50aXRsZW1lbnQuUHJvICYmXHRcdC8vIFVzZXIgaXMgbm90IHNpZ25lZCB1cCB0byBDb3BpbG90IFByb1xuXHRcdFx0XHRlbnRpdGxlbWVudCAhPT0gQ2hhdEVudGl0bGVtZW50LlVuYXZhaWxhYmxlXHQvLyBVc2VyIGlzIGVsaWdpYmxlIGZvciBDb3BpbG90IEZyZWVcblx0XHRcdCkge1xuXHRcdFx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0c2Vzc2lvbiA9IChhd2FpdCB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRTZXNzaW9ucyhwcm92aWRlcklkKSkuYXQoMCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdC8vIGlnbm9yZSAtIGVycm9ycyBjYW4gdGhyb3cgaWYgYSBwcm92aWRlciBpcyBub3QgcmVnaXN0ZXJlZFxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8SW5zdGFsbENoYXRFdmVudCwgSW5zdGFsbENoYXRDbGFzc2lmaWNhdGlvbj4oJ2NvbW1hbmRDZW50ZXIuY2hhdEluc3RhbGwnLCB7IGluc3RhbGxSZXN1bHQ6ICdmYWlsZWROb1Nlc3Npb24nLCBpbnN0YWxsRHVyYXRpb246IHdhdGNoLmVsYXBzZWQoKSwgc2lnblVwRXJyb3JDb2RlOiB1bmRlZmluZWQsIHNldHVwRnJvbURpYWxvZzogQm9vbGVhbihvcHRpb25zLnNldHVwRnJvbURpYWxvZykgfSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHVuZXhwZWN0ZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRzaWduVXBSZXN1bHQgPSBhd2FpdCB0aGlzLnJlcXVlc3RzLnNpZ25VcExpbWl0ZWQoc2Vzc2lvbik7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBzaWduVXBSZXN1bHQgIT09ICdib29sZWFuJyAvKiBlcnJvciAqLykge1xuXHRcdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEluc3RhbGxDaGF0RXZlbnQsIEluc3RhbGxDaGF0Q2xhc3NpZmljYXRpb24+KCdjb21tYW5kQ2VudGVyLmNoYXRJbnN0YWxsJywgeyBpbnN0YWxsUmVzdWx0OiAnZmFpbGVkU2lnblVwJywgaW5zdGFsbER1cmF0aW9uOiB3YXRjaC5lbGFwc2VkKCksIHNpZ25VcEVycm9yQ29kZTogc2lnblVwUmVzdWx0LmVycm9yQ29kZSwgc2V0dXBGcm9tRGlhbG9nOiBCb29sZWFuKG9wdGlvbnMuc2V0dXBGcm9tRGlhbG9nKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLmRvSW5zdGFsbCgpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtjaGF0IHNldHVwXSBpbnN0YWxsOiBlcnJvciAke2Vycm9yfWApO1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8SW5zdGFsbENoYXRFdmVudCwgSW5zdGFsbENoYXRDbGFzc2lmaWNhdGlvbj4oJ2NvbW1hbmRDZW50ZXIuY2hhdEluc3RhbGwnLCB7IGluc3RhbGxSZXN1bHQ6IGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpID8gJ2NhbmNlbGxlZCcgOiAnZmFpbGVkSW5zdGFsbCcsIGluc3RhbGxEdXJhdGlvbjogd2F0Y2guZWxhcHNlZCgpLCBzaWduVXBFcnJvckNvZGU6IHVuZGVmaW5lZCwgc2V0dXBGcm9tRGlhbG9nOiBCb29sZWFuKG9wdGlvbnMuc2V0dXBGcm9tRGlhbG9nKSB9KTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxJbnN0YWxsQ2hhdEV2ZW50LCBJbnN0YWxsQ2hhdENsYXNzaWZpY2F0aW9uPignY29tbWFuZENlbnRlci5jaGF0SW5zdGFsbCcsIHsgaW5zdGFsbFJlc3VsdDogd2FzSW5zdGFsbGVkID8gJ2FscmVhZHlJbnN0YWxsZWQnIDogJ2luc3RhbGxlZCcsIGluc3RhbGxEdXJhdGlvbjogd2F0Y2guZWxhcHNlZCgpLCBzaWduVXBFcnJvckNvZGU6IHVuZGVmaW5lZCwgc2V0dXBGcm9tRGlhbG9nOiBCb29sZWFuKG9wdGlvbnMuc2V0dXBGcm9tRGlhbG9nKSB9KTtcblxuXHRcdGlmICh3YXNJbnN0YWxsZWQgJiYgc2lnblVwUmVzdWx0ID09PSB0cnVlKSB7XG5cdFx0XHRyZWZyZXNoVG9rZW5zKHRoaXMuY29tbWFuZFNlcnZpY2UpO1xuXHRcdH1cblxuXHRcdGlmICghb3B0aW9ucz8uc2V0dXBGcm9tRGlhbG9nKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW1xuXHRcdFx0XHR0aW1lb3V0KDUwMDApLCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBoZWxwcyBwcmV2ZW50IGZsaWNrZXIgd2l0aCBzaWduLWluIHdlbGNvbWUgdmlld1xuXHRcdFx0XHRFdmVudC50b1Byb21pc2UodGhpcy5jaGF0QWdlbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWdlbnRzKVx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUtY29waWxvdC9pc3N1ZXMvOTI3NFxuXHRcdFx0XSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSW5zdGFsbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoZGVmYXVsdENoYXQuZXh0ZW5zaW9uSWQsIHtcblx0XHRcdFx0ZW5hYmxlOiB0cnVlLFxuXHRcdFx0XHRpc0FwcGxpY2F0aW9uU2NvcGVkOiB0cnVlLCBcdC8vIGluc3RhbGwgaW50byBhbGwgcHJvZmlsZXNcblx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiBmYWxzZSxcdFx0Ly8gZG8gbm90IGFzayB0byBzeW5jXG5cdFx0XHRcdGluc3RhbGxFdmVyeXdoZXJlOiB0cnVlLFx0Ly8gaW5zdGFsbCBpbiBsb2NhbCBhbmQgcmVtb3RlXG5cdFx0XHRcdGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogdGhpcy5wcm9kdWN0U2VydmljZS5xdWFsaXR5ICE9PSAnc3RhYmxlJ1xuXHRcdFx0fSwgcHJlZmVyQ29waWxvdEVkaXRzVmlldyh0aGlzLnZpZXdzU2VydmljZSkgPyBFZGl0c1ZpZXdJZCA6IENoYXRWaWV3SWQpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2NoYXQgc2V0dXBdIGluc3RhbGw6IGVycm9yICR7ZXJyb3J9YCk7XG5cdFx0XHRlcnJvciA9IGU7XG5cdFx0fVxuXG5cdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRpZiAoIXRoaXMubGlmZWN5Y2xlU2VydmljZS53aWxsU2h1dGRvd24pIHtcblx0XHRcdFx0Y29uc3QgeyBjb25maXJtZWQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHR0eXBlOiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndW5rbm93blNldHVwRXJyb3InLCBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNldHRpbmcgdXAgQ29waWxvdC4gV291bGQgeW91IGxpa2UgdG8gdHJ5IGFnYWluP1wiKSxcblx0XHRcdFx0XHRkZXRhaWw6IGVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSA/IHRvRXJyb3JNZXNzYWdlKGVycm9yKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgncmV0cnknLCBcIlJldHJ5XCIpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGlmIChjb25maXJtZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb0luc3RhbGwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZXR1cFdpdGhQcm92aWRlcihvcHRpb25zOiB7IHVzZUVudGVycHJpc2VQcm92aWRlcjogYm9vbGVhbjsgc2V0dXBGcm9tRGlhbG9nPzogYm9vbGVhbiB9KTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblx0XHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0J2lkJzogJ2NvcGlsb3Quc2V0dXAnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHRbZGVmYXVsdENoYXQuY29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmddOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdFx0XHRcdCdhdXRoUHJvdmlkZXInOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdFtkZWZhdWx0Q2hhdC5wcm92aWRlclVyaVNldHRpbmddOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAob3B0aW9ucy51c2VFbnRlcnByaXNlUHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHN1Y2Nlc3MgPSBhd2FpdCB0aGlzLmhhbmRsZUVudGVycHJpc2VJbnN0YW5jZSgpO1xuXHRcdFx0aWYgKCFzdWNjZXNzKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gbm90IHByb3Blcmx5IGNvbmZpZ3VyZWQsIGFib3J0XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGV4aXN0aW5nQWR2YW5jZWRTZXR0aW5nID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KGRlZmF1bHRDaGF0LmNvbXBsZXRpb25zQWR2YW5jZWRTZXR0aW5nKS51c2VyPy52YWx1ZTtcblx0XHRpZiAoIWlzT2JqZWN0KGV4aXN0aW5nQWR2YW5jZWRTZXR0aW5nKSkge1xuXHRcdFx0ZXhpc3RpbmdBZHZhbmNlZFNldHRpbmcgPSB7fTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy51c2VFbnRlcnByaXNlUHJvdmlkZXIpIHtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoYCR7ZGVmYXVsdENoYXQuY29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmd9YCwge1xuXHRcdFx0XHQuLi5leGlzdGluZ0FkdmFuY2VkU2V0dGluZyxcblx0XHRcdFx0J2F1dGhQcm92aWRlcic6IGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlcklkXG5cdFx0XHR9LCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGAke2RlZmF1bHRDaGF0LmNvbXBsZXRpb25zQWR2YW5jZWRTZXR0aW5nfWAsIE9iamVjdC5rZXlzKGV4aXN0aW5nQWR2YW5jZWRTZXR0aW5nKS5sZW5ndGggPiAwID8ge1xuXHRcdFx0XHQuLi5leGlzdGluZ0FkdmFuY2VkU2V0dGluZyxcblx0XHRcdFx0J2F1dGhQcm92aWRlcic6IHVuZGVmaW5lZFxuXHRcdFx0fSA6IHVuZGVmaW5lZCwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoZGVmYXVsdENoYXQucHJvdmlkZXJVcmlTZXR0aW5nLCB1bmRlZmluZWQsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuc2V0dXAoeyAuLi5vcHRpb25zLCBmb3JjZVNpZ25JbjogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaGFuZGxlRW50ZXJwcmlzZUluc3RhbmNlKCk6IFByb21pc2U8Ym9vbGVhbiAvKiBzdWNjZXNzICovPiB7XG5cdFx0Y29uc3QgZG9tYWluUmVnRXggPSAvXlthLXpBLVpcXC1fXSskLztcblx0XHRjb25zdCBmdWxsVXJpUmVnRXggPSAvXihodHRwczpcXC9cXC8pPyhbYS16QS1aMC05LV0rXFwuKSpbYS16QS1aMC05LV0rXFwuZ2hlXFwuY29tXFwvPyQvO1xuXG5cdFx0Y29uc3QgdXJpID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmc+KGRlZmF1bHRDaGF0LnByb3ZpZGVyVXJpU2V0dGluZyk7XG5cdFx0aWYgKHR5cGVvZiB1cmkgPT09ICdzdHJpbmcnICYmIGZ1bGxVcmlSZWdFeC50ZXN0KHVyaSkpIHtcblx0XHRcdHJldHVybiB0cnVlOyAvLyBhbHJlYWR5IHNldHVwIHdpdGggYSB2YWxpZCBVUklcblx0XHR9XG5cblx0XHRsZXQgaXNTaW5nbGVXb3JkID0gZmFsc2U7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5xdWlja0lucHV0U2VydmljZS5pbnB1dCh7XG5cdFx0XHRwcm9tcHQ6IGxvY2FsaXplKCdlbnRlcnByaXNlSW5zdGFuY2UnLCBcIldoYXQgaXMgeW91ciB7MH0gaW5zdGFuY2U/XCIsIGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlck5hbWUpLFxuXHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdlbnRlcnByaXNlSW5zdGFuY2VQbGFjZWhvbGRlcicsICdpLmUuIFwib2N0b2NhdFwiIG9yIFwiaHR0cHM6Ly9vY3RvY2F0LmdoZS5jb21cIi4uLicpLFxuXHRcdFx0aWdub3JlRm9jdXNMb3N0OiB0cnVlLFxuXHRcdFx0dmFsdWU6IHVyaSxcblx0XHRcdHZhbGlkYXRlSW5wdXQ6IGFzeW5jIHZhbHVlID0+IHtcblx0XHRcdFx0aXNTaW5nbGVXb3JkID0gZmFsc2U7XG5cdFx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGRvbWFpblJlZ0V4LnRlc3QodmFsdWUpKSB7XG5cdFx0XHRcdFx0aXNTaW5nbGVXb3JkID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Y29udGVudDogbG9jYWxpemUoJ3dpbGxSZXNvbHZlVG8nLCBcIldpbGwgcmVzb2x2ZSB0byB7MH1cIiwgYGh0dHBzOi8vJHt2YWx1ZX0uZ2hlLmNvbWApLFxuXHRcdFx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkluZm9cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9IGlmICghZnVsbFVyaVJlZ0V4LnRlc3QodmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IGxvY2FsaXplKCdpbnZhbGlkRW50ZXJwcmlzZUluc3RhbmNlJywgJ1lvdSBtdXN0IGVudGVyIGEgdmFsaWQgezB9IGluc3RhbmNlIChpLmUuIFwib2N0b2NhdFwiIG9yIFwiaHR0cHM6Ly9vY3RvY2F0LmdoZS5jb21cIiknLCBkZWZhdWx0Q2hhdC5lbnRlcnByaXNlUHJvdmlkZXJOYW1lKSxcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5FcnJvclxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnZW50ZXJwcmlzZVNldHVwRXJyb3InLCBcIlRoZSBwcm92aWRlZCB7MH0gaW5zdGFuY2UgaXMgaW52YWxpZC4gV291bGQgeW91IGxpa2UgdG8gZW50ZXIgaXQgYWdhaW4/XCIsIGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlck5hbWUpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgncmV0cnknLCBcIlJldHJ5XCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5oYW5kbGVFbnRlcnByaXNlSW5zdGFuY2UoKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCByZXNvbHZlZFVyaSA9IHJlc3VsdDtcblx0XHRpZiAoaXNTaW5nbGVXb3JkKSB7XG5cdFx0XHRyZXNvbHZlZFVyaSA9IGBodHRwczovLyR7cmVzb2x2ZWRVcml9LmdoZS5jb21gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBub3JtYWxpemVkVXJpID0gcmVzdWx0LnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRjb25zdCBoYXNIdHRwcyA9IG5vcm1hbGl6ZWRVcmkuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKTtcblx0XHRcdGlmICghaGFzSHR0cHMpIHtcblx0XHRcdFx0cmVzb2x2ZWRVcmkgPSBgaHR0cHM6Ly8ke3Jlc3VsdH1gO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoZGVmYXVsdENoYXQucHJvdmlkZXJVcmlTZXR0aW5nLCByZXNvbHZlZFVyaSwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gU2V0dXAgVmlldyBXZWxjb21lXG5cbmNsYXNzIENoYXRTZXR1cFdlbGNvbWVDb250ZW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cmVhZG9ubHkgZWxlbWVudCA9ICQoJy5jaGF0LXNldHVwLXZpZXcnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRyb2xsZXI6IENoYXRTZXR1cENvbnRyb2xsZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0OiBDaGF0RW50aXRsZW1lbnRDb250ZXh0LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IG1hcmtkb3duID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNYXJrZG93blJlbmRlcmVyLCB7fSk7XG5cblx0XHQvLyBIZWFkZXJcblx0XHR7XG5cdFx0XHRjb25zdCBoZWFkZXIgPSBsb2NhbGl6ZSh7IGtleTogJ2hlYWRlcicsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltDb3BpbG90XSh7MH0pXCJ9J10gfSwgXCJbQ29waWxvdF0oezB9KSBpcyB5b3VyIEFJIHBhaXIgcHJvZ3JhbW1lci5cIiwgdGhpcy5jb250ZXh0LnN0YXRlLmluc3RhbGxlZCA/IGBjb21tYW5kOiR7ZGVmYXVsdENoYXQud2Fsa3Rocm91Z2hDb21tYW5kfWAgOiBkZWZhdWx0Q2hhdC5kb2N1bWVudGF0aW9uVXJsKTtcblx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCgkKCdwJywgdW5kZWZpbmVkLCB0aGlzLl9yZWdpc3RlcihtYXJrZG93bi5yZW5kZXIobmV3IE1hcmtkb3duU3RyaW5nKGhlYWRlciwgeyBpc1RydXN0ZWQ6IHRydWUgfSkpKS5lbGVtZW50KSk7XG5cblx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZChcblx0XHRcdFx0JCgnZGl2LmNoYXQtZmVhdHVyZXMtY29udGFpbmVyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ2RpdicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdCQoJ2Rpdi5jaGF0LWZlYXR1cmUtY29udGFpbmVyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRyZW5kZXJJY29uKENvZGljb24uY29kZSksXG5cdFx0XHRcdFx0XHRcdCQoJ3NwYW4nLCB1bmRlZmluZWQsIGxvY2FsaXplKCdmZWF0dXJlQ2hhdCcsIFwiQ29kZSBmYXN0ZXIgd2l0aCBDb21wbGV0aW9uc1wiKSlcblx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHQkKCdkaXYuY2hhdC1mZWF0dXJlLWNvbnRhaW5lcicsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0cmVuZGVySWNvbihDb2RpY29uLmVkaXRTZXNzaW9uKSxcblx0XHRcdFx0XHRcdFx0JCgnc3BhbicsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2ZlYXR1cmVFZGl0cycsIFwiQnVpbGQgZmVhdHVyZXMgd2l0aCBDb3BpbG90IEVkaXRzXCIpKVxuXHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdCQoJ2Rpdi5jaGF0LWZlYXR1cmUtY29udGFpbmVyJywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRyZW5kZXJJY29uKENvZGljb24uY29tbWVudERpc2N1c3Npb24pLFxuXHRcdFx0XHRcdFx0XHQkKCdzcGFuJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnZmVhdHVyZUV4cGxvcmUnLCBcIkV4cGxvcmUgeW91ciBjb2RlYmFzZSB3aXRoIENoYXRcIikpXG5cdFx0XHRcdFx0XHQpXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIExpbWl0ZWQgU0tVXG5cdFx0Y29uc3QgZnJlZSA9IGxvY2FsaXplKHsga2V5OiAnZnJlZScsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltdKHswfSlcIn0nXSB9LCBcIiQoc3BhcmtsZS1maWxsZWQpIFdlIG5vdyBvZmZlciBbQ29waWxvdCBmb3IgZnJlZV0oezB9KS5cIiwgZGVmYXVsdENoYXQuc2t1c0RvY3VtZW50YXRpb25VcmwpO1xuXHRcdGNvbnN0IGZyZWVDb250YWluZXIgPSB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgncCcsIHVuZGVmaW5lZCwgdGhpcy5fcmVnaXN0ZXIobWFya2Rvd24ucmVuZGVyKG5ldyBNYXJrZG93blN0cmluZyhmcmVlLCB7IGlzVHJ1c3RlZDogdHJ1ZSwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSkpKS5lbGVtZW50KSk7XG5cblx0XHQvLyBTZXR1cCBCdXR0b25cblx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgncCcpKTtcblx0XHRidXR0b25Db250YWluZXIuY2xhc3NMaXN0LmFkZCgnYnV0dG9uLWNvbnRhaW5lcicpO1xuXHRcdGNvbnN0IGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b25XaXRoRHJvcGRvd24oYnV0dG9uQ29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25zOiBbXG5cdFx0XHRcdHRvQWN0aW9uKHsgaWQ6ICdjaGF0U2V0dXAuc2V0dXBXaXRoUHJvdmlkZXInLCBsYWJlbDogbG9jYWxpemUoJ3NldHVwV2l0aFByb3ZpZGVyJywgXCJTaWduIGluIHdpdGggYSB7MH0gQWNjb3VudFwiLCBkZWZhdWx0Q2hhdC5wcm92aWRlck5hbWUpLCBydW46ICgpID0+IHRoaXMuY29udHJvbGxlci5zZXR1cFdpdGhQcm92aWRlcih7IHVzZUVudGVycHJpc2VQcm92aWRlcjogZmFsc2UgfSkgfSksXG5cdFx0XHRcdHRvQWN0aW9uKHsgaWQ6ICdjaGF0U2V0dXAuc2V0dXBXaXRoRW50ZXJwcmlzZVByb3ZpZGVyJywgbGFiZWw6IGxvY2FsaXplKCdzZXR1cFdpdGhFbnRlcnByaXNlUHJvdmlkZXInLCBcIlNpZ24gaW4gd2l0aCBhIHswfSBBY2NvdW50XCIsIGRlZmF1bHRDaGF0LmVudGVycHJpc2VQcm92aWRlck5hbWUpLCBydW46ICgpID0+IHRoaXMuY29udHJvbGxlci5zZXR1cFdpdGhQcm92aWRlcih7IHVzZUVudGVycHJpc2VQcm92aWRlcjogdHJ1ZSB9KSB9KVxuXHRcdFx0XSxcblx0XHRcdGFkZFByaW1hcnlBY3Rpb25Ub0Ryb3Bkb3duOiBmYWxzZSxcblx0XHRcdGNvbnRleHRNZW51UHJvdmlkZXI6IHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0c3VwcG9ydEljb25zOiB0cnVlLFxuXHRcdFx0Li4uZGVmYXVsdEJ1dHRvblN0eWxlc1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLmNvbnRyb2xsZXIuc2V0dXAoKSkpO1xuXG5cdFx0Ly8gVGVybXNcblx0XHRjb25zdCB0ZXJtcyA9IGxvY2FsaXplKHsga2V5OiAndGVybXMnLCBjb21tZW50OiBbJ3tMb2NrZWQ9XCJbXCJ9JywgJ3tMb2NrZWQ9XCJdKHswfSlcIn0nLCAne0xvY2tlZD1cIl0oezF9KVwifSddIH0sIFwiQnkgY29udGludWluZywgeW91IGFncmVlIHRvIHRoZSBbVGVybXNdKHswfSkgYW5kIFtQcml2YWN5IFBvbGljeV0oezF9KS5cIiwgZGVmYXVsdENoYXQudGVybXNTdGF0ZW1lbnRVcmwsIGRlZmF1bHRDaGF0LnByaXZhY3lTdGF0ZW1lbnRVcmwpO1xuXHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCgkKCdwJywgdW5kZWZpbmVkLCB0aGlzLl9yZWdpc3RlcihtYXJrZG93bi5yZW5kZXIobmV3IE1hcmtkb3duU3RyaW5nKHRlcm1zLCB7IGlzVHJ1c3RlZDogdHJ1ZSB9KSkpLmVsZW1lbnQpKTtcblxuXHRcdC8vIFNLVSBTZXR0aW5nc1xuXHRcdGNvbnN0IHNldHRpbmdzID0gbG9jYWxpemUoeyBrZXk6ICdzZXR0aW5ncycsIGNvbW1lbnQ6IFsne0xvY2tlZD1cIltcIn0nLCAne0xvY2tlZD1cIl0oezB9KVwifScsICd7TG9ja2VkPVwiXSh7MX0pXCJ9J10gfSwgXCJDb3BpbG90IEZyZWUgYW5kIFBybyBtYXkgc2hvdyBbcHVibGljIGNvZGVdKHswfSkgc3VnZ2VzdGlvbnMgYW5kIHdlIG1heSB1c2UgeW91ciBkYXRhIGZvciBwcm9kdWN0IGltcHJvdmVtZW50LiBZb3UgY2FuIGNoYW5nZSB0aGVzZSBbc2V0dGluZ3NdKHsxfSkgYXQgYW55IHRpbWUuXCIsIGRlZmF1bHRDaGF0LnB1YmxpY0NvZGVNYXRjaGVzVXJsLCBkZWZhdWx0Q2hhdC5tYW5hZ2VTZXR0aW5nc1VybCk7XG5cdFx0Y29uc3Qgc2V0dGluZ3NDb250YWluZXIgPSB0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgncCcsIHVuZGVmaW5lZCwgdGhpcy5fcmVnaXN0ZXIobWFya2Rvd24ucmVuZGVyKG5ldyBNYXJrZG93blN0cmluZyhzZXR0aW5ncywgeyBpc1RydXN0ZWQ6IHRydWUgfSkpKS5lbGVtZW50KSk7XG5cblx0XHQvLyBVcGRhdGUgYmFzZWQgb24gbW9kZWwgc3RhdGVcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5jb250cm9sbGVyLm9uRGlkQ2hhbmdlLCAoKSA9PiB0aGlzLnVwZGF0ZShmcmVlQ29udGFpbmVyLCBzZXR0aW5nc0NvbnRhaW5lciwgYnV0dG9uKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGUoZnJlZUNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHNldHRpbmdzQ29udGFpbmVyOiBIVE1MRWxlbWVudCwgYnV0dG9uOiBCdXR0b25XaXRoRHJvcGRvd24pOiB2b2lkIHtcblx0XHRjb25zdCBzaG93U2V0dGluZ3MgPSB0aGlzLnRlbGVtZXRyeVNlcnZpY2UudGVsZW1ldHJ5TGV2ZWwgIT09IFRlbGVtZXRyeUxldmVsLk5PTkU7XG5cdFx0bGV0IHNob3dGcmVlOiBib29sZWFuO1xuXHRcdGxldCBidXR0b25MYWJlbDogc3RyaW5nO1xuXG5cdFx0c3dpdGNoICh0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQpIHtcblx0XHRcdGNhc2UgQ2hhdEVudGl0bGVtZW50LlVua25vd246XG5cdFx0XHRcdHNob3dGcmVlID0gdHJ1ZTtcblx0XHRcdFx0YnV0dG9uTGFiZWwgPSB0aGlzLmNvbnRleHQuc3RhdGUucmVnaXN0ZXJlZCA/IGxvY2FsaXplKCdzaWduVXAnLCBcIlNpZ24gaW4gdG8gdXNlIENvcGlsb3RcIikgOiBsb2NhbGl6ZSgnc2lnblVwRnJlZScsIFwiU2lnbiBpbiB0byB1c2UgQ29waWxvdCBmb3IgZnJlZVwiKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENoYXRFbnRpdGxlbWVudC5VbnJlc29sdmVkOlxuXHRcdFx0XHRzaG93RnJlZSA9IHRydWU7XG5cdFx0XHRcdGJ1dHRvbkxhYmVsID0gdGhpcy5jb250ZXh0LnN0YXRlLnJlZ2lzdGVyZWQgPyBsb2NhbGl6ZSgnc3RhcnRVcCcsIFwiVXNlIENvcGlsb3RcIikgOiBsb2NhbGl6ZSgnc3RhcnRVcExpbWl0ZWQnLCBcIlVzZSBDb3BpbG90IGZvciBmcmVlXCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ2hhdEVudGl0bGVtZW50LkF2YWlsYWJsZTpcblx0XHRcdGNhc2UgQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQ6XG5cdFx0XHRcdHNob3dGcmVlID0gdHJ1ZTtcblx0XHRcdFx0YnV0dG9uTGFiZWwgPSBsb2NhbGl6ZSgnc3RhcnRVcExpbWl0ZWQnLCBcIlVzZSBDb3BpbG90IGZvciBmcmVlXCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ2hhdEVudGl0bGVtZW50LlBybzpcblx0XHRcdGNhc2UgQ2hhdEVudGl0bGVtZW50LlVuYXZhaWxhYmxlOlxuXHRcdFx0XHRzaG93RnJlZSA9IGZhbHNlO1xuXHRcdFx0XHRidXR0b25MYWJlbCA9IGxvY2FsaXplKCdzdGFydFVwJywgXCJVc2UgQ29waWxvdFwiKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0c3dpdGNoICh0aGlzLmNvbnRyb2xsZXIuc3RlcCkge1xuXHRcdFx0Y2FzZSBDaGF0U2V0dXBTdGVwLlNpZ25pbmdJbjpcblx0XHRcdFx0YnV0dG9uTGFiZWwgPSBsb2NhbGl6ZSgnc2V0dXBDaGF0U2lnbkluJywgXCIkKGxvYWRpbmd+c3BpbikgU2lnbmluZyBpbiB0byB7MH0uLi5cIiwgQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMucHJvdmlkZXJJZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PT0gZGVmYXVsdENoYXQuZW50ZXJwcmlzZVByb3ZpZGVySWQgPyBkZWZhdWx0Q2hhdC5lbnRlcnByaXNlUHJvdmlkZXJOYW1lIDogZGVmYXVsdENoYXQucHJvdmlkZXJOYW1lKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENoYXRTZXR1cFN0ZXAuSW5zdGFsbGluZzpcblx0XHRcdFx0YnV0dG9uTGFiZWwgPSBsb2NhbGl6ZSgnc2V0dXBDaGF0SW5zdGFsbGluZycsIFwiJChsb2FkaW5nfnNwaW4pIEdldHRpbmcgQ29waWxvdCBSZWFkeS4uLlwiKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0c2V0VmlzaWJpbGl0eShzaG93RnJlZSwgZnJlZUNvbnRhaW5lcik7XG5cdFx0c2V0VmlzaWJpbGl0eShzaG93U2V0dGluZ3MsIHNldHRpbmdzQ29udGFpbmVyKTtcblxuXHRcdGJ1dHRvbi5sYWJlbCA9IGJ1dHRvbkxhYmVsO1xuXHRcdGJ1dHRvbi5lbmFibGVkID0gdGhpcy5jb250cm9sbGVyLnN0ZXAgPT09IENoYXRTZXR1cFN0ZXAuSW5pdGlhbDtcblx0fVxufVxuXG4vLyNlbmRyZWdpb25cblxuZnVuY3Rpb24gcmVmcmVzaFRva2Vucyhjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlKTogdm9pZCB7XG5cdC8vIHVnbHksIGJ1dCB3ZSBuZWVkIHRvIHNpZ25hbCB0byB0aGUgZXh0ZW5zaW9uIHRoYXQgZW50aXRsZW1lbnRzIGNoYW5nZWRcblx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZGVmYXVsdENoYXQuY29tcGxldGlvbnNSZWZyZXNoVG9rZW5Db21tYW5kKTtcblx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZGVmYXVsdENoYXQuY2hhdFJlZnJlc2hUb2tlbkNvbW1hbmQpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxHQUFHLGtCQUFrQixxQkFBcUI7QUFDbkQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBcUY7QUFDOUYsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVk7QUFDckIsU0FBUyxvQkFBb0IsWUFBWSxpQkFBOEIsaUJBQWlCLHlCQUF5QjtBQUNqSCxPQUFPLGNBQWM7QUFDckIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUJBQXFCLDZCQUE2QjtBQUMzRCxTQUFTLGNBQWMsK0JBQXVEO0FBQzlFLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMs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ZUFBZSxtQkFBbUIsTUFBTSxDQUFDLENBQUM7QUFBQSxFQUMvSDtBQUFBLEVBRVEsT0FBTyxlQUE0QixtQkFBZ0MsUUFBa0M7QUFDNUcsVUFBTSxlQUFlLEtBQUssaUJBQWlCLG1CQUFtQixlQUFlO0FBQzdFLFFBQUk7QUFDSixRQUFJO0FBRUosWUFBUSxLQUFLLFFBQVEsTUFBTSxhQUFhO0FBQUEsTUFDdkMsS0FBSyxnQkFBZ0I7QUFDcEIsbUJBQVc7QUFDWCxzQkFBYyxLQUFLLFFBQVEsTUFBTSxhQUFhLFNBQVMsVUFBVSx3QkFBd0IsSUFBSSxTQUFTLGNBQWMsaUNBQWlDO0FBQ3JKO0FBQUEsTUFDRCxLQUFLLGdCQUFnQjtBQUNwQixtQkFBVztBQUNYLHNCQUFjLEtBQUssUUFBUSxNQUFNLGFBQWEsU0FBUyxXQUFXLGFBQWEsSUFBSSxTQUFTLGtCQUFrQixzQkFBc0I7QUFDcEk7QUFBQSxNQUNELEtBQUssZ0JBQWdCO0FBQUEsTUFDckIsS0FBSyxnQkFBZ0I7QUFDcEIsbUJBQVc7QUFDWCxzQkFBYyxTQUFTLGtCQUFrQixzQkFBc0I7QUFDL0Q7QUFBQSxNQUNELEtBQUssZ0JBQWdCO0FBQUEsTUFDckIsS0FBSyxnQkFBZ0I7QUFDcEIsbUJBQVc7QUFDWCxzQkFBYyxTQUFTLFdBQVcsYUFBYTtBQUMvQztBQUFBLElBQ0Y7QUFFQSxZQUFRLEtBQUssV0FBVyxNQUFNO0FBQUEsTUFDN0IsS0FBSztBQUNKLHNCQUFjLFNBQVMsbUJBQW1CLHdDQUF3Qyx3QkFBd0IsV0FBVyxLQUFLLG9CQUFvQixNQUFNLFlBQVksdUJBQXVCLFlBQVkseUJBQXlCLFlBQVksWUFBWTtBQUNwUDtBQUFBLE1BQ0QsS0FBSztBQUNKLHNCQUFjLFNBQVMsdUJBQXVCLDBDQUEwQztBQUN4RjtBQUFBLElBQ0Y7QUFFQSxrQkFBYyxVQUFVLGFBQWE7QUFDckMsa0JBQWMsY0FBYyxpQkFBaUI7QUFFN0MsV0FBTyxRQUFRO0FBQ2YsV0FBTyxVQUFVLEtBQUssV0FBVyxTQUFTO0FBQUEsRUFDM0M7QUFDRDtBQXJITSwwQkFBTjtBQUFBLEVBT0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZHO0FBeUhOLFNBQVMsY0FBYyxnQkFBdUM7QUFFN0QsaUJBQWUsZUFBZSxZQUFZLDhCQUE4QjtBQUN4RSxpQkFBZSxlQUFlLFlBQVksdUJBQXVCO0FBQ2xFOyIsCiAgIm5hbWVzIjogWyJkZWZhdWx0QWdlbnQiLCAiQ2hhdFNldHVwU3RyYXRlZ3kiLCAiQ2hhdFNldHVwU3RlcCJdCn0K
