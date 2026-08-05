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
import "./media/panel.css";
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { basename } from "../../../../base/common/resources.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { CommentNode, ResourceWithCommentThreads } from "../common/commentModel.js";
import { ICommentService } from "./commentService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ResourceLabels } from "../../../browser/labels.js";
import { CommentsList, COMMENTS_VIEW_TITLE, Filter } from "./commentsTreeViewer.js";
import { FilterViewPane } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { CommentsViewFilterFocusContextKey } from "./comments.js";
import { CommentsFilters, CommentsSortOrder } from "./commentsViewActions.js";
import { Memento } from "../../../common/memento.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { FilterOptions } from "./commentsFilterOptions.js";
import { CommentThreadApplicability, CommentThreadState } from "../../../../editor/common/languages.js";
import { revealCommentThread } from "./commentsController.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { CommentsModel, threadHasMeaningfulComments } from "./commentsModel.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { AccessibilityVerbositySettingId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { AccessibleViewAction } from "../../accessibility/browser/accessibleViewActions.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
const CONTEXT_KEY_HAS_COMMENTS = new RawContextKey("commentsView.hasComments", false);
const CONTEXT_KEY_SOME_COMMENTS_EXPANDED = new RawContextKey("commentsView.someCommentsExpanded", false);
const CONTEXT_KEY_COMMENT_FOCUSED = new RawContextKey("commentsView.commentFocused", false);
const VIEW_STORAGE_ID = "commentsViewState";
function createResourceCommentsIterator(model) {
  const result = [];
  for (const m of model.resourceCommentThreads) {
    const children = [];
    for (const r of m.commentThreads) {
      if (threadHasMeaningfulComments(r.thread)) {
        children.push({ element: r });
      }
    }
    if (children.length > 0) {
      result.push({ element: m, children });
    }
  }
  return result;
}
let CommentsPanel = class extends FilterViewPane {
  constructor(options, instantiationService, viewDescriptorService, editorService, configurationService, contextKeyService, contextMenuService, keybindingService, openerService, themeService, commentService, hoverService, uriIdentityService, storageService, pathService) {
    const stateMemento = new Memento(VIEW_STORAGE_ID, storageService);
    const viewState = stateMemento.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    super({
      ...options,
      filterOptions: {
        placeholder: nls.localize("comments.filter.placeholder", "Filter (e.g. text, author)"),
        ariaLabel: nls.localize("comments.filter.ariaLabel", "Filter comments"),
        history: viewState["filterHistory"] || [],
        text: viewState["filter"] || "",
        focusContextKey: CommentsViewFilterFocusContextKey.key
      }
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.editorService = editorService;
    this.commentService = commentService;
    this.uriIdentityService = uriIdentityService;
    this.pathService = pathService;
    this.totalComments = 0;
    this.currentHeight = 0;
    this.currentWidth = 0;
    this.cachedFilterStats = void 0;
    this.onDidChangeVisibility = this.onDidChangeBodyVisibility;
    this.hasCommentsContextKey = CONTEXT_KEY_HAS_COMMENTS.bindTo(contextKeyService);
    this.someCommentsExpandedContextKey = CONTEXT_KEY_SOME_COMMENTS_EXPANDED.bindTo(contextKeyService);
    this.commentsFocusedContextKey = CONTEXT_KEY_COMMENT_FOCUSED.bindTo(contextKeyService);
    this.stateMemento = stateMemento;
    this.viewState = viewState;
    this.filters = this._register(new CommentsFilters({
      showResolved: this.viewState["showResolved"] !== false,
      showUnresolved: this.viewState["showUnresolved"] !== false,
      sortBy: this.viewState["sortBy"] ?? CommentsSortOrder.ResourceAscending
    }, this.contextKeyService));
    this.filter = new Filter(new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved));
    this._register(this.filters.onDidChange((event) => {
      if (event.showResolved || event.showUnresolved) {
        this.updateFilter();
      }
      if (event.sortBy) {
        this.refresh();
      }
    }));
    this._register(this.filterWidget.onDidChangeFilterText(() => this.updateFilter()));
  }
  get focusedCommentNode() {
    const focused = this.tree?.getFocus();
    if (focused?.length === 1 && focused[0] instanceof CommentNode) {
      return focused[0];
    }
    return void 0;
  }
  get focusedCommentInfo() {
    if (!this.focusedCommentNode) {
      return;
    }
    return this.getScreenReaderInfoForNode(this.focusedCommentNode);
  }
  focusNextNode() {
    if (!this.tree) {
      return;
    }
    const focused = this.tree.getFocus()?.[0];
    if (!focused) {
      return;
    }
    let next = this.tree.navigate(focused).next();
    while (next && !(next instanceof CommentNode)) {
      next = this.tree.navigate(next).next();
    }
    if (!next) {
      return;
    }
    this.tree.setFocus([next]);
  }
  focusPreviousNode() {
    if (!this.tree) {
      return;
    }
    const focused = this.tree.getFocus()?.[0];
    if (!focused) {
      return;
    }
    let previous = this.tree.navigate(focused).previous();
    while (previous && !(previous instanceof CommentNode)) {
      previous = this.tree.navigate(previous).previous();
    }
    if (!previous) {
      return;
    }
    this.tree.setFocus([previous]);
  }
  saveState() {
    this.viewState["filter"] = this.filterWidget.getFilterText();
    this.viewState["filterHistory"] = this.filterWidget.getHistory();
    this.viewState["showResolved"] = this.filters.showResolved;
    this.viewState["showUnresolved"] = this.filters.showUnresolved;
    this.viewState["sortBy"] = this.filters.sortBy;
    this.stateMemento.saveMemento();
    super.saveState();
  }
  render() {
    super.render();
    this._register(registerNavigableContainer({
      name: "commentsView",
      focusNotifiers: [this, this.filterWidget],
      focusNextWidget: () => {
        if (this.filterWidget.hasFocus()) {
          this.focus();
        }
      },
      focusPreviousWidget: () => {
        if (!this.filterWidget.hasFocus()) {
          this.focusFilter();
        }
      }
    }));
  }
  focusFilter() {
    this.filterWidget.focus();
  }
  clearFilterText() {
    this.filterWidget.setFilterText("");
  }
  getFilterStats() {
    if (!this.cachedFilterStats) {
      this.cachedFilterStats = {
        total: this.totalComments,
        filtered: this.tree?.getVisibleItemCount() ?? 0
      };
    }
    return this.cachedFilterStats;
  }
  updateFilter() {
    this.filter.options = new FilterOptions(this.filterWidget.getFilterText(), this.filters.showResolved, this.filters.showUnresolved);
    this.tree?.filterComments();
    this.cachedFilterStats = void 0;
    const { total, filtered } = this.getFilterStats();
    this.filterWidget.updateBadge(total === filtered || total === 0 ? void 0 : nls.localize("showing filtered results", "Showing {0} of {1}", filtered, total));
    this.filterWidget.checkMoreFilters(!this.filters.showResolved || !this.filters.showUnresolved);
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("comments-panel");
    const domContainer = dom.append(container, dom.$(".comments-panel-container"));
    this.treeContainer = dom.append(domContainer, dom.$(".tree-container"));
    this.treeContainer.classList.add("file-icon-themable-tree", "show-file-icons");
    this.cachedFilterStats = void 0;
    this.createTree();
    this.createMessageBox(domContainer);
    this._register(this.commentService.onDidSetAllCommentThreads(this.onAllCommentsChanged, this));
    this._register(this.commentService.onDidUpdateCommentThreads(this.onCommentsUpdated, this));
    this._register(this.commentService.onDidDeleteDataProvider(this.onDataProviderDeleted, this));
    this._register(this.onDidChangeBodyVisibility((visible) => {
      if (visible) {
        this.refresh();
      }
    }));
    this.renderComments();
  }
  focus() {
    super.focus();
    const element = this.tree?.getHTMLElement();
    if (element && dom.isActiveElement(element)) {
      return;
    }
    if (!this.commentService.commentsModel.hasCommentThreads() && this.messageBoxContainer) {
      this.messageBoxContainer.focus();
    } else if (this.tree) {
      this.tree.domFocus();
    }
  }
  renderComments() {
    this.treeContainer.classList.toggle("hidden", !this.commentService.commentsModel.hasCommentThreads());
    this.renderMessage();
    this.tree?.setChildren(null, createResourceCommentsIterator(this.commentService.commentsModel));
  }
  collapseAll() {
    if (this.tree) {
      this.tree.collapseAll();
      this.tree.setSelection([]);
      this.tree.setFocus([]);
      this.tree.domFocus();
      this.tree.focusFirst();
    }
  }
  expandAll() {
    if (this.tree) {
      this.tree.expandAll();
      this.tree.setSelection([]);
      this.tree.setFocus([]);
      this.tree.domFocus();
      this.tree.focusFirst();
    }
  }
  get hasRendered() {
    return !!this.tree;
  }
  layoutBodyContent(height = this.currentHeight, width = this.currentWidth) {
    if (this.messageBoxContainer) {
      this.messageBoxContainer.style.height = `${height}px`;
    }
    this.tree?.layout(height, width);
    this.currentHeight = height;
    this.currentWidth = width;
  }
  createMessageBox(parent) {
    this.messageBoxContainer = dom.append(parent, dom.$(".message-box-container"));
    this.messageBoxContainer.setAttribute("tabIndex", "0");
  }
  renderMessage() {
    this.messageBoxContainer.textContent = this.commentService.commentsModel.getMessage();
    this.messageBoxContainer.classList.toggle("hidden", this.commentService.commentsModel.hasCommentThreads());
  }
  makeCommentLocationLabel(file, range) {
    const fileLabel = basename(file);
    if (!range) {
      return nls.localize("fileCommentLabel", "in {0}", fileLabel);
    }
    if (range.startLineNumber === range.endLineNumber) {
      return nls.localize("oneLineCommentLabel", "at line {0} column {1} in {2}", range.startLineNumber, range.startColumn, fileLabel);
    } else {
      return nls.localize("multiLineCommentLabel", "from line {0} to line {1} in {2}", range.startLineNumber, range.endLineNumber, fileLabel);
    }
  }
  makeScreenReaderLabelInfo(element, forAriaLabel) {
    const userName = element.comment.userName;
    const locationLabel = this.makeCommentLocationLabel(element.resource, element.range);
    const replyCountLabel = this.getReplyCountAsString(element, forAriaLabel);
    const bodyLabel = typeof element.comment.body === "string" ? element.comment.body : element.comment.body.value;
    return { userName, locationLabel, replyCountLabel, bodyLabel };
  }
  getScreenReaderInfoForNode(element, forAriaLabel) {
    let accessibleViewHint = "";
    if (forAriaLabel && this.configurationService.getValue(AccessibilityVerbositySettingId.Comments)) {
      const kbLabel = this.keybindingService.lookupKeybinding(AccessibleViewAction.id)?.getAriaLabel();
      accessibleViewHint = kbLabel ? nls.localize("accessibleViewHint", "\nInspect this in the accessible view ({0}).", kbLabel) : nls.localize("acessibleViewHintNoKbOpen", "\nInspect this in the accessible view via the command Open Accessible View which is currently not triggerable via keybinding.");
    }
    const replies = this.getRepliesAsString(element, forAriaLabel);
    const editor = this.editorService.findEditors(element.resource);
    const codeEditor = this.editorService.activeEditorPane?.getControl();
    let relevantLines;
    if (element.range && editor?.length && isCodeEditor(codeEditor)) {
      relevantLines = codeEditor.getModel()?.getValueInRange(element.range);
      if (relevantLines) {
        relevantLines = "\nCorresponding code: \n" + relevantLines;
      }
    }
    if (!relevantLines) {
      relevantLines = "";
    }
    const labelInfo = this.makeScreenReaderLabelInfo(element, forAriaLabel);
    if (element.threadRelevance === CommentThreadApplicability.Outdated) {
      return nls.localize(
        "resourceWithCommentLabelOutdated",
        "Outdated from {0}: {1}\n{2}\n{3}\n{4}",
        labelInfo.userName,
        labelInfo.bodyLabel,
        labelInfo.locationLabel,
        labelInfo.replyCountLabel,
        relevantLines
      ) + replies + accessibleViewHint;
    } else {
      return nls.localize(
        "resourceWithCommentLabel",
        "{0}: {1}\n{2}\n{3}\n{4}",
        labelInfo.userName,
        labelInfo.bodyLabel,
        labelInfo.locationLabel,
        labelInfo.replyCountLabel,
        relevantLines
      ) + replies + accessibleViewHint;
    }
  }
  getRepliesAsString(node, forAriaLabel) {
    if (!node.replies.length || forAriaLabel) {
      return "";
    }
    return "\n" + node.replies.map(
      (reply) => nls.localize(
        "resourceWithRepliesLabel",
        "{0} {1}",
        reply.comment.userName,
        typeof reply.comment.body === "string" ? reply.comment.body : reply.comment.body.value
      )
    ).join("\n");
  }
  getReplyCountAsString(node, forAriaLabel) {
    return node.replies.length && !forAriaLabel ? nls.localize("replyCount", " {0} replies,", node.replies.length) : "";
  }
  createTree() {
    this.treeLabels = this._register(this.instantiationService.createInstance(ResourceLabels, this));
    this.tree = this._register(this.instantiationService.createInstance(CommentsList, this.treeLabels, this.treeContainer, {
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      selectionNavigation: true,
      filter: this.filter,
      sorter: {
        compare: (a, b) => {
          if (a instanceof CommentsModel || b instanceof CommentsModel) {
            return 0;
          }
          if (this.filters.sortBy === CommentsSortOrder.UpdatedAtDescending) {
            return a.lastUpdatedAt > b.lastUpdatedAt ? -1 : 1;
          } else if (this.filters.sortBy === CommentsSortOrder.ResourceAscending) {
            if (a instanceof ResourceWithCommentThreads && b instanceof ResourceWithCommentThreads) {
              const workspaceScheme = this.pathService.defaultUriScheme;
              if (a.resource.scheme !== b.resource.scheme && (a.resource.scheme === workspaceScheme || b.resource.scheme === workspaceScheme)) {
                return b.resource.scheme === workspaceScheme ? 1 : -1;
              }
              return a.resource.toString() > b.resource.toString() ? 1 : -1;
            } else if (a instanceof CommentNode && b instanceof CommentNode && a.thread.range && b.thread.range) {
              return a.thread.range?.startLineNumber > b.thread.range?.startLineNumber ? 1 : -1;
            }
          }
          return 0;
        }
      },
      keyboardNavigationLabelProvider: {
        getKeyboardNavigationLabel: (item) => {
          return void 0;
        }
      },
      accessibilityProvider: {
        getAriaLabel: (element) => {
          if (element instanceof CommentsModel) {
            return nls.localize("rootCommentsLabel", "Comments for current workspace");
          }
          if (element instanceof ResourceWithCommentThreads) {
            return nls.localize("resourceWithCommentThreadsLabel", "Comments in {0}, full path {1}", basename(element.resource), element.resource.fsPath);
          }
          if (element instanceof CommentNode) {
            return this.getScreenReaderInfoForNode(element, true);
          }
          return "";
        },
        getWidgetAriaLabel() {
          return COMMENTS_VIEW_TITLE.value;
        }
      }
    }));
    this._register(this.tree.onDidOpen((e) => {
      this.openFile(e.element, e.editorOptions.pinned, e.editorOptions.preserveFocus, e.sideBySide);
    }));
    this._register(this.tree.onDidChangeModel(() => {
      this.updateSomeCommentsExpanded();
    }));
    this._register(this.tree.onDidChangeCollapseState(() => {
      this.updateSomeCommentsExpanded();
    }));
    this._register(this.tree.onDidFocus(() => this.commentsFocusedContextKey.set(true)));
    this._register(this.tree.onDidBlur(() => this.commentsFocusedContextKey.set(false)));
  }
  openFile(element, pinned, preserveFocus, sideBySide) {
    if (!element) {
      return;
    }
    if (!(element instanceof ResourceWithCommentThreads || element instanceof CommentNode)) {
      return;
    }
    const threadToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].thread : element.thread;
    const commentToReveal = element instanceof ResourceWithCommentThreads ? element.commentThreads[0].comment : void 0;
    return revealCommentThread(this.commentService, this.editorService, this.uriIdentityService, threadToReveal, commentToReveal, false, pinned, preserveFocus, sideBySide);
  }
  async refresh() {
    if (!this.tree) {
      return;
    }
    if (this.isVisible()) {
      this.hasCommentsContextKey.set(this.commentService.commentsModel.hasCommentThreads());
      this.cachedFilterStats = void 0;
      this.renderComments();
      if (this.tree.getSelection().length === 0 && this.commentService.commentsModel.hasCommentThreads()) {
        const firstComment = this.commentService.commentsModel.resourceCommentThreads[0].commentThreads[0];
        if (firstComment) {
          this.tree.setFocus([firstComment]);
          this.tree.setSelection([firstComment]);
        }
      }
    }
  }
  onAllCommentsChanged(e) {
    this.cachedFilterStats = void 0;
    this.totalComments += e.commentThreads.length;
    let unresolved = 0;
    for (const thread of e.commentThreads) {
      if (thread.state === CommentThreadState.Unresolved) {
        unresolved++;
      }
    }
    this.refresh();
  }
  onCommentsUpdated(e) {
    this.cachedFilterStats = void 0;
    this.totalComments += e.added.length;
    this.totalComments -= e.removed.length;
    let unresolved = 0;
    for (const resource of this.commentService.commentsModel.resourceCommentThreads) {
      for (const thread of resource.commentThreads) {
        if (thread.threadState === CommentThreadState.Unresolved) {
          unresolved++;
        }
      }
    }
    this.refresh();
  }
  onDataProviderDeleted(owner) {
    this.cachedFilterStats = void 0;
    this.totalComments = 0;
    this.refresh();
  }
  updateSomeCommentsExpanded() {
    this.someCommentsExpandedContextKey.set(this.isSomeCommentsExpanded());
  }
  areAllCommentsExpanded() {
    if (!this.tree) {
      return false;
    }
    const navigator = this.tree.navigate();
    while (navigator.next()) {
      if (this.tree.isCollapsed(navigator.current())) {
        return false;
      }
    }
    return true;
  }
  isSomeCommentsExpanded() {
    if (!this.tree) {
      return false;
    }
    const navigator = this.tree.navigate();
    while (navigator.next()) {
      if (!this.tree.isCollapsed(navigator.current())) {
        return true;
      }
    }
    return false;
  }
};
CommentsPanel = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IThemeService),
  __decorateParam(10, ICommentService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IUriIdentityService),
  __decorateParam(13, IStorageService),
  __decorateParam(14, IPathService)
], CommentsPanel);
export {
  CONTEXT_KEY_COMMENT_FOCUSED,
  CONTEXT_KEY_HAS_COMMENTS,
  CONTEXT_KEY_SOME_COMMENTS_EXPANDED,
  CommentsPanel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRzVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9wYW5lbC5jc3MnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1lbnROb2RlLCBJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCwgUmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHMgfSBmcm9tICcuLi9jb21tb24vY29tbWVudE1vZGVsLmpzJztcbmltcG9ydCB7IElDb21tZW50U2VydmljZSwgSVdvcmtzcGFjZUNvbW1lbnRUaHJlYWRzRXZlbnQgfSBmcm9tICcuL2NvbW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9sYWJlbHMuanMnO1xuaW1wb3J0IHsgQ29tbWVudHNMaXN0LCBDT01NRU5UU19WSUVXX1RJVExFLCBGaWx0ZXIgfSBmcm9tICcuL2NvbW1lbnRzVHJlZVZpZXdlci5qcyc7XG5pbXBvcnQgeyBJVmlld1BhbmVPcHRpb25zLCBGaWx0ZXJWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IENvbW1lbnRzVmlld0ZpbHRlckZvY3VzQ29udGV4dEtleSwgSUNvbW1lbnRzVmlldyB9IGZyb20gJy4vY29tbWVudHMuanMnO1xuaW1wb3J0IHsgQ29tbWVudHNGaWx0ZXJzLCBDb21tZW50c0ZpbHRlcnNDaGFuZ2VFdmVudCwgQ29tbWVudHNTb3J0T3JkZXIgfSBmcm9tICcuL2NvbW1lbnRzVmlld0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgTWVtZW50bywgTWVtZW50b09iamVjdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tZW1lbnRvLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBGaWx0ZXJPcHRpb25zIH0gZnJvbSAnLi9jb21tZW50c0ZpbHRlck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHksIENvbW1lbnRUaHJlYWRTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IHJldmVhbENvbW1lbnRUaHJlYWQgfSBmcm9tICcuL2NvbW1lbnRzQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlck5hdmlnYWJsZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aWRnZXROYXZpZ2F0aW9uQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29tbWVudHNNb2RlbCwgdGhyZWFkSGFzTWVhbmluZ2Z1bENvbW1lbnRzLCB0eXBlIElDb21tZW50c01vZGVsIH0gZnJvbSAnLi9jb21tZW50c01vZGVsLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlWZXJib3NpdHlTZXR0aW5nSWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJsZVZpZXdBY3Rpb24gfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXdBY3Rpb25zLmpzJztcbmltcG9ydCB0eXBlIHsgSVRyZWVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuXG5leHBvcnQgY29uc3QgQ09OVEVYVF9LRVlfSEFTX0NPTU1FTlRTID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2NvbW1lbnRzVmlldy5oYXNDb21tZW50cycsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBDT05URVhUX0tFWV9TT01FX0NPTU1FTlRTX0VYUEFOREVEID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2NvbW1lbnRzVmlldy5zb21lQ29tbWVudHNFeHBhbmRlZCcsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBDT05URVhUX0tFWV9DT01NRU5UX0ZPQ1VTRUQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignY29tbWVudHNWaWV3LmNvbW1lbnRGb2N1c2VkJywgZmFsc2UpO1xuY29uc3QgVklFV19TVE9SQUdFX0lEID0gJ2NvbW1lbnRzVmlld1N0YXRlJztcblxudHlwZSBDb21tZW50c1RyZWVOb2RlID0gQ29tbWVudHNNb2RlbCB8IFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzIHwgQ29tbWVudE5vZGU7XG5cbmZ1bmN0aW9uIGNyZWF0ZVJlc291cmNlQ29tbWVudHNJdGVyYXRvcihtb2RlbDogSUNvbW1lbnRzTW9kZWwpOiBJdGVyYWJsZTxJVHJlZUVsZW1lbnQ8Q29tbWVudHNUcmVlTm9kZT4+IHtcblx0Y29uc3QgcmVzdWx0OiBJVHJlZUVsZW1lbnQ8Q29tbWVudHNUcmVlTm9kZT5bXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgbSBvZiBtb2RlbC5yZXNvdXJjZUNvbW1lbnRUaHJlYWRzKSB7XG5cdFx0Y29uc3QgY2hpbGRyZW4gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHIgb2YgbS5jb21tZW50VGhyZWFkcykge1xuXHRcdFx0aWYgKHRocmVhZEhhc01lYW5pbmdmdWxDb21tZW50cyhyLnRocmVhZCkpIHtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6IHIgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjaGlsZHJlbi5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXN1bHQucHVzaCh7IGVsZW1lbnQ6IG0sIGNoaWxkcmVuIH0pO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgY2xhc3MgQ29tbWVudHNQYW5lbCBleHRlbmRzIEZpbHRlclZpZXdQYW5lIGltcGxlbWVudHMgSUNvbW1lbnRzVmlldyB7XG5cdHByaXZhdGUgdHJlZUxhYmVscyE6IFJlc291cmNlTGFiZWxzO1xuXHRwcml2YXRlIHRyZWU6IENvbW1lbnRzTGlzdCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0cmVlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgbWVzc2FnZUJveENvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRvdGFsQ29tbWVudHM6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgaGFzQ29tbWVudHNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzb21lQ29tbWVudHNFeHBhbmRlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbW1lbnRzRm9jdXNlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGZpbHRlcjogRmlsdGVyO1xuXHRyZWFkb25seSBmaWx0ZXJzOiBDb21tZW50c0ZpbHRlcnM7XG5cblx0cHJpdmF0ZSBjdXJyZW50SGVpZ2h0ID0gMDtcblx0cHJpdmF0ZSBjdXJyZW50V2lkdGggPSAwO1xuXHRwcml2YXRlIHJlYWRvbmx5IHZpZXdTdGF0ZTogTWVtZW50b09iamVjdDtcblx0cHJpdmF0ZSByZWFkb25seSBzdGF0ZU1lbWVudG86IE1lbWVudG87XG5cdHByaXZhdGUgY2FjaGVkRmlsdGVyU3RhdHM6IHsgdG90YWw6IG51bWJlcjsgZmlsdGVyZWQ6IG51bWJlciB9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlzaWJpbGl0eSA9IHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eTtcblxuXHRnZXQgZm9jdXNlZENvbW1lbnROb2RlKCk6IENvbW1lbnROb2RlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBmb2N1c2VkID0gdGhpcy50cmVlPy5nZXRGb2N1cygpO1xuXHRcdGlmIChmb2N1c2VkPy5sZW5ndGggPT09IDEgJiYgZm9jdXNlZFswXSBpbnN0YW5jZW9mIENvbW1lbnROb2RlKSB7XG5cdFx0XHRyZXR1cm4gZm9jdXNlZFswXTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCBmb2N1c2VkQ29tbWVudEluZm8oKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuZm9jdXNlZENvbW1lbnROb2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmdldFNjcmVlblJlYWRlckluZm9Gb3JOb2RlKHRoaXMuZm9jdXNlZENvbW1lbnROb2RlKTtcblx0fVxuXG5cdGZvY3VzTmV4dE5vZGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnRyZWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZm9jdXNlZCA9IHRoaXMudHJlZS5nZXRGb2N1cygpPy5bMF07XG5cdFx0aWYgKCFmb2N1c2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGxldCBuZXh0ID0gdGhpcy50cmVlLm5hdmlnYXRlKGZvY3VzZWQpLm5leHQoKTtcblx0XHR3aGlsZSAobmV4dCAmJiAhKG5leHQgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSkpIHtcblx0XHRcdG5leHQgPSB0aGlzLnRyZWUubmF2aWdhdGUobmV4dCkubmV4dCgpO1xuXHRcdH1cblx0XHRpZiAoIW5leHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy50cmVlLnNldEZvY3VzKFtuZXh0XSk7XG5cdH1cblxuXHRmb2N1c1ByZXZpb3VzTm9kZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMudHJlZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBmb2N1c2VkID0gdGhpcy50cmVlLmdldEZvY3VzKCk/LlswXTtcblx0XHRpZiAoIWZvY3VzZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IHByZXZpb3VzID0gdGhpcy50cmVlLm5hdmlnYXRlKGZvY3VzZWQpLnByZXZpb3VzKCk7XG5cdFx0d2hpbGUgKHByZXZpb3VzICYmICEocHJldmlvdXMgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSkpIHtcblx0XHRcdHByZXZpb3VzID0gdGhpcy50cmVlLm5hdmlnYXRlKHByZXZpb3VzKS5wcmV2aW91cygpO1xuXHRcdH1cblx0XHRpZiAoIXByZXZpb3VzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMudHJlZS5zZXRGb2N1cyhbcHJldmlvdXNdKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWVudFNlcnZpY2U6IElDb21tZW50U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJUGF0aFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwYXRoU2VydmljZTogSVBhdGhTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBzdGF0ZU1lbWVudG8gPSBuZXcgTWVtZW50byhWSUVXX1NUT1JBR0VfSUQsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3U3RhdGUgPSBzdGF0ZU1lbWVudG8uZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRmaWx0ZXJPcHRpb25zOiB7XG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLmZpbHRlci5wbGFjZWhvbGRlcicsIFwiRmlsdGVyIChlLmcuIHRleHQsIGF1dGhvcilcIiksXG5cdFx0XHRcdGFyaWFMYWJlbDogbmxzLmxvY2FsaXplKCdjb21tZW50cy5maWx0ZXIuYXJpYUxhYmVsJywgXCJGaWx0ZXIgY29tbWVudHNcIiksXG5cdFx0XHRcdGhpc3Rvcnk6IHZpZXdTdGF0ZVsnZmlsdGVySGlzdG9yeSddIHx8IFtdLFxuXHRcdFx0XHR0ZXh0OiB2aWV3U3RhdGVbJ2ZpbHRlciddIHx8ICcnLFxuXHRcdFx0XHRmb2N1c0NvbnRleHRLZXk6IENvbW1lbnRzVmlld0ZpbHRlckZvY3VzQ29udGV4dEtleS5rZXlcblx0XHRcdH1cblx0XHR9LCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblx0XHR0aGlzLmhhc0NvbW1lbnRzQ29udGV4dEtleSA9IENPTlRFWFRfS0VZX0hBU19DT01NRU5UUy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc29tZUNvbW1lbnRzRXhwYW5kZWRDb250ZXh0S2V5ID0gQ09OVEVYVF9LRVlfU09NRV9DT01NRU5UU19FWFBBTkRFRC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuY29tbWVudHNGb2N1c2VkQ29udGV4dEtleSA9IENPTlRFWFRfS0VZX0NPTU1FTlRfRk9DVVNFRC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc3RhdGVNZW1lbnRvID0gc3RhdGVNZW1lbnRvO1xuXHRcdHRoaXMudmlld1N0YXRlID0gdmlld1N0YXRlO1xuXG5cdFx0dGhpcy5maWx0ZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbW1lbnRzRmlsdGVycyh7XG5cdFx0XHRzaG93UmVzb2x2ZWQ6IHRoaXMudmlld1N0YXRlWydzaG93UmVzb2x2ZWQnXSAhPT0gZmFsc2UsXG5cdFx0XHRzaG93VW5yZXNvbHZlZDogdGhpcy52aWV3U3RhdGVbJ3Nob3dVbnJlc29sdmVkJ10gIT09IGZhbHNlLFxuXHRcdFx0c29ydEJ5OiB0aGlzLnZpZXdTdGF0ZVsnc29ydEJ5J10gPz8gQ29tbWVudHNTb3J0T3JkZXIuUmVzb3VyY2VBc2NlbmRpbmcsXG5cdFx0fSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdHRoaXMuZmlsdGVyID0gbmV3IEZpbHRlcihuZXcgRmlsdGVyT3B0aW9ucyh0aGlzLmZpbHRlcldpZGdldC5nZXRGaWx0ZXJUZXh0KCksIHRoaXMuZmlsdGVycy5zaG93UmVzb2x2ZWQsIHRoaXMuZmlsdGVycy5zaG93VW5yZXNvbHZlZCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5maWx0ZXJzLm9uRGlkQ2hhbmdlKChldmVudDogQ29tbWVudHNGaWx0ZXJzQ2hhbmdlRXZlbnQpID0+IHtcblx0XHRcdGlmIChldmVudC5zaG93UmVzb2x2ZWQgfHwgZXZlbnQuc2hvd1VucmVzb2x2ZWQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVGaWx0ZXIoKTtcblx0XHRcdH1cblx0XHRcdGlmIChldmVudC5zb3J0QnkpIHtcblx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsdGVyV2lkZ2V0Lm9uRGlkQ2hhbmdlRmlsdGVyVGV4dCgoKSA9PiB0aGlzLnVwZGF0ZUZpbHRlcigpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy52aWV3U3RhdGVbJ2ZpbHRlciddID0gdGhpcy5maWx0ZXJXaWRnZXQuZ2V0RmlsdGVyVGV4dCgpO1xuXHRcdHRoaXMudmlld1N0YXRlWydmaWx0ZXJIaXN0b3J5J10gPSB0aGlzLmZpbHRlcldpZGdldC5nZXRIaXN0b3J5KCk7XG5cdFx0dGhpcy52aWV3U3RhdGVbJ3Nob3dSZXNvbHZlZCddID0gdGhpcy5maWx0ZXJzLnNob3dSZXNvbHZlZDtcblx0XHR0aGlzLnZpZXdTdGF0ZVsnc2hvd1VucmVzb2x2ZWQnXSA9IHRoaXMuZmlsdGVycy5zaG93VW5yZXNvbHZlZDtcblx0XHR0aGlzLnZpZXdTdGF0ZVsnc29ydEJ5J10gPSB0aGlzLmZpbHRlcnMuc29ydEJ5O1xuXHRcdHRoaXMuc3RhdGVNZW1lbnRvLnNhdmVNZW1lbnRvKCk7XG5cdFx0c3VwZXIuc2F2ZVN0YXRlKCk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoKTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJOYXZpZ2FibGVDb250YWluZXIoe1xuXHRcdFx0bmFtZTogJ2NvbW1lbnRzVmlldycsXG5cdFx0XHRmb2N1c05vdGlmaWVyczogW3RoaXMsIHRoaXMuZmlsdGVyV2lkZ2V0XSxcblx0XHRcdGZvY3VzTmV4dFdpZGdldDogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5maWx0ZXJXaWRnZXQuaGFzRm9jdXMoKSkge1xuXHRcdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZvY3VzUHJldmlvdXNXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLmZpbHRlcldpZGdldC5oYXNGb2N1cygpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c0ZpbHRlcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIGZvY3VzRmlsdGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0LmZvY3VzKCk7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJGaWx0ZXJUZXh0KCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0LnNldEZpbHRlclRleHQoJycpO1xuXHR9XG5cblx0cHVibGljIGdldEZpbHRlclN0YXRzKCk6IHsgdG90YWw6IG51bWJlcjsgZmlsdGVyZWQ6IG51bWJlciB9IHtcblx0XHRpZiAoIXRoaXMuY2FjaGVkRmlsdGVyU3RhdHMpIHtcblx0XHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB7XG5cdFx0XHRcdHRvdGFsOiB0aGlzLnRvdGFsQ29tbWVudHMsXG5cdFx0XHRcdGZpbHRlcmVkOiB0aGlzLnRyZWU/LmdldFZpc2libGVJdGVtQ291bnQoKSA/PyAwXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmNhY2hlZEZpbHRlclN0YXRzO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVGaWx0ZXIoKSB7XG5cdFx0dGhpcy5maWx0ZXIub3B0aW9ucyA9IG5ldyBGaWx0ZXJPcHRpb25zKHRoaXMuZmlsdGVyV2lkZ2V0LmdldEZpbHRlclRleHQoKSwgdGhpcy5maWx0ZXJzLnNob3dSZXNvbHZlZCwgdGhpcy5maWx0ZXJzLnNob3dVbnJlc29sdmVkKTtcblx0XHR0aGlzLnRyZWU/LmZpbHRlckNvbW1lbnRzKCk7XG5cblx0XHR0aGlzLmNhY2hlZEZpbHRlclN0YXRzID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHsgdG90YWwsIGZpbHRlcmVkIH0gPSB0aGlzLmdldEZpbHRlclN0YXRzKCk7XG5cdFx0dGhpcy5maWx0ZXJXaWRnZXQudXBkYXRlQmFkZ2UodG90YWwgPT09IGZpbHRlcmVkIHx8IHRvdGFsID09PSAwID8gdW5kZWZpbmVkIDogbmxzLmxvY2FsaXplKCdzaG93aW5nIGZpbHRlcmVkIHJlc3VsdHMnLCBcIlNob3dpbmcgezB9IG9mIHsxfVwiLCBmaWx0ZXJlZCwgdG90YWwpKTtcblx0XHR0aGlzLmZpbHRlcldpZGdldC5jaGVja01vcmVGaWx0ZXJzKCF0aGlzLmZpbHRlcnMuc2hvd1Jlc29sdmVkIHx8ICF0aGlzLmZpbHRlcnMuc2hvd1VucmVzb2x2ZWQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkoY29udGFpbmVyKTtcblxuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdjb21tZW50cy1wYW5lbCcpO1xuXG5cdFx0Y29uc3QgZG9tQ29udGFpbmVyID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuY29tbWVudHMtcGFuZWwtY29udGFpbmVyJykpO1xuXG5cdFx0dGhpcy50cmVlQ29udGFpbmVyID0gZG9tLmFwcGVuZChkb21Db250YWluZXIsIGRvbS4kKCcudHJlZS1jb250YWluZXInKSk7XG5cdFx0dGhpcy50cmVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2ZpbGUtaWNvbi10aGVtYWJsZS10cmVlJywgJ3Nob3ctZmlsZS1pY29ucycpO1xuXG5cdFx0dGhpcy5jYWNoZWRGaWx0ZXJTdGF0cyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmNyZWF0ZVRyZWUoKTtcblx0XHR0aGlzLmNyZWF0ZU1lc3NhZ2VCb3goZG9tQ29udGFpbmVyKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29tbWVudFNlcnZpY2Uub25EaWRTZXRBbGxDb21tZW50VGhyZWFkcyh0aGlzLm9uQWxsQ29tbWVudHNDaGFuZ2VkLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb21tZW50U2VydmljZS5vbkRpZFVwZGF0ZUNvbW1lbnRUaHJlYWRzKHRoaXMub25Db21tZW50c1VwZGF0ZWQsIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbW1lbnRTZXJ2aWNlLm9uRGlkRGVsZXRlRGF0YVByb3ZpZGVyKHRoaXMub25EYXRhUHJvdmlkZXJEZWxldGVkLCB0aGlzKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkodmlzaWJsZSA9PiB7XG5cdFx0XHRpZiAodmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnJlbmRlckNvbW1lbnRzKCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblxuXHRcdGNvbnN0IGVsZW1lbnQgPSB0aGlzLnRyZWU/LmdldEhUTUxFbGVtZW50KCk7XG5cdFx0aWYgKGVsZW1lbnQgJiYgZG9tLmlzQWN0aXZlRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5jb21tZW50U2VydmljZS5jb21tZW50c01vZGVsLmhhc0NvbW1lbnRUaHJlYWRzKCkgJiYgdGhpcy5tZXNzYWdlQm94Q29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLm1lc3NhZ2VCb3hDb250YWluZXIuZm9jdXMoKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHJlZSkge1xuXHRcdFx0dGhpcy50cmVlLmRvbUZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDb21tZW50cygpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWVDb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgIXRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5oYXNDb21tZW50VGhyZWFkcygpKTtcblx0XHR0aGlzLnJlbmRlck1lc3NhZ2UoKTtcblx0XHR0aGlzLnRyZWU/LnNldENoaWxkcmVuKG51bGwsIGNyZWF0ZVJlc291cmNlQ29tbWVudHNJdGVyYXRvcih0aGlzLmNvbW1lbnRTZXJ2aWNlLmNvbW1lbnRzTW9kZWwpKTtcblx0fVxuXG5cdHB1YmxpYyBjb2xsYXBzZUFsbCgpIHtcblx0XHRpZiAodGhpcy50cmVlKSB7XG5cdFx0XHR0aGlzLnRyZWUuY29sbGFwc2VBbGwoKTtcblx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24oW10pO1xuXHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdKTtcblx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdFx0dGhpcy50cmVlLmZvY3VzRmlyc3QoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZXhwYW5kQWxsKCkge1xuXHRcdGlmICh0aGlzLnRyZWUpIHtcblx0XHRcdHRoaXMudHJlZS5leHBhbmRBbGwoKTtcblx0XHRcdHRoaXMudHJlZS5zZXRTZWxlY3Rpb24oW10pO1xuXHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtdKTtcblx0XHRcdHRoaXMudHJlZS5kb21Gb2N1cygpO1xuXHRcdFx0dGhpcy50cmVlLmZvY3VzRmlyc3QoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGhhc1JlbmRlcmVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMudHJlZTtcblx0fVxuXG5cdHByb3RlY3RlZCBsYXlvdXRCb2R5Q29udGVudChoZWlnaHQ6IG51bWJlciA9IHRoaXMuY3VycmVudEhlaWdodCwgd2lkdGg6IG51bWJlciA9IHRoaXMuY3VycmVudFdpZHRoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubWVzc2FnZUJveENvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyLnN0eWxlLmhlaWdodCA9IGAke2hlaWdodH1weGA7XG5cdFx0fVxuXHRcdHRoaXMudHJlZT8ubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuY3VycmVudEhlaWdodCA9IGhlaWdodDtcblx0XHR0aGlzLmN1cnJlbnRXaWR0aCA9IHdpZHRoO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVNZXNzYWdlQm94KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLm1lc3NhZ2VCb3hDb250YWluZXIgPSBkb20uYXBwZW5kKHBhcmVudCwgZG9tLiQoJy5tZXNzYWdlLWJveC1jb250YWluZXInKSk7XG5cdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyLnNldEF0dHJpYnV0ZSgndGFiSW5kZXgnLCAnMCcpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJNZXNzYWdlKCk6IHZvaWQge1xuXHRcdHRoaXMubWVzc2FnZUJveENvbnRhaW5lci50ZXh0Q29udGVudCA9IHRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5nZXRNZXNzYWdlKCk7XG5cdFx0dGhpcy5tZXNzYWdlQm94Q29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsIHRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5oYXNDb21tZW50VGhyZWFkcygpKTtcblx0fVxuXG5cdHByaXZhdGUgbWFrZUNvbW1lbnRMb2NhdGlvbkxhYmVsKGZpbGU6IFVSSSwgcmFuZ2U/OiBJUmFuZ2UpIHtcblx0XHRjb25zdCBmaWxlTGFiZWwgPSBiYXNlbmFtZShmaWxlKTtcblx0XHRpZiAoIXJhbmdlKSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdmaWxlQ29tbWVudExhYmVsJywgXCJpbiB7MH1cIiwgZmlsZUxhYmVsKTtcblx0XHR9XG5cdFx0aWYgKHJhbmdlLnN0YXJ0TGluZU51bWJlciA9PT0gcmFuZ2UuZW5kTGluZU51bWJlcikge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnb25lTGluZUNvbW1lbnRMYWJlbCcsIFwiYXQgbGluZSB7MH0gY29sdW1uIHsxfSBpbiB7Mn1cIiwgcmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5zdGFydENvbHVtbiwgZmlsZUxhYmVsKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnbXVsdGlMaW5lQ29tbWVudExhYmVsJywgXCJmcm9tIGxpbmUgezB9IHRvIGxpbmUgezF9IGluIHsyfVwiLCByYW5nZS5zdGFydExpbmVOdW1iZXIsIHJhbmdlLmVuZExpbmVOdW1iZXIsIGZpbGVMYWJlbCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtYWtlU2NyZWVuUmVhZGVyTGFiZWxJbmZvKGVsZW1lbnQ6IENvbW1lbnROb2RlLCBmb3JBcmlhTGFiZWw/OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgdXNlck5hbWUgPSBlbGVtZW50LmNvbW1lbnQudXNlck5hbWU7XG5cdFx0Y29uc3QgbG9jYXRpb25MYWJlbCA9IHRoaXMubWFrZUNvbW1lbnRMb2NhdGlvbkxhYmVsKGVsZW1lbnQucmVzb3VyY2UsIGVsZW1lbnQucmFuZ2UpO1xuXHRcdGNvbnN0IHJlcGx5Q291bnRMYWJlbCA9IHRoaXMuZ2V0UmVwbHlDb3VudEFzU3RyaW5nKGVsZW1lbnQsIGZvckFyaWFMYWJlbCk7XG5cdFx0Y29uc3QgYm9keUxhYmVsID0gKHR5cGVvZiBlbGVtZW50LmNvbW1lbnQuYm9keSA9PT0gJ3N0cmluZycpID8gZWxlbWVudC5jb21tZW50LmJvZHkgOiBlbGVtZW50LmNvbW1lbnQuYm9keS52YWx1ZTtcblxuXHRcdHJldHVybiB7IHVzZXJOYW1lLCBsb2NhdGlvbkxhYmVsLCByZXBseUNvdW50TGFiZWwsIGJvZHlMYWJlbCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTY3JlZW5SZWFkZXJJbmZvRm9yTm9kZShlbGVtZW50OiBDb21tZW50Tm9kZSwgZm9yQXJpYUxhYmVsPzogYm9vbGVhbik6IHN0cmluZyB7XG5cdFx0bGV0IGFjY2Vzc2libGVWaWV3SGludCA9ICcnO1xuXHRcdGlmIChmb3JBcmlhTGFiZWwgJiYgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBY2Nlc3NpYmlsaXR5VmVyYm9zaXR5U2V0dGluZ0lkLkNvbW1lbnRzKSkge1xuXHRcdFx0Y29uc3Qga2JMYWJlbCA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhBY2Nlc3NpYmxlVmlld0FjdGlvbi5pZCk/LmdldEFyaWFMYWJlbCgpO1xuXHRcdFx0YWNjZXNzaWJsZVZpZXdIaW50ID0ga2JMYWJlbCA/IG5scy5sb2NhbGl6ZSgnYWNjZXNzaWJsZVZpZXdIaW50JywgXCJcXG5JbnNwZWN0IHRoaXMgaW4gdGhlIGFjY2Vzc2libGUgdmlldyAoezB9KS5cIiwga2JMYWJlbCkgOiBubHMubG9jYWxpemUoJ2FjZXNzaWJsZVZpZXdIaW50Tm9LYk9wZW4nLCBcIlxcbkluc3BlY3QgdGhpcyBpbiB0aGUgYWNjZXNzaWJsZSB2aWV3IHZpYSB0aGUgY29tbWFuZCBPcGVuIEFjY2Vzc2libGUgVmlldyB3aGljaCBpcyBjdXJyZW50bHkgbm90IHRyaWdnZXJhYmxlIHZpYSBrZXliaW5kaW5nLlwiKTtcblx0XHR9XG5cdFx0Y29uc3QgcmVwbGllcyA9IHRoaXMuZ2V0UmVwbGllc0FzU3RyaW5nKGVsZW1lbnQsIGZvckFyaWFMYWJlbCk7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmZpbmRFZGl0b3JzKGVsZW1lbnQucmVzb3VyY2UpO1xuXHRcdGNvbnN0IGNvZGVFZGl0b3IgPSB0aGlzLmVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZT8uZ2V0Q29udHJvbCgpO1xuXHRcdGxldCByZWxldmFudExpbmVzO1xuXHRcdGlmIChlbGVtZW50LnJhbmdlICYmIGVkaXRvcj8ubGVuZ3RoICYmIGlzQ29kZUVkaXRvcihjb2RlRWRpdG9yKSkge1xuXHRcdFx0cmVsZXZhbnRMaW5lcyA9IGNvZGVFZGl0b3IuZ2V0TW9kZWwoKT8uZ2V0VmFsdWVJblJhbmdlKGVsZW1lbnQucmFuZ2UpO1xuXHRcdFx0aWYgKHJlbGV2YW50TGluZXMpIHtcblx0XHRcdFx0cmVsZXZhbnRMaW5lcyA9ICdcXG5Db3JyZXNwb25kaW5nIGNvZGU6IFxcbicgKyByZWxldmFudExpbmVzO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIXJlbGV2YW50TGluZXMpIHtcblx0XHRcdHJlbGV2YW50TGluZXMgPSAnJztcblx0XHR9XG5cblx0XHRjb25zdCBsYWJlbEluZm8gPSB0aGlzLm1ha2VTY3JlZW5SZWFkZXJMYWJlbEluZm8oZWxlbWVudCwgZm9yQXJpYUxhYmVsKTtcblxuXHRcdGlmIChlbGVtZW50LnRocmVhZFJlbGV2YW5jZSA9PT0gQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHkuT3V0ZGF0ZWQpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3Jlc291cmNlV2l0aENvbW1lbnRMYWJlbE91dGRhdGVkJyxcblx0XHRcdFx0XCJPdXRkYXRlZCBmcm9tIHswfTogezF9XFxuezJ9XFxuezN9XFxuezR9XCIsXG5cdFx0XHRcdGxhYmVsSW5mby51c2VyTmFtZSxcblx0XHRcdFx0bGFiZWxJbmZvLmJvZHlMYWJlbCxcblx0XHRcdFx0bGFiZWxJbmZvLmxvY2F0aW9uTGFiZWwsXG5cdFx0XHRcdGxhYmVsSW5mby5yZXBseUNvdW50TGFiZWwsXG5cdFx0XHRcdHJlbGV2YW50TGluZXNcblx0XHRcdCkgKyByZXBsaWVzICsgYWNjZXNzaWJsZVZpZXdIaW50O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdyZXNvdXJjZVdpdGhDb21tZW50TGFiZWwnLFxuXHRcdFx0XHRcInswfTogezF9XFxuezJ9XFxuezN9XFxuezR9XCIsXG5cdFx0XHRcdGxhYmVsSW5mby51c2VyTmFtZSxcblx0XHRcdFx0bGFiZWxJbmZvLmJvZHlMYWJlbCxcblx0XHRcdFx0bGFiZWxJbmZvLmxvY2F0aW9uTGFiZWwsXG5cdFx0XHRcdGxhYmVsSW5mby5yZXBseUNvdW50TGFiZWwsXG5cdFx0XHRcdHJlbGV2YW50TGluZXNcblx0XHRcdCkgKyByZXBsaWVzICsgYWNjZXNzaWJsZVZpZXdIaW50O1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVwbGllc0FzU3RyaW5nKG5vZGU6IENvbW1lbnROb2RlLCBmb3JBcmlhTGFiZWw/OiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAoIW5vZGUucmVwbGllcy5sZW5ndGggfHwgZm9yQXJpYUxhYmVsKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHRcdHJldHVybiAnXFxuJyArIG5vZGUucmVwbGllcy5tYXAocmVwbHkgPT4gbmxzLmxvY2FsaXplKCdyZXNvdXJjZVdpdGhSZXBsaWVzTGFiZWwnLFxuXHRcdFx0XCJ7MH0gezF9XCIsXG5cdFx0XHRyZXBseS5jb21tZW50LnVzZXJOYW1lLFxuXHRcdFx0KHR5cGVvZiByZXBseS5jb21tZW50LmJvZHkgPT09ICdzdHJpbmcnKSA/IHJlcGx5LmNvbW1lbnQuYm9keSA6IHJlcGx5LmNvbW1lbnQuYm9keS52YWx1ZSlcblx0XHQpLmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZXBseUNvdW50QXNTdHJpbmcobm9kZTogQ29tbWVudE5vZGUsIGZvckFyaWFMYWJlbD86IGJvb2xlYW4pOiBzdHJpbmcge1xuXHRcdHJldHVybiBub2RlLnJlcGxpZXMubGVuZ3RoICYmICFmb3JBcmlhTGFiZWwgPyBubHMubG9jYWxpemUoJ3JlcGx5Q291bnQnLCBcIiB7MH0gcmVwbGllcyxcIiwgbm9kZS5yZXBsaWVzLmxlbmd0aCkgOiAnJztcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVHJlZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRyZWVMYWJlbHMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlTGFiZWxzLCB0aGlzKSk7XG5cdFx0dGhpcy50cmVlID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21tZW50c0xpc3QsIHRoaXMudHJlZUxhYmVscywgdGhpcy50cmVlQ29udGFpbmVyLCB7XG5cdFx0XHRvdmVycmlkZVN0eWxlczogdGhpcy5nZXRMb2NhdGlvbkJhc2VkQ29sb3JzKCkubGlzdE92ZXJyaWRlU3R5bGVzLFxuXHRcdFx0c2VsZWN0aW9uTmF2aWdhdGlvbjogdHJ1ZSxcblx0XHRcdGZpbHRlcjogdGhpcy5maWx0ZXIsXG5cdFx0XHRzb3J0ZXI6IHtcblx0XHRcdFx0Y29tcGFyZTogKGE6IENvbW1lbnRzVHJlZU5vZGUsIGI6IENvbW1lbnRzVHJlZU5vZGUpID0+IHtcblx0XHRcdFx0XHRpZiAoYSBpbnN0YW5jZW9mIENvbW1lbnRzTW9kZWwgfHwgYiBpbnN0YW5jZW9mIENvbW1lbnRzTW9kZWwpIHtcblx0XHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodGhpcy5maWx0ZXJzLnNvcnRCeSA9PT0gQ29tbWVudHNTb3J0T3JkZXIuVXBkYXRlZEF0RGVzY2VuZGluZykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGEubGFzdFVwZGF0ZWRBdCA+IGIubGFzdFVwZGF0ZWRBdCA/IC0xIDogMTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHRoaXMuZmlsdGVycy5zb3J0QnkgPT09IENvbW1lbnRzU29ydE9yZGVyLlJlc291cmNlQXNjZW5kaW5nKSB7XG5cdFx0XHRcdFx0XHRpZiAoYSBpbnN0YW5jZW9mIFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzICYmIGIgaW5zdGFuY2VvZiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VTY2hlbWUgPSB0aGlzLnBhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWU7XG5cdFx0XHRcdFx0XHRcdGlmICgoYS5yZXNvdXJjZS5zY2hlbWUgIT09IGIucmVzb3VyY2Uuc2NoZW1lKSAmJiAoYS5yZXNvdXJjZS5zY2hlbWUgPT09IHdvcmtzcGFjZVNjaGVtZSB8fCBiLnJlc291cmNlLnNjaGVtZSA9PT0gd29ya3NwYWNlU2NoZW1lKSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFdvcmtzcGFjZSBzY2hlbWUgc2hvdWxkIGFsd2F5cyBjb21lIGZpcnN0XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGIucmVzb3VyY2Uuc2NoZW1lID09PSB3b3Jrc3BhY2VTY2hlbWUgPyAxIDogLTE7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGEucmVzb3VyY2UudG9TdHJpbmcoKSA+IGIucmVzb3VyY2UudG9TdHJpbmcoKSA/IDEgOiAtMTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoYSBpbnN0YW5jZW9mIENvbW1lbnROb2RlICYmIGIgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSAmJiBhLnRocmVhZC5yYW5nZSAmJiBiLnRocmVhZC5yYW5nZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYS50aHJlYWQucmFuZ2U/LnN0YXJ0TGluZU51bWJlciA+IGIudGhyZWFkLnJhbmdlPy5zdGFydExpbmVOdW1iZXIgPyAxIDogLTE7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiAwO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IHtcblx0XHRcdFx0Z2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWw6IChpdGVtOiBDb21tZW50c1RyZWVOb2RlKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRnZXRBcmlhTGFiZWw6IChlbGVtZW50OiBhbnkpOiBzdHJpbmcgPT4ge1xuXHRcdFx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ29tbWVudHNNb2RlbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncm9vdENvbW1lbnRzTGFiZWwnLCBcIkNvbW1lbnRzIGZvciBjdXJyZW50IHdvcmtzcGFjZVwiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHNMYWJlbCcsIFwiQ29tbWVudHMgaW4gezB9LCBmdWxsIHBhdGggezF9XCIsIGJhc2VuYW1lKGVsZW1lbnQucmVzb3VyY2UpLCBlbGVtZW50LnJlc291cmNlLmZzUGF0aCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ29tbWVudE5vZGUpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmdldFNjcmVlblJlYWRlckluZm9Gb3JOb2RlKGVsZW1lbnQsIHRydWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdFx0XHRcdHJldHVybiBDT01NRU5UU19WSUVXX1RJVExFLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkT3BlbihlID0+IHtcblx0XHRcdHRoaXMub3BlbkZpbGUoZS5lbGVtZW50LCBlLmVkaXRvck9wdGlvbnMucGlubmVkLCBlLmVkaXRvck9wdGlvbnMucHJlc2VydmVGb2N1cywgZS5zaWRlQnlTaWRlKTtcblx0XHR9KSk7XG5cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlU29tZUNvbW1lbnRzRXhwYW5kZWQoKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50cmVlLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnVwZGF0ZVNvbWVDb21tZW50c0V4cGFuZGVkKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudHJlZS5vbkRpZEZvY3VzKCgpID0+IHRoaXMuY29tbWVudHNGb2N1c2VkQ29udGV4dEtleS5zZXQodHJ1ZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRyZWUub25EaWRCbHVyKCgpID0+IHRoaXMuY29tbWVudHNGb2N1c2VkQ29udGV4dEtleS5zZXQoZmFsc2UpKSk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5GaWxlKGVsZW1lbnQ6IGFueSwgcGlubmVkPzogYm9vbGVhbiwgcHJlc2VydmVGb2N1cz86IGJvb2xlYW4sIHNpZGVCeVNpZGU/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCFlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCEoZWxlbWVudCBpbnN0YW5jZW9mIFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzIHx8IGVsZW1lbnQgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgdGhyZWFkVG9SZXZlYWwgPSBlbGVtZW50IGluc3RhbmNlb2YgUmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHMgPyBlbGVtZW50LmNvbW1lbnRUaHJlYWRzWzBdLnRocmVhZCA6IGVsZW1lbnQudGhyZWFkO1xuXHRcdGNvbnN0IGNvbW1lbnRUb1JldmVhbCA9IGVsZW1lbnQgaW5zdGFuY2VvZiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcyA/IGVsZW1lbnQuY29tbWVudFRocmVhZHNbMF0uY29tbWVudCA6IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gcmV2ZWFsQ29tbWVudFRocmVhZCh0aGlzLmNvbW1lbnRTZXJ2aWNlLCB0aGlzLmVkaXRvclNlcnZpY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLCB0aHJlYWRUb1JldmVhbCwgY29tbWVudFRvUmV2ZWFsLCBmYWxzZSwgcGlubmVkLCBwcmVzZXJ2ZUZvY3VzLCBzaWRlQnlTaWRlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVmcmVzaCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMudHJlZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5pc1Zpc2libGUoKSkge1xuXHRcdFx0dGhpcy5oYXNDb21tZW50c0NvbnRleHRLZXkuc2V0KHRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5oYXNDb21tZW50VGhyZWFkcygpKTtcblx0XHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB1bmRlZmluZWQ7XG5cdFx0XHR0aGlzLnJlbmRlckNvbW1lbnRzKCk7XG5cblx0XHRcdGlmICh0aGlzLnRyZWUuZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID09PSAwICYmIHRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5oYXNDb21tZW50VGhyZWFkcygpKSB7XG5cdFx0XHRcdGNvbnN0IGZpcnN0Q29tbWVudCA9IHRoaXMuY29tbWVudFNlcnZpY2UuY29tbWVudHNNb2RlbC5yZXNvdXJjZUNvbW1lbnRUaHJlYWRzWzBdLmNvbW1lbnRUaHJlYWRzWzBdO1xuXHRcdFx0XHRpZiAoZmlyc3RDb21tZW50KSB7XG5cdFx0XHRcdFx0dGhpcy50cmVlLnNldEZvY3VzKFtmaXJzdENvbW1lbnRdKTtcblx0XHRcdFx0XHR0aGlzLnRyZWUuc2V0U2VsZWN0aW9uKFtmaXJzdENvbW1lbnRdKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25BbGxDb21tZW50c0NoYW5nZWQoZTogSVdvcmtzcGFjZUNvbW1lbnRUaHJlYWRzRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLmNhY2hlZEZpbHRlclN0YXRzID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMudG90YWxDb21tZW50cyArPSBlLmNvbW1lbnRUaHJlYWRzLmxlbmd0aDtcblxuXHRcdGxldCB1bnJlc29sdmVkID0gMDtcblx0XHRmb3IgKGNvbnN0IHRocmVhZCBvZiBlLmNvbW1lbnRUaHJlYWRzKSB7XG5cdFx0XHRpZiAodGhyZWFkLnN0YXRlID09PSBDb21tZW50VGhyZWFkU3RhdGUuVW5yZXNvbHZlZCkge1xuXHRcdFx0XHR1bnJlc29sdmVkKys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkNvbW1lbnRzVXBkYXRlZChlOiBJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuY2FjaGVkRmlsdGVyU3RhdHMgPSB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLnRvdGFsQ29tbWVudHMgKz0gZS5hZGRlZC5sZW5ndGg7XG5cdFx0dGhpcy50b3RhbENvbW1lbnRzIC09IGUucmVtb3ZlZC5sZW5ndGg7XG5cblx0XHRsZXQgdW5yZXNvbHZlZCA9IDA7XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiB0aGlzLmNvbW1lbnRTZXJ2aWNlLmNvbW1lbnRzTW9kZWwucmVzb3VyY2VDb21tZW50VGhyZWFkcykge1xuXHRcdFx0Zm9yIChjb25zdCB0aHJlYWQgb2YgcmVzb3VyY2UuY29tbWVudFRocmVhZHMpIHtcblx0XHRcdFx0aWYgKHRocmVhZC50aHJlYWRTdGF0ZSA9PT0gQ29tbWVudFRocmVhZFN0YXRlLlVucmVzb2x2ZWQpIHtcblx0XHRcdFx0XHR1bnJlc29sdmVkKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5yZWZyZXNoKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGF0YVByb3ZpZGVyRGVsZXRlZChvd25lcjogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5jYWNoZWRGaWx0ZXJTdGF0cyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLnRvdGFsQ29tbWVudHMgPSAwO1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTb21lQ29tbWVudHNFeHBhbmRlZCgpIHtcblx0XHR0aGlzLnNvbWVDb21tZW50c0V4cGFuZGVkQ29udGV4dEtleS5zZXQodGhpcy5pc1NvbWVDb21tZW50c0V4cGFuZGVkKCkpO1xuXHR9XG5cblx0cHVibGljIGFyZUFsbENvbW1lbnRzRXhwYW5kZWQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLnRyZWUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgbmF2aWdhdG9yID0gdGhpcy50cmVlLm5hdmlnYXRlKCk7XG5cdFx0d2hpbGUgKG5hdmlnYXRvci5uZXh0KCkpIHtcblx0XHRcdGlmICh0aGlzLnRyZWUuaXNDb2xsYXBzZWQobmF2aWdhdG9yLmN1cnJlbnQoKSkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBpc1NvbWVDb21tZW50c0V4cGFuZGVkKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy50cmVlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IG5hdmlnYXRvciA9IHRoaXMudHJlZS5uYXZpZ2F0ZSgpO1xuXHRcdHdoaWxlIChuYXZpZ2F0b3IubmV4dCgpKSB7XG5cdFx0XHRpZiAoIXRoaXMudHJlZS5pc0NvbGxhcHNlZChuYXZpZ2F0b3IuY3VycmVudCgpKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1c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
