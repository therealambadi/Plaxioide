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
import { renderFormattedText } from "../../../../base/browser/formattedTextRenderer.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { coalesce, distinct } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, dispose, thenIfNotDisposed, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { FileAccess } from "../../../../base/common/network.js";
import { clamp } from "../../../../base/common/numbers.js";
import { autorun } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IWorkbenchIssueService } from "../../issue/common/issue.js";
import { annotateSpecialMarkdownContent } from "../common/annotations.js";
import { checkModeOption } from "../common/chat.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { chatSubcommandLeader } from "../common/chatParserTypes.js";
import { ChatAgentVoteDirection, ChatAgentVoteDownReason, ChatErrorLevel, IChatService } from "../common/chatService.js";
import { isRequestVM, isResponseVM } from "../common/chatViewModel.js";
import { getNWords } from "../common/chatWordCounter.js";
import { CodeBlockModelCollection } from "../common/codeBlockModelCollection.js";
import { MarkUnhelpfulActionId } from "./actions/chatTitleActions.js";
import { IChatWidgetService } from "./chat.js";
import { ChatAgentHover, getChatAgentHoverOptions } from "./chatAgentHover.js";
import { ChatAgentCommandContentPart } from "./chatContentParts/chatAgentCommandContentPart.js";
import { ChatAttachmentsContentPart } from "./chatContentParts/chatAttachmentsContentPart.js";
import { ChatCodeCitationContentPart } from "./chatContentParts/chatCodeCitationContentPart.js";
import { ChatCommandButtonContentPart } from "./chatContentParts/chatCommandContentPart.js";
import { ChatConfirmationContentPart } from "./chatContentParts/chatConfirmationContentPart.js";
import { ChatMarkdownContentPart, EditorPool } from "./chatContentParts/chatMarkdownContentPart.js";
import { ChatProgressContentPart, ChatWorkingProgressContentPart } from "./chatContentParts/chatProgressContentPart.js";
import { ChatQuotaExceededPart } from "./chatContentParts/chatQuotaExceededPart.js";
import { ChatUsedReferencesListContentPart, CollapsibleListPool } from "./chatContentParts/chatReferencesContentPart.js";
import { ChatTaskContentPart } from "./chatContentParts/chatTaskContentPart.js";
import { ChatTextEditContentPart, DiffEditorPool } from "./chatContentParts/chatTextEditContentPart.js";
import { ChatToolInvocationPart } from "./chatContentParts/chatToolInvocationPart.js";
import { ChatTreeContentPart, TreePool } from "./chatContentParts/chatTreeContentPart.js";
import { ChatWarningContentPart } from "./chatContentParts/chatWarningContentPart.js";
import { ChatMarkdownDecorationsRenderer } from "./chatMarkdownDecorationsRenderer.js";
import { ChatMarkdownRenderer } from "./chatMarkdownRenderer.js";
import { ChatCodeBlockContentProvider } from "./codeBlockPart.js";
const $ = dom.$;
const forceVerboseLayoutTracing = false;
const mostRecentResponseClassName = "chat-most-recent-response";
let ChatListItemRenderer = class extends Disposable {
  constructor(editorOptions, rendererOptions, delegate, codeBlockModelCollection, overflowWidgetsDomNode, instantiationService, configService, logService, contextKeyService, themeService, commandService, hoverService, chatWidgetService, chatService) {
    super();
    this.rendererOptions = rendererOptions;
    this.delegate = delegate;
    this.codeBlockModelCollection = codeBlockModelCollection;
    this.instantiationService = instantiationService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.themeService = themeService;
    this.commandService = commandService;
    this.hoverService = hoverService;
    this.chatWidgetService = chatWidgetService;
    this.chatService = chatService;
    this.codeBlocksByResponseId = /* @__PURE__ */ new Map();
    this.codeBlocksByEditorUri = new ResourceMap();
    this.fileTreesByResponseId = /* @__PURE__ */ new Map();
    this.focusedFileTreesByResponseId = /* @__PURE__ */ new Map();
    this._onDidClickFollowup = this._register(new Emitter());
    this.onDidClickFollowup = this._onDidClickFollowup.event;
    this._onDidClickRerunWithAgentOrCommandDetection = new Emitter();
    this.onDidClickRerunWithAgentOrCommandDetection = this._onDidClickRerunWithAgentOrCommandDetection.event;
    this._onDidChangeItemHeight = this._register(new Emitter());
    this.onDidChangeItemHeight = this._onDidChangeItemHeight.event;
    this._currentLayoutWidth = 0;
    this._isVisible = true;
    this._onDidChangeVisibility = this._register(new Emitter());
    this.renderer = this.instantiationService.createInstance(ChatMarkdownRenderer, void 0);
    this.markdownDecorationsRenderer = this.instantiationService.createInstance(ChatMarkdownDecorationsRenderer);
    this._editorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode));
    this._toolEditorPool = this._register(this.instantiationService.createInstance(EditorPool, editorOptions, delegate, overflowWidgetsDomNode));
    this._diffEditorPool = this._register(this.instantiationService.createInstance(DiffEditorPool, editorOptions, delegate, overflowWidgetsDomNode));
    this._treePool = this._register(this.instantiationService.createInstance(TreePool, this._onDidChangeVisibility.event));
    this._contentReferencesListPool = this._register(this.instantiationService.createInstance(CollapsibleListPool, this._onDidChangeVisibility.event, void 0));
    this._register(this.instantiationService.createInstance(ChatCodeBlockContentProvider));
    this._toolInvocationCodeBlockCollection = this._register(this.instantiationService.createInstance(CodeBlockModelCollection, "tools"));
  }
  get templateId() {
    return ChatListItemRenderer.ID;
  }
  editorsInUse() {
    return Iterable.concat(this._editorPool.inUse(), this._toolEditorPool.inUse());
  }
  traceLayout(method, message) {
    if (forceVerboseLayoutTracing) {
      this.logService.info(`ChatListItemRenderer#${method}: ${message}`);
    } else {
      this.logService.trace(`ChatListItemRenderer#${method}: ${message}`);
    }
  }
  /**
   * Compute a rate to render at in words/s.
   */
  getProgressiveRenderRate(element) {
    let Rate;
    ((Rate2) => {
      Rate2[Rate2["Min"] = 5] = "Min";
      Rate2[Rate2["Max"] = 80] = "Max";
    })(Rate || (Rate = {}));
    if (element.isComplete || element.isPaused.get()) {
      return 80 /* Max */;
    }
    if (element.contentUpdateTimings && element.contentUpdateTimings.impliedWordLoadRate) {
      const rate = element.contentUpdateTimings.impliedWordLoadRate;
      return clamp(rate, 5 /* Min */, 80 /* Max */);
    }
    return 8;
  }
  getCodeBlockInfosForResponse(response) {
    const codeBlocks = this.codeBlocksByResponseId.get(response.id);
    return codeBlocks ?? [];
  }
  getCodeBlockInfoForEditor(uri) {
    return this.codeBlocksByEditorUri.get(uri);
  }
  getFileTreeInfosForResponse(response) {
    const fileTrees = this.fileTreesByResponseId.get(response.id);
    return fileTrees ?? [];
  }
  getLastFocusedFileTreeForResponse(response) {
    const fileTrees = this.fileTreesByResponseId.get(response.id);
    const lastFocusedFileTreeIndex = this.focusedFileTreesByResponseId.get(response.id);
    if (fileTrees?.length && lastFocusedFileTreeIndex !== void 0 && lastFocusedFileTreeIndex < fileTrees.length) {
      return fileTrees[lastFocusedFileTreeIndex];
    }
    return void 0;
  }
  setVisible(visible) {
    this._isVisible = visible;
    this._onDidChangeVisibility.fire(visible);
  }
  layout(width) {
    const newWidth = width - 40;
    if (newWidth !== this._currentLayoutWidth) {
      this._currentLayoutWidth = newWidth;
      for (const editor of this._editorPool.inUse()) {
        editor.layout(this._currentLayoutWidth);
      }
      for (const toolEditor of this._toolEditorPool.inUse()) {
        toolEditor.layout(this._currentLayoutWidth);
      }
      for (const diffEditor of this._diffEditorPool.inUse()) {
        diffEditor.layout(this._currentLayoutWidth);
      }
    }
  }
  renderTemplate(container) {
    const templateDisposables = new DisposableStore();
    const rowContainer = dom.append(container, $(".interactive-item-container"));
    if (this.rendererOptions.renderStyle === "compact") {
      rowContainer.classList.add("interactive-item-compact");
    }
    let headerParent = rowContainer;
    let valueParent = rowContainer;
    let detailContainerParent;
    let toolbarParent;
    if (this.rendererOptions.renderStyle === "minimal") {
      rowContainer.classList.add("interactive-item-compact");
      rowContainer.classList.add("minimal");
      const lhsContainer = dom.append(rowContainer, $(".column.left"));
      const rhsContainer = dom.append(rowContainer, $(".column.right"));
      headerParent = lhsContainer;
      detailContainerParent = rhsContainer;
      valueParent = rhsContainer;
      toolbarParent = dom.append(rowContainer, $(".header"));
    }
    const header = dom.append(headerParent, $(".header"));
    const user = dom.append(header, $(".user"));
    const avatarContainer = dom.append(user, $(".avatar-container"));
    const username = dom.append(user, $("h3.username"));
    username.tabIndex = 0;
    const detailContainer = dom.append(detailContainerParent ?? user, $("span.detail-container"));
    const detail = dom.append(detailContainer, $("span.detail"));
    dom.append(detailContainer, $("span.chat-animated-ellipsis"));
    const value = dom.append(valueParent, $(".value"));
    const elementDisposables = new DisposableStore();
    const contextKeyService = templateDisposables.add(this.contextKeyService.createScoped(rowContainer));
    const scopedInstantiationService = templateDisposables.add(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, contextKeyService])));
    let titleToolbar;
    if (this.rendererOptions.noHeader) {
      header.classList.add("hidden");
    } else {
      titleToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, toolbarParent ?? header, MenuId.ChatMessageTitle, {
        menuOptions: {
          shouldForwardArgs: true
        },
        toolbarOptions: {
          shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1
        }
      }));
    }
    const footerToolbarContainer = dom.append(rowContainer, $(".chat-footer-toolbar"));
    const footerToolbar = templateDisposables.add(scopedInstantiationService.createInstance(MenuWorkbenchToolBar, footerToolbarContainer, MenuId.ChatMessageFooter, {
      eventDebounceDelay: 0,
      menuOptions: { shouldForwardArgs: true, renderShortTitle: true },
      toolbarOptions: { shouldInlineSubmenu: (submenu) => submenu.actions.length <= 1 },
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction && action.item.id === MarkUnhelpfulActionId) {
          return scopedInstantiationService.createInstance(ChatVoteDownButton, action, options);
        }
        return createActionViewItem(scopedInstantiationService, action, options);
      }
    }));
    const agentHover = templateDisposables.add(this.instantiationService.createInstance(ChatAgentHover));
    const hoverContent = () => {
      if (isResponseVM(template.currentElement) && template.currentElement.agent && !template.currentElement.agent.isDefault) {
        agentHover.setAgent(template.currentElement.agent.id);
        return agentHover.domNode;
      }
      return void 0;
    };
    const hoverOptions = getChatAgentHoverOptions(() => isResponseVM(template.currentElement) ? template.currentElement.agent : void 0, this.commandService);
    templateDisposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), user, hoverContent, hoverOptions));
    templateDisposables.add(dom.addDisposableListener(user, dom.EventType.KEY_DOWN, (e) => {
      const ev = new StandardKeyboardEvent(e);
      if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
        const content = hoverContent();
        if (content) {
          this.hoverService.showInstantHover({ content, target: user, trapFocus: true, actions: hoverOptions.actions }, true);
        }
      } else if (ev.equals(KeyCode.Escape)) {
        this.hoverService.hideHover();
      }
    }));
    const template = { avatarContainer, username, detail, value, rowContainer, elementDisposables, templateDisposables, contextKeyService, instantiationService: scopedInstantiationService, agentHover, titleToolbar, footerToolbar };
    return template;
  }
  renderElement(node, index, templateData) {
    this.renderChatTreeItem(node.element, index, templateData);
  }
  clearRenderedParts(templateData) {
    if (templateData.renderedParts) {
      dispose(coalesce(templateData.renderedParts));
      templateData.renderedParts = void 0;
      dom.clearNode(templateData.value);
    }
  }
  renderChatTreeItem(element, index, templateData) {
    if (templateData.currentElement && templateData.currentElement.id !== element.id) {
      this.traceLayout("renderChatTreeItem", `Rendering a different element into the template, index=${index}`);
      this.clearRenderedParts(templateData);
    }
    templateData.currentElement = element;
    const kind = isRequestVM(element) ? "request" : isResponseVM(element) ? "response" : "welcome";
    this.traceLayout("renderElement", `${kind}, index=${index}`);
    ChatContextKeys.isResponse.bindTo(templateData.contextKeyService).set(isResponseVM(element));
    ChatContextKeys.itemId.bindTo(templateData.contextKeyService).set(element.id);
    ChatContextKeys.isRequest.bindTo(templateData.contextKeyService).set(isRequestVM(element));
    ChatContextKeys.responseDetectedAgentCommand.bindTo(templateData.contextKeyService).set(isResponseVM(element) && element.agentOrSlashCommandDetected);
    if (isResponseVM(element)) {
      ChatContextKeys.responseSupportsIssueReporting.bindTo(templateData.contextKeyService).set(!!element.agent?.metadata.supportIssueReporting);
      ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set(element.vote === ChatAgentVoteDirection.Up ? "up" : element.vote === ChatAgentVoteDirection.Down ? "down" : "");
    } else {
      ChatContextKeys.responseVote.bindTo(templateData.contextKeyService).set("");
    }
    if (templateData.titleToolbar) {
      templateData.titleToolbar.context = element;
    }
    templateData.footerToolbar.context = element;
    ChatContextKeys.responseHasError.bindTo(templateData.contextKeyService).set(isResponseVM(element) && !!element.errorDetails);
    const isFiltered = !!(isResponseVM(element) && element.errorDetails?.responseIsFiltered);
    ChatContextKeys.responseIsFiltered.bindTo(templateData.contextKeyService).set(isFiltered);
    const location = this.chatWidgetService.getWidgetBySessionId(element.sessionId)?.location;
    templateData.rowContainer.classList.toggle("editing-session", location && this.chatService.isEditingLocation(location));
    templateData.rowContainer.classList.toggle("interactive-request", isRequestVM(element));
    templateData.rowContainer.classList.toggle("interactive-response", isResponseVM(element));
    const progressMessageAtBottomOfResponse = checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse);
    templateData.rowContainer.classList.toggle("show-detail-progress", isResponseVM(element) && !element.isComplete && !element.progressMessages.length && !element.model.isPaused.get() && !progressMessageAtBottomOfResponse);
    templateData.username.textContent = element.username;
    if (!this.rendererOptions.noHeader) {
      this.renderAvatar(element, templateData);
    }
    dom.clearNode(templateData.detail);
    if (isResponseVM(element)) {
      this.renderDetail(element, templateData);
    }
    templateData.rowContainer.classList.toggle(mostRecentResponseClassName, index === this.delegate.getListLength() - 1);
    if (isRequestVM(element) && element.confirmation) {
      this.renderConfirmationAction(element, templateData);
    }
    if (isResponseVM(element) && index === this.delegate.getListLength() - 1 && (!element.isComplete || element.renderData)) {
      this.traceLayout("renderElement", `start progressive render, index=${index}`);
      const timer = templateData.elementDisposables.add(new dom.WindowIntervalTimer());
      const runProgressiveRender = (initial) => {
        try {
          if (this.doNextProgressiveRender(element, index, templateData, !!initial)) {
            timer.cancel();
          }
        } catch (err) {
          timer.cancel();
          this.logService.error(err);
        }
      };
      timer.cancelAndSet(runProgressiveRender, 50, dom.getWindow(templateData.rowContainer));
      runProgressiveRender(true);
    } else {
      if (isResponseVM(element)) {
        this.basicRenderElement(element, index, templateData);
      } else if (isRequestVM(element)) {
        this.basicRenderElement(element, index, templateData);
      }
    }
  }
  renderDetail(element, templateData) {
    templateData.elementDisposables.add(autorun((reader) => {
      this._renderDetail(element, templateData);
    }));
  }
  _renderDetail(element, templateData) {
    dom.clearNode(templateData.detail);
    if (element.agentOrSlashCommandDetected) {
      const msg = element.slashCommand ? localize("usedAgentSlashCommand", "used {0} [[(rerun without)]]", `${chatSubcommandLeader}${element.slashCommand.name}`) : localize("usedAgent", "[[(rerun without)]]");
      dom.reset(templateData.detail, renderFormattedText(msg, {
        className: "agentOrSlashCommandDetected",
        inline: true,
        actionHandler: {
          disposables: templateData.elementDisposables,
          callback: (content) => {
            this._onDidClickRerunWithAgentOrCommandDetection.fire(element);
          }
        }
      }));
    } else if (this.rendererOptions.renderStyle !== "minimal" && !element.isComplete && !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
      if (element.model.isPaused.get()) {
        templateData.detail.textContent = localize("paused", "Paused");
      } else {
        templateData.detail.textContent = localize("working", "Working");
      }
    }
  }
  renderConfirmationAction(element, templateData) {
    dom.clearNode(templateData.detail);
    if (element.confirmation) {
      templateData.detail.textContent = localize("chatConfirmationAction", 'selected "{0}"', element.confirmation);
    }
  }
  renderAvatar(element, templateData) {
    const icon = isResponseVM(element) ? this.getAgentIcon(element.agent?.metadata) : element.avatarIcon ?? Codicon.account;
    if (icon instanceof URI) {
      const avatarIcon = dom.$("img.icon");
      avatarIcon.src = FileAccess.uriToBrowserUri(icon).toString(true);
      templateData.avatarContainer.replaceChildren(dom.$(".avatar", void 0, avatarIcon));
    } else {
      const avatarIcon = dom.$(ThemeIcon.asCSSSelector(icon));
      templateData.avatarContainer.replaceChildren(dom.$(".avatar.codicon-avatar", void 0, avatarIcon));
    }
  }
  getAgentIcon(agent) {
    if (agent?.themeIcon) {
      return agent.themeIcon;
    } else if (agent?.iconDark && this.themeService.getColorTheme().type === ColorScheme.DARK) {
      return agent.iconDark;
    } else if (agent?.icon) {
      return agent.icon;
    } else {
      return Codicon.copilot;
    }
  }
  basicRenderElement(element, index, templateData) {
    templateData.rowContainer.classList.toggle("chat-response-loading", isResponseVM(element) && !element.isComplete);
    let value = [];
    if (isRequestVM(element) && !element.confirmation) {
      const markdown = "message" in element.message ? element.message.message : this.markdownDecorationsRenderer.convertParsedRequestToMarkdown(element.message);
      value = [{ content: new MarkdownString(markdown), kind: "markdownContent" }];
      if (this.rendererOptions.renderStyle === "minimal" && !element.isComplete) {
        templateData.value.classList.add("inline-progress");
        templateData.elementDisposables.add(toDisposable(() => templateData.value.classList.remove("inline-progress")));
        value.push({ content: new MarkdownString("<span></span>", { supportHtml: true }), kind: "markdownContent" });
      } else {
        templateData.value.classList.remove("inline-progress");
      }
    } else if (isResponseVM(element)) {
      if (element.contentReferences.length) {
        value.push({ kind: "references", references: element.contentReferences });
      }
      value.push(...annotateSpecialMarkdownContent(element.response.value));
      if (element.codeCitations.length) {
        value.push({ kind: "codeCitations", citations: element.codeCitations });
      }
    }
    dom.clearNode(templateData.value);
    if (isResponseVM(element)) {
      this.renderDetail(element, templateData);
    }
    const isFiltered = !!(isResponseVM(element) && element.errorDetails?.responseIsFiltered);
    const parts = [];
    if (!isFiltered) {
      let inlineSlashCommandRendered = false;
      value.forEach((data, index2) => {
        const context = {
          element,
          contentIndex: index2,
          content: value,
          preceedingContentParts: parts
        };
        const newPart = this.renderChatContentPart(data, templateData, context);
        if (newPart) {
          if (this.rendererOptions.renderDetectedCommandsWithRequest && !inlineSlashCommandRendered && isRequestVM(element) && element.agentOrSlashCommandDetected && element.slashCommand && data.kind === "markdownContent") {
            if (newPart.domNode) {
              newPart.domNode.style.display = "inline-flex";
            }
            const cmdPart = this.instantiationService.createInstance(ChatAgentCommandContentPart, element.slashCommand, () => this._onDidClickRerunWithAgentOrCommandDetection.fire({ sessionId: element.sessionId, requestId: element.id }));
            templateData.value.appendChild(cmdPart.domNode);
            parts.push(cmdPart);
            inlineSlashCommandRendered = true;
          }
          if (newPart.domNode) {
            templateData.value.appendChild(newPart.domNode);
          }
          parts.push(newPart);
        }
      });
    }
    if (templateData.renderedParts) {
      dispose(templateData.renderedParts);
    }
    templateData.renderedParts = parts;
    if (!isFiltered) {
      if (isRequestVM(element) && element.variables.length) {
        const newPart = this.renderAttachments(element.variables, element.contentReferences, templateData);
        if (newPart) {
          if (newPart.domNode) {
            templateData.value.appendChild(newPart.domNode);
          }
          templateData.elementDisposables.add(newPart);
        }
      }
    }
    if (isResponseVM(element) && element.errorDetails?.message) {
      if (element.errorDetails.isQuotaExceeded) {
        const renderedError = this.instantiationService.createInstance(ChatQuotaExceededPart, element, this.renderer);
        templateData.elementDisposables.add(renderedError);
        templateData.value.appendChild(renderedError.domNode);
        templateData.elementDisposables.add(renderedError.onDidChangeHeight(() => this.updateItemHeight(templateData)));
      } else {
        const level = element.errorDetails.level ?? (element.errorDetails.responseIsFiltered ? ChatErrorLevel.Info : ChatErrorLevel.Error);
        const renderedError = this.instantiationService.createInstance(ChatWarningContentPart, level, new MarkdownString(element.errorDetails.message), this.renderer);
        templateData.elementDisposables.add(renderedError);
        templateData.value.appendChild(renderedError.domNode);
      }
    }
    const newHeight = templateData.rowContainer.offsetHeight;
    const fireEvent = !element.currentRenderedHeight || element.currentRenderedHeight !== newHeight;
    element.currentRenderedHeight = newHeight;
    if (fireEvent) {
      const disposable = templateData.elementDisposables.add(dom.scheduleAtNextAnimationFrame(dom.getWindow(templateData.value), () => {
        element.currentRenderedHeight = templateData.rowContainer.offsetHeight;
        disposable.dispose();
        this._onDidChangeItemHeight.fire({ element, height: element.currentRenderedHeight });
      }));
    }
  }
  updateItemHeight(templateData) {
    if (!templateData.currentElement) {
      return;
    }
    const newHeight = Math.max(templateData.rowContainer.offsetHeight, 1);
    templateData.currentElement.currentRenderedHeight = newHeight;
    this._onDidChangeItemHeight.fire({ element: templateData.currentElement, height: newHeight });
  }
  /**
   *	@returns true if progressive rendering should be considered complete- the element's data is fully rendered or the view is not visible
   */
  doNextProgressiveRender(element, index, templateData, isInRenderElement) {
    if (!this._isVisible) {
      return true;
    }
    if (element.isCanceled) {
      this.traceLayout("doNextProgressiveRender", `canceled, index=${index}`);
      element.renderData = void 0;
      this.basicRenderElement(element, index, templateData);
      return true;
    }
    templateData.rowContainer.classList.toggle("chat-response-loading", true);
    this.traceLayout("doNextProgressiveRender", `START progressive render, index=${index}, renderData=${JSON.stringify(element.renderData)}`);
    const contentForThisTurn = this.getNextProgressiveRenderContent(element);
    const partsToRender = this.diff(templateData.renderedParts ?? [], contentForThisTurn.content, element);
    const contentIsAlreadyRendered = partsToRender.every((part) => part === null);
    if (contentIsAlreadyRendered) {
      if (contentForThisTurn.moreContentAvailable) {
        this.traceLayout("doNextProgressiveRender", "not rendering any new content this tick, but more available");
        return false;
      } else if (element.isComplete) {
        this.traceLayout("doNextProgressiveRender", `END progressive render, index=${index} and clearing renderData, response is complete`);
        element.renderData = void 0;
        this.basicRenderElement(element, index, templateData);
        return true;
      } else {
        this.traceLayout("doNextProgressiveRender", "caught up with the stream- no new content to render");
        if (!templateData.renderedParts) {
          const height2 = templateData.rowContainer.offsetHeight;
          element.currentRenderedHeight = height2;
        }
        return true;
      }
    }
    this.traceLayout("doNextProgressiveRender", `doing progressive render, ${partsToRender.length} parts to render`);
    this.renderChatContentDiff(partsToRender, contentForThisTurn.content, element, templateData);
    const height = templateData.rowContainer.offsetHeight;
    element.currentRenderedHeight = height;
    if (!isInRenderElement) {
      this._onDidChangeItemHeight.fire({ element, height });
    }
    return false;
  }
  renderChatContentDiff(partsToRender, contentForThisTurn, element, templateData) {
    const renderedParts = templateData.renderedParts ?? [];
    templateData.renderedParts = renderedParts;
    partsToRender.forEach((partToRender, index) => {
      if (!partToRender) {
        return;
      }
      const alreadyRenderedPart = templateData.renderedParts?.[index];
      if (alreadyRenderedPart) {
        alreadyRenderedPart.dispose();
      }
      const preceedingContentParts = renderedParts.slice(0, index);
      const context = {
        element,
        content: contentForThisTurn,
        preceedingContentParts,
        contentIndex: index
      };
      const newPart = this.renderChatContentPart(partToRender, templateData, context);
      if (newPart) {
        renderedParts[index] = newPart;
        try {
          if (alreadyRenderedPart?.domNode) {
            if (newPart.domNode) {
              alreadyRenderedPart.domNode.replaceWith(newPart.domNode);
            } else {
              alreadyRenderedPart.domNode.remove();
            }
          } else if (newPart.domNode) {
            templateData.value.appendChild(newPart.domNode);
          }
        } catch (err) {
          this.logService.error("ChatListItemRenderer#renderChatContentDiff: error replacing part", err);
        }
      } else {
        alreadyRenderedPart?.domNode?.remove();
      }
    });
  }
  /**
   * Returns all content parts that should be rendered, and trimmed markdown content. We will diff this with the current rendered set.
   */
  getNextProgressiveRenderContent(element) {
    const data = this.getDataForProgressiveRender(element);
    const renderableResponse = annotateSpecialMarkdownContent(element.response.value);
    this.traceLayout("getNextProgressiveRenderContent", `Want to render ${data.numWordsToRender} at ${data.rate} words/s, counting...`);
    let numNeededWords = data.numWordsToRender;
    const partsToRender = [];
    partsToRender.push({ kind: "references", references: element.contentReferences });
    let moreContentAvailable = false;
    for (let i = 0; i < renderableResponse.length; i++) {
      const part = renderableResponse[i];
      if (part.kind === "markdownContent") {
        const wordCountResult = getNWords(part.content.value, numNeededWords);
        this.traceLayout("getNextProgressiveRenderContent", `  Chunk ${i}: Want to render ${numNeededWords} words and found ${wordCountResult.returnedWordCount} words. Total words in chunk: ${wordCountResult.totalWordCount}`);
        numNeededWords -= wordCountResult.returnedWordCount;
        if (wordCountResult.isFullString) {
          partsToRender.push(part);
          for (const nextPart of renderableResponse.slice(i + 1)) {
            if (nextPart.kind !== "markdownContent") {
              i++;
              partsToRender.push(nextPart);
            } else {
              break;
            }
          }
        } else {
          moreContentAvailable = true;
          partsToRender.push({ ...part, content: new MarkdownString(wordCountResult.value, part.content) });
        }
        if (numNeededWords <= 0) {
          if (renderableResponse.slice(i + 1).some((part2) => part2.kind === "markdownContent")) {
            moreContentAvailable = true;
          }
          break;
        }
      } else {
        partsToRender.push(part);
      }
    }
    const lastWordCount = element.contentUpdateTimings?.lastWordCount ?? 0;
    const newRenderedWordCount = data.numWordsToRender - numNeededWords;
    const bufferWords = lastWordCount - newRenderedWordCount;
    this.traceLayout("getNextProgressiveRenderContent", `Want to render ${data.numWordsToRender} words. Rendering ${newRenderedWordCount} words. Buffer: ${bufferWords} words`);
    if (newRenderedWordCount > 0 && newRenderedWordCount !== element.renderData?.renderedWordCount) {
      element.renderData = { lastRenderTime: Date.now(), renderedWordCount: newRenderedWordCount, renderedParts: partsToRender };
    }
    if (this.shouldShowWorkingProgress(element, partsToRender)) {
      const isPaused = element.model.isPaused.get();
      partsToRender.push({ kind: "working", isPaused });
    }
    return { content: partsToRender, moreContentAvailable };
  }
  shouldShowWorkingProgress(element, partsToRender) {
    if (element.agentOrSlashCommandDetected || this.rendererOptions.renderStyle === "minimal" || element.isComplete || !checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.progressMessageAtBottomOfResponse)) {
      return false;
    }
    if (element.model.isPaused.get()) {
      return true;
    }
    const lastPart = partsToRender.at(-1);
    if (!lastPart || lastPart.kind === "references" || lastPart.kind === "toolInvocation" && (lastPart.isComplete || lastPart.presentation === "hidden") || (lastPart.kind === "textEditGroup" || lastPart.kind === "notebookEditGroup") && lastPart.done && !partsToRender.some((part) => part.kind === "toolInvocation" && !part.isComplete)) {
      return true;
    }
    return false;
  }
  getDataForProgressiveRender(element) {
    const renderData = element.renderData ?? { lastRenderTime: 0, renderedWordCount: 0 };
    const rate = this.getProgressiveRenderRate(element);
    const numWordsToRender = renderData.lastRenderTime === 0 ? 1 : renderData.renderedWordCount + // Additional words to render beyond what's already rendered
    Math.floor((Date.now() - renderData.lastRenderTime) / 1e3 * rate);
    return {
      numWordsToRender,
      rate
    };
  }
  diff(renderedParts, contentToRender, element) {
    const diff = [];
    for (let i = 0; i < contentToRender.length; i++) {
      const content = contentToRender[i];
      const renderedPart = renderedParts[i];
      if (!renderedPart || !renderedPart.hasSameContent(content, contentToRender.slice(i + 1), element)) {
        diff.push(content);
      } else {
        diff.push(null);
      }
    }
    return diff;
  }
  renderChatContentPart(content, templateData, context) {
    if (content.kind === "treeData") {
      return this.renderTreeData(content, templateData, context);
    } else if (content.kind === "progressMessage") {
      return this.instantiationService.createInstance(ChatProgressContentPart, content, this.renderer, context, void 0, void 0, void 0);
    } else if (content.kind === "progressTask") {
      return this.renderProgressTask(content, templateData, context);
    } else if (content.kind === "command") {
      return this.instantiationService.createInstance(ChatCommandButtonContentPart, content, context);
    } else if (content.kind === "textEditGroup") {
      return this.renderTextEdit(context, content, templateData);
    } else if (content.kind === "confirmation") {
      return this.renderConfirmation(context, content, templateData);
    } else if (content.kind === "warning") {
      return this.instantiationService.createInstance(ChatWarningContentPart, ChatErrorLevel.Warning, content.content, this.renderer);
    } else if (content.kind === "markdownContent") {
      return this.renderMarkdown(content, templateData, context);
    } else if (content.kind === "references") {
      return this.renderContentReferencesListData(content, void 0, context, templateData);
    } else if (content.kind === "codeCitations") {
      return this.renderCodeCitations(content, context, templateData);
    } else if (content.kind === "toolInvocation" || content.kind === "toolInvocationSerialized") {
      return this.renderToolInvocation(content, context, templateData);
    } else if (content.kind === "working") {
      return this.renderWorkingProgress(content, context);
    } else if (content.kind === "undoStop") {
      return this.renderUndoStop(content);
    }
    return this.renderNoContent((other) => content.kind === other.kind);
  }
  renderUndoStop(content) {
    return this.renderNoContent((other) => other.kind === content.kind && other.id === content.id);
  }
  renderNoContent(equals) {
    return {
      dispose: () => {
      },
      domNode: void 0,
      hasSameContent: equals
    };
  }
  renderTreeData(content, templateData, context) {
    const data = content.treeData;
    const treeDataIndex = context.preceedingContentParts.filter((part) => part instanceof ChatTreeContentPart).length;
    const treePart = this.instantiationService.createInstance(ChatTreeContentPart, data, context.element, this._treePool, treeDataIndex);
    treePart.addDisposable(treePart.onDidChangeHeight(() => {
      this.updateItemHeight(templateData);
    }));
    if (isResponseVM(context.element)) {
      const fileTreeFocusInfo = {
        treeDataId: data.uri.toString(),
        treeIndex: treeDataIndex,
        focus() {
          treePart.domFocus();
        }
      };
      treePart.addDisposable(treePart.onDidFocus(() => {
        this.focusedFileTreesByResponseId.set(context.element.id, fileTreeFocusInfo.treeIndex);
      }));
      const fileTrees = this.fileTreesByResponseId.get(context.element.id) ?? [];
      fileTrees.push(fileTreeFocusInfo);
      this.fileTreesByResponseId.set(context.element.id, distinct(fileTrees, (v) => v.treeDataId));
      treePart.addDisposable(toDisposable(() => this.fileTreesByResponseId.set(context.element.id, fileTrees.filter((v) => v.treeDataId !== data.uri.toString()))));
    }
    return treePart;
  }
  renderContentReferencesListData(references, labelOverride, context, templateData) {
    const referencesPart = this.instantiationService.createInstance(ChatUsedReferencesListContentPart, references.references, labelOverride, context, this._contentReferencesListPool, { expandedWhenEmptyResponse: checkModeOption(this.delegate.currentChatMode(), this.rendererOptions.referencesExpandedWhenEmptyResponse) });
    referencesPart.addDisposable(referencesPart.onDidChangeHeight(() => {
      this.updateItemHeight(templateData);
    }));
    return referencesPart;
  }
  renderCodeCitations(citations, context, templateData) {
    const citationsPart = this.instantiationService.createInstance(ChatCodeCitationContentPart, citations, context);
    return citationsPart;
  }
  getCodeBlockStartIndex(context) {
    return context.preceedingContentParts.reduce((acc, part) => acc + (part.codeblocks?.length ?? 0), 0);
  }
  handleRenderedCodeblocks(element, part, codeBlockStartIndex) {
    if (!part.addDisposable || part.codeblocksPartId === void 0) {
      return;
    }
    const codeBlocksByResponseId = this.codeBlocksByResponseId.get(element.id) ?? [];
    this.codeBlocksByResponseId.set(element.id, codeBlocksByResponseId);
    part.addDisposable(toDisposable(() => {
      const codeBlocksByResponseId2 = this.codeBlocksByResponseId.get(element.id);
      if (codeBlocksByResponseId2) {
        part.codeblocks?.forEach((info, i) => {
          const codeblock = codeBlocksByResponseId2[codeBlockStartIndex + i];
          if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
            delete codeBlocksByResponseId2[codeBlockStartIndex + i];
          }
        });
      }
    }));
    part.codeblocks?.forEach((info, i) => {
      codeBlocksByResponseId[codeBlockStartIndex + i] = info;
      part.addDisposable(thenIfNotDisposed(info.uriPromise, (uri) => {
        if (!uri) {
          return;
        }
        this.codeBlocksByEditorUri.set(uri, info);
        part.addDisposable(toDisposable(() => {
          const codeblock = this.codeBlocksByEditorUri.get(uri);
          if (codeblock?.ownerMarkdownPartId === part.codeblocksPartId) {
            this.codeBlocksByEditorUri.delete(uri);
          }
        }));
      }));
    });
  }
  renderToolInvocation(toolInvocation, context, templateData) {
    const codeBlockStartIndex = this.getCodeBlockStartIndex(context);
    const part = this.instantiationService.createInstance(ChatToolInvocationPart, toolInvocation, context, this.renderer, this._contentReferencesListPool, this._toolEditorPool, () => this._currentLayoutWidth, this._toolInvocationCodeBlockCollection, codeBlockStartIndex);
    part.addDisposable(part.onDidChangeHeight(() => {
      this.updateItemHeight(templateData);
    }));
    this.handleRenderedCodeblocks(context.element, part, codeBlockStartIndex);
    return part;
  }
  renderProgressTask(task, templateData, context) {
    if (!isResponseVM(context.element)) {
      return;
    }
    const taskPart = this.instantiationService.createInstance(ChatTaskContentPart, task, this._contentReferencesListPool, this.renderer, context);
    taskPart.addDisposable(taskPart.onDidChangeHeight(() => {
      this.updateItemHeight(templateData);
    }));
    return taskPart;
  }
  renderWorkingProgress(workingProgress, context) {
    return this.instantiationService.createInstance(ChatWorkingProgressContentPart, workingProgress, this.renderer, context);
  }
  renderConfirmation(context, confirmation, templateData) {
    const part = this.instantiationService.createInstance(ChatConfirmationContentPart, confirmation, context);
    part.addDisposable(part.onDidChangeHeight(() => this.updateItemHeight(templateData)));
    return part;
  }
  renderAttachments(variables, contentReferences, templateData) {
    return this.instantiationService.createInstance(ChatAttachmentsContentPart, variables, contentReferences, void 0);
  }
  renderTextEdit(context, chatTextEdit, templateData) {
    const textEditPart = this.instantiationService.createInstance(ChatTextEditContentPart, chatTextEdit, context, this.rendererOptions, this._diffEditorPool, this._currentLayoutWidth);
    textEditPart.addDisposable(textEditPart.onDidChangeHeight(() => {
      textEditPart.layout(this._currentLayoutWidth);
      this.updateItemHeight(templateData);
    }));
    return textEditPart;
  }
  renderMarkdown(markdown, templateData, context) {
    const element = context.element;
    const fillInIncompleteTokens = isResponseVM(element) && (!element.isComplete || element.isCanceled || element.errorDetails?.responseIsFiltered || element.errorDetails?.responseIsIncomplete || !!element.renderData);
    const codeBlockStartIndex = this.getCodeBlockStartIndex(context);
    const markdownPart = templateData.instantiationService.createInstance(ChatMarkdownContentPart, markdown, context, this._editorPool, fillInIncompleteTokens, codeBlockStartIndex, this.renderer, this._currentLayoutWidth, this.codeBlockModelCollection, {});
    markdownPart.addDisposable(markdownPart.onDidChangeHeight(() => {
      markdownPart.layout(this._currentLayoutWidth);
      this.updateItemHeight(templateData);
    }));
    this.handleRenderedCodeblocks(element, markdownPart, codeBlockStartIndex);
    return markdownPart;
  }
  disposeElement(node, index, templateData) {
    this.traceLayout("disposeElement", `Disposing element, index=${index}`);
    templateData.elementDisposables.clear();
    if (templateData.titleToolbar) {
      templateData.titleToolbar.context = void 0;
    }
    templateData.footerToolbar.context = void 0;
  }
  disposeTemplate(templateData) {
    templateData.templateDisposables.dispose();
  }
};
ChatListItemRenderer.ID = "item";
ChatListItemRenderer = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IChatWidgetService),
  __decorateParam(13, IChatService)
], ChatListItemRenderer);
let ChatListDelegate = class {
  constructor(defaultElementHeight, logService) {
    this.defaultElementHeight = defaultElementHeight;
    this.logService = logService;
  }
  _traceLayout(method, message) {
    if (forceVerboseLayoutTracing) {
      this.logService.info(`ChatListDelegate#${method}: ${message}`);
    } else {
      this.logService.trace(`ChatListDelegate#${method}: ${message}`);
    }
  }
  getHeight(element) {
    const kind = isRequestVM(element) ? "request" : "response";
    const height = ("currentRenderedHeight" in element ? element.currentRenderedHeight : void 0) ?? this.defaultElementHeight;
    this._traceLayout("getHeight", `${kind}, height=${height}`);
    return height;
  }
  getTemplateId(element) {
    return ChatListItemRenderer.ID;
  }
  hasDynamicHeight(element) {
    return true;
  }
};
ChatListDelegate = __decorateClass([
  __decorateParam(1, ILogService)
], ChatListDelegate);
const voteDownDetailLabels = {
  [ChatAgentVoteDownReason.IncorrectCode]: localize("incorrectCode", "Suggested incorrect code"),
  [ChatAgentVoteDownReason.DidNotFollowInstructions]: localize("didNotFollowInstructions", "Didn't follow instructions"),
  [ChatAgentVoteDownReason.MissingContext]: localize("missingContext", "Missing context"),
  [ChatAgentVoteDownReason.OffensiveOrUnsafe]: localize("offensiveOrUnsafe", "Offensive or unsafe"),
  [ChatAgentVoteDownReason.PoorlyWrittenOrFormatted]: localize("poorlyWrittenOrFormatted", "Poorly written or formatted"),
  [ChatAgentVoteDownReason.RefusedAValidRequest]: localize("refusedAValidRequest", "Refused a valid request"),
  [ChatAgentVoteDownReason.IncompleteCode]: localize("incompleteCode", "Incomplete code"),
  [ChatAgentVoteDownReason.WillReportIssue]: localize("reportIssue", "Report an issue"),
  [ChatAgentVoteDownReason.Other]: localize("other", "Other")
};
let ChatVoteDownButton = class extends DropdownMenuActionViewItem {
  constructor(action, options, commandService, issueService, logService, contextMenuService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        ...options,
        classNames: ThemeIcon.asClassNameArray(Codicon.thumbsdown)
      }
    );
    this.commandService = commandService;
    this.issueService = issueService;
    this.logService = logService;
  }
  getActions() {
    return [
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.IncorrectCode),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.DidNotFollowInstructions),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.IncompleteCode),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.MissingContext),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.PoorlyWrittenOrFormatted),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.RefusedAValidRequest),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.OffensiveOrUnsafe),
      this.getVoteDownDetailAction(ChatAgentVoteDownReason.Other),
      {
        id: "reportIssue",
        label: voteDownDetailLabels[ChatAgentVoteDownReason.WillReportIssue],
        tooltip: "",
        enabled: true,
        class: void 0,
        run: async (context) => {
          if (!isResponseVM(context)) {
            this.logService.error("ChatVoteDownButton#run: invalid context");
            return;
          }
          await this.commandService.executeCommand(MarkUnhelpfulActionId, context, ChatAgentVoteDownReason.WillReportIssue);
          await this.issueService.openReporter({ extensionId: context.agent?.extensionId.value });
        }
      }
    ];
  }
  render(container) {
    super.render(container);
    this.element?.classList.toggle("checked", this.action.checked);
  }
  getVoteDownDetailAction(reason) {
    const label = voteDownDetailLabels[reason];
    return {
      id: MarkUnhelpfulActionId,
      label,
      tooltip: "",
      enabled: true,
      checked: this._context.voteDownReason === reason,
      class: void 0,
      run: async (context) => {
        if (!isResponseVM(context)) {
          this.logService.error("ChatVoteDownButton#getVoteDownDetailAction: invalid context");
          return;
        }
        await this.commandService.executeCommand(MarkUnhelpfulActionId, context, reason);
      }
    };
  }
};
ChatVoteDownButton = __decorateClass([
  __decorateParam(2, ICommandService),
  __decorateParam(3, IWorkbenchIssueService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IContextMenuService)
], ChatVoteDownButton);
export {
  ChatListDelegate,
  ChatListItemRenderer,
  ChatVoteDownButton
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdExpc3RSZW5kZXJlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IHJlbmRlckZvcm1hdHRlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZm9ybWF0dGVkVGV4dFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSwgSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kcm9wZG93bi9kcm9wZG93bkFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGNvYWxlc2NlLCBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBGdXp6eVNjb3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIGRpc3Bvc2UsIHRoZW5JZk5vdERpc3Bvc2VkLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IGF1dG9ydW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9tYXJrZG93blJlbmRlcmVyL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zLCBjcmVhdGVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBNZW51V29ya2JlbmNoVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci90b29sYmFyLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaElzc3VlU2VydmljZSB9IGZyb20gJy4uLy4uL2lzc3VlL2NvbW1vbi9pc3N1ZS5qcyc7XG5pbXBvcnQgeyBhbm5vdGF0ZVNwZWNpYWxNYXJrZG93bkNvbnRlbnQgfSBmcm9tICcuLi9jb21tb24vYW5ub3RhdGlvbnMuanMnO1xuaW1wb3J0IHsgY2hlY2tNb2RlT3B0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudE1ldGFkYXRhIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LCBJQ2hhdFRleHRFZGl0R3JvdXAgfSBmcm9tICcuLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IGNoYXRTdWJjb21tYW5kTGVhZGVyIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLCBDaGF0QWdlbnRWb3RlRG93blJlYXNvbiwgQ2hhdEVycm9yTGV2ZWwsIElDaGF0Q29uZmlybWF0aW9uLCBJQ2hhdENvbnRlbnRSZWZlcmVuY2UsIElDaGF0Rm9sbG93dXAsIElDaGF0TWFya2Rvd25Db250ZW50LCBJQ2hhdFNlcnZpY2UsIElDaGF0VGFzaywgSUNoYXRUb29sSW52b2NhdGlvbiwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsIElDaGF0VHJlZURhdGEsIElDaGF0VW5kb1N0b3AgfSBmcm9tICcuLi9jb21tb24vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRDb2RlQ2l0YXRpb25zLCBJQ2hhdFJlZmVyZW5jZXMsIElDaGF0UmVuZGVyZXJDb250ZW50LCBJQ2hhdFJlcXVlc3RWaWV3TW9kZWwsIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwsIElDaGF0V29ya2luZ1Byb2dyZXNzLCBpc1JlcXVlc3RWTSwgaXNSZXNwb25zZVZNIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgZ2V0TldvcmRzIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRXb3JkQ291bnRlci5qcyc7XG5pbXBvcnQgeyBDb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24gfSBmcm9tICcuLi9jb21tb24vY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IENoYXRNb2RlIH0gZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNYXJrVW5oZWxwZnVsQWN0aW9uSWQgfSBmcm9tICcuL2FjdGlvbnMvY2hhdFRpdGxlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUl0ZW0sIElDaGF0Q29kZUJsb2NrSW5mbywgSUNoYXRGaWxlVHJlZUluZm8sIElDaGF0TGlzdEl0ZW1SZW5kZXJlck9wdGlvbnMsIElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4vY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRIb3ZlciwgZ2V0Q2hhdEFnZW50SG92ZXJPcHRpb25zIH0gZnJvbSAnLi9jaGF0QWdlbnRIb3Zlci5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRDb21tYW5kQ29udGVudFBhcnQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdEFnZW50Q29tbWFuZENvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRBdHRhY2htZW50c0NvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRBdHRhY2htZW50c0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRDb2RlQ2l0YXRpb25Db250ZW50UGFydCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29kZUNpdGF0aW9uQ29udGVudFBhcnQuanMnO1xuaW1wb3J0IHsgQ2hhdENvbW1hbmRCdXR0b25Db250ZW50UGFydCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29tbWFuZENvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRDb25maXJtYXRpb25Db250ZW50UGFydCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0Q29uZmlybWF0aW9uQ29udGVudFBhcnQuanMnO1xuaW1wb3J0IHsgSUNoYXRDb250ZW50UGFydCwgSUNoYXRDb250ZW50UGFydFJlbmRlckNvbnRleHQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdENvbnRlbnRQYXJ0cy5qcyc7XG5pbXBvcnQgeyBDaGF0TWFya2Rvd25Db250ZW50UGFydCwgRWRpdG9yUG9vbCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0TWFya2Rvd25Db250ZW50UGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0UHJvZ3Jlc3NDb250ZW50UGFydCwgQ2hhdFdvcmtpbmdQcm9ncmVzc0NvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRQcm9ncmVzc0NvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRRdW90YUV4Y2VlZGVkUGFydCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0UXVvdGFFeGNlZWRlZFBhcnQuanMnO1xuaW1wb3J0IHsgQ2hhdENvbGxhcHNpYmxlTGlzdENvbnRlbnRQYXJ0LCBDaGF0VXNlZFJlZmVyZW5jZXNMaXN0Q29udGVudFBhcnQsIENvbGxhcHNpYmxlTGlzdFBvb2wgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdFJlZmVyZW5jZXNDb250ZW50UGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0VGFza0NvbnRlbnRQYXJ0IH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRUYXNrQ29udGVudFBhcnQuanMnO1xuaW1wb3J0IHsgQ2hhdFRleHRFZGl0Q29udGVudFBhcnQsIERpZmZFZGl0b3JQb29sIH0gZnJvbSAnLi9jaGF0Q29udGVudFBhcnRzL2NoYXRUZXh0RWRpdENvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRUb29sSW52b2NhdGlvblBhcnQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdFRvb2xJbnZvY2F0aW9uUGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUNvbnRlbnRQYXJ0LCBUcmVlUG9vbCB9IGZyb20gJy4vY2hhdENvbnRlbnRQYXJ0cy9jaGF0VHJlZUNvbnRlbnRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRXYXJuaW5nQ29udGVudFBhcnQgfSBmcm9tICcuL2NoYXRDb250ZW50UGFydHMvY2hhdFdhcm5pbmdDb250ZW50UGFydC5qcyc7XG5pbXBvcnQgeyBDaGF0TWFya2Rvd25EZWNvcmF0aW9uc1JlbmRlcmVyIH0gZnJvbSAnLi9jaGF0TWFya2Rvd25EZWNvcmF0aW9uc1JlbmRlcmVyLmpzJztcbmltcG9ydCB7IENoYXRNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnLi9jaGF0TWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDaGF0RWRpdG9yT3B0aW9ucyB9IGZyb20gJy4vY2hhdE9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhdENvZGVCbG9ja0NvbnRlbnRQcm92aWRlciwgQ29kZUJsb2NrUGFydCB9IGZyb20gJy4vY29kZUJsb2NrUGFydC5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuaW50ZXJmYWNlIElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSB7XG5cdGN1cnJlbnRFbGVtZW50PzogQ2hhdFRyZWVJdGVtO1xuXHRyZW5kZXJlZFBhcnRzPzogSUNoYXRDb250ZW50UGFydFtdO1xuXHRyZWFkb25seSByb3dDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSB0aXRsZVRvb2xiYXI/OiBNZW51V29ya2JlbmNoVG9vbEJhcjtcblx0cmVhZG9ubHkgZm9vdGVyVG9vbGJhcjogTWVudVdvcmtiZW5jaFRvb2xCYXI7XG5cdHJlYWRvbmx5IGF2YXRhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHVzZXJuYW1lOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgZGV0YWlsOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgdmFsdWU6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRyZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRyZWFkb25seSB0ZW1wbGF0ZURpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZTtcblx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IGFnZW50SG92ZXI6IENoYXRBZ2VudEhvdmVyO1xufVxuXG5pbnRlcmZhY2UgSUl0ZW1IZWlnaHRDaGFuZ2VQYXJhbXMge1xuXHRlbGVtZW50OiBDaGF0VHJlZUl0ZW07XG5cdGhlaWdodDogbnVtYmVyO1xufVxuXG5jb25zdCBmb3JjZVZlcmJvc2VMYXlvdXRUcmFjaW5nID0gZmFsc2Vcblx0Ly8gfHwgQm9vbGVhbihcIlRSVUVcIikgLy8gY2F1c2VzIGEgbGludGVyIHdhcm5pbmcgc28gdGhhdCBpdCBjYW5ub3QgYmUgcHVzaGVkXG5cdDtcblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUge1xuXHRjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRnZXRMaXN0TGVuZ3RoKCk6IG51bWJlcjtcblx0Y3VycmVudENoYXRNb2RlKCk6IENoYXRNb2RlO1xuXG5cdHJlYWRvbmx5IG9uRGlkU2Nyb2xsPzogRXZlbnQ8dm9pZD47XG59XG5cbmNvbnN0IG1vc3RSZWNlbnRSZXNwb25zZUNsYXNzTmFtZSA9ICdjaGF0LW1vc3QtcmVjZW50LXJlc3BvbnNlJztcblxuZXhwb3J0IGNsYXNzIENoYXRMaXN0SXRlbVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8Q2hhdFRyZWVJdGVtLCBGdXp6eVNjb3JlLCBJQ2hhdExpc3RJdGVtVGVtcGxhdGU+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2l0ZW0nO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29kZUJsb2Nrc0J5UmVzcG9uc2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBJQ2hhdENvZGVCbG9ja0luZm9bXT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBjb2RlQmxvY2tzQnlFZGl0b3JVcmkgPSBuZXcgUmVzb3VyY2VNYXA8SUNoYXRDb2RlQmxvY2tJbmZvPigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZmlsZVRyZWVzQnlSZXNwb25zZUlkID0gbmV3IE1hcDxzdHJpbmcsIElDaGF0RmlsZVRyZWVJbmZvW10+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZm9jdXNlZEZpbGVUcmVlc0J5UmVzcG9uc2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcjtcblx0cHJpdmF0ZSByZWFkb25seSBtYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXI6IENoYXRNYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXI7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENsaWNrRm9sbG93dXAgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ2hhdEZvbGxvd3VwPigpKTtcblx0cmVhZG9ubHkgb25EaWRDbGlja0ZvbGxvd3VwOiBFdmVudDxJQ2hhdEZvbGxvd3VwPiA9IHRoaXMuX29uRGlkQ2xpY2tGb2xsb3d1cC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENsaWNrUmVydW5XaXRoQWdlbnRPckNvbW1hbmREZXRlY3Rpb24gPSBuZXcgRW1pdHRlcjx7IHNlc3Npb25JZDogc3RyaW5nOyByZXF1ZXN0SWQ6IHN0cmluZyB9PigpO1xuXHRyZWFkb25seSBvbkRpZENsaWNrUmVydW5XaXRoQWdlbnRPckNvbW1hbmREZXRlY3Rpb246IEV2ZW50PHsgc2Vzc2lvbklkOiBzdHJpbmc7IHJlcXVlc3RJZDogc3RyaW5nIH0+ID0gdGhpcy5fb25EaWRDbGlja1JlcnVuV2l0aEFnZW50T3JDb21tYW5kRGV0ZWN0aW9uLmV2ZW50O1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VJdGVtSGVpZ2h0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUl0ZW1IZWlnaHRDaGFuZ2VQYXJhbXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUl0ZW1IZWlnaHQ6IEV2ZW50PElJdGVtSGVpZ2h0Q2hhbmdlUGFyYW1zPiA9IHRoaXMuX29uRGlkQ2hhbmdlSXRlbUhlaWdodC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JQb29sOiBFZGl0b3JQb29sO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b29sRWRpdG9yUG9vbDogRWRpdG9yUG9vbDtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlmZkVkaXRvclBvb2w6IERpZmZFZGl0b3JQb29sO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90cmVlUG9vbDogVHJlZVBvb2w7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRlbnRSZWZlcmVuY2VzTGlzdFBvb2w6IENvbGxhcHNpYmxlTGlzdFBvb2w7XG5cblx0cHJpdmF0ZSBfY3VycmVudExheW91dFdpZHRoOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9pc1Zpc2libGUgPSB0cnVlO1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZVZpc2liaWxpdHkgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblxuXHQvKipcblx0ICogVG9vbCBpbnZvY2F0aW9ucyBnZXQgdGhlaXIgb3duIHNvIHRoYXQgdGhlIENoYXRWaWV3TW9kZWwgZG9lc24ndCBvdmVyd3JpdGUgaXQuXG5cdCAqIFRPRE9Acm9ibG91cmVucyBzaG91bGRuJ3QgdXNlIHRoZSBDb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24gYXQgYWxsXG5cdCAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b29sSW52b2NhdGlvbkNvZGVCbG9ja0NvbGxlY3Rpb246IENvZGVCbG9ja01vZGVsQ29sbGVjdGlvbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRlZGl0b3JPcHRpb25zOiBDaGF0RWRpdG9yT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlcmVyT3B0aW9uczogSUNoYXRMaXN0SXRlbVJlbmRlcmVyT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlbGVnYXRlOiBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb2RlQmxvY2tNb2RlbENvbGxlY3Rpb246IENvZGVCbG9ja01vZGVsQ29sbGVjdGlvbixcblx0XHRvdmVyZmxvd1dpZGdldHNEb21Ob2RlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ1NlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRNYXJrZG93blJlbmRlcmVyLCB1bmRlZmluZWQpO1xuXHRcdHRoaXMubWFya2Rvd25EZWNvcmF0aW9uc1JlbmRlcmVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0TWFya2Rvd25EZWNvcmF0aW9uc1JlbmRlcmVyKTtcblx0XHR0aGlzLl9lZGl0b3JQb29sID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JQb29sLCBlZGl0b3JPcHRpb25zLCBkZWxlZ2F0ZSwgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSkpO1xuXHRcdHRoaXMuX3Rvb2xFZGl0b3JQb29sID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JQb29sLCBlZGl0b3JPcHRpb25zLCBkZWxlZ2F0ZSwgb3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSkpO1xuXHRcdHRoaXMuX2RpZmZFZGl0b3JQb29sID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9yUG9vbCwgZWRpdG9yT3B0aW9ucywgZGVsZWdhdGUsIG92ZXJmbG93V2lkZ2V0c0RvbU5vZGUpKTtcblx0XHR0aGlzLl90cmVlUG9vbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVHJlZVBvb2wsIHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudCkpO1xuXHRcdHRoaXMuX2NvbnRlbnRSZWZlcmVuY2VzTGlzdFBvb2wgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbGxhcHNpYmxlTGlzdFBvb2wsIHRoaXMuX29uRGlkQ2hhbmdlVmlzaWJpbGl0eS5ldmVudCwgdW5kZWZpbmVkKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRDb2RlQmxvY2tDb250ZW50UHJvdmlkZXIpKTtcblx0XHR0aGlzLl90b29sSW52b2NhdGlvbkNvZGVCbG9ja0NvbGxlY3Rpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVCbG9ja01vZGVsQ29sbGVjdGlvbiwgJ3Rvb2xzJykpO1xuXHR9XG5cblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gQ2hhdExpc3RJdGVtUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRlZGl0b3JzSW5Vc2UoKTogSXRlcmFibGU8Q29kZUJsb2NrUGFydD4ge1xuXHRcdHJldHVybiBJdGVyYWJsZS5jb25jYXQodGhpcy5fZWRpdG9yUG9vbC5pblVzZSgpLCB0aGlzLl90b29sRWRpdG9yUG9vbC5pblVzZSgpKTtcblx0fVxuXG5cdHByaXZhdGUgdHJhY2VMYXlvdXQobWV0aG9kOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuXHRcdGlmIChmb3JjZVZlcmJvc2VMYXlvdXRUcmFjaW5nKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgQ2hhdExpc3RJdGVtUmVuZGVyZXIjJHttZXRob2R9OiAke21lc3NhZ2V9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgQ2hhdExpc3RJdGVtUmVuZGVyZXIjJHttZXRob2R9OiAke21lc3NhZ2V9YCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIENvbXB1dGUgYSByYXRlIHRvIHJlbmRlciBhdCBpbiB3b3Jkcy9zLlxuXHQgKi9cblx0cHJpdmF0ZSBnZXRQcm9ncmVzc2l2ZVJlbmRlclJhdGUoZWxlbWVudDogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCk6IG51bWJlciB7XG5cdFx0Y29uc3QgZW51bSBSYXRlIHtcblx0XHRcdE1pbiA9IDUsXG5cdFx0XHRNYXggPSA4MCxcblx0XHR9XG5cblx0XHRpZiAoZWxlbWVudC5pc0NvbXBsZXRlIHx8IGVsZW1lbnQuaXNQYXVzZWQuZ2V0KCkpIHtcblx0XHRcdHJldHVybiBSYXRlLk1heDtcblx0XHR9XG5cblx0XHRpZiAoZWxlbWVudC5jb250ZW50VXBkYXRlVGltaW5ncyAmJiBlbGVtZW50LmNvbnRlbnRVcGRhdGVUaW1pbmdzLmltcGxpZWRXb3JkTG9hZFJhdGUpIHtcblx0XHRcdGNvbnN0IHJhdGUgPSBlbGVtZW50LmNvbnRlbnRVcGRhdGVUaW1pbmdzLmltcGxpZWRXb3JkTG9hZFJhdGU7XG5cdFx0XHRyZXR1cm4gY2xhbXAocmF0ZSwgUmF0ZS5NaW4sIFJhdGUuTWF4KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gODtcblx0fVxuXG5cdGdldENvZGVCbG9ja0luZm9zRm9yUmVzcG9uc2UocmVzcG9uc2U6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpOiBJQ2hhdENvZGVCbG9ja0luZm9bXSB7XG5cdFx0Y29uc3QgY29kZUJsb2NrcyA9IHRoaXMuY29kZUJsb2Nrc0J5UmVzcG9uc2VJZC5nZXQocmVzcG9uc2UuaWQpO1xuXHRcdHJldHVybiBjb2RlQmxvY2tzID8/IFtdO1xuXHR9XG5cblx0Z2V0Q29kZUJsb2NrSW5mb0ZvckVkaXRvcih1cmk6IFVSSSk6IElDaGF0Q29kZUJsb2NrSW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29kZUJsb2Nrc0J5RWRpdG9yVXJpLmdldCh1cmkpO1xuXHR9XG5cblx0Z2V0RmlsZVRyZWVJbmZvc0ZvclJlc3BvbnNlKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKTogSUNoYXRGaWxlVHJlZUluZm9bXSB7XG5cdFx0Y29uc3QgZmlsZVRyZWVzID0gdGhpcy5maWxlVHJlZXNCeVJlc3BvbnNlSWQuZ2V0KHJlc3BvbnNlLmlkKTtcblx0XHRyZXR1cm4gZmlsZVRyZWVzID8/IFtdO1xuXHR9XG5cblx0Z2V0TGFzdEZvY3VzZWRGaWxlVHJlZUZvclJlc3BvbnNlKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKTogSUNoYXRGaWxlVHJlZUluZm8gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGZpbGVUcmVlcyA9IHRoaXMuZmlsZVRyZWVzQnlSZXNwb25zZUlkLmdldChyZXNwb25zZS5pZCk7XG5cdFx0Y29uc3QgbGFzdEZvY3VzZWRGaWxlVHJlZUluZGV4ID0gdGhpcy5mb2N1c2VkRmlsZVRyZWVzQnlSZXNwb25zZUlkLmdldChyZXNwb25zZS5pZCk7XG5cdFx0aWYgKGZpbGVUcmVlcz8ubGVuZ3RoICYmIGxhc3RGb2N1c2VkRmlsZVRyZWVJbmRleCAhPT0gdW5kZWZpbmVkICYmIGxhc3RGb2N1c2VkRmlsZVRyZWVJbmRleCA8IGZpbGVUcmVlcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBmaWxlVHJlZXNbbGFzdEZvY3VzZWRGaWxlVHJlZUluZGV4XTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IHZpc2libGU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmlsaXR5LmZpcmUodmlzaWJsZSk7XG5cdH1cblxuXHRsYXlvdXQod2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IG5ld1dpZHRoID0gd2lkdGggLSA0MDsgLy8gcGFkZGluZ1xuXHRcdGlmIChuZXdXaWR0aCAhPT0gdGhpcy5fY3VycmVudExheW91dFdpZHRoKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50TGF5b3V0V2lkdGggPSBuZXdXaWR0aDtcblx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMuX2VkaXRvclBvb2wuaW5Vc2UoKSkge1xuXHRcdFx0XHRlZGl0b3IubGF5b3V0KHRoaXMuX2N1cnJlbnRMYXlvdXRXaWR0aCk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IHRvb2xFZGl0b3Igb2YgdGhpcy5fdG9vbEVkaXRvclBvb2wuaW5Vc2UoKSkge1xuXHRcdFx0XHR0b29sRWRpdG9yLmxheW91dCh0aGlzLl9jdXJyZW50TGF5b3V0V2lkdGgpO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBkaWZmRWRpdG9yIG9mIHRoaXMuX2RpZmZFZGl0b3JQb29sLmluVXNlKCkpIHtcblx0XHRcdFx0ZGlmZkVkaXRvci5sYXlvdXQodGhpcy5fY3VycmVudExheW91dFdpZHRoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlIHtcblx0XHRjb25zdCB0ZW1wbGF0ZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHJvd0NvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuaW50ZXJhY3RpdmUtaXRlbS1jb250YWluZXInKSk7XG5cdFx0aWYgKHRoaXMucmVuZGVyZXJPcHRpb25zLnJlbmRlclN0eWxlID09PSAnY29tcGFjdCcpIHtcblx0XHRcdHJvd0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdpbnRlcmFjdGl2ZS1pdGVtLWNvbXBhY3QnKTtcblx0XHR9XG5cblx0XHRsZXQgaGVhZGVyUGFyZW50ID0gcm93Q29udGFpbmVyO1xuXHRcdGxldCB2YWx1ZVBhcmVudCA9IHJvd0NvbnRhaW5lcjtcblx0XHRsZXQgZGV0YWlsQ29udGFpbmVyUGFyZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0XHRsZXQgdG9vbGJhclBhcmVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAodGhpcy5yZW5kZXJlck9wdGlvbnMucmVuZGVyU3R5bGUgPT09ICdtaW5pbWFsJykge1xuXHRcdFx0cm93Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ludGVyYWN0aXZlLWl0ZW0tY29tcGFjdCcpO1xuXHRcdFx0cm93Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21pbmltYWwnKTtcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdFx0XHQvLyAgaWNvbiB8IGRldGFpbHNcblx0XHRcdC8vICAgICAgIHwgcmVmZXJlbmNlc1xuXHRcdFx0Ly8gICAgICAgfCB2YWx1ZVxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0XHRcdGNvbnN0IGxoc0NvbnRhaW5lciA9IGRvbS5hcHBlbmQocm93Q29udGFpbmVyLCAkKCcuY29sdW1uLmxlZnQnKSk7XG5cdFx0XHRjb25zdCByaHNDb250YWluZXIgPSBkb20uYXBwZW5kKHJvd0NvbnRhaW5lciwgJCgnLmNvbHVtbi5yaWdodCcpKTtcblxuXHRcdFx0aGVhZGVyUGFyZW50ID0gbGhzQ29udGFpbmVyO1xuXHRcdFx0ZGV0YWlsQ29udGFpbmVyUGFyZW50ID0gcmhzQ29udGFpbmVyO1xuXHRcdFx0dmFsdWVQYXJlbnQgPSByaHNDb250YWluZXI7XG5cdFx0XHR0b29sYmFyUGFyZW50ID0gZG9tLmFwcGVuZChyb3dDb250YWluZXIsICQoJy5oZWFkZXInKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGVhZGVyID0gZG9tLmFwcGVuZChoZWFkZXJQYXJlbnQsICQoJy5oZWFkZXInKSk7XG5cdFx0Y29uc3QgdXNlciA9IGRvbS5hcHBlbmQoaGVhZGVyLCAkKCcudXNlcicpKTtcblx0XHRjb25zdCBhdmF0YXJDb250YWluZXIgPSBkb20uYXBwZW5kKHVzZXIsICQoJy5hdmF0YXItY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IHVzZXJuYW1lID0gZG9tLmFwcGVuZCh1c2VyLCAkKCdoMy51c2VybmFtZScpKTtcblx0XHR1c2VybmFtZS50YWJJbmRleCA9IDA7XG5cdFx0Y29uc3QgZGV0YWlsQ29udGFpbmVyID0gZG9tLmFwcGVuZChkZXRhaWxDb250YWluZXJQYXJlbnQgPz8gdXNlciwgJCgnc3Bhbi5kZXRhaWwtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGRldGFpbCA9IGRvbS5hcHBlbmQoZGV0YWlsQ29udGFpbmVyLCAkKCdzcGFuLmRldGFpbCcpKTtcblx0XHRkb20uYXBwZW5kKGRldGFpbENvbnRhaW5lciwgJCgnc3Bhbi5jaGF0LWFuaW1hdGVkLWVsbGlwc2lzJykpO1xuXHRcdGNvbnN0IHZhbHVlID0gZG9tLmFwcGVuZCh2YWx1ZVBhcmVudCwgJCgnLnZhbHVlJykpO1xuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQocm93Q29udGFpbmVyKSk7XG5cdFx0Y29uc3Qgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZV0pKSk7XG5cblx0XHRsZXQgdGl0bGVUb29sYmFyOiBNZW51V29ya2JlbmNoVG9vbEJhciB8IHVuZGVmaW5lZDtcblx0XHRpZiAodGhpcy5yZW5kZXJlck9wdGlvbnMubm9IZWFkZXIpIHtcblx0XHRcdGhlYWRlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGl0bGVUb29sYmFyID0gdGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIHRvb2xiYXJQYXJlbnQgPz8gaGVhZGVyLCBNZW51SWQuQ2hhdE1lc3NhZ2VUaXRsZSwge1xuXHRcdFx0XHRtZW51T3B0aW9uczoge1xuXHRcdFx0XHRcdHNob3VsZEZvcndhcmRBcmdzOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdFx0c2hvdWxkSW5saW5lU3VibWVudTogc3VibWVudSA9PiBzdWJtZW51LmFjdGlvbnMubGVuZ3RoIDw9IDFcblx0XHRcdFx0fSxcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRjb25zdCBmb290ZXJUb29sYmFyQ29udGFpbmVyID0gZG9tLmFwcGVuZChyb3dDb250YWluZXIsICQoJy5jaGF0LWZvb3Rlci10b29sYmFyJykpO1xuXHRcdGNvbnN0IGZvb3RlclRvb2xiYXIgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZChzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoVG9vbEJhciwgZm9vdGVyVG9vbGJhckNvbnRhaW5lciwgTWVudUlkLkNoYXRNZXNzYWdlRm9vdGVyLCB7XG5cdFx0XHRldmVudERlYm91bmNlRGVsYXk6IDAsXG5cdFx0XHRtZW51T3B0aW9uczogeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSwgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9LFxuXHRcdFx0dG9vbGJhck9wdGlvbnM6IHsgc2hvdWxkSW5saW5lU3VibWVudTogc3VibWVudSA9PiBzdWJtZW51LmFjdGlvbnMubGVuZ3RoIDw9IDEgfSxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uICYmIGFjdGlvbi5pdGVtLmlkID09PSBNYXJrVW5oZWxwZnVsQWN0aW9uSWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFZvdGVEb3duQnV0dG9uLCBhY3Rpb24sIG9wdGlvbnMgYXMgSU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtT3B0aW9ucyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLCBhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGFnZW50SG92ZXIgPSB0ZW1wbGF0ZURpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRBZ2VudEhvdmVyKSk7XG5cdFx0Y29uc3QgaG92ZXJDb250ZW50ID0gKCkgPT4ge1xuXHRcdFx0aWYgKGlzUmVzcG9uc2VWTSh0ZW1wbGF0ZS5jdXJyZW50RWxlbWVudCkgJiYgdGVtcGxhdGUuY3VycmVudEVsZW1lbnQuYWdlbnQgJiYgIXRlbXBsYXRlLmN1cnJlbnRFbGVtZW50LmFnZW50LmlzRGVmYXVsdCkge1xuXHRcdFx0XHRhZ2VudEhvdmVyLnNldEFnZW50KHRlbXBsYXRlLmN1cnJlbnRFbGVtZW50LmFnZW50LmlkKTtcblx0XHRcdFx0cmV0dXJuIGFnZW50SG92ZXIuZG9tTm9kZTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9O1xuXHRcdGNvbnN0IGhvdmVyT3B0aW9ucyA9IGdldENoYXRBZ2VudEhvdmVyT3B0aW9ucygoKSA9PiBpc1Jlc3BvbnNlVk0odGVtcGxhdGUuY3VycmVudEVsZW1lbnQpID8gdGVtcGxhdGUuY3VycmVudEVsZW1lbnQuYWdlbnQgOiB1bmRlZmluZWQsIHRoaXMuY29tbWFuZFNlcnZpY2UpO1xuXHRcdHRlbXBsYXRlRGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIHVzZXIsIGhvdmVyQ29udGVudCwgaG92ZXJPcHRpb25zKSk7XG5cdFx0dGVtcGxhdGVEaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih1c2VyLCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldi5lcXVhbHMoS2V5Q29kZS5TcGFjZSkgfHwgZXYuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBob3ZlckNvbnRlbnQoKTtcblx0XHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0XHR0aGlzLmhvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHsgY29udGVudCwgdGFyZ2V0OiB1c2VyLCB0cmFwRm9jdXM6IHRydWUsIGFjdGlvbnM6IGhvdmVyT3B0aW9ucy5hY3Rpb25zIH0sIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGV2LmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0dGhpcy5ob3ZlclNlcnZpY2UuaGlkZUhvdmVyKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGNvbnN0IHRlbXBsYXRlOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUgPSB7IGF2YXRhckNvbnRhaW5lciwgdXNlcm5hbWUsIGRldGFpbCwgdmFsdWUsIHJvd0NvbnRhaW5lciwgZWxlbWVudERpc3Bvc2FibGVzLCB0ZW1wbGF0ZURpc3Bvc2FibGVzLCBjb250ZXh0S2V5U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2U6IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLCBhZ2VudEhvdmVyLCB0aXRsZVRvb2xiYXIsIGZvb3RlclRvb2xiYXIgfTtcblx0XHRyZXR1cm4gdGVtcGxhdGU7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxDaGF0VHJlZUl0ZW0sIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyQ2hhdFRyZWVJdGVtKG5vZGUuZWxlbWVudCwgaW5kZXgsIHRlbXBsYXRlRGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyUmVuZGVyZWRQYXJ0cyh0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdGlmICh0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cykge1xuXHRcdFx0ZGlzcG9zZShjb2FsZXNjZSh0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cykpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLnJlbmRlcmVkUGFydHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRkb20uY2xlYXJOb2RlKHRlbXBsYXRlRGF0YS52YWx1ZSk7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyQ2hhdFRyZWVJdGVtKGVsZW1lbnQ6IENoYXRUcmVlSXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHRpZiAodGVtcGxhdGVEYXRhLmN1cnJlbnRFbGVtZW50ICYmIHRlbXBsYXRlRGF0YS5jdXJyZW50RWxlbWVudC5pZCAhPT0gZWxlbWVudC5pZCkge1xuXHRcdFx0dGhpcy50cmFjZUxheW91dCgncmVuZGVyQ2hhdFRyZWVJdGVtJywgYFJlbmRlcmluZyBhIGRpZmZlcmVudCBlbGVtZW50IGludG8gdGhlIHRlbXBsYXRlLCBpbmRleD0ke2luZGV4fWApO1xuXHRcdFx0dGhpcy5jbGVhclJlbmRlcmVkUGFydHModGVtcGxhdGVEYXRhKTtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZURhdGEuY3VycmVudEVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdGNvbnN0IGtpbmQgPSBpc1JlcXVlc3RWTShlbGVtZW50KSA/ICdyZXF1ZXN0JyA6XG5cdFx0XHRpc1Jlc3BvbnNlVk0oZWxlbWVudCkgPyAncmVzcG9uc2UnIDpcblx0XHRcdFx0J3dlbGNvbWUnO1xuXHRcdHRoaXMudHJhY2VMYXlvdXQoJ3JlbmRlckVsZW1lbnQnLCBgJHtraW5kfSwgaW5kZXg9JHtpbmRleH1gKTtcblxuXHRcdENoYXRDb250ZXh0S2V5cy5pc1Jlc3BvbnNlLmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldChpc1Jlc3BvbnNlVk0oZWxlbWVudCkpO1xuXHRcdENoYXRDb250ZXh0S2V5cy5pdGVtSWQuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KGVsZW1lbnQuaWQpO1xuXHRcdENoYXRDb250ZXh0S2V5cy5pc1JlcXVlc3QuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KGlzUmVxdWVzdFZNKGVsZW1lbnQpKTtcblx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VEZXRlY3RlZEFnZW50Q29tbWFuZC5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoaXNSZXNwb25zZVZNKGVsZW1lbnQpICYmIGVsZW1lbnQuYWdlbnRPclNsYXNoQ29tbWFuZERldGVjdGVkKTtcblx0XHRpZiAoaXNSZXNwb25zZVZNKGVsZW1lbnQpKSB7XG5cdFx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VTdXBwb3J0c0lzc3VlUmVwb3J0aW5nLmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldCghIWVsZW1lbnQuYWdlbnQ/Lm1ldGFkYXRhLnN1cHBvcnRJc3N1ZVJlcG9ydGluZyk7XG5cdFx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VWb3RlLmJpbmRUbyh0ZW1wbGF0ZURhdGEuY29udGV4dEtleVNlcnZpY2UpLnNldChlbGVtZW50LnZvdGUgPT09IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24uVXAgPyAndXAnIDogZWxlbWVudC52b3RlID09PSBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLkRvd24gPyAnZG93bicgOiAnJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdENoYXRDb250ZXh0S2V5cy5yZXNwb25zZVZvdGUuYmluZFRvKHRlbXBsYXRlRGF0YS5jb250ZXh0S2V5U2VydmljZSkuc2V0KCcnKTtcblx0XHR9XG5cblx0XHRpZiAodGVtcGxhdGVEYXRhLnRpdGxlVG9vbGJhcikge1xuXHRcdFx0dGVtcGxhdGVEYXRhLnRpdGxlVG9vbGJhci5jb250ZXh0ID0gZWxlbWVudDtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmZvb3RlclRvb2xiYXIuY29udGV4dCA9IGVsZW1lbnQ7XG5cblx0XHRDaGF0Q29udGV4dEtleXMucmVzcG9uc2VIYXNFcnJvci5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoaXNSZXNwb25zZVZNKGVsZW1lbnQpICYmICEhZWxlbWVudC5lcnJvckRldGFpbHMpO1xuXHRcdGNvbnN0IGlzRmlsdGVyZWQgPSAhIShpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNGaWx0ZXJlZCk7XG5cdFx0Q2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSXNGaWx0ZXJlZC5iaW5kVG8odGVtcGxhdGVEYXRhLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoaXNGaWx0ZXJlZCk7XG5cblx0XHRjb25zdCBsb2NhdGlvbiA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlTZXNzaW9uSWQoZWxlbWVudC5zZXNzaW9uSWQpPy5sb2NhdGlvbjtcblx0XHR0ZW1wbGF0ZURhdGEucm93Q29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2VkaXRpbmctc2Vzc2lvbicsIGxvY2F0aW9uICYmIHRoaXMuY2hhdFNlcnZpY2UuaXNFZGl0aW5nTG9jYXRpb24obG9jYXRpb24pKTtcblx0XHR0ZW1wbGF0ZURhdGEucm93Q29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2ludGVyYWN0aXZlLXJlcXVlc3QnLCBpc1JlcXVlc3RWTShlbGVtZW50KSk7XG5cdFx0dGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdpbnRlcmFjdGl2ZS1yZXNwb25zZScsIGlzUmVzcG9uc2VWTShlbGVtZW50KSk7XG5cdFx0Y29uc3QgcHJvZ3Jlc3NNZXNzYWdlQXRCb3R0b21PZlJlc3BvbnNlID0gY2hlY2tNb2RlT3B0aW9uKHRoaXMuZGVsZWdhdGUuY3VycmVudENoYXRNb2RlKCksIHRoaXMucmVuZGVyZXJPcHRpb25zLnByb2dyZXNzTWVzc2FnZUF0Qm90dG9tT2ZSZXNwb25zZSk7XG5cdFx0dGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdzaG93LWRldGFpbC1wcm9ncmVzcycsIGlzUmVzcG9uc2VWTShlbGVtZW50KSAmJiAhZWxlbWVudC5pc0NvbXBsZXRlICYmICFlbGVtZW50LnByb2dyZXNzTWVzc2FnZXMubGVuZ3RoICYmICFlbGVtZW50Lm1vZGVsLmlzUGF1c2VkLmdldCgpICYmICFwcm9ncmVzc01lc3NhZ2VBdEJvdHRvbU9mUmVzcG9uc2UpO1xuXHRcdHRlbXBsYXRlRGF0YS51c2VybmFtZS50ZXh0Q29udGVudCA9IGVsZW1lbnQudXNlcm5hbWU7XG5cdFx0aWYgKCF0aGlzLnJlbmRlcmVyT3B0aW9ucy5ub0hlYWRlcikge1xuXHRcdFx0dGhpcy5yZW5kZXJBdmF0YXIoZWxlbWVudCwgdGVtcGxhdGVEYXRhKTtcblx0XHR9XG5cblx0XHRkb20uY2xlYXJOb2RlKHRlbXBsYXRlRGF0YS5kZXRhaWwpO1xuXHRcdGlmIChpc1Jlc3BvbnNlVk0oZWxlbWVudCkpIHtcblx0XHRcdHRoaXMucmVuZGVyRGV0YWlsKGVsZW1lbnQsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKG1vc3RSZWNlbnRSZXNwb25zZUNsYXNzTmFtZSwgaW5kZXggPT09IHRoaXMuZGVsZWdhdGUuZ2V0TGlzdExlbmd0aCgpIC0gMSk7XG5cblx0XHRpZiAoaXNSZXF1ZXN0Vk0oZWxlbWVudCkgJiYgZWxlbWVudC5jb25maXJtYXRpb24pIHtcblx0XHRcdHRoaXMucmVuZGVyQ29uZmlybWF0aW9uQWN0aW9uKGVsZW1lbnQsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fVxuXG5cdFx0Ly8gRG8gYSBwcm9ncmVzc2l2ZSByZW5kZXIgaWZcblx0XHQvLyAtIFRoaXMgdGhlIGxhc3QgcmVzcG9uc2UgaW4gdGhlIGxpc3Rcblx0XHQvLyAtIEFuZCBpdCBoYXMgc29tZSBjb250ZW50XG5cdFx0Ly8gLSBBbmQgdGhlIHJlc3BvbnNlIGlzIG5vdCBjb21wbGV0ZVxuXHRcdC8vICAgLSBPciwgd2UgcHJldmlvdXNseSBzdGFydGVkIGEgcHJvZ3Jlc3NpdmUgcmVuZGVyaW5nIG9mIHRoaXMgZWxlbWVudCAoaWYgdGhlIGVsZW1lbnQgaXMgY29tcGxldGUsIHdlIHdpbGwgZmluaXNoIHByb2dyZXNzaXZlIHJlbmRlcmluZyB3aXRoIGEgdmVyeSBmYXN0IHJhdGUpXG5cdFx0aWYgKGlzUmVzcG9uc2VWTShlbGVtZW50KSAmJiBpbmRleCA9PT0gdGhpcy5kZWxlZ2F0ZS5nZXRMaXN0TGVuZ3RoKCkgLSAxICYmICghZWxlbWVudC5pc0NvbXBsZXRlIHx8IGVsZW1lbnQucmVuZGVyRGF0YSkpIHtcblx0XHRcdHRoaXMudHJhY2VMYXlvdXQoJ3JlbmRlckVsZW1lbnQnLCBgc3RhcnQgcHJvZ3Jlc3NpdmUgcmVuZGVyLCBpbmRleD0ke2luZGV4fWApO1xuXG5cdFx0XHRjb25zdCB0aW1lciA9IHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKG5ldyBkb20uV2luZG93SW50ZXJ2YWxUaW1lcigpKTtcblx0XHRcdGNvbnN0IHJ1blByb2dyZXNzaXZlUmVuZGVyID0gKGluaXRpYWw/OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZG9OZXh0UHJvZ3Jlc3NpdmVSZW5kZXIoZWxlbWVudCwgaW5kZXgsIHRlbXBsYXRlRGF0YSwgISFpbml0aWFsKSkge1xuXHRcdFx0XHRcdFx0dGltZXIuY2FuY2VsKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHQvLyBLaWxsIHRoZSB0aW1lciBpZiBhbnl0aGluZyB3ZW50IHdyb25nLCBhdm9pZCBnZXR0aW5nIHN0dWNrIGluIGEgbmFzdHkgcmVuZGVyaW5nIGxvb3AuXG5cdFx0XHRcdFx0dGltZXIuY2FuY2VsKCk7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0aW1lci5jYW5jZWxBbmRTZXQocnVuUHJvZ3Jlc3NpdmVSZW5kZXIsIDUwLCBkb20uZ2V0V2luZG93KHRlbXBsYXRlRGF0YS5yb3dDb250YWluZXIpKTtcblx0XHRcdHJ1blByb2dyZXNzaXZlUmVuZGVyKHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoaXNSZXNwb25zZVZNKGVsZW1lbnQpKSB7XG5cdFx0XHRcdHRoaXMuYmFzaWNSZW5kZXJFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0fSBlbHNlIGlmIChpc1JlcXVlc3RWTShlbGVtZW50KSkge1xuXHRcdFx0XHR0aGlzLmJhc2ljUmVuZGVyRWxlbWVudChlbGVtZW50LCBpbmRleCwgdGVtcGxhdGVEYXRhKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckRldGFpbChlbGVtZW50OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdHRoaXMuX3JlbmRlckRldGFpbChlbGVtZW50LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlckRldGFpbChlbGVtZW50OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXG5cdFx0ZG9tLmNsZWFyTm9kZSh0ZW1wbGF0ZURhdGEuZGV0YWlsKTtcblxuXHRcdGlmIChlbGVtZW50LmFnZW50T3JTbGFzaENvbW1hbmREZXRlY3RlZCkge1xuXHRcdFx0Y29uc3QgbXNnID0gZWxlbWVudC5zbGFzaENvbW1hbmQgPyBsb2NhbGl6ZSgndXNlZEFnZW50U2xhc2hDb21tYW5kJywgXCJ1c2VkIHswfSBbWyhyZXJ1biB3aXRob3V0KV1dXCIsIGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7ZWxlbWVudC5zbGFzaENvbW1hbmQubmFtZX1gKSA6IGxvY2FsaXplKCd1c2VkQWdlbnQnLCBcIltbKHJlcnVuIHdpdGhvdXQpXV1cIik7XG5cdFx0XHRkb20ucmVzZXQodGVtcGxhdGVEYXRhLmRldGFpbCwgcmVuZGVyRm9ybWF0dGVkVGV4dChtc2csIHtcblx0XHRcdFx0Y2xhc3NOYW1lOiAnYWdlbnRPclNsYXNoQ29tbWFuZERldGVjdGVkJyxcblx0XHRcdFx0aW5saW5lOiB0cnVlLFxuXHRcdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXM6IHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMsXG5cdFx0XHRcdFx0Y2FsbGJhY2s6IChjb250ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9vbkRpZENsaWNrUmVydW5XaXRoQWdlbnRPckNvbW1hbmREZXRlY3Rpb24uZmlyZShlbGVtZW50KTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHR9IGVsc2UgaWYgKHRoaXMucmVuZGVyZXJPcHRpb25zLnJlbmRlclN0eWxlICE9PSAnbWluaW1hbCcgJiYgIWVsZW1lbnQuaXNDb21wbGV0ZSAmJiAhY2hlY2tNb2RlT3B0aW9uKHRoaXMuZGVsZWdhdGUuY3VycmVudENoYXRNb2RlKCksIHRoaXMucmVuZGVyZXJPcHRpb25zLnByb2dyZXNzTWVzc2FnZUF0Qm90dG9tT2ZSZXNwb25zZSkpIHtcblx0XHRcdGlmIChlbGVtZW50Lm1vZGVsLmlzUGF1c2VkLmdldCgpKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5kZXRhaWwudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgncGF1c2VkJywgXCJQYXVzZWRcIik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZGV0YWlsLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ3dvcmtpbmcnLCBcIldvcmtpbmdcIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDb25maXJtYXRpb25BY3Rpb24oZWxlbWVudDogSUNoYXRSZXF1ZXN0Vmlld01vZGVsLCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSkge1xuXHRcdGRvbS5jbGVhck5vZGUodGVtcGxhdGVEYXRhLmRldGFpbCk7XG5cdFx0aWYgKGVsZW1lbnQuY29uZmlybWF0aW9uKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuZGV0YWlsLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2NoYXRDb25maXJtYXRpb25BY3Rpb24nLCAnc2VsZWN0ZWQgXCJ7MH1cIicsIGVsZW1lbnQuY29uZmlybWF0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckF2YXRhcihlbGVtZW50OiBDaGF0VHJlZUl0ZW0sIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgaWNvbiA9IGlzUmVzcG9uc2VWTShlbGVtZW50KSA/XG5cdFx0XHR0aGlzLmdldEFnZW50SWNvbihlbGVtZW50LmFnZW50Py5tZXRhZGF0YSkgOlxuXHRcdFx0KGVsZW1lbnQuYXZhdGFySWNvbiA/PyBDb2RpY29uLmFjY291bnQpO1xuXHRcdGlmIChpY29uIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRjb25zdCBhdmF0YXJJY29uID0gZG9tLiQ8SFRNTEltYWdlRWxlbWVudD4oJ2ltZy5pY29uJyk7XG5cdFx0XHRhdmF0YXJJY29uLnNyYyA9IEZpbGVBY2Nlc3MudXJpVG9Ccm93c2VyVXJpKGljb24pLnRvU3RyaW5nKHRydWUpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmF2YXRhckNvbnRhaW5lci5yZXBsYWNlQ2hpbGRyZW4oZG9tLiQoJy5hdmF0YXInLCB1bmRlZmluZWQsIGF2YXRhckljb24pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgYXZhdGFySWNvbiA9IGRvbS4kKFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGljb24pKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5hdmF0YXJDb250YWluZXIucmVwbGFjZUNoaWxkcmVuKGRvbS4kKCcuYXZhdGFyLmNvZGljb24tYXZhdGFyJywgdW5kZWZpbmVkLCBhdmF0YXJJY29uKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRBZ2VudEljb24oYWdlbnQ6IElDaGF0QWdlbnRNZXRhZGF0YSB8IHVuZGVmaW5lZCk6IFVSSSB8IFRoZW1lSWNvbiB7XG5cdFx0aWYgKGFnZW50Py50aGVtZUljb24pIHtcblx0XHRcdHJldHVybiBhZ2VudC50aGVtZUljb247XG5cdFx0fSBlbHNlIGlmIChhZ2VudD8uaWNvbkRhcmsgJiYgdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnR5cGUgPT09IENvbG9yU2NoZW1lLkRBUkspIHtcblx0XHRcdHJldHVybiBhZ2VudC5pY29uRGFyaztcblx0XHR9IGVsc2UgaWYgKGFnZW50Py5pY29uKSB7XG5cdFx0XHRyZXR1cm4gYWdlbnQuaWNvbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIENvZGljb24uY29waWxvdDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJhc2ljUmVuZGVyRWxlbWVudChlbGVtZW50OiBDaGF0VHJlZUl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlKSB7XG5cdFx0dGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjaGF0LXJlc3BvbnNlLWxvYWRpbmcnLCAoaXNSZXNwb25zZVZNKGVsZW1lbnQpICYmICFlbGVtZW50LmlzQ29tcGxldGUpKTtcblxuXHRcdGxldCB2YWx1ZTogSUNoYXRSZW5kZXJlckNvbnRlbnRbXSA9IFtdO1xuXHRcdGlmIChpc1JlcXVlc3RWTShlbGVtZW50KSAmJiAhZWxlbWVudC5jb25maXJtYXRpb24pIHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0gJ21lc3NhZ2UnIGluIGVsZW1lbnQubWVzc2FnZSA/XG5cdFx0XHRcdGVsZW1lbnQubWVzc2FnZS5tZXNzYWdlIDpcblx0XHRcdFx0dGhpcy5tYXJrZG93bkRlY29yYXRpb25zUmVuZGVyZXIuY29udmVydFBhcnNlZFJlcXVlc3RUb01hcmtkb3duKGVsZW1lbnQubWVzc2FnZSk7XG5cdFx0XHR2YWx1ZSA9IFt7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhtYXJrZG93biksIGtpbmQ6ICdtYXJrZG93bkNvbnRlbnQnIH1dO1xuXG5cdFx0XHRpZiAodGhpcy5yZW5kZXJlck9wdGlvbnMucmVuZGVyU3R5bGUgPT09ICdtaW5pbWFsJyAmJiAhZWxlbWVudC5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS52YWx1ZS5jbGFzc0xpc3QuYWRkKCdpbmxpbmUtcHJvZ3Jlc3MnKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRlbXBsYXRlRGF0YS52YWx1ZS5jbGFzc0xpc3QucmVtb3ZlKCdpbmxpbmUtcHJvZ3Jlc3MnKSkpO1xuXHRcdFx0XHR2YWx1ZS5wdXNoKHsgY29udGVudDogbmV3IE1hcmtkb3duU3RyaW5nKCc8c3Bhbj48L3NwYW4+JywgeyBzdXBwb3J0SHRtbDogdHJ1ZSB9KSwga2luZDogJ21hcmtkb3duQ29udGVudCcgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEudmFsdWUuY2xhc3NMaXN0LnJlbW92ZSgnaW5saW5lLXByb2dyZXNzJyk7XG5cdFx0XHR9XG5cblx0XHR9IGVsc2UgaWYgKGlzUmVzcG9uc2VWTShlbGVtZW50KSkge1xuXHRcdFx0aWYgKGVsZW1lbnQuY29udGVudFJlZmVyZW5jZXMubGVuZ3RoKSB7XG5cdFx0XHRcdHZhbHVlLnB1c2goeyBraW5kOiAncmVmZXJlbmNlcycsIHJlZmVyZW5jZXM6IGVsZW1lbnQuY29udGVudFJlZmVyZW5jZXMgfSk7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZS5wdXNoKC4uLmFubm90YXRlU3BlY2lhbE1hcmtkb3duQ29udGVudChlbGVtZW50LnJlc3BvbnNlLnZhbHVlKSk7XG5cdFx0XHRpZiAoZWxlbWVudC5jb2RlQ2l0YXRpb25zLmxlbmd0aCkge1xuXHRcdFx0XHR2YWx1ZS5wdXNoKHsga2luZDogJ2NvZGVDaXRhdGlvbnMnLCBjaXRhdGlvbnM6IGVsZW1lbnQuY29kZUNpdGF0aW9ucyB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRkb20uY2xlYXJOb2RlKHRlbXBsYXRlRGF0YS52YWx1ZSk7XG5cblx0XHRpZiAoaXNSZXNwb25zZVZNKGVsZW1lbnQpKSB7XG5cdFx0XHR0aGlzLnJlbmRlckRldGFpbChlbGVtZW50LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzRmlsdGVyZWQgPSAhIShpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNGaWx0ZXJlZCk7XG5cblx0XHRjb25zdCBwYXJ0czogSUNoYXRDb250ZW50UGFydFtdID0gW107XG5cdFx0aWYgKCFpc0ZpbHRlcmVkKSB7XG5cblx0XHRcdGxldCBpbmxpbmVTbGFzaENvbW1hbmRSZW5kZXJlZCA9IGZhbHNlO1xuXG5cdFx0XHR2YWx1ZS5mb3JFYWNoKChkYXRhLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCA9IHtcblx0XHRcdFx0XHRlbGVtZW50LFxuXHRcdFx0XHRcdGNvbnRlbnRJbmRleDogaW5kZXgsXG5cdFx0XHRcdFx0Y29udGVudDogdmFsdWUsXG5cdFx0XHRcdFx0cHJlY2VlZGluZ0NvbnRlbnRQYXJ0czogcGFydHMsXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IG5ld1BhcnQgPSB0aGlzLnJlbmRlckNoYXRDb250ZW50UGFydChkYXRhLCB0ZW1wbGF0ZURhdGEsIGNvbnRleHQpO1xuXHRcdFx0XHRpZiAobmV3UGFydCkge1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMucmVuZGVyZXJPcHRpb25zLnJlbmRlckRldGVjdGVkQ29tbWFuZHNXaXRoUmVxdWVzdFxuXHRcdFx0XHRcdFx0JiYgIWlubGluZVNsYXNoQ29tbWFuZFJlbmRlcmVkXG5cdFx0XHRcdFx0XHQmJiBpc1JlcXVlc3RWTShlbGVtZW50KSAmJiBlbGVtZW50LmFnZW50T3JTbGFzaENvbW1hbmREZXRlY3RlZCAmJiBlbGVtZW50LnNsYXNoQ29tbWFuZFxuXHRcdFx0XHRcdFx0JiYgZGF0YS5raW5kID09PSAnbWFya2Rvd25Db250ZW50JyAvLyBUT0RPIHRoaXMgaXMgZmlzaHkgYnV0IEkgZGlkbid0IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIHJlbmRlciBvbiB0aGUgc2FtZSBpbmxpbmUgYXMgdGhlIE1EIHJlcXVlc3QgcGFydFxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0aWYgKG5ld1BhcnQuZG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0XHRuZXdQYXJ0LmRvbU5vZGUuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtZmxleCc7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBjbWRQYXJ0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0QWdlbnRDb21tYW5kQ29udGVudFBhcnQsIGVsZW1lbnQuc2xhc2hDb21tYW5kLCAoKSA9PiB0aGlzLl9vbkRpZENsaWNrUmVydW5XaXRoQWdlbnRPckNvbW1hbmREZXRlY3Rpb24uZmlyZSh7IHNlc3Npb25JZDogZWxlbWVudC5zZXNzaW9uSWQsIHJlcXVlc3RJZDogZWxlbWVudC5pZCB9KSk7XG5cdFx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEudmFsdWUuYXBwZW5kQ2hpbGQoY21kUGFydC5kb21Ob2RlKTtcblx0XHRcdFx0XHRcdHBhcnRzLnB1c2goY21kUGFydCk7XG5cdFx0XHRcdFx0XHRpbmxpbmVTbGFzaENvbW1hbmRSZW5kZXJlZCA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKG5ld1BhcnQuZG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0dGVtcGxhdGVEYXRhLnZhbHVlLmFwcGVuZENoaWxkKG5ld1BhcnQuZG9tTm9kZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBhcnRzLnB1c2gobmV3UGFydCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cykge1xuXHRcdFx0ZGlzcG9zZSh0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cyk7XG5cdFx0fVxuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJlZFBhcnRzID0gcGFydHM7XG5cblx0XHRpZiAoIWlzRmlsdGVyZWQpIHtcblx0XHRcdGlmIChpc1JlcXVlc3RWTShlbGVtZW50KSAmJiBlbGVtZW50LnZhcmlhYmxlcy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgbmV3UGFydCA9IHRoaXMucmVuZGVyQXR0YWNobWVudHMoZWxlbWVudC52YXJpYWJsZXMsIGVsZW1lbnQuY29udGVudFJlZmVyZW5jZXMsIHRlbXBsYXRlRGF0YSk7XG5cdFx0XHRcdGlmIChuZXdQYXJ0KSB7XG5cdFx0XHRcdFx0aWYgKG5ld1BhcnQuZG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0Ly8gcCBoYXMgYSA6bGFzdC1jaGlsZCBydWxlIGZvciBtYXJnaW5cblx0XHRcdFx0XHRcdHRlbXBsYXRlRGF0YS52YWx1ZS5hcHBlbmRDaGlsZChuZXdQYXJ0LmRvbU5vZGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChuZXdQYXJ0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5lcnJvckRldGFpbHM/Lm1lc3NhZ2UpIHtcblx0XHRcdGlmIChlbGVtZW50LmVycm9yRGV0YWlscy5pc1F1b3RhRXhjZWVkZWQpIHtcblx0XHRcdFx0Y29uc3QgcmVuZGVyZWRFcnJvciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFF1b3RhRXhjZWVkZWRQYXJ0LCBlbGVtZW50LCB0aGlzLnJlbmRlcmVyKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQocmVuZGVyZWRFcnJvcik7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS52YWx1ZS5hcHBlbmRDaGlsZChyZW5kZXJlZEVycm9yLmRvbU5vZGUpO1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChyZW5kZXJlZEVycm9yLm9uRGlkQ2hhbmdlSGVpZ2h0KCgpID0+IHRoaXMudXBkYXRlSXRlbUhlaWdodCh0ZW1wbGF0ZURhdGEpKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBsZXZlbCA9IGVsZW1lbnQuZXJyb3JEZXRhaWxzLmxldmVsID8/IChlbGVtZW50LmVycm9yRGV0YWlscy5yZXNwb25zZUlzRmlsdGVyZWQgPyBDaGF0RXJyb3JMZXZlbC5JbmZvIDogQ2hhdEVycm9yTGV2ZWwuRXJyb3IpO1xuXHRcdFx0XHRjb25zdCByZW5kZXJlZEVycm9yID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0V2FybmluZ0NvbnRlbnRQYXJ0LCBsZXZlbCwgbmV3IE1hcmtkb3duU3RyaW5nKGVsZW1lbnQuZXJyb3JEZXRhaWxzLm1lc3NhZ2UpLCB0aGlzLnJlbmRlcmVyKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQocmVuZGVyZWRFcnJvcik7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS52YWx1ZS5hcHBlbmRDaGlsZChyZW5kZXJlZEVycm9yLmRvbU5vZGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG5ld0hlaWdodCA9IHRlbXBsYXRlRGF0YS5yb3dDb250YWluZXIub2Zmc2V0SGVpZ2h0O1xuXHRcdGNvbnN0IGZpcmVFdmVudCA9ICFlbGVtZW50LmN1cnJlbnRSZW5kZXJlZEhlaWdodCB8fCBlbGVtZW50LmN1cnJlbnRSZW5kZXJlZEhlaWdodCAhPT0gbmV3SGVpZ2h0O1xuXHRcdGVsZW1lbnQuY3VycmVudFJlbmRlcmVkSGVpZ2h0ID0gbmV3SGVpZ2h0O1xuXHRcdGlmIChmaXJlRXZlbnQpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChkb20uc2NoZWR1bGVBdE5leHRBbmltYXRpb25GcmFtZShkb20uZ2V0V2luZG93KHRlbXBsYXRlRGF0YS52YWx1ZSksICgpID0+IHtcblx0XHRcdFx0Ly8gSGF2ZSB0byByZWNvbXB1dGUgdGhlIGhlaWdodCBoZXJlIGJlY2F1c2UgY29kZWJsb2NrIHJlbmRlcmluZyBpcyBjdXJyZW50bHkgYXN5bmMgYW5kIGl0IG1heSBoYXZlIGNoYW5nZWQuXG5cdFx0XHRcdC8vIElmIGl0IGJlY29tZXMgcHJvcGVybHkgc3luYywgdGhlbiB0aGlzIGNvdWxkIGJlIHJlbW92ZWQuXG5cdFx0XHRcdGVsZW1lbnQuY3VycmVudFJlbmRlcmVkSGVpZ2h0ID0gdGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5vZmZzZXRIZWlnaHQ7XG5cdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUl0ZW1IZWlnaHQuZmlyZSh7IGVsZW1lbnQsIGhlaWdodDogZWxlbWVudC5jdXJyZW50UmVuZGVyZWRIZWlnaHQgfSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVJdGVtSGVpZ2h0KHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0aWYgKCF0ZW1wbGF0ZURhdGEuY3VycmVudEVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBuZXdIZWlnaHQgPSBNYXRoLm1heCh0ZW1wbGF0ZURhdGEucm93Q29udGFpbmVyLm9mZnNldEhlaWdodCwgMSk7XG5cdFx0dGVtcGxhdGVEYXRhLmN1cnJlbnRFbGVtZW50LmN1cnJlbnRSZW5kZXJlZEhlaWdodCA9IG5ld0hlaWdodDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUl0ZW1IZWlnaHQuZmlyZSh7IGVsZW1lbnQ6IHRlbXBsYXRlRGF0YS5jdXJyZW50RWxlbWVudCwgaGVpZ2h0OiBuZXdIZWlnaHQgfSk7XG5cdH1cblxuXHQvKipcblx0ICpcdEByZXR1cm5zIHRydWUgaWYgcHJvZ3Jlc3NpdmUgcmVuZGVyaW5nIHNob3VsZCBiZSBjb25zaWRlcmVkIGNvbXBsZXRlLSB0aGUgZWxlbWVudCdzIGRhdGEgaXMgZnVsbHkgcmVuZGVyZWQgb3IgdGhlIHZpZXcgaXMgbm90IHZpc2libGVcblx0ICovXG5cdHByaXZhdGUgZG9OZXh0UHJvZ3Jlc3NpdmVSZW5kZXIoZWxlbWVudDogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUsIGlzSW5SZW5kZXJFbGVtZW50OiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChlbGVtZW50LmlzQ2FuY2VsZWQpIHtcblx0XHRcdHRoaXMudHJhY2VMYXlvdXQoJ2RvTmV4dFByb2dyZXNzaXZlUmVuZGVyJywgYGNhbmNlbGVkLCBpbmRleD0ke2luZGV4fWApO1xuXHRcdFx0ZWxlbWVudC5yZW5kZXJEYXRhID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5iYXNpY1JlbmRlckVsZW1lbnQoZWxlbWVudCwgaW5kZXgsIHRlbXBsYXRlRGF0YSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZURhdGEucm93Q29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2NoYXQtcmVzcG9uc2UtbG9hZGluZycsIHRydWUpO1xuXHRcdHRoaXMudHJhY2VMYXlvdXQoJ2RvTmV4dFByb2dyZXNzaXZlUmVuZGVyJywgYFNUQVJUIHByb2dyZXNzaXZlIHJlbmRlciwgaW5kZXg9JHtpbmRleH0sIHJlbmRlckRhdGE9JHtKU09OLnN0cmluZ2lmeShlbGVtZW50LnJlbmRlckRhdGEpfWApO1xuXHRcdGNvbnN0IGNvbnRlbnRGb3JUaGlzVHVybiA9IHRoaXMuZ2V0TmV4dFByb2dyZXNzaXZlUmVuZGVyQ29udGVudChlbGVtZW50KTtcblx0XHRjb25zdCBwYXJ0c1RvUmVuZGVyID0gdGhpcy5kaWZmKHRlbXBsYXRlRGF0YS5yZW5kZXJlZFBhcnRzID8/IFtdLCBjb250ZW50Rm9yVGhpc1R1cm4uY29udGVudCwgZWxlbWVudCk7XG5cblx0XHRjb25zdCBjb250ZW50SXNBbHJlYWR5UmVuZGVyZWQgPSBwYXJ0c1RvUmVuZGVyLmV2ZXJ5KHBhcnQgPT4gcGFydCA9PT0gbnVsbCk7XG5cdFx0aWYgKGNvbnRlbnRJc0FscmVhZHlSZW5kZXJlZCkge1xuXHRcdFx0aWYgKGNvbnRlbnRGb3JUaGlzVHVybi5tb3JlQ29udGVudEF2YWlsYWJsZSkge1xuXHRcdFx0XHQvLyBUaGUgY29udGVudCB0aGF0IHdlIHdhbnQgdG8gcmVuZGVyIGluIHRoaXMgdHVybiBpcyBhbHJlYWR5IHJlbmRlcmVkLCBidXQgdGhlcmUgaXMgbW9yZSBjb250ZW50IHRvIHJlbmRlciBvbiB0aGUgbmV4dCB0aWNrXG5cdFx0XHRcdHRoaXMudHJhY2VMYXlvdXQoJ2RvTmV4dFByb2dyZXNzaXZlUmVuZGVyJywgJ25vdCByZW5kZXJpbmcgYW55IG5ldyBjb250ZW50IHRoaXMgdGljaywgYnV0IG1vcmUgYXZhaWxhYmxlJyk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdC8vIEFsbCBjb250ZW50IGlzIHJlbmRlcmVkLCBhbmQgcmVzcG9uc2UgaXMgZG9uZSwgc28gZG8gYSBub3JtYWwgcmVuZGVyXG5cdFx0XHRcdHRoaXMudHJhY2VMYXlvdXQoJ2RvTmV4dFByb2dyZXNzaXZlUmVuZGVyJywgYEVORCBwcm9ncmVzc2l2ZSByZW5kZXIsIGluZGV4PSR7aW5kZXh9IGFuZCBjbGVhcmluZyByZW5kZXJEYXRhLCByZXNwb25zZSBpcyBjb21wbGV0ZWApO1xuXHRcdFx0XHRlbGVtZW50LnJlbmRlckRhdGEgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuYmFzaWNSZW5kZXJFbGVtZW50KGVsZW1lbnQsIGluZGV4LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE5vdGhpbmcgbmV3IHRvIHJlbmRlciwgc3RvcCByZW5kZXJpbmcgdW50aWwgbmV4dCBtb2RlbCB1cGRhdGVcblx0XHRcdFx0dGhpcy50cmFjZUxheW91dCgnZG9OZXh0UHJvZ3Jlc3NpdmVSZW5kZXInLCAnY2F1Z2h0IHVwIHdpdGggdGhlIHN0cmVhbS0gbm8gbmV3IGNvbnRlbnQgdG8gcmVuZGVyJyk7XG5cblx0XHRcdFx0aWYgKCF0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cykge1xuXHRcdFx0XHRcdC8vIEZpcnN0IHJlbmRlcj8gSW5pdGlhbGl6ZSBjdXJyZW50UmVuZGVyZWRIZWlnaHQuIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMzIwOTZcblx0XHRcdFx0XHRjb25zdCBoZWlnaHQgPSB0ZW1wbGF0ZURhdGEucm93Q29udGFpbmVyLm9mZnNldEhlaWdodDtcblx0XHRcdFx0XHRlbGVtZW50LmN1cnJlbnRSZW5kZXJlZEhlaWdodCA9IGhlaWdodDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIERvIGFuIGFjdHVhbCBwcm9ncmVzc2l2ZSByZW5kZXJcblx0XHR0aGlzLnRyYWNlTGF5b3V0KCdkb05leHRQcm9ncmVzc2l2ZVJlbmRlcicsIGBkb2luZyBwcm9ncmVzc2l2ZSByZW5kZXIsICR7cGFydHNUb1JlbmRlci5sZW5ndGh9IHBhcnRzIHRvIHJlbmRlcmApO1xuXHRcdHRoaXMucmVuZGVyQ2hhdENvbnRlbnREaWZmKHBhcnRzVG9SZW5kZXIsIGNvbnRlbnRGb3JUaGlzVHVybi5jb250ZW50LCBlbGVtZW50LCB0ZW1wbGF0ZURhdGEpO1xuXG5cdFx0Y29uc3QgaGVpZ2h0ID0gdGVtcGxhdGVEYXRhLnJvd0NvbnRhaW5lci5vZmZzZXRIZWlnaHQ7XG5cdFx0ZWxlbWVudC5jdXJyZW50UmVuZGVyZWRIZWlnaHQgPSBoZWlnaHQ7XG5cdFx0aWYgKCFpc0luUmVuZGVyRWxlbWVudCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VJdGVtSGVpZ2h0LmZpcmUoeyBlbGVtZW50LCBoZWlnaHQgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDaGF0Q29udGVudERpZmYocGFydHNUb1JlbmRlcjogUmVhZG9ubHlBcnJheTxJQ2hhdFJlbmRlcmVyQ29udGVudCB8IG51bGw+LCBjb250ZW50Rm9yVGhpc1R1cm46IFJlYWRvbmx5QXJyYXk8SUNoYXRSZW5kZXJlckNvbnRlbnQ+LCBlbGVtZW50OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsLCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRlcmVkUGFydHMgPSB0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cyA/PyBbXTtcblx0XHR0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cyA9IHJlbmRlcmVkUGFydHM7XG5cdFx0cGFydHNUb1JlbmRlci5mb3JFYWNoKChwYXJ0VG9SZW5kZXIsIGluZGV4KSA9PiB7XG5cdFx0XHRpZiAoIXBhcnRUb1JlbmRlcikge1xuXHRcdFx0XHQvLyBudWxsPW5vIGNoYW5nZVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFscmVhZHlSZW5kZXJlZFBhcnQgPSB0ZW1wbGF0ZURhdGEucmVuZGVyZWRQYXJ0cz8uW2luZGV4XTtcblx0XHRcdGlmIChhbHJlYWR5UmVuZGVyZWRQYXJ0KSB7XG5cdFx0XHRcdGFscmVhZHlSZW5kZXJlZFBhcnQuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwcmVjZWVkaW5nQ29udGVudFBhcnRzID0gcmVuZGVyZWRQYXJ0cy5zbGljZSgwLCBpbmRleCk7XG5cdFx0XHRjb25zdCBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCA9IHtcblx0XHRcdFx0ZWxlbWVudCxcblx0XHRcdFx0Y29udGVudDogY29udGVudEZvclRoaXNUdXJuLFxuXHRcdFx0XHRwcmVjZWVkaW5nQ29udGVudFBhcnRzLFxuXHRcdFx0XHRjb250ZW50SW5kZXg6IGluZGV4LFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IG5ld1BhcnQgPSB0aGlzLnJlbmRlckNoYXRDb250ZW50UGFydChwYXJ0VG9SZW5kZXIsIHRlbXBsYXRlRGF0YSwgY29udGV4dCk7XG5cdFx0XHRpZiAobmV3UGFydCkge1xuXHRcdFx0XHRyZW5kZXJlZFBhcnRzW2luZGV4XSA9IG5ld1BhcnQ7XG5cdFx0XHRcdC8vIE1heWJlIHRoZSBwYXJ0IGNhbid0IGJlIHJlbmRlcmVkIGluIHRoaXMgY29udGV4dCwgYnV0IHRoaXMgc2hvdWxkbid0IHJlYWxseSBoYXBwZW5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRpZiAoYWxyZWFkeVJlbmRlcmVkUGFydD8uZG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0aWYgKG5ld1BhcnQuZG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0XHQvLyBUaGlzIG1ldGhvZCBjYW4gdGhyb3cgSGllcmFyY2h5UmVxdWVzdEVycm9yXG5cdFx0XHRcdFx0XHRcdGFscmVhZHlSZW5kZXJlZFBhcnQuZG9tTm9kZS5yZXBsYWNlV2l0aChuZXdQYXJ0LmRvbU5vZGUpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0YWxyZWFkeVJlbmRlcmVkUGFydC5kb21Ob2RlLnJlbW92ZSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSBpZiAobmV3UGFydC5kb21Ob2RlKSB7XG5cdFx0XHRcdFx0XHR0ZW1wbGF0ZURhdGEudmFsdWUuYXBwZW5kQ2hpbGQobmV3UGFydC5kb21Ob2RlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignQ2hhdExpc3RJdGVtUmVuZGVyZXIjcmVuZGVyQ2hhdENvbnRlbnREaWZmOiBlcnJvciByZXBsYWNpbmcgcGFydCcsIGVycik7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFscmVhZHlSZW5kZXJlZFBhcnQ/LmRvbU5vZGU/LnJlbW92ZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYWxsIGNvbnRlbnQgcGFydHMgdGhhdCBzaG91bGQgYmUgcmVuZGVyZWQsIGFuZCB0cmltbWVkIG1hcmtkb3duIGNvbnRlbnQuIFdlIHdpbGwgZGlmZiB0aGlzIHdpdGggdGhlIGN1cnJlbnQgcmVuZGVyZWQgc2V0LlxuXHQgKi9cblx0cHJpdmF0ZSBnZXROZXh0UHJvZ3Jlc3NpdmVSZW5kZXJDb250ZW50KGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpOiB7IGNvbnRlbnQ6IElDaGF0UmVuZGVyZXJDb250ZW50W107IG1vcmVDb250ZW50QXZhaWxhYmxlOiBib29sZWFuIH0ge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLmdldERhdGFGb3JQcm9ncmVzc2l2ZVJlbmRlcihlbGVtZW50KTtcblxuXHRcdGNvbnN0IHJlbmRlcmFibGVSZXNwb25zZSA9IGFubm90YXRlU3BlY2lhbE1hcmtkb3duQ29udGVudChlbGVtZW50LnJlc3BvbnNlLnZhbHVlKTtcblxuXHRcdHRoaXMudHJhY2VMYXlvdXQoJ2dldE5leHRQcm9ncmVzc2l2ZVJlbmRlckNvbnRlbnQnLCBgV2FudCB0byByZW5kZXIgJHtkYXRhLm51bVdvcmRzVG9SZW5kZXJ9IGF0ICR7ZGF0YS5yYXRlfSB3b3Jkcy9zLCBjb3VudGluZy4uLmApO1xuXHRcdGxldCBudW1OZWVkZWRXb3JkcyA9IGRhdGEubnVtV29yZHNUb1JlbmRlcjtcblx0XHRjb25zdCBwYXJ0c1RvUmVuZGVyOiBJQ2hhdFJlbmRlcmVyQ29udGVudFtdID0gW107XG5cblx0XHQvLyBBbHdheXMgYWRkIHRoZSByZWZlcmVuY2VzIHRvIGF2b2lkIHNoaWZ0aW5nIHRoZSBjb250ZW50IHBhcnRzIHdoZW4gYSByZWZlcmVuY2UgaXMgYWRkZWQsIGFuZCBoYXZpbmcgdG8gcmUtZGlmZiBhbGwgdGhlIGNvbnRlbnQuXG5cdFx0Ly8gVGhlIHBhcnQgd2lsbCBoaWRlIGl0c2VsZiBpZiB0aGUgbGlzdCBpcyBlbXB0eS5cblx0XHRwYXJ0c1RvUmVuZGVyLnB1c2goeyBraW5kOiAncmVmZXJlbmNlcycsIHJlZmVyZW5jZXM6IGVsZW1lbnQuY29udGVudFJlZmVyZW5jZXMgfSk7XG5cblx0XHRsZXQgbW9yZUNvbnRlbnRBdmFpbGFibGUgPSBmYWxzZTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlcmFibGVSZXNwb25zZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgcGFydCA9IHJlbmRlcmFibGVSZXNwb25zZVtpXTtcblx0XHRcdGlmIChwYXJ0LmtpbmQgPT09ICdtYXJrZG93bkNvbnRlbnQnKSB7XG5cdFx0XHRcdGNvbnN0IHdvcmRDb3VudFJlc3VsdCA9IGdldE5Xb3JkcyhwYXJ0LmNvbnRlbnQudmFsdWUsIG51bU5lZWRlZFdvcmRzKTtcblx0XHRcdFx0dGhpcy50cmFjZUxheW91dCgnZ2V0TmV4dFByb2dyZXNzaXZlUmVuZGVyQ29udGVudCcsIGAgIENodW5rICR7aX06IFdhbnQgdG8gcmVuZGVyICR7bnVtTmVlZGVkV29yZHN9IHdvcmRzIGFuZCBmb3VuZCAke3dvcmRDb3VudFJlc3VsdC5yZXR1cm5lZFdvcmRDb3VudH0gd29yZHMuIFRvdGFsIHdvcmRzIGluIGNodW5rOiAke3dvcmRDb3VudFJlc3VsdC50b3RhbFdvcmRDb3VudH1gKTtcblx0XHRcdFx0bnVtTmVlZGVkV29yZHMgLT0gd29yZENvdW50UmVzdWx0LnJldHVybmVkV29yZENvdW50O1xuXG5cdFx0XHRcdGlmICh3b3JkQ291bnRSZXN1bHQuaXNGdWxsU3RyaW5nKSB7XG5cdFx0XHRcdFx0cGFydHNUb1JlbmRlci5wdXNoKHBhcnQpO1xuXG5cdFx0XHRcdFx0Ly8gQ29uc3VtZWQgZnVsbCBtYXJrZG93biBjaHVuay0gbmVlZCB0byBlbnN1cmUgdGhhdCBhbGwgZm9sbG93aW5nIG5vbi1tYXJrZG93biBwYXJ0cyBhcmUgcmVuZGVyZWRcblx0XHRcdFx0XHRmb3IgKGNvbnN0IG5leHRQYXJ0IG9mIHJlbmRlcmFibGVSZXNwb25zZS5zbGljZShpICsgMSkpIHtcblx0XHRcdFx0XHRcdGlmIChuZXh0UGFydC5raW5kICE9PSAnbWFya2Rvd25Db250ZW50Jykge1xuXHRcdFx0XHRcdFx0XHRpKys7XG5cdFx0XHRcdFx0XHRcdHBhcnRzVG9SZW5kZXIucHVzaChuZXh0UGFydCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gT25seSB0YWtpbmcgcGFydCBvZiB0aGlzIG1hcmtkb3duIHBhcnRcblx0XHRcdFx0XHRtb3JlQ29udGVudEF2YWlsYWJsZSA9IHRydWU7XG5cdFx0XHRcdFx0cGFydHNUb1JlbmRlci5wdXNoKHsgLi4ucGFydCwgY29udGVudDogbmV3IE1hcmtkb3duU3RyaW5nKHdvcmRDb3VudFJlc3VsdC52YWx1ZSwgcGFydC5jb250ZW50KSB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChudW1OZWVkZWRXb3JkcyA8PSAwKSB7XG5cdFx0XHRcdFx0Ly8gQ29sbGVjdGVkIGFsbCB3b3JkcyBhbmQgZm9sbG93aW5nIG5vbi1tYXJrZG93biBwYXJ0cyBpZiBuZWVkZWQsIGRvbmVcblx0XHRcdFx0XHRpZiAocmVuZGVyYWJsZVJlc3BvbnNlLnNsaWNlKGkgKyAxKS5zb21lKHBhcnQgPT4gcGFydC5raW5kID09PSAnbWFya2Rvd25Db250ZW50JykpIHtcblx0XHRcdFx0XHRcdG1vcmVDb250ZW50QXZhaWxhYmxlID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBhcnRzVG9SZW5kZXIucHVzaChwYXJ0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBsYXN0V29yZENvdW50ID0gZWxlbWVudC5jb250ZW50VXBkYXRlVGltaW5ncz8ubGFzdFdvcmRDb3VudCA/PyAwO1xuXHRcdGNvbnN0IG5ld1JlbmRlcmVkV29yZENvdW50ID0gZGF0YS5udW1Xb3Jkc1RvUmVuZGVyIC0gbnVtTmVlZGVkV29yZHM7XG5cdFx0Y29uc3QgYnVmZmVyV29yZHMgPSBsYXN0V29yZENvdW50IC0gbmV3UmVuZGVyZWRXb3JkQ291bnQ7XG5cdFx0dGhpcy50cmFjZUxheW91dCgnZ2V0TmV4dFByb2dyZXNzaXZlUmVuZGVyQ29udGVudCcsIGBXYW50IHRvIHJlbmRlciAke2RhdGEubnVtV29yZHNUb1JlbmRlcn0gd29yZHMuIFJlbmRlcmluZyAke25ld1JlbmRlcmVkV29yZENvdW50fSB3b3Jkcy4gQnVmZmVyOiAke2J1ZmZlcldvcmRzfSB3b3Jkc2ApO1xuXHRcdGlmIChuZXdSZW5kZXJlZFdvcmRDb3VudCA+IDAgJiYgbmV3UmVuZGVyZWRXb3JkQ291bnQgIT09IGVsZW1lbnQucmVuZGVyRGF0YT8ucmVuZGVyZWRXb3JkQ291bnQpIHtcblx0XHRcdC8vIE9ubHkgdXBkYXRlIGxhc3RSZW5kZXJUaW1lIHdoZW4gd2UgYWN0dWFsbHkgcmVuZGVyIG5ldyBjb250ZW50XG5cdFx0XHRlbGVtZW50LnJlbmRlckRhdGEgPSB7IGxhc3RSZW5kZXJUaW1lOiBEYXRlLm5vdygpLCByZW5kZXJlZFdvcmRDb3VudDogbmV3UmVuZGVyZWRXb3JkQ291bnQsIHJlbmRlcmVkUGFydHM6IHBhcnRzVG9SZW5kZXIgfTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zaG91bGRTaG93V29ya2luZ1Byb2dyZXNzKGVsZW1lbnQsIHBhcnRzVG9SZW5kZXIpKSB7XG5cdFx0XHRjb25zdCBpc1BhdXNlZCA9IGVsZW1lbnQubW9kZWwuaXNQYXVzZWQuZ2V0KCk7XG5cdFx0XHRwYXJ0c1RvUmVuZGVyLnB1c2goeyBraW5kOiAnd29ya2luZycsIGlzUGF1c2VkIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGNvbnRlbnQ6IHBhcnRzVG9SZW5kZXIsIG1vcmVDb250ZW50QXZhaWxhYmxlIH07XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZFNob3dXb3JraW5nUHJvZ3Jlc3MoZWxlbWVudDogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCwgcGFydHNUb1JlbmRlcjogSUNoYXRSZW5kZXJlckNvbnRlbnRbXSk6IGJvb2xlYW4ge1xuXHRcdGlmIChlbGVtZW50LmFnZW50T3JTbGFzaENvbW1hbmREZXRlY3RlZCB8fCB0aGlzLnJlbmRlcmVyT3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ21pbmltYWwnIHx8IGVsZW1lbnQuaXNDb21wbGV0ZSB8fCAhY2hlY2tNb2RlT3B0aW9uKHRoaXMuZGVsZWdhdGUuY3VycmVudENoYXRNb2RlKCksIHRoaXMucmVuZGVyZXJPcHRpb25zLnByb2dyZXNzTWVzc2FnZUF0Qm90dG9tT2ZSZXNwb25zZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoZWxlbWVudC5tb2RlbC5pc1BhdXNlZC5nZXQoKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyBpZiBubyBjb250ZW50LCBvbmx5IFwidXNlZCByZWZlcmVuY2VzXCIsIGVuZHMgd2l0aCBhIGNvbXBsZXRlIHRvb2wgY2FsbCwgb3IgZW5kcyB3aXRoIGNvbXBsZXRlIHRleHQgZWRpdHMgYW5kIHRoZXJlIGlzIG5vIGluY29tcGxldGUgdG9vbCBjYWxsIChlZGl0cyBhcmUgc3RpbGwgYmVpbmcgYXBwbGllZCBzb21lIHRpbWUgYWZ0ZXIgdGhleSBhcmUgYWxsIGdlbmVyYXRlZClcblx0XHRjb25zdCBsYXN0UGFydCA9IHBhcnRzVG9SZW5kZXIuYXQoLTEpO1xuXHRcdGlmIChcblx0XHRcdCFsYXN0UGFydCB8fFxuXHRcdFx0bGFzdFBhcnQua2luZCA9PT0gJ3JlZmVyZW5jZXMnIHx8XG5cdFx0XHQobGFzdFBhcnQua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uJyAmJiAobGFzdFBhcnQuaXNDb21wbGV0ZSB8fCBsYXN0UGFydC5wcmVzZW50YXRpb24gPT09ICdoaWRkZW4nKSkgfHxcblx0XHRcdCgobGFzdFBhcnQua2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnIHx8IGxhc3RQYXJ0LmtpbmQgPT09ICdub3RlYm9va0VkaXRHcm91cCcpICYmIGxhc3RQYXJ0LmRvbmUgJiYgIXBhcnRzVG9SZW5kZXIuc29tZShwYXJ0ID0+IHBhcnQua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uJyAmJiAhcGFydC5pc0NvbXBsZXRlKSkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGF0YUZvclByb2dyZXNzaXZlUmVuZGVyKGVsZW1lbnQ6IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpIHtcblx0XHRjb25zdCByZW5kZXJEYXRhID0gZWxlbWVudC5yZW5kZXJEYXRhID8/IHsgbGFzdFJlbmRlclRpbWU6IDAsIHJlbmRlcmVkV29yZENvdW50OiAwIH07XG5cblx0XHRjb25zdCByYXRlID0gdGhpcy5nZXRQcm9ncmVzc2l2ZVJlbmRlclJhdGUoZWxlbWVudCk7XG5cdFx0Y29uc3QgbnVtV29yZHNUb1JlbmRlciA9IHJlbmRlckRhdGEubGFzdFJlbmRlclRpbWUgPT09IDAgP1xuXHRcdFx0MSA6XG5cdFx0XHRyZW5kZXJEYXRhLnJlbmRlcmVkV29yZENvdW50ICtcblx0XHRcdC8vIEFkZGl0aW9uYWwgd29yZHMgdG8gcmVuZGVyIGJleW9uZCB3aGF0J3MgYWxyZWFkeSByZW5kZXJlZFxuXHRcdFx0TWF0aC5mbG9vcigoRGF0ZS5ub3coKSAtIHJlbmRlckRhdGEubGFzdFJlbmRlclRpbWUpIC8gMTAwMCAqIHJhdGUpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG51bVdvcmRzVG9SZW5kZXIsXG5cdFx0XHRyYXRlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZGlmZihyZW5kZXJlZFBhcnRzOiBSZWFkb25seUFycmF5PElDaGF0Q29udGVudFBhcnQ+LCBjb250ZW50VG9SZW5kZXI6IFJlYWRvbmx5QXJyYXk8SUNoYXRSZW5kZXJlckNvbnRlbnQ+LCBlbGVtZW50OiBDaGF0VHJlZUl0ZW0pOiBSZWFkb25seUFycmF5PElDaGF0UmVuZGVyZXJDb250ZW50IHwgbnVsbD4ge1xuXHRcdGNvbnN0IGRpZmY6IChJQ2hhdFJlbmRlcmVyQ29udGVudCB8IG51bGwpW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvbnRlbnRUb1JlbmRlci5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGNvbnRlbnRUb1JlbmRlcltpXTtcblx0XHRcdGNvbnN0IHJlbmRlcmVkUGFydCA9IHJlbmRlcmVkUGFydHNbaV07XG5cblx0XHRcdGlmICghcmVuZGVyZWRQYXJ0IHx8ICFyZW5kZXJlZFBhcnQuaGFzU2FtZUNvbnRlbnQoY29udGVudCwgY29udGVudFRvUmVuZGVyLnNsaWNlKGkgKyAxKSwgZWxlbWVudCkpIHtcblx0XHRcdFx0ZGlmZi5wdXNoKGNvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbnVsbCAtPiBubyBjaGFuZ2Vcblx0XHRcdFx0ZGlmZi5wdXNoKG51bGwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBkaWZmO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDaGF0Q29udGVudFBhcnQoY29udGVudDogSUNoYXRSZW5kZXJlckNvbnRlbnQsIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlLCBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCk6IElDaGF0Q29udGVudFBhcnQgfCB1bmRlZmluZWQge1xuXHRcdGlmIChjb250ZW50LmtpbmQgPT09ICd0cmVlRGF0YScpIHtcblx0XHRcdHJldHVybiB0aGlzLnJlbmRlclRyZWVEYXRhKGNvbnRlbnQsIHRlbXBsYXRlRGF0YSwgY29udGV4dCk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICdwcm9ncmVzc01lc3NhZ2UnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UHJvZ3Jlc3NDb250ZW50UGFydCwgY29udGVudCwgdGhpcy5yZW5kZXJlciwgY29udGV4dCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICdwcm9ncmVzc1Rhc2snKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXJQcm9ncmVzc1Rhc2soY29udGVudCwgdGVtcGxhdGVEYXRhLCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGNvbnRlbnQua2luZCA9PT0gJ2NvbW1hbmQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0Q29tbWFuZEJ1dHRvbkNvbnRlbnRQYXJ0LCBjb250ZW50LCBjb250ZXh0KTtcblx0XHR9IGVsc2UgaWYgKGNvbnRlbnQua2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXJUZXh0RWRpdChjb250ZXh0LCBjb250ZW50LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdH0gZWxzZSBpZiAoY29udGVudC5raW5kID09PSAnY29uZmlybWF0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyQ29uZmlybWF0aW9uKGNvbnRleHQsIGNvbnRlbnQsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICd3YXJuaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFdhcm5pbmdDb250ZW50UGFydCwgQ2hhdEVycm9yTGV2ZWwuV2FybmluZywgY29udGVudC5jb250ZW50LCB0aGlzLnJlbmRlcmVyKTtcblx0XHR9IGVsc2UgaWYgKGNvbnRlbnQua2luZCA9PT0gJ21hcmtkb3duQ29udGVudCcpIHtcblx0XHRcdHJldHVybiB0aGlzLnJlbmRlck1hcmtkb3duKGNvbnRlbnQsIHRlbXBsYXRlRGF0YSwgY29udGV4dCk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICdyZWZlcmVuY2VzJykge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyQ29udGVudFJlZmVyZW5jZXNMaXN0RGF0YShjb250ZW50LCB1bmRlZmluZWQsIGNvbnRleHQsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICdjb2RlQ2l0YXRpb25zJykge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyQ29kZUNpdGF0aW9ucyhjb250ZW50LCBjb250ZXh0LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdH0gZWxzZSBpZiAoY29udGVudC5raW5kID09PSAndG9vbEludm9jYXRpb24nIHx8IGNvbnRlbnQua2luZCA9PT0gJ3Rvb2xJbnZvY2F0aW9uU2VyaWFsaXplZCcpIHtcblx0XHRcdHJldHVybiB0aGlzLnJlbmRlclRvb2xJbnZvY2F0aW9uKGNvbnRlbnQsIGNvbnRleHQsIHRlbXBsYXRlRGF0YSk7XG5cdFx0fSBlbHNlIGlmIChjb250ZW50LmtpbmQgPT09ICd3b3JraW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVuZGVyV29ya2luZ1Byb2dyZXNzKGNvbnRlbnQsIGNvbnRleHQpO1xuXHRcdH0gZWxzZSBpZiAoY29udGVudC5raW5kID09PSAndW5kb1N0b3AnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZW5kZXJVbmRvU3RvcChjb250ZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJOb0NvbnRlbnQob3RoZXIgPT4gY29udGVudC5raW5kID09PSBvdGhlci5raW5kKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyVW5kb1N0b3AoY29udGVudDogSUNoYXRVbmRvU3RvcCkge1xuXHRcdHJldHVybiB0aGlzLnJlbmRlck5vQ29udGVudChvdGhlciA9PiBvdGhlci5raW5kID09PSBjb250ZW50LmtpbmQgJiYgb3RoZXIuaWQgPT09IGNvbnRlbnQuaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJOb0NvbnRlbnQoZXF1YWxzOiAob3RoZXJDb250ZW50OiBJQ2hhdFJlbmRlcmVyQ29udGVudCkgPT4gYm9vbGVhbik6IElDaGF0Q29udGVudFBhcnQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH0sXG5cdFx0XHRkb21Ob2RlOiB1bmRlZmluZWQsXG5cdFx0XHRoYXNTYW1lQ29udGVudDogZXF1YWxzLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRyZWVEYXRhKGNvbnRlbnQ6IElDaGF0VHJlZURhdGEsIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlLCBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCk6IElDaGF0Q29udGVudFBhcnQge1xuXHRcdGNvbnN0IGRhdGEgPSBjb250ZW50LnRyZWVEYXRhO1xuXHRcdGNvbnN0IHRyZWVEYXRhSW5kZXggPSBjb250ZXh0LnByZWNlZWRpbmdDb250ZW50UGFydHMuZmlsdGVyKHBhcnQgPT4gcGFydCBpbnN0YW5jZW9mIENoYXRUcmVlQ29udGVudFBhcnQpLmxlbmd0aDtcblx0XHRjb25zdCB0cmVlUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFRyZWVDb250ZW50UGFydCwgZGF0YSwgY29udGV4dC5lbGVtZW50LCB0aGlzLl90cmVlUG9vbCwgdHJlZURhdGFJbmRleCk7XG5cblx0XHR0cmVlUGFydC5hZGREaXNwb3NhYmxlKHRyZWVQYXJ0Lm9uRGlkQ2hhbmdlSGVpZ2h0KCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlSXRlbUhlaWdodCh0ZW1wbGF0ZURhdGEpO1xuXHRcdH0pKTtcblxuXHRcdGlmIChpc1Jlc3BvbnNlVk0oY29udGV4dC5lbGVtZW50KSkge1xuXHRcdFx0Y29uc3QgZmlsZVRyZWVGb2N1c0luZm8gPSB7XG5cdFx0XHRcdHRyZWVEYXRhSWQ6IGRhdGEudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdHRyZWVJbmRleDogdHJlZURhdGFJbmRleCxcblx0XHRcdFx0Zm9jdXMoKSB7XG5cdFx0XHRcdFx0dHJlZVBhcnQuZG9tRm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0Ly8gVE9ET0Byb2Jsb3VyZW5zIHRoZXJlJ3MgZ290IHRvIGJlIGEgYmV0dGVyIHdheSB0byBuYXZpZ2F0ZSB0cmVlc1xuXHRcdFx0dHJlZVBhcnQuYWRkRGlzcG9zYWJsZSh0cmVlUGFydC5vbkRpZEZvY3VzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5mb2N1c2VkRmlsZVRyZWVzQnlSZXNwb25zZUlkLnNldChjb250ZXh0LmVsZW1lbnQuaWQsIGZpbGVUcmVlRm9jdXNJbmZvLnRyZWVJbmRleCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGNvbnN0IGZpbGVUcmVlcyA9IHRoaXMuZmlsZVRyZWVzQnlSZXNwb25zZUlkLmdldChjb250ZXh0LmVsZW1lbnQuaWQpID8/IFtdO1xuXHRcdFx0ZmlsZVRyZWVzLnB1c2goZmlsZVRyZWVGb2N1c0luZm8pO1xuXHRcdFx0dGhpcy5maWxlVHJlZXNCeVJlc3BvbnNlSWQuc2V0KGNvbnRleHQuZWxlbWVudC5pZCwgZGlzdGluY3QoZmlsZVRyZWVzLCAodikgPT4gdi50cmVlRGF0YUlkKSk7XG5cdFx0XHR0cmVlUGFydC5hZGREaXNwb3NhYmxlKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmZpbGVUcmVlc0J5UmVzcG9uc2VJZC5zZXQoY29udGV4dC5lbGVtZW50LmlkLCBmaWxlVHJlZXMuZmlsdGVyKHYgPT4gdi50cmVlRGF0YUlkICE9PSBkYXRhLnVyaS50b1N0cmluZygpKSkpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJlZVBhcnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNvbnRlbnRSZWZlcmVuY2VzTGlzdERhdGEocmVmZXJlbmNlczogSUNoYXRSZWZlcmVuY2VzLCBsYWJlbE92ZXJyaWRlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IENoYXRDb2xsYXBzaWJsZUxpc3RDb250ZW50UGFydCB7XG5cdFx0Y29uc3QgcmVmZXJlbmNlc1BhcnQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRVc2VkUmVmZXJlbmNlc0xpc3RDb250ZW50UGFydCwgcmVmZXJlbmNlcy5yZWZlcmVuY2VzLCBsYWJlbE92ZXJyaWRlLCBjb250ZXh0LCB0aGlzLl9jb250ZW50UmVmZXJlbmNlc0xpc3RQb29sLCB7IGV4cGFuZGVkV2hlbkVtcHR5UmVzcG9uc2U6IGNoZWNrTW9kZU9wdGlvbih0aGlzLmRlbGVnYXRlLmN1cnJlbnRDaGF0TW9kZSgpLCB0aGlzLnJlbmRlcmVyT3B0aW9ucy5yZWZlcmVuY2VzRXhwYW5kZWRXaGVuRW1wdHlSZXNwb25zZSkgfSk7XG5cdFx0cmVmZXJlbmNlc1BhcnQuYWRkRGlzcG9zYWJsZShyZWZlcmVuY2VzUGFydC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUl0ZW1IZWlnaHQodGVtcGxhdGVEYXRhKTtcblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcmVmZXJlbmNlc1BhcnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNvZGVDaXRhdGlvbnMoY2l0YXRpb25zOiBJQ2hhdENvZGVDaXRhdGlvbnMsIGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IENoYXRDb2RlQ2l0YXRpb25Db250ZW50UGFydCB7XG5cdFx0Y29uc3QgY2l0YXRpb25zUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdENvZGVDaXRhdGlvbkNvbnRlbnRQYXJ0LCBjaXRhdGlvbnMsIGNvbnRleHQpO1xuXHRcdHJldHVybiBjaXRhdGlvbnNQYXJ0O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb2RlQmxvY2tTdGFydEluZGV4KGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gY29udGV4dC5wcmVjZWVkaW5nQ29udGVudFBhcnRzLnJlZHVjZSgoYWNjLCBwYXJ0KSA9PiBhY2MgKyAocGFydC5jb2RlYmxvY2tzPy5sZW5ndGggPz8gMCksIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVSZW5kZXJlZENvZGVibG9ja3MoZWxlbWVudDogQ2hhdFRyZWVJdGVtLCBwYXJ0OiBJQ2hhdENvbnRlbnRQYXJ0LCBjb2RlQmxvY2tTdGFydEluZGV4OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoIXBhcnQuYWRkRGlzcG9zYWJsZSB8fCBwYXJ0LmNvZGVibG9ja3NQYXJ0SWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvZGVCbG9ja3NCeVJlc3BvbnNlSWQgPSB0aGlzLmNvZGVCbG9ja3NCeVJlc3BvbnNlSWQuZ2V0KGVsZW1lbnQuaWQpID8/IFtdO1xuXHRcdHRoaXMuY29kZUJsb2Nrc0J5UmVzcG9uc2VJZC5zZXQoZWxlbWVudC5pZCwgY29kZUJsb2Nrc0J5UmVzcG9uc2VJZCk7XG5cdFx0cGFydC5hZGREaXNwb3NhYmxlKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBjb2RlQmxvY2tzQnlSZXNwb25zZUlkID0gdGhpcy5jb2RlQmxvY2tzQnlSZXNwb25zZUlkLmdldChlbGVtZW50LmlkKTtcblx0XHRcdGlmIChjb2RlQmxvY2tzQnlSZXNwb25zZUlkKSB7XG5cdFx0XHRcdC8vIE9ubHkgZGVsZXRlIGlmIHRoaXMgaXMgbXkgY29kZSBibG9ja1xuXHRcdFx0XHRwYXJ0LmNvZGVibG9ja3M/LmZvckVhY2goKGluZm8sIGkpID0+IHtcblx0XHRcdFx0XHRjb25zdCBjb2RlYmxvY2sgPSBjb2RlQmxvY2tzQnlSZXNwb25zZUlkW2NvZGVCbG9ja1N0YXJ0SW5kZXggKyBpXTtcblx0XHRcdFx0XHRpZiAoY29kZWJsb2NrPy5vd25lck1hcmtkb3duUGFydElkID09PSBwYXJ0LmNvZGVibG9ja3NQYXJ0SWQpIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSBjb2RlQmxvY2tzQnlSZXNwb25zZUlkW2NvZGVCbG9ja1N0YXJ0SW5kZXggKyBpXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHBhcnQuY29kZWJsb2Nrcz8uZm9yRWFjaCgoaW5mbywgaSkgPT4ge1xuXHRcdFx0Y29kZUJsb2Nrc0J5UmVzcG9uc2VJZFtjb2RlQmxvY2tTdGFydEluZGV4ICsgaV0gPSBpbmZvO1xuXHRcdFx0cGFydC5hZGREaXNwb3NhYmxlISh0aGVuSWZOb3REaXNwb3NlZChpbmZvLnVyaVByb21pc2UsIHVyaSA9PiB7XG5cdFx0XHRcdGlmICghdXJpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5jb2RlQmxvY2tzQnlFZGl0b3JVcmkuc2V0KHVyaSwgaW5mbyk7XG5cdFx0XHRcdHBhcnQuYWRkRGlzcG9zYWJsZSEodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBjb2RlYmxvY2sgPSB0aGlzLmNvZGVCbG9ja3NCeUVkaXRvclVyaS5nZXQodXJpKTtcblx0XHRcdFx0XHRpZiAoY29kZWJsb2NrPy5vd25lck1hcmtkb3duUGFydElkID09PSBwYXJ0LmNvZGVibG9ja3NQYXJ0SWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuY29kZUJsb2Nrc0J5RWRpdG9yVXJpLmRlbGV0ZSh1cmkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRvb2xJbnZvY2F0aW9uKHRvb2xJbnZvY2F0aW9uOiBJQ2hhdFRvb2xJbnZvY2F0aW9uIHwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsIGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSk6IElDaGF0Q29udGVudFBhcnQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNvZGVCbG9ja1N0YXJ0SW5kZXggPSB0aGlzLmdldENvZGVCbG9ja1N0YXJ0SW5kZXgoY29udGV4dCk7XG5cdFx0Y29uc3QgcGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFRvb2xJbnZvY2F0aW9uUGFydCwgdG9vbEludm9jYXRpb24sIGNvbnRleHQsIHRoaXMucmVuZGVyZXIsIHRoaXMuX2NvbnRlbnRSZWZlcmVuY2VzTGlzdFBvb2wsIHRoaXMuX3Rvb2xFZGl0b3JQb29sLCAoKSA9PiB0aGlzLl9jdXJyZW50TGF5b3V0V2lkdGgsIHRoaXMuX3Rvb2xJbnZvY2F0aW9uQ29kZUJsb2NrQ29sbGVjdGlvbiwgY29kZUJsb2NrU3RhcnRJbmRleCk7XG5cdFx0cGFydC5hZGREaXNwb3NhYmxlKHBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVJdGVtSGVpZ2h0KHRlbXBsYXRlRGF0YSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuaGFuZGxlUmVuZGVyZWRDb2RlYmxvY2tzKGNvbnRleHQuZWxlbWVudCwgcGFydCwgY29kZUJsb2NrU3RhcnRJbmRleCk7XG5cdFx0cmV0dXJuIHBhcnQ7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclByb2dyZXNzVGFzayh0YXNrOiBJQ2hhdFRhc2ssIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlLCBjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCk6IElDaGF0Q29udGVudFBhcnQgfCB1bmRlZmluZWQge1xuXHRcdGlmICghaXNSZXNwb25zZVZNKGNvbnRleHQuZWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0YXNrUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFRhc2tDb250ZW50UGFydCwgdGFzaywgdGhpcy5fY29udGVudFJlZmVyZW5jZXNMaXN0UG9vbCwgdGhpcy5yZW5kZXJlciwgY29udGV4dCk7XG5cdFx0dGFza1BhcnQuYWRkRGlzcG9zYWJsZSh0YXNrUGFydC5vbkRpZENoYW5nZUhlaWdodCgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZUl0ZW1IZWlnaHQodGVtcGxhdGVEYXRhKTtcblx0XHR9KSk7XG5cdFx0cmV0dXJuIHRhc2tQYXJ0O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJXb3JraW5nUHJvZ3Jlc3Mod29ya2luZ1Byb2dyZXNzOiBJQ2hhdFdvcmtpbmdQcm9ncmVzcywgY29udGV4dDogSUNoYXRDb250ZW50UGFydFJlbmRlckNvbnRleHQpOiBJQ2hhdENvbnRlbnRQYXJ0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0V29ya2luZ1Byb2dyZXNzQ29udGVudFBhcnQsIHdvcmtpbmdQcm9ncmVzcywgdGhpcy5yZW5kZXJlciwgY29udGV4dCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNvbmZpcm1hdGlvbihjb250ZXh0OiBJQ2hhdENvbnRlbnRQYXJ0UmVuZGVyQ29udGV4dCwgY29uZmlybWF0aW9uOiBJQ2hhdENvbmZpcm1hdGlvbiwgdGVtcGxhdGVEYXRhOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUpOiBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0XHRjb25zdCBwYXJ0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0Q29uZmlybWF0aW9uQ29udGVudFBhcnQsIGNvbmZpcm1hdGlvbiwgY29udGV4dCk7XG5cdFx0cGFydC5hZGREaXNwb3NhYmxlKHBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4gdGhpcy51cGRhdGVJdGVtSGVpZ2h0KHRlbXBsYXRlRGF0YSkpKTtcblx0XHRyZXR1cm4gcGFydDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQXR0YWNobWVudHModmFyaWFibGVzOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5W10sIGNvbnRlbnRSZWZlcmVuY2VzOiBSZWFkb25seUFycmF5PElDaGF0Q29udGVudFJlZmVyZW5jZT4gfCB1bmRlZmluZWQsIHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlKSB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEF0dGFjaG1lbnRzQ29udGVudFBhcnQsIHZhcmlhYmxlcywgY29udGVudFJlZmVyZW5jZXMsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRleHRFZGl0KGNvbnRleHQ6IElDaGF0Q29udGVudFBhcnRSZW5kZXJDb250ZXh0LCBjaGF0VGV4dEVkaXQ6IElDaGF0VGV4dEVkaXRHcm91cCwgdGVtcGxhdGVEYXRhOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUpOiBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0XHRjb25zdCB0ZXh0RWRpdFBhcnQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRUZXh0RWRpdENvbnRlbnRQYXJ0LCBjaGF0VGV4dEVkaXQsIGNvbnRleHQsIHRoaXMucmVuZGVyZXJPcHRpb25zLCB0aGlzLl9kaWZmRWRpdG9yUG9vbCwgdGhpcy5fY3VycmVudExheW91dFdpZHRoKTtcblx0XHR0ZXh0RWRpdFBhcnQuYWRkRGlzcG9zYWJsZSh0ZXh0RWRpdFBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4ge1xuXHRcdFx0dGV4dEVkaXRQYXJ0LmxheW91dCh0aGlzLl9jdXJyZW50TGF5b3V0V2lkdGgpO1xuXHRcdFx0dGhpcy51cGRhdGVJdGVtSGVpZ2h0KHRlbXBsYXRlRGF0YSk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHRleHRFZGl0UGFydDtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTWFya2Rvd24obWFya2Rvd246IElDaGF0TWFya2Rvd25Db250ZW50LCB0ZW1wbGF0ZURhdGE6IElDaGF0TGlzdEl0ZW1UZW1wbGF0ZSwgY29udGV4dDogSUNoYXRDb250ZW50UGFydFJlbmRlckNvbnRleHQpOiBJQ2hhdENvbnRlbnRQYXJ0IHtcblx0XHRjb25zdCBlbGVtZW50ID0gY29udGV4dC5lbGVtZW50O1xuXHRcdGNvbnN0IGZpbGxJbkluY29tcGxldGVUb2tlbnMgPSBpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgKCFlbGVtZW50LmlzQ29tcGxldGUgfHwgZWxlbWVudC5pc0NhbmNlbGVkIHx8IGVsZW1lbnQuZXJyb3JEZXRhaWxzPy5yZXNwb25zZUlzRmlsdGVyZWQgfHwgZWxlbWVudC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNJbmNvbXBsZXRlIHx8ICEhZWxlbWVudC5yZW5kZXJEYXRhKTtcblx0XHRjb25zdCBjb2RlQmxvY2tTdGFydEluZGV4ID0gdGhpcy5nZXRDb2RlQmxvY2tTdGFydEluZGV4KGNvbnRleHQpO1xuXHRcdGNvbnN0IG1hcmtkb3duUGFydCA9IHRlbXBsYXRlRGF0YS5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0TWFya2Rvd25Db250ZW50UGFydCwgbWFya2Rvd24sIGNvbnRleHQsIHRoaXMuX2VkaXRvclBvb2wsIGZpbGxJbkluY29tcGxldGVUb2tlbnMsIGNvZGVCbG9ja1N0YXJ0SW5kZXgsIHRoaXMucmVuZGVyZXIsIHRoaXMuX2N1cnJlbnRMYXlvdXRXaWR0aCwgdGhpcy5jb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24sIHt9KTtcblx0XHRtYXJrZG93blBhcnQuYWRkRGlzcG9zYWJsZShtYXJrZG93blBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4ge1xuXHRcdFx0bWFya2Rvd25QYXJ0LmxheW91dCh0aGlzLl9jdXJyZW50TGF5b3V0V2lkdGgpO1xuXHRcdFx0dGhpcy51cGRhdGVJdGVtSGVpZ2h0KHRlbXBsYXRlRGF0YSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5oYW5kbGVSZW5kZXJlZENvZGVibG9ja3MoZWxlbWVudCwgbWFya2Rvd25QYXJ0LCBjb2RlQmxvY2tTdGFydEluZGV4KTtcblxuXHRcdHJldHVybiBtYXJrZG93blBhcnQ7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChub2RlOiBJVHJlZU5vZGU8Q2hhdFRyZWVJdGVtLCBGdXp6eVNjb3JlPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJQ2hhdExpc3RJdGVtVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0aGlzLnRyYWNlTGF5b3V0KCdkaXNwb3NlRWxlbWVudCcsIGBEaXNwb3NpbmcgZWxlbWVudCwgaW5kZXg9JHtpbmRleH1gKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHQvLyBEb24ndCByZXRhaW4gdGhlIHRvb2xiYXIgY29udGV4dCB3aGljaCBpbmNsdWRlcyBjaGF0IHZpZXdtb2RlbHNcblx0XHRpZiAodGVtcGxhdGVEYXRhLnRpdGxlVG9vbGJhcikge1xuXHRcdFx0dGVtcGxhdGVEYXRhLnRpdGxlVG9vbGJhci5jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0ZW1wbGF0ZURhdGEuZm9vdGVyVG9vbGJhci5jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUNoYXRMaXN0SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnRlbXBsYXRlRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0TGlzdERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8Q2hhdFRyZWVJdGVtPiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVmYXVsdEVsZW1lbnRIZWlnaHQ6IG51bWJlcixcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHsgfVxuXG5cdHByaXZhdGUgX3RyYWNlTGF5b3V0KG1ldGhvZDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcblx0XHRpZiAoZm9yY2VWZXJib3NlTGF5b3V0VHJhY2luZykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYENoYXRMaXN0RGVsZWdhdGUjJHttZXRob2R9OiAke21lc3NhZ2V9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgQ2hhdExpc3REZWxlZ2F0ZSMke21ldGhvZH06ICR7bWVzc2FnZX1gKTtcblx0XHR9XG5cdH1cblxuXHRnZXRIZWlnaHQoZWxlbWVudDogQ2hhdFRyZWVJdGVtKTogbnVtYmVyIHtcblx0XHRjb25zdCBraW5kID0gaXNSZXF1ZXN0Vk0oZWxlbWVudCkgPyAncmVxdWVzdCcgOiAncmVzcG9uc2UnO1xuXHRcdGNvbnN0IGhlaWdodCA9ICgnY3VycmVudFJlbmRlcmVkSGVpZ2h0JyBpbiBlbGVtZW50ID8gZWxlbWVudC5jdXJyZW50UmVuZGVyZWRIZWlnaHQgOiB1bmRlZmluZWQpID8/IHRoaXMuZGVmYXVsdEVsZW1lbnRIZWlnaHQ7XG5cdFx0dGhpcy5fdHJhY2VMYXlvdXQoJ2dldEhlaWdodCcsIGAke2tpbmR9LCBoZWlnaHQ9JHtoZWlnaHR9YCk7XG5cdFx0cmV0dXJuIGhlaWdodDtcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogQ2hhdFRyZWVJdGVtKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gQ2hhdExpc3RJdGVtUmVuZGVyZXIuSUQ7XG5cdH1cblxuXHRoYXNEeW5hbWljSGVpZ2h0KGVsZW1lbnQ6IENoYXRUcmVlSXRlbSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG59XG5cbmNvbnN0IHZvdGVEb3duRGV0YWlsTGFiZWxzOiBSZWNvcmQ8Q2hhdEFnZW50Vm90ZURvd25SZWFzb24sIHN0cmluZz4gPSB7XG5cdFtDaGF0QWdlbnRWb3RlRG93blJlYXNvbi5JbmNvcnJlY3RDb2RlXTogbG9jYWxpemUoJ2luY29ycmVjdENvZGUnLCBcIlN1Z2dlc3RlZCBpbmNvcnJlY3QgY29kZVwiKSxcblx0W0NoYXRBZ2VudFZvdGVEb3duUmVhc29uLkRpZE5vdEZvbGxvd0luc3RydWN0aW9uc106IGxvY2FsaXplKCdkaWROb3RGb2xsb3dJbnN0cnVjdGlvbnMnLCBcIkRpZG4ndCBmb2xsb3cgaW5zdHJ1Y3Rpb25zXCIpLFxuXHRbQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uTWlzc2luZ0NvbnRleHRdOiBsb2NhbGl6ZSgnbWlzc2luZ0NvbnRleHQnLCBcIk1pc3NpbmcgY29udGV4dFwiKSxcblx0W0NoYXRBZ2VudFZvdGVEb3duUmVhc29uLk9mZmVuc2l2ZU9yVW5zYWZlXTogbG9jYWxpemUoJ29mZmVuc2l2ZU9yVW5zYWZlJywgXCJPZmZlbnNpdmUgb3IgdW5zYWZlXCIpLFxuXHRbQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uUG9vcmx5V3JpdHRlbk9yRm9ybWF0dGVkXTogbG9jYWxpemUoJ3Bvb3JseVdyaXR0ZW5PckZvcm1hdHRlZCcsIFwiUG9vcmx5IHdyaXR0ZW4gb3IgZm9ybWF0dGVkXCIpLFxuXHRbQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uUmVmdXNlZEFWYWxpZFJlcXVlc3RdOiBsb2NhbGl6ZSgncmVmdXNlZEFWYWxpZFJlcXVlc3QnLCBcIlJlZnVzZWQgYSB2YWxpZCByZXF1ZXN0XCIpLFxuXHRbQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uSW5jb21wbGV0ZUNvZGVdOiBsb2NhbGl6ZSgnaW5jb21wbGV0ZUNvZGUnLCBcIkluY29tcGxldGUgY29kZVwiKSxcblx0W0NoYXRBZ2VudFZvdGVEb3duUmVhc29uLldpbGxSZXBvcnRJc3N1ZV06IGxvY2FsaXplKCdyZXBvcnRJc3N1ZScsIFwiUmVwb3J0IGFuIGlzc3VlXCIpLFxuXHRbQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uT3RoZXJdOiBsb2NhbGl6ZSgnb3RoZXInLCBcIk90aGVyXCIpLFxufTtcblxuZXhwb3J0IGNsYXNzIENoYXRWb3RlRG93bkJ1dHRvbiBleHRlbmRzIERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBJQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpc3N1ZVNlcnZpY2U6IElXb3JrYmVuY2hJc3N1ZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihhY3Rpb24sXG5cdFx0XHR7IGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0QWN0aW9ucygpLCB9LFxuXHRcdFx0Y29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRjbGFzc05hbWVzOiBUaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnRodW1ic2Rvd24pLFxuXHRcdFx0fSk7XG5cdH1cblxuXHRnZXRBY3Rpb25zKCk6IHJlYWRvbmx5IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIFtcblx0XHRcdHRoaXMuZ2V0Vm90ZURvd25EZXRhaWxBY3Rpb24oQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uSW5jb3JyZWN0Q29kZSksXG5cdFx0XHR0aGlzLmdldFZvdGVEb3duRGV0YWlsQWN0aW9uKENoYXRBZ2VudFZvdGVEb3duUmVhc29uLkRpZE5vdEZvbGxvd0luc3RydWN0aW9ucyksXG5cdFx0XHR0aGlzLmdldFZvdGVEb3duRGV0YWlsQWN0aW9uKENoYXRBZ2VudFZvdGVEb3duUmVhc29uLkluY29tcGxldGVDb2RlKSxcblx0XHRcdHRoaXMuZ2V0Vm90ZURvd25EZXRhaWxBY3Rpb24oQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uTWlzc2luZ0NvbnRleHQpLFxuXHRcdFx0dGhpcy5nZXRWb3RlRG93bkRldGFpbEFjdGlvbihDaGF0QWdlbnRWb3RlRG93blJlYXNvbi5Qb29ybHlXcml0dGVuT3JGb3JtYXR0ZWQpLFxuXHRcdFx0dGhpcy5nZXRWb3RlRG93bkRldGFpbEFjdGlvbihDaGF0QWdlbnRWb3RlRG93blJlYXNvbi5SZWZ1c2VkQVZhbGlkUmVxdWVzdCksXG5cdFx0XHR0aGlzLmdldFZvdGVEb3duRGV0YWlsQWN0aW9uKENoYXRBZ2VudFZvdGVEb3duUmVhc29uLk9mZmVuc2l2ZU9yVW5zYWZlKSxcblx0XHRcdHRoaXMuZ2V0Vm90ZURvd25EZXRhaWxBY3Rpb24oQ2hhdEFnZW50Vm90ZURvd25SZWFzb24uT3RoZXIpLFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ3JlcG9ydElzc3VlJyxcblx0XHRcdFx0bGFiZWw6IHZvdGVEb3duRGV0YWlsTGFiZWxzW0NoYXRBZ2VudFZvdGVEb3duUmVhc29uLldpbGxSZXBvcnRJc3N1ZV0sXG5cdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRydW46IGFzeW5jIChjb250ZXh0OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdFx0aWYgKCFpc1Jlc3BvbnNlVk0oY29udGV4dCkpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcignQ2hhdFZvdGVEb3duQnV0dG9uI3J1bjogaW52YWxpZCBjb250ZXh0Jyk7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChNYXJrVW5oZWxwZnVsQWN0aW9uSWQsIGNvbnRleHQsIENoYXRBZ2VudFZvdGVEb3duUmVhc29uLldpbGxSZXBvcnRJc3N1ZSk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5pc3N1ZVNlcnZpY2Uub3BlblJlcG9ydGVyKHsgZXh0ZW5zaW9uSWQ6IGNvbnRleHQuYWdlbnQ/LmV4dGVuc2lvbklkLnZhbHVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XTtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLmVsZW1lbnQ/LmNsYXNzTGlzdC50b2dnbGUoJ2NoZWNrZWQnLCB0aGlzLmFjdGlvbi5jaGVja2VkKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Vm90ZURvd25EZXRhaWxBY3Rpb24ocmVhc29uOiBDaGF0QWdlbnRWb3RlRG93blJlYXNvbik6IElBY3Rpb24ge1xuXHRcdGNvbnN0IGxhYmVsID0gdm90ZURvd25EZXRhaWxMYWJlbHNbcmVhc29uXTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IE1hcmtVbmhlbHBmdWxBY3Rpb25JZCxcblx0XHRcdGxhYmVsLFxuXHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0Y2hlY2tlZDogKHRoaXMuX2NvbnRleHQgYXMgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCkudm90ZURvd25SZWFzb24gPT09IHJlYXNvbixcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRydW46IGFzeW5jIChjb250ZXh0OiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKSA9PiB7XG5cdFx0XHRcdGlmICghaXNSZXNwb25zZVZNKGNvbnRleHQpKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKCdDaGF0Vm90ZURvd25CdXR0b24jZ2V0Vm90ZURvd25EZXRhaWxBY3Rpb246IGludmFsaWQgY29udGV4dCcpO1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoTWFya1VuaGVscGZ1bEFjdGlvbklkLCBjb250ZXh0LCByZWFzb24pO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsa0NBQXNFO0FBQy9FLFNBQVMsK0JBQStCO0FBSXhDLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBc0I7QUFFL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxpQkFBOEIsU0FBUyxtQkFBbUIsb0JBQW9CO0FBQ25HLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTBDLDRCQUE0QjtBQUN0RSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFFBQVEsc0JBQXNCO0FBQ3ZDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXdCLHlCQUF5QixnQkFBK0Ysb0JBQWlIO0FBQzFRLFNBQXlJLGFBQWEsb0JBQW9CO0FBQzFLLFNBQVMsaUJBQWlCO0FB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QUFBQSxNQUMxRDtBQUFBLElBQUM7QUFYZ0M7QUFDTztBQUNYO0FBQUEsRUFVL0I7QUFBQSxFQUVBLGFBQWlDO0FBQ2hDLFdBQU87QUFBQSxNQUNOLEtBQUssd0JBQXdCLHdCQUF3QixhQUFhO0FBQUEsTUFDbEUsS0FBSyx3QkFBd0Isd0JBQXdCLHdCQUF3QjtBQUFBLE1BQzdFLEtBQUssd0JBQXdCLHdCQUF3QixjQUFjO0FBQUEsTUFDbkUsS0FBSyx3QkFBd0Isd0JBQXdCLGNBQWM7QUFBQSxNQUNuRSxLQUFLLHdCQUF3Qix3QkFBd0Isd0JBQXdCO0FBQUEsTUFDN0UsS0FBSyx3QkFBd0Isd0JBQXdCLG9CQUFvQjtBQUFBLE1BQ3pFLEtBQUssd0JBQXdCLHdCQUF3QixpQkFBaUI7QUFBQSxNQUN0RSxLQUFLLHdCQUF3Qix3QkFBd0IsS0FBSztBQUFBLE1BQzFEO0FBQUEsUUFDQyxJQUFJO0FBQUEsUUFDSixPQUFPLHFCQUFxQix3QkFBd0IsZUFBZTtBQUFBLFFBQ25FLFNBQVM7QUFBQSxRQUNULFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxRQUNQLEtBQUssT0FBTyxZQUFvQztBQUMvQyxjQUFJLENBQUMsYUFBYSxPQUFPLEdBQUc7QUFDM0IsaUJBQUssV0FBVyxNQUFNLHlDQUF5QztBQUMvRDtBQUFBLFVBQ0Q7QUFFQSxnQkFBTSxLQUFLLGVBQWUsZUFBZSx1QkFBdUIsU0FBUyx3QkFBd0IsZUFBZTtBQUNoSCxnQkFBTSxLQUFLLGFBQWEsYUFBYSxFQUFFLGFBQWEsUUFBUSxPQUFPLFlBQVksTUFBTSxDQUFDO0FBQUEsUUFDdkY7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVTLE9BQU8sV0FBOEI7QUFDN0MsVUFBTSxPQUFPLFNBQVM7QUFFdEIsU0FBSyxTQUFTLFVBQVUsT0FBTyxXQUFXLEtBQUssT0FBTyxPQUFPO0FBQUEsRUFDOUQ7QUFBQSxFQUVRLHdCQUF3QixRQUEwQztBQUN6RSxVQUFNLFFBQVEscUJBQXFCLE1BQU07QUFDekMsV0FBTztBQUFBLE1BQ04sSUFBSTtBQUFBLE1BQ0o7QUFBQSxNQUNBLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULFNBQVUsS0FBSyxTQUFvQyxtQkFBbUI7QUFBQSxNQUN0RSxPQUFPO0FBQUEsTUFDUCxLQUFLLE9BQU8sWUFBb0M7QUFDL0MsWUFBSSxDQUFDLGFBQWEsT0FBTyxHQUFHO0FBQzNCLGVBQUssV0FBVyxNQUFNLDZEQUE2RDtBQUNuRjtBQUFBLFFBQ0Q7QUFFQSxjQUFNLEtBQUssZUFBZSxlQUFlLHVCQUF1QixTQUFTLE1BQU07QUFBQSxNQUNoRjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUF4RWEscUJBQU47QUFBQSxFQUlKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FQVTsiLAogICJuYW1lcyI6IFsiUmF0ZSIsICJpbmRleCIsICJoZWlnaHQiLCAicGFydCIsICJjb2RlQmxvY2tzQnlSZXNwb25zZUlkIl0KfQo=
