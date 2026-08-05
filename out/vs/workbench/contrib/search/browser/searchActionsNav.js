var _a;
import { isMacintosh } from "../../../../base/common/platform.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import * as Constants from "../common/constants.js";
import * as SearchEditorConstants from "../../searchEditor/browser/constants.js";
import { SearchEditorInput } from "../../searchEditor/browser/searchEditorInput.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { ToggleCaseSensitiveKeybinding, TogglePreserveCaseKeybinding, ToggleRegexKeybinding, ToggleWholeWordKeybinding } from "../../../../editor/contrib/find/browser/findModel.js";
import { category, getSearchView, openSearchView } from "./searchActionsBase.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { getActiveElement } from "../../../../base/browser/dom.js";
import { isSearchTreeFolderMatch } from "./searchTreeModel/searchTreeCommon.js";
registerAction2(class ToggleQueryDetailsAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ToggleQueryDetailsActionId,
      title: nls.localize2("ToggleQueryDetailsAction.label", "Toggle Query Details"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.or(Constants.SearchContext.SearchViewFocusedKey, SearchEditorConstants.InSearchEditor),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyJ
      }
    });
  }
  run(accessor, ...args) {
    const contextService = accessor.get(IContextKeyService).getContext(getActiveElement());
    if (contextService.getValue(SearchEditorConstants.InSearchEditor.serialize())) {
      accessor.get(IEditorService).activeEditorPane.toggleQueryDetails(args[0]?.show);
    } else if (contextService.getValue(Constants.SearchContext.SearchViewFocusedKey.serialize())) {
      const searchView = getSearchView(accessor.get(IViewsService));
      assertIsDefined(searchView).toggleQueryDetails(void 0, args[0]?.show);
    }
  }
});
registerAction2(class CloseReplaceAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.CloseReplaceWidgetActionId,
      title: nls.localize2("CloseReplaceWidget.label", "Close Replace Widget"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceInputBoxFocusedKey),
        primary: KeyCode.Escape
      }
    });
  }
  run(accessor) {
    const searchView = getSearchView(accessor.get(IViewsService));
    if (searchView) {
      searchView.searchAndReplaceWidget.toggleReplace(false);
      searchView.searchAndReplaceWidget.focus();
    }
    return Promise.resolve(null);
  }
});
registerAction2(class ToggleCaseSensitiveCommandAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ToggleCaseSensitiveCommandId,
      title: nls.localize2("ToggleCaseSensitiveCommandId.label", "Toggle Case Sensitive"),
      category,
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: isMacintosh ? ContextKeyExpr.and(Constants.SearchContext.SearchViewFocusedKey, Constants.SearchContext.FileMatchOrFolderMatchFocusKey.toNegated()) : Constants.SearchContext.SearchViewFocusedKey
      }, ToggleCaseSensitiveKeybinding)
    });
  }
  async run(accessor) {
    toggleCaseSensitiveCommand(accessor);
  }
});
registerAction2(class ToggleWholeWordCommandAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ToggleWholeWordCommandId,
      title: nls.localize2("ToggleWholeWordCommandId.label", "Toggle Whole Word"),
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: Constants.SearchContext.SearchViewFocusedKey
      }, ToggleWholeWordKeybinding),
      category
    });
  }
  async run(accessor) {
    return toggleWholeWordCommand(accessor);
  }
});
registerAction2(class ToggleRegexCommandAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ToggleRegexCommandId,
      title: nls.localize2("ToggleRegexCommandId.label", "Toggle Regex"),
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: Constants.SearchContext.SearchViewFocusedKey
      }, ToggleRegexKeybinding),
      category
    });
  }
  async run(accessor) {
    return toggleRegexCommand(accessor);
  }
});
registerAction2(class TogglePreserveCaseAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.TogglePreserveCaseId,
      title: nls.localize2("TogglePreserveCaseId.label", "Toggle Preserve Case"),
      keybinding: Object.assign({
        weight: KeybindingWeight.WorkbenchContrib,
        when: Constants.SearchContext.SearchViewFocusedKey
      }, TogglePreserveCaseKeybinding),
      category
    });
  }
  async run(accessor) {
    return togglePreserveCaseCommand(accessor);
  }
});
registerAction2(class OpenMatchAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.OpenMatch,
      title: nls.localize2("OpenMatch.label", "Open Match"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.FileMatchOrMatchFocusKey),
        primary: KeyCode.Enter,
        mac: {
          primary: KeyCode.Enter,
          secondary: [KeyMod.CtrlCmd | KeyCode.DownArrow]
        }
      }
    });
  }
  run(accessor) {
    const searchView = getSearchView(accessor.get(IViewsService));
    if (searchView) {
      const tree = searchView.getControl();
      const viewer = searchView.getControl();
      const focus = tree.getFocus()[0];
      if (isSearchTreeFolderMatch(focus)) {
        viewer.toggleCollapsed(focus);
      } else {
        searchView.open(tree.getFocus()[0], false, false, true);
      }
    }
  }
});
registerAction2(class OpenMatchToSideAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.OpenMatchToSide,
      title: nls.localize2("OpenMatchToSide.label", "Open Match To Side"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.FileMatchOrMatchFocusKey),
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        mac: {
          primary: KeyMod.WinCtrl | KeyCode.Enter
        }
      }
    });
  }
  run(accessor) {
    const searchView = getSearchView(accessor.get(IViewsService));
    if (searchView) {
      const tree = searchView.getControl();
      searchView.open(tree.getFocus()[0], false, true, true);
    }
  }
});
registerAction2(class AddCursorsAtSearchResultsAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.AddCursorsAtSearchResults,
      title: nls.localize2("AddCursorsAtSearchResults.label", "Add Cursors at Search Results"),
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.FileMatchOrMatchFocusKey),
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyL
      },
      category
    });
  }
  async run(accessor) {
    const searchView = getSearchView(accessor.get(IViewsService));
    if (searchView) {
      const tree = searchView.getControl();
      searchView.openEditorWithMultiCursor(tree.getFocus()[0]);
    }
  }
});
registerAction2(class FocusNextInputAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusNextInputActionId,
      title: nls.localize2("FocusNextInputAction.label", "Focus Next Input"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.or(
          ContextKeyExpr.and(SearchEditorConstants.InSearchEditor, Constants.SearchContext.InputBoxFocusedKey),
          ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.InputBoxFocusedKey)
        ),
        primary: KeyMod.CtrlCmd | KeyCode.DownArrow
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.focusNextInput();
    }
    const searchView = getSearchView(accessor.get(IViewsService));
    searchView?.focusNextInputBox();
  }
});
registerAction2(class FocusPreviousInputAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusPreviousInputActionId,
      title: nls.localize2("FocusPreviousInputAction.label", "Focus Previous Input"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.or(
          ContextKeyExpr.and(SearchEditorConstants.InSearchEditor, Constants.SearchContext.InputBoxFocusedKey),
          ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.InputBoxFocusedKey, Constants.SearchContext.SearchInputBoxFocusedKey.toNegated())
        ),
        primary: KeyMod.CtrlCmd | KeyCode.UpArrow
      }
    });
  }
  async run(accessor) {
    const editorService = accessor.get(IEditorService);
    const input = editorService.activeEditor;
    if (input instanceof SearchEditorInput) {
      editorService.activeEditorPane.focusPrevInput();
    }
    const searchView = getSearchView(accessor.get(IViewsService));
    searchView?.focusPreviousInputBox();
  }
});
registerAction2(class FocusSearchFromResultsAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusSearchFromResults,
      title: nls.localize2("FocusSearchFromResults.label", "Focus Search From Results"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, ContextKeyExpr.or(Constants.SearchContext.FirstMatchFocusKey, CONTEXT_ACCESSIBILITY_MODE_ENABLED)),
        primary: KeyMod.CtrlCmd | KeyCode.UpArrow
      }
    });
  }
  run(accessor) {
    const searchView = getSearchView(accessor.get(IViewsService));
    searchView?.focusPreviousInputBox();
  }
});
registerAction2((_a = class extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ToggleSearchOnTypeActionId,
      title: nls.localize2("toggleTabs", "Toggle Search on Type"),
      category
    });
  }
  async run(accessor) {
    const configurationService = accessor.get(IConfigurationService);
    const searchOnType = configurationService.getValue(_a.searchOnTypeKey);
    return configurationService.updateValue(_a.searchOnTypeKey, !searchOnType);
  }
}, _a.searchOnTypeKey = "search.searchOnType", _a));
registerAction2(class FocusSearchListCommandAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusSearchListCommandID,
      title: nls.localize2("focusSearchListCommandLabel", "Focus List"),
      category,
      f1: true
    });
  }
  async run(accessor) {
    focusSearchListCommand(accessor);
  }
});
registerAction2(class FocusNextSearchResultAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusNextSearchResultActionId,
      title: nls.localize2("FocusNextSearchResult.label", "Focus Next Search Result"),
      keybinding: [{
        primary: KeyCode.F4,
        weight: KeybindingWeight.WorkbenchContrib
      }],
      category,
      f1: true,
      precondition: ContextKeyExpr.or(Constants.SearchContext.HasSearchResults, SearchEditorConstants.InSearchEditor)
    });
  }
  async run(accessor) {
    return await focusNextSearchResult(accessor);
  }
});
registerAction2(class FocusPreviousSearchResultAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.FocusPreviousSearchResultActionId,
      title: nls.localize2("FocusPreviousSearchResult.label", "Focus Previous Search Result"),
      keybinding: [{
        primary: KeyMod.Shift | KeyCode.F4,
        weight: KeybindingWeight.WorkbenchContrib
      }],
      category,
      f1: true,
      precondition: ContextKeyExpr.or(Constants.SearchContext.HasSearchResults, SearchEditorConstants.InSearchEditor)
    });
  }
  async run(accessor) {
    return await focusPreviousSearchResult(accessor);
  }
});
registerAction2(class ReplaceInFilesAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ReplaceInFilesActionId,
      title: nls.localize2("replaceInFiles", "Replace in Files"),
      keybinding: [{
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyH,
        weight: KeybindingWeight.WorkbenchContrib
      }],
      category,
      f1: true,
      menu: [{
        id: MenuId.MenubarEditMenu,
        group: "4_find_global",
        order: 2
      }]
    });
  }
  async run(accessor) {
    return await findOrReplaceInFiles(accessor, true);
  }
});
function toggleCaseSensitiveCommand(accessor) {
  const searchView = getSearchView(accessor.get(IViewsService));
  searchView?.toggleCaseSensitive();
}
function toggleWholeWordCommand(accessor) {
  const searchView = getSearchView(accessor.get(IViewsService));
  searchView?.toggleWholeWords();
}
function toggleRegexCommand(accessor) {
  const searchView = getSearchView(accessor.get(IViewsService));
  searchView?.toggleRegex();
}
function togglePreserveCaseCommand(accessor) {
  const searchView = getSearchView(accessor.get(IViewsService));
  searchView?.togglePreserveCase();
}
const focusSearchListCommand = (accessor) => {
  const viewsService = accessor.get(IViewsService);
  openSearchView(viewsService).then((searchView) => {
    searchView?.moveFocusToResults();
  });
};
async function focusNextSearchResult(accessor) {
  const editorService = accessor.get(IEditorService);
  const input = editorService.activeEditor;
  if (input instanceof SearchEditorInput) {
    return editorService.activeEditorPane.focusNextResult();
  }
  return openSearchView(accessor.get(IViewsService)).then((searchView) => searchView?.selectNextMatch());
}
async function focusPreviousSearchResult(accessor) {
  const editorService = accessor.get(IEditorService);
  const input = editorService.activeEditor;
  if (input instanceof SearchEditorInput) {
    return editorService.activeEditorPane.focusPreviousResult();
  }
  return openSearchView(accessor.get(IViewsService)).then((searchView) => searchView?.selectPreviousMatch());
}
async function findOrReplaceInFiles(accessor, expandSearchReplaceWidget) {
  return openSearchView(accessor.get(IViewsService), false).then((openedView) => {
    if (openedView) {
      const searchAndReplaceWidget = openedView.searchAndReplaceWidget;
      searchAndReplaceWidget.toggleReplace(expandSearchReplaceWidget);
      const updatedText = openedView.updateTextFromFindWidgetOrSelection({ allowUnselectedWord: !expandSearchReplaceWidget });
      openedView.searchAndReplaceWidget.focus(void 0, updatedText, updatedText);
    }
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hBY3Rpb25zTmF2LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kSGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgQ29uc3RhbnRzIGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0ICogYXMgU2VhcmNoRWRpdG9yQ29uc3RhbnRzIGZyb20gJy4uLy4uL3NlYXJjaEVkaXRvci9icm93c2VyL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hFZGl0b3IgfSBmcm9tICcuLi8uLi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3IuanMnO1xuaW1wb3J0IHsgU2VhcmNoRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9zZWFyY2hFZGl0b3IvYnJvd3Nlci9zZWFyY2hFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRJc0RlZmluZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgVG9nZ2xlQ2FzZVNlbnNpdGl2ZUtleWJpbmRpbmcsIFRvZ2dsZVByZXNlcnZlQ2FzZUtleWJpbmRpbmcsIFRvZ2dsZVJlZ2V4S2V5YmluZGluZywgVG9nZ2xlV2hvbGVXb3JkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2ZpbmQvYnJvd3Nlci9maW5kTW9kZWwuanMnO1xuaW1wb3J0IHsgY2F0ZWdvcnksIGdldFNlYXJjaFZpZXcsIG9wZW5TZWFyY2hWaWV3IH0gZnJvbSAnLi9zZWFyY2hBY3Rpb25zQmFzZS5qcyc7XG5pbXBvcnQgeyBDT05URVhUX0FDQ0VTU0lCSUxJVFlfTU9ERV9FTkFCTEVEIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBnZXRBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBGaWxlTWF0Y2hPck1hdGNoLCBSZW5kZXJhYmxlTWF0Y2gsIElTZWFyY2hSZXN1bHQsIGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoIH0gZnJvbSAnLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5cbi8vI3JlZ2lvbiBBY3Rpb25zOiBDaGFuZ2luZyBTZWFyY2ggSW5wdXQgT3B0aW9uc1xucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFRvZ2dsZVF1ZXJ5RGV0YWlsc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuVG9nZ2xlUXVlcnlEZXRhaWxzQWN0aW9uSWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignVG9nZ2xlUXVlcnlEZXRhaWxzQWN0aW9uLmxhYmVsJywgXCJUb2dnbGUgUXVlcnkgRGV0YWlsc1wiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld0ZvY3VzZWRLZXksIFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvciksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlKLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgY29udGV4dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKS5nZXRDb250ZXh0KGdldEFjdGl2ZUVsZW1lbnQoKSk7XG5cdFx0aWYgKGNvbnRleHRTZXJ2aWNlLmdldFZhbHVlKFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvci5zZXJpYWxpemUoKSkpIHtcblx0XHRcdChhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS50b2dnbGVRdWVyeURldGFpbHMoYXJnc1swXT8uc2hvdyk7XG5cdFx0fSBlbHNlIGlmIChjb250ZXh0U2VydmljZS5nZXRWYWx1ZShDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3Rm9jdXNlZEtleS5zZXJpYWxpemUoKSkpIHtcblx0XHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0XHRhc3NlcnRJc0RlZmluZWQoc2VhcmNoVmlldykudG9nZ2xlUXVlcnlEZXRhaWxzKHVuZGVmaW5lZCwgYXJnc1swXT8uc2hvdyk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIENsb3NlUmVwbGFjZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuQ2xvc2VSZXBsYWNlV2lkZ2V0QWN0aW9uSWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignQ2xvc2VSZXBsYWNlV2lkZ2V0LmxhYmVsJywgXCJDbG9zZSBSZXBsYWNlIFdpZGdldFwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXBsYWNlSW5wdXRCb3hGb2N1c2VkS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXG5cdFx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKTtcblx0XHRpZiAoc2VhcmNoVmlldykge1xuXHRcdFx0c2VhcmNoVmlldy5zZWFyY2hBbmRSZXBsYWNlV2lkZ2V0LnRvZ2dsZVJlcGxhY2UoZmFsc2UpO1xuXHRcdFx0c2VhcmNoVmlldy5zZWFyY2hBbmRSZXBsYWNlV2lkZ2V0LmZvY3VzKCk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ2FzZVNlbnNpdGl2ZUNvbW1hbmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuVG9nZ2xlQ2FzZVNlbnNpdGl2ZUNvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdUb2dnbGVDYXNlU2Vuc2l0aXZlQ29tbWFuZElkLmxhYmVsJywgXCJUb2dnbGUgQ2FzZSBTZW5zaXRpdmVcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGtleWJpbmRpbmc6IE9iamVjdC5hc3NpZ24oe1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogaXNNYWNpbnRvc2ggPyBDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld0ZvY3VzZWRLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZpbGVNYXRjaE9yRm9sZGVyTWF0Y2hGb2N1c0tleS50b05lZ2F0ZWQoKSkgOiBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3Rm9jdXNlZEtleSxcblx0XHRcdH0sIFRvZ2dsZUNhc2VTZW5zaXRpdmVLZXliaW5kaW5nKVxuXG5cdFx0fSk7XG5cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0dG9nZ2xlQ2FzZVNlbnNpdGl2ZUNvbW1hbmQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFRvZ2dsZVdob2xlV29yZENvbW1hbmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZVdob2xlV29yZENvbW1hbmRJZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdUb2dnbGVXaG9sZVdvcmRDb21tYW5kSWQubGFiZWwnLCBcIlRvZ2dsZSBXaG9sZSBXb3JkXCIpLFxuXHRcdFx0a2V5YmluZGluZzogT2JqZWN0LmFzc2lnbih7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3Rm9jdXNlZEtleSxcblx0XHRcdH0sIFRvZ2dsZVdob2xlV29yZEtleWJpbmRpbmcpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0b2dnbGVXaG9sZVdvcmRDb21tYW5kKGFjY2Vzc29yKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVSZWdleENvbW1hbmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZVJlZ2V4Q29tbWFuZElkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1RvZ2dsZVJlZ2V4Q29tbWFuZElkLmxhYmVsJywgXCJUb2dnbGUgUmVnZXhcIiksXG5cdFx0XHRrZXliaW5kaW5nOiBPYmplY3QuYXNzaWduKHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdGb2N1c2VkS2V5LFxuXHRcdFx0fSwgVG9nZ2xlUmVnZXhLZXliaW5kaW5nKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gdG9nZ2xlUmVnZXhDb21tYW5kKGFjY2Vzc29yKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVQcmVzZXJ2ZUNhc2VBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZVByZXNlcnZlQ2FzZUlkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1RvZ2dsZVByZXNlcnZlQ2FzZUlkLmxhYmVsJywgXCJUb2dnbGUgUHJlc2VydmUgQ2FzZVwiKSxcblx0XHRcdGtleWJpbmRpbmc6IE9iamVjdC5hc3NpZ24oe1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld0ZvY3VzZWRLZXksXG5cdFx0XHR9LCBUb2dnbGVQcmVzZXJ2ZUNhc2VLZXliaW5kaW5nKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gdG9nZ2xlUHJlc2VydmVDYXNlQ29tbWFuZChhY2Nlc3Nvcik7XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cbi8vI3JlZ2lvbiBBY3Rpb25zOiBPcGVuaW5nIE1hdGNoZXNcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBPcGVuTWF0Y2hBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLk9wZW5NYXRjaCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdPcGVuTWF0Y2gubGFiZWwnLCBcIk9wZW4gTWF0Y2hcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3VmlzaWJsZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZU1hdGNoT3JNYXRjaEZvY3VzS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93XVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBzZWFyY2hWaWV3ID0gZ2V0U2VhcmNoVmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkpO1xuXHRcdGlmIChzZWFyY2hWaWV3KSB7XG5cdFx0XHRjb25zdCB0cmVlOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaD4gPSBzZWFyY2hWaWV3LmdldENvbnRyb2woKTtcblx0XHRcdGNvbnN0IHZpZXdlciA9IHNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpO1xuXHRcdFx0Y29uc3QgZm9jdXMgPSB0cmVlLmdldEZvY3VzKClbMF07XG5cblx0XHRcdGlmIChpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChmb2N1cykpIHtcblx0XHRcdFx0dmlld2VyLnRvZ2dsZUNvbGxhcHNlZChmb2N1cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWFyY2hWaWV3Lm9wZW4oPEZpbGVNYXRjaE9yTWF0Y2g+dHJlZS5nZXRGb2N1cygpWzBdLCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBPcGVuTWF0Y2hUb1NpZGVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLk9wZW5NYXRjaFRvU2lkZSxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdPcGVuTWF0Y2hUb1NpZGUubGFiZWwnLCBcIk9wZW4gTWF0Y2ggVG8gU2lkZVwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaWxlTWF0Y2hPck1hdGNoRm9jdXNLZXkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5XaW5DdHJsIHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBzZWFyY2hWaWV3ID0gZ2V0U2VhcmNoVmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkpO1xuXHRcdGlmIChzZWFyY2hWaWV3KSB7XG5cdFx0XHRjb25zdCB0cmVlOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaD4gPSBzZWFyY2hWaWV3LmdldENvbnRyb2woKTtcblx0XHRcdHNlYXJjaFZpZXcub3Blbig8RmlsZU1hdGNoT3JNYXRjaD50cmVlLmdldEZvY3VzKClbMF0sIGZhbHNlLCB0cnVlLCB0cnVlKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQWRkQ3Vyc29yc0F0U2VhcmNoUmVzdWx0c0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuQWRkQ3Vyc29yc0F0U2VhcmNoUmVzdWx0cyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdBZGRDdXJzb3JzQXRTZWFyY2hSZXN1bHRzLmxhYmVsJywgXCJBZGQgQ3Vyc29ycyBhdCBTZWFyY2ggUmVzdWx0c1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3VmlzaWJsZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZU1hdGNoT3JNYXRjaEZvY3VzS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUwsXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0aWYgKHNlYXJjaFZpZXcpIHtcblx0XHRcdGNvbnN0IHRyZWU6IFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWU8SVNlYXJjaFJlc3VsdCwgUmVuZGVyYWJsZU1hdGNoPiA9IHNlYXJjaFZpZXcuZ2V0Q29udHJvbCgpO1xuXHRcdFx0c2VhcmNoVmlldy5vcGVuRWRpdG9yV2l0aE11bHRpQ3Vyc29yKDxGaWxlTWF0Y2hPck1hdGNoPnRyZWUuZ2V0Rm9jdXMoKVswXSk7XG5cdFx0fVxuXHR9XG59KTtcblxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gQWN0aW9uczogVG9nZ2xpbmcgRm9jdXNcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2N1c05leHRJbnB1dEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuRm9jdXNOZXh0SW5wdXRBY3Rpb25JZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdGb2N1c05leHRJbnB1dEFjdGlvbi5sYWJlbCcsIFwiRm9jdXMgTmV4dCBJbnB1dFwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFNlYXJjaEVkaXRvckNvbnN0YW50cy5JblNlYXJjaEVkaXRvciwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSW5wdXRCb3hGb2N1c2VkS2V5KSxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld1Zpc2libGVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklucHV0Qm94Rm9jdXNlZEtleSkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaW5wdXQgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvcjtcblx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBTZWFyY2hFZGl0b3JJbnB1dCkge1xuXHRcdFx0Ly8gY2FzdCBhcyB3ZSBjYW5ub3QgaW1wb3J0IFNlYXJjaEVkaXRvciBhcyBhIHZhbHVlIGIvYyBjeWNsaWMgZGVwZW5kZW5jeS5cblx0XHRcdChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS5mb2N1c05leHRJbnB1dCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0c2VhcmNoVmlldz8uZm9jdXNOZXh0SW5wdXRCb3goKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBGb2N1c1ByZXZpb3VzSW5wdXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLkZvY3VzUHJldmlvdXNJbnB1dEFjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ0ZvY3VzUHJldmlvdXNJbnB1dEFjdGlvbi5sYWJlbCcsIFwiRm9jdXMgUHJldmlvdXMgSW5wdXRcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChTZWFyY2hFZGl0b3JDb25zdGFudHMuSW5TZWFyY2hFZGl0b3IsIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklucHV0Qm94Rm9jdXNlZEtleSksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5JbnB1dEJveEZvY3VzZWRLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaElucHV0Qm94Rm9jdXNlZEtleS50b05lZ2F0ZWQoKSkpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuVXBBcnJvdyxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgU2VhcmNoRWRpdG9ySW5wdXQpIHtcblx0XHRcdC8vIGNhc3QgYXMgd2UgY2Fubm90IGltcG9ydCBTZWFyY2hFZGl0b3IgYXMgYSB2YWx1ZSBiL2MgY3ljbGljIGRlcGVuZGVuY3kuXG5cdFx0XHQoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lIGFzIFNlYXJjaEVkaXRvcikuZm9jdXNQcmV2SW5wdXQoKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZWFyY2hWaWV3ID0gZ2V0U2VhcmNoVmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkpO1xuXHRcdHNlYXJjaFZpZXc/LmZvY3VzUHJldmlvdXNJbnB1dEJveCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZvY3VzU2VhcmNoRnJvbVJlc3VsdHNBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLkZvY3VzU2VhcmNoRnJvbVJlc3VsdHMsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignRm9jdXNTZWFyY2hGcm9tUmVzdWx0cy5sYWJlbCcsIFwiRm9jdXMgU2VhcmNoIEZyb20gUmVzdWx0c1wiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlNlYXJjaFZpZXdWaXNpYmxlS2V5LCBDb250ZXh0S2V5RXhwci5vcihDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaXJzdE1hdGNoRm9jdXNLZXksIENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQpKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlVwQXJyb3csXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdFx0c2VhcmNoVmlldz8uZm9jdXNQcmV2aW91c0lucHV0Qm94KCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlU2VhcmNoT25UeXBlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IHNlYXJjaE9uVHlwZUtleSA9ICdzZWFyY2guc2VhcmNoT25UeXBlJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlRvZ2dsZVNlYXJjaE9uVHlwZUFjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3RvZ2dsZVRhYnMnLCBcIlRvZ2dsZSBTZWFyY2ggb24gVHlwZVwiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdH0pO1xuXG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgc2VhcmNoT25UeXBlID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oVG9nZ2xlU2VhcmNoT25UeXBlQWN0aW9uLnNlYXJjaE9uVHlwZUtleSk7XG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFRvZ2dsZVNlYXJjaE9uVHlwZUFjdGlvbi5zZWFyY2hPblR5cGVLZXksICFzZWFyY2hPblR5cGUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZvY3VzU2VhcmNoTGlzdENvbW1hbmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLkZvY3VzU2VhcmNoTGlzdENvbW1hbmRJRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdmb2N1c1NlYXJjaExpc3RDb21tYW5kTGFiZWwnLCBcIkZvY3VzIExpc3RcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdGZvY3VzU2VhcmNoTGlzdENvbW1hbmQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZvY3VzTmV4dFNlYXJjaFJlc3VsdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuRm9jdXNOZXh0U2VhcmNoUmVzdWx0QWN0aW9uSWQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignRm9jdXNOZXh0U2VhcmNoUmVzdWx0LmxhYmVsJywgXCJGb2N1cyBOZXh0IFNlYXJjaCBSZXN1bHRcIiksXG5cdFx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkY0LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdH1dLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSGFzU2VhcmNoUmVzdWx0cywgU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yKSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIGF3YWl0IGZvY3VzTmV4dFNlYXJjaFJlc3VsdChhY2Nlc3Nvcik7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRm9jdXNQcmV2aW91c1NlYXJjaFJlc3VsdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuRm9jdXNQcmV2aW91c1NlYXJjaFJlc3VsdEFjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ0ZvY3VzUHJldmlvdXNTZWFyY2hSZXN1bHQubGFiZWwnLCBcIkZvY3VzIFByZXZpb3VzIFNlYXJjaCBSZXN1bHRcIiksXG5cdFx0XHRrZXliaW5kaW5nOiBbe1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkY0LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdH1dLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSGFzU2VhcmNoUmVzdWx0cywgU2VhcmNoRWRpdG9yQ29uc3RhbnRzLkluU2VhcmNoRWRpdG9yKSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIGF3YWl0IGZvY3VzUHJldmlvdXNTZWFyY2hSZXN1bHQoYWNjZXNzb3IpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFJlcGxhY2VJbkZpbGVzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb25zdGFudHMuU2VhcmNoQ29tbWFuZElkcy5SZXBsYWNlSW5GaWxlc0FjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3JlcGxhY2VJbkZpbGVzJywgXCJSZXBsYWNlIGluIEZpbGVzXCIpLFxuXHRcdFx0a2V5YmluZGluZzogW3tcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleUgsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0fV0sXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5NZW51YmFyRWRpdE1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnNF9maW5kX2dsb2JhbCcsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIGF3YWl0IGZpbmRPclJlcGxhY2VJbkZpbGVzKGFjY2Vzc29yLCB0cnVlKTtcblx0fVxufSk7XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gSGVscGVyc1xuZnVuY3Rpb24gdG9nZ2xlQ2FzZVNlbnNpdGl2ZUNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKTtcblx0c2VhcmNoVmlldz8udG9nZ2xlQ2FzZVNlbnNpdGl2ZSgpO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVXaG9sZVdvcmRDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdHNlYXJjaFZpZXc/LnRvZ2dsZVdob2xlV29yZHMoKTtcbn1cblxuZnVuY3Rpb24gdG9nZ2xlUmVnZXhDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdGNvbnN0IHNlYXJjaFZpZXcgPSBnZXRTZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSk7XG5cdHNlYXJjaFZpZXc/LnRvZ2dsZVJlZ2V4KCk7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZVByZXNlcnZlQ2FzZUNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKTtcblx0c2VhcmNoVmlldz8udG9nZ2xlUHJlc2VydmVDYXNlKCk7XG59XG5cbmNvbnN0IGZvY3VzU2VhcmNoTGlzdENvbW1hbmQ6IElDb21tYW5kSGFuZGxlciA9IGFjY2Vzc29yID0+IHtcblx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRvcGVuU2VhcmNoVmlldyh2aWV3c1NlcnZpY2UpLnRoZW4oc2VhcmNoVmlldyA9PiB7XG5cdFx0c2VhcmNoVmlldz8ubW92ZUZvY3VzVG9SZXN1bHRzKCk7XG5cdH0pO1xufTtcblxuYXN5bmMgZnVuY3Rpb24gZm9jdXNOZXh0U2VhcmNoUmVzdWx0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxhbnk+IHtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IGlucHV0ID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdGlmIChpbnB1dCBpbnN0YW5jZW9mIFNlYXJjaEVkaXRvcklucHV0KSB7XG5cdFx0Ly8gY2FzdCBhcyB3ZSBjYW5ub3QgaW1wb3J0IFNlYXJjaEVkaXRvciBhcyBhIHZhbHVlIGIvYyBjeWNsaWMgZGVwZW5kZW5jeS5cblx0XHRyZXR1cm4gKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSBhcyBTZWFyY2hFZGl0b3IpLmZvY3VzTmV4dFJlc3VsdCgpO1xuXHR9XG5cblx0cmV0dXJuIG9wZW5TZWFyY2hWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSkudGhlbihzZWFyY2hWaWV3ID0+IHNlYXJjaFZpZXc/LnNlbGVjdE5leHRNYXRjaCgpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZm9jdXNQcmV2aW91c1NlYXJjaFJlc3VsdChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8YW55PiB7XG5cdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRjb25zdCBpbnB1dCA9IGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yO1xuXHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBTZWFyY2hFZGl0b3JJbnB1dCkge1xuXHRcdC8vIGNhc3QgYXMgd2UgY2Fubm90IGltcG9ydCBTZWFyY2hFZGl0b3IgYXMgYSB2YWx1ZSBiL2MgY3ljbGljIGRlcGVuZGVuY3kuXG5cdFx0cmV0dXJuIChlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUgYXMgU2VhcmNoRWRpdG9yKS5mb2N1c1ByZXZpb3VzUmVzdWx0KCk7XG5cdH1cblxuXHRyZXR1cm4gb3BlblNlYXJjaFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKS50aGVuKHNlYXJjaFZpZXcgPT4gc2VhcmNoVmlldz8uc2VsZWN0UHJldmlvdXNNYXRjaCgpKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmluZE9yUmVwbGFjZUluRmlsZXMoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGV4cGFuZFNlYXJjaFJlcGxhY2VXaWRnZXQ6IGJvb2xlYW4pOiBQcm9taXNlPGFueT4ge1xuXHRyZXR1cm4gb3BlblNlYXJjaFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpLCBmYWxzZSkudGhlbihvcGVuZWRWaWV3ID0+IHtcblx0XHRpZiAob3BlbmVkVmlldykge1xuXHRcdFx0Y29uc3Qgc2VhcmNoQW5kUmVwbGFjZVdpZGdldCA9IG9wZW5lZFZpZXcuc2VhcmNoQW5kUmVwbGFjZVdpZGdldDtcblx0XHRcdHNlYXJjaEFuZFJlcGxhY2VXaWRnZXQudG9nZ2xlUmVwbGFjZShleHBhbmRTZWFyY2hSZXBsYWNlV2lkZ2V0KTtcblxuXHRcdFx0Y29uc3QgdXBkYXRlZFRleHQgPSBvcGVuZWRWaWV3LnVwZGF0ZVRleHRGcm9tRmluZFdpZGdldE9yU2VsZWN0aW9uKHsgYWxsb3dVbnNlbGVjdGVkV29yZDogIWV4cGFuZFNlYXJjaFJlcGxhY2VXaWRnZXQgfSk7XG5cdFx0XHRvcGVuZWRWaWV3LnNlYXJjaEFuZFJlcGxhY2VXaWRnZXQuZm9jdXModW5kZWZpbmVkLCB1cGRhdGVkVGV4dCwgdXBkYXRlZFRleHQpO1xuXHRcdH1cblx0fSk7XG59XG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBS0EsU0FBUyxtQkFBbUI7QUFDNUIsWUFBWSxTQUFTO0FBRXJCLFNBQVMsNkJBQTZCO0FBR3RDLFNBQVMscUJBQXFCO0FBQzlCLFlBQVksZUFBZTtBQUMzQixZQUFZLDJCQUEyQjtBQUV2QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdCQUFnQiwwQkFBMEI7QUFDbkQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxTQUFTLFFBQVEsdUJBQXVCO0FBQ2pELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsK0JBQStCLDhCQUE4Qix1QkFBdUIsaUNBQWlDO0FBQzlILFNBQVMsVUFBVSxlQUFlLHNCQUFzQjtBQUN4RCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUEyRCwrQkFBK0I7QUFHMUYsZ0JBQWdCLE1BQU0saUNBQWlDLFFBQVE7QUFBQSxFQUM5RCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSSxVQUFVLGlCQUFpQjtBQUFBLE1BQy9CLE9BQU8sSUFBSSxVQUFVLGtDQUFrQyxzQkFBc0I7QUFBQSxNQUM3RTtBQUFBLE1BQ0EsWUFBWTtBQUFBLFFBQ1gsUUFBUSxpQkFBaUI7QUFBQSxRQUN6QixNQUFNLGVBQWUsR0FBRyxVQUFVLGNBQWMsc0JBQXNCLHNCQUFzQixjQUFjO0FBQUEsUUFDMUcsU0FBUyxPQUFPLFVBQVUsT0FBTyxRQUFRLFFBQVE7QUFBQSxNQUNs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
