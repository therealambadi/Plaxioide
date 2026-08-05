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
import { $, getActiveElement, getTotalHeight, getWindow, h, reset, trackFocus } from "../../../../base/browser/dom.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { constObservable, derived, observableValue } from "../../../../base/common/observable.js";
import { AccessibleDiffViewer } from "../../../../editor/browser/widget/diffEditor/components/accessibleDiffViewer.js";
import { EditorOption } from "../../../../editor/common/config/editorOptions.js";
import { LineRange } from "../../../../editor/common/core/lineRange.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { DetailedLineRangeMapping, RangeMapping } from "../../../../editor/common/diff/rangeMapping.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../nls.js";
import { IAccessibleViewService } from "../../../../platform/accessibility/browser/accessibleView.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuWorkbenchButtonBar } from "../../../../platform/actions/browser/buttonbar.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILayoutService } from "../../../../platform/layout/browser/layoutService.js";
import { asCssVariable, asCssVariableName, editorBackground, inputBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from "../../../common/theme.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibilityCommandId } from "../../accessibility/common/accessibilityCommands.js";
import { MarkUnhelpfulActionId } from "../../chat/browser/actions/chatTitleActions.js";
import { ChatVoteDownButton } from "../../chat/browser/chatListRenderer.js";
import { ChatWidget } from "../../chat/browser/chatWidget.js";
import { chatRequestBackground } from "../../chat/common/chatColors.js";
import { ChatContextKeys } from "../../chat/common/chatContextKeys.js";
import { ChatAgentVoteDirection, IChatService } from "../../chat/common/chatService.js";
import { isResponseVM } from "../../chat/common/chatViewModel.js";
import { CTX_INLINE_CHAT_FOCUSED, CTX_INLINE_CHAT_RESPONSE_FOCUSED, inlineChatBackground, inlineChatForeground } from "../common/inlineChat.js";
import "./media/inlineChat.css";
let InlineChatWidget = class {
  constructor(location, _options, _instantiationService, _contextKeyService, _keybindingService, _accessibilityService, _configurationService, _accessibleViewService, _textModelResolverService, _chatService, _hoverService) {
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._contextKeyService = _contextKeyService;
    this._keybindingService = _keybindingService;
    this._accessibilityService = _accessibilityService;
    this._configurationService = _configurationService;
    this._accessibleViewService = _accessibleViewService;
    this._textModelResolverService = _textModelResolverService;
    this._chatService = _chatService;
    this._hoverService = _hoverService;
    this._elements = h(
      "div.inline-chat@root",
      [
        h("div.chat-widget@chatWidget"),
        h("div.accessibleViewer@accessibleViewer"),
        h("div.status@status", [
          h("div.label.info.hidden@infoLabel"),
          h("div.actions.hidden@toolbar1"),
          h("div.label.status.hidden@statusLabel"),
          h("div.actions.secondary.hidden@toolbar2")
        ])
      ]
    );
    this._store = new DisposableStore();
    this._onDidChangeHeight = this._store.add(new Emitter());
    this.onDidChangeHeight = Event.filter(this._onDidChangeHeight.event, (_) => !this._isLayouting);
    this._requestInProgress = observableValue(this, false);
    this.requestInProgress = this._requestInProgress;
    this._isLayouting = false;
    this.scopedContextKeyService = this._store.add(_contextKeyService.createScoped(this._elements.chatWidget));
    const scopedInstaService = _instantiationService.createChild(
      new ServiceCollection([
        IContextKeyService,
        this.scopedContextKeyService
      ]),
      this._store
    );
    this._chatWidget = scopedInstaService.createInstance(
      ChatWidget,
      location,
      void 0,
      {
        autoScroll: true,
        defaultElementHeight: 32,
        renderStyle: "minimal",
        renderInputOnTop: false,
        renderFollowups: true,
        supportsFileReferences: true,
        filter: (item) => {
          if (!isResponseVM(item) || item.errorDetails) {
            return true;
          }
          const emptyResponse = item.response.value.length === 0;
          if (emptyResponse) {
            return false;
          }
          if (item.response.value.every((item2) => item2.kind === "textEditGroup" && _options.chatWidgetViewOptions?.rendererOptions?.renderTextEditsAsSummary?.(item2.uri))) {
            return false;
          }
          return true;
        },
        ..._options.chatWidgetViewOptions
      },
      {
        listForeground: inlineChatForeground,
        listBackground: inlineChatBackground,
        overlayBackground: EDITOR_DRAG_AND_DROP_BACKGROUND,
        inputEditorBackground: inputBackground,
        resultEditorBackground: editorBackground
      }
    );
    this._elements.root.classList.toggle("in-zone-widget", !!_options.inZoneWidget);
    this._chatWidget.render(this._elements.chatWidget);
    this._elements.chatWidget.style.setProperty(asCssVariableName(chatRequestBackground), asCssVariable(inlineChatBackground));
    this._chatWidget.setVisible(true);
    this._store.add(this._chatWidget);
    const ctxResponse = ChatContextKeys.isResponse.bindTo(this.scopedContextKeyService);
    const ctxResponseVote = ChatContextKeys.responseVote.bindTo(this.scopedContextKeyService);
    const ctxResponseSupportIssues = ChatContextKeys.responseSupportsIssueReporting.bindTo(this.scopedContextKeyService);
    const ctxResponseError = ChatContextKeys.responseHasError.bindTo(this.scopedContextKeyService);
    const ctxResponseErrorFiltered = ChatContextKeys.responseIsFiltered.bindTo(this.scopedContextKeyService);
    const viewModelStore = this._store.add(new DisposableStore());
    this._store.add(this._chatWidget.onDidChangeViewModel(() => {
      viewModelStore.clear();
      const viewModel = this._chatWidget.viewModel;
      if (!viewModel) {
        return;
      }
      viewModelStore.add(toDisposable(() => {
        toolbar2.context = void 0;
        ctxResponse.reset();
        ctxResponseVote.reset();
        ctxResponseError.reset();
        ctxResponseErrorFiltered.reset();
        ctxResponseSupportIssues.reset();
      }));
      viewModelStore.add(viewModel.onDidChange(() => {
        this._requestInProgress.set(viewModel.requestInProgress, void 0);
        const last = viewModel.getItems().at(-1);
        toolbar2.context = last;
        ctxResponse.set(isResponseVM(last));
        ctxResponseVote.set(isResponseVM(last) ? last.vote === ChatAgentVoteDirection.Down ? "down" : last.vote === ChatAgentVoteDirection.Up ? "up" : "" : "");
        ctxResponseError.set(isResponseVM(last) && last.errorDetails !== void 0);
        ctxResponseErrorFiltered.set(!!(isResponseVM(last) && last.errorDetails?.responseIsFiltered));
        ctxResponseSupportIssues.set(isResponseVM(last) && (last.agent?.metadata.supportIssueReporting ?? false));
        this._onDidChangeHeight.fire();
      }));
      this._onDidChangeHeight.fire();
    }));
    this._store.add(this.chatWidget.onDidChangeContentHeight(() => {
      this._onDidChangeHeight.fire();
    }));
    this._ctxResponseFocused = CTX_INLINE_CHAT_RESPONSE_FOCUSED.bindTo(this._contextKeyService);
    const tracker = this._store.add(trackFocus(this.domNode));
    this._store.add(tracker.onDidBlur(() => this._ctxResponseFocused.set(false)));
    this._store.add(tracker.onDidFocus(() => this._ctxResponseFocused.set(true)));
    this._ctxInputEditorFocused = CTX_INLINE_CHAT_FOCUSED.bindTo(_contextKeyService);
    this._store.add(this._chatWidget.inputEditor.onDidFocusEditorWidget(() => this._ctxInputEditorFocused.set(true)));
    this._store.add(this._chatWidget.inputEditor.onDidBlurEditorWidget(() => this._ctxInputEditorFocused.set(false)));
    const statusMenuId = _options.statusMenuId instanceof MenuId ? _options.statusMenuId : _options.statusMenuId.menu;
    const statusMenuOptions = _options.statusMenuId instanceof MenuId ? void 0 : _options.statusMenuId.options;
    const statusButtonBar = scopedInstaService.createInstance(MenuWorkbenchButtonBar, this._elements.toolbar1, statusMenuId, {
      toolbarOptions: { primaryGroup: "0_main" },
      telemetrySource: _options.chatWidgetViewOptions?.menus?.telemetrySource,
      menuOptions: { renderShortTitle: true },
      ...statusMenuOptions
    });
    this._store.add(statusButtonBar.onDidChange(() => this._onDidChangeHeight.fire()));
    this._store.add(statusButtonBar);
    const toolbar2 = scopedInstaService.createInstance(MenuWorkbenchToolBar, this._elements.toolbar2, _options.secondaryMenuId ?? MenuId.for(""), {
      telemetrySource: _options.chatWidgetViewOptions?.menus?.telemetrySource,
      menuOptions: { renderShortTitle: true, shouldForwardArgs: true },
      actionViewItemProvider: (action, options) => {
        if (action instanceof MenuItemAction && action.item.id === MarkUnhelpfulActionId) {
          return scopedInstaService.createInstance(ChatVoteDownButton, action, options);
        }
        return createActionViewItem(scopedInstaService, action, options);
      }
    });
    this._store.add(toolbar2.onDidChangeMenuItems(() => this._onDidChangeHeight.fire()));
    this._store.add(toolbar2);
    this._store.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AccessibilityVerbositySettingId.InlineChat)) {
        this._updateAriaLabel();
      }
    }));
    this._elements.root.tabIndex = 0;
    this._elements.statusLabel.tabIndex = 0;
    this._updateAriaLabel();
    this._store.add(this._hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this._elements.statusLabel, () => {
      return this._elements.statusLabel.dataset["title"];
    }));
    this._store.add(this._chatService.onDidPerformUserAction((e) => {
      if (e.sessionId === this._chatWidget.viewModel?.model.sessionId && e.action.kind === "vote") {
        this.updateStatus("Thank you for your feedback!", { resetAfter: 1250 });
      }
    }));
  }
  _updateAriaLabel() {
    this._elements.root.ariaLabel = this._accessibleViewService.getOpenAriaHint(AccessibilityVerbositySettingId.InlineChat);
    if (this._accessibilityService.isScreenReaderOptimized()) {
      let label = defaultAriaLabel;
      if (this._configurationService.getValue(AccessibilityVerbositySettingId.InlineChat)) {
        const kbLabel = this._keybindingService.lookupKeybinding(AccessibilityCommandId.OpenAccessibilityHelp)?.getLabel();
        label = kbLabel ? localize("inlineChat.accessibilityHelp", "Inline Chat Input, Use {0} for Inline Chat Accessibility Help.", kbLabel) : localize("inlineChat.accessibilityHelpNoKb", "Inline Chat Input, Run the Inline Chat Accessibility Help command for more information.");
      }
      this._chatWidget.inputEditor.updateOptions({ ariaLabel: label });
    }
  }
  dispose() {
    this._store.dispose();
  }
  get domNode() {
    return this._elements.root;
  }
  get chatWidget() {
    return this._chatWidget;
  }
  saveState() {
    this._chatWidget.saveState();
  }
  layout(widgetDim) {
    const contentHeight = this.contentHeight;
    this._isLayouting = true;
    try {
      this._doLayout(widgetDim);
    } finally {
      this._isLayouting = false;
      if (this.contentHeight !== contentHeight) {
        this._onDidChangeHeight.fire();
      }
    }
  }
  _doLayout(dimension) {
    const extraHeight = this._getExtraHeight();
    const statusHeight = getTotalHeight(this._elements.status);
    this._elements.root.style.height = `${dimension.height - extraHeight}px`;
    this._elements.root.style.width = `${dimension.width}px`;
    this._chatWidget.layout(
      dimension.height - statusHeight - extraHeight,
      dimension.width
    );
  }
  /**
   * The content height of this widget is the size that would require no scrolling
   */
  get contentHeight() {
    const data = {
      chatWidgetContentHeight: this._chatWidget.contentHeight,
      statusHeight: getTotalHeight(this._elements.status),
      extraHeight: this._getExtraHeight()
    };
    const result = data.chatWidgetContentHeight + data.statusHeight + data.extraHeight;
    return result;
  }
  get minHeight() {
    let maxWidgetOutputHeight = 100;
    for (const item of this._chatWidget.viewModel?.getItems() ?? []) {
      if (isResponseVM(item) && item.response.value.some((r) => r.kind === "textEditGroup" && !r.state?.applied)) {
        maxWidgetOutputHeight = 270;
        break;
      }
    }
    let value = this.contentHeight;
    value -= this._chatWidget.contentHeight;
    value += Math.min(this._chatWidget.input.contentHeight + maxWidgetOutputHeight, this._chatWidget.contentHeight);
    return value;
  }
  _getExtraHeight() {
    return this._options.inZoneWidget ? 1 : 2 + 4;
  }
  get value() {
    return this._chatWidget.getInput();
  }
  set value(value) {
    this._chatWidget.setInput(value);
  }
  selectAll() {
    this._chatWidget.inputEditor.setSelection(new Selection(1, 1, Number.MAX_SAFE_INTEGER, 1));
  }
  set placeholder(value) {
    this._chatWidget.setInputPlaceholder(value);
  }
  toggleStatus(show) {
    this._elements.toolbar1.classList.toggle("hidden", !show);
    this._elements.toolbar2.classList.toggle("hidden", !show);
    this._elements.status.classList.toggle("hidden", !show);
    this._elements.infoLabel.classList.toggle("hidden", !show);
    this._onDidChangeHeight.fire();
  }
  updateToolbar(show) {
    this._elements.root.classList.toggle("toolbar", show);
    this._elements.toolbar1.classList.toggle("hidden", !show);
    this._elements.toolbar2.classList.toggle("hidden", !show);
    this._elements.status.classList.toggle("actions", show);
    this._elements.infoLabel.classList.toggle("hidden", show);
    this._onDidChangeHeight.fire();
  }
  async getCodeBlockInfo(codeBlockIndex) {
    const { viewModel } = this._chatWidget;
    if (!viewModel) {
      return void 0;
    }
    const items = viewModel.getItems().filter((i) => isResponseVM(i));
    const item = items.at(-1);
    if (!item) {
      return;
    }
    return viewModel.codeBlockModelCollection.get(viewModel.sessionId, item, codeBlockIndex)?.model;
  }
  get responseContent() {
    const requests = this._chatWidget.viewModel?.model.getRequests();
    return requests?.at(-1)?.response?.response.toString();
  }
  getChatModel() {
    return this._chatWidget.viewModel?.model;
  }
  setChatModel(chatModel, state) {
    this._chatWidget.setModel(chatModel, { ...state, inputValue: void 0 });
  }
  updateInfo(message) {
    this._elements.infoLabel.classList.toggle("hidden", !message);
    const renderedMessage = renderLabelWithIcons(message);
    reset(this._elements.infoLabel, ...renderedMessage);
    this._onDidChangeHeight.fire();
  }
  updateStatus(message, ops = {}) {
    const isTempMessage = typeof ops.resetAfter === "number";
    if (isTempMessage && !this._elements.statusLabel.dataset["state"]) {
      const statusLabel = this._elements.statusLabel.innerText;
      const title = this._elements.statusLabel.dataset["title"];
      const classes = Array.from(this._elements.statusLabel.classList.values());
      setTimeout(() => {
        this.updateStatus(statusLabel, { classes, keepMessage: true, title });
      }, ops.resetAfter);
    }
    const renderedMessage = renderLabelWithIcons(message);
    reset(this._elements.statusLabel, ...renderedMessage);
    this._elements.statusLabel.className = `label status ${(ops.classes ?? []).join(" ")}`;
    this._elements.statusLabel.classList.toggle("hidden", !message);
    if (isTempMessage) {
      this._elements.statusLabel.dataset["state"] = "temp";
    } else {
      delete this._elements.statusLabel.dataset["state"];
    }
    if (ops.title) {
      this._elements.statusLabel.dataset["title"] = ops.title;
    } else {
      delete this._elements.statusLabel.dataset["title"];
    }
    this._onDidChangeHeight.fire();
  }
  reset() {
    this._chatWidget.attachmentModel.clear();
    this._chatWidget.saveState();
    reset(this._elements.statusLabel);
    this._elements.statusLabel.classList.toggle("hidden", true);
    this._elements.toolbar1.classList.add("hidden");
    this._elements.toolbar2.classList.add("hidden");
    this.updateInfo("");
    this._elements.accessibleViewer.classList.toggle("hidden", true);
    this._onDidChangeHeight.fire();
  }
  focus() {
    this._chatWidget.focusInput();
  }
  hasFocus() {
    return this.domNode.contains(getActiveElement());
  }
};
InlineChatWidget = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IAccessibilityService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAccessibleViewService),
  __decorateParam(8, ITextModelService),
  __decorateParam(9, IChatService),
  __decorateParam(10, IHoverService)
], InlineChatWidget);
const defaultAriaLabel = localize("aria-label", "Inline Chat Input");
let EditorBasedInlineChatWidget = class extends InlineChatWidget {
  constructor(location, _parentEditor, options, contextKeyService, keybindingService, instantiationService, accessibilityService, configurationService, accessibleViewService, textModelResolverService, chatService, hoverService, layoutService) {
    const overflowWidgetsNode = layoutService.getContainer(getWindow(_parentEditor.getContainerDomNode())).appendChild($(".inline-chat-overflow.monaco-editor"));
    super(location, {
      ...options,
      chatWidgetViewOptions: {
        ...options.chatWidgetViewOptions,
        editorOverflowWidgetsDomNode: overflowWidgetsNode
      }
    }, instantiationService, contextKeyService, keybindingService, accessibilityService, configurationService, accessibleViewService, textModelResolverService, chatService, hoverService);
    this._parentEditor = _parentEditor;
    this._accessibleViewer = this._store.add(new MutableDisposable());
    this._store.add(toDisposable(() => {
      overflowWidgetsNode.remove();
    }));
  }
  // --- layout
  get contentHeight() {
    let result = super.contentHeight;
    if (this._accessibleViewer.value) {
      result += this._accessibleViewer.value.height + 8;
    }
    return result;
  }
  _doLayout(dimension) {
    let newHeight = dimension.height;
    if (this._accessibleViewer.value) {
      this._accessibleViewer.value.width = dimension.width - 12;
      newHeight -= this._accessibleViewer.value.height + 8;
    }
    super._doLayout(dimension.with(void 0, newHeight));
    this._elements.root.style.height = `${dimension.height - this._getExtraHeight()}px`;
  }
  reset() {
    this._accessibleViewer.clear();
    super.reset();
  }
  // --- accessible viewer
  showAccessibleHunk(session, hunkData) {
    this._elements.accessibleViewer.classList.remove("hidden");
    this._accessibleViewer.clear();
    this._accessibleViewer.value = this._instantiationService.createInstance(
      HunkAccessibleDiffViewer,
      this._elements.accessibleViewer,
      session,
      hunkData,
      new AccessibleHunk(this._parentEditor, session, hunkData)
    );
    this._onDidChangeHeight.fire();
  }
};
EditorBasedInlineChatWidget = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IAccessibilityService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibleViewService),
  __decorateParam(9, ITextModelService),
  __decorateParam(10, IChatService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, ILayoutService)
], EditorBasedInlineChatWidget);
let HunkAccessibleDiffViewer = class extends AccessibleDiffViewer {
  set width(value) {
    this._width2.set(value, void 0);
  }
  constructor(parentNode, session, hunk, models, instantiationService) {
    const width = observableValue("width", 0);
    const diff = observableValue("diff", HunkAccessibleDiffViewer._asMapping(hunk));
    const diffs = derived((r) => [diff.read(r)]);
    const lines = Math.min(10, 8 + diff.get().changedLineCount);
    const height = models.getModifiedOptions().get(EditorOption.lineHeight) * lines;
    super(parentNode, constObservable(true), () => {
    }, constObservable(false), width, constObservable(height), diffs, models, instantiationService);
    this.height = height;
    this._width2 = width;
    this._store.add(session.textModelN.onDidChangeContent(() => {
      diff.set(HunkAccessibleDiffViewer._asMapping(hunk), void 0);
    }));
  }
  static _asMapping(hunk) {
    const ranges0 = hunk.getRanges0();
    const rangesN = hunk.getRangesN();
    const originalLineRange = LineRange.fromRangeInclusive(ranges0[0]);
    const modifiedLineRange = LineRange.fromRangeInclusive(rangesN[0]);
    const innerChanges = [];
    for (let i = 1; i < ranges0.length; i++) {
      innerChanges.push(new RangeMapping(ranges0[i], rangesN[i]));
    }
    return new DetailedLineRangeMapping(originalLineRange, modifiedLineRange, innerChanges);
  }
};
HunkAccessibleDiffViewer = __decorateClass([
  __decorateParam(4, IInstantiationService)
], HunkAccessibleDiffViewer);
class AccessibleHunk {
  constructor(_editor, _session, _hunk) {
    this._editor = _editor;
    this._session = _session;
    this._hunk = _hunk;
  }
  getOriginalModel() {
    return this._session.textModel0;
  }
  getModifiedModel() {
    return this._session.textModelN;
  }
  getOriginalOptions() {
    return this._editor.getOptions();
  }
  getModifiedOptions() {
    return this._editor.getOptions();
  }
  originalReveal(range) {
  }
  modifiedReveal(range) {
    this._editor.revealRangeInCenterIfOutsideViewport(range || this._hunk.getRangesN()[0], ScrollType.Smooth);
  }
  modifiedSetSelection(range) {
  }
  modifiedFocus() {
    this._editor.focus();
  }
  getModifiedPosition() {
    return this._hunk.getRangesN()[0].getStartPosition();
  }
}
export {
  EditorBasedInlineChatWidget,
  InlineChatWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDaGF0L2Jyb3dzZXIvaW5saW5lQ2hhdFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgZ2V0QWN0aXZlRWxlbWVudCwgZ2V0VG90YWxIZWlnaHQsIGdldFdpbmRvdywgaCwgcmVzZXQsIHRyYWNrRm9jdXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjb25zdE9ic2VydmFibGUsIGRlcml2ZWQsIElPYnNlcnZhYmxlLCBJU2V0dGFibGVPYnNlcnZhYmxlLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlRGlmZlZpZXdlciwgSUFjY2Vzc2libGVEaWZmVmlld2VyTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9jb21wb25lbnRzL2FjY2Vzc2libGVEaWZmVmlld2VyLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiwgSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgTGluZVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IERldGFpbGVkTGluZVJhbmdlTWFwcGluZywgUmFuZ2VNYXBwaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9kaWZmL3JhbmdlTWFwcGluZy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclZpZXdTdGF0ZSwgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2libGVWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlldy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hCdXR0b25CYXJPcHRpb25zLCBNZW51V29ya2JlbmNoQnV0dG9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL2J1dHRvbmJhci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSwgSU1lbnVFbnRyeUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBNZW51V29ya2JlbmNoVG9vbEJhciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci90b29sYmFyLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGFzQ3NzVmFyaWFibGVOYW1lLCBlZGl0b3JCYWNrZ3JvdW5kLCBpbnB1dEJhY2tncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFRElUT1JfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eUNvbW1hbmRJZCB9IGZyb20gJy4uLy4uL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHlDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBNYXJrVW5oZWxwZnVsQWN0aW9uSWQgfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0VGl0bGVBY3Rpb25zLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0Vmlld09wdGlvbnMgfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0Vm90ZURvd25CdXR0b24gfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdExpc3RSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDaGF0V2lkZ2V0LCBJQ2hhdFZpZXdTdGF0ZSwgSUNoYXRXaWRnZXRMb2NhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBjaGF0UmVxdWVzdEJhY2tncm91bmQgfSBmcm9tICcuLi8uLi9jaGF0L2NvbW1vbi9jaGF0Q29sb3JzLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdE1vZGVsIH0gZnJvbSAnLi4vLi4vY2hhdC9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24sIElDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVzcG9uc2VWTSB9IGZyb20gJy4uLy4uL2NoYXQvY29tbW9uL2NoYXRWaWV3TW9kZWwuanMnO1xuaW1wb3J0IHsgQ1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQsIENUWF9JTkxJTkVfQ0hBVF9SRVNQT05TRV9GT0NVU0VELCBpbmxpbmVDaGF0QmFja2dyb3VuZCwgaW5saW5lQ2hhdEZvcmVncm91bmQgfSBmcm9tICcuLi9jb21tb24vaW5saW5lQ2hhdC5qcyc7XG5pbXBvcnQgeyBIdW5rSW5mb3JtYXRpb24sIFNlc3Npb24gfSBmcm9tICcuL2lubGluZUNoYXRTZXNzaW9uLmpzJztcbmltcG9ydCAnLi9tZWRpYS9pbmxpbmVDaGF0LmNzcyc7XG5cblxuZXhwb3J0IGludGVyZmFjZSBJbmxpbmVDaGF0V2lkZ2V0Vmlld1N0YXRlIHtcblx0ZWRpdG9yVmlld1N0YXRlOiBJQ29kZUVkaXRvclZpZXdTdGF0ZTtcblx0aW5wdXQ6IHN0cmluZztcblx0cGxhY2Vob2xkZXI6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW5saW5lQ2hhdFdpZGdldENvbnN0cnVjdGlvbk9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBUaGUgbWVudSB0aGF0IHJlbmRlcmVkIGFzIGJ1dHRvbiBiYXIsIHVzZSBmb3IgYWNjZXB0LCBkaXNjYXJkIGV0Y1xuXHQgKi9cblx0c3RhdHVzTWVudUlkOiBNZW51SWQgfCB7IG1lbnU6IE1lbnVJZDsgb3B0aW9uczogSVdvcmtiZW5jaEJ1dHRvbkJhck9wdGlvbnMgfTtcblxuXHRzZWNvbmRhcnlNZW51SWQ/OiBNZW51SWQ7XG5cblx0LyoqXG5cdCAqIFRoZSBvcHRpb25zIGZvciB0aGUgY2hhdCB3aWRnZXRcblx0ICovXG5cdGNoYXRXaWRnZXRWaWV3T3B0aW9ucz86IElDaGF0V2lkZ2V0Vmlld09wdGlvbnM7XG5cblx0aW5ab25lV2lkZ2V0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIElubGluZUNoYXRXaWRnZXQge1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfZWxlbWVudHMgPSBoKFxuXHRcdCdkaXYuaW5saW5lLWNoYXRAcm9vdCcsXG5cdFx0W1xuXHRcdFx0aCgnZGl2LmNoYXQtd2lkZ2V0QGNoYXRXaWRnZXQnKSxcblx0XHRcdGgoJ2Rpdi5hY2Nlc3NpYmxlVmlld2VyQGFjY2Vzc2libGVWaWV3ZXInKSxcblx0XHRcdGgoJ2Rpdi5zdGF0dXNAc3RhdHVzJywgW1xuXHRcdFx0XHRoKCdkaXYubGFiZWwuaW5mby5oaWRkZW5AaW5mb0xhYmVsJyksXG5cdFx0XHRcdGgoJ2Rpdi5hY3Rpb25zLmhpZGRlbkB0b29sYmFyMScpLFxuXHRcdFx0XHRoKCdkaXYubGFiZWwuc3RhdHVzLmhpZGRlbkBzdGF0dXNMYWJlbCcpLFxuXHRcdFx0XHRoKCdkaXYuYWN0aW9ucy5zZWNvbmRhcnkuaGlkZGVuQHRvb2xiYXIyJyksXG5cdFx0XHRdKSxcblx0XHRdXG5cdCk7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9zdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhJbnB1dEVkaXRvckZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhSZXNwb25zZUZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NoYXRXaWRnZXQ6IENoYXRXaWRnZXQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZUhlaWdodCA9IHRoaXMuX3N0b3JlLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VIZWlnaHQ6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuZmlsdGVyKHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmV2ZW50LCBfID0+ICF0aGlzLl9pc0xheW91dGluZyk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdEluUHJvZ3Jlc3MgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXHRyZWFkb25seSByZXF1ZXN0SW5Qcm9ncmVzczogSU9ic2VydmFibGU8Ym9vbGVhbj4gPSB0aGlzLl9yZXF1ZXN0SW5Qcm9ncmVzcztcblxuXHRwcml2YXRlIF9pc0xheW91dGluZzogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHJlYWRvbmx5IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bG9jYXRpb246IElDaGF0V2lkZ2V0TG9jYXRpb25PcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IElJbmxpbmVDaGF0V2lkZ2V0Q29uc3RydWN0aW9uT3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmxlVmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZVZpZXdTZXJ2aWNlOiBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgX3RleHRNb2RlbFJlc29sdmVyU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElDaGF0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jaGF0U2VydmljZTogSUNoYXRTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3N0b3JlLmFkZChfY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuX2VsZW1lbnRzLmNoYXRXaWRnZXQpKTtcblx0XHRjb25zdCBzY29wZWRJbnN0YVNlcnZpY2UgPSBfaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQoXG5cdFx0XHRuZXcgU2VydmljZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2Vcblx0XHRcdF0pLFxuXHRcdFx0dGhpcy5fc3RvcmVcblx0XHQpO1xuXG5cdFx0dGhpcy5fY2hhdFdpZGdldCA9IHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdENoYXRXaWRnZXQsXG5cdFx0XHRsb2NhdGlvbixcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHtcblx0XHRcdFx0YXV0b1Njcm9sbDogdHJ1ZSxcblx0XHRcdFx0ZGVmYXVsdEVsZW1lbnRIZWlnaHQ6IDMyLFxuXHRcdFx0XHRyZW5kZXJTdHlsZTogJ21pbmltYWwnLFxuXHRcdFx0XHRyZW5kZXJJbnB1dE9uVG9wOiBmYWxzZSxcblx0XHRcdFx0cmVuZGVyRm9sbG93dXBzOiB0cnVlLFxuXHRcdFx0XHRzdXBwb3J0c0ZpbGVSZWZlcmVuY2VzOiB0cnVlLFxuXHRcdFx0XHRmaWx0ZXI6IGl0ZW0gPT4ge1xuXHRcdFx0XHRcdGlmICghaXNSZXNwb25zZVZNKGl0ZW0pIHx8IGl0ZW0uZXJyb3JEZXRhaWxzKSB7XG5cdFx0XHRcdFx0XHQvLyBzaG93IGFsbCByZXF1ZXN0cyBhbmQgZXJyb3JzXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgZW1wdHlSZXNwb25zZSA9IGl0ZW0ucmVzcG9uc2UudmFsdWUubGVuZ3RoID09PSAwO1xuXHRcdFx0XHRcdGlmIChlbXB0eVJlc3BvbnNlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChpdGVtLnJlc3BvbnNlLnZhbHVlLmV2ZXJ5KGl0ZW0gPT4gaXRlbS5raW5kID09PSAndGV4dEVkaXRHcm91cCcgJiYgX29wdGlvbnMuY2hhdFdpZGdldFZpZXdPcHRpb25zPy5yZW5kZXJlck9wdGlvbnM/LnJlbmRlclRleHRFZGl0c0FzU3VtbWFyeT8uKGl0ZW0udXJpKSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdC4uLl9vcHRpb25zLmNoYXRXaWRnZXRWaWV3T3B0aW9uc1xuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGlzdEZvcmVncm91bmQ6IGlubGluZUNoYXRGb3JlZ3JvdW5kLFxuXHRcdFx0XHRsaXN0QmFja2dyb3VuZDogaW5saW5lQ2hhdEJhY2tncm91bmQsXG5cdFx0XHRcdG92ZXJsYXlCYWNrZ3JvdW5kOiBFRElUT1JfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5ELFxuXHRcdFx0XHRpbnB1dEVkaXRvckJhY2tncm91bmQ6IGlucHV0QmFja2dyb3VuZCxcblx0XHRcdFx0cmVzdWx0RWRpdG9yQmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZFxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0dGhpcy5fZWxlbWVudHMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdpbi16b25lLXdpZGdldCcsICEhX29wdGlvbnMuaW5ab25lV2lkZ2V0KTtcblx0XHR0aGlzLl9jaGF0V2lkZ2V0LnJlbmRlcih0aGlzLl9lbGVtZW50cy5jaGF0V2lkZ2V0KTtcblx0XHR0aGlzLl9lbGVtZW50cy5jaGF0V2lkZ2V0LnN0eWxlLnNldFByb3BlcnR5KGFzQ3NzVmFyaWFibGVOYW1lKGNoYXRSZXF1ZXN0QmFja2dyb3VuZCksIGFzQ3NzVmFyaWFibGUoaW5saW5lQ2hhdEJhY2tncm91bmQpKTtcblx0XHR0aGlzLl9jaGF0V2lkZ2V0LnNldFZpc2libGUodHJ1ZSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuX2NoYXRXaWRnZXQpO1xuXG5cdFx0Y29uc3QgY3R4UmVzcG9uc2UgPSBDaGF0Q29udGV4dEtleXMuaXNSZXNwb25zZS5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY3R4UmVzcG9uc2VWb3RlID0gQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlVm90ZS5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY3R4UmVzcG9uc2VTdXBwb3J0SXNzdWVzID0gQ2hhdENvbnRleHRLZXlzLnJlc3BvbnNlU3VwcG9ydHNJc3N1ZVJlcG9ydGluZy5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY3R4UmVzcG9uc2VFcnJvciA9IENoYXRDb250ZXh0S2V5cy5yZXNwb25zZUhhc0Vycm9yLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCBjdHhSZXNwb25zZUVycm9yRmlsdGVyZWQgPSBDaGF0Q29udGV4dEtleXMucmVzcG9uc2VJc0ZpbHRlcmVkLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHZpZXdNb2RlbFN0b3JlID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuX2NoYXRXaWRnZXQub25EaWRDaGFuZ2VWaWV3TW9kZWwoKCkgPT4ge1xuXHRcdFx0dmlld01vZGVsU3RvcmUuY2xlYXIoKTtcblxuXHRcdFx0Y29uc3Qgdmlld01vZGVsID0gdGhpcy5fY2hhdFdpZGdldC52aWV3TW9kZWw7XG5cdFx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZpZXdNb2RlbFN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHR0b29sYmFyMi5jb250ZXh0ID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRjdHhSZXNwb25zZS5yZXNldCgpO1xuXHRcdFx0XHRjdHhSZXNwb25zZVZvdGUucmVzZXQoKTtcblx0XHRcdFx0Y3R4UmVzcG9uc2VFcnJvci5yZXNldCgpO1xuXHRcdFx0XHRjdHhSZXNwb25zZUVycm9yRmlsdGVyZWQucmVzZXQoKTtcblx0XHRcdFx0Y3R4UmVzcG9uc2VTdXBwb3J0SXNzdWVzLnJlc2V0KCk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHZpZXdNb2RlbFN0b3JlLmFkZCh2aWV3TW9kZWwub25EaWRDaGFuZ2UoKCkgPT4ge1xuXG5cdFx0XHRcdHRoaXMuX3JlcXVlc3RJblByb2dyZXNzLnNldCh2aWV3TW9kZWwucmVxdWVzdEluUHJvZ3Jlc3MsIHVuZGVmaW5lZCk7XG5cblx0XHRcdFx0Y29uc3QgbGFzdCA9IHZpZXdNb2RlbC5nZXRJdGVtcygpLmF0KC0xKTtcblx0XHRcdFx0dG9vbGJhcjIuY29udGV4dCA9IGxhc3Q7XG5cblx0XHRcdFx0Y3R4UmVzcG9uc2Uuc2V0KGlzUmVzcG9uc2VWTShsYXN0KSk7XG5cdFx0XHRcdGN0eFJlc3BvbnNlVm90ZS5zZXQoaXNSZXNwb25zZVZNKGxhc3QpID8gbGFzdC52b3RlID09PSBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLkRvd24gPyAnZG93bicgOiBsYXN0LnZvdGUgPT09IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24uVXAgPyAndXAnIDogJycgOiAnJyk7XG5cdFx0XHRcdGN0eFJlc3BvbnNlRXJyb3Iuc2V0KGlzUmVzcG9uc2VWTShsYXN0KSAmJiBsYXN0LmVycm9yRGV0YWlscyAhPT0gdW5kZWZpbmVkKTtcblx0XHRcdFx0Y3R4UmVzcG9uc2VFcnJvckZpbHRlcmVkLnNldCgoISEoaXNSZXNwb25zZVZNKGxhc3QpICYmIGxhc3QuZXJyb3JEZXRhaWxzPy5yZXNwb25zZUlzRmlsdGVyZWQpKSk7XG5cdFx0XHRcdGN0eFJlc3BvbnNlU3VwcG9ydElzc3Vlcy5zZXQoaXNSZXNwb25zZVZNKGxhc3QpICYmIChsYXN0LmFnZW50Py5tZXRhZGF0YS5zdXBwb3J0SXNzdWVSZXBvcnRpbmcgPz8gZmFsc2UpKTtcblxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuY2hhdFdpZGdldC5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdC8vIGNvbnRleHQga2V5c1xuXHRcdHRoaXMuX2N0eFJlc3BvbnNlRm9jdXNlZCA9IENUWF9JTkxJTkVfQ0hBVF9SRVNQT05TRV9GT0NVU0VELmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgdHJhY2tlciA9IHRoaXMuX3N0b3JlLmFkZCh0cmFja0ZvY3VzKHRoaXMuZG9tTm9kZSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0cmFja2VyLm9uRGlkQmx1cigoKSA9PiB0aGlzLl9jdHhSZXNwb25zZUZvY3VzZWQuc2V0KGZhbHNlKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0cmFja2VyLm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5fY3R4UmVzcG9uc2VGb2N1c2VkLnNldCh0cnVlKSkpO1xuXG5cdFx0dGhpcy5fY3R4SW5wdXRFZGl0b3JGb2N1c2VkID0gQ1RYX0lOTElORV9DSEFUX0ZPQ1VTRUQuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuX2NoYXRXaWRnZXQuaW5wdXRFZGl0b3Iub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB0aGlzLl9jdHhJbnB1dEVkaXRvckZvY3VzZWQuc2V0KHRydWUpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHRoaXMuX2NoYXRXaWRnZXQuaW5wdXRFZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHRoaXMuX2N0eElucHV0RWRpdG9yRm9jdXNlZC5zZXQoZmFsc2UpKSk7XG5cblx0XHRjb25zdCBzdGF0dXNNZW51SWQgPSBfb3B0aW9ucy5zdGF0dXNNZW51SWQgaW5zdGFuY2VvZiBNZW51SWQgPyBfb3B0aW9ucy5zdGF0dXNNZW51SWQgOiBfb3B0aW9ucy5zdGF0dXNNZW51SWQubWVudTtcblxuXHRcdC8vIEJVVFRPTiBiYXJcblx0XHRjb25zdCBzdGF0dXNNZW51T3B0aW9ucyA9IF9vcHRpb25zLnN0YXR1c01lbnVJZCBpbnN0YW5jZW9mIE1lbnVJZCA/IHVuZGVmaW5lZCA6IF9vcHRpb25zLnN0YXR1c01lbnVJZC5vcHRpb25zO1xuXHRcdGNvbnN0IHN0YXR1c0J1dHRvbkJhciA9IHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51V29ya2JlbmNoQnV0dG9uQmFyLCB0aGlzLl9lbGVtZW50cy50b29sYmFyMSwgc3RhdHVzTWVudUlkLCB7XG5cdFx0XHR0b29sYmFyT3B0aW9uczogeyBwcmltYXJ5R3JvdXA6ICcwX21haW4nIH0sXG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6IF9vcHRpb25zLmNoYXRXaWRnZXRWaWV3T3B0aW9ucz8ubWVudXM/LnRlbGVtZXRyeVNvdXJjZSxcblx0XHRcdG1lbnVPcHRpb25zOiB7IHJlbmRlclNob3J0VGl0bGU6IHRydWUgfSxcblx0XHRcdC4uLnN0YXR1c01lbnVPcHRpb25zLFxuXHRcdH0pO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChzdGF0dXNCdXR0b25CYXIub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKHN0YXR1c0J1dHRvbkJhcik7XG5cblx0XHQvLyBzZWNvbmRhcnkgdG9vbGJhclxuXHRcdGNvbnN0IHRvb2xiYXIyID0gc2NvcGVkSW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1lbnVXb3JrYmVuY2hUb29sQmFyLCB0aGlzLl9lbGVtZW50cy50b29sYmFyMiwgX29wdGlvbnMuc2Vjb25kYXJ5TWVudUlkID8/IE1lbnVJZC5mb3IoJycpLCB7XG5cdFx0XHR0ZWxlbWV0cnlTb3VyY2U6IF9vcHRpb25zLmNoYXRXaWRnZXRWaWV3T3B0aW9ucz8ubWVudXM/LnRlbGVtZXRyeVNvdXJjZSxcblx0XHRcdG1lbnVPcHRpb25zOiB7IHJlbmRlclNob3J0VGl0bGU6IHRydWUsIHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0sXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbiAmJiBhY3Rpb24uaXRlbS5pZCA9PT0gTWFya1VuaGVscGZ1bEFjdGlvbklkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNjb3BlZEluc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0Vm90ZURvd25CdXR0b24sIGFjdGlvbiwgb3B0aW9ucyBhcyBJTWVudUVudHJ5QWN0aW9uVmlld0l0ZW1PcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY3JlYXRlQWN0aW9uVmlld0l0ZW0oc2NvcGVkSW5zdGFTZXJ2aWNlLCBhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0b29sYmFyMi5vbkRpZENoYW5nZU1lbnVJdGVtcygoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCkpKTtcblx0XHR0aGlzLl9zdG9yZS5hZGQodG9vbGJhcjIpO1xuXG5cblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQWNjZXNzaWJpbGl0eVZlcmJvc2l0eVNldHRpbmdJZC5JbmxpbmVDaGF0KSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVBcmlhTGFiZWwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9lbGVtZW50cy5yb290LnRhYkluZGV4ID0gMDtcblx0XHR0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC50YWJJbmRleCA9IDA7XG5cdFx0dGhpcy5fdXBkYXRlQXJpYUxhYmVsKCk7XG5cblx0XHQvLyB0aGlzLl9lbGVtZW50cy5zdGF0dXNcblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdlbGVtZW50JyksIHRoaXMuX2VsZW1lbnRzLnN0YXR1c0xhYmVsLCAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZWxlbWVudHMuc3RhdHVzTGFiZWwuZGF0YXNldFsndGl0bGUnXTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5fY2hhdFNlcnZpY2Uub25EaWRQZXJmb3JtVXNlckFjdGlvbihlID0+IHtcblx0XHRcdGlmIChlLnNlc3Npb25JZCA9PT0gdGhpcy5fY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsLnNlc3Npb25JZCAmJiBlLmFjdGlvbi5raW5kID09PSAndm90ZScpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoJ1RoYW5rIHlvdSBmb3IgeW91ciBmZWVkYmFjayEnLCB7IHJlc2V0QWZ0ZXI6IDEyNTAgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQXJpYUxhYmVsKCk6IHZvaWQge1xuXG5cdFx0dGhpcy5fZWxlbWVudHMucm9vdC5hcmlhTGFiZWwgPSB0aGlzLl9hY2Nlc3NpYmxlVmlld1NlcnZpY2UuZ2V0T3BlbkFyaWFIaW50KEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQuSW5saW5lQ2hhdCk7XG5cblx0XHRpZiAodGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSkge1xuXHRcdFx0bGV0IGxhYmVsID0gZGVmYXVsdEFyaWFMYWJlbDtcblx0XHRcdGlmICh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLklubGluZUNoYXQpKSB7XG5cdFx0XHRcdGNvbnN0IGtiTGFiZWwgPSB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKEFjY2Vzc2liaWxpdHlDb21tYW5kSWQuT3BlbkFjY2Vzc2liaWxpdHlIZWxwKT8uZ2V0TGFiZWwoKTtcblx0XHRcdFx0bGFiZWwgPSBrYkxhYmVsXG5cdFx0XHRcdFx0PyBsb2NhbGl6ZSgnaW5saW5lQ2hhdC5hY2Nlc3NpYmlsaXR5SGVscCcsIFwiSW5saW5lIENoYXQgSW5wdXQsIFVzZSB7MH0gZm9yIElubGluZSBDaGF0IEFjY2Vzc2liaWxpdHkgSGVscC5cIiwga2JMYWJlbClcblx0XHRcdFx0XHQ6IGxvY2FsaXplKCdpbmxpbmVDaGF0LmFjY2Vzc2liaWxpdHlIZWxwTm9LYicsIFwiSW5saW5lIENoYXQgSW5wdXQsIFJ1biB0aGUgSW5saW5lIENoYXQgQWNjZXNzaWJpbGl0eSBIZWxwIGNvbW1hbmQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXCIpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY2hhdFdpZGdldC5pbnB1dEVkaXRvci51cGRhdGVPcHRpb25zKHsgYXJpYUxhYmVsOiBsYWJlbCB9KTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGdldCBkb21Ob2RlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRyZXR1cm4gdGhpcy5fZWxlbWVudHMucm9vdDtcblx0fVxuXG5cdGdldCBjaGF0V2lkZ2V0KCk6IENoYXRXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLl9jaGF0V2lkZ2V0O1xuXHR9XG5cblx0c2F2ZVN0YXRlKCkge1xuXHRcdHRoaXMuX2NoYXRXaWRnZXQuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRsYXlvdXQod2lkZ2V0RGltOiBEaW1lbnNpb24pIHtcblx0XHRjb25zdCBjb250ZW50SGVpZ2h0ID0gdGhpcy5jb250ZW50SGVpZ2h0O1xuXHRcdHRoaXMuX2lzTGF5b3V0aW5nID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fZG9MYXlvdXQod2lkZ2V0RGltKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faXNMYXlvdXRpbmcgPSBmYWxzZTtcblxuXHRcdFx0aWYgKHRoaXMuY29udGVudEhlaWdodCAhPT0gY29udGVudEhlaWdodCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIF9kb0xheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdGNvbnN0IGV4dHJhSGVpZ2h0ID0gdGhpcy5fZ2V0RXh0cmFIZWlnaHQoKTtcblx0XHRjb25zdCBzdGF0dXNIZWlnaHQgPSBnZXRUb3RhbEhlaWdodCh0aGlzLl9lbGVtZW50cy5zdGF0dXMpO1xuXG5cdFx0Ly8gY29uc29sZS5sb2coJ1pPTkUjV2lkZ2V0I2xheW91dCcsIHsgaGVpZ2h0OiBkaW1lbnNpb24uaGVpZ2h0LCBleHRyYUhlaWdodCwgcHJvZ3Jlc3NIZWlnaHQsIGZvbGxvd1Vwc0hlaWdodCwgc3RhdHVzSGVpZ2h0LCBMSVNUOiBkaW1lbnNpb24uaGVpZ2h0IC0gcHJvZ3Jlc3NIZWlnaHQgLSBmb2xsb3dVcHNIZWlnaHQgLSBzdGF0dXNIZWlnaHQgLSBleHRyYUhlaWdodCB9KTtcblxuXHRcdHRoaXMuX2VsZW1lbnRzLnJvb3Quc3R5bGUuaGVpZ2h0ID0gYCR7ZGltZW5zaW9uLmhlaWdodCAtIGV4dHJhSGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9lbGVtZW50cy5yb290LnN0eWxlLndpZHRoID0gYCR7ZGltZW5zaW9uLndpZHRofXB4YDtcblxuXHRcdHRoaXMuX2NoYXRXaWRnZXQubGF5b3V0KFxuXHRcdFx0ZGltZW5zaW9uLmhlaWdodCAtIHN0YXR1c0hlaWdodCAtIGV4dHJhSGVpZ2h0LFxuXHRcdFx0ZGltZW5zaW9uLndpZHRoXG5cdFx0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgY29udGVudCBoZWlnaHQgb2YgdGhpcyB3aWRnZXQgaXMgdGhlIHNpemUgdGhhdCB3b3VsZCByZXF1aXJlIG5vIHNjcm9sbGluZ1xuXHQgKi9cblx0Z2V0IGNvbnRlbnRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRjb25zdCBkYXRhID0ge1xuXHRcdFx0Y2hhdFdpZGdldENvbnRlbnRIZWlnaHQ6IHRoaXMuX2NoYXRXaWRnZXQuY29udGVudEhlaWdodCxcblx0XHRcdHN0YXR1c0hlaWdodDogZ2V0VG90YWxIZWlnaHQodGhpcy5fZWxlbWVudHMuc3RhdHVzKSxcblx0XHRcdGV4dHJhSGVpZ2h0OiB0aGlzLl9nZXRFeHRyYUhlaWdodCgpXG5cdFx0fTtcblx0XHRjb25zdCByZXN1bHQgPSBkYXRhLmNoYXRXaWRnZXRDb250ZW50SGVpZ2h0ICsgZGF0YS5zdGF0dXNIZWlnaHQgKyBkYXRhLmV4dHJhSGVpZ2h0O1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRnZXQgbWluSGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0Ly8gVGhlIGNoYXQgd2lkZ2V0IGlzIHZhcmlhYmxlIGhlaWdodCBhbmQgc3VwcG9ydHMgc2Nyb2xsaW5nLiBJdCBzaG91bGQgYmVcblx0XHQvLyBhdCBsZWFzdCBcIm1heFdpZGdldEhlaWdodFwiIGhpZ2ggYW5kIGF0IG1vc3QgdGhlIGNvbnRlbnQgaGVpZ2h0LlxuXG5cdFx0bGV0IG1heFdpZGdldE91dHB1dEhlaWdodCA9IDEwMDtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5fY2hhdFdpZGdldC52aWV3TW9kZWw/LmdldEl0ZW1zKCkgPz8gW10pIHtcblx0XHRcdGlmIChpc1Jlc3BvbnNlVk0oaXRlbSkgJiYgaXRlbS5yZXNwb25zZS52YWx1ZS5zb21lKHIgPT4gci5raW5kID09PSAndGV4dEVkaXRHcm91cCcgJiYgIXIuc3RhdGU/LmFwcGxpZWQpKSB7XG5cdFx0XHRcdG1heFdpZGdldE91dHB1dEhlaWdodCA9IDI3MDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHZhbHVlID0gdGhpcy5jb250ZW50SGVpZ2h0O1xuXHRcdHZhbHVlIC09IHRoaXMuX2NoYXRXaWRnZXQuY29udGVudEhlaWdodDtcblx0XHR2YWx1ZSArPSBNYXRoLm1pbih0aGlzLl9jaGF0V2lkZ2V0LmlucHV0LmNvbnRlbnRIZWlnaHQgKyBtYXhXaWRnZXRPdXRwdXRIZWlnaHQsIHRoaXMuX2NoYXRXaWRnZXQuY29udGVudEhlaWdodCk7XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRFeHRyYUhlaWdodCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLl9vcHRpb25zLmluWm9uZVdpZGdldCA/IDEgOiAoMiAvKmJvcmRlciovICsgNCAvKnNoYWRvdyovKTtcblx0fVxuXG5cdGdldCB2YWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9jaGF0V2lkZ2V0LmdldElucHV0KCk7XG5cdH1cblxuXHRzZXQgdmFsdWUodmFsdWU6IHN0cmluZykge1xuXHRcdHRoaXMuX2NoYXRXaWRnZXQuc2V0SW5wdXQodmFsdWUpO1xuXHR9XG5cblx0c2VsZWN0QWxsKCkge1xuXHRcdHRoaXMuX2NoYXRXaWRnZXQuaW5wdXRFZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIDEpKTtcblx0fVxuXG5cdHNldCBwbGFjZWhvbGRlcih2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5fY2hhdFdpZGdldC5zZXRJbnB1dFBsYWNlaG9sZGVyKHZhbHVlKTtcblx0fVxuXG5cdHRvZ2dsZVN0YXR1cyhzaG93OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZWxlbWVudHMudG9vbGJhcjEuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXNob3cpO1xuXHRcdHRoaXMuX2VsZW1lbnRzLnRvb2xiYXIyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFzaG93KTtcblx0XHR0aGlzLl9lbGVtZW50cy5zdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXNob3cpO1xuXHRcdHRoaXMuX2VsZW1lbnRzLmluZm9MYWJlbC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhc2hvdyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHR9XG5cblx0dXBkYXRlVG9vbGJhcihzaG93OiBib29sZWFuKSB7XG5cdFx0dGhpcy5fZWxlbWVudHMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCd0b29sYmFyJywgc2hvdyk7XG5cdFx0dGhpcy5fZWxlbWVudHMudG9vbGJhcjEuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXNob3cpO1xuXHRcdHRoaXMuX2VsZW1lbnRzLnRvb2xiYXIyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsICFzaG93KTtcblx0XHR0aGlzLl9lbGVtZW50cy5zdGF0dXMuY2xhc3NMaXN0LnRvZ2dsZSgnYWN0aW9ucycsIHNob3cpO1xuXHRcdHRoaXMuX2VsZW1lbnRzLmluZm9MYWJlbC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCBzaG93KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdH1cblxuXHRhc3luYyBnZXRDb2RlQmxvY2tJbmZvKGNvZGVCbG9ja0luZGV4OiBudW1iZXIpOiBQcm9taXNlPElUZXh0TW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCB7IHZpZXdNb2RlbCB9ID0gdGhpcy5fY2hhdFdpZGdldDtcblx0XHRpZiAoIXZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgaXRlbXMgPSB2aWV3TW9kZWwuZ2V0SXRlbXMoKS5maWx0ZXIoaSA9PiBpc1Jlc3BvbnNlVk0oaSkpO1xuXHRcdGNvbnN0IGl0ZW0gPSBpdGVtcy5hdCgtMSk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB2aWV3TW9kZWwuY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uLmdldCh2aWV3TW9kZWwuc2Vzc2lvbklkLCBpdGVtLCBjb2RlQmxvY2tJbmRleCk/Lm1vZGVsO1xuXHR9XG5cblx0Z2V0IHJlc3BvbnNlQ29udGVudCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlcXVlc3RzID0gdGhpcy5fY2hhdFdpZGdldC52aWV3TW9kZWw/Lm1vZGVsLmdldFJlcXVlc3RzKCk7XG5cdFx0cmV0dXJuIHJlcXVlc3RzPy5hdCgtMSk/LnJlc3BvbnNlPy5yZXNwb25zZS50b1N0cmluZygpO1xuXHR9XG5cblxuXHRnZXRDaGF0TW9kZWwoKTogSUNoYXRNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoYXRXaWRnZXQudmlld01vZGVsPy5tb2RlbDtcblx0fVxuXG5cdHNldENoYXRNb2RlbChjaGF0TW9kZWw6IElDaGF0TW9kZWwsIHN0YXRlPzogSUNoYXRWaWV3U3RhdGUpIHtcblx0XHR0aGlzLl9jaGF0V2lkZ2V0LnNldE1vZGVsKGNoYXRNb2RlbCwgeyAuLi5zdGF0ZSwgaW5wdXRWYWx1ZTogdW5kZWZpbmVkIH0pO1xuXHR9XG5cblx0dXBkYXRlSW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9lbGVtZW50cy5pbmZvTGFiZWwuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIW1lc3NhZ2UpO1xuXHRcdGNvbnN0IHJlbmRlcmVkTWVzc2FnZSA9IHJlbmRlckxhYmVsV2l0aEljb25zKG1lc3NhZ2UpO1xuXHRcdHJlc2V0KHRoaXMuX2VsZW1lbnRzLmluZm9MYWJlbCwgLi4ucmVuZGVyZWRNZXNzYWdlKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdH1cblxuXHR1cGRhdGVTdGF0dXMobWVzc2FnZTogc3RyaW5nLCBvcHM6IHsgY2xhc3Nlcz86IHN0cmluZ1tdOyByZXNldEFmdGVyPzogbnVtYmVyOyBrZWVwTWVzc2FnZT86IGJvb2xlYW47IHRpdGxlPzogc3RyaW5nIH0gPSB7fSkge1xuXHRcdGNvbnN0IGlzVGVtcE1lc3NhZ2UgPSB0eXBlb2Ygb3BzLnJlc2V0QWZ0ZXIgPT09ICdudW1iZXInO1xuXHRcdGlmIChpc1RlbXBNZXNzYWdlICYmICF0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC5kYXRhc2V0WydzdGF0ZSddKSB7XG5cdFx0XHRjb25zdCBzdGF0dXNMYWJlbCA9IHRoaXMuX2VsZW1lbnRzLnN0YXR1c0xhYmVsLmlubmVyVGV4dDtcblx0XHRcdGNvbnN0IHRpdGxlID0gdGhpcy5fZWxlbWVudHMuc3RhdHVzTGFiZWwuZGF0YXNldFsndGl0bGUnXTtcblx0XHRcdGNvbnN0IGNsYXNzZXMgPSBBcnJheS5mcm9tKHRoaXMuX2VsZW1lbnRzLnN0YXR1c0xhYmVsLmNsYXNzTGlzdC52YWx1ZXMoKSk7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoc3RhdHVzTGFiZWwsIHsgY2xhc3Nlcywga2VlcE1lc3NhZ2U6IHRydWUsIHRpdGxlIH0pO1xuXHRcdFx0fSwgb3BzLnJlc2V0QWZ0ZXIpO1xuXHRcdH1cblx0XHRjb25zdCByZW5kZXJlZE1lc3NhZ2UgPSByZW5kZXJMYWJlbFdpdGhJY29ucyhtZXNzYWdlKTtcblx0XHRyZXNldCh0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbCwgLi4ucmVuZGVyZWRNZXNzYWdlKTtcblx0XHR0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC5jbGFzc05hbWUgPSBgbGFiZWwgc3RhdHVzICR7KG9wcy5jbGFzc2VzID8/IFtdKS5qb2luKCcgJyl9YDtcblx0XHR0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhbWVzc2FnZSk7XG5cdFx0aWYgKGlzVGVtcE1lc3NhZ2UpIHtcblx0XHRcdHRoaXMuX2VsZW1lbnRzLnN0YXR1c0xhYmVsLmRhdGFzZXRbJ3N0YXRlJ10gPSAndGVtcCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC5kYXRhc2V0WydzdGF0ZSddO1xuXHRcdH1cblxuXHRcdGlmIChvcHMudGl0bGUpIHtcblx0XHRcdHRoaXMuX2VsZW1lbnRzLnN0YXR1c0xhYmVsLmRhdGFzZXRbJ3RpdGxlJ10gPSBvcHMudGl0bGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlbGV0ZSB0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbC5kYXRhc2V0Wyd0aXRsZSddO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZUhlaWdodC5maXJlKCk7XG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9jaGF0V2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5jbGVhcigpO1xuXHRcdHRoaXMuX2NoYXRXaWRnZXQuc2F2ZVN0YXRlKCk7XG5cblx0XHRyZXNldCh0aGlzLl9lbGVtZW50cy5zdGF0dXNMYWJlbCk7XG5cdFx0dGhpcy5fZWxlbWVudHMuc3RhdHVzTGFiZWwuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgdHJ1ZSk7XG5cdFx0dGhpcy5fZWxlbWVudHMudG9vbGJhcjEuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0dGhpcy5fZWxlbWVudHMudG9vbGJhcjIuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG5cdFx0dGhpcy51cGRhdGVJbmZvKCcnKTtcblxuXHRcdHRoaXMuX2VsZW1lbnRzLmFjY2Vzc2libGVWaWV3ZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgdHJ1ZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIZWlnaHQuZmlyZSgpO1xuXHR9XG5cblx0Zm9jdXMoKSB7XG5cdFx0dGhpcy5fY2hhdFdpZGdldC5mb2N1c0lucHV0KCk7XG5cdH1cblxuXHRoYXNGb2N1cygpIHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlLmNvbnRhaW5zKGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdH1cblxufVxuXG5jb25zdCBkZWZhdWx0QXJpYUxhYmVsID0gbG9jYWxpemUoJ2FyaWEtbGFiZWwnLCBcIklubGluZSBDaGF0IElucHV0XCIpO1xuXG5leHBvcnQgY2xhc3MgRWRpdG9yQmFzZWRJbmxpbmVDaGF0V2lkZ2V0IGV4dGVuZHMgSW5saW5lQ2hhdFdpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJsZVZpZXdlciA9IHRoaXMuX3N0b3JlLmFkZChuZXcgTXV0YWJsZURpc3Bvc2FibGU8SHVua0FjY2Vzc2libGVEaWZmVmlld2VyPigpKTtcblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGxvY2F0aW9uOiBJQ2hhdFdpZGdldExvY2F0aW9uT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wYXJlbnRFZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdG9wdGlvbnM6IElJbmxpbmVDaGF0V2lkZ2V0Q29uc3RydWN0aW9uT3B0aW9ucyxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlIGFjY2Vzc2libGVWaWV3U2VydmljZTogSUFjY2Vzc2libGVWaWV3U2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASUNoYXRTZXJ2aWNlIGNoYXRTZXJ2aWNlOiBJQ2hhdFNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZVxuXHQpIHtcblx0XHRjb25zdCBvdmVyZmxvd1dpZGdldHNOb2RlID0gbGF5b3V0U2VydmljZS5nZXRDb250YWluZXIoZ2V0V2luZG93KF9wYXJlbnRFZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpKSkuYXBwZW5kQ2hpbGQoJCgnLmlubGluZS1jaGF0LW92ZXJmbG93Lm1vbmFjby1lZGl0b3InKSk7XG5cdFx0c3VwZXIobG9jYXRpb24sIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRjaGF0V2lkZ2V0Vmlld09wdGlvbnM6IHtcblx0XHRcdFx0Li4ub3B0aW9ucy5jaGF0V2lkZ2V0Vmlld09wdGlvbnMsXG5cdFx0XHRcdGVkaXRvck92ZXJmbG93V2lkZ2V0c0RvbU5vZGU6IG92ZXJmbG93V2lkZ2V0c05vZGVcblx0XHRcdH1cblx0XHR9LCBpbnN0YW50aWF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBhY2Nlc3NpYmlsaXR5U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGFjY2Vzc2libGVWaWV3U2VydmljZSwgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLCBjaGF0U2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0b3ZlcmZsb3dXaWRnZXRzTm9kZS5yZW1vdmUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gbGF5b3V0XG5cblx0b3ZlcnJpZGUgZ2V0IGNvbnRlbnRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRsZXQgcmVzdWx0ID0gc3VwZXIuY29udGVudEhlaWdodDtcblxuXHRcdGlmICh0aGlzLl9hY2Nlc3NpYmxlVmlld2VyLnZhbHVlKSB7XG5cdFx0XHRyZXN1bHQgKz0gdGhpcy5fYWNjZXNzaWJsZVZpZXdlci52YWx1ZS5oZWlnaHQgKyA4IC8qIHBhZGRpbmcgKi87XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfZG9MYXlvdXQoZGltZW5zaW9uOiBEaW1lbnNpb24pOiB2b2lkIHtcblxuXHRcdGxldCBuZXdIZWlnaHQgPSBkaW1lbnNpb24uaGVpZ2h0O1xuXG5cdFx0aWYgKHRoaXMuX2FjY2Vzc2libGVWaWV3ZXIudmFsdWUpIHtcblx0XHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3ZXIudmFsdWUud2lkdGggPSBkaW1lbnNpb24ud2lkdGggLSAxMjtcblx0XHRcdG5ld0hlaWdodCAtPSB0aGlzLl9hY2Nlc3NpYmxlVmlld2VyLnZhbHVlLmhlaWdodCArIDg7XG5cdFx0fVxuXG5cdFx0c3VwZXIuX2RvTGF5b3V0KGRpbWVuc2lvbi53aXRoKHVuZGVmaW5lZCwgbmV3SGVpZ2h0KSk7XG5cblx0XHQvLyB1cGRhdGUvZml4IHRoZSBoZWlnaHQgb2YgdGhlIHpvbmUgd2hpY2ggd2FzIHNldCB0byBuZXdIZWlnaHQgaW4gc3VwZXIuX2RvTGF5b3V0XG5cdFx0dGhpcy5fZWxlbWVudHMucm9vdC5zdHlsZS5oZWlnaHQgPSBgJHtkaW1lbnNpb24uaGVpZ2h0IC0gdGhpcy5fZ2V0RXh0cmFIZWlnaHQoKX1weGA7XG5cdH1cblxuXHRvdmVycmlkZSByZXNldCgpIHtcblx0XHR0aGlzLl9hY2Nlc3NpYmxlVmlld2VyLmNsZWFyKCk7XG5cdFx0c3VwZXIucmVzZXQoKTtcblx0fVxuXG5cdC8vIC0tLSBhY2Nlc3NpYmxlIHZpZXdlclxuXG5cdHNob3dBY2Nlc3NpYmxlSHVuayhzZXNzaW9uOiBTZXNzaW9uLCBodW5rRGF0YTogSHVua0luZm9ybWF0aW9uKTogdm9pZCB7XG5cblx0XHR0aGlzLl9lbGVtZW50cy5hY2Nlc3NpYmxlVmlld2VyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3ZXIuY2xlYXIoKTtcblxuXHRcdHRoaXMuX2FjY2Vzc2libGVWaWV3ZXIudmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShIdW5rQWNjZXNzaWJsZURpZmZWaWV3ZXIsXG5cdFx0XHR0aGlzLl9lbGVtZW50cy5hY2Nlc3NpYmxlVmlld2VyLFxuXHRcdFx0c2Vzc2lvbixcblx0XHRcdGh1bmtEYXRhLFxuXHRcdFx0bmV3IEFjY2Vzc2libGVIdW5rKHRoaXMuX3BhcmVudEVkaXRvciwgc2Vzc2lvbiwgaHVua0RhdGEpXG5cdFx0KTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSGVpZ2h0LmZpcmUoKTtcblx0fVxufVxuXG5jbGFzcyBIdW5rQWNjZXNzaWJsZURpZmZWaWV3ZXIgZXh0ZW5kcyBBY2Nlc3NpYmxlRGlmZlZpZXdlciB7XG5cblx0cmVhZG9ubHkgaGVpZ2h0OiBudW1iZXI7XG5cblx0c2V0IHdpZHRoKHZhbHVlOiBudW1iZXIpIHtcblx0XHR0aGlzLl93aWR0aDIuc2V0KHZhbHVlLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2lkdGgyOiBJU2V0dGFibGVPYnNlcnZhYmxlPG51bWJlcj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGFyZW50Tm9kZTogSFRNTEVsZW1lbnQsXG5cdFx0c2Vzc2lvbjogU2Vzc2lvbixcblx0XHRodW5rOiBIdW5rSW5mb3JtYXRpb24sXG5cdFx0bW9kZWxzOiBJQWNjZXNzaWJsZURpZmZWaWV3ZXJNb2RlbCxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdGNvbnN0IHdpZHRoID0gb2JzZXJ2YWJsZVZhbHVlKCd3aWR0aCcsIDApO1xuXHRcdGNvbnN0IGRpZmYgPSBvYnNlcnZhYmxlVmFsdWUoJ2RpZmYnLCBIdW5rQWNjZXNzaWJsZURpZmZWaWV3ZXIuX2FzTWFwcGluZyhodW5rKSk7XG5cdFx0Y29uc3QgZGlmZnMgPSBkZXJpdmVkKHIgPT4gW2RpZmYucmVhZChyKV0pO1xuXHRcdGNvbnN0IGxpbmVzID0gTWF0aC5taW4oMTAsIDggKyBkaWZmLmdldCgpLmNoYW5nZWRMaW5lQ291bnQpO1xuXHRcdGNvbnN0IGhlaWdodCA9IG1vZGVscy5nZXRNb2RpZmllZE9wdGlvbnMoKS5nZXQoRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpICogbGluZXM7XG5cblx0XHRzdXBlcihwYXJlbnROb2RlLCBjb25zdE9ic2VydmFibGUodHJ1ZSksICgpID0+IHsgfSwgY29uc3RPYnNlcnZhYmxlKGZhbHNlKSwgd2lkdGgsIGNvbnN0T2JzZXJ2YWJsZShoZWlnaHQpLCBkaWZmcywgbW9kZWxzLCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLmhlaWdodCA9IGhlaWdodDtcblx0XHR0aGlzLl93aWR0aDIgPSB3aWR0aDtcblxuXHRcdHRoaXMuX3N0b3JlLmFkZChzZXNzaW9uLnRleHRNb2RlbE4ub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdGRpZmYuc2V0KEh1bmtBY2Nlc3NpYmxlRGlmZlZpZXdlci5fYXNNYXBwaW5nKGh1bmspLCB1bmRlZmluZWQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9hc01hcHBpbmcoaHVuazogSHVua0luZm9ybWF0aW9uKTogRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nIHtcblx0XHRjb25zdCByYW5nZXMwID0gaHVuay5nZXRSYW5nZXMwKCk7XG5cdFx0Y29uc3QgcmFuZ2VzTiA9IGh1bmsuZ2V0UmFuZ2VzTigpO1xuXHRcdGNvbnN0IG9yaWdpbmFsTGluZVJhbmdlID0gTGluZVJhbmdlLmZyb21SYW5nZUluY2x1c2l2ZShyYW5nZXMwWzBdKTtcblx0XHRjb25zdCBtb2RpZmllZExpbmVSYW5nZSA9IExpbmVSYW5nZS5mcm9tUmFuZ2VJbmNsdXNpdmUocmFuZ2VzTlswXSk7XG5cdFx0Y29uc3QgaW5uZXJDaGFuZ2VzOiBSYW5nZU1hcHBpbmdbXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAxOyBpIDwgcmFuZ2VzMC5sZW5ndGg7IGkrKykge1xuXHRcdFx0aW5uZXJDaGFuZ2VzLnB1c2gobmV3IFJhbmdlTWFwcGluZyhyYW5nZXMwW2ldLCByYW5nZXNOW2ldKSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgRGV0YWlsZWRMaW5lUmFuZ2VNYXBwaW5nKG9yaWdpbmFsTGluZVJhbmdlLCBtb2RpZmllZExpbmVSYW5nZSwgaW5uZXJDaGFuZ2VzKTtcblx0fVxuXG59XG5cbmNsYXNzIEFjY2Vzc2libGVIdW5rIGltcGxlbWVudHMgSUFjY2Vzc2libGVEaWZmVmlld2VyTW9kZWwge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbjogU2Vzc2lvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9odW5rOiBIdW5rSW5mb3JtYXRpb25cblx0KSB7IH1cblxuXHRnZXRPcmlnaW5hbE1vZGVsKCk6IElUZXh0TW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9uLnRleHRNb2RlbDA7XG5cdH1cblx0Z2V0TW9kaWZpZWRNb2RlbCgpOiBJVGV4dE1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5fc2Vzc2lvbi50ZXh0TW9kZWxOO1xuXHR9XG5cdGdldE9yaWdpbmFsT3B0aW9ucygpOiBJQ29tcHV0ZWRFZGl0b3JPcHRpb25zIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yLmdldE9wdGlvbnMoKTtcblx0fVxuXHRnZXRNb2RpZmllZE9wdGlvbnMoKTogSUNvbXB1dGVkRWRpdG9yT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHRoaXMuX2VkaXRvci5nZXRPcHRpb25zKCk7XG5cdH1cblx0b3JpZ2luYWxSZXZlYWwocmFuZ2U6IFJhbmdlKTogdm9pZCB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdG1vZGlmaWVkUmV2ZWFsKHJhbmdlPzogUmFuZ2UgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3IucmV2ZWFsUmFuZ2VJbkNlbnRlcklmT3V0c2lkZVZpZXdwb3J0KHJhbmdlIHx8IHRoaXMuX2h1bmsuZ2V0UmFuZ2VzTigpWzBdLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cdH1cblx0bW9kaWZpZWRTZXRTZWxlY3Rpb24ocmFuZ2U6IFJhbmdlKTogdm9pZCB7XG5cdFx0Ly8gdGhpcy5fZWRpdG9yLnJldmVhbFJhbmdlSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChyYW5nZSwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHRcdC8vIHRoaXMuX2VkaXRvci5zZXRTZWxlY3Rpb24ocmFuZ2UpO1xuXHR9XG5cdG1vZGlmaWVkRm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5fZWRpdG9yLmZvY3VzKCk7XG5cdH1cblx0Z2V0TW9kaWZpZWRQb3NpdGlvbigpOiBQb3NpdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2h1bmsuZ2V0UmFuZ2VzTigpWzBdLmdldFN0YXJ0UG9zaXRpb24oKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQWMsa0JBQWtCLGdCQUFnQixXQUFXLEdBQUcsT0FBTyxrQkFBa0I7QUFFaEcsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxpQkFBaUIsbUJBQW1CLG9CQUFvQjtBQUNqRSxTQUFTLGlCQUFpQixTQUEyQyx1QkFBdUI7QUFFNUYsU0FBUyw0QkFBd0Q7QUFDakUsU0FBUyxvQkFBNEM7QUFDckQsU0FBUyxpQkFBaUI7QUFHMUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUywwQkFBMEIsb0JBQW9CO0FBQ3ZELFNBQStCLGtCQUFrQjtBQUVqRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFxQyw4QkFBOEI7QUFDbkUsU0FBUyw0QkFBNkQ7QUFDdEUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxRQUFRLHNCQUFzQjtBQUN2QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFlLG1CQUFtQixrQkFBa0IsdUJBQXVCO0FBQ3BGLFNBQVMs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
