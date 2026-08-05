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
import "./media/timelinePane.css";
import { localize, localize2 } from "../../../../nls.js";
import * as DOM from "../../../../base/browser/dom.js";
import * as css from "../../../../base/browser/cssValue.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { fromNow } from "../../../../base/common/date.js";
import { debounce } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { createMatches } from "../../../../base/common/filters.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { DisposableStore, Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { escapeRegExpCharacters } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ITimelineService } from "../common/timeline.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { SideBySideEditor, EditorResourceAccessor } from "../../../common/editor.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getContextMenuActions, createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId, registerAction2, Action2, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from "../../../browser/parts/editor/editorCommands.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { isString } from "../../../../base/common/types.js";
import { renderMarkdownAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
const ItemHeight = 22;
function isLoadMoreCommand(item) {
  return item instanceof LoadMoreCommand;
}
function isTimelineItem(item) {
  return !!item && !item.handle.startsWith("vscode-command:");
}
function updateRelativeTime(item, lastRelativeTime) {
  item.relativeTime = isTimelineItem(item) ? fromNow(item.timestamp) : void 0;
  item.relativeTimeFullWord = isTimelineItem(item) ? fromNow(item.timestamp, false, true) : void 0;
  if (lastRelativeTime === void 0 || item.relativeTime !== lastRelativeTime) {
    lastRelativeTime = item.relativeTime;
    item.hideRelativeTime = false;
  } else {
    item.hideRelativeTime = true;
  }
  return lastRelativeTime;
}
class TimelineAggregate {
  constructor(timeline) {
    this._stale = false;
    this._requiresReset = false;
    this.source = timeline.source;
    this.items = timeline.items;
    this._cursor = timeline.paging?.cursor;
    this.lastRenderedIndex = -1;
  }
  get cursor() {
    return this._cursor;
  }
  get more() {
    return this._cursor !== void 0;
  }
  get newest() {
    return this.items[0];
  }
  get oldest() {
    return this.items[this.items.length - 1];
  }
  add(timeline, options) {
    let updated = false;
    if (timeline.items.length !== 0 && this.items.length !== 0) {
      updated = true;
      const ids = /* @__PURE__ */ new Set();
      const timestamps = /* @__PURE__ */ new Set();
      for (const item2 of timeline.items) {
        if (item2.id === void 0) {
          timestamps.add(item2.timestamp);
        } else {
          ids.add(item2.id);
        }
      }
      let i = this.items.length;
      let item;
      while (i--) {
        item = this.items[i];
        if (item.id !== void 0 && ids.has(item.id) || timestamps.has(item.timestamp)) {
          this.items.splice(i, 1);
        }
      }
      if ((timeline.items[timeline.items.length - 1]?.timestamp ?? 0) >= (this.newest?.timestamp ?? 0)) {
        this.items.splice(0, 0, ...timeline.items);
      } else {
        this.items.push(...timeline.items);
      }
    } else if (timeline.items.length !== 0) {
      updated = true;
      this.items.push(...timeline.items);
    }
    if (options.cursor !== void 0 || typeof options.limit !== "object") {
      this._cursor = timeline.paging?.cursor;
    }
    if (updated) {
      this.items.sort(
        (a, b) => b.timestamp - a.timestamp || (a.source === void 0 ? b.source === void 0 ? 0 : 1 : b.source === void 0 ? -1 : b.source.localeCompare(a.source, void 0, { numeric: true, sensitivity: "base" }))
      );
    }
    return updated;
  }
  get stale() {
    return this._stale;
  }
  get requiresReset() {
    return this._requiresReset;
  }
  invalidate(requiresReset) {
    this._stale = true;
    this._requiresReset = requiresReset;
  }
}
class LoadMoreCommand {
  constructor(loading) {
    this.handle = "vscode-command:loadMore";
    this.timestamp = 0;
    this.description = void 0;
    this.tooltip = void 0;
    this.contextValue = void 0;
    // Make things easier for duck typing
    this.id = void 0;
    this.icon = void 0;
    this.iconDark = void 0;
    this.source = void 0;
    this.relativeTime = void 0;
    this.relativeTimeFullWord = void 0;
    this.hideRelativeTime = void 0;
    this._loading = false;
    this._loading = loading;
  }
  get loading() {
    return this._loading;
  }
  set loading(value) {
    this._loading = value;
  }
  get ariaLabel() {
    return this.label;
  }
  get label() {
    return this.loading ? localize("timeline.loadingMore", "Loading...") : localize("timeline.loadMore", "Load more");
  }
  get themeIcon() {
    return void 0;
  }
}
const TimelineFollowActiveEditorContext = new RawContextKey("timelineFollowActiveEditor", true, true);
const TimelineExcludeSources = new RawContextKey("timelineExcludeSources", "[]", true);
const TimelineViewFocusedContext = new RawContextKey("timelineFocused", true);
let TimelinePane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, contextKeyService, configurationService, storageService, viewDescriptorService, instantiationService, editorService, commandService, progressService, timelineService, openerService, themeService, hoverService, labelService, uriIdentityService, extensionService) {
    super({ ...options, titleMenuId: MenuId.TimelineTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.storageService = storageService;
    this.editorService = editorService;
    this.commandService = commandService;
    this.progressService = progressService;
    this.timelineService = timelineService;
    this.labelService = labelService;
    this.uriIdentityService = uriIdentityService;
    this.extensionService = extensionService;
    this.pendingRequests = /* @__PURE__ */ new Map();
    this.timelinesBySource = /* @__PURE__ */ new Map();
    this._followActiveEditor = true;
    this._isEmpty = true;
    this._maxItemCount = 0;
    this._visibleItemCount = 0;
    this._pendingRefresh = false;
    this.commands = this._register(this.instantiationService.createInstance(TimelinePaneCommands, this));
    this.followActiveEditorContext = TimelineFollowActiveEditorContext.bindTo(this.contextKeyService);
    this.timelineExcludeSourcesContext = TimelineExcludeSources.bindTo(this.contextKeyService);
    const excludedSourcesString = storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]");
    this.timelineExcludeSourcesContext.set(excludedSourcesString);
    this.excludedSources = new Set(JSON.parse(excludedSourcesString));
    this._register(storageService.onDidChangeValue(StorageScope.PROFILE, "timeline.excludeSources", this._store)(this.onStorageServiceChanged, this));
    this._register(configurationService.onDidChangeConfiguration(this.onConfigurationChanged, this));
    this._register(timelineService.onDidChangeProviders(this.onProvidersChanged, this));
    this._register(timelineService.onDidChangeTimeline(this.onTimelineChanged, this));
    this._register(timelineService.onDidChangeUri((uri) => this.setUri(uri), this));
  }
  get followActiveEditor() {
    return this._followActiveEditor;
  }
  set followActiveEditor(value) {
    if (this._followActiveEditor === value) {
      return;
    }
    this._followActiveEditor = value;
    this.followActiveEditorContext.set(value);
    this.updateFilename(this._filename);
    if (value) {
      this.onActiveEditorChanged();
    }
  }
  get pageOnScroll() {
    if (this._pageOnScroll === void 0) {
      this._pageOnScroll = this.configurationService.getValue("timeline.pageOnScroll") ?? false;
    }
    return this._pageOnScroll;
  }
  get pageSize() {
    let pageSize = this.configurationService.getValue("timeline.pageSize");
    if (pageSize === void 0 || pageSize === null) {
      pageSize = Math.max(20, Math.floor((this.tree?.renderHeight ?? 0 / ItemHeight) + (this.pageOnScroll ? 1 : -1)));
    }
    return pageSize;
  }
  reset() {
    this.loadTimeline(true);
  }
  setUri(uri) {
    this.setUriCore(uri, true);
  }
  setUriCore(uri, disableFollowing) {
    if (disableFollowing) {
      this.followActiveEditor = false;
    }
    this.uri = uri;
    this.updateFilename(uri ? this.labelService.getUriBasenameLabel(uri) : void 0);
    this.treeRenderer?.setUri(uri);
    this.loadTimeline(true);
  }
  onStorageServiceChanged() {
    const excludedSourcesString = this.storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]");
    this.timelineExcludeSourcesContext.set(excludedSourcesString);
    this.excludedSources = new Set(JSON.parse(excludedSourcesString));
    const missing = this.timelineService.getSources().filter(({ id }) => !this.excludedSources.has(id) && !this.timelinesBySource.has(id));
    if (missing.length !== 0) {
      this.loadTimeline(true, missing.map(({ id }) => id));
    } else {
      this.refresh();
    }
  }
  onConfigurationChanged(e) {
    if (e.affectsConfiguration("timeline.pageOnScroll")) {
      this._pageOnScroll = void 0;
    }
  }
  onActiveEditorChanged() {
    if (!this.followActiveEditor || !this.isExpanded()) {
      return;
    }
    const uri = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (this.uriIdentityService.extUri.isEqual(uri, this.uri) && uri !== void 0 || // Fallback to match on fsPath if we are dealing with files or git schemes
    uri?.fsPath === this.uri?.fsPath && (uri?.scheme === Schemas.file || uri?.scheme === "git") && (this.uri?.scheme === Schemas.file || this.uri?.scheme === "git")) {
      for (const source of this.timelineService.getSources()) {
        if (this.excludedSources.has(source.id)) {
          continue;
        }
        const timeline = this.timelinesBySource.get(source.id);
        if (timeline !== void 0 && !timeline.stale) {
          continue;
        }
        if (timeline !== void 0) {
          this.updateTimeline(timeline, timeline.requiresReset);
        } else {
          this.loadTimelineForSource(source.id, uri, true);
        }
      }
      return;
    }
    this.setUriCore(uri, false);
  }
  onProvidersChanged(e) {
    if (e.removed) {
      for (const source of e.removed) {
        this.timelinesBySource.delete(source);
      }
      this.refresh();
    }
    if (e.added) {
      this.loadTimeline(true, e.added);
    }
  }
  onTimelineChanged(e) {
    if (e?.uri === void 0 || this.uriIdentityService.extUri.isEqual(URI.revive(e.uri), this.uri)) {
      const timeline = this.timelinesBySource.get(e.id);
      if (timeline === void 0) {
        return;
      }
      if (this.isBodyVisible()) {
        this.updateTimeline(timeline, e.reset);
      } else {
        timeline.invalidate(e.reset);
      }
    }
  }
  updateFilename(filename) {
    this._filename = filename;
    if (this.followActiveEditor || !filename) {
      this.updateTitleDescription(filename);
    } else {
      this.updateTitleDescription(`${filename} (pinned)`);
    }
  }
  get message() {
    return this._message;
  }
  set message(message) {
    this._message = message;
    this.updateMessage();
  }
  updateMessage() {
    if (this._message !== void 0) {
      this.showMessage(this._message);
    } else {
      this.hideMessage();
    }
  }
  showMessage(message) {
    if (!this.$message) {
      return;
    }
    this.$message.classList.remove("hide");
    this.resetMessageElement();
    this.$message.textContent = message;
  }
  hideMessage() {
    this.resetMessageElement();
    this.$message.classList.add("hide");
  }
  resetMessageElement() {
    DOM.clearNode(this.$message);
  }
  get hasVisibleItems() {
    return this._visibleItemCount > 0;
  }
  clear(cancelPending) {
    this._visibleItemCount = 0;
    this._maxItemCount = this.pageSize;
    this.timelinesBySource.clear();
    if (cancelPending) {
      for (const pendingRequest of this.pendingRequests.values()) {
        pendingRequest.request.tokenSource.cancel();
        pendingRequest.dispose();
      }
      this.pendingRequests.clear();
      if (!this.isBodyVisible() && this.tree) {
        this.tree.setChildren(null, void 0);
        this._isEmpty = true;
      }
    }
  }
  async loadTimeline(reset, sources) {
    if (sources === void 0) {
      if (reset) {
        this.clear(true);
      }
      if (this.uri?.scheme === Schemas.vscodeSettings || this.uri?.scheme === Schemas.webviewPanel || this.uri?.scheme === Schemas.walkThrough) {
        this.uri = void 0;
        this.clear(false);
        this.refresh();
        return;
      }
      if (this._isEmpty && this.uri !== void 0) {
        this.setLoadingUriMessage();
      }
    }
    if (this.uri === void 0) {
      this.clear(false);
      this.refresh();
      return;
    }
    if (!this.isBodyVisible()) {
      return;
    }
    let hasPendingRequests = false;
    for (const source of sources ?? this.timelineService.getSources().map((s) => s.id)) {
      const requested = this.loadTimelineForSource(source, this.uri, reset);
      if (requested) {
        hasPendingRequests = true;
      }
    }
    if (!hasPendingRequests) {
      this.refresh();
    } else if (this._isEmpty) {
      this.setLoadingUriMessage();
    }
  }
  loadTimelineForSource(source, uri, reset, options) {
    if (this.excludedSources.has(source)) {
      return false;
    }
    const timeline = this.timelinesBySource.get(source);
    if (!reset && options?.cursor !== void 0 && timeline !== void 0 && (!timeline?.more || timeline.items.length > timeline.lastRenderedIndex + this.pageSize)) {
      return false;
    }
    if (options === void 0) {
      if (!reset && timeline !== void 0 && timeline.items.length > 0 && !timeline.more) {
        return false;
      }
      options = { cursor: reset ? void 0 : timeline?.cursor, limit: this.pageSize };
    }
    const pendingRequest = this.pendingRequests.get(source);
    if (pendingRequest !== void 0) {
      options.cursor = pendingRequest.request.options.cursor;
      if (typeof options.limit === "number") {
        if (typeof pendingRequest.request.options.limit === "number") {
          options.limit += pendingRequest.request.options.limit;
        } else {
          options.limit = pendingRequest.request.options.limit;
        }
      }
    }
    pendingRequest?.request?.tokenSource.cancel();
    pendingRequest?.dispose();
    options.cacheResults = true;
    options.resetCache = reset;
    const tokenSource = new CancellationTokenSource();
    const newRequest = this.timelineService.getTimeline(source, uri, options, tokenSource);
    if (newRequest === void 0) {
      tokenSource.dispose();
      return false;
    }
    const disposables = new DisposableStore();
    this.pendingRequests.set(source, { request: newRequest, dispose: () => disposables.dispose() });
    disposables.add(tokenSource);
    disposables.add(tokenSource.token.onCancellationRequested(() => this.pendingRequests.delete(source)));
    this.handleRequest(newRequest);
    return true;
  }
  updateTimeline(timeline, reset) {
    if (reset) {
      this.timelinesBySource.delete(timeline.source);
      const { oldest } = timeline;
      this.loadTimelineForSource(timeline.source, this.uri, true, oldest !== void 0 ? { limit: { timestamp: oldest.timestamp, id: oldest.id } } : void 0);
    } else {
      const { newest } = timeline;
      this.loadTimelineForSource(timeline.source, this.uri, false, newest !== void 0 ? { limit: { timestamp: newest.timestamp, id: newest.id } } : { limit: this.pageSize });
    }
  }
  async handleRequest(request) {
    let response;
    try {
      response = await this.progressService.withProgress({ location: this.id }, () => request.result);
    } finally {
      this.pendingRequests.get(request.source)?.dispose();
      this.pendingRequests.delete(request.source);
    }
    if (response === void 0 || request.tokenSource.token.isCancellationRequested || request.uri !== this.uri) {
      if (this.pendingRequests.size === 0 && this._pendingRefresh) {
        this.refresh();
      }
      return;
    }
    const source = request.source;
    let updated = false;
    const timeline = this.timelinesBySource.get(source);
    if (timeline === void 0) {
      this.timelinesBySource.set(source, new TimelineAggregate(response));
      updated = true;
    } else {
      updated = timeline.add(response, request.options);
    }
    if (updated) {
      this._pendingRefresh = true;
      if (this.hasVisibleItems && this.pendingRequests.size !== 0) {
        this.refreshDebounced();
      } else {
        this.refresh();
      }
    } else if (this.pendingRequests.size === 0) {
      if (this._pendingRefresh) {
        this.refresh();
      } else {
        this.tree.rerender();
      }
    }
  }
  *getItems() {
    let more = false;
    if (this.uri === void 0 || this.timelinesBySource.size === 0) {
      this._visibleItemCount = 0;
      return;
    }
    const maxCount = this._maxItemCount;
    let count = 0;
    if (this.timelinesBySource.size === 1) {
      const [source, timeline] = Iterable.first(this.timelinesBySource);
      timeline.lastRenderedIndex = -1;
      if (this.excludedSources.has(source)) {
        this._visibleItemCount = 0;
        return;
      }
      if (timeline.items.length !== 0) {
        this._visibleItemCount = 1;
      }
      more = timeline.more;
      let lastRelativeTime;
      for (const item of timeline.items) {
        item.relativeTime = void 0;
        item.hideRelativeTime = void 0;
        count++;
        if (count > maxCount) {
          more = true;
          break;
        }
        lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
        yield { element: item };
      }
      timeline.lastRenderedIndex = count - 1;
    } else {
      let getNextMostRecentSource2 = function() {
        return sources.filter((source) => !source.nextItem.done).reduce((previous, current) => previous === void 0 || current.nextItem.value.timestamp >= previous.nextItem.value.timestamp ? current : previous, void 0);
      };
      var getNextMostRecentSource = getNextMostRecentSource2;
      const sources = [];
      let hasAnyItems = false;
      let mostRecentEnd = 0;
      for (const [source, timeline] of this.timelinesBySource) {
        timeline.lastRenderedIndex = -1;
        if (this.excludedSources.has(source) || timeline.stale) {
          continue;
        }
        if (timeline.items.length !== 0) {
          hasAnyItems = true;
        }
        if (timeline.more) {
          more = true;
          const last = timeline.items[Math.min(maxCount, timeline.items.length - 1)];
          if (last.timestamp > mostRecentEnd) {
            mostRecentEnd = last.timestamp;
          }
        }
        const iterator = timeline.items[Symbol.iterator]();
        sources.push({ timeline, iterator, nextItem: iterator.next() });
      }
      this._visibleItemCount = hasAnyItems ? 1 : 0;
      let lastRelativeTime;
      let nextSource;
      while (nextSource = getNextMostRecentSource2()) {
        nextSource.timeline.lastRenderedIndex++;
        const item = nextSource.nextItem.value;
        item.relativeTime = void 0;
        item.hideRelativeTime = void 0;
        if (item.timestamp >= mostRecentEnd) {
          count++;
          if (count > maxCount) {
            more = true;
            break;
          }
          lastRelativeTime = updateRelativeTime(item, lastRelativeTime);
          yield { element: item };
        }
        nextSource.nextItem = nextSource.iterator.next();
      }
    }
    this._visibleItemCount = count;
    if (count > 0) {
      if (more) {
        yield {
          element: new LoadMoreCommand(this.pendingRequests.size !== 0)
        };
      } else if (this.pendingRequests.size !== 0) {
        yield {
          element: new LoadMoreCommand(true)
        };
      }
    }
  }
  refresh() {
    if (!this.isBodyVisible()) {
      return;
    }
    this.tree.setChildren(null, this.getItems());
    this._isEmpty = !this.hasVisibleItems;
    if (this.uri === void 0) {
      this.updateFilename(void 0);
      this.message = localize("timeline.editorCannotProvideTimeline", "The active editor cannot provide timeline information.");
    } else if (this._isEmpty) {
      if (this.pendingRequests.size !== 0) {
        this.setLoadingUriMessage();
      } else {
        this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
        const scmProviderCount = this.contextKeyService.getContextKeyValue("scm.providerCount");
        if (this.timelineService.getSources().filter(({ id }) => !this.excludedSources.has(id)).length === 0) {
          this.message = localize("timeline.noTimelineSourcesEnabled", "All timeline sources have been filtered out.");
        } else {
          if (this.configurationService.getValue("workbench.localHistory.enabled") && !this.excludedSources.has("timeline.localHistory")) {
            this.message = localize("timeline.noLocalHistoryYet", "Local History will track recent changes as you save them unless the file has been excluded or is too large.");
          } else if (this.excludedSources.size > 0) {
            this.message = localize("timeline.noTimelineInfoFromEnabledSources", "No filtered timeline information was provided.");
          } else {
            this.message = localize("timeline.noTimelineInfo", "No timeline information was provided.");
          }
        }
        if (!scmProviderCount || scmProviderCount === 0) {
          this.message += " " + localize("timeline.noSCM", "Source Control has not been configured.");
        }
      }
    } else {
      this.updateFilename(this.labelService.getUriBasenameLabel(this.uri));
      this.message = void 0;
    }
    this._pendingRefresh = false;
  }
  refreshDebounced() {
    this.refresh();
  }
  focus() {
    super.focus();
    this.tree.domFocus();
  }
  setExpanded(expanded) {
    const changed = super.setExpanded(expanded);
    if (changed && this.isBodyVisible()) {
      if (!this.followActiveEditor) {
        this.setUriCore(this.uri, true);
      } else {
        this.onActiveEditorChanged();
      }
    }
    return changed;
  }
  setVisible(visible) {
    if (visible) {
      this.extensionService.activateByEvent("onView:timeline");
      this.visibilityDisposables = new DisposableStore();
      this.editorService.onDidActiveEditorChange(this.onActiveEditorChanged, this, this.visibilityDisposables);
      this.onDidFocus(() => this.refreshDebounced(), this, this.visibilityDisposables);
      super.setVisible(visible);
      this.onActiveEditorChanged();
    } else {
      this.visibilityDisposables?.dispose();
      super.setVisible(visible);
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    container.classList.add("timeline-view");
  }
  renderBody(container) {
    super.renderBody(container);
    this.$container = container;
    container.classList.add("tree-explorer-viewlet-tree-view", "timeline-tree-view");
    this.$message = DOM.append(this.$container, DOM.$(".message"));
    this.$message.classList.add("timeline-subtle");
    this.message = localize("timeline.editorCannotProvideTimeline", "The active editor cannot provide timeline information.");
    this.$tree = document.createElement("div");
    this.$tree.classList.add("customview-tree", "file-icon-themable-tree", "hide-arrows");
    container.appendChild(this.$tree);
    this.treeRenderer = this.instantiationService.createInstance(TimelineTreeRenderer, this.commands);
    this._register(this.treeRenderer.onDidScrollToEnd((item) => {
      if (this.pageOnScroll) {
        this.loadMore(item);
      }
    }));
    this.tree = this.instantiationService.createInstance(
      WorkbenchObjectTree,
      "TimelinePane",
      this.$tree,
      new TimelineListVirtualDelegate(),
      [this.treeRenderer],
      {
        identityProvider: new TimelineIdentityProvider(),
        accessibilityProvider: {
          getAriaLabel(element) {
            if (isLoadMoreCommand(element)) {
              return element.ariaLabel;
            }
            return element.accessibilityInformation ? element.accessibilityInformation.label : localize("timeline.aria.item", "{0}: {1}", element.relativeTimeFullWord ?? "", element.label);
          },
          getRole(element) {
            if (isLoadMoreCommand(element)) {
              return "treeitem";
            }
            return element.accessibilityInformation && element.accessibilityInformation.role ? element.accessibilityInformation.role : "treeitem";
          },
          getWidgetAriaLabel() {
            return localize("timeline", "Timeline");
          }
        },
        keyboardNavigationLabelProvider: new TimelineKeyboardNavigationLabelProvider(),
        multipleSelectionSupport: false,
        overrideStyles: this.getLocationBasedColors().listOverrideStyles
      }
    );
    TimelineViewFocusedContext.bindTo(this.tree.contextKeyService);
    this._register(this.tree.onContextMenu((e) => this.onContextMenu(this.commands, e)));
    this._register(this.tree.onDidChangeSelection((e) => this.ensureValidItems()));
    this._register(this.tree.onDidOpen((e) => {
      if (!e.browserEvent || !this.ensureValidItems()) {
        return;
      }
      const selection = this.tree.getSelection();
      let item;
      if (selection.length === 1) {
        item = selection[0];
      }
      if (item === null) {
        return;
      }
      if (isTimelineItem(item)) {
        if (item.command) {
          let args = item.command.arguments ?? [];
          if (item.command.id === API_OPEN_EDITOR_COMMAND_ID || item.command.id === API_OPEN_DIFF_EDITOR_COMMAND_ID) {
            args = [...args, e];
          }
          this.commandService.executeCommand(item.command.id, ...args);
        }
      } else if (isLoadMoreCommand(item)) {
        this.loadMore(item);
      }
    }));
  }
  loadMore(item) {
    if (item.loading) {
      return;
    }
    item.loading = true;
    this.tree.rerender(item);
    if (this.pendingRequests.size !== 0) {
      return;
    }
    this._maxItemCount = this._visibleItemCount + this.pageSize;
    this.loadTimeline(false);
  }
  ensureValidItems() {
    if (!this.hasVisibleItems || !this.timelineService.getSources().some(({ id }) => !this.excludedSources.has(id) && this.timelinesBySource.has(id))) {
      this.tree.setChildren(null, void 0);
      this._isEmpty = true;
      this.setLoadingUriMessage();
      return false;
    }
    return true;
  }
  setLoadingUriMessage() {
    const file = this.uri && this.labelService.getUriBasenameLabel(this.uri);
    this.updateFilename(file);
    this.message = file ? localize("timeline.loading", "Loading timeline for {0}...", file) : "";
  }
  onContextMenu(commands, treeEvent) {
    const item = treeEvent.element;
    if (item === null) {
      return;
    }
    const event = treeEvent.browserEvent;
    event.preventDefault();
    event.stopPropagation();
    if (!this.ensureValidItems()) {
      return;
    }
    this.tree.setFocus([item]);
    const actions = commands.getItemContextActions(item);
    if (!actions.length) {
      return;
    }
    this.contextMenuService.showContextMenu({
      getAnchor: () => treeEvent.anchor,
      getActions: () => actions,
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.tree.domFocus();
        }
      },
      getActionsContext: () => ({ uri: this.uri, item }),
      actionRunner: new TimelineActionRunner()
    });
  }
};
TimelinePane.TITLE = localize2("timeline", "Timeline");
__decorateClass([
  debounce(500)
], TimelinePane.prototype, "refreshDebounced", 1);
TimelinePane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IViewDescriptorService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IProgressService),
  __decorateParam(11, ITimelineService),
  __decorateParam(12, IOpenerService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ILabelService),
  __decorateParam(16, IUriIdentityService),
  __decorateParam(17, IExtensionService)
], TimelinePane);
class TimelineElementTemplate {
  constructor(container, actionViewItemProvider, hoverDelegate) {
    container.classList.add("custom-view-tree-node-item");
    this.icon = DOM.append(container, DOM.$(".custom-view-tree-node-item-icon"));
    this.iconLabel = new IconLabel(container, { supportHighlights: true, supportIcons: true, hoverDelegate });
    const timestampContainer = DOM.append(this.iconLabel.element, DOM.$(".timeline-timestamp-container"));
    this.timestamp = DOM.append(timestampContainer, DOM.$("span.timeline-timestamp"));
    const actionsContainer = DOM.append(this.iconLabel.element, DOM.$(".actions"));
    this.actionBar = new ActionBar(actionsContainer, { actionViewItemProvider });
  }
  dispose() {
    this.iconLabel.dispose();
    this.actionBar.dispose();
  }
  reset() {
    this.icon.className = "";
    this.icon.style.backgroundImage = "";
    this.actionBar.clear();
  }
}
TimelineElementTemplate.id = "TimelineElementTemplate";
class TimelineIdentityProvider {
  getId(item) {
    return item.handle;
  }
}
class TimelineActionRunner extends ActionRunner {
  async runAction(action, { uri, item }) {
    if (!isTimelineItem(item)) {
      await action.run();
      return;
    }
    await action.run(
      {
        $mid: MarshalledId.TimelineActionContext,
        handle: item.handle,
        source: item.source,
        uri
      },
      uri,
      item.source
    );
  }
}
class TimelineKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element.label;
  }
}
class TimelineListVirtualDelegate {
  getHeight(_element) {
    return ItemHeight;
  }
  getTemplateId(element) {
    return TimelineElementTemplate.id;
  }
}
let TimelineTreeRenderer = class {
  constructor(commands, instantiationService, themeService) {
    this.commands = commands;
    this.instantiationService = instantiationService;
    this.themeService = themeService;
    this._onDidScrollToEnd = new Emitter();
    this.onDidScrollToEnd = this._onDidScrollToEnd.event;
    this.templateId = TimelineElementTemplate.id;
    this.actionViewItemProvider = createActionViewItem.bind(void 0, this.instantiationService);
    this._hoverDelegate = this.instantiationService.createInstance(WorkbenchHoverDelegate, "element", { instantHover: true }, {
      position: {
        hoverPosition: HoverPosition.RIGHT
        // Will flip when there's no space
      }
    });
  }
  setUri(uri) {
    this.uri = uri;
  }
  renderTemplate(container) {
    return new TimelineElementTemplate(container, this.actionViewItemProvider, this._hoverDelegate);
  }
  renderElement(node, index, template, height) {
    template.reset();
    const { element: item } = node;
    const theme = this.themeService.getColorTheme();
    const icon = theme.type === ColorScheme.LIGHT ? item.icon : item.iconDark;
    const iconUrl = icon ? URI.revive(icon) : null;
    if (iconUrl) {
      template.icon.className = "custom-view-tree-node-item-icon";
      template.icon.style.backgroundImage = css.asCSSUrl(iconUrl);
      template.icon.style.color = "";
    } else if (item.themeIcon) {
      template.icon.className = `custom-view-tree-node-item-icon ${ThemeIcon.asClassName(item.themeIcon)}`;
      if (item.themeIcon.color) {
        template.icon.style.color = theme.getColor(item.themeIcon.color.id)?.toString() ?? "";
      } else {
        template.icon.style.color = "";
      }
      template.icon.style.backgroundImage = "";
    } else {
      template.icon.className = "custom-view-tree-node-item-icon";
      template.icon.style.backgroundImage = "";
      template.icon.style.color = "";
    }
    const tooltip = item.tooltip ? isString(item.tooltip) ? item.tooltip : { markdown: item.tooltip, markdownNotSupportedFallback: renderMarkdownAsPlaintext(item.tooltip) } : void 0;
    template.iconLabel.setLabel(item.label, item.description, {
      title: tooltip,
      matches: createMatches(node.filterData)
    });
    template.timestamp.textContent = item.relativeTime ?? "";
    template.timestamp.ariaLabel = item.relativeTimeFullWord ?? "";
    template.timestamp.parentElement.classList.toggle("timeline-timestamp--duplicate", isTimelineItem(item) && item.hideRelativeTime);
    template.actionBar.context = { uri: this.uri, item };
    template.actionBar.actionRunner = new TimelineActionRunner();
    template.actionBar.push(this.commands.getItemActions(item), { icon: true, label: false });
    if (isLoadMoreCommand(item)) {
      setTimeout(() => this._onDidScrollToEnd.fire(item), 0);
    }
  }
  disposeElement(element, index, templateData, height) {
    templateData.actionBar.actionRunner.dispose();
  }
  disposeTemplate(template) {
    template.dispose();
  }
};
TimelineTreeRenderer = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IThemeService)
], TimelineTreeRenderer);
const timelineRefresh = registerIcon("timeline-refresh", Codicon.refresh, localize("timelineRefresh", "Icon for the refresh timeline action."));
const timelinePin = registerIcon("timeline-pin", Codicon.pin, localize("timelinePin", "Icon for the pin timeline action."));
const timelineUnpin = registerIcon("timeline-unpin", Codicon.pinned, localize("timelineUnpin", "Icon for the unpin timeline action."));
let TimelinePaneCommands = class extends Disposable {
  constructor(pane, timelineService, storageService, contextKeyService, menuService) {
    super();
    this.pane = pane;
    this.timelineService = timelineService;
    this.storageService = storageService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this._register(this.sourceDisposables = new DisposableStore());
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "timeline.refresh",
          title: localize2("refresh", "Refresh"),
          icon: timelineRefresh,
          category: localize2("timeline", "Timeline"),
          menu: {
            id: MenuId.TimelineTitle,
            group: "navigation",
            order: 99
          }
        });
      }
      run(accessor, ...args) {
        pane.reset();
      }
    }));
    this._register(CommandsRegistry.registerCommand(
      "timeline.toggleFollowActiveEditor",
      (accessor, ...args) => pane.followActiveEditor = !pane.followActiveEditor
    ));
    this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
      command: {
        id: "timeline.toggleFollowActiveEditor",
        title: localize2("timeline.toggleFollowActiveEditorCommand.follow", "Pin the Current Timeline"),
        icon: timelinePin,
        category: localize2("timeline", "Timeline")
      },
      group: "navigation",
      order: 98,
      when: TimelineFollowActiveEditorContext
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.TimelineTitle, {
      command: {
        id: "timeline.toggleFollowActiveEditor",
        title: localize2("timeline.toggleFollowActiveEditorCommand.unfollow", "Unpin the Current Timeline"),
        icon: timelineUnpin,
        category: localize2("timeline", "Timeline")
      },
      group: "navigation",
      order: 98,
      when: TimelineFollowActiveEditorContext.toNegated()
    }));
    this._register(timelineService.onDidChangeProviders(() => this.updateTimelineSourceFilters()));
    this.updateTimelineSourceFilters();
  }
  getItemActions(element) {
    return this.getActions(MenuId.TimelineItemContext, { key: "timelineItem", value: element.contextValue }).primary;
  }
  getItemContextActions(element) {
    return this.getActions(MenuId.TimelineItemContext, { key: "timelineItem", value: element.contextValue }).secondary;
  }
  getActions(menuId, context) {
    const contextKeyService = this.contextKeyService.createOverlay([
      ["view", this.pane.id],
      [context.key, context.value]
    ]);
    const menu = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
    return getContextMenuActions(menu, "inline");
  }
  updateTimelineSourceFilters() {
    this.sourceDisposables.clear();
    const excluded = new Set(JSON.parse(this.storageService.get("timeline.excludeSources", StorageScope.PROFILE, "[]")));
    for (const source of this.timelineService.getSources()) {
      this.sourceDisposables.add(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `timeline.toggleExcludeSource:${source.id}`,
            title: source.label,
            menu: {
              id: MenuId.TimelineFilterSubMenu,
              group: "navigation"
            },
            toggled: ContextKeyExpr.regex(`timelineExcludeSources`, new RegExp(`\\b${escapeRegExpCharacters(source.id)}\\b`)).negate()
          });
        }
        run(accessor, ...args) {
          if (excluded.has(source.id)) {
            excluded.delete(source.id);
          } else {
            excluded.add(source.id);
          }
          const storageService = accessor.get(IStorageService);
          storageService.store("timeline.excludeSources", JSON.stringify([...excluded.keys()]), StorageScope.PROFILE, StorageTarget.USER);
        }
      }));
    }
  }
};
TimelinePaneCommands = __decorateClass([
  __decorateParam(1, ITimelineService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IMenuService)
], TimelinePaneCommands);
export {
  TimelineExcludeSources,
  TimelineFollowActiveEditorContext,
  TimelineIdentityProvider,
  TimelineKeyboardNavigationLabelProvider,
  TimelineListVirtualDelegate,
  TimelinePane,
  TimelineViewFocusedContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90aW1lbGluZS9icm93c2VyL3RpbWVsaW5lUGFuZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS90aW1lbGluZVBhbmUuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICogYXMgY3NzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jc3NWYWx1ZS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBBY3Rpb25SdW5uZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGZyb21Ob3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRlLmpzJztcbmltcG9ydCB7IGRlYm91bmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUsIGNyZWF0ZU1hdGNoZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJY29uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgSUlkZW50aXR5UHJvdmlkZXIsIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIsIElUcmVlQ29udGV4dE1lbnVFdmVudCwgSVRyZWVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSwgSVZpZXdQYW5lT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoT2JqZWN0VHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXksIElDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UsIElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVRpbWVsaW5lU2VydmljZSwgVGltZWxpbmVDaGFuZ2VFdmVudCwgVGltZWxpbmVJdGVtLCBUaW1lbGluZU9wdGlvbnMsIFRpbWVsaW5lUHJvdmlkZXJzQ2hhbmdlRXZlbnQsIFRpbWVsaW5lUmVxdWVzdCwgVGltZWxpbmUgfSBmcm9tICcuLi9jb21tb24vdGltZWxpbmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvciwgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlLCBDb21tYW5kc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIsIElBY3Rpb25WaWV3SXRlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgZ2V0Q29udGV4dE1lbnVBY3Rpb25zLCBjcmVhdGVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJTWVudVNlcnZpY2UsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQVBJX09QRU5fRElGRl9FRElUT1JfQ09NTUFORF9JRCwgQVBJX09QRU5fRURJVE9SX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duQXNQbGFpbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBBcmlhUm9sZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UsIFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IEhvdmVyUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJXaWRnZXQuanMnO1xuXG5jb25zdCBJdGVtSGVpZ2h0ID0gMjI7XG5cbnR5cGUgVHJlZUVsZW1lbnQgPSBUaW1lbGluZUl0ZW0gfCBMb2FkTW9yZUNvbW1hbmQ7XG5cbmZ1bmN0aW9uIGlzTG9hZE1vcmVDb21tYW5kKGl0ZW06IFRyZWVFbGVtZW50IHwgdW5kZWZpbmVkKTogaXRlbSBpcyBMb2FkTW9yZUNvbW1hbmQge1xuXHRyZXR1cm4gaXRlbSBpbnN0YW5jZW9mIExvYWRNb3JlQ29tbWFuZDtcbn1cblxuZnVuY3Rpb24gaXNUaW1lbGluZUl0ZW0oaXRlbTogVHJlZUVsZW1lbnQgfCB1bmRlZmluZWQpOiBpdGVtIGlzIFRpbWVsaW5lSXRlbSB7XG5cdHJldHVybiAhIWl0ZW0gJiYgIWl0ZW0uaGFuZGxlLnN0YXJ0c1dpdGgoJ3ZzY29kZS1jb21tYW5kOicpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVSZWxhdGl2ZVRpbWUoaXRlbTogVGltZWxpbmVJdGVtLCBsYXN0UmVsYXRpdmVUaW1lOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRpdGVtLnJlbGF0aXZlVGltZSA9IGlzVGltZWxpbmVJdGVtKGl0ZW0pID8gZnJvbU5vdyhpdGVtLnRpbWVzdGFtcCkgOiB1bmRlZmluZWQ7XG5cdGl0ZW0ucmVsYXRpdmVUaW1lRnVsbFdvcmQgPSBpc1RpbWVsaW5lSXRlbShpdGVtKSA/IGZyb21Ob3coaXRlbS50aW1lc3RhbXAsIGZhbHNlLCB0cnVlKSA6IHVuZGVmaW5lZDtcblx0aWYgKGxhc3RSZWxhdGl2ZVRpbWUgPT09IHVuZGVmaW5lZCB8fCBpdGVtLnJlbGF0aXZlVGltZSAhPT0gbGFzdFJlbGF0aXZlVGltZSkge1xuXHRcdGxhc3RSZWxhdGl2ZVRpbWUgPSBpdGVtLnJlbGF0aXZlVGltZTtcblx0XHRpdGVtLmhpZGVSZWxhdGl2ZVRpbWUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRpdGVtLmhpZGVSZWxhdGl2ZVRpbWUgPSB0cnVlO1xuXHR9XG5cblx0cmV0dXJuIGxhc3RSZWxhdGl2ZVRpbWU7XG59XG5cbmludGVyZmFjZSBUaW1lbGluZUFjdGlvbkNvbnRleHQge1xuXHR1cmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0aXRlbTogVHJlZUVsZW1lbnQ7XG59XG5cbmNsYXNzIFRpbWVsaW5lQWdncmVnYXRlIHtcblx0cmVhZG9ubHkgaXRlbXM6IFRpbWVsaW5lSXRlbVtdO1xuXHRyZWFkb25seSBzb3VyY2U6IHN0cmluZztcblxuXHRsYXN0UmVuZGVyZWRJbmRleDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHRpbWVsaW5lOiBUaW1lbGluZSkge1xuXHRcdHRoaXMuc291cmNlID0gdGltZWxpbmUuc291cmNlO1xuXHRcdHRoaXMuaXRlbXMgPSB0aW1lbGluZS5pdGVtcztcblx0XHR0aGlzLl9jdXJzb3IgPSB0aW1lbGluZS5wYWdpbmc/LmN1cnNvcjtcblx0XHR0aGlzLmxhc3RSZW5kZXJlZEluZGV4ID0gLTE7XG5cdH1cblxuXHRwcml2YXRlIF9jdXJzb3I/OiBzdHJpbmc7XG5cdGdldCBjdXJzb3IoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY3Vyc29yO1xuXHR9XG5cblx0Z2V0IG1vcmUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1cnNvciAhPT0gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0IG5ld2VzdCgpOiBUaW1lbGluZUl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zWzBdO1xuXHR9XG5cblx0Z2V0IG9sZGVzdCgpOiBUaW1lbGluZUl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLml0ZW1zW3RoaXMuaXRlbXMubGVuZ3RoIC0gMV07XG5cdH1cblxuXHRhZGQodGltZWxpbmU6IFRpbWVsaW5lLCBvcHRpb25zOiBUaW1lbGluZU9wdGlvbnMpIHtcblx0XHRsZXQgdXBkYXRlZCA9IGZhbHNlO1xuXG5cdFx0aWYgKHRpbWVsaW5lLml0ZW1zLmxlbmd0aCAhPT0gMCAmJiB0aGlzLml0ZW1zLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0dXBkYXRlZCA9IHRydWU7XG5cblx0XHRcdGNvbnN0IGlkcyA9IG5ldyBTZXQoKTtcblx0XHRcdGNvbnN0IHRpbWVzdGFtcHMgPSBuZXcgU2V0KCk7XG5cblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aW1lbGluZS5pdGVtcykge1xuXHRcdFx0XHRpZiAoaXRlbS5pZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGltZXN0YW1wcy5hZGQoaXRlbS50aW1lc3RhbXApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGlkcy5hZGQoaXRlbS5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVtb3ZlIGFueSBkdXBsaWNhdGUgaXRlbXNcblx0XHRcdGxldCBpID0gdGhpcy5pdGVtcy5sZW5ndGg7XG5cdFx0XHRsZXQgaXRlbTtcblx0XHRcdHdoaWxlIChpLS0pIHtcblx0XHRcdFx0aXRlbSA9IHRoaXMuaXRlbXNbaV07XG5cdFx0XHRcdGlmICgoaXRlbS5pZCAhPT0gdW5kZWZpbmVkICYmIGlkcy5oYXMoaXRlbS5pZCkpIHx8IHRpbWVzdGFtcHMuaGFzKGl0ZW0udGltZXN0YW1wKSkge1xuXHRcdFx0XHRcdHRoaXMuaXRlbXMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICgodGltZWxpbmUuaXRlbXNbdGltZWxpbmUuaXRlbXMubGVuZ3RoIC0gMV0/LnRpbWVzdGFtcCA/PyAwKSA+PSAodGhpcy5uZXdlc3Q/LnRpbWVzdGFtcCA/PyAwKSkge1xuXHRcdFx0XHR0aGlzLml0ZW1zLnNwbGljZSgwLCAwLCAuLi50aW1lbGluZS5pdGVtcyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLml0ZW1zLnB1c2goLi4udGltZWxpbmUuaXRlbXMpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGltZWxpbmUuaXRlbXMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHR1cGRhdGVkID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy5pdGVtcy5wdXNoKC4uLnRpbWVsaW5lLml0ZW1zKTtcblx0XHR9XG5cblx0XHQvLyBJZiB3ZSBhcmUgbm90IHJlcXVlc3RpbmcgbW9yZSByZWNlbnQgaXRlbXMgdGhhbiB3ZSBoYXZlLCB0aGVuIHVwZGF0ZSB0aGUgY3Vyc29yXG5cdFx0aWYgKG9wdGlvbnMuY3Vyc29yICE9PSB1bmRlZmluZWQgfHwgdHlwZW9mIG9wdGlvbnMubGltaXQgIT09ICdvYmplY3QnKSB7XG5cdFx0XHR0aGlzLl9jdXJzb3IgPSB0aW1lbGluZS5wYWdpbmc/LmN1cnNvcjtcblx0XHR9XG5cblx0XHRpZiAodXBkYXRlZCkge1xuXHRcdFx0dGhpcy5pdGVtcy5zb3J0KFxuXHRcdFx0XHQoYSwgYikgPT5cblx0XHRcdFx0XHQoYi50aW1lc3RhbXAgLSBhLnRpbWVzdGFtcCkgfHxcblx0XHRcdFx0XHQoYS5zb3VyY2UgPT09IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0PyBiLnNvdXJjZSA9PT0gdW5kZWZpbmVkID8gMCA6IDFcblx0XHRcdFx0XHRcdDogYi5zb3VyY2UgPT09IHVuZGVmaW5lZCA/IC0xIDogYi5zb3VyY2UubG9jYWxlQ29tcGFyZShhLnNvdXJjZSwgdW5kZWZpbmVkLCB7IG51bWVyaWM6IHRydWUsIHNlbnNpdGl2aXR5OiAnYmFzZScgfSkpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB1cGRhdGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhbGUgPSBmYWxzZTtcblx0Z2V0IHN0YWxlKCkge1xuXHRcdHJldHVybiB0aGlzLl9zdGFsZTtcblx0fVxuXG5cdHByaXZhdGUgX3JlcXVpcmVzUmVzZXQgPSBmYWxzZTtcblx0Z2V0IHJlcXVpcmVzUmVzZXQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlcXVpcmVzUmVzZXQ7XG5cdH1cblxuXHRpbnZhbGlkYXRlKHJlcXVpcmVzUmVzZXQ6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9zdGFsZSA9IHRydWU7XG5cdFx0dGhpcy5fcmVxdWlyZXNSZXNldCA9IHJlcXVpcmVzUmVzZXQ7XG5cdH1cbn1cblxuY2xhc3MgTG9hZE1vcmVDb21tYW5kIHtcblx0cmVhZG9ubHkgaGFuZGxlID0gJ3ZzY29kZS1jb21tYW5kOmxvYWRNb3JlJztcblx0cmVhZG9ubHkgdGltZXN0YW1wID0gMDtcblx0cmVhZG9ubHkgZGVzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHRvb2x0aXAgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNvbnRleHRWYWx1ZSA9IHVuZGVmaW5lZDtcblx0Ly8gTWFrZSB0aGluZ3MgZWFzaWVyIGZvciBkdWNrIHR5cGluZ1xuXHRyZWFkb25seSBpZCA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaWNvbiA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaWNvbkRhcmsgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHNvdXJjZSA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcmVsYXRpdmVUaW1lID0gdW5kZWZpbmVkO1xuXHRyZWFkb25seSByZWxhdGl2ZVRpbWVGdWxsV29yZCA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgaGlkZVJlbGF0aXZlVGltZSA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihsb2FkaW5nOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fbG9hZGluZyA9IGxvYWRpbmc7XG5cdH1cblx0cHJpdmF0ZSBfbG9hZGluZzogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgbG9hZGluZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fbG9hZGluZztcblx0fVxuXHRzZXQgbG9hZGluZyh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX2xvYWRpbmcgPSB2YWx1ZTtcblx0fVxuXG5cdGdldCBhcmlhTGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMubGFiZWw7XG5cdH1cblxuXHRnZXQgbGFiZWwoKSB7XG5cdFx0cmV0dXJuIHRoaXMubG9hZGluZyA/IGxvY2FsaXplKCd0aW1lbGluZS5sb2FkaW5nTW9yZScsIFwiTG9hZGluZy4uLlwiKSA6IGxvY2FsaXplKCd0aW1lbGluZS5sb2FkTW9yZScsIFwiTG9hZCBtb3JlXCIpO1xuXHR9XG5cblx0Z2V0IHRoZW1lSWNvbigpOiBUaGVtZUljb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFRpbWVsaW5lRm9sbG93QWN0aXZlRWRpdG9yQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0aW1lbGluZUZvbGxvd0FjdGl2ZUVkaXRvcicsIHRydWUsIHRydWUpO1xuZXhwb3J0IGNvbnN0IFRpbWVsaW5lRXhjbHVkZVNvdXJjZXMgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCd0aW1lbGluZUV4Y2x1ZGVTb3VyY2VzJywgJ1tdJywgdHJ1ZSk7XG5leHBvcnQgY29uc3QgVGltZWxpbmVWaWV3Rm9jdXNlZENvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigndGltZWxpbmVGb2N1c2VkJywgdHJ1ZSk7XG5cbmludGVyZmFjZSBJUGVuZGluZ1JlcXVlc3QgZXh0ZW5kcyBJRGlzcG9zYWJsZSB7XG5cdHJlYWRvbmx5IHJlcXVlc3Q6IFRpbWVsaW5lUmVxdWVzdDtcbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVsaW5lUGFuZSBleHRlbmRzIFZpZXdQYW5lIHtcblx0c3RhdGljIHJlYWRvbmx5IFRJVExFOiBJTG9jYWxpemVkU3RyaW5nID0gbG9jYWxpemUyKCd0aW1lbGluZScsIFwiVGltZWxpbmVcIik7XG5cblx0cHJpdmF0ZSAkY29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgJG1lc3NhZ2UhOiBIVE1MRGl2RWxlbWVudDtcblx0cHJpdmF0ZSAkdHJlZSE6IEhUTUxEaXZFbGVtZW50O1xuXHRwcml2YXRlIHRyZWUhOiBXb3JrYmVuY2hPYmplY3RUcmVlPFRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPjtcblx0cHJpdmF0ZSB0cmVlUmVuZGVyZXI6IFRpbWVsaW5lVHJlZVJlbmRlcmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbW1hbmRzOiBUaW1lbGluZVBhbmVDb21tYW5kcztcblx0cHJpdmF0ZSB2aXNpYmlsaXR5RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGZvbGxvd0FjdGl2ZUVkaXRvckNvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHRpbWVsaW5lRXhjbHVkZVNvdXJjZXNDb250ZXh0OiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXG5cdHByaXZhdGUgZXhjbHVkZWRTb3VyY2VzOiBTZXQ8c3RyaW5nPjtcblx0cHJpdmF0ZSBwZW5kaW5nUmVxdWVzdHMgPSBuZXcgTWFwPHN0cmluZywgSVBlbmRpbmdSZXF1ZXN0PigpO1xuXHRwcml2YXRlIHRpbWVsaW5lc0J5U291cmNlID0gbmV3IE1hcDxzdHJpbmcsIFRpbWVsaW5lQWdncmVnYXRlPigpO1xuXG5cdHByaXZhdGUgdXJpOiBVUkkgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJvdGVjdGVkIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJvdGVjdGVkIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElUaW1lbGluZVNlcnZpY2UgcHJvdGVjdGVkIHRpbWVsaW5lU2VydmljZTogSVRpbWVsaW5lU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoeyAuLi5vcHRpb25zLCB0aXRsZU1lbnVJZDogTWVudUlkLlRpbWVsaW5lVGl0bGUgfSwga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cblx0XHR0aGlzLmNvbW1hbmRzID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUaW1lbGluZVBhbmVDb21tYW5kcywgdGhpcykpO1xuXG5cdFx0dGhpcy5mb2xsb3dBY3RpdmVFZGl0b3JDb250ZXh0ID0gVGltZWxpbmVGb2xsb3dBY3RpdmVFZGl0b3JDb250ZXh0LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnRpbWVsaW5lRXhjbHVkZVNvdXJjZXNDb250ZXh0ID0gVGltZWxpbmVFeGNsdWRlU291cmNlcy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCBleGNsdWRlZFNvdXJjZXNTdHJpbmcgPSBzdG9yYWdlU2VydmljZS5nZXQoJ3RpbWVsaW5lLmV4Y2x1ZGVTb3VyY2VzJywgU3RvcmFnZVNjb3BlLlBST0ZJTEUsICdbXScpO1xuXHRcdHRoaXMudGltZWxpbmVFeGNsdWRlU291cmNlc0NvbnRleHQuc2V0KGV4Y2x1ZGVkU291cmNlc1N0cmluZyk7XG5cdFx0dGhpcy5leGNsdWRlZFNvdXJjZXMgPSBuZXcgU2V0KEpTT04ucGFyc2UoZXhjbHVkZWRTb3VyY2VzU3RyaW5nKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihzdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAndGltZWxpbmUuZXhjbHVkZVNvdXJjZXMnLCB0aGlzLl9zdG9yZSkodGhpcy5vblN0b3JhZ2VTZXJ2aWNlQ2hhbmdlZCwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbih0aGlzLm9uQ29uZmlndXJhdGlvbkNoYW5nZWQsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aW1lbGluZVNlcnZpY2Uub25EaWRDaGFuZ2VQcm92aWRlcnModGhpcy5vblByb3ZpZGVyc0NoYW5nZWQsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aW1lbGluZVNlcnZpY2Uub25EaWRDaGFuZ2VUaW1lbGluZSh0aGlzLm9uVGltZWxpbmVDaGFuZ2VkLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGltZWxpbmVTZXJ2aWNlLm9uRGlkQ2hhbmdlVXJpKHVyaSA9PiB0aGlzLnNldFVyaSh1cmkpLCB0aGlzKSk7XG5cdH1cblxuXHRwcml2YXRlIF9mb2xsb3dBY3RpdmVFZGl0b3I6IGJvb2xlYW4gPSB0cnVlO1xuXHRnZXQgZm9sbG93QWN0aXZlRWRpdG9yKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9mb2xsb3dBY3RpdmVFZGl0b3I7XG5cdH1cblx0c2V0IGZvbGxvd0FjdGl2ZUVkaXRvcih2YWx1ZTogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9mb2xsb3dBY3RpdmVFZGl0b3IgPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZm9sbG93QWN0aXZlRWRpdG9yID0gdmFsdWU7XG5cdFx0dGhpcy5mb2xsb3dBY3RpdmVFZGl0b3JDb250ZXh0LnNldCh2YWx1ZSk7XG5cblx0XHR0aGlzLnVwZGF0ZUZpbGVuYW1lKHRoaXMuX2ZpbGVuYW1lKTtcblxuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0dGhpcy5vbkFjdGl2ZUVkaXRvckNoYW5nZWQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9wYWdlT25TY3JvbGw6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdGdldCBwYWdlT25TY3JvbGwoKSB7XG5cdFx0aWYgKHRoaXMuX3BhZ2VPblNjcm9sbCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9wYWdlT25TY3JvbGwgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4gfCBudWxsIHwgdW5kZWZpbmVkPigndGltZWxpbmUucGFnZU9uU2Nyb2xsJykgPz8gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3BhZ2VPblNjcm9sbDtcblx0fVxuXG5cdGdldCBwYWdlU2l6ZSgpIHtcblx0XHRsZXQgcGFnZVNpemUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQ+KCd0aW1lbGluZS5wYWdlU2l6ZScpO1xuXHRcdGlmIChwYWdlU2l6ZSA9PT0gdW5kZWZpbmVkIHx8IHBhZ2VTaXplID09PSBudWxsKSB7XG5cdFx0XHQvLyBJZiB3ZSBhcmUgcGFnaW5nIHdoZW4gc2Nyb2xsaW5nLCB0aGVuIGFkZCBhbiBleHRyYSBpdGVtIHRvIHRoZSBlbmQgdG8gbWFrZSBzdXJlIHRoZSBcIkxvYWQgbW9yZVwiIGl0ZW0gaXMgb3V0IG9mIHZpZXdcblx0XHRcdHBhZ2VTaXplID0gTWF0aC5tYXgoMjAsIE1hdGguZmxvb3IoKHRoaXMudHJlZT8ucmVuZGVySGVpZ2h0ID8/IDAgLyBJdGVtSGVpZ2h0KSArICh0aGlzLnBhZ2VPblNjcm9sbCA/IDEgOiAtMSkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHBhZ2VTaXplO1xuXHR9XG5cblx0cmVzZXQoKSB7XG5cdFx0dGhpcy5sb2FkVGltZWxpbmUodHJ1ZSk7XG5cdH1cblxuXHRzZXRVcmkodXJpOiBVUkkpIHtcblx0XHR0aGlzLnNldFVyaUNvcmUodXJpLCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0VXJpQ29yZSh1cmk6IFVSSSB8IHVuZGVmaW5lZCwgZGlzYWJsZUZvbGxvd2luZzogYm9vbGVhbikge1xuXHRcdGlmIChkaXNhYmxlRm9sbG93aW5nKSB7XG5cdFx0XHR0aGlzLmZvbGxvd0FjdGl2ZUVkaXRvciA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMudXJpID0gdXJpO1xuXHRcdHRoaXMudXBkYXRlRmlsZW5hbWUodXJpID8gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkpIDogdW5kZWZpbmVkKTtcblx0XHR0aGlzLnRyZWVSZW5kZXJlcj8uc2V0VXJpKHVyaSk7XG5cdFx0dGhpcy5sb2FkVGltZWxpbmUodHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uU3RvcmFnZVNlcnZpY2VDaGFuZ2VkKCkge1xuXHRcdGNvbnN0IGV4Y2x1ZGVkU291cmNlc1N0cmluZyA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KCd0aW1lbGluZS5leGNsdWRlU291cmNlcycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnW10nKTtcblx0XHR0aGlzLnRpbWVsaW5lRXhjbHVkZVNvdXJjZXNDb250ZXh0LnNldChleGNsdWRlZFNvdXJjZXNTdHJpbmcpO1xuXHRcdHRoaXMuZXhjbHVkZWRTb3VyY2VzID0gbmV3IFNldChKU09OLnBhcnNlKGV4Y2x1ZGVkU291cmNlc1N0cmluZykpO1xuXG5cdFx0Y29uc3QgbWlzc2luZyA9IHRoaXMudGltZWxpbmVTZXJ2aWNlLmdldFNvdXJjZXMoKVxuXHRcdFx0LmZpbHRlcigoeyBpZCB9KSA9PiAhdGhpcy5leGNsdWRlZFNvdXJjZXMuaGFzKGlkKSAmJiAhdGhpcy50aW1lbGluZXNCeVNvdXJjZS5oYXMoaWQpKTtcblx0XHRpZiAobWlzc2luZy5sZW5ndGggIT09IDApIHtcblx0XHRcdHRoaXMubG9hZFRpbWVsaW5lKHRydWUsIG1pc3NpbmcubWFwKCh7IGlkIH0pID0+IGlkKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Db25maWd1cmF0aW9uQ2hhbmdlZChlOiBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KSB7XG5cdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3RpbWVsaW5lLnBhZ2VPblNjcm9sbCcpKSB7XG5cdFx0XHR0aGlzLl9wYWdlT25TY3JvbGwgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvbkFjdGl2ZUVkaXRvckNoYW5nZWQoKSB7XG5cdFx0aWYgKCF0aGlzLmZvbGxvd0FjdGl2ZUVkaXRvciB8fCAhdGhpcy5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB1cmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuUFJJTUFSWSB9KTtcblxuXHRcdGlmICgodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodXJpLCB0aGlzLnVyaSkgJiYgdXJpICE9PSB1bmRlZmluZWQpIHx8XG5cdFx0XHQvLyBGYWxsYmFjayB0byBtYXRjaCBvbiBmc1BhdGggaWYgd2UgYXJlIGRlYWxpbmcgd2l0aCBmaWxlcyBvciBnaXQgc2NoZW1lc1xuXHRcdFx0KHVyaT8uZnNQYXRoID09PSB0aGlzLnVyaT8uZnNQYXRoICYmICh1cmk/LnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlIHx8IHVyaT8uc2NoZW1lID09PSAnZ2l0JykgJiYgKHRoaXMudXJpPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSB8fCB0aGlzLnVyaT8uc2NoZW1lID09PSAnZ2l0JykpKSB7XG5cblx0XHRcdC8vIElmIHRoZSB1cmkgaGFzbid0IGNoYW5nZWQsIG1ha2Ugc3VyZSB3ZSBoYXZlIHZhbGlkIGNhY2hlc1xuXHRcdFx0Zm9yIChjb25zdCBzb3VyY2Ugb2YgdGhpcy50aW1lbGluZVNlcnZpY2UuZ2V0U291cmNlcygpKSB7XG5cdFx0XHRcdGlmICh0aGlzLmV4Y2x1ZGVkU291cmNlcy5oYXMoc291cmNlLmlkKSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGltZWxpbmUgPSB0aGlzLnRpbWVsaW5lc0J5U291cmNlLmdldChzb3VyY2UuaWQpO1xuXHRcdFx0XHRpZiAodGltZWxpbmUgIT09IHVuZGVmaW5lZCAmJiAhdGltZWxpbmUuc3RhbGUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh0aW1lbGluZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVUaW1lbGluZSh0aW1lbGluZSwgdGltZWxpbmUucmVxdWlyZXNSZXNldCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5sb2FkVGltZWxpbmVGb3JTb3VyY2Uoc291cmNlLmlkLCB1cmksIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnNldFVyaUNvcmUodXJpLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uUHJvdmlkZXJzQ2hhbmdlZChlOiBUaW1lbGluZVByb3ZpZGVyc0NoYW5nZUV2ZW50KSB7XG5cdFx0aWYgKGUucmVtb3ZlZCkge1xuXHRcdFx0Zm9yIChjb25zdCBzb3VyY2Ugb2YgZS5yZW1vdmVkKSB7XG5cdFx0XHRcdHRoaXMudGltZWxpbmVzQnlTb3VyY2UuZGVsZXRlKHNvdXJjZSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdH1cblxuXHRcdGlmIChlLmFkZGVkKSB7XG5cdFx0XHR0aGlzLmxvYWRUaW1lbGluZSh0cnVlLCBlLmFkZGVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uVGltZWxpbmVDaGFuZ2VkKGU6IFRpbWVsaW5lQ2hhbmdlRXZlbnQpIHtcblx0XHRpZiAoZT8udXJpID09PSB1bmRlZmluZWQgfHwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoVVJJLnJldml2ZShlLnVyaSksIHRoaXMudXJpKSkge1xuXHRcdFx0Y29uc3QgdGltZWxpbmUgPSB0aGlzLnRpbWVsaW5lc0J5U291cmNlLmdldChlLmlkKTtcblx0XHRcdGlmICh0aW1lbGluZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuaXNCb2R5VmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlVGltZWxpbmUodGltZWxpbmUsIGUucmVzZXQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGltZWxpbmUuaW52YWxpZGF0ZShlLnJlc2V0KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9maWxlbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR1cGRhdGVGaWxlbmFtZShmaWxlbmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fZmlsZW5hbWUgPSBmaWxlbmFtZTtcblx0XHRpZiAodGhpcy5mb2xsb3dBY3RpdmVFZGl0b3IgfHwgIWZpbGVuYW1lKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpdGxlRGVzY3JpcHRpb24oZmlsZW5hbWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVRpdGxlRGVzY3JpcHRpb24oYCR7ZmlsZW5hbWV9IChwaW5uZWQpYCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRnZXQgbWVzc2FnZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tZXNzYWdlO1xuXHR9XG5cblx0c2V0IG1lc3NhZ2UobWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fbWVzc2FnZSA9IG1lc3NhZ2U7XG5cdFx0dGhpcy51cGRhdGVNZXNzYWdlKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1lc3NhZ2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX21lc3NhZ2UgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5zaG93TWVzc2FnZSh0aGlzLl9tZXNzYWdlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5oaWRlTWVzc2FnZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd01lc3NhZ2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLiRtZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuJG1lc3NhZ2UuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuXHRcdHRoaXMucmVzZXRNZXNzYWdlRWxlbWVudCgpO1xuXG5cdFx0dGhpcy4kbWVzc2FnZS50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdH1cblxuXHRwcml2YXRlIGhpZGVNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMucmVzZXRNZXNzYWdlRWxlbWVudCgpO1xuXHRcdHRoaXMuJG1lc3NhZ2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNldE1lc3NhZ2VFbGVtZW50KCk6IHZvaWQge1xuXHRcdERPTS5jbGVhck5vZGUodGhpcy4kbWVzc2FnZSk7XG5cdH1cblxuXHRwcml2YXRlIF9pc0VtcHR5ID0gdHJ1ZTtcblx0cHJpdmF0ZSBfbWF4SXRlbUNvdW50ID0gMDtcblxuXHRwcml2YXRlIF92aXNpYmxlSXRlbUNvdW50ID0gMDtcblx0cHJpdmF0ZSBnZXQgaGFzVmlzaWJsZUl0ZW1zKCkge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlSXRlbUNvdW50ID4gMDtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoY2FuY2VsUGVuZGluZzogYm9vbGVhbikge1xuXHRcdHRoaXMuX3Zpc2libGVJdGVtQ291bnQgPSAwO1xuXHRcdHRoaXMuX21heEl0ZW1Db3VudCA9IHRoaXMucGFnZVNpemU7XG5cdFx0dGhpcy50aW1lbGluZXNCeVNvdXJjZS5jbGVhcigpO1xuXG5cdFx0aWYgKGNhbmNlbFBlbmRpbmcpIHtcblx0XHRcdGZvciAoY29uc3QgcGVuZGluZ1JlcXVlc3Qgb2YgdGhpcy5wZW5kaW5nUmVxdWVzdHMudmFsdWVzKCkpIHtcblx0XHRcdFx0cGVuZGluZ1JlcXVlc3QucmVxdWVzdC50b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRcdFx0cGVuZGluZ1JlcXVlc3QuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLnBlbmRpbmdSZXF1ZXN0cy5jbGVhcigpO1xuXG5cdFx0XHRpZiAoIXRoaXMuaXNCb2R5VmlzaWJsZSgpICYmIHRoaXMudHJlZSkge1xuXHRcdFx0XHR0aGlzLnRyZWUuc2V0Q2hpbGRyZW4obnVsbCwgdW5kZWZpbmVkKTtcblx0XHRcdFx0dGhpcy5faXNFbXB0eSA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsb2FkVGltZWxpbmUocmVzZXQ6IGJvb2xlYW4sIHNvdXJjZXM/OiBzdHJpbmdbXSkge1xuXHRcdC8vIElmIHdlIGhhdmUgbm8gc291cmNlLCB3ZSBhcmUgcmVzZXR0aW5nIGFsbCBzb3VyY2VzLCBzbyBjYW5jZWwgZXZlcnl0aGluZyBpbiBmbGlnaHQgYW5kIHJlc2V0IGNhY2hlc1xuXHRcdGlmIChzb3VyY2VzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChyZXNldCkge1xuXHRcdFx0XHR0aGlzLmNsZWFyKHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUT0RPQGVhbW9kaW86IEFyZSB0aGVzZSB0aGUgcmlnaHQgdGhlIGxpc3Qgb2Ygc2NoZW1lcyB0byBleGNsdWRlPyBJcyB0aGVyZSBhIGJldHRlciB3YXk/XG5cdFx0XHRpZiAodGhpcy51cmk/LnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVTZXR0aW5ncyB8fCB0aGlzLnVyaT8uc2NoZW1lID09PSBTY2hlbWFzLndlYnZpZXdQYW5lbCB8fCB0aGlzLnVyaT8uc2NoZW1lID09PSBTY2hlbWFzLndhbGtUaHJvdWdoKSB7XG5cdFx0XHRcdHRoaXMudXJpID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdHRoaXMuY2xlYXIoZmFsc2UpO1xuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9pc0VtcHR5ICYmIHRoaXMudXJpICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5zZXRMb2FkaW5nVXJpTWVzc2FnZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnVyaSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmNsZWFyKGZhbHNlKTtcblx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmlzQm9keVZpc2libGUoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBoYXNQZW5kaW5nUmVxdWVzdHMgPSBmYWxzZTtcblxuXHRcdGZvciAoY29uc3Qgc291cmNlIG9mIHNvdXJjZXMgPz8gdGhpcy50aW1lbGluZVNlcnZpY2UuZ2V0U291cmNlcygpLm1hcChzID0+IHMuaWQpKSB7XG5cdFx0XHRjb25zdCByZXF1ZXN0ZWQgPSB0aGlzLmxvYWRUaW1lbGluZUZvclNvdXJjZShzb3VyY2UsIHRoaXMudXJpLCByZXNldCk7XG5cdFx0XHRpZiAocmVxdWVzdGVkKSB7XG5cdFx0XHRcdGhhc1BlbmRpbmdSZXF1ZXN0cyA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFoYXNQZW5kaW5nUmVxdWVzdHMpIHtcblx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5faXNFbXB0eSkge1xuXHRcdFx0dGhpcy5zZXRMb2FkaW5nVXJpTWVzc2FnZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbG9hZFRpbWVsaW5lRm9yU291cmNlKHNvdXJjZTogc3RyaW5nLCB1cmk6IFVSSSwgcmVzZXQ6IGJvb2xlYW4sIG9wdGlvbnM/OiBUaW1lbGluZU9wdGlvbnMpIHtcblx0XHRpZiAodGhpcy5leGNsdWRlZFNvdXJjZXMuaGFzKHNvdXJjZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCB0aW1lbGluZSA9IHRoaXMudGltZWxpbmVzQnlTb3VyY2UuZ2V0KHNvdXJjZSk7XG5cblx0XHQvLyBJZiB3ZSBhcmUgcGFnaW5nLCBhbmQgdGhlcmUgYXJlIG5vIG1vcmUgaXRlbXMgb3Igd2UgaGF2ZSBlbm91Z2ggY2FjaGVkIGl0ZW1zIHRvIGNvdmVyIHRoZSBuZXh0IHBhZ2UsXG5cdFx0Ly8gZG9uJ3QgYm90aGVyIHF1ZXJ5aW5nIGZvciBtb3JlXG5cdFx0aWYgKFxuXHRcdFx0IXJlc2V0ICYmXG5cdFx0XHRvcHRpb25zPy5jdXJzb3IgIT09IHVuZGVmaW5lZCAmJlxuXHRcdFx0dGltZWxpbmUgIT09IHVuZGVmaW5lZCAmJlxuXHRcdFx0KCF0aW1lbGluZT8ubW9yZSB8fCB0aW1lbGluZS5pdGVtcy5sZW5ndGggPiB0aW1lbGluZS5sYXN0UmVuZGVyZWRJbmRleCArIHRoaXMucGFnZVNpemUpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKFxuXHRcdFx0XHQhcmVzZXQgJiZcblx0XHRcdFx0dGltZWxpbmUgIT09IHVuZGVmaW5lZCAmJlxuXHRcdFx0XHR0aW1lbGluZS5pdGVtcy5sZW5ndGggPiAwICYmXG5cdFx0XHRcdCF0aW1lbGluZS5tb3JlXG5cdFx0XHQpIHtcblx0XHRcdFx0Ly8gSWYgd2UgYXJlIG5vdCByZXNldHRpbmcsIGhhdmUgaXRlbShzKSwgYW5kIGFscmVhZHkga25vdyB0aGVyZSBhcmUgbm8gbW9yZSB0byBmZXRjaCwgd2UncmUgZG9uZSBoZXJlXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdG9wdGlvbnMgPSB7IGN1cnNvcjogcmVzZXQgPyB1bmRlZmluZWQgOiB0aW1lbGluZT8uY3Vyc29yLCBsaW1pdDogdGhpcy5wYWdlU2l6ZSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gdGhpcy5wZW5kaW5nUmVxdWVzdHMuZ2V0KHNvdXJjZSk7XG5cdFx0aWYgKHBlbmRpbmdSZXF1ZXN0ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdG9wdGlvbnMuY3Vyc29yID0gcGVuZGluZ1JlcXVlc3QucmVxdWVzdC5vcHRpb25zLmN1cnNvcjtcblxuXHRcdFx0Ly8gVE9ET0BlYW1vZGlvIGRlYWwgd2l0aCBjb25jdXJyZW50IHJlcXVlc3RzIGJldHRlclxuXHRcdFx0aWYgKHR5cGVvZiBvcHRpb25zLmxpbWl0ID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRpZiAodHlwZW9mIHBlbmRpbmdSZXF1ZXN0LnJlcXVlc3Qub3B0aW9ucy5saW1pdCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRvcHRpb25zLmxpbWl0ICs9IHBlbmRpbmdSZXF1ZXN0LnJlcXVlc3Qub3B0aW9ucy5saW1pdDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRvcHRpb25zLmxpbWl0ID0gcGVuZGluZ1JlcXVlc3QucmVxdWVzdC5vcHRpb25zLmxpbWl0O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHBlbmRpbmdSZXF1ZXN0Py5yZXF1ZXN0Py50b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0XHRwZW5kaW5nUmVxdWVzdD8uZGlzcG9zZSgpO1xuXG5cdFx0b3B0aW9ucy5jYWNoZVJlc3VsdHMgPSB0cnVlO1xuXHRcdG9wdGlvbnMucmVzZXRDYWNoZSA9IHJlc2V0O1xuXHRcdGNvbnN0IHRva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0Y29uc3QgbmV3UmVxdWVzdCA9IHRoaXMudGltZWxpbmVTZXJ2aWNlLmdldFRpbWVsaW5lKHNvdXJjZSwgdXJpLCBvcHRpb25zLCB0b2tlblNvdXJjZSk7XG5cblx0XHRpZiAobmV3UmVxdWVzdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0b2tlblNvdXJjZS5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5wZW5kaW5nUmVxdWVzdHMuc2V0KHNvdXJjZSwgeyByZXF1ZXN0OiBuZXdSZXF1ZXN0LCBkaXNwb3NlOiAoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkgfSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuU291cmNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW5Tb3VyY2UudG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gdGhpcy5wZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHNvdXJjZSkpKTtcblxuXHRcdHRoaXMuaGFuZGxlUmVxdWVzdChuZXdSZXF1ZXN0KTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUaW1lbGluZSh0aW1lbGluZTogVGltZWxpbmVBZ2dyZWdhdGUsIHJlc2V0OiBib29sZWFuKSB7XG5cdFx0aWYgKHJlc2V0KSB7XG5cdFx0XHR0aGlzLnRpbWVsaW5lc0J5U291cmNlLmRlbGV0ZSh0aW1lbGluZS5zb3VyY2UpO1xuXHRcdFx0Ly8gT3ZlcnJpZGUgdGhlIGxpbWl0LCB0byByZS1xdWVyeSBmb3IgYWxsIG91ciBleGlzdGluZyBjYWNoZWQgKHBvc3NpYmx5IHZpc2libGUpIGl0ZW1zIHRvIGtlZXAgdmlzdWFsIGNvbnRpbnVpdHlcblx0XHRcdGNvbnN0IHsgb2xkZXN0IH0gPSB0aW1lbGluZTtcblx0XHRcdHRoaXMubG9hZFRpbWVsaW5lRm9yU291cmNlKHRpbWVsaW5lLnNvdXJjZSwgdGhpcy51cmkhLCB0cnVlLCBvbGRlc3QgIT09IHVuZGVmaW5lZCA/IHsgbGltaXQ6IHsgdGltZXN0YW1wOiBvbGRlc3QudGltZXN0YW1wLCBpZDogb2xkZXN0LmlkIH0gfSA6IHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIE92ZXJyaWRlIHRoZSBsaW1pdCwgdG8gcXVlcnkgZm9yIGFueSBuZXdlciBpdGVtc1xuXHRcdFx0Y29uc3QgeyBuZXdlc3QgfSA9IHRpbWVsaW5lO1xuXHRcdFx0dGhpcy5sb2FkVGltZWxpbmVGb3JTb3VyY2UodGltZWxpbmUuc291cmNlLCB0aGlzLnVyaSEsIGZhbHNlLCBuZXdlc3QgIT09IHVuZGVmaW5lZCA/IHsgbGltaXQ6IHsgdGltZXN0YW1wOiBuZXdlc3QudGltZXN0YW1wLCBpZDogbmV3ZXN0LmlkIH0gfSA6IHsgbGltaXQ6IHRoaXMucGFnZVNpemUgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcGVuZGluZ1JlZnJlc2ggPSBmYWxzZTtcblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZVJlcXVlc3QocmVxdWVzdDogVGltZWxpbmVSZXF1ZXN0KSB7XG5cdFx0bGV0IHJlc3BvbnNlOiBUaW1lbGluZSB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0cmVzcG9uc2UgPSBhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogdGhpcy5pZCB9LCAoKSA9PiByZXF1ZXN0LnJlc3VsdCk7XG5cdFx0fVxuXHRcdGZpbmFsbHkge1xuXHRcdFx0dGhpcy5wZW5kaW5nUmVxdWVzdHMuZ2V0KHJlcXVlc3Quc291cmNlKT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5wZW5kaW5nUmVxdWVzdHMuZGVsZXRlKHJlcXVlc3Quc291cmNlKTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHRyZXNwb25zZSA9PT0gdW5kZWZpbmVkIHx8XG5cdFx0XHRyZXF1ZXN0LnRva2VuU291cmNlLnRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8XG5cdFx0XHRyZXF1ZXN0LnVyaSAhPT0gdGhpcy51cmlcblx0XHQpIHtcblx0XHRcdGlmICh0aGlzLnBlbmRpbmdSZXF1ZXN0cy5zaXplID09PSAwICYmIHRoaXMuX3BlbmRpbmdSZWZyZXNoKSB7XG5cdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc291cmNlID0gcmVxdWVzdC5zb3VyY2U7XG5cblx0XHRsZXQgdXBkYXRlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHRpbWVsaW5lID0gdGhpcy50aW1lbGluZXNCeVNvdXJjZS5nZXQoc291cmNlKTtcblx0XHRpZiAodGltZWxpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy50aW1lbGluZXNCeVNvdXJjZS5zZXQoc291cmNlLCBuZXcgVGltZWxpbmVBZ2dyZWdhdGUocmVzcG9uc2UpKTtcblx0XHRcdHVwZGF0ZWQgPSB0cnVlO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHVwZGF0ZWQgPSB0aW1lbGluZS5hZGQocmVzcG9uc2UsIHJlcXVlc3Qub3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKHVwZGF0ZWQpIHtcblx0XHRcdHRoaXMuX3BlbmRpbmdSZWZyZXNoID0gdHJ1ZTtcblxuXHRcdFx0Ly8gSWYgd2UgaGF2ZSB2aXNpYmxlIGl0ZW1zIGFscmVhZHkgYW5kIHRoZXJlIGFyZSBvdGhlciBwZW5kaW5nIHJlcXVlc3RzLCBkZWJvdW5jZSBmb3IgYSBiaXQgdG8gd2FpdCBmb3Igb3RoZXIgcmVxdWVzdHNcblx0XHRcdGlmICh0aGlzLmhhc1Zpc2libGVJdGVtcyAmJiB0aGlzLnBlbmRpbmdSZXF1ZXN0cy5zaXplICE9PSAwKSB7XG5cdFx0XHRcdHRoaXMucmVmcmVzaERlYm91bmNlZCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLnBlbmRpbmdSZXF1ZXN0cy5zaXplID09PSAwKSB7XG5cdFx0XHRpZiAodGhpcy5fcGVuZGluZ1JlZnJlc2gpIHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRyZWUucmVyZW5kZXIoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlICpnZXRJdGVtcygpOiBHZW5lcmF0b3I8SVRyZWVFbGVtZW50PFRyZWVFbGVtZW50PiwgYW55LCBhbnk+IHtcblx0XHRsZXQgbW9yZSA9IGZhbHNlO1xuXG5cdFx0aWYgKHRoaXMudXJpID09PSB1bmRlZmluZWQgfHwgdGhpcy50aW1lbGluZXNCeVNvdXJjZS5zaXplID09PSAwKSB7XG5cdFx0XHR0aGlzLl92aXNpYmxlSXRlbUNvdW50ID0gMDtcblxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1heENvdW50ID0gdGhpcy5fbWF4SXRlbUNvdW50O1xuXHRcdGxldCBjb3VudCA9IDA7XG5cblx0XHRpZiAodGhpcy50aW1lbGluZXNCeVNvdXJjZS5zaXplID09PSAxKSB7XG5cdFx0XHRjb25zdCBbc291cmNlLCB0aW1lbGluZV0gPSBJdGVyYWJsZS5maXJzdCh0aGlzLnRpbWVsaW5lc0J5U291cmNlKSE7XG5cblx0XHRcdHRpbWVsaW5lLmxhc3RSZW5kZXJlZEluZGV4ID0gLTE7XG5cblx0XHRcdGlmICh0aGlzLmV4Y2x1ZGVkU291cmNlcy5oYXMoc291cmNlKSkge1xuXHRcdFx0XHR0aGlzLl92aXNpYmxlSXRlbUNvdW50ID0gMDtcblxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aW1lbGluZS5pdGVtcy5sZW5ndGggIT09IDApIHtcblx0XHRcdFx0Ly8gSWYgd2UgaGF2ZSBhbnkgaXRlbXMsIGp1c3Qgc2F5IHdlIGhhdmUgb25lIGZvciBub3cgLS0gdGhlIHJlYWwgY291bnQgd2lsbCBiZSB1cGRhdGVkIGJlbG93XG5cdFx0XHRcdHRoaXMuX3Zpc2libGVJdGVtQ291bnQgPSAxO1xuXHRcdFx0fVxuXG5cdFx0XHRtb3JlID0gdGltZWxpbmUubW9yZTtcblxuXHRcdFx0bGV0IGxhc3RSZWxhdGl2ZVRpbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiB0aW1lbGluZS5pdGVtcykge1xuXHRcdFx0XHRpdGVtLnJlbGF0aXZlVGltZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aXRlbS5oaWRlUmVsYXRpdmVUaW1lID0gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGNvdW50Kys7XG5cdFx0XHRcdGlmIChjb3VudCA+IG1heENvdW50KSB7XG5cdFx0XHRcdFx0bW9yZSA9IHRydWU7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsYXN0UmVsYXRpdmVUaW1lID0gdXBkYXRlUmVsYXRpdmVUaW1lKGl0ZW0sIGxhc3RSZWxhdGl2ZVRpbWUpO1xuXHRcdFx0XHR5aWVsZCB7IGVsZW1lbnQ6IGl0ZW0gfTtcblx0XHRcdH1cblxuXHRcdFx0dGltZWxpbmUubGFzdFJlbmRlcmVkSW5kZXggPSBjb3VudCAtIDE7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uc3Qgc291cmNlczogeyB0aW1lbGluZTogVGltZWxpbmVBZ2dyZWdhdGU7IGl0ZXJhdG9yOiBJdGVyYWJsZUl0ZXJhdG9yPFRpbWVsaW5lSXRlbT47IG5leHRJdGVtOiBJdGVyYXRvclJlc3VsdDxUaW1lbGluZUl0ZW0sIHVuZGVmaW5lZD4gfVtdID0gW107XG5cblx0XHRcdGxldCBoYXNBbnlJdGVtcyA9IGZhbHNlO1xuXHRcdFx0bGV0IG1vc3RSZWNlbnRFbmQgPSAwO1xuXG5cdFx0XHRmb3IgKGNvbnN0IFtzb3VyY2UsIHRpbWVsaW5lXSBvZiB0aGlzLnRpbWVsaW5lc0J5U291cmNlKSB7XG5cdFx0XHRcdHRpbWVsaW5lLmxhc3RSZW5kZXJlZEluZGV4ID0gLTE7XG5cblx0XHRcdFx0aWYgKHRoaXMuZXhjbHVkZWRTb3VyY2VzLmhhcyhzb3VyY2UpIHx8IHRpbWVsaW5lLnN0YWxlKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGltZWxpbmUuaXRlbXMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdFx0aGFzQW55SXRlbXMgPSB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRpbWVsaW5lLm1vcmUpIHtcblx0XHRcdFx0XHRtb3JlID0gdHJ1ZTtcblxuXHRcdFx0XHRcdGNvbnN0IGxhc3QgPSB0aW1lbGluZS5pdGVtc1tNYXRoLm1pbihtYXhDb3VudCwgdGltZWxpbmUuaXRlbXMubGVuZ3RoIC0gMSldO1xuXHRcdFx0XHRcdGlmIChsYXN0LnRpbWVzdGFtcCA+IG1vc3RSZWNlbnRFbmQpIHtcblx0XHRcdFx0XHRcdG1vc3RSZWNlbnRFbmQgPSBsYXN0LnRpbWVzdGFtcDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBpdGVyYXRvciA9IHRpbWVsaW5lLml0ZW1zW1N5bWJvbC5pdGVyYXRvcl0oKTtcblx0XHRcdFx0c291cmNlcy5wdXNoKHsgdGltZWxpbmUsIGl0ZXJhdG9yLCBuZXh0SXRlbTogaXRlcmF0b3IubmV4dCgpIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl92aXNpYmxlSXRlbUNvdW50ID0gaGFzQW55SXRlbXMgPyAxIDogMDtcblxuXHRcdFx0ZnVuY3Rpb24gZ2V0TmV4dE1vc3RSZWNlbnRTb3VyY2UoKSB7XG5cdFx0XHRcdHJldHVybiBzb3VyY2VzXG5cdFx0XHRcdFx0LmZpbHRlcihzb3VyY2UgPT4gIXNvdXJjZS5uZXh0SXRlbS5kb25lKVxuXHRcdFx0XHRcdC5yZWR1Y2UoKHByZXZpb3VzLCBjdXJyZW50KSA9PiAocHJldmlvdXMgPT09IHVuZGVmaW5lZCB8fCBjdXJyZW50Lm5leHRJdGVtLnZhbHVlIS50aW1lc3RhbXAgPj0gcHJldmlvdXMubmV4dEl0ZW0udmFsdWUhLnRpbWVzdGFtcCkgPyBjdXJyZW50IDogcHJldmlvdXMsIHVuZGVmaW5lZCEpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgbGFzdFJlbGF0aXZlVGltZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IG5leHRTb3VyY2U7XG5cdFx0XHR3aGlsZSAobmV4dFNvdXJjZSA9IGdldE5leHRNb3N0UmVjZW50U291cmNlKCkpIHtcblx0XHRcdFx0bmV4dFNvdXJjZS50aW1lbGluZS5sYXN0UmVuZGVyZWRJbmRleCsrO1xuXG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSBuZXh0U291cmNlLm5leHRJdGVtLnZhbHVlITtcblx0XHRcdFx0aXRlbS5yZWxhdGl2ZVRpbWUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGl0ZW0uaGlkZVJlbGF0aXZlVGltZSA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRpZiAoaXRlbS50aW1lc3RhbXAgPj0gbW9zdFJlY2VudEVuZCkge1xuXHRcdFx0XHRcdGNvdW50Kys7XG5cdFx0XHRcdFx0aWYgKGNvdW50ID4gbWF4Q291bnQpIHtcblx0XHRcdFx0XHRcdG1vcmUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0bGFzdFJlbGF0aXZlVGltZSA9IHVwZGF0ZVJlbGF0aXZlVGltZShpdGVtLCBsYXN0UmVsYXRpdmVUaW1lKTtcblx0XHRcdFx0XHR5aWVsZCB7IGVsZW1lbnQ6IGl0ZW0gfTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG5leHRTb3VyY2UubmV4dEl0ZW0gPSBuZXh0U291cmNlLml0ZXJhdG9yLm5leHQoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl92aXNpYmxlSXRlbUNvdW50ID0gY291bnQ7XG5cdFx0aWYgKGNvdW50ID4gMCkge1xuXHRcdFx0aWYgKG1vcmUpIHtcblx0XHRcdFx0eWllbGQge1xuXHRcdFx0XHRcdGVsZW1lbnQ6IG5ldyBMb2FkTW9yZUNvbW1hbmQodGhpcy5wZW5kaW5nUmVxdWVzdHMuc2l6ZSAhPT0gMClcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5wZW5kaW5nUmVxdWVzdHMuc2l6ZSAhPT0gMCkge1xuXHRcdFx0XHR5aWVsZCB7XG5cdFx0XHRcdFx0ZWxlbWVudDogbmV3IExvYWRNb3JlQ29tbWFuZCh0cnVlKVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaCgpIHtcblx0XHRpZiAoIXRoaXMuaXNCb2R5VmlzaWJsZSgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy50cmVlLnNldENoaWxkcmVuKG51bGwsIHRoaXMuZ2V0SXRlbXMoKSBhcyBhbnkpO1xuXHRcdHRoaXMuX2lzRW1wdHkgPSAhdGhpcy5oYXNWaXNpYmxlSXRlbXM7XG5cblx0XHRpZiAodGhpcy51cmkgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy51cGRhdGVGaWxlbmFtZSh1bmRlZmluZWQpO1xuXHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ3RpbWVsaW5lLmVkaXRvckNhbm5vdFByb3ZpZGVUaW1lbGluZScsIFwiVGhlIGFjdGl2ZSBlZGl0b3IgY2Fubm90IHByb3ZpZGUgdGltZWxpbmUgaW5mb3JtYXRpb24uXCIpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5faXNFbXB0eSkge1xuXHRcdFx0aWYgKHRoaXMucGVuZGluZ1JlcXVlc3RzLnNpemUgIT09IDApIHtcblx0XHRcdFx0dGhpcy5zZXRMb2FkaW5nVXJpTWVzc2FnZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy51cGRhdGVGaWxlbmFtZSh0aGlzLmxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHRoaXMudXJpKSk7XG5cdFx0XHRcdGNvbnN0IHNjbVByb3ZpZGVyQ291bnQgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxudW1iZXI+KCdzY20ucHJvdmlkZXJDb3VudCcpO1xuXHRcdFx0XHRpZiAodGhpcy50aW1lbGluZVNlcnZpY2UuZ2V0U291cmNlcygpLmZpbHRlcigoeyBpZCB9KSA9PiAhdGhpcy5leGNsdWRlZFNvdXJjZXMuaGFzKGlkKSkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ3RpbWVsaW5lLm5vVGltZWxpbmVTb3VyY2VzRW5hYmxlZCcsIFwiQWxsIHRpbWVsaW5lIHNvdXJjZXMgaGF2ZSBiZWVuIGZpbHRlcmVkIG91dC5cIik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5sb2NhbEhpc3RvcnkuZW5hYmxlZCcpICYmICF0aGlzLmV4Y2x1ZGVkU291cmNlcy5oYXMoJ3RpbWVsaW5lLmxvY2FsSGlzdG9yeScpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1lc3NhZ2UgPSBsb2NhbGl6ZSgndGltZWxpbmUubm9Mb2NhbEhpc3RvcnlZZXQnLCBcIkxvY2FsIEhpc3Rvcnkgd2lsbCB0cmFjayByZWNlbnQgY2hhbmdlcyBhcyB5b3Ugc2F2ZSB0aGVtIHVubGVzcyB0aGUgZmlsZSBoYXMgYmVlbiBleGNsdWRlZCBvciBpcyB0b28gbGFyZ2UuXCIpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5leGNsdWRlZFNvdXJjZXMuc2l6ZSA+IDApIHtcblx0XHRcdFx0XHRcdHRoaXMubWVzc2FnZSA9IGxvY2FsaXplKCd0aW1lbGluZS5ub1RpbWVsaW5lSW5mb0Zyb21FbmFibGVkU291cmNlcycsIFwiTm8gZmlsdGVyZWQgdGltZWxpbmUgaW5mb3JtYXRpb24gd2FzIHByb3ZpZGVkLlwiKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ3RpbWVsaW5lLm5vVGltZWxpbmVJbmZvJywgXCJObyB0aW1lbGluZSBpbmZvcm1hdGlvbiB3YXMgcHJvdmlkZWQuXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXNjbVByb3ZpZGVyQ291bnQgfHwgc2NtUHJvdmlkZXJDb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMubWVzc2FnZSArPSAnICcgKyBsb2NhbGl6ZSgndGltZWxpbmUubm9TQ00nLCBcIlNvdXJjZSBDb250cm9sIGhhcyBub3QgYmVlbiBjb25maWd1cmVkLlwiKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUZpbGVuYW1lKHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwodGhpcy51cmkpKTtcblx0XHRcdHRoaXMubWVzc2FnZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl9wZW5kaW5nUmVmcmVzaCA9IGZhbHNlO1xuXHR9XG5cblx0QGRlYm91bmNlKDUwMClcblx0cHJpdmF0ZSByZWZyZXNoRGVib3VuY2VkKCkge1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblx0XHR0aGlzLnRyZWUuZG9tRm9jdXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldEV4cGFuZGVkKGV4cGFuZGVkOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgY2hhbmdlZCA9IHN1cGVyLnNldEV4cGFuZGVkKGV4cGFuZGVkKTtcblxuXHRcdGlmIChjaGFuZ2VkICYmIHRoaXMuaXNCb2R5VmlzaWJsZSgpKSB7XG5cdFx0XHRpZiAoIXRoaXMuZm9sbG93QWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRcdHRoaXMuc2V0VXJpQ29yZSh0aGlzLnVyaSwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLm9uQWN0aXZlRWRpdG9yQ2hhbmdlZCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBjaGFuZ2VkO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0VmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoJ29uVmlldzp0aW1lbGluZScpO1xuXHRcdFx0dGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdHRoaXMuZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSh0aGlzLm9uQWN0aXZlRWRpdG9yQ2hhbmdlZCwgdGhpcywgdGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpO1xuXHRcdFx0Ly8gUmVmcmVzaCB0aGUgdmlldyBvbiBmb2N1cyB0byB1cGRhdGUgdGhlIHJlbGF0aXZlIHRpbWVzdGFtcHNcblx0XHRcdHRoaXMub25EaWRGb2N1cygoKSA9PiB0aGlzLnJlZnJlc2hEZWJvdW5jZWQoKSwgdGhpcywgdGhpcy52aXNpYmlsaXR5RGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRzdXBlci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXG5cdFx0XHR0aGlzLm9uQWN0aXZlRWRpdG9yQ2hhbmdlZCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnZpc2liaWxpdHlEaXNwb3NhYmxlcz8uZGlzcG9zZSgpO1xuXG5cdFx0XHRzdXBlci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLnRyZWUubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlclRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRoaXMudGl0bGUpO1xuXG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3RpbWVsaW5lLXZpZXcnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLiRjb250YWluZXIgPSBjb250YWluZXI7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3RyZWUtZXhwbG9yZXItdmlld2xldC10cmVlLXZpZXcnLCAndGltZWxpbmUtdHJlZS12aWV3Jyk7XG5cblx0XHR0aGlzLiRtZXNzYWdlID0gRE9NLmFwcGVuZCh0aGlzLiRjb250YWluZXIsIERPTS4kKCcubWVzc2FnZScpKTtcblx0XHR0aGlzLiRtZXNzYWdlLmNsYXNzTGlzdC5hZGQoJ3RpbWVsaW5lLXN1YnRsZScpO1xuXG5cdFx0dGhpcy5tZXNzYWdlID0gbG9jYWxpemUoJ3RpbWVsaW5lLmVkaXRvckNhbm5vdFByb3ZpZGVUaW1lbGluZScsIFwiVGhlIGFjdGl2ZSBlZGl0b3IgY2Fubm90IHByb3ZpZGUgdGltZWxpbmUgaW5mb3JtYXRpb24uXCIpO1xuXG5cdFx0dGhpcy4kdHJlZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRoaXMuJHRyZWUuY2xhc3NMaXN0LmFkZCgnY3VzdG9tdmlldy10cmVlJywgJ2ZpbGUtaWNvbi10aGVtYWJsZS10cmVlJywgJ2hpZGUtYXJyb3dzJyk7XG5cdFx0Ly8gdGhpcy50cmVlRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzaG93LWZpbGUtaWNvbnMnKTtcblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy4kdHJlZSk7XG5cblx0XHR0aGlzLnRyZWVSZW5kZXJlciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGltZWxpbmVUcmVlUmVuZGVyZXIsIHRoaXMuY29tbWFuZHMpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZVJlbmRlcmVyLm9uRGlkU2Nyb2xsVG9FbmQoaXRlbSA9PiB7XG5cdFx0XHRpZiAodGhpcy5wYWdlT25TY3JvbGwpIHtcblx0XHRcdFx0dGhpcy5sb2FkTW9yZShpdGVtKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnRyZWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaE9iamVjdFRyZWU8VHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+LCAnVGltZWxpbmVQYW5lJyxcblx0XHRcdHRoaXMuJHRyZWUsIG5ldyBUaW1lbGluZUxpc3RWaXJ0dWFsRGVsZWdhdGUoKSwgW3RoaXMudHJlZVJlbmRlcmVyXSwge1xuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogbmV3IFRpbWVsaW5lSWRlbnRpdHlQcm92aWRlcigpLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEFyaWFMYWJlbChlbGVtZW50OiBUcmVlRWxlbWVudCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0aWYgKGlzTG9hZE1vcmVDb21tYW5kKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5hcmlhTGFiZWw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbiA/IGVsZW1lbnQuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uLmxhYmVsIDogbG9jYWxpemUoJ3RpbWVsaW5lLmFyaWEuaXRlbScsIFwiezB9OiB7MX1cIiwgZWxlbWVudC5yZWxhdGl2ZVRpbWVGdWxsV29yZCA/PyAnJywgZWxlbWVudC5sYWJlbCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFJvbGUoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBBcmlhUm9sZSB7XG5cdFx0XHRcdFx0aWYgKGlzTG9hZE1vcmVDb21tYW5kKGVsZW1lbnQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJ3RyZWVpdGVtJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uICYmIGVsZW1lbnQuYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uLnJvbGUgPyBlbGVtZW50LmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbi5yb2xlIDogJ3RyZWVpdGVtJztcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0aW1lbGluZScsIFwiVGltZWxpbmVcIik7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiBuZXcgVGltZWxpbmVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyKCksXG5cdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0b3ZlcnJpZGVTdHlsZXM6IHRoaXMuZ2V0TG9jYXRpb25CYXNlZENvbG9ycygpLmxpc3RPdmVycmlkZVN0eWxlcyxcblx0XHR9KTtcblxuXHRcdFRpbWVsaW5lVmlld0ZvY3VzZWRDb250ZXh0LmJpbmRUbyh0aGlzLnRyZWUuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uQ29udGV4dE1lbnUoZSA9PiB0aGlzLm9uQ29udGV4dE1lbnUodGhpcy5jb21tYW5kcywgZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRDaGFuZ2VTZWxlY3Rpb24oZSA9PiB0aGlzLmVuc3VyZVZhbGlkSXRlbXMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZE9wZW4oZSA9PiB7XG5cdFx0XHRpZiAoIWUuYnJvd3NlckV2ZW50IHx8ICF0aGlzLmVuc3VyZVZhbGlkSXRlbXMoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMudHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdGxldCBpdGVtO1xuXHRcdFx0aWYgKHNlbGVjdGlvbi5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0aXRlbSA9IHNlbGVjdGlvblswXTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGl0ZW0gPT09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNUaW1lbGluZUl0ZW0oaXRlbSkpIHtcblx0XHRcdFx0aWYgKGl0ZW0uY29tbWFuZCkge1xuXHRcdFx0XHRcdGxldCBhcmdzID0gaXRlbS5jb21tYW5kLmFyZ3VtZW50cyA/PyBbXTtcblx0XHRcdFx0XHRpZiAoaXRlbS5jb21tYW5kLmlkID09PSBBUElfT1BFTl9FRElUT1JfQ09NTUFORF9JRCB8fCBpdGVtLmNvbW1hbmQuaWQgPT09IEFQSV9PUEVOX0RJRkZfRURJVE9SX0NPTU1BTkRfSUQpIHtcblx0XHRcdFx0XHRcdC8vIFNvbWUgY29tbWFuZHMgb3duZWQgYnkgdXMgc2hvdWxkIHJlY2VpdmUgdGhlXG5cdFx0XHRcdFx0XHQvLyBgSU9wZW5FdmVudGAgYXMgY29udGV4dCB0byBvcGVuIHByb3Blcmx5XG5cdFx0XHRcdFx0XHRhcmdzID0gWy4uLmFyZ3MsIGVdO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoaXRlbS5jb21tYW5kLmlkLCAuLi5hcmdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoaXNMb2FkTW9yZUNvbW1hbmQoaXRlbSkpIHtcblx0XHRcdFx0dGhpcy5sb2FkTW9yZShpdGVtKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGxvYWRNb3JlKGl0ZW06IExvYWRNb3JlQ29tbWFuZCkge1xuXHRcdGlmIChpdGVtLmxvYWRpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpdGVtLmxvYWRpbmcgPSB0cnVlO1xuXHRcdHRoaXMudHJlZS5yZXJlbmRlcihpdGVtKTtcblxuXHRcdGlmICh0aGlzLnBlbmRpbmdSZXF1ZXN0cy5zaXplICE9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbWF4SXRlbUNvdW50ID0gdGhpcy5fdmlzaWJsZUl0ZW1Db3VudCArIHRoaXMucGFnZVNpemU7XG5cdFx0dGhpcy5sb2FkVGltZWxpbmUoZmFsc2UpO1xuXHR9XG5cblx0ZW5zdXJlVmFsaWRJdGVtcygpIHtcblx0XHQvLyBJZiB3ZSBkb24ndCBoYXZlIGFueSBub24tZXhjbHVkZWQgdGltZWxpbmVzLCBjbGVhciB0aGUgdHJlZSBhbmQgc2hvdyB0aGUgbG9hZGluZyBtZXNzYWdlXG5cdFx0aWYgKCF0aGlzLmhhc1Zpc2libGVJdGVtcyB8fCAhdGhpcy50aW1lbGluZVNlcnZpY2UuZ2V0U291cmNlcygpLnNvbWUoKHsgaWQgfSkgPT4gIXRoaXMuZXhjbHVkZWRTb3VyY2VzLmhhcyhpZCkgJiYgdGhpcy50aW1lbGluZXNCeVNvdXJjZS5oYXMoaWQpKSkge1xuXHRcdFx0dGhpcy50cmVlLnNldENoaWxkcmVuKG51bGwsIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9pc0VtcHR5ID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy5zZXRMb2FkaW5nVXJpTWVzc2FnZSgpO1xuXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRzZXRMb2FkaW5nVXJpTWVzc2FnZSgpIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy51cmkgJiYgdGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh0aGlzLnVyaSk7XG5cdFx0dGhpcy51cGRhdGVGaWxlbmFtZShmaWxlKTtcblx0XHR0aGlzLm1lc3NhZ2UgPSBmaWxlID8gbG9jYWxpemUoJ3RpbWVsaW5lLmxvYWRpbmcnLCBcIkxvYWRpbmcgdGltZWxpbmUgZm9yIHswfS4uLlwiLCBmaWxlKSA6ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbnRleHRNZW51KGNvbW1hbmRzOiBUaW1lbGluZVBhbmVDb21tYW5kcywgdHJlZUV2ZW50OiBJVHJlZUNvbnRleHRNZW51RXZlbnQ8VHJlZUVsZW1lbnQgfCBudWxsPik6IHZvaWQge1xuXHRcdGNvbnN0IGl0ZW0gPSB0cmVlRXZlbnQuZWxlbWVudDtcblx0XHRpZiAoaXRlbSA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBldmVudDogVUlFdmVudCA9IHRyZWVFdmVudC5icm93c2VyRXZlbnQ7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0aWYgKCF0aGlzLmVuc3VyZVZhbGlkSXRlbXMoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbaXRlbV0pO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBjb21tYW5kcy5nZXRJdGVtQ29udGV4dEFjdGlvbnMoaXRlbSk7XG5cdFx0aWYgKCFhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IHRyZWVFdmVudC5hbmNob3IsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb25zLFxuXHRcdFx0Z2V0QWN0aW9uVmlld0l0ZW06IChhY3Rpb24pID0+IHtcblx0XHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpO1xuXHRcdFx0XHRpZiAoa2V5YmluZGluZykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBhY3Rpb24sIHsgbGFiZWw6IHRydWUsIGtleWJpbmRpbmc6IGtleWJpbmRpbmcuZ2V0TGFiZWwoKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKHdhc0NhbmNlbGxlZD86IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0aWYgKHdhc0NhbmNlbGxlZCkge1xuXHRcdFx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpOiBUaW1lbGluZUFjdGlvbkNvbnRleHQgPT4gKHsgdXJpOiB0aGlzLnVyaSwgaXRlbSB9KSxcblx0XHRcdGFjdGlvblJ1bm5lcjogbmV3IFRpbWVsaW5lQWN0aW9uUnVubmVyKClcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBUaW1lbGluZUVsZW1lbnRUZW1wbGF0ZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ1RpbWVsaW5lRWxlbWVudFRlbXBsYXRlJztcblxuXHRyZWFkb25seSBhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0cmVhZG9ubHkgaWNvbjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGljb25MYWJlbDogSWNvbkxhYmVsO1xuXHRyZWFkb25seSB0aW1lc3RhbXA6IEhUTUxTcGFuRWxlbWVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IElBY3Rpb25WaWV3SXRlbVByb3ZpZGVyLFxuXHRcdGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLFxuXHQpIHtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnY3VzdG9tLXZpZXctdHJlZS1ub2RlLWl0ZW0nKTtcblx0XHR0aGlzLmljb24gPSBET00uYXBwZW5kKGNvbnRhaW5lciwgRE9NLiQoJy5jdXN0b20tdmlldy10cmVlLW5vZGUtaXRlbS1pY29uJykpO1xuXG5cdFx0dGhpcy5pY29uTGFiZWwgPSBuZXcgSWNvbkxhYmVsKGNvbnRhaW5lciwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSwgc3VwcG9ydEljb25zOiB0cnVlLCBob3ZlckRlbGVnYXRlIH0pO1xuXG5cdFx0Y29uc3QgdGltZXN0YW1wQ29udGFpbmVyID0gRE9NLmFwcGVuZCh0aGlzLmljb25MYWJlbC5lbGVtZW50LCBET00uJCgnLnRpbWVsaW5lLXRpbWVzdGFtcC1jb250YWluZXInKSk7XG5cdFx0dGhpcy50aW1lc3RhbXAgPSBET00uYXBwZW5kKHRpbWVzdGFtcENvbnRhaW5lciwgRE9NLiQoJ3NwYW4udGltZWxpbmUtdGltZXN0YW1wJykpO1xuXG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IERPTS5hcHBlbmQodGhpcy5pY29uTGFiZWwuZWxlbWVudCwgRE9NLiQoJy5hY3Rpb25zJykpO1xuXHRcdHRoaXMuYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihhY3Rpb25zQ29udGFpbmVyLCB7IGFjdGlvblZpZXdJdGVtUHJvdmlkZXIgfSk7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuaWNvbkxhYmVsLmRpc3Bvc2UoKTtcblx0XHR0aGlzLmFjdGlvbkJhci5kaXNwb3NlKCk7XG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLmljb24uY2xhc3NOYW1lID0gJyc7XG5cdFx0dGhpcy5pY29uLnN0eWxlLmJhY2tncm91bmRJbWFnZSA9ICcnO1xuXHRcdHRoaXMuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRpbWVsaW5lSWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPFRyZWVFbGVtZW50PiB7XG5cdGdldElkKGl0ZW06IFRyZWVFbGVtZW50KTogeyB0b1N0cmluZygpOiBzdHJpbmcgfSB7XG5cdFx0cmV0dXJuIGl0ZW0uaGFuZGxlO1xuXHR9XG59XG5cbmNsYXNzIFRpbWVsaW5lQWN0aW9uUnVubmVyIGV4dGVuZHMgQWN0aW9uUnVubmVyIHtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgcnVuQWN0aW9uKGFjdGlvbjogSUFjdGlvbiwgeyB1cmksIGl0ZW0gfTogVGltZWxpbmVBY3Rpb25Db250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFpc1RpbWVsaW5lSXRlbShpdGVtKSkge1xuXHRcdFx0Ly8gVE9ET0BlYW1vZGlvIGRvIHdlIG5lZWQgdG8gZG8gYW55dGhpbmcgZWxzZT9cblx0XHRcdGF3YWl0IGFjdGlvbi5ydW4oKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCBhY3Rpb24ucnVuKFxuXHRcdFx0e1xuXHRcdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuVGltZWxpbmVBY3Rpb25Db250ZXh0LFxuXHRcdFx0XHRoYW5kbGU6IGl0ZW0uaGFuZGxlLFxuXHRcdFx0XHRzb3VyY2U6IGl0ZW0uc291cmNlLFxuXHRcdFx0XHR1cmlcblx0XHRcdH0sXG5cdFx0XHR1cmksXG5cdFx0XHRpdGVtLnNvdXJjZSxcblx0XHQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUaW1lbGluZUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIgaW1wbGVtZW50cyBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlcjxUcmVlRWxlbWVudD4ge1xuXHRnZXRLZXlib2FyZE5hdmlnYXRpb25MYWJlbChlbGVtZW50OiBUcmVlRWxlbWVudCk6IHsgdG9TdHJpbmcoKTogc3RyaW5nIH0ge1xuXHRcdHJldHVybiBlbGVtZW50LmxhYmVsO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUaW1lbGluZUxpc3RWaXJ0dWFsRGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUcmVlRWxlbWVudD4ge1xuXHRnZXRIZWlnaHQoX2VsZW1lbnQ6IFRyZWVFbGVtZW50KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gSXRlbUhlaWdodDtcblx0fVxuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBzdHJpbmcge1xuXHRcdHJldHVybiBUaW1lbGluZUVsZW1lbnRUZW1wbGF0ZS5pZDtcblx0fVxufVxuXG5jbGFzcyBUaW1lbGluZVRyZWVSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8VHJlZUVsZW1lbnQsIEZ1enp5U2NvcmUsIFRpbWVsaW5lRWxlbWVudFRlbXBsYXRlPiB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2Nyb2xsVG9FbmQgPSBuZXcgRW1pdHRlcjxMb2FkTW9yZUNvbW1hbmQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkU2Nyb2xsVG9FbmQ6IEV2ZW50PExvYWRNb3JlQ29tbWFuZD4gPSB0aGlzLl9vbkRpZFNjcm9sbFRvRW5kLmV2ZW50O1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFRpbWVsaW5lRWxlbWVudFRlbXBsYXRlLmlkO1xuXG5cdHByaXZhdGUgX2hvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlO1xuXG5cdHByaXZhdGUgYWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogSUFjdGlvblZpZXdJdGVtUHJvdmlkZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb21tYW5kczogVGltZWxpbmVQYW5lQ29tbWFuZHMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyID0gY3JlYXRlQWN0aW9uVmlld0l0ZW0uYmluZCh1bmRlZmluZWQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuX2hvdmVyRGVsZWdhdGUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaEhvdmVyRGVsZWdhdGUsICdlbGVtZW50JywgeyBpbnN0YW50SG92ZXI6IHRydWUgfSwge1xuXHRcdFx0cG9zaXRpb246IHtcblx0XHRcdFx0aG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5SSUdIVCAvLyBXaWxsIGZsaXAgd2hlbiB0aGVyZSdzIG5vIHNwYWNlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHVyaTogVVJJIHwgdW5kZWZpbmVkO1xuXHRzZXRVcmkodXJpOiBVUkkgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLnVyaSA9IHVyaTtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBUaW1lbGluZUVsZW1lbnRUZW1wbGF0ZSB7XG5cdFx0cmV0dXJuIG5ldyBUaW1lbGluZUVsZW1lbnRUZW1wbGF0ZShjb250YWluZXIsIHRoaXMuYWN0aW9uVmlld0l0ZW1Qcm92aWRlciwgdGhpcy5faG92ZXJEZWxlZ2F0ZSk7XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KFxuXHRcdG5vZGU6IElUcmVlTm9kZTxUcmVlRWxlbWVudCwgRnV6enlTY29yZT4sXG5cdFx0aW5kZXg6IG51bWJlcixcblx0XHR0ZW1wbGF0ZTogVGltZWxpbmVFbGVtZW50VGVtcGxhdGUsXG5cdFx0aGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWRcblx0KTogdm9pZCB7XG5cdFx0dGVtcGxhdGUucmVzZXQoKTtcblxuXHRcdGNvbnN0IHsgZWxlbWVudDogaXRlbSB9ID0gbm9kZTtcblxuXHRcdGNvbnN0IHRoZW1lID0gdGhpcy50aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXHRcdGNvbnN0IGljb24gPSB0aGVtZS50eXBlID09PSBDb2xvclNjaGVtZS5MSUdIVCA/IGl0ZW0uaWNvbiA6IGl0ZW0uaWNvbkRhcms7XG5cdFx0Y29uc3QgaWNvblVybCA9IGljb24gPyBVUkkucmV2aXZlKGljb24pIDogbnVsbDtcblxuXHRcdGlmIChpY29uVXJsKSB7XG5cdFx0XHR0ZW1wbGF0ZS5pY29uLmNsYXNzTmFtZSA9ICdjdXN0b20tdmlldy10cmVlLW5vZGUtaXRlbS1pY29uJztcblx0XHRcdHRlbXBsYXRlLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gY3NzLmFzQ1NTVXJsKGljb25VcmwpO1xuXHRcdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5jb2xvciA9ICcnO1xuXHRcdH0gZWxzZSBpZiAoaXRlbS50aGVtZUljb24pIHtcblx0XHRcdHRlbXBsYXRlLmljb24uY2xhc3NOYW1lID0gYGN1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLWljb24gJHtUaGVtZUljb24uYXNDbGFzc05hbWUoaXRlbS50aGVtZUljb24pfWA7XG5cdFx0XHRpZiAoaXRlbS50aGVtZUljb24uY29sb3IpIHtcblx0XHRcdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5jb2xvciA9IHRoZW1lLmdldENvbG9yKGl0ZW0udGhlbWVJY29uLmNvbG9yLmlkKT8udG9TdHJpbmcoKSA/PyAnJztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRlbXBsYXRlLmljb24uc3R5bGUuY29sb3IgPSAnJztcblx0XHRcdH1cblx0XHRcdHRlbXBsYXRlLmljb24uc3R5bGUuYmFja2dyb3VuZEltYWdlID0gJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlLmljb24uY2xhc3NOYW1lID0gJ2N1c3RvbS12aWV3LXRyZWUtbm9kZS1pdGVtLWljb24nO1xuXHRcdFx0dGVtcGxhdGUuaWNvbi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSAnJztcblx0XHRcdHRlbXBsYXRlLmljb24uc3R5bGUuY29sb3IgPSAnJztcblx0XHR9XG5cdFx0Y29uc3QgdG9vbHRpcCA9IGl0ZW0udG9vbHRpcFxuXHRcdFx0PyBpc1N0cmluZyhpdGVtLnRvb2x0aXApXG5cdFx0XHRcdD8gaXRlbS50b29sdGlwXG5cdFx0XHRcdDogeyBtYXJrZG93bjogaXRlbS50b29sdGlwLCBtYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrOiByZW5kZXJNYXJrZG93bkFzUGxhaW50ZXh0KGl0ZW0udG9vbHRpcCkgfVxuXHRcdFx0OiB1bmRlZmluZWQ7XG5cblx0XHR0ZW1wbGF0ZS5pY29uTGFiZWwuc2V0TGFiZWwoaXRlbS5sYWJlbCwgaXRlbS5kZXNjcmlwdGlvbiwge1xuXHRcdFx0dGl0bGU6IHRvb2x0aXAsXG5cdFx0XHRtYXRjaGVzOiBjcmVhdGVNYXRjaGVzKG5vZGUuZmlsdGVyRGF0YSlcblx0XHR9KTtcblxuXHRcdHRlbXBsYXRlLnRpbWVzdGFtcC50ZXh0Q29udGVudCA9IGl0ZW0ucmVsYXRpdmVUaW1lID8/ICcnO1xuXHRcdHRlbXBsYXRlLnRpbWVzdGFtcC5hcmlhTGFiZWwgPSBpdGVtLnJlbGF0aXZlVGltZUZ1bGxXb3JkID8/ICcnO1xuXHRcdHRlbXBsYXRlLnRpbWVzdGFtcC5wYXJlbnRFbGVtZW50IS5jbGFzc0xpc3QudG9nZ2xlKCd0aW1lbGluZS10aW1lc3RhbXAtLWR1cGxpY2F0ZScsIGlzVGltZWxpbmVJdGVtKGl0ZW0pICYmIGl0ZW0uaGlkZVJlbGF0aXZlVGltZSk7XG5cblx0XHR0ZW1wbGF0ZS5hY3Rpb25CYXIuY29udGV4dCA9IHsgdXJpOiB0aGlzLnVyaSwgaXRlbSB9IHNhdGlzZmllcyBUaW1lbGluZUFjdGlvbkNvbnRleHQ7XG5cdFx0dGVtcGxhdGUuYWN0aW9uQmFyLmFjdGlvblJ1bm5lciA9IG5ldyBUaW1lbGluZUFjdGlvblJ1bm5lcigpO1xuXHRcdHRlbXBsYXRlLmFjdGlvbkJhci5wdXNoKHRoaXMuY29tbWFuZHMuZ2V0SXRlbUFjdGlvbnMoaXRlbSksIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IGZhbHNlIH0pO1xuXG5cdFx0Ly8gSWYgd2UgYXJlIHJlbmRlcmluZyB0aGUgbG9hZCBtb3JlIGl0ZW0sIHdlJ3ZlIHNjcm9sbGVkIHRvIHRoZSBlbmQsIHNvIHRyaWdnZXIgYW4gZXZlbnRcblx0XHRpZiAoaXNMb2FkTW9yZUNvbW1hbmQoaXRlbSkpIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fb25EaWRTY3JvbGxUb0VuZC5maXJlKGl0ZW0pLCAwKTtcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8VHJlZUVsZW1lbnQsIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IFRpbWVsaW5lRWxlbWVudFRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuYWN0aW9uUnVubmVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZTogVGltZWxpbmVFbGVtZW50VGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZS5kaXNwb3NlKCk7XG5cdH1cbn1cblxuXG5jb25zdCB0aW1lbGluZVJlZnJlc2ggPSByZWdpc3Rlckljb24oJ3RpbWVsaW5lLXJlZnJlc2gnLCBDb2RpY29uLnJlZnJlc2gsIGxvY2FsaXplKCd0aW1lbGluZVJlZnJlc2gnLCAnSWNvbiBmb3IgdGhlIHJlZnJlc2ggdGltZWxpbmUgYWN0aW9uLicpKTtcbmNvbnN0IHRpbWVsaW5lUGluID0gcmVnaXN0ZXJJY29uKCd0aW1lbGluZS1waW4nLCBDb2RpY29uLnBpbiwgbG9jYWxpemUoJ3RpbWVsaW5lUGluJywgJ0ljb24gZm9yIHRoZSBwaW4gdGltZWxpbmUgYWN0aW9uLicpKTtcbmNvbnN0IHRpbWVsaW5lVW5waW4gPSByZWdpc3Rlckljb24oJ3RpbWVsaW5lLXVucGluJywgQ29kaWNvbi5waW5uZWQsIGxvY2FsaXplKCd0aW1lbGluZVVucGluJywgJ0ljb24gZm9yIHRoZSB1bnBpbiB0aW1lbGluZSBhY3Rpb24uJykpO1xuXG5jbGFzcyBUaW1lbGluZVBhbmVDb21tYW5kcyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IHNvdXJjZURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYW5lOiBUaW1lbGluZVBhbmUsXG5cdFx0QElUaW1lbGluZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0aW1lbGluZVNlcnZpY2U6IElUaW1lbGluZVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNvdXJjZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3RpbWVsaW5lLnJlZnJlc2gnLFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlZnJlc2gnLCBcIlJlZnJlc2hcIiksXG5cdFx0XHRcdFx0aWNvbjogdGltZWxpbmVSZWZyZXNoLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBsb2NhbGl6ZTIoJ3RpbWVsaW5lJywgXCJUaW1lbGluZVwiKSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlRpbWVsaW5lVGl0bGUsXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDk5LFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRcdHBhbmUucmVzZXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgndGltZWxpbmUudG9nZ2xlRm9sbG93QWN0aXZlRWRpdG9yJyxcblx0XHRcdChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pID0+IHBhbmUuZm9sbG93QWN0aXZlRWRpdG9yID0gIXBhbmUuZm9sbG93QWN0aXZlRWRpdG9yXG5cdFx0KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlRpbWVsaW5lVGl0bGUsICh7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAndGltZWxpbmUudG9nZ2xlRm9sbG93QWN0aXZlRWRpdG9yJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGltZWxpbmUudG9nZ2xlRm9sbG93QWN0aXZlRWRpdG9yQ29tbWFuZC5mb2xsb3cnLCAnUGluIHRoZSBDdXJyZW50IFRpbWVsaW5lJyksXG5cdFx0XHRcdGljb246IHRpbWVsaW5lUGluLFxuXHRcdFx0XHRjYXRlZ29yeTogbG9jYWxpemUyKCd0aW1lbGluZScsIFwiVGltZWxpbmVcIiksXG5cdFx0XHR9LFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiA5OCxcblx0XHRcdHdoZW46IFRpbWVsaW5lRm9sbG93QWN0aXZlRWRpdG9yQ29udGV4dFxuXHRcdH0pKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlRpbWVsaW5lVGl0bGUsICh7XG5cdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAndGltZWxpbmUudG9nZ2xlRm9sbG93QWN0aXZlRWRpdG9yJyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndGltZWxpbmUudG9nZ2xlRm9sbG93QWN0aXZlRWRpdG9yQ29tbWFuZC51bmZvbGxvdycsICdVbnBpbiB0aGUgQ3VycmVudCBUaW1lbGluZScpLFxuXHRcdFx0XHRpY29uOiB0aW1lbGluZVVucGluLFxuXHRcdFx0XHRjYXRlZ29yeTogbG9jYWxpemUyKCd0aW1lbGluZScsIFwiVGltZWxpbmVcIiksXG5cdFx0XHR9LFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiA5OCxcblx0XHRcdHdoZW46IFRpbWVsaW5lRm9sbG93QWN0aXZlRWRpdG9yQ29udGV4dC50b05lZ2F0ZWQoKVxuXHRcdH0pKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aW1lbGluZVNlcnZpY2Uub25EaWRDaGFuZ2VQcm92aWRlcnMoKCkgPT4gdGhpcy51cGRhdGVUaW1lbGluZVNvdXJjZUZpbHRlcnMoKSkpO1xuXHRcdHRoaXMudXBkYXRlVGltZWxpbmVTb3VyY2VGaWx0ZXJzKCk7XG5cdH1cblxuXHRnZXRJdGVtQWN0aW9ucyhlbGVtZW50OiBUcmVlRWxlbWVudCk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWN0aW9ucyhNZW51SWQuVGltZWxpbmVJdGVtQ29udGV4dCwgeyBrZXk6ICd0aW1lbGluZUl0ZW0nLCB2YWx1ZTogZWxlbWVudC5jb250ZXh0VmFsdWUgfSkucHJpbWFyeTtcblx0fVxuXG5cdGdldEl0ZW1Db250ZXh0QWN0aW9ucyhlbGVtZW50OiBUcmVlRWxlbWVudCk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWN0aW9ucyhNZW51SWQuVGltZWxpbmVJdGVtQ29udGV4dCwgeyBrZXk6ICd0aW1lbGluZUl0ZW0nLCB2YWx1ZTogZWxlbWVudC5jb250ZXh0VmFsdWUgfSkuc2Vjb25kYXJ5O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBY3Rpb25zKG1lbnVJZDogTWVudUlkLCBjb250ZXh0OiB7IGtleTogc3RyaW5nOyB2YWx1ZT86IHN0cmluZyB9KTogeyBwcmltYXJ5OiBJQWN0aW9uW107IHNlY29uZGFyeTogSUFjdGlvbltdIH0ge1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KFtcblx0XHRcdFsndmlldycsIHRoaXMucGFuZS5pZF0sXG5cdFx0XHRbY29udGV4dC5rZXksIGNvbnRleHQudmFsdWVdLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMobWVudUlkLCBjb250ZXh0S2V5U2VydmljZSwgeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gZ2V0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUsICdpbmxpbmUnKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVGltZWxpbmVTb3VyY2VGaWx0ZXJzKCkge1xuXHRcdHRoaXMuc291cmNlRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdGNvbnN0IGV4Y2x1ZGVkID0gbmV3IFNldChKU09OLnBhcnNlKHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KCd0aW1lbGluZS5leGNsdWRlU291cmNlcycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCAnW10nKSkpO1xuXHRcdGZvciAoY29uc3Qgc291cmNlIG9mIHRoaXMudGltZWxpbmVTZXJ2aWNlLmdldFNvdXJjZXMoKSkge1xuXHRcdFx0dGhpcy5zb3VyY2VEaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkOiBgdGltZWxpbmUudG9nZ2xlRXhjbHVkZVNvdXJjZToke3NvdXJjZS5pZH1gLFxuXHRcdFx0XHRcdFx0dGl0bGU6IHNvdXJjZS5sYWJlbCxcblx0XHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5UaW1lbGluZUZpbHRlclN1Yk1lbnUsXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dG9nZ2xlZDogQ29udGV4dEtleUV4cHIucmVnZXgoYHRpbWVsaW5lRXhjbHVkZVNvdXJjZXNgLCBuZXcgUmVnRXhwKGBcXFxcYiR7ZXNjYXBlUmVnRXhwQ2hhcmFjdGVycyhzb3VyY2UuaWQpfVxcXFxiYCkpLm5lZ2F0ZSgpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdFx0XHRcdGlmIChleGNsdWRlZC5oYXMoc291cmNlLmlkKSkge1xuXHRcdFx0XHRcdFx0ZXhjbHVkZWQuZGVsZXRlKHNvdXJjZS5pZCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGV4Y2x1ZGVkLmFkZChzb3VyY2UuaWQpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cdFx0XHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ3RpbWVsaW5lLmV4Y2x1ZGVTb3VyY2VzJywgSlNPTi5zdHJpbmdpZnkoWy4uLmV4Y2x1ZGVkLmtleXMoKV0pLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxZQUFZLFNBQVM7QUFDckIsWUFBWSxTQUFTO0FBQ3JCLFNBQWtCLG9CQUFvQjtBQUN0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFzQjtBQUMvQixTQUFxQixxQkFBcUI7QUFDMUMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBOEIsa0JBQWtCO0FBQ3pELFNBQVMsZUFBZTtBQUN4QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxpQkFBaUI7QUFHMUIsU0FBUyxnQkFBa0M7QUFDM0MsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQkFBZ0Isb0JBQW9CLHFCQUFrQztBQUMvRSxTQUFTLDZCQUF3RDtBQUNqRSxTQUFTLDZCQUErQztBQUN4RCxTQUFTLHdCQUFxSTtBQUM5SSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQiw4QkFBOEI7QUFDekQsU0FBUyxpQkFBaUIsd0JBQXdCO0FBQ2xELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsaUJBQTBDO0FBQ25ELFNBQVMsdUJBQXVCLDRCQUE0QjtBQUM1RCxTQUFTLGNBQWMsUUFBUSxpQkFBaUIsU0FBUyxvQkFBb0I7QUFDN0UsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFB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WCxPQUFPO0FBQUEsWUFDUjtBQUFBLFlBQ0EsU0FBUyxlQUFlLE1BQU0sMEJBQTBCLElBQUksT0FBTyxNQUFNLHVCQUF1QixPQUFPLEVBQUUsQ0FBQyxLQUFLLENBQUMsRUFBRSxPQUFPO0FBQUEsVUFDMUgsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxRQUNBLElBQUksYUFBK0IsTUFBYTtBQUMvQyxjQUFJLFNBQVMsSUFBSSxPQUFPLEVBQUUsR0FBRztBQUM1QixxQkFBUyxPQUFPLE9BQU8sRUFBRTtBQUFBLFVBQzFCLE9BQU87QUFDTixxQkFBUyxJQUFJLE9BQU8sRUFBRTtBQUFBLFVBQ3ZCO0FBRUEsZ0JBQU0saUJBQWlCLFNBQVMsSUFBSSxlQUFlO0FBQ25ELHlCQUFlLE1BQU0sMkJBQTJCLEtBQUssVUFBVSxDQUFDLEdBQUcsU0FBUyxLQUFLLENBQUMsQ0FBQyxHQUFHLGFBQWEsU0FBUyxjQUFjLElBQUk7QUFBQSxRQUMvSDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFDRDtBQWpITSx1QkFBTjtBQUFBLEVBS0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVJHOyIsCiAgIm5hbWVzIjogWyJpdGVtIiwgImdldE5leHRNb3N0UmVjZW50U291cmNlIl0KfQo=
