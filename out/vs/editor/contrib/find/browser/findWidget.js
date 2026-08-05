import * as dom from "../../../../base/browser/dom.js";
import { alert as alertFn } from "../../../../base/browser/ui/aria/aria.js";
import { Toggle } from "../../../../base/browser/ui/toggle/toggle.js";
import { Orientation, Sash } from "../../../../base/browser/ui/sash/sash.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Delayer } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import * as platform from "../../../../base/common/platform.js";
import * as strings from "../../../../base/common/strings.js";
import "./findWidget.css";
import { OverlayWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Range } from "../../../common/core/range.js";
import { CONTEXT_FIND_INPUT_FOCUSED, CONTEXT_REPLACE_INPUT_FOCUSED, FIND_IDS, MATCHES_LIMIT } from "./findModel.js";
import * as nls from "../../../../nls.js";
import { AccessibilitySupport } from "../../../../platform/accessibility/common/accessibility.js";
import { ContextScopedFindInput, ContextScopedReplaceInput } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { asCssVariable, contrastBorder, editorFindMatchForeground, editorFindMatchHighlightBorder, editorFindMatchHighlightForeground, editorFindRangeHighlightBorder, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { registerIcon, widgetClose } from "../../../../platform/theme/common/iconRegistry.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { defaultInputBoxStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
const findCollapsedIcon = registerIcon("find-collapsed", Codicon.chevronRight, nls.localize("findCollapsedIcon", "Icon to indicate that the editor find widget is collapsed."));
const findExpandedIcon = registerIcon("find-expanded", Codicon.chevronDown, nls.localize("findExpandedIcon", "Icon to indicate that the editor find widget is expanded."));
const findSelectionIcon = registerIcon("find-selection", Codicon.selection, nls.localize("findSelectionIcon", "Icon for 'Find in Selection' in the editor find widget."));
const findReplaceIcon = registerIcon("find-replace", Codicon.replace, nls.localize("findReplaceIcon", "Icon for 'Replace' in the editor find widget."));
const findReplaceAllIcon = registerIcon("find-replace-all", Codicon.replaceAll, nls.localize("findReplaceAllIcon", "Icon for 'Replace All' in the editor find widget."));
const findPreviousMatchIcon = registerIcon("find-previous-match", Codicon.arrowUp, nls.localize("findPreviousMatchIcon", "Icon for 'Find Previous' in the editor find widget."));
const findNextMatchIcon = registerIcon("find-next-match", Codicon.arrowDown, nls.localize("findNextMatchIcon", "Icon for 'Find Next' in the editor find widget."));
const NLS_FIND_DIALOG_LABEL = nls.localize("label.findDialog", "Find / Replace");
const NLS_FIND_INPUT_LABEL = nls.localize("label.find", "Find");
const NLS_FIND_INPUT_PLACEHOLDER = nls.localize("placeholder.find", "Find");
const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize("label.previousMatchButton", "Previous Match");
const NLS_NEXT_MATCH_BTN_LABEL = nls.localize("label.nextMatchButton", "Next Match");
const NLS_TOGGLE_SELECTION_FIND_TITLE = nls.localize("label.toggleSelectionFind", "Find in Selection");
const NLS_CLOSE_BTN_LABEL = nls.localize("label.closeButton", "Close");
const NLS_REPLACE_INPUT_LABEL = nls.localize("label.replace", "Replace");
const NLS_REPLACE_INPUT_PLACEHOLDER = nls.localize("placeholder.replace", "Replace");
const NLS_REPLACE_BTN_LABEL = nls.localize("label.replaceButton", "Replace");
const NLS_REPLACE_ALL_BTN_LABEL = nls.localize("label.replaceAllButton", "Replace All");
const NLS_TOGGLE_REPLACE_MODE_BTN_LABEL = nls.localize("label.toggleReplaceButton", "Toggle Replace");
const NLS_MATCHES_COUNT_LIMIT_TITLE = nls.localize("title.matchesCountLimit", "Only the first {0} results are highlighted, but all find operations work on the entire text.", MATCHES_LIMIT);
const NLS_MATCHES_LOCATION = nls.localize("label.matchesLocation", "{0} of {1}");
const NLS_NO_RESULTS = nls.localize("label.noResults", "No results");
const FIND_WIDGET_INITIAL_WIDTH = 419;
const PART_WIDTH = 275;
const FIND_INPUT_AREA_WIDTH = PART_WIDTH - 54;
let MAX_MATCHES_COUNT_WIDTH = 69;
const FIND_INPUT_AREA_HEIGHT = 33;
const ctrlEnterReplaceAllWarningPromptedKey = "ctrlEnterReplaceAll.windows.donotask";
const ctrlKeyMod = platform.isMacintosh ? KeyMod.WinCtrl : KeyMod.CtrlCmd;
class FindWidgetViewZone {
  constructor(afterLineNumber) {
    this.afterLineNumber = afterLineNumber;
    this.heightInPx = FIND_INPUT_AREA_HEIGHT;
    this.suppressMouseDown = false;
    this.domNode = document.createElement("div");
    this.domNode.className = "dock-find-viewzone";
  }
}
function stopPropagationForMultiLineUpwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && isMultiline && textarea.selectionStart > 0) {
    event.stopPropagation();
    return;
  }
}
function stopPropagationForMultiLineDownwards(event, value, textarea) {
  const isMultiline = !!value.match(/\n/);
  if (textarea && isMultiline && textarea.selectionEnd < textarea.value.length) {
    event.stopPropagation();
    return;
  }
}
const _FindWidget = class _FindWidget extends Widget {
  constructor(codeEditor, controller, state, contextViewProvider, keybindingService, contextKeyService, themeService, storageService, notificationService, _hoverService, _findWidgetSearchHistory, _replaceWidgetHistory) {
    super();
    this._hoverService = _hoverService;
    this._findWidgetSearchHistory = _findWidgetSearchHistory;
    this._replaceWidgetHistory = _replaceWidgetHistory;
    this._cachedHeight = null;
    this._revealTimeouts = [];
    this._codeEditor = codeEditor;
    this._controller = controller;
    this._state = state;
    this._contextViewProvider = contextViewProvider;
    this._keybindingService = keybindingService;
    this._contextKeyService = contextKeyService;
    this._storageService = storageService;
    this._notificationService = notificationService;
    this._ctrlEnterReplaceAllWarningPrompted = !!storageService.getBoolean(ctrlEnterReplaceAllWarningPromptedKey, StorageScope.PROFILE);
    this._isVisible = false;
    this._isReplaceVisible = false;
    this._ignoreChangeEvent = false;
    this._updateHistoryDelayer = new Delayer(500);
    this._register(toDisposable(() => this._updateHistoryDelayer.cancel()));
    this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
    this._buildDomNode();
    this._updateButtons();
    this._tryUpdateWidgetWidth();
    this._findInput.inputBox.layout();
    this._register(this._codeEditor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.readOnly)) {
        if (this._codeEditor.getOption(EditorOption.readOnly)) {
          this._state.change({ isReplaceRevealed: false }, false);
        }
        this._updateButtons();
      }
      if (e.hasChanged(EditorOption.layoutInfo)) {
        this._tryUpdateWidgetWidth();
      }
      if (e.hasChanged(EditorOption.accessibilitySupport)) {
        this.updateAccessibilitySupport();
      }
      if (e.hasChanged(EditorOption.find)) {
        const supportLoop = this._codeEditor.getOption(EditorOption.find).loop;
        this._state.change({ loop: supportLoop }, false);
        const addExtraSpaceOnTop = this._codeEditor.getOption(EditorOption.find).addExtraSpaceOnTop;
        if (addExtraSpaceOnTop && !this._viewZone) {
          this._viewZone = new FindWidgetViewZone(0);
          this._showViewZone();
        }
        if (!addExtraSpaceOnTop && this._viewZone) {
          this._removeViewZone();
        }
      }
    }));
    this.updateAccessibilitySupport();
    this._register(this._codeEditor.onDidChangeCursorSelection(() => {
      if (this._isVisible) {
        this._updateToggleSelectionFindButton();
      }
    }));
    this._register(this._codeEditor.onDidFocusEditorWidget(async () => {
      if (this._isVisible) {
        const globalBufferTerm = await this._controller.getGlobalBufferTerm();
        if (globalBufferTerm && globalBufferTerm !== this._state.searchString) {
          this._state.change({ searchString: globalBufferTerm }, false);
          this._findInput.select();
        }
      }
    }));
    this._findInputFocused = CONTEXT_FIND_INPUT_FOCUSED.bindTo(contextKeyService);
    this._findFocusTracker = this._register(dom.trackFocus(this._findInput.inputBox.inputElement));
    this._register(this._findFocusTracker.onDidFocus(() => {
      this._findInputFocused.set(true);
      this._updateSearchScope();
    }));
    this._register(this._findFocusTracker.onDidBlur(() => {
      this._findInputFocused.set(false);
    }));
    this._replaceInputFocused = CONTEXT_REPLACE_INPUT_FOCUSED.bindTo(contextKeyService);
    this._replaceFocusTracker = this._register(dom.trackFocus(this._replaceInput.inputBox.inputElement));
    this._register(this._replaceFocusTracker.onDidFocus(() => {
      this._replaceInputFocused.set(true);
      this._updateSearchScope();
    }));
    this._register(this._replaceFocusTracker.onDidBlur(() => {
      this._replaceInputFocused.set(false);
    }));
    this._codeEditor.addOverlayWidget(this);
    if (this._codeEditor.getOption(EditorOption.find).addExtraSpaceOnTop) {
      this._viewZone = new FindWidgetViewZone(0);
    }
    this._register(this._codeEditor.onDidChangeModel(() => {
      if (!this._isVisible) {
        return;
      }
      this._viewZoneId = void 0;
    }));
    this._register(this._codeEditor.onDidScrollChange((e) => {
      if (e.scrollTopChanged) {
        this._layoutViewZone();
        return;
      }
      setTimeout(() => {
        this._layoutViewZone();
      }, 0);
    }));
  }
  // ----- IOverlayWidget API
  getId() {
    return _FindWidget.ID;
  }
  getDomNode() {
    return this._domNode;
  }
  getPosition() {
    if (this._isVisible) {
      return {
        preference: OverlayWidgetPositionPreference.TOP_RIGHT_CORNER
      };
    }
    return null;
  }
  // ----- React to state changes
  _onStateChanged(e) {
    if (e.searchString) {
      try {
        this._ignoreChangeEvent = true;
        this._findInput.setValue(this._state.searchString);
      } finally {
        this._ignoreChangeEvent = false;
      }
      this._updateButtons();
    }
    if (e.replaceString) {
      this._replaceInput.inputBox.value = this._state.replaceString;
    }
    if (e.isRevealed) {
      if (this._state.isRevealed) {
        this._reveal();
      } else {
        this._hide(true);
      }
    }
    if (e.isReplaceRevealed) {
      if (this._state.isReplaceRevealed) {
        if (!this._codeEditor.getOption(EditorOption.readOnly) && !this._isReplaceVisible) {
          this._isReplaceVisible = true;
          this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
          this._updateButtons();
          this._replaceInput.inputBox.layout();
        }
      } else {
        if (this._isReplaceVisible) {
          this._isReplaceVisible = false;
          this._updateButtons();
        }
      }
    }
    if ((e.isRevealed || e.isReplaceRevealed) && (this._state.isRevealed || this._state.isReplaceRevealed)) {
      if (this._tryUpdateHeight()) {
        this._showViewZone();
      }
    }
    if (e.isRegex) {
      this._findInput.setRegex(this._state.isRegex);
    }
    if (e.wholeWord) {
      this._findInput.setWholeWords(this._state.wholeWord);
    }
    if (e.matchCase) {
      this._findInput.setCaseSensitive(this._state.matchCase);
    }
    if (e.preserveCase) {
      this._replaceInput.setPreserveCase(this._state.preserveCase);
    }
    if (e.searchScope) {
      if (this._state.searchScope) {
        this._toggleSelectionFind.checked = true;
      } else {
        this._toggleSelectionFind.checked = false;
      }
      this._updateToggleSelectionFindButton();
    }
    if (e.searchString || e.matchesCount || e.matchesPosition) {
      const showRedOutline = this._state.searchString.length > 0 && this._state.matchesCount === 0;
      this._domNode.classList.toggle("no-results", showRedOutline);
      this._updateMatchesCount();
      this._updateButtons();
    }
    if (e.searchString || e.currentMatch) {
      this._layoutViewZone();
    }
    if (e.updateHistory) {
      this._delayedUpdateHistory();
    }
    if (e.loop) {
      this._updateButtons();
    }
  }
  _delayedUpdateHistory() {
    this._updateHistoryDelayer.trigger(this._updateHistory.bind(this)).then(void 0, onUnexpectedError);
  }
  _updateHistory() {
    if (this._state.searchString) {
      this._findInput.inputBox.addToHistory();
    }
    if (this._state.replaceString) {
      this._replaceInput.inputBox.addToHistory();
    }
  }
  _updateMatchesCount() {
    this._matchesCount.style.minWidth = MAX_MATCHES_COUNT_WIDTH + "px";
    if (this._state.matchesCount >= MATCHES_LIMIT) {
      this._matchesCount.title = NLS_MATCHES_COUNT_LIMIT_TITLE;
    } else {
      this._matchesCount.title = "";
    }
    this._matchesCount.firstChild?.remove();
    let label;
    if (this._state.matchesCount > 0) {
      let matchesCount = String(this._state.matchesCount);
      if (this._state.matchesCount >= MATCHES_LIMIT) {
        matchesCount += "+";
      }
      let matchesPosition = String(this._state.matchesPosition);
      if (matchesPosition === "0") {
        matchesPosition = "?";
      }
      label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
    } else {
      label = NLS_NO_RESULTS;
    }
    this._matchesCount.appendChild(document.createTextNode(label));
    alertFn(this._getAriaLabel(label, this._state.currentMatch, this._state.searchString));
    MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
  }
  // ----- actions
  _getAriaLabel(label, currentMatch, searchString) {
    if (label === NLS_NO_RESULTS) {
      return searchString === "" ? nls.localize("ariaSearchNoResultEmpty", "{0} found", label) : nls.localize("ariaSearchNoResult", "{0} found for '{1}'", label, searchString);
    }
    if (currentMatch) {
      const ariaLabel = nls.localize("ariaSearchNoResultWithLineNum", "{0} found for '{1}', at {2}", label, searchString, currentMatch.startLineNumber + ":" + currentMatch.startColumn);
      const model = this._codeEditor.getModel();
      if (model && currentMatch.startLineNumber <= model.getLineCount() && currentMatch.startLineNumber >= 1) {
        const lineContent = model.getLineContent(currentMatch.startLineNumber);
        return `${lineContent}, ${ariaLabel}`;
      }
      return ariaLabel;
    }
    return nls.localize("ariaSearchNoResultWithLineNumNoCurrentMatch", "{0} found for '{1}'", label, searchString);
  }
  /**
   * If 'selection find' is ON we should not disable the button (its function is to cancel 'selection find').
   * If 'selection find' is OFF we enable the button only if there is a selection.
   */
  _updateToggleSelectionFindButton() {
    const selection = this._codeEditor.getSelection();
    const isSelection = selection ? selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn : false;
    const isChecked = this._toggleSelectionFind.checked;
    if (this._isVisible && (isChecked || isSelection)) {
      this._toggleSelectionFind.enable();
    } else {
      this._toggleSelectionFind.disable();
    }
  }
  _updateButtons() {
    this._findInput.setEnabled(this._isVisible);
    this._replaceInput.setEnabled(this._isVisible && this._isReplaceVisible);
    this._updateToggleSelectionFindButton();
    this._closeBtn.setEnabled(this._isVisible);
    const findInputIsNonEmpty = this._state.searchString.length > 0;
    const matchesCount = this._state.matchesCount ? true : false;
    this._prevBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount && this._state.canNavigateBack());
    this._nextBtn.setEnabled(this._isVisible && findInputIsNonEmpty && matchesCount && this._state.canNavigateForward());
    this._replaceBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
    this._replaceAllBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
    this._domNode.classList.toggle("replaceToggled", this._isReplaceVisible);
    this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
    const canReplace = !this._codeEditor.getOption(EditorOption.readOnly);
    this._toggleReplaceBtn.setEnabled(this._isVisible && canReplace);
  }
  _reveal() {
    this._revealTimeouts.forEach((e) => {
      clearTimeout(e);
    });
    this._revealTimeouts = [];
    if (!this._isVisible) {
      this._isVisible = true;
      const selection = this._codeEditor.getSelection();
      switch (this._codeEditor.getOption(EditorOption.find).autoFindInSelection) {
        case "always":
          this._toggleSelectionFind.checked = true;
          break;
        case "never":
          this._toggleSelectionFind.checked = false;
          break;
        case "multiline": {
          const isSelectionMultipleLine = !!selection && selection.startLineNumber !== selection.endLineNumber;
          this._toggleSelectionFind.checked = isSelectionMultipleLine;
          break;
        }
        default:
          break;
      }
      this._tryUpdateWidgetWidth();
      this._updateButtons();
      this._revealTimeouts.push(setTimeout(() => {
        this._domNode.classList.add("visible");
        this._domNode.setAttribute("aria-hidden", "false");
      }, 0));
      this._revealTimeouts.push(setTimeout(() => {
        this._findInput.validate();
      }, 200));
      this._codeEditor.layoutOverlayWidget(this);
      let adjustEditorScrollTop = true;
      if (this._codeEditor.getOption(EditorOption.find).seedSearchStringFromSelection && selection) {
        const domNode = this._codeEditor.getDomNode();
        if (domNode) {
          const editorCoords = dom.getDomNodePagePosition(domNode);
          const startCoords = this._codeEditor.getScrolledVisiblePosition(selection.getStartPosition());
          const startLeft = editorCoords.left + (startCoords ? startCoords.left : 0);
          const startTop = startCoords ? startCoords.top : 0;
          if (this._viewZone && startTop < this._viewZone.heightInPx) {
            if (selection.endLineNumber > selection.startLineNumber) {
              adjustEditorScrollTop = false;
            }
            const leftOfFindWidget = dom.getTopLeftOffset(this._domNode).left;
            if (startLeft > leftOfFindWidget) {
              adjustEditorScrollTop = false;
            }
            const endCoords = this._codeEditor.getScrolledVisiblePosition(selection.getEndPosition());
            const endLeft = editorCoords.left + (endCoords ? endCoords.left : 0);
            if (endLeft > leftOfFindWidget) {
              adjustEditorScrollTop = false;
            }
          }
        }
      }
      this._showViewZone(adjustEditorScrollTop);
    }
  }
  _hide(focusTheEditor) {
    this._revealTimeouts.forEach((e) => {
      clearTimeout(e);
    });
    this._revealTimeouts = [];
    if (this._isVisible) {
      this._isVisible = false;
      this._updateButtons();
      this._domNode.classList.remove("visible");
      this._domNode.setAttribute("aria-hidden", "true");
      this._findInput.clearMessage();
      if (focusTheEditor) {
        this._codeEditor.focus();
      }
      this._codeEditor.layoutOverlayWidget(this);
      this._removeViewZone();
    }
  }
  _layoutViewZone(targetScrollTop) {
    const addExtraSpaceOnTop = this._codeEditor.getOption(EditorOption.find).addExtraSpaceOnTop;
    if (!addExtraSpaceOnTop) {
      this._removeViewZone();
      return;
    }
    if (!this._isVisible) {
      return;
    }
    const viewZone = this._viewZone;
    if (this._viewZoneId !== void 0 || !viewZone) {
      return;
    }
    this._codeEditor.changeViewZones((accessor) => {
      viewZone.heightInPx = this._getHeight();
      this._viewZoneId = accessor.addZone(viewZone);
      this._codeEditor.setScrollTop(targetScrollTop || this._codeEditor.getScrollTop() + viewZone.heightInPx);
    });
  }
  _showViewZone(adjustScroll = true) {
    if (!this._isVisible) {
      return;
    }
    const addExtraSpaceOnTop = this._codeEditor.getOption(EditorOption.find).addExtraSpaceOnTop;
    if (!addExtraSpaceOnTop) {
      return;
    }
    if (this._viewZone === void 0) {
      this._viewZone = new FindWidgetViewZone(0);
    }
    const viewZone = this._viewZone;
    this._codeEditor.changeViewZones((accessor) => {
      if (this._viewZoneId !== void 0) {
        const newHeight = this._getHeight();
        if (newHeight === viewZone.heightInPx) {
          return;
        }
        const scrollAdjustment = newHeight - viewZone.heightInPx;
        viewZone.heightInPx = newHeight;
        accessor.layoutZone(this._viewZoneId);
        if (adjustScroll) {
          this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + scrollAdjustment);
        }
        return;
      } else {
        let scrollAdjustment = this._getHeight();
        scrollAdjustment -= this._codeEditor.getOption(EditorOption.padding).top;
        if (scrollAdjustment <= 0) {
          return;
        }
        viewZone.heightInPx = scrollAdjustment;
        this._viewZoneId = accessor.addZone(viewZone);
        if (adjustScroll) {
          this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() + scrollAdjustment);
        }
      }
    });
  }
  _removeViewZone() {
    this._codeEditor.changeViewZones((accessor) => {
      if (this._viewZoneId !== void 0) {
        accessor.removeZone(this._viewZoneId);
        this._viewZoneId = void 0;
        if (this._viewZone) {
          this._codeEditor.setScrollTop(this._codeEditor.getScrollTop() - this._viewZone.heightInPx);
          this._viewZone = void 0;
        }
      }
    });
  }
  _tryUpdateWidgetWidth() {
    if (!this._isVisible) {
      return;
    }
    if (!this._domNode.isConnected) {
      return;
    }
    const layoutInfo = this._codeEditor.getLayoutInfo();
    const editorContentWidth = layoutInfo.contentWidth;
    if (editorContentWidth <= 0) {
      this._domNode.classList.add("hiddenEditor");
      return;
    } else if (this._domNode.classList.contains("hiddenEditor")) {
      this._domNode.classList.remove("hiddenEditor");
    }
    const editorWidth = layoutInfo.width;
    const minimapWidth = layoutInfo.minimap.minimapWidth;
    let collapsedFindWidget = false;
    let reducedFindWidget = false;
    let narrowFindWidget = false;
    if (this._resized) {
      const widgetWidth = dom.getTotalWidth(this._domNode);
      if (widgetWidth > FIND_WIDGET_INITIAL_WIDTH) {
        this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
        this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
        return;
      }
    }
    if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth >= editorWidth) {
      reducedFindWidget = true;
    }
    if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth) {
      narrowFindWidget = true;
    }
    if (FIND_WIDGET_INITIAL_WIDTH + 28 + minimapWidth - MAX_MATCHES_COUNT_WIDTH >= editorWidth + 50) {
      collapsedFindWidget = true;
    }
    this._domNode.classList.toggle("collapsed-find-widget", collapsedFindWidget);
    this._domNode.classList.toggle("narrow-find-widget", narrowFindWidget);
    this._domNode.classList.toggle("reduced-find-widget", reducedFindWidget);
    if (!narrowFindWidget && !collapsedFindWidget) {
      this._domNode.style.maxWidth = `${editorWidth - 28 - minimapWidth - 15}px`;
    }
    this._findInput.layout({ collapsedFindWidget, narrowFindWidget, reducedFindWidget });
    if (this._resized) {
      const findInputWidth = this._findInput.inputBox.element.clientWidth;
      if (findInputWidth > 0) {
        this._replaceInput.width = findInputWidth;
      }
    } else if (this._isReplaceVisible) {
      this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
    }
  }
  _getHeight() {
    let totalheight = 0;
    totalheight += 4;
    totalheight += this._findInput.inputBox.height + 2;
    if (this._isReplaceVisible) {
      totalheight += 4;
      totalheight += this._replaceInput.inputBox.height + 2;
    }
    totalheight += 4;
    return totalheight;
  }
  _tryUpdateHeight() {
    const totalHeight = this._getHeight();
    if (this._cachedHeight !== null && this._cachedHeight === totalHeight) {
      return false;
    }
    this._cachedHeight = totalHeight;
    this._domNode.style.height = `${totalHeight}px`;
    return true;
  }
  // ----- Public
  focusFindInput() {
    this._findInput.select();
    this._findInput.focus();
  }
  focusReplaceInput() {
    this._replaceInput.select();
    this._replaceInput.focus();
  }
  highlightFindOptions() {
    this._findInput.highlightFindOptions();
  }
  _updateSearchScope() {
    if (!this._codeEditor.hasModel()) {
      return;
    }
    if (this._toggleSelectionFind.checked) {
      const selections = this._codeEditor.getSelections();
      selections.map((selection) => {
        if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
          selection = selection.setEndPosition(
            selection.endLineNumber - 1,
            this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1)
          );
        }
        const currentMatch = this._state.currentMatch;
        if (selection.startLineNumber !== selection.endLineNumber) {
          if (!Range.equalsRange(selection, currentMatch)) {
            return selection;
          }
        }
        return null;
      }).filter((element) => !!element);
      if (selections.length) {
        this._state.change({ searchScope: selections }, true);
      }
    }
  }
  _onFindInputMouseDown(e) {
    if (e.middleButton) {
      e.stopPropagation();
    }
  }
  _onFindInputKeyDown(e) {
    if (e.equals(ctrlKeyMod | KeyCode.Enter)) {
      if (this._keybindingService.dispatchEvent(e, e.target)) {
        e.preventDefault();
        return;
      } else {
        this._findInput.inputBox.insertAtCursor("\n");
        e.preventDefault();
        return;
      }
    }
    if (e.equals(KeyCode.Tab)) {
      if (this._isReplaceVisible) {
        this._replaceInput.focus();
      } else {
        this._findInput.focusOnCaseSensitive();
      }
      e.preventDefault();
      return;
    }
    if (e.equals(KeyMod.CtrlCmd | KeyCode.DownArrow)) {
      this._codeEditor.focus();
      e.preventDefault();
      return;
    }
    if (e.equals(KeyCode.UpArrow)) {
      return stopPropagationForMultiLineUpwards(e, this._findInput.getValue(), this._findInput.domNode.querySelector("textarea"));
    }
    if (e.equals(KeyCode.DownArrow)) {
      return stopPropagationForMultiLineDownwards(e, this._findInput.getValue(), this._findInput.domNode.querySelector("textarea"));
    }
  }
  _onReplaceInputKeyDown(e) {
    if (e.equals(ctrlKeyMod | KeyCode.Enter)) {
      if (this._keybindingService.dispatchEvent(e, e.target)) {
        e.preventDefault();
        return;
      } else {
        if (platform.isWindows && platform.isNative && !this._ctrlEnterReplaceAllWarningPrompted) {
          this._notificationService.info(
            nls.localize(
              "ctrlEnter.keybindingChanged",
              "Ctrl+Enter now inserts line break instead of replacing all. You can modify the keybinding for editor.action.replaceAll to override this behavior."
            )
          );
          this._ctrlEnterReplaceAllWarningPrompted = true;
          this._storageService.store(ctrlEnterReplaceAllWarningPromptedKey, true, StorageScope.PROFILE, StorageTarget.USER);
        }
        this._replaceInput.inputBox.insertAtCursor("\n");
        e.preventDefault();
        return;
      }
    }
    if (e.equals(KeyCode.Tab)) {
      this._findInput.focusOnCaseSensitive();
      e.preventDefault();
      return;
    }
    if (e.equals(KeyMod.Shift | KeyCode.Tab)) {
      this._findInput.focus();
      e.preventDefault();
      return;
    }
    if (e.equals(KeyMod.CtrlCmd | KeyCode.DownArrow)) {
      this._codeEditor.focus();
      e.preventDefault();
      return;
    }
    if (e.equals(KeyCode.UpArrow)) {
      return stopPropagationForMultiLineUpwards(e, this._replaceInput.inputBox.value, this._replaceInput.inputBox.element.querySelector("textarea"));
    }
    if (e.equals(KeyCode.DownArrow)) {
      return stopPropagationForMultiLineDownwards(e, this._replaceInput.inputBox.value, this._replaceInput.inputBox.element.querySelector("textarea"));
    }
  }
  // ----- sash
  getVerticalSashLeft(_sash) {
    return 0;
  }
  // ----- initialization
  _keybindingLabelFor(actionId) {
    const kb = this._keybindingService.lookupKeybinding(actionId);
    if (!kb) {
      return "";
    }
    return ` (${kb.getLabel()})`;
  }
  _buildDomNode() {
    const flexibleHeight = true;
    const flexibleWidth = true;
    const findSearchHistoryConfig = this._codeEditor.getOption(EditorOption.find).history;
    const replaceHistoryConfig = this._codeEditor.getOption(EditorOption.find).replaceHistory;
    this._findInput = this._register(new ContextScopedFindInput(null, this._contextViewProvider, {
      width: FIND_INPUT_AREA_WIDTH,
      label: NLS_FIND_INPUT_LABEL,
      placeholder: NLS_FIND_INPUT_PLACEHOLDER,
      appendCaseSensitiveLabel: this._keybindingLabelFor(FIND_IDS.ToggleCaseSensitiveCommand),
      appendWholeWordsLabel: this._keybindingLabelFor(FIND_IDS.ToggleWholeWordCommand),
      appendRegexLabel: this._keybindingLabelFor(FIND_IDS.ToggleRegexCommand),
      validation: (value) => {
        if (value.length === 0 || !this._findInput.getRegex()) {
          return null;
        }
        try {
          new RegExp(value, "gu");
          return null;
        } catch (e) {
          return { content: e.message };
        }
      },
      flexibleHeight,
      flexibleWidth,
      flexibleMaxHeight: 118,
      showCommonFindToggles: true,
      showHistoryHint: () => showHistoryKeybindingHint(this._keybindingService),
      inputBoxStyles: defaultInputBoxStyles,
      toggleStyles: defaultToggleStyles,
      history: findSearchHistoryConfig === "workspace" ? this._findWidgetSearchHistory : /* @__PURE__ */ new Set([])
    }, this._contextKeyService));
    this._findInput.setRegex(!!this._state.isRegex);
    this._findInput.setCaseSensitive(!!this._state.matchCase);
    this._findInput.setWholeWords(!!this._state.wholeWord);
    this._register(this._findInput.onKeyDown((e) => this._onFindInputKeyDown(e)));
    this._register(this._findInput.inputBox.onDidChange(() => {
      if (this._ignoreChangeEvent) {
        return;
      }
      this._state.change({ searchString: this._findInput.getValue() }, true);
    }));
    this._register(this._findInput.onDidOptionChange(() => {
      this._state.change({
        isRegex: this._findInput.getRegex(),
        wholeWord: this._findInput.getWholeWords(),
        matchCase: this._findInput.getCaseSensitive()
      }, true);
    }));
    this._register(this._findInput.onCaseSensitiveKeyDown((e) => {
      if (e.equals(KeyMod.Shift | KeyCode.Tab)) {
        if (this._isReplaceVisible) {
          this._replaceInput.focus();
          e.preventDefault();
        }
      }
    }));
    this._register(this._findInput.onRegexKeyDown((e) => {
      if (e.equals(KeyCode.Tab)) {
        if (this._isReplaceVisible) {
          this._replaceInput.focusOnPreserve();
          e.preventDefault();
        }
      }
    }));
    this._register(this._findInput.inputBox.onDidHeightChange((e) => {
      if (this._tryUpdateHeight()) {
        this._showViewZone();
      }
    }));
    if (platform.isLinux) {
      this._register(this._findInput.onMouseDown((e) => this._onFindInputMouseDown(e)));
    }
    this._matchesCount = document.createElement("div");
    this._matchesCount.className = "matchesCount";
    this._updateMatchesCount();
    const hoverDelegate = this._register(createInstantHoverDelegate());
    this._prevBtn = this._register(new SimpleButton({
      label: NLS_PREVIOUS_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.PreviousMatchFindAction),
      icon: findPreviousMatchIcon,
      hoverDelegate,
      onTrigger: () => {
        assertIsDefined(this._codeEditor.getAction(FIND_IDS.PreviousMatchFindAction)).run().then(void 0, onUnexpectedError);
      }
    }, this._hoverService));
    this._nextBtn = this._register(new SimpleButton({
      label: NLS_NEXT_MATCH_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.NextMatchFindAction),
      icon: findNextMatchIcon,
      hoverDelegate,
      onTrigger: () => {
        assertIsDefined(this._codeEditor.getAction(FIND_IDS.NextMatchFindAction)).run().then(void 0, onUnexpectedError);
      }
    }, this._hoverService));
    const findPart = document.createElement("div");
    findPart.className = "find-part";
    findPart.appendChild(this._findInput.domNode);
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "find-actions";
    findPart.appendChild(actionsContainer);
    actionsContainer.appendChild(this._matchesCount);
    actionsContainer.appendChild(this._prevBtn.domNode);
    actionsContainer.appendChild(this._nextBtn.domNode);
    this._toggleSelectionFind = this._register(new Toggle({
      icon: findSelectionIcon,
      title: NLS_TOGGLE_SELECTION_FIND_TITLE + this._keybindingLabelFor(FIND_IDS.ToggleSearchScopeCommand),
      isChecked: false,
      hoverDelegate,
      inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground),
      inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
      inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground)
    }));
    this._register(this._toggleSelectionFind.onChange(() => {
      if (this._toggleSelectionFind.checked) {
        if (this._codeEditor.hasModel()) {
          let selections = this._codeEditor.getSelections();
          selections = selections.map((selection) => {
            if (selection.endColumn === 1 && selection.endLineNumber > selection.startLineNumber) {
              selection = selection.setEndPosition(selection.endLineNumber - 1, this._codeEditor.getModel().getLineMaxColumn(selection.endLineNumber - 1));
            }
            if (!selection.isEmpty()) {
              return selection;
            }
            return null;
          }).filter((element) => !!element);
          if (selections.length) {
            this._state.change({ searchScope: selections }, true);
          }
        }
      } else {
        this._state.change({ searchScope: null }, true);
      }
    }));
    actionsContainer.appendChild(this._toggleSelectionFind.domNode);
    this._closeBtn = this._register(new SimpleButton({
      label: NLS_CLOSE_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.CloseFindWidgetCommand),
      icon: widgetClose,
      hoverDelegate,
      onTrigger: () => {
        this._state.change({ isRevealed: false, searchScope: null }, false);
      },
      onKeyDown: (e) => {
        if (e.equals(KeyCode.Tab)) {
          if (this._isReplaceVisible) {
            if (this._replaceBtn.isEnabled()) {
              this._replaceBtn.focus();
            } else {
              this._codeEditor.focus();
            }
            e.preventDefault();
          }
        }
      }
    }, this._hoverService));
    this._replaceInput = this._register(new ContextScopedReplaceInput(null, void 0, {
      label: NLS_REPLACE_INPUT_LABEL,
      placeholder: NLS_REPLACE_INPUT_PLACEHOLDER,
      appendPreserveCaseLabel: this._keybindingLabelFor(FIND_IDS.TogglePreserveCaseCommand),
      history: replaceHistoryConfig === "workspace" ? this._replaceWidgetHistory : /* @__PURE__ */ new Set([]),
      flexibleHeight,
      flexibleWidth,
      flexibleMaxHeight: 118,
      showHistoryHint: () => showHistoryKeybindingHint(this._keybindingService),
      inputBoxStyles: defaultInputBoxStyles,
      toggleStyles: defaultToggleStyles
    }, this._contextKeyService, true));
    this._replaceInput.setPreserveCase(!!this._state.preserveCase);
    this._register(this._replaceInput.onKeyDown((e) => this._onReplaceInputKeyDown(e)));
    this._register(this._replaceInput.inputBox.onDidChange(() => {
      this._state.change({ replaceString: this._replaceInput.inputBox.value }, false);
    }));
    this._register(this._replaceInput.inputBox.onDidHeightChange((e) => {
      if (this._isReplaceVisible && this._tryUpdateHeight()) {
        this._showViewZone();
      }
    }));
    this._register(this._replaceInput.onDidOptionChange(() => {
      this._state.change({
        preserveCase: this._replaceInput.getPreserveCase()
      }, true);
    }));
    this._register(this._replaceInput.onPreserveCaseKeyDown((e) => {
      if (e.equals(KeyCode.Tab)) {
        if (this._prevBtn.isEnabled()) {
          this._prevBtn.focus();
        } else if (this._nextBtn.isEnabled()) {
          this._nextBtn.focus();
        } else if (this._toggleSelectionFind.enabled) {
          this._toggleSelectionFind.focus();
        } else if (this._closeBtn.isEnabled()) {
          this._closeBtn.focus();
        }
        e.preventDefault();
      }
    }));
    const replaceHoverDelegate = this._register(createInstantHoverDelegate());
    this._replaceBtn = this._register(new SimpleButton({
      label: NLS_REPLACE_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.ReplaceOneAction),
      icon: findReplaceIcon,
      hoverDelegate: replaceHoverDelegate,
      onTrigger: () => {
        this._controller.replace();
      },
      onKeyDown: (e) => {
        if (e.equals(KeyMod.Shift | KeyCode.Tab)) {
          this._closeBtn.focus();
          e.preventDefault();
        }
      }
    }, this._hoverService));
    this._replaceAllBtn = this._register(new SimpleButton({
      label: NLS_REPLACE_ALL_BTN_LABEL + this._keybindingLabelFor(FIND_IDS.ReplaceAllAction),
      icon: findReplaceAllIcon,
      hoverDelegate: replaceHoverDelegate,
      onTrigger: () => {
        this._controller.replaceAll();
      }
    }, this._hoverService));
    const replacePart = document.createElement("div");
    replacePart.className = "replace-part";
    replacePart.appendChild(this._replaceInput.domNode);
    const replaceActionsContainer = document.createElement("div");
    replaceActionsContainer.className = "replace-actions";
    replacePart.appendChild(replaceActionsContainer);
    replaceActionsContainer.appendChild(this._replaceBtn.domNode);
    replaceActionsContainer.appendChild(this._replaceAllBtn.domNode);
    this._toggleReplaceBtn = this._register(new SimpleButton({
      label: NLS_TOGGLE_REPLACE_MODE_BTN_LABEL,
      className: "codicon toggle left",
      onTrigger: () => {
        this._state.change({ isReplaceRevealed: !this._isReplaceVisible }, false);
        if (this._isReplaceVisible) {
          this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
          this._replaceInput.inputBox.layout();
        }
        this._showViewZone();
      }
    }, this._hoverService));
    this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
    this._domNode = document.createElement("div");
    this._domNode.className = "editor-widget find-widget";
    this._domNode.setAttribute("aria-hidden", "true");
    this._domNode.ariaLabel = NLS_FIND_DIALOG_LABEL;
    this._domNode.role = "dialog";
    this._domNode.style.width = `${FIND_WIDGET_INITIAL_WIDTH}px`;
    this._domNode.appendChild(this._toggleReplaceBtn.domNode);
    this._domNode.appendChild(findPart);
    this._domNode.appendChild(this._closeBtn.domNode);
    this._domNode.appendChild(replacePart);
    this._resizeSash = this._register(new Sash(this._domNode, this, { orientation: Orientation.VERTICAL, size: 2 }));
    this._resized = false;
    let originalWidth = FIND_WIDGET_INITIAL_WIDTH;
    this._register(this._resizeSash.onDidStart(() => {
      originalWidth = dom.getTotalWidth(this._domNode);
    }));
    this._register(this._resizeSash.onDidChange((evt) => {
      this._resized = true;
      const width = originalWidth + evt.startX - evt.currentX;
      if (width < FIND_WIDGET_INITIAL_WIDTH) {
        return;
      }
      const maxWidth = parseFloat(dom.getComputedStyle(this._domNode).maxWidth) || 0;
      if (width > maxWidth) {
        return;
      }
      this._domNode.style.width = `${width}px`;
      if (this._isReplaceVisible) {
        this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
      }
      this._findInput.inputBox.layout();
      this._tryUpdateHeight();
    }));
    this._register(this._resizeSash.onDidReset(() => {
      const currentWidth = dom.getTotalWidth(this._domNode);
      if (currentWidth < FIND_WIDGET_INITIAL_WIDTH) {
        return;
      }
      let width = FIND_WIDGET_INITIAL_WIDTH;
      if (!this._resized || currentWidth === FIND_WIDGET_INITIAL_WIDTH) {
        const layoutInfo = this._codeEditor.getLayoutInfo();
        width = layoutInfo.width - 28 - layoutInfo.minimap.minimapWidth - 15;
        this._resized = true;
      } else {
      }
      this._domNode.style.width = `${width}px`;
      if (this._isReplaceVisible) {
        this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
      }
      this._findInput.inputBox.layout();
    }));
  }
  updateAccessibilitySupport() {
    const value = this._codeEditor.getOption(EditorOption.accessibilitySupport);
    this._findInput.setFocusInputOnOptionClick(value !== AccessibilitySupport.Enabled);
  }
  getViewState() {
    let widgetViewZoneVisible = false;
    if (this._viewZone && this._viewZoneId) {
      widgetViewZoneVisible = this._viewZone.heightInPx > this._codeEditor.getScrollTop();
    }
    return {
      widgetViewZoneVisible,
      scrollTop: this._codeEditor.getScrollTop()
    };
  }
  setViewState(state) {
    if (!state) {
      return;
    }
    if (state.widgetViewZoneVisible) {
      this._layoutViewZone(state.scrollTop);
    }
  }
};
_FindWidget.ID = "editor.contrib.findWidget";
let FindWidget = _FindWidget;
class SimpleButton extends Widget {
  constructor(opts, hoverService) {
    super();
    this._opts = opts;
    let className = "button";
    if (this._opts.className) {
      className = className + " " + this._opts.className;
    }
    if (this._opts.icon) {
      className = className + " " + ThemeIcon.asClassName(this._opts.icon);
    }
    this._domNode = document.createElement("div");
    this._domNode.tabIndex = 0;
    this._domNode.className = className;
    this._domNode.setAttribute("role", "button");
    this._domNode.setAttribute("aria-label", this._opts.label);
    this._register(hoverService.setupManagedHover(opts.hoverDelegate ?? getDefaultHoverDelegate("element"), this._domNode, this._opts.label));
    this.onclick(this._domNode, (e) => {
      this._opts.onTrigger();
      e.preventDefault();
    });
    this.onkeydown(this._domNode, (e) => {
      if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
        this._opts.onTrigger();
        e.preventDefault();
        return;
      }
      this._opts.onKeyDown?.(e);
    });
  }
  get domNode() {
    return this._domNode;
  }
  isEnabled() {
    return this._domNode.tabIndex >= 0;
  }
  focus() {
    this._domNode.focus();
  }
  setEnabled(enabled) {
    this._domNode.classList.toggle("disabled", !enabled);
    this._domNode.setAttribute("aria-disabled", String(!enabled));
    this._domNode.tabIndex = enabled ? 0 : -1;
  }
  setExpanded(expanded) {
    this._domNode.setAttribute("aria-expanded", String(!!expanded));
    if (expanded) {
      this._domNode.classList.remove(...ThemeIcon.asClassNameArray(findCollapsedIcon));
      this._domNode.classList.add(...ThemeIcon.asClassNameArray(findExpandedIcon));
    } else {
      this._domNode.classList.remove(...ThemeIcon.asClassNameArray(findExpandedIcon));
      this._domNode.classList.add(...ThemeIcon.asClassNameArray(findCollapsedIcon));
    }
  }
}
registerThemingParticipant((theme, collector) => {
  const findMatchHighlightBorder = theme.getColor(editorFindMatchHighlightBorder);
  if (findMatchHighlightBorder) {
    collector.addRule(`.monaco-editor .findMatch { border: 1px ${isHighContrast(theme.type) ? "dotted" : "solid"} ${findMatchHighlightBorder}; box-sizing: border-box; }`);
  }
  const findRangeHighlightBorder = theme.getColor(editorFindRangeHighlightBorder);
  if (findRangeHighlightBorder) {
    collector.addRule(`.monaco-editor .findScope { border: 1px ${isHighContrast(theme.type) ? "dashed" : "solid"} ${findRangeHighlightBorder}; }`);
  }
  const hcBorder = theme.getColor(contrastBorder);
  if (hcBorder) {
    collector.addRule(`.monaco-editor .find-widget { border: 1px solid ${hcBorder}; }`);
  }
  const findMatchForeground = theme.getColor(editorFindMatchForeground);
  if (findMatchForeground) {
    collector.addRule(`.monaco-editor .findMatchInline { color: ${findMatchForeground}; }`);
  }
  const findMatchHighlightForeground = theme.getColor(editorFindMatchHighlightForeground);
  if (findMatchHighlightForeground) {
    collector.addRule(`.monaco-editor .currentFindMatchInline { color: ${findMatchHighlightForeground}; }`);
  }
});
export {
  FindWidget,
  FindWidgetViewZone,
  NLS_MATCHES_LOCATION,
  NLS_NO_RESULTS,
  SimpleButton,
  findNextMatchIcon,
  findPreviousMatchIcon,
  findReplaceAllIcon,
  findReplaceIcon,
  findSelectionIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvZmluZFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgSU1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBhbGVydCBhcyBhbGVydEZuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBUb2dnbGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9jb250ZXh0dmlldy9jb250ZXh0dmlldy5qcyc7XG5pbXBvcnQgeyBGaW5kSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZmluZGlucHV0L2ZpbmRJbnB1dC5qcyc7XG5pbXBvcnQgeyBSZXBsYWNlSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZmluZGlucHV0L3JlcGxhY2VJbnB1dC5qcyc7XG5pbXBvcnQgeyBJTWVzc2FnZSBhcyBJbnB1dEJveE1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgSVNhc2hFdmVudCwgSVZlcnRpY2FsU2FzaExheW91dFByb3ZpZGVyLCBPcmllbnRhdGlvbiwgU2FzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3dpZGdldC5qcyc7XG5pbXBvcnQgeyBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBzdHJpbmdzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICcuL2ZpbmRXaWRnZXQuY3NzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJT3ZlcmxheVdpZGdldCwgSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiwgSVZpZXdab25lLCBPdmVybGF5V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQsIEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IENPTlRFWFRfRklORF9JTlBVVF9GT0NVU0VELCBDT05URVhUX1JFUExBQ0VfSU5QVVRfRk9DVVNFRCwgRklORF9JRFMsIE1BVENIRVNfTElNSVQgfSBmcm9tICcuL2ZpbmRNb2RlbC5qcyc7XG5pbXBvcnQgeyBGaW5kUmVwbGFjZVN0YXRlLCBGaW5kUmVwbGFjZVN0YXRlQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi9maW5kU3RhdGUuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U3VwcG9ydCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgQ29udGV4dFNjb3BlZEZpbmRJbnB1dCwgQ29udGV4dFNjb3BlZFJlcGxhY2VJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hpc3RvcnkvYnJvd3Nlci9jb250ZXh0U2NvcGVkSGlzdG9yeVdpZGdldC5qcyc7XG5pbXBvcnQgeyBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaGlzdG9yeS9icm93c2VyL2hpc3RvcnlXaWRnZXRLZXliaW5kaW5nSGludC5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGNvbnRyYXN0Qm9yZGVyLCBlZGl0b3JGaW5kTWF0Y2hGb3JlZ3JvdW5kLCBlZGl0b3JGaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXIsIGVkaXRvckZpbmRNYXRjaEhpZ2hsaWdodEZvcmVncm91bmQsIGVkaXRvckZpbmRSYW5nZUhpZ2hsaWdodEJvcmRlciwgaW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kLCBpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlciwgaW5wdXRBY3RpdmVPcHRpb25Gb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uLCB3aWRnZXRDbG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSwgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpc0hpZ2hDb250cmFzdCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0SW5wdXRCb3hTdHlsZXMsIGRlZmF1bHRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlLCBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElIaXN0b3J5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGlzdG9yeS5qcyc7XG5cbmNvbnN0IGZpbmRDb2xsYXBzZWRJY29uID0gcmVnaXN0ZXJJY29uKCdmaW5kLWNvbGxhcHNlZCcsIENvZGljb24uY2hldnJvblJpZ2h0LCBubHMubG9jYWxpemUoJ2ZpbmRDb2xsYXBzZWRJY29uJywgJ0ljb24gdG8gaW5kaWNhdGUgdGhhdCB0aGUgZWRpdG9yIGZpbmQgd2lkZ2V0IGlzIGNvbGxhcHNlZC4nKSk7XG5jb25zdCBmaW5kRXhwYW5kZWRJY29uID0gcmVnaXN0ZXJJY29uKCdmaW5kLWV4cGFuZGVkJywgQ29kaWNvbi5jaGV2cm9uRG93biwgbmxzLmxvY2FsaXplKCdmaW5kRXhwYW5kZWRJY29uJywgJ0ljb24gdG8gaW5kaWNhdGUgdGhhdCB0aGUgZWRpdG9yIGZpbmQgd2lkZ2V0IGlzIGV4cGFuZGVkLicpKTtcblxuZXhwb3J0IGNvbnN0IGZpbmRTZWxlY3Rpb25JY29uID0gcmVnaXN0ZXJJY29uKCdmaW5kLXNlbGVjdGlvbicsIENvZGljb24uc2VsZWN0aW9uLCBubHMubG9jYWxpemUoJ2ZpbmRTZWxlY3Rpb25JY29uJywgJ0ljb24gZm9yIFxcJ0ZpbmQgaW4gU2VsZWN0aW9uXFwnIGluIHRoZSBlZGl0b3IgZmluZCB3aWRnZXQuJykpO1xuZXhwb3J0IGNvbnN0IGZpbmRSZXBsYWNlSWNvbiA9IHJlZ2lzdGVySWNvbignZmluZC1yZXBsYWNlJywgQ29kaWNvbi5yZXBsYWNlLCBubHMubG9jYWxpemUoJ2ZpbmRSZXBsYWNlSWNvbicsICdJY29uIGZvciBcXCdSZXBsYWNlXFwnIGluIHRoZSBlZGl0b3IgZmluZCB3aWRnZXQuJykpO1xuZXhwb3J0IGNvbnN0IGZpbmRSZXBsYWNlQWxsSWNvbiA9IHJlZ2lzdGVySWNvbignZmluZC1yZXBsYWNlLWFsbCcsIENvZGljb24ucmVwbGFjZUFsbCwgbmxzLmxvY2FsaXplKCdmaW5kUmVwbGFjZUFsbEljb24nLCAnSWNvbiBmb3IgXFwnUmVwbGFjZSBBbGxcXCcgaW4gdGhlIGVkaXRvciBmaW5kIHdpZGdldC4nKSk7XG5leHBvcnQgY29uc3QgZmluZFByZXZpb3VzTWF0Y2hJY29uID0gcmVnaXN0ZXJJY29uKCdmaW5kLXByZXZpb3VzLW1hdGNoJywgQ29kaWNvbi5hcnJvd1VwLCBubHMubG9jYWxpemUoJ2ZpbmRQcmV2aW91c01hdGNoSWNvbicsICdJY29uIGZvciBcXCdGaW5kIFByZXZpb3VzXFwnIGluIHRoZSBlZGl0b3IgZmluZCB3aWRnZXQuJykpO1xuZXhwb3J0IGNvbnN0IGZpbmROZXh0TWF0Y2hJY29uID0gcmVnaXN0ZXJJY29uKCdmaW5kLW5leHQtbWF0Y2gnLCBDb2RpY29uLmFycm93RG93biwgbmxzLmxvY2FsaXplKCdmaW5kTmV4dE1hdGNoSWNvbicsICdJY29uIGZvciBcXCdGaW5kIE5leHRcXCcgaW4gdGhlIGVkaXRvciBmaW5kIHdpZGdldC4nKSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbmRDb250cm9sbGVyIHtcblx0cmVwbGFjZSgpOiB2b2lkO1xuXHRyZXBsYWNlQWxsKCk6IHZvaWQ7XG5cdGdldEdsb2JhbEJ1ZmZlclRlcm0oKTogUHJvbWlzZTxzdHJpbmc+O1xufVxuXG5jb25zdCBOTFNfRklORF9ESUFMT0dfTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLmZpbmREaWFsb2cnLCBcIkZpbmQgLyBSZXBsYWNlXCIpO1xuY29uc3QgTkxTX0ZJTkRfSU5QVVRfTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLmZpbmQnLCBcIkZpbmRcIik7XG5jb25zdCBOTFNfRklORF9JTlBVVF9QTEFDRUhPTERFUiA9IG5scy5sb2NhbGl6ZSgncGxhY2Vob2xkZXIuZmluZCcsIFwiRmluZFwiKTtcbmNvbnN0IE5MU19QUkVWSU9VU19NQVRDSF9CVE5fTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLnByZXZpb3VzTWF0Y2hCdXR0b24nLCBcIlByZXZpb3VzIE1hdGNoXCIpO1xuY29uc3QgTkxTX05FWFRfTUFUQ0hfQlROX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5uZXh0TWF0Y2hCdXR0b24nLCBcIk5leHQgTWF0Y2hcIik7XG5jb25zdCBOTFNfVE9HR0xFX1NFTEVDVElPTl9GSU5EX1RJVExFID0gbmxzLmxvY2FsaXplKCdsYWJlbC50b2dnbGVTZWxlY3Rpb25GaW5kJywgXCJGaW5kIGluIFNlbGVjdGlvblwiKTtcbmNvbnN0IE5MU19DTE9TRV9CVE5fTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLmNsb3NlQnV0dG9uJywgXCJDbG9zZVwiKTtcbmNvbnN0IE5MU19SRVBMQUNFX0lOUFVUX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5yZXBsYWNlJywgXCJSZXBsYWNlXCIpO1xuY29uc3QgTkxTX1JFUExBQ0VfSU5QVVRfUExBQ0VIT0xERVIgPSBubHMubG9jYWxpemUoJ3BsYWNlaG9sZGVyLnJlcGxhY2UnLCBcIlJlcGxhY2VcIik7XG5jb25zdCBOTFNfUkVQTEFDRV9CVE5fTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLnJlcGxhY2VCdXR0b24nLCBcIlJlcGxhY2VcIik7XG5jb25zdCBOTFNfUkVQTEFDRV9BTExfQlROX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5yZXBsYWNlQWxsQnV0dG9uJywgXCJSZXBsYWNlIEFsbFwiKTtcbmNvbnN0IE5MU19UT0dHTEVfUkVQTEFDRV9NT0RFX0JUTl9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnbGFiZWwudG9nZ2xlUmVwbGFjZUJ1dHRvbicsIFwiVG9nZ2xlIFJlcGxhY2VcIik7XG5jb25zdCBOTFNfTUFUQ0hFU19DT1VOVF9MSU1JVF9USVRMRSA9IG5scy5sb2NhbGl6ZSgndGl0bGUubWF0Y2hlc0NvdW50TGltaXQnLCBcIk9ubHkgdGhlIGZpcnN0IHswfSByZXN1bHRzIGFyZSBoaWdobGlnaHRlZCwgYnV0IGFsbCBmaW5kIG9wZXJhdGlvbnMgd29yayBvbiB0aGUgZW50aXJlIHRleHQuXCIsIE1BVENIRVNfTElNSVQpO1xuZXhwb3J0IGNvbnN0IE5MU19NQVRDSEVTX0xPQ0FUSU9OID0gbmxzLmxvY2FsaXplKCdsYWJlbC5tYXRjaGVzTG9jYXRpb24nLCBcInswfSBvZiB7MX1cIik7XG5leHBvcnQgY29uc3QgTkxTX05PX1JFU1VMVFMgPSBubHMubG9jYWxpemUoJ2xhYmVsLm5vUmVzdWx0cycsIFwiTm8gcmVzdWx0c1wiKTtcblxuY29uc3QgRklORF9XSURHRVRfSU5JVElBTF9XSURUSCA9IDQxOTtcbmNvbnN0IFBBUlRfV0lEVEggPSAyNzU7XG5jb25zdCBGSU5EX0lOUFVUX0FSRUFfV0lEVEggPSBQQVJUX1dJRFRIIC0gNTQ7XG5cbmxldCBNQVhfTUFUQ0hFU19DT1VOVF9XSURUSCA9IDY5O1xuLy8gbGV0IEZJTkRfQUxMX0NPTlRST0xTX1dJRFRIID0gMTcvKiogRmluZCBJbnB1dCBtYXJnaW4tbGVmdCAqLyArIChNQVhfTUFUQ0hFU19DT1VOVF9XSURUSCArIDMgKyAxKSAvKiogTWF0Y2ggUmVzdWx0cyAqLyArIDIzIC8qKiBCdXR0b24gKi8gKiA0ICsgMi8qKiBzYXNoICovO1xuXG5jb25zdCBGSU5EX0lOUFVUX0FSRUFfSEVJR0hUID0gMzM7IC8vIFRoZSBoZWlnaHQgb2YgRmluZCBXaWRnZXQgd2hlbiBSZXBsYWNlIElucHV0IGlzIG5vdCB2aXNpYmxlLlxuY29uc3QgY3RybEVudGVyUmVwbGFjZUFsbFdhcm5pbmdQcm9tcHRlZEtleSA9ICdjdHJsRW50ZXJSZXBsYWNlQWxsLndpbmRvd3MuZG9ub3Rhc2snO1xuXG5jb25zdCBjdHJsS2V5TW9kID0gKHBsYXRmb3JtLmlzTWFjaW50b3NoID8gS2V5TW9kLldpbkN0cmwgOiBLZXlNb2QuQ3RybENtZCk7XG5leHBvcnQgY2xhc3MgRmluZFdpZGdldFZpZXdab25lIGltcGxlbWVudHMgSVZpZXdab25lIHtcblx0cHVibGljIHJlYWRvbmx5IGFmdGVyTGluZU51bWJlcjogbnVtYmVyO1xuXHRwdWJsaWMgaGVpZ2h0SW5QeDogbnVtYmVyO1xuXHRwdWJsaWMgcmVhZG9ubHkgc3VwcHJlc3NNb3VzZURvd246IGJvb2xlYW47XG5cdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudDtcblxuXHRjb25zdHJ1Y3RvcihhZnRlckxpbmVOdW1iZXI6IG51bWJlcikge1xuXHRcdHRoaXMuYWZ0ZXJMaW5lTnVtYmVyID0gYWZ0ZXJMaW5lTnVtYmVyO1xuXG5cdFx0dGhpcy5oZWlnaHRJblB4ID0gRklORF9JTlBVVF9BUkVBX0hFSUdIVDtcblx0XHR0aGlzLnN1cHByZXNzTW91c2VEb3duID0gZmFsc2U7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTmFtZSA9ICdkb2NrLWZpbmQtdmlld3pvbmUnO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbkZvck11bHRpTGluZVVwd2FyZHMoZXZlbnQ6IElLZXlib2FyZEV2ZW50LCB2YWx1ZTogc3RyaW5nLCB0ZXh0YXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGwpIHtcblx0Y29uc3QgaXNNdWx0aWxpbmUgPSAhIXZhbHVlLm1hdGNoKC9cXG4vKTtcblx0aWYgKHRleHRhcmVhICYmIGlzTXVsdGlsaW5lICYmIHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID4gMCkge1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHJldHVybjtcblx0fVxufVxuXG5mdW5jdGlvbiBzdG9wUHJvcGFnYXRpb25Gb3JNdWx0aUxpbmVEb3dud2FyZHMoZXZlbnQ6IElLZXlib2FyZEV2ZW50LCB2YWx1ZTogc3RyaW5nLCB0ZXh0YXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGwpIHtcblx0Y29uc3QgaXNNdWx0aWxpbmUgPSAhIXZhbHVlLm1hdGNoKC9cXG4vKTtcblx0aWYgKHRleHRhcmVhICYmIGlzTXVsdGlsaW5lICYmIHRleHRhcmVhLnNlbGVjdGlvbkVuZCA8IHRleHRhcmVhLnZhbHVlLmxlbmd0aCkge1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdHJldHVybjtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRmluZFdpZGdldCBleHRlbmRzIFdpZGdldCBpbXBsZW1lbnRzIElPdmVybGF5V2lkZ2V0LCBJVmVydGljYWxTYXNoTGF5b3V0UHJvdmlkZXIge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5maW5kV2lkZ2V0Jztcblx0cHJpdmF0ZSByZWFkb25seSBfY29kZUVkaXRvcjogSUNvZGVFZGl0b3I7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0YXRlOiBGaW5kUmVwbGFjZVN0YXRlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250cm9sbGVyOiBJRmluZENvbnRyb2xsZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9rZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZTtcblxuXHRwcml2YXRlIF9kb21Ob2RlITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2NhY2hlZEhlaWdodDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2ZpbmRJbnB1dCE6IEZpbmRJbnB1dDtcblx0cHJpdmF0ZSBfcmVwbGFjZUlucHV0ITogUmVwbGFjZUlucHV0O1xuXG5cdHByaXZhdGUgX3RvZ2dsZVJlcGxhY2VCdG4hOiBTaW1wbGVCdXR0b247XG5cdHByaXZhdGUgX21hdGNoZXNDb3VudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9wcmV2QnRuITogU2ltcGxlQnV0dG9uO1xuXHRwcml2YXRlIF9uZXh0QnRuITogU2ltcGxlQnV0dG9uO1xuXHRwcml2YXRlIF90b2dnbGVTZWxlY3Rpb25GaW5kITogVG9nZ2xlO1xuXHRwcml2YXRlIF9jbG9zZUJ0biE6IFNpbXBsZUJ1dHRvbjtcblx0cHJpdmF0ZSBfcmVwbGFjZUJ0biE6IFNpbXBsZUJ1dHRvbjtcblx0cHJpdmF0ZSBfcmVwbGFjZUFsbEJ0biE6IFNpbXBsZUJ1dHRvbjtcblxuXHRwcml2YXRlIF9pc1Zpc2libGU6IGJvb2xlYW47XG5cdHByaXZhdGUgX2lzUmVwbGFjZVZpc2libGU6IGJvb2xlYW47XG5cdHByaXZhdGUgX2lnbm9yZUNoYW5nZUV2ZW50OiBib29sZWFuO1xuXHRwcml2YXRlIF9jdHJsRW50ZXJSZXBsYWNlQWxsV2FybmluZ1Byb21wdGVkOiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZpbmRGb2N1c1RyYWNrZXI6IGRvbS5JRm9jdXNUcmFja2VyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9maW5kSW5wdXRGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVwbGFjZUZvY3VzVHJhY2tlcjogZG9tLklGb2N1c1RyYWNrZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlcGxhY2VJbnB1dEZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF92aWV3Wm9uZT86IEZpbmRXaWRnZXRWaWV3Wm9uZTtcblx0cHJpdmF0ZSBfdmlld1pvbmVJZD86IHN0cmluZztcblxuXHRwcml2YXRlIF9yZXNpemVTYXNoITogU2FzaDtcblx0cHJpdmF0ZSBfcmVzaXplZCE6IGJvb2xlYW47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3VwZGF0ZUhpc3RvcnlEZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdGNvbnRyb2xsZXI6IElGaW5kQ29udHJvbGxlcixcblx0XHRzdGF0ZTogRmluZFJlcGxhY2VTdGF0ZSxcblx0XHRjb250ZXh0Vmlld1Byb3ZpZGVyOiBJQ29udGV4dFZpZXdQcm92aWRlcixcblx0XHRrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0dGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0bm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2ZpbmRXaWRnZXRTZWFyY2hIaXN0b3J5OiBJSGlzdG9yeTxzdHJpbmc+IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlcGxhY2VXaWRnZXRIaXN0b3J5OiBJSGlzdG9yeTxzdHJpbmc+IHwgdW5kZWZpbmVkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2NvZGVFZGl0b3IgPSBjb2RlRWRpdG9yO1xuXHRcdHRoaXMuX2NvbnRyb2xsZXIgPSBjb250cm9sbGVyO1xuXHRcdHRoaXMuX3N0YXRlID0gc3RhdGU7XG5cdFx0dGhpcy5fY29udGV4dFZpZXdQcm92aWRlciA9IGNvbnRleHRWaWV3UHJvdmlkZXI7XG5cdFx0dGhpcy5fa2V5YmluZGluZ1NlcnZpY2UgPSBrZXliaW5kaW5nU2VydmljZTtcblx0XHR0aGlzLl9jb250ZXh0S2V5U2VydmljZSA9IGNvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlID0gc3RvcmFnZVNlcnZpY2U7XG5cdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZSA9IG5vdGlmaWNhdGlvblNlcnZpY2U7XG5cblx0XHR0aGlzLl9jdHJsRW50ZXJSZXBsYWNlQWxsV2FybmluZ1Byb21wdGVkID0gISFzdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKGN0cmxFbnRlclJlcGxhY2VBbGxXYXJuaW5nUHJvbXB0ZWRLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblxuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IGZhbHNlO1xuXHRcdHRoaXMuX2lzUmVwbGFjZVZpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLl9pZ25vcmVDaGFuZ2VFdmVudCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5fdXBkYXRlSGlzdG9yeURlbGF5ZXIgPSBuZXcgRGVsYXllcjx2b2lkPig1MDApO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl91cGRhdGVIaXN0b3J5RGVsYXllci5jYW5jZWwoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3N0YXRlLm9uRmluZFJlcGxhY2VTdGF0ZUNoYW5nZSgoZSkgPT4gdGhpcy5fb25TdGF0ZUNoYW5nZWQoZSkpKTtcblx0XHR0aGlzLl9idWlsZERvbU5vZGUoKTtcblx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cdFx0dGhpcy5fdHJ5VXBkYXRlV2lkZ2V0V2lkdGgoKTtcblx0XHR0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3gubGF5b3V0KCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb2RlRWRpdG9yLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZTogQ29uZmlndXJhdGlvbkNoYW5nZWRFdmVudCkgPT4ge1xuXHRcdFx0aWYgKGUuaGFzQ2hhbmdlZChFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9jb2RlRWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24ucmVhZE9ubHkpKSB7XG5cdFx0XHRcdFx0Ly8gSGlkZSByZXBsYWNlIHBhcnQgaWYgZWRpdG9yIGJlY29tZXMgcmVhZCBvbmx5XG5cdFx0XHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgaXNSZXBsYWNlUmV2ZWFsZWQ6IGZhbHNlIH0sIGZhbHNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5sYXlvdXRJbmZvKSkge1xuXHRcdFx0XHR0aGlzLl90cnlVcGRhdGVXaWRnZXRXaWR0aCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5hY2Nlc3NpYmlsaXR5U3VwcG9ydCkpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVBY2Nlc3NpYmlsaXR5U3VwcG9ydCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5maW5kKSkge1xuXHRcdFx0XHRjb25zdCBzdXBwb3J0TG9vcCA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5sb29wO1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBsb29wOiBzdXBwb3J0TG9vcCB9LCBmYWxzZSk7XG5cdFx0XHRcdGNvbnN0IGFkZEV4dHJhU3BhY2VPblRvcCA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5hZGRFeHRyYVNwYWNlT25Ub3A7XG5cdFx0XHRcdGlmIChhZGRFeHRyYVNwYWNlT25Ub3AgJiYgIXRoaXMuX3ZpZXdab25lKSB7XG5cdFx0XHRcdFx0dGhpcy5fdmlld1pvbmUgPSBuZXcgRmluZFdpZGdldFZpZXdab25lKDApO1xuXHRcdFx0XHRcdHRoaXMuX3Nob3dWaWV3Wm9uZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghYWRkRXh0cmFTcGFjZU9uVG9wICYmIHRoaXMuX3ZpZXdab25lKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVtb3ZlVmlld1pvbmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnVwZGF0ZUFjY2Vzc2liaWxpdHlTdXBwb3J0KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVRvZ2dsZVNlbGVjdGlvbkZpbmRCdXR0b24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvci5vbkRpZEZvY3VzRWRpdG9yV2lkZ2V0KGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdFx0Y29uc3QgZ2xvYmFsQnVmZmVyVGVybSA9IGF3YWl0IHRoaXMuX2NvbnRyb2xsZXIuZ2V0R2xvYmFsQnVmZmVyVGVybSgpO1xuXHRcdFx0XHRpZiAoZ2xvYmFsQnVmZmVyVGVybSAmJiBnbG9iYWxCdWZmZXJUZXJtICE9PSB0aGlzLl9zdGF0ZS5zZWFyY2hTdHJpbmcpIHtcblx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6IGdsb2JhbEJ1ZmZlclRlcm0gfSwgZmFsc2UpO1xuXHRcdFx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZWxlY3QoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9maW5kSW5wdXRGb2N1c2VkID0gQ09OVEVYVF9GSU5EX0lOUFVUX0ZPQ1VTRUQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9maW5kRm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5fZmluZElucHV0LmlucHV0Qm94LmlucHV0RWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRGb2N1c1RyYWNrZXIub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXRGb2N1c2VkLnNldCh0cnVlKTtcblx0XHRcdHRoaXMuX3VwZGF0ZVNlYXJjaFNjb3BlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRGb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dEZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZXBsYWNlSW5wdXRGb2N1c2VkID0gQ09OVEVYVF9SRVBMQUNFX0lOUFVUX0ZPQ1VTRUQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZXBsYWNlRm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94LmlucHV0RWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3JlcGxhY2VGb2N1c1RyYWNrZXIub25EaWRGb2N1cygoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXRGb2N1c2VkLnNldCh0cnVlKTtcblx0XHRcdHRoaXMuX3VwZGF0ZVNlYXJjaFNjb3BlKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3JlcGxhY2VGb2N1c1RyYWNrZXIub25EaWRCbHVyKCgpID0+IHtcblx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dEZvY3VzZWQuc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb2RlRWRpdG9yLmFkZE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cdFx0aWYgKHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5hZGRFeHRyYVNwYWNlT25Ub3ApIHtcblx0XHRcdHRoaXMuX3ZpZXdab25lID0gbmV3IEZpbmRXaWRnZXRWaWV3Wm9uZSgwKTsgLy8gUHV0IGl0IGJlZm9yZSB0aGUgZmlyc3QgbGluZSB0aGVuIHVzZXJzIGNhbiBzY3JvbGwgYmV5b25kIHRoZSBmaXJzdCBsaW5lLlxuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvZGVFZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl92aWV3Wm9uZUlkID0gdW5kZWZpbmVkO1xuXHRcdH0pKTtcblxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29kZUVkaXRvci5vbkRpZFNjcm9sbENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUuc2Nyb2xsVG9wQ2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRWaWV3Wm9uZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIGZvciBvdGhlciBzY3JvbGwgY2hhbmdlcywgbGF5b3V0IHRoZSB2aWV3em9uZSBpbiBuZXh0IHRpY2sgdG8gYXZvaWQgcnVpbmluZyBjdXJyZW50IHJlbmRlcmluZy5cblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9sYXlvdXRWaWV3Wm9uZSgpO1xuXHRcdFx0fSwgMCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tLS0gSU92ZXJsYXlXaWRnZXQgQVBJXG5cblx0cHVibGljIGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEZpbmRXaWRnZXQuSUQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0UG9zaXRpb24oKTogSU92ZXJsYXlXaWRnZXRQb3NpdGlvbiB8IG51bGwge1xuXHRcdGlmICh0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHByZWZlcmVuY2U6IE92ZXJsYXlXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuVE9QX1JJR0hUX0NPUk5FUlxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHQvLyAtLS0tLSBSZWFjdCB0byBzdGF0ZSBjaGFuZ2VzXG5cblx0cHJpdmF0ZSBfb25TdGF0ZUNoYW5nZWQoZTogRmluZFJlcGxhY2VTdGF0ZUNoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdGlmIChlLnNlYXJjaFN0cmluZykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5faWdub3JlQ2hhbmdlRXZlbnQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9maW5kSW5wdXQuc2V0VmFsdWUodGhpcy5fc3RhdGUuc2VhcmNoU3RyaW5nKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuX2lnbm9yZUNoYW5nZUV2ZW50ID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cdFx0fVxuXHRcdGlmIChlLnJlcGxhY2VTdHJpbmcpIHtcblx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5pbnB1dEJveC52YWx1ZSA9IHRoaXMuX3N0YXRlLnJlcGxhY2VTdHJpbmc7XG5cdFx0fVxuXHRcdGlmIChlLmlzUmV2ZWFsZWQpIHtcblx0XHRcdGlmICh0aGlzLl9zdGF0ZS5pc1JldmVhbGVkKSB7XG5cdFx0XHRcdHRoaXMuX3JldmVhbCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5faGlkZSh0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGUuaXNSZXBsYWNlUmV2ZWFsZWQpIHtcblx0XHRcdGlmICh0aGlzLl9zdGF0ZS5pc1JlcGxhY2VSZXZlYWxlZCkge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSkgJiYgIXRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLl9pc1JlcGxhY2VWaXNpYmxlID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQud2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSk7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlQnV0dG9ucygpO1xuXHRcdFx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5pbnB1dEJveC5sYXlvdXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLl9pc1JlcGxhY2VWaXNpYmxlID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlQnV0dG9ucygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICgoZS5pc1JldmVhbGVkIHx8IGUuaXNSZXBsYWNlUmV2ZWFsZWQpICYmICh0aGlzLl9zdGF0ZS5pc1JldmVhbGVkIHx8IHRoaXMuX3N0YXRlLmlzUmVwbGFjZVJldmVhbGVkKSkge1xuXHRcdFx0aWYgKHRoaXMuX3RyeVVwZGF0ZUhlaWdodCgpKSB7XG5cdFx0XHRcdHRoaXMuX3Nob3dWaWV3Wm9uZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChlLmlzUmVnZXgpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRSZWdleCh0aGlzLl9zdGF0ZS5pc1JlZ2V4KTtcblx0XHR9XG5cdFx0aWYgKGUud2hvbGVXb3JkKSB7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2V0V2hvbGVXb3Jkcyh0aGlzLl9zdGF0ZS53aG9sZVdvcmQpO1xuXHRcdH1cblx0XHRpZiAoZS5tYXRjaENhc2UpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRDYXNlU2Vuc2l0aXZlKHRoaXMuX3N0YXRlLm1hdGNoQ2FzZSk7XG5cdFx0fVxuXHRcdGlmIChlLnByZXNlcnZlQ2FzZSkge1xuXHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LnNldFByZXNlcnZlQ2FzZSh0aGlzLl9zdGF0ZS5wcmVzZXJ2ZUNhc2UpO1xuXHRcdH1cblx0XHRpZiAoZS5zZWFyY2hTY29wZSkge1xuXHRcdFx0aWYgKHRoaXMuX3N0YXRlLnNlYXJjaFNjb3BlKSB7XG5cdFx0XHRcdHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuY2hlY2tlZCA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90b2dnbGVTZWxlY3Rpb25GaW5kLmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3VwZGF0ZVRvZ2dsZVNlbGVjdGlvbkZpbmRCdXR0b24oKTtcblx0XHR9XG5cdFx0aWYgKGUuc2VhcmNoU3RyaW5nIHx8IGUubWF0Y2hlc0NvdW50IHx8IGUubWF0Y2hlc1Bvc2l0aW9uKSB7XG5cdFx0XHRjb25zdCBzaG93UmVkT3V0bGluZSA9ICh0aGlzLl9zdGF0ZS5zZWFyY2hTdHJpbmcubGVuZ3RoID4gMCAmJiB0aGlzLl9zdGF0ZS5tYXRjaGVzQ291bnQgPT09IDApO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCduby1yZXN1bHRzJywgc2hvd1JlZE91dGxpbmUpO1xuXG5cdFx0XHR0aGlzLl91cGRhdGVNYXRjaGVzQ291bnQoKTtcblx0XHRcdHRoaXMuX3VwZGF0ZUJ1dHRvbnMoKTtcblx0XHR9XG5cdFx0aWYgKGUuc2VhcmNoU3RyaW5nIHx8IGUuY3VycmVudE1hdGNoKSB7XG5cdFx0XHR0aGlzLl9sYXlvdXRWaWV3Wm9uZSgpO1xuXHRcdH1cblx0XHRpZiAoZS51cGRhdGVIaXN0b3J5KSB7XG5cdFx0XHR0aGlzLl9kZWxheWVkVXBkYXRlSGlzdG9yeSgpO1xuXHRcdH1cblx0XHRpZiAoZS5sb29wKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZGVsYXllZFVwZGF0ZUhpc3RvcnkoKSB7XG5cdFx0dGhpcy5fdXBkYXRlSGlzdG9yeURlbGF5ZXIudHJpZ2dlcih0aGlzLl91cGRhdGVIaXN0b3J5LmJpbmQodGhpcykpLnRoZW4odW5kZWZpbmVkLCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVIaXN0b3J5KCkge1xuXHRcdGlmICh0aGlzLl9zdGF0ZS5zZWFyY2hTdHJpbmcpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5pbnB1dEJveC5hZGRUb0hpc3RvcnkoKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3N0YXRlLnJlcGxhY2VTdHJpbmcpIHtcblx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5pbnB1dEJveC5hZGRUb0hpc3RvcnkoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVNYXRjaGVzQ291bnQoKTogdm9pZCB7XG5cdFx0dGhpcy5fbWF0Y2hlc0NvdW50LnN0eWxlLm1pbldpZHRoID0gTUFYX01BVENIRVNfQ09VTlRfV0lEVEggKyAncHgnO1xuXHRcdGlmICh0aGlzLl9zdGF0ZS5tYXRjaGVzQ291bnQgPj0gTUFUQ0hFU19MSU1JVCkge1xuXHRcdFx0dGhpcy5fbWF0Y2hlc0NvdW50LnRpdGxlID0gTkxTX01BVENIRVNfQ09VTlRfTElNSVRfVElUTEU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX21hdGNoZXNDb3VudC50aXRsZSA9ICcnO1xuXHRcdH1cblxuXHRcdC8vIHJlbW92ZSBwcmV2aW91cyBjb250ZW50XG5cdFx0dGhpcy5fbWF0Y2hlc0NvdW50LmZpcnN0Q2hpbGQ/LnJlbW92ZSgpO1xuXG5cdFx0bGV0IGxhYmVsOiBzdHJpbmc7XG5cdFx0aWYgKHRoaXMuX3N0YXRlLm1hdGNoZXNDb3VudCA+IDApIHtcblx0XHRcdGxldCBtYXRjaGVzQ291bnQ6IHN0cmluZyA9IFN0cmluZyh0aGlzLl9zdGF0ZS5tYXRjaGVzQ291bnQpO1xuXHRcdFx0aWYgKHRoaXMuX3N0YXRlLm1hdGNoZXNDb3VudCA+PSBNQVRDSEVTX0xJTUlUKSB7XG5cdFx0XHRcdG1hdGNoZXNDb3VudCArPSAnKyc7XG5cdFx0XHR9XG5cdFx0XHRsZXQgbWF0Y2hlc1Bvc2l0aW9uOiBzdHJpbmcgPSBTdHJpbmcodGhpcy5fc3RhdGUubWF0Y2hlc1Bvc2l0aW9uKTtcblx0XHRcdGlmIChtYXRjaGVzUG9zaXRpb24gPT09ICcwJykge1xuXHRcdFx0XHRtYXRjaGVzUG9zaXRpb24gPSAnPyc7XG5cdFx0XHR9XG5cdFx0XHRsYWJlbCA9IHN0cmluZ3MuZm9ybWF0KE5MU19NQVRDSEVTX0xPQ0FUSU9OLCBtYXRjaGVzUG9zaXRpb24sIG1hdGNoZXNDb3VudCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxhYmVsID0gTkxTX05PX1JFU1VMVFM7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbWF0Y2hlc0NvdW50LmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGxhYmVsKSk7XG5cblx0XHRhbGVydEZuKHRoaXMuX2dldEFyaWFMYWJlbChsYWJlbCwgdGhpcy5fc3RhdGUuY3VycmVudE1hdGNoLCB0aGlzLl9zdGF0ZS5zZWFyY2hTdHJpbmcpKTtcblx0XHRNQVhfTUFUQ0hFU19DT1VOVF9XSURUSCA9IE1hdGgubWF4KE1BWF9NQVRDSEVTX0NPVU5UX1dJRFRILCB0aGlzLl9tYXRjaGVzQ291bnQuY2xpZW50V2lkdGgpO1xuXHR9XG5cblx0Ly8gLS0tLS0gYWN0aW9uc1xuXG5cdHByaXZhdGUgX2dldEFyaWFMYWJlbChsYWJlbDogc3RyaW5nLCBjdXJyZW50TWF0Y2g6IFJhbmdlIHwgbnVsbCwgc2VhcmNoU3RyaW5nOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGlmIChsYWJlbCA9PT0gTkxTX05PX1JFU1VMVFMpIHtcblx0XHRcdHJldHVybiBzZWFyY2hTdHJpbmcgPT09ICcnXG5cdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdhcmlhU2VhcmNoTm9SZXN1bHRFbXB0eScsIFwiezB9IGZvdW5kXCIsIGxhYmVsKVxuXHRcdFx0XHQ6IG5scy5sb2NhbGl6ZSgnYXJpYVNlYXJjaE5vUmVzdWx0JywgXCJ7MH0gZm91bmQgZm9yICd7MX0nXCIsIGxhYmVsLCBzZWFyY2hTdHJpbmcpO1xuXHRcdH1cblx0XHRpZiAoY3VycmVudE1hdGNoKSB7XG5cdFx0XHRjb25zdCBhcmlhTGFiZWwgPSBubHMubG9jYWxpemUoJ2FyaWFTZWFyY2hOb1Jlc3VsdFdpdGhMaW5lTnVtJywgXCJ7MH0gZm91bmQgZm9yICd7MX0nLCBhdCB7Mn1cIiwgbGFiZWwsIHNlYXJjaFN0cmluZywgY3VycmVudE1hdGNoLnN0YXJ0TGluZU51bWJlciArICc6JyArIGN1cnJlbnRNYXRjaC5zdGFydENvbHVtbik7XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmIChtb2RlbCAmJiAoY3VycmVudE1hdGNoLnN0YXJ0TGluZU51bWJlciA8PSBtb2RlbC5nZXRMaW5lQ291bnQoKSkgJiYgKGN1cnJlbnRNYXRjaC5zdGFydExpbmVOdW1iZXIgPj0gMSkpIHtcblx0XHRcdFx0Y29uc3QgbGluZUNvbnRlbnQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChjdXJyZW50TWF0Y2guc3RhcnRMaW5lTnVtYmVyKTtcblx0XHRcdFx0cmV0dXJuIGAke2xpbmVDb250ZW50fSwgJHthcmlhTGFiZWx9YDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGFyaWFMYWJlbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdhcmlhU2VhcmNoTm9SZXN1bHRXaXRoTGluZU51bU5vQ3VycmVudE1hdGNoJywgXCJ7MH0gZm91bmQgZm9yICd7MX0nXCIsIGxhYmVsLCBzZWFyY2hTdHJpbmcpO1xuXHR9XG5cblx0LyoqXG5cdCAqIElmICdzZWxlY3Rpb24gZmluZCcgaXMgT04gd2Ugc2hvdWxkIG5vdCBkaXNhYmxlIHRoZSBidXR0b24gKGl0cyBmdW5jdGlvbiBpcyB0byBjYW5jZWwgJ3NlbGVjdGlvbiBmaW5kJykuXG5cdCAqIElmICdzZWxlY3Rpb24gZmluZCcgaXMgT0ZGIHdlIGVuYWJsZSB0aGUgYnV0dG9uIG9ubHkgaWYgdGhlcmUgaXMgYSBzZWxlY3Rpb24uXG5cdCAqL1xuXHRwcml2YXRlIF91cGRhdGVUb2dnbGVTZWxlY3Rpb25GaW5kQnV0dG9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0Y29uc3QgaXNTZWxlY3Rpb24gPSBzZWxlY3Rpb24gPyAoc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciAhPT0gc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgfHwgc2VsZWN0aW9uLnN0YXJ0Q29sdW1uICE9PSBzZWxlY3Rpb24uZW5kQ29sdW1uKSA6IGZhbHNlO1xuXHRcdGNvbnN0IGlzQ2hlY2tlZCA9IHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuY2hlY2tlZDtcblxuXHRcdGlmICh0aGlzLl9pc1Zpc2libGUgJiYgKGlzQ2hlY2tlZCB8fCBpc1NlbGVjdGlvbikpIHtcblx0XHRcdHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuZW5hYmxlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuZGlzYWJsZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUJ1dHRvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fZmluZElucHV0LnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlKTtcblx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuc2V0RW5hYmxlZCh0aGlzLl9pc1Zpc2libGUgJiYgdGhpcy5faXNSZXBsYWNlVmlzaWJsZSk7XG5cdFx0dGhpcy5fdXBkYXRlVG9nZ2xlU2VsZWN0aW9uRmluZEJ1dHRvbigpO1xuXHRcdHRoaXMuX2Nsb3NlQnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlKTtcblxuXHRcdGNvbnN0IGZpbmRJbnB1dElzTm9uRW1wdHkgPSAodGhpcy5fc3RhdGUuc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApO1xuXHRcdGNvbnN0IG1hdGNoZXNDb3VudCA9IHRoaXMuX3N0YXRlLm1hdGNoZXNDb3VudCA/IHRydWUgOiBmYWxzZTtcblx0XHR0aGlzLl9wcmV2QnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIGZpbmRJbnB1dElzTm9uRW1wdHkgJiYgbWF0Y2hlc0NvdW50ICYmIHRoaXMuX3N0YXRlLmNhbk5hdmlnYXRlQmFjaygpKTtcblx0XHR0aGlzLl9uZXh0QnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIGZpbmRJbnB1dElzTm9uRW1wdHkgJiYgbWF0Y2hlc0NvdW50ICYmIHRoaXMuX3N0YXRlLmNhbk5hdmlnYXRlRm9yd2FyZCgpKTtcblx0XHR0aGlzLl9yZXBsYWNlQnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIHRoaXMuX2lzUmVwbGFjZVZpc2libGUgJiYgZmluZElucHV0SXNOb25FbXB0eSk7XG5cdFx0dGhpcy5fcmVwbGFjZUFsbEJ0bi5zZXRFbmFibGVkKHRoaXMuX2lzVmlzaWJsZSAmJiB0aGlzLl9pc1JlcGxhY2VWaXNpYmxlICYmIGZpbmRJbnB1dElzTm9uRW1wdHkpO1xuXG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdyZXBsYWNlVG9nZ2xlZCcsIHRoaXMuX2lzUmVwbGFjZVZpc2libGUpO1xuXHRcdHRoaXMuX3RvZ2dsZVJlcGxhY2VCdG4uc2V0RXhwYW5kZWQodGhpcy5faXNSZXBsYWNlVmlzaWJsZSk7XG5cblx0XHRjb25zdCBjYW5SZXBsYWNlID0gIXRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5yZWFkT25seSk7XG5cdFx0dGhpcy5fdG9nZ2xlUmVwbGFjZUJ0bi5zZXRFbmFibGVkKHRoaXMuX2lzVmlzaWJsZSAmJiBjYW5SZXBsYWNlKTtcblx0fVxuXG5cdHByaXZhdGUgX3JldmVhbFRpbWVvdXRzOiBhbnlbXSA9IFtdO1xuXG5cdHByaXZhdGUgX3JldmVhbCgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXZlYWxUaW1lb3V0cy5mb3JFYWNoKGUgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KGUpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fcmV2ZWFsVGltZW91dHMgPSBbXTtcblxuXHRcdGlmICghdGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9pc1Zpc2libGUgPSB0cnVlO1xuXG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLl9jb2RlRWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXG5cdFx0XHRzd2l0Y2ggKHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5hdXRvRmluZEluU2VsZWN0aW9uKSB7XG5cdFx0XHRcdGNhc2UgJ2Fsd2F5cyc6XG5cdFx0XHRcdFx0dGhpcy5fdG9nZ2xlU2VsZWN0aW9uRmluZC5jaGVja2VkID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnbmV2ZXInOlxuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuY2hlY2tlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdtdWx0aWxpbmUnOiB7XG5cdFx0XHRcdFx0Y29uc3QgaXNTZWxlY3Rpb25NdWx0aXBsZUxpbmUgPSAhIXNlbGVjdGlvbiAmJiBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyICE9PSBzZWxlY3Rpb24uZW5kTGluZU51bWJlcjtcblx0XHRcdFx0XHR0aGlzLl90b2dnbGVTZWxlY3Rpb25GaW5kLmNoZWNrZWQgPSBpc1NlbGVjdGlvbk11bHRpcGxlTGluZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl90cnlVcGRhdGVXaWRnZXRXaWR0aCgpO1xuXHRcdFx0dGhpcy5fdXBkYXRlQnV0dG9ucygpO1xuXG5cdFx0XHR0aGlzLl9yZXZlYWxUaW1lb3V0cy5wdXNoKHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3Zpc2libGUnKTtcblx0XHRcdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cdFx0XHR9LCAwKSk7XG5cblx0XHRcdC8vIHZhbGlkYXRlIHF1ZXJ5IGFnYWluIGFzIGl0J3MgYmVpbmcgZGlzbWlzc2VkIHdoZW4gd2UgaGlkZSB0aGUgZmluZCB3aWRnZXQuXG5cdFx0XHR0aGlzLl9yZXZlYWxUaW1lb3V0cy5wdXNoKHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9maW5kSW5wdXQudmFsaWRhdGUoKTtcblx0XHRcdH0sIDIwMCkpO1xuXG5cdFx0XHR0aGlzLl9jb2RlRWRpdG9yLmxheW91dE92ZXJsYXlXaWRnZXQodGhpcyk7XG5cblx0XHRcdGxldCBhZGp1c3RFZGl0b3JTY3JvbGxUb3AgPSB0cnVlO1xuXHRcdFx0aWYgKHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiAmJiBzZWxlY3Rpb24pIHtcblx0XHRcdFx0Y29uc3QgZG9tTm9kZSA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0RG9tTm9kZSgpO1xuXHRcdFx0XHRpZiAoZG9tTm9kZSkge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvckNvb3JkcyA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKGRvbU5vZGUpO1xuXHRcdFx0XHRcdGNvbnN0IHN0YXJ0Q29vcmRzID0gdGhpcy5fY29kZUVkaXRvci5nZXRTY3JvbGxlZFZpc2libGVQb3NpdGlvbihzZWxlY3Rpb24uZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdFx0XHRjb25zdCBzdGFydExlZnQgPSBlZGl0b3JDb29yZHMubGVmdCArIChzdGFydENvb3JkcyA/IHN0YXJ0Q29vcmRzLmxlZnQgOiAwKTtcblx0XHRcdFx0XHRjb25zdCBzdGFydFRvcCA9IHN0YXJ0Q29vcmRzID8gc3RhcnRDb29yZHMudG9wIDogMDtcblxuXHRcdFx0XHRcdGlmICh0aGlzLl92aWV3Wm9uZSAmJiBzdGFydFRvcCA8IHRoaXMuX3ZpZXdab25lLmhlaWdodEluUHgpIHtcblx0XHRcdFx0XHRcdGlmIChzZWxlY3Rpb24uZW5kTGluZU51bWJlciA+IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0YWRqdXN0RWRpdG9yU2Nyb2xsVG9wID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IGxlZnRPZkZpbmRXaWRnZXQgPSBkb20uZ2V0VG9wTGVmdE9mZnNldCh0aGlzLl9kb21Ob2RlKS5sZWZ0O1xuXHRcdFx0XHRcdFx0aWYgKHN0YXJ0TGVmdCA+IGxlZnRPZkZpbmRXaWRnZXQpIHtcblx0XHRcdFx0XHRcdFx0YWRqdXN0RWRpdG9yU2Nyb2xsVG9wID0gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjb25zdCBlbmRDb29yZHMgPSB0aGlzLl9jb2RlRWRpdG9yLmdldFNjcm9sbGVkVmlzaWJsZVBvc2l0aW9uKHNlbGVjdGlvbi5nZXRFbmRQb3NpdGlvbigpKTtcblx0XHRcdFx0XHRcdGNvbnN0IGVuZExlZnQgPSBlZGl0b3JDb29yZHMubGVmdCArIChlbmRDb29yZHMgPyBlbmRDb29yZHMubGVmdCA6IDApO1xuXHRcdFx0XHRcdFx0aWYgKGVuZExlZnQgPiBsZWZ0T2ZGaW5kV2lkZ2V0KSB7XG5cdFx0XHRcdFx0XHRcdGFkanVzdEVkaXRvclNjcm9sbFRvcCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc2hvd1ZpZXdab25lKGFkanVzdEVkaXRvclNjcm9sbFRvcCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfaGlkZShmb2N1c1RoZUVkaXRvcjogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3JldmVhbFRpbWVvdXRzLmZvckVhY2goZSA9PiB7XG5cdFx0XHRjbGVhclRpbWVvdXQoZSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZXZlYWxUaW1lb3V0cyA9IFtdO1xuXG5cdFx0aWYgKHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5faXNWaXNpYmxlID0gZmFsc2U7XG5cblx0XHRcdHRoaXMuX3VwZGF0ZUJ1dHRvbnMoKTtcblxuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy5fZmluZElucHV0LmNsZWFyTWVzc2FnZSgpO1xuXHRcdFx0aWYgKGZvY3VzVGhlRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuX2NvZGVFZGl0b3IuZm9jdXMoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2NvZGVFZGl0b3IubGF5b3V0T3ZlcmxheVdpZGdldCh0aGlzKTtcblx0XHRcdHRoaXMuX3JlbW92ZVZpZXdab25lKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbGF5b3V0Vmlld1pvbmUodGFyZ2V0U2Nyb2xsVG9wPzogbnVtYmVyKSB7XG5cdFx0Y29uc3QgYWRkRXh0cmFTcGFjZU9uVG9wID0gdGhpcy5fY29kZUVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmFkZEV4dHJhU3BhY2VPblRvcDtcblxuXHRcdGlmICghYWRkRXh0cmFTcGFjZU9uVG9wKSB7XG5cdFx0XHR0aGlzLl9yZW1vdmVWaWV3Wm9uZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHZpZXdab25lID0gdGhpcy5fdmlld1pvbmU7XG5cdFx0aWYgKHRoaXMuX3ZpZXdab25lSWQgIT09IHVuZGVmaW5lZCB8fCAhdmlld1pvbmUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jb2RlRWRpdG9yLmNoYW5nZVZpZXdab25lcygoYWNjZXNzb3IpID0+IHtcblx0XHRcdHZpZXdab25lLmhlaWdodEluUHggPSB0aGlzLl9nZXRIZWlnaHQoKTtcblx0XHRcdHRoaXMuX3ZpZXdab25lSWQgPSBhY2Nlc3Nvci5hZGRab25lKHZpZXdab25lKTtcblx0XHRcdC8vIHNjcm9sbCB0b3AgYWRqdXN0IHRvIG1ha2Ugc3VyZSB0aGUgZWRpdG9yIGRvZXNuJ3Qgc2Nyb2xsIHdoZW4gYWRkaW5nIHZpZXd6b25lIGF0IHRoZSBiZWdpbm5pbmcuXG5cdFx0XHR0aGlzLl9jb2RlRWRpdG9yLnNldFNjcm9sbFRvcCh0YXJnZXRTY3JvbGxUb3AgfHwgdGhpcy5fY29kZUVkaXRvci5nZXRTY3JvbGxUb3AoKSArIHZpZXdab25lLmhlaWdodEluUHgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd1ZpZXdab25lKGFkanVzdFNjcm9sbDogYm9vbGVhbiA9IHRydWUpIHtcblx0XHRpZiAoIXRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFkZEV4dHJhU3BhY2VPblRvcCA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5maW5kKS5hZGRFeHRyYVNwYWNlT25Ub3A7XG5cblx0XHRpZiAoIWFkZEV4dHJhU3BhY2VPblRvcCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl92aWV3Wm9uZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl92aWV3Wm9uZSA9IG5ldyBGaW5kV2lkZ2V0Vmlld1pvbmUoMCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgdmlld1pvbmUgPSB0aGlzLl92aWV3Wm9uZTtcblxuXHRcdHRoaXMuX2NvZGVFZGl0b3IuY2hhbmdlVmlld1pvbmVzKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3ZpZXdab25lSWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHQvLyB0aGUgdmlldyB6b25lIGFscmVhZHkgZXhpc3RzLCB3ZSBuZWVkIHRvIHVwZGF0ZSB0aGUgaGVpZ2h0XG5cdFx0XHRcdGNvbnN0IG5ld0hlaWdodCA9IHRoaXMuX2dldEhlaWdodCgpO1xuXHRcdFx0XHRpZiAobmV3SGVpZ2h0ID09PSB2aWV3Wm9uZS5oZWlnaHRJblB4KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2Nyb2xsQWRqdXN0bWVudCA9IG5ld0hlaWdodCAtIHZpZXdab25lLmhlaWdodEluUHg7XG5cdFx0XHRcdHZpZXdab25lLmhlaWdodEluUHggPSBuZXdIZWlnaHQ7XG5cdFx0XHRcdGFjY2Vzc29yLmxheW91dFpvbmUodGhpcy5fdmlld1pvbmVJZCk7XG5cblx0XHRcdFx0aWYgKGFkanVzdFNjcm9sbCkge1xuXHRcdFx0XHRcdHRoaXMuX2NvZGVFZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuX2NvZGVFZGl0b3IuZ2V0U2Nyb2xsVG9wKCkgKyBzY3JvbGxBZGp1c3RtZW50KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxldCBzY3JvbGxBZGp1c3RtZW50ID0gdGhpcy5fZ2V0SGVpZ2h0KCk7XG5cblx0XHRcdFx0Ly8gaWYgdGhlIGVkaXRvciBoYXMgdG9wIHBhZGRpbmcsIGZhY3RvciB0aGF0IGludG8gdGhlIHpvbmUgaGVpZ2h0XG5cdFx0XHRcdHNjcm9sbEFkanVzdG1lbnQgLT0gdGhpcy5fY29kZUVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnBhZGRpbmcpLnRvcDtcblx0XHRcdFx0aWYgKHNjcm9sbEFkanVzdG1lbnQgPD0gMCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZpZXdab25lLmhlaWdodEluUHggPSBzY3JvbGxBZGp1c3RtZW50O1xuXHRcdFx0XHR0aGlzLl92aWV3Wm9uZUlkID0gYWNjZXNzb3IuYWRkWm9uZSh2aWV3Wm9uZSk7XG5cblx0XHRcdFx0aWYgKGFkanVzdFNjcm9sbCkge1xuXHRcdFx0XHRcdHRoaXMuX2NvZGVFZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuX2NvZGVFZGl0b3IuZ2V0U2Nyb2xsVG9wKCkgKyBzY3JvbGxBZGp1c3RtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlVmlld1pvbmUoKSB7XG5cdFx0dGhpcy5fY29kZUVkaXRvci5jaGFuZ2VWaWV3Wm9uZXMoKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fdmlld1pvbmVJZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGFjY2Vzc29yLnJlbW92ZVpvbmUodGhpcy5fdmlld1pvbmVJZCk7XG5cdFx0XHRcdHRoaXMuX3ZpZXdab25lSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICh0aGlzLl92aWV3Wm9uZSkge1xuXHRcdFx0XHRcdHRoaXMuX2NvZGVFZGl0b3Iuc2V0U2Nyb2xsVG9wKHRoaXMuX2NvZGVFZGl0b3IuZ2V0U2Nyb2xsVG9wKCkgLSB0aGlzLl92aWV3Wm9uZS5oZWlnaHRJblB4KTtcblx0XHRcdFx0XHR0aGlzLl92aWV3Wm9uZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdHJ5VXBkYXRlV2lkZ2V0V2lkdGgoKSB7XG5cdFx0aWYgKCF0aGlzLl9pc1Zpc2libGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLl9kb21Ob2RlLmlzQ29ubmVjdGVkKSB7XG5cdFx0XHQvLyB0aGUgd2lkZ2V0IGlzIG5vdCBpbiB0aGUgRE9NXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF5b3V0SW5mbyA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0TGF5b3V0SW5mbygpO1xuXHRcdGNvbnN0IGVkaXRvckNvbnRlbnRXaWR0aCA9IGxheW91dEluZm8uY29udGVudFdpZHRoO1xuXG5cdFx0aWYgKGVkaXRvckNvbnRlbnRXaWR0aCA8PSAwKSB7XG5cdFx0XHQvLyBmb3IgZXhhbXBsZSwgZGlmZiB2aWV3IG9yaWdpbmFsIGVkaXRvclxuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdoaWRkZW5FZGl0b3InKTtcblx0XHRcdHJldHVybjtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LmNvbnRhaW5zKCdoaWRkZW5FZGl0b3InKSkge1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW5FZGl0b3InKTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JXaWR0aCA9IGxheW91dEluZm8ud2lkdGg7XG5cdFx0Y29uc3QgbWluaW1hcFdpZHRoID0gbGF5b3V0SW5mby5taW5pbWFwLm1pbmltYXBXaWR0aDtcblx0XHRsZXQgY29sbGFwc2VkRmluZFdpZGdldCA9IGZhbHNlO1xuXHRcdGxldCByZWR1Y2VkRmluZFdpZGdldCA9IGZhbHNlO1xuXHRcdGxldCBuYXJyb3dGaW5kV2lkZ2V0ID0gZmFsc2U7XG5cblx0XHRpZiAodGhpcy5fcmVzaXplZCkge1xuXHRcdFx0Y29uc3Qgd2lkZ2V0V2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9kb21Ob2RlKTtcblxuXHRcdFx0aWYgKHdpZGdldFdpZHRoID4gRklORF9XSURHRVRfSU5JVElBTF9XSURUSCkge1xuXHRcdFx0XHQvLyBhcyB0aGUgd2lkZ2V0IGlzIHJlc2l6ZWQgYnkgdXNlcnMsIHdlIG1heSBuZWVkIHRvIGNoYW5nZSB0aGUgbWF4IHdpZHRoIG9mIHRoZSB3aWRnZXQgYXMgdGhlIGVkaXRvciB3aWR0aCBjaGFuZ2VzLlxuXHRcdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLm1heFdpZHRoID0gYCR7ZWRpdG9yV2lkdGggLSAyOCAtIG1pbmltYXBXaWR0aCAtIDE1fXB4YDtcblx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LndpZHRoID0gZG9tLmdldFRvdGFsV2lkdGgodGhpcy5fZmluZElucHV0LmRvbU5vZGUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKEZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEggKyAyOCArIG1pbmltYXBXaWR0aCA+PSBlZGl0b3JXaWR0aCkge1xuXHRcdFx0cmVkdWNlZEZpbmRXaWRnZXQgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoRklORF9XSURHRVRfSU5JVElBTF9XSURUSCArIDI4ICsgbWluaW1hcFdpZHRoIC0gTUFYX01BVENIRVNfQ09VTlRfV0lEVEggPj0gZWRpdG9yV2lkdGgpIHtcblx0XHRcdG5hcnJvd0ZpbmRXaWRnZXQgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoRklORF9XSURHRVRfSU5JVElBTF9XSURUSCArIDI4ICsgbWluaW1hcFdpZHRoIC0gTUFYX01BVENIRVNfQ09VTlRfV0lEVEggPj0gZWRpdG9yV2lkdGggKyA1MCkge1xuXHRcdFx0Y29sbGFwc2VkRmluZFdpZGdldCA9IHRydWU7XG5cdFx0fVxuXHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnY29sbGFwc2VkLWZpbmQtd2lkZ2V0JywgY29sbGFwc2VkRmluZFdpZGdldCk7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCduYXJyb3ctZmluZC13aWRnZXQnLCBuYXJyb3dGaW5kV2lkZ2V0KTtcblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ3JlZHVjZWQtZmluZC13aWRnZXQnLCByZWR1Y2VkRmluZFdpZGdldCk7XG5cblx0XHRpZiAoIW5hcnJvd0ZpbmRXaWRnZXQgJiYgIWNvbGxhcHNlZEZpbmRXaWRnZXQpIHtcblx0XHRcdC8vIHRoZSBtaW5pbWFsIGxlZnQgb2Zmc2V0IG9mIGZpbmR3aWRnZXQgaXMgMTVweC5cblx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUubWF4V2lkdGggPSBgJHtlZGl0b3JXaWR0aCAtIDI4IC0gbWluaW1hcFdpZHRoIC0gMTV9cHhgO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpbmRJbnB1dC5sYXlvdXQoeyBjb2xsYXBzZWRGaW5kV2lkZ2V0LCBuYXJyb3dGaW5kV2lkZ2V0LCByZWR1Y2VkRmluZFdpZGdldCB9KTtcblx0XHRpZiAodGhpcy5fcmVzaXplZCkge1xuXHRcdFx0Y29uc3QgZmluZElucHV0V2lkdGggPSB0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3guZWxlbWVudC5jbGllbnRXaWR0aDtcblx0XHRcdGlmIChmaW5kSW5wdXRXaWR0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LndpZHRoID0gZmluZElucHV0V2lkdGg7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQud2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0bGV0IHRvdGFsaGVpZ2h0ID0gMDtcblxuXHRcdC8vIGZpbmQgaW5wdXQgbWFyZ2luIHRvcFxuXHRcdHRvdGFsaGVpZ2h0ICs9IDQ7XG5cblx0XHQvLyBmaW5kIGlucHV0IGhlaWdodFxuXHRcdHRvdGFsaGVpZ2h0ICs9IHRoaXMuX2ZpbmRJbnB1dC5pbnB1dEJveC5oZWlnaHQgKyAyIC8qKiBpbnB1dCBib3ggYm9yZGVyICovO1xuXG5cdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdC8vIHJlcGxhY2UgaW5wdXQgbWFyZ2luXG5cdFx0XHR0b3RhbGhlaWdodCArPSA0O1xuXG5cdFx0XHR0b3RhbGhlaWdodCArPSB0aGlzLl9yZXBsYWNlSW5wdXQuaW5wdXRCb3guaGVpZ2h0ICsgMiAvKiogaW5wdXQgYm94IGJvcmRlciAqLztcblx0XHR9XG5cblx0XHQvLyBtYXJnaW4gYm90dG9tXG5cdFx0dG90YWxoZWlnaHQgKz0gNDtcblx0XHRyZXR1cm4gdG90YWxoZWlnaHQ7XG5cdH1cblxuXHRwcml2YXRlIF90cnlVcGRhdGVIZWlnaHQoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdG90YWxIZWlnaHQgPSB0aGlzLl9nZXRIZWlnaHQoKTtcblx0XHRpZiAodGhpcy5fY2FjaGVkSGVpZ2h0ICE9PSBudWxsICYmIHRoaXMuX2NhY2hlZEhlaWdodCA9PT0gdG90YWxIZWlnaHQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLl9jYWNoZWRIZWlnaHQgPSB0b3RhbEhlaWdodDtcblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLmhlaWdodCA9IGAke3RvdGFsSGVpZ2h0fXB4YDtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gLS0tLS0gUHVibGljXG5cblx0cHVibGljIGZvY3VzRmluZElucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZWxlY3QoKTtcblx0XHQvLyBFZGdlIGJyb3dzZXIgcmVxdWlyZXMgZm9jdXMoKSBpbiBhZGRpdGlvbiB0byBzZWxlY3QoKVxuXHRcdHRoaXMuX2ZpbmRJbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGZvY3VzUmVwbGFjZUlucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5zZWxlY3QoKTtcblx0XHQvLyBFZGdlIGJyb3dzZXIgcmVxdWlyZXMgZm9jdXMoKSBpbiBhZGRpdGlvbiB0byBzZWxlY3QoKVxuXHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGhpZ2hsaWdodEZpbmRPcHRpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5oaWdobGlnaHRGaW5kT3B0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlU2VhcmNoU2NvcGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9jb2RlRWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdG9nZ2xlU2VsZWN0aW9uRmluZC5jaGVja2VkKSB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb25zID0gdGhpcy5fY29kZUVkaXRvci5nZXRTZWxlY3Rpb25zKCk7XG5cblx0XHRcdHNlbGVjdGlvbnMubWFwKHNlbGVjdGlvbiA9PiB7XG5cdFx0XHRcdGlmIChzZWxlY3Rpb24uZW5kQ29sdW1uID09PSAxICYmIHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyID4gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdHNlbGVjdGlvbiA9IHNlbGVjdGlvbi5zZXRFbmRQb3NpdGlvbihcblx0XHRcdFx0XHRcdHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyIC0gMSxcblx0XHRcdFx0XHRcdHRoaXMuX2NvZGVFZGl0b3IuZ2V0TW9kZWwoKSEuZ2V0TGluZU1heENvbHVtbihzZWxlY3Rpb24uZW5kTGluZU51bWJlciAtIDEpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBjdXJyZW50TWF0Y2ggPSB0aGlzLl9zdGF0ZS5jdXJyZW50TWF0Y2g7XG5cdFx0XHRcdGlmIChzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyICE9PSBzZWxlY3Rpb24uZW5kTGluZU51bWJlcikge1xuXHRcdFx0XHRcdGlmICghUmFuZ2UuZXF1YWxzUmFuZ2Uoc2VsZWN0aW9uLCBjdXJyZW50TWF0Y2gpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gc2VsZWN0aW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0pLmZpbHRlcihlbGVtZW50ID0+ICEhZWxlbWVudCk7XG5cblx0XHRcdGlmIChzZWxlY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTY29wZTogc2VsZWN0aW9ucyBhcyBSYW5nZVtdIH0sIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uRmluZElucHV0TW91c2VEb3duKGU6IElNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0Ly8gb24gbGludXgsIG1pZGRsZSBrZXkgZG9lcyBwYXN0aW5nLlxuXHRcdGlmIChlLm1pZGRsZUJ1dHRvbikge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbkZpbmRJbnB1dEtleURvd24oZTogSUtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5lcXVhbHMoY3RybEtleU1vZCB8IEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRpZiAodGhpcy5fa2V5YmluZGluZ1NlcnZpY2UuZGlzcGF0Y2hFdmVudChlLCBlLnRhcmdldCkpIHtcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3guaW5zZXJ0QXRDdXJzb3IoJ1xcbicpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5UYWIpKSB7XG5cdFx0XHRpZiAodGhpcy5faXNSZXBsYWNlVmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuZm9jdXMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5mb2N1c09uQ2FzZVNlbnNpdGl2ZSgpO1xuXHRcdFx0fVxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0dGhpcy5fY29kZUVkaXRvci5mb2N1cygpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpKSB7XG5cdFx0XHRyZXR1cm4gc3RvcFByb3BhZ2F0aW9uRm9yTXVsdGlMaW5lVXB3YXJkcyhlLCB0aGlzLl9maW5kSW5wdXQuZ2V0VmFsdWUoKSwgdGhpcy5fZmluZElucHV0LmRvbU5vZGUucXVlcnlTZWxlY3RvcigndGV4dGFyZWEnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0cmV0dXJuIHN0b3BQcm9wYWdhdGlvbkZvck11bHRpTGluZURvd253YXJkcyhlLCB0aGlzLl9maW5kSW5wdXQuZ2V0VmFsdWUoKSwgdGhpcy5fZmluZElucHV0LmRvbU5vZGUucXVlcnlTZWxlY3RvcigndGV4dGFyZWEnKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25SZXBsYWNlSW5wdXRLZXlEb3duKGU6IElLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGUuZXF1YWxzKGN0cmxLZXlNb2QgfCBLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0aWYgKHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmRpc3BhdGNoRXZlbnQoZSwgZS50YXJnZXQpKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cyAmJiBwbGF0Zm9ybS5pc05hdGl2ZSAmJiAhdGhpcy5fY3RybEVudGVyUmVwbGFjZUFsbFdhcm5pbmdQcm9tcHRlZCkge1xuXHRcdFx0XHRcdC8vIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2hlbiB1c2VycyBwcmVzcyBDdHJsICsgRW50ZXIgdG8gcmVwbGFjZSBhbGxcblx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8oXG5cdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2N0cmxFbnRlci5rZXliaW5kaW5nQ2hhbmdlZCcsXG5cdFx0XHRcdFx0XHRcdCdDdHJsK0VudGVyIG5vdyBpbnNlcnRzIGxpbmUgYnJlYWsgaW5zdGVhZCBvZiByZXBsYWNpbmcgYWxsLiBZb3UgY2FuIG1vZGlmeSB0aGUga2V5YmluZGluZyBmb3IgZWRpdG9yLmFjdGlvbi5yZXBsYWNlQWxsIHRvIG92ZXJyaWRlIHRoaXMgYmVoYXZpb3IuJylcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0dGhpcy5fY3RybEVudGVyUmVwbGFjZUFsbFdhcm5pbmdQcm9tcHRlZCA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoY3RybEVudGVyUmVwbGFjZUFsbFdhcm5pbmdQcm9tcHRlZEtleSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuaW5wdXRCb3guaW5zZXJ0QXRDdXJzb3IoJ1xcbicpO1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLlRhYikpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5mb2N1c09uQ2FzZVNlbnNpdGl2ZSgpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5mb2N1cygpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0dGhpcy5fY29kZUVkaXRvci5mb2N1cygpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLlVwQXJyb3cpKSB7XG5cdFx0XHRyZXR1cm4gc3RvcFByb3BhZ2F0aW9uRm9yTXVsdGlMaW5lVXB3YXJkcyhlLCB0aGlzLl9yZXBsYWNlSW5wdXQuaW5wdXRCb3gudmFsdWUsIHRoaXMuX3JlcGxhY2VJbnB1dC5pbnB1dEJveC5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJ3RleHRhcmVhJykpO1xuXHRcdH1cblxuXHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkRvd25BcnJvdykpIHtcblx0XHRcdHJldHVybiBzdG9wUHJvcGFnYXRpb25Gb3JNdWx0aUxpbmVEb3dud2FyZHMoZSwgdGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94LnZhbHVlLCB0aGlzLl9yZXBsYWNlSW5wdXQuaW5wdXRCb3guZWxlbWVudC5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYScpKTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0tLSBzYXNoXG5cdHB1YmxpYyBnZXRWZXJ0aWNhbFNhc2hMZWZ0KF9zYXNoOiBTYXNoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXHQvLyAtLS0tLSBpbml0aWFsaXphdGlvblxuXG5cdHByaXZhdGUgX2tleWJpbmRpbmdMYWJlbEZvcihhY3Rpb25JZDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCBrYiA9IHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uSWQpO1xuXHRcdGlmICgha2IpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0cmV0dXJuIGAgKCR7a2IuZ2V0TGFiZWwoKX0pYDtcblx0fVxuXG5cdHByaXZhdGUgX2J1aWxkRG9tTm9kZSgpOiB2b2lkIHtcblx0XHRjb25zdCBmbGV4aWJsZUhlaWdodCA9IHRydWU7XG5cdFx0Y29uc3QgZmxleGlibGVXaWR0aCA9IHRydWU7XG5cdFx0Ly8gRmluZCBpbnB1dFxuXHRcdGNvbnN0IGZpbmRTZWFyY2hIaXN0b3J5Q29uZmlnID0gdGhpcy5fY29kZUVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZpbmQpLmhpc3Rvcnk7XG5cdFx0Y29uc3QgcmVwbGFjZUhpc3RvcnlDb25maWcgPSB0aGlzLl9jb2RlRWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uZmluZCkucmVwbGFjZUhpc3Rvcnk7XG5cdFx0dGhpcy5fZmluZElucHV0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbnRleHRTY29wZWRGaW5kSW5wdXQobnVsbCwgdGhpcy5fY29udGV4dFZpZXdQcm92aWRlciwge1xuXHRcdFx0d2lkdGg6IEZJTkRfSU5QVVRfQVJFQV9XSURUSCxcblx0XHRcdGxhYmVsOiBOTFNfRklORF9JTlBVVF9MQUJFTCxcblx0XHRcdHBsYWNlaG9sZGVyOiBOTFNfRklORF9JTlBVVF9QTEFDRUhPTERFUixcblx0XHRcdGFwcGVuZENhc2VTZW5zaXRpdmVMYWJlbDogdGhpcy5fa2V5YmluZGluZ0xhYmVsRm9yKEZJTkRfSURTLlRvZ2dsZUNhc2VTZW5zaXRpdmVDb21tYW5kKSxcblx0XHRcdGFwcGVuZFdob2xlV29yZHNMYWJlbDogdGhpcy5fa2V5YmluZGluZ0xhYmVsRm9yKEZJTkRfSURTLlRvZ2dsZVdob2xlV29yZENvbW1hbmQpLFxuXHRcdFx0YXBwZW5kUmVnZXhMYWJlbDogdGhpcy5fa2V5YmluZGluZ0xhYmVsRm9yKEZJTkRfSURTLlRvZ2dsZVJlZ2V4Q29tbWFuZCksXG5cdFx0XHR2YWxpZGF0aW9uOiAodmFsdWU6IHN0cmluZyk6IElucHV0Qm94TWVzc2FnZSB8IG51bGwgPT4ge1xuXHRcdFx0XHRpZiAodmFsdWUubGVuZ3RoID09PSAwIHx8ICF0aGlzLl9maW5kSW5wdXQuZ2V0UmVnZXgoKSkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Ly8gdXNlIGBnYCBhbmQgYHVgIHdoaWNoIGFyZSBhbHNvIHVzZWQgYnkgdGhlIFRleHRNb2RlbCBzZWFyY2hcblx0XHRcdFx0XHRuZXcgUmVnRXhwKHZhbHVlLCAnZ3UnKTtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHJldHVybiB7IGNvbnRlbnQ6IGUubWVzc2FnZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0ZmxleGlibGVIZWlnaHQsXG5cdFx0XHRmbGV4aWJsZVdpZHRoLFxuXHRcdFx0ZmxleGlibGVNYXhIZWlnaHQ6IDExOCxcblx0XHRcdHNob3dDb21tb25GaW5kVG9nZ2xlczogdHJ1ZSxcblx0XHRcdHNob3dIaXN0b3J5SGludDogKCkgPT4gc2hvd0hpc3RvcnlLZXliaW5kaW5nSGludCh0aGlzLl9rZXliaW5kaW5nU2VydmljZSksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzLFxuXHRcdFx0dG9nZ2xlU3R5bGVzOiBkZWZhdWx0VG9nZ2xlU3R5bGVzLFxuXHRcdFx0aGlzdG9yeTogZmluZFNlYXJjaEhpc3RvcnlDb25maWcgPT09ICd3b3Jrc3BhY2UnID8gdGhpcy5fZmluZFdpZGdldFNlYXJjaEhpc3RvcnkgOiBuZXcgU2V0KFtdKSxcblx0XHR9LCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRSZWdleCghIXRoaXMuX3N0YXRlLmlzUmVnZXgpO1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRDYXNlU2Vuc2l0aXZlKCEhdGhpcy5fc3RhdGUubWF0Y2hDYXNlKTtcblx0XHR0aGlzLl9maW5kSW5wdXQuc2V0V2hvbGVXb3JkcyghIXRoaXMuX3N0YXRlLndob2xlV29yZCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uS2V5RG93bigoZSkgPT4gdGhpcy5fb25GaW5kSW5wdXRLZXlEb3duKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0LmlucHV0Qm94Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9pZ25vcmVDaGFuZ2VFdmVudCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6IHRoaXMuX2ZpbmRJbnB1dC5nZXRWYWx1ZSgpIH0sIHRydWUpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXQub25EaWRPcHRpb25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHtcblx0XHRcdFx0aXNSZWdleDogdGhpcy5fZmluZElucHV0LmdldFJlZ2V4KCksXG5cdFx0XHRcdHdob2xlV29yZDogdGhpcy5fZmluZElucHV0LmdldFdob2xlV29yZHMoKSxcblx0XHRcdFx0bWF0Y2hDYXNlOiB0aGlzLl9maW5kSW5wdXQuZ2V0Q2FzZVNlbnNpdGl2ZSgpXG5cdFx0XHR9LCB0cnVlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uQ2FzZVNlbnNpdGl2ZUtleURvd24oKGUpID0+IHtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuZm9jdXMoKTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uUmVnZXhLZXlEb3duKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5UYWIpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKSB7XG5cdFx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LmZvY3VzT25QcmVzZXJ2ZSgpO1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3gub25EaWRIZWlnaHRDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmICh0aGlzLl90cnlVcGRhdGVIZWlnaHQoKSkge1xuXHRcdFx0XHR0aGlzLl9zaG93Vmlld1pvbmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aWYgKHBsYXRmb3JtLmlzTGludXgpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRJbnB1dC5vbk1vdXNlRG93bigoZSkgPT4gdGhpcy5fb25GaW5kSW5wdXRNb3VzZURvd24oZSkpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9tYXRjaGVzQ291bnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuY2xhc3NOYW1lID0gJ21hdGNoZXNDb3VudCc7XG5cdFx0dGhpcy5fdXBkYXRlTWF0Y2hlc0NvdW50KCk7XG5cblx0XHQvLyBDcmVhdGUgYSBzY29wZWQgaG92ZXIgZGVsZWdhdGUgZm9yIGFsbCBmaW5kIHJlbGF0ZWQgYnV0dG9uc1xuXHRcdGNvbnN0IGhvdmVyRGVsZWdhdGUgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblxuXHRcdC8vIFByZXZpb3VzIGJ1dHRvblxuXHRcdHRoaXMuX3ByZXZCdG4gPSB0aGlzLl9yZWdpc3RlcihuZXcgU2ltcGxlQnV0dG9uKHtcblx0XHRcdGxhYmVsOiBOTFNfUFJFVklPVVNfTUFUQ0hfQlROX0xBQkVMICsgdGhpcy5fa2V5YmluZGluZ0xhYmVsRm9yKEZJTkRfSURTLlByZXZpb3VzTWF0Y2hGaW5kQWN0aW9uKSxcblx0XHRcdGljb246IGZpbmRQcmV2aW91c01hdGNoSWNvbixcblx0XHRcdGhvdmVyRGVsZWdhdGUsXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0SXNEZWZpbmVkKHRoaXMuX2NvZGVFZGl0b3IuZ2V0QWN0aW9uKEZJTkRfSURTLlByZXZpb3VzTWF0Y2hGaW5kQWN0aW9uKSkucnVuKCkudGhlbih1bmRlZmluZWQsIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdH1cblx0XHR9LCB0aGlzLl9ob3ZlclNlcnZpY2UpKTtcblxuXHRcdC8vIE5leHQgYnV0dG9uXG5cdFx0dGhpcy5fbmV4dEJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19ORVhUX01BVENIX0JUTl9MQUJFTCArIHRoaXMuX2tleWJpbmRpbmdMYWJlbEZvcihGSU5EX0lEUy5OZXh0TWF0Y2hGaW5kQWN0aW9uKSxcblx0XHRcdGljb246IGZpbmROZXh0TWF0Y2hJY29uLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZSxcblx0XHRcdG9uVHJpZ2dlcjogKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnRJc0RlZmluZWQodGhpcy5fY29kZUVkaXRvci5nZXRBY3Rpb24oRklORF9JRFMuTmV4dE1hdGNoRmluZEFjdGlvbikpLnJ1bigpLnRoZW4odW5kZWZpbmVkLCBvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0XHR9XG5cdFx0fSwgdGhpcy5faG92ZXJTZXJ2aWNlKSk7XG5cblx0XHRjb25zdCBmaW5kUGFydCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGZpbmRQYXJ0LmNsYXNzTmFtZSA9ICdmaW5kLXBhcnQnO1xuXHRcdGZpbmRQYXJ0LmFwcGVuZENoaWxkKHRoaXMuX2ZpbmRJbnB1dC5kb21Ob2RlKTtcblx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0YWN0aW9uc0NvbnRhaW5lci5jbGFzc05hbWUgPSAnZmluZC1hY3Rpb25zJztcblx0XHRmaW5kUGFydC5hcHBlbmRDaGlsZChhY3Rpb25zQ29udGFpbmVyKTtcblx0XHRhY3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX21hdGNoZXNDb3VudCk7XG5cdFx0YWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9wcmV2QnRuLmRvbU5vZGUpO1xuXHRcdGFjdGlvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fbmV4dEJ0bi5kb21Ob2RlKTtcblxuXHRcdC8vIFRvZ2dsZSBzZWxlY3Rpb24gYnV0dG9uXG5cdFx0dGhpcy5fdG9nZ2xlU2VsZWN0aW9uRmluZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUb2dnbGUoe1xuXHRcdFx0aWNvbjogZmluZFNlbGVjdGlvbkljb24sXG5cdFx0XHR0aXRsZTogTkxTX1RPR0dMRV9TRUxFQ1RJT05fRklORF9USVRMRSArIHRoaXMuX2tleWJpbmRpbmdMYWJlbEZvcihGSU5EX0lEUy5Ub2dnbGVTZWFyY2hTY29wZUNvbW1hbmQpLFxuXHRcdFx0aXNDaGVja2VkOiBmYWxzZSxcblx0XHRcdGhvdmVyRGVsZWdhdGU6IGhvdmVyRGVsZWdhdGUsXG5cdFx0XHRpbnB1dEFjdGl2ZU9wdGlvbkJhY2tncm91bmQ6IGFzQ3NzVmFyaWFibGUoaW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kKSxcblx0XHRcdGlucHV0QWN0aXZlT3B0aW9uQm9yZGVyOiBhc0Nzc1ZhcmlhYmxlKGlucHV0QWN0aXZlT3B0aW9uQm9yZGVyKSxcblx0XHRcdGlucHV0QWN0aXZlT3B0aW9uRm9yZWdyb3VuZDogYXNDc3NWYXJpYWJsZShpbnB1dEFjdGl2ZU9wdGlvbkZvcmVncm91bmQpLFxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuY2hlY2tlZCkge1xuXHRcdFx0XHRpZiAodGhpcy5fY29kZUVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdFx0bGV0IHNlbGVjdGlvbnMgPSB0aGlzLl9jb2RlRWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRcdFx0XHRzZWxlY3Rpb25zID0gc2VsZWN0aW9ucy5tYXAoc2VsZWN0aW9uID0+IHtcblx0XHRcdFx0XHRcdGlmIChzZWxlY3Rpb24uZW5kQ29sdW1uID09PSAxICYmIHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyID4gc2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3Rpb24gPSBzZWxlY3Rpb24uc2V0RW5kUG9zaXRpb24oc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgLSAxLCB0aGlzLl9jb2RlRWRpdG9yLmdldE1vZGVsKCkhLmdldExpbmVNYXhDb2x1bW4oc2VsZWN0aW9uLmVuZExpbmVOdW1iZXIgLSAxKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIXNlbGVjdGlvbi5pc0VtcHR5KCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHNlbGVjdGlvbjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH0pLmZpbHRlcigoZWxlbWVudCk6IGVsZW1lbnQgaXMgU2VsZWN0aW9uID0+ICEhZWxlbWVudCk7XG5cblx0XHRcdFx0XHRpZiAoc2VsZWN0aW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IHNlYXJjaFNjb3BlOiBzZWxlY3Rpb25zIGFzIFJhbmdlW10gfSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTY29wZTogbnVsbCB9LCB0cnVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhY3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuZG9tTm9kZSk7XG5cblx0XHQvLyBDbG9zZSBidXR0b25cblx0XHR0aGlzLl9jbG9zZUJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19DTE9TRV9CVE5fTEFCRUwgKyB0aGlzLl9rZXliaW5kaW5nTGFiZWxGb3IoRklORF9JRFMuQ2xvc2VGaW5kV2lkZ2V0Q29tbWFuZCksXG5cdFx0XHRpY29uOiB3aWRnZXRDbG9zZSxcblx0XHRcdGhvdmVyRGVsZWdhdGUsXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgaXNSZXZlYWxlZDogZmFsc2UsIHNlYXJjaFNjb3BlOiBudWxsIH0sIGZhbHNlKTtcblx0XHRcdH0sXG5cdFx0XHRvbktleURvd246IChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLlRhYikpIHtcblx0XHRcdFx0XHRpZiAodGhpcy5faXNSZXBsYWNlVmlzaWJsZSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX3JlcGxhY2VCdG4uaXNFbmFibGVkKCkpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcmVwbGFjZUJ0bi5mb2N1cygpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fY29kZUVkaXRvci5mb2N1cygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIHRoaXMuX2hvdmVyU2VydmljZSkpO1xuXG5cdFx0Ly8gUmVwbGFjZSBpbnB1dFxuXHRcdHRoaXMuX3JlcGxhY2VJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb250ZXh0U2NvcGVkUmVwbGFjZUlucHV0KG51bGwsIHVuZGVmaW5lZCwge1xuXHRcdFx0bGFiZWw6IE5MU19SRVBMQUNFX0lOUFVUX0xBQkVMLFxuXHRcdFx0cGxhY2Vob2xkZXI6IE5MU19SRVBMQUNFX0lOUFVUX1BMQUNFSE9MREVSLFxuXHRcdFx0YXBwZW5kUHJlc2VydmVDYXNlTGFiZWw6IHRoaXMuX2tleWJpbmRpbmdMYWJlbEZvcihGSU5EX0lEUy5Ub2dnbGVQcmVzZXJ2ZUNhc2VDb21tYW5kKSxcblx0XHRcdGhpc3Rvcnk6IHJlcGxhY2VIaXN0b3J5Q29uZmlnID09PSAnd29ya3NwYWNlJyA/IHRoaXMuX3JlcGxhY2VXaWRnZXRIaXN0b3J5IDogbmV3IFNldChbXSksXG5cdFx0XHRmbGV4aWJsZUhlaWdodCxcblx0XHRcdGZsZXhpYmxlV2lkdGgsXG5cdFx0XHRmbGV4aWJsZU1heEhlaWdodDogMTE4LFxuXHRcdFx0c2hvd0hpc3RvcnlIaW50OiAoKSA9PiBzaG93SGlzdG9yeUtleWJpbmRpbmdIaW50KHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlKSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXMsXG5cdFx0XHR0b2dnbGVTdHlsZXM6IGRlZmF1bHRUb2dnbGVTdHlsZXMsXG5cdFx0fSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRydWUpKTtcblx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuc2V0UHJlc2VydmVDYXNlKCEhdGhpcy5fc3RhdGUucHJlc2VydmVDYXNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXBsYWNlSW5wdXQub25LZXlEb3duKChlKSA9PiB0aGlzLl9vblJlcGxhY2VJbnB1dEtleURvd24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXBsYWNlSW5wdXQuaW5wdXRCb3gub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgcmVwbGFjZVN0cmluZzogdGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94LnZhbHVlIH0sIGZhbHNlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94Lm9uRGlkSGVpZ2h0Q2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5faXNSZXBsYWNlVmlzaWJsZSAmJiB0aGlzLl90cnlVcGRhdGVIZWlnaHQoKSkge1xuXHRcdFx0XHR0aGlzLl9zaG93Vmlld1pvbmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVwbGFjZUlucHV0Lm9uRGlkT3B0aW9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7XG5cdFx0XHRcdHByZXNlcnZlQ2FzZTogdGhpcy5fcmVwbGFjZUlucHV0LmdldFByZXNlcnZlQ2FzZSgpXG5cdFx0XHR9LCB0cnVlKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVwbGFjZUlucHV0Lm9uUHJlc2VydmVDYXNlS2V5RG93bigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuVGFiKSkge1xuXHRcdFx0XHRpZiAodGhpcy5fcHJldkJ0bi5pc0VuYWJsZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMuX3ByZXZCdG4uZm9jdXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9uZXh0QnRuLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbmV4dEJ0bi5mb2N1cygpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuZW5hYmxlZCkge1xuXHRcdFx0XHRcdHRoaXMuX3RvZ2dsZVNlbGVjdGlvbkZpbmQuZm9jdXMoKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9jbG9zZUJ0bi5pc0VuYWJsZWQoKSkge1xuXHRcdFx0XHRcdHRoaXMuX2Nsb3NlQnRuLmZvY3VzKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ3JlYXRlIHNjb3BlZCBob3ZlciBkZWxlZ2F0ZSBmb3IgcmVwbGFjZSBhY3Rpb25zXG5cdFx0Y29uc3QgcmVwbGFjZUhvdmVyRGVsZWdhdGUgPSB0aGlzLl9yZWdpc3RlcihjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSgpKTtcblxuXHRcdC8vIFJlcGxhY2Ugb25lIGJ1dHRvblxuXHRcdHRoaXMuX3JlcGxhY2VCdG4gPSB0aGlzLl9yZWdpc3RlcihuZXcgU2ltcGxlQnV0dG9uKHtcblx0XHRcdGxhYmVsOiBOTFNfUkVQTEFDRV9CVE5fTEFCRUwgKyB0aGlzLl9rZXliaW5kaW5nTGFiZWxGb3IoRklORF9JRFMuUmVwbGFjZU9uZUFjdGlvbiksXG5cdFx0XHRpY29uOiBmaW5kUmVwbGFjZUljb24sXG5cdFx0XHRob3ZlckRlbGVnYXRlOiByZXBsYWNlSG92ZXJEZWxlZ2F0ZSxcblx0XHRcdG9uVHJpZ2dlcjogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jb250cm9sbGVyLnJlcGxhY2UoKTtcblx0XHRcdH0sXG5cdFx0XHRvbktleURvd246IChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdFx0XHR0aGlzLl9jbG9zZUJ0bi5mb2N1cygpO1xuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIHRoaXMuX2hvdmVyU2VydmljZSkpO1xuXG5cdFx0Ly8gUmVwbGFjZSBhbGwgYnV0dG9uXG5cdFx0dGhpcy5fcmVwbGFjZUFsbEJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19SRVBMQUNFX0FMTF9CVE5fTEFCRUwgKyB0aGlzLl9rZXliaW5kaW5nTGFiZWxGb3IoRklORF9JRFMuUmVwbGFjZUFsbEFjdGlvbiksXG5cdFx0XHRpY29uOiBmaW5kUmVwbGFjZUFsbEljb24sXG5cdFx0XHRob3ZlckRlbGVnYXRlOiByZXBsYWNlSG92ZXJEZWxlZ2F0ZSxcblx0XHRcdG9uVHJpZ2dlcjogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9jb250cm9sbGVyLnJlcGxhY2VBbGwoKTtcblx0XHRcdH1cblx0XHR9LCB0aGlzLl9ob3ZlclNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IHJlcGxhY2VQYXJ0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0cmVwbGFjZVBhcnQuY2xhc3NOYW1lID0gJ3JlcGxhY2UtcGFydCc7XG5cdFx0cmVwbGFjZVBhcnQuYXBwZW5kQ2hpbGQodGhpcy5fcmVwbGFjZUlucHV0LmRvbU5vZGUpO1xuXG5cdFx0Y29uc3QgcmVwbGFjZUFjdGlvbnNDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRyZXBsYWNlQWN0aW9uc0NvbnRhaW5lci5jbGFzc05hbWUgPSAncmVwbGFjZS1hY3Rpb25zJztcblx0XHRyZXBsYWNlUGFydC5hcHBlbmRDaGlsZChyZXBsYWNlQWN0aW9uc0NvbnRhaW5lcik7XG5cblx0XHRyZXBsYWNlQWN0aW9uc0NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLl9yZXBsYWNlQnRuLmRvbU5vZGUpO1xuXHRcdHJlcGxhY2VBY3Rpb25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX3JlcGxhY2VBbGxCdG4uZG9tTm9kZSk7XG5cblx0XHQvLyBUb2dnbGUgcmVwbGFjZSBidXR0b25cblx0XHR0aGlzLl90b2dnbGVSZXBsYWNlQnRuID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNpbXBsZUJ1dHRvbih7XG5cdFx0XHRsYWJlbDogTkxTX1RPR0dMRV9SRVBMQUNFX01PREVfQlROX0xBQkVMLFxuXHRcdFx0Y2xhc3NOYW1lOiAnY29kaWNvbiB0b2dnbGUgbGVmdCcsXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgaXNSZXBsYWNlUmV2ZWFsZWQ6ICF0aGlzLl9pc1JlcGxhY2VWaXNpYmxlIH0sIGZhbHNlKTtcblx0XHRcdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQud2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSk7XG5cdFx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94LmxheW91dCgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3Nob3dWaWV3Wm9uZSgpO1xuXHRcdFx0fVxuXHRcdH0sIHRoaXMuX2hvdmVyU2VydmljZSkpO1xuXHRcdHRoaXMuX3RvZ2dsZVJlcGxhY2VCdG4uc2V0RXhwYW5kZWQodGhpcy5faXNSZXBsYWNlVmlzaWJsZSk7XG5cblx0XHQvLyBXaWRnZXRcblx0XHR0aGlzLl9kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc05hbWUgPSAnZWRpdG9yLXdpZGdldCBmaW5kLXdpZGdldCc7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblx0XHR0aGlzLl9kb21Ob2RlLmFyaWFMYWJlbCA9IE5MU19GSU5EX0RJQUxPR19MQUJFTDtcblx0XHR0aGlzLl9kb21Ob2RlLnJvbGUgPSAnZGlhbG9nJztcblxuXHRcdC8vIFdlIG5lZWQgdG8gc2V0IHRoaXMgZXhwbGljaXRseSwgb3RoZXJ3aXNlIG9uIElFMTEsIHRoZSB3aWR0aCBpbmhlcml0ZW5jZSBvZiBmbGV4IGRvZXNuJ3Qgd29yay5cblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7RklORF9XSURHRVRfSU5JVElBTF9XSURUSH1weGA7XG5cblx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX3RvZ2dsZVJlcGxhY2VCdG4uZG9tTm9kZSk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZChmaW5kUGFydCk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9jbG9zZUJ0bi5kb21Ob2RlKTtcblx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHJlcGxhY2VQYXJ0KTtcblxuXHRcdHRoaXMuX3Jlc2l6ZVNhc2ggPSB0aGlzLl9yZWdpc3RlcihuZXcgU2FzaCh0aGlzLl9kb21Ob2RlLCB0aGlzLCB7IG9yaWVudGF0aW9uOiBPcmllbnRhdGlvbi5WRVJUSUNBTCwgc2l6ZTogMiB9KSk7XG5cdFx0dGhpcy5fcmVzaXplZCA9IGZhbHNlO1xuXHRcdGxldCBvcmlnaW5hbFdpZHRoID0gRklORF9XSURHRVRfSU5JVElBTF9XSURUSDtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Jlc2l6ZVNhc2gub25EaWRTdGFydCgoKSA9PiB7XG5cdFx0XHRvcmlnaW5hbFdpZHRoID0gZG9tLmdldFRvdGFsV2lkdGgodGhpcy5fZG9tTm9kZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVzaXplU2FzaC5vbkRpZENoYW5nZSgoZXZ0OiBJU2FzaEV2ZW50KSA9PiB7XG5cdFx0XHR0aGlzLl9yZXNpemVkID0gdHJ1ZTtcblx0XHRcdGNvbnN0IHdpZHRoID0gb3JpZ2luYWxXaWR0aCArIGV2dC5zdGFydFggLSBldnQuY3VycmVudFg7XG5cblx0XHRcdGlmICh3aWR0aCA8IEZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEgpIHtcblx0XHRcdFx0Ly8gbmFycm93IGRvd24gdGhlIGZpbmQgd2lkZ2V0IHNob3VsZCBiZSBoYW5kbGVkIGJ5IENTUy5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtYXhXaWR0aCA9IHBhcnNlRmxvYXQoZG9tLmdldENvbXB1dGVkU3R5bGUodGhpcy5fZG9tTm9kZSkubWF4V2lkdGgpIHx8IDA7XG5cdFx0XHRpZiAod2lkdGggPiBtYXhXaWR0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LndpZHRoID0gZG9tLmdldFRvdGFsV2lkdGgodGhpcy5fZmluZElucHV0LmRvbU5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3gubGF5b3V0KCk7XG5cdFx0XHR0aGlzLl90cnlVcGRhdGVIZWlnaHQoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXNpemVTYXNoLm9uRGlkUmVzZXQoKCkgPT4ge1xuXHRcdFx0Ly8gdXNlcnMgZG91YmxlIGNsaWNrIG9uIHRoZSBzYXNoXG5cdFx0XHRjb25zdCBjdXJyZW50V2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9kb21Ob2RlKTtcblxuXHRcdFx0aWYgKGN1cnJlbnRXaWR0aCA8IEZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEgpIHtcblx0XHRcdFx0Ly8gVGhlIGVkaXRvciBpcyBuYXJyb3cgYW5kIHRoZSB3aWR0aCBvZiB0aGUgZmluZCB3aWRnZXQgaXMgY29udHJvbGxlZCBmdWxseSBieSBDU1MuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0bGV0IHdpZHRoID0gRklORF9XSURHRVRfSU5JVElBTF9XSURUSDtcblxuXHRcdFx0aWYgKCF0aGlzLl9yZXNpemVkIHx8IGN1cnJlbnRXaWR0aCA9PT0gRklORF9XSURHRVRfSU5JVElBTF9XSURUSCkge1xuXHRcdFx0XHQvLyAxLiBuZXZlciByZXNpemVkIGJlZm9yZSwgZG91YmxlIGNsaWNrIHNob3VsZCBtYXhpbWl6ZXMgaXRcblx0XHRcdFx0Ly8gMi4gdXNlcnMgcmVzaXplZCBpdCBhbHJlYWR5IGJ1dCBpdHMgd2lkdGggaXMgdGhlIHNhbWUgYXMgZGVmYXVsdFxuXHRcdFx0XHRjb25zdCBsYXlvdXRJbmZvID0gdGhpcy5fY29kZUVkaXRvci5nZXRMYXlvdXRJbmZvKCk7XG5cdFx0XHRcdHdpZHRoID0gbGF5b3V0SW5mby53aWR0aCAtIDI4IC0gbGF5b3V0SW5mby5taW5pbWFwLm1pbmltYXBXaWR0aCAtIDE1O1xuXHRcdFx0XHR0aGlzLl9yZXNpemVkID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8qKlxuXHRcdFx0XHQgKiBubyBvcCwgdGhlIGZpbmQgd2lkZ2V0IHNob3VsZCBiZSBzaHJpbmtlZCB0byBpdHMgZGVmYXVsdCBzaXplLlxuXHRcdFx0XHQgKi9cblx0XHRcdH1cblxuXG5cdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXHRcdFx0aWYgKHRoaXMuX2lzUmVwbGFjZVZpc2libGUpIHtcblx0XHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LndpZHRoID0gZG9tLmdldFRvdGFsV2lkdGgodGhpcy5fZmluZElucHV0LmRvbU5vZGUpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3gubGF5b3V0KCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBY2Nlc3NpYmlsaXR5U3VwcG9ydCgpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX2NvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5hY2Nlc3NpYmlsaXR5U3VwcG9ydCk7XG5cdFx0dGhpcy5fZmluZElucHV0LnNldEZvY3VzSW5wdXRPbk9wdGlvbkNsaWNrKHZhbHVlICE9PSBBY2Nlc3NpYmlsaXR5U3VwcG9ydC5FbmFibGVkKTtcblx0fVxuXG5cdGdldFZpZXdTdGF0ZSgpIHtcblx0XHRsZXQgd2lkZ2V0Vmlld1pvbmVWaXNpYmxlID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuX3ZpZXdab25lICYmIHRoaXMuX3ZpZXdab25lSWQpIHtcblx0XHRcdHdpZGdldFZpZXdab25lVmlzaWJsZSA9IHRoaXMuX3ZpZXdab25lLmhlaWdodEluUHggPiB0aGlzLl9jb2RlRWRpdG9yLmdldFNjcm9sbFRvcCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHR3aWRnZXRWaWV3Wm9uZVZpc2libGUsXG5cdFx0XHRzY3JvbGxUb3A6IHRoaXMuX2NvZGVFZGl0b3IuZ2V0U2Nyb2xsVG9wKClcblx0XHR9O1xuXHR9XG5cblx0c2V0Vmlld1N0YXRlKHN0YXRlPzogeyB3aWRnZXRWaWV3Wm9uZVZpc2libGU6IGJvb2xlYW47IHNjcm9sbFRvcDogbnVtYmVyIH0pIHtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXRlLndpZGdldFZpZXdab25lVmlzaWJsZSkge1xuXHRcdFx0Ly8gd2Ugc2hvdWxkIGFkZCB0aGUgdmlldyB6b25lXG5cdFx0XHR0aGlzLl9sYXlvdXRWaWV3Wm9uZShzdGF0ZS5zY3JvbGxUb3ApO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTaW1wbGVCdXR0b25PcHRzIHtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZztcblx0cmVhZG9ubHkgY2xhc3NOYW1lPzogc3RyaW5nO1xuXHRyZWFkb25seSBpY29uPzogVGhlbWVJY29uO1xuXHRyZWFkb25seSBob3ZlckRlbGVnYXRlPzogSUhvdmVyRGVsZWdhdGU7XG5cdHJlYWRvbmx5IG9uVHJpZ2dlcjogKCkgPT4gdm9pZDtcblx0cmVhZG9ubHkgb25LZXlEb3duPzogKGU6IElLZXlib2FyZEV2ZW50KSA9PiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgU2ltcGxlQnV0dG9uIGV4dGVuZHMgV2lkZ2V0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vcHRzOiBJU2ltcGxlQnV0dG9uT3B0cztcblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZTogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0czogSVNpbXBsZUJ1dHRvbk9wdHMsXG5cdFx0aG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fb3B0cyA9IG9wdHM7XG5cblx0XHRsZXQgY2xhc3NOYW1lID0gJ2J1dHRvbic7XG5cdFx0aWYgKHRoaXMuX29wdHMuY2xhc3NOYW1lKSB7XG5cdFx0XHRjbGFzc05hbWUgPSBjbGFzc05hbWUgKyAnICcgKyB0aGlzLl9vcHRzLmNsYXNzTmFtZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX29wdHMuaWNvbikge1xuXHRcdFx0Y2xhc3NOYW1lID0gY2xhc3NOYW1lICsgJyAnICsgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHRoaXMuX29wdHMuaWNvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX2RvbU5vZGUudGFiSW5kZXggPSAwO1xuXHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NOYW1lID0gY2xhc3NOYW1lO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXHRcdHRoaXMuX2RvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5fb3B0cy5sYWJlbCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKG9wdHMuaG92ZXJEZWxlZ2F0ZSA/PyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLCB0aGlzLl9kb21Ob2RlLCB0aGlzLl9vcHRzLmxhYmVsKSk7XG5cblx0XHR0aGlzLm9uY2xpY2sodGhpcy5fZG9tTm9kZSwgKGUpID0+IHtcblx0XHRcdHRoaXMuX29wdHMub25UcmlnZ2VyKCk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLm9ua2V5ZG93bih0aGlzLl9kb21Ob2RlLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuZXF1YWxzKEtleUNvZGUuU3BhY2UpIHx8IGUuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdHRoaXMuX29wdHMub25UcmlnZ2VyKCk7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb3B0cy5vbktleURvd24/LihlKTtcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRwdWJsaWMgaXNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAodGhpcy5fZG9tTm9kZS50YWJJbmRleCA+PSAwKTtcblx0fVxuXG5cdHB1YmxpYyBmb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9kb21Ob2RlLmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgc2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsICFlbmFibGVkKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIFN0cmluZyghZW5hYmxlZCkpO1xuXHRcdHRoaXMuX2RvbU5vZGUudGFiSW5kZXggPSBlbmFibGVkID8gMCA6IC0xO1xuXHR9XG5cblx0cHVibGljIHNldEV4cGFuZGVkKGV4cGFuZGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCBTdHJpbmcoISFleHBhbmRlZCkpO1xuXHRcdGlmIChleHBhbmRlZCkge1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGZpbmRDb2xsYXBzZWRJY29uKSk7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoZmluZEV4cGFuZGVkSWNvbikpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoZmluZEV4cGFuZGVkSWNvbikpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGZpbmRDb2xsYXBzZWRJY29uKSk7XG5cdFx0fVxuXHR9XG59XG5cbi8vIHRoZW1pbmdcblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lLCBjb2xsZWN0b3IpID0+IHtcblx0Y29uc3QgZmluZE1hdGNoSGlnaGxpZ2h0Qm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yRmluZE1hdGNoSGlnaGxpZ2h0Qm9yZGVyKTtcblx0aWYgKGZpbmRNYXRjaEhpZ2hsaWdodEJvcmRlcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWVkaXRvciAuZmluZE1hdGNoIHsgYm9yZGVyOiAxcHggJHtpc0hpZ2hDb250cmFzdCh0aGVtZS50eXBlKSA/ICdkb3R0ZWQnIDogJ3NvbGlkJ30gJHtmaW5kTWF0Y2hIaWdobGlnaHRCb3JkZXJ9OyBib3gtc2l6aW5nOiBib3JkZXItYm94OyB9YCk7XG5cdH1cblxuXHRjb25zdCBmaW5kUmFuZ2VIaWdobGlnaHRCb3JkZXIgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JGaW5kUmFuZ2VIaWdobGlnaHRCb3JkZXIpO1xuXHRpZiAoZmluZFJhbmdlSGlnaGxpZ2h0Qm9yZGVyKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28tZWRpdG9yIC5maW5kU2NvcGUgeyBib3JkZXI6IDFweCAke2lzSGlnaENvbnRyYXN0KHRoZW1lLnR5cGUpID8gJ2Rhc2hlZCcgOiAnc29saWQnfSAke2ZpbmRSYW5nZUhpZ2hsaWdodEJvcmRlcn07IH1gKTtcblx0fVxuXG5cdGNvbnN0IGhjQm9yZGVyID0gdGhlbWUuZ2V0Q29sb3IoY29udHJhc3RCb3JkZXIpO1xuXHRpZiAoaGNCb3JkZXIpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLmZpbmQtd2lkZ2V0IHsgYm9yZGVyOiAxcHggc29saWQgJHtoY0JvcmRlcn07IH1gKTtcblx0fVxuXHRjb25zdCBmaW5kTWF0Y2hGb3JlZ3JvdW5kID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yRmluZE1hdGNoRm9yZWdyb3VuZCk7XG5cdGlmIChmaW5kTWF0Y2hGb3JlZ3JvdW5kKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28tZWRpdG9yIC5maW5kTWF0Y2hJbmxpbmUgeyBjb2xvcjogJHtmaW5kTWF0Y2hGb3JlZ3JvdW5kfTsgfWApO1xuXHR9XG5cdGNvbnN0IGZpbmRNYXRjaEhpZ2hsaWdodEZvcmVncm91bmQgPSB0aGVtZS5nZXRDb2xvcihlZGl0b3JGaW5kTWF0Y2hIaWdobGlnaHRGb3JlZ3JvdW5kKTtcblx0aWYgKGZpbmRNYXRjaEhpZ2hsaWdodEZvcmVncm91bmQpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1lZGl0b3IgLmN1cnJlbnRGaW5kTWF0Y2hJbmxpbmUgeyBjb2xvcjogJHtmaW5kTWF0Y2hIaWdobGlnaHRGb3JlZ3JvdW5kfTsgfWApO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUdy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
