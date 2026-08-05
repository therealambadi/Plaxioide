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
import { timeout } from "../../../../base/common/async.js";
import { Event } from "../../../../base/common/event.js";
import { MarkdownString, isMarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { registerEditorFeature } from "../../../../editor/common/editorFeatures.js";
import * as nls from "../../../../nls.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import product from "../../../../platform/product/common/product.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { PromptsConfig } from "../../../../platform/prompts/common/config.js";
import { DEFAULT_SOURCE_FOLDER as PROMPT_FILES_DEFAULT_SOURCE_FOLDER, PROMPT_FILE_EXTENSION } from "../../../../platform/prompts/common/constants.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { Extensions } from "../../../common/configuration.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { mcpSchemaId } from "../../../services/configuration/common/configuration.js";
import { IEditorResolverService, RegisteredEditorPriority } from "../../../services/editor/common/editorResolverService.js";
import { allDiscoverySources, discoverySourceLabel, mcpConfigurationSection, mcpDiscoverySection, mcpEnabledSection, mcpSchemaExampleServers } from "../../mcp/common/mcpConfiguration.js";
import { ChatAgentNameService, ChatAgentService, IChatAgentNameService, IChatAgentService } from "../common/chatAgents.js";
import { CodeMapperService, ICodeMapperService } from "../common/chatCodeMapperService.js";
import "../common/chatColors.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { IChatEditingService } from "../common/chatEditingService.js";
import { ChatEntitlement, ChatEntitlementService, IChatEntitlementService } from "../common/chatEntitlementService.js";
import { chatVariableLeader } from "../common/chatParserTypes.js";
import { IChatService } from "../common/chatService.js";
import { ChatService } from "../common/chatServiceImpl.js";
import { ChatSlashCommandService, IChatSlashCommandService } from "../common/chatSlashCommands.js";
import { ChatTransferService, IChatTransferService } from "../common/chatTransferService.js";
import { IChatVariablesService } from "../common/chatVariables.js";
import { ChatWidgetHistoryService, IChatWidgetHistoryService } from "../common/chatWidgetHistoryService.js";
import { ChatAgentLocation, ChatConfiguration, ChatMode } from "../common/constants.js";
import { ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService } from "../common/ignoredFiles.js";
import { ILanguageModelsService, LanguageModelsService } from "../common/languageModels.js";
import { ILanguageModelStatsService, LanguageModelStatsService } from "../common/languageModelStats.js";
import { ILanguageModelToolsService } from "../common/languageModelToolsService.js";
import { DOCUMENTATION_URL } from "../common/promptSyntax/constants.js";
import "../common/promptSyntax/languageFeatures/promptLinkDiagnosticsProvider.js";
import "../common/promptSyntax/languageFeatures/promptLinkProvider.js";
import "../common/promptSyntax/languageFeatures/promptPathAutocompletion.js";
import { PromptsService } from "../common/promptSyntax/service/promptsService.js";
import { IPromptsService } from "../common/promptSyntax/service/types.js";
import { LanguageModelToolsExtensionPointHandler } from "../common/tools/languageModelToolsContribution.js";
import { BuiltinToolsContribution } from "../common/tools/tools.js";
import { IVoiceChatService, VoiceChatService } from "../common/voiceChatService.js";
import { AgentChatAccessibilityHelp, EditsChatAccessibilityHelp, PanelChatAccessibilityHelp, QuickChatAccessibilityHelp } from "./actions/chatAccessibilityHelp.js";
import { CopilotTitleBarMenuRendering, registerChatActions } from "./actions/chatActions.js";
import { ACTION_ID_NEW_CHAT, registerNewChatActions } from "./actions/chatClearActions.js";
import { CodeBlockActionRendering, registerChatCodeBlockActions, registerChatCodeCompareBlockActions } from "./actions/chatCodeblockActions.js";
import { registerChatContextActions } from "./actions/chatContextActions.js";
import { registerChatCopyActions } from "./actions/chatCopyActions.js";
import { registerChatDeveloperActions } from "./actions/chatDeveloperActions.js";
import { ChatSubmitAction, registerChatExecuteActions } from "./actions/chatExecuteActions.js";
import { registerChatFileTreeActions } from "./actions/chatFileTreeActions.js";
import { ChatGettingStartedContribution } from "./actions/chatGettingStarted.js";
import { registerChatExportActions } from "./actions/chatImportExport.js";
import { registerMoveActions } from "./actions/chatMoveActions.js";
import { registerQuickChatActions } from "./actions/chatQuickInputActions.js";
import { registerChatTitleActions } from "./actions/chatTitleActions.js";
import { registerChatToolActions } from "./actions/chatToolActions.js";
import { ChatTransferContribution } from "./actions/chatTransfer.js";
import { IChatAccessibilityService, IChatCodeBlockContextProviderService, IChatWidgetService, IQuickChatService } from "./chat.js";
import { ChatAccessibilityService } from "./chatAccessibilityService.js";
import "./chatAttachmentModel.js";
import { ChatMarkdownAnchorService, IChatMarkdownAnchorService } from "./chatContentParts/chatMarkdownAnchorService.js";
import { ChatInputBoxContentProvider } from "./chatEdinputInputContentProvider.js";
import { ChatEditingEditorAccessibility } from "./chatEditing/chatEditingEditorAccessibility.js";
import { registerChatEditorActions } from "./chatEditing/chatEditingEditorActions.js";
import { ChatEditingEditorContextKeys } from "./chatEditing/chatEditingEditorContextKeys.js";
import { ChatEditingEditorOverlay } from "./chatEditing/chatEditingEditorOverlay.js";
import { ChatEditingService } from "./chatEditing/chatEditingServiceImpl.js";
import { ChatEditingNotebookFileSystemProviderContrib } from "./chatEditing/notebook/chatEditingNotebookFileSystemProvider.js";
import { ChatEditor } from "./chatEditor.js";
import { ChatEditorInput, ChatEditorInputSerializer } from "./chatEditorInput.js";
import { agentSlashCommandToMarkdown, agentToMarkdown } from "./chatMarkdownDecorationsRenderer.js";
import { ChatCompatibilityNotifier, ChatExtensionPointHandler } from "./chatParticipant.contribution.js";
import { ChatPasteProvidersFeature } from "./chatPasteProviders.js";
import { QuickChatService } from "./chatQuick.js";
import { ChatResponseAccessibleView } from "./chatResponseAccessibleView.js";
import { ChatSetupContribution } from "./chatSetup.js";
import { ChatStatusBarEntry } from "./chatStatus.js";
import { ChatVariablesService } from "./chatVariables.js";
import { ChatWidgetService } from "./chatWidget.js";
import { ChatCodeBlockContextProviderService } from "./codeBlockContextProviderService.js";
import { ChatImplicitContextContribution } from "./contrib/chatImplicitContext.js";
import "./contrib/chatInputCompletions.js";
import "./contrib/chatInputEditorContrib.js";
import "./contrib/chatInputEditorHover.js";
import { ChatRelatedFilesContribution } from "./contrib/chatInputRelatedFilesContrib.js";
import { LanguageModelToolsService } from "./languageModelToolsService.js";
import "./promptSyntax/contributions/createPromptCommand/createPromptCommand.js";
import "./promptSyntax/contributions/usePromptCommand.js";
import { ChatViewsWelcomeHandler } from "./viewsWelcome/chatViewsWelcomeHandler.js";
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "chatSidebar",
  title: nls.localize("interactiveSessionConfigurationTitle", "Chat"),
  type: "object",
  properties: {
    "chat.editor.fontSize": {
      type: "number",
      description: nls.localize("interactiveSession.editor.fontSize", "Controls the font size in pixels in chat codeblocks."),
      default: isMacintosh ? 12 : 14
    },
    "chat.editor.fontFamily": {
      type: "string",
      description: nls.localize("interactiveSession.editor.fontFamily", "Controls the font family in chat codeblocks."),
      default: "default"
    },
    "chat.editor.fontWeight": {
      type: "string",
      description: nls.localize("interactiveSession.editor.fontWeight", "Controls the font weight in chat codeblocks."),
      default: "default"
    },
    "chat.editor.wordWrap": {
      type: "string",
      description: nls.localize("interactiveSession.editor.wordWrap", "Controls whether lines should wrap in chat codeblocks."),
      default: "off",
      enum: ["on", "off"]
    },
    "chat.editor.lineHeight": {
      type: "number",
      description: nls.localize("interactiveSession.editor.lineHeight", "Controls the line height in pixels in chat codeblocks. Use 0 to compute the line height from the font size."),
      default: 0
    },
    "chat.commandCenter.enabled": {
      type: "boolean",
      markdownDescription: nls.localize("chat.commandCenter.enabled", "Controls whether the command center shows a menu for actions to control Copilot (requires {0}).", "`#window.commandCenter#`"),
      default: true
    },
    "chat.implicitContext.enabled": {
      type: "object",
      tags: ["experimental"],
      description: nls.localize("chat.implicitContext.enabled.1", "Enables automatically using the active editor as chat context for specified chat locations."),
      additionalProperties: {
        type: "string",
        enum: ["never", "first", "always"],
        description: nls.localize("chat.implicitContext.value", "The value for the implicit context."),
        enumDescriptions: [
          nls.localize("chat.implicitContext.value.never", "Implicit context is never enabled."),
          nls.localize("chat.implicitContext.value.first", "Implicit context is enabled for the first interaction."),
          nls.localize("chat.implicitContext.value.always", "Implicit context is always enabled.")
        ]
      },
      default: {
        "panel": "always",
        "editing-session": "first"
      }
    },
    "chat.editing.autoAcceptDelay": {
      type: "number",
      markdownDescription: nls.localize("chat.editing.autoAcceptDelay", "Delay after which changes made by chat are automatically accepted. Values are in seconds, `0` means disabled and `100` seconds is the maximum."),
      default: 0,
      minimum: 0,
      maximum: 100
    },
    "chat.editing.confirmEditRequestRemoval": {
      type: "boolean",
      scope: ConfigurationScope.APPLICATION,
      markdownDescription: nls.localize("chat.editing.confirmEditRequestRemoval", "Whether to show a confirmation before removing a request and its associated edits."),
      default: true
    },
    "chat.editing.confirmEditRequestRetry": {
      type: "boolean",
      scope: ConfigurationScope.APPLICATION,
      markdownDescription: nls.localize("chat.editing.confirmEditRequestRetry", "Whether to show a confirmation before retrying a request and its associated edits."),
      default: true
    },
    "chat.experimental.detectParticipant.enabled": {
      type: "boolean",
      deprecationMessage: nls.localize("chat.experimental.detectParticipant.enabled.deprecated", "This setting is deprecated. Please use `chat.detectParticipant.enabled` instead."),
      description: nls.localize("chat.experimental.detectParticipant.enabled", "Enables chat participant autodetection for panel chat."),
      default: null
    },
    "chat.detectParticipant.enabled": {
      type: "boolean",
      description: nls.localize("chat.detectParticipant.enabled", "Enables chat participant autodetection for panel chat."),
      default: true
    },
    "chat.renderRelatedFiles": {
      type: "boolean",
      description: nls.localize("chat.renderRelatedFiles", "Controls whether related files should be rendered in the chat input."),
      default: false
    },
    "chat.setupFromDialog": {
      // TODO@bpasero remove this eventually
      type: "boolean",
      description: nls.localize("chat.setupFromChat", "Controls whether Copilot setup starts from a dialog or from the welcome view."),
      default: product.quality !== "stable",
      tags: ["experimental", "onExp"]
    },
    "chat.focusWindowOnConfirmation": {
      type: "boolean",
      description: nls.localize("chat.focusWindowOnConfirmation", "Controls whether the Copilot window should be focused when a confirmation is needed."),
      default: true
    },
    "chat.tools.autoApprove": {
      default: false,
      description: nls.localize("chat.tools.autoApprove", "Controls whether tool use should be automatically approved ('YOLO mode')."),
      type: "boolean",
      tags: ["experimental"],
      policy: {
        name: "ChatToolsAutoApprove",
        minimumVersion: "1.99",
        previewFeature: true,
        defaultValue: false
      }
    },
    [mcpEnabledSection]: {
      type: "boolean",
      description: nls.localize("chat.mcp.enabled", "Enables integration with Model Context Protocol servers to provide additional tools and functionality."),
      default: true,
      tags: ["preview"],
      policy: {
        name: "ChatMCP",
        minimumVersion: "1.99",
        previewFeature: true,
        defaultValue: false
      }
    },
    [mcpConfigurationSection]: {
      type: "object",
      default: {
        inputs: [],
        servers: mcpSchemaExampleServers
      },
      description: nls.localize("workspaceConfig.mcp.description", "Model Context Protocol server configurations"),
      $ref: mcpSchemaId
    },
    [ChatConfiguration.UnifiedChatView]: {
      type: "boolean",
      description: nls.localize("chat.unifiedChatView", "Enables the unified view with Ask, Edit, and Agent modes in one view."),
      default: true,
      tags: ["preview"]
    },
    [ChatConfiguration.UseFileStorage]: {
      type: "boolean",
      description: nls.localize("chat.useFileStorage", "Enables storing chat sessions on disk instead of in the storage service. Enabling this does a one-time per-workspace migration of existing sessions to the new format."),
      default: true,
      tags: ["experimental"]
    },
    [ChatConfiguration.Edits2Enabled]: {
      type: "boolean",
      description: nls.localize("chat.edits2Enabled", "Enable the new Edits mode that is based on tool-calling. When this is enabled, models that don't support tool-calling are unavailable for Edits mode."),
      default: true,
      tags: ["onExp"]
    },
    [ChatConfiguration.ExtensionToolsEnabled]: {
      type: "boolean",
      description: nls.localize("chat.extensionToolsEnabled", "Enable using tools contributed by third-party extensions in Copilot Chat agent mode."),
      default: true,
      policy: {
        name: "ChatAgentExtensionTools",
        minimumVersion: "1.99",
        description: nls.localize("chat.extensionToolsPolicy", "Enable using tools contributed by third-party extensions in Copilot Chat agent mode."),
        previewFeature: true,
        defaultValue: false
      }
    },
    [mcpDiscoverySection]: {
      oneOf: [
        { type: "boolean" },
        {
          type: "object",
          default: Object.fromEntries(allDiscoverySources.map((k) => [k, true])),
          properties: Object.fromEntries(allDiscoverySources.map((k) => [
            k,
            { type: "boolean", description: nls.localize("mcp.discovery.source", "Enables discovery of {0} servers", discoverySourceLabel[k]) }
          ]))
        }
      ],
      default: true,
      markdownDescription: nls.localize("mpc.discovery.enabled", "Configures discovery of Model Context Protocol servers on the machine. It may be set to `true` or `false` to disable or enable all sources, and an mapping sources you wish to enable.")
    },
    [PromptsConfig.KEY]: {
      type: "boolean",
      title: nls.localize(
        "chat.reusablePrompts.config.enabled.title",
        "Prompt Files"
      ),
      markdownDescription: nls.localize(
        "chat.reusablePrompts.config.enabled.description",
        "Enable reusable prompt files (`*{0}`) in Chat, Edits, and Inline Chat sessions. [Learn More]({1}).",
        PROMPT_FILE_EXTENSION,
        DOCUMENTATION_URL
      ),
      default: true,
      restricted: true,
      disallowConfigurationDefault: true,
      tags: ["experimental", "prompts", "reusable prompts", "prompt snippets", "instructions"],
      policy: {
        name: "ChatPromptFiles",
        minimumVersion: "1.99",
        description: nls.localize("chat.promptFiles.policy", "Enables reusable prompt files in Chat, Edits, and Inline Chat sessions."),
        previewFeature: true,
        defaultValue: false
      }
    },
    [PromptsConfig.LOCATIONS_KEY]: {
      type: "object",
      title: nls.localize(
        "chat.reusablePrompts.config.locations.title",
        "Prompt File Locations"
      ),
      markdownDescription: nls.localize(
        "chat.reusablePrompts.config.locations.description",
        "Specify location(s) of reusable prompt files (`*{0}`) that can be attached in Chat, Edits, and Inline Chat sessions. [Learn More]({1}).\n\nRelative paths are resolved from the root folder(s) of your workspace.",
        PROMPT_FILE_EXTENSION,
        DOCUMENTATION_URL
      ),
      default: {
        [PROMPT_FILES_DEFAULT_SOURCE_FOLDER]: true
      },
      additionalProperties: { type: "boolean" },
      unevaluatedProperties: { type: "boolean" },
      restricted: true,
      tags: ["experimental", "prompts", "reusable prompts", "prompt snippets", "instructions"],
      examples: [
        {
          [PROMPT_FILES_DEFAULT_SOURCE_FOLDER]: true
        },
        {
          [PROMPT_FILES_DEFAULT_SOURCE_FOLDER]: true,
          "/Users/vscode/repos/prompts": true
        }
      ]
    }
  }
});
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    ChatEditor,
    ChatEditorInput.EditorID,
    nls.localize("chat", "Chat")
  ),
  [
    new SyncDescriptor(ChatEditorInput)
  ]
);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([
  {
    key: "chat.experimental.detectParticipant.enabled",
    migrateFn: (value, _accessor) => [
      ["chat.experimental.detectParticipant.enabled", { value: void 0 }],
      ["chat.detectParticipant.enabled", { value: value !== false }]
    ]
  }
]);
let ChatResolverContribution = class extends Disposable {
  constructor(editorResolverService, instantiationService) {
    super();
    this._register(editorResolverService.registerEditor(
      `${Schemas.vscodeChatSesssion}:**/**`,
      {
        id: ChatEditorInput.EditorID,
        label: nls.localize("chat", "Chat"),
        priority: RegisteredEditorPriority.builtin
      },
      {
        singlePerResource: true,
        canSupportResource: (resource) => resource.scheme === Schemas.vscodeChatSesssion
      },
      {
        createEditorInput: ({ resource, options }) => {
          return { editor: instantiationService.createInstance(ChatEditorInput, resource, options), options };
        }
      }
    ));
  }
};
ChatResolverContribution.ID = "workbench.contrib.chatResolver";
ChatResolverContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], ChatResolverContribution);
let ChatAgentSettingContribution = class extends Disposable {
  constructor(experimentService, productService, contextKeyService, entitlementService) {
    super();
    this.experimentService = experimentService;
    this.productService = productService;
    this.entitlementService = entitlementService;
    if (this.productService.quality !== "stable") {
      this.registerEnablementSetting();
    }
    const expDisabledKey = ChatContextKeys.Editing.agentModeDisallowed.bindTo(contextKeyService);
    experimentService.getTreatment("chatAgentEnabled").then((enabled) => {
      if (enabled || typeof enabled !== "boolean") {
        this.registerEnablementSetting();
        expDisabledKey.set(false);
      } else {
        this.deregisterSetting();
        expDisabledKey.set(true);
      }
    });
    this.registerMaxRequestsSetting();
  }
  registerEnablementSetting() {
    if (this.registeredNode) {
      return;
    }
    this.registeredNode = configurationRegistry.registerConfiguration({
      id: "chatAgent",
      title: nls.localize("interactiveSessionConfigurationTitle", "Chat"),
      type: "object",
      properties: {
        [ChatConfiguration.AgentEnabled]: {
          type: "boolean",
          description: nls.localize("chat.agent.enabled.description", "Enable agent mode for {0}. When this is enabled, a dropdown appears in the view to toggle agent mode.", "Copilot Chat"),
          default: this.productService.quality !== "stable",
          tags: ["onExp"],
          policy: {
            name: "ChatAgentMode",
            minimumVersion: "1.99",
            previewFeature: false,
            defaultValue: false
          }
        }
      }
    });
  }
  deregisterSetting() {
    if (this.registeredNode) {
      configurationRegistry.deregisterConfigurations([this.registeredNode]);
      this.registeredNode = void 0;
    }
  }
  registerMaxRequestsSetting() {
    let lastNode;
    const registerMaxRequestsSetting = () => {
      const treatmentId = this.entitlementService.entitlement === ChatEntitlement.Limited ? "chatAgentMaxRequestsFree" : "chatAgentMaxRequestsPro";
      this.experimentService.getTreatment(treatmentId).then((value) => {
        const defaultValue = value ?? (this.entitlementService.entitlement === ChatEntitlement.Limited ? 5 : 15);
        const node = {
          id: "chatSidebar",
          title: nls.localize("interactiveSessionConfigurationTitle", "Chat"),
          type: "object",
          properties: {
            "chat.agent.maxRequests": {
              type: "number",
              markdownDescription: nls.localize("chat.agent.maxRequests", "The maximum number of requests to allow Copilot Edits to use per-turn in agent mode. When the limit is reached, Copilot will ask the user to confirm that it should keep working. \n\n> **Note**: For users on the Copilot Free plan, note that each agent mode request currently uses one chat request."),
              default: defaultValue
            }
          }
        };
        configurationRegistry.updateConfigurations({ remove: lastNode ? [lastNode] : [], add: [node] });
        lastNode = node;
      });
    };
    this._register(Event.runAndSubscribe(Event.debounce(this.entitlementService.onDidChangeEntitlement, () => {
    }, 1e3), () => registerMaxRequestsSetting()));
  }
};
ChatAgentSettingContribution.ID = "workbench.contrib.chatAgentSetting";
ChatAgentSettingContribution = __decorateClass([
  __decorateParam(0, IWorkbenchAssignmentService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IChatEntitlementService)
], ChatAgentSettingContribution);
AccessibleViewRegistry.register(new ChatResponseAccessibleView());
AccessibleViewRegistry.register(new PanelChatAccessibilityHelp());
AccessibleViewRegistry.register(new QuickChatAccessibilityHelp());
AccessibleViewRegistry.register(new EditsChatAccessibilityHelp());
AccessibleViewRegistry.register(new AgentChatAccessibilityHelp());
registerEditorFeature(ChatInputBoxContentProvider);
let ChatSlashStaticSlashCommandsContribution = class extends Disposable {
  constructor(slashCommandService, commandService, chatAgentService, chatVariablesService, instantiationService) {
    super();
    this._store.add(slashCommandService.registerSlashCommand({
      command: "clear",
      detail: nls.localize("clear", "Start a new chat"),
      sortText: "z2_clear",
      executeImmediately: true,
      locations: [ChatAgentLocation.Panel]
    }, async () => {
      commandService.executeCommand(ACTION_ID_NEW_CHAT);
    }));
    this._store.add(slashCommandService.registerSlashCommand({
      command: "help",
      detail: "",
      sortText: "z1_help",
      executeImmediately: true,
      locations: [ChatAgentLocation.Panel],
      modes: [ChatMode.Ask]
    }, async (prompt, progress) => {
      const defaultAgent = chatAgentService.getDefaultAgent(ChatAgentLocation.Panel);
      const agents = chatAgentService.getAgents();
      if (defaultAgent?.metadata.helpTextPrefix) {
        if (isMarkdownString(defaultAgent.metadata.helpTextPrefix)) {
          progress.report({ content: defaultAgent.metadata.helpTextPrefix, kind: "markdownContent" });
        } else {
          progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPrefix), kind: "markdownContent" });
        }
        progress.report({ content: new MarkdownString("\n\n"), kind: "markdownContent" });
      }
      const agentText = (await Promise.all(agents.filter((a) => a.id !== defaultAgent?.id && !a.isCore).filter((a) => a.locations.includes(ChatAgentLocation.Panel)).map(async (a) => {
        const description = a.description ? `- ${a.description}` : "";
        const agentMarkdown = instantiationService.invokeFunction((accessor) => agentToMarkdown(a, true, accessor));
        const agentLine = `- ${agentMarkdown} ${description}`;
        const commandText = a.slashCommands.map((c) => {
          const description2 = c.description ? `- ${c.description}` : "";
          return `	* ${agentSlashCommandToMarkdown(a, c)} ${description2}`;
        }).join("\n");
        return (agentLine + "\n" + commandText).trim();
      }))).join("\n");
      progress.report({ content: new MarkdownString(agentText, { isTrusted: { enabledCommands: [ChatSubmitAction.ID] } }), kind: "markdownContent" });
      if (defaultAgent?.metadata.helpTextVariablesPrefix) {
        progress.report({ content: new MarkdownString("\n\n"), kind: "markdownContent" });
        if (isMarkdownString(defaultAgent.metadata.helpTextVariablesPrefix)) {
          progress.report({ content: defaultAgent.metadata.helpTextVariablesPrefix, kind: "markdownContent" });
        } else {
          progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextVariablesPrefix), kind: "markdownContent" });
        }
        const variables = [
          { name: "file", description: nls.localize("file", "Choose a file in the workspace") }
        ];
        const variableText = variables.map((v) => `* \`${chatVariableLeader}${v.name}\` - ${v.description}`).join("\n");
        progress.report({ content: new MarkdownString("\n" + variableText), kind: "markdownContent" });
      }
      if (defaultAgent?.metadata.helpTextPostfix) {
        progress.report({ content: new MarkdownString("\n\n"), kind: "markdownContent" });
        if (isMarkdownString(defaultAgent.metadata.helpTextPostfix)) {
          progress.report({ content: defaultAgent.metadata.helpTextPostfix, kind: "markdownContent" });
        } else {
          progress.report({ content: new MarkdownString(defaultAgent.metadata.helpTextPostfix), kind: "markdownContent" });
        }
      }
      await timeout(200);
    }));
  }
};
ChatSlashStaticSlashCommandsContribution.ID = "workbench.contrib.chatSlashStaticSlashCommands";
ChatSlashStaticSlashCommandsContribution = __decorateClass([
  __decorateParam(0, IChatSlashCommandService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IChatVariablesService),
  __decorateParam(4, IInstantiationService)
], ChatSlashStaticSlashCommandsContribution);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(ChatEditorInput.TypeID, ChatEditorInputSerializer);
registerWorkbenchContribution2(ChatResolverContribution.ID, ChatResolverContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatSlashStaticSlashCommandsContribution.ID, ChatSlashStaticSlashCommandsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatExtensionPointHandler.ID, ChatExtensionPointHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(LanguageModelToolsExtensionPointHandler.ID, LanguageModelToolsExtensionPointHandler, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatCompatibilityNotifier.ID, ChatCompatibilityNotifier, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(CopilotTitleBarMenuRendering.ID, CopilotTitleBarMenuRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(CodeBlockActionRendering.ID, CodeBlockActionRendering, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatImplicitContextContribution.ID, ChatImplicitContextContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatRelatedFilesContribution.ID, ChatRelatedFilesContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatViewsWelcomeHandler.ID, ChatViewsWelcomeHandler, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(ChatGettingStartedContribution.ID, ChatGettingStartedContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatSetupContribution.ID, ChatSetupContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatStatusBarEntry.ID, ChatStatusBarEntry, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(BuiltinToolsContribution.ID, BuiltinToolsContribution, WorkbenchPhase.Eventually);
registerWorkbenchContribution2(ChatAgentSettingContribution.ID, ChatAgentSettingContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(ChatEditingEditorAccessibility.ID, ChatEditingEditorAccessibility, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatEditingEditorOverlay.ID, ChatEditingEditorOverlay, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatEditingEditorContextKeys.ID, ChatEditingEditorContextKeys, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(ChatTransferContribution.ID, ChatTransferContribution, WorkbenchPhase.BlockRestore);
registerChatActions();
registerChatCopyActions();
registerChatCodeBlockActions();
registerChatCodeCompareBlockActions();
registerChatFileTreeActions();
registerChatTitleActions();
registerChatExecuteActions();
registerQuickChatActions();
registerChatExportActions();
registerMoveActions();
registerNewChatActions();
registerChatContextActions();
registerChatDeveloperActions();
registerChatEditorActions();
registerChatToolActions();
registerEditorFeature(ChatPasteProvidersFeature);
registerSingleton(IChatService, ChatService, InstantiationType.Delayed);
registerSingleton(IChatWidgetService, ChatWidgetService, InstantiationType.Delayed);
registerSingleton(IQuickChatService, QuickChatService, InstantiationType.Delayed);
registerSingleton(IChatAccessibilityService, ChatAccessibilityService, InstantiationType.Delayed);
registerSingleton(IChatWidgetHistoryService, ChatWidgetHistoryService, InstantiationType.Delayed);
registerSingleton(ILanguageModelsService, LanguageModelsService, InstantiationType.Delayed);
registerSingleton(ILanguageModelStatsService, LanguageModelStatsService, InstantiationType.Delayed);
registerSingleton(IChatSlashCommandService, ChatSlashCommandService, InstantiationType.Delayed);
registerSingleton(IChatAgentService, ChatAgentService, InstantiationType.Delayed);
registerSingleton(IChatAgentNameService, ChatAgentNameService, InstantiationType.Delayed);
registerSingleton(IChatVariablesService, ChatVariablesService, InstantiationType.Delayed);
registerSingleton(ILanguageModelToolsService, LanguageModelToolsService, InstantiationType.Delayed);
registerSingleton(IVoiceChatService, VoiceChatService, InstantiationType.Delayed);
registerSingleton(IChatCodeBlockContextProviderService, ChatCodeBlockContextProviderService, InstantiationType.Delayed);
registerSingleton(ICodeMapperService, CodeMapperService, InstantiationType.Delayed);
registerSingleton(IChatEditingService, ChatEditingService, InstantiationType.Delayed);
registerSingleton(IChatMarkdownAnchorService, ChatMarkdownAnchorService, InstantiationType.Delayed);
registerSingleton(ILanguageModelIgnoredFilesService, LanguageModelIgnoredFilesService, InstantiationType.Delayed);
registerSingleton(IChatEntitlementService, ChatEntitlementService, InstantiationType.Delayed);
registerSingleton(IPromptsService, PromptsService, InstantiationType.Delayed);
registerSingleton(IChatTransferService, ChatTransferService, InstantiationType.Delayed);
registerWorkbenchContribution2(ChatEditingNotebookFileSystemProviderContrib.ID, ChatEditingNotebookFileSystemProviderContrib, WorkbenchPhase.BlockStartup);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdC5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZywgaXNNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckVkaXRvckZlYXR1cmUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckZlYXR1cmVzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJsZVZpZXdSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUsIElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUHJvbXB0c0NvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb21wdHMvY29tbW9uL2NvbmZpZy5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX1NPVVJDRV9GT0xERVIgYXMgUFJPTVBUX0ZJTEVTX0RFRkFVTFRfU09VUkNFX0ZPTERFUiwgUFJPTVBUX0ZJTEVfRVhURU5TSU9OIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvbXB0cy9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25NaWdyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBtY3BTY2hlbWFJZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvclJlc29sdmVyU2VydmljZSwgUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JSZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYWxsRGlzY292ZXJ5U291cmNlcywgZGlzY292ZXJ5U291cmNlTGFiZWwsIG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uLCBtY3BEaXNjb3ZlcnlTZWN0aW9uLCBtY3BFbmFibGVkU2VjdGlvbiwgbWNwU2NoZW1hRXhhbXBsZVNlcnZlcnMgfSBmcm9tICcuLi8uLi9tY3AvY29tbW9uL21jcENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TmFtZVNlcnZpY2UsIENoYXRBZ2VudFNlcnZpY2UsIElDaGF0QWdlbnROYW1lU2VydmljZSwgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDb2RlTWFwcGVyU2VydmljZSwgSUNvZGVNYXBwZXJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRDb2RlTWFwcGVyU2VydmljZS5qcyc7XG5pbXBvcnQgJy4uL2NvbW1vbi9jaGF0Q29sb3JzLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEVudGl0bGVtZW50LCBDaGF0RW50aXRsZW1lbnRTZXJ2aWNlLCBJQ2hhdEVudGl0bGVtZW50U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNoYXRWYXJpYWJsZUxlYWRlciB9IGZyb20gJy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBDaGF0U2xhc2hDb21tYW5kU2VydmljZSwgSUNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRTbGFzaENvbW1hbmRzLmpzJztcbmltcG9ydCB7IENoYXRUcmFuc2ZlclNlcnZpY2UsIElDaGF0VHJhbnNmZXJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRUcmFuc2ZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRWYXJpYWJsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlLCBJQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRXaWRnZXRIaXN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdENvbmZpZ3VyYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbElnbm9yZWRGaWxlc1NlcnZpY2UsIExhbmd1YWdlTW9kZWxJZ25vcmVkRmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2lnbm9yZWRGaWxlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBMYW5ndWFnZU1vZGVsc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxTdGF0c1NlcnZpY2UsIExhbmd1YWdlTW9kZWxTdGF0c1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFN0YXRzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRE9DVU1FTlRBVElPTl9VUkwgfSBmcm9tICcuLi9jb21tb24vcHJvbXB0U3ludGF4L2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgJy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvbGFuZ3VhZ2VGZWF0dXJlcy9wcm9tcHRMaW5rRGlhZ25vc3RpY3NQcm92aWRlci5qcyc7XG5pbXBvcnQgJy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvbGFuZ3VhZ2VGZWF0dXJlcy9wcm9tcHRMaW5rUHJvdmlkZXIuanMnO1xuaW1wb3J0ICcuLi9jb21tb24vcHJvbXB0U3ludGF4L2xhbmd1YWdlRmVhdHVyZXMvcHJvbXB0UGF0aEF1dG9jb21wbGV0aW9uLmpzJztcbmltcG9ydCB7IFByb21wdHNTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3Byb21wdFN5bnRheC9zZXJ2aWNlL3Byb21wdHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9tcHRzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvc2VydmljZS90eXBlcy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZU1vZGVsVG9vbHNFeHRlbnNpb25Qb2ludEhhbmRsZXIgfSBmcm9tICcuLi9jb21tb24vdG9vbHMvbGFuZ3VhZ2VNb2RlbFRvb2xzQ29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IEJ1aWx0aW5Ub29sc0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uL2NvbW1vbi90b29scy90b29scy5qcyc7XG5pbXBvcnQgeyBJVm9pY2VDaGF0U2VydmljZSwgVm9pY2VDaGF0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92b2ljZUNoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEFnZW50Q2hhdEFjY2Vzc2liaWxpdHlIZWxwLCBFZGl0c0NoYXRBY2Nlc3NpYmlsaXR5SGVscCwgUGFuZWxDaGF0QWNjZXNzaWJpbGl0eUhlbHAsIFF1aWNrQ2hhdEFjY2Vzc2liaWxpdHlIZWxwIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRBY2Nlc3NpYmlsaXR5SGVscC5qcyc7XG5pbXBvcnQgeyBDb3BpbG90VGl0bGVCYXJNZW51UmVuZGVyaW5nLCByZWdpc3RlckNoYXRBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IEFDVElPTl9JRF9ORVdfQ0hBVCwgcmVnaXN0ZXJOZXdDaGF0QWN0aW9ucyB9IGZyb20gJy4vYWN0aW9ucy9jaGF0Q2xlYXJBY3Rpb25zLmpzJztcbmltcG9ydCB7IENvZGVCbG9ja0FjdGlvblJlbmRlcmluZywgcmVnaXN0ZXJDaGF0Q29kZUJsb2NrQWN0aW9ucywgcmVnaXN0ZXJDaGF0Q29kZUNvbXBhcmVCbG9ja0FjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvY2hhdENvZGVibG9ja0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJDaGF0Q29udGV4dEFjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvY2hhdENvbnRleHRBY3Rpb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ2hhdENvcHlBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRDb3B5QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNoYXREZXZlbG9wZXJBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXREZXZlbG9wZXJBY3Rpb25zLmpzJztcbmltcG9ydCB7IENoYXRTdWJtaXRBY3Rpb24sIHJlZ2lzdGVyQ2hhdEV4ZWN1dGVBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRFeGVjdXRlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNoYXRGaWxlVHJlZUFjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvY2hhdEZpbGVUcmVlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0R2V0dGluZ1N0YXJ0ZWRDb250cmlidXRpb24gfSBmcm9tICcuL2FjdGlvbnMvY2hhdEdldHRpbmdTdGFydGVkLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ2hhdEV4cG9ydEFjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvY2hhdEltcG9ydEV4cG9ydC5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck1vdmVBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRNb3ZlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclF1aWNrQ2hhdEFjdGlvbnMgfSBmcm9tICcuL2FjdGlvbnMvY2hhdFF1aWNrSW5wdXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ2hhdFRpdGxlQWN0aW9ucyB9IGZyb20gJy4vYWN0aW9ucy9jaGF0VGl0bGVBY3Rpb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ2hhdFRvb2xBY3Rpb25zIH0gZnJvbSAnLi9hY3Rpb25zL2NoYXRUb29sQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0VHJhbnNmZXJDb250cmlidXRpb24gfSBmcm9tICcuL2FjdGlvbnMvY2hhdFRyYW5zZmVyLmpzJztcbmltcG9ydCB7IElDaGF0QWNjZXNzaWJpbGl0eVNlcnZpY2UsIElDaGF0Q29kZUJsb2NrQ29udGV4dFByb3ZpZGVyU2VydmljZSwgSUNoYXRXaWRnZXRTZXJ2aWNlLCBJUXVpY2tDaGF0U2VydmljZSB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0QWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuL2NoYXRBY2Nlc3NpYmlsaXR5U2VydmljZS5qcyc7XG5pbXBvcnQgJy4vY2hhdEF0dGFjaG1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0TWFya2Rvd25BbmNob3JTZXJ2aWNlLCBJQ2hhdE1hcmtkb3duQW5jaG9yU2VydmljZSB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0TWFya2Rvd25BbmNob3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRJbnB1dEJveENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4vY2hhdEVkaW5wdXRJbnB1dENvbnRlbnRQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ0VkaXRvckFjY2Vzc2liaWxpdHkgfSBmcm9tICcuL2NoYXRFZGl0aW5nL2NoYXRFZGl0aW5nRWRpdG9yQWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNoYXRFZGl0b3JBY3Rpb25zIH0gZnJvbSAnLi9jaGF0RWRpdGluZy9jaGF0RWRpdGluZ0VkaXRvckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4vY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ0VkaXRvck92ZXJsYXkgfSBmcm9tICcuL2NoYXRFZGl0aW5nL2NoYXRFZGl0aW5nRWRpdG9yT3ZlcmxheS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuL2NoYXRFZGl0aW5nL2NoYXRFZGl0aW5nU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRpbmdOb3RlYm9va0ZpbGVTeXN0ZW1Qcm92aWRlckNvbnRyaWIgfSBmcm9tICcuL2NoYXRFZGl0aW5nL25vdGVib29rL2NoYXRFZGl0aW5nTm90ZWJvb2tGaWxlU3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvciwgSUNoYXRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi9jaGF0RWRpdG9yLmpzJztcbmltcG9ydCB7IENoYXRFZGl0b3JJbnB1dCwgQ2hhdEVkaXRvcklucHV0U2VyaWFsaXplciB9IGZyb20gJy4vY2hhdEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IGFnZW50U2xhc2hDb21tYW5kVG9NYXJrZG93biwgYWdlbnRUb01hcmtkb3duIH0gZnJvbSAnLi9jaGF0TWFya2Rvd25EZWNvcmF0aW9uc1JlbmRlcmVyLmpzJztcbmltcG9ydCB7IENoYXRDb21wYXRpYmlsaXR5Tm90aWZpZXIsIENoYXRFeHRlbnNpb25Qb2ludEhhbmRsZXIgfSBmcm9tICcuL2NoYXRQYXJ0aWNpcGFudC5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgQ2hhdFBhc3RlUHJvdmlkZXJzRmVhdHVyZSB9IGZyb20gJy4vY2hhdFBhc3RlUHJvdmlkZXJzLmpzJztcbmltcG9ydCB7IFF1aWNrQ2hhdFNlcnZpY2UgfSBmcm9tICcuL2NoYXRRdWljay5qcyc7XG5pbXBvcnQgeyBDaGF0UmVzcG9uc2VBY2Nlc3NpYmxlVmlldyB9IGZyb20gJy4vY2hhdFJlc3BvbnNlQWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQ2hhdFNldHVwQ29udHJpYnV0aW9uIH0gZnJvbSAnLi9jaGF0U2V0dXAuanMnO1xuaW1wb3J0IHsgQ2hhdFN0YXR1c0JhckVudHJ5IH0gZnJvbSAnLi9jaGF0U3RhdHVzLmpzJztcbmltcG9ydCB7IENoYXRWYXJpYWJsZXNTZXJ2aWNlIH0gZnJvbSAnLi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IENoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IENoYXRDb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlIH0gZnJvbSAnLi9jb2RlQmxvY2tDb250ZXh0UHJvdmlkZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRJbXBsaWNpdENvbnRleHRDb250cmlidXRpb24gfSBmcm9tICcuL2NvbnRyaWIvY2hhdEltcGxpY2l0Q29udGV4dC5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9jaGF0SW5wdXRDb21wbGV0aW9ucy5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9jaGF0SW5wdXRFZGl0b3JDb250cmliLmpzJztcbmltcG9ydCAnLi9jb250cmliL2NoYXRJbnB1dEVkaXRvckhvdmVyLmpzJztcbmltcG9ydCB7IENoYXRSZWxhdGVkRmlsZXNDb250cmlidXRpb24gfSBmcm9tICcuL2NvbnRyaWIvY2hhdElucHV0UmVsYXRlZEZpbGVzQ29udHJpYi5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcbmltcG9ydCAnLi9wcm9tcHRTeW50YXgvY29udHJpYnV0aW9ucy9jcmVhdGVQcm9tcHRDb21tYW5kL2NyZWF0ZVByb21wdENvbW1hbmQuanMnO1xuaW1wb3J0ICcuL3Byb21wdFN5bnRheC9jb250cmlidXRpb25zL3VzZVByb21wdENvbW1hbmQuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdzV2VsY29tZUhhbmRsZXIgfSBmcm9tICcuL3ZpZXdzV2VsY29tZS9jaGF0Vmlld3NXZWxjb21lSGFuZGxlci5qcyc7XG5cbi8vIFJlZ2lzdGVyIGNvbmZpZ3VyYXRpb25cbmNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdGlkOiAnY2hhdFNpZGViYXInLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdpbnRlcmFjdGl2ZVNlc3Npb25Db25maWd1cmF0aW9uVGl0bGUnLCBcIkNoYXRcIiksXG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J2NoYXQuZWRpdG9yLmZvbnRTaXplJzoge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbnRlcmFjdGl2ZVNlc3Npb24uZWRpdG9yLmZvbnRTaXplJywgXCJDb250cm9scyB0aGUgZm9udCBzaXplIGluIHBpeGVscyBpbiBjaGF0IGNvZGVibG9ja3MuXCIpLFxuXHRcdFx0ZGVmYXVsdDogaXNNYWNpbnRvc2ggPyAxMiA6IDE0LFxuXHRcdH0sXG5cdFx0J2NoYXQuZWRpdG9yLmZvbnRGYW1pbHknOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ludGVyYWN0aXZlU2Vzc2lvbi5lZGl0b3IuZm9udEZhbWlseScsIFwiQ29udHJvbHMgdGhlIGZvbnQgZmFtaWx5IGluIGNoYXQgY29kZWJsb2Nrcy5cIiksXG5cdFx0XHRkZWZhdWx0OiAnZGVmYXVsdCdcblx0XHR9LFxuXHRcdCdjaGF0LmVkaXRvci5mb250V2VpZ2h0Jzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdpbnRlcmFjdGl2ZVNlc3Npb24uZWRpdG9yLmZvbnRXZWlnaHQnLCBcIkNvbnRyb2xzIHRoZSBmb250IHdlaWdodCBpbiBjaGF0IGNvZGVibG9ja3MuXCIpLFxuXHRcdFx0ZGVmYXVsdDogJ2RlZmF1bHQnXG5cdFx0fSxcblx0XHQnY2hhdC5lZGl0b3Iud29yZFdyYXAnOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ludGVyYWN0aXZlU2Vzc2lvbi5lZGl0b3Iud29yZFdyYXAnLCBcIkNvbnRyb2xzIHdoZXRoZXIgbGluZXMgc2hvdWxkIHdyYXAgaW4gY2hhdCBjb2RlYmxvY2tzLlwiKSxcblx0XHRcdGRlZmF1bHQ6ICdvZmYnLFxuXHRcdFx0ZW51bTogWydvbicsICdvZmYnXVxuXHRcdH0sXG5cdFx0J2NoYXQuZWRpdG9yLmxpbmVIZWlnaHQnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ludGVyYWN0aXZlU2Vzc2lvbi5lZGl0b3IubGluZUhlaWdodCcsIFwiQ29udHJvbHMgdGhlIGxpbmUgaGVpZ2h0IGluIHBpeGVscyBpbiBjaGF0IGNvZGVibG9ja3MuIFVzZSAwIHRvIGNvbXB1dGUgdGhlIGxpbmUgaGVpZ2h0IGZyb20gdGhlIGZvbnQgc2l6ZS5cIiksXG5cdFx0XHRkZWZhdWx0OiAwXG5cdFx0fSxcblx0XHQnY2hhdC5jb21tYW5kQ2VudGVyLmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuY29tbWFuZENlbnRlci5lbmFibGVkJywgXCJDb250cm9scyB3aGV0aGVyIHRoZSBjb21tYW5kIGNlbnRlciBzaG93cyBhIG1lbnUgZm9yIGFjdGlvbnMgdG8gY29udHJvbCBDb3BpbG90IChyZXF1aXJlcyB7MH0pLlwiLCAnYCN3aW5kb3cuY29tbWFuZENlbnRlciNgJyksXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHQnY2hhdC5pbXBsaWNpdENvbnRleHQuZW5hYmxlZCc6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0dGFnczogWydleHBlcmltZW50YWwnXSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuaW1wbGljaXRDb250ZXh0LmVuYWJsZWQuMScsIFwiRW5hYmxlcyBhdXRvbWF0aWNhbGx5IHVzaW5nIHRoZSBhY3RpdmUgZWRpdG9yIGFzIGNoYXQgY29udGV4dCBmb3Igc3BlY2lmaWVkIGNoYXQgbG9jYXRpb25zLlwiKSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ25ldmVyJywgJ2ZpcnN0JywgJ2Fsd2F5cyddLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LmltcGxpY2l0Q29udGV4dC52YWx1ZScsIFwiVGhlIHZhbHVlIGZvciB0aGUgaW1wbGljaXQgY29udGV4dC5cIiksXG5cdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2NoYXQuaW1wbGljaXRDb250ZXh0LnZhbHVlLm5ldmVyJywgXCJJbXBsaWNpdCBjb250ZXh0IGlzIG5ldmVyIGVuYWJsZWQuXCIpLFxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnY2hhdC5pbXBsaWNpdENvbnRleHQudmFsdWUuZmlyc3QnLCBcIkltcGxpY2l0IGNvbnRleHQgaXMgZW5hYmxlZCBmb3IgdGhlIGZpcnN0IGludGVyYWN0aW9uLlwiKSxcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2NoYXQuaW1wbGljaXRDb250ZXh0LnZhbHVlLmFsd2F5cycsIFwiSW1wbGljaXQgY29udGV4dCBpcyBhbHdheXMgZW5hYmxlZC5cIilcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0J3BhbmVsJzogJ2Fsd2F5cycsXG5cdFx0XHRcdCdlZGl0aW5nLXNlc3Npb24nOiAnZmlyc3QnXG5cdFx0XHR9XG5cdFx0fSxcblx0XHQnY2hhdC5lZGl0aW5nLmF1dG9BY2NlcHREZWxheSc6IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LmVkaXRpbmcuYXV0b0FjY2VwdERlbGF5JywgXCJEZWxheSBhZnRlciB3aGljaCBjaGFuZ2VzIG1hZGUgYnkgY2hhdCBhcmUgYXV0b21hdGljYWxseSBhY2NlcHRlZC4gVmFsdWVzIGFyZSBpbiBzZWNvbmRzLCBgMGAgbWVhbnMgZGlzYWJsZWQgYW5kIGAxMDBgIHNlY29uZHMgaXMgdGhlIG1heGltdW0uXCIpLFxuXHRcdFx0ZGVmYXVsdDogMCxcblx0XHRcdG1pbmltdW06IDAsXG5cdFx0XHRtYXhpbXVtOiAxMDBcblx0XHR9LFxuXHRcdCdjaGF0LmVkaXRpbmcuY29uZmlybUVkaXRSZXF1ZXN0UmVtb3ZhbCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuZWRpdGluZy5jb25maXJtRWRpdFJlcXVlc3RSZW1vdmFsJywgXCJXaGV0aGVyIHRvIHNob3cgYSBjb25maXJtYXRpb24gYmVmb3JlIHJlbW92aW5nIGEgcmVxdWVzdCBhbmQgaXRzIGFzc29jaWF0ZWQgZWRpdHMuXCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHR9LFxuXHRcdCdjaGF0LmVkaXRpbmcuY29uZmlybUVkaXRSZXF1ZXN0UmV0cnknOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LmVkaXRpbmcuY29uZmlybUVkaXRSZXF1ZXN0UmV0cnknLCBcIldoZXRoZXIgdG8gc2hvdyBhIGNvbmZpcm1hdGlvbiBiZWZvcmUgcmV0cnlpbmcgYSByZXF1ZXN0IGFuZCBpdHMgYXNzb2NpYXRlZCBlZGl0cy5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdH0sXG5cdFx0J2NoYXQuZXhwZXJpbWVudGFsLmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY2hhdC5leHBlcmltZW50YWwuZGV0ZWN0UGFydGljaXBhbnQuZW5hYmxlZC5kZXByZWNhdGVkJywgXCJUaGlzIHNldHRpbmcgaXMgZGVwcmVjYXRlZC4gUGxlYXNlIHVzZSBgY2hhdC5kZXRlY3RQYXJ0aWNpcGFudC5lbmFibGVkYCBpbnN0ZWFkLlwiKSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuZXhwZXJpbWVudGFsLmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnLCBcIkVuYWJsZXMgY2hhdCBwYXJ0aWNpcGFudCBhdXRvZGV0ZWN0aW9uIGZvciBwYW5lbCBjaGF0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IG51bGxcblx0XHR9LFxuXHRcdCdjaGF0LmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnLCBcIkVuYWJsZXMgY2hhdCBwYXJ0aWNpcGFudCBhdXRvZGV0ZWN0aW9uIGZvciBwYW5lbCBjaGF0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdjaGF0LnJlbmRlclJlbGF0ZWRGaWxlcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQucmVuZGVyUmVsYXRlZEZpbGVzJywgXCJDb250cm9scyB3aGV0aGVyIHJlbGF0ZWQgZmlsZXMgc2hvdWxkIGJlIHJlbmRlcmVkIGluIHRoZSBjaGF0IGlucHV0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHQnY2hhdC5zZXR1cEZyb21EaWFsb2cnOiB7IC8vIFRPRE9AYnBhc2VybyByZW1vdmUgdGhpcyBldmVudHVhbGx5XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LnNldHVwRnJvbUNoYXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgQ29waWxvdCBzZXR1cCBzdGFydHMgZnJvbSBhIGRpYWxvZyBvciBmcm9tIHRoZSB3ZWxjb21lIHZpZXcuXCIpLFxuXHRcdFx0ZGVmYXVsdDogcHJvZHVjdC5xdWFsaXR5ICE9PSAnc3RhYmxlJyxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJywgJ29uRXhwJ11cblx0XHR9LFxuXHRcdCdjaGF0LmZvY3VzV2luZG93T25Db25maXJtYXRpb24nOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LmZvY3VzV2luZG93T25Db25maXJtYXRpb24nLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIENvcGlsb3Qgd2luZG93IHNob3VsZCBiZSBmb2N1c2VkIHdoZW4gYSBjb25maXJtYXRpb24gaXMgbmVlZGVkLlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0fSxcblx0XHQnY2hhdC50b29scy5hdXRvQXBwcm92ZSc6IHtcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY2hhdC50b29scy5hdXRvQXBwcm92ZScsIFwiQ29udHJvbHMgd2hldGhlciB0b29sIHVzZSBzaG91bGQgYmUgYXV0b21hdGljYWxseSBhcHByb3ZlZCAoJ1lPTE8gbW9kZScpLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0XHRwb2xpY3k6IHtcblx0XHRcdFx0bmFtZTogJ0NoYXRUb29sc0F1dG9BcHByb3ZlJyxcblx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjk5Jyxcblx0XHRcdFx0cHJldmlld0ZlYXR1cmU6IHRydWUsXG5cdFx0XHRcdGRlZmF1bHRWYWx1ZTogZmFsc2Vcblx0XHRcdH1cblx0XHR9LFxuXHRcdFttY3BFbmFibGVkU2VjdGlvbl06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQubWNwLmVuYWJsZWQnLCBcIkVuYWJsZXMgaW50ZWdyYXRpb24gd2l0aCBNb2RlbCBDb250ZXh0IFByb3RvY29sIHNlcnZlcnMgdG8gcHJvdmlkZSBhZGRpdGlvbmFsIHRvb2xzIGFuZCBmdW5jdGlvbmFsaXR5LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHR0YWdzOiBbJ3ByZXZpZXcnXSxcblx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRuYW1lOiAnQ2hhdE1DUCcsXG5cdFx0XHRcdG1pbmltdW1WZXJzaW9uOiAnMS45OScsXG5cdFx0XHRcdHByZXZpZXdGZWF0dXJlOiB0cnVlLFxuXHRcdFx0XHRkZWZhdWx0VmFsdWU6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRbbWNwQ29uZmlndXJhdGlvblNlY3Rpb25dOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0aW5wdXRzOiBbXSxcblx0XHRcdFx0c2VydmVyczogbWNwU2NoZW1hRXhhbXBsZVNlcnZlcnMsXG5cdFx0XHR9LFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlQ29uZmlnLm1jcC5kZXNjcmlwdGlvbicsIFwiTW9kZWwgQ29udGV4dCBQcm90b2NvbCBzZXJ2ZXIgY29uZmlndXJhdGlvbnNcIiksXG5cdFx0XHQkcmVmOiBtY3BTY2hlbWFJZFxuXHRcdH0sXG5cdFx0W0NoYXRDb25maWd1cmF0aW9uLlVuaWZpZWRDaGF0Vmlld106IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQudW5pZmllZENoYXRWaWV3JywgXCJFbmFibGVzIHRoZSB1bmlmaWVkIHZpZXcgd2l0aCBBc2ssIEVkaXQsIGFuZCBBZ2VudCBtb2RlcyBpbiBvbmUgdmlldy5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydwcmV2aWV3J10sXG5cdFx0fSxcblx0XHRbQ2hhdENvbmZpZ3VyYXRpb24uVXNlRmlsZVN0b3JhZ2VdOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjaGF0LnVzZUZpbGVTdG9yYWdlJywgXCJFbmFibGVzIHN0b3JpbmcgY2hhdCBzZXNzaW9ucyBvbiBkaXNrIGluc3RlYWQgb2YgaW4gdGhlIHN0b3JhZ2Ugc2VydmljZS4gRW5hYmxpbmcgdGhpcyBkb2VzIGEgb25lLXRpbWUgcGVyLXdvcmtzcGFjZSBtaWdyYXRpb24gb2YgZXhpc3Rpbmcgc2Vzc2lvbnMgdG8gdGhlIG5ldyBmb3JtYXQuXCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0fSxcblx0XHRbQ2hhdENvbmZpZ3VyYXRpb24uRWRpdHMyRW5hYmxlZF06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuZWRpdHMyRW5hYmxlZCcsIFwiRW5hYmxlIHRoZSBuZXcgRWRpdHMgbW9kZSB0aGF0IGlzIGJhc2VkIG9uIHRvb2wtY2FsbGluZy4gV2hlbiB0aGlzIGlzIGVuYWJsZWQsIG1vZGVscyB0aGF0IGRvbid0IHN1cHBvcnQgdG9vbC1jYWxsaW5nIGFyZSB1bmF2YWlsYWJsZSBmb3IgRWRpdHMgbW9kZS5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydvbkV4cCddLFxuXHRcdH0sXG5cdFx0W0NoYXRDb25maWd1cmF0aW9uLkV4dGVuc2lvblRvb2xzRW5hYmxlZF06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuZXh0ZW5zaW9uVG9vbHNFbmFibGVkJywgXCJFbmFibGUgdXNpbmcgdG9vbHMgY29udHJpYnV0ZWQgYnkgdGhpcmQtcGFydHkgZXh0ZW5zaW9ucyBpbiBDb3BpbG90IENoYXQgYWdlbnQgbW9kZS5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0cG9saWN5OiB7XG5cdFx0XHRcdG5hbWU6ICdDaGF0QWdlbnRFeHRlbnNpb25Ub29scycsXG5cdFx0XHRcdG1pbmltdW1WZXJzaW9uOiAnMS45OScsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuZXh0ZW5zaW9uVG9vbHNQb2xpY3knLCBcIkVuYWJsZSB1c2luZyB0b29scyBjb250cmlidXRlZCBieSB0aGlyZC1wYXJ0eSBleHRlbnNpb25zIGluIENvcGlsb3QgQ2hhdCBhZ2VudCBtb2RlLlwiKSxcblx0XHRcdFx0cHJldmlld0ZlYXR1cmU6IHRydWUsXG5cdFx0XHRcdGRlZmF1bHRWYWx1ZTogZmFsc2Vcblx0XHRcdH1cblx0XHR9LFxuXHRcdFttY3BEaXNjb3ZlcnlTZWN0aW9uXToge1xuXHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0eyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IE9iamVjdC5mcm9tRW50cmllcyhhbGxEaXNjb3ZlcnlTb3VyY2VzLm1hcChrID0+IFtrLCB0cnVlXSkpLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IE9iamVjdC5mcm9tRW50cmllcyhhbGxEaXNjb3ZlcnlTb3VyY2VzLm1hcChrID0+IFtcblx0XHRcdFx0XHRcdGssXG5cdFx0XHRcdFx0XHR7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbWNwLmRpc2NvdmVyeS5zb3VyY2UnLCBcIkVuYWJsZXMgZGlzY292ZXJ5IG9mIHswfSBzZXJ2ZXJzXCIsIGRpc2NvdmVyeVNvdXJjZUxhYmVsW2tdKSB9XG5cdFx0XHRcdFx0XSkpLFxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbXBjLmRpc2NvdmVyeS5lbmFibGVkJywgXCJDb25maWd1cmVzIGRpc2NvdmVyeSBvZiBNb2RlbCBDb250ZXh0IFByb3RvY29sIHNlcnZlcnMgb24gdGhlIG1hY2hpbmUuIEl0IG1heSBiZSBzZXQgdG8gYHRydWVgIG9yIGBmYWxzZWAgdG8gZGlzYWJsZSBvciBlbmFibGUgYWxsIHNvdXJjZXMsIGFuZCBhbiBtYXBwaW5nIHNvdXJjZXMgeW91IHdpc2ggdG8gZW5hYmxlLlwiKSxcblx0XHR9LFxuXHRcdFtQcm9tcHRzQ29uZmlnLktFWV06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoXG5cdFx0XHRcdCdjaGF0LnJldXNhYmxlUHJvbXB0cy5jb25maWcuZW5hYmxlZC50aXRsZScsXG5cdFx0XHRcdFwiUHJvbXB0IEZpbGVzXCIsXG5cdFx0XHQpLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKFxuXHRcdFx0XHQnY2hhdC5yZXVzYWJsZVByb21wdHMuY29uZmlnLmVuYWJsZWQuZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRcIkVuYWJsZSByZXVzYWJsZSBwcm9tcHQgZmlsZXMgKGAqezB9YCkgaW4gQ2hhdCwgRWRpdHMsIGFuZCBJbmxpbmUgQ2hhdCBzZXNzaW9ucy4gW0xlYXJuIE1vcmVdKHsxfSkuXCIsXG5cdFx0XHRcdFBST01QVF9GSUxFX0VYVEVOU0lPTixcblx0XHRcdFx0RE9DVU1FTlRBVElPTl9VUkwsXG5cdFx0XHQpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHRkaXNhbGxvd0NvbmZpZ3VyYXRpb25EZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydleHBlcmltZW50YWwnLCAncHJvbXB0cycsICdyZXVzYWJsZSBwcm9tcHRzJywgJ3Byb21wdCBzbmlwcGV0cycsICdpbnN0cnVjdGlvbnMnXSxcblx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRuYW1lOiAnQ2hhdFByb21wdEZpbGVzJyxcblx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjk5Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY2hhdC5wcm9tcHRGaWxlcy5wb2xpY3knLCBcIkVuYWJsZXMgcmV1c2FibGUgcHJvbXB0IGZpbGVzIGluIENoYXQsIEVkaXRzLCBhbmQgSW5saW5lIENoYXQgc2Vzc2lvbnMuXCIpLFxuXHRcdFx0XHRwcmV2aWV3RmVhdHVyZTogdHJ1ZSxcblx0XHRcdFx0ZGVmYXVsdFZhbHVlOiBmYWxzZVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0W1Byb21wdHNDb25maWcuTE9DQVRJT05TX0tFWV06IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J2NoYXQucmV1c2FibGVQcm9tcHRzLmNvbmZpZy5sb2NhdGlvbnMudGl0bGUnLFxuXHRcdFx0XHRcIlByb21wdCBGaWxlIExvY2F0aW9uc1wiLFxuXHRcdFx0KSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZShcblx0XHRcdFx0J2NoYXQucmV1c2FibGVQcm9tcHRzLmNvbmZpZy5sb2NhdGlvbnMuZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRcIlNwZWNpZnkgbG9jYXRpb24ocykgb2YgcmV1c2FibGUgcHJvbXB0IGZpbGVzIChgKnswfWApIHRoYXQgY2FuIGJlIGF0dGFjaGVkIGluIENoYXQsIEVkaXRzLCBhbmQgSW5saW5lIENoYXQgc2Vzc2lvbnMuIFtMZWFybiBNb3JlXSh7MX0pLlxcblxcblJlbGF0aXZlIHBhdGhzIGFyZSByZXNvbHZlZCBmcm9tIHRoZSByb290IGZvbGRlcihzKSBvZiB5b3VyIHdvcmtzcGFjZS5cIixcblx0XHRcdFx0UFJPTVBUX0ZJTEVfRVhURU5TSU9OLFxuXHRcdFx0XHRET0NVTUVOVEFUSU9OX1VSTCxcblx0XHRcdCksXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFtQUk9NUFRfRklMRVNfREVGQVVMVF9TT1VSQ0VfRk9MREVSXTogdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdHVuZXZhbHVhdGVkUHJvcGVydGllczogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdHJlc3RyaWN0ZWQ6IHRydWUsXG5cdFx0XHR0YWdzOiBbJ2V4cGVyaW1lbnRhbCcsICdwcm9tcHRzJywgJ3JldXNhYmxlIHByb21wdHMnLCAncHJvbXB0IHNuaXBwZXRzJywgJ2luc3RydWN0aW9ucyddLFxuXHRcdFx0ZXhhbXBsZXM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdFtQUk9NUFRfRklMRVNfREVGQVVMVF9TT1VSQ0VfRk9MREVSXTogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdFtQUk9NUFRfRklMRVNfREVGQVVMVF9TT1VSQ0VfRk9MREVSXTogdHJ1ZSxcblx0XHRcdFx0XHQnL1VzZXJzL3ZzY29kZS9yZXBvcy9wcm9tcHRzJzogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdF0sXG5cdFx0fSxcblx0fVxufSk7XG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdENoYXRFZGl0b3IsXG5cdFx0Q2hhdEVkaXRvcklucHV0LkVkaXRvcklELFxuXHRcdG5scy5sb2NhbGl6ZSgnY2hhdCcsIFwiQ2hhdFwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKENoYXRFZGl0b3JJbnB1dClcblx0XVxuKTtcblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbikucmVnaXN0ZXJDb25maWd1cmF0aW9uTWlncmF0aW9ucyhbXG5cdHtcblx0XHRrZXk6ICdjaGF0LmV4cGVyaW1lbnRhbC5kZXRlY3RQYXJ0aWNpcGFudC5lbmFibGVkJyxcblx0XHRtaWdyYXRlRm46ICh2YWx1ZSwgX2FjY2Vzc29yKSA9PiAoW1xuXHRcdFx0WydjaGF0LmV4cGVyaW1lbnRhbC5kZXRlY3RQYXJ0aWNpcGFudC5lbmFibGVkJywgeyB2YWx1ZTogdW5kZWZpbmVkIH1dLFxuXHRcdFx0WydjaGF0LmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnLCB7IHZhbHVlOiB2YWx1ZSAhPT0gZmFsc2UgfV1cblx0XHRdKVxuXHR9XG5dKTtcblxuY2xhc3MgQ2hhdFJlc29sdmVyQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNoYXRSZXNvbHZlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlOiBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdGAke1NjaGVtYXMudnNjb2RlQ2hhdFNlc3NzaW9ufToqKi8qKmAsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiBDaGF0RWRpdG9ySW5wdXQuRWRpdG9ySUQsXG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2NoYXQnLCBcIkNoYXRcIiksXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpblxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0c2luZ2xlUGVyUmVzb3VyY2U6IHRydWUsXG5cdFx0XHRcdGNhblN1cHBvcnRSZXNvdXJjZTogcmVzb3VyY2UgPT4gcmVzb3VyY2Uuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZUNoYXRTZXNzc2lvblxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4geyBlZGl0b3I6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0b3JJbnB1dCwgcmVzb3VyY2UsIG9wdGlvbnMgYXMgSUNoYXRFZGl0b3JPcHRpb25zKSwgb3B0aW9ucyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSk7XG5cdH1cbn1cblxuY2xhc3MgQ2hhdEFnZW50U2V0dGluZ0NvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuY2hhdEFnZW50U2V0dGluZyc7XG5cblx0cHJpdmF0ZSByZWdpc3RlcmVkTm9kZTogSUNvbmZpZ3VyYXRpb25Ob2RlIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHBlcmltZW50U2VydmljZTogSVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNoYXRFbnRpdGxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnRpdGxlbWVudFNlcnZpY2U6IElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKHRoaXMucHJvZHVjdFNlcnZpY2UucXVhbGl0eSAhPT0gJ3N0YWJsZScpIHtcblx0XHRcdHRoaXMucmVnaXN0ZXJFbmFibGVtZW50U2V0dGluZygpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4cERpc2FibGVkS2V5ID0gQ2hhdENvbnRleHRLZXlzLkVkaXRpbmcuYWdlbnRNb2RlRGlzYWxsb3dlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGV4cGVyaW1lbnRTZXJ2aWNlLmdldFRyZWF0bWVudDxib29sZWFuPignY2hhdEFnZW50RW5hYmxlZCcpLnRoZW4oZW5hYmxlZCA9PiB7XG5cdFx0XHRpZiAoZW5hYmxlZCB8fCB0eXBlb2YgZW5hYmxlZCAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRcdC8vIElmIGVuYWJsZWQsIG9yIGV4cGVyaW1lbnRzIG5vdCBhdmFpbGFibGUsIGZhbGwgYmFjayB0byByZWdpc3RlcmluZyB0aGUgc2V0dGluZ1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyRW5hYmxlbWVudFNldHRpbmcoKTtcblx0XHRcdFx0ZXhwRGlzYWJsZWRLZXkuc2V0KGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIElmIGRpc2FibGVkLCBkZXJlZ2lzdGVyIHRoZSBzZXR0aW5nXG5cdFx0XHRcdHRoaXMuZGVyZWdpc3RlclNldHRpbmcoKTtcblx0XHRcdFx0ZXhwRGlzYWJsZWRLZXkuc2V0KHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3Rlck1heFJlcXVlc3RzU2V0dGluZygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckVuYWJsZW1lbnRTZXR0aW5nKCkge1xuXHRcdGlmICh0aGlzLnJlZ2lzdGVyZWROb2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5yZWdpc3RlcmVkTm9kZSA9IGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdFx0aWQ6ICdjaGF0QWdlbnQnLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnaW50ZXJhY3RpdmVTZXNzaW9uQ29uZmlndXJhdGlvblRpdGxlJywgXCJDaGF0XCIpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFtDaGF0Q29uZmlndXJhdGlvbi5BZ2VudEVuYWJsZWRdOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NoYXQuYWdlbnQuZW5hYmxlZC5kZXNjcmlwdGlvbicsIFwiRW5hYmxlIGFnZW50IG1vZGUgZm9yIHswfS4gV2hlbiB0aGlzIGlzIGVuYWJsZWQsIGEgZHJvcGRvd24gYXBwZWFycyBpbiB0aGUgdmlldyB0byB0b2dnbGUgYWdlbnQgbW9kZS5cIiwgJ0NvcGlsb3QgQ2hhdCcpLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRoaXMucHJvZHVjdFNlcnZpY2UucXVhbGl0eSAhPT0gJ3N0YWJsZScsXG5cdFx0XHRcdFx0dGFnczogWydvbkV4cCddLFxuXHRcdFx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRcdFx0bmFtZTogJ0NoYXRBZ2VudE1vZGUnLFxuXHRcdFx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjk5Jyxcblx0XHRcdFx0XHRcdHByZXZpZXdGZWF0dXJlOiBmYWxzZSxcblx0XHRcdFx0XHRcdGRlZmF1bHRWYWx1ZTogZmFsc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRlcmVnaXN0ZXJTZXR0aW5nKCkge1xuXHRcdGlmICh0aGlzLnJlZ2lzdGVyZWROb2RlKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uUmVnaXN0cnkuZGVyZWdpc3RlckNvbmZpZ3VyYXRpb25zKFt0aGlzLnJlZ2lzdGVyZWROb2RlXSk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyZWROb2RlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJNYXhSZXF1ZXN0c1NldHRpbmcoKTogdm9pZCB7XG5cdFx0bGV0IGxhc3ROb2RlOiBJQ29uZmlndXJhdGlvbk5vZGUgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVnaXN0ZXJNYXhSZXF1ZXN0c1NldHRpbmcgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCB0cmVhdG1lbnRJZCA9IHRoaXMuZW50aXRsZW1lbnRTZXJ2aWNlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuTGltaXRlZCA/XG5cdFx0XHRcdCdjaGF0QWdlbnRNYXhSZXF1ZXN0c0ZyZWUnIDpcblx0XHRcdFx0J2NoYXRBZ2VudE1heFJlcXVlc3RzUHJvJztcblx0XHRcdHRoaXMuZXhwZXJpbWVudFNlcnZpY2UuZ2V0VHJlYXRtZW50PG51bWJlcj4odHJlYXRtZW50SWQpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRjb25zdCBkZWZhdWx0VmFsdWUgPSB2YWx1ZSA/PyAodGhpcy5lbnRpdGxlbWVudFNlcnZpY2UuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5MaW1pdGVkID8gNSA6IDE1KTtcblx0XHRcdFx0Y29uc3Qgbm9kZTogSUNvbmZpZ3VyYXRpb25Ob2RlID0ge1xuXHRcdFx0XHRcdGlkOiAnY2hhdFNpZGViYXInLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2ludGVyYWN0aXZlU2Vzc2lvbkNvbmZpZ3VyYXRpb25UaXRsZScsIFwiQ2hhdFwiKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHQnY2hhdC5hZ2VudC5tYXhSZXF1ZXN0cyc6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY2hhdC5hZ2VudC5tYXhSZXF1ZXN0cycsIFwiVGhlIG1heGltdW0gbnVtYmVyIG9mIHJlcXVlc3RzIHRvIGFsbG93IENvcGlsb3QgRWRpdHMgdG8gdXNlIHBlci10dXJuIGluIGFnZW50IG1vZGUuIFdoZW4gdGhlIGxpbWl0IGlzIHJlYWNoZWQsIENvcGlsb3Qgd2lsbCBhc2sgdGhlIHVzZXIgdG8gY29uZmlybSB0aGF0IGl0IHNob3VsZCBrZWVwIHdvcmtpbmcuIFxcblxcbj4gKipOb3RlKio6IEZvciB1c2VycyBvbiB0aGUgQ29waWxvdCBGcmVlIHBsYW4sIG5vdGUgdGhhdCBlYWNoIGFnZW50IG1vZGUgcmVxdWVzdCBjdXJyZW50bHkgdXNlcyBvbmUgY2hhdCByZXF1ZXN0LlwiKSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdFZhbHVlLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS51cGRhdGVDb25maWd1cmF0aW9ucyh7IHJlbW92ZTogbGFzdE5vZGUgPyBbbGFzdE5vZGVdIDogW10sIGFkZDogW25vZGVdIH0pO1xuXHRcdFx0XHRsYXN0Tm9kZSA9IG5vZGU7XG5cdFx0XHR9KTtcblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZShFdmVudC5kZWJvdW5jZSh0aGlzLmVudGl0bGVtZW50U2VydmljZS5vbkRpZENoYW5nZUVudGl0bGVtZW50LCAoKSA9PiB7IH0sIDEwMDApLCAoKSA9PiByZWdpc3Rlck1heFJlcXVlc3RzU2V0dGluZygpKSk7XG5cdH1cbn1cblxuQWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5yZWdpc3RlcihuZXcgQ2hhdFJlc3BvbnNlQWNjZXNzaWJsZVZpZXcoKSk7XG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBQYW5lbENoYXRBY2Nlc3NpYmlsaXR5SGVscCgpKTtcbkFjY2Vzc2libGVWaWV3UmVnaXN0cnkucmVnaXN0ZXIobmV3IFF1aWNrQ2hhdEFjY2Vzc2liaWxpdHlIZWxwKCkpO1xuQWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5yZWdpc3RlcihuZXcgRWRpdHNDaGF0QWNjZXNzaWJpbGl0eUhlbHAoKSk7XG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBBZ2VudENoYXRBY2Nlc3NpYmlsaXR5SGVscCgpKTtcblxucmVnaXN0ZXJFZGl0b3JGZWF0dXJlKENoYXRJbnB1dEJveENvbnRlbnRQcm92aWRlcik7XG5cbmNsYXNzIENoYXRTbGFzaFN0YXRpY1NsYXNoQ29tbWFuZHNDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuY2hhdFNsYXNoU3RhdGljU2xhc2hDb21tYW5kcyc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDaGF0U2xhc2hDb21tYW5kU2VydmljZSBzbGFzaENvbW1hbmRTZXJ2aWNlOiBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUNoYXRWYXJpYWJsZXNTZXJ2aWNlIGNoYXRWYXJpYWJsZXNTZXJ2aWNlOiBJQ2hhdFZhcmlhYmxlc1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChzbGFzaENvbW1hbmRTZXJ2aWNlLnJlZ2lzdGVyU2xhc2hDb21tYW5kKHtcblx0XHRcdGNvbW1hbmQ6ICdjbGVhcicsXG5cdFx0XHRkZXRhaWw6IG5scy5sb2NhbGl6ZSgnY2xlYXInLCBcIlN0YXJ0IGEgbmV3IGNoYXRcIiksXG5cdFx0XHRzb3J0VGV4dDogJ3oyX2NsZWFyJyxcblx0XHRcdGV4ZWN1dGVJbW1lZGlhdGVseTogdHJ1ZSxcblx0XHRcdGxvY2F0aW9uczogW0NoYXRBZ2VudExvY2F0aW9uLlBhbmVsXVxuXHRcdH0sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKEFDVElPTl9JRF9ORVdfQ0hBVCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChzbGFzaENvbW1hbmRTZXJ2aWNlLnJlZ2lzdGVyU2xhc2hDb21tYW5kKHtcblx0XHRcdGNvbW1hbmQ6ICdoZWxwJyxcblx0XHRcdGRldGFpbDogJycsXG5cdFx0XHRzb3J0VGV4dDogJ3oxX2hlbHAnLFxuXHRcdFx0ZXhlY3V0ZUltbWVkaWF0ZWx5OiB0cnVlLFxuXHRcdFx0bG9jYXRpb25zOiBbQ2hhdEFnZW50TG9jYXRpb24uUGFuZWxdLFxuXHRcdFx0bW9kZXM6IFtDaGF0TW9kZS5Bc2tdXG5cdFx0fSwgYXN5bmMgKHByb21wdCwgcHJvZ3Jlc3MpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRBZ2VudCA9IGNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKTtcblx0XHRcdGNvbnN0IGFnZW50cyA9IGNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRzKCk7XG5cblx0XHRcdC8vIFJlcG9ydCBwcmVmaXhcblx0XHRcdGlmIChkZWZhdWx0QWdlbnQ/Lm1ldGFkYXRhLmhlbHBUZXh0UHJlZml4KSB7XG5cdFx0XHRcdGlmIChpc01hcmtkb3duU3RyaW5nKGRlZmF1bHRBZ2VudC5tZXRhZGF0YS5oZWxwVGV4dFByZWZpeCkpIHtcblx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBjb250ZW50OiBkZWZhdWx0QWdlbnQubWV0YWRhdGEuaGVscFRleHRQcmVmaXgsIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhkZWZhdWx0QWdlbnQubWV0YWRhdGEuaGVscFRleHRQcmVmaXgpLCBraW5kOiAnbWFya2Rvd25Db250ZW50JyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcoJ1xcblxcbicpLCBraW5kOiAnbWFya2Rvd25Db250ZW50JyB9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVwb3J0IGFnZW50IGxpc3Rcblx0XHRcdGNvbnN0IGFnZW50VGV4dCA9IChhd2FpdCBQcm9taXNlLmFsbChhZ2VudHNcblx0XHRcdFx0LmZpbHRlcihhID0+IGEuaWQgIT09IGRlZmF1bHRBZ2VudD8uaWQgJiYgIWEuaXNDb3JlKVxuXHRcdFx0XHQuZmlsdGVyKGEgPT4gYS5sb2NhdGlvbnMuaW5jbHVkZXMoQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpKVxuXHRcdFx0XHQubWFwKGFzeW5jIGEgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gYS5kZXNjcmlwdGlvbiA/IGAtICR7YS5kZXNjcmlwdGlvbn1gIDogJyc7XG5cdFx0XHRcdFx0Y29uc3QgYWdlbnRNYXJrZG93biA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFnZW50VG9NYXJrZG93bihhLCB0cnVlLCBhY2Nlc3NvcikpO1xuXHRcdFx0XHRcdGNvbnN0IGFnZW50TGluZSA9IGAtICR7YWdlbnRNYXJrZG93bn0gJHtkZXNjcmlwdGlvbn1gO1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRUZXh0ID0gYS5zbGFzaENvbW1hbmRzLm1hcChjID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gYy5kZXNjcmlwdGlvbiA/IGAtICR7Yy5kZXNjcmlwdGlvbn1gIDogJyc7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYFxcdCogJHthZ2VudFNsYXNoQ29tbWFuZFRvTWFya2Rvd24oYSwgYyl9ICR7ZGVzY3JpcHRpb259YDtcblx0XHRcdFx0XHR9KS5qb2luKCdcXG4nKTtcblxuXHRcdFx0XHRcdHJldHVybiAoYWdlbnRMaW5lICsgJ1xcbicgKyBjb21tYW5kVGV4dCkudHJpbSgpO1xuXHRcdFx0XHR9KSkpLmpvaW4oJ1xcbicpO1xuXHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgY29udGVudDogbmV3IE1hcmtkb3duU3RyaW5nKGFnZW50VGV4dCwgeyBpc1RydXN0ZWQ6IHsgZW5hYmxlZENvbW1hbmRzOiBbQ2hhdFN1Ym1pdEFjdGlvbi5JRF0gfSB9KSwga2luZDogJ21hcmtkb3duQ29udGVudCcgfSk7XG5cblx0XHRcdC8vIFJlcG9ydCB2YXJpYWJsZXNcblx0XHRcdGlmIChkZWZhdWx0QWdlbnQ/Lm1ldGFkYXRhLmhlbHBUZXh0VmFyaWFibGVzUHJlZml4KSB7XG5cdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZygnXFxuXFxuJyksIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH0pO1xuXHRcdFx0XHRpZiAoaXNNYXJrZG93blN0cmluZyhkZWZhdWx0QWdlbnQubWV0YWRhdGEuaGVscFRleHRWYXJpYWJsZXNQcmVmaXgpKSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3MucmVwb3J0KHsgY29udGVudDogZGVmYXVsdEFnZW50Lm1ldGFkYXRhLmhlbHBUZXh0VmFyaWFibGVzUHJlZml4LCBraW5kOiAnbWFya2Rvd25Db250ZW50JyB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcoZGVmYXVsdEFnZW50Lm1ldGFkYXRhLmhlbHBUZXh0VmFyaWFibGVzUHJlZml4KSwga2luZDogJ21hcmtkb3duQ29udGVudCcgfSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2YXJpYWJsZXMgPSBbXG5cdFx0XHRcdFx0eyBuYW1lOiAnZmlsZScsIGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2ZpbGUnLCBcIkNob29zZSBhIGZpbGUgaW4gdGhlIHdvcmtzcGFjZVwiKSB9XG5cdFx0XHRcdF07XG5cdFx0XHRcdGNvbnN0IHZhcmlhYmxlVGV4dCA9IHZhcmlhYmxlc1xuXHRcdFx0XHRcdC5tYXAodiA9PiBgKiBcXGAke2NoYXRWYXJpYWJsZUxlYWRlcn0ke3YubmFtZX1cXGAgLSAke3YuZGVzY3JpcHRpb259YClcblx0XHRcdFx0XHQuam9pbignXFxuJyk7XG5cdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZygnXFxuJyArIHZhcmlhYmxlVGV4dCksIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXBvcnQgaGVscCB0ZXh0IGVuZGluZ1xuXHRcdFx0aWYgKGRlZmF1bHRBZ2VudD8ubWV0YWRhdGEuaGVscFRleHRQb3N0Zml4KSB7XG5cdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZygnXFxuXFxuJyksIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH0pO1xuXHRcdFx0XHRpZiAoaXNNYXJrZG93blN0cmluZyhkZWZhdWx0QWdlbnQubWV0YWRhdGEuaGVscFRleHRQb3N0Zml4KSkge1xuXHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IGRlZmF1bHRBZ2VudC5tZXRhZGF0YS5oZWxwVGV4dFBvc3RmaXgsIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhkZWZhdWx0QWdlbnQubWV0YWRhdGEuaGVscFRleHRQb3N0Zml4KSwga2luZDogJ21hcmtkb3duQ29udGVudCcgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gV2l0aG91dCB0aGlzLCB0aGUgcmVzcG9uc2Ugd2lsbCBiZSBkb25lIGJlZm9yZSBpdCByZW5kZXJzIGFuZCBzbyBpdCB3aWxsIG5vdCBzdHJlYW0uIFRoaXMgZW5zdXJlcyB0aGF0IGlmIHRoZSByZXNwb25zZSBzdGFydHNcblx0XHRcdC8vIHJlbmRlcmluZyBkdXJpbmcgdGhlIG5leHQgMjAwbXMsIHRoZW4gaXQgd2lsbCBiZSBzdHJlYW1lZC4gT25jZSBpdCBzdGFydHMgc3RyZWFtaW5nLCB0aGUgd2hvbGUgcmVzcG9uc2Ugc3RyZWFtcyBldmVuIGFmdGVyXG5cdFx0XHQvLyBpdCBoYXMgcmVjZWl2ZWQgYWxsIHJlc3BvbnNlIGRhdGEgaGFzIGJlZW4gcmVjZWl2ZWQuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwMCk7XG5cdFx0fSkpO1xuXHR9XG59XG5SZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnJlZ2lzdGVyRWRpdG9yU2VyaWFsaXplcihDaGF0RWRpdG9ySW5wdXQuVHlwZUlELCBDaGF0RWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRSZXNvbHZlckNvbnRyaWJ1dGlvbi5JRCwgQ2hhdFJlc29sdmVyQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRTbGFzaFN0YXRpY1NsYXNoQ29tbWFuZHNDb250cmlidXRpb24uSUQsIENoYXRTbGFzaFN0YXRpY1NsYXNoQ29tbWFuZHNDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkV2ZW50dWFsbHkpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRFeHRlbnNpb25Qb2ludEhhbmRsZXIuSUQsIENoYXRFeHRlbnNpb25Qb2ludEhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrU3RhcnR1cCk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoTGFuZ3VhZ2VNb2RlbFRvb2xzRXh0ZW5zaW9uUG9pbnRIYW5kbGVyLklELCBMYW5ndWFnZU1vZGVsVG9vbHNFeHRlbnNpb25Qb2ludEhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQ2hhdENvbXBhdGliaWxpdHlOb3RpZmllci5JRCwgQ2hhdENvbXBhdGliaWxpdHlOb3RpZmllciwgV29ya2JlbmNoUGhhc2UuRXZlbnR1YWxseSk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQ29waWxvdFRpdGxlQmFyTWVudVJlbmRlcmluZy5JRCwgQ29waWxvdFRpdGxlQmFyTWVudVJlbmRlcmluZywgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDb2RlQmxvY2tBY3Rpb25SZW5kZXJpbmcuSUQsIENvZGVCbG9ja0FjdGlvblJlbmRlcmluZywgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDaGF0SW1wbGljaXRDb250ZXh0Q29udHJpYnV0aW9uLklELCBDaGF0SW1wbGljaXRDb250ZXh0Q29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5FdmVudHVhbGx5KTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDaGF0UmVsYXRlZEZpbGVzQ29udHJpYnV0aW9uLklELCBDaGF0UmVsYXRlZEZpbGVzQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5FdmVudHVhbGx5KTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDaGF0Vmlld3NXZWxjb21lSGFuZGxlci5JRCwgQ2hhdFZpZXdzV2VsY29tZUhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrU3RhcnR1cCk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQ2hhdEdldHRpbmdTdGFydGVkQ29udHJpYnV0aW9uLklELCBDaGF0R2V0dGluZ1N0YXJ0ZWRDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkV2ZW50dWFsbHkpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRTZXR1cENvbnRyaWJ1dGlvbi5JRCwgQ2hhdFNldHVwQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRTdGF0dXNCYXJFbnRyeS5JRCwgQ2hhdFN0YXR1c0JhckVudHJ5LCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKEJ1aWx0aW5Ub29sc0NvbnRyaWJ1dGlvbi5JRCwgQnVpbHRpblRvb2xzQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5FdmVudHVhbGx5KTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDaGF0QWdlbnRTZXR0aW5nQ29udHJpYnV0aW9uLklELCBDaGF0QWdlbnRTZXR0aW5nQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRFZGl0aW5nRWRpdG9yQWNjZXNzaWJpbGl0eS5JRCwgQ2hhdEVkaXRpbmdFZGl0b3JBY2Nlc3NpYmlsaXR5LCBXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDaGF0RWRpdGluZ0VkaXRvck92ZXJsYXkuSUQsIENoYXRFZGl0aW5nRWRpdG9yT3ZlcmxheSwgV29ya2JlbmNoUGhhc2UuQWZ0ZXJSZXN0b3JlZCk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQ2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cy5JRCwgQ2hhdEVkaXRpbmdFZGl0b3JDb250ZXh0S2V5cywgV29ya2JlbmNoUGhhc2UuQWZ0ZXJSZXN0b3JlZCk7XG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoQ2hhdFRyYW5zZmVyQ29udHJpYnV0aW9uLklELCBDaGF0VHJhbnNmZXJDb250cmlidXRpb24sIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG5cbnJlZ2lzdGVyQ2hhdEFjdGlvbnMoKTtcbnJlZ2lzdGVyQ2hhdENvcHlBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXRDb2RlQmxvY2tBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXRDb2RlQ29tcGFyZUJsb2NrQWN0aW9ucygpO1xucmVnaXN0ZXJDaGF0RmlsZVRyZWVBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXRUaXRsZUFjdGlvbnMoKTtcbnJlZ2lzdGVyQ2hhdEV4ZWN1dGVBY3Rpb25zKCk7XG5yZWdpc3RlclF1aWNrQ2hhdEFjdGlvbnMoKTtcbnJlZ2lzdGVyQ2hhdEV4cG9ydEFjdGlvbnMoKTtcbnJlZ2lzdGVyTW92ZUFjdGlvbnMoKTtcbnJlZ2lzdGVyTmV3Q2hhdEFjdGlvbnMoKTtcbnJlZ2lzdGVyQ2hhdENvbnRleHRBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXREZXZlbG9wZXJBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXRFZGl0b3JBY3Rpb25zKCk7XG5yZWdpc3RlckNoYXRUb29sQWN0aW9ucygpO1xuXG5yZWdpc3RlckVkaXRvckZlYXR1cmUoQ2hhdFBhc3RlUHJvdmlkZXJzRmVhdHVyZSk7XG5cblxucmVnaXN0ZXJTaW5nbGV0b24oSUNoYXRTZXJ2aWNlLCBDaGF0U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdFdpZGdldFNlcnZpY2UsIENoYXRXaWRnZXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElRdWlja0NoYXRTZXJ2aWNlLCBRdWlja0NoYXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElDaGF0QWNjZXNzaWJpbGl0eVNlcnZpY2UsIENoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdFdpZGdldEhpc3RvcnlTZXJ2aWNlLCBDaGF0V2lkZ2V0SGlzdG9yeVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUxhbmd1YWdlTW9kZWxzU2VydmljZSwgTGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElMYW5ndWFnZU1vZGVsU3RhdHNTZXJ2aWNlLCBMYW5ndWFnZU1vZGVsU3RhdHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElDaGF0U2xhc2hDb21tYW5kU2VydmljZSwgQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNoYXRBZ2VudFNlcnZpY2UsIENoYXRBZ2VudFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNoYXRBZ2VudE5hbWVTZXJ2aWNlLCBDaGF0QWdlbnROYW1lU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdFZhcmlhYmxlc1NlcnZpY2UsIENoYXRWYXJpYWJsZXNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLCBMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElWb2ljZUNoYXRTZXJ2aWNlLCBWb2ljZUNoYXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElDaGF0Q29kZUJsb2NrQ29udGV4dFByb3ZpZGVyU2VydmljZSwgQ2hhdENvZGVCbG9ja0NvbnRleHRQcm92aWRlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNvZGVNYXBwZXJTZXJ2aWNlLCBDb2RlTWFwcGVyU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBDaGF0RWRpdGluZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UsIENoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUxhbmd1YWdlTW9kZWxJZ25vcmVkRmlsZXNTZXJ2aWNlLCBMYW5ndWFnZU1vZGVsSWdub3JlZEZpbGVzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdEVudGl0bGVtZW50U2VydmljZSwgQ2hhdEVudGl0bGVtZW50U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJUHJvbXB0c1NlcnZpY2UsIFByb21wdHNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElDaGF0VHJhbnNmZXJTZXJ2aWNlLCBDaGF0VHJhbnNmZXJTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENoYXRFZGl0aW5nTm90ZWJvb2tGaWxlU3lzdGVtUHJvdmlkZXJDb250cmliLklELCBDaGF0RWRpdGluZ05vdGVib29rRmlsZVN5c3RlbVByb3ZpZGVyQ29udHJpYiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQix3QkFBd0I7QUFDakQsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsNkJBQTZCO0FBQ3RDLFlBQVksU0FBUztBQUNyQixTQUFTLDhCQUE4QjtBQUN2QyxT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
