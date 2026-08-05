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
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ToggleCaseSensitiveKeybinding, ToggleRegexKeybinding, ToggleWholeWordKeybinding } from "../../../../editor/contrib/find/browser/findModel.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions, DEFAULT_EDITOR_ASSOCIATION } from "../../../common/editor.js";
import { ActiveEditorContext } from "../../../common/contextkeys.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { getSearchView } from "../../search/browser/searchActionsBase.js";
import { searchNewEditorIcon, searchRefreshIcon } from "../../search/browser/searchIcons.js";
import * as SearchConstants from "../../search/common/constants.js";
import * as SearchEditorConstants from "./constants.js";
import { SearchEditor } from "./searchEditor.js";
import { createEditorFromSearchResult, modifySearchEditorContextLinesCommand, openNewSearchEditor, openSearchEditor, selectAllSearchEditorMatchesCommand, toggleSearchEditorCaseSensitiveCommand, toggleSearchEditorContextLinesCommand, toggleSearchEditorRegexCommand, toggleSearchEditorWholeWordCommand } from "./searchEditorActions.js";
import { getOrMakeSearchEditorInput, SearchEditorInput, SEARCH_EDITOR_EXT } from "./searchEditorInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { VIEW_ID } from "../../../services/search/common/search.js";
import { RegisteredEditorPriority, IEditorResolverService } from "../../../services/editor/common/editorResolverService.js";
import { IWorkingCopyEditorService } from "../../../services/workingCopy/common/workingCopyEditorService.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { getActiveElement } from "../../../../base/browser/dom.js";
const OpenInEditorCommandId = "search.action.openInEditor";
const OpenNewEditorToSideCommandId = "search.action.openNewEditorToSide";
const FocusQueryEditorWidgetCommandId = "search.action.focusQueryEditorWidget";
const FocusQueryEditorFilesToIncludeCommandId = "search.action.focusFilesToInclude";
const FocusQueryEditorFilesToExcludeCommandId = "search.action.focusFilesToExclude";
const ToggleSearchEditorCaseSensitiveCommandId = "toggleSearchEditorCaseSensitive";
const ToggleSearchEditorWholeWordCommandId = "toggleSearchEditorWholeWord";
const ToggleSearchEditorRegexCommandId = "toggleSearchEditorRegex";
const IncreaseSearchEditorContextLinesCommandId = "increaseSearchEditorContextLines";
const DecreaseSearchEditorContextLinesCommandId = "decreaseSearchEditorContextLines";
const RerunSearchEditorSearchCommandId = "rerunSearchEditorSearch";
const CleanSearchEditorStateCommandId = "cleanSearchEditorState";
const SelectAllSearchEditorMatchesCommandId = "selectAllSearchEditorMatches";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    SearchEditor,
    SearchEditor.ID,
    localize("searchEditor", "Search Editor")
  ),
  [
    new SyncDescriptor(SearchEditorInput)
  ]
);
let SearchEditorContribution = class {
  constructor(editorResolverService, instantiationService) {
    editorResolverService.registerEditor(
      "*" + SEARCH_EDITOR_EXT,
      {
        id: SearchEditorInput.ID,
        label: localize("promptOpenWith.searchEditor.displayName", "Search Editor"),
        detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
        priority: RegisteredEditorPriority.default
      },
      {
        singlePerResource: true,
        canSupportResource: (resource) => extname(resource) === SEARCH_EDITOR_EXT
      },
      {
        createEditorInput: ({ resource }) => {
          return { editor: instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: "existingFile", fileUri: resource }) };
        }
      }
    );
  }
};
SearchEditorContribution.ID = "workbench.contrib.searchEditor";
SearchEditorContribution = __decorateClass([
  __decorateParam(0, IEditorResolverService),
  __decorateParam(1, IInstantiationService)
], SearchEditorContribution);
registerWorkbenchContribution2(SearchEditorContribution.ID, SearchEditorContribution, WorkbenchPhase.BlockStartup);
class SearchEditorInputSerializer {
  canSerialize(input) {
    return !!input.tryReadConfigSync();
  }
  serialize(input) {
    if (!this.canSerialize(input)) {
      return void 0;
    }
    if (input.isDisposed()) {
      return JSON.stringify({ modelUri: void 0, dirty: false, config: input.tryReadConfigSync(), name: input.getName(), matchRanges: [], backingUri: input.backingUri?.toString() });
    }
    let modelUri = void 0;
    if (input.modelUri.path || input.modelUri.fragment && input.isDirty()) {
      modelUri = input.modelUri.toString();
    }
    const config = input.tryReadConfigSync();
    const dirty = input.isDirty();
    const matchRanges = dirty ? input.getMatchRanges() : [];
    const backingUri = input.backingUri;
    return JSON.stringify({ modelUri, dirty, config, name: input.getName(), matchRanges, backingUri: backingUri?.toString() });
  }
  deserialize(instantiationService, serializedEditorInput) {
    const { modelUri, dirty, config, matchRanges, backingUri } = JSON.parse(serializedEditorInput);
    if (config && config.query !== void 0) {
      if (modelUri) {
        const input = instantiationService.invokeFunction(
          getOrMakeSearchEditorInput,
          { from: "model", modelUri: URI.parse(modelUri), config, backupOf: backingUri ? URI.parse(backingUri) : void 0 }
        );
        input.setDirty(dirty);
        input.setMatchRanges(matchRanges);
        return input;
      } else {
        if (backingUri) {
          return instantiationService.invokeFunction(
            getOrMakeSearchEditorInput,
            { from: "existingFile", fileUri: URI.parse(backingUri) }
          );
        } else {
          return instantiationService.invokeFunction(
            getOrMakeSearchEditorInput,
            { from: "rawData", resultsContents: "", config }
          );
        }
      }
    }
    return void 0;
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  SearchEditorInput.ID,
  SearchEditorInputSerializer
);
CommandsRegistry.registerCommand(
  CleanSearchEditorStateCommandId,
  (accessor) => {
    const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
    if (activeEditorPane instanceof SearchEditor) {
      activeEditorPane.cleanState();
    }
  }
);
const category = localize2("search", "Search Editor");
const translateLegacyConfig = (legacyConfig = {}) => {
  const config = {};
  const overrides = {
    includes: "filesToInclude",
    excludes: "filesToExclude",
    wholeWord: "matchWholeWord",
    caseSensitive: "isCaseSensitive",
    regexp: "isRegexp",
    useIgnores: "useExcludeSettingsAndIgnoreFiles"
  };
  Object.entries(legacyConfig).forEach(([key, value]) => {
    config[overrides[key] ?? key] = value;
  });
  return config;
};
const openArgMetadata = {
  description: "Open a new search editor. Arguments passed can include variables like ${relativeFileDirname}.",
  args: [{
    name: "Open new Search Editor args",
    schema: {
      properties: {
        query: { type: "string" },
        filesToInclude: { type: "string" },
        filesToExclude: { type: "string" },
        contextLines: { type: "number" },
        matchWholeWord: { type: "boolean" },
        isCaseSensitive: { type: "boolean" },
        isRegexp: { type: "boolean" },
        useExcludeSettingsAndIgnoreFiles: { type: "boolean" },
        showIncludesExcludes: { type: "boolean" },
        triggerSearch: { type: "boolean" },
        focusResults: { type: "boolean" },
        onlyOpenEditors: { type: "boolean" }
      }
    }
  }]
};
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "search.searchEditor.action.deleteFileResults",
      title: localize2("searchEditor.deleteResultBlock", "Delete File Results"),
      keybinding: {
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backspace
      },
      precondition: SearchEditorConstants.InSearchEditor,
      category,
      f1: true
    });
  }
  async run(accessor) {
    const contextService = accessor.get(IContextKeyService).getContext(getActiveElement());
    if (contextService.getValue(SearchEditorConstants.InSearchEditor.serialize())) {
      accessor.get(IEditorService).activeEditorPane.deleteResultBlock();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SearchEditorConstants.OpenNewEditorCommandId,
      title: localize2("search.openNewSearchEditor", "New Search Editor"),
      category,
      f1: true,
      metadata: openArgMetadata
    });
  }
  async run(accessor, args) {
    await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig({ location: "new", ...args }));
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SearchEditorConstants.OpenEditorCommandId,
      title: localize2("search.openSearchEditor", "Open Search Editor"),
      category,
      f1: true,
      metadata: openArgMetadata
    });
  }
  async run(accessor, args) {
    await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig({ location: "reuse", ...args }));
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: OpenNewEditorToSideCommandId,
      title: localize2("search.openNewEditorToSide", "Open New Search Editor to the Side"),
      category,
      f1: true,
      metadata: openArgMetadata
    });
  }
  async run(accessor, args) {
    await accessor.get(IInstantiationService).invokeFunction(openNewSearchEditor, translateLegacyConfig(args), true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: OpenInEditorCommandId,
      title: localize2("search.openResultsInEditor", "Open Results in Editor"),
      category,
      f1: true,
      keybinding: {
        primary: KeyMod.Alt | KeyCode.Enter,
        when: ContextKeyExpr.and(SearchConstants.SearchContext.HasSearchResults, SearchConstants.SearchContext.SearchViewFocusedKey),
        weight: KeybindingWeight.WorkbenchContrib,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.Enter
        }
      }
    });
  }
  async run(accessor) {
    const viewsService = accessor.get(IViewsService);
    const instantiationService = accessor.get(IInstantiationService);
    const searchView = getSearchView(viewsService);
    if (searchView) {
      await instantiationService.invokeFunction(createEditorFromSearchResult, searchView.searchResult, searchView.searchIncludePattern.getValue(), searchView.searchExcludePattern.getValue(), searchView.searchIncludePattern.onlySearchInOpenEditors());
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: RerunSearchEditorSearchCommandId,
      title: localize2("search.rerunSearchInEditor", "Search Again"),
      category,
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyR,
        when: SearchEditorConstants.InSearchEditor,
        weight: KeybindingWeight.EditorContrib
      },
      icon: searchRefreshIcon,
      menu: [
        {
          id: MenuId.EditorTitle,
          group: "navigation",
          when: ActiveEditorContext.isEqualTo(SearchEditorConstants.SearchEditorID)
        },
        {
          id: MenuId.CommandPalette,
          when: ActiveEditorContext.isEqualTo(SearchEditorConstants.SearchEditorID)
        }
      ]
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.triggerSearch({ resetCursor: false });
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: FocusQueryEditorWidgetCommandId,
      title: localize2("search.action.focusQueryEditorWidget", "Focus Search Editor Input"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: {
        primary: KeyCode.Escape,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.focusSearchInput();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: FocusQueryEditorFilesToIncludeCommandId,
      title: localize2("search.action.focusFilesToInclude", "Focus Search Editor Files to Include"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.focusFilesToIncludeInput();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: FocusQueryEditorFilesToExcludeCommandId,
      title: localize2("search.action.focusFilesToExclude", "Focus Search Editor Files to Exclude"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.focusFilesToExcludeInput();
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: ToggleSearchEditorCaseSensitiveCommandId,
      title: localize2("searchEditor.action.toggleSearchEditorCaseSensitive", "Toggle Match Case"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: SearchConstants.SearchContext.SearchInputBoxFocusedKey
      }, ToggleCaseSensitiveKeybinding)
    });
  }
  run(accessor) {
    toggleSearchEditorCaseSensitiveCommand(accessor);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: ToggleSearchEditorWholeWordCommandId,
      title: localize2("searchEditor.action.toggleSearchEditorWholeWord", "Toggle Match Whole Word"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: SearchConstants.SearchContext.SearchInputBoxFocusedKey
      }, ToggleWholeWordKeybinding)
    });
  }
  run(accessor) {
    toggleSearchEditorWholeWordCommand(accessor);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: ToggleSearchEditorRegexCommandId,
      title: localize2("searchEditor.action.toggleSearchEditorRegex", "Toggle Use Regular Expression"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: SearchConstants.SearchContext.SearchInputBoxFocusedKey
      }, ToggleRegexKeybinding)
    });
  }
  run(accessor) {
    toggleSearchEditorRegexCommand(accessor);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SearchEditorConstants.ToggleSearchEditorContextLinesCommandId,
      title: localize2("searchEditor.action.toggleSearchEditorContextLines", "Toggle Context Lines"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyCode.KeyL,
        mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyL }
      }
    });
  }
  run(accessor) {
    toggleSearchEditorContextLinesCommand(accessor);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: IncreaseSearchEditorContextLinesCommandId,
      title: localize2("searchEditor.action.increaseSearchEditorContextLines", "Increase Context Lines"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyCode.Equal
      }
    });
  }
  run(accessor) {
    modifySearchEditorContextLinesCommand(accessor, true);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: DecreaseSearchEditorContextLinesCommandId,
      title: localize2("searchEditor.action.decreaseSearchEditorContextLines", "Decrease Context Lines"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyCode.Minus
      }
    });
  }
  run(accessor) {
    modifySearchEditorContextLinesCommand(accessor, false);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: SelectAllSearchEditorMatchesCommandId,
      title: localize2("searchEditor.action.selectAllSearchEditorMatches", "Select All Matches"),
      category,
      f1: true,
      precondition: SearchEditorConstants.InSearchEditor,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL
      }
    });
  }
  run(accessor) {
    selectAllSearchEditorMatchesCommand(accessor);
  }
});
registerAction2(class OpenSearchEditorAction extends Action2 {
  constructor() {
    super({
      id: "search.action.openNewEditorFromView",
      title: localize("search.openNewEditor", "Open New Search Editor"),
      category,
      icon: searchNewEditorIcon,
      menu: [{
        id: MenuId.ViewTitle,
        group: "navigation",
        order: 2,
        when: ContextKeyExpr.equals("view", VIEW_ID)
      }]
    });
  }
  run(accessor, ...args) {
    return openSearchEditor(accessor);
  }
});
let SearchEditorWorkingCopyEditorHandler = class extends Disposable {
  constructor(instantiationService, workingCopyEditorService) {
    super();
    this.instantiationService = instantiationService;
    this._register(workingCopyEditorService.registerHandler(this));
  }
  handles(workingCopy) {
    return workingCopy.resource.scheme === SearchEditorConstants.SearchEditorScheme;
  }
  isOpen(workingCopy, editor) {
    if (!this.handles(workingCopy)) {
      return false;
    }
    return editor instanceof SearchEditorInput && isEqual(workingCopy.resource, editor.modelUri);
  }
  createEditor(workingCopy) {
    const input = this.instantiationService.invokeFunction(getOrMakeSearchEditorInput, { from: "model", modelUri: workingCopy.resource });
    input.setDirty(true);
    return input;
  }
};
SearchEditorWorkingCopyEditorHandler.ID = "workbench.contrib.searchEditorWorkingCopyEditorHandler";
SearchEditorWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyEditorService)
], SearchEditorWorkingCopyEditorHandler);
registerWorkbenchContribution2(SearchEditorWorkingCopyEditorHandler.ID, SearchEditorWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3IuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcsIFRvZ2dsZVJlZ2V4S2V5YmluZGluZywgVG9nZ2xlV2hvbGVXb3JkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kTW9kZWwuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZURlc2NyaXB0b3IsIElFZGl0b3JQYW5lUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZSwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcmlhbGl6ZXIsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnksIEVkaXRvckV4dGVuc2lvbnMsIERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBBY3RpdmVFZGl0b3JDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldFNlYXJjaFZpZXcgfSBmcm9tICcuLi8uLi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hBY3Rpb25zQmFzZS5qcyc7XG5pbXBvcnQgeyBzZWFyY2hOZXdFZGl0b3JJY29uLCBzZWFyY2hSZWZyZXNoSWNvbiB9IGZyb20gJy4uLy4uL3NlYXJjaC9icm93c2VyL3NlYXJjaEljb25zLmpzJztcbmltcG9ydCAqIGFzIFNlYXJjaENvbnN0YW50cyBmcm9tICcuLi8uLi9zZWFyY2gvY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgKiBhcyBTZWFyY2hFZGl0b3JDb25zdGFudHMgZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2VhcmNoRWRpdG9yIH0gZnJvbSAnLi9zZWFyY2hFZGl0b3IuanMnO1xuaW1wb3J0IHsgY3JlYXRlRWRpdG9yRnJvbVNlYXJjaFJlc3VsdCwgbW9kaWZ5U2VhcmNoRWRpdG9yQ29udGV4dExpbmVzQ29tbWFuZCwgb3Blbk5ld1NlYXJjaEVkaXRvciwgb3BlblNlYXJjaEVkaXRvciwgc2VsZWN0QWxsU2VhcmNoRWRpdG9yTWF0Y2hlc0NvbW1hbmQsIHRvZ2dsZVNlYXJjaEVkaXRvckNhc2VTZW5zaXRpdmVDb21tYW5kLCB0b2dnbGVTZWFyY2hFZGl0b3JDb250ZXh0TGluZXNDb21tYW5kLCB0b2dnbGVTZWFyY2hFZGl0b3JSZWdleENvbW1hbmQsIHRvZ2dsZVNlYXJjaEVkaXRvcldob2xlV29yZENvbW1hbmQgfSBmcm9tICcuL3NlYXJjaEVkaXRvckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgZ2V0T3JNYWtlU2VhcmNoRWRpdG9ySW5wdXQsIFNlYXJjaEVkaXRvcklucHV0LCBTRUFSQ0hfRURJVE9SX0VYVCB9IGZyb20gJy4vc2VhcmNoRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVklFV19JRCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSwgSUVkaXRvclJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUVkaXRvckhhbmRsZXIsIElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5SWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5cbmNvbnN0IE9wZW5JbkVkaXRvckNvbW1hbmRJZCA9ICdzZWFyY2guYWN0aW9uLm9wZW5JbkVkaXRvcic7XG5jb25zdCBPcGVuTmV3RWRpdG9yVG9TaWRlQ29tbWFuZElkID0gJ3NlYXJjaC5hY3Rpb24ub3Blbk5ld0VkaXRvclRvU2lkZSc7XG5jb25zdCBGb2N1c1F1ZXJ5RWRpdG9yV2lkZ2V0Q29tbWFuZElkID0gJ3NlYXJjaC5hY3Rpb24uZm9jdXNRdWVyeUVkaXRvcldpZGdldCc7XG5jb25zdCBGb2N1c1F1ZXJ5RWRpdG9yRmlsZXNUb0luY2x1ZGVDb21tYW5kSWQgPSAnc2VhcmNoLmFjdGlvbi5mb2N1c0ZpbGVzVG9JbmNsdWRlJztcbmNvbnN0IEZvY3VzUXVlcnlFZGl0b3JGaWxlc1RvRXhjbHVkZUNvbW1hbmRJZCA9ICdzZWFyY2guYWN0aW9uLmZvY3VzRmlsZXNUb0V4Y2x1ZGUnO1xuXG5jb25zdCBUb2dnbGVTZWFyY2hFZGl0b3JDYXNlU2Vuc2l0aXZlQ29tbWFuZElkID0gJ3RvZ2dsZVNlYXJjaEVkaXRvckNhc2VTZW5zaXRpdmUnO1xuY29uc3QgVG9nZ2xlU2VhcmNoRWRpdG9yV2hvbGVXb3JkQ29tbWFuZElkID0gJ3RvZ2dsZVNlYXJjaEVkaXRvcldob2xlV29yZCc7XG5jb25zdCBUb2dnbGVTZWFyY2hFZGl0b3JSZWdleENvbW1hbmRJZCA9ICd0b2dnbGVTZWFyY2hFZGl0b3JSZWdleCc7XG5jb25zdCBJbmNyZWFzZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCA9ICdpbmNyZWFzZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lcyc7XG5jb25zdCBEZWNyZWFzZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCA9ICdkZWNyZWFzZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lcyc7XG5cbmNvbnN0IFJlcnVuU2VhcmNoRWRpdG9yU2VhcmNoQ29tbWFuZElkID0gJ3JlcnVuU2VhcmNoRWRpdG9yU2VhcmNoJztcbmNvbnN0IENsZWFuU2VhcmNoRWRpdG9yU3RhdGVDb21tYW5kSWQgPSAnY2xlYW5TZWFyY2hFZGl0b3JTdGF0ZSc7XG5jb25zdCBTZWxlY3RBbGxTZWFyY2hFZGl0b3JNYXRjaGVzQ29tbWFuZElkID0gJ3NlbGVjdEFsbFNlYXJjaEVkaXRvck1hdGNoZXMnO1xuXG5cblxuLy8jcmVnaW9uIEVkaXRvciBEZXNjcmlwdGlvclxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRTZWFyY2hFZGl0b3IsXG5cdFx0U2VhcmNoRWRpdG9yLklELFxuXHRcdGxvY2FsaXplKCdzZWFyY2hFZGl0b3InLCBcIlNlYXJjaCBFZGl0b3JcIilcblx0KSxcblx0W1xuXHRcdG5ldyBTeW5jRGVzY3JpcHRvcihTZWFyY2hFZGl0b3JJbnB1dClcblx0XVxuKTtcbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gU3RhcnR1cCBDb250cmlidXRpb25cbmNsYXNzIFNlYXJjaEVkaXRvckNvbnRyaWJ1dGlvbiBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5zZWFyY2hFZGl0b3InO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIGVkaXRvclJlc29sdmVyU2VydmljZTogSUVkaXRvclJlc29sdmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdGVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdCcqJyArIFNFQVJDSF9FRElUT1JfRVhULFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogU2VhcmNoRWRpdG9ySW5wdXQuSUQsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncHJvbXB0T3BlbldpdGguc2VhcmNoRWRpdG9yLmRpc3BsYXlOYW1lJywgXCJTZWFyY2ggRWRpdG9yXCIpLFxuXHRcdFx0XHRkZXRhaWw6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLnByb3ZpZGVyRGlzcGxheU5hbWUsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZGVmYXVsdCxcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHNpbmdsZVBlclJlc291cmNlOiB0cnVlLFxuXHRcdFx0XHRjYW5TdXBwb3J0UmVzb3VyY2U6IHJlc291cmNlID0+IChleHRuYW1lKHJlc291cmNlKSA9PT0gU0VBUkNIX0VESVRPUl9FWFQpXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UgfSkgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB7IGVkaXRvcjogaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0T3JNYWtlU2VhcmNoRWRpdG9ySW5wdXQsIHsgZnJvbTogJ2V4aXN0aW5nRmlsZScsIGZpbGVVcmk6IHJlc291cmNlIH0pIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXHR9XG59XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihTZWFyY2hFZGl0b3JDb250cmlidXRpb24uSUQsIFNlYXJjaEVkaXRvckNvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gSW5wdXQgU2VyaWFsaXplclxudHlwZSBTZXJpYWxpemVkU2VhcmNoRWRpdG9yID0geyBtb2RlbFVyaTogc3RyaW5nIHwgdW5kZWZpbmVkOyBkaXJ0eTogYm9vbGVhbjsgY29uZmlnPzogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLlNlYXJjaENvbmZpZ3VyYXRpb247IG5hbWU6IHN0cmluZzsgbWF0Y2hSYW5nZXM6IFJhbmdlW107IGJhY2tpbmdVcmk/OiBzdHJpbmcgfTtcblxuY2xhc3MgU2VhcmNoRWRpdG9ySW5wdXRTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXG5cdGNhblNlcmlhbGl6ZShpbnB1dDogU2VhcmNoRWRpdG9ySW5wdXQpIHtcblx0XHRyZXR1cm4gISFpbnB1dC50cnlSZWFkQ29uZmlnU3luYygpO1xuXHR9XG5cblx0c2VyaWFsaXplKGlucHV0OiBTZWFyY2hFZGl0b3JJbnB1dCkge1xuXHRcdGlmICghdGhpcy5jYW5TZXJpYWxpemUoaW5wdXQpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmIChpbnB1dC5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh7IG1vZGVsVXJpOiB1bmRlZmluZWQsIGRpcnR5OiBmYWxzZSwgY29uZmlnOiBpbnB1dC50cnlSZWFkQ29uZmlnU3luYygpLCBuYW1lOiBpbnB1dC5nZXROYW1lKCksIG1hdGNoUmFuZ2VzOiBbXSwgYmFja2luZ1VyaTogaW5wdXQuYmFja2luZ1VyaT8udG9TdHJpbmcoKSB9IHNhdGlzZmllcyBTZXJpYWxpemVkU2VhcmNoRWRpdG9yKTtcblx0XHR9XG5cblx0XHRsZXQgbW9kZWxVcmkgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGlucHV0Lm1vZGVsVXJpLnBhdGggfHwgaW5wdXQubW9kZWxVcmkuZnJhZ21lbnQgJiYgaW5wdXQuaXNEaXJ0eSgpKSB7XG5cdFx0XHRtb2RlbFVyaSA9IGlucHV0Lm1vZGVsVXJpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uZmlnID0gaW5wdXQudHJ5UmVhZENvbmZpZ1N5bmMoKTtcblx0XHRjb25zdCBkaXJ0eSA9IGlucHV0LmlzRGlydHkoKTtcblx0XHRjb25zdCBtYXRjaFJhbmdlcyA9IGRpcnR5ID8gaW5wdXQuZ2V0TWF0Y2hSYW5nZXMoKSA6IFtdO1xuXHRcdGNvbnN0IGJhY2tpbmdVcmkgPSBpbnB1dC5iYWNraW5nVXJpO1xuXG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgbW9kZWxVcmksIGRpcnR5LCBjb25maWcsIG5hbWU6IGlucHV0LmdldE5hbWUoKSwgbWF0Y2hSYW5nZXMsIGJhY2tpbmdVcmk6IGJhY2tpbmdVcmk/LnRvU3RyaW5nKCkgfSBzYXRpc2ZpZXMgU2VyaWFsaXplZFNlYXJjaEVkaXRvcik7XG5cdH1cblxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBzZXJpYWxpemVkRWRpdG9ySW5wdXQ6IHN0cmluZyk6IFNlYXJjaEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB7IG1vZGVsVXJpLCBkaXJ0eSwgY29uZmlnLCBtYXRjaFJhbmdlcywgYmFja2luZ1VyaSB9ID0gSlNPTi5wYXJzZShzZXJpYWxpemVkRWRpdG9ySW5wdXQpIGFzIFNlcmlhbGl6ZWRTZWFyY2hFZGl0b3I7XG5cdFx0aWYgKGNvbmZpZyAmJiAoY29uZmlnLnF1ZXJ5ICE9PSB1bmRlZmluZWQpKSB7XG5cdFx0XHRpZiAobW9kZWxVcmkpIHtcblx0XHRcdFx0Y29uc3QgaW5wdXQgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXRPck1ha2VTZWFyY2hFZGl0b3JJbnB1dCxcblx0XHRcdFx0XHR7IGZyb206ICdtb2RlbCcsIG1vZGVsVXJpOiBVUkkucGFyc2UobW9kZWxVcmkpLCBjb25maWcsIGJhY2t1cE9mOiBiYWNraW5nVXJpID8gVVJJLnBhcnNlKGJhY2tpbmdVcmkpIDogdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHRpbnB1dC5zZXREaXJ0eShkaXJ0eSk7XG5cdFx0XHRcdGlucHV0LnNldE1hdGNoUmFuZ2VzKG1hdGNoUmFuZ2VzKTtcblx0XHRcdFx0cmV0dXJuIGlucHV0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGJhY2tpbmdVcmkpIHtcblx0XHRcdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0T3JNYWtlU2VhcmNoRWRpdG9ySW5wdXQsXG5cdFx0XHRcdFx0XHR7IGZyb206ICdleGlzdGluZ0ZpbGUnLCBmaWxlVXJpOiBVUkkucGFyc2UoYmFja2luZ1VyaSkgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldE9yTWFrZVNlYXJjaEVkaXRvcklucHV0LFxuXHRcdFx0XHRcdFx0eyBmcm9tOiAncmF3RGF0YScsIHJlc3VsdHNDb250ZW50czogJycsIGNvbmZpZyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKFxuXHRTZWFyY2hFZGl0b3JJbnB1dC5JRCxcblx0U2VhcmNoRWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQ29tbWFuZHNcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKFxuXHRDbGVhblNlYXJjaEVkaXRvclN0YXRlQ29tbWFuZElkLFxuXHQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpID0+IHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChhY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgU2VhcmNoRWRpdG9yKSB7XG5cdFx0XHRhY3RpdmVFZGl0b3JQYW5lLmNsZWFuU3RhdGUoKTtcblx0XHR9XG5cdH0pO1xuLy8jZW5kcmVnaW9uXG5cbi8vI3JlZ2lvbiBBY3Rpb25zXG5jb25zdCBjYXRlZ29yeSA9IGxvY2FsaXplMignc2VhcmNoJywgJ1NlYXJjaCBFZGl0b3InKTtcblxuZXhwb3J0IHR5cGUgTGVnYWN5U2VhcmNoRWRpdG9yQXJncyA9IFBhcnRpYWw8e1xuXHRxdWVyeTogc3RyaW5nO1xuXHRpbmNsdWRlczogc3RyaW5nO1xuXHRleGNsdWRlczogc3RyaW5nO1xuXHRjb250ZXh0TGluZXM6IG51bWJlcjtcblx0d2hvbGVXb3JkOiBib29sZWFuO1xuXHRjYXNlU2Vuc2l0aXZlOiBib29sZWFuO1xuXHRyZWdleHA6IGJvb2xlYW47XG5cdHVzZUlnbm9yZXM6IGJvb2xlYW47XG5cdHNob3dJbmNsdWRlc0V4Y2x1ZGVzOiBib29sZWFuO1xuXHR0cmlnZ2VyU2VhcmNoOiBib29sZWFuO1xuXHRmb2N1c1Jlc3VsdHM6IGJvb2xlYW47XG5cdGxvY2F0aW9uOiAncmV1c2UnIHwgJ25ldyc7XG59PjtcblxuY29uc3QgdHJhbnNsYXRlTGVnYWN5Q29uZmlnID0gKGxlZ2FjeUNvbmZpZzogTGVnYWN5U2VhcmNoRWRpdG9yQXJncyAmIE9wZW5TZWFyY2hFZGl0b3JBcmdzID0ge30pOiBPcGVuU2VhcmNoRWRpdG9yQXJncyA9PiB7XG5cdGNvbnN0IGNvbmZpZzogT3BlblNlYXJjaEVkaXRvckFyZ3MgPSB7fTtcblx0Y29uc3Qgb3ZlcnJpZGVzOiB7IFtLIGluIGtleW9mIExlZ2FjeVNlYXJjaEVkaXRvckFyZ3NdOiBrZXlvZiBPcGVuU2VhcmNoRWRpdG9yQXJncyB9ID0ge1xuXHRcdGluY2x1ZGVzOiAnZmlsZXNUb0luY2x1ZGUnLFxuXHRcdGV4Y2x1ZGVzOiAnZmlsZXNUb0V4Y2x1ZGUnLFxuXHRcdHdob2xlV29yZDogJ21hdGNoV2hvbGVXb3JkJyxcblx0XHRjYXNlU2Vuc2l0aXZlOiAnaXNDYXNlU2Vuc2l0aXZlJyxcblx0XHRyZWdleHA6ICdpc1JlZ2V4cCcsXG5cdFx0dXNlSWdub3JlczogJ3VzZUV4Y2x1ZGVTZXR0aW5nc0FuZElnbm9yZUZpbGVzJyxcblx0fTtcblx0T2JqZWN0LmVudHJpZXMobGVnYWN5Q29uZmlnKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHQoY29uZmlnIGFzIGFueSlbKG92ZXJyaWRlcyBhcyBhbnkpW2tleV0gPz8ga2V5XSA9IHZhbHVlO1xuXHR9KTtcblx0cmV0dXJuIGNvbmZpZztcbn07XG5cbmV4cG9ydCB0eXBlIE9wZW5TZWFyY2hFZGl0b3JBcmdzID0gUGFydGlhbDxTZWFyY2hFZGl0b3JDb25zdGFudHMuU2VhcmNoQ29uZmlndXJhdGlvbiAmIHsgdHJpZ2dlclNlYXJjaDogYm9vbGVhbjsgZm9jdXNSZXN1bHRzOiBib29sZWFuOyBsb2NhdGlvbjogJ3JldXNlJyB8ICduZXcnIH0+O1xuY29uc3Qgb3BlbkFyZ01ldGFkYXRhID0ge1xuXHRkZXNjcmlwdGlvbjogJ09wZW4gYSBuZXcgc2VhcmNoIGVkaXRvci4gQXJndW1lbnRzIHBhc3NlZCBjYW4gaW5jbHVkZSB2YXJpYWJsZXMgbGlrZSAke3JlbGF0aXZlRmlsZURpcm5hbWV9LicsXG5cdGFyZ3M6IFt7XG5cdFx0bmFtZTogJ09wZW4gbmV3IFNlYXJjaCBFZGl0b3IgYXJncycsXG5cdFx0c2NoZW1hOiB7XG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHF1ZXJ5OiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdGZpbGVzVG9JbmNsdWRlOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdGZpbGVzVG9FeGNsdWRlOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdGNvbnRleHRMaW5lczogeyB0eXBlOiAnbnVtYmVyJyB9LFxuXHRcdFx0XHRtYXRjaFdob2xlV29yZDogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0aXNDYXNlU2Vuc2l0aXZlOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRpc1JlZ2V4cDogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdFx0dXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXM6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdFx0XHRcdHNob3dJbmNsdWRlc0V4Y2x1ZGVzOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHRcdFx0XHR0cmlnZ2VyU2VhcmNoOiB7IHR5cGU6ICdib29sZWFuJyB9LFxuXHRcdFx0XHRmb2N1c1Jlc3VsdHM6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXG5cdFx0XHRcdG9ubHlPcGVuRWRpdG9yczogeyB0eXBlOiAnYm9vbGVhbicgfSxcblx0XHRcdH1cblx0XHR9XG5cdH1dXG59IGFzIGNvbnN0O1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdzZWFyY2guc2VhcmNoRWRpdG9yLmFjdGlvbi5kZWxldGVGaWxlUmVzdWx0cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2hFZGl0b3IuZGVsZXRlUmVzdWx0QmxvY2snLCAnRGVsZXRlIEZpbGUgUmVzdWx0cycpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkJhY2tzcGFjZSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvcixcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBjb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpLmdldENvbnRleHQoZ2V0QWN0aXZlRWxlbWVudCgpKTtcblx0XHRpZiAoY29udGV4dFNlcnZpY2UuZ2V0VmFsdWUoU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yLnNlcmlhbGl6ZSgpKSkge1xuXHRcdFx0KGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZSBhcyBTZWFyY2hFZGl0b3IpLmRlbGV0ZVJlc3VsdEJsb2NrKCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuT3Blbk5ld0VkaXRvckNvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaC5vcGVuTmV3U2VhcmNoRWRpdG9yJywgJ05ldyBTZWFyY2ggRWRpdG9yJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWV0YWRhdGE6IG9wZW5BcmdNZXRhZGF0YVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogTGVnYWN5U2VhcmNoRWRpdG9yQXJncyB8IE9wZW5TZWFyY2hFZGl0b3JBcmdzKSB7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkuaW52b2tlRnVuY3Rpb24ob3Blbk5ld1NlYXJjaEVkaXRvciwgdHJhbnNsYXRlTGVnYWN5Q29uZmlnKHsgbG9jYXRpb246ICduZXcnLCAuLi5hcmdzIH0pKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLk9wZW5FZGl0b3JDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2gub3BlblNlYXJjaEVkaXRvcicsICdPcGVuIFNlYXJjaCBFZGl0b3InKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRtZXRhZGF0YTogb3BlbkFyZ01ldGFkYXRhXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBMZWdhY3lTZWFyY2hFZGl0b3JBcmdzIHwgT3BlblNlYXJjaEVkaXRvckFyZ3MpIHtcblx0XHRhd2FpdCBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5pbnZva2VGdW5jdGlvbihvcGVuTmV3U2VhcmNoRWRpdG9yLCB0cmFuc2xhdGVMZWdhY3lDb25maWcoeyBsb2NhdGlvbjogJ3JldXNlJywgLi4uYXJncyB9KSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IE9wZW5OZXdFZGl0b3JUb1NpZGVDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2gub3Blbk5ld0VkaXRvclRvU2lkZScsICdPcGVuIE5ldyBTZWFyY2ggRWRpdG9yIHRvIHRoZSBTaWRlJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWV0YWRhdGE6IG9wZW5BcmdNZXRhZGF0YVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogTGVnYWN5U2VhcmNoRWRpdG9yQXJncyB8IE9wZW5TZWFyY2hFZGl0b3JBcmdzKSB7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkuaW52b2tlRnVuY3Rpb24ob3Blbk5ld1NlYXJjaEVkaXRvciwgdHJhbnNsYXRlTGVnYWN5Q29uZmlnKGFyZ3MpLCB0cnVlKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogT3BlbkluRWRpdG9yQ29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2VhcmNoLm9wZW5SZXN1bHRzSW5FZGl0b3InLCAnT3BlbiBSZXN1bHRzIGluIEVkaXRvcicpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTZWFyY2hDb25zdGFudHMuU2VhcmNoQ29udGV4dC5IYXNTZWFyY2hSZXN1bHRzLCBTZWFyY2hDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3Rm9jdXNlZEtleSksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRtYWM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXJcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBzZWFyY2hWaWV3ID0gZ2V0U2VhcmNoVmlldyh2aWV3c1NlcnZpY2UpO1xuXHRcdGlmIChzZWFyY2hWaWV3KSB7XG5cdFx0XHRhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihjcmVhdGVFZGl0b3JGcm9tU2VhcmNoUmVzdWx0LCBzZWFyY2hWaWV3LnNlYXJjaFJlc3VsdCwgc2VhcmNoVmlldy5zZWFyY2hJbmNsdWRlUGF0dGVybi5nZXRWYWx1ZSgpLCBzZWFyY2hWaWV3LnNlYXJjaEV4Y2x1ZGVQYXR0ZXJuLmdldFZhbHVlKCksIHNlYXJjaFZpZXcuc2VhcmNoSW5jbHVkZVBhdHRlcm4ub25seVNlYXJjaEluT3BlbkVkaXRvcnMoKSk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBSZXJ1blNlYXJjaEVkaXRvclNlYXJjaENvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaC5yZXJ1blNlYXJjaEluRWRpdG9yJywgJ1NlYXJjaCBBZ2FpbicpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlSLFxuXHRcdFx0XHR3aGVuOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogc2VhcmNoUmVmcmVzaEljb24sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHR3aGVuOiBBY3RpdmVFZGl0b3JDb250ZXh0LmlzRXF1YWxUbyhTZWFyY2hFZGl0b3JDb25zdGFudHMuU2VhcmNoRWRpdG9ySUQpXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBBY3RpdmVFZGl0b3JDb250ZXh0LmlzRXF1YWxUbyhTZWFyY2hFZGl0b3JDb25zdGFudHMuU2VhcmNoRWRpdG9ySUQpXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgU2VhcmNoRWRpdG9ySW5wdXQpIHtcblx0XHRcdChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS50cmlnZ2VyU2VhcmNoKHsgcmVzZXRDdXJzb3I6IGZhbHNlIH0pO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRm9jdXNRdWVyeUVkaXRvcldpZGdldENvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaC5hY3Rpb24uZm9jdXNRdWVyeUVkaXRvcldpZGdldCcsICdGb2N1cyBTZWFyY2ggRWRpdG9yIElucHV0JyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgU2VhcmNoRWRpdG9ySW5wdXQpIHtcblx0XHRcdChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS5mb2N1c1NlYXJjaElucHV0KCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBGb2N1c1F1ZXJ5RWRpdG9yRmlsZXNUb0luY2x1ZGVDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2guYWN0aW9uLmZvY3VzRmlsZXNUb0luY2x1ZGUnLCAnRm9jdXMgU2VhcmNoIEVkaXRvciBGaWxlcyB0byBJbmNsdWRlJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaW5wdXQgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBTZWFyY2hFZGl0b3JJbnB1dCkge1xuXHRcdFx0KGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSBhcyBTZWFyY2hFZGl0b3IpLmZvY3VzRmlsZXNUb0luY2x1ZGVJbnB1dCgpO1xuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRm9jdXNRdWVyeUVkaXRvckZpbGVzVG9FeGNsdWRlQ29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2VhcmNoLmFjdGlvbi5mb2N1c0ZpbGVzVG9FeGNsdWRlJywgJ0ZvY3VzIFNlYXJjaCBFZGl0b3IgRmlsZXMgdG8gRXhjbHVkZScpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yLFxuXHRcdH0pO1xuXHR9XG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgU2VhcmNoRWRpdG9ySW5wdXQpIHtcblx0XHRcdChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS5mb2N1c0ZpbGVzVG9FeGNsdWRlSW5wdXQoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFRvZ2dsZVNlYXJjaEVkaXRvckNhc2VTZW5zaXRpdmVDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2hFZGl0b3IuYWN0aW9uLnRvZ2dsZVNlYXJjaEVkaXRvckNhc2VTZW5zaXRpdmUnLCAnVG9nZ2xlIE1hdGNoIENhc2UnKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvcixcblx0XHRcdGtleWJpbmRpbmc6IE9iamVjdC5hc3NpZ24oe1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogU2VhcmNoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoSW5wdXRCb3hGb2N1c2VkS2V5LFxuXHRcdFx0fSwgVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcpXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0dG9nZ2xlU2VhcmNoRWRpdG9yQ2FzZVNlbnNpdGl2ZUNvbW1hbmQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUb2dnbGVTZWFyY2hFZGl0b3JXaG9sZVdvcmRDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2hFZGl0b3IuYWN0aW9uLnRvZ2dsZVNlYXJjaEVkaXRvcldob2xlV29yZCcsICdUb2dnbGUgTWF0Y2ggV2hvbGUgV29yZCcpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yLFxuXHRcdFx0a2V5YmluZGluZzogT2JqZWN0LmFzc2lnbih7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBTZWFyY2hDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hJbnB1dEJveEZvY3VzZWRLZXksXG5cdFx0XHR9LCBUb2dnbGVXaG9sZVdvcmRLZXliaW5kaW5nKVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdHRvZ2dsZVNlYXJjaEVkaXRvcldob2xlV29yZENvbW1hbmQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUb2dnbGVTZWFyY2hFZGl0b3JSZWdleENvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaEVkaXRvci5hY3Rpb24udG9nZ2xlU2VhcmNoRWRpdG9yUmVnZXgnLCBcIlRvZ2dsZSBVc2UgUmVndWxhciBFeHByZXNzaW9uXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yLFxuXHRcdFx0a2V5YmluZGluZzogT2JqZWN0LmFzc2lnbih7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBTZWFyY2hDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hJbnB1dEJveEZvY3VzZWRLZXksXG5cdFx0XHR9LCBUb2dnbGVSZWdleEtleWJpbmRpbmcpXG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0dG9nZ2xlU2VhcmNoRWRpdG9yUmVnZXhDb21tYW5kKGFjY2Vzc29yKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLlRvZ2dsZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaEVkaXRvci5hY3Rpb24udG9nZ2xlU2VhcmNoRWRpdG9yQ29udGV4dExpbmVzJywgXCJUb2dnbGUgQ29udGV4dCBMaW5lc1wiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvcixcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUwsXG5cdFx0XHRcdG1hYzogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleUwgfVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdHRvZ2dsZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBJbmNyZWFzZVNlYXJjaEVkaXRvckNvbnRleHRMaW5lc0NvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3NlYXJjaEVkaXRvci5hY3Rpb24uaW5jcmVhc2VTZWFyY2hFZGl0b3JDb250ZXh0TGluZXMnLCBcIkluY3JlYXNlIENvbnRleHQgTGluZXNcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5FcXVhbFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgeyBtb2RpZnlTZWFyY2hFZGl0b3JDb250ZXh0TGluZXNDb21tYW5kKGFjY2Vzc29yLCB0cnVlKTsgfVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogRGVjcmVhc2VTZWFyY2hFZGl0b3JDb250ZXh0TGluZXNDb21tYW5kSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzZWFyY2hFZGl0b3IuYWN0aW9uLmRlY3JlYXNlU2VhcmNoRWRpdG9yQ29udGV4dExpbmVzJywgXCJEZWNyZWFzZSBDb250ZXh0IExpbmVzXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuTWludXNcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHsgbW9kaWZ5U2VhcmNoRWRpdG9yQ29udGV4dExpbmVzQ29tbWFuZChhY2Nlc3NvciwgZmFsc2UpOyB9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWxlY3RBbGxTZWFyY2hFZGl0b3JNYXRjaGVzQ29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2VhcmNoRWRpdG9yLmFjdGlvbi5zZWxlY3RBbGxTZWFyY2hFZGl0b3JNYXRjaGVzJywgXCJTZWxlY3QgQWxsIE1hdGNoZXNcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuS2V5TCxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRzZWxlY3RBbGxTZWFyY2hFZGl0b3JNYXRjaGVzQ29tbWFuZChhY2Nlc3Nvcik7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlblNlYXJjaEVkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3NlYXJjaC5hY3Rpb24ub3Blbk5ld0VkaXRvckZyb21WaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2VhcmNoLm9wZW5OZXdFZGl0b3InLCBcIk9wZW4gTmV3IFNlYXJjaCBFZGl0b3JcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGljb246IHNlYXJjaE5ld0VkaXRvckljb24sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIFZJRVdfSUQpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0cmV0dXJuIG9wZW5TZWFyY2hFZGl0b3IoYWNjZXNzb3IpO1xuXHR9XG59KTtcbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gU2VhcmNoIEVkaXRvciBXb3JraW5nIENvcHkgRWRpdG9yIEhhbmRsZXJcbmNsYXNzIFNlYXJjaEVkaXRvcldvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuc2VhcmNoRWRpdG9yV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB3b3JraW5nQ29weUVkaXRvclNlcnZpY2U6IElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih3b3JraW5nQ29weUVkaXRvclNlcnZpY2UucmVnaXN0ZXJIYW5kbGVyKHRoaXMpKTtcblx0fVxuXG5cdGhhbmRsZXMod29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gd29ya2luZ0NvcHkucmVzb3VyY2Uuc2NoZW1lID09PSBTZWFyY2hFZGl0b3JDb25zdGFudHMuU2VhcmNoRWRpdG9yU2NoZW1lO1xuXHR9XG5cblx0aXNPcGVuKHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCBlZGl0b3I6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmhhbmRsZXMod29ya2luZ0NvcHkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvciBpbnN0YW5jZW9mIFNlYXJjaEVkaXRvcklucHV0ICYmIGlzRXF1YWwod29ya2luZ0NvcHkucmVzb3VyY2UsIGVkaXRvci5tb2RlbFVyaSk7XG5cdH1cblxuXHRjcmVhdGVFZGl0b3Iod29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBFZGl0b3JJbnB1dCB7XG5cdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldE9yTWFrZVNlYXJjaEVkaXRvcklucHV0LCB7IGZyb206ICdtb2RlbCcsIG1vZGVsVXJpOiB3b3JraW5nQ29weS5yZXNvdXJjZSB9KTtcblx0XHRpbnB1dC5zZXREaXJ0eSh0cnVlKTtcblxuXHRcdHJldHVybiBpbnB1dDtcblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoU2VhcmNoRWRpdG9yV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLklELCBTZWFyY2hFZGl0b3JXb3JraW5nQ29weUVkaXRvckhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxTQUFTLGVBQWU7QUFDakMsU0FBUyxXQUFXO0FBR3BCLFNBQVMsK0JBQStCLHVCQUF1QixpQ0FBaUM7QUFDaEcsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQkFBZ0IsMEJBQTBCO0FBQ25ELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQWlEO0FBQzFELFNBQWlDLGdCQUFnQixzQ0FBc0M7QUFDdkYsU0FBb0Qsa0JBQWtCLGtDQUFrQztBQUN4RyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHFCQUFxQix5QkFBeUI7QUFDdkQsWUFBWSxxQkFBcUI7QUFDakMsWUFBWSwyQkFBMkI7QUFDdkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw4QkFBOEIsdUNBQXVDLHFCQUFxQixrQkFBa0IscUNBQXFDLHdDQUF3Qyx1Q0FBdUMsZ0NBQWdDLDBDQUEwQztBQUNuVCxTQUFTLDRCQUE0QixtQkFBbUIseUJBQXlCO0FBQ2pGLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFTLDBCQUEwQiw4QkFBOEI7QUFDakUsU0FBb0MsaUNBQWlDO0FBQ3JFLFNBQVMsa0JBQWtCO0FBRzNCLFNBQVMsd0JBQXdCO0FBR2pDLE1BQU0sd0JBQXdCO0FBQzlCLE1BQU0sK0JBQStCO0FBQ3JDLE1BQU0sa0NBQWtDO0FBQ3hDLE1BQU0sMENBQTBDO0FBQ2hELE1BQU0sMENBQTBDO0FBRWhELE1BQU0sMkNBQTJDO0FBQ2pELE1BQU0sdUNBQXVDO0FBQzdDLE1BQU0sbUNBQW1DO0FBQ3pDLE1BQU0sNENBQTRDO0FBQ2xELE1BQU0sNENBQTRDO0FBRWxELE1BQU0sbUNBQW1DO0FBQ3pDLE1BQU0sa0NBQWtDO0FBQ3hDLE1BQU0sd0NBQXdDO0FBSzlDLFNBQVMsR0FBd0IsaUJBQWlCLFVBQVUsRUFBRTtBQUFBLEVBQzdELHFCQUFxQjtBQUFBLElBQ3BCO0FBQUEsSUFDQSxhQUFhO0FBQUEsSUFDYixTQUFTLGdCQUFnQixlQUFlO0FBQUEsRUFDekM7QUFBQSxFQUNBO0FBQUEsSUFDQyxJQUFJLGVBQWUsaUJBQWlCO0FBQUEsRUFDckM7QUFDRDtBQUlBLElBQU0sMkJBQU4sTUFBaUU7QUFBQSxFQUloRSxZQUN5Qix1QkFDRCxzQkFDdEI7QUFDRCwwQkFBc0I7QUFBQSxNQUNyQixNQUFNO0FBQUEsTUFDTjtBQUFBLFFBQ0MsSUFBSSxrQkFBa0I7QUFBQSxRQUN0QixPQUFPLFNBQVMsMkNBQTJDLGVBQWU7QUFBQSxRQUMxRSxRQUFRLDJCQUEyQjtBQUFBLFFBQ25DLFVBQVUseUJBQXlCO0FBQUEsTUFDcEM7QUFBQSxNQUNBO0FBQUEsUUFDQyxtQkFBbUI7QUFBQSxRQUNuQixvQkFBb0IsY0FBYSxRQUFRLFFBQVEsTUFBTTtBQUFBLE1BQ3hEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsbUJBQW1CLENBQUMsRUFBRSxTQUFTLE1BQU07QUFDcEMsaUJBQU8sRUFBRSxRQUFRLHFCQUFxQixlQUFlLDRCQUE0QixFQUFFLE1BQU0sZ0JBQWdCLFNBQVMsU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUMvSDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBM0JNLHlCQUVXLEtBQUs7QUFGaEIsMkJBQU47QUFBQSxFQUtHO0FBQUEsRUFDQTtBQUFBLEdBTkc7QUE2Qk4sK0JBQStCLHlCQUF5QixJQUFJLDBCQUEwQixlQUFlLFlBQVk7QUFNakgsTUFBTSw0QkFBeUQ7QUFBQSxFQUU5RCxhQUFhLE9BQTBCO0FBQ3RDLFdBQU8sQ0FBQyxDQUFDLE1BQU0sa0JBQWtCO0FBQUEsRUFDbEM7QUFBQSxFQUVBLFVBQVUsT0FBMEI7QUFDbkMsUUFBSSxDQUFDLEtBQUssYUFBYSxLQUFLLEdBQUc7QUFDOUIsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLE1BQU0sV0FBVyxHQUFHO0FBQ3ZCLGFBQU8sS0FBSyxVQUFVLEVBQUUsVUFBVSxRQUFXLE9BQU8sT0FBTyxRQUFRLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxNQUFNLFFBQVEsR0FBRyxhQUFhLENBQUMsR0FBRyxZQUFZLE1BQU0sWUFBWSxTQUFTLEVBQUUsQ0FBa0M7QUFBQSxJQUNsTjtBQUVBLFFBQUksV0FBVztBQUNmLFFBQUksTUFBTSxTQUFTLFFBQVEsTUFBTSxTQUFTLFlBQVksTUFBTSxRQUFRLEdBQUc7QUFDdEUsaUJBQVcsTUFBTSxTQUFTLFNBQVM7QUFBQSxJQUNwQztBQUVBLFVBQU0sU0FBUyxNQUFNLGtCQUFrQjtBQUN2QyxVQUFNLFFBQVEsTUFBTSxRQUFRO0FBQzVCLFVBQU0sY0FBYyxRQUFRLE1BQU0sZUFBZSxJQUFJLENBQUM7QUFDdEQsVUFBTSxhQUFhLE1BQU07QUFFekIsV0FBTyxLQUFLLFVBQVUsRUFBRSxVQUFVLE9BQU8sUUFBUSxNQUFNLE1BQU0sUUFBUSxHQUFHLGFBQWEsWUFBWSxZQUFZLFNBQVMsRUFBRSxDQUFrQztBQUFBLEVBQzNKO0FBQUEsRUFFQSxZQUFZLHNCQUE2Qyx1QkFBOEQ7QUFDdEgsVUFBTSxFQUFFLFVBQVUsT0FBTyxRQUFRLGFBQWEsV0FBVyxJQUFJLEtBQUssTUFBTSxxQkFBcUI7QUFDN0YsUUFBSSxVQUFXLE9BQU8sVUFBVSxRQUFZO0FBQzNDLFVBQUksVUFBVTtBQUNiLGNBQU0sUUFBUSxxQkFBcUI7QUFBQSxVQUFlO0FBQUEsVUFDakQsRUFBRSxNQUFNLFNBQVMsVUFBVSxJQUFJLE1BQU0sUUFBUSxHQUFHLFFBQVEsVUFBVSxhQUFhLElBQUksTUFBTSxVQUFVLElBQUksT0FBVTtBQUFBLFFBQUM7QUFDbkgsY0FBTSxTQUFTLEtBQUs7QUFDcEIsY0FBTSxlQUFlLFdBQVc7QUFDaEMsZUFBTztBQUFBLE1BQ1IsT0FBTztBQUNOLFlBQUksWUFBWTtBQUNmLGlCQUFPLHFCQUFxQjtBQUFBLFlBQWU7QUFBQSxZQUMxQyxFQUFFLE1BQU0sZ0JBQWdCLFNBQVMsSUFBSSxNQUFNLFVBQVUsRUFBRTtBQUFBLFVBQUM7QUFBQSxRQUMxRCxPQUFPO0FBQ04saUJBQU8scUJBQXFCO0FBQUEsWUFBZTtBQUFBLFlBQzFDLEVBQUUsTUFBTSxXQUFXLGlCQUFpQixJQUFJLE9BQU87QUFBQSxVQUFDO0FBQUEsUUFDbEQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFFQSxTQUFTLEdBQTJCLGlCQUFpQixhQUFhLEVBQUU7QUFBQSxFQUNuRSxrQkFBa0I7QUFBQSxFQUNsQjtBQUEyQjtBQUk1QixpQkFBaUI7QUFBQSxFQUNoQjtBQUFBLEVBQ0EsQ0FBQyxhQUErQjtBQUMvQixVQUFNLG1CQUFtQixTQUFTLElBQUksY0FBYyxFQUFFO0FBQ3RELFFBQUksNEJBQTRCLGNBQWM7QUFDN0MsdUJBQWlCLFdBQVc7QUFBQSxJQUM3QjtBQUFBLEVBQ0Q7QUFBQztBQUlGLE1BQU0sV0FBVyxVQUFVLFVBQVUsZUFBZTtBQWlCcEQsTUFBTSx3QkFBd0IsQ0FBQyxlQUE4RCxDQUFDLE1BQTRCO0FBQ3pILFFBQU0sU0FBK0IsQ0FBQztBQUN0QyxRQUFNLFlBQWlGO0FBQUEsSUFDdEYsVUFBVTtBQUFBLElBQ1YsVUFBVTtBQUFBLElBQ1YsV0FBVztBQUFBLElBQ1gsZUFBZTtBQUFBLElBQ2YsUUFBUTtBQUFBLElBQ1IsWUFBWTtBQUFBLEVBQ2I7QUFDQSxTQUFPLFFBQVEsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDLEtBQUssS0FBSyxNQUFNO0FBQ3RELElBQUMsT0FBZ0IsVUFBa0IsR0FBRyxLQUFLLEdBQUcsSUFBSTtBQUFBLEVBQ25ELENBQUM7QUFDRCxTQUFPO0FBQ1I7QUFHQSxNQUFNLGtCQUFrQjtBQUFBLEVBQ3ZCLGFBQWE7QUFBQSxFQUNiLE1BQU0sQ0FBQztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ1AsWUFBWTtBQUFBLFFBQ1gsT0FBTyxFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ3hCLGdCQUFnQixFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ2pDLGdCQUFnQixFQUFFLE1BQU0sU0FBUztBQUFBLFFBQ2pDLGNBQWMsRUFBRSxNQUFNLFNBQVM7QUFBQSxRQUMvQixnQkFBZ0IsRUFBRSxNQUFNLFVBQVU7QUFBQSxRQUNsQyxpQkFBaUIsRUFBRSxNQUFNLFVBQVU7QUFBQSxRQUNuQyxVQUFVLEVBQUUsTUFBTSxVQUFVO0FBQUEsUUFDNUIsa0NBQWtDLEVBQUUsTUFBTSxVQUFVO0FBQUEsUUFDcEQsc0JBQXNCLEVBQUUsTUFBTSxVQUFVO0FBQUEsUUFDeEMsZUFBZSxFQUFFLE1BQU0sVUFBVTtBQUFBLFFBQ2pDLGNBQWMsRUFBRSxNQUFNLFVBQVU7QUFBQSxRQUNoQyxpQkFBaUIsRUFBRSxNQUFNLFVBQVU7QUFBQSxNQUNwQztBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFDRjtBQUVBLGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLGtDQUFrQyxxQkFBcUI7QUFBQSxNQUN4RSxZQUFZO0FBQUEsUUFDWCxRQUFRLGlCQUFpQjtBQUFBLFFBQ3pCLFNBQVMsT0FBTyxVQUFVLE9BQU8sUUFBUSxRQUFRO0FBQUEsTUFDbEQ7QUFBQSxNQUNBLGNBQWMsc0JBQXNCO0FBQUEsTUFDcEM7QUFBQSxNQUNBLElBQUk7QUFBQSxJQUNMLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFNLElBQUksVUFBNEI7QUFDckMsVUFBTSxpQkFBaUIsU0FBUyxJQUFJLGtCQUFrQixFQUFFLFdBQVcsaUJBQWlCLENBQUM7QUFDckYsUUFBSSxlQUFlLFNBQVMsc0JBQXNCLGVBQWUsVUFBVSxDQUFDLEdBQUc7QUFDOUUsTUFBQyxTQUFTLElBQUksY0FBYyxFQUFFLGlCQUFrQyxrQkFBa0I7QUFBQSxJQUNuRjtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJLHNCQUFzQjtBQUFBLE1BQzFCLE9BQU8sVUFBVSw4QkFBOEIsbUJBQW1CO0FBQUEsTUFDbEU7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLFVBQVU7QUFBQSxJQUNYLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNLElBQUksVUFBNEIsTUFBcUQ7QUFDMUYsVUFBTSxTQUFTLElBQUkscUJBQXFCLEVBQUUsZUFBZSxxQkFBcUIsc0JBQXNCLEVBQUUsVUFBVSxPQUFPLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFBQSxFQUNsSTtBQUNELENBQUM7QUFFRCxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUksc0JBQXNCO0FBQUEsTUFDMUIsT0FBTyxVQUFVLDJCQUEyQixvQkFBb0I7QUFBQSxNQUNoRTtBQUFBLE1BQ0EsSUFBSTtBQUFBLE1BQ0osVUFBVTtBQUFBLElBQ1gsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sSUFBSSxVQUE0QixNQUFxRDtBQUMxRixVQUFNLFNBQVMsSUFBSSxxQkFBcUIsRUFBRSxlQUFlLHFCQUFxQixzQkFBc0IsRUFBRSxVQUFVLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQztBQUFBLEVBQ3BJO0FBQ0QsQ0FBQztBQUVELGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLDhCQUE4QixvQ0FBb0M7QUFBQSxNQUNuRjtBQUFBLE1BQ0EsSUFBSTtBQUFBLE1BQ0osVUFBVTtBQUFBLElBQ1gsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sSUFBSSxVQUE0QixNQUFxRDtBQUMxRixVQUFNLFNBQVMsSUFBSSxxQkFBcUIsRUFBRSxlQUFlLHFCQUFxQixzQkFBc0IsSUFBSSxHQUFHLElBQUk7QUFBQSxFQUNoSDtBQUNELENBQUM7QUFFRCxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSw4QkFBOEIsd0JBQXdCO0FBQUEsTUFDdkU7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLFlBQVk7QUFBQSxRQUNYLFNBQVMsT0FBTyxNQUFNLFFBQVE7QUFBQSxRQUM5QixNQUFNLGVBQWUsSUFBSSxnQkFBZ0IsY0FBYyxrQkFBa0IsZ0JBQWdCLGNBQWMsb0JBQW9CO0FBQUEsUUFDM0gsUUFBUSxpQkFBaUI7QUFBQSxRQUN6QixLQUFLO0FBQUEsVUFDSixTQUFTLE9BQU8sVUFBVSxRQUFRO0FBQUEsUUFDbkM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTSxJQUFJLFVBQTRCO0FBQ3JDLFVBQU0sZUFBZSxTQUFTLElBQUksYUFBYTtBQUMvQyxVQUFNLHVCQUF1QixTQUFTLElBQUkscUJBQXFCO0FBQy9ELFVBQU0sYUFBYSxjQUFjLFlBQVk7QUFDN0MsUUFBSSxZQUFZO0FBQ2YsWUFBTSxxQkFBcUIsZUFBZSw4QkFBOEIsV0FBVyxjQUFjLFdBQVcscUJBQXFCLFNBQVMsR0FBRyxXQUFXLHFCQUFxQixTQUFTLEdBQUcsV0FBVyxxQkFBcUIsd0JBQXdCLENBQUM7QUFBQSxJQUNuUDtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsOEJBQThCLGNBQWM7QUFBQSxNQUM3RDtBQUFBLE1BQ0EsWUFBWTtBQUFBLFFBQ1gsU0FBUyxPQUFPLFVBQVUsT0FBTyxRQUFRLFFBQVE7QUFBQSxRQUNqRCxNQUFNLHNCQUFzQjtBQUFBLFFBQzVCLFFBQVEsaUJBQWlCO0FBQUEsTUFDMUI7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxRQUFDO0FBQUEsVUFDTixJQUFJLE9BQU87QUFBQSxVQUNYLE9BQU87QUFBQSxVQUNQLE1BQU0sb0JBQW9CLFVBQVUsc0JBQXNCLGNBQWM7QUFBQSxRQUN6RTtBQUFBLFFBQ0E7QUFBQSxVQUNDLElBQUksT0FBTztBQUFBLFVBQ1gsTUFBTSxvQkFBb0IsVUFBVSxzQkFBc0IsY0FBYztBQUFBLFFBQ3pFO0FBQUEsTUFBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sSUFBSSxVQUE0QjtBQUNyQyxVQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxVQUFNLFFBQVEsY0FBYztBQUM1QixRQUFJLGlCQUFpQixtQkFBbUI7QUFDdkMsTUFBQyxjQUFjLGlCQUFrQyxjQUFjLEVBQUUsYUFBYSxNQUFNLENBQUM7QUFBQSxJQUN0RjtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsd0NBQXdDLDJCQUEyQjtBQUFBLE1BQ3BGO0FBQUEsTUFDQSxJQUFJO0FBQUEsTUFDSixjQUFjLHNCQUFzQjtBQUFBLE1BQ3BDLFlBQVk7QUFBQSxRQUNYLFNBQVMsUUFBUTtBQUFBLFFBQ2pCLFFBQVEsaUJBQWlCO0FBQUEsTUFDMUI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNLElBQUksVUFBNEI7QUFDckMsVUFBTSxnQkFBZ0IsU0FBUyxJQUFJLGNBQWM7QUFDakQsVUFBTSxRQUFRLGNBQWM7QUFDNUIsUUFBSSxpQkFBaUIsbUJBQW1CO0FBQ3ZDLE1BQUMsY0FBYyxpQkFBa0MsaUJBQWlCO0FBQUEsSUFDbkU7QUFBQSxFQUNEO0FBQ0QsQ0FBQztBQUVELGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLHFDQUFxQyxzQ0FBc0M7QUFBQSxNQUM1RjtBQUFBLE1BQ0EsSUFBSTtBQUFBLE1BQ0osY0FBYyxzQkFBc0I7QUFBQSxJQUNyQyxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTSxJQUFJLFVBQTRCO0FBQ3JDLFVBQU0sZ0JBQWdCLFNBQVMsSUFBSSxjQUFjO0FBQ2pELFVBQU0sUUFBUSxjQUFjO0FBQzVCLFFBQUksaUJBQWlCLG1CQUFtQjtBQUN2QyxNQUFDLGNBQWMsaUJBQWtDLHlCQUF5QjtBQUFBLElBQzNFO0FBQUEsRUFDRDtBQUNELENBQUM7QUFFRCxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSxxQ0FBcUMsc0NBQXNDO0FBQUEsTUFDNUY7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLGNBQWMsc0JBQXNCO0FBQUEsSUFDckMsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU0sSUFBSSxVQUE0QjtBQUNyQyxVQUFNLGdCQUFnQixTQUFTLElBQUksY0FBYztBQUNqRCxVQUFNLFFBQVEsY0FBYztBQUM1QixRQUFJLGlCQUFpQixtQkFBbUI7QUFDdkMsTUFBQyxjQUFjLGlCQUFrQyx5QkFBeUI7QUFBQSxJQUMzRTtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsdURBQXVELG1CQUFtQjtBQUFBLE1BQzNGO0FBQUEsTUFDQSxJQUFJO0FBQUEsTUFDSixjQUFjLHNCQUFzQjtBQUFBLE1BQ3BDLFlBQVksT0FBTyxPQUFPO0FBQUEsUUFDekIsUUFBUSxpQkFBaUI7QUFBQSxRQUN6QixNQUFNLGdCQUFnQixjQUFjO0FBQUEsTUFDckMsR0FBRyw2QkFBNkI7QUFBQSxJQUNqQyxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsSUFBSSxVQUE0QjtBQUMvQiwyQ0FBdUMsUUFBUTtBQUFBLEVBQ2hEO0FBQ0QsQ0FBQztBQUVELGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLG1EQUFtRCx5QkFBeUI7QUFBQSxNQUM3RjtBQUFBLE1BQ0EsSUFBSTtBQUFBLE1BQ0osY0FBYyxzQkFBc0I7QUFBQSxNQUNwQyxZQUFZLE9BQU8sT0FBTztBQUFBLFFBQ3pCLFFBQVEsaUJBQWlCO0FBQUEsUUFDekIsTUFBTSxnQkFBZ0IsY0FBYztBQUFBLE1BQ3JDLEdBQUcseUJBQXlCO0FBQUEsSUFDN0IsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksVUFBNEI7QUFDL0IsdUNBQW1DLFFBQVE7QUFBQSxFQUM1QztBQUNELENBQUM7QUFFRCxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSwrQ0FBK0MsK0JBQStCO0FBQUEsTUFDL0Y7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLGNBQWMsc0JBQXNCO0FBQUEsTUFDcEMsWUFBWSxPQUFPLE9BQU87QUFBQSxRQUN6QixRQUFRLGlCQUFpQjtBQUFBLFFBQ3pCLE1BQU0sZ0JBQWdCLGNBQWM7QUFBQSxNQUNyQyxHQUFHLHFCQUFxQjtBQUFBLElBQ3pCLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxJQUFJLFVBQTRCO0FBQy9CLG1DQUErQixRQUFRO0FBQUEsRUFDeEM7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJLHNCQUFzQjtBQUFBLE1BQzFCLE9BQU8sVUFBVSxzREFBc0Qsc0JBQXNCO0FBQUEsTUFDN0Y7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLGNBQWMsc0JBQXNCO0FBQUEsTUFDcEMsWUFBWTtBQUFBLFFBQ1gsUUFBUSxpQkFBaUI7QUFBQSxRQUN6QixTQUFTLE9BQU8sTUFBTSxRQUFRO0FBQUEsUUFDOUIsS0FBSyxFQUFFLFNBQVMsT0FBTyxVQUFVLE9BQU8sTUFBTSxRQUFRLEtBQUs7QUFBQSxNQUM1RDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksVUFBNEI7QUFDL0IsMENBQXNDLFFBQVE7QUFBQSxFQUMvQztBQUNELENBQUM7QUFFRCxnQkFBZ0IsY0FBYyxRQUFRO0FBQUEsRUFDckMsY0FBYztBQUNiLFVBQU07QUFBQSxNQUNMLElBQUk7QUFBQSxNQUNKLE9BQU8sVUFBVSx3REFBd0Qsd0JBQXdCO0FBQUEsTUFDakc7QUFBQSxNQUNBLElBQUk7QUFBQSxNQUNKLGNBQWMsc0JBQXNCO0FBQUEsTUFDcEMsWUFBWTtBQUFBLFFBQ1gsUUFBUSxpQkFBaUI7QUFBQSxRQUN6QixTQUFTLE9BQU8sTUFBTSxRQUFRO0FBQUEsTUFDL0I7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFDQSxJQUFJLFVBQTRCO0FBQUUsMENBQXNDLFVBQVUsSUFBSTtBQUFBLEVBQUc7QUFDMUYsQ0FBQztBQUVELGdCQUFnQixjQUFjLFFBQVE7QUFBQSxFQUNyQyxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxVQUFVLHdEQUF3RCx3QkFBd0I7QUFBQSxNQUNqRztBQUFBLE1BQ0EsSUFBSTtBQUFBLE1BQ0osY0FBYyxzQkFBc0I7QUFBQSxNQUNwQyxZQUFZO0FBQUEsUUFDWCxRQUFRLGlCQUFpQjtBQUFBLFFBQ3pCLFNBQVMsT0FBTyxNQUFNLFFBQVE7QUFBQSxNQUMvQjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksVUFBNEI7QUFBRSwwQ0FBc0MsVUFBVSxLQUFLO0FBQUEsRUFBRztBQUMzRixDQUFDO0FBRUQsZ0JBQWdCLGNBQWMsUUFBUTtBQUFBLEVBQ3JDLGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFVBQVUsb0RBQW9ELG9CQUFvQjtBQUFBLE1BQ3pGO0FBQUEsTUFDQSxJQUFJO0FBQUEsTUFDSixjQUFjLHNCQUFzQjtBQUFBLE1BQ3BDLFlBQVk7QUFBQSxRQUNYLFFBQVEsaUJBQWlCO0FBQUEsUUFDekIsU0FBUyxPQUFPLFVBQVUsT0FBTyxRQUFRLFFBQVE7QUFBQSxNQUNsRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksVUFBNEI7QUFDL0Isd0NBQW9DLFFBQVE7QUFBQSxFQUM3QztBQUNELENBQUM7QUFFRCxnQkFBZ0IsTUFBTSwrQkFBK0IsUUFBUTtBQUFBLEVBQzVELGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJO0FBQUEsTUFDSixPQUFPLFNBQVMsd0JBQXdCLHdCQUF3QjtBQUFBLE1BQ2hFO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixNQUFNLENBQUM7QUFBQSxRQUNOLElBQUksT0FBTztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsTUFBTSxlQUFlLE9BQU8sUUFBUSxPQUFPO0FBQUEsTUFDNUMsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksYUFBK0IsTUFBYTtBQUMvQyxXQUFPLGlCQUFpQixRQUFRO0FBQUEsRUFDakM7QUFDRCxDQUFDO0FBSUQsSUFBTSx1Q0FBTixjQUFtRCxXQUF3RTtBQUFBLEVBSTFILFlBQ3lDLHNCQUNiLDBCQUMxQjtBQUNELFVBQU07QUFIa0M7QUFLeEMsU0FBSyxVQUFVLHlCQUF5QixnQkFBZ0IsSUFBSSxDQUFDO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLFFBQVEsYUFBOEM7QUFDckQsV0FBTyxZQUFZLFNBQVMsV0FBVyxzQkFBc0I7QUFBQSxFQUM5RDtBQUFBLEVBRUEsT0FBTyxhQUFxQyxRQUE4QjtBQUN6RSxRQUFJLENBQUMsS0FBSyxRQUFRLFdBQVcsR0FBRztBQUMvQixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sa0JBQWtCLHFCQUFxQixRQUFRLFlBQVksVUFBVSxPQUFPLFFBQVE7QUFBQSxFQUM1RjtBQUFBLEVBRUEsYUFBYSxhQUFrRDtBQUM5RCxVQUFNLFFBQVEsS0FBSyxxQkFBcUIsZUFBZSw0QkFBNEIsRUFBRSxNQUFNLFNBQVMsVUFBVSxZQUFZLFNBQVMsQ0FBQztBQUNwSSxVQUFNLFNBQVMsSUFBSTtBQUVuQixXQUFPO0FBQUEsRUFDUjtBQUNEO0FBL0JNLHFDQUVXLEtBQUs7QUFGaEIsdUNBQU47QUFBQSxFQUtHO0FBQUEsRUFDQTtBQUFBLEdBTkc7QUFpQ04sK0JBQStCLHFDQUFxQyxJQUFJLHNDQUFzQyxlQUFlLFlBQVk7IiwKICAibmFtZXMiOiBbXQp9Cg==
