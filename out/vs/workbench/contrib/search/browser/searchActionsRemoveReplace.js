import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { getSelectionKeyboardEvent } from "../../../../platform/list/browser/listService.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { searchRemoveIcon, searchReplaceIcon } from "./searchIcons.js";
import * as Constants from "../common/constants.js";
import { IReplaceService } from "./replace.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { category, getElementsToOperateOn, getSearchView, shouldRefocus } from "./searchActionsBase.js";
import { equals } from "../../../../base/common/arrays.js";
import { arrayContainsElementOrParent, isSearchTreeFileMatch, isSearchTreeFolderMatch, isSearchTreeMatch, isSearchResult, isTextSearchHeading } from "./searchTreeModel/searchTreeCommon.js";
import { MatchInNotebook } from "./notebookSearch/notebookSearchModel.js";
import { AITextSearchHeadingImpl } from "./AISearch/aiSearchModel.js";
registerAction2(class RemoveAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.RemoveActionId,
      title: nls.localize2("RemoveAction.label", "Dismiss"),
      category,
      icon: searchRemoveIcon,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.FileMatchOrMatchFocusKey),
        primary: KeyCode.Delete,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.Backspace
        }
      },
      menu: [
        {
          id: MenuId.SearchContext,
          group: "search",
          order: 2
        },
        {
          id: MenuId.SearchActionMenu,
          group: "inline",
          when: ContextKeyExpr.or(Constants.SearchContext.FileFocusKey, Constants.SearchContext.MatchFocusKey, Constants.SearchContext.FolderFocusKey),
          order: 2
        }
      ]
    });
  }
  async run(accessor, context) {
    const viewsService = accessor.get(IViewsService);
    const configurationService = accessor.get(IConfigurationService);
    const searchView = getSearchView(viewsService);
    if (!searchView) {
      return;
    }
    let element = context?.element;
    let viewer = context?.viewer;
    if (!viewer) {
      viewer = searchView.getControl();
    }
    if (!element) {
      element = viewer.getFocus()[0] ?? void 0;
    }
    const elementsToRemove = getElementsToOperateOn(viewer, element, configurationService.getValue("search"));
    let focusElement = viewer.getFocus()[0] ?? void 0;
    if (elementsToRemove.length === 0) {
      return;
    }
    if (!focusElement || isSearchResult(focusElement)) {
      focusElement = element;
    }
    let nextFocusElement;
    const shouldRefocusMatch = shouldRefocus(elementsToRemove, focusElement);
    if (focusElement && shouldRefocusMatch) {
      nextFocusElement = await getElementToFocusAfterRemoved(viewer, focusElement, elementsToRemove);
    }
    const searchResult = searchView.searchResult;
    if (searchResult) {
      searchResult.batchRemove(elementsToRemove);
    }
    await searchView.queueRefreshTree();
    if (focusElement && shouldRefocusMatch) {
      if (!nextFocusElement) {
        nextFocusElement = await getLastNodeFromSameType(viewer, focusElement);
      }
      if (nextFocusElement && !arrayContainsElementOrParent(nextFocusElement, elementsToRemove)) {
        viewer.reveal(nextFocusElement);
        viewer.setFocus([nextFocusElement], getSelectionKeyboardEvent());
        viewer.setSelection([nextFocusElement], getSelectionKeyboardEvent());
      }
    } else if (!equals(viewer.getFocus(), viewer.getSelection())) {
      viewer.setSelection(viewer.getFocus());
    }
    viewer.domFocus();
    return;
  }
});
registerAction2(class ReplaceAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ReplaceActionId,
      title: nls.localize2("match.replace.label", "Replace"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.MatchFocusKey, Constants.SearchContext.IsEditableItemKey),
        primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.Digit1
      },
      icon: searchReplaceIcon,
      menu: [
        {
          id: MenuId.SearchContext,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.MatchFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "search",
          order: 1
        },
        {
          id: MenuId.SearchActionMenu,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.MatchFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "inline",
          order: 1
        }
      ]
    });
  }
  async run(accessor, context) {
    return performReplace(accessor, context);
  }
});
registerAction2(class ReplaceAllAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ReplaceAllInFileActionId,
      title: nls.localize2("file.replaceAll.label", "Replace All"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FileFocusKey, Constants.SearchContext.IsEditableItemKey),
        primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.Digit1,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter]
      },
      icon: searchReplaceIcon,
      menu: [
        {
          id: MenuId.SearchContext,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FileFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "search",
          order: 1
        },
        {
          id: MenuId.SearchActionMenu,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FileFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "inline",
          order: 1
        }
      ]
    });
  }
  async run(accessor, context) {
    return performReplace(accessor, context);
  }
});
registerAction2(class ReplaceAllInFolderAction extends Action2 {
  constructor() {
    super({
      id: Constants.SearchCommandIds.ReplaceAllInFolderActionId,
      title: nls.localize2("file.replaceAll.label", "Replace All"),
      category,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(Constants.SearchContext.SearchViewVisibleKey, Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FolderFocusKey, Constants.SearchContext.IsEditableItemKey),
        primary: KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.Digit1,
        secondary: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter]
      },
      icon: searchReplaceIcon,
      menu: [
        {
          id: MenuId.SearchContext,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FolderFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "search",
          order: 1
        },
        {
          id: MenuId.SearchActionMenu,
          when: ContextKeyExpr.and(Constants.SearchContext.ReplaceActiveKey, Constants.SearchContext.FolderFocusKey, Constants.SearchContext.IsEditableItemKey),
          group: "inline",
          order: 1
        }
      ]
    });
  }
  async run(accessor, context) {
    return performReplace(accessor, context);
  }
});
async function performReplace(accessor, context) {
  const configurationService = accessor.get(IConfigurationService);
  const viewsService = accessor.get(IViewsService);
  const viewlet = getSearchView(viewsService);
  const viewer = context?.viewer ?? viewlet?.getControl();
  if (!viewer) {
    return;
  }
  const element = context?.element ?? viewer.getFocus()[0];
  const elementsToReplace = getElementsToOperateOn(viewer, element ?? void 0, configurationService.getValue("search"));
  let focusElement = viewer.getFocus()[0];
  if (!focusElement || focusElement && !arrayContainsElementOrParent(focusElement, elementsToReplace) || isSearchResult(focusElement)) {
    focusElement = element;
  }
  if (elementsToReplace.length === 0) {
    return;
  }
  let nextFocusElement;
  if (focusElement) {
    nextFocusElement = await getElementToFocusAfterRemoved(viewer, focusElement, elementsToReplace);
  }
  const searchResult = viewlet?.searchResult;
  if (searchResult) {
    await searchResult.batchReplace(elementsToReplace);
  }
  await viewlet?.queueRefreshTree();
  if (focusElement) {
    if (!nextFocusElement) {
      nextFocusElement = await getLastNodeFromSameType(viewer, focusElement);
    }
    if (nextFocusElement) {
      viewer.reveal(nextFocusElement);
      viewer.setFocus([nextFocusElement], getSelectionKeyboardEvent());
      viewer.setSelection([nextFocusElement], getSelectionKeyboardEvent());
      if (isSearchTreeMatch(nextFocusElement)) {
        const useReplacePreview = configurationService.getValue().search.useReplacePreview;
        if (!useReplacePreview || hasToOpenFile(accessor, nextFocusElement) || nextFocusElement instanceof MatchInNotebook) {
          viewlet?.open(nextFocusElement, true);
        } else {
          accessor.get(IReplaceService).openReplacePreview(nextFocusElement, true);
        }
      } else if (isSearchTreeFileMatch(nextFocusElement)) {
        viewlet?.open(nextFocusElement, true);
      }
    }
  }
  viewer.domFocus();
}
function hasToOpenFile(accessor, currBottomElem) {
  if (!isSearchTreeMatch(currBottomElem)) {
    return false;
  }
  const activeEditor = accessor.get(IEditorService).activeEditor;
  const file = activeEditor?.resource;
  if (file) {
    return accessor.get(IUriIdentityService).extUri.isEqual(file, currBottomElem.parent().resource);
  }
  return false;
}
function compareLevels(elem1, elem2) {
  if (isSearchTreeMatch(elem1)) {
    if (isSearchTreeMatch(elem2)) {
      return 0;
    } else {
      return -1;
    }
  } else if (isSearchTreeFileMatch(elem1)) {
    if (isSearchTreeMatch(elem2)) {
      return 1;
    } else if (isSearchTreeFileMatch(elem2)) {
      return 0;
    } else {
      return -1;
    }
  } else if (isSearchTreeFolderMatch(elem1)) {
    if (isTextSearchHeading(elem2)) {
      return -1;
    } else if (isSearchTreeFolderMatch(elem2)) {
      return 0;
    } else {
      return 1;
    }
  } else {
    if (isTextSearchHeading(elem2)) {
      return 0;
    } else {
      return 1;
    }
  }
}
async function getElementToFocusAfterRemoved(viewer, element, elementsToRemove) {
  const navigator = viewer.navigate(element);
  if (isSearchTreeFolderMatch(element)) {
    while (!!navigator.next() && (!isSearchTreeFolderMatch(navigator.current()) || arrayContainsElementOrParent(navigator.current(), elementsToRemove))) {
    }
  } else if (isSearchTreeFileMatch(element)) {
    while (!!navigator.next() && (!isSearchTreeFileMatch(navigator.current()) || arrayContainsElementOrParent(navigator.current(), elementsToRemove))) {
      if (navigator.current() instanceof AITextSearchHeadingImpl) {
        return navigator.current();
      }
      await viewer.expand(navigator.current());
    }
  } else {
    while (navigator.next() && (!isSearchTreeMatch(navigator.current()) || arrayContainsElementOrParent(navigator.current(), elementsToRemove))) {
      if (navigator.current() instanceof AITextSearchHeadingImpl) {
        return navigator.current();
      }
      await viewer.expand(navigator.current());
    }
  }
  return navigator.current();
}
async function getLastNodeFromSameType(viewer, element) {
  let lastElem = viewer.lastVisibleElement ?? null;
  while (lastElem) {
    const compareVal = compareLevels(element, lastElem);
    if (compareVal === -1) {
      const expanded = await viewer.expand(lastElem);
      if (!expanded) {
        return lastElem;
      }
      lastElem = viewer.lastVisibleElement;
    } else if (compareVal === 1) {
      const potentialLastElem = viewer.getParentElement(lastElem);
      if (isSearchResult(potentialLastElem)) {
        break;
      } else {
        lastElem = potentialLastElem;
      }
    } else {
      return lastElem;
    }
  }
  return void 0;
}
export {
  getElementToFocusAfterRemoved,
  getLastNodeFromSameType
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hBY3Rpb25zUmVtb3ZlUmVwbGFjZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElUcmVlTmF2aWdhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCwgV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBzZWFyY2hSZW1vdmVJY29uLCBzZWFyY2hSZXBsYWNlSWNvbiB9IGZyb20gJy4vc2VhcmNoSWNvbnMuanMnO1xuaW1wb3J0IHsgU2VhcmNoVmlldyB9IGZyb20gJy4vc2VhcmNoVmlldy5qcyc7XG5pbXBvcnQgKiBhcyBDb25zdGFudHMgZnJvbSAnLi4vY29tbW9uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJUmVwbGFjZVNlcnZpY2UgfSBmcm9tICcuL3JlcGxhY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNlYXJjaENvbmZpZ3VyYXRpb24sIElTZWFyY2hDb25maWd1cmF0aW9uUHJvcGVydGllcyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBjYXRlZ29yeSwgZ2V0RWxlbWVudHNUb09wZXJhdGVPbiwgZ2V0U2VhcmNoVmlldywgc2hvdWxkUmVmb2N1cyB9IGZyb20gJy4vc2VhcmNoQWN0aW9uc0Jhc2UuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGFycmF5Q29udGFpbnNFbGVtZW50T3JQYXJlbnQsIFJlbmRlcmFibGVNYXRjaCwgSVNlYXJjaFJlc3VsdCwgaXNTZWFyY2hUcmVlRmlsZU1hdGNoLCBpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaCwgaXNTZWFyY2hUcmVlTWF0Y2gsIGlzU2VhcmNoUmVzdWx0LCBpc1RleHRTZWFyY2hIZWFkaW5nIH0gZnJvbSAnLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5pbXBvcnQgeyBNYXRjaEluTm90ZWJvb2sgfSBmcm9tICcuL25vdGVib29rU2VhcmNoL25vdGVib29rU2VhcmNoTW9kZWwuanMnO1xuaW1wb3J0IHsgQUlUZXh0U2VhcmNoSGVhZGluZ0ltcGwgfSBmcm9tICcuL0FJU2VhcmNoL2FpU2VhcmNoTW9kZWwuanMnO1xuXG5cbi8vI3JlZ2lvbiBJbnRlcmZhY2VzXG5leHBvcnQgaW50ZXJmYWNlIElTZWFyY2hBY3Rpb25Db250ZXh0IHtcblx0cmVhZG9ubHkgdmlld2VyOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaD47XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IFJlbmRlcmFibGVNYXRjaDtcbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIElGaW5kSW5GaWxlc0FyZ3Mge1xuXHRxdWVyeT86IHN0cmluZztcblx0cmVwbGFjZT86IHN0cmluZztcblx0cHJlc2VydmVDYXNlPzogYm9vbGVhbjtcblx0dHJpZ2dlclNlYXJjaD86IGJvb2xlYW47XG5cdGZpbGVzVG9JbmNsdWRlPzogc3RyaW5nO1xuXHRmaWxlc1RvRXhjbHVkZT86IHN0cmluZztcblx0aXNSZWdleD86IGJvb2xlYW47XG5cdGlzQ2FzZVNlbnNpdGl2ZT86IGJvb2xlYW47XG5cdG1hdGNoV2hvbGVXb3JkPzogYm9vbGVhbjtcblx0dXNlRXhjbHVkZVNldHRpbmdzQW5kSWdub3JlRmlsZXM/OiBib29sZWFuO1xuXHRvbmx5T3BlbkVkaXRvcnM/OiBib29sZWFuO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIEFjdGlvbnNcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZW1vdmVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlJlbW92ZUFjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ1JlbW92ZUFjdGlvbi5sYWJlbCcsIFwiRGlzbWlzc1wiKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0aWNvbjogc2VhcmNoUmVtb3ZlSWNvbixcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3VmlzaWJsZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZU1hdGNoT3JNYXRjaEZvY3VzS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdFx0XHRcdG1hYzoge1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TZWFyY2hDb250ZXh0LFxuXHRcdFx0XHRcdGdyb3VwOiAnc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuU2VhcmNoQWN0aW9uTWVudSxcblx0XHRcdFx0XHRncm91cDogJ2lubGluZScsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZUZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5NYXRjaEZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Gb2xkZXJGb2N1c0tleSksXG5cdFx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdH0sXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNvbnRleHQ6IElTZWFyY2hBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgc2VhcmNoVmlldyA9IGdldFNlYXJjaFZpZXcodmlld3NTZXJ2aWNlKTtcblxuXHRcdGlmICghc2VhcmNoVmlldykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBlbGVtZW50ID0gY29udGV4dD8uZWxlbWVudDtcblx0XHRsZXQgdmlld2VyID0gY29udGV4dD8udmlld2VyO1xuXHRcdGlmICghdmlld2VyKSB7XG5cdFx0XHR2aWV3ZXIgPSBzZWFyY2hWaWV3LmdldENvbnRyb2woKTtcblx0XHR9XG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRlbGVtZW50ID0gdmlld2VyLmdldEZvY3VzKClbMF0gPz8gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGVsZW1lbnRzVG9SZW1vdmUgPSBnZXRFbGVtZW50c1RvT3BlcmF0ZU9uKHZpZXdlciwgZWxlbWVudCwgY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzPignc2VhcmNoJykpO1xuXHRcdGxldCBmb2N1c0VsZW1lbnQgPSB2aWV3ZXIuZ2V0Rm9jdXMoKVswXSA/PyB1bmRlZmluZWQ7XG5cblx0XHRpZiAoZWxlbWVudHNUb1JlbW92ZS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIWZvY3VzRWxlbWVudCB8fCAoaXNTZWFyY2hSZXN1bHQoZm9jdXNFbGVtZW50KSkpIHtcblx0XHRcdGZvY3VzRWxlbWVudCA9IGVsZW1lbnQ7XG5cdFx0fVxuXG5cdFx0bGV0IG5leHRGb2N1c0VsZW1lbnQ7XG5cdFx0Y29uc3Qgc2hvdWxkUmVmb2N1c01hdGNoID0gc2hvdWxkUmVmb2N1cyhlbGVtZW50c1RvUmVtb3ZlLCBmb2N1c0VsZW1lbnQpO1xuXHRcdGlmIChmb2N1c0VsZW1lbnQgJiYgc2hvdWxkUmVmb2N1c01hdGNoKSB7XG5cdFx0XHRuZXh0Rm9jdXNFbGVtZW50ID0gYXdhaXQgZ2V0RWxlbWVudFRvRm9jdXNBZnRlclJlbW92ZWQodmlld2VyLCBmb2N1c0VsZW1lbnQsIGVsZW1lbnRzVG9SZW1vdmUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlYXJjaFJlc3VsdCA9IHNlYXJjaFZpZXcuc2VhcmNoUmVzdWx0O1xuXG5cdFx0aWYgKHNlYXJjaFJlc3VsdCkge1xuXHRcdFx0c2VhcmNoUmVzdWx0LmJhdGNoUmVtb3ZlKGVsZW1lbnRzVG9SZW1vdmUpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHNlYXJjaFZpZXcucXVldWVSZWZyZXNoVHJlZSgpOyAvLyB3YWl0IGZvciByZWZyZXNoVHJlZSB0byBmaW5pc2hcblxuXHRcdGlmIChmb2N1c0VsZW1lbnQgJiYgc2hvdWxkUmVmb2N1c01hdGNoKSB7XG5cdFx0XHRpZiAoIW5leHRGb2N1c0VsZW1lbnQpIHtcblx0XHRcdFx0bmV4dEZvY3VzRWxlbWVudCA9IGF3YWl0IGdldExhc3ROb2RlRnJvbVNhbWVUeXBlKHZpZXdlciwgZm9jdXNFbGVtZW50KTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKG5leHRGb2N1c0VsZW1lbnQgJiYgIWFycmF5Q29udGFpbnNFbGVtZW50T3JQYXJlbnQobmV4dEZvY3VzRWxlbWVudCwgZWxlbWVudHNUb1JlbW92ZSkpIHtcblx0XHRcdFx0dmlld2VyLnJldmVhbChuZXh0Rm9jdXNFbGVtZW50KTtcblx0XHRcdFx0dmlld2VyLnNldEZvY3VzKFtuZXh0Rm9jdXNFbGVtZW50XSwgZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCgpKTtcblx0XHRcdFx0dmlld2VyLnNldFNlbGVjdGlvbihbbmV4dEZvY3VzRWxlbWVudF0sIGdldFNlbGVjdGlvbktleWJvYXJkRXZlbnQoKSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICghZXF1YWxzKHZpZXdlci5nZXRGb2N1cygpLCB2aWV3ZXIuZ2V0U2VsZWN0aW9uKCkpKSB7XG5cdFx0XHR2aWV3ZXIuc2V0U2VsZWN0aW9uKHZpZXdlci5nZXRGb2N1cygpKTtcblx0XHR9XG5cblx0XHR2aWV3ZXIuZG9tRm9jdXMoKTtcblx0XHRyZXR1cm47XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVwbGFjZUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3Rvcihcblx0KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbnN0YW50cy5TZWFyY2hDb21tYW5kSWRzLlJlcGxhY2VBY3Rpb25JZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdtYXRjaC5yZXBsYWNlLmxhYmVsJywgXCJSZXBsYWNlXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld1Zpc2libGVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VBY3RpdmVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0Lk1hdGNoRm9jdXNLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklzRWRpdGFibGVJdGVtS2V5KSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkRpZ2l0MSxcblx0XHRcdH0sXG5cdFx0XHRpY29uOiBzZWFyY2hSZXBsYWNlSWNvbixcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuU2VhcmNoQ29udGV4dCxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuUmVwbGFjZUFjdGl2ZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuTWF0Y2hGb2N1c0tleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSXNFZGl0YWJsZUl0ZW1LZXkpLFxuXHRcdFx0XHRcdGdyb3VwOiAnc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TZWFyY2hBY3Rpb25NZW51LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXBsYWNlQWN0aXZlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5NYXRjaEZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleSksXG5cdFx0XHRcdFx0Z3JvdXA6ICdpbmxpbmUnLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSVNlYXJjaEFjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiBwZXJmb3JtUmVwbGFjZShhY2Nlc3NvciwgY29udGV4dCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVwbGFjZUFsbEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ29uc3RhbnRzLlNlYXJjaENvbW1hbmRJZHMuUmVwbGFjZUFsbEluRmlsZUFjdGlvbklkLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ2ZpbGUucmVwbGFjZUFsbC5sYWJlbCcsIFwiUmVwbGFjZSBBbGxcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5TZWFyY2hWaWV3VmlzaWJsZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuUmVwbGFjZUFjdGl2ZUtleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuRmlsZUZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleSksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EaWdpdDEsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcl0sXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogc2VhcmNoUmVwbGFjZUljb24sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VBY3RpdmVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZpbGVGb2N1c0tleSwgQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuSXNFZGl0YWJsZUl0ZW1LZXkpLFxuXHRcdFx0XHRcdGdyb3VwOiAnc2VhcmNoJyxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TZWFyY2hBY3Rpb25NZW51LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb25zdGFudHMuU2VhcmNoQ29udGV4dC5SZXBsYWNlQWN0aXZlS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5GaWxlRm9jdXNLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LklzRWRpdGFibGVJdGVtS2V5KSxcblx0XHRcdFx0XHRncm91cDogJ2lubGluZScsXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0OiBJU2VhcmNoQWN0aW9uQ29udGV4dCB8IHVuZGVmaW5lZCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHBlcmZvcm1SZXBsYWNlKGFjY2Vzc29yLCBjb250ZXh0KTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBSZXBsYWNlQWxsSW5Gb2xkZXJBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoXG5cdCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb25zdGFudHMuU2VhcmNoQ29tbWFuZElkcy5SZXBsYWNlQWxsSW5Gb2xkZXJBY3Rpb25JZCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdmaWxlLnJlcGxhY2VBbGwubGFiZWwnLCBcIlJlcGxhY2UgQWxsXCIpLFxuXHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29uc3RhbnRzLlNlYXJjaENvbnRleHQuU2VhcmNoVmlld1Zpc2libGVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VBY3RpdmVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleSksXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5EaWdpdDEsXG5cdFx0XHRcdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlcl0sXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogc2VhcmNoUmVwbGFjZUljb24sXG5cdFx0XHRtZW51OiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VBY3RpdmVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleSksXG5cdFx0XHRcdFx0Z3JvdXA6ICdzZWFyY2gnLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaEFjdGlvbk1lbnUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnN0YW50cy5TZWFyY2hDb250ZXh0LlJlcGxhY2VBY3RpdmVLZXksIENvbnN0YW50cy5TZWFyY2hDb250ZXh0LkZvbGRlckZvY3VzS2V5LCBDb25zdGFudHMuU2VhcmNoQ29udGV4dC5Jc0VkaXRhYmxlSXRlbUtleSksXG5cdFx0XHRcdFx0Z3JvdXA6ICdpbmxpbmUnLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgY29udGV4dDogSVNlYXJjaEFjdGlvbkNvbnRleHQgfCB1bmRlZmluZWQpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiBwZXJmb3JtUmVwbGFjZShhY2Nlc3NvciwgY29udGV4dCk7XG5cdH1cbn0pO1xuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIEhlbHBlcnNcblxuYXN5bmMgZnVuY3Rpb24gcGVyZm9ybVJlcGxhY2UoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsXG5cdGNvbnRleHQ6IElTZWFyY2hBY3Rpb25Db250ZXh0IHwgdW5kZWZpbmVkKSB7XG5cdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdGNvbnN0IHZpZXdzU2VydmljZSA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKTtcblxuXHRjb25zdCB2aWV3bGV0OiBTZWFyY2hWaWV3IHwgdW5kZWZpbmVkID0gZ2V0U2VhcmNoVmlldyh2aWV3c1NlcnZpY2UpO1xuXHRjb25zdCB2aWV3ZXI6IFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWU8SVNlYXJjaFJlc3VsdCwgUmVuZGVyYWJsZU1hdGNoPiB8IHVuZGVmaW5lZCA9IGNvbnRleHQ/LnZpZXdlciA/PyB2aWV3bGV0Py5nZXRDb250cm9sKCk7XG5cblx0aWYgKCF2aWV3ZXIpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgZWxlbWVudDogUmVuZGVyYWJsZU1hdGNoIHwgbnVsbCA9IGNvbnRleHQ/LmVsZW1lbnQgPz8gdmlld2VyLmdldEZvY3VzKClbMF07XG5cblx0Ly8gc2luY2UgbXVsdGlwbGUgZWxlbWVudHMgY2FuIGJlIHNlbGVjdGVkLCB3ZSBuZWVkIHRvIGNoZWNrIHRoZSB0eXBlIG9mIHRoZSBGb2xkZXJNYXRjaC9GaWxlTWF0Y2gvTWF0Y2ggYmVmb3JlIHdlIHBlcmZvcm0gdGhlIHJlcGxhY2UuXG5cdGNvbnN0IGVsZW1lbnRzVG9SZXBsYWNlID0gZ2V0RWxlbWVudHNUb09wZXJhdGVPbih2aWV3ZXIsIGVsZW1lbnQgPz8gdW5kZWZpbmVkLCBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJU2VhcmNoQ29uZmlndXJhdGlvblByb3BlcnRpZXM+KCdzZWFyY2gnKSk7XG5cdGxldCBmb2N1c0VsZW1lbnQgPSB2aWV3ZXIuZ2V0Rm9jdXMoKVswXTtcblxuXHRpZiAoIWZvY3VzRWxlbWVudCB8fCAoZm9jdXNFbGVtZW50ICYmICFhcnJheUNvbnRhaW5zRWxlbWVudE9yUGFyZW50KGZvY3VzRWxlbWVudCwgZWxlbWVudHNUb1JlcGxhY2UpKSB8fCAoaXNTZWFyY2hSZXN1bHQoZm9jdXNFbGVtZW50KSkpIHtcblx0XHRmb2N1c0VsZW1lbnQgPSBlbGVtZW50O1xuXHR9XG5cblx0aWYgKGVsZW1lbnRzVG9SZXBsYWNlLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRsZXQgbmV4dEZvY3VzRWxlbWVudDtcblx0aWYgKGZvY3VzRWxlbWVudCkge1xuXHRcdG5leHRGb2N1c0VsZW1lbnQgPSBhd2FpdCBnZXRFbGVtZW50VG9Gb2N1c0FmdGVyUmVtb3ZlZCh2aWV3ZXIsIGZvY3VzRWxlbWVudCwgZWxlbWVudHNUb1JlcGxhY2UpO1xuXHR9XG5cblx0Y29uc3Qgc2VhcmNoUmVzdWx0ID0gdmlld2xldD8uc2VhcmNoUmVzdWx0O1xuXG5cdGlmIChzZWFyY2hSZXN1bHQpIHtcblx0XHRhd2FpdCBzZWFyY2hSZXN1bHQuYmF0Y2hSZXBsYWNlKGVsZW1lbnRzVG9SZXBsYWNlKTtcblx0fVxuXG5cdGF3YWl0IHZpZXdsZXQ/LnF1ZXVlUmVmcmVzaFRyZWUoKTsgLy8gd2FpdCBmb3IgcmVmcmVzaFRyZWUgdG8gZmluaXNoXG5cblx0aWYgKGZvY3VzRWxlbWVudCkge1xuXHRcdGlmICghbmV4dEZvY3VzRWxlbWVudCkge1xuXHRcdFx0bmV4dEZvY3VzRWxlbWVudCA9IGF3YWl0IGdldExhc3ROb2RlRnJvbVNhbWVUeXBlKHZpZXdlciwgZm9jdXNFbGVtZW50KTtcblx0XHR9XG5cblx0XHRpZiAobmV4dEZvY3VzRWxlbWVudCkge1xuXHRcdFx0dmlld2VyLnJldmVhbChuZXh0Rm9jdXNFbGVtZW50KTtcblx0XHRcdHZpZXdlci5zZXRGb2N1cyhbbmV4dEZvY3VzRWxlbWVudF0sIGdldFNlbGVjdGlvbktleWJvYXJkRXZlbnQoKSk7XG5cdFx0XHR2aWV3ZXIuc2V0U2VsZWN0aW9uKFtuZXh0Rm9jdXNFbGVtZW50XSwgZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCgpKTtcblxuXHRcdFx0aWYgKGlzU2VhcmNoVHJlZU1hdGNoKG5leHRGb2N1c0VsZW1lbnQpKSB7XG5cdFx0XHRcdGNvbnN0IHVzZVJlcGxhY2VQcmV2aWV3ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVNlYXJjaENvbmZpZ3VyYXRpb24+KCkuc2VhcmNoLnVzZVJlcGxhY2VQcmV2aWV3O1xuXHRcdFx0XHRpZiAoIXVzZVJlcGxhY2VQcmV2aWV3IHx8IGhhc1RvT3BlbkZpbGUoYWNjZXNzb3IsIG5leHRGb2N1c0VsZW1lbnQpIHx8IG5leHRGb2N1c0VsZW1lbnQgaW5zdGFuY2VvZiBNYXRjaEluTm90ZWJvb2spIHtcblx0XHRcdFx0XHR2aWV3bGV0Py5vcGVuKG5leHRGb2N1c0VsZW1lbnQsIHRydWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFjY2Vzc29yLmdldChJUmVwbGFjZVNlcnZpY2UpLm9wZW5SZXBsYWNlUHJldmlldyhuZXh0Rm9jdXNFbGVtZW50LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChpc1NlYXJjaFRyZWVGaWxlTWF0Y2gobmV4dEZvY3VzRWxlbWVudCkpIHtcblx0XHRcdFx0dmlld2xldD8ub3BlbihuZXh0Rm9jdXNFbGVtZW50LCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0fVxuXG5cdHZpZXdlci5kb21Gb2N1cygpO1xufVxuXG5mdW5jdGlvbiBoYXNUb09wZW5GaWxlKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdXJyQm90dG9tRWxlbTogUmVuZGVyYWJsZU1hdGNoKTogYm9vbGVhbiB7XG5cdGlmICghKGlzU2VhcmNoVHJlZU1hdGNoKGN1cnJCb3R0b21FbGVtKSkpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y29uc3QgYWN0aXZlRWRpdG9yID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3I7XG5cdGNvbnN0IGZpbGUgPSBhY3RpdmVFZGl0b3I/LnJlc291cmNlO1xuXHRpZiAoZmlsZSkge1xuXHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSkuZXh0VXJpLmlzRXF1YWwoZmlsZSwgY3VyckJvdHRvbUVsZW0ucGFyZW50KCkucmVzb3VyY2UpO1xuXHR9XG5cdHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZUxldmVscyhlbGVtMTogUmVuZGVyYWJsZU1hdGNoLCBlbGVtMjogUmVuZGVyYWJsZU1hdGNoKSB7XG5cdGlmIChpc1NlYXJjaFRyZWVNYXRjaChlbGVtMSkpIHtcblx0XHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbTIpKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblxuXHR9IGVsc2UgaWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChlbGVtMSkpIHtcblx0XHRpZiAoaXNTZWFyY2hUcmVlTWF0Y2goZWxlbTIpKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9IGVsc2UgaWYgKGlzU2VhcmNoVHJlZUZpbGVNYXRjaChlbGVtMikpIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGlzU2VhcmNoVHJlZUZvbGRlck1hdGNoKGVsZW0xKSkge1xuXHRcdGlmIChpc1RleHRTZWFyY2hIZWFkaW5nKGVsZW0yKSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlRm9sZGVyTWF0Y2goZWxlbTIpKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmIChpc1RleHRTZWFyY2hIZWFkaW5nKGVsZW0yKSkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAxO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIFJldHVybnMgZWxlbWVudCB0byBmb2N1cyBhZnRlciByZW1vdmluZyB0aGUgZ2l2ZW4gZWxlbWVudFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RWxlbWVudFRvRm9jdXNBZnRlclJlbW92ZWQodmlld2VyOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaD4sIGVsZW1lbnQ6IFJlbmRlcmFibGVNYXRjaCwgZWxlbWVudHNUb1JlbW92ZTogUmVuZGVyYWJsZU1hdGNoW10pOiBQcm9taXNlPFJlbmRlcmFibGVNYXRjaCB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBuYXZpZ2F0b3I6IElUcmVlTmF2aWdhdG9yPGFueT4gPSB2aWV3ZXIubmF2aWdhdGUoZWxlbWVudCk7XG5cdGlmIChpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChlbGVtZW50KSkge1xuXHRcdHdoaWxlICghIW5hdmlnYXRvci5uZXh0KCkgJiYgKCFpc1NlYXJjaFRyZWVGb2xkZXJNYXRjaChuYXZpZ2F0b3IuY3VycmVudCgpKSB8fCBhcnJheUNvbnRhaW5zRWxlbWVudE9yUGFyZW50KG5hdmlnYXRvci5jdXJyZW50KCksIGVsZW1lbnRzVG9SZW1vdmUpKSkgeyB9XG5cdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKGVsZW1lbnQpKSB7XG5cdFx0d2hpbGUgKCEhbmF2aWdhdG9yLm5leHQoKSAmJiAoIWlzU2VhcmNoVHJlZUZpbGVNYXRjaChuYXZpZ2F0b3IuY3VycmVudCgpKSB8fCBhcnJheUNvbnRhaW5zRWxlbWVudE9yUGFyZW50KG5hdmlnYXRvci5jdXJyZW50KCksIGVsZW1lbnRzVG9SZW1vdmUpKSkge1xuXHRcdFx0Ly8gTmV2ZXIgZXhwYW5kIEFJIHNlYXJjaCByZXN1bHRzIGJ5IGRlZmF1bHRcblx0XHRcdGlmIChuYXZpZ2F0b3IuY3VycmVudCgpIGluc3RhbmNlb2YgQUlUZXh0U2VhcmNoSGVhZGluZ0ltcGwpIHtcblx0XHRcdFx0cmV0dXJuIG5hdmlnYXRvci5jdXJyZW50KCk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB2aWV3ZXIuZXhwYW5kKG5hdmlnYXRvci5jdXJyZW50KCkpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR3aGlsZSAobmF2aWdhdG9yLm5leHQoKSAmJiAoIWlzU2VhcmNoVHJlZU1hdGNoKG5hdmlnYXRvci5jdXJyZW50KCkpIHx8IGFycmF5Q29udGFpbnNFbGVtZW50T3JQYXJlbnQobmF2aWdhdG9yLmN1cnJlbnQoKSwgZWxlbWVudHNUb1JlbW92ZSkpKSB7XG5cdFx0XHQvLyBOZXZlciBleHBhbmQgQUkgc2VhcmNoIHJlc3VsdHMgYnkgZGVmYXVsdFxuXHRcdFx0aWYgKG5hdmlnYXRvci5jdXJyZW50KCkgaW5zdGFuY2VvZiBBSVRleHRTZWFyY2hIZWFkaW5nSW1wbCkge1xuXHRcdFx0XHRyZXR1cm4gbmF2aWdhdG9yLmN1cnJlbnQoKTtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHZpZXdlci5leHBhbmQobmF2aWdhdG9yLmN1cnJlbnQoKSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBuYXZpZ2F0b3IuY3VycmVudCgpO1xufVxuXG4vKioqXG4gKiBGaW5kcyB0aGUgbGFzdCBlbGVtZW50IGluIHRoZSB0cmVlIHdpdGggdGhlIHNhbWUgdHlwZSBhcyBgZWxlbWVudGBcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldExhc3ROb2RlRnJvbVNhbWVUeXBlKHZpZXdlcjogV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxJU2VhcmNoUmVzdWx0LCBSZW5kZXJhYmxlTWF0Y2g+LCBlbGVtZW50OiBSZW5kZXJhYmxlTWF0Y2gpOiBQcm9taXNlPFJlbmRlcmFibGVNYXRjaCB8IHVuZGVmaW5lZD4ge1xuXHRsZXQgbGFzdEVsZW06IFJlbmRlcmFibGVNYXRjaCB8IG51bGwgPSB2aWV3ZXIubGFzdFZpc2libGVFbGVtZW50ID8/IG51bGw7XG5cblx0d2hpbGUgKGxhc3RFbGVtKSB7XG5cdFx0Y29uc3QgY29tcGFyZVZhbCA9IGNvbXBhcmVMZXZlbHMoZWxlbWVudCwgbGFzdEVsZW0pO1xuXHRcdGlmIChjb21wYXJlVmFsID09PSAtMSkge1xuXHRcdFx0Y29uc3QgZXhwYW5kZWQgPSBhd2FpdCB2aWV3ZXIuZXhwYW5kKGxhc3RFbGVtKTtcblx0XHRcdGlmICghZXhwYW5kZWQpIHtcblx0XHRcdFx0cmV0dXJuIGxhc3RFbGVtO1xuXHRcdFx0fVxuXHRcdFx0bGFzdEVsZW0gPSB2aWV3ZXIubGFzdFZpc2libGVFbGVtZW50O1xuXHRcdH0gZWxzZSBpZiAoY29tcGFyZVZhbCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgcG90ZW50aWFsTGFzdEVsZW0gPSB2aWV3ZXIuZ2V0UGFyZW50RWxlbWVudChsYXN0RWxlbSk7XG5cdFx0XHRpZiAoaXNTZWFyY2hSZXN1bHQocG90ZW50aWFsTGFzdEVsZW0pKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGFzdEVsZW0gPSBwb3RlbnRpYWxMYXN0RWxlbTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGxhc3RFbGVtO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyxpQ0FBcUU7QUFDOUUsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0IseUJBQXlCO0FBRXBELFlBQVksZUFBZTtBQUMzQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxVQUFVLHdCQUF3QixlQUFlLHFCQUFxQjtBQUMvRSxTQUFTLGNBQWM7QUFDdkIsU0FBUyw4QkFBOEQsdUJBQXVCLHlCQUF5QixtQkFBbUIsZ0JBQWdCLDJCQUEyQjtBQUNyTCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtCQUErQjtBQTJCeEMsZ0JBQWdCLE1BQU0scUJBQXFCLFFBQVE7QUFBQSxFQUVsRCxjQUNFO0FBQ0QsVUFBTTtBQUFBLE1BQ0wsSUFBSSxVQUFVLGlCQUFpQjtBQUFBLE1BQy9CLE9BQU8sSUFBSSxVQUFVLHNCQUFzQixTQUFTO0FBQUEsTUFDcEQ7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLFlBQVk7QUFBQSxRQUNYLFFBQVEsaUJBQWlCO0FBQUEsUUFDekIsTUFBTSxlQUFlLElBQUksVUFBVSxjQUFjLHNCQUFzQixVQUFVLGNBQWMsd0JBQXdCO0FBQUEsUUFDdkgsU0FBUyxRQUFRO0FB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
