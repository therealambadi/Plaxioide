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
import * as dom from "../../../../../base/browser/dom.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Emitter } from "../../../../../base/common/event.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { localize } from "../../../../../nls.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { createToolInputUri, ILanguageModelToolsService, isToolResultInputOutputDetails } from "../../common/languageModelToolsService.js";
import { CancelChatActionId } from "../actions/chatExecuteActions.js";
import { AcceptToolConfirmationActionId } from "../actions/chatToolActions.js";
import { ChatCollapsibleEditorContentPart } from "./chatCollapsibleContentPart.js";
import { ChatConfirmationWidget, ChatCustomConfirmationWidget } from "./chatConfirmationWidget.js";
import { ChatMarkdownContentPart } from "./chatMarkdownContentPart.js";
import { ChatCustomProgressPart, ChatProgressContentPart } from "./chatProgressContentPart.js";
import { ChatCollapsibleListContentPart } from "./chatReferencesContentPart.js";
let ChatToolInvocationPart = class extends Disposable {
  constructor(toolInvocation, context, renderer, listPool, editorPool, currentWidthDelegate, codeBlockModelCollection, codeBlockStartIndex, instantiationService) {
    super();
    this.toolInvocation = toolInvocation;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this.domNode = dom.$(".chat-tool-invocation-part");
    if (toolInvocation.presentation === "hidden") {
      return;
    }
    const partStore = this._register(new DisposableStore());
    const render = () => {
      dom.clearNode(this.domNode);
      partStore.clear();
      this.subPart = partStore.add(instantiationService.createInstance(ChatToolInvocationSubPart, toolInvocation, context, renderer, listPool, editorPool, currentWidthDelegate, codeBlockModelCollection, codeBlockStartIndex));
      this.domNode.appendChild(this.subPart.domNode);
      partStore.add(this.subPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
      partStore.add(this.subPart.onNeedsRerender(() => {
        render();
        this._onDidChangeHeight.fire();
      }));
    };
    render();
  }
  get codeblocks() {
    return this.subPart?.codeblocks ?? [];
  }
  get codeblocksPartId() {
    return this.subPart?.codeblocksPartId;
  }
  hasSameContent(other, followingContent, element) {
    return (other.kind === "toolInvocation" || other.kind === "toolInvocationSerialized") && this.toolInvocation.toolCallId === other.toolCallId;
  }
  addDisposable(disposable) {
    this._register(disposable);
  }
};
ChatToolInvocationPart = __decorateClass([
  __decorateParam(8, IInstantiationService)
], ChatToolInvocationPart);
let ChatToolInvocationSubPart = class extends Disposable {
  constructor(toolInvocation, context, renderer, listPool, editorPool, currentWidthDelegate, codeBlockModelCollection, codeBlockStartIndex, instantiationService, keybindingService, modelService, languageService, contextKeyService, languageModelToolsService) {
    super();
    this.toolInvocation = toolInvocation;
    this.context = context;
    this.renderer = renderer;
    this.listPool = listPool;
    this.editorPool = editorPool;
    this.currentWidthDelegate = currentWidthDelegate;
    this.codeBlockModelCollection = codeBlockModelCollection;
    this.codeBlockStartIndex = codeBlockStartIndex;
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.contextKeyService = contextKeyService;
    this.languageModelToolsService = languageModelToolsService;
    this._codeblocksPartId = "tool-" + ChatToolInvocationSubPart.idPool++;
    this._onNeedsRerender = this._register(new Emitter());
    this.onNeedsRerender = this._onNeedsRerender.event;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._codeblocks = [];
    if (toolInvocation.kind === "toolInvocation" && toolInvocation.confirmationMessages) {
      if (toolInvocation.toolSpecificData?.kind === "terminal") {
        this.domNode = this.createTerminalConfirmationWidget(toolInvocation, toolInvocation.toolSpecificData);
      } else {
        this.domNode = this.createConfirmationWidget(toolInvocation);
      }
    } else if (toolInvocation.toolSpecificData?.kind === "terminal") {
      this.domNode = this.createTerminalMarkdownProgressPart(toolInvocation, toolInvocation.toolSpecificData);
    } else if (Array.isArray(toolInvocation.resultDetails) && toolInvocation.resultDetails?.length) {
      this.domNode = this.createResultList(toolInvocation.pastTenseMessage ?? toolInvocation.invocationMessage, toolInvocation.resultDetails);
    } else if (isToolResultInputOutputDetails(toolInvocation.resultDetails)) {
      this.domNode = this.createInputOutputMarkdownProgressPart(toolInvocation.pastTenseMessage ?? toolInvocation.invocationMessage, toolInvocation.resultDetails);
    } else {
      this.domNode = this.createProgressPart();
    }
    if (toolInvocation.kind === "toolInvocation" && !toolInvocation.isComplete) {
      toolInvocation.isCompletePromise.then(() => this._onNeedsRerender.fire());
    }
  }
  get codeblocks() {
    return this.markdownPart?.codeblocks ?? this._codeblocks;
  }
  get codeblocksPartId() {
    return this.markdownPart?.codeblocksPartId ?? this._codeblocksPartId;
  }
  createConfirmationWidget(toolInvocation) {
    if (!toolInvocation.confirmationMessages) {
      throw new Error("Confirmation messages are missing");
    }
    const title = toolInvocation.confirmationMessages.title;
    const message = toolInvocation.confirmationMessages.message;
    const allowAutoConfirm = toolInvocation.confirmationMessages.allowAutoConfirm;
    const continueLabel = localize("continue", "Continue");
    const continueKeybinding = this.keybindingService.lookupKeybinding(AcceptToolConfirmationActionId)?.getLabel();
    const continueTooltip = continueKeybinding ? `${continueLabel} (${continueKeybinding})` : continueLabel;
    const cancelLabel = localize("cancel", "Cancel");
    const cancelKeybinding = this.keybindingService.lookupKeybinding(CancelChatActionId)?.getLabel();
    const cancelTooltip = cancelKeybinding ? `${cancelLabel} (${cancelKeybinding})` : cancelLabel;
    let ConfirmationOutcome;
    ((ConfirmationOutcome2) => {
      ConfirmationOutcome2[ConfirmationOutcome2["Allow"] = 0] = "Allow";
      ConfirmationOutcome2[ConfirmationOutcome2["Disallow"] = 1] = "Disallow";
      ConfirmationOutcome2[ConfirmationOutcome2["AllowWorkspace"] = 2] = "AllowWorkspace";
      ConfirmationOutcome2[ConfirmationOutcome2["AllowGlobally"] = 3] = "AllowGlobally";
      ConfirmationOutcome2[ConfirmationOutcome2["AllowSession"] = 4] = "AllowSession";
    })(ConfirmationOutcome || (ConfirmationOutcome = {}));
    const buttons = [
      {
        label: continueLabel,
        data: 0 /* Allow */,
        tooltip: continueTooltip,
        moreActions: !allowAutoConfirm ? void 0 : [
          { label: localize("allowSession", "Allow in this Session"), data: 4 /* AllowSession */, tooltip: localize("allowSesssionTooltip", "Allow this tool to run in this session without confirmation.") },
          { label: localize("allowWorkspace", "Allow in this Workspace"), data: 2 /* AllowWorkspace */, tooltip: localize("allowWorkspaceTooltip", "Allow this tool to run in this workspace without confirmation.") },
          { label: localize("allowGlobally", "Always Allow"), data: 3 /* AllowGlobally */, tooltip: localize("allowGloballTooltip", "Always allow this tool to run without confirmation.") }
        ]
      },
      {
        label: localize("cancel", "Cancel"),
        data: 1 /* Disallow */,
        isSecondary: true,
        tooltip: cancelTooltip
      }
    ];
    let confirmWidget;
    if (typeof message === "string") {
      confirmWidget = this._register(this.instantiationService.createInstance(
        ChatConfirmationWidget,
        title,
        message,
        buttons
      ));
    } else {
      const chatMarkdownContent = {
        kind: "markdownContent",
        content: message
      };
      const codeBlockRenderOptions = {
        hideToolbar: true,
        reserveWidth: 19,
        verticalPadding: 5,
        editorOptions: {
          wordWrap: "on"
        }
      };
      const elements = dom.h("div", [
        dom.h(".message@message"),
        dom.h(".editor@editor")
      ]);
      if (toolInvocation.toolSpecificData?.kind === "input") {
        const inputData = toolInvocation.toolSpecificData;
        const codeBlockRenderOptions2 = {
          hideToolbar: true,
          reserveWidth: 19,
          maxHeightInLines: 13,
          verticalPadding: 5,
          editorOptions: {
            wordWrap: "on",
            readOnly: false
          }
        };
        const langId = this.languageService.getLanguageIdByLanguageName("json");
        const model = this._register(this.modelService.createModel(
          JSON.stringify(inputData.rawInput, void 0, 2),
          this.languageService.createById(langId),
          createToolInputUri(toolInvocation.toolId)
        ));
        const editor = this._register(this.editorPool.get());
        editor.object.render({
          codeBlockIndex: this.codeBlockStartIndex,
          codeBlockPartIndex: 0,
          element: this.context.element,
          languageId: langId ?? "json",
          renderOptions: codeBlockRenderOptions2,
          textModel: Promise.resolve(model)
        }, this.currentWidthDelegate());
        this._codeblocks.push({
          codeBlockIndex: this.codeBlockStartIndex,
          codemapperUri: void 0,
          elementId: this.context.element.id,
          focus: () => editor.object.focus(),
          isStreaming: false,
          ownerMarkdownPartId: this.codeblocksPartId,
          uri: model.uri,
          uriPromise: Promise.resolve(model.uri)
        });
        this._register(editor.object.onDidChangeContentHeight(() => {
          editor.object.layout(this.currentWidthDelegate());
          this._onDidChangeHeight.fire();
        }));
        this._register(model.onDidChangeContent((e) => {
          try {
            inputData.rawInput = JSON.parse(model.getValue());
          } catch {
          }
        }));
        elements.editor.append(editor.object.element);
      }
      this.markdownPart = this._register(this.instantiationService.createInstance(ChatMarkdownContentPart, chatMarkdownContent, this.context, this.editorPool, false, this.codeBlockStartIndex, this.renderer, this.currentWidthDelegate(), this.codeBlockModelCollection, { codeBlockRenderOptions }));
      elements.message.append(this.markdownPart.domNode);
      this._register(this.markdownPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
      confirmWidget = this._register(this.instantiationService.createInstance(
        ChatCustomConfirmationWidget,
        title,
        elements.root,
        toolInvocation.toolSpecificData?.kind === "input",
        buttons
      ));
    }
    const hasToolConfirmation = ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService);
    hasToolConfirmation.set(true);
    this._register(confirmWidget.onDidClick((button) => {
      switch (button.data) {
        case 3 /* AllowGlobally */:
          this.languageModelToolsService.setToolAutoConfirmation(toolInvocation.toolId, "profile", true);
          toolInvocation.confirmed.complete(true);
          break;
        case 2 /* AllowWorkspace */:
          this.languageModelToolsService.setToolAutoConfirmation(toolInvocation.toolId, "workspace", true);
          toolInvocation.confirmed.complete(true);
          break;
        case 4 /* AllowSession */:
          this.languageModelToolsService.setToolAutoConfirmation(toolInvocation.toolId, "memory", true);
          toolInvocation.confirmed.complete(true);
          break;
        case 0 /* Allow */:
          toolInvocation.confirmed.complete(true);
          break;
        case 1 /* Disallow */:
          toolInvocation.confirmed.complete(false);
          break;
      }
    }));
    this._register(confirmWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    this._register(toDisposable(() => hasToolConfirmation.reset()));
    toolInvocation.confirmed.p.then(() => {
      hasToolConfirmation.reset();
      this._onNeedsRerender.fire();
    });
    return confirmWidget.domNode;
  }
  createTerminalConfirmationWidget(toolInvocation, terminalData) {
    if (!toolInvocation.confirmationMessages) {
      throw new Error("Confirmation messages are missing");
    }
    const title = toolInvocation.confirmationMessages.title;
    const message = toolInvocation.confirmationMessages.message;
    const continueLabel = localize("continue", "Continue");
    const continueKeybinding = this.keybindingService.lookupKeybinding(AcceptToolConfirmationActionId)?.getLabel();
    const continueTooltip = continueKeybinding ? `${continueLabel} (${continueKeybinding})` : continueLabel;
    const cancelLabel = localize("cancel", "Cancel");
    const cancelKeybinding = this.keybindingService.lookupKeybinding(CancelChatActionId)?.getLabel();
    const cancelTooltip = cancelKeybinding ? `${cancelLabel} (${cancelKeybinding})` : cancelLabel;
    const buttons = [
      {
        label: continueLabel,
        data: true,
        tooltip: continueTooltip
      },
      {
        label: cancelLabel,
        data: false,
        isSecondary: true,
        tooltip: cancelTooltip
      }
    ];
    const renderedMessage = this._register(this.renderer.render(
      typeof message === "string" ? new MarkdownString(message) : message,
      { asyncRenderCallback: () => this._onDidChangeHeight.fire() }
    ));
    const codeBlockRenderOptions = {
      hideToolbar: true,
      reserveWidth: 19,
      verticalPadding: 5,
      editorOptions: {
        wordWrap: "on",
        readOnly: false
      }
    };
    const langId = this.languageService.getLanguageIdByLanguageName(terminalData.language ?? "sh") ?? "shellscript";
    const model = this.modelService.createModel(terminalData.command, this.languageService.createById(langId));
    const editor = this._register(this.editorPool.get());
    editor.object.render({
      codeBlockIndex: this.codeBlockStartIndex,
      codeBlockPartIndex: 0,
      element: this.context.element,
      languageId: langId,
      renderOptions: codeBlockRenderOptions,
      textModel: Promise.resolve(model)
    }, this.currentWidthDelegate());
    this._codeblocks.push({
      codeBlockIndex: this.codeBlockStartIndex,
      codemapperUri: void 0,
      elementId: this.context.element.id,
      focus: () => editor.object.focus(),
      isStreaming: false,
      ownerMarkdownPartId: this.codeblocksPartId,
      uri: model.uri,
      uriPromise: Promise.resolve(model.uri)
    });
    this._register(editor.object.onDidChangeContentHeight(() => {
      editor.object.layout(this.currentWidthDelegate());
      this._onDidChangeHeight.fire();
    }));
    this._register(model.onDidChangeContent((e) => {
      terminalData.command = model.getValue();
    }));
    const element = dom.$("");
    dom.append(element, editor.object.element);
    dom.append(element, renderedMessage.element);
    const confirmWidget = this._register(this.instantiationService.createInstance(
      ChatCustomConfirmationWidget,
      title,
      element,
      false,
      buttons
    ));
    ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService).set(true);
    this._register(confirmWidget.onDidClick((button) => {
      toolInvocation.confirmed.complete(button.data);
    }));
    this._register(confirmWidget.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    toolInvocation.confirmed.p.then(() => {
      ChatContextKeys.Editing.hasToolConfirmation.bindTo(this.contextKeyService).set(false);
      this._onNeedsRerender.fire();
    });
    return confirmWidget.domNode;
  }
  createProgressPart() {
    let content;
    if (this.toolInvocation.isComplete && this.toolInvocation.isConfirmed !== false && this.toolInvocation.pastTenseMessage) {
      content = typeof this.toolInvocation.pastTenseMessage === "string" ? new MarkdownString().appendText(this.toolInvocation.pastTenseMessage) : this.toolInvocation.pastTenseMessage;
    } else {
      content = typeof this.toolInvocation.invocationMessage === "string" ? new MarkdownString().appendText(this.toolInvocation.invocationMessage + "\u2026") : MarkdownString.lift(this.toolInvocation.invocationMessage).appendText("\u2026");
    }
    const progressMessage = {
      kind: "progressMessage",
      content
    };
    const iconOverride = !this.toolInvocation.isConfirmed ? Codicon.error : this.toolInvocation.isComplete ? Codicon.check : void 0;
    const progressPart = this._register(this.instantiationService.createInstance(ChatProgressContentPart, progressMessage, this.renderer, this.context, void 0, true, iconOverride));
    return progressPart.domNode;
  }
  createTerminalMarkdownProgressPart(toolInvocation, terminalData) {
    const content = new MarkdownString(`\`\`\`${terminalData.language}
${terminalData.command}
\`\`\``);
    const chatMarkdownContent = {
      kind: "markdownContent",
      content
    };
    const codeBlockRenderOptions = {
      hideToolbar: true,
      reserveWidth: 19,
      verticalPadding: 5,
      editorOptions: {
        wordWrap: "on"
      }
    };
    this.markdownPart = this._register(this.instantiationService.createInstance(ChatMarkdownContentPart, chatMarkdownContent, this.context, this.editorPool, false, this.codeBlockStartIndex, this.renderer, this.currentWidthDelegate(), this.codeBlockModelCollection, { codeBlockRenderOptions }));
    this._register(this.markdownPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    const icon = !this.toolInvocation.isConfirmed ? Codicon.error : this.toolInvocation.isComplete ? Codicon.check : ThemeIcon.modify(Codicon.loading, "spin");
    const progressPart = this.instantiationService.createInstance(ChatCustomProgressPart, this.markdownPart.domNode, icon);
    return progressPart.domNode;
  }
  createInputOutputMarkdownProgressPart(message, inputOutputData) {
    const model = this._register(this.modelService.createModel(
      `${inputOutputData.input}

${inputOutputData.output}`,
      this.languageService.createById("json")
    ));
    const collapsibleListPart = this._register(this.instantiationService.createInstance(
      ChatCollapsibleEditorContentPart,
      message,
      this.context,
      this.editorPool,
      Promise.resolve(model),
      model.getLanguageId(),
      {
        hideToolbar: true,
        reserveWidth: 19,
        maxHeightInLines: 13,
        verticalPadding: 5,
        editorOptions: {
          wordWrap: "on"
        }
      },
      {
        codeBlockIndex: this.codeBlockStartIndex,
        codemapperUri: void 0,
        elementId: this.context.element.id,
        focus: () => {
        },
        isStreaming: false,
        ownerMarkdownPartId: this.codeblocksPartId,
        uri: model.uri,
        uriPromise: Promise.resolve(model.uri)
      }
    ));
    this._register(collapsibleListPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    return collapsibleListPart.domNode;
  }
  createResultList(message, toolDetails) {
    const collapsibleListPart = this._register(this.instantiationService.createInstance(
      ChatCollapsibleListContentPart,
      toolDetails.map((detail) => ({
        kind: "reference",
        reference: detail
      })),
      message,
      this.context,
      this.listPool
    ));
    this._register(collapsibleListPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
    return collapsibleListPart.domNode;
  }
};
ChatToolInvocationSubPart.idPool = 0;
ChatToolInvocationSubPart = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IKeybindingService),
  __decorateParam(10, IModelService),
  __decorateParam(11, ILanguageService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, ILanguageModelToolsService)
], ChatToolInvocationSubPart);
export {
  ChatToolInvocationPart
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdENvbnRlbnRQYXJ0cy9jaGF0VG9vbEludm9jYXRpb25QYXJ0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElDaGF0TWFya2Rvd25Db250ZW50LCBJQ2hhdFByb2dyZXNzTWVzc2FnZSwgSUNoYXRUZXJtaW5hbFRvb2xJbnZvY2F0aW9uRGF0YSwgSUNoYXRUb29sSW52b2NhdGlvbiwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRSZW5kZXJlckNvbnRlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9jb21tb24vY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRvb2xJbnB1dFVyaSwgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIGlzVG9vbFJlc3VsdElucHV0T3V0cHV0RGV0YWlscywgSVRvb2xSZXN1bHRJbnB1dE91dHB1dERldGFpbHMgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxDaGF0QWN0aW9uSWQgfSBmcm9tICcuLi9hY3Rpb25zL2NoYXRFeGVjdXRlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBBY2NlcHRUb29sQ29uZmlybWF0aW9uQWN0aW9uSWQgfSBmcm9tICcuLi9hY3Rpb25zL2NoYXRUb29sQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUl0ZW0sIElDaGF0Q29kZUJsb2NrSW5mbyB9IGZyb20gJy4uL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNvZGVCbG9ja1JlbmRlck9wdGlvbnMgfSBmcm9tICcuLi9jb2RlQmxvY2tQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRDb2xsYXBzaWJsZUVkaXRvckNvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29sbGFwc2libGVDb250ZW50UGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0Q29uZmlybWF0aW9uV2lkZ2V0LCBDaGF0Q3VzdG9tQ29uZmlybWF0aW9uV2lkZ2V0LCBJQ2hhdENvbmZpcm1hdGlvbkJ1dHRvbiB9IGZyb20gJy4vY2hhdENvbmZpcm1hdGlvbldpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbnRlbnRQYXJ0LCBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy5qcyc7XG5pbXBvcnQgeyBDaGF0TWFya2Rvd25Db250ZW50UGFydCwgRWRpdG9yUG9vbCB9IGZyb20gJy4vY2hhdE1hcmtkb3duQ29udGVudFBhcnQuanMnO1xuaW1wb3J0IHsgQ2hhdEN1c3RvbVByb2dyZXNzUGFydCwgQ2hhdFByb2dyZXNzQ29udGVudFBhcnQgfSBmcm9tICcuL2NoYXRQcm9ncmVzc0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRDb2xsYXBzaWJsZUxpc3RDb250ZW50UGFydCwgQ29sbGFwc2libGVMaXN0UG9vbCwgSUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtIH0gZnJvbSAnLi9jaGF0UmVmZXJlbmNlc0NvbnRlbnRQYXJ0LmpzJztcblxuZXhwb3J0IGNsYXNzIENoYXRUb29sSW52b2NhdGlvblBhcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRDb250ZW50UGFydCB7XG5cdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VIZWlnaHQgPSB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5ldmVudDtcblxuXHRwdWJsaWMgZ2V0IGNvZGVibG9ja3MoKTogSUNoYXRDb2RlQmxvY2tJbmZvW10ge1xuXHRcdHJldHVybiB0aGlzLnN1YlBhcnQ/LmNvZGVibG9ja3MgPz8gW107XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNvZGVibG9ja3NQYXJ0SWQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zdWJQYXJ0Py5jb2RlYmxvY2tzUGFydElkO1xuXHR9XG5cblx0cHJpdmF0ZSBzdWJQYXJ0ITogQ2hhdFRvb2xJbnZvY2F0aW9uU3ViUGFydDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRvb2xJbnZvY2F0aW9uOiBJQ2hhdFRvb2xJbnZvY2F0aW9uIHwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsXG5cdFx0Y29udGV4dDogSUNoYXRDb250ZW50UGFydFJlbmRlckNvbnRleHQsXG5cdFx0cmVuZGVyZXI6IE1hcmtkb3duUmVuZGVyZXIsXG5cdFx0bGlzdFBvb2w6IENvbGxhcHNpYmxlTGlzdFBvb2wsXG5cdFx0ZWRpdG9yUG9vbDogRWRpdG9yUG9vbCxcblx0XHRjdXJyZW50V2lkdGhEZWxlZ2F0ZTogKCkgPT4gbnVtYmVyLFxuXHRcdGNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbjogQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLFxuXHRcdGNvZGVCbG9ja1N0YXJ0SW5kZXg6IG51bWJlcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmRvbU5vZGUgPSBkb20uJCgnLmNoYXQtdG9vbC1pbnZvY2F0aW9uLXBhcnQnKTtcblx0XHRpZiAodG9vbEludm9jYXRpb24ucHJlc2VudGF0aW9uID09PSAnaGlkZGVuJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgcGFydCBpcyBhIGJpdCBkaWZmZXJlbnQsIHNpbmNlIElDaGF0VG9vbEludm9jYXRpb24gaXMgbm90IGFuIGltbXV0YWJsZSBtb2RlbCBvYmplY3QuIFNvIHRoaXMgcGFydCBpcyBhYmxlIHRvIHJlcmVuZGVyIGl0c2VsZi5cblx0XHQvLyBJZiB0aGlzIHR1cm5zIG91dCB0byBiZSBhIHR5cGljYWwgcGF0dGVybiwgd2UgY291bGQgY29tZSB1cCB3aXRoIGEgbW9yZSByZXVzYWJsZSBwYXR0ZXJuLCBsaWtlIHRlbGxpbmcgdGhlIGxpc3QgdG8gcmVyZW5kZXIgYW4gZWxlbWVudFxuXHRcdC8vIHdoZW4gdGhlIG1vZGVsIGNoYW5nZXMsIG9yIHRyeWluZyB0byBtYWtlIHRoZSBtb2RlbCBpbW11dGFibGUgYW5kIHN3YXAgb3V0IG9uZSBjb250ZW50IHBhcnQgZm9yIGEgbmV3IG9uZSBiYXNlZCBvbiB1c2VyIGFjdGlvbnMgaW4gdGhlIHZpZXcuXG5cdFx0Y29uc3QgcGFydFN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCByZW5kZXIgPSAoKSA9PiB7XG5cdFx0XHRkb20uY2xlYXJOb2RlKHRoaXMuZG9tTm9kZSk7XG5cdFx0XHRwYXJ0U3RvcmUuY2xlYXIoKTtcblxuXHRcdFx0dGhpcy5zdWJQYXJ0ID0gcGFydFN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0VG9vbEludm9jYXRpb25TdWJQYXJ0LCB0b29sSW52b2NhdGlvbiwgY29udGV4dCwgcmVuZGVyZXIsIGxpc3RQb29sLCBlZGl0b3JQb29sLCBjdXJyZW50V2lkdGhEZWxlZ2F0ZSwgY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLCBjb2RlQmxvY2tTdGFydEluZGV4KSk7XG5cdFx0XHR0aGlzLmRvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5zdWJQYXJ0LmRvbU5vZGUpO1xuXHRcdFx0cGFydFN0b3JlLmFkZCh0aGlzLnN1YlBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpKSk7XG5cdFx0XHRwYXJ0U3RvcmUuYWRkKHRoaXMuc3ViUGFydC5vbk5lZWRzUmVyZW5kZXIoKCkgPT4ge1xuXHRcdFx0XHRyZW5kZXIoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdFx0fSkpO1xuXHRcdH07XG5cdFx0cmVuZGVyKCk7XG5cdH1cblxuXHRoYXNTYW1lQ29udGVudChvdGhlcjogSUNoYXRSZW5kZXJlckNvbnRlbnQsIGZvbGxvd2luZ0NvbnRlbnQ6IElDaGF0UmVuZGVyZXJDb250ZW50W10sIGVsZW1lbnQ6IENoYXRUcmVlSXRlbSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAob3RoZXIua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uJyB8fCBvdGhlci5raW5kID09PSAndG9vbEludm9jYXRpb25TZXJpYWxpemVkJykgJiYgdGhpcy50b29sSW52b2NhdGlvbi50b29sQ2FsbElkID09PSBvdGhlci50b29sQ2FsbElkO1xuXHR9XG5cblx0YWRkRGlzcG9zYWJsZShkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGUpO1xuXHR9XG59XG5cbmNsYXNzIENoYXRUb29sSW52b2NhdGlvblN1YlBhcnQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBzdGF0aWMgaWRQb29sID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfY29kZWJsb2Nrc1BhcnRJZCA9ICd0b29sLScgKyAoQ2hhdFRvb2xJbnZvY2F0aW9uU3ViUGFydC5pZFBvb2wrKyk7XG5cblx0cHVibGljIHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgX29uTmVlZHNSZXJlbmRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25OZWVkc1JlcmVuZGVyID0gdGhpcy5fb25OZWVkc1JlcmVuZGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmV2ZW50O1xuXG5cdHByaXZhdGUgbWFya2Rvd25QYXJ0OiBDaGF0TWFya2Rvd25Db250ZW50UGFydCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY29kZWJsb2NrczogSUNoYXRDb2RlQmxvY2tJbmZvW10gPSBbXTtcblx0cHVibGljIGdldCBjb2RlYmxvY2tzKCk6IElDaGF0Q29kZUJsb2NrSW5mb1tdIHtcblx0XHQvLyBUT0RPIHRoaXMgaXMgd2VpcmQsIHRoZSBzZXBhcmF0ZSBjYXNlcyBzaG91bGQgbWF5YmUgYmUgdGhlaXIgb3duIFwic3VicGFydHNcIlxuXHRcdHJldHVybiB0aGlzLm1hcmtkb3duUGFydD8uY29kZWJsb2NrcyA/PyB0aGlzLl9jb2RlYmxvY2tzO1xuXHR9XG5cblx0cHVibGljIGdldCBjb2RlYmxvY2tzUGFydElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMubWFya2Rvd25QYXJ0Py5jb2RlYmxvY2tzUGFydElkID8/IHRoaXMuX2NvZGVibG9ja3NQYXJ0SWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRvb2xJbnZvY2F0aW9uOiBJQ2hhdFRvb2xJbnZvY2F0aW9uIHwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVyOiBNYXJrZG93blJlbmRlcmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbGlzdFBvb2w6IENvbGxhcHNpYmxlTGlzdFBvb2wsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBlZGl0b3JQb29sOiBFZGl0b3JQb29sLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY3VycmVudFdpZHRoRGVsZWdhdGU6ICgpID0+IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbjogQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29kZUJsb2NrU3RhcnRJbmRleDogbnVtYmVyLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2U6IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAodG9vbEludm9jYXRpb24ua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uJyAmJiB0b29sSW52b2NhdGlvbi5jb25maXJtYXRpb25NZXNzYWdlcykge1xuXHRcdFx0aWYgKHRvb2xJbnZvY2F0aW9uLnRvb2xTcGVjaWZpY0RhdGE/LmtpbmQgPT09ICd0ZXJtaW5hbCcpIHtcblx0XHRcdFx0dGhpcy5kb21Ob2RlID0gdGhpcy5jcmVhdGVUZXJtaW5hbENvbmZpcm1hdGlvbldpZGdldCh0b29sSW52b2NhdGlvbiwgdG9vbEludm9jYXRpb24udG9vbFNwZWNpZmljRGF0YSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmRvbU5vZGUgPSB0aGlzLmNyZWF0ZUNvbmZpcm1hdGlvbldpZGdldCh0b29sSW52b2NhdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0b29sSW52b2NhdGlvbi50b29sU3BlY2lmaWNEYXRhPy5raW5kID09PSAndGVybWluYWwnKSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUgPSB0aGlzLmNyZWF0ZVRlcm1pbmFsTWFya2Rvd25Qcm9ncmVzc1BhcnQodG9vbEludm9jYXRpb24sIHRvb2xJbnZvY2F0aW9uLnRvb2xTcGVjaWZpY0RhdGEpO1xuXHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheSh0b29sSW52b2NhdGlvbi5yZXN1bHREZXRhaWxzKSAmJiB0b29sSW52b2NhdGlvbi5yZXN1bHREZXRhaWxzPy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZG9tTm9kZSA9IHRoaXMuY3JlYXRlUmVzdWx0TGlzdCh0b29sSW52b2NhdGlvbi5wYXN0VGVuc2VNZXNzYWdlID8/IHRvb2xJbnZvY2F0aW9uLmludm9jYXRpb25NZXNzYWdlLCB0b29sSW52b2NhdGlvbi5yZXN1bHREZXRhaWxzKTtcblx0XHR9IGVsc2UgaWYgKGlzVG9vbFJlc3VsdElucHV0T3V0cHV0RGV0YWlscyh0b29sSW52b2NhdGlvbi5yZXN1bHREZXRhaWxzKSkge1xuXHRcdFx0dGhpcy5kb21Ob2RlID0gdGhpcy5jcmVhdGVJbnB1dE91dHB1dE1hcmtkb3duUHJvZ3Jlc3NQYXJ0KHRvb2xJbnZvY2F0aW9uLnBhc3RUZW5zZU1lc3NhZ2UgPz8gdG9vbEludm9jYXRpb24uaW52b2NhdGlvbk1lc3NhZ2UsIHRvb2xJbnZvY2F0aW9uLnJlc3VsdERldGFpbHMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUgPSB0aGlzLmNyZWF0ZVByb2dyZXNzUGFydCgpO1xuXHRcdH1cblxuXHRcdGlmICh0b29sSW52b2NhdGlvbi5raW5kID09PSAndG9vbEludm9jYXRpb24nICYmICF0b29sSW52b2NhdGlvbi5pc0NvbXBsZXRlKSB7XG5cdFx0XHR0b29sSW52b2NhdGlvbi5pc0NvbXBsZXRlUHJvbWlzZS50aGVuKCgpID0+IHRoaXMuX29uTmVlZHNSZXJlbmRlci5maXJlKCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQ29uZmlybWF0aW9uV2lkZ2V0KHRvb2xJbnZvY2F0aW9uOiBJQ2hhdFRvb2xJbnZvY2F0aW9uKTogSFRNTEVsZW1lbnQge1xuXHRcdGlmICghdG9vbEludm9jYXRpb24uY29uZmlybWF0aW9uTWVzc2FnZXMpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ29uZmlybWF0aW9uIG1lc3NhZ2VzIGFyZSBtaXNzaW5nJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHRpdGxlID0gdG9vbEludm9jYXRpb24uY29uZmlybWF0aW9uTWVzc2FnZXMudGl0bGU7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IHRvb2xJbnZvY2F0aW9uLmNvbmZpcm1hdGlvbk1lc3NhZ2VzLm1lc3NhZ2U7XG5cdFx0Y29uc3QgYWxsb3dBdXRvQ29uZmlybSA9IHRvb2xJbnZvY2F0aW9uLmNvbmZpcm1hdGlvbk1lc3NhZ2VzLmFsbG93QXV0b0NvbmZpcm07XG5cdFx0Y29uc3QgY29udGludWVMYWJlbCA9IGxvY2FsaXplKCdjb250aW51ZScsIFwiQ29udGludWVcIik7XG5cdFx0Y29uc3QgY29udGludWVLZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEFjY2VwdFRvb2xDb25maXJtYXRpb25BY3Rpb25JZCk/LmdldExhYmVsKCk7XG5cdFx0Y29uc3QgY29udGludWVUb29sdGlwID0gY29udGludWVLZXliaW5kaW5nID8gYCR7Y29udGludWVMYWJlbH0gKCR7Y29udGludWVLZXliaW5kaW5nfSlgIDogY29udGludWVMYWJlbDtcblx0XHRjb25zdCBjYW5jZWxMYWJlbCA9IGxvY2FsaXplKCdjYW5jZWwnLCBcIkNhbmNlbFwiKTtcblx0XHRjb25zdCBjYW5jZWxLZXliaW5kaW5nID0gdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKENhbmNlbENoYXRBY3Rpb25JZCk/LmdldExhYmVsKCk7XG5cdFx0Y29uc3QgY2FuY2VsVG9vbHRpcCA9IGNhbmNlbEtleWJpbmRpbmcgPyBgJHtjYW5jZWxMYWJlbH0gKCR7Y2FuY2VsS2V5YmluZGluZ30pYCA6IGNhbmNlbExhYmVsO1xuXG5cdFx0Y29uc3QgZW51bSBDb25maXJtYXRpb25PdXRjb21lIHtcblx0XHRcdEFsbG93LFxuXHRcdFx0RGlzYWxsb3csXG5cdFx0XHRBbGxvd1dvcmtzcGFjZSxcblx0XHRcdEFsbG93R2xvYmFsbHksXG5cdFx0XHRBbGxvd1Nlc3Npb24sXG5cdFx0fVxuXG5cdFx0Y29uc3QgYnV0dG9uczogSUNoYXRDb25maXJtYXRpb25CdXR0b25bXSA9IFtcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6IGNvbnRpbnVlTGFiZWwsXG5cdFx0XHRcdGRhdGE6IENvbmZpcm1hdGlvbk91dGNvbWUuQWxsb3csXG5cdFx0XHRcdHRvb2x0aXA6IGNvbnRpbnVlVG9vbHRpcCxcblx0XHRcdFx0bW9yZUFjdGlvbnM6ICFhbGxvd0F1dG9Db25maXJtID8gdW5kZWZpbmVkIDogW1xuXHRcdFx0XHRcdHsgbGFiZWw6IGxvY2FsaXplKCdhbGxvd1Nlc3Npb24nLCAnQWxsb3cgaW4gdGhpcyBTZXNzaW9uJyksIGRhdGE6IENvbmZpcm1hdGlvbk91dGNvbWUuQWxsb3dTZXNzaW9uLCB0b29sdGlwOiBsb2NhbGl6ZSgnYWxsb3dTZXNzc2lvblRvb2x0aXAnLCAnQWxsb3cgdGhpcyB0b29sIHRvIHJ1biBpbiB0aGlzIHNlc3Npb24gd2l0aG91dCBjb25maXJtYXRpb24uJykgfSxcblx0XHRcdFx0XHR7IGxhYmVsOiBsb2NhbGl6ZSgnYWxsb3dXb3Jrc3BhY2UnLCAnQWxsb3cgaW4gdGhpcyBXb3Jrc3BhY2UnKSwgZGF0YTogQ29uZmlybWF0aW9uT3V0Y29tZS5BbGxvd1dvcmtzcGFjZSwgdG9vbHRpcDogbG9jYWxpemUoJ2FsbG93V29ya3NwYWNlVG9vbHRpcCcsICdBbGxvdyB0aGlzIHRvb2wgdG8gcnVuIGluIHRoaXMgd29ya3NwYWNlIHdpdGhvdXQgY29uZmlybWF0aW9uLicpIH0sXG5cdFx0XHRcdFx0eyBsYWJlbDogbG9jYWxpemUoJ2FsbG93R2xvYmFsbHknLCAnQWx3YXlzIEFsbG93JyksIGRhdGE6IENvbmZpcm1hdGlvbk91dGNvbWUuQWxsb3dHbG9iYWxseSwgdG9vbHRpcDogbG9jYWxpemUoJ2FsbG93R2xvYmFsbFRvb2x0aXAnLCAnQWx3YXlzIGFsbG93IHRoaXMgdG9vbCB0byBydW4gd2l0aG91dCBjb25maXJtYXRpb24uJykgfSxcblx0XHRcdFx0XSxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIiksXG5cdFx0XHRcdGRhdGE6IENvbmZpcm1hdGlvbk91dGNvbWUuRGlzYWxsb3csXG5cdFx0XHRcdGlzU2Vjb25kYXJ5OiB0cnVlLFxuXHRcdFx0XHR0b29sdGlwOiBjYW5jZWxUb29sdGlwXG5cdFx0XHR9XTtcblx0XHRsZXQgY29uZmlybVdpZGdldDogQ2hhdENvbmZpcm1hdGlvbldpZGdldCB8IENoYXRDdXN0b21Db25maXJtYXRpb25XaWRnZXQ7XG5cdFx0aWYgKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0Y29uZmlybVdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdENoYXRDb25maXJtYXRpb25XaWRnZXQsXG5cdFx0XHRcdHRpdGxlLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRidXR0b25zXG5cdFx0XHQpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgY2hhdE1hcmtkb3duQ29udGVudDogSUNoYXRNYXJrZG93bkNvbnRlbnQgPSB7XG5cdFx0XHRcdGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnLFxuXHRcdFx0XHRjb250ZW50OiBtZXNzYWdlLFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGNvZGVCbG9ja1JlbmRlck9wdGlvbnM6IElDb2RlQmxvY2tSZW5kZXJPcHRpb25zID0ge1xuXHRcdFx0XHRoaWRlVG9vbGJhcjogdHJ1ZSxcblx0XHRcdFx0cmVzZXJ2ZVdpZHRoOiAxOSxcblx0XHRcdFx0dmVydGljYWxQYWRkaW5nOiA1LFxuXHRcdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdFx0d29yZFdyYXA6ICdvbidcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgZWxlbWVudHMgPSBkb20uaCgnZGl2JywgW1xuXHRcdFx0XHRkb20uaCgnLm1lc3NhZ2VAbWVzc2FnZScpLFxuXHRcdFx0XHRkb20uaCgnLmVkaXRvckBlZGl0b3InKSxcblx0XHRcdF0pO1xuXG5cdFx0XHRpZiAodG9vbEludm9jYXRpb24udG9vbFNwZWNpZmljRGF0YT8ua2luZCA9PT0gJ2lucHV0Jykge1xuXG5cdFx0XHRcdGNvbnN0IGlucHV0RGF0YSA9IHRvb2xJbnZvY2F0aW9uLnRvb2xTcGVjaWZpY0RhdGE7XG5cblx0XHRcdFx0Y29uc3QgY29kZUJsb2NrUmVuZGVyT3B0aW9uczogSUNvZGVCbG9ja1JlbmRlck9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0aGlkZVRvb2xiYXI6IHRydWUsXG5cdFx0XHRcdFx0cmVzZXJ2ZVdpZHRoOiAxOSxcblx0XHRcdFx0XHRtYXhIZWlnaHRJbkxpbmVzOiAxMyxcblx0XHRcdFx0XHR2ZXJ0aWNhbFBhZGRpbmc6IDUsXG5cdFx0XHRcdFx0ZWRpdG9yT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0d29yZFdyYXA6ICdvbicsXG5cdFx0XHRcdFx0XHRyZWFkT25seTogZmFsc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cblx0XHRcdFx0Y29uc3QgbGFuZ0lkID0gdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdqc29uJyk7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHRcdFx0SlNPTi5zdHJpbmdpZnkoaW5wdXREYXRhLnJhd0lucHV0LCB1bmRlZmluZWQsIDIpLFxuXHRcdFx0XHRcdHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQobGFuZ0lkKSxcblx0XHRcdFx0XHRjcmVhdGVUb29sSW5wdXRVcmkodG9vbEludm9jYXRpb24udG9vbElkKVxuXHRcdFx0XHQpKTtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JQb29sLmdldCgpKTtcblx0XHRcdFx0ZWRpdG9yLm9iamVjdC5yZW5kZXIoe1xuXHRcdFx0XHRcdGNvZGVCbG9ja0luZGV4OiB0aGlzLmNvZGVCbG9ja1N0YXJ0SW5kZXgsXG5cdFx0XHRcdFx0Y29kZUJsb2NrUGFydEluZGV4OiAwLFxuXHRcdFx0XHRcdGVsZW1lbnQ6IHRoaXMuY29udGV4dC5lbGVtZW50LFxuXHRcdFx0XHRcdGxhbmd1YWdlSWQ6IGxhbmdJZCA/PyAnanNvbicsXG5cdFx0XHRcdFx0cmVuZGVyT3B0aW9uczogY29kZUJsb2NrUmVuZGVyT3B0aW9ucyxcblx0XHRcdFx0XHR0ZXh0TW9kZWw6IFByb21pc2UucmVzb2x2ZShtb2RlbClcblx0XHRcdFx0fSwgdGhpcy5jdXJyZW50V2lkdGhEZWxlZ2F0ZSgpKTtcblx0XHRcdFx0dGhpcy5fY29kZWJsb2Nrcy5wdXNoKHtcblx0XHRcdFx0XHRjb2RlQmxvY2tJbmRleDogdGhpcy5jb2RlQmxvY2tTdGFydEluZGV4LFxuXHRcdFx0XHRcdGNvZGVtYXBwZXJVcmk6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRlbGVtZW50SWQ6IHRoaXMuY29udGV4dC5lbGVtZW50LmlkLFxuXHRcdFx0XHRcdGZvY3VzOiAoKSA9PiBlZGl0b3Iub2JqZWN0LmZvY3VzKCksXG5cdFx0XHRcdFx0aXNTdHJlYW1pbmc6IGZhbHNlLFxuXHRcdFx0XHRcdG93bmVyTWFya2Rvd25QYXJ0SWQ6IHRoaXMuY29kZWJsb2Nrc1BhcnRJZCxcblx0XHRcdFx0XHR1cmk6IG1vZGVsLnVyaSxcblx0XHRcdFx0XHR1cmlQcm9taXNlOiBQcm9taXNlLnJlc29sdmUobW9kZWwudXJpKVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yLm9iamVjdC5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0XHRcdGVkaXRvci5vYmplY3QubGF5b3V0KHRoaXMuY3VycmVudFdpZHRoRGVsZWdhdGUoKSk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChlID0+IHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0aW5wdXREYXRhLnJhd0lucHV0ID0gSlNPTi5wYXJzZShtb2RlbC5nZXRWYWx1ZSgpKTtcblx0XHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGVsZW1lbnRzLmVkaXRvci5hcHBlbmQoZWRpdG9yLm9iamVjdC5lbGVtZW50KTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5tYXJrZG93blBhcnQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRNYXJrZG93bkNvbnRlbnRQYXJ0LCBjaGF0TWFya2Rvd25Db250ZW50LCB0aGlzLmNvbnRleHQsIHRoaXMuZWRpdG9yUG9vbCwgZmFsc2UsIHRoaXMuY29kZUJsb2NrU3RhcnRJbmRleCwgdGhpcy5yZW5kZXJlciwgdGhpcy5jdXJyZW50V2lkdGhEZWxlZ2F0ZSgpLCB0aGlzLmNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbiwgeyBjb2RlQmxvY2tSZW5kZXJPcHRpb25zIH0pKTtcblx0XHRcdGVsZW1lbnRzLm1lc3NhZ2UuYXBwZW5kKHRoaXMubWFya2Rvd25QYXJ0LmRvbU5vZGUpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1hcmtkb3duUGFydC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblx0XHRcdGNvbmZpcm1XaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRDaGF0Q3VzdG9tQ29uZmlybWF0aW9uV2lkZ2V0LFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0ZWxlbWVudHMucm9vdCxcblx0XHRcdFx0dG9vbEludm9jYXRpb24udG9vbFNwZWNpZmljRGF0YT8ua2luZCA9PT0gJ2lucHV0Jyxcblx0XHRcdFx0YnV0dG9uc1xuXHRcdFx0KSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzVG9vbENvbmZpcm1hdGlvbiA9IENoYXRDb250ZXh0S2V5cy5FZGl0aW5nLmhhc1Rvb2xDb25maXJtYXRpb24uYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGhhc1Rvb2xDb25maXJtYXRpb24uc2V0KHRydWUpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlybVdpZGdldC5vbkRpZENsaWNrKGJ1dHRvbiA9PiB7XG5cdFx0XHRzd2l0Y2ggKGJ1dHRvbi5kYXRhIGFzIENvbmZpcm1hdGlvbk91dGNvbWUpIHtcblx0XHRcdFx0Y2FzZSBDb25maXJtYXRpb25PdXRjb21lLkFsbG93R2xvYmFsbHk6XG5cdFx0XHRcdFx0dGhpcy5sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLnNldFRvb2xBdXRvQ29uZmlybWF0aW9uKHRvb2xJbnZvY2F0aW9uLnRvb2xJZCwgJ3Byb2ZpbGUnLCB0cnVlKTtcblx0XHRcdFx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQuY29tcGxldGUodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29uZmlybWF0aW9uT3V0Y29tZS5BbGxvd1dvcmtzcGFjZTpcblx0XHRcdFx0XHR0aGlzLmxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2Uuc2V0VG9vbEF1dG9Db25maXJtYXRpb24odG9vbEludm9jYXRpb24udG9vbElkLCAnd29ya3NwYWNlJywgdHJ1ZSk7XG5cdFx0XHRcdFx0dG9vbEludm9jYXRpb24uY29uZmlybWVkLmNvbXBsZXRlKHRydWUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIENvbmZpcm1hdGlvbk91dGNvbWUuQWxsb3dTZXNzaW9uOlxuXHRcdFx0XHRcdHRoaXMubGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5zZXRUb29sQXV0b0NvbmZpcm1hdGlvbih0b29sSW52b2NhdGlvbi50b29sSWQsICdtZW1vcnknLCB0cnVlKTtcblx0XHRcdFx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQuY29tcGxldGUodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29uZmlybWF0aW9uT3V0Y29tZS5BbGxvdzpcblx0XHRcdFx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQuY29tcGxldGUodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgQ29uZmlybWF0aW9uT3V0Y29tZS5EaXNhbGxvdzpcblx0XHRcdFx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQuY29tcGxldGUoZmFsc2UpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maXJtV2lkZ2V0Lm9uRGlkQ2hhbmdlSGVpZ2h0KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBoYXNUb29sQ29uZmlybWF0aW9uLnJlc2V0KCkpKTtcblx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQucC50aGVuKCgpID0+IHtcblx0XHRcdGhhc1Rvb2xDb25maXJtYXRpb24ucmVzZXQoKTtcblx0XHRcdHRoaXMuX29uTmVlZHNSZXJlbmRlci5maXJlKCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGNvbmZpcm1XaWRnZXQuZG9tTm9kZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGVybWluYWxDb25maXJtYXRpb25XaWRnZXQodG9vbEludm9jYXRpb246IElDaGF0VG9vbEludm9jYXRpb24sIHRlcm1pbmFsRGF0YTogSUNoYXRUZXJtaW5hbFRvb2xJbnZvY2F0aW9uRGF0YSk6IEhUTUxFbGVtZW50IHtcblx0XHRpZiAoIXRvb2xJbnZvY2F0aW9uLmNvbmZpcm1hdGlvbk1lc3NhZ2VzKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvbmZpcm1hdGlvbiBtZXNzYWdlcyBhcmUgbWlzc2luZycpO1xuXHRcdH1cblx0XHRjb25zdCB0aXRsZSA9IHRvb2xJbnZvY2F0aW9uLmNvbmZpcm1hdGlvbk1lc3NhZ2VzLnRpdGxlO1xuXHRcdGNvbnN0IG1lc3NhZ2UgPSB0b29sSW52b2NhdGlvbi5jb25maXJtYXRpb25NZXNzYWdlcy5tZXNzYWdlO1xuXHRcdGNvbnN0IGNvbnRpbnVlTGFiZWwgPSBsb2NhbGl6ZSgnY29udGludWUnLCBcIkNvbnRpbnVlXCIpO1xuXHRcdGNvbnN0IGNvbnRpbnVlS2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2NlcHRUb29sQ29uZmlybWF0aW9uQWN0aW9uSWQpPy5nZXRMYWJlbCgpO1xuXHRcdGNvbnN0IGNvbnRpbnVlVG9vbHRpcCA9IGNvbnRpbnVlS2V5YmluZGluZyA/IGAke2NvbnRpbnVlTGFiZWx9ICgke2NvbnRpbnVlS2V5YmluZGluZ30pYCA6IGNvbnRpbnVlTGFiZWw7XG5cdFx0Y29uc3QgY2FuY2VsTGFiZWwgPSBsb2NhbGl6ZSgnY2FuY2VsJywgXCJDYW5jZWxcIik7XG5cdFx0Y29uc3QgY2FuY2VsS2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhDYW5jZWxDaGF0QWN0aW9uSWQpPy5nZXRMYWJlbCgpO1xuXHRcdGNvbnN0IGNhbmNlbFRvb2x0aXAgPSBjYW5jZWxLZXliaW5kaW5nID8gYCR7Y2FuY2VsTGFiZWx9ICgke2NhbmNlbEtleWJpbmRpbmd9KWAgOiBjYW5jZWxMYWJlbDtcblxuXHRcdGNvbnN0IGJ1dHRvbnM6IElDaGF0Q29uZmlybWF0aW9uQnV0dG9uW10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBjb250aW51ZUxhYmVsLFxuXHRcdFx0XHRkYXRhOiB0cnVlLFxuXHRcdFx0XHR0b29sdGlwOiBjb250aW51ZVRvb2x0aXBcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBjYW5jZWxMYWJlbCxcblx0XHRcdFx0ZGF0YTogZmFsc2UsXG5cdFx0XHRcdGlzU2Vjb25kYXJ5OiB0cnVlLFxuXHRcdFx0XHR0b29sdGlwOiBjYW5jZWxUb29sdGlwXG5cdFx0XHR9XTtcblx0XHRjb25zdCByZW5kZXJlZE1lc3NhZ2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnJlbmRlcmVyLnJlbmRlcihcblx0XHRcdHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJyA/IG5ldyBNYXJrZG93blN0cmluZyhtZXNzYWdlKSA6IG1lc3NhZ2UsXG5cdFx0XHR7IGFzeW5jUmVuZGVyQ2FsbGJhY2s6ICgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKSB9XG5cdFx0KSk7XG5cdFx0Y29uc3QgY29kZUJsb2NrUmVuZGVyT3B0aW9uczogSUNvZGVCbG9ja1JlbmRlck9wdGlvbnMgPSB7XG5cdFx0XHRoaWRlVG9vbGJhcjogdHJ1ZSxcblx0XHRcdHJlc2VydmVXaWR0aDogMTksXG5cdFx0XHR2ZXJ0aWNhbFBhZGRpbmc6IDUsXG5cdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdHdvcmRXcmFwOiAnb24nLFxuXHRcdFx0XHRyZWFkT25seTogZmFsc2Vcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IGxhbmdJZCA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlSWRCeUxhbmd1YWdlTmFtZSh0ZXJtaW5hbERhdGEubGFuZ3VhZ2UgPz8gJ3NoJykgPz8gJ3NoZWxsc2NyaXB0Jztcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKHRlcm1pbmFsRGF0YS5jb21tYW5kLCB0aGlzLmxhbmd1YWdlU2VydmljZS5jcmVhdGVCeUlkKGxhbmdJZCkpO1xuXHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yUG9vbC5nZXQoKSk7XG5cdFx0ZWRpdG9yLm9iamVjdC5yZW5kZXIoe1xuXHRcdFx0Y29kZUJsb2NrSW5kZXg6IHRoaXMuY29kZUJsb2NrU3RhcnRJbmRleCxcblx0XHRcdGNvZGVCbG9ja1BhcnRJbmRleDogMCxcblx0XHRcdGVsZW1lbnQ6IHRoaXMuY29udGV4dC5lbGVtZW50LFxuXHRcdFx0bGFuZ3VhZ2VJZDogbGFuZ0lkLFxuXHRcdFx0cmVuZGVyT3B0aW9uczogY29kZUJsb2NrUmVuZGVyT3B0aW9ucyxcblx0XHRcdHRleHRNb2RlbDogUHJvbWlzZS5yZXNvbHZlKG1vZGVsKVxuXHRcdH0sIHRoaXMuY3VycmVudFdpZHRoRGVsZWdhdGUoKSk7XG5cdFx0dGhpcy5fY29kZWJsb2Nrcy5wdXNoKHtcblx0XHRcdGNvZGVCbG9ja0luZGV4OiB0aGlzLmNvZGVCbG9ja1N0YXJ0SW5kZXgsXG5cdFx0XHRjb2RlbWFwcGVyVXJpOiB1bmRlZmluZWQsXG5cdFx0XHRlbGVtZW50SWQ6IHRoaXMuY29udGV4dC5lbGVtZW50LmlkLFxuXHRcdFx0Zm9jdXM6ICgpID0+IGVkaXRvci5vYmplY3QuZm9jdXMoKSxcblx0XHRcdGlzU3RyZWFtaW5nOiBmYWxzZSxcblx0XHRcdG93bmVyTWFya2Rvd25QYXJ0SWQ6IHRoaXMuY29kZWJsb2Nrc1BhcnRJZCxcblx0XHRcdHVyaTogbW9kZWwudXJpLFxuXHRcdFx0dXJpUHJvbWlzZTogUHJvbWlzZS5yZXNvbHZlKG1vZGVsLnVyaSlcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3RlcihlZGl0b3Iub2JqZWN0Lm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgoKSA9PiB7XG5cdFx0XHRlZGl0b3Iub2JqZWN0LmxheW91dCh0aGlzLmN1cnJlbnRXaWR0aERlbGVnYXRlKCkpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihtb2RlbC5vbkRpZENoYW5nZUNvbnRlbnQoZSA9PiB7XG5cdFx0XHR0ZXJtaW5hbERhdGEuY29tbWFuZCA9IG1vZGVsLmdldFZhbHVlKCk7XG5cdFx0fSkpO1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBkb20uJCgnJyk7XG5cdFx0ZG9tLmFwcGVuZChlbGVtZW50LCBlZGl0b3Iub2JqZWN0LmVsZW1lbnQpO1xuXHRcdGRvbS5hcHBlbmQoZWxlbWVudCwgcmVuZGVyZWRNZXNzYWdlLmVsZW1lbnQpO1xuXHRcdGNvbnN0IGNvbmZpcm1XaWRnZXQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q2hhdEN1c3RvbUNvbmZpcm1hdGlvbldpZGdldCxcblx0XHRcdHRpdGxlLFxuXHRcdFx0ZWxlbWVudCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0YnV0dG9uc1xuXHRcdCkpO1xuXG5cdFx0Q2hhdENvbnRleHRLZXlzLkVkaXRpbmcuaGFzVG9vbENvbmZpcm1hdGlvbi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpcm1XaWRnZXQub25EaWRDbGljayhidXR0b24gPT4ge1xuXHRcdFx0dG9vbEludm9jYXRpb24uY29uZmlybWVkLmNvbXBsZXRlKGJ1dHRvbi5kYXRhKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlybVdpZGdldC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblx0XHR0b29sSW52b2NhdGlvbi5jb25maXJtZWQucC50aGVuKCgpID0+IHtcblx0XHRcdENoYXRDb250ZXh0S2V5cy5FZGl0aW5nLmhhc1Rvb2xDb25maXJtYXRpb24uYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpLnNldChmYWxzZSk7XG5cdFx0XHR0aGlzLl9vbk5lZWRzUmVyZW5kZXIuZmlyZSgpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBjb25maXJtV2lkZ2V0LmRvbU5vZGU7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVByb2dyZXNzUGFydCgpOiBIVE1MRWxlbWVudCB7XG5cdFx0bGV0IGNvbnRlbnQ6IElNYXJrZG93blN0cmluZztcblx0XHRpZiAodGhpcy50b29sSW52b2NhdGlvbi5pc0NvbXBsZXRlICYmIHRoaXMudG9vbEludm9jYXRpb24uaXNDb25maXJtZWQgIT09IGZhbHNlICYmIHRoaXMudG9vbEludm9jYXRpb24ucGFzdFRlbnNlTWVzc2FnZSkge1xuXHRcdFx0Y29udGVudCA9IHR5cGVvZiB0aGlzLnRvb2xJbnZvY2F0aW9uLnBhc3RUZW5zZU1lc3NhZ2UgPT09ICdzdHJpbmcnID9cblx0XHRcdFx0bmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dCh0aGlzLnRvb2xJbnZvY2F0aW9uLnBhc3RUZW5zZU1lc3NhZ2UpIDpcblx0XHRcdFx0dGhpcy50b29sSW52b2NhdGlvbi5wYXN0VGVuc2VNZXNzYWdlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50ID0gdHlwZW9mIHRoaXMudG9vbEludm9jYXRpb24uaW52b2NhdGlvbk1lc3NhZ2UgPT09ICdzdHJpbmcnID9cblx0XHRcdFx0bmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dCh0aGlzLnRvb2xJbnZvY2F0aW9uLmludm9jYXRpb25NZXNzYWdlICsgJ1x1MjAyNicpIDpcblx0XHRcdFx0TWFya2Rvd25TdHJpbmcubGlmdCh0aGlzLnRvb2xJbnZvY2F0aW9uLmludm9jYXRpb25NZXNzYWdlKS5hcHBlbmRUZXh0KCdcdTIwMjYnKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcm9ncmVzc01lc3NhZ2U6IElDaGF0UHJvZ3Jlc3NNZXNzYWdlID0ge1xuXHRcdFx0a2luZDogJ3Byb2dyZXNzTWVzc2FnZScsXG5cdFx0XHRjb250ZW50XG5cdFx0fTtcblx0XHRjb25zdCBpY29uT3ZlcnJpZGUgPSAhdGhpcy50b29sSW52b2NhdGlvbi5pc0NvbmZpcm1lZCA/XG5cdFx0XHRDb2RpY29uLmVycm9yIDpcblx0XHRcdHRoaXMudG9vbEludm9jYXRpb24uaXNDb21wbGV0ZSA/XG5cdFx0XHRcdENvZGljb24uY2hlY2sgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcHJvZ3Jlc3NQYXJ0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UHJvZ3Jlc3NDb250ZW50UGFydCwgcHJvZ3Jlc3NNZXNzYWdlLCB0aGlzLnJlbmRlcmVyLCB0aGlzLmNvbnRleHQsIHVuZGVmaW5lZCwgdHJ1ZSwgaWNvbk92ZXJyaWRlKSk7XG5cdFx0cmV0dXJuIHByb2dyZXNzUGFydC5kb21Ob2RlO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUZXJtaW5hbE1hcmtkb3duUHJvZ3Jlc3NQYXJ0KHRvb2xJbnZvY2F0aW9uOiBJQ2hhdFRvb2xJbnZvY2F0aW9uIHwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsIHRlcm1pbmFsRGF0YTogSUNoYXRUZXJtaW5hbFRvb2xJbnZvY2F0aW9uRGF0YSk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBjb250ZW50ID0gbmV3IE1hcmtkb3duU3RyaW5nKGBcXGBcXGBcXGAke3Rlcm1pbmFsRGF0YS5sYW5ndWFnZX1cXG4ke3Rlcm1pbmFsRGF0YS5jb21tYW5kfVxcblxcYFxcYFxcYGApO1xuXHRcdGNvbnN0IGNoYXRNYXJrZG93bkNvbnRlbnQ6IElDaGF0TWFya2Rvd25Db250ZW50ID0ge1xuXHRcdFx0a2luZDogJ21hcmtkb3duQ29udGVudCcsXG5cdFx0XHRjb250ZW50OiBjb250ZW50IGFzIElNYXJrZG93blN0cmluZyxcblx0XHR9O1xuXG5cdFx0Y29uc3QgY29kZUJsb2NrUmVuZGVyT3B0aW9uczogSUNvZGVCbG9ja1JlbmRlck9wdGlvbnMgPSB7XG5cdFx0XHRoaWRlVG9vbGJhcjogdHJ1ZSxcblx0XHRcdHJlc2VydmVXaWR0aDogMTksXG5cdFx0XHR2ZXJ0aWNhbFBhZGRpbmc6IDUsXG5cdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdHdvcmRXcmFwOiAnb24nXG5cdFx0XHR9XG5cdFx0fTtcblx0XHR0aGlzLm1hcmtkb3duUGFydCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdE1hcmtkb3duQ29udGVudFBhcnQsIGNoYXRNYXJrZG93bkNvbnRlbnQsIHRoaXMuY29udGV4dCwgdGhpcy5lZGl0b3JQb29sLCBmYWxzZSwgdGhpcy5jb2RlQmxvY2tTdGFydEluZGV4LCB0aGlzLnJlbmRlcmVyLCB0aGlzLmN1cnJlbnRXaWR0aERlbGVnYXRlKCksIHRoaXMuY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLCB7IGNvZGVCbG9ja1JlbmRlck9wdGlvbnMgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubWFya2Rvd25QYXJ0Lm9uRGlkQ2hhbmdlSGVpZ2h0KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKSkpO1xuXHRcdGNvbnN0IGljb24gPSAhdGhpcy50b29sSW52b2NhdGlvbi5pc0NvbmZpcm1lZCA/XG5cdFx0XHRDb2RpY29uLmVycm9yIDpcblx0XHRcdHRoaXMudG9vbEludm9jYXRpb24uaXNDb21wbGV0ZSA/XG5cdFx0XHRcdENvZGljb24uY2hlY2sgOiBUaGVtZUljb24ubW9kaWZ5KENvZGljb24ubG9hZGluZywgJ3NwaW4nKTtcblx0XHRjb25zdCBwcm9ncmVzc1BhcnQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRDdXN0b21Qcm9ncmVzc1BhcnQsIHRoaXMubWFya2Rvd25QYXJ0LmRvbU5vZGUsIGljb24pO1xuXHRcdHJldHVybiBwcm9ncmVzc1BhcnQuZG9tTm9kZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSW5wdXRPdXRwdXRNYXJrZG93blByb2dyZXNzUGFydChtZXNzYWdlOiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmcsIGlucHV0T3V0cHV0RGF0YTogSVRvb2xSZXN1bHRJbnB1dE91dHB1dERldGFpbHMpOiBIVE1MRWxlbWVudCB7XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKFxuXHRcdFx0YCR7aW5wdXRPdXRwdXREYXRhLmlucHV0fVxcblxcbiR7aW5wdXRPdXRwdXREYXRhLm91dHB1dH1gLFxuXHRcdFx0dGhpcy5sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZCgnanNvbicpXG5cdFx0KSk7XG5cblx0XHRjb25zdCBjb2xsYXBzaWJsZUxpc3RQYXJ0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdENoYXRDb2xsYXBzaWJsZUVkaXRvckNvbnRlbnRQYXJ0LFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdHRoaXMuY29udGV4dCxcblx0XHRcdHRoaXMuZWRpdG9yUG9vbCxcblx0XHRcdFByb21pc2UucmVzb2x2ZShtb2RlbCksXG5cdFx0XHRtb2RlbC5nZXRMYW5ndWFnZUlkKCksXG5cdFx0XHR7XG5cdFx0XHRcdGhpZGVUb29sYmFyOiB0cnVlLFxuXHRcdFx0XHRyZXNlcnZlV2lkdGg6IDE5LFxuXHRcdFx0XHRtYXhIZWlnaHRJbkxpbmVzOiAxMyxcblx0XHRcdFx0dmVydGljYWxQYWRkaW5nOiA1LFxuXHRcdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdFx0d29yZFdyYXA6ICdvbidcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0Y29kZUJsb2NrSW5kZXg6IHRoaXMuY29kZUJsb2NrU3RhcnRJbmRleCxcblx0XHRcdFx0Y29kZW1hcHBlclVyaTogdW5kZWZpbmVkLFxuXHRcdFx0XHRlbGVtZW50SWQ6IHRoaXMuY29udGV4dC5lbGVtZW50LmlkLFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0XHRpc1N0cmVhbWluZzogZmFsc2UsXG5cdFx0XHRcdG93bmVyTWFya2Rvd25QYXJ0SWQ6IHRoaXMuY29kZWJsb2Nrc1BhcnRJZCxcblx0XHRcdFx0dXJpOiBtb2RlbC51cmksXG5cdFx0XHRcdHVyaVByb21pc2U6IFByb21pc2UucmVzb2x2ZShtb2RlbC51cmkpXG5cdFx0XHR9XG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29sbGFwc2libGVMaXN0UGFydC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblx0XHRyZXR1cm4gY29sbGFwc2libGVMaXN0UGFydC5kb21Ob2RlO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVSZXN1bHRMaXN0KFxuXHRcdG1lc3NhZ2U6IHN0cmluZyB8IElNYXJrZG93blN0cmluZyxcblx0XHR0b29sRGV0YWlsczogQXJyYXk8VVJJIHwgTG9jYXRpb24+LFxuXHQpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgY29sbGFwc2libGVMaXN0UGFydCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDaGF0Q29sbGFwc2libGVMaXN0Q29udGVudFBhcnQsXG5cdFx0XHR0b29sRGV0YWlscy5tYXA8SUNoYXRDb2xsYXBzaWJsZUxpc3RJdGVtPihkZXRhaWwgPT4gKHtcblx0XHRcdFx0a2luZDogJ3JlZmVyZW5jZScsXG5cdFx0XHRcdHJlZmVyZW5jZTogZGV0YWlsLFxuXHRcdFx0fSkpLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdHRoaXMuY29udGV4dCxcblx0XHRcdHRoaXMubGlzdFBvb2wsXG5cdFx0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29sbGFwc2libGVMaXN0UGFydC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblx0XHRyZXR1cm4gY29sbGFwc2libGVMaXN0UGFydC5kb21Ob2RlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQTBCLHNCQUFzQjtBQUNoRCxTQUFTLFlBQVksaUJBQThCLG9CQUFvQjtBQUN2RSxTQUFTLGlCQUFpQjtBQUkxQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUloQyxTQUFTLG9CQUFvQiw0QkFBNEIsc0NBQXFFO0FBQzlILFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0NBQXNDO0FBRy9DLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsd0JBQXdCLG9DQUE2RDtBQUU5RixTQUFTLCtCQUEyQztBQUNwRCxTQUFTLHdCQUF3QiwrQkFBK0I7QUFDaEUsU0FBUyxzQ0FBcUY7QUFFdkYsSUFBTSx5QkFBTixjQUFxQyxXQUF1QztBQUFBLEVBZ0JsRixZQUNrQixnQkFDakIsU0FDQSxVQUNBLFVBQ0EsWUFDQSxzQkFDQSwwQkFDQSxxQkFDdUIsc0JBQ3RCO0FBQ0QsVUFBTTtBQVZXO0FBZGxCLFNBQVEscUJBQXFCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUMvRCxTQUFnQixvQkFBb0IsS0FBSyxtQkFBbUI7QUF5QjNELFNBQUssVUFBVSxJQUFJLEVBQUUsNEJBQTRC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QUN0QztBQUFBLElBQ0QsQ0FBQztBQUNELFNBQUssVUFBVSxvQkFBb0Isa0JBQWtCLE1BQU0sS0FBSyxtQkFBbUIsS0FBSyxDQUFDLENBQUM7QUFDMUYsV0FBTyxvQkFBb0I7QUFBQSxFQUM1QjtBQUFBLEVBRVEsaUJBQ1AsU0FDQSxhQUNjO0FBQ2QsVUFBTSxzQkFBc0IsS0FBSyxVQUFVLEtBQUsscUJBQXFCO0FBQUEsTUFDcEU7QUFBQSxNQUNBLFlBQVksSUFBOEIsYUFBVztBQUFBLFFBQ3BELE1BQU07QUFBQSxRQUNOLFdBQVc7QUFBQSxNQUNaLEVBQUU7QUFBQSxNQUNGO0FBQUEsTUFDQSxLQUFLO0FBQUEsTUFDTCxLQUFLO0FBQUEsSUFDTixDQUFDO0FBQ0QsU0FBSyxVQUFVLG9CQUFvQixrQkFBa0IsTUFBTSxLQUFLLG1CQUFtQixLQUFLLENBQUMsQ0FBQztBQUMxRixXQUFPLG9CQUFvQjtBQUFBLEVBQzVCO0FBQ0Q7QUF2YU0sMEJBQ1UsU0FBUztBQURuQiw0QkFBTjtBQUFBLEVBZ0NHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQXJDRzsiLAogICJuYW1lcyI6IFsiQ29uZmlybWF0aW9uT3V0Y29tZSIsICJjb2RlQmxvY2tSZW5kZXJPcHRpb25zIl0KfQo=
