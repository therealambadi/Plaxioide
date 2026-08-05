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
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { InputBox } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Action } from "../../../../base/common/actions.js";
import { Delayer } from "../../../../base/common/async.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { CONTEXT_FIND_WIDGET_NOT_VISIBLE } from "../../../../editor/contrib/find/browser/findModel.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ContextScopedReplaceInput } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { appendKeyBindingLabel, isSearchViewFocused, getSearchView } from "./searchActionsBase.js";
import * as Constants from "../common/constants.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { searchReplaceAllIcon, searchHideReplaceIcon, searchShowContextIcon, searchShowReplaceIcon } from "./searchIcons.js";
import { ToggleSearchEditorContextLinesCommandId } from "../../searchEditor/browser/constants.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { defaultInputBoxStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { NotebookFindFilters } from "../../notebook/browser/contrib/find/findFilters.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { NotebookEditorInput } from "../../notebook/common/notebookEditorInput.js";
import { GroupModelChangeKind } from "../../../common/editor.js";
import { SearchFindInput } from "./searchFindInput.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { MutableDisposable } from "../../../../base/common/lifecycle.js";
import { NotebookFindScopeType } from "../../notebook/common/notebookCommon.js";
const SingleLineInputHeight = 26;
const _ReplaceAllAction = class _ReplaceAllAction extends Action {
  constructor(_searchWidget) {
    super(_ReplaceAllAction.ID, "", ThemeIcon.asClassName(searchReplaceAllIcon), false);
    this._searchWidget = _searchWidget;
  }
  set searchWidget(searchWidget) {
    this._searchWidget = searchWidget;
  }
  run() {
    if (this._searchWidget) {
      return this._searchWidget.triggerReplaceAll();
    }
    return Promise.resolve(null);
  }
};
_ReplaceAllAction.ID = "search.action.replaceAll";
let ReplaceAllAction = _ReplaceAllAction;
const ctrlKeyMod = isMacintosh ? KeyMod.WinCtrl : KeyMod.CtrlCmd;
function stopPropagationForMultiLineUpwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionStart > 0) {
    event.stopPropagation();
    return;
  }
}
function stopPropagationForMultiLineDownwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && (isMultiline || textarea.clientHeight > SingleLineInputHeight) && textarea.selectionEnd < textarea.value.length) {
    event.stopPropagation();
    return;
  }
}
let SearchWidget = class extends Widget {
  constructor(container, options, contextViewService, contextKeyService, keybindingService, clipboardServce, configurationService, accessibilityService, contextMenuService, instantiationService, editorService) {
    super();
    this.contextViewService = contextViewService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this.clipboardServce = clipboardServce;
    this.configurationService = configurationService;
    this.accessibilityService = accessibilityService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.editorService = editorService;
    this.ignoreGlobalFindBufferOnNextFocus = false;
    this.previousGlobalFindBufferValue = null;
    this._onSearchSubmit = this._register(new Emitter());
    this.onSearchSubmit = this._onSearchSubmit.event;
    this._onSearchCancel = this._register(new Emitter());
    this.onSearchCancel = this._onSearchCancel.event;
    this._onReplaceToggled = this._register(new Emitter());
    this.onReplaceToggled = this._onReplaceToggled.event;
    this._onReplaceStateChange = this._register(new Emitter());
    this.onReplaceStateChange = this._onReplaceStateChange.event;
    this._onPreserveCaseChange = this._register(new Emitter());
    this.onPreserveCaseChange = this._onPreserveCaseChange.event;
    this._onReplaceValueChanged = this._register(new Emitter());
    this.onReplaceValueChanged = this._onReplaceValueChanged.event;
    this._onReplaceAll = this._register(new Emitter());
    this.onReplaceAll = this._onReplaceAll.event;
    this._onBlur = this._register(new Emitter());
    this.onBlur = this._onBlur.event;
    this._onDidHeightChange = this._register(new Emitter());
    this.onDidHeightChange = this._onDidHeightChange.event;
    this._onDidToggleContext = new Emitter();
    this.onDidToggleContext = this._onDidToggleContext.event;
    this.replaceActive = Constants.SearchContext.ReplaceActiveKey.bindTo(this.contextKeyService);
    this.searchInputBoxFocused = Constants.SearchContext.SearchInputBoxFocusedKey.bindTo(this.contextKeyService);
    this.replaceInputBoxFocused = Constants.SearchContext.ReplaceInputBoxFocusedKey.bindTo(this.contextKeyService);
    const notebookOptions = options.notebookOptions ?? {
      isInNotebookMarkdownInput: true,
      isInNotebookMarkdownPreview: true,
      isInNotebookCellInput: true,
      isInNotebookCellOutput: true
    };
    this._notebookFilters = this._register(
      new NotebookFindFilters(
        notebookOptions.isInNotebookMarkdownInput,
        notebookOptions.isInNotebookMarkdownPreview,
        notebookOptions.isInNotebookCellInput,
        notebookOptions.isInNotebookCellOutput,
        { findScopeType: NotebookFindScopeType.None }
      )
    );
    this._register(
      this._notebookFilters.onDidChange(() => {
        if (this.searchInput) {
          this.searchInput.updateFilterStyles();
        }
      })
    );
    this._register(this.editorService.onDidEditorsChange((e) => {
      if (this.searchInput && e.event.editor instanceof NotebookEditorInput && (e.event.kind === GroupModelChangeKind.EDITOR_OPEN || e.event.kind === GroupModelChangeKind.EDITOR_CLOSE)) {
        this.searchInput.filterVisible = this._hasNotebookOpen();
      }
    }));
    this._replaceHistoryDelayer = new Delayer(500);
    this._toggleReplaceButtonListener = this._register(new MutableDisposable());
    this.render(container, options);
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.accessibilitySupport")) {
        this.updateAccessibilitySupport();
      }
    }));
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => this.updateAccessibilitySupport()));
    this.updateAccessibilitySupport();
  }
  _hasNotebookOpen() {
    const editors = this.editorService.editors;
    return editors.some((editor) => editor instanceof NotebookEditorInput);
  }
  getNotebookFilters() {
    return this._notebookFilters;
  }
  focus(select = true, focusReplace = false, suppressGlobalSearchBuffer = false) {
    this.ignoreGlobalFindBufferOnNextFocus = suppressGlobalSearchBuffer;
    if (focusReplace && this.isReplaceShown()) {
      if (this.replaceInput) {
        this.replaceInput.focus();
        if (select) {
          this.replaceInput.select();
        }
      }
    } else {
      if (this.searchInput) {
        this.searchInput.focus();
        if (select) {
          this.searchInput.select();
        }
      }
    }
  }
  setWidth(width) {
    this.searchInput?.inputBox.layout();
    if (this.replaceInput) {
      this.replaceInput.width = width - 28;
      this.replaceInput.inputBox.layout();
    }
  }
  clear() {
    this.searchInput?.clear();
    this.replaceInput?.setValue("");
    this.setReplaceAllActionState(false);
  }
  isReplaceShown() {
    return this.replaceContainer ? !this.replaceContainer.classList.contains("disabled") : false;
  }
  isReplaceActive() {
    return !!this.replaceActive.get();
  }
  getReplaceValue() {
    return this.replaceInput?.getValue() ?? "";
  }
  toggleReplace(show) {
    if (show === void 0 || show !== this.isReplaceShown()) {
      this.onToggleReplaceButton();
    }
  }
  getSearchHistory() {
    return this.searchInput?.inputBox.getHistory() ?? [];
  }
  getReplaceHistory() {
    return this.replaceInput?.inputBox.getHistory() ?? [];
  }
  prependSearchHistory(history) {
    this.searchInput?.inputBox.prependHistory(history);
  }
  prependReplaceHistory(history) {
    this.replaceInput?.inputBox.prependHistory(history);
  }
  clearHistory() {
    this.searchInput?.inputBox.clearHistory();
    this.replaceInput?.inputBox.clearHistory();
  }
  showNextSearchTerm() {
    this.searchInput?.inputBox.showNextValue();
  }
  showPreviousSearchTerm() {
    this.searchInput?.inputBox.showPreviousValue();
  }
  showNextReplaceTerm() {
    this.replaceInput?.inputBox.showNextValue();
  }
  showPreviousReplaceTerm() {
    this.replaceInput?.inputBox.showPreviousValue();
  }
  searchInputHasFocus() {
    return !!this.searchInputBoxFocused.get();
  }
  replaceInputHasFocus() {
    return !!this.replaceInput?.inputBox.hasFocus();
  }
  focusReplaceAllAction() {
    this.replaceActionBar?.focus(true);
  }
  focusRegexAction() {
    this.searchInput?.focusOnRegex();
  }
  set replaceButtonVisibility(val) {
    if (this.toggleReplaceButton) {
      this.toggleReplaceButton.element.style.display = val ? "" : "none";
    }
  }
  render(container, options) {
    this.domNode = dom.append(container, dom.$(".search-widget"));
    this.domNode.style.position = "relative";
    if (!options._hideReplaceToggle) {
      this.renderToggleReplaceButton(this.domNode);
    }
    this.renderSearchInput(this.domNode, options);
    this.renderReplaceInput(this.domNode, options);
  }
  updateAccessibilitySupport() {
    this.searchInput?.setFocusInputOnOptionClick(!this.accessibilityService.isScreenReaderOptimized());
  }
  renderToggleReplaceButton(parent) {
    const opts = {
      buttonBackground: void 0,
      buttonBorder: void 0,
      buttonForeground: void 0,
      buttonHoverBackground: void 0,
      buttonSecondaryBackground: void 0,
      buttonSecondaryForeground: void 0,
      buttonSecondaryHoverBackground: void 0,
      buttonSeparator: void 0,
      title: nls.localize("search.replace.toggle.button.title", "Toggle Replace"),
      hoverDelegate: getDefaultHoverDelegate("element")
    };
    this.toggleReplaceButton = this._register(new Button(parent, opts));
    this.toggleReplaceButton.element.setAttribute("aria-expanded", "false");
    this.toggleReplaceButton.element.classList.add("toggle-replace-button");
    this.toggleReplaceButton.icon = searchHideReplaceIcon;
    this._toggleReplaceButtonListener.value = this.toggleReplaceButton.onDidClick(() => this.onToggleReplaceButton());
  }
  renderSearchInput(parent, options) {
    const history = options.searchHistory || [];
    const inputOptions = {
      label: nls.localize("label.Search", "Search: Type Search Term and press Enter to search"),
      validation: (value) => this.validateSearchInput(value),
      placeholder: nls.localize("search.placeHolder", "Search"),
      appendCaseSensitiveLabel: appendKeyBindingLabel("", this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.ToggleCaseSensitiveCommandId)),
      appendWholeWordsLabel: appendKeyBindingLabel("", this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.ToggleWholeWordCommandId)),
      appendRegexLabel: appendKeyBindingLabel("", this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.ToggleRegexCommandId)),
      history: new Set(history),
      showHistoryHint: () => showHistoryKeybindingHint(this.keybindingService),
      flexibleHeight: true,
      flexibleMaxHeight: SearchWidget.INPUT_MAX_HEIGHT,
      showCommonFindToggles: true,
      inputBoxStyles: options.inputBoxStyles,
      toggleStyles: options.toggleStyles
    };
    const searchInputContainer = dom.append(parent, dom.$(".search-container.input-box"));
    this.searchInput = this._register(
      new SearchFindInput(
        searchInputContainer,
        this.contextViewService,
        inputOptions,
        this.contextKeyService,
        this.contextMenuService,
        this.instantiationService,
        this._notebookFilters,
        this._hasNotebookOpen()
      )
    );
    this._register(this.searchInput.onKeyDown((keyboardEvent) => this.onSearchInputKeyDown(keyboardEvent)));
    this.searchInput.setValue(options.value || "");
    this.searchInput.setRegex(!!options.isRegex);
    this.searchInput.setCaseSensitive(!!options.isCaseSensitive);
    this.searchInput.setWholeWords(!!options.isWholeWords);
    this._register(this.searchInput.onCaseSensitiveKeyDown((keyboardEvent) => this.onCaseSensitiveKeyDown(keyboardEvent)));
    this._register(this.searchInput.onRegexKeyDown((keyboardEvent) => this.onRegexKeyDown(keyboardEvent)));
    this._register(this.searchInput.inputBox.onDidChange(() => this.onSearchInputChanged()));
    this._register(this.searchInput.inputBox.onDidHeightChange(() => this._onDidHeightChange.fire()));
    this._register(this.onReplaceValueChanged(() => {
      this._replaceHistoryDelayer.trigger(() => this.replaceInput?.inputBox.addToHistory());
    }));
    this.searchInputFocusTracker = this._register(dom.trackFocus(this.searchInput.inputBox.inputElement));
    this._register(this.searchInputFocusTracker.onDidFocus(async () => {
      this.searchInputBoxFocused.set(true);
      const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
      if (!this.ignoreGlobalFindBufferOnNextFocus && useGlobalFindBuffer) {
        const globalBufferText = await this.clipboardServce.readFindText();
        if (globalBufferText && this.previousGlobalFindBufferValue !== globalBufferText) {
          this.searchInput?.inputBox.addToHistory();
          this.searchInput?.setValue(globalBufferText);
          this.searchInput?.select();
        }
        this.previousGlobalFindBufferValue = globalBufferText;
      }
      this.ignoreGlobalFindBufferOnNextFocus = false;
    }));
    this._register(this.searchInputFocusTracker.onDidBlur(() => this.searchInputBoxFocused.set(false)));
    this.showContextToggle = new Toggle({
      isChecked: false,
      title: appendKeyBindingLabel(nls.localize("showContext", "Toggle Context Lines"), this.keybindingService.lookupKeybinding(ToggleSearchEditorContextLinesCommandId)),
      icon: searchShowContextIcon,
      hoverDelegate: getDefaultHoverDelegate("element"),
      ...defaultToggleStyles
    });
    this._register(this.showContextToggle.onChange(() => this.onContextLinesChanged()));
    if (options.showContextToggle) {
      this.contextLinesInput = new InputBox(searchInputContainer, this.contextViewService, { type: "number", inputBoxStyles: defaultInputBoxStyles });
      this.contextLinesInput.element.classList.add("context-lines-input");
      this.contextLinesInput.value = "" + (this.configurationService.getValue("search").searchEditor.defaultNumberOfContextLines ?? 1);
      this._register(this.contextLinesInput.onDidChange((value) => {
        if (value !== "0") {
          this.showContextToggle.checked = true;
        }
        this.onContextLinesChanged();
      }));
      dom.append(searchInputContainer, this.showContextToggle.domNode);
    }
  }
  onContextLinesChanged() {
    this._onDidToggleContext.fire();
    if (this.contextLinesInput.value.includes("-")) {
      this.contextLinesInput.value = "0";
    }
    this._onDidToggleContext.fire();
  }
  setContextLines(lines) {
    if (!this.contextLinesInput) {
      return;
    }
    if (lines === 0) {
      this.showContextToggle.checked = false;
    } else {
      this.showContextToggle.checked = true;
      this.contextLinesInput.value = "" + lines;
    }
  }
  renderReplaceInput(parent, options) {
    this.replaceContainer = dom.append(parent, dom.$(".replace-container.disabled"));
    const replaceBox = dom.append(this.replaceContainer, dom.$(".replace-input"));
    this.replaceInput = this._register(new ContextScopedReplaceInput(replaceBox, this.contextViewService, {
      label: nls.localize("label.Replace", "Replace: Type replace term and press Enter to preview"),
      placeholder: nls.localize("search.replace.placeHolder", "Replace"),
      appendPreserveCaseLabel: appendKeyBindingLabel("", this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.TogglePreserveCaseId)),
      history: new Set(options.replaceHistory),
      showHistoryHint: () => showHistoryKeybindingHint(this.keybindingService),
      flexibleHeight: true,
      flexibleMaxHeight: SearchWidget.INPUT_MAX_HEIGHT,
      inputBoxStyles: options.inputBoxStyles,
      toggleStyles: options.toggleStyles
    }, this.contextKeyService, true));
    this._register(this.replaceInput.onDidOptionChange((viaKeyboard) => {
      if (!viaKeyboard) {
        if (this.replaceInput) {
          this._onPreserveCaseChange.fire(this.replaceInput.getPreserveCase());
        }
      }
    }));
    this._register(this.replaceInput.onKeyDown((keyboardEvent) => this.onReplaceInputKeyDown(keyboardEvent)));
    this.replaceInput.setValue(options.replaceValue || "");
    this._register(this.replaceInput.inputBox.onDidChange(() => this._onReplaceValueChanged.fire()));
    this._register(this.replaceInput.inputBox.onDidHeightChange(() => this._onDidHeightChange.fire()));
    this.replaceAllAction = new ReplaceAllAction(this);
    this.replaceAllAction.label = SearchWidget.REPLACE_ALL_DISABLED_LABEL;
    this.replaceActionBar = this._register(new ActionBar(this.replaceContainer));
    this.replaceActionBar.push([this.replaceAllAction], { icon: true, label: false });
    this.onkeydown(this.replaceActionBar.domNode, (keyboardEvent) => this.onReplaceActionbarKeyDown(keyboardEvent));
    this.replaceInputFocusTracker = this._register(dom.trackFocus(this.replaceInput.inputBox.inputElement));
    this._register(this.replaceInputFocusTracker.onDidFocus(() => this.replaceInputBoxFocused.set(true)));
    this._register(this.replaceInputFocusTracker.onDidBlur(() => this.replaceInputBoxFocused.set(false)));
    this._register(this.replaceInput.onPreserveCaseKeyDown((keyboardEvent) => this.onPreserveCaseKeyDown(keyboardEvent)));
  }
  triggerReplaceAll() {
    this._onReplaceAll.fire();
    return Promise.resolve(null);
  }
  onToggleReplaceButton() {
    this.replaceContainer?.classList.toggle("disabled");
    if (this.isReplaceShown()) {
      this.toggleReplaceButton?.element.classList.remove(...ThemeIcon.asClassNameArray(searchHideReplaceIcon));
      this.toggleReplaceButton?.element.classList.add(...ThemeIcon.asClassNameArray(searchShowReplaceIcon));
    } else {
      this.toggleReplaceButton?.element.classList.remove(...ThemeIcon.asClassNameArray(searchShowReplaceIcon));
      this.toggleReplaceButton?.element.classList.add(...ThemeIcon.asClassNameArray(searchHideReplaceIcon));
    }
    this.toggleReplaceButton?.element.setAttribute("aria-expanded", this.isReplaceShown() ? "true" : "false");
    this.updateReplaceActiveState();
    this._onReplaceToggled.fire();
  }
  setValue(value) {
    this.searchInput?.setValue(value);
  }
  setReplaceAllActionState(enabled) {
    if (this.replaceAllAction && this.replaceAllAction.enabled !== enabled) {
      this.replaceAllAction.enabled = enabled;
      this.replaceAllAction.label = enabled ? SearchWidget.REPLACE_ALL_ENABLED_LABEL(this.keybindingService) : SearchWidget.REPLACE_ALL_DISABLED_LABEL;
      this.updateReplaceActiveState();
    }
  }
  updateReplaceActiveState() {
    const currentState = this.isReplaceActive();
    const newState = this.isReplaceShown() && !!this.replaceAllAction?.enabled;
    if (currentState !== newState) {
      this.replaceActive.set(newState);
      this._onReplaceStateChange.fire(newState);
      this.replaceInput?.inputBox.layout();
    }
  }
  validateSearchInput(value) {
    if (value.length === 0) {
      return null;
    }
    if (!this.searchInput?.getRegex()) {
      return null;
    }
    try {
      new RegExp(value, "u");
    } catch (e) {
      return { content: e.message };
    }
    return null;
  }
  onSearchInputChanged() {
    this.searchInput?.clearMessage();
    this.setReplaceAllActionState(false);
    if (this.searchConfiguration.searchOnType) {
      if (this.searchInput?.getRegex()) {
        try {
          const regex = new RegExp(this.searchInput.getValue(), "ug");
          const matchienessHeuristic = `
								~!@#$%^&*()_+
								\`1234567890-=
								qwertyuiop[]\\
								QWERTYUIOP{}|
								asdfghjkl;'
								ASDFGHJKL:"
								zxcvbnm,./
								ZXCVBNM<>? `.match(regex)?.length ?? 0;
          const delayMultiplier = matchienessHeuristic < 50 ? 1 : matchienessHeuristic < 100 ? 5 : (
            // expressions like `.` or `\w`
            10
          );
          this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier);
        } catch {
        }
      } else {
        this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod);
      }
    }
  }
  onSearchInputKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(ctrlKeyMod | KeyCode.Enter)) {
      this.searchInput?.inputBox.insertAtCursor("\n");
      keyboardEvent.preventDefault();
    }
    if (keyboardEvent.equals(KeyCode.Enter)) {
      this.searchInput?.onSearchSubmit();
      this.submitSearch();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Escape)) {
      this._onSearchCancel.fire({ focus: true });
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focus();
      } else {
        this.searchInput?.focusOnCaseSensitive();
      }
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.UpArrow)) {
      stopPropagationForMultiLineUpwards(keyboardEvent, this.searchInput?.getValue() ?? "", this.searchInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.DownArrow)) {
      stopPropagationForMultiLineDownwards(keyboardEvent, this.searchInput?.getValue() ?? "", this.searchInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.PageUp)) {
      const inputElement = this.searchInput?.inputBox.inputElement;
      if (inputElement) {
        inputElement.setSelectionRange(0, 0);
        inputElement.focus();
        keyboardEvent.preventDefault();
      }
    } else if (keyboardEvent.equals(KeyCode.PageDown)) {
      const inputElement = this.searchInput?.inputBox.inputElement;
      if (inputElement) {
        const endOfText = inputElement.value.length;
        inputElement.setSelectionRange(endOfText, endOfText);
        inputElement.focus();
        keyboardEvent.preventDefault();
      }
    }
  }
  onCaseSensitiveKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focus();
        keyboardEvent.preventDefault();
      }
    }
  }
  onRegexKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceShown()) {
        this.replaceInput?.focusOnPreserve();
        keyboardEvent.preventDefault();
      }
    }
  }
  onPreserveCaseKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyCode.Tab)) {
      if (this.isReplaceActive()) {
        this.focusReplaceAllAction();
      } else {
        this._onBlur.fire();
      }
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.focusRegexAction();
      keyboardEvent.preventDefault();
    }
  }
  onReplaceInputKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(ctrlKeyMod | KeyCode.Enter)) {
      this.replaceInput?.inputBox.insertAtCursor("\n");
      keyboardEvent.preventDefault();
    }
    if (keyboardEvent.equals(KeyCode.Enter)) {
      this.submitSearch();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.Tab)) {
      this.searchInput?.focusOnCaseSensitive();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.searchInput?.focus();
      keyboardEvent.preventDefault();
    } else if (keyboardEvent.equals(KeyCode.UpArrow)) {
      stopPropagationForMultiLineUpwards(keyboardEvent, this.replaceInput?.getValue() ?? "", this.replaceInput?.domNode.querySelector("textarea") ?? null);
    } else if (keyboardEvent.equals(KeyCode.DownArrow)) {
      stopPropagationForMultiLineDownwards(keyboardEvent, this.replaceInput?.getValue() ?? "", this.replaceInput?.domNode.querySelector("textarea") ?? null);
    }
  }
  onReplaceActionbarKeyDown(keyboardEvent) {
    if (keyboardEvent.equals(KeyMod.Shift | KeyCode.Tab)) {
      this.focusRegexAction();
      keyboardEvent.preventDefault();
    }
  }
  async submitSearch(triggeredOnType = false, delay = 0) {
    this.searchInput?.validate();
    if (!this.searchInput?.inputBox.isInputValid()) {
      return;
    }
    const value = this.searchInput.getValue();
    const useGlobalFindBuffer = this.searchConfiguration.globalFindClipboard;
    if (value && useGlobalFindBuffer) {
      await this.clipboardServce.writeFindText(value);
    }
    this._onSearchSubmit.fire({ triggeredOnType, delay });
  }
  getContextLines() {
    return this.showContextToggle.checked ? +this.contextLinesInput.value : 0;
  }
  modifyContextLines(increase) {
    const current = +this.contextLinesInput.value;
    const modified = current + (increase ? 1 : -1);
    this.showContextToggle.checked = modified !== 0;
    this.contextLinesInput.value = "" + modified;
  }
  toggleContextLines() {
    this.showContextToggle.checked = !this.showContextToggle.checked;
    this.onContextLinesChanged();
  }
  dispose() {
    this.setReplaceAllActionState(false);
    super.dispose();
  }
  get searchConfiguration() {
    return this.configurationService.getValue("search");
  }
};
SearchWidget.INPUT_MAX_HEIGHT = 134;
SearchWidget.REPLACE_ALL_DISABLED_LABEL = nls.localize("search.action.replaceAll.disabled.label", "Replace All (Submit Search to Enable)");
SearchWidget.REPLACE_ALL_ENABLED_LABEL = (keyBindingService2) => {
  const kb = keyBindingService2.lookupKeybinding(ReplaceAllAction.ID);
  return appendKeyBindingLabel(nls.localize("search.action.replaceAll.enabled.label", "Replace All"), kb);
};
SearchWidget = __decorateClass([
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IClipboardService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IAccessibilityService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IEditorService)
], SearchWidget);
function registerContributions() {
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: ReplaceAllAction.ID,
    weight: KeybindingWeight.WorkbenchContrib,
    when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceActiveKey, CONTEXT_FIND_WIDGET_NOT_VISIBLE),
    primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.Enter,
    handler: (accessor) => {
      const viewsService = accessor.get(IViewsService);
      if (isSearchViewFocused(viewsService)) {
        const searchView = getSearchView(viewsService);
        if (searchView) {
          new ReplaceAllAction(searchView.searchAndReplaceWidget).run();
        }
      }
    }
  });
}
export {
  SearchWidget,
  registerContributions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQnV0dG9uLCBJQnV0dG9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElGaW5kSW5wdXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ZpbmRpbnB1dC9maW5kSW5wdXQuanMnO1xuaW1wb3J0IHsgUmVwbGFjZUlucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ZpbmRpbnB1dC9yZXBsYWNlSW5wdXQuanMnO1xuaW1wb3J0IHsgSUlucHV0Qm94U3R5bGVzLCBJTWVzc2FnZSwgSW5wdXRCb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3dpZGdldC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfRklORF9XSURHRVRfTk9UX1ZJU0lCTEUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IENvbnRleHRTY29wZWRSZXBsYWNlSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9oaXN0b3J5L2Jyb3dzZXIvY29udGV4dFNjb3BlZEhpc3RvcnlXaWRnZXQuanMnO1xuaW1wb3J0IHsgYXBwZW5kS2V5QmluZGluZ0xhYmVsLCBpc1NlYXJjaFZpZXdGb2N1c2VkLCBnZXRTZWFyY2hWaWV3IH0gZnJvbSAnLi9zZWFyY2hBY3Rpb25zQmFzZS5qcyc7XG5pbXBvcnQgKiBhcyBDb25zdGFudHMgZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVRvZ2dsZVN0eWxlcywgVG9nZ2xlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RvZ2dsZS90b2dnbGUuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgc2VhcmNoUmVwbGFjZUFsbEljb24sIHNlYXJjaEhpZGVSZXBsYWNlSWNvbiwgc2VhcmNoU2hvd0NvbnRleHRJY29uLCBzZWFyY2hTaG93UmVwbGFjZUljb24gfSBmcm9tICcuL3NlYXJjaEljb25zLmpzJztcbmltcG9ydCB7IFRvZ2dsZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCB9IGZyb20gJy4uLy4uL3NlYXJjaEVkaXRvci9icm93c2VyL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaGlzdG9yeS9icm93c2VyL2hpc3RvcnlXaWRnZXRLZXliaW5kaW5nSGludC5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0SW5wdXRCb3hTdHlsZXMsIGRlZmF1bHRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tGaW5kRmlsdGVycyB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9maW5kL2ZpbmRGaWx0ZXJzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEdyb3VwTW9kZWxDaGFuZ2VLaW5kIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBTZWFyY2hGaW5kSW5wdXQgfSBmcm9tICcuL3NlYXJjaEZpbmRJbnB1dC5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tGaW5kU2NvcGVUeXBlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcblxuLyoqIFNwZWNpZmllZCBpbiBzZWFyY2h2aWV3LmNzcyAqL1xuY29uc3QgU2luZ2xlTGluZUlucHV0SGVpZ2h0ID0gMjY7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlYXJjaFdpZGdldE9wdGlvbnMge1xuXHR2YWx1ZT86IHN0cmluZztcblx0cmVwbGFjZVZhbHVlPzogc3RyaW5nO1xuXHRpc1JlZ2V4PzogYm9vbGVhbjtcblx0aXNDYXNlU2Vuc2l0aXZlPzogYm9vbGVhbjtcblx0aXNXaG9sZVdvcmRzPzogYm9vbGVhbjtcblx0c2VhcmNoSGlzdG9yeT86IHN0cmluZ1tdO1xuXHRyZXBsYWNlSGlzdG9yeT86IHN0cmluZ1tdO1xuXHRwcmVzZXJ2ZUNhc2U/OiBib29sZWFuO1xuXHRfaGlkZVJlcGxhY2VUb2dnbGU/OiBib29sZWFuOyAvLyBUT0RPOiBTZWFyY2ggRWRpdG9yJ3MgcmVwbGFjZSBleHBlcmllbmNlXG5cdHNob3dDb250ZXh0VG9nZ2xlPzogYm9vbGVhbjtcblx0aW5wdXRCb3hTdHlsZXM6IElJbnB1dEJveFN0eWxlcztcblx0dG9nZ2xlU3R5bGVzOiBJVG9nZ2xlU3R5bGVzO1xuXHRub3RlYm9va09wdGlvbnM/OiBOb3RlYm9va1RvZ2dsZVN0YXRlO1xufVxuXG5pbnRlcmZhY2UgTm90ZWJvb2tUb2dnbGVTdGF0ZSB7XG5cdGlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQ6IGJvb2xlYW47XG5cdGlzSW5Ob3RlYm9va01hcmtkb3duUHJldmlldzogYm9vbGVhbjtcblx0aXNJbk5vdGVib29rQ2VsbElucHV0OiBib29sZWFuO1xuXHRpc0luTm90ZWJvb2tDZWxsT3V0cHV0OiBib29sZWFuO1xufVxuXG5jbGFzcyBSZXBsYWNlQWxsQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICdzZWFyY2guYWN0aW9uLnJlcGxhY2VBbGwnO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgX3NlYXJjaFdpZGdldDogU2VhcmNoV2lkZ2V0KSB7XG5cdFx0c3VwZXIoUmVwbGFjZUFsbEFjdGlvbi5JRCwgJycsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShzZWFyY2hSZXBsYWNlQWxsSWNvbiksIGZhbHNlKTtcblx0fVxuXG5cdHNldCBzZWFyY2hXaWRnZXQoc2VhcmNoV2lkZ2V0OiBTZWFyY2hXaWRnZXQpIHtcblx0XHR0aGlzLl9zZWFyY2hXaWRnZXQgPSBzZWFyY2hXaWRnZXQ7XG5cdH1cblxuXHRvdmVycmlkZSBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAodGhpcy5fc2VhcmNoV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2VhcmNoV2lkZ2V0LnRyaWdnZXJSZXBsYWNlQWxsKCk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdH1cbn1cblxuY29uc3QgY3RybEtleU1vZCA9IChpc01hY2ludG9zaCA/IEtleU1vZC5XaW5DdHJsIDogS2V5TW9kLkN0cmxDbWQpO1xuXG5mdW5jdGlvbiBzdG9wUHJvcGFnYXRpb25Gb3JNdWx0aUxpbmVVcHdhcmRzKGV2ZW50OiBJS2V5Ym9hcmRFdmVudCwgdmFsdWU6IHN0cmluZywgdGV4dGFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsKSB7XG5cdGNvbnN0IGlzTXVsdGlsaW5lID0gISF2YWx1ZS5tYXRjaCgvXFxuLyk7XG5cdGlmICh0ZXh0YXJlYSAmJiAoaXNNdWx0aWxpbmUgfHwgdGV4dGFyZWEuY2xpZW50SGVpZ2h0ID4gU2luZ2xlTGluZUlucHV0SGVpZ2h0KSAmJiB0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA+IDApIHtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRyZXR1cm47XG5cdH1cbn1cblxuZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uRm9yTXVsdGlMaW5lRG93bndhcmRzKGV2ZW50OiBJS2V5Ym9hcmRFdmVudCwgdmFsdWU6IHN0cmluZywgdGV4dGFyZWE6IEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsKSB7XG5cdGNvbnN0IGlzTXVsdGlsaW5lID0gISF2YWx1ZS5tYXRjaCgvXFxuLyk7XG5cdGlmICh0ZXh0YXJlYSAmJiAoaXNNdWx0aWxpbmUgfHwgdGV4dGFyZWEuY2xpZW50SGVpZ2h0ID4gU2luZ2xlTGluZUlucHV0SGVpZ2h0KSAmJiB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPCB0ZXh0YXJlYS52YWx1ZS5sZW5ndGgpIHtcblx0XHRldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRyZXR1cm47XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgU2VhcmNoV2lkZ2V0IGV4dGVuZHMgV2lkZ2V0IHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSU5QVVRfTUFYX0hFSUdIVCA9IDEzNDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRVBMQUNFX0FMTF9ESVNBQkxFRF9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnc2VhcmNoLmFjdGlvbi5yZXBsYWNlQWxsLmRpc2FibGVkLmxhYmVsJywgXCJSZXBsYWNlIEFsbCAoU3VibWl0IFNlYXJjaCB0byBFbmFibGUpXCIpO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBSRVBMQUNFX0FMTF9FTkFCTEVEX0xBQkVMID0gKGtleUJpbmRpbmdTZXJ2aWNlMjogSUtleWJpbmRpbmdTZXJ2aWNlKTogc3RyaW5nID0+IHtcblx0XHRjb25zdCBrYiA9IGtleUJpbmRpbmdTZXJ2aWNlMi5sb29rdXBLZXliaW5kaW5nKFJlcGxhY2VBbGxBY3Rpb24uSUQpO1xuXHRcdHJldHVybiBhcHBlbmRLZXlCaW5kaW5nTGFiZWwobmxzLmxvY2FsaXplKCdzZWFyY2guYWN0aW9uLnJlcGxhY2VBbGwuZW5hYmxlZC5sYWJlbCcsIFwiUmVwbGFjZSBBbGxcIiksIGtiKTtcblx0fTtcblxuXHRkb21Ob2RlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRzZWFyY2hJbnB1dDogU2VhcmNoRmluZElucHV0IHwgdW5kZWZpbmVkO1xuXHRzZWFyY2hJbnB1dEZvY3VzVHJhY2tlcjogZG9tLklGb2N1c1RyYWNrZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc2VhcmNoSW5wdXRCb3hGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRwcml2YXRlIHJlcGxhY2VDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRyZXBsYWNlSW5wdXQ6IFJlcGxhY2VJbnB1dCB8IHVuZGVmaW5lZDtcblx0cmVwbGFjZUlucHV0Rm9jdXNUcmFja2VyOiBkb20uSUZvY3VzVHJhY2tlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXBsYWNlSW5wdXRCb3hGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSB0b2dnbGVSZXBsYWNlQnV0dG9uOiBCdXR0b24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVwbGFjZUFsbEFjdGlvbjogUmVwbGFjZUFsbEFjdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXBsYWNlQWN0aXZlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZXBsYWNlQWN0aW9uQmFyOiBBY3Rpb25CYXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3JlcGxhY2VIaXN0b3J5RGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBpZ25vcmVHbG9iYWxGaW5kQnVmZmVyT25OZXh0Rm9jdXMgPSBmYWxzZTtcblx0cHJpdmF0ZSBwcmV2aW91c0dsb2JhbEZpbmRCdWZmZXJWYWx1ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSBfb25TZWFyY2hTdWJtaXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHRyaWdnZXJlZE9uVHlwZTogYm9vbGVhbjsgZGVsYXk6IG51bWJlciB9PigpKTtcblx0cmVhZG9ubHkgb25TZWFyY2hTdWJtaXQ6IEV2ZW50PHsgdHJpZ2dlcmVkT25UeXBlOiBib29sZWFuOyBkZWxheTogbnVtYmVyIH0+ID0gdGhpcy5fb25TZWFyY2hTdWJtaXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25TZWFyY2hDYW5jZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGZvY3VzOiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvblNlYXJjaENhbmNlbDogRXZlbnQ8eyBmb2N1czogYm9vbGVhbiB9PiA9IHRoaXMuX29uU2VhcmNoQ2FuY2VsLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uUmVwbGFjZVRvZ2dsZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25SZXBsYWNlVG9nZ2xlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vblJlcGxhY2VUb2dnbGVkLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uUmVwbGFjZVN0YXRlQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uUmVwbGFjZVN0YXRlQ2hhbmdlOiBFdmVudDxib29sZWFuPiA9IHRoaXMuX29uUmVwbGFjZVN0YXRlQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uUHJlc2VydmVDYXNlQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uUHJlc2VydmVDYXNlQ2hhbmdlOiBFdmVudDxib29sZWFuPiA9IHRoaXMuX29uUHJlc2VydmVDYXNlQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uUmVwbGFjZVZhbHVlQ2hhbmdlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblJlcGxhY2VWYWx1ZUNoYW5nZWQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25SZXBsYWNlVmFsdWVDaGFuZ2VkLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uUmVwbGFjZUFsbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblJlcGxhY2VBbGw6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25SZXBsYWNlQWxsLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uQmx1ciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkJsdXI6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25CbHVyLmV2ZW50O1xuXG5cdHByaXZhdGUgX29uRGlkSGVpZ2h0Q2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkSGVpZ2h0Q2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkSGVpZ2h0Q2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVG9nZ2xlQ29udGV4dCA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkVG9nZ2xlQ29udGV4dDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZFRvZ2dsZUNvbnRleHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBzaG93Q29udGV4dFRvZ2dsZSE6IFRvZ2dsZTtcblx0cHVibGljIGNvbnRleHRMaW5lc0lucHV0ITogSW5wdXRCb3g7XG5cblx0cHJpdmF0ZSBfbm90ZWJvb2tGaWx0ZXJzOiBOb3RlYm9va0ZpbmRGaWx0ZXJzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90b2dnbGVSZXBsYWNlQnV0dG9uTGlzdGVuZXI6IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IElTZWFyY2hXaWRnZXRPcHRpb25zLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNsaXBib2FyZFNlcnZjZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5yZXBsYWNlQWN0aXZlID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuUmVwbGFjZUFjdGl2ZUtleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dEJveEZvY3VzZWQgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hJbnB1dEJveEZvY3VzZWRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMucmVwbGFjZUlucHV0Qm94Rm9jdXNlZCA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VJbnB1dEJveEZvY3VzZWRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2tPcHRpb25zID0gb3B0aW9ucy5ub3RlYm9va09wdGlvbnMgPz9cblx0XHR7XG5cdFx0XHRpc0luTm90ZWJvb2tNYXJrZG93bklucHV0OiB0cnVlLFxuXHRcdFx0aXNJbk5vdGVib29rTWFya2Rvd25QcmV2aWV3OiB0cnVlLFxuXHRcdFx0aXNJbk5vdGVib29rQ2VsbElucHV0OiB0cnVlLFxuXHRcdFx0aXNJbk5vdGVib29rQ2VsbE91dHB1dDogdHJ1ZVxuXHRcdH07XG5cdFx0dGhpcy5fbm90ZWJvb2tGaWx0ZXJzID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRuZXcgTm90ZWJvb2tGaW5kRmlsdGVycyhcblx0XHRcdFx0bm90ZWJvb2tPcHRpb25zLmlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQsXG5cdFx0XHRcdG5vdGVib29rT3B0aW9ucy5pc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXcsXG5cdFx0XHRcdG5vdGVib29rT3B0aW9ucy5pc0luTm90ZWJvb2tDZWxsSW5wdXQsXG5cdFx0XHRcdG5vdGVib29rT3B0aW9ucy5pc0luTm90ZWJvb2tDZWxsT3V0cHV0LFxuXHRcdFx0XHR7IGZpbmRTY29wZVR5cGU6IE5vdGVib29rRmluZFNjb3BlVHlwZS5Ob25lIH1cblx0XHRcdCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHR0aGlzLl9ub3RlYm9va0ZpbHRlcnMub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5zZWFyY2hJbnB1dCkge1xuXHRcdFx0XHRcdHRoaXMuc2VhcmNoSW5wdXQudXBkYXRlRmlsdGVyU3R5bGVzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvclNlcnZpY2Uub25EaWRFZGl0b3JzQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5zZWFyY2hJbnB1dCAmJlxuXHRcdFx0XHRlLmV2ZW50LmVkaXRvciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQgJiZcblx0XHRcdFx0KGUuZXZlbnQua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX09QRU4gfHwgZS5ldmVudC5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfQ0xPU0UpKSB7XG5cdFx0XHRcdHRoaXMuc2VhcmNoSW5wdXQuZmlsdGVyVmlzaWJsZSA9IHRoaXMuX2hhc05vdGVib29rT3BlbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlcGxhY2VIaXN0b3J5RGVsYXllciA9IG5ldyBEZWxheWVyPHZvaWQ+KDUwMCk7XG5cdFx0dGhpcy5fdG9nZ2xlUmVwbGFjZUJ1dHRvbkxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPigpKTtcblxuXHRcdHRoaXMucmVuZGVyKGNvbnRhaW5lciwgb3B0aW9ucyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQnKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUFjY2Vzc2liaWxpdHlTdXBwb3J0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5vbkRpZENoYW5nZVNjcmVlblJlYWRlck9wdGltaXplZCgoKSA9PiB0aGlzLnVwZGF0ZUFjY2Vzc2liaWxpdHlTdXBwb3J0KCkpKTtcblx0XHR0aGlzLnVwZGF0ZUFjY2Vzc2liaWxpdHlTdXBwb3J0KCk7XG5cdH1cblxuXHRwcml2YXRlIF9oYXNOb3RlYm9va09wZW4oKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZWRpdG9ycyA9IHRoaXMuZWRpdG9yU2VydmljZS5lZGl0b3JzO1xuXHRcdHJldHVybiBlZGl0b3JzLnNvbWUoZWRpdG9yID0+IGVkaXRvciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQpO1xuXHR9XG5cblx0Z2V0Tm90ZWJvb2tGaWx0ZXJzKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va0ZpbHRlcnM7XG5cdH1cblxuXHRmb2N1cyhzZWxlY3Q6IGJvb2xlYW4gPSB0cnVlLCBmb2N1c1JlcGxhY2U6IGJvb2xlYW4gPSBmYWxzZSwgc3VwcHJlc3NHbG9iYWxTZWFyY2hCdWZmZXIgPSBmYWxzZSk6IHZvaWQge1xuXHRcdHRoaXMuaWdub3JlR2xvYmFsRmluZEJ1ZmZlck9uTmV4dEZvY3VzID0gc3VwcHJlc3NHbG9iYWxTZWFyY2hCdWZmZXI7XG5cblx0XHRpZiAoZm9jdXNSZXBsYWNlICYmIHRoaXMuaXNSZXBsYWNlU2hvd24oKSkge1xuXHRcdFx0aWYgKHRoaXMucmVwbGFjZUlucHV0KSB7XG5cdFx0XHRcdHRoaXMucmVwbGFjZUlucHV0LmZvY3VzKCk7XG5cdFx0XHRcdGlmIChzZWxlY3QpIHtcblx0XHRcdFx0XHR0aGlzLnJlcGxhY2VJbnB1dC5zZWxlY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy5zZWFyY2hJbnB1dCkge1xuXHRcdFx0XHR0aGlzLnNlYXJjaElucHV0LmZvY3VzKCk7XG5cdFx0XHRcdGlmIChzZWxlY3QpIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaElucHV0LnNlbGVjdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0c2V0V2lkdGgod2lkdGg6IG51bWJlcikge1xuXHRcdHRoaXMuc2VhcmNoSW5wdXQ/LmlucHV0Qm94LmxheW91dCgpO1xuXHRcdGlmICh0aGlzLnJlcGxhY2VJbnB1dCkge1xuXHRcdFx0dGhpcy5yZXBsYWNlSW5wdXQud2lkdGggPSB3aWR0aCAtIDI4O1xuXHRcdFx0dGhpcy5yZXBsYWNlSW5wdXQuaW5wdXRCb3gubGF5b3V0KCk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXIoKSB7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dD8uY2xlYXIoKTtcblx0XHR0aGlzLnJlcGxhY2VJbnB1dD8uc2V0VmFsdWUoJycpO1xuXHRcdHRoaXMuc2V0UmVwbGFjZUFsbEFjdGlvblN0YXRlKGZhbHNlKTtcblx0fVxuXG5cdGlzUmVwbGFjZVNob3duKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJlcGxhY2VDb250YWluZXIgPyAhdGhpcy5yZXBsYWNlQ29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucygnZGlzYWJsZWQnKSA6IGZhbHNlO1xuXHR9XG5cblx0aXNSZXBsYWNlQWN0aXZlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMucmVwbGFjZUFjdGl2ZS5nZXQoKTtcblx0fVxuXG5cdGdldFJlcGxhY2VWYWx1ZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnJlcGxhY2VJbnB1dD8uZ2V0VmFsdWUoKSA/PyAnJztcblx0fVxuXG5cdHRvZ2dsZVJlcGxhY2Uoc2hvdz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoc2hvdyA9PT0gdW5kZWZpbmVkIHx8IHNob3cgIT09IHRoaXMuaXNSZXBsYWNlU2hvd24oKSkge1xuXHRcdFx0dGhpcy5vblRvZ2dsZVJlcGxhY2VCdXR0b24oKTtcblx0XHR9XG5cdH1cblxuXHRnZXRTZWFyY2hIaXN0b3J5KCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hJbnB1dD8uaW5wdXRCb3guZ2V0SGlzdG9yeSgpID8/IFtdO1xuXHR9XG5cblx0Z2V0UmVwbGFjZUhpc3RvcnkoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLnJlcGxhY2VJbnB1dD8uaW5wdXRCb3guZ2V0SGlzdG9yeSgpID8/IFtdO1xuXHR9XG5cblx0cHJlcGVuZFNlYXJjaEhpc3RvcnkoaGlzdG9yeTogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaElucHV0Py5pbnB1dEJveC5wcmVwZW5kSGlzdG9yeShoaXN0b3J5KTtcblx0fVxuXG5cdHByZXBlbmRSZXBsYWNlSGlzdG9yeShoaXN0b3J5OiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdHRoaXMucmVwbGFjZUlucHV0Py5pbnB1dEJveC5wcmVwZW5kSGlzdG9yeShoaXN0b3J5KTtcblx0fVxuXG5cdGNsZWFySGlzdG9yeSgpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaElucHV0Py5pbnB1dEJveC5jbGVhckhpc3RvcnkoKTtcblx0XHR0aGlzLnJlcGxhY2VJbnB1dD8uaW5wdXRCb3guY2xlYXJIaXN0b3J5KCk7XG5cdH1cblxuXHRzaG93TmV4dFNlYXJjaFRlcm0oKSB7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dD8uaW5wdXRCb3guc2hvd05leHRWYWx1ZSgpO1xuXHR9XG5cblx0c2hvd1ByZXZpb3VzU2VhcmNoVGVybSgpIHtcblx0XHR0aGlzLnNlYXJjaElucHV0Py5pbnB1dEJveC5zaG93UHJldmlvdXNWYWx1ZSgpO1xuXHR9XG5cblx0c2hvd05leHRSZXBsYWNlVGVybSgpIHtcblx0XHR0aGlzLnJlcGxhY2VJbnB1dD8uaW5wdXRCb3guc2hvd05leHRWYWx1ZSgpO1xuXHR9XG5cblx0c2hvd1ByZXZpb3VzUmVwbGFjZVRlcm0oKSB7XG5cdFx0dGhpcy5yZXBsYWNlSW5wdXQ/LmlucHV0Qm94LnNob3dQcmV2aW91c1ZhbHVlKCk7XG5cdH1cblxuXHRzZWFyY2hJbnB1dEhhc0ZvY3VzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuc2VhcmNoSW5wdXRCb3hGb2N1c2VkLmdldCgpO1xuXHR9XG5cblx0cmVwbGFjZUlucHV0SGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5yZXBsYWNlSW5wdXQ/LmlucHV0Qm94Lmhhc0ZvY3VzKCk7XG5cdH1cblxuXHRmb2N1c1JlcGxhY2VBbGxBY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5yZXBsYWNlQWN0aW9uQmFyPy5mb2N1cyh0cnVlKTtcblx0fVxuXG5cdGZvY3VzUmVnZXhBY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dD8uZm9jdXNPblJlZ2V4KCk7XG5cdH1cblxuXHRzZXQgcmVwbGFjZUJ1dHRvblZpc2liaWxpdHkodmFsOiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMudG9nZ2xlUmVwbGFjZUJ1dHRvbikge1xuXHRcdFx0dGhpcy50b2dnbGVSZXBsYWNlQnV0dG9uLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IHZhbCA/ICcnIDogJ25vbmUnO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG9wdGlvbnM6IElTZWFyY2hXaWRnZXRPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuc2VhcmNoLXdpZGdldCcpKTtcblx0XHR0aGlzLmRvbU5vZGUuc3R5bGUucG9zaXRpb24gPSAncmVsYXRpdmUnO1xuXG5cdFx0aWYgKCFvcHRpb25zLl9oaWRlUmVwbGFjZVRvZ2dsZSkge1xuXHRcdFx0dGhpcy5yZW5kZXJUb2dnbGVSZXBsYWNlQnV0dG9uKHRoaXMuZG9tTm9kZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJTZWFyY2hJbnB1dCh0aGlzLmRvbU5vZGUsIG9wdGlvbnMpO1xuXHRcdHRoaXMucmVuZGVyUmVwbGFjZUlucHV0KHRoaXMuZG9tTm9kZSwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUFjY2Vzc2liaWxpdHlTdXBwb3J0KCk6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoSW5wdXQ/LnNldEZvY3VzSW5wdXRPbk9wdGlvbkNsaWNrKCF0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLmlzU2NyZWVuUmVhZGVyT3B0aW1pemVkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJUb2dnbGVSZXBsYWNlQnV0dG9uKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCBvcHRzOiBJQnV0dG9uT3B0aW9ucyA9IHtcblx0XHRcdGJ1dHRvbkJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdGJ1dHRvbkJvcmRlcjogdW5kZWZpbmVkLFxuXHRcdFx0YnV0dG9uRm9yZWdyb3VuZDogdW5kZWZpbmVkLFxuXHRcdFx0YnV0dG9uSG92ZXJCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25TZWNvbmRhcnlGb3JlZ3JvdW5kOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25TZWNvbmRhcnlIb3ZlckJhY2tncm91bmQ6IHVuZGVmaW5lZCxcblx0XHRcdGJ1dHRvblNlcGFyYXRvcjogdW5kZWZpbmVkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnJlcGxhY2UudG9nZ2xlLmJ1dHRvbi50aXRsZScsIFwiVG9nZ2xlIFJlcGxhY2VcIiksXG5cdFx0XHRob3ZlckRlbGVnYXRlOiBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLFxuXHRcdH07XG5cdFx0dGhpcy50b2dnbGVSZXBsYWNlQnV0dG9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEJ1dHRvbihwYXJlbnQsIG9wdHMpKTtcblx0XHR0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24uZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcblx0XHR0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24uZWxlbWVudC5jbGFzc0xpc3QuYWRkKCd0b2dnbGUtcmVwbGFjZS1idXR0b24nKTtcblx0XHR0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24uaWNvbiA9IHNlYXJjaEhpZGVSZXBsYWNlSWNvbjtcblx0XHR0aGlzLl90b2dnbGVSZXBsYWNlQnV0dG9uTGlzdGVuZXIudmFsdWUgPSB0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLm9uVG9nZ2xlUmVwbGFjZUJ1dHRvbigpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2VhcmNoSW5wdXQocGFyZW50OiBIVE1MRWxlbWVudCwgb3B0aW9uczogSVNlYXJjaFdpZGdldE9wdGlvbnMpOiB2b2lkIHtcblx0XHRjb25zdCBoaXN0b3J5ID0gb3B0aW9ucy5zZWFyY2hIaXN0b3J5IHx8IFtdO1xuXHRcdGNvbnN0IGlucHV0T3B0aW9uczogSUZpbmRJbnB1dE9wdGlvbnMgPSB7XG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdsYWJlbC5TZWFyY2gnLCAnU2VhcmNoOiBUeXBlIFNlYXJjaCBUZXJtIGFuZCBwcmVzcyBFbnRlciB0byBzZWFyY2gnKSxcblx0XHRcdHZhbGlkYXRpb246ICh2YWx1ZTogc3RyaW5nKSA9PiB0aGlzLnZhbGlkYXRlU2VhcmNoSW5wdXQodmFsdWUpLFxuXHRcdFx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnBsYWNlSG9sZGVyJywgXCJTZWFyY2hcIiksXG5cdFx0XHRhcHBlbmRDYXNlU2Vuc2l0aXZlTGFiZWw6IGFwcGVuZEtleUJpbmRpbmdMYWJlbCgnJywgdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZUNhc2VTZW5zaXRpdmVDb21tYW5kSWQpKSxcblx0XHRcdGFwcGVuZFdob2xlV29yZHNMYWJlbDogYXBwZW5kS2V5QmluZGluZ0xhYmVsKCcnLCB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuVG9nZ2xlV2hvbGVXb3JkQ29tbWFuZElkKSksXG5cdFx0XHRhcHBlbmRSZWdleExhYmVsOiBhcHBlbmRLZXlCaW5kaW5nTGFiZWwoJycsIHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhDb25zdGFudHMuU2VhcmNoQ29tbWFuZElkcy5Ub2dnbGVSZWdleENvbW1hbmRJZCkpLFxuXHRcdFx0aGlzdG9yeTogbmV3IFNldChoaXN0b3J5KSxcblx0XHRcdHNob3dIaXN0b3J5SGludDogKCkgPT4gc2hvd0hpc3RvcnlLZXliaW5kaW5nSGludCh0aGlzLmtleWJpbmRpbmdTZXJ2aWNlKSxcblx0XHRcdGZsZXhpYmxlSGVpZ2h0OiB0cnVlLFxuXHRcdFx0ZmxleGlibGVNYXhIZWlnaHQ6IFNlYXJjaFdpZGdldC5JTlBVVF9NQVhfSEVJR0hULFxuXHRcdFx0c2hvd0NvbW1vbkZpbmRUb2dnbGVzOiB0cnVlLFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IG9wdGlvbnMuaW5wdXRCb3hTdHlsZXMsXG5cdFx0XHR0b2dnbGVTdHlsZXM6IG9wdGlvbnMudG9nZ2xlU3R5bGVzXG5cdFx0fTtcblxuXHRcdGNvbnN0IHNlYXJjaElucHV0Q29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcuc2VhcmNoLWNvbnRhaW5lci5pbnB1dC1ib3gnKSk7XG5cblx0XHR0aGlzLnNlYXJjaElucHV0ID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRuZXcgU2VhcmNoRmluZElucHV0KFxuXHRcdFx0XHRzZWFyY2hJbnB1dENvbnRhaW5lcixcblx0XHRcdFx0dGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0XHRcdGlucHV0T3B0aW9ucyxcblx0XHRcdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuX25vdGVib29rRmlsdGVycyxcblx0XHRcdFx0dGhpcy5faGFzTm90ZWJvb2tPcGVuKClcblx0XHRcdClcblx0XHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hJbnB1dC5vbktleURvd24oKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSA9PiB0aGlzLm9uU2VhcmNoSW5wdXRLZXlEb3duKGtleWJvYXJkRXZlbnQpKSk7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dC5zZXRWYWx1ZShvcHRpb25zLnZhbHVlIHx8ICcnKTtcblx0XHR0aGlzLnNlYXJjaElucHV0LnNldFJlZ2V4KCEhb3B0aW9ucy5pc1JlZ2V4KTtcblx0XHR0aGlzLnNlYXJjaElucHV0LnNldENhc2VTZW5zaXRpdmUoISFvcHRpb25zLmlzQ2FzZVNlbnNpdGl2ZSk7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dC5zZXRXaG9sZVdvcmRzKCEhb3B0aW9ucy5pc1dob2xlV29yZHMpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoSW5wdXQub25DYXNlU2Vuc2l0aXZlS2V5RG93bigoa2V5Ym9hcmRFdmVudDogSUtleWJvYXJkRXZlbnQpID0+IHRoaXMub25DYXNlU2Vuc2l0aXZlS2V5RG93bihrZXlib2FyZEV2ZW50KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoSW5wdXQub25SZWdleEtleURvd24oKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSA9PiB0aGlzLm9uUmVnZXhLZXlEb3duKGtleWJvYXJkRXZlbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hJbnB1dC5pbnB1dEJveC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLm9uU2VhcmNoSW5wdXRDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaElucHV0LmlucHV0Qm94Lm9uRGlkSGVpZ2h0Q2hhbmdlKCgpID0+IHRoaXMuX29uRGlkSGVpZ2h0Q2hhbmdlLmZpcmUoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vblJlcGxhY2VWYWx1ZUNoYW5nZWQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fcmVwbGFjZUhpc3RvcnlEZWxheWVyLnRyaWdnZXIoKCkgPT4gdGhpcy5yZXBsYWNlSW5wdXQ/LmlucHV0Qm94LmFkZFRvSGlzdG9yeSgpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnNlYXJjaElucHV0Rm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5zZWFyY2hJbnB1dC5pbnB1dEJveC5pbnB1dEVsZW1lbnQpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaElucHV0Rm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5zZWFyY2hJbnB1dEJveEZvY3VzZWQuc2V0KHRydWUpO1xuXG5cdFx0XHRjb25zdCB1c2VHbG9iYWxGaW5kQnVmZmVyID0gdGhpcy5zZWFyY2hDb25maWd1cmF0aW9uLmdsb2JhbEZpbmRDbGlwYm9hcmQ7XG5cdFx0XHRpZiAoIXRoaXMuaWdub3JlR2xvYmFsRmluZEJ1ZmZlck9uTmV4dEZvY3VzICYmIHVzZUdsb2JhbEZpbmRCdWZmZXIpIHtcblx0XHRcdFx0Y29uc3QgZ2xvYmFsQnVmZmVyVGV4dCA9IGF3YWl0IHRoaXMuY2xpcGJvYXJkU2VydmNlLnJlYWRGaW5kVGV4dCgpO1xuXHRcdFx0XHRpZiAoZ2xvYmFsQnVmZmVyVGV4dCAmJiB0aGlzLnByZXZpb3VzR2xvYmFsRmluZEJ1ZmZlclZhbHVlICE9PSBnbG9iYWxCdWZmZXJUZXh0KSB7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uaW5wdXRCb3guYWRkVG9IaXN0b3J5KCk7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uc2V0VmFsdWUoZ2xvYmFsQnVmZmVyVGV4dCk7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uc2VsZWN0KCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnByZXZpb3VzR2xvYmFsRmluZEJ1ZmZlclZhbHVlID0gZ2xvYmFsQnVmZmVyVGV4dDtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5pZ25vcmVHbG9iYWxGaW5kQnVmZmVyT25OZXh0Rm9jdXMgPSBmYWxzZTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hJbnB1dEZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gdGhpcy5zZWFyY2hJbnB1dEJveEZvY3VzZWQuc2V0KGZhbHNlKSkpO1xuXG5cblx0XHR0aGlzLnNob3dDb250ZXh0VG9nZ2xlID0gbmV3IFRvZ2dsZSh7XG5cdFx0XHRpc0NoZWNrZWQ6IGZhbHNlLFxuXHRcdFx0dGl0bGU6IGFwcGVuZEtleUJpbmRpbmdMYWJlbChubHMubG9jYWxpemUoJ3Nob3dDb250ZXh0JywgXCJUb2dnbGUgQ29udGV4dCBMaW5lc1wiKSwgdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKFRvZ2dsZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCkpLFxuXHRcdFx0aWNvbjogc2VhcmNoU2hvd0NvbnRleHRJY29uLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZTogZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ2VsZW1lbnQnKSxcblx0XHRcdC4uLmRlZmF1bHRUb2dnbGVTdHlsZXNcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNob3dDb250ZXh0VG9nZ2xlLm9uQ2hhbmdlKCgpID0+IHRoaXMub25Db250ZXh0TGluZXNDaGFuZ2VkKCkpKTtcblxuXHRcdGlmIChvcHRpb25zLnNob3dDb250ZXh0VG9nZ2xlKSB7XG5cdFx0XHR0aGlzLmNvbnRleHRMaW5lc0lucHV0ID0gbmV3IElucHV0Qm94KHNlYXJjaElucHV0Q29udGFpbmVyLCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwgeyB0eXBlOiAnbnVtYmVyJywgaW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlcyB9KTtcblx0XHRcdHRoaXMuY29udGV4dExpbmVzSW5wdXQuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjb250ZXh0LWxpbmVzLWlucHV0Jyk7XG5cdFx0XHR0aGlzLmNvbnRleHRMaW5lc0lucHV0LnZhbHVlID0gJycgKyAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKS5zZWFyY2hFZGl0b3IuZGVmYXVsdE51bWJlck9mQ29udGV4dExpbmVzID8/IDEpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0TGluZXNJbnB1dC5vbkRpZENoYW5nZSgodmFsdWU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAodmFsdWUgIT09ICcwJykge1xuXHRcdFx0XHRcdHRoaXMuc2hvd0NvbnRleHRUb2dnbGUuY2hlY2tlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5vbkNvbnRleHRMaW5lc0NoYW5nZWQoKTtcblx0XHRcdH0pKTtcblx0XHRcdGRvbS5hcHBlbmQoc2VhcmNoSW5wdXRDb250YWluZXIsIHRoaXMuc2hvd0NvbnRleHRUb2dnbGUuZG9tTm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRMaW5lc0NoYW5nZWQoKSB7XG5cdFx0dGhpcy5fb25EaWRUb2dnbGVDb250ZXh0LmZpcmUoKTtcblxuXHRcdGlmICh0aGlzLmNvbnRleHRMaW5lc0lucHV0LnZhbHVlLmluY2x1ZGVzKCctJykpIHtcblx0XHRcdHRoaXMuY29udGV4dExpbmVzSW5wdXQudmFsdWUgPSAnMCc7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRUb2dnbGVDb250ZXh0LmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXRDb250ZXh0TGluZXMobGluZXM6IG51bWJlcikge1xuXHRcdGlmICghdGhpcy5jb250ZXh0TGluZXNJbnB1dCkgeyByZXR1cm47IH1cblx0XHRpZiAobGluZXMgPT09IDApIHtcblx0XHRcdHRoaXMuc2hvd0NvbnRleHRUb2dnbGUuY2hlY2tlZCA9IGZhbHNlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnNob3dDb250ZXh0VG9nZ2xlLmNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5jb250ZXh0TGluZXNJbnB1dC52YWx1ZSA9ICcnICsgbGluZXM7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXBsYWNlSW5wdXQocGFyZW50OiBIVE1MRWxlbWVudCwgb3B0aW9uczogSVNlYXJjaFdpZGdldE9wdGlvbnMpOiB2b2lkIHtcblx0XHR0aGlzLnJlcGxhY2VDb250YWluZXIgPSBkb20uYXBwZW5kKHBhcmVudCwgZG9tLiQoJy5yZXBsYWNlLWNvbnRhaW5lci5kaXNhYmxlZCcpKTtcblx0XHRjb25zdCByZXBsYWNlQm94ID0gZG9tLmFwcGVuZCh0aGlzLnJlcGxhY2VDb250YWluZXIsIGRvbS4kKCcucmVwbGFjZS1pbnB1dCcpKTtcblxuXHRcdHRoaXMucmVwbGFjZUlucHV0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbnRleHRTY29wZWRSZXBsYWNlSW5wdXQocmVwbGFjZUJveCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2xhYmVsLlJlcGxhY2UnLCAnUmVwbGFjZTogVHlwZSByZXBsYWNlIHRlcm0gYW5kIHByZXNzIEVudGVyIHRvIHByZXZpZXcnKSxcblx0XHRcdHBsYWNlaG9sZGVyOiBubHMubG9jYWxpemUoJ3NlYXJjaC5yZXBsYWNlLnBsYWNlSG9sZGVyJywgXCJSZXBsYWNlXCIpLFxuXHRcdFx0YXBwZW5kUHJlc2VydmVDYXNlTGFiZWw6IGFwcGVuZEtleUJpbmRpbmdMYWJlbCgnJywgdGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZVByZXNlcnZlQ2FzZUlkKSksXG5cdFx0XHRoaXN0b3J5OiBuZXcgU2V0KG9wdGlvbnMucmVwbGFjZUhpc3RvcnkpLFxuXHRcdFx0c2hvd0hpc3RvcnlIaW50OiAoKSA9PiBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50KHRoaXMua2V5YmluZGluZ1NlcnZpY2UpLFxuXHRcdFx0ZmxleGlibGVIZWlnaHQ6IHRydWUsXG5cdFx0XHRmbGV4aWJsZU1heEhlaWdodDogU2VhcmNoV2lkZ2V0LklOUFVUX01BWF9IRUlHSFQsXG5cdFx0XHRpbnB1dEJveFN0eWxlczogb3B0aW9ucy5pbnB1dEJveFN0eWxlcyxcblx0XHRcdHRvZ2dsZVN0eWxlczogb3B0aW9ucy50b2dnbGVTdHlsZXNcblx0XHR9LCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB0cnVlKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlcGxhY2VJbnB1dC5vbkRpZE9wdGlvbkNoYW5nZSh2aWFLZXlib2FyZCA9PiB7XG5cdFx0XHRpZiAoIXZpYUtleWJvYXJkKSB7XG5cdFx0XHRcdGlmICh0aGlzLnJlcGxhY2VJbnB1dCkge1xuXHRcdFx0XHRcdHRoaXMuX29uUHJlc2VydmVDYXNlQ2hhbmdlLmZpcmUodGhpcy5yZXBsYWNlSW5wdXQuZ2V0UHJlc2VydmVDYXNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZXBsYWNlSW5wdXQub25LZXlEb3duKChrZXlib2FyZEV2ZW50KSA9PiB0aGlzLm9uUmVwbGFjZUlucHV0S2V5RG93bihrZXlib2FyZEV2ZW50KSkpO1xuXHRcdHRoaXMucmVwbGFjZUlucHV0LnNldFZhbHVlKG9wdGlvbnMucmVwbGFjZVZhbHVlIHx8ICcnKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlcGxhY2VJbnB1dC5pbnB1dEJveC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLl9vblJlcGxhY2VWYWx1ZUNoYW5nZWQuZmlyZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZXBsYWNlSW5wdXQuaW5wdXRCb3gub25EaWRIZWlnaHRDaGFuZ2UoKCkgPT4gdGhpcy5fb25EaWRIZWlnaHRDaGFuZ2UuZmlyZSgpKSk7XG5cblx0XHR0aGlzLnJlcGxhY2VBbGxBY3Rpb24gPSBuZXcgUmVwbGFjZUFsbEFjdGlvbih0aGlzKTtcblx0XHR0aGlzLnJlcGxhY2VBbGxBY3Rpb24ubGFiZWwgPSBTZWFyY2hXaWRnZXQuUkVQTEFDRV9BTExfRElTQUJMRURfTEFCRUw7XG5cdFx0dGhpcy5yZXBsYWNlQWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aGlzLnJlcGxhY2VDb250YWluZXIpKTtcblx0XHR0aGlzLnJlcGxhY2VBY3Rpb25CYXIucHVzaChbdGhpcy5yZXBsYWNlQWxsQWN0aW9uXSwgeyBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UgfSk7XG5cdFx0dGhpcy5vbmtleWRvd24odGhpcy5yZXBsYWNlQWN0aW9uQmFyLmRvbU5vZGUsIChrZXlib2FyZEV2ZW50KSA9PiB0aGlzLm9uUmVwbGFjZUFjdGlvbmJhcktleURvd24oa2V5Ym9hcmRFdmVudCkpO1xuXG5cdFx0dGhpcy5yZXBsYWNlSW5wdXRGb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcihkb20udHJhY2tGb2N1cyh0aGlzLnJlcGxhY2VJbnB1dC5pbnB1dEJveC5pbnB1dEVsZW1lbnQpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMucmVwbGFjZUlucHV0Qm94Rm9jdXNlZC5zZXQodHJ1ZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gdGhpcy5yZXBsYWNlSW5wdXRCb3hGb2N1c2VkLnNldChmYWxzZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlcGxhY2VJbnB1dC5vblByZXNlcnZlQ2FzZUtleURvd24oKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSA9PiB0aGlzLm9uUHJlc2VydmVDYXNlS2V5RG93bihrZXlib2FyZEV2ZW50KSkpO1xuXHR9XG5cblx0dHJpZ2dlclJlcGxhY2VBbGwoKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aGlzLl9vblJlcGxhY2VBbGwuZmlyZSgpO1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdH1cblxuXHRwcml2YXRlIG9uVG9nZ2xlUmVwbGFjZUJ1dHRvbigpOiB2b2lkIHtcblx0XHR0aGlzLnJlcGxhY2VDb250YWluZXI/LmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJyk7XG5cdFx0aWYgKHRoaXMuaXNSZXBsYWNlU2hvd24oKSkge1xuXHRcdFx0dGhpcy50b2dnbGVSZXBsYWNlQnV0dG9uPy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoc2VhcmNoSGlkZVJlcGxhY2VJY29uKSk7XG5cdFx0XHR0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24/LmVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShzZWFyY2hTaG93UmVwbGFjZUljb24pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50b2dnbGVSZXBsYWNlQnV0dG9uPy5lbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoc2VhcmNoU2hvd1JlcGxhY2VJY29uKSk7XG5cdFx0XHR0aGlzLnRvZ2dsZVJlcGxhY2VCdXR0b24/LmVsZW1lbnQuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShzZWFyY2hIaWRlUmVwbGFjZUljb24pKTtcblx0XHR9XG5cdFx0dGhpcy50b2dnbGVSZXBsYWNlQnV0dG9uPy5lbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsIHRoaXMuaXNSZXBsYWNlU2hvd24oKSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuXHRcdHRoaXMudXBkYXRlUmVwbGFjZUFjdGl2ZVN0YXRlKCk7XG5cdFx0dGhpcy5fb25SZXBsYWNlVG9nZ2xlZC5maXJlKCk7XG5cdH1cblxuXHRzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKSB7XG5cdFx0dGhpcy5zZWFyY2hJbnB1dD8uc2V0VmFsdWUodmFsdWUpO1xuXHR9XG5cblx0c2V0UmVwbGFjZUFsbEFjdGlvblN0YXRlKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5yZXBsYWNlQWxsQWN0aW9uICYmICh0aGlzLnJlcGxhY2VBbGxBY3Rpb24uZW5hYmxlZCAhPT0gZW5hYmxlZCkpIHtcblx0XHRcdHRoaXMucmVwbGFjZUFsbEFjdGlvbi5lbmFibGVkID0gZW5hYmxlZDtcblx0XHRcdHRoaXMucmVwbGFjZUFsbEFjdGlvbi5sYWJlbCA9IGVuYWJsZWQgPyBTZWFyY2hXaWRnZXQuUkVQTEFDRV9BTExfRU5BQkxFRF9MQUJFTCh0aGlzLmtleWJpbmRpbmdTZXJ2aWNlKSA6IFNlYXJjaFdpZGdldC5SRVBMQUNFX0FMTF9ESVNBQkxFRF9MQUJFTDtcblx0XHRcdHRoaXMudXBkYXRlUmVwbGFjZUFjdGl2ZVN0YXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZXBsYWNlQWN0aXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgY3VycmVudFN0YXRlID0gdGhpcy5pc1JlcGxhY2VBY3RpdmUoKTtcblx0XHRjb25zdCBuZXdTdGF0ZSA9IHRoaXMuaXNSZXBsYWNlU2hvd24oKSAmJiAhIXRoaXMucmVwbGFjZUFsbEFjdGlvbj8uZW5hYmxlZDtcblx0XHRpZiAoY3VycmVudFN0YXRlICE9PSBuZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5yZXBsYWNlQWN0aXZlLnNldChuZXdTdGF0ZSk7XG5cdFx0XHR0aGlzLl9vblJlcGxhY2VTdGF0ZUNoYW5nZS5maXJlKG5ld1N0YXRlKTtcblx0XHRcdHRoaXMucmVwbGFjZUlucHV0Py5pbnB1dEJveC5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlU2VhcmNoSW5wdXQodmFsdWU6IHN0cmluZyk6IElNZXNzYWdlIHwgbnVsbCB7XG5cdFx0aWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICghKHRoaXMuc2VhcmNoSW5wdXQ/LmdldFJlZ2V4KCkpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdG5ldyBSZWdFeHAodmFsdWUsICd1Jyk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIHsgY29udGVudDogZS5tZXNzYWdlIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcml2YXRlIG9uU2VhcmNoSW5wdXRDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoSW5wdXQ/LmNsZWFyTWVzc2FnZSgpO1xuXHRcdHRoaXMuc2V0UmVwbGFjZUFsbEFjdGlvblN0YXRlKGZhbHNlKTtcblxuXHRcdGlmICh0aGlzLnNlYXJjaENvbmZpZ3VyYXRpb24uc2VhcmNoT25UeXBlKSB7XG5cdFx0XHRpZiAodGhpcy5zZWFyY2hJbnB1dD8uZ2V0UmVnZXgoKSkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cCh0aGlzLnNlYXJjaElucHV0LmdldFZhbHVlKCksICd1ZycpO1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoaWVuZXNzSGV1cmlzdGljID0gYFxuXHRcdFx0XHRcdFx0XHRcdH4hQCMkJV4mKigpXytcblx0XHRcdFx0XHRcdFx0XHRcXGAxMjM0NTY3ODkwLT1cblx0XHRcdFx0XHRcdFx0XHRxd2VydHl1aW9wW11cXFxcXG5cdFx0XHRcdFx0XHRcdFx0UVdFUlRZVUlPUHt9fFxuXHRcdFx0XHRcdFx0XHRcdGFzZGZnaGprbDsnXG5cdFx0XHRcdFx0XHRcdFx0QVNERkdISktMOlwiXG5cdFx0XHRcdFx0XHRcdFx0enhjdmJubSwuL1xuXHRcdFx0XHRcdFx0XHRcdFpYQ1ZCTk08Pj8gYC5tYXRjaChyZWdleCk/Lmxlbmd0aCA/PyAwO1xuXG5cdFx0XHRcdFx0Y29uc3QgZGVsYXlNdWx0aXBsaWVyID1cblx0XHRcdFx0XHRcdG1hdGNoaWVuZXNzSGV1cmlzdGljIDwgNTAgPyAxIDpcblx0XHRcdFx0XHRcdFx0bWF0Y2hpZW5lc3NIZXVyaXN0aWMgPCAxMDAgPyA1IDogLy8gZXhwcmVzc2lvbnMgbGlrZSBgLmAgb3IgYFxcd2Bcblx0XHRcdFx0XHRcdFx0XHQxMDsgLy8gb25seSB0aGluZ3MgbWF0Y2hpbmcgZW1wdHkgc3RyaW5nXG5cblxuXHRcdFx0XHRcdHRoaXMuc3VibWl0U2VhcmNoKHRydWUsIHRoaXMuc2VhcmNoQ29uZmlndXJhdGlvbi5zZWFyY2hPblR5cGVEZWJvdW5jZVBlcmlvZCAqIGRlbGF5TXVsdGlwbGllcik7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdC8vIHBhc3Ncblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zdWJtaXRTZWFyY2godHJ1ZSwgdGhpcy5zZWFyY2hDb25maWd1cmF0aW9uLnNlYXJjaE9uVHlwZURlYm91bmNlUGVyaW9kKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uU2VhcmNoSW5wdXRLZXlEb3duKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSB7XG5cdFx0aWYgKGtleWJvYXJkRXZlbnQuZXF1YWxzKGN0cmxLZXlNb2QgfCBLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uaW5wdXRCb3guaW5zZXJ0QXRDdXJzb3IoJ1xcbicpO1xuXHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8ub25TZWFyY2hTdWJtaXQoKTtcblx0XHRcdHRoaXMuc3VibWl0U2VhcmNoKCk7XG5cdFx0XHRrZXlib2FyZEV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoa2V5Ym9hcmRFdmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHR0aGlzLl9vblNlYXJjaENhbmNlbC5maXJlKHsgZm9jdXM6IHRydWUgfSk7XG5cdFx0XHRrZXlib2FyZEV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoa2V5Ym9hcmRFdmVudC5lcXVhbHMoS2V5Q29kZS5UYWIpKSB7XG5cdFx0XHRpZiAodGhpcy5pc1JlcGxhY2VTaG93bigpKSB7XG5cdFx0XHRcdHRoaXMucmVwbGFjZUlucHV0Py5mb2N1cygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uZm9jdXNPbkNhc2VTZW5zaXRpdmUoKTtcblx0XHRcdH1cblx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpKSB7XG5cdFx0XHRzdG9wUHJvcGFnYXRpb25Gb3JNdWx0aUxpbmVVcHdhcmRzKGtleWJvYXJkRXZlbnQsIHRoaXMuc2VhcmNoSW5wdXQ/LmdldFZhbHVlKCkgPz8gJycsIHRoaXMuc2VhcmNoSW5wdXQ/LmRvbU5vZGUucXVlcnlTZWxlY3RvcigndGV4dGFyZWEnKSA/PyBudWxsKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkRvd25BcnJvdykpIHtcblx0XHRcdHN0b3BQcm9wYWdhdGlvbkZvck11bHRpTGluZURvd253YXJkcyhrZXlib2FyZEV2ZW50LCB0aGlzLnNlYXJjaElucHV0Py5nZXRWYWx1ZSgpID8/ICcnLCB0aGlzLnNlYXJjaElucHV0Py5kb21Ob2RlLnF1ZXJ5U2VsZWN0b3IoJ3RleHRhcmVhJykgPz8gbnVsbCk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoa2V5Ym9hcmRFdmVudC5lcXVhbHMoS2V5Q29kZS5QYWdlVXApKSB7XG5cdFx0XHRjb25zdCBpbnB1dEVsZW1lbnQgPSB0aGlzLnNlYXJjaElucHV0Py5pbnB1dEJveC5pbnB1dEVsZW1lbnQ7XG5cdFx0XHRpZiAoaW5wdXRFbGVtZW50KSB7XG5cdFx0XHRcdGlucHV0RWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZSgwLCAwKTtcblx0XHRcdFx0aW5wdXRFbGVtZW50LmZvY3VzKCk7XG5cdFx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbHNlIGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlBhZ2VEb3duKSkge1xuXHRcdFx0Y29uc3QgaW5wdXRFbGVtZW50ID0gdGhpcy5zZWFyY2hJbnB1dD8uaW5wdXRCb3guaW5wdXRFbGVtZW50O1xuXHRcdFx0aWYgKGlucHV0RWxlbWVudCkge1xuXHRcdFx0XHRjb25zdCBlbmRPZlRleHQgPSBpbnB1dEVsZW1lbnQudmFsdWUubGVuZ3RoO1xuXHRcdFx0XHRpbnB1dEVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UoZW5kT2ZUZXh0LCBlbmRPZlRleHQpO1xuXHRcdFx0XHRpbnB1dEVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25DYXNlU2Vuc2l0aXZlS2V5RG93bihrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCkge1xuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdGlmICh0aGlzLmlzUmVwbGFjZVNob3duKCkpIHtcblx0XHRcdFx0dGhpcy5yZXBsYWNlSW5wdXQ/LmZvY3VzKCk7XG5cdFx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUmVnZXhLZXlEb3duKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSB7XG5cdFx0aWYgKGtleWJvYXJkRXZlbnQuZXF1YWxzKEtleUNvZGUuVGFiKSkge1xuXHRcdFx0aWYgKHRoaXMuaXNSZXBsYWNlU2hvd24oKSkge1xuXHRcdFx0XHR0aGlzLnJlcGxhY2VJbnB1dD8uZm9jdXNPblByZXNlcnZlKCk7XG5cdFx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUHJlc2VydmVDYXNlS2V5RG93bihrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCkge1xuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlRhYikpIHtcblx0XHRcdGlmICh0aGlzLmlzUmVwbGFjZUFjdGl2ZSgpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNSZXBsYWNlQWxsQWN0aW9uKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9vbkJsdXIuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdHRoaXMuZm9jdXNSZWdleEFjdGlvbigpO1xuXHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25SZXBsYWNlSW5wdXRLZXlEb3duKGtleWJvYXJkRXZlbnQ6IElLZXlib2FyZEV2ZW50KSB7XG5cdFx0aWYgKGtleWJvYXJkRXZlbnQuZXF1YWxzKGN0cmxLZXlNb2QgfCBLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0dGhpcy5yZXBsYWNlSW5wdXQ/LmlucHV0Qm94Lmluc2VydEF0Q3Vyc29yKCdcXG4nKTtcblx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cblx0XHRpZiAoa2V5Ym9hcmRFdmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdHRoaXMuc3VibWl0U2VhcmNoKCk7XG5cdFx0XHRrZXlib2FyZEV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoa2V5Ym9hcmRFdmVudC5lcXVhbHMoS2V5Q29kZS5UYWIpKSB7XG5cdFx0XHR0aGlzLnNlYXJjaElucHV0Py5mb2N1c09uQ2FzZVNlbnNpdGl2ZSgpO1xuXHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKGtleWJvYXJkRXZlbnQuZXF1YWxzKEtleU1vZC5TaGlmdCB8IEtleUNvZGUuVGFiKSkge1xuXHRcdFx0dGhpcy5zZWFyY2hJbnB1dD8uZm9jdXMoKTtcblx0XHRcdGtleWJvYXJkRXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpKSB7XG5cdFx0XHRzdG9wUHJvcGFnYXRpb25Gb3JNdWx0aUxpbmVVcHdhcmRzKGtleWJvYXJkRXZlbnQsIHRoaXMucmVwbGFjZUlucHV0Py5nZXRWYWx1ZSgpID8/ICcnLCB0aGlzLnJlcGxhY2VJbnB1dD8uZG9tTm9kZS5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYScpID8/IG51bGwpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKGtleWJvYXJkRXZlbnQuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0c3RvcFByb3BhZ2F0aW9uRm9yTXVsdGlMaW5lRG93bndhcmRzKGtleWJvYXJkRXZlbnQsIHRoaXMucmVwbGFjZUlucHV0Py5nZXRWYWx1ZSgpID8/ICcnLCB0aGlzLnJlcGxhY2VJbnB1dD8uZG9tTm9kZS5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYScpID8/IG51bGwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25SZXBsYWNlQWN0aW9uYmFyS2V5RG93bihrZXlib2FyZEV2ZW50OiBJS2V5Ym9hcmRFdmVudCkge1xuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdHRoaXMuZm9jdXNSZWdleEFjdGlvbigpO1xuXHRcdFx0a2V5Ym9hcmRFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3VibWl0U2VhcmNoKHRyaWdnZXJlZE9uVHlwZSA9IGZhbHNlLCBkZWxheTogbnVtYmVyID0gMCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2VhcmNoSW5wdXQ/LnZhbGlkYXRlKCk7XG5cdFx0aWYgKCF0aGlzLnNlYXJjaElucHV0Py5pbnB1dEJveC5pc0lucHV0VmFsaWQoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5zZWFyY2hJbnB1dC5nZXRWYWx1ZSgpO1xuXHRcdGNvbnN0IHVzZUdsb2JhbEZpbmRCdWZmZXIgPSB0aGlzLnNlYXJjaENvbmZpZ3VyYXRpb24uZ2xvYmFsRmluZENsaXBib2FyZDtcblx0XHRpZiAodmFsdWUgJiYgdXNlR2xvYmFsRmluZEJ1ZmZlcikge1xuXHRcdFx0YXdhaXQgdGhpcy5jbGlwYm9hcmRTZXJ2Y2Uud3JpdGVGaW5kVGV4dCh2YWx1ZSk7XG5cdFx0fVxuXHRcdHRoaXMuX29uU2VhcmNoU3VibWl0LmZpcmUoeyB0cmlnZ2VyZWRPblR5cGUsIGRlbGF5IH0pO1xuXHR9XG5cblx0Z2V0Q29udGV4dExpbmVzKCkge1xuXHRcdHJldHVybiB0aGlzLnNob3dDb250ZXh0VG9nZ2xlLmNoZWNrZWQgPyArdGhpcy5jb250ZXh0TGluZXNJbnB1dC52YWx1ZSA6IDA7XG5cdH1cblxuXHRtb2RpZnlDb250ZXh0TGluZXMoaW5jcmVhc2U6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBjdXJyZW50ID0gK3RoaXMuY29udGV4dExpbmVzSW5wdXQudmFsdWU7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBjdXJyZW50ICsgKGluY3JlYXNlID8gMSA6IC0xKTtcblx0XHR0aGlzLnNob3dDb250ZXh0VG9nZ2xlLmNoZWNrZWQgPSBtb2RpZmllZCAhPT0gMDtcblx0XHR0aGlzLmNvbnRleHRMaW5lc0lucHV0LnZhbHVlID0gJycgKyBtb2RpZmllZDtcblx0fVxuXG5cdHRvZ2dsZUNvbnRleHRMaW5lcygpIHtcblx0XHR0aGlzLnNob3dDb250ZXh0VG9nZ2xlLmNoZWNrZWQgPSAhdGhpcy5zaG93Q29udGV4dFRvZ2dsZS5jaGVja2VkO1xuXHRcdHRoaXMub25Db250ZXh0TGluZXNDaGFuZ2VkKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0UmVwbGFjZUFsbEFjdGlvblN0YXRlKGZhbHNlKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzZWFyY2hDb25maWd1cmF0aW9uKCk6IElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcyB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzPignc2VhcmNoJyk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ29udHJpYnV0aW9ucygpIHtcblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6IFJlcGxhY2VBbGxBY3Rpb24uSUQsXG5cdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXBsYWNlQWN0aXZlS2V5LCBDT05URVhUX0ZJTkRfV0lER0VUX05PVF9WSVNJQkxFKSxcblx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdGhhbmRsZXI6IGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGlmIChpc1NlYXJjaFZpZXdGb2N1c2VkKHZpZXdzU2VydmljZSkpIHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcodmlld3NTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKHNlYXJjaFZpZXcpIHtcblx0XHRcdFx0XHRuZXcgUmVwbGFjZUFsbEFjdGlvbihzZWFyY2hWaWV3LnNlYXJjaEFuZFJlcGxhY2VXaWRnZXQpLnJ1bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksU0FBUztBQUVyQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGNBQThCO0FBR3ZDLFNBQW9DLGdCQUFnQjtBQUNwRCxTQUFTLGNBQWM7QUFDdkIsU0FBUyxjQUFj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
