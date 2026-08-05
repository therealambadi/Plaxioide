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
import { coalesce } from "../../../../../base/common/arrays.js";
import { raceTimeout } from "../../../../../base/common/async.js";
import { isPatternInWord } from "../../../../../base/common/filters.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { dirname } from "../../../../../base/common/resources.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { isCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { getWordAtText } from "../../../../../editor/common/core/wordHelper.js";
import { CompletionItemKind, SymbolKind, SymbolKinds } from "../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { IOutlineModelService } from "../../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { localize } from "../../../../../nls.js";
import { Action2, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IMarkerService } from "../../../../../platform/markers/common/markers.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { Extensions as WorkbenchExtensions } from "../../../../common/contributions.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IHistoryService } from "../../../../services/history/common/history.js";
import { LifecyclePhase } from "../../../../services/lifecycle/common/lifecycle.js";
import { QueryBuilder } from "../../../../services/search/common/queryBuilder.js";
import { ISearchService } from "../../../../services/search/common/search.js";
import { IChatAgentNameService, IChatAgentService, getFullyQualifiedId } from "../../common/chatAgents.js";
import { IChatEditingService } from "../../common/chatEditingService.js";
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestTextPart, ChatRequestToolPart, chatAgentLeader, chatSubcommandLeader, chatVariableLeader } from "../../common/chatParserTypes.js";
import { IChatSlashCommandService } from "../../common/chatSlashCommands.js";
import { ChatAgentLocation, ChatMode } from "../../common/constants.js";
import { ILanguageModelToolsService } from "../../common/languageModelToolsService.js";
import { ChatEditingSessionSubmitAction, ChatSubmitAction } from "../actions/chatExecuteActions.js";
import { IChatWidgetService } from "../chat.js";
import { ChatInputPart } from "../chatInputPart.js";
import { ChatDynamicVariableModel, SelectAndInsertFileAction, SelectAndInsertFolderAction, SelectAndInsertProblemAction, SelectAndInsertSymAction, getTopLevelFolders, searchFolders } from "./chatDynamicVariables.js";
let SlashCommandCompletions = class extends Disposable {
  constructor(languageFeaturesService, chatWidgetService, chatSlashCommandService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.chatSlashCommandService = chatSlashCommandService;
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "globalSlashCommands",
      triggerCharacters: ["/"],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        const range = computeCompletionRanges(model, position, /\/\w*/g);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const parsedRequest = widget.parsedInput.parts;
        const usedAgent = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
        if (usedAgent) {
          return;
        }
        const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentMode);
        if (!slashCommands) {
          return null;
        }
        return {
          suggestions: slashCommands.map((c, i) => {
            const withSlash = `/${c.command}`;
            return {
              label: withSlash,
              insertText: c.executeImmediately ? "" : `${withSlash} `,
              documentation: c.detail,
              range,
              sortText: c.sortText ?? "a".repeat(i + 1),
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway,
              command: c.executeImmediately ? { id: widget.location === ChatAgentLocation.EditingSession ? ChatEditingSessionSubmitAction.ID : ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : void 0
            };
          })
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "globalSlashCommandsAt",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return null;
        }
        const range = computeCompletionRanges(model, position, /@\w*/g);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const slashCommands = this.chatSlashCommandService.getCommands(widget.location, widget.input.currentMode);
        if (!slashCommands) {
          return null;
        }
        return {
          suggestions: slashCommands.map((c, i) => {
            const withSlash = `${chatSubcommandLeader}${c.command}`;
            return {
              label: withSlash,
              insertText: c.executeImmediately ? "" : `${withSlash} `,
              documentation: c.detail,
              range,
              filterText: `${chatAgentLeader}${c.command}`,
              sortText: c.sortText ?? "z".repeat(i + 1),
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway,
              command: c.executeImmediately ? { id: widget.location === ChatAgentLocation.EditingSession ? ChatEditingSessionSubmitAction.ID : ChatSubmitAction.ID, title: withSlash, arguments: [{ widget, inputValue: `${withSlash} ` }] } : void 0
            };
          })
        };
      }
    }));
  }
};
SlashCommandCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatSlashCommandService)
], SlashCommandCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(SlashCommandCompletions, LifecyclePhase.Eventually);
let AgentCompletions = class extends Disposable {
  constructor(languageFeaturesService, chatWidgetService, chatAgentService, chatAgentNameService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this.chatAgentService = chatAgentService;
    this.chatAgentNameService = chatAgentNameService;
    const subCommandProvider = {
      _debugDisplayName: "chatAgentSubcommand",
      triggerCharacters: ["/"],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return;
        }
        const range = computeCompletionRanges(model, position, /\/\w*/g);
        if (!range) {
          return null;
        }
        const parsedRequest = widget.parsedInput.parts;
        const usedAgentIdx = parsedRequest.findIndex((p) => p instanceof ChatRequestAgentPart);
        if (usedAgentIdx < 0) {
          return;
        }
        const usedSubcommand = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
        if (usedSubcommand) {
          return;
        }
        for (const partAfterAgent of parsedRequest.slice(usedAgentIdx + 1)) {
          if (!(partAfterAgent instanceof ChatRequestTextPart) || !partAfterAgent.text.trim().match(/^(\/\w*)?$/)) {
            return;
          }
        }
        const usedAgent = parsedRequest[usedAgentIdx];
        return {
          suggestions: usedAgent.agent.slashCommands.map((c, i) => {
            const withSlash = `/${c.name}`;
            return {
              label: withSlash,
              insertText: `${withSlash} `,
              documentation: c.description,
              range,
              kind: CompletionItemKind.Text
              // The icons are disabled here anyway
            };
          })
        };
      }
    };
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, subCommandProvider));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentAndSubcommand",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        const viewModel = widget?.viewModel;
        if (!widget || !viewModel || widget.input.currentMode !== ChatMode.Ask) {
          return;
        }
        const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const agents = this.chatAgentService.getAgents().filter((a) => a.locations.includes(widget.location));
        const getFilterText = (agent, command) => {
          const dummyPrefix = agent.id === "github.copilot.terminalPanel" ? `0000` : ``;
          return `${chatAgentLeader}${dummyPrefix}${agent.name}.${command}`;
        };
        const justAgents = agents.filter((a) => !a.isDefault).map((agent) => {
          const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
          const detail = agent.description;
          return {
            label: isDupe ? { label: agentLabel, description: agent.description, detail: ` (${agent.publisherDisplayName})` } : agentLabel,
            documentation: detail,
            filterText: `${chatAgentLeader}${agent.name}`,
            insertText: `${agentLabel} `,
            range,
            kind: CompletionItemKind.Text,
            sortText: `${chatAgentLeader}${agent.name}`,
            command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
          };
        });
        return {
          suggestions: justAgents.concat(
            coalesce(agents.flatMap((agent) => agent.slashCommands.map((c, i) => {
              if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentMode)?.id !== agent.id) {
                return;
              }
              const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
              const label = `${agentLabel} ${chatSubcommandLeader}${c.name}`;
              const item = {
                label: isDupe ? { label, description: c.description, detail: isDupe ? ` (${agent.publisherDisplayName})` : void 0 } : label,
                documentation: c.description,
                filterText: getFilterText(agent, c.name),
                commitCharacters: [" "],
                insertText: label + " ",
                range,
                kind: CompletionItemKind.Text,
                // The icons are disabled here anyway
                sortText: `x${chatAgentLeader}${agent.name}${c.name}`,
                command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
              };
              if (agent.isDefault) {
                const label2 = `${chatSubcommandLeader}${c.name}`;
                item.label = label2;
                item.insertText = `${label2} `;
                item.documentation = c.description;
              }
              return item;
            })))
          )
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentAndSubcommand",
      triggerCharacters: [chatSubcommandLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        const viewModel = widget?.viewModel;
        if (!widget || !viewModel || widget.input.currentMode !== ChatMode.Ask) {
          return;
        }
        const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
        if (!range) {
          return null;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const agents = this.chatAgentService.getAgents().filter((a) => a.locations.includes(widget.location));
        return {
          suggestions: coalesce(agents.flatMap((agent) => agent.slashCommands.map((c, i) => {
            if (agent.isDefault && this.chatAgentService.getDefaultAgent(widget.location, widget.input.currentMode)?.id !== agent.id) {
              return;
            }
            const { label: agentLabel, isDupe } = this.getAgentCompletionDetails(agent);
            const withSlash = `${chatSubcommandLeader}${c.name}`;
            const extraSortText = agent.id === "github.copilot.terminalPanel" ? `z` : ``;
            const sortText = `${chatSubcommandLeader}${extraSortText}${agent.name}${c.name}`;
            const item = {
              label: { label: withSlash, description: agentLabel, detail: isDupe ? ` (${agent.publisherDisplayName})` : void 0 },
              commitCharacters: [" "],
              insertText: `${agentLabel} ${withSlash} `,
              documentation: `(${agentLabel}) ${c.description ?? ""}`,
              range,
              kind: CompletionItemKind.Text,
              // The icons are disabled here anyway
              sortText,
              command: { id: AssignSelectedAgentAction.ID, title: AssignSelectedAgentAction.ID, arguments: [{ agent, widget }] }
            };
            if (agent.isDefault) {
              const label = `${chatSubcommandLeader}${c.name}`;
              item.label = label;
              item.insertText = `${label} `;
              item.documentation = c.description;
            }
            return item;
          })))
        };
      }
    }));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "installChatExtensions",
      triggerCharacters: [chatAgentLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        if (!model.getLineContent(1).startsWith(chatAgentLeader)) {
          return;
        }
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (widget?.location !== ChatAgentLocation.Panel || widget.input.currentMode !== ChatMode.Ask) {
          return;
        }
        const range = computeCompletionRanges(model, position, /(@|\/)\w*/g);
        if (!range) {
          return;
        }
        if (!isEmptyUpToCompletionWord(model, range)) {
          return;
        }
        const label = localize("installLabel", "Install Chat Extensions...");
        const item = {
          label,
          insertText: "",
          range,
          kind: CompletionItemKind.Text,
          // The icons are disabled here anyway
          command: { id: "workbench.extensions.search", title: "", arguments: ["@tag:chat-participant"] },
          filterText: chatAgentLeader + label,
          sortText: "zzz"
        };
        return {
          suggestions: [item]
        };
      }
    }));
  }
  getAgentCompletionDetails(agent) {
    const isAllowed = this.chatAgentNameService.getAgentNameRestriction(agent);
    const agentLabel = `${chatAgentLeader}${isAllowed ? agent.name : getFullyQualifiedId(agent)}`;
    const isDupe = isAllowed && this.chatAgentService.agentHasDupeName(agent.id);
    return { label: agentLabel, isDupe };
  }
};
AgentCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IChatAgentNameService)
], AgentCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(AgentCompletions, LifecyclePhase.Eventually);
const _AssignSelectedAgentAction = class _AssignSelectedAgentAction extends Action2 {
  constructor() {
    super({
      id: _AssignSelectedAgentAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const arg = args[0];
    if (!arg || !arg.widget || !arg.agent) {
      return;
    }
    arg.widget.lastSelectedAgent = arg.agent;
  }
};
_AssignSelectedAgentAction.ID = "workbench.action.chat.assignSelectedAgent";
let AssignSelectedAgentAction = _AssignSelectedAgentAction;
registerAction2(AssignSelectedAgentAction);
class ReferenceArgument {
  constructor(widget, variable) {
    this.widget = widget;
    this.variable = variable;
  }
}
let BuiltinDynamicCompletions = class extends Disposable {
  constructor(historyService, workspaceContextService, searchService, labelService, languageFeaturesService, chatWidgetService, _chatEditingService, instantiationService, outlineService, editorService, configurationService, fileService, markerService) {
    super();
    this.historyService = historyService;
    this.workspaceContextService = workspaceContextService;
    this.searchService = searchService;
    this.labelService = labelService;
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this._chatEditingService = _chatEditingService;
    this.instantiationService = instantiationService;
    this.outlineService = outlineService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.fileService = fileService;
    this.registerVariableCompletions("file", async ({ widget, range, position, model }, token) => {
      if (!widget.supportsFileReferences) {
        return null;
      }
      const result = { suggestions: [] };
      const afterRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + "#file:".length);
      result.suggestions.push({
        label: `${chatVariableLeader}file`,
        insertText: `${chatVariableLeader}file:`,
        documentation: localize("pickFileLabel", "Pick a file"),
        range,
        kind: CompletionItemKind.Text,
        command: { id: SelectAndInsertFileAction.ID, title: SelectAndInsertFileAction.ID, arguments: [{ widget, range: afterRange }] },
        sortText: "z"
      });
      const range2 = computeCompletionRanges(model, position, new RegExp(`${chatVariableLeader}[^\\s]*`, "g"), true);
      if (range2) {
        await this.addFileEntries(widget, result, range2, token);
      }
      return result;
    });
    this.registerVariableCompletions("folder", async ({ widget, range, position, model }, token) => {
      if (!widget.supportsFileReferences) {
        return null;
      }
      const result = { suggestions: [] };
      const afterRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + "#folder:".length);
      result.suggestions.push({
        label: `${chatVariableLeader}folder`,
        insertText: `${chatVariableLeader}folder:`,
        documentation: localize("pickFolderLabel", "Pick a folder"),
        range,
        kind: CompletionItemKind.Text,
        command: { id: SelectAndInsertFolderAction.ID, title: SelectAndInsertFolderAction.ID, arguments: [{ widget, range: afterRange }] },
        sortText: "z"
      });
      const range2 = computeCompletionRanges(model, position, new RegExp(`${chatVariableLeader}[^\\s]*`, "g"), true);
      if (range2) {
        await this.addFolderEntries(widget, result, range2, token);
      }
      return result;
    });
    this.registerVariableCompletions("selection", ({ widget, range }, token) => {
      if (!widget.supportsFileReferences) {
        return;
      }
      if (widget.location === ChatAgentLocation.Editor) {
        return;
      }
      const active = this.editorService.activeTextEditorControl;
      if (!isCodeEditor(active)) {
        return;
      }
      const currentResource = active.getModel()?.uri;
      const currentSelection = active.getSelection();
      if (!currentSelection || !currentResource || currentSelection.isEmpty()) {
        return;
      }
      const basename = this.labelService.getUriBasenameLabel(currentResource);
      const text = `${chatVariableLeader}file:${basename}:${currentSelection.startLineNumber}-${currentSelection.endLineNumber}`;
      const fullRangeText = `:${currentSelection.startLineNumber}:${currentSelection.startColumn}-${currentSelection.endLineNumber}:${currentSelection.endColumn}`;
      const description = this.labelService.getUriLabel(currentResource, { relative: true }) + fullRangeText;
      const result = { suggestions: [] };
      result.suggestions.push({
        label: { label: `${chatVariableLeader}selection`, description },
        filterText: `${chatVariableLeader}selection`,
        insertText: range.varWord?.endColumn === range.replace.endColumn ? `${text} ` : text,
        range,
        kind: CompletionItemKind.Text,
        sortText: "z",
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: "vscode.selection",
            prefix: "file",
            isFile: true,
            range: { startLineNumber: range.replace.startLineNumber, startColumn: range.replace.startColumn, endLineNumber: range.replace.endLineNumber, endColumn: range.replace.startColumn + text.length },
            data: { range: currentSelection, uri: currentResource }
          })]
        }
      });
      return result;
    });
    this.registerVariableCompletions("symbol", ({ widget, range, position, model }, token) => {
      if (!widget.supportsFileReferences) {
        return null;
      }
      const result = { suggestions: [] };
      const afterRangeSym = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + "#sym:".length);
      result.suggestions.push({
        label: `${chatVariableLeader}sym`,
        insertText: `${chatVariableLeader}sym:`,
        documentation: localize("pickSymbolLabel", "Pick a symbol"),
        range,
        kind: CompletionItemKind.Text,
        command: { id: SelectAndInsertSymAction.ID, title: SelectAndInsertSymAction.ID, arguments: [{ widget, range: afterRangeSym }] },
        sortText: "z"
      });
      const range2 = computeCompletionRanges(model, position, new RegExp(`${chatVariableLeader}[^\\s]*`, "g"), true);
      if (range2) {
        this.addSymbolEntries(widget, result, range2, token);
      }
      return result;
    });
    this.registerVariableCompletions(SelectAndInsertProblemAction.Name, ({ widget, range, position, model }, token) => {
      const stats = markerService.getStatistics();
      if (!stats.errors && !stats.warnings) {
        return null;
      }
      const result = { suggestions: [] };
      const completedText = `${chatVariableLeader}${SelectAndInsertProblemAction.Name}:`;
      const afterTextRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + completedText.length);
      result.suggestions.push({
        label: `${chatVariableLeader}${SelectAndInsertProblemAction.Name}`,
        insertText: completedText,
        documentation: localize("pickProblemsLabel", "Problems in your workspace"),
        range,
        kind: CompletionItemKind.Text,
        command: { id: SelectAndInsertProblemAction.ID, title: SelectAndInsertProblemAction.ID, arguments: [{ widget, range: afterTextRange }] },
        sortText: "z"
      });
      return result;
    });
    this._register(CommandsRegistry.registerCommand(BuiltinDynamicCompletions.addReferenceCommand, (_services, arg) => this.cmdAddReference(arg)));
    this.queryBuilder = this.instantiationService.createInstance(QueryBuilder);
  }
  registerVariableCompletions(debugName, provider) {
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: `chatVarCompletions-${debugName}`,
      triggerCharacters: [chatVariableLeader],
      provideCompletionItems: async (model, position, context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
          return;
        }
        const range = computeCompletionRanges(model, position, BuiltinDynamicCompletions.VariableNameDef, true);
        if (range) {
          return provider({ model, position, widget, range, context }, token);
        }
        return;
      }
    }));
  }
  async addFileEntries(widget, result, info, token) {
    const makeFileCompletionItem = (resource, description) => {
      const basename = this.labelService.getUriBasenameLabel(resource);
      const text = `${chatVariableLeader}file:${basename}`;
      const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
      const labelDescription = description ? localize("fileEntryDescription", "{0} ({1})", uriLabel, description) : uriLabel;
      const sortText = description ? "z" : "{";
      return {
        label: { label: basename, description: labelDescription },
        filterText: `${chatVariableLeader}${basename}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: CompletionItemKind.File,
        sortText,
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: "vscode.file",
            prefix: "file",
            isFile: true,
            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
            data: resource
          })]
        }
      };
    };
    let pattern;
    if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const seen = new ResourceSet();
    const len = result.suggestions.length;
    if (widget.input.currentMode !== ChatMode.Ask && widget.viewModel && widget.viewModel.model.editingSession) {
      const relatedFiles = await raceTimeout(this._chatEditingService.getRelatedFiles(widget.viewModel.sessionId, widget.getInput(), widget.attachmentModel.fileAttachments, token), 200) ?? [];
      for (const relatedFileGroup of relatedFiles) {
        for (const relatedFile of relatedFileGroup.files) {
          if (seen.has(relatedFile.uri)) {
            continue;
          }
          seen.add(relatedFile.uri);
          result.suggestions.push(makeFileCompletionItem(relatedFile.uri, relatedFile.description));
        }
      }
    }
    for (const item of this.historyService.getHistory()) {
      if (!item.resource || !this.workspaceContextService.getWorkspaceFolder(item.resource)) {
        continue;
      }
      if (pattern) {
        const basename = this.labelService.getUriBasenameLabel(item.resource).toLowerCase();
        if (!isPatternInWord(pattern, 0, pattern.length, basename, 0, basename.length)) {
          continue;
        }
      }
      seen.add(item.resource);
      const newLen = result.suggestions.push(makeFileCompletionItem(item.resource));
      if (newLen - len >= 5) {
        break;
      }
    }
    if (pattern) {
      const cacheKey = this.updateCacheKey();
      const query = this.queryBuilder.file(this.workspaceContextService.getWorkspace().folders, {
        filePattern: pattern,
        sortByScore: true,
        maxResults: 250,
        cacheKey: cacheKey.key
      });
      const data = await this.searchService.fileSearch(query, token);
      for (const match of data.results) {
        if (seen.has(match.resource)) {
          continue;
        }
        result.suggestions.push(makeFileCompletionItem(match.resource));
      }
    }
    result.incomplete = true;
  }
  async addFolderEntries(widget, result, info, token) {
    const folderLeader = `${chatVariableLeader}folder:`;
    const makeFolderCompletionItem = (resource, description) => {
      const basename = this.labelService.getUriBasenameLabel(resource);
      const text = `${folderLeader}${basename}`;
      const uriLabel = this.labelService.getUriLabel(dirname(resource), { relative: true });
      const labelDescription = description ? localize("folderEntryDescription", "{0} ({1})", uriLabel, description) : uriLabel;
      const sortText = description ? "z" : "{";
      return {
        label: { label: basename, description: labelDescription },
        filterText: `${folderLeader}${basename}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: CompletionItemKind.Folder,
        sortText,
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: "vscode.folder",
            prefix: "folder",
            isFile: false,
            isDirectory: true,
            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
            data: resource
          })]
        }
      };
    };
    const seen = new ResourceSet();
    const workspaces = this.workspaceContextService.getWorkspace().folders.map((folder) => folder.uri);
    let pattern;
    if (info.varWord?.word && info.varWord.word.startsWith(folderLeader)) {
      pattern = info.varWord.word.toLowerCase().slice(folderLeader.length);
      for (const folder of await getTopLevelFolders(workspaces, this.fileService)) {
        result.suggestions.push(makeFolderCompletionItem(folder));
        seen.add(folder);
      }
    }
    if (pattern) {
      const cacheKey = this.updateCacheKey();
      const folders = await Promise.all(workspaces.map((workspace) => searchFolders(workspace, pattern, true, token, cacheKey.key, this.configurationService, this.searchService)));
      for (const resource of folders.flat()) {
        if (seen.has(resource)) {
          continue;
        }
        seen.add(resource);
        result.suggestions.push(makeFolderCompletionItem(resource));
      }
    }
    result.incomplete = true;
  }
  addSymbolEntries(widget, result, info, token) {
    const makeSymbolCompletionItem = (symbolItem, pattern2) => {
      const text = `${chatVariableLeader}sym:${symbolItem.name}`;
      const resource = symbolItem.location.uri;
      const uriLabel = this.labelService.getUriLabel(resource, { relative: true });
      const sortText = pattern2 ? "{" : "|";
      return {
        label: { label: symbolItem.name, description: uriLabel },
        filterText: `${chatVariableLeader}${symbolItem.name}`,
        insertText: info.varWord?.endColumn === info.replace.endColumn ? `${text} ` : text,
        range: info,
        kind: SymbolKinds.toCompletionKind(symbolItem.kind),
        sortText,
        command: {
          id: BuiltinDynamicCompletions.addReferenceCommand,
          title: "",
          arguments: [new ReferenceArgument(widget, {
            id: "vscode.symbol",
            prefix: "sym",
            fullName: symbolItem.name,
            range: { startLineNumber: info.replace.startLineNumber, startColumn: info.replace.startColumn, endLineNumber: info.replace.endLineNumber, endColumn: info.replace.startColumn + text.length },
            data: symbolItem.location
          })]
        }
      };
    };
    let pattern;
    if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const symbolsToAdd = [];
    for (const outlineModel of this.outlineService.getCachedModels()) {
      if (pattern) {
        symbolsToAdd.push(...outlineModel.asListOfDocumentSymbols().map((symbol) => ({ symbol, uri: outlineModel.uri })));
      } else {
        symbolsToAdd.push(...outlineModel.getTopLevelSymbols().map((symbol) => ({ symbol, uri: outlineModel.uri })));
      }
    }
    const symbolsToAddFiltered = symbolsToAdd.filter((fileSymbol) => {
      switch (fileSymbol.symbol.kind) {
        case SymbolKind.Enum:
        case SymbolKind.Class:
        case SymbolKind.Method:
        case SymbolKind.Function:
        case SymbolKind.Namespace:
        case SymbolKind.Module:
        case SymbolKind.Interface:
          return true;
        default:
          return false;
      }
    });
    for (const symbol of symbolsToAddFiltered) {
      result.suggestions.push(makeSymbolCompletionItem({ ...symbol.symbol, location: { uri: symbol.uri, range: symbol.symbol.range } }, pattern ?? ""));
    }
    result.incomplete = !!pattern;
  }
  updateCacheKey() {
    if (this.cacheKey && Date.now() - this.cacheKey.time > 6e4) {
      this.searchService.clearCache(this.cacheKey.key);
      this.cacheKey = void 0;
    }
    if (!this.cacheKey) {
      this.cacheKey = {
        key: generateUuid(),
        time: Date.now()
      };
    }
    this.cacheKey.time = Date.now();
    return this.cacheKey;
  }
  cmdAddReference(arg) {
    arg.widget.getContrib(ChatDynamicVariableModel.ID)?.addReference(arg.variable);
  }
};
BuiltinDynamicCompletions.addReferenceCommand = "_addReferenceCmd";
BuiltinDynamicCompletions.VariableNameDef = new RegExp(`${chatVariableLeader}[\\w:]*`, "g");
BuiltinDynamicCompletions = __decorateClass([
  __decorateParam(0, IHistoryService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, ISearchService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IChatEditingService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IOutlineModelService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IFileService),
  __decorateParam(12, IMarkerService)
], BuiltinDynamicCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(BuiltinDynamicCompletions, LifecyclePhase.Eventually);
function computeCompletionRanges(model, position, reg, onlyOnWordStart = false) {
  const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
  if (!varWord && model.getWordUntilPosition(position).word) {
    return;
  }
  if (!varWord && position.column > 1) {
    const textBefore = model.getValueInRange(new Range(position.lineNumber, position.column - 1, position.lineNumber, position.column));
    if (textBefore !== " ") {
      return;
    }
  }
  if (varWord && onlyOnWordStart) {
    const wordBefore = model.getWordUntilPosition({ lineNumber: position.lineNumber, column: varWord.startColumn });
    if (wordBefore.word) {
      return;
    }
  }
  let insert;
  let replace;
  if (!varWord) {
    insert = replace = Range.fromPositions(position);
  } else {
    insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
    replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
  }
  return { insert, replace, varWord };
}
function isEmptyUpToCompletionWord(model, rangeResult) {
  const startToCompletionWordStart = new Range(1, 1, rangeResult.replace.startLineNumber, rangeResult.replace.startColumn);
  return !!model.getValueInRange(startToCompletionWordStart).match(/^\s*$/);
}
let ToolCompletions = class extends Disposable {
  // MUST be using `g`-flag
  constructor(languageFeaturesService, chatWidgetService, toolsService) {
    super();
    this.languageFeaturesService = languageFeaturesService;
    this.chatWidgetService = chatWidgetService;
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatVariables",
      triggerCharacters: [chatVariableLeader],
      provideCompletionItems: async (model, position, _context, _token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget) {
          return null;
        }
        const range = computeCompletionRanges(model, position, ToolCompletions.VariableNameDef, true);
        if (!range) {
          return null;
        }
        const usedTools = widget.parsedInput.parts.filter((p) => p instanceof ChatRequestToolPart);
        const usedToolNames = new Set(usedTools.map((v) => v.toolName));
        const toolItems = [];
        toolItems.push(...Array.from(toolsService.getTools()).filter((t) => t.canBeReferencedInPrompt).filter((t) => !usedToolNames.has(t.toolReferenceName ?? "")).map((t) => {
          const withLeader = `${chatVariableLeader}${t.toolReferenceName}`;
          return {
            label: withLeader,
            range,
            insertText: withLeader + " ",
            documentation: t.userDescription,
            kind: CompletionItemKind.Text,
            sortText: "z"
          };
        }));
        return {
          suggestions: toolItems
        };
      }
    }));
  }
};
ToolCompletions.VariableNameDef = new RegExp(`(?<=^|\\s)${chatVariableLeader}\\w*`, "g");
ToolCompletions = __decorateClass([
  __decorateParam(0, ILanguageFeaturesService),
  __decorateParam(1, IChatWidgetService),
  __decorateParam(2, ILanguageModelToolsService)
], ToolCompletions);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ToolCompletions, LifecyclePhase.Eventually);
export {
  computeCompletionRanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW5wdXRDb21wbGV0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGNvYWxlc2NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IHJhY2VUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNQYXR0ZXJuSW5Xb3JkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgaXNDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJV29yZEF0UG9zaXRpb24sIGdldFdvcmRBdFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uQ29udGV4dCwgQ29tcGxldGlvbkl0ZW0sIENvbXBsZXRpb25JdGVtS2luZCwgQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgQ29tcGxldGlvbkxpc3QsIERvY3VtZW50U3ltYm9sLCBMb2NhdGlvbiwgUHJvdmlkZXJSZXN1bHQsIFN5bWJvbEtpbmQsIFN5bWJvbEtpbmRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElPdXRsaW5lTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZG9jdW1lbnRTeW1ib2xzL2Jyb3dzZXIvb3V0bGluZU1vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSU1hcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIaXN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2hpc3RvcnkvY29tbW9uL2hpc3RvcnkuanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBRdWVyeUJ1aWxkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3F1ZXJ5QnVpbGRlci5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50TmFtZVNlcnZpY2UsIElDaGF0QWdlbnRTZXJ2aWNlLCBnZXRGdWxseVF1YWxpZmllZElkIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFJlcXVlc3RBZ2VudFBhcnQsIENoYXRSZXF1ZXN0QWdlbnRTdWJjb21tYW5kUGFydCwgQ2hhdFJlcXVlc3RUZXh0UGFydCwgQ2hhdFJlcXVlc3RUb29sUGFydCwgY2hhdEFnZW50TGVhZGVyLCBjaGF0U3ViY29tbWFuZExlYWRlciwgY2hhdFZhcmlhYmxlTGVhZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNsYXNoQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUR5bmFtaWNWYXJpYWJsZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uLCBDaGF0TW9kZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdGluZ1Nlc3Npb25TdWJtaXRBY3Rpb24sIENoYXRTdWJtaXRBY3Rpb24gfSBmcm9tICcuLi9hY3Rpb25zL2NoYXRFeGVjdXRlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0SW5wdXRQYXJ0IH0gZnJvbSAnLi4vY2hhdElucHV0UGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwsIFNlbGVjdEFuZEluc2VydEZpbGVBY3Rpb24sIFNlbGVjdEFuZEluc2VydEZvbGRlckFjdGlvbiwgU2VsZWN0QW5kSW5zZXJ0UHJvYmxlbUFjdGlvbiwgU2VsZWN0QW5kSW5zZXJ0U3ltQWN0aW9uLCBnZXRUb3BMZXZlbEZvbGRlcnMsIHNlYXJjaEZvbGRlcnMgfSBmcm9tICcuL2NoYXREeW5hbWljVmFyaWFibGVzLmpzJztcblxuY2xhc3MgU2xhc2hDb21tYW5kQ29tcGxldGlvbnMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElDaGF0V2lkZ2V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRXaWRnZXRTZXJ2aWNlOiBJQ2hhdFdpZGdldFNlcnZpY2UsXG5cdFx0QElDaGF0U2xhc2hDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlOiBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdnbG9iYWxTbGFzaENvbW1hbmRzJyxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbJy8nXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBfY29udGV4dDogQ29tcGxldGlvbkNvbnRleHQsIF90b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IHtcblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeUlucHV0VXJpKG1vZGVsLnVyaSk7XG5cdFx0XHRcdGlmICghd2lkZ2V0IHx8ICF3aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgL1xcL1xcdyovZyk7XG5cdFx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghaXNFbXB0eVVwVG9Db21wbGV0aW9uV29yZChtb2RlbCwgcmFuZ2UpKSB7XG5cdFx0XHRcdFx0Ly8gTm8gdGV4dCBhbGxvd2VkIGJlZm9yZSB0aGUgY29tcGxldGlvblxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHBhcnNlZFJlcXVlc3QgPSB3aWRnZXQucGFyc2VkSW5wdXQucGFydHM7XG5cdFx0XHRcdGNvbnN0IHVzZWRBZ2VudCA9IHBhcnNlZFJlcXVlc3QuZmluZChwID0+IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50UGFydCk7XG5cdFx0XHRcdGlmICh1c2VkQWdlbnQpIHtcblx0XHRcdFx0XHQvLyBObyAoY2xhc3NpYykgZ2xvYmFsIHNsYXNoIGNvbW1hbmRzIHdoZW4gYW4gYWdlbnQgaXMgdXNlZFxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHNsYXNoQ29tbWFuZHMgPSB0aGlzLmNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLmdldENvbW1hbmRzKHdpZGdldC5sb2NhdGlvbiwgd2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlKTtcblx0XHRcdFx0aWYgKCFzbGFzaENvbW1hbmRzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBzbGFzaENvbW1hbmRzLm1hcCgoYywgaSk6IENvbXBsZXRpb25JdGVtID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHdpdGhTbGFzaCA9IGAvJHtjLmNvbW1hbmR9YDtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiB3aXRoU2xhc2gsXG5cdFx0XHRcdFx0XHRcdGluc2VydFRleHQ6IGMuZXhlY3V0ZUltbWVkaWF0ZWx5ID8gJycgOiBgJHt3aXRoU2xhc2h9IGAsXG5cdFx0XHRcdFx0XHRcdGRvY3VtZW50YXRpb246IGMuZGV0YWlsLFxuXHRcdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdFx0c29ydFRleHQ6IGMuc29ydFRleHQgPz8gJ2EnLnJlcGVhdChpICsgMSksXG5cdFx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LCAvLyBUaGUgaWNvbnMgYXJlIGRpc2FibGVkIGhlcmUgYW55d2F5LFxuXHRcdFx0XHRcdFx0XHRjb21tYW5kOiBjLmV4ZWN1dGVJbW1lZGlhdGVseSA/IHsgaWQ6IHdpZGdldC5sb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24gPyBDaGF0RWRpdGluZ1Nlc3Npb25TdWJtaXRBY3Rpb24uSUQgOiBDaGF0U3VibWl0QWN0aW9uLklELCB0aXRsZTogd2l0aFNsYXNoLCBhcmd1bWVudHM6IFt7IHdpZGdldCwgaW5wdXRWYWx1ZTogYCR7d2l0aFNsYXNofSBgIH1dIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdnbG9iYWxTbGFzaENvbW1hbmRzQXQnLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFtjaGF0QWdlbnRMZWFkZXJdLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIF9jb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dCwgX3Rva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdFx0aWYgKCF3aWRnZXQgfHwgIXdpZGdldC52aWV3TW9kZWwpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWwsIHBvc2l0aW9uLCAvQFxcdyovZyk7XG5cdFx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghaXNFbXB0eVVwVG9Db21wbGV0aW9uV29yZChtb2RlbCwgcmFuZ2UpKSB7XG5cdFx0XHRcdFx0Ly8gTm8gdGV4dCBhbGxvd2VkIGJlZm9yZSB0aGUgY29tcGxldGlvblxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHNsYXNoQ29tbWFuZHMgPSB0aGlzLmNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLmdldENvbW1hbmRzKHdpZGdldC5sb2NhdGlvbiwgd2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlKTtcblx0XHRcdFx0aWYgKCFzbGFzaENvbW1hbmRzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBzbGFzaENvbW1hbmRzLm1hcCgoYywgaSk6IENvbXBsZXRpb25JdGVtID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHdpdGhTbGFzaCA9IGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7Yy5jb21tYW5kfWA7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogd2l0aFNsYXNoLFxuXHRcdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBjLmV4ZWN1dGVJbW1lZGlhdGVseSA/ICcnIDogYCR7d2l0aFNsYXNofSBgLFxuXHRcdFx0XHRcdFx0XHRkb2N1bWVudGF0aW9uOiBjLmRldGFpbCxcblx0XHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRcdGZpbHRlclRleHQ6IGAke2NoYXRBZ2VudExlYWRlcn0ke2MuY29tbWFuZH1gLFxuXHRcdFx0XHRcdFx0XHRzb3J0VGV4dDogYy5zb3J0VGV4dCA/PyAneicucmVwZWF0KGkgKyAxKSxcblx0XHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsIC8vIFRoZSBpY29ucyBhcmUgZGlzYWJsZWQgaGVyZSBhbnl3YXksXG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IGMuZXhlY3V0ZUltbWVkaWF0ZWx5ID8geyBpZDogd2lkZ2V0LmxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiA/IENoYXRFZGl0aW5nU2Vzc2lvblN1Ym1pdEFjdGlvbi5JRCA6IENoYXRTdWJtaXRBY3Rpb24uSUQsIHRpdGxlOiB3aXRoU2xhc2gsIGFyZ3VtZW50czogW3sgd2lkZ2V0LCBpbnB1dFZhbHVlOiBgJHt3aXRoU2xhc2h9IGAgfV0gfSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFNsYXNoQ29tbWFuZENvbXBsZXRpb25zLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxuY2xhc3MgQWdlbnRDb21wbGV0aW9ucyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUNoYXRBZ2VudE5hbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50TmFtZVNlcnZpY2U6IElDaGF0QWdlbnROYW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXG5cdFx0Y29uc3Qgc3ViQ29tbWFuZFByb3ZpZGVyOiBDb21wbGV0aW9uSXRlbVByb3ZpZGVyID0ge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdjaGF0QWdlbnRTdWJjb21tYW5kJyxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbJy8nXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBfY29udGV4dDogQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdFx0aWYgKCF3aWRnZXQgfHwgIXdpZGdldC52aWV3TW9kZWwpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgL1xcL1xcdyovZyk7XG5cdFx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHBhcnNlZFJlcXVlc3QgPSB3aWRnZXQucGFyc2VkSW5wdXQucGFydHM7XG5cdFx0XHRcdGNvbnN0IHVzZWRBZ2VudElkeCA9IHBhcnNlZFJlcXVlc3QuZmluZEluZGV4KChwKTogcCBpcyBDaGF0UmVxdWVzdEFnZW50UGFydCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RBZ2VudFBhcnQpO1xuXHRcdFx0XHRpZiAodXNlZEFnZW50SWR4IDwgMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHVzZWRTdWJjb21tYW5kID0gcGFyc2VkUmVxdWVzdC5maW5kKHAgPT4gcCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRTdWJjb21tYW5kUGFydCk7XG5cdFx0XHRcdGlmICh1c2VkU3ViY29tbWFuZCkge1xuXHRcdFx0XHRcdC8vIE9ubHkgb25lIGFsbG93ZWRcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IHBhcnRBZnRlckFnZW50IG9mIHBhcnNlZFJlcXVlc3Quc2xpY2UodXNlZEFnZW50SWR4ICsgMSkpIHtcblx0XHRcdFx0XHQvLyBDb3VsZCBhbGxvdyB0ZXh0IGFmdGVyICdwb3NpdGlvbidcblx0XHRcdFx0XHRpZiAoIShwYXJ0QWZ0ZXJBZ2VudCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0VGV4dFBhcnQpIHx8ICFwYXJ0QWZ0ZXJBZ2VudC50ZXh0LnRyaW0oKS5tYXRjaCgvXihcXC9cXHcqKT8kLykpIHtcblx0XHRcdFx0XHRcdC8vIE5vIHRleHQgYWxsb3dlZCBiZXR3ZWVuIGFnZW50IGFuZCBzdWJjb21tYW5kXG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdXNlZEFnZW50ID0gcGFyc2VkUmVxdWVzdFt1c2VkQWdlbnRJZHhdIGFzIENoYXRSZXF1ZXN0QWdlbnRQYXJ0O1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiB1c2VkQWdlbnQuYWdlbnQuc2xhc2hDb21tYW5kcy5tYXAoKGMsIGkpOiBDb21wbGV0aW9uSXRlbSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCB3aXRoU2xhc2ggPSBgLyR7Yy5uYW1lfWA7XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogd2l0aFNsYXNoLFxuXHRcdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBgJHt3aXRoU2xhc2h9IGAsXG5cdFx0XHRcdFx0XHRcdGRvY3VtZW50YXRpb246IGMuZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCwgLy8gVGhlIGljb25zIGFyZSBkaXNhYmxlZCBoZXJlIGFueXdheVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6IENoYXRJbnB1dFBhcnQuSU5QVVRfU0NIRU1FLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCBzdWJDb21tYW5kUHJvdmlkZXIpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdjaGF0QWdlbnRBbmRTdWJjb21tYW5kJyxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbY2hhdEFnZW50TGVhZGVyXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBfY29udGV4dDogQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdFx0Y29uc3Qgdmlld01vZGVsID0gd2lkZ2V0Py52aWV3TW9kZWw7XG5cdFx0XHRcdGlmICghd2lkZ2V0IHx8ICF2aWV3TW9kZWwgfHwgd2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlICE9PSBDaGF0TW9kZS5Bc2spIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgLyhAfFxcLylcXHcqL2cpO1xuXHRcdFx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWlzRW1wdHlVcFRvQ29tcGxldGlvbldvcmQobW9kZWwsIHJhbmdlKSkge1xuXHRcdFx0XHRcdC8vIE5vIHRleHQgYWxsb3dlZCBiZWZvcmUgdGhlIGNvbXBsZXRpb25cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhZ2VudHMgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRzKClcblx0XHRcdFx0XHQuZmlsdGVyKGEgPT4gYS5sb2NhdGlvbnMuaW5jbHVkZXMod2lkZ2V0LmxvY2F0aW9uKSk7XG5cblx0XHRcdFx0Ly8gV2hlbiB0aGUgaW5wdXQgaXMgb25seSBgL2AsIGl0ZW1zIGFyZSBzb3J0ZWQgYnkgc29ydFRleHQuXG5cdFx0XHRcdC8vIFdoZW4gdHlwaW5nLCBmaWx0ZXJUZXh0IGlzIHVzZWQgdG8gc2NvcmUgYW5kIHNvcnQuXG5cdFx0XHRcdC8vIFRoZSBzYW1lIGxpc3QgaXMgcmVmaWx0ZXJlZC9yYW5rZWQgd2hpbGUgdHlwaW5nLlxuXHRcdFx0XHRjb25zdCBnZXRGaWx0ZXJUZXh0ID0gKGFnZW50OiBJQ2hhdEFnZW50RGF0YSwgY29tbWFuZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Ly8gVGhpcyBpcyBoYWNraW5nIHRoZSBmaWx0ZXIgYWxnb3JpdGhtIHRvIG1ha2UgQHRlcm1pbmFsIC9leHBsYWluIG1hdGNoIHdvcnNlIHRoYW4gQHdvcmtzcGFjZSAvZXhwbGFpbiBieSBtYWtpbmcgaXRzIG1hdGNoIGluZGV4IGxhdGVyIGluIHRoZSBzdHJpbmcuXG5cdFx0XHRcdFx0Ly8gV2hlbiBJIHR5cGUgYC9leHBgLCB0aGUgd29ya3NwYWNlIG9uZSBzaG91bGQgYmUgc29ydGVkIG92ZXIgdGhlIHRlcm1pbmFsIG9uZS5cblx0XHRcdFx0XHRjb25zdCBkdW1teVByZWZpeCA9IGFnZW50LmlkID09PSAnZ2l0aHViLmNvcGlsb3QudGVybWluYWxQYW5lbCcgPyBgMDAwMGAgOiBgYDtcblx0XHRcdFx0XHRyZXR1cm4gYCR7Y2hhdEFnZW50TGVhZGVyfSR7ZHVtbXlQcmVmaXh9JHthZ2VudC5uYW1lfS4ke2NvbW1hbmR9YDtcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRjb25zdCBqdXN0QWdlbnRzOiBDb21wbGV0aW9uSXRlbVtdID0gYWdlbnRzXG5cdFx0XHRcdFx0LmZpbHRlcihhID0+ICFhLmlzRGVmYXVsdClcblx0XHRcdFx0XHQubWFwKGFnZW50ID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgbGFiZWw6IGFnZW50TGFiZWwsIGlzRHVwZSB9ID0gdGhpcy5nZXRBZ2VudENvbXBsZXRpb25EZXRhaWxzKGFnZW50KTtcblx0XHRcdFx0XHRcdGNvbnN0IGRldGFpbCA9IGFnZW50LmRlc2NyaXB0aW9uO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogaXNEdXBlID9cblx0XHRcdFx0XHRcdFx0XHR7IGxhYmVsOiBhZ2VudExhYmVsLCBkZXNjcmlwdGlvbjogYWdlbnQuZGVzY3JpcHRpb24sIGRldGFpbDogYCAoJHthZ2VudC5wdWJsaXNoZXJEaXNwbGF5TmFtZX0pYCB9IDpcblx0XHRcdFx0XHRcdFx0XHRhZ2VudExhYmVsLFxuXHRcdFx0XHRcdFx0XHRkb2N1bWVudGF0aW9uOiBkZXRhaWwsXG5cdFx0XHRcdFx0XHRcdGZpbHRlclRleHQ6IGAke2NoYXRBZ2VudExlYWRlcn0ke2FnZW50Lm5hbWV9YCxcblx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogYCR7YWdlbnRMYWJlbH0gYCxcblx0XHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0XHRzb3J0VGV4dDogYCR7Y2hhdEFnZW50TGVhZGVyfSR7YWdlbnQubmFtZX1gLFxuXHRcdFx0XHRcdFx0XHRjb21tYW5kOiB7IGlkOiBBc3NpZ25TZWxlY3RlZEFnZW50QWN0aW9uLklELCB0aXRsZTogQXNzaWduU2VsZWN0ZWRBZ2VudEFjdGlvbi5JRCwgYXJndW1lbnRzOiBbeyBhZ2VudCwgd2lkZ2V0IH0gc2F0aXNmaWVzIEFzc2lnblNlbGVjdGVkQWdlbnRBY3Rpb25BcmdzXSB9LFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiBqdXN0QWdlbnRzLmNvbmNhdChcblx0XHRcdFx0XHRcdGNvYWxlc2NlKGFnZW50cy5mbGF0TWFwKGFnZW50ID0+IGFnZW50LnNsYXNoQ29tbWFuZHMubWFwKChjLCBpKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChhZ2VudC5pc0RlZmF1bHQgJiYgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudCh3aWRnZXQubG9jYXRpb24sIHdpZGdldC5pbnB1dC5jdXJyZW50TW9kZSk/LmlkICE9PSBhZ2VudC5pZCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IHsgbGFiZWw6IGFnZW50TGFiZWwsIGlzRHVwZSB9ID0gdGhpcy5nZXRBZ2VudENvbXBsZXRpb25EZXRhaWxzKGFnZW50KTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBgJHthZ2VudExhYmVsfSAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7Yy5uYW1lfWA7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IENvbXBsZXRpb25JdGVtID0ge1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBpc0R1cGUgP1xuXHRcdFx0XHRcdFx0XHRcdFx0eyBsYWJlbCwgZGVzY3JpcHRpb246IGMuZGVzY3JpcHRpb24sIGRldGFpbDogaXNEdXBlID8gYCAoJHthZ2VudC5wdWJsaXNoZXJEaXNwbGF5TmFtZX0pYCA6IHVuZGVmaW5lZCB9IDpcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdGRvY3VtZW50YXRpb246IGMuZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0XHRcdFx0ZmlsdGVyVGV4dDogZ2V0RmlsdGVyVGV4dChhZ2VudCwgYy5uYW1lKSxcblx0XHRcdFx0XHRcdFx0XHRjb21taXRDaGFyYWN0ZXJzOiBbJyAnXSxcblx0XHRcdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBsYWJlbCArICcgJyxcblx0XHRcdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCwgLy8gVGhlIGljb25zIGFyZSBkaXNhYmxlZCBoZXJlIGFueXdheVxuXHRcdFx0XHRcdFx0XHRcdHNvcnRUZXh0OiBgeCR7Y2hhdEFnZW50TGVhZGVyfSR7YWdlbnQubmFtZX0ke2MubmFtZX1gLFxuXHRcdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IEFzc2lnblNlbGVjdGVkQWdlbnRBY3Rpb24uSUQsIHRpdGxlOiBBc3NpZ25TZWxlY3RlZEFnZW50QWN0aW9uLklELCBhcmd1bWVudHM6IFt7IGFnZW50LCB3aWRnZXQgfSBzYXRpc2ZpZXMgQXNzaWduU2VsZWN0ZWRBZ2VudEFjdGlvbkFyZ3NdIH0sXG5cdFx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdFx0aWYgKGFnZW50LmlzRGVmYXVsdCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGRlZmF1bHQgYWdlbnQgaXNuJ3QgbWVudGlvbmVkIG5vciBpbnNlcnRlZFxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gYCR7Y2hhdFN1YmNvbW1hbmRMZWFkZXJ9JHtjLm5hbWV9YDtcblx0XHRcdFx0XHRcdFx0XHRpdGVtLmxhYmVsID0gbGFiZWw7XG5cdFx0XHRcdFx0XHRcdFx0aXRlbS5pbnNlcnRUZXh0ID0gYCR7bGFiZWx9IGA7XG5cdFx0XHRcdFx0XHRcdFx0aXRlbS5kb2N1bWVudGF0aW9uID0gYy5kZXNjcmlwdGlvbjtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHRcdFx0fSkpKSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogQ2hhdElucHV0UGFydC5JTlBVVF9TQ0hFTUUsIGhhc0FjY2Vzc1RvQWxsTW9kZWxzOiB0cnVlIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAnY2hhdEFnZW50QW5kU3ViY29tbWFuZCcsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogW2NoYXRTdWJjb21tYW5kTGVhZGVyXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBfY29udGV4dDogQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldEJ5SW5wdXRVcmkobW9kZWwudXJpKTtcblx0XHRcdFx0Y29uc3Qgdmlld01vZGVsID0gd2lkZ2V0Py52aWV3TW9kZWw7XG5cdFx0XHRcdGlmICghd2lkZ2V0IHx8ICF2aWV3TW9kZWwgfHwgd2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlICE9PSBDaGF0TW9kZS5Bc2spIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgLyhAfFxcLylcXHcqL2cpO1xuXHRcdFx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWlzRW1wdHlVcFRvQ29tcGxldGlvbldvcmQobW9kZWwsIHJhbmdlKSkge1xuXHRcdFx0XHRcdC8vIE5vIHRleHQgYWxsb3dlZCBiZWZvcmUgdGhlIGNvbXBsZXRpb25cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhZ2VudHMgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRzKClcblx0XHRcdFx0XHQuZmlsdGVyKGEgPT4gYS5sb2NhdGlvbnMuaW5jbHVkZXMod2lkZ2V0LmxvY2F0aW9uKSk7XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRzdWdnZXN0aW9uczogY29hbGVzY2UoYWdlbnRzLmZsYXRNYXAoYWdlbnQgPT4gYWdlbnQuc2xhc2hDb21tYW5kcy5tYXAoKGMsIGkpID0+IHtcblx0XHRcdFx0XHRcdGlmIChhZ2VudC5pc0RlZmF1bHQgJiYgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudCh3aWRnZXQubG9jYXRpb24sIHdpZGdldC5pbnB1dC5jdXJyZW50TW9kZSk/LmlkICE9PSBhZ2VudC5pZCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IHsgbGFiZWw6IGFnZW50TGFiZWwsIGlzRHVwZSB9ID0gdGhpcy5nZXRBZ2VudENvbXBsZXRpb25EZXRhaWxzKGFnZW50KTtcblx0XHRcdFx0XHRcdGNvbnN0IHdpdGhTbGFzaCA9IGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7Yy5uYW1lfWA7XG5cdFx0XHRcdFx0XHRjb25zdCBleHRyYVNvcnRUZXh0ID0gYWdlbnQuaWQgPT09ICdnaXRodWIuY29waWxvdC50ZXJtaW5hbFBhbmVsJyA/IGB6YCA6IGBgO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc29ydFRleHQgPSBgJHtjaGF0U3ViY29tbWFuZExlYWRlcn0ke2V4dHJhU29ydFRleHR9JHthZ2VudC5uYW1lfSR7Yy5uYW1lfWA7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBDb21wbGV0aW9uSXRlbSA9IHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IHdpdGhTbGFzaCwgZGVzY3JpcHRpb246IGFnZW50TGFiZWwsIGRldGFpbDogaXNEdXBlID8gYCAoJHthZ2VudC5wdWJsaXNoZXJEaXNwbGF5TmFtZX0pYCA6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRcdFx0XHRjb21taXRDaGFyYWN0ZXJzOiBbJyAnXSxcblx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogYCR7YWdlbnRMYWJlbH0gJHt3aXRoU2xhc2h9IGAsXG5cdFx0XHRcdFx0XHRcdGRvY3VtZW50YXRpb246IGAoJHthZ2VudExhYmVsfSkgJHtjLmRlc2NyaXB0aW9uID8/ICcnfWAsXG5cdFx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCwgLy8gVGhlIGljb25zIGFyZSBkaXNhYmxlZCBoZXJlIGFueXdheVxuXHRcdFx0XHRcdFx0XHRzb3J0VGV4dCxcblx0XHRcdFx0XHRcdFx0Y29tbWFuZDogeyBpZDogQXNzaWduU2VsZWN0ZWRBZ2VudEFjdGlvbi5JRCwgdGl0bGU6IEFzc2lnblNlbGVjdGVkQWdlbnRBY3Rpb24uSUQsIGFyZ3VtZW50czogW3sgYWdlbnQsIHdpZGdldCB9IHNhdGlzZmllcyBBc3NpZ25TZWxlY3RlZEFnZW50QWN0aW9uQXJnc10gfSxcblx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdGlmIChhZ2VudC5pc0RlZmF1bHQpIHtcblx0XHRcdFx0XHRcdFx0Ly8gZGVmYXVsdCBhZ2VudCBpc24ndCBtZW50aW9uZWQgbm9yIGluc2VydGVkXG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gYCR7Y2hhdFN1YmNvbW1hbmRMZWFkZXJ9JHtjLm5hbWV9YDtcblx0XHRcdFx0XHRcdFx0aXRlbS5sYWJlbCA9IGxhYmVsO1xuXHRcdFx0XHRcdFx0XHRpdGVtLmluc2VydFRleHQgPSBgJHtsYWJlbH0gYDtcblx0XHRcdFx0XHRcdFx0aXRlbS5kb2N1bWVudGF0aW9uID0gYy5kZXNjcmlwdGlvbjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHRcdFx0fSkpKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6ICdpbnN0YWxsQ2hhdEV4dGVuc2lvbnMnLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFtjaGF0QWdlbnRMZWFkZXJdLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIF9jb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGlmICghbW9kZWwuZ2V0TGluZUNvbnRlbnQoMSkuc3RhcnRzV2l0aChjaGF0QWdlbnRMZWFkZXIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeUlucHV0VXJpKG1vZGVsLnVyaSk7XG5cdFx0XHRcdGlmICh3aWRnZXQ/LmxvY2F0aW9uICE9PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCB8fCB3aWRnZXQuaW5wdXQuY3VycmVudE1vZGUgIT09IENoYXRNb2RlLkFzaykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWwsIHBvc2l0aW9uLCAvKEB8XFwvKVxcdyovZyk7XG5cdFx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWlzRW1wdHlVcFRvQ29tcGxldGlvbldvcmQobW9kZWwsIHJhbmdlKSkge1xuXHRcdFx0XHRcdC8vIE5vIHRleHQgYWxsb3dlZCBiZWZvcmUgdGhlIGNvbXBsZXRpb25cblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBsYWJlbCA9IGxvY2FsaXplKCdpbnN0YWxsTGFiZWwnLCBcIkluc3RhbGwgQ2hhdCBFeHRlbnNpb25zLi4uXCIpO1xuXHRcdFx0XHRjb25zdCBpdGVtOiBDb21wbGV0aW9uSXRlbSA9IHtcblx0XHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0XHRpbnNlcnRUZXh0OiAnJyxcblx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCwgLy8gVGhlIGljb25zIGFyZSBkaXNhYmxlZCBoZXJlIGFueXdheVxuXHRcdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5zZWFyY2gnLCB0aXRsZTogJycsIGFyZ3VtZW50czogWydAdGFnOmNoYXQtcGFydGljaXBhbnQnXSB9LFxuXHRcdFx0XHRcdGZpbHRlclRleHQ6IGNoYXRBZ2VudExlYWRlciArIGxhYmVsLFxuXHRcdFx0XHRcdHNvcnRUZXh0OiAnenp6J1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IFtpdGVtXVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0QWdlbnRDb21wbGV0aW9uRGV0YWlscyhhZ2VudDogSUNoYXRBZ2VudERhdGEpOiB7IGxhYmVsOiBzdHJpbmc7IGlzRHVwZTogYm9vbGVhbiB9IHtcblx0XHRjb25zdCBpc0FsbG93ZWQgPSB0aGlzLmNoYXRBZ2VudE5hbWVTZXJ2aWNlLmdldEFnZW50TmFtZVJlc3RyaWN0aW9uKGFnZW50KTtcblx0XHRjb25zdCBhZ2VudExhYmVsID0gYCR7Y2hhdEFnZW50TGVhZGVyfSR7aXNBbGxvd2VkID8gYWdlbnQubmFtZSA6IGdldEZ1bGx5UXVhbGlmaWVkSWQoYWdlbnQpfWA7XG5cdFx0Y29uc3QgaXNEdXBlID0gaXNBbGxvd2VkICYmIHRoaXMuY2hhdEFnZW50U2VydmljZS5hZ2VudEhhc0R1cGVOYW1lKGFnZW50LmlkKTtcblx0XHRyZXR1cm4geyBsYWJlbDogYWdlbnRMYWJlbCwgaXNEdXBlIH07XG5cdH1cbn1cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihBZ2VudENvbXBsZXRpb25zLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxuaW50ZXJmYWNlIEFzc2lnblNlbGVjdGVkQWdlbnRBY3Rpb25BcmdzIHtcblx0YWdlbnQ6IElDaGF0QWdlbnREYXRhO1xuXHR3aWRnZXQ6IElDaGF0V2lkZ2V0O1xufVxuXG5jbGFzcyBBc3NpZ25TZWxlY3RlZEFnZW50QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXNzaWduU2VsZWN0ZWRBZ2VudCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFzc2lnblNlbGVjdGVkQWdlbnRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogJycgLy8gbm90IGRpc3BsYXllZFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IGFyZzogQXNzaWduU2VsZWN0ZWRBZ2VudEFjdGlvbkFyZ3MgPSBhcmdzWzBdO1xuXHRcdGlmICghYXJnIHx8ICFhcmcud2lkZ2V0IHx8ICFhcmcuYWdlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhcmcud2lkZ2V0Lmxhc3RTZWxlY3RlZEFnZW50ID0gYXJnLmFnZW50O1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQXNzaWduU2VsZWN0ZWRBZ2VudEFjdGlvbik7XG5cblxuY2xhc3MgUmVmZXJlbmNlQXJndW1lbnQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSB3aWRnZXQ6IElDaGF0V2lkZ2V0LFxuXHRcdHJlYWRvbmx5IHZhcmlhYmxlOiBJRHluYW1pY1ZhcmlhYmxlXG5cdCkgeyB9XG59XG5cbmludGVyZmFjZSBJVmFyaWFibGVDb21wbGV0aW9uc0RldGFpbHMge1xuXHRtb2RlbDogSVRleHRNb2RlbDtcblx0cG9zaXRpb246IFBvc2l0aW9uO1xuXHRjb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dDtcblx0d2lkZ2V0OiBJQ2hhdFdpZGdldDtcblx0cmFuZ2U6IElDaGF0Q29tcGxldGlvblJhbmdlUmVzdWx0O1xufVxuXG5jbGFzcyBCdWlsdGluRHluYW1pY0NvbXBsZXRpb25zIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IGFkZFJlZmVyZW5jZUNvbW1hbmQgPSAnX2FkZFJlZmVyZW5jZUNtZCc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFZhcmlhYmxlTmFtZURlZiA9IG5ldyBSZWdFeHAoYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfVtcXFxcdzpdKmAsICdnJyk7IC8vIE1VU1QgYmUgdXNpbmcgYGdgLWZsYWdcblxuXHRwcml2YXRlIHJlYWRvbmx5IHF1ZXJ5QnVpbGRlcjogUXVlcnlCdWlsZGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSGlzdG9yeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBoaXN0b3J5U2VydmljZTogSUhpc3RvcnlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJU2VhcmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNlYXJjaFNlcnZpY2U6IElTZWFyY2hTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJQ2hhdEVkaXRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRFZGl0aW5nU2VydmljZTogSUNoYXRFZGl0aW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU91dGxpbmVNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvdXRsaW5lU2VydmljZTogSU91dGxpbmVNb2RlbFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIG1hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gRmlsZSBjb21wbGV0aW9uc1xuXHRcdHRoaXMucmVnaXN0ZXJWYXJpYWJsZUNvbXBsZXRpb25zKCdmaWxlJywgYXN5bmMgKHsgd2lkZ2V0LCByYW5nZSwgcG9zaXRpb24sIG1vZGVsIH0sIHRva2VuKSA9PiB7XG5cdFx0XHRpZiAoIXdpZGdldC5zdXBwb3J0c0ZpbGVSZWZlcmVuY2VzKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQ6IENvbXBsZXRpb25MaXN0ID0geyBzdWdnZXN0aW9uczogW10gfTtcblxuXHRcdFx0Y29uc3QgYWZ0ZXJSYW5nZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uICsgJyNmaWxlOicubGVuZ3RoKTtcblx0XHRcdHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn1maWxlYCxcblx0XHRcdFx0aW5zZXJ0VGV4dDogYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfWZpbGU6YCxcblx0XHRcdFx0ZG9jdW1lbnRhdGlvbjogbG9jYWxpemUoJ3BpY2tGaWxlTGFiZWwnLCBcIlBpY2sgYSBmaWxlXCIpLFxuXHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IFNlbGVjdEFuZEluc2VydEZpbGVBY3Rpb24uSUQsIHRpdGxlOiBTZWxlY3RBbmRJbnNlcnRGaWxlQWN0aW9uLklELCBhcmd1bWVudHM6IFt7IHdpZGdldCwgcmFuZ2U6IGFmdGVyUmFuZ2UgfV0gfSxcblx0XHRcdFx0c29ydFRleHQ6ICd6J1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlMiA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgbmV3IFJlZ0V4cChgJHtjaGF0VmFyaWFibGVMZWFkZXJ9W15cXFxcc10qYCwgJ2cnKSwgdHJ1ZSk7XG5cdFx0XHRpZiAocmFuZ2UyKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYWRkRmlsZUVudHJpZXMod2lkZ2V0LCByZXN1bHQsIHJhbmdlMiwgdG9rZW4pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pO1xuXG5cdFx0Ly8gRm9sZGVyIGNvbXBsZXRpb25zXG5cdFx0dGhpcy5yZWdpc3RlclZhcmlhYmxlQ29tcGxldGlvbnMoJ2ZvbGRlcicsIGFzeW5jICh7IHdpZGdldCwgcmFuZ2UsIHBvc2l0aW9uLCBtb2RlbCB9LCB0b2tlbikgPT4ge1xuXHRcdFx0aWYgKCF3aWRnZXQuc3VwcG9ydHNGaWxlUmVmZXJlbmNlcykge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVzdWx0OiBDb21wbGV0aW9uTGlzdCA9IHsgc3VnZ2VzdGlvbnM6IFtdIH07XG5cblx0XHRcdGNvbnN0IGFmdGVyUmFuZ2UgPSBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcmFuZ2UucmVwbGFjZS5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcmFuZ2UucmVwbGFjZS5zdGFydENvbHVtbiArICcjZm9sZGVyOicubGVuZ3RoKTtcblx0XHRcdHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn1mb2xkZXJgLFxuXHRcdFx0XHRpbnNlcnRUZXh0OiBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9Zm9sZGVyOmAsXG5cdFx0XHRcdGRvY3VtZW50YXRpb246IGxvY2FsaXplKCdwaWNrRm9sZGVyTGFiZWwnLCBcIlBpY2sgYSBmb2xkZXJcIiksXG5cdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVGV4dCxcblx0XHRcdFx0Y29tbWFuZDogeyBpZDogU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uLklELCB0aXRsZTogU2VsZWN0QW5kSW5zZXJ0Rm9sZGVyQWN0aW9uLklELCBhcmd1bWVudHM6IFt7IHdpZGdldCwgcmFuZ2U6IGFmdGVyUmFuZ2UgfV0gfSxcblx0XHRcdFx0c29ydFRleHQ6ICd6J1xuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHJhbmdlMiA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgbmV3IFJlZ0V4cChgJHtjaGF0VmFyaWFibGVMZWFkZXJ9W15cXFxcc10qYCwgJ2cnKSwgdHJ1ZSk7XG5cdFx0XHRpZiAocmFuZ2UyKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYWRkRm9sZGVyRW50cmllcyh3aWRnZXQsIHJlc3VsdCwgcmFuZ2UyLCB0b2tlbik7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cblx0XHQvLyBTZWxlY3Rpb24gY29tcGxldGlvblxuXHRcdHRoaXMucmVnaXN0ZXJWYXJpYWJsZUNvbXBsZXRpb25zKCdzZWxlY3Rpb24nLCAoeyB3aWRnZXQsIHJhbmdlIH0sIHRva2VuKSA9PiB7XG5cdFx0XHRpZiAoIXdpZGdldC5zdXBwb3J0c0ZpbGVSZWZlcmVuY2VzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHdpZGdldC5sb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdG9yKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWN0aXZlID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdFx0aWYgKCFpc0NvZGVFZGl0b3IoYWN0aXZlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRSZXNvdXJjZSA9IGFjdGl2ZS5nZXRNb2RlbCgpPy51cmk7XG5cdFx0XHRjb25zdCBjdXJyZW50U2VsZWN0aW9uID0gYWN0aXZlLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0aWYgKCFjdXJyZW50U2VsZWN0aW9uIHx8ICFjdXJyZW50UmVzb3VyY2UgfHwgY3VycmVudFNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBiYXNlbmFtZSA9IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwoY3VycmVudFJlc291cmNlKTtcblx0XHRcdGNvbnN0IHRleHQgPSBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9ZmlsZToke2Jhc2VuYW1lfToke2N1cnJlbnRTZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyfS0ke2N1cnJlbnRTZWxlY3Rpb24uZW5kTGluZU51bWJlcn1gO1xuXHRcdFx0Y29uc3QgZnVsbFJhbmdlVGV4dCA9IGA6JHtjdXJyZW50U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcn06JHtjdXJyZW50U2VsZWN0aW9uLnN0YXJ0Q29sdW1ufS0ke2N1cnJlbnRTZWxlY3Rpb24uZW5kTGluZU51bWJlcn06JHtjdXJyZW50U2VsZWN0aW9uLmVuZENvbHVtbn1gO1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChjdXJyZW50UmVzb3VyY2UsIHsgcmVsYXRpdmU6IHRydWUgfSkgKyBmdWxsUmFuZ2VUZXh0O1xuXG5cdFx0XHRjb25zdCByZXN1bHQ6IENvbXBsZXRpb25MaXN0ID0geyBzdWdnZXN0aW9uczogW10gfTtcblx0XHRcdHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn1zZWxlY3Rpb25gLCBkZXNjcmlwdGlvbiB9LFxuXHRcdFx0XHRmaWx0ZXJUZXh0OiBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9c2VsZWN0aW9uYCxcblx0XHRcdFx0aW5zZXJ0VGV4dDogcmFuZ2UudmFyV29yZD8uZW5kQ29sdW1uID09PSByYW5nZS5yZXBsYWNlLmVuZENvbHVtbiA/IGAke3RleHR9IGAgOiB0ZXh0LFxuXHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdHNvcnRUZXh0OiAneicsXG5cdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRpZDogQnVpbHRpbkR5bmFtaWNDb21wbGV0aW9ucy5hZGRSZWZlcmVuY2VDb21tYW5kLCB0aXRsZTogJycsIGFyZ3VtZW50czogW25ldyBSZWZlcmVuY2VBcmd1bWVudCh3aWRnZXQsIHtcblx0XHRcdFx0XHRcdGlkOiAndnNjb2RlLnNlbGVjdGlvbicsXG5cdFx0XHRcdFx0XHRwcmVmaXg6ICdmaWxlJyxcblx0XHRcdFx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogcmFuZ2UucmVwbGFjZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyOiByYW5nZS5yZXBsYWNlLmVuZExpbmVOdW1iZXIsIGVuZENvbHVtbjogcmFuZ2UucmVwbGFjZS5zdGFydENvbHVtbiArIHRleHQubGVuZ3RoIH0sXG5cdFx0XHRcdFx0XHRkYXRhOiB7IHJhbmdlOiBjdXJyZW50U2VsZWN0aW9uLCB1cmk6IGN1cnJlbnRSZXNvdXJjZSB9IHNhdGlzZmllcyBMb2NhdGlvblxuXHRcdFx0XHRcdH0pXVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fSk7XG5cblx0XHQvLyBTeW1ib2wgY29tcGxldGlvbnNcblx0XHR0aGlzLnJlZ2lzdGVyVmFyaWFibGVDb21wbGV0aW9ucygnc3ltYm9sJywgKHsgd2lkZ2V0LCByYW5nZSwgcG9zaXRpb24sIG1vZGVsIH0sIHRva2VuKSA9PiB7XG5cdFx0XHRpZiAoIXdpZGdldC5zdXBwb3J0c0ZpbGVSZWZlcmVuY2VzKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQ6IENvbXBsZXRpb25MaXN0ID0geyBzdWdnZXN0aW9uczogW10gfTtcblxuXHRcdFx0Y29uc3QgYWZ0ZXJSYW5nZVN5bSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uICsgJyNzeW06Jy5sZW5ndGgpO1xuXHRcdFx0cmVzdWx0LnN1Z2dlc3Rpb25zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfXN5bWAsXG5cdFx0XHRcdGluc2VydFRleHQ6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn1zeW06YCxcblx0XHRcdFx0ZG9jdW1lbnRhdGlvbjogbG9jYWxpemUoJ3BpY2tTeW1ib2xMYWJlbCcsIFwiUGljayBhIHN5bWJvbFwiKSxcblx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRjb21tYW5kOiB7IGlkOiBTZWxlY3RBbmRJbnNlcnRTeW1BY3Rpb24uSUQsIHRpdGxlOiBTZWxlY3RBbmRJbnNlcnRTeW1BY3Rpb24uSUQsIGFyZ3VtZW50czogW3sgd2lkZ2V0LCByYW5nZTogYWZ0ZXJSYW5nZVN5bSB9XSB9LFxuXHRcdFx0XHRzb3J0VGV4dDogJ3onXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcmFuZ2UyID0gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWwsIHBvc2l0aW9uLCBuZXcgUmVnRXhwKGAke2NoYXRWYXJpYWJsZUxlYWRlcn1bXlxcXFxzXSpgLCAnZycpLCB0cnVlKTtcblx0XHRcdGlmIChyYW5nZTIpIHtcblx0XHRcdFx0dGhpcy5hZGRTeW1ib2xFbnRyaWVzKHdpZGdldCwgcmVzdWx0LCByYW5nZTIsIHRva2VuKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblxuXHRcdC8vIFByb2JsZW1zIGNvbXBsZXRpb25zLCB3ZSBqdXN0IGF0dGFjaCBhbGwgcHJvYmxlbXMgaW4gdGhpcyBjYXNlXG5cdFx0dGhpcy5yZWdpc3RlclZhcmlhYmxlQ29tcGxldGlvbnMoU2VsZWN0QW5kSW5zZXJ0UHJvYmxlbUFjdGlvbi5OYW1lLCAoeyB3aWRnZXQsIHJhbmdlLCBwb3NpdGlvbiwgbW9kZWwgfSwgdG9rZW4pID0+IHtcblx0XHRcdGNvbnN0IHN0YXRzID0gbWFya2VyU2VydmljZS5nZXRTdGF0aXN0aWNzKCk7XG5cdFx0XHRpZiAoIXN0YXRzLmVycm9ycyAmJiAhc3RhdHMud2FybmluZ3MpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogQ29tcGxldGlvbkxpc3QgPSB7IHN1Z2dlc3Rpb25zOiBbXSB9O1xuXG5cdFx0XHRjb25zdCBjb21wbGV0ZWRUZXh0ID0gYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfSR7U2VsZWN0QW5kSW5zZXJ0UHJvYmxlbUFjdGlvbi5OYW1lfTpgO1xuXHRcdFx0Y29uc3QgYWZ0ZXJUZXh0UmFuZ2UgPSBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgcmFuZ2UucmVwbGFjZS5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcmFuZ2UucmVwbGFjZS5zdGFydENvbHVtbiArIGNvbXBsZXRlZFRleHQubGVuZ3RoKTtcblx0XHRcdHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn0ke1NlbGVjdEFuZEluc2VydFByb2JsZW1BY3Rpb24uTmFtZX1gLFxuXHRcdFx0XHRpbnNlcnRUZXh0OiBjb21wbGV0ZWRUZXh0LFxuXHRcdFx0XHRkb2N1bWVudGF0aW9uOiBsb2NhbGl6ZSgncGlja1Byb2JsZW1zTGFiZWwnLCBcIlByb2JsZW1zIGluIHlvdXIgd29ya3NwYWNlXCIpLFxuXHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IFNlbGVjdEFuZEluc2VydFByb2JsZW1BY3Rpb24uSUQsIHRpdGxlOiBTZWxlY3RBbmRJbnNlcnRQcm9ibGVtQWN0aW9uLklELCBhcmd1bWVudHM6IFt7IHdpZGdldCwgcmFuZ2U6IGFmdGVyVGV4dFJhbmdlIH1dIH0sXG5cdFx0XHRcdHNvcnRUZXh0OiAneidcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoQnVpbHRpbkR5bmFtaWNDb21wbGV0aW9ucy5hZGRSZWZlcmVuY2VDb21tYW5kLCAoX3NlcnZpY2VzLCBhcmcpID0+IHRoaXMuY21kQWRkUmVmZXJlbmNlKGFyZykpKTtcblxuXHRcdHRoaXMucXVlcnlCdWlsZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclZhcmlhYmxlQ29tcGxldGlvbnMoZGVidWdOYW1lOiBzdHJpbmcsIHByb3ZpZGVyOiAoZGV0YWlsczogSVZhcmlhYmxlQ29tcGxldGlvbnNEZXRhaWxzLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb3ZpZGVyUmVzdWx0PENvbXBsZXRpb25MaXN0Pikge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHsgc2NoZW1lOiBDaGF0SW5wdXRQYXJ0LklOUFVUX1NDSEVNRSwgaGFzQWNjZXNzVG9BbGxNb2RlbHM6IHRydWUgfSwge1xuXHRcdFx0X2RlYnVnRGlzcGxheU5hbWU6IGBjaGF0VmFyQ29tcGxldGlvbnMtJHtkZWJ1Z05hbWV9YCxcblx0XHRcdHRyaWdnZXJDaGFyYWN0ZXJzOiBbY2hhdFZhcmlhYmxlTGVhZGVyXSxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBjb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlJbnB1dFVyaShtb2RlbC51cmkpO1xuXHRcdFx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWwsIHBvc2l0aW9uLCBCdWlsdGluRHluYW1pY0NvbXBsZXRpb25zLlZhcmlhYmxlTmFtZURlZiwgdHJ1ZSk7XG5cdFx0XHRcdGlmIChyYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm92aWRlcih7IG1vZGVsLCBwb3NpdGlvbiwgd2lkZ2V0LCByYW5nZSwgY29udGV4dCB9LCB0b2tlbik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjYWNoZUtleT86IHsga2V5OiBzdHJpbmc7IHRpbWU6IG51bWJlciB9O1xuXG5cdHByaXZhdGUgYXN5bmMgYWRkRmlsZUVudHJpZXMod2lkZ2V0OiBJQ2hhdFdpZGdldCwgcmVzdWx0OiBDb21wbGV0aW9uTGlzdCwgaW5mbzogeyBpbnNlcnQ6IFJhbmdlOyByZXBsYWNlOiBSYW5nZTsgdmFyV29yZDogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCB9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblxuXHRcdGNvbnN0IG1ha2VGaWxlQ29tcGxldGlvbkl0ZW0gPSAocmVzb3VyY2U6IFVSSSwgZGVzY3JpcHRpb24/OiBzdHJpbmcpOiBDb21wbGV0aW9uSXRlbSA9PiB7XG5cblx0XHRcdGNvbnN0IGJhc2VuYW1lID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCB0ZXh0ID0gYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfWZpbGU6JHtiYXNlbmFtZX1gO1xuXHRcdFx0Y29uc3QgdXJpTGFiZWwgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChyZXNvdXJjZSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGxhYmVsRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvblxuXHRcdFx0XHQ/IGxvY2FsaXplKCdmaWxlRW50cnlEZXNjcmlwdGlvbicsICd7MH0gKHsxfSknLCB1cmlMYWJlbCwgZGVzY3JpcHRpb24pXG5cdFx0XHRcdDogdXJpTGFiZWw7XG5cdFx0XHRjb25zdCBzb3J0VGV4dCA9IGRlc2NyaXB0aW9uID8gJ3onIDogJ3snOyAvLyBhZnRlciBgemBcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGFiZWw6IHsgbGFiZWw6IGJhc2VuYW1lLCBkZXNjcmlwdGlvbjogbGFiZWxEZXNjcmlwdGlvbiB9LFxuXHRcdFx0XHRmaWx0ZXJUZXh0OiBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9JHtiYXNlbmFtZX1gLFxuXHRcdFx0XHRpbnNlcnRUZXh0OiBpbmZvLnZhcldvcmQ/LmVuZENvbHVtbiA9PT0gaW5mby5yZXBsYWNlLmVuZENvbHVtbiA/IGAke3RleHR9IGAgOiB0ZXh0LFxuXHRcdFx0XHRyYW5nZTogaW5mbyxcblx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGUsXG5cdFx0XHRcdHNvcnRUZXh0LFxuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0aWQ6IEJ1aWx0aW5EeW5hbWljQ29tcGxldGlvbnMuYWRkUmVmZXJlbmNlQ29tbWFuZCwgdGl0bGU6ICcnLCBhcmd1bWVudHM6IFtuZXcgUmVmZXJlbmNlQXJndW1lbnQod2lkZ2V0LCB7XG5cdFx0XHRcdFx0XHRpZDogJ3ZzY29kZS5maWxlJyxcblx0XHRcdFx0XHRcdHByZWZpeDogJ2ZpbGUnLFxuXHRcdFx0XHRcdFx0aXNGaWxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiBpbmZvLnJlcGxhY2Uuc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogaW5mby5yZXBsYWNlLnN0YXJ0Q29sdW1uLCBlbmRMaW5lTnVtYmVyOiBpbmZvLnJlcGxhY2UuZW5kTGluZU51bWJlciwgZW5kQ29sdW1uOiBpbmZvLnJlcGxhY2Uuc3RhcnRDb2x1bW4gKyB0ZXh0Lmxlbmd0aCB9LFxuXHRcdFx0XHRcdFx0ZGF0YTogcmVzb3VyY2Vcblx0XHRcdFx0XHR9KV1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9O1xuXG5cdFx0bGV0IHBhdHRlcm46IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaW5mby52YXJXb3JkPy53b3JkICYmIGluZm8udmFyV29yZC53b3JkLnN0YXJ0c1dpdGgoY2hhdFZhcmlhYmxlTGVhZGVyKSkge1xuXHRcdFx0cGF0dGVybiA9IGluZm8udmFyV29yZC53b3JkLnRvTG93ZXJDYXNlKCkuc2xpY2UoMSk7IC8vIHJlbW92ZSBsZWFkaW5nICNcblx0XHR9XG5cblx0XHRjb25zdCBzZWVuID0gbmV3IFJlc291cmNlU2V0KCk7XG5cdFx0Y29uc3QgbGVuID0gcmVzdWx0LnN1Z2dlc3Rpb25zLmxlbmd0aDtcblxuXHRcdC8vIFJFTEFURUQgRklMRVNcblx0XHRpZiAod2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlICE9PSBDaGF0TW9kZS5Bc2sgJiYgd2lkZ2V0LnZpZXdNb2RlbCAmJiB3aWRnZXQudmlld01vZGVsLm1vZGVsLmVkaXRpbmdTZXNzaW9uKSB7XG5cdFx0XHRjb25zdCByZWxhdGVkRmlsZXMgPSAoYXdhaXQgcmFjZVRpbWVvdXQodGhpcy5fY2hhdEVkaXRpbmdTZXJ2aWNlLmdldFJlbGF0ZWRGaWxlcyh3aWRnZXQudmlld01vZGVsLnNlc3Npb25JZCwgd2lkZ2V0LmdldElucHV0KCksIHdpZGdldC5hdHRhY2htZW50TW9kZWwuZmlsZUF0dGFjaG1lbnRzLCB0b2tlbiksIDIwMCkpID8/IFtdO1xuXHRcdFx0Zm9yIChjb25zdCByZWxhdGVkRmlsZUdyb3VwIG9mIHJlbGF0ZWRGaWxlcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHJlbGF0ZWRGaWxlIG9mIHJlbGF0ZWRGaWxlR3JvdXAuZmlsZXMpIHtcblx0XHRcdFx0XHRpZiAoc2Vlbi5oYXMocmVsYXRlZEZpbGUudXJpKSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNlZW4uYWRkKHJlbGF0ZWRGaWxlLnVyaSk7XG5cdFx0XHRcdFx0cmVzdWx0LnN1Z2dlc3Rpb25zLnB1c2gobWFrZUZpbGVDb21wbGV0aW9uSXRlbShyZWxhdGVkRmlsZS51cmksIHJlbGF0ZWRGaWxlLmRlc2NyaXB0aW9uKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBISVNUT1JZXG5cdFx0Ly8gYWx3YXlzIHRha2UgdGhlIGxhc3QgTiBpdGVtc1xuXHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmhpc3RvcnlTZXJ2aWNlLmdldEhpc3RvcnkoKSkge1xuXHRcdFx0aWYgKCFpdGVtLnJlc291cmNlIHx8ICF0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihpdGVtLnJlc291cmNlKSkge1xuXHRcdFx0XHQvLyBpZ25vcmUgXCJmb3JnZWluXCIgZWRpdG9yc1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdHRlcm4pIHtcblx0XHRcdFx0Ly8gdXNlIHBhdHRlcm4gaWYgYXZhaWxhYmxlXG5cdFx0XHRcdGNvbnN0IGJhc2VuYW1lID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChpdGVtLnJlc291cmNlKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRpZiAoIWlzUGF0dGVybkluV29yZChwYXR0ZXJuLCAwLCBwYXR0ZXJuLmxlbmd0aCwgYmFzZW5hbWUsIDAsIGJhc2VuYW1lLmxlbmd0aCkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRzZWVuLmFkZChpdGVtLnJlc291cmNlKTtcblx0XHRcdGNvbnN0IG5ld0xlbiA9IHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKG1ha2VGaWxlQ29tcGxldGlvbkl0ZW0oaXRlbS5yZXNvdXJjZSkpO1xuXHRcdFx0aWYgKG5ld0xlbiAtIGxlbiA+PSA1KSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNFQVJDSFxuXHRcdC8vIHVzZSBmaWxlIHNlYXJjaCB3aGVuIGhhdmluZyBhIHBhdHRlcm5cblx0XHRpZiAocGF0dGVybikge1xuXG5cdFx0XHRjb25zdCBjYWNoZUtleSA9IHRoaXMudXBkYXRlQ2FjaGVLZXkoKTtcblxuXHRcdFx0Y29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJ5QnVpbGRlci5maWxlKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycywge1xuXHRcdFx0XHRmaWxlUGF0dGVybjogcGF0dGVybixcblx0XHRcdFx0c29ydEJ5U2NvcmU6IHRydWUsXG5cdFx0XHRcdG1heFJlc3VsdHM6IDI1MCxcblx0XHRcdFx0Y2FjaGVLZXk6IGNhY2hlS2V5LmtleVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLnNlYXJjaFNlcnZpY2UuZmlsZVNlYXJjaChxdWVyeSwgdG9rZW4pO1xuXHRcdFx0Zm9yIChjb25zdCBtYXRjaCBvZiBkYXRhLnJlc3VsdHMpIHtcblx0XHRcdFx0aWYgKHNlZW4uaGFzKG1hdGNoLnJlc291cmNlKSkge1xuXHRcdFx0XHRcdC8vIGFscmVhZHkgaW5jbHVkZWQgdmlhIGhpc3Rvcnlcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQuc3VnZ2VzdGlvbnMucHVzaChtYWtlRmlsZUNvbXBsZXRpb25JdGVtKG1hdGNoLnJlc291cmNlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gbWFyayByZXN1bHRzIGFzIGluY29tcGxldGUgYmVjYXVzZSBmdXJ0aGVyIHR5cGluZyBtaWdodCB5aWVsZFxuXHRcdC8vIGluIG1vcmUgc2VhcmNoIHJlc3VsdHNcblx0XHRyZXN1bHQuaW5jb21wbGV0ZSA9IHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGFkZEZvbGRlckVudHJpZXMod2lkZ2V0OiBJQ2hhdFdpZGdldCwgcmVzdWx0OiBDb21wbGV0aW9uTGlzdCwgaW5mbzogeyBpbnNlcnQ6IFJhbmdlOyByZXBsYWNlOiBSYW5nZTsgdmFyV29yZDogSVdvcmRBdFBvc2l0aW9uIHwgbnVsbCB9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblxuXHRcdGNvbnN0IGZvbGRlckxlYWRlciA9IGAke2NoYXRWYXJpYWJsZUxlYWRlcn1mb2xkZXI6YDtcblxuXHRcdGNvbnN0IG1ha2VGb2xkZXJDb21wbGV0aW9uSXRlbSA9IChyZXNvdXJjZTogVVJJLCBkZXNjcmlwdGlvbj86IHN0cmluZyk6IENvbXBsZXRpb25JdGVtID0+IHtcblxuXHRcdFx0Y29uc3QgYmFzZW5hbWUgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHJlc291cmNlKTtcblx0XHRcdGNvbnN0IHRleHQgPSBgJHtmb2xkZXJMZWFkZXJ9JHtiYXNlbmFtZX1gO1xuXHRcdFx0Y29uc3QgdXJpTGFiZWwgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChkaXJuYW1lKHJlc291cmNlKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGxhYmVsRGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvblxuXHRcdFx0XHQ/IGxvY2FsaXplKCdmb2xkZXJFbnRyeURlc2NyaXB0aW9uJywgJ3swfSAoezF9KScsIHVyaUxhYmVsLCBkZXNjcmlwdGlvbilcblx0XHRcdFx0OiB1cmlMYWJlbDtcblx0XHRcdGNvbnN0IHNvcnRUZXh0ID0gZGVzY3JpcHRpb24gPyAneicgOiAneyc7IC8vIGFmdGVyIGB6YFxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogYmFzZW5hbWUsIGRlc2NyaXB0aW9uOiBsYWJlbERlc2NyaXB0aW9uIH0sXG5cdFx0XHRcdGZpbHRlclRleHQ6IGAke2ZvbGRlckxlYWRlcn0ke2Jhc2VuYW1lfWAsXG5cdFx0XHRcdGluc2VydFRleHQ6IGluZm8udmFyV29yZD8uZW5kQ29sdW1uID09PSBpbmZvLnJlcGxhY2UuZW5kQ29sdW1uID8gYCR7dGV4dH0gYCA6IHRleHQsXG5cdFx0XHRcdHJhbmdlOiBpbmZvLFxuXHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLFxuXHRcdFx0XHRzb3J0VGV4dCxcblx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdGlkOiBCdWlsdGluRHluYW1pY0NvbXBsZXRpb25zLmFkZFJlZmVyZW5jZUNvbW1hbmQsIHRpdGxlOiAnJywgYXJndW1lbnRzOiBbbmV3IFJlZmVyZW5jZUFyZ3VtZW50KHdpZGdldCwge1xuXHRcdFx0XHRcdFx0aWQ6ICd2c2NvZGUuZm9sZGVyJyxcblx0XHRcdFx0XHRcdHByZWZpeDogJ2ZvbGRlcicsXG5cdFx0XHRcdFx0XHRpc0ZpbGU6IGZhbHNlLFxuXHRcdFx0XHRcdFx0aXNEaXJlY3Rvcnk6IHRydWUsXG5cdFx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IGluZm8ucmVwbGFjZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiBpbmZvLnJlcGxhY2Uuc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXI6IGluZm8ucmVwbGFjZS5lbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IGluZm8ucmVwbGFjZS5zdGFydENvbHVtbiArIHRleHQubGVuZ3RoIH0sXG5cdFx0XHRcdFx0XHRkYXRhOiByZXNvdXJjZVxuXHRcdFx0XHRcdH0pXVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH07XG5cblx0XHRjb25zdCBzZWVuID0gbmV3IFJlc291cmNlU2V0KCk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlcyA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZm9sZGVyID0+IGZvbGRlci51cmkpO1xuXG5cdFx0bGV0IHBhdHRlcm46IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaW5mby52YXJXb3JkPy53b3JkICYmIGluZm8udmFyV29yZC53b3JkLnN0YXJ0c1dpdGgoZm9sZGVyTGVhZGVyKSkge1xuXHRcdFx0cGF0dGVybiA9IGluZm8udmFyV29yZC53b3JkLnRvTG93ZXJDYXNlKCkuc2xpY2UoZm9sZGVyTGVhZGVyLmxlbmd0aCk7XG5cblx0XHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIGF3YWl0IGdldFRvcExldmVsRm9sZGVycyh3b3Jrc3BhY2VzLCB0aGlzLmZpbGVTZXJ2aWNlKSkge1xuXHRcdFx0XHRyZXN1bHQuc3VnZ2VzdGlvbnMucHVzaChtYWtlRm9sZGVyQ29tcGxldGlvbkl0ZW0oZm9sZGVyKSk7XG5cdFx0XHRcdHNlZW4uYWRkKGZvbGRlcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU0VBUkNIXG5cdFx0Ly8gdXNlIGZvbGRlciBzZWFyY2ggd2hlbiBoYXZpbmcgYSBwYXR0ZXJuXG5cdFx0aWYgKHBhdHRlcm4pIHtcblxuXHRcdFx0Y29uc3QgY2FjaGVLZXkgPSB0aGlzLnVwZGF0ZUNhY2hlS2V5KCk7XG5cblx0XHRcdGNvbnN0IGZvbGRlcnMgPSBhd2FpdCBQcm9taXNlLmFsbCh3b3Jrc3BhY2VzLm1hcCh3b3Jrc3BhY2UgPT4gc2VhcmNoRm9sZGVycyh3b3Jrc3BhY2UsIHBhdHRlcm4sIHRydWUsIHRva2VuLCBjYWNoZUtleS5rZXksIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuc2VhcmNoU2VydmljZSkpKTtcblx0XHRcdGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgZm9sZGVycy5mbGF0KCkpIHtcblx0XHRcdFx0aWYgKHNlZW4uaGFzKHJlc291cmNlKSkge1xuXHRcdFx0XHRcdC8vIGFscmVhZHkgaW5jbHVkZWQgdmlhIGhpc3Rvcnlcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWVuLmFkZChyZXNvdXJjZSk7XG5cdFx0XHRcdHJlc3VsdC5zdWdnZXN0aW9ucy5wdXNoKG1ha2VGb2xkZXJDb21wbGV0aW9uSXRlbShyZXNvdXJjZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG1hcmsgcmVzdWx0cyBhcyBpbmNvbXBsZXRlIGJlY2F1c2UgZnVydGhlciB0eXBpbmcgbWlnaHQgeWllbGRcblx0XHQvLyBpbiBtb3JlIHNlYXJjaCByZXN1bHRzXG5cdFx0cmVzdWx0LmluY29tcGxldGUgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRTeW1ib2xFbnRyaWVzKHdpZGdldDogSUNoYXRXaWRnZXQsIHJlc3VsdDogQ29tcGxldGlvbkxpc3QsIGluZm86IHsgaW5zZXJ0OiBSYW5nZTsgcmVwbGFjZTogUmFuZ2U7IHZhcldvcmQ6IElXb3JkQXRQb3NpdGlvbiB8IG51bGwgfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cblx0XHRjb25zdCBtYWtlU3ltYm9sQ29tcGxldGlvbkl0ZW0gPSAoc3ltYm9sSXRlbTogeyBuYW1lOiBzdHJpbmc7IGxvY2F0aW9uOiBMb2NhdGlvbjsga2luZDogU3ltYm9sS2luZCB9LCBwYXR0ZXJuOiBzdHJpbmcpOiBDb21wbGV0aW9uSXRlbSA9PiB7XG5cdFx0XHRjb25zdCB0ZXh0ID0gYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfXN5bToke3N5bWJvbEl0ZW0ubmFtZX1gO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBzeW1ib2xJdGVtLmxvY2F0aW9uLnVyaTtcblx0XHRcdGNvbnN0IHVyaUxhYmVsID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwocmVzb3VyY2UsIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBzb3J0VGV4dCA9IHBhdHRlcm4gPyAneycgLyogYWZ0ZXIgeiAqLyA6ICd8JyAvKiBhZnRlciB7ICovO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogc3ltYm9sSXRlbS5uYW1lLCBkZXNjcmlwdGlvbjogdXJpTGFiZWwgfSxcblx0XHRcdFx0ZmlsdGVyVGV4dDogYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfSR7c3ltYm9sSXRlbS5uYW1lfWAsXG5cdFx0XHRcdGluc2VydFRleHQ6IGluZm8udmFyV29yZD8uZW5kQ29sdW1uID09PSBpbmZvLnJlcGxhY2UuZW5kQ29sdW1uID8gYCR7dGV4dH0gYCA6IHRleHQsXG5cdFx0XHRcdHJhbmdlOiBpbmZvLFxuXHRcdFx0XHRraW5kOiBTeW1ib2xLaW5kcy50b0NvbXBsZXRpb25LaW5kKHN5bWJvbEl0ZW0ua2luZCksXG5cdFx0XHRcdHNvcnRUZXh0LFxuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0aWQ6IEJ1aWx0aW5EeW5hbWljQ29tcGxldGlvbnMuYWRkUmVmZXJlbmNlQ29tbWFuZCwgdGl0bGU6ICcnLCBhcmd1bWVudHM6IFtuZXcgUmVmZXJlbmNlQXJndW1lbnQod2lkZ2V0LCB7XG5cdFx0XHRcdFx0XHRpZDogJ3ZzY29kZS5zeW1ib2wnLFxuXHRcdFx0XHRcdFx0cHJlZml4OiAnc3ltJyxcblx0XHRcdFx0XHRcdGZ1bGxOYW1lOiBzeW1ib2xJdGVtLm5hbWUsXG5cdFx0XHRcdFx0XHRyYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IGluZm8ucmVwbGFjZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiBpbmZvLnJlcGxhY2Uuc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXI6IGluZm8ucmVwbGFjZS5lbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IGluZm8ucmVwbGFjZS5zdGFydENvbHVtbiArIHRleHQubGVuZ3RoIH0sXG5cdFx0XHRcdFx0XHRkYXRhOiBzeW1ib2xJdGVtLmxvY2F0aW9uXG5cdFx0XHRcdFx0fSldXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblxuXHRcdGxldCBwYXR0ZXJuOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGluZm8udmFyV29yZD8ud29yZCAmJiBpbmZvLnZhcldvcmQud29yZC5zdGFydHNXaXRoKGNoYXRWYXJpYWJsZUxlYWRlcikpIHtcblx0XHRcdHBhdHRlcm4gPSBpbmZvLnZhcldvcmQud29yZC50b0xvd2VyQ2FzZSgpLnNsaWNlKDEpOyAvLyByZW1vdmUgbGVhZGluZyAjXG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3ltYm9sc1RvQWRkOiB7IHN5bWJvbDogRG9jdW1lbnRTeW1ib2w7IHVyaTogVVJJIH1bXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgb3V0bGluZU1vZGVsIG9mIHRoaXMub3V0bGluZVNlcnZpY2UuZ2V0Q2FjaGVkTW9kZWxzKCkpIHtcblx0XHRcdGlmIChwYXR0ZXJuKSB7XG5cdFx0XHRcdHN5bWJvbHNUb0FkZC5wdXNoKC4uLm91dGxpbmVNb2RlbC5hc0xpc3RPZkRvY3VtZW50U3ltYm9scygpLm1hcChzeW1ib2wgPT4gKHsgc3ltYm9sLCB1cmk6IG91dGxpbmVNb2RlbC51cmkgfSkpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHN5bWJvbHNUb0FkZC5wdXNoKC4uLm91dGxpbmVNb2RlbC5nZXRUb3BMZXZlbFN5bWJvbHMoKS5tYXAoc3ltYm9sID0+ICh7IHN5bWJvbCwgdXJpOiBvdXRsaW5lTW9kZWwudXJpIH0pKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3ltYm9sc1RvQWRkRmlsdGVyZWQgPSBzeW1ib2xzVG9BZGQuZmlsdGVyKGZpbGVTeW1ib2wgPT4ge1xuXHRcdFx0c3dpdGNoIChmaWxlU3ltYm9sLnN5bWJvbC5raW5kKSB7XG5cdFx0XHRcdGNhc2UgU3ltYm9sS2luZC5FbnVtOlxuXHRcdFx0XHRjYXNlIFN5bWJvbEtpbmQuQ2xhc3M6XG5cdFx0XHRcdGNhc2UgU3ltYm9sS2luZC5NZXRob2Q6XG5cdFx0XHRcdGNhc2UgU3ltYm9sS2luZC5GdW5jdGlvbjpcblx0XHRcdFx0Y2FzZSBTeW1ib2xLaW5kLk5hbWVzcGFjZTpcblx0XHRcdFx0Y2FzZSBTeW1ib2xLaW5kLk1vZHVsZTpcblx0XHRcdFx0Y2FzZSBTeW1ib2xLaW5kLkludGVyZmFjZTpcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzVG9BZGRGaWx0ZXJlZCkge1xuXHRcdFx0cmVzdWx0LnN1Z2dlc3Rpb25zLnB1c2gobWFrZVN5bWJvbENvbXBsZXRpb25JdGVtKHsgLi4uc3ltYm9sLnN5bWJvbCwgbG9jYXRpb246IHsgdXJpOiBzeW1ib2wudXJpLCByYW5nZTogc3ltYm9sLnN5bWJvbC5yYW5nZSB9IH0sIHBhdHRlcm4gPz8gJycpKTtcblx0XHR9XG5cblx0XHRyZXN1bHQuaW5jb21wbGV0ZSA9ICEhcGF0dGVybjtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ2FjaGVLZXkoKSB7XG5cdFx0aWYgKHRoaXMuY2FjaGVLZXkgJiYgRGF0ZS5ub3coKSAtIHRoaXMuY2FjaGVLZXkudGltZSA+IDYwMDAwKSB7XG5cdFx0XHR0aGlzLnNlYXJjaFNlcnZpY2UuY2xlYXJDYWNoZSh0aGlzLmNhY2hlS2V5LmtleSk7XG5cdFx0XHR0aGlzLmNhY2hlS2V5ID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5jYWNoZUtleSkge1xuXHRcdFx0dGhpcy5jYWNoZUtleSA9IHtcblx0XHRcdFx0a2V5OiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRcdFx0dGltZTogRGF0ZS5ub3coKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHR0aGlzLmNhY2hlS2V5LnRpbWUgPSBEYXRlLm5vdygpO1xuXG5cdFx0cmV0dXJuIHRoaXMuY2FjaGVLZXk7XG5cdH1cblxuXHRwcml2YXRlIGNtZEFkZFJlZmVyZW5jZShhcmc6IFJlZmVyZW5jZUFyZ3VtZW50KSB7XG5cdFx0Ly8gaW52b2tlZCB2aWEgdGhlIGNvbXBsZXRpb24gY29tbWFuZFxuXHRcdGFyZy53aWRnZXQuZ2V0Q29udHJpYjxDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWw+KENoYXREeW5hbWljVmFyaWFibGVNb2RlbC5JRCk/LmFkZFJlZmVyZW5jZShhcmcudmFyaWFibGUpO1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihCdWlsdGluRHluYW1pY0NvbXBsZXRpb25zLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENvbXBsZXRpb25SYW5nZVJlc3VsdCB7XG5cdGluc2VydDogUmFuZ2U7XG5cdHJlcGxhY2U6IFJhbmdlO1xuXHR2YXJXb3JkOiBJV29yZEF0UG9zaXRpb24gfCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgcmVnOiBSZWdFeHAsIG9ubHlPbldvcmRTdGFydCA9IGZhbHNlKTogSUNoYXRDb21wbGV0aW9uUmFuZ2VSZXN1bHQgfCB1bmRlZmluZWQge1xuXHRjb25zdCB2YXJXb3JkID0gZ2V0V29yZEF0VGV4dChwb3NpdGlvbi5jb2x1bW4sIHJlZywgbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlciksIDApO1xuXHRpZiAoIXZhcldvcmQgJiYgbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zaXRpb24pLndvcmQpIHtcblx0XHQvLyBpbnNpZGUgYSBcIm5vcm1hbFwiIHdvcmRcblx0XHRyZXR1cm47XG5cdH1cblxuXHRpZiAoIXZhcldvcmQgJiYgcG9zaXRpb24uY29sdW1uID4gMSkge1xuXHRcdGNvbnN0IHRleHRCZWZvcmUgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiAtIDEsIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbikpO1xuXHRcdGlmICh0ZXh0QmVmb3JlICE9PSAnICcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRpZiAodmFyV29yZCAmJiBvbmx5T25Xb3JkU3RhcnQpIHtcblx0XHRjb25zdCB3b3JkQmVmb3JlID0gbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24oeyBsaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLCBjb2x1bW46IHZhcldvcmQuc3RhcnRDb2x1bW4gfSk7XG5cdFx0aWYgKHdvcmRCZWZvcmUud29yZCkge1xuXHRcdFx0Ly8gaW5zaWRlIGEgd29yZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fVxuXG5cdGxldCBpbnNlcnQ6IFJhbmdlO1xuXHRsZXQgcmVwbGFjZTogUmFuZ2U7XG5cdGlmICghdmFyV29yZCkge1xuXHRcdGluc2VydCA9IHJlcGxhY2UgPSBSYW5nZS5mcm9tUG9zaXRpb25zKHBvc2l0aW9uKTtcblx0fSBlbHNlIHtcblx0XHRpbnNlcnQgPSBuZXcgUmFuZ2UocG9zaXRpb24ubGluZU51bWJlciwgdmFyV29yZC5zdGFydENvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0XHRyZXBsYWNlID0gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHZhcldvcmQuc3RhcnRDb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHZhcldvcmQuZW5kQ29sdW1uKTtcblx0fVxuXG5cdHJldHVybiB7IGluc2VydCwgcmVwbGFjZSwgdmFyV29yZCB9O1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5VXBUb0NvbXBsZXRpb25Xb3JkKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZVJlc3VsdDogSUNoYXRDb21wbGV0aW9uUmFuZ2VSZXN1bHQpOiBib29sZWFuIHtcblx0Y29uc3Qgc3RhcnRUb0NvbXBsZXRpb25Xb3JkU3RhcnQgPSBuZXcgUmFuZ2UoMSwgMSwgcmFuZ2VSZXN1bHQucmVwbGFjZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlUmVzdWx0LnJlcGxhY2Uuc3RhcnRDb2x1bW4pO1xuXHRyZXR1cm4gISFtb2RlbC5nZXRWYWx1ZUluUmFuZ2Uoc3RhcnRUb0NvbXBsZXRpb25Xb3JkU3RhcnQpLm1hdGNoKC9eXFxzKiQvKTtcbn1cblxuY2xhc3MgVG9vbENvbXBsZXRpb25zIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgVmFyaWFibGVOYW1lRGVmID0gbmV3IFJlZ0V4cChgKD88PV58XFxcXHMpJHtjaGF0VmFyaWFibGVMZWFkZXJ9XFxcXHcqYCwgJ2cnKTsgLy8gTVVTVCBiZSB1c2luZyBgZ2AtZmxhZ1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSB0b29sc1NlcnZpY2U6IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3Rlcih7IHNjaGVtZTogQ2hhdElucHV0UGFydC5JTlBVVF9TQ0hFTUUsIGhhc0FjY2Vzc1RvQWxsTW9kZWxzOiB0cnVlIH0sIHtcblx0XHRcdF9kZWJ1Z0Rpc3BsYXlOYW1lOiAnY2hhdFZhcmlhYmxlcycsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogW2NoYXRWYXJpYWJsZUxlYWRlcl0sXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zOiBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgX2NvbnRleHQ6IENvbXBsZXRpb25Db250ZXh0LCBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlJbnB1dFVyaShtb2RlbC51cmkpO1xuXHRcdFx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBjb21wdXRlQ29tcGxldGlvblJhbmdlcyhtb2RlbCwgcG9zaXRpb24sIFRvb2xDb21wbGV0aW9ucy5WYXJpYWJsZU5hbWVEZWYsIHRydWUpO1xuXHRcdFx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB1c2VkVG9vbHMgPSB3aWRnZXQucGFyc2VkSW5wdXQucGFydHMuZmlsdGVyKChwKTogcCBpcyBDaGF0UmVxdWVzdFRvb2xQYXJ0ID0+IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdFRvb2xQYXJ0KTtcblx0XHRcdFx0Y29uc3QgdXNlZFRvb2xOYW1lcyA9IG5ldyBTZXQodXNlZFRvb2xzLm1hcCh2ID0+IHYudG9vbE5hbWUpKTtcblx0XHRcdFx0Y29uc3QgdG9vbEl0ZW1zOiBDb21wbGV0aW9uSXRlbVtdID0gW107XG5cdFx0XHRcdHRvb2xJdGVtcy5wdXNoKC4uLkFycmF5LmZyb20odG9vbHNTZXJ2aWNlLmdldFRvb2xzKCkpXG5cdFx0XHRcdFx0LmZpbHRlcih0ID0+IHQuY2FuQmVSZWZlcmVuY2VkSW5Qcm9tcHQpXG5cdFx0XHRcdFx0LmZpbHRlcih0ID0+ICF1c2VkVG9vbE5hbWVzLmhhcyh0LnRvb2xSZWZlcmVuY2VOYW1lID8/ICcnKSlcblx0XHRcdFx0XHQubWFwKCh0KTogQ29tcGxldGlvbkl0ZW0gPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgd2l0aExlYWRlciA9IGAke2NoYXRWYXJpYWJsZUxlYWRlcn0ke3QudG9vbFJlZmVyZW5jZU5hbWV9YDtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiB3aXRoTGVhZGVyLFxuXHRcdFx0XHRcdFx0XHRyYW5nZSxcblx0XHRcdFx0XHRcdFx0aW5zZXJ0VGV4dDogd2l0aExlYWRlciArICcgJyxcblx0XHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbjogdC51c2VyRGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdFx0XHRzb3J0VGV4dDogJ3onXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0pKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN1Z2dlc3Rpb25zOiB0b29sSXRlbXNcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFRvb2xDb21wbGV0aW9ucywgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZUFBZTtBQUV4QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG9CQUFvQjtBQUU3QixTQUFTLGFBQWE7QUFDdEIsU0FBMEIscUJBQXFCO0FBQy9DLFNBQTRDLG9CQUFzRyxZQUFZLG1CQUFtQjtBQUVqTCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQTBDLGNBQWMsMkJBQTJCO0FBQ25GLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQXlCLHVCQUF1QixtQkFBbUIsMkJBQTJCO0FBQzlGLFNBQVMsMkJBQTJCO0FBQ3BDLFNB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
