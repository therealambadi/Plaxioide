import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import * as platform from "../../../../base/common/platform.js";
import { AbstractGotoLineQuickAccessProvider } from "../../../../editor/contrib/quickAccess/browser/gotoLineQuickAccess.js";
import * as nls from "../../../../nls.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { Extensions as QuickAccessExtensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { defaultQuickAccessContextKeyValue } from "../../../browser/quickaccess.js";
import { Extensions as ViewExtensions, ViewContainerLocation } from "../../../common/views.js";
import { GotoSymbolQuickAccessProvider } from "../../codeEditor/browser/quickaccess/gotoSymbolQuickAccess.js";
import { AnythingQuickAccessProvider } from "./anythingQuickAccess.js";
import { registerContributions as replaceContributions } from "./replaceContributions.js";
import { registerContributions as notebookSearchContributions } from "./notebookSearch/notebookSearchContributions.js";
import { searchViewIcon } from "./searchIcons.js";
import { SearchView } from "./searchView.js";
import { registerContributions as searchWidgetContributions } from "./searchWidget.js";
import { SymbolsQuickAccessProvider } from "./symbolsQuickAccess.js";
import { ISearchHistoryService, SearchHistoryService } from "../common/searchHistoryService.js";
import { SearchViewModelWorkbenchService } from "./searchTreeModel/searchModel.js";
import { ISearchViewModelWorkbenchService } from "./searchTreeModel/searchViewModelWorkbenchService.js";
import { SearchSortOrder, SEARCH_EXCLUDE_CONFIG, VIEWLET_ID, ViewMode, VIEW_ID, DEFAULT_MAX_SEARCH_RESULTS } from "../../../services/search/common/search.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { assertType } from "../../../../base/common/types.js";
import { getWorkspaceSymbols } from "../common/search.js";
import * as Constants from "../common/constants.js";
import "./searchActionsCopy.js";
import "./searchActionsFind.js";
import "./searchActionsNav.js";
import "./searchActionsRemoveReplace.js";
import "./searchActionsSymbol.js";
import "./searchActionsTopBar.js";
import "./searchActionsTextQuickAccess.js";
import { TEXT_SEARCH_QUICK_ACCESS_PREFIX, TextSearchQuickAccess } from "./quickTextSearch/textSearchQuickAccess.js";
import { Extensions } from "../../../common/configuration.js";
registerSingleton(ISearchViewModelWorkbenchService, SearchViewModelWorkbenchService, InstantiationType.Delayed);
registerSingleton(ISearchHistoryService, SearchHistoryService, InstantiationType.Delayed);
replaceContributions();
notebookSearchContributions();
searchWidgetContributions();
const SEARCH_MODE_CONFIG = "search.mode";
const viewContainer = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer({
  id: VIEWLET_ID,
  title: nls.localize2("search", "Search"),
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }]),
  hideIfEmpty: true,
  icon: searchViewIcon,
  order: 1
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: true });
const viewDescriptor = {
  id: VIEW_ID,
  containerIcon: searchViewIcon,
  name: nls.localize2("search", "Search"),
  ctorDescriptor: new SyncDescriptor(SearchView),
  canToggleVisibility: false,
  canMoveView: true,
  openCommandActionDescriptor: {
    id: viewContainer.id,
    mnemonicTitle: nls.localize({ key: "miViewSearch", comment: ["&& denotes a mnemonic"] }, "&&Search"),
    keybindings: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF,
      // Yes, this is weird. See #116188, #115556, #115511, and now #124146, for examples of what can go wrong here.
      when: ContextKeyExpr.regex("neverMatch", /doesNotMatch/)
    },
    order: 1
  }
};
Registry.as(ViewExtensions.ViewsRegistry).registerViews([viewDescriptor], viewContainer);
const quickAccessRegistry = Registry.as(QuickAccessExtensions.Quickaccess);
quickAccessRegistry.registerQuickAccessProvider({
  ctor: AnythingQuickAccessProvider,
  prefix: AnythingQuickAccessProvider.PREFIX,
  placeholder: nls.localize("anythingQuickAccessPlaceholder", "Search files by name (append {0} to go to line or {1} to go to symbol)", AbstractGotoLineQuickAccessProvider.PREFIX, GotoSymbolQuickAccessProvider.PREFIX),
  contextKey: defaultQuickAccessContextKeyValue,
  helpEntries: [{
    description: nls.localize("anythingQuickAccess", "Go to File"),
    commandId: "workbench.action.quickOpen",
    commandCenterOrder: 10
  }]
});
quickAccessRegistry.registerQuickAccessProvider({
  ctor: SymbolsQuickAccessProvider,
  prefix: SymbolsQuickAccessProvider.PREFIX,
  placeholder: nls.localize("symbolsQuickAccessPlaceholder", "Type the name of a symbol to open."),
  contextKey: "inWorkspaceSymbolsPicker",
  helpEntries: [{ description: nls.localize("symbolsQuickAccess", "Go to Symbol in Workspace"), commandId: Constants.SearchCommandIds.ShowAllSymbolsActionId }]
});
quickAccessRegistry.registerQuickAccessProvider({
  ctor: TextSearchQuickAccess,
  prefix: TEXT_SEARCH_QUICK_ACCESS_PREFIX,
  contextKey: "inTextSearchPicker",
  placeholder: nls.localize("textSearchPickerPlaceholder", "Search for text in your workspace files."),
  helpEntries: [
    {
      description: nls.localize("textSearchPickerHelp", "Search for Text"),
      commandId: Constants.SearchCommandIds.QuickTextSearchActionId,
      commandCenterOrder: 25
    }
  ]
});
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "search",
  order: 13,
  title: nls.localize("searchConfigurationTitle", "Search"),
  type: "object",
  properties: {
    [SEARCH_EXCLUDE_CONFIG]: {
      type: "object",
      markdownDescription: nls.localize("exclude", "Configure [glob patterns](https://code.visualstudio.com/docs/editor/codebasics#_advanced-search-options) for excluding files and folders in fulltext searches and file search in quick open. To exclude files from the recently opened list in quick open, patterns must be absolute (for example `**/node_modules/**`). Inherits all glob patterns from the `#files.exclude#` setting."),
      default: { "**/node_modules": true, "**/bower_components": true, "**/*.code-search": true },
      additionalProperties: {
        anyOf: [
          {
            type: "boolean",
            description: nls.localize("exclude.boolean", "The glob pattern to match file paths against. Set to true or false to enable or disable the pattern.")
          },
          {
            type: "object",
            properties: {
              when: {
                type: "string",
                // expression ({ "**/*.js": { "when": "$(basename).js" } })
                pattern: "\\w*\\$\\(basename\\)\\w*",
                default: "$(basename).ext",
                markdownDescription: nls.localize({ key: "exclude.when", comment: ["\\$(basename) should not be translated"] }, "Additional check on the siblings of a matching file. Use \\$(basename) as variable for the matching file name.")
              }
            }
          }
        ]
      },
      scope: ConfigurationScope.RESOURCE
    },
    [SEARCH_MODE_CONFIG]: {
      type: "string",
      enum: ["view", "reuseEditor", "newEditor"],
      default: "view",
      markdownDescription: nls.localize("search.mode", "Controls where new `Search: Find in Files` and `Find in Folder` operations occur: either in the search view, or in a search editor."),
      enumDescriptions: [
        nls.localize("search.mode.view", "Search in the search view, either in the panel or side bars."),
        nls.localize("search.mode.reuseEditor", "Search in an existing search editor if present, otherwise in a new search editor."),
        nls.localize("search.mode.newEditor", "Search in a new search editor.")
      ]
    },
    "search.useRipgrep": {
      type: "boolean",
      description: nls.localize("useRipgrep", 'This setting is deprecated and now falls back on "search.usePCRE2".'),
      deprecationMessage: nls.localize("useRipgrepDeprecated", 'Deprecated. Consider "search.usePCRE2" for advanced regex feature support.'),
      default: true
    },
    "search.maintainFileSearchCache": {
      type: "boolean",
      deprecationMessage: nls.localize("maintainFileSearchCacheDeprecated", "The search cache is kept in the extension host which never shuts down, so this setting is no longer needed."),
      description: nls.localize("search.maintainFileSearchCache", "When enabled, the searchService process will be kept alive instead of being shut down after an hour of inactivity. This will keep the file search cache in memory."),
      default: false
    },
    "search.useIgnoreFiles": {
      type: "boolean",
      markdownDescription: nls.localize("useIgnoreFiles", "Controls whether to use `.gitignore` and `.ignore` files when searching for files."),
      default: true,
      scope: ConfigurationScope.RESOURCE
    },
    "search.useGlobalIgnoreFiles": {
      type: "boolean",
      markdownDescription: nls.localize("useGlobalIgnoreFiles", "Controls whether to use your global gitignore file (for example, from `$HOME/.config/git/ignore`) when searching for files. Requires {0} to be enabled.", "`#search.useIgnoreFiles#`"),
      default: false,
      scope: ConfigurationScope.RESOURCE
    },
    "search.useParentIgnoreFiles": {
      type: "boolean",
      markdownDescription: nls.localize("useParentIgnoreFiles", "Controls whether to use `.gitignore` and `.ignore` files in parent directories when searching for files. Requires {0} to be enabled.", "`#search.useIgnoreFiles#`"),
      default: false,
      scope: ConfigurationScope.RESOURCE
    },
    "search.quickOpen.includeSymbols": {
      type: "boolean",
      description: nls.localize("search.quickOpen.includeSymbols", "Whether to include results from a global symbol search in the file results for Quick Open."),
      default: false
    },
    "search.ripgrep.maxThreads": {
      type: "number",
      description: nls.localize("search.ripgrep.maxThreads", "Number of threads to use for searching. When set to 0, the engine automatically determines this value."),
      default: 0
    },
    "search.quickOpen.includeHistory": {
      type: "boolean",
      description: nls.localize("search.quickOpen.includeHistory", "Whether to include results from recently opened files in the file results for Quick Open."),
      default: true
    },
    "search.quickOpen.history.filterSortOrder": {
      type: "string",
      enum: ["default", "recency"],
      default: "default",
      enumDescriptions: [
        nls.localize("filterSortOrder.default", "History entries are sorted by relevance based on the filter value used. More relevant entries appear first."),
        nls.localize("filterSortOrder.recency", "History entries are sorted by recency. More recently opened entries appear first.")
      ],
      description: nls.localize("filterSortOrder", "Controls sorting order of editor history in quick open when filtering.")
    },
    "search.followSymlinks": {
      type: "boolean",
      description: nls.localize("search.followSymlinks", "Controls whether to follow symlinks while searching."),
      default: true
    },
    "search.smartCase": {
      type: "boolean",
      description: nls.localize("search.smartCase", "Search case-insensitively if the pattern is all lowercase, otherwise, search case-sensitively."),
      default: false
    },
    "search.globalFindClipboard": {
      type: "boolean",
      default: false,
      description: nls.localize("search.globalFindClipboard", "Controls whether the search view should read or modify the shared find clipboard on macOS."),
      included: platform.isMacintosh
    },
    "search.location": {
      type: "string",
      enum: ["sidebar", "panel"],
      default: "sidebar",
      description: nls.localize("search.location", "Controls whether the search will be shown as a view in the sidebar or as a panel in the panel area for more horizontal space."),
      deprecationMessage: nls.localize("search.location.deprecationMessage", "This setting is deprecated. You can drag the search icon to a new location instead.")
    },
    "search.maxResults": {
      type: ["number", "null"],
      default: DEFAULT_MAX_SEARCH_RESULTS,
      markdownDescription: nls.localize("search.maxResults", "Controls the maximum number of search results, this can be set to `null` (empty) to return unlimited results.")
    },
    "search.collapseResults": {
      type: "string",
      enum: ["auto", "alwaysCollapse", "alwaysExpand"],
      enumDescriptions: [
        nls.localize("search.collapseResults.auto", "Files with less than 10 results are expanded. Others are collapsed."),
        "",
        ""
      ],
      default: "alwaysExpand",
      description: nls.localize("search.collapseAllResults", "Controls whether the search results will be collapsed or expanded.")
    },
    "search.useReplacePreview": {
      type: "boolean",
      default: true,
      description: nls.localize("search.useReplacePreview", "Controls whether to open Replace Preview when selecting or replacing a match.")
    },
    "search.showLineNumbers": {
      type: "boolean",
      default: false,
      description: nls.localize("search.showLineNumbers", "Controls whether to show line numbers for search results.")
    },
    "search.usePCRE2": {
      type: "boolean",
      default: false,
      description: nls.localize("search.usePCRE2", "Whether to use the PCRE2 regex engine in text search. This enables using some advanced regex features like lookahead and backreferences. However, not all PCRE2 features are supported - only features that are also supported by JavaScript."),
      deprecationMessage: nls.localize("usePCRE2Deprecated", "Deprecated. PCRE2 will be used automatically when using regex features that are only supported by PCRE2.")
    },
    "search.actionsPosition": {
      type: "string",
      enum: ["auto", "right"],
      enumDescriptions: [
        nls.localize("search.actionsPositionAuto", "Position the actionbar to the right when the search view is narrow, and immediately after the content when the search view is wide."),
        nls.localize("search.actionsPositionRight", "Always position the actionbar to the right.")
      ],
      default: "right",
      description: nls.localize("search.actionsPosition", "Controls the positioning of the actionbar on rows in the search view.")
    },
    "search.searchOnType": {
      type: "boolean",
      default: true,
      description: nls.localize("search.searchOnType", "Search all files as you type.")
    },
    "search.seedWithNearestWord": {
      type: "boolean",
      default: false,
      description: nls.localize("search.seedWithNearestWord", "Enable seeding search from the word nearest the cursor when the active editor has no selection.")
    },
    "search.seedOnFocus": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("search.seedOnFocus", "Update the search query to the editor's selected text when focusing the search view. This happens either on click or when triggering the `workbench.views.search.focus` command.")
    },
    "search.searchOnTypeDebouncePeriod": {
      type: "number",
      default: 300,
      markdownDescription: nls.localize("search.searchOnTypeDebouncePeriod", "When {0} is enabled, controls the timeout in milliseconds between a character being typed and the search starting. Has no effect when {0} is disabled.", "`#search.searchOnType#`")
    },
    "search.searchEditor.doubleClickBehaviour": {
      type: "string",
      enum: ["selectWord", "goToLocation", "openLocationToSide"],
      default: "goToLocation",
      enumDescriptions: [
        nls.localize("search.searchEditor.doubleClickBehaviour.selectWord", "Double-clicking selects the word under the cursor."),
        nls.localize("search.searchEditor.doubleClickBehaviour.goToLocation", "Double-clicking opens the result in the active editor group."),
        nls.localize("search.searchEditor.doubleClickBehaviour.openLocationToSide", "Double-clicking opens the result in the editor group to the side, creating one if it does not yet exist.")
      ],
      markdownDescription: nls.localize("search.searchEditor.doubleClickBehaviour", "Configure effect of double-clicking a result in a search editor.")
    },
    "search.searchEditor.singleClickBehaviour": {
      type: "string",
      enum: ["default", "peekDefinition"],
      default: "default",
      enumDescriptions: [
        nls.localize("search.searchEditor.singleClickBehaviour.default", "Single-clicking does nothing."),
        nls.localize("search.searchEditor.singleClickBehaviour.peekDefinition", "Single-clicking opens a Peek Definition window.")
      ],
      markdownDescription: nls.localize("search.searchEditor.singleClickBehaviour", "Configure effect of single-clicking a result in a search editor.")
    },
    "search.searchEditor.reusePriorSearchConfiguration": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize({ key: "search.searchEditor.reusePriorSearchConfiguration", comment: ['"Search Editor" is a type of editor that can display search results. "includes, excludes, and flags" refers to the "files to include" and "files to exclude" input boxes, and the flags that control whether a query is case-sensitive or a regex.'] }, "When enabled, new Search Editors will reuse the includes, excludes, and flags of the previously opened Search Editor.")
    },
    "search.searchEditor.defaultNumberOfContextLines": {
      type: ["number", "null"],
      default: 1,
      markdownDescription: nls.localize("search.searchEditor.defaultNumberOfContextLines", "The default number of surrounding context lines to use when creating new Search Editors. If using `#search.searchEditor.reusePriorSearchConfiguration#`, this can be set to `null` (empty) to use the prior Search Editor's configuration.")
    },
    "search.searchEditor.focusResultsOnSearch": {
      type: "boolean",
      default: false,
      markdownDescription: nls.localize("search.searchEditor.focusResultsOnSearch", "When a search is triggered, focus the Search Editor results instead of the Search Editor input.")
    },
    "search.sortOrder": {
      type: "string",
      enum: [SearchSortOrder.Default, SearchSortOrder.FileNames, SearchSortOrder.Type, SearchSortOrder.Modified, SearchSortOrder.CountDescending, SearchSortOrder.CountAscending],
      default: SearchSortOrder.Default,
      enumDescriptions: [
        nls.localize("searchSortOrder.default", "Results are sorted by folder and file names, in alphabetical order."),
        nls.localize("searchSortOrder.filesOnly", "Results are sorted by file names ignoring folder order, in alphabetical order."),
        nls.localize("searchSortOrder.type", "Results are sorted by file extensions, in alphabetical order."),
        nls.localize("searchSortOrder.modified", "Results are sorted by file last modified date, in descending order."),
        nls.localize("searchSortOrder.countDescending", "Results are sorted by count per file, in descending order."),
        nls.localize("searchSortOrder.countAscending", "Results are sorted by count per file, in ascending order.")
      ],
      description: nls.localize("search.sortOrder", "Controls sorting order of search results.")
    },
    "search.decorations.colors": {
      type: "boolean",
      description: nls.localize("search.decorations.colors", "Controls whether search file decorations should use colors."),
      default: true
    },
    "search.decorations.badges": {
      type: "boolean",
      description: nls.localize("search.decorations.badges", "Controls whether search file decorations should use badges."),
      default: true
    },
    "search.defaultViewMode": {
      type: "string",
      enum: [ViewMode.Tree, ViewMode.List],
      default: ViewMode.List,
      enumDescriptions: [
        nls.localize("scm.defaultViewMode.tree", "Shows search results as a tree."),
        nls.localize("scm.defaultViewMode.list", "Shows search results as a list.")
      ],
      description: nls.localize("search.defaultViewMode", "Controls the default search result view mode.")
    },
    "search.quickAccess.preserveInput": {
      type: "boolean",
      description: nls.localize("search.quickAccess.preserveInput", "Controls whether the last typed input to Quick Search should be restored when opening it the next time."),
      default: false
    },
    "search.experimental.closedNotebookRichContentResults": {
      type: "boolean",
      description: nls.localize("search.experimental.closedNotebookResults", "Show notebook editor rich content results for closed notebooks. Please refresh your search results after changing this setting."),
      default: false
    }
  }
});
CommandsRegistry.registerCommand("_executeWorkspaceSymbolProvider", async function(accessor, ...args) {
  const [query] = args;
  assertType(typeof query === "string");
  const result = await getWorkspaceSymbols(query);
  return result.map((item) => item.symbol);
});
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "search.experimental.quickAccess.preserveInput",
  migrateFn: (value, _accessor) => [
    ["search.quickAccess.preserveInput", { value }],
    ["search.experimental.quickAccess.preserveInput", { value: void 0 }]
  ]
}]);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2guY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0ICogYXMgcGxhdGZvcm0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RHb3RvTGluZVF1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9xdWlja0FjY2Vzcy9icm93c2VyL2dvdG9MaW5lUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFF1aWNrQWNjZXNzRXh0ZW5zaW9ucywgSVF1aWNrQWNjZXNzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFF1aWNrQWNjZXNzQ29udGV4dEtleVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9xdWlja2FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yLCBJVmlld3NSZWdpc3RyeSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29kZUVkaXRvci9icm93c2VyL3F1aWNrYWNjZXNzL2dvdG9TeW1ib2xRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuL2FueXRoaW5nUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJDb250cmlidXRpb25zIGFzIHJlcGxhY2VDb250cmlidXRpb25zIH0gZnJvbSAnLi9yZXBsYWNlQ29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbnRyaWJ1dGlvbnMgYXMgbm90ZWJvb2tTZWFyY2hDb250cmlidXRpb25zIH0gZnJvbSAnLi9ub3RlYm9va1NlYXJjaC9ub3RlYm9va1NlYXJjaENvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgc2VhcmNoVmlld0ljb24gfSBmcm9tICcuL3NlYXJjaEljb25zLmpzJztcbmltcG9ydCB7IFNlYXJjaFZpZXcgfSBmcm9tICcuL3NlYXJjaFZpZXcuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJDb250cmlidXRpb25zIGFzIHNlYXJjaFdpZGdldENvbnRyaWJ1dGlvbnMgfSBmcm9tICcuL3NlYXJjaFdpZGdldC5qcyc7XG5pbXBvcnQgeyBTeW1ib2xzUXVpY2tBY2Nlc3NQcm92aWRlciB9IGZyb20gJy4vc3ltYm9sc1F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IElTZWFyY2hIaXN0b3J5U2VydmljZSwgU2VhcmNoSGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2VhcmNoSGlzdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VhcmNoVmlld01vZGVsV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4vc2VhcmNoVHJlZU1vZGVsL3NlYXJjaE1vZGVsLmpzJztcbmltcG9ydCB7IElTZWFyY2hWaWV3TW9kZWxXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVmlld01vZGVsV29ya2JlbmNoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZWFyY2hTb3J0T3JkZXIsIFNFQVJDSF9FWENMVURFX0NPTkZJRywgVklFV0xFVF9JRCwgVmlld01vZGUsIFZJRVdfSUQsIERFRkFVTFRfTUFYX1NFQVJDSF9SRVNVTFRTIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZ2V0V29ya3NwYWNlU3ltYm9scywgSVdvcmtzcGFjZVN5bWJvbCB9IGZyb20gJy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0ICogYXMgQ29uc3RhbnRzIGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgJy4vc2VhcmNoQWN0aW9uc0NvcHkuanMnO1xuaW1wb3J0ICcuL3NlYXJjaEFjdGlvbnNGaW5kLmpzJztcbmltcG9ydCAnLi9zZWFyY2hBY3Rpb25zTmF2LmpzJztcbmltcG9ydCAnLi9zZWFyY2hBY3Rpb25zUmVtb3ZlUmVwbGFjZS5qcyc7XG5pbXBvcnQgJy4vc2VhcmNoQWN0aW9uc1N5bWJvbC5qcyc7XG5pbXBvcnQgJy4vc2VhcmNoQWN0aW9uc1RvcEJhci5qcyc7XG5pbXBvcnQgJy4vc2VhcmNoQWN0aW9uc1RleHRRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBURVhUX1NFQVJDSF9RVUlDS19BQ0NFU1NfUFJFRklYLCBUZXh0U2VhcmNoUXVpY2tBY2Nlc3MgfSBmcm9tICcuL3F1aWNrVGV4dFNlYXJjaC90ZXh0U2VhcmNoUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25NaWdyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcblxucmVnaXN0ZXJTaW5nbGV0b24oSVNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UsIFNlYXJjaFZpZXdNb2RlbFdvcmtiZW5jaFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVNlYXJjaEhpc3RvcnlTZXJ2aWNlLCBTZWFyY2hIaXN0b3J5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5cbnJlcGxhY2VDb250cmlidXRpb25zKCk7XG5ub3RlYm9va1NlYXJjaENvbnRyaWJ1dGlvbnMoKTtcbnNlYXJjaFdpZGdldENvbnRyaWJ1dGlvbnMoKTtcblxuY29uc3QgU0VBUkNIX01PREVfQ09ORklHID0gJ3NlYXJjaC5tb2RlJztcblxuY29uc3Qgdmlld0NvbnRhaW5lciA9IFJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdDb250YWluZXIoe1xuXHRpZDogVklFV0xFVF9JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3NlYXJjaCcsIFwiU2VhcmNoXCIpLFxuXHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFZpZXdQYW5lQ29udGFpbmVyLCBbVklFV0xFVF9JRCwgeyBtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUgfV0pLFxuXHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0aWNvbjogc2VhcmNoVmlld0ljb24sXG5cdG9yZGVyOiAxLFxufSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIHsgZG9Ob3RSZWdpc3Rlck9wZW5Db21tYW5kOiB0cnVlIH0pO1xuXG5jb25zdCB2aWV3RGVzY3JpcHRvcjogSVZpZXdEZXNjcmlwdG9yID0ge1xuXHRpZDogVklFV19JRCxcblx0Y29udGFpbmVySWNvbjogc2VhcmNoVmlld0ljb24sXG5cdG5hbWU6IG5scy5sb2NhbGl6ZTIoJ3NlYXJjaCcsIFwiU2VhcmNoXCIpLFxuXHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFNlYXJjaFZpZXcpLFxuXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiBmYWxzZSxcblx0Y2FuTW92ZVZpZXc6IHRydWUsXG5cdG9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvcjoge1xuXHRcdGlkOiB2aWV3Q29udGFpbmVyLmlkLFxuXHRcdG1uZW1vbmljVGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pVmlld1NlYXJjaCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlNlYXJjaFwiKSxcblx0XHRrZXliaW5kaW5nczoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUYsXG5cdFx0XHQvLyBZZXMsIHRoaXMgaXMgd2VpcmQuIFNlZSAjMTE2MTg4LCAjMTE1NTU2LCAjMTE1NTExLCBhbmQgbm93ICMxMjQxNDYsIGZvciBleGFtcGxlcyBvZiB3aGF0IGNhbiBnbyB3cm9uZyBoZXJlLlxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIucmVnZXgoJ25ldmVyTWF0Y2gnLCAvZG9lc05vdE1hdGNoLylcblx0XHR9LFxuXHRcdG9yZGVyOiAxXG5cdH1cbn07XG5cbi8vIFJlZ2lzdGVyIHNlYXJjaCBkZWZhdWx0IGxvY2F0aW9uIHRvIHNpZGViYXJcblJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKFt2aWV3RGVzY3JpcHRvcl0sIHZpZXdDb250YWluZXIpO1xuXG4vLyBSZWdpc3RlciBRdWljayBBY2Nlc3MgSGFuZGxlclxuY29uc3QgcXVpY2tBY2Nlc3NSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElRdWlja0FjY2Vzc1JlZ2lzdHJ5PihRdWlja0FjY2Vzc0V4dGVuc2lvbnMuUXVpY2thY2Nlc3MpO1xuXG5xdWlja0FjY2Vzc1JlZ2lzdHJ5LnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlcixcblx0cHJlZml4OiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLFxuXHRwbGFjZWhvbGRlcjogbmxzLmxvY2FsaXplKCdhbnl0aGluZ1F1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlNlYXJjaCBmaWxlcyBieSBuYW1lIChhcHBlbmQgezB9IHRvIGdvIHRvIGxpbmUgb3IgezF9IHRvIGdvIHRvIHN5bWJvbClcIiwgQWJzdHJhY3RHb3RvTGluZVF1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLCBHb3RvU3ltYm9sUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgpLFxuXHRjb250ZXh0S2V5OiBkZWZhdWx0UXVpY2tBY2Nlc3NDb250ZXh0S2V5VmFsdWUsXG5cdGhlbHBFbnRyaWVzOiBbe1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2FueXRoaW5nUXVpY2tBY2Nlc3MnLCBcIkdvIHRvIEZpbGVcIiksXG5cdFx0Y29tbWFuZElkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWlja09wZW4nLFxuXHRcdGNvbW1hbmRDZW50ZXJPcmRlcjogMTBcblx0fV1cbn0pO1xuXG5xdWlja0FjY2Vzc1JlZ2lzdHJ5LnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IFN5bWJvbHNRdWlja0FjY2Vzc1Byb3ZpZGVyLFxuXHRwcmVmaXg6IFN5bWJvbHNRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgnc3ltYm9sc1F1aWNrQWNjZXNzUGxhY2Vob2xkZXInLCBcIlR5cGUgdGhlIG5hbWUgb2YgYSBzeW1ib2wgdG8gb3Blbi5cIiksXG5cdGNvbnRleHRLZXk6ICdpbldvcmtzcGFjZVN5bWJvbHNQaWNrZXInLFxuXHRoZWxwRW50cmllczogW3sgZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc3ltYm9sc1F1aWNrQWNjZXNzJywgXCJHbyB0byBTeW1ib2wgaW4gV29ya3NwYWNlXCIpLCBjb21tYW5kSWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlNob3dBbGxTeW1ib2xzQWN0aW9uSWQgfV1cbn0pO1xuXG5xdWlja0FjY2Vzc1JlZ2lzdHJ5LnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IFRleHRTZWFyY2hRdWlja0FjY2Vzcyxcblx0cHJlZml4OiBURVhUX1NFQVJDSF9RVUlDS19BQ0NFU1NfUFJFRklYLFxuXHRjb250ZXh0S2V5OiAnaW5UZXh0U2VhcmNoUGlja2VyJyxcblx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgndGV4dFNlYXJjaFBpY2tlclBsYWNlaG9sZGVyJywgXCJTZWFyY2ggZm9yIHRleHQgaW4geW91ciB3b3Jrc3BhY2UgZmlsZXMuXCIpLFxuXHRoZWxwRW50cmllczogW1xuXHRcdHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3RleHRTZWFyY2hQaWNrZXJIZWxwJywgXCJTZWFyY2ggZm9yIFRleHRcIiksXG5cdFx0XHRjb21tYW5kSWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlF1aWNrVGV4dFNlYXJjaEFjdGlvbklkLFxuXHRcdFx0Y29tbWFuZENlbnRlck9yZGVyOiAyNSxcblx0XHR9XG5cdF1cbn0pO1xuXG4vLyBDb25maWd1cmF0aW9uXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ3NlYXJjaCcsXG5cdG9yZGVyOiAxMyxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2VhcmNoQ29uZmlndXJhdGlvblRpdGxlJywgXCJTZWFyY2hcIiksXG5cdHR5cGU6ICdvYmplY3QnLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0W1NFQVJDSF9FWENMVURFX0NPTkZJR106IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleGNsdWRlJywgXCJDb25maWd1cmUgW2dsb2IgcGF0dGVybnNdKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3MvZWRpdG9yL2NvZGViYXNpY3MjX2FkdmFuY2VkLXNlYXJjaC1vcHRpb25zKSBmb3IgZXhjbHVkaW5nIGZpbGVzIGFuZCBmb2xkZXJzIGluIGZ1bGx0ZXh0IHNlYXJjaGVzIGFuZCBmaWxlIHNlYXJjaCBpbiBxdWljayBvcGVuLiBUbyBleGNsdWRlIGZpbGVzIGZyb20gdGhlIHJlY2VudGx5IG9wZW5lZCBsaXN0IGluIHF1aWNrIG9wZW4sIHBhdHRlcm5zIG11c3QgYmUgYWJzb2x1dGUgKGZvciBleGFtcGxlIGAqKi9ub2RlX21vZHVsZXMvKipgKS4gSW5oZXJpdHMgYWxsIGdsb2IgcGF0dGVybnMgZnJvbSB0aGUgYCNmaWxlcy5leGNsdWRlI2Agc2V0dGluZy5cIiksXG5cdFx0XHRkZWZhdWx0OiB7ICcqKi9ub2RlX21vZHVsZXMnOiB0cnVlLCAnKiovYm93ZXJfY29tcG9uZW50cyc6IHRydWUsICcqKi8qLmNvZGUtc2VhcmNoJzogdHJ1ZSB9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleGNsdWRlLmJvb2xlYW4nLCBcIlRoZSBnbG9iIHBhdHRlcm4gdG8gbWF0Y2ggZmlsZSBwYXRocyBhZ2FpbnN0LiBTZXQgdG8gdHJ1ZSBvciBmYWxzZSB0byBlbmFibGUgb3IgZGlzYWJsZSB0aGUgcGF0dGVybi5cIiksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0d2hlbjoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLCAvLyBleHByZXNzaW9uICh7IFwiKiovKi5qc1wiOiB7IFwid2hlblwiOiBcIiQoYmFzZW5hbWUpLmpzXCIgfSB9KVxuXHRcdFx0XHRcdFx0XHRcdHBhdHRlcm46ICdcXFxcdypcXFxcJFxcXFwoYmFzZW5hbWVcXFxcKVxcXFx3KicsXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJyQoYmFzZW5hbWUpLmV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKHsga2V5OiAnZXhjbHVkZS53aGVuJywgY29tbWVudDogWydcXFxcJChiYXNlbmFtZSkgc2hvdWxkIG5vdCBiZSB0cmFuc2xhdGVkJ10gfSwgJ0FkZGl0aW9uYWwgY2hlY2sgb24gdGhlIHNpYmxpbmdzIG9mIGEgbWF0Y2hpbmcgZmlsZS4gVXNlIFxcXFwkKGJhc2VuYW1lKSBhcyB2YXJpYWJsZSBmb3IgdGhlIG1hdGNoaW5nIGZpbGUgbmFtZS4nKVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9LFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdH0sXG5cdFx0W1NFQVJDSF9NT0RFX0NPTkZJR106IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWyd2aWV3JywgJ3JldXNlRWRpdG9yJywgJ25ld0VkaXRvciddLFxuXHRcdFx0ZGVmYXVsdDogJ3ZpZXcnLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2gubW9kZScsIFwiQ29udHJvbHMgd2hlcmUgbmV3IGBTZWFyY2g6IEZpbmQgaW4gRmlsZXNgIGFuZCBgRmluZCBpbiBGb2xkZXJgIG9wZXJhdGlvbnMgb2NjdXI6IGVpdGhlciBpbiB0aGUgc2VhcmNoIHZpZXcsIG9yIGluIGEgc2VhcmNoIGVkaXRvci5cIiksXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoLm1vZGUudmlldycsIFwiU2VhcmNoIGluIHRoZSBzZWFyY2ggdmlldywgZWl0aGVyIGluIHRoZSBwYW5lbCBvciBzaWRlIGJhcnMuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaC5tb2RlLnJldXNlRWRpdG9yJywgXCJTZWFyY2ggaW4gYW4gZXhpc3Rpbmcgc2VhcmNoIGVkaXRvciBpZiBwcmVzZW50LCBvdGhlcndpc2UgaW4gYSBuZXcgc2VhcmNoIGVkaXRvci5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoLm1vZGUubmV3RWRpdG9yJywgXCJTZWFyY2ggaW4gYSBuZXcgc2VhcmNoIGVkaXRvci5cIiksXG5cdFx0XHRdXG5cdFx0fSxcblx0XHQnc2VhcmNoLnVzZVJpcGdyZXAnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1c2VSaXBncmVwJywgXCJUaGlzIHNldHRpbmcgaXMgZGVwcmVjYXRlZCBhbmQgbm93IGZhbGxzIGJhY2sgb24gXFxcInNlYXJjaC51c2VQQ1JFMlxcXCIuXCIpLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ3VzZVJpcGdyZXBEZXByZWNhdGVkJywgXCJEZXByZWNhdGVkLiBDb25zaWRlciBcXFwic2VhcmNoLnVzZVBDUkUyXFxcIiBmb3IgYWR2YW5jZWQgcmVnZXggZmVhdHVyZSBzdXBwb3J0LlwiKSxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdCdzZWFyY2gubWFpbnRhaW5GaWxlU2VhcmNoQ2FjaGUnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnbWFpbnRhaW5GaWxlU2VhcmNoQ2FjaGVEZXByZWNhdGVkJywgXCJUaGUgc2VhcmNoIGNhY2hlIGlzIGtlcHQgaW4gdGhlIGV4dGVuc2lvbiBob3N0IHdoaWNoIG5ldmVyIHNodXRzIGRvd24sIHNvIHRoaXMgc2V0dGluZyBpcyBubyBsb25nZXIgbmVlZGVkLlwiKSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5tYWludGFpbkZpbGVTZWFyY2hDYWNoZScsIFwiV2hlbiBlbmFibGVkLCB0aGUgc2VhcmNoU2VydmljZSBwcm9jZXNzIHdpbGwgYmUga2VwdCBhbGl2ZSBpbnN0ZWFkIG9mIGJlaW5nIHNodXQgZG93biBhZnRlciBhbiBob3VyIG9mIGluYWN0aXZpdHkuIFRoaXMgd2lsbCBrZWVwIHRoZSBmaWxlIHNlYXJjaCBjYWNoZSBpbiBtZW1vcnkuXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdCdzZWFyY2gudXNlSWdub3JlRmlsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VzZUlnbm9yZUZpbGVzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHVzZSBgLmdpdGlnbm9yZWAgYW5kIGAuaWdub3JlYCBmaWxlcyB3aGVuIHNlYXJjaGluZyBmb3IgZmlsZXMuXCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0Vcblx0XHR9LFxuXHRcdCdzZWFyY2gudXNlR2xvYmFsSWdub3JlRmlsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VzZUdsb2JhbElnbm9yZUZpbGVzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHVzZSB5b3VyIGdsb2JhbCBnaXRpZ25vcmUgZmlsZSAoZm9yIGV4YW1wbGUsIGZyb20gYCRIT01FLy5jb25maWcvZ2l0L2lnbm9yZWApIHdoZW4gc2VhcmNoaW5nIGZvciBmaWxlcy4gUmVxdWlyZXMgezB9IHRvIGJlIGVuYWJsZWQuXCIsICdgI3NlYXJjaC51c2VJZ25vcmVGaWxlcyNgJyksXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0Vcblx0XHR9LFxuXHRcdCdzZWFyY2gudXNlUGFyZW50SWdub3JlRmlsZXMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3VzZVBhcmVudElnbm9yZUZpbGVzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHVzZSBgLmdpdGlnbm9yZWAgYW5kIGAuaWdub3JlYCBmaWxlcyBpbiBwYXJlbnQgZGlyZWN0b3JpZXMgd2hlbiBzZWFyY2hpbmcgZm9yIGZpbGVzLiBSZXF1aXJlcyB7MH0gdG8gYmUgZW5hYmxlZC5cIiwgJ2Ajc2VhcmNoLnVzZUlnbm9yZUZpbGVzI2AnKSxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5xdWlja09wZW4uaW5jbHVkZVN5bWJvbHMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2gucXVpY2tPcGVuLmluY2x1ZGVTeW1ib2xzJywgXCJXaGV0aGVyIHRvIGluY2x1ZGUgcmVzdWx0cyBmcm9tIGEgZ2xvYmFsIHN5bWJvbCBzZWFyY2ggaW4gdGhlIGZpbGUgcmVzdWx0cyBmb3IgUXVpY2sgT3Blbi5cIiksXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5yaXBncmVwLm1heFRocmVhZHMnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5yaXBncmVwLm1heFRocmVhZHMnLCBcIk51bWJlciBvZiB0aHJlYWRzIHRvIHVzZSBmb3Igc2VhcmNoaW5nLiBXaGVuIHNldCB0byAwLCB0aGUgZW5naW5lIGF1dG9tYXRpY2FsbHkgZGV0ZXJtaW5lcyB0aGlzIHZhbHVlLlwiKSxcblx0XHRcdGRlZmF1bHQ6IDBcblx0XHR9LFxuXHRcdCdzZWFyY2gucXVpY2tPcGVuLmluY2x1ZGVIaXN0b3J5Jzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnF1aWNrT3Blbi5pbmNsdWRlSGlzdG9yeScsIFwiV2hldGhlciB0byBpbmNsdWRlIHJlc3VsdHMgZnJvbSByZWNlbnRseSBvcGVuZWQgZmlsZXMgaW4gdGhlIGZpbGUgcmVzdWx0cyBmb3IgUXVpY2sgT3Blbi5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHQnc2VhcmNoLnF1aWNrT3Blbi5oaXN0b3J5LmZpbHRlclNvcnRPcmRlcic6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydkZWZhdWx0JywgJ3JlY2VuY3knXSxcblx0XHRcdGRlZmF1bHQ6ICdkZWZhdWx0Jyxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdmaWx0ZXJTb3J0T3JkZXIuZGVmYXVsdCcsICdIaXN0b3J5IGVudHJpZXMgYXJlIHNvcnRlZCBieSByZWxldmFuY2UgYmFzZWQgb24gdGhlIGZpbHRlciB2YWx1ZSB1c2VkLiBNb3JlIHJlbGV2YW50IGVudHJpZXMgYXBwZWFyIGZpcnN0LicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2ZpbHRlclNvcnRPcmRlci5yZWNlbmN5JywgJ0hpc3RvcnkgZW50cmllcyBhcmUgc29ydGVkIGJ5IHJlY2VuY3kuIE1vcmUgcmVjZW50bHkgb3BlbmVkIGVudHJpZXMgYXBwZWFyIGZpcnN0LicpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmlsdGVyU29ydE9yZGVyJywgXCJDb250cm9scyBzb3J0aW5nIG9yZGVyIG9mIGVkaXRvciBoaXN0b3J5IGluIHF1aWNrIG9wZW4gd2hlbiBmaWx0ZXJpbmcuXCIpXG5cdFx0fSxcblx0XHQnc2VhcmNoLmZvbGxvd1N5bWxpbmtzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLmZvbGxvd1N5bWxpbmtzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIGZvbGxvdyBzeW1saW5rcyB3aGlsZSBzZWFyY2hpbmcuXCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5zbWFydENhc2UnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2guc21hcnRDYXNlJywgXCJTZWFyY2ggY2FzZS1pbnNlbnNpdGl2ZWx5IGlmIHRoZSBwYXR0ZXJuIGlzIGFsbCBsb3dlcmNhc2UsIG90aGVyd2lzZSwgc2VhcmNoIGNhc2Utc2Vuc2l0aXZlbHkuXCIpLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdCdzZWFyY2guZ2xvYmFsRmluZENsaXBib2FyZCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLmdsb2JhbEZpbmRDbGlwYm9hcmQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHNlYXJjaCB2aWV3IHNob3VsZCByZWFkIG9yIG1vZGlmeSB0aGUgc2hhcmVkIGZpbmQgY2xpcGJvYXJkIG9uIG1hY09TLlwiKSxcblx0XHRcdGluY2x1ZGVkOiBwbGF0Zm9ybS5pc01hY2ludG9zaFxuXHRcdH0sXG5cdFx0J3NlYXJjaC5sb2NhdGlvbic6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydzaWRlYmFyJywgJ3BhbmVsJ10sXG5cdFx0XHRkZWZhdWx0OiAnc2lkZWJhcicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2gubG9jYXRpb24nLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHNlYXJjaCB3aWxsIGJlIHNob3duIGFzIGEgdmlldyBpbiB0aGUgc2lkZWJhciBvciBhcyBhIHBhbmVsIGluIHRoZSBwYW5lbCBhcmVhIGZvciBtb3JlIGhvcml6b250YWwgc3BhY2UuXCIpLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBubHMubG9jYWxpemUoJ3NlYXJjaC5sb2NhdGlvbi5kZXByZWNhdGlvbk1lc3NhZ2UnLCBcIlRoaXMgc2V0dGluZyBpcyBkZXByZWNhdGVkLiBZb3UgY2FuIGRyYWcgdGhlIHNlYXJjaCBpY29uIHRvIGEgbmV3IGxvY2F0aW9uIGluc3RlYWQuXCIpXG5cdFx0fSxcblx0XHQnc2VhcmNoLm1heFJlc3VsdHMnOiB7XG5cdFx0XHR0eXBlOiBbJ251bWJlcicsICdudWxsJ10sXG5cdFx0XHRkZWZhdWx0OiBERUZBVUxUX01BWF9TRUFSQ0hfUkVTVUxUUyxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLm1heFJlc3VsdHMnLCBcIkNvbnRyb2xzIHRoZSBtYXhpbXVtIG51bWJlciBvZiBzZWFyY2ggcmVzdWx0cywgdGhpcyBjYW4gYmUgc2V0IHRvIGBudWxsYCAoZW1wdHkpIHRvIHJldHVybiB1bmxpbWl0ZWQgcmVzdWx0cy5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guY29sbGFwc2VSZXN1bHRzJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2F1dG8nLCAnYWx3YXlzQ29sbGFwc2UnLCAnYWx3YXlzRXhwYW5kJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoLmNvbGxhcHNlUmVzdWx0cy5hdXRvJywgXCJGaWxlcyB3aXRoIGxlc3MgdGhhbiAxMCByZXN1bHRzIGFyZSBleHBhbmRlZC4gT3RoZXJzIGFyZSBjb2xsYXBzZWQuXCIpLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnYWx3YXlzRXhwYW5kJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5jb2xsYXBzZUFsbFJlc3VsdHMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHNlYXJjaCByZXN1bHRzIHdpbGwgYmUgY29sbGFwc2VkIG9yIGV4cGFuZGVkLlwiKSxcblx0XHR9LFxuXHRcdCdzZWFyY2gudXNlUmVwbGFjZVByZXZpZXcnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnVzZVJlcGxhY2VQcmV2aWV3JywgXCJDb250cm9scyB3aGV0aGVyIHRvIG9wZW4gUmVwbGFjZSBQcmV2aWV3IHdoZW4gc2VsZWN0aW5nIG9yIHJlcGxhY2luZyBhIG1hdGNoLlwiKSxcblx0XHR9LFxuXHRcdCdzZWFyY2guc2hvd0xpbmVOdW1iZXJzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2guc2hvd0xpbmVOdW1iZXJzJywgXCJDb250cm9scyB3aGV0aGVyIHRvIHNob3cgbGluZSBudW1iZXJzIGZvciBzZWFyY2ggcmVzdWx0cy5cIiksXG5cdFx0fSxcblx0XHQnc2VhcmNoLnVzZVBDUkUyJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2gudXNlUENSRTInLCBcIldoZXRoZXIgdG8gdXNlIHRoZSBQQ1JFMiByZWdleCBlbmdpbmUgaW4gdGV4dCBzZWFyY2guIFRoaXMgZW5hYmxlcyB1c2luZyBzb21lIGFkdmFuY2VkIHJlZ2V4IGZlYXR1cmVzIGxpa2UgbG9va2FoZWFkIGFuZCBiYWNrcmVmZXJlbmNlcy4gSG93ZXZlciwgbm90IGFsbCBQQ1JFMiBmZWF0dXJlcyBhcmUgc3VwcG9ydGVkIC0gb25seSBmZWF0dXJlcyB0aGF0IGFyZSBhbHNvIHN1cHBvcnRlZCBieSBKYXZhU2NyaXB0LlwiKSxcblx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCd1c2VQQ1JFMkRlcHJlY2F0ZWQnLCBcIkRlcHJlY2F0ZWQuIFBDUkUyIHdpbGwgYmUgdXNlZCBhdXRvbWF0aWNhbGx5IHdoZW4gdXNpbmcgcmVnZXggZmVhdHVyZXMgdGhhdCBhcmUgb25seSBzdXBwb3J0ZWQgYnkgUENSRTIuXCIpLFxuXHRcdH0sXG5cdFx0J3NlYXJjaC5hY3Rpb25zUG9zaXRpb24nOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYXV0bycsICdyaWdodCddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaC5hY3Rpb25zUG9zaXRpb25BdXRvJywgXCJQb3NpdGlvbiB0aGUgYWN0aW9uYmFyIHRvIHRoZSByaWdodCB3aGVuIHRoZSBzZWFyY2ggdmlldyBpcyBuYXJyb3csIGFuZCBpbW1lZGlhdGVseSBhZnRlciB0aGUgY29udGVudCB3aGVuIHRoZSBzZWFyY2ggdmlldyBpcyB3aWRlLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzZWFyY2guYWN0aW9uc1Bvc2l0aW9uUmlnaHQnLCBcIkFsd2F5cyBwb3NpdGlvbiB0aGUgYWN0aW9uYmFyIHRvIHRoZSByaWdodC5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ3JpZ2h0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5hY3Rpb25zUG9zaXRpb24nLCBcIkNvbnRyb2xzIHRoZSBwb3NpdGlvbmluZyBvZiB0aGUgYWN0aW9uYmFyIG9uIHJvd3MgaW4gdGhlIHNlYXJjaCB2aWV3LlwiKVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5zZWFyY2hPblR5cGUnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNlYXJjaE9uVHlwZScsIFwiU2VhcmNoIGFsbCBmaWxlcyBhcyB5b3UgdHlwZS5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VlZFdpdGhOZWFyZXN0V29yZCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNlZWRXaXRoTmVhcmVzdFdvcmQnLCBcIkVuYWJsZSBzZWVkaW5nIHNlYXJjaCBmcm9tIHRoZSB3b3JkIG5lYXJlc3QgdGhlIGN1cnNvciB3aGVuIHRoZSBhY3RpdmUgZWRpdG9yIGhhcyBubyBzZWxlY3Rpb24uXCIpXG5cdFx0fSxcblx0XHQnc2VhcmNoLnNlZWRPbkZvY3VzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5zZWVkT25Gb2N1cycsIFwiVXBkYXRlIHRoZSBzZWFyY2ggcXVlcnkgdG8gdGhlIGVkaXRvcidzIHNlbGVjdGVkIHRleHQgd2hlbiBmb2N1c2luZyB0aGUgc2VhcmNoIHZpZXcuIFRoaXMgaGFwcGVucyBlaXRoZXIgb24gY2xpY2sgb3Igd2hlbiB0cmlnZ2VyaW5nIHRoZSBgd29ya2JlbmNoLnZpZXdzLnNlYXJjaC5mb2N1c2AgY29tbWFuZC5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoT25UeXBlRGVib3VuY2VQZXJpb2QnOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDMwMCxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNlYXJjaE9uVHlwZURlYm91bmNlUGVyaW9kJywgXCJXaGVuIHswfSBpcyBlbmFibGVkLCBjb250cm9scyB0aGUgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgYmV0d2VlbiBhIGNoYXJhY3RlciBiZWluZyB0eXBlZCBhbmQgdGhlIHNlYXJjaCBzdGFydGluZy4gSGFzIG5vIGVmZmVjdCB3aGVuIHswfSBpcyBkaXNhYmxlZC5cIiwgJ2Ajc2VhcmNoLnNlYXJjaE9uVHlwZSNgJylcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoRWRpdG9yLmRvdWJsZUNsaWNrQmVoYXZpb3VyJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3NlbGVjdFdvcmQnLCAnZ29Ub0xvY2F0aW9uJywgJ29wZW5Mb2NhdGlvblRvU2lkZSddLFxuXHRcdFx0ZGVmYXVsdDogJ2dvVG9Mb2NhdGlvbicsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNlYXJjaEVkaXRvci5kb3VibGVDbGlja0JlaGF2aW91ci5zZWxlY3RXb3JkJywgXCJEb3VibGUtY2xpY2tpbmcgc2VsZWN0cyB0aGUgd29yZCB1bmRlciB0aGUgY3Vyc29yLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzZWFyY2guc2VhcmNoRWRpdG9yLmRvdWJsZUNsaWNrQmVoYXZpb3VyLmdvVG9Mb2NhdGlvbicsIFwiRG91YmxlLWNsaWNraW5nIG9wZW5zIHRoZSByZXN1bHQgaW4gdGhlIGFjdGl2ZSBlZGl0b3IgZ3JvdXAuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaC5zZWFyY2hFZGl0b3IuZG91YmxlQ2xpY2tCZWhhdmlvdXIub3BlbkxvY2F0aW9uVG9TaWRlJywgXCJEb3VibGUtY2xpY2tpbmcgb3BlbnMgdGhlIHJlc3VsdCBpbiB0aGUgZWRpdG9yIGdyb3VwIHRvIHRoZSBzaWRlLCBjcmVhdGluZyBvbmUgaWYgaXQgZG9lcyBub3QgeWV0IGV4aXN0LlwiKSxcblx0XHRcdF0sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5zZWFyY2hFZGl0b3IuZG91YmxlQ2xpY2tCZWhhdmlvdXInLCBcIkNvbmZpZ3VyZSBlZmZlY3Qgb2YgZG91YmxlLWNsaWNraW5nIGEgcmVzdWx0IGluIGEgc2VhcmNoIGVkaXRvci5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoRWRpdG9yLnNpbmdsZUNsaWNrQmVoYXZpb3VyJzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2RlZmF1bHQnLCAncGVla0RlZmluaXRpb24nLF0sXG5cdFx0XHRkZWZhdWx0OiAnZGVmYXVsdCcsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNlYXJjaEVkaXRvci5zaW5nbGVDbGlja0JlaGF2aW91ci5kZWZhdWx0JywgXCJTaW5nbGUtY2xpY2tpbmcgZG9lcyBub3RoaW5nLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzZWFyY2guc2VhcmNoRWRpdG9yLnNpbmdsZUNsaWNrQmVoYXZpb3VyLnBlZWtEZWZpbml0aW9uJywgXCJTaW5nbGUtY2xpY2tpbmcgb3BlbnMgYSBQZWVrIERlZmluaXRpb24gd2luZG93LlwiKSxcblx0XHRcdF0sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5zZWFyY2hFZGl0b3Iuc2luZ2xlQ2xpY2tCZWhhdmlvdXInLCBcIkNvbmZpZ3VyZSBlZmZlY3Qgb2Ygc2luZ2xlLWNsaWNraW5nIGEgcmVzdWx0IGluIGEgc2VhcmNoIGVkaXRvci5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoRWRpdG9yLnJldXNlUHJpb3JTZWFyY2hDb25maWd1cmF0aW9uJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoeyBrZXk6ICdzZWFyY2guc2VhcmNoRWRpdG9yLnJldXNlUHJpb3JTZWFyY2hDb25maWd1cmF0aW9uJywgY29tbWVudDogWydcIlNlYXJjaCBFZGl0b3JcIiBpcyBhIHR5cGUgb2YgZWRpdG9yIHRoYXQgY2FuIGRpc3BsYXkgc2VhcmNoIHJlc3VsdHMuIFwiaW5jbHVkZXMsIGV4Y2x1ZGVzLCBhbmQgZmxhZ3NcIiByZWZlcnMgdG8gdGhlIFwiZmlsZXMgdG8gaW5jbHVkZVwiIGFuZCBcImZpbGVzIHRvIGV4Y2x1ZGVcIiBpbnB1dCBib3hlcywgYW5kIHRoZSBmbGFncyB0aGF0IGNvbnRyb2wgd2hldGhlciBhIHF1ZXJ5IGlzIGNhc2Utc2Vuc2l0aXZlIG9yIGEgcmVnZXguJ10gfSwgXCJXaGVuIGVuYWJsZWQsIG5ldyBTZWFyY2ggRWRpdG9ycyB3aWxsIHJldXNlIHRoZSBpbmNsdWRlcywgZXhjbHVkZXMsIGFuZCBmbGFncyBvZiB0aGUgcHJldmlvdXNseSBvcGVuZWQgU2VhcmNoIEVkaXRvci5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoRWRpdG9yLmRlZmF1bHROdW1iZXJPZkNvbnRleHRMaW5lcyc6IHtcblx0XHRcdHR5cGU6IFsnbnVtYmVyJywgJ251bGwnXSxcblx0XHRcdGRlZmF1bHQ6IDEsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5zZWFyY2hFZGl0b3IuZGVmYXVsdE51bWJlck9mQ29udGV4dExpbmVzJywgXCJUaGUgZGVmYXVsdCBudW1iZXIgb2Ygc3Vycm91bmRpbmcgY29udGV4dCBsaW5lcyB0byB1c2Ugd2hlbiBjcmVhdGluZyBuZXcgU2VhcmNoIEVkaXRvcnMuIElmIHVzaW5nIGAjc2VhcmNoLnNlYXJjaEVkaXRvci5yZXVzZVByaW9yU2VhcmNoQ29uZmlndXJhdGlvbiNgLCB0aGlzIGNhbiBiZSBzZXQgdG8gYG51bGxgIChlbXB0eSkgdG8gdXNlIHRoZSBwcmlvciBTZWFyY2ggRWRpdG9yJ3MgY29uZmlndXJhdGlvbi5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guc2VhcmNoRWRpdG9yLmZvY3VzUmVzdWx0c09uU2VhcmNoJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5zZWFyY2hFZGl0b3IuZm9jdXNSZXN1bHRzT25TZWFyY2gnLCBcIldoZW4gYSBzZWFyY2ggaXMgdHJpZ2dlcmVkLCBmb2N1cyB0aGUgU2VhcmNoIEVkaXRvciByZXN1bHRzIGluc3RlYWQgb2YgdGhlIFNlYXJjaCBFZGl0b3IgaW5wdXQuXCIpXG5cdFx0fSxcblx0XHQnc2VhcmNoLnNvcnRPcmRlcic6IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogW1NlYXJjaFNvcnRPcmRlci5EZWZhdWx0LCBTZWFyY2hTb3J0T3JkZXIuRmlsZU5hbWVzLCBTZWFyY2hTb3J0T3JkZXIuVHlwZSwgU2VhcmNoU29ydE9yZGVyLk1vZGlmaWVkLCBTZWFyY2hTb3J0T3JkZXIuQ291bnREZXNjZW5kaW5nLCBTZWFyY2hTb3J0T3JkZXIuQ291bnRBc2NlbmRpbmddLFxuXHRcdFx0ZGVmYXVsdDogU2VhcmNoU29ydE9yZGVyLkRlZmF1bHQsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoU29ydE9yZGVyLmRlZmF1bHQnLCBcIlJlc3VsdHMgYXJlIHNvcnRlZCBieSBmb2xkZXIgYW5kIGZpbGUgbmFtZXMsIGluIGFscGhhYmV0aWNhbCBvcmRlci5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2VhcmNoU29ydE9yZGVyLmZpbGVzT25seScsIFwiUmVzdWx0cyBhcmUgc29ydGVkIGJ5IGZpbGUgbmFtZXMgaWdub3JpbmcgZm9sZGVyIG9yZGVyLCBpbiBhbHBoYWJldGljYWwgb3JkZXIuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaFNvcnRPcmRlci50eXBlJywgXCJSZXN1bHRzIGFyZSBzb3J0ZWQgYnkgZmlsZSBleHRlbnNpb25zLCBpbiBhbHBoYWJldGljYWwgb3JkZXIuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaFNvcnRPcmRlci5tb2RpZmllZCcsIFwiUmVzdWx0cyBhcmUgc29ydGVkIGJ5IGZpbGUgbGFzdCBtb2RpZmllZCBkYXRlLCBpbiBkZXNjZW5kaW5nIG9yZGVyLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdzZWFyY2hTb3J0T3JkZXIuY291bnREZXNjZW5kaW5nJywgXCJSZXN1bHRzIGFyZSBzb3J0ZWQgYnkgY291bnQgcGVyIGZpbGUsIGluIGRlc2NlbmRpbmcgb3JkZXIuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NlYXJjaFNvcnRPcmRlci5jb3VudEFzY2VuZGluZycsIFwiUmVzdWx0cyBhcmUgc29ydGVkIGJ5IGNvdW50IHBlciBmaWxlLCBpbiBhc2NlbmRpbmcgb3JkZXIuXCIpXG5cdFx0XHRdLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnNvcnRPcmRlcicsIFwiQ29udHJvbHMgc29ydGluZyBvcmRlciBvZiBzZWFyY2ggcmVzdWx0cy5cIilcblx0XHR9LFxuXHRcdCdzZWFyY2guZGVjb3JhdGlvbnMuY29sb3JzJzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLmRlY29yYXRpb25zLmNvbG9ycycsIFwiQ29udHJvbHMgd2hldGhlciBzZWFyY2ggZmlsZSBkZWNvcmF0aW9ucyBzaG91bGQgdXNlIGNvbG9ycy5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0fSxcblx0XHQnc2VhcmNoLmRlY29yYXRpb25zLmJhZGdlcyc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5kZWNvcmF0aW9ucy5iYWRnZXMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgc2VhcmNoIGZpbGUgZGVjb3JhdGlvbnMgc2hvdWxkIHVzZSBiYWRnZXMuXCIpLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5kZWZhdWx0Vmlld01vZGUnOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFtWaWV3TW9kZS5UcmVlLCBWaWV3TW9kZS5MaXN0XSxcblx0XHRcdGRlZmF1bHQ6IFZpZXdNb2RlLkxpc3QsXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NtLmRlZmF1bHRWaWV3TW9kZS50cmVlJywgXCJTaG93cyBzZWFyY2ggcmVzdWx0cyBhcyBhIHRyZWUuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3NjbS5kZWZhdWx0Vmlld01vZGUubGlzdCcsIFwiU2hvd3Mgc2VhcmNoIHJlc3VsdHMgYXMgYSBsaXN0LlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3NlYXJjaC5kZWZhdWx0Vmlld01vZGUnLCBcIkNvbnRyb2xzIHRoZSBkZWZhdWx0IHNlYXJjaCByZXN1bHQgdmlldyBtb2RlLlwiKVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5xdWlja0FjY2Vzcy5wcmVzZXJ2ZUlucHV0Jzoge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2VhcmNoLnF1aWNrQWNjZXNzLnByZXNlcnZlSW5wdXQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGxhc3QgdHlwZWQgaW5wdXQgdG8gUXVpY2sgU2VhcmNoIHNob3VsZCBiZSByZXN0b3JlZCB3aGVuIG9wZW5pbmcgaXQgdGhlIG5leHQgdGltZS5cIiksXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0J3NlYXJjaC5leHBlcmltZW50YWwuY2xvc2VkTm90ZWJvb2tSaWNoQ29udGVudFJlc3VsdHMnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzZWFyY2guZXhwZXJpbWVudGFsLmNsb3NlZE5vdGVib29rUmVzdWx0cycsIFwiU2hvdyBub3RlYm9vayBlZGl0b3IgcmljaCBjb250ZW50IHJlc3VsdHMgZm9yIGNsb3NlZCBub3RlYm9va3MuIFBsZWFzZSByZWZyZXNoIHlvdXIgc2VhcmNoIHJlc3VsdHMgYWZ0ZXIgY2hhbmdpbmcgdGhpcyBzZXR0aW5nLlwiKSxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ19leGVjdXRlV29ya3NwYWNlU3ltYm9sUHJvdmlkZXInLCBhc3luYyBmdW5jdGlvbiAoYWNjZXNzb3IsIC4uLmFyZ3MpOiBQcm9taXNlPElXb3Jrc3BhY2VTeW1ib2xbXT4ge1xuXHRjb25zdCBbcXVlcnldID0gYXJncztcblx0YXNzZXJ0VHlwZSh0eXBlb2YgcXVlcnkgPT09ICdzdHJpbmcnKTtcblx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZ2V0V29ya3NwYWNlU3ltYm9scyhxdWVyeSk7XG5cdHJldHVybiByZXN1bHQubWFwKGl0ZW0gPT4gaXRlbS5zeW1ib2wpO1xufSk7XG5cbi8vIHRvZG86IEBhbmRyZWFtYWggZ2V0IHJpZCBvZiB0aGlzIGFmdGVyIGEgZmV3IGl0ZXJhdGlvbnNcblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbk1pZ3JhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbk1pZ3JhdGlvbnMoW3tcblx0XHRrZXk6ICdzZWFyY2guZXhwZXJpbWVudGFsLnF1aWNrQWNjZXNzLnByZXNlcnZlSW5wdXQnLFxuXHRcdG1pZ3JhdGVGbjogKHZhbHVlLCBfYWNjZXNzb3IpID0+IChbXG5cdFx0XHRbJ3NlYXJjaC5xdWlja0FjY2Vzcy5wcmVzZXJ2ZUlucHV0JywgeyB2YWx1ZSB9XSxcblx0XHRcdFsnc2VhcmNoLmV4cGVyaW1lbnRhbC5xdWlja0FjY2Vzcy5wcmVzZXJ2ZUlucHV0JywgeyB2YWx1ZTogdW5kZWZpbmVkIH1dXG5cdFx0XSlcblx0fV0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxTQUFTLGNBQWM7QUFDaEMsWUFBWSxjQUFjO0FBQzFCLFNBQVMsMkNBQTJDO0FBQ3BELFlBQVksU0FBUztBQUNyQixTQUFTLG9CQUFvQixjQUFjLCtCQUF1RDtBQUNsRyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyxjQUFjLDZCQUFtRDtBQUMxRSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLGNBQWMsZ0JBQTBFLDZCQUE2QjtBQUM5SCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHlCQUF5Qiw0QkFBNEI7QUFDOUQsU0FBUyx5QkFBeUIsbUNBQW1DO0FBQ3JFLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMseUJBQXlCLGlDQUFpQztBQUNuRSxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHVCQUF1Qiw0QkFBNEI7QUFDNUQsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxpQkFBaUIsdUJBQXVCLFlBQVksVUFBVSxTQUFTLGtDQUFrQztBQUNsSCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDJCQUE2QztBQUN0RCxZQUFZLGVB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
