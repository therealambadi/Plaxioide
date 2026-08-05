import { dirname } from "../../../../base/common/resources.js";
import * as nls from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
import { ViewContainerLocation } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import * as Constants from "../common/constants.js";
import * as SearchEditorConstants from "../../searchEditor/browser/constants.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { resolveResourcesForSearchIncludes } from "../../../services/search/common/queryBuilder.js";
import { getMultiSelectedResources, IExplorerService } from "../../files/browser/files.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ExplorerFolderContext, ExplorerRootContext, FilesExplorerFocusCondition, VIEWLET_ID as VIEWLET_ID_FILES } from "../../files/common/files.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { category, getElementsToOperateOn, getSearchView, openSearchView } from "./searchActionsBase.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { Schemas } from "../../../../base/common/network.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { forcedExpandRecursively } from "./searchActionsTopBar.js";
import { isSearchTreeFileMatch, isSearchTreeMatch } from "./searchTreeModel/searchTreeCommon.js";
registerAction2(class RestrictSearchToFolderAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.RestrictSearchToFolderId,
      title: nls.localize2("restrictResultsToFolder", "Restrict Search to Folder"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ResourceFolderFocusKey),
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF
      },
      menu: [
        {
          id: MenuId.SearchContext,
          group: "search",
          order: 3,
          when: ContextKeyExpr.and(Constants.SearchContext.ResourceFolderFocusKey)
        }
      ]
    });
  }
  async run(accessor, folderMatch) {
    await searchWithFolderCommand(accessor, false, true, void 0, folderMatch);
  }
});
registerAction2(class ExpandSelectedTreeCommandAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ExpandRecursivelyCommandId,
      title: nls.localize("search.expandRecursively", "Expand Recursively"),
      category,
      menu: [{
        id: MenuId.SearchContext,
        when: ContextKeyExpr.and(
          Constants.SearchContext.FolderFocusKey,
          Constants.SearchContext.HasSearchResults
        ),
        group: "search",
        order: 4
      }]
    });
  }
  async run(accessor) {
    return expandSelectSubtree(accessor);
  }
});
registerAction2(class ExcludeFolderFromSearchAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ExcludeFolderFromSearchId,
      title: nls.localize2("excludeFolderFromSearch", "Exclude Folder from Search"),
      category,
      menu: [
        {
          id: MenuId.SearchContext,
          group: "search",
          order: 4,
          when: ContextKeyExpr.and(Constants.SearchContext.ResourceFolderFocusKey)
        }
      ]
    });
  }
  async run(accessor, folderMatch) {
    await searchWithFolderCommand(accessor, false, false, void 0, folderMatch);
  }
});
registerAction2(class RevealInSideBarForSearchResultsAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.RevealInSideBarForSearchResults,
      title: nls.localize2("revealInSideBar", "Reveal in Explorer View"),
      category,
      menu: [{
        id: MenuId.SearchContext,
        when: ContextKeyExpr.and(Constants.SearchContext.FileFocusKey, Constants.SearchContext.HasSearchResults),
        group: "search_3",
        order: 1
      }]
    });
  }
  async run(accessor, args) {
    const paneCompositeService = accessor.get(IPaneCompositePartService);
    const explorerService = accessor.get(IExplorerService);
    const contextService = accessor.get(IWorkspaceContextService);
    const searchView = getSearchView(accessor.get(IViewsService));
    if (!searchView) {
      return;
    }
    let fileMatch;
    if (isSearchTreeFileMatch(args)) {
      fileMatch = args;
    } else {
      args = searchView.getControl().getFocus()[0];
      return;
    }
    paneCompositeService.openPaneComposite(VIEWLET_ID_FILES, ViewContainerLocation.Sidebar, false).then((viewlet) => {
      if (!viewlet) {
        return;
      }
      const explorerViewContainer = viewlet.getViewPaneContainer();
      const uri = fileMatch.resource;
      if (uri && contextService.isInsideWorkspace(uri)) {
        const explorerView = explorerViewContainer.getExplorerView();
        explorerView.setExpanded(true);
        explorerService.select(uri, true).then(() => explorerView.focus(), onUnexpectedError);
      }
    });
  }
});
registerAction2(class FindInFilesAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FindInFilesActionId,
      title: {
        ...nls.localize2("findInFiles", "Find in Files"),
        mnemonicTitle: nls.localize({ key: "miFindInFiles", comment: ["&& denotes a mnemonic"] }, "Find &&in Files")
      },
      metadata: {
        description: nls.localize("findInFiles.description", "Open a workspace search"),
        args: [
          {
            name: nls.localize("findInFiles.args", "A set of options for the search"),
            schema: {
              type: "object",
              properties: {
                query: { "type": "string" },
                replace: { "type": "string" },
                preserveCase: { "type": "boolean" },
                triggerSearch: { "type": "boolean" },
                filesToInclude: { "type": "string" },
                filesToExclude: { "type": "string" },
                isRegex: { "type": "boolean" },
                isCaseSensitive: { "type": "boolean" },
                matchWholeWord: { "type": "boolean" },
                useExcludeSettingsAndIgnoreFiles: { "type": "boolean" },
                onlyOpenEditors: { "type": "boolean" },
                showIncludesExcludes: { "type": "boolean" }
              }
            }
          }
        ]
      },
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF
      },
      menu: [{
        id: MenuId.MenubarEditMenu,
        group: "4_find_global",
        order: 1
      }],
      f1: true
    });
  }
  async run(accessor, args = {}) {
    findInFilesCommand(accessor, args);
  }
});
registerAction2(class FindInFolderAction extends Action2 {
  // from explorer
  constructor() {
    super({
      id: Constants.SearchCommandIds.FindInFolderId,
      title: nls.localize2("findInFolder", "Find in Folder..."),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(FilesExplorerFocusCondition, ExplorerFolderContext),
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF
      },
      menu: [
        {
          id: MenuId.ExplorerContext,
          group: "4_search",
          order: 10,
          when: ContextKeyExpr.and(ExplorerFolderContext)
        }
      ]
    });
  }
  async run(accessor, resource) {
    await searchWithFolderCommand(accessor, true, true, resource);
  }
});
registerAction2(class FindInWorkspaceAction extends Action2 {
  // from explorer
  constructor() {
    super({
      id: Constants.SearchCommandIds.FindInWorkspaceId,
      title: nls.localize2("findInWorkspace", "Find in Workspace..."),
      category,
      menu: [
        {
          id: MenuId.ExplorerContext,
          group: "4_search",
          order: 10,
          when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext.toNegated())
        }
      ]
    });
  }
  async run(accessor) {
    const searchConfig = accessor.get(IConfigurationService).getValue().search;
    const mode = searchConfig.mode;
    if (mode === "view") {
      const searchView = await openSearchView(accessor.get(IViewsService), true);
      searchView?.searchInFolders();
    } else {
      return accessor.get(ICommandService).executeCommand(SearchEditorConstants.OpenEditorCommandId, {
        location: mode === "newEditor" ? "new" : "reuse",
        filesToInclude: ""
      });
    }
  }
});
async function expandSelectSubtree(accessor) {
  const viewsService = accessor.get(IViewsService);
  const searchView = getSearchView(viewsService);
  if (searchView) {
    const viewer = searchView.getControl();
    const selected = viewer.getFocus()[0];
    await forcedExpandRecursively(viewer, selected);
  }
}
async function searchWithFolderCommand(accessor, isFromExplorer, isIncludes, resource, folderMatch) {
  const fileService = accessor.get(IFileService);
  const viewsService = accessor.get(IViewsService);
  const contextService = accessor.get(IWorkspaceContextService);
  const commandService = accessor.get(ICommandService);
  const searchConfig = accessor.get(IConfigurationService).getValue().search;
  const mode = searchConfig.mode;
  let resources;
  if (isFromExplorer) {
    resources = getMultiSelectedResources(resource, accessor.get(IListService), accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IExplorerService));
  } else {
    const searchView = getSearchView(viewsService);
    if (!searchView) {
      return;
    }
    resources = getMultiSelectedSearchResources(searchView.getControl(), folderMatch, searchConfig);
  }
  const resolvedResources = fileService.resolveAll(resources.map((resource2) => ({ resource: resource2 }))).then((results) => {
    const folders = [];
    results.forEach((result) => {
      if (result.success && result.stat) {
        folders.push(result.stat.isDirectory ? result.stat.resource : dirname(result.stat.resource));
      }
    });
    return resolveResourcesForSearchIncludes(folders, contextService);
  });
  if (mode === "view") {
    const searchView = await openSearchView(viewsService, true);
    if (resources && resources.length && searchView) {
      if (isIncludes) {
        searchView.searchInFolders(await resolvedResources);
      } else {
        searchView.searchOutsideOfFolders(await resolvedResources);
      }
    }
    return void 0;
  } else {
    if (isIncludes) {
      return commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, {
        filesToInclude: (await resolvedResources).join(", "),
        showIncludesExcludes: true,
        location: mode === "newEditor" ? "new" : "reuse"
      });
    } else {
      return commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, {
        filesToExclude: (await resolvedResources).join(", "),
        showIncludesExcludes: true,
        location: mode === "newEditor" ? "new" : "reuse"
      });
    }
  }
}
function getMultiSelectedSearchResources(viewer, currElement, sortConfig) {
  return getElementsToOperateOn(viewer, currElement, sortConfig).map((renderableMatch) => isSearchTreeMatch(renderableMatch) ? null : renderableMatch.resource).filter((renderableMatch) => renderableMatch !== null);
}
async function findInFilesCommand(accessor, _args = {}) {
  const searchConfig = accessor.get(IConfigurationService).getValue().search;
  const viewsService = accessor.get(IViewsService);
  const commandService = accessor.get(ICommandService);
  const args = {};
  if (Object.keys(_args).length !== 0) {
    const configurationResolverService = accessor.get(IConfigurationResolverService);
    const historyService = accessor.get(IHistoryService);
    const workspaceContextService = accessor.get(IWorkspaceContextService);
    const activeWorkspaceRootUri = historyService.getLastActiveWorkspaceRoot();
    const filteredActiveWorkspaceRootUri = activeWorkspaceRootUri?.scheme === Schemas.file || activeWorkspaceRootUri?.scheme === Schemas.vscodeRemote ? activeWorkspaceRootUri : void 0;
    const lastActiveWorkspaceRoot = filteredActiveWorkspaceRootUri ? workspaceContextService.getWorkspaceFolder(filteredActiveWorkspaceRootUri) ?? void 0 : void 0;
    for (const entry of Object.entries(_args)) {
      const name = entry[0];
      const value = entry[1];
      if (value !== void 0) {
        args[name] = typeof value === "string" ? await configurationResolverService.resolveAsync(lastActiveWorkspaceRoot, value) : value;
      }
    }
  }
  const mode = searchConfig.mode;
  if (mode === "view") {
    openSearchView(viewsService, false).then((openedView) => {
      if (openedView) {
        const searchAndReplaceWidget = openedView.searchAndReplaceWidget;
        searchAndReplaceWidget.toggleReplace(typeof args.replace === "string");
        let updatedText = false;
        if (typeof args.query !== "string") {
          updatedText = openedView.updateTextFromFindWidgetOrSelection({ allowUnselectedWord: typeof args.replace !== "string" });
        }
        openedView.setSearchParameters(args);
        if (typeof args.showIncludesExcludes === "boolean") {
          openedView.toggleQueryDetails(false, args.showIncludesExcludes);
        }
        openedView.searchAndReplaceWidget.focus(void 0, updatedText, updatedText);
      }
    });
  } else {
    const convertArgs = (args2) => ({
      location: mode === "newEditor" ? "new" : "reuse",
      query: args2.query,
      filesToInclude: args2.filesToInclude,
      filesToExclude: args2.filesToExclude,
      matchWholeWord: args2.matchWholeWord,
      isCaseSensitive: args2.isCaseSensitive,
      isRegexp: args2.isRegex,
      useExcludeSettingsAndIgnoreFiles: args2.useExcludeSettingsAndIgnoreFiles,
      onlyOpenEditors: args2.onlyOpenEditors,
      showIncludesExcludes: !!(args2.filesToExclude || args2.filesToExclude || !args2.useExcludeSettingsAndIgnoreFiles)
    });
    commandService.executeCommand(SearchEditorConstants.OpenEditorCommandId, convertArgs(args));
  }
}
export {
  findInFilesCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hBY3Rpb25zRmluZC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgKiBhcyBDb25zdGFudHMgZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgKiBhcyBTZWFyY2hFZGl0b3JDb25zdGFudHMgZnJvbSAnLi4vLi4vc2VhcmNoRWRpdG9yL2Jyb3dzZXIvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE9wZW5TZWFyY2hFZGl0b3JBcmdzIH0gZnJvbSAnLi4vLi4vc2VhcmNoRWRpdG9yL2Jyb3dzZXIvc2VhcmNoRWRpdG9yLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBJU2VhcmNoQ29uZmlndXJhdGlvbiwgSVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZVJlc291cmNlc0ZvclNlYXJjaEluY2x1ZGVzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9xdWVyeUJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcywgSUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2ZpbGVzL2Jyb3dzZXIvZmlsZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyRm9sZGVyQ29udGV4dCwgRXhwbG9yZXJSb290Q29udGV4dCwgRmlsZXNFeHBsb3JlckZvY3VzQ29uZGl0aW9uLCBWSUVXTEVUX0lEIGFzIFZJRVdMRVRfSURfRklMRVMgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3BhbmVjb21wb3NpdGUvYnJvd3Nlci9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi9maWxlcy9icm93c2VyL2V4cGxvcmVyVmlld2xldC5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBjYXRlZ29yeSwgZ2V0RWxlbWVudHNUb09wZXJhdGVPbiwgZ2V0U2VhcmNoVmlldywgb3BlblNlYXJjaFZpZXcgfSBmcm9tICcuL3NlYXJjaEFjdGlvbnNCYXNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBmb3JjZWRFeHBhbmRSZWN1cnNpdmVseSB9IGZyb20gJy4vc2VhcmNoQWN0aW9uc1RvcEJhci5qcyc7XG5pbXBvcnQgeyBSZW5kZXJhYmxlTWF0Y2gsIElTZWFyY2hUcmVlRmlsZU1hdGNoLCBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlLCBJU2VhcmNoUmVzdWx0LCBpc1NlYXJjaFRyZWVGaWxlTWF0Y2gsIGlzU2VhcmNoVHJlZU1hdGNoIH0gZnJvbSAnLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5cbi8vI3JlZ2lvbiBJbnRlcmZhY2VzXG5leHBvcnQgaW50ZXJmYWNlIElGaW5kSW5GaWxlc0FyZ3Mge1xuXHRxdWVyeT86IHN0cmluZztcblx0cmVwbGFjZT86IHN0cmluZztcblx0cHJlc2VydmVDYXNlPzogYm9vbGVhbjtcblx0dHJpZ2dlclNlYXJjaD86IGJvb2xlYW47XG5cdGZpbGVzVG9JbmNsdWRlPzogc3RyaW5nO1xuXHRmaWxlc1RvRXhjbHVkZT86IHN0cmluZztcblx0aXNSZWdleD86IGJvb2xlYW47XG5cdGlzQ2FzZVNlbnNpdGl2ZT86IGJvb2xlYW47XG5cdG1hdGNoV2hvbGVXb3JkPzogYm9vbGVhbjtcblx0dXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXM/OiBib29sZWFuO1xuXHRvbmx5T3BlbkVkaXRvcnM/OiBib29sZWFuO1xuXHRzaG93SW5jbHVkZXNFeGNsdWRlcz86IGJvb2xlYW47XG59XG4vLyNlbmRyZWdpb25cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJlc3RyaWN0U2VhcmNoVG9Gb2xkZXJBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlJlc3RyaWN0U2VhcmNoVG9Gb2xkZXJJZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdyZXN0cmljdFJlc3VsdHNUb0ZvbGRlcicsIFwiUmVzdHJpY3QgU2VhcmNoIHRvIEZvbGRlclwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXNvdXJjZUZvbGRlckZvY3VzS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5Rixcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRcdFx0Z3JvdXA6ICdzZWFyY2gnLFxuXHRcdFx0XHRcdG9yZGVyOiAzLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXNvdXJjZUZvbGRlckZvY3VzS2V5KVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBmb2xkZXJNYXRjaD86IElTZWFyY2hUcmVlRm9sZGVyTWF0Y2hXaXRoUmVzb3VyY2UpIHtcblx0XHRhd2FpdCBzZWFyY2hXaXRoRm9sZGVyQ29tbWFuZChhY2Nlc3NvciwgZmFsc2UsIHRydWUsIHVuZGVmaW5lZCwgZm9sZGVyTWF0Y2gpO1xuXHR9XG59KTtcblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRXhwYW5kU2VsZWN0ZWRUcmVlQ29tbWFuZEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLkV4cGFuZFJlY3Vyc2l2ZWx5Q29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2VhcmNoLmV4cGFuZFJlY3Vyc2l2ZWx5JywgXCJFeHBhbmQgUmVjdXJzaXZlbHlcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuU2VhcmNoQ29udGV4dCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LFxuXHRcdFx0XHRcdENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lkhhc1NlYXJjaFJlc3VsdHNcblx0XHRcdFx0KSxcblx0XHRcdFx0Z3JvdXA6ICdzZWFyY2gnLFxuXHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogYW55KSB7XG5cdFx0cmV0dXJuIGV4cGFuZFNlbGVjdFN1YnRyZWUoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEV4Y2x1ZGVGb2xkZXJGcm9tU2VhcmNoQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb25zdGFudHMuU2VhcmNoQ29tbWFuZElkcy5FeGNsdWRlRm9sZGVyRnJvbVNlYXJjaElkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2V4Y2x1ZGVGb2xkZXJGcm9tU2VhcmNoJywgXCJFeGNsdWRlIEZvbGRlciBmcm9tIFNlYXJjaFwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TZWFyY2hDb250ZXh0LFxuXHRcdFx0XHRcdGdyb3VwOiAnc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuUmVzb3VyY2VGb2xkZXJGb2N1c0tleSlcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZm9sZGVyTWF0Y2g/OiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlKSB7XG5cdFx0YXdhaXQgc2VhcmNoV2l0aEZvbGRlckNvbW1hbmQoYWNjZXNzb3IsIGZhbHNlLCBmYWxzZSwgdW5kZWZpbmVkLCBmb2xkZXJNYXRjaCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmV2ZWFsSW5TaWRlQmFyRm9yU2VhcmNoUmVzdWx0c0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuUmV2ZWFsSW5TaWRlQmFyRm9yU2VhcmNoUmVzdWx0cyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdyZXZlYWxJblNpZGVCYXInLCBcIlJldmVhbCBpbiBFeHBsb3JlciBWaWV3XCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaWxlRm9jdXNLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lkhhc1NlYXJjaFJlc3VsdHMpLFxuXHRcdFx0XHRncm91cDogJ3NlYXJjaF8zJyxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH1dXG5cdFx0fSk7XG5cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBwYW5lQ29tcG9zaXRlU2VydmljZSA9IGFjY2Vzc29yLmdldChJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlKTtcblx0XHRjb25zdCBleHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4cGxvcmVyU2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0aWYgKCFzZWFyY2hWaWV3KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGZpbGVNYXRjaDogSVNlYXJjaFRyZWVGaWxlTWF0Y2g7XG5cdFx0aWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChhcmdzKSkge1xuXHRcdFx0ZmlsZU1hdGNoID0gYXJncztcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJncyA9IHNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpLmdldEZvY3VzKClbMF07XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cGFuZUNvbXBvc2l0ZVNlcnZpY2Uub3BlblBhbmVDb21wb3NpdGUoVklFV0xFVF9JRF9GSUxFUywgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIsIGZhbHNlKS50aGVuKCh2aWV3bGV0KSA9PiB7XG5cdFx0XHRpZiAoIXZpZXdsZXQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBleHBsb3JlclZpZXdDb250YWluZXIgPSB2aWV3bGV0LmdldFZpZXdQYW5lQ29udGFpbmVyKCkgYXMgRXhwbG9yZXJWaWV3UGFuZUNvbnRhaW5lcjtcblx0XHRcdGNvbnN0IHVyaSA9IGZpbGVNYXRjaC5yZXNvdXJjZTtcblx0XHRcdGlmICh1cmkgJiYgY29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UodXJpKSkge1xuXHRcdFx0XHRjb25zdCBleHBsb3JlclZpZXcgPSBleHBsb3JlclZpZXdDb250YWluZXIuZ2V0RXhwbG9yZXJWaWV3KCk7XG5cdFx0XHRcdGV4cGxvcmVyVmlldy5zZXRFeHBhbmRlZCh0cnVlKTtcblx0XHRcdFx0ZXhwbG9yZXJTZXJ2aWNlLnNlbGVjdCh1cmksIHRydWUpLnRoZW4oKCkgPT4gZXhwbG9yZXJWaWV3LmZvY3VzKCksIG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG5cbi8vIEZpbmQgaW4gRmlsZXMgYnkgZGVmYXVsdCBpcyB0aGUgc2FtZSBhcyBWaWV3OiBTaG93IFNlYXJjaCwgYnV0IGNhbiBiZSBjb25maWd1cmVkIHRvIG9wZW4gYSBzZWFyY2ggZWRpdG9yIGluc3RlYWQgd2l0aCB0aGUgYHNlYXJjaC5tb2RlYCBiaW5kaW5nXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRmluZEluRmlsZXNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLkZpbmRJbkZpbGVzQWN0aW9uSWQsXG5cdFx0XHR0aXRsZToge1xuXHRcdFx0XHQuLi5ubHMubG9jYWxpemUyKCdmaW5kSW5GaWxlcycsIFwiRmluZCBpbiBGaWxlc1wiKSxcblx0XHRcdFx0bW5lbW9uaWNUaXRsZTogbmxzLmxvY2FsaXplKHsga2V5OiAnbWlGaW5kSW5GaWxlcycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJGaW5kICYmaW4gRmlsZXNcIiksXG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZmluZEluRmlsZXMuZGVzY3JpcHRpb24nLCBcIk9wZW4gYSB3b3Jrc3BhY2Ugc2VhcmNoXCIpLFxuXHRcdFx0XHRhcmdzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogbmxzLmxvY2FsaXplKCdmaW5kSW5GaWxlcy5hcmdzJywgXCJBIHNldCBvZiBvcHRpb25zIGZvciB0aGUgc2VhcmNoXCIpLFxuXHRcdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0cXVlcnk6IHsgJ3R5cGUnOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRcdFx0XHRcdHJlcGxhY2U6IHsgJ3R5cGUnOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRcdFx0XHRcdHByZXNlcnZlQ2FzZTogeyAndHlwZSc6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRcdFx0XHRcdHRyaWdnZXJTZWFyY2g6IHsgJ3R5cGUnOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0XHRcdFx0XHRmaWxlc1RvSW5jbHVkZTogeyAndHlwZSc6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdFx0XHRcdFx0ZmlsZXNUb0V4Y2x1ZGU6IHsgJ3R5cGUnOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRcdFx0XHRcdGlzUmVnZXg6IHsgJ3R5cGUnOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0XHRcdFx0XHRpc0Nhc2VTZW5zaXRpdmU6IHsgJ3R5cGUnOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0XHRcdFx0XHRtYXRjaFdob2xlV29yZDogeyAndHlwZSc6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRcdFx0XHRcdHVzZUV4Y2x1ZGVTZXR0aW5nc0FuZElnbm9yZUZpbGVzOiB7ICd0eXBlJzogJ2Jvb2xlYW4nIH0sXG5cdFx0XHRcdFx0XHRcdFx0b25seU9wZW5FZGl0b3JzOiB7ICd0eXBlJzogJ2Jvb2xlYW4nIH0sXG5cdFx0XHRcdFx0XHRcdFx0c2hvd0luY2x1ZGVzRXhjbHVkZXM6IHsgJ3R5cGUnOiAnYm9vbGVhbicgfVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUYsXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRWRpdE1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNF9maW5kX2dsb2JhbCcsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0fV0sXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IElGaW5kSW5GaWxlc0FyZ3MgPSB7fSk6IFByb21pc2U8YW55PiB7XG5cdFx0ZmluZEluRmlsZXNDb21tYW5kKGFjY2Vzc29yLCBhcmdzKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGaW5kSW5Gb2xkZXJBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Ly8gZnJvbSBleHBsb3JlclxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuRmluZEluRm9sZGVySWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignZmluZEluRm9sZGVyJywgXCJGaW5kIGluIEZvbGRlci4uLlwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEZpbGVzRXhwbG9yZXJGb2N1c0NvbmRpdGlvbiwgRXhwbG9yZXJGb2xkZXJDb250ZXh0KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5Rixcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkV4cGxvcmVyQ29udGV4dCxcblx0XHRcdFx0XHRncm91cDogJzRfc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogMTAsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEV4cGxvcmVyRm9sZGVyQ29udGV4dClcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcmVzb3VyY2U/OiBVUkkpIHtcblx0XHRhd2FpdCBzZWFyY2hXaXRoRm9sZGVyQ29tbWFuZChhY2Nlc3NvciwgdHJ1ZSwgdHJ1ZSwgcmVzb3VyY2UpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZpbmRJbldvcmtzcGFjZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHQvLyBmcm9tIGV4cGxvcmVyXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb25zdGFudHMuU2VhcmNoQ29tbWFuZElkcy5GaW5kSW5Xb3Jrc3BhY2VJZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdmaW5kSW5Xb3Jrc3BhY2UnLCBcIkZpbmQgaW4gV29ya3NwYWNlLi4uXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkV4cGxvcmVyQ29udGV4dCxcblx0XHRcdFx0XHRncm91cDogJzRfc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogMTAsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEV4cGxvcmVyUm9vdENvbnRleHQsIEV4cGxvcmVyRm9sZGVyQ29udGV4dC50b05lZ2F0ZWQoKSlcblxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3Qgc2VhcmNoQ29uZmlnID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSkuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb24+KCkuc2VhcmNoO1xuXHRcdGNvbnN0IG1vZGUgPSBzZWFyY2hDb25maWcubW9kZTtcblxuXHRcdGlmIChtb2RlID09PSAndmlldycpIHtcblx0XHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBhd2FpdCBvcGVuU2VhcmNoVmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSksIHRydWUpO1xuXHRcdFx0c2VhcmNoVmlldz8uc2VhcmNoSW5Gb2xkZXJzKCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpLmV4ZWN1dGVDb21tYW5kKFNlYXJjaEVkaXRvckNvbnN0YW50cy5PcGVuRWRpdG9yQ29tbWFuZElkLCB7XG5cdFx0XHRcdGxvY2F0aW9uOiBtb2RlID09PSAnbmV3RWRpdG9yJyA/ICduZXcnIDogJ3JldXNlJyxcblx0XHRcdFx0ZmlsZXNUb0luY2x1ZGU6ICcnLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59KTtcblxuLy8jcmVnaW9uIEhlbHBlcnNcbmFzeW5jIGZ1bmN0aW9uIGV4cGFuZFNlbGVjdFN1YnRyZWUoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRjb25zdCBzZWFyY2hWaWV3ID0gZ2V0U2VhcmNoVmlldyh2aWV3c1NlcnZpY2UpO1xuXHRpZiAoc2VhcmNoVmlldykge1xuXHRcdGNvbnN0IHZpZXdlciA9IHNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpO1xuXHRcdGNvbnN0IHNlbGVjdGVkID0gdmlld2VyLmdldEZvY3VzKClbMF07XG5cdFx0YXdhaXQgZm9yY2VkRXhwYW5kUmVjdXJzaXZlbHkodmlld2VyLCBzZWxlY3RlZCk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gc2VhcmNoV2l0aEZvbGRlckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGlzRnJvbUV4cGxvcmVyOiBib29sZWFuLCBpc0luY2x1ZGVzOiBib29sZWFuLCByZXNvdXJjZT86IFVSSSwgZm9sZGVyTWF0Y2g/OiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoV2l0aFJlc291cmNlKSB7XG5cdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0Y29uc3Qgc2VhcmNoQ29uZmlnID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSkuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb24+KCkuc2VhcmNoO1xuXHRjb25zdCBtb2RlID0gc2VhcmNoQ29uZmlnLm1vZGU7XG5cblx0bGV0IHJlc291cmNlczogVVJJW107XG5cblx0aWYgKGlzRnJvbUV4cGxvcmVyKSB7XG5cdFx0cmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFJlc291cmNlcyhyZXNvdXJjZSwgYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSksIGFjY2Vzc29yLmdldChJRXhwbG9yZXJTZXJ2aWNlKSk7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcodmlld3NTZXJ2aWNlKTtcblx0XHRpZiAoIXNlYXJjaFZpZXcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0cmVzb3VyY2VzID0gZ2V0TXVsdGlTZWxlY3RlZFNlYXJjaFJlc291cmNlcyhzZWFyY2hWaWV3LmdldENvbnRyb2woKSwgZm9sZGVyTWF0Y2gsIHNlYXJjaENvbmZpZyk7XG5cdH1cblxuXHRjb25zdCByZXNvbHZlZFJlc291cmNlcyA9IGZpbGVTZXJ2aWNlLnJlc29sdmVBbGwocmVzb3VyY2VzLm1hcChyZXNvdXJjZSA9PiAoeyByZXNvdXJjZSB9KSkpLnRoZW4ocmVzdWx0cyA9PiB7XG5cdFx0Y29uc3QgZm9sZGVyczogVVJJW10gPSBbXTtcblx0XHRyZXN1bHRzLmZvckVhY2gocmVzdWx0ID0+IHtcblx0XHRcdGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQuc3RhdCkge1xuXHRcdFx0XHRmb2xkZXJzLnB1c2gocmVzdWx0LnN0YXQuaXNEaXJlY3RvcnkgPyByZXN1bHQuc3RhdC5yZXNvdXJjZSA6IGRpcm5hbWUocmVzdWx0LnN0YXQucmVzb3VyY2UpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzb2x2ZVJlc291cmNlc0ZvclNlYXJjaEluY2x1ZGVzKGZvbGRlcnMsIGNvbnRleHRTZXJ2aWNlKTtcblx0fSk7XG5cblx0aWYgKG1vZGUgPT09ICd2aWV3Jykge1xuXHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBhd2FpdCBvcGVuU2VhcmNoVmlldyh2aWV3c1NlcnZpY2UsIHRydWUpO1xuXHRcdGlmIChyZXNvdXJjZXMgJiYgcmVzb3VyY2VzLmxlbmd0aCAmJiBzZWFyY2hWaWV3KSB7XG5cdFx0XHRpZiAoaXNJbmNsdWRlcykge1xuXHRcdFx0XHRzZWFyY2hWaWV3LnNlYXJjaEluRm9sZGVycyhhd2FpdCByZXNvbHZlZFJlc291cmNlcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWFyY2hWaWV3LnNlYXJjaE91dHNpZGVPZkZvbGRlcnMoYXdhaXQgcmVzb2x2ZWRSZXNvdXJjZXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9IGVsc2Uge1xuXHRcdGlmIChpc0luY2x1ZGVzKSB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoU2VhcmNoRWRpdG9yQ29uc3RhbnRzLk9wZW5FZGl0b3JDb21tYW5kSWQsIHtcblx0XHRcdFx0ZmlsZXNUb0luY2x1ZGU6IChhd2FpdCByZXNvbHZlZFJlc291cmNlcykuam9pbignLCAnKSxcblx0XHRcdFx0c2hvd0luY2x1ZGVzRXhjbHVkZXM6IHRydWUsXG5cdFx0XHRcdGxvY2F0aW9uOiBtb2RlID09PSAnbmV3RWRpdG9yJyA/ICduZXcnIDogJ3JldXNlJyxcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChTZWFyY2hFZGl0b3JDb25zdGFudHMuT3BlbkVkaXRvckNvbW1hbmRJZCwge1xuXHRcdFx0XHRmaWxlc1RvRXhjbHVkZTogKGF3YWl0IHJlc29sdmVkUmVzb3VyY2VzKS5qb2luKCcsICcpLFxuXHRcdFx0XHRzaG93SW5jbHVkZXNFeGNsdWRlczogdHJ1ZSxcblx0XHRcdFx0bG9jYXRpb246IG1vZGUgPT09ICduZXdFZGl0b3InID8gJ25ldycgOiAncmV1c2UnLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpU2VsZWN0ZWRTZWFyY2hSZXNvdXJjZXModmlld2VyOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaCwgdm9pZD4sIGN1cnJFbGVtZW50OiBSZW5kZXJhYmxlTWF0Y2ggfCB1bmRlZmluZWQsIHNvcnRDb25maWc6IElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcyk6IFVSSVtdIHtcblx0cmV0dXJuIGdldEVsZW1lbnRzVG9PcGVyYXRlT24odmlld2VyLCBjdXJyRWxlbWVudCwgc29ydENvbmZpZylcblx0XHQubWFwKChyZW5kZXJhYmxlTWF0Y2gpID0+ICgoaXNTZWFyY2hUcmVlTWF0Y2gocmVuZGVyYWJsZU1hdGNoKSkgPyBudWxsIDogcmVuZGVyYWJsZU1hdGNoLnJlc291cmNlKSlcblx0XHQuZmlsdGVyKChyZW5kZXJhYmxlTWF0Y2gpOiByZW5kZXJhYmxlTWF0Y2ggaXMgVVJJID0+IChyZW5kZXJhYmxlTWF0Y2ggIT09IG51bGwpKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbmRJbkZpbGVzQ29tbWFuZChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgX2FyZ3M6IElGaW5kSW5GaWxlc0FyZ3MgPSB7fSkge1xuXG5cdGNvbnN0IHNlYXJjaENvbmZpZyA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpLmdldFZhbHVlPElTZWFyY2hDb25maWd1cmF0aW9uPigpLnNlYXJjaDtcblx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRjb25zdCBhcmdzOiBJRmluZEluRmlsZXNBcmdzID0ge307XG5cdGlmIChPYmplY3Qua2V5cyhfYXJncykubGVuZ3RoICE9PSAwKSB7XG5cdFx0Ly8gcmVzb2x2ZSB2YXJpYWJsZXMgaW4gdGhlIHNhbWUgd2F5IGFzIGluXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi84Yjc2ZWZlOWQzMTdkNTBjYjViNTdhNzY1OGUwOWNlNmViZmZhZjM2L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3JBY3Rpb25zLnRzI0wxNTItTDE1OFxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UpO1xuXHRcdGNvbnN0IGhpc3RvcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElIaXN0b3J5U2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlQ29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0XHRjb25zdCBhY3RpdmVXb3Jrc3BhY2VSb290VXJpID0gaGlzdG9yeVNlcnZpY2UuZ2V0TGFzdEFjdGl2ZVdvcmtzcGFjZVJvb3QoKTtcblx0XHRjb25zdCBmaWx0ZXJlZEFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkgPSBhY3RpdmVXb3Jrc3BhY2VSb290VXJpPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSB8fCBhY3RpdmVXb3Jrc3BhY2VSb290VXJpPy5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlID8gYWN0aXZlV29ya3NwYWNlUm9vdFVyaSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsYXN0QWN0aXZlV29ya3NwYWNlUm9vdCA9IGZpbHRlcmVkQWN0aXZlV29ya3NwYWNlUm9vdFVyaSA/IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcihmaWx0ZXJlZEFjdGl2ZVdvcmtzcGFjZVJvb3RVcmkpID8/IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblxuXHRcdGZvciAoY29uc3QgZW50cnkgb2YgT2JqZWN0LmVudHJpZXMoX2FyZ3MpKSB7XG5cdFx0XHRjb25zdCBuYW1lID0gZW50cnlbMF07XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGVudHJ5WzFdO1xuXHRcdFx0aWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0KGFyZ3MgYXMgYW55KVtuYW1lIGFzIGFueV0gPSAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgPyBhd2FpdCBjb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBc3luYyhsYXN0QWN0aXZlV29ya3NwYWNlUm9vdCwgdmFsdWUpIDogdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgbW9kZSA9IHNlYXJjaENvbmZpZy5tb2RlO1xuXHRpZiAobW9kZSA9PT0gJ3ZpZXcnKSB7XG5cdFx0b3BlblNlYXJjaFZpZXcodmlld3NTZXJ2aWNlLCBmYWxzZSkudGhlbihvcGVuZWRWaWV3ID0+IHtcblx0XHRcdGlmIChvcGVuZWRWaWV3KSB7XG5cdFx0XHRcdGNvbnN0IHNlYXJjaEFuZFJlcGxhY2VXaWRnZXQgPSBvcGVuZWRWaWV3LnNlYXJjaEFuZFJlcGxhY2VXaWRnZXQ7XG5cdFx0XHRcdHNlYXJjaEFuZFJlcGxhY2VXaWRnZXQudG9nZ2xlUmVwbGFjZSh0eXBlb2YgYXJncy5yZXBsYWNlID09PSAnc3RyaW5nJyk7XG5cdFx0XHRcdGxldCB1cGRhdGVkVGV4dCA9IGZhbHNlO1xuXHRcdFx0XHRpZiAodHlwZW9mIGFyZ3MucXVlcnkgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dXBkYXRlZFRleHQgPSBvcGVuZWRWaWV3LnVwZGF0ZVRleHRGcm9tRmluZFdpZGdldE9yU2VsZWN0aW9uKHsgYWxsb3dVbnNlbGVjdGVkV29yZDogdHlwZW9mIGFyZ3MucmVwbGFjZSAhPT0gJ3N0cmluZycgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3BlbmVkVmlldy5zZXRTZWFyY2hQYXJhbWV0ZXJzKGFyZ3MpO1xuXHRcdFx0XHRpZiAodHlwZW9mIGFyZ3Muc2hvd0luY2x1ZGVzRXhjbHVkZXMgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdG9wZW5lZFZpZXcudG9nZ2xlUXVlcnlEZXRhaWxzKGZhbHNlLCBhcmdzLnNob3dJbmNsdWRlc0V4Y2x1ZGVzKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG9wZW5lZFZpZXcuc2VhcmNoQW5kUmVwbGFjZVdpZGdldC5mb2N1cyh1bmRlZmluZWQsIHVwZGF0ZWRUZXh0LCB1cGRhdGVkVGV4dCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0Y29uc3QgY29udmVydEFyZ3MgPSAoYXJnczogSUZpbmRJbkZpbGVzQXJncyk6IE9wZW5TZWFyY2hFZGl0b3JBcmdzID0+ICh7XG5cdFx0XHRsb2NhdGlvbjogbW9kZSA9PT0gJ25ld0VkaXRvcicgPyAnbmV3JyA6ICdyZXVzZScsXG5cdFx0XHRxdWVyeTogYXJncy5xdWVyeSxcblx0XHRcdGZpbGVzVG9JbmNsdWRlOiBhcmdzLmZpbGVzVG9JbmNsdWRlLFxuXHRcdFx0ZmlsZXNUb0V4Y2x1ZGU6IGFyZ3MuZmlsZXNUb0V4Y2x1ZGUsXG5cdFx0XHRtYXRjaFdob2xlV29yZDogYXJncy5tYXRjaFdob2xlV29yZCxcblx0XHRcdGlzQ2FzZVNlbnNpdGl2ZTogYXJncy5pc0Nhc2VTZW5zaXRpdmUsXG5cdFx0XHRpc1JlZ2V4cDogYXJncy5pc1JlZ2V4LFxuXHRcdFx0dXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXM6IGFyZ3MudXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXMsXG5cdFx0XHRvbmx5T3BlbkVkaXRvcnM6IGFyZ3Mub25seU9wZW5FZGl0b3JzLFxuXHRcdFx0c2hvd0luY2x1ZGVzRXhjbHVkZXM6ICEhKGFyZ3MuZmlsZXNUb0V4Y2x1ZGUgfHwgYXJncy5maWxlc1RvRXhjbHVkZSB8fCAhYXJncy51c2VFeGNsdWRlU2V0dGluZ3NBbmRJZ25vcmVGaWxlcyksXG5cdFx0fSk7XG5cdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoU2VhcmNoRWRpdG9yQ29uc3RhbnRzLk9wZW5FZGl0b3JDb21tYW5kSWQsIGNvbnZlcnRBcmdzKGFyZ3MpKTtcblx0fVxufVxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLGVBQWU7QUFDeEIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsb0JBQXdEO0FBQ2pFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFlBQVksZUFBZTtBQUMzQixZQUFZLDJCQUEyQjtBQUl2QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUywyQkFBMkIsd0JBQXdCO0FBQzVELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCLHFCQUFxQiw2QkFBNkIsY0FBYyx3QkFBd0I7QUFDeEgsU0FBUyxpQ0FBaUM7QUFFMUMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxVQUFVLHdCQUF3QixlQUFlLHNCQUFzQjtBQUNoRixTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBbUcsdUJBQXVCLHlCQUF5QjtBQW1CbkosZ0JBQWdCLE1BQU0s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
