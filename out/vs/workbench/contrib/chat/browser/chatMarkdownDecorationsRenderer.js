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
import * as dom from "../../../../base/browser/dom.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { contentRefUrl } from "../common/annotations.js";
import { getFullyQualifiedId, IChatAgentNameService, IChatAgentService } from "../common/chatAgents.js";
import { chatSlashCommandBackground, chatSlashCommandForeground } from "../common/chatColors.js";
import { chatAgentLeader, ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestDynamicVariablePart, ChatRequestSlashCommandPart, ChatRequestTextPart, ChatRequestToolPart, chatSubcommandLeader } from "../common/chatParserTypes.js";
import { IChatService } from "../common/chatService.js";
import { ILanguageModelToolsService } from "../common/languageModelToolsService.js";
import { IChatWidgetService } from "./chat.js";
import { ChatAgentHover, getChatAgentHoverOptions } from "./chatAgentHover.js";
import { IChatMarkdownAnchorService } from "./chatContentParts/chatMarkdownAnchorService.js";
import { InlineAnchorWidget } from "./chatInlineAnchorWidget.js";
import "./media/chatInlineAnchorWidget.css";
const decorationRefUrl = `http://_vscodedecoration_`;
const agentRefUrl = `http://_chatagent_`;
const agentSlashRefUrl = `http://_chatslash_`;
function agentToMarkdown(agent, isClickable, accessor) {
  const chatAgentNameService = accessor.get(IChatAgentNameService);
  const chatAgentService = accessor.get(IChatAgentService);
  const isAllowed = chatAgentNameService.getAgentNameRestriction(agent);
  let name = `${isAllowed ? agent.name : getFullyQualifiedId(agent)}`;
  const isDupe = isAllowed && chatAgentService.agentHasDupeName(agent.id);
  if (isDupe) {
    name += ` (${agent.publisherDisplayName})`;
  }
  const args = { agentId: agent.id, name, isClickable };
  return `[${agent.name}](${agentRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
}
function agentSlashCommandToMarkdown(agent, command) {
  const text = `${chatSubcommandLeader}${command.name}`;
  const args = { agentId: agent.id, command: command.name };
  return `[${text}](${agentSlashRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
}
let ChatMarkdownDecorationsRenderer = class {
  constructor(keybindingService, logService, chatAgentService, instantiationService, hoverService, chatService, chatWidgetService, commandService, labelService, toolsService, chatMarkdownAnchorService) {
    this.keybindingService = keybindingService;
    this.logService = logService;
    this.chatAgentService = chatAgentService;
    this.instantiationService = instantiationService;
    this.hoverService = hoverService;
    this.chatService = chatService;
    this.chatWidgetService = chatWidgetService;
    this.commandService = commandService;
    this.labelService = labelService;
    this.toolsService = toolsService;
    this.chatMarkdownAnchorService = chatMarkdownAnchorService;
  }
  convertParsedRequestToMarkdown(parsedRequest) {
    let result = "";
    for (const part of parsedRequest.parts) {
      if (part instanceof ChatRequestTextPart) {
        result += part.text;
      } else if (part instanceof ChatRequestAgentPart) {
        result += this.instantiationService.invokeFunction((accessor) => agentToMarkdown(part.agent, false, accessor));
      } else {
        result += this.genericDecorationToMarkdown(part);
      }
    }
    return result;
  }
  genericDecorationToMarkdown(part) {
    const uri = part instanceof ChatRequestDynamicVariablePart && part.data instanceof URI ? part.data : void 0;
    const title = uri ? this.labelService.getUriLabel(uri, { relative: true }) : part instanceof ChatRequestSlashCommandPart ? part.slashCommand.detail : part instanceof ChatRequestAgentSubcommandPart ? part.command.description : part instanceof ChatRequestToolPart ? this.toolsService.getTool(part.toolId)?.userDescription : "";
    const args = { title };
    const text = part.text;
    return `[${text}](${decorationRefUrl}?${encodeURIComponent(JSON.stringify(args))})`;
  }
  walkTreeAndAnnotateReferenceLinks(content, element) {
    const store = new DisposableStore();
    element.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("data-href");
      if (href) {
        if (href.startsWith(agentRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(agentRefUrl.length + 1)));
          } catch (e) {
            this.logService.error("Invalid chat widget render data JSON", toErrorMessage(e));
          }
          if (args) {
            a.parentElement.replaceChild(
              this.renderAgentWidget(args, store),
              a
            );
          }
        } else if (href.startsWith(agentSlashRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(agentRefUrl.length + 1)));
          } catch (e) {
            this.logService.error("Invalid chat slash command render data JSON", toErrorMessage(e));
          }
          if (args) {
            a.parentElement.replaceChild(
              this.renderSlashCommandWidget(a.textContent, args, store),
              a
            );
          }
        } else if (href.startsWith(decorationRefUrl)) {
          let args;
          try {
            args = JSON.parse(decodeURIComponent(href.slice(decorationRefUrl.length + 1)));
          } catch (e) {
          }
          a.parentElement.replaceChild(
            this.renderResourceWidget(a.textContent, args, store),
            a
          );
        } else if (href.startsWith(contentRefUrl)) {
          this.renderFileWidget(content, href, a, store);
        } else if (href.startsWith("command:")) {
          this.injectKeybindingHint(a, href, this.keybindingService);
        }
      }
    });
    return store;
  }
  renderAgentWidget(args, store) {
    const nameWithLeader = `${chatAgentLeader}${args.name}`;
    let container;
    if (args.isClickable) {
      container = dom.$("span.chat-agent-widget");
      const button = store.add(new Button(container, {
        buttonBackground: asCssVariable(chatSlashCommandBackground),
        buttonForeground: asCssVariable(chatSlashCommandForeground),
        buttonHoverBackground: void 0
      }));
      button.label = nameWithLeader;
      store.add(button.onDidClick(() => {
        const agent2 = this.chatAgentService.getAgent(args.agentId);
        const widget = this.chatWidgetService.lastFocusedWidget;
        if (!widget || !agent2) {
          return;
        }
        this.chatService.sendRequest(
          widget.viewModel.sessionId,
          agent2.metadata.sampleRequest ?? "",
          {
            location: widget.location,
            agentId: agent2.id,
            userSelectedModelId: widget.input.currentLanguageModel,
            mode: widget.input.currentMode
          }
        );
      }));
    } else {
      container = this.renderResourceWidget(nameWithLeader, void 0, store);
    }
    const agent = this.chatAgentService.getAgent(args.agentId);
    const hover = new Lazy(() => store.add(this.instantiationService.createInstance(ChatAgentHover)));
    store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, () => {
      hover.value.setAgent(args.agentId);
      return hover.value.domNode;
    }, agent && getChatAgentHoverOptions(() => agent, this.commandService)));
    return container;
  }
  renderSlashCommandWidget(name, args, store) {
    const container = dom.$("span.chat-agent-widget.chat-command-widget");
    const agent = this.chatAgentService.getAgent(args.agentId);
    const button = store.add(new Button(container, {
      buttonBackground: asCssVariable(chatSlashCommandBackground),
      buttonForeground: asCssVariable(chatSlashCommandForeground),
      buttonHoverBackground: void 0
    }));
    button.label = name;
    store.add(button.onDidClick(() => {
      const widget = this.chatWidgetService.lastFocusedWidget;
      if (!widget || !agent) {
        return;
      }
      const command = agent.slashCommands.find((c) => c.name === args.command);
      this.chatService.sendRequest(widget.viewModel.sessionId, command?.sampleRequest ?? "", {
        location: widget.location,
        agentId: agent.id,
        slashCommand: args.command,
        userSelectedModelId: widget.input.currentLanguageModel,
        mode: widget.input.currentMode
      });
    }));
    return container;
  }
  renderFileWidget(content, href, a, store) {
    const fullUri = URI.parse(href);
    const data = content.inlineReferences?.[fullUri.path.slice(1)];
    if (!data) {
      this.logService.error("Invalid chat widget render data JSON");
      return;
    }
    const inlineAnchor = store.add(this.instantiationService.createInstance(InlineAnchorWidget, a, data));
    store.add(this.chatMarkdownAnchorService.register(inlineAnchor));
  }
  renderResourceWidget(name, args, store) {
    const container = dom.$("span.chat-resource-widget");
    const alias = dom.$("span", void 0, name);
    if (args?.title) {
      store.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), container, args.title));
    }
    container.appendChild(alias);
    return container;
  }
  injectKeybindingHint(a, href, keybindingService) {
    const command = href.match(/command:([^\)]+)/)?.[1];
    if (command) {
      const kb = keybindingService.lookupKeybinding(command);
      if (kb) {
        const keybinding = kb.getLabel();
        if (keybinding) {
          a.textContent = `${a.textContent} (${keybinding})`;
        }
      }
    }
  }
};
ChatMarkdownDecorationsRenderer = __decorateClass([
  __decorateParam(0, IKeybindingService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IChatAgentService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IChatService),
  __decorateParam(6, IChatWidgetService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, ILanguageModelToolsService),
  __decorateParam(10, IChatMarkdownAnchorService)
], ChatMarkdownDecorationsRenderer);
export {
  ChatMarkdownDecorationsRenderer,
  agentSlashCommandToMarkdown,
  agentToMarkdown
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdE1hcmtkb3duRGVjb3JhdGlvbnNSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JVdGlscy5qcyc7XG5pbXBvcnQgeyBjb250ZW50UmVmVXJsIH0gZnJvbSAnLi4vY29tbW9uL2Fubm90YXRpb25zLmpzJztcbmltcG9ydCB7IGdldEZ1bGx5UXVhbGlmaWVkSWQsIElDaGF0QWdlbnRDb21tYW5kLCBJQ2hhdEFnZW50RGF0YSwgSUNoYXRBZ2VudE5hbWVTZXJ2aWNlLCBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IGNoYXRTbGFzaENvbW1hbmRCYWNrZ3JvdW5kLCBjaGF0U2xhc2hDb21tYW5kRm9yZWdyb3VuZCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Q29sb3JzLmpzJztcbmltcG9ydCB7IGNoYXRBZ2VudExlYWRlciwgQ2hhdFJlcXVlc3RBZ2VudFBhcnQsIENoYXRSZXF1ZXN0QWdlbnRTdWJjb21tYW5kUGFydCwgQ2hhdFJlcXVlc3REeW5hbWljVmFyaWFibGVQYXJ0LCBDaGF0UmVxdWVzdFNsYXNoQ29tbWFuZFBhcnQsIENoYXRSZXF1ZXN0VGV4dFBhcnQsIENoYXRSZXF1ZXN0VG9vbFBhcnQsIGNoYXRTdWJjb21tYW5kTGVhZGVyLCBJUGFyc2VkQ2hhdFJlcXVlc3QsIElQYXJzZWRDaGF0UmVxdWVzdFBhcnQgfSBmcm9tICcuLi9jb21tb24vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IElDaGF0TWFya2Rvd25Db250ZW50LCBJQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuL2NoYXQuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50SG92ZXIsIGdldENoYXRBZ2VudEhvdmVyT3B0aW9ucyB9IGZyb20gJy4vY2hhdEFnZW50SG92ZXIuanMnO1xuaW1wb3J0IHsgSUNoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdE1hcmtkb3duQW5jaG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbmxpbmVBbmNob3JXaWRnZXQgfSBmcm9tICcuL2NoYXRJbmxpbmVBbmNob3JXaWRnZXQuanMnO1xuaW1wb3J0ICcuL21lZGlhL2NoYXRJbmxpbmVBbmNob3JXaWRnZXQuY3NzJztcblxuLyoqIEZvciByZW5kZXJpbmcgc2xhc2ggY29tbWFuZHMsIHZhcmlhYmxlcyAqL1xuY29uc3QgZGVjb3JhdGlvblJlZlVybCA9IGBodHRwOi8vX3ZzY29kZWRlY29yYXRpb25fYDtcblxuLyoqIEZvciByZW5kZXJpbmcgYWdlbnQgZGVjb3JhdGlvbnMgd2l0aCBob3ZlciAqL1xuY29uc3QgYWdlbnRSZWZVcmwgPSBgaHR0cDovL19jaGF0YWdlbnRfYDtcblxuLyoqIEZvciByZW5kZXJpbmcgYWdlbnQgZGVjb3JhdGlvbnMgd2l0aCBob3ZlciAqL1xuY29uc3QgYWdlbnRTbGFzaFJlZlVybCA9IGBodHRwOi8vX2NoYXRzbGFzaF9gO1xuXG5leHBvcnQgZnVuY3Rpb24gYWdlbnRUb01hcmtkb3duKGFnZW50OiBJQ2hhdEFnZW50RGF0YSwgaXNDbGlja2FibGU6IGJvb2xlYW4sIGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogc3RyaW5nIHtcblx0Y29uc3QgY2hhdEFnZW50TmFtZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRBZ2VudE5hbWVTZXJ2aWNlKTtcblx0Y29uc3QgY2hhdEFnZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdEFnZW50U2VydmljZSk7XG5cblx0Y29uc3QgaXNBbGxvd2VkID0gY2hhdEFnZW50TmFtZVNlcnZpY2UuZ2V0QWdlbnROYW1lUmVzdHJpY3Rpb24oYWdlbnQpO1xuXHRsZXQgbmFtZSA9IGAke2lzQWxsb3dlZCA/IGFnZW50Lm5hbWUgOiBnZXRGdWxseVF1YWxpZmllZElkKGFnZW50KX1gO1xuXHRjb25zdCBpc0R1cGUgPSBpc0FsbG93ZWQgJiYgY2hhdEFnZW50U2VydmljZS5hZ2VudEhhc0R1cGVOYW1lKGFnZW50LmlkKTtcblx0aWYgKGlzRHVwZSkge1xuXHRcdG5hbWUgKz0gYCAoJHthZ2VudC5wdWJsaXNoZXJEaXNwbGF5TmFtZX0pYDtcblx0fVxuXG5cdGNvbnN0IGFyZ3M6IElBZ2VudFdpZGdldEFyZ3MgPSB7IGFnZW50SWQ6IGFnZW50LmlkLCBuYW1lLCBpc0NsaWNrYWJsZSB9O1xuXHRyZXR1cm4gYFske2FnZW50Lm5hbWV9XSgke2FnZW50UmVmVXJsfT8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShhcmdzKSl9KWA7XG59XG5cbmludGVyZmFjZSBJQWdlbnRXaWRnZXRBcmdzIHtcblx0YWdlbnRJZDogc3RyaW5nO1xuXHRuYW1lOiBzdHJpbmc7XG5cdGlzQ2xpY2thYmxlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFnZW50U2xhc2hDb21tYW5kVG9NYXJrZG93bihhZ2VudDogSUNoYXRBZ2VudERhdGEsIGNvbW1hbmQ6IElDaGF0QWdlbnRDb21tYW5kKTogc3RyaW5nIHtcblx0Y29uc3QgdGV4dCA9IGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7Y29tbWFuZC5uYW1lfWA7XG5cdGNvbnN0IGFyZ3M6IElTbGFzaENvbW1hbmRXaWRnZXRBcmdzID0geyBhZ2VudElkOiBhZ2VudC5pZCwgY29tbWFuZDogY29tbWFuZC5uYW1lIH07XG5cdHJldHVybiBgWyR7dGV4dH1dKCR7YWdlbnRTbGFzaFJlZlVybH0/JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoYXJncykpfSlgO1xufVxuXG5pbnRlcmZhY2UgSVNsYXNoQ29tbWFuZFdpZGdldEFyZ3Mge1xuXHRhZ2VudElkOiBzdHJpbmc7XG5cdGNvbW1hbmQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRGVjb3JhdGlvbldpZGdldEFyZ3Mge1xuXHR0aXRsZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRNYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0V2lkZ2V0U2VydmljZTogSUNoYXRXaWRnZXRTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRvb2xzU2VydmljZTogSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsXG5cdFx0QElDaGF0TWFya2Rvd25BbmNob3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdE1hcmtkb3duQW5jaG9yU2VydmljZTogSUNoYXRNYXJrZG93bkFuY2hvclNlcnZpY2UsXG5cdCkgeyB9XG5cblx0Y29udmVydFBhcnNlZFJlcXVlc3RUb01hcmtkb3duKHBhcnNlZFJlcXVlc3Q6IElQYXJzZWRDaGF0UmVxdWVzdCk6IHN0cmluZyB7XG5cdFx0bGV0IHJlc3VsdCA9ICcnO1xuXHRcdGZvciAoY29uc3QgcGFydCBvZiBwYXJzZWRSZXF1ZXN0LnBhcnRzKSB7XG5cdFx0XHRpZiAocGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0VGV4dFBhcnQpIHtcblx0XHRcdFx0cmVzdWx0ICs9IHBhcnQudGV4dDtcblx0XHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0KSB7XG5cdFx0XHRcdHJlc3VsdCArPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGFnZW50VG9NYXJrZG93bihwYXJ0LmFnZW50LCBmYWxzZSwgYWNjZXNzb3IpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdCArPSB0aGlzLmdlbmVyaWNEZWNvcmF0aW9uVG9NYXJrZG93bihwYXJ0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBnZW5lcmljRGVjb3JhdGlvblRvTWFya2Rvd24ocGFydDogSVBhcnNlZENoYXRSZXF1ZXN0UGFydCk6IHN0cmluZyB7XG5cdFx0Y29uc3QgdXJpID0gcGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0RHluYW1pY1ZhcmlhYmxlUGFydCAmJiBwYXJ0LmRhdGEgaW5zdGFuY2VvZiBVUkkgP1xuXHRcdFx0cGFydC5kYXRhIDpcblx0XHRcdHVuZGVmaW5lZDtcblx0XHRjb25zdCB0aXRsZSA9IHVyaSA/IHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaSwgeyByZWxhdGl2ZTogdHJ1ZSB9KSA6XG5cdFx0XHRwYXJ0IGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RTbGFzaENvbW1hbmRQYXJ0ID8gcGFydC5zbGFzaENvbW1hbmQuZGV0YWlsIDpcblx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRTdWJjb21tYW5kUGFydCA/IHBhcnQuY29tbWFuZC5kZXNjcmlwdGlvbiA6XG5cdFx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0VG9vbFBhcnQgPyAodGhpcy50b29sc1NlcnZpY2UuZ2V0VG9vbChwYXJ0LnRvb2xJZCk/LnVzZXJEZXNjcmlwdGlvbikgOlxuXHRcdFx0XHRcdFx0Jyc7XG5cblx0XHRjb25zdCBhcmdzOiBJRGVjb3JhdGlvbldpZGdldEFyZ3MgPSB7IHRpdGxlIH07XG5cdFx0Y29uc3QgdGV4dCA9IHBhcnQudGV4dDtcblx0XHRyZXR1cm4gYFske3RleHR9XSgke2RlY29yYXRpb25SZWZVcmx9PyR7ZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KGFyZ3MpKX0pYDtcblx0fVxuXG5cdHdhbGtUcmVlQW5kQW5ub3RhdGVSZWZlcmVuY2VMaW5rcyhjb250ZW50OiBJQ2hhdE1hcmtkb3duQ29udGVudCwgZWxlbWVudDogSFRNTEVsZW1lbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZWxlbWVudC5xdWVyeVNlbGVjdG9yQWxsKCdhJykuZm9yRWFjaChhID0+IHtcblx0XHRcdGNvbnN0IGhyZWYgPSBhLmdldEF0dHJpYnV0ZSgnZGF0YS1ocmVmJyk7XG5cdFx0XHRpZiAoaHJlZikge1xuXHRcdFx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKGFnZW50UmVmVXJsKSkge1xuXHRcdFx0XHRcdGxldCBhcmdzOiBJQWdlbnRXaWRnZXRBcmdzIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhcmdzID0gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoaHJlZi5zbGljZShhZ2VudFJlZlVybC5sZW5ndGggKyAxKSkpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignSW52YWxpZCBjaGF0IHdpZGdldCByZW5kZXIgZGF0YSBKU09OJywgdG9FcnJvck1lc3NhZ2UoZSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChhcmdzKSB7XG5cdFx0XHRcdFx0XHRhLnBhcmVudEVsZW1lbnQhLnJlcGxhY2VDaGlsZChcblx0XHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJBZ2VudFdpZGdldChhcmdzLCBzdG9yZSksXG5cdFx0XHRcdFx0XHRcdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChocmVmLnN0YXJ0c1dpdGgoYWdlbnRTbGFzaFJlZlVybCkpIHtcblx0XHRcdFx0XHRsZXQgYXJnczogSVNsYXNoQ29tbWFuZFdpZGdldEFyZ3MgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGFyZ3MgPSBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChocmVmLnNsaWNlKGFnZW50UmVmVXJsLmxlbmd0aCArIDEpKSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdJbnZhbGlkIGNoYXQgc2xhc2ggY29tbWFuZCByZW5kZXIgZGF0YSBKU09OJywgdG9FcnJvck1lc3NhZ2UoZSkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChhcmdzKSB7XG5cdFx0XHRcdFx0XHRhLnBhcmVudEVsZW1lbnQhLnJlcGxhY2VDaGlsZChcblx0XHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJTbGFzaENvbW1hbmRXaWRnZXQoYS50ZXh0Q29udGVudCEsIGFyZ3MsIHN0b3JlKSxcblx0XHRcdFx0XHRcdFx0YSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2UgaWYgKGhyZWYuc3RhcnRzV2l0aChkZWNvcmF0aW9uUmVmVXJsKSkge1xuXHRcdFx0XHRcdGxldCBhcmdzOiBJRGVjb3JhdGlvbldpZGdldEFyZ3MgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGFyZ3MgPSBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChocmVmLnNsaWNlKGRlY29yYXRpb25SZWZVcmwubGVuZ3RoICsgMSkpKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7IH1cblxuXHRcdFx0XHRcdGEucGFyZW50RWxlbWVudCEucmVwbGFjZUNoaWxkKFxuXHRcdFx0XHRcdFx0dGhpcy5yZW5kZXJSZXNvdXJjZVdpZGdldChhLnRleHRDb250ZW50ISwgYXJncywgc3RvcmUpLFxuXHRcdFx0XHRcdFx0YSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaHJlZi5zdGFydHNXaXRoKGNvbnRlbnRSZWZVcmwpKSB7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJGaWxlV2lkZ2V0KGNvbnRlbnQsIGhyZWYsIGEsIHN0b3JlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChocmVmLnN0YXJ0c1dpdGgoJ2NvbW1hbmQ6JykpIHtcblx0XHRcdFx0XHR0aGlzLmluamVjdEtleWJpbmRpbmdIaW50KGEsIGhyZWYsIHRoaXMua2V5YmluZGluZ1NlcnZpY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gc3RvcmU7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFnZW50V2lkZ2V0KGFyZ3M6IElBZ2VudFdpZGdldEFyZ3MsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgbmFtZVdpdGhMZWFkZXIgPSBgJHtjaGF0QWdlbnRMZWFkZXJ9JHthcmdzLm5hbWV9YDtcblx0XHRsZXQgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0XHRpZiAoYXJncy5pc0NsaWNrYWJsZSkge1xuXHRcdFx0Y29udGFpbmVyID0gZG9tLiQoJ3NwYW4uY2hhdC1hZ2VudC13aWRnZXQnKTtcblx0XHRcdGNvbnN0IGJ1dHRvbiA9IHN0b3JlLmFkZChuZXcgQnV0dG9uKGNvbnRhaW5lciwge1xuXHRcdFx0XHRidXR0b25CYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGNoYXRTbGFzaENvbW1hbmRCYWNrZ3JvdW5kKSxcblx0XHRcdFx0YnV0dG9uRm9yZWdyb3VuZDogYXNDc3NWYXJpYWJsZShjaGF0U2xhc2hDb21tYW5kRm9yZWdyb3VuZCksXG5cdFx0XHRcdGJ1dHRvbkhvdmVyQmFja2dyb3VuZDogdW5kZWZpbmVkXG5cdFx0XHR9KSk7XG5cdFx0XHRidXR0b24ubGFiZWwgPSBuYW1lV2l0aExlYWRlcjtcblx0XHRcdHN0b3JlLmFkZChidXR0b24ub25EaWRDbGljaygoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KGFyZ3MuYWdlbnRJZCk7XG5cdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0XHRcdGlmICghd2lkZ2V0IHx8ICFhZ2VudCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuY2hhdFNlcnZpY2Uuc2VuZFJlcXVlc3Qod2lkZ2V0LnZpZXdNb2RlbCEuc2Vzc2lvbklkLCBhZ2VudC5tZXRhZGF0YS5zYW1wbGVSZXF1ZXN0ID8/ICcnLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxvY2F0aW9uOiB3aWRnZXQubG9jYXRpb24sXG5cdFx0XHRcdFx0XHRhZ2VudElkOiBhZ2VudC5pZCxcblx0XHRcdFx0XHRcdHVzZXJTZWxlY3RlZE1vZGVsSWQ6IHdpZGdldC5pbnB1dC5jdXJyZW50TGFuZ3VhZ2VNb2RlbCxcblx0XHRcdFx0XHRcdG1vZGU6IHdpZGdldC5pbnB1dC5jdXJyZW50TW9kZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250YWluZXIgPSB0aGlzLnJlbmRlclJlc291cmNlV2lkZ2V0KG5hbWVXaXRoTGVhZGVyLCB1bmRlZmluZWQsIHN0b3JlKTtcblx0XHR9XG5cblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXRBZ2VudChhcmdzLmFnZW50SWQpO1xuXHRcdGNvbnN0IGhvdmVyOiBMYXp5PENoYXRBZ2VudEhvdmVyPiA9IG5ldyBMYXp5KCgpID0+IHN0b3JlLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRBZ2VudEhvdmVyKSkpO1xuXHRcdHN0b3JlLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLCBjb250YWluZXIsICgpID0+IHtcblx0XHRcdGhvdmVyLnZhbHVlLnNldEFnZW50KGFyZ3MuYWdlbnRJZCk7XG5cdFx0XHRyZXR1cm4gaG92ZXIudmFsdWUuZG9tTm9kZTtcblx0XHR9LCBhZ2VudCAmJiBnZXRDaGF0QWdlbnRIb3Zlck9wdGlvbnMoKCkgPT4gYWdlbnQsIHRoaXMuY29tbWFuZFNlcnZpY2UpKSk7XG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2xhc2hDb21tYW5kV2lkZ2V0KG5hbWU6IHN0cmluZywgYXJnczogSVNsYXNoQ29tbWFuZFdpZGdldEFyZ3MsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gZG9tLiQoJ3NwYW4uY2hhdC1hZ2VudC13aWRnZXQuY2hhdC1jb21tYW5kLXdpZGdldCcpO1xuXHRcdGNvbnN0IGFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KGFyZ3MuYWdlbnRJZCk7XG5cdFx0Y29uc3QgYnV0dG9uID0gc3RvcmUuYWRkKG5ldyBCdXR0b24oY29udGFpbmVyLCB7XG5cdFx0XHRidXR0b25CYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGNoYXRTbGFzaENvbW1hbmRCYWNrZ3JvdW5kKSxcblx0XHRcdGJ1dHRvbkZvcmVncm91bmQ6IGFzQ3NzVmFyaWFibGUoY2hhdFNsYXNoQ29tbWFuZEZvcmVncm91bmQpLFxuXHRcdFx0YnV0dG9uSG92ZXJCYWNrZ3JvdW5kOiB1bmRlZmluZWRcblx0XHR9KSk7XG5cdFx0YnV0dG9uLmxhYmVsID0gbmFtZTtcblx0XHRzdG9yZS5hZGQoYnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4ge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5jaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRcdGlmICghd2lkZ2V0IHx8ICFhZ2VudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbW1hbmQgPSBhZ2VudC5zbGFzaENvbW1hbmRzLmZpbmQoYyA9PiBjLm5hbWUgPT09IGFyZ3MuY29tbWFuZCk7XG5cdFx0XHR0aGlzLmNoYXRTZXJ2aWNlLnNlbmRSZXF1ZXN0KHdpZGdldC52aWV3TW9kZWwhLnNlc3Npb25JZCwgY29tbWFuZD8uc2FtcGxlUmVxdWVzdCA/PyAnJywge1xuXHRcdFx0XHRsb2NhdGlvbjogd2lkZ2V0LmxvY2F0aW9uLFxuXHRcdFx0XHRhZ2VudElkOiBhZ2VudC5pZCxcblx0XHRcdFx0c2xhc2hDb21tYW5kOiBhcmdzLmNvbW1hbmQsXG5cdFx0XHRcdHVzZXJTZWxlY3RlZE1vZGVsSWQ6IHdpZGdldC5pbnB1dC5jdXJyZW50TGFuZ3VhZ2VNb2RlbCxcblx0XHRcdFx0bW9kZTogd2lkZ2V0LmlucHV0LmN1cnJlbnRNb2RlXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gY29udGFpbmVyO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJGaWxlV2lkZ2V0KGNvbnRlbnQ6IElDaGF0TWFya2Rvd25Db250ZW50LCBocmVmOiBzdHJpbmcsIGE6IEhUTUxBbmNob3JFbGVtZW50LCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogdm9pZCB7XG5cdFx0Ly8gVE9ETyB0aGlzIGNhbiBiZSBhIG5pY2VyIEZpbGVMYWJlbCB3aWRnZXQgd2l0aCBhbiBpY29uLiBEbyBhIHNpbXBsZSBsaW5rIGZvciBub3cuXG5cdFx0Y29uc3QgZnVsbFVyaSA9IFVSSS5wYXJzZShocmVmKTtcblxuXHRcdGNvbnN0IGRhdGEgPSBjb250ZW50LmlubGluZVJlZmVyZW5jZXM/LltmdWxsVXJpLnBhdGguc2xpY2UoMSldO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdJbnZhbGlkIGNoYXQgd2lkZ2V0IHJlbmRlciBkYXRhIEpTT04nKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpbmxpbmVBbmNob3IgPSBzdG9yZS5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbmxpbmVBbmNob3JXaWRnZXQsIGEsIGRhdGEpKTtcblx0XHRzdG9yZS5hZGQodGhpcy5jaGF0TWFya2Rvd25BbmNob3JTZXJ2aWNlLnJlZ2lzdGVyKGlubGluZUFuY2hvcikpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXNvdXJjZVdpZGdldChuYW1lOiBzdHJpbmcsIGFyZ3M6IElEZWNvcmF0aW9uV2lkZ2V0QXJncyB8IHVuZGVmaW5lZCwgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBjb250YWluZXIgPSBkb20uJCgnc3Bhbi5jaGF0LXJlc291cmNlLXdpZGdldCcpO1xuXHRcdGNvbnN0IGFsaWFzID0gZG9tLiQoJ3NwYW4nLCB1bmRlZmluZWQsIG5hbWUpO1xuXHRcdGlmIChhcmdzPy50aXRsZSkge1xuXHRcdFx0c3RvcmUuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIGNvbnRhaW5lciwgYXJncy50aXRsZSkpO1xuXHRcdH1cblxuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChhbGlhcyk7XG5cdFx0cmV0dXJuIGNvbnRhaW5lcjtcblx0fVxuXG5cblx0cHJpdmF0ZSBpbmplY3RLZXliaW5kaW5nSGludChhOiBIVE1MQW5jaG9yRWxlbWVudCwgaHJlZjogc3RyaW5nLCBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlKTogdm9pZCB7XG5cdFx0Y29uc3QgY29tbWFuZCA9IGhyZWYubWF0Y2goL2NvbW1hbmQ6KFteXFwpXSspLyk/LlsxXTtcblx0XHRpZiAoY29tbWFuZCkge1xuXHRcdFx0Y29uc3Qga2IgPSBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGNvbW1hbmQpO1xuXHRcdFx0aWYgKGtiKSB7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBrYi5nZXRMYWJlbCgpO1xuXHRcdFx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0XHRcdGEudGV4dENvbnRlbnQgPSBgJHthLnRleHRDb250ZW50fSAoJHtrZXliaW5kaW5nfSlgO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGNBQWM7QUFDdkIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsdUJBQW9DO0FBQzdDLFNBQVMsV0FBVztBQUNwQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDZCQUErQztBQUN4RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFCQUF3RCx1QkFBdUIseUJBQXlCO0FBQ2pILFNBQVMsNEJBQTRCLGtDQUFrQztBQUN2RSxTQUFTLGlCQUFpQixzQkFBc0IsZ0NBQWdDLGdDQUFnQyw2QkFBNkIscUJBQXFCLHFCQUFxQiw0QkFBd0U7QUFDL1AsU0FBK0Isb0JBQW9CO0FBQ25ELFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCLGdDQUFnQztBQUN6RCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDBCQUEwQjtBQUNuQyxPQUFPO0FBR1AsTUFBTSxtQkFBbUI7QUFHekIsTUFBTSxjQUFjO0FBR3BCLE1BQU0sbUJBQW1CO0FBRWxCLFNBQVMsZ0JBQWdCLE9BQXVCLGFBQXNCLFVBQW9DO0FBQ2hILFFB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
