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
import { disposableTimeout, timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { memoize } from "../../../../base/common/decorators.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { combinedDisposable, Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import { autorunWithStore, observableFromEvent, observableValue } from "../../../../base/common/observable.js";
import { extUri, isEqual } from "../../../../base/common/resources.js";
import { isDefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { localize } from "../../../../nls.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { bindContextKey } from "../../../../platform/observable/common/platformObservableUtils.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { buttonSecondaryBackground, buttonSecondaryForeground, buttonSecondaryHoverBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { asCssVariable } from "../../../../platform/theme/common/colorUtils.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { checkModeOption } from "../common/chat.js";
import { IChatAgentService, isChatWelcomeMessageContent } from "../common/chatAgents.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { applyingChatEditsFailedContextKey, decidedChatEditingResourceContextKey, hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey, IChatEditingService, inChatEditingSessionContextKey, WorkingSetEntryState } from "../common/chatEditingService.js";
import { ChatPauseState } from "../common/chatModel.js";
import { chatAgentLeader, ChatRequestAgentPart, chatSubcommandLeader, formatChatQuestion } from "../common/chatParserTypes.js";
import { ChatRequestParser } from "../common/chatRequestParser.js";
import { IChatService } from "../common/chatService.js";
import { IChatSlashCommandService } from "../common/chatSlashCommands.js";
import { ChatViewModel, isRequestVM, isResponseVM } from "../common/chatViewModel.js";
import { CodeBlockModelCollection } from "../common/codeBlockModelCollection.js";
import { ChatAgentLocation, ChatConfiguration, ChatMode } from "../common/constants.js";
import { IChatAccessibilityService, IChatWidgetService } from "./chat.js";
import { ChatAccessibilityProvider } from "./chatAccessibilityProvider.js";
import { ChatInputPart } from "./chatInputPart.js";
import { ChatListDelegate, ChatListItemRenderer } from "./chatListRenderer.js";
import { ChatEditorOptions } from "./chatOptions.js";
import "./media/chat.css";
import "./media/chatAgentHover.css";
import "./media/chatViewWelcome.css";
import { ChatViewWelcomePart } from "./viewsWelcome/chatViewWelcomeController.js";
const $ = dom.$;
function isQuickChat(widget) {
  return "viewContext" in widget && "isQuickChat" in widget.viewContext && Boolean(widget.viewContext.isQuickChat);
}
const PersistWelcomeMessageContentKey = "chat.welcomeMessageContent";
let ChatWidget = class extends Disposable {
  constructor(location, _viewContext, viewOptions, styles, codeEditorService, configurationService, contextKeyService, instantiationService, chatService, chatAgentService, chatWidgetService, contextMenuService, chatAccessibilityService, logService, themeService, chatSlashCommandService, chatEditingService, storageService, telemetryService) {
    super();
    this.viewOptions = viewOptions;
    this.styles = styles;
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    this.instantiationService = instantiationService;
    this.chatService = chatService;
    this.chatAgentService = chatAgentService;
    this.chatWidgetService = chatWidgetService;
    this.contextMenuService = contextMenuService;
    this.chatAccessibilityService = chatAccessibilityService;
    this.logService = logService;
    this.themeService = themeService;
    this.chatSlashCommandService = chatSlashCommandService;
    this.storageService = storageService;
    this.telemetryService = telemetryService;
    this._onDidSubmitAgent = this._register(new Emitter());
    this.onDidSubmitAgent = this._onDidSubmitAgent.event;
    this._onDidChangeAgent = this._register(new Emitter());
    this.onDidChangeAgent = this._onDidChangeAgent.event;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidChangeViewModel = this._register(new Emitter());
    this.onDidChangeViewModel = this._onDidChangeViewModel.event;
    this._onDidScroll = this._register(new Emitter());
    this.onDidScroll = this._onDidScroll.event;
    this._onDidClear = this._register(new Emitter());
    this.onDidClear = this._onDidClear.event;
    this._onDidAcceptInput = this._register(new Emitter());
    this.onDidAcceptInput = this._onDidAcceptInput.event;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._onDidChangeParsedInput = this._register(new Emitter());
    this.onDidChangeParsedInput = this._onDidChangeParsedInput.event;
    this._onWillMaybeChangeHeight = new Emitter();
    this.onWillMaybeChangeHeight = this._onWillMaybeChangeHeight.event;
    this._onDidChangeHeight = this._register(new Emitter());
    this.onDidChangeHeight = this._onDidChangeHeight.event;
    this._onDidChangeContentHeight = new Emitter();
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this.contribs = [];
    this.welcomePart = this._register(new MutableDisposable());
    this.visibleChangeCount = 0;
    this._visible = false;
    this.previousTreeScrollHeight = 0;
    /**
     * Whether the list is scroll-locked to the bottom. Initialize to true so that we can scroll to the bottom on first render.
     * The initial render leads to a lot of `onDidChangeTreeContentHeight` as the renderer works out the real heights of rows.
     */
    this.scrollLock = true;
    this.viewModelDisposables = this._register(new DisposableStore());
    this._editingSession = observableValue(this, void 0);
    this.viewContext = _viewContext ?? {};
    const viewModelObs = observableFromEvent(this, this.onDidChangeViewModel, () => this.viewModel);
    if (typeof location === "object") {
      this._location = location;
    } else {
      this._location = { location };
    }
    ChatContextKeys.inChatSession.bindTo(contextKeyService).set(true);
    ChatContextKeys.location.bindTo(contextKeyService).set(this._location.location);
    ChatContextKeys.inQuickChat.bindTo(contextKeyService).set(isQuickChat(this));
    ChatContextKeys.inUnifiedChat.bindTo(contextKeyService).set(this._location.location === ChatAgentLocation.Panel && !!this.viewOptions.supportsChangingModes && this.configurationService.getValue(ChatConfiguration.UnifiedChatView));
    this.agentInInput = ChatContextKeys.inputHasAgent.bindTo(contextKeyService);
    this.requestInProgress = ChatContextKeys.requestInProgress.bindTo(contextKeyService);
    this.isRequestPaused = ChatContextKeys.isRequestPaused.bindTo(contextKeyService);
    this.canRequestBePaused = ChatContextKeys.canRequestBePaused.bindTo(contextKeyService);
    this._register(bindContextKey(decidedChatEditingResourceContextKey, contextKeyService, (reader) => {
      const currentSession = this._editingSession.read(reader);
      if (!currentSession) {
        return;
      }
      const entries = currentSession.entries.read(reader);
      const decidedEntries = entries.filter((entry) => entry.state.read(reader) !== WorkingSetEntryState.Modified);
      return decidedEntries.map((entry) => entry.entryId);
    }));
    this._register(bindContextKey(hasUndecidedChatEditingResourceContextKey, contextKeyService, (reader) => {
      const currentSession = this._editingSession.read(reader);
      const entries = currentSession?.entries.read(reader) ?? [];
      const decidedEntries = entries.filter((entry) => entry.state.read(reader) === WorkingSetEntryState.Modified);
      return decidedEntries.length > 0;
    }));
    this._register(bindContextKey(hasAppliedChatEditsContextKey, contextKeyService, (reader) => {
      const currentSession = this._editingSession.read(reader);
      if (!currentSession) {
        return false;
      }
      const entries = currentSession.entries.read(reader);
      return entries.length > 0;
    }));
    this._register(bindContextKey(inChatEditingSessionContextKey, contextKeyService, (reader) => {
      return this._editingSession.read(reader) !== null;
    }));
    this._register(bindContextKey(ChatContextKeys.chatEditingCanUndo, contextKeyService, (r) => {
      return this._editingSession.read(r)?.canUndo.read(r) || false;
    }));
    this._register(bindContextKey(ChatContextKeys.chatEditingCanRedo, contextKeyService, (r) => {
      return this._editingSession.read(r)?.canRedo.read(r) || false;
    }));
    this._register(bindContextKey(applyingChatEditsFailedContextKey, contextKeyService, (r) => {
      const chatModel = viewModelObs.read(r)?.model;
      const editingSession = this._editingSession.read(r);
      if (!editingSession || !chatModel) {
        return false;
      }
      const lastResponse = observableFromEvent(this, chatModel.onDidChange, () => chatModel.getRequests().at(-1)?.response).read(r);
      return lastResponse?.result?.errorDetails && !lastResponse?.result?.errorDetails.responseIsIncomplete;
    }));
    this._codeBlockModelCollection = this._register(instantiationService.createInstance(CodeBlockModelCollection, void 0));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("chat.renderRelatedFiles")) {
        this.renderChatEditingSessionState();
      }
    }));
    this._register(autorunWithStore((r, store) => {
      const viewModel = viewModelObs.read(r);
      const sessions = chatEditingService.editingSessionsObs.read(r);
      const session = sessions.find((candidate) => candidate.chatSessionId === viewModel?.sessionId);
      this._editingSession.set(void 0, void 0);
      this.renderChatEditingSessionState();
      if (!session) {
        return;
      }
      this._editingSession.set(session, void 0);
      store.add(session.onDidChange(() => {
        this.renderChatEditingSessionState();
      }));
      store.add(session.onDidDispose(() => {
        this._editingSession.set(void 0, void 0);
        this.renderChatEditingSessionState();
      }));
      store.add(this.onDidChangeParsedInput(() => {
        this.renderChatEditingSessionState();
      }));
      store.add(this.inputEditor.onDidChangeModelContent(() => {
        if (this.getInput() === "") {
          this.refreshParsedInput();
          this.renderChatEditingSessionState();
        }
      }));
      this.renderChatEditingSessionState();
    }));
    this._register(codeEditorService.registerCodeEditorOpenHandler(async (input, _source, _sideBySide) => {
      const resource = input.resource;
      if (resource.scheme !== Schemas.vscodeChatCodeBlock) {
        return null;
      }
      const responseId = resource.path.split("/").at(1);
      if (!responseId) {
        return null;
      }
      const item = this.viewModel?.getItems().find((item2) => item2.id === responseId);
      if (!item) {
        return null;
      }
      this.reveal(item);
      await timeout(0);
      for (const codeBlockPart of this.renderer.editorsInUse()) {
        if (extUri.isEqual(codeBlockPart.uri, resource, true)) {
          const editor = codeBlockPart.editor;
          let relativeTop = 0;
          const editorDomNode = editor.getDomNode();
          if (editorDomNode) {
            const row = dom.findParentWithClass(editorDomNode, "monaco-list-row");
            if (row) {
              relativeTop = dom.getTopLeftOffset(editorDomNode).top - dom.getTopLeftOffset(row).top;
            }
          }
          if (input.options?.selection) {
            const editorSelectionTopOffset = editor.getTopForPosition(input.options.selection.startLineNumber, input.options.selection.startColumn);
            relativeTop += editorSelectionTopOffset;
            editor.focus();
            editor.setSelection({
              startLineNumber: input.options.selection.startLineNumber,
              startColumn: input.options.selection.startColumn,
              endLineNumber: input.options.selection.endLineNumber ?? input.options.selection.startLineNumber,
              endColumn: input.options.selection.endColumn ?? input.options.selection.startColumn
            });
          }
          this.reveal(item, relativeTop);
          return editor;
        }
      }
      return null;
    }));
    const loadedWelcomeContent = storageService.getObject(`${PersistWelcomeMessageContentKey}.${this.location}`, StorageScope.APPLICATION);
    if (isChatWelcomeMessageContent(loadedWelcomeContent)) {
      this.persistedWelcomeMessage = loadedWelcomeContent;
    }
    this._register(this.onDidChangeParsedInput(() => this.updateChatInputContext()));
  }
  get visible() {
    return this._visible;
  }
  set viewModel(viewModel) {
    if (this._viewModel === viewModel) {
      return;
    }
    this.viewModelDisposables.clear();
    this._viewModel = viewModel;
    if (viewModel) {
      this.viewModelDisposables.add(viewModel);
    }
    this._onDidChangeViewModel.fire();
  }
  get viewModel() {
    return this._viewModel;
  }
  get parsedInput() {
    if (this.parsedChatRequest === void 0) {
      if (!this.viewModel) {
        return { text: "", parts: [] };
      }
      this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(this.viewModel.sessionId, this.getInput(), this.location, { selectedAgent: this._lastSelectedAgent, mode: this.input.currentMode });
    }
    return this.parsedChatRequest;
  }
  get scopedContextKeyService() {
    return this.contextKeyService;
  }
  get location() {
    return this._location.location;
  }
  get isUnifiedPanelWidget() {
    return this._location.location === ChatAgentLocation.Panel && !!this.viewOptions.supportsChangingModes && this.configurationService.getValue(ChatConfiguration.UnifiedChatView);
  }
  set lastSelectedAgent(agent) {
    this.parsedChatRequest = void 0;
    this._lastSelectedAgent = agent;
    this._onDidChangeParsedInput.fire();
  }
  get lastSelectedAgent() {
    return this._lastSelectedAgent;
  }
  get supportsFileReferences() {
    return !!this.viewOptions.supportsFileReferences;
  }
  get input() {
    return this.inputPart;
  }
  get inputEditor() {
    return this.inputPart.inputEditor;
  }
  get inputUri() {
    return this.inputPart.inputUri;
  }
  get contentHeight() {
    return this.inputPart.contentHeight + this.tree.contentHeight;
  }
  get attachmentModel() {
    return this.inputPart.attachmentModel;
  }
  render(parent) {
    const viewId = "viewId" in this.viewContext ? this.viewContext.viewId : void 0;
    this.editorOptions = this._register(this.instantiationService.createInstance(ChatEditorOptions, viewId, this.styles.listForeground, this.styles.inputEditorBackground, this.styles.resultEditorBackground));
    const renderInputOnTop = this.viewOptions.renderInputOnTop ?? false;
    const renderFollowups = this.viewOptions.renderFollowups ?? !renderInputOnTop;
    const renderStyle = this.viewOptions.renderStyle;
    this.container = dom.append(parent, $(".interactive-session"));
    this.welcomeMessageContainer = dom.append(this.container, $(".chat-welcome-view-container", { style: "display: none" }));
    if (renderInputOnTop) {
      this.createInput(this.container, { renderFollowups, renderStyle });
      this.listContainer = dom.append(this.container, $(`.interactive-list`));
    } else {
      this.listContainer = dom.append(this.container, $(`.interactive-list`));
      this.createInput(this.container, { renderFollowups, renderStyle });
    }
    this.renderWelcomeViewContentIfNeeded();
    this.createList(this.listContainer, { ...this.viewOptions.rendererOptions, renderStyle });
    const scrollDownButton = this._register(new Button(this.listContainer, {
      supportIcons: true,
      buttonBackground: asCssVariable(buttonSecondaryBackground),
      buttonForeground: asCssVariable(buttonSecondaryForeground),
      buttonHoverBackground: asCssVariable(buttonSecondaryHoverBackground)
    }));
    scrollDownButton.element.classList.add("chat-scroll-down");
    scrollDownButton.label = `$(${Codicon.chevronDown.id})`;
    scrollDownButton.setTitle(localize("scrollDownButtonLabel", "Scroll down"));
    this._register(scrollDownButton.onDidClick(() => {
      this.scrollLock = true;
      this.scrollToEnd();
    }));
    this._register(this.editorOptions.onDidChange(() => this.onDidStyleChange()));
    this.onDidStyleChange();
    if (this.viewModel) {
      this.onDidChangeItems();
      this.scrollToEnd();
    }
    this.contribs = ChatWidget.CONTRIBS.map((contrib) => {
      try {
        return this._register(this.instantiationService.createInstance(contrib, this));
      } catch (err) {
        this.logService.error("Failed to instantiate chat widget contrib", toErrorMessage(err));
        return void 0;
      }
    }).filter(isDefined);
    this._register(this.chatWidgetService.register(this));
  }
  scrollToEnd() {
    if (this.lastItem) {
      const offset = Math.max(this.lastItem.currentRenderedHeight ?? 0, 1e6);
      this.tree.reveal(this.lastItem, offset);
    }
  }
  getContrib(id) {
    return this.contribs.find((c) => c.id === id);
  }
  focusInput() {
    this.inputPart.focus();
    this._onDidFocus.fire();
  }
  hasInputFocus() {
    return this.inputPart.hasFocus();
  }
  refreshParsedInput() {
    if (!this.viewModel) {
      return;
    }
    this.parsedChatRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(this.viewModel.sessionId, this.getInput(), this.location, { selectedAgent: this._lastSelectedAgent, mode: this.input.currentMode });
    this._onDidChangeParsedInput.fire();
  }
  getSibling(item, type) {
    if (!isResponseVM(item)) {
      return;
    }
    const items = this.viewModel?.getItems();
    if (!items) {
      return;
    }
    const responseItems = items.filter((i) => isResponseVM(i));
    const targetIndex = responseItems.indexOf(item);
    if (targetIndex === void 0) {
      return;
    }
    const indexToFocus = type === "next" ? targetIndex + 1 : targetIndex - 1;
    if (indexToFocus < 0 || indexToFocus > responseItems.length - 1) {
      return;
    }
    return responseItems[indexToFocus];
  }
  clear() {
    if (this._dynamicMessageLayoutData) {
      this._dynamicMessageLayoutData.enabled = true;
    }
    this._onDidClear.fire();
  }
  onDidChangeItems(skipDynamicLayout) {
    if (this._visible || !this.viewModel) {
      const treeItems = (this.viewModel?.getItems() ?? []).map((item) => {
        return {
          element: item,
          collapsed: false,
          collapsible: false
        };
      });
      this.renderWelcomeViewContentIfNeeded();
      this._onWillMaybeChangeHeight.fire();
      this.lastItem = treeItems.at(-1)?.element;
      ChatContextKeys.lastItemId.bindTo(this.contextKeyService).set(this.lastItem ? [this.lastItem.id] : []);
      this.tree.setChildren(null, treeItems, {
        diffIdentityProvider: {
          getId: (element) => {
            return element.dataId + // Ensure re-rendering an element once slash commands are loaded, so the colorization can be applied.
            `${isRequestVM(element)}${isResponseVM(element) && element.renderData ? `_${this.visibleChangeCount}` : ""}` + // Re-render once content references are loaded
            (isResponseVM(element) ? `_${element.contentReferences.length}` : "") + // Re-render if element becomes hidden due to undo/redo
            `_${element.shouldBeRemovedOnSend ? `${element.shouldBeRemovedOnSend.afterUndoStop || "1"}` : "0"}` + // Rerender request if we got new content references in the response
            // since this may change how we render the corresponding attachments in the request
            (isRequestVM(element) && element.contentReferences ? `_${element.contentReferences?.length}` : "") + (isResponseVM(element) && element.model.isPaused.get() ? "_paused" : "");
          }
        }
      });
      if (!skipDynamicLayout && this._dynamicMessageLayoutData) {
        this.layoutDynamicChatTreeItemMode();
      }
      if (this.lastItem && isResponseVM(this.lastItem) && this.lastItem.isComplete) {
        this.renderFollowups(this.lastItem.replyFollowups, this.lastItem);
      } else if (!treeItems.length && this.viewModel) {
        this.renderSampleQuestions();
      } else {
        this.renderFollowups(void 0);
      }
    }
  }
  renderWelcomeViewContentIfNeeded() {
    if (this.viewOptions.renderStyle === "compact" || this.viewOptions.renderStyle === "minimal") {
      return;
    }
    const numItems = this.viewModel?.getItems().length ?? 0;
    const defaultAgent = this.chatAgentService.getDefaultAgent(this.location, this.input.currentMode);
    const welcomeContent = defaultAgent?.metadata.welcomeMessageContent ?? this.persistedWelcomeMessage;
    if (welcomeContent && !numItems && (this.welcomeMessageContainer.children.length === 0 || this.chatService.unifiedViewEnabled)) {
      dom.clearNode(this.welcomeMessageContainer);
      const tips = this.viewOptions.supportsAdditionalParticipants ? new MarkdownString(localize("chatWidget.tips", "{0} or type {1} to attach context\n\n{2} to chat with extensions\n\nType {3} to use commands", "$(attach)", "#", "$(mention)", "/"), { supportThemeIcons: true }) : new MarkdownString(localize("chatWidget.tips.withoutParticipants", "{0} or type {1} to attach context", "$(attach)", "#"), { supportThemeIcons: true });
      this.welcomePart.value = this.instantiationService.createInstance(
        ChatViewWelcomePart,
        { ...welcomeContent, tips },
        {
          location: this.location,
          isWidgetAgentWelcomeViewContent: this.input?.currentMode === ChatMode.Agent
        }
      );
      dom.append(this.welcomeMessageContainer, this.welcomePart.value.element);
    }
    if (this.viewModel) {
      dom.setVisibility(numItems === 0, this.welcomeMessageContainer);
      dom.setVisibility(numItems !== 0, this.listContainer);
    }
  }
  async renderChatEditingSessionState() {
    if (!this.inputPart) {
      return;
    }
    this.inputPart.renderChatEditingSessionState(this._editingSession.get() ?? null);
    if (this.bodyDimension) {
      this.layout(this.bodyDimension.height, this.bodyDimension.width);
    }
  }
  renderSampleQuestions() {
    if (this.viewModel?.getItems().length === 0) {
      this.renderFollowups(this.input.currentMode === ChatMode.Ask ? this.viewModel.model.sampleQuestions : void 0);
    }
  }
  async renderFollowups(items, response) {
    this.inputPart.renderFollowups(items, response);
    if (this.bodyDimension) {
      this.layout(this.bodyDimension.height, this.bodyDimension.width);
    }
  }
  setVisible(visible) {
    const wasVisible = this._visible;
    this._visible = visible;
    this.visibleChangeCount++;
    this.renderer.setVisible(visible);
    this.input.setVisible(visible);
    if (visible) {
      this._register(disposableTimeout(() => {
        if (this._visible) {
          this.onDidChangeItems(true);
        }
      }, 0));
    } else if (wasVisible) {
      this._onDidHide.fire();
    }
  }
  createList(listContainer, options) {
    const scopedInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.contextKeyService])));
    const delegate = scopedInstantiationService.createInstance(ChatListDelegate, this.viewOptions.defaultElementHeight ?? 200);
    const rendererDelegate = {
      getListLength: () => this.tree.getNode(null).visibleChildrenCount,
      onDidScroll: this.onDidScroll,
      container: listContainer,
      currentChatMode: () => this.input.currentMode
    };
    const overflowWidgetsContainer = document.createElement("div");
    overflowWidgetsContainer.classList.add("chat-overflow-widget-container", "monaco-editor");
    listContainer.append(overflowWidgetsContainer);
    this.renderer = this._register(scopedInstantiationService.createInstance(
      ChatListItemRenderer,
      this.editorOptions,
      options,
      rendererDelegate,
      this._codeBlockModelCollection,
      overflowWidgetsContainer
    ));
    this._register(this.renderer.onDidClickFollowup((item) => {
      this.acceptInput(item.message);
    }));
    this._register(this.renderer.onDidClickRerunWithAgentOrCommandDetection((item) => {
      const request = this.chatService.getSession(item.sessionId)?.getRequests().find((candidate) => candidate.id === item.requestId);
      if (request) {
        const options2 = {
          noCommandDetection: true,
          attempt: request.attempt + 1,
          location: this.location,
          userSelectedModelId: this.input.currentLanguageModel,
          hasInstructionAttachments: this.input.hasInstructionAttachments,
          mode: this.input.currentMode
        };
        this.chatService.resendRequest(request, options2).catch((e) => this.logService.error("FAILED to rerun request", e));
      }
    }));
    this.tree = this._register(scopedInstantiationService.createInstance(
      WorkbenchObjectTree,
      "Chat",
      listContainer,
      delegate,
      [this.renderer],
      {
        identityProvider: { getId: (e) => e.id },
        horizontalScrolling: false,
        alwaysConsumeMouseWheel: false,
        supportDynamicHeights: true,
        hideTwistiesOfChildlessElements: true,
        accessibilityProvider: this.instantiationService.createInstance(ChatAccessibilityProvider),
        keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (e) => isRequestVM(e) ? e.message : isResponseVM(e) ? e.response.value : "" },
        // TODO
        setRowLineHeight: false,
        filter: this.viewOptions.filter ? { filter: this.viewOptions.filter.bind(this.viewOptions) } : void 0,
        scrollToActiveElement: true,
        overrideStyles: {
          listFocusBackground: this.styles.listBackground,
          listInactiveFocusBackground: this.styles.listBackground,
          listActiveSelectionBackground: this.styles.listBackground,
          listFocusAndSelectionBackground: this.styles.listBackground,
          listInactiveSelectionBackground: this.styles.listBackground,
          listHoverBackground: this.styles.listBackground,
          listBackground: this.styles.listBackground,
          listFocusForeground: this.styles.listForeground,
          listHoverForeground: this.styles.listForeground,
          listInactiveFocusForeground: this.styles.listForeground,
          listInactiveSelectionForeground: this.styles.listForeground,
          listActiveSelectionForeground: this.styles.listForeground,
          listFocusAndSelectionForeground: this.styles.listForeground,
          listActiveSelectionIconForeground: void 0,
          listInactiveSelectionIconForeground: void 0
        }
      }
    ));
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    this._register(this.tree.onDidChangeContentHeight(() => {
      this.onDidChangeTreeContentHeight();
    }));
    this._register(this.renderer.onDidChangeItemHeight((e) => {
      this.tree.updateElementHeight(e.element, e.height);
    }));
    this._register(this.tree.onDidFocus(() => {
      this._onDidFocus.fire();
    }));
    this._register(this.tree.onDidScroll(() => {
      this._onDidScroll.fire();
      const isScrolledDown = this.tree.scrollTop >= this.tree.scrollHeight - this.tree.renderHeight - 2;
      this.container.classList.toggle("show-scroll-down", !isScrolledDown && !this.scrollLock);
    }));
  }
  onContextMenu(e) {
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
    const selected = e.element;
    const scopedContextKeyService = this.contextKeyService.createOverlay([
      [ChatContextKeys.responseIsFiltered.key, isResponseVM(selected) && !!selected.errorDetails?.responseIsFiltered]
    ]);
    this.contextMenuService.showContextMenu({
      menuId: MenuId.ChatContext,
      menuActionOptions: { shouldForwardArgs: true },
      contextKeyService: scopedContextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => selected
    });
  }
  onDidChangeTreeContentHeight() {
    if (this.tree.scrollHeight !== this.previousTreeScrollHeight) {
      const lastItem = this.viewModel?.getItems().at(-1);
      const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
      if (!lastResponseIsRendering || this.scrollLock) {
        const lastElementWasVisible = this.tree.scrollTop + this.tree.renderHeight >= this.previousTreeScrollHeight - 2;
        if (lastElementWasVisible) {
          dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
            this.scrollToEnd();
          }, 0);
        }
      }
    }
    this.previousTreeScrollHeight = this.tree.scrollHeight;
    this._onDidChangeContentHeight.fire();
  }
  getWidgetViewKindTag() {
    if (!this.viewContext) {
      return "editor";
    } else if ("viewId" in this.viewContext) {
      return "view";
    } else {
      return "quick";
    }
  }
  createInput(container, options) {
    this.inputPart = this._register(this.instantiationService.createInstance(
      ChatInputPart,
      this.location,
      {
        renderFollowups: options?.renderFollowups ?? true,
        renderStyle: options?.renderStyle === "minimal" ? "compact" : options?.renderStyle,
        menus: { executeToolbar: MenuId.ChatExecute, ...this.viewOptions.menus },
        editorOverflowWidgetsDomNode: this.viewOptions.editorOverflowWidgetsDomNode,
        enableImplicitContext: this.viewOptions.enableImplicitContext,
        renderWorkingSet: this.viewOptions.enableWorkingSet === "explicit",
        supportsChangingModes: this.viewOptions.supportsChangingModes,
        widgetViewKindTag: this.getWidgetViewKindTag()
      },
      this.styles,
      () => this.collectInputState()
    ));
    this.inputPart.render(container, "", this);
    this._register(this.inputPart.onDidLoadInputState((state) => {
      this.contribs.forEach((c) => {
        if (c.setInputState) {
          const contribState = (typeof state === "object" && state?.[c.id]) ?? {};
          c.setInputState(contribState);
        }
      });
      this.refreshParsedInput();
    }));
    this._register(this.inputPart.onDidFocus(() => this._onDidFocus.fire()));
    this._register(this.inputPart.onDidAcceptFollowup((e) => {
      if (!this.viewModel) {
        return;
      }
      let msg = "";
      if (e.followup.agentId && e.followup.agentId !== this.chatAgentService.getDefaultAgent(this.location, this.input.currentMode)?.id) {
        const agent = this.chatAgentService.getAgent(e.followup.agentId);
        if (!agent) {
          return;
        }
        this.lastSelectedAgent = agent;
        msg = `${chatAgentLeader}${agent.name} `;
        if (e.followup.subCommand) {
          msg += `${chatSubcommandLeader}${e.followup.subCommand} `;
        }
      } else if (!e.followup.agentId && e.followup.subCommand && this.chatSlashCommandService.hasCommand(e.followup.subCommand)) {
        msg = `${chatSubcommandLeader}${e.followup.subCommand} `;
      }
      msg += e.followup.message;
      this.acceptInput(msg);
      if (!e.response) {
        return;
      }
      this.chatService.notifyUserAction({
        sessionId: this.viewModel.sessionId,
        requestId: e.response.requestId,
        agentId: e.response.agent?.id,
        command: e.response.slashCommand?.name,
        result: e.response.result,
        action: {
          kind: "followUp",
          followup: e.followup
        }
      });
    }));
    this._register(this.inputPart.onDidChangeHeight(() => {
      if (this.bodyDimension) {
        this.layout(this.bodyDimension.height, this.bodyDimension.width);
      }
      this._onDidChangeContentHeight.fire();
    }));
    this._register(this.inputPart.attachmentModel.onDidChangeContext(() => {
      if (this._editingSession) {
        this.renderChatEditingSessionState();
      }
    }));
    this._register(this.inputEditor.onDidChangeModelContent(() => {
      this.parsedChatRequest = void 0;
      this.updateChatInputContext();
    }));
    this._register(this.chatAgentService.onDidChangeAgents(() => {
      this.parsedChatRequest = void 0;
      this.renderWelcomeViewContentIfNeeded();
    }));
    this._register(this.input.onDidChangeCurrentChatMode(() => {
      this.renderSampleQuestions();
      this.renderWelcomeViewContentIfNeeded();
      this.refreshParsedInput();
    }));
  }
  onDidStyleChange() {
    this.container.style.setProperty("--vscode-interactive-result-editor-background-color", this.editorOptions.configuration.resultEditor.backgroundColor?.toString() ?? "");
    this.container.style.setProperty("--vscode-interactive-session-foreground", this.editorOptions.configuration.foreground?.toString() ?? "");
    this.container.style.setProperty("--vscode-chat-list-background", this.themeService.getColorTheme().getColor(this.styles.listBackground)?.toString() ?? "");
  }
  togglePaused() {
    this.viewModel?.model.toggleLastRequestPaused();
    this.onDidChangeItems();
  }
  setModel(model, viewState) {
    if (!this.container) {
      throw new Error("Call render() before setModel()");
    }
    if (model.sessionId === this.viewModel?.sessionId) {
      return;
    }
    this._codeBlockModelCollection.clear();
    this.container.setAttribute("data-session-id", model.sessionId);
    this.viewModel = this.instantiationService.createInstance(ChatViewModel, model, this._codeBlockModelCollection);
    this.viewModelDisposables.add(Event.accumulate(this.viewModel.onDidChange, 0)((events) => {
      if (!this.viewModel) {
        return;
      }
      this.requestInProgress.set(this.viewModel.requestInProgress);
      this.isRequestPaused.set(this.viewModel.requestPausibility === ChatPauseState.Paused);
      this.canRequestBePaused.set(this.viewModel.requestPausibility !== ChatPauseState.NotPausable);
      this.onDidChangeItems();
      if (events.some((e) => e?.kind === "addRequest") && this.visible) {
        this.scrollToEnd();
      }
      if (this._editingSession) {
        this.renderChatEditingSessionState();
      }
    }));
    this.viewModelDisposables.add(this.viewModel.onDidDisposeModel(() => {
      this.inputPart.saveState();
      this.viewModel = void 0;
      this.onDidChangeItems();
    }));
    this.inputPart.initForNewChatModel(viewState, model.getRequests().length === 0);
    this.contribs.forEach((c) => {
      if (c.setInputState && viewState.inputState?.[c.id]) {
        c.setInputState(viewState.inputState?.[c.id]);
      }
    });
    this.refreshParsedInput();
    this.viewModelDisposables.add(model.onDidChange((e) => {
      if (e.kind === "setAgent") {
        this._onDidChangeAgent.fire({ agent: e.agent, slashCommand: e.command });
      }
    }));
    if (this.tree && this.visible) {
      this.onDidChangeItems();
      this.scrollToEnd();
    }
    this.updateChatInputContext();
  }
  getFocus() {
    return this.tree.getFocus()[0] ?? void 0;
  }
  reveal(item, relativeTop) {
    this.tree.reveal(item, relativeTop);
  }
  focus(item) {
    const items = this.tree.getNode(null).children;
    const node = items.find((i) => i.element?.id === item.id);
    if (!node) {
      return;
    }
    this.tree.setFocus([node.element]);
    this.tree.domFocus();
  }
  refilter() {
    this.tree.refilter();
  }
  setInputPlaceholder(placeholder) {
    this.viewModel?.setInputPlaceholder(placeholder);
  }
  resetInputPlaceholder() {
    this.viewModel?.resetInputPlaceholder();
  }
  setInput(value = "") {
    this.inputPart.setValue(value, false);
    this.refreshParsedInput();
  }
  getInput() {
    return this.inputPart.inputEditor.getValue();
  }
  logInputHistory() {
    this.inputPart.logInputHistory();
  }
  async acceptInput(query, options) {
    return this._acceptInput(query ? { query } : void 0, options);
  }
  async rerunLastRequest() {
    if (!this.viewModel) {
      return;
    }
    const sessionId = this.viewModel.sessionId;
    const lastRequest = this.chatService.getSession(sessionId)?.getRequests().at(-1);
    if (!lastRequest) {
      return;
    }
    const options = {
      attempt: lastRequest.attempt + 1,
      location: this.location,
      userSelectedModelId: this.input.currentLanguageModel
    };
    return await this.chatService.resendRequest(lastRequest, options);
  }
  collectInputState() {
    const inputState = {};
    this.contribs.forEach((c) => {
      if (c.getInputState) {
        inputState[c.id] = c.getInputState();
      }
    });
    return inputState;
  }
  async _acceptInput(query, options) {
    if (this.viewModel?.requestInProgress && this.viewModel.requestPausibility !== ChatPauseState.Paused) {
      return;
    }
    if (this.viewModel) {
      this._onDidAcceptInput.fire();
      this.scrollLock = !!checkModeOption(this.input.currentMode, this.viewOptions.autoScroll);
      const editorValue = this.getInput();
      const requestId = this.chatAccessibilityService.acceptRequest();
      const input = !query ? editorValue : query.query;
      const isUserQuery = !query;
      const { promptInstructions } = this.inputPart.attachmentModel;
      const instructionsEnabled = promptInstructions.featureEnabled;
      if (instructionsEnabled) {
        const instructionsStarted = performance.now();
        await promptInstructions.allSettled();
        this.logService.trace(`[\u23F1] instructions tree resolved in ${performance.now() - instructionsStarted}ms`);
      }
      let attachedContext = this.inputPart.getAttachedAndImplicitContext(this.viewModel.sessionId);
      if (this.viewOptions.enableWorkingSet !== void 0 && this.input.currentMode !== ChatMode.Ask) {
        const uniqueWorkingSetEntries = new ResourceSet();
        const editingSessionAttachedContext = attachedContext;
        const previousRequests = this.viewModel.model.getRequests();
        for (const request of previousRequests) {
          for (const variable of request.variableData.variables) {
            if (URI.isUri(variable.value) && variable.isFile) {
              const uri = variable.value;
              if (!uniqueWorkingSetEntries.has(uri)) {
                editingSessionAttachedContext.push(variable);
                uniqueWorkingSetEntries.add(variable.value);
              }
            }
          }
        }
        attachedContext = editingSessionAttachedContext;
        this.telemetryService.publicLog2("chatEditing/workingSetSize", { originalSize: uniqueWorkingSetEntries.size, actualSize: uniqueWorkingSetEntries.size });
      }
      this.chatService.cancelCurrentRequestForSession(this.viewModel.sessionId);
      this.input.validateCurrentMode();
      const result = await this.chatService.sendRequest(this.viewModel.sessionId, input, {
        mode: this.inputPart.currentMode,
        userSelectedModelId: this.inputPart.currentLanguageModel,
        location: this.location,
        locationData: this._location.resolveData?.(),
        parserContext: { selectedAgent: this._lastSelectedAgent, mode: this.inputPart.currentMode },
        attachedContext,
        noCommandDetection: options?.noCommandDetection,
        hasInstructionAttachments: this.inputPart.hasInstructionAttachments,
        userSelectedTools: this.input.currentMode === ChatMode.Agent ? this.inputPart.selectedToolsModel.tools.get().map((tool) => tool.id) : void 0
      });
      if (result) {
        this.inputPart.acceptInput(isUserQuery);
        this._onDidSubmitAgent.fire({ agent: result.agent, slashCommand: result.slashCommand });
        result.responseCompletePromise.then(() => {
          const responses = this.viewModel?.getItems().filter(isResponseVM);
          const lastResponse = responses?.[responses.length - 1];
          this.chatAccessibilityService.acceptResponse(lastResponse, requestId, options?.isVoiceInput);
          if (lastResponse?.result?.nextQuestion) {
            const { prompt, participant, command } = lastResponse.result.nextQuestion;
            const question = formatChatQuestion(this.chatAgentService, this.location, prompt, participant, command);
            if (question) {
              this.input.setValue(question, false);
            }
          }
        });
        return result.responseCreatedPromise;
      }
    }
    return void 0;
  }
  getCodeBlockInfosForResponse(response) {
    return this.renderer.getCodeBlockInfosForResponse(response);
  }
  getCodeBlockInfoForEditor(uri) {
    return this.renderer.getCodeBlockInfoForEditor(uri);
  }
  getFileTreeInfosForResponse(response) {
    return this.renderer.getFileTreeInfosForResponse(response);
  }
  getLastFocusedFileTreeForResponse(response) {
    return this.renderer.getLastFocusedFileTreeForResponse(response);
  }
  focusLastMessage() {
    if (!this.viewModel) {
      return;
    }
    const items = this.tree.getNode(null).children;
    const lastItem = items[items.length - 1];
    if (!lastItem) {
      return;
    }
    this.tree.setFocus([lastItem.element]);
    this.tree.domFocus();
  }
  layout(height, width) {
    width = Math.min(width, 850);
    this.bodyDimension = new dom.Dimension(width, height);
    const inputPartMaxHeight = this._dynamicMessageLayoutData?.enabled ? this._dynamicMessageLayoutData.maxHeight : height;
    this.inputPart.layout(inputPartMaxHeight, width);
    const inputPartHeight = this.inputPart.inputPartHeight;
    const lastElementVisible = this.tree.scrollTop + this.tree.renderHeight >= this.tree.scrollHeight - 2;
    const listHeight = Math.max(0, height - inputPartHeight);
    if (this.viewOptions.renderStyle === "compact" || this.viewOptions.renderStyle === "minimal") {
      this.listContainer.style.removeProperty("--chat-current-response-min-height");
    } else {
      this.listContainer.style.setProperty("--chat-current-response-min-height", listHeight * 0.75 + "px");
    }
    this.tree.layout(listHeight, width);
    this.tree.getHTMLElement().style.height = `${listHeight}px`;
    let extraOffset = 0;
    if (this.viewOptions.renderFollowups) {
      extraOffset = Math.max(100 - this.inputPart.followupsHeight, 0);
    } else if (this.viewOptions.enableWorkingSet) {
      extraOffset = Math.max(100 - this.inputPart.editSessionWidgetHeight, 0);
    }
    this.welcomeMessageContainer.style.height = `${listHeight - extraOffset}px`;
    this.welcomeMessageContainer.style.paddingBottom = `${extraOffset}px`;
    this.renderer.layout(width);
    const lastItem = this.viewModel?.getItems().at(-1);
    const lastResponseIsRendering = isResponseVM(lastItem) && lastItem.renderData;
    if (lastElementVisible && (!lastResponseIsRendering || checkModeOption(this.input.currentMode, this.viewOptions.autoScroll))) {
      this.scrollToEnd();
    }
    this.listContainer.style.height = `${listHeight}px`;
    this._onDidChangeHeight.fire(height);
  }
  // An alternative to layout, this allows you to specify the number of ChatTreeItems
  // you want to show, and the max height of the container. It will then layout the
  // tree to show that many items.
  // TODO@TylerLeonhardt: This could use some refactoring to make it clear which layout strategy is being used
  setDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
    this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
    this._register(this.renderer.onDidChangeItemHeight(() => this.layoutDynamicChatTreeItemMode()));
    const mutableDisposable = this._register(new MutableDisposable());
    this._register(this.tree.onDidScroll((e) => {
      if (!this._dynamicMessageLayoutData?.enabled) {
        return;
      }
      mutableDisposable.value = dom.scheduleAtNextAnimationFrame(dom.getWindow(this.listContainer), () => {
        if (!e.scrollTopChanged || e.heightChanged || e.scrollHeightChanged) {
          return;
        }
        const renderHeight = e.height;
        const diff = e.scrollHeight - renderHeight - e.scrollTop;
        if (diff === 0) {
          return;
        }
        const possibleMaxHeight = this._dynamicMessageLayoutData?.maxHeight ?? maxHeight;
        const width = this.bodyDimension?.width ?? this.container.offsetWidth;
        this.inputPart.layout(possibleMaxHeight, width);
        const inputPartHeight = this.inputPart.inputPartHeight;
        const newHeight = Math.min(renderHeight + diff, possibleMaxHeight - inputPartHeight);
        this.layout(newHeight + inputPartHeight, width);
      });
    }));
  }
  updateDynamicChatTreeItemLayout(numOfChatTreeItems, maxHeight) {
    this._dynamicMessageLayoutData = { numOfMessages: numOfChatTreeItems, maxHeight, enabled: true };
    let hasChanged = false;
    let height = this.bodyDimension.height;
    let width = this.bodyDimension.width;
    if (maxHeight < this.bodyDimension.height) {
      height = maxHeight;
      hasChanged = true;
    }
    const containerWidth = this.container.offsetWidth;
    if (this.bodyDimension?.width !== containerWidth) {
      width = containerWidth;
      hasChanged = true;
    }
    if (hasChanged) {
      this.layout(height, width);
    }
  }
  get isDynamicChatTreeItemLayoutEnabled() {
    return this._dynamicMessageLayoutData?.enabled ?? false;
  }
  set isDynamicChatTreeItemLayoutEnabled(value) {
    if (!this._dynamicMessageLayoutData) {
      return;
    }
    this._dynamicMessageLayoutData.enabled = value;
  }
  layoutDynamicChatTreeItemMode() {
    if (!this.viewModel || !this._dynamicMessageLayoutData?.enabled) {
      return;
    }
    const width = this.bodyDimension?.width ?? this.container.offsetWidth;
    this.inputPart.layout(this._dynamicMessageLayoutData.maxHeight, width);
    const inputHeight = this.inputPart.inputPartHeight;
    const totalMessages = this.viewModel.getItems();
    const messages = totalMessages.slice(-this._dynamicMessageLayoutData.numOfMessages);
    const needsRerender = messages.some((m) => m.currentRenderedHeight === void 0);
    const listHeight = needsRerender ? this._dynamicMessageLayoutData.maxHeight : messages.reduce((acc, message) => acc + message.currentRenderedHeight, 0);
    this.layout(
      Math.min(
        // we add an additional 18px in order to show that there is scrollable content
        inputHeight + listHeight + (totalMessages.length > 2 ? 18 : 0),
        this._dynamicMessageLayoutData.maxHeight
      ),
      width
    );
    if (needsRerender || !listHeight) {
      this.scrollToEnd();
    }
  }
  saveState() {
    this.inputPart.saveState();
    const welcomeContent = this.chatAgentService.getDefaultAgent(this.location, this.input.currentMode)?.metadata.welcomeMessageContent;
    if (welcomeContent) {
      this.storageService.store(`${PersistWelcomeMessageContentKey}.${this.location}`, welcomeContent, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
  }
  getViewState() {
    return {
      inputValue: this.getInput(),
      inputState: this.inputPart.getViewState()
    };
  }
  updateChatInputContext() {
    const currentAgent = this.parsedInput.parts.find((part) => part instanceof ChatRequestAgentPart);
    this.agentInInput.set(!!currentAgent);
  }
};
ChatWidget.CONTRIBS = [];
__decorateClass([
  memoize
], ChatWidget.prototype, "isUnifiedPanelWidget", 1);
ChatWidget = __decorateClass([
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IChatService),
  __decorateParam(9, IChatAgentService),
  __decorateParam(10, IChatWidgetService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, IChatAccessibilityService),
  __decorateParam(13, ILogService),
  __decorateParam(14, IThemeService),
  __decorateParam(15, IChatSlashCommandService),
  __decorateParam(16, IChatEditingService),
  __decorateParam(17, IStorageService),
  __decorateParam(18, ITelemetryService)
], ChatWidget);
class ChatWidgetService extends Disposable {
  constructor() {
    super(...arguments);
    this._widgets = [];
    this._lastFocusedWidget = void 0;
    this._onDidAddWidget = this._register(new Emitter());
    this.onDidAddWidget = this._onDidAddWidget.event;
  }
  get lastFocusedWidget() {
    return this._lastFocusedWidget;
  }
  getAllWidgets() {
    return this._widgets;
  }
  getWidgetsByLocations(location) {
    return this._widgets.filter((w) => w.location === location);
  }
  getWidgetByInputUri(uri) {
    return this._widgets.find((w) => isEqual(w.inputUri, uri));
  }
  getWidgetBySessionId(sessionId) {
    return this._widgets.find((w) => w.viewModel?.sessionId === sessionId);
  }
  setLastFocusedWidget(widget) {
    if (widget === this._lastFocusedWidget) {
      return;
    }
    this._lastFocusedWidget = widget;
  }
  register(newWidget) {
    if (this._widgets.some((widget) => widget === newWidget)) {
      throw new Error("Cannot register the same widget multiple times");
    }
    this._widgets.push(newWidget);
    this._onDidAddWidget.fire(newWidget);
    return combinedDisposable(
      newWidget.onDidFocus(() => this.setLastFocusedWidget(newWidget)),
      toDisposable(() => this._widgets.splice(this._widgets.indexOf(newWidget), 1))
    );
  }
}
export {
  ChatWidget,
  ChatWidgetService,
  isQuickChat
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBkaXNwb3NhYmxlVGltZW91dCwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgY29tYmluZWREaXNwb3NhYmxlLCBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGF1dG9ydW5XaXRoU3RvcmUsIG9ic2VydmFibGVGcm9tRXZlbnQsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgZXh0VXJpLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgYmluZENvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9wbGF0Zm9ybU9ic2VydmFibGVVdGlscy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBidXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kLCBidXR0b25TZWNvbmRhcnlGb3JlZ3JvdW5kLCBidXR0b25TZWNvbmRhcnlIb3ZlckJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yVXRpbHMuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY2hlY2tNb2RlT3B0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NoYXQuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudENvbW1hbmQsIElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50U2VydmljZSwgSUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQsIGlzQ2hhdFdlbGNvbWVNZXNzYWdlQ29udGVudCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgYXBwbHlpbmdDaGF0RWRpdHNGYWlsZWRDb250ZXh0S2V5LCBkZWNpZGVkQ2hhdEVkaXRpbmdSZXNvdXJjZUNvbnRleHRLZXksIGhhc0FwcGxpZWRDaGF0RWRpdHNDb250ZXh0S2V5LCBoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgSUNoYXRFZGl0aW5nU2VydmljZSwgSUNoYXRFZGl0aW5nU2Vzc2lvbiwgaW5DaGF0RWRpdGluZ1Nlc3Npb25Db250ZXh0S2V5LCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFBhdXNlU3RhdGUsIElDaGF0TW9kZWwsIElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnksIElDaGF0UmVzcG9uc2VNb2RlbCB9IGZyb20gJy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgY2hhdEFnZW50TGVhZGVyLCBDaGF0UmVxdWVzdEFnZW50UGFydCwgY2hhdFN1YmNvbW1hbmRMZWFkZXIsIGZvcm1hdENoYXRRdWVzdGlvbiwgSVBhcnNlZENoYXRSZXF1ZXN0IH0gZnJvbSAnLi4vY29tbW9uL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBDaGF0UmVxdWVzdFBhcnNlciB9IGZyb20gJy4uL2NvbW1vbi9jaGF0UmVxdWVzdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdEZvbGxvd3VwLCBJQ2hhdExvY2F0aW9uRGF0YSwgSUNoYXRTZW5kUmVxdWVzdE9wdGlvbnMsIElDaGF0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFNsYXNoQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ2hhdFZpZXdNb2RlbCwgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCwgaXNSZXF1ZXN0Vk0sIGlzUmVzcG9uc2VWTSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Vmlld01vZGVsLmpzJztcbmltcG9ydCB7IElDaGF0SW5wdXRTdGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0V2lkZ2V0SGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdENvbmZpZ3VyYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0VHJlZUl0ZW0sIElDaGF0QWNjZXB0SW5wdXRPcHRpb25zLCBJQ2hhdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBJQ2hhdENvZGVCbG9ja0luZm8sIElDaGF0RmlsZVRyZWVJbmZvLCBJQ2hhdExpc3RJdGVtUmVuZGVyZXJPcHRpb25zLCBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlLCBJQ2hhdFdpZGdldFZpZXdDb250ZXh0LCBJQ2hhdFdpZGdldFZpZXdPcHRpb25zIH0gZnJvbSAnLi9jaGF0LmpzJztcbmltcG9ydCB7IENoYXRBY2Nlc3NpYmlsaXR5UHJvdmlkZXIgfSBmcm9tICcuL2NoYXRBY2Nlc3NpYmlsaXR5UHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgQ2hhdEF0dGFjaG1lbnRNb2RlbCB9IGZyb20gJy4vY2hhdEF0dGFjaG1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0SW5wdXRQYXJ0LCBJQ2hhdElucHV0U3R5bGVzIH0gZnJvbSAnLi9jaGF0SW5wdXRQYXJ0LmpzJztcbmltcG9ydCB7IENoYXRMaXN0RGVsZWdhdGUsIENoYXRMaXN0SXRlbVJlbmRlcmVyLCBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUgfSBmcm9tICcuL2NoYXRMaXN0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvck9wdGlvbnMgfSBmcm9tICcuL2NoYXRPcHRpb25zLmpzJztcbmltcG9ydCAnLi9tZWRpYS9jaGF0LmNzcyc7XG5pbXBvcnQgJy4vbWVkaWEvY2hhdEFnZW50SG92ZXIuY3NzJztcbmltcG9ydCAnLi9tZWRpYS9jaGF0Vmlld1dlbGNvbWUuY3NzJztcbmltcG9ydCB7IENoYXRWaWV3V2VsY29tZVBhcnQgfSBmcm9tICcuL3ZpZXdzV2VsY29tZS9jaGF0Vmlld1dlbGNvbWVDb250cm9sbGVyLmpzJztcblxuY29uc3QgJCA9IGRvbS4kO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0Vmlld1N0YXRlIHtcblx0aW5wdXRWYWx1ZT86IHN0cmluZztcblx0aW5wdXRTdGF0ZT86IElDaGF0SW5wdXRTdGF0ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFdpZGdldFN0eWxlcyBleHRlbmRzIElDaGF0SW5wdXRTdHlsZXMge1xuXHRpbnB1dEVkaXRvckJhY2tncm91bmQ6IHN0cmluZztcblx0cmVzdWx0RWRpdG9yQmFja2dyb3VuZDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0V2lkZ2V0Q29udHJpYiBleHRlbmRzIElEaXNwb3NhYmxlIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblxuXHQvKipcblx0ICogQSBwaWVjZSBvZiBzdGF0ZSB3aGljaCBpcyByZWxhdGVkIHRvIHRoZSBpbnB1dCBlZGl0b3Igb2YgdGhlIGNoYXQgd2lkZ2V0XG5cdCAqL1xuXHRnZXRJbnB1dFN0YXRlPygpOiBhbnk7XG5cblx0LyoqXG5cdCAqIENhbGxlZCB3aXRoIHRoZSByZXN1bHQgb2YgZ2V0SW5wdXRTdGF0ZSB3aGVuIG5hdmlnYXRpbmcgaW5wdXQgaGlzdG9yeS5cblx0ICovXG5cdHNldElucHV0U3RhdGU/KHM6IGFueSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRXaWRnZXRMb2NhdGlvbk9wdGlvbnMge1xuXHRsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247XG5cdHJlc29sdmVEYXRhPygpOiBJQ2hhdExvY2F0aW9uRGF0YSB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUXVpY2tDaGF0KHdpZGdldDogSUNoYXRXaWRnZXQpOiBib29sZWFuIHtcblx0cmV0dXJuICd2aWV3Q29udGV4dCcgaW4gd2lkZ2V0ICYmICdpc1F1aWNrQ2hhdCcgaW4gd2lkZ2V0LnZpZXdDb250ZXh0ICYmIEJvb2xlYW4od2lkZ2V0LnZpZXdDb250ZXh0LmlzUXVpY2tDaGF0KTtcbn1cblxuY29uc3QgUGVyc2lzdFdlbGNvbWVNZXNzYWdlQ29udGVudEtleSA9ICdjaGF0LndlbGNvbWVNZXNzYWdlQ29udGVudCc7XG5cbmV4cG9ydCBjbGFzcyBDaGF0V2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDaGF0V2lkZ2V0IHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBDT05UUklCUzogeyBuZXcoLi4uYXJnczogW0lDaGF0V2lkZ2V0LCAuLi5hbnldKTogSUNoYXRXaWRnZXRDb250cmliIH1bXSA9IFtdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU3VibWl0QWdlbnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFnZW50OiBJQ2hhdEFnZW50RGF0YTsgc2xhc2hDb21tYW5kPzogSUNoYXRBZ2VudENvbW1hbmQgfT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFN1Ym1pdEFnZW50ID0gdGhpcy5fb25EaWRTdWJtaXRBZ2VudC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUFnZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBhZ2VudDogSUNoYXRBZ2VudERhdGE7IHNsYXNoQ29tbWFuZD86IElDaGF0QWdlbnRDb21tYW5kIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFnZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VBZ2VudC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXMgPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlVmlld01vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlld01vZGVsID0gdGhpcy5fb25EaWRDaGFuZ2VWaWV3TW9kZWwuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRTY3JvbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRTY3JvbGwgPSB0aGlzLl9vbkRpZFNjcm9sbC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENsZWFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2xlYXIgPSB0aGlzLl9vbkRpZENsZWFyLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkQWNjZXB0SW5wdXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRBY2NlcHRJbnB1dCA9IHRoaXMuX29uRGlkQWNjZXB0SW5wdXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRIaWRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkSGlkZSA9IHRoaXMuX29uRGlkSGlkZS5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVBhcnNlZElucHV0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUGFyc2VkSW5wdXQgPSB0aGlzLl9vbkRpZENoYW5nZVBhcnNlZElucHV0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbE1heWJlQ2hhbmdlSGVpZ2h0ID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25XaWxsTWF5YmVDaGFuZ2VIZWlnaHQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25XaWxsTWF5YmVDaGFuZ2VIZWlnaHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxudW1iZXI+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodCA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudEhlaWdodDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBjb250cmliczogUmVhZG9ubHlBcnJheTxJQ2hhdFdpZGdldENvbnRyaWI+ID0gW107XG5cblx0cHJpdmF0ZSB0cmVlITogV29ya2JlbmNoT2JqZWN0VHJlZTxDaGF0VHJlZUl0ZW0sIEZ1enp5U2NvcmU+O1xuXHRwcml2YXRlIHJlbmRlcmVyITogQ2hhdExpc3RJdGVtUmVuZGVyZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvZGVCbG9ja01vZGVsQ29sbGVjdGlvbjogQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uO1xuXHRwcml2YXRlIGxhc3RJdGVtOiBDaGF0VHJlZUl0ZW0gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBpbnB1dFBhcnQhOiBDaGF0SW5wdXRQYXJ0O1xuXHRwcml2YXRlIGVkaXRvck9wdGlvbnMhOiBDaGF0RWRpdG9yT3B0aW9ucztcblxuXHRwcml2YXRlIGxpc3RDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBjb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB3ZWxjb21lTWVzc2FnZUNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHBlcnNpc3RlZFdlbGNvbWVNZXNzYWdlOiBJQ2hhdFdlbGNvbWVNZXNzYWdlQ29udGVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSB3ZWxjb21lUGFydDogTXV0YWJsZURpc3Bvc2FibGU8Q2hhdFZpZXdXZWxjb21lUGFydD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSBib2R5RGltZW5zaW9uOiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHZpc2libGVDaGFuZ2VDb3VudCA9IDA7XG5cdHByaXZhdGUgcmVxdWVzdEluUHJvZ3Jlc3M6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGlzUmVxdWVzdFBhdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgY2FuUmVxdWVzdEJlUGF1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBhZ2VudEluSW5wdXQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cblx0cHJpdmF0ZSBfdmlzaWJsZSA9IGZhbHNlO1xuXHRwdWJsaWMgZ2V0IHZpc2libGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGU7XG5cdH1cblxuXHRwcml2YXRlIHByZXZpb3VzVHJlZVNjcm9sbEhlaWdodDogbnVtYmVyID0gMDtcblxuXHQvKipcblx0ICogV2hldGhlciB0aGUgbGlzdCBpcyBzY3JvbGwtbG9ja2VkIHRvIHRoZSBib3R0b20uIEluaXRpYWxpemUgdG8gdHJ1ZSBzbyB0aGF0IHdlIGNhbiBzY3JvbGwgdG8gdGhlIGJvdHRvbSBvbiBmaXJzdCByZW5kZXIuXG5cdCAqIFRoZSBpbml0aWFsIHJlbmRlciBsZWFkcyB0byBhIGxvdCBvZiBgb25EaWRDaGFuZ2VUcmVlQ29udGVudEhlaWdodGAgYXMgdGhlIHJlbmRlcmVyIHdvcmtzIG91dCB0aGUgcmVhbCBoZWlnaHRzIG9mIHJvd3MuXG5cdCAqL1xuXHRwcml2YXRlIHNjcm9sbExvY2sgPSB0cnVlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdmlld01vZGVsRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF92aWV3TW9kZWw6IENoYXRWaWV3TW9kZWwgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc2V0IHZpZXdNb2RlbCh2aWV3TW9kZWw6IENoYXRWaWV3TW9kZWwgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodGhpcy5fdmlld01vZGVsID09PSB2aWV3TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdNb2RlbERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHR0aGlzLl92aWV3TW9kZWwgPSB2aWV3TW9kZWw7XG5cdFx0aWYgKHZpZXdNb2RlbCkge1xuXHRcdFx0dGhpcy52aWV3TW9kZWxEaXNwb3NhYmxlcy5hZGQodmlld01vZGVsKTtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdNb2RlbC5maXJlKCk7XG5cdH1cblxuXHRnZXQgdmlld01vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLl92aWV3TW9kZWw7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0aW5nU2Vzc2lvbiA9IG9ic2VydmFibGVWYWx1ZTxJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXG5cdHByaXZhdGUgcGFyc2VkQ2hhdFJlcXVlc3Q6IElQYXJzZWRDaGF0UmVxdWVzdCB8IHVuZGVmaW5lZDtcblx0Z2V0IHBhcnNlZElucHV0KCkge1xuXHRcdGlmICh0aGlzLnBhcnNlZENoYXRSZXF1ZXN0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmICghdGhpcy52aWV3TW9kZWwpIHtcblx0XHRcdFx0cmV0dXJuIHsgdGV4dDogJycsIHBhcnRzOiBbXSB9O1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnBhcnNlZENoYXRSZXF1ZXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UmVxdWVzdFBhcnNlcikucGFyc2VDaGF0UmVxdWVzdCh0aGlzLnZpZXdNb2RlbCEuc2Vzc2lvbklkLCB0aGlzLmdldElucHV0KCksIHRoaXMubG9jYXRpb24sIHsgc2VsZWN0ZWRBZ2VudDogdGhpcy5fbGFzdFNlbGVjdGVkQWdlbnQsIG1vZGU6IHRoaXMuaW5wdXQuY3VycmVudE1vZGUgfSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucGFyc2VkQ2hhdFJlcXVlc3Q7XG5cdH1cblxuXHRnZXQgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UoKTogSUNvbnRleHRLZXlTZXJ2aWNlIHtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0S2V5U2VydmljZTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xvY2F0aW9uOiBJQ2hhdFdpZGdldExvY2F0aW9uT3B0aW9ucztcblx0Z2V0IGxvY2F0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9sb2NhdGlvbi5sb2NhdGlvbjtcblx0fVxuXG5cdHJlYWRvbmx5IHZpZXdDb250ZXh0OiBJQ2hhdFdpZGdldFZpZXdDb250ZXh0O1xuXG5cdEBtZW1vaXplXG5cdGdldCBpc1VuaWZpZWRQYW5lbFdpZGdldCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbG9jYXRpb24ubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsICYmICEhdGhpcy52aWV3T3B0aW9ucy5zdXBwb3J0c0NoYW5naW5nTW9kZXMgJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShDaGF0Q29uZmlndXJhdGlvbi5VbmlmaWVkQ2hhdFZpZXcpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uIHwgSUNoYXRXaWRnZXRMb2NhdGlvbk9wdGlvbnMsXG5cdFx0X3ZpZXdDb250ZXh0OiBJQ2hhdFdpZGdldFZpZXdDb250ZXh0IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmlld09wdGlvbnM6IElDaGF0V2lkZ2V0Vmlld09wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBzdHlsZXM6IElDaGF0V2lkZ2V0U3R5bGVzLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUNoYXRBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZTogSUNoYXRBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFNsYXNoQ29tbWFuZFNlcnZpY2U6IElDaGF0U2xhc2hDb21tYW5kU2VydmljZSxcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBjaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnZpZXdDb250ZXh0ID0gX3ZpZXdDb250ZXh0ID8/IHt9O1xuXG5cdFx0Y29uc3Qgdmlld01vZGVsT2JzID0gb2JzZXJ2YWJsZUZyb21FdmVudCh0aGlzLCB0aGlzLm9uRGlkQ2hhbmdlVmlld01vZGVsLCAoKSA9PiB0aGlzLnZpZXdNb2RlbCk7XG5cblx0XHRpZiAodHlwZW9mIGxvY2F0aW9uID09PSAnb2JqZWN0Jykge1xuXHRcdFx0dGhpcy5fbG9jYXRpb24gPSBsb2NhdGlvbjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbG9jYXRpb24gPSB7IGxvY2F0aW9uIH07XG5cdFx0fVxuXG5cdFx0Q2hhdENvbnRleHRLZXlzLmluQ2hhdFNlc3Npb24uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKS5zZXQodHJ1ZSk7XG5cdFx0Q2hhdENvbnRleHRLZXlzLmxvY2F0aW9uLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSkuc2V0KHRoaXMuX2xvY2F0aW9uLmxvY2F0aW9uKTtcblx0XHRDaGF0Q29udGV4dEtleXMuaW5RdWlja0NoYXQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoaXNRdWlja0NoYXQodGhpcykpO1xuXHRcdENoYXRDb250ZXh0S2V5cy5pblVuaWZpZWRDaGF0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSlcblx0XHRcdC5zZXQodGhpcy5fbG9jYXRpb24ubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsICYmICEhdGhpcy52aWV3T3B0aW9ucy5zdXBwb3J0c0NoYW5naW5nTW9kZXMgJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShDaGF0Q29uZmlndXJhdGlvbi5VbmlmaWVkQ2hhdFZpZXcpKTtcblx0XHR0aGlzLmFnZW50SW5JbnB1dCA9IENoYXRDb250ZXh0S2V5cy5pbnB1dEhhc0FnZW50LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5yZXF1ZXN0SW5Qcm9ncmVzcyA9IENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaXNSZXF1ZXN0UGF1c2VkID0gQ2hhdENvbnRleHRLZXlzLmlzUmVxdWVzdFBhdXNlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuY2FuUmVxdWVzdEJlUGF1c2VkID0gQ2hhdENvbnRleHRLZXlzLmNhblJlcXVlc3RCZVBhdXNlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LCBjb250ZXh0S2V5U2VydmljZSwgKHJlYWRlcikgPT4ge1xuXHRcdFx0Y29uc3QgY3VycmVudFNlc3Npb24gPSB0aGlzLl9lZGl0aW5nU2Vzc2lvbi5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIWN1cnJlbnRTZXNzaW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGVudHJpZXMgPSBjdXJyZW50U2Vzc2lvbi5lbnRyaWVzLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IGRlY2lkZWRFbnRyaWVzID0gZW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkuc3RhdGUucmVhZChyZWFkZXIpICE9PSBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCk7XG5cdFx0XHRyZXR1cm4gZGVjaWRlZEVudHJpZXMubWFwKGVudHJ5ID0+IGVudHJ5LmVudHJ5SWQpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgY29udGV4dEtleVNlcnZpY2UsIChyZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IGN1cnJlbnRTZXNzaW9uID0gdGhpcy5fZWRpdGluZ1Nlc3Npb24ucmVhZChyZWFkZXIpO1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IGN1cnJlbnRTZXNzaW9uPy5lbnRyaWVzLnJlYWQocmVhZGVyKSA/PyBbXTsgLy8gdXNpbmcgY3VycmVudFNlc3Npb24gaGVyZVxuXHRcdFx0Y29uc3QgZGVjaWRlZEVudHJpZXMgPSBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiBlbnRyeS5zdGF0ZS5yZWFkKHJlYWRlcikgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkKTtcblx0XHRcdHJldHVybiBkZWNpZGVkRW50cmllcy5sZW5ndGggPiAwO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShoYXNBcHBsaWVkQ2hhdEVkaXRzQ29udGV4dEtleSwgY29udGV4dEtleVNlcnZpY2UsIChyZWFkZXIpID0+IHtcblx0XHRcdGNvbnN0IGN1cnJlbnRTZXNzaW9uID0gdGhpcy5fZWRpdGluZ1Nlc3Npb24ucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFjdXJyZW50U2Vzc2lvbikge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbnRyaWVzID0gY3VycmVudFNlc3Npb24uZW50cmllcy5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gZW50cmllcy5sZW5ndGggPiAwO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShpbkNoYXRFZGl0aW5nU2Vzc2lvbkNvbnRleHRLZXksIGNvbnRleHRLZXlTZXJ2aWNlLCAocmVhZGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZWRpdGluZ1Nlc3Npb24ucmVhZChyZWFkZXIpICE9PSBudWxsO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihiaW5kQ29udGV4dEtleShDaGF0Q29udGV4dEtleXMuY2hhdEVkaXRpbmdDYW5VbmRvLCBjb250ZXh0S2V5U2VydmljZSwgKHIpID0+IHtcblx0XHRcdHJldHVybiB0aGlzLl9lZGl0aW5nU2Vzc2lvbi5yZWFkKHIpPy5jYW5VbmRvLnJlYWQocikgfHwgZmFsc2U7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGJpbmRDb250ZXh0S2V5KENoYXRDb250ZXh0S2V5cy5jaGF0RWRpdGluZ0NhblJlZG8sIGNvbnRleHRLZXlTZXJ2aWNlLCAocikgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VkaXRpbmdTZXNzaW9uLnJlYWQocik/LmNhblJlZG8ucmVhZChyKSB8fCBmYWxzZTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYmluZENvbnRleHRLZXkoYXBwbHlpbmdDaGF0RWRpdHNGYWlsZWRDb250ZXh0S2V5LCBjb250ZXh0S2V5U2VydmljZSwgKHIpID0+IHtcblx0XHRcdGNvbnN0IGNoYXRNb2RlbCA9IHZpZXdNb2RlbE9icy5yZWFkKHIpPy5tb2RlbDtcblx0XHRcdGNvbnN0IGVkaXRpbmdTZXNzaW9uID0gdGhpcy5fZWRpdGluZ1Nlc3Npb24ucmVhZChyKTtcblx0XHRcdGlmICghZWRpdGluZ1Nlc3Npb24gfHwgIWNoYXRNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBsYXN0UmVzcG9uc2UgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsIGNoYXRNb2RlbC5vbkRpZENoYW5nZSwgKCkgPT4gY2hhdE1vZGVsLmdldFJlcXVlc3RzKCkuYXQoLTEpPy5yZXNwb25zZSkucmVhZChyKTtcblx0XHRcdHJldHVybiBsYXN0UmVzcG9uc2U/LnJlc3VsdD8uZXJyb3JEZXRhaWxzICYmICFsYXN0UmVzcG9uc2U/LnJlc3VsdD8uZXJyb3JEZXRhaWxzLnJlc3BvbnNlSXNJbmNvbXBsZXRlO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvZGVCbG9ja01vZGVsQ29sbGVjdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVCbG9ja01vZGVsQ29sbGVjdGlvbiwgdW5kZWZpbmVkKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2NoYXQucmVuZGVyUmVsYXRlZEZpbGVzJykpIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW5XaXRoU3RvcmUoKHIsIHN0b3JlKSA9PiB7XG5cblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHZpZXdNb2RlbE9icy5yZWFkKHIpO1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbnMgPSBjaGF0RWRpdGluZ1NlcnZpY2UuZWRpdGluZ1Nlc3Npb25zT2JzLnJlYWQocik7XG5cblx0XHRcdGNvbnN0IHNlc3Npb24gPSBzZXNzaW9ucy5maW5kKGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUuY2hhdFNlc3Npb25JZCA9PT0gdmlld01vZGVsPy5zZXNzaW9uSWQpO1xuXHRcdFx0dGhpcy5fZWRpdGluZ1Nlc3Npb24uc2V0KHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0XHRcdHRoaXMucmVuZGVyQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUoKTsgLy8gdGhpcyBpcyBuZWNlc3NhcnkgdG8gbWFrZSBzdXJlIHdlIGRpc3Bvc2UgcHJldmlvdXMgYnV0dG9ucywgZXRjLlxuXG5cdFx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdFx0Ly8gbm9uZSBvciBmb3IgYSBkaWZmZXJlbnQgY2hhdCB3aWRnZXRcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9lZGl0aW5nU2Vzc2lvbi5zZXQoc2Vzc2lvbiwgdW5kZWZpbmVkKTtcblxuXHRcdFx0c3RvcmUuYWRkKHNlc3Npb24ub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJlbmRlckNoYXRFZGl0aW5nU2Vzc2lvblN0YXRlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQoc2Vzc2lvbi5vbkRpZERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9lZGl0aW5nU2Vzc2lvbi5zZXQodW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR0aGlzLnJlbmRlckNoYXRFZGl0aW5nU2Vzc2lvblN0YXRlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHRzdG9yZS5hZGQodGhpcy5vbkRpZENoYW5nZVBhcnNlZElucHV0KCgpID0+IHtcblx0XHRcdFx0dGhpcy5yZW5kZXJDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0c3RvcmUuYWRkKHRoaXMuaW5wdXRFZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5nZXRJbnB1dCgpID09PSAnJykge1xuXHRcdFx0XHRcdHRoaXMucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJDaGF0RWRpdGluZ1Nlc3Npb25TdGF0ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLnJlbmRlckNoYXRFZGl0aW5nU2Vzc2lvblN0YXRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29kZUVkaXRvclNlcnZpY2UucmVnaXN0ZXJDb2RlRWRpdG9yT3BlbkhhbmRsZXIoYXN5bmMgKGlucHV0OiBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQsIF9zb3VyY2U6IElDb2RlRWRpdG9yIHwgbnVsbCwgX3NpZGVCeVNpZGU/OiBib29sZWFuKTogUHJvbWlzZTxJQ29kZUVkaXRvciB8IG51bGw+ID0+IHtcblx0XHRcdGNvbnN0IHJlc291cmNlID0gaW5wdXQucmVzb3VyY2U7XG5cdFx0XHRpZiAocmVzb3VyY2Uuc2NoZW1lICE9PSBTY2hlbWFzLnZzY29kZUNoYXRDb2RlQmxvY2spIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3BvbnNlSWQgPSByZXNvdXJjZS5wYXRoLnNwbGl0KCcvJykuYXQoMSk7XG5cdFx0XHRpZiAoIXJlc3BvbnNlSWQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5maW5kKGl0ZW0gPT4gaXRlbS5pZCA9PT0gcmVzcG9uc2VJZCk7XG5cdFx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRPRE86IG5lZWRzIHRvIHJldmVhbCB0aGUgY2hhdCB2aWV3XG5cblx0XHRcdHRoaXMucmV2ZWFsKGl0ZW0pO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyB3YWl0IGZvciBsaXN0IHRvIGFjdHVhbGx5IHJlbmRlclxuXG5cdFx0XHRmb3IgKGNvbnN0IGNvZGVCbG9ja1BhcnQgb2YgdGhpcy5yZW5kZXJlci5lZGl0b3JzSW5Vc2UoKSkge1xuXHRcdFx0XHRpZiAoZXh0VXJpLmlzRXF1YWwoY29kZUJsb2NrUGFydC51cmksIHJlc291cmNlLCB0cnVlKSkge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvciA9IGNvZGVCbG9ja1BhcnQuZWRpdG9yO1xuXG5cdFx0XHRcdFx0bGV0IHJlbGF0aXZlVG9wID0gMDtcblx0XHRcdFx0XHRjb25zdCBlZGl0b3JEb21Ob2RlID0gZWRpdG9yLmdldERvbU5vZGUoKTtcblx0XHRcdFx0XHRpZiAoZWRpdG9yRG9tTm9kZSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgcm93ID0gZG9tLmZpbmRQYXJlbnRXaXRoQ2xhc3MoZWRpdG9yRG9tTm9kZSwgJ21vbmFjby1saXN0LXJvdycpO1xuXHRcdFx0XHRcdFx0aWYgKHJvdykge1xuXHRcdFx0XHRcdFx0XHRyZWxhdGl2ZVRvcCA9IGRvbS5nZXRUb3BMZWZ0T2Zmc2V0KGVkaXRvckRvbU5vZGUpLnRvcCAtIGRvbS5nZXRUb3BMZWZ0T2Zmc2V0KHJvdykudG9wO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChpbnB1dC5vcHRpb25zPy5zZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRvclNlbGVjdGlvblRvcE9mZnNldCA9IGVkaXRvci5nZXRUb3BGb3JQb3NpdGlvbihpbnB1dC5vcHRpb25zLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsIGlucHV0Lm9wdGlvbnMuc2VsZWN0aW9uLnN0YXJ0Q29sdW1uKTtcblx0XHRcdFx0XHRcdHJlbGF0aXZlVG9wICs9IGVkaXRvclNlbGVjdGlvblRvcE9mZnNldDtcblxuXHRcdFx0XHRcdFx0ZWRpdG9yLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKHtcblx0XHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBpbnB1dC5vcHRpb25zLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdHN0YXJ0Q29sdW1uOiBpbnB1dC5vcHRpb25zLnNlbGVjdGlvbi5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdFx0ZW5kTGluZU51bWJlcjogaW5wdXQub3B0aW9ucy5zZWxlY3Rpb24uZW5kTGluZU51bWJlciA/PyBpbnB1dC5vcHRpb25zLnNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdGVuZENvbHVtbjogaW5wdXQub3B0aW9ucy5zZWxlY3Rpb24uZW5kQ29sdW1uID8/IGlucHV0Lm9wdGlvbnMuc2VsZWN0aW9uLnN0YXJ0Q29sdW1uXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aGlzLnJldmVhbChpdGVtLCByZWxhdGl2ZVRvcCk7XG5cblx0XHRcdFx0XHRyZXR1cm4gZWRpdG9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBsb2FkZWRXZWxjb21lQ29udGVudCA9IHN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdChgJHtQZXJzaXN0V2VsY29tZU1lc3NhZ2VDb250ZW50S2V5fS4ke3RoaXMubG9jYXRpb259YCwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRpZiAoaXNDaGF0V2VsY29tZU1lc3NhZ2VDb250ZW50KGxvYWRlZFdlbGNvbWVDb250ZW50KSkge1xuXHRcdFx0dGhpcy5wZXJzaXN0ZWRXZWxjb21lTWVzc2FnZSA9IGxvYWRlZFdlbGNvbWVDb250ZW50O1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VQYXJzZWRJbnB1dCgoKSA9PiB0aGlzLnVwZGF0ZUNoYXRJbnB1dENvbnRleHQoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGFzdFNlbGVjdGVkQWdlbnQ6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkO1xuXHRzZXQgbGFzdFNlbGVjdGVkQWdlbnQoYWdlbnQ6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5wYXJzZWRDaGF0UmVxdWVzdCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9sYXN0U2VsZWN0ZWRBZ2VudCA9IGFnZW50O1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlUGFyc2VkSW5wdXQuZmlyZSgpO1xuXHR9XG5cblx0Z2V0IGxhc3RTZWxlY3RlZEFnZW50KCk6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFzdFNlbGVjdGVkQWdlbnQ7XG5cdH1cblxuXHRnZXQgc3VwcG9ydHNGaWxlUmVmZXJlbmNlcygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnZpZXdPcHRpb25zLnN1cHBvcnRzRmlsZVJlZmVyZW5jZXM7XG5cdH1cblxuXHRnZXQgaW5wdXQoKTogQ2hhdElucHV0UGFydCB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRQYXJ0O1xuXHR9XG5cblx0Z2V0IGlucHV0RWRpdG9yKCk6IElDb2RlRWRpdG9yIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dFBhcnQuaW5wdXRFZGl0b3I7XG5cdH1cblxuXHRnZXQgaW5wdXRVcmkoKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dFBhcnQuaW5wdXRVcmk7XG5cdH1cblxuXHRnZXQgY29udGVudEhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGFydC5jb250ZW50SGVpZ2h0ICsgdGhpcy50cmVlLmNvbnRlbnRIZWlnaHQ7XG5cdH1cblxuXHRnZXQgYXR0YWNobWVudE1vZGVsKCk6IENoYXRBdHRhY2htZW50TW9kZWwge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGFydC5hdHRhY2htZW50TW9kZWw7XG5cdH1cblxuXHRyZW5kZXIocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdJZCA9ICd2aWV3SWQnIGluIHRoaXMudmlld0NvbnRleHQgPyB0aGlzLnZpZXdDb250ZXh0LnZpZXdJZCA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLmVkaXRvck9wdGlvbnMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRFZGl0b3JPcHRpb25zLCB2aWV3SWQsIHRoaXMuc3R5bGVzLmxpc3RGb3JlZ3JvdW5kLCB0aGlzLnN0eWxlcy5pbnB1dEVkaXRvckJhY2tncm91bmQsIHRoaXMuc3R5bGVzLnJlc3VsdEVkaXRvckJhY2tncm91bmQpKTtcblx0XHRjb25zdCByZW5kZXJJbnB1dE9uVG9wID0gdGhpcy52aWV3T3B0aW9ucy5yZW5kZXJJbnB1dE9uVG9wID8/IGZhbHNlO1xuXHRcdGNvbnN0IHJlbmRlckZvbGxvd3VwcyA9IHRoaXMudmlld09wdGlvbnMucmVuZGVyRm9sbG93dXBzID8/ICFyZW5kZXJJbnB1dE9uVG9wO1xuXHRcdGNvbnN0IHJlbmRlclN0eWxlID0gdGhpcy52aWV3T3B0aW9ucy5yZW5kZXJTdHlsZTtcblxuXHRcdHRoaXMuY29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsICQoJy5pbnRlcmFjdGl2ZS1zZXNzaW9uJykpO1xuXHRcdHRoaXMud2VsY29tZU1lc3NhZ2VDb250YWluZXIgPSBkb20uYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcuY2hhdC13ZWxjb21lLXZpZXctY29udGFpbmVyJywgeyBzdHlsZTogJ2Rpc3BsYXk6IG5vbmUnIH0pKTtcblx0XHRpZiAocmVuZGVySW5wdXRPblRvcCkge1xuXHRcdFx0dGhpcy5jcmVhdGVJbnB1dCh0aGlzLmNvbnRhaW5lciwgeyByZW5kZXJGb2xsb3d1cHMsIHJlbmRlclN0eWxlIH0pO1xuXHRcdFx0dGhpcy5saXN0Q29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJChgLmludGVyYWN0aXZlLWxpc3RgKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGlzdENvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5jb250YWluZXIsICQoYC5pbnRlcmFjdGl2ZS1saXN0YCkpO1xuXHRcdFx0dGhpcy5jcmVhdGVJbnB1dCh0aGlzLmNvbnRhaW5lciwgeyByZW5kZXJGb2xsb3d1cHMsIHJlbmRlclN0eWxlIH0pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyV2VsY29tZVZpZXdDb250ZW50SWZOZWVkZWQoKTtcblx0XHR0aGlzLmNyZWF0ZUxpc3QodGhpcy5saXN0Q29udGFpbmVyLCB7IC4uLnRoaXMudmlld09wdGlvbnMucmVuZGVyZXJPcHRpb25zLCByZW5kZXJTdHlsZSB9KTtcblxuXHRcdGNvbnN0IHNjcm9sbERvd25CdXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKHRoaXMubGlzdENvbnRhaW5lciwge1xuXHRcdFx0c3VwcG9ydEljb25zOiB0cnVlLFxuXHRcdFx0YnV0dG9uQmFja2dyb3VuZDogYXNDc3NWYXJpYWJsZShidXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kKSxcblx0XHRcdGJ1dHRvbkZvcmVncm91bmQ6IGFzQ3NzVmFyaWFibGUoYnV0dG9uU2Vjb25kYXJ5Rm9yZWdyb3VuZCksXG5cdFx0XHRidXR0b25Ib3ZlckJhY2tncm91bmQ6IGFzQ3NzVmFyaWFibGUoYnV0dG9uU2Vjb25kYXJ5SG92ZXJCYWNrZ3JvdW5kKSxcblx0XHR9KSk7XG5cdFx0c2Nyb2xsRG93bkJ1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2NoYXQtc2Nyb2xsLWRvd24nKTtcblx0XHRzY3JvbGxEb3duQnV0dG9uLmxhYmVsID0gYCQoJHtDb2RpY29uLmNoZXZyb25Eb3duLmlkfSlgO1xuXHRcdHNjcm9sbERvd25CdXR0b24uc2V0VGl0bGUobG9jYWxpemUoJ3Njcm9sbERvd25CdXR0b25MYWJlbCcsIFwiU2Nyb2xsIGRvd25cIikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHNjcm9sbERvd25CdXR0b24ub25EaWRDbGljaygoKSA9PiB7XG5cdFx0XHR0aGlzLnNjcm9sbExvY2sgPSB0cnVlO1xuXHRcdFx0dGhpcy5zY3JvbGxUb0VuZCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZWRpdG9yT3B0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLm9uRGlkU3R5bGVDaGFuZ2UoKSkpO1xuXHRcdHRoaXMub25EaWRTdHlsZUNoYW5nZSgpO1xuXG5cdFx0Ly8gRG8gaW5pdGlhbCByZW5kZXJcblx0XHRpZiAodGhpcy52aWV3TW9kZWwpIHtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VJdGVtcygpO1xuXHRcdFx0dGhpcy5zY3JvbGxUb0VuZCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuY29udHJpYnMgPSBDaGF0V2lkZ2V0LkNPTlRSSUJTLm1hcChjb250cmliID0+IHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKGNvbnRyaWIsIHRoaXMpKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0ZhaWxlZCB0byBpbnN0YW50aWF0ZSBjaGF0IHdpZGdldCBjb250cmliJywgdG9FcnJvck1lc3NhZ2UoZXJyKSk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkuZmlsdGVyKGlzRGVmaW5lZCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcigodGhpcy5jaGF0V2lkZ2V0U2VydmljZSBhcyBDaGF0V2lkZ2V0U2VydmljZSkucmVnaXN0ZXIodGhpcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBzY3JvbGxUb0VuZCgpIHtcblx0XHRpZiAodGhpcy5sYXN0SXRlbSkge1xuXHRcdFx0Y29uc3Qgb2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sYXN0SXRlbS5jdXJyZW50UmVuZGVyZWRIZWlnaHQgPz8gMCwgMWU2KTtcblx0XHRcdHRoaXMudHJlZS5yZXZlYWwodGhpcy5sYXN0SXRlbSwgb2Zmc2V0KTtcblx0XHR9XG5cdH1cblxuXHRnZXRDb250cmliPFQgZXh0ZW5kcyBJQ2hhdFdpZGdldENvbnRyaWI+KGlkOiBzdHJpbmcpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jb250cmlicy5maW5kKGMgPT4gYy5pZCA9PT0gaWQpIGFzIFQ7XG5cdH1cblxuXHRmb2N1c0lucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRQYXJ0LmZvY3VzKCk7XG5cblx0XHQvLyBTb21ldGltZXMgZm9jdXNpbmcgdGhlIGlucHV0IHBhcnQgaXMgbm90IHBvc3NpYmxlLFxuXHRcdC8vIGJ1dCB3ZSdkIGxpa2UgdG8gYmUgdGhlIGxhc3QgZm9jdXNlZCBjaGF0IHdpZGdldCxcblx0XHQvLyBzbyB3ZSBlbWl0IGFuIG9wdGltaXN0aWMgb25EaWRGb2N1cyBldmVudCBub25ldGhlbGVzcy5cblx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0fVxuXG5cdGhhc0lucHV0Rm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRQYXJ0Lmhhc0ZvY3VzKCk7XG5cdH1cblxuXHRyZWZyZXNoUGFyc2VkSW5wdXQoKSB7XG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnBhcnNlZENoYXRSZXF1ZXN0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UmVxdWVzdFBhcnNlcikucGFyc2VDaGF0UmVxdWVzdCh0aGlzLnZpZXdNb2RlbC5zZXNzaW9uSWQsIHRoaXMuZ2V0SW5wdXQoKSwgdGhpcy5sb2NhdGlvbiwgeyBzZWxlY3RlZEFnZW50OiB0aGlzLl9sYXN0U2VsZWN0ZWRBZ2VudCwgbW9kZTogdGhpcy5pbnB1dC5jdXJyZW50TW9kZSB9KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVBhcnNlZElucHV0LmZpcmUoKTtcblx0fVxuXG5cdGdldFNpYmxpbmcoaXRlbTogQ2hhdFRyZWVJdGVtLCB0eXBlOiAnbmV4dCcgfCAncHJldmlvdXMnKTogQ2hhdFRyZWVJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIWlzUmVzcG9uc2VWTShpdGVtKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpdGVtcyA9IHRoaXMudmlld01vZGVsPy5nZXRJdGVtcygpO1xuXHRcdGlmICghaXRlbXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcmVzcG9uc2VJdGVtcyA9IGl0ZW1zLmZpbHRlcihpID0+IGlzUmVzcG9uc2VWTShpKSk7XG5cdFx0Y29uc3QgdGFyZ2V0SW5kZXggPSByZXNwb25zZUl0ZW1zLmluZGV4T2YoaXRlbSk7XG5cdFx0aWYgKHRhcmdldEluZGV4ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaW5kZXhUb0ZvY3VzID0gdHlwZSA9PT0gJ25leHQnID8gdGFyZ2V0SW5kZXggKyAxIDogdGFyZ2V0SW5kZXggLSAxO1xuXHRcdGlmIChpbmRleFRvRm9jdXMgPCAwIHx8IGluZGV4VG9Gb2N1cyA+IHJlc3BvbnNlSXRlbXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzcG9uc2VJdGVtc1tpbmRleFRvRm9jdXNdO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2R5bmFtaWNNZXNzYWdlTGF5b3V0RGF0YSkge1xuXHRcdFx0dGhpcy5fZHluYW1pY01lc3NhZ2VMYXlvdXREYXRhLmVuYWJsZWQgPSB0cnVlO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENsZWFyLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VJdGVtcyhza2lwRHluYW1pY0xheW91dD86IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5fdmlzaWJsZSB8fCAhdGhpcy52aWV3TW9kZWwpIHtcblx0XHRcdGNvbnN0IHRyZWVJdGVtcyA9ICh0aGlzLnZpZXdNb2RlbD8uZ2V0SXRlbXMoKSA/PyBbXSlcblx0XHRcdFx0Lm1hcCgoaXRlbSk6IElUcmVlRWxlbWVudDxDaGF0VHJlZUl0ZW0+ID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZWxlbWVudDogaXRlbSxcblx0XHRcdFx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHRcdFx0XHRjb2xsYXBzaWJsZTogZmFsc2Vcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5yZW5kZXJXZWxjb21lVmlld0NvbnRlbnRJZk5lZWRlZCgpO1xuXG5cdFx0XHR0aGlzLl9vbldpbGxNYXliZUNoYW5nZUhlaWdodC5maXJlKCk7XG5cblx0XHRcdHRoaXMubGFzdEl0ZW0gPSB0cmVlSXRlbXMuYXQoLTEpPy5lbGVtZW50O1xuXHRcdFx0Q2hhdENvbnRleHRLZXlzLmxhc3RJdGVtSWQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpLnNldCh0aGlzLmxhc3RJdGVtID8gW3RoaXMubGFzdEl0ZW0uaWRdIDogW10pO1xuXHRcdFx0dGhpcy50cmVlLnNldENoaWxkcmVuKG51bGwsIHRyZWVJdGVtcywge1xuXHRcdFx0XHRkaWZmSWRlbnRpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldElkOiAoZWxlbWVudCkgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuZGF0YUlkICtcblx0XHRcdFx0XHRcdFx0Ly8gRW5zdXJlIHJlLXJlbmRlcmluZyBhbiBlbGVtZW50IG9uY2Ugc2xhc2ggY29tbWFuZHMgYXJlIGxvYWRlZCwgc28gdGhlIGNvbG9yaXphdGlvbiBjYW4gYmUgYXBwbGllZC5cblx0XHRcdFx0XHRcdFx0YCR7KGlzUmVxdWVzdFZNKGVsZW1lbnQpKSAvKiAmJiAhIXRoaXMubGFzdFNsYXNoQ29tbWFuZHMgPyAnX3NjTG9hZGVkJyA6ICcnICovfWAgK1xuXHRcdFx0XHRcdFx0XHQvLyBJZiBhIHJlc3BvbnNlIGlzIGluIHRoZSBwcm9jZXNzIG9mIHByb2dyZXNzaXZlIHJlbmRlcmluZywgd2UgbmVlZCB0byBlbnN1cmUgdGhhdCBpdCB3aWxsXG5cdFx0XHRcdFx0XHRcdC8vIGJlIHJlLXJlbmRlcmVkIHNvIHByb2dyZXNzaXZlIHJlbmRlcmluZyBpcyByZXN0YXJ0ZWQsIGV2ZW4gaWYgdGhlIG1vZGVsIHdhc24ndCB1cGRhdGVkLlxuXHRcdFx0XHRcdFx0XHRgJHtpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5yZW5kZXJEYXRhID8gYF8ke3RoaXMudmlzaWJsZUNoYW5nZUNvdW50fWAgOiAnJ31gICtcblx0XHRcdFx0XHRcdFx0Ly8gUmUtcmVuZGVyIG9uY2UgY29udGVudCByZWZlcmVuY2VzIGFyZSBsb2FkZWRcblx0XHRcdFx0XHRcdFx0KGlzUmVzcG9uc2VWTShlbGVtZW50KSA/IGBfJHtlbGVtZW50LmNvbnRlbnRSZWZlcmVuY2VzLmxlbmd0aH1gIDogJycpICtcblx0XHRcdFx0XHRcdFx0Ly8gUmUtcmVuZGVyIGlmIGVsZW1lbnQgYmVjb21lcyBoaWRkZW4gZHVlIHRvIHVuZG8vcmVkb1xuXHRcdFx0XHRcdFx0XHRgXyR7ZWxlbWVudC5zaG91bGRCZVJlbW92ZWRPblNlbmQgPyBgJHtlbGVtZW50LnNob3VsZEJlUmVtb3ZlZE9uU2VuZC5hZnRlclVuZG9TdG9wIHx8ICcxJ31gIDogJzAnfWAgK1xuXHRcdFx0XHRcdFx0XHQvLyBSZXJlbmRlciByZXF1ZXN0IGlmIHdlIGdvdCBuZXcgY29udGVudCByZWZlcmVuY2VzIGluIHRoZSByZXNwb25zZVxuXHRcdFx0XHRcdFx0XHQvLyBzaW5jZSB0aGlzIG1heSBjaGFuZ2UgaG93IHdlIHJlbmRlciB0aGUgY29ycmVzcG9uZGluZyBhdHRhY2htZW50cyBpbiB0aGUgcmVxdWVzdFxuXHRcdFx0XHRcdFx0XHQoaXNSZXF1ZXN0Vk0oZWxlbWVudCkgJiYgZWxlbWVudC5jb250ZW50UmVmZXJlbmNlcyA/IGBfJHtlbGVtZW50LmNvbnRlbnRSZWZlcmVuY2VzPy5sZW5ndGh9YCA6ICcnKSArXG5cdFx0XHRcdFx0XHRcdChpc1Jlc3BvbnNlVk0oZWxlbWVudCkgJiYgZWxlbWVudC5tb2RlbC5pc1BhdXNlZC5nZXQoKSA/ICdfcGF1c2VkJyA6ICcnKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKCFza2lwRHluYW1pY0xheW91dCAmJiB0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGEpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXREeW5hbWljQ2hhdFRyZWVJdGVtTW9kZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5sYXN0SXRlbSAmJiBpc1Jlc3BvbnNlVk0odGhpcy5sYXN0SXRlbSkgJiYgdGhpcy5sYXN0SXRlbS5pc0NvbXBsZXRlKSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyRm9sbG93dXBzKHRoaXMubGFzdEl0ZW0ucmVwbHlGb2xsb3d1cHMsIHRoaXMubGFzdEl0ZW0pO1xuXHRcdFx0fSBlbHNlIGlmICghdHJlZUl0ZW1zLmxlbmd0aCAmJiB0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0XHR0aGlzLnJlbmRlclNhbXBsZVF1ZXN0aW9ucygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJGb2xsb3d1cHModW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcldlbGNvbWVWaWV3Q29udGVudElmTmVlZGVkKCkge1xuXHRcdGlmICh0aGlzLnZpZXdPcHRpb25zLnJlbmRlclN0eWxlID09PSAnY29tcGFjdCcgfHwgdGhpcy52aWV3T3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ21pbmltYWwnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbnVtSXRlbXMgPSB0aGlzLnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5sZW5ndGggPz8gMDtcblx0XHRjb25zdCBkZWZhdWx0QWdlbnQgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KHRoaXMubG9jYXRpb24sIHRoaXMuaW5wdXQuY3VycmVudE1vZGUpO1xuXHRcdGNvbnN0IHdlbGNvbWVDb250ZW50ID0gZGVmYXVsdEFnZW50Py5tZXRhZGF0YS53ZWxjb21lTWVzc2FnZUNvbnRlbnQgPz8gdGhpcy5wZXJzaXN0ZWRXZWxjb21lTWVzc2FnZTtcblx0XHRpZiAod2VsY29tZUNvbnRlbnQgJiYgIW51bUl0ZW1zICYmICh0aGlzLndlbGNvbWVNZXNzYWdlQ29udGFpbmVyLmNoaWxkcmVuLmxlbmd0aCA9PT0gMCB8fCB0aGlzLmNoYXRTZXJ2aWNlLnVuaWZpZWRWaWV3RW5hYmxlZCkpIHtcblx0XHRcdGRvbS5jbGVhck5vZGUodGhpcy53ZWxjb21lTWVzc2FnZUNvbnRhaW5lcik7XG5cdFx0XHRjb25zdCB0aXBzID0gdGhpcy52aWV3T3B0aW9ucy5zdXBwb3J0c0FkZGl0aW9uYWxQYXJ0aWNpcGFudHNcblx0XHRcdFx0PyBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ2NoYXRXaWRnZXQudGlwcycsIFwiezB9IG9yIHR5cGUgezF9IHRvIGF0dGFjaCBjb250ZXh0XFxuXFxuezJ9IHRvIGNoYXQgd2l0aCBleHRlbnNpb25zXFxuXFxuVHlwZSB7M30gdG8gdXNlIGNvbW1hbmRzXCIsICckKGF0dGFjaCknLCAnIycsICckKG1lbnRpb24pJywgJy8nKSwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KVxuXHRcdFx0XHQ6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnY2hhdFdpZGdldC50aXBzLndpdGhvdXRQYXJ0aWNpcGFudHMnLCBcInswfSBvciB0eXBlIHsxfSB0byBhdHRhY2ggY29udGV4dFwiLCAnJChhdHRhY2gpJywgJyMnKSwgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblx0XHRcdHRoaXMud2VsY29tZVBhcnQudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRDaGF0Vmlld1dlbGNvbWVQYXJ0LFxuXHRcdFx0XHR7IC4uLndlbGNvbWVDb250ZW50LCB0aXBzLCB9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bG9jYXRpb246IHRoaXMubG9jYXRpb24sXG5cdFx0XHRcdFx0aXNXaWRnZXRBZ2VudFdlbGNvbWVWaWV3Q29udGVudDogdGhpcy5pbnB1dD8uY3VycmVudE1vZGUgPT09IENoYXRNb2RlLkFnZW50XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRkb20uYXBwZW5kKHRoaXMud2VsY29tZU1lc3NhZ2VDb250YWluZXIsIHRoaXMud2VsY29tZVBhcnQudmFsdWUuZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRkb20uc2V0VmlzaWJpbGl0eShudW1JdGVtcyA9PT0gMCwgdGhpcy53ZWxjb21lTWVzc2FnZUNvbnRhaW5lcik7XG5cdFx0XHRkb20uc2V0VmlzaWJpbGl0eShudW1JdGVtcyAhPT0gMCwgdGhpcy5saXN0Q29udGFpbmVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlbmRlckNoYXRFZGl0aW5nU2Vzc2lvblN0YXRlKCkge1xuXHRcdGlmICghdGhpcy5pbnB1dFBhcnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5pbnB1dFBhcnQucmVuZGVyQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUodGhpcy5fZWRpdGluZ1Nlc3Npb24uZ2V0KCkgPz8gbnVsbCk7XG5cblx0XHRpZiAodGhpcy5ib2R5RGltZW5zaW9uKSB7XG5cdFx0XHR0aGlzLmxheW91dCh0aGlzLmJvZHlEaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmJvZHlEaW1lbnNpb24ud2lkdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2FtcGxlUXVlc3Rpb25zKCkge1xuXHRcdGlmICh0aGlzLnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdC8vIFRPRE9Acm9ibG91cmVucyBoYWNrLSBvbmx5IENoYXQgbW9kZSBzdXBwb3J0cyBzYW1wbGUgcXVlc3Rpb25zXG5cdFx0XHR0aGlzLnJlbmRlckZvbGxvd3Vwcyh0aGlzLmlucHV0LmN1cnJlbnRNb2RlID09PSBDaGF0TW9kZS5Bc2sgPyB0aGlzLnZpZXdNb2RlbC5tb2RlbC5zYW1wbGVRdWVzdGlvbnMgOiB1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyRm9sbG93dXBzKGl0ZW1zOiBJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQsIHJlc3BvbnNlPzogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuaW5wdXRQYXJ0LnJlbmRlckZvbGxvd3VwcyhpdGVtcywgcmVzcG9uc2UpO1xuXG5cdFx0aWYgKHRoaXMuYm9keURpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5sYXlvdXQodGhpcy5ib2R5RGltZW5zaW9uLmhlaWdodCwgdGhpcy5ib2R5RGltZW5zaW9uLndpZHRoKTtcblx0XHR9XG5cdH1cblxuXHRzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCB3YXNWaXNpYmxlID0gdGhpcy5fdmlzaWJsZTtcblx0XHR0aGlzLl92aXNpYmxlID0gdmlzaWJsZTtcblx0XHR0aGlzLnZpc2libGVDaGFuZ2VDb3VudCsrO1xuXHRcdHRoaXMucmVuZGVyZXIuc2V0VmlzaWJsZSh2aXNpYmxlKTtcblx0XHR0aGlzLmlucHV0LnNldFZpc2libGUodmlzaWJsZSk7XG5cblx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHQvLyBQcm9ncmVzc2l2ZSByZW5kZXJpbmcgcGF1c2VkIHdoaWxlIGhpZGRlbiwgc28gc3RhcnQgaXQgdXAgYWdhaW4uXG5cdFx0XHRcdC8vIERvIGl0IGFmdGVyIGEgdGltZW91dCBiZWNhdXNlIHRoZSBjb250YWluZXIgaXMgbm90IHZpc2libGUgeWV0IChpdCBzaG91bGQgYmUgYnV0IG9mZnNldEhlaWdodCByZXR1cm5zIDAgaGVyZSlcblx0XHRcdFx0aWYgKHRoaXMuX3Zpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLm9uRGlkQ2hhbmdlSXRlbXModHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDApKTtcblx0XHR9IGVsc2UgaWYgKHdhc1Zpc2libGUpIHtcblx0XHRcdHRoaXMuX29uRGlkSGlkZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVMaXN0KGxpc3RDb250YWluZXI6IEhUTUxFbGVtZW50LCBvcHRpb25zOiBJQ2hhdExpc3RJdGVtUmVuZGVyZXJPcHRpb25zKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblx0XHRjb25zdCBkZWxlZ2F0ZSA9IHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRMaXN0RGVsZWdhdGUsIHRoaXMudmlld09wdGlvbnMuZGVmYXVsdEVsZW1lbnRIZWlnaHQgPz8gMjAwKTtcblx0XHRjb25zdCByZW5kZXJlckRlbGVnYXRlOiBJQ2hhdFJlbmRlcmVyRGVsZWdhdGUgPSB7XG5cdFx0XHRnZXRMaXN0TGVuZ3RoOiAoKSA9PiB0aGlzLnRyZWUuZ2V0Tm9kZShudWxsKS52aXNpYmxlQ2hpbGRyZW5Db3VudCxcblx0XHRcdG9uRGlkU2Nyb2xsOiB0aGlzLm9uRGlkU2Nyb2xsLFxuXHRcdFx0Y29udGFpbmVyOiBsaXN0Q29udGFpbmVyLFxuXHRcdFx0Y3VycmVudENoYXRNb2RlOiAoKSA9PiB0aGlzLmlucHV0LmN1cnJlbnRNb2RlLFxuXHRcdH07XG5cblx0XHQvLyBDcmVhdGUgYSBkb20gZWxlbWVudCB0byBob2xkIFVJIGZyb20gZWRpdG9yIHdpZGdldHMgZW1iZWRkZWQgaW4gY2hhdCBtZXNzYWdlc1xuXHRcdGNvbnN0IG92ZXJmbG93V2lkZ2V0c0NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG92ZXJmbG93V2lkZ2V0c0NvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdjaGF0LW92ZXJmbG93LXdpZGdldC1jb250YWluZXInLCAnbW9uYWNvLWVkaXRvcicpO1xuXHRcdGxpc3RDb250YWluZXIuYXBwZW5kKG92ZXJmbG93V2lkZ2V0c0NvbnRhaW5lcik7XG5cblx0XHR0aGlzLnJlbmRlcmVyID0gdGhpcy5fcmVnaXN0ZXIoc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDaGF0TGlzdEl0ZW1SZW5kZXJlcixcblx0XHRcdHRoaXMuZWRpdG9yT3B0aW9ucyxcblx0XHRcdG9wdGlvbnMsXG5cdFx0XHRyZW5kZXJlckRlbGVnYXRlLFxuXHRcdFx0dGhpcy5fY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLFxuXHRcdFx0b3ZlcmZsb3dXaWRnZXRzQ29udGFpbmVyLFxuXHRcdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVuZGVyZXIub25EaWRDbGlja0ZvbGxvd3VwKGl0ZW0gPT4ge1xuXHRcdFx0Ly8gaXMgdGhpcyB1c2VkIGFueW1vcmU/XG5cdFx0XHR0aGlzLmFjY2VwdElucHV0KGl0ZW0ubWVzc2FnZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVuZGVyZXIub25EaWRDbGlja1JlcnVuV2l0aEFnZW50T3JDb21tYW5kRGV0ZWN0aW9uKGl0ZW0gPT4ge1xuXHRcdFx0Y29uc3QgcmVxdWVzdCA9IHRoaXMuY2hhdFNlcnZpY2UuZ2V0U2Vzc2lvbihpdGVtLnNlc3Npb25JZCk/LmdldFJlcXVlc3RzKCkuZmluZChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmlkID09PSBpdGVtLnJlcXVlc3RJZCk7XG5cdFx0XHRpZiAocmVxdWVzdCkge1xuXHRcdFx0XHRjb25zdCBvcHRpb25zOiBJQ2hhdFNlbmRSZXF1ZXN0T3B0aW9ucyA9IHtcblx0XHRcdFx0XHRub0NvbW1hbmREZXRlY3Rpb246IHRydWUsXG5cdFx0XHRcdFx0YXR0ZW1wdDogcmVxdWVzdC5hdHRlbXB0ICsgMSxcblx0XHRcdFx0XHRsb2NhdGlvbjogdGhpcy5sb2NhdGlvbixcblx0XHRcdFx0XHR1c2VyU2VsZWN0ZWRNb2RlbElkOiB0aGlzLmlucHV0LmN1cnJlbnRMYW5ndWFnZU1vZGVsLFxuXHRcdFx0XHRcdGhhc0luc3RydWN0aW9uQXR0YWNobWVudHM6IHRoaXMuaW5wdXQuaGFzSW5zdHJ1Y3Rpb25BdHRhY2htZW50cyxcblx0XHRcdFx0XHRtb2RlOiB0aGlzLmlucHV0LmN1cnJlbnRNb2RlLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHR0aGlzLmNoYXRTZXJ2aWNlLnJlc2VuZFJlcXVlc3QocmVxdWVzdCwgb3B0aW9ucykuY2F0Y2goZSA9PiB0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0ZBSUxFRCB0byByZXJ1biByZXF1ZXN0JywgZSkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMudHJlZSA9IHRoaXMuX3JlZ2lzdGVyKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoT2JqZWN0VHJlZTxDaGF0VHJlZUl0ZW0sIEZ1enp5U2NvcmU+LFxuXHRcdFx0J0NoYXQnLFxuXHRcdFx0bGlzdENvbnRhaW5lcixcblx0XHRcdGRlbGVnYXRlLFxuXHRcdFx0W3RoaXMucmVuZGVyZXJdLFxuXHRcdFx0e1xuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7IGdldElkOiAoZTogQ2hhdFRyZWVJdGVtKSA9PiBlLmlkIH0sXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdHN1cHBvcnREeW5hbWljSGVpZ2h0czogdHJ1ZSxcblx0XHRcdFx0aGlkZVR3aXN0aWVzT2ZDaGlsZGxlc3NFbGVtZW50czogdHJ1ZSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRBY2Nlc3NpYmlsaXR5UHJvdmlkZXIpLFxuXHRcdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB7IGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsOiAoZTogQ2hhdFRyZWVJdGVtKSA9PiBpc1JlcXVlc3RWTShlKSA/IGUubWVzc2FnZSA6IGlzUmVzcG9uc2VWTShlKSA/IGUucmVzcG9uc2UudmFsdWUgOiAnJyB9LCAvLyBUT0RPXG5cdFx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHRmaWx0ZXI6IHRoaXMudmlld09wdGlvbnMuZmlsdGVyID8geyBmaWx0ZXI6IHRoaXMudmlld09wdGlvbnMuZmlsdGVyLmJpbmQodGhpcy52aWV3T3B0aW9ucyksIH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdHNjcm9sbFRvQWN0aXZlRWxlbWVudDogdHJ1ZSxcblx0XHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHtcblx0XHRcdFx0XHRsaXN0Rm9jdXNCYWNrZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQ6IHRoaXMuc3R5bGVzLmxpc3RCYWNrZ3JvdW5kLFxuXHRcdFx0XHRcdGxpc3RBY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25CYWNrZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0SG92ZXJCYWNrZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCxcblx0XHRcdFx0XHRsaXN0QmFja2dyb3VuZDogdGhpcy5zdHlsZXMubGlzdEJhY2tncm91bmQsXG5cdFx0XHRcdFx0bGlzdEZvY3VzRm9yZWdyb3VuZDogdGhpcy5zdHlsZXMubGlzdEZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEhvdmVyRm9yZWdyb3VuZDogdGhpcy5zdHlsZXMubGlzdEZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEluYWN0aXZlRm9jdXNGb3JlZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0Rm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kOiB0aGlzLnN0eWxlcy5saXN0Rm9yZWdyb3VuZCxcblx0XHRcdFx0XHRsaXN0QWN0aXZlU2VsZWN0aW9uRm9yZWdyb3VuZDogdGhpcy5zdHlsZXMubGlzdEZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEZvY3VzQW5kU2VsZWN0aW9uRm9yZWdyb3VuZDogdGhpcy5zdHlsZXMubGlzdEZvcmVncm91bmQsXG5cdFx0XHRcdFx0bGlzdEFjdGl2ZVNlbGVjdGlvbkljb25Gb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0bGlzdEluYWN0aXZlU2VsZWN0aW9uSWNvbkZvcmVncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkNvbnRleHRNZW51KGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0KCgpID0+IHtcblx0XHRcdHRoaXMub25EaWRDaGFuZ2VUcmVlQ29udGVudEhlaWdodCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlbmRlcmVyLm9uRGlkQ2hhbmdlSXRlbUhlaWdodChlID0+IHtcblx0XHRcdHRoaXMudHJlZS51cGRhdGVFbGVtZW50SGVpZ2h0KGUuZWxlbWVudCwgZS5oZWlnaHQpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkU2Nyb2xsKCgpID0+IHtcblx0XHRcdHRoaXMuX29uRGlkU2Nyb2xsLmZpcmUoKTtcblxuXHRcdFx0Y29uc3QgaXNTY3JvbGxlZERvd24gPSB0aGlzLnRyZWUuc2Nyb2xsVG9wID49IHRoaXMudHJlZS5zY3JvbGxIZWlnaHQgLSB0aGlzLnRyZWUucmVuZGVySGVpZ2h0IC0gMjtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3Nob3ctc2Nyb2xsLWRvd24nLCAhaXNTY3JvbGxlZERvd24gJiYgIXRoaXMuc2Nyb2xsTG9jayk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRNZW51KGU6IElUcmVlQ29udGV4dE1lbnVFdmVudDxDaGF0VHJlZUl0ZW0gfCBudWxsPik6IHZvaWQge1xuXHRcdGUuYnJvd3NlckV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5icm93c2VyRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRjb25zdCBzZWxlY3RlZCA9IGUuZWxlbWVudDtcblx0XHRjb25zdCBzY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShbXG5cdFx0XHRbQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlSXNGaWx0ZXJlZC5rZXksIGlzUmVzcG9uc2VWTShzZWxlY3RlZCkgJiYgISFzZWxlY3RlZC5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNGaWx0ZXJlZF1cblx0XHRdKTtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0bWVudUlkOiBNZW51SWQuQ2hhdENvbnRleHQsXG5cdFx0XHRtZW51QWN0aW9uT3B0aW9uczogeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9LFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2U6IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBlLmFuY2hvcixcblx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiBzZWxlY3RlZCxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VUcmVlQ29udGVudEhlaWdodCgpOiB2b2lkIHtcblx0XHQvLyBJZiB0aGUgbGlzdCB3YXMgcHJldmlvdXNseSBzY3JvbGxlZCBhbGwgdGhlIHdheSBkb3duLCBlbnN1cmUgaXQgc3RheXMgc2Nyb2xsZWQgZG93biwgaWYgc2Nyb2xsIGxvY2sgaXMgb25cblx0XHRpZiAodGhpcy50cmVlLnNjcm9sbEhlaWdodCAhPT0gdGhpcy5wcmV2aW91c1RyZWVTY3JvbGxIZWlnaHQpIHtcblx0XHRcdGNvbnN0IGxhc3RJdGVtID0gdGhpcy52aWV3TW9kZWw/LmdldEl0ZW1zKCkuYXQoLTEpO1xuXHRcdFx0Y29uc3QgbGFzdFJlc3BvbnNlSXNSZW5kZXJpbmcgPSBpc1Jlc3BvbnNlVk0obGFzdEl0ZW0pICYmIGxhc3RJdGVtLnJlbmRlckRhdGE7XG5cdFx0XHRpZiAoIWxhc3RSZXNwb25zZUlzUmVuZGVyaW5nIHx8IHRoaXMuc2Nyb2xsTG9jaykge1xuXHRcdFx0XHQvLyBEdWUgdG8gcm91bmRpbmcsIHRoZSBzY3JvbGxUb3AgKyByZW5kZXJIZWlnaHQgd2lsbCBub3QgZXhhY3RseSBtYXRjaCB0aGUgc2Nyb2xsSGVpZ2h0LlxuXHRcdFx0XHQvLyBDb25zaWRlciB0aGUgdHJlZSB0byBiZSBzY3JvbGxlZCBhbGwgdGhlIHdheSBkb3duIGlmIGl0IGlzIHdpdGhpbiAycHggb2YgdGhlIGJvdHRvbS5cblx0XHRcdFx0Y29uc3QgbGFzdEVsZW1lbnRXYXNWaXNpYmxlID0gdGhpcy50cmVlLnNjcm9sbFRvcCArIHRoaXMudHJlZS5yZW5kZXJIZWlnaHQgPj0gdGhpcy5wcmV2aW91c1RyZWVTY3JvbGxIZWlnaHQgLSAyO1xuXHRcdFx0XHRpZiAobGFzdEVsZW1lbnRXYXNWaXNpYmxlKSB7XG5cdFx0XHRcdFx0ZG9tLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZG9tLmdldFdpbmRvdyh0aGlzLmxpc3RDb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBDYW4ndCBzZXQgc2Nyb2xsVG9wIGR1cmluZyB0aGlzIGV2ZW50IGxpc3RlbmVyLCB0aGUgbGlzdCBtaWdodCBvdmVyd3JpdGUgdGhlIGNoYW5nZVxuXG5cdFx0XHRcdFx0XHR0aGlzLnNjcm9sbFRvRW5kKCk7XG5cdFx0XHRcdFx0fSwgMCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUT0RPQHJvYmxvdXJlbnMgYWRkIGBzaG93LXNjcm9sbC1kb3duYCBjbGFzcyB3aGVuIGJ1dHRvbiBzaG91bGQgc2hvd1xuXHRcdC8vIFNob3cgdGhlIGJ1dHRvbiB3aGVuIGNvbnRlbnQgaGVpZ2h0IGNoYW5nZXMsIHRoZSBsaXN0IGlzIG5vdCBmdWxseSBzY3JvbGxlZCBkb3duLCBhbmQgKHRoZSBsYXRlc3QgcmVzcG9uc2UgaXMgY3VycmVudGx5IHJlbmRlcmluZyBPUiBJIGhhdmVuJ3QgeWV0IHNjcm9sbGVkIGFsbCB0aGUgd2F5IGRvd24gc2luY2UgdGhlIGxhc3QgcmVzcG9uc2UpXG5cdFx0Ly8gU28gZm9yIGV4YW1wbGUgaXQgd291bGQgbm90IHJlYXBwZWFyIGlmIEkgc2Nyb2xsIHVwIGFuZCBkZWxldGUgYSBtZXNzYWdlXG5cblx0XHR0aGlzLnByZXZpb3VzVHJlZVNjcm9sbEhlaWdodCA9IHRoaXMudHJlZS5zY3JvbGxIZWlnaHQ7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V2lkZ2V0Vmlld0tpbmRUYWcoKTogc3RyaW5nIHtcblx0XHRpZiAoIXRoaXMudmlld0NvbnRleHQpIHtcblx0XHRcdHJldHVybiAnZWRpdG9yJztcblx0XHR9IGVsc2UgaWYgKCd2aWV3SWQnIGluIHRoaXMudmlld0NvbnRleHQpIHtcblx0XHRcdHJldHVybiAndmlldyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAncXVpY2snO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSW5wdXQoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgb3B0aW9ucz86IHsgcmVuZGVyRm9sbG93dXBzOiBib29sZWFuOyByZW5kZXJTdHlsZT86ICdjb21wYWN0JyB8ICdtaW5pbWFsJyB9KTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dFBhcnQgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRJbnB1dFBhcnQsXG5cdFx0XHR0aGlzLmxvY2F0aW9uLFxuXHRcdFx0e1xuXHRcdFx0XHRyZW5kZXJGb2xsb3d1cHM6IG9wdGlvbnM/LnJlbmRlckZvbGxvd3VwcyA/PyB0cnVlLFxuXHRcdFx0XHRyZW5kZXJTdHlsZTogb3B0aW9ucz8ucmVuZGVyU3R5bGUgPT09ICdtaW5pbWFsJyA/ICdjb21wYWN0JyA6IG9wdGlvbnM/LnJlbmRlclN0eWxlLFxuXHRcdFx0XHRtZW51czogeyBleGVjdXRlVG9vbGJhcjogTWVudUlkLkNoYXRFeGVjdXRlLCAuLi50aGlzLnZpZXdPcHRpb25zLm1lbnVzIH0sXG5cdFx0XHRcdGVkaXRvck92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IHRoaXMudmlld09wdGlvbnMuZWRpdG9yT3ZlcmZsb3dXaWRnZXRzRG9tTm9kZSxcblx0XHRcdFx0ZW5hYmxlSW1wbGljaXRDb250ZXh0OiB0aGlzLnZpZXdPcHRpb25zLmVuYWJsZUltcGxpY2l0Q29udGV4dCxcblx0XHRcdFx0cmVuZGVyV29ya2luZ1NldDogdGhpcy52aWV3T3B0aW9ucy5lbmFibGVXb3JraW5nU2V0ID09PSAnZXhwbGljaXQnLFxuXHRcdFx0XHRzdXBwb3J0c0NoYW5naW5nTW9kZXM6IHRoaXMudmlld09wdGlvbnMuc3VwcG9ydHNDaGFuZ2luZ01vZGVzLFxuXHRcdFx0XHR3aWRnZXRWaWV3S2luZFRhZzogdGhpcy5nZXRXaWRnZXRWaWV3S2luZFRhZygpXG5cdFx0XHR9LFxuXHRcdFx0dGhpcy5zdHlsZXMsXG5cdFx0XHQoKSA9PiB0aGlzLmNvbGxlY3RJbnB1dFN0YXRlKClcblx0XHQpKTtcblx0XHR0aGlzLmlucHV0UGFydC5yZW5kZXIoY29udGFpbmVyLCAnJywgdGhpcyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0UGFydC5vbkRpZExvYWRJbnB1dFN0YXRlKHN0YXRlID0+IHtcblx0XHRcdHRoaXMuY29udHJpYnMuZm9yRWFjaChjID0+IHtcblx0XHRcdFx0aWYgKGMuc2V0SW5wdXRTdGF0ZSkge1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRyaWJTdGF0ZSA9ICh0eXBlb2Ygc3RhdGUgPT09ICdvYmplY3QnICYmIHN0YXRlPy5bYy5pZF0pID8/IHt9O1xuXHRcdFx0XHRcdGMuc2V0SW5wdXRTdGF0ZShjb250cmliU3RhdGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRQYXJ0Lm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5fb25EaWRGb2N1cy5maXJlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0UGFydC5vbkRpZEFjY2VwdEZvbGxvd3VwKGUgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxldCBtc2cgPSAnJztcblx0XHRcdGlmIChlLmZvbGxvd3VwLmFnZW50SWQgJiYgZS5mb2xsb3d1cC5hZ2VudElkICE9PSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0RGVmYXVsdEFnZW50KHRoaXMubG9jYXRpb24sIHRoaXMuaW5wdXQuY3VycmVudE1vZGUpPy5pZCkge1xuXHRcdFx0XHRjb25zdCBhZ2VudCA9IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXRBZ2VudChlLmZvbGxvd3VwLmFnZW50SWQpO1xuXHRcdFx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5sYXN0U2VsZWN0ZWRBZ2VudCA9IGFnZW50O1xuXHRcdFx0XHRtc2cgPSBgJHtjaGF0QWdlbnRMZWFkZXJ9JHthZ2VudC5uYW1lfSBgO1xuXHRcdFx0XHRpZiAoZS5mb2xsb3d1cC5zdWJDb21tYW5kKSB7XG5cdFx0XHRcdFx0bXNnICs9IGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7ZS5mb2xsb3d1cC5zdWJDb21tYW5kfSBgO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKCFlLmZvbGxvd3VwLmFnZW50SWQgJiYgZS5mb2xsb3d1cC5zdWJDb21tYW5kICYmIHRoaXMuY2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UuaGFzQ29tbWFuZChlLmZvbGxvd3VwLnN1YkNvbW1hbmQpKSB7XG5cdFx0XHRcdG1zZyA9IGAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7ZS5mb2xsb3d1cC5zdWJDb21tYW5kfSBgO1xuXHRcdFx0fVxuXG5cdFx0XHRtc2cgKz0gZS5mb2xsb3d1cC5tZXNzYWdlO1xuXHRcdFx0dGhpcy5hY2NlcHRJbnB1dChtc2cpO1xuXG5cdFx0XHRpZiAoIWUucmVzcG9uc2UpIHtcblx0XHRcdFx0Ly8gRm9sbG93dXBzIGNhbiBiZSBzaG93biBieSB0aGUgd2VsY29tZSBtZXNzYWdlLCB0aGVuIHRoZXJlIGlzIG5vIHJlc3BvbnNlIGFzc29jaWF0ZWQuXG5cdFx0XHRcdC8vIEF0IHNvbWUgcG9pbnQgd2UgcHJvYmFibHkgd2FudCB0ZWxlbWV0cnkgZm9yIHRoZXNlIHRvby5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNoYXRTZXJ2aWNlLm5vdGlmeVVzZXJBY3Rpb24oe1xuXHRcdFx0XHRzZXNzaW9uSWQ6IHRoaXMudmlld01vZGVsLnNlc3Npb25JZCxcblx0XHRcdFx0cmVxdWVzdElkOiBlLnJlc3BvbnNlLnJlcXVlc3RJZCxcblx0XHRcdFx0YWdlbnRJZDogZS5yZXNwb25zZS5hZ2VudD8uaWQsXG5cdFx0XHRcdGNvbW1hbmQ6IGUucmVzcG9uc2Uuc2xhc2hDb21tYW5kPy5uYW1lLFxuXHRcdFx0XHRyZXN1bHQ6IGUucmVzcG9uc2UucmVzdWx0LFxuXHRcdFx0XHRhY3Rpb246IHtcblx0XHRcdFx0XHRraW5kOiAnZm9sbG93VXAnLFxuXHRcdFx0XHRcdGZvbGxvd3VwOiBlLmZvbGxvd3VwXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhcnQub25EaWRDaGFuZ2VIZWlnaHQoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuYm9keURpbWVuc2lvbikge1xuXHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLmJvZHlEaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmJvZHlEaW1lbnNpb24ud2lkdGgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhcnQuYXR0YWNobWVudE1vZGVsLm9uRGlkQ2hhbmdlQ29udGV4dCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdGluZ1Nlc3Npb24pIHtcblx0XHRcdFx0Ly8gVE9ETyBzdGlsbCBuZWVkZWQ/IERvIHRoaXMgaW5zaWRlIGlucHV0IHBhcnQgYW5kIGZpcmUgb25EaWRDaGFuZ2VIZWlnaHQ/XG5cdFx0XHRcdHRoaXMucmVuZGVyQ2hhdEVkaXRpbmdTZXNzaW9uU3RhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHR0aGlzLnBhcnNlZENoYXRSZXF1ZXN0ID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy51cGRhdGVDaGF0SW5wdXRDb250ZXh0KCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhdEFnZW50U2VydmljZS5vbkRpZENoYW5nZUFnZW50cygoKSA9PiB7XG5cdFx0XHR0aGlzLnBhcnNlZENoYXRSZXF1ZXN0ID0gdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBUb29scyBhZ2VudCBsb2FkcyAtPiB3ZWxjb21lIGNvbnRlbnQgY2hhbmdlc1xuXHRcdFx0dGhpcy5yZW5kZXJXZWxjb21lVmlld0NvbnRlbnRJZk5lZWRlZCgpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0Lm9uRGlkQ2hhbmdlQ3VycmVudENoYXRNb2RlKCgpID0+IHtcblx0XHRcdHRoaXMucmVuZGVyU2FtcGxlUXVlc3Rpb25zKCk7XG5cdFx0XHR0aGlzLnJlbmRlcldlbGNvbWVWaWV3Q29udGVudElmTmVlZGVkKCk7XG5cdFx0XHR0aGlzLnJlZnJlc2hQYXJzZWRJbnB1dCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRTdHlsZUNoYW5nZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS12c2NvZGUtaW50ZXJhY3RpdmUtcmVzdWx0LWVkaXRvci1iYWNrZ3JvdW5kLWNvbG9yJywgdGhpcy5lZGl0b3JPcHRpb25zLmNvbmZpZ3VyYXRpb24ucmVzdWx0RWRpdG9yLmJhY2tncm91bmRDb2xvcj8udG9TdHJpbmcoKSA/PyAnJyk7XG5cdFx0dGhpcy5jb250YWluZXIuc3R5bGUuc2V0UHJvcGVydHkoJy0tdnNjb2RlLWludGVyYWN0aXZlLXNlc3Npb24tZm9yZWdyb3VuZCcsIHRoaXMuZWRpdG9yT3B0aW9ucy5jb25maWd1cmF0aW9uLmZvcmVncm91bmQ/LnRvU3RyaW5nKCkgPz8gJycpO1xuXHRcdHRoaXMuY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLXZzY29kZS1jaGF0LWxpc3QtYmFja2dyb3VuZCcsIHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcih0aGlzLnN0eWxlcy5saXN0QmFja2dyb3VuZCk/LnRvU3RyaW5nKCkgPz8gJycpO1xuXHR9XG5cblx0dG9nZ2xlUGF1c2VkKCkge1xuXHRcdHRoaXMudmlld01vZGVsPy5tb2RlbC50b2dnbGVMYXN0UmVxdWVzdFBhdXNlZCgpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VJdGVtcygpO1xuXHR9XG5cblx0c2V0TW9kZWwobW9kZWw6IElDaGF0TW9kZWwsIHZpZXdTdGF0ZTogSUNoYXRWaWV3U3RhdGUpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuY29udGFpbmVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhbGwgcmVuZGVyKCkgYmVmb3JlIHNldE1vZGVsKCknKTtcblx0XHR9XG5cblx0XHRpZiAobW9kZWwuc2Vzc2lvbklkID09PSB0aGlzLnZpZXdNb2RlbD8uc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLmNsZWFyKCk7XG5cblx0XHR0aGlzLmNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2RhdGEtc2Vzc2lvbi1pZCcsIG1vZGVsLnNlc3Npb25JZCk7XG5cdFx0dGhpcy52aWV3TW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRWaWV3TW9kZWwsIG1vZGVsLCB0aGlzLl9jb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24pO1xuXHRcdHRoaXMudmlld01vZGVsRGlzcG9zYWJsZXMuYWRkKEV2ZW50LmFjY3VtdWxhdGUodGhpcy52aWV3TW9kZWwub25EaWRDaGFuZ2UsIDApKGV2ZW50cyA9PiB7XG5cdFx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5yZXF1ZXN0SW5Qcm9ncmVzcy5zZXQodGhpcy52aWV3TW9kZWwucmVxdWVzdEluUHJvZ3Jlc3MpO1xuXHRcdFx0dGhpcy5pc1JlcXVlc3RQYXVzZWQuc2V0KHRoaXMudmlld01vZGVsLnJlcXVlc3RQYXVzaWJpbGl0eSA9PT0gQ2hhdFBhdXNlU3RhdGUuUGF1c2VkKTtcblx0XHRcdHRoaXMuY2FuUmVxdWVzdEJlUGF1c2VkLnNldCh0aGlzLnZpZXdNb2RlbC5yZXF1ZXN0UGF1c2liaWxpdHkgIT09IENoYXRQYXVzZVN0YXRlLk5vdFBhdXNhYmxlKTtcblxuXHRcdFx0dGhpcy5vbkRpZENoYW5nZUl0ZW1zKCk7XG5cdFx0XHRpZiAoZXZlbnRzLnNvbWUoZSA9PiBlPy5raW5kID09PSAnYWRkUmVxdWVzdCcpICYmIHRoaXMudmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLnNjcm9sbFRvRW5kKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9lZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0XHR0aGlzLnJlbmRlckNoYXRFZGl0aW5nU2Vzc2lvblN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudmlld01vZGVsRGlzcG9zYWJsZXMuYWRkKHRoaXMudmlld01vZGVsLm9uRGlkRGlzcG9zZU1vZGVsKCgpID0+IHtcblx0XHRcdC8vIEVuc3VyZSB0aGF0IHZpZXcgc3RhdGUgaXMgc2F2ZWQgaGVyZSwgYmVjYXVzZSB3ZSB3aWxsIGxvYWQgaXQgYWdhaW4gd2hlbiBhIG5ldyBtb2RlbCBpcyBhc3NpZ25lZFxuXHRcdFx0dGhpcy5pbnB1dFBhcnQuc2F2ZVN0YXRlKCk7XG5cblx0XHRcdC8vIERpc3Bvc2VzIHRoZSB2aWV3bW9kZWwgYW5kIGxpc3RlbmVyc1xuXHRcdFx0dGhpcy52aWV3TW9kZWwgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlSXRlbXMoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5pbnB1dFBhcnQuaW5pdEZvck5ld0NoYXRNb2RlbCh2aWV3U3RhdGUsIG1vZGVsLmdldFJlcXVlc3RzKCkubGVuZ3RoID09PSAwKTtcblx0XHR0aGlzLmNvbnRyaWJzLmZvckVhY2goYyA9PiB7XG5cdFx0XHRpZiAoYy5zZXRJbnB1dFN0YXRlICYmIHZpZXdTdGF0ZS5pbnB1dFN0YXRlPy5bYy5pZF0pIHtcblx0XHRcdFx0Yy5zZXRJbnB1dFN0YXRlKHZpZXdTdGF0ZS5pbnB1dFN0YXRlPy5bYy5pZF0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cdFx0dGhpcy52aWV3TW9kZWxEaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09ICdzZXRBZ2VudCcpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBZ2VudC5maXJlKHsgYWdlbnQ6IGUuYWdlbnQsIHNsYXNoQ29tbWFuZDogZS5jb21tYW5kIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmICh0aGlzLnRyZWUgJiYgdGhpcy52aXNpYmxlKSB7XG5cdFx0XHR0aGlzLm9uRGlkQ2hhbmdlSXRlbXMoKTtcblx0XHRcdHRoaXMuc2Nyb2xsVG9FbmQoKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZUNoYXRJbnB1dENvbnRleHQoKTtcblx0fVxuXG5cdGdldEZvY3VzKCk6IENoYXRUcmVlSXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZS5nZXRGb2N1cygpWzBdID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdHJldmVhbChpdGVtOiBDaGF0VHJlZUl0ZW0sIHJlbGF0aXZlVG9wPzogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy50cmVlLnJldmVhbChpdGVtLCByZWxhdGl2ZVRvcCk7XG5cdH1cblxuXHRmb2N1cyhpdGVtOiBDaGF0VHJlZUl0ZW0pOiB2b2lkIHtcblx0XHRjb25zdCBpdGVtcyA9IHRoaXMudHJlZS5nZXROb2RlKG51bGwpLmNoaWxkcmVuO1xuXHRcdGNvbnN0IG5vZGUgPSBpdGVtcy5maW5kKGkgPT4gaS5lbGVtZW50Py5pZCA9PT0gaXRlbS5pZCk7XG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50cmVlLnNldEZvY3VzKFtub2RlLmVsZW1lbnRdKTtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0fVxuXG5cdHJlZmlsdGVyKCkge1xuXHRcdHRoaXMudHJlZS5yZWZpbHRlcigpO1xuXHR9XG5cblx0c2V0SW5wdXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3TW9kZWw/LnNldElucHV0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXIpO1xuXHR9XG5cblx0cmVzZXRJbnB1dFBsYWNlaG9sZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMudmlld01vZGVsPy5yZXNldElucHV0UGxhY2Vob2xkZXIoKTtcblx0fVxuXG5cdHNldElucHV0KHZhbHVlID0gJycpOiB2b2lkIHtcblx0XHR0aGlzLmlucHV0UGFydC5zZXRWYWx1ZSh2YWx1ZSwgZmFsc2UpO1xuXHRcdHRoaXMucmVmcmVzaFBhcnNlZElucHV0KCk7XG5cdH1cblxuXHRnZXRJbnB1dCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGFydC5pbnB1dEVkaXRvci5nZXRWYWx1ZSgpO1xuXHR9XG5cblx0bG9nSW5wdXRIaXN0b3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRQYXJ0LmxvZ0lucHV0SGlzdG9yeSgpO1xuXHR9XG5cblx0YXN5bmMgYWNjZXB0SW5wdXQocXVlcnk/OiBzdHJpbmcsIG9wdGlvbnM/OiBJQ2hhdEFjY2VwdElucHV0T3B0aW9ucyk6IFByb21pc2U8SUNoYXRSZXNwb25zZU1vZGVsIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjY2VwdElucHV0KHF1ZXJ5ID8geyBxdWVyeSB9IDogdW5kZWZpbmVkLCBvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIHJlcnVuTGFzdFJlcXVlc3QoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHRoaXMudmlld01vZGVsLnNlc3Npb25JZDtcblx0XHRjb25zdCBsYXN0UmVxdWVzdCA9IHRoaXMuY2hhdFNlcnZpY2UuZ2V0U2Vzc2lvbihzZXNzaW9uSWQpPy5nZXRSZXF1ZXN0cygpLmF0KC0xKTtcblx0XHRpZiAoIWxhc3RSZXF1ZXN0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3B0aW9uczogSUNoYXRTZW5kUmVxdWVzdE9wdGlvbnMgPSB7XG5cdFx0XHRhdHRlbXB0OiBsYXN0UmVxdWVzdC5hdHRlbXB0ICsgMSxcblx0XHRcdGxvY2F0aW9uOiB0aGlzLmxvY2F0aW9uLFxuXHRcdFx0dXNlclNlbGVjdGVkTW9kZWxJZDogdGhpcy5pbnB1dC5jdXJyZW50TGFuZ3VhZ2VNb2RlbFxuXHRcdH07XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuY2hhdFNlcnZpY2UucmVzZW5kUmVxdWVzdChsYXN0UmVxdWVzdCwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGNvbGxlY3RJbnB1dFN0YXRlKCk6IElDaGF0SW5wdXRTdGF0ZSB7XG5cdFx0Y29uc3QgaW5wdXRTdGF0ZTogSUNoYXRJbnB1dFN0YXRlID0ge307XG5cdFx0dGhpcy5jb250cmlicy5mb3JFYWNoKGMgPT4ge1xuXHRcdFx0aWYgKGMuZ2V0SW5wdXRTdGF0ZSkge1xuXHRcdFx0XHRpbnB1dFN0YXRlW2MuaWRdID0gYy5nZXRJbnB1dFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGlucHV0U3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9hY2NlcHRJbnB1dChxdWVyeTogeyBxdWVyeTogc3RyaW5nIH0gfCB1bmRlZmluZWQsIG9wdGlvbnM/OiBJQ2hhdEFjY2VwdElucHV0T3B0aW9ucyk6IFByb21pc2U8SUNoYXRSZXNwb25zZU1vZGVsIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHRoaXMudmlld01vZGVsPy5yZXF1ZXN0SW5Qcm9ncmVzcyAmJiB0aGlzLnZpZXdNb2RlbC5yZXF1ZXN0UGF1c2liaWxpdHkgIT09IENoYXRQYXVzZVN0YXRlLlBhdXNlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0dGhpcy5fb25EaWRBY2NlcHRJbnB1dC5maXJlKCk7XG5cdFx0XHR0aGlzLnNjcm9sbExvY2sgPSAhIWNoZWNrTW9kZU9wdGlvbih0aGlzLmlucHV0LmN1cnJlbnRNb2RlLCB0aGlzLnZpZXdPcHRpb25zLmF1dG9TY3JvbGwpO1xuXG5cdFx0XHRjb25zdCBlZGl0b3JWYWx1ZSA9IHRoaXMuZ2V0SW5wdXQoKTtcblx0XHRcdGNvbnN0IHJlcXVlc3RJZCA9IHRoaXMuY2hhdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLmFjY2VwdFJlcXVlc3QoKTtcblx0XHRcdGNvbnN0IGlucHV0ID0gIXF1ZXJ5ID8gZWRpdG9yVmFsdWUgOiBxdWVyeS5xdWVyeTtcblx0XHRcdGNvbnN0IGlzVXNlclF1ZXJ5ID0gIXF1ZXJ5O1xuXG5cdFx0XHRjb25zdCB7IHByb21wdEluc3RydWN0aW9ucyB9ID0gdGhpcy5pbnB1dFBhcnQuYXR0YWNobWVudE1vZGVsO1xuXHRcdFx0Y29uc3QgaW5zdHJ1Y3Rpb25zRW5hYmxlZCA9IHByb21wdEluc3RydWN0aW9ucy5mZWF0dXJlRW5hYmxlZDtcblx0XHRcdGlmIChpbnN0cnVjdGlvbnNFbmFibGVkKSB7XG5cdFx0XHRcdC8vIGluc3RydWN0aW9uIGZpbGVzIG1heSBoYXZlIG5lc3RlZCBjaGlsZCByZWZlcmVuY2VzIHRvIG90aGVyIHByb21wdFxuXHRcdFx0XHQvLyBmaWxlcyB0aGF0IGFyZSByZXNvbHZlZCBhc3luY2hyb25vdXNseSwgaGVuY2Ugd2UgbmVlZCB0byB3YWl0IGZvclxuXHRcdFx0XHQvLyB0aGUgZW50aXJlIHByb21wdCBpbnN0cnVjdGlvbiB0cmVlIHRvIGJlIHByb2Nlc3NlZFxuXHRcdFx0XHRjb25zdCBpbnN0cnVjdGlvbnNTdGFydGVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdFx0XHRcdGF3YWl0IHByb21wdEluc3RydWN0aW9ucy5hbGxTZXR0bGVkKCk7XG5cdFx0XHRcdC8vIGFsbG93LWFueS11bmljb2RlLW5leHQtbGluZVxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtcdTIzRjFdIGluc3RydWN0aW9ucyB0cmVlIHJlc29sdmVkIGluICR7cGVyZm9ybWFuY2Uubm93KCkgLSBpbnN0cnVjdGlvbnNTdGFydGVkfW1zYCk7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBhdHRhY2hlZENvbnRleHQgPSB0aGlzLmlucHV0UGFydC5nZXRBdHRhY2hlZEFuZEltcGxpY2l0Q29udGV4dCh0aGlzLnZpZXdNb2RlbC5zZXNzaW9uSWQpO1xuXHRcdFx0aWYgKHRoaXMudmlld09wdGlvbnMuZW5hYmxlV29ya2luZ1NldCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuaW5wdXQuY3VycmVudE1vZGUgIT09IENoYXRNb2RlLkFzaykge1xuXHRcdFx0XHRjb25zdCB1bmlxdWVXb3JraW5nU2V0RW50cmllcyA9IG5ldyBSZXNvdXJjZVNldCgpOyAvLyBOT1RFOiB0aGlzIGlzIHVzZWQgZm9yIGJvb2trZWVwaW5nIHNvIHRoZSBVSSBjYW4gYXZvaWQgcmVuZGVyaW5nIHJlZmVyZW5jZXMgaW4gdGhlIFVJIHRoYXQgYXJlIGFscmVhZHkgc2hvd24gaW4gdGhlIHdvcmtpbmcgc2V0XG5cdFx0XHRcdGNvbnN0IGVkaXRpbmdTZXNzaW9uQXR0YWNoZWRDb250ZXh0OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5W10gPSBhdHRhY2hlZENvbnRleHQ7XG5cblx0XHRcdFx0Ly8gQ29sbGVjdCBmaWxlIHZhcmlhYmxlcyBmcm9tIHByZXZpb3VzIHJlcXVlc3RzIGJlZm9yZSBzZW5kaW5nIHRoZSByZXF1ZXN0XG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzUmVxdWVzdHMgPSB0aGlzLnZpZXdNb2RlbC5tb2RlbC5nZXRSZXF1ZXN0cygpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgcHJldmlvdXNSZXF1ZXN0cykge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdmFyaWFibGUgb2YgcmVxdWVzdC52YXJpYWJsZURhdGEudmFyaWFibGVzKSB7XG5cdFx0XHRcdFx0XHRpZiAoVVJJLmlzVXJpKHZhcmlhYmxlLnZhbHVlKSAmJiB2YXJpYWJsZS5pc0ZpbGUpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgdXJpID0gdmFyaWFibGUudmFsdWU7XG5cdFx0XHRcdFx0XHRcdGlmICghdW5pcXVlV29ya2luZ1NldEVudHJpZXMuaGFzKHVyaSkpIHtcblx0XHRcdFx0XHRcdFx0XHRlZGl0aW5nU2Vzc2lvbkF0dGFjaGVkQ29udGV4dC5wdXNoKHZhcmlhYmxlKTtcblx0XHRcdFx0XHRcdFx0XHR1bmlxdWVXb3JraW5nU2V0RW50cmllcy5hZGQodmFyaWFibGUudmFsdWUpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGF0dGFjaGVkQ29udGV4dCA9IGVkaXRpbmdTZXNzaW9uQXR0YWNoZWRDb250ZXh0O1xuXG5cdFx0XHRcdHR5cGUgQ2hhdEVkaXRpbmdXb3JraW5nU2V0Q2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0b3duZXI6ICdqb3ljZWVyaGwnO1xuXHRcdFx0XHRcdGNvbW1lbnQ6ICdJbmZvcm1hdGlvbiBhYm91dCB0aGUgd29ya2luZyBzZXQgc2l6ZSBpbiBhIGNoYXQgZWRpdGluZyByZXF1ZXN0Jztcblx0XHRcdFx0XHRvcmlnaW5hbFNpemU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGZpbGVzIHRoYXQgdGhlIHVzZXIgdHJpZWQgdG8gYXR0YWNoIGluIHRoZWlyIGVkaXRpbmcgcmVxdWVzdC4nIH07XG5cdFx0XHRcdFx0YWN0dWFsU2l6ZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgZmlsZXMgdGhhdCB3ZXJlIGFjdHVhbGx5IHNlbnQgaW4gdGhlaXIgZWRpdGluZyByZXF1ZXN0LicgfTtcblx0XHRcdFx0fTtcblx0XHRcdFx0dHlwZSBDaGF0RWRpdGluZ1dvcmtpbmdTZXRFdmVudCA9IHtcblx0XHRcdFx0XHRvcmlnaW5hbFNpemU6IG51bWJlcjtcblx0XHRcdFx0XHRhY3R1YWxTaXplOiBudW1iZXI7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPENoYXRFZGl0aW5nV29ya2luZ1NldEV2ZW50LCBDaGF0RWRpdGluZ1dvcmtpbmdTZXRDbGFzc2lmaWNhdGlvbj4oJ2NoYXRFZGl0aW5nL3dvcmtpbmdTZXRTaXplJywgeyBvcmlnaW5hbFNpemU6IHVuaXF1ZVdvcmtpbmdTZXRFbnRyaWVzLnNpemUsIGFjdHVhbFNpemU6IHVuaXF1ZVdvcmtpbmdTZXRFbnRyaWVzLnNpemUgfSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuY2hhdFNlcnZpY2UuY2FuY2VsQ3VycmVudFJlcXVlc3RGb3JTZXNzaW9uKHRoaXMudmlld01vZGVsLnNlc3Npb25JZCk7XG5cblx0XHRcdHRoaXMuaW5wdXQudmFsaWRhdGVDdXJyZW50TW9kZSgpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jaGF0U2VydmljZS5zZW5kUmVxdWVzdCh0aGlzLnZpZXdNb2RlbC5zZXNzaW9uSWQsIGlucHV0LCB7XG5cdFx0XHRcdG1vZGU6IHRoaXMuaW5wdXRQYXJ0LmN1cnJlbnRNb2RlLFxuXHRcdFx0XHR1c2VyU2VsZWN0ZWRNb2RlbElkOiB0aGlzLmlucHV0UGFydC5jdXJyZW50TGFuZ3VhZ2VNb2RlbCxcblx0XHRcdFx0bG9jYXRpb246IHRoaXMubG9jYXRpb24sXG5cdFx0XHRcdGxvY2F0aW9uRGF0YTogdGhpcy5fbG9jYXRpb24ucmVzb2x2ZURhdGE/LigpLFxuXHRcdFx0XHRwYXJzZXJDb250ZXh0OiB7IHNlbGVjdGVkQWdlbnQ6IHRoaXMuX2xhc3RTZWxlY3RlZEFnZW50LCBtb2RlOiB0aGlzLmlucHV0UGFydC5jdXJyZW50TW9kZSB9LFxuXHRcdFx0XHRhdHRhY2hlZENvbnRleHQsXG5cdFx0XHRcdG5vQ29tbWFuZERldGVjdGlvbjogb3B0aW9ucz8ubm9Db21tYW5kRGV0ZWN0aW9uLFxuXHRcdFx0XHRoYXNJbnN0cnVjdGlvbkF0dGFjaG1lbnRzOiB0aGlzLmlucHV0UGFydC5oYXNJbnN0cnVjdGlvbkF0dGFjaG1lbnRzLFxuXHRcdFx0XHR1c2VyU2VsZWN0ZWRUb29sczogdGhpcy5pbnB1dC5jdXJyZW50TW9kZSA9PT0gQ2hhdE1vZGUuQWdlbnQgPyB0aGlzLmlucHV0UGFydC5zZWxlY3RlZFRvb2xzTW9kZWwudG9vbHMuZ2V0KCkubWFwKHRvb2wgPT4gdG9vbC5pZCkgOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMuaW5wdXRQYXJ0LmFjY2VwdElucHV0KGlzVXNlclF1ZXJ5KTtcblx0XHRcdFx0dGhpcy5fb25EaWRTdWJtaXRBZ2VudC5maXJlKHsgYWdlbnQ6IHJlc3VsdC5hZ2VudCwgc2xhc2hDb21tYW5kOiByZXN1bHQuc2xhc2hDb21tYW5kIH0pO1xuXHRcdFx0XHRyZXN1bHQucmVzcG9uc2VDb21wbGV0ZVByb21pc2UudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzcG9uc2VzID0gdGhpcy52aWV3TW9kZWw/LmdldEl0ZW1zKCkuZmlsdGVyKGlzUmVzcG9uc2VWTSk7XG5cdFx0XHRcdFx0Y29uc3QgbGFzdFJlc3BvbnNlID0gcmVzcG9uc2VzPy5bcmVzcG9uc2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0XHRcdHRoaXMuY2hhdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLmFjY2VwdFJlc3BvbnNlKGxhc3RSZXNwb25zZSwgcmVxdWVzdElkLCBvcHRpb25zPy5pc1ZvaWNlSW5wdXQpO1xuXHRcdFx0XHRcdGlmIChsYXN0UmVzcG9uc2U/LnJlc3VsdD8ubmV4dFF1ZXN0aW9uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB7IHByb21wdCwgcGFydGljaXBhbnQsIGNvbW1hbmQgfSA9IGxhc3RSZXNwb25zZS5yZXN1bHQubmV4dFF1ZXN0aW9uO1xuXHRcdFx0XHRcdFx0Y29uc3QgcXVlc3Rpb24gPSBmb3JtYXRDaGF0UXVlc3Rpb24odGhpcy5jaGF0QWdlbnRTZXJ2aWNlLCB0aGlzLmxvY2F0aW9uLCBwcm9tcHQsIHBhcnRpY2lwYW50LCBjb21tYW5kKTtcblx0XHRcdFx0XHRcdGlmIChxdWVzdGlvbikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlucHV0LnNldFZhbHVlKHF1ZXN0aW9uLCBmYWxzZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0LnJlc3BvbnNlQ3JlYXRlZFByb21pc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXRDb2RlQmxvY2tJbmZvc0ZvclJlc3BvbnNlKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKTogSUNoYXRDb2RlQmxvY2tJbmZvW10ge1xuXHRcdHJldHVybiB0aGlzLnJlbmRlcmVyLmdldENvZGVCbG9ja0luZm9zRm9yUmVzcG9uc2UocmVzcG9uc2UpO1xuXHR9XG5cblx0Z2V0Q29kZUJsb2NrSW5mb0ZvckVkaXRvcih1cmk6IFVSSSk6IElDaGF0Q29kZUJsb2NrSW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucmVuZGVyZXIuZ2V0Q29kZUJsb2NrSW5mb0ZvckVkaXRvcih1cmkpO1xuXHR9XG5cblx0Z2V0RmlsZVRyZWVJbmZvc0ZvclJlc3BvbnNlKHJlc3BvbnNlOiBJQ2hhdFJlc3BvbnNlVmlld01vZGVsKTogSUNoYXRGaWxlVHJlZUluZm9bXSB7XG5cdFx0cmV0dXJuIHRoaXMucmVuZGVyZXIuZ2V0RmlsZVRyZWVJbmZvc0ZvclJlc3BvbnNlKHJlc3BvbnNlKTtcblx0fVxuXG5cdGdldExhc3RGb2N1c2VkRmlsZVRyZWVGb3JSZXNwb25zZShyZXNwb25zZTogSUNoYXRSZXNwb25zZVZpZXdNb2RlbCk6IElDaGF0RmlsZVRyZWVJbmZvIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJlci5nZXRMYXN0Rm9jdXNlZEZpbGVUcmVlRm9yUmVzcG9uc2UocmVzcG9uc2UpO1xuXHR9XG5cblx0Zm9jdXNMYXN0TWVzc2FnZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbXMgPSB0aGlzLnRyZWUuZ2V0Tm9kZShudWxsKS5jaGlsZHJlbjtcblx0XHRjb25zdCBsYXN0SXRlbSA9IGl0ZW1zW2l0ZW1zLmxlbmd0aCAtIDFdO1xuXHRcdGlmICghbGFzdEl0ZW0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW2xhc3RJdGVtLmVsZW1lbnRdKTtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0fVxuXG5cdGxheW91dChoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHdpZHRoID0gTWF0aC5taW4od2lkdGgsIDg1MCk7XG5cdFx0dGhpcy5ib2R5RGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cblx0XHRjb25zdCBpbnB1dFBhcnRNYXhIZWlnaHQgPSB0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGE/LmVuYWJsZWQgPyB0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGEubWF4SGVpZ2h0IDogaGVpZ2h0O1xuXHRcdHRoaXMuaW5wdXRQYXJ0LmxheW91dChpbnB1dFBhcnRNYXhIZWlnaHQsIHdpZHRoKTtcblx0XHRjb25zdCBpbnB1dFBhcnRIZWlnaHQgPSB0aGlzLmlucHV0UGFydC5pbnB1dFBhcnRIZWlnaHQ7XG5cdFx0Y29uc3QgbGFzdEVsZW1lbnRWaXNpYmxlID0gdGhpcy50cmVlLnNjcm9sbFRvcCArIHRoaXMudHJlZS5yZW5kZXJIZWlnaHQgPj0gdGhpcy50cmVlLnNjcm9sbEhlaWdodCAtIDI7XG5cblx0XHRjb25zdCBsaXN0SGVpZ2h0ID0gTWF0aC5tYXgoMCwgaGVpZ2h0IC0gaW5wdXRQYXJ0SGVpZ2h0KTtcblx0XHRpZiAodGhpcy52aWV3T3B0aW9ucy5yZW5kZXJTdHlsZSA9PT0gJ2NvbXBhY3QnIHx8IHRoaXMudmlld09wdGlvbnMucmVuZGVyU3R5bGUgPT09ICdtaW5pbWFsJykge1xuXHRcdFx0dGhpcy5saXN0Q29udGFpbmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLWNoYXQtY3VycmVudC1yZXNwb25zZS1taW4taGVpZ2h0Jyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGlzdENvbnRhaW5lci5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1jaGF0LWN1cnJlbnQtcmVzcG9uc2UtbWluLWhlaWdodCcsIGxpc3RIZWlnaHQgKiAuNzUgKyAncHgnKTtcblx0XHR9XG5cblx0XHR0aGlzLnRyZWUubGF5b3V0KGxpc3RIZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLnRyZWUuZ2V0SFRNTEVsZW1lbnQoKS5zdHlsZS5oZWlnaHQgPSBgJHtsaXN0SGVpZ2h0fXB4YDtcblxuXHRcdC8vIFB1c2ggdGhlIHdlbGNvbWUgbWVzc2FnZSBkb3duIHNvIGl0IGRvZXNuJ3QgY2hhbmdlIHBvc2l0aW9uIHdoZW4gZm9sbG93dXBzIG9yIHdvcmtpbmcgc2V0IGFwcGVhclxuXHRcdGxldCBleHRyYU9mZnNldDogbnVtYmVyID0gMDtcblx0XHRpZiAodGhpcy52aWV3T3B0aW9ucy5yZW5kZXJGb2xsb3d1cHMpIHtcblx0XHRcdGV4dHJhT2Zmc2V0ID0gTWF0aC5tYXgoMTAwIC0gdGhpcy5pbnB1dFBhcnQuZm9sbG93dXBzSGVpZ2h0LCAwKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMudmlld09wdGlvbnMuZW5hYmxlV29ya2luZ1NldCkge1xuXHRcdFx0ZXh0cmFPZmZzZXQgPSBNYXRoLm1heCgxMDAgLSB0aGlzLmlucHV0UGFydC5lZGl0U2Vzc2lvbldpZGdldEhlaWdodCwgMCk7XG5cdFx0fVxuXHRcdHRoaXMud2VsY29tZU1lc3NhZ2VDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7bGlzdEhlaWdodCAtIGV4dHJhT2Zmc2V0fXB4YDtcblx0XHR0aGlzLndlbGNvbWVNZXNzYWdlQ29udGFpbmVyLnN0eWxlLnBhZGRpbmdCb3R0b20gPSBgJHtleHRyYU9mZnNldH1weGA7XG5cdFx0dGhpcy5yZW5kZXJlci5sYXlvdXQod2lkdGgpO1xuXG5cdFx0Y29uc3QgbGFzdEl0ZW0gPSB0aGlzLnZpZXdNb2RlbD8uZ2V0SXRlbXMoKS5hdCgtMSk7XG5cdFx0Y29uc3QgbGFzdFJlc3BvbnNlSXNSZW5kZXJpbmcgPSBpc1Jlc3BvbnNlVk0obGFzdEl0ZW0pICYmIGxhc3RJdGVtLnJlbmRlckRhdGE7XG5cdFx0aWYgKGxhc3RFbGVtZW50VmlzaWJsZSAmJiAoIWxhc3RSZXNwb25zZUlzUmVuZGVyaW5nIHx8IGNoZWNrTW9kZU9wdGlvbih0aGlzLmlucHV0LmN1cnJlbnRNb2RlLCB0aGlzLnZpZXdPcHRpb25zLmF1dG9TY3JvbGwpKSkge1xuXHRcdFx0dGhpcy5zY3JvbGxUb0VuZCgpO1xuXHRcdH1cblxuXHRcdHRoaXMubGlzdENvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtsaXN0SGVpZ2h0fXB4YDtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoaGVpZ2h0KTtcblx0fVxuXG5cdHByaXZhdGUgX2R5bmFtaWNNZXNzYWdlTGF5b3V0RGF0YT86IHsgbnVtT2ZNZXNzYWdlczogbnVtYmVyOyBtYXhIZWlnaHQ6IG51bWJlcjsgZW5hYmxlZDogYm9vbGVhbiB9O1xuXG5cdC8vIEFuIGFsdGVybmF0aXZlIHRvIGxheW91dCwgdGhpcyBhbGxvd3MgeW91IHRvIHNwZWNpZnkgdGhlIG51bWJlciBvZiBDaGF0VHJlZUl0ZW1zXG5cdC8vIHlvdSB3YW50IHRvIHNob3csIGFuZCB0aGUgbWF4IGhlaWdodCBvZiB0aGUgY29udGFpbmVyLiBJdCB3aWxsIHRoZW4gbGF5b3V0IHRoZVxuXHQvLyB0cmVlIHRvIHNob3cgdGhhdCBtYW55IGl0ZW1zLlxuXHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBUaGlzIGNvdWxkIHVzZSBzb21lIHJlZmFjdG9yaW5nIHRvIG1ha2UgaXQgY2xlYXIgd2hpY2ggbGF5b3V0IHN0cmF0ZWd5IGlzIGJlaW5nIHVzZWRcblx0c2V0RHluYW1pY0NoYXRUcmVlSXRlbUxheW91dChudW1PZkNoYXRUcmVlSXRlbXM6IG51bWJlciwgbWF4SGVpZ2h0OiBudW1iZXIpIHtcblx0XHR0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGEgPSB7IG51bU9mTWVzc2FnZXM6IG51bU9mQ2hhdFRyZWVJdGVtcywgbWF4SGVpZ2h0LCBlbmFibGVkOiB0cnVlIH07XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZW5kZXJlci5vbkRpZENoYW5nZUl0ZW1IZWlnaHQoKCkgPT4gdGhpcy5sYXlvdXREeW5hbWljQ2hhdFRyZWVJdGVtTW9kZSgpKSk7XG5cblx0XHRjb25zdCBtdXRhYmxlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRTY3JvbGwoKGUpID0+IHtcblx0XHRcdC8vIFRPRE9AVHlsZXJMZW9uaGFyZHQgdGhpcyBzaG91bGQgcHJvYmFibHkganVzdCBiZSBkaXNwb3NlZCB3aGVuIHRoaXMgaXMgZGlzYWJsZWRcblx0XHRcdC8vIGFuZCB0aGVuIHNldCB1cCBhZ2FpbiB3aGVuIGl0IGlzIGVuYWJsZWQgYWdhaW5cblx0XHRcdGlmICghdGhpcy5fZHluYW1pY01lc3NhZ2VMYXlvdXREYXRhPy5lbmFibGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdG11dGFibGVEaXNwb3NhYmxlLnZhbHVlID0gZG9tLnNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZG9tLmdldFdpbmRvdyh0aGlzLmxpc3RDb250YWluZXIpLCAoKSA9PiB7XG5cdFx0XHRcdGlmICghZS5zY3JvbGxUb3BDaGFuZ2VkIHx8IGUuaGVpZ2h0Q2hhbmdlZCB8fCBlLnNjcm9sbEhlaWdodENoYW5nZWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVuZGVySGVpZ2h0ID0gZS5oZWlnaHQ7XG5cdFx0XHRcdGNvbnN0IGRpZmYgPSBlLnNjcm9sbEhlaWdodCAtIHJlbmRlckhlaWdodCAtIGUuc2Nyb2xsVG9wO1xuXHRcdFx0XHRpZiAoZGlmZiA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHBvc3NpYmxlTWF4SGVpZ2h0ID0gKHRoaXMuX2R5bmFtaWNNZXNzYWdlTGF5b3V0RGF0YT8ubWF4SGVpZ2h0ID8/IG1heEhlaWdodCk7XG5cdFx0XHRcdGNvbnN0IHdpZHRoID0gdGhpcy5ib2R5RGltZW5zaW9uPy53aWR0aCA/PyB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aDtcblx0XHRcdFx0dGhpcy5pbnB1dFBhcnQubGF5b3V0KHBvc3NpYmxlTWF4SGVpZ2h0LCB3aWR0aCk7XG5cdFx0XHRcdGNvbnN0IGlucHV0UGFydEhlaWdodCA9IHRoaXMuaW5wdXRQYXJ0LmlucHV0UGFydEhlaWdodDtcblx0XHRcdFx0Y29uc3QgbmV3SGVpZ2h0ID0gTWF0aC5taW4ocmVuZGVySGVpZ2h0ICsgZGlmZiwgcG9zc2libGVNYXhIZWlnaHQgLSBpbnB1dFBhcnRIZWlnaHQpO1xuXHRcdFx0XHR0aGlzLmxheW91dChuZXdIZWlnaHQgKyBpbnB1dFBhcnRIZWlnaHQsIHdpZHRoKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHVwZGF0ZUR5bmFtaWNDaGF0VHJlZUl0ZW1MYXlvdXQobnVtT2ZDaGF0VHJlZUl0ZW1zOiBudW1iZXIsIG1heEhlaWdodDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fZHluYW1pY01lc3NhZ2VMYXlvdXREYXRhID0geyBudW1PZk1lc3NhZ2VzOiBudW1PZkNoYXRUcmVlSXRlbXMsIG1heEhlaWdodCwgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGxldCBoYXNDaGFuZ2VkID0gZmFsc2U7XG5cdFx0bGV0IGhlaWdodCA9IHRoaXMuYm9keURpbWVuc2lvbiEuaGVpZ2h0O1xuXHRcdGxldCB3aWR0aCA9IHRoaXMuYm9keURpbWVuc2lvbiEud2lkdGg7XG5cdFx0aWYgKG1heEhlaWdodCA8IHRoaXMuYm9keURpbWVuc2lvbiEuaGVpZ2h0KSB7XG5cdFx0XHRoZWlnaHQgPSBtYXhIZWlnaHQ7XG5cdFx0XHRoYXNDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cdFx0Y29uc3QgY29udGFpbmVyV2lkdGggPSB0aGlzLmNvbnRhaW5lci5vZmZzZXRXaWR0aDtcblx0XHRpZiAodGhpcy5ib2R5RGltZW5zaW9uPy53aWR0aCAhPT0gY29udGFpbmVyV2lkdGgpIHtcblx0XHRcdHdpZHRoID0gY29udGFpbmVyV2lkdGg7XG5cdFx0XHRoYXNDaGFuZ2VkID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKGhhc0NoYW5nZWQpIHtcblx0XHRcdHRoaXMubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBpc0R5bmFtaWNDaGF0VHJlZUl0ZW1MYXlvdXRFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGE/LmVuYWJsZWQgPz8gZmFsc2U7XG5cdH1cblxuXHRzZXQgaXNEeW5hbWljQ2hhdFRyZWVJdGVtTGF5b3V0RW5hYmxlZCh2YWx1ZTogYm9vbGVhbikge1xuXHRcdGlmICghdGhpcy5fZHluYW1pY01lc3NhZ2VMYXlvdXREYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2R5bmFtaWNNZXNzYWdlTGF5b3V0RGF0YS5lbmFibGVkID0gdmFsdWU7XG5cdH1cblxuXHRsYXlvdXREeW5hbWljQ2hhdFRyZWVJdGVtTW9kZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudmlld01vZGVsIHx8ICF0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGE/LmVuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3aWR0aCA9IHRoaXMuYm9keURpbWVuc2lvbj8ud2lkdGggPz8gdGhpcy5jb250YWluZXIub2Zmc2V0V2lkdGg7XG5cdFx0dGhpcy5pbnB1dFBhcnQubGF5b3V0KHRoaXMuX2R5bmFtaWNNZXNzYWdlTGF5b3V0RGF0YS5tYXhIZWlnaHQsIHdpZHRoKTtcblx0XHRjb25zdCBpbnB1dEhlaWdodCA9IHRoaXMuaW5wdXRQYXJ0LmlucHV0UGFydEhlaWdodDtcblxuXHRcdGNvbnN0IHRvdGFsTWVzc2FnZXMgPSB0aGlzLnZpZXdNb2RlbC5nZXRJdGVtcygpO1xuXHRcdC8vIGdyYWIgdGhlIGxhc3QgTiBtZXNzYWdlc1xuXHRcdGNvbnN0IG1lc3NhZ2VzID0gdG90YWxNZXNzYWdlcy5zbGljZSgtdGhpcy5fZHluYW1pY01lc3NhZ2VMYXlvdXREYXRhLm51bU9mTWVzc2FnZXMpO1xuXG5cdFx0Y29uc3QgbmVlZHNSZXJlbmRlciA9IG1lc3NhZ2VzLnNvbWUobSA9PiBtLmN1cnJlbnRSZW5kZXJlZEhlaWdodCA9PT0gdW5kZWZpbmVkKTtcblx0XHRjb25zdCBsaXN0SGVpZ2h0ID0gbmVlZHNSZXJlbmRlclxuXHRcdFx0PyB0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGEubWF4SGVpZ2h0XG5cdFx0XHQ6IG1lc3NhZ2VzLnJlZHVjZSgoYWNjLCBtZXNzYWdlKSA9PiBhY2MgKyBtZXNzYWdlLmN1cnJlbnRSZW5kZXJlZEhlaWdodCEsIDApO1xuXG5cdFx0dGhpcy5sYXlvdXQoXG5cdFx0XHRNYXRoLm1pbihcblx0XHRcdFx0Ly8gd2UgYWRkIGFuIGFkZGl0aW9uYWwgMThweCBpbiBvcmRlciB0byBzaG93IHRoYXQgdGhlcmUgaXMgc2Nyb2xsYWJsZSBjb250ZW50XG5cdFx0XHRcdGlucHV0SGVpZ2h0ICsgbGlzdEhlaWdodCArICh0b3RhbE1lc3NhZ2VzLmxlbmd0aCA+IDIgPyAxOCA6IDApLFxuXHRcdFx0XHR0aGlzLl9keW5hbWljTWVzc2FnZUxheW91dERhdGEubWF4SGVpZ2h0XG5cdFx0XHQpLFxuXHRcdFx0d2lkdGhcblx0XHQpO1xuXG5cdFx0aWYgKG5lZWRzUmVyZW5kZXIgfHwgIWxpc3RIZWlnaHQpIHtcblx0XHRcdHRoaXMuc2Nyb2xsVG9FbmQoKTtcblx0XHR9XG5cdH1cblxuXHRzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnB1dFBhcnQuc2F2ZVN0YXRlKCk7XG5cblx0XHRjb25zdCB3ZWxjb21lQ29udGVudCA9IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQodGhpcy5sb2NhdGlvbiwgdGhpcy5pbnB1dC5jdXJyZW50TW9kZSk/Lm1ldGFkYXRhLndlbGNvbWVNZXNzYWdlQ29udGVudDtcblx0XHRpZiAod2VsY29tZUNvbnRlbnQpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoYCR7UGVyc2lzdFdlbGNvbWVNZXNzYWdlQ29udGVudEtleX0uJHt0aGlzLmxvY2F0aW9ufWAsIHdlbGNvbWVDb250ZW50LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Vmlld1N0YXRlKCk6IElDaGF0Vmlld1N0YXRlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aW5wdXRWYWx1ZTogdGhpcy5nZXRJbnB1dCgpLFxuXHRcdFx0aW5wdXRTdGF0ZTogdGhpcy5pbnB1dFBhcnQuZ2V0Vmlld1N0YXRlKClcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDaGF0SW5wdXRDb250ZXh0KCkge1xuXHRcdGNvbnN0IGN1cnJlbnRBZ2VudCA9IHRoaXMucGFyc2VkSW5wdXQucGFydHMuZmluZChwYXJ0ID0+IHBhcnQgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50UGFydCk7XG5cdFx0dGhpcy5hZ2VudEluSW5wdXQuc2V0KCEhY3VycmVudEFnZW50KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFdpZGdldFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRXaWRnZXRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF93aWRnZXRzOiBDaGF0V2lkZ2V0W10gPSBbXTtcblx0cHJpdmF0ZSBfbGFzdEZvY3VzZWRXaWRnZXQ6IENoYXRXaWRnZXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBZGRXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDaGF0V2lkZ2V0PigpKTtcblx0cmVhZG9ubHkgb25EaWRBZGRXaWRnZXQ6IEV2ZW50PElDaGF0V2lkZ2V0PiA9IHRoaXMuX29uRGlkQWRkV2lkZ2V0LmV2ZW50O1xuXG5cdGdldCBsYXN0Rm9jdXNlZFdpZGdldCgpOiBJQ2hhdFdpZGdldCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2xhc3RGb2N1c2VkV2lkZ2V0O1xuXHR9XG5cblx0Z2V0QWxsV2lkZ2V0cygpOiBSZWFkb25seUFycmF5PElDaGF0V2lkZ2V0PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldHM7XG5cdH1cblxuXHRnZXRXaWRnZXRzQnlMb2NhdGlvbnMobG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uKTogUmVhZG9ubHlBcnJheTxJQ2hhdFdpZGdldD4ge1xuXHRcdHJldHVybiB0aGlzLl93aWRnZXRzLmZpbHRlcih3ID0+IHcubG9jYXRpb24gPT09IGxvY2F0aW9uKTtcblx0fVxuXG5cdGdldFdpZGdldEJ5SW5wdXRVcmkodXJpOiBVUkkpOiBDaGF0V2lkZ2V0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0cy5maW5kKHcgPT4gaXNFcXVhbCh3LmlucHV0VXJpLCB1cmkpKTtcblx0fVxuXG5cdGdldFdpZGdldEJ5U2Vzc2lvbklkKHNlc3Npb25JZDogc3RyaW5nKTogQ2hhdFdpZGdldCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldHMuZmluZCh3ID0+IHcudmlld01vZGVsPy5zZXNzaW9uSWQgPT09IHNlc3Npb25JZCk7XG5cdH1cblxuXHRwcml2YXRlIHNldExhc3RGb2N1c2VkV2lkZ2V0KHdpZGdldDogQ2hhdFdpZGdldCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh3aWRnZXQgPT09IHRoaXMuX2xhc3RGb2N1c2VkV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQgPSB3aWRnZXQ7XG5cdH1cblxuXHRyZWdpc3RlcihuZXdXaWRnZXQ6IENoYXRXaWRnZXQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKHRoaXMuX3dpZGdldHMuc29tZSh3aWRnZXQgPT4gd2lkZ2V0ID09PSBuZXdXaWRnZXQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZWdpc3RlciB0aGUgc2FtZSB3aWRnZXQgbXVsdGlwbGUgdGltZXMnKTtcblx0XHR9XG5cblx0XHR0aGlzLl93aWRnZXRzLnB1c2gobmV3V2lkZ2V0KTtcblx0XHR0aGlzLl9vbkRpZEFkZFdpZGdldC5maXJlKG5ld1dpZGdldCk7XG5cblx0XHRyZXR1cm4gY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0bmV3V2lkZ2V0Lm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5zZXRMYXN0Rm9jdXNlZFdpZGdldChuZXdXaWRnZXQpKSxcblx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl93aWRnZXRzLnNwbGljZSh0aGlzLl93aWRnZXRzLmluZGV4T2YobmV3V2lkZ2V0KSwgMSkpXG5cdFx0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxjQUFjO0FBRXZCLFNBQVMsbUJBQW1CLGVBQWU7QUFDM0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsYUFBYTtBQUUvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQixZQUFZLGlCQUE4QixtQkFBbUIsb0JBQW9CO0FBQzlHLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQixxQkFBcUIsdUJBQXVCO0FBQ3ZFLFNBQVMsUUFBUSxlQUFlO0FBQ2hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsV0FBVztBQUVwQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWM7QUFDdkIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMkJBQTJCLDJCQUEyQixzQ0FBc0M7QUFDckcsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBNEMsbUJBQStDLG1DQUFtQztBQUM5SCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1DQUFtQyxzQ0FBc0MsK0JBQStCLDJDQUEyQyxxQkFBMEMsZ0NBQWdDLDRCQUE0QjtBQUNsUSxTQUFTLHNCQUFpRjtBQUMxRixTQUFTLGlCQUFpQixzQkFBc0Isc0JBQXNCLDBCQUE4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
