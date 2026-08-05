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
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceSet } from "../../../../../base/common/map.js";
import { basenameOrAuthority, dirname } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { getSelectionKeyboardEvent } from "../../../../../platform/list/browser/listService.js";
import { PickerQuickAccessProvider, TriggerAction } from "../../../../../platform/quickinput/browser/pickerQuickAccess.js";
import { DefaultQuickAccessFilterValue } from "../../../../../platform/quickinput/common/quickAccess.js";
import { QuickInputButtonLocation, QuickInputHideReason } from "../../../../../platform/quickinput/common/quickInput.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { searchDetailsIcon, searchOpenInFileIcon, searchActivityBarIcon } from "../searchIcons.js";
import { getEditorSelectionFromMatch } from "../searchView.js";
import { getOutOfWorkspaceEditorResources } from "../../common/search.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../../services/editor/common/editorService.js";
import { QueryBuilder } from "../../../../services/search/common/queryBuilder.js";
import { VIEW_ID } from "../../../../services/search/common/search.js";
import { Event } from "../../../../../base/common/event.js";
import { PickerEditorState } from "../../../../browser/quickaccess.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { Sequencer } from "../../../../../base/common/async.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { SearchModelImpl } from "../searchTreeModel/searchModel.js";
import { SearchModelLocation } from "../searchTreeModel/searchTreeCommon.js";
import { searchComparer } from "../searchCompare.js";
const TEXT_SEARCH_QUICK_ACCESS_PREFIX = "%";
const DEFAULT_TEXT_QUERY_BUILDER_OPTIONS = {
  _reason: "quickAccessSearch",
  disregardIgnoreFiles: false,
  disregardExcludeSettings: false,
  onlyOpenEditors: false,
  expandPatterns: true
};
const MAX_FILES_SHOWN = 30;
const MAX_RESULTS_PER_FILE = 10;
const DEBOUNCE_DELAY = 75;
let TextSearchQuickAccess = class extends PickerQuickAccessProvider {
  constructor(_instantiationService, _contextService, _editorService, _labelService, _viewsService, _configurationService) {
    super(TEXT_SEARCH_QUICK_ACCESS_PREFIX, { canAcceptInBackground: true, shouldSkipTrimPickFilter: true });
    this._instantiationService = _instantiationService;
    this._contextService = _contextService;
    this._editorService = _editorService;
    this._labelService = _labelService;
    this._viewsService = _viewsService;
    this._configurationService = _configurationService;
    this.currentAsyncSearch = Promise.resolve({
      results: [],
      messages: []
    });
    this.queryBuilder = this._instantiationService.createInstance(QueryBuilder);
    this.searchModel = this._register(this._instantiationService.createInstance(SearchModelImpl));
    this.editorViewState = this._register(this._instantiationService.createInstance(PickerEditorState));
    this.searchModel.location = SearchModelLocation.QUICK_ACCESS;
    this.editorSequencer = new Sequencer();
  }
  _getTextQueryBuilderOptions(charsPerLine) {
    return {
      ...DEFAULT_TEXT_QUERY_BUILDER_OPTIONS,
      ...{
        extraFileResources: this._instantiationService.invokeFunction(getOutOfWorkspaceEditorResources),
        maxResults: this.configuration.maxResults ?? void 0,
        isSmartCase: this.configuration.smartCase
      },
      previewOptions: {
        matchLines: 1,
        charsPerLine
      }
    };
  }
  dispose() {
    this.searchModel.dispose();
    super.dispose();
  }
  provide(picker, token, runOptions) {
    const disposables = new DisposableStore();
    if (TEXT_SEARCH_QUICK_ACCESS_PREFIX.length < picker.value.length) {
      picker.valueSelection = [TEXT_SEARCH_QUICK_ACCESS_PREFIX.length, picker.value.length];
    }
    picker.buttons = [{
      location: QuickInputButtonLocation.Inline,
      iconClass: ThemeIcon.asClassName(Codicon.goToSearch),
      tooltip: localize("goToSearch", "Open in Search View")
    }];
    this.editorViewState.reset();
    disposables.add(picker.onDidTriggerButton(async () => {
      if (this.searchModel.searchResult.count() > 0) {
        await this.moveToSearchViewlet(void 0);
      } else {
        this._viewsService.openView(VIEW_ID, true);
      }
      picker.hide();
    }));
    const onDidChangeActive = () => {
      const [item] = picker.activeItems;
      if (item?.match) {
        this.editorViewState.set();
        const itemMatch = item.match;
        this.editorSequencer.queue(async () => {
          await this.editorViewState.openTransientEditor({
            resource: itemMatch.parent().resource,
            options: { preserveFocus: true, revealIfOpened: true, ignoreError: true, selection: itemMatch.range() }
          });
        });
      }
    };
    disposables.add(Event.debounce(picker.onDidChangeActive, (last, event) => event, DEBOUNCE_DELAY, true)(onDidChangeActive));
    disposables.add(Event.once(picker.onWillHide)(({ reason }) => {
      if (reason === QuickInputHideReason.Gesture) {
        this.editorViewState.restore();
      }
    }));
    disposables.add(Event.once(picker.onDidHide)(({ reason }) => {
      this.searchModel.searchResult.toggleHighlights(false);
    }));
    disposables.add(super.provide(picker, token, runOptions));
    disposables.add(picker.onDidAccept(() => this.searchModel.searchResult.toggleHighlights(false)));
    return disposables;
  }
  get configuration() {
    const editorConfig = this._configurationService.getValue().workbench?.editor;
    const searchConfig = this._configurationService.getValue().search;
    return {
      openEditorPinned: !editorConfig?.enablePreviewFromQuickOpen || !editorConfig?.enablePreview,
      preserveInput: searchConfig.quickAccess.preserveInput,
      maxResults: searchConfig.maxResults,
      smartCase: searchConfig.smartCase,
      sortOrder: searchConfig.sortOrder
    };
  }
  get defaultFilterValue() {
    if (this.configuration.preserveInput) {
      return DefaultQuickAccessFilterValue.LAST;
    }
    return void 0;
  }
  doSearch(contentPattern, token) {
    if (contentPattern === "") {
      return void 0;
    }
    const folderResources = this._contextService.getWorkspace().folders;
    const content = {
      pattern: contentPattern
    };
    this.searchModel.searchResult.toggleHighlights(false);
    const charsPerLine = content.isRegExp ? 1e4 : 1e3;
    const query = this.queryBuilder.text(content, folderResources.map((folder) => folder.uri), this._getTextQueryBuilderOptions(charsPerLine));
    const result = this.searchModel.search(query, void 0, token);
    const getAsyncResults = async () => {
      this.currentAsyncSearch = result.asyncResults;
      await result.asyncResults;
      const syncResultURIs = new ResourceSet(result.syncResults.map((e) => e.resource));
      return this.searchModel.searchResult.matches(false).filter((e) => !syncResultURIs.has(e.resource));
    };
    return {
      syncResults: this.searchModel.searchResult.matches(false),
      asyncResults: getAsyncResults()
    };
  }
  async moveToSearchViewlet(currentElem) {
    this._viewsService.openView(VIEW_ID, false);
    const viewlet = this._viewsService.getActiveViewWithId(VIEW_ID);
    await viewlet.replaceSearchModel(this.searchModel, this.currentAsyncSearch);
    this.searchModel = this._instantiationService.createInstance(SearchModelImpl);
    this.searchModel.location = SearchModelLocation.QUICK_ACCESS;
    const viewer = viewlet?.getControl();
    if (currentElem) {
      viewer.setFocus([currentElem], getSelectionKeyboardEvent());
      viewer.setSelection([currentElem], getSelectionKeyboardEvent());
      viewer.reveal(currentElem);
    } else {
      viewlet.searchAndReplaceWidget.focus();
    }
  }
  _getPicksFromMatches(matches, limit, firstFile) {
    matches = matches.sort((a, b) => {
      if (firstFile) {
        if (firstFile === a.resource) {
          return -1;
        } else if (firstFile === b.resource) {
          return 1;
        }
      }
      return searchComparer(a, b, this.configuration.sortOrder);
    });
    const files = matches.length > limit ? matches.slice(0, limit) : matches;
    const picks = [];
    for (let fileIndex = 0; fileIndex < matches.length; fileIndex++) {
      if (fileIndex === limit) {
        picks.push({
          type: "separator"
        });
        picks.push({
          label: localize("QuickSearchSeeMoreFiles", "See More Files"),
          iconClass: ThemeIcon.asClassName(searchDetailsIcon),
          accept: async () => {
            await this.moveToSearchViewlet(matches[limit]);
          }
        });
        break;
      }
      const iFileInstanceMatch = files[fileIndex];
      const label = basenameOrAuthority(iFileInstanceMatch.resource);
      const description = this._labelService.getUriLabel(dirname(iFileInstanceMatch.resource), { relative: true });
      picks.push({
        label,
        type: "separator",
        description,
        buttons: [{
          iconClass: ThemeIcon.asClassName(searchOpenInFileIcon),
          tooltip: localize("QuickSearchOpenInFile", "Open File")
        }],
        trigger: async () => {
          await this.handleAccept(iFileInstanceMatch, {});
          return TriggerAction.CLOSE_PICKER;
        }
      });
      const results = iFileInstanceMatch.matches() ?? [];
      for (let matchIndex = 0; matchIndex < results.length; matchIndex++) {
        const element = results[matchIndex];
        if (matchIndex === MAX_RESULTS_PER_FILE) {
          picks.push({
            label: localize("QuickSearchMore", "More"),
            iconClass: ThemeIcon.asClassName(searchDetailsIcon),
            accept: async () => {
              await this.moveToSearchViewlet(element);
            }
          });
          break;
        }
        const preview = element.preview();
        const previewText = (preview.before + preview.inside + preview.after).trim().substring(0, 999);
        const match = [{
          start: preview.before.length,
          end: preview.before.length + preview.inside.length
        }];
        picks.push({
          label: `${previewText}`,
          highlights: {
            label: match
          },
          buttons: [{
            iconClass: ThemeIcon.asClassName(searchActivityBarIcon),
            tooltip: localize("showMore", "Open in Search View")
          }],
          ariaLabel: `Match at location ${element.range().startLineNumber}:${element.range().startColumn} - ${previewText}`,
          accept: async (keyMods, event) => {
            await this.handleAccept(iFileInstanceMatch, {
              keyMods,
              selection: getEditorSelectionFromMatch(element, this.searchModel),
              preserveFocus: event.inBackground,
              forcePinned: event.inBackground
            });
          },
          trigger: async () => {
            await this.moveToSearchViewlet(element);
            return TriggerAction.CLOSE_PICKER;
          },
          match: element
        });
      }
    }
    return picks;
  }
  async handleAccept(iFileInstanceMatch, options) {
    const editorOptions = {
      preserveFocus: options.preserveFocus,
      pinned: options.keyMods?.ctrlCmd || options.forcePinned || this.configuration.openEditorPinned,
      selection: options.selection
    };
    const targetGroup = options.keyMods?.alt || this.configuration.openEditorPinned && options.keyMods?.ctrlCmd || options.forceOpenSideBySide ? SIDE_GROUP : ACTIVE_GROUP;
    await this._editorService.openEditor({
      resource: iFileInstanceMatch.resource,
      options: editorOptions
    }, targetGroup);
  }
  _getPicks(contentPattern, disposables, token) {
    const searchModelAtTimeOfSearch = this.searchModel;
    if (contentPattern === "") {
      this.searchModel.searchResult.clear();
      return [{
        label: localize("enterSearchTerm", "Enter a term to search for across your files.")
      }];
    }
    const conditionalTokenCts = disposables.add(new CancellationTokenSource());
    disposables.add(token.onCancellationRequested(() => {
      if (searchModelAtTimeOfSearch.location === SearchModelLocation.QUICK_ACCESS) {
        conditionalTokenCts.cancel();
      }
    }));
    const allMatches = this.doSearch(contentPattern, conditionalTokenCts.token);
    if (!allMatches) {
      return null;
    }
    const matches = allMatches.syncResults;
    const syncResult = this._getPicksFromMatches(matches, MAX_FILES_SHOWN, this._editorService.activeEditor?.resource);
    if (syncResult.length > 0) {
      this.searchModel.searchResult.toggleHighlights(true);
    }
    if (matches.length >= MAX_FILES_SHOWN) {
      return syncResult;
    }
    return {
      picks: syncResult,
      additionalPicks: allMatches.asyncResults.then((asyncResults) => asyncResults.length + syncResult.length === 0 ? [{
        label: localize("noAnythingResults", "No matching results")
      }] : this._getPicksFromMatches(asyncResults, MAX_FILES_SHOWN - matches.length)).then((picks) => {
        if (picks.length > 0) {
          this.searchModel.searchResult.toggleHighlights(true);
        }
        return picks;
      })
    };
  }
};
TextSearchQuickAccess = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, IConfigurationService)
], TextSearchQuickAccess);
export {
  TEXT_SEARCH_QUICK_ACCESS_PREFIX,
  TextSearchQuickAccess
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9xdWlja1RleHRTZWFyY2gvdGV4dFNlYXJjaFF1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lT3JBdXRob3JpdHksIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElUZXh0RWRpdG9yU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWUsIGdldFNlbGVjdGlvbktleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmFzdEFuZFNsb3dQaWNrcywgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSwgSVBpY2tlclF1aWNrQWNjZXNzU2VwYXJhdG9yLCBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyLCBQaWNrcywgVHJpZ2dlckFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0UXVpY2tBY2Nlc3NGaWx0ZXJWYWx1ZSwgSVF1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgSUtleU1vZHMsIElRdWlja1BpY2ssIElRdWlja1BpY2tJdGVtLCBRdWlja0lucHV0QnV0dG9uTG9jYXRpb24sIFF1aWNrSW5wdXRIaWRlUmVhc29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRWRpdG9yQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgc2VhcmNoRGV0YWlsc0ljb24sIHNlYXJjaE9wZW5JbkZpbGVJY29uLCBzZWFyY2hBY3Rpdml0eUJhckljb24gfSBmcm9tICcuLi9zZWFyY2hJY29ucy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hWaWV3LCBnZXRFZGl0b3JTZWxlY3Rpb25Gcm9tTWF0Y2ggfSBmcm9tICcuLi9zZWFyY2hWaWV3LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hTZWFyY2hDb25maWd1cmF0aW9uLCBnZXRPdXRPZldvcmtzcGFjZUVkaXRvclJlc291cmNlcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dFF1ZXJ5QnVpbGRlck9wdGlvbnMsIFF1ZXJ5QnVpbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vcXVlcnlCdWlsZGVyLmpzJztcbmltcG9ydCB7IElQYXR0ZXJuSW5mbywgSVNlYXJjaENvbXBsZXRlLCBJVGV4dFF1ZXJ5LCBWSUVXX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBQaWNrZXJFZGl0b3JTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcXVpY2thY2Nlc3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VxdWVuY2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hNb2RlbEltcGwgfSBmcm9tICcuLi9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoTW9kZWwuanMnO1xuaW1wb3J0IHsgU2VhcmNoTW9kZWxMb2NhdGlvbiwgUmVuZGVyYWJsZU1hdGNoLCBJU2VhcmNoVHJlZUZpbGVNYXRjaCwgSVNlYXJjaFRyZWVNYXRjaCwgSVNlYXJjaFJlc3VsdCB9IGZyb20gJy4uL3NlYXJjaFRyZWVNb2RlbC9zZWFyY2hUcmVlQ29tbW9uLmpzJztcbmltcG9ydCB7IHNlYXJjaENvbXBhcmVyIH0gZnJvbSAnLi4vc2VhcmNoQ29tcGFyZS5qcyc7XG5pbXBvcnQgeyBJTWF0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcblxuZXhwb3J0IGNvbnN0IFRFWFRfU0VBUkNIX1FVSUNLX0FDQ0VTU19QUkVGSVggPSAnJSc7XG5cbmNvbnN0IERFRkFVTFRfVEVYVF9RVUVSWV9CVUlMREVSX09QVElPTlM6IElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucyA9IHtcblx0X3JlYXNvbjogJ3F1aWNrQWNjZXNzU2VhcmNoJyxcblx0ZGlzcmVnYXJkSWdub3JlRmlsZXM6IGZhbHNlLFxuXHRkaXNyZWdhcmRFeGNsdWRlU2V0dGluZ3M6IGZhbHNlLFxuXHRvbmx5T3BlbkVkaXRvcnM6IGZhbHNlLFxuXHRleHBhbmRQYXR0ZXJuczogdHJ1ZVxufTtcblxuY29uc3QgTUFYX0ZJTEVTX1NIT1dOID0gMzA7XG5jb25zdCBNQVhfUkVTVUxUU19QRVJfRklMRSA9IDEwO1xuY29uc3QgREVCT1VOQ0VfREVMQVkgPSA3NTtcblxuaW50ZXJmYWNlIElUZXh0U2VhcmNoUXVpY2tBY2Nlc3NJdGVtIGV4dGVuZHMgSVBpY2tlclF1aWNrQWNjZXNzSXRlbSB7XG5cdG1hdGNoPzogSVNlYXJjaFRyZWVNYXRjaDtcbn1cbmV4cG9ydCBjbGFzcyBUZXh0U2VhcmNoUXVpY2tBY2Nlc3MgZXh0ZW5kcyBQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyPElUZXh0U2VhcmNoUXVpY2tBY2Nlc3NJdGVtPiB7XG5cblx0cHJpdmF0ZSBlZGl0b3JTZXF1ZW5jZXI6IFNlcXVlbmNlcjtcblx0cHJpdmF0ZSBxdWVyeUJ1aWxkZXI6IFF1ZXJ5QnVpbGRlcjtcblx0cHJpdmF0ZSBzZWFyY2hNb2RlbDogU2VhcmNoTW9kZWxJbXBsO1xuXHRwcml2YXRlIGN1cnJlbnRBc3luY1NlYXJjaDogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+ID0gUHJvbWlzZS5yZXNvbHZlKHtcblx0XHRyZXN1bHRzOiBbXSxcblx0XHRtZXNzYWdlczogW11cblx0fSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yVmlld1N0YXRlOiBQaWNrZXJFZGl0b3JTdGF0ZTtcblxuXHRwcml2YXRlIF9nZXRUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucyhjaGFyc1BlckxpbmU6IG51bWJlcik6IElUZXh0UXVlcnlCdWlsZGVyT3B0aW9ucyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLkRFRkFVTFRfVEVYVF9RVUVSWV9CVUlMREVSX09QVElPTlMsXG5cdFx0XHQuLi4ge1xuXHRcdFx0XHRleHRyYUZpbGVSZXNvdXJjZXM6IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldE91dE9mV29ya3NwYWNlRWRpdG9yUmVzb3VyY2VzKSxcblx0XHRcdFx0bWF4UmVzdWx0czogdGhpcy5jb25maWd1cmF0aW9uLm1heFJlc3VsdHMgPz8gdW5kZWZpbmVkLFxuXHRcdFx0XHRpc1NtYXJ0Q2FzZTogdGhpcy5jb25maWd1cmF0aW9uLnNtYXJ0Q2FzZSxcblx0XHRcdH0sXG5cblx0XHRcdHByZXZpZXdPcHRpb25zOiB7XG5cdFx0XHRcdG1hdGNoTGluZXM6IDEsXG5cdFx0XHRcdGNoYXJzUGVyTGluZVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElWaWV3c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihURVhUX1NFQVJDSF9RVUlDS19BQ0NFU1NfUFJFRklYLCB7IGNhbkFjY2VwdEluQmFja2dyb3VuZDogdHJ1ZSwgc2hvdWxkU2tpcFRyaW1QaWNrRmlsdGVyOiB0cnVlIH0pO1xuXG5cdFx0dGhpcy5xdWVyeUJ1aWxkZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXHRcdHRoaXMuc2VhcmNoTW9kZWwgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpKTtcblx0XHR0aGlzLmVkaXRvclZpZXdTdGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFBpY2tlckVkaXRvclN0YXRlKSk7XG5cdFx0dGhpcy5zZWFyY2hNb2RlbC5sb2NhdGlvbiA9IFNlYXJjaE1vZGVsTG9jYXRpb24uUVVJQ0tfQUNDRVNTO1xuXHRcdHRoaXMuZWRpdG9yU2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaE1vZGVsLmRpc3Bvc2UoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBwcm92aWRlKHBpY2tlcjogSVF1aWNrUGljazxJVGV4dFNlYXJjaFF1aWNrQWNjZXNzSXRlbSwgeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0+LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIHJ1bk9wdGlvbnM/OiBJUXVpY2tBY2Nlc3NQcm92aWRlclJ1bk9wdGlvbnMpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0aWYgKFRFWFRfU0VBUkNIX1FVSUNLX0FDQ0VTU19QUkVGSVgubGVuZ3RoIDwgcGlja2VyLnZhbHVlLmxlbmd0aCkge1xuXHRcdFx0cGlja2VyLnZhbHVlU2VsZWN0aW9uID0gW1RFWFRfU0VBUkNIX1FVSUNLX0FDQ0VTU19QUkVGSVgubGVuZ3RoLCBwaWNrZXIudmFsdWUubGVuZ3RoXTtcblx0XHR9XG5cdFx0cGlja2VyLmJ1dHRvbnMgPSBbe1xuXHRcdFx0bG9jYXRpb246IFF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbi5JbmxpbmUsXG5cdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmdvVG9TZWFyY2gpLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2dvVG9TZWFyY2gnLCBcIk9wZW4gaW4gU2VhcmNoIFZpZXdcIilcblx0XHR9XTtcblx0XHR0aGlzLmVkaXRvclZpZXdTdGF0ZS5yZXNldCgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRUcmlnZ2VyQnV0dG9uKGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdC5jb3VudCgpID4gMCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLm1vdmVUb1NlYXJjaFZpZXdsZXQodW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3ZpZXdzU2VydmljZS5vcGVuVmlldyhWSUVXX0lELCB0cnVlKTtcblx0XHRcdH1cblx0XHRcdHBpY2tlci5oaWRlKCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VBY3RpdmUgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBbaXRlbV0gPSBwaWNrZXIuYWN0aXZlSXRlbXM7XG5cblx0XHRcdGlmIChpdGVtPy5tYXRjaCkge1xuXHRcdFx0XHQvLyB3ZSBtdXN0IHJlbWVtYmVyIG91ciBjdXJyZXQgdmlldyBzdGF0ZSB0byBiZSBhYmxlIHRvIHJlc3RvcmUgKHdpbGwgYXV0b21hdGljYWxseSB0cmFjayBpZiB0aGVyZSBpcyBhbHJlYWR5IHN0b3JlZCBzdGF0ZSlcblx0XHRcdFx0dGhpcy5lZGl0b3JWaWV3U3RhdGUuc2V0KCk7XG5cdFx0XHRcdGNvbnN0IGl0ZW1NYXRjaCA9IGl0ZW0ubWF0Y2g7XG5cdFx0XHRcdHRoaXMuZWRpdG9yU2VxdWVuY2VyLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmVkaXRvclZpZXdTdGF0ZS5vcGVuVHJhbnNpZW50RWRpdG9yKHtcblx0XHRcdFx0XHRcdHJlc291cmNlOiBpdGVtTWF0Y2gucGFyZW50KCkucmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRvcHRpb25zOiB7IHByZXNlcnZlRm9jdXM6IHRydWUsIHJldmVhbElmT3BlbmVkOiB0cnVlLCBpZ25vcmVFcnJvcjogdHJ1ZSwgc2VsZWN0aW9uOiBpdGVtTWF0Y2gucmFuZ2UoKSB9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQuZGVib3VuY2UocGlja2VyLm9uRGlkQ2hhbmdlQWN0aXZlLCAobGFzdCwgZXZlbnQpID0+IGV2ZW50LCBERUJPVU5DRV9ERUxBWSwgdHJ1ZSkob25EaWRDaGFuZ2VBY3RpdmUpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZShwaWNrZXIub25XaWxsSGlkZSkoKHsgcmVhc29uIH0pID0+IHtcblx0XHRcdC8vIFJlc3RvcmUgdmlldyBzdGF0ZSB1cG9uIGNhbmNlbGxhdGlvbiBpZiB3ZSBjaGFuZ2VkIGl0XG5cdFx0XHQvLyBidXQgb25seSB3aGVuIHRoZSBwaWNrZXIgd2FzIGNsb3NlZCB2aWEgZXhwbGljaXQgdXNlclxuXHRcdFx0Ly8gZ2VzdHVyZSBhbmQgbm90IGUuZy4gd2hlbiBmb2N1cyB3YXMgbG9zdCBiZWNhdXNlIHRoYXRcblx0XHRcdC8vIGNvdWxkIG1lYW4gdGhlIHVzZXIgY2xpY2tlZCBpbnRvIHRoZSBlZGl0b3IgZGlyZWN0bHkuXG5cdFx0XHRpZiAocmVhc29uID09PSBRdWlja0lucHV0SGlkZVJlYXNvbi5HZXN0dXJlKSB7XG5cdFx0XHRcdHRoaXMuZWRpdG9yVmlld1N0YXRlLnJlc3RvcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQub25jZShwaWNrZXIub25EaWRIaWRlKSgoeyByZWFzb24gfSkgPT4ge1xuXHRcdFx0dGhpcy5zZWFyY2hNb2RlbC5zZWFyY2hSZXN1bHQudG9nZ2xlSGlnaGxpZ2h0cyhmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHN1cGVyLnByb3ZpZGUocGlja2VyLCB0b2tlbiwgcnVuT3B0aW9ucykpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChwaWNrZXIub25EaWRBY2NlcHQoKCkgPT4gdGhpcy5zZWFyY2hNb2RlbC5zZWFyY2hSZXN1bHQudG9nZ2xlSGlnaGxpZ2h0cyhmYWxzZSkpKTtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZXM7XG5cdH1cblxuXHRwcml2YXRlIGdldCBjb25maWd1cmF0aW9uKCkge1xuXHRcdGNvbnN0IGVkaXRvckNvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXb3JrYmVuY2hFZGl0b3JDb25maWd1cmF0aW9uPigpLndvcmtiZW5jaD8uZWRpdG9yO1xuXHRcdGNvbnN0IHNlYXJjaENvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElXb3JrYmVuY2hTZWFyY2hDb25maWd1cmF0aW9uPigpLnNlYXJjaDtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRvcGVuRWRpdG9yUGlubmVkOiAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3RnJvbVF1aWNrT3BlbiB8fCAhZWRpdG9yQ29uZmlnPy5lbmFibGVQcmV2aWV3LFxuXHRcdFx0cHJlc2VydmVJbnB1dDogc2VhcmNoQ29uZmlnLnF1aWNrQWNjZXNzLnByZXNlcnZlSW5wdXQsXG5cdFx0XHRtYXhSZXN1bHRzOiBzZWFyY2hDb25maWcubWF4UmVzdWx0cyxcblx0XHRcdHNtYXJ0Q2FzZTogc2VhcmNoQ29uZmlnLnNtYXJ0Q2FzZSxcblx0XHRcdHNvcnRPcmRlcjogc2VhcmNoQ29uZmlnLnNvcnRPcmRlcixcblx0XHR9O1xuXHR9XG5cblx0Z2V0IGRlZmF1bHRGaWx0ZXJWYWx1ZSgpOiBEZWZhdWx0UXVpY2tBY2Nlc3NGaWx0ZXJWYWx1ZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvbi5wcmVzZXJ2ZUlucHV0KSB7XG5cdFx0XHRyZXR1cm4gRGVmYXVsdFF1aWNrQWNjZXNzRmlsdGVyVmFsdWUuTEFTVDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1NlYXJjaChjb250ZW50UGF0dGVybjogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiB7XG5cdFx0c3luY1Jlc3VsdHM6IElTZWFyY2hUcmVlRmlsZU1hdGNoW107XG5cdFx0YXN5bmNSZXN1bHRzOiBQcm9taXNlPElTZWFyY2hUcmVlRmlsZU1hdGNoW10+O1xuXHR9IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoY29udGVudFBhdHRlcm4gPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbGRlclJlc291cmNlczogSVdvcmtzcGFjZUZvbGRlcltdID0gdGhpcy5fY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRjb25zdCBjb250ZW50OiBJUGF0dGVybkluZm8gPSB7XG5cdFx0XHRwYXR0ZXJuOiBjb250ZW50UGF0dGVybixcblx0XHR9O1xuXHRcdHRoaXMuc2VhcmNoTW9kZWwuc2VhcmNoUmVzdWx0LnRvZ2dsZUhpZ2hsaWdodHMoZmFsc2UpO1xuXHRcdGNvbnN0IGNoYXJzUGVyTGluZSA9IGNvbnRlbnQuaXNSZWdFeHAgPyAxMDAwMCA6IDEwMDA7IC8vIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi9lN2FkNTY1MWFjMjZmYTAwYTQwYWExZTQwMTBlODFiOTJmNjU1NTY5L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hWaWV3LnRzI0wxNTA4XG5cblx0XHRjb25zdCBxdWVyeTogSVRleHRRdWVyeSA9IHRoaXMucXVlcnlCdWlsZGVyLnRleHQoY29udGVudCwgZm9sZGVyUmVzb3VyY2VzLm1hcChmb2xkZXIgPT4gZm9sZGVyLnVyaSksIHRoaXMuX2dldFRleHRRdWVyeUJ1aWxkZXJPcHRpb25zKGNoYXJzUGVyTGluZSkpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5zZWFyY2hNb2RlbC5zZWFyY2gocXVlcnksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXG5cdFx0Y29uc3QgZ2V0QXN5bmNSZXN1bHRzID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhpcy5jdXJyZW50QXN5bmNTZWFyY2ggPSByZXN1bHQuYXN5bmNSZXN1bHRzO1xuXHRcdFx0YXdhaXQgcmVzdWx0LmFzeW5jUmVzdWx0cztcblx0XHRcdGNvbnN0IHN5bmNSZXN1bHRVUklzID0gbmV3IFJlc291cmNlU2V0KHJlc3VsdC5zeW5jUmVzdWx0cy5tYXAoZSA9PiBlLnJlc291cmNlKSk7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZWFyY2hNb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcyhmYWxzZSkuZmlsdGVyKGUgPT4gIXN5bmNSZXN1bHRVUklzLmhhcyhlLnJlc291cmNlKSk7XG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c3luY1Jlc3VsdHM6IHRoaXMuc2VhcmNoTW9kZWwuc2VhcmNoUmVzdWx0Lm1hdGNoZXMoZmFsc2UpLFxuXHRcdFx0YXN5bmNSZXN1bHRzOiBnZXRBc3luY1Jlc3VsdHMoKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG1vdmVUb1NlYXJjaFZpZXdsZXQoY3VycmVudEVsZW06IFJlbmRlcmFibGVNYXRjaCB8IHVuZGVmaW5lZCkge1xuXHRcdC8vIHRoaXMgZnVuY3Rpb24gdGFrZXMgdGhpcy5fc2VhcmNoTW9kZWwgYW5kIG1vdmVzIGl0IHRvIHRoZSBzZWFyY2ggdmlld2xldCdzIHNlYXJjaCBtb2RlbC5cblx0XHQvLyB0aGVuLCB0aGlzLl9zZWFyY2hNb2RlbCB3aWxsIGNvbnN0cnVjdCBhIG5ldyAoZW1wdHkpIFNlYXJjaE1vZGVsLlxuXHRcdHRoaXMuX3ZpZXdzU2VydmljZS5vcGVuVmlldyhWSUVXX0lELCBmYWxzZSk7XG5cdFx0Y29uc3Qgdmlld2xldDogU2VhcmNoVmlldyB8IHVuZGVmaW5lZCA9IHRoaXMuX3ZpZXdzU2VydmljZS5nZXRBY3RpdmVWaWV3V2l0aElkKFZJRVdfSUQpIGFzIFNlYXJjaFZpZXc7XG5cdFx0YXdhaXQgdmlld2xldC5yZXBsYWNlU2VhcmNoTW9kZWwodGhpcy5zZWFyY2hNb2RlbCwgdGhpcy5jdXJyZW50QXN5bmNTZWFyY2gpO1xuXG5cdFx0dGhpcy5zZWFyY2hNb2RlbCA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0dGhpcy5zZWFyY2hNb2RlbC5sb2NhdGlvbiA9IFNlYXJjaE1vZGVsTG9jYXRpb24uUVVJQ0tfQUNDRVNTO1xuXG5cdFx0Y29uc3Qgdmlld2VyOiBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPElTZWFyY2hSZXN1bHQsIFJlbmRlcmFibGVNYXRjaD4gfCB1bmRlZmluZWQgPSB2aWV3bGV0Py5nZXRDb250cm9sKCk7XG5cdFx0aWYgKGN1cnJlbnRFbGVtKSB7XG5cdFx0XHR2aWV3ZXIuc2V0Rm9jdXMoW2N1cnJlbnRFbGVtXSwgZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCgpKTtcblx0XHRcdHZpZXdlci5zZXRTZWxlY3Rpb24oW2N1cnJlbnRFbGVtXSwgZ2V0U2VsZWN0aW9uS2V5Ym9hcmRFdmVudCgpKTtcblx0XHRcdHZpZXdlci5yZXZlYWwoY3VycmVudEVsZW0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2aWV3bGV0LnNlYXJjaEFuZFJlcGxhY2VXaWRnZXQuZm9jdXMoKTtcblx0XHR9XG5cdH1cblxuXG5cdHByaXZhdGUgX2dldFBpY2tzRnJvbU1hdGNoZXMobWF0Y2hlczogSVNlYXJjaFRyZWVGaWxlTWF0Y2hbXSwgbGltaXQ6IG51bWJlciwgZmlyc3RGaWxlPzogVVJJKTogKElQaWNrZXJRdWlja0FjY2Vzc1NlcGFyYXRvciB8IElUZXh0U2VhcmNoUXVpY2tBY2Nlc3NJdGVtKVtdIHtcblx0XHRtYXRjaGVzID0gbWF0Y2hlcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRpZiAoZmlyc3RGaWxlKSB7XG5cdFx0XHRcdGlmIChmaXJzdEZpbGUgPT09IGEucmVzb3VyY2UpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZmlyc3RGaWxlID09PSBiLnJlc291cmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBzZWFyY2hDb21wYXJlcihhLCBiLCB0aGlzLmNvbmZpZ3VyYXRpb24uc29ydE9yZGVyKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGZpbGVzID0gbWF0Y2hlcy5sZW5ndGggPiBsaW1pdCA/IG1hdGNoZXMuc2xpY2UoMCwgbGltaXQpIDogbWF0Y2hlcztcblx0XHRjb25zdCBwaWNrczogQXJyYXk8SVRleHRTZWFyY2hRdWlja0FjY2Vzc0l0ZW0gfCBJUGlja2VyUXVpY2tBY2Nlc3NTZXBhcmF0b3I+ID0gW107XG5cblx0XHRmb3IgKGxldCBmaWxlSW5kZXggPSAwOyBmaWxlSW5kZXggPCBtYXRjaGVzLmxlbmd0aDsgZmlsZUluZGV4KyspIHtcblx0XHRcdGlmIChmaWxlSW5kZXggPT09IGxpbWl0KSB7XG5cblx0XHRcdFx0cGlja3MucHVzaCh7XG5cdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnUXVpY2tTZWFyY2hTZWVNb3JlRmlsZXMnLCBcIlNlZSBNb3JlIEZpbGVzXCIpLFxuXHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNlYXJjaERldGFpbHNJY29uKSxcblx0XHRcdFx0XHRhY2NlcHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMubW92ZVRvU2VhcmNoVmlld2xldChtYXRjaGVzW2xpbWl0XSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGlGaWxlSW5zdGFuY2VNYXRjaCA9IGZpbGVzW2ZpbGVJbmRleF07XG5cblx0XHRcdGNvbnN0IGxhYmVsID0gYmFzZW5hbWVPckF1dGhvcml0eShpRmlsZUluc3RhbmNlTWF0Y2gucmVzb3VyY2UpO1xuXHRcdFx0Y29uc3QgZGVzY3JpcHRpb24gPSB0aGlzLl9sYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZGlybmFtZShpRmlsZUluc3RhbmNlTWF0Y2gucmVzb3VyY2UpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXG5cblx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRidXR0b25zOiBbe1xuXHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNlYXJjaE9wZW5JbkZpbGVJY29uKSxcblx0XHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnUXVpY2tTZWFyY2hPcGVuSW5GaWxlJywgXCJPcGVuIEZpbGVcIilcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHRyaWdnZXI6IGFzeW5jICgpOiBQcm9taXNlPFRyaWdnZXJBY3Rpb24+ID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmhhbmRsZUFjY2VwdChpRmlsZUluc3RhbmNlTWF0Y2gsIHt9KTtcblx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5DTE9TRV9QSUNLRVI7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcmVzdWx0czogSVNlYXJjaFRyZWVNYXRjaFtdID0gaUZpbGVJbnN0YW5jZU1hdGNoLm1hdGNoZXMoKSA/PyBbXTtcblx0XHRcdGZvciAobGV0IG1hdGNoSW5kZXggPSAwOyBtYXRjaEluZGV4IDwgcmVzdWx0cy5sZW5ndGg7IG1hdGNoSW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gcmVzdWx0c1ttYXRjaEluZGV4XTtcblxuXHRcdFx0XHRpZiAobWF0Y2hJbmRleCA9PT0gTUFYX1JFU1VMVFNfUEVSX0ZJTEUpIHtcblx0XHRcdFx0XHRwaWNrcy5wdXNoKHtcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnUXVpY2tTZWFyY2hNb3JlJywgXCJNb3JlXCIpLFxuXHRcdFx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoc2VhcmNoRGV0YWlsc0ljb24pLFxuXHRcdFx0XHRcdFx0YWNjZXB0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMubW92ZVRvU2VhcmNoVmlld2xldChlbGVtZW50KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHByZXZpZXcgPSBlbGVtZW50LnByZXZpZXcoKTtcblx0XHRcdFx0Y29uc3QgcHJldmlld1RleHQgPSAocHJldmlldy5iZWZvcmUgKyBwcmV2aWV3Lmluc2lkZSArIHByZXZpZXcuYWZ0ZXIpLnRyaW0oKS5zdWJzdHJpbmcoMCwgOTk5KTtcblx0XHRcdFx0Y29uc3QgbWF0Y2g6IElNYXRjaFtdID0gW3tcblx0XHRcdFx0XHRzdGFydDogcHJldmlldy5iZWZvcmUubGVuZ3RoLFxuXHRcdFx0XHRcdGVuZDogcHJldmlldy5iZWZvcmUubGVuZ3RoICsgcHJldmlldy5pbnNpZGUubGVuZ3RoXG5cdFx0XHRcdH1dO1xuXHRcdFx0XHRwaWNrcy5wdXNoKHtcblx0XHRcdFx0XHRsYWJlbDogYCR7cHJldmlld1RleHR9YCxcblx0XHRcdFx0XHRoaWdobGlnaHRzOiB7XG5cdFx0XHRcdFx0XHRsYWJlbDogbWF0Y2hcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGJ1dHRvbnM6IFt7XG5cdFx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShzZWFyY2hBY3Rpdml0eUJhckljb24pLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3Nob3dNb3JlJywgXCJPcGVuIGluIFNlYXJjaCBWaWV3XCIpLFxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdGFyaWFMYWJlbDogYE1hdGNoIGF0IGxvY2F0aW9uICR7ZWxlbWVudC5yYW5nZSgpLnN0YXJ0TGluZU51bWJlcn06JHtlbGVtZW50LnJhbmdlKCkuc3RhcnRDb2x1bW59IC0gJHtwcmV2aWV3VGV4dH1gLFxuXHRcdFx0XHRcdGFjY2VwdDogYXN5bmMgKGtleU1vZHMsIGV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmhhbmRsZUFjY2VwdChpRmlsZUluc3RhbmNlTWF0Y2gsIHtcblx0XHRcdFx0XHRcdFx0a2V5TW9kcyxcblx0XHRcdFx0XHRcdFx0c2VsZWN0aW9uOiBnZXRFZGl0b3JTZWxlY3Rpb25Gcm9tTWF0Y2goZWxlbWVudCwgdGhpcy5zZWFyY2hNb2RlbCksXG5cdFx0XHRcdFx0XHRcdHByZXNlcnZlRm9jdXM6IGV2ZW50LmluQmFja2dyb3VuZCxcblx0XHRcdFx0XHRcdFx0Zm9yY2VQaW5uZWQ6IGV2ZW50LmluQmFja2dyb3VuZFxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0cmlnZ2VyOiBhc3luYyAoKTogUHJvbWlzZTxUcmlnZ2VyQWN0aW9uPiA9PiB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLm1vdmVUb1NlYXJjaFZpZXdsZXQoZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gVHJpZ2dlckFjdGlvbi5DTE9TRV9QSUNLRVI7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtYXRjaDogZWxlbWVudFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHBpY2tzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVBY2NlcHQoaUZpbGVJbnN0YW5jZU1hdGNoOiBJU2VhcmNoVHJlZUZpbGVNYXRjaCwgb3B0aW9uczogeyBrZXlNb2RzPzogSUtleU1vZHM7IHNlbGVjdGlvbj86IElUZXh0RWRpdG9yU2VsZWN0aW9uOyBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbjsgcmFuZ2U/OiBJUmFuZ2U7IGZvcmNlUGlubmVkPzogYm9vbGVhbjsgZm9yY2VPcGVuU2lkZUJ5U2lkZT86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvck9wdGlvbnMgPSB7XG5cdFx0XHRwcmVzZXJ2ZUZvY3VzOiBvcHRpb25zLnByZXNlcnZlRm9jdXMsXG5cdFx0XHRwaW5uZWQ6IG9wdGlvbnMua2V5TW9kcz8uY3RybENtZCB8fCBvcHRpb25zLmZvcmNlUGlubmVkIHx8IHRoaXMuY29uZmlndXJhdGlvbi5vcGVuRWRpdG9yUGlubmVkLFxuXHRcdFx0c2VsZWN0aW9uOiBvcHRpb25zLnNlbGVjdGlvblxuXHRcdH07XG5cblx0XHQvLyBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2Jsb2IvZjQwZGFiY2EwN2ExNjIyYjJhMGFlM2VlNzQxY2ZjOTRhYjk2NGJlZi9zcmMvdnMvd29ya2JlbmNoL2NvbnRyaWIvc2VhcmNoL2Jyb3dzZXIvYW55dGhpbmdRdWlja0FjY2Vzcy50cyNMMTAzN1xuXHRcdGNvbnN0IHRhcmdldEdyb3VwID0gb3B0aW9ucy5rZXlNb2RzPy5hbHQgfHwgKHRoaXMuY29uZmlndXJhdGlvbi5vcGVuRWRpdG9yUGlubmVkICYmIG9wdGlvbnMua2V5TW9kcz8uY3RybENtZCkgfHwgb3B0aW9ucy5mb3JjZU9wZW5TaWRlQnlTaWRlID8gU0lERV9HUk9VUCA6IEFDVElWRV9HUk9VUDtcblxuXHRcdGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRyZXNvdXJjZTogaUZpbGVJbnN0YW5jZU1hdGNoLnJlc291cmNlLFxuXHRcdFx0b3B0aW9uczogZWRpdG9yT3B0aW9uc1xuXHRcdH0sIHRhcmdldEdyb3VwKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0UGlja3MoY29udGVudFBhdHRlcm46IHN0cmluZywgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUGlja3M8SVF1aWNrUGlja0l0ZW0+IHwgUHJvbWlzZTxQaWNrczxJUXVpY2tQaWNrSXRlbT4gfCBGYXN0QW5kU2xvd1BpY2tzPElRdWlja1BpY2tJdGVtPj4gfCBGYXN0QW5kU2xvd1BpY2tzPElRdWlja1BpY2tJdGVtPiB8IG51bGwge1xuXG5cdFx0Y29uc3Qgc2VhcmNoTW9kZWxBdFRpbWVPZlNlYXJjaCA9IHRoaXMuc2VhcmNoTW9kZWw7XG5cdFx0aWYgKGNvbnRlbnRQYXR0ZXJuID09PSAnJykge1xuXG5cdFx0XHR0aGlzLnNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdC5jbGVhcigpO1xuXHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZW50ZXJTZWFyY2hUZXJtJywgXCJFbnRlciBhIHRlcm0gdG8gc2VhcmNoIGZvciBhY3Jvc3MgeW91ciBmaWxlcy5cIilcblx0XHRcdH1dO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmRpdGlvbmFsVG9rZW5DdHMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdGlmIChzZWFyY2hNb2RlbEF0VGltZU9mU2VhcmNoLmxvY2F0aW9uID09PSBTZWFyY2hNb2RlbExvY2F0aW9uLlFVSUNLX0FDQ0VTUykge1xuXHRcdFx0XHQvLyBpZiB0aGUgc2VhcmNoIG1vZGVsIGhhcyBub3QgYmVlbiBpbXBvcnRlZCB0byB0aGUgcGFuZWwsIHlvdSBjYW4gY2FuY2VsXG5cdFx0XHRcdGNvbmRpdGlvbmFsVG9rZW5DdHMuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGNvbnN0IGFsbE1hdGNoZXMgPSB0aGlzLmRvU2VhcmNoKGNvbnRlbnRQYXR0ZXJuLCBjb25kaXRpb25hbFRva2VuQ3RzLnRva2VuKTtcblxuXHRcdGlmICghYWxsTWF0Y2hlcykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IG1hdGNoZXMgPSBhbGxNYXRjaGVzLnN5bmNSZXN1bHRzO1xuXHRcdGNvbnN0IHN5bmNSZXN1bHQgPSB0aGlzLl9nZXRQaWNrc0Zyb21NYXRjaGVzKG1hdGNoZXMsIE1BWF9GSUxFU19TSE9XTiwgdGhpcy5fZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I/LnJlc291cmNlKTtcblx0XHRpZiAoc3luY1Jlc3VsdC5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLnNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdC50b2dnbGVIaWdobGlnaHRzKHRydWUpO1xuXHRcdH1cblxuXHRcdGlmIChtYXRjaGVzLmxlbmd0aCA+PSBNQVhfRklMRVNfU0hPV04pIHtcblx0XHRcdHJldHVybiBzeW5jUmVzdWx0O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRwaWNrczogc3luY1Jlc3VsdCxcblx0XHRcdGFkZGl0aW9uYWxQaWNrczogYWxsTWF0Y2hlcy5hc3luY1Jlc3VsdHNcblx0XHRcdFx0LnRoZW4oYXN5bmNSZXN1bHRzID0+IChhc3luY1Jlc3VsdHMubGVuZ3RoICsgc3luY1Jlc3VsdC5sZW5ndGggPT09IDApID8gW3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ25vQW55dGhpbmdSZXN1bHRzJywgXCJObyBtYXRjaGluZyByZXN1bHRzXCIpXG5cdFx0XHRcdH1dIDogdGhpcy5fZ2V0UGlja3NGcm9tTWF0Y2hlcyhhc3luY1Jlc3VsdHMsIE1BWF9GSUxFU19TSE9XTiAtIG1hdGNoZXMubGVuZ3RoKSlcblx0XHRcdFx0LnRoZW4ocGlja3MgPT4ge1xuXHRcdFx0XHRcdGlmIChwaWNrcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdC50b2dnbGVIaWdobGlnaHRzKHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcGlja3M7XG5cdFx0XHRcdH0pXG5cdFx0fTtcblxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUlBLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLHVCQUFvQztBQUM3QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHFCQUFxQixlQUFlO0FBQzdDLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQTZDLGlDQUFpQztBQUM5RSxTQUFnRiwyQkFBa0MscUJBQXFCO0FBQ3ZJLFNBQVMscUNBQXFFO0FBQzlFLFNBQStDLDBCQUEwQiw0QkFBNEI7QUFDckcsU0FBUyxnQ0FBa0Q7QUFFM0QsU0FBUyxtQkFBbUIsc0JBQXNCLDZCQUE2QjtBQUMvRSxTQUFxQixtQ0FBbUM7QUFDeEQsU0FBd0Msd0NBQXdDO0FBQ2hGLFNBQVMsY0FBYyxnQkFBZ0Isa0JBQWtCO0FBQ3pELFNBQW1DLG9CQUFvQjtBQUN2RCxTQUFvRCxlQUFlO0FBQ25FLFNBQVMsYUFBYTtBQUN0QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLGVBQWU7QUFDeEIsU0FB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
