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
import * as DOM from "../../../../../../base/browser/dom.js";
import { alert as alertFn } from "../../../../../../base/browser/ui/aria/aria.js";
import { KeyCode, KeyMod } from "../../../../../../base/common/keyCodes.js";
import { Lazy } from "../../../../../../base/common/lazy.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import * as strings from "../../../../../../base/common/strings.js";
import { MATCHES_LIMIT } from "../../../../../../editor/contrib/find/browser/findModel.js";
import { FindReplaceState } from "../../../../../../editor/contrib/find/browser/findState.js";
import { NLS_MATCHES_LOCATION, NLS_NO_RESULTS } from "../../../../../../editor/contrib/find/browser/findWidget.js";
import { localize } from "../../../../../../nls.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { FindModel } from "./findModel.js";
import { SimpleFindReplaceWidget } from "./notebookFindReplaceWidget.js";
import { CellEditState } from "../../notebookBrowser.js";
import { KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED } from "../../../common/notebookContextKeys.js";
const FIND_HIDE_TRANSITION = "find-hide-transition";
const FIND_SHOW_TRANSITION = "find-show-transition";
let MAX_MATCHES_COUNT_WIDTH = 69;
const PROGRESS_BAR_DELAY = 200;
let NotebookFindContrib = class extends Disposable {
  constructor(notebookEditor, instantiationService) {
    super();
    this.notebookEditor = notebookEditor;
    this.instantiationService = instantiationService;
    this._widget = new Lazy(() => this._register(this.instantiationService.createInstance(NotebookFindWidget, this.notebookEditor)));
  }
  get widget() {
    return this._widget.value;
  }
  show(initialInput, options) {
    return this._widget.value.show(initialInput, options);
  }
  hide() {
    this._widget.rawValue?.hide();
  }
  replace(searchString) {
    return this._widget.value.replace(searchString);
  }
};
NotebookFindContrib.id = "workbench.notebook.find";
NotebookFindContrib = __decorateClass([
  __decorateParam(1, IInstantiationService)
], NotebookFindContrib);
let NotebookFindWidget = class extends SimpleFindReplaceWidget {
  constructor(_notebookEditor, contextViewService, contextKeyService, configurationService, contextMenuService, hoverService, instantiationService) {
    super(contextViewService, contextKeyService, configurationService, contextMenuService, instantiationService, hoverService, new FindReplaceState(), _notebookEditor);
    this._isFocused = false;
    this._showTimeout = null;
    this._hideTimeout = null;
    this._findModel = new FindModel(this._notebookEditor, this._state, this._configurationService);
    DOM.append(this._notebookEditor.getDomNode(), this.getDomNode());
    this._findWidgetFocused = KEYBINDING_CONTEXT_NOTEBOOK_FIND_WIDGET_FOCUSED.bindTo(contextKeyService);
    this._register(this._findInput.onKeyDown((e) => this._onFindInputKeyDown(e)));
    this._register(this._replaceInput.onKeyDown((e) => this._onReplaceInputKeyDown(e)));
    this._register(this._state.onFindReplaceStateChange((e) => {
      this.onInputChanged();
      if (e.isSearching) {
        if (this._state.isSearching) {
          this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
        } else {
          this._progressBar.stop().hide();
        }
      }
      if (this._findModel.currentMatch >= 0) {
        const currentMatch = this._findModel.getCurrentMatch();
        this._replaceBtn.setEnabled(currentMatch.isModelMatch);
      }
      const matches = this._findModel.findMatches;
      this._replaceAllBtn.setEnabled(matches.length > 0 && matches.find((match) => match.webviewMatches.length > 0) === void 0);
      if (e.filters) {
        this._findInput.updateFilterState(this._state.filters?.isModified() ?? false);
      }
    }));
    this._register(DOM.addDisposableListener(this.getDomNode(), DOM.EventType.FOCUS, (e) => {
      this._previousFocusElement = DOM.isHTMLElement(e.relatedTarget) ? e.relatedTarget : void 0;
    }, true));
  }
  get findModel() {
    return this._findModel;
  }
  get isFocused() {
    return this._isFocused;
  }
  _onFindInputKeyDown(e) {
    if (e.equals(KeyCode.Enter)) {
      this.find(false);
      e.preventDefault();
      return;
    } else if (e.equals(KeyMod.Shift | KeyCode.Enter)) {
      this.find(true);
      e.preventDefault();
      return;
    }
  }
  _onReplaceInputKeyDown(e) {
    if (e.equals(KeyCode.Enter)) {
      this.replaceOne();
      e.preventDefault();
      return;
    }
  }
  onInputChanged() {
    this._state.change({ searchString: this.inputValue }, false);
    const findMatches = this._findModel.findMatches;
    if (findMatches && findMatches.length) {
      return true;
    }
    return false;
  }
  findIndex(index) {
    this._findModel.find({ index });
  }
  find(previous) {
    this._findModel.find({ previous });
  }
  replaceOne() {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    if (!this._findModel.findMatches.length) {
      return;
    }
    this._findModel.ensureFindMatches();
    if (this._findModel.currentMatch < 0) {
      this._findModel.find({ previous: false });
    }
    const currentMatch = this._findModel.getCurrentMatch();
    const cell = currentMatch.cell;
    if (currentMatch.isModelMatch) {
      const match = currentMatch.match;
      this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
      const replacePattern = this.replacePattern;
      const replaceString = replacePattern.buildReplaceString(match.matches, this._state.preserveCase);
      const viewModel = this._notebookEditor.getViewModel();
      viewModel.replaceOne(cell, match.range, replaceString).then(() => {
        this._progressBar.stop();
      });
    } else {
      console.error("Replace does not work for output match");
    }
  }
  replaceAll() {
    if (!this._notebookEditor.hasModel()) {
      return;
    }
    this._progressBar.infinite().show(PROGRESS_BAR_DELAY);
    const replacePattern = this.replacePattern;
    const cellFindMatches = this._findModel.findMatches;
    const replaceStrings = [];
    cellFindMatches.forEach((cellFindMatch) => {
      cellFindMatch.contentMatches.forEach((match) => {
        const matches = match.matches;
        replaceStrings.push(replacePattern.buildReplaceString(matches, this._state.preserveCase));
      });
    });
    const viewModel = this._notebookEditor.getViewModel();
    viewModel.replaceAll(this._findModel.findMatches, replaceStrings).then(() => {
      this._progressBar.stop();
    });
  }
  findFirst() {
  }
  onFocusTrackerFocus() {
    this._findWidgetFocused.set(true);
    this._isFocused = true;
  }
  onFocusTrackerBlur() {
    this._previousFocusElement = void 0;
    this._findWidgetFocused.reset();
    this._isFocused = false;
  }
  onReplaceInputFocusTrackerFocus() {
  }
  onReplaceInputFocusTrackerBlur() {
  }
  onFindInputFocusTrackerFocus() {
  }
  onFindInputFocusTrackerBlur() {
  }
  async show(initialInput, options) {
    const searchStringUpdate = this._state.searchString !== initialInput;
    super.show(initialInput, options);
    this._state.change({ searchString: initialInput ?? this._state.searchString, isRevealed: true }, false);
    if (typeof options?.matchIndex === "number") {
      if (!this._findModel.findMatches.length) {
        await this._findModel.research();
      }
      this.findIndex(options.matchIndex);
    } else {
      this._findInput.select();
    }
    if (!searchStringUpdate && options?.searchStringSeededFrom) {
      this._findModel.refreshCurrentMatch(options.searchStringSeededFrom);
    }
    if (this._showTimeout === null) {
      if (this._hideTimeout !== null) {
        DOM.getWindow(this.getDomNode()).clearTimeout(this._hideTimeout);
        this._hideTimeout = null;
        this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
      }
      this._notebookEditor.addClassName(FIND_SHOW_TRANSITION);
      this._showTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
        this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
        this._showTimeout = null;
      }, 200);
    } else {
    }
  }
  replace(initialFindInput, initialReplaceInput) {
    super.showWithReplace(initialFindInput, initialReplaceInput);
    this._state.change({ searchString: initialFindInput ?? "", replaceString: initialReplaceInput ?? "", isRevealed: true }, false);
    this._replaceInput.select();
    if (this._showTimeout === null) {
      if (this._hideTimeout !== null) {
        DOM.getWindow(this.getDomNode()).clearTimeout(this._hideTimeout);
        this._hideTimeout = null;
        this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
      }
      this._notebookEditor.addClassName(FIND_SHOW_TRANSITION);
      this._showTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
        this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
        this._showTimeout = null;
      }, 200);
    } else {
    }
  }
  hide() {
    super.hide();
    this._state.change({ isRevealed: false }, false);
    this._findModel.clear();
    this._notebookEditor.findStop();
    this._progressBar.stop();
    if (this._hideTimeout === null) {
      if (this._showTimeout !== null) {
        DOM.getWindow(this.getDomNode()).clearTimeout(this._showTimeout);
        this._showTimeout = null;
        this._notebookEditor.removeClassName(FIND_SHOW_TRANSITION);
      }
      this._notebookEditor.addClassName(FIND_HIDE_TRANSITION);
      this._hideTimeout = DOM.getWindow(this.getDomNode()).setTimeout(() => {
        this._notebookEditor.removeClassName(FIND_HIDE_TRANSITION);
      }, 200);
    } else {
    }
    if (this._previousFocusElement && this._previousFocusElement.offsetParent) {
      this._previousFocusElement.focus();
      this._previousFocusElement = void 0;
    }
    if (this._notebookEditor.hasModel()) {
      for (let i = 0; i < this._notebookEditor.getLength(); i++) {
        const cell = this._notebookEditor.cellAt(i);
        if (cell.getEditState() === CellEditState.Editing && cell.editStateSource === "find") {
          cell.updateEditState(CellEditState.Preview, "closeFind");
        }
      }
    }
  }
  _updateMatchesCount() {
    if (!this._findModel || !this._findModel.findMatches) {
      return;
    }
    this._matchesCount.style.width = MAX_MATCHES_COUNT_WIDTH + "px";
    this._matchesCount.title = "";
    this._matchesCount.firstChild?.remove();
    let label;
    if (this._state.matchesCount > 0) {
      let matchesCount = String(this._state.matchesCount);
      if (this._state.matchesCount >= MATCHES_LIMIT) {
        matchesCount += "+";
      }
      const matchesPosition = this._findModel.currentMatch < 0 ? "?" : String(this._findModel.currentMatch + 1);
      label = strings.format(NLS_MATCHES_LOCATION, matchesPosition, matchesCount);
    } else {
      label = NLS_NO_RESULTS;
    }
    this._matchesCount.appendChild(document.createTextNode(label));
    alertFn(this._getAriaLabel(label, this._state.currentMatch, this._state.searchString));
    MAX_MATCHES_COUNT_WIDTH = Math.max(MAX_MATCHES_COUNT_WIDTH, this._matchesCount.clientWidth);
  }
  _getAriaLabel(label, currentMatch, searchString) {
    if (label === NLS_NO_RESULTS) {
      return searchString === "" ? localize("ariaSearchNoResultEmpty", "{0} found", label) : localize("ariaSearchNoResult", "{0} found for '{1}'", label, searchString);
    }
    return localize("ariaSearchNoResultWithLineNumNoCurrentMatch", "{0} found for '{1}'", label, searchString);
  }
  dispose() {
    this._notebookEditor?.removeClassName(FIND_SHOW_TRANSITION);
    this._notebookEditor?.removeClassName(FIND_HIDE_TRANSITION);
    this._findModel.dispose();
    super.dispose();
  }
};
NotebookFindWidget = __decorateClass([
  __decorateParam(1, IContextViewService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IInstantiationService)
], NotebookFindWidget);
export {
  NotebookFindContrib
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZmluZC9ub3RlYm9va0ZpbmRXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IGFsZXJ0IGFzIGFsZXJ0Rm4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IEZpbmRNYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgTUFUQ0hFU19MSU1JVCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kTW9kZWwuanMnO1xuaW1wb3J0IHsgRmluZFJlcGxhY2VTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kU3RhdGUuanMnO1xuaW1wb3J0IHsgTkxTX01BVENIRVNfTE9DQVRJT04sIE5MU19OT19SRVNVTFRTIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZmluZC9icm93c2VyL2ZpbmRXaWRnZXQuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlLCBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IE5vdGVib29rRmluZEZpbHRlcnMgfSBmcm9tICcuL2ZpbmRGaWx0ZXJzLmpzJztcbmltcG9ydCB7IEZpbmRNb2RlbCB9IGZyb20gJy4vZmluZE1vZGVsLmpzJztcbmltcG9ydCB7IFNpbXBsZUZpbmRSZXBsYWNlV2lkZ2V0IH0gZnJvbSAnLi9ub3RlYm9va0ZpbmRSZXBsYWNlV2lkZ2V0LmpzJztcbmltcG9ydCB7IENlbGxFZGl0U3RhdGUsIElDZWxsVmlld01vZGVsLCBJTm90ZWJvb2tFZGl0b3IsIElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tGaW5kU2NvcGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgS0VZQklORElOR19DT05URVhUX05PVEVCT09LX0ZJTkRfV0lER0VUX0ZPQ1VTRUQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb250ZXh0S2V5cy5qcyc7XG5cbmNvbnN0IEZJTkRfSElERV9UUkFOU0lUSU9OID0gJ2ZpbmQtaGlkZS10cmFuc2l0aW9uJztcbmNvbnN0IEZJTkRfU0hPV19UUkFOU0lUSU9OID0gJ2ZpbmQtc2hvdy10cmFuc2l0aW9uJztcbmxldCBNQVhfTUFUQ0hFU19DT1VOVF9XSURUSCA9IDY5O1xuY29uc3QgUFJPR1JFU1NfQkFSX0RFTEFZID0gMjAwOyAvLyBzaG93IHByb2dyZXNzIGZvciBhdCBsZWFzdCAyMDBtc1xuXG5leHBvcnQgaW50ZXJmYWNlIElTaG93Tm90ZWJvb2tGaW5kV2lkZ2V0T3B0aW9ucyB7XG5cdGlzUmVnZXg/OiBib29sZWFuO1xuXHR3aG9sZVdvcmQ/OiBib29sZWFuO1xuXHRtYXRjaENhc2U/OiBib29sZWFuO1xuXHRtYXRjaEluZGV4PzogbnVtYmVyO1xuXHRmb2N1cz86IGJvb2xlYW47XG5cdHNlYXJjaFN0cmluZ1NlZWRlZEZyb20/OiB7IGNlbGw6IElDZWxsVmlld01vZGVsOyByYW5nZTogUmFuZ2UgfTtcblx0ZmluZFNjb3BlPzogSU5vdGVib29rRmluZFNjb3BlO1xufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tGaW5kQ29udHJpYiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZDogc3RyaW5nID0gJ3dvcmtiZW5jaC5ub3RlYm9vay5maW5kJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93aWRnZXQ6IExhenk8Tm90ZWJvb2tGaW5kV2lkZ2V0PjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rRWRpdG9yOiBJTm90ZWJvb2tFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93aWRnZXQgPSBuZXcgTGF6eSgoKSA9PiB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rRmluZFdpZGdldCwgdGhpcy5ub3RlYm9va0VkaXRvcikpKTtcblx0fVxuXG5cdGdldCB3aWRnZXQoKTogTm90ZWJvb2tGaW5kV2lkZ2V0IHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0LnZhbHVlO1xuXHR9XG5cblx0c2hvdyhpbml0aWFsSW5wdXQ/OiBzdHJpbmcsIG9wdGlvbnM/OiBJU2hvd05vdGVib29rRmluZFdpZGdldE9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2lkZ2V0LnZhbHVlLnNob3coaW5pdGlhbElucHV0LCBvcHRpb25zKTtcblx0fVxuXG5cdGhpZGUoKSB7XG5cdFx0dGhpcy5fd2lkZ2V0LnJhd1ZhbHVlPy5oaWRlKCk7XG5cdH1cblxuXHRyZXBsYWNlKHNlYXJjaFN0cmluZzogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldC52YWx1ZS5yZXBsYWNlKHNlYXJjaFN0cmluZyk7XG5cdH1cbn1cblxuY2xhc3MgTm90ZWJvb2tGaW5kV2lkZ2V0IGV4dGVuZHMgU2ltcGxlRmluZFJlcGxhY2VXaWRnZXQgaW1wbGVtZW50cyBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ge1xuXHRwcm90ZWN0ZWQgX2ZpbmRXaWRnZXRGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfaXNGb2N1c2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3Nob3dUaW1lb3V0OiBudW1iZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfaGlkZVRpbWVvdXQ6IG51bWJlciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9wcmV2aW91c0ZvY3VzRWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9maW5kTW9kZWw6IEZpbmRNb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRfbm90ZWJvb2tFZGl0b3I6IElOb3RlYm9va0VkaXRvcixcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoY29udGV4dFZpZXdTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGhvdmVyU2VydmljZSwgbmV3IEZpbmRSZXBsYWNlU3RhdGU8Tm90ZWJvb2tGaW5kRmlsdGVycz4oKSwgX25vdGVib29rRWRpdG9yKTtcblx0XHR0aGlzLl9maW5kTW9kZWwgPSBuZXcgRmluZE1vZGVsKHRoaXMuX25vdGVib29rRWRpdG9yLCB0aGlzLl9zdGF0ZSwgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0RE9NLmFwcGVuZCh0aGlzLl9ub3RlYm9va0VkaXRvci5nZXREb21Ob2RlKCksIHRoaXMuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLl9maW5kV2lkZ2V0Rm9jdXNlZCA9IEtFWUJJTkRJTkdfQ09OVEVYVF9OT1RFQk9PS19GSU5EX1dJREdFVF9GT0NVU0VELmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uS2V5RG93bigoZSkgPT4gdGhpcy5fb25GaW5kSW5wdXRLZXlEb3duKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVwbGFjZUlucHV0Lm9uS2V5RG93bigoZSkgPT4gdGhpcy5fb25SZXBsYWNlSW5wdXRLZXlEb3duKGUpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zdGF0ZS5vbkZpbmRSZXBsYWNlU3RhdGVDaGFuZ2UoKGUpID0+IHtcblx0XHRcdHRoaXMub25JbnB1dENoYW5nZWQoKTtcblxuXHRcdFx0aWYgKGUuaXNTZWFyY2hpbmcpIHtcblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlLmlzU2VhcmNoaW5nKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuaW5maW5pdGUoKS5zaG93KFBST0dSRVNTX0JBUl9ERUxBWSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuc3RvcCgpLmhpZGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5fZmluZE1vZGVsLmN1cnJlbnRNYXRjaCA+PSAwKSB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRNYXRjaCA9IHRoaXMuX2ZpbmRNb2RlbC5nZXRDdXJyZW50TWF0Y2goKTtcblx0XHRcdFx0dGhpcy5fcmVwbGFjZUJ0bi5zZXRFbmFibGVkKGN1cnJlbnRNYXRjaC5pc01vZGVsTWF0Y2gpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtYXRjaGVzID0gdGhpcy5fZmluZE1vZGVsLmZpbmRNYXRjaGVzO1xuXHRcdFx0dGhpcy5fcmVwbGFjZUFsbEJ0bi5zZXRFbmFibGVkKG1hdGNoZXMubGVuZ3RoID4gMCAmJiBtYXRjaGVzLmZpbmQobWF0Y2ggPT4gbWF0Y2gud2Vidmlld01hdGNoZXMubGVuZ3RoID4gMCkgPT09IHVuZGVmaW5lZCk7XG5cblx0XHRcdGlmIChlLmZpbHRlcnMpIHtcblx0XHRcdFx0dGhpcy5fZmluZElucHV0LnVwZGF0ZUZpbHRlclN0YXRlKHRoaXMuX3N0YXRlLmZpbHRlcnM/LmlzTW9kaWZpZWQoKSA/PyBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmdldERvbU5vZGUoKSwgRE9NLkV2ZW50VHlwZS5GT0NVUywgZSA9PiB7XG5cdFx0XHR0aGlzLl9wcmV2aW91c0ZvY3VzRWxlbWVudCA9IERPTS5pc0hUTUxFbGVtZW50KGUucmVsYXRlZFRhcmdldCkgPyBlLnJlbGF0ZWRUYXJnZXQgOiB1bmRlZmluZWQ7XG5cdFx0fSwgdHJ1ZSkpO1xuXHR9XG5cblx0Z2V0IGZpbmRNb2RlbCgpOiBGaW5kTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9maW5kTW9kZWw7XG5cdH1cblxuXHRnZXQgaXNGb2N1c2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc0ZvY3VzZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9vbkZpbmRJbnB1dEtleURvd24oZTogSUtleWJvYXJkRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdHRoaXMuZmluZChmYWxzZSk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fSBlbHNlIGlmIChlLmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0dGhpcy5maW5kKHRydWUpO1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uUmVwbGFjZUlucHV0S2V5RG93bihlOiBJS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuXHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0dGhpcy5yZXBsYWNlT25lKCk7XG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG9uSW5wdXRDaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogdGhpcy5pbnB1dFZhbHVlIH0sIGZhbHNlKTtcblx0XHQvLyB0aGlzLl9maW5kTW9kZWwucmVzZWFyY2goKTtcblx0XHRjb25zdCBmaW5kTWF0Y2hlcyA9IHRoaXMuX2ZpbmRNb2RlbC5maW5kTWF0Y2hlcztcblx0XHRpZiAoZmluZE1hdGNoZXMgJiYgZmluZE1hdGNoZXMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGZpbmRJbmRleChpbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fZmluZE1vZGVsLmZpbmQoeyBpbmRleCB9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBmaW5kKHByZXZpb3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fZmluZE1vZGVsLmZpbmQoeyBwcmV2aW91cyB9KTtcblx0fVxuXG5cdHByb3RlY3RlZCByZXBsYWNlT25lKCkge1xuXHRcdGlmICghdGhpcy5fbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZmluZE1vZGVsLmZpbmRNYXRjaGVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2ZpbmRNb2RlbC5lbnN1cmVGaW5kTWF0Y2hlcygpO1xuXG5cdFx0aWYgKHRoaXMuX2ZpbmRNb2RlbC5jdXJyZW50TWF0Y2ggPCAwKSB7XG5cdFx0XHR0aGlzLl9maW5kTW9kZWwuZmluZCh7IHByZXZpb3VzOiBmYWxzZSB9KTtcblx0XHR9XG5cblx0XHRjb25zdCBjdXJyZW50TWF0Y2ggPSB0aGlzLl9maW5kTW9kZWwuZ2V0Q3VycmVudE1hdGNoKCk7XG5cdFx0Y29uc3QgY2VsbCA9IGN1cnJlbnRNYXRjaC5jZWxsO1xuXHRcdGlmIChjdXJyZW50TWF0Y2guaXNNb2RlbE1hdGNoKSB7XG5cdFx0XHRjb25zdCBtYXRjaCA9IGN1cnJlbnRNYXRjaC5tYXRjaCBhcyBGaW5kTWF0Y2g7XG5cblx0XHRcdHRoaXMuX3Byb2dyZXNzQmFyLmluZmluaXRlKCkuc2hvdyhQUk9HUkVTU19CQVJfREVMQVkpO1xuXG5cdFx0XHRjb25zdCByZXBsYWNlUGF0dGVybiA9IHRoaXMucmVwbGFjZVBhdHRlcm47XG5cdFx0XHRjb25zdCByZXBsYWNlU3RyaW5nID0gcmVwbGFjZVBhdHRlcm4uYnVpbGRSZXBsYWNlU3RyaW5nKG1hdGNoLm1hdGNoZXMsIHRoaXMuX3N0YXRlLnByZXNlcnZlQ2FzZSk7XG5cblx0XHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldFZpZXdNb2RlbCgpO1xuXHRcdFx0dmlld01vZGVsLnJlcGxhY2VPbmUoY2VsbCwgbWF0Y2gucmFuZ2UsIHJlcGxhY2VTdHJpbmcpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9wcm9ncmVzc0Jhci5zdG9wKCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gdGhpcyBzaG91bGQgbm90IHdvcmtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1JlcGxhY2UgZG9lcyBub3Qgd29yayBmb3Igb3V0cHV0IG1hdGNoJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHJlcGxhY2VBbGwoKSB7XG5cdFx0aWYgKCF0aGlzLl9ub3RlYm9va0VkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuaW5maW5pdGUoKS5zaG93KFBST0dSRVNTX0JBUl9ERUxBWSk7XG5cblx0XHRjb25zdCByZXBsYWNlUGF0dGVybiA9IHRoaXMucmVwbGFjZVBhdHRlcm47XG5cblx0XHRjb25zdCBjZWxsRmluZE1hdGNoZXMgPSB0aGlzLl9maW5kTW9kZWwuZmluZE1hdGNoZXM7XG5cdFx0Y29uc3QgcmVwbGFjZVN0cmluZ3M6IHN0cmluZ1tdID0gW107XG5cdFx0Y2VsbEZpbmRNYXRjaGVzLmZvckVhY2goY2VsbEZpbmRNYXRjaCA9PiB7XG5cdFx0XHRjZWxsRmluZE1hdGNoLmNvbnRlbnRNYXRjaGVzLmZvckVhY2gobWF0Y2ggPT4ge1xuXHRcdFx0XHRjb25zdCBtYXRjaGVzID0gbWF0Y2gubWF0Y2hlcztcblx0XHRcdFx0cmVwbGFjZVN0cmluZ3MucHVzaChyZXBsYWNlUGF0dGVybi5idWlsZFJlcGxhY2VTdHJpbmcobWF0Y2hlcywgdGhpcy5fc3RhdGUucHJlc2VydmVDYXNlKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHZpZXdNb2RlbCA9IHRoaXMuX25vdGVib29rRWRpdG9yLmdldFZpZXdNb2RlbCgpO1xuXHRcdHZpZXdNb2RlbC5yZXBsYWNlQWxsKHRoaXMuX2ZpbmRNb2RlbC5maW5kTWF0Y2hlcywgcmVwbGFjZVN0cmluZ3MpLnRoZW4oKCkgPT4ge1xuXHRcdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuc3RvcCgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGZpbmRGaXJzdCgpOiB2b2lkIHsgfVxuXG5cdHByb3RlY3RlZCBvbkZvY3VzVHJhY2tlckZvY3VzKCkge1xuXHRcdHRoaXMuX2ZpbmRXaWRnZXRGb2N1c2VkLnNldCh0cnVlKTtcblx0XHR0aGlzLl9pc0ZvY3VzZWQgPSB0cnVlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRm9jdXNUcmFja2VyQmx1cigpIHtcblx0XHR0aGlzLl9wcmV2aW91c0ZvY3VzRWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9maW5kV2lkZ2V0Rm9jdXNlZC5yZXNldCgpO1xuXHRcdHRoaXMuX2lzRm9jdXNlZCA9IGZhbHNlO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uUmVwbGFjZUlucHV0Rm9jdXNUcmFja2VyRm9jdXMoKTogdm9pZCB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHByb3RlY3RlZCBvblJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlckJsdXIoKTogdm9pZCB7XG5cdFx0Ly8gdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRmluZElucHV0Rm9jdXNUcmFja2VyRm9jdXMoKTogdm9pZCB7IH1cblx0cHJvdGVjdGVkIG9uRmluZElucHV0Rm9jdXNUcmFja2VyQmx1cigpOiB2b2lkIHsgfVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNob3coaW5pdGlhbElucHV0Pzogc3RyaW5nLCBvcHRpb25zPzogSVNob3dOb3RlYm9va0ZpbmRXaWRnZXRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2VhcmNoU3RyaW5nVXBkYXRlID0gdGhpcy5fc3RhdGUuc2VhcmNoU3RyaW5nICE9PSBpbml0aWFsSW5wdXQ7XG5cdFx0c3VwZXIuc2hvdyhpbml0aWFsSW5wdXQsIG9wdGlvbnMpO1xuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IHNlYXJjaFN0cmluZzogaW5pdGlhbElucHV0ID8/IHRoaXMuX3N0YXRlLnNlYXJjaFN0cmluZywgaXNSZXZlYWxlZDogdHJ1ZSB9LCBmYWxzZSk7XG5cblx0XHRpZiAodHlwZW9mIG9wdGlvbnM/Lm1hdGNoSW5kZXggPT09ICdudW1iZXInKSB7XG5cdFx0XHRpZiAoIXRoaXMuX2ZpbmRNb2RlbC5maW5kTWF0Y2hlcy5sZW5ndGgpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fZmluZE1vZGVsLnJlc2VhcmNoKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmZpbmRJbmRleChvcHRpb25zLm1hdGNoSW5kZXgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2VsZWN0KCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFzZWFyY2hTdHJpbmdVcGRhdGUgJiYgb3B0aW9ucz8uc2VhcmNoU3RyaW5nU2VlZGVkRnJvbSkge1xuXHRcdFx0dGhpcy5fZmluZE1vZGVsLnJlZnJlc2hDdXJyZW50TWF0Y2gob3B0aW9ucy5zZWFyY2hTdHJpbmdTZWVkZWRGcm9tKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc2hvd1RpbWVvdXQgPT09IG51bGwpIHtcblx0XHRcdGlmICh0aGlzLl9oaWRlVGltZW91dCAhPT0gbnVsbCkge1xuXHRcdFx0XHRET00uZ2V0V2luZG93KHRoaXMuZ2V0RG9tTm9kZSgpKS5jbGVhclRpbWVvdXQodGhpcy5faGlkZVRpbWVvdXQpO1xuXHRcdFx0XHR0aGlzLl9oaWRlVGltZW91dCA9IG51bGw7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLnJlbW92ZUNsYXNzTmFtZShGSU5EX0hJREVfVFJBTlNJVElPTik7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmFkZENsYXNzTmFtZShGSU5EX1NIT1dfVFJBTlNJVElPTik7XG5cdFx0XHR0aGlzLl9zaG93VGltZW91dCA9IERPTS5nZXRXaW5kb3codGhpcy5nZXREb21Ob2RlKCkpLnNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5yZW1vdmVDbGFzc05hbWUoRklORF9TSE9XX1RSQU5TSVRJT04pO1xuXHRcdFx0XHR0aGlzLl9zaG93VGltZW91dCA9IG51bGw7XG5cdFx0XHR9LCAyMDApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBubyBvcFxuXHRcdH1cblx0fVxuXG5cdHJlcGxhY2UoaW5pdGlhbEZpbmRJbnB1dD86IHN0cmluZywgaW5pdGlhbFJlcGxhY2VJbnB1dD86IHN0cmluZykge1xuXHRcdHN1cGVyLnNob3dXaXRoUmVwbGFjZShpbml0aWFsRmluZElucHV0LCBpbml0aWFsUmVwbGFjZUlucHV0KTtcblx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBzZWFyY2hTdHJpbmc6IGluaXRpYWxGaW5kSW5wdXQgPz8gJycsIHJlcGxhY2VTdHJpbmc6IGluaXRpYWxSZXBsYWNlSW5wdXQgPz8gJycsIGlzUmV2ZWFsZWQ6IHRydWUgfSwgZmFsc2UpO1xuXHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5zZWxlY3QoKTtcblxuXHRcdGlmICh0aGlzLl9zaG93VGltZW91dCA9PT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMuX2hpZGVUaW1lb3V0ICE9PSBudWxsKSB7XG5cdFx0XHRcdERPTS5nZXRXaW5kb3codGhpcy5nZXREb21Ob2RlKCkpLmNsZWFyVGltZW91dCh0aGlzLl9oaWRlVGltZW91dCk7XG5cdFx0XHRcdHRoaXMuX2hpZGVUaW1lb3V0ID0gbnVsbDtcblx0XHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IucmVtb3ZlQ2xhc3NOYW1lKEZJTkRfSElERV9UUkFOU0lUSU9OKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuYWRkQ2xhc3NOYW1lKEZJTkRfU0hPV19UUkFOU0lUSU9OKTtcblx0XHRcdHRoaXMuX3Nob3dUaW1lb3V0ID0gRE9NLmdldFdpbmRvdyh0aGlzLmdldERvbU5vZGUoKSkuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLnJlbW92ZUNsYXNzTmFtZShGSU5EX1NIT1dfVFJBTlNJVElPTik7XG5cdFx0XHRcdHRoaXMuX3Nob3dUaW1lb3V0ID0gbnVsbDtcblx0XHRcdH0sIDIwMCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIG5vIG9wXG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgaGlkZSgpIHtcblx0XHRzdXBlci5oaWRlKCk7XG5cdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgaXNSZXZlYWxlZDogZmFsc2UgfSwgZmFsc2UpO1xuXHRcdHRoaXMuX2ZpbmRNb2RlbC5jbGVhcigpO1xuXHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmZpbmRTdG9wKCk7XG5cdFx0dGhpcy5fcHJvZ3Jlc3NCYXIuc3RvcCgpO1xuXG5cdFx0aWYgKHRoaXMuX2hpZGVUaW1lb3V0ID09PSBudWxsKSB7XG5cdFx0XHRpZiAodGhpcy5fc2hvd1RpbWVvdXQgIT09IG51bGwpIHtcblx0XHRcdFx0RE9NLmdldFdpbmRvdyh0aGlzLmdldERvbU5vZGUoKSkuY2xlYXJUaW1lb3V0KHRoaXMuX3Nob3dUaW1lb3V0KTtcblx0XHRcdFx0dGhpcy5fc2hvd1RpbWVvdXQgPSBudWxsO1xuXHRcdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5yZW1vdmVDbGFzc05hbWUoRklORF9TSE9XX1RSQU5TSVRJT04pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuYWRkQ2xhc3NOYW1lKEZJTkRfSElERV9UUkFOU0lUSU9OKTtcblx0XHRcdHRoaXMuX2hpZGVUaW1lb3V0ID0gRE9NLmdldFdpbmRvdyh0aGlzLmdldERvbU5vZGUoKSkuc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLnJlbW92ZUNsYXNzTmFtZShGSU5EX0hJREVfVFJBTlNJVElPTik7XG5cdFx0XHR9LCAyMDApO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBubyBvcFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9wcmV2aW91c0ZvY3VzRWxlbWVudCAmJiB0aGlzLl9wcmV2aW91c0ZvY3VzRWxlbWVudC5vZmZzZXRQYXJlbnQpIHtcblx0XHRcdHRoaXMuX3ByZXZpb3VzRm9jdXNFbGVtZW50LmZvY3VzKCk7XG5cdFx0XHR0aGlzLl9wcmV2aW91c0ZvY3VzRWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fbm90ZWJvb2tFZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRMZW5ndGgoKTsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9ub3RlYm9va0VkaXRvci5jZWxsQXQoaSk7XG5cblx0XHRcdFx0aWYgKGNlbGwuZ2V0RWRpdFN0YXRlKCkgPT09IENlbGxFZGl0U3RhdGUuRWRpdGluZyAmJiBjZWxsLmVkaXRTdGF0ZVNvdXJjZSA9PT0gJ2ZpbmQnKSB7XG5cdFx0XHRcdFx0Y2VsbC51cGRhdGVFZGl0U3RhdGUoQ2VsbEVkaXRTdGF0ZS5QcmV2aWV3LCAnY2xvc2VGaW5kJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX3VwZGF0ZU1hdGNoZXNDb3VudCgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2ZpbmRNb2RlbCB8fCAhdGhpcy5fZmluZE1vZGVsLmZpbmRNYXRjaGVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbWF0Y2hlc0NvdW50LnN0eWxlLndpZHRoID0gTUFYX01BVENIRVNfQ09VTlRfV0lEVEggKyAncHgnO1xuXHRcdHRoaXMuX21hdGNoZXNDb3VudC50aXRsZSA9ICcnO1xuXG5cdFx0Ly8gcmVtb3ZlIHByZXZpb3VzIGNvbnRlbnRcblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuZmlyc3RDaGlsZD8ucmVtb3ZlKCk7XG5cblx0XHRsZXQgbGFiZWw6IHN0cmluZztcblxuXHRcdGlmICh0aGlzLl9zdGF0ZS5tYXRjaGVzQ291bnQgPiAwKSB7XG5cdFx0XHRsZXQgbWF0Y2hlc0NvdW50OiBzdHJpbmcgPSBTdHJpbmcodGhpcy5fc3RhdGUubWF0Y2hlc0NvdW50KTtcblx0XHRcdGlmICh0aGlzLl9zdGF0ZS5tYXRjaGVzQ291bnQgPj0gTUFUQ0hFU19MSU1JVCkge1xuXHRcdFx0XHRtYXRjaGVzQ291bnQgKz0gJysnO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbWF0Y2hlc1Bvc2l0aW9uOiBzdHJpbmcgPSB0aGlzLl9maW5kTW9kZWwuY3VycmVudE1hdGNoIDwgMCA/ICc/JyA6IFN0cmluZygodGhpcy5fZmluZE1vZGVsLmN1cnJlbnRNYXRjaCArIDEpKTtcblx0XHRcdGxhYmVsID0gc3RyaW5ncy5mb3JtYXQoTkxTX01BVENIRVNfTE9DQVRJT04sIG1hdGNoZXNQb3NpdGlvbiwgbWF0Y2hlc0NvdW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGFiZWwgPSBOTFNfTk9fUkVTVUxUUztcblx0XHR9XG5cblx0XHR0aGlzLl9tYXRjaGVzQ291bnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobGFiZWwpKTtcblxuXHRcdGFsZXJ0Rm4odGhpcy5fZ2V0QXJpYUxhYmVsKGxhYmVsLCB0aGlzLl9zdGF0ZS5jdXJyZW50TWF0Y2gsIHRoaXMuX3N0YXRlLnNlYXJjaFN0cmluZykpO1xuXHRcdE1BWF9NQVRDSEVTX0NPVU5UX1dJRFRIID0gTWF0aC5tYXgoTUFYX01BVENIRVNfQ09VTlRfV0lEVEgsIHRoaXMuX21hdGNoZXNDb3VudC5jbGllbnRXaWR0aCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRBcmlhTGFiZWwobGFiZWw6IHN0cmluZywgY3VycmVudE1hdGNoOiBSYW5nZSB8IG51bGwsIHNlYXJjaFN0cmluZzogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAobGFiZWwgPT09IE5MU19OT19SRVNVTFRTKSB7XG5cdFx0XHRyZXR1cm4gc2VhcmNoU3RyaW5nID09PSAnJ1xuXHRcdFx0XHQ/IGxvY2FsaXplKCdhcmlhU2VhcmNoTm9SZXN1bHRFbXB0eScsIFwiezB9IGZvdW5kXCIsIGxhYmVsKVxuXHRcdFx0XHQ6IGxvY2FsaXplKCdhcmlhU2VhcmNoTm9SZXN1bHQnLCBcInswfSBmb3VuZCBmb3IgJ3sxfSdcIiwgbGFiZWwsIHNlYXJjaFN0cmluZyk7XG5cdFx0fVxuXG5cdFx0Ly8gVE9ET0ByZWJvcm5peCwgYXJpYSBmb3IgYGNlbGwgJHtpbmRleH0sIGxpbmUge2xpbmV9YFxuXHRcdHJldHVybiBsb2NhbGl6ZSgnYXJpYVNlYXJjaE5vUmVzdWx0V2l0aExpbmVOdW1Ob0N1cnJlbnRNYXRjaCcsIFwiezB9IGZvdW5kIGZvciAnezF9J1wiLCBsYWJlbCwgc2VhcmNoU3RyaW5nKTtcblx0fVxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHRoaXMuX25vdGVib29rRWRpdG9yPy5yZW1vdmVDbGFzc05hbWUoRklORF9TSE9XX1RSQU5TSVRJT04pO1xuXHRcdHRoaXMuX25vdGVib29rRWRpdG9yPy5yZW1vdmVDbGFzc05hbWUoRklORF9ISURFX1RSQU5TSVRJT04pO1xuXHRcdHRoaXMuX2ZpbmRNb2RlbC5kaXNwb3Nl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QixjQUFjLFNBQVMsV0FBVztBQUFBLFFBQ3hEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFbUIsc0JBQTRCO0FBQzlDLFFBQUksQ0FBQyxLQUFLLGNBQWMsQ0FBQyxLQUFLLFdBQVcsYUFBYTtBQUNyRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLGNBQWMsTUFBTSxRQUFRLDBCQUEwQjtBQUMzRCxTQUFLLGNBQWMsUUFBUTtBQUczQixTQUFLLGNBQWMsWUFBWSxPQUFPO0FBRXRDLFFBQUk7QUFFSixRQUFJLEtBQUssT0FBTyxlQUFlLEdBQUc7QUFDakMsVUFBSSxlQUF1QixPQUFPLEtBQUssT0FBTyxZQUFZO0FBQzFELFVBQUksS0FBSyxPQUFPLGdCQUFnQixlQUFlO0FBQzlDLHdCQUFnQjtBQUFBLE1BQ2pCO0FBQ0EsWUFBTSxrQkFBMEIsS0FBSyxXQUFXLGVBQWUsSUFBSSxNQUFNLE9BQVEsS0FBSyxXQUFXLGVBQWUsQ0FBRTtBQUNsSCxjQUFRLFFBQVEsT0FBTyxzQkFBc0IsaUJBQWlCLFlBQVk7QUFBQSxJQUMzRSxPQUFPO0FBQ04sY0FBUTtBQUFBLElBQ1Q7QUFFQSxTQUFLLGNBQWMsWUFBWSxTQUFTLGVBQWUsS0FBSyxDQUFDO0FBRTdELFlBQVEsS0FBSyxjQUFjLE9BQU8sS0FBSyxPQUFPLGNBQWMsS0FBSyxPQUFPLFlBQVksQ0FBQztBQUNyRiw4QkFBMEIsS0FBSyxJQUFJLHlCQUF5QixLQUFLLGNBQWMsV0FBVztBQUFBLEVBQzNGO0FBQUEsRUFFUSxjQUFjLE9BQWUsY0FBNEIsY0FBOEI7QUFDOUYsUUFBSSxVQUFVLGdCQUFnQjtBQUM3QixhQUFPLGlCQUFpQixLQUNyQixTQUFTLDJCQUEyQixhQUFhLEtBQUssSUFDdEQsU0FBUyxzQkFBc0IsdUJBQXVCLE9BQU8sWUFBWTtBQUFBLElBQzdFO0FBR0EsV0FBTyxTQUFTLCtDQUErQyx1QkFBdUIsT0FBTyxZQUFZO0FBQUEsRUFDMUc7QUFBQSxFQUNTLFVBQVU7QUFDbEIsU0FBSyxpQkFBaUIsZ0JBQWdCLG9CQUFvQjtBQUMxRCxTQUFLLGlCQUFpQixnQkFBZ0Isb0JBQW9CO0FBQzFELFNBQUssV0FBVyxRQUFRO0FBQ3hCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQW5VTSxxQkFBTjtBQUFBLEVBVUc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZkc7IiwKICAibmFtZXMiOiBbXQp9Cg==
