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
import * as nls from "../../../../nls.js";
import { renderMarkdown } from "../../../../base/browser/markdownRenderer.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { CommentNode, ResourceWithCommentThreads } from "../common/commentModel.js";
import { TreeVisibility } from "../../../../base/browser/ui/tree/tree.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IListService, WorkbenchObjectTree } from "../../../../platform/list/browser/listService.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { TimestampWidget } from "./timestamp.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { commentViewThreadStateColorVar, getCommentThreadStateIconColor } from "./commentColors.js";
import { CommentThreadApplicability, CommentThreadState } from "../../../../editor/common/languages.js";
import { FilterOptions } from "./commentsFilterOptions.js";
import { basename } from "../../../../base/common/resources.js";
import { openLinkFromMarkdown } from "../../../../editor/browser/widget/markdownRenderer/browser/markdownRenderer.js";
import { CommentsModel } from "./commentsModel.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { createActionViewItem, getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const COMMENTS_VIEW_ID = "workbench.panel.comments";
const COMMENTS_VIEW_STORAGE_ID = "Comments";
const COMMENTS_VIEW_TITLE = nls.localize2("comments.view.title", "Comments");
const _CommentsModelVirtualDelegate = class _CommentsModelVirtualDelegate {
  getHeight(element) {
    if (element instanceof CommentNode && element.hasReply()) {
      return 44;
    }
    return 22;
  }
  getTemplateId(element) {
    if (element instanceof ResourceWithCommentThreads) {
      return _CommentsModelVirtualDelegate.RESOURCE_ID;
    }
    if (element instanceof CommentNode) {
      return _CommentsModelVirtualDelegate.COMMENT_ID;
    }
    return "";
  }
};
_CommentsModelVirtualDelegate.RESOURCE_ID = "resource-with-comments";
_CommentsModelVirtualDelegate.COMMENT_ID = "comment-node";
let CommentsModelVirtualDelegate = _CommentsModelVirtualDelegate;
class ResourceWithCommentsRenderer {
  constructor(labels) {
    this.labels = labels;
    this.templateId = "resource-with-comments";
  }
  renderTemplate(container) {
    const labelContainer = dom.append(container, dom.$(".resource-container"));
    const resourceLabel = this.labels.create(labelContainer);
    const separator = dom.append(labelContainer, dom.$(".separator"));
    const owner = labelContainer.appendChild(dom.$(".owner"));
    return { resourceLabel, owner, separator };
  }
  renderElement(node, index, templateData, height) {
    templateData.resourceLabel.setFile(node.element.resource);
    templateData.separator.innerText = "\xB7";
    if (node.element.ownerLabel) {
      templateData.owner.innerText = node.element.ownerLabel;
      templateData.separator.style.display = "inline";
    } else {
      templateData.owner.innerText = "";
      templateData.separator.style.display = "none";
    }
  }
  disposeTemplate(templateData) {
    templateData.resourceLabel.dispose();
  }
}
let CommentsMenus = class {
  constructor(menuService) {
    this.menuService = menuService;
  }
  getResourceActions(element) {
    const actions = this.getActions(MenuId.CommentsViewThreadActions, element);
    return { actions: actions.primary };
  }
  getResourceContextActions(element) {
    return this.getActions(MenuId.CommentsViewThreadActions, element).secondary;
  }
  setContextKeyService(service) {
    this.contextKeyService = service;
  }
  getActions(menuId, element) {
    if (!this.contextKeyService) {
      return { primary: [], secondary: [] };
    }
    const overlay = [
      ["commentController", element.owner],
      ["resourceScheme", element.resource.scheme],
      ["commentThread", element.contextValue],
      ["canReply", element.thread.canReply]
    ];
    const contextKeyService = this.contextKeyService.createOverlay(overlay);
    const menu = this.menuService.getMenuActions(menuId, contextKeyService, { shouldForwardArgs: true });
    return getContextMenuActions(menu, "inline");
  }
  dispose() {
    this.contextKeyService = void 0;
  }
};
CommentsMenus = __decorateClass([
  __decorateParam(0, IMenuService)
], CommentsMenus);
let CommentNodeRenderer = class {
  constructor(actionViewItemProvider, menus, openerService, configurationService, hoverService, themeService) {
    this.actionViewItemProvider = actionViewItemProvider;
    this.menus = menus;
    this.openerService = openerService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.themeService = themeService;
    this.templateId = "comment-node";
  }
  renderTemplate(container) {
    const threadContainer = dom.append(container, dom.$(".comment-thread-container"));
    const metadataContainer = dom.append(threadContainer, dom.$(".comment-metadata-container"));
    const metadata = dom.append(metadataContainer, dom.$(".comment-metadata"));
    const icon = dom.append(metadata, dom.$(".icon"));
    const userNames = dom.append(metadata, dom.$(".user"));
    const timestamp = new TimestampWidget(this.configurationService, this.hoverService, dom.append(metadata, dom.$(".timestamp-container")));
    const relevance = dom.append(metadata, dom.$(".relevance"));
    const separator = dom.append(metadata, dom.$(".separator"));
    const commentPreview = dom.append(metadata, dom.$(".text"));
    const rangeContainer = dom.append(metadata, dom.$(".range"));
    const range = dom.$("p");
    rangeContainer.appendChild(range);
    const threadMetadata = {
      icon,
      userNames,
      timestamp,
      relevance,
      separator,
      commentPreview,
      range
    };
    threadMetadata.separator.innerText = "\xB7";
    const actionsContainer = dom.append(metadataContainer, dom.$(".actions"));
    const actionBar = new ActionBar(actionsContainer, {
      actionViewItemProvider: this.actionViewItemProvider
    });
    const snippetContainer = dom.append(threadContainer, dom.$(".comment-snippet-container"));
    const repliesMetadata = {
      container: snippetContainer,
      icon: dom.append(snippetContainer, dom.$(".icon")),
      count: dom.append(snippetContainer, dom.$(".count")),
      lastReplyDetail: dom.append(snippetContainer, dom.$(".reply-detail")),
      separator: dom.append(snippetContainer, dom.$(".separator")),
      timestamp: new TimestampWidget(this.configurationService, this.hoverService, dom.append(snippetContainer, dom.$(".timestamp-container")))
    };
    repliesMetadata.separator.innerText = "\xB7";
    repliesMetadata.icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.indent));
    const disposables = [threadMetadata.timestamp, repliesMetadata.timestamp];
    return { threadMetadata, repliesMetadata, actionBar, disposables };
  }
  getCountString(commentCount) {
    if (commentCount > 2) {
      return nls.localize("commentsCountReplies", "{0} replies", commentCount - 1);
    } else if (commentCount === 2) {
      return nls.localize("commentsCountReply", "1 reply");
    } else {
      return nls.localize("commentCount", "1 comment");
    }
  }
  getRenderedComment(commentBody, disposables) {
    const renderedComment = renderMarkdown(commentBody, {
      inline: true,
      actionHandler: {
        callback: (link) => openLinkFromMarkdown(this.openerService, link, commentBody.isTrusted),
        disposables
      }
    });
    const images = renderedComment.element.getElementsByTagName("img");
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const textDescription = dom.$("");
      textDescription.textContent = image.alt ? nls.localize("imageWithLabel", "Image: {0}", image.alt) : nls.localize("image", "Image");
      image.parentNode.replaceChild(textDescription, image);
    }
    const headings = [...renderedComment.element.getElementsByTagName("h1"), ...renderedComment.element.getElementsByTagName("h2"), ...renderedComment.element.getElementsByTagName("h3"), ...renderedComment.element.getElementsByTagName("h4"), ...renderedComment.element.getElementsByTagName("h5"), ...renderedComment.element.getElementsByTagName("h6")];
    for (const heading of headings) {
      const textNode = document.createTextNode(heading.textContent || "");
      heading.parentNode.replaceChild(textNode, heading);
    }
    while (renderedComment.element.children.length > 1 && renderedComment.element.firstElementChild?.tagName === "HR") {
      renderedComment.element.removeChild(renderedComment.element.firstElementChild);
    }
    return renderedComment;
  }
  getIcon(threadState) {
    if (threadState === CommentThreadState.Unresolved) {
      return Codicon.commentUnresolved;
    } else {
      return Codicon.comment;
    }
  }
  renderElement(node, index, templateData, height) {
    templateData.actionBar.clear();
    const commentCount = node.element.replies.length + 1;
    if (node.element.threadRelevance === CommentThreadApplicability.Outdated) {
      templateData.threadMetadata.relevance.style.display = "";
      templateData.threadMetadata.relevance.innerText = nls.localize("outdated", "Outdated");
      templateData.threadMetadata.separator.style.display = "none";
    } else {
      templateData.threadMetadata.relevance.innerText = "";
      templateData.threadMetadata.relevance.style.display = "none";
      templateData.threadMetadata.separator.style.display = "";
    }
    templateData.threadMetadata.icon.classList.remove(...Array.from(templateData.threadMetadata.icon.classList.values()).filter((value) => value.startsWith("codicon")));
    templateData.threadMetadata.icon.classList.add(...ThemeIcon.asClassNameArray(this.getIcon(node.element.threadState)));
    if (node.element.threadState !== void 0) {
      const color = this.getCommentThreadWidgetStateColor(node.element.threadState, this.themeService.getColorTheme());
      templateData.threadMetadata.icon.style.setProperty(commentViewThreadStateColorVar, `${color}`);
      templateData.threadMetadata.icon.style.color = `var(${commentViewThreadStateColorVar})`;
    }
    templateData.threadMetadata.userNames.textContent = node.element.comment.userName;
    templateData.threadMetadata.timestamp.setTimestamp(node.element.comment.timestamp ? new Date(node.element.comment.timestamp) : void 0);
    const originalComment = node.element;
    templateData.threadMetadata.commentPreview.innerText = "";
    templateData.threadMetadata.commentPreview.style.height = "22px";
    if (typeof originalComment.comment.body === "string") {
      templateData.threadMetadata.commentPreview.innerText = originalComment.comment.body;
    } else {
      const disposables = new DisposableStore();
      templateData.disposables.push(disposables);
      const renderedComment = this.getRenderedComment(originalComment.comment.body, disposables);
      templateData.disposables.push(renderedComment);
      for (let i = renderedComment.element.children.length - 1; i >= 1; i--) {
        renderedComment.element.removeChild(renderedComment.element.children[i]);
      }
      templateData.threadMetadata.commentPreview.appendChild(renderedComment.element);
      templateData.disposables.push(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), templateData.threadMetadata.commentPreview, renderedComment.element.textContent ?? ""));
    }
    if (node.element.range) {
      if (node.element.range.startLineNumber === node.element.range.endLineNumber) {
        templateData.threadMetadata.range.textContent = nls.localize("commentLine", "[Ln {0}]", node.element.range.startLineNumber);
      } else {
        templateData.threadMetadata.range.textContent = nls.localize("commentRange", "[Ln {0}-{1}]", node.element.range.startLineNumber, node.element.range.endLineNumber);
      }
    }
    const menuActions = this.menus.getResourceActions(node.element);
    templateData.actionBar.push(menuActions.actions, { icon: true, label: false });
    templateData.actionBar.context = {
      commentControlHandle: node.element.controllerHandle,
      commentThreadHandle: node.element.threadHandle,
      $mid: MarshalledId.CommentThread
    };
    if (!node.element.hasReply()) {
      templateData.repliesMetadata.container.style.display = "none";
      return;
    }
    templateData.repliesMetadata.container.style.display = "";
    templateData.repliesMetadata.count.textContent = this.getCountString(commentCount);
    const lastComment = node.element.replies[node.element.replies.length - 1].comment;
    templateData.repliesMetadata.lastReplyDetail.textContent = nls.localize("lastReplyFrom", "Last reply from {0}", lastComment.userName);
    templateData.repliesMetadata.timestamp.setTimestamp(lastComment.timestamp ? new Date(lastComment.timestamp) : void 0);
  }
  getCommentThreadWidgetStateColor(state, theme) {
    return state !== void 0 ? getCommentThreadStateIconColor(state, theme) : void 0;
  }
  disposeTemplate(templateData) {
    templateData.disposables.forEach((disposeable) => disposeable.dispose());
    templateData.actionBar.dispose();
  }
};
CommentNodeRenderer = __decorateClass([
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IThemeService)
], CommentNodeRenderer);
var FilterDataType = /* @__PURE__ */ ((FilterDataType2) => {
  FilterDataType2[FilterDataType2["Resource"] = 0] = "Resource";
  FilterDataType2[FilterDataType2["Comment"] = 1] = "Comment";
  return FilterDataType2;
})(FilterDataType || {});
class Filter {
  constructor(options) {
    this.options = options;
  }
  filter(element, parentVisibility) {
    if (this.options.filter === "" && this.options.showResolved && this.options.showUnresolved) {
      return TreeVisibility.Visible;
    }
    if (element instanceof ResourceWithCommentThreads) {
      return this.filterResourceMarkers(element);
    } else {
      return this.filterCommentNode(element, parentVisibility);
    }
  }
  filterResourceMarkers(resourceMarkers) {
    if (this.options.textFilter.text && !this.options.textFilter.negate) {
      const uriMatches = FilterOptions._filter(this.options.textFilter.text, basename(resourceMarkers.resource));
      if (uriMatches) {
        return { visibility: true, data: { type: 0 /* Resource */, uriMatches: uriMatches || [] } };
      }
    }
    return TreeVisibility.Recurse;
  }
  filterCommentNode(comment, parentVisibility) {
    const matchesResolvedState = comment.threadState === void 0 || this.options.showResolved && CommentThreadState.Resolved === comment.threadState || this.options.showUnresolved && CommentThreadState.Unresolved === comment.threadState;
    if (!matchesResolvedState) {
      return false;
    }
    if (!this.options.textFilter.text) {
      return true;
    }
    const textMatches = (
      // Check body of comment for value
      FilterOptions._messageFilter(this.options.textFilter.text, typeof comment.comment.body === "string" ? comment.comment.body : comment.comment.body.value) || FilterOptions._messageFilter(this.options.textFilter.text, comment.comment.userName) || comment.replies.map((reply) => {
        return FilterOptions._messageFilter(this.options.textFilter.text, reply.comment.userName) || FilterOptions._messageFilter(this.options.textFilter.text, typeof reply.comment.body === "string" ? reply.comment.body : reply.comment.body.value);
      }).filter((value) => !!value).flat()
    );
    if (textMatches.length && !this.options.textFilter.negate) {
      return { visibility: true, data: { type: 1 /* Comment */, textMatches } };
    }
    if (textMatches.length && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return false;
    }
    if (textMatches.length === 0 && this.options.textFilter.negate && parentVisibility === TreeVisibility.Recurse) {
      return true;
    }
    return parentVisibility;
  }
}
let CommentsList = class extends WorkbenchObjectTree {
  constructor(labels, container, options, contextKeyService, listService, instantiationService, configurationService, contextMenuService, keybindingService) {
    const delegate = new CommentsModelVirtualDelegate();
    const actionViewItemProvider = createActionViewItem.bind(void 0, instantiationService);
    const menus = instantiationService.createInstance(CommentsMenus);
    menus.setContextKeyService(contextKeyService);
    const renderers = [
      instantiationService.createInstance(ResourceWithCommentsRenderer, labels),
      instantiationService.createInstance(CommentNodeRenderer, actionViewItemProvider, menus)
    ];
    super(
      "CommentsTree",
      container,
      delegate,
      renderers,
      {
        accessibilityProvider: options.accessibilityProvider,
        identityProvider: {
          getId: (element) => {
            if (element instanceof CommentsModel) {
              return "root";
            }
            if (element instanceof ResourceWithCommentThreads) {
              return `${element.uniqueOwner}-${element.id}`;
            }
            if (element instanceof CommentNode) {
              return `${element.uniqueOwner}-${element.resource.toString()}-${element.threadId}-${element.comment.uniqueIdInThread}` + (element.isRoot ? "-root" : "");
            }
            return "";
          }
        },
        expandOnlyOnTwistieClick: true,
        collapseByDefault: false,
        overrideStyles: options.overrideStyles,
        filter: options.filter,
        sorter: options.sorter,
        findWidgetEnabled: false,
        multipleSelectionSupport: false
      },
      instantiationService,
      contextKeyService,
      listService,
      configurationService
    );
    this.contextMenuService = contextMenuService;
    this.keybindingService = keybindingService;
    this.menus = menus;
    this.disposables.add(this.onContextMenu((e) => this.commentsOnContextMenu(e)));
  }
  commentsOnContextMenu(treeEvent) {
    const node = treeEvent.element;
    if (!(node instanceof CommentNode)) {
      return;
    }
    const event = treeEvent.browserEvent;
    event.preventDefault();
    event.stopPropagation();
    this.setFocus([node]);
    const actions = this.menus.getResourceContextActions(node);
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
          this.domFocus();
        }
      },
      getActionsContext: () => ({
        commentControlHandle: node.controllerHandle,
        commentThreadHandle: node.threadHandle,
        $mid: MarshalledId.CommentThread,
        thread: node.thread
      })
    });
  }
  filterComments() {
    this.refilter();
  }
  getVisibleItemCount() {
    let filtered = 0;
    const root = this.getNode();
    for (const resourceNode of root.children) {
      for (const commentNode of resourceNode.children) {
        if (commentNode.visible && resourceNode.visible) {
          filtered++;
        }
      }
    }
    return filtered;
  }
};
CommentsList = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IListService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IConfigurationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IKeybindingService)
], CommentsList);
export {
  COMMENTS_VIEW_ID,
  COMMENTS_VIEW_STORAGE_ID,
  COMMENTS_VIEW_TITLE,
  CommentNodeRenderer,
  CommentsList,
  CommentsMenus,
  Filter,
  ResourceWithCommentsRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRzVHJlZVZpZXdlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgcmVuZGVyTWFya2Rvd24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbWFya2Rvd25SZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVJlc291cmNlTGFiZWwsIFJlc291cmNlTGFiZWxzIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9sYWJlbHMuanMnO1xuaW1wb3J0IHsgQ29tbWVudE5vZGUsIFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzIH0gZnJvbSAnLi4vY29tbW9uL2NvbW1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJVHJlZUNvbnRleHRNZW51RXZlbnQsIElUcmVlRmlsdGVyLCBJVHJlZU5vZGUsIFRyZWVGaWx0ZXJSZXN1bHQsIFRyZWVWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZSwgSUxpc3RSZW5kZXJlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSwgSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zLCBXb3JrYmVuY2hPYmplY3RUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFRpbWVzdGFtcFdpZGdldCB9IGZyb20gJy4vdGltZXN0YW1wLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgY29tbWVudFZpZXdUaHJlYWRTdGF0ZUNvbG9yVmFyLCBnZXRDb21tZW50VGhyZWFkU3RhdGVJY29uQ29sb3IgfSBmcm9tICcuL2NvbW1lbnRDb2xvcnMuanMnO1xuaW1wb3J0IHsgQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHksIENvbW1lbnRUaHJlYWRTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgSU1hdGNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZmlsdGVycy5qcyc7XG5pbXBvcnQgeyBGaWx0ZXJPcHRpb25zIH0gZnJvbSAnLi9jb21tZW50c0ZpbHRlck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgb3BlbkxpbmtGcm9tTWFya2Rvd24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvbWFya2Rvd25SZW5kZXJlci9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSVN0eWxlT3ZlcnJpZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgSUxpc3RTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBDb21tZW50c01vZGVsIH0gZnJvbSAnLi9jb21tZW50c01vZGVsLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgSUFjdGlvblZpZXdJdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSwgZ2V0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZENvbW1lbnRUaHJlYWQsIE1hcnNoYWxsZWRDb21tZW50VGhyZWFkSW50ZXJuYWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29tbWVudHMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuXG5leHBvcnQgY29uc3QgQ09NTUVOVFNfVklFV19JRCA9ICd3b3JrYmVuY2gucGFuZWwuY29tbWVudHMnO1xuZXhwb3J0IGNvbnN0IENPTU1FTlRTX1ZJRVdfU1RPUkFHRV9JRCA9ICdDb21tZW50cyc7XG5leHBvcnQgY29uc3QgQ09NTUVOVFNfVklFV19USVRMRTogSUxvY2FsaXplZFN0cmluZyA9IG5scy5sb2NhbGl6ZTIoJ2NvbW1lbnRzLnZpZXcudGl0bGUnLCBcIkNvbW1lbnRzXCIpO1xuXG5pbnRlcmZhY2UgSVJlc291cmNlVGVtcGxhdGVEYXRhIHtcblx0cmVzb3VyY2VMYWJlbDogSVJlc291cmNlTGFiZWw7XG5cdHNlcGFyYXRvcjogSFRNTEVsZW1lbnQ7XG5cdG93bmVyOiBIVE1MRWxlbWVudDtcbn1cblxuaW50ZXJmYWNlIElDb21tZW50VGhyZWFkVGVtcGxhdGVEYXRhIHtcblx0dGhyZWFkTWV0YWRhdGE6IHtcblx0XHRyZWxldmFuY2U6IEhUTUxFbGVtZW50O1xuXHRcdGljb246IEhUTUxFbGVtZW50O1xuXHRcdHVzZXJOYW1lczogSFRNTFNwYW5FbGVtZW50O1xuXHRcdHRpbWVzdGFtcDogVGltZXN0YW1wV2lkZ2V0O1xuXHRcdHNlcGFyYXRvcjogSFRNTEVsZW1lbnQ7XG5cdFx0Y29tbWVudFByZXZpZXc6IEhUTUxTcGFuRWxlbWVudDtcblx0XHRyYW5nZTogSFRNTEVsZW1lbnQ7XG5cdH07XG5cdHJlcGxpZXNNZXRhZGF0YToge1xuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdFx0aWNvbjogSFRNTEVsZW1lbnQ7XG5cdFx0Y291bnQ6IEhUTUxTcGFuRWxlbWVudDtcblx0XHRsYXN0UmVwbHlEZXRhaWw6IEhUTUxTcGFuRWxlbWVudDtcblx0XHRzZXBhcmF0b3I6IEhUTUxFbGVtZW50O1xuXHRcdHRpbWVzdGFtcDogVGltZXN0YW1wV2lkZ2V0O1xuXHR9O1xuXHRhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0ZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW107XG59XG5cbmNsYXNzIENvbW1lbnRzTW9kZWxWaXJ0dWFsRGVsZWdhdGUgaW1wbGVtZW50cyBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcyB8IENvbW1lbnROb2RlPiB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJFU09VUkNFX0lEID0gJ3Jlc291cmNlLXdpdGgtY29tbWVudHMnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDT01NRU5UX0lEID0gJ2NvbW1lbnQtbm9kZSc7XG5cblxuXHRnZXRIZWlnaHQoZWxlbWVudDogYW55KTogbnVtYmVyIHtcblx0XHRpZiAoKGVsZW1lbnQgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSkgJiYgZWxlbWVudC5oYXNSZXBseSgpKSB7XG5cdFx0XHRyZXR1cm4gNDQ7XG5cdFx0fVxuXHRcdHJldHVybiAyMjtcblx0fVxuXG5cdHB1YmxpYyBnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IGFueSk6IHN0cmluZyB7XG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcykge1xuXHRcdFx0cmV0dXJuIENvbW1lbnRzTW9kZWxWaXJ0dWFsRGVsZWdhdGUuUkVTT1VSQ0VfSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQ29tbWVudE5vZGUpIHtcblx0XHRcdHJldHVybiBDb21tZW50c01vZGVsVmlydHVhbERlbGVnYXRlLkNPTU1FTlRfSUQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuICcnO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXNvdXJjZVdpdGhDb21tZW50c1JlbmRlcmVyIGltcGxlbWVudHMgSUxpc3RSZW5kZXJlcjxJVHJlZU5vZGU8UmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHM+LCBJUmVzb3VyY2VUZW1wbGF0ZURhdGE+IHtcblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ3Jlc291cmNlLXdpdGgtY29tbWVudHMnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgbGFiZWxzOiBSZXNvdXJjZUxhYmVsc1xuXHQpIHtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHRjb25zdCBsYWJlbENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnJlc291cmNlLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCByZXNvdXJjZUxhYmVsID0gdGhpcy5sYWJlbHMuY3JlYXRlKGxhYmVsQ29udGFpbmVyKTtcblx0XHRjb25zdCBzZXBhcmF0b3IgPSBkb20uYXBwZW5kKGxhYmVsQ29udGFpbmVyLCBkb20uJCgnLnNlcGFyYXRvcicpKTtcblx0XHRjb25zdCBvd25lciA9IGxhYmVsQ29udGFpbmVyLmFwcGVuZENoaWxkKGRvbS4kKCcub3duZXInKSk7XG5cblx0XHRyZXR1cm4geyByZXNvdXJjZUxhYmVsLCBvd25lciwgc2VwYXJhdG9yIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KG5vZGU6IElUcmVlTm9kZTxSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcz4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVJlc291cmNlVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5yZXNvdXJjZUxhYmVsLnNldEZpbGUobm9kZS5lbGVtZW50LnJlc291cmNlKTtcblx0XHR0ZW1wbGF0ZURhdGEuc2VwYXJhdG9yLmlubmVyVGV4dCA9ICdcXHUwMGI3JztcblxuXHRcdGlmIChub2RlLmVsZW1lbnQub3duZXJMYWJlbCkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLm93bmVyLmlubmVyVGV4dCA9IG5vZGUuZWxlbWVudC5vd25lckxhYmVsO1xuXHRcdFx0dGVtcGxhdGVEYXRhLnNlcGFyYXRvci5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5vd25lci5pbm5lclRleHQgPSAnJztcblx0XHRcdHRlbXBsYXRlRGF0YS5zZXBhcmF0b3Iuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJUmVzb3VyY2VUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEucmVzb3VyY2VMYWJlbC5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIENvbW1lbnRzTWVudXMgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbWVudVNlcnZpY2U6IElNZW51U2VydmljZVxuXHQpIHsgfVxuXG5cdGdldFJlc291cmNlQWN0aW9ucyhlbGVtZW50OiBDb21tZW50Tm9kZSk6IHsgYWN0aW9uczogSUFjdGlvbltdIH0ge1xuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldEFjdGlvbnMoTWVudUlkLkNvbW1lbnRzVmlld1RocmVhZEFjdGlvbnMsIGVsZW1lbnQpO1xuXHRcdHJldHVybiB7IGFjdGlvbnM6IGFjdGlvbnMucHJpbWFyeSB9O1xuXHR9XG5cblx0Z2V0UmVzb3VyY2VDb250ZXh0QWN0aW9ucyhlbGVtZW50OiBDb21tZW50Tm9kZSk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWN0aW9ucyhNZW51SWQuQ29tbWVudHNWaWV3VGhyZWFkQWN0aW9ucywgZWxlbWVudCkuc2Vjb25kYXJ5O1xuXHR9XG5cblx0cHVibGljIHNldENvbnRleHRLZXlTZXJ2aWNlKHNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UgPSBzZXJ2aWNlO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBY3Rpb25zKG1lbnVJZDogTWVudUlkLCBlbGVtZW50OiBDb21tZW50Tm9kZSk6IHsgcHJpbWFyeTogSUFjdGlvbltdOyBzZWNvbmRhcnk6IElBY3Rpb25bXSB9IHtcblx0XHRpZiAoIXRoaXMuY29udGV4dEtleVNlcnZpY2UpIHtcblx0XHRcdHJldHVybiB7IHByaW1hcnk6IFtdLCBzZWNvbmRhcnk6IFtdIH07XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3ZlcmxheTogW3N0cmluZywgYW55XVtdID0gW1xuXHRcdFx0Wydjb21tZW50Q29udHJvbGxlcicsIGVsZW1lbnQub3duZXJdLFxuXHRcdFx0WydyZXNvdXJjZVNjaGVtZScsIGVsZW1lbnQucmVzb3VyY2Uuc2NoZW1lXSxcblx0XHRcdFsnY29tbWVudFRocmVhZCcsIGVsZW1lbnQuY29udGV4dFZhbHVlXSxcblx0XHRcdFsnY2FuUmVwbHknLCBlbGVtZW50LnRocmVhZC5jYW5SZXBseV1cblx0XHRdO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KG92ZXJsYXkpO1xuXG5cdFx0Y29uc3QgbWVudSA9IHRoaXMubWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMobWVudUlkLCBjb250ZXh0S2V5U2VydmljZSwgeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gZ2V0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnUsICdpbmxpbmUnKTtcblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29tbWVudE5vZGVSZW5kZXJlciBpbXBsZW1lbnRzIElMaXN0UmVuZGVyZXI8SVRyZWVOb2RlPENvbW1lbnROb2RlPiwgSUNvbW1lbnRUaHJlYWRUZW1wbGF0ZURhdGE+IHtcblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ2NvbW1lbnQtbm9kZSc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiBJQWN0aW9uVmlld0l0ZW1Qcm92aWRlcixcblx0XHRwcml2YXRlIG1lbnVzOiBDb21tZW50c01lbnVzLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IHRocmVhZENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmNvbW1lbnQtdGhyZWFkLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBtZXRhZGF0YUNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhyZWFkQ29udGFpbmVyLCBkb20uJCgnLmNvbW1lbnQtbWV0YWRhdGEtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IG1ldGFkYXRhID0gZG9tLmFwcGVuZChtZXRhZGF0YUNvbnRhaW5lciwgZG9tLiQoJy5jb21tZW50LW1ldGFkYXRhJykpO1xuXG5cdFx0Y29uc3QgaWNvbiA9IGRvbS5hcHBlbmQobWV0YWRhdGEsIGRvbS4kKCcuaWNvbicpKTtcblx0XHRjb25zdCB1c2VyTmFtZXMgPSBkb20uYXBwZW5kKG1ldGFkYXRhLCBkb20uJCgnLnVzZXInKSk7XG5cdFx0Y29uc3QgdGltZXN0YW1wID0gbmV3IFRpbWVzdGFtcFdpZGdldCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLmhvdmVyU2VydmljZSwgZG9tLmFwcGVuZChtZXRhZGF0YSwgZG9tLiQoJy50aW1lc3RhbXAtY29udGFpbmVyJykpKTtcblx0XHRjb25zdCByZWxldmFuY2UgPSBkb20uYXBwZW5kKG1ldGFkYXRhLCBkb20uJCgnLnJlbGV2YW5jZScpKTtcblx0XHRjb25zdCBzZXBhcmF0b3IgPSBkb20uYXBwZW5kKG1ldGFkYXRhLCBkb20uJCgnLnNlcGFyYXRvcicpKTtcblx0XHRjb25zdCBjb21tZW50UHJldmlldyA9IGRvbS5hcHBlbmQobWV0YWRhdGEsIGRvbS4kKCcudGV4dCcpKTtcblx0XHRjb25zdCByYW5nZUNvbnRhaW5lciA9IGRvbS5hcHBlbmQobWV0YWRhdGEsIGRvbS4kKCcucmFuZ2UnKSk7XG5cdFx0Y29uc3QgcmFuZ2UgPSBkb20uJCgncCcpO1xuXHRcdHJhbmdlQ29udGFpbmVyLmFwcGVuZENoaWxkKHJhbmdlKTtcblxuXHRcdGNvbnN0IHRocmVhZE1ldGFkYXRhID0ge1xuXHRcdFx0aWNvbixcblx0XHRcdHVzZXJOYW1lcyxcblx0XHRcdHRpbWVzdGFtcCxcblx0XHRcdHJlbGV2YW5jZSxcblx0XHRcdHNlcGFyYXRvcixcblx0XHRcdGNvbW1lbnRQcmV2aWV3LFxuXHRcdFx0cmFuZ2Vcblx0XHR9O1xuXHRcdHRocmVhZE1ldGFkYXRhLnNlcGFyYXRvci5pbm5lclRleHQgPSAnXFx1MDBiNyc7XG5cblx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gZG9tLmFwcGVuZChtZXRhZGF0YUNvbnRhaW5lciwgZG9tLiQoJy5hY3Rpb25zJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IG5ldyBBY3Rpb25CYXIoYWN0aW9uc0NvbnRhaW5lciwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogdGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyXG5cdFx0fSk7XG5cblx0XHRjb25zdCBzbmlwcGV0Q29udGFpbmVyID0gZG9tLmFwcGVuZCh0aHJlYWRDb250YWluZXIsIGRvbS4kKCcuY29tbWVudC1zbmlwcGV0LWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCByZXBsaWVzTWV0YWRhdGEgPSB7XG5cdFx0XHRjb250YWluZXI6IHNuaXBwZXRDb250YWluZXIsXG5cdFx0XHRpY29uOiBkb20uYXBwZW5kKHNuaXBwZXRDb250YWluZXIsIGRvbS4kKCcuaWNvbicpKSxcblx0XHRcdGNvdW50OiBkb20uYXBwZW5kKHNuaXBwZXRDb250YWluZXIsIGRvbS4kKCcuY291bnQnKSksXG5cdFx0XHRsYXN0UmVwbHlEZXRhaWw6IGRvbS5hcHBlbmQoc25pcHBldENvbnRhaW5lciwgZG9tLiQoJy5yZXBseS1kZXRhaWwnKSksXG5cdFx0XHRzZXBhcmF0b3I6IGRvbS5hcHBlbmQoc25pcHBldENvbnRhaW5lciwgZG9tLiQoJy5zZXBhcmF0b3InKSksXG5cdFx0XHR0aW1lc3RhbXA6IG5ldyBUaW1lc3RhbXBXaWRnZXQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5ob3ZlclNlcnZpY2UsIGRvbS5hcHBlbmQoc25pcHBldENvbnRhaW5lciwgZG9tLiQoJy50aW1lc3RhbXAtY29udGFpbmVyJykpKSxcblx0XHR9O1xuXHRcdHJlcGxpZXNNZXRhZGF0YS5zZXBhcmF0b3IuaW5uZXJUZXh0ID0gJ1xcdTAwYjcnO1xuXHRcdHJlcGxpZXNNZXRhZGF0YS5pY29uLmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoQ29kaWNvbi5pbmRlbnQpKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gW3RocmVhZE1ldGFkYXRhLnRpbWVzdGFtcCwgcmVwbGllc01ldGFkYXRhLnRpbWVzdGFtcF07XG5cdFx0cmV0dXJuIHsgdGhyZWFkTWV0YWRhdGEsIHJlcGxpZXNNZXRhZGF0YSwgYWN0aW9uQmFyLCBkaXNwb3NhYmxlcyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb3VudFN0cmluZyhjb21tZW50Q291bnQ6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0aWYgKGNvbW1lbnRDb3VudCA+IDIpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2NvbW1lbnRzQ291bnRSZXBsaWVzJywgXCJ7MH0gcmVwbGllc1wiLCBjb21tZW50Q291bnQgLSAxKTtcblx0XHR9IGVsc2UgaWYgKGNvbW1lbnRDb3VudCA9PT0gMikge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnY29tbWVudHNDb3VudFJlcGx5JywgXCIxIHJlcGx5XCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdjb21tZW50Q291bnQnLCBcIjEgY29tbWVudFwiKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFJlbmRlcmVkQ29tbWVudChjb21tZW50Qm9keTogSU1hcmtkb3duU3RyaW5nLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0Y29uc3QgcmVuZGVyZWRDb21tZW50ID0gcmVuZGVyTWFya2Rvd24oY29tbWVudEJvZHksIHtcblx0XHRcdGlubGluZTogdHJ1ZSxcblx0XHRcdGFjdGlvbkhhbmRsZXI6IHtcblx0XHRcdFx0Y2FsbGJhY2s6IChsaW5rKSA9PiBvcGVuTGlua0Zyb21NYXJrZG93bih0aGlzLm9wZW5lclNlcnZpY2UsIGxpbmssIGNvbW1lbnRCb2R5LmlzVHJ1c3RlZCksXG5cdFx0XHRcdGRpc3Bvc2FibGVzOiBkaXNwb3NhYmxlc1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IGltYWdlcyA9IHJlbmRlcmVkQ29tbWVudC5lbGVtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdpbWcnKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGltYWdlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaW1hZ2UgPSBpbWFnZXNbaV07XG5cdFx0XHRjb25zdCB0ZXh0RGVzY3JpcHRpb24gPSBkb20uJCgnJyk7XG5cdFx0XHR0ZXh0RGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBpbWFnZS5hbHQgPyBubHMubG9jYWxpemUoJ2ltYWdlV2l0aExhYmVsJywgXCJJbWFnZTogezB9XCIsIGltYWdlLmFsdCkgOiBubHMubG9jYWxpemUoJ2ltYWdlJywgXCJJbWFnZVwiKTtcblx0XHRcdGltYWdlLnBhcmVudE5vZGUhLnJlcGxhY2VDaGlsZCh0ZXh0RGVzY3JpcHRpb24sIGltYWdlKTtcblx0XHR9XG5cdFx0Y29uc3QgaGVhZGluZ3MgPSBbLi4ucmVuZGVyZWRDb21tZW50LmVsZW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2gxJyksIC4uLnJlbmRlcmVkQ29tbWVudC5lbGVtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoMicpLCAuLi5yZW5kZXJlZENvbW1lbnQuZWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaDMnKSwgLi4ucmVuZGVyZWRDb21tZW50LmVsZW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2g0JyksIC4uLnJlbmRlcmVkQ29tbWVudC5lbGVtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoNScpLCAuLi5yZW5kZXJlZENvbW1lbnQuZWxlbWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaDYnKV07XG5cdFx0Zm9yIChjb25zdCBoZWFkaW5nIG9mIGhlYWRpbmdzKSB7XG5cdFx0XHRjb25zdCB0ZXh0Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGhlYWRpbmcudGV4dENvbnRlbnQgfHwgJycpO1xuXHRcdFx0aGVhZGluZy5wYXJlbnROb2RlIS5yZXBsYWNlQ2hpbGQodGV4dE5vZGUsIGhlYWRpbmcpO1xuXHRcdH1cblx0XHR3aGlsZSAoKHJlbmRlcmVkQ29tbWVudC5lbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IDEpICYmIChyZW5kZXJlZENvbW1lbnQuZWxlbWVudC5maXJzdEVsZW1lbnRDaGlsZD8udGFnTmFtZSA9PT0gJ0hSJykpIHtcblx0XHRcdHJlbmRlcmVkQ29tbWVudC5lbGVtZW50LnJlbW92ZUNoaWxkKHJlbmRlcmVkQ29tbWVudC5lbGVtZW50LmZpcnN0RWxlbWVudENoaWxkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlbmRlcmVkQ29tbWVudDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SWNvbih0aHJlYWRTdGF0ZT86IENvbW1lbnRUaHJlYWRTdGF0ZSk6IFRoZW1lSWNvbiB7XG5cdFx0aWYgKHRocmVhZFN0YXRlID09PSBDb21tZW50VGhyZWFkU3RhdGUuVW5yZXNvbHZlZCkge1xuXHRcdFx0cmV0dXJuIENvZGljb24uY29tbWVudFVucmVzb2x2ZWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBDb2RpY29uLmNvbW1lbnQ7XG5cdFx0fVxuXHR9XG5cblx0cmVuZGVyRWxlbWVudChub2RlOiBJVHJlZU5vZGU8Q29tbWVudE5vZGU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElDb21tZW50VGhyZWFkVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblxuXHRcdGNvbnN0IGNvbW1lbnRDb3VudCA9IG5vZGUuZWxlbWVudC5yZXBsaWVzLmxlbmd0aCArIDE7XG5cdFx0aWYgKG5vZGUuZWxlbWVudC50aHJlYWRSZWxldmFuY2UgPT09IENvbW1lbnRUaHJlYWRBcHBsaWNhYmlsaXR5Lk91dGRhdGVkKSB7XG5cdFx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEucmVsZXZhbmNlLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5yZWxldmFuY2UuaW5uZXJUZXh0ID0gbmxzLmxvY2FsaXplKCdvdXRkYXRlZCcsIFwiT3V0ZGF0ZWRcIik7XG5cdFx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuc2VwYXJhdG9yLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5yZWxldmFuY2UuaW5uZXJUZXh0ID0gJyc7XG5cdFx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEucmVsZXZhbmNlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuc2VwYXJhdG9yLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuaWNvbi5jbGFzc0xpc3QucmVtb3ZlKC4uLkFycmF5LmZyb20odGVtcGxhdGVEYXRhLnRocmVhZE1ldGFkYXRhLmljb24uY2xhc3NMaXN0LnZhbHVlcygpKVxuXHRcdFx0LmZpbHRlcih2YWx1ZSA9PiB2YWx1ZS5zdGFydHNXaXRoKCdjb2RpY29uJykpKTtcblx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuaWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHRoaXMuZ2V0SWNvbihub2RlLmVsZW1lbnQudGhyZWFkU3RhdGUpKSk7XG5cdFx0aWYgKG5vZGUuZWxlbWVudC50aHJlYWRTdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBjb2xvciA9IHRoaXMuZ2V0Q29tbWVudFRocmVhZFdpZGdldFN0YXRlQ29sb3Iobm9kZS5lbGVtZW50LnRocmVhZFN0YXRlLCB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLnRocmVhZE1ldGFkYXRhLmljb24uc3R5bGUuc2V0UHJvcGVydHkoY29tbWVudFZpZXdUaHJlYWRTdGF0ZUNvbG9yVmFyLCBgJHtjb2xvcn1gKTtcblx0XHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5pY29uLnN0eWxlLmNvbG9yID0gYHZhcigke2NvbW1lbnRWaWV3VGhyZWFkU3RhdGVDb2xvclZhcn0pYDtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLnRocmVhZE1ldGFkYXRhLnVzZXJOYW1lcy50ZXh0Q29udGVudCA9IG5vZGUuZWxlbWVudC5jb21tZW50LnVzZXJOYW1lO1xuXHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS50aW1lc3RhbXAuc2V0VGltZXN0YW1wKG5vZGUuZWxlbWVudC5jb21tZW50LnRpbWVzdGFtcCA/IG5ldyBEYXRlKG5vZGUuZWxlbWVudC5jb21tZW50LnRpbWVzdGFtcCkgOiB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IG9yaWdpbmFsQ29tbWVudCA9IG5vZGUuZWxlbWVudDtcblxuXHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5jb21tZW50UHJldmlldy5pbm5lclRleHQgPSAnJztcblx0XHR0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuY29tbWVudFByZXZpZXcuc3R5bGUuaGVpZ2h0ID0gJzIycHgnO1xuXHRcdGlmICh0eXBlb2Ygb3JpZ2luYWxDb21tZW50LmNvbW1lbnQuYm9keSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5jb21tZW50UHJldmlldy5pbm5lclRleHQgPSBvcmlnaW5hbENvbW1lbnQuY29tbWVudC5ib2R5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5wdXNoKGRpc3Bvc2FibGVzKTtcblx0XHRcdGNvbnN0IHJlbmRlcmVkQ29tbWVudCA9IHRoaXMuZ2V0UmVuZGVyZWRDb21tZW50KG9yaWdpbmFsQ29tbWVudC5jb21tZW50LmJvZHksIGRpc3Bvc2FibGVzKTtcblx0XHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5wdXNoKHJlbmRlcmVkQ29tbWVudCk7XG5cdFx0XHRmb3IgKGxldCBpID0gcmVuZGVyZWRDb21tZW50LmVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoIC0gMTsgaSA+PSAxOyBpLS0pIHtcblx0XHRcdFx0cmVuZGVyZWRDb21tZW50LmVsZW1lbnQucmVtb3ZlQ2hpbGQocmVuZGVyZWRDb21tZW50LmVsZW1lbnQuY2hpbGRyZW5baV0pO1xuXHRcdFx0fVxuXHRcdFx0dGVtcGxhdGVEYXRhLnRocmVhZE1ldGFkYXRhLmNvbW1lbnRQcmV2aWV3LmFwcGVuZENoaWxkKHJlbmRlcmVkQ29tbWVudC5lbGVtZW50KTtcblx0XHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5wdXNoKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0ZW1wbGF0ZURhdGEudGhyZWFkTWV0YWRhdGEuY29tbWVudFByZXZpZXcsIHJlbmRlcmVkQ29tbWVudC5lbGVtZW50LnRleHRDb250ZW50ID8/ICcnKSk7XG5cdFx0fVxuXG5cdFx0aWYgKG5vZGUuZWxlbWVudC5yYW5nZSkge1xuXHRcdFx0aWYgKG5vZGUuZWxlbWVudC5yYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IG5vZGUuZWxlbWVudC5yYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS50aHJlYWRNZXRhZGF0YS5yYW5nZS50ZXh0Q29udGVudCA9IG5scy5sb2NhbGl6ZSgnY29tbWVudExpbmUnLCBcIltMbiB7MH1dXCIsIG5vZGUuZWxlbWVudC5yYW5nZS5zdGFydExpbmVOdW1iZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLnRocmVhZE1ldGFkYXRhLnJhbmdlLnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdjb21tZW50UmFuZ2UnLCBcIltMbiB7MH0tezF9XVwiLCBub2RlLmVsZW1lbnQucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBub2RlLmVsZW1lbnQucmFuZ2UuZW5kTGluZU51bWJlcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVudUFjdGlvbnMgPSB0aGlzLm1lbnVzLmdldFJlc291cmNlQWN0aW9ucyhub2RlLmVsZW1lbnQpO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIucHVzaChtZW51QWN0aW9ucy5hY3Rpb25zLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmNvbnRleHQgPSB7XG5cdFx0XHRjb21tZW50Q29udHJvbEhhbmRsZTogbm9kZS5lbGVtZW50LmNvbnRyb2xsZXJIYW5kbGUsXG5cdFx0XHRjb21tZW50VGhyZWFkSGFuZGxlOiBub2RlLmVsZW1lbnQudGhyZWFkSGFuZGxlLFxuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRUaHJlYWRcblx0XHR9IHNhdGlzZmllcyBNYXJzaGFsbGVkQ29tbWVudFRocmVhZDtcblxuXHRcdGlmICghbm9kZS5lbGVtZW50Lmhhc1JlcGx5KCkpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5yZXBsaWVzTWV0YWRhdGEuY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGVEYXRhLnJlcGxpZXNNZXRhZGF0YS5jb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdHRlbXBsYXRlRGF0YS5yZXBsaWVzTWV0YWRhdGEuY291bnQudGV4dENvbnRlbnQgPSB0aGlzLmdldENvdW50U3RyaW5nKGNvbW1lbnRDb3VudCk7XG5cdFx0Y29uc3QgbGFzdENvbW1lbnQgPSBub2RlLmVsZW1lbnQucmVwbGllc1tub2RlLmVsZW1lbnQucmVwbGllcy5sZW5ndGggLSAxXS5jb21tZW50O1xuXHRcdHRlbXBsYXRlRGF0YS5yZXBsaWVzTWV0YWRhdGEubGFzdFJlcGx5RGV0YWlsLnRleHRDb250ZW50ID0gbmxzLmxvY2FsaXplKCdsYXN0UmVwbHlGcm9tJywgXCJMYXN0IHJlcGx5IGZyb20gezB9XCIsIGxhc3RDb21tZW50LnVzZXJOYW1lKTtcblx0XHR0ZW1wbGF0ZURhdGEucmVwbGllc01ldGFkYXRhLnRpbWVzdGFtcC5zZXRUaW1lc3RhbXAobGFzdENvbW1lbnQudGltZXN0YW1wID8gbmV3IERhdGUobGFzdENvbW1lbnQudGltZXN0YW1wKSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbW1lbnRUaHJlYWRXaWRnZXRTdGF0ZUNvbG9yKHN0YXRlOiBDb21tZW50VGhyZWFkU3RhdGUgfCB1bmRlZmluZWQsIHRoZW1lOiBJQ29sb3JUaGVtZSk6IENvbG9yIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gKHN0YXRlICE9PSB1bmRlZmluZWQpID8gZ2V0Q29tbWVudFRocmVhZFN0YXRlSWNvbkNvbG9yKHN0YXRlLCB0aGVtZSkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJQ29tbWVudFRocmVhZFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5mb3JFYWNoKGRpc3Bvc2VhYmxlID0+IGRpc3Bvc2VhYmxlLmRpc3Bvc2UoKSk7XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWVudHNMaXN0T3B0aW9ucyBleHRlbmRzIElXb3JrYmVuY2hBc3luY0RhdGFUcmVlT3B0aW9uczxhbnksIGFueT4ge1xuXHRvdmVycmlkZVN0eWxlcz86IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPjtcbn1cblxuY29uc3QgZW51bSBGaWx0ZXJEYXRhVHlwZSB7XG5cdFJlc291cmNlLFxuXHRDb21tZW50XG59XG5cbmludGVyZmFjZSBSZXNvdXJjZUZpbHRlckRhdGEge1xuXHR0eXBlOiBGaWx0ZXJEYXRhVHlwZS5SZXNvdXJjZTtcblx0dXJpTWF0Y2hlczogSU1hdGNoW107XG59XG5cbmludGVyZmFjZSBDb21tZW50RmlsdGVyRGF0YSB7XG5cdHR5cGU6IEZpbHRlckRhdGFUeXBlLkNvbW1lbnQ7XG5cdHRleHRNYXRjaGVzOiBJTWF0Y2hbXTtcbn1cblxudHlwZSBGaWx0ZXJEYXRhID0gUmVzb3VyY2VGaWx0ZXJEYXRhIHwgQ29tbWVudEZpbHRlckRhdGE7XG5cbmV4cG9ydCBjbGFzcyBGaWx0ZXIgaW1wbGVtZW50cyBJVHJlZUZpbHRlcjxSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcyB8IENvbW1lbnROb2RlLCBGaWx0ZXJEYXRhPiB7XG5cblx0Y29uc3RydWN0b3IocHVibGljIG9wdGlvbnM6IEZpbHRlck9wdGlvbnMpIHsgfVxuXG5cdGZpbHRlcihlbGVtZW50OiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcyB8IENvbW1lbnROb2RlLCBwYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IFRyZWVGaWx0ZXJSZXN1bHQ8RmlsdGVyRGF0YT4ge1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuZmlsdGVyID09PSAnJyAmJiB0aGlzLm9wdGlvbnMuc2hvd1Jlc29sdmVkICYmIHRoaXMub3B0aW9ucy5zaG93VW5yZXNvbHZlZCkge1xuXHRcdFx0cmV0dXJuIFRyZWVWaXNpYmlsaXR5LlZpc2libGU7XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsdGVyUmVzb3VyY2VNYXJrZXJzKGVsZW1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5maWx0ZXJDb21tZW50Tm9kZShlbGVtZW50LCBwYXJlbnRWaXNpYmlsaXR5KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlclJlc291cmNlTWFya2VycyhyZXNvdXJjZU1hcmtlcnM6IFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzKTogVHJlZUZpbHRlclJlc3VsdDxGaWx0ZXJEYXRhPiB7XG5cdFx0Ly8gRmlsdGVyIGJ5IHRleHQuIERvIG5vdCBhcHBseSBuZWdhdGVkIGZpbHRlcnMgb24gcmVzb3VyY2VzIGluc3RlYWQgdXNlIGV4Y2x1ZGUgcGF0dGVybnNcblx0XHRpZiAodGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCAmJiAhdGhpcy5vcHRpb25zLnRleHRGaWx0ZXIubmVnYXRlKSB7XG5cdFx0XHRjb25zdCB1cmlNYXRjaGVzID0gRmlsdGVyT3B0aW9ucy5fZmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIGJhc2VuYW1lKHJlc291cmNlTWFya2Vycy5yZXNvdXJjZSkpO1xuXHRcdFx0aWYgKHVyaU1hdGNoZXMpIHtcblx0XHRcdFx0cmV0dXJuIHsgdmlzaWJpbGl0eTogdHJ1ZSwgZGF0YTogeyB0eXBlOiBGaWx0ZXJEYXRhVHlwZS5SZXNvdXJjZSwgdXJpTWF0Y2hlczogdXJpTWF0Y2hlcyB8fCBbXSB9IH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2U7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckNvbW1lbnROb2RlKGNvbW1lbnQ6IENvbW1lbnROb2RlLCBwYXJlbnRWaXNpYmlsaXR5OiBUcmVlVmlzaWJpbGl0eSk6IFRyZWVGaWx0ZXJSZXN1bHQ8RmlsdGVyRGF0YT4ge1xuXHRcdGNvbnN0IG1hdGNoZXNSZXNvbHZlZFN0YXRlID0gKGNvbW1lbnQudGhyZWFkU3RhdGUgPT09IHVuZGVmaW5lZCkgfHwgKHRoaXMub3B0aW9ucy5zaG93UmVzb2x2ZWQgJiYgQ29tbWVudFRocmVhZFN0YXRlLlJlc29sdmVkID09PSBjb21tZW50LnRocmVhZFN0YXRlKSB8fFxuXHRcdFx0KHRoaXMub3B0aW9ucy5zaG93VW5yZXNvbHZlZCAmJiBDb21tZW50VGhyZWFkU3RhdGUuVW5yZXNvbHZlZCA9PT0gY29tbWVudC50aHJlYWRTdGF0ZSk7XG5cblx0XHRpZiAoIW1hdGNoZXNSZXNvbHZlZFN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMudGV4dEZpbHRlci50ZXh0KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0TWF0Y2hlcyA9XG5cdFx0XHQvLyBDaGVjayBib2R5IG9mIGNvbW1lbnQgZm9yIHZhbHVlXG5cdFx0XHRGaWx0ZXJPcHRpb25zLl9tZXNzYWdlRmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIHR5cGVvZiBjb21tZW50LmNvbW1lbnQuYm9keSA9PT0gJ3N0cmluZycgPyBjb21tZW50LmNvbW1lbnQuYm9keSA6IGNvbW1lbnQuY29tbWVudC5ib2R5LnZhbHVlKVxuXHRcdFx0Ly8gQ2hlY2sgZmlyc3QgdXNlciBmb3IgdmFsdWVcblx0XHRcdHx8IEZpbHRlck9wdGlvbnMuX21lc3NhZ2VGaWx0ZXIodGhpcy5vcHRpb25zLnRleHRGaWx0ZXIudGV4dCwgY29tbWVudC5jb21tZW50LnVzZXJOYW1lKVxuXHRcdFx0Ly8gQ2hlY2sgYWxsIHJlcGxpZXMgZm9yIHZhbHVlXG5cdFx0XHR8fCAoY29tbWVudC5yZXBsaWVzLm1hcChyZXBseSA9PiB7XG5cdFx0XHRcdC8vIENoZWNrIHVzZXIgZm9yIHZhbHVlXG5cdFx0XHRcdHJldHVybiBGaWx0ZXJPcHRpb25zLl9tZXNzYWdlRmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIHJlcGx5LmNvbW1lbnQudXNlck5hbWUpXG5cdFx0XHRcdFx0Ly8gQ2hlY2sgYm9keSBvZiByZXBseSBmb3IgdmFsdWVcblx0XHRcdFx0XHR8fCBGaWx0ZXJPcHRpb25zLl9tZXNzYWdlRmlsdGVyKHRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLnRleHQsIHR5cGVvZiByZXBseS5jb21tZW50LmJvZHkgPT09ICdzdHJpbmcnID8gcmVwbHkuY29tbWVudC5ib2R5IDogcmVwbHkuY29tbWVudC5ib2R5LnZhbHVlKTtcblx0XHRcdH0pLmZpbHRlcih2YWx1ZSA9PiAhIXZhbHVlKSBhcyBJTWF0Y2hbXVtdKS5mbGF0KCk7XG5cblx0XHQvLyBNYXRjaGVkIGFuZCBub3QgbmVnYXRlZFxuXHRcdGlmICh0ZXh0TWF0Y2hlcy5sZW5ndGggJiYgIXRoaXMub3B0aW9ucy50ZXh0RmlsdGVyLm5lZ2F0ZSkge1xuXHRcdFx0cmV0dXJuIHsgdmlzaWJpbGl0eTogdHJ1ZSwgZGF0YTogeyB0eXBlOiBGaWx0ZXJEYXRhVHlwZS5Db21tZW50LCB0ZXh0TWF0Y2hlcyB9IH07XG5cdFx0fVxuXG5cdFx0Ly8gTWF0Y2hlZCBhbmQgbmVnYXRlZCAtIGV4Y2x1ZGUgaXQgb25seSBpZiBwYXJlbnQgdmlzaWJpbGl0eSBpcyBub3Qgc2V0XG5cdFx0aWYgKHRleHRNYXRjaGVzLmxlbmd0aCAmJiB0aGlzLm9wdGlvbnMudGV4dEZpbHRlci5uZWdhdGUgJiYgcGFyZW50VmlzaWJpbGl0eSA9PT0gVHJlZVZpc2liaWxpdHkuUmVjdXJzZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIE5vdCBtYXRjaGVkIGFuZCBuZWdhdGVkIC0gaW5jbHVkZSBpdCBvbmx5IGlmIHBhcmVudCB2aXNpYmlsaXR5IGlzIG5vdCBzZXRcblx0XHRpZiAoKHRleHRNYXRjaGVzLmxlbmd0aCA9PT0gMCkgJiYgdGhpcy5vcHRpb25zLnRleHRGaWx0ZXIubmVnYXRlICYmIHBhcmVudFZpc2liaWxpdHkgPT09IFRyZWVWaXNpYmlsaXR5LlJlY3Vyc2UpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBwYXJlbnRWaXNpYmlsaXR5O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50c0xpc3QgZXh0ZW5kcyBXb3JrYmVuY2hPYmplY3RUcmVlPENvbW1lbnRzTW9kZWwgfCBSZXNvdXJjZVdpdGhDb21tZW50VGhyZWFkcyB8IENvbW1lbnROb2RlLCBhbnk+IHtcblx0cHJpdmF0ZSByZWFkb25seSBtZW51czogQ29tbWVudHNNZW51cztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRsYWJlbHM6IFJlc291cmNlTGFiZWxzLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0b3B0aW9uczogSUNvbW1lbnRzTGlzdE9wdGlvbnMsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlzdFNlcnZpY2UgbGlzdFNlcnZpY2U6IElMaXN0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IENvbW1lbnRzTW9kZWxWaXJ0dWFsRGVsZWdhdGUoKTtcblx0XHRjb25zdCBhY3Rpb25WaWV3SXRlbVByb3ZpZGVyID0gY3JlYXRlQWN0aW9uVmlld0l0ZW0uYmluZCh1bmRlZmluZWQsIGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBtZW51cyA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbW1lbnRzTWVudXMpO1xuXHRcdG1lbnVzLnNldENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCByZW5kZXJlcnMgPSBbXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXNvdXJjZVdpdGhDb21tZW50c1JlbmRlcmVyLCBsYWJlbHMpLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29tbWVudE5vZGVSZW5kZXJlciwgYWN0aW9uVmlld0l0ZW1Qcm92aWRlciwgbWVudXMpXG5cdFx0XTtcblxuXHRcdHN1cGVyKFxuXHRcdFx0J0NvbW1lbnRzVHJlZScsXG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRkZWxlZ2F0ZSxcblx0XHRcdHJlbmRlcmVycyxcblx0XHRcdHtcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBvcHRpb25zLmFjY2Vzc2liaWxpdHlQcm92aWRlcixcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldElkOiAoZWxlbWVudDogYW55KSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIENvbW1lbnRzTW9kZWwpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuICdyb290Jztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgUmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHMpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGAke2VsZW1lbnQudW5pcXVlT3duZXJ9LSR7ZWxlbWVudC5pZH1gO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBDb21tZW50Tm9kZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gYCR7ZWxlbWVudC51bmlxdWVPd25lcn0tJHtlbGVtZW50LnJlc291cmNlLnRvU3RyaW5nKCl9LSR7ZWxlbWVudC50aHJlYWRJZH0tJHtlbGVtZW50LmNvbW1lbnQudW5pcXVlSWRJblRocmVhZH1gICsgKGVsZW1lbnQuaXNSb290ID8gJy1yb290JyA6ICcnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljazogdHJ1ZSxcblx0XHRcdFx0Y29sbGFwc2VCeURlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0XHRvdmVycmlkZVN0eWxlczogb3B0aW9ucy5vdmVycmlkZVN0eWxlcyxcblx0XHRcdFx0ZmlsdGVyOiBvcHRpb25zLmZpbHRlcixcblx0XHRcdFx0c29ydGVyOiBvcHRpb25zLnNvcnRlcixcblx0XHRcdFx0ZmluZFdpZGdldEVuYWJsZWQ6IGZhbHNlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdFx0Y29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRsaXN0U2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdCk7XG5cdFx0dGhpcy5tZW51cyA9IG1lbnVzO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMub25Db250ZXh0TWVudShlID0+IHRoaXMuY29tbWVudHNPbkNvbnRleHRNZW51KGUpKSk7XG5cdH1cblxuXHRwcml2YXRlIGNvbW1lbnRzT25Db250ZXh0TWVudSh0cmVlRXZlbnQ6IElUcmVlQ29udGV4dE1lbnVFdmVudDxDb21tZW50c01vZGVsIHwgUmVzb3VyY2VXaXRoQ29tbWVudFRocmVhZHMgfCBDb21tZW50Tm9kZSB8IG51bGw+KTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZTogQ29tbWVudHNNb2RlbCB8IFJlc291cmNlV2l0aENvbW1lbnRUaHJlYWRzIHwgQ29tbWVudE5vZGUgfCBudWxsID0gdHJlZUV2ZW50LmVsZW1lbnQ7XG5cdFx0aWYgKCEobm9kZSBpbnN0YW5jZW9mIENvbW1lbnROb2RlKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBldmVudDogVUlFdmVudCA9IHRyZWVFdmVudC5icm93c2VyRXZlbnQ7XG5cblx0XHRldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0dGhpcy5zZXRGb2N1cyhbbm9kZV0pO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLm1lbnVzLmdldFJlc291cmNlQ29udGV4dEFjdGlvbnMobm9kZSk7XG5cdFx0aWYgKCFhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0cmVlRXZlbnQuYW5jaG9yLFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdGdldEFjdGlvblZpZXdJdGVtOiAoYWN0aW9uKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKTtcblx0XHRcdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgYWN0aW9uLCB7IGxhYmVsOiB0cnVlLCBrZXliaW5kaW5nOiBrZXliaW5kaW5nLmdldExhYmVsKCkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGU6ICh3YXNDYW5jZWxsZWQ/OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICh3YXNDYW5jZWxsZWQpIHtcblx0XHRcdFx0XHR0aGlzLmRvbUZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCk6IE1hcnNoYWxsZWRDb21tZW50VGhyZWFkSW50ZXJuYWwgPT4gKHtcblx0XHRcdFx0Y29tbWVudENvbnRyb2xIYW5kbGU6IG5vZGUuY29udHJvbGxlckhhbmRsZSxcblx0XHRcdFx0Y29tbWVudFRocmVhZEhhbmRsZTogbm9kZS50aHJlYWRIYW5kbGUsXG5cdFx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5Db21tZW50VGhyZWFkLFxuXHRcdFx0XHR0aHJlYWQ6IG5vZGUudGhyZWFkXG5cdFx0XHR9KVxuXHRcdH0pO1xuXHR9XG5cblx0ZmlsdGVyQ29tbWVudHMoKTogdm9pZCB7XG5cdFx0dGhpcy5yZWZpbHRlcigpO1xuXHR9XG5cblx0Z2V0VmlzaWJsZUl0ZW1Db3VudCgpOiBudW1iZXIge1xuXHRcdGxldCBmaWx0ZXJlZCA9IDA7XG5cdFx0Y29uc3Qgcm9vdCA9IHRoaXMuZ2V0Tm9kZSgpO1xuXG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZU5vZGUgb2Ygcm9vdC5jaGlsZHJlbikge1xuXHRcdFx0Zm9yIChjb25zdCBjb21tZW50Tm9kZSBvZiByZXNvdXJjZU5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0aWYgKGNvbW1lbnROb2RlLnZpc2libGUgJiYgcmVzb3VyY2VOb2RlLnZpc2libGUpIHtcblx0XHRcdFx0XHRmaWx0ZXJlZCsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbHRlcmVkO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFDckIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBc0IsdUJBQXVCO0FBQzdDLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsYUFBYSxrQ0FBa0M7QUFDeEQsU0FBMEUsc0JBQXNCO0FBRWhHLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsY0FBOEMsMkJBQTJCO0FBQ2xGLFNBQXNCLHFCQUFxQjtBQUMzQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyxnQ0FBZ0Msc0NBQXNDO0FBQy9F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
