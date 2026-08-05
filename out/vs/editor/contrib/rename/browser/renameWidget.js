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
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import * as aria from "../../../../base/browser/ui/aria/aria.js";
import { getBaseLayerHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegate2.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { List } from "../../../../base/browser/ui/list/listWidget.js";
import * as arrays from "../../../../base/common/arrays.js";
import { DeferredPromise, raceCancellation } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { assertType, isDefined } from "../../../../base/common/types.js";
import "./renameWidget.css";
import * as domFontInfo from "../../../browser/config/domFontInfo.js";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { ScrollType } from "../../../common/editorCommon.js";
import { NewSymbolNameTag, NewSymbolNameTriggerKind } from "../../../common/languages.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { getListStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import {
  editorWidgetBackground,
  inputBackground,
  inputBorder,
  inputForeground,
  quickInputListFocusBackground,
  quickInputListFocusForeground,
  widgetBorder,
  widgetShadow
} from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
const _sticky = false;
const CONTEXT_RENAME_INPUT_VISIBLE = new RawContextKey("renameInputVisible", false, nls.localize("renameInputVisible", "Whether the rename input widget is visible"));
const CONTEXT_RENAME_INPUT_FOCUSED = new RawContextKey("renameInputFocused", false, nls.localize("renameInputFocused", "Whether the rename input widget is focused"));
let RenameWidget = class {
  constructor(_editor, _acceptKeybindings, _themeService, _keybindingService, contextKeyService, _logService) {
    this._editor = _editor;
    this._acceptKeybindings = _acceptKeybindings;
    this._themeService = _themeService;
    this._keybindingService = _keybindingService;
    this._logService = _logService;
    // implement IContentWidget
    this.allowEditorOverflow = true;
    this._disposables = new DisposableStore();
    this._visibleContextKey = CONTEXT_RENAME_INPUT_VISIBLE.bindTo(contextKeyService);
    this._isEditingRenameCandidate = false;
    this._nRenameSuggestionsInvocations = 0;
    this._hadAutomaticRenameSuggestionsInvocation = false;
    this._candidates = /* @__PURE__ */ new Set();
    this._beforeFirstInputFieldEditSW = new StopWatch();
    this._inputWithButton = new InputWithButton();
    this._disposables.add(this._inputWithButton);
    this._editor.addContentWidget(this);
    this._disposables.add(this._editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.fontInfo)) {
        this._updateFont();
      }
    }));
    this._disposables.add(_themeService.onDidColorThemeChange(this._updateStyles, this));
  }
  dispose() {
    this._disposables.dispose();
    this._editor.removeContentWidget(this);
  }
  getId() {
    return "__renameInputWidget";
  }
  getDomNode() {
    if (!this._domNode) {
      this._domNode = document.createElement("div");
      this._domNode.className = "monaco-editor rename-box";
      this._domNode.appendChild(this._inputWithButton.domNode);
      this._renameCandidateListView = this._disposables.add(
        new RenameCandidateListView(this._domNode, {
          fontInfo: this._editor.getOption(EditorOption.fontInfo),
          onFocusChange: (newSymbolName) => {
            this._inputWithButton.input.value = newSymbolName;
            this._isEditingRenameCandidate = false;
          },
          onSelectionChange: () => {
            this._isEditingRenameCandidate = false;
            this.acceptInput(false);
          }
        })
      );
      this._disposables.add(
        this._inputWithButton.onDidInputChange(() => {
          if (this._renameCandidateListView?.focusedCandidate !== void 0) {
            this._isEditingRenameCandidate = true;
          }
          this._timeBeforeFirstInputFieldEdit ??= this._beforeFirstInputFieldEditSW.elapsed();
          if (this._renameCandidateProvidersCts?.token.isCancellationRequested === false) {
            this._renameCandidateProvidersCts.cancel();
          }
          this._renameCandidateListView?.clearFocus();
        })
      );
      this._label = document.createElement("div");
      this._label.className = "rename-label";
      this._domNode.appendChild(this._label);
      this._updateFont();
      this._updateStyles(this._themeService.getColorTheme());
    }
    return this._domNode;
  }
  _updateStyles(theme) {
    if (!this._domNode) {
      return;
    }
    const widgetShadowColor = theme.getColor(widgetShadow);
    const widgetBorderColor = theme.getColor(widgetBorder);
    this._domNode.style.backgroundColor = String(theme.getColor(editorWidgetBackground) ?? "");
    this._domNode.style.boxShadow = widgetShadowColor ? ` 0 0 8px 2px ${widgetShadowColor}` : "";
    this._domNode.style.border = widgetBorderColor ? `1px solid ${widgetBorderColor}` : "";
    this._domNode.style.color = String(theme.getColor(inputForeground) ?? "");
    const border = theme.getColor(inputBorder);
    this._inputWithButton.domNode.style.backgroundColor = String(theme.getColor(inputBackground) ?? "");
    this._inputWithButton.input.style.backgroundColor = String(theme.getColor(inputBackground) ?? "");
    this._inputWithButton.domNode.style.borderWidth = border ? "1px" : "0px";
    this._inputWithButton.domNode.style.borderStyle = border ? "solid" : "none";
    this._inputWithButton.domNode.style.borderColor = border?.toString() ?? "none";
  }
  _updateFont() {
    if (this._domNode === void 0) {
      return;
    }
    assertType(this._label !== void 0, "RenameWidget#_updateFont: _label must not be undefined given _domNode is defined");
    this._editor.applyFontInfo(this._inputWithButton.input);
    const fontInfo = this._editor.getOption(EditorOption.fontInfo);
    this._label.style.fontSize = `${this._computeLabelFontSize(fontInfo.fontSize)}px`;
  }
  _computeLabelFontSize(editorFontSize) {
    return editorFontSize * 0.8;
  }
  getPosition() {
    if (!this._visible) {
      return null;
    }
    if (!this._editor.hasModel() || // @ulugbekna: shouldn't happen
    !this._editor.getDomNode()) {
      return null;
    }
    const bodyBox = dom.getClientArea(this.getDomNode().ownerDocument.body);
    const editorBox = dom.getDomNodePagePosition(this._editor.getDomNode());
    const cursorBoxTop = this._getTopForPosition();
    this._nPxAvailableAbove = cursorBoxTop + editorBox.top;
    this._nPxAvailableBelow = bodyBox.height - this._nPxAvailableAbove;
    const lineHeight = this._editor.getOption(EditorOption.lineHeight);
    const { totalHeight: candidateViewHeight } = RenameCandidateView.getLayoutInfo({ lineHeight });
    const positionPreference = this._nPxAvailableBelow > candidateViewHeight * 6 ? [ContentWidgetPositionPreference.BELOW, ContentWidgetPositionPreference.ABOVE] : [ContentWidgetPositionPreference.ABOVE, ContentWidgetPositionPreference.BELOW];
    return {
      position: this._position,
      preference: positionPreference
    };
  }
  beforeRender() {
    const [accept, preview] = this._acceptKeybindings;
    this._label.innerText = nls.localize({ key: "label", comment: ['placeholders are keybindings, e.g "F2 to Rename, Shift+F2 to Preview"'] }, "{0} to Rename, {1} to Preview", this._keybindingService.lookupKeybinding(accept)?.getLabel(), this._keybindingService.lookupKeybinding(preview)?.getLabel());
    this._domNode.style.minWidth = `200px`;
    return null;
  }
  afterRender(position) {
    if (position === null) {
      this.cancelInput(true, "afterRender (because position is null)");
      return;
    }
    if (!this._editor.hasModel() || // shouldn't happen
    !this._editor.getDomNode()) {
      return;
    }
    assertType(this._renameCandidateListView);
    assertType(this._nPxAvailableAbove !== void 0);
    assertType(this._nPxAvailableBelow !== void 0);
    const inputBoxHeight = dom.getTotalHeight(this._inputWithButton.domNode);
    const labelHeight = dom.getTotalHeight(this._label);
    let totalHeightAvailable;
    if (position === ContentWidgetPositionPreference.BELOW) {
      totalHeightAvailable = this._nPxAvailableBelow;
    } else {
      totalHeightAvailable = this._nPxAvailableAbove;
    }
    this._renameCandidateListView.layout({
      height: totalHeightAvailable - labelHeight - inputBoxHeight,
      width: dom.getTotalWidth(this._inputWithButton.domNode)
    });
  }
  acceptInput(wantsPreview) {
    this._trace(`invoking acceptInput`);
    this._currentAcceptInput?.(wantsPreview);
  }
  cancelInput(focusEditor, caller) {
    this._currentCancelInput?.(focusEditor);
  }
  focusNextRenameSuggestion() {
    if (!this._renameCandidateListView?.focusNext()) {
      this._inputWithButton.input.value = this._currentName;
    }
  }
  focusPreviousRenameSuggestion() {
    if (!this._renameCandidateListView?.focusPrevious()) {
      this._inputWithButton.input.value = this._currentName;
    }
  }
  /**
   * @param requestRenameCandidates is `undefined` when there are no rename suggestion providers
   */
  getInput(where, currentName, supportPreview, requestRenameCandidates, cts) {
    const { start: selectionStart, end: selectionEnd } = this._getSelection(where, currentName);
    this._renameCts = cts;
    const disposeOnDone = new DisposableStore();
    this._nRenameSuggestionsInvocations = 0;
    this._hadAutomaticRenameSuggestionsInvocation = false;
    if (requestRenameCandidates === void 0) {
      this._inputWithButton.button.style.display = "none";
    } else {
      this._inputWithButton.button.style.display = "flex";
      this._requestRenameCandidatesOnce = requestRenameCandidates;
      this._requestRenameCandidates(currentName, false);
      disposeOnDone.add(dom.addDisposableListener(
        this._inputWithButton.button,
        "click",
        () => this._requestRenameCandidates(currentName, true)
      ));
      disposeOnDone.add(dom.addDisposableListener(
        this._inputWithButton.button,
        dom.EventType.KEY_DOWN,
        (e) => {
          const keyEvent = new StandardKeyboardEvent(e);
          if (keyEvent.equals(KeyCode.Enter) || keyEvent.equals(KeyCode.Space)) {
            keyEvent.stopPropagation();
            keyEvent.preventDefault();
            this._requestRenameCandidates(currentName, true);
          }
        }
      ));
    }
    this._isEditingRenameCandidate = false;
    this._domNode.classList.toggle("preview", supportPreview);
    this._position = new Position(where.startLineNumber, where.startColumn);
    this._currentName = currentName;
    this._inputWithButton.input.value = currentName;
    this._inputWithButton.input.setAttribute("selectionStart", selectionStart.toString());
    this._inputWithButton.input.setAttribute("selectionEnd", selectionEnd.toString());
    this._inputWithButton.input.size = Math.max((where.endColumn - where.startColumn) * 1.1, 20);
    this._beforeFirstInputFieldEditSW.reset();
    disposeOnDone.add(toDisposable(() => {
      this._renameCts = void 0;
      cts.dispose(true);
    }));
    disposeOnDone.add(toDisposable(() => {
      if (this._renameCandidateProvidersCts !== void 0) {
        this._renameCandidateProvidersCts.dispose(true);
        this._renameCandidateProvidersCts = void 0;
      }
    }));
    disposeOnDone.add(toDisposable(() => this._candidates.clear()));
    const inputResult = new DeferredPromise();
    inputResult.p.finally(() => {
      disposeOnDone.dispose();
      this._hide();
    });
    this._currentCancelInput = (focusEditor) => {
      this._trace("invoking _currentCancelInput");
      this._currentAcceptInput = void 0;
      this._currentCancelInput = void 0;
      this._renameCandidateListView?.clearCandidates();
      inputResult.complete(focusEditor);
      return true;
    };
    this._currentAcceptInput = (wantsPreview) => {
      this._trace("invoking _currentAcceptInput");
      assertType(this._renameCandidateListView !== void 0);
      const nRenameSuggestions = this._renameCandidateListView.nCandidates;
      let newName;
      let source;
      const focusedCandidate = this._renameCandidateListView.focusedCandidate;
      if (focusedCandidate !== void 0) {
        this._trace("using new name from renameSuggestion");
        newName = focusedCandidate;
        source = { k: "renameSuggestion" };
      } else {
        this._trace("using new name from inputField");
        newName = this._inputWithButton.input.value;
        source = this._isEditingRenameCandidate ? { k: "userEditedRenameSuggestion" } : { k: "inputField" };
      }
      if (newName === currentName || newName.trim().length === 0) {
        this.cancelInput(true, "_currentAcceptInput (because newName === value || newName.trim().length === 0)");
        return;
      }
      this._currentAcceptInput = void 0;
      this._currentCancelInput = void 0;
      this._renameCandidateListView.clearCandidates();
      inputResult.complete({
        newName,
        wantsPreview: supportPreview && wantsPreview,
        stats: {
          source,
          nRenameSuggestions,
          timeBeforeFirstInputFieldEdit: this._timeBeforeFirstInputFieldEdit,
          nRenameSuggestionsInvocations: this._nRenameSuggestionsInvocations,
          hadAutomaticRenameSuggestionsInvocation: this._hadAutomaticRenameSuggestionsInvocation
        }
      });
    };
    disposeOnDone.add(cts.token.onCancellationRequested(() => this.cancelInput(true, "cts.token.onCancellationRequested")));
    if (!_sticky) {
      disposeOnDone.add(this._editor.onDidBlurEditorWidget(() => this.cancelInput(!this._domNode?.ownerDocument.hasFocus(), "editor.onDidBlurEditorWidget")));
    }
    this._show();
    return inputResult.p;
  }
  _requestRenameCandidates(currentName, isManuallyTriggered) {
    if (this._requestRenameCandidatesOnce === void 0) {
      return;
    }
    if (this._renameCandidateProvidersCts !== void 0) {
      this._renameCandidateProvidersCts.dispose(true);
    }
    assertType(this._renameCts);
    if (this._inputWithButton.buttonState !== "stop") {
      this._renameCandidateProvidersCts = new CancellationTokenSource();
      const triggerKind = isManuallyTriggered ? NewSymbolNameTriggerKind.Invoke : NewSymbolNameTriggerKind.Automatic;
      const candidates = this._requestRenameCandidatesOnce(triggerKind, this._renameCandidateProvidersCts.token);
      if (candidates.length === 0) {
        this._inputWithButton.setSparkleButton();
        return;
      }
      if (!isManuallyTriggered) {
        this._hadAutomaticRenameSuggestionsInvocation = true;
      }
      this._nRenameSuggestionsInvocations += 1;
      this._inputWithButton.setStopButton();
      this._updateRenameCandidates(candidates, currentName, this._renameCts.token);
    }
  }
  /**
   * This allows selecting only part of the symbol name in the input field based on the selection in the editor
   */
  _getSelection(where, currentName) {
    assertType(this._editor.hasModel());
    const selection = this._editor.getSelection();
    let start = 0;
    let end = currentName.length;
    if (!Range.isEmpty(selection) && !Range.spansMultipleLines(selection) && Range.containsRange(where, selection)) {
      start = Math.max(0, selection.startColumn - where.startColumn);
      end = Math.min(where.endColumn, selection.endColumn) - where.startColumn;
    }
    return { start, end };
  }
  _show() {
    this._trace("invoking _show");
    this._editor.revealLineInCenterIfOutsideViewport(this._position.lineNumber, ScrollType.Smooth);
    this._visible = true;
    this._visibleContextKey.set(true);
    this._editor.layoutContentWidget(this);
    setTimeout(() => {
      this._inputWithButton.input.focus();
      this._inputWithButton.input.setSelectionRange(
        parseInt(this._inputWithButton.input.getAttribute("selectionStart")),
        parseInt(this._inputWithButton.input.getAttribute("selectionEnd"))
      );
    }, 100);
  }
  async _updateRenameCandidates(candidates, currentName, token) {
    const trace = (...args) => this._trace("_updateRenameCandidates", ...args);
    trace("start");
    const namesListResults = await raceCancellation(Promise.allSettled(candidates), token);
    this._inputWithButton.setSparkleButton();
    if (namesListResults === void 0) {
      trace("returning early - received updateRenameCandidates results - undefined");
      return;
    }
    const newNames = namesListResults.flatMap(
      (namesListResult) => namesListResult.status === "fulfilled" && isDefined(namesListResult.value) ? namesListResult.value : []
    );
    trace(`received updateRenameCandidates results - total (unfiltered) ${newNames.length} candidates.`);
    const distinctNames = arrays.distinct(newNames, (v) => v.newSymbolName);
    trace(`distinct candidates - ${distinctNames.length} candidates.`);
    const validDistinctNames = distinctNames.filter(({ newSymbolName }) => newSymbolName.trim().length > 0 && newSymbolName !== this._inputWithButton.input.value && newSymbolName !== currentName && !this._candidates.has(newSymbolName));
    trace(`valid distinct candidates - ${newNames.length} candidates.`);
    validDistinctNames.forEach((n) => this._candidates.add(n.newSymbolName));
    if (validDistinctNames.length < 1) {
      trace("returning early - no valid distinct candidates");
      return;
    }
    trace("setting candidates");
    this._renameCandidateListView.setCandidates(validDistinctNames);
    trace("asking editor to re-layout");
    this._editor.layoutContentWidget(this);
  }
  _hide() {
    this._trace("invoked _hide");
    this._visible = false;
    this._visibleContextKey.reset();
    this._editor.layoutContentWidget(this);
  }
  _getTopForPosition() {
    const visibleRanges = this._editor.getVisibleRanges();
    let firstLineInViewport;
    if (visibleRanges.length > 0) {
      firstLineInViewport = visibleRanges[0].startLineNumber;
    } else {
      this._logService.warn("RenameWidget#_getTopForPosition: this should not happen - visibleRanges is empty");
      firstLineInViewport = Math.max(1, this._position.lineNumber - 5);
    }
    return this._editor.getTopForLineNumber(this._position.lineNumber) - this._editor.getTopForLineNumber(firstLineInViewport);
  }
  _trace(...args) {
    this._logService.trace("RenameWidget", ...args);
  }
};
RenameWidget = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, ILogService)
], RenameWidget);
class RenameCandidateListView {
  // FIXME@ulugbekna: rewrite using event emitters
  constructor(parent, opts) {
    this._disposables = new DisposableStore();
    this._availableHeight = 0;
    this._minimumWidth = 0;
    this._lineHeight = opts.fontInfo.lineHeight;
    this._typicalHalfwidthCharacterWidth = opts.fontInfo.typicalHalfwidthCharacterWidth;
    this._listContainer = document.createElement("div");
    this._listContainer.className = "rename-box rename-candidate-list-container";
    parent.appendChild(this._listContainer);
    this._listWidget = RenameCandidateListView._createListWidget(this._listContainer, this._candidateViewHeight, opts.fontInfo);
    this._listWidget.onDidChangeFocus(
      (e) => {
        if (e.elements.length === 1) {
          opts.onFocusChange(e.elements[0].newSymbolName);
        }
      },
      this._disposables
    );
    this._listWidget.onDidChangeSelection(
      (e) => {
        if (e.elements.length === 1) {
          opts.onSelectionChange();
        }
      },
      this._disposables
    );
    this._disposables.add(
      this._listWidget.onDidBlur((e) => {
        this._listWidget.setFocus([]);
      })
    );
    this._listWidget.style(getListStyles({
      listInactiveFocusForeground: quickInputListFocusForeground,
      listInactiveFocusBackground: quickInputListFocusBackground
    }));
  }
  dispose() {
    this._listWidget.dispose();
    this._disposables.dispose();
  }
  // height - max height allowed by parent element
  layout({ height, width }) {
    this._availableHeight = height;
    this._minimumWidth = width;
  }
  setCandidates(candidates) {
    this._listWidget.splice(0, 0, candidates);
    const height = this._pickListHeight(this._listWidget.length);
    const width = this._pickListWidth(candidates);
    this._listWidget.layout(height, width);
    this._listContainer.style.height = `${height}px`;
    this._listContainer.style.width = `${width}px`;
    aria.status(nls.localize("renameSuggestionsReceivedAria", "Received {0} rename suggestions", candidates.length));
  }
  clearCandidates() {
    this._listContainer.style.height = "0px";
    this._listContainer.style.width = "0px";
    this._listWidget.splice(0, this._listWidget.length, []);
  }
  get nCandidates() {
    return this._listWidget.length;
  }
  get focusedCandidate() {
    if (this._listWidget.length === 0) {
      return;
    }
    const selectedElement = this._listWidget.getSelectedElements()[0];
    if (selectedElement !== void 0) {
      return selectedElement.newSymbolName;
    }
    const focusedElement = this._listWidget.getFocusedElements()[0];
    if (focusedElement !== void 0) {
      return focusedElement.newSymbolName;
    }
    return;
  }
  focusNext() {
    if (this._listWidget.length === 0) {
      return false;
    }
    const focusedIxs = this._listWidget.getFocus();
    if (focusedIxs.length === 0) {
      this._listWidget.focusFirst();
      this._listWidget.reveal(0);
      return true;
    } else {
      if (focusedIxs[0] === this._listWidget.length - 1) {
        this._listWidget.setFocus([]);
        this._listWidget.reveal(0);
        return false;
      } else {
        this._listWidget.focusNext();
        const focused = this._listWidget.getFocus()[0];
        this._listWidget.reveal(focused);
        return true;
      }
    }
  }
  /**
   * @returns true if focus is moved to previous element
   */
  focusPrevious() {
    if (this._listWidget.length === 0) {
      return false;
    }
    const focusedIxs = this._listWidget.getFocus();
    if (focusedIxs.length === 0) {
      this._listWidget.focusLast();
      const focused = this._listWidget.getFocus()[0];
      this._listWidget.reveal(focused);
      return true;
    } else {
      if (focusedIxs[0] === 0) {
        this._listWidget.setFocus([]);
        return false;
      } else {
        this._listWidget.focusPrevious();
        const focused = this._listWidget.getFocus()[0];
        this._listWidget.reveal(focused);
        return true;
      }
    }
  }
  clearFocus() {
    this._listWidget.setFocus([]);
  }
  get _candidateViewHeight() {
    const { totalHeight } = RenameCandidateView.getLayoutInfo({ lineHeight: this._lineHeight });
    return totalHeight;
  }
  _pickListHeight(nCandidates) {
    const heightToFitAllCandidates = this._candidateViewHeight * nCandidates;
    const MAX_N_CANDIDATES = 7;
    const height = Math.min(heightToFitAllCandidates, this._availableHeight, this._candidateViewHeight * MAX_N_CANDIDATES);
    return height;
  }
  _pickListWidth(candidates) {
    const longestCandidateWidth = Math.ceil(Math.max(...candidates.map((c) => c.newSymbolName.length)) * this._typicalHalfwidthCharacterWidth);
    const width = Math.max(
      this._minimumWidth,
      4 + 16 + 5 + longestCandidateWidth + 10
      /* (possibly visible) scrollbar width */
      // TODO@ulugbekna: approximate calc - clean this up
    );
    return width;
  }
  static _createListWidget(container, candidateViewHeight, fontInfo) {
    const virtualDelegate = new class {
      getTemplateId(element) {
        return "candidate";
      }
      getHeight(element) {
        return candidateViewHeight;
      }
    }();
    const renderer = new class {
      constructor() {
        this.templateId = "candidate";
      }
      renderTemplate(container2) {
        return new RenameCandidateView(container2, fontInfo);
      }
      renderElement(candidate, index, templateData) {
        templateData.populate(candidate);
      }
      disposeTemplate(templateData) {
        templateData.dispose();
      }
    }();
    return new List(
      "NewSymbolNameCandidates",
      container,
      virtualDelegate,
      [renderer],
      {
        keyboardSupport: false,
        // @ulugbekna: because we handle keyboard events through proper commands & keybinding service, see `rename.ts`
        mouseSupport: true,
        multipleSelectionSupport: false
      }
    );
  }
}
class InputWithButton {
  constructor() {
    this._buttonHoverContent = "";
    this._onDidInputChange = new Emitter();
    this.onDidInputChange = this._onDidInputChange.event;
    this._disposables = new DisposableStore();
  }
  get domNode() {
    if (!this._domNode) {
      this._domNode = document.createElement("div");
      this._domNode.className = "rename-input-with-button";
      this._domNode.style.display = "flex";
      this._domNode.style.flexDirection = "row";
      this._domNode.style.alignItems = "center";
      this._inputNode = document.createElement("input");
      this._inputNode.className = "rename-input";
      this._inputNode.type = "text";
      this._inputNode.style.border = "none";
      this._inputNode.setAttribute("aria-label", nls.localize("renameAriaLabel", "Rename input. Type new name and press Enter to commit."));
      this._domNode.appendChild(this._inputNode);
      this._buttonNode = document.createElement("div");
      this._buttonNode.className = "rename-suggestions-button";
      this._buttonNode.setAttribute("tabindex", "0");
      this._buttonGenHoverText = nls.localize("generateRenameSuggestionsButton", "Generate new name suggestions");
      this._buttonCancelHoverText = nls.localize("cancelRenameSuggestionsButton", "Cancel");
      this._buttonHoverContent = this._buttonGenHoverText;
      this._disposables.add(getBaseLayerHoverDelegate().setupDelayedHover(this._buttonNode, () => ({
        content: this._buttonHoverContent,
        appearance: {
          showPointer: true,
          compact: true
        }
      })));
      this._domNode.appendChild(this._buttonNode);
      this._disposables.add(dom.addDisposableListener(this.input, dom.EventType.INPUT, () => this._onDidInputChange.fire()));
      this._disposables.add(dom.addDisposableListener(this.input, dom.EventType.KEY_DOWN, (e) => {
        const keyEvent = new StandardKeyboardEvent(e);
        if (keyEvent.keyCode === KeyCode.LeftArrow || keyEvent.keyCode === KeyCode.RightArrow) {
          this._onDidInputChange.fire();
        }
      }));
      this._disposables.add(dom.addDisposableListener(this.input, dom.EventType.CLICK, () => this._onDidInputChange.fire()));
      this._disposables.add(dom.addDisposableListener(this.input, dom.EventType.FOCUS, () => {
        this.domNode.style.outlineWidth = "1px";
        this.domNode.style.outlineStyle = "solid";
        this.domNode.style.outlineOffset = "-1px";
        this.domNode.style.outlineColor = "var(--vscode-focusBorder)";
      }));
      this._disposables.add(dom.addDisposableListener(this.input, dom.EventType.BLUR, () => {
        this.domNode.style.outline = "none";
      }));
    }
    return this._domNode;
  }
  get input() {
    assertType(this._inputNode);
    return this._inputNode;
  }
  get button() {
    assertType(this._buttonNode);
    return this._buttonNode;
  }
  get buttonState() {
    return this._buttonState;
  }
  setSparkleButton() {
    this._buttonState = "sparkle";
    this._sparkleIcon ??= renderIcon(Codicon.sparkle);
    dom.clearNode(this.button);
    this.button.appendChild(this._sparkleIcon);
    this.button.setAttribute("aria-label", "Generating new name suggestions");
    this._buttonHoverContent = this._buttonGenHoverText;
    this.input.focus();
  }
  setStopButton() {
    this._buttonState = "stop";
    this._stopIcon ??= renderIcon(Codicon.stopCircle);
    dom.clearNode(this.button);
    this.button.appendChild(this._stopIcon);
    this.button.setAttribute("aria-label", "Cancel generating new name suggestions");
    this._buttonHoverContent = this._buttonCancelHoverText;
    this.input.focus();
  }
  dispose() {
    this._disposables.dispose();
  }
}
const _RenameCandidateView = class _RenameCandidateView {
  constructor(parent, fontInfo) {
    this._domNode = document.createElement("div");
    this._domNode.className = "rename-box rename-candidate";
    this._domNode.style.display = `flex`;
    this._domNode.style.columnGap = `5px`;
    this._domNode.style.alignItems = `center`;
    this._domNode.style.height = `${fontInfo.lineHeight}px`;
    this._domNode.style.padding = `${_RenameCandidateView._PADDING}px`;
    const iconContainer = document.createElement("div");
    iconContainer.style.display = `flex`;
    iconContainer.style.alignItems = `center`;
    iconContainer.style.width = iconContainer.style.height = `${fontInfo.lineHeight * 0.8}px`;
    this._domNode.appendChild(iconContainer);
    this._icon = renderIcon(Codicon.sparkle);
    this._icon.style.display = `none`;
    iconContainer.appendChild(this._icon);
    this._label = document.createElement("div");
    domFontInfo.applyFontInfo(this._label, fontInfo);
    this._domNode.appendChild(this._label);
    parent.appendChild(this._domNode);
  }
  populate(value) {
    this._updateIcon(value);
    this._updateLabel(value);
  }
  _updateIcon(value) {
    const isAIGenerated = !!value.tags?.includes(NewSymbolNameTag.AIGenerated);
    this._icon.style.display = isAIGenerated ? "inherit" : "none";
  }
  _updateLabel(value) {
    this._label.innerText = value.newSymbolName;
  }
  static getLayoutInfo({ lineHeight }) {
    const totalHeight = lineHeight + _RenameCandidateView._PADDING * 2;
    return { totalHeight };
  }
  dispose() {
  }
};
_RenameCandidateView._PADDING = 2;
let RenameCandidateView = _RenameCandidateView;
export {
  CONTEXT_RENAME_INPUT_FOCUSED,
  CONTEXT_RENAME_INPUT_VISIBLE,
  RenameWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9yZW5hbWUvYnJvd3Nlci9yZW5hbWVXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgKiBhcyBhcmlhIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgZ2V0QmFzZUxheWVySG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlMi5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgKiBhcyBhcnJheXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgcmFjZUNhbmNlbGxhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUsIGlzRGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAnLi9yZW5hbWVXaWRnZXQuY3NzJztcbmltcG9ydCAqIGFzIGRvbUZvbnRJbmZvIGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvY29uZmlnL2RvbUZvbnRJbmZvLmpzJztcbmltcG9ydCB7IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UsIElDb2RlRWRpdG9yLCBJQ29udGVudFdpZGdldCwgSUNvbnRlbnRXaWRnZXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2ZvbnRJbmZvLmpzJztcbmltcG9ydCB7IElEaW1lbnNpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9kaW1lbnNpb24uanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgTmV3U3ltYm9sTmFtZSwgTmV3U3ltYm9sTmFtZVRhZywgTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLCBQcm92aWRlclJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgZ2V0TGlzdFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQge1xuXHRlZGl0b3JXaWRnZXRCYWNrZ3JvdW5kLFxuXHRpbnB1dEJhY2tncm91bmQsXG5cdGlucHV0Qm9yZGVyLFxuXHRpbnB1dEZvcmVncm91bmQsXG5cdHF1aWNrSW5wdXRMaXN0Rm9jdXNCYWNrZ3JvdW5kLFxuXHRxdWlja0lucHV0TGlzdEZvY3VzRm9yZWdyb3VuZCxcblx0d2lkZ2V0Qm9yZGVyLFxuXHR3aWRnZXRTaGFkb3dcbn0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbG9yVGhlbWUsIElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcblxuLyoqIGZvciBkZWJ1Z2dpbmcgKi9cbmNvbnN0IF9zdGlja3kgPSBmYWxzZVxuXHQvLyB8fCBCb29sZWFuKFwidHJ1ZVwiKSAvLyBkb25lIFwid2VpcmRseVwiIHNvIHRoYXQgYSBsaW50IHdhcm5pbmcgcHJldmVudHMgeW91IGZyb20gcHVzaGluZyB0aGlzXG5cdDtcblxuXG5leHBvcnQgY29uc3QgQ09OVEVYVF9SRU5BTUVfSU5QVVRfVklTSUJMRSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdyZW5hbWVJbnB1dFZpc2libGUnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCdyZW5hbWVJbnB1dFZpc2libGUnLCBcIldoZXRoZXIgdGhlIHJlbmFtZSBpbnB1dCB3aWRnZXQgaXMgdmlzaWJsZVwiKSk7XG5leHBvcnQgY29uc3QgQ09OVEVYVF9SRU5BTUVfSU5QVVRfRk9DVVNFRCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdyZW5hbWVJbnB1dEZvY3VzZWQnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCdyZW5hbWVJbnB1dEZvY3VzZWQnLCBcIldoZXRoZXIgdGhlIHJlbmFtZSBpbnB1dCB3aWRnZXQgaXMgZm9jdXNlZFwiKSk7XG5cbi8qKlxuICogXCJTb3VyY2VcIiBvZiB0aGUgbmV3IG5hbWU6XG4gKiAtICdpbnB1dEZpZWxkJyAtIHVzZXIgZW50ZXJlZCB0aGUgbmV3IG5hbWVcbiAqIC0gJ3JlbmFtZVN1Z2dlc3Rpb24nIC0gdXNlciBwaWNrZWQgZnJvbSByZW5hbWUgc3VnZ2VzdGlvbnNcbiAqIC0gJ3VzZXJFZGl0ZWRSZW5hbWVTdWdnZXN0aW9uJyAtIHVzZXIgX2xpa2VseV8gZWRpdGVkIGEgcmVuYW1lIHN1Z2dlc3Rpb24gKFwibGlrZWx5XCIgYmVjYXVzZSB3aGVuIGlucHV0IHN0YXJ0ZWQgYmVpbmcgZWRpdGVkLCBhIHJlbmFtZSBzdWdnZXN0aW9uIGhhZCBmb2N1cylcbiAqL1xuZXhwb3J0IHR5cGUgTmV3TmFtZVNvdXJjZSA9XG5cdHwgeyBrOiAnaW5wdXRGaWVsZCcgfVxuXHR8IHsgazogJ3JlbmFtZVN1Z2dlc3Rpb24nIH1cblx0fCB7IGs6ICd1c2VyRWRpdGVkUmVuYW1lU3VnZ2VzdGlvbicgfTtcblxuLyoqXG4gKiBWYXJpb3VzIHN0YXRpc3RpY3MgcmVnYXJkaW5nIHJlbmFtZSBpbnB1dCBmaWVsZFxuICovXG5leHBvcnQgdHlwZSBSZW5hbWVXaWRnZXRTdGF0cyA9IHtcblx0blJlbmFtZVN1Z2dlc3Rpb25zOiBudW1iZXI7XG5cdHNvdXJjZTogTmV3TmFtZVNvdXJjZTtcblx0dGltZUJlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0blJlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbnM6IG51bWJlcjtcblx0aGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uOiBib29sZWFuO1xufTtcblxuZXhwb3J0IHR5cGUgUmVuYW1lV2lkZ2V0UmVzdWx0ID0ge1xuXHQvKipcblx0ICogVGhlIG5ldyBuYW1lIHRvIGJlIHVzZWRcblx0ICovXG5cdG5ld05hbWU6IHN0cmluZztcblx0d2FudHNQcmV2aWV3PzogYm9vbGVhbjtcblx0c3RhdHM6IFJlbmFtZVdpZGdldFN0YXRzO1xufTtcblxuaW50ZXJmYWNlIElSZW5hbWVXaWRnZXQge1xuXHQvKipcblx0ICogQHJldHVybnMgYSBgYm9vbGVhbmAgc3RhbmRpbmcgZm9yIGBzaG91bGRGb2N1c0VkaXRvcmAsIGlmIHVzZXIgZGlkbid0IHBpY2sgYSBuZXcgbmFtZSwgb3IgYSB7QGxpbmsgUmVuYW1lV2lkZ2V0UmVzdWx0fVxuXHQgKi9cblx0Z2V0SW5wdXQoXG5cdFx0d2hlcmU6IElSYW5nZSxcblx0XHRjdXJyZW50TmFtZTogc3RyaW5nLFxuXHRcdHN1cHBvcnRQcmV2aWV3OiBib29sZWFuLFxuXHRcdHJlcXVlc3RSZW5hbWVTdWdnZXN0aW9uczogKHRyaWdnZXJLaW5kOiBOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQsIGN0czogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb3ZpZGVyUmVzdWx0PE5ld1N5bWJvbE5hbWVbXT5bXSxcblx0XHRjdHM6IENhbmNlbGxhdGlvblRva2VuU291cmNlXG5cdCk6IFByb21pc2U8UmVuYW1lV2lkZ2V0UmVzdWx0IHwgYm9vbGVhbj47XG5cblx0YWNjZXB0SW5wdXQod2FudHNQcmV2aWV3OiBib29sZWFuKTogdm9pZDtcblx0Y2FuY2VsSW5wdXQoZm9jdXNFZGl0b3I6IGJvb2xlYW4sIGNhbGxlcjogc3RyaW5nKTogdm9pZDtcblxuXHRmb2N1c05leHRSZW5hbWVTdWdnZXN0aW9uKCk6IHZvaWQ7XG5cdGZvY3VzUHJldmlvdXNSZW5hbWVTdWdnZXN0aW9uKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBSZW5hbWVXaWRnZXQgaW1wbGVtZW50cyBJUmVuYW1lV2lkZ2V0LCBJQ29udGVudFdpZGdldCwgSURpc3Bvc2FibGUge1xuXG5cdC8vIGltcGxlbWVudCBJQ29udGVudFdpZGdldFxuXHRyZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93OiBib29sZWFuID0gdHJ1ZTtcblxuXHQvLyBVSSBzdGF0ZVxuXG5cdHByaXZhdGUgX2RvbU5vZGU/OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfaW5wdXRXaXRoQnV0dG9uOiBJbnB1dFdpdGhCdXR0b247XG5cdHByaXZhdGUgX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3PzogUmVuYW1lQ2FuZGlkYXRlTGlzdFZpZXc7XG5cdHByaXZhdGUgX2xhYmVsPzogSFRNTERpdkVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBfblB4QXZhaWxhYmxlQWJvdmU/OiBudW1iZXI7XG5cdHByaXZhdGUgX25QeEF2YWlsYWJsZUJlbG93PzogbnVtYmVyO1xuXG5cdC8vIE1vZGVsIHN0YXRlXG5cblx0cHJpdmF0ZSBfcG9zaXRpb24/OiBQb3NpdGlvbjtcblx0cHJpdmF0ZSBfY3VycmVudE5hbWU/OiBzdHJpbmc7XG5cdC8qKiBJcyB0cnVlIGlmIGlucHV0IGZpZWxkIGdvdCBjaGFuZ2VzIHdoZW4gYSByZW5hbWUgY2FuZGlkYXRlIHdhcyBmb2N1c2VkOyBvdGhlcndpc2UsIGZhbHNlICovXG5cdHByaXZhdGUgX2lzRWRpdGluZ1JlbmFtZUNhbmRpZGF0ZTogYm9vbGVhbjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jYW5kaWRhdGVzOiBTZXQ8c3RyaW5nPjtcblxuXHRwcml2YXRlIF92aXNpYmxlPzogYm9vbGVhbjtcblxuXHQvKiogbXVzdCBiZSByZXNldCBhdCBzZXNzaW9uIHN0YXJ0ICovXG5cdHByaXZhdGUgX2JlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXRTVzogU3RvcFdhdGNoO1xuXG5cdC8qKlxuXHQgKiBNaWxsaXNlY29uZHMgYmVmb3JlIHVzZXIgZWRpdHMgdGhlIGlucHV0IGZpZWxkIGZvciB0aGUgZmlyc3QgdGltZVxuXHQgKiBAcmVtYXJrcyBtdXN0IGJlIHNldCBvbmNlIHBlciBzZXNzaW9uXG5cdCAqL1xuXHRwcml2YXRlIF90aW1lQmVmb3JlRmlyc3RJbnB1dEZpZWxkRWRpdDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX25SZW5hbWVTdWdnZXN0aW9uc0ludm9jYXRpb25zOiBudW1iZXI7XG5cblx0cHJpdmF0ZSBfaGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uOiBib29sZWFuO1xuXG5cdHByaXZhdGUgX3JlbmFtZUNhbmRpZGF0ZVByb3ZpZGVyc0N0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3JlbmFtZUN0czogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdmlzaWJsZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2FjY2VwdEtleWJpbmRpbmdzOiBbc3RyaW5nLCBzdHJpbmddLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2tleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fdmlzaWJsZUNvbnRleHRLZXkgPSBDT05URVhUX1JFTkFNRV9JTlBVVF9WSVNJQkxFLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9pc0VkaXRpbmdSZW5hbWVDYW5kaWRhdGUgPSBmYWxzZTtcblxuXHRcdHRoaXMuX25SZW5hbWVTdWdnZXN0aW9uc0ludm9jYXRpb25zID0gMDtcblxuXHRcdHRoaXMuX2hhZEF1dG9tYXRpY1JlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbiA9IGZhbHNlO1xuXG5cdFx0dGhpcy5fY2FuZGlkYXRlcyA9IG5ldyBTZXQoKTtcblxuXHRcdHRoaXMuX2JlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXRTVyA9IG5ldyBTdG9wV2F0Y2goKTtcblxuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbiA9IG5ldyBJbnB1dFdpdGhCdXR0b24oKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5faW5wdXRXaXRoQnV0dG9uKTtcblxuXHRcdHRoaXMuX2VkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5mb250SW5mbykpIHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlRm9udCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChfdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSh0aGlzLl91cGRhdGVTdHlsZXMsIHRoaXMpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2VkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0Z2V0SWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJ19fcmVuYW1lSW5wdXRXaWRnZXQnO1xuXHR9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0aWYgKCF0aGlzLl9kb21Ob2RlKSB7XG5cdFx0XHR0aGlzLl9kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTmFtZSA9ICdtb25hY28tZWRpdG9yIHJlbmFtZS1ib3gnO1xuXG5cdFx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5kb21Ob2RlKTtcblxuXHRcdFx0dGhpcy5fcmVuYW1lQ2FuZGlkYXRlTGlzdFZpZXcgPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRcdG5ldyBSZW5hbWVDYW5kaWRhdGVMaXN0Vmlldyh0aGlzLl9kb21Ob2RlLCB7XG5cdFx0XHRcdFx0Zm9udEluZm86IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmZvbnRJbmZvKSxcblx0XHRcdFx0XHRvbkZvY3VzQ2hhbmdlOiAobmV3U3ltYm9sTmFtZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24uaW5wdXQudmFsdWUgPSBuZXdTeW1ib2xOYW1lO1xuXHRcdFx0XHRcdFx0dGhpcy5faXNFZGl0aW5nUmVuYW1lQ2FuZGlkYXRlID0gZmFsc2U7IC8vIEB1bHVnYmVrbmE6IHJlc2V0XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvblNlbGVjdGlvbkNoYW5nZTogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5faXNFZGl0aW5nUmVuYW1lQ2FuZGlkYXRlID0gZmFsc2U7IC8vIEB1bHVnYmVrbmE6IGJlY2F1c2UgdXNlciBwaWNrZWQgYSByZW5hbWUgc3VnZ2VzdGlvblxuXHRcdFx0XHRcdFx0dGhpcy5hY2NlcHRJbnB1dChmYWxzZSk7IC8vIHdlIGRvbid0IGFsbG93IHByZXZpZXcgd2l0aCBtb3VzZSBjbGljayBmb3Igbm93XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24ub25EaWRJbnB1dENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3Py5mb2N1c2VkQ2FuZGlkYXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2lzRWRpdGluZ1JlbmFtZUNhbmRpZGF0ZSA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX3RpbWVCZWZvcmVGaXJzdElucHV0RmllbGRFZGl0ID8/PSB0aGlzLl9iZWZvcmVGaXJzdElucHV0RmllbGRFZGl0U1cuZWxhcHNlZCgpO1xuXHRcdFx0XHRcdGlmICh0aGlzLl9yZW5hbWVDYW5kaWRhdGVQcm92aWRlcnNDdHM/LnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkID09PSBmYWxzZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVuYW1lQ2FuZGlkYXRlUHJvdmlkZXJzQ3RzLmNhbmNlbCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLl9yZW5hbWVDYW5kaWRhdGVMaXN0Vmlldz8uY2xlYXJGb2N1cygpO1xuXHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdFx0dGhpcy5fbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdHRoaXMuX2xhYmVsLmNsYXNzTmFtZSA9ICdyZW5hbWUtbGFiZWwnO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9sYWJlbCk7XG5cblx0XHRcdHRoaXMuX3VwZGF0ZUZvbnQoKTtcblx0XHRcdHRoaXMuX3VwZGF0ZVN0eWxlcyh0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVTdHlsZXModGhlbWU6IElDb2xvclRoZW1lKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9kb21Ob2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgd2lkZ2V0U2hhZG93Q29sb3IgPSB0aGVtZS5nZXRDb2xvcih3aWRnZXRTaGFkb3cpO1xuXHRcdGNvbnN0IHdpZGdldEJvcmRlckNvbG9yID0gdGhlbWUuZ2V0Q29sb3Iod2lkZ2V0Qm9yZGVyKTtcblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFN0cmluZyh0aGVtZS5nZXRDb2xvcihlZGl0b3JXaWRnZXRCYWNrZ3JvdW5kKSA/PyAnJyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5ib3hTaGFkb3cgPSB3aWRnZXRTaGFkb3dDb2xvciA/IGAgMCAwIDhweCAycHggJHt3aWRnZXRTaGFkb3dDb2xvcn1gIDogJyc7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5ib3JkZXIgPSB3aWRnZXRCb3JkZXJDb2xvciA/IGAxcHggc29saWQgJHt3aWRnZXRCb3JkZXJDb2xvcn1gIDogJyc7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5jb2xvciA9IFN0cmluZyh0aGVtZS5nZXRDb2xvcihpbnB1dEZvcmVncm91bmQpID8/ICcnKTtcblxuXHRcdGNvbnN0IGJvcmRlciA9IHRoZW1lLmdldENvbG9yKGlucHV0Qm9yZGVyKTtcblxuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5kb21Ob2RlLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IFN0cmluZyh0aGVtZS5nZXRDb2xvcihpbnB1dEJhY2tncm91bmQpID8/ICcnKTtcblx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24uaW5wdXQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gU3RyaW5nKHRoZW1lLmdldENvbG9yKGlucHV0QmFja2dyb3VuZCkgPz8gJycpO1xuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5kb21Ob2RlLnN0eWxlLmJvcmRlcldpZHRoID0gYm9yZGVyID8gJzFweCcgOiAnMHB4Jztcblx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24uZG9tTm9kZS5zdHlsZS5ib3JkZXJTdHlsZSA9IGJvcmRlciA/ICdzb2xpZCcgOiAnbm9uZSc7XG5cdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmRvbU5vZGUuc3R5bGUuYm9yZGVyQ29sb3IgPSBib3JkZXI/LnRvU3RyaW5nKCkgPz8gJ25vbmUnO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRm9udCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZG9tTm9kZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGFzc2VydFR5cGUodGhpcy5fbGFiZWwgIT09IHVuZGVmaW5lZCwgJ1JlbmFtZVdpZGdldCNfdXBkYXRlRm9udDogX2xhYmVsIG11c3Qgbm90IGJlIHVuZGVmaW5lZCBnaXZlbiBfZG9tTm9kZSBpcyBkZWZpbmVkJyk7XG5cblx0XHR0aGlzLl9lZGl0b3IuYXBwbHlGb250SW5mbyh0aGlzLl9pbnB1dFdpdGhCdXR0b24uaW5wdXQpO1xuXG5cdFx0Y29uc3QgZm9udEluZm8gPSB0aGlzLl9lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0dGhpcy5fbGFiZWwuc3R5bGUuZm9udFNpemUgPSBgJHt0aGlzLl9jb21wdXRlTGFiZWxGb250U2l6ZShmb250SW5mby5mb250U2l6ZSl9cHhgO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZUxhYmVsRm9udFNpemUoZWRpdG9yRm9udFNpemU6IG51bWJlcikge1xuXHRcdHJldHVybiBlZGl0b3JGb250U2l6ZSAqIDAuODtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElDb250ZW50V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRpZiAoIXRoaXMuX3Zpc2libGUpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZWRpdG9yLmhhc01vZGVsKCkgfHwgLy8gQHVsdWdiZWtuYTogc2hvdWxkbid0IGhhcHBlblxuXHRcdFx0IXRoaXMuX2VkaXRvci5nZXREb21Ob2RlKCkgLy8gQHVsdWdiZWtuYTogY2FuIGhhcHBlbiBkdXJpbmcgdGVzdHMgYmFzZWQgb24gc3VnZ2VzdFdpZGdldCdzIHNpbWlsYXIgcHJlZGljYXRlIGNoZWNrXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBib2R5Qm94ID0gZG9tLmdldENsaWVudEFyZWEodGhpcy5nZXREb21Ob2RlKCkub3duZXJEb2N1bWVudC5ib2R5KTtcblx0XHRjb25zdCBlZGl0b3JCb3ggPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLl9lZGl0b3IuZ2V0RG9tTm9kZSgpKTtcblxuXHRcdGNvbnN0IGN1cnNvckJveFRvcCA9IHRoaXMuX2dldFRvcEZvclBvc2l0aW9uKCk7XG5cblx0XHR0aGlzLl9uUHhBdmFpbGFibGVBYm92ZSA9IGN1cnNvckJveFRvcCArIGVkaXRvckJveC50b3A7XG5cdFx0dGhpcy5fblB4QXZhaWxhYmxlQmVsb3cgPSBib2R5Qm94LmhlaWdodCAtIHRoaXMuX25QeEF2YWlsYWJsZUFib3ZlO1xuXG5cdFx0Y29uc3QgbGluZUhlaWdodCA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmxpbmVIZWlnaHQpO1xuXHRcdGNvbnN0IHsgdG90YWxIZWlnaHQ6IGNhbmRpZGF0ZVZpZXdIZWlnaHQgfSA9IFJlbmFtZUNhbmRpZGF0ZVZpZXcuZ2V0TGF5b3V0SW5mbyh7IGxpbmVIZWlnaHQgfSk7XG5cblx0XHRjb25zdCBwb3NpdGlvblByZWZlcmVuY2UgPSB0aGlzLl9uUHhBdmFpbGFibGVCZWxvdyA+IGNhbmRpZGF0ZVZpZXdIZWlnaHQgKiA2IC8qIGFwcHJveGltYXRlICMgb2YgY2FuZGlkYXRlcyB0byBmaXQgaW4gKGluY2x1c2l2ZSBvZiByZW5hbWUgaW5wdXQgYm94ICYgcmVuYW1lIGxhYmVsKSAqL1xuXHRcdFx0PyBbQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CRUxPVywgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5BQk9WRV1cblx0XHRcdDogW0NvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkUsIENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1ddO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBvc2l0aW9uOiB0aGlzLl9wb3NpdGlvbiEsXG5cdFx0XHRwcmVmZXJlbmNlOiBwb3NpdGlvblByZWZlcmVuY2UsXG5cdFx0fTtcblx0fVxuXG5cdGJlZm9yZVJlbmRlcigpOiBJRGltZW5zaW9uIHwgbnVsbCB7XG5cdFx0Y29uc3QgW2FjY2VwdCwgcHJldmlld10gPSB0aGlzLl9hY2NlcHRLZXliaW5kaW5ncztcblx0XHR0aGlzLl9sYWJlbCEuaW5uZXJUZXh0ID0gbmxzLmxvY2FsaXplKHsga2V5OiAnbGFiZWwnLCBjb21tZW50OiBbJ3BsYWNlaG9sZGVycyBhcmUga2V5YmluZGluZ3MsIGUuZyBcIkYyIHRvIFJlbmFtZSwgU2hpZnQrRjIgdG8gUHJldmlld1wiJ10gfSwgXCJ7MH0gdG8gUmVuYW1lLCB7MX0gdG8gUHJldmlld1wiLCB0aGlzLl9rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGFjY2VwdCk/LmdldExhYmVsKCksIHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcocHJldmlldyk/LmdldExhYmVsKCkpO1xuXG5cdFx0dGhpcy5fZG9tTm9kZSEuc3R5bGUubWluV2lkdGggPSBgMjAwcHhgOyAvLyB0byBwcmV2ZW50IGZyb20gd2lkZW5pbmcgd2hlbiBjYW5kaWRhdGVzIGNvbWUgaW5cblxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0YWZ0ZXJSZW5kZXIocG9zaXRpb246IENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UgfCBudWxsKTogdm9pZCB7XG5cdFx0Ly8gRklYTUVAdWx1Z2Jla25hOiBjb21tZW50aW5nIHRyYWNlIGxvZyBvdXQgdW50aWwgd2Ugc3RhcnQgdW5tb3VudGluZyB0aGUgd2lkZ2V0IGZyb20gZWRpdG9yIHByb3Blcmx5IC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIyNjk3NVxuXHRcdC8vIHRoaXMuX3RyYWNlKCdpbnZva2luZyBhZnRlclJlbmRlciwgcG9zaXRpb246ICcsIHBvc2l0aW9uID8gJ25vdCBudWxsJyA6ICdudWxsJyk7XG5cdFx0aWYgKHBvc2l0aW9uID09PSBudWxsKSB7XG5cdFx0XHQvLyBjYW5jZWwgcmVuYW1lIHdoZW4gaW5wdXQgd2lkZ2V0IGlzbid0IHJlbmRlcmVkIGFueW1vcmVcblx0XHRcdHRoaXMuY2FuY2VsSW5wdXQodHJ1ZSwgJ2FmdGVyUmVuZGVyIChiZWNhdXNlIHBvc2l0aW9uIGlzIG51bGwpJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSB8fCAvLyBzaG91bGRuJ3QgaGFwcGVuXG5cdFx0XHQhdGhpcy5fZWRpdG9yLmdldERvbU5vZGUoKSAvLyBjYW4gaGFwcGVuIGR1cmluZyB0ZXN0cyBiYXNlZCBvbiBzdWdnZXN0V2lkZ2V0J3Mgc2ltaWxhciBwcmVkaWNhdGUgY2hlY2tcblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhc3NlcnRUeXBlKHRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3KTtcblx0XHRhc3NlcnRUeXBlKHRoaXMuX25QeEF2YWlsYWJsZUFib3ZlICE9PSB1bmRlZmluZWQpO1xuXHRcdGFzc2VydFR5cGUodGhpcy5fblB4QXZhaWxhYmxlQmVsb3cgIT09IHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBpbnB1dEJveEhlaWdodCA9IGRvbS5nZXRUb3RhbEhlaWdodCh0aGlzLl9pbnB1dFdpdGhCdXR0b24uZG9tTm9kZSk7XG5cblx0XHRjb25zdCBsYWJlbEhlaWdodCA9IGRvbS5nZXRUb3RhbEhlaWdodCh0aGlzLl9sYWJlbCEpO1xuXG5cdFx0bGV0IHRvdGFsSGVpZ2h0QXZhaWxhYmxlOiBudW1iZXI7XG5cdFx0aWYgKHBvc2l0aW9uID09PSBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkJFTE9XKSB7XG5cdFx0XHR0b3RhbEhlaWdodEF2YWlsYWJsZSA9IHRoaXMuX25QeEF2YWlsYWJsZUJlbG93O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0b3RhbEhlaWdodEF2YWlsYWJsZSA9IHRoaXMuX25QeEF2YWlsYWJsZUFib3ZlO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3IS5sYXlvdXQoe1xuXHRcdFx0aGVpZ2h0OiB0b3RhbEhlaWdodEF2YWlsYWJsZSAtIGxhYmVsSGVpZ2h0IC0gaW5wdXRCb3hIZWlnaHQsXG5cdFx0XHR3aWR0aDogZG9tLmdldFRvdGFsV2lkdGgodGhpcy5faW5wdXRXaXRoQnV0dG9uLmRvbU5vZGUpLFxuXHRcdH0pO1xuXHR9XG5cblxuXHRwcml2YXRlIF9jdXJyZW50QWNjZXB0SW5wdXQ/OiAod2FudHNQcmV2aWV3OiBib29sZWFuKSA9PiB2b2lkO1xuXHRwcml2YXRlIF9jdXJyZW50Q2FuY2VsSW5wdXQ/OiAoZm9jdXNFZGl0b3I6IGJvb2xlYW4pID0+IHZvaWQ7XG5cdHByaXZhdGUgX3JlcXVlc3RSZW5hbWVDYW5kaWRhdGVzT25jZT86ICh0cmlnZ2VyS2luZDogTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLCBjdHM6IENhbmNlbGxhdGlvblRva2VuKSA9PiBQcm92aWRlclJlc3VsdDxOZXdTeW1ib2xOYW1lW10+W107XG5cblx0YWNjZXB0SW5wdXQod2FudHNQcmV2aWV3OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fdHJhY2UoYGludm9raW5nIGFjY2VwdElucHV0YCk7XG5cdFx0dGhpcy5fY3VycmVudEFjY2VwdElucHV0Py4od2FudHNQcmV2aWV3KTtcblx0fVxuXG5cdGNhbmNlbElucHV0KGZvY3VzRWRpdG9yOiBib29sZWFuLCBjYWxsZXI6IHN0cmluZyk6IHZvaWQge1xuXHRcdC8vIHRoaXMuX3RyYWNlKGBpbnZva2luZyBjYW5jZWxJbnB1dCwgY2FsbGVyOiAke2NhbGxlcn0sIF9jdXJyZW50Q2FuY2VsSW5wdXQ6ICR7dGhpcy5fY3VycmVudEFjY2VwdElucHV0ID8gJ25vdCB1bmRlZmluZWQnIDogJ3VuZGVmaW5lZCd9YCk7XG5cdFx0dGhpcy5fY3VycmVudENhbmNlbElucHV0Py4oZm9jdXNFZGl0b3IpO1xuXHR9XG5cblx0Zm9jdXNOZXh0UmVuYW1lU3VnZ2VzdGlvbigpIHtcblx0XHRpZiAoIXRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3Py5mb2N1c05leHQoKSkge1xuXHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmlucHV0LnZhbHVlID0gdGhpcy5fY3VycmVudE5hbWUhO1xuXHRcdH1cblx0fVxuXG5cdGZvY3VzUHJldmlvdXNSZW5hbWVTdWdnZXN0aW9uKCkgeyAvLyBUT0RPQHVsdWdiZWtuYTogdGhpcyBhbmQgZm9jdXNOZXh0IHNob3VsZCBzZXQgdGhlIG9yaWdpbmFsIG5hbWUgaWYgbm8gY2FuZGlkYXRlIGlzIGZvY3VzZWRcblx0XHRpZiAoIXRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3Py5mb2N1c1ByZXZpb3VzKCkpIHtcblx0XHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC52YWx1ZSA9IHRoaXMuX2N1cnJlbnROYW1lITtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQHBhcmFtIHJlcXVlc3RSZW5hbWVDYW5kaWRhdGVzIGlzIGB1bmRlZmluZWRgIHdoZW4gdGhlcmUgYXJlIG5vIHJlbmFtZSBzdWdnZXN0aW9uIHByb3ZpZGVyc1xuXHQgKi9cblx0Z2V0SW5wdXQoXG5cdFx0d2hlcmU6IElSYW5nZSxcblx0XHRjdXJyZW50TmFtZTogc3RyaW5nLFxuXHRcdHN1cHBvcnRQcmV2aWV3OiBib29sZWFuLFxuXHRcdHJlcXVlc3RSZW5hbWVDYW5kaWRhdGVzOiB1bmRlZmluZWQgfCAoKHRyaWdnZXJLaW5kOiBOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQsIGN0czogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFByb3ZpZGVyUmVzdWx0PE5ld1N5bWJvbE5hbWVbXT5bXSksXG5cdFx0Y3RzOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZVxuXHQpOiBQcm9taXNlPFJlbmFtZVdpZGdldFJlc3VsdCB8IGJvb2xlYW4+IHtcblxuXHRcdGNvbnN0IHsgc3RhcnQ6IHNlbGVjdGlvblN0YXJ0LCBlbmQ6IHNlbGVjdGlvbkVuZCB9ID0gdGhpcy5fZ2V0U2VsZWN0aW9uKHdoZXJlLCBjdXJyZW50TmFtZSk7XG5cblx0XHR0aGlzLl9yZW5hbWVDdHMgPSBjdHM7XG5cblx0XHRjb25zdCBkaXNwb3NlT25Eb25lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dGhpcy5fblJlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbnMgPSAwO1xuXG5cdFx0dGhpcy5faGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uID0gZmFsc2U7XG5cblx0XHRpZiAocmVxdWVzdFJlbmFtZUNhbmRpZGF0ZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24uYnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cblx0XHRcdHRoaXMuX3JlcXVlc3RSZW5hbWVDYW5kaWRhdGVzT25jZSA9IHJlcXVlc3RSZW5hbWVDYW5kaWRhdGVzO1xuXG5cdFx0XHR0aGlzLl9yZXF1ZXN0UmVuYW1lQ2FuZGlkYXRlcyhjdXJyZW50TmFtZSwgZmFsc2UpO1xuXG5cdFx0XHRkaXNwb3NlT25Eb25lLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKFxuXHRcdFx0XHR0aGlzLl9pbnB1dFdpdGhCdXR0b24uYnV0dG9uLFxuXHRcdFx0XHQnY2xpY2snLFxuXHRcdFx0XHQoKSA9PiB0aGlzLl9yZXF1ZXN0UmVuYW1lQ2FuZGlkYXRlcyhjdXJyZW50TmFtZSwgdHJ1ZSlcblx0XHRcdCkpO1xuXHRcdFx0ZGlzcG9zZU9uRG9uZS5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihcblx0XHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmJ1dHRvbixcblx0XHRcdFx0ZG9tLkV2ZW50VHlwZS5LRVlfRE9XTixcblx0XHRcdFx0KGUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBrZXlFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cblx0XHRcdFx0XHRpZiAoa2V5RXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpIHx8IGtleUV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSkge1xuXHRcdFx0XHRcdFx0a2V5RXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0XHRrZXlFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVxdWVzdFJlbmFtZUNhbmRpZGF0ZXMoY3VycmVudE5hbWUsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0KSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNFZGl0aW5nUmVuYW1lQ2FuZGlkYXRlID0gZmFsc2U7XG5cblx0XHR0aGlzLl9kb21Ob2RlIS5jbGFzc0xpc3QudG9nZ2xlKCdwcmV2aWV3Jywgc3VwcG9ydFByZXZpZXcpO1xuXG5cdFx0dGhpcy5fcG9zaXRpb24gPSBuZXcgUG9zaXRpb24od2hlcmUuc3RhcnRMaW5lTnVtYmVyLCB3aGVyZS5zdGFydENvbHVtbik7XG5cdFx0dGhpcy5fY3VycmVudE5hbWUgPSBjdXJyZW50TmFtZTtcblxuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC52YWx1ZSA9IGN1cnJlbnROYW1lO1xuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC5zZXRBdHRyaWJ1dGUoJ3NlbGVjdGlvblN0YXJ0Jywgc2VsZWN0aW9uU3RhcnQudG9TdHJpbmcoKSk7XG5cdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmlucHV0LnNldEF0dHJpYnV0ZSgnc2VsZWN0aW9uRW5kJywgc2VsZWN0aW9uRW5kLnRvU3RyaW5nKCkpO1xuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC5zaXplID0gTWF0aC5tYXgoKHdoZXJlLmVuZENvbHVtbiAtIHdoZXJlLnN0YXJ0Q29sdW1uKSAqIDEuMSwgMjApOyAvLyBkZXRlcm1pbmVzIHdpZHRoXG5cblx0XHR0aGlzLl9iZWZvcmVGaXJzdElucHV0RmllbGRFZGl0U1cucmVzZXQoKTtcblxuXG5cdFx0ZGlzcG9zZU9uRG9uZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3JlbmFtZUN0cyA9IHVuZGVmaW5lZDtcblx0XHRcdGN0cy5kaXNwb3NlKHRydWUpO1xuXHRcdH0pKTsgLy8gQHVsdWdiZWtuYTogdGhpcyBtYXkgcmVzdWx0IGluIGB0aGlzLmNhbmNlbElucHV0YCBiZWluZyBjYWxsZWQgdHdpY2UsIGJ1dCBpdCBzaG91bGQgYmUgc2FmZSBzaW5jZSB3ZSBzZXQgaXQgdG8gdW5kZWZpbmVkIGFmdGVyIDFzdCBjYWxsXG5cdFx0ZGlzcG9zZU9uRG9uZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9yZW5hbWVDYW5kaWRhdGVQcm92aWRlcnNDdHMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLl9yZW5hbWVDYW5kaWRhdGVQcm92aWRlcnNDdHMuZGlzcG9zZSh0cnVlKTtcblx0XHRcdFx0dGhpcy5fcmVuYW1lQ2FuZGlkYXRlUHJvdmlkZXJzQ3RzID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2VPbkRvbmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9jYW5kaWRhdGVzLmNsZWFyKCkpKTtcblxuXHRcdGNvbnN0IGlucHV0UmVzdWx0ID0gbmV3IERlZmVycmVkUHJvbWlzZTxSZW5hbWVXaWRnZXRSZXN1bHQgfCBib29sZWFuPigpO1xuXG5cdFx0aW5wdXRSZXN1bHQucC5maW5hbGx5KCgpID0+IHtcblx0XHRcdGRpc3Bvc2VPbkRvbmUuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5faGlkZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5fY3VycmVudENhbmNlbElucHV0ID0gKGZvY3VzRWRpdG9yKSA9PiB7XG5cdFx0XHR0aGlzLl90cmFjZSgnaW52b2tpbmcgX2N1cnJlbnRDYW5jZWxJbnB1dCcpO1xuXHRcdFx0dGhpcy5fY3VycmVudEFjY2VwdElucHV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fY3VycmVudENhbmNlbElucHV0ID0gdW5kZWZpbmVkO1xuXHRcdFx0Ly8gZml4bWUgc2Vzc2lvbiBjbGVhbnVwXG5cdFx0XHR0aGlzLl9yZW5hbWVDYW5kaWRhdGVMaXN0Vmlldz8uY2xlYXJDYW5kaWRhdGVzKCk7XG5cdFx0XHRpbnB1dFJlc3VsdC5jb21wbGV0ZShmb2N1c0VkaXRvcik7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fY3VycmVudEFjY2VwdElucHV0ID0gKHdhbnRzUHJldmlldykgPT4ge1xuXHRcdFx0dGhpcy5fdHJhY2UoJ2ludm9raW5nIF9jdXJyZW50QWNjZXB0SW5wdXQnKTtcblx0XHRcdGFzc2VydFR5cGUodGhpcy5fcmVuYW1lQ2FuZGlkYXRlTGlzdFZpZXcgIT09IHVuZGVmaW5lZCk7XG5cblx0XHRcdGNvbnN0IG5SZW5hbWVTdWdnZXN0aW9ucyA9IHRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3Lm5DYW5kaWRhdGVzO1xuXG5cdFx0XHRsZXQgbmV3TmFtZTogc3RyaW5nO1xuXHRcdFx0bGV0IHNvdXJjZTogTmV3TmFtZVNvdXJjZTtcblx0XHRcdGNvbnN0IGZvY3VzZWRDYW5kaWRhdGUgPSB0aGlzLl9yZW5hbWVDYW5kaWRhdGVMaXN0Vmlldy5mb2N1c2VkQ2FuZGlkYXRlO1xuXHRcdFx0aWYgKGZvY3VzZWRDYW5kaWRhdGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLl90cmFjZSgndXNpbmcgbmV3IG5hbWUgZnJvbSByZW5hbWVTdWdnZXN0aW9uJyk7XG5cdFx0XHRcdG5ld05hbWUgPSBmb2N1c2VkQ2FuZGlkYXRlO1xuXHRcdFx0XHRzb3VyY2UgPSB7IGs6ICdyZW5hbWVTdWdnZXN0aW9uJyB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fdHJhY2UoJ3VzaW5nIG5ldyBuYW1lIGZyb20gaW5wdXRGaWVsZCcpO1xuXHRcdFx0XHRuZXdOYW1lID0gdGhpcy5faW5wdXRXaXRoQnV0dG9uLmlucHV0LnZhbHVlO1xuXHRcdFx0XHRzb3VyY2UgPSB0aGlzLl9pc0VkaXRpbmdSZW5hbWVDYW5kaWRhdGUgPyB7IGs6ICd1c2VyRWRpdGVkUmVuYW1lU3VnZ2VzdGlvbicgfSA6IHsgazogJ2lucHV0RmllbGQnIH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChuZXdOYW1lID09PSBjdXJyZW50TmFtZSB8fCBuZXdOYW1lLnRyaW0oKS5sZW5ndGggPT09IDAgLyogaXMganVzdCB3aGl0ZXNwYWNlICovKSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsSW5wdXQodHJ1ZSwgJ19jdXJyZW50QWNjZXB0SW5wdXQgKGJlY2F1c2UgbmV3TmFtZSA9PT0gdmFsdWUgfHwgbmV3TmFtZS50cmltKCkubGVuZ3RoID09PSAwKScpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2N1cnJlbnRBY2NlcHRJbnB1dCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX2N1cnJlbnRDYW5jZWxJbnB1dCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3JlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3LmNsZWFyQ2FuZGlkYXRlcygpO1xuXHRcdFx0Ly8gZml4bWUgc2Vzc2lvbiBjbGVhbnVwXG5cblx0XHRcdGlucHV0UmVzdWx0LmNvbXBsZXRlKHtcblx0XHRcdFx0bmV3TmFtZSxcblx0XHRcdFx0d2FudHNQcmV2aWV3OiBzdXBwb3J0UHJldmlldyAmJiB3YW50c1ByZXZpZXcsXG5cdFx0XHRcdHN0YXRzOiB7XG5cdFx0XHRcdFx0c291cmNlLFxuXHRcdFx0XHRcdG5SZW5hbWVTdWdnZXN0aW9ucyxcblx0XHRcdFx0XHR0aW1lQmVmb3JlRmlyc3RJbnB1dEZpZWxkRWRpdDogdGhpcy5fdGltZUJlZm9yZUZpcnN0SW5wdXRGaWVsZEVkaXQsXG5cdFx0XHRcdFx0blJlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbnM6IHRoaXMuX25SZW5hbWVTdWdnZXN0aW9uc0ludm9jYXRpb25zLFxuXHRcdFx0XHRcdGhhZEF1dG9tYXRpY1JlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbjogdGhpcy5faGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0ZGlzcG9zZU9uRG9uZS5hZGQoY3RzLnRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHRoaXMuY2FuY2VsSW5wdXQodHJ1ZSwgJ2N0cy50b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCcpKSk7XG5cdFx0aWYgKCFfc3RpY2t5KSB7XG5cdFx0XHRkaXNwb3NlT25Eb25lLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRCbHVyRWRpdG9yV2lkZ2V0KCgpID0+IHRoaXMuY2FuY2VsSW5wdXQoIXRoaXMuX2RvbU5vZGU/Lm93bmVyRG9jdW1lbnQuaGFzRm9jdXMoKSwgJ2VkaXRvci5vbkRpZEJsdXJFZGl0b3JXaWRnZXQnKSkpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3Nob3coKTtcblxuXHRcdHJldHVybiBpbnB1dFJlc3VsdC5wO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVxdWVzdFJlbmFtZUNhbmRpZGF0ZXMoY3VycmVudE5hbWU6IHN0cmluZywgaXNNYW51YWxseVRyaWdnZXJlZDogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9yZXF1ZXN0UmVuYW1lQ2FuZGlkYXRlc09uY2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fcmVuYW1lQ2FuZGlkYXRlUHJvdmlkZXJzQ3RzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3JlbmFtZUNhbmRpZGF0ZVByb3ZpZGVyc0N0cy5kaXNwb3NlKHRydWUpO1xuXHRcdH1cblxuXHRcdGFzc2VydFR5cGUodGhpcy5fcmVuYW1lQ3RzKTtcblxuXHRcdGlmICh0aGlzLl9pbnB1dFdpdGhCdXR0b24uYnV0dG9uU3RhdGUgIT09ICdzdG9wJykge1xuXG5cdFx0XHR0aGlzLl9yZW5hbWVDYW5kaWRhdGVQcm92aWRlcnNDdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdFx0Y29uc3QgdHJpZ2dlcktpbmQgPSBpc01hbnVhbGx5VHJpZ2dlcmVkID8gTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLkludm9rZSA6IE5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZC5BdXRvbWF0aWM7XG5cdFx0XHRjb25zdCBjYW5kaWRhdGVzID0gdGhpcy5fcmVxdWVzdFJlbmFtZUNhbmRpZGF0ZXNPbmNlKHRyaWdnZXJLaW5kLCB0aGlzLl9yZW5hbWVDYW5kaWRhdGVQcm92aWRlcnNDdHMudG9rZW4pO1xuXG5cdFx0XHRpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLnNldFNwYXJrbGVCdXR0b24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWlzTWFudWFsbHlUcmlnZ2VyZWQpIHtcblx0XHRcdFx0dGhpcy5faGFkQXV0b21hdGljUmVuYW1lU3VnZ2VzdGlvbnNJbnZvY2F0aW9uID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fblJlbmFtZVN1Z2dlc3Rpb25zSW52b2NhdGlvbnMgKz0gMTtcblxuXHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLnNldFN0b3BCdXR0b24oKTtcblxuXHRcdFx0dGhpcy5fdXBkYXRlUmVuYW1lQ2FuZGlkYXRlcyhjYW5kaWRhdGVzLCBjdXJyZW50TmFtZSwgdGhpcy5fcmVuYW1lQ3RzLnRva2VuKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVGhpcyBhbGxvd3Mgc2VsZWN0aW5nIG9ubHkgcGFydCBvZiB0aGUgc3ltYm9sIG5hbWUgaW4gdGhlIGlucHV0IGZpZWxkIGJhc2VkIG9uIHRoZSBzZWxlY3Rpb24gaW4gdGhlIGVkaXRvclxuXHQgKi9cblx0cHJpdmF0ZSBfZ2V0U2VsZWN0aW9uKHdoZXJlOiBJUmFuZ2UsIGN1cnJlbnROYW1lOiBzdHJpbmcpOiB7IHN0YXJ0OiBudW1iZXI7IGVuZDogbnVtYmVyIH0ge1xuXHRcdGFzc2VydFR5cGUodGhpcy5fZWRpdG9yLmhhc01vZGVsKCkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdGxldCBzdGFydCA9IDA7XG5cdFx0bGV0IGVuZCA9IGN1cnJlbnROYW1lLmxlbmd0aDtcblxuXHRcdGlmICghUmFuZ2UuaXNFbXB0eShzZWxlY3Rpb24pICYmICFSYW5nZS5zcGFuc011bHRpcGxlTGluZXMoc2VsZWN0aW9uKSAmJiBSYW5nZS5jb250YWluc1JhbmdlKHdoZXJlLCBzZWxlY3Rpb24pKSB7XG5cdFx0XHRzdGFydCA9IE1hdGgubWF4KDAsIHNlbGVjdGlvbi5zdGFydENvbHVtbiAtIHdoZXJlLnN0YXJ0Q29sdW1uKTtcblx0XHRcdGVuZCA9IE1hdGgubWluKHdoZXJlLmVuZENvbHVtbiwgc2VsZWN0aW9uLmVuZENvbHVtbikgLSB3aGVyZS5zdGFydENvbHVtbjtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBzdGFydCwgZW5kIH07XG5cdH1cblxuXHRwcml2YXRlIF9zaG93KCk6IHZvaWQge1xuXHRcdHRoaXMuX3RyYWNlKCdpbnZva2luZyBfc2hvdycpO1xuXHRcdHRoaXMuX2VkaXRvci5yZXZlYWxMaW5lSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydCh0aGlzLl9wb3NpdGlvbiEubGluZU51bWJlciwgU2Nyb2xsVHlwZS5TbW9vdGgpO1xuXHRcdHRoaXMuX3Zpc2libGUgPSB0cnVlO1xuXHRcdHRoaXMuX3Zpc2libGVDb250ZXh0S2V5LnNldCh0cnVlKTtcblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblxuXHRcdC8vIFRPRE9AdWx1Z2Jla25hOiBjb3VsZCB0aGlzIGJlIHNpbXBseSBydW4gaW4gYGFmdGVyUmVuZGVyYD9cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC5mb2N1cygpO1xuXHRcdFx0dGhpcy5faW5wdXRXaXRoQnV0dG9uLmlucHV0LnNldFNlbGVjdGlvblJhbmdlKFxuXHRcdFx0XHRwYXJzZUludCh0aGlzLl9pbnB1dFdpdGhCdXR0b24uaW5wdXQuZ2V0QXR0cmlidXRlKCdzZWxlY3Rpb25TdGFydCcpISksXG5cdFx0XHRcdHBhcnNlSW50KHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5pbnB1dC5nZXRBdHRyaWJ1dGUoJ3NlbGVjdGlvbkVuZCcpISlcblx0XHRcdCk7XG5cdFx0fSwgMTAwKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZVJlbmFtZUNhbmRpZGF0ZXMoY2FuZGlkYXRlczogUHJvdmlkZXJSZXN1bHQ8TmV3U3ltYm9sTmFtZVtdPltdLCBjdXJyZW50TmFtZTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRjb25zdCB0cmFjZSA9ICguLi5hcmdzOiBhbnlbXSkgPT4gdGhpcy5fdHJhY2UoJ191cGRhdGVSZW5hbWVDYW5kaWRhdGVzJywgLi4uYXJncyk7XG5cblx0XHR0cmFjZSgnc3RhcnQnKTtcblx0XHRjb25zdCBuYW1lc0xpc3RSZXN1bHRzID0gYXdhaXQgcmFjZUNhbmNlbGxhdGlvbihQcm9taXNlLmFsbFNldHRsZWQoY2FuZGlkYXRlcyksIHRva2VuKTtcblxuXHRcdHRoaXMuX2lucHV0V2l0aEJ1dHRvbi5zZXRTcGFya2xlQnV0dG9uKCk7XG5cblx0XHRpZiAobmFtZXNMaXN0UmVzdWx0cyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0cmFjZSgncmV0dXJuaW5nIGVhcmx5IC0gcmVjZWl2ZWQgdXBkYXRlUmVuYW1lQ2FuZGlkYXRlcyByZXN1bHRzIC0gdW5kZWZpbmVkJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3TmFtZXMgPSBuYW1lc0xpc3RSZXN1bHRzLmZsYXRNYXAobmFtZXNMaXN0UmVzdWx0ID0+XG5cdFx0XHRuYW1lc0xpc3RSZXN1bHQuc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiBpc0RlZmluZWQobmFtZXNMaXN0UmVzdWx0LnZhbHVlKVxuXHRcdFx0XHQ/IG5hbWVzTGlzdFJlc3VsdC52YWx1ZVxuXHRcdFx0XHQ6IFtdXG5cdFx0KTtcblx0XHR0cmFjZShgcmVjZWl2ZWQgdXBkYXRlUmVuYW1lQ2FuZGlkYXRlcyByZXN1bHRzIC0gdG90YWwgKHVuZmlsdGVyZWQpICR7bmV3TmFtZXMubGVuZ3RofSBjYW5kaWRhdGVzLmApO1xuXG5cdFx0Ly8gZGVkdXBsaWNhdGUgYW5kIGZpbHRlciBvdXQgdGhlIGN1cnJlbnQgdmFsdWVcblxuXHRcdGNvbnN0IGRpc3RpbmN0TmFtZXMgPSBhcnJheXMuZGlzdGluY3QobmV3TmFtZXMsIHYgPT4gdi5uZXdTeW1ib2xOYW1lKTtcblx0XHR0cmFjZShgZGlzdGluY3QgY2FuZGlkYXRlcyAtICR7ZGlzdGluY3ROYW1lcy5sZW5ndGh9IGNhbmRpZGF0ZXMuYCk7XG5cblx0XHRjb25zdCB2YWxpZERpc3RpbmN0TmFtZXMgPSBkaXN0aW5jdE5hbWVzLmZpbHRlcigoeyBuZXdTeW1ib2xOYW1lIH0pID0+IG5ld1N5bWJvbE5hbWUudHJpbSgpLmxlbmd0aCA+IDAgJiYgbmV3U3ltYm9sTmFtZSAhPT0gdGhpcy5faW5wdXRXaXRoQnV0dG9uLmlucHV0LnZhbHVlICYmIG5ld1N5bWJvbE5hbWUgIT09IGN1cnJlbnROYW1lICYmICF0aGlzLl9jYW5kaWRhdGVzLmhhcyhuZXdTeW1ib2xOYW1lKSk7XG5cdFx0dHJhY2UoYHZhbGlkIGRpc3RpbmN0IGNhbmRpZGF0ZXMgLSAke25ld05hbWVzLmxlbmd0aH0gY2FuZGlkYXRlcy5gKTtcblxuXHRcdHZhbGlkRGlzdGluY3ROYW1lcy5mb3JFYWNoKG4gPT4gdGhpcy5fY2FuZGlkYXRlcy5hZGQobi5uZXdTeW1ib2xOYW1lKSk7XG5cblx0XHRpZiAodmFsaWREaXN0aW5jdE5hbWVzLmxlbmd0aCA8IDEpIHtcblx0XHRcdHRyYWNlKCdyZXR1cm5pbmcgZWFybHkgLSBubyB2YWxpZCBkaXN0aW5jdCBjYW5kaWRhdGVzJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gc2hvdyB0aGUgY2FuZGlkYXRlc1xuXHRcdHRyYWNlKCdzZXR0aW5nIGNhbmRpZGF0ZXMnKTtcblx0XHR0aGlzLl9yZW5hbWVDYW5kaWRhdGVMaXN0VmlldyEuc2V0Q2FuZGlkYXRlcyh2YWxpZERpc3RpbmN0TmFtZXMpO1xuXG5cdFx0Ly8gYXNrIGVkaXRvciB0byByZS1sYXlvdXQgZ2l2ZW4gdGhhdCB0aGUgd2lkZ2V0IGlzIG5vdyBvZiBhIGRpZmZlcmVudCBzaXplIGFmdGVyIHJlbmRlcmluZyByZW5hbWUgY2FuZGlkYXRlc1xuXHRcdHRyYWNlKCdhc2tpbmcgZWRpdG9yIHRvIHJlLWxheW91dCcpO1xuXHRcdHRoaXMuX2VkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLl90cmFjZSgnaW52b2tlZCBfaGlkZScpO1xuXHRcdHRoaXMuX3Zpc2libGUgPSBmYWxzZTtcblx0XHR0aGlzLl92aXNpYmxlQ29udGV4dEtleS5yZXNldCgpO1xuXHRcdHRoaXMuX2VkaXRvci5sYXlvdXRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VG9wRm9yUG9zaXRpb24oKTogbnVtYmVyIHtcblx0XHRjb25zdCB2aXNpYmxlUmFuZ2VzID0gdGhpcy5fZWRpdG9yLmdldFZpc2libGVSYW5nZXMoKTtcblx0XHRsZXQgZmlyc3RMaW5lSW5WaWV3cG9ydDogbnVtYmVyO1xuXHRcdGlmICh2aXNpYmxlUmFuZ2VzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZpcnN0TGluZUluVmlld3BvcnQgPSB2aXNpYmxlUmFuZ2VzWzBdLnN0YXJ0TGluZU51bWJlcjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdSZW5hbWVXaWRnZXQjX2dldFRvcEZvclBvc2l0aW9uOiB0aGlzIHNob3VsZCBub3QgaGFwcGVuIC0gdmlzaWJsZVJhbmdlcyBpcyBlbXB0eScpO1xuXHRcdFx0Zmlyc3RMaW5lSW5WaWV3cG9ydCA9IE1hdGgubWF4KDEsIHRoaXMuX3Bvc2l0aW9uIS5saW5lTnVtYmVyIC0gNSk7IC8vIEB1bHVnYmVrbmE6IGZhbGxiYWNrIHRvIGN1cnJlbnQgbGluZSBtaW51cyA1XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcih0aGlzLl9wb3NpdGlvbiEubGluZU51bWJlcikgLSB0aGlzLl9lZGl0b3IuZ2V0VG9wRm9yTGluZU51bWJlcihmaXJzdExpbmVJblZpZXdwb3J0KTtcblx0fVxuXG5cdHByaXZhdGUgX3RyYWNlKC4uLmFyZ3M6IHVua25vd25bXSkge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoJ1JlbmFtZVdpZGdldCcsIC4uLmFyZ3MpO1xuXHR9XG59XG5cbmNsYXNzIFJlbmFtZUNhbmRpZGF0ZUxpc3RWaWV3IHtcblxuXHQvKiogUGFyZW50IG5vZGUgb2YgdGhlIGxpc3Qgd2lkZ2V0OyBuZWVkZWQgdG8gY29udHJvbCAjIG9mIGxpc3QgZWxlbWVudHMgdmlzaWJsZSAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saXN0Q29udGFpbmVyOiBIVE1MRGl2RWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGlzdFdpZGdldDogTGlzdDxOZXdTeW1ib2xOYW1lPjtcblxuXHRwcml2YXRlIF9saW5lSGVpZ2h0OiBudW1iZXI7XG5cdHByaXZhdGUgX2F2YWlsYWJsZUhlaWdodDogbnVtYmVyO1xuXHRwcml2YXRlIF9taW5pbXVtV2lkdGg6IG51bWJlcjtcblx0cHJpdmF0ZSBfdHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBudW1iZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblxuXHQvLyBGSVhNRUB1bHVnYmVrbmE6IHJld3JpdGUgdXNpbmcgZXZlbnQgZW1pdHRlcnNcblx0Y29uc3RydWN0b3IocGFyZW50OiBIVE1MRWxlbWVudCwgb3B0czogeyBmb250SW5mbzogRm9udEluZm87IG9uRm9jdXNDaGFuZ2U6IChuZXdTeW1ib2xOYW1lOiBzdHJpbmcpID0+IHZvaWQ7IG9uU2VsZWN0aW9uQ2hhbmdlOiAoKSA9PiB2b2lkIH0pIHtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dGhpcy5fYXZhaWxhYmxlSGVpZ2h0ID0gMDtcblx0XHR0aGlzLl9taW5pbXVtV2lkdGggPSAwO1xuXG5cdFx0dGhpcy5fbGluZUhlaWdodCA9IG9wdHMuZm9udEluZm8ubGluZUhlaWdodDtcblx0XHR0aGlzLl90eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGggPSBvcHRzLmZvbnRJbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aDtcblxuXHRcdHRoaXMuX2xpc3RDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9saXN0Q29udGFpbmVyLmNsYXNzTmFtZSA9ICdyZW5hbWUtYm94IHJlbmFtZS1jYW5kaWRhdGUtbGlzdC1jb250YWluZXInO1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLl9saXN0Q29udGFpbmVyKTtcblxuXHRcdHRoaXMuX2xpc3RXaWRnZXQgPSBSZW5hbWVDYW5kaWRhdGVMaXN0Vmlldy5fY3JlYXRlTGlzdFdpZGdldCh0aGlzLl9saXN0Q29udGFpbmVyLCB0aGlzLl9jYW5kaWRhdGVWaWV3SGVpZ2h0LCBvcHRzLmZvbnRJbmZvKTtcblxuXHRcdHRoaXMuX2xpc3RXaWRnZXQub25EaWRDaGFuZ2VGb2N1cyhcblx0XHRcdGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5lbGVtZW50cy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHRvcHRzLm9uRm9jdXNDaGFuZ2UoZS5lbGVtZW50c1swXS5uZXdTeW1ib2xOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzXG5cdFx0KTtcblxuXHRcdHRoaXMuX2xpc3RXaWRnZXQub25EaWRDaGFuZ2VTZWxlY3Rpb24oXG5cdFx0XHRlID0+IHtcblx0XHRcdFx0aWYgKGUuZWxlbWVudHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0b3B0cy5vblNlbGVjdGlvbkNoYW5nZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXNcblx0XHQpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0dGhpcy5fbGlzdFdpZGdldC5vbkRpZEJsdXIoZSA9PiB7IC8vIEB1bHVnYmVrbmE6IGJlY2F1c2UgbGlzdCB3aWRnZXQgb3RoZXJ3aXNlIHJlbWVtYmVycyBsYXN0IGZvY3VzZWQgZWxlbWVudCBhbmQgcmV0dXJucyBpdCBhcyBmb2N1c2VkIGVsZW1lbnRcblx0XHRcdFx0dGhpcy5fbGlzdFdpZGdldC5zZXRGb2N1cyhbXSk7XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHR0aGlzLl9saXN0V2lkZ2V0LnN0eWxlKGdldExpc3RTdHlsZXMoe1xuXHRcdFx0bGlzdEluYWN0aXZlRm9jdXNGb3JlZ3JvdW5kOiBxdWlja0lucHV0TGlzdEZvY3VzRm9yZWdyb3VuZCxcblx0XHRcdGxpc3RJbmFjdGl2ZUZvY3VzQmFja2dyb3VuZDogcXVpY2tJbnB1dExpc3RGb2N1c0JhY2tncm91bmQsXG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9saXN0V2lkZ2V0LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHQvLyBoZWlnaHQgLSBtYXggaGVpZ2h0IGFsbG93ZWQgYnkgcGFyZW50IGVsZW1lbnRcblx0cHVibGljIGxheW91dCh7IGhlaWdodCwgd2lkdGggfTogeyBoZWlnaHQ6IG51bWJlcjsgd2lkdGg6IG51bWJlciB9KTogdm9pZCB7XG5cdFx0dGhpcy5fYXZhaWxhYmxlSGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHRoaXMuX21pbmltdW1XaWR0aCA9IHdpZHRoO1xuXHR9XG5cblx0cHVibGljIHNldENhbmRpZGF0ZXMoY2FuZGlkYXRlczogTmV3U3ltYm9sTmFtZVtdKTogdm9pZCB7XG5cblx0XHQvLyBpbnNlcnQgY2FuZGlkYXRlcyBpbnRvIGxpc3Qgd2lkZ2V0XG5cdFx0dGhpcy5fbGlzdFdpZGdldC5zcGxpY2UoMCwgMCwgY2FuZGlkYXRlcyk7XG5cblx0XHQvLyBhZGp1c3QgbGlzdCB3aWRnZXQgbGF5b3V0XG5cdFx0Y29uc3QgaGVpZ2h0ID0gdGhpcy5fcGlja0xpc3RIZWlnaHQodGhpcy5fbGlzdFdpZGdldC5sZW5ndGgpO1xuXHRcdGNvbnN0IHdpZHRoID0gdGhpcy5fcGlja0xpc3RXaWR0aChjYW5kaWRhdGVzKTtcblxuXHRcdHRoaXMuX2xpc3RXaWRnZXQubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXG5cdFx0Ly8gYWRqdXN0IGxpc3QgY29udGFpbmVyIGxheW91dFxuXHRcdHRoaXMuX2xpc3RDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7aGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9saXN0Q29udGFpbmVyLnN0eWxlLndpZHRoID0gYCR7d2lkdGh9cHhgO1xuXG5cdFx0YXJpYS5zdGF0dXMobmxzLmxvY2FsaXplKCdyZW5hbWVTdWdnZXN0aW9uc1JlY2VpdmVkQXJpYScsIFwiUmVjZWl2ZWQgezB9IHJlbmFtZSBzdWdnZXN0aW9uc1wiLCBjYW5kaWRhdGVzLmxlbmd0aCkpO1xuXHR9XG5cblx0cHVibGljIGNsZWFyQ2FuZGlkYXRlcygpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9ICcwcHgnO1xuXHRcdHRoaXMuX2xpc3RDb250YWluZXIuc3R5bGUud2lkdGggPSAnMHB4Jztcblx0XHR0aGlzLl9saXN0V2lkZ2V0LnNwbGljZSgwLCB0aGlzLl9saXN0V2lkZ2V0Lmxlbmd0aCwgW10pO1xuXHR9XG5cblx0cHVibGljIGdldCBuQ2FuZGlkYXRlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGlzdFdpZGdldC5sZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGZvY3VzZWRDYW5kaWRhdGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fbGlzdFdpZGdldC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2VsZWN0ZWRFbGVtZW50ID0gdGhpcy5fbGlzdFdpZGdldC5nZXRTZWxlY3RlZEVsZW1lbnRzKClbMF07XG5cdFx0aWYgKHNlbGVjdGVkRWxlbWVudCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gc2VsZWN0ZWRFbGVtZW50Lm5ld1N5bWJvbE5hbWU7XG5cdFx0fVxuXHRcdGNvbnN0IGZvY3VzZWRFbGVtZW50ID0gdGhpcy5fbGlzdFdpZGdldC5nZXRGb2N1c2VkRWxlbWVudHMoKVswXTtcblx0XHRpZiAoZm9jdXNlZEVsZW1lbnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGZvY3VzZWRFbGVtZW50Lm5ld1N5bWJvbE5hbWU7XG5cdFx0fVxuXHRcdHJldHVybjtcblx0fVxuXG5cdHB1YmxpYyBmb2N1c05leHQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2xpc3RXaWRnZXQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGZvY3VzZWRJeHMgPSB0aGlzLl9saXN0V2lkZ2V0LmdldEZvY3VzKCk7XG5cdFx0aWYgKGZvY3VzZWRJeHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9saXN0V2lkZ2V0LmZvY3VzRmlyc3QoKTtcblx0XHRcdHRoaXMuX2xpc3RXaWRnZXQucmV2ZWFsKDApO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChmb2N1c2VkSXhzWzBdID09PSB0aGlzLl9saXN0V2lkZ2V0Lmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0dGhpcy5fbGlzdFdpZGdldC5zZXRGb2N1cyhbXSk7XG5cdFx0XHRcdHRoaXMuX2xpc3RXaWRnZXQucmV2ZWFsKDApOyAvLyBAdWx1Z2Jla25hOiB3aXRob3V0IHRoaXMsIGl0IHNlZW1zIGxpa2UgZm9jdXNlZCBlbGVtZW50IGlzIG9ic3RydWN0ZWRcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbGlzdFdpZGdldC5mb2N1c05leHQoKTtcblx0XHRcdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMuX2xpc3RXaWRnZXQuZ2V0Rm9jdXMoKVswXTtcblx0XHRcdFx0dGhpcy5fbGlzdFdpZGdldC5yZXZlYWwoZm9jdXNlZCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyB0cnVlIGlmIGZvY3VzIGlzIG1vdmVkIHRvIHByZXZpb3VzIGVsZW1lbnRcblx0ICovXG5cdHB1YmxpYyBmb2N1c1ByZXZpb3VzKCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9saXN0V2lkZ2V0Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBmb2N1c2VkSXhzID0gdGhpcy5fbGlzdFdpZGdldC5nZXRGb2N1cygpO1xuXHRcdGlmIChmb2N1c2VkSXhzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5fbGlzdFdpZGdldC5mb2N1c0xhc3QoKTtcblx0XHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLl9saXN0V2lkZ2V0LmdldEZvY3VzKClbMF07XG5cdFx0XHR0aGlzLl9saXN0V2lkZ2V0LnJldmVhbChmb2N1c2VkKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoZm9jdXNlZEl4c1swXSA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLl9saXN0V2lkZ2V0LnNldEZvY3VzKFtdKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fbGlzdFdpZGdldC5mb2N1c1ByZXZpb3VzKCk7XG5cdFx0XHRcdGNvbnN0IGZvY3VzZWQgPSB0aGlzLl9saXN0V2lkZ2V0LmdldEZvY3VzKClbMF07XG5cdFx0XHRcdHRoaXMuX2xpc3RXaWRnZXQucmV2ZWFsKGZvY3VzZWQpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJGb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9saXN0V2lkZ2V0LnNldEZvY3VzKFtdKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IF9jYW5kaWRhdGVWaWV3SGVpZ2h0KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgeyB0b3RhbEhlaWdodCB9ID0gUmVuYW1lQ2FuZGlkYXRlVmlldy5nZXRMYXlvdXRJbmZvKHsgbGluZUhlaWdodDogdGhpcy5fbGluZUhlaWdodCB9KTtcblx0XHRyZXR1cm4gdG90YWxIZWlnaHQ7XG5cdH1cblxuXHRwcml2YXRlIF9waWNrTGlzdEhlaWdodChuQ2FuZGlkYXRlczogbnVtYmVyKSB7XG5cdFx0Y29uc3QgaGVpZ2h0VG9GaXRBbGxDYW5kaWRhdGVzID0gdGhpcy5fY2FuZGlkYXRlVmlld0hlaWdodCAqIG5DYW5kaWRhdGVzO1xuXHRcdGNvbnN0IE1BWF9OX0NBTkRJREFURVMgPSA3OyAgLy8gQHVsdWdiZWtuYTogbWF4ICMgb2YgY2FuZGlkYXRlcyB3ZSB3YW50IHRvIHNob3cgYXQgb25jZVxuXHRcdGNvbnN0IGhlaWdodCA9IE1hdGgubWluKGhlaWdodFRvRml0QWxsQ2FuZGlkYXRlcywgdGhpcy5fYXZhaWxhYmxlSGVpZ2h0LCB0aGlzLl9jYW5kaWRhdGVWaWV3SGVpZ2h0ICogTUFYX05fQ0FORElEQVRFUyk7XG5cdFx0cmV0dXJuIGhlaWdodDtcblx0fVxuXG5cdHByaXZhdGUgX3BpY2tMaXN0V2lkdGgoY2FuZGlkYXRlczogTmV3U3ltYm9sTmFtZVtdKTogbnVtYmVyIHtcblx0XHRjb25zdCBsb25nZXN0Q2FuZGlkYXRlV2lkdGggPSBNYXRoLmNlaWwoTWF0aC5tYXgoLi4uY2FuZGlkYXRlcy5tYXAoYyA9PiBjLm5ld1N5bWJvbE5hbWUubGVuZ3RoKSkgKiB0aGlzLl90eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGgpO1xuXHRcdGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoXG5cdFx0XHR0aGlzLl9taW5pbXVtV2lkdGgsXG5cdFx0XHQ0IC8qIHBhZGRpbmcgKi8gKyAxNiAvKiBzcGFya2xlIGljb24gKi8gKyA1IC8qIG1hcmdpbi1sZWZ0ICovICsgbG9uZ2VzdENhbmRpZGF0ZVdpZHRoICsgMTAgLyogKHBvc3NpYmx5IHZpc2libGUpIHNjcm9sbGJhciB3aWR0aCAqLyAvLyBUT0RPQHVsdWdiZWtuYTogYXBwcm94aW1hdGUgY2FsYyAtIGNsZWFuIHRoaXMgdXBcblx0XHQpO1xuXHRcdHJldHVybiB3aWR0aDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jcmVhdGVMaXN0V2lkZ2V0KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGNhbmRpZGF0ZVZpZXdIZWlnaHQ6IG51bWJlciwgZm9udEluZm86IEZvbnRJbmZvKSB7XG5cdFx0Y29uc3QgdmlydHVhbERlbGVnYXRlID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8TmV3U3ltYm9sTmFtZT4ge1xuXHRcdFx0Z2V0VGVtcGxhdGVJZChlbGVtZW50OiBOZXdTeW1ib2xOYW1lKTogc3RyaW5nIHtcblx0XHRcdFx0cmV0dXJuICdjYW5kaWRhdGUnO1xuXHRcdFx0fVxuXG5cdFx0XHRnZXRIZWlnaHQoZWxlbWVudDogTmV3U3ltYm9sTmFtZSk6IG51bWJlciB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGVWaWV3SGVpZ2h0O1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCByZW5kZXJlciA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8TmV3U3ltYm9sTmFtZSwgUmVuYW1lQ2FuZGlkYXRlVmlldz4ge1xuXHRcdFx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9ICdjYW5kaWRhdGUnO1xuXG5cdFx0XHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogUmVuYW1lQ2FuZGlkYXRlVmlldyB7XG5cdFx0XHRcdHJldHVybiBuZXcgUmVuYW1lQ2FuZGlkYXRlVmlldyhjb250YWluZXIsIGZvbnRJbmZvKTtcblx0XHRcdH1cblxuXHRcdFx0cmVuZGVyRWxlbWVudChjYW5kaWRhdGU6IE5ld1N5bWJvbE5hbWUsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogUmVuYW1lQ2FuZGlkYXRlVmlldyk6IHZvaWQge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEucG9wdWxhdGUoY2FuZGlkYXRlKTtcblx0XHRcdH1cblxuXHRcdFx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogUmVuYW1lQ2FuZGlkYXRlVmlldyk6IHZvaWQge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZXR1cm4gbmV3IExpc3QoXG5cdFx0XHQnTmV3U3ltYm9sTmFtZUNhbmRpZGF0ZXMnLFxuXHRcdFx0Y29udGFpbmVyLFxuXHRcdFx0dmlydHVhbERlbGVnYXRlLFxuXHRcdFx0W3JlbmRlcmVyXSxcblx0XHRcdHtcblx0XHRcdFx0a2V5Ym9hcmRTdXBwb3J0OiBmYWxzZSwgLy8gQHVsdWdiZWtuYTogYmVjYXVzZSB3ZSBoYW5kbGUga2V5Ym9hcmQgZXZlbnRzIHRocm91Z2ggcHJvcGVyIGNvbW1hbmRzICYga2V5YmluZGluZyBzZXJ2aWNlLCBzZWUgYHJlbmFtZS50c2Bcblx0XHRcdFx0bW91c2VTdXBwb3J0OiB0cnVlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cbn1cblxuY2xhc3MgSW5wdXRXaXRoQnV0dG9uIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2J1dHRvblN0YXRlOiAnc3BhcmtsZScgfCAnc3RvcCcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfZG9tTm9kZTogSFRNTERpdkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2lucHV0Tm9kZTogSFRNTElucHV0RWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYnV0dG9uTm9kZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2J1dHRvbkhvdmVyQ29udGVudDogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgX2J1dHRvbkdlbkhvdmVyVGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9idXR0b25DYW5jZWxIb3ZlclRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfc3BhcmtsZUljb246IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9zdG9wSWNvbjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRJbnB1dENoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZElucHV0Q2hhbmdlID0gdGhpcy5fb25EaWRJbnB1dENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRnZXQgZG9tTm9kZSgpIHtcblx0XHRpZiAoIXRoaXMuX2RvbU5vZGUpIHtcblxuXHRcdFx0dGhpcy5fZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc05hbWUgPSAncmVuYW1lLWlucHV0LXdpdGgtYnV0dG9uJztcblx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUuZGlzcGxheSA9ICdmbGV4Jztcblx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUuZmxleERpcmVjdGlvbiA9ICdyb3cnO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5hbGlnbkl0ZW1zID0gJ2NlbnRlcic7XG5cblx0XHRcdHRoaXMuX2lucHV0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG5cdFx0XHR0aGlzLl9pbnB1dE5vZGUuY2xhc3NOYW1lID0gJ3JlbmFtZS1pbnB1dCc7XG5cdFx0XHR0aGlzLl9pbnB1dE5vZGUudHlwZSA9ICd0ZXh0Jztcblx0XHRcdHRoaXMuX2lucHV0Tm9kZS5zdHlsZS5ib3JkZXIgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLl9pbnB1dE5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbmxzLmxvY2FsaXplKCdyZW5hbWVBcmlhTGFiZWwnLCBcIlJlbmFtZSBpbnB1dC4gVHlwZSBuZXcgbmFtZSBhbmQgcHJlc3MgRW50ZXIgdG8gY29tbWl0LlwiKSk7XG5cblx0XHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5faW5wdXROb2RlKTtcblxuXHRcdFx0dGhpcy5fYnV0dG9uTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0dGhpcy5fYnV0dG9uTm9kZS5jbGFzc05hbWUgPSAncmVuYW1lLXN1Z2dlc3Rpb25zLWJ1dHRvbic7XG5cdFx0XHR0aGlzLl9idXR0b25Ob2RlLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG5cdFx0XHR0aGlzLl9idXR0b25HZW5Ib3ZlclRleHQgPSBubHMubG9jYWxpemUoJ2dlbmVyYXRlUmVuYW1lU3VnZ2VzdGlvbnNCdXR0b24nLCBcIkdlbmVyYXRlIG5ldyBuYW1lIHN1Z2dlc3Rpb25zXCIpO1xuXHRcdFx0dGhpcy5fYnV0dG9uQ2FuY2VsSG92ZXJUZXh0ID0gbmxzLmxvY2FsaXplKCdjYW5jZWxSZW5hbWVTdWdnZXN0aW9uc0J1dHRvbicsIFwiQ2FuY2VsXCIpO1xuXHRcdFx0dGhpcy5fYnV0dG9uSG92ZXJDb250ZW50ID0gdGhpcy5fYnV0dG9uR2VuSG92ZXJUZXh0O1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGdldEJhc2VMYXllckhvdmVyRGVsZWdhdGUoKS5zZXR1cERlbGF5ZWRIb3Zlcih0aGlzLl9idXR0b25Ob2RlLCAoKSA9PiAoe1xuXHRcdFx0XHRjb250ZW50OiB0aGlzLl9idXR0b25Ib3ZlckNvbnRlbnQsXG5cdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRzaG93UG9pbnRlcjogdHJ1ZSxcblx0XHRcdFx0XHRjb21wYWN0OiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHR9KSkpO1xuXG5cdFx0XHR0aGlzLl9kb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2J1dHRvbk5vZGUpO1xuXG5cdFx0XHQvLyBub3RpZnkgaWYgc2VsZWN0aW9uIGNoYW5nZXMgdG8gY2FuY2VsIHJlcXVlc3QgdG8gcmVuYW1lLXN1Z2dlc3Rpb24gcHJvdmlkZXJzXG5cblx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuaW5wdXQsIGRvbS5FdmVudFR5cGUuSU5QVVQsICgpID0+IHRoaXMuX29uRGlkSW5wdXRDaGFuZ2UuZmlyZSgpKSk7XG5cdFx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmlucHV0LCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCAoZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBrZXlFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdGlmIChrZXlFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkxlZnRBcnJvdyB8fCBrZXlFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLlJpZ2h0QXJyb3cpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZElucHV0Q2hhbmdlLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5pbnB1dCwgZG9tLkV2ZW50VHlwZS5DTElDSywgKCkgPT4gdGhpcy5fb25EaWRJbnB1dENoYW5nZS5maXJlKCkpKTtcblxuXHRcdFx0Ly8gZm9jdXMgXCJjb250YWluZXJcIiBib3JkZXIgaW5zdGVhZCBvZiBpbnB1dCBib3hcblxuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5pbnB1dCwgZG9tLkV2ZW50VHlwZS5GT0NVUywgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUub3V0bGluZVdpZHRoID0gJzFweCc7XG5cdFx0XHRcdHRoaXMuZG9tTm9kZS5zdHlsZS5vdXRsaW5lU3R5bGUgPSAnc29saWQnO1xuXHRcdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUub3V0bGluZU9mZnNldCA9ICctMXB4Jztcblx0XHRcdFx0dGhpcy5kb21Ob2RlLnN0eWxlLm91dGxpbmVDb2xvciA9ICd2YXIoLS12c2NvZGUtZm9jdXNCb3JkZXIpJztcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuaW5wdXQsIGRvbS5FdmVudFR5cGUuQkxVUiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRvbU5vZGUuc3R5bGUub3V0bGluZSA9ICdub25lJztcblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRnZXQgaW5wdXQoKSB7XG5cdFx0YXNzZXJ0VHlwZSh0aGlzLl9pbnB1dE5vZGUpO1xuXHRcdHJldHVybiB0aGlzLl9pbnB1dE5vZGU7XG5cdH1cblxuXHRnZXQgYnV0dG9uKCkge1xuXHRcdGFzc2VydFR5cGUodGhpcy5fYnV0dG9uTm9kZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2J1dHRvbk5vZGU7XG5cdH1cblxuXHRnZXQgYnV0dG9uU3RhdGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2J1dHRvblN0YXRlO1xuXHR9XG5cblx0c2V0U3BhcmtsZUJ1dHRvbigpIHtcblx0XHR0aGlzLl9idXR0b25TdGF0ZSA9ICdzcGFya2xlJztcblx0XHR0aGlzLl9zcGFya2xlSWNvbiA/Pz0gcmVuZGVySWNvbihDb2RpY29uLnNwYXJrbGUpO1xuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5idXR0b24pO1xuXHRcdHRoaXMuYnV0dG9uLmFwcGVuZENoaWxkKHRoaXMuX3NwYXJrbGVJY29uKTtcblx0XHR0aGlzLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnR2VuZXJhdGluZyBuZXcgbmFtZSBzdWdnZXN0aW9ucycpO1xuXHRcdHRoaXMuX2J1dHRvbkhvdmVyQ29udGVudCA9IHRoaXMuX2J1dHRvbkdlbkhvdmVyVGV4dCE7XG5cdFx0dGhpcy5pbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0c2V0U3RvcEJ1dHRvbigpIHtcblx0XHR0aGlzLl9idXR0b25TdGF0ZSA9ICdzdG9wJztcblx0XHR0aGlzLl9zdG9wSWNvbiA/Pz0gcmVuZGVySWNvbihDb2RpY29uLnN0b3BDaXJjbGUpO1xuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5idXR0b24pO1xuXHRcdHRoaXMuYnV0dG9uLmFwcGVuZENoaWxkKHRoaXMuX3N0b3BJY29uKTtcblx0XHR0aGlzLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnQ2FuY2VsIGdlbmVyYXRpbmcgbmV3IG5hbWUgc3VnZ2VzdGlvbnMnKTtcblx0XHR0aGlzLl9idXR0b25Ib3ZlckNvbnRlbnQgPSB0aGlzLl9idXR0b25DYW5jZWxIb3ZlclRleHQhO1xuXHRcdHRoaXMuaW5wdXQuZm9jdXMoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFJlbmFtZUNhbmRpZGF0ZVZpZXcge1xuXG5cdHByaXZhdGUgc3RhdGljIF9QQURESU5HOiBudW1iZXIgPSAyO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pY29uOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGFiZWw6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKHBhcmVudDogSFRNTEVsZW1lbnQsIGZvbnRJbmZvOiBGb250SW5mbykge1xuXG5cdFx0dGhpcy5fZG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NOYW1lID0gJ3JlbmFtZS1ib3ggcmVuYW1lLWNhbmRpZGF0ZSc7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5kaXNwbGF5ID0gYGZsZXhgO1xuXHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUuY29sdW1uR2FwID0gYDVweGA7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5hbGlnbkl0ZW1zID0gYGNlbnRlcmA7XG5cdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS5oZWlnaHQgPSBgJHtmb250SW5mby5saW5lSGVpZ2h0fXB4YDtcblx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLnBhZGRpbmcgPSBgJHtSZW5hbWVDYW5kaWRhdGVWaWV3Ll9QQURESU5HfXB4YDtcblxuXHRcdC8vIEB1bHVnYmVrbmE6IG5lZWRlZCB0byBrZWVwIHNwYWNlIHdoZW4gdGhlIGBpY29uLnN0eWxlLmRpc3BsYXlgIGlzIHNldCB0byBgbm9uZWBcblx0XHRjb25zdCBpY29uQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0aWNvbkNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gYGZsZXhgO1xuXHRcdGljb25Db250YWluZXIuc3R5bGUuYWxpZ25JdGVtcyA9IGBjZW50ZXJgO1xuXHRcdGljb25Db250YWluZXIuc3R5bGUud2lkdGggPSBpY29uQ29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke2ZvbnRJbmZvLmxpbmVIZWlnaHQgKiAwLjh9cHhgO1xuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQoaWNvbkNvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9pY29uID0gcmVuZGVySWNvbihDb2RpY29uLnNwYXJrbGUpO1xuXHRcdHRoaXMuX2ljb24uc3R5bGUuZGlzcGxheSA9IGBub25lYDtcblx0XHRpY29uQ29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuX2ljb24pO1xuXG5cdFx0dGhpcy5fbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb21Gb250SW5mby5hcHBseUZvbnRJbmZvKHRoaXMuX2xhYmVsLCBmb250SW5mbyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9sYWJlbCk7XG5cblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5fZG9tTm9kZSk7XG5cdH1cblxuXHRwdWJsaWMgcG9wdWxhdGUodmFsdWU6IE5ld1N5bWJvbE5hbWUpIHtcblx0XHR0aGlzLl91cGRhdGVJY29uKHZhbHVlKTtcblx0XHR0aGlzLl91cGRhdGVMYWJlbCh2YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVJY29uKHZhbHVlOiBOZXdTeW1ib2xOYW1lKSB7XG5cdFx0Y29uc3QgaXNBSUdlbmVyYXRlZCA9ICEhdmFsdWUudGFncz8uaW5jbHVkZXMoTmV3U3ltYm9sTmFtZVRhZy5BSUdlbmVyYXRlZCk7XG5cdFx0dGhpcy5faWNvbi5zdHlsZS5kaXNwbGF5ID0gaXNBSUdlbmVyYXRlZCA/ICdpbmhlcml0JyA6ICdub25lJztcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUxhYmVsKHZhbHVlOiBOZXdTeW1ib2xOYW1lKSB7XG5cdFx0dGhpcy5fbGFiZWwuaW5uZXJUZXh0ID0gdmFsdWUubmV3U3ltYm9sTmFtZTtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgZ2V0TGF5b3V0SW5mbyh7IGxpbmVIZWlnaHQgfTogeyBsaW5lSGVpZ2h0OiBudW1iZXIgfSk6IHsgdG90YWxIZWlnaHQ6IG51bWJlciB9IHtcblx0XHRjb25zdCB0b3RhbEhlaWdodCA9IGxpbmVIZWlnaHQgKyBSZW5hbWVDYW5kaWRhdGVWaWV3Ll9QQURESU5HICogMiAvKiB0b3AgJiBib3R0b20gcGFkZGluZyAqLztcblx0XHRyZXR1cm4geyB0b3RhbEhlaWdodCB9O1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKSB7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFlBQVksVUFBVTtBQUN0QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLFlBQVk7QUFDckIsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsaUJBQWlCLHdCQUF3QjtBQUNsRCxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBOEIsb0JBQW9CO0FBQzNELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsWUFBWSxpQkFBaUI7QUFDdEMsT0FBTztBQUNQLFlBQVksaUJBQWlCO0FBQzdCLFNBQVMsdUNBQTRGO0FBQ3JHLFNBQVMsb0JBQW9CO0FBRzdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBd0Isa0JBQWtCLGdDQUFnRDtBQUMxRixZQUFZLFNBQVM7QUFDckIsU0FBc0Isb0JBQW9CLHFC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
