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
import "./media/anythingQuickAccess.css";
import { quickPickItemScorerAccessor, QuickPickItemScorerAccessor, QuickInputHideReason, IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { prepareQuery, compareItemsByFuzzyScore, scoreItemFuzzy } from "../../../../base/common/fuzzyScorer.js";
import { QueryBuilder } from "../../../services/search/common/queryBuilder.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { getOutOfWorkspaceEditorResources, extractRangeFromFilter } from "../common/search.js";
import { ISearchService } from "../../../services/search/common/search.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { untildify } from "../../../../base/common/labels.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { URI } from "../../../../base/common/uri.js";
import { toLocalResource, dirname, basenameOrAuthority } from "../../../../base/common/resources.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { DisposableStore, toDisposable, MutableDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize } from "../../../../nls.js";
import { IWorkingCopyService } from "../../../services/workingCopy/common/workingCopyService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { EditorResourceAccessor, isEditorInput } from "../../../common/editor.js";
import { IEditorService, SIDE_GROUP, ACTIVE_GROUP } from "../../../services/editor/common/editorService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { ThrottledDelayer } from "../../../../base/common/async.js";
import { top } from "../../../../base/common/arrays.js";
import { FileQueryCacheState } from "../common/cacheState.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { Schemas } from "../../../../base/common/network.js";
import { IFilesConfigurationService } from "../../../services/filesConfiguration/common/filesConfigurationService.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { SymbolsQuickAccessProvider } from "./symbolsQuickAccess.js";
import { DefaultQuickAccessFilterValue, Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { PickerEditorState } from "../../../browser/quickaccess.js";
import { GotoSymbolQuickAccessProvider } from "../../codeEditor/browser/quickaccess/gotoSymbolQuickAccess.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { ScrollType } from "../../../../editor/common/editorCommon.js";
import { Event } from "../../../../base/common/event.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ASK_QUICK_QUESTION_ACTION_ID } from "../../chat/browser/actions/chatQuickInputActions.js";
import { IQuickChatService } from "../../chat/browser/chat.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ICustomEditorLabelService } from "../../../services/editor/common/customEditorLabelService.js";
function isEditorSymbolQuickPickItem(pick) {
  const candidate = pick;
  return !!candidate?.range && !!candidate.resource;
}
let AnythingQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(instantiationService, searchService, contextService, pathService, environmentService, fileService, labelService, modelService, languageService, workingCopyService, configurationService, editorService, historyService, filesConfigurationService, textModelService, uriIdentityService, quickInputService, keybindingService, quickChatService, logService, customEditorLabelService) {
    super(AnythingQuickAccessProvider.PREFIX, {
      canAcceptInBackground: true,
      noResultsPick: AnythingQuickAccessProvider.NO_RESULTS_PICK
    });
    this.instantiationService = instantiationService;
    this.searchService = searchService;
    this.contextService = contextService;
    this.pathService = pathService;
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.labelService = labelService;
    this.modelService = modelService;
    this.languageService = languageService;
    this.workingCopyService = workingCopyService;
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.historyService = historyService;
    this.filesConfigurationService = filesConfigurationService;
    this.textModelService = textModelService;
    this.uriIdentityService = uriIdentityService;
    this.quickInputService = quickInputService;
    this.keybindingService = keybindingService;
    this.quickChatService = quickChatService;
    this.logService = logService;
    this.customEditorLabelService = customEditorLabelService;
    // allow some time to merge fast and slow picks to reduce flickering
    this.pickState = this._register(new class extends Disposable {
      constructor(provider, instantiationService) {
        super();
        this.provider = provider;
        this.instantiationService = instantiationService;
        this.picker = void 0;
        this.editorViewState = this._register(this.instantiationService.createInstance(PickerEditorState));
        this.scorerCache = /* @__PURE__ */ Object.create(null);
        this.fileQueryCache = void 0;
        this.lastOriginalFilter = void 0;
        this.lastFilter = void 0;
        this.lastRange = void 0;
        this.lastGlobalPicks = void 0;
        this.isQuickNavigating = void 0;
      }
      set(picker) {
        this.picker = picker;
        Event.once(picker.onDispose)(() => {
          if (picker === this.picker) {
            this.picker = void 0;
          }
        });
        const isQuickNavigating = !!picker.quickNavigate;
        if (!isQuickNavigating) {
          this.fileQueryCache = this.provider.createFileQueryCache();
          this.scorerCache = /* @__PURE__ */ Object.create(null);
        }
        this.isQuickNavigating = isQuickNavigating;
        this.lastOriginalFilter = void 0;
        this.lastFilter = void 0;
        this.lastRange = void 0;
        this.lastGlobalPicks = void 0;
        this.editorViewState.reset();
      }
    }(this, this.instantiationService));
    //#region Editor History
    this.labelOnlyEditorHistoryPickAccessor = new QuickPickItemScorerAccessor({ skipDescription: true });
    //#endregion
    //#region File Search
    this.fileQueryDelayer = this._register(new ThrottledDelayer(AnythingQuickAccessProvider.TYPING_SEARCH_DELAY));
    this.fileQueryBuilder = this.instantiationService.createInstance(QueryBuilder);
    //#endregion
    //#region Command Center (if enabled)
    this.lazyRegistry = new Lazy(() => Registry.as(Extensions.Quickaccess));
    //#endregion
    //#region Workspace Symbols (if enabled)
    this.workspaceSymbolsQuickAccess = this._register(this.instantiationService.createInstance(SymbolsQuickAccessProvider));
    //#endregion
    //#region Editor Symbols (if narrowing down into a global pick via `@`)
    this.editorSymbolsQuickAccess = this.instantiationService.createInstance(GotoSymbolQuickAccessProvider);
  }
  get defaultFilterValue() {
    if (this.configuration.preserveInput) {
      return DefaultQuickAccessFilterValue.LAST;
    }
    return void 0;
  }
  get configuration() {
    const editorConfig = this.configurationService.getValue().workbench?.editor;
    const searchConfig = this.configurationService.getValue().search;
    const quickAccessConfig = this.configurationService.getValue().workbench.quickOpen;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      openSideBySideDirection: editorConfig?.openSideBySideDirection,
      includeSymbols: searchConfig?.quickOpen.includeSymbols,
      includeHistory: searchConfig?.quickOpen.includeHistory,
      historyFilterSortOrder: searchConfig?.quickOpen.history.filterSortOrder,
      preserveInput: quickAccessConfig.preserveInput
    };
  }
  provide(picker, token, runOptions) {
    const disposables = new DisposableStore();
    this.pickState.set(picker);
    const editorDecorationsDisposable = disposables.add(new MutableDisposable());
    disposables.add(picker.onDidChangeActive(() => {
      editorDecorationsDisposable.value = void 0;
      const [item] = picker.activeItems;
      if (isEditorSymbolQuickPickItem(item)) {
        editorDecorationsDisposable.value = this.decorateAndRevealSymbolRange(item);
      }
    }));
    disposables.add(Event.once(picker.onDidHide)(({ reason }) => {
      if (reason === QuickInputHideReason.Gesture) {
        this.pickState.editorViewState.restore();
      }
    }));
    disposables.add(super.provide(picker, token, runOptions));
    return disposables;
  }
  decorateAndRevealSymbolRange(pick) {
    const activeEditor = this.editorService.activeEditor;
    if (!this.uriIdentityService.extUri.isEqual(pick.resource, activeEditor?.resource)) {
      return Disposable.None;
    }
    const activeEditorControl = this.editorService.activeTextEditorControl;
    if (!activeEditorControl) {
      return Disposable.None;
    }
    this.pickState.editorViewState.set();
    activeEditorControl.revealRangeInCenter(pick.range.selection, ScrollType.Smooth);
    this.addDecorations(activeEditorControl, pick.range.decoration);
    return toDisposable(() => this.clearDecorations(activeEditorControl));
  }
  _getPicks(originalFilter, disposables, token, runOptions) {
    const filterWithRange = extractRangeFromFilter(originalFilter, [GotoSymbolQuickAccessProvider.PREFIX]);
    let filter;
    if (filterWithRange) {
      filter = filterWithRange.filter;
    } else {
      filter = originalFilter;
    }
    this.pickState.lastRange = filterWithRange?.range;
    if (originalFilter !== this.pickState.lastOriginalFilter && filter === this.pickState.lastFilter) {
      return null;
    }
    const lastWasFiltering = !!this.pickState.lastOriginalFilter;
    this.pickState.lastOriginalFilter = originalFilter;
    this.pickState.lastFilter = filter;
    const picks = this.pickState.picker?.items;
    const activePick = this.pickState.picker?.activeItems[0];
    if (picks && activePick) {
      const activePickIsEditorSymbol = isEditorSymbolQuickPickItem(activePick);
      const activePickIsNoResultsInEditorSymbols = activePick === AnythingQuickAccessProvider.NO_RESULTS_PICK && filter.indexOf(GotoSymbolQuickAccessProvider.PREFIX) >= 0;
      if (!activePickIsEditorSymbol && !activePickIsNoResultsInEditorSymbols) {
        this.pickState.lastGlobalPicks = {
          items: picks,
          active: activePick
        };
      }
    }
    return this.doGetPicks(
      filter,
      {
        ...runOptions,
        enableEditorSymbolSearch: lastWasFiltering
      },
      disposables,
      token
    );
  }
  doGetPicks(filter, options, disposables, token) {
    const query = prepareQuery(filter);
    if (options.enableEditorSymbolSearch) {
      const editorSymbolPicks = this.getEditorSymbolPicks(query, disposables, token);
      if (editorSymbolPicks) {
        return editorSymbolPicks;
      }
    }
    const activePick = this.pickState.picker?.activeItems[0];
    if (isEditorSymbolQuickPickItem(activePick) && this.pickState.lastGlobalPicks) {
      return this.pickState.lastGlobalPicks;
    }
    const historyEditorPicks = this.getEditorHistoryPicks(query);
    let picks = new Array();
    if (options.additionPicks) {
      for (const pick of options.additionPicks) {
        if (pick.type === "separator") {
          picks.push(pick);
          continue;
        }
        if (!query.original) {
          pick.highlights = void 0;
          picks.push(pick);
          continue;
        }
        const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(pick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
        if (!score) {
          continue;
        }
        pick.highlights = {
          label: labelMatch,
          description: descriptionMatch
        };
        picks.push(pick);
      }
    }
    if (this.pickState.isQuickNavigating) {
      if (picks.length > 0) {
        picks.push({ type: "separator", label: localize("recentlyOpenedSeparator", "recently opened") });
      }
      picks = historyEditorPicks;
    } else {
      if (options.includeHelp) {
        picks.push(...this.getHelpPicks(query, token, options));
      }
      if (historyEditorPicks.length !== 0) {
        picks.push({ type: "separator", label: localize("recentlyOpenedSeparator", "recently opened") });
        picks.push(...historyEditorPicks);
      }
    }
    return {
      // Fast picks: help (if included) & editor history
      picks: options.filter ? picks.filter((p) => options.filter?.(p)) : picks,
      // Slow picks: files and symbols
      additionalPicks: (async () => {
        const additionalPicksExcludes = new ResourceMap();
        for (const historyEditorPick of historyEditorPicks) {
          if (historyEditorPick.resource) {
            additionalPicksExcludes.set(historyEditorPick.resource, true);
          }
        }
        let additionalPicks = await this.getAdditionalPicks(query, additionalPicksExcludes, this.configuration.includeSymbols, token);
        if (options.filter) {
          additionalPicks = additionalPicks.filter((p) => options.filter?.(p));
        }
        if (token.isCancellationRequested) {
          return [];
        }
        return additionalPicks.length > 0 ? [
          { type: "separator", label: this.configuration.includeSymbols ? localize("fileAndSymbolResultsSeparator", "file and symbol results") : localize("fileResultsSeparator", "file results") },
          ...additionalPicks
        ] : [];
      })(),
      // allow some time to merge files and symbols to reduce flickering
      mergeDelay: AnythingQuickAccessProvider.SYMBOL_PICKS_MERGE_DELAY
    };
  }
  async getAdditionalPicks(query, excludes, includeSymbols, token) {
    const [filePicks, symbolPicks] = await Promise.all([
      this.getFilePicks(query, excludes, token),
      this.getWorkspaceSymbolPicks(query, includeSymbols, token)
    ]);
    if (token.isCancellationRequested) {
      return [];
    }
    const sortedAnythingPicks = top(
      [...filePicks, ...symbolPicks],
      (anyPickA, anyPickB) => compareItemsByFuzzyScore(anyPickA, anyPickB, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache),
      AnythingQuickAccessProvider.MAX_RESULTS
    );
    const filteredAnythingPicks = [];
    for (const anythingPick of sortedAnythingPicks) {
      if (anythingPick.highlights) {
        filteredAnythingPicks.push(anythingPick);
      } else {
        const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(anythingPick, query, true, quickPickItemScorerAccessor, this.pickState.scorerCache);
        if (!score) {
          continue;
        }
        anythingPick.highlights = {
          label: labelMatch,
          description: descriptionMatch
        };
        filteredAnythingPicks.push(anythingPick);
      }
    }
    return filteredAnythingPicks;
  }
  getEditorHistoryPicks(query) {
    const configuration = this.configuration;
    if (!query.normalized) {
      return this.historyService.getHistory().map((editor) => this.createAnythingPick(editor, configuration));
    }
    if (!this.configuration.includeHistory) {
      return [];
    }
    const editorHistoryScorerAccessor = query.containsPathSeparator ? quickPickItemScorerAccessor : this.labelOnlyEditorHistoryPickAccessor;
    const editorHistoryPicks = [];
    for (const editor of this.historyService.getHistory()) {
      const resource = editor.resource;
      if (!resource) {
        continue;
      }
      const editorHistoryPick = this.createAnythingPick(editor, configuration);
      const { score, labelMatch, descriptionMatch } = scoreItemFuzzy(editorHistoryPick, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache);
      if (!score) {
        continue;
      }
      editorHistoryPick.highlights = {
        label: labelMatch,
        description: descriptionMatch
      };
      editorHistoryPicks.push(editorHistoryPick);
    }
    if (this.configuration.historyFilterSortOrder === "recency") {
      return editorHistoryPicks;
    }
    return editorHistoryPicks.sort((editorA, editorB) => compareItemsByFuzzyScore(editorA, editorB, query, false, editorHistoryScorerAccessor, this.pickState.scorerCache));
  }
  createFileQueryCache() {
    return new FileQueryCacheState(
      (cacheKey) => this.fileQueryBuilder.file(this.contextService.getWorkspace().folders, this.getFileQueryOptions({ cacheKey })),
      (query) => this.searchService.fileSearch(query),
      (cacheKey) => this.searchService.clearCache(cacheKey),
      this.pickState.fileQueryCache
    ).load();
  }
  async getFilePicks(query, excludes, token) {
    if (!query.normalized) {
      return [];
    }
    const absolutePathResult = await this.getAbsolutePathFileResult(query, token);
    if (token.isCancellationRequested) {
      return [];
    }
    let fileMatches;
    if (absolutePathResult) {
      if (excludes.has(absolutePathResult)) {
        return [];
      }
      const absolutePathPick = this.createAnythingPick(absolutePathResult, this.configuration);
      absolutePathPick.highlights = {
        label: [{ start: 0, end: absolutePathPick.label.length }],
        description: absolutePathPick.description ? [{ start: 0, end: absolutePathPick.description.length }] : void 0
      };
      return [absolutePathPick];
    }
    if (this.pickState.fileQueryCache?.isLoaded) {
      fileMatches = await this.doFileSearch(query, token);
    } else {
      fileMatches = await this.fileQueryDelayer.trigger(async () => {
        if (token.isCancellationRequested) {
          return [];
        }
        return this.doFileSearch(query, token);
      });
    }
    if (token.isCancellationRequested) {
      return [];
    }
    const configuration = this.configuration;
    return fileMatches.filter((resource) => !excludes.has(resource)).map((resource) => this.createAnythingPick(resource, configuration));
  }
  async doFileSearch(query, token) {
    const [fileSearchResults, relativePathFileResults] = await Promise.all([
      // File search: this is a search over all files of the workspace using the provided pattern
      this.getFileSearchResults(query, token),
      // Relative path search: we also want to consider results that match files inside the workspace
      // by looking for relative paths that the user typed as query. This allows to return even excluded
      // results into the picker if found (e.g. helps for opening compilation results that are otherwise
      // excluded)
      this.getRelativePathFileResults(query, token)
    ]);
    if (token.isCancellationRequested) {
      return [];
    }
    if (!relativePathFileResults) {
      return fileSearchResults;
    }
    const relativePathFileResultsMap = new ResourceMap();
    for (const relativePathFileResult of relativePathFileResults) {
      relativePathFileResultsMap.set(relativePathFileResult, true);
    }
    return [
      ...fileSearchResults.filter((result) => !relativePathFileResultsMap.has(result)),
      ...relativePathFileResults
    ];
  }
  async getFileSearchResults(query, token) {
    let filePattern = "";
    if (query.values && query.values.length > 1) {
      filePattern = query.values[0].original;
    } else {
      filePattern = query.original;
    }
    const fileSearchResults = await this.doGetFileSearchResults(filePattern, token);
    if (token.isCancellationRequested) {
      return [];
    }
    if (fileSearchResults.limitHit && query.values && query.values.length > 1) {
      const additionalFileSearchResults = await this.doGetFileSearchResults(query.original, token);
      if (token.isCancellationRequested) {
        return [];
      }
      const existingFileSearchResultsMap = new ResourceMap();
      for (const fileSearchResult of fileSearchResults.results) {
        existingFileSearchResultsMap.set(fileSearchResult.resource, true);
      }
      for (const additionalFileSearchResult of additionalFileSearchResults.results) {
        if (!existingFileSearchResultsMap.has(additionalFileSearchResult.resource)) {
          fileSearchResults.results.push(additionalFileSearchResult);
        }
      }
    }
    return fileSearchResults.results.map((result) => result.resource);
  }
  doGetFileSearchResults(filePattern, token) {
    const start = Date.now();
    return this.searchService.fileSearch(
      this.fileQueryBuilder.file(
        this.contextService.getWorkspace().folders,
        this.getFileQueryOptions({
          filePattern,
          cacheKey: this.pickState.fileQueryCache?.cacheKey,
          maxResults: AnythingQuickAccessProvider.MAX_RESULTS
        })
      ),
      token
    ).finally(() => {
      this.logService.trace(`QuickAccess fileSearch ${Date.now() - start}ms`);
    });
  }
  getFileQueryOptions(input) {
    return {
      _reason: "openFileHandler",
      // used for telemetry - do not change
      extraFileResources: this.instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
      filePattern: input.filePattern || "",
      cacheKey: input.cacheKey,
      maxResults: input.maxResults || 0,
      sortByScore: true
    };
  }
  async getAbsolutePathFileResult(query, token) {
    if (!query.containsPathSeparator) {
      return;
    }
    const userHome = await this.pathService.userHome();
    const detildifiedQuery = untildify(query.original, userHome.scheme === Schemas.file ? userHome.fsPath : userHome.path);
    if (token.isCancellationRequested) {
      return;
    }
    const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(detildifiedQuery);
    if (token.isCancellationRequested) {
      return;
    }
    if (isAbsolutePathQuery) {
      const resource = toLocalResource(
        await this.pathService.fileURI(detildifiedQuery),
        this.environmentService.remoteAuthority,
        this.pathService.defaultUriScheme
      );
      if (token.isCancellationRequested) {
        return;
      }
      try {
        if ((await this.fileService.stat(resource)).isFile) {
          return resource;
        }
      } catch (error) {
      }
    }
    return;
  }
  async getRelativePathFileResults(query, token) {
    if (!query.containsPathSeparator) {
      return;
    }
    const isAbsolutePathQuery = (await this.pathService.path).isAbsolute(query.original);
    if (!isAbsolutePathQuery) {
      const resources = [];
      for (const folder of this.contextService.getWorkspace().folders) {
        if (token.isCancellationRequested) {
          break;
        }
        const resource = toLocalResource(
          folder.toResource(query.original),
          this.environmentService.remoteAuthority,
          this.pathService.defaultUriScheme
        );
        try {
          if ((await this.fileService.stat(resource)).isFile) {
            resources.push(resource);
          }
        } catch (error) {
        }
      }
      return resources;
    }
    return;
  }
  getHelpPicks(query, token, runOptions) {
    if (query.normalized) {
      return [];
    }
    const providers = this.lazyRegistry.value.getQuickAccessProviders().filter((p) => p.helpEntries.some((h) => h.commandCenterOrder !== void 0)).flatMap((provider) => provider.helpEntries.filter((h) => h.commandCenterOrder !== void 0).map((helpEntry) => {
      const providerSpecificOptions = {
        ...runOptions,
        includeHelp: provider.prefix === AnythingQuickAccessProvider.PREFIX ? false : runOptions?.includeHelp
      };
      const label = helpEntry.commandCenterLabel ?? helpEntry.description;
      return {
        label,
        description: helpEntry.prefix ?? provider.prefix,
        commandCenterOrder: helpEntry.commandCenterOrder,
        keybinding: helpEntry.commandId ? this.keybindingService.lookupKeybinding(helpEntry.commandId) : void 0,
        ariaLabel: localize("helpPickAriaLabel", "{0}, {1}", label, helpEntry.description),
        accept: () => {
          this.quickInputService.quickAccess.show(provider.prefix, {
            preserveValue: true,
            providerOptions: providerSpecificOptions
          });
        }
      };
    }));
    if (this.quickChatService.enabled) {
      providers.push({
        label: localize("chat", "Open Quick Chat"),
        commandCenterOrder: 30,
        keybinding: this.keybindingService.lookupKeybinding(ASK_QUICK_QUESTION_ACTION_ID),
        accept: () => this.quickChatService.toggle()
      });
    }
    return providers.sort((a, b) => a.commandCenterOrder - b.commandCenterOrder);
  }
  async getWorkspaceSymbolPicks(query, includeSymbols, token) {
    if (!query.normalized || // we need a value for search for
    !includeSymbols || // we need to enable symbols in search
    this.pickState.lastRange) {
      return [];
    }
    return this.workspaceSymbolsQuickAccess.getSymbolPicks(query.original, {
      skipLocal: true,
      skipSorting: true,
      delay: AnythingQuickAccessProvider.TYPING_SEARCH_DELAY
    }, token);
  }
  getEditorSymbolPicks(query, disposables, token) {
    const filterSegments = query.original.split(GotoSymbolQuickAccessProvider.PREFIX);
    const filter = filterSegments.length > 1 ? filterSegments[filterSegments.length - 1].trim() : void 0;
    if (typeof filter !== "string") {
      return null;
    }
    const activeGlobalPick = this.pickState.lastGlobalPicks?.active;
    if (!activeGlobalPick) {
      return null;
    }
    const activeGlobalResource = activeGlobalPick.resource;
    if (!activeGlobalResource || !this.fileService.hasProvider(activeGlobalResource) && activeGlobalResource.scheme !== Schemas.untitled) {
      return null;
    }
    if (activeGlobalPick.label.includes(GotoSymbolQuickAccessProvider.PREFIX) || activeGlobalPick.description?.includes(GotoSymbolQuickAccessProvider.PREFIX)) {
      if (filterSegments.length < 3) {
        return null;
      }
    }
    return this.doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token);
  }
  async doGetEditorSymbolPicks(activeGlobalPick, activeGlobalResource, filter, disposables, token) {
    try {
      this.pickState.editorViewState.set();
      await this.pickState.editorViewState.openTransientEditor({
        resource: activeGlobalResource,
        options: { preserveFocus: true, revealIfOpened: true, ignoreError: true }
      });
    } catch (error) {
      return [];
    }
    if (token.isCancellationRequested) {
      return [];
    }
    let model = this.modelService.getModel(activeGlobalResource);
    if (!model) {
      try {
        const modelReference = disposables.add(await this.textModelService.createModelReference(activeGlobalResource));
        if (token.isCancellationRequested) {
          return [];
        }
        model = modelReference.object.textEditorModel;
      } catch (error) {
        return [];
      }
    }
    const editorSymbolPicks = await this.editorSymbolsQuickAccess.getSymbolPicks(model, filter, { extraContainerLabel: stripIcons(activeGlobalPick.label) }, disposables, token);
    if (token.isCancellationRequested) {
      return [];
    }
    return editorSymbolPicks.map((editorSymbolPick) => {
      if (editorSymbolPick.type === "separator") {
        return editorSymbolPick;
      }
      return {
        ...editorSymbolPick,
        resource: activeGlobalResource,
        description: editorSymbolPick.description,
        trigger: (buttonIndex, keyMods) => {
          this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, forceOpenSideBySide: true });
          return TriggerAction.CLOSE_PICKER;
        },
        accept: (keyMods, event) => this.openAnything(activeGlobalResource, { keyMods, range: editorSymbolPick.range?.selection, preserveFocus: event.inBackground, forcePinned: event.inBackground })
      };
    });
  }
  addDecorations(editor, range) {
    this.editorSymbolsQuickAccess.addDecorations(editor, range);
  }
  clearDecorations(editor) {
    this.editorSymbolsQuickAccess.clearDecorations(editor);
  }
  //#endregion
  //#region Helpers
  createAnythingPick(resourceOrEditor, configuration) {
    const isEditorHistoryEntry = !URI.isUri(resourceOrEditor);
    let resource;
    let label;
    let description = void 0;
    let isDirty = void 0;
    let extraClasses;
    let icon = void 0;
    if (isEditorInput(resourceOrEditor)) {
      resource = EditorResourceAccessor.getOriginalUri(resourceOrEditor);
      label = resourceOrEditor.getName();
      description = resourceOrEditor.getDescription();
      isDirty = resourceOrEditor.isDirty() && !resourceOrEditor.isSaving();
      extraClasses = resourceOrEditor.getLabelExtraClasses();
      icon = resourceOrEditor.getIcon();
    } else {
      resource = URI.isUri(resourceOrEditor) ? resourceOrEditor : resourceOrEditor.resource;
      const customLabel = this.customEditorLabelService.getName(resource);
      label = customLabel || basenameOrAuthority(resource);
      description = this.labelService.getUriLabel(!!customLabel ? resource : dirname(resource), { relative: true });
      isDirty = this.workingCopyService.isDirty(resource) && !this.filesConfigurationService.hasShortAutoSaveDelay(resource);
      extraClasses = [];
    }
    const labelAndDescription = description ? `${label} ${description}` : label;
    const iconClassesValue = new Lazy(() => getIconClasses(this.modelService, this.languageService, resource, void 0, icon).concat(extraClasses));
    const buttonsValue = new Lazy(() => {
      const openSideBySideDirection = configuration.openSideBySideDirection;
      const buttons = [];
      buttons.push({
        iconClass: openSideBySideDirection === "right" ? ThemeIcon.asClassName(Codicon.splitHorizontal) : ThemeIcon.asClassName(Codicon.splitVertical),
        tooltip: openSideBySideDirection === "right" ? localize({ key: "openToSide", comment: ["Open this file in a split editor on the left/right side"] }, "Open to the Side") : localize({ key: "openToBottom", comment: ["Open this file in a split editor on the bottom"] }, "Open to the Bottom")
      });
      if (isEditorHistoryEntry) {
        buttons.push({
          iconClass: isDirty ? "dirty-anything " + ThemeIcon.asClassName(Codicon.circleFilled) : ThemeIcon.asClassName(Codicon.close),
          tooltip: localize("closeEditor", "Remove from Recently Opened"),
          alwaysVisible: isDirty
        });
      }
      return buttons;
    });
    return {
      resource,
      label,
      ariaLabel: isDirty ? localize("filePickAriaLabelDirty", "{0} unsaved changes", labelAndDescription) : labelAndDescription,
      description,
      get iconClasses() {
        return iconClassesValue.value;
      },
      get buttons() {
        return buttonsValue.value;
      },
      trigger: (buttonIndex, keyMods) => {
        switch (buttonIndex) {
          // Open to side / below
          case 0:
            this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, forceOpenSideBySide: true });
            return TriggerAction.CLOSE_PICKER;
          // Remove from History
          case 1:
            if (!URI.isUri(resourceOrEditor)) {
              this.historyService.removeFromHistory(resourceOrEditor);
              return TriggerAction.REMOVE_ITEM;
            }
        }
        return TriggerAction.NO_ACTION;
      },
      accept: (keyMods, event) => this.openAnything(resourceOrEditor, { keyMods, range: this.pickState.lastRange, preserveFocus: event.inBackground, forcePinned: event.inBackground })
    };
  }
  async openAnything(resourceOrEditor, options) {
    const editorOptions = {
      preserveFocus: options.preserveFocus,
      pinned: options.keyMods?.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
      selection: options.range ? Range.collapseToStart(options.range) : void 0
    };
    const targetGroup = options.keyMods?.alt || this.configuration.openEditorPinned && options.keyMods?.ctrlCmd || options.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    if (targetGroup === SIDE_GROUP) {
      await this.pickState.editorViewState.restore();
    }
    if (isEditorInput(resourceOrEditor)) {
      await this.editorService.openEditor(resourceOrEditor, editorOptions, targetGroup);
    } else {
      let resourceEditorInput;
      if (URI.isUri(resourceOrEditor)) {
        resourceEditorInput = {
          resource: resourceOrEditor,
          options: editorOptions
        };
      } else {
        resourceEditorInput = {
          ...resourceOrEditor,
          options: {
            ...resourceOrEditor.options,
            ...editorOptions
          }
        };
      }
      await this.editorService.openEditor(resourceEditorInput, targetGroup);
    }
  }
  //#endregion
};
AnythingQuickAccessProvider.PREFIX = "";
AnythingQuickAccessProvider.NO_RESULTS_PICK = {
  label: localize("noAnythingResults", "No matching results")
};
AnythingQuickAccessProvider.MAX_RESULTS = 512;
AnythingQuickAccessProvider.TYPING_SEARCH_DELAY = 200;
// this delay accommodates for the user typing a word and then stops typing to start searching
AnythingQuickAccessProvider.SYMBOL_PICKS_MERGE_DELAY = 200;
AnythingQuickAccessProvider = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, ISearchService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IPathService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, ILabelService),
  __decorateParam(7, IModelService),
  __decorateParam(8, ILanguageService),
  __decorateParam(9, IWorkingCopyService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, IHistoryService),
  __decorateParam(13, IFilesConfigurationService),
  __decorateParam(14, ITextModelService),
  __decorateParam(15, IUriIdentityService),
  __decorateParam(16, IQuickInputService),
  __decorateParam(17, IKeybindingService),
  __decorateParam(18, IQuickChatService),
  __decorateParam(19, ILogService),
  __decorateParam(20, ICustomEditorLabelService)
], AnythingQuickAccessProvider);
export {
  AnythingQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9hbnl0aGluZ1F1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL2FueXRoaW5nUXVpY2tBY2Nlc3MuY3NzJztcbmltcG9ydCB7IElRdWlja0lucHV0QnV0dG9uLCBJS2V5TW9kcywgcXVpY2tQaWNrSXRlbVNjb3JlckFjY2Vzc29yLCBRdWlja1BpY2tJdGVtU2NvcmVyQWNjZXNzb3IsIElRdWlja1BpY2ssIElRdWlja1BpY2tJdGVtV2l0aFJlc291cmNlLCBRdWlja0lucHV0SGlkZVJlYXNvbiwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyLCBUcmlnZ2VyQWN0aW9uLCBGYXN0QW5kU2xvd1BpY2tzLCBQaWNrcywgUGlja3NXaXRoQWN0aXZlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9icm93c2VyL3BpY2tlclF1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IHByZXBhcmVRdWVyeSwgSVByZXBhcmVkUXVlcnksIGNvbXBhcmVJdGVtc0J5RnV6enlTY29yZSwgc2NvcmVJdGVtRnV6enksIEZ1enp5U2NvcmVyQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9mdXp6eVNjb3Jlci5qcyc7XG5pbXBvcnQgeyBJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnMsIFF1ZXJ5QnVpbGRlciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vcXVlcnlCdWlsZGVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0T3V0T2ZXb3Jrc3BhY2VFZGl0b3JSZXNvdXJjZXMsIGV4dHJhY3RSYW5nZUZyb21GaWx0ZXIsIElXb3JrYmVuY2hTZWFyY2hDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoU2VydmljZSwgSVNlYXJjaENvbXBsZXRlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgdW50aWxkaWZ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGFiZWxzLmpzJztcbmltcG9ydCB7IElQYXRoU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhdGgvY29tbW9uL3BhdGhTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyB0b0xvY2FsUmVzb3VyY2UsIGRpcm5hbWUsIGJhc2VuYW1lT3JBdXRob3JpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBnZXRJY29uQ2xhc3NlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZ2V0SWNvbkNsYXNzZXMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVkaXRvckNvbmZpZ3VyYXRpb24sIEVkaXRvclJlc291cmNlQWNjZXNzb3IsIGlzRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCwgQUNUSVZFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJhbmdlLCBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVGhyb3R0bGVkRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IHRvcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBGaWxlUXVlcnlDYWNoZVN0YXRlIH0gZnJvbSAnLi4vY29tbW9uL2NhY2hlU3RhdGUuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCwgSVRleHRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgU3ltYm9sc1F1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuL3N5bWJvbHNRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zLCBEZWZhdWx0UXVpY2tBY2Nlc3NGaWx0ZXJWYWx1ZSwgRXh0ZW5zaW9ucywgSVF1aWNrQWNjZXNzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBQaWNrZXJFZGl0b3JTdGF0ZSwgSVdvcmtiZW5jaFF1aWNrQWNjZXNzQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcXVpY2thY2Nlc3MuanMnO1xuaW1wb3J0IHsgR290b1N5bWJvbFF1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9jb2RlRWRpdG9yL2Jyb3dzZXIvcXVpY2thY2Nlc3MvZ290b1N5bWJvbFF1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2Nyb2xsVHlwZSwgSUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IHN0cmlwSWNvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQVNLX1FVSUNLX1FVRVNUSU9OX0FDVElPTl9JRCB9IGZyb20gJy4uLy4uL2NoYXQvYnJvd3Nlci9hY3Rpb25zL2NoYXRRdWlja0lucHV0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tDaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2NoYXQvYnJvd3Nlci9jaGF0LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vY3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlLmpzJztcblxuaW50ZXJmYWNlIElBbnl0aGluZ1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBJUXVpY2tQaWNrSXRlbVdpdGhSZXNvdXJjZSB7IH1cblxuaW50ZXJmYWNlIElFZGl0b3JTeW1ib2xBbnl0aGluZ1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJQW55dGhpbmdRdWlja1BpY2tJdGVtIHtcblx0cmVzb3VyY2U6IFVSSTtcblx0cmFuZ2U6IHsgZGVjb3JhdGlvbjogSVJhbmdlOyBzZWxlY3Rpb246IElSYW5nZSB9O1xufVxuXG5mdW5jdGlvbiBpc0VkaXRvclN5bWJvbFF1aWNrUGlja0l0ZW0ocGljaz86IElBbnl0aGluZ1F1aWNrUGlja0l0ZW0pOiBwaWNrIGlzIElFZGl0b3JTeW1ib2xBbnl0aGluZ1F1aWNrUGlja0l0ZW0ge1xuXHRjb25zdCBjYW5kaWRhdGUgPSBwaWNrIGFzIElFZGl0b3JTeW1ib2xBbnl0aGluZ1F1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0cmV0dXJuICEhY2FuZGlkYXRlPy5yYW5nZSAmJiAhIWNhbmRpZGF0ZS5yZXNvdXJjZTtcbn1cblxuZXhwb3J0IGNsYXNzIEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlciBleHRlbmRzIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXI8SUFueXRoaW5nUXVpY2tQaWNrSXRlbT4ge1xuXG5cdHN0YXRpYyBQUkVGSVggPSAnJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBOT19SRVNVTFRTX1BJQ0s6IElBbnl0aGluZ1F1aWNrUGlja0l0ZW0gPSB7XG5cdFx0bGFiZWw6IGxvY2FsaXplKCdub0FueXRoaW5nUmVzdWx0cycsIFwiTm8gbWF0Y2hpbmcgcmVzdWx0c1wiKVxuXHR9O1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BWF9SRVNVTFRTID0gNTEyO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFRZUElOR19TRUFSQ0hfREVMQVkgPSAyMDA7IC8vIHRoaXMgZGVsYXkgYWNjb21tb2RhdGVzIGZvciB0aGUgdXNlciB0eXBpbmcgYSB3b3JkIGFuZCB0aGVuIHN0b3BzIHR5cGluZyB0byBzdGFydCBzZWFyY2hpbmdcblxuXHRwcml2YXRlIHN0YXRpYyBTWU1CT0xfUElDS1NfTUVSR0VfREVMQVkgPSAyMDA7IC8vIGFsbG93IHNvbWUgdGltZSB0byBtZXJnZSBmYXN0IGFuZCBzbG93IHBpY2tzIHRvIHJlZHVjZSBmbGlja2VyaW5nXG5cblx0cHJpdmF0ZSByZWFkb25seSBwaWNrU3RhdGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgY2xhc3MgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRcdHBpY2tlcjogSVF1aWNrUGljazxJQW55dGhpbmdRdWlja1BpY2tJdGVtLCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRlZGl0b3JWaWV3U3RhdGUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBpY2tlckVkaXRvclN0YXRlKSk7XG5cblx0XHRzY29yZXJDYWNoZTogRnV6enlTY29yZXJDYWNoZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0ZmlsZVF1ZXJ5Q2FjaGU6IEZpbGVRdWVyeUNhY2hlU3RhdGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRsYXN0T3JpZ2luYWxGaWx0ZXI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRsYXN0RmlsdGVyOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGFzdFJhbmdlOiBJUmFuZ2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRsYXN0R2xvYmFsUGlja3M6IFBpY2tzV2l0aEFjdGl2ZTxJQW55dGhpbmdRdWlja1BpY2tJdGVtPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGlzUXVpY2tOYXZpZ2F0aW5nOiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRwcml2YXRlIHJlYWRvbmx5IHByb3ZpZGVyOiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXIsXG5cdFx0XHRwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0XHQpIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0fVxuXG5cdFx0c2V0KHBpY2tlcjogSVF1aWNrUGljazxJQW55dGhpbmdRdWlja1BpY2tJdGVtLCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT4pOiB2b2lkIHtcblxuXHRcdFx0Ly8gUGlja2VyIGZvciB0aGlzIHJ1blxuXHRcdFx0dGhpcy5waWNrZXIgPSBwaWNrZXI7XG5cdFx0XHRFdmVudC5vbmNlKHBpY2tlci5vbkRpc3Bvc2UpKCgpID0+IHtcblx0XHRcdFx0aWYgKHBpY2tlciA9PT0gdGhpcy5waWNrZXIpIHtcblx0XHRcdFx0XHR0aGlzLnBpY2tlciA9IHVuZGVmaW5lZDsgLy8gY2xlYXIgdGhlIHBpY2tlciB3aGVuIGRpc3Bvc2VkIHRvIG5vdCBrZWVwIGl0IGluIG1lbW9yeSBmb3IgdG9vIGxvbmdcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIENhY2hlc1xuXHRcdFx0Y29uc3QgaXNRdWlja05hdmlnYXRpbmcgPSAhIXBpY2tlci5xdWlja05hdmlnYXRlO1xuXHRcdFx0aWYgKCFpc1F1aWNrTmF2aWdhdGluZykge1xuXHRcdFx0XHR0aGlzLmZpbGVRdWVyeUNhY2hlID0gdGhpcy5wcm92aWRlci5jcmVhdGVGaWxlUXVlcnlDYWNoZSgpO1xuXHRcdFx0XHR0aGlzLnNjb3JlckNhY2hlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJcblx0XHRcdHRoaXMuaXNRdWlja05hdmlnYXRpbmcgPSBpc1F1aWNrTmF2aWdhdGluZztcblx0XHRcdHRoaXMubGFzdE9yaWdpbmFsRmlsdGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5sYXN0RmlsdGVyID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5sYXN0UmFuZ2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLmxhc3RHbG9iYWxQaWNrcyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuZWRpdG9yVmlld1N0YXRlLnJlc2V0KCk7XG5cdFx0fVxuXHR9KHRoaXMsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpKTtcblxuXHRnZXQgZGVmYXVsdEZpbHRlclZhbHVlKCk6IERlZmF1bHRRdWlja0FjY2Vzc0ZpbHRlclZhbHVlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uLnByZXNlcnZlSW5wdXQpIHtcblx0XHRcdHJldHVybiBEZWZhdWx0UXVpY2tBY2Nlc3NGaWx0ZXJWYWx1ZS5MQVNUO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVNlYXJjaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzZWFyY2hTZXJ2aWNlOiBJU2VhcmNoU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtpbmdDb3B5U2VydmljZTogSVdvcmtpbmdDb3B5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUhpc3RvcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaGlzdG9yeVNlcnZpY2U6IElIaXN0b3J5U2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVF1aWNrQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0NoYXRTZXJ2aWNlOiBJUXVpY2tDaGF0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUN1c3RvbUVkaXRvckxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGN1c3RvbUVkaXRvckxhYmVsU2VydmljZTogSUN1c3RvbUVkaXRvckxhYmVsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLCB7XG5cdFx0XHRjYW5BY2NlcHRJbkJhY2tncm91bmQ6IHRydWUsXG5cdFx0XHRub1Jlc3VsdHNQaWNrOiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXIuTk9fUkVTVUxUU19QSUNLXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBjb25maWd1cmF0aW9uKCkge1xuXHRcdGNvbnN0IGVkaXRvckNvbmZpZyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVdvcmtiZW5jaEVkaXRvckNvbmZpZ3VyYXRpb24+KCkud29ya2JlbmNoPy5lZGl0b3I7XG5cdFx0Y29uc3Qgc2VhcmNoQ29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJV29ya2JlbmNoU2VhcmNoQ29uZmlndXJhdGlvbj4oKS5zZWFyY2g7XG5cdFx0Y29uc3QgcXVpY2tBY2Nlc3NDb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXb3JrYmVuY2hRdWlja0FjY2Vzc0NvbmZpZ3VyYXRpb24+KCkud29ya2JlbmNoLnF1aWNrT3BlbjtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVuRWRpdG9yUGlubmVkOiAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3RnJvbVF1aWNrT3BlbiB8fCAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3LFxuXHRcdFx0b3BlblNpZGVCeVNpZGVEaXJlY3Rpb246IGVkaXRvckNvbmZpZz8ub3BlblNpZGVCeVNpZGVEaXJlY3Rpb24sXG5cdFx0XHRpbmNsdWRlU3ltYm9sczogc2VhcmNoQ29uZmlnPy5xdWlja09wZW4uaW5jbHVkZVN5bWJvbHMsXG5cdFx0XHRpbmNsdWRlSGlzdG9yeTogc2VhcmNoQ29uZmlnPy5xdWlja09wZW4uaW5jbHVkZUhpc3RvcnksXG5cdFx0XHRoaXN0b3J5RmlsdGVyU29ydE9yZGVyOiBzZWFyY2hDb25maWc/LnF1aWNrT3Blbi5oaXN0b3J5LmZpbHRlclNvcnRPcmRlcixcblx0XHRcdHByZXNlcnZlSW5wdXQ6IHF1aWNrQWNjZXNzQ29uZmlnLnByZXNlcnZlSW5wdXRcblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgcHJvdmlkZShwaWNrZXI6IElRdWlja1BpY2s8SUFueXRoaW5nUXVpY2tQaWNrSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHJ1bk9wdGlvbnM/OiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Ly8gVXBkYXRlIHRoZSBwaWNrIHN0YXRlIGZvciB0aGlzIHJ1blxuXHRcdHRoaXMucGlja1N0YXRlLnNldChwaWNrZXIpO1xuXG5cdFx0Ly8gQWRkIGVkaXRvciBkZWNvcmF0aW9ucyBmb3IgYWN0aXZlIGVkaXRvciBzeW1ib2wgcGlja3Ncblx0XHRjb25zdCBlZGl0b3JEZWNvcmF0aW9uc0Rpc3Bvc2FibGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRDaGFuZ2VBY3RpdmUoKCkgPT4ge1xuXG5cdFx0XHQvLyBDbGVhciBvbGQgZGVjb3JhdGlvbnNcblx0XHRcdGVkaXRvckRlY29yYXRpb25zRGlzcG9zYWJsZS52YWx1ZSA9IHVuZGVmaW5lZDtcblxuXHRcdFx0Ly8gQWRkIG5ldyBkZWNvcmF0aW9uIGlmIGVkaXRvciBzeW1ib2wgaXMgYWN0aXZlXG5cdFx0XHRjb25zdCBbaXRlbV0gPSBwaWNrZXIuYWN0aXZlSXRlbXM7XG5cdFx0XHRpZiAoaXNFZGl0b3JTeW1ib2xRdWlja1BpY2tJdGVtKGl0ZW0pKSB7XG5cdFx0XHRcdGVkaXRvckRlY29yYXRpb25zRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMuZGVjb3JhdGVBbmRSZXZlYWxTeW1ib2xSYW5nZShpdGVtKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBSZXN0b3JlIHZpZXcgc3RhdGUgdXBvbiBjYW5jZWxsYXRpb24gaWYgd2UgY2hhbmdlZCBpdFxuXHRcdC8vIGJ1dCBvbmx5IHdoZW4gdGhlIHBpY2tlciB3YXMgY2xvc2VkIHZpYSBleHBsaWNpdCB1c2VyXG5cdFx0Ly8gZ2VzdHVyZSBhbmQgbm90IGUuZy4gd2hlbiBmb2N1cyB3YXMgbG9zdCBiZWNhdXNlIHRoYXRcblx0XHQvLyBjb3VsZCBtZWFuIHRoZSB1c2VyIGNsaWNrZWQgaW50byB0aGUgZWRpdG9yIGRpcmVjdGx5LlxuXHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKHBpY2tlci5vbkRpZEhpZGUpKCh7IHJlYXNvbiB9KSA9PiB7XG5cdFx0XHRpZiAocmVhc29uID09PSBRdWlja0lucHV0SGlkZVJlYXNvbi5HZXN0dXJlKSB7XG5cdFx0XHRcdHRoaXMucGlja1N0YXRlLmVkaXRvclZpZXdTdGF0ZS5yZXN0b3JlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gU3RhcnQgcGlja2VyXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHN1cGVyLnByb3ZpZGUocGlja2VyLCB0b2tlbiwgcnVuT3B0aW9ucykpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBkZWNvcmF0ZUFuZFJldmVhbFN5bWJvbFJhbmdlKHBpY2s6IElFZGl0b3JTeW1ib2xBbnl0aGluZ1F1aWNrUGlja0l0ZW0pOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHBpY2sucmVzb3VyY2UsIGFjdGl2ZUVkaXRvcj8ucmVzb3VyY2UpKSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lOyAvLyBhY3RpdmUgZWRpdG9yIG5lZWRzIHRvIGJlIGZvciByZXNvdXJjZVxuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNvbnRyb2wgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0aWYgKCFhY3RpdmVFZGl0b3JDb250cm9sKSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lOyAvLyB3ZSBuZWVkIGEgdGV4dCBlZGl0b3IgY29udHJvbCB0byBkZWNvcmF0ZSBhbmQgcmV2ZWFsXG5cdFx0fVxuXG5cdFx0Ly8gd2UgbXVzdCByZW1lbWJlciBvdXIgY3VycmV0IHZpZXcgc3RhdGUgdG8gYmUgYWJsZSB0byByZXN0b3JlXG5cdFx0dGhpcy5waWNrU3RhdGUuZWRpdG9yVmlld1N0YXRlLnNldCgpO1xuXG5cdFx0Ly8gUmV2ZWFsXG5cdFx0YWN0aXZlRWRpdG9yQ29udHJvbC5yZXZlYWxSYW5nZUluQ2VudGVyKHBpY2sucmFuZ2Uuc2VsZWN0aW9uLCBTY3JvbGxUeXBlLlNtb290aCk7XG5cblx0XHQvLyBEZWNvcmF0ZVxuXHRcdHRoaXMuYWRkRGVjb3JhdGlvbnMoYWN0aXZlRWRpdG9yQ29udHJvbCwgcGljay5yYW5nZS5kZWNvcmF0aW9uKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5jbGVhckRlY29yYXRpb25zKGFjdGl2ZUVkaXRvckNvbnRyb2wpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0UGlja3Mob3JpZ2luYWxGaWx0ZXI6IHN0cmluZywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBydW5PcHRpb25zPzogQW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyk6IFBpY2tzPElBbnl0aGluZ1F1aWNrUGlja0l0ZW0+IHwgUHJvbWlzZTxQaWNrczxJQW55dGhpbmdRdWlja1BpY2tJdGVtPj4gfCBGYXN0QW5kU2xvd1BpY2tzPElBbnl0aGluZ1F1aWNrUGlja0l0ZW0+IHwgbnVsbCB7XG5cblx0XHQvLyBGaW5kIGEgc3VpdGFibGUgcmFuZ2UgZnJvbSB0aGUgcGF0dGVybiBsb29raW5nIGZvciBcIjpcIiwgXCIjXCIgb3IgXCIsXCJcblx0XHQvLyB1bmxlc3Mgd2UgaGF2ZSB0aGUgYEBgIGVkaXRvciBzeW1ib2wgY2hhcmFjdGVyIGluc2lkZSB0aGUgZmlsdGVyXG5cdFx0Y29uc3QgZmlsdGVyV2l0aFJhbmdlID0gZXh0cmFjdFJhbmdlRnJvbUZpbHRlcihvcmlnaW5hbEZpbHRlciwgW0dvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWF0pO1xuXG5cdFx0Ly8gVXBkYXRlIGZpbHRlciB3aXRoIG5vcm1hbGl6ZWQgdmFsdWVzXG5cdFx0bGV0IGZpbHRlcjogc3RyaW5nO1xuXHRcdGlmIChmaWx0ZXJXaXRoUmFuZ2UpIHtcblx0XHRcdGZpbHRlciA9IGZpbHRlcldpdGhSYW5nZS5maWx0ZXI7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZpbHRlciA9IG9yaWdpbmFsRmlsdGVyO1xuXHRcdH1cblxuXHRcdC8vIFJlbWVtYmVyIGFzIGxhc3QgcmFuZ2Vcblx0XHR0aGlzLnBpY2tTdGF0ZS5sYXN0UmFuZ2UgPSBmaWx0ZXJXaXRoUmFuZ2U/LnJhbmdlO1xuXG5cdFx0Ly8gSWYgdGhlIG9yaWdpbmFsIGZpbHRlciB2YWx1ZSBoYXMgY2hhbmdlZCBidXQgdGhlIG5vcm1hbGl6ZWRcblx0XHQvLyBvbmUgaGFzIG5vdCwgd2UgcmV0dXJuIGVhcmx5IHdpdGggYSBgbnVsbGAgcmVzdWx0IGluZGljYXRpbmdcblx0XHQvLyB0aGF0IHRoZSByZXN1bHRzIHNob3VsZCBwcmVzZXJ2ZSBiZWNhdXNlIHRoZSByYW5nZSBpbmZvcm1hdGlvblxuXHRcdC8vICg6PGxpbmU+Ojxjb2x1bW4+KSBkb2VzIG5vdCBuZWVkIHRvIHRyaWdnZXIgYW55IHJlLXNvcnRpbmcuXG5cdFx0aWYgKG9yaWdpbmFsRmlsdGVyICE9PSB0aGlzLnBpY2tTdGF0ZS5sYXN0T3JpZ2luYWxGaWx0ZXIgJiYgZmlsdGVyID09PSB0aGlzLnBpY2tTdGF0ZS5sYXN0RmlsdGVyKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHQvLyBSZW1lbWJlciBhcyBsYXN0IGZpbHRlclxuXHRcdGNvbnN0IGxhc3RXYXNGaWx0ZXJpbmcgPSAhIXRoaXMucGlja1N0YXRlLmxhc3RPcmlnaW5hbEZpbHRlcjtcblx0XHR0aGlzLnBpY2tTdGF0ZS5sYXN0T3JpZ2luYWxGaWx0ZXIgPSBvcmlnaW5hbEZpbHRlcjtcblx0XHR0aGlzLnBpY2tTdGF0ZS5sYXN0RmlsdGVyID0gZmlsdGVyO1xuXG5cdFx0Ly8gUmVtZW1iZXIgb3VyIHBpY2sgc3RhdGUgYmVmb3JlIHJldHVybmluZyBuZXcgcGlja3Ncblx0XHQvLyB1bmxlc3Mgd2UgYXJlIGluc2lkZSBhbiBlZGl0b3Igc3ltYm9sIGZpbHRlciBvciByZXN1bHQuXG5cdFx0Ly8gV2UgY2FuIHVzZSB0aGlzIHN0YXRlIHRvIHJldHVybiBiYWNrIHRvIHRoZSBnbG9iYWwgcGlja1xuXHRcdC8vIHdoZW4gdGhlIHVzZXIgaXMgbmFycm93aW5nIGJhY2sgb3V0IG9mIGVkaXRvciBzeW1ib2xzLlxuXHRcdGNvbnN0IHBpY2tzID0gdGhpcy5waWNrU3RhdGUucGlja2VyPy5pdGVtcztcblx0XHRjb25zdCBhY3RpdmVQaWNrID0gdGhpcy5waWNrU3RhdGUucGlja2VyPy5hY3RpdmVJdGVtc1swXTtcblx0XHRpZiAocGlja3MgJiYgYWN0aXZlUGljaykge1xuXHRcdFx0Y29uc3QgYWN0aXZlUGlja0lzRWRpdG9yU3ltYm9sID0gaXNFZGl0b3JTeW1ib2xRdWlja1BpY2tJdGVtKGFjdGl2ZVBpY2spO1xuXHRcdFx0Y29uc3QgYWN0aXZlUGlja0lzTm9SZXN1bHRzSW5FZGl0b3JTeW1ib2xzID0gYWN0aXZlUGljayA9PT0gQW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyLk5PX1JFU1VMVFNfUElDSyAmJiBmaWx0ZXIuaW5kZXhPZihHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgpID49IDA7XG5cdFx0XHRpZiAoIWFjdGl2ZVBpY2tJc0VkaXRvclN5bWJvbCAmJiAhYWN0aXZlUGlja0lzTm9SZXN1bHRzSW5FZGl0b3JTeW1ib2xzKSB7XG5cdFx0XHRcdHRoaXMucGlja1N0YXRlLmxhc3RHbG9iYWxQaWNrcyA9IHtcblx0XHRcdFx0XHRpdGVtczogcGlja3MsXG5cdFx0XHRcdFx0YWN0aXZlOiBhY3RpdmVQaWNrXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gYGVuYWJsZUVkaXRvclN5bWJvbFNlYXJjaGA6IHRoaXMgd2lsbCBlbmFibGUgbG9jYWwgZWRpdG9yIHN5bWJvbFxuXHRcdC8vIHNlYXJjaCBpZiB0aGUgZmlsdGVyIHZhbHVlIGluY2x1ZGVzIGBAYCBjaGFyYWN0ZXIuIFdlIG9ubHkgd2FudFxuXHRcdC8vIHRvIGVuYWJsZSB0aGlzIHN1cHBvcnQgdGhvdWdoIGlmIHRoZSB1c2VyIHdhcyBmaWx0ZXJpbmcgaW4gdGhlXG5cdFx0Ly8gcGlja2VyIGJlY2F1c2UgdGhpcyBmZWF0dXJlIGRlcGVuZHMgb24gYW4gYWN0aXZlIGl0ZW0gaW4gdGhlIHJlc3VsdFxuXHRcdC8vIGxpc3QgdG8gZ2V0IHN5bWJvbHMgZnJvbS4gSWYgd2Ugd291bGQgc2ltcGx5IHRyaWdnZXIgZWRpdG9yIHN5bWJvbFxuXHRcdC8vIHNlYXJjaCB3aXRob3V0IHByaW9yIGZpbHRlcmluZywgeW91IGNvdWxkIG5vdCBwYXN0ZSBhIGZpbGUgbmFtZVxuXHRcdC8vIGluY2x1ZGluZyB0aGUgYEBgIGNoYXJhY3RlciB0byBvcGVuIGl0IChlLmcuIC9zb21lL2ZpbGVAcGF0aClcblx0XHQvLyByZWZzOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTM4NDVcblx0XHRyZXR1cm4gdGhpcy5kb0dldFBpY2tzKFxuXHRcdFx0ZmlsdGVyLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5ydW5PcHRpb25zLFxuXHRcdFx0XHRlbmFibGVFZGl0b3JTeW1ib2xTZWFyY2g6IGxhc3RXYXNGaWx0ZXJpbmdcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NhYmxlcyxcblx0XHRcdHRva2VuXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgZG9HZXRQaWNrcyhcblx0XHRmaWx0ZXI6IHN0cmluZyxcblx0XHRvcHRpb25zOiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zICYgeyBlbmFibGVFZGl0b3JTeW1ib2xTZWFyY2g6IGJvb2xlYW4gfSxcblx0XHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLFxuXHRcdHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlblxuXHQpOiBQaWNrczxJQW55dGhpbmdRdWlja1BpY2tJdGVtPiB8IFByb21pc2U8UGlja3M8SUFueXRoaW5nUXVpY2tQaWNrSXRlbT4+IHwgRmFzdEFuZFNsb3dQaWNrczxJQW55dGhpbmdRdWlja1BpY2tJdGVtPiB7XG5cdFx0Y29uc3QgcXVlcnkgPSBwcmVwYXJlUXVlcnkoZmlsdGVyKTtcblxuXHRcdC8vIFJldHVybiBlYXJseSBpZiB3ZSBoYXZlIGVkaXRvciBzeW1ib2wgcGlja3MuIFdlIHN1cHBvcnQgdGhpcyBieTpcblx0XHQvLyAtIGhhdmluZyBhIHByZXZpb3VzbHkgYWN0aXZlIGdsb2JhbCBwaWNrIChlLmcuIGEgZmlsZSlcblx0XHQvLyAtIHRoZSB1c2VyIHR5cGluZyBgQGAgdG8gc3RhcnQgdGhlIGxvY2FsIHN5bWJvbCBxdWVyeVxuXHRcdGlmIChvcHRpb25zLmVuYWJsZUVkaXRvclN5bWJvbFNlYXJjaCkge1xuXHRcdFx0Y29uc3QgZWRpdG9yU3ltYm9sUGlja3MgPSB0aGlzLmdldEVkaXRvclN5bWJvbFBpY2tzKHF1ZXJ5LCBkaXNwb3NhYmxlcywgdG9rZW4pO1xuXHRcdFx0aWYgKGVkaXRvclN5bWJvbFBpY2tzKSB7XG5cdFx0XHRcdHJldHVybiBlZGl0b3JTeW1ib2xQaWNrcztcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBoYXZlIGEga25vd24gbGFzdCBhY3RpdmUgZWRpdG9yIHN5bWJvbCBwaWNrLCB3ZSB0cnkgdG8gcmVzdG9yZVxuXHRcdC8vIHRoZSBsYXN0IGdsb2JhbCBwaWNrIHRvIHN1cHBvcnQgdGhlIGNhc2Ugb2YgbmFycm93aW5nIG91dCBmcm9tIGFcblx0XHQvLyBlZGl0b3Igc3ltYm9sIHNlYXJjaCBiYWNrIGludG8gdGhlIGdsb2JhbCBzZWFyY2hcblx0XHRjb25zdCBhY3RpdmVQaWNrID0gdGhpcy5waWNrU3RhdGUucGlja2VyPy5hY3RpdmVJdGVtc1swXTtcblx0XHRpZiAoaXNFZGl0b3JTeW1ib2xRdWlja1BpY2tJdGVtKGFjdGl2ZVBpY2spICYmIHRoaXMucGlja1N0YXRlLmxhc3RHbG9iYWxQaWNrcykge1xuXHRcdFx0cmV0dXJuIHRoaXMucGlja1N0YXRlLmxhc3RHbG9iYWxQaWNrcztcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgcmV0dXJuIG5vcm1hbGx5IHdpdGggaGlzdG9yeSBhbmQgZmlsZS9zeW1ib2wgcmVzdWx0c1xuXHRcdGNvbnN0IGhpc3RvcnlFZGl0b3JQaWNrcyA9IHRoaXMuZ2V0RWRpdG9ySGlzdG9yeVBpY2tzKHF1ZXJ5KTtcblxuXHRcdGxldCBwaWNrcyA9IG5ldyBBcnJheTxJQW55dGhpbmdRdWlja1BpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4oKTtcblx0XHRpZiAob3B0aW9ucy5hZGRpdGlvblBpY2tzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHBpY2sgb2Ygb3B0aW9ucy5hZGRpdGlvblBpY2tzKSB7XG5cdFx0XHRcdGlmIChwaWNrLnR5cGUgPT09ICdzZXBhcmF0b3InKSB7XG5cdFx0XHRcdFx0cGlja3MucHVzaChwaWNrKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXF1ZXJ5Lm9yaWdpbmFsKSB7XG5cdFx0XHRcdFx0cGljay5oaWdobGlnaHRzID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHBpY2tzLnB1c2gocGljayk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgeyBzY29yZSwgbGFiZWxNYXRjaCwgZGVzY3JpcHRpb25NYXRjaCB9ID0gc2NvcmVJdGVtRnV6enkocGljaywgcXVlcnksIHRydWUsIHF1aWNrUGlja0l0ZW1TY29yZXJBY2Nlc3NvciwgdGhpcy5waWNrU3RhdGUuc2NvcmVyQ2FjaGUpO1xuXHRcdFx0XHRpZiAoIXNjb3JlKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGljay5oaWdobGlnaHRzID0ge1xuXHRcdFx0XHRcdGxhYmVsOiBsYWJlbE1hdGNoLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbk1hdGNoXG5cdFx0XHRcdH07XG5cdFx0XHRcdHBpY2tzLnB1c2gocGljayk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLnBpY2tTdGF0ZS5pc1F1aWNrTmF2aWdhdGluZykge1xuXHRcdFx0aWYgKHBpY2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cGlja3MucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ3JlY2VudGx5T3BlbmVkU2VwYXJhdG9yJywgXCJyZWNlbnRseSBvcGVuZWRcIikgfSBzYXRpc2ZpZXMgSVF1aWNrUGlja1NlcGFyYXRvcik7XG5cdFx0XHR9XG5cdFx0XHRwaWNrcyA9IGhpc3RvcnlFZGl0b3JQaWNrcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKG9wdGlvbnMuaW5jbHVkZUhlbHApIHtcblx0XHRcdFx0cGlja3MucHVzaCguLi50aGlzLmdldEhlbHBQaWNrcyhxdWVyeSwgdG9rZW4sIG9wdGlvbnMpKTtcblx0XHRcdH1cblx0XHRcdGlmIChoaXN0b3J5RWRpdG9yUGlja3MubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdyZWNlbnRseU9wZW5lZFNlcGFyYXRvcicsIFwicmVjZW50bHkgb3BlbmVkXCIpIH0gc2F0aXNmaWVzIElRdWlja1BpY2tTZXBhcmF0b3IpO1xuXHRcdFx0XHRwaWNrcy5wdXNoKC4uLmhpc3RvcnlFZGl0b3JQaWNrcyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblxuXHRcdFx0Ly8gRmFzdCBwaWNrczogaGVscCAoaWYgaW5jbHVkZWQpICYgZWRpdG9yIGhpc3Rvcnlcblx0XHRcdHBpY2tzOiBvcHRpb25zLmZpbHRlciA/IHBpY2tzLmZpbHRlcigocCkgPT4gb3B0aW9ucy5maWx0ZXI/LihwKSkgOiBwaWNrcyxcblxuXHRcdFx0Ly8gU2xvdyBwaWNrczogZmlsZXMgYW5kIHN5bWJvbHNcblx0XHRcdGFkZGl0aW9uYWxQaWNrczogKGFzeW5jICgpOiBQcm9taXNlPFBpY2tzPElBbnl0aGluZ1F1aWNrUGlja0l0ZW0+PiA9PiB7XG5cblx0XHRcdFx0Ly8gRXhjbHVkZSBhbnkgcmVzdWx0IHRoYXQgaXMgYWxyZWFkeSBwcmVzZW50IGluIGVkaXRvciBoaXN0b3J5XG5cdFx0XHRcdGNvbnN0IGFkZGl0aW9uYWxQaWNrc0V4Y2x1ZGVzID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cdFx0XHRcdGZvciAoY29uc3QgaGlzdG9yeUVkaXRvclBpY2sgb2YgaGlzdG9yeUVkaXRvclBpY2tzKSB7XG5cdFx0XHRcdFx0aWYgKGhpc3RvcnlFZGl0b3JQaWNrLnJlc291cmNlKSB7XG5cdFx0XHRcdFx0XHRhZGRpdGlvbmFsUGlja3NFeGNsdWRlcy5zZXQoaGlzdG9yeUVkaXRvclBpY2sucmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGxldCBhZGRpdGlvbmFsUGlja3MgPSBhd2FpdCB0aGlzLmdldEFkZGl0aW9uYWxQaWNrcyhxdWVyeSwgYWRkaXRpb25hbFBpY2tzRXhjbHVkZXMsIHRoaXMuY29uZmlndXJhdGlvbi5pbmNsdWRlU3ltYm9scywgdG9rZW4pO1xuXHRcdFx0XHRpZiAob3B0aW9ucy5maWx0ZXIpIHtcblx0XHRcdFx0XHRhZGRpdGlvbmFsUGlja3MgPSBhZGRpdGlvbmFsUGlja3MuZmlsdGVyKChwKSA9PiBvcHRpb25zLmZpbHRlcj8uKHApKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gYWRkaXRpb25hbFBpY2tzLmxlbmd0aCA+IDAgPyBbXG5cdFx0XHRcdFx0eyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IHRoaXMuY29uZmlndXJhdGlvbi5pbmNsdWRlU3ltYm9scyA/IGxvY2FsaXplKCdmaWxlQW5kU3ltYm9sUmVzdWx0c1NlcGFyYXRvcicsIFwiZmlsZSBhbmQgc3ltYm9sIHJlc3VsdHNcIikgOiBsb2NhbGl6ZSgnZmlsZVJlc3VsdHNTZXBhcmF0b3InLCBcImZpbGUgcmVzdWx0c1wiKSB9LFxuXHRcdFx0XHRcdC4uLmFkZGl0aW9uYWxQaWNrc1xuXHRcdFx0XHRdIDogW107XG5cdFx0XHR9KSgpLFxuXG5cdFx0XHQvLyBhbGxvdyBzb21lIHRpbWUgdG8gbWVyZ2UgZmlsZXMgYW5kIHN5bWJvbHMgdG8gcmVkdWNlIGZsaWNrZXJpbmdcblx0XHRcdG1lcmdlRGVsYXk6IEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlci5TWU1CT0xfUElDS1NfTUVSR0VfREVMQVlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBZGRpdGlvbmFsUGlja3MocXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCBleGNsdWRlczogUmVzb3VyY2VNYXA8Ym9vbGVhbj4sIGluY2x1ZGVTeW1ib2xzOiBib29sZWFuLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPEFycmF5PElBbnl0aGluZ1F1aWNrUGlja0l0ZW0+PiB7XG5cblx0XHQvLyBSZXNvbHZlIGZpbGUgYW5kIHN5bWJvbCBwaWNrcyAoaWYgZW5hYmxlZClcblx0XHRjb25zdCBbZmlsZVBpY2tzLCBzeW1ib2xQaWNrc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHR0aGlzLmdldEZpbGVQaWNrcyhxdWVyeSwgZXhjbHVkZXMsIHRva2VuKSxcblx0XHRcdHRoaXMuZ2V0V29ya3NwYWNlU3ltYm9sUGlja3MocXVlcnksIGluY2x1ZGVTeW1ib2xzLCB0b2tlbilcblx0XHRdKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIFBlcmZvcm0gc29ydGluZyAodG9wIHJlc3VsdHMgYnkgc2NvcmUpXG5cdFx0Y29uc3Qgc29ydGVkQW55dGhpbmdQaWNrcyA9IHRvcChcblx0XHRcdFsuLi5maWxlUGlja3MsIC4uLnN5bWJvbFBpY2tzXSxcblx0XHRcdChhbnlQaWNrQSwgYW55UGlja0IpID0+IGNvbXBhcmVJdGVtc0J5RnV6enlTY29yZShhbnlQaWNrQSwgYW55UGlja0IsIHF1ZXJ5LCB0cnVlLCBxdWlja1BpY2tJdGVtU2NvcmVyQWNjZXNzb3IsIHRoaXMucGlja1N0YXRlLnNjb3JlckNhY2hlKSxcblx0XHRcdEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlci5NQVhfUkVTVUxUU1xuXHRcdCk7XG5cblx0XHQvLyBQZXJmb3JtIGZpbHRlcmluZ1xuXHRcdGNvbnN0IGZpbHRlcmVkQW55dGhpbmdQaWNrczogSUFueXRoaW5nUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBhbnl0aGluZ1BpY2sgb2Ygc29ydGVkQW55dGhpbmdQaWNrcykge1xuXG5cdFx0XHQvLyBBbHdheXMgcHJlc2VydmUgYW55IGV4aXN0aW5nIGhpZ2hsaWdodHMgKGUuZy4gZnJvbSB3b3Jrc3BhY2Ugc3ltYm9scylcblx0XHRcdGlmIChhbnl0aGluZ1BpY2suaGlnaGxpZ2h0cykge1xuXHRcdFx0XHRmaWx0ZXJlZEFueXRoaW5nUGlja3MucHVzaChhbnl0aGluZ1BpY2spO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPdGhlcndpc2UsIGRvIHRoZSBzY29yaW5nIGFuZCBtYXRjaGluZyBoZXJlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgeyBzY29yZSwgbGFiZWxNYXRjaCwgZGVzY3JpcHRpb25NYXRjaCB9ID0gc2NvcmVJdGVtRnV6enkoYW55dGhpbmdQaWNrLCBxdWVyeSwgdHJ1ZSwgcXVpY2tQaWNrSXRlbVNjb3JlckFjY2Vzc29yLCB0aGlzLnBpY2tTdGF0ZS5zY29yZXJDYWNoZSk7XG5cdFx0XHRcdGlmICghc2NvcmUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFueXRoaW5nUGljay5oaWdobGlnaHRzID0ge1xuXHRcdFx0XHRcdGxhYmVsOiBsYWJlbE1hdGNoLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbk1hdGNoXG5cdFx0XHRcdH07XG5cblx0XHRcdFx0ZmlsdGVyZWRBbnl0aGluZ1BpY2tzLnB1c2goYW55dGhpbmdQaWNrKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmlsdGVyZWRBbnl0aGluZ1BpY2tzO1xuXHR9XG5cblxuXHQvLyNyZWdpb24gRWRpdG9yIEhpc3RvcnlcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxhYmVsT25seUVkaXRvckhpc3RvcnlQaWNrQWNjZXNzb3IgPSBuZXcgUXVpY2tQaWNrSXRlbVNjb3JlckFjY2Vzc29yKHsgc2tpcERlc2NyaXB0aW9uOiB0cnVlIH0pO1xuXG5cdHByaXZhdGUgZ2V0RWRpdG9ySGlzdG9yeVBpY2tzKHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSk6IEFycmF5PElBbnl0aGluZ1F1aWNrUGlja0l0ZW0+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gdGhpcy5jb25maWd1cmF0aW9uO1xuXG5cdFx0Ly8gSnVzdCByZXR1cm4gYWxsIGhpc3RvcnkgZW50cmllcyBpZiBub3Qgc2VhcmNoaW5nXG5cdFx0aWYgKCFxdWVyeS5ub3JtYWxpemVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5oaXN0b3J5U2VydmljZS5nZXRIaXN0b3J5KCkubWFwKGVkaXRvciA9PiB0aGlzLmNyZWF0ZUFueXRoaW5nUGljayhlZGl0b3IsIGNvbmZpZ3VyYXRpb24pKTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuY29uZmlndXJhdGlvbi5pbmNsdWRlSGlzdG9yeSkge1xuXHRcdFx0cmV0dXJuIFtdOyAvLyBkaXNhYmxlZCB3aGVuIHNlYXJjaGluZ1xuXHRcdH1cblxuXHRcdC8vIFBlcmZvcm0gZmlsdGVyaW5nXG5cdFx0Y29uc3QgZWRpdG9ySGlzdG9yeVNjb3JlckFjY2Vzc29yID0gcXVlcnkuY29udGFpbnNQYXRoU2VwYXJhdG9yID8gcXVpY2tQaWNrSXRlbVNjb3JlckFjY2Vzc29yIDogdGhpcy5sYWJlbE9ubHlFZGl0b3JIaXN0b3J5UGlja0FjY2Vzc29yOyAvLyBPbmx5IG1hdGNoIG9uIGxhYmVsIG9mIHRoZSBlZGl0b3IgdW5sZXNzIHRoZSBzZWFyY2ggaW5jbHVkZXMgcGF0aCBzZXBhcmF0b3JzXG5cdFx0Y29uc3QgZWRpdG9ySGlzdG9yeVBpY2tzOiBBcnJheTxJQW55dGhpbmdRdWlja1BpY2tJdGVtPiA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMuaGlzdG9yeVNlcnZpY2UuZ2V0SGlzdG9yeSgpKSB7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IGVkaXRvci5yZXNvdXJjZTtcblx0XHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRvckhpc3RvcnlQaWNrID0gdGhpcy5jcmVhdGVBbnl0aGluZ1BpY2soZWRpdG9yLCBjb25maWd1cmF0aW9uKTtcblxuXHRcdFx0Y29uc3QgeyBzY29yZSwgbGFiZWxNYXRjaCwgZGVzY3JpcHRpb25NYXRjaCB9ID0gc2NvcmVJdGVtRnV6enkoZWRpdG9ySGlzdG9yeVBpY2ssIHF1ZXJ5LCBmYWxzZSwgZWRpdG9ySGlzdG9yeVNjb3JlckFjY2Vzc29yLCB0aGlzLnBpY2tTdGF0ZS5zY29yZXJDYWNoZSk7XG5cdFx0XHRpZiAoIXNjb3JlKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBleGNsdWRlIGVkaXRvcnMgbm90IG1hdGNoaW5nIHF1ZXJ5XG5cdFx0XHR9XG5cblx0XHRcdGVkaXRvckhpc3RvcnlQaWNrLmhpZ2hsaWdodHMgPSB7XG5cdFx0XHRcdGxhYmVsOiBsYWJlbE1hdGNoLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogZGVzY3JpcHRpb25NYXRjaFxuXHRcdFx0fTtcblxuXHRcdFx0ZWRpdG9ySGlzdG9yeVBpY2tzLnB1c2goZWRpdG9ySGlzdG9yeVBpY2spO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiB3aXRob3V0IHNvcnRpbmcgaWYgc2V0dGluZ3MgdGVsbCB0byBzb3J0IGJ5IHJlY2VuY3lcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uLmhpc3RvcnlGaWx0ZXJTb3J0T3JkZXIgPT09ICdyZWNlbmN5Jykge1xuXHRcdFx0cmV0dXJuIGVkaXRvckhpc3RvcnlQaWNrcztcblx0XHR9XG5cblx0XHQvLyBQZXJmb3JtIHNvcnRpbmdcblx0XHRyZXR1cm4gZWRpdG9ySGlzdG9yeVBpY2tzLnNvcnQoKGVkaXRvckEsIGVkaXRvckIpID0+IGNvbXBhcmVJdGVtc0J5RnV6enlTY29yZShlZGl0b3JBLCBlZGl0b3JCLCBxdWVyeSwgZmFsc2UsIGVkaXRvckhpc3RvcnlTY29yZXJBY2Nlc3NvciwgdGhpcy5waWNrU3RhdGUuc2NvcmVyQ2FjaGUpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cblx0Ly8jcmVnaW9uIEZpbGUgU2VhcmNoXG5cblx0cHJpdmF0ZSByZWFkb25seSBmaWxlUXVlcnlEZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRocm90dGxlZERlbGF5ZXI8VVJJW10+KEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlci5UWVBJTkdfU0VBUkNIX0RFTEFZKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBmaWxlUXVlcnlCdWlsZGVyID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXG5cdHByaXZhdGUgY3JlYXRlRmlsZVF1ZXJ5Q2FjaGUoKTogRmlsZVF1ZXJ5Q2FjaGVTdGF0ZSB7XG5cdFx0cmV0dXJuIG5ldyBGaWxlUXVlcnlDYWNoZVN0YXRlKFxuXHRcdFx0Y2FjaGVLZXkgPT4gdGhpcy5maWxlUXVlcnlCdWlsZGVyLmZpbGUodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLCB0aGlzLmdldEZpbGVRdWVyeU9wdGlvbnMoeyBjYWNoZUtleSB9KSksXG5cdFx0XHRxdWVyeSA9PiB0aGlzLnNlYXJjaFNlcnZpY2UuZmlsZVNlYXJjaChxdWVyeSksXG5cdFx0XHRjYWNoZUtleSA9PiB0aGlzLnNlYXJjaFNlcnZpY2UuY2xlYXJDYWNoZShjYWNoZUtleSksXG5cdFx0XHR0aGlzLnBpY2tTdGF0ZS5maWxlUXVlcnlDYWNoZVxuXHRcdCkubG9hZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRGaWxlUGlja3MocXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCBleGNsdWRlczogUmVzb3VyY2VNYXA8Ym9vbGVhbj4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8QXJyYXk8SUFueXRoaW5nUXVpY2tQaWNrSXRlbT4+IHtcblx0XHRpZiAoIXF1ZXJ5Lm5vcm1hbGl6ZWQpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHQvLyBBYnNvbHV0ZSBwYXRoIHJlc3VsdFxuXHRcdGNvbnN0IGFic29sdXRlUGF0aFJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QWJzb2x1dGVQYXRoRmlsZVJlc3VsdChxdWVyeSwgdG9rZW4pO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIFVzZSBhYnNvbHV0ZSBwYXRoIHJlc3VsdCBhcyBvbmx5IHJlc3VsdHMgaWYgcHJlc2VudFxuXHRcdGxldCBmaWxlTWF0Y2hlczogQXJyYXk8VVJJPjtcblx0XHRpZiAoYWJzb2x1dGVQYXRoUmVzdWx0KSB7XG5cdFx0XHRpZiAoZXhjbHVkZXMuaGFzKGFic29sdXRlUGF0aFJlc3VsdCkpIHtcblx0XHRcdFx0cmV0dXJuIFtdOyAvLyBleGNsdWRlZFxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDcmVhdGUgYSBzaW5nbGUgcmVzdWx0IHBpY2sgYW5kIG1ha2Ugc3VyZSB0byBhcHBseSBmdWxsXG5cdFx0XHQvLyBoaWdobGlnaHRzIHRvIGVuc3VyZSB0aGUgcGljayBpcyBkaXNwbGF5ZWQuIFNpbmNlIGFcblx0XHRcdC8vIH4gbWlnaHQgaGF2ZSBiZWVuIHVzZWQgZm9yIHNlYXJjaGluZywgb3VyIGZ1enp5IHNjb3JlclxuXHRcdFx0Ly8gbWF5IG90aGVyd2lzZSBub3QgcHJvcGVybHkgcmVzcGVjdCB0aGUgcGljayBhcyBhIHJlc3VsdFxuXHRcdFx0Y29uc3QgYWJzb2x1dGVQYXRoUGljayA9IHRoaXMuY3JlYXRlQW55dGhpbmdQaWNrKGFic29sdXRlUGF0aFJlc3VsdCwgdGhpcy5jb25maWd1cmF0aW9uKTtcblx0XHRcdGFic29sdXRlUGF0aFBpY2suaGlnaGxpZ2h0cyA9IHtcblx0XHRcdFx0bGFiZWw6IFt7IHN0YXJ0OiAwLCBlbmQ6IGFic29sdXRlUGF0aFBpY2subGFiZWwubGVuZ3RoIH1dLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogYWJzb2x1dGVQYXRoUGljay5kZXNjcmlwdGlvbiA/IFt7IHN0YXJ0OiAwLCBlbmQ6IGFic29sdXRlUGF0aFBpY2suZGVzY3JpcHRpb24ubGVuZ3RoIH1dIDogdW5kZWZpbmVkXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gW2Fic29sdXRlUGF0aFBpY2tdO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBydW4gdGhlIGZpbGUgc2VhcmNoICh3aXRoIGEgZGVsYXllciBpZiBjYWNoZSBpcyBub3QgcmVhZHkgeWV0KVxuXHRcdGlmICh0aGlzLnBpY2tTdGF0ZS5maWxlUXVlcnlDYWNoZT8uaXNMb2FkZWQpIHtcblx0XHRcdGZpbGVNYXRjaGVzID0gYXdhaXQgdGhpcy5kb0ZpbGVTZWFyY2gocXVlcnksIHRva2VuKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZmlsZU1hdGNoZXMgPSBhd2FpdCB0aGlzLmZpbGVRdWVyeURlbGF5ZXIudHJpZ2dlcihhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB0aGlzLmRvRmlsZVNlYXJjaChxdWVyeSwgdG9rZW4pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gRmlsdGVyIGV4Y2x1ZGVzICYgY29udmVydCB0byBwaWNrc1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB0aGlzLmNvbmZpZ3VyYXRpb247XG5cdFx0cmV0dXJuIGZpbGVNYXRjaGVzXG5cdFx0XHQuZmlsdGVyKHJlc291cmNlID0+ICFleGNsdWRlcy5oYXMocmVzb3VyY2UpKVxuXHRcdFx0Lm1hcChyZXNvdXJjZSA9PiB0aGlzLmNyZWF0ZUFueXRoaW5nUGljayhyZXNvdXJjZSwgY29uZmlndXJhdGlvbikpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0ZpbGVTZWFyY2gocXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0Y29uc3QgW2ZpbGVTZWFyY2hSZXN1bHRzLCByZWxhdGl2ZVBhdGhGaWxlUmVzdWx0c10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cblx0XHRcdC8vIEZpbGUgc2VhcmNoOiB0aGlzIGlzIGEgc2VhcmNoIG92ZXIgYWxsIGZpbGVzIG9mIHRoZSB3b3Jrc3BhY2UgdXNpbmcgdGhlIHByb3ZpZGVkIHBhdHRlcm5cblx0XHRcdHRoaXMuZ2V0RmlsZVNlYXJjaFJlc3VsdHMocXVlcnksIHRva2VuKSxcblxuXHRcdFx0Ly8gUmVsYXRpdmUgcGF0aCBzZWFyY2g6IHdlIGFsc28gd2FudCB0byBjb25zaWRlciByZXN1bHRzIHRoYXQgbWF0Y2ggZmlsZXMgaW5zaWRlIHRoZSB3b3Jrc3BhY2Vcblx0XHRcdC8vIGJ5IGxvb2tpbmcgZm9yIHJlbGF0aXZlIHBhdGhzIHRoYXQgdGhlIHVzZXIgdHlwZWQgYXMgcXVlcnkuIFRoaXMgYWxsb3dzIHRvIHJldHVybiBldmVuIGV4Y2x1ZGVkXG5cdFx0XHQvLyByZXN1bHRzIGludG8gdGhlIHBpY2tlciBpZiBmb3VuZCAoZS5nLiBoZWxwcyBmb3Igb3BlbmluZyBjb21waWxhdGlvbiByZXN1bHRzIHRoYXQgYXJlIG90aGVyd2lzZVxuXHRcdFx0Ly8gZXhjbHVkZWQpXG5cdFx0XHR0aGlzLmdldFJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzKHF1ZXJ5LCB0b2tlbilcblx0XHRdKTtcblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdC8vIFJldHVybiBxdWlja2x5IGlmIG5vIHJlbGF0aXZlIHJlc3VsdHMgYXJlIHByZXNlbnRcblx0XHRpZiAoIXJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzKSB7XG5cdFx0XHRyZXR1cm4gZmlsZVNlYXJjaFJlc3VsdHM7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXJ3aXNlLCBtYWtlIHN1cmUgdG8gZmlsdGVyIHJlbGF0aXZlIHBhdGggcmVzdWx0cyBmcm9tXG5cdFx0Ly8gdGhlIHNlYXJjaCByZXN1bHRzIHRvIHByZXZlbnQgZHVwbGljYXRlc1xuXHRcdGNvbnN0IHJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzTWFwID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cdFx0Zm9yIChjb25zdCByZWxhdGl2ZVBhdGhGaWxlUmVzdWx0IG9mIHJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzKSB7XG5cdFx0XHRyZWxhdGl2ZVBhdGhGaWxlUmVzdWx0c01hcC5zZXQocmVsYXRpdmVQYXRoRmlsZVJlc3VsdCwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFtcblx0XHRcdC4uLmZpbGVTZWFyY2hSZXN1bHRzLmZpbHRlcihyZXN1bHQgPT4gIXJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzTWFwLmhhcyhyZXN1bHQpKSxcblx0XHRcdC4uLnJlbGF0aXZlUGF0aEZpbGVSZXN1bHRzXG5cdFx0XTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0RmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cblx0XHQvLyBmaWxlUGF0dGVybiBmb3Igc2VhcmNoIGRlcGVuZHMgb24gdGhlIG51bWJlciBvZiBxdWVyaWVzIGluIGlucHV0OlxuXHRcdC8vIC0gd2l0aCBtdWx0aXBsZTogb25seSB0YWtlIHRoZSBmaXJzdCBvbmUgYW5kIGxldCB0aGUgZmlsdGVyIGxhdGVyIGRyb3Agbm9uLW1hdGNoaW5nIHJlc3VsdHNcblx0XHQvLyAtIHdpdGggc2luZ2xlOiBqdXN0IHRha2UgdGhlIG9yaWdpbmFsIGluIGZ1bGxcblx0XHQvL1xuXHRcdC8vIFRoaXMgZW5hYmxlcyB0byBlLmcuIHNlYXJjaCBmb3IgXCJzb21lRmlsZSBzb21lRm9sZGVyXCIgYnkgb25seSByZXR1cm5pbmdcblx0XHQvLyBzZWFyY2ggcmVzdWx0cyBmb3IgXCJzb21lRmlsZVwiIGFuZCBub3QgYm90aCB0aGF0IHdvdWxkIG5vcm1hbGx5IG5vdCBtYXRjaC5cblx0XHQvL1xuXHRcdGxldCBmaWxlUGF0dGVybiA9ICcnO1xuXHRcdGlmIChxdWVyeS52YWx1ZXMgJiYgcXVlcnkudmFsdWVzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGZpbGVQYXR0ZXJuID0gcXVlcnkudmFsdWVzWzBdLm9yaWdpbmFsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaWxlUGF0dGVybiA9IHF1ZXJ5Lm9yaWdpbmFsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpbGVTZWFyY2hSZXN1bHRzID0gYXdhaXQgdGhpcy5kb0dldEZpbGVTZWFyY2hSZXN1bHRzKGZpbGVQYXR0ZXJuLCB0b2tlbik7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gSWYgd2UgZGV0ZWN0IHRoYXQgdGhlIHNlYXJjaCBsaW1pdCBoYXMgYmVlbiBoaXQgYW5kIHdlIGhhdmUgYSBxdWVyeVxuXHRcdC8vIHRoYXQgd2FzIGNvbXBvc2VkIG9mIG11bHRpcGxlIGlucHV0cyB3aGVyZSB3ZSBvbmx5IHRvb2sgdGhlIGZpcnN0IHBhcnRcblx0XHQvLyB3ZSBydW4gYW5vdGhlciBzZWFyY2ggd2l0aCB0aGUgZnVsbCBvcmlnaW5hbCBxdWVyeSBpbmNsdWRlZCB0byBtYWtlXG5cdFx0Ly8gc3VyZSB3ZSBhcmUgaW5jbHVkaW5nIGFsbCBwb3NzaWJsZSByZXN1bHRzIHRoYXQgY291bGQgbWF0Y2guXG5cdFx0aWYgKGZpbGVTZWFyY2hSZXN1bHRzLmxpbWl0SGl0ICYmIHF1ZXJ5LnZhbHVlcyAmJiBxdWVyeS52YWx1ZXMubGVuZ3RoID4gMSkge1xuXHRcdFx0Y29uc3QgYWRkaXRpb25hbEZpbGVTZWFyY2hSZXN1bHRzID0gYXdhaXQgdGhpcy5kb0dldEZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5Lm9yaWdpbmFsLCB0b2tlbik7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZW1lbWJlciB3aGljaCByZXN1bHQgd2UgYWxyZWFkeSBjb3ZlcmVkXG5cdFx0XHRjb25zdCBleGlzdGluZ0ZpbGVTZWFyY2hSZXN1bHRzTWFwID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGZpbGVTZWFyY2hSZXN1bHQgb2YgZmlsZVNlYXJjaFJlc3VsdHMucmVzdWx0cykge1xuXHRcdFx0XHRleGlzdGluZ0ZpbGVTZWFyY2hSZXN1bHRzTWFwLnNldChmaWxlU2VhcmNoUmVzdWx0LnJlc291cmNlLCB0cnVlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQWRkIGFsbCBhZGRpdGlvbmFsIHJlc3VsdHMgdG8gdGhlIG9yaWdpbmFsIHNldCBmb3IgaW5jbHVzaW9uXG5cdFx0XHRmb3IgKGNvbnN0IGFkZGl0aW9uYWxGaWxlU2VhcmNoUmVzdWx0IG9mIGFkZGl0aW9uYWxGaWxlU2VhcmNoUmVzdWx0cy5yZXN1bHRzKSB7XG5cdFx0XHRcdGlmICghZXhpc3RpbmdGaWxlU2VhcmNoUmVzdWx0c01hcC5oYXMoYWRkaXRpb25hbEZpbGVTZWFyY2hSZXN1bHQucmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0ZmlsZVNlYXJjaFJlc3VsdHMucmVzdWx0cy5wdXNoKGFkZGl0aW9uYWxGaWxlU2VhcmNoUmVzdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmaWxlU2VhcmNoUmVzdWx0cy5yZXN1bHRzLm1hcChyZXN1bHQgPT4gcmVzdWx0LnJlc291cmNlKTtcblx0fVxuXG5cdHByaXZhdGUgZG9HZXRGaWxlU2VhcmNoUmVzdWx0cyhmaWxlUGF0dGVybjogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdGNvbnN0IHN0YXJ0ID0gRGF0ZS5ub3coKTtcblx0XHRyZXR1cm4gdGhpcy5zZWFyY2hTZXJ2aWNlLmZpbGVTZWFyY2goXG5cdFx0XHR0aGlzLmZpbGVRdWVyeUJ1aWxkZXIuZmlsZShcblx0XHRcdFx0dGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLFxuXHRcdFx0XHR0aGlzLmdldEZpbGVRdWVyeU9wdGlvbnMoe1xuXHRcdFx0XHRcdGZpbGVQYXR0ZXJuLFxuXHRcdFx0XHRcdGNhY2hlS2V5OiB0aGlzLnBpY2tTdGF0ZS5maWxlUXVlcnlDYWNoZT8uY2FjaGVLZXksXG5cdFx0XHRcdFx0bWF4UmVzdWx0czogQW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyLk1BWF9SRVNVTFRTXG5cdFx0XHRcdH0pXG5cdFx0XHQpLCB0b2tlbikuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgUXVpY2tBY2Nlc3MgZmlsZVNlYXJjaCAke0RhdGUubm93KCkgLSBzdGFydH1tc2ApO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEZpbGVRdWVyeU9wdGlvbnMoaW5wdXQ6IHsgZmlsZVBhdHRlcm4/OiBzdHJpbmc7IGNhY2hlS2V5Pzogc3RyaW5nOyBtYXhSZXN1bHRzPzogbnVtYmVyIH0pOiBJRmlsZVF1ZXJ5QnVpbGRlck9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHRfcmVhc29uOiAnb3BlbkZpbGVIYW5kbGVyJywgLy8gdXNlZCBmb3IgdGVsZW1ldHJ5IC0gZG8gbm90IGNoYW5nZVxuXHRcdFx0ZXh0cmFGaWxlUmVzb3VyY2VzOiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldE91dE9mV29ya3NwYWNlRWRpdG9yUmVzb3VyY2VzKSxcblx0XHRcdGZpbGVQYXR0ZXJuOiBpbnB1dC5maWxlUGF0dGVybiB8fCAnJyxcblx0XHRcdGNhY2hlS2V5OiBpbnB1dC5jYWNoZUtleSxcblx0XHRcdG1heFJlc3VsdHM6IGlucHV0Lm1heFJlc3VsdHMgfHwgMCxcblx0XHRcdHNvcnRCeVNjb3JlOiB0cnVlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QWJzb2x1dGVQYXRoRmlsZVJlc3VsdChxdWVyeTogSVByZXBhcmVkUXVlcnksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCFxdWVyeS5jb250YWluc1BhdGhTZXBhcmF0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1c2VySG9tZSA9IGF3YWl0IHRoaXMucGF0aFNlcnZpY2UudXNlckhvbWUoKTtcblx0XHRjb25zdCBkZXRpbGRpZmllZFF1ZXJ5ID0gdW50aWxkaWZ5KHF1ZXJ5Lm9yaWdpbmFsLCB1c2VySG9tZS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSA/IHVzZXJIb21lLmZzUGF0aCA6IHVzZXJIb21lLnBhdGgpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzQWJzb2x1dGVQYXRoUXVlcnkgPSAoYXdhaXQgdGhpcy5wYXRoU2VydmljZS5wYXRoKS5pc0Fic29sdXRlKGRldGlsZGlmaWVkUXVlcnkpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpc0Fic29sdXRlUGF0aFF1ZXJ5KSB7XG5cdFx0XHRjb25zdCByZXNvdXJjZSA9IHRvTG9jYWxSZXNvdXJjZShcblx0XHRcdFx0YXdhaXQgdGhpcy5wYXRoU2VydmljZS5maWxlVVJJKGRldGlsZGlmaWVkUXVlcnkpLFxuXHRcdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHksXG5cdFx0XHRcdHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZVxuXHRcdFx0KTtcblxuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQocmVzb3VyY2UpKS5pc0ZpbGUpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzb3VyY2U7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSBpZiBmaWxlIGRvZXMgbm90IGV4aXN0XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRSZWxhdGl2ZVBhdGhGaWxlUmVzdWx0cyhxdWVyeTogSVByZXBhcmVkUXVlcnksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXF1ZXJ5LmNvbnRhaW5zUGF0aFNlcGFyYXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIENvbnZlcnQgcmVsYXRpdmUgcGF0aHMgdG8gYWJzb2x1dGUgcGF0aHMgb3ZlciBhbGwgZm9sZGVycyBvZiB0aGUgd29ya3NwYWNlXG5cdFx0Ly8gYW5kIHJldHVybiB0aGVtIGFzIHJlc3VsdHMgaWYgdGhlIGFic29sdXRlIHBhdGhzIGV4aXN0XG5cdFx0Y29uc3QgaXNBYnNvbHV0ZVBhdGhRdWVyeSA9IChhd2FpdCB0aGlzLnBhdGhTZXJ2aWNlLnBhdGgpLmlzQWJzb2x1dGUocXVlcnkub3JpZ2luYWwpO1xuXHRcdGlmICghaXNBYnNvbHV0ZVBhdGhRdWVyeSkge1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VzOiBVUklbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBmb2xkZXIgb2YgdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzKSB7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0b0xvY2FsUmVzb3VyY2UoXG5cdFx0XHRcdFx0Zm9sZGVyLnRvUmVzb3VyY2UocXVlcnkub3JpZ2luYWwpLFxuXHRcdFx0XHRcdHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSxcblx0XHRcdFx0XHR0aGlzLnBhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWVcblx0XHRcdFx0KTtcblxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGlmICgoYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHJlc291cmNlKSkuaXNGaWxlKSB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZXMucHVzaChyZXNvdXJjZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdC8vIGlnbm9yZSBpZiBmaWxlIGRvZXMgbm90IGV4aXN0XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc291cmNlcztcblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gQ29tbWFuZCBDZW50ZXIgKGlmIGVuYWJsZWQpXG5cblx0cHJpdmF0ZSByZWFkb25seSBsYXp5UmVnaXN0cnkgPSBuZXcgTGF6eSgoKSA9PiBSZWdpc3RyeS5hczxJUXVpY2tBY2Nlc3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5RdWlja2FjY2VzcykpO1xuXG5cdHByaXZhdGUgZ2V0SGVscFBpY2tzKHF1ZXJ5OiBJUHJlcGFyZWRRdWVyeSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBydW5PcHRpb25zPzogQW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyk6IElBbnl0aGluZ1F1aWNrUGlja0l0ZW1bXSB7XG5cdFx0aWYgKHF1ZXJ5Lm5vcm1hbGl6ZWQpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gSWYgdGhlcmUncyBhIGZpbHRlciwgd2UgZG9uJ3Qgc2hvdyB0aGUgaGVscFxuXHRcdH1cblxuXHRcdHR5cGUgSUhlbHBBbnl0aGluZ1F1aWNrUGlja0l0ZW0gPSBJQW55dGhpbmdRdWlja1BpY2tJdGVtICYgeyBjb21tYW5kQ2VudGVyT3JkZXI6IG51bWJlciB9O1xuXHRcdGNvbnN0IHByb3ZpZGVyczogSUhlbHBBbnl0aGluZ1F1aWNrUGlja0l0ZW1bXSA9IHRoaXMubGF6eVJlZ2lzdHJ5LnZhbHVlLmdldFF1aWNrQWNjZXNzUHJvdmlkZXJzKClcblx0XHRcdC5maWx0ZXIocCA9PiBwLmhlbHBFbnRyaWVzLnNvbWUoaCA9PiBoLmNvbW1hbmRDZW50ZXJPcmRlciAhPT0gdW5kZWZpbmVkKSlcblx0XHRcdC5mbGF0TWFwKHByb3ZpZGVyID0+IHByb3ZpZGVyLmhlbHBFbnRyaWVzXG5cdFx0XHRcdC5maWx0ZXIoaCA9PiBoLmNvbW1hbmRDZW50ZXJPcmRlciAhPT0gdW5kZWZpbmVkKVxuXHRcdFx0XHQubWFwKGhlbHBFbnRyeSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXJTcGVjaWZpY09wdGlvbnM6IEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlclJ1bk9wdGlvbnMgfCB1bmRlZmluZWQgPSB7XG5cdFx0XHRcdFx0XHQuLi5ydW5PcHRpb25zLFxuXHRcdFx0XHRcdFx0aW5jbHVkZUhlbHA6IHByb3ZpZGVyLnByZWZpeCA9PT0gQW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCA/IGZhbHNlIDogcnVuT3B0aW9ucz8uaW5jbHVkZUhlbHBcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSBoZWxwRW50cnkuY29tbWFuZENlbnRlckxhYmVsID8/IGhlbHBFbnRyeS5kZXNjcmlwdGlvbjtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0bGFiZWwsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogaGVscEVudHJ5LnByZWZpeCA/PyBwcm92aWRlci5wcmVmaXgsXG5cdFx0XHRcdFx0XHRjb21tYW5kQ2VudGVyT3JkZXI6IGhlbHBFbnRyeS5jb21tYW5kQ2VudGVyT3JkZXIhLFxuXHRcdFx0XHRcdFx0a2V5YmluZGluZzogaGVscEVudHJ5LmNvbW1hbmRJZCA/IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhoZWxwRW50cnkuY29tbWFuZElkKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2hlbHBQaWNrQXJpYUxhYmVsJywgXCJ7MH0sIHsxfVwiLCBsYWJlbCwgaGVscEVudHJ5LmRlc2NyaXB0aW9uKSxcblx0XHRcdFx0XHRcdGFjY2VwdDogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnF1aWNrQWNjZXNzLnNob3cocHJvdmlkZXIucHJlZml4LCB7XG5cdFx0XHRcdFx0XHRcdFx0cHJlc2VydmVWYWx1ZTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRwcm92aWRlck9wdGlvbnM6IHByb3ZpZGVyU3BlY2lmaWNPcHRpb25zXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pKTtcblxuXHRcdC8vIFRPRE86IFRoZXJlIGhhcyB0byBiZSBhIGJldHRlciBwbGFjZSBmb3IgdGhpcywgYnV0IGl0J3MgdGhlIGZpcnN0IHRpbWUgd2UgYXJlIGFkZGluZyBhIG5vbi1xdWljayBhY2Nlc3MgcHJvdmlkZXJcblx0XHQvLyB0byB0aGUgY29tbWFuZCBjZW50ZXIsIHNvIGZvciBub3csIGxldCdzIGRvIHRoaXMuXG5cdFx0aWYgKHRoaXMucXVpY2tDaGF0U2VydmljZS5lbmFibGVkKSB7XG5cdFx0XHRwcm92aWRlcnMucHVzaCh7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdCcsIFwiT3BlbiBRdWljayBDaGF0XCIpLFxuXHRcdFx0XHRjb21tYW5kQ2VudGVyT3JkZXI6IDMwLFxuXHRcdFx0XHRrZXliaW5kaW5nOiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoQVNLX1FVSUNLX1FVRVNUSU9OX0FDVElPTl9JRCksXG5cdFx0XHRcdGFjY2VwdDogKCkgPT4gdGhpcy5xdWlja0NoYXRTZXJ2aWNlLnRvZ2dsZSgpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvdmlkZXJzLnNvcnQoKGEsIGIpID0+IGEuY29tbWFuZENlbnRlck9yZGVyIC0gYi5jb21tYW5kQ2VudGVyT3JkZXIpO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIFdvcmtzcGFjZSBTeW1ib2xzIChpZiBlbmFibGVkKVxuXG5cdHByaXZhdGUgd29ya3NwYWNlU3ltYm9sc1F1aWNrQWNjZXNzID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTeW1ib2xzUXVpY2tBY2Nlc3NQcm92aWRlcikpO1xuXG5cdHByaXZhdGUgYXN5bmMgZ2V0V29ya3NwYWNlU3ltYm9sUGlja3MocXVlcnk6IElQcmVwYXJlZFF1ZXJ5LCBpbmNsdWRlU3ltYm9sczogYm9vbGVhbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxBcnJheTxJQW55dGhpbmdRdWlja1BpY2tJdGVtPj4ge1xuXHRcdGlmIChcblx0XHRcdCFxdWVyeS5ub3JtYWxpemVkIHx8XHQvLyB3ZSBuZWVkIGEgdmFsdWUgZm9yIHNlYXJjaCBmb3Jcblx0XHRcdCFpbmNsdWRlU3ltYm9scyB8fFx0XHQvLyB3ZSBuZWVkIHRvIGVuYWJsZSBzeW1ib2xzIGluIHNlYXJjaFxuXHRcdFx0dGhpcy5waWNrU3RhdGUubGFzdFJhbmdlXHRcdFx0XHQvLyBhIHJhbmdlIGlzIGFuIGluZGljYXRvciBmb3IganVzdCBzZWFyY2hpbmcgZm9yIGZpbGVzXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gRGVsZWdhdGUgdG8gdGhlIGV4aXN0aW5nIHN5bWJvbHMgcXVpY2sgYWNjZXNzXG5cdFx0Ly8gYnV0IHNraXAgbG9jYWwgcmVzdWx0cyBhbmQgYWxzbyBkbyBub3Qgc2NvcmVcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VTeW1ib2xzUXVpY2tBY2Nlc3MuZ2V0U3ltYm9sUGlja3MocXVlcnkub3JpZ2luYWwsIHtcblx0XHRcdHNraXBMb2NhbDogdHJ1ZSxcblx0XHRcdHNraXBTb3J0aW5nOiB0cnVlLFxuXHRcdFx0ZGVsYXk6IEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlci5UWVBJTkdfU0VBUkNIX0RFTEFZXG5cdFx0fSwgdG9rZW4pO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblxuXHQvLyNyZWdpb24gRWRpdG9yIFN5bWJvbHMgKGlmIG5hcnJvd2luZyBkb3duIGludG8gYSBnbG9iYWwgcGljayB2aWEgYEBgKVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU3ltYm9sc1F1aWNrQWNjZXNzID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlcik7XG5cblx0cHJpdmF0ZSBnZXRFZGl0b3JTeW1ib2xQaWNrcyhxdWVyeTogSVByZXBhcmVkUXVlcnksIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UGlja3M8SUFueXRoaW5nUXVpY2tQaWNrSXRlbT4+IHwgbnVsbCB7XG5cdFx0Y29uc3QgZmlsdGVyU2VnbWVudHMgPSBxdWVyeS5vcmlnaW5hbC5zcGxpdChHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgpO1xuXHRcdGNvbnN0IGZpbHRlciA9IGZpbHRlclNlZ21lbnRzLmxlbmd0aCA+IDEgPyBmaWx0ZXJTZWdtZW50c1tmaWx0ZXJTZWdtZW50cy5sZW5ndGggLSAxXS50cmltKCkgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHR5cGVvZiBmaWx0ZXIgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDsgLy8gd2UgbmVlZCB0byBiZSBzZWFyY2hlZCBmb3IgZWRpdG9yIHN5bWJvbHMgdmlhIGBAYFxuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZUdsb2JhbFBpY2sgPSB0aGlzLnBpY2tTdGF0ZS5sYXN0R2xvYmFsUGlja3M/LmFjdGl2ZTtcblx0XHRpZiAoIWFjdGl2ZUdsb2JhbFBpY2spIHtcblx0XHRcdHJldHVybiBudWxsOyAvLyB3ZSBuZWVkIGFuIGFjdGl2ZSBnbG9iYWwgcGljayB0byBmaW5kIHN5bWJvbHMgZm9yXG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlR2xvYmFsUmVzb3VyY2UgPSBhY3RpdmVHbG9iYWxQaWNrLnJlc291cmNlO1xuXHRcdGlmICghYWN0aXZlR2xvYmFsUmVzb3VyY2UgfHwgKCF0aGlzLmZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKGFjdGl2ZUdsb2JhbFJlc291cmNlKSAmJiBhY3RpdmVHbG9iYWxSZXNvdXJjZS5zY2hlbWUgIT09IFNjaGVtYXMudW50aXRsZWQpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDsgLy8gd2UgbmVlZCBhIHJlc291cmNlIHRoYXQgd2UgY2FuIHJlc29sdmVcblx0XHR9XG5cblx0XHRpZiAoYWN0aXZlR2xvYmFsUGljay5sYWJlbC5pbmNsdWRlcyhHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgpIHx8IGFjdGl2ZUdsb2JhbFBpY2suZGVzY3JpcHRpb24/LmluY2x1ZGVzKEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCkpIHtcblx0XHRcdGlmIChmaWx0ZXJTZWdtZW50cy5sZW5ndGggPCAzKSB7XG5cdFx0XHRcdHJldHVybiBudWxsOyAvLyByZXF1aXJlIGF0IGxlYXN0IDIgYEBgIGlmIG91ciBhY3RpdmUgcGljayBjb250YWlucyBgQGAgaW4gbGFiZWwgb3IgZGVzY3JpcHRpb25cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5kb0dldEVkaXRvclN5bWJvbFBpY2tzKGFjdGl2ZUdsb2JhbFBpY2ssIGFjdGl2ZUdsb2JhbFJlc291cmNlLCBmaWx0ZXIsIGRpc3Bvc2FibGVzLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvR2V0RWRpdG9yU3ltYm9sUGlja3MoYWN0aXZlR2xvYmFsUGljazogSUFueXRoaW5nUXVpY2tQaWNrSXRlbSwgYWN0aXZlR2xvYmFsUmVzb3VyY2U6IFVSSSwgZmlsdGVyOiBzdHJpbmcsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8UGlja3M8SUFueXRoaW5nUXVpY2tQaWNrSXRlbT4+IHtcblxuXHRcdC8vIEJyaW5nIHRoZSBlZGl0b3IgdG8gZnJvbnQgdG8gcmV2aWV3IHN5bWJvbHMgdG8gZ28gdG9cblx0XHR0cnkge1xuXG5cdFx0XHQvLyB3ZSBtdXN0IHJlbWVtYmVyIG91ciBjdXJyZXQgdmlldyBzdGF0ZSB0byBiZSBhYmxlIHRvIHJlc3RvcmVcblx0XHRcdHRoaXMucGlja1N0YXRlLmVkaXRvclZpZXdTdGF0ZS5zZXQoKTtcblxuXHRcdFx0Ly8gb3BlbiBpdFxuXHRcdFx0YXdhaXQgdGhpcy5waWNrU3RhdGUuZWRpdG9yVmlld1N0YXRlLm9wZW5UcmFuc2llbnRFZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogYWN0aXZlR2xvYmFsUmVzb3VyY2UsXG5cdFx0XHRcdG9wdGlvbnM6IHsgcHJlc2VydmVGb2N1czogdHJ1ZSwgcmV2ZWFsSWZPcGVuZWQ6IHRydWUsIGlnbm9yZUVycm9yOiB0cnVlIH1cblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gW107IC8vIHJldHVybiBpZiByZXNvdXJjZSBjYW5ub3QgYmUgb3BlbmVkXG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gT2J0YWluIG1vZGVsIGZyb20gcmVzb3VyY2Vcblx0XHRsZXQgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChhY3RpdmVHbG9iYWxSZXNvdXJjZSk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbW9kZWxSZWZlcmVuY2UgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGFjdGl2ZUdsb2JhbFJlc291cmNlKSk7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG1vZGVsID0gbW9kZWxSZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHJldHVybiBbXTsgLy8gcmV0dXJuIGlmIG1vZGVsIGNhbm5vdCBiZSByZXNvbHZlZFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFzayBwcm92aWRlciBmb3IgZWRpdG9yIHN5bWJvbHNcblx0XHRjb25zdCBlZGl0b3JTeW1ib2xQaWNrcyA9IChhd2FpdCB0aGlzLmVkaXRvclN5bWJvbHNRdWlja0FjY2Vzcy5nZXRTeW1ib2xQaWNrcyhtb2RlbCwgZmlsdGVyLCB7IGV4dHJhQ29udGFpbmVyTGFiZWw6IHN0cmlwSWNvbnMoYWN0aXZlR2xvYmFsUGljay5sYWJlbCkgfSwgZGlzcG9zYWJsZXMsIHRva2VuKSk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvclN5bWJvbFBpY2tzLm1hcChlZGl0b3JTeW1ib2xQaWNrID0+IHtcblxuXHRcdFx0Ly8gUHJlc2VydmUgc2VwYXJhdG9yc1xuXHRcdFx0aWYgKGVkaXRvclN5bWJvbFBpY2sudHlwZSA9PT0gJ3NlcGFyYXRvcicpIHtcblx0XHRcdFx0cmV0dXJuIGVkaXRvclN5bWJvbFBpY2s7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENvbnZlcnQgZWRpdG9yIHN5bWJvbHMgdG8gYW55dGhpbmcgcGlja1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Li4uZWRpdG9yU3ltYm9sUGljayxcblx0XHRcdFx0cmVzb3VyY2U6IGFjdGl2ZUdsb2JhbFJlc291cmNlLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogZWRpdG9yU3ltYm9sUGljay5kZXNjcmlwdGlvbixcblx0XHRcdFx0dHJpZ2dlcjogKGJ1dHRvbkluZGV4LCBrZXlNb2RzKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuQW55dGhpbmcoYWN0aXZlR2xvYmFsUmVzb3VyY2UsIHsga2V5TW9kcywgcmFuZ2U6IGVkaXRvclN5bWJvbFBpY2sucmFuZ2U/LnNlbGVjdGlvbiwgZm9yY2VPcGVuU2lkZUJ5U2lkZTogdHJ1ZSB9KTtcblxuXHRcdFx0XHRcdHJldHVybiBUcmlnZ2VyQWN0aW9uLkNMT1NFX1BJQ0tFUjtcblx0XHRcdFx0fSxcblx0XHRcdFx0YWNjZXB0OiAoa2V5TW9kcywgZXZlbnQpID0+IHRoaXMub3BlbkFueXRoaW5nKGFjdGl2ZUdsb2JhbFJlc291cmNlLCB7IGtleU1vZHMsIHJhbmdlOiBlZGl0b3JTeW1ib2xQaWNrLnJhbmdlPy5zZWxlY3Rpb24sIHByZXNlcnZlRm9jdXM6IGV2ZW50LmluQmFja2dyb3VuZCwgZm9yY2VQaW5uZWQ6IGV2ZW50LmluQmFja2dyb3VuZCB9KVxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdGFkZERlY29yYXRpb25zKGVkaXRvcjogSUVkaXRvciwgcmFuZ2U6IElSYW5nZSk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yU3ltYm9sc1F1aWNrQWNjZXNzLmFkZERlY29yYXRpb25zKGVkaXRvciwgcmFuZ2UpO1xuXHR9XG5cblx0Y2xlYXJEZWNvcmF0aW9ucyhlZGl0b3I6IElFZGl0b3IpOiB2b2lkIHtcblx0XHR0aGlzLmVkaXRvclN5bWJvbHNRdWlja0FjY2Vzcy5jbGVhckRlY29yYXRpb25zKGVkaXRvcik7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXG5cdC8vI3JlZ2lvbiBIZWxwZXJzXG5cblx0cHJpdmF0ZSBjcmVhdGVBbnl0aGluZ1BpY2socmVzb3VyY2VPckVkaXRvcjogVVJJIHwgRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCwgY29uZmlndXJhdGlvbjogeyBvcGVuU2lkZUJ5U2lkZURpcmVjdGlvbjogJ3JpZ2h0JyB8ICdkb3duJyB8IHVuZGVmaW5lZCB9KTogSUFueXRoaW5nUXVpY2tQaWNrSXRlbSB7XG5cdFx0Y29uc3QgaXNFZGl0b3JIaXN0b3J5RW50cnkgPSAhVVJJLmlzVXJpKHJlc291cmNlT3JFZGl0b3IpO1xuXG5cdFx0bGV0IHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGxhYmVsOiBzdHJpbmc7XG5cdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGlzRGlydHk6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGV4dHJhQ2xhc3Nlczogc3RyaW5nW107XG5cdFx0bGV0IGljb246IFRoZW1lSWNvbiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGlmIChpc0VkaXRvcklucHV0KHJlc291cmNlT3JFZGl0b3IpKSB7XG5cdFx0XHRyZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkocmVzb3VyY2VPckVkaXRvcik7XG5cdFx0XHRsYWJlbCA9IHJlc291cmNlT3JFZGl0b3IuZ2V0TmFtZSgpO1xuXHRcdFx0ZGVzY3JpcHRpb24gPSByZXNvdXJjZU9yRWRpdG9yLmdldERlc2NyaXB0aW9uKCk7XG5cdFx0XHRpc0RpcnR5ID0gcmVzb3VyY2VPckVkaXRvci5pc0RpcnR5KCkgJiYgIXJlc291cmNlT3JFZGl0b3IuaXNTYXZpbmcoKTtcblx0XHRcdGV4dHJhQ2xhc3NlcyA9IHJlc291cmNlT3JFZGl0b3IuZ2V0TGFiZWxFeHRyYUNsYXNzZXMoKTtcblx0XHRcdGljb24gPSByZXNvdXJjZU9yRWRpdG9yLmdldEljb24oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb3VyY2UgPSBVUkkuaXNVcmkocmVzb3VyY2VPckVkaXRvcikgPyByZXNvdXJjZU9yRWRpdG9yIDogcmVzb3VyY2VPckVkaXRvci5yZXNvdXJjZTtcblx0XHRcdGNvbnN0IGN1c3RvbUxhYmVsID0gdGhpcy5jdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UuZ2V0TmFtZShyZXNvdXJjZSk7XG5cdFx0XHRsYWJlbCA9IGN1c3RvbUxhYmVsIHx8IGJhc2VuYW1lT3JBdXRob3JpdHkocmVzb3VyY2UpO1xuXHRcdFx0ZGVzY3JpcHRpb24gPSB0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCghIWN1c3RvbUxhYmVsID8gcmVzb3VyY2UgOiBkaXJuYW1lKHJlc291cmNlKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGlzRGlydHkgPSB0aGlzLndvcmtpbmdDb3B5U2VydmljZS5pc0RpcnR5KHJlc291cmNlKSAmJiAhdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmhhc1Nob3J0QXV0b1NhdmVEZWxheShyZXNvdXJjZSk7XG5cdFx0XHRleHRyYUNsYXNzZXMgPSBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBsYWJlbEFuZERlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24gPyBgJHtsYWJlbH0gJHtkZXNjcmlwdGlvbn1gIDogbGFiZWw7XG5cblx0XHRjb25zdCBpY29uQ2xhc3Nlc1ZhbHVlID0gbmV3IExhenkoKCkgPT4gZ2V0SWNvbkNsYXNzZXModGhpcy5tb2RlbFNlcnZpY2UsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCByZXNvdXJjZSwgdW5kZWZpbmVkLCBpY29uKS5jb25jYXQoZXh0cmFDbGFzc2VzKSk7XG5cblx0XHRjb25zdCBidXR0b25zVmFsdWUgPSBuZXcgTGF6eSgoKSA9PiB7XG5cdFx0XHRjb25zdCBvcGVuU2lkZUJ5U2lkZURpcmVjdGlvbiA9IGNvbmZpZ3VyYXRpb24ub3BlblNpZGVCeVNpZGVEaXJlY3Rpb247XG5cdFx0XHRjb25zdCBidXR0b25zOiBJUXVpY2tJbnB1dEJ1dHRvbltdID0gW107XG5cblx0XHRcdC8vIE9wZW4gdG8gc2lkZSAvIGJlbG93XG5cdFx0XHRidXR0b25zLnB1c2goe1xuXHRcdFx0XHRpY29uQ2xhc3M6IG9wZW5TaWRlQnlTaWRlRGlyZWN0aW9uID09PSAncmlnaHQnID8gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uc3BsaXRIb3Jpem9udGFsKSA6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnNwbGl0VmVydGljYWwpLFxuXHRcdFx0XHR0b29sdGlwOiBvcGVuU2lkZUJ5U2lkZURpcmVjdGlvbiA9PT0gJ3JpZ2h0JyA/XG5cdFx0XHRcdFx0bG9jYWxpemUoeyBrZXk6ICdvcGVuVG9TaWRlJywgY29tbWVudDogWydPcGVuIHRoaXMgZmlsZSBpbiBhIHNwbGl0IGVkaXRvciBvbiB0aGUgbGVmdC9yaWdodCBzaWRlJ10gfSwgXCJPcGVuIHRvIHRoZSBTaWRlXCIpIDpcblx0XHRcdFx0XHRsb2NhbGl6ZSh7IGtleTogJ29wZW5Ub0JvdHRvbScsIGNvbW1lbnQ6IFsnT3BlbiB0aGlzIGZpbGUgaW4gYSBzcGxpdCBlZGl0b3Igb24gdGhlIGJvdHRvbSddIH0sIFwiT3BlbiB0byB0aGUgQm90dG9tXCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gUmVtb3ZlIGZyb20gSGlzdG9yeVxuXHRcdFx0aWYgKGlzRWRpdG9ySGlzdG9yeUVudHJ5KSB7XG5cdFx0XHRcdGJ1dHRvbnMucHVzaCh7XG5cdFx0XHRcdFx0aWNvbkNsYXNzOiBpc0RpcnR5ID8gKCdkaXJ0eS1hbnl0aGluZyAnICsgVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uY2lyY2xlRmlsbGVkKSkgOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5jbG9zZSksXG5cdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2Nsb3NlRWRpdG9yJywgXCJSZW1vdmUgZnJvbSBSZWNlbnRseSBPcGVuZWRcIiksXG5cdFx0XHRcdFx0YWx3YXlzVmlzaWJsZTogaXNEaXJ0eVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGJ1dHRvbnM7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRsYWJlbCxcblx0XHRcdGFyaWFMYWJlbDogaXNEaXJ0eSA/IGxvY2FsaXplKCdmaWxlUGlja0FyaWFMYWJlbERpcnR5JywgXCJ7MH0gdW5zYXZlZCBjaGFuZ2VzXCIsIGxhYmVsQW5kRGVzY3JpcHRpb24pIDogbGFiZWxBbmREZXNjcmlwdGlvbixcblx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0Z2V0IGljb25DbGFzc2VzKCkgeyByZXR1cm4gaWNvbkNsYXNzZXNWYWx1ZS52YWx1ZTsgfSxcblx0XHRcdGdldCBidXR0b25zKCkgeyByZXR1cm4gYnV0dG9uc1ZhbHVlLnZhbHVlOyB9LFxuXHRcdFx0dHJpZ2dlcjogKGJ1dHRvbkluZGV4LCBrZXlNb2RzKSA9PiB7XG5cdFx0XHRcdHN3aXRjaCAoYnV0dG9uSW5kZXgpIHtcblxuXHRcdFx0XHRcdC8vIE9wZW4gdG8gc2lkZSAvIGJlbG93XG5cdFx0XHRcdFx0Y2FzZSAwOlxuXHRcdFx0XHRcdFx0dGhpcy5vcGVuQW55dGhpbmcocmVzb3VyY2VPckVkaXRvciwgeyBrZXlNb2RzLCByYW5nZTogdGhpcy5waWNrU3RhdGUubGFzdFJhbmdlLCBmb3JjZU9wZW5TaWRlQnlTaWRlOiB0cnVlIH0pO1xuXG5cdFx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5DTE9TRV9QSUNLRVI7XG5cblx0XHRcdFx0XHQvLyBSZW1vdmUgZnJvbSBIaXN0b3J5XG5cdFx0XHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRcdFx0aWYgKCFVUkkuaXNVcmkocmVzb3VyY2VPckVkaXRvcikpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5oaXN0b3J5U2VydmljZS5yZW1vdmVGcm9tSGlzdG9yeShyZXNvdXJjZU9yRWRpdG9yKTtcblxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5SRU1PVkVfSVRFTTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBUcmlnZ2VyQWN0aW9uLk5PX0FDVElPTjtcblx0XHRcdH0sXG5cdFx0XHRhY2NlcHQ6IChrZXlNb2RzLCBldmVudCkgPT4gdGhpcy5vcGVuQW55dGhpbmcocmVzb3VyY2VPckVkaXRvciwgeyBrZXlNb2RzLCByYW5nZTogdGhpcy5waWNrU3RhdGUubGFzdFJhbmdlLCBwcmVzZXJ2ZUZvY3VzOiBldmVudC5pbkJhY2tncm91bmQsIGZvcmNlUGlubmVkOiBldmVudC5pbkJhY2tncm91bmQgfSlcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuQW55dGhpbmcocmVzb3VyY2VPckVkaXRvcjogVVJJIHwgRWRpdG9ySW5wdXQgfCBJUmVzb3VyY2VFZGl0b3JJbnB1dCwgb3B0aW9uczogeyBrZXlNb2RzPzogSUtleU1vZHM7IHByZXNlcnZlRm9jdXM/OiBib29sZWFuOyByYW5nZT86IElSYW5nZTsgZm9yY2VPcGVuU2lkZUJ5U2lkZT86IGJvb2xlYW47IGZvcmNlUGlubmVkPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBDcmFmdCBzb21lIGVkaXRvciBvcHRpb25zIGJhc2VkIG9uIHF1aWNrIGFjY2VzcyB1c2FnZVxuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnM6IElUZXh0RWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdHByZXNlcnZlRm9jdXM6IG9wdGlvbnMucHJlc2VydmVGb2N1cyxcblx0XHRcdHBpbm5lZDogb3B0aW9ucy5rZXlNb2RzPy5jdHJsQ21kIHx8IG9wdGlvbnMuZm9yY2VQaW5uZWQgfHwgdGhpcy5jb25maWd1cmF0aW9uLm9wZW5FZGl0b3JQaW5uZWQsXG5cdFx0XHRzZWxlY3Rpb246IG9wdGlvbnMucmFuZ2UgPyBSYW5nZS5jb2xsYXBzZVRvU3RhcnQob3B0aW9ucy5yYW5nZSkgOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0Y29uc3QgdGFyZ2V0R3JvdXAgPSBvcHRpb25zLmtleU1vZHM/LmFsdCB8fCAodGhpcy5jb25maWd1cmF0aW9uLm9wZW5FZGl0b3JQaW5uZWQgJiYgb3B0aW9ucy5rZXlNb2RzPy5jdHJsQ21kKSB8fCBvcHRpb25zLmZvcmNlT3BlblNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogQUNUSVZFX0dST1VQO1xuXG5cdFx0Ly8gUmVzdG9yZSBhbnkgdmlldyBzdGF0ZSBpZiB0aGUgdGFyZ2V0IGlzIHRoZSBzaWRlIGdyb3VwXG5cdFx0aWYgKHRhcmdldEdyb3VwID09PSBTSURFX0dST1VQKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnBpY2tTdGF0ZS5lZGl0b3JWaWV3U3RhdGUucmVzdG9yZSgpO1xuXHRcdH1cblxuXHRcdC8vIE9wZW4gZWRpdG9yICh0eXBlZClcblx0XHRpZiAoaXNFZGl0b3JJbnB1dChyZXNvdXJjZU9yRWRpdG9yKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IocmVzb3VyY2VPckVkaXRvciwgZWRpdG9yT3B0aW9ucywgdGFyZ2V0R3JvdXApO1xuXHRcdH1cblxuXHRcdC8vIE9wZW4gZWRpdG9yICh1bnR5cGVkKVxuXHRcdGVsc2Uge1xuXHRcdFx0bGV0IHJlc291cmNlRWRpdG9ySW5wdXQ6IElSZXNvdXJjZUVkaXRvcklucHV0O1xuXHRcdFx0aWYgKFVSSS5pc1VyaShyZXNvdXJjZU9yRWRpdG9yKSkge1xuXHRcdFx0XHRyZXNvdXJjZUVkaXRvcklucHV0ID0ge1xuXHRcdFx0XHRcdHJlc291cmNlOiByZXNvdXJjZU9yRWRpdG9yLFxuXHRcdFx0XHRcdG9wdGlvbnM6IGVkaXRvck9wdGlvbnNcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc291cmNlRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRcdFx0Li4ucmVzb3VyY2VPckVkaXRvcixcblx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHQuLi5yZXNvdXJjZU9yRWRpdG9yLm9wdGlvbnMsXG5cdFx0XHRcdFx0XHQuLi5lZGl0b3JPcHRpb25zXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihyZXNvdXJjZUVkaXRvcklucHV0LCB0YXJnZXRHcm91cCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFzQyw2QkFBNkIsNkJBQXFFLHNCQUFzQiwwQkFBK0M7QUFDN00sU0FBaUMsMkJBQTJCLHFCQUErRDtBQUMzSCxTQUFTLGNBQThCLDBCQUEwQixzQkFBd0M7QUFDekcsU0FBbUMsb0JBQW9CO0FBQ3ZELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsa0NBQWtDLDhCQUE2RDtBQUN4RyxTQUFTLHNCQUF1QztBQUNoRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUIsU0FBUywyQkFBMkI7QUFDOUQsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxpQkFBOEIsY0FBYyxtQkFBbUIsa0JBQWtCO0FBQzFGLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNB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
