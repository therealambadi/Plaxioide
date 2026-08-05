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
import { MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { ObjectTreeElementCollapseState } from "../../../../base/browser/ui/tree/tree.js";
import { Delayer, RunOnceScheduler, Throttler } from "../../../../base/common/async.js";
import * as errors from "../../../../base/common/errors.js";
import { Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import * as env from "../../../../base/common/platform.js";
import * as strings from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import * as network from "../../../../base/common/network.js";
import "./media/searchview.css";
import { getCodeEditor, isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { Selection } from "../../../../editor/common/core/selection.js";
import { CommonFindController } from "../../../../editor/contrib/find/browser/findController.js";
import { MultiCursorSelectionController } from "../../../../editor/contrib/multicursor/browser/multicursor.js";
import * as nls from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { MenuId } from "../../../../platform/actions/common/actions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { FileChangeType, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { getSelectionKeyboardEvent, WorkbenchCompressibleAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService, withSelection } from "../../../../platform/opener/common/opener.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { defaultInputBoxStyles, defaultToggleStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { OpenFileFolderAction, OpenFolderAction } from "../../../browser/actions/workspaceActions.js";
import { ResourceListDnDHandler } from "../../../browser/dnd.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { Memento } from "../../../common/memento.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { NotebookEditor } from "../../notebook/browser/notebookEditor.js";
import { ExcludePatternInputWidget, IncludePatternInputWidget } from "./patternInputWidget.js";
import { appendKeyBindingLabel } from "./searchActionsBase.js";
import { searchDetailsIcon } from "./searchIcons.js";
import { renderSearchMessage } from "./searchMessage.js";
import { FileMatchRenderer, FolderMatchRenderer, MatchRenderer, SearchAccessibilityProvider, SearchDelegate, TextSearchResultRenderer } from "./searchResultsView.js";
import { SearchWidget } from "./searchWidget.js";
import * as Constants from "../common/constants.js";
import { IReplaceService } from "./replace.js";
import { getOutOfWorkspaceEditorResources, SearchStateKey, SearchUIState } from "../common/search.js";
import { ISearchHistoryService, SearchHistoryService } from "../common/searchHistoryService.js";
import { createEditorFromSearchResult } from "../../searchEditor/browser/searchEditorActions.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { ISearchService, SearchCompletionExitCode, SearchSortOrder, TextSearchCompleteMessageType, ViewMode } from "../../../services/search/common/search.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { INotebookService } from "../../notebook/common/notebookService.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ISearchViewModelWorkbenchService } from "./searchTreeModel/searchViewModelWorkbenchService.js";
import { isSearchTreeMatch, SearchModelLocation, isSearchTreeFileMatch, isSearchTreeFolderMatch, isSearchTreeFolderMatchNoRoot, isSearchTreeFolderMatchWithResource, isSearchTreeFolderMatchWorkspaceRoot, isSearchResult, isTextSearchHeading, isSearchHeader } from "./searchTreeModel/searchTreeCommon.js";
import { isIMatchInNotebook } from "./notebookSearch/notebookSearchModelBase.js";
import { searchMatchComparer } from "./searchCompare.js";
import { AIFolderMatchWorkspaceRootImpl } from "./AISearch/aiSearchModel.js";
const $ = dom.$;
var SearchViewPosition = /* @__PURE__ */ ((SearchViewPosition2) => {
  SearchViewPosition2[SearchViewPosition2["SideBar"] = 0] = "SideBar";
  SearchViewPosition2[SearchViewPosition2["Panel"] = 1] = "Panel";
  return SearchViewPosition2;
})(SearchViewPosition || {});
const SEARCH_CANCELLED_MESSAGE = nls.localize("searchCanceled", "Search was canceled before any results could be found - ");
const DEBOUNCE_DELAY = 75;
let SearchView = class extends ViewPane {
  constructor(options, fileService, editorService, codeEditorService, progressService, notificationService, dialogService, commandService, contextViewService, instantiationService, viewDescriptorService, configurationService, contextService, searchViewModelWorkbenchService, contextKeyService, replaceService, textFileService, preferencesService, themeService, searchHistoryService, contextMenuService, accessibilityService, keybindingService, storageService, searchService, openerService, hoverService, notebookService, logService, accessibilitySignalService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.fileService = fileService;
    this.editorService = editorService;
    this.codeEditorService = codeEditorService;
    this.progressService = progressService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.contextViewService = contextViewService;
    this.contextService = contextService;
    this.searchViewModelWorkbenchService = searchViewModelWorkbenchService;
    this.replaceService = replaceService;
    this.textFileService = textFileService;
    this.preferencesService = preferencesService;
    this.searchHistoryService = searchHistoryService;
    this.accessibilityService = accessibilityService;
    this.storageService = storageService;
    this.searchService = searchService;
    this.notebookService = notebookService;
    this.logService = logService;
    this.accessibilitySignalService = accessibilitySignalService;
    this.isDisposed = false;
    this.lastFocusState = "input";
    this.messageDisposables = new DisposableStore();
    this.currentSearchQ = Promise.resolve();
    this.pauseSearching = false;
    this._visibleMatches = 0;
    this.container = dom.$(".search-view");
    this.viewletVisible = Constants.SearchContext.SearchViewVisibleKey.bindTo(this.contextKeyService);
    this.firstMatchFocused = Constants.SearchContext.FirstMatchFocusKey.bindTo(this.contextKeyService);
    this.fileMatchOrMatchFocused = Constants.SearchContext.FileMatchOrMatchFocusKey.bindTo(this.contextKeyService);
    this.fileMatchOrFolderMatchFocus = Constants.SearchContext.FileMatchOrFolderMatchFocusKey.bindTo(this.contextKeyService);
    this.fileMatchOrFolderMatchWithResourceFocus = Constants.SearchContext.FileMatchOrFolderMatchWithResourceFocusKey.bindTo(this.contextKeyService);
    this.fileMatchFocused = Constants.SearchContext.FileFocusKey.bindTo(this.contextKeyService);
    this.folderMatchFocused = Constants.SearchContext.FolderFocusKey.bindTo(this.contextKeyService);
    this.folderMatchWithResourceFocused = Constants.SearchContext.ResourceFolderFocusKey.bindTo(this.contextKeyService);
    this.searchResultHeaderFocused = Constants.SearchContext.SearchResultHeaderFocused.bindTo(this.contextKeyService);
    this.hasSearchResultsKey = Constants.SearchContext.HasSearchResults.bindTo(this.contextKeyService);
    this.matchFocused = Constants.SearchContext.MatchFocusKey.bindTo(this.contextKeyService);
    this.searchStateKey = SearchStateKey.bindTo(this.contextKeyService);
    this.hasSearchPatternKey = Constants.SearchContext.ViewHasSearchPatternKey.bindTo(this.contextKeyService);
    this.hasReplacePatternKey = Constants.SearchContext.ViewHasReplacePatternKey.bindTo(this.contextKeyService);
    this.hasFilePatternKey = Constants.SearchContext.ViewHasFilePatternKey.bindTo(this.contextKeyService);
    this.hasSomeCollapsibleResultKey = Constants.SearchContext.ViewHasSomeCollapsibleKey.bindTo(this.contextKeyService);
    this.treeViewKey = Constants.SearchContext.InTreeViewKey.bindTo(this.contextKeyService);
    this.refreshTreeController = this._register(this.instantiationService.createInstance(RefreshTreeController, this, () => this.searchConfig));
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      const keys = Constants.SearchContext.hasAIResultProvider.keys();
      if (e.affectsSome(new Set(keys))) {
        this.refreshHasAISetting();
      }
    }));
    this.contextKeyService = this._register(this.contextKeyService.createScoped(this.container));
    Constants.SearchContext.SearchViewFocusedKey.bindTo(this.contextKeyService).set(true);
    this.inputBoxFocused = Constants.SearchContext.InputBoxFocusedKey.bindTo(this.contextKeyService);
    this.inputPatternIncludesFocused = Constants.SearchContext.PatternIncludesFocusedKey.bindTo(this.contextKeyService);
    this.inputPatternExclusionsFocused = Constants.SearchContext.PatternExcludesFocusedKey.bindTo(this.contextKeyService);
    this.isEditableItem = Constants.SearchContext.IsEditableItemKey.bindTo(this.contextKeyService);
    this.instantiationService = this._register(this.instantiationService.createChild(
      new ServiceCollection([IContextKeyService, this.contextKeyService])
    ));
    this._register(this.configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("search.sortOrder")) {
        if (this.searchConfig.sortOrder === SearchSortOrder.Modified) {
          this.removeFileStats();
        }
        await this.refreshTreeController.queue();
      }
    }));
    this.viewModel = this.searchViewModelWorkbenchService.searchModel;
    this.queryBuilder = this.instantiationService.createInstance(QueryBuilder);
    this.memento = new Memento(this.id, storageService);
    this.viewletState = this.memento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    this._register(this.fileService.onDidFilesChange((e) => this.onFilesChanged(e)));
    this._register(this.textFileService.untitled.onWillDispose((model) => this.onUntitledDidDispose(model.resource)));
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.onDidChangeWorkbenchState()));
    this._register(this.searchHistoryService.onDidClearHistory(() => this.clearHistory()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onConfigurationUpdated(e)));
    this.delayedRefresh = this._register(new Delayer(250));
    this.addToSearchHistoryDelayer = this._register(new Delayer(2e3));
    this.toggleCollapseStateDelayer = this._register(new Delayer(100));
    this.triggerQueryDelayer = this._register(new Delayer(0));
    this.treeAccessibilityProvider = this.instantiationService.createInstance(SearchAccessibilityProvider, this);
    this.isTreeLayoutViewVisible = this.viewletState["view.treeLayout"] ?? this.searchConfig.defaultViewMode === ViewMode.Tree;
    this._refreshResultsScheduler = this._register(new RunOnceScheduler(this._updateResults.bind(this), 80));
    this._register(this.storageService.onWillSaveState(() => {
      this._saveSearchHistoryService();
    }));
    this._register(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, SearchHistoryService.SEARCH_HISTORY_KEY, this._store)(() => {
      const restoredHistory = this.searchHistoryService.load();
      if (restoredHistory.include) {
        this.inputPatternIncludes.prependHistory(restoredHistory.include);
      }
      if (restoredHistory.exclude) {
        this.inputPatternExcludes.prependHistory(restoredHistory.exclude);
      }
      if (restoredHistory.search) {
        this.searchWidget.prependSearchHistory(restoredHistory.search);
      }
      if (restoredHistory.replace) {
        this.searchWidget.prependReplaceHistory(restoredHistory.replace);
      }
    }));
    this.changedWhileHidden = this.hasSearchResults();
  }
  async queueRefreshTree() {
    return this.refreshTreeController.queue();
  }
  get isTreeLayoutViewVisible() {
    return this.treeViewKey.get() ?? false;
  }
  set isTreeLayoutViewVisible(visible) {
    this.treeViewKey.set(visible);
  }
  async setTreeView(visible) {
    if (visible === this.isTreeLayoutViewVisible) {
      return;
    }
    this.isTreeLayoutViewVisible = visible;
    this.updateIndentStyles(this.themeService.getFileIconTheme());
    return this.refreshTreeController.queue();
  }
  get state() {
    return this.searchStateKey.get() ?? SearchUIState.Idle;
  }
  set state(v) {
    this.searchStateKey.set(v);
  }
  getContainer() {
    return this.container;
  }
  get searchResult() {
    return this.viewModel && this.viewModel.searchResult;
  }
  get model() {
    return this.viewModel;
  }
  async refreshHasAISetting() {
    const shouldShowAI = this.shouldShowAIResults();
    if (!this.tree.hasNode(this.searchResult)) {
      return;
    }
    if (shouldShowAI && !this.tree.hasNode(this.searchResult.aiTextSearchResult)) {
      if (this.model.searchResult.getCachedSearchComplete(false)) {
        return this.refreshAndUpdateCount();
      }
    } else if (!shouldShowAI && this.tree.hasNode(this.searchResult.aiTextSearchResult)) {
      return this.refreshAndUpdateCount();
    }
  }
  onDidChangeWorkbenchState() {
    if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.searchWithoutFolderMessageElement) {
      dom.hide(this.searchWithoutFolderMessageElement);
    }
  }
  refreshInputs() {
    this.pauseSearching = true;
    this.searchWidget.setValue(this.viewModel.searchResult.query?.contentPattern.pattern ?? "");
    this.searchWidget.setReplaceAllActionState(false);
    this.searchWidget.toggleReplace(true);
    this.inputPatternIncludes.setOnlySearchInOpenEditors(this.viewModel.searchResult.query?.onlyOpenEditors || false);
    this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(!this.viewModel.searchResult.query?.userDisabledExcludesAndIgnoreFiles || true);
    this.searchIncludePattern.setValue("");
    this.searchExcludePattern.setValue("");
    this.pauseSearching = false;
  }
  async replaceSearchModel(searchModel, asyncResults) {
    let progressComplete;
    this.progressService.withProgress({ location: this.getProgressLocation(), delay: 0 }, (_progress) => {
      return new Promise((resolve) => progressComplete = resolve);
    });
    const slowTimer = setTimeout(() => {
      this.state = SearchUIState.SlowSearch;
    }, 2e3);
    this._refreshResultsScheduler.schedule();
    searchModel.location = SearchModelLocation.PANEL;
    searchModel.replaceActive = this.viewModel.isReplaceActive();
    searchModel.replaceString = this.searchWidget.getReplaceValue();
    this._onSearchResultChangedDisposable?.dispose();
    this._onSearchResultChangedDisposable = this._register(searchModel.onSearchResultChanged(async (event) => this.onSearchResultsChanged(event)));
    this.searchViewModelWorkbenchService.searchModel = searchModel;
    this.viewModel = searchModel;
    this.tree.setInput(this.viewModel.searchResult);
    await this.onSearchResultsChanged();
    this.refreshInputs();
    asyncResults.then((complete) => {
      clearTimeout(slowTimer);
      return this.onSearchComplete(progressComplete, void 0, void 0, complete);
    }, (e) => {
      clearTimeout(slowTimer);
      return this.onSearchError(e, progressComplete, void 0, void 0);
    });
    await this.expandIfSingularResult();
  }
  renderBody(parent) {
    super.renderBody(parent);
    this.container = dom.append(parent, dom.$(".search-view"));
    this.searchWidgetsContainerElement = dom.append(this.container, $(".search-widgets-container"));
    this.createSearchWidget(this.searchWidgetsContainerElement);
    const history = this.searchHistoryService.load();
    const filePatterns = this.viewletState["query.filePatterns"] || "";
    const patternExclusions = this.viewletState["query.folderExclusions"] || "";
    const patternExclusionsHistory = history.exclude || [];
    const patternIncludes = this.viewletState["query.folderIncludes"] || "";
    const patternIncludesHistory = history.include || [];
    const onlyOpenEditors = this.viewletState["query.onlyOpenEditors"] || false;
    const queryDetailsExpanded = this.viewletState["query.queryDetailsExpanded"] || "";
    const useExcludesAndIgnoreFiles = typeof this.viewletState["query.useExcludesAndIgnoreFiles"] === "boolean" ? this.viewletState["query.useExcludesAndIgnoreFiles"] : true;
    this.queryDetails = dom.append(this.searchWidgetsContainerElement, $(".query-details"));
    const toggleQueryDetailsLabel = nls.localize("moreSearch", "Toggle Search Details");
    this.toggleQueryDetailsButton = dom.append(
      this.queryDetails,
      $(".more" + ThemeIcon.asCSSSelector(searchDetailsIcon), { tabindex: 0, role: "button", "aria-label": toggleQueryDetailsLabel })
    );
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("element"), this.toggleQueryDetailsButton, toggleQueryDetailsLabel));
    this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.CLICK, (e) => {
      dom.EventHelper.stop(e);
      this.toggleQueryDetails(!this.accessibilityService.isScreenReaderOptimized());
    }));
    this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        dom.EventHelper.stop(e);
        this.toggleQueryDetails(false);
      }
    }));
    this._register(dom.addDisposableListener(this.toggleQueryDetailsButton, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
        if (this.searchWidget.isReplaceActive()) {
          this.searchWidget.focusReplaceAllAction();
        } else {
          this.searchWidget.isReplaceShown() ? this.searchWidget.replaceInput?.focusOnPreserve() : this.searchWidget.focusRegexAction();
        }
        dom.EventHelper.stop(e);
      }
    }));
    const folderIncludesList = dom.append(this.queryDetails, $(".file-types.includes"));
    const filesToIncludeTitle = nls.localize("searchScope.includes", "files to include");
    dom.append(folderIncludesList, $("h4", void 0, filesToIncludeTitle));
    this.inputPatternIncludes = this._register(this.instantiationService.createInstance(IncludePatternInputWidget, folderIncludesList, this.contextViewService, {
      ariaLabel: filesToIncludeTitle,
      placeholder: nls.localize("placeholder.includes", "e.g. *.ts, src/**/include"),
      showPlaceholderOnFocus: true,
      history: patternIncludesHistory,
      inputBoxStyles: defaultInputBoxStyles
    }));
    this.inputPatternIncludes.setValue(patternIncludes);
    this.inputPatternIncludes.setOnlySearchInOpenEditors(onlyOpenEditors);
    this._register(this.inputPatternIncludes.onCancel(() => this.cancelSearch(false)));
    this._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerQueryChange()));
    this.trackInputBox(this.inputPatternIncludes.inputFocusTracker, this.inputPatternIncludesFocused);
    const excludesList = dom.append(this.queryDetails, $(".file-types.excludes"));
    const excludesTitle = nls.localize("searchScope.excludes", "files to exclude");
    dom.append(excludesList, $("h4", void 0, excludesTitle));
    this.inputPatternExcludes = this._register(this.instantiationService.createInstance(ExcludePatternInputWidget, excludesList, this.contextViewService, {
      ariaLabel: excludesTitle,
      placeholder: nls.localize("placeholder.excludes", "e.g. *.ts, src/**/exclude"),
      showPlaceholderOnFocus: true,
      history: patternExclusionsHistory,
      inputBoxStyles: defaultInputBoxStyles
    }));
    this.inputPatternExcludes.setValue(patternExclusions);
    this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(useExcludesAndIgnoreFiles);
    this._register(this.inputPatternExcludes.onCancel(() => this.cancelSearch(false)));
    this._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerQueryChange()));
    this.trackInputBox(this.inputPatternExcludes.inputFocusTracker, this.inputPatternExclusionsFocused);
    const updateHasFilePatternKey = () => this.hasFilePatternKey.set(this.inputPatternIncludes.getValue().length > 0 || this.inputPatternExcludes.getValue().length > 0);
    updateHasFilePatternKey();
    const onFilePatternSubmit = (triggeredOnType) => {
      this.triggerQueryChange({ triggeredOnType, delay: this.searchConfig.searchOnTypeDebouncePeriod });
      if (triggeredOnType) {
        updateHasFilePatternKey();
      }
    };
    this._register(this.inputPatternIncludes.onSubmit(onFilePatternSubmit));
    this._register(this.inputPatternExcludes.onSubmit(onFilePatternSubmit));
    this.messagesElement = dom.append(this.container, $(".messages.text-search-provider-messages"));
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      this.showSearchWithoutFolderMessage();
    }
    this.createSearchResultsView(this.container);
    if (filePatterns !== "" || patternExclusions !== "" || patternIncludes !== "" || queryDetailsExpanded !== "" || !useExcludesAndIgnoreFiles) {
      this.toggleQueryDetails(true, true, true);
    }
    this._onSearchResultChangedDisposable = this._register(this.viewModel.onSearchResultChanged(async (event) => await this.onSearchResultsChanged(event)));
    this._register(this.onDidChangeBodyVisibility((visible) => this.onVisibilityChanged(visible)));
    this.updateIndentStyles(this.themeService.getFileIconTheme());
    this._register(this.themeService.onDidFileIconThemeChange(this.updateIndentStyles, this));
  }
  updateIndentStyles(theme) {
    this.resultsElement.classList.toggle("hide-arrows", this.isTreeLayoutViewVisible && theme.hidesExplorerArrows);
  }
  async onVisibilityChanged(visible) {
    this.viewletVisible.set(visible);
    if (visible) {
      if (this.changedWhileHidden) {
        await this.refreshAndUpdateCount();
        this.changedWhileHidden = false;
      }
    } else {
      this.lastFocusState = "input";
    }
    this.viewModel?.searchResult.toggleHighlights(visible);
  }
  get searchAndReplaceWidget() {
    return this.searchWidget;
  }
  get searchIncludePattern() {
    return this.inputPatternIncludes;
  }
  get searchExcludePattern() {
    return this.inputPatternExcludes;
  }
  createSearchWidget(container) {
    const contentPattern = this.viewletState["query.contentPattern"] || "";
    const replaceText = this.viewletState["query.replaceText"] || "";
    const isRegex = this.viewletState["query.regex"] === true;
    const isWholeWords = this.viewletState["query.wholeWords"] === true;
    const isCaseSensitive = this.viewletState["query.caseSensitive"] === true;
    const history = this.searchHistoryService.load();
    const searchHistory = history.search || this.viewletState["query.searchHistory"] || [];
    const replaceHistory = history.replace || this.viewletState["query.replaceHistory"] || [];
    const showReplace = typeof this.viewletState["view.showReplace"] === "boolean" ? this.viewletState["view.showReplace"] : true;
    const preserveCase = this.viewletState["query.preserveCase"] === true;
    const isInNotebookMarkdownInput = this.viewletState["query.isInNotebookMarkdownInput"] ?? true;
    const isInNotebookMarkdownPreview = this.viewletState["query.isInNotebookMarkdownPreview"] ?? true;
    const isInNotebookCellInput = this.viewletState["query.isInNotebookCellInput"] ?? true;
    const isInNotebookCellOutput = this.viewletState["query.isInNotebookCellOutput"] ?? true;
    this.searchWidget = this._register(this.instantiationService.createInstance(SearchWidget, container, {
      value: contentPattern,
      replaceValue: replaceText,
      isRegex,
      isCaseSensitive,
      isWholeWords,
      searchHistory,
      replaceHistory,
      preserveCase,
      inputBoxStyles: defaultInputBoxStyles,
      toggleStyles: defaultToggleStyles,
      notebookOptions: {
        isInNotebookMarkdownInput,
        isInNotebookMarkdownPreview,
        isInNotebookCellInput,
        isInNotebookCellOutput
      }
    }));
    if (!this.searchWidget.searchInput || !this.searchWidget.replaceInput) {
      this.logService.warn(`Cannot fully create search widget. Search or replace input undefined. SearchInput: ${this.searchWidget.searchInput}, ReplaceInput: ${this.searchWidget.replaceInput}`);
      return;
    }
    if (showReplace) {
      this.searchWidget.toggleReplace(true);
    }
    this._register(this.searchWidget.onSearchSubmit((options) => this.triggerQueryChange(options)));
    this._register(this.searchWidget.onSearchCancel(({ focus }) => this.cancelSearch(focus)));
    this._register(this.searchWidget.searchInput.onDidOptionChange(() => {
      this.triggerQueryChange({ shouldKeepAIResults: true });
    }));
    this._register(this.searchWidget.getNotebookFilters().onDidChange(() => this.triggerQueryChange({ shouldKeepAIResults: true })));
    const updateHasPatternKey = () => this.hasSearchPatternKey.set(this.searchWidget.searchInput ? this.searchWidget.searchInput.getValue().length > 0 : false);
    updateHasPatternKey();
    this._register(this.searchWidget.searchInput.onDidChange(() => updateHasPatternKey()));
    const updateHasReplacePatternKey = () => this.hasReplacePatternKey.set(this.searchWidget.getReplaceValue().length > 0);
    updateHasReplacePatternKey();
    this._register(this.searchWidget.replaceInput.inputBox.onDidChange(() => updateHasReplacePatternKey()));
    this._register(this.searchWidget.onDidHeightChange(() => this.reLayout()));
    this._register(this.searchWidget.onReplaceToggled(() => this.reLayout()));
    this._register(this.searchWidget.onReplaceStateChange(async (state) => {
      this.viewModel.replaceActive = state;
      await this.refreshTreeController.queue();
    }));
    this._register(this.searchWidget.onPreserveCaseChange(async (state) => {
      this.viewModel.preserveCase = state;
      await this.refreshTreeController.queue();
    }));
    this._register(this.searchWidget.onReplaceValueChanged(() => {
      this.viewModel.replaceString = this.searchWidget.getReplaceValue();
      this.delayedRefresh.trigger(async () => this.refreshTreeController.queue());
    }));
    this._register(this.searchWidget.onBlur(() => {
      this.toggleQueryDetailsButton.focus();
    }));
    this._register(this.searchWidget.onReplaceAll(() => this.replaceAll()));
    this.trackInputBox(this.searchWidget.searchInputFocusTracker);
    this.trackInputBox(this.searchWidget.replaceInputFocusTracker);
  }
  shouldShowAIResults() {
    const hasProvider = Constants.SearchContext.hasAIResultProvider.getValue(this.contextKeyService);
    return !!hasProvider;
  }
  async onConfigurationUpdated(event) {
    if (event && (event.affectsConfiguration("search.decorations.colors") || event.affectsConfiguration("search.decorations.badges"))) {
      return this.refreshTreeController.queue();
    }
  }
  trackInputBox(inputFocusTracker, contextKey) {
    if (!inputFocusTracker) {
      return;
    }
    this._register(inputFocusTracker.onDidFocus(() => {
      this.lastFocusState = "input";
      this.inputBoxFocused.set(true);
      contextKey?.set(true);
    }));
    this._register(inputFocusTracker.onDidBlur(() => {
      this.inputBoxFocused.set(this.searchWidget.searchInputHasFocus() || this.searchWidget.replaceInputHasFocus() || this.inputPatternIncludes.inputHasFocus() || this.inputPatternExcludes.inputHasFocus());
      contextKey?.set(false);
    }));
  }
  async onSearchResultsChanged(event) {
    if (this.isVisible()) {
      return this.refreshAndUpdateCount(event);
    } else {
      this.changedWhileHidden = true;
    }
  }
  async refreshAndUpdateCount(event) {
    this.searchWidget.setReplaceAllActionState(!this.viewModel.searchResult.isEmpty());
    this.updateSearchResultCount(this.viewModel.searchResult.query.userDisabledExcludesAndIgnoreFiles, this.viewModel.searchResult.query?.onlyOpenEditors, event?.clearingAll);
    return this.refreshTreeController.queue(event);
  }
  originalShouldCollapse(match) {
    const collapseResults = this.searchConfig.collapseResults;
    return collapseResults === "alwaysCollapse" || !isSearchTreeMatch(match) && match.count() > 10 && collapseResults !== "alwaysExpand" ? ObjectTreeElementCollapseState.PreserveOrCollapsed : ObjectTreeElementCollapseState.PreserveOrExpanded;
  }
  shouldCollapseAccordingToConfig(match) {
    const collapseResults = this.originalShouldCollapse(match);
    if (collapseResults === ObjectTreeElementCollapseState.PreserveOrCollapsed) {
      return true;
    }
    return false;
  }
  replaceAll() {
    if (this.viewModel.searchResult.count() === 0) {
      return;
    }
    const occurrences = this.viewModel.searchResult.count();
    const fileCount = this.viewModel.searchResult.fileCount();
    const replaceValue = this.searchWidget.getReplaceValue() || "";
    const afterReplaceAllMessage = this.buildAfterReplaceAllMessage(occurrences, fileCount, replaceValue);
    let progressComplete;
    let progressReporter;
    this.progressService.withProgress({ location: this.getProgressLocation(), delay: 100, total: occurrences }, (p) => {
      progressReporter = p;
      return new Promise((resolve) => progressComplete = resolve);
    });
    const confirmation = {
      title: nls.localize("replaceAll.confirmation.title", "Replace All"),
      message: this.buildReplaceAllConfirmationMessage(occurrences, fileCount, replaceValue),
      primaryButton: nls.localize({ key: "replaceAll.confirm.button", comment: ["&& denotes a mnemonic"] }, "&&Replace")
    };
    this.dialogService.confirm(confirmation).then((res) => {
      if (res.confirmed) {
        this.searchWidget.setReplaceAllActionState(false);
        this.viewModel.searchResult.replaceAll(progressReporter).then(() => {
          progressComplete();
          const messageEl = this.clearMessage();
          dom.append(messageEl, afterReplaceAllMessage);
          this.reLayout();
        }, (error) => {
          progressComplete();
          errors.isCancellationError(error);
          this.notificationService.error(error);
        });
      } else {
        progressComplete();
      }
    });
  }
  buildAfterReplaceAllMessage(occurrences, fileCount, replaceValue) {
    if (occurrences === 1) {
      if (fileCount === 1) {
        if (replaceValue) {
          return nls.localize("replaceAll.occurrence.file.message", "Replaced {0} occurrence across {1} file with '{2}'.", occurrences, fileCount, replaceValue);
        }
        return nls.localize("removeAll.occurrence.file.message", "Replaced {0} occurrence across {1} file.", occurrences, fileCount);
      }
      if (replaceValue) {
        return nls.localize("replaceAll.occurrence.files.message", "Replaced {0} occurrence across {1} files with '{2}'.", occurrences, fileCount, replaceValue);
      }
      return nls.localize("removeAll.occurrence.files.message", "Replaced {0} occurrence across {1} files.", occurrences, fileCount);
    }
    if (fileCount === 1) {
      if (replaceValue) {
        return nls.localize("replaceAll.occurrences.file.message", "Replaced {0} occurrences across {1} file with '{2}'.", occurrences, fileCount, replaceValue);
      }
      return nls.localize("removeAll.occurrences.file.message", "Replaced {0} occurrences across {1} file.", occurrences, fileCount);
    }
    if (replaceValue) {
      return nls.localize("replaceAll.occurrences.files.message", "Replaced {0} occurrences across {1} files with '{2}'.", occurrences, fileCount, replaceValue);
    }
    return nls.localize("removeAll.occurrences.files.message", "Replaced {0} occurrences across {1} files.", occurrences, fileCount);
  }
  buildReplaceAllConfirmationMessage(occurrences, fileCount, replaceValue) {
    if (occurrences === 1) {
      if (fileCount === 1) {
        if (replaceValue) {
          return nls.localize("removeAll.occurrence.file.confirmation.message", "Replace {0} occurrence across {1} file with '{2}'?", occurrences, fileCount, replaceValue);
        }
        return nls.localize("replaceAll.occurrence.file.confirmation.message", "Replace {0} occurrence across {1} file?", occurrences, fileCount);
      }
      if (replaceValue) {
        return nls.localize("removeAll.occurrence.files.confirmation.message", "Replace {0} occurrence across {1} files with '{2}'?", occurrences, fileCount, replaceValue);
      }
      return nls.localize("replaceAll.occurrence.files.confirmation.message", "Replace {0} occurrence across {1} files?", occurrences, fileCount);
    }
    if (fileCount === 1) {
      if (replaceValue) {
        return nls.localize("removeAll.occurrences.file.confirmation.message", "Replace {0} occurrences across {1} file with '{2}'?", occurrences, fileCount, replaceValue);
      }
      return nls.localize("replaceAll.occurrences.file.confirmation.message", "Replace {0} occurrences across {1} file?", occurrences, fileCount);
    }
    if (replaceValue) {
      return nls.localize("removeAll.occurrences.files.confirmation.message", "Replace {0} occurrences across {1} files with '{2}'?", occurrences, fileCount, replaceValue);
    }
    return nls.localize("replaceAll.occurrences.files.confirmation.message", "Replace {0} occurrences across {1} files?", occurrences, fileCount);
  }
  clearMessage() {
    this.searchWithoutFolderMessageElement = void 0;
    const wasHidden = this.messagesElement.style.display === "none";
    dom.clearNode(this.messagesElement);
    dom.show(this.messagesElement);
    this.messageDisposables.clear();
    const newMessage = dom.append(this.messagesElement, $(".message"));
    if (wasHidden) {
      this.reLayout();
    }
    return newMessage;
  }
  createSearchResultsView(container) {
    this.resultsElement = dom.append(container, $(".results.show-file-icons.file-icon-themable-tree"));
    const delegate = this.instantiationService.createInstance(SearchDelegate);
    const identityProvider = {
      getId(element) {
        return element.id();
      }
    };
    this.searchDataSource = this.instantiationService.createInstance(SearchViewDataSource, this);
    this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
    this.tree = this._register(this.instantiationService.createInstance(
      WorkbenchCompressibleAsyncDataTree,
      "SearchView",
      this.resultsElement,
      delegate,
      {
        isIncompressible: (element) => {
          if (isSearchTreeFolderMatch(element) && !isTextSearchHeading(element.parent()) && !isSearchTreeFolderMatchWorkspaceRoot(element.parent()) && !isSearchTreeFolderMatchNoRoot(element.parent())) {
            return false;
          }
          return true;
        }
      },
      [
        this._register(this.instantiationService.createInstance(FolderMatchRenderer, this, this.treeLabels)),
        this._register(this.instantiationService.createInstance(FileMatchRenderer, this, this.treeLabels)),
        this._register(this.instantiationService.createInstance(TextSearchResultRenderer, this.treeLabels)),
        this._register(this.instantiationService.createInstance(MatchRenderer, this))
      ],
      this.searchDataSource,
      {
        identityProvider,
        accessibilityProvider: this.treeAccessibilityProvider,
        dnd: this.instantiationService.createInstance(ResourceListDnDHandler, (element) => {
          if (isSearchTreeFileMatch(element)) {
            return element.resource;
          }
          if (isSearchTreeMatch(element)) {
            return withSelection(element.parent().resource, element.range());
          }
          return null;
        }),
        multipleSelectionSupport: true,
        selectionNavigation: true,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles,
        paddingBottom: SearchDelegate.ITEM_HEIGHT,
        collapseByDefault: (e) => {
          if (isTextSearchHeading(e)) {
            return e.isAIContributed;
          }
          if (isSearchTreeFolderMatch(e) && e.matches().length === 1 && isSearchTreeFolderMatch(e.matches()[0])) {
            return false;
          }
          return this.shouldCollapseAccordingToConfig(e);
        }
      }
    ));
    Constants.SearchContext.SearchResultListFocusedKey.bindTo(this.tree.contextKeyService);
    this.tree.setInput(this.viewModel.searchResult);
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(e)));
    const updateHasSomeCollapsible = () => this.toggleCollapseStateDelayer.trigger(() => this.hasSomeCollapsibleResultKey.set(this.hasSomeCollapsible()));
    updateHasSomeCollapsible();
    this._register(this.tree.onDidChangeCollapseState(() => updateHasSomeCollapsible()));
    this._register(this.tree.onDidChangeModel(() => updateHasSomeCollapsible()));
    this._register(Event.debounce(this.tree.onDidOpen, (last, event) => event, DEBOUNCE_DELAY, true)((options) => {
      if (isSearchTreeMatch(options.element)) {
        const selectedMatch = options.element;
        this.currentSelectedFileMatch?.setSelectedMatch(null);
        this.currentSelectedFileMatch = selectedMatch.parent();
        this.currentSelectedFileMatch.setSelectedMatch(selectedMatch);
        this.onFocus(selectedMatch, options.editorOptions.preserveFocus, options.sideBySide, options.editorOptions.pinned);
      }
    }));
    this._register(Event.debounce(this.tree.onDidChangeFocus, (last, event) => event, DEBOUNCE_DELAY, true)(() => {
      const selection = this.tree.getSelection();
      const focus = this.tree.getFocus()[0];
      if (selection.length > 1 && isSearchTreeMatch(focus)) {
        this.onFocus(focus, true);
      }
    }));
    this._register(Event.any(this.tree.onDidFocus, this.tree.onDidChangeFocus)(() => {
      const focus = this.tree.getFocus()[0];
      if (this.tree.isDOMFocused()) {
        const firstElem = this.tree.getFirstElementChild(this.tree.getInput());
        this.firstMatchFocused.set(firstElem === focus);
        this.fileMatchOrMatchFocused.set(!!focus);
        this.fileMatchFocused.set(isSearchTreeFileMatch(focus));
        this.folderMatchFocused.set(isSearchTreeFolderMatch(focus));
        this.matchFocused.set(isSearchTreeMatch(focus));
        this.fileMatchOrFolderMatchFocus.set(isSearchTreeFileMatch(focus) || isSearchTreeFolderMatch(focus));
        this.fileMatchOrFolderMatchWithResourceFocus.set(isSearchTreeFileMatch(focus) || isSearchTreeFolderMatchWithResource(focus));
        this.folderMatchWithResourceFocused.set(isSearchTreeFolderMatchWithResource(focus));
        this.searchResultHeaderFocused.set(isSearchHeader(focus));
        this.lastFocusState = "tree";
      }
      let editable = false;
      if (isSearchTreeMatch(focus)) {
        editable = !focus.isReadonly;
      } else if (isSearchTreeFileMatch(focus)) {
        editable = !focus.hasOnlyReadOnlyMatches();
      } else if (isSearchTreeFolderMatch(focus)) {
        editable = !focus.hasOnlyReadOnlyMatches();
      }
      this.isEditableItem.set(editable);
    }));
    this._register(this.tree.onDidBlur(() => {
      this.firstMatchFocused.reset();
      this.fileMatchOrMatchFocused.reset();
      this.fileMatchFocused.reset();
      this.folderMatchFocused.reset();
      this.matchFocused.reset();
      this.fileMatchOrFolderMatchFocus.reset();
      this.fileMatchOrFolderMatchWithResourceFocus.reset();
      this.folderMatchWithResourceFocused.reset();
      this.searchResultHeaderFocused.reset();
      this.isEditableItem.reset();
    }));
  }
  onContextMenu(e) {
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
    const selection = this.tree.getSelection();
    let arg;
    let context;
    if (selection && selection.length > 0) {
      arg = e.element;
      context = selection;
    } else {
      context = e.element;
    }
    this.contextMenuService.showContextMenu({
      menuId: MenuId.SearchContext,
      menuActionOptions: { shouldForwardArgs: true, arg },
      contextKeyService: this.contextKeyService,
      getAnchor: () => e.anchor,
      getActionsContext: () => context
    });
  }
  hasSomeCollapsible() {
    const viewer = this.getControl();
    const navigator = viewer.navigate();
    let node = navigator.first();
    const shouldShowAI = this.shouldShowAIResults();
    do {
      if (node && !viewer.isCollapsed(node) && (!shouldShowAI || !isTextSearchHeading(node))) {
        return true;
      }
    } while (node = navigator.next());
    return false;
  }
  async selectNextMatch() {
    if (!this.hasSearchResults()) {
      return;
    }
    const [selected] = this.tree.getSelection();
    if (selected && !isSearchTreeMatch(selected)) {
      if (this.tree.isCollapsed(selected)) {
        await this.tree.expand(selected);
      }
    }
    const navigator = this.tree.navigate(selected);
    let next = navigator.next();
    if (!next) {
      next = navigator.first();
    }
    while (next && !isSearchTreeMatch(next)) {
      if (this.tree.isCollapsed(next)) {
        await this.tree.expand(next);
      }
      next = navigator.next();
    }
    if (next) {
      if (next === selected) {
        this.tree.setFocus([]);
      }
      const event = getSelectionKeyboardEvent(void 0, false, false);
      this.tree.setFocus([next], event);
      this.tree.setSelection([next], event);
      this.tree.reveal(next);
      const ariaLabel = this.treeAccessibilityProvider.getAriaLabel(next);
      if (ariaLabel) {
        aria.status(ariaLabel);
      }
    }
  }
  async selectPreviousMatch() {
    if (!this.hasSearchResults()) {
      return;
    }
    const [selected] = this.tree.getSelection();
    let navigator = this.tree.navigate(selected);
    let prev = navigator.previous();
    while (!prev || !isSearchTreeMatch(prev) && !this.tree.isCollapsed(prev)) {
      const nextPrev = prev ? navigator.previous() : navigator.last();
      if (!prev && !nextPrev) {
        return;
      }
      prev = nextPrev;
    }
    while (prev && !isSearchTreeMatch(prev)) {
      const nextItem = navigator.next();
      if (!nextItem) {
        break;
      }
      await this.tree.expand(prev);
      navigator = this.tree.navigate(nextItem);
      prev = nextItem ? navigator.previous() : navigator.last();
    }
    if (prev) {
      if (prev === selected) {
        this.tree.setFocus([]);
      }
      const event = getSelectionKeyboardEvent(void 0, false, false);
      this.tree.setFocus([prev], event);
      this.tree.setSelection([prev], event);
      this.tree.reveal(prev);
      const ariaLabel = this.treeAccessibilityProvider.getAriaLabel(prev);
      if (ariaLabel) {
        aria.status(ariaLabel);
      }
    }
  }
  moveFocusToResults() {
    this.tree.domFocus();
  }
  focus() {
    super.focus();
    if (this.lastFocusState === "input" || !this.hasSearchResults()) {
      const updatedText = this.searchConfig.seedOnFocus ? this.updateTextFromSelection({ allowSearchOnType: false }) : false;
      this.searchWidget.focus(void 0, void 0, updatedText);
    } else {
      this.tree.domFocus();
    }
  }
  updateTextFromFindWidgetOrSelection({ allowUnselectedWord = true, allowSearchOnType = true }) {
    let activeEditor = this.editorService.activeTextEditorControl;
    if (isCodeEditor(activeEditor) && !activeEditor?.hasTextFocus()) {
      const controller = CommonFindController.get(activeEditor);
      if (controller && controller.isFindInputFocused()) {
        return this.updateTextFromFindWidget(controller, { allowSearchOnType });
      }
      const editors = this.codeEditorService.listCodeEditors();
      activeEditor = editors.find((editor) => editor instanceof EmbeddedCodeEditorWidget && editor.getParentEditor() === activeEditor && editor.hasTextFocus()) ?? activeEditor;
    }
    return this.updateTextFromSelection({ allowUnselectedWord, allowSearchOnType }, activeEditor);
  }
  updateTextFromFindWidget(controller, { allowSearchOnType = true }) {
    if (!this.searchConfig.seedWithNearestWord && (dom.getActiveWindow().getSelection()?.toString() ?? "") === "") {
      return false;
    }
    const searchString = controller.getState().searchString;
    if (searchString === "") {
      return false;
    }
    this.searchWidget.searchInput?.setCaseSensitive(controller.getState().matchCase);
    this.searchWidget.searchInput?.setWholeWords(controller.getState().wholeWord);
    this.searchWidget.searchInput?.setRegex(controller.getState().isRegex);
    this.updateText(searchString, allowSearchOnType);
    return true;
  }
  updateTextFromSelection({ allowUnselectedWord = true, allowSearchOnType = true }, editor) {
    const seedSearchStringFromSelection = this.configurationService.getValue("editor").find.seedSearchStringFromSelection;
    if (!seedSearchStringFromSelection || seedSearchStringFromSelection === "never") {
      return false;
    }
    let selectedText = this.getSearchTextFromEditor(allowUnselectedWord, editor);
    if (selectedText === null) {
      return false;
    }
    if (this.searchWidget.searchInput?.getRegex()) {
      selectedText = strings.escapeRegExpCharacters(selectedText);
    }
    this.updateText(selectedText, allowSearchOnType);
    return true;
  }
  updateText(text, allowSearchOnType = true) {
    if (allowSearchOnType && !this.viewModel.searchResult.isDirty) {
      this.searchWidget.setValue(text);
    } else {
      this.pauseSearching = true;
      this.searchWidget.setValue(text);
      this.pauseSearching = false;
    }
  }
  focusNextInputBox() {
    if (this.searchWidget.searchInputHasFocus()) {
      if (this.searchWidget.isReplaceShown()) {
        this.searchWidget.focus(true, true);
      } else {
        this.moveFocusFromSearchOrReplace();
      }
      return;
    }
    if (this.searchWidget.replaceInputHasFocus()) {
      this.moveFocusFromSearchOrReplace();
      return;
    }
    if (this.inputPatternIncludes.inputHasFocus()) {
      this.inputPatternExcludes.focus();
      this.inputPatternExcludes.select();
      return;
    }
    if (this.inputPatternExcludes.inputHasFocus()) {
      this.selectTreeIfNotSelected();
      return;
    }
  }
  moveFocusFromSearchOrReplace() {
    if (this.showsFileTypes()) {
      this.toggleQueryDetails(true, this.showsFileTypes());
    } else {
      this.selectTreeIfNotSelected();
    }
  }
  focusPreviousInputBox() {
    if (this.searchWidget.searchInputHasFocus()) {
      return;
    }
    if (this.searchWidget.replaceInputHasFocus()) {
      this.searchWidget.focus(true);
      return;
    }
    if (this.inputPatternIncludes.inputHasFocus()) {
      this.searchWidget.focus(true, true);
      return;
    }
    if (this.inputPatternExcludes.inputHasFocus()) {
      this.inputPatternIncludes.focus();
      this.inputPatternIncludes.select();
      return;
    }
    if (this.tree.isDOMFocused()) {
      this.moveFocusFromResults();
      return;
    }
  }
  moveFocusFromResults() {
    if (this.showsFileTypes()) {
      this.toggleQueryDetails(true, true, false, true);
    } else {
      this.searchWidget.focus(true, true);
    }
  }
  reLayout() {
    if (this.isDisposed || !this.size) {
      return;
    }
    const actionsPosition = this.searchConfig.actionsPosition;
    this.getContainer().classList.toggle(SearchView.ACTIONS_RIGHT_CLASS_NAME, actionsPosition === "right");
    this.searchWidget.setWidth(
      this.size.width - 28
      /* container margin */
    );
    this.inputPatternExcludes.setWidth(
      this.size.width - 28
      /* container margin */
    );
    this.inputPatternIncludes.setWidth(
      this.size.width - 28
      /* container margin */
    );
    const widgetHeight = dom.getTotalHeight(this.searchWidgetsContainerElement);
    const messagesHeight = dom.getTotalHeight(this.messagesElement);
    this.tree.layout(this.size.height - widgetHeight - messagesHeight, this.size.width - 28);
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.size = new dom.Dimension(width, height);
    this.reLayout();
  }
  getControl() {
    return this.tree;
  }
  allSearchFieldsClear() {
    return this.searchWidget.getReplaceValue() === "" && (!this.searchWidget.searchInput || this.searchWidget.searchInput.getValue() === "");
  }
  allFilePatternFieldsClear() {
    return this.searchExcludePattern.getValue() === "" && this.searchIncludePattern.getValue() === "";
  }
  hasSearchResults() {
    return !this.viewModel.searchResult.isEmpty();
  }
  clearSearchResults(clearInput = true) {
    this.viewModel.searchResult.clear();
    this.showEmptyStage(true);
    if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      this.showSearchWithoutFolderMessage();
    }
    if (clearInput) {
      if (this.allSearchFieldsClear()) {
        this.clearFilePatternFields();
      }
      this.searchWidget.clear();
    }
    this.viewModel.cancelSearch();
    this.tree.ariaLabel = nls.localize("emptySearch", "Empty Search");
    this.accessibilitySignalService.playSignal(AccessibilitySignal.clear);
    this.reLayout();
  }
  clearFilePatternFields() {
    this.searchExcludePattern.clear();
    this.searchIncludePattern.clear();
  }
  cancelSearch(focus = true) {
    if (this.viewModel.cancelSearch() && this.viewModel.cancelAISearch()) {
      if (focus) {
        this.searchWidget.focus();
      }
      return true;
    }
    return false;
  }
  selectTreeIfNotSelected() {
    if (this.tree.getNode(void 0)) {
      this.tree.domFocus();
      const selection = this.tree.getSelection();
      if (selection.length === 0) {
        const event = getSelectionKeyboardEvent();
        this.tree.focusNext(void 0, void 0, event);
        this.tree.setSelection(this.tree.getFocus(), event);
      }
    }
  }
  getSearchTextFromEditor(allowUnselectedWord, editor) {
    if (dom.isAncestorOfActiveElement(this.getContainer())) {
      return null;
    }
    editor = editor ?? this.editorService.activeTextEditorControl;
    if (!editor) {
      return null;
    }
    const allowUnselected = this.searchConfig.seedWithNearestWord && allowUnselectedWord;
    return getSelectionTextFromEditor(allowUnselected, editor);
  }
  showsFileTypes() {
    return this.queryDetails.classList.contains("more");
  }
  toggleCaseSensitive() {
    this.searchWidget.searchInput?.setCaseSensitive(!this.searchWidget.searchInput.getCaseSensitive());
    this.triggerQueryChange({ shouldKeepAIResults: true });
  }
  toggleWholeWords() {
    this.searchWidget.searchInput?.setWholeWords(!this.searchWidget.searchInput.getWholeWords());
    this.triggerQueryChange({ shouldKeepAIResults: true });
  }
  toggleRegex() {
    this.searchWidget.searchInput?.setRegex(!this.searchWidget.searchInput.getRegex());
    this.triggerQueryChange({ shouldKeepAIResults: true });
  }
  togglePreserveCase() {
    this.searchWidget.replaceInput?.setPreserveCase(!this.searchWidget.replaceInput.getPreserveCase());
    this.triggerQueryChange({ shouldKeepAIResults: true });
  }
  setSearchParameters(args = {}) {
    if (typeof args.isCaseSensitive === "boolean") {
      this.searchWidget.searchInput?.setCaseSensitive(args.isCaseSensitive);
    }
    if (typeof args.matchWholeWord === "boolean") {
      this.searchWidget.searchInput?.setWholeWords(args.matchWholeWord);
    }
    if (typeof args.isRegex === "boolean") {
      this.searchWidget.searchInput?.setRegex(args.isRegex);
    }
    if (typeof args.filesToInclude === "string") {
      this.searchIncludePattern.setValue(String(args.filesToInclude));
    }
    if (typeof args.filesToExclude === "string") {
      this.searchExcludePattern.setValue(String(args.filesToExclude));
    }
    if (typeof args.query === "string") {
      this.searchWidget.searchInput?.setValue(args.query);
    }
    if (typeof args.replace === "string") {
      this.searchWidget.replaceInput?.setValue(args.replace);
    } else {
      if (this.searchWidget.replaceInput && this.searchWidget.replaceInput.getValue() !== "") {
        this.searchWidget.replaceInput.setValue("");
      }
    }
    if (typeof args.triggerSearch === "boolean" && args.triggerSearch) {
      this.triggerQueryChange();
    }
    if (typeof args.preserveCase === "boolean") {
      this.searchWidget.replaceInput?.setPreserveCase(args.preserveCase);
    }
    if (typeof args.useExcludeSettingsAndIgnoreFiles === "boolean") {
      this.inputPatternExcludes.setUseExcludesAndIgnoreFiles(args.useExcludeSettingsAndIgnoreFiles);
    }
    if (typeof args.onlyOpenEditors === "boolean") {
      this.searchIncludePattern.setOnlySearchInOpenEditors(args.onlyOpenEditors);
    }
  }
  toggleQueryDetails(moveFocus = true, show, skipLayout, reverse) {
    const cls = "more";
    show = typeof show === "undefined" ? !this.queryDetails.classList.contains(cls) : Boolean(show);
    this.viewletState["query.queryDetailsExpanded"] = show;
    skipLayout = Boolean(skipLayout);
    if (show) {
      this.toggleQueryDetailsButton.setAttribute("aria-expanded", "true");
      this.queryDetails.classList.add(cls);
      if (moveFocus) {
        if (reverse) {
          this.inputPatternExcludes.focus();
          this.inputPatternExcludes.select();
        } else {
          this.inputPatternIncludes.focus();
          this.inputPatternIncludes.select();
        }
      }
    } else {
      this.toggleQueryDetailsButton.setAttribute("aria-expanded", "false");
      this.queryDetails.classList.remove(cls);
      if (moveFocus) {
        this.searchWidget.focus();
      }
    }
    if (!skipLayout && this.size) {
      this.reLayout();
    }
  }
  searchInFolders(folderPaths = []) {
    this._searchWithIncludeOrExclude(true, folderPaths);
  }
  searchOutsideOfFolders(folderPaths = []) {
    this._searchWithIncludeOrExclude(false, folderPaths);
  }
  _searchWithIncludeOrExclude(include, folderPaths) {
    if (!folderPaths.length || folderPaths.some((folderPath) => folderPath === ".")) {
      this.inputPatternIncludes.setValue("");
      this.searchWidget.focus();
      return;
    }
    if (!this.showsFileTypes()) {
      this.toggleQueryDetails(true, true);
    }
    (include ? this.inputPatternIncludes : this.inputPatternExcludes).setValue(folderPaths.join(", "));
    this.searchWidget.focus(false);
  }
  triggerQueryChange(_options) {
    const options = { preserveFocus: true, triggeredOnType: false, delay: 0, ..._options };
    if (options.triggeredOnType && !this.searchConfig.searchOnType) {
      return;
    }
    if (!this.pauseSearching) {
      const delay = options.triggeredOnType ? options.delay : 0;
      this.triggerQueryDelayer.trigger(() => {
        this._onQueryChanged(options.preserveFocus, options.triggeredOnType, options.shouldKeepAIResults, options.shouldUpdateAISearch);
      }, delay);
    }
  }
  _getExcludePattern() {
    return this.inputPatternExcludes.getValue().trim();
  }
  _getIncludePattern() {
    return this.inputPatternIncludes.getValue().trim();
  }
  _onQueryChanged(preserveFocus, triggeredOnType = false, shouldKeepAIResults = false, shouldUpdateAISearch = false) {
    if (!this.searchWidget.searchInput?.inputBox.isInputValid()) {
      return;
    }
    const isRegex = this.searchWidget.searchInput.getRegex();
    const isInNotebookMarkdownInput = this.searchWidget.getNotebookFilters().markupInput;
    const isInNotebookMarkdownPreview = this.searchWidget.getNotebookFilters().markupPreview;
    const isInNotebookCellInput = this.searchWidget.getNotebookFilters().codeInput;
    const isInNotebookCellOutput = this.searchWidget.getNotebookFilters().codeOutput;
    const isWholeWords = this.searchWidget.searchInput.getWholeWords();
    const isCaseSensitive = this.searchWidget.searchInput.getCaseSensitive();
    const contentPattern = this.searchWidget.searchInput.getValue();
    const excludePatternText = this._getExcludePattern();
    const includePatternText = this._getIncludePattern();
    const useExcludesAndIgnoreFiles = this.inputPatternExcludes.useExcludesAndIgnoreFiles();
    const onlySearchInOpenEditors = this.inputPatternIncludes.onlySearchInOpenEditors();
    if (contentPattern.length === 0) {
      this.clearSearchResults(false);
      this.clearMessage();
      return;
    }
    const content = {
      pattern: contentPattern,
      isRegExp: isRegex,
      isCaseSensitive,
      isWordMatch: isWholeWords,
      notebookInfo: {
        isInNotebookMarkdownInput,
        isInNotebookMarkdownPreview,
        isInNotebookCellInput,
        isInNotebookCellOutput
      }
    };
    const excludePattern = [{ pattern: this.inputPatternExcludes.getValue() }];
    const includePattern = this.inputPatternIncludes.getValue();
    const charsPerLine = content.isRegExp ? 1e4 : 1e3;
    const options = {
      _reason: "searchView",
      extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
      maxResults: this.searchConfig.maxResults ?? void 0,
      disregardIgnoreFiles: !useExcludesAndIgnoreFiles || void 0,
      disregardExcludeSettings: !useExcludesAndIgnoreFiles || void 0,
      onlyOpenEditors: onlySearchInOpenEditors,
      excludePattern,
      includePattern,
      previewOptions: {
        matchLines: 1,
        charsPerLine
      },
      isSmartCase: this.searchConfig.smartCase,
      expandPatterns: true
    };
    const folderResources = this.contextService.getWorkspace().folders;
    const onQueryValidationError = (err) => {
      this.searchWidget.searchInput?.showMessage({ content: err.message, type: MessageType.ERROR });
      this.viewModel.searchResult.clear();
    };
    let query;
    try {
      query = this.queryBuilder.text(content, folderResources.map((folder) => folder.uri), options);
    } catch (err) {
      onQueryValidationError(err);
      return;
    }
    this.validateQuery(query).then(() => {
      if (!shouldKeepAIResults && !shouldUpdateAISearch && this.tree.hasNode(this.searchResult.aiTextSearchResult)) {
        this.tree.collapse(this.searchResult.aiTextSearchResult);
      }
      this.onQueryTriggered(query, options, excludePatternText, includePatternText, triggeredOnType, shouldKeepAIResults, shouldUpdateAISearch);
      if (!preserveFocus) {
        this.searchWidget.focus(false, void 0, true);
      }
    }, onQueryValidationError);
  }
  validateQuery(query) {
    const folderQueriesExistP = query.folderQueries.map((fq) => {
      return this.fileService.exists(fq.folder).catch(() => false);
    });
    return Promise.all(folderQueriesExistP).then((existResults) => {
      const existingFolderQueries = query.folderQueries.filter((folderQuery, i) => existResults[i]);
      if (!query.folderQueries.length || existingFolderQueries.length) {
        query.folderQueries = existingFolderQueries;
      } else {
        const nonExistantPath = query.folderQueries[0].folder.fsPath;
        const searchPathNotFoundError = nls.localize("searchPathNotFoundError", "Search path not found: {0}", nonExistantPath);
        return Promise.reject(new Error(searchPathNotFoundError));
      }
      return void 0;
    });
  }
  onQueryTriggered(query, options, excludePatternText, includePatternText, triggeredOnType, shouldKeepAIResults, shouldUpdateAISearch) {
    this.addToSearchHistoryDelayer.trigger(() => {
      this.searchWidget.searchInput?.onSearchSubmit();
      this.inputPatternExcludes.onSearchSubmit();
      this.inputPatternIncludes.onSearchSubmit();
    });
    this.viewModel.cancelSearch(true);
    this.viewModel.cancelAISearch(true);
    this.currentSearchQ = this.currentSearchQ.then(() => this.doSearch(query, excludePatternText, includePatternText, triggeredOnType, shouldKeepAIResults, shouldUpdateAISearch)).then(() => void 0, () => void 0);
  }
  async _updateResults() {
    if (this.state === SearchUIState.Idle) {
      return;
    }
    try {
      const fileCount = this.viewModel.searchResult.fileCount();
      if (this._visibleMatches !== fileCount) {
        this._visibleMatches = fileCount;
        await this.refreshAndUpdateCount();
      }
    } finally {
      this._refreshResultsScheduler.schedule();
    }
  }
  async expandIfSingularResult() {
    const collapseResults = this.searchConfig.collapseResults;
    if (collapseResults !== "alwaysCollapse" && this.viewModel.searchResult.matches().length === 1) {
      const onlyMatch = this.viewModel.searchResult.matches()[0];
      await this.tree.expandTo(onlyMatch);
      if (onlyMatch.count() < 50) {
        await this.tree.expand(onlyMatch);
      }
    }
  }
  async onSearchComplete(progressComplete, excludePatternText, includePatternText, completed, shouldDoFinalRefresh = true) {
    this.state = SearchUIState.Idle;
    progressComplete();
    if (shouldDoFinalRefresh) {
      await this.refreshAndUpdateCount();
    }
    const allResults = !this.viewModel.searchResult.isEmpty();
    const aiResults = this.searchResult.getCachedSearchComplete(true);
    if (completed?.exit === SearchCompletionExitCode.NewSearchStarted) {
      return;
    }
    Constants.SearchContext.AIResultsRequested.bindTo(this.contextKeyService).set(this.shouldShowAIResults() && !!aiResults);
    if (this.shouldShowAIResults() && !allResults) {
      const messageEl = this.clearMessage();
      const noResultsMessage = nls.localize("noResultsFallback", "No results found. ");
      dom.append(messageEl, noResultsMessage);
      let aiName = "Copilot";
      try {
        aiName = await this.searchService.getAIName() || aiName;
      } catch (e) {
      }
      if (aiName) {
        const searchWithAIButtonTooltip = appendKeyBindingLabel(
          nls.localize("triggerAISearch.tooltip", "Search with {0}", aiName),
          this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.SearchWithAIActionId)
        );
        const searchWithAIButtonText = nls.localize("searchWithAIButtonTooltip", "Search with {0}.", aiName);
        const searchWithAIButton = this.messageDisposables.add(new SearchLinkButton(
          searchWithAIButtonText,
          () => {
            this.commandService.executeCommand(Constants.SearchCommandIds.SearchWithAIActionId);
          },
          this.hoverService,
          searchWithAIButtonTooltip
        ));
        dom.append(messageEl, searchWithAIButton.element);
      }
      if (!aiResults) {
        return;
      }
    }
    if (!allResults) {
      const hasExcludes = !!excludePatternText;
      const hasIncludes = !!includePatternText;
      let message;
      if (!completed) {
        message = SEARCH_CANCELLED_MESSAGE;
      } else if (this.inputPatternIncludes.onlySearchInOpenEditors()) {
        if (hasIncludes && hasExcludes) {
          message = nls.localize("noOpenEditorResultsIncludesExcludes", "No results found in open editors matching '{0}' excluding '{1}' - ", includePatternText, excludePatternText);
        } else if (hasIncludes) {
          message = nls.localize("noOpenEditorResultsIncludes", "No results found in open editors matching '{0}' - ", includePatternText);
        } else if (hasExcludes) {
          message = nls.localize("noOpenEditorResultsExcludes", "No results found in open editors excluding '{0}' - ", excludePatternText);
        } else {
          message = nls.localize("noOpenEditorResultsFound", "No results found in open editors. Review your settings for configured exclusions and check your gitignore files - ");
        }
      } else {
        if (hasIncludes && hasExcludes) {
          message = nls.localize("noResultsIncludesExcludes", "No results found in '{0}' excluding '{1}' - ", includePatternText, excludePatternText);
        } else if (hasIncludes) {
          message = nls.localize("noResultsIncludes", "No results found in '{0}' - ", includePatternText);
        } else if (hasExcludes) {
          message = nls.localize("noResultsExcludes", "No results found excluding '{0}' - ", excludePatternText);
        } else {
          message = nls.localize("noResultsFound", "No results found. Review your settings for configured exclusions and check your gitignore files - ");
        }
      }
      aria.status(message);
      const messageEl = this.clearMessage();
      dom.append(messageEl, message);
      if (!completed) {
        const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(
          nls.localize("rerunSearch.message", "Search again"),
          () => this.triggerQueryChange({ preserveFocus: false }),
          this.hoverService
        ));
        dom.append(messageEl, searchAgainButton.element);
      } else if (hasIncludes || hasExcludes) {
        const searchAgainButton = this.messageDisposables.add(new SearchLinkButton(nls.localize("rerunSearchInAll.message", "Search again in all files"), this.onSearchAgain.bind(this), this.hoverService));
        dom.append(messageEl, searchAgainButton.element);
      } else {
        const openSettingsButton = this.messageDisposables.add(new SearchLinkButton(nls.localize("openSettings.message", "Open Settings"), this.onOpenSettings.bind(this), this.hoverService));
        dom.append(messageEl, openSettingsButton.element);
      }
      if (completed) {
        dom.append(messageEl, $("span", void 0, " - "));
        const learnMoreButton = this.messageDisposables.add(new SearchLinkButton(nls.localize("openSettings.learnMore", "Learn More"), this.onLearnMore.bind(this), this.hoverService));
        dom.append(messageEl, learnMoreButton.element);
      }
      if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
        this.showSearchWithoutFolderMessage();
      }
      this.reLayout();
    } else {
      this.viewModel.searchResult.toggleHighlights(this.isVisible());
      aria.status(nls.localize("ariaSearchResultsStatus", "Search returned {0} results in {1} files", this.viewModel.searchResult.count(), this.viewModel.searchResult.fileCount()));
    }
    if (completed && completed.limitHit) {
      completed.messages.push({ type: TextSearchCompleteMessageType.Warning, text: nls.localize("searchMaxResultsWarning", "The result set only contains a subset of all matches. Be more specific in your search to narrow down the results.") });
    }
    if (completed && completed.messages) {
      for (const message of completed.messages) {
        this.addMessage(message);
      }
    }
    this.reLayout();
  }
  async onSearchError(e, progressComplete, excludePatternText, includePatternText, completed, shouldDoFinalRefresh = true) {
    this.state = SearchUIState.Idle;
    if (errors.isCancellationError(e)) {
      return this.onSearchComplete(progressComplete, excludePatternText, includePatternText, completed, shouldDoFinalRefresh);
    } else {
      progressComplete();
      this.searchWidget.searchInput?.showMessage({ content: e.message, type: MessageType.ERROR });
      this.viewModel.searchResult.clear();
      return Promise.resolve();
    }
  }
  async addAIResults() {
    const excludePatternText = this._getExcludePattern();
    const includePatternText = this._getIncludePattern();
    let progressComplete;
    this.progressService.withProgress({ location: this.getProgressLocation(), delay: 0 }, (_progress) => {
      return new Promise((resolve) => progressComplete = resolve);
    });
    this.searchWidget.searchInput?.clearMessage();
    this.state = SearchUIState.Searching;
    this.showEmptyStage();
    const slowTimer = setTimeout(() => {
      this.state = SearchUIState.SlowSearch;
    }, 2e3);
    this._visibleMatches = 0;
    this.tree.setSelection([]);
    this.tree.setFocus([]);
    this.viewModel.replaceString = this.searchWidget.getReplaceValue();
    this.viewModel.searchResult.setAIQueryUsingTextQuery();
    const result = this.viewModel.addAIResults();
    return result.then((complete) => {
      clearTimeout(slowTimer);
      this.updateSearchResultCount(this.viewModel.searchResult.query?.userDisabledExcludesAndIgnoreFiles, this.viewModel.searchResult.query?.onlyOpenEditors, false);
      return this.onSearchComplete(progressComplete, excludePatternText, includePatternText, complete, false);
    }, (e) => {
      clearTimeout(slowTimer);
      return this.onSearchError(e, progressComplete, excludePatternText, includePatternText, void 0, false);
    });
  }
  doSearch(query, excludePatternText, includePatternText, triggeredOnType, shouldKeepAIResults, shouldUpdateAISearch) {
    let progressComplete;
    this.progressService.withProgress({ location: this.getProgressLocation(), delay: triggeredOnType ? 300 : 0 }, (_progress) => {
      return new Promise((resolve) => progressComplete = resolve);
    });
    this.searchWidget.searchInput?.clearMessage();
    this.state = SearchUIState.Searching;
    this.showEmptyStage();
    this.model.searchResult.aiTextSearchResult.hidden = !shouldKeepAIResults && !shouldUpdateAISearch;
    const slowTimer = setTimeout(() => {
      this.state = SearchUIState.SlowSearch;
    }, 2e3);
    this._visibleMatches = 0;
    this._refreshResultsScheduler.schedule();
    this.searchWidget.setReplaceAllActionState(false);
    this.tree.setSelection([]);
    this.tree.setFocus([]);
    this.viewModel.replaceString = this.searchWidget.getReplaceValue();
    const result = this.viewModel.search(query);
    if (!shouldKeepAIResults || shouldUpdateAISearch) {
      this.viewModel.searchResult.setAIQueryUsingTextQuery(query);
    }
    if (shouldUpdateAISearch) {
      this.tree.updateChildren(this.searchResult.aiTextSearchResult);
    }
    return result.asyncResults.then((complete) => {
      clearTimeout(slowTimer);
      return this.onSearchComplete(progressComplete, excludePatternText, includePatternText, complete);
    }, (e) => {
      clearTimeout(slowTimer);
      return this.onSearchError(e, progressComplete, excludePatternText, includePatternText);
    });
  }
  onOpenSettings(e) {
    dom.EventHelper.stop(e, false);
    this.openSettings("@id:files.exclude,search.exclude,search.useParentIgnoreFiles,search.useGlobalIgnoreFiles,search.useIgnoreFiles");
  }
  openSettings(query) {
    const options = { query };
    return this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY ? this.preferencesService.openWorkspaceSettings(options) : this.preferencesService.openUserSettings(options);
  }
  onLearnMore() {
    this.openerService.open(URI.parse("https://go.microsoft.com/fwlink/?linkid=853977"));
  }
  onSearchAgain() {
    this.inputPatternExcludes.setValue("");
    this.inputPatternIncludes.setValue("");
    this.inputPatternIncludes.setOnlySearchInOpenEditors(false);
    this.triggerQueryChange({ preserveFocus: false });
  }
  onEnableExcludes() {
    this.toggleQueryDetails(false, true);
    this.searchExcludePattern.setUseExcludesAndIgnoreFiles(true);
  }
  onDisableSearchInOpenEditors() {
    this.toggleQueryDetails(false, true);
    this.inputPatternIncludes.setOnlySearchInOpenEditors(false);
  }
  updateSearchResultCount(disregardExcludesAndIgnores, onlyOpenEditors, clear = false) {
    const fileCount = this.viewModel.searchResult.fileCount();
    const resultCount = this.viewModel.searchResult.count();
    this.hasSearchResultsKey.set(fileCount > 0);
    const msgWasHidden = this.messagesElement.style.display === "none";
    const messageEl = this.clearMessage();
    const resultMsg = clear ? "" : this.buildResultCountMessage(resultCount, fileCount);
    this.tree.ariaLabel = resultMsg + nls.localize("forTerm", " - Search: {0}", this.searchResult.query?.contentPattern.pattern ?? "");
    dom.append(messageEl, resultMsg);
    if (fileCount > 0) {
      if (disregardExcludesAndIgnores) {
        const excludesDisabledMessage = " - " + nls.localize("useIgnoresAndExcludesDisabled", "exclude settings and ignore files are disabled") + " ";
        const enableExcludesButton = this.messageDisposables.add(new SearchLinkButton(nls.localize("excludes.enable", "enable"), this.onEnableExcludes.bind(this), this.hoverService, nls.localize("useExcludesAndIgnoreFilesDescription", "Use Exclude Settings and Ignore Files")));
        dom.append(messageEl, $("span", void 0, excludesDisabledMessage, "(", enableExcludesButton.element, ")"));
      }
      if (onlyOpenEditors) {
        const searchingInOpenMessage = " - " + nls.localize("onlyOpenEditors", "searching only in open files") + " ";
        const disableOpenEditorsButton = this.messageDisposables.add(new SearchLinkButton(nls.localize("openEditors.disable", "disable"), this.onDisableSearchInOpenEditors.bind(this), this.hoverService, nls.localize("disableOpenEditors", "Search in entire workspace")));
        dom.append(messageEl, $("span", void 0, searchingInOpenMessage, "(", disableOpenEditorsButton.element, ")"));
      }
      dom.append(messageEl, " - ");
      const openInEditorTooltip = appendKeyBindingLabel(
        nls.localize("openInEditor.tooltip", "Copy current search results to an editor"),
        this.keybindingService.lookupKeybinding(Constants.SearchCommandIds.OpenInEditorCommandId)
      );
      const openInEditorButton = this.messageDisposables.add(new SearchLinkButton(
        nls.localize("openInEditor.message", "Open in editor"),
        () => this.instantiationService.invokeFunction(createEditorFromSearchResult, this.searchResult, this.searchIncludePattern.getValue(), this.searchExcludePattern.getValue(), this.searchIncludePattern.onlySearchInOpenEditors()),
        this.hoverService,
        openInEditorTooltip
      ));
      dom.append(messageEl, openInEditorButton.element);
      this.reLayout();
    } else if (!msgWasHidden) {
      dom.hide(this.messagesElement);
    }
  }
  addMessage(message) {
    const messageBox = this.messagesElement.firstChild;
    if (!messageBox) {
      return;
    }
    dom.append(messageBox, renderSearchMessage(message, this.instantiationService, this.notificationService, this.openerService, this.commandService, this.messageDisposables, () => this.triggerQueryChange()));
  }
  buildResultCountMessage(resultCount, fileCount) {
    if (resultCount === 1 && fileCount === 1) {
      return nls.localize("search.file.result", "{0} result in {1} file", resultCount, fileCount);
    } else if (resultCount === 1) {
      return nls.localize("search.files.result", "{0} result in {1} files", resultCount, fileCount);
    } else if (fileCount === 1) {
      return nls.localize("search.file.results", "{0} results in {1} file", resultCount, fileCount);
    } else {
      return nls.localize("search.files.results", "{0} results in {1} files", resultCount, fileCount);
    }
  }
  showSearchWithoutFolderMessage() {
    this.searchWithoutFolderMessageElement = this.clearMessage();
    const textEl = dom.append(
      this.searchWithoutFolderMessageElement,
      $("p", void 0, nls.localize("searchWithoutFolder", "You have not opened or specified a folder. Only open files are currently searched - "))
    );
    const openFolderButton = this.messageDisposables.add(new SearchLinkButton(
      nls.localize("openFolder", "Open Folder"),
      () => {
        this.commandService.executeCommand(env.isMacintosh && env.isNative ? OpenFileFolderAction.ID : OpenFolderAction.ID).catch((err) => errors.onUnexpectedError(err));
      },
      this.hoverService
    ));
    dom.append(textEl, openFolderButton.element);
  }
  showEmptyStage(forceHideMessages = false) {
    const showingCancelled = (this.messagesElement.firstChild?.textContent?.indexOf(SEARCH_CANCELLED_MESSAGE) ?? -1) > -1;
    if (showingCancelled || forceHideMessages || !this.configurationService.getValue().search.searchOnType) {
      dom.hide(this.messagesElement);
    }
    dom.show(this.resultsElement);
    this.currentSelectedFileMatch = void 0;
  }
  shouldOpenInNotebookEditor(match, uri) {
    return isIMatchInNotebook(match) || uri.scheme !== network.Schemas.untitled && this.notebookService.getContributedNotebookTypes(uri).length > 0;
  }
  onFocus(lineMatch, preserveFocus, sideBySide, pinned) {
    const useReplacePreview = this.configurationService.getValue().search.useReplacePreview;
    const resource = isSearchTreeMatch(lineMatch) ? lineMatch.parent().resource : lineMatch.resource;
    return useReplacePreview && this.viewModel.isReplaceActive() && !!this.viewModel.replaceString && !this.shouldOpenInNotebookEditor(lineMatch, resource) ? this.replaceService.openReplacePreview(lineMatch, preserveFocus, sideBySide, pinned) : this.open(lineMatch, preserveFocus, sideBySide, pinned, resource);
  }
  async open(element, preserveFocus, sideBySide, pinned, resourceInput) {
    const selection = getEditorSelectionFromMatch(element, this.viewModel);
    const oldParentMatches = isSearchTreeMatch(element) ? element.parent().matches() : [];
    const resource = resourceInput ?? (isSearchTreeMatch(element) ? element.parent().resource : element.resource);
    let editor;
    const options = {
      preserveFocus,
      pinned,
      selection,
      revealIfVisible: true
    };
    try {
      editor = await this.editorService.openEditor({
        resource,
        options
      }, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
      const editorControl = editor?.getControl();
      if (isSearchTreeMatch(element) && preserveFocus && isCodeEditor(editorControl)) {
        this.viewModel.searchResult.getRangeHighlightDecorations().highlightRange(
          editorControl.getModel(),
          element.range()
        );
      } else {
        this.viewModel.searchResult.getRangeHighlightDecorations().removeHighlightRange();
      }
    } catch (err) {
      errors.onUnexpectedError(err);
      return;
    }
    if (editor instanceof NotebookEditor) {
      const elemParent = element.parent();
      if (isSearchTreeMatch(element)) {
        if (isIMatchInNotebook(element)) {
          element.parent().showMatch(element);
        } else {
          const editorWidget = editor.getControl();
          if (editorWidget) {
            elemParent.bindNotebookEditorWidget(editorWidget);
            await elemParent.updateMatchesForEditorWidget();
            const matchIndex = oldParentMatches.findIndex((e) => e.id() === element.id());
            const matches = elemParent.matches();
            const match = matchIndex >= matches.length ? matches[matches.length - 1] : matches[matchIndex];
            if (isIMatchInNotebook(match)) {
              elemParent.showMatch(match);
              if (!this.tree.getFocus().includes(match) || !this.tree.getSelection().includes(match)) {
                this.tree.setSelection([match], getSelectionKeyboardEvent());
                this.tree.setFocus([match]);
              }
            }
          }
        }
      }
    }
  }
  openEditorWithMultiCursor(element) {
    const resource = isSearchTreeMatch(element) ? element.parent().resource : element.resource;
    return this.editorService.openEditor({
      resource,
      options: {
        preserveFocus: false,
        pinned: true,
        revealIfVisible: true
      }
    }).then((editor) => {
      if (editor) {
        let fileMatch = null;
        if (isSearchTreeFileMatch(element)) {
          fileMatch = element;
        } else if (isSearchTreeMatch(element)) {
          fileMatch = element.parent();
        }
        if (fileMatch) {
          const selections = fileMatch.matches().map((m) => new Selection(m.range().startLineNumber, m.range().startColumn, m.range().endLineNumber, m.range().endColumn));
          const codeEditor = getCodeEditor(editor.getControl());
          if (codeEditor) {
            const multiCursorController = MultiCursorSelectionController.get(codeEditor);
            multiCursorController?.selectAllUsingSelections(selections);
          }
        }
      }
      this.viewModel.searchResult.getRangeHighlightDecorations().removeHighlightRange();
    }, errors.onUnexpectedError);
  }
  onUntitledDidDispose(resource) {
    if (!this.viewModel) {
      return;
    }
    let matches = this.viewModel.searchResult.matches();
    for (let i = 0, len = matches.length; i < len; i++) {
      if (resource.toString() === matches[i].resource.toString()) {
        this.viewModel.searchResult.remove(matches[i]);
      }
    }
    matches = this.viewModel.searchResult.matches(true);
    for (let i = 0, len = matches.length; i < len; i++) {
      if (resource.toString() === matches[i].resource.toString()) {
        this.viewModel.searchResult.remove(matches[i]);
      }
    }
  }
  onFilesChanged(e) {
    if (!this.viewModel || this.searchConfig.sortOrder !== SearchSortOrder.Modified && !e.gotDeleted()) {
      return;
    }
    const matches = this.viewModel.searchResult.matches();
    if (e.gotDeleted()) {
      const deletedMatches = matches.filter((m) => e.contains(m.resource, FileChangeType.DELETED));
      this.viewModel.searchResult.remove(deletedMatches);
    } else {
      const changedMatches = matches.filter((m) => e.contains(m.resource));
      if (changedMatches.length && this.searchConfig.sortOrder === SearchSortOrder.Modified) {
        this.updateFileStats(changedMatches).then(async () => this.refreshTreeController.queue());
      }
    }
  }
  get searchConfig() {
    return this.configurationService.getValue("search");
  }
  clearHistory() {
    this.searchWidget.clearHistory();
    this.inputPatternExcludes.clearHistory();
    this.inputPatternIncludes.clearHistory();
  }
  saveState() {
    if (!this.searchWidget) {
      return;
    }
    const patternExcludes = this.inputPatternExcludes?.getValue().trim() ?? "";
    const patternIncludes = this.inputPatternIncludes?.getValue().trim() ?? "";
    const onlyOpenEditors = this.inputPatternIncludes?.onlySearchInOpenEditors() ?? false;
    const useExcludesAndIgnoreFiles = this.inputPatternExcludes?.useExcludesAndIgnoreFiles() ?? true;
    const preserveCase = this.viewModel.preserveCase;
    if (this.searchWidget.searchInput) {
      const isRegex = this.searchWidget.searchInput.getRegex();
      const isWholeWords = this.searchWidget.searchInput.getWholeWords();
      const isCaseSensitive = this.searchWidget.searchInput.getCaseSensitive();
      const contentPattern = this.searchWidget.searchInput.getValue();
      const isInNotebookCellInput = this.searchWidget.getNotebookFilters().codeInput;
      const isInNotebookCellOutput = this.searchWidget.getNotebookFilters().codeOutput;
      const isInNotebookMarkdownInput = this.searchWidget.getNotebookFilters().markupInput;
      const isInNotebookMarkdownPreview = this.searchWidget.getNotebookFilters().markupPreview;
      this.viewletState["query.contentPattern"] = contentPattern;
      this.viewletState["query.regex"] = isRegex;
      this.viewletState["query.wholeWords"] = isWholeWords;
      this.viewletState["query.caseSensitive"] = isCaseSensitive;
      this.viewletState["query.isInNotebookMarkdownInput"] = isInNotebookMarkdownInput;
      this.viewletState["query.isInNotebookMarkdownPreview"] = isInNotebookMarkdownPreview;
      this.viewletState["query.isInNotebookCellInput"] = isInNotebookCellInput;
      this.viewletState["query.isInNotebookCellOutput"] = isInNotebookCellOutput;
    }
    this.viewletState["query.folderExclusions"] = patternExcludes;
    this.viewletState["query.folderIncludes"] = patternIncludes;
    this.viewletState["query.useExcludesAndIgnoreFiles"] = useExcludesAndIgnoreFiles;
    this.viewletState["query.preserveCase"] = preserveCase;
    this.viewletState["query.onlyOpenEditors"] = onlyOpenEditors;
    const isReplaceShown = this.searchAndReplaceWidget.isReplaceShown();
    this.viewletState["view.showReplace"] = isReplaceShown;
    this.viewletState["view.treeLayout"] = this.isTreeLayoutViewVisible;
    this.viewletState["query.replaceText"] = isReplaceShown && this.searchWidget.getReplaceValue();
    this._saveSearchHistoryService();
    this.memento.saveMemento();
    super.saveState();
  }
  _saveSearchHistoryService() {
    if (this.searchWidget === void 0) {
      return;
    }
    const history = /* @__PURE__ */ Object.create(null);
    const searchHistory = this.searchWidget.getSearchHistory();
    if (searchHistory && searchHistory.length) {
      history.search = searchHistory;
    }
    const replaceHistory = this.searchWidget.getReplaceHistory();
    if (replaceHistory && replaceHistory.length) {
      history.replace = replaceHistory;
    }
    const patternExcludesHistory = this.inputPatternExcludes.getHistory();
    if (patternExcludesHistory && patternExcludesHistory.length) {
      history.exclude = patternExcludesHistory;
    }
    const patternIncludesHistory = this.inputPatternIncludes.getHistory();
    if (patternIncludesHistory && patternIncludesHistory.length) {
      history.include = patternIncludesHistory;
    }
    this.searchHistoryService.save(history);
  }
  async updateFileStats(elements) {
    const files = elements.map((f) => f.resolveFileStat(this.fileService));
    await Promise.all(files);
  }
  removeFileStats() {
    for (const fileMatch of this.searchResult.matches()) {
      fileMatch.fileStat = void 0;
    }
    for (const fileMatch of this.searchResult.matches(true)) {
      fileMatch.fileStat = void 0;
    }
  }
  dispose() {
    this.isDisposed = true;
    this.saveState();
    super.dispose();
  }
};
SearchView.ACTIONS_RIGHT_CLASS_NAME = "actions-right";
SearchView = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ICodeEditorService),
  __decorateParam(4, IProgressService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, ICommandService),
  __decorateParam(8, IContextViewService),
  __decorateParam(9, IInstantiationService),
  __decorateParam(10, IViewDescriptorService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IWorkspaceContextService),
  __decorateParam(13, ISearchViewModelWorkbenchService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IReplaceService),
  __decorateParam(16, ITextFileService),
  __decorateParam(17, IPreferencesService),
  __decorateParam(18, IThemeService),
  __decorateParam(19, ISearchHistoryService),
  __decorateParam(20, IContextMenuService),
  __decorateParam(21, IAccessibilityService),
  __decorateParam(22, IKeybindingService),
  __decorateParam(23, IStorageService),
  __decorateParam(24, ISearchService),
  __decorateParam(25, IOpenerService),
  __decorateParam(26, IHoverService),
  __decorateParam(27, INotebookService),
  __decorateParam(28, ILogService),
  __decorateParam(29, IAccessibilitySignalService)
], SearchView);
class SearchLinkButton extends Disposable {
  constructor(label, handler, hoverService, tooltip) {
    super();
    this.element = $("a.pointer", { tabindex: 0 }, label);
    this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, tooltip));
    this.addEventHandlers(handler);
  }
  addEventHandlers(handler) {
    const wrappedHandler = (e) => {
      dom.EventHelper.stop(e, false);
      handler(e);
    };
    this._register(dom.addDisposableListener(this.element, dom.EventType.CLICK, wrappedHandler));
    this._register(dom.addDisposableListener(this.element, dom.EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Space) || event.equals(KeyCode.Enter)) {
        wrappedHandler(e);
        event.preventDefault();
        event.stopPropagation();
      }
    }));
  }
}
function getEditorSelectionFromMatch(element, viewModel) {
  let match = null;
  if (isSearchTreeMatch(element)) {
    match = element;
  }
  if (isSearchTreeFileMatch(element) && element.count() > 0) {
    match = element.matches()[element.matches().length - 1];
  }
  if (match) {
    const range = match.range();
    if (viewModel.isReplaceActive() && !!viewModel.replaceString) {
      const replaceString = match.replaceString;
      return {
        startLineNumber: range.startLineNumber,
        startColumn: range.startColumn,
        endLineNumber: range.startLineNumber,
        endColumn: range.startColumn + replaceString.length
      };
    }
    return range;
  }
  return void 0;
}
function getSelectionTextFromEditor(allowUnselectedWord, activeEditor) {
  let editor = activeEditor;
  if (isDiffEditor(editor)) {
    if (editor.getOriginalEditor().hasTextFocus()) {
      editor = editor.getOriginalEditor();
    } else {
      editor = editor.getModifiedEditor();
    }
  }
  if (!isCodeEditor(editor) || !editor.hasModel()) {
    return null;
  }
  const range = editor.getSelection();
  if (!range) {
    return null;
  }
  if (range.isEmpty()) {
    if (allowUnselectedWord) {
      const wordAtPosition = editor.getModel().getWordAtPosition(range.getStartPosition());
      return wordAtPosition?.word ?? null;
    } else {
      return null;
    }
  }
  let searchText = "";
  for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
    let lineText = editor.getModel().getLineContent(i);
    if (i === range.endLineNumber) {
      lineText = lineText.substring(0, range.endColumn - 1);
    }
    if (i === range.startLineNumber) {
      lineText = lineText.substring(range.startColumn - 1);
    }
    if (i !== range.startLineNumber) {
      lineText = "\n" + lineText;
    }
    searchText += lineText;
  }
  return searchText;
}
let SearchViewDataSource = class {
  constructor(searchView, configurationService) {
    this.searchView = searchView;
    this.configurationService = configurationService;
  }
  get searchConfig() {
    return this.configurationService.getValue("search");
  }
  createSearchResultIterator(searchResult) {
    const ret = [];
    if (this.searchView.shouldShowAIResults() && searchResult.searchModel.hasPlainResults && !searchResult.aiTextSearchResult.hidden) {
      ret.push(searchResult.aiTextSearchResult);
    }
    if (!searchResult.plainTextSearchResult.isEmpty()) {
      if (!this.searchView.shouldShowAIResults() || searchResult.aiTextSearchResult.hidden) {
        return this.createTextSearchResultIterator(searchResult.plainTextSearchResult);
      }
      ret.push(searchResult.plainTextSearchResult);
    }
    return ret;
  }
  createTextSearchResultIterator(textSearchResult) {
    const folderMatches = textSearchResult.folderMatches().filter((fm) => !fm.isEmpty()).sort(searchMatchComparer);
    if (folderMatches.length === 1) {
      return this.createFolderIterator(folderMatches[0]);
    }
    return folderMatches;
  }
  createFolderIterator(folderMatch) {
    const matchArray = this.searchView.isTreeLayoutViewVisible ? folderMatch.matches() : folderMatch.allDownstreamFileMatches();
    let matches = matchArray;
    if (!(folderMatch instanceof AIFolderMatchWorkspaceRootImpl)) {
      matches = matchArray.sort((a, b) => searchMatchComparer(a, b, this.searchConfig.sortOrder));
    }
    return matches;
  }
  createFileIterator(fileMatch) {
    const matches = fileMatch.matches().sort(searchMatchComparer);
    return matches;
  }
  hasChildren(element) {
    if (isSearchTreeMatch(element)) {
      return false;
    }
    if (isTextSearchHeading(element) && element.isAIContributed) {
      return true;
    }
    const hasChildren = element.hasChildren;
    return hasChildren;
  }
  getChildren(element) {
    if (isSearchResult(element)) {
      return this.createSearchResultIterator(element);
    } else if (isTextSearchHeading(element)) {
      if (element.isAIContributed && !this.searchView.model.hasAIResults) {
        return this.searchView.addAIResults().then(() => this.createTextSearchResultIterator(element));
      }
      return this.createTextSearchResultIterator(element);
    } else if (isSearchTreeFolderMatch(element)) {
      return this.createFolderIterator(element);
    } else if (isSearchTreeFileMatch(element)) {
      return this.createFileIterator(element);
    }
    return [];
  }
  getParent(element) {
    const parent = element.parent();
    if (isSearchResult(parent)) {
      throw new Error("Invalid element passed to getParent");
    }
    return parent;
  }
};
SearchViewDataSource = __decorateClass([
  __decorateParam(1, IConfigurationService)
], SearchViewDataSource);
let RefreshTreeController = class extends Disposable {
  constructor(searchView, geSearchConfig, fileService) {
    super();
    this.searchView = searchView;
    this.geSearchConfig = geSearchConfig;
    this.fileService = fileService;
    this.queuedIChangeEvents = [];
    this.refreshTreeThrottler = this._register(new Throttler());
  }
  async queue(e) {
    if (e) {
      this.queuedIChangeEvents.push(e);
    }
    return this.refreshTreeThrottler.queue(this.refreshTreeUsingQueue.bind(this));
  }
  async refreshTreeUsingQueue() {
    const aggregateChangeEvent = this.queuedIChangeEvents.length === 0 ? void 0 : {
      elements: this.queuedIChangeEvents.map((e) => e.elements).flat(),
      added: this.queuedIChangeEvents.some((e) => e.added),
      removed: this.queuedIChangeEvents.some((e) => e.removed),
      clearingAll: this.queuedIChangeEvents.some((e) => e.clearingAll)
    };
    this.queuedIChangeEvents = [];
    return this.refreshTree(aggregateChangeEvent);
  }
  async retrieveFileStats() {
    const files = this.searchView.model.searchResult.matches().filter((f) => !f.fileStat).map((f) => f.resolveFileStat(this.fileService));
    await Promise.all(files);
  }
  async refreshTree(event) {
    const searchConfig = this.geSearchConfig();
    if (!event || event.added || event.removed) {
      if (searchConfig.sortOrder === SearchSortOrder.Modified) {
        await this.retrieveFileStats().then(() => this.searchView.getControl().updateChildren(void 0));
      } else {
        await this.searchView.getControl().updateChildren(void 0);
      }
    } else {
      if (searchConfig.sortOrder === SearchSortOrder.CountAscending || searchConfig.sortOrder === SearchSortOrder.CountDescending) {
        await this.searchView.getControl().updateChildren(void 0);
      } else {
        const treeHasAllElements = event.elements.every((elem) => this.searchView.getControl().hasNode(elem));
        if (treeHasAllElements) {
          await Promise.all(event.elements.map(async (element) => {
            await this.searchView.getControl().updateChildren(element);
            this.searchView.getControl().rerender(element);
          }));
        } else {
          this.searchView.getControl().updateChildren(void 0);
        }
      }
    }
  }
};
RefreshTreeController = __decorateClass([
  __decorateParam(2, IFileService)
], RefreshTreeController);
export {
  SearchView,
  SearchViewPosition,
  getEditorSelectionFromMatch,
  getSelectionTextFromEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0ICogYXMgYXJpYSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IE1lc3NhZ2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2lucHV0Ym94L2lucHV0Qm94LmpzJztcbmltcG9ydCB7IElJZGVudGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJQXN5bmNEYXRhU291cmNlLCBJVHJlZUNvbnRleHRNZW51RXZlbnQsIE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL3RyZWUuanMnO1xuaW1wb3J0IHsgRGVsYXllciwgUnVuT25jZVNjaGVkdWxlciwgVGhyb3R0bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgZW52IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0ICogYXMgbmV0d29yayBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAnLi9tZWRpYS9zZWFyY2h2aWV3LmNzcyc7XG5pbXBvcnQgeyBnZXRDb2RlRWRpdG9yLCBpc0NvZGVFZGl0b3IsIGlzRGlmZkVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2NvZGVFZGl0b3IvZW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBDb21tb25GaW5kQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBNdWx0aUN1cnNvclNlbGVjdGlvbkNvbnRyb2xsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9tdWx0aWN1cnNvci9icm93c2VyL211bHRpY3Vyc29yLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UsIElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElDb25maXJtYXRpb24sIElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBGaWxlQ2hhbmdlc0V2ZW50LCBGaWxlQ2hhbmdlVHlwZSwgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IGdldFNlbGVjdGlvbktleWJvYXJkRXZlbnQsIFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSwgd2l0aFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElQcm9ncmVzcywgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzU3RlcCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgZGVmYXVsdElucHV0Qm94U3R5bGVzLCBkZWZhdWx0VG9nZ2xlU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IElGaWxlSWNvblRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IE9wZW5GaWxlRm9sZGVyQWN0aW9uLCBPcGVuRm9sZGVyQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dvcmtzcGFjZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMaXN0RG5ESGFuZGxlciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9sYWJlbHMuanMnO1xuaW1wb3J0IHsgSVZpZXdQYW5lT3B0aW9ucywgVmlld1BhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBNZW1lbnRvLCBNZW1lbnRvT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21lbWVudG8uanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvciB9IGZyb20gJy4uLy4uL25vdGVib29rL2Jyb3dzZXIvbm90ZWJvb2tFZGl0b3IuanMnO1xuaW1wb3J0IHsgRXhjbHVkZVBhdHRlcm5JbnB1dFdpZGdldCwgSW5jbHVkZVBhdHRlcm5JbnB1dFdpZGdldCB9IGZyb20gJy4vcGF0dGVybklucHV0V2lkZ2V0LmpzJztcbmltcG9ydCB7IGFwcGVuZEtleUJpbmRpbmdMYWJlbCB9IGZyb20gJy4vc2VhcmNoQWN0aW9uc0Jhc2UuanMnO1xuaW1wb3J0IHsgSUZpbmRJbkZpbGVzQXJncyB9IGZyb20gJy4vc2VhcmNoQWN0aW9uc0ZpbmQuanMnO1xuaW1wb3J0IHsgc2VhcmNoRGV0YWlsc0ljb24gfSBmcm9tICcuL3NlYXJjaEljb25zLmpzJztcbmltcG9ydCB7IHJlbmRlclNlYXJjaE1lc3NhZ2UgfSBmcm9tICcuL3NlYXJjaE1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRmlsZU1hdGNoUmVuZGVyZXIsIEZvbGRlck1hdGNoUmVuZGVyZXIsIE1hdGNoUmVuZGVyZXIsIFNlYXJjaEFjY2Vzc2liaWxpdHlQcm92aWRlciwgU2VhcmNoRGVsZWdhdGUsIFRleHRTZWFyY2hSZXN1bHRSZW5kZXJlciB9IGZyb20gJy4vc2VhcmNoUmVzdWx0c1ZpZXcuanMnO1xuaW1wb3J0IHsgU2VhcmNoV2lkZ2V0IH0gZnJvbSAnLi9zZWFyY2hXaWRnZXQuanMnO1xuaW1wb3J0ICogYXMgQ29uc3RhbnRzIGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSVJlcGxhY2VTZXJ2aWNlIH0gZnJvbSAnLi9yZXBsYWNlLmpzJztcbmltcG9ydCB7IGdldE91dE9mV29ya3NwYWNlRWRpdG9yUmVzb3VyY2VzLCBTZWFyY2hTdGF0ZUtleSwgU2VhcmNoVUlTdGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgSVNlYXJjaEhpc3RvcnlTZXJ2aWNlLCBJU2VhcmNoSGlzdG9yeVZhbHVlcywgU2VhcmNoSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2VhcmNoSGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlRWRpdG9yRnJvbVNlYXJjaFJlc3VsdCB9IGZyb20gJy4uLy4uL3NlYXJjaEVkaXRvci9icm93c2VyL3NlYXJjaEVkaXRvckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlLCBJU2V0dGluZ3NFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucywgUXVlcnlCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9xdWVyeUJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgSVBhdHRlcm5JbmZvLCBJU2VhcmNoQ29tcGxldGUsIElTZWFyY2hDb25maWd1cmF0aW9uLCBJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXMsIElTZWFyY2hTZXJ2aWNlLCBJVGV4dFF1ZXJ5LCBTZWFyY2hDb21wbGV0aW9uRXhpdENvZGUsIFNlYXJjaFNvcnRPcmRlciwgVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVR5cGUsIFZpZXdNb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoRXh0VHlwZXMuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rU2VydmljZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5U2lnbmFsL2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSVNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UgfSBmcm9tICcuL3NlYXJjaFRyZWVNb2RlbC9zZWFyY2hWaWV3TW9kZWxXb3JrYmVuY2hTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTZWFyY2hUcmVlTWF0Y2gsIGlzU2VhcmNoVHJlZU1hdGNoLCBSZW5kZXJhYmxlTWF0Y2gsIFNlYXJjaE1vZGVsTG9jYXRpb24sIElDaGFuZ2VFdmVudCwgRmlsZU1hdGNoT3JNYXRjaCwgSVNlYXJjaFRyZWVGaWxlTWF0Y2gsIElTZWFyY2hUcmVlRm9sZGVyTWF0Y2gsIElTZWFyY2hNb2RlbCwgSVNlYXJjaFJlc3VsdCwgaXNTZWFyY2hUcmVlRmlsZU1hdGNoLCBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaCwgaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2hOb1Jvb3QsIGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlLCBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3QsIGlzU2VhcmNoUmVzdWx0LCBpc1RleHRTZWFyY2hIZWFkaW5nLCBJVGV4dFNlYXJjaEhlYWRpbmcsIGlzU2VhcmNoSGVhZGVyIH0gZnJvbSAnLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tGaWxlSW5zdGFuY2VNYXRjaCwgaXNJTWF0Y2hJbk5vdGVib29rIH0gZnJvbSAnLi9ub3RlYm9va1NlYXJjaC9ub3RlYm9va1NlYXJjaE1vZGVsQmFzZS5qcyc7XG5pbXBvcnQgeyBzZWFyY2hNYXRjaENvbXBhcmVyIH0gZnJvbSAnLi9zZWFyY2hDb21wYXJlLmpzJztcbmltcG9ydCB7IEFJRm9sZGVyTWF0Y2hXb3Jrc3BhY2VSb290SW1wbCB9IGZyb20gJy4vQUlTZWFyY2gvYWlTZWFyY2hNb2RlbC5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGVudW0gU2VhcmNoVmlld1Bvc2l0aW9uIHtcblx0U2lkZUJhcixcblx0UGFuZWxcbn1cblxuY29uc3QgU0VBUkNIX0NBTkNFTExFRF9NRVNTQUdFID0gbmxzLmxvY2FsaXplKCdzZWFyY2hDYW5jZWxlZCcsIFwiU2VhcmNoIHdhcyBjYW5jZWxlZCBiZWZvcmUgYW55IHJlc3VsdHMgY291bGQgYmUgZm91bmQgLSBcIik7XG5jb25zdCBERUJPVU5DRV9ERUxBWSA9IDc1O1xuZXhwb3J0IGNsYXNzIFNlYXJjaFZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQUNUSU9OU19SSUdIVF9DTEFTU19OQU1FID0gJ2FjdGlvbnMtcmlnaHQnO1xuXG5cdHByaXZhdGUgaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdHByaXZhdGUgY29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcXVlcnlCdWlsZGVyOiBRdWVyeUJ1aWxkZXI7XG5cdHByaXZhdGUgdmlld01vZGVsOiBJU2VhcmNoTW9kZWw7XG5cdHByaXZhdGUgbWVtZW50bzogTWVtZW50bztcblxuXHRwcml2YXRlIHZpZXdsZXRWaXNpYmxlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBpbnB1dEJveEZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGlucHV0UGF0dGVybkluY2x1ZGVzRm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaW5wdXRQYXR0ZXJuRXhjbHVzaW9uc0ZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGZpcnN0TWF0Y2hGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBmaWxlTWF0Y2hPck1hdGNoRm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgZmlsZU1hdGNoT3JGb2xkZXJNYXRjaEZvY3VzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBmaWxlTWF0Y2hPckZvbGRlck1hdGNoV2l0aFJlc291cmNlRm9jdXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGZpbGVNYXRjaEZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGZvbGRlck1hdGNoRm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgZm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VGb2N1c2VkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBtYXRjaEZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHNlYXJjaFJlc3VsdEhlYWRlckZvY3VzZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGlzRWRpdGFibGVJdGVtOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBoYXNTZWFyY2hSZXN1bHRzS2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBsYXN0Rm9jdXNTdGF0ZTogJ2lucHV0JyB8ICd0cmVlJyA9ICdpbnB1dCc7XG5cblx0cHJpdmF0ZSBzZWFyY2hTdGF0ZUtleTogSUNvbnRleHRLZXk8U2VhcmNoVUlTdGF0ZT47XG5cdHByaXZhdGUgaGFzU2VhcmNoUGF0dGVybktleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaGFzUmVwbGFjZVBhdHRlcm5LZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGhhc0ZpbGVQYXR0ZXJuS2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBoYXNTb21lQ29sbGFwc2libGVSZXN1bHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgdHJlZSE6IFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWU8SVNlYXJjaFJlc3VsdCwgUmVuZGVyYWJsZU1hdGNoPjtcblx0cHJpdmF0ZSB0cmVlTGFiZWxzITogUmVzb3VyY2VMYWJlbHM7XG5cdHByaXZhdGUgdmlld2xldFN0YXRlOiBNZW1lbnRvT2JqZWN0O1xuXHRwcml2YXRlIG1lc3NhZ2VzRWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHNlYXJjaFdpZGdldHNDb250YWluZXJFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgc2VhcmNoV2lkZ2V0ITogU2VhcmNoV2lkZ2V0O1xuXHRwcml2YXRlIHNpemUhOiBkb20uRGltZW5zaW9uO1xuXHRwcml2YXRlIHF1ZXJ5RGV0YWlscyE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRvZ2dsZVF1ZXJ5RGV0YWlsc0J1dHRvbiE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGlucHV0UGF0dGVybkV4Y2x1ZGVzITogRXhjbHVkZVBhdHRlcm5JbnB1dFdpZGdldDtcblx0cHJpdmF0ZSBpbnB1dFBhdHRlcm5JbmNsdWRlcyE6IEluY2x1ZGVQYXR0ZXJuSW5wdXRXaWRnZXQ7XG5cdHByaXZhdGUgcmVzdWx0c0VsZW1lbnQhOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIGN1cnJlbnRTZWxlY3RlZEZpbGVNYXRjaDogSVNlYXJjaFRyZWVGaWxlTWF0Y2ggfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBkZWxheWVkUmVmcmVzaDogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBjaGFuZ2VkV2hpbGVIaWRkZW46IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBzZWFyY2hXaXRob3V0Rm9sZGVyTWVzc2FnZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgY3VycmVudFNlYXJjaFEgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0cHJpdmF0ZSBhZGRUb1NlYXJjaEhpc3RvcnlEZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXG5cdHByaXZhdGUgdG9nZ2xlQ29sbGFwc2VTdGF0ZURlbGF5ZXI6IERlbGF5ZXI8dm9pZD47XG5cblx0cHJpdmF0ZSB0cmlnZ2VyUXVlcnlEZWxheWVyOiBEZWxheWVyPHZvaWQ+O1xuXHRwcml2YXRlIHBhdXNlU2VhcmNoaW5nID0gZmFsc2U7XG5cblx0cHJpdmF0ZSB0cmVlQWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBTZWFyY2hBY2Nlc3NpYmlsaXR5UHJvdmlkZXI7XG5cblx0cHJpdmF0ZSB0cmVlVmlld0tleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBfdmlzaWJsZU1hdGNoZXM6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSBfcmVmcmVzaFJlc3VsdHNTY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cblx0cHJpdmF0ZSBfb25TZWFyY2hSZXN1bHRDaGFuZ2VkRGlzcG9zYWJsZTogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBzZWFyY2hEYXRhU291cmNlOiBTZWFyY2hWaWV3RGF0YVNvdXJjZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlZnJlc2hUcmVlQ29udHJvbGxlcjogUmVmcmVzaFRyZWVDb250cm9sbGVyO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJVmlld1BhbmVPcHRpb25zLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJU2VhcmNoVmlld01vZGVsV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2U6IElTZWFyY2hWaWV3TW9kZWxXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVJlcGxhY2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVwbGFjZVNlcnZpY2U6IElSZXBsYWNlU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElTZWFyY2hIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNlYXJjaEhpc3RvcnlTZXJ2aWNlOiBJU2VhcmNoSGlzdG9yeVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVNlYXJjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzZWFyY2hTZXJ2aWNlOiBJU2VhcmNoU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90ZWJvb2tTZXJ2aWNlOiBJTm90ZWJvb2tTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZTogSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlXG5cdCkge1xuXG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cblx0XHR0aGlzLmNvbnRhaW5lciA9IGRvbS4kKCcuc2VhcmNoLXZpZXcnKTtcblxuXHRcdC8vIGdsb2JhbHNcblx0XHR0aGlzLnZpZXdsZXRWaXNpYmxlID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld1Zpc2libGVLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuZmlyc3RNYXRjaEZvY3VzZWQgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaXJzdE1hdGNoRm9jdXNLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuZmlsZU1hdGNoT3JNYXRjaEZvY3VzZWQgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaWxlTWF0Y2hPck1hdGNoRm9jdXNLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuZmlsZU1hdGNoT3JGb2xkZXJNYXRjaEZvY3VzID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZU1hdGNoT3JGb2xkZXJNYXRjaEZvY3VzS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmZpbGVNYXRjaE9yRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VGb2N1cyA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZpbGVNYXRjaE9yRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VGb2N1c0tleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5maWxlTWF0Y2hGb2N1c2VkID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZUZvY3VzS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmZvbGRlck1hdGNoRm9jdXNlZCA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmZvbGRlck1hdGNoV2l0aFJlc291cmNlRm9jdXNlZCA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlc291cmNlRm9sZGVyRm9jdXNLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2VhcmNoUmVzdWx0SGVhZGVyRm9jdXNlZCA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFJlc3VsdEhlYWRlckZvY3VzZWQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaGFzU2VhcmNoUmVzdWx0c0tleSA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lkhhc1NlYXJjaFJlc3VsdHMuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMubWF0Y2hGb2N1c2VkID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuTWF0Y2hGb2N1c0tleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hTdGF0ZUtleSA9IFNlYXJjaFN0YXRlS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmhhc1NlYXJjaFBhdHRlcm5LZXkgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5WaWV3SGFzU2VhcmNoUGF0dGVybktleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5oYXNSZXBsYWNlUGF0dGVybktleSA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlZpZXdIYXNSZXBsYWNlUGF0dGVybktleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5oYXNGaWxlUGF0dGVybktleSA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlZpZXdIYXNGaWxlUGF0dGVybktleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5oYXNTb21lQ29sbGFwc2libGVSZXN1bHRLZXkgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5WaWV3SGFzU29tZUNvbGxhcHNpYmxlS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnRyZWVWaWV3S2V5ID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSW5UcmVlVmlld0tleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5yZWZyZXNoVHJlZUNvbnRyb2xsZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlZnJlc2hUcmVlQ29udHJvbGxlciwgdGhpcywgKCkgPT4gdGhpcy5zZWFyY2hDb25maWcpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0Y29uc3Qga2V5cyA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lmhhc0FJUmVzdWx0UHJvdmlkZXIua2V5cygpO1xuXHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUobmV3IFNldChrZXlzKSkpIHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoSGFzQUlTZXR0aW5nKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gc2NvcGVkXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuY29udGFpbmVyKSk7XG5cdFx0Q29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld0ZvY3VzZWRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpLnNldCh0cnVlKTtcblx0XHR0aGlzLmlucHV0Qm94Rm9jdXNlZCA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklucHV0Qm94Rm9jdXNlZEtleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlc0ZvY3VzZWQgPSBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5QYXR0ZXJuSW5jbHVkZXNGb2N1c2VkS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmlucHV0UGF0dGVybkV4Y2x1c2lvbnNGb2N1c2VkID0gQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuUGF0dGVybkV4Y2x1ZGVzRm9jdXNlZEtleS5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5pc0VkaXRhYmxlSXRlbSA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklzRWRpdGFibGVJdGVtS2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKFxuXHRcdFx0bmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuY29udGV4dEtleVNlcnZpY2VdKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2VhcmNoLnNvcnRPcmRlcicpKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNlYXJjaENvbmZpZy5zb3J0T3JkZXIgPT09IFNlYXJjaFNvcnRPcmRlci5Nb2RpZmllZCkge1xuXHRcdFx0XHRcdC8vIElmIGNoYW5naW5nIGF3YXkgZnJvbSBtb2RpZmllZCwgcmVtb3ZlIGFsbCBmaWxlU3RhdHNcblx0XHRcdFx0XHQvLyBzbyB0aGF0IHVwZGF0ZWQgZmlsZXMgYXJlIHJlLXJldHJpZXZlZCBuZXh0IHRpbWUuXG5cdFx0XHRcdFx0dGhpcy5yZW1vdmVGaWxlU3RhdHMoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhd2FpdCB0aGlzLnJlZnJlc2hUcmVlQ29udHJvbGxlci5xdWV1ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMudmlld01vZGVsID0gdGhpcy5zZWFyY2hWaWV3TW9kZWxXb3JrYmVuY2hTZXJ2aWNlLnNlYXJjaE1vZGVsO1xuXHRcdHRoaXMucXVlcnlCdWlsZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXHRcdHRoaXMubWVtZW50byA9IG5ldyBNZW1lbnRvKHRoaXMuaWQsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLnZpZXdsZXRTdGF0ZSA9IHRoaXMubWVtZW50by5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB0aGlzLm9uRmlsZXNDaGFuZ2VkKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50ZXh0RmlsZVNlcnZpY2UudW50aXRsZWQub25XaWxsRGlzcG9zZShtb2RlbCA9PiB0aGlzLm9uVW50aXRsZWREaWREaXNwb3NlKG1vZGVsLnJlc291cmNlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSgoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoSGlzdG9yeVNlcnZpY2Uub25EaWRDbGVhckhpc3RvcnkoKCkgPT4gdGhpcy5jbGVhckhpc3RvcnkoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdGhpcy5vbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGUpKSk7XG5cblx0XHR0aGlzLmRlbGF5ZWRSZWZyZXNoID0gdGhpcy5fcmVnaXN0ZXIobmV3IERlbGF5ZXI8dm9pZD4oMjUwKSk7XG5cblx0XHR0aGlzLmFkZFRvU2VhcmNoSGlzdG9yeURlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGVsYXllcjx2b2lkPigyMDAwKSk7XG5cdFx0dGhpcy50b2dnbGVDb2xsYXBzZVN0YXRlRGVsYXllciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVyPHZvaWQ+KDEwMCkpO1xuXHRcdHRoaXMudHJpZ2dlclF1ZXJ5RGVsYXllciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVyPHZvaWQ+KDApKTtcblxuXHRcdHRoaXMudHJlZUFjY2Vzc2liaWxpdHlQcm92aWRlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoQWNjZXNzaWJpbGl0eVByb3ZpZGVyLCB0aGlzKTtcblx0XHR0aGlzLmlzVHJlZUxheW91dFZpZXdWaXNpYmxlID0gdGhpcy52aWV3bGV0U3RhdGVbJ3ZpZXcudHJlZUxheW91dCddID8/ICh0aGlzLnNlYXJjaENvbmZpZy5kZWZhdWx0Vmlld01vZGUgPT09IFZpZXdNb2RlLlRyZWUpO1xuXG5cdFx0dGhpcy5fcmVmcmVzaFJlc3VsdHNTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcih0aGlzLl91cGRhdGVSZXN1bHRzLmJpbmQodGhpcyksIDgwKSk7XG5cblx0XHQvLyBzdG9yYWdlIHNlcnZpY2UgbGlzdGVuZXIgZm9yIGZvciByb2FtaW5nIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9zYXZlU2VhcmNoSGlzdG9yeVNlcnZpY2UoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU2VhcmNoSGlzdG9yeVNlcnZpY2UuU0VBUkNIX0hJU1RPUllfS0VZLCB0aGlzLl9zdG9yZSkoKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdG9yZWRIaXN0b3J5ID0gdGhpcy5zZWFyY2hIaXN0b3J5U2VydmljZS5sb2FkKCk7XG5cblx0XHRcdGlmIChyZXN0b3JlZEhpc3RvcnkuaW5jbHVkZSkge1xuXHRcdFx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnByZXBlbmRIaXN0b3J5KHJlc3RvcmVkSGlzdG9yeS5pbmNsdWRlKTtcblx0XHRcdH1cblx0XHRcdGlmIChyZXN0b3JlZEhpc3RvcnkuZXhjbHVkZSkge1xuXHRcdFx0XHR0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLnByZXBlbmRIaXN0b3J5KHJlc3RvcmVkSGlzdG9yeS5leGNsdWRlKTtcblx0XHRcdH1cblx0XHRcdGlmIChyZXN0b3JlZEhpc3Rvcnkuc2VhcmNoKSB7XG5cdFx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnByZXBlbmRTZWFyY2hIaXN0b3J5KHJlc3RvcmVkSGlzdG9yeS5zZWFyY2gpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3RvcmVkSGlzdG9yeS5yZXBsYWNlKSB7XG5cdFx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnByZXBlbmRSZXBsYWNlSGlzdG9yeShyZXN0b3JlZEhpc3RvcnkucmVwbGFjZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jaGFuZ2VkV2hpbGVIaWRkZW4gPSB0aGlzLmhhc1NlYXJjaFJlc3VsdHMoKTtcblx0fVxuXG5cdGFzeW5jIHF1ZXVlUmVmcmVzaFRyZWUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCk7XG5cdH1cblx0Z2V0IGlzVHJlZUxheW91dFZpZXdWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnRyZWVWaWV3S2V5LmdldCgpID8/IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXQgaXNUcmVlTGF5b3V0Vmlld1Zpc2libGUodmlzaWJsZTogYm9vbGVhbikge1xuXHRcdHRoaXMudHJlZVZpZXdLZXkuc2V0KHZpc2libGUpO1xuXHR9XG5cblx0YXN5bmMgc2V0VHJlZVZpZXcodmlzaWJsZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh2aXNpYmxlID09PSB0aGlzLmlzVHJlZUxheW91dFZpZXdWaXNpYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuaXNUcmVlTGF5b3V0Vmlld1Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdHRoaXMudXBkYXRlSW5kZW50U3R5bGVzKHRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKSk7XG5cdFx0cmV0dXJuIHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBzdGF0ZSgpOiBTZWFyY2hVSVN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hTdGF0ZUtleS5nZXQoKSA/PyBTZWFyY2hVSVN0YXRlLklkbGU7XG5cdH1cblxuXHRwcml2YXRlIHNldCBzdGF0ZSh2OiBTZWFyY2hVSVN0YXRlKSB7XG5cdFx0dGhpcy5zZWFyY2hTdGF0ZUtleS5zZXQodik7XG5cdH1cblxuXHRnZXRDb250YWluZXIoKTogSFRNTEVsZW1lbnQge1xuXHRcdHJldHVybiB0aGlzLmNvbnRhaW5lcjtcblx0fVxuXG5cdGdldCBzZWFyY2hSZXN1bHQoKTogSVNlYXJjaFJlc3VsdCB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsICYmIHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdDtcblx0fVxuXG5cdGdldCBtb2RlbCgpOiBJU2VhcmNoTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLnZpZXdNb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVmcmVzaEhhc0FJU2V0dGluZygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzaG91bGRTaG93QUkgPSB0aGlzLnNob3VsZFNob3dBSVJlc3VsdHMoKTtcblx0XHRpZiAoIXRoaXMudHJlZS5oYXNOb2RlKHRoaXMuc2VhcmNoUmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoc2hvdWxkU2hvd0FJICYmICF0aGlzLnRyZWUuaGFzTm9kZSh0aGlzLnNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpKSB7XG5cdFx0XHRpZiAodGhpcy5tb2RlbC5zZWFyY2hSZXN1bHQuZ2V0Q2FjaGVkU2VhcmNoQ29tcGxldGUoZmFsc2UpKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJlZnJlc2hBbmRVcGRhdGVDb3VudCgpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoIXNob3VsZFNob3dBSSAmJiB0aGlzLnRyZWUuaGFzTm9kZSh0aGlzLnNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5yZWZyZXNoQW5kVXBkYXRlQ291bnQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgJiYgdGhpcy5zZWFyY2hXaXRob3V0Rm9sZGVyTWVzc2FnZUVsZW1lbnQpIHtcblx0XHRcdGRvbS5oaWRlKHRoaXMuc2VhcmNoV2l0aG91dEZvbGRlck1lc3NhZ2VFbGVtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZnJlc2hJbnB1dHMoKSB7XG5cdFx0dGhpcy5wYXVzZVNlYXJjaGluZyA9IHRydWU7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0VmFsdWUodGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LnF1ZXJ5Py5jb250ZW50UGF0dGVybi5wYXR0ZXJuID8/ICcnKTtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRSZXBsYWNlQWxsQWN0aW9uU3RhdGUoZmFsc2UpO1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnRvZ2dsZVJlcGxhY2UodHJ1ZSk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5zZXRPbmx5U2VhcmNoSW5PcGVuRWRpdG9ycyh0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQucXVlcnk/Lm9ubHlPcGVuRWRpdG9ycyB8fCBmYWxzZSk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5zZXRVc2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzKCF0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQucXVlcnk/LnVzZXJEaXNhYmxlZEV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMgfHwgdHJ1ZSk7XG5cdFx0dGhpcy5zZWFyY2hJbmNsdWRlUGF0dGVybi5zZXRWYWx1ZSgnJyk7XG5cdFx0dGhpcy5zZWFyY2hFeGNsdWRlUGF0dGVybi5zZXRWYWx1ZSgnJyk7XG5cdFx0dGhpcy5wYXVzZVNlYXJjaGluZyA9IGZhbHNlO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlcGxhY2VTZWFyY2hNb2RlbChzZWFyY2hNb2RlbDogSVNlYXJjaE1vZGVsLCBhc3luY1Jlc3VsdHM6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBwcm9ncmVzc0NvbXBsZXRlOiAoKSA9PiB2b2lkO1xuXHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmdldFByb2dyZXNzTG9jYXRpb24oKSwgZGVsYXk6IDAgfSwgX3Byb2dyZXNzID0+IHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHByb2dyZXNzQ29tcGxldGUgPSByZXNvbHZlKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHNsb3dUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5zdGF0ZSA9IFNlYXJjaFVJU3RhdGUuU2xvd1NlYXJjaDtcblx0XHR9LCAyMDAwKTtcblxuXHRcdHRoaXMuX3JlZnJlc2hSZXN1bHRzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cblx0XHQvLyByZW1vdmUgb2xkIG1vZGVsIGFuZCB1c2UgdGhlIG5ldyBzZWFyY2hNb2RlbFxuXHRcdHNlYXJjaE1vZGVsLmxvY2F0aW9uID0gU2VhcmNoTW9kZWxMb2NhdGlvbi5QQU5FTDtcblx0XHRzZWFyY2hNb2RlbC5yZXBsYWNlQWN0aXZlID0gdGhpcy52aWV3TW9kZWwuaXNSZXBsYWNlQWN0aXZlKCk7XG5cdFx0c2VhcmNoTW9kZWwucmVwbGFjZVN0cmluZyA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFJlcGxhY2VWYWx1ZSgpO1xuXHRcdHRoaXMuX29uU2VhcmNoUmVzdWx0Q2hhbmdlZERpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vblNlYXJjaFJlc3VsdENoYW5nZWREaXNwb3NhYmxlID0gdGhpcy5fcmVnaXN0ZXIoc2VhcmNoTW9kZWwub25TZWFyY2hSZXN1bHRDaGFuZ2VkKGFzeW5jIChldmVudCkgPT4gdGhpcy5vblNlYXJjaFJlc3VsdHNDaGFuZ2VkKGV2ZW50KSkpO1xuXG5cdFx0Ly8gdGhpcyBjYWxsIHdpbGwgYWxzbyBkaXNwb3NlIG9mIHRoZSBvbGQgbW9kZWxcblx0XHR0aGlzLnNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2Uuc2VhcmNoTW9kZWwgPSBzZWFyY2hNb2RlbDtcblx0XHR0aGlzLnZpZXdNb2RlbCA9IHNlYXJjaE1vZGVsO1xuXHRcdHRoaXMudHJlZS5zZXRJbnB1dCh0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQpO1xuXG5cdFx0YXdhaXQgdGhpcy5vblNlYXJjaFJlc3VsdHNDaGFuZ2VkKCk7XG5cdFx0dGhpcy5yZWZyZXNoSW5wdXRzKCk7XG5cblx0XHRhc3luY1Jlc3VsdHMudGhlbigoY29tcGxldGUpID0+IHtcblx0XHRcdGNsZWFyVGltZW91dChzbG93VGltZXIpO1xuXHRcdFx0cmV0dXJuIHRoaXMub25TZWFyY2hDb21wbGV0ZShwcm9ncmVzc0NvbXBsZXRlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY29tcGxldGUpO1xuXHRcdH0sIChlKSA9PiB7XG5cdFx0XHRjbGVhclRpbWVvdXQoc2xvd1RpbWVyKTtcblx0XHRcdHJldHVybiB0aGlzLm9uU2VhcmNoRXJyb3IoZSwgcHJvZ3Jlc3NDb21wbGV0ZSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXG5cdFx0YXdhaXQgdGhpcy5leHBhbmRJZlNpbmd1bGFyUmVzdWx0KCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShwYXJlbnQpO1xuXHRcdHRoaXMuY29udGFpbmVyID0gZG9tLmFwcGVuZChwYXJlbnQsIGRvbS4kKCcuc2VhcmNoLXZpZXcnKSk7XG5cblx0XHR0aGlzLnNlYXJjaFdpZGdldHNDb250YWluZXJFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnLnNlYXJjaC13aWRnZXRzLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLmNyZWF0ZVNlYXJjaFdpZGdldCh0aGlzLnNlYXJjaFdpZGdldHNDb250YWluZXJFbGVtZW50KTtcblxuXHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLnNlYXJjaEhpc3RvcnlTZXJ2aWNlLmxvYWQoKTtcblx0XHRjb25zdCBmaWxlUGF0dGVybnMgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuZmlsZVBhdHRlcm5zJ10gfHwgJyc7XG5cdFx0Y29uc3QgcGF0dGVybkV4Y2x1c2lvbnMgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuZm9sZGVyRXhjbHVzaW9ucyddIHx8ICcnO1xuXHRcdGNvbnN0IHBhdHRlcm5FeGNsdXNpb25zSGlzdG9yeTogc3RyaW5nW10gPSBoaXN0b3J5LmV4Y2x1ZGUgfHwgW107XG5cdFx0Y29uc3QgcGF0dGVybkluY2x1ZGVzID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LmZvbGRlckluY2x1ZGVzJ10gfHwgJyc7XG5cdFx0Y29uc3QgcGF0dGVybkluY2x1ZGVzSGlzdG9yeTogc3RyaW5nW10gPSBoaXN0b3J5LmluY2x1ZGUgfHwgW107XG5cdFx0Y29uc3Qgb25seU9wZW5FZGl0b3JzID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5Lm9ubHlPcGVuRWRpdG9ycyddIHx8IGZhbHNlO1xuXG5cdFx0Y29uc3QgcXVlcnlEZXRhaWxzRXhwYW5kZWQgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkucXVlcnlEZXRhaWxzRXhwYW5kZWQnXSB8fCAnJztcblx0XHRjb25zdCB1c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzID0gdHlwZW9mIHRoaXMudmlld2xldFN0YXRlWydxdWVyeS51c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzJ10gPT09ICdib29sZWFuJyA/XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkudXNlRXhjbHVkZXNBbmRJZ25vcmVGaWxlcyddIDogdHJ1ZTtcblxuXHRcdHRoaXMucXVlcnlEZXRhaWxzID0gZG9tLmFwcGVuZCh0aGlzLnNlYXJjaFdpZGdldHNDb250YWluZXJFbGVtZW50LCAkKCcucXVlcnktZGV0YWlscycpKTtcblxuXHRcdC8vIFRvZ2dsZSBxdWVyeSBkZXRhaWxzIGJ1dHRvblxuXHRcdGNvbnN0IHRvZ2dsZVF1ZXJ5RGV0YWlsc0xhYmVsID0gbmxzLmxvY2FsaXplKCdtb3JlU2VhcmNoJywgXCJUb2dnbGUgU2VhcmNoIERldGFpbHNcIik7XG5cdFx0dGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24gPSBkb20uYXBwZW5kKHRoaXMucXVlcnlEZXRhaWxzLFxuXHRcdFx0JCgnLm1vcmUnICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3Ioc2VhcmNoRGV0YWlsc0ljb24pLCB7IHRhYmluZGV4OiAwLCByb2xlOiAnYnV0dG9uJywgJ2FyaWEtbGFiZWwnOiB0b2dnbGVRdWVyeURldGFpbHNMYWJlbCB9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ2VsZW1lbnQnKSwgdGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24sIHRvZ2dsZVF1ZXJ5RGV0YWlsc0xhYmVsKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzQnV0dG9uLCBkb20uRXZlbnRUeXBlLkNMSUNLLCBlID0+IHtcblx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdFx0dGhpcy50b2dnbGVRdWVyeURldGFpbHMoIXRoaXMuYWNjZXNzaWJpbGl0eVNlcnZpY2UuaXNTY3JlZW5SZWFkZXJPcHRpbWl6ZWQoKSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24sIGRvbS5FdmVudFR5cGUuS0VZX1VQLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSkge1xuXHRcdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblx0XHRcdFx0dGhpcy50b2dnbGVRdWVyeURldGFpbHMoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzQnV0dG9uLCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleU1vZC5TaGlmdCB8IEtleUNvZGUuVGFiKSkge1xuXHRcdFx0XHRpZiAodGhpcy5zZWFyY2hXaWRnZXQuaXNSZXBsYWNlQWN0aXZlKCkpIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1c1JlcGxhY2VBbGxBY3Rpb24oKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5pc1JlcGxhY2VTaG93bigpID8gdGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0Py5mb2N1c09uUHJlc2VydmUoKSA6IHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzUmVnZXhBY3Rpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBmb2xkZXIgaW5jbHVkZXMgbGlzdFxuXHRcdGNvbnN0IGZvbGRlckluY2x1ZGVzTGlzdCA9IGRvbS5hcHBlbmQodGhpcy5xdWVyeURldGFpbHMsICQoJy5maWxlLXR5cGVzLmluY2x1ZGVzJykpO1xuXHRcdGNvbnN0IGZpbGVzVG9JbmNsdWRlVGl0bGUgPSBubHMubG9jYWxpemUoJ3NlYXJjaFNjb3BlLmluY2x1ZGVzJywgXCJmaWxlcyB0byBpbmNsdWRlXCIpO1xuXHRcdGRvbS5hcHBlbmQoZm9sZGVySW5jbHVkZXNMaXN0LCAkKCdoNCcsIHVuZGVmaW5lZCwgZmlsZXNUb0luY2x1ZGVUaXRsZSkpO1xuXG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5jbHVkZVBhdHRlcm5JbnB1dFdpZGdldCwgZm9sZGVySW5jbHVkZXNMaXN0LCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwge1xuXHRcdFx0YXJpYUxhYmVsOiBmaWxlc1RvSW5jbHVkZVRpdGxlLFxuXHRcdFx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgncGxhY2Vob2xkZXIuaW5jbHVkZXMnLCBcImUuZy4gKi50cywgc3JjLyoqL2luY2x1ZGVcIiksXG5cdFx0XHRzaG93UGxhY2Vob2xkZXJPbkZvY3VzOiB0cnVlLFxuXHRcdFx0aGlzdG9yeTogcGF0dGVybkluY2x1ZGVzSGlzdG9yeSxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXNcblx0XHR9KSk7XG5cblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNldFZhbHVlKHBhdHRlcm5JbmNsdWRlcyk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5zZXRPbmx5U2VhcmNoSW5PcGVuRWRpdG9ycyhvbmx5T3BlbkVkaXRvcnMpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5vbkNhbmNlbCgoKSA9PiB0aGlzLmNhbmNlbFNlYXJjaChmYWxzZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLm9uQ2hhbmdlU2VhcmNoSW5FZGl0b3JzQm94KCgpID0+IHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKCkpKTtcblxuXHRcdHRoaXMudHJhY2tJbnB1dEJveCh0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLmlucHV0Rm9jdXNUcmFja2VyLCB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzRm9jdXNlZCk7XG5cblx0XHQvLyBleGNsdWRlcyBsaXN0XG5cdFx0Y29uc3QgZXhjbHVkZXNMaXN0ID0gZG9tLmFwcGVuZCh0aGlzLnF1ZXJ5RGV0YWlscywgJCgnLmZpbGUtdHlwZXMuZXhjbHVkZXMnKSk7XG5cdFx0Y29uc3QgZXhjbHVkZXNUaXRsZSA9IG5scy5sb2NhbGl6ZSgnc2VhcmNoU2NvcGUuZXhjbHVkZXMnLCBcImZpbGVzIHRvIGV4Y2x1ZGVcIik7XG5cdFx0ZG9tLmFwcGVuZChleGNsdWRlc0xpc3QsICQoJ2g0JywgdW5kZWZpbmVkLCBleGNsdWRlc1RpdGxlKSk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXhjbHVkZVBhdHRlcm5JbnB1dFdpZGdldCwgZXhjbHVkZXNMaXN0LCB0aGlzLmNvbnRleHRWaWV3U2VydmljZSwge1xuXHRcdFx0YXJpYUxhYmVsOiBleGNsdWRlc1RpdGxlLFxuXHRcdFx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgncGxhY2Vob2xkZXIuZXhjbHVkZXMnLCBcImUuZy4gKi50cywgc3JjLyoqL2V4Y2x1ZGVcIiksXG5cdFx0XHRzaG93UGxhY2Vob2xkZXJPbkZvY3VzOiB0cnVlLFxuXHRcdFx0aGlzdG9yeTogcGF0dGVybkV4Y2x1c2lvbnNIaXN0b3J5LFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlc1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuc2V0VmFsdWUocGF0dGVybkV4Y2x1c2lvbnMpO1xuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuc2V0VXNlRXhjbHVkZXNBbmRJZ25vcmVGaWxlcyh1c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMub25DYW5jZWwoKCkgPT4gdGhpcy5jYW5jZWxTZWFyY2goZmFsc2UpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5vbkNoYW5nZUlnbm9yZUJveCgoKSA9PiB0aGlzLnRyaWdnZXJRdWVyeUNoYW5nZSgpKSk7XG5cdFx0dGhpcy50cmFja0lucHV0Qm94KHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuaW5wdXRGb2N1c1RyYWNrZXIsIHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVzaW9uc0ZvY3VzZWQpO1xuXG5cdFx0Y29uc3QgdXBkYXRlSGFzRmlsZVBhdHRlcm5LZXkgPSAoKSA9PiB0aGlzLmhhc0ZpbGVQYXR0ZXJuS2V5LnNldCh0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLmdldFZhbHVlKCkubGVuZ3RoID4gMCB8fCB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLmdldFZhbHVlKCkubGVuZ3RoID4gMCk7XG5cdFx0dXBkYXRlSGFzRmlsZVBhdHRlcm5LZXkoKTtcblx0XHRjb25zdCBvbkZpbGVQYXR0ZXJuU3VibWl0ID0gKHRyaWdnZXJlZE9uVHlwZTogYm9vbGVhbikgPT4ge1xuXHRcdFx0dGhpcy50cmlnZ2VyUXVlcnlDaGFuZ2UoeyB0cmlnZ2VyZWRPblR5cGUsIGRlbGF5OiB0aGlzLnNlYXJjaENvbmZpZy5zZWFyY2hPblR5cGVEZWJvdW5jZVBlcmlvZCB9KTtcblx0XHRcdGlmICh0cmlnZ2VyZWRPblR5cGUpIHtcblx0XHRcdFx0dXBkYXRlSGFzRmlsZVBhdHRlcm5LZXkoKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMub25TdWJtaXQob25GaWxlUGF0dGVyblN1Ym1pdCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMub25TdWJtaXQob25GaWxlUGF0dGVyblN1Ym1pdCkpO1xuXG5cdFx0dGhpcy5tZXNzYWdlc0VsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcubWVzc2FnZXMudGV4dC1zZWFyY2gtcHJvdmlkZXItbWVzc2FnZXMnKSk7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdHRoaXMuc2hvd1NlYXJjaFdpdGhvdXRGb2xkZXJNZXNzYWdlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jcmVhdGVTZWFyY2hSZXN1bHRzVmlldyh0aGlzLmNvbnRhaW5lcik7XG5cblx0XHRpZiAoZmlsZVBhdHRlcm5zICE9PSAnJyB8fCBwYXR0ZXJuRXhjbHVzaW9ucyAhPT0gJycgfHwgcGF0dGVybkluY2x1ZGVzICE9PSAnJyB8fCBxdWVyeURldGFpbHNFeHBhbmRlZCAhPT0gJycgfHwgIXVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMpIHtcblx0XHRcdHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzKHRydWUsIHRydWUsIHRydWUpO1xuXHRcdH1cblxuXHRcdHRoaXMuX29uU2VhcmNoUmVzdWx0Q2hhbmdlZERpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdNb2RlbC5vblNlYXJjaFJlc3VsdENoYW5nZWQoYXN5bmMgKGV2ZW50KSA9PiBhd2FpdCB0aGlzLm9uU2VhcmNoUmVzdWx0c0NoYW5nZWQoZXZlbnQpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkodmlzaWJsZSA9PiB0aGlzLm9uVmlzaWJpbGl0eUNoYW5nZWQodmlzaWJsZSkpKTtcblxuXHRcdHRoaXMudXBkYXRlSW5kZW50U3R5bGVzKHRoaXMudGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50aGVtZVNlcnZpY2Uub25EaWRGaWxlSWNvblRoZW1lQ2hhbmdlKHRoaXMudXBkYXRlSW5kZW50U3R5bGVzLCB0aGlzKSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUluZGVudFN0eWxlcyh0aGVtZTogSUZpbGVJY29uVGhlbWUpOiB2b2lkIHtcblx0XHR0aGlzLnJlc3VsdHNFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUtYXJyb3dzJywgdGhpcy5pc1RyZWVMYXlvdXRWaWV3VmlzaWJsZSAmJiB0aGVtZS5oaWRlc0V4cGxvcmVyQXJyb3dzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25WaXNpYmlsaXR5Q2hhbmdlZCh2aXNpYmxlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy52aWV3bGV0VmlzaWJsZS5zZXQodmlzaWJsZSk7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdGlmICh0aGlzLmNoYW5nZWRXaGlsZUhpZGRlbikge1xuXHRcdFx0XHQvLyBSZW5kZXIgaWYgcmVzdWx0cyBjaGFuZ2VkIHdoaWxlIHZpZXdsZXQgd2FzIGhpZGRlbiAtICMzNzgxOFxuXHRcdFx0XHRhd2FpdCB0aGlzLnJlZnJlc2hBbmRVcGRhdGVDb3VudCgpO1xuXHRcdFx0XHR0aGlzLmNoYW5nZWRXaGlsZUhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBSZXNldCBsYXN0IGZvY3VzIHRvIGlucHV0IHRvIHByZXNlcnZlIG9wZW5pbmcgdGhlIHZpZXdsZXQgYWx3YXlzIGZvY3VzaW5nIHRoZSBxdWVyeSBlZGl0b3IuXG5cdFx0XHR0aGlzLmxhc3RGb2N1c1N0YXRlID0gJ2lucHV0Jztcblx0XHR9XG5cblx0XHQvLyBFbmFibGUgaGlnaGxpZ2h0cyBpZiB0aGVyZSBhcmUgc2VhcmNocmVzdWx0c1xuXHRcdHRoaXMudmlld01vZGVsPy5zZWFyY2hSZXN1bHQudG9nZ2xlSGlnaGxpZ2h0cyh2aXNpYmxlKTtcblx0fVxuXG5cdGdldCBzZWFyY2hBbmRSZXBsYWNlV2lkZ2V0KCk6IFNlYXJjaFdpZGdldCB7XG5cdFx0cmV0dXJuIHRoaXMuc2VhcmNoV2lkZ2V0O1xuXHR9XG5cblx0Z2V0IHNlYXJjaEluY2x1ZGVQYXR0ZXJuKCk6IEluY2x1ZGVQYXR0ZXJuSW5wdXRXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzO1xuXHR9XG5cblx0Z2V0IHNlYXJjaEV4Y2x1ZGVQYXR0ZXJuKCk6IEV4Y2x1ZGVQYXR0ZXJuSW5wdXRXaWRnZXQge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTZWFyY2hXaWRnZXQoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRlbnRQYXR0ZXJuID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LmNvbnRlbnRQYXR0ZXJuJ10gfHwgJyc7XG5cdFx0Y29uc3QgcmVwbGFjZVRleHQgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkucmVwbGFjZVRleHQnXSB8fCAnJztcblx0XHRjb25zdCBpc1JlZ2V4ID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LnJlZ2V4J10gPT09IHRydWU7XG5cdFx0Y29uc3QgaXNXaG9sZVdvcmRzID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5Lndob2xlV29yZHMnXSA9PT0gdHJ1ZTtcblx0XHRjb25zdCBpc0Nhc2VTZW5zaXRpdmUgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuY2FzZVNlbnNpdGl2ZSddID09PSB0cnVlO1xuXHRcdGNvbnN0IGhpc3RvcnkgPSB0aGlzLnNlYXJjaEhpc3RvcnlTZXJ2aWNlLmxvYWQoKTtcblx0XHRjb25zdCBzZWFyY2hIaXN0b3J5ID0gaGlzdG9yeS5zZWFyY2ggfHwgdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LnNlYXJjaEhpc3RvcnknXSB8fCBbXTtcblx0XHRjb25zdCByZXBsYWNlSGlzdG9yeSA9IGhpc3RvcnkucmVwbGFjZSB8fCB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkucmVwbGFjZUhpc3RvcnknXSB8fCBbXTtcblx0XHRjb25zdCBzaG93UmVwbGFjZSA9IHR5cGVvZiB0aGlzLnZpZXdsZXRTdGF0ZVsndmlldy5zaG93UmVwbGFjZSddID09PSAnYm9vbGVhbicgPyB0aGlzLnZpZXdsZXRTdGF0ZVsndmlldy5zaG93UmVwbGFjZSddIDogdHJ1ZTtcblx0XHRjb25zdCBwcmVzZXJ2ZUNhc2UgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkucHJlc2VydmVDYXNlJ10gPT09IHRydWU7XG5cblx0XHRjb25zdCBpc0luTm90ZWJvb2tNYXJrZG93bklucHV0ID0gdGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LmlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQnXSA/PyB0cnVlO1xuXHRcdGNvbnN0IGlzSW5Ob3RlYm9va01hcmtkb3duUHJldmlldyA9IHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5pc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXcnXSA/PyB0cnVlO1xuXHRcdGNvbnN0IGlzSW5Ob3RlYm9va0NlbGxJbnB1dCA9IHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5pc0luTm90ZWJvb2tDZWxsSW5wdXQnXSA/PyB0cnVlO1xuXHRcdGNvbnN0IGlzSW5Ob3RlYm9va0NlbGxPdXRwdXQgPSB0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuaXNJbk5vdGVib29rQ2VsbE91dHB1dCddID8/IHRydWU7XG5cblxuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hXaWRnZXQsIGNvbnRhaW5lciwge1xuXHRcdFx0dmFsdWU6IGNvbnRlbnRQYXR0ZXJuLFxuXHRcdFx0cmVwbGFjZVZhbHVlOiByZXBsYWNlVGV4dCxcblx0XHRcdGlzUmVnZXg6IGlzUmVnZXgsXG5cdFx0XHRpc0Nhc2VTZW5zaXRpdmU6IGlzQ2FzZVNlbnNpdGl2ZSxcblx0XHRcdGlzV2hvbGVXb3JkczogaXNXaG9sZVdvcmRzLFxuXHRcdFx0c2VhcmNoSGlzdG9yeTogc2VhcmNoSGlzdG9yeSxcblx0XHRcdHJlcGxhY2VIaXN0b3J5OiByZXBsYWNlSGlzdG9yeSxcblx0XHRcdHByZXNlcnZlQ2FzZTogcHJlc2VydmVDYXNlLFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlcyxcblx0XHRcdHRvZ2dsZVN0eWxlczogZGVmYXVsdFRvZ2dsZVN0eWxlcyxcblx0XHRcdG5vdGVib29rT3B0aW9uczoge1xuXHRcdFx0XHRpc0luTm90ZWJvb2tNYXJrZG93bklucHV0LFxuXHRcdFx0XHRpc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXcsXG5cdFx0XHRcdGlzSW5Ob3RlYm9va0NlbGxJbnB1dCxcblx0XHRcdFx0aXNJbk5vdGVib29rQ2VsbE91dHB1dCxcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRpZiAoIXRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0IHx8ICF0aGlzLnNlYXJjaFdpZGdldC5yZXBsYWNlSW5wdXQpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBDYW5ub3QgZnVsbHkgY3JlYXRlIHNlYXJjaCB3aWRnZXQuIFNlYXJjaCBvciByZXBsYWNlIGlucHV0IHVuZGVmaW5lZC4gU2VhcmNoSW5wdXQ6ICR7dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXR9LCBSZXBsYWNlSW5wdXQ6ICR7dGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0fWApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChzaG93UmVwbGFjZSkge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQudG9nZ2xlUmVwbGFjZSh0cnVlKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vblNlYXJjaFN1Ym1pdChvcHRpb25zID0+IHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKG9wdGlvbnMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQub25TZWFyY2hDYW5jZWwoKHsgZm9jdXMgfSkgPT4gdGhpcy5jYW5jZWxTZWFyY2goZm9jdXMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQub25EaWRPcHRpb25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dGhpcy50cmlnZ2VyUXVlcnlDaGFuZ2UoeyBzaG91bGRLZWVwQUlSZXN1bHRzOiB0cnVlIH0pO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKHsgc2hvdWxkS2VlcEFJUmVzdWx0czogdHJ1ZSB9KSkpO1xuXG5cdFx0Y29uc3QgdXBkYXRlSGFzUGF0dGVybktleSA9ICgpID0+IHRoaXMuaGFzU2VhcmNoUGF0dGVybktleS5zZXQodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQgPyAodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0VmFsdWUoKS5sZW5ndGggPiAwKSA6IGZhbHNlKTtcblx0XHR1cGRhdGVIYXNQYXR0ZXJuS2V5KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQub25EaWRDaGFuZ2UoKCkgPT4gdXBkYXRlSGFzUGF0dGVybktleSgpKSk7XG5cblx0XHRjb25zdCB1cGRhdGVIYXNSZXBsYWNlUGF0dGVybktleSA9ICgpID0+IHRoaXMuaGFzUmVwbGFjZVBhdHRlcm5LZXkuc2V0KHRoaXMuc2VhcmNoV2lkZ2V0LmdldFJlcGxhY2VWYWx1ZSgpLmxlbmd0aCA+IDApO1xuXHRcdHVwZGF0ZUhhc1JlcGxhY2VQYXR0ZXJuS2V5KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0LmlucHV0Qm94Lm9uRGlkQ2hhbmdlKCgpID0+IHVwZGF0ZUhhc1JlcGxhY2VQYXR0ZXJuS2V5KCkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2VhcmNoV2lkZ2V0Lm9uRGlkSGVpZ2h0Q2hhbmdlKCgpID0+IHRoaXMucmVMYXlvdXQoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQub25SZXBsYWNlVG9nZ2xlZCgoKSA9PiB0aGlzLnJlTGF5b3V0KCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vblJlcGxhY2VTdGF0ZUNoYW5nZShhc3luYyAoc3RhdGUpID0+IHtcblx0XHRcdHRoaXMudmlld01vZGVsLnJlcGxhY2VBY3RpdmUgPSBzdGF0ZTtcblx0XHRcdGF3YWl0IHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQub25QcmVzZXJ2ZUNhc2VDaGFuZ2UoYXN5bmMgKHN0YXRlKSA9PiB7XG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5wcmVzZXJ2ZUNhc2UgPSBzdGF0ZTtcblx0XHRcdGF3YWl0IHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hXaWRnZXQub25SZXBsYWNlVmFsdWVDaGFuZ2VkKCgpID0+IHtcblx0XHRcdHRoaXMudmlld01vZGVsLnJlcGxhY2VTdHJpbmcgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXRSZXBsYWNlVmFsdWUoKTtcblx0XHRcdHRoaXMuZGVsYXllZFJlZnJlc2gudHJpZ2dlcihhc3luYyAoKSA9PiB0aGlzLnJlZnJlc2hUcmVlQ29udHJvbGxlci5xdWV1ZSgpKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vbkJsdXIoKCkgPT4ge1xuXHRcdFx0dGhpcy50b2dnbGVRdWVyeURldGFpbHNCdXR0b24uZm9jdXMoKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlYXJjaFdpZGdldC5vblJlcGxhY2VBbGwoKCkgPT4gdGhpcy5yZXBsYWNlQWxsKCkpKTtcblxuXHRcdHRoaXMudHJhY2tJbnB1dEJveCh0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dEZvY3VzVHJhY2tlcik7XG5cdFx0dGhpcy50cmFja0lucHV0Qm94KHRoaXMuc2VhcmNoV2lkZ2V0LnJlcGxhY2VJbnB1dEZvY3VzVHJhY2tlcik7XG5cdH1cblxuXHRwdWJsaWMgc2hvdWxkU2hvd0FJUmVzdWx0cygpOiBib29sZWFuIHtcblx0XHRjb25zdCBoYXNQcm92aWRlciA9IENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lmhhc0FJUmVzdWx0UHJvdmlkZXIuZ2V0VmFsdWUodGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0cmV0dXJuICEhaGFzUHJvdmlkZXI7XG5cdH1cblx0cHJpdmF0ZSBhc3luYyBvbkNvbmZpZ3VyYXRpb25VcGRhdGVkKGV2ZW50PzogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChldmVudCAmJiAoZXZlbnQuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NlYXJjaC5kZWNvcmF0aW9ucy5jb2xvcnMnKSB8fCBldmVudC5hZmZlY3RzQ29uZmlndXJhdGlvbignc2VhcmNoLmRlY29yYXRpb25zLmJhZGdlcycpKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0cmFja0lucHV0Qm94KGlucHV0Rm9jdXNUcmFja2VyOiBkb20uSUZvY3VzVHJhY2tlciB8IHVuZGVmaW5lZCwgY29udGV4dEtleT86IElDb250ZXh0S2V5PGJvb2xlYW4+KTogdm9pZCB7XG5cdFx0aWYgKCFpbnB1dEZvY3VzVHJhY2tlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGlucHV0Rm9jdXNUcmFja2VyLm9uRGlkRm9jdXMoKCkgPT4ge1xuXHRcdFx0dGhpcy5sYXN0Rm9jdXNTdGF0ZSA9ICdpbnB1dCc7XG5cdFx0XHR0aGlzLmlucHV0Qm94Rm9jdXNlZC5zZXQodHJ1ZSk7XG5cdFx0XHRjb250ZXh0S2V5Py5zZXQodHJ1ZSk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGlucHV0Rm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHR0aGlzLmlucHV0Qm94Rm9jdXNlZC5zZXQodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXRIYXNGb2N1cygpXG5cdFx0XHRcdHx8IHRoaXMuc2VhcmNoV2lkZ2V0LnJlcGxhY2VJbnB1dEhhc0ZvY3VzKClcblx0XHRcdFx0fHwgdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5pbnB1dEhhc0ZvY3VzKClcblx0XHRcdFx0fHwgdGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5pbnB1dEhhc0ZvY3VzKCkpO1xuXHRcdFx0Y29udGV4dEtleT8uc2V0KGZhbHNlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uU2VhcmNoUmVzdWx0c0NoYW5nZWQoZXZlbnQ/OiBJQ2hhbmdlRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucmVmcmVzaEFuZFVwZGF0ZUNvdW50KGV2ZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jaGFuZ2VkV2hpbGVIaWRkZW4gPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVmcmVzaEFuZFVwZGF0ZUNvdW50KGV2ZW50PzogSUNoYW5nZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2V0UmVwbGFjZUFsbEFjdGlvblN0YXRlKCF0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuaXNFbXB0eSgpKTtcblx0XHR0aGlzLnVwZGF0ZVNlYXJjaFJlc3VsdENvdW50KHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5xdWVyeSEudXNlckRpc2FibGVkRXhjbHVkZXNBbmRJZ25vcmVGaWxlcywgdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LnF1ZXJ5Py5vbmx5T3BlbkVkaXRvcnMsIGV2ZW50Py5jbGVhcmluZ0FsbCk7XG5cdFx0cmV0dXJuIHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKGV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgb3JpZ2luYWxTaG91bGRDb2xsYXBzZShtYXRjaDogUmVuZGVyYWJsZU1hdGNoKSB7XG5cdFx0Y29uc3QgY29sbGFwc2VSZXN1bHRzID0gdGhpcy5zZWFyY2hDb25maWcuY29sbGFwc2VSZXN1bHRzO1xuXHRcdHJldHVybiAoY29sbGFwc2VSZXN1bHRzID09PSAnYWx3YXlzQ29sbGFwc2UnIHx8XG5cdFx0XHQoIShpc1NlYXJjaFRyZWVNYXRjaChtYXRjaCkpICYmIG1hdGNoLmNvdW50KCkgPiAxMCAmJiBjb2xsYXBzZVJlc3VsdHMgIT09ICdhbHdheXNFeHBhbmQnKSkgP1xuXHRcdFx0T2JqZWN0VHJlZUVsZW1lbnRDb2xsYXBzZVN0YXRlLlByZXNlcnZlT3JDb2xsYXBzZWQgOiBPYmplY3RUcmVlRWxlbWVudENvbGxhcHNlU3RhdGUuUHJlc2VydmVPckV4cGFuZGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRDb2xsYXBzZUFjY29yZGluZ1RvQ29uZmlnKG1hdGNoOiBSZW5kZXJhYmxlTWF0Y2gpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb2xsYXBzZVJlc3VsdHMgPSB0aGlzLm9yaWdpbmFsU2hvdWxkQ29sbGFwc2UobWF0Y2gpO1xuXHRcdGlmIChjb2xsYXBzZVJlc3VsdHMgPT09IE9iamVjdFRyZWVFbGVtZW50Q29sbGFwc2VTdGF0ZS5QcmVzZXJ2ZU9yQ29sbGFwc2VkKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBsYWNlQWxsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuY291bnQoKSA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9jY3VycmVuY2VzID0gdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LmNvdW50KCk7XG5cdFx0Y29uc3QgZmlsZUNvdW50ID0gdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LmZpbGVDb3VudCgpO1xuXHRcdGNvbnN0IHJlcGxhY2VWYWx1ZSA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFJlcGxhY2VWYWx1ZSgpIHx8ICcnO1xuXHRcdGNvbnN0IGFmdGVyUmVwbGFjZUFsbE1lc3NhZ2UgPSB0aGlzLmJ1aWxkQWZ0ZXJSZXBsYWNlQWxsTWVzc2FnZShvY2N1cnJlbmNlcywgZmlsZUNvdW50LCByZXBsYWNlVmFsdWUpO1xuXG5cdFx0bGV0IHByb2dyZXNzQ29tcGxldGU6ICgpID0+IHZvaWQ7XG5cdFx0bGV0IHByb2dyZXNzUmVwb3J0ZXI6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPjtcblxuXHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmdldFByb2dyZXNzTG9jYXRpb24oKSwgZGVsYXk6IDEwMCwgdG90YWw6IG9jY3VycmVuY2VzIH0sIHAgPT4ge1xuXHRcdFx0cHJvZ3Jlc3NSZXBvcnRlciA9IHA7XG5cblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHByb2dyZXNzQ29tcGxldGUgPSByZXNvbHZlKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvbmZpcm1hdGlvbjogSUNvbmZpcm1hdGlvbiA9IHtcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3JlcGxhY2VBbGwuY29uZmlybWF0aW9uLnRpdGxlJywgXCJSZXBsYWNlIEFsbFwiKSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMuYnVpbGRSZXBsYWNlQWxsQ29uZmlybWF0aW9uTWVzc2FnZShvY2N1cnJlbmNlcywgZmlsZUNvdW50LCByZXBsYWNlVmFsdWUpLFxuXHRcdFx0cHJpbWFyeUJ1dHRvbjogbmxzLmxvY2FsaXplKHsga2V5OiAncmVwbGFjZUFsbC5jb25maXJtLmJ1dHRvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlJlcGxhY2VcIilcblx0XHR9O1xuXG5cdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oY29uZmlybWF0aW9uKS50aGVuKHJlcyA9PiB7XG5cdFx0XHRpZiAocmVzLmNvbmZpcm1lZCkge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRSZXBsYWNlQWxsQWN0aW9uU3RhdGUoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQucmVwbGFjZUFsbChwcm9ncmVzc1JlcG9ydGVyKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHRwcm9ncmVzc0NvbXBsZXRlKCk7XG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZUVsID0gdGhpcy5jbGVhck1lc3NhZ2UoKTtcblx0XHRcdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgYWZ0ZXJSZXBsYWNlQWxsTWVzc2FnZSk7XG5cdFx0XHRcdFx0dGhpcy5yZUxheW91dCgpO1xuXHRcdFx0XHR9LCAoZXJyb3IpID0+IHtcblx0XHRcdFx0XHRwcm9ncmVzc0NvbXBsZXRlKCk7XG5cdFx0XHRcdFx0ZXJyb3JzLmlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvZ3Jlc3NDb21wbGV0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBidWlsZEFmdGVyUmVwbGFjZUFsbE1lc3NhZ2Uob2NjdXJyZW5jZXM6IG51bWJlciwgZmlsZUNvdW50OiBudW1iZXIsIHJlcGxhY2VWYWx1ZT86IHN0cmluZykge1xuXHRcdGlmIChvY2N1cnJlbmNlcyA9PT0gMSkge1xuXHRcdFx0aWYgKGZpbGVDb3VudCA9PT0gMSkge1xuXHRcdFx0XHRpZiAocmVwbGFjZVZhbHVlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVwbGFjZUFsbC5vY2N1cnJlbmNlLmZpbGUubWVzc2FnZScsIFwiUmVwbGFjZWQgezB9IG9jY3VycmVuY2UgYWNyb3NzIHsxfSBmaWxlIHdpdGggJ3syfScuXCIsIG9jY3VycmVuY2VzLCBmaWxlQ291bnQsIHJlcGxhY2VWYWx1ZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZW1vdmVBbGwub2NjdXJyZW5jZS5maWxlLm1lc3NhZ2UnLCBcIlJlcGxhY2VkIHswfSBvY2N1cnJlbmNlIGFjcm9zcyB7MX0gZmlsZS5cIiwgb2NjdXJyZW5jZXMsIGZpbGVDb3VudCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChyZXBsYWNlVmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVwbGFjZUFsbC5vY2N1cnJlbmNlLmZpbGVzLm1lc3NhZ2UnLCBcIlJlcGxhY2VkIHswfSBvY2N1cnJlbmNlIGFjcm9zcyB7MX0gZmlsZXMgd2l0aCAnezJ9Jy5cIiwgb2NjdXJyZW5jZXMsIGZpbGVDb3VudCwgcmVwbGFjZVZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVtb3ZlQWxsLm9jY3VycmVuY2UuZmlsZXMubWVzc2FnZScsIFwiUmVwbGFjZWQgezB9IG9jY3VycmVuY2UgYWNyb3NzIHsxfSBmaWxlcy5cIiwgb2NjdXJyZW5jZXMsIGZpbGVDb3VudCk7XG5cdFx0fVxuXG5cdFx0aWYgKGZpbGVDb3VudCA9PT0gMSkge1xuXHRcdFx0aWYgKHJlcGxhY2VWYWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZXBsYWNlQWxsLm9jY3VycmVuY2VzLmZpbGUubWVzc2FnZScsIFwiUmVwbGFjZWQgezB9IG9jY3VycmVuY2VzIGFjcm9zcyB7MX0gZmlsZSB3aXRoICd7Mn0nLlwiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50LCByZXBsYWNlVmFsdWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZW1vdmVBbGwub2NjdXJyZW5jZXMuZmlsZS5tZXNzYWdlJywgXCJSZXBsYWNlZCB7MH0gb2NjdXJyZW5jZXMgYWNyb3NzIHsxfSBmaWxlLlwiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50KTtcblx0XHR9XG5cblx0XHRpZiAocmVwbGFjZVZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZXBsYWNlQWxsLm9jY3VycmVuY2VzLmZpbGVzLm1lc3NhZ2UnLCBcIlJlcGxhY2VkIHswfSBvY2N1cnJlbmNlcyBhY3Jvc3MgezF9IGZpbGVzIHdpdGggJ3syfScuXCIsIG9jY3VycmVuY2VzLCBmaWxlQ291bnQsIHJlcGxhY2VWYWx1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVtb3ZlQWxsLm9jY3VycmVuY2VzLmZpbGVzLm1lc3NhZ2UnLCBcIlJlcGxhY2VkIHswfSBvY2N1cnJlbmNlcyBhY3Jvc3MgezF9IGZpbGVzLlwiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50KTtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRSZXBsYWNlQWxsQ29uZmlybWF0aW9uTWVzc2FnZShvY2N1cnJlbmNlczogbnVtYmVyLCBmaWxlQ291bnQ6IG51bWJlciwgcmVwbGFjZVZhbHVlPzogc3RyaW5nKSB7XG5cdFx0aWYgKG9jY3VycmVuY2VzID09PSAxKSB7XG5cdFx0XHRpZiAoZmlsZUNvdW50ID09PSAxKSB7XG5cdFx0XHRcdGlmIChyZXBsYWNlVmFsdWUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZW1vdmVBbGwub2NjdXJyZW5jZS5maWxlLmNvbmZpcm1hdGlvbi5tZXNzYWdlJywgXCJSZXBsYWNlIHswfSBvY2N1cnJlbmNlIGFjcm9zcyB7MX0gZmlsZSB3aXRoICd7Mn0nP1wiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50LCByZXBsYWNlVmFsdWUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVwbGFjZUFsbC5vY2N1cnJlbmNlLmZpbGUuY29uZmlybWF0aW9uLm1lc3NhZ2UnLCBcIlJlcGxhY2UgezB9IG9jY3VycmVuY2UgYWNyb3NzIHsxfSBmaWxlP1wiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlcGxhY2VWYWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZW1vdmVBbGwub2NjdXJyZW5jZS5maWxlcy5jb25maXJtYXRpb24ubWVzc2FnZScsIFwiUmVwbGFjZSB7MH0gb2NjdXJyZW5jZSBhY3Jvc3MgezF9IGZpbGVzIHdpdGggJ3syfSc/XCIsIG9jY3VycmVuY2VzLCBmaWxlQ291bnQsIHJlcGxhY2VWYWx1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3JlcGxhY2VBbGwub2NjdXJyZW5jZS5maWxlcy5jb25maXJtYXRpb24ubWVzc2FnZScsIFwiUmVwbGFjZSB7MH0gb2NjdXJyZW5jZSBhY3Jvc3MgezF9IGZpbGVzP1wiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50KTtcblx0XHR9XG5cblx0XHRpZiAoZmlsZUNvdW50ID09PSAxKSB7XG5cdFx0XHRpZiAocmVwbGFjZVZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3JlbW92ZUFsbC5vY2N1cnJlbmNlcy5maWxlLmNvbmZpcm1hdGlvbi5tZXNzYWdlJywgXCJSZXBsYWNlIHswfSBvY2N1cnJlbmNlcyBhY3Jvc3MgezF9IGZpbGUgd2l0aCAnezJ9Jz9cIiwgb2NjdXJyZW5jZXMsIGZpbGVDb3VudCwgcmVwbGFjZVZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVwbGFjZUFsbC5vY2N1cnJlbmNlcy5maWxlLmNvbmZpcm1hdGlvbi5tZXNzYWdlJywgXCJSZXBsYWNlIHswfSBvY2N1cnJlbmNlcyBhY3Jvc3MgezF9IGZpbGU/XCIsIG9jY3VycmVuY2VzLCBmaWxlQ291bnQpO1xuXHRcdH1cblxuXHRcdGlmIChyZXBsYWNlVmFsdWUpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3JlbW92ZUFsbC5vY2N1cnJlbmNlcy5maWxlcy5jb25maXJtYXRpb24ubWVzc2FnZScsIFwiUmVwbGFjZSB7MH0gb2NjdXJyZW5jZXMgYWNyb3NzIHsxfSBmaWxlcyB3aXRoICd7Mn0nP1wiLCBvY2N1cnJlbmNlcywgZmlsZUNvdW50LCByZXBsYWNlVmFsdWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ3JlcGxhY2VBbGwub2NjdXJyZW5jZXMuZmlsZXMuY29uZmlybWF0aW9uLm1lc3NhZ2UnLCBcIlJlcGxhY2UgezB9IG9jY3VycmVuY2VzIGFjcm9zcyB7MX0gZmlsZXM/XCIsIG9jY3VycmVuY2VzLCBmaWxlQ291bnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhck1lc3NhZ2UoKTogSFRNTEVsZW1lbnQge1xuXHRcdHRoaXMuc2VhcmNoV2l0aG91dEZvbGRlck1lc3NhZ2VFbGVtZW50ID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgd2FzSGlkZGVuID0gdGhpcy5tZXNzYWdlc0VsZW1lbnQuc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnO1xuXHRcdGRvbS5jbGVhck5vZGUodGhpcy5tZXNzYWdlc0VsZW1lbnQpO1xuXHRcdGRvbS5zaG93KHRoaXMubWVzc2FnZXNFbGVtZW50KTtcblx0XHR0aGlzLm1lc3NhZ2VEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Y29uc3QgbmV3TWVzc2FnZSA9IGRvbS5hcHBlbmQodGhpcy5tZXNzYWdlc0VsZW1lbnQsICQoJy5tZXNzYWdlJykpO1xuXHRcdGlmICh3YXNIaWRkZW4pIHtcblx0XHRcdHRoaXMucmVMYXlvdXQoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3TWVzc2FnZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VhcmNoUmVzdWx0c1ZpZXcoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMucmVzdWx0c0VsZW1lbnQgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnJlc3VsdHMuc2hvdy1maWxlLWljb25zLmZpbGUtaWNvbi10aGVtYWJsZS10cmVlJykpO1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hEZWxlZ2F0ZSk7XG5cblx0XHRjb25zdCBpZGVudGl0eVByb3ZpZGVyOiBJSWRlbnRpdHlQcm92aWRlcjxSZW5kZXJhYmxlTWF0Y2g+ID0ge1xuXHRcdFx0Z2V0SWQoZWxlbWVudDogUmVuZGVyYWJsZU1hdGNoKSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmlkKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMuc2VhcmNoRGF0YVNvdXJjZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoVmlld0RhdGFTb3VyY2UsIHRoaXMpO1xuXHRcdHRoaXMudHJlZUxhYmVscyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VMYWJlbHMsIHsgb25EaWRDaGFuZ2VWaXNpYmlsaXR5OiB0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkgfSkpO1xuXHRcdHRoaXMudHJlZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxJU2VhcmNoUmVzdWx0LCBSZW5kZXJhYmxlTWF0Y2g+LFxuXHRcdFx0J1NlYXJjaFZpZXcnLFxuXHRcdFx0dGhpcy5yZXN1bHRzRWxlbWVudCxcblx0XHRcdGRlbGVnYXRlLFxuXHRcdFx0e1xuXHRcdFx0XHRpc0luY29tcHJlc3NpYmxlOiAoZWxlbWVudDogUmVuZGVyYWJsZU1hdGNoKSA9PiB7XG5cblx0XHRcdFx0XHRpZiAoaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2goZWxlbWVudCkgJiYgIWlzVGV4dFNlYXJjaEhlYWRpbmcoZWxlbWVudC5wYXJlbnQoKSkgJiYgIShpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaFdvcmtzcGFjZVJvb3QoZWxlbWVudC5wYXJlbnQoKSkpICYmICEoaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2hOb1Jvb3QoZWxlbWVudC5wYXJlbnQoKSkpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0W1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZvbGRlck1hdGNoUmVuZGVyZXIsIHRoaXMsIHRoaXMudHJlZUxhYmVscykpLFxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVNYXRjaFJlbmRlcmVyLCB0aGlzLCB0aGlzLnRyZWVMYWJlbHMpKSxcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0U2VhcmNoUmVzdWx0UmVuZGVyZXIsIHRoaXMudHJlZUxhYmVscykpLFxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hdGNoUmVuZGVyZXIsIHRoaXMpKSxcblx0XHRcdF0sXG5cdFx0XHR0aGlzLnNlYXJjaERhdGFTb3VyY2UsXG5cdFx0XHR7XG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXIsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogdGhpcy50cmVlQWNjZXNzaWJpbGl0eVByb3ZpZGVyLFxuXHRcdFx0XHRkbmQ6IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VMaXN0RG5ESGFuZGxlciwgZWxlbWVudCA9PiB7XG5cdFx0XHRcdFx0aWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQucmVzb3VyY2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChpc1NlYXJjaFRyZWVNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHdpdGhTZWxlY3Rpb24oZWxlbWVudC5wYXJlbnQoKS5yZXNvdXJjZSwgZWxlbWVudC5yYW5nZSgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IHRydWUsXG5cdFx0XHRcdHNlbGVjdGlvbk5hdmlnYXRpb246IHRydWUsXG5cdFx0XHRcdG92ZXJyaWRlU3R5bGVzOiB0aGlzLmdldExvY2F0aW9uQmFzZWRDb2xvcnMoKS5saXN0T3ZlcnJpZGVTdHlsZXMsXG5cdFx0XHRcdHBhZGRpbmdCb3R0b206IFNlYXJjaERlbGVnYXRlLklURU1fSEVJR0hULFxuXHRcdFx0XHRjb2xsYXBzZUJ5RGVmYXVsdDogKGU6IFJlbmRlcmFibGVNYXRjaCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpc1RleHRTZWFyY2hIZWFkaW5nKGUpKSB7XG5cdFx0XHRcdFx0XHQvLyBhbHdheXMgY29sbGFwc2UgdGhlIGFpIHRleHQgc2VhcmNoIHJlc3VsdCwgYnV0IGFsd2F5cyBleHBhbmQgdGhlIHRleHQgcmVzdWx0XG5cdFx0XHRcdFx0XHRyZXR1cm4gZS5pc0FJQ29udHJpYnV0ZWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gYWx3YXlzIGV4cGFuZCBjb21wcmVzc2VkIG5vZGVzXG5cdFx0XHRcdFx0aWYgKGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoKGUpICYmIGUubWF0Y2hlcygpLmxlbmd0aCA9PT0gMSAmJiBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChlLm1hdGNoZXMoKVswXSkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2hvdWxkQ29sbGFwc2VBY2NvcmRpbmdUb0NvbmZpZyhlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0Q29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoUmVzdWx0TGlzdEZvY3VzZWRLZXkuYmluZFRvKHRoaXMudHJlZS5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLnRyZWUuc2V0SW5wdXQodGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25Db250ZXh0TWVudShlID0+IHRoaXMub25Db250ZXh0TWVudShlKSkpO1xuXHRcdGNvbnN0IHVwZGF0ZUhhc1NvbWVDb2xsYXBzaWJsZSA9ICgpID0+IHRoaXMudG9nZ2xlQ29sbGFwc2VTdGF0ZURlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLmhhc1NvbWVDb2xsYXBzaWJsZVJlc3VsdEtleS5zZXQodGhpcy5oYXNTb21lQ29sbGFwc2libGUoKSkpO1xuXHRcdHVwZGF0ZUhhc1NvbWVDb2xsYXBzaWJsZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZENoYW5nZUNvbGxhcHNlU3RhdGUoKCkgPT4gdXBkYXRlSGFzU29tZUNvbGxhcHNpYmxlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRDaGFuZ2VNb2RlbCgoKSA9PiB1cGRhdGVIYXNTb21lQ29sbGFwc2libGUoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2UodGhpcy50cmVlLm9uRGlkT3BlbiwgKGxhc3QsIGV2ZW50KSA9PiBldmVudCwgREVCT1VOQ0VfREVMQVksIHRydWUpKG9wdGlvbnMgPT4ge1xuXHRcdFx0aWYgKGlzU2VhcmNoVHJlZU1hdGNoKG9wdGlvbnMuZWxlbWVudCkpIHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ZWRNYXRjaDogSVNlYXJjaFRyZWVNYXRjaCA9IG9wdGlvbnMuZWxlbWVudDtcblx0XHRcdFx0dGhpcy5jdXJyZW50U2VsZWN0ZWRGaWxlTWF0Y2g/LnNldFNlbGVjdGVkTWF0Y2gobnVsbCk7XG5cdFx0XHRcdHRoaXMuY3VycmVudFNlbGVjdGVkRmlsZU1hdGNoID0gc2VsZWN0ZWRNYXRjaC5wYXJlbnQoKTtcblx0XHRcdFx0dGhpcy5jdXJyZW50U2VsZWN0ZWRGaWxlTWF0Y2guc2V0U2VsZWN0ZWRNYXRjaChzZWxlY3RlZE1hdGNoKTtcblxuXHRcdFx0XHR0aGlzLm9uRm9jdXMoc2VsZWN0ZWRNYXRjaCwgb3B0aW9ucy5lZGl0b3JPcHRpb25zLnByZXNlcnZlRm9jdXMsIG9wdGlvbnMuc2lkZUJ5U2lkZSwgb3B0aW9ucy5lZGl0b3JPcHRpb25zLnBpbm5lZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2UodGhpcy50cmVlLm9uRGlkQ2hhbmdlRm9jdXMsIChsYXN0LCBldmVudCkgPT4gZXZlbnQsIERFQk9VTkNFX0RFTEFZLCB0cnVlKSgoKSA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRjb25zdCBmb2N1cyA9IHRoaXMudHJlZS5nZXRGb2N1cygpWzBdO1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5sZW5ndGggPiAxICYmIGlzU2VhcmNoVHJlZU1hdGNoKGZvY3VzKSkge1xuXHRcdFx0XHR0aGlzLm9uRm9jdXMoZm9jdXMsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueTxhbnk+KHRoaXMudHJlZS5vbkRpZEZvY3VzLCB0aGlzLnRyZWUub25EaWRDaGFuZ2VGb2N1cykoKCkgPT4ge1xuXHRcdFx0Y29uc3QgZm9jdXMgPSB0aGlzLnRyZWUuZ2V0Rm9jdXMoKVswXTtcblxuXHRcdFx0aWYgKHRoaXMudHJlZS5pc0RPTUZvY3VzZWQoKSkge1xuXHRcdFx0XHRjb25zdCBmaXJzdEVsZW0gPSB0aGlzLnRyZWUuZ2V0Rmlyc3RFbGVtZW50Q2hpbGQodGhpcy50cmVlLmdldElucHV0KCkpO1xuXHRcdFx0XHR0aGlzLmZpcnN0TWF0Y2hGb2N1c2VkLnNldChmaXJzdEVsZW0gPT09IGZvY3VzKTtcblx0XHRcdFx0dGhpcy5maWxlTWF0Y2hPck1hdGNoRm9jdXNlZC5zZXQoISFmb2N1cyk7XG5cdFx0XHRcdHRoaXMuZmlsZU1hdGNoRm9jdXNlZC5zZXQoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKGZvY3VzKSk7XG5cdFx0XHRcdHRoaXMuZm9sZGVyTWF0Y2hGb2N1c2VkLnNldChpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChmb2N1cykpO1xuXHRcdFx0XHR0aGlzLm1hdGNoRm9jdXNlZC5zZXQoaXNTZWFyY2hUcmVlTWF0Y2goZm9jdXMpKTtcblx0XHRcdFx0dGhpcy5maWxlTWF0Y2hPckZvbGRlck1hdGNoRm9jdXMuc2V0KGlzU2VhcmNoVHJlZUZpbGVNYXRjaChmb2N1cykgfHwgaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2goZm9jdXMpKTtcblx0XHRcdFx0dGhpcy5maWxlTWF0Y2hPckZvbGRlck1hdGNoV2l0aFJlc291cmNlRm9jdXMuc2V0KGlzU2VhcmNoVHJlZUZpbGVNYXRjaChmb2N1cykgfHwgaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2UoZm9jdXMpKTtcblx0XHRcdFx0dGhpcy5mb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUZvY3VzZWQuc2V0KGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlKGZvY3VzKSk7XG5cdFx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0SGVhZGVyRm9jdXNlZC5zZXQoaXNTZWFyY2hIZWFkZXIoZm9jdXMpKTtcblx0XHRcdFx0dGhpcy5sYXN0Rm9jdXNTdGF0ZSA9ICd0cmVlJztcblx0XHRcdH1cblxuXHRcdFx0bGV0IGVkaXRhYmxlID0gZmFsc2U7XG5cdFx0XHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZm9jdXMpKSB7XG5cdFx0XHRcdGVkaXRhYmxlID0gIWZvY3VzLmlzUmVhZG9ubHk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChmb2N1cykpIHtcblx0XHRcdFx0ZWRpdGFibGUgPSAhZm9jdXMuaGFzT25seVJlYWRPbmx5TWF0Y2hlcygpO1xuXHRcdFx0fSBlbHNlIGlmIChpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChmb2N1cykpIHtcblx0XHRcdFx0ZWRpdGFibGUgPSAhZm9jdXMuaGFzT25seVJlYWRPbmx5TWF0Y2hlcygpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pc0VkaXRhYmxlSXRlbS5zZXQoZWRpdGFibGUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5maXJzdE1hdGNoRm9jdXNlZC5yZXNldCgpO1xuXHRcdFx0dGhpcy5maWxlTWF0Y2hPck1hdGNoRm9jdXNlZC5yZXNldCgpO1xuXHRcdFx0dGhpcy5maWxlTWF0Y2hGb2N1c2VkLnJlc2V0KCk7XG5cdFx0XHR0aGlzLmZvbGRlck1hdGNoRm9jdXNlZC5yZXNldCgpO1xuXHRcdFx0dGhpcy5tYXRjaEZvY3VzZWQucmVzZXQoKTtcblx0XHRcdHRoaXMuZmlsZU1hdGNoT3JGb2xkZXJNYXRjaEZvY3VzLnJlc2V0KCk7XG5cdFx0XHR0aGlzLmZpbGVNYXRjaE9yRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2VGb2N1cy5yZXNldCgpO1xuXHRcdFx0dGhpcy5mb2xkZXJNYXRjaFdpdGhSZXNvdXJjZUZvY3VzZWQucmVzZXQoKTtcblx0XHRcdHRoaXMuc2VhcmNoUmVzdWx0SGVhZGVyRm9jdXNlZC5yZXNldCgpO1xuXHRcdFx0dGhpcy5pc0VkaXRhYmxlSXRlbS5yZXNldCgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShlOiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8UmVuZGVyYWJsZU1hdGNoIHwgbnVsbD4pOiB2b2lkIHtcblxuXHRcdGUuYnJvd3NlckV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0ZS5icm93c2VyRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpO1xuXHRcdGxldCBhcmc6IGFueTtcblx0XHRsZXQgY29udGV4dDogYW55O1xuXHRcdGlmIChzZWxlY3Rpb24gJiYgc2VsZWN0aW9uLmxlbmd0aCA+IDApIHtcblx0XHRcdGFyZyA9IGUuZWxlbWVudDtcblx0XHRcdGNvbnRleHQgPSBzZWxlY3Rpb247XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnRleHQgPSBlLmVsZW1lbnQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdG1lbnVJZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRtZW51QWN0aW9uT3B0aW9uczogeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSwgYXJnIH0sXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy5jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gY29udGV4dCxcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaGFzU29tZUNvbGxhcHNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHZpZXdlciA9IHRoaXMuZ2V0Q29udHJvbCgpO1xuXHRcdGNvbnN0IG5hdmlnYXRvciA9IHZpZXdlci5uYXZpZ2F0ZSgpO1xuXHRcdGxldCBub2RlID0gbmF2aWdhdG9yLmZpcnN0KCk7XG5cdFx0Y29uc3Qgc2hvdWxkU2hvd0FJID0gdGhpcy5zaG91bGRTaG93QUlSZXN1bHRzKCk7XG5cdFx0ZG8ge1xuXHRcdFx0aWYgKG5vZGUgJiYgIXZpZXdlci5pc0NvbGxhcHNlZChub2RlKSAmJiAoIXNob3VsZFNob3dBSSB8fCAhKGlzVGV4dFNlYXJjaEhlYWRpbmcobm9kZSkpKSkge1xuXHRcdFx0XHQvLyBpZ25vcmUgdGhlIGFpIHRleHQgc2VhcmNoIHJlc3VsdCBpZFxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IHdoaWxlIChub2RlID0gbmF2aWdhdG9yLm5leHQoKSk7XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRhc3luYyBzZWxlY3ROZXh0TWF0Y2goKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmhhc1NlYXJjaFJlc3VsdHMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IFtzZWxlY3RlZF0gPSB0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCk7XG5cblx0XHQvLyBFeHBhbmQgdGhlIGluaXRpYWwgc2VsZWN0ZWQgbm9kZSwgaWYgbmVlZGVkXG5cdFx0aWYgKHNlbGVjdGVkICYmICEoaXNTZWFyY2hUcmVlTWF0Y2goc2VsZWN0ZWQpKSkge1xuXHRcdFx0aWYgKHRoaXMudHJlZS5pc0NvbGxhcHNlZChzZWxlY3RlZCkpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZChzZWxlY3RlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmF2aWdhdG9yID0gdGhpcy50cmVlLm5hdmlnYXRlKHNlbGVjdGVkKTtcblxuXHRcdGxldCBuZXh0ID0gbmF2aWdhdG9yLm5leHQoKTtcblx0XHRpZiAoIW5leHQpIHtcblx0XHRcdG5leHQgPSBuYXZpZ2F0b3IuZmlyc3QoKTtcblx0XHR9XG5cblx0XHQvLyBFeHBhbmQgdW50aWwgZmlyc3QgY2hpbGQgaXMgYSBNYXRjaFxuXHRcdHdoaWxlIChuZXh0ICYmICEoaXNTZWFyY2hUcmVlTWF0Y2gobmV4dCkpKSB7XG5cdFx0XHRpZiAodGhpcy50cmVlLmlzQ29sbGFwc2VkKG5leHQpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHJlZS5leHBhbmQobmV4dCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNlbGVjdCB0aGUgZmlyc3QgY2hpbGRcblx0XHRcdG5leHQgPSBuYXZpZ2F0b3IubmV4dCgpO1xuXHRcdH1cblxuXHRcdC8vIFJldmVhbCB0aGUgbmV3bHkgc2VsZWN0ZWQgZWxlbWVudFxuXHRcdGlmIChuZXh0KSB7XG5cdFx0XHRpZiAobmV4dCA9PT0gc2VsZWN0ZWQpIHtcblx0XHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGV2ZW50ID0gZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCh1bmRlZmluZWQsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW25leHRdLCBldmVudCk7XG5cdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtuZXh0XSwgZXZlbnQpO1xuXHRcdFx0dGhpcy50cmVlLnJldmVhbChuZXh0KTtcblx0XHRcdGNvbnN0IGFyaWFMYWJlbCA9IHRoaXMudHJlZUFjY2Vzc2liaWxpdHlQcm92aWRlci5nZXRBcmlhTGFiZWwobmV4dCk7XG5cdFx0XHRpZiAoYXJpYUxhYmVsKSB7IGFyaWEuc3RhdHVzKGFyaWFMYWJlbCk7IH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBzZWxlY3RQcmV2aW91c01hdGNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5oYXNTZWFyY2hSZXN1bHRzKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBbc2VsZWN0ZWRdID0gdGhpcy50cmVlLmdldFNlbGVjdGlvbigpO1xuXHRcdGxldCBuYXZpZ2F0b3IgPSB0aGlzLnRyZWUubmF2aWdhdGUoc2VsZWN0ZWQpO1xuXG5cdFx0bGV0IHByZXYgPSBuYXZpZ2F0b3IucHJldmlvdXMoKTtcblxuXHRcdC8vIFNlbGVjdCBwcmV2aW91cyB1bnRpbCBmaW5kIGEgTWF0Y2ggb3IgYSBjb2xsYXBzZWQgaXRlbVxuXHRcdHdoaWxlICghcHJldiB8fCAoIShpc1NlYXJjaFRyZWVNYXRjaChwcmV2KSkgJiYgIXRoaXMudHJlZS5pc0NvbGxhcHNlZChwcmV2KSkpIHtcblx0XHRcdGNvbnN0IG5leHRQcmV2ID0gcHJldiA/IG5hdmlnYXRvci5wcmV2aW91cygpIDogbmF2aWdhdG9yLmxhc3QoKTtcblxuXHRcdFx0aWYgKCFwcmV2ICYmICFuZXh0UHJldikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHByZXYgPSBuZXh0UHJldjtcblx0XHR9XG5cblx0XHQvLyBFeHBhbmQgdW50aWwgbGFzdCBjaGlsZCBpcyBhIE1hdGNoXG5cdFx0d2hpbGUgKHByZXYgJiYgIShpc1NlYXJjaFRyZWVNYXRjaChwcmV2KSkpIHtcblx0XHRcdGNvbnN0IG5leHRJdGVtID0gbmF2aWdhdG9yLm5leHQoKTtcblx0XHRcdGlmICghbmV4dEl0ZW0pIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLnRyZWUuZXhwYW5kKHByZXYpO1xuXHRcdFx0bmF2aWdhdG9yID0gdGhpcy50cmVlLm5hdmlnYXRlKG5leHRJdGVtKTsgLy8gcmVjcmVhdGUgbmF2aWdhdG9yIGJlY2F1c2UgbW9kaWZ5aW5nIHRoZSB0cmVlIGNhbiBpbnZhbGlkYXRlIGl0XG5cdFx0XHRwcmV2ID0gbmV4dEl0ZW0gPyBuYXZpZ2F0b3IucHJldmlvdXMoKSA6IG5hdmlnYXRvci5sYXN0KCk7IC8vIHNlbGVjdCBsYXN0IGNoaWxkXG5cdFx0fVxuXG5cdFx0Ly8gUmV2ZWFsIHRoZSBuZXdseSBzZWxlY3RlZCBlbGVtZW50XG5cdFx0aWYgKHByZXYpIHtcblx0XHRcdGlmIChwcmV2ID09PSBzZWxlY3RlZCkge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Rm9jdXMoW10pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZXZlbnQgPSBnZXRTZWxlY3Rpb25LZXlib2FyZEV2ZW50KHVuZGVmaW5lZCwgZmFsc2UsIGZhbHNlKTtcblx0XHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbcHJldl0sIGV2ZW50KTtcblx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24oW3ByZXZdLCBldmVudCk7XG5cdFx0XHR0aGlzLnRyZWUucmV2ZWFsKHByZXYpO1xuXHRcdFx0Y29uc3QgYXJpYUxhYmVsID0gdGhpcy50cmVlQWNjZXNzaWJpbGl0eVByb3ZpZGVyLmdldEFyaWFMYWJlbChwcmV2KTtcblx0XHRcdGlmIChhcmlhTGFiZWwpIHsgYXJpYS5zdGF0dXMoYXJpYUxhYmVsKTsgfVxuXHRcdH1cblx0fVxuXG5cdG1vdmVGb2N1c1RvUmVzdWx0cygpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0aWYgKHRoaXMubGFzdEZvY3VzU3RhdGUgPT09ICdpbnB1dCcgfHwgIXRoaXMuaGFzU2VhcmNoUmVzdWx0cygpKSB7XG5cdFx0XHRjb25zdCB1cGRhdGVkVGV4dCA9IHRoaXMuc2VhcmNoQ29uZmlnLnNlZWRPbkZvY3VzID8gdGhpcy51cGRhdGVUZXh0RnJvbVNlbGVjdGlvbih7IGFsbG93U2VhcmNoT25UeXBlOiBmYWxzZSB9KSA6IGZhbHNlO1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuZm9jdXModW5kZWZpbmVkLCB1bmRlZmluZWQsIHVwZGF0ZWRUZXh0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlVGV4dEZyb21GaW5kV2lkZ2V0T3JTZWxlY3Rpb24oeyBhbGxvd1Vuc2VsZWN0ZWRXb3JkID0gdHJ1ZSwgYWxsb3dTZWFyY2hPblR5cGUgPSB0cnVlIH0pOiBib29sZWFuIHtcblx0XHRsZXQgYWN0aXZlRWRpdG9yID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdGlmIChpc0NvZGVFZGl0b3IoYWN0aXZlRWRpdG9yKSAmJiAhYWN0aXZlRWRpdG9yPy5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1vbkZpbmRDb250cm9sbGVyLmdldChhY3RpdmVFZGl0b3IpO1xuXHRcdFx0aWYgKGNvbnRyb2xsZXIgJiYgY29udHJvbGxlci5pc0ZpbmRJbnB1dEZvY3VzZWQoKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy51cGRhdGVUZXh0RnJvbUZpbmRXaWRnZXQoY29udHJvbGxlciwgeyBhbGxvd1NlYXJjaE9uVHlwZSB9KTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZWRpdG9ycyA9IHRoaXMuY29kZUVkaXRvclNlcnZpY2UubGlzdENvZGVFZGl0b3JzKCk7XG5cdFx0XHRhY3RpdmVFZGl0b3IgPSBlZGl0b3JzLmZpbmQoZWRpdG9yID0+IGVkaXRvciBpbnN0YW5jZW9mIEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCAmJiBlZGl0b3IuZ2V0UGFyZW50RWRpdG9yKCkgPT09IGFjdGl2ZUVkaXRvciAmJiBlZGl0b3IuaGFzVGV4dEZvY3VzKCkpXG5cdFx0XHRcdD8/IGFjdGl2ZUVkaXRvcjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy51cGRhdGVUZXh0RnJvbVNlbGVjdGlvbih7IGFsbG93VW5zZWxlY3RlZFdvcmQsIGFsbG93U2VhcmNoT25UeXBlIH0sIGFjdGl2ZUVkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRleHRGcm9tRmluZFdpZGdldChjb250cm9sbGVyOiBDb21tb25GaW5kQ29udHJvbGxlciwgeyBhbGxvd1NlYXJjaE9uVHlwZSA9IHRydWUgfSk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5zZWFyY2hDb25maWcuc2VlZFdpdGhOZWFyZXN0V29yZCAmJiAoZG9tLmdldEFjdGl2ZVdpbmRvdygpLmdldFNlbGVjdGlvbigpPy50b1N0cmluZygpID8/ICcnKSA9PT0gJycpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWFyY2hTdHJpbmcgPSBjb250cm9sbGVyLmdldFN0YXRlKCkuc2VhcmNoU3RyaW5nO1xuXHRcdGlmIChzZWFyY2hTdHJpbmcgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldENhc2VTZW5zaXRpdmUoY29udHJvbGxlci5nZXRTdGF0ZSgpLm1hdGNoQ2FzZSk7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFdob2xlV29yZHMoY29udHJvbGxlci5nZXRTdGF0ZSgpLndob2xlV29yZCk7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFJlZ2V4KGNvbnRyb2xsZXIuZ2V0U3RhdGUoKS5pc1JlZ2V4KTtcblx0XHR0aGlzLnVwZGF0ZVRleHQoc2VhcmNoU3RyaW5nLCBhbGxvd1NlYXJjaE9uVHlwZSk7XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVGV4dEZyb21TZWxlY3Rpb24oeyBhbGxvd1Vuc2VsZWN0ZWRXb3JkID0gdHJ1ZSwgYWxsb3dTZWFyY2hPblR5cGUgPSB0cnVlIH0sIGVkaXRvcj86IElFZGl0b3IpOiBib29sZWFuIHtcblx0XHRjb25zdCBzZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbiA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUVkaXRvck9wdGlvbnM+KCdlZGl0b3InKS5maW5kIS5zZWVkU2VhcmNoU3RyaW5nRnJvbVNlbGVjdGlvbjtcblx0XHRpZiAoIXNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uIHx8IHNlZWRTZWFyY2hTdHJpbmdGcm9tU2VsZWN0aW9uID09PSAnbmV2ZXInKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IHNlbGVjdGVkVGV4dCA9IHRoaXMuZ2V0U2VhcmNoVGV4dEZyb21FZGl0b3IoYWxsb3dVbnNlbGVjdGVkV29yZCwgZWRpdG9yKTtcblx0XHRpZiAoc2VsZWN0ZWRUZXh0ID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0Py5nZXRSZWdleCgpKSB7XG5cdFx0XHRzZWxlY3RlZFRleHQgPSBzdHJpbmdzLmVzY2FwZVJlZ0V4cENoYXJhY3RlcnMoc2VsZWN0ZWRUZXh0KTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVRleHQoc2VsZWN0ZWRUZXh0LCBhbGxvd1NlYXJjaE9uVHlwZSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVRleHQodGV4dDogc3RyaW5nLCBhbGxvd1NlYXJjaE9uVHlwZTogYm9vbGVhbiA9IHRydWUpIHtcblx0XHRpZiAoYWxsb3dTZWFyY2hPblR5cGUgJiYgIXRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5pc0RpcnR5KSB7XG5cdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSh0ZXh0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5wYXVzZVNlYXJjaGluZyA9IHRydWU7XG5cdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRWYWx1ZSh0ZXh0KTtcblx0XHRcdHRoaXMucGF1c2VTZWFyY2hpbmcgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c05leHRJbnB1dEJveCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHRpZiAodGhpcy5zZWFyY2hXaWRnZXQuaXNSZXBsYWNlU2hvd24oKSkge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1cyh0cnVlLCB0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMubW92ZUZvY3VzRnJvbVNlYXJjaE9yUmVwbGFjZSgpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNlYXJjaFdpZGdldC5yZXBsYWNlSW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHR0aGlzLm1vdmVGb2N1c0Zyb21TZWFyY2hPclJlcGxhY2UoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5pbnB1dEhhc0ZvY3VzKCkpIHtcblx0XHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuZm9jdXMoKTtcblx0XHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuc2VsZWN0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuaW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHR0aGlzLnNlbGVjdFRyZWVJZk5vdFNlbGVjdGVkKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtb3ZlRm9jdXNGcm9tU2VhcmNoT3JSZXBsYWNlKCkge1xuXHRcdGlmICh0aGlzLnNob3dzRmlsZVR5cGVzKCkpIHtcblx0XHRcdHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzKHRydWUsIHRoaXMuc2hvd3NGaWxlVHlwZXMoKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2VsZWN0VHJlZUlmTm90U2VsZWN0ZWQoKTtcblx0XHR9XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzSW5wdXRCb3goKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0SGFzRm9jdXMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNlYXJjaFdpZGdldC5yZXBsYWNlSW5wdXRIYXNGb2N1cygpKSB7XG5cdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1cyh0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5pbnB1dEhhc0ZvY3VzKCkpIHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKHRydWUsIHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLmlucHV0SGFzRm9jdXMoKSkge1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5mb2N1cygpO1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5zZWxlY3QoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy50cmVlLmlzRE9NRm9jdXNlZCgpKSB7XG5cdFx0XHR0aGlzLm1vdmVGb2N1c0Zyb21SZXN1bHRzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtb3ZlRm9jdXNGcm9tUmVzdWx0cygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zaG93c0ZpbGVUeXBlcygpKSB7XG5cdFx0XHR0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlscyh0cnVlLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKHRydWUsIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVMYXlvdXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuaXNEaXNwb3NlZCB8fCAhdGhpcy5zaXplKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9uc1Bvc2l0aW9uID0gdGhpcy5zZWFyY2hDb25maWcuYWN0aW9uc1Bvc2l0aW9uO1xuXHRcdHRoaXMuZ2V0Q29udGFpbmVyKCkuY2xhc3NMaXN0LnRvZ2dsZShTZWFyY2hWaWV3LkFDVElPTlNfUklHSFRfQ0xBU1NfTkFNRSwgYWN0aW9uc1Bvc2l0aW9uID09PSAncmlnaHQnKTtcblxuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnNldFdpZHRoKHRoaXMuc2l6ZS53aWR0aCAtIDI4IC8qIGNvbnRhaW5lciBtYXJnaW4gKi8pO1xuXG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5zZXRXaWR0aCh0aGlzLnNpemUud2lkdGggLSAyOCAvKiBjb250YWluZXIgbWFyZ2luICovKTtcblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNldFdpZHRoKHRoaXMuc2l6ZS53aWR0aCAtIDI4IC8qIGNvbnRhaW5lciBtYXJnaW4gKi8pO1xuXG5cdFx0Y29uc3Qgd2lkZ2V0SGVpZ2h0ID0gZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMuc2VhcmNoV2lkZ2V0c0NvbnRhaW5lckVsZW1lbnQpO1xuXHRcdGNvbnN0IG1lc3NhZ2VzSGVpZ2h0ID0gZG9tLmdldFRvdGFsSGVpZ2h0KHRoaXMubWVzc2FnZXNFbGVtZW50KTtcblx0XHR0aGlzLnRyZWUubGF5b3V0KHRoaXMuc2l6ZS5oZWlnaHQgLSB3aWRnZXRIZWlnaHQgLSBtZXNzYWdlc0hlaWdodCwgdGhpcy5zaXplLndpZHRoIC0gMjgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuc2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdHRoaXMucmVMYXlvdXQoKTtcblx0fVxuXG5cdGdldENvbnRyb2woKSB7XG5cdFx0cmV0dXJuIHRoaXMudHJlZTtcblx0fVxuXG5cdGFsbFNlYXJjaEZpZWxkc0NsZWFyKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnNlYXJjaFdpZGdldC5nZXRSZXBsYWNlVmFsdWUoKSA9PT0gJycgJiZcblx0XHRcdCghdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQgfHwgdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0VmFsdWUoKSA9PT0gJycpO1xuXHR9XG5cblx0YWxsRmlsZVBhdHRlcm5GaWVsZHNDbGVhcigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hFeGNsdWRlUGF0dGVybi5nZXRWYWx1ZSgpID09PSAnJyAmJlxuXHRcdFx0dGhpcy5zZWFyY2hJbmNsdWRlUGF0dGVybi5nZXRWYWx1ZSgpID09PSAnJztcblx0fVxuXG5cdGhhc1NlYXJjaFJlc3VsdHMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuaXNFbXB0eSgpO1xuXHR9XG5cblx0Y2xlYXJTZWFyY2hSZXN1bHRzKGNsZWFySW5wdXQgPSB0cnVlKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LmNsZWFyKCk7XG5cdFx0dGhpcy5zaG93RW1wdHlTdGFnZSh0cnVlKTtcblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSkge1xuXHRcdFx0dGhpcy5zaG93U2VhcmNoV2l0aG91dEZvbGRlck1lc3NhZ2UoKTtcblx0XHR9XG5cdFx0aWYgKGNsZWFySW5wdXQpIHtcblx0XHRcdGlmICh0aGlzLmFsbFNlYXJjaEZpZWxkc0NsZWFyKCkpIHtcblx0XHRcdFx0dGhpcy5jbGVhckZpbGVQYXR0ZXJuRmllbGRzKCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5jbGVhcigpO1xuXHRcdH1cblx0XHR0aGlzLnZpZXdNb2RlbC5jYW5jZWxTZWFyY2goKTtcblx0XHR0aGlzLnRyZWUuYXJpYUxhYmVsID0gbmxzLmxvY2FsaXplKCdlbXB0eVNlYXJjaCcsIFwiRW1wdHkgU2VhcmNoXCIpO1xuXG5cdFx0dGhpcy5hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5wbGF5U2lnbmFsKEFjY2Vzc2liaWxpdHlTaWduYWwuY2xlYXIpO1xuXHRcdHRoaXMucmVMYXlvdXQoKTtcblx0fVxuXG5cdGNsZWFyRmlsZVBhdHRlcm5GaWVsZHMoKTogdm9pZCB7XG5cdFx0dGhpcy5zZWFyY2hFeGNsdWRlUGF0dGVybi5jbGVhcigpO1xuXHRcdHRoaXMuc2VhcmNoSW5jbHVkZVBhdHRlcm4uY2xlYXIoKTtcblx0fVxuXG5cdGNhbmNlbFNlYXJjaChmb2N1czogYm9vbGVhbiA9IHRydWUpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy52aWV3TW9kZWwuY2FuY2VsU2VhcmNoKCkgJiYgdGhpcy52aWV3TW9kZWwuY2FuY2VsQUlTZWFyY2goKSkge1xuXHRcdFx0aWYgKGZvY3VzKSB7IHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKCk7IH1cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIHNlbGVjdFRyZWVJZk5vdFNlbGVjdGVkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnRyZWUuZ2V0Tm9kZSh1bmRlZmluZWQpKSB7XG5cdFx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGlmIChzZWxlY3Rpb24ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGNvbnN0IGV2ZW50ID0gZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCgpO1xuXHRcdFx0XHR0aGlzLnRyZWUuZm9jdXNOZXh0KHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBldmVudCk7XG5cdFx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24odGhpcy50cmVlLmdldEZvY3VzKCksIGV2ZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFNlYXJjaFRleHRGcm9tRWRpdG9yKGFsbG93VW5zZWxlY3RlZFdvcmQ6IGJvb2xlYW4sIGVkaXRvcj86IElFZGl0b3IpOiBzdHJpbmcgfCBudWxsIHtcblx0XHRpZiAoZG9tLmlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5nZXRDb250YWluZXIoKSkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGVkaXRvciA9IGVkaXRvciA/PyB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cblx0XHRpZiAoIWVkaXRvcikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsb3dVbnNlbGVjdGVkID0gdGhpcy5zZWFyY2hDb25maWcuc2VlZFdpdGhOZWFyZXN0V29yZCAmJiBhbGxvd1Vuc2VsZWN0ZWRXb3JkO1xuXHRcdHJldHVybiBnZXRTZWxlY3Rpb25UZXh0RnJvbUVkaXRvcihhbGxvd1Vuc2VsZWN0ZWQsIGVkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIHNob3dzRmlsZVR5cGVzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnF1ZXJ5RGV0YWlscy5jbGFzc0xpc3QuY29udGFpbnMoJ21vcmUnKTtcblx0fVxuXG5cdHRvZ2dsZUNhc2VTZW5zaXRpdmUoKTogdm9pZCB7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldENhc2VTZW5zaXRpdmUoIXRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0LmdldENhc2VTZW5zaXRpdmUoKSk7XG5cdFx0dGhpcy50cmlnZ2VyUXVlcnlDaGFuZ2UoeyBzaG91bGRLZWVwQUlSZXN1bHRzOiB0cnVlIH0pO1xuXHR9XG5cblx0dG9nZ2xlV2hvbGVXb3JkcygpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dD8uc2V0V2hvbGVXb3JkcyghdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0V2hvbGVXb3JkcygpKTtcblx0XHR0aGlzLnRyaWdnZXJRdWVyeUNoYW5nZSh7IHNob3VsZEtlZXBBSVJlc3VsdHM6IHRydWUgfSk7XG5cdH1cblxuXHR0b2dnbGVSZWdleCgpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dD8uc2V0UmVnZXgoIXRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0LmdldFJlZ2V4KCkpO1xuXHRcdHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKHsgc2hvdWxkS2VlcEFJUmVzdWx0czogdHJ1ZSB9KTtcblx0fVxuXG5cdHRvZ2dsZVByZXNlcnZlQ2FzZSgpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaFdpZGdldC5yZXBsYWNlSW5wdXQ/LnNldFByZXNlcnZlQ2FzZSghdGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0LmdldFByZXNlcnZlQ2FzZSgpKTtcblx0XHR0aGlzLnRyaWdnZXJRdWVyeUNoYW5nZSh7IHNob3VsZEtlZXBBSVJlc3VsdHM6IHRydWUgfSk7XG5cdH1cblxuXHRzZXRTZWFyY2hQYXJhbWV0ZXJzKGFyZ3M6IElGaW5kSW5GaWxlc0FyZ3MgPSB7fSk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgYXJncy5pc0Nhc2VTZW5zaXRpdmUgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldENhc2VTZW5zaXRpdmUoYXJncy5pc0Nhc2VTZW5zaXRpdmUpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGFyZ3MubWF0Y2hXaG9sZVdvcmQgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFdob2xlV29yZHMoYXJncy5tYXRjaFdob2xlV29yZCk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgYXJncy5pc1JlZ2V4ID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0Py5zZXRSZWdleChhcmdzLmlzUmVnZXgpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGFyZ3MuZmlsZXNUb0luY2x1ZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLnNlYXJjaEluY2x1ZGVQYXR0ZXJuLnNldFZhbHVlKFN0cmluZyhhcmdzLmZpbGVzVG9JbmNsdWRlKSk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgYXJncy5maWxlc1RvRXhjbHVkZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuc2VhcmNoRXhjbHVkZVBhdHRlcm4uc2V0VmFsdWUoU3RyaW5nKGFyZ3MuZmlsZXNUb0V4Y2x1ZGUpKTtcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBhcmdzLnF1ZXJ5ID09PSAnc3RyaW5nJykge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNldFZhbHVlKGFyZ3MucXVlcnkpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGFyZ3MucmVwbGFjZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnJlcGxhY2VJbnB1dD8uc2V0VmFsdWUoYXJncy5yZXBsYWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0LnJlcGxhY2VJbnB1dCAmJiB0aGlzLnNlYXJjaFdpZGdldC5yZXBsYWNlSW5wdXQuZ2V0VmFsdWUoKSAhPT0gJycpIHtcblx0XHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0LnNldFZhbHVlKCcnKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBhcmdzLnRyaWdnZXJTZWFyY2ggPT09ICdib29sZWFuJyAmJiBhcmdzLnRyaWdnZXJTZWFyY2gpIHtcblx0XHRcdHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKCk7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgYXJncy5wcmVzZXJ2ZUNhc2UgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQucmVwbGFjZUlucHV0Py5zZXRQcmVzZXJ2ZUNhc2UoYXJncy5wcmVzZXJ2ZUNhc2UpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGFyZ3MudXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXMgPT09ICdib29sZWFuJykge1xuXHRcdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5zZXRVc2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzKGFyZ3MudXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXMpO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGFyZ3Mub25seU9wZW5FZGl0b3JzID09PSAnYm9vbGVhbicpIHtcblx0XHRcdHRoaXMuc2VhcmNoSW5jbHVkZVBhdHRlcm4uc2V0T25seVNlYXJjaEluT3BlbkVkaXRvcnMoYXJncy5vbmx5T3BlbkVkaXRvcnMpO1xuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZVF1ZXJ5RGV0YWlscyhtb3ZlRm9jdXMgPSB0cnVlLCBzaG93PzogYm9vbGVhbiwgc2tpcExheW91dD86IGJvb2xlYW4sIHJldmVyc2U/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgY2xzID0gJ21vcmUnO1xuXHRcdHNob3cgPSB0eXBlb2Ygc2hvdyA9PT0gJ3VuZGVmaW5lZCcgPyAhdGhpcy5xdWVyeURldGFpbHMuY2xhc3NMaXN0LmNvbnRhaW5zKGNscykgOiBCb29sZWFuKHNob3cpO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5xdWVyeURldGFpbHNFeHBhbmRlZCddID0gc2hvdztcblx0XHRza2lwTGF5b3V0ID0gQm9vbGVhbihza2lwTGF5b3V0KTtcblxuXHRcdGlmIChzaG93KSB7XG5cdFx0XHR0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlsc0J1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnLCAndHJ1ZScpO1xuXHRcdFx0dGhpcy5xdWVyeURldGFpbHMuY2xhc3NMaXN0LmFkZChjbHMpO1xuXHRcdFx0aWYgKG1vdmVGb2N1cykge1xuXHRcdFx0XHRpZiAocmV2ZXJzZSkge1xuXHRcdFx0XHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuZm9jdXMoKTtcblx0XHRcdFx0XHR0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLnNlbGVjdCgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuZm9jdXMoKTtcblx0XHRcdFx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNlbGVjdCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzQnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcsICdmYWxzZScpO1xuXHRcdFx0dGhpcy5xdWVyeURldGFpbHMuY2xhc3NMaXN0LnJlbW92ZShjbHMpO1xuXHRcdFx0aWYgKG1vdmVGb2N1cykge1xuXHRcdFx0XHR0aGlzLnNlYXJjaFdpZGdldC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghc2tpcExheW91dCAmJiB0aGlzLnNpemUpIHtcblx0XHRcdHRoaXMucmVMYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRzZWFyY2hJbkZvbGRlcnMoZm9sZGVyUGF0aHM6IHN0cmluZ1tdID0gW10pOiB2b2lkIHtcblx0XHR0aGlzLl9zZWFyY2hXaXRoSW5jbHVkZU9yRXhjbHVkZSh0cnVlLCBmb2xkZXJQYXRocyk7XG5cdH1cblxuXHRzZWFyY2hPdXRzaWRlT2ZGb2xkZXJzKGZvbGRlclBhdGhzOiBzdHJpbmdbXSA9IFtdKTogdm9pZCB7XG5cdFx0dGhpcy5fc2VhcmNoV2l0aEluY2x1ZGVPckV4Y2x1ZGUoZmFsc2UsIGZvbGRlclBhdGhzKTtcblx0fVxuXG5cdHByaXZhdGUgX3NlYXJjaFdpdGhJbmNsdWRlT3JFeGNsdWRlKGluY2x1ZGU6IGJvb2xlYW4sIGZvbGRlclBhdGhzOiBzdHJpbmdbXSkge1xuXHRcdGlmICghZm9sZGVyUGF0aHMubGVuZ3RoIHx8IGZvbGRlclBhdGhzLnNvbWUoZm9sZGVyUGF0aCA9PiBmb2xkZXJQYXRoID09PSAnLicpKSB7XG5cdFx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNldFZhbHVlKCcnKTtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU2hvdyAnZmlsZXMgdG8gaW5jbHVkZScgYm94XG5cdFx0aWYgKCF0aGlzLnNob3dzRmlsZVR5cGVzKCkpIHtcblx0XHRcdHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzKHRydWUsIHRydWUpO1xuXHRcdH1cblxuXHRcdChpbmNsdWRlID8gdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcyA6IHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMpLnNldFZhbHVlKGZvbGRlclBhdGhzLmpvaW4oJywgJykpO1xuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKGZhbHNlKTtcblx0fVxuXG5cdHRyaWdnZXJRdWVyeUNoYW5nZShfb3B0aW9ucz86IHsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW47IHRyaWdnZXJlZE9uVHlwZT86IGJvb2xlYW47IGRlbGF5PzogbnVtYmVyOyBzaG91bGRLZWVwQUlSZXN1bHRzPzogYm9vbGVhbjsgc2hvdWxkVXBkYXRlQUlTZWFyY2g/OiBib29sZWFuIH0pOiB2b2lkIHtcblx0XHRjb25zdCBvcHRpb25zID0geyBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCB0cmlnZ2VyZWRPblR5cGU6IGZhbHNlLCBkZWxheTogMCwgLi4uX29wdGlvbnMgfTtcblxuXHRcdGlmIChvcHRpb25zLnRyaWdnZXJlZE9uVHlwZSAmJiAhdGhpcy5zZWFyY2hDb25maWcuc2VhcmNoT25UeXBlKSB7IHJldHVybjsgfVxuXG5cdFx0aWYgKCF0aGlzLnBhdXNlU2VhcmNoaW5nKSB7XG5cblx0XHRcdGNvbnN0IGRlbGF5ID0gb3B0aW9ucy50cmlnZ2VyZWRPblR5cGUgPyBvcHRpb25zLmRlbGF5IDogMDtcblx0XHRcdHRoaXMudHJpZ2dlclF1ZXJ5RGVsYXllci50cmlnZ2VyKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fb25RdWVyeUNoYW5nZWQob3B0aW9ucy5wcmVzZXJ2ZUZvY3VzLCBvcHRpb25zLnRyaWdnZXJlZE9uVHlwZSwgb3B0aW9ucy5zaG91bGRLZWVwQUlSZXN1bHRzLCBvcHRpb25zLnNob3VsZFVwZGF0ZUFJU2VhcmNoKTtcblx0XHRcdH0sIGRlbGF5KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFeGNsdWRlUGF0dGVybigpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLmdldFZhbHVlKCkudHJpbSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0SW5jbHVkZVBhdHRlcm4oKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5nZXRWYWx1ZSgpLnRyaW0oKTtcblx0fVxuXG5cdHByaXZhdGUgX29uUXVlcnlDaGFuZ2VkKHByZXNlcnZlRm9jdXM6IGJvb2xlYW4sIHRyaWdnZXJlZE9uVHlwZSA9IGZhbHNlLCBzaG91bGRLZWVwQUlSZXN1bHRzID0gZmFsc2UsIHNob3VsZFVwZGF0ZUFJU2VhcmNoID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAoISh0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dD8uaW5wdXRCb3guaXNJbnB1dFZhbGlkKCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNSZWdleCA9IHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0LmdldFJlZ2V4KCk7XG5cdFx0Y29uc3QgaXNJbk5vdGVib29rTWFya2Rvd25JbnB1dCA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLm1hcmt1cElucHV0O1xuXHRcdGNvbnN0IGlzSW5Ob3RlYm9va01hcmtkb3duUHJldmlldyA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLm1hcmt1cFByZXZpZXc7XG5cdFx0Y29uc3QgaXNJbk5vdGVib29rQ2VsbElucHV0ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0Tm90ZWJvb2tGaWx0ZXJzKCkuY29kZUlucHV0O1xuXHRcdGNvbnN0IGlzSW5Ob3RlYm9va0NlbGxPdXRwdXQgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXROb3RlYm9va0ZpbHRlcnMoKS5jb2RlT3V0cHV0O1xuXG5cdFx0Y29uc3QgaXNXaG9sZVdvcmRzID0gdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0V2hvbGVXb3JkcygpO1xuXHRcdGNvbnN0IGlzQ2FzZVNlbnNpdGl2ZSA9IHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0LmdldENhc2VTZW5zaXRpdmUoKTtcblx0XHRjb25zdCBjb250ZW50UGF0dGVybiA9IHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0LmdldFZhbHVlKCk7XG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm5UZXh0ID0gdGhpcy5fZ2V0RXhjbHVkZVBhdHRlcm4oKTtcblx0XHRjb25zdCBpbmNsdWRlUGF0dGVyblRleHQgPSB0aGlzLl9nZXRJbmNsdWRlUGF0dGVybigpO1xuXHRcdGNvbnN0IHVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMgPSB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLnVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMoKTtcblx0XHRjb25zdCBvbmx5U2VhcmNoSW5PcGVuRWRpdG9ycyA9IHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMub25seVNlYXJjaEluT3BlbkVkaXRvcnMoKTtcblxuXHRcdGlmIChjb250ZW50UGF0dGVybi5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuY2xlYXJTZWFyY2hSZXN1bHRzKGZhbHNlKTtcblx0XHRcdHRoaXMuY2xlYXJNZXNzYWdlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudDogSVBhdHRlcm5JbmZvID0ge1xuXHRcdFx0cGF0dGVybjogY29udGVudFBhdHRlcm4sXG5cdFx0XHRpc1JlZ0V4cDogaXNSZWdleCxcblx0XHRcdGlzQ2FzZVNlbnNpdGl2ZTogaXNDYXNlU2Vuc2l0aXZlLFxuXHRcdFx0aXNXb3JkTWF0Y2g6IGlzV2hvbGVXb3Jkcyxcblx0XHRcdG5vdGVib29rSW5mbzoge1xuXHRcdFx0XHRpc0luTm90ZWJvb2tNYXJrZG93bklucHV0LFxuXHRcdFx0XHRpc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXcsXG5cdFx0XHRcdGlzSW5Ob3RlYm9va0NlbGxJbnB1dCxcblx0XHRcdFx0aXNJbk5vdGVib29rQ2VsbE91dHB1dFxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBleGNsdWRlUGF0dGVybiA9IFt7IHBhdHRlcm46IHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuZ2V0VmFsdWUoKSB9XTtcblx0XHRjb25zdCBpbmNsdWRlUGF0dGVybiA9IHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuZ2V0VmFsdWUoKTtcblxuXHRcdC8vIE5lZWQgdGhlIGZ1bGwgbWF0Y2ggbGluZSB0byBjb3JyZWN0bHkgY2FsY3VsYXRlIHJlcGxhY2UgdGV4dCwgaWYgdGhpcyBpcyBhIHNlYXJjaC9yZXBsYWNlIHdpdGggcmVnZXggZ3JvdXAgcmVmZXJlbmNlcyAoJDEsICQyLCAuLi4pLlxuXHRcdC8vIDEwMDAwIGNoYXJzIGlzIGVub3VnaCB0byBhdm9pZCBzZW5kaW5nIGh1Z2UgYW1vdW50cyBvZiB0ZXh0IGFyb3VuZCwgaWYgeW91IGRvIGEgcmVwbGFjZSB3aXRoIGEgbG9uZ2VyIG1hdGNoLCBpdCBtYXkgb3IgbWF5IG5vdCByZXNvbHZlIHRoZSBncm91cCByZWZzIGNvcnJlY3RseS5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNTgzNzRcblx0XHRjb25zdCBjaGFyc1BlckxpbmUgPSBjb250ZW50LmlzUmVnRXhwID8gMTAwMDAgOiAxMDAwO1xuXG5cdFx0Y29uc3Qgb3B0aW9uczogSVRleHRRdWVyeUJ1aWxkZXJPcHRpb25zID0ge1xuXHRcdFx0X3JlYXNvbjogJ3NlYXJjaFZpZXcnLFxuXHRcdFx0ZXh0cmFGaWxlUmVzb3VyY2VzOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldE91dE9mV29ya3NwYWNlRWRpdG9yUmVzb3VyY2VzKSxcblx0XHRcdG1heFJlc3VsdHM6IHRoaXMuc2VhcmNoQ29uZmlnLm1heFJlc3VsdHMgPz8gdW5kZWZpbmVkLFxuXHRcdFx0ZGlzcmVnYXJkSWdub3JlRmlsZXM6ICF1c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzIHx8IHVuZGVmaW5lZCxcblx0XHRcdGRpc3JlZ2FyZEV4Y2x1ZGVTZXR0aW5nczogIXVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMgfHwgdW5kZWZpbmVkLFxuXHRcdFx0b25seU9wZW5FZGl0b3JzOiBvbmx5U2VhcmNoSW5PcGVuRWRpdG9ycyxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuLFxuXHRcdFx0aW5jbHVkZVBhdHRlcm4sXG5cdFx0XHRwcmV2aWV3T3B0aW9uczoge1xuXHRcdFx0XHRtYXRjaExpbmVzOiAxLFxuXHRcdFx0XHRjaGFyc1BlckxpbmVcblx0XHRcdH0sXG5cdFx0XHRpc1NtYXJ0Q2FzZTogdGhpcy5zZWFyY2hDb25maWcuc21hcnRDYXNlLFxuXHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHR9O1xuXHRcdGNvbnN0IGZvbGRlclJlc291cmNlcyA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblxuXHRcdGNvbnN0IG9uUXVlcnlWYWxpZGF0aW9uRXJyb3IgPSAoZXJyOiBFcnJvcikgPT4ge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LnNob3dNZXNzYWdlKHsgY29udGVudDogZXJyLm1lc3NhZ2UsIHR5cGU6IE1lc3NhZ2VUeXBlLkVSUk9SIH0pO1xuXHRcdFx0dGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LmNsZWFyKCk7XG5cdFx0fTtcblxuXHRcdGxldCBxdWVyeTogSVRleHRRdWVyeTtcblx0XHR0cnkge1xuXHRcdFx0cXVlcnkgPSB0aGlzLnF1ZXJ5QnVpbGRlci50ZXh0KGNvbnRlbnQsIGZvbGRlclJlc291cmNlcy5tYXAoZm9sZGVyID0+IGZvbGRlci51cmkpLCBvcHRpb25zKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG9uUXVlcnlWYWxpZGF0aW9uRXJyb3IoZXJyKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnZhbGlkYXRlUXVlcnkocXVlcnkpLnRoZW4oKCkgPT4ge1xuXHRcdFx0Ly8gZW5zdXJlIHRoYXQgdGhlIG5vZGUgaXMgY2xvc2VkIHdoZW4gYSBuZXcgc2VhcmNoIGlzIHRyaWdnZXJlZFxuXHRcdFx0aWYgKCFzaG91bGRLZWVwQUlSZXN1bHRzICYmICFzaG91bGRVcGRhdGVBSVNlYXJjaCAmJiB0aGlzLnRyZWUuaGFzTm9kZSh0aGlzLnNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpKSB7XG5cdFx0XHRcdHRoaXMudHJlZS5jb2xsYXBzZSh0aGlzLnNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm9uUXVlcnlUcmlnZ2VyZWQocXVlcnksIG9wdGlvbnMsIGV4Y2x1ZGVQYXR0ZXJuVGV4dCwgaW5jbHVkZVBhdHRlcm5UZXh0LCB0cmlnZ2VyZWRPblR5cGUsIHNob3VsZEtlZXBBSVJlc3VsdHMsIHNob3VsZFVwZGF0ZUFJU2VhcmNoKTtcblxuXHRcdFx0aWYgKCFwcmVzZXJ2ZUZvY3VzKSB7XG5cdFx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LmZvY3VzKGZhbHNlLCB1bmRlZmluZWQsIHRydWUpOyAvLyBmb2N1cyBiYWNrIHRvIGlucHV0IGZpZWxkXG5cdFx0XHR9XG5cdFx0fSwgb25RdWVyeVZhbGlkYXRpb25FcnJvcik7XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlUXVlcnkocXVlcnk6IElUZXh0UXVlcnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBWYWxpZGF0ZSBmb2xkZXJRdWVyaWVzXG5cdFx0Y29uc3QgZm9sZGVyUXVlcmllc0V4aXN0UCA9XG5cdFx0XHRxdWVyeS5mb2xkZXJRdWVyaWVzLm1hcChmcSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhmcS5mb2xkZXIpLmNhdGNoKCgpID0+IGZhbHNlKTtcblx0XHRcdH0pO1xuXG5cdFx0cmV0dXJuIFByb21pc2UuYWxsKGZvbGRlclF1ZXJpZXNFeGlzdFApLnRoZW4oZXhpc3RSZXN1bHRzID0+IHtcblx0XHRcdC8vIElmIG5vIGZvbGRlcnMgZXhpc3QsIHNob3cgYW4gZXJyb3IgbWVzc2FnZSBhYm91dCB0aGUgZmlyc3Qgb25lXG5cdFx0XHRjb25zdCBleGlzdGluZ0ZvbGRlclF1ZXJpZXMgPSBxdWVyeS5mb2xkZXJRdWVyaWVzLmZpbHRlcigoZm9sZGVyUXVlcnksIGkpID0+IGV4aXN0UmVzdWx0c1tpXSk7XG5cdFx0XHRpZiAoIXF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoIHx8IGV4aXN0aW5nRm9sZGVyUXVlcmllcy5sZW5ndGgpIHtcblx0XHRcdFx0cXVlcnkuZm9sZGVyUXVlcmllcyA9IGV4aXN0aW5nRm9sZGVyUXVlcmllcztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IG5vbkV4aXN0YW50UGF0aCA9IHF1ZXJ5LmZvbGRlclF1ZXJpZXNbMF0uZm9sZGVyLmZzUGF0aDtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoUGF0aE5vdEZvdW5kRXJyb3IgPSBubHMubG9jYWxpemUoJ3NlYXJjaFBhdGhOb3RGb3VuZEVycm9yJywgXCJTZWFyY2ggcGF0aCBub3QgZm91bmQ6IHswfVwiLCBub25FeGlzdGFudFBhdGgpO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKHNlYXJjaFBhdGhOb3RGb3VuZEVycm9yKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIG9uUXVlcnlUcmlnZ2VyZWQocXVlcnk6IElUZXh0UXVlcnksIG9wdGlvbnM6IElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucywgZXhjbHVkZVBhdHRlcm5UZXh0OiBzdHJpbmcsIGluY2x1ZGVQYXR0ZXJuVGV4dDogc3RyaW5nLCB0cmlnZ2VyZWRPblR5cGU6IGJvb2xlYW4sIHNob3VsZEtlZXBBSVJlc3VsdHM6IGJvb2xlYW4sIHNob3VsZFVwZGF0ZUFJU2VhcmNoOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5hZGRUb1NlYXJjaEhpc3RvcnlEZWxheWVyLnRyaWdnZXIoKCkgPT4ge1xuXHRcdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/Lm9uU2VhcmNoU3VibWl0KCk7XG5cdFx0XHR0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzLm9uU2VhcmNoU3VibWl0KCk7XG5cdFx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLm9uU2VhcmNoU3VibWl0KCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnZpZXdNb2RlbC5jYW5jZWxTZWFyY2godHJ1ZSk7XG5cdFx0dGhpcy52aWV3TW9kZWwuY2FuY2VsQUlTZWFyY2godHJ1ZSk7XG5cblx0XHR0aGlzLmN1cnJlbnRTZWFyY2hRID0gdGhpcy5jdXJyZW50U2VhcmNoUVxuXHRcdFx0LnRoZW4oKCkgPT4gdGhpcy5kb1NlYXJjaChxdWVyeSwgZXhjbHVkZVBhdHRlcm5UZXh0LCBpbmNsdWRlUGF0dGVyblRleHQsIHRyaWdnZXJlZE9uVHlwZSwgc2hvdWxkS2VlcEFJUmVzdWx0cywgc2hvdWxkVXBkYXRlQUlTZWFyY2gpKVxuXHRcdFx0LnRoZW4oKCkgPT4gdW5kZWZpbmVkLCAoKSA9PiB1bmRlZmluZWQpO1xuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVSZXN1bHRzKCkge1xuXHRcdGlmICh0aGlzLnN0YXRlID09PSBTZWFyY2hVSVN0YXRlLklkbGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdC8vIFNlYXJjaCByZXN1bHQgdHJlZSB1cGRhdGVcblx0XHRcdGNvbnN0IGZpbGVDb3VudCA9IHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5maWxlQ291bnQoKTtcblx0XHRcdGlmICh0aGlzLl92aXNpYmxlTWF0Y2hlcyAhPT0gZmlsZUNvdW50KSB7XG5cdFx0XHRcdHRoaXMuX3Zpc2libGVNYXRjaGVzID0gZmlsZUNvdW50O1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlZnJlc2hBbmRVcGRhdGVDb3VudCgpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHQvLyBzaG93IGZyZXF1ZW50IHByb2dyZXNzIGFuZCByZXN1bHRzIGJ5IHNjaGVkdWxpbmcgdXBkYXRlcyA4MCBtcyBhZnRlciB0aGUgbGFzdCBvbmVcblx0XHRcdHRoaXMuX3JlZnJlc2hSZXN1bHRzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBleHBhbmRJZlNpbmd1bGFyUmVzdWx0KCkge1xuXHRcdC8vIGV4cGFuZCBpZiBqdXN0IDEgZmlsZSB3aXRoIGxlc3MgdGhhbiA1MCBtYXRjaGVzXG5cblx0XHRjb25zdCBjb2xsYXBzZVJlc3VsdHMgPSB0aGlzLnNlYXJjaENvbmZpZy5jb2xsYXBzZVJlc3VsdHM7XG5cdFx0aWYgKGNvbGxhcHNlUmVzdWx0cyAhPT0gJ2Fsd2F5c0NvbGxhcHNlJyAmJiB0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcygpLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3Qgb25seU1hdGNoID0gdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKVswXTtcblx0XHRcdGF3YWl0IHRoaXMudHJlZS5leHBhbmRUbyhvbmx5TWF0Y2gpO1xuXHRcdFx0aWYgKG9ubHlNYXRjaC5jb3VudCgpIDwgNTApIHtcblx0XHRcdFx0YXdhaXQgdGhpcy50cmVlLmV4cGFuZChvbmx5TWF0Y2gpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25TZWFyY2hDb21wbGV0ZShwcm9ncmVzc0NvbXBsZXRlOiAoKSA9PiB2b2lkLCBleGNsdWRlUGF0dGVyblRleHQ/OiBzdHJpbmcsIGluY2x1ZGVQYXR0ZXJuVGV4dD86IHN0cmluZywgY29tcGxldGVkPzogSVNlYXJjaENvbXBsZXRlLCBzaG91bGREb0ZpbmFsUmVmcmVzaCA9IHRydWUpIHtcblxuXHRcdHRoaXMuc3RhdGUgPSBTZWFyY2hVSVN0YXRlLklkbGU7XG5cblx0XHQvLyBDb21wbGV0ZSB1cCB0byAxMDAlIGFzIG5lZWRlZFxuXHRcdHByb2dyZXNzQ29tcGxldGUoKTtcblxuXHRcdGlmIChzaG91bGREb0ZpbmFsUmVmcmVzaCkge1xuXHRcdFx0Ly8gYW55dGhpbmcgdGhhdCBnZXRzIGNhbGxlZCBmcm9tIGBnZXRDaGlsZHJlbmAgc2hvdWxkIG5vdCBkbyB0aGlzLCBzaW5jZSB0aGUgdHJlZSB3aWxsIHJlZnJlc2ggYW55d2F5cy5cblx0XHRcdGF3YWl0IHRoaXMucmVmcmVzaEFuZFVwZGF0ZUNvdW50KCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWxsUmVzdWx0cyA9ICF0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuaXNFbXB0eSgpO1xuXHRcdGNvbnN0IGFpUmVzdWx0cyA9IHRoaXMuc2VhcmNoUmVzdWx0LmdldENhY2hlZFNlYXJjaENvbXBsZXRlKHRydWUpO1xuXHRcdGlmIChjb21wbGV0ZWQ/LmV4aXQgPT09IFNlYXJjaENvbXBsZXRpb25FeGl0Q29kZS5OZXdTZWFyY2hTdGFydGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU3BlY2lhbCBjYXNlIGZvciB3aGVuIHdlIGhhdmUgYW4gQUkgcHJvdmlkZXIgcmVnaXN0ZXJlZFxuXHRcdENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkFJUmVzdWx0c1JlcXVlc3RlZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSkuc2V0KHRoaXMuc2hvdWxkU2hvd0FJUmVzdWx0cygpICYmICEhYWlSZXN1bHRzKTtcblxuXHRcdGlmICh0aGlzLnNob3VsZFNob3dBSVJlc3VsdHMoKSAmJiAhYWxsUmVzdWx0cykge1xuXHRcdFx0Y29uc3QgbWVzc2FnZUVsID0gdGhpcy5jbGVhck1lc3NhZ2UoKTtcblx0XHRcdGNvbnN0IG5vUmVzdWx0c01lc3NhZ2UgPSBubHMubG9jYWxpemUoJ25vUmVzdWx0c0ZhbGxiYWNrJywgXCJObyByZXN1bHRzIGZvdW5kLiBcIik7XG5cdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgbm9SZXN1bHRzTWVzc2FnZSk7XG5cblx0XHRcdGxldCBhaU5hbWUgPSAnQ29waWxvdCc7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhaU5hbWUgPSAoYXdhaXQgdGhpcy5zZWFyY2hTZXJ2aWNlLmdldEFJTmFtZSgpKSB8fCBhaU5hbWU7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdC8vIGlnbm9yZVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYWlOYW1lKSB7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaFdpdGhBSUJ1dHRvblRvb2x0aXAgPSBhcHBlbmRLZXlCaW5kaW5nTGFiZWwoXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd0cmlnZ2VyQUlTZWFyY2gudG9vbHRpcCcsIFwiU2VhcmNoIHdpdGggezB9XCIsIGFpTmFtZSksXG5cdFx0XHRcdFx0dGhpcy5rZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlNlYXJjaFdpdGhBSUFjdGlvbklkKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRjb25zdCBzZWFyY2hXaXRoQUlCdXR0b25UZXh0ID0gbmxzLmxvY2FsaXplKCdzZWFyY2hXaXRoQUlCdXR0b25Ub29sdGlwJywgXCJTZWFyY2ggd2l0aCB7MH0uXCIsIGFpTmFtZSk7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaFdpdGhBSUJ1dHRvbiA9IHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLmFkZChuZXcgU2VhcmNoTGlua0J1dHRvbihcblx0XHRcdFx0XHRzZWFyY2hXaXRoQUlCdXR0b25UZXh0LFxuXHRcdFx0XHRcdCgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuU2VhcmNoV2l0aEFJQWN0aW9uSWQpO1xuXHRcdFx0XHRcdH0sIHRoaXMuaG92ZXJTZXJ2aWNlLCBzZWFyY2hXaXRoQUlCdXR0b25Ub29sdGlwKSk7XG5cdFx0XHRcdGRvbS5hcHBlbmQobWVzc2FnZUVsLCBzZWFyY2hXaXRoQUlCdXR0b24uZWxlbWVudCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghYWlSZXN1bHRzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWFsbFJlc3VsdHMpIHtcblx0XHRcdGNvbnN0IGhhc0V4Y2x1ZGVzID0gISFleGNsdWRlUGF0dGVyblRleHQ7XG5cdFx0XHRjb25zdCBoYXNJbmNsdWRlcyA9ICEhaW5jbHVkZVBhdHRlcm5UZXh0O1xuXHRcdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblxuXHRcdFx0aWYgKCFjb21wbGV0ZWQpIHtcblx0XHRcdFx0bWVzc2FnZSA9IFNFQVJDSF9DQU5DRUxMRURfTUVTU0FHRTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5pbnB1dFBhdHRlcm5JbmNsdWRlcy5vbmx5U2VhcmNoSW5PcGVuRWRpdG9ycygpKSB7XG5cdFx0XHRcdGlmIChoYXNJbmNsdWRlcyAmJiBoYXNFeGNsdWRlcykge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ25vT3BlbkVkaXRvclJlc3VsdHNJbmNsdWRlc0V4Y2x1ZGVzJywgXCJObyByZXN1bHRzIGZvdW5kIGluIG9wZW4gZWRpdG9ycyBtYXRjaGluZyAnezB9JyBleGNsdWRpbmcgJ3sxfScgLSBcIiwgaW5jbHVkZVBhdHRlcm5UZXh0LCBleGNsdWRlUGF0dGVyblRleHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhhc0luY2x1ZGVzKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm9PcGVuRWRpdG9yUmVzdWx0c0luY2x1ZGVzJywgXCJObyByZXN1bHRzIGZvdW5kIGluIG9wZW4gZWRpdG9ycyBtYXRjaGluZyAnezB9JyAtIFwiLCBpbmNsdWRlUGF0dGVyblRleHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhhc0V4Y2x1ZGVzKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm9PcGVuRWRpdG9yUmVzdWx0c0V4Y2x1ZGVzJywgXCJObyByZXN1bHRzIGZvdW5kIGluIG9wZW4gZWRpdG9ycyBleGNsdWRpbmcgJ3swfScgLSBcIiwgZXhjbHVkZVBhdHRlcm5UZXh0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZXNzYWdlID0gbmxzLmxvY2FsaXplKCdub09wZW5FZGl0b3JSZXN1bHRzRm91bmQnLCBcIk5vIHJlc3VsdHMgZm91bmQgaW4gb3BlbiBlZGl0b3JzLiBSZXZpZXcgeW91ciBzZXR0aW5ncyBmb3IgY29uZmlndXJlZCBleGNsdXNpb25zIGFuZCBjaGVjayB5b3VyIGdpdGlnbm9yZSBmaWxlcyAtIFwiKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGhhc0luY2x1ZGVzICYmIGhhc0V4Y2x1ZGVzKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm9SZXN1bHRzSW5jbHVkZXNFeGNsdWRlcycsIFwiTm8gcmVzdWx0cyBmb3VuZCBpbiAnezB9JyBleGNsdWRpbmcgJ3sxfScgLSBcIiwgaW5jbHVkZVBhdHRlcm5UZXh0LCBleGNsdWRlUGF0dGVyblRleHQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhhc0luY2x1ZGVzKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbm9SZXN1bHRzSW5jbHVkZXMnLCBcIk5vIHJlc3VsdHMgZm91bmQgaW4gJ3swfScgLSBcIiwgaW5jbHVkZVBhdHRlcm5UZXh0KTtcblx0XHRcdFx0fSBlbHNlIGlmIChoYXNFeGNsdWRlcykge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ25vUmVzdWx0c0V4Y2x1ZGVzJywgXCJObyByZXN1bHRzIGZvdW5kIGV4Y2x1ZGluZyAnezB9JyAtIFwiLCBleGNsdWRlUGF0dGVyblRleHQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBubHMubG9jYWxpemUoJ25vUmVzdWx0c0ZvdW5kJywgXCJObyByZXN1bHRzIGZvdW5kLiBSZXZpZXcgeW91ciBzZXR0aW5ncyBmb3IgY29uZmlndXJlZCBleGNsdXNpb25zIGFuZCBjaGVjayB5b3VyIGdpdGlnbm9yZSBmaWxlcyAtIFwiKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmRpY2F0ZSBhcyBzdGF0dXMgdG8gQVJJQVxuXHRcdFx0YXJpYS5zdGF0dXMobWVzc2FnZSk7XG5cblx0XHRcdGNvbnN0IG1lc3NhZ2VFbCA9IHRoaXMuY2xlYXJNZXNzYWdlKCk7XG5cdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgbWVzc2FnZSk7XG5cblx0XHRcdGlmICghY29tcGxldGVkKSB7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaEFnYWluQnV0dG9uID0gdGhpcy5tZXNzYWdlRGlzcG9zYWJsZXMuYWRkKG5ldyBTZWFyY2hMaW5rQnV0dG9uKFxuXHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgncmVydW5TZWFyY2gubWVzc2FnZScsIFwiU2VhcmNoIGFnYWluXCIpLFxuXHRcdFx0XHRcdCgpID0+IHRoaXMudHJpZ2dlclF1ZXJ5Q2hhbmdlKHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSksIHRoaXMuaG92ZXJTZXJ2aWNlKSk7XG5cdFx0XHRcdGRvbS5hcHBlbmQobWVzc2FnZUVsLCBzZWFyY2hBZ2FpbkJ1dHRvbi5lbGVtZW50KTtcblx0XHRcdH0gZWxzZSBpZiAoaGFzSW5jbHVkZXMgfHwgaGFzRXhjbHVkZXMpIHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoQWdhaW5CdXR0b24gPSB0aGlzLm1lc3NhZ2VEaXNwb3NhYmxlcy5hZGQobmV3IFNlYXJjaExpbmtCdXR0b24obmxzLmxvY2FsaXplKCdyZXJ1blNlYXJjaEluQWxsLm1lc3NhZ2UnLCBcIlNlYXJjaCBhZ2FpbiBpbiBhbGwgZmlsZXNcIiksIHRoaXMub25TZWFyY2hBZ2Fpbi5iaW5kKHRoaXMpLCB0aGlzLmhvdmVyU2VydmljZSkpO1xuXHRcdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgc2VhcmNoQWdhaW5CdXR0b24uZWxlbWVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBvcGVuU2V0dGluZ3NCdXR0b24gPSB0aGlzLm1lc3NhZ2VEaXNwb3NhYmxlcy5hZGQobmV3IFNlYXJjaExpbmtCdXR0b24obmxzLmxvY2FsaXplKCdvcGVuU2V0dGluZ3MubWVzc2FnZScsIFwiT3BlbiBTZXR0aW5nc1wiKSwgdGhpcy5vbk9wZW5TZXR0aW5ncy5iaW5kKHRoaXMpLCB0aGlzLmhvdmVyU2VydmljZSkpO1xuXHRcdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgb3BlblNldHRpbmdzQnV0dG9uLmVsZW1lbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29tcGxldGVkKSB7XG5cdFx0XHRcdGRvbS5hcHBlbmQobWVzc2FnZUVsLCAkKCdzcGFuJywgdW5kZWZpbmVkLCAnIC0gJykpO1xuXG5cdFx0XHRcdGNvbnN0IGxlYXJuTW9yZUJ1dHRvbiA9IHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLmFkZChuZXcgU2VhcmNoTGlua0J1dHRvbihubHMubG9jYWxpemUoJ29wZW5TZXR0aW5ncy5sZWFybk1vcmUnLCBcIkxlYXJuIE1vcmVcIiksIHRoaXMub25MZWFybk1vcmUuYmluZCh0aGlzKSwgdGhpcy5ob3ZlclNlcnZpY2UpKTtcblx0XHRcdFx0ZG9tLmFwcGVuZChtZXNzYWdlRWwsIGxlYXJuTW9yZUJ1dHRvbi5lbGVtZW50KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdFx0dGhpcy5zaG93U2VhcmNoV2l0aG91dEZvbGRlck1lc3NhZ2UoKTtcblx0XHRcdH1cblx0XHRcdHRoaXMucmVMYXlvdXQoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LnRvZ2dsZUhpZ2hsaWdodHModGhpcy5pc1Zpc2libGUoKSk7IC8vIHNob3cgaGlnaGxpZ2h0c1xuXG5cdFx0XHQvLyBJbmRpY2F0ZSBmaW5hbCBzZWFyY2ggcmVzdWx0IGNvdW50IGZvciBBUklBXG5cdFx0XHRhcmlhLnN0YXR1cyhubHMubG9jYWxpemUoJ2FyaWFTZWFyY2hSZXN1bHRzU3RhdHVzJywgXCJTZWFyY2ggcmV0dXJuZWQgezB9IHJlc3VsdHMgaW4gezF9IGZpbGVzXCIsIHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5jb3VudCgpLCB0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuZmlsZUNvdW50KCkpKTtcblx0XHR9XG5cblxuXHRcdGlmIChjb21wbGV0ZWQgJiYgY29tcGxldGVkLmxpbWl0SGl0KSB7XG5cdFx0XHRjb21wbGV0ZWQubWVzc2FnZXMucHVzaCh7IHR5cGU6IFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlLldhcm5pbmcsIHRleHQ6IG5scy5sb2NhbGl6ZSgnc2VhcmNoTWF4UmVzdWx0c1dhcm5pbmcnLCBcIlRoZSByZXN1bHQgc2V0IG9ubHkgY29udGFpbnMgYSBzdWJzZXQgb2YgYWxsIG1hdGNoZXMuIEJlIG1vcmUgc3BlY2lmaWMgaW4geW91ciBzZWFyY2ggdG8gbmFycm93IGRvd24gdGhlIHJlc3VsdHMuXCIpIH0pO1xuXHRcdH1cblxuXHRcdGlmIChjb21wbGV0ZWQgJiYgY29tcGxldGVkLm1lc3NhZ2VzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgY29tcGxldGVkLm1lc3NhZ2VzKSB7XG5cdFx0XHRcdHRoaXMuYWRkTWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnJlTGF5b3V0KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uU2VhcmNoRXJyb3IoZTogYW55LCBwcm9ncmVzc0NvbXBsZXRlOiAoKSA9PiB2b2lkLCBleGNsdWRlUGF0dGVyblRleHQ/OiBzdHJpbmcsIGluY2x1ZGVQYXR0ZXJuVGV4dD86IHN0cmluZywgY29tcGxldGVkPzogSVNlYXJjaENvbXBsZXRlLCBzaG91bGREb0ZpbmFsUmVmcmVzaCA9IHRydWUpIHtcblx0XHR0aGlzLnN0YXRlID0gU2VhcmNoVUlTdGF0ZS5JZGxlO1xuXHRcdGlmIChlcnJvcnMuaXNDYW5jZWxsYXRpb25FcnJvcihlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMub25TZWFyY2hDb21wbGV0ZShwcm9ncmVzc0NvbXBsZXRlLCBleGNsdWRlUGF0dGVyblRleHQsIGluY2x1ZGVQYXR0ZXJuVGV4dCwgY29tcGxldGVkLCBzaG91bGREb0ZpbmFsUmVmcmVzaCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByb2dyZXNzQ29tcGxldGUoKTtcblx0XHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0Py5zaG93TWVzc2FnZSh7IGNvbnRlbnQ6IGUubWVzc2FnZSwgdHlwZTogTWVzc2FnZVR5cGUuRVJST1IgfSk7XG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuY2xlYXIoKTtcblxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhc3luYyBhZGRBSVJlc3VsdHMoKSB7XG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm5UZXh0ID0gdGhpcy5fZ2V0RXhjbHVkZVBhdHRlcm4oKTtcblx0XHRjb25zdCBpbmNsdWRlUGF0dGVyblRleHQgPSB0aGlzLl9nZXRJbmNsdWRlUGF0dGVybigpO1xuXHRcdGxldCBwcm9ncmVzc0NvbXBsZXRlOiAoKSA9PiB2b2lkO1xuXHRcdHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmdldFByb2dyZXNzTG9jYXRpb24oKSwgZGVsYXk6IDAgfSwgX3Byb2dyZXNzID0+IHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHByb2dyZXNzQ29tcGxldGUgPSByZXNvbHZlKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuc2VhcmNoV2lkZ2V0LnNlYXJjaElucHV0Py5jbGVhck1lc3NhZ2UoKTtcblx0XHR0aGlzLnN0YXRlID0gU2VhcmNoVUlTdGF0ZS5TZWFyY2hpbmc7XG5cdFx0dGhpcy5zaG93RW1wdHlTdGFnZSgpO1xuXG5cdFx0Y29uc3Qgc2xvd1RpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnN0YXRlID0gU2VhcmNoVUlTdGF0ZS5TbG93U2VhcmNoO1xuXHRcdH0sIDIwMDApO1xuXG5cdFx0dGhpcy5fdmlzaWJsZU1hdGNoZXMgPSAwO1xuXG5cdFx0dGhpcy50cmVlLnNldFNlbGVjdGlvbihbXSk7XG5cdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdKTtcblxuXHRcdHRoaXMudmlld01vZGVsLnJlcGxhY2VTdHJpbmcgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXRSZXBsYWNlVmFsdWUoKTtcblx0XHR0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuc2V0QUlRdWVyeVVzaW5nVGV4dFF1ZXJ5KCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy52aWV3TW9kZWwuYWRkQUlSZXN1bHRzKCk7XG5cdFx0cmV0dXJuIHJlc3VsdC50aGVuKChjb21wbGV0ZSkgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHNsb3dUaW1lcik7XG5cdFx0XHR0aGlzLnVwZGF0ZVNlYXJjaFJlc3VsdENvdW50KHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5xdWVyeT8udXNlckRpc2FibGVkRXhjbHVkZXNBbmRJZ25vcmVGaWxlcywgdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LnF1ZXJ5Py5vbmx5T3BlbkVkaXRvcnMsIGZhbHNlKTtcblx0XHRcdHJldHVybiB0aGlzLm9uU2VhcmNoQ29tcGxldGUocHJvZ3Jlc3NDb21wbGV0ZSwgZXhjbHVkZVBhdHRlcm5UZXh0LCBpbmNsdWRlUGF0dGVyblRleHQsIGNvbXBsZXRlLCBmYWxzZSk7XG5cdFx0fSwgKGUpID0+IHtcblx0XHRcdGNsZWFyVGltZW91dChzbG93VGltZXIpO1xuXHRcdFx0cmV0dXJuIHRoaXMub25TZWFyY2hFcnJvcihlLCBwcm9ncmVzc0NvbXBsZXRlLCBleGNsdWRlUGF0dGVyblRleHQsIGluY2x1ZGVQYXR0ZXJuVGV4dCwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGRvU2VhcmNoKHF1ZXJ5OiBJVGV4dFF1ZXJ5LCBleGNsdWRlUGF0dGVyblRleHQ6IHN0cmluZywgaW5jbHVkZVBhdHRlcm5UZXh0OiBzdHJpbmcsIHRyaWdnZXJlZE9uVHlwZTogYm9vbGVhbiwgc2hvdWxkS2VlcEFJUmVzdWx0czogYm9vbGVhbiwgc2hvdWxkVXBkYXRlQUlTZWFyY2g6IGJvb2xlYW4pOiBUaGVuYWJsZTx2b2lkPiB7XG5cdFx0bGV0IHByb2dyZXNzQ29tcGxldGU6ICgpID0+IHZvaWQ7XG5cdFx0dGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKHsgbG9jYXRpb246IHRoaXMuZ2V0UHJvZ3Jlc3NMb2NhdGlvbigpLCBkZWxheTogdHJpZ2dlcmVkT25UeXBlID8gMzAwIDogMCB9LCBfcHJvZ3Jlc3MgPT4ge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcHJvZ3Jlc3NDb21wbGV0ZSA9IHJlc29sdmUpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQ/LmNsZWFyTWVzc2FnZSgpO1xuXHRcdHRoaXMuc3RhdGUgPSBTZWFyY2hVSVN0YXRlLlNlYXJjaGluZztcblx0XHR0aGlzLnNob3dFbXB0eVN0YWdlKCk7XG5cdFx0dGhpcy5tb2RlbC5zZWFyY2hSZXN1bHQuYWlUZXh0U2VhcmNoUmVzdWx0LmhpZGRlbiA9ICFzaG91bGRLZWVwQUlSZXN1bHRzICYmICFzaG91bGRVcGRhdGVBSVNlYXJjaDtcblxuXHRcdGNvbnN0IHNsb3dUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5zdGF0ZSA9IFNlYXJjaFVJU3RhdGUuU2xvd1NlYXJjaDtcblx0XHR9LCAyMDAwKTtcblxuXHRcdHRoaXMuX3Zpc2libGVNYXRjaGVzID0gMDtcblxuXHRcdHRoaXMuX3JlZnJlc2hSZXN1bHRzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cblx0XHR0aGlzLnNlYXJjaFdpZGdldC5zZXRSZXBsYWNlQWxsQWN0aW9uU3RhdGUoZmFsc2UpO1xuXG5cdFx0dGhpcy50cmVlLnNldFNlbGVjdGlvbihbXSk7XG5cdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdKTtcblxuXHRcdHRoaXMudmlld01vZGVsLnJlcGxhY2VTdHJpbmcgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXRSZXBsYWNlVmFsdWUoKTtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLnZpZXdNb2RlbC5zZWFyY2gocXVlcnkpO1xuXG5cdFx0aWYgKCFzaG91bGRLZWVwQUlSZXN1bHRzIHx8IHNob3VsZFVwZGF0ZUFJU2VhcmNoKSB7XG5cdFx0XHR0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQuc2V0QUlRdWVyeVVzaW5nVGV4dFF1ZXJ5KHF1ZXJ5KTtcblx0XHR9XG5cblx0XHRpZiAoc2hvdWxkVXBkYXRlQUlTZWFyY2gpIHtcblx0XHRcdHRoaXMudHJlZS51cGRhdGVDaGlsZHJlbih0aGlzLnNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQuYXN5bmNSZXN1bHRzLnRoZW4oKGNvbXBsZXRlKSA9PiB7XG5cdFx0XHRjbGVhclRpbWVvdXQoc2xvd1RpbWVyKTtcblx0XHRcdHJldHVybiB0aGlzLm9uU2VhcmNoQ29tcGxldGUocHJvZ3Jlc3NDb21wbGV0ZSwgZXhjbHVkZVBhdHRlcm5UZXh0LCBpbmNsdWRlUGF0dGVyblRleHQsIGNvbXBsZXRlKTtcblx0XHR9LCAoZSkgPT4ge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KHNsb3dUaW1lcik7XG5cdFx0XHRyZXR1cm4gdGhpcy5vblNlYXJjaEVycm9yKGUsIHByb2dyZXNzQ29tcGxldGUsIGV4Y2x1ZGVQYXR0ZXJuVGV4dCwgaW5jbHVkZVBhdHRlcm5UZXh0KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25PcGVuU2V0dGluZ3MoZTogZG9tLkV2ZW50TGlrZSk6IHZvaWQge1xuXHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGUsIGZhbHNlKTtcblx0XHR0aGlzLm9wZW5TZXR0aW5ncygnQGlkOmZpbGVzLmV4Y2x1ZGUsc2VhcmNoLmV4Y2x1ZGUsc2VhcmNoLnVzZVBhcmVudElnbm9yZUZpbGVzLHNlYXJjaC51c2VHbG9iYWxJZ25vcmVGaWxlcyxzZWFyY2gudXNlSWdub3JlRmlsZXMnKTtcblx0fVxuXG5cdHByaXZhdGUgb3BlblNldHRpbmdzKHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgb3B0aW9uczogSVNldHRpbmdzRWRpdG9yT3B0aW9ucyA9IHsgcXVlcnkgfTtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSA/XG5cdFx0XHR0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuV29ya3NwYWNlU2V0dGluZ3Mob3B0aW9ucykgOlxuXHRcdFx0dGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblVzZXJTZXR0aW5ncyhvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgb25MZWFybk1vcmUoKTogdm9pZCB7XG5cdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKCdodHRwczovL2dvLm1pY3Jvc29mdC5jb20vZndsaW5rLz9saW5raWQ9ODUzOTc3JykpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNlYXJjaEFnYWluKCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuRXhjbHVkZXMuc2V0VmFsdWUoJycpO1xuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuc2V0VmFsdWUoJycpO1xuXHRcdHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuc2V0T25seVNlYXJjaEluT3BlbkVkaXRvcnMoZmFsc2UpO1xuXG5cdFx0dGhpcy50cmlnZ2VyUXVlcnlDaGFuZ2UoeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgb25FbmFibGVFeGNsdWRlcygpOiB2b2lkIHtcblx0XHR0aGlzLnRvZ2dsZVF1ZXJ5RGV0YWlscyhmYWxzZSwgdHJ1ZSk7XG5cdFx0dGhpcy5zZWFyY2hFeGNsdWRlUGF0dGVybi5zZXRVc2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzKHRydWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRpc2FibGVTZWFyY2hJbk9wZW5FZGl0b3JzKCk6IHZvaWQge1xuXHRcdHRoaXMudG9nZ2xlUXVlcnlEZXRhaWxzKGZhbHNlLCB0cnVlKTtcblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLnNldE9ubHlTZWFyY2hJbk9wZW5FZGl0b3JzKGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2VhcmNoUmVzdWx0Q291bnQoZGlzcmVnYXJkRXhjbHVkZXNBbmRJZ25vcmVzPzogYm9vbGVhbiwgb25seU9wZW5FZGl0b3JzPzogYm9vbGVhbiwgY2xlYXI6IGJvb2xlYW4gPSBmYWxzZSk6IHZvaWQge1xuXHRcdGNvbnN0IGZpbGVDb3VudCA9IHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5maWxlQ291bnQoKTtcblx0XHRjb25zdCByZXN1bHRDb3VudCA9IHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5jb3VudCgpO1xuXHRcdHRoaXMuaGFzU2VhcmNoUmVzdWx0c0tleS5zZXQoZmlsZUNvdW50ID4gMCk7XG5cblx0XHRjb25zdCBtc2dXYXNIaWRkZW4gPSB0aGlzLm1lc3NhZ2VzRWxlbWVudC5zdHlsZS5kaXNwbGF5ID09PSAnbm9uZSc7XG5cblx0XHRjb25zdCBtZXNzYWdlRWwgPSB0aGlzLmNsZWFyTWVzc2FnZSgpO1xuXHRcdGNvbnN0IHJlc3VsdE1zZyA9IGNsZWFyID8gJycgOiB0aGlzLmJ1aWxkUmVzdWx0Q291bnRNZXNzYWdlKHJlc3VsdENvdW50LCBmaWxlQ291bnQpO1xuXHRcdHRoaXMudHJlZS5hcmlhTGFiZWwgPSByZXN1bHRNc2cgKyBubHMubG9jYWxpemUoJ2ZvclRlcm0nLCBcIiAtIFNlYXJjaDogezB9XCIsIHRoaXMuc2VhcmNoUmVzdWx0LnF1ZXJ5Py5jb250ZW50UGF0dGVybi5wYXR0ZXJuID8/ICcnKTtcblx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgcmVzdWx0TXNnKTtcblxuXHRcdGlmIChmaWxlQ291bnQgPiAwKSB7XG5cdFx0XHRpZiAoZGlzcmVnYXJkRXhjbHVkZXNBbmRJZ25vcmVzKSB7XG5cdFx0XHRcdGNvbnN0IGV4Y2x1ZGVzRGlzYWJsZWRNZXNzYWdlID0gJyAtICcgKyBubHMubG9jYWxpemUoJ3VzZUlnbm9yZXNBbmRFeGNsdWRlc0Rpc2FibGVkJywgXCJleGNsdWRlIHNldHRpbmdzIGFuZCBpZ25vcmUgZmlsZXMgYXJlIGRpc2FibGVkXCIpICsgJyAnO1xuXHRcdFx0XHRjb25zdCBlbmFibGVFeGNsdWRlc0J1dHRvbiA9IHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLmFkZChuZXcgU2VhcmNoTGlua0J1dHRvbihubHMubG9jYWxpemUoJ2V4Y2x1ZGVzLmVuYWJsZScsIFwiZW5hYmxlXCIpLCB0aGlzLm9uRW5hYmxlRXhjbHVkZXMuYmluZCh0aGlzKSwgdGhpcy5ob3ZlclNlcnZpY2UsIG5scy5sb2NhbGl6ZSgndXNlRXhjbHVkZXNBbmRJZ25vcmVGaWxlc0Rlc2NyaXB0aW9uJywgXCJVc2UgRXhjbHVkZSBTZXR0aW5ncyBhbmQgSWdub3JlIEZpbGVzXCIpKSk7XG5cdFx0XHRcdGRvbS5hcHBlbmQobWVzc2FnZUVsLCAkKCdzcGFuJywgdW5kZWZpbmVkLCBleGNsdWRlc0Rpc2FibGVkTWVzc2FnZSwgJygnLCBlbmFibGVFeGNsdWRlc0J1dHRvbi5lbGVtZW50LCAnKScpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG9ubHlPcGVuRWRpdG9ycykge1xuXHRcdFx0XHRjb25zdCBzZWFyY2hpbmdJbk9wZW5NZXNzYWdlID0gJyAtICcgKyBubHMubG9jYWxpemUoJ29ubHlPcGVuRWRpdG9ycycsIFwic2VhcmNoaW5nIG9ubHkgaW4gb3BlbiBmaWxlc1wiKSArICcgJztcblx0XHRcdFx0Y29uc3QgZGlzYWJsZU9wZW5FZGl0b3JzQnV0dG9uID0gdGhpcy5tZXNzYWdlRGlzcG9zYWJsZXMuYWRkKG5ldyBTZWFyY2hMaW5rQnV0dG9uKG5scy5sb2NhbGl6ZSgnb3BlbkVkaXRvcnMuZGlzYWJsZScsIFwiZGlzYWJsZVwiKSwgdGhpcy5vbkRpc2FibGVTZWFyY2hJbk9wZW5FZGl0b3JzLmJpbmQodGhpcyksIHRoaXMuaG92ZXJTZXJ2aWNlLCBubHMubG9jYWxpemUoJ2Rpc2FibGVPcGVuRWRpdG9ycycsIFwiU2VhcmNoIGluIGVudGlyZSB3b3Jrc3BhY2VcIikpKTtcblx0XHRcdFx0ZG9tLmFwcGVuZChtZXNzYWdlRWwsICQoJ3NwYW4nLCB1bmRlZmluZWQsIHNlYXJjaGluZ0luT3Blbk1lc3NhZ2UsICcoJywgZGlzYWJsZU9wZW5FZGl0b3JzQnV0dG9uLmVsZW1lbnQsICcpJykpO1xuXHRcdFx0fVxuXG5cdFx0XHRkb20uYXBwZW5kKG1lc3NhZ2VFbCwgJyAtICcpO1xuXG5cdFx0XHRjb25zdCBvcGVuSW5FZGl0b3JUb29sdGlwID0gYXBwZW5kS2V5QmluZGluZ0xhYmVsKFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ29wZW5JbkVkaXRvci50b29sdGlwJywgXCJDb3B5IGN1cnJlbnQgc2VhcmNoIHJlc3VsdHMgdG8gYW4gZWRpdG9yXCIpLFxuXHRcdFx0XHR0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuT3BlbkluRWRpdG9yQ29tbWFuZElkKSk7XG5cdFx0XHRjb25zdCBvcGVuSW5FZGl0b3JCdXR0b24gPSB0aGlzLm1lc3NhZ2VEaXNwb3NhYmxlcy5hZGQobmV3IFNlYXJjaExpbmtCdXR0b24oXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnb3BlbkluRWRpdG9yLm1lc3NhZ2UnLCBcIk9wZW4gaW4gZWRpdG9yXCIpLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGNyZWF0ZUVkaXRvckZyb21TZWFyY2hSZXN1bHQsIHRoaXMuc2VhcmNoUmVzdWx0LCB0aGlzLnNlYXJjaEluY2x1ZGVQYXR0ZXJuLmdldFZhbHVlKCksIHRoaXMuc2VhcmNoRXhjbHVkZVBhdHRlcm4uZ2V0VmFsdWUoKSwgdGhpcy5zZWFyY2hJbmNsdWRlUGF0dGVybi5vbmx5U2VhcmNoSW5PcGVuRWRpdG9ycygpKSwgdGhpcy5ob3ZlclNlcnZpY2UsXG5cdFx0XHRcdG9wZW5JbkVkaXRvclRvb2x0aXApKTtcblx0XHRcdGRvbS5hcHBlbmQobWVzc2FnZUVsLCBvcGVuSW5FZGl0b3JCdXR0b24uZWxlbWVudCk7XG5cblx0XHRcdHRoaXMucmVMYXlvdXQoKTtcblx0XHR9IGVsc2UgaWYgKCFtc2dXYXNIaWRkZW4pIHtcblx0XHRcdGRvbS5oaWRlKHRoaXMubWVzc2FnZXNFbGVtZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkZE1lc3NhZ2UobWVzc2FnZTogVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZSkge1xuXHRcdGNvbnN0IG1lc3NhZ2VCb3ggPSB0aGlzLm1lc3NhZ2VzRWxlbWVudC5maXJzdENoaWxkIGFzIEhUTUxEaXZFbGVtZW50O1xuXHRcdGlmICghbWVzc2FnZUJveCkgeyByZXR1cm47IH1cblx0XHRkb20uYXBwZW5kKG1lc3NhZ2VCb3gsIHJlbmRlclNlYXJjaE1lc3NhZ2UobWVzc2FnZSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMuY29tbWFuZFNlcnZpY2UsIHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLCAoKSA9PiB0aGlzLnRyaWdnZXJRdWVyeUNoYW5nZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGJ1aWxkUmVzdWx0Q291bnRNZXNzYWdlKHJlc3VsdENvdW50OiBudW1iZXIsIGZpbGVDb3VudDogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRpZiAocmVzdWx0Q291bnQgPT09IDEgJiYgZmlsZUNvdW50ID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzZWFyY2guZmlsZS5yZXN1bHQnLCBcInswfSByZXN1bHQgaW4gezF9IGZpbGVcIiwgcmVzdWx0Q291bnQsIGZpbGVDb3VudCk7XG5cdFx0fSBlbHNlIGlmIChyZXN1bHRDb3VudCA9PT0gMSkge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnc2VhcmNoLmZpbGVzLnJlc3VsdCcsIFwiezB9IHJlc3VsdCBpbiB7MX0gZmlsZXNcIiwgcmVzdWx0Q291bnQsIGZpbGVDb3VudCk7XG5cdFx0fSBlbHNlIGlmIChmaWxlQ291bnQgPT09IDEpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3NlYXJjaC5maWxlLnJlc3VsdHMnLCBcInswfSByZXN1bHRzIGluIHsxfSBmaWxlXCIsIHJlc3VsdENvdW50LCBmaWxlQ291bnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzZWFyY2guZmlsZXMucmVzdWx0cycsIFwiezB9IHJlc3VsdHMgaW4gezF9IGZpbGVzXCIsIHJlc3VsdENvdW50LCBmaWxlQ291bnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd1NlYXJjaFdpdGhvdXRGb2xkZXJNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMuc2VhcmNoV2l0aG91dEZvbGRlck1lc3NhZ2VFbGVtZW50ID0gdGhpcy5jbGVhck1lc3NhZ2UoKTtcblxuXHRcdGNvbnN0IHRleHRFbCA9IGRvbS5hcHBlbmQodGhpcy5zZWFyY2hXaXRob3V0Rm9sZGVyTWVzc2FnZUVsZW1lbnQsXG5cdFx0XHQkKCdwJywgdW5kZWZpbmVkLCBubHMubG9jYWxpemUoJ3NlYXJjaFdpdGhvdXRGb2xkZXInLCBcIllvdSBoYXZlIG5vdCBvcGVuZWQgb3Igc3BlY2lmaWVkIGEgZm9sZGVyLiBPbmx5IG9wZW4gZmlsZXMgYXJlIGN1cnJlbnRseSBzZWFyY2hlZCAtIFwiKSkpO1xuXG5cdFx0Y29uc3Qgb3BlbkZvbGRlckJ1dHRvbiA9IHRoaXMubWVzc2FnZURpc3Bvc2FibGVzLmFkZChuZXcgU2VhcmNoTGlua0J1dHRvbihcblx0XHRcdG5scy5sb2NhbGl6ZSgnb3BlbkZvbGRlcicsIFwiT3BlbiBGb2xkZXJcIiksXG5cdFx0XHQoKSA9PiB7XG5cdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZW52LmlzTWFjaW50b3NoICYmIGVudi5pc05hdGl2ZSA/IE9wZW5GaWxlRm9sZGVyQWN0aW9uLklEIDogT3BlbkZvbGRlckFjdGlvbi5JRCkuY2F0Y2goZXJyID0+IGVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihlcnIpKTtcblx0XHRcdH0sIHRoaXMuaG92ZXJTZXJ2aWNlKSk7XG5cdFx0ZG9tLmFwcGVuZCh0ZXh0RWwsIG9wZW5Gb2xkZXJCdXR0b24uZWxlbWVudCk7XG5cdH1cblxuXHRwcml2YXRlIHNob3dFbXB0eVN0YWdlKGZvcmNlSGlkZU1lc3NhZ2VzID0gZmFsc2UpOiB2b2lkIHtcblx0XHRjb25zdCBzaG93aW5nQ2FuY2VsbGVkID0gKHRoaXMubWVzc2FnZXNFbGVtZW50LmZpcnN0Q2hpbGQ/LnRleHRDb250ZW50Py5pbmRleE9mKFNFQVJDSF9DQU5DRUxMRURfTUVTU0FHRSkgPz8gLTEpID4gLTE7XG5cblx0XHQvLyBjbGVhbiB1cCB1aVxuXHRcdC8vIHRoaXMucmVwbGFjZVNlcnZpY2UuZGlzcG9zZUFsbFJlcGxhY2VQcmV2aWV3cygpO1xuXHRcdGlmIChzaG93aW5nQ2FuY2VsbGVkIHx8IGZvcmNlSGlkZU1lc3NhZ2VzIHx8ICF0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uPigpLnNlYXJjaC5zZWFyY2hPblR5cGUpIHtcblx0XHRcdC8vIHdoZW4gaW4gc2VhcmNoIHRvIHR5cGUsIGRvbid0IHByZWVtcHRpdmVseSBoaWRlLCBhcyBpdCBjYXVzZXMgZmxpY2tlcmluZyBhbmQgc2hpZnRpbmcgb2YgdGhlIGxpdmUgcmVzdWx0c1xuXHRcdFx0ZG9tLmhpZGUodGhpcy5tZXNzYWdlc0VsZW1lbnQpO1xuXHRcdH1cblxuXHRcdGRvbS5zaG93KHRoaXMucmVzdWx0c0VsZW1lbnQpO1xuXHRcdHRoaXMuY3VycmVudFNlbGVjdGVkRmlsZU1hdGNoID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRPcGVuSW5Ob3RlYm9va0VkaXRvcihtYXRjaDogSVNlYXJjaFRyZWVNYXRjaCwgdXJpOiBVUkkpOiBib29sZWFuIHtcblx0XHQvLyBVbnRpdGxlZCBmaWxlcyB3aWxsIHJldHVybiBhIGZhbHNlIHBvc2l0aXZlIGZvciBnZXRDb250cmlidXRlZE5vdGVib29rVHlwZXMuXG5cdFx0Ly8gU2luY2UgdW50aXRsZWQgZmlsZXMgYXJlIGFscmVhZHkgb3BlbiwgdGhlbiB1bnRpdGxlZCBub3RlYm9va3Mgc2hvdWxkIHJldHVybiBOb3RlYm9va01hdGNoIHJlc3VsdHMuXG5cdFx0cmV0dXJuIGlzSU1hdGNoSW5Ob3RlYm9vayhtYXRjaCkgfHwgKHVyaS5zY2hlbWUgIT09IG5ldHdvcmsuU2NoZW1hcy51bnRpdGxlZCAmJiB0aGlzLm5vdGVib29rU2VydmljZS5nZXRDb250cmlidXRlZE5vdGVib29rVHlwZXModXJpKS5sZW5ndGggPiAwKTtcblx0fVxuXG5cdHByaXZhdGUgb25Gb2N1cyhsaW5lTWF0Y2g6IElTZWFyY2hUcmVlTWF0Y2gsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuLCBzaWRlQnlTaWRlPzogYm9vbGVhbiwgcGlubmVkPzogYm9vbGVhbik6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgdXNlUmVwbGFjZVByZXZpZXcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uPigpLnNlYXJjaC51c2VSZXBsYWNlUHJldmlldztcblxuXHRcdGNvbnN0IHJlc291cmNlID0gaXNTZWFyY2hUcmVlTWF0Y2gobGluZU1hdGNoKSA/IGxpbmVNYXRjaC5wYXJlbnQoKS5yZXNvdXJjZSA6ICg8SVNlYXJjaFRyZWVGaWxlTWF0Y2g+bGluZU1hdGNoKS5yZXNvdXJjZTtcblx0XHRyZXR1cm4gKHVzZVJlcGxhY2VQcmV2aWV3ICYmIHRoaXMudmlld01vZGVsLmlzUmVwbGFjZUFjdGl2ZSgpICYmICEhdGhpcy52aWV3TW9kZWwucmVwbGFjZVN0cmluZyAmJiAhKHRoaXMuc2hvdWxkT3BlbkluTm90ZWJvb2tFZGl0b3IobGluZU1hdGNoLCByZXNvdXJjZSkpKSA/XG5cdFx0XHR0aGlzLnJlcGxhY2VTZXJ2aWNlLm9wZW5SZXBsYWNlUHJldmlldyhsaW5lTWF0Y2gsIHByZXNlcnZlRm9jdXMsIHNpZGVCeVNpZGUsIHBpbm5lZCkgOlxuXHRcdFx0dGhpcy5vcGVuKGxpbmVNYXRjaCwgcHJlc2VydmVGb2N1cywgc2lkZUJ5U2lkZSwgcGlubmVkLCByZXNvdXJjZSk7XG5cdH1cblxuXHRhc3luYyBvcGVuKGVsZW1lbnQ6IEZpbGVNYXRjaE9yTWF0Y2gsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuLCBzaWRlQnlTaWRlPzogYm9vbGVhbiwgcGlubmVkPzogYm9vbGVhbiwgcmVzb3VyY2VJbnB1dD86IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IGdldEVkaXRvclNlbGVjdGlvbkZyb21NYXRjaChlbGVtZW50LCB0aGlzLnZpZXdNb2RlbCk7XG5cdFx0Y29uc3Qgb2xkUGFyZW50TWF0Y2hlcyA9IGlzU2VhcmNoVHJlZU1hdGNoKGVsZW1lbnQpID8gZWxlbWVudC5wYXJlbnQoKS5tYXRjaGVzKCkgOiBbXTtcblx0XHRjb25zdCByZXNvdXJjZSA9IHJlc291cmNlSW5wdXQgPz8gKGlzU2VhcmNoVHJlZU1hdGNoKGVsZW1lbnQpID8gZWxlbWVudC5wYXJlbnQoKS5yZXNvdXJjZSA6ICg8SVNlYXJjaFRyZWVGaWxlTWF0Y2g+ZWxlbWVudCkucmVzb3VyY2UpO1xuXHRcdGxldCBlZGl0b3I6IElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHtcblx0XHRcdHByZXNlcnZlRm9jdXMsXG5cdFx0XHRwaW5uZWQsXG5cdFx0XHRzZWxlY3Rpb24sXG5cdFx0XHRyZXZlYWxJZlZpc2libGU6IHRydWUsXG5cdFx0fTtcblxuXHRcdHRyeSB7XG5cdFx0XHRlZGl0b3IgPSBhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlOiByZXNvdXJjZSxcblx0XHRcdFx0b3B0aW9ucyxcblx0XHRcdH0sIHNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogQUNUSVZFX0dST1VQKTtcblxuXHRcdFx0Y29uc3QgZWRpdG9yQ29udHJvbCA9IGVkaXRvcj8uZ2V0Q29udHJvbCgpO1xuXHRcdFx0aWYgKGlzU2VhcmNoVHJlZU1hdGNoKGVsZW1lbnQpICYmIHByZXNlcnZlRm9jdXMgJiYgaXNDb2RlRWRpdG9yKGVkaXRvckNvbnRyb2wpKSB7XG5cdFx0XHRcdHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5nZXRSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zKCkuaGlnaGxpZ2h0UmFuZ2UoXG5cdFx0XHRcdFx0ZWRpdG9yQ29udHJvbC5nZXRNb2RlbCgpISxcblx0XHRcdFx0XHRlbGVtZW50LnJhbmdlKClcblx0XHRcdFx0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5nZXRSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zKCkucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGVycm9ycy5vblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXRvcikge1xuXHRcdFx0Y29uc3QgZWxlbVBhcmVudCA9IGVsZW1lbnQucGFyZW50KCkgYXMgSU5vdGVib29rRmlsZUluc3RhbmNlTWF0Y2g7XG5cdFx0XHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbWVudCkpIHtcblx0XHRcdFx0aWYgKGlzSU1hdGNoSW5Ob3RlYm9vayhlbGVtZW50KSkge1xuXHRcdFx0XHRcdGVsZW1lbnQucGFyZW50KCkuc2hvd01hdGNoKGVsZW1lbnQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGVkaXRvcldpZGdldCA9IGVkaXRvci5nZXRDb250cm9sKCk7XG5cdFx0XHRcdFx0aWYgKGVkaXRvcldpZGdldCkge1xuXHRcdFx0XHRcdFx0Ly8gRW5zdXJlIHRoYXQgdGhlIGVkaXRvciB3aWRnZXQgaXMgYmluZGVkLiBJZiBpZiBpcywgdGhlbiB0aGlzIHNob3VsZCByZXR1cm4gaW1tZWRpYXRlbHkuXG5cdFx0XHRcdFx0XHQvLyBPdGhlcndpc2UsIGl0IHdpbGwgYmluZCB0aGUgd2lkZ2V0LlxuXHRcdFx0XHRcdFx0ZWxlbVBhcmVudC5iaW5kTm90ZWJvb2tFZGl0b3JXaWRnZXQoZWRpdG9yV2lkZ2V0KTtcblx0XHRcdFx0XHRcdGF3YWl0IGVsZW1QYXJlbnQudXBkYXRlTWF0Y2hlc0ZvckVkaXRvcldpZGdldCgpO1xuXG5cdFx0XHRcdFx0XHRjb25zdCBtYXRjaEluZGV4ID0gb2xkUGFyZW50TWF0Y2hlcy5maW5kSW5kZXgoZSA9PiBlLmlkKCkgPT09IGVsZW1lbnQuaWQoKSk7XG5cdFx0XHRcdFx0XHRjb25zdCBtYXRjaGVzID0gZWxlbVBhcmVudC5tYXRjaGVzKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBtYXRjaCA9IG1hdGNoSW5kZXggPj0gbWF0Y2hlcy5sZW5ndGggPyBtYXRjaGVzW21hdGNoZXMubGVuZ3RoIC0gMV0gOiBtYXRjaGVzW21hdGNoSW5kZXhdO1xuXG5cdFx0XHRcdFx0XHRpZiAoaXNJTWF0Y2hJbk5vdGVib29rKG1hdGNoKSkge1xuXHRcdFx0XHRcdFx0XHRlbGVtUGFyZW50LnNob3dNYXRjaChtYXRjaCk7XG5cdFx0XHRcdFx0XHRcdGlmICghdGhpcy50cmVlLmdldEZvY3VzKCkuaW5jbHVkZXMobWF0Y2gpIHx8ICF0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCkuaW5jbHVkZXMobWF0Y2gpKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy50cmVlLnNldFNlbGVjdGlvbihbbWF0Y2hdLCBnZXRTZWxlY3Rpb25LZXlib2FyZEV2ZW50KCkpO1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbbWF0Y2hdKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdG9wZW5FZGl0b3JXaXRoTXVsdGlDdXJzb3IoZWxlbWVudDogRmlsZU1hdGNoT3JNYXRjaCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gaXNTZWFyY2hUcmVlTWF0Y2goZWxlbWVudCkgPyBlbGVtZW50LnBhcmVudCgpLnJlc291cmNlIDogKDxJU2VhcmNoVHJlZUZpbGVNYXRjaD5lbGVtZW50KS5yZXNvdXJjZTtcblx0XHRyZXR1cm4gdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiBmYWxzZSxcblx0XHRcdFx0cGlubmVkOiB0cnVlLFxuXHRcdFx0XHRyZXZlYWxJZlZpc2libGU6IHRydWVcblx0XHRcdH1cblx0XHR9KS50aGVuKGVkaXRvciA9PiB7XG5cdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdGxldCBmaWxlTWF0Y2ggPSBudWxsO1xuXHRcdFx0XHRpZiAoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0ZmlsZU1hdGNoID0gZWxlbWVudDtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChpc1NlYXJjaFRyZWVNYXRjaChlbGVtZW50KSkge1xuXHRcdFx0XHRcdGZpbGVNYXRjaCA9IGVsZW1lbnQucGFyZW50KCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZmlsZU1hdGNoKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9ucyA9IGZpbGVNYXRjaC5tYXRjaGVzKCkubWFwKG0gPT4gbmV3IFNlbGVjdGlvbihtLnJhbmdlKCkuc3RhcnRMaW5lTnVtYmVyLCBtLnJhbmdlKCkuc3RhcnRDb2x1bW4sIG0ucmFuZ2UoKS5lbmRMaW5lTnVtYmVyLCBtLnJhbmdlKCkuZW5kQ29sdW1uKSk7XG5cdFx0XHRcdFx0Y29uc3QgY29kZUVkaXRvciA9IGdldENvZGVFZGl0b3IoZWRpdG9yLmdldENvbnRyb2woKSk7XG5cdFx0XHRcdFx0aWYgKGNvZGVFZGl0b3IpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG11bHRpQ3Vyc29yQ29udHJvbGxlciA9IE11bHRpQ3Vyc29yU2VsZWN0aW9uQ29udHJvbGxlci5nZXQoY29kZUVkaXRvcik7XG5cdFx0XHRcdFx0XHRtdWx0aUN1cnNvckNvbnRyb2xsZXI/LnNlbGVjdEFsbFVzaW5nU2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5nZXRSYW5nZUhpZ2hsaWdodERlY29yYXRpb25zKCkucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHR9LCBlcnJvcnMub25VbmV4cGVjdGVkRXJyb3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblVudGl0bGVkRGlkRGlzcG9zZShyZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnZpZXdNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHJlbW92ZSBzZWFyY2ggcmVzdWx0cyBmcm9tIHRoaXMgcmVzb3VyY2UgYXMgaXQgZ290IGRpc3Bvc2VkXG5cdFx0bGV0IG1hdGNoZXMgPSB0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcygpO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBtYXRjaGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRpZiAocmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gbWF0Y2hlc1tpXS5yZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHRoaXMudmlld01vZGVsLnNlYXJjaFJlc3VsdC5yZW1vdmUobWF0Y2hlc1tpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG1hdGNoZXMgPSB0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcyh0cnVlKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbWF0Y2hlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0aWYgKHJlc291cmNlLnRvU3RyaW5nKCkgPT09IG1hdGNoZXNbaV0ucmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHR0aGlzLnZpZXdNb2RlbC5zZWFyY2hSZXN1bHQucmVtb3ZlKG1hdGNoZXNbaV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25GaWxlc0NoYW5nZWQoZTogRmlsZUNoYW5nZXNFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy52aWV3TW9kZWwgfHwgKHRoaXMuc2VhcmNoQ29uZmlnLnNvcnRPcmRlciAhPT0gU2VhcmNoU29ydE9yZGVyLk1vZGlmaWVkICYmICFlLmdvdERlbGV0ZWQoKSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtYXRjaGVzID0gdGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKTtcblx0XHRpZiAoZS5nb3REZWxldGVkKCkpIHtcblx0XHRcdGNvbnN0IGRlbGV0ZWRNYXRjaGVzID0gbWF0Y2hlcy5maWx0ZXIobSA9PiBlLmNvbnRhaW5zKG0ucmVzb3VyY2UsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpKTtcblxuXHRcdFx0dGhpcy52aWV3TW9kZWwuc2VhcmNoUmVzdWx0LnJlbW92ZShkZWxldGVkTWF0Y2hlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIENoZWNrIGlmIHRoZSBjaGFuZ2VkIGZpbGUgY29udGFpbmVkIG1hdGNoZXNcblx0XHRcdGNvbnN0IGNoYW5nZWRNYXRjaGVzID0gbWF0Y2hlcy5maWx0ZXIobSA9PiBlLmNvbnRhaW5zKG0ucmVzb3VyY2UpKTtcblx0XHRcdGlmIChjaGFuZ2VkTWF0Y2hlcy5sZW5ndGggJiYgdGhpcy5zZWFyY2hDb25maWcuc29ydE9yZGVyID09PSBTZWFyY2hTb3J0T3JkZXIuTW9kaWZpZWQpIHtcblx0XHRcdFx0Ly8gTm8gbWF0Y2hlcyBuZWVkIHRvIGJlIHJlbW92ZWQsIGJ1dCBtb2RpZmllZCBmaWxlcyBuZWVkIHRvIGhhdmUgdGhlaXIgZmlsZSBzdGF0IHVwZGF0ZWQuXG5cdFx0XHRcdHRoaXMudXBkYXRlRmlsZVN0YXRzKGNoYW5nZWRNYXRjaGVzKS50aGVuKGFzeW5jICgpID0+IHRoaXMucmVmcmVzaFRyZWVDb250cm9sbGVyLnF1ZXVlKCkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IHNlYXJjaENvbmZpZygpOiBJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXMge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcz4oJ3NlYXJjaCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckhpc3RvcnkoKTogdm9pZCB7XG5cdFx0dGhpcy5zZWFyY2hXaWRnZXQuY2xlYXJIaXN0b3J5KCk7XG5cdFx0dGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5jbGVhckhpc3RvcnkoKTtcblx0XHR0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzLmNsZWFySGlzdG9yeSgpO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHQvLyBUaGlzIGNhbiBiZSBjYWxsZWQgYmVmb3JlIHJlbmRlckJvZHkoKSBtZXRob2QgZ2V0cyBjYWxsZWQgZm9yIHRoZSBmaXJzdCB0aW1lXG5cdFx0Ly8gaWYgd2UgbW92ZSB0aGUgc2VhcmNoVmlldyBpbnNpZGUgYW5vdGhlciB2aWV3UGFuZUNvbnRhaW5lclxuXHRcdGlmICghdGhpcy5zZWFyY2hXaWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXR0ZXJuRXhjbHVkZXMgPSB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzPy5nZXRWYWx1ZSgpLnRyaW0oKSA/PyAnJztcblx0XHRjb25zdCBwYXR0ZXJuSW5jbHVkZXMgPSB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzPy5nZXRWYWx1ZSgpLnRyaW0oKSA/PyAnJztcblx0XHRjb25zdCBvbmx5T3BlbkVkaXRvcnMgPSB0aGlzLmlucHV0UGF0dGVybkluY2x1ZGVzPy5vbmx5U2VhcmNoSW5PcGVuRWRpdG9ycygpID8/IGZhbHNlO1xuXHRcdGNvbnN0IHVzZUV4Y2x1ZGVzQW5kSWdub3JlRmlsZXMgPSB0aGlzLmlucHV0UGF0dGVybkV4Y2x1ZGVzPy51c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzKCkgPz8gdHJ1ZTtcblx0XHRjb25zdCBwcmVzZXJ2ZUNhc2UgPSB0aGlzLnZpZXdNb2RlbC5wcmVzZXJ2ZUNhc2U7XG5cblx0XHRpZiAodGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQpIHtcblx0XHRcdGNvbnN0IGlzUmVnZXggPSB0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dC5nZXRSZWdleCgpO1xuXHRcdFx0Y29uc3QgaXNXaG9sZVdvcmRzID0gdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0V2hvbGVXb3JkcygpO1xuXHRcdFx0Y29uc3QgaXNDYXNlU2Vuc2l0aXZlID0gdGhpcy5zZWFyY2hXaWRnZXQuc2VhcmNoSW5wdXQuZ2V0Q2FzZVNlbnNpdGl2ZSgpO1xuXHRcdFx0Y29uc3QgY29udGVudFBhdHRlcm4gPSB0aGlzLnNlYXJjaFdpZGdldC5zZWFyY2hJbnB1dC5nZXRWYWx1ZSgpO1xuXG5cdFx0XHRjb25zdCBpc0luTm90ZWJvb2tDZWxsSW5wdXQgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXROb3RlYm9va0ZpbHRlcnMoKS5jb2RlSW5wdXQ7XG5cdFx0XHRjb25zdCBpc0luTm90ZWJvb2tDZWxsT3V0cHV0ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0Tm90ZWJvb2tGaWx0ZXJzKCkuY29kZU91dHB1dDtcblx0XHRcdGNvbnN0IGlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQgPSB0aGlzLnNlYXJjaFdpZGdldC5nZXROb3RlYm9va0ZpbHRlcnMoKS5tYXJrdXBJbnB1dDtcblx0XHRcdGNvbnN0IGlzSW5Ob3RlYm9va01hcmtkb3duUHJldmlldyA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldE5vdGVib29rRmlsdGVycygpLm1hcmt1cFByZXZpZXc7XG5cblx0XHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5jb250ZW50UGF0dGVybiddID0gY29udGVudFBhdHRlcm47XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkucmVnZXgnXSA9IGlzUmVnZXg7XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkud2hvbGVXb3JkcyddID0gaXNXaG9sZVdvcmRzO1xuXHRcdFx0dGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LmNhc2VTZW5zaXRpdmUnXSA9IGlzQ2FzZVNlbnNpdGl2ZTtcblxuXHRcdFx0dGhpcy52aWV3bGV0U3RhdGVbJ3F1ZXJ5LmlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQnXSA9IGlzSW5Ob3RlYm9va01hcmtkb3duSW5wdXQ7XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuaXNJbk5vdGVib29rTWFya2Rvd25QcmV2aWV3J10gPSBpc0luTm90ZWJvb2tNYXJrZG93blByZXZpZXc7XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuaXNJbk5vdGVib29rQ2VsbElucHV0J10gPSBpc0luTm90ZWJvb2tDZWxsSW5wdXQ7XG5cdFx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuaXNJbk5vdGVib29rQ2VsbE91dHB1dCddID0gaXNJbk5vdGVib29rQ2VsbE91dHB1dDtcblx0XHR9XG5cblx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkuZm9sZGVyRXhjbHVzaW9ucyddID0gcGF0dGVybkV4Y2x1ZGVzO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5mb2xkZXJJbmNsdWRlcyddID0gcGF0dGVybkluY2x1ZGVzO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS51c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzJ10gPSB1c2VFeGNsdWRlc0FuZElnbm9yZUZpbGVzO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5wcmVzZXJ2ZUNhc2UnXSA9IHByZXNlcnZlQ2FzZTtcblx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsncXVlcnkub25seU9wZW5FZGl0b3JzJ10gPSBvbmx5T3BlbkVkaXRvcnM7XG5cblx0XHRjb25zdCBpc1JlcGxhY2VTaG93biA9IHRoaXMuc2VhcmNoQW5kUmVwbGFjZVdpZGdldC5pc1JlcGxhY2VTaG93bigpO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWyd2aWV3LnNob3dSZXBsYWNlJ10gPSBpc1JlcGxhY2VTaG93bjtcblx0XHR0aGlzLnZpZXdsZXRTdGF0ZVsndmlldy50cmVlTGF5b3V0J10gPSB0aGlzLmlzVHJlZUxheW91dFZpZXdWaXNpYmxlO1xuXHRcdHRoaXMudmlld2xldFN0YXRlWydxdWVyeS5yZXBsYWNlVGV4dCddID0gaXNSZXBsYWNlU2hvd24gJiYgdGhpcy5zZWFyY2hXaWRnZXQuZ2V0UmVwbGFjZVZhbHVlKCk7XG5cblx0XHR0aGlzLl9zYXZlU2VhcmNoSGlzdG9yeVNlcnZpY2UoKTtcblxuXHRcdHRoaXMubWVtZW50by5zYXZlTWVtZW50bygpO1xuXG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9zYXZlU2VhcmNoSGlzdG9yeVNlcnZpY2UoKSB7XG5cdFx0aWYgKHRoaXMuc2VhcmNoV2lkZ2V0ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgaGlzdG9yeTogSVNlYXJjaEhpc3RvcnlWYWx1ZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoSGlzdG9yeSA9IHRoaXMuc2VhcmNoV2lkZ2V0LmdldFNlYXJjaEhpc3RvcnkoKTtcblx0XHRpZiAoc2VhcmNoSGlzdG9yeSAmJiBzZWFyY2hIaXN0b3J5Lmxlbmd0aCkge1xuXHRcdFx0aGlzdG9yeS5zZWFyY2ggPSBzZWFyY2hIaXN0b3J5O1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcGxhY2VIaXN0b3J5ID0gdGhpcy5zZWFyY2hXaWRnZXQuZ2V0UmVwbGFjZUhpc3RvcnkoKTtcblx0XHRpZiAocmVwbGFjZUhpc3RvcnkgJiYgcmVwbGFjZUhpc3RvcnkubGVuZ3RoKSB7XG5cdFx0XHRoaXN0b3J5LnJlcGxhY2UgPSByZXBsYWNlSGlzdG9yeTtcblx0XHR9XG5cblx0XHRjb25zdCBwYXR0ZXJuRXhjbHVkZXNIaXN0b3J5ID0gdGhpcy5pbnB1dFBhdHRlcm5FeGNsdWRlcy5nZXRIaXN0b3J5KCk7XG5cdFx0aWYgKHBhdHRlcm5FeGNsdWRlc0hpc3RvcnkgJiYgcGF0dGVybkV4Y2x1ZGVzSGlzdG9yeS5sZW5ndGgpIHtcblx0XHRcdGhpc3RvcnkuZXhjbHVkZSA9IHBhdHRlcm5FeGNsdWRlc0hpc3Rvcnk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGF0dGVybkluY2x1ZGVzSGlzdG9yeSA9IHRoaXMuaW5wdXRQYXR0ZXJuSW5jbHVkZXMuZ2V0SGlzdG9yeSgpO1xuXHRcdGlmIChwYXR0ZXJuSW5jbHVkZXNIaXN0b3J5ICYmIHBhdHRlcm5JbmNsdWRlc0hpc3RvcnkubGVuZ3RoKSB7XG5cdFx0XHRoaXN0b3J5LmluY2x1ZGUgPSBwYXR0ZXJuSW5jbHVkZXNIaXN0b3J5O1xuXHRcdH1cblxuXHRcdHRoaXMuc2VhcmNoSGlzdG9yeVNlcnZpY2Uuc2F2ZShoaXN0b3J5KTtcblx0fVxuXG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVGaWxlU3RhdHMoZWxlbWVudHM6IElTZWFyY2hUcmVlRmlsZU1hdGNoW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlcyA9IGVsZW1lbnRzLm1hcChmID0+IGYucmVzb2x2ZUZpbGVTdGF0KHRoaXMuZmlsZVNlcnZpY2UpKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChmaWxlcyk7XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUZpbGVTdGF0cygpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGZpbGVNYXRjaCBvZiB0aGlzLnNlYXJjaFJlc3VsdC5tYXRjaGVzKCkpIHtcblx0XHRcdGZpbGVNYXRjaC5maWxlU3RhdCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBmaWxlTWF0Y2ggb2YgdGhpcy5zZWFyY2hSZXN1bHQubWF0Y2hlcyh0cnVlKSkge1xuXHRcdFx0ZmlsZU1hdGNoLmZpbGVTdGF0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLnNhdmVTdGF0ZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5cbmNsYXNzIFNlYXJjaExpbmtCdXR0b24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcsIGhhbmRsZXI6IChlOiBkb20uRXZlbnRMaWtlKSA9PiB1bmtub3duLCBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsIHRvb2x0aXA/OiBzdHJpbmcpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZWxlbWVudCA9ICQoJ2EucG9pbnRlcicsIHsgdGFiaW5kZXg6IDAgfSwgbGFiZWwpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5lbGVtZW50LCB0b29sdGlwKSk7XG5cdFx0dGhpcy5hZGRFdmVudEhhbmRsZXJzKGhhbmRsZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRFdmVudEhhbmRsZXJzKGhhbmRsZXI6IChlOiBkb20uRXZlbnRMaWtlKSA9PiB1bmtub3duKTogdm9pZCB7XG5cdFx0Y29uc3Qgd3JhcHBlZEhhbmRsZXIgPSAoZTogZG9tLkV2ZW50TGlrZSkgPT4ge1xuXHRcdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZSwgZmFsc2UpO1xuXHRcdFx0aGFuZGxlcihlKTtcblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIHdyYXBwZWRIYW5kbGVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdFx0aWYgKGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0d3JhcHBlZEhhbmRsZXIoZSk7XG5cdFx0XHRcdGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RWRpdG9yU2VsZWN0aW9uRnJvbU1hdGNoKGVsZW1lbnQ6IEZpbGVNYXRjaE9yTWF0Y2gsIHZpZXdNb2RlbDogSVNlYXJjaE1vZGVsKSB7XG5cdGxldCBtYXRjaDogSVNlYXJjaFRyZWVNYXRjaCB8IG51bGwgPSBudWxsO1xuXHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbWVudCkpIHtcblx0XHRtYXRjaCA9IGVsZW1lbnQ7XG5cdH1cblx0aWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChlbGVtZW50KSAmJiBlbGVtZW50LmNvdW50KCkgPiAwKSB7XG5cdFx0bWF0Y2ggPSBlbGVtZW50Lm1hdGNoZXMoKVtlbGVtZW50Lm1hdGNoZXMoKS5sZW5ndGggLSAxXTtcblx0fVxuXHRpZiAobWF0Y2gpIHtcblx0XHRjb25zdCByYW5nZSA9IG1hdGNoLnJhbmdlKCk7XG5cdFx0aWYgKHZpZXdNb2RlbC5pc1JlcGxhY2VBY3RpdmUoKSAmJiAhIXZpZXdNb2RlbC5yZXBsYWNlU3RyaW5nKSB7XG5cdFx0XHRjb25zdCByZXBsYWNlU3RyaW5nID0gbWF0Y2gucmVwbGFjZVN0cmluZztcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRzdGFydENvbHVtbjogcmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IHJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0ZW5kQ29sdW1uOiByYW5nZS5zdGFydENvbHVtbiArIHJlcGxhY2VTdHJpbmcubGVuZ3RoXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gcmFuZ2U7XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNlbGVjdGlvblRleHRGcm9tRWRpdG9yKGFsbG93VW5zZWxlY3RlZFdvcmQ6IGJvb2xlYW4sIGFjdGl2ZUVkaXRvcjogSUVkaXRvcik6IHN0cmluZyB8IG51bGwge1xuXG5cdGxldCBlZGl0b3IgPSBhY3RpdmVFZGl0b3I7XG5cblx0aWYgKGlzRGlmZkVkaXRvcihlZGl0b3IpKSB7XG5cdFx0aWYgKGVkaXRvci5nZXRPcmlnaW5hbEVkaXRvcigpLmhhc1RleHRGb2N1cygpKSB7XG5cdFx0XHRlZGl0b3IgPSBlZGl0b3IuZ2V0T3JpZ2luYWxFZGl0b3IoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZWRpdG9yID0gZWRpdG9yLmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc0NvZGVFZGl0b3IoZWRpdG9yKSB8fCAhZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGNvbnN0IHJhbmdlID0gZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRpZiAoIXJhbmdlKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRpZiAocmFuZ2UuaXNFbXB0eSgpKSB7XG5cdFx0aWYgKGFsbG93VW5zZWxlY3RlZFdvcmQpIHtcblx0XHRcdGNvbnN0IHdvcmRBdFBvc2l0aW9uID0gZWRpdG9yLmdldE1vZGVsKCkuZ2V0V29yZEF0UG9zaXRpb24ocmFuZ2UuZ2V0U3RhcnRQb3NpdGlvbigpKTtcblx0XHRcdHJldHVybiB3b3JkQXRQb3NpdGlvbj8ud29yZCA/PyBudWxsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRsZXQgc2VhcmNoVGV4dCA9ICcnO1xuXHRmb3IgKGxldCBpID0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyOyBpIDw9IHJhbmdlLmVuZExpbmVOdW1iZXI7IGkrKykge1xuXHRcdGxldCBsaW5lVGV4dCA9IGVkaXRvci5nZXRNb2RlbCgpLmdldExpbmVDb250ZW50KGkpO1xuXHRcdGlmIChpID09PSByYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRsaW5lVGV4dCA9IGxpbmVUZXh0LnN1YnN0cmluZygwLCByYW5nZS5lbmRDb2x1bW4gLSAxKTtcblx0XHR9XG5cblx0XHRpZiAoaSA9PT0gcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyKSB7XG5cdFx0XHRsaW5lVGV4dCA9IGxpbmVUZXh0LnN1YnN0cmluZyhyYW5nZS5zdGFydENvbHVtbiAtIDEpO1xuXHRcdH1cblxuXHRcdGlmIChpICE9PSByYW5nZS5zdGFydExpbmVOdW1iZXIpIHtcblx0XHRcdGxpbmVUZXh0ID0gJ1xcbicgKyBsaW5lVGV4dDtcblx0XHR9XG5cblx0XHRzZWFyY2hUZXh0ICs9IGxpbmVUZXh0O1xuXHR9XG5cblx0cmV0dXJuIHNlYXJjaFRleHQ7XG59XG5cbmNsYXNzIFNlYXJjaFZpZXdEYXRhU291cmNlIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxJU2VhcmNoUmVzdWx0LCBSZW5kZXJhYmxlTWF0Y2g+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHNlYXJjaFZpZXc6IFNlYXJjaFZpZXcsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblxuXHRwcml2YXRlIGdldCBzZWFyY2hDb25maWcoKTogSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VhcmNoUmVzdWx0SXRlcmF0b3Ioc2VhcmNoUmVzdWx0OiBJU2VhcmNoUmVzdWx0KTogSXRlcmFibGU8UmVuZGVyYWJsZU1hdGNoPiB7XG5cblx0XHRjb25zdCByZXQ6IElUZXh0U2VhcmNoSGVhZGluZ1tdID0gW107XG5cblx0XHRpZiAodGhpcy5zZWFyY2hWaWV3LnNob3VsZFNob3dBSVJlc3VsdHMoKSAmJiBzZWFyY2hSZXN1bHQuc2VhcmNoTW9kZWwuaGFzUGxhaW5SZXN1bHRzICYmICFzZWFyY2hSZXN1bHQuYWlUZXh0U2VhcmNoUmVzdWx0LmhpZGRlbikge1xuXHRcdFx0Ly8gYXMgbG9uZyBhcyB0aGVyZSBpcyBhIHF1ZXJ5IHByZXNlbnQsIHdlIGNhbiBsb2FkIEFJIHJlc3VsdHNcblx0XHRcdHJldC5wdXNoKHNlYXJjaFJlc3VsdC5haVRleHRTZWFyY2hSZXN1bHQpO1xuXHRcdH1cblxuXHRcdGlmICghc2VhcmNoUmVzdWx0LnBsYWluVGV4dFNlYXJjaFJlc3VsdC5pc0VtcHR5KCkpIHtcblx0XHRcdGlmICghdGhpcy5zZWFyY2hWaWV3LnNob3VsZFNob3dBSVJlc3VsdHMoKSB8fCBzZWFyY2hSZXN1bHQuYWlUZXh0U2VhcmNoUmVzdWx0LmhpZGRlbikge1xuXHRcdFx0XHQvLyBvbmx5IG9uZSByb290LCBzbyBqdXN0IHJldHVybiB0aGUgY2hpbGRyZW5cblx0XHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlVGV4dFNlYXJjaFJlc3VsdEl0ZXJhdG9yKHNlYXJjaFJlc3VsdC5wbGFpblRleHRTZWFyY2hSZXN1bHQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0LnB1c2goc2VhcmNoUmVzdWx0LnBsYWluVGV4dFNlYXJjaFJlc3VsdCk7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gcmV0O1xuXG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVRleHRTZWFyY2hSZXN1bHRJdGVyYXRvcih0ZXh0U2VhcmNoUmVzdWx0OiBJVGV4dFNlYXJjaEhlYWRpbmcpOiBJdGVyYWJsZTxJU2VhcmNoVHJlZUZvbGRlck1hdGNoIHwgSVNlYXJjaFRyZWVGaWxlTWF0Y2g+IHtcblx0XHRjb25zdCBmb2xkZXJNYXRjaGVzID0gdGV4dFNlYXJjaFJlc3VsdC5mb2xkZXJNYXRjaGVzKClcblx0XHRcdC5maWx0ZXIoZm0gPT4gIWZtLmlzRW1wdHkoKSlcblx0XHRcdC5zb3J0KHNlYXJjaE1hdGNoQ29tcGFyZXIpO1xuXG5cdFx0aWYgKGZvbGRlck1hdGNoZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVGb2xkZXJJdGVyYXRvcihmb2xkZXJNYXRjaGVzWzBdKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZvbGRlck1hdGNoZXM7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZvbGRlckl0ZXJhdG9yKGZvbGRlck1hdGNoOiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoKTogSXRlcmFibGU8SVNlYXJjaFRyZWVGb2xkZXJNYXRjaCB8IElTZWFyY2hUcmVlRmlsZU1hdGNoPiB7XG5cdFx0Y29uc3QgbWF0Y2hBcnJheSA9IHRoaXMuc2VhcmNoVmlldy5pc1RyZWVMYXlvdXRWaWV3VmlzaWJsZSA/IGZvbGRlck1hdGNoLm1hdGNoZXMoKSA6IGZvbGRlck1hdGNoLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpO1xuXHRcdGxldCBtYXRjaGVzID0gbWF0Y2hBcnJheTtcblx0XHRpZiAoIShmb2xkZXJNYXRjaCBpbnN0YW5jZW9mIEFJRm9sZGVyTWF0Y2hXb3Jrc3BhY2VSb290SW1wbCkpIHtcblx0XHRcdG1hdGNoZXMgPSBtYXRjaEFycmF5LnNvcnQoKGEsIGIpID0+IHNlYXJjaE1hdGNoQ29tcGFyZXIoYSwgYiwgdGhpcy5zZWFyY2hDb25maWcuc29ydE9yZGVyKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hdGNoZXM7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZpbGVJdGVyYXRvcihmaWxlTWF0Y2g6IElTZWFyY2hUcmVlRmlsZU1hdGNoKTogSXRlcmFibGU8SVNlYXJjaFRyZWVNYXRjaD4ge1xuXHRcdGNvbnN0IG1hdGNoZXMgPSBmaWxlTWF0Y2gubWF0Y2hlcygpLnNvcnQoc2VhcmNoTWF0Y2hDb21wYXJlcik7XG5cdFx0cmV0dXJuIG1hdGNoZXM7XG5cdH1cblxuXHRoYXNDaGlsZHJlbihlbGVtZW50OiBSZW5kZXJhYmxlTWF0Y2gpOiBib29sZWFuIHtcblx0XHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoaXNUZXh0U2VhcmNoSGVhZGluZyhlbGVtZW50KSAmJiBlbGVtZW50LmlzQUlDb250cmlidXRlZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzQ2hpbGRyZW4gPSBlbGVtZW50Lmhhc0NoaWxkcmVuO1xuXHRcdHJldHVybiBoYXNDaGlsZHJlbjtcblx0fVxuXG5cdGdldENoaWxkcmVuKGVsZW1lbnQ6IFJlbmRlcmFibGVNYXRjaCB8IElTZWFyY2hSZXN1bHQpOiBJdGVyYWJsZTxSZW5kZXJhYmxlTWF0Y2g+IHwgUHJvbWlzZTxJdGVyYWJsZTxSZW5kZXJhYmxlTWF0Y2g+PiB7XG5cdFx0aWYgKGlzU2VhcmNoUmVzdWx0KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVTZWFyY2hSZXN1bHRJdGVyYXRvcihlbGVtZW50KTtcblx0XHR9IGVsc2UgaWYgKGlzVGV4dFNlYXJjaEhlYWRpbmcoZWxlbWVudCkpIHtcblx0XHRcdGlmIChlbGVtZW50LmlzQUlDb250cmlidXRlZCAmJiAhdGhpcy5zZWFyY2hWaWV3Lm1vZGVsLmhhc0FJUmVzdWx0cykge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hWaWV3LmFkZEFJUmVzdWx0cygpLnRoZW4oKCkgPT4gdGhpcy5jcmVhdGVUZXh0U2VhcmNoUmVzdWx0SXRlcmF0b3IoZWxlbWVudCkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlVGV4dFNlYXJjaFJlc3VsdEl0ZXJhdG9yKGVsZW1lbnQpO1xuXHRcdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2goZWxlbWVudCkpIHtcblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZUZvbGRlckl0ZXJhdG9yKGVsZW1lbnQpO1xuXHRcdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVGaWxlSXRlcmF0b3IoZWxlbWVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtdO1xuXG5cdH1cblx0Z2V0UGFyZW50KGVsZW1lbnQ6IFJlbmRlcmFibGVNYXRjaCk6IFJlbmRlcmFibGVNYXRjaCB7XG5cdFx0Y29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnQoKTtcblx0XHRpZiAoaXNTZWFyY2hSZXN1bHQocGFyZW50KSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGVsZW1lbnQgcGFzc2VkIHRvIGdldFBhcmVudCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gcGFyZW50O1xuXHR9XG59XG5cbmNsYXNzIFJlZnJlc2hUcmVlQ29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVmcmVzaFRyZWVUaHJvdHRsZXI6IFRocm90dGxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaFZpZXc6IFNlYXJjaFZpZXcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBnZVNlYXJjaENvbmZpZzogKCkgPT4gSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVmcmVzaFRyZWVUaHJvdHRsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhyb3R0bGVyKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBxdWV1ZWRJQ2hhbmdlRXZlbnRzOiBJQ2hhbmdlRXZlbnRbXSA9IFtdO1xuXG5cdHB1YmxpYyBhc3luYyBxdWV1ZShlPzogSUNoYW5nZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGUpIHtcblx0XHRcdHRoaXMucXVldWVkSUNoYW5nZUV2ZW50cy5wdXNoKGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5yZWZyZXNoVHJlZVRocm90dGxlci5xdWV1ZSh0aGlzLnJlZnJlc2hUcmVlVXNpbmdRdWV1ZS5iaW5kKHRoaXMpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVmcmVzaFRyZWVVc2luZ1F1ZXVlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFnZ3JlZ2F0ZUNoYW5nZUV2ZW50OiBJQ2hhbmdlRXZlbnQgfCB1bmRlZmluZWQgPSB0aGlzLnF1ZXVlZElDaGFuZ2VFdmVudHMubGVuZ3RoID09PSAwID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0ZWxlbWVudHM6IHRoaXMucXVldWVkSUNoYW5nZUV2ZW50cy5tYXAoZSA9PiBlLmVsZW1lbnRzKS5mbGF0KCksXG5cdFx0XHRhZGRlZDogdGhpcy5xdWV1ZWRJQ2hhbmdlRXZlbnRzLnNvbWUoZSA9PiBlLmFkZGVkKSxcblx0XHRcdHJlbW92ZWQ6IHRoaXMucXVldWVkSUNoYW5nZUV2ZW50cy5zb21lKGUgPT4gZS5yZW1vdmVkKSxcblx0XHRcdGNsZWFyaW5nQWxsOiB0aGlzLnF1ZXVlZElDaGFuZ2VFdmVudHMuc29tZShlID0+IGUuY2xlYXJpbmdBbGwpLFxuXHRcdH07XG5cdFx0dGhpcy5xdWV1ZWRJQ2hhbmdlRXZlbnRzID0gW107XG5cdFx0cmV0dXJuIHRoaXMucmVmcmVzaFRyZWUoYWdncmVnYXRlQ2hhbmdlRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXRyaWV2ZUZpbGVTdGF0cygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuc2VhcmNoVmlldy5tb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcygpLmZpbHRlcihmID0+ICFmLmZpbGVTdGF0KS5tYXAoZiA9PiBmLnJlc29sdmVGaWxlU3RhdCh0aGlzLmZpbGVTZXJ2aWNlKSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoZmlsZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoVHJlZShldmVudD86IElDaGFuZ2VFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlYXJjaENvbmZpZyA9IHRoaXMuZ2VTZWFyY2hDb25maWcoKTtcblx0XHRpZiAoIWV2ZW50IHx8IGV2ZW50LmFkZGVkIHx8IGV2ZW50LnJlbW92ZWQpIHtcblx0XHRcdC8vIFJlZnJlc2ggd2hvbGUgdHJlZVxuXHRcdFx0aWYgKHNlYXJjaENvbmZpZy5zb3J0T3JkZXIgPT09IFNlYXJjaFNvcnRPcmRlci5Nb2RpZmllZCkge1xuXHRcdFx0XHQvLyBFbnN1cmUgYWxsIG1hdGNoZXMgaGF2ZSByZXRyaWV2ZWQgdGhlaXIgZmlsZSBzdGF0XG5cdFx0XHRcdGF3YWl0IHRoaXMucmV0cmlldmVGaWxlU3RhdHMoKVxuXHRcdFx0XHRcdC50aGVuKCgpID0+IHRoaXMuc2VhcmNoVmlldy5nZXRDb250cm9sKCkudXBkYXRlQ2hpbGRyZW4odW5kZWZpbmVkKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpLnVwZGF0ZUNoaWxkcmVuKHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIElmIHVwZGF0ZWQgY291bnRzIGFmZmVjdCBvdXIgc2VhcmNoIG9yZGVyLCByZS1zb3J0IHRoZSB2aWV3LlxuXHRcdFx0aWYgKHNlYXJjaENvbmZpZy5zb3J0T3JkZXIgPT09IFNlYXJjaFNvcnRPcmRlci5Db3VudEFzY2VuZGluZyB8fFxuXHRcdFx0XHRzZWFyY2hDb25maWcuc29ydE9yZGVyID09PSBTZWFyY2hTb3J0T3JkZXIuQ291bnREZXNjZW5kaW5nKSB7XG5cblx0XHRcdFx0YXdhaXQgdGhpcy5zZWFyY2hWaWV3LmdldENvbnRyb2woKS51cGRhdGVDaGlsZHJlbih1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgdHJlZUhhc0FsbEVsZW1lbnRzID0gZXZlbnQuZWxlbWVudHMuZXZlcnkoZWxlbSA9PiB0aGlzLnNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpLmhhc05vZGUoZWxlbSkpO1xuXHRcdFx0XHRpZiAodHJlZUhhc0FsbEVsZW1lbnRzKSB7XG5cdFx0XHRcdFx0Ly8gSUZpbGVNYXRjaEluc3RhbmNlIG1vZGlmaWVkLCByZWZyZXNoIHRob3NlIGVsZW1lbnRzXG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoZXZlbnQuZWxlbWVudHMubWFwKGFzeW5jIGVsZW1lbnQgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5zZWFyY2hWaWV3LmdldENvbnRyb2woKS51cGRhdGVDaGlsZHJlbihlbGVtZW50KTtcblx0XHRcdFx0XHRcdHRoaXMuc2VhcmNoVmlldy5nZXRDb250cm9sKCkucmVyZW5kZXIoZWxlbWVudCk7XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuc2VhcmNoVmlldy5nZXRDb250cm9sKCkudXBkYXRlQ2hpbGRyZW4odW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsbUJBQW1CO0FBRTVCLFNBQWtELHNDQUFzQztBQUN4RixTQUFTLFNBQVMsa0JBQWtCLGlCQUFpQjtBQUNyRCxZQUFZLFlBQVk7QUFDeEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsWUFBWSx1QkFBb0M7QUFDekQsWUFBWSxTQUFTO0FBQ3JCLFlBQVksYUFBYTtBQUN6QixTQUFTLFdBQVc7QUFDcEIsWUFBWSxhQUFhO0FBQ3pCLE9BQU87QUFDUCxTQUFTLGVBQWUsY0FBYyxvQkFBb0I7QUFDMUQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxzQ0FBc0M7QUFDL0MsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYztBQUN2QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFvQyw2QkFBNkI7QUFDakUsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUF3QixzQkFBc0I7QUFDOUMsU0FBMkIsZ0JBQWdCLG9CQUFvQjtBQUMvRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQiwwQ0FBMEM7QUFDOUUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxnQkFBZ0IscUJBQXFCO0FBQzlDLFNBQW9CLHdCQUF1QztBQUMzRCxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtB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SyxvQkFBb0IsS0FBSyxPQUFLLEVBQUUsS0FBSztBQUFBLE1BQ2pELFNBQVMsS0FBSyxvQkFBb0IsS0FBSyxPQUFLLEVBQUUsT0FBTztBQUFBLE1BQ3JELGFBQWEsS0FBSyxvQkFBb0IsS0FBSyxPQUFLLEVBQUUsV0FBVztBQUFBLElBQzlEO0FBQ0EsU0FBSyxzQkFBc0IsQ0FBQztBQUM1QixXQUFPLEtBQUssWUFBWSxvQkFBb0I7QUFBQSxFQUM3QztBQUFBLEVBRUEsTUFBYyxvQkFBbUM7QUFDaEQsVUFBTSxRQUFRLEtBQUssV0FBVyxNQUFNLGFBQWEsUUFBUSxFQUFFLE9BQU8sT0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksT0FBSyxFQUFFLGdCQUFnQixLQUFLLFdBQVcsQ0FBQztBQUNoSSxVQUFNLFFBQVEsSUFBSSxLQUFLO0FBQUEsRUFDeEI7QUFBQSxFQUVBLE1BQWMsWUFBWSxPQUFxQztBQUM5RCxVQUFNLGVBQWUsS0FBSyxlQUFlO0FBQ3pDLFFBQUksQ0FBQyxTQUFTLE1BQU0sU0FBUyxNQUFNLFNBQVM7QUFFM0MsVUFBSSxhQUFhLGNBQWMsZ0JBQWdCLFVBQVU7QUFFeEQsY0FBTSxLQUFLLGtCQUFrQixFQUMzQixLQUFLLE1BQU0sS0FBSyxXQUFXLFdBQVcsRUFBRSxlQUFlLE1BQVMsQ0FBQztBQUFBLE1BQ3BFLE9BQU87QUFDTixjQUFNLEtBQUssV0FBVyxXQUFXLEVBQUUsZUFBZSxNQUFTO0FBQUEsTUFDNUQ7QUFBQSxJQUNELE9BQU87QUFFTixVQUFJLGFBQWEsY0FBYyxnQkFBZ0Isa0JBQzlDLGFBQWEsY0FBYyxnQkFBZ0IsaUJBQWlCO0FBRTVELGNBQU0sS0FBSyxXQUFXLFdBQVcsRUFBRSxlQUFlLE1BQVM7QUFBQSxNQUM1RCxPQUFPO0FBQ04sY0FBTSxxQkFBcUIsTUFBTSxTQUFTLE1BQU0sVUFBUSxLQUFLLFdBQVcsV0FBVyxFQUFFLFFBQVEsSUFBSSxDQUFDO0FBQ2xHLFlBQUksb0JBQW9CO0FBRXZCLGdCQUFNLFFBQVEsSUFBSSxNQUFNLFNBQVMsSUFBSSxPQUFNLFlBQVc7QUFDckQsa0JBQU0sS0FBSyxXQUFXLFdBQVcsRUFBRSxlQUFlLE9BQU87QUFDekQsaUJBQUssV0FBVyxXQUFXLEVBQUUsU0FBUyxPQUFPO0FBQUEsVUFDOUMsQ0FBQyxDQUFDO0FBQUEsUUFDSCxPQUFPO0FBQ04sZUFBSyxXQUFXLFdBQVcsRUFBRSxlQUFlLE1BQVM7QUFBQSxRQUN0RDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBckVNLHdCQUFOO0FBQUEsRUFPRztBQUFBLEdBUEc7IiwKICAibmFtZXMiOiBbIlNlYXJjaFZpZXdQb3NpdGlvbiJdCn0K
