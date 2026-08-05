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
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import * as languages from "../../../../editor/common/languages.js";
import { ActionsOrientation, ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Action, Separator, ActionRunner } from "../../../../base/common/actions.js";
import { Disposable, DisposableStore, MutableDisposable, dispose } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommentService } from "./commentService.js";
import { MIN_EDITOR_HEIGHT, SimpleCommentEditor, calculateEditorHeight } from "./simpleCommentEditor.js";
import { Emitter } from "../../../../base/common/event.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { ToolBar } from "../../../../base/browser/ui/toolbar/toolbar.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { AnchorAlignment } from "../../../../base/browser/ui/contextview/contextview.js";
import { ToggleReactionsAction, ReactionAction, ReactionActionViewItem } from "./reactionsAction.js";
import { MenuItemAction, SubmenuItemAction, MenuId } from "../../../../platform/actions/common/actions.js";
import { MenuEntryActionViewItem, SubmenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { CommentFormActions } from "./commentFormActions.js";
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from "../../../../base/browser/ui/mouseCursor/mouseCursor.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { TimestampWidget } from "./timestamp.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Scrollable, ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { SmoothScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { FileAccess, Schemas } from "../../../../base/common/network.js";
import { COMMENTS_SECTION } from "../common/commentsConfiguration.js";
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { Position } from "../../../../editor/common/core/position.js";
class CommentsActionRunner extends ActionRunner {
  async runAction(action, context) {
    await action.run(...context);
  }
}
let CommentNode = class extends Disposable {
  constructor(parentEditor, commentThread, comment, pendingEdit, owner, resource, parentThread, markdownRenderer, instantiationService, commentService, notificationService, contextMenuService, contextKeyService, configurationService, hoverService, accessibilityService, keybindingService, textModelService) {
    super();
    this.parentEditor = parentEditor;
    this.commentThread = commentThread;
    this.comment = comment;
    this.pendingEdit = pendingEdit;
    this.owner = owner;
    this.resource = resource;
    this.parentThread = parentThread;
    this.markdownRenderer = markdownRenderer;
    this.instantiationService = instantiationService;
    this.commentService = commentService;
    this.notificationService = notificationService;
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.accessibilityService = accessibilityService;
    this.keybindingService = keybindingService;
    this.textModelService = textModelService;
    this._md = this._register(new MutableDisposable());
    this._editAction = null;
    this._commentEditContainer = null;
    this._reactionsActionBar = this._register(new MutableDisposable());
    this._reactionActions = this._register(new DisposableStore());
    this._commentEditor = null;
    this._commentEditorDisposables = [];
    this._commentEditorModel = null;
    this._editorHeight = MIN_EDITOR_HEIGHT;
    this._actionRunner = this._register(new CommentsActionRunner());
    this.toolbar = this._register(new MutableDisposable());
    this._commentFormActions = null;
    this._commentEditorActions = null;
    this._onDidClick = new Emitter();
    this.isEditing = false;
    this._domNode = dom.$("div.review-comment");
    this._contextKeyService = this._register(contextKeyService.createScoped(this._domNode));
    this._commentContextValue = CommentContextKeys.commentContext.bindTo(this._contextKeyService);
    if (this.comment.contextValue) {
      this._commentContextValue.set(this.comment.contextValue);
    }
    this._commentMenus = this.commentService.getCommentMenus(this.owner);
    this._domNode.tabIndex = -1;
    this._avatar = dom.append(this._domNode, dom.$("div.avatar-container"));
    this.updateCommentUserIcon(this.comment.userIconPath);
    this._commentDetailsContainer = dom.append(this._domNode, dom.$(".review-comment-contents"));
    this.createHeader(this._commentDetailsContainer);
    this._body = document.createElement(`div`);
    this._body.classList.add("comment-body", MOUSE_CURSOR_TEXT_CSS_CLASS_NAME);
    if (configurationService.getValue(COMMENTS_SECTION)?.maxHeight !== false) {
      this._body.classList.add("comment-body-max-height");
    }
    this.createScroll(this._commentDetailsContainer, this._body);
    this.updateCommentBody(this.comment.body);
    this.createReactionsContainer(this._commentDetailsContainer);
    this._domNode.setAttribute("aria-label", `${comment.userName}, ${this.commentBodyValue}`);
    this._domNode.setAttribute("role", "treeitem");
    this._clearTimeout = null;
    this._register(dom.addDisposableListener(this._domNode, dom.EventType.CLICK, () => this.isEditing || this._onDidClick.fire(this)));
    this._register(dom.addDisposableListener(this._domNode, dom.EventType.CONTEXT_MENU, (e) => {
      return this.onContextMenu(e);
    }));
    if (pendingEdit) {
      this.switchToEditMode();
    }
    this._register(this.accessibilityService.onDidChangeScreenReaderOptimized(() => {
      this.toggleToolbarHidden(true);
    }));
    this.activeCommentListeners();
  }
  get domNode() {
    return this._domNode;
  }
  activeCommentListeners() {
    this._register(dom.addDisposableListener(this._domNode, dom.EventType.FOCUS_IN, () => {
      this.commentService.setActiveCommentAndThread(this.owner, { thread: this.commentThread, comment: this.comment });
    }, true));
  }
  createScroll(container, body) {
    this._scrollable = this._register(new Scrollable({
      forceIntegerValues: true,
      smoothScrollDuration: 125,
      scheduleAtNextAnimationFrame: (cb) => dom.scheduleAtNextAnimationFrame(dom.getWindow(container), cb)
    }));
    this._scrollableElement = this._register(new SmoothScrollableElement(body, {
      horizontal: ScrollbarVisibility.Visible,
      vertical: ScrollbarVisibility.Visible
    }, this._scrollable));
    this._register(this._scrollableElement.onScroll((e) => {
      if (e.scrollLeftChanged) {
        body.scrollLeft = e.scrollLeft;
      }
      if (e.scrollTopChanged) {
        body.scrollTop = e.scrollTop;
      }
    }));
    const onDidScrollViewContainer = this._register(new DomEmitter(body, "scroll")).event;
    this._register(onDidScrollViewContainer((_) => {
      const position = this._scrollableElement.getScrollPosition();
      const scrollLeft = Math.abs(body.scrollLeft - position.scrollLeft) <= 1 ? void 0 : body.scrollLeft;
      const scrollTop = Math.abs(body.scrollTop - position.scrollTop) <= 1 ? void 0 : body.scrollTop;
      if (scrollLeft !== void 0 || scrollTop !== void 0) {
        this._scrollableElement.setScrollPosition({ scrollLeft, scrollTop });
      }
    }));
    container.appendChild(this._scrollableElement.getDomNode());
  }
  updateCommentBody(body) {
    this._body.innerText = "";
    this._md.clear();
    this._plainText = void 0;
    if (typeof body === "string") {
      this._plainText = dom.append(this._body, dom.$(".comment-body-plainstring"));
      this._plainText.innerText = body;
    } else {
      this._md.value = this.markdownRenderer.render(body);
      this._body.appendChild(this._md.value.element);
    }
  }
  updateCommentUserIcon(userIconPath) {
    this._avatar.textContent = "";
    if (userIconPath) {
      const img = dom.append(this._avatar, dom.$("img.avatar"));
      img.src = FileAccess.uriToBrowserUri(URI.revive(userIconPath)).toString(true);
      img.onerror = (_) => img.remove();
    }
  }
  get onDidClick() {
    return this._onDidClick.event;
  }
  createTimestamp(container) {
    this._timestamp = dom.append(container, dom.$("span.timestamp-container"));
    this.updateTimestamp(this.comment.timestamp);
  }
  updateTimestamp(raw) {
    if (!this._timestamp) {
      return;
    }
    const timestamp = raw !== void 0 ? new Date(raw) : void 0;
    if (!timestamp) {
      this._timestampWidget?.dispose();
    } else {
      if (!this._timestampWidget) {
        this._timestampWidget = new TimestampWidget(this.configurationService, this.hoverService, this._timestamp, timestamp);
        this._register(this._timestampWidget);
      } else {
        this._timestampWidget.setTimestamp(timestamp);
      }
    }
  }
  createHeader(commentDetailsContainer) {
    const header = dom.append(commentDetailsContainer, dom.$(`div.comment-title.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
    const infoContainer = dom.append(header, dom.$("comment-header-info"));
    const author = dom.append(infoContainer, dom.$("strong.author"));
    author.innerText = this.comment.userName;
    this.createTimestamp(infoContainer);
    this._isPendingLabel = dom.append(infoContainer, dom.$("span.isPending"));
    if (this.comment.label) {
      this._isPendingLabel.innerText = this.comment.label;
    } else {
      this._isPendingLabel.innerText = "";
    }
    this._actionsToolbarContainer = dom.append(header, dom.$(".comment-actions"));
    this.toggleToolbarHidden(true);
    this.createActionsToolbar();
  }
  toggleToolbarHidden(hidden) {
    if (hidden && !this.accessibilityService.isScreenReaderOptimized()) {
      this._actionsToolbarContainer.classList.add("hidden");
    } else {
      this._actionsToolbarContainer.classList.remove("hidden");
    }
  }
  getToolbarActions(menu) {
    const contributedActions = menu.getActions({ shouldForwardArgs: true });
    const primary = [];
    const secondary = [];
    const result = { primary, secondary };
    fillInActions(contributedActions, result, false, (g) => /^inline/.test(g));
    return result;
  }
  get commentNodeContext() {
    return [
      {
        thread: this.commentThread,
        commentUniqueId: this.comment.uniqueIdInThread,
        $mid: MarshalledId.CommentNode
      },
      {
        commentControlHandle: this.commentThread.controllerHandle,
        commentThreadHandle: this.commentThread.commentThreadHandle,
        $mid: MarshalledId.CommentThread
      }
    ];
  }
  createToolbar() {
    this.toolbar.value = new ToolBar(this._actionsToolbarContainer, this.contextMenuService, {
      actionViewItemProvider: (action, options) => {
        if (action.id === ToggleReactionsAction.ID) {
          return new DropdownMenuActionViewItem(
            action,
            action.menuActions,
            this.contextMenuService,
            {
              ...options,
              actionViewItemProvider: (action2, options2) => this.actionViewItemProvider(action2, options2),
              classNames: ["toolbar-toggle-pickReactions", ...ThemeIcon.asClassNameArray(Codicon.reactions)],
              anchorAlignmentProvider: () => AnchorAlignment.RIGHT
            }
          );
        }
        return this.actionViewItemProvider(action, options);
      },
      orientation: ActionsOrientation.HORIZONTAL
    });
    this.toolbar.value.context = this.commentNodeContext;
    this.toolbar.value.actionRunner = this._actionRunner;
    this.registerActionBarListeners(this._actionsToolbarContainer);
  }
  createActionsToolbar() {
    const actions = [];
    const hasReactionHandler = this.commentService.hasReactionHandler(this.owner);
    const toggleReactionAction = hasReactionHandler ? this.createReactionPicker(this.comment.commentReactions || []) : void 0;
    if (toggleReactionAction) {
      actions.push(toggleReactionAction);
    }
    const menu = this._commentMenus.getCommentTitleActions(this.comment, this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange((e) => {
      const { primary: primary2, secondary: secondary2 } = this.getToolbarActions(menu);
      if (!this.toolbar && (primary2.length || secondary2.length)) {
        this.createToolbar();
      }
      if (toggleReactionAction) {
        primary2.unshift(toggleReactionAction);
      }
      this.toolbar.value.setActions(primary2, secondary2);
    }));
    const { primary, secondary } = this.getToolbarActions(menu);
    actions.push(...primary);
    if (actions.length || secondary.length) {
      this.createToolbar();
      this.toolbar.value.setActions(actions, secondary);
    }
  }
  actionViewItemProvider(action, options) {
    if (action.id === ToggleReactionsAction.ID) {
      options = { label: false, icon: true };
    } else {
      options = { label: false, icon: true };
    }
    if (action.id === ReactionAction.ID) {
      const item = new ReactionActionViewItem(action);
      return item;
    } else if (action instanceof MenuItemAction) {
      return this.instantiationService.createInstance(MenuEntryActionViewItem, action, { hoverDelegate: options.hoverDelegate });
    } else if (action instanceof SubmenuItemAction) {
      return this.instantiationService.createInstance(SubmenuEntryActionViewItem, action, options);
    } else {
      const item = new ActionViewItem({}, action, options);
      return item;
    }
  }
  async submitComment() {
    if (this._commentEditor && this._commentFormActions) {
      await this._commentFormActions.triggerDefaultAction();
      this.pendingEdit = void 0;
    }
  }
  createReactionPicker(reactionGroup) {
    const toggleReactionAction = this._reactionActions.add(new ToggleReactionsAction(() => {
      toggleReactionActionViewItem?.show();
    }, nls.localize("commentToggleReaction", "Toggle Reaction")));
    let reactionMenuActions = [];
    if (reactionGroup && reactionGroup.length) {
      reactionMenuActions = reactionGroup.map((reaction) => {
        return this._reactionActions.add(new Action(`reaction.command.${reaction.label}`, `${reaction.label}`, "", true, async () => {
          try {
            await this.commentService.toggleReaction(this.owner, this.resource, this.commentThread, this.comment, reaction);
          } catch (e) {
            const error = e.message ? nls.localize("commentToggleReactionError", "Toggling the comment reaction failed: {0}.", e.message) : nls.localize("commentToggleReactionDefaultError", "Toggling the comment reaction failed");
            this.notificationService.error(error);
          }
        }));
      });
    }
    toggleReactionAction.menuActions = reactionMenuActions;
    const toggleReactionActionViewItem = this._reactionActions.add(new DropdownMenuActionViewItem(
      toggleReactionAction,
      toggleReactionAction.menuActions,
      this.contextMenuService,
      {
        actionViewItemProvider: (action, options) => {
          if (action.id === ToggleReactionsAction.ID) {
            return toggleReactionActionViewItem;
          }
          return this.actionViewItemProvider(action, options);
        },
        classNames: "toolbar-toggle-pickReactions",
        anchorAlignmentProvider: () => AnchorAlignment.RIGHT
      }
    ));
    return toggleReactionAction;
  }
  createReactionsContainer(commentDetailsContainer) {
    this._reactionActionsContainer?.remove();
    this._reactionsActionBar.clear();
    this._reactionActions.clear();
    this._reactionActionsContainer = dom.append(commentDetailsContainer, dom.$("div.comment-reactions"));
    this._reactionsActionBar.value = new ActionBar(this._reactionActionsContainer, {
      actionViewItemProvider: (action, options) => {
        if (action.id === ToggleReactionsAction.ID) {
          return new DropdownMenuActionViewItem(
            action,
            action.menuActions,
            this.contextMenuService,
            {
              actionViewItemProvider: (action2, options2) => this.actionViewItemProvider(action2, options2),
              classNames: ["toolbar-toggle-pickReactions", ...ThemeIcon.asClassNameArray(Codicon.reactions)],
              anchorAlignmentProvider: () => AnchorAlignment.RIGHT
            }
          );
        }
        return this.actionViewItemProvider(action, options);
      }
    });
    const hasReactionHandler = this.commentService.hasReactionHandler(this.owner);
    this.comment.commentReactions?.filter((reaction) => !!reaction.count).map((reaction) => {
      const action = this._reactionActions.add(new ReactionAction(`reaction.${reaction.label}`, `${reaction.label}`, reaction.hasReacted && (reaction.canEdit || hasReactionHandler) ? "active" : "", reaction.canEdit || hasReactionHandler, async () => {
        try {
          await this.commentService.toggleReaction(this.owner, this.resource, this.commentThread, this.comment, reaction);
        } catch (e) {
          let error;
          if (reaction.hasReacted) {
            error = e.message ? nls.localize("commentDeleteReactionError", "Deleting the comment reaction failed: {0}.", e.message) : nls.localize("commentDeleteReactionDefaultError", "Deleting the comment reaction failed");
          } else {
            error = e.message ? nls.localize("commentAddReactionError", "Deleting the comment reaction failed: {0}.", e.message) : nls.localize("commentAddReactionDefaultError", "Deleting the comment reaction failed");
          }
          this.notificationService.error(error);
        }
      }, reaction.reactors, reaction.iconPath, reaction.count));
      this._reactionsActionBar.value?.push(action, { label: true, icon: true });
    });
    if (hasReactionHandler) {
      const toggleReactionAction = this.createReactionPicker(this.comment.commentReactions || []);
      this._reactionsActionBar.value?.push(toggleReactionAction, { label: false, icon: true });
    }
  }
  get commentBodyValue() {
    return typeof this.comment.body === "string" ? this.comment.body : this.comment.body.value;
  }
  async createCommentEditor(editContainer) {
    const container = dom.append(editContainer, dom.$(".edit-textarea"));
    this._commentEditor = this.instantiationService.createInstance(SimpleCommentEditor, container, SimpleCommentEditor.getEditorOptions(this.configurationService), this._contextKeyService, this.parentThread);
    const resource = URI.from({
      scheme: Schemas.commentsInput,
      path: `/commentinput-${this.comment.uniqueIdInThread}-${Date.now()}.md`
    });
    const modelRef = await this.textModelService.createModelReference(resource);
    this._commentEditorModel = modelRef;
    this._commentEditor.setModel(this._commentEditorModel.object.textEditorModel);
    this._commentEditor.setValue(this.pendingEdit?.body ?? this.commentBodyValue);
    if (this.pendingEdit) {
      this._commentEditor.setPosition(this.pendingEdit.cursor);
    } else {
      const lastLine = this._commentEditorModel.object.textEditorModel.getLineCount();
      const lastColumn = this._commentEditorModel.object.textEditorModel.getLineLength(lastLine) + 1;
      this._commentEditor.setPosition(new Position(lastLine, lastColumn));
    }
    this.pendingEdit = void 0;
    this._commentEditor.layout({ width: container.clientWidth - 14, height: this._editorHeight });
    this._commentEditor.focus();
    dom.scheduleAtNextAnimationFrame(dom.getWindow(editContainer), () => {
      this._commentEditor.layout({ width: container.clientWidth - 14, height: this._editorHeight });
      this._commentEditor.focus();
    });
    const commentThread = this.commentThread;
    commentThread.input = {
      uri: this._commentEditor.getModel().uri,
      value: this.commentBodyValue
    };
    this.commentService.setActiveEditingCommentThread(commentThread);
    this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
    this._commentEditorDisposables.push(this._commentEditor.onDidFocusEditorWidget(() => {
      commentThread.input = {
        uri: this._commentEditor.getModel().uri,
        value: this.commentBodyValue
      };
      this.commentService.setActiveEditingCommentThread(commentThread);
      this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
    }));
    this._commentEditorDisposables.push(this._commentEditor.onDidChangeModelContent((e) => {
      if (commentThread.input && this._commentEditor && this._commentEditor.getModel().uri === commentThread.input.uri) {
        const newVal = this._commentEditor.getValue();
        if (newVal !== commentThread.input.value) {
          const input = commentThread.input;
          input.value = newVal;
          commentThread.input = input;
          this.commentService.setActiveEditingCommentThread(commentThread);
          this.commentService.setActiveCommentAndThread(this.owner, { thread: commentThread, comment: this.comment });
        }
      }
    }));
    this.calculateEditorHeight();
    this._register(this._commentEditorModel.object.textEditorModel.onDidChangeContent(() => {
      if (this._commentEditor && this.calculateEditorHeight()) {
        this._commentEditor.layout({ height: this._editorHeight, width: this._commentEditor.getLayoutInfo().width });
        this._commentEditor.render(true);
      }
    }));
    this._register(this._commentEditor);
    this._register(this._commentEditorModel);
  }
  calculateEditorHeight() {
    if (this._commentEditor) {
      const newEditorHeight = calculateEditorHeight(this.parentEditor, this._commentEditor, this._editorHeight);
      if (newEditorHeight !== this._editorHeight) {
        this._editorHeight = newEditorHeight;
        return true;
      }
    }
    return false;
  }
  getPendingEdit() {
    const model = this._commentEditor?.getModel();
    if (this._commentEditor && model && model.getValueLength() > 0) {
      return { body: model.getValue(), cursor: this._commentEditor.getPosition() };
    }
    return void 0;
  }
  removeCommentEditor() {
    this.isEditing = false;
    if (this._editAction) {
      this._editAction.enabled = true;
    }
    this._body.classList.remove("hidden");
    this._commentEditorModel?.dispose();
    dispose(this._commentEditorDisposables);
    this._commentEditorDisposables = [];
    this._commentEditor?.dispose();
    this._commentEditor = null;
    this._commentEditContainer.remove();
  }
  layout(widthInPixel) {
    const editorWidth = widthInPixel !== void 0 ? widthInPixel - 72 : this._commentEditor?.getLayoutInfo().width ?? 0;
    this._commentEditor?.layout({ width: editorWidth, height: this._editorHeight });
    const scrollWidth = this._body.scrollWidth;
    const width = dom.getContentWidth(this._body);
    const scrollHeight = this._body.scrollHeight;
    const height = dom.getContentHeight(this._body) + 4;
    this._scrollableElement.setScrollDimensions({ width, scrollWidth, height, scrollHeight });
  }
  async switchToEditMode() {
    if (this.isEditing) {
      return;
    }
    this.isEditing = true;
    this._body.classList.add("hidden");
    this._commentEditContainer = dom.append(this._commentDetailsContainer, dom.$(".edit-container"));
    await this.createCommentEditor(this._commentEditContainer);
    const formActions = dom.append(this._commentEditContainer, dom.$(".form-actions"));
    const otherActions = dom.append(formActions, dom.$(".other-actions"));
    this.createCommentWidgetFormActions(otherActions);
    const editorActions = dom.append(formActions, dom.$(".editor-actions"));
    this.createCommentWidgetEditorActions(editorActions);
  }
  createCommentWidgetFormActions(container) {
    const menus = this.commentService.getCommentMenus(this.owner);
    const menu = menus.getCommentActions(this.comment, this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange(() => {
      this._commentFormActions?.setActions(menu);
    }));
    this._commentFormActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, (action) => {
      const text = this._commentEditor.getValue();
      action.run({
        thread: this.commentThread,
        commentUniqueId: this.comment.uniqueIdInThread,
        text,
        $mid: MarshalledId.CommentThreadNode
      });
      this.removeCommentEditor();
    });
    this._register(this._commentFormActions);
    this._commentFormActions.setActions(menu);
  }
  createCommentWidgetEditorActions(container) {
    const menus = this.commentService.getCommentMenus(this.owner);
    const menu = menus.getCommentEditorActions(this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange(() => {
      this._commentEditorActions?.setActions(menu, true);
    }));
    this._commentEditorActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, (action) => {
      const text = this._commentEditor.getValue();
      action.run({
        thread: this.commentThread,
        commentUniqueId: this.comment.uniqueIdInThread,
        text,
        $mid: MarshalledId.CommentThreadNode
      });
      this._commentEditor?.focus();
    });
    this._register(this._commentEditorActions);
    this._commentEditorActions.setActions(menu, true);
  }
  setFocus(focused, visible = false) {
    if (focused) {
      this._domNode.focus();
      this.toggleToolbarHidden(false);
      this._actionsToolbarContainer.classList.add("tabfocused");
      this._domNode.tabIndex = 0;
      if (this.comment.mode === languages.CommentMode.Editing) {
        this._commentEditor?.focus();
      }
    } else {
      if (this._actionsToolbarContainer.classList.contains("tabfocused") && !this._actionsToolbarContainer.classList.contains("mouseover")) {
        this.toggleToolbarHidden(true);
        this._domNode.tabIndex = -1;
      }
      this._actionsToolbarContainer.classList.remove("tabfocused");
    }
  }
  registerActionBarListeners(actionsContainer) {
    this._register(dom.addDisposableListener(this._domNode, "mouseenter", () => {
      this.toggleToolbarHidden(false);
      actionsContainer.classList.add("mouseover");
    }));
    this._register(dom.addDisposableListener(this._domNode, "mouseleave", () => {
      if (actionsContainer.classList.contains("mouseover") && !actionsContainer.classList.contains("tabfocused")) {
        this.toggleToolbarHidden(true);
      }
      actionsContainer.classList.remove("mouseover");
    }));
  }
  async update(newComment) {
    if (newComment.body !== this.comment.body) {
      this.updateCommentBody(newComment.body);
    }
    if (this.comment.userIconPath && newComment.userIconPath && URI.from(this.comment.userIconPath).toString() !== URI.from(newComment.userIconPath).toString()) {
      this.updateCommentUserIcon(newComment.userIconPath);
    }
    const isChangingMode = newComment.mode !== void 0 && newComment.mode !== this.comment.mode;
    this.comment = newComment;
    if (isChangingMode) {
      if (newComment.mode === languages.CommentMode.Editing) {
        await this.switchToEditMode();
      } else {
        this.removeCommentEditor();
      }
    }
    if (newComment.label) {
      this._isPendingLabel.innerText = newComment.label;
    } else {
      this._isPendingLabel.innerText = "";
    }
    this.createReactionsContainer(this._commentDetailsContainer);
    if (this.comment.contextValue) {
      this._commentContextValue.set(this.comment.contextValue);
    } else {
      this._commentContextValue.reset();
    }
    if (this.comment.timestamp) {
      this.updateTimestamp(this.comment.timestamp);
    }
  }
  onContextMenu(e) {
    const event = new StandardMouseEvent(dom.getWindow(this._domNode), e);
    this.contextMenuService.showContextMenu({
      getAnchor: () => event,
      menuId: MenuId.CommentThreadCommentContext,
      menuActionOptions: { shouldForwardArgs: true },
      contextKeyService: this._contextKeyService,
      actionRunner: this._actionRunner,
      getActionsContext: () => {
        return this.commentNodeContext;
      }
    });
  }
  focus() {
    this.domNode.focus();
    if (!this._clearTimeout) {
      this.domNode.classList.add("focus");
      this._clearTimeout = setTimeout(() => {
        this.domNode.classList.remove("focus");
      }, 3e3);
    }
  }
  dispose() {
    super.dispose();
    dispose(this._commentEditorDisposables);
  }
};
CommentNode = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ICommentService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IContextMenuService),
  __decorateParam(12, IContextKeyService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IAccessibilityService),
  __decorateParam(16, IKeybindingService),
  __decorateParam(17, ITextModelService)
], CommentNode);
function fillInActions(groups, target, useAlternativeActions, isPrimaryGroup = (group) => group === "navigation") {
  for (const tuple of groups) {
    let [group, actions] = tuple;
    if (useAlternativeActions) {
      actions = actions.map((a) => a instanceof MenuItemAction && !!a.alt ? a.alt : a);
    }
    if (isPrimaryGroup(group)) {
      const to = Array.isArray(target) ? target : target.primary;
      to.unshift(...actions);
    } else {
      const to = Array.isArray(target) ? target : target.secondary;
      if (to.length > 0) {
        to.push(new Separator());
      }
      to.push(...actions);
    }
  }
}
export {
  CommentNode
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnROb2RlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uc09yaWVudGF0aW9uLCBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciwgQWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBJUmVmZXJlbmNlLCBNdXRhYmxlRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duUmVuZGVyUmVzdWx0LCBNYXJrZG93blJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L21hcmtkb3duUmVuZGVyZXIvYnJvd3Nlci9tYXJrZG93blJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi9jb21tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBMYXlvdXRhYmxlRWRpdG9yLCBNSU5fRURJVE9SX0hFSUdIVCwgU2ltcGxlQ29tbWVudEVkaXRvciwgY2FsY3VsYXRlRWRpdG9ySGVpZ2h0IH0gZnJvbSAnLi9zaW1wbGVDb21tZW50RWRpdG9yLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Rvb2xiYXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBBbmNob3JBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgVG9nZ2xlUmVhY3Rpb25zQWN0aW9uLCBSZWFjdGlvbkFjdGlvbiwgUmVhY3Rpb25BY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4vcmVhY3Rpb25zQWN0aW9uLmpzJztcbmltcG9ydCB7IElDb21tZW50VGhyZWFkV2lkZ2V0IH0gZnJvbSAnLi4vY29tbW9uL2NvbW1lbnRUaHJlYWRXaWRnZXQuanMnO1xuaW1wb3J0IHsgTWVudUl0ZW1BY3Rpb24sIFN1Ym1lbnVJdGVtQWN0aW9uLCBJTWVudSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgU3VibWVudUVudHJ5QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgQ29tbWVudEZvcm1BY3Rpb25zIH0gZnJvbSAnLi9jb21tZW50Rm9ybUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgTU9VU0VfQ1VSU09SX1RFWFRfQ1NTX0NMQVNTX05BTUUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbW91c2VDdXJzb3IvbW91c2VDdXJzb3IuanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0sIElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kcm9wZG93bi9kcm9wZG93bkFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgVGltZXN0YW1wV2lkZ2V0IH0gZnJvbSAnLi90aW1lc3RhbXAuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUNlbGxSYW5nZSB9IGZyb20gJy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va1JhbmdlLmpzJztcbmltcG9ydCB7IENvbW1lbnRNZW51cyB9IGZyb20gJy4vY29tbWVudE1lbnVzLmpzJztcbmltcG9ydCB7IFNjcm9sbGFibGUsIFNjcm9sbGJhclZpc2liaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zY3JvbGxhYmxlLmpzJztcbmltcG9ydCB7IFNtb290aFNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2V2ZW50LmpzJztcbmltcG9ydCB7IENvbW1lbnRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcywgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgQ09NTUVOVFNfU0VDVElPTiwgSUNvbW1lbnRzQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50c0NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRDb21tZW50VGhyZWFkIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbW1lbnRzLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbCwgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5cbmNsYXNzIENvbW1lbnRzQWN0aW9uUnVubmVyIGV4dGVuZHMgQWN0aW9uUnVubmVyIHtcblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIHJ1bkFjdGlvbihhY3Rpb246IElBY3Rpb24sIGNvbnRleHQ6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgYWN0aW9uLnJ1biguLi5jb250ZXh0KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29tbWVudE5vZGU8VCBleHRlbmRzIElSYW5nZSB8IElDZWxsUmFuZ2U+IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX2RvbU5vZGU6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9ib2R5OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfYXZhdGFyOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbWQ6IE11dGFibGVEaXNwb3NhYmxlPElNYXJrZG93blJlbmRlclJlc3VsdD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgX3BsYWluVGV4dDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2NsZWFyVGltZW91dDogYW55O1xuXG5cdHByaXZhdGUgX2VkaXRBY3Rpb246IEFjdGlvbiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9jb21tZW50RWRpdENvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfY29tbWVudERldGFpbHNDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9hY3Rpb25zVG9vbGJhckNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWFjdGlvbnNBY3Rpb25CYXI6IE11dGFibGVEaXNwb3NhYmxlPEFjdGlvbkJhcj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlYWN0aW9uQWN0aW9uczogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfcmVhY3Rpb25BY3Rpb25zQ29udGFpbmVyPzogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2NvbW1lbnRFZGl0b3I6IFNpbXBsZUNvbW1lbnRFZGl0b3IgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfY29tbWVudEVkaXRvckRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZVtdID0gW107XG5cdHByaXZhdGUgX2NvbW1lbnRFZGl0b3JNb2RlbDogSVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2VkaXRvckhlaWdodCA9IE1JTl9FRElUT1JfSEVJR0hUO1xuXG5cdHByaXZhdGUgX2lzUGVuZGluZ0xhYmVsITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3RpbWVzdGFtcDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3RpbWVzdGFtcFdpZGdldDogVGltZXN0YW1wV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIF9jb21tZW50Q29udGV4dFZhbHVlOiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXHRwcml2YXRlIF9jb21tZW50TWVudXM6IENvbW1lbnRNZW51cztcblxuXHRwcml2YXRlIF9zY3JvbGxhYmxlITogU2Nyb2xsYWJsZTtcblx0cHJpdmF0ZSBfc2Nyb2xsYWJsZUVsZW1lbnQhOiBTbW9vdGhTY3JvbGxhYmxlRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25SdW5uZXI6IENvbW1lbnRzQWN0aW9uUnVubmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbW1lbnRzQWN0aW9uUnVubmVyKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHRvb2xiYXI6IE11dGFibGVEaXNwb3NhYmxlPFRvb2xCYXI+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIF9jb21tZW50Rm9ybUFjdGlvbnM6IENvbW1lbnRGb3JtQWN0aW9ucyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9jb21tZW50RWRpdG9yQWN0aW9uczogQ29tbWVudEZvcm1BY3Rpb25zIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDbGljayA9IG5ldyBFbWl0dGVyPENvbW1lbnROb2RlPFQ+PigpO1xuXG5cdHB1YmxpYyBnZXQgZG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RvbU5vZGU7XG5cdH1cblxuXHRwdWJsaWMgaXNFZGl0aW5nOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYXJlbnRFZGl0b3I6IExheW91dGFibGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSBjb21tZW50VGhyZWFkOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZDxUPixcblx0XHRwdWJsaWMgY29tbWVudDogbGFuZ3VhZ2VzLkNvbW1lbnQsXG5cdFx0cHJpdmF0ZSBwZW5kaW5nRWRpdDogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgb3duZXI6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlc291cmNlOiBVUkksXG5cdFx0cHJpdmF0ZSBwYXJlbnRUaHJlYWQ6IElDb21tZW50VGhyZWFkV2lkZ2V0LFxuXHRcdHByaXZhdGUgbWFya2Rvd25SZW5kZXJlcjogTWFya2Rvd25SZW5kZXJlcixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbW1lbnRTZXJ2aWNlIHByaXZhdGUgY29tbWVudFNlcnZpY2U6IElDb21tZW50U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIGFjY2Vzc2liaWxpdHlTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBwcml2YXRlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9kb21Ob2RlID0gZG9tLiQoJ2Rpdi5yZXZpZXctY29tbWVudCcpO1xuXHRcdHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIoY29udGV4dEtleVNlcnZpY2UuY3JlYXRlU2NvcGVkKHRoaXMuX2RvbU5vZGUpKTtcblx0XHR0aGlzLl9jb21tZW50Q29udGV4dFZhbHVlID0gQ29tbWVudENvbnRleHRLZXlzLmNvbW1lbnRDb250ZXh0LmJpbmRUbyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0aWYgKHRoaXMuY29tbWVudC5jb250ZXh0VmFsdWUpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRDb250ZXh0VmFsdWUuc2V0KHRoaXMuY29tbWVudC5jb250ZXh0VmFsdWUpO1xuXHRcdH1cblx0XHR0aGlzLl9jb21tZW50TWVudXMgPSB0aGlzLmNvbW1lbnRTZXJ2aWNlLmdldENvbW1lbnRNZW51cyh0aGlzLm93bmVyKTtcblxuXHRcdHRoaXMuX2RvbU5vZGUudGFiSW5kZXggPSAtMTtcblx0XHR0aGlzLl9hdmF0YXIgPSBkb20uYXBwZW5kKHRoaXMuX2RvbU5vZGUsIGRvbS4kKCdkaXYuYXZhdGFyLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLnVwZGF0ZUNvbW1lbnRVc2VySWNvbih0aGlzLmNvbW1lbnQudXNlckljb25QYXRoKTtcblxuXHRcdHRoaXMuX2NvbW1lbnREZXRhaWxzQ29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLl9kb21Ob2RlLCBkb20uJCgnLnJldmlldy1jb21tZW50LWNvbnRlbnRzJykpO1xuXG5cdFx0dGhpcy5jcmVhdGVIZWFkZXIodGhpcy5fY29tbWVudERldGFpbHNDb250YWluZXIpO1xuXHRcdHRoaXMuX2JvZHkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGBkaXZgKTtcblx0XHR0aGlzLl9ib2R5LmNsYXNzTGlzdC5hZGQoJ2NvbW1lbnQtYm9keScsIE1PVVNFX0NVUlNPUl9URVhUX0NTU19DTEFTU19OQU1FKTtcblx0XHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUNvbW1lbnRzQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZD4oQ09NTUVOVFNfU0VDVElPTik/Lm1heEhlaWdodCAhPT0gZmFsc2UpIHtcblx0XHRcdHRoaXMuX2JvZHkuY2xhc3NMaXN0LmFkZCgnY29tbWVudC1ib2R5LW1heC1oZWlnaHQnKTtcblx0XHR9XG5cblx0XHR0aGlzLmNyZWF0ZVNjcm9sbCh0aGlzLl9jb21tZW50RGV0YWlsc0NvbnRhaW5lciwgdGhpcy5fYm9keSk7XG5cdFx0dGhpcy51cGRhdGVDb21tZW50Qm9keSh0aGlzLmNvbW1lbnQuYm9keSk7XG5cblx0XHR0aGlzLmNyZWF0ZVJlYWN0aW9uc0NvbnRhaW5lcih0aGlzLl9jb21tZW50RGV0YWlsc0NvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9kb21Ob2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke2NvbW1lbnQudXNlck5hbWV9LCAke3RoaXMuY29tbWVudEJvZHlWYWx1ZX1gKTtcblx0XHR0aGlzLl9kb21Ob2RlLnNldEF0dHJpYnV0ZSgncm9sZScsICd0cmVlaXRlbScpO1xuXHRcdHRoaXMuX2NsZWFyVGltZW91dCA9IG51bGw7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssICgpID0+IHRoaXMuaXNFZGl0aW5nIHx8IHRoaXMuX29uRGlkQ2xpY2suZmlyZSh0aGlzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZG9tTm9kZSwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMub25Db250ZXh0TWVudShlKTtcblx0XHR9KSk7XG5cblx0XHRpZiAocGVuZGluZ0VkaXQpIHtcblx0XHRcdHRoaXMuc3dpdGNoVG9FZGl0TW9kZSgpO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmFjY2Vzc2liaWxpdHlTZXJ2aWNlLm9uRGlkQ2hhbmdlU2NyZWVuUmVhZGVyT3B0aW1pemVkKCgpID0+IHtcblx0XHRcdHRoaXMudG9nZ2xlVG9vbGJhckhpZGRlbih0cnVlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmFjdGl2ZUNvbW1lbnRMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgYWN0aXZlQ29tbWVudExpc3RlbmVycygpIHtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsIGRvbS5FdmVudFR5cGUuRk9DVVNfSU4sICgpID0+IHtcblx0XHRcdHRoaXMuY29tbWVudFNlcnZpY2Uuc2V0QWN0aXZlQ29tbWVudEFuZFRocmVhZCh0aGlzLm93bmVyLCB7IHRocmVhZDogdGhpcy5jb21tZW50VGhyZWFkLCBjb21tZW50OiB0aGlzLmNvbW1lbnQgfSk7XG5cdFx0fSwgdHJ1ZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTY3JvbGwoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgYm9keTogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLl9zY3JvbGxhYmxlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNjcm9sbGFibGUoe1xuXHRcdFx0Zm9yY2VJbnRlZ2VyVmFsdWVzOiB0cnVlLFxuXHRcdFx0c21vb3RoU2Nyb2xsRHVyYXRpb246IDEyNSxcblx0XHRcdHNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWU6IGNiID0+IGRvbS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGRvbS5nZXRXaW5kb3coY29udGFpbmVyKSwgY2IpXG5cdFx0fSkpO1xuXHRcdHRoaXMuX3Njcm9sbGFibGVFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNtb290aFNjcm9sbGFibGVFbGVtZW50KGJvZHksIHtcblx0XHRcdGhvcml6b250YWw6IFNjcm9sbGJhclZpc2liaWxpdHkuVmlzaWJsZSxcblx0XHRcdHZlcnRpY2FsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LlZpc2libGVcblx0XHR9LCB0aGlzLl9zY3JvbGxhYmxlKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5vblNjcm9sbChlID0+IHtcblx0XHRcdGlmIChlLnNjcm9sbExlZnRDaGFuZ2VkKSB7XG5cdFx0XHRcdGJvZHkuc2Nyb2xsTGVmdCA9IGUuc2Nyb2xsTGVmdDtcblx0XHRcdH1cblx0XHRcdGlmIChlLnNjcm9sbFRvcENoYW5nZWQpIHtcblx0XHRcdFx0Ym9keS5zY3JvbGxUb3AgPSBlLnNjcm9sbFRvcDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBvbkRpZFNjcm9sbFZpZXdDb250YWluZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcihib2R5LCAnc2Nyb2xsJykpLmV2ZW50O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKG9uRGlkU2Nyb2xsVmlld0NvbnRhaW5lcihfID0+IHtcblx0XHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0U2Nyb2xsUG9zaXRpb24oKTtcblx0XHRcdGNvbnN0IHNjcm9sbExlZnQgPSBNYXRoLmFicyhib2R5LnNjcm9sbExlZnQgLSBwb3NpdGlvbi5zY3JvbGxMZWZ0KSA8PSAxID8gdW5kZWZpbmVkIDogYm9keS5zY3JvbGxMZWZ0O1xuXHRcdFx0Y29uc3Qgc2Nyb2xsVG9wID0gTWF0aC5hYnMoYm9keS5zY3JvbGxUb3AgLSBwb3NpdGlvbi5zY3JvbGxUb3ApIDw9IDEgPyB1bmRlZmluZWQgOiBib2R5LnNjcm9sbFRvcDtcblxuXHRcdFx0aWYgKHNjcm9sbExlZnQgIT09IHVuZGVmaW5lZCB8fCBzY3JvbGxUb3AgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxQb3NpdGlvbih7IHNjcm9sbExlZnQsIHNjcm9sbFRvcCB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQodGhpcy5fc2Nyb2xsYWJsZUVsZW1lbnQuZ2V0RG9tTm9kZSgpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29tbWVudEJvZHkoYm9keTogc3RyaW5nIHwgSU1hcmtkb3duU3RyaW5nKSB7XG5cdFx0dGhpcy5fYm9keS5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLl9tZC5jbGVhcigpO1xuXHRcdHRoaXMuX3BsYWluVGV4dCA9IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHR0aGlzLl9wbGFpblRleHQgPSBkb20uYXBwZW5kKHRoaXMuX2JvZHksIGRvbS4kKCcuY29tbWVudC1ib2R5LXBsYWluc3RyaW5nJykpO1xuXHRcdFx0dGhpcy5fcGxhaW5UZXh0LmlubmVyVGV4dCA9IGJvZHk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX21kLnZhbHVlID0gdGhpcy5tYXJrZG93blJlbmRlcmVyLnJlbmRlcihib2R5KTtcblx0XHRcdHRoaXMuX2JvZHkuYXBwZW5kQ2hpbGQodGhpcy5fbWQudmFsdWUuZWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb21tZW50VXNlckljb24odXNlckljb25QYXRoOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fYXZhdGFyLnRleHRDb250ZW50ID0gJyc7XG5cdFx0aWYgKHVzZXJJY29uUGF0aCkge1xuXHRcdFx0Y29uc3QgaW1nID0gPEhUTUxJbWFnZUVsZW1lbnQ+ZG9tLmFwcGVuZCh0aGlzLl9hdmF0YXIsIGRvbS4kKCdpbWcuYXZhdGFyJykpO1xuXHRcdFx0aW1nLnNyYyA9IEZpbGVBY2Nlc3MudXJpVG9Ccm93c2VyVXJpKFVSSS5yZXZpdmUodXNlckljb25QYXRoKSkudG9TdHJpbmcodHJ1ZSk7XG5cdFx0XHRpbWcub25lcnJvciA9IF8gPT4gaW1nLnJlbW92ZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXQgb25EaWRDbGljaygpOiBFdmVudDxDb21tZW50Tm9kZTxUPj4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZENsaWNrLmV2ZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUaW1lc3RhbXAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMuX3RpbWVzdGFtcCA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnc3Bhbi50aW1lc3RhbXAtY29udGFpbmVyJykpO1xuXHRcdHRoaXMudXBkYXRlVGltZXN0YW1wKHRoaXMuY29tbWVudC50aW1lc3RhbXApO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVUaW1lc3RhbXAocmF3Pzogc3RyaW5nKSB7XG5cdFx0aWYgKCF0aGlzLl90aW1lc3RhbXApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0aW1lc3RhbXAgPSByYXcgIT09IHVuZGVmaW5lZCA/IG5ldyBEYXRlKHJhdykgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKCF0aW1lc3RhbXApIHtcblx0XHRcdHRoaXMuX3RpbWVzdGFtcFdpZGdldD8uZGlzcG9zZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoIXRoaXMuX3RpbWVzdGFtcFdpZGdldCkge1xuXHRcdFx0XHR0aGlzLl90aW1lc3RhbXBXaWRnZXQgPSBuZXcgVGltZXN0YW1wV2lkZ2V0KHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMuaG92ZXJTZXJ2aWNlLCB0aGlzLl90aW1lc3RhbXAsIHRpbWVzdGFtcCk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3RpbWVzdGFtcFdpZGdldCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl90aW1lc3RhbXBXaWRnZXQuc2V0VGltZXN0YW1wKHRpbWVzdGFtcCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVIZWFkZXIoY29tbWVudERldGFpbHNDb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgaGVhZGVyID0gZG9tLmFwcGVuZChjb21tZW50RGV0YWlsc0NvbnRhaW5lciwgZG9tLiQoYGRpdi5jb21tZW50LXRpdGxlLiR7TU9VU0VfQ1VSU09SX1RFWFRfQ1NTX0NMQVNTX05BTUV9YCkpO1xuXHRcdGNvbnN0IGluZm9Db250YWluZXIgPSBkb20uYXBwZW5kKGhlYWRlciwgZG9tLiQoJ2NvbW1lbnQtaGVhZGVyLWluZm8nKSk7XG5cdFx0Y29uc3QgYXV0aG9yID0gZG9tLmFwcGVuZChpbmZvQ29udGFpbmVyLCBkb20uJCgnc3Ryb25nLmF1dGhvcicpKTtcblx0XHRhdXRob3IuaW5uZXJUZXh0ID0gdGhpcy5jb21tZW50LnVzZXJOYW1lO1xuXHRcdHRoaXMuY3JlYXRlVGltZXN0YW1wKGluZm9Db250YWluZXIpO1xuXHRcdHRoaXMuX2lzUGVuZGluZ0xhYmVsID0gZG9tLmFwcGVuZChpbmZvQ29udGFpbmVyLCBkb20uJCgnc3Bhbi5pc1BlbmRpbmcnKSk7XG5cblx0XHRpZiAodGhpcy5jb21tZW50LmxhYmVsKSB7XG5cdFx0XHR0aGlzLl9pc1BlbmRpbmdMYWJlbC5pbm5lclRleHQgPSB0aGlzLmNvbW1lbnQubGFiZWw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2lzUGVuZGluZ0xhYmVsLmlubmVyVGV4dCA9ICcnO1xuXHRcdH1cblxuXHRcdHRoaXMuX2FjdGlvbnNUb29sYmFyQ29udGFpbmVyID0gZG9tLmFwcGVuZChoZWFkZXIsIGRvbS4kKCcuY29tbWVudC1hY3Rpb25zJykpO1xuXHRcdHRoaXMudG9nZ2xlVG9vbGJhckhpZGRlbih0cnVlKTtcblx0XHR0aGlzLmNyZWF0ZUFjdGlvbnNUb29sYmFyKCk7XG5cdH1cblxuXHRwcml2YXRlIHRvZ2dsZVRvb2xiYXJIaWRkZW4oaGlkZGVuOiBib29sZWFuKSB7XG5cdFx0aWYgKGhpZGRlbiAmJiAhdGhpcy5hY2Nlc3NpYmlsaXR5U2VydmljZS5pc1NjcmVlblJlYWRlck9wdGltaXplZCgpKSB7XG5cdFx0XHR0aGlzLl9hY3Rpb25zVG9vbGJhckNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYWN0aW9uc1Rvb2xiYXJDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRUb29sYmFyQWN0aW9ucyhtZW51OiBJTWVudSk6IHsgcHJpbWFyeTogSUFjdGlvbltdOyBzZWNvbmRhcnk6IElBY3Rpb25bXSB9IHtcblx0XHRjb25zdCBjb250cmlidXRlZEFjdGlvbnMgPSBtZW51LmdldEFjdGlvbnMoeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0XHRjb25zdCBwcmltYXJ5OiBJQWN0aW9uW10gPSBbXTtcblx0XHRjb25zdCBzZWNvbmRhcnk6IElBY3Rpb25bXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHsgcHJpbWFyeSwgc2Vjb25kYXJ5IH07XG5cdFx0ZmlsbEluQWN0aW9ucyhjb250cmlidXRlZEFjdGlvbnMsIHJlc3VsdCwgZmFsc2UsIGcgPT4gL15pbmxpbmUvLnRlc3QoZykpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGdldCBjb21tZW50Tm9kZUNvbnRleHQoKTogW2FueSwgTWFyc2hhbGxlZENvbW1lbnRUaHJlYWRdIHtcblx0XHRyZXR1cm4gW3tcblx0XHRcdHRocmVhZDogdGhpcy5jb21tZW50VGhyZWFkLFxuXHRcdFx0Y29tbWVudFVuaXF1ZUlkOiB0aGlzLmNvbW1lbnQudW5pcXVlSWRJblRocmVhZCxcblx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5Db21tZW50Tm9kZVxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0Y29tbWVudENvbnRyb2xIYW5kbGU6IHRoaXMuY29tbWVudFRocmVhZC5jb250cm9sbGVySGFuZGxlLFxuXHRcdFx0Y29tbWVudFRocmVhZEhhbmRsZTogdGhpcy5jb21tZW50VGhyZWFkLmNvbW1lbnRUaHJlYWRIYW5kbGUsXG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuQ29tbWVudFRocmVhZFxuXHRcdH1dO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVUb29sYmFyKCkge1xuXHRcdHRoaXMudG9vbGJhci52YWx1ZSA9IG5ldyBUb29sQmFyKHRoaXMuX2FjdGlvbnNUb29sYmFyQ29udGFpbmVyLCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRpZiAoYWN0aW9uLmlkID09PSBUb2dnbGVSZWFjdGlvbnNBY3Rpb24uSUQpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtKFxuXHRcdFx0XHRcdFx0YWN0aW9uLFxuXHRcdFx0XHRcdFx0KDxUb2dnbGVSZWFjdGlvbnNBY3Rpb24+YWN0aW9uKS5tZW51QWN0aW9ucyxcblx0XHRcdFx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uIGFzIEFjdGlvbiwgb3B0aW9ucyksXG5cdFx0XHRcdFx0XHRcdGNsYXNzTmFtZXM6IFsndG9vbGJhci10b2dnbGUtcGlja1JlYWN0aW9ucycsIC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KENvZGljb24ucmVhY3Rpb25zKV0sXG5cdFx0XHRcdFx0XHRcdGFuY2hvckFsaWdubWVudFByb3ZpZGVyOiAoKSA9PiBBbmNob3JBbGlnbm1lbnQuUklHSFRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uIGFzIEFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0b3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMXG5cdFx0fSk7XG5cblx0XHR0aGlzLnRvb2xiYXIudmFsdWUuY29udGV4dCA9IHRoaXMuY29tbWVudE5vZGVDb250ZXh0O1xuXHRcdHRoaXMudG9vbGJhci52YWx1ZS5hY3Rpb25SdW5uZXIgPSB0aGlzLl9hY3Rpb25SdW5uZXI7XG5cblx0XHR0aGlzLnJlZ2lzdGVyQWN0aW9uQmFyTGlzdGVuZXJzKHRoaXMuX2FjdGlvbnNUb29sYmFyQ29udGFpbmVyKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQWN0aW9uc1Rvb2xiYXIoKSB7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cblx0XHRjb25zdCBoYXNSZWFjdGlvbkhhbmRsZXIgPSB0aGlzLmNvbW1lbnRTZXJ2aWNlLmhhc1JlYWN0aW9uSGFuZGxlcih0aGlzLm93bmVyKTtcblx0XHRjb25zdCB0b2dnbGVSZWFjdGlvbkFjdGlvbiA9IGhhc1JlYWN0aW9uSGFuZGxlciA/IHRoaXMuY3JlYXRlUmVhY3Rpb25QaWNrZXIodGhpcy5jb21tZW50LmNvbW1lbnRSZWFjdGlvbnMgfHwgW10pIDogdW5kZWZpbmVkO1xuXHRcdGlmICh0b2dnbGVSZWFjdGlvbkFjdGlvbikge1xuXHRcdFx0YWN0aW9ucy5wdXNoKHRvZ2dsZVJlYWN0aW9uQWN0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBtZW51ID0gdGhpcy5fY29tbWVudE1lbnVzLmdldENvbW1lbnRUaXRsZUFjdGlvbnModGhpcy5jb21tZW50LCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudS5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGNvbnN0IHsgcHJpbWFyeSwgc2Vjb25kYXJ5IH0gPSB0aGlzLmdldFRvb2xiYXJBY3Rpb25zKG1lbnUpO1xuXHRcdFx0aWYgKCF0aGlzLnRvb2xiYXIgJiYgKHByaW1hcnkubGVuZ3RoIHx8IHNlY29uZGFyeS5sZW5ndGgpKSB7XG5cdFx0XHRcdHRoaXMuY3JlYXRlVG9vbGJhcigpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRvZ2dsZVJlYWN0aW9uQWN0aW9uKSB7XG5cdFx0XHRcdHByaW1hcnkudW5zaGlmdCh0b2dnbGVSZWFjdGlvbkFjdGlvbik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnRvb2xiYXIudmFsdWUhLnNldEFjdGlvbnMocHJpbWFyeSwgc2Vjb25kYXJ5KTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB7IHByaW1hcnksIHNlY29uZGFyeSB9ID0gdGhpcy5nZXRUb29sYmFyQWN0aW9ucyhtZW51KTtcblx0XHRhY3Rpb25zLnB1c2goLi4ucHJpbWFyeSk7XG5cblx0XHRpZiAoYWN0aW9ucy5sZW5ndGggfHwgc2Vjb25kYXJ5Lmxlbmd0aCkge1xuXHRcdFx0dGhpcy5jcmVhdGVUb29sYmFyKCk7XG5cdFx0XHR0aGlzLnRvb2xiYXIudmFsdWUhLnNldEFjdGlvbnMoYWN0aW9ucywgc2Vjb25kYXJ5KTtcblx0XHR9XG5cdH1cblxuXHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbjogQWN0aW9uLCBvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zKSB7XG5cdFx0aWYgKGFjdGlvbi5pZCA9PT0gVG9nZ2xlUmVhY3Rpb25zQWN0aW9uLklEKSB7XG5cdFx0XHRvcHRpb25zID0geyBsYWJlbDogZmFsc2UsIGljb246IHRydWUgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3B0aW9ucyA9IHsgbGFiZWw6IGZhbHNlLCBpY29uOiB0cnVlIH07XG5cdFx0fVxuXG5cdFx0aWYgKGFjdGlvbi5pZCA9PT0gUmVhY3Rpb25BY3Rpb24uSUQpIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBuZXcgUmVhY3Rpb25BY3Rpb25WaWV3SXRlbShhY3Rpb24pO1xuXHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0fSBlbHNlIGlmIChhY3Rpb24gaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudUVudHJ5QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgeyBob3ZlckRlbGVnYXRlOiBvcHRpb25zLmhvdmVyRGVsZWdhdGUgfSk7XG5cdFx0fSBlbHNlIGlmIChhY3Rpb24gaW5zdGFuY2VvZiBTdWJtZW51SXRlbUFjdGlvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VibWVudUVudHJ5QWN0aW9uVmlld0l0ZW0sIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGl0ZW0gPSBuZXcgQWN0aW9uVmlld0l0ZW0oe30sIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHRyZXR1cm4gaXRlbTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzdWJtaXRDb21tZW50KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl9jb21tZW50RWRpdG9yICYmIHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucykge1xuXHRcdFx0YXdhaXQgdGhpcy5fY29tbWVudEZvcm1BY3Rpb25zLnRyaWdnZXJEZWZhdWx0QWN0aW9uKCk7XG5cdFx0XHR0aGlzLnBlbmRpbmdFZGl0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVhY3Rpb25QaWNrZXIocmVhY3Rpb25Hcm91cDogbGFuZ3VhZ2VzLkNvbW1lbnRSZWFjdGlvbltdKTogVG9nZ2xlUmVhY3Rpb25zQWN0aW9uIHtcblx0XHRjb25zdCB0b2dnbGVSZWFjdGlvbkFjdGlvbiA9IHRoaXMuX3JlYWN0aW9uQWN0aW9ucy5hZGQobmV3IFRvZ2dsZVJlYWN0aW9uc0FjdGlvbigoKSA9PiB7XG5cdFx0XHR0b2dnbGVSZWFjdGlvbkFjdGlvblZpZXdJdGVtPy5zaG93KCk7XG5cdFx0fSwgbmxzLmxvY2FsaXplKCdjb21tZW50VG9nZ2xlUmVhY3Rpb24nLCBcIlRvZ2dsZSBSZWFjdGlvblwiKSkpO1xuXG5cdFx0bGV0IHJlYWN0aW9uTWVudUFjdGlvbnM6IEFjdGlvbltdID0gW107XG5cdFx0aWYgKHJlYWN0aW9uR3JvdXAgJiYgcmVhY3Rpb25Hcm91cC5sZW5ndGgpIHtcblx0XHRcdHJlYWN0aW9uTWVudUFjdGlvbnMgPSByZWFjdGlvbkdyb3VwLm1hcCgocmVhY3Rpb24pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3JlYWN0aW9uQWN0aW9ucy5hZGQobmV3IEFjdGlvbihgcmVhY3Rpb24uY29tbWFuZC4ke3JlYWN0aW9uLmxhYmVsfWAsIGAke3JlYWN0aW9uLmxhYmVsfWAsICcnLCB0cnVlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWVudFNlcnZpY2UudG9nZ2xlUmVhY3Rpb24odGhpcy5vd25lciwgdGhpcy5yZXNvdXJjZSwgdGhpcy5jb21tZW50VGhyZWFkLCB0aGlzLmNvbW1lbnQsIHJlYWN0aW9uKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlcnJvciA9IGUubWVzc2FnZVxuXHRcdFx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnY29tbWVudFRvZ2dsZVJlYWN0aW9uRXJyb3InLCBcIlRvZ2dsaW5nIHRoZSBjb21tZW50IHJlYWN0aW9uIGZhaWxlZDogezB9LlwiLCBlLm1lc3NhZ2UpXG5cdFx0XHRcdFx0XHRcdDogbmxzLmxvY2FsaXplKCdjb21tZW50VG9nZ2xlUmVhY3Rpb25EZWZhdWx0RXJyb3InLCBcIlRvZ2dsaW5nIHRoZSBjb21tZW50IHJlYWN0aW9uIGZhaWxlZFwiKTtcblx0XHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0b2dnbGVSZWFjdGlvbkFjdGlvbi5tZW51QWN0aW9ucyA9IHJlYWN0aW9uTWVudUFjdGlvbnM7XG5cblx0XHRjb25zdCB0b2dnbGVSZWFjdGlvbkFjdGlvblZpZXdJdGVtOiBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSA9IHRoaXMuX3JlYWN0aW9uQWN0aW9ucy5hZGQobmV3IERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtKFxuXHRcdFx0dG9nZ2xlUmVhY3Rpb25BY3Rpb24sXG5cdFx0XHQoPFRvZ2dsZVJlYWN0aW9uc0FjdGlvbj50b2dnbGVSZWFjdGlvbkFjdGlvbikubWVudUFjdGlvbnMsXG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZSxcblx0XHRcdHtcblx0XHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRcdGlmIChhY3Rpb24uaWQgPT09IFRvZ2dsZVJlYWN0aW9uc0FjdGlvbi5JRCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRvZ2dsZVJlYWN0aW9uQWN0aW9uVmlld0l0ZW07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLmFjdGlvblZpZXdJdGVtUHJvdmlkZXIoYWN0aW9uIGFzIEFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNsYXNzTmFtZXM6ICd0b29sYmFyLXRvZ2dsZS1waWNrUmVhY3Rpb25zJyxcblx0XHRcdFx0YW5jaG9yQWxpZ25tZW50UHJvdmlkZXI6ICgpID0+IEFuY2hvckFsaWdubWVudC5SSUdIVFxuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHRvZ2dsZVJlYWN0aW9uQWN0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVSZWFjdGlvbnNDb250YWluZXIoY29tbWVudERldGFpbHNDb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fcmVhY3Rpb25BY3Rpb25zQ29udGFpbmVyPy5yZW1vdmUoKTtcblx0XHR0aGlzLl9yZWFjdGlvbnNBY3Rpb25CYXIuY2xlYXIoKTtcblx0XHR0aGlzLl9yZWFjdGlvbkFjdGlvbnMuY2xlYXIoKTtcblxuXHRcdHRoaXMuX3JlYWN0aW9uQWN0aW9uc0NvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29tbWVudERldGFpbHNDb250YWluZXIsIGRvbS4kKCdkaXYuY29tbWVudC1yZWFjdGlvbnMnKSk7XG5cdFx0dGhpcy5fcmVhY3Rpb25zQWN0aW9uQmFyLnZhbHVlID0gbmV3IEFjdGlvbkJhcih0aGlzLl9yZWFjdGlvbkFjdGlvbnNDb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gVG9nZ2xlUmVhY3Rpb25zQWN0aW9uLklEKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbShcblx0XHRcdFx0XHRcdGFjdGlvbixcblx0XHRcdFx0XHRcdCg8VG9nZ2xlUmVhY3Rpb25zQWN0aW9uPmFjdGlvbikubWVudUFjdGlvbnMsXG5cdFx0XHRcdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4gdGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbiBhcyBBY3Rpb24sIG9wdGlvbnMpLFxuXHRcdFx0XHRcdFx0XHRjbGFzc05hbWVzOiBbJ3Rvb2xiYXItdG9nZ2xlLXBpY2tSZWFjdGlvbnMnLCAuLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnJlYWN0aW9ucyldLFxuXHRcdFx0XHRcdFx0XHRhbmNob3JBbGlnbm1lbnRQcm92aWRlcjogKCkgPT4gQW5jaG9yQWxpZ25tZW50LlJJR0hUXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5hY3Rpb25WaWV3SXRlbVByb3ZpZGVyKGFjdGlvbiBhcyBBY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgaGFzUmVhY3Rpb25IYW5kbGVyID0gdGhpcy5jb21tZW50U2VydmljZS5oYXNSZWFjdGlvbkhhbmRsZXIodGhpcy5vd25lcik7XG5cdFx0dGhpcy5jb21tZW50LmNvbW1lbnRSZWFjdGlvbnM/LmZpbHRlcihyZWFjdGlvbiA9PiAhIXJlYWN0aW9uLmNvdW50KS5tYXAocmVhY3Rpb24gPT4ge1xuXHRcdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5fcmVhY3Rpb25BY3Rpb25zLmFkZChuZXcgUmVhY3Rpb25BY3Rpb24oYHJlYWN0aW9uLiR7cmVhY3Rpb24ubGFiZWx9YCwgYCR7cmVhY3Rpb24ubGFiZWx9YCwgcmVhY3Rpb24uaGFzUmVhY3RlZCAmJiAocmVhY3Rpb24uY2FuRWRpdCB8fCBoYXNSZWFjdGlvbkhhbmRsZXIpID8gJ2FjdGl2ZScgOiAnJywgKHJlYWN0aW9uLmNhbkVkaXQgfHwgaGFzUmVhY3Rpb25IYW5kbGVyKSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuY29tbWVudFNlcnZpY2UudG9nZ2xlUmVhY3Rpb24odGhpcy5vd25lciwgdGhpcy5yZXNvdXJjZSwgdGhpcy5jb21tZW50VGhyZWFkLCB0aGlzLmNvbW1lbnQsIHJlYWN0aW9uKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdGxldCBlcnJvcjogc3RyaW5nO1xuXG5cdFx0XHRcdFx0aWYgKHJlYWN0aW9uLmhhc1JlYWN0ZWQpIHtcblx0XHRcdFx0XHRcdGVycm9yID0gZS5tZXNzYWdlXG5cdFx0XHRcdFx0XHRcdD8gbmxzLmxvY2FsaXplKCdjb21tZW50RGVsZXRlUmVhY3Rpb25FcnJvcicsIFwiRGVsZXRpbmcgdGhlIGNvbW1lbnQgcmVhY3Rpb24gZmFpbGVkOiB7MH0uXCIsIGUubWVzc2FnZSlcblx0XHRcdFx0XHRcdFx0OiBubHMubG9jYWxpemUoJ2NvbW1lbnREZWxldGVSZWFjdGlvbkRlZmF1bHRFcnJvcicsIFwiRGVsZXRpbmcgdGhlIGNvbW1lbnQgcmVhY3Rpb24gZmFpbGVkXCIpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRlcnJvciA9IGUubWVzc2FnZVxuXHRcdFx0XHRcdFx0XHQ/IG5scy5sb2NhbGl6ZSgnY29tbWVudEFkZFJlYWN0aW9uRXJyb3InLCBcIkRlbGV0aW5nIHRoZSBjb21tZW50IHJlYWN0aW9uIGZhaWxlZDogezB9LlwiLCBlLm1lc3NhZ2UpXG5cdFx0XHRcdFx0XHRcdDogbmxzLmxvY2FsaXplKCdjb21tZW50QWRkUmVhY3Rpb25EZWZhdWx0RXJyb3InLCBcIkRlbGV0aW5nIHRoZSBjb21tZW50IHJlYWN0aW9uIGZhaWxlZFwiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgcmVhY3Rpb24ucmVhY3RvcnMsIHJlYWN0aW9uLmljb25QYXRoLCByZWFjdGlvbi5jb3VudCkpO1xuXG5cdFx0XHR0aGlzLl9yZWFjdGlvbnNBY3Rpb25CYXIudmFsdWU/LnB1c2goYWN0aW9uLCB7IGxhYmVsOiB0cnVlLCBpY29uOiB0cnVlIH0pO1xuXHRcdH0pO1xuXG5cdFx0aWYgKGhhc1JlYWN0aW9uSGFuZGxlcikge1xuXHRcdFx0Y29uc3QgdG9nZ2xlUmVhY3Rpb25BY3Rpb24gPSB0aGlzLmNyZWF0ZVJlYWN0aW9uUGlja2VyKHRoaXMuY29tbWVudC5jb21tZW50UmVhY3Rpb25zIHx8IFtdKTtcblx0XHRcdHRoaXMuX3JlYWN0aW9uc0FjdGlvbkJhci52YWx1ZT8ucHVzaCh0b2dnbGVSZWFjdGlvbkFjdGlvbiwgeyBsYWJlbDogZmFsc2UsIGljb246IHRydWUgfSk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IGNvbW1lbnRCb2R5VmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gKHR5cGVvZiB0aGlzLmNvbW1lbnQuYm9keSA9PT0gJ3N0cmluZycpID8gdGhpcy5jb21tZW50LmJvZHkgOiB0aGlzLmNvbW1lbnQuYm9keS52YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlQ29tbWVudEVkaXRvcihlZGl0Q29udGFpbmVyOiBIVE1MRWxlbWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IGRvbS5hcHBlbmQoZWRpdENvbnRhaW5lciwgZG9tLiQoJy5lZGl0LXRleHRhcmVhJykpO1xuXHRcdHRoaXMuX2NvbW1lbnRFZGl0b3IgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpbXBsZUNvbW1lbnRFZGl0b3IsIGNvbnRhaW5lciwgU2ltcGxlQ29tbWVudEVkaXRvci5nZXRFZGl0b3JPcHRpb25zKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5wYXJlbnRUaHJlYWQpO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZnJvbSh7XG5cdFx0XHRzY2hlbWU6IFNjaGVtYXMuY29tbWVudHNJbnB1dCxcblx0XHRcdHBhdGg6IGAvY29tbWVudGlucHV0LSR7dGhpcy5jb21tZW50LnVuaXF1ZUlkSW5UaHJlYWR9LSR7RGF0ZS5ub3coKX0ubWRgXG5cdFx0fSk7XG5cdFx0Y29uc3QgbW9kZWxSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UocmVzb3VyY2UpO1xuXHRcdHRoaXMuX2NvbW1lbnRFZGl0b3JNb2RlbCA9IG1vZGVsUmVmO1xuXG5cdFx0dGhpcy5fY29tbWVudEVkaXRvci5zZXRNb2RlbCh0aGlzLl9jb21tZW50RWRpdG9yTW9kZWwub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvci5zZXRWYWx1ZSh0aGlzLnBlbmRpbmdFZGl0Py5ib2R5ID8/IHRoaXMuY29tbWVudEJvZHlWYWx1ZSk7XG5cdFx0aWYgKHRoaXMucGVuZGluZ0VkaXQpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRFZGl0b3Iuc2V0UG9zaXRpb24odGhpcy5wZW5kaW5nRWRpdC5jdXJzb3IpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBsYXN0TGluZSA9IHRoaXMuX2NvbW1lbnRFZGl0b3JNb2RlbC5vYmplY3QudGV4dEVkaXRvck1vZGVsLmdldExpbmVDb3VudCgpO1xuXHRcdFx0Y29uc3QgbGFzdENvbHVtbiA9IHRoaXMuX2NvbW1lbnRFZGl0b3JNb2RlbC5vYmplY3QudGV4dEVkaXRvck1vZGVsLmdldExpbmVMZW5ndGgobGFzdExpbmUpICsgMTtcblx0XHRcdHRoaXMuX2NvbW1lbnRFZGl0b3Iuc2V0UG9zaXRpb24obmV3IFBvc2l0aW9uKGxhc3RMaW5lLCBsYXN0Q29sdW1uKSk7XG5cdFx0fVxuXHRcdHRoaXMucGVuZGluZ0VkaXQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvci5sYXlvdXQoeyB3aWR0aDogY29udGFpbmVyLmNsaWVudFdpZHRoIC0gMTQsIGhlaWdodDogdGhpcy5fZWRpdG9ySGVpZ2h0IH0pO1xuXHRcdHRoaXMuX2NvbW1lbnRFZGl0b3IuZm9jdXMoKTtcblxuXHRcdGRvbS5zY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGRvbS5nZXRXaW5kb3coZWRpdENvbnRhaW5lciksICgpID0+IHtcblx0XHRcdHRoaXMuX2NvbW1lbnRFZGl0b3IhLmxheW91dCh7IHdpZHRoOiBjb250YWluZXIuY2xpZW50V2lkdGggLSAxNCwgaGVpZ2h0OiB0aGlzLl9lZGl0b3JIZWlnaHQgfSk7XG5cdFx0XHR0aGlzLl9jb21tZW50RWRpdG9yIS5mb2N1cygpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29tbWVudFRocmVhZCA9IHRoaXMuY29tbWVudFRocmVhZDtcblx0XHRjb21tZW50VGhyZWFkLmlucHV0ID0ge1xuXHRcdFx0dXJpOiB0aGlzLl9jb21tZW50RWRpdG9yLmdldE1vZGVsKCkhLnVyaSxcblx0XHRcdHZhbHVlOiB0aGlzLmNvbW1lbnRCb2R5VmFsdWVcblx0XHR9O1xuXHRcdHRoaXMuY29tbWVudFNlcnZpY2Uuc2V0QWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZCk7XG5cdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRBY3RpdmVDb21tZW50QW5kVGhyZWFkKHRoaXMub3duZXIsIHsgdGhyZWFkOiBjb21tZW50VGhyZWFkLCBjb21tZW50OiB0aGlzLmNvbW1lbnQgfSk7XG5cblx0XHR0aGlzLl9jb21tZW50RWRpdG9yRGlzcG9zYWJsZXMucHVzaCh0aGlzLl9jb21tZW50RWRpdG9yLm9uRGlkRm9jdXNFZGl0b3JXaWRnZXQoKCkgPT4ge1xuXHRcdFx0Y29tbWVudFRocmVhZC5pbnB1dCA9IHtcblx0XHRcdFx0dXJpOiB0aGlzLl9jb21tZW50RWRpdG9yIS5nZXRNb2RlbCgpIS51cmksXG5cdFx0XHRcdHZhbHVlOiB0aGlzLmNvbW1lbnRCb2R5VmFsdWVcblx0XHRcdH07XG5cdFx0XHR0aGlzLmNvbW1lbnRTZXJ2aWNlLnNldEFjdGl2ZUVkaXRpbmdDb21tZW50VGhyZWFkKGNvbW1lbnRUaHJlYWQpO1xuXHRcdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRBY3RpdmVDb21tZW50QW5kVGhyZWFkKHRoaXMub3duZXIsIHsgdGhyZWFkOiBjb21tZW50VGhyZWFkLCBjb21tZW50OiB0aGlzLmNvbW1lbnQgfSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY29tbWVudEVkaXRvckRpc3Bvc2FibGVzLnB1c2godGhpcy5fY29tbWVudEVkaXRvci5vbkRpZENoYW5nZU1vZGVsQ29udGVudChlID0+IHtcblx0XHRcdGlmIChjb21tZW50VGhyZWFkLmlucHV0ICYmIHRoaXMuX2NvbW1lbnRFZGl0b3IgJiYgdGhpcy5fY29tbWVudEVkaXRvci5nZXRNb2RlbCgpIS51cmkgPT09IGNvbW1lbnRUaHJlYWQuaW5wdXQudXJpKSB7XG5cdFx0XHRcdGNvbnN0IG5ld1ZhbCA9IHRoaXMuX2NvbW1lbnRFZGl0b3IuZ2V0VmFsdWUoKTtcblx0XHRcdFx0aWYgKG5ld1ZhbCAhPT0gY29tbWVudFRocmVhZC5pbnB1dC52YWx1ZSkge1xuXHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gY29tbWVudFRocmVhZC5pbnB1dDtcblx0XHRcdFx0XHRpbnB1dC52YWx1ZSA9IG5ld1ZhbDtcblx0XHRcdFx0XHRjb21tZW50VGhyZWFkLmlucHV0ID0gaW5wdXQ7XG5cdFx0XHRcdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRBY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZChjb21tZW50VGhyZWFkKTtcblx0XHRcdFx0XHR0aGlzLmNvbW1lbnRTZXJ2aWNlLnNldEFjdGl2ZUNvbW1lbnRBbmRUaHJlYWQodGhpcy5vd25lciwgeyB0aHJlYWQ6IGNvbW1lbnRUaHJlYWQsIGNvbW1lbnQ6IHRoaXMuY29tbWVudCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuY2FsY3VsYXRlRWRpdG9ySGVpZ2h0KCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcigodGhpcy5fY29tbWVudEVkaXRvck1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9jb21tZW50RWRpdG9yICYmIHRoaXMuY2FsY3VsYXRlRWRpdG9ySGVpZ2h0KCkpIHtcblx0XHRcdFx0dGhpcy5fY29tbWVudEVkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IHRoaXMuX2VkaXRvckhlaWdodCwgd2lkdGg6IHRoaXMuX2NvbW1lbnRFZGl0b3IuZ2V0TGF5b3V0SW5mbygpLndpZHRoIH0pO1xuXHRcdFx0XHR0aGlzLl9jb21tZW50RWRpdG9yLnJlbmRlcih0cnVlKTtcblx0XHRcdH1cblx0XHR9KSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29tbWVudEVkaXRvcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29tbWVudEVkaXRvck1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgY2FsY3VsYXRlRWRpdG9ySGVpZ2h0KCk6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLl9jb21tZW50RWRpdG9yKSB7XG5cdFx0XHRjb25zdCBuZXdFZGl0b3JIZWlnaHQgPSBjYWxjdWxhdGVFZGl0b3JIZWlnaHQodGhpcy5wYXJlbnRFZGl0b3IsIHRoaXMuX2NvbW1lbnRFZGl0b3IsIHRoaXMuX2VkaXRvckhlaWdodCk7XG5cdFx0XHRpZiAobmV3RWRpdG9ySGVpZ2h0ICE9PSB0aGlzLl9lZGl0b3JIZWlnaHQpIHtcblx0XHRcdFx0dGhpcy5fZWRpdG9ySGVpZ2h0ID0gbmV3RWRpdG9ySGVpZ2h0O1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0UGVuZGluZ0VkaXQoKTogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2NvbW1lbnRFZGl0b3I/LmdldE1vZGVsKCk7XG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRFZGl0b3IgJiYgbW9kZWwgJiYgbW9kZWwuZ2V0VmFsdWVMZW5ndGgoKSA+IDApIHtcblx0XHRcdHJldHVybiB7IGJvZHk6IG1vZGVsLmdldFZhbHVlKCksIGN1cnNvcjogdGhpcy5fY29tbWVudEVkaXRvci5nZXRQb3NpdGlvbigpISB9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZW1vdmVDb21tZW50RWRpdG9yKCkge1xuXHRcdHRoaXMuaXNFZGl0aW5nID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuX2VkaXRBY3Rpb24pIHtcblx0XHRcdHRoaXMuX2VkaXRBY3Rpb24uZW5hYmxlZCA9IHRydWU7XG5cdFx0fVxuXHRcdHRoaXMuX2JvZHkuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG5cblx0XHR0aGlzLl9jb21tZW50RWRpdG9yTW9kZWw/LmRpc3Bvc2UoKTtcblxuXHRcdGRpc3Bvc2UodGhpcy5fY29tbWVudEVkaXRvckRpc3Bvc2FibGVzKTtcblx0XHR0aGlzLl9jb21tZW50RWRpdG9yRGlzcG9zYWJsZXMgPSBbXTtcblx0XHR0aGlzLl9jb21tZW50RWRpdG9yPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvciA9IG51bGw7XG5cblx0XHR0aGlzLl9jb21tZW50RWRpdENvbnRhaW5lciEucmVtb3ZlKCk7XG5cdH1cblxuXHRsYXlvdXQod2lkdGhJblBpeGVsPzogbnVtYmVyKSB7XG5cdFx0Y29uc3QgZWRpdG9yV2lkdGggPSB3aWR0aEluUGl4ZWwgIT09IHVuZGVmaW5lZCA/IHdpZHRoSW5QaXhlbCAtIDcyIC8qIC0gbWFyZ2luIGFuZCBzY3JvbGxiYXIqLyA6ICh0aGlzLl9jb21tZW50RWRpdG9yPy5nZXRMYXlvdXRJbmZvKCkud2lkdGggPz8gMCk7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvcj8ubGF5b3V0KHsgd2lkdGg6IGVkaXRvcldpZHRoLCBoZWlnaHQ6IHRoaXMuX2VkaXRvckhlaWdodCB9KTtcblx0XHRjb25zdCBzY3JvbGxXaWR0aCA9IHRoaXMuX2JvZHkuc2Nyb2xsV2lkdGg7XG5cdFx0Y29uc3Qgd2lkdGggPSBkb20uZ2V0Q29udGVudFdpZHRoKHRoaXMuX2JvZHkpO1xuXHRcdGNvbnN0IHNjcm9sbEhlaWdodCA9IHRoaXMuX2JvZHkuc2Nyb2xsSGVpZ2h0O1xuXHRcdGNvbnN0IGhlaWdodCA9IGRvbS5nZXRDb250ZW50SGVpZ2h0KHRoaXMuX2JvZHkpICsgNDtcblx0XHR0aGlzLl9zY3JvbGxhYmxlRWxlbWVudC5zZXRTY3JvbGxEaW1lbnNpb25zKHsgd2lkdGgsIHNjcm9sbFdpZHRoLCBoZWlnaHQsIHNjcm9sbEhlaWdodCB9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzd2l0Y2hUb0VkaXRNb2RlKCkge1xuXHRcdGlmICh0aGlzLmlzRWRpdGluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaXNFZGl0aW5nID0gdHJ1ZTtcblx0XHR0aGlzLl9ib2R5LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHRcdHRoaXMuX2NvbW1lbnRFZGl0Q29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLl9jb21tZW50RGV0YWlsc0NvbnRhaW5lciwgZG9tLiQoJy5lZGl0LWNvbnRhaW5lcicpKTtcblx0XHRhd2FpdCB0aGlzLmNyZWF0ZUNvbW1lbnRFZGl0b3IodGhpcy5fY29tbWVudEVkaXRDb250YWluZXIpO1xuXG5cdFx0Y29uc3QgZm9ybUFjdGlvbnMgPSBkb20uYXBwZW5kKHRoaXMuX2NvbW1lbnRFZGl0Q29udGFpbmVyLCBkb20uJCgnLmZvcm0tYWN0aW9ucycpKTtcblx0XHRjb25zdCBvdGhlckFjdGlvbnMgPSBkb20uYXBwZW5kKGZvcm1BY3Rpb25zLCBkb20uJCgnLm90aGVyLWFjdGlvbnMnKSk7XG5cdFx0dGhpcy5jcmVhdGVDb21tZW50V2lkZ2V0Rm9ybUFjdGlvbnMob3RoZXJBY3Rpb25zKTtcblx0XHRjb25zdCBlZGl0b3JBY3Rpb25zID0gZG9tLmFwcGVuZChmb3JtQWN0aW9ucywgZG9tLiQoJy5lZGl0b3ItYWN0aW9ucycpKTtcblx0XHR0aGlzLmNyZWF0ZUNvbW1lbnRXaWRnZXRFZGl0b3JBY3Rpb25zKGVkaXRvckFjdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb21tZW50V2lkZ2V0Rm9ybUFjdGlvbnMoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xuXHRcdGNvbnN0IG1lbnVzID0gdGhpcy5jb21tZW50U2VydmljZS5nZXRDb21tZW50TWVudXModGhpcy5vd25lcik7XG5cdFx0Y29uc3QgbWVudSA9IG1lbnVzLmdldENvbW1lbnRBY3Rpb25zKHRoaXMuY29tbWVudCwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21tZW50Rm9ybUFjdGlvbnM/LnNldEFjdGlvbnMobWVudSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY29tbWVudEZvcm1BY3Rpb25zID0gbmV3IENvbW1lbnRGb3JtQWN0aW9ucyh0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIGNvbnRhaW5lciwgKGFjdGlvbjogSUFjdGlvbik6IHZvaWQgPT4ge1xuXHRcdFx0Y29uc3QgdGV4dCA9IHRoaXMuX2NvbW1lbnRFZGl0b3IhLmdldFZhbHVlKCk7XG5cblx0XHRcdGFjdGlvbi5ydW4oe1xuXHRcdFx0XHR0aHJlYWQ6IHRoaXMuY29tbWVudFRocmVhZCxcblx0XHRcdFx0Y29tbWVudFVuaXF1ZUlkOiB0aGlzLmNvbW1lbnQudW5pcXVlSWRJblRocmVhZCxcblx0XHRcdFx0dGV4dDogdGV4dCxcblx0XHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRUaHJlYWROb2RlXG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5yZW1vdmVDb21tZW50RWRpdG9yKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb21tZW50Rm9ybUFjdGlvbnMpO1xuXHRcdHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucy5zZXRBY3Rpb25zKG1lbnUpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb21tZW50V2lkZ2V0RWRpdG9yQWN0aW9ucyhjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29uc3QgbWVudXMgPSB0aGlzLmNvbW1lbnRTZXJ2aWNlLmdldENvbW1lbnRNZW51cyh0aGlzLm93bmVyKTtcblx0XHRjb25zdCBtZW51ID0gbWVudXMuZ2V0Q29tbWVudEVkaXRvckFjdGlvbnModGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobWVudS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21tZW50RWRpdG9yQWN0aW9ucz8uc2V0QWN0aW9ucyhtZW51LCB0cnVlKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb21tZW50RWRpdG9yQWN0aW9ucyA9IG5ldyBDb21tZW50Rm9ybUFjdGlvbnModGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLCBjb250YWluZXIsIChhY3Rpb246IElBY3Rpb24pOiB2b2lkID0+IHtcblx0XHRcdGNvbnN0IHRleHQgPSB0aGlzLl9jb21tZW50RWRpdG9yIS5nZXRWYWx1ZSgpO1xuXG5cdFx0XHRhY3Rpb24ucnVuKHtcblx0XHRcdFx0dGhyZWFkOiB0aGlzLmNvbW1lbnRUaHJlYWQsXG5cdFx0XHRcdGNvbW1lbnRVbmlxdWVJZDogdGhpcy5jb21tZW50LnVuaXF1ZUlkSW5UaHJlYWQsXG5cdFx0XHRcdHRleHQ6IHRleHQsXG5cdFx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5Db21tZW50VGhyZWFkTm9kZVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX2NvbW1lbnRFZGl0b3I/LmZvY3VzKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb21tZW50RWRpdG9yQWN0aW9ucyk7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvckFjdGlvbnMuc2V0QWN0aW9ucyhtZW51LCB0cnVlKTtcblx0fVxuXG5cdHNldEZvY3VzKGZvY3VzZWQ6IGJvb2xlYW4sIHZpc2libGU6IGJvb2xlYW4gPSBmYWxzZSkge1xuXHRcdGlmIChmb2N1c2VkKSB7XG5cdFx0XHR0aGlzLl9kb21Ob2RlLmZvY3VzKCk7XG5cdFx0XHR0aGlzLnRvZ2dsZVRvb2xiYXJIaWRkZW4oZmFsc2UpO1xuXHRcdFx0dGhpcy5fYWN0aW9uc1Rvb2xiYXJDb250YWluZXIuY2xhc3NMaXN0LmFkZCgndGFiZm9jdXNlZCcpO1xuXHRcdFx0dGhpcy5fZG9tTm9kZS50YWJJbmRleCA9IDA7XG5cdFx0XHRpZiAodGhpcy5jb21tZW50Lm1vZGUgPT09IGxhbmd1YWdlcy5Db21tZW50TW9kZS5FZGl0aW5nKSB7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRFZGl0b3I/LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLl9hY3Rpb25zVG9vbGJhckNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ3RhYmZvY3VzZWQnKSAmJiAhdGhpcy5fYWN0aW9uc1Rvb2xiYXJDb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb3VzZW92ZXInKSkge1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVRvb2xiYXJIaWRkZW4odHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX2RvbU5vZGUudGFiSW5kZXggPSAtMTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2FjdGlvbnNUb29sYmFyQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3RhYmZvY3VzZWQnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWN0aW9uQmFyTGlzdGVuZXJzKGFjdGlvbnNDb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLl9kb21Ob2RlLCAnbW91c2VlbnRlcicsICgpID0+IHtcblx0XHRcdHRoaXMudG9nZ2xlVG9vbGJhckhpZGRlbihmYWxzZSk7XG5cdFx0XHRhY3Rpb25zQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ21vdXNlb3ZlcicpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RvbU5vZGUsICdtb3VzZWxlYXZlJywgKCkgPT4ge1xuXHRcdFx0aWYgKGFjdGlvbnNDb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb3VzZW92ZXInKSAmJiAhYWN0aW9uc0NvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ3RhYmZvY3VzZWQnKSkge1xuXHRcdFx0XHR0aGlzLnRvZ2dsZVRvb2xiYXJIaWRkZW4odHJ1ZSk7XG5cdFx0XHR9XG5cdFx0XHRhY3Rpb25zQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ21vdXNlb3ZlcicpO1xuXHRcdH0pKTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZShuZXdDb21tZW50OiBsYW5ndWFnZXMuQ29tbWVudCkge1xuXG5cdFx0aWYgKG5ld0NvbW1lbnQuYm9keSAhPT0gdGhpcy5jb21tZW50LmJvZHkpIHtcblx0XHRcdHRoaXMudXBkYXRlQ29tbWVudEJvZHkobmV3Q29tbWVudC5ib2R5KTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jb21tZW50LnVzZXJJY29uUGF0aCAmJiBuZXdDb21tZW50LnVzZXJJY29uUGF0aCAmJiAoVVJJLmZyb20odGhpcy5jb21tZW50LnVzZXJJY29uUGF0aCkudG9TdHJpbmcoKSAhPT0gVVJJLmZyb20obmV3Q29tbWVudC51c2VySWNvblBhdGgpLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUNvbW1lbnRVc2VySWNvbihuZXdDb21tZW50LnVzZXJJY29uUGF0aCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNDaGFuZ2luZ01vZGU6IGJvb2xlYW4gPSBuZXdDb21tZW50Lm1vZGUgIT09IHVuZGVmaW5lZCAmJiBuZXdDb21tZW50Lm1vZGUgIT09IHRoaXMuY29tbWVudC5tb2RlO1xuXG5cdFx0dGhpcy5jb21tZW50ID0gbmV3Q29tbWVudDtcblxuXHRcdGlmIChpc0NoYW5naW5nTW9kZSkge1xuXHRcdFx0aWYgKG5ld0NvbW1lbnQubW9kZSA9PT0gbGFuZ3VhZ2VzLkNvbW1lbnRNb2RlLkVkaXRpbmcpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5zd2l0Y2hUb0VkaXRNb2RlKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlbW92ZUNvbW1lbnRFZGl0b3IoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobmV3Q29tbWVudC5sYWJlbCkge1xuXHRcdFx0dGhpcy5faXNQZW5kaW5nTGFiZWwuaW5uZXJUZXh0ID0gbmV3Q29tbWVudC5sYWJlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5faXNQZW5kaW5nTGFiZWwuaW5uZXJUZXh0ID0gJyc7XG5cdFx0fVxuXG5cdFx0Ly8gdXBkYXRlIGNvbW1lbnQgcmVhY3Rpb25zXG5cdFx0dGhpcy5jcmVhdGVSZWFjdGlvbnNDb250YWluZXIodGhpcy5fY29tbWVudERldGFpbHNDb250YWluZXIpO1xuXG5cdFx0aWYgKHRoaXMuY29tbWVudC5jb250ZXh0VmFsdWUpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRDb250ZXh0VmFsdWUuc2V0KHRoaXMuY29tbWVudC5jb250ZXh0VmFsdWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9jb21tZW50Q29udGV4dFZhbHVlLnJlc2V0KCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29tbWVudC50aW1lc3RhbXApIHtcblx0XHRcdHRoaXMudXBkYXRlVGltZXN0YW1wKHRoaXMuY29tbWVudC50aW1lc3RhbXApO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Db250ZXh0TWVudShlOiBNb3VzZUV2ZW50KSB7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRXaW5kb3codGhpcy5fZG9tTm9kZSksIGUpO1xuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGV2ZW50LFxuXHRcdFx0bWVudUlkOiBNZW51SWQuQ29tbWVudFRocmVhZENvbW1lbnRDb250ZXh0LFxuXHRcdFx0bWVudUFjdGlvbk9wdGlvbnM6IHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSxcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiB0aGlzLl9jb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5fYWN0aW9uUnVubmVyLFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuY29tbWVudE5vZGVDb250ZXh0O1xuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdGZvY3VzKCkge1xuXHRcdHRoaXMuZG9tTm9kZS5mb2N1cygpO1xuXHRcdGlmICghdGhpcy5fY2xlYXJUaW1lb3V0KSB7XG5cdFx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnZm9jdXMnKTtcblx0XHRcdHRoaXMuX2NsZWFyVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnZm9jdXMnKTtcblx0XHRcdH0sIDMwMDApO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdGRpc3Bvc2UodGhpcy5fY29tbWVudEVkaXRvckRpc3Bvc2FibGVzKTtcblx0fVxufVxuXG5mdW5jdGlvbiBmaWxsSW5BY3Rpb25zKGdyb3VwczogW3N0cmluZywgQXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dW10sIHRhcmdldDogSUFjdGlvbltdIHwgeyBwcmltYXJ5OiBJQWN0aW9uW107IHNlY29uZGFyeTogSUFjdGlvbltdIH0sIHVzZUFsdGVybmF0aXZlQWN0aW9uczogYm9vbGVhbiwgaXNQcmltYXJ5R3JvdXA6IChncm91cDogc3RyaW5nKSA9PiBib29sZWFuID0gZ3JvdXAgPT4gZ3JvdXAgPT09ICduYXZpZ2F0aW9uJyk6IHZvaWQge1xuXHRmb3IgKGNvbnN0IHR1cGxlIG9mIGdyb3Vwcykge1xuXHRcdGxldCBbZ3JvdXAsIGFjdGlvbnNdID0gdHVwbGU7XG5cdFx0aWYgKHVzZUFsdGVybmF0aXZlQWN0aW9ucykge1xuXHRcdFx0YWN0aW9ucyA9IGFjdGlvbnMubWFwKGEgPT4gKGEgaW5zdGFuY2VvZiBNZW51SXRlbUFjdGlvbikgJiYgISFhLmFsdCA/IGEuYWx0IDogYSk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUHJpbWFyeUdyb3VwKGdyb3VwKSkge1xuXHRcdFx0Y29uc3QgdG8gPSBBcnJheS5pc0FycmF5KHRhcmdldCkgPyB0YXJnZXQgOiB0YXJnZXQucHJpbWFyeTtcblxuXHRcdFx0dG8udW5zaGlmdCguLi5hY3Rpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdG8gPSBBcnJheS5pc0FycmF5KHRhcmdldCkgPyB0YXJnZXQgOiB0YXJnZXQuc2Vjb25kYXJ5O1xuXG5cdFx0XHRpZiAodG8ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHR0by5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRvLnB1c2goLi4uYWN0aW9ucyk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFDckIsWUFBWSxlQUFlO0FBQzNCLFNBQVMsb0JBQW9CLGlCQUFpQjtBQUM5QyxTQUFTLFFBQWlCLFdBQVcsb0JBQW9CO0FBQ3pELFNBQVMsWUFBWSxpQkFBMEMsbUJBQW1CLGVBQWU7QUFDakcsU0FBUyxXQUEwQjtBQUVuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUEyQixtQkFBbUIscUJBQXFCLDZCQUE2QjtBQUNoRyxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1QixnQkFBZ0IsOEJBQThCO0FBRTlFLFNBQVMsZ0JBQWdCLG1CQUEwQixjQUFjO0FBQ2pFLFNBQVMseUJBQXlCLGtDQUFrQztBQUNwRSxTQUFTLDBCQUF1QztBQUNoRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdDQUF3QztBQUNqRCxTQUFTLHNCQUE4QztBQUN2RCxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFLdEMsU0FBUyxZQUFZLDJCQUEyQjtBQUNoRCxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLFlBQVksZUFBZTtBQUNwQyxTQUFTLHdCQUFnRDtBQUN6RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFT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
