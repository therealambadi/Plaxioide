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
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { inputPlaceholderForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { chatSlashCommandBackground, chatSlashCommandForeground } from "../../common/chatColors.js";
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashCommandPart, ChatRequestTextPart, ChatRequestToolPart, chatAgentLeader, chatSubcommandLeader } from "../../common/chatParserTypes.js";
import { ChatRequestParser } from "../../common/chatRequestParser.js";
import { ChatWidget } from "../chatWidget.js";
import { dynamicVariableDecorationType } from "./chatDynamicVariables.js";
const decorationDescription = "chat";
const placeholderDecorationType = "chat-session-detail";
const slashCommandTextDecorationType = "chat-session-text";
const variableTextDecorationType = "chat-variable-text";
function agentAndCommandToKey(agent, subcommand) {
  return subcommand ? `${agent.id}__${subcommand}` : agent.id;
}
let InputEditorDecorations = class extends Disposable {
  constructor(widget, codeEditorService, themeService, chatAgentService) {
    super();
    this.widget = widget;
    this.codeEditorService = codeEditorService;
    this.themeService = themeService;
    this.chatAgentService = chatAgentService;
    this.id = "inputEditorDecorations";
    this.previouslyUsedAgents = /* @__PURE__ */ new Set();
    this.viewModelDisposables = this._register(new MutableDisposable());
    this.codeEditorService.registerDecorationType(decorationDescription, placeholderDecorationType, {});
    this._register(this.themeService.onDidColorThemeChange(() => this.updateRegisteredDecorationTypes()));
    this.updateRegisteredDecorationTypes();
    this.updateInputEditorDecorations();
    this._register(this.widget.inputEditor.onDidChangeModelContent(() => this.updateInputEditorDecorations()));
    this._register(this.widget.onDidChangeParsedInput(() => this.updateInputEditorDecorations()));
    this._register(this.widget.onDidChangeViewModel(() => {
      this.registerViewModelListeners();
      this.previouslyUsedAgents.clear();
      this.updateInputEditorDecorations();
    }));
    this._register(this.widget.onDidSubmitAgent((e) => {
      this.previouslyUsedAgents.add(agentAndCommandToKey(e.agent, e.slashCommand?.name));
    }));
    this._register(this.chatAgentService.onDidChangeAgents(() => this.updateInputEditorDecorations()));
    this.registerViewModelListeners();
  }
  registerViewModelListeners() {
    this.viewModelDisposables.value = this.widget.viewModel?.onDidChange((e) => {
      if (e?.kind === "changePlaceholder" || e?.kind === "initialize") {
        this.updateInputEditorDecorations();
      }
    });
  }
  updateRegisteredDecorationTypes() {
    this.codeEditorService.removeDecorationType(variableTextDecorationType);
    this.codeEditorService.removeDecorationType(dynamicVariableDecorationType);
    this.codeEditorService.removeDecorationType(slashCommandTextDecorationType);
    const theme = this.themeService.getColorTheme();
    this.codeEditorService.registerDecorationType(decorationDescription, slashCommandTextDecorationType, {
      color: theme.getColor(chatSlashCommandForeground)?.toString(),
      backgroundColor: theme.getColor(chatSlashCommandBackground)?.toString(),
      borderRadius: "3px"
    });
    this.codeEditorService.registerDecorationType(decorationDescription, variableTextDecorationType, {
      color: theme.getColor(chatSlashCommandForeground)?.toString(),
      backgroundColor: theme.getColor(chatSlashCommandBackground)?.toString(),
      borderRadius: "3px"
    });
    this.codeEditorService.registerDecorationType(decorationDescription, dynamicVariableDecorationType, {
      color: theme.getColor(chatSlashCommandForeground)?.toString(),
      backgroundColor: theme.getColor(chatSlashCommandBackground)?.toString(),
      borderRadius: "3px"
    });
    this.updateInputEditorDecorations();
  }
  getPlaceholderColor() {
    const theme = this.themeService.getColorTheme();
    const transparentForeground = theme.getColor(inputPlaceholderForeground);
    return transparentForeground?.toString();
  }
  async updateInputEditorDecorations() {
    const inputValue = this.widget.inputEditor.getValue();
    const viewModel = this.widget.viewModel;
    if (!viewModel) {
      return;
    }
    if (!inputValue) {
      const defaultAgent = this.chatAgentService.getDefaultAgent(this.widget.location, this.widget.input.currentMode);
      const decoration = [
        {
          range: {
            startLineNumber: 1,
            endLineNumber: 1,
            startColumn: 1,
            endColumn: 1e3
          },
          renderOptions: {
            after: {
              contentText: viewModel.inputPlaceholder || (defaultAgent?.description ?? ""),
              color: this.getPlaceholderColor()
            }
          }
        }
      ];
      this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, decoration);
      return;
    }
    const parsedRequest = this.widget.parsedInput.parts;
    let placeholderDecoration;
    const agentPart = parsedRequest.find((p) => p instanceof ChatRequestAgentPart);
    const agentSubcommandPart = parsedRequest.find((p) => p instanceof ChatRequestAgentSubcommandPart);
    const slashCommandPart = parsedRequest.find((p) => p instanceof ChatRequestSlashCommandPart);
    const exactlyOneSpaceAfterPart = (part) => {
      const partIdx = parsedRequest.indexOf(part);
      if (parsedRequest.length > partIdx + 2) {
        return false;
      }
      const nextPart = parsedRequest[partIdx + 1];
      return nextPart && nextPart instanceof ChatRequestTextPart && nextPart.text === " ";
    };
    const getRangeForPlaceholder = (part) => ({
      startLineNumber: part.editorRange.startLineNumber,
      endLineNumber: part.editorRange.endLineNumber,
      startColumn: part.editorRange.endColumn + 1,
      endColumn: 1e3
    });
    const onlyAgentAndWhitespace = agentPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart);
    if (onlyAgentAndWhitespace) {
      const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, void 0));
      const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentPart.agent.metadata.followupPlaceholder;
      if (agentPart.agent.description && exactlyOneSpaceAfterPart(agentPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentPart),
          renderOptions: {
            after: {
              contentText: shouldRenderFollowupPlaceholder ? agentPart.agent.metadata.followupPlaceholder : agentPart.agent.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    const onlyAgentAndAgentCommandAndWhitespace = agentPart && agentSubcommandPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart);
    if (onlyAgentAndAgentCommandAndWhitespace) {
      const isFollowupSlashCommand = this.previouslyUsedAgents.has(agentAndCommandToKey(agentPart.agent, agentSubcommandPart.command.name));
      const shouldRenderFollowupPlaceholder = isFollowupSlashCommand && agentSubcommandPart.command.followupPlaceholder;
      if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(agentSubcommandPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentSubcommandPart),
          renderOptions: {
            after: {
              contentText: shouldRenderFollowupPlaceholder ? agentSubcommandPart.command.followupPlaceholder : agentSubcommandPart.command.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    const onlyAgentCommandAndWhitespace = agentSubcommandPart && parsedRequest.every((p) => p instanceof ChatRequestTextPart && !p.text.trim().length || p instanceof ChatRequestAgentSubcommandPart);
    if (onlyAgentCommandAndWhitespace) {
      if (agentSubcommandPart?.command.description && exactlyOneSpaceAfterPart(agentSubcommandPart)) {
        placeholderDecoration = [{
          range: getRangeForPlaceholder(agentSubcommandPart),
          renderOptions: {
            after: {
              contentText: agentSubcommandPart.command.description,
              color: this.getPlaceholderColor()
            }
          }
        }];
      }
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, placeholderDecorationType, placeholderDecoration ?? []);
    const textDecorations = [];
    if (agentPart) {
      textDecorations.push({ range: agentPart.editorRange });
    }
    if (agentSubcommandPart) {
      textDecorations.push({ range: agentSubcommandPart.editorRange, hoverMessage: new MarkdownString(agentSubcommandPart.command.description) });
    }
    if (slashCommandPart) {
      textDecorations.push({ range: slashCommandPart.editorRange });
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, slashCommandTextDecorationType, textDecorations);
    const varDecorations = [];
    const toolParts = parsedRequest.filter((p) => p instanceof ChatRequestToolPart);
    for (const tool of toolParts) {
      varDecorations.push({ range: tool.editorRange });
    }
    this.widget.inputEditor.setDecorationsByType(decorationDescription, variableTextDecorationType, varDecorations);
  }
};
InputEditorDecorations = __decorateClass([
  __decorateParam(1, ICodeEditorService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IChatAgentService)
], InputEditorDecorations);
class InputEditorSlashCommandMode extends Disposable {
  constructor(widget) {
    super();
    this.widget = widget;
    this.id = "InputEditorSlashCommandMode";
    this._register(this.widget.onDidChangeAgent((e) => {
      if (e.slashCommand && e.slashCommand.isSticky || !e.slashCommand && e.agent.metadata.isSticky) {
        this.repopulateAgentCommand(e.agent, e.slashCommand);
      }
    }));
    this._register(this.widget.onDidSubmitAgent((e) => {
      this.repopulateAgentCommand(e.agent, e.slashCommand);
    }));
  }
  async repopulateAgentCommand(agent, slashCommand) {
    if (this.widget.inputEditor.getValue().trim()) {
      return;
    }
    let value;
    if (slashCommand && slashCommand.isSticky) {
      value = `${chatAgentLeader}${agent.name} ${chatSubcommandLeader}${slashCommand.name} `;
    } else if (agent.metadata.isSticky) {
      value = `${chatAgentLeader}${agent.name} `;
    }
    if (value) {
      this.widget.inputEditor.setValue(value);
      this.widget.inputEditor.setPosition({ lineNumber: 1, column: value.length + 1 });
    }
  }
}
ChatWidget.CONTRIBS.push(InputEditorDecorations, InputEditorSlashCommandMode);
let ChatTokenDeleter = class extends Disposable {
  constructor(widget, instantiationService) {
    super();
    this.widget = widget;
    this.instantiationService = instantiationService;
    this.id = "chatTokenDeleter";
    const parser = this.instantiationService.createInstance(ChatRequestParser);
    const inputValue = this.widget.inputEditor.getValue();
    let previousInputValue;
    let previousSelectedAgent;
    this._register(this.widget.inputEditor.onDidChangeModelContent((e) => {
      if (!previousInputValue) {
        previousInputValue = inputValue;
        previousSelectedAgent = this.widget.lastSelectedAgent;
      }
      const change = e.changes[0];
      if (!change.text && this.widget.viewModel) {
        const previousParsedValue = parser.parseChatRequest(this.widget.viewModel.sessionId, previousInputValue, widget.location, { selectedAgent: previousSelectedAgent, mode: this.widget.input.currentMode });
        const deletableTokens = previousParsedValue.parts.filter((p) => p instanceof ChatRequestAgentPart || p instanceof ChatRequestAgentSubcommandPart || p instanceof ChatRequestSlashCommandPart || p instanceof ChatRequestToolPart);
        deletableTokens.forEach((token) => {
          const deletedRangeOfToken = Range.intersectRanges(token.editorRange, change.range);
          if (deletedRangeOfToken && Range.compareRangesUsingStarts(token.editorRange, change.range) < 0) {
            const length = deletedRangeOfToken.endColumn - deletedRangeOfToken.startColumn;
            const rangeToDelete = new Range(token.editorRange.startLineNumber, token.editorRange.startColumn, token.editorRange.endLineNumber, token.editorRange.endColumn - length);
            this.widget.inputEditor.executeEdits(this.id, [{
              range: rangeToDelete,
              text: ""
            }]);
            this.widget.refreshParsedInput();
          }
        });
      }
      previousInputValue = this.widget.inputEditor.getValue();
      previousSelectedAgent = this.widget.lastSelectedAgent;
    }));
  }
};
ChatTokenDeleter = __decorateClass([
  __decorateParam(1, IInstantiationService)
], ChatTokenDeleter);
ChatWidget.CONTRIBS.push(ChatTokenDeleter);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW5wdXRFZGl0b3JDb250cmliLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGlucHV0UGxhY2Vob2xkZXJGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudENvbW1hbmQsIElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IGNoYXRTbGFzaENvbW1hbmRCYWNrZ3JvdW5kLCBjaGF0U2xhc2hDb21tYW5kRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0Q29sb3JzLmpzJztcbmltcG9ydCB7IENoYXRSZXF1ZXN0QWdlbnRQYXJ0LCBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQsIENoYXRSZXF1ZXN0U2xhc2hDb21tYW5kUGFydCwgQ2hhdFJlcXVlc3RUZXh0UGFydCwgQ2hhdFJlcXVlc3RUb29sUGFydCwgSVBhcnNlZENoYXRSZXF1ZXN0UGFydCwgY2hhdEFnZW50TGVhZGVyLCBjaGF0U3ViY29tbWFuZExlYWRlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0UGFyc2VyVHlwZXMuanMnO1xuaW1wb3J0IHsgQ2hhdFJlcXVlc3RQYXJzZXIgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFJlcXVlc3RQYXJzZXIuanMnO1xuaW1wb3J0IHsgSUNoYXRXaWRnZXQgfSBmcm9tICcuLi9jaGF0LmpzJztcbmltcG9ydCB7IENoYXRXaWRnZXQgfSBmcm9tICcuLi9jaGF0V2lkZ2V0LmpzJztcbmltcG9ydCB7IGR5bmFtaWNWYXJpYWJsZURlY29yYXRpb25UeXBlIH0gZnJvbSAnLi9jaGF0RHluYW1pY1ZhcmlhYmxlcy5qcyc7XG5cbmNvbnN0IGRlY29yYXRpb25EZXNjcmlwdGlvbiA9ICdjaGF0JztcbmNvbnN0IHBsYWNlaG9sZGVyRGVjb3JhdGlvblR5cGUgPSAnY2hhdC1zZXNzaW9uLWRldGFpbCc7XG5jb25zdCBzbGFzaENvbW1hbmRUZXh0RGVjb3JhdGlvblR5cGUgPSAnY2hhdC1zZXNzaW9uLXRleHQnO1xuY29uc3QgdmFyaWFibGVUZXh0RGVjb3JhdGlvblR5cGUgPSAnY2hhdC12YXJpYWJsZS10ZXh0JztcblxuZnVuY3Rpb24gYWdlbnRBbmRDb21tYW5kVG9LZXkoYWdlbnQ6IElDaGF0QWdlbnREYXRhLCBzdWJjb21tYW5kOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuXHRyZXR1cm4gc3ViY29tbWFuZCA/IGAke2FnZW50LmlkfV9fJHtzdWJjb21tYW5kfWAgOiBhZ2VudC5pZDtcbn1cblxuY2xhc3MgSW5wdXRFZGl0b3JEZWNvcmF0aW9ucyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHB1YmxpYyByZWFkb25seSBpZCA9ICdpbnB1dEVkaXRvckRlY29yYXRpb25zJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IHByZXZpb3VzbHlVc2VkQWdlbnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2aWV3TW9kZWxEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHdpZGdldDogSUNoYXRXaWRnZXQsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvZGVFZGl0b3JTZXJ2aWNlOiBJQ29kZUVkaXRvclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvblR5cGUoZGVjb3JhdGlvbkRlc2NyaXB0aW9uLCBwbGFjZWhvbGRlckRlY29yYXRpb25UeXBlLCB7fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVSZWdpc3RlcmVkRGVjb3JhdGlvblR5cGVzKCkpKTtcblx0XHR0aGlzLnVwZGF0ZVJlZ2lzdGVyZWREZWNvcmF0aW9uVHlwZXMoKTtcblxuXHRcdHRoaXMudXBkYXRlSW5wdXRFZGl0b3JEZWNvcmF0aW9ucygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KCgpID0+IHRoaXMudXBkYXRlSW5wdXRFZGl0b3JEZWNvcmF0aW9ucygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53aWRnZXQub25EaWRDaGFuZ2VQYXJzZWRJbnB1dCgoKSA9PiB0aGlzLnVwZGF0ZUlucHV0RWRpdG9yRGVjb3JhdGlvbnMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2lkZ2V0Lm9uRGlkQ2hhbmdlVmlld01vZGVsKCgpID0+IHtcblx0XHRcdHRoaXMucmVnaXN0ZXJWaWV3TW9kZWxMaXN0ZW5lcnMoKTtcblx0XHRcdHRoaXMucHJldmlvdXNseVVzZWRBZ2VudHMuY2xlYXIoKTtcblx0XHRcdHRoaXMudXBkYXRlSW5wdXRFZGl0b3JEZWNvcmF0aW9ucygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndpZGdldC5vbkRpZFN1Ym1pdEFnZW50KChlKSA9PiB7XG5cdFx0XHR0aGlzLnByZXZpb3VzbHlVc2VkQWdlbnRzLmFkZChhZ2VudEFuZENvbW1hbmRUb0tleShlLmFnZW50LCBlLnNsYXNoQ29tbWFuZD8ubmFtZSkpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHMoKCkgPT4gdGhpcy51cGRhdGVJbnB1dEVkaXRvckRlY29yYXRpb25zKCkpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJWaWV3TW9kZWxMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJWaWV3TW9kZWxMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3TW9kZWxEaXNwb3NhYmxlcy52YWx1ZSA9IHRoaXMud2lkZ2V0LnZpZXdNb2RlbD8ub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZT8ua2luZCA9PT0gJ2NoYW5nZVBsYWNlaG9sZGVyJyB8fCBlPy5raW5kID09PSAnaW5pdGlhbGl6ZScpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVJbnB1dEVkaXRvckRlY29yYXRpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVJlZ2lzdGVyZWREZWNvcmF0aW9uVHlwZXMoKSB7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZW1vdmVEZWNvcmF0aW9uVHlwZSh2YXJpYWJsZVRleHREZWNvcmF0aW9uVHlwZSk7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZW1vdmVEZWNvcmF0aW9uVHlwZShkeW5hbWljVmFyaWFibGVEZWNvcmF0aW9uVHlwZSk7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZW1vdmVEZWNvcmF0aW9uVHlwZShzbGFzaENvbW1hbmRUZXh0RGVjb3JhdGlvblR5cGUpO1xuXG5cdFx0Y29uc3QgdGhlbWUgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZWdpc3RlckRlY29yYXRpb25UeXBlKGRlY29yYXRpb25EZXNjcmlwdGlvbiwgc2xhc2hDb21tYW5kVGV4dERlY29yYXRpb25UeXBlLCB7XG5cdFx0XHRjb2xvcjogdGhlbWUuZ2V0Q29sb3IoY2hhdFNsYXNoQ29tbWFuZEZvcmVncm91bmQpPy50b1N0cmluZygpLFxuXHRcdFx0YmFja2dyb3VuZENvbG9yOiB0aGVtZS5nZXRDb2xvcihjaGF0U2xhc2hDb21tYW5kQmFja2dyb3VuZCk/LnRvU3RyaW5nKCksXG5cdFx0XHRib3JkZXJSYWRpdXM6ICczcHgnXG5cdFx0fSk7XG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZWdpc3RlckRlY29yYXRpb25UeXBlKGRlY29yYXRpb25EZXNjcmlwdGlvbiwgdmFyaWFibGVUZXh0RGVjb3JhdGlvblR5cGUsIHtcblx0XHRcdGNvbG9yOiB0aGVtZS5nZXRDb2xvcihjaGF0U2xhc2hDb21tYW5kRm9yZWdyb3VuZCk/LnRvU3RyaW5nKCksXG5cdFx0XHRiYWNrZ3JvdW5kQ29sb3I6IHRoZW1lLmdldENvbG9yKGNoYXRTbGFzaENvbW1hbmRCYWNrZ3JvdW5kKT8udG9TdHJpbmcoKSxcblx0XHRcdGJvcmRlclJhZGl1czogJzNweCdcblx0XHR9KTtcblx0XHR0aGlzLmNvZGVFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvblR5cGUoZGVjb3JhdGlvbkRlc2NyaXB0aW9uLCBkeW5hbWljVmFyaWFibGVEZWNvcmF0aW9uVHlwZSwge1xuXHRcdFx0Y29sb3I6IHRoZW1lLmdldENvbG9yKGNoYXRTbGFzaENvbW1hbmRGb3JlZ3JvdW5kKT8udG9TdHJpbmcoKSxcblx0XHRcdGJhY2tncm91bmRDb2xvcjogdGhlbWUuZ2V0Q29sb3IoY2hhdFNsYXNoQ29tbWFuZEJhY2tncm91bmQpPy50b1N0cmluZygpLFxuXHRcdFx0Ym9yZGVyUmFkaXVzOiAnM3B4J1xuXHRcdH0pO1xuXHRcdHRoaXMudXBkYXRlSW5wdXRFZGl0b3JEZWNvcmF0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRQbGFjZWhvbGRlckNvbG9yKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdGhlbWUgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0Y29uc3QgdHJhbnNwYXJlbnRGb3JlZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoaW5wdXRQbGFjZWhvbGRlckZvcmVncm91bmQpO1xuXHRcdHJldHVybiB0cmFuc3BhcmVudEZvcmVncm91bmQ/LnRvU3RyaW5nKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUlucHV0RWRpdG9yRGVjb3JhdGlvbnMoKSB7XG5cdFx0Y29uc3QgaW5wdXRWYWx1ZSA9IHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLmdldFZhbHVlKCk7XG5cblx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLndpZGdldC52aWV3TW9kZWw7XG5cdFx0aWYgKCF2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWlucHV0VmFsdWUpIHtcblx0XHRcdGNvbnN0IGRlZmF1bHRBZ2VudCA9IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQodGhpcy53aWRnZXQubG9jYXRpb24sIHRoaXMud2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlKTtcblx0XHRcdGNvbnN0IGRlY29yYXRpb246IElEZWNvcmF0aW9uT3B0aW9uc1tdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cmFuZ2U6IHtcblx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0XHRcdGVuZENvbHVtbjogMTAwMFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVuZGVyT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRcdFx0Y29udGVudFRleHQ6IHZpZXdNb2RlbC5pbnB1dFBsYWNlaG9sZGVyIHx8IChkZWZhdWx0QWdlbnQ/LmRlc2NyaXB0aW9uID8/ICcnKSxcblx0XHRcdFx0XHRcdFx0Y29sb3I6IHRoaXMuZ2V0UGxhY2Vob2xkZXJDb2xvcigpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRdO1xuXHRcdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0RGVjb3JhdGlvbnNCeVR5cGUoZGVjb3JhdGlvbkRlc2NyaXB0aW9uLCBwbGFjZWhvbGRlckRlY29yYXRpb25UeXBlLCBkZWNvcmF0aW9uKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJzZWRSZXF1ZXN0ID0gdGhpcy53aWRnZXQucGFyc2VkSW5wdXQucGFydHM7XG5cblx0XHRsZXQgcGxhY2Vob2xkZXJEZWNvcmF0aW9uOiBJRGVjb3JhdGlvbk9wdGlvbnNbXSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBhZ2VudFBhcnQgPSBwYXJzZWRSZXF1ZXN0LmZpbmQoKHApOiBwIGlzIENoYXRSZXF1ZXN0QWdlbnRQYXJ0ID0+IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50UGFydCk7XG5cdFx0Y29uc3QgYWdlbnRTdWJjb21tYW5kUGFydCA9IHBhcnNlZFJlcXVlc3QuZmluZCgocCk6IHAgaXMgQ2hhdFJlcXVlc3RBZ2VudFN1YmNvbW1hbmRQYXJ0ID0+IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQpO1xuXHRcdGNvbnN0IHNsYXNoQ29tbWFuZFBhcnQgPSBwYXJzZWRSZXF1ZXN0LmZpbmQoKHApOiBwIGlzIENoYXRSZXF1ZXN0U2xhc2hDb21tYW5kUGFydCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RTbGFzaENvbW1hbmRQYXJ0KTtcblxuXHRcdGNvbnN0IGV4YWN0bHlPbmVTcGFjZUFmdGVyUGFydCA9IChwYXJ0OiBJUGFyc2VkQ2hhdFJlcXVlc3RQYXJ0KTogYm9vbGVhbiA9PiB7XG5cdFx0XHRjb25zdCBwYXJ0SWR4ID0gcGFyc2VkUmVxdWVzdC5pbmRleE9mKHBhcnQpO1xuXHRcdFx0aWYgKHBhcnNlZFJlcXVlc3QubGVuZ3RoID4gcGFydElkeCArIDIpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuZXh0UGFydCA9IHBhcnNlZFJlcXVlc3RbcGFydElkeCArIDFdO1xuXHRcdFx0cmV0dXJuIG5leHRQYXJ0ICYmIG5leHRQYXJ0IGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RUZXh0UGFydCAmJiBuZXh0UGFydC50ZXh0ID09PSAnICc7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGdldFJhbmdlRm9yUGxhY2Vob2xkZXIgPSAocGFydDogSVBhcnNlZENoYXRSZXF1ZXN0UGFydCkgPT4gKHtcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogcGFydC5lZGl0b3JSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRlbmRMaW5lTnVtYmVyOiBwYXJ0LmVkaXRvclJhbmdlLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRzdGFydENvbHVtbjogcGFydC5lZGl0b3JSYW5nZS5lbmRDb2x1bW4gKyAxLFxuXHRcdFx0ZW5kQ29sdW1uOiAxMDAwXG5cdFx0fSk7XG5cblx0XHRjb25zdCBvbmx5QWdlbnRBbmRXaGl0ZXNwYWNlID0gYWdlbnRQYXJ0ICYmIHBhcnNlZFJlcXVlc3QuZXZlcnkocCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RUZXh0UGFydCAmJiAhcC50ZXh0LnRyaW0oKS5sZW5ndGggfHwgcCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0KTtcblx0XHRpZiAob25seUFnZW50QW5kV2hpdGVzcGFjZSkge1xuXHRcdFx0Ly8gQWdlbnQgcmVmZXJlbmNlIHdpdGggbm8gb3RoZXIgdGV4dCAtIHNob3cgdGhlIHBsYWNlaG9sZGVyXG5cdFx0XHRjb25zdCBpc0ZvbGxvd3VwU2xhc2hDb21tYW5kID0gdGhpcy5wcmV2aW91c2x5VXNlZEFnZW50cy5oYXMoYWdlbnRBbmRDb21tYW5kVG9LZXkoYWdlbnRQYXJ0LmFnZW50LCB1bmRlZmluZWQpKTtcblx0XHRcdGNvbnN0IHNob3VsZFJlbmRlckZvbGxvd3VwUGxhY2Vob2xkZXIgPSBpc0ZvbGxvd3VwU2xhc2hDb21tYW5kICYmIGFnZW50UGFydC5hZ2VudC5tZXRhZGF0YS5mb2xsb3d1cFBsYWNlaG9sZGVyO1xuXHRcdFx0aWYgKGFnZW50UGFydC5hZ2VudC5kZXNjcmlwdGlvbiAmJiBleGFjdGx5T25lU3BhY2VBZnRlclBhcnQoYWdlbnRQYXJ0KSkge1xuXHRcdFx0XHRwbGFjZWhvbGRlckRlY29yYXRpb24gPSBbe1xuXHRcdFx0XHRcdHJhbmdlOiBnZXRSYW5nZUZvclBsYWNlaG9sZGVyKGFnZW50UGFydCksXG5cdFx0XHRcdFx0cmVuZGVyT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRcdFx0Y29udGVudFRleHQ6IHNob3VsZFJlbmRlckZvbGxvd3VwUGxhY2Vob2xkZXIgPyBhZ2VudFBhcnQuYWdlbnQubWV0YWRhdGEuZm9sbG93dXBQbGFjZWhvbGRlciA6IGFnZW50UGFydC5hZ2VudC5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdFx0Y29sb3I6IHRoaXMuZ2V0UGxhY2Vob2xkZXJDb2xvcigpLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb25seUFnZW50QW5kQWdlbnRDb21tYW5kQW5kV2hpdGVzcGFjZSA9IGFnZW50UGFydCAmJiBhZ2VudFN1YmNvbW1hbmRQYXJ0ICYmIHBhcnNlZFJlcXVlc3QuZXZlcnkocCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RUZXh0UGFydCAmJiAhcC50ZXh0LnRyaW0oKS5sZW5ndGggfHwgcCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0IHx8IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQpO1xuXHRcdGlmIChvbmx5QWdlbnRBbmRBZ2VudENvbW1hbmRBbmRXaGl0ZXNwYWNlKSB7XG5cdFx0XHQvLyBBZ2VudCByZWZlcmVuY2UgYW5kIHN1YmNvbW1hbmQgd2l0aCBubyBvdGhlciB0ZXh0IC0gc2hvdyB0aGUgcGxhY2Vob2xkZXJcblx0XHRcdGNvbnN0IGlzRm9sbG93dXBTbGFzaENvbW1hbmQgPSB0aGlzLnByZXZpb3VzbHlVc2VkQWdlbnRzLmhhcyhhZ2VudEFuZENvbW1hbmRUb0tleShhZ2VudFBhcnQuYWdlbnQsIGFnZW50U3ViY29tbWFuZFBhcnQuY29tbWFuZC5uYW1lKSk7XG5cdFx0XHRjb25zdCBzaG91bGRSZW5kZXJGb2xsb3d1cFBsYWNlaG9sZGVyID0gaXNGb2xsb3d1cFNsYXNoQ29tbWFuZCAmJiBhZ2VudFN1YmNvbW1hbmRQYXJ0LmNvbW1hbmQuZm9sbG93dXBQbGFjZWhvbGRlcjtcblx0XHRcdGlmIChhZ2VudFN1YmNvbW1hbmRQYXJ0Py5jb21tYW5kLmRlc2NyaXB0aW9uICYmIGV4YWN0bHlPbmVTcGFjZUFmdGVyUGFydChhZ2VudFN1YmNvbW1hbmRQYXJ0KSkge1xuXHRcdFx0XHRwbGFjZWhvbGRlckRlY29yYXRpb24gPSBbe1xuXHRcdFx0XHRcdHJhbmdlOiBnZXRSYW5nZUZvclBsYWNlaG9sZGVyKGFnZW50U3ViY29tbWFuZFBhcnQpLFxuXHRcdFx0XHRcdHJlbmRlck9wdGlvbnM6IHtcblx0XHRcdFx0XHRcdGFmdGVyOiB7XG5cdFx0XHRcdFx0XHRcdGNvbnRlbnRUZXh0OiBzaG91bGRSZW5kZXJGb2xsb3d1cFBsYWNlaG9sZGVyID8gYWdlbnRTdWJjb21tYW5kUGFydC5jb21tYW5kLmZvbGxvd3VwUGxhY2Vob2xkZXIgOiBhZ2VudFN1YmNvbW1hbmRQYXJ0LmNvbW1hbmQuZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0XHRcdGNvbG9yOiB0aGlzLmdldFBsYWNlaG9sZGVyQ29sb3IoKSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG9ubHlBZ2VudENvbW1hbmRBbmRXaGl0ZXNwYWNlID0gYWdlbnRTdWJjb21tYW5kUGFydCAmJiBwYXJzZWRSZXF1ZXN0LmV2ZXJ5KHAgPT4gcCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0VGV4dFBhcnQgJiYgIXAudGV4dC50cmltKCkubGVuZ3RoIHx8IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQpO1xuXHRcdGlmIChvbmx5QWdlbnRDb21tYW5kQW5kV2hpdGVzcGFjZSkge1xuXHRcdFx0Ly8gQWdlbnQgc3ViY29tbWFuZCB3aXRoIG5vIG90aGVyIHRleHQgLSBzaG93IHRoZSBwbGFjZWhvbGRlclxuXHRcdFx0aWYgKGFnZW50U3ViY29tbWFuZFBhcnQ/LmNvbW1hbmQuZGVzY3JpcHRpb24gJiYgZXhhY3RseU9uZVNwYWNlQWZ0ZXJQYXJ0KGFnZW50U3ViY29tbWFuZFBhcnQpKSB7XG5cdFx0XHRcdHBsYWNlaG9sZGVyRGVjb3JhdGlvbiA9IFt7XG5cdFx0XHRcdFx0cmFuZ2U6IGdldFJhbmdlRm9yUGxhY2Vob2xkZXIoYWdlbnRTdWJjb21tYW5kUGFydCksXG5cdFx0XHRcdFx0cmVuZGVyT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRcdFx0Y29udGVudFRleHQ6IGFnZW50U3ViY29tbWFuZFBhcnQuY29tbWFuZC5kZXNjcmlwdGlvbixcblx0XHRcdFx0XHRcdFx0Y29sb3I6IHRoaXMuZ2V0UGxhY2Vob2xkZXJDb2xvcigpLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0RGVjb3JhdGlvbnNCeVR5cGUoZGVjb3JhdGlvbkRlc2NyaXB0aW9uLCBwbGFjZWhvbGRlckRlY29yYXRpb25UeXBlLCBwbGFjZWhvbGRlckRlY29yYXRpb24gPz8gW10pO1xuXG5cdFx0Y29uc3QgdGV4dERlY29yYXRpb25zOiBJRGVjb3JhdGlvbk9wdGlvbnNbXSB8IHVuZGVmaW5lZCA9IFtdO1xuXHRcdGlmIChhZ2VudFBhcnQpIHtcblx0XHRcdHRleHREZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IGFnZW50UGFydC5lZGl0b3JSYW5nZSB9KTtcblx0XHR9XG5cdFx0aWYgKGFnZW50U3ViY29tbWFuZFBhcnQpIHtcblx0XHRcdHRleHREZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IGFnZW50U3ViY29tbWFuZFBhcnQuZWRpdG9yUmFuZ2UsIGhvdmVyTWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGFnZW50U3ViY29tbWFuZFBhcnQuY29tbWFuZC5kZXNjcmlwdGlvbikgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNsYXNoQ29tbWFuZFBhcnQpIHtcblx0XHRcdHRleHREZWNvcmF0aW9ucy5wdXNoKHsgcmFuZ2U6IHNsYXNoQ29tbWFuZFBhcnQuZWRpdG9yUmFuZ2UgfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy53aWRnZXQuaW5wdXRFZGl0b3Iuc2V0RGVjb3JhdGlvbnNCeVR5cGUoZGVjb3JhdGlvbkRlc2NyaXB0aW9uLCBzbGFzaENvbW1hbmRUZXh0RGVjb3JhdGlvblR5cGUsIHRleHREZWNvcmF0aW9ucyk7XG5cblx0XHRjb25zdCB2YXJEZWNvcmF0aW9uczogSURlY29yYXRpb25PcHRpb25zW10gPSBbXTtcblx0XHRjb25zdCB0b29sUGFydHMgPSBwYXJzZWRSZXF1ZXN0LmZpbHRlcigocCk6IHAgaXMgQ2hhdFJlcXVlc3RUb29sUGFydCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RUb29sUGFydCk7XG5cdFx0Zm9yIChjb25zdCB0b29sIG9mIHRvb2xQYXJ0cykge1xuXHRcdFx0dmFyRGVjb3JhdGlvbnMucHVzaCh7IHJhbmdlOiB0b29sLmVkaXRvclJhbmdlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLnNldERlY29yYXRpb25zQnlUeXBlKGRlY29yYXRpb25EZXNjcmlwdGlvbiwgdmFyaWFibGVUZXh0RGVjb3JhdGlvblR5cGUsIHZhckRlY29yYXRpb25zKTtcblx0fVxufVxuXG5jbGFzcyBJbnB1dEVkaXRvclNsYXNoQ29tbWFuZE1vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGlkID0gJ0lucHV0RWRpdG9yU2xhc2hDb21tYW5kTW9kZSc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3aWRnZXQ6IElDaGF0V2lkZ2V0XG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53aWRnZXQub25EaWRDaGFuZ2VBZ2VudChlID0+IHtcblx0XHRcdGlmIChlLnNsYXNoQ29tbWFuZCAmJiBlLnNsYXNoQ29tbWFuZC5pc1N0aWNreSB8fCAhZS5zbGFzaENvbW1hbmQgJiYgZS5hZ2VudC5tZXRhZGF0YS5pc1N0aWNreSkge1xuXHRcdFx0XHR0aGlzLnJlcG9wdWxhdGVBZ2VudENvbW1hbmQoZS5hZ2VudCwgZS5zbGFzaENvbW1hbmQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndpZGdldC5vbkRpZFN1Ym1pdEFnZW50KGUgPT4ge1xuXHRcdFx0dGhpcy5yZXBvcHVsYXRlQWdlbnRDb21tYW5kKGUuYWdlbnQsIGUuc2xhc2hDb21tYW5kKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlcG9wdWxhdGVBZ2VudENvbW1hbmQoYWdlbnQ6IElDaGF0QWdlbnREYXRhLCBzbGFzaENvbW1hbmQ6IElDaGF0QWdlbnRDb21tYW5kIHwgdW5kZWZpbmVkKSB7XG5cdFx0Ly8gTWFrZSBzdXJlIHdlIGRvbid0IHJlcG9wdWxhdGUgaWYgdGhlIHVzZXIgYWxyZWFkeSBoYXMgc29tZXRoaW5nIGluIHRoZSBpbnB1dFxuXHRcdGlmICh0aGlzLndpZGdldC5pbnB1dEVkaXRvci5nZXRWYWx1ZSgpLnRyaW0oKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCB2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChzbGFzaENvbW1hbmQgJiYgc2xhc2hDb21tYW5kLmlzU3RpY2t5KSB7XG5cdFx0XHR2YWx1ZSA9IGAke2NoYXRBZ2VudExlYWRlcn0ke2FnZW50Lm5hbWV9ICR7Y2hhdFN1YmNvbW1hbmRMZWFkZXJ9JHtzbGFzaENvbW1hbmQubmFtZX0gYDtcblx0XHR9IGVsc2UgaWYgKGFnZW50Lm1ldGFkYXRhLmlzU3RpY2t5KSB7XG5cdFx0XHR2YWx1ZSA9IGAke2NoYXRBZ2VudExlYWRlcn0ke2FnZW50Lm5hbWV9IGA7XG5cdFx0fVxuXG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHR0aGlzLndpZGdldC5pbnB1dEVkaXRvci5zZXRWYWx1ZSh2YWx1ZSk7XG5cdFx0XHR0aGlzLndpZGdldC5pbnB1dEVkaXRvci5zZXRQb3NpdGlvbih7IGxpbmVOdW1iZXI6IDEsIGNvbHVtbjogdmFsdWUubGVuZ3RoICsgMSB9KTtcblx0XHR9XG5cdH1cbn1cblxuQ2hhdFdpZGdldC5DT05UUklCUy5wdXNoKElucHV0RWRpdG9yRGVjb3JhdGlvbnMsIElucHV0RWRpdG9yU2xhc2hDb21tYW5kTW9kZSk7XG5cbmNsYXNzIENoYXRUb2tlbkRlbGV0ZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwdWJsaWMgcmVhZG9ubHkgaWQgPSAnY2hhdFRva2VuRGVsZXRlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3aWRnZXQ6IElDaGF0V2lkZ2V0LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IHBhcnNlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFJlcXVlc3RQYXJzZXIpO1xuXHRcdGNvbnN0IGlucHV0VmFsdWUgPSB0aGlzLndpZGdldC5pbnB1dEVkaXRvci5nZXRWYWx1ZSgpO1xuXHRcdGxldCBwcmV2aW91c0lucHV0VmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcHJldmlvdXNTZWxlY3RlZEFnZW50OiBJQ2hhdEFnZW50RGF0YSB8IHVuZGVmaW5lZDtcblxuXHRcdC8vIEEgc2ltcGxlIGhldXJpc3RpYyB0byBkZWxldGUgdGhlIHByZXZpb3VzIHRva2VuIHdoZW4gdGhlIHVzZXIgcHJlc3NlcyBiYWNrc3BhY2UuXG5cdFx0Ly8gVGhlIHNvcGhpc3RpY2F0ZWQgd2F5IHRvIGRvIHRoaXMgd291bGQgYmUgdG8gaGF2ZSBhIHBhcnNlIHRyZWUgdGhhdCBjYW4gYmUgdXBkYXRlZCBpbmNyZW1lbnRhbGx5LlxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KGUgPT4ge1xuXHRcdFx0aWYgKCFwcmV2aW91c0lucHV0VmFsdWUpIHtcblx0XHRcdFx0cHJldmlvdXNJbnB1dFZhbHVlID0gaW5wdXRWYWx1ZTtcblx0XHRcdFx0cHJldmlvdXNTZWxlY3RlZEFnZW50ID0gdGhpcy53aWRnZXQubGFzdFNlbGVjdGVkQWdlbnQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERvbid0IHRyeSB0byBoYW5kbGUgbXVsdGljdXJzb3IgZWRpdHMgcmlnaHQgbm93XG5cdFx0XHRjb25zdCBjaGFuZ2UgPSBlLmNoYW5nZXNbMF07XG5cblx0XHRcdC8vIElmIHRoaXMgd2FzIGEgc2ltcGxlIGRlbGV0ZSwgdHJ5IHRvIGZpbmQgb3V0IHdoZXRoZXIgaXQgd2FzIGluc2lkZSBhIHRva2VuXG5cdFx0XHRpZiAoIWNoYW5nZS50ZXh0ICYmIHRoaXMud2lkZ2V0LnZpZXdNb2RlbCkge1xuXHRcdFx0XHRjb25zdCBwcmV2aW91c1BhcnNlZFZhbHVlID0gcGFyc2VyLnBhcnNlQ2hhdFJlcXVlc3QodGhpcy53aWRnZXQudmlld01vZGVsLnNlc3Npb25JZCwgcHJldmlvdXNJbnB1dFZhbHVlLCB3aWRnZXQubG9jYXRpb24sIHsgc2VsZWN0ZWRBZ2VudDogcHJldmlvdXNTZWxlY3RlZEFnZW50LCBtb2RlOiB0aGlzLndpZGdldC5pbnB1dC5jdXJyZW50TW9kZSB9KTtcblxuXHRcdFx0XHQvLyBGb3IgZHluYW1pYyB2YXJpYWJsZXMsIHRoaXMgaGFzIHRvIGhhcHBlbiBpbiBDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWwgd2l0aCB0aGUgb3RoZXIgYm9va2tlZXBpbmdcblx0XHRcdFx0Y29uc3QgZGVsZXRhYmxlVG9rZW5zID0gcHJldmlvdXNQYXJzZWRWYWx1ZS5wYXJ0cy5maWx0ZXIocCA9PiBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RBZ2VudFBhcnQgfHwgcCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRTdWJjb21tYW5kUGFydCB8fCBwIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RTbGFzaENvbW1hbmRQYXJ0IHx8IHAgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdFRvb2xQYXJ0KTtcblx0XHRcdFx0ZGVsZXRhYmxlVG9rZW5zLmZvckVhY2godG9rZW4gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGRlbGV0ZWRSYW5nZU9mVG9rZW4gPSBSYW5nZS5pbnRlcnNlY3RSYW5nZXModG9rZW4uZWRpdG9yUmFuZ2UsIGNoYW5nZS5yYW5nZSk7XG5cdFx0XHRcdFx0Ly8gUGFydCBvZiB0aGlzIHRva2VuIHdhcyBkZWxldGVkLCBvciB0aGUgc3BhY2UgYWZ0ZXIgaXQgd2FzIGRlbGV0ZWQsIGFuZCB0aGUgZGVsZXRpb24gcmFuZ2UgZG9lc24ndCBnbyBvZmYgdGhlIGZyb250IG9mIHRoZSB0b2tlbiwgZm9yIHNpbXBsZXIgbWF0aFxuXHRcdFx0XHRcdGlmIChkZWxldGVkUmFuZ2VPZlRva2VuICYmIFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyh0b2tlbi5lZGl0b3JSYW5nZSwgY2hhbmdlLnJhbmdlKSA8IDApIHtcblx0XHRcdFx0XHRcdC8vIEFzc3VtZSBzaW5nbGUgbGluZSB0b2tlbnNcblx0XHRcdFx0XHRcdGNvbnN0IGxlbmd0aCA9IGRlbGV0ZWRSYW5nZU9mVG9rZW4uZW5kQ29sdW1uIC0gZGVsZXRlZFJhbmdlT2ZUb2tlbi5zdGFydENvbHVtbjtcblx0XHRcdFx0XHRcdGNvbnN0IHJhbmdlVG9EZWxldGUgPSBuZXcgUmFuZ2UodG9rZW4uZWRpdG9yUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCB0b2tlbi5lZGl0b3JSYW5nZS5zdGFydENvbHVtbiwgdG9rZW4uZWRpdG9yUmFuZ2UuZW5kTGluZU51bWJlciwgdG9rZW4uZWRpdG9yUmFuZ2UuZW5kQ29sdW1uIC0gbGVuZ3RoKTtcblx0XHRcdFx0XHRcdHRoaXMud2lkZ2V0LmlucHV0RWRpdG9yLmV4ZWN1dGVFZGl0cyh0aGlzLmlkLCBbe1xuXHRcdFx0XHRcdFx0XHRyYW5nZTogcmFuZ2VUb0RlbGV0ZSxcblx0XHRcdFx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHRcdFx0XHR9XSk7XG5cdFx0XHRcdFx0XHR0aGlzLndpZGdldC5yZWZyZXNoUGFyc2VkSW5wdXQoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRwcmV2aW91c0lucHV0VmFsdWUgPSB0aGlzLndpZGdldC5pbnB1dEVkaXRvci5nZXRWYWx1ZSgpO1xuXHRcdFx0cHJldmlvdXNTZWxlY3RlZEFnZW50ID0gdGhpcy53aWRnZXQubGFzdFNlbGVjdGVkQWdlbnQ7XG5cdFx0fSkpO1xuXHR9XG59XG5DaGF0V2lkZ2V0LkNPTlRSSUJTLnB1c2goQ2hhdFRva2VuRGVsZXRlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWSx5QkFBeUI7QUFDOUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxhQUFhO0FBRXRCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMscUJBQXFCO0FBQzlCLFNBQTRDLHlCQUF5QjtBQUNy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
