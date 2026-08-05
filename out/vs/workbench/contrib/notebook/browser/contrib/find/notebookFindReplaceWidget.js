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
import * as nls from "../../../../../../nls.js";
import * as dom from "../../../../../../base/browser/dom.js";
import "./notebookFindReplaceWidget.css";
import { ActionBar } from "../../../../../../base/browser/ui/actionbar/actionbar.js";
import { AnchorAlignment } from "../../../../../../base/browser/ui/contextview/contextview.js";
import { DropdownMenuActionViewItem } from "../../../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { FindInput } from "../../../../../../base/browser/ui/findinput/findInput.js";
import { ProgressBar } from "../../../../../../base/browser/ui/progressbar/progressbar.js";
import { Orientation, Sash } from "../../../../../../base/browser/ui/sash/sash.js";
import { Toggle } from "../../../../../../base/browser/ui/toggle/toggle.js";
import { Widget } from "../../../../../../base/browser/ui/widget.js";
import { Action, ActionRunner, Separator } from "../../../../../../base/common/actions.js";
import { Delayer } from "../../../../../../base/common/async.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { Event } from "../../../../../../base/common/event.js";
import { KeyCode } from "../../../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { isSafari } from "../../../../../../base/common/platform.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { FindReplaceState } from "../../../../../../editor/contrib/find/browser/findState.js";
import { findNextMatchIcon, findPreviousMatchIcon, findReplaceAllIcon, findReplaceIcon, findSelectionIcon, SimpleButton } from "../../../../../../editor/contrib/find/browser/findWidget.js";
import { parseReplaceString, ReplacePattern } from "../../../../../../editor/contrib/find/browser/replacePattern.js";
import { getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../../../platform/contextview/browser/contextView.js";
import { ContextScopedReplaceInput, registerAndCreateHistoryNavigationContext } from "../../../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { IHoverService } from "../../../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { defaultInputBoxStyles, defaultProgressBarStyles, defaultToggleStyles } from "../../../../../../platform/theme/browser/defaultStyles.js";
import { asCssVariable, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { registerIcon, widgetClose } from "../../../../../../platform/theme/common/iconRegistry.js";
import { registerThemingParticipant } from "../../../../../../platform/theme/common/themeService.js";
import { filterIcon } from "../../../../extensions/browser/extensionsIcons.js";
import { NotebookFindFilters } from "./findFilters.js";
import { NotebookFindScopeType, NotebookSetting } from "../../../common/notebookCommon.js";
const NLS_FIND_INPUT_LABEL = nls.localize("label.find", "Find");
const NLS_FIND_INPUT_PLACEHOLDER = nls.localize("placeholder.find", "Find");
const NLS_PREVIOUS_MATCH_BTN_LABEL = nls.localize("label.previousMatchButton", "Previous Match");
const NLS_NEXT_MATCH_BTN_LABEL = nls.localize("label.nextMatchButton", "Next Match");
const NLS_TOGGLE_SELECTION_FIND_TITLE = nls.localize("label.toggleSelectionFind", "Find in Selection");
const NLS_CLOSE_BTN_LABEL = nls.localize("label.closeButton", "Close");
const NLS_TOGGLE_REPLACE_MODE_BTN_LABEL = nls.localize("label.toggleReplaceButton", "Toggle Replace");
const NLS_REPLACE_INPUT_LABEL = nls.localize("label.replace", "Replace");
const NLS_REPLACE_INPUT_PLACEHOLDER = nls.localize("placeholder.replace", "Replace");
const NLS_REPLACE_BTN_LABEL = nls.localize("label.replaceButton", "Replace");
const NLS_REPLACE_ALL_BTN_LABEL = nls.localize("label.replaceAllButton", "Replace All");
const findFilterButton = registerIcon("find-filter", Codicon.filter, nls.localize("findFilterIcon", "Icon for Find Filter in find widget."));
const NOTEBOOK_FIND_FILTERS = nls.localize("notebook.find.filter.filterAction", "Find Filters");
const NOTEBOOK_FIND_IN_MARKUP_INPUT = nls.localize("notebook.find.filter.findInMarkupInput", "Markdown Source");
const NOTEBOOK_FIND_IN_MARKUP_PREVIEW = nls.localize("notebook.find.filter.findInMarkupPreview", "Rendered Markdown");
const NOTEBOOK_FIND_IN_CODE_INPUT = nls.localize("notebook.find.filter.findInCodeInput", "Code Cell Source");
const NOTEBOOK_FIND_IN_CODE_OUTPUT = nls.localize("notebook.find.filter.findInCodeOutput", "Code Cell Output");
const NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH = 419;
const NOTEBOOK_FIND_WIDGET_INITIAL_HORIZONTAL_PADDING = 4;
let NotebookFindFilterActionViewItem = class extends DropdownMenuActionViewItem {
  constructor(filters, action, options, actionRunner, contextMenuService) {
    super(
      action,
      { getActions: () => this.getActions() },
      contextMenuService,
      {
        ...options,
        actionRunner,
        classNames: action.class,
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT
      }
    );
    this.filters = filters;
  }
  render(container) {
    super.render(container);
    this.updateChecked();
  }
  getActions() {
    const markdownInput = {
      checked: this.filters.markupInput,
      class: void 0,
      enabled: true,
      id: "findInMarkdownInput",
      label: NOTEBOOK_FIND_IN_MARKUP_INPUT,
      run: async () => {
        this.filters.markupInput = !this.filters.markupInput;
      },
      tooltip: ""
    };
    const markdownPreview = {
      checked: this.filters.markupPreview,
      class: void 0,
      enabled: true,
      id: "findInMarkdownInput",
      label: NOTEBOOK_FIND_IN_MARKUP_PREVIEW,
      run: async () => {
        this.filters.markupPreview = !this.filters.markupPreview;
      },
      tooltip: ""
    };
    const codeInput = {
      checked: this.filters.codeInput,
      class: void 0,
      enabled: true,
      id: "findInCodeInput",
      label: NOTEBOOK_FIND_IN_CODE_INPUT,
      run: async () => {
        this.filters.codeInput = !this.filters.codeInput;
      },
      tooltip: ""
    };
    const codeOutput = {
      checked: this.filters.codeOutput,
      class: void 0,
      enabled: true,
      id: "findInCodeOutput",
      label: NOTEBOOK_FIND_IN_CODE_OUTPUT,
      run: async () => {
        this.filters.codeOutput = !this.filters.codeOutput;
      },
      tooltip: "",
      dispose: () => null
    };
    if (isSafari) {
      return [
        markdownInput,
        codeInput
      ];
    } else {
      return [
        markdownInput,
        markdownPreview,
        new Separator(),
        codeInput,
        codeOutput
      ];
    }
  }
  updateChecked() {
    this.element.classList.toggle("checked", this._action.checked);
  }
};
NotebookFindFilterActionViewItem = __decorateClass([
  __decorateParam(4, IContextMenuService)
], NotebookFindFilterActionViewItem);
class NotebookFindInputFilterButton extends Disposable {
  constructor(filters, contextMenuService, instantiationService, options, tooltip = NOTEBOOK_FIND_FILTERS) {
    super();
    this.filters = filters;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this._actionbar = null;
    this._toggleStyles = options.toggleStyles;
    this._filtersAction = new Action("notebookFindFilterAction", tooltip, "notebook-filters " + ThemeIcon.asClassName(filterIcon));
    this._filtersAction.checked = false;
    this._filterButtonContainer = dom.$(".find-filter-button");
    this._filterButtonContainer.classList.add("monaco-custom-toggle");
    this.createFilters(this._filterButtonContainer);
  }
  get container() {
    return this._filterButtonContainer;
  }
  width() {
    return 2 + 2 + 2 + 16;
  }
  enable() {
    this.container.setAttribute("aria-disabled", String(false));
  }
  disable() {
    this.container.setAttribute("aria-disabled", String(true));
  }
  set visible(visible) {
    this._filterButtonContainer.style.display = visible ? "" : "none";
  }
  get visible() {
    return this._filterButtonContainer.style.display !== "none";
  }
  applyStyles(filterChecked) {
    const toggleStyles = this._toggleStyles;
    this._filterButtonContainer.style.border = "1px solid transparent";
    this._filterButtonContainer.style.borderRadius = "3px";
    this._filterButtonContainer.style.borderColor = filterChecked && toggleStyles.inputActiveOptionBorder || "";
    this._filterButtonContainer.style.color = filterChecked && toggleStyles.inputActiveOptionForeground || "inherit";
    this._filterButtonContainer.style.backgroundColor = filterChecked && toggleStyles.inputActiveOptionBackground || "";
  }
  createFilters(container) {
    this._actionbar = this._register(new ActionBar(container, {
      actionViewItemProvider: (action, options) => {
        if (action.id === this._filtersAction.id) {
          return this.instantiationService.createInstance(NotebookFindFilterActionViewItem, this.filters, action, options, this._register(new ActionRunner()));
        }
        return void 0;
      }
    }));
    this._actionbar.push(this._filtersAction, { icon: true, label: false });
  }
}
class NotebookFindInput extends FindInput {
  constructor(filters, contextKeyService, contextMenuService, instantiationService, parent, contextViewProvider, options) {
    super(parent, contextViewProvider, options);
    this.filters = filters;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this._filterChecked = false;
    this._register(registerAndCreateHistoryNavigationContext(contextKeyService, this.inputBox));
    this._findFilter = this._register(new NotebookFindInputFilterButton(filters, contextMenuService, instantiationService, options));
    this.inputBox.paddingRight = (this.caseSensitive?.width() ?? 0) + (this.wholeWords?.width() ?? 0) + (this.regex?.width() ?? 0) + this._findFilter.width();
    this.controls.appendChild(this._findFilter.container);
  }
  setEnabled(enabled) {
    super.setEnabled(enabled);
    if (enabled && !this._filterChecked) {
      this.regex?.enable();
    } else {
      this.regex?.disable();
    }
  }
  updateFilterState(changed) {
    this._filterChecked = changed;
    if (this.regex) {
      if (this._filterChecked) {
        this.regex.disable();
        this.regex.domNode.tabIndex = -1;
        this.regex.domNode.classList.toggle("disabled", true);
      } else {
        this.regex.enable();
        this.regex.domNode.tabIndex = 0;
        this.regex.domNode.classList.toggle("disabled", false);
      }
    }
    this._findFilter.applyStyles(this._filterChecked);
  }
  getCellToolbarActions(menu) {
    return getActionBarActions(menu.getActions({ shouldForwardArgs: true }), (g) => /^inline/.test(g));
  }
}
let SimpleFindReplaceWidget = class extends Widget {
  constructor(_contextViewService, contextKeyService, _configurationService, contextMenuService, instantiationService, hoverService, _state = new FindReplaceState(), _notebookEditor) {
    super();
    this._contextViewService = _contextViewService;
    this._configurationService = _configurationService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this._state = _state;
    this._notebookEditor = _notebookEditor;
    this._resizeOriginalWidth = NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH;
    this._isVisible = false;
    this._isReplaceVisible = false;
    this.foundMatch = false;
    this.cellSelectionDecorationIds = [];
    this.textSelectionDecorationIds = [];
    this._register(this._state);
    const findFilters = this._configurationService.getValue(NotebookSetting.findFilters) ?? { markupSource: true, markupPreview: true, codeSource: true, codeOutput: true };
    this._filters = new NotebookFindFilters(findFilters.markupSource, findFilters.markupPreview, findFilters.codeSource, findFilters.codeOutput, { findScopeType: NotebookFindScopeType.None });
    this._state.change({ filters: this._filters }, false);
    this._filters.onDidChange(() => {
      this._state.change({ filters: this._filters }, false);
    });
    this._domNode = document.createElement("div");
    this._domNode.classList.add("simple-fr-find-part-wrapper");
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(NotebookSetting.globalToolbar)) {
        if (this._notebookEditor.notebookOptions.getLayoutConfiguration().globalToolbar) {
          this._domNode.style.top = "26px";
        } else {
          this._domNode.style.top = "0px";
        }
      }
    }));
    this._register(this._state.onFindReplaceStateChange((e) => this._onStateChanged(e)));
    this._scopedContextKeyService = contextKeyService.createScoped(this._domNode);
    const progressContainer = dom.$(".find-replace-progress");
    this._progressBar = new ProgressBar(progressContainer, defaultProgressBarStyles);
    this._domNode.appendChild(progressContainer);
    const isInteractiveWindow = contextKeyService.getContextKeyValue("notebookType") === "interactive";
    this._toggleReplaceBtn = this._register(new SimpleButton({
      label: NLS_TOGGLE_REPLACE_MODE_BTN_LABEL,
      className: "codicon toggle left",
      onTrigger: isInteractiveWindow ? () => {
      } : () => {
        this._isReplaceVisible = !this._isReplaceVisible;
        this._state.change({ isReplaceRevealed: this._isReplaceVisible }, false);
        this._updateReplaceViewDisplay();
      }
    }, hoverService));
    this._toggleReplaceBtn.setEnabled(!isInteractiveWindow);
    this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
    this._domNode.appendChild(this._toggleReplaceBtn.domNode);
    this._innerFindDomNode = document.createElement("div");
    this._innerFindDomNode.classList.add("simple-fr-find-part");
    this._findInput = this._register(new NotebookFindInput(
      this._filters,
      this._scopedContextKeyService,
      this.contextMenuService,
      this.instantiationService,
      null,
      this._contextViewService,
      {
        // width:FIND_INPUT_AREA_WIDTH,
        label: NLS_FIND_INPUT_LABEL,
        placeholder: NLS_FIND_INPUT_PLACEHOLDER,
        validation: (value) => {
          if (value.length === 0 || !this._findInput.getRegex()) {
            return null;
          }
          try {
            new RegExp(value);
            return null;
          } catch (e) {
            this.foundMatch = false;
            this.updateButtons(this.foundMatch);
            return { content: e.message };
          }
        },
        flexibleWidth: true,
        showCommonFindToggles: true,
        inputBoxStyles: defaultInputBoxStyles,
        toggleStyles: defaultToggleStyles
      }
    ));
    this._updateHistoryDelayer = new Delayer(500);
    this.oninput(this._findInput.domNode, (e) => {
      this.foundMatch = this.onInputChanged();
      this.updateButtons(this.foundMatch);
      this._delayedUpdateHistory();
    });
    this._register(this._findInput.inputBox.onDidChange(() => {
      this._state.change({ searchString: this._findInput.getValue() }, true);
    }));
    this._findInput.setRegex(!!this._state.isRegex);
    this._findInput.setCaseSensitive(!!this._state.matchCase);
    this._findInput.setWholeWords(!!this._state.wholeWord);
    this._register(this._findInput.onDidOptionChange(() => {
      this._state.change({
        isRegex: this._findInput.getRegex(),
        wholeWord: this._findInput.getWholeWords(),
        matchCase: this._findInput.getCaseSensitive()
      }, true);
    }));
    this._register(this._state.onFindReplaceStateChange(() => {
      this._findInput.setRegex(this._state.isRegex);
      this._findInput.setWholeWords(this._state.wholeWord);
      this._findInput.setCaseSensitive(this._state.matchCase);
      this._replaceInput.setPreserveCase(this._state.preserveCase);
    }));
    this._matchesCount = document.createElement("div");
    this._matchesCount.className = "matchesCount";
    this._updateMatchesCount();
    this.prevBtn = this._register(new SimpleButton({
      label: NLS_PREVIOUS_MATCH_BTN_LABEL,
      icon: findPreviousMatchIcon,
      onTrigger: () => {
        this.find(true);
      }
    }, hoverService));
    this.nextBtn = this._register(new SimpleButton({
      label: NLS_NEXT_MATCH_BTN_LABEL,
      icon: findNextMatchIcon,
      onTrigger: () => {
        this.find(false);
      }
    }, hoverService));
    this.inSelectionToggle = this._register(new Toggle({
      icon: findSelectionIcon,
      title: NLS_TOGGLE_SELECTION_FIND_TITLE,
      isChecked: false,
      inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground),
      inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
      inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground)
    }));
    this.inSelectionToggle.domNode.style.display = "inline";
    this.inSelectionToggle.onChange(() => {
      const checked = this.inSelectionToggle.checked;
      if (checked) {
        const cellSelection = this._notebookEditor.getSelections();
        const textSelection = this._notebookEditor.getSelectionViewModels()[0].getSelections();
        if (cellSelection.length > 1 || cellSelection.some((range) => range.end - range.start > 1)) {
          this._filters.findScope = {
            findScopeType: NotebookFindScopeType.Cells,
            selectedCellRanges: cellSelection
          };
          this.setCellSelectionDecorations();
        } else if (textSelection.length > 1 || textSelection.some((range) => range.endLineNumber - range.startLineNumber >= 1)) {
          this._filters.findScope = {
            findScopeType: NotebookFindScopeType.Text,
            selectedCellRanges: cellSelection,
            selectedTextRanges: textSelection
          };
          this.setTextSelectionDecorations(textSelection, this._notebookEditor.getSelectionViewModels()[0]);
        } else {
          this._filters.findScope = {
            findScopeType: NotebookFindScopeType.Cells,
            selectedCellRanges: cellSelection
          };
          this.setCellSelectionDecorations();
        }
      } else {
        this._filters.findScope = {
          findScopeType: NotebookFindScopeType.None
        };
        this.clearCellSelectionDecorations();
        this.clearTextSelectionDecorations();
      }
    });
    const closeBtn = this._register(new SimpleButton({
      label: NLS_CLOSE_BTN_LABEL,
      icon: widgetClose,
      onTrigger: () => {
        this.hide();
      }
    }, hoverService));
    this._innerFindDomNode.appendChild(this._findInput.domNode);
    this._innerFindDomNode.appendChild(this._matchesCount);
    this._innerFindDomNode.appendChild(this.prevBtn.domNode);
    this._innerFindDomNode.appendChild(this.nextBtn.domNode);
    this._innerFindDomNode.appendChild(this.inSelectionToggle.domNode);
    this._innerFindDomNode.appendChild(closeBtn.domNode);
    this._domNode.appendChild(this._innerFindDomNode);
    this.onkeyup(this._innerFindDomNode, (e) => {
      if (e.equals(KeyCode.Escape)) {
        this.hide();
        e.preventDefault();
        return;
      }
    });
    this._focusTracker = this._register(dom.trackFocus(this._domNode));
    this._register(this._focusTracker.onDidFocus(this.onFocusTrackerFocus.bind(this)));
    this._register(this._focusTracker.onDidBlur(this.onFocusTrackerBlur.bind(this)));
    this._findInputFocusTracker = this._register(dom.trackFocus(this._findInput.domNode));
    this._register(this._findInputFocusTracker.onDidFocus(this.onFindInputFocusTrackerFocus.bind(this)));
    this._register(this._findInputFocusTracker.onDidBlur(this.onFindInputFocusTrackerBlur.bind(this)));
    this._register(dom.addDisposableListener(this._innerFindDomNode, "click", (event) => {
      event.stopPropagation();
    }));
    this._innerReplaceDomNode = document.createElement("div");
    this._innerReplaceDomNode.classList.add("simple-fr-replace-part");
    this._replaceInput = this._register(new ContextScopedReplaceInput(null, void 0, {
      label: NLS_REPLACE_INPUT_LABEL,
      placeholder: NLS_REPLACE_INPUT_PLACEHOLDER,
      history: /* @__PURE__ */ new Set([]),
      inputBoxStyles: defaultInputBoxStyles,
      toggleStyles: defaultToggleStyles
    }, contextKeyService, false));
    this._innerReplaceDomNode.appendChild(this._replaceInput.domNode);
    this._replaceInputFocusTracker = this._register(dom.trackFocus(this._replaceInput.domNode));
    this._register(this._replaceInputFocusTracker.onDidFocus(this.onReplaceInputFocusTrackerFocus.bind(this)));
    this._register(this._replaceInputFocusTracker.onDidBlur(this.onReplaceInputFocusTrackerBlur.bind(this)));
    this._register(this._replaceInput.inputBox.onDidChange(() => {
      this._state.change({ replaceString: this._replaceInput.getValue() }, true);
    }));
    this._domNode.appendChild(this._innerReplaceDomNode);
    this._updateReplaceViewDisplay();
    this._replaceBtn = this._register(new SimpleButton({
      label: NLS_REPLACE_BTN_LABEL,
      icon: findReplaceIcon,
      onTrigger: () => {
        this.replaceOne();
      }
    }, hoverService));
    this._replaceAllBtn = this._register(new SimpleButton({
      label: NLS_REPLACE_ALL_BTN_LABEL,
      icon: findReplaceAllIcon,
      onTrigger: () => {
        this.replaceAll();
      }
    }, hoverService));
    this._innerReplaceDomNode.appendChild(this._replaceBtn.domNode);
    this._innerReplaceDomNode.appendChild(this._replaceAllBtn.domNode);
    this._resizeSash = this._register(new Sash(this._domNode, { getVerticalSashLeft: () => 0 }, { orientation: Orientation.VERTICAL, size: 2 }));
    this._register(this._resizeSash.onDidStart(() => {
      this._resizeOriginalWidth = this._getDomWidth();
    }));
    this._register(this._resizeSash.onDidChange((evt) => {
      let width = this._resizeOriginalWidth + evt.startX - evt.currentX;
      if (width < NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH) {
        width = NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH;
      }
      const maxWidth = this._getMaxWidth();
      if (width > maxWidth) {
        width = maxWidth;
      }
      this._domNode.style.width = `${width}px`;
      if (this._isReplaceVisible) {
        this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
      }
      this._findInput.inputBox.layout();
    }));
    this._register(this._resizeSash.onDidReset(() => {
      const currentWidth = this._getDomWidth();
      let width = NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH;
      if (currentWidth <= NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH) {
        width = this._getMaxWidth();
      }
      this._domNode.style.width = `${width}px`;
      if (this._isReplaceVisible) {
        this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
      }
      this._findInput.inputBox.layout();
    }));
  }
  _getMaxWidth() {
    return this._notebookEditor.getLayoutInfo().width - 64;
  }
  _getDomWidth() {
    return dom.getTotalWidth(this._domNode) - NOTEBOOK_FIND_WIDGET_INITIAL_HORIZONTAL_PADDING * 2;
  }
  getCellToolbarActions(menu) {
    return getActionBarActions(menu.getActions({ shouldForwardArgs: true }), (g) => /^inline/.test(g));
  }
  get inputValue() {
    return this._findInput.getValue();
  }
  get replaceValue() {
    return this._replaceInput.getValue();
  }
  get replacePattern() {
    if (this._state.isRegex) {
      return parseReplaceString(this.replaceValue);
    }
    return ReplacePattern.fromStaticValue(this.replaceValue);
  }
  get focusTracker() {
    return this._focusTracker;
  }
  get isVisible() {
    return this._isVisible;
  }
  _onStateChanged(e) {
    this._updateButtons();
    this._updateMatchesCount();
  }
  _updateButtons() {
    this._findInput.setEnabled(this._isVisible);
    this._replaceInput.setEnabled(this._isVisible && this._isReplaceVisible);
    const findInputIsNonEmpty = this._state.searchString.length > 0;
    this._replaceBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
    this._replaceAllBtn.setEnabled(this._isVisible && this._isReplaceVisible && findInputIsNonEmpty);
    this._domNode.classList.toggle("replaceToggled", this._isReplaceVisible);
    this._toggleReplaceBtn.setExpanded(this._isReplaceVisible);
    this.foundMatch = this._state.matchesCount > 0;
    this.updateButtons(this.foundMatch);
  }
  setCellSelectionDecorations() {
    const cellHandles = [];
    this._notebookEditor.getSelectionViewModels().forEach((viewModel) => {
      cellHandles.push(viewModel.handle);
    });
    const decorations = [];
    for (const handle of cellHandles) {
      decorations.push({
        handle,
        options: { className: "nb-multiCellHighlight", outputClassName: "nb-multiCellHighlight" }
      });
    }
    this.cellSelectionDecorationIds = this._notebookEditor.deltaCellDecorations([], decorations);
  }
  clearCellSelectionDecorations() {
    this._notebookEditor.deltaCellDecorations(this.cellSelectionDecorationIds, []);
  }
  setTextSelectionDecorations(textRanges, cell) {
    this._notebookEditor.changeModelDecorations((changeAccessor) => {
      const decorations = [];
      for (const range of textRanges) {
        decorations.push({
          ownerId: cell.handle,
          decorations: [{
            range,
            options: {
              description: "text search range for notebook search scope",
              isWholeLine: true,
              className: "nb-findScope"
            }
          }]
        });
      }
      this.textSelectionDecorationIds = changeAccessor.deltaDecorations([], decorations);
    });
  }
  clearTextSelectionDecorations() {
    this._notebookEditor.changeModelDecorations((changeAccessor) => {
      changeAccessor.deltaDecorations(this.textSelectionDecorationIds, []);
    });
  }
  _updateMatchesCount() {
  }
  dispose() {
    super.dispose();
    this._domNode.remove();
  }
  getDomNode() {
    return this._domNode;
  }
  reveal(initialInput) {
    if (initialInput) {
      this._findInput.setValue(initialInput);
    }
    if (this._isVisible) {
      this._findInput.select();
      return;
    }
    this._isVisible = true;
    this.updateButtons(this.foundMatch);
    setTimeout(() => {
      this._domNode.classList.add("visible", "visible-transition");
      this._domNode.setAttribute("aria-hidden", "false");
      this._findInput.select();
    }, 0);
  }
  focus() {
    this._findInput.focus();
  }
  show(initialInput, options) {
    if (initialInput) {
      this._findInput.setValue(initialInput);
    }
    this._isVisible = true;
    setTimeout(() => {
      this._domNode.classList.add("visible", "visible-transition");
      this._domNode.setAttribute("aria-hidden", "false");
      if (options?.focus ?? true) {
        this.focus();
      }
    }, 0);
  }
  showWithReplace(initialInput, replaceInput) {
    if (initialInput) {
      this._findInput.setValue(initialInput);
    }
    if (replaceInput) {
      this._replaceInput.setValue(replaceInput);
    }
    this._isVisible = true;
    this._isReplaceVisible = true;
    this._state.change({ isReplaceRevealed: this._isReplaceVisible }, false);
    this._updateReplaceViewDisplay();
    setTimeout(() => {
      this._domNode.classList.add("visible", "visible-transition");
      this._domNode.setAttribute("aria-hidden", "false");
      this._updateButtons();
      this._replaceInput.focus();
    }, 0);
  }
  _updateReplaceViewDisplay() {
    if (this._isReplaceVisible) {
      this._innerReplaceDomNode.style.display = "flex";
    } else {
      this._innerReplaceDomNode.style.display = "none";
    }
    this._replaceInput.width = dom.getTotalWidth(this._findInput.domNode);
  }
  hide() {
    if (this._isVisible) {
      this.inSelectionToggle.checked = false;
      this._notebookEditor.deltaCellDecorations(this.cellSelectionDecorationIds, []);
      this._notebookEditor.changeModelDecorations((changeAccessor) => {
        changeAccessor.deltaDecorations(this.textSelectionDecorationIds, []);
      });
      this._domNode.classList.remove("visible-transition");
      this._domNode.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        this._isVisible = false;
        this.updateButtons(this.foundMatch);
        this._domNode.classList.remove("visible");
      }, 200);
    }
  }
  _delayedUpdateHistory() {
    this._updateHistoryDelayer.trigger(this._updateHistory.bind(this));
  }
  _updateHistory() {
    this._findInput.inputBox.addToHistory();
  }
  _getRegexValue() {
    return this._findInput.getRegex();
  }
  _getWholeWordValue() {
    return this._findInput.getWholeWords();
  }
  _getCaseSensitiveValue() {
    return this._findInput.getCaseSensitive();
  }
  updateButtons(foundMatch) {
    const hasInput = this.inputValue.length > 0;
    this.prevBtn.setEnabled(this._isVisible && hasInput && foundMatch);
    this.nextBtn.setEnabled(this._isVisible && hasInput && foundMatch);
  }
};
SimpleFindReplaceWidget = __decorateClass([
  __decorateParam(0, IContextViewService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IHoverService)
], SimpleFindReplaceWidget);
registerThemingParticipant((theme, collector) => {
  collector.addRule(`
	.notebook-editor {
		--notebook-find-width: ${NOTEBOOK_FIND_WIDGET_INITIAL_WIDTH}px;
		--notebook-find-horizontal-padding: ${NOTEBOOK_FIND_WIDGET_INITIAL_HORIZONTAL_PADDING}px;
	}
	`);
});
export {
  NotebookFindInput,
  NotebookFindInputFilterButton,
  SimpleFindReplaceWidget,
  findFilterButton
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZmluZC9ub3RlYm9va0ZpbmRSZXBsYWNlV2lkZ2V0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgJy4vbm90ZWJvb2tGaW5kUmVwbGFjZVdpZGdldC5jc3MnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEFuY2hvckFsaWdubWVudCwgSUNvbnRleHRWaWV3UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZHJvcGRvd24vZHJvcGRvd25BY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBGaW5kSW5wdXQsIElGaW5kSW5wdXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ZpbmRpbnB1dC9maW5kSW5wdXQuanMnO1xuaW1wb3J0IHsgUmVwbGFjZUlucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ZpbmRpbnB1dC9yZXBsYWNlSW5wdXQuanMnO1xuaW1wb3J0IHsgSU1lc3NhZ2UgYXMgSW5wdXRCb3hNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IFByb2dyZXNzQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Byb2dyZXNzYmFyL3Byb2dyZXNzYmFyLmpzJztcbmltcG9ydCB7IElTYXNoRXZlbnQsIE9yaWVudGF0aW9uLCBTYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Nhc2gvc2FzaC5qcyc7XG5pbXBvcnQgeyBJVG9nZ2xlU3R5bGVzLCBUb2dnbGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvd2lkZ2V0LmpzJztcbmltcG9ydCB7IEFjdGlvbiwgQWN0aW9uUnVubmVyLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IERlbGF5ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1NhZmFyaSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBGaW5kUmVwbGFjZVN0YXRlLCBGaW5kUmVwbGFjZVN0YXRlQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZmluZC9icm93c2VyL2ZpbmRTdGF0ZS5qcyc7XG5pbXBvcnQgeyBmaW5kTmV4dE1hdGNoSWNvbiwgZmluZFByZXZpb3VzTWF0Y2hJY29uLCBmaW5kUmVwbGFjZUFsbEljb24sIGZpbmRSZXBsYWNlSWNvbiwgZmluZFNlbGVjdGlvbkljb24sIFNpbXBsZUJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kV2lkZ2V0LmpzJztcbmltcG9ydCB7IHBhcnNlUmVwbGFjZVN0cmluZywgUmVwbGFjZVBhdHRlcm4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9maW5kL2Jyb3dzZXIvcmVwbGFjZVBhdHRlcm4uanMnO1xuaW1wb3J0IHsgZ2V0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IENvbnRleHRTY29wZWRSZXBsYWNlSW5wdXQsIHJlZ2lzdGVyQW5kQ3JlYXRlSGlzdG9yeU5hdmlnYXRpb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaGlzdG9yeS9icm93c2VyL2NvbnRleHRTY29wZWRIaXN0b3J5V2lkZ2V0LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZGVmYXVsdElucHV0Qm94U3R5bGVzLCBkZWZhdWx0UHJvZ3Jlc3NCYXJTdHlsZXMsIGRlZmF1bHRUb2dnbGVTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSwgaW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kLCBpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlciwgaW5wdXRBY3RpdmVPcHRpb25Gb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uLCB3aWRnZXRDbG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGZpbHRlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0ljb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rRmluZEZpbHRlcnMgfSBmcm9tICcuL2ZpbmRGaWx0ZXJzLmpzJztcbmltcG9ydCB7IElTaG93Tm90ZWJvb2tGaW5kV2lkZ2V0T3B0aW9ucyB9IGZyb20gJy4vbm90ZWJvb2tGaW5kV2lkZ2V0LmpzJztcbmltcG9ydCB7IElDZWxsTW9kZWxEZWNvcmF0aW9ucywgSUNlbGxNb2RlbERlbHRhRGVjb3JhdGlvbnMsIElDZWxsVmlld01vZGVsLCBJTm90ZWJvb2tEZWx0YURlY29yYXRpb24sIElOb3RlYm9va0VkaXRvciB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0ZpbmRTY29wZVR5cGUsIE5vdGVib29rU2V0dGluZyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuXG5cbmNvbnN0IE5MU19GSU5EX0lOUFVUX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5maW5kJywgXCJGaW5kXCIpO1xuY29uc3QgTkxTX0ZJTkRfSU5QVVRfUExBQ0VIT0xERVIgPSBubHMubG9jYWxpemUoJ3BsYWNlaG9sZGVyLmZpbmQnLCBcIkZpbmRcIik7XG5jb25zdCBOTFNfUFJFVklPVVNfTUFUQ0hfQlROX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5wcmV2aW91c01hdGNoQnV0dG9uJywgXCJQcmV2aW91cyBNYXRjaFwiKTtcbmNvbnN0IE5MU19ORVhUX01BVENIX0JUTl9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnbGFiZWwubmV4dE1hdGNoQnV0dG9uJywgXCJOZXh0IE1hdGNoXCIpO1xuY29uc3QgTkxTX1RPR0dMRV9TRUxFQ1RJT05fRklORF9USVRMRSA9IG5scy5sb2NhbGl6ZSgnbGFiZWwudG9nZ2xlU2VsZWN0aW9uRmluZCcsIFwiRmluZCBpbiBTZWxlY3Rpb25cIik7XG5jb25zdCBOTFNfQ0xPU0VfQlROX0xBQkVMID0gbmxzLmxvY2FsaXplKCdsYWJlbC5jbG9zZUJ1dHRvbicsIFwiQ2xvc2VcIik7XG5jb25zdCBOTFNfVE9HR0xFX1JFUExBQ0VfTU9ERV9CVE5fTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLnRvZ2dsZVJlcGxhY2VCdXR0b24nLCBcIlRvZ2dsZSBSZXBsYWNlXCIpO1xuY29uc3QgTkxTX1JFUExBQ0VfSU5QVVRfTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLnJlcGxhY2UnLCBcIlJlcGxhY2VcIik7XG5jb25zdCBOTFNfUkVQTEFDRV9JTlBVVF9QTEFDRUhPTERFUiA9IG5scy5sb2NhbGl6ZSgncGxhY2Vob2xkZXIucmVwbGFjZScsIFwiUmVwbGFjZVwiKTtcbmNvbnN0IE5MU19SRVBMQUNFX0JUTl9MQUJFTCA9IG5scy5sb2NhbGl6ZSgnbGFiZWwucmVwbGFjZUJ1dHRvbicsIFwiUmVwbGFjZVwiKTtcbmNvbnN0IE5MU19SRVBMQUNFX0FMTF9CVE5fTEFCRUwgPSBubHMubG9jYWxpemUoJ2xhYmVsLnJlcGxhY2VBbGxCdXR0b24nLCBcIlJlcGxhY2UgQWxsXCIpO1xuXG5leHBvcnQgY29uc3QgZmluZEZpbHRlckJ1dHRvbiA9IHJlZ2lzdGVySWNvbignZmluZC1maWx0ZXInLCBDb2RpY29uLmZpbHRlciwgbmxzLmxvY2FsaXplKCdmaW5kRmlsdGVySWNvbicsICdJY29uIGZvciBGaW5kIEZpbHRlciBpbiBmaW5kIHdpZGdldC4nKSk7XG5jb25zdCBOT1RFQk9PS19GSU5EX0ZJTFRFUlMgPSBubHMubG9jYWxpemUoJ25vdGVib29rLmZpbmQuZmlsdGVyLmZpbHRlckFjdGlvbicsIFwiRmluZCBGaWx0ZXJzXCIpO1xuY29uc3QgTk9URUJPT0tfRklORF9JTl9NQVJLVVBfSU5QVVQgPSBubHMubG9jYWxpemUoJ25vdGVib29rLmZpbmQuZmlsdGVyLmZpbmRJbk1hcmt1cElucHV0JywgXCJNYXJrZG93biBTb3VyY2VcIik7XG5jb25zdCBOT1RFQk9PS19GSU5EX0lOX01BUktVUF9QUkVWSUVXID0gbmxzLmxvY2FsaXplKCdub3RlYm9vay5maW5kLmZpbHRlci5maW5kSW5NYXJrdXBQcmV2aWV3JywgXCJSZW5kZXJlZCBNYXJrZG93blwiKTtcbmNvbnN0IE5PVEVCT09LX0ZJTkRfSU5fQ09ERV9JTlBVVCA9IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZmluZC5maWx0ZXIuZmluZEluQ29kZUlucHV0JywgXCJDb2RlIENlbGwgU291cmNlXCIpO1xuY29uc3QgTk9URUJPT0tfRklORF9JTl9DT0RFX09VVFBVVCA9IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZmluZC5maWx0ZXIuZmluZEluQ29kZU91dHB1dCcsIFwiQ29kZSBDZWxsIE91dHB1dFwiKTtcblxuY29uc3QgTk9URUJPT0tfRklORF9XSURHRVRfSU5JVElBTF9XSURUSCA9IDQxOTtcbmNvbnN0IE5PVEVCT09LX0ZJTkRfV0lER0VUX0lOSVRJQUxfSE9SSVpPTlRBTF9QQURESU5HID0gNDtcbmNsYXNzIE5vdGVib29rRmluZEZpbHRlckFjdGlvblZpZXdJdGVtIGV4dGVuZHMgRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW0ge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBmaWx0ZXJzOiBOb3RlYm9va0ZpbmRGaWx0ZXJzLCBhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMsIGFjdGlvblJ1bm5lcjogSUFjdGlvblJ1bm5lciwgQElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoYWN0aW9uLFxuXHRcdFx0eyBnZXRBY3Rpb25zOiAoKSA9PiB0aGlzLmdldEFjdGlvbnMoKSB9LFxuXHRcdFx0Y29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRhY3Rpb25SdW5uZXIsXG5cdFx0XHRcdGNsYXNzTmFtZXM6IGFjdGlvbi5jbGFzcyxcblx0XHRcdFx0YW5jaG9yQWxpZ25tZW50UHJvdmlkZXI6ICgpID0+IEFuY2hvckFsaWdubWVudC5SSUdIVFxuXHRcdFx0fVxuXHRcdCk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlQ2hlY2tlZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgbWFya2Rvd25JbnB1dDogSUFjdGlvbiA9IHtcblx0XHRcdGNoZWNrZWQ6IHRoaXMuZmlsdGVycy5tYXJrdXBJbnB1dCxcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdmaW5kSW5NYXJrZG93bklucHV0Jyxcblx0XHRcdGxhYmVsOiBOT1RFQk9PS19GSU5EX0lOX01BUktVUF9JTlBVVCxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmZpbHRlcnMubWFya3VwSW5wdXQgPSAhdGhpcy5maWx0ZXJzLm1hcmt1cElucHV0O1xuXHRcdFx0fSxcblx0XHRcdHRvb2x0aXA6ICcnXG5cdFx0fTtcblxuXHRcdGNvbnN0IG1hcmtkb3duUHJldmlldzogSUFjdGlvbiA9IHtcblx0XHRcdGNoZWNrZWQ6IHRoaXMuZmlsdGVycy5tYXJrdXBQcmV2aWV3LFxuXHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRpZDogJ2ZpbmRJbk1hcmtkb3duSW5wdXQnLFxuXHRcdFx0bGFiZWw6IE5PVEVCT09LX0ZJTkRfSU5fTUFSS1VQX1BSRVZJRVcsXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhpcy5maWx0ZXJzLm1hcmt1cFByZXZpZXcgPSAhdGhpcy5maWx0ZXJzLm1hcmt1cFByZXZpZXc7XG5cdFx0XHR9LFxuXHRcdFx0dG9vbHRpcDogJydcblx0XHR9O1xuXG5cdFx0Y29uc3QgY29kZUlucHV0OiBJQWN0aW9uID0ge1xuXHRcdFx0Y2hlY2tlZDogdGhpcy5maWx0ZXJzLmNvZGVJbnB1dCxcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdmaW5kSW5Db2RlSW5wdXQnLFxuXHRcdFx0bGFiZWw6IE5PVEVCT09LX0ZJTkRfSU5fQ09ERV9JTlBVVCxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmZpbHRlcnMuY29kZUlucHV0ID0gIXRoaXMuZmlsdGVycy5jb2RlSW5wdXQ7XG5cdFx0XHR9LFxuXHRcdFx0dG9vbHRpcDogJydcblx0XHR9O1xuXG5cdFx0Y29uc3QgY29kZU91dHB1dCA9IHtcblx0XHRcdGNoZWNrZWQ6IHRoaXMuZmlsdGVycy5jb2RlT3V0cHV0LFxuXHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRpZDogJ2ZpbmRJbkNvZGVPdXRwdXQnLFxuXHRcdFx0bGFiZWw6IE5PVEVCT09LX0ZJTkRfSU5fQ09ERV9PVVRQVVQsXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhpcy5maWx0ZXJzLmNvZGVPdXRwdXQgPSAhdGhpcy5maWx0ZXJzLmNvZGVPdXRwdXQ7XG5cdFx0XHR9LFxuXHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiBudWxsXG5cdFx0fTtcblxuXHRcdGlmIChpc1NhZmFyaSkge1xuXHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0bWFya2Rvd25JbnB1dCxcblx0XHRcdFx0Y29kZUlucHV0XG5cdFx0XHRdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRtYXJrZG93bklucHV0LFxuXHRcdFx0XHRtYXJrZG93blByZXZpZXcsXG5cdFx0XHRcdG5ldyBTZXBhcmF0b3IoKSxcblx0XHRcdFx0Y29kZUlucHV0LFxuXHRcdFx0XHRjb2RlT3V0cHV0LFxuXHRcdFx0XTtcblx0XHR9XG5cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDaGVja2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudCEuY2xhc3NMaXN0LnRvZ2dsZSgnY2hlY2tlZCcsIHRoaXMuX2FjdGlvbi5jaGVja2VkKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tGaW5kSW5wdXRGaWx0ZXJCdXR0b24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfZmlsdGVyQnV0dG9uQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfYWN0aW9uYmFyOiBBY3Rpb25CYXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfZmlsdGVyc0FjdGlvbjogSUFjdGlvbjtcblx0cHJpdmF0ZSBfdG9nZ2xlU3R5bGVzOiBJVG9nZ2xlU3R5bGVzO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGZpbHRlcnM6IE5vdGVib29rRmluZEZpbHRlcnMsXG5cdFx0cmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0b3B0aW9uczogSUZpbmRJbnB1dE9wdGlvbnMsXG5cdFx0dG9vbHRpcDogc3RyaW5nID0gTk9URUJPT0tfRklORF9GSUxURVJTLFxuXHQpIHtcblxuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdG9nZ2xlU3R5bGVzID0gb3B0aW9ucy50b2dnbGVTdHlsZXM7XG5cblx0XHR0aGlzLl9maWx0ZXJzQWN0aW9uID0gbmV3IEFjdGlvbignbm90ZWJvb2tGaW5kRmlsdGVyQWN0aW9uJywgdG9vbHRpcCwgJ25vdGVib29rLWZpbHRlcnMgJyArIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShmaWx0ZXJJY29uKSk7XG5cdFx0dGhpcy5fZmlsdGVyc0FjdGlvbi5jaGVja2VkID0gZmFsc2U7XG5cdFx0dGhpcy5fZmlsdGVyQnV0dG9uQ29udGFpbmVyID0gZG9tLiQoJy5maW5kLWZpbHRlci1idXR0b24nKTtcblx0XHR0aGlzLl9maWx0ZXJCdXR0b25Db250YWluZXIuY2xhc3NMaXN0LmFkZCgnbW9uYWNvLWN1c3RvbS10b2dnbGUnKTtcblx0XHR0aGlzLmNyZWF0ZUZpbHRlcnModGhpcy5fZmlsdGVyQnV0dG9uQ29udGFpbmVyKTtcblx0fVxuXG5cdGdldCBjb250YWluZXIoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbHRlckJ1dHRvbkNvbnRhaW5lcjtcblx0fVxuXG5cdHdpZHRoKCkge1xuXHRcdHJldHVybiAyIC8qbWFyZ2luIGxlZnQqLyArIDIgLypib3JkZXIqLyArIDIgLypwYWRkaW5nKi8gKyAxNiAvKiBpY29uIHdpZHRoICovO1xuXHR9XG5cblx0ZW5hYmxlKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIFN0cmluZyhmYWxzZSkpO1xuXHR9XG5cblx0ZGlzYWJsZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCBTdHJpbmcodHJ1ZSkpO1xuXHR9XG5cblx0c2V0IHZpc2libGUodmlzaWJsZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX2ZpbHRlckJ1dHRvbkNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gdmlzaWJsZSA/ICcnIDogJ25vbmUnO1xuXHR9XG5cblx0Z2V0IHZpc2libGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbHRlckJ1dHRvbkNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG5cdH1cblxuXHRhcHBseVN0eWxlcyhmaWx0ZXJDaGVja2VkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgdG9nZ2xlU3R5bGVzID0gdGhpcy5fdG9nZ2xlU3R5bGVzO1xuXG5cdFx0dGhpcy5fZmlsdGVyQnV0dG9uQ29udGFpbmVyLnN0eWxlLmJvcmRlciA9ICcxcHggc29saWQgdHJhbnNwYXJlbnQnO1xuXHRcdHRoaXMuX2ZpbHRlckJ1dHRvbkNvbnRhaW5lci5zdHlsZS5ib3JkZXJSYWRpdXMgPSAnM3B4Jztcblx0XHR0aGlzLl9maWx0ZXJCdXR0b25Db250YWluZXIuc3R5bGUuYm9yZGVyQ29sb3IgPSAoZmlsdGVyQ2hlY2tlZCAmJiB0b2dnbGVTdHlsZXMuaW5wdXRBY3RpdmVPcHRpb25Cb3JkZXIpIHx8ICcnO1xuXHRcdHRoaXMuX2ZpbHRlckJ1dHRvbkNvbnRhaW5lci5zdHlsZS5jb2xvciA9IChmaWx0ZXJDaGVja2VkICYmIHRvZ2dsZVN0eWxlcy5pbnB1dEFjdGl2ZU9wdGlvbkZvcmVncm91bmQpIHx8ICdpbmhlcml0Jztcblx0XHR0aGlzLl9maWx0ZXJCdXR0b25Db250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gKGZpbHRlckNoZWNrZWQgJiYgdG9nZ2xlU3R5bGVzLmlucHV0QWN0aXZlT3B0aW9uQmFja2dyb3VuZCkgfHwgJyc7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZpbHRlcnMoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX2FjdGlvbmJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIoY29udGFpbmVyLCB7XG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IHRoaXMuX2ZpbHRlcnNBY3Rpb24uaWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0ZpbmRGaWx0ZXJBY3Rpb25WaWV3SXRlbSwgdGhpcy5maWx0ZXJzLCBhY3Rpb24sIG9wdGlvbnMsIHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25SdW5uZXIoKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX2FjdGlvbmJhci5wdXNoKHRoaXMuX2ZpbHRlcnNBY3Rpb24sIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va0ZpbmRJbnB1dCBleHRlbmRzIEZpbmRJbnB1dCB7XG5cdHByaXZhdGUgX2ZpbmRGaWx0ZXI6IE5vdGVib29rRmluZElucHV0RmlsdGVyQnV0dG9uO1xuXHRwcml2YXRlIF9maWx0ZXJDaGVja2VkOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgZmlsdGVyczogTm90ZWJvb2tGaW5kRmlsdGVycyxcblx0XHRjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRyZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdHBhcmVudDogSFRNTEVsZW1lbnQgfCBudWxsLFxuXHRcdGNvbnRleHRWaWV3UHJvdmlkZXI6IElDb250ZXh0Vmlld1Byb3ZpZGVyLFxuXHRcdG9wdGlvbnM6IElGaW5kSW5wdXRPcHRpb25zLFxuXHQpIHtcblx0XHRzdXBlcihwYXJlbnQsIGNvbnRleHRWaWV3UHJvdmlkZXIsIG9wdGlvbnMpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBbmRDcmVhdGVIaXN0b3J5TmF2aWdhdGlvbkNvbnRleHQoY29udGV4dEtleVNlcnZpY2UsIHRoaXMuaW5wdXRCb3gpKTtcblx0XHR0aGlzLl9maW5kRmlsdGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE5vdGVib29rRmluZElucHV0RmlsdGVyQnV0dG9uKGZpbHRlcnMsIGNvbnRleHRNZW51U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wdGlvbnMpKTtcblxuXHRcdHRoaXMuaW5wdXRCb3gucGFkZGluZ1JpZ2h0ID0gKHRoaXMuY2FzZVNlbnNpdGl2ZT8ud2lkdGgoKSA/PyAwKSArICh0aGlzLndob2xlV29yZHM/LndpZHRoKCkgPz8gMCkgKyAodGhpcy5yZWdleD8ud2lkdGgoKSA/PyAwKSArIHRoaXMuX2ZpbmRGaWx0ZXIud2lkdGgoKTtcblx0XHR0aGlzLmNvbnRyb2xzLmFwcGVuZENoaWxkKHRoaXMuX2ZpbmRGaWx0ZXIuY29udGFpbmVyKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdHN1cGVyLnNldEVuYWJsZWQoZW5hYmxlZCk7XG5cdFx0aWYgKGVuYWJsZWQgJiYgIXRoaXMuX2ZpbHRlckNoZWNrZWQpIHtcblx0XHRcdHRoaXMucmVnZXg/LmVuYWJsZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlZ2V4Py5kaXNhYmxlKCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlRmlsdGVyU3RhdGUoY2hhbmdlZDogYm9vbGVhbikge1xuXHRcdHRoaXMuX2ZpbHRlckNoZWNrZWQgPSBjaGFuZ2VkO1xuXHRcdGlmICh0aGlzLnJlZ2V4KSB7XG5cdFx0XHRpZiAodGhpcy5fZmlsdGVyQ2hlY2tlZCkge1xuXHRcdFx0XHR0aGlzLnJlZ2V4LmRpc2FibGUoKTtcblx0XHRcdFx0dGhpcy5yZWdleC5kb21Ob2RlLnRhYkluZGV4ID0gLTE7XG5cdFx0XHRcdHRoaXMucmVnZXguZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdkaXNhYmxlZCcsIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZWdleC5lbmFibGUoKTtcblx0XHRcdFx0dGhpcy5yZWdleC5kb21Ob2RlLnRhYkluZGV4ID0gMDtcblx0XHRcdFx0dGhpcy5yZWdleC5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2Rpc2FibGVkJywgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9maW5kRmlsdGVyLmFwcGx5U3R5bGVzKHRoaXMuX2ZpbHRlckNoZWNrZWQpO1xuXHR9XG5cblx0Z2V0Q2VsbFRvb2xiYXJBY3Rpb25zKG1lbnU6IElNZW51KTogeyBwcmltYXJ5OiBJQWN0aW9uW107IHNlY29uZGFyeTogSUFjdGlvbltdIH0ge1xuXHRcdHJldHVybiBnZXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLCBnID0+IC9eaW5saW5lLy50ZXN0KGcpKTtcblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgU2ltcGxlRmluZFJlcGxhY2VXaWRnZXQgZXh0ZW5kcyBXaWRnZXQge1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX2ZpbmRJbnB1dDogTm90ZWJvb2tGaW5kSW5wdXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbm5lckZpbmREb21Ob2RlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfZm9jdXNUcmFja2VyOiBkb20uSUZvY3VzVHJhY2tlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfZmluZElucHV0Rm9jdXNUcmFja2VyOiBkb20uSUZvY3VzVHJhY2tlcjtcblx0cHJpdmF0ZSByZWFkb25seSBfdXBkYXRlSGlzdG9yeURlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cdHByb3RlY3RlZCByZWFkb25seSBfbWF0Y2hlc0NvdW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgcHJldkJ0bjogU2ltcGxlQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IG5leHRCdG46IFNpbXBsZUJ1dHRvbjtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX3JlcGxhY2VJbnB1dCE6IFJlcGxhY2VJbnB1dDtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5uZXJSZXBsYWNlRG9tTm9kZSE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF90b2dnbGVSZXBsYWNlQnRuITogU2ltcGxlQnV0dG9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXBsYWNlSW5wdXRGb2N1c1RyYWNrZXIhOiBkb20uSUZvY3VzVHJhY2tlcjtcblx0cHJvdGVjdGVkIF9yZXBsYWNlQnRuITogU2ltcGxlQnV0dG9uO1xuXHRwcm90ZWN0ZWQgX3JlcGxhY2VBbGxCdG4hOiBTaW1wbGVCdXR0b247XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVzaXplU2FzaDogU2FzaDtcblx0cHJpdmF0ZSBfcmVzaXplT3JpZ2luYWxXaWR0aCA9IE5PVEVCT09LX0ZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEg7XG5cblx0cHJpdmF0ZSBfaXNWaXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2lzUmVwbGFjZVZpc2libGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBmb3VuZE1hdGNoOiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJvdGVjdGVkIF9wcm9ncmVzc0JhciE6IFByb2dyZXNzQmFyO1xuXHRwcm90ZWN0ZWQgX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2U7XG5cblx0cHJpdmF0ZSBfZmlsdGVyczogTm90ZWJvb2tGaW5kRmlsdGVycztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGluU2VsZWN0aW9uVG9nZ2xlOiBUb2dnbGU7XG5cdHByaXZhdGUgY2VsbFNlbGVjdGlvbkRlY29yYXRpb25JZHM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgdGV4dFNlbGVjdGlvbkRlY29yYXRpb25JZHM6IElDZWxsTW9kZWxEZWNvcmF0aW9uc1tdID0gW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9zdGF0ZTogRmluZFJlcGxhY2VTdGF0ZTxOb3RlYm9va0ZpbmRGaWx0ZXJzPiA9IG5ldyBGaW5kUmVwbGFjZVN0YXRlPE5vdGVib29rRmluZEZpbHRlcnM+KCksXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9ub3RlYm9va0VkaXRvcjogSU5vdGVib29rRWRpdG9yLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3RhdGUpO1xuXG5cdFx0Y29uc3QgZmluZEZpbHRlcnMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7XG5cdFx0XHRtYXJrdXBTb3VyY2U6IGJvb2xlYW47XG5cdFx0XHRtYXJrdXBQcmV2aWV3OiBib29sZWFuO1xuXHRcdFx0Y29kZVNvdXJjZTogYm9vbGVhbjtcblx0XHRcdGNvZGVPdXRwdXQ6IGJvb2xlYW47XG5cdFx0fT4oTm90ZWJvb2tTZXR0aW5nLmZpbmRGaWx0ZXJzKSA/PyB7IG1hcmt1cFNvdXJjZTogdHJ1ZSwgbWFya3VwUHJldmlldzogdHJ1ZSwgY29kZVNvdXJjZTogdHJ1ZSwgY29kZU91dHB1dDogdHJ1ZSB9O1xuXG5cdFx0dGhpcy5fZmlsdGVycyA9IG5ldyBOb3RlYm9va0ZpbmRGaWx0ZXJzKGZpbmRGaWx0ZXJzLm1hcmt1cFNvdXJjZSwgZmluZEZpbHRlcnMubWFya3VwUHJldmlldywgZmluZEZpbHRlcnMuY29kZVNvdXJjZSwgZmluZEZpbHRlcnMuY29kZU91dHB1dCwgeyBmaW5kU2NvcGVUeXBlOiBOb3RlYm9va0ZpbmRTY29wZVR5cGUuTm9uZSB9KTtcblx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBmaWx0ZXJzOiB0aGlzLl9maWx0ZXJzIH0sIGZhbHNlKTtcblxuXHRcdHRoaXMuX2ZpbHRlcnMub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgZmlsdGVyczogdGhpcy5fZmlsdGVycyB9LCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdzaW1wbGUtZnItZmluZC1wYXJ0LXdyYXBwZXInKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LnJ1bkFuZFN1YnNjcmliZSh0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4ge1xuXHRcdFx0aWYgKCFlIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmdsb2JhbFRvb2xiYXIpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9ub3RlYm9va0VkaXRvci5ub3RlYm9va09wdGlvbnMuZ2V0TGF5b3V0Q29uZmlndXJhdGlvbigpLmdsb2JhbFRvb2xiYXIpIHtcblx0XHRcdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLnRvcCA9ICcyNnB4Jztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9kb21Ob2RlLnN0eWxlLnRvcCA9ICcwcHgnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3RhdGUub25GaW5kUmVwbGFjZVN0YXRlQ2hhbmdlKChlKSA9PiB0aGlzLl9vblN0YXRlQ2hhbmdlZChlKSkpO1xuXHRcdHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuX2RvbU5vZGUpO1xuXG5cdFx0Y29uc3QgcHJvZ3Jlc3NDb250YWluZXIgPSBkb20uJCgnLmZpbmQtcmVwbGFjZS1wcm9ncmVzcycpO1xuXHRcdHRoaXMuX3Byb2dyZXNzQmFyID0gbmV3IFByb2dyZXNzQmFyKHByb2dyZXNzQ29udGFpbmVyLCBkZWZhdWx0UHJvZ3Jlc3NCYXJTdHlsZXMpO1xuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQocHJvZ3Jlc3NDb250YWluZXIpO1xuXG5cdFx0Y29uc3QgaXNJbnRlcmFjdGl2ZVdpbmRvdyA9IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZSgnbm90ZWJvb2tUeXBlJykgPT09ICdpbnRlcmFjdGl2ZSc7XG5cdFx0Ly8gVG9nZ2xlIHJlcGxhY2UgYnV0dG9uXG5cdFx0dGhpcy5fdG9nZ2xlUmVwbGFjZUJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19UT0dHTEVfUkVQTEFDRV9NT0RFX0JUTl9MQUJFTCxcblx0XHRcdGNsYXNzTmFtZTogJ2NvZGljb24gdG9nZ2xlIGxlZnQnLFxuXHRcdFx0b25UcmlnZ2VyOiBpc0ludGVyYWN0aXZlV2luZG93ID8gKCkgPT4geyB9IDpcblx0XHRcdFx0KCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2lzUmVwbGFjZVZpc2libGUgPSAhdGhpcy5faXNSZXBsYWNlVmlzaWJsZTtcblx0XHRcdFx0XHR0aGlzLl9zdGF0ZS5jaGFuZ2UoeyBpc1JlcGxhY2VSZXZlYWxlZDogdGhpcy5faXNSZXBsYWNlVmlzaWJsZSB9LCBmYWxzZSk7XG5cdFx0XHRcdFx0dGhpcy5fdXBkYXRlUmVwbGFjZVZpZXdEaXNwbGF5KCk7XG5cdFx0XHRcdH1cblx0XHR9LCBob3ZlclNlcnZpY2UpKTtcblx0XHR0aGlzLl90b2dnbGVSZXBsYWNlQnRuLnNldEVuYWJsZWQoIWlzSW50ZXJhY3RpdmVXaW5kb3cpO1xuXHRcdHRoaXMuX3RvZ2dsZVJlcGxhY2VCdG4uc2V0RXhwYW5kZWQodGhpcy5faXNSZXBsYWNlVmlzaWJsZSk7XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl90b2dnbGVSZXBsYWNlQnRuLmRvbU5vZGUpO1xuXG5cblxuXHRcdHRoaXMuX2lubmVyRmluZERvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9pbm5lckZpbmREb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3NpbXBsZS1mci1maW5kLXBhcnQnKTtcblxuXHRcdHRoaXMuX2ZpbmRJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBOb3RlYm9va0ZpbmRJbnB1dChcblx0XHRcdHRoaXMuX2ZpbHRlcnMsXG5cdFx0XHR0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZSxcblx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdG51bGwsXG5cdFx0XHR0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0XHR7XG5cdFx0XHRcdC8vIHdpZHRoOkZJTkRfSU5QVVRfQVJFQV9XSURUSCxcblx0XHRcdFx0bGFiZWw6IE5MU19GSU5EX0lOUFVUX0xBQkVMLFxuXHRcdFx0XHRwbGFjZWhvbGRlcjogTkxTX0ZJTkRfSU5QVVRfUExBQ0VIT0xERVIsXG5cdFx0XHRcdHZhbGlkYXRpb246ICh2YWx1ZTogc3RyaW5nKTogSW5wdXRCb3hNZXNzYWdlIHwgbnVsbCA9PiB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlLmxlbmd0aCA9PT0gMCB8fCAhdGhpcy5fZmluZElucHV0LmdldFJlZ2V4KCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0bmV3IFJlZ0V4cCh2YWx1ZSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZvdW5kTWF0Y2ggPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlQnV0dG9ucyh0aGlzLmZvdW5kTWF0Y2gpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgY29udGVudDogZS5tZXNzYWdlIH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmbGV4aWJsZVdpZHRoOiB0cnVlLFxuXHRcdFx0XHRzaG93Q29tbW9uRmluZFRvZ2dsZXM6IHRydWUsXG5cdFx0XHRcdGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXMsXG5cdFx0XHRcdHRvZ2dsZVN0eWxlczogZGVmYXVsdFRvZ2dsZVN0eWxlc1xuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0Ly8gRmluZCBIaXN0b3J5IHdpdGggdXBkYXRlIGRlbGF5ZXJcblx0XHR0aGlzLl91cGRhdGVIaXN0b3J5RGVsYXllciA9IG5ldyBEZWxheWVyPHZvaWQ+KDUwMCk7XG5cblx0XHR0aGlzLm9uaW5wdXQodGhpcy5fZmluZElucHV0LmRvbU5vZGUsIChlKSA9PiB7XG5cdFx0XHR0aGlzLmZvdW5kTWF0Y2ggPSB0aGlzLm9uSW5wdXRDaGFuZ2VkKCk7XG5cdFx0XHR0aGlzLnVwZGF0ZUJ1dHRvbnModGhpcy5mb3VuZE1hdGNoKTtcblx0XHRcdHRoaXMuX2RlbGF5ZWRVcGRhdGVIaXN0b3J5KCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3gub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy5fc3RhdGUuY2hhbmdlKHsgc2VhcmNoU3RyaW5nOiB0aGlzLl9maW5kSW5wdXQuZ2V0VmFsdWUoKSB9LCB0cnVlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9maW5kSW5wdXQuc2V0UmVnZXgoISF0aGlzLl9zdGF0ZS5pc1JlZ2V4KTtcblx0XHR0aGlzLl9maW5kSW5wdXQuc2V0Q2FzZVNlbnNpdGl2ZSghIXRoaXMuX3N0YXRlLm1hdGNoQ2FzZSk7XG5cdFx0dGhpcy5fZmluZElucHV0LnNldFdob2xlV29yZHMoISF0aGlzLl9zdGF0ZS53aG9sZVdvcmQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Lm9uRGlkT3B0aW9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7XG5cdFx0XHRcdGlzUmVnZXg6IHRoaXMuX2ZpbmRJbnB1dC5nZXRSZWdleCgpLFxuXHRcdFx0XHR3aG9sZVdvcmQ6IHRoaXMuX2ZpbmRJbnB1dC5nZXRXaG9sZVdvcmRzKCksXG5cdFx0XHRcdG1hdGNoQ2FzZTogdGhpcy5fZmluZElucHV0LmdldENhc2VTZW5zaXRpdmUoKVxuXHRcdFx0fSwgdHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3RhdGUub25GaW5kUmVwbGFjZVN0YXRlQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRSZWdleCh0aGlzLl9zdGF0ZS5pc1JlZ2V4KTtcblx0XHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRXaG9sZVdvcmRzKHRoaXMuX3N0YXRlLndob2xlV29yZCk7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2V0Q2FzZVNlbnNpdGl2ZSh0aGlzLl9zdGF0ZS5tYXRjaENhc2UpO1xuXHRcdFx0dGhpcy5fcmVwbGFjZUlucHV0LnNldFByZXNlcnZlQ2FzZSh0aGlzLl9zdGF0ZS5wcmVzZXJ2ZUNhc2UpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX21hdGNoZXNDb3VudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuX21hdGNoZXNDb3VudC5jbGFzc05hbWUgPSAnbWF0Y2hlc0NvdW50Jztcblx0XHR0aGlzLl91cGRhdGVNYXRjaGVzQ291bnQoKTtcblxuXHRcdHRoaXMucHJldkJ0biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTaW1wbGVCdXR0b24oe1xuXHRcdFx0bGFiZWw6IE5MU19QUkVWSU9VU19NQVRDSF9CVE5fTEFCRUwsXG5cdFx0XHRpY29uOiBmaW5kUHJldmlvdXNNYXRjaEljb24sXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5maW5kKHRydWUpO1xuXHRcdFx0fVxuXHRcdH0sIGhvdmVyU2VydmljZSkpO1xuXG5cdFx0dGhpcy5uZXh0QnRuID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNpbXBsZUJ1dHRvbih7XG5cdFx0XHRsYWJlbDogTkxTX05FWFRfTUFUQ0hfQlROX0xBQkVMLFxuXHRcdFx0aWNvbjogZmluZE5leHRNYXRjaEljb24sXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5maW5kKGZhbHNlKTtcblx0XHRcdH1cblx0XHR9LCBob3ZlclNlcnZpY2UpKTtcblxuXHRcdHRoaXMuaW5TZWxlY3Rpb25Ub2dnbGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgVG9nZ2xlKHtcblx0XHRcdGljb246IGZpbmRTZWxlY3Rpb25JY29uLFxuXHRcdFx0dGl0bGU6IE5MU19UT0dHTEVfU0VMRUNUSU9OX0ZJTkRfVElUTEUsXG5cdFx0XHRpc0NoZWNrZWQ6IGZhbHNlLFxuXHRcdFx0aW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGlucHV0QWN0aXZlT3B0aW9uQmFja2dyb3VuZCksXG5cdFx0XHRpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlcjogYXNDc3NWYXJpYWJsZShpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlciksXG5cdFx0XHRpbnB1dEFjdGl2ZU9wdGlvbkZvcmVncm91bmQ6IGFzQ3NzVmFyaWFibGUoaW5wdXRBY3RpdmVPcHRpb25Gb3JlZ3JvdW5kKSxcblx0XHR9KSk7XG5cdFx0dGhpcy5pblNlbGVjdGlvblRvZ2dsZS5kb21Ob2RlLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcblxuXHRcdHRoaXMuaW5TZWxlY3Rpb25Ub2dnbGUub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2hlY2tlZCA9IHRoaXMuaW5TZWxlY3Rpb25Ub2dnbGUuY2hlY2tlZDtcblx0XHRcdGlmIChjaGVja2VkKSB7XG5cdFx0XHRcdC8vIHNlbGVjdGlvbiBsb2dpYzpcblx0XHRcdFx0Ly8gMS4gaWYgdGhlcmUgYXJlIG11bHRpcGxlIGNlbGxzLCBkbyB0aGF0LlxuXHRcdFx0XHQvLyAyLiBpZiB0aGVyZSBpcyBvbmx5IG9uZSBjZWxsLCBkbyB0aGUgZm9sbG93aW5nOlxuXHRcdFx0XHQvLyBcdFx0LSBpZiB0aGVyZSBpcyBhIG11bHRpLWxpbmUgcmFuZ2UgaGlnaGxpZ2h0ZWQsIHRleHR1YWwgaW4gc2VsZWN0aW9uXG5cdFx0XHRcdC8vIFx0XHQtIGlmIHRoZXJlIGlzIG5vIHJhbmdlLCBjZWxsIGluIHNlbGVjdGlvbiBmb3IgdGhhdCBjZWxsXG5cblx0XHRcdFx0Y29uc3QgY2VsbFNlbGVjdGlvbjogSUNlbGxSYW5nZVtdID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0U2VsZWN0aW9ucygpO1xuXHRcdFx0XHRjb25zdCB0ZXh0U2VsZWN0aW9uOiBSYW5nZVtdID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZ2V0U2VsZWN0aW9uVmlld01vZGVscygpWzBdLmdldFNlbGVjdGlvbnMoKTtcblxuXHRcdFx0XHRpZiAoY2VsbFNlbGVjdGlvbi5sZW5ndGggPiAxIHx8IGNlbGxTZWxlY3Rpb24uc29tZShyYW5nZSA9PiByYW5nZS5lbmQgLSByYW5nZS5zdGFydCA+IDEpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZmlsdGVycy5maW5kU2NvcGUgPSB7XG5cdFx0XHRcdFx0XHRmaW5kU2NvcGVUeXBlOiBOb3RlYm9va0ZpbmRTY29wZVR5cGUuQ2VsbHMsXG5cdFx0XHRcdFx0XHRzZWxlY3RlZENlbGxSYW5nZXM6IGNlbGxTZWxlY3Rpb25cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRoaXMuc2V0Q2VsbFNlbGVjdGlvbkRlY29yYXRpb25zKCk7XG5cblx0XHRcdFx0fSBlbHNlIGlmICh0ZXh0U2VsZWN0aW9uLmxlbmd0aCA+IDEgfHwgdGV4dFNlbGVjdGlvbi5zb21lKHJhbmdlID0+IHJhbmdlLmVuZExpbmVOdW1iZXIgLSByYW5nZS5zdGFydExpbmVOdW1iZXIgPj0gMSkpIHtcblx0XHRcdFx0XHR0aGlzLl9maWx0ZXJzLmZpbmRTY29wZSA9IHtcblx0XHRcdFx0XHRcdGZpbmRTY29wZVR5cGU6IE5vdGVib29rRmluZFNjb3BlVHlwZS5UZXh0LFxuXHRcdFx0XHRcdFx0c2VsZWN0ZWRDZWxsUmFuZ2VzOiBjZWxsU2VsZWN0aW9uLFxuXHRcdFx0XHRcdFx0c2VsZWN0ZWRUZXh0UmFuZ2VzOiB0ZXh0U2VsZWN0aW9uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0aGlzLnNldFRleHRTZWxlY3Rpb25EZWNvcmF0aW9ucyh0ZXh0U2VsZWN0aW9uLCB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRTZWxlY3Rpb25WaWV3TW9kZWxzKClbMF0pO1xuXG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fZmlsdGVycy5maW5kU2NvcGUgPSB7XG5cdFx0XHRcdFx0XHRmaW5kU2NvcGVUeXBlOiBOb3RlYm9va0ZpbmRTY29wZVR5cGUuQ2VsbHMsXG5cdFx0XHRcdFx0XHRzZWxlY3RlZENlbGxSYW5nZXM6IGNlbGxTZWxlY3Rpb25cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHRoaXMuc2V0Q2VsbFNlbGVjdGlvbkRlY29yYXRpb25zKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2ZpbHRlcnMuZmluZFNjb3BlID0ge1xuXHRcdFx0XHRcdGZpbmRTY29wZVR5cGU6IE5vdGVib29rRmluZFNjb3BlVHlwZS5Ob25lXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuY2xlYXJDZWxsU2VsZWN0aW9uRGVjb3JhdGlvbnMoKTtcblx0XHRcdFx0dGhpcy5jbGVhclRleHRTZWxlY3Rpb25EZWNvcmF0aW9ucygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2xvc2VCdG4gPSB0aGlzLl9yZWdpc3RlcihuZXcgU2ltcGxlQnV0dG9uKHtcblx0XHRcdGxhYmVsOiBOTFNfQ0xPU0VfQlROX0xBQkVMLFxuXHRcdFx0aWNvbjogd2lkZ2V0Q2xvc2UsXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0fSwgaG92ZXJTZXJ2aWNlKSk7XG5cblx0XHR0aGlzLl9pbm5lckZpbmREb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX2ZpbmRJbnB1dC5kb21Ob2RlKTtcblx0XHR0aGlzLl9pbm5lckZpbmREb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX21hdGNoZXNDb3VudCk7XG5cdFx0dGhpcy5faW5uZXJGaW5kRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLnByZXZCdG4uZG9tTm9kZSk7XG5cdFx0dGhpcy5faW5uZXJGaW5kRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLm5leHRCdG4uZG9tTm9kZSk7XG5cdFx0dGhpcy5faW5uZXJGaW5kRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLmluU2VsZWN0aW9uVG9nZ2xlLmRvbU5vZGUpO1xuXHRcdHRoaXMuX2lubmVyRmluZERvbU5vZGUuYXBwZW5kQ2hpbGQoY2xvc2VCdG4uZG9tTm9kZSk7XG5cblx0XHQvLyBfZG9tTm9kZSB3cmFwcyBfaW5uZXJEb21Ob2RlLCBlbnN1cmluZyB0aGF0XG5cdFx0dGhpcy5fZG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9pbm5lckZpbmREb21Ob2RlKTtcblxuXHRcdHRoaXMub25rZXl1cCh0aGlzLl9pbm5lckZpbmREb21Ob2RlLCBlID0+IHtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVzY2FwZSkpIHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5fZm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5fZG9tTm9kZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKHRoaXMub25Gb2N1c1RyYWNrZXJGb2N1cy5iaW5kKHRoaXMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZm9jdXNUcmFja2VyLm9uRGlkQmx1cih0aGlzLm9uRm9jdXNUcmFja2VyQmx1ci5iaW5kKHRoaXMpKSk7XG5cblx0XHR0aGlzLl9maW5kSW5wdXRGb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcihkb20udHJhY2tGb2N1cyh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2ZpbmRJbnB1dEZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKHRoaXMub25GaW5kSW5wdXRGb2N1c1RyYWNrZXJGb2N1cy5iaW5kKHRoaXMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZmluZElucHV0Rm9jdXNUcmFja2VyLm9uRGlkQmx1cih0aGlzLm9uRmluZElucHV0Rm9jdXNUcmFja2VyQmx1ci5iaW5kKHRoaXMpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2lubmVyRmluZERvbU5vZGUsICdjbGljaycsIChldmVudCkgPT4ge1xuXHRcdFx0ZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVwbGFjZVxuXHRcdHRoaXMuX2lubmVyUmVwbGFjZURvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHR0aGlzLl9pbm5lclJlcGxhY2VEb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3NpbXBsZS1mci1yZXBsYWNlLXBhcnQnKTtcblxuXHRcdHRoaXMuX3JlcGxhY2VJbnB1dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb250ZXh0U2NvcGVkUmVwbGFjZUlucHV0KG51bGwsIHVuZGVmaW5lZCwge1xuXHRcdFx0bGFiZWw6IE5MU19SRVBMQUNFX0lOUFVUX0xBQkVMLFxuXHRcdFx0cGxhY2Vob2xkZXI6IE5MU19SRVBMQUNFX0lOUFVUX1BMQUNFSE9MREVSLFxuXHRcdFx0aGlzdG9yeTogbmV3IFNldChbXSksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogZGVmYXVsdElucHV0Qm94U3R5bGVzLFxuXHRcdFx0dG9nZ2xlU3R5bGVzOiBkZWZhdWx0VG9nZ2xlU3R5bGVzXG5cdFx0fSwgY29udGV4dEtleVNlcnZpY2UsIGZhbHNlKSk7XG5cdFx0dGhpcy5faW5uZXJSZXBsYWNlRG9tTm9kZS5hcHBlbmRDaGlsZCh0aGlzLl9yZXBsYWNlSW5wdXQuZG9tTm9kZSk7XG5cdFx0dGhpcy5fcmVwbGFjZUlucHV0Rm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoZG9tLnRyYWNrRm9jdXModGhpcy5fcmVwbGFjZUlucHV0LmRvbU5vZGUpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXBsYWNlSW5wdXRGb2N1c1RyYWNrZXIub25EaWRGb2N1cyh0aGlzLm9uUmVwbGFjZUlucHV0Rm9jdXNUcmFja2VyRm9jdXMuYmluZCh0aGlzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3JlcGxhY2VJbnB1dEZvY3VzVHJhY2tlci5vbkRpZEJsdXIodGhpcy5vblJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlckJsdXIuYmluZCh0aGlzKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcmVwbGFjZUlucHV0LmlucHV0Qm94Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IHJlcGxhY2VTdHJpbmc6IHRoaXMuX3JlcGxhY2VJbnB1dC5nZXRWYWx1ZSgpIH0sIHRydWUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2RvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5faW5uZXJSZXBsYWNlRG9tTm9kZSk7XG5cblx0XHR0aGlzLl91cGRhdGVSZXBsYWNlVmlld0Rpc3BsYXkoKTtcblxuXHRcdHRoaXMuX3JlcGxhY2VCdG4gPSB0aGlzLl9yZWdpc3RlcihuZXcgU2ltcGxlQnV0dG9uKHtcblx0XHRcdGxhYmVsOiBOTFNfUkVQTEFDRV9CVE5fTEFCRUwsXG5cdFx0XHRpY29uOiBmaW5kUmVwbGFjZUljb24sXG5cdFx0XHRvblRyaWdnZXI6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5yZXBsYWNlT25lKCk7XG5cdFx0XHR9XG5cdFx0fSwgaG92ZXJTZXJ2aWNlKSk7XG5cblx0XHQvLyBSZXBsYWNlIGFsbCBidXR0b25cblx0XHR0aGlzLl9yZXBsYWNlQWxsQnRuID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNpbXBsZUJ1dHRvbih7XG5cdFx0XHRsYWJlbDogTkxTX1JFUExBQ0VfQUxMX0JUTl9MQUJFTCxcblx0XHRcdGljb246IGZpbmRSZXBsYWNlQWxsSWNvbixcblx0XHRcdG9uVHJpZ2dlcjogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnJlcGxhY2VBbGwoKTtcblx0XHRcdH1cblx0XHR9LCBob3ZlclNlcnZpY2UpKTtcblxuXHRcdHRoaXMuX2lubmVyUmVwbGFjZURvbU5vZGUuYXBwZW5kQ2hpbGQodGhpcy5fcmVwbGFjZUJ0bi5kb21Ob2RlKTtcblx0XHR0aGlzLl9pbm5lclJlcGxhY2VEb21Ob2RlLmFwcGVuZENoaWxkKHRoaXMuX3JlcGxhY2VBbGxCdG4uZG9tTm9kZSk7XG5cblx0XHR0aGlzLl9yZXNpemVTYXNoID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNhc2godGhpcy5fZG9tTm9kZSwgeyBnZXRWZXJ0aWNhbFNhc2hMZWZ0OiAoKSA9PiAwIH0sIHsgb3JpZW50YXRpb246IE9yaWVudGF0aW9uLlZFUlRJQ0FMLCBzaXplOiAyIH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Jlc2l6ZVNhc2gub25EaWRTdGFydCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9yZXNpemVPcmlnaW5hbFdpZHRoID0gdGhpcy5fZ2V0RG9tV2lkdGgoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXNpemVTYXNoLm9uRGlkQ2hhbmdlKChldnQ6IElTYXNoRXZlbnQpID0+IHtcblx0XHRcdGxldCB3aWR0aCA9IHRoaXMuX3Jlc2l6ZU9yaWdpbmFsV2lkdGggKyBldnQuc3RhcnRYIC0gZXZ0LmN1cnJlbnRYO1xuXHRcdFx0aWYgKHdpZHRoIDwgTk9URUJPT0tfRklORF9XSURHRVRfSU5JVElBTF9XSURUSCkge1xuXHRcdFx0XHR3aWR0aCA9IE5PVEVCT09LX0ZJTkRfV0lER0VUX0lOSVRJQUxfV0lEVEg7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1heFdpZHRoID0gdGhpcy5fZ2V0TWF4V2lkdGgoKTtcblx0XHRcdGlmICh3aWR0aCA+IG1heFdpZHRoKSB7XG5cdFx0XHRcdHdpZHRoID0gbWF4V2lkdGg7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX2RvbU5vZGUuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG5cblx0XHRcdGlmICh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC53aWR0aCA9IGRvbS5nZXRUb3RhbFdpZHRoKHRoaXMuX2ZpbmRJbnB1dC5kb21Ob2RlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZmluZElucHV0LmlucHV0Qm94LmxheW91dCgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Jlc2l6ZVNhc2gub25EaWRSZXNldCgoKSA9PiB7XG5cdFx0XHQvLyB1c2VycyBkb3VibGUgY2xpY2sgb24gdGhlIHNhc2hcblx0XHRcdC8vIHRyeSB0byBlbXVsYXRlIHdoYXQgaGFwcGVucyB3aXRoIGVkaXRvciBmaW5kV2lkZ2V0XG5cdFx0XHRjb25zdCBjdXJyZW50V2lkdGggPSB0aGlzLl9nZXREb21XaWR0aCgpO1xuXHRcdFx0bGV0IHdpZHRoID0gTk9URUJPT0tfRklORF9XSURHRVRfSU5JVElBTF9XSURUSDtcblxuXHRcdFx0aWYgKGN1cnJlbnRXaWR0aCA8PSBOT1RFQk9PS19GSU5EX1dJREdFVF9JTklUSUFMX1dJRFRIKSB7XG5cdFx0XHRcdHdpZHRoID0gdGhpcy5fZ2V0TWF4V2lkdGgoKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZG9tTm9kZS5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHRcdGlmICh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKSB7XG5cdFx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC53aWR0aCA9IGRvbS5nZXRUb3RhbFdpZHRoKHRoaXMuX2ZpbmRJbnB1dC5kb21Ob2RlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fZmluZElucHV0LmlucHV0Qm94LmxheW91dCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE1heFdpZHRoKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGggLSA2NDtcblx0fVxuXG5cdHByaXZhdGUgX2dldERvbVdpZHRoKCkge1xuXHRcdHJldHVybiBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9kb21Ob2RlKSAtIChOT1RFQk9PS19GSU5EX1dJREdFVF9JTklUSUFMX0hPUklaT05UQUxfUEFERElORyAqIDIpO1xuXHR9XG5cblx0Z2V0Q2VsbFRvb2xiYXJBY3Rpb25zKG1lbnU6IElNZW51KTogeyBwcmltYXJ5OiBJQWN0aW9uW107IHNlY29uZGFyeTogSUFjdGlvbltdIH0ge1xuXHRcdHJldHVybiBnZXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pLCBnID0+IC9eaW5saW5lLy50ZXN0KGcpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBvbklucHV0Q2hhbmdlZCgpOiBib29sZWFuO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZmluZChwcmV2aW91czogYm9vbGVhbik6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCByZXBsYWNlT25lKCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCByZXBsYWNlQWxsKCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBvbkZvY3VzVHJhY2tlckZvY3VzKCk6IHZvaWQ7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBvbkZvY3VzVHJhY2tlckJsdXIoKTogdm9pZDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IG9uRmluZElucHV0Rm9jdXNUcmFja2VyRm9jdXMoKTogdm9pZDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IG9uRmluZElucHV0Rm9jdXNUcmFja2VyQmx1cigpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3Qgb25SZXBsYWNlSW5wdXRGb2N1c1RyYWNrZXJGb2N1cygpOiB2b2lkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3Qgb25SZXBsYWNlSW5wdXRGb2N1c1RyYWNrZXJCbHVyKCk6IHZvaWQ7XG5cblx0cHJvdGVjdGVkIGdldCBpbnB1dFZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl9maW5kSW5wdXQuZ2V0VmFsdWUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXQgcmVwbGFjZVZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl9yZXBsYWNlSW5wdXQuZ2V0VmFsdWUoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXQgcmVwbGFjZVBhdHRlcm4oKSB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlLmlzUmVnZXgpIHtcblx0XHRcdHJldHVybiBwYXJzZVJlcGxhY2VTdHJpbmcodGhpcy5yZXBsYWNlVmFsdWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gUmVwbGFjZVBhdHRlcm4uZnJvbVN0YXRpY1ZhbHVlKHRoaXMucmVwbGFjZVZhbHVlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZm9jdXNUcmFja2VyKCk6IGRvbS5JRm9jdXNUcmFja2VyIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9jdXNUcmFja2VyO1xuXHR9XG5cblx0cHVibGljIGdldCBpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzVmlzaWJsZTtcblx0fVxuXG5cdHByaXZhdGUgX29uU3RhdGVDaGFuZ2VkKGU6IEZpbmRSZXBsYWNlU3RhdGVDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cdFx0dGhpcy5fdXBkYXRlTWF0Y2hlc0NvdW50KCk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVCdXR0b25zKCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5zZXRFbmFibGVkKHRoaXMuX2lzVmlzaWJsZSk7XG5cdFx0dGhpcy5fcmVwbGFjZUlucHV0LnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIHRoaXMuX2lzUmVwbGFjZVZpc2libGUpO1xuXHRcdGNvbnN0IGZpbmRJbnB1dElzTm9uRW1wdHkgPSAodGhpcy5fc3RhdGUuc2VhcmNoU3RyaW5nLmxlbmd0aCA+IDApO1xuXHRcdHRoaXMuX3JlcGxhY2VCdG4uc2V0RW5hYmxlZCh0aGlzLl9pc1Zpc2libGUgJiYgdGhpcy5faXNSZXBsYWNlVmlzaWJsZSAmJiBmaW5kSW5wdXRJc05vbkVtcHR5KTtcblx0XHR0aGlzLl9yZXBsYWNlQWxsQnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIHRoaXMuX2lzUmVwbGFjZVZpc2libGUgJiYgZmluZElucHV0SXNOb25FbXB0eSk7XG5cblx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ3JlcGxhY2VUb2dnbGVkJywgdGhpcy5faXNSZXBsYWNlVmlzaWJsZSk7XG5cdFx0dGhpcy5fdG9nZ2xlUmVwbGFjZUJ0bi5zZXRFeHBhbmRlZCh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKTtcblxuXHRcdHRoaXMuZm91bmRNYXRjaCA9IHRoaXMuX3N0YXRlLm1hdGNoZXNDb3VudCA+IDA7XG5cdFx0dGhpcy51cGRhdGVCdXR0b25zKHRoaXMuZm91bmRNYXRjaCk7XG5cdH1cblxuXHRwcml2YXRlIHNldENlbGxTZWxlY3Rpb25EZWNvcmF0aW9ucygpIHtcblx0XHRjb25zdCBjZWxsSGFuZGxlczogbnVtYmVyW10gPSBbXTtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5nZXRTZWxlY3Rpb25WaWV3TW9kZWxzKCkuZm9yRWFjaCh2aWV3TW9kZWwgPT4ge1xuXHRcdFx0Y2VsbEhhbmRsZXMucHVzaCh2aWV3TW9kZWwuaGFuZGxlKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRlY29yYXRpb25zOiBJTm90ZWJvb2tEZWx0YURlY29yYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgaGFuZGxlIG9mIGNlbGxIYW5kbGVzKSB7XG5cdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0aGFuZGxlOiBoYW5kbGUsXG5cdFx0XHRcdG9wdGlvbnM6IHsgY2xhc3NOYW1lOiAnbmItbXVsdGlDZWxsSGlnaGxpZ2h0Jywgb3V0cHV0Q2xhc3NOYW1lOiAnbmItbXVsdGlDZWxsSGlnaGxpZ2h0JyB9XG5cdFx0XHR9IHNhdGlzZmllcyBJTm90ZWJvb2tEZWx0YURlY29yYXRpb24pO1xuXHRcdH1cblx0XHR0aGlzLmNlbGxTZWxlY3Rpb25EZWNvcmF0aW9uSWRzID0gdGhpcy5fbm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsRGVjb3JhdGlvbnMoW10sIGRlY29yYXRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXJDZWxsU2VsZWN0aW9uRGVjb3JhdGlvbnMoKSB7XG5cdFx0dGhpcy5fbm90ZWJvb2tFZGl0b3IuZGVsdGFDZWxsRGVjb3JhdGlvbnModGhpcy5jZWxsU2VsZWN0aW9uRGVjb3JhdGlvbklkcywgW10pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRUZXh0U2VsZWN0aW9uRGVjb3JhdGlvbnModGV4dFJhbmdlczogUmFuZ2VbXSwgY2VsbDogSUNlbGxWaWV3TW9kZWwpIHtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5jaGFuZ2VNb2RlbERlY29yYXRpb25zKGNoYW5nZUFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25zOiBJQ2VsbE1vZGVsRGVsdGFEZWNvcmF0aW9uc1tdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IHJhbmdlIG9mIHRleHRSYW5nZXMpIHtcblx0XHRcdFx0ZGVjb3JhdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0b3duZXJJZDogY2VsbC5oYW5kbGUsXG5cdFx0XHRcdFx0ZGVjb3JhdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRyYW5nZTogcmFuZ2UsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiAndGV4dCBzZWFyY2ggcmFuZ2UgZm9yIG5vdGVib29rIHNlYXJjaCBzY29wZScsXG5cdFx0XHRcdFx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRjbGFzc05hbWU6ICduYi1maW5kU2NvcGUnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRleHRTZWxlY3Rpb25EZWNvcmF0aW9uSWRzID0gY2hhbmdlQWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgZGVjb3JhdGlvbnMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclRleHRTZWxlY3Rpb25EZWNvcmF0aW9ucygpIHtcblx0XHR0aGlzLl9ub3RlYm9va0VkaXRvci5jaGFuZ2VNb2RlbERlY29yYXRpb25zKGNoYW5nZUFjY2Vzc29yID0+IHtcblx0XHRcdGNoYW5nZUFjY2Vzc29yLmRlbHRhRGVjb3JhdGlvbnModGhpcy50ZXh0U2VsZWN0aW9uRGVjb3JhdGlvbklkcywgW10pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF91cGRhdGVNYXRjaGVzQ291bnQoKTogdm9pZCB7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2RvbU5vZGUucmVtb3ZlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RG9tTm9kZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fZG9tTm9kZTtcblx0fVxuXG5cdHB1YmxpYyByZXZlYWwoaW5pdGlhbElucHV0Pzogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKGluaXRpYWxJbnB1dCkge1xuXHRcdFx0dGhpcy5fZmluZElucHV0LnNldFZhbHVlKGluaXRpYWxJbnB1dCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2lzVmlzaWJsZSkge1xuXHRcdFx0dGhpcy5fZmluZElucHV0LnNlbGVjdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2lzVmlzaWJsZSA9IHRydWU7XG5cdFx0dGhpcy51cGRhdGVCdXR0b25zKHRoaXMuZm91bmRNYXRjaCk7XG5cblx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScsICd2aXNpYmxlLXRyYW5zaXRpb24nKTtcblx0XHRcdHRoaXMuX2RvbU5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsICdmYWxzZScpO1xuXHRcdFx0dGhpcy5fZmluZElucHV0LnNlbGVjdCgpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0cHVibGljIGZvY3VzKCk6IHZvaWQge1xuXHRcdHRoaXMuX2ZpbmRJbnB1dC5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIHNob3coaW5pdGlhbElucHV0Pzogc3RyaW5nLCBvcHRpb25zPzogSVNob3dOb3RlYm9va0ZpbmRXaWRnZXRPcHRpb25zKTogdm9pZCB7XG5cdFx0aWYgKGluaXRpYWxJbnB1dCkge1xuXHRcdFx0dGhpcy5fZmluZElucHV0LnNldFZhbHVlKGluaXRpYWxJbnB1dCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNWaXNpYmxlID0gdHJ1ZTtcblxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJywgJ3Zpc2libGUtdHJhbnNpdGlvbicpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cblx0XHRcdGlmIChvcHRpb25zPy5mb2N1cyA/PyB0cnVlKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9LCAwKTtcblx0fVxuXG5cdHB1YmxpYyBzaG93V2l0aFJlcGxhY2UoaW5pdGlhbElucHV0Pzogc3RyaW5nLCByZXBsYWNlSW5wdXQ/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoaW5pdGlhbElucHV0KSB7XG5cdFx0XHR0aGlzLl9maW5kSW5wdXQuc2V0VmFsdWUoaW5pdGlhbElucHV0KTtcblx0XHR9XG5cblx0XHRpZiAocmVwbGFjZUlucHV0KSB7XG5cdFx0XHR0aGlzLl9yZXBsYWNlSW5wdXQuc2V0VmFsdWUocmVwbGFjZUlucHV0KTtcblx0XHR9XG5cblx0XHR0aGlzLl9pc1Zpc2libGUgPSB0cnVlO1xuXHRcdHRoaXMuX2lzUmVwbGFjZVZpc2libGUgPSB0cnVlO1xuXHRcdHRoaXMuX3N0YXRlLmNoYW5nZSh7IGlzUmVwbGFjZVJldmVhbGVkOiB0aGlzLl9pc1JlcGxhY2VWaXNpYmxlIH0sIGZhbHNlKTtcblx0XHR0aGlzLl91cGRhdGVSZXBsYWNlVmlld0Rpc3BsYXkoKTtcblxuXHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJywgJ3Zpc2libGUtdHJhbnNpdGlvbicpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cdFx0XHR0aGlzLl91cGRhdGVCdXR0b25zKCk7XG5cblx0XHRcdHRoaXMuX3JlcGxhY2VJbnB1dC5mb2N1cygpO1xuXHRcdH0sIDApO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUmVwbGFjZVZpZXdEaXNwbGF5KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc1JlcGxhY2VWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9pbm5lclJlcGxhY2VEb21Ob2RlLnN0eWxlLmRpc3BsYXkgPSAnZmxleCc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2lubmVyUmVwbGFjZURvbU5vZGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBsYWNlSW5wdXQud2lkdGggPSBkb20uZ2V0VG90YWxXaWR0aCh0aGlzLl9maW5kSW5wdXQuZG9tTm9kZSk7XG5cdH1cblxuXHRwdWJsaWMgaGlkZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNWaXNpYmxlKSB7XG5cdFx0XHR0aGlzLmluU2VsZWN0aW9uVG9nZ2xlLmNoZWNrZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmRlbHRhQ2VsbERlY29yYXRpb25zKHRoaXMuY2VsbFNlbGVjdGlvbkRlY29yYXRpb25JZHMsIFtdKTtcblx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yLmNoYW5nZU1vZGVsRGVjb3JhdGlvbnMoY2hhbmdlQWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRjaGFuZ2VBY2Nlc3Nvci5kZWx0YURlY29yYXRpb25zKHRoaXMudGV4dFNlbGVjdGlvbkRlY29yYXRpb25JZHMsIFtdKTtcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLl9kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ3Zpc2libGUtdHJhbnNpdGlvbicpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKTtcblx0XHRcdC8vIE5lZWQgdG8gZGVsYXkgdG9nZ2xpbmcgdmlzaWJpbGl0eSB1bnRpbCBhZnRlciBUcmFuc2l0aW9uLCB0aGVuIHZpc2liaWxpdHkgaGlkZGVuIC0gcmVtb3ZlcyBmcm9tIHRhYkluZGV4IGxpc3Rcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9pc1Zpc2libGUgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy51cGRhdGVCdXR0b25zKHRoaXMuZm91bmRNYXRjaCk7XG5cdFx0XHRcdHRoaXMuX2RvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuXHRcdFx0fSwgMjAwKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2RlbGF5ZWRVcGRhdGVIaXN0b3J5KCkge1xuXHRcdHRoaXMuX3VwZGF0ZUhpc3RvcnlEZWxheWVyLnRyaWdnZXIodGhpcy5fdXBkYXRlSGlzdG9yeS5iaW5kKHRoaXMpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfdXBkYXRlSGlzdG9yeSgpIHtcblx0XHR0aGlzLl9maW5kSW5wdXQuaW5wdXRCb3guYWRkVG9IaXN0b3J5KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFJlZ2V4VmFsdWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRJbnB1dC5nZXRSZWdleCgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRXaG9sZVdvcmRWYWx1ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZmluZElucHV0LmdldFdob2xlV29yZHMoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0Q2FzZVNlbnNpdGl2ZVZhbHVlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9maW5kSW5wdXQuZ2V0Q2FzZVNlbnNpdGl2ZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUJ1dHRvbnMoZm91bmRNYXRjaDogYm9vbGVhbikge1xuXHRcdGNvbnN0IGhhc0lucHV0ID0gdGhpcy5pbnB1dFZhbHVlLmxlbmd0aCA+IDA7XG5cdFx0dGhpcy5wcmV2QnRuLnNldEVuYWJsZWQodGhpcy5faXNWaXNpYmxlICYmIGhhc0lucHV0ICYmIGZvdW5kTWF0Y2gpO1xuXHRcdHRoaXMubmV4dEJ0bi5zZXRFbmFibGVkKHRoaXMuX2lzVmlzaWJsZSAmJiBoYXNJbnB1dCAmJiBmb3VuZE1hdGNoKTtcblx0fVxufVxuXG4vLyB0aGVtaW5nXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXHRjb2xsZWN0b3IuYWRkUnVsZShgXG5cdC5ub3RlYm9vay1lZGl0b3Ige1xuXHRcdC0tbm90ZWJvb2stZmluZC13aWR0aDogJHtOT1RFQk9PS19GSU5EX1dJREdFVF9JTklUSUFMX1dJRFRIfXB4O1xuXHRcdC0tbm90ZWJvb2stZmluZC1ob3Jpem9udGFsLXBhZGRpbmc6ICR7Tk9URUJPT0tfRklORF9XSURHRVRfSU5JVElBTF9IT1JJWk9OVEFMX1BB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
