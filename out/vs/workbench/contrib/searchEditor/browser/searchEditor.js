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
import * as DOM from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { Delayer } from "../../../../base/common/async.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import "./media/searchEditor.css";
import { Position } from "../../../../editor/common/core/position.js";
import { Range } from "../../../../editor/common/core/range.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { ReferencesController } from "../../../../editor/contrib/gotoSymbol/browser/peek/referencesController.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IEditorProgressService, LongRunningOperation } from "../../../../platform/progress/common/progress.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { inputBorder, registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { AbstractTextCodeEditor } from "../../../browser/parts/editor/textCodeEditor.js";
import { EditorInputCapabilities } from "../../../common/editor.js";
import { ExcludePatternInputWidget, IncludePatternInputWidget } from "../../search/browser/patternInputWidget.js";
import { SearchWidget } from "../../search/browser/searchWidget.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { getOutOfWorkspaceEditorResources } from "../../search/common/search.js";
import { SearchModelImpl } from "../../search/browser/searchTreeModel/searchModel.js";
import { InSearchEditor, SearchEditorID, SearchEditorInputTypeId } from "./constants.js";
import { serializeSearchResultForEditor } from "./searchEditorSerialization.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { SearchSortOrder } from "../../../services/search/common/search.js";
import { searchDetailsIcon } from "../../search/browser/searchIcons.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { renderSearchMessage } from "../../search/browser/searchMessage.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { UnusualLineTerminatorsDetector } from "../../../../editor/contrib/unusualLineTerminators/browser/unusualLineTerminators.js";
import { defaultToggleStyles, getInputBoxStyle } from "../../../../platform/theme/browser/defaultStyles.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { SearchContext } from "../../search/common/constants.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const RESULT_LINE_REGEX = /^(\s+)(\d+)(: |  )(\s*)(.*)$/;
const FILE_LINE_REGEX = /^(\S.*):$/;
let SearchEditor = class extends AbstractTextCodeEditor {
  constructor(group, telemetryService, themeService, storageService, modelService, contextService, labelService, instantiationService, contextViewService, commandService, openerService, notificationService, progressService, textResourceService, editorGroupService, editorService, configurationService, fileService, logService, hoverService) {
    super(SearchEditor.ID, group, telemetryService, instantiationService, storageService, textResourceService, themeService, editorService, editorGroupService, fileService);
    this.modelService = modelService;
    this.contextService = contextService;
    this.labelService = labelService;
    this.contextViewService = contextViewService;
    this.commandService = commandService;
    this.openerService = openerService;
    this.notificationService = notificationService;
    this.configurationService = configurationService;
    this.logService = logService;
    this.hoverService = hoverService;
    this.runSearchDelayer = new Delayer(0);
    this.pauseSearching = false;
    this.showingIncludesExcludes = false;
    this.ongoingOperations = 0;
    this.updatingModelForSearch = false;
    this.container = DOM.$(".search-editor");
    this.searchOperation = this._register(new LongRunningOperation(progressService));
    this._register(this.messageDisposables = new DisposableStore());
    this.searchHistoryDelayer = new Delayer(2e3);
    this.searchModel = this._register(this.instantiationService.createInstance(SearchModelImpl));
  }
  get searchResultEditor() {
    return this.editorControl;
  }
  createEditor(parent) {
    DOM.append(parent, this.container);
    this.queryEditorContainer = DOM.append(this.container, DOM.$(".query-container"));
    const searchResultContainer = DOM.append(this.container, DOM.$(".search-results"));
    super.createEditor(searchResultContainer);
    this.registerEditorListeners();
    const scopedContextKeyService = assertIsDefined(this.scopedContextKeyService);
    InSearchEditor.bindTo(scopedContextKeyService).set(true);
    this.createQueryEditor(
      this.queryEditorContainer,
      this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService]))),
      SearchContext.InputBoxFocusedKey.bindTo(scopedContextKeyService)
    );
  }
  createQueryEditor(container, scopedInstantiationService, inputBoxFocusedContextKey) {
    const searchEditorInputboxStyles = getInputBoxStyle({ inputBorder: searchEditorTextInputBorder });
    this.queryEditorWidget = this._register(scopedInstantiationService.createInstance(SearchWidget, container, { _hideReplaceToggle: true, showContextToggle: true, inputBoxStyles: searchEditorInputboxStyles, toggleStyles: defaultToggleStyles }));
    this._register(this.queryEditorWidget.onReplaceToggled(() => this.reLayout()));
    this._register(this.queryEditorWidget.onDidHeightChange(() => this.reLayout()));
    this._register(this.queryEditorWidget.onSearchSubmit(({ delay }) => this.triggerSearch({ delay })));
    if (this.queryEditorWidget.searchInput) {
      this._register(this.queryEditorWidget.searchInput.onDidOptionChange(() => this.triggerSearch({ resetCursor: false })));
    } else {
      this.logService.warn("SearchEditor: SearchWidget.searchInput is undefined, cannot register onDidOptionChange listener");
    }
    this._register(this.queryEditorWidget.onDidToggleContext(() => this.triggerSearch({ resetCursor: false })));
    this.includesExcludesContainer = DOM.append(container, DOM.$(".includes-excludes"));
    const toggleQueryDetailsLabel = localize("moreSearch", "Toggle Search Details");
    this.toggleQueryDetailsButton = DOM.append(this.includesExcludesContainer, DOM.$(".expand" + ThemeIcon.asCSSSelector(searchDetailsIcon), { tabindex: 0, role: "button", "aria-label": toggleQueryDetailsLabel }));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.toggleQueryDetailsButton, toggleQueryDetailsLabel));
    this._register(DOM.addDisposableListener(this.toggleQueryDetailsButton, DOM.EventType.CLICK, (e) => {
      DOM.EventHelper.stop(e);
      this.toggleIncludesExcludes();
    }));
    this._register(DOM.addDisposableListener(this.toggleQueryDetailsButton, DOM.EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        DOM.EventHelper.stop(e);
        this.toggleIncludesExcludes();
      }
    }));
    this._register(DOM.addDisposableListener(this.toggleQueryDetailsButton, DOM.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
        if (this.queryEditorWidget.isReplaceActive()) {
          this.queryEditorWidget.focusReplaceAllAction();
        } else {
          this.queryEditorWidget.isReplaceShown() ? this.queryEditorWidget.replaceInput?.focusOnPreserve() : this.queryEditorWidget.focusRegexAction();
        }
        DOM.EventHelper.stop(e);
      }
    }));
    const folderIncludesList = DOM.append(this.includesExcludesContainer, DOM.$(".file-types.includes"));
    const filesToIncludeTitle = localize("searchScope.includes", "files to include");
    DOM.append(folderIncludesList, DOM.$("h4", void 0, filesToIncludeTitle));
    this.inputPatternIncludes = this._register(scopedInstantiationService.createInstance(IncludePatternInputWidget, folderIncludesList, this.contextViewService, {
      ariaLabel: localize("label.includes", "Search Include Patterns"),
      inputBoxStyles: searchEditorInputboxStyles
    }));
    this._register(this.inputPatternIncludes.onSubmit((triggeredOnType) => this.triggerSearch({ resetCursor: false, delay: triggeredOnType ? this.searchConfig.searchOnTypeDebouncePeriod : 0 })));
    this._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));
    const excludesList = DOM.append(this.includesExcludesContainer, DOM.$(".file-types.excludes"));
    const excludesTitle = localize("searchScope.excludes", "files to exclude");
    DOM.append(excludesList, DOM.$("h4", void 0, excludesTitle));
    this.inputPatternExcludes = this._register(scopedInstantiationService.createInstance(ExcludePatternInputWidget, excludesList, this.contextViewService, {
      ariaLabel: localize("label.excludes", "Search Exclude Patterns"),
      inputBoxStyles: searchEditorInputboxStyles
    }));
    this._register(this.inputPatternExcludes.onSubmit((triggeredOnType) => this.triggerSearch({ resetCursor: false, delay: triggeredOnType ? this.searchConfig.searchOnTypeDebouncePeriod : 0 })));
    this._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));
    this.messageBox = DOM.append(container, DOM.$(".messages.text-search-provider-messages"));
    [this.queryEditorWidget.searchInputFocusTracker, this.queryEditorWidget.replaceInputFocusTracker, this.inputPatternExcludes.inputFocusTracker, this.inputPatternIncludes.inputFocusTracker].forEach((tracker) => {
      if (!tracker) {
        return;
      }
      this._register(tracker.onDidFocus(() => setTimeout(() => inputBoxFocusedContextKey.set(true), 0)));
      this._register(tracker.onDidBlur(() => inputBoxFocusedContextKey.set(false)));
    });
  }
  toggleRunAgainMessage(show) {
    DOM.clearNode(this.messageBox);
    this.messageDisposables.clear();
    if (show) {
      const runAgainLink = DOM.append(this.messageBox, DOM.$("a.pointer.prominent.message", {}, localize("runSearch", "Run Search")));
      this.messageDisposables.add(DOM.addDisposableListener(runAgainLink, DOM.EventType.CLICK, async () => {
        await this.triggerSearch();
        this.searchResultEditor.focus();
      }));
    }
  }
  _getContributions() {
    const skipContributions = [UnusualLineTerminatorsDetector.ID];
    return EditorExtensionsRegistry.getEditorContributions().filter((c) => skipContributions.indexOf(c.id) === -1);
  }
  getCodeEditorWidgetOptions() {
    return { contributions: this._getContributions() };
  }
  registerEditorListeners() {
    this._register(this.searchResultEditor.onMouseUp((e) => {
      if (e.event.detail === 1) {
        const behaviour = this.searchConfig.searchEditor.singleClickBehaviour;
        const position = e.target.position;
        if (position && behaviour === "peekDefinition") {
          const line = this.searchResultEditor.getModel()?.getLineContent(position.lineNumber) ?? "";
          if (line.match(FILE_LINE_REGEX) || line.match(RESULT_LINE_REGEX)) {
            this.searchResultEditor.setSelection(Range.fromPositions(position));
            this.commandService.executeCommand("editor.action.peekDefinition");
          }
        }
      } else if (e.event.detail === 2) {
        const behaviour = this.searchConfig.searchEditor.doubleClickBehaviour;
        const position = e.target.position;
        if (position && behaviour !== "selectWord") {
          const line = this.searchResultEditor.getModel()?.getLineContent(position.lineNumber) ?? "";
          if (line.match(RESULT_LINE_REGEX)) {
            this.searchResultEditor.setSelection(Range.fromPositions(position));
            this.commandService.executeCommand(behaviour === "goToLocation" ? "editor.action.goToDeclaration" : "editor.action.openDeclarationToTheSide");
          } else if (line.match(FILE_LINE_REGEX)) {
            this.searchResultEditor.setSelection(Range.fromPositions(position));
            this.commandService.executeCommand("editor.action.peekDefinition");
          }
        }
      }
    }));
    this._register(this.searchResultEditor.onDidChangeModelContent(() => {
      if (!this.updatingModelForSearch) {
        this.getInput()?.setDirty(true);
      }
    }));
  }
  getControl() {
    return this.searchResultEditor;
  }
  focus() {
    super.focus();
    const viewState = this.loadEditorViewState(this.getInput());
    if (viewState && viewState.focused === "editor") {
      this.searchResultEditor.focus();
    } else {
      this.queryEditorWidget.focus();
    }
  }
  focusSearchInput() {
    this.queryEditorWidget.searchInput?.focus();
  }
  focusFilesToIncludeInput() {
    if (!this.showingIncludesExcludes) {
      this.toggleIncludesExcludes(true);
    }
    this.inputPatternIncludes.focus();
  }
  focusFilesToExcludeInput() {
    if (!this.showingIncludesExcludes) {
      this.toggleIncludesExcludes(true);
    }
    this.inputPatternExcludes.focus();
  }
  focusNextInput() {
    if (this.queryEditorWidget.searchInputHasFocus()) {
      if (this.showingIncludesExcludes) {
        this.inputPatternIncludes.focus();
      } else {
        this.searchResultEditor.focus();
      }
    } else if (this.inputPatternIncludes.inputHasFocus()) {
      this.inputPatternExcludes.focus();
    } else if (this.inputPatternExcludes.inputHasFocus()) {
      this.searchResultEditor.focus();
    } else if (this.searchResultEditor.hasWidgetFocus()) {
    }
  }
  focusPrevInput() {
    if (this.queryEditorWidget.searchInputHasFocus()) {
      this.searchResultEditor.focus();
    } else if (this.inputPatternIncludes.inputHasFocus()) {
      this.queryEditorWidget.searchInput?.focus();
    } else if (this.inputPatternExcludes.inputHasFocus()) {
      this.inputPatternIncludes.focus();
    } else if (this.searchResultEditor.hasWidgetFocus()) {
    }
  }
  setQuery(query) {
    this.queryEditorWidget.searchInput?.setValue(query);
  }
  selectQuery() {
    this.queryEditorWidget.searchInput?.select();
  }
  toggleWholeWords() {
    this.queryEditorWidget.searchInput?.setWholeWords(!this.queryEditorWidget.searchInput.getWholeWords());
    this.triggerSearch({ resetCursor: false });
  }
  toggleRegex() {
    this.queryEditorWidget.searchInput?.setRegex(!this.queryEditorWidget.searchInput.getRegex());
    this.triggerSearch({ resetCursor: false });
  }
  toggleCaseSensitive() {
    this.queryEditorWidget.searchInput?.setCaseSensitive(!this.queryEditorWidget.searchInput.getCaseSensitive());
    this.triggerSearch({ resetCursor: false });
  }
  toggleContextLines() {
    this.queryEditorWidget.toggleContextLines();
  }
  modifyContextLines(increase) {
    this.queryEditorWidget.modifyContextLines(increase);
  }
  toggleQueryDetails(shouldShow) {
    this.toggleIncludesExcludes(shouldShow);
  }
  deleteResultBlock() {
    const linesToDelete = /* @__PURE__ */ new Set();
    const selections = this.searchResultEditor.getSelections();
    const model = this.searchResultEditor.getModel();
    if (!(selections && model)) {
      return;
    }
    const maxLine = model.getLineCount();
    const minLine = 1;
    const deleteUp = (start) => {
      for (let cursor = start; cursor >= minLine; cursor--) {
        const line = model.getLineContent(cursor);
        linesToDelete.add(cursor);
        if (line[0] !== void 0 && line[0] !== " ") {
          break;
        }
      }
    };
    const deleteDown = (start) => {
      linesToDelete.add(start);
      for (let cursor = start + 1; cursor <= maxLine; cursor++) {
        const line = model.getLineContent(cursor);
        if (line[0] !== void 0 && line[0] !== " ") {
          return cursor;
        }
        linesToDelete.add(cursor);
      }
      return;
    };
    const endingCursorLines = [];
    for (const selection of selections) {
      const lineNumber = selection.startLineNumber;
      endingCursorLines.push(deleteDown(lineNumber));
      deleteUp(lineNumber);
      for (let inner = selection.startLineNumber; inner <= selection.endLineNumber; inner++) {
        linesToDelete.add(inner);
      }
    }
    if (endingCursorLines.length === 0) {
      endingCursorLines.push(1);
    }
    const isDefined = (x) => x !== void 0;
    model.pushEditOperations(
      this.searchResultEditor.getSelections(),
      [...linesToDelete].map((line) => ({ range: new Range(line, 1, line + 1, 1), text: "" })),
      () => endingCursorLines.filter(isDefined).map((line) => new Selection(line, 1, line, 1))
    );
  }
  cleanState() {
    this.getInput()?.setDirty(false);
  }
  get searchConfig() {
    return this.configurationService.getValue("search");
  }
  iterateThroughMatches(reverse) {
    const model = this.searchResultEditor.getModel();
    if (!model) {
      return;
    }
    const lastLine = model.getLineCount() ?? 1;
    const lastColumn = model.getLineLength(lastLine);
    const fallbackStart = reverse ? new Position(lastLine, lastColumn) : new Position(1, 1);
    const currentPosition = this.searchResultEditor.getSelection()?.getStartPosition() ?? fallbackStart;
    const matchRanges = this.getInput()?.getMatchRanges();
    if (!matchRanges) {
      return;
    }
    const matchRange = (reverse ? findPrevRange : findNextRange)(matchRanges, currentPosition);
    if (!matchRange) {
      return;
    }
    this.searchResultEditor.setSelection(matchRange);
    this.searchResultEditor.revealLineInCenterIfOutsideViewport(matchRange.startLineNumber);
    this.searchResultEditor.focus();
    const matchLineText = model.getLineContent(matchRange.startLineNumber);
    const matchText = model.getValueInRange(matchRange);
    let file = "";
    for (let line = matchRange.startLineNumber; line >= 1; line--) {
      const lineText = model.getValueInRange(new Range(line, 1, line, 2));
      if (lineText !== " ") {
        file = model.getLineContent(line);
        break;
      }
    }
    alert(localize("searchResultItem", "Matched {0} at {1} in file {2}", matchText, matchLineText, file.slice(0, file.length - 1)));
  }
  focusNextResult() {
    this.iterateThroughMatches(false);
  }
  focusPreviousResult() {
    this.iterateThroughMatches(true);
  }
  focusAllResults() {
    this.searchResultEditor.setSelections((this.getInput()?.getMatchRanges() ?? []).map(
      (range) => new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)
    ));
    this.searchResultEditor.focus();
  }
  async triggerSearch(_options) {
    const focusResults = this.searchConfig.searchEditor.focusResultsOnSearch;
    if (_options === void 0) {
      _options = { focusResults };
    } else if (_options.focusResults === void 0) {
      _options.focusResults = focusResults;
    }
    const options = { resetCursor: true, delay: 0, ..._options };
    if (!this.queryEditorWidget.searchInput?.inputBox.isInputValid()) {
      return;
    }
    if (!this.pauseSearching) {
      await this.runSearchDelayer.trigger(async () => {
        this.toggleRunAgainMessage(false);
        await this.doRunSearch();
        if (options.resetCursor) {
          this.searchResultEditor.setPosition(new Position(1, 1));
          this.searchResultEditor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
        }
        if (options.focusResults) {
          this.searchResultEditor.focus();
        }
      }, options.delay);
    }
  }
  readConfigFromWidget() {
    return {
      isCaseSensitive: this.queryEditorWidget.searchInput?.getCaseSensitive() ?? false,
      contextLines: this.queryEditorWidget.getContextLines(),
      filesToExclude: this.inputPatternExcludes.getValue(),
      filesToInclude: this.inputPatternIncludes.getValue(),
      query: this.queryEditorWidget.searchInput?.getValue() ?? "",
      isRegexp: this.queryEditorWidget.searchInput?.getRegex() ?? false,
      matchWholeWord: this.queryEditorWidget.searchInput?.getWholeWords() ?? false,
      useExcludeSettingsAndIgnoreFiles: this.inputPatternExcludes.useExcludesAndIgnoreFiles(),
      onlyOpenEditors: this.inputPatternIncludes.onlySearchInOpenEditors(),
      showIncludesExcludes: this.showingIncludesExcludes,
      notebookSearchConfig: {
        includeMarkupInput: this.queryEditorWidget.getNotebookFilters().markupInput,
        includeMarkupPreview: this.queryEditorWidget.getNotebookFilters().markupPreview,
        includeCodeInput: this.queryEditorWidget.getNotebookFilters().codeInput,
        includeOutput: this.queryEditorWidget.getNotebookFilters().codeOutput
      }
    };
  }
  async doRunSearch() {
    this.searchModel.cancelSearch(true);
    const startInput = this.getInput();
    if (!startInput) {
      return;
    }
    this.searchHistoryDelayer.trigger(() => {
      this.queryEditorWidget.searchInput?.onSearchSubmit();
      this.inputPatternExcludes.onSearchSubmit();
      this.inputPatternIncludes.onSearchSubmit();
    });
    const config = this.readConfigFromWidget();
    if (!config.query) {
      return;
    }
    const content = {
      pattern: config.query,
      isRegExp: config.isRegexp,
      isCaseSensitive: config.isCaseSensitive,
      isWordMatch: config.matchWholeWord
    };
    const options = {
      _reason: "searchEditor",
      extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
      maxResults: this.searchConfig.maxResults ?? void 0,
      disregardIgnoreFiles: !config.useExcludeSettingsAndIgnoreFiles || void 0,
      disregardExcludeSettings: !config.useExcludeSettingsAndIgnoreFiles || void 0,
      excludePattern: [{ pattern: config.filesToExclude }],
      includePattern: config.filesToInclude,
      onlyOpenEditors: config.onlyOpenEditors,
      previewOptions: {
        matchLines: 1,
        charsPerLine: 1e3
      },
      surroundingContext: config.contextLines,
      isSmartCase: this.searchConfig.smartCase,
      expandPatterns: true,
      notebookSearchConfig: {
        includeMarkupInput: config.notebookSearchConfig.includeMarkupInput,
        includeMarkupPreview: config.notebookSearchConfig.includeMarkupPreview,
        includeCodeInput: config.notebookSearchConfig.includeCodeInput,
        includeOutput: config.notebookSearchConfig.includeOutput
      }
    };
    const folderResources = this.contextService.getWorkspace().folders;
    let query;
    try {
      const queryBuilder = this.instantiationService.createInstance(QueryBuilder);
      query = queryBuilder.text(content, folderResources.map((folder) => folder.uri), options);
    } catch (err) {
      return;
    }
    this.searchOperation.start(500);
    this.ongoingOperations++;
    const { configurationModel } = await startInput.resolveModels();
    configurationModel.updateConfig(config);
    const result = this.searchModel.search(query);
    startInput.ongoingSearchOperation = result.asyncResults.finally(() => {
      this.ongoingOperations--;
      if (this.ongoingOperations === 0) {
        this.searchOperation.stop();
      }
    });
    const searchOperation = await startInput.ongoingSearchOperation;
    await this.onSearchComplete(searchOperation, config, startInput);
  }
  async onSearchComplete(searchOperation, startConfig, startInput) {
    const input = this.getInput();
    if (!input || input !== startInput || JSON.stringify(startConfig) !== JSON.stringify(this.readConfigFromWidget())) {
      return;
    }
    input.ongoingSearchOperation = void 0;
    const sortOrder = this.searchConfig.sortOrder;
    if (sortOrder === SearchSortOrder.Modified) {
      await this.retrieveFileStats(this.searchModel.searchResult);
    }
    const controller = ReferencesController.get(this.searchResultEditor);
    controller?.closeWidget(false);
    const labelFormatter = (uri) => this.labelService.getUriLabel(uri, { relative: true });
    const results = serializeSearchResultForEditor(this.searchModel.searchResult, startConfig.filesToInclude, startConfig.filesToExclude, startConfig.contextLines, labelFormatter, sortOrder, searchOperation?.limitHit);
    const { resultsModel } = await input.resolveModels();
    this.updatingModelForSearch = true;
    this.modelService.updateModel(resultsModel, results.text);
    this.updatingModelForSearch = false;
    if (searchOperation && searchOperation.messages) {
      for (const message of searchOperation.messages) {
        this.addMessage(message);
      }
    }
    this.reLayout();
    input.setDirty(!input.hasCapability(EditorInputCapabilities.Untitled));
    input.setMatchRanges(results.matchRanges);
  }
  addMessage(message) {
    let messageBox;
    if (this.messageBox.firstChild) {
      messageBox = this.messageBox.firstChild;
    } else {
      messageBox = DOM.append(this.messageBox, DOM.$(".message"));
    }
    DOM.append(messageBox, renderSearchMessage(message, this.instantiationService, this.notificationService, this.openerService, this.commandService, this.messageDisposables, () => this.triggerSearch()));
  }
  async retrieveFileStats(searchResult) {
    const files = searchResult.matches().filter((f) => !f.fileStat).map((f) => f.resolveFileStat(this.fileService));
    await Promise.all(files);
  }
  layout(dimension) {
    this.dimension = dimension;
    this.reLayout();
  }
  getSelected() {
    const selection = this.searchResultEditor.getSelection();
    if (selection) {
      return this.searchResultEditor.getModel()?.getValueInRange(selection) ?? "";
    }
    return "";
  }
  reLayout() {
    if (this.dimension) {
      this.queryEditorWidget.setWidth(
        this.dimension.width - 28
        /* container margin */
      );
      this.searchResultEditor.layout({ height: this.dimension.height - DOM.getTotalHeight(this.queryEditorContainer), width: this.dimension.width });
      this.inputPatternExcludes.setWidth(
        this.dimension.width - 28
        /* container margin */
      );
      this.inputPatternIncludes.setWidth(
        this.dimension.width - 28
        /* container margin */
      );
    }
  }
  getInput() {
    return this.input;
  }
  setSearchConfig(config) {
    this.priorConfig = config;
    if (config.query !== void 0) {
      this.queryEditorWidget.setValue(config.query);
    }
    if (config.isCaseSensitive !== void 0) {
      this.queryEditorWidget.searchInput?.setCaseSensitive(config.isCaseSensitive);
    }
    if (config.isRegexp !== void 0) {
      this.queryEditorWidget.searchInput?.setRegex(config.isRegexp);
    }
    if (config.matchWholeWord !== void 0) {
      this.queryEditorWidget.searchInput?.setWholeWords(config.matchWholeWord);
    }
    if (config.contextLines !== void 0) {
      this.queryEditorWidget.setContextLines(config.contextLines);
    }
    if (config.filesToExclude !== void 0) {
      this.inputPatternExcludes.setValue(config.filesToExclude);
    }
    if (config.filesToInclude !== void 0) {
      this.inputPatternIncludes.setValue(config.filesToInclude);
    }
    if (config.onlyOpenEditors !== void 0) {
      this.inputPatternIncludes.setOnlySearchInOpenEditors(config.onlyOpenEditors);
    }
    if (config.useExcludeSettingsAndIgnoreFiles !== void 0) {
      this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(config.useExcludeSettingsAndIgnoreFiles);
    }
    if (config.showIncludesExcludes !== void 0) {
      this.toggleIncludesExcludes(config.showIncludesExcludes);
    }
  }
  async setInput(newInput, options, context, token) {
    await super.setInput(newInput, options, context, token);
    if (token.isCancellationRequested) {
      return;
    }
    const { configurationModel, resultsModel } = await newInput.resolveModels();
    if (token.isCancellationRequested) {
      return;
    }
    this.searchResultEditor.setModel(resultsModel);
    this.pauseSearching = true;
    this.toggleRunAgainMessage(!newInput.ongoingSearchOperation && resultsModel.getLineCount() === 1 && resultsModel.getValueLength() === 0 && configurationModel.config.query !== "");
    this.setSearchConfig(configurationModel.config);
    this._register(configurationModel.onConfigDidUpdate((newConfig) => {
      if (newConfig !== this.priorConfig) {
        this.pauseSearching = true;
        this.setSearchConfig(newConfig);
        this.pauseSearching = false;
      }
    }));
    this.restoreViewState(context);
    if (!options?.preserveFocus) {
      this.focus();
    }
    this.pauseSearching = false;
    if (newInput.ongoingSearchOperation) {
      const existingConfig = this.readConfigFromWidget();
      newInput.ongoingSearchOperation.then((complete) => {
        this.onSearchComplete(complete, existingConfig, newInput);
      });
    }
  }
  toggleIncludesExcludes(_shouldShow) {
    const cls = "expanded";
    const shouldShow = _shouldShow ?? !this.includesExcludesContainer.classList.contains(cls);
    if (shouldShow) {
      this.toggleQueryDetailsButton.setAttribute("aria-expanded", "true");
      this.includesExcludesContainer.classList.add(cls);
    } else {
      this.toggleQueryDetailsButton.setAttribute("aria-expanded", "false");
      this.includesExcludesContainer.classList.remove(cls);
    }
    this.showingIncludesExcludes = this.includesExcludesContainer.classList.contains(cls);
    this.reLayout();
  }
  toEditorViewStateResource(input) {
    if (input.typeId === SearchEditorInputTypeId) {
      return input.modelUri;
    }
    return void 0;
  }
  computeEditorViewState(resource) {
    const control = this.getControl();
    const editorViewState = control.saveViewState();
    if (!editorViewState) {
      return void 0;
    }
    if (resource.toString() !== this.getInput()?.modelUri.toString()) {
      return void 0;
    }
    return { ...editorViewState, focused: this.searchResultEditor.hasWidgetFocus() ? "editor" : "input" };
  }
  tracksEditorViewState(input) {
    return input.typeId === SearchEditorInputTypeId;
  }
  restoreViewState(context) {
    const viewState = this.loadEditorViewState(this.getInput(), context);
    if (viewState) {
      this.searchResultEditor.restoreViewState(viewState);
    }
  }
  getAriaLabel() {
    return this.getInput()?.getName() ?? localize("searchEditor", "Search");
  }
};
SearchEditor.ID = SearchEditorID;
SearchEditor.SEARCH_EDITOR_VIEW_STATE_PREFERENCE_KEY = "searchEditorViewState";
SearchEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IContextViewService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IEditorProgressService),
  __decorateParam(13, ITextResourceConfigurationService),
  __decorateParam(14, IEditorGroupsService),
  __decorateParam(15, IEditorService),
  __decorateParam(16, IConfigurationService),
  __decorateParam(17, IFileService),
  __decorateParam(18, ILogService),
  __decorateParam(19, IHoverService)
], SearchEditor);
const searchEditorTextInputBorder = registerColor("searchEditor.textInputBorder", inputBorder, localize("textInputBoxBorder", "Search editor text input box border."));
function findNextRange(matchRanges, currentPosition) {
  for (const matchRange of matchRanges) {
    if (Position.isBefore(currentPosition, matchRange.getStartPosition())) {
      return matchRange;
    }
  }
  return matchRanges[0];
}
function findPrevRange(matchRanges, currentPosition) {
  for (let i = matchRanges.length - 1; i >= 0; i--) {
    const matchRange = matchRanges[i];
    if (Position.isBefore(matchRange.getStartPosition(), currentPosition)) {
      {
        return matchRange;
      }
    }
  }
  return matchRanges[matchRanges.length - 1];
}
export {
  SearchEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBhbGVydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICcuL21lZGlhL3NlYXJjaEVkaXRvci5jc3MnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JXaWRnZXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvY29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yVmlld1N0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFJlZmVyZW5jZXNDb250cm9sbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZ290b1N5bWJvbC9icm93c2VyL3BlZWsvcmVmZXJlbmNlc0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUVkaXRvclByb2dyZXNzU2VydmljZSwgTG9uZ1J1bm5pbmdPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IGlucHV0Qm9yZGVyLCByZWdpc3RlckNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEFic3RyYWN0VGV4dENvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci90ZXh0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgSUVkaXRvck9wZW5Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRXhjbHVkZVBhdHRlcm5JbnB1dFdpZGdldCwgSW5jbHVkZVBhdHRlcm5JbnB1dFdpZGdldCB9IGZyb20gJy4uLy4uL3NlYXJjaC9icm93c2VyL3BhdHRlcm5JbnB1dFdpZGdldC5qcyc7XG5pbXBvcnQgeyBTZWFyY2hXaWRnZXQgfSBmcm9tICcuLi8uLi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zLCBRdWVyeUJ1aWxkZXIgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3F1ZXJ5QnVpbGRlci5qcyc7XG5pbXBvcnQgeyBnZXRPdXRPZldvcmtzcGFjZUVkaXRvclJlc291cmNlcyB9IGZyb20gJy4uLy4uL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IFNlYXJjaE1vZGVsSW1wbCB9IGZyb20gJy4uLy4uL3NlYXJjaC9icm93c2VyL3NlYXJjaFRyZWVNb2RlbC9zZWFyY2hNb2RlbC5qcyc7XG5pbXBvcnQgeyBJblNlYXJjaEVkaXRvciwgU2VhcmNoRWRpdG9ySUQsIFNlYXJjaEVkaXRvcklucHV0VHlwZUlkLCBTZWFyY2hDb25maWd1cmF0aW9uIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHR5cGUgeyBTZWFyY2hFZGl0b3JJbnB1dCB9IGZyb20gJy4vc2VhcmNoRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgc2VyaWFsaXplU2VhcmNoUmVzdWx0Rm9yRWRpdG9yIH0gZnJvbSAnLi9zZWFyY2hFZGl0b3JTZXJpYWxpemF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cCwgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVBhdHRlcm5JbmZvLCBJU2VhcmNoQ29tcGxldGUsIElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcywgSVRleHRRdWVyeSwgU2VhcmNoU29ydE9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgc2VhcmNoRGV0YWlsc0ljb24gfSBmcm9tICcuLi8uLi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hJY29ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBUZXh0U2VhcmNoQ29tcGxldGVNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2hFeHRUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgcmVuZGVyU2VhcmNoTWVzc2FnZSB9IGZyb20gJy4uLy4uL3NlYXJjaC9icm93c2VyL3NlYXJjaE1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LCBJRWRpdG9yQ29udHJpYnV0aW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFVudXN1YWxMaW5lVGVybWluYXRvcnNEZXRlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3VudXN1YWxMaW5lVGVybWluYXRvcnMvYnJvd3Nlci91bnVzdWFsTGluZVRlcm1pbmF0b3JzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRUb2dnbGVTdHlsZXMsIGdldElucHV0Qm94U3R5bGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VhcmNoL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSVNlYXJjaFJlc3VsdCB9IGZyb20gJy4uLy4uL3NlYXJjaC9icm93c2VyL3NlYXJjaFRyZWVNb2RlbC9zZWFyY2hUcmVlQ29tbW9uLmpzJztcblxuY29uc3QgUkVTVUxUX0xJTkVfUkVHRVggPSAvXihcXHMrKShcXGQrKSg6IHwgICkoXFxzKikoLiopJC87XG5jb25zdCBGSUxFX0xJTkVfUkVHRVggPSAvXihcXFMuKik6JC87XG5cbnR5cGUgU2VhcmNoRWRpdG9yVmlld1N0YXRlID0gSUNvZGVFZGl0b3JWaWV3U3RhdGUgJiB7IGZvY3VzZWQ6ICdpbnB1dCcgfCAnZWRpdG9yJyB9O1xuXG5leHBvcnQgY2xhc3MgU2VhcmNoRWRpdG9yIGV4dGVuZHMgQWJzdHJhY3RUZXh0Q29kZUVkaXRvcjxTZWFyY2hFZGl0b3JWaWV3U3RhdGU+IHtcblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSBTZWFyY2hFZGl0b3JJRDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgU0VBUkNIX0VESVRPUl9WSUVXX1NUQVRFX1BSRUZFUkVOQ0VfS0VZID0gJ3NlYXJjaEVkaXRvclZpZXdTdGF0ZSc7XG5cblx0cHJpdmF0ZSBxdWVyeUVkaXRvcldpZGdldCE6IFNlYXJjaFdpZGdldDtcblx0cHJpdmF0ZSBnZXQgc2VhcmNoUmVzdWx0RWRpdG9yKCkgeyByZXR1cm4gdGhpcy5lZGl0b3JDb250cm9sITsgfVxuXHRwcml2YXRlIHF1ZXJ5RWRpdG9yQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgZGltZW5zaW9uPzogRE9NLkRpbWVuc2lvbjtcblx0cHJpdmF0ZSBpbnB1dFBhdHRlcm5JbmNsdWRlcyE6IEluY2x1ZGVQYXR0ZXJuSW5wdXRXaWRnZXQ7XG5cdHByaXZhdGUgaW5wdXRQYXR0ZXJuRXhjbHVkZXMhOiBFeGNsdWRlUGF0dGVybklucHV0V2lkZ2V0O1xuXHRwcml2YXRlIGluY2x1ZGVzRXhjbHVkZXNDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB0b2dnbGVRdWVyeURldGFpbHNCdXR0b24hOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBtZXNzYWdlQm94ITogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBydW5TZWFyY2hEZWxheWVyID0gbmV3IERlbGF5ZXIoMCk7XG5cdHByaXZhdGUgcGF1c2VTZWFyY2hpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBzaG93aW5nSW5jbHVkZXNFeGNsdWRlczogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHNlYXJjaE9wZXJhdGlvbjogTG9uZ1J1bm5pbmdPcGVyYXRpb247XG5cdHByaXZhdGUgc2VhcmNoSGlzdG9yeURlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgbWVzc2FnZURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBzZWFyY2hNb2RlbDogU2VhcmNoTW9kZWxJbXBsO1xuXHRwcml2YXRlIG9uZ29pbmdPcGVyYXRpb25zOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIHVwZGF0aW5nTW9kZWxGb3JTZWFyY2g6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclByb2dyZXNzU2VydmljZSBwcm9ncmVzc1NlcnZpY2U6IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB0ZXh0UmVzb3VyY2VTZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKFNlYXJjaEVkaXRvci5JRCwgZ3JvdXAsIHRlbGVtZXRyeVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBzdG9yYWdlU2VydmljZSwgdGV4dFJlc291cmNlU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBlZGl0b3JHcm91cFNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblx0XHR0aGlzLmNvbnRhaW5lciA9IERPTS4kKCcuc2VhcmNoLWVkaXRvcicpO1xuXG5cdFx0dGhpcy5zZWFyY2hPcGVyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgTG9uZ1J1bm5pbmdPcGVyYXRpb24ocHJvZ3Jlc3NTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tZXNzYWdlRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdFx0dGhpcy5zZWFyY2hIaXN0b3J5RGVsYXllciA9IG5ldyBEZWxheWVyPHZvaWQ+KDIwMDApO1xuXG5cdFx0dGhpcy5zZWFyY2hNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoTW9kZWxJbXBsKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgY3JlYXRlRWRpdG9yKHBhcmVudDogSFRNTEVsZW1lbnQpIHtcblx0XHRET00uYXBwZW5kKHBhcmVudCwgdGhpcy5jb250YWluZXIpO1xuXHRcdHRoaXMucXVlcnlFZGl0b3JDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuY29udGFpbmVyLCBET00uJCgnLnF1ZXJ5LWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBzZWFyY2hSZXN1bHRDb250YWluZXIgPSBET00uYXBwZW5kKHRoaXMuY29udGFpbmVyLCBET00uJCgnLnNlYXJjaC1yZXN1bHRzJykpO1xuXHRcdHN1cGVyLmNyZWF0ZUVkaXRvcihzZWFyY2hSZXN1bHRDb250YWluZXIpO1xuXHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JMaXN0ZW5lcnMoKTtcblxuXHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gYXNzZXJ0SXNEZWZpbmVkKHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdEluU2VhcmNoRWRpdG9yLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpO1xuXG5cdFx0dGhpcy5jcmVhdGVRdWVyeUVkaXRvcihcblx0XHRcdHRoaXMucXVlcnlFZGl0b3JDb250YWluZXIsXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCBzY29wZWRDb250ZXh0S2V5U2VydmljZV0pKSksXG5cdFx0XHRTZWFyY2hDb250ZXh0LklucHV0Qm94Rm9jdXNlZEtleS5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpXG5cdFx0KTtcblx0fVxuXG5cblx0cHJpdmF0ZSBjcmVhdGVRdWVyeUVkaXRvcihjb250YWluZXI6IEhUTUxFbGVtZW50LCBzY29wZWRJbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBpbnB1dEJveEZvY3VzZWRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPikge1xuXHRcdGNvbnN0IHNlYXJjaEVkaXRvcklucHV0Ym94U3R5bGVzID0gZ2V0SW5wdXRCb3hTdHlsZSh7IGlucHV0Qm9yZGVyOiBzZWFyY2hFZGl0b3JUZXh0SW5wdXRCb3JkZXIgfSk7XG5cblx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIoc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoV2lkZ2V0LCBjb250YWluZXIsIHsgX2hpZGVSZXBsYWNlVG9nZ2xlOiB0cnVlLCBzaG93Q29udGV4dFRvZ2dsZTogdHJ1ZSwgaW5wdXRCb3hTdHlsZXM6IHNlYXJjaEVkaXRvcklucHV0Ym94U3R5bGVzLCB0b2dnbGVTdHlsZXM6IGRlZmF1bHRUb2dnbGVTdHlsZXMgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucXVlcnlFZGl0b3JXaWRnZXQub25SZXBsYWNlVG9nZ2xlZCgoKSA9PiB0aGlzLnJlTGF5b3V0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0Lm9uRGlkSGVpZ2h0Q2hhbmdlKCgpID0+IHRoaXMucmVMYXlvdXQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucXVlcnlFZGl0b3JXaWRnZXQub25TZWFyY2hTdWJtaXQoKHsgZGVsYXkgfSkgPT4gdGhpcy50cmlnZ2VyU2VhcmNoKHsgZGVsYXkgfSkpKTtcblx0XHRpZiAodGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dC5vbkRpZE9wdGlvbkNoYW5nZSgoKSA9PiB0aGlzLnRyaWdnZXJTZWFyY2goeyByZXNldEN1cnNvcjogZmFsc2UgfSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ1NlYXJjaEVkaXRvcjogU2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0IGlzIHVuZGVmaW5lZCwgY2Fubm90IHJlZ2lzdGVyIG9uRGlkT3B0aW9uQ2hhbmdlIGxpc3RlbmVyJyk7XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucXVlcnlFZGl0b3JXaWRnZXQub25EaWRUb2dnbGVDb250ZXh0KCgpID0+IHRoaXMudHJpZ2dlclNlYXJjaCh7IHJlc2V0Q3Vyc29yOiBmYWxzZSB9KSkpO1xuXG5cdFx0Ly8gSW5jbHVkZXMvRXhjbHVkZXMgRHJvcGRvd25cblx0XHR0aGlzLmluY2x1ZGVzRXhjbHVkZXNDb250YWluZXIgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5pbmNsdWRlcy1leGNsdWRlcycpKTtcblxuXHRcdC8vIFRvZ2dsZSBxdWVyeSBkZXRhaWxzIGJ1dHRvblxuXHRcdGNvbnN0IHRvZ2dsZVF1ZXJ5RGV0YWlsc0xhYmVsID0gbG9jYWxpemUoJ21vcmVTZWFyY2gnLCBcIlRvZ2dsZSBTZWFyY2ggRGV0YWlsc1wiKTtcblx0XHR0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlsc0J1dHRvbiA9IERPTS5hcHBlbmQodGhpcy5pbmNsdWRlc0V4Y2x1ZGVzQ29udGFpbmVyLCBET00uJCgnLmV4cGFuZCcgKyBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihzZWFyY2hEZXRhaWxzSWNvbiksIHsgdGFiaW5kZXg6IDAsIHJvbGU6ICdidXR0b24nLCAnYXJpYS1sYWJlbCc6IHRvZ2dsZVF1ZXJ5RGV0YWlsc0xhYmVsIH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnZWxlbWVudCcpLCB0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlsc0J1dHRvbiwgdG9nZ2xlUXVlcnlEZXRhaWxzTGFiZWwpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzQnV0dG9uLCBET00uRXZlbnRUeXBlLkNMSUNLLCBlID0+IHtcblx0XHRcdERPTS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0dGhpcy50b2dnbGVJbmNsdWRlc0V4Y2x1ZGVzKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24sIERPTS5FdmVudFR5cGUuS0VZX1VQLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5TcGFjZSkpIHtcblx0XHRcdFx0RE9NLkV2ZW50SGVscGVyLnN0b3AoZSk7XG5cdFx0XHRcdHRoaXMudG9nZ2xlSW5jbHVkZXNFeGNsdWRlcygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzQnV0dG9uLCBET00uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlRhYikpIHtcblx0XHRcdFx0aWYgKHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuaXNSZXBsYWNlQWN0aXZlKCkpIHtcblx0XHRcdFx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LmZvY3VzUmVwbGFjZUFsbEFjdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuaXNSZXBsYWNlU2hvd24oKSA/IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQucmVwbGFjZUlucHV0Py5mb2N1c09uUHJlc2VydmUoKSA6IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuZm9jdXNSZWdleEFjdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdERPTS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIEluY2x1ZGVzXG5cdFx0Y29uc3QgZm9sZGVySW5jbHVkZXNMaXN0ID0gRE9NLmFwcGVuZCh0aGlzLmluY2x1ZGVzRXhjbHVkZXNDb250YWluZXIsIERPTS4kKCcuZmlsZS10eXBlcy5pbmNsdWRlcycpKTtcblx0XHRjb25zdCBmaWxlc1RvSW5jbHVkZVRpdGxlID0gbG9jYWxpemUoJ3NlYXJjaFNjb3BlLmluY2x1ZGVzJywgXCJmaWxlcyB0byBpbmNsdWRlXCIpO1xuXHRcdERPTS5hcHBlbmQoZm9sZGVySW5jbHVkZXNMaXN0LCBET00uJCgnaDQnLCB1bmRlZmluZWQsIGZpbGVzVG9JbmNsdWRlVGl0bGUpKTtcblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzID0gdGhpcy5fcmVnaXN0ZXIoc2NvcGVkSW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5jbHVkZVBhdHRlcm5JbnB1dFdpZGdldCwgZm9sZGVySW5jbHVkZXNMaXN0LCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwge1xuXHRcdFx0YXJpYUxhYmVsOiBsb2NhbGl6ZSgnbGFiZWwuaW5jbHVkZXMnLCAnU2VhcmNoIEluY2x1ZGUgUGF0dGVybnMnKSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBzZWFyY2hFZGl0b3JJbnB1dGJveFN0eWxlc1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLm9uU3VibWl0KHRyaWdnZXJlZE9uVHlwZSA9PiB0aGlzLnRyaWdnZXJTZWFyY2goeyByZXNldEN1cnNvcjogZmFsc2UsIGRlbGF5OiB0cmlnZ2VyZWRPblR5cGUgPyB0aGlzLnNlYXJjaENvbmZpZy5zZWFyY2hPblR5cGVEZWJvdW5jZVBlcmlvZCA6IDAgfSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLm9uQ2hhbmdlU2VhcmNoSW5FZGl0b3JzQm94KCgpID0+IHRoaXMudHJpZ2dlclNlYXJjaCgpKSk7XG5cblx0XHQvLyBFeGNsdWRlc1xuXHRcdGNvbnN0IGV4Y2x1ZGVzTGlzdCA9IERPTS5hcHBlbmQodGhpcy5pbmNsdWRlc0V4Y2x1ZGVzQ29udGFpbmVyLCBET00uJCgnLmZpbGUtdHlwZXMuZXhjbHVkZXMnKSk7XG5cdFx0Y29uc3QgZXhjbHVkZXNUaXRsZSA9IGxvY2FsaXplKCdzZWFyY2hTY29wZS5leGNsdWRlcycsIFwiZmlsZXMgdG8gZXhjbHVkZVwiKTtcblx0XHRET00uYXBwZW5kKGV4Y2x1ZGVzTGlzdCwgRE9NLiQoJ2g0JywgdW5kZWZpbmVkLCBleGNsdWRlc1RpdGxlKSk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcyA9IHRoaXMuX3JlZ2lzdGVyKHNjb3BlZEluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4Y2x1ZGVQYXR0ZXJuSW5wdXRXaWRnZXQsIGV4Y2x1ZGVzTGlzdCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2xhYmVsLmV4Y2x1ZGVzJywgJ1NlYXJjaCBFeGNsdWRlIFBhdHRlcm5zJyksXG5cdFx0XHRpbnB1dEJveFN0eWxlczogc2VhcmNoRWRpdG9ySW5wdXRib3hTdHlsZXNcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5vblN1Ym1pdCh0cmlnZ2VyZWRPblR5cGUgPT4gdGhpcy50cmlnZ2VyU2VhcmNoKHsgcmVzZXRDdXJzb3I6IGZhbHNlLCBkZWxheTogdHJpZ2dlcmVkT25UeXBlID8gdGhpcy5zZWFyY2hDb25maWcuc2VhcmNoT25UeXBlRGVib3VuY2VQZXJpb2QgOiAwIH0pKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5vbkNoYW5nZUlnbm9yZUJveCgoKSA9PiB0aGlzLnRyaWdnZXJTZWFyY2goKSkpO1xuXG5cdFx0Ly8gTWVzc2FnZXNcblx0XHR0aGlzLm1lc3NhZ2VCb3ggPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5tZXNzYWdlcy50ZXh0LXNlYXJjaC1wcm92aWRlci1tZXNzYWdlcycpKTtcblxuXHRcdFt0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Rm9jdXNUcmFja2VyLCB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlciwgdGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5pbnB1dEZvY3VzVHJhY2tlciwgdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5pbnB1dEZvY3VzVHJhY2tlcl1cblx0XHRcdC5mb3JFYWNoKHRyYWNrZXIgPT4ge1xuXHRcdFx0XHRpZiAoIXRyYWNrZXIpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHNldFRpbWVvdXQoKCkgPT4gaW5wdXRCb3hGb2N1c2VkQ29udGV4dEtleS5zZXQodHJ1ZSksIDApKSk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRyYWNrZXIub25EaWRCbHVyKCgpID0+IGlucHV0Qm94Rm9jdXNlZENvbnRleHRLZXkuc2V0KGZhbHNlKSkpO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZVJ1bkFnYWluTWVzc2FnZShzaG93OiBib29sZWFuKSB7XG5cdFx0RE9NLmNsZWFyTm9kZSh0aGlzLm1lc3NhZ2VCb3gpO1xuXHRcdHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpZiAoc2hvdykge1xuXHRcdFx0Y29uc3QgcnVuQWdhaW5MaW5rID0gRE9NLmFwcGVuZCh0aGlzLm1lc3NhZ2VCb3gsIERPTS4kKCdhLnBvaW50ZXIucHJvbWluZW50Lm1lc3NhZ2UnLCB7fSwgbG9jYWxpemUoJ3J1blNlYXJjaCcsIFwiUnVuIFNlYXJjaFwiKSkpO1xuXHRcdFx0dGhpcy5tZXNzYWdlRGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIocnVuQWdhaW5MaW5rLCBET00uRXZlbnRUeXBlLkNMSUNLLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHJpZ2dlclNlYXJjaCgpO1xuXHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5mb2N1cygpO1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldENvbnRyaWJ1dGlvbnMoKTogSUVkaXRvckNvbnRyaWJ1dGlvbkRlc2NyaXB0aW9uW10ge1xuXHRcdGNvbnN0IHNraXBDb250cmlidXRpb25zID0gW1VudXN1YWxMaW5lVGVybWluYXRvcnNEZXRlY3Rvci5JRF07XG5cdFx0cmV0dXJuIEVkaXRvckV4dGVuc2lvbnNSZWdpc3RyeS5nZXRFZGl0b3JDb250cmlidXRpb25zKCkuZmlsdGVyKGMgPT4gc2tpcENvbnRyaWJ1dGlvbnMuaW5kZXhPZihjLmlkKSA9PT0gLTEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldENvZGVFZGl0b3JXaWRnZXRPcHRpb25zKCk6IElDb2RlRWRpdG9yV2lkZ2V0T3B0aW9ucyB7XG5cdFx0cmV0dXJuIHsgY29udHJpYnV0aW9uczogdGhpcy5fZ2V0Q29udHJpYnV0aW9ucygpIH07XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyRWRpdG9yTGlzdGVuZXJzKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLm9uTW91c2VVcChlID0+IHtcblx0XHRcdGlmIChlLmV2ZW50LmRldGFpbCA9PT0gMSkge1xuXHRcdFx0XHRjb25zdCBiZWhhdmlvdXIgPSB0aGlzLnNlYXJjaENvbmZpZy5zZWFyY2hFZGl0b3Iuc2luZ2xlQ2xpY2tCZWhhdmlvdXI7XG5cdFx0XHRcdGNvbnN0IHBvc2l0aW9uID0gZS50YXJnZXQucG9zaXRpb247XG5cdFx0XHRcdGlmIChwb3NpdGlvbiAmJiBiZWhhdmlvdXIgPT09ICdwZWVrRGVmaW5pdGlvbicpIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lID0gdGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcikgPz8gJyc7XG5cdFx0XHRcdFx0aWYgKGxpbmUubWF0Y2goRklMRV9MSU5FX1JFR0VYKSB8fCBsaW5lLm1hdGNoKFJFU1VMVF9MSU5FX1JFR0VYKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3Iuc2V0U2VsZWN0aW9uKFJhbmdlLmZyb21Qb3NpdGlvbnMocG9zaXRpb24pKTtcblx0XHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ2VkaXRvci5hY3Rpb24ucGVla0RlZmluaXRpb24nKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoZS5ldmVudC5kZXRhaWwgPT09IDIpIHtcblx0XHRcdFx0Y29uc3QgYmVoYXZpb3VyID0gdGhpcy5zZWFyY2hDb25maWcuc2VhcmNoRWRpdG9yLmRvdWJsZUNsaWNrQmVoYXZpb3VyO1xuXHRcdFx0XHRjb25zdCBwb3NpdGlvbiA9IGUudGFyZ2V0LnBvc2l0aW9uO1xuXHRcdFx0XHRpZiAocG9zaXRpb24gJiYgYmVoYXZpb3VyICE9PSAnc2VsZWN0V29yZCcpIHtcblx0XHRcdFx0XHRjb25zdCBsaW5lID0gdGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlcikgPz8gJyc7XG5cdFx0XHRcdFx0aWYgKGxpbmUubWF0Y2goUkVTVUxUX0xJTkVfUkVHRVgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5zZXRTZWxlY3Rpb24oUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbikpO1xuXHRcdFx0XHRcdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChiZWhhdmlvdXIgPT09ICdnb1RvTG9jYXRpb24nID8gJ2VkaXRvci5hY3Rpb24uZ29Ub0RlY2xhcmF0aW9uJyA6ICdlZGl0b3IuYWN0aW9uLm9wZW5EZWNsYXJhdGlvblRvVGhlU2lkZScpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAobGluZS5tYXRjaChGSUxFX0xJTkVfUkVHRVgpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5zZXRTZWxlY3Rpb24oUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbikpO1xuXHRcdFx0XHRcdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnZWRpdG9yLmFjdGlvbi5wZWVrRGVmaW5pdGlvbicpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudCgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMudXBkYXRpbmdNb2RlbEZvclNlYXJjaCkge1xuXHRcdFx0XHR0aGlzLmdldElucHV0KCk/LnNldERpcnR5KHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldENvbnRyb2woKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKSB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblxuXHRcdGNvbnN0IHZpZXdTdGF0ZSA9IHRoaXMubG9hZEVkaXRvclZpZXdTdGF0ZSh0aGlzLmdldElucHV0KCkpO1xuXHRcdGlmICh2aWV3U3RhdGUgJiYgdmlld1N0YXRlLmZvY3VzZWQgPT09ICdlZGl0b3InKSB7XG5cdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5mb2N1cygpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0Zm9jdXNTZWFyY2hJbnB1dCgpIHtcblx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5mb2N1cygpO1xuXHR9XG5cblx0Zm9jdXNGaWxlc1RvSW5jbHVkZUlucHV0KCkge1xuXHRcdGlmICghdGhpcy5zaG93aW5nSW5jbHVkZXNFeGNsdWRlcykge1xuXHRcdFx0dGhpcy50b2dnbGVJbmNsdWRlc0V4Y2x1ZGVzKHRydWUpO1xuXHRcdH1cblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLmZvY3VzKCk7XG5cdH1cblxuXHRmb2N1c0ZpbGVzVG9FeGNsdWRlSW5wdXQoKSB7XG5cdFx0aWYgKCF0aGlzLnNob3dpbmdJbmNsdWRlc0V4Y2x1ZGVzKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZUluY2x1ZGVzRXhjbHVkZXModHJ1ZSk7XG5cdFx0fVxuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuZm9jdXMoKTtcblx0fVxuXG5cdGZvY3VzTmV4dElucHV0KCkge1xuXHRcdGlmICh0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0SGFzRm9jdXMoKSkge1xuXHRcdFx0aWYgKHRoaXMuc2hvd2luZ0luY2x1ZGVzRXhjbHVkZXMpIHtcblx0XHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5mb2N1cygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuaW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHR0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLmZvY3VzKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLmlucHV0SGFzRm9jdXMoKSkge1xuXHRcdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZm9jdXMoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdC8vIHBhc3Ncblx0XHR9XG5cdH1cblxuXHRmb2N1c1ByZXZJbnB1dCgpIHtcblx0XHRpZiAodGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dEhhc0ZvY3VzKCkpIHtcblx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmZvY3VzKCk7IC8vIHdyYXBcblx0XHR9IGVsc2UgaWYgKHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuaW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5mb2N1cygpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5pbnB1dEhhc0ZvY3VzKCkpIHtcblx0XHRcdHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuZm9jdXMoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmhhc1dpZGdldEZvY3VzKCkpIHtcblx0XHRcdC8vIHVucmVhY2hhYmxlLlxuXHRcdH1cblx0fVxuXG5cdHNldFF1ZXJ5KHF1ZXJ5OiBzdHJpbmcpIHtcblx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5zZXRWYWx1ZShxdWVyeSk7XG5cdH1cblxuXHRzZWxlY3RRdWVyeSgpIHtcblx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5zZWxlY3QoKTtcblx0fVxuXG5cdHRvZ2dsZVdob2xlV29yZHMoKSB7XG5cdFx0dGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dD8uc2V0V2hvbGVXb3JkcyghdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dC5nZXRXaG9sZVdvcmRzKCkpO1xuXHRcdHRoaXMudHJpZ2dlclNlYXJjaCh7IHJlc2V0Q3Vyc29yOiBmYWxzZSB9KTtcblx0fVxuXG5cdHRvZ2dsZVJlZ2V4KCkge1xuXHRcdHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFJlZ2V4KCF0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0LmdldFJlZ2V4KCkpO1xuXHRcdHRoaXMudHJpZ2dlclNlYXJjaCh7IHJlc2V0Q3Vyc29yOiBmYWxzZSB9KTtcblx0fVxuXG5cdHRvZ2dsZUNhc2VTZW5zaXRpdmUoKSB7XG5cdFx0dGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dD8uc2V0Q2FzZVNlbnNpdGl2ZSghdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dC5nZXRDYXNlU2Vuc2l0aXZlKCkpO1xuXHRcdHRoaXMudHJpZ2dlclNlYXJjaCh7IHJlc2V0Q3Vyc29yOiBmYWxzZSB9KTtcblx0fVxuXG5cdHRvZ2dsZUNvbnRleHRMaW5lcygpIHtcblx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnRvZ2dsZUNvbnRleHRMaW5lcygpO1xuXHR9XG5cblx0bW9kaWZ5Q29udGV4dExpbmVzKGluY3JlYXNlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5xdWVyeUVkaXRvcldpZGdldC5tb2RpZnlDb250ZXh0TGluZXMoaW5jcmVhc2UpO1xuXHR9XG5cblx0dG9nZ2xlUXVlcnlEZXRhaWxzKHNob3VsZFNob3c/OiBib29sZWFuKSB7XG5cdFx0dGhpcy50b2dnbGVJbmNsdWRlc0V4Y2x1ZGVzKHNob3VsZFNob3cpO1xuXHR9XG5cblx0ZGVsZXRlUmVzdWx0QmxvY2soKSB7XG5cdFx0Y29uc3QgbGluZXNUb0RlbGV0ZSA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmdldFNlbGVjdGlvbnMoKTtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCEoc2VsZWN0aW9ucyAmJiBtb2RlbCkpIHsgcmV0dXJuOyB9XG5cblx0XHRjb25zdCBtYXhMaW5lID0gbW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0Y29uc3QgbWluTGluZSA9IDE7XG5cblx0XHRjb25zdCBkZWxldGVVcCA9IChzdGFydDogbnVtYmVyKSA9PiB7XG5cdFx0XHRmb3IgKGxldCBjdXJzb3IgPSBzdGFydDsgY3Vyc29yID49IG1pbkxpbmU7IGN1cnNvci0tKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmUgPSBtb2RlbC5nZXRMaW5lQ29udGVudChjdXJzb3IpO1xuXHRcdFx0XHRsaW5lc1RvRGVsZXRlLmFkZChjdXJzb3IpO1xuXHRcdFx0XHRpZiAobGluZVswXSAhPT0gdW5kZWZpbmVkICYmIGxpbmVbMF0gIT09ICcgJykge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRlbGV0ZURvd24gPSAoc3RhcnQ6IG51bWJlcik6IG51bWJlciB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRsaW5lc1RvRGVsZXRlLmFkZChzdGFydCk7XG5cdFx0XHRmb3IgKGxldCBjdXJzb3IgPSBzdGFydCArIDE7IGN1cnNvciA8PSBtYXhMaW5lOyBjdXJzb3IrKykge1xuXHRcdFx0XHRjb25zdCBsaW5lID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQoY3Vyc29yKTtcblx0XHRcdFx0aWYgKGxpbmVbMF0gIT09IHVuZGVmaW5lZCAmJiBsaW5lWzBdICE9PSAnICcpIHtcblx0XHRcdFx0XHRyZXR1cm4gY3Vyc29yO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpbmVzVG9EZWxldGUuYWRkKGN1cnNvcik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fTtcblxuXHRcdGNvbnN0IGVuZGluZ0N1cnNvckxpbmVzOiBBcnJheTxudW1iZXIgfCB1bmRlZmluZWQ+ID0gW107XG5cdFx0Zm9yIChjb25zdCBzZWxlY3Rpb24gb2Ygc2VsZWN0aW9ucykge1xuXHRcdFx0Y29uc3QgbGluZU51bWJlciA9IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXI7XG5cdFx0XHRlbmRpbmdDdXJzb3JMaW5lcy5wdXNoKGRlbGV0ZURvd24obGluZU51bWJlcikpO1xuXHRcdFx0ZGVsZXRlVXAobGluZU51bWJlcik7XG5cdFx0XHRmb3IgKGxldCBpbm5lciA9IHNlbGVjdGlvbi5zdGFydExpbmVOdW1iZXI7IGlubmVyIDw9IHNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyOyBpbm5lcisrKSB7XG5cdFx0XHRcdGxpbmVzVG9EZWxldGUuYWRkKGlubmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZW5kaW5nQ3Vyc29yTGluZXMubGVuZ3RoID09PSAwKSB7IGVuZGluZ0N1cnNvckxpbmVzLnB1c2goMSk7IH1cblxuXHRcdGNvbnN0IGlzRGVmaW5lZCA9IDxUPih4OiBUIHwgdW5kZWZpbmVkKTogeCBpcyBUID0+IHggIT09IHVuZGVmaW5lZDtcblxuXHRcdG1vZGVsLnB1c2hFZGl0T3BlcmF0aW9ucyh0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5nZXRTZWxlY3Rpb25zKCksXG5cdFx0XHRbLi4ubGluZXNUb0RlbGV0ZV0ubWFwKGxpbmUgPT4gKHsgcmFuZ2U6IG5ldyBSYW5nZShsaW5lLCAxLCBsaW5lICsgMSwgMSksIHRleHQ6ICcnIH0pKSxcblx0XHRcdCgpID0+IGVuZGluZ0N1cnNvckxpbmVzLmZpbHRlcihpc0RlZmluZWQpLm1hcChsaW5lID0+IG5ldyBTZWxlY3Rpb24obGluZSwgMSwgbGluZSwgMSkpKTtcblx0fVxuXG5cdGNsZWFuU3RhdGUoKSB7XG5cdFx0dGhpcy5nZXRJbnB1dCgpPy5zZXREaXJ0eShmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzZWFyY2hDb25maWcoKTogSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKTtcblx0fVxuXG5cdHByaXZhdGUgaXRlcmF0ZVRocm91Z2hNYXRjaGVzKHJldmVyc2U6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmdldE1vZGVsKCk7XG5cdFx0aWYgKCFtb2RlbCkgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IGxhc3RMaW5lID0gbW9kZWwuZ2V0TGluZUNvdW50KCkgPz8gMTtcblx0XHRjb25zdCBsYXN0Q29sdW1uID0gbW9kZWwuZ2V0TGluZUxlbmd0aChsYXN0TGluZSk7XG5cblx0XHRjb25zdCBmYWxsYmFja1N0YXJ0ID0gcmV2ZXJzZSA/IG5ldyBQb3NpdGlvbihsYXN0TGluZSwgbGFzdENvbHVtbikgOiBuZXcgUG9zaXRpb24oMSwgMSk7XG5cblx0XHRjb25zdCBjdXJyZW50UG9zaXRpb24gPSB0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5nZXRTZWxlY3Rpb24oKT8uZ2V0U3RhcnRQb3NpdGlvbigpID8/IGZhbGxiYWNrU3RhcnQ7XG5cblx0XHRjb25zdCBtYXRjaFJhbmdlcyA9IHRoaXMuZ2V0SW5wdXQoKT8uZ2V0TWF0Y2hSYW5nZXMoKTtcblx0XHRpZiAoIW1hdGNoUmFuZ2VzKSB7IHJldHVybjsgfVxuXG5cdFx0Y29uc3QgbWF0Y2hSYW5nZSA9IChyZXZlcnNlID8gZmluZFByZXZSYW5nZSA6IGZpbmROZXh0UmFuZ2UpKG1hdGNoUmFuZ2VzLCBjdXJyZW50UG9zaXRpb24pO1xuXHRcdGlmICghbWF0Y2hSYW5nZSkgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLnNldFNlbGVjdGlvbihtYXRjaFJhbmdlKTtcblx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5yZXZlYWxMaW5lSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydChtYXRjaFJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZm9jdXMoKTtcblxuXHRcdGNvbnN0IG1hdGNoTGluZVRleHQgPSBtb2RlbC5nZXRMaW5lQ29udGVudChtYXRjaFJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0Y29uc3QgbWF0Y2hUZXh0ID0gbW9kZWwuZ2V0VmFsdWVJblJhbmdlKG1hdGNoUmFuZ2UpO1xuXHRcdGxldCBmaWxlID0gJyc7XG5cdFx0Zm9yIChsZXQgbGluZSA9IG1hdGNoUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyOyBsaW5lID49IDE7IGxpbmUtLSkge1xuXHRcdFx0Y29uc3QgbGluZVRleHQgPSBtb2RlbC5nZXRWYWx1ZUluUmFuZ2UobmV3IFJhbmdlKGxpbmUsIDEsIGxpbmUsIDIpKTtcblx0XHRcdGlmIChsaW5lVGV4dCAhPT0gJyAnKSB7IGZpbGUgPSBtb2RlbC5nZXRMaW5lQ29udGVudChsaW5lKTsgYnJlYWs7IH1cblx0XHR9XG5cdFx0YWxlcnQobG9jYWxpemUoJ3NlYXJjaFJlc3VsdEl0ZW0nLCBcIk1hdGNoZWQgezB9IGF0IHsxfSBpbiBmaWxlIHsyfVwiLCBtYXRjaFRleHQsIG1hdGNoTGluZVRleHQsIGZpbGUuc2xpY2UoMCwgZmlsZS5sZW5ndGggLSAxKSkpO1xuXHR9XG5cblx0Zm9jdXNOZXh0UmVzdWx0KCkge1xuXHRcdHRoaXMuaXRlcmF0ZVRocm91Z2hNYXRjaGVzKGZhbHNlKTtcblx0fVxuXG5cdGZvY3VzUHJldmlvdXNSZXN1bHQoKSB7XG5cdFx0dGhpcy5pdGVyYXRlVGhyb3VnaE1hdGNoZXModHJ1ZSk7XG5cdH1cblxuXHRmb2N1c0FsbFJlc3VsdHMoKSB7XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3Jcblx0XHRcdC5zZXRTZWxlY3Rpb25zKCh0aGlzLmdldElucHV0KCk/LmdldE1hdGNoUmFuZ2VzKCkgPz8gW10pLm1hcChcblx0XHRcdFx0cmFuZ2UgPT4gbmV3IFNlbGVjdGlvbihyYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLnN0YXJ0Q29sdW1uLCByYW5nZS5lbmRMaW5lTnVtYmVyLCByYW5nZS5lbmRDb2x1bW4pKSk7XG5cdFx0dGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZm9jdXMoKTtcblx0fVxuXG5cdGFzeW5jIHRyaWdnZXJTZWFyY2goX29wdGlvbnM/OiB7IHJlc2V0Q3Vyc29yPzogYm9vbGVhbjsgZGVsYXk/OiBudW1iZXI7IGZvY3VzUmVzdWx0cz86IGJvb2xlYW4gfSkge1xuXHRcdGNvbnN0IGZvY3VzUmVzdWx0cyA9IHRoaXMuc2VhcmNoQ29uZmlnLnNlYXJjaEVkaXRvci5mb2N1c1Jlc3VsdHNPblNlYXJjaDtcblxuXHRcdC8vIElmIF9vcHRpb25zIGRvbid0IGRlZmluZSBmb2N1c1Jlc3VsdCBmaWVsZCwgdGhlbiB1c2UgdGhlIHNldHRpbmdcblx0XHRpZiAoX29wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0X29wdGlvbnMgPSB7IGZvY3VzUmVzdWx0czogZm9jdXNSZXN1bHRzIH07XG5cdFx0fSBlbHNlIGlmIChfb3B0aW9ucy5mb2N1c1Jlc3VsdHMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0X29wdGlvbnMuZm9jdXNSZXN1bHRzID0gZm9jdXNSZXN1bHRzO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9wdGlvbnMgPSB7IHJlc2V0Q3Vyc29yOiB0cnVlLCBkZWxheTogMCwgLi4uX29wdGlvbnMgfTtcblxuXHRcdGlmICghKHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuc2VhcmNoSW5wdXQ/LmlucHV0Qm94LmlzSW5wdXRWYWxpZCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5wYXVzZVNlYXJjaGluZykge1xuXHRcdFx0YXdhaXQgdGhpcy5ydW5TZWFyY2hEZWxheWVyLnRyaWdnZXIoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVJ1bkFnYWluTWVzc2FnZShmYWxzZSk7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZG9SdW5TZWFyY2goKTtcblx0XHRcdFx0aWYgKG9wdGlvbnMucmVzZXRDdXJzb3IpIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5zZXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdFx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLnNldFNjcm9sbFBvc2l0aW9uKHsgc2Nyb2xsVG9wOiAwLCBzY3JvbGxMZWZ0OiAwIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvcHRpb25zLmZvY3VzUmVzdWx0cykge1xuXHRcdFx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLmZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIG9wdGlvbnMuZGVsYXkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZENvbmZpZ0Zyb21XaWRnZXQoKTogU2VhcmNoQ29uZmlndXJhdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlzQ2FzZVNlbnNpdGl2ZTogdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dD8uZ2V0Q2FzZVNlbnNpdGl2ZSgpID8/IGZhbHNlLFxuXHRcdFx0Y29udGV4dExpbmVzOiB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LmdldENvbnRleHRMaW5lcygpLFxuXHRcdFx0ZmlsZXNUb0V4Y2x1ZGU6IHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuZ2V0VmFsdWUoKSxcblx0XHRcdGZpbGVzVG9JbmNsdWRlOiB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLmdldFZhbHVlKCksXG5cdFx0XHRxdWVyeTogdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dD8uZ2V0VmFsdWUoKSA/PyAnJyxcblx0XHRcdGlzUmVnZXhwOiB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5nZXRSZWdleCgpID8/IGZhbHNlLFxuXHRcdFx0bWF0Y2hXaG9sZVdvcmQ6IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuc2VhcmNoSW5wdXQ/LmdldFdob2xlV29yZHMoKSA/PyBmYWxzZSxcblx0XHRcdHVzZUV4Y2x1ZGVTZXR0aW5nc0FuZElnbm9yZUZpbGVzOiB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLnVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMoKSxcblx0XHRcdG9ubHlPcGVuRWRpdG9yczogdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5vbmx5U2VhcmNoSW5PcGVuRWRpdG9ycygpLFxuXHRcdFx0c2hvd0luY2x1ZGVzRXhjbHVkZXM6IHRoaXMuc2hvd2luZ0luY2x1ZGVzRXhjbHVkZXMsXG5cdFx0XHRub3RlYm9va1NlYXJjaENvbmZpZzoge1xuXHRcdFx0XHRpbmNsdWRlTWFya3VwSW5wdXQ6IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuZ2V0Tm90ZWJvb2tGaWx0ZXJzKCkubWFya3VwSW5wdXQsXG5cdFx0XHRcdGluY2x1ZGVNYXJrdXBQcmV2aWV3OiB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLm1hcmt1cFByZXZpZXcsXG5cdFx0XHRcdGluY2x1ZGVDb2RlSW5wdXQ6IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuZ2V0Tm90ZWJvb2tGaWx0ZXJzKCkuY29kZUlucHV0LFxuXHRcdFx0XHRpbmNsdWRlT3V0cHV0OiB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLmNvZGVPdXRwdXQsXG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SdW5TZWFyY2goKSB7XG5cdFx0dGhpcy5zZWFyY2hNb2RlbC5jYW5jZWxTZWFyY2godHJ1ZSk7XG5cblx0XHRjb25zdCBzdGFydElucHV0ID0gdGhpcy5nZXRJbnB1dCgpO1xuXHRcdGlmICghc3RhcnRJbnB1dCkgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuc2VhcmNoSGlzdG9yeURlbGF5ZXIudHJpZ2dlcigoKSA9PiB7XG5cdFx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5vblNlYXJjaFN1Ym1pdCgpO1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5vblNlYXJjaFN1Ym1pdCgpO1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5vblNlYXJjaFN1Ym1pdCgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5yZWFkQ29uZmlnRnJvbVdpZGdldCgpO1xuXG5cdFx0aWYgKCFjb25maWcucXVlcnkpIHsgcmV0dXJuOyB9XG5cblx0XHRjb25zdCBjb250ZW50OiBJUGF0dGVybkluZm8gPSB7XG5cdFx0XHRwYXR0ZXJuOiBjb25maWcucXVlcnksXG5cdFx0XHRpc1JlZ0V4cDogY29uZmlnLmlzUmVnZXhwLFxuXHRcdFx0aXNDYXNlU2Vuc2l0aXZlOiBjb25maWcuaXNDYXNlU2Vuc2l0aXZlLFxuXHRcdFx0aXNXb3JkTWF0Y2g6IGNvbmZpZy5tYXRjaFdob2xlV29yZCxcblx0XHR9O1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zID0ge1xuXHRcdFx0X3JlYXNvbjogJ3NlYXJjaEVkaXRvcicsXG5cdFx0XHRleHRyYUZpbGVSZXNvdXJjZXM6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0T3V0T2ZXb3Jrc3BhY2VFZGl0b3JSZXNvdXJjZXMpLFxuXHRcdFx0bWF4UmVzdWx0czogdGhpcy5zZWFyY2hDb25maWcubWF4UmVzdWx0cyA/PyB1bmRlZmluZWQsXG5cdFx0XHRkaXNyZWdhcmRJZ25vcmVGaWxlczogIWNvbmZpZy51c2VFeGNsdWRlU2V0dGluZ3NBbmRJZ25vcmVGaWxlcyB8fCB1bmRlZmluZWQsXG5cdFx0XHRkaXNyZWdhcmRFeGNsdWRlU2V0dGluZ3M6ICFjb25maWcudXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXMgfHwgdW5kZWZpbmVkLFxuXHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7IHBhdHRlcm46IGNvbmZpZy5maWxlc1RvRXhjbHVkZSB9XSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiBjb25maWcuZmlsZXNUb0luY2x1ZGUsXG5cdFx0XHRvbmx5T3BlbkVkaXRvcnM6IGNvbmZpZy5vbmx5T3BlbkVkaXRvcnMsXG5cdFx0XHRwcmV2aWV3T3B0aW9uczoge1xuXHRcdFx0XHRtYXRjaExpbmVzOiAxLFxuXHRcdFx0XHRjaGFyc1BlckxpbmU6IDEwMDBcblx0XHRcdH0sXG5cdFx0XHRzdXJyb3VuZGluZ0NvbnRleHQ6IGNvbmZpZy5jb250ZXh0TGluZXMsXG5cdFx0XHRpc1NtYXJ0Q2FzZTogdGhpcy5zZWFyY2hDb25maWcuc21hcnRDYXNlLFxuXHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWUsXG5cdFx0XHRub3RlYm9va1NlYXJjaENvbmZpZzoge1xuXHRcdFx0XHRpbmNsdWRlTWFya3VwSW5wdXQ6IGNvbmZpZy5ub3RlYm9va1NlYXJjaENvbmZpZy5pbmNsdWRlTWFya3VwSW5wdXQsXG5cdFx0XHRcdGluY2x1ZGVNYXJrdXBQcmV2aWV3OiBjb25maWcubm90ZWJvb2tTZWFyY2hDb25maWcuaW5jbHVkZU1hcmt1cFByZXZpZXcsXG5cdFx0XHRcdGluY2x1ZGVDb2RlSW5wdXQ6IGNvbmZpZy5ub3RlYm9va1NlYXJjaENvbmZpZy5pbmNsdWRlQ29kZUlucHV0LFxuXHRcdFx0XHRpbmNsdWRlT3V0cHV0OiBjb25maWcubm90ZWJvb2tTZWFyY2hDb25maWcuaW5jbHVkZU91dHB1dCxcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgZm9sZGVyUmVzb3VyY2VzID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzO1xuXHRcdGxldCBxdWVyeTogSVRleHRRdWVyeTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcXVlcnlCdWlsZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXHRcdFx0cXVlcnkgPSBxdWVyeUJ1aWxkZXIudGV4dChjb250ZW50LCBmb2xkZXJSZXNvdXJjZXMubWFwKGZvbGRlciA9PiBmb2xkZXIudXJpKSwgb3B0aW9ucyk7XG5cdFx0fVxuXHRcdGNhdGNoIChlcnIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNlYXJjaE9wZXJhdGlvbi5zdGFydCg1MDApO1xuXHRcdHRoaXMub25nb2luZ09wZXJhdGlvbnMrKztcblxuXHRcdGNvbnN0IHsgY29uZmlndXJhdGlvbk1vZGVsIH0gPSBhd2FpdCBzdGFydElucHV0LnJlc29sdmVNb2RlbHMoKTtcblx0XHRjb25maWd1cmF0aW9uTW9kZWwudXBkYXRlQ29uZmlnKGNvbmZpZyk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5zZWFyY2hNb2RlbC5zZWFyY2gocXVlcnkpO1xuXHRcdHN0YXJ0SW5wdXQub25nb2luZ1NlYXJjaE9wZXJhdGlvbiA9IHJlc3VsdC5hc3luY1Jlc3VsdHMuZmluYWxseSgoKSA9PiB7XG5cdFx0XHR0aGlzLm9uZ29pbmdPcGVyYXRpb25zLS07XG5cdFx0XHRpZiAodGhpcy5vbmdvaW5nT3BlcmF0aW9ucyA9PT0gMCkge1xuXHRcdFx0XHR0aGlzLnNlYXJjaE9wZXJhdGlvbi5zdG9wKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBzZWFyY2hPcGVyYXRpb24gPSBhd2FpdCBzdGFydElucHV0Lm9uZ29pbmdTZWFyY2hPcGVyYXRpb247XG5cdFx0YXdhaXQgdGhpcy5vblNlYXJjaENvbXBsZXRlKHNlYXJjaE9wZXJhdGlvbiwgY29uZmlnLCBzdGFydElucHV0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25TZWFyY2hDb21wbGV0ZShzZWFyY2hPcGVyYXRpb246IElTZWFyY2hDb21wbGV0ZSwgc3RhcnRDb25maWc6IFNlYXJjaENvbmZpZ3VyYXRpb24sIHN0YXJ0SW5wdXQ6IFNlYXJjaEVkaXRvcklucHV0KSB7XG5cdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmdldElucHV0KCk7XG5cdFx0aWYgKCFpbnB1dCB8fFxuXHRcdFx0aW5wdXQgIT09IHN0YXJ0SW5wdXQgfHxcblx0XHRcdEpTT04uc3RyaW5naWZ5KHN0YXJ0Q29uZmlnKSAhPT0gSlNPTi5zdHJpbmdpZnkodGhpcy5yZWFkQ29uZmlnRnJvbVdpZGdldCgpKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlucHV0Lm9uZ29pbmdTZWFyY2hPcGVyYXRpb24gPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBzb3J0T3JkZXIgPSB0aGlzLnNlYXJjaENvbmZpZy5zb3J0T3JkZXI7XG5cdFx0aWYgKHNvcnRPcmRlciA9PT0gU2VhcmNoU29ydE9yZGVyLk1vZGlmaWVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJldHJpZXZlRmlsZVN0YXRzKHRoaXMuc2VhcmNoTW9kZWwuc2VhcmNoUmVzdWx0KTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250cm9sbGVyID0gUmVmZXJlbmNlc0NvbnRyb2xsZXIuZ2V0KHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yKTtcblx0XHRjb250cm9sbGVyPy5jbG9zZVdpZGdldChmYWxzZSk7XG5cdFx0Y29uc3QgbGFiZWxGb3JtYXR0ZXIgPSAodXJpOiBVUkkpOiBzdHJpbmcgPT4gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodXJpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBzZXJpYWxpemVTZWFyY2hSZXN1bHRGb3JFZGl0b3IodGhpcy5zZWFyY2hNb2RlbC5zZWFyY2hSZXN1bHQsIHN0YXJ0Q29uZmlnLmZpbGVzVG9JbmNsdWRlLCBzdGFydENvbmZpZy5maWxlc1RvRXhjbHVkZSwgc3RhcnRDb25maWcuY29udGV4dExpbmVzLCBsYWJlbEZvcm1hdHRlciwgc29ydE9yZGVyLCBzZWFyY2hPcGVyYXRpb24/LmxpbWl0SGl0KTtcblx0XHRjb25zdCB7IHJlc3VsdHNNb2RlbCB9ID0gYXdhaXQgaW5wdXQucmVzb2x2ZU1vZGVscygpO1xuXHRcdHRoaXMudXBkYXRpbmdNb2RlbEZvclNlYXJjaCA9IHRydWU7XG5cdFx0dGhpcy5tb2RlbFNlcnZpY2UudXBkYXRlTW9kZWwocmVzdWx0c01vZGVsLCByZXN1bHRzLnRleHQpO1xuXHRcdHRoaXMudXBkYXRpbmdNb2RlbEZvclNlYXJjaCA9IGZhbHNlO1xuXG5cdFx0aWYgKHNlYXJjaE9wZXJhdGlvbiAmJiBzZWFyY2hPcGVyYXRpb24ubWVzc2FnZXMpIHtcblx0XHRcdGZvciAoY29uc3QgbWVzc2FnZSBvZiBzZWFyY2hPcGVyYXRpb24ubWVzc2FnZXMpIHtcblx0XHRcdFx0dGhpcy5hZGRNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnJlTGF5b3V0KCk7XG5cblx0XHRpbnB1dC5zZXREaXJ0eSghaW5wdXQuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkpO1xuXHRcdGlucHV0LnNldE1hdGNoUmFuZ2VzKHJlc3VsdHMubWF0Y2hSYW5nZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRNZXNzYWdlKG1lc3NhZ2U6IFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2UpIHtcblx0XHRsZXQgbWVzc2FnZUJveDogSFRNTEVsZW1lbnQ7XG5cdFx0aWYgKHRoaXMubWVzc2FnZUJveC5maXJzdENoaWxkKSB7XG5cdFx0XHRtZXNzYWdlQm94ID0gdGhpcy5tZXNzYWdlQm94LmZpcnN0Q2hpbGQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lc3NhZ2VCb3ggPSBET00uYXBwZW5kKHRoaXMubWVzc2FnZUJveCwgRE9NLiQoJy5tZXNzYWdlJykpO1xuXHRcdH1cblxuXHRcdERPTS5hcHBlbmQobWVzc2FnZUJveCwgcmVuZGVyU2VhcmNoTWVzc2FnZShtZXNzYWdlLCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UsIHRoaXMub3BlbmVyU2VydmljZSwgdGhpcy5jb21tYW5kU2VydmljZSwgdGhpcy5tZXNzYWdlRGlzcG9zYWJsZXMsICgpID0+IHRoaXMudHJpZ2dlclNlYXJjaCgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJldHJpZXZlRmlsZVN0YXRzKHNlYXJjaFJlc3VsdDogSVNlYXJjaFJlc3VsdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVzID0gc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKS5maWx0ZXIoZiA9PiAhZi5maWxlU3RhdCkubWFwKGYgPT4gZi5yZXNvbHZlRmlsZVN0YXQodGhpcy5maWxlU2VydmljZSkpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGZpbGVzKTtcblx0fVxuXG5cdG92ZXJyaWRlIGxheW91dChkaW1lbnNpb246IERPTS5EaW1lbnNpb24pIHtcblx0XHR0aGlzLmRpbWVuc2lvbiA9IGRpbWVuc2lvbjtcblx0XHR0aGlzLnJlTGF5b3V0KCk7XG5cdH1cblxuXHRnZXRTZWxlY3RlZCgpIHtcblx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0VmFsdWVJblJhbmdlKHNlbGVjdGlvbikgPz8gJyc7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHByaXZhdGUgcmVMYXlvdXQoKSB7XG5cdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHR0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNldFdpZHRoKHRoaXMuZGltZW5zaW9uLndpZHRoIC0gMjggLyogY29udGFpbmVyIG1hcmdpbiAqLyk7XG5cdFx0XHR0aGlzLnNlYXJjaFJlc3VsdEVkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IHRoaXMuZGltZW5zaW9uLmhlaWdodCAtIERPTS5nZXRUb3RhbEhlaWdodCh0aGlzLnF1ZXJ5RWRpdG9yQ29udGFpbmVyKSwgd2lkdGg6IHRoaXMuZGltZW5zaW9uLndpZHRoIH0pO1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5zZXRXaWR0aCh0aGlzLmRpbWVuc2lvbi53aWR0aCAtIDI4IC8qIGNvbnRhaW5lciBtYXJnaW4gKi8pO1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5zZXRXaWR0aCh0aGlzLmRpbWVuc2lvbi53aWR0aCAtIDI4IC8qIGNvbnRhaW5lciBtYXJnaW4gKi8pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5wdXQoKTogU2VhcmNoRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmlucHV0IGFzIFNlYXJjaEVkaXRvcklucHV0O1xuXHR9XG5cblx0cHJpdmF0ZSBwcmlvckNvbmZpZzogUGFydGlhbDxSZWFkb25seTxTZWFyY2hDb25maWd1cmF0aW9uPj4gfCB1bmRlZmluZWQ7XG5cdHNldFNlYXJjaENvbmZpZyhjb25maWc6IFBhcnRpYWw8UmVhZG9ubHk8U2VhcmNoQ29uZmlndXJhdGlvbj4+KSB7XG5cdFx0dGhpcy5wcmlvckNvbmZpZyA9IGNvbmZpZztcblx0XHRpZiAoY29uZmlnLnF1ZXJ5ICE9PSB1bmRlZmluZWQpIHsgdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZXRWYWx1ZShjb25maWcucXVlcnkpOyB9XG5cdFx0aWYgKGNvbmZpZy5pc0Nhc2VTZW5zaXRpdmUgIT09IHVuZGVmaW5lZCkgeyB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNlYXJjaElucHV0Py5zZXRDYXNlU2Vuc2l0aXZlKGNvbmZpZy5pc0Nhc2VTZW5zaXRpdmUpOyB9XG5cdFx0aWYgKGNvbmZpZy5pc1JlZ2V4cCAhPT0gdW5kZWZpbmVkKSB7IHRoaXMucXVlcnlFZGl0b3JXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFJlZ2V4KGNvbmZpZy5pc1JlZ2V4cCk7IH1cblx0XHRpZiAoY29uZmlnLm1hdGNoV2hvbGVXb3JkICE9PSB1bmRlZmluZWQpIHsgdGhpcy5xdWVyeUVkaXRvcldpZGdldC5zZWFyY2hJbnB1dD8uc2V0V2hvbGVXb3Jkcyhjb25maWcubWF0Y2hXaG9sZVdvcmQpOyB9XG5cdFx0aWYgKGNvbmZpZy5jb250ZXh0TGluZXMgIT09IHVuZGVmaW5lZCkgeyB0aGlzLnF1ZXJ5RWRpdG9yV2lkZ2V0LnNldENvbnRleHRMaW5lcyhjb25maWcuY29udGV4dExpbmVzKTsgfVxuXHRcdGlmIChjb25maWcuZmlsZXNUb0V4Y2x1ZGUgIT09IHVuZGVmaW5lZCkgeyB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLnNldFZhbHVlKGNvbmZpZy5maWxlc1RvRXhjbHVkZSk7IH1cblx0XHRpZiAoY29uZmlnLmZpbGVzVG9JbmNsdWRlICE9PSB1bmRlZmluZWQpIHsgdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5zZXRWYWx1ZShjb25maWcuZmlsZXNUb0luY2x1ZGUpOyB9XG5cdFx0aWYgKGNvbmZpZy5vbmx5T3BlbkVkaXRvcnMgIT09IHVuZGVmaW5lZCkgeyB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNldE9ubHlTZWFyY2hJbk9wZW5FZGl0b3JzKGNvbmZpZy5vbmx5T3BlbkVkaXRvcnMpOyB9XG5cdFx0aWYgKGNvbmZpZy51c2VFeGNsdWRlU2V0dGluZ3NBbmRJZ25vcmVGaWxlcyAhPT0gdW5kZWZpbmVkKSB7IHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuc2V0VXNlRXhjbHVkZXNBbmRJZ25vcmVGaWxlcyhjb25maWcudXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXMpOyB9XG5cdFx0aWYgKGNvbmZpZy5zaG93SW5jbHVkZXNFeGNsdWRlcyAhPT0gdW5kZWZpbmVkKSB7IHRoaXMudG9nZ2xlSW5jbHVkZXNFeGNsdWRlcyhjb25maWcuc2hvd0luY2x1ZGVzRXhjbHVkZXMpOyB9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChuZXdJbnB1dDogU2VhcmNoRWRpdG9ySW5wdXQsIG9wdGlvbnM6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLnNldElucHV0KG5ld0lucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBjb25maWd1cmF0aW9uTW9kZWwsIHJlc3VsdHNNb2RlbCB9ID0gYXdhaXQgbmV3SW5wdXQucmVzb2x2ZU1vZGVscygpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLnNldE1vZGVsKHJlc3VsdHNNb2RlbCk7XG5cdFx0dGhpcy5wYXVzZVNlYXJjaGluZyA9IHRydWU7XG5cblx0XHR0aGlzLnRvZ2dsZVJ1bkFnYWluTWVzc2FnZSghbmV3SW5wdXQub25nb2luZ1NlYXJjaE9wZXJhdGlvbiAmJiByZXN1bHRzTW9kZWwuZ2V0TGluZUNvdW50KCkgPT09IDEgJiYgcmVzdWx0c01vZGVsLmdldFZhbHVlTGVuZ3RoKCkgPT09IDAgJiYgY29uZmlndXJhdGlvbk1vZGVsLmNvbmZpZy5xdWVyeSAhPT0gJycpO1xuXG5cdFx0dGhpcy5zZXRTZWFyY2hDb25maWcoY29uZmlndXJhdGlvbk1vZGVsLmNvbmZpZyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uTW9kZWwub25Db25maWdEaWRVcGRhdGUobmV3Q29uZmlnID0+IHtcblx0XHRcdGlmIChuZXdDb25maWcgIT09IHRoaXMucHJpb3JDb25maWcpIHtcblx0XHRcdFx0dGhpcy5wYXVzZVNlYXJjaGluZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuc2V0U2VhcmNoQ29uZmlnKG5ld0NvbmZpZyk7XG5cdFx0XHRcdHRoaXMucGF1c2VTZWFyY2hpbmcgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnJlc3RvcmVWaWV3U3RhdGUoY29udGV4dCk7XG5cblx0XHRpZiAoIW9wdGlvbnM/LnByZXNlcnZlRm9jdXMpIHtcblx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHR9XG5cblx0XHR0aGlzLnBhdXNlU2VhcmNoaW5nID0gZmFsc2U7XG5cblx0XHRpZiAobmV3SW5wdXQub25nb2luZ1NlYXJjaE9wZXJhdGlvbikge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmdDb25maWcgPSB0aGlzLnJlYWRDb25maWdGcm9tV2lkZ2V0KCk7XG5cdFx0XHRuZXdJbnB1dC5vbmdvaW5nU2VhcmNoT3BlcmF0aW9uLnRoZW4oY29tcGxldGUgPT4ge1xuXHRcdFx0XHR0aGlzLm9uU2VhcmNoQ29tcGxldGUoY29tcGxldGUsIGV4aXN0aW5nQ29uZmlnLCBuZXdJbnB1dCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZUluY2x1ZGVzRXhjbHVkZXMoX3Nob3VsZFNob3c/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgY2xzID0gJ2V4cGFuZGVkJztcblx0XHRjb25zdCBzaG91bGRTaG93ID0gX3Nob3VsZFNob3cgPz8gIXRoaXMuaW5jbHVkZXNFeGNsdWRlc0NvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoY2xzKTtcblxuXHRcdGlmIChzaG91bGRTaG93KSB7XG5cdFx0XHR0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlsc0J1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy5pbmNsdWRlc0V4Y2x1ZGVzQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoY2xzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24uc2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHR0aGlzLmluY2x1ZGVzRXhjbHVkZXNDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZShjbHMpO1xuXHRcdH1cblxuXHRcdHRoaXMuc2hvd2luZ0luY2x1ZGVzRXhjbHVkZXMgPSB0aGlzLmluY2x1ZGVzRXhjbHVkZXNDb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKGNscyk7XG5cblx0XHR0aGlzLnJlTGF5b3V0KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdG9FZGl0b3JWaWV3U3RhdGVSZXNvdXJjZShpbnB1dDogRWRpdG9ySW5wdXQpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChpbnB1dC50eXBlSWQgPT09IFNlYXJjaEVkaXRvcklucHV0VHlwZUlkKSB7XG5cdFx0XHRyZXR1cm4gKGlucHV0IGFzIFNlYXJjaEVkaXRvcklucHV0KS5tb2RlbFVyaTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNvbXB1dGVFZGl0b3JWaWV3U3RhdGUocmVzb3VyY2U6IFVSSSk6IFNlYXJjaEVkaXRvclZpZXdTdGF0ZSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgY29udHJvbCA9IHRoaXMuZ2V0Q29udHJvbCgpO1xuXHRcdGNvbnN0IGVkaXRvclZpZXdTdGF0ZSA9IGNvbnRyb2wuc2F2ZVZpZXdTdGF0ZSgpO1xuXHRcdGlmICghZWRpdG9yVmlld1N0YXRlKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRpZiAocmVzb3VyY2UudG9TdHJpbmcoKSAhPT0gdGhpcy5nZXRJbnB1dCgpPy5tb2RlbFVyaS50b1N0cmluZygpKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRcdHJldHVybiB7IC4uLmVkaXRvclZpZXdTdGF0ZSwgZm9jdXNlZDogdGhpcy5zZWFyY2hSZXN1bHRFZGl0b3IuaGFzV2lkZ2V0Rm9jdXMoKSA/ICdlZGl0b3InIDogJ2lucHV0JyB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIHRyYWNrc0VkaXRvclZpZXdTdGF0ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaW5wdXQudHlwZUlkID09PSBTZWFyY2hFZGl0b3JJbnB1dFR5cGVJZDtcblx0fVxuXG5cdHByaXZhdGUgcmVzdG9yZVZpZXdTdGF0ZShjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQpIHtcblx0XHRjb25zdCB2aWV3U3RhdGUgPSB0aGlzLmxvYWRFZGl0b3JWaWV3U3RhdGUodGhpcy5nZXRJbnB1dCgpLCBjb250ZXh0KTtcblx0XHRpZiAodmlld1N0YXRlKSB7IHRoaXMuc2VhcmNoUmVzdWx0RWRpdG9yLnJlc3RvcmVWaWV3U3RhdGUodmlld1N0YXRlKTsgfVxuXHR9XG5cblx0Z2V0QXJpYUxhYmVsKCkge1xuXHRcdHJldHVybiB0aGlzLmdldElucHV0KCk/LmdldE5hbWUoKSA/PyBsb2NhbGl6ZSgnc2VhcmNoRWRpdG9yJywgXCJTZWFyY2hcIik7XG5cdH1cbn1cblxuY29uc3Qgc2VhcmNoRWRpdG9yVGV4dElucHV0Qm9yZGVyID0gcmVnaXN0ZXJDb2xvcignc2VhcmNoRWRpdG9yLnRleHRJbnB1dEJvcmRlcicsIGlucHV0Qm9yZGVyLCBsb2NhbGl6ZSgndGV4dElucHV0Qm94Qm9yZGVyJywgXCJTZWFyY2ggZWRpdG9yIHRleHQgaW5wdXQgYm94IGJvcmRlci5cIikpO1xuXG5mdW5jdGlvbiBmaW5kTmV4dFJhbmdlKG1hdGNoUmFuZ2VzOiBSYW5nZVtdLCBjdXJyZW50UG9zaXRpb246IFBvc2l0aW9uKSB7XG5cdGZvciAoY29uc3QgbWF0Y2hSYW5nZSBvZiBtYXRjaFJhbmdlcykge1xuXHRcdGlmIChQb3NpdGlvbi5pc0JlZm9yZShjdXJyZW50UG9zaXRpb24sIG1hdGNoUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKSkge1xuXHRcdFx0cmV0dXJuIG1hdGNoUmFuZ2U7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBtYXRjaFJhbmdlc1swXTtcbn1cblxuZnVuY3Rpb24gZmluZFByZXZSYW5nZShtYXRjaFJhbmdlczogUmFuZ2VbXSwgY3VycmVudFBvc2l0aW9uOiBQb3NpdGlvbikge1xuXHRmb3IgKGxldCBpID0gbWF0Y2hSYW5nZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcblx0XHRjb25zdCBtYXRjaFJhbmdlID0gbWF0Y2hSYW5nZXNbaV07XG5cdFx0aWYgKFBvc2l0aW9uLmlzQmVmb3JlKG1hdGNoUmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpLCBjdXJyZW50UG9zaXRpb24pKSB7XG5cdFx0XHR7XG5cdFx0XHRcdHJldHVybiBtYXRjaFJhbmdlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gbWF0Y2hSYW5nZXNbbWF0Y2hSYW5nZXMubGVuZ3RoIC0gMV07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxlQUFlO0FBRXhCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsdUJBQXVCO0FBRWhDLE9BQU87QUFFUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCLDRCQUE0QjtBQUM3RCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWEscUJBQXFCO0FBQzNDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsK0JBQW1EO0FBRTVELFNBQVMsMkJBQTJCLGlDQUFp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
