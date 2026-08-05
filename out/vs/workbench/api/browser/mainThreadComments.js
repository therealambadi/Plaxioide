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
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from "../../../base/common/lifecycle.js";
import { URI } from "../../../base/common/uri.js";
import { Range } from "../../../editor/common/core/range.js";
import * as languages from "../../../editor/common/languages.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ICommentService } from "../../contrib/comments/browser/commentService.js";
import { CommentsPanel } from "../../contrib/comments/browser/commentsView.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { COMMENTS_VIEW_ID, COMMENTS_VIEW_STORAGE_ID, COMMENTS_VIEW_TITLE } from "../../contrib/comments/browser/commentsTreeViewer.js";
import { Extensions as ViewExtensions, ViewContainerLocation, IViewDescriptorService } from "../../common/views.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { ViewPaneContainer } from "../../browser/parts/views/viewPaneContainer.js";
import { Codicon } from "../../../base/common/codicons.js";
import { registerIcon } from "../../../platform/theme/common/iconRegistry.js";
import { localize } from "../../../nls.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { Schemas } from "../../../base/common/network.js";
import { IViewsService } from "../../services/views/common/viewsService.js";
import { revealCommentThread } from "../../contrib/comments/browser/commentsController.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
class MainThreadCommentThread {
  constructor(commentThreadHandle, controllerHandle, extensionId, threadId, resource, _range, comments, _canReply, _isTemplate, editorId) {
    this.commentThreadHandle = commentThreadHandle;
    this.controllerHandle = controllerHandle;
    this.extensionId = extensionId;
    this.threadId = threadId;
    this.resource = resource;
    this._range = _range;
    this._canReply = _canReply;
    this._isTemplate = _isTemplate;
    this.editorId = editorId;
    this._onDidChangeInput = new Emitter();
    this._onDidChangeLabel = new Emitter();
    this.onDidChangeLabel = this._onDidChangeLabel.event;
    this._onDidChangeComments = new Emitter();
    this._onDidChangeCanReply = new Emitter();
    this._collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
    this._onDidChangeCollapsibleState = new Emitter();
    this.onDidChangeCollapsibleState = this._onDidChangeCollapsibleState.event;
    this._onDidChangeInitialCollapsibleState = new Emitter();
    this.onDidChangeInitialCollapsibleState = this._onDidChangeInitialCollapsibleState.event;
    this._onDidChangeApplicability = new Emitter();
    this.onDidChangeApplicability = this._onDidChangeApplicability.event;
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this._isDisposed = false;
    if (_isTemplate) {
      this.comments = [];
    } else if (comments) {
      this._comments = comments;
    }
  }
  get input() {
    return this._input;
  }
  set input(value) {
    this._input = value;
    this._onDidChangeInput.fire(value);
  }
  get onDidChangeInput() {
    return this._onDidChangeInput.event;
  }
  get label() {
    return this._label;
  }
  set label(label) {
    this._label = label;
    this._onDidChangeLabel.fire(this._label);
  }
  get contextValue() {
    return this._contextValue;
  }
  set contextValue(context) {
    this._contextValue = context;
  }
  get comments() {
    return this._comments;
  }
  set comments(newComments) {
    this._comments = newComments;
    this._onDidChangeComments.fire(this._comments);
  }
  get onDidChangeComments() {
    return this._onDidChangeComments.event;
  }
  set range(range) {
    this._range = range;
  }
  get range() {
    return this._range;
  }
  get onDidChangeCanReply() {
    return this._onDidChangeCanReply.event;
  }
  set canReply(state) {
    this._canReply = state;
    this._onDidChangeCanReply.fire(this._canReply);
  }
  get canReply() {
    return this._canReply;
  }
  get collapsibleState() {
    return this._collapsibleState;
  }
  set collapsibleState(newState) {
    if (this.initialCollapsibleState === void 0) {
      this.initialCollapsibleState = newState;
    }
    if (newState !== this._collapsibleState) {
      this._collapsibleState = newState;
      this._onDidChangeCollapsibleState.fire(this._collapsibleState);
    }
  }
  get initialCollapsibleState() {
    return this._initialCollapsibleState;
  }
  set initialCollapsibleState(initialCollapsibleState) {
    this._initialCollapsibleState = initialCollapsibleState;
    this._onDidChangeInitialCollapsibleState.fire(initialCollapsibleState);
  }
  get isDisposed() {
    return this._isDisposed;
  }
  isDocumentCommentThread() {
    return this._range === void 0 || Range.isIRange(this._range);
  }
  get state() {
    return this._state;
  }
  set state(newState) {
    this._state = newState;
    this._onDidChangeState.fire(this._state);
  }
  get applicability() {
    return this._applicability;
  }
  set applicability(value) {
    this._applicability = value;
    this._onDidChangeApplicability.fire(value);
  }
  get isTemplate() {
    return this._isTemplate;
  }
  batchUpdate(changes) {
    const modified = (value) => Object.prototype.hasOwnProperty.call(changes, value);
    if (modified("range")) {
      this._range = changes.range;
    }
    if (modified("label")) {
      this._label = changes.label;
    }
    if (modified("contextValue")) {
      this._contextValue = changes.contextValue === null ? void 0 : changes.contextValue;
    }
    if (modified("comments")) {
      this.comments = changes.comments;
    }
    if (modified("collapseState")) {
      this.collapsibleState = changes.collapseState;
    }
    if (modified("canReply")) {
      this.canReply = changes.canReply;
    }
    if (modified("state")) {
      this.state = changes.state;
    }
    if (modified("applicability")) {
      this.applicability = changes.applicability;
    }
    if (modified("isTemplate")) {
      this._isTemplate = changes.isTemplate;
    }
  }
  hasComments() {
    return !!this.comments && this.comments.length > 0;
  }
  dispose() {
    this._isDisposed = true;
    this._onDidChangeCollapsibleState.dispose();
    this._onDidChangeComments.dispose();
    this._onDidChangeInput.dispose();
    this._onDidChangeLabel.dispose();
    this._onDidChangeState.dispose();
  }
  toJSON() {
    return {
      $mid: MarshalledId.CommentThread,
      commentControlHandle: this.controllerHandle,
      commentThreadHandle: this.commentThreadHandle
    };
  }
}
class CommentThreadWithDisposable {
  constructor(thread) {
    this.thread = thread;
    this.disposableStore = new DisposableStore();
  }
  dispose() {
    this.disposableStore.dispose();
  }
}
class MainThreadCommentController {
  constructor(_proxy, _commentService, _handle, _uniqueId, _id, _label, _features) {
    this._proxy = _proxy;
    this._commentService = _commentService;
    this._handle = _handle;
    this._uniqueId = _uniqueId;
    this._id = _id;
    this._label = _label;
    this._features = _features;
    this._threads = new DisposableMap();
  }
  get handle() {
    return this._handle;
  }
  get id() {
    return this._id;
  }
  get contextValue() {
    return this._id;
  }
  get proxy() {
    return this._proxy;
  }
  get label() {
    return this._label;
  }
  get reactions() {
    return this._reactions;
  }
  set reactions(reactions) {
    this._reactions = reactions;
  }
  get options() {
    return this._features.options;
  }
  get features() {
    return this._features;
  }
  get owner() {
    return this._id;
  }
  get activeComment() {
    return this._activeComment;
  }
  async setActiveCommentAndThread(commentInfo) {
    this._activeComment = commentInfo;
    return this._proxy.$setActiveComment(this._handle, commentInfo ? { commentThreadHandle: commentInfo.thread.commentThreadHandle, uniqueIdInThread: commentInfo.comment?.uniqueIdInThread } : void 0);
  }
  updateFeatures(features) {
    this._features = features;
  }
  createCommentThread(extensionId, commentThreadHandle, threadId, resource, range, comments, isTemplate, editorId) {
    const thread = new MainThreadCommentThread(
      commentThreadHandle,
      this.handle,
      extensionId,
      threadId,
      URI.revive(resource).toString(),
      range,
      comments,
      true,
      isTemplate,
      editorId
    );
    const threadWithDisposable = new CommentThreadWithDisposable(thread);
    this._threads.set(commentThreadHandle, threadWithDisposable);
    threadWithDisposable.disposableStore.add(thread.onDidChangeCollapsibleState(() => {
      this.proxy.$updateCommentThread(this.handle, thread.commentThreadHandle, { collapseState: thread.collapsibleState });
    }));
    if (thread.isDocumentCommentThread()) {
      this._commentService.updateComments(this._uniqueId, {
        added: [thread],
        removed: [],
        changed: [],
        pending: []
      });
    } else {
      this._commentService.updateNotebookComments(this._uniqueId, {
        added: [thread],
        removed: [],
        changed: [],
        pending: []
      });
    }
    return thread;
  }
  updateCommentThread(commentThreadHandle, threadId, resource, changes) {
    const thread = this.getKnownThread(commentThreadHandle);
    thread.batchUpdate(changes);
    if (thread.isDocumentCommentThread()) {
      this._commentService.updateComments(this._uniqueId, {
        added: [],
        removed: [],
        changed: [thread],
        pending: []
      });
    } else {
      this._commentService.updateNotebookComments(this._uniqueId, {
        added: [],
        removed: [],
        changed: [thread],
        pending: []
      });
    }
  }
  deleteCommentThread(commentThreadHandle) {
    const thread = this.getKnownThread(commentThreadHandle);
    this._threads.deleteAndDispose(commentThreadHandle);
    thread.dispose();
    if (thread.isDocumentCommentThread()) {
      this._commentService.updateComments(this._uniqueId, {
        added: [],
        removed: [thread],
        changed: [],
        pending: []
      });
    } else {
      this._commentService.updateNotebookComments(this._uniqueId, {
        added: [],
        removed: [thread],
        changed: [],
        pending: []
      });
    }
  }
  deleteCommentThreadMain(commentThreadId) {
    for (const { thread } of this._threads.values()) {
      if (thread.threadId === commentThreadId) {
        this._proxy.$deleteCommentThread(this._handle, thread.commentThreadHandle);
      }
    }
  }
  updateInput(input) {
    const thread = this.activeEditingCommentThread;
    if (thread && thread.input) {
      const commentInput = thread.input;
      commentInput.value = input;
      thread.input = commentInput;
    }
  }
  updateCommentingRanges(resourceHints) {
    this._commentService.updateCommentingRanges(this._uniqueId, resourceHints);
  }
  getKnownThread(commentThreadHandle) {
    const thread = this._threads.get(commentThreadHandle);
    if (!thread) {
      throw new Error("unknown thread");
    }
    return thread.thread;
  }
  async getDocumentComments(resource, token) {
    if (resource.scheme === Schemas.vscodeNotebookCell) {
      return {
        uniqueOwner: this._uniqueId,
        label: this.label,
        threads: [],
        commentingRanges: {
          resource,
          ranges: [],
          fileComments: false
        }
      };
    }
    const ret = [];
    for (const thread of [...this._threads.keys()]) {
      const commentThread = this._threads.get(thread);
      if (commentThread.thread.resource === resource.toString()) {
        if (commentThread.thread.isDocumentCommentThread()) {
          ret.push(commentThread.thread);
        }
      }
    }
    const commentingRanges = await this._proxy.$provideCommentingRanges(this.handle, resource, token);
    return {
      uniqueOwner: this._uniqueId,
      label: this.label,
      threads: ret,
      commentingRanges: {
        resource,
        ranges: commentingRanges?.ranges || [],
        fileComments: !!commentingRanges?.fileComments
      }
    };
  }
  async getNotebookComments(resource, token) {
    if (resource.scheme !== Schemas.vscodeNotebookCell) {
      return {
        uniqueOwner: this._uniqueId,
        label: this.label,
        threads: []
      };
    }
    const ret = [];
    for (const thread of [...this._threads.keys()]) {
      const commentThread = this._threads.get(thread);
      if (commentThread.thread.resource === resource.toString()) {
        if (!commentThread.thread.isDocumentCommentThread()) {
          ret.push(commentThread.thread);
        }
      }
    }
    return {
      uniqueOwner: this._uniqueId,
      label: this.label,
      threads: ret
    };
  }
  async toggleReaction(uri, thread, comment, reaction, token) {
    return this._proxy.$toggleReaction(this._handle, thread.commentThreadHandle, uri, comment, reaction);
  }
  getAllComments() {
    const ret = [];
    for (const thread of [...this._threads.keys()]) {
      ret.push(this._threads.get(thread).thread);
    }
    return ret;
  }
  createCommentThreadTemplate(resource, range, editorId) {
    return this._proxy.$createCommentThreadTemplate(this.handle, resource, range, editorId);
  }
  async updateCommentThreadTemplate(threadHandle, range) {
    await this._proxy.$updateCommentThreadTemplate(this.handle, threadHandle, range);
  }
  toJSON() {
    return {
      $mid: MarshalledId.CommentController,
      handle: this.handle
    };
  }
}
const commentsViewIcon = registerIcon("comments-view-icon", Codicon.commentDiscussion, localize("commentsViewIcon", "View icon of the comments view."));
let MainThreadComments = class extends Disposable {
  constructor(extHostContext, _commentService, _viewsService, _viewDescriptorService, _uriIdentityService, _editorService) {
    super();
    this._commentService = _commentService;
    this._viewsService = _viewsService;
    this._viewDescriptorService = _viewDescriptorService;
    this._uriIdentityService = _uriIdentityService;
    this._editorService = _editorService;
    this._handlers = /* @__PURE__ */ new Map();
    this._commentControllers = /* @__PURE__ */ new Map();
    this._activeEditingCommentThreadDisposables = this._register(new DisposableStore());
    this._openViewListener = this._register(new MutableDisposable());
    this._onChangeContainerListener = this._register(new MutableDisposable());
    this._onChangeContainerLocationListener = this._register(new MutableDisposable());
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostComments);
    this._commentService.unregisterCommentController();
    this._register(this._commentService.onDidChangeActiveEditingCommentThread(async (thread) => {
      const handle = thread.controllerHandle;
      const controller = this._commentControllers.get(handle);
      if (!controller) {
        return;
      }
      this._activeEditingCommentThreadDisposables.clear();
      this._activeEditingCommentThread = thread;
      controller.activeEditingCommentThread = this._activeEditingCommentThread;
    }));
  }
  $registerCommentController(handle, id, label, extensionId) {
    const providerId = `${id}-${extensionId}`;
    this._handlers.set(handle, providerId);
    const provider = new MainThreadCommentController(this._proxy, this._commentService, handle, providerId, id, label, {});
    this._commentService.registerCommentController(providerId, provider);
    this._commentControllers.set(handle, provider);
    this._register(this._commentService.onResourceHasCommentingRanges((e) => {
      this.registerView();
    }));
    this._register(this._commentService.onDidUpdateCommentThreads((e) => {
      this.registerView();
    }));
    this._commentService.setWorkspaceComments(String(handle), []);
  }
  $unregisterCommentController(handle) {
    const providerId = this._handlers.get(handle);
    this._handlers.delete(handle);
    this._commentControllers.delete(handle);
    if (typeof providerId !== "string") {
      return;
    } else {
      this._commentService.unregisterCommentController(providerId);
    }
  }
  $updateCommentControllerFeatures(handle, features) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return void 0;
    }
    provider.updateFeatures(features);
  }
  $createCommentThread(handle, commentThreadHandle, threadId, resource, range, comments, extensionId, isTemplate, editorId) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return void 0;
    }
    return provider.createCommentThread(extensionId.value, commentThreadHandle, threadId, resource, range, comments, isTemplate, editorId);
  }
  $updateCommentThread(handle, commentThreadHandle, threadId, resource, changes) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return void 0;
    }
    return provider.updateCommentThread(commentThreadHandle, threadId, resource, changes);
  }
  $deleteCommentThread(handle, commentThreadHandle) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return;
    }
    return provider.deleteCommentThread(commentThreadHandle);
  }
  $updateCommentingRanges(handle, resourceHints) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return;
    }
    provider.updateCommentingRanges(resourceHints);
  }
  async $revealCommentThread(handle, commentThreadHandle, commentUniqueIdInThread, options) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return Promise.resolve();
    }
    const thread = provider.getAllComments().find((thread2) => thread2.commentThreadHandle === commentThreadHandle);
    if (!thread || !thread.isDocumentCommentThread()) {
      return Promise.resolve();
    }
    const comment = thread.comments?.find((comment2) => comment2.uniqueIdInThread === commentUniqueIdInThread);
    revealCommentThread(this._commentService, this._editorService, this._uriIdentityService, thread, comment, options.focusReply, void 0, options.preserveFocus);
  }
  async $hideCommentThread(handle, commentThreadHandle) {
    const provider = this._commentControllers.get(handle);
    if (!provider) {
      return Promise.resolve();
    }
    const thread = provider.getAllComments().find((thread2) => thread2.commentThreadHandle === commentThreadHandle);
    if (!thread || !thread.isDocumentCommentThread()) {
      return Promise.resolve();
    }
    thread.collapsibleState = languages.CommentThreadCollapsibleState.Collapsed;
  }
  registerView() {
    const commentsPanelAlreadyConstructed = !!this._viewDescriptorService.getViewDescriptorById(COMMENTS_VIEW_ID);
    if (!commentsPanelAlreadyConstructed) {
      const VIEW_CONTAINER = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer({
        id: COMMENTS_VIEW_ID,
        title: COMMENTS_VIEW_TITLE,
        ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [COMMENTS_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
        storageId: COMMENTS_VIEW_STORAGE_ID,
        hideIfEmpty: true,
        icon: commentsViewIcon,
        order: 10
      }, ViewContainerLocation.Panel);
      Registry.as(ViewExtensions.ViewsRegistry).registerViews([{
        id: COMMENTS_VIEW_ID,
        name: COMMENTS_VIEW_TITLE,
        canToggleVisibility: false,
        ctorDescriptor: new SyncDescriptor(CommentsPanel),
        canMoveView: true,
        containerIcon: commentsViewIcon,
        focusCommand: {
          id: "workbench.action.focusCommentsPanel"
        }
      }], VIEW_CONTAINER);
    }
    this.registerViewListeners(commentsPanelAlreadyConstructed);
  }
  setComments() {
    [...this._commentControllers.keys()].forEach((handle) => {
      const threads = this._commentControllers.get(handle).getAllComments();
      if (threads.length) {
        const providerId = this.getHandler(handle);
        this._commentService.setWorkspaceComments(providerId, threads);
      }
    });
  }
  registerViewOpenedListener() {
    if (!this._openViewListener.value) {
      this._openViewListener.value = this._viewsService.onDidChangeViewVisibility((e) => {
        if (e.id === COMMENTS_VIEW_ID && e.visible) {
          this.setComments();
          if (this._openViewListener) {
            this._openViewListener.dispose();
          }
        }
      });
    }
  }
  /**
   * If the comments view has never been opened, the constructor for it has not yet run so it has
   * no listeners for comment threads being set or updated. Listen for the view opening for the
   * first time and send it comments then.
   */
  registerViewListeners(commentsPanelAlreadyConstructed) {
    if (!commentsPanelAlreadyConstructed) {
      this.registerViewOpenedListener();
    }
    if (!this._onChangeContainerListener.value) {
      this._onChangeContainerListener.value = this._viewDescriptorService.onDidChangeContainer((e) => {
        if (e.views.find((view) => view.id === COMMENTS_VIEW_ID)) {
          this.setComments();
          this.registerViewOpenedListener();
        }
      });
    }
    if (!this._onChangeContainerLocationListener.value) {
      this._onChangeContainerLocationListener.value = this._viewDescriptorService.onDidChangeContainerLocation((e) => {
        const commentsContainer = this._viewDescriptorService.getViewContainerByViewId(COMMENTS_VIEW_ID);
        if (e.viewContainer.id === commentsContainer?.id) {
          this.setComments();
          this.registerViewOpenedListener();
        }
      });
    }
  }
  getHandler(handle) {
    if (!this._handlers.has(handle)) {
      throw new Error("Unknown handler");
    }
    return this._handlers.get(handle);
  }
};
MainThreadComments = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadComments),
  __decorateParam(1, ICommentService),
  __decorateParam(2, IViewsService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IEditorService)
], MainThreadComments);
export {
  MainThreadCommentController,
  MainThreadCommentThread,
  MainThreadComments
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENvbW1lbnRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgKiBhcyBsYW5ndWFnZXMgZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRDb250cm9sbGVyLCBJQ29tbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL2NvbW1lbnRzL2Jyb3dzZXIvY29tbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29tbWVudHNQYW5lbCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY29tbWVudHMvYnJvd3Nlci9jb21tZW50c1ZpZXcuanMnO1xuaW1wb3J0IHsgQ29tbWVudFByb3ZpZGVyRmVhdHVyZXMsIEV4dEhvc3RDb21tZW50c1NoYXBlLCBFeHRIb3N0Q29udGV4dCwgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRDb21tZW50c1NoYXBlLCBDb21tZW50VGhyZWFkQ2hhbmdlcyB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IENPTU1FTlRTX1ZJRVdfSUQsIENPTU1FTlRTX1ZJRVdfU1RPUkFHRV9JRCwgQ09NTUVOVFNfVklFV19USVRMRSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY29tbWVudHMvYnJvd3Nlci9jb21tZW50c1RyZWVWaWV3ZXIuanMnO1xuaW1wb3J0IHsgVmlld0NvbnRhaW5lciwgSVZpZXdDb250YWluZXJzUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgVmlld0V4dGVuc2lvbnMsIFZpZXdDb250YWluZXJMb2NhdGlvbiwgSVZpZXdzUmVnaXN0cnksIElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVySWNvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9pY29uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgSUNlbGxSYW5nZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZENvbW1lbnRUaHJlYWQgfSBmcm9tICcuLi8uLi9jb21tb24vY29tbWVudHMuanMnO1xuaW1wb3J0IHsgcmV2ZWFsQ29tbWVudFRocmVhZCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY29tbWVudHMvYnJvd3Nlci9jb21tZW50c0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxUPiBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Db21tZW50VGhyZWFkPFQ+IHtcblx0cHJpdmF0ZSBfaW5wdXQ/OiBsYW5ndWFnZXMuQ29tbWVudElucHV0O1xuXHRnZXQgaW5wdXQoKTogbGFuZ3VhZ2VzLkNvbW1lbnRJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2lucHV0O1xuXHR9XG5cblx0c2V0IGlucHV0KHZhbHVlOiBsYW5ndWFnZXMuQ29tbWVudElucHV0IHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5faW5wdXQgPSB2YWx1ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUlucHV0LmZpcmUodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VJbnB1dCA9IG5ldyBFbWl0dGVyPGxhbmd1YWdlcy5Db21tZW50SW5wdXQgfCB1bmRlZmluZWQ+KCk7XG5cdGdldCBvbkRpZENoYW5nZUlucHV0KCk6IEV2ZW50PGxhbmd1YWdlcy5Db21tZW50SW5wdXQgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlSW5wdXQuZXZlbnQ7IH1cblxuXHRwcml2YXRlIF9sYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGdldCBsYWJlbCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbDtcblx0fVxuXG5cdHNldCBsYWJlbChsYWJlbDogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fbGFiZWwgPSBsYWJlbDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUxhYmVsLmZpcmUodGhpcy5fbGFiZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udGV4dFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IGNvbnRleHRWYWx1ZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jb250ZXh0VmFsdWU7XG5cdH1cblxuXHRzZXQgY29udGV4dFZhbHVlKGNvbnRleHQ6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2NvbnRleHRWYWx1ZSA9IGNvbnRleHQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUxhYmVsID0gbmV3IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUxhYmVsOiBFdmVudDxzdHJpbmcgfCB1bmRlZmluZWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VMYWJlbC5ldmVudDtcblxuXHRwcml2YXRlIF9jb21tZW50czogUmVhZG9ubHlBcnJheTxsYW5ndWFnZXMuQ29tbWVudD4gfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIGdldCBjb21tZW50cygpOiBSZWFkb25seUFycmF5PGxhbmd1YWdlcy5Db21tZW50PiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbW1lbnRzO1xuXHR9XG5cblx0cHVibGljIHNldCBjb21tZW50cyhuZXdDb21tZW50czogUmVhZG9ubHlBcnJheTxsYW5ndWFnZXMuQ29tbWVudD4gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9jb21tZW50cyA9IG5ld0NvbW1lbnRzO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29tbWVudHMuZmlyZSh0aGlzLl9jb21tZW50cyk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbW1lbnRzID0gbmV3IEVtaXR0ZXI8cmVhZG9ubHkgbGFuZ3VhZ2VzLkNvbW1lbnRbXSB8IHVuZGVmaW5lZD4oKTtcblx0Z2V0IG9uRGlkQ2hhbmdlQ29tbWVudHMoKTogRXZlbnQ8cmVhZG9ubHkgbGFuZ3VhZ2VzLkNvbW1lbnRbXSB8IHVuZGVmaW5lZD4geyByZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VDb21tZW50cy5ldmVudDsgfVxuXG5cdHNldCByYW5nZShyYW5nZTogVCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3JhbmdlID0gcmFuZ2U7XG5cdH1cblxuXHRnZXQgcmFuZ2UoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JhbmdlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDYW5SZXBseSA9IG5ldyBFbWl0dGVyPGJvb2xlYW4+KCk7XG5cdGdldCBvbkRpZENoYW5nZUNhblJlcGx5KCk6IEV2ZW50PGJvb2xlYW4+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlQ2FuUmVwbHkuZXZlbnQ7IH1cblx0c2V0IGNhblJlcGx5KHN0YXRlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5fY2FuUmVwbHkgPSBzdGF0ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNhblJlcGx5LmZpcmUodGhpcy5fY2FuUmVwbHkpO1xuXHR9XG5cblx0Z2V0IGNhblJlcGx5KCkge1xuXHRcdHJldHVybiB0aGlzLl9jYW5SZXBseTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbGxhcHNpYmxlU3RhdGU6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZSB8IHVuZGVmaW5lZCA9IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQ7XG5cdGdldCBjb2xsYXBzaWJsZVN0YXRlKCkge1xuXHRcdHJldHVybiB0aGlzLl9jb2xsYXBzaWJsZVN0YXRlO1xuXHR9XG5cblx0c2V0IGNvbGxhcHNpYmxlU3RhdGUobmV3U3RhdGU6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLmluaXRpYWxDb2xsYXBzaWJsZVN0YXRlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuaW5pdGlhbENvbGxhcHNpYmxlU3RhdGUgPSBuZXdTdGF0ZTtcblx0XHR9XG5cblx0XHRpZiAobmV3U3RhdGUgIT09IHRoaXMuX2NvbGxhcHNpYmxlU3RhdGUpIHtcblx0XHRcdHRoaXMuX2NvbGxhcHNpYmxlU3RhdGUgPSBuZXdTdGF0ZTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29sbGFwc2libGVTdGF0ZS5maXJlKHRoaXMuX2NvbGxhcHNpYmxlU3RhdGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2luaXRpYWxDb2xsYXBzaWJsZVN0YXRlOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZENvbGxhcHNpYmxlU3RhdGUgfCB1bmRlZmluZWQ7XG5cdGdldCBpbml0aWFsQ29sbGFwc2libGVTdGF0ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbENvbGxhcHNpYmxlU3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIHNldCBpbml0aWFsQ29sbGFwc2libGVTdGF0ZShpbml0aWFsQ29sbGFwc2libGVTdGF0ZTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5faW5pdGlhbENvbGxhcHNpYmxlU3RhdGUgPSBpbml0aWFsQ29sbGFwc2libGVTdGF0ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUluaXRpYWxDb2xsYXBzaWJsZVN0YXRlLmZpcmUoaW5pdGlhbENvbGxhcHNpYmxlU3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb2xsYXBzaWJsZVN0YXRlID0gbmV3IEVtaXR0ZXI8bGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlIHwgdW5kZWZpbmVkPigpO1xuXHRwdWJsaWMgb25EaWRDaGFuZ2VDb2xsYXBzaWJsZVN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VDb2xsYXBzaWJsZVN0YXRlLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUluaXRpYWxDb2xsYXBzaWJsZVN0YXRlID0gbmV3IEVtaXR0ZXI8bGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRDb2xsYXBzaWJsZVN0YXRlIHwgdW5kZWZpbmVkPigpO1xuXHRwdWJsaWMgb25EaWRDaGFuZ2VJbml0aWFsQ29sbGFwc2libGVTdGF0ZSA9IHRoaXMuX29uRGlkQ2hhbmdlSW5pdGlhbENvbGxhcHNpYmxlU3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbjtcblxuXHRnZXQgaXNEaXNwb3NlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNEaXNwb3NlZDtcblx0fVxuXG5cdGlzRG9jdW1lbnRDb21tZW50VGhyZWFkKCk6IHRoaXMgaXMgbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3JhbmdlID09PSB1bmRlZmluZWQgfHwgUmFuZ2UuaXNJUmFuZ2UodGhpcy5fcmFuZ2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhdGU6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkU3RhdGUgfCB1bmRlZmluZWQ7XG5cdGdldCBzdGF0ZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhdGU7XG5cdH1cblxuXHRzZXQgc3RhdGUobmV3U3RhdGU6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkU3RhdGUgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9zdGF0ZSA9IG5ld1N0YXRlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSh0aGlzLl9zdGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBsaWNhYmlsaXR5OiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHkgfCB1bmRlZmluZWQ7XG5cblx0Z2V0IGFwcGxpY2FiaWxpdHkoKTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRBcHBsaWNhYmlsaXR5IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fYXBwbGljYWJpbGl0eTtcblx0fVxuXG5cdHNldCBhcHBsaWNhYmlsaXR5KHZhbHVlOiBsYW5ndWFnZXMuQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHkgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9hcHBsaWNhYmlsaXR5ID0gdmFsdWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBcHBsaWNhYmlsaXR5LmZpcmUodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBcHBsaWNhYmlsaXR5ID0gbmV3IEVtaXR0ZXI8bGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRBcHBsaWNhYmlsaXR5IHwgdW5kZWZpbmVkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFwcGxpY2FiaWxpdHk6IEV2ZW50PGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQXBwbGljYWJpbGl0eSB8IHVuZGVmaW5lZD4gPSB0aGlzLl9vbkRpZENoYW5nZUFwcGxpY2FiaWxpdHkuZXZlbnQ7XG5cblx0cHVibGljIGdldCBpc1RlbXBsYXRlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc1RlbXBsYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0ZSA9IG5ldyBFbWl0dGVyPGxhbmd1YWdlcy5Db21tZW50VGhyZWFkU3RhdGUgfCB1bmRlZmluZWQ+KCk7XG5cdHB1YmxpYyBvbkRpZENoYW5nZVN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgY29tbWVudFRocmVhZEhhbmRsZTogbnVtYmVyLFxuXHRcdHB1YmxpYyBjb250cm9sbGVySGFuZGxlOiBudW1iZXIsXG5cdFx0cHVibGljIGV4dGVuc2lvbklkOiBzdHJpbmcsXG5cdFx0cHVibGljIHRocmVhZElkOiBzdHJpbmcsXG5cdFx0cHVibGljIHJlc291cmNlOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfcmFuZ2U6IFQgfCB1bmRlZmluZWQsXG5cdFx0Y29tbWVudHM6IGxhbmd1YWdlcy5Db21tZW50W10gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfY2FuUmVwbHk6IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSBfaXNUZW1wbGF0ZTogYm9vbGVhbixcblx0XHRwdWJsaWMgZWRpdG9ySWQ/OiBzdHJpbmdcblx0KSB7XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdGlmIChfaXNUZW1wbGF0ZSkge1xuXHRcdFx0dGhpcy5jb21tZW50cyA9IFtdO1xuXHRcdH0gZWxzZSBpZiAoY29tbWVudHMpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRzID0gY29tbWVudHM7XG5cdFx0fVxuXHR9XG5cblx0YmF0Y2hVcGRhdGUoY2hhbmdlczogQ29tbWVudFRocmVhZENoYW5nZXM8VD4pIHtcblx0XHRjb25zdCBtb2RpZmllZCA9ICh2YWx1ZToga2V5b2YgQ29tbWVudFRocmVhZENoYW5nZXMpOiBib29sZWFuID0+XG5cdFx0XHRPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY2hhbmdlcywgdmFsdWUpO1xuXG5cdFx0aWYgKG1vZGlmaWVkKCdyYW5nZScpKSB7IHRoaXMuX3JhbmdlID0gY2hhbmdlcy5yYW5nZSE7IH1cblx0XHRpZiAobW9kaWZpZWQoJ2xhYmVsJykpIHsgdGhpcy5fbGFiZWwgPSBjaGFuZ2VzLmxhYmVsOyB9XG5cdFx0aWYgKG1vZGlmaWVkKCdjb250ZXh0VmFsdWUnKSkgeyB0aGlzLl9jb250ZXh0VmFsdWUgPSBjaGFuZ2VzLmNvbnRleHRWYWx1ZSA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IGNoYW5nZXMuY29udGV4dFZhbHVlOyB9XG5cdFx0aWYgKG1vZGlmaWVkKCdjb21tZW50cycpKSB7IHRoaXMuY29tbWVudHMgPSBjaGFuZ2VzLmNvbW1lbnRzOyB9XG5cdFx0aWYgKG1vZGlmaWVkKCdjb2xsYXBzZVN0YXRlJykpIHsgdGhpcy5jb2xsYXBzaWJsZVN0YXRlID0gY2hhbmdlcy5jb2xsYXBzZVN0YXRlOyB9XG5cdFx0aWYgKG1vZGlmaWVkKCdjYW5SZXBseScpKSB7IHRoaXMuY2FuUmVwbHkgPSBjaGFuZ2VzLmNhblJlcGx5ITsgfVxuXHRcdGlmIChtb2RpZmllZCgnc3RhdGUnKSkgeyB0aGlzLnN0YXRlID0gY2hhbmdlcy5zdGF0ZSE7IH1cblx0XHRpZiAobW9kaWZpZWQoJ2FwcGxpY2FiaWxpdHknKSkgeyB0aGlzLmFwcGxpY2FiaWxpdHkgPSBjaGFuZ2VzLmFwcGxpY2FiaWxpdHkhOyB9XG5cdFx0aWYgKG1vZGlmaWVkKCdpc1RlbXBsYXRlJykpIHsgdGhpcy5faXNUZW1wbGF0ZSA9IGNoYW5nZXMuaXNUZW1wbGF0ZSE7IH1cblx0fVxuXG5cdGhhc0NvbW1lbnRzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuY29tbWVudHMgJiYgdGhpcy5jb21tZW50cy5sZW5ndGggPiAwO1xuXHR9XG5cblx0ZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbGxhcHNpYmxlU3RhdGUuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29tbWVudHMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlSW5wdXQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlTGFiZWwuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZGlzcG9zZSgpO1xuXHR9XG5cblx0dG9KU09OKCk6IE1hcnNoYWxsZWRDb21tZW50VGhyZWFkIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRUaHJlYWQsXG5cdFx0XHRjb21tZW50Q29udHJvbEhhbmRsZTogdGhpcy5jb250cm9sbGVySGFuZGxlLFxuXHRcdFx0Y29tbWVudFRocmVhZEhhbmRsZTogdGhpcy5jb21tZW50VGhyZWFkSGFuZGxlLFxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgQ29tbWVudFRocmVhZFdpdGhEaXNwb3NhYmxlIHtcblx0cHVibGljIHJlYWRvbmx5IGRpc3Bvc2FibGVTdG9yZTogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgdGhyZWFkOiBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJUmFuZ2UgfCBJQ2VsbFJhbmdlPikgeyB9XG5cdGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkQ29tbWVudENvbnRyb2xsZXIgaW1wbGVtZW50cyBJQ29tbWVudENvbnRyb2xsZXIge1xuXHRnZXQgaGFuZGxlKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2hhbmRsZTtcblx0fVxuXG5cdGdldCBpZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxuXG5cdGdldCBjb250ZXh0VmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5faWQ7XG5cdH1cblxuXHRnZXQgcHJveHkoKTogRXh0SG9zdENvbW1lbnRzU2hhcGUge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eTtcblx0fVxuXG5cdGdldCBsYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9sYWJlbDtcblx0fVxuXG5cdHByaXZhdGUgX3JlYWN0aW9uczogbGFuZ3VhZ2VzLkNvbW1lbnRSZWFjdGlvbltdIHwgdW5kZWZpbmVkO1xuXG5cdGdldCByZWFjdGlvbnMoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlYWN0aW9ucztcblx0fVxuXG5cdHNldCByZWFjdGlvbnMocmVhY3Rpb25zOiBsYW5ndWFnZXMuQ29tbWVudFJlYWN0aW9uW10gfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9yZWFjdGlvbnMgPSByZWFjdGlvbnM7XG5cdH1cblxuXHRnZXQgb3B0aW9ucygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZmVhdHVyZXMub3B0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3RocmVhZHM6IERpc3Bvc2FibGVNYXA8bnVtYmVyLCBDb21tZW50VGhyZWFkV2l0aERpc3Bvc2FibGU+ID0gbmV3IERpc3Bvc2FibGVNYXA8bnVtYmVyLCBDb21tZW50VGhyZWFkV2l0aERpc3Bvc2FibGU+KCk7XG5cdHB1YmxpYyBhY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZD86IE1haW5UaHJlYWRDb21tZW50VGhyZWFkPElSYW5nZSB8IElDZWxsUmFuZ2U+O1xuXG5cdGdldCBmZWF0dXJlcygpOiBDb21tZW50UHJvdmlkZXJGZWF0dXJlcyB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZlYXR1cmVzO1xuXHR9XG5cblx0Z2V0IG93bmVyKCkge1xuXHRcdHJldHVybiB0aGlzLl9pZDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0Q29tbWVudHNTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tZW50U2VydmljZTogSUNvbW1lbnRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuaXF1ZUlkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbDogc3RyaW5nLFxuXHRcdHByaXZhdGUgX2ZlYXR1cmVzOiBDb21tZW50UHJvdmlkZXJGZWF0dXJlc1xuXHQpIHsgfVxuXG5cdGdldCBhY3RpdmVDb21tZW50KCkge1xuXHRcdHJldHVybiB0aGlzLl9hY3RpdmVDb21tZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBfYWN0aXZlQ29tbWVudDogeyB0aHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkOyBjb21tZW50PzogbGFuZ3VhZ2VzLkNvbW1lbnQgfSB8IHVuZGVmaW5lZDtcblx0YXN5bmMgc2V0QWN0aXZlQ29tbWVudEFuZFRocmVhZChjb21tZW50SW5mbzogeyB0aHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkOyBjb21tZW50PzogbGFuZ3VhZ2VzLkNvbW1lbnQgfSB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX2FjdGl2ZUNvbW1lbnQgPSBjb21tZW50SW5mbztcblx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHNldEFjdGl2ZUNvbW1lbnQodGhpcy5faGFuZGxlLCBjb21tZW50SW5mbyA/IHsgY29tbWVudFRocmVhZEhhbmRsZTogY29tbWVudEluZm8udGhyZWFkLmNvbW1lbnRUaHJlYWRIYW5kbGUsIHVuaXF1ZUlkSW5UaHJlYWQ6IGNvbW1lbnRJbmZvLmNvbW1lbnQ/LnVuaXF1ZUlkSW5UaHJlYWQgfSA6IHVuZGVmaW5lZCk7XG5cdH1cblxuXHR1cGRhdGVGZWF0dXJlcyhmZWF0dXJlczogQ29tbWVudFByb3ZpZGVyRmVhdHVyZXMpIHtcblx0XHR0aGlzLl9mZWF0dXJlcyA9IGZlYXR1cmVzO1xuXHR9XG5cblx0Y3JlYXRlQ29tbWVudFRocmVhZChleHRlbnNpb25JZDogc3RyaW5nLFxuXHRcdGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlcixcblx0XHR0aHJlYWRJZDogc3RyaW5nLFxuXHRcdHJlc291cmNlOiBVcmlDb21wb25lbnRzLFxuXHRcdHJhbmdlOiBJUmFuZ2UgfCBJQ2VsbFJhbmdlIHwgdW5kZWZpbmVkLFxuXHRcdGNvbW1lbnRzOiBsYW5ndWFnZXMuQ29tbWVudFtdLFxuXHRcdGlzVGVtcGxhdGU6IGJvb2xlYW4sXG5cdFx0ZWRpdG9ySWQ/OiBzdHJpbmdcblx0KTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT4ge1xuXHRcdGNvbnN0IHRocmVhZCA9IG5ldyBNYWluVGhyZWFkQ29tbWVudFRocmVhZChcblx0XHRcdGNvbW1lbnRUaHJlYWRIYW5kbGUsXG5cdFx0XHR0aGlzLmhhbmRsZSxcblx0XHRcdGV4dGVuc2lvbklkLFxuXHRcdFx0dGhyZWFkSWQsXG5cdFx0XHRVUkkucmV2aXZlKHJlc291cmNlKS50b1N0cmluZygpLFxuXHRcdFx0cmFuZ2UsXG5cdFx0XHRjb21tZW50cyxcblx0XHRcdHRydWUsXG5cdFx0XHRpc1RlbXBsYXRlLFxuXHRcdFx0ZWRpdG9ySWRcblx0XHQpO1xuXG5cdFx0Y29uc3QgdGhyZWFkV2l0aERpc3Bvc2FibGUgPSBuZXcgQ29tbWVudFRocmVhZFdpdGhEaXNwb3NhYmxlKHRocmVhZCk7XG5cdFx0dGhpcy5fdGhyZWFkcy5zZXQoY29tbWVudFRocmVhZEhhbmRsZSwgdGhyZWFkV2l0aERpc3Bvc2FibGUpO1xuXHRcdHRocmVhZFdpdGhEaXNwb3NhYmxlLmRpc3Bvc2FibGVTdG9yZS5hZGQodGhyZWFkLm9uRGlkQ2hhbmdlQ29sbGFwc2libGVTdGF0ZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnByb3h5LiR1cGRhdGVDb21tZW50VGhyZWFkKHRoaXMuaGFuZGxlLCB0aHJlYWQuY29tbWVudFRocmVhZEhhbmRsZSwgeyBjb2xsYXBzZVN0YXRlOiB0aHJlYWQuY29sbGFwc2libGVTdGF0ZSB9KTtcblx0XHR9KSk7XG5cblxuXHRcdGlmICh0aHJlYWQuaXNEb2N1bWVudENvbW1lbnRUaHJlYWQoKSkge1xuXHRcdFx0dGhpcy5fY29tbWVudFNlcnZpY2UudXBkYXRlQ29tbWVudHModGhpcy5fdW5pcXVlSWQsIHtcblx0XHRcdFx0YWRkZWQ6IFt0aHJlYWRdLFxuXHRcdFx0XHRyZW1vdmVkOiBbXSxcblx0XHRcdFx0Y2hhbmdlZDogW10sXG5cdFx0XHRcdHBlbmRpbmc6IFtdXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY29tbWVudFNlcnZpY2UudXBkYXRlTm90ZWJvb2tDb21tZW50cyh0aGlzLl91bmlxdWVJZCwge1xuXHRcdFx0XHRhZGRlZDogW3RocmVhZCBhcyBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJQ2VsbFJhbmdlPl0sXG5cdFx0XHRcdHJlbW92ZWQ6IFtdLFxuXHRcdFx0XHRjaGFuZ2VkOiBbXSxcblx0XHRcdFx0cGVuZGluZzogW11cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aHJlYWQ7XG5cdH1cblxuXHR1cGRhdGVDb21tZW50VGhyZWFkKGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlcixcblx0XHR0aHJlYWRJZDogc3RyaW5nLFxuXHRcdHJlc291cmNlOiBVcmlDb21wb25lbnRzLFxuXHRcdGNoYW5nZXM6IENvbW1lbnRUaHJlYWRDaGFuZ2VzKTogdm9pZCB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5nZXRLbm93blRocmVhZChjb21tZW50VGhyZWFkSGFuZGxlKTtcblx0XHR0aHJlYWQuYmF0Y2hVcGRhdGUoY2hhbmdlcyk7XG5cblx0XHRpZiAodGhyZWFkLmlzRG9jdW1lbnRDb21tZW50VGhyZWFkKCkpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRTZXJ2aWNlLnVwZGF0ZUNvbW1lbnRzKHRoaXMuX3VuaXF1ZUlkLCB7XG5cdFx0XHRcdGFkZGVkOiBbXSxcblx0XHRcdFx0cmVtb3ZlZDogW10sXG5cdFx0XHRcdGNoYW5nZWQ6IFt0aHJlYWRdLFxuXHRcdFx0XHRwZW5kaW5nOiBbXVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRTZXJ2aWNlLnVwZGF0ZU5vdGVib29rQ29tbWVudHModGhpcy5fdW5pcXVlSWQsIHtcblx0XHRcdFx0YWRkZWQ6IFtdLFxuXHRcdFx0XHRyZW1vdmVkOiBbXSxcblx0XHRcdFx0Y2hhbmdlZDogW3RocmVhZCBhcyBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJQ2VsbFJhbmdlPl0sXG5cdFx0XHRcdHBlbmRpbmc6IFtdXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0fVxuXG5cdGRlbGV0ZUNvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZEhhbmRsZTogbnVtYmVyKSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5nZXRLbm93blRocmVhZChjb21tZW50VGhyZWFkSGFuZGxlKTtcblx0XHR0aGlzLl90aHJlYWRzLmRlbGV0ZUFuZERpc3Bvc2UoY29tbWVudFRocmVhZEhhbmRsZSk7XG5cdFx0dGhyZWFkLmRpc3Bvc2UoKTtcblxuXHRcdGlmICh0aHJlYWQuaXNEb2N1bWVudENvbW1lbnRUaHJlYWQoKSkge1xuXHRcdFx0dGhpcy5fY29tbWVudFNlcnZpY2UudXBkYXRlQ29tbWVudHModGhpcy5fdW5pcXVlSWQsIHtcblx0XHRcdFx0YWRkZWQ6IFtdLFxuXHRcdFx0XHRyZW1vdmVkOiBbdGhyZWFkXSxcblx0XHRcdFx0Y2hhbmdlZDogW10sXG5cdFx0XHRcdHBlbmRpbmc6IFtdXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY29tbWVudFNlcnZpY2UudXBkYXRlTm90ZWJvb2tDb21tZW50cyh0aGlzLl91bmlxdWVJZCwge1xuXHRcdFx0XHRhZGRlZDogW10sXG5cdFx0XHRcdHJlbW92ZWQ6IFt0aHJlYWQgYXMgTWFpblRocmVhZENvbW1lbnRUaHJlYWQ8SUNlbGxSYW5nZT5dLFxuXHRcdFx0XHRjaGFuZ2VkOiBbXSxcblx0XHRcdFx0cGVuZGluZzogW11cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGRlbGV0ZUNvbW1lbnRUaHJlYWRNYWluKGNvbW1lbnRUaHJlYWRJZDogc3RyaW5nKSB7XG5cdFx0Zm9yIChjb25zdCB7IHRocmVhZCB9IG9mIHRoaXMuX3RocmVhZHMudmFsdWVzKCkpIHtcblx0XHRcdGlmICh0aHJlYWQudGhyZWFkSWQgPT09IGNvbW1lbnRUaHJlYWRJZCkge1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kZGVsZXRlQ29tbWVudFRocmVhZCh0aGlzLl9oYW5kbGUsIHRocmVhZC5jb21tZW50VGhyZWFkSGFuZGxlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR1cGRhdGVJbnB1dChpbnB1dDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5hY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZDtcblxuXHRcdGlmICh0aHJlYWQgJiYgdGhyZWFkLmlucHV0KSB7XG5cdFx0XHRjb25zdCBjb21tZW50SW5wdXQgPSB0aHJlYWQuaW5wdXQ7XG5cdFx0XHRjb21tZW50SW5wdXQudmFsdWUgPSBpbnB1dDtcblx0XHRcdHRocmVhZC5pbnB1dCA9IGNvbW1lbnRJbnB1dDtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVDb21tZW50aW5nUmFuZ2VzKHJlc291cmNlSGludHM/OiBsYW5ndWFnZXMuQ29tbWVudGluZ1JhbmdlUmVzb3VyY2VIaW50KSB7XG5cdFx0dGhpcy5fY29tbWVudFNlcnZpY2UudXBkYXRlQ29tbWVudGluZ1Jhbmdlcyh0aGlzLl91bmlxdWVJZCwgcmVzb3VyY2VIaW50cyk7XG5cdH1cblxuXHRwcml2YXRlIGdldEtub3duVGhyZWFkKGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlcik6IE1haW5UaHJlYWRDb21tZW50VGhyZWFkPElSYW5nZSB8IElDZWxsUmFuZ2U+IHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLl90aHJlYWRzLmdldChjb21tZW50VGhyZWFkSGFuZGxlKTtcblx0XHRpZiAoIXRocmVhZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bmtub3duIHRocmVhZCcpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhyZWFkLnRocmVhZDtcblx0fVxuXG5cdGFzeW5jIGdldERvY3VtZW50Q29tbWVudHMocmVzb3VyY2U6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0aWYgKHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGwpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHVuaXF1ZU93bmVyOiB0aGlzLl91bmlxdWVJZCxcblx0XHRcdFx0bGFiZWw6IHRoaXMubGFiZWwsXG5cdFx0XHRcdHRocmVhZHM6IFtdLFxuXHRcdFx0XHRjb21tZW50aW5nUmFuZ2VzOiB7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0XHRcdHJhbmdlczogW10sXG5cdFx0XHRcdFx0ZmlsZUNvbW1lbnRzOiBmYWxzZVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHJldDogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlPltdID0gW107XG5cdFx0Zm9yIChjb25zdCB0aHJlYWQgb2YgWy4uLnRoaXMuX3RocmVhZHMua2V5cygpXSkge1xuXHRcdFx0Y29uc3QgY29tbWVudFRocmVhZCA9IHRoaXMuX3RocmVhZHMuZ2V0KHRocmVhZCkhO1xuXHRcdFx0aWYgKGNvbW1lbnRUaHJlYWQudGhyZWFkLnJlc291cmNlID09PSByZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdGlmIChjb21tZW50VGhyZWFkLnRocmVhZC5pc0RvY3VtZW50Q29tbWVudFRocmVhZCgpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goY29tbWVudFRocmVhZC50aHJlYWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWVudGluZ1JhbmdlcyA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcm92aWRlQ29tbWVudGluZ1Jhbmdlcyh0aGlzLmhhbmRsZSwgcmVzb3VyY2UsIHRva2VuKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHR1bmlxdWVPd25lcjogdGhpcy5fdW5pcXVlSWQsXG5cdFx0XHRsYWJlbDogdGhpcy5sYWJlbCxcblx0XHRcdHRocmVhZHM6IHJldCxcblx0XHRcdGNvbW1lbnRpbmdSYW5nZXM6IHtcblx0XHRcdFx0cmVzb3VyY2U6IHJlc291cmNlLFxuXHRcdFx0XHRyYW5nZXM6IGNvbW1lbnRpbmdSYW5nZXM/LnJhbmdlcyB8fCBbXSxcblx0XHRcdFx0ZmlsZUNvbW1lbnRzOiAhIWNvbW1lbnRpbmdSYW5nZXM/LmZpbGVDb21tZW50c1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBnZXROb3RlYm9va0NvbW1lbnRzKHJlc291cmNlOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGlmIChyZXNvdXJjZS5zY2hlbWUgIT09IFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR1bmlxdWVPd25lcjogdGhpcy5fdW5pcXVlSWQsXG5cdFx0XHRcdGxhYmVsOiB0aGlzLmxhYmVsLFxuXHRcdFx0XHR0aHJlYWRzOiBbXVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCByZXQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkPElDZWxsUmFuZ2U+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHRocmVhZCBvZiBbLi4udGhpcy5fdGhyZWFkcy5rZXlzKCldKSB7XG5cdFx0XHRjb25zdCBjb21tZW50VGhyZWFkID0gdGhpcy5fdGhyZWFkcy5nZXQodGhyZWFkKSE7XG5cdFx0XHRpZiAoY29tbWVudFRocmVhZC50aHJlYWQucmVzb3VyY2UgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0aWYgKCFjb21tZW50VGhyZWFkLnRocmVhZC5pc0RvY3VtZW50Q29tbWVudFRocmVhZCgpKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goY29tbWVudFRocmVhZC50aHJlYWQgYXMgbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SUNlbGxSYW5nZT4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHVuaXF1ZU93bmVyOiB0aGlzLl91bmlxdWVJZCxcblx0XHRcdGxhYmVsOiB0aGlzLmxhYmVsLFxuXHRcdFx0dGhyZWFkczogcmV0XG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIHRvZ2dsZVJlYWN0aW9uKHVyaTogVVJJLCB0aHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkLCBjb21tZW50OiBsYW5ndWFnZXMuQ29tbWVudCwgcmVhY3Rpb246IGxhbmd1YWdlcy5Db21tZW50UmVhY3Rpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kdG9nZ2xlUmVhY3Rpb24odGhpcy5faGFuZGxlLCB0aHJlYWQuY29tbWVudFRocmVhZEhhbmRsZSwgdXJpLCBjb21tZW50LCByZWFjdGlvbik7XG5cdH1cblxuXHRnZXRBbGxDb21tZW50cygpOiBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJUmFuZ2UgfCBJQ2VsbFJhbmdlPltdIHtcblx0XHRjb25zdCByZXQ6IE1haW5UaHJlYWRDb21tZW50VGhyZWFkPElSYW5nZSB8IElDZWxsUmFuZ2U+W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHRocmVhZCBvZiBbLi4udGhpcy5fdGhyZWFkcy5rZXlzKCldKSB7XG5cdFx0XHRyZXQucHVzaCh0aGlzLl90aHJlYWRzLmdldCh0aHJlYWQpIS50aHJlYWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRjcmVhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUocmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHJhbmdlOiBJUmFuZ2UgfCB1bmRlZmluZWQsIGVkaXRvcklkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRjcmVhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUodGhpcy5oYW5kbGUsIHJlc291cmNlLCByYW5nZSwgZWRpdG9ySWQpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlQ29tbWVudFRocmVhZFRlbXBsYXRlKHRocmVhZEhhbmRsZTogbnVtYmVyLCByYW5nZTogSVJhbmdlKSB7XG5cdFx0YXdhaXQgdGhpcy5fcHJveHkuJHVwZGF0ZUNvbW1lbnRUaHJlYWRUZW1wbGF0ZSh0aGlzLmhhbmRsZSwgdGhyZWFkSGFuZGxlLCByYW5nZSk7XG5cdH1cblxuXHR0b0pTT04oKTogYW55IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRDb250cm9sbGVyLFxuXHRcdFx0aGFuZGxlOiB0aGlzLmhhbmRsZVxuXHRcdH07XG5cdH1cbn1cblxuXG5jb25zdCBjb21tZW50c1ZpZXdJY29uID0gcmVnaXN0ZXJJY29uKCdjb21tZW50cy12aWV3LWljb24nLCBDb2RpY29uLmNvbW1lbnREaXNjdXNzaW9uLCBsb2NhbGl6ZSgnY29tbWVudHNWaWV3SWNvbicsICdWaWV3IGljb24gb2YgdGhlIGNvbW1lbnRzIHZpZXcuJykpO1xuXG5AZXh0SG9zdE5hbWVkQ3VzdG9tZXIoTWFpbkNvbnRleHQuTWFpblRocmVhZENvbW1lbnRzKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRDb21tZW50cyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBNYWluVGhyZWFkQ29tbWVudHNTaGFwZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0Q29tbWVudHNTaGFwZTtcblxuXHRwcml2YXRlIF9oYW5kbGVycyA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KCk7XG5cdHByaXZhdGUgX2NvbW1lbnRDb250cm9sbGVycyA9IG5ldyBNYXA8bnVtYmVyLCBNYWluVGhyZWFkQ29tbWVudENvbnRyb2xsZXI+KCk7XG5cblx0cHJpdmF0ZSBfYWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQ/OiBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJUmFuZ2UgfCBJQ2VsbFJhbmdlPjtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb3BlblZpZXdMaXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkNoYW5nZUNvbnRhaW5lckxpc3RlbmVyOiBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ2hhbmdlQ29udGFpbmVyTG9jYXRpb25MaXN0ZW5lcjogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElDb21tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tZW50U2VydmljZTogSUNvbW1lbnRTZXJ2aWNlLFxuXHRcdEBJVmlld3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF92aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdENvbW1lbnRzKTtcblx0XHR0aGlzLl9jb21tZW50U2VydmljZS51bnJlZ2lzdGVyQ29tbWVudENvbnRyb2xsZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQoYXN5bmMgdGhyZWFkID0+IHtcblx0XHRcdGNvbnN0IGhhbmRsZSA9ICh0aHJlYWQgYXMgTWFpblRocmVhZENvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT4pLmNvbnRyb2xsZXJIYW5kbGU7XG5cdFx0XHRjb25zdCBjb250cm9sbGVyID0gdGhpcy5fY29tbWVudENvbnRyb2xsZXJzLmdldChoYW5kbGUpO1xuXG5cdFx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9hY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9hY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZCA9IHRocmVhZCBhcyBNYWluVGhyZWFkQ29tbWVudFRocmVhZDxJUmFuZ2UgfCBJQ2VsbFJhbmdlPjtcblx0XHRcdGNvbnRyb2xsZXIuYWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQgPSB0aGlzLl9hY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZDtcblx0XHR9KSk7XG5cdH1cblxuXHQkcmVnaXN0ZXJDb21tZW50Q29udHJvbGxlcihoYW5kbGU6IG51bWJlciwgaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZywgZXh0ZW5zaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3ZpZGVySWQgPSBgJHtpZH0tJHtleHRlbnNpb25JZH1gO1xuXHRcdHRoaXMuX2hhbmRsZXJzLnNldChoYW5kbGUsIHByb3ZpZGVySWQpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTWFpblRocmVhZENvbW1lbnRDb250cm9sbGVyKHRoaXMuX3Byb3h5LCB0aGlzLl9jb21tZW50U2VydmljZSwgaGFuZGxlLCBwcm92aWRlcklkLCBpZCwgbGFiZWwsIHt9KTtcblx0XHR0aGlzLl9jb21tZW50U2VydmljZS5yZWdpc3RlckNvbW1lbnRDb250cm9sbGVyKHByb3ZpZGVySWQsIHByb3ZpZGVyKTtcblx0XHR0aGlzLl9jb21tZW50Q29udHJvbGxlcnMuc2V0KGhhbmRsZSwgcHJvdmlkZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29tbWVudFNlcnZpY2Uub25SZXNvdXJjZUhhc0NvbW1lbnRpbmdSYW5nZXMoZSA9PiB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVmlldygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbW1lbnRTZXJ2aWNlLm9uRGlkVXBkYXRlQ29tbWVudFRocmVhZHMoZSA9PiB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVmlldygpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbW1lbnRTZXJ2aWNlLnNldFdvcmtzcGFjZUNvbW1lbnRzKFN0cmluZyhoYW5kbGUpLCBbXSk7XG5cdH1cblxuXHQkdW5yZWdpc3RlckNvbW1lbnRDb250cm9sbGVyKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXJJZCA9IHRoaXMuX2hhbmRsZXJzLmdldChoYW5kbGUpO1xuXHRcdHRoaXMuX2hhbmRsZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdHRoaXMuX2NvbW1lbnRDb250cm9sbGVycy5kZWxldGUoaGFuZGxlKTtcblxuXHRcdGlmICh0eXBlb2YgcHJvdmlkZXJJZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybjtcblx0XHRcdC8vIHRocm93IG5ldyBFcnJvcigndW5rbm93biBoYW5kbGVyJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRTZXJ2aWNlLnVucmVnaXN0ZXJDb21tZW50Q29udHJvbGxlcihwcm92aWRlcklkKTtcblx0XHR9XG5cdH1cblxuXHQkdXBkYXRlQ29tbWVudENvbnRyb2xsZXJGZWF0dXJlcyhoYW5kbGU6IG51bWJlciwgZmVhdHVyZXM6IENvbW1lbnRQcm92aWRlckZlYXR1cmVzKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbGxlcnMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHByb3ZpZGVyLnVwZGF0ZUZlYXR1cmVzKGZlYXR1cmVzKTtcblx0fVxuXG5cdCRjcmVhdGVDb21tZW50VGhyZWFkKGhhbmRsZTogbnVtYmVyLFxuXHRcdGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlcixcblx0XHR0aHJlYWRJZDogc3RyaW5nLFxuXHRcdHJlc291cmNlOiBVcmlDb21wb25lbnRzLFxuXHRcdHJhbmdlOiBJUmFuZ2UgfCBJQ2VsbFJhbmdlIHwgdW5kZWZpbmVkLFxuXHRcdGNvbW1lbnRzOiBsYW5ndWFnZXMuQ29tbWVudFtdLFxuXHRcdGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLFxuXHRcdGlzVGVtcGxhdGU6IGJvb2xlYW4sXG5cdFx0ZWRpdG9ySWQ/OiBzdHJpbmdcblx0KTogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fY29tbWVudENvbnRyb2xsZXJzLmdldChoYW5kbGUpO1xuXG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvdmlkZXIuY3JlYXRlQ29tbWVudFRocmVhZChleHRlbnNpb25JZC52YWx1ZSwgY29tbWVudFRocmVhZEhhbmRsZSwgdGhyZWFkSWQsIHJlc291cmNlLCByYW5nZSwgY29tbWVudHMsIGlzVGVtcGxhdGUsIGVkaXRvcklkKTtcblx0fVxuXG5cdCR1cGRhdGVDb21tZW50VGhyZWFkKGhhbmRsZTogbnVtYmVyLFxuXHRcdGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlcixcblx0XHR0aHJlYWRJZDogc3RyaW5nLFxuXHRcdHJlc291cmNlOiBVcmlDb21wb25lbnRzLFxuXHRcdGNoYW5nZXM6IENvbW1lbnRUaHJlYWRDaGFuZ2VzKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbGxlcnMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcm92aWRlci51cGRhdGVDb21tZW50VGhyZWFkKGNvbW1lbnRUaHJlYWRIYW5kbGUsIHRocmVhZElkLCByZXNvdXJjZSwgY2hhbmdlcyk7XG5cdH1cblxuXHQkZGVsZXRlQ29tbWVudFRocmVhZChoYW5kbGU6IG51bWJlciwgY29tbWVudFRocmVhZEhhbmRsZTogbnVtYmVyKSB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbGxlcnMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb3ZpZGVyLmRlbGV0ZUNvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZEhhbmRsZSk7XG5cdH1cblxuXHQkdXBkYXRlQ29tbWVudGluZ1JhbmdlcyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2VIaW50cz86IGxhbmd1YWdlcy5Db21tZW50aW5nUmFuZ2VSZXNvdXJjZUhpbnQpIHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX2NvbW1lbnRDb250cm9sbGVycy5nZXQoaGFuZGxlKTtcblxuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRwcm92aWRlci51cGRhdGVDb21tZW50aW5nUmFuZ2VzKHJlc291cmNlSGludHMpO1xuXHR9XG5cblx0YXN5bmMgJHJldmVhbENvbW1lbnRUaHJlYWQoaGFuZGxlOiBudW1iZXIsIGNvbW1lbnRUaHJlYWRIYW5kbGU6IG51bWJlciwgY29tbWVudFVuaXF1ZUlkSW5UaHJlYWQ6IG51bWJlciwgb3B0aW9uczogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWRSZXZlYWxPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbGxlcnMuZ2V0KGhhbmRsZSk7XG5cblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGhyZWFkID0gcHJvdmlkZXIuZ2V0QWxsQ29tbWVudHMoKS5maW5kKHRocmVhZCA9PiB0aHJlYWQuY29tbWVudFRocmVhZEhhbmRsZSA9PT0gY29tbWVudFRocmVhZEhhbmRsZSk7XG5cdFx0aWYgKCF0aHJlYWQgfHwgIXRocmVhZC5pc0RvY3VtZW50Q29tbWVudFRocmVhZCgpKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWVudCA9IHRocmVhZC5jb21tZW50cz8uZmluZChjb21tZW50ID0+IGNvbW1lbnQudW5pcXVlSWRJblRocmVhZCA9PT0gY29tbWVudFVuaXF1ZUlkSW5UaHJlYWQpO1xuXG5cdFx0cmV2ZWFsQ29tbWVudFRocmVhZCh0aGlzLl9jb21tZW50U2VydmljZSwgdGhpcy5fZWRpdG9yU2VydmljZSwgdGhpcy5fdXJpSWRlbnRpdHlTZXJ2aWNlLCB0aHJlYWQsIGNvbW1lbnQsIG9wdGlvbnMuZm9jdXNSZXBseSwgdW5kZWZpbmVkLCBvcHRpb25zLnByZXNlcnZlRm9jdXMpO1xuXHR9XG5cblx0YXN5bmMgJGhpZGVDb21tZW50VGhyZWFkKGhhbmRsZTogbnVtYmVyLCBjb21tZW50VGhyZWFkSGFuZGxlOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX2NvbW1lbnRDb250cm9sbGVycy5nZXQoaGFuZGxlKTtcblxuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRjb25zdCB0aHJlYWQgPSBwcm92aWRlci5nZXRBbGxDb21tZW50cygpLmZpbmQodGhyZWFkID0+IHRocmVhZC5jb21tZW50VGhyZWFkSGFuZGxlID09PSBjb21tZW50VGhyZWFkSGFuZGxlKTtcblx0XHRpZiAoIXRocmVhZCB8fCAhdGhyZWFkLmlzRG9jdW1lbnRDb21tZW50VGhyZWFkKCkpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHR0aHJlYWQuY29sbGFwc2libGVTdGF0ZSA9IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZS5Db2xsYXBzZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlldygpIHtcblx0XHRjb25zdCBjb21tZW50c1BhbmVsQWxyZWFkeUNvbnN0cnVjdGVkID0gISF0aGlzLl92aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0Rlc2NyaXB0b3JCeUlkKENPTU1FTlRTX1ZJRVdfSUQpO1xuXHRcdGlmICghY29tbWVudHNQYW5lbEFscmVhZHlDb25zdHJ1Y3RlZCkge1xuXHRcdFx0Y29uc3QgVklFV19DT05UQUlORVI6IFZpZXdDb250YWluZXIgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHtcblx0XHRcdFx0aWQ6IENPTU1FTlRTX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiBDT01NRU5UU19WSUVXX1RJVExFLFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFZpZXdQYW5lQ29udGFpbmVyLCBbQ09NTUVOVFNfVklFV19JRCwgeyBtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUgfV0pLFxuXHRcdFx0XHRzdG9yYWdlSWQ6IENPTU1FTlRTX1ZJRVdfU1RPUkFHRV9JRCxcblx0XHRcdFx0aGlkZUlmRW1wdHk6IHRydWUsXG5cdFx0XHRcdGljb246IGNvbW1lbnRzVmlld0ljb24sXG5cdFx0XHRcdG9yZGVyOiAxMCxcblx0XHRcdH0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCk7XG5cblx0XHRcdFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3RXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKFt7XG5cdFx0XHRcdGlkOiBDT01NRU5UU19WSUVXX0lELFxuXHRcdFx0XHRuYW1lOiBDT01NRU5UU19WSUVXX1RJVExFLFxuXHRcdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiBmYWxzZSxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihDb21tZW50c1BhbmVsKSxcblx0XHRcdFx0Y2FuTW92ZVZpZXc6IHRydWUsXG5cdFx0XHRcdGNvbnRhaW5lckljb246IGNvbW1lbnRzVmlld0ljb24sXG5cdFx0XHRcdGZvY3VzQ29tbWFuZDoge1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5mb2N1c0NvbW1lbnRzUGFuZWwnXG5cdFx0XHRcdH1cblx0XHRcdH1dLCBWSUVXX0NPTlRBSU5FUik7XG5cdFx0fVxuXHRcdHRoaXMucmVnaXN0ZXJWaWV3TGlzdGVuZXJzKGNvbW1lbnRzUGFuZWxBbHJlYWR5Q29uc3RydWN0ZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRDb21tZW50cygpIHtcblx0XHRbLi4udGhpcy5fY29tbWVudENvbnRyb2xsZXJzLmtleXMoKV0uZm9yRWFjaChoYW5kbGUgPT4ge1xuXHRcdFx0Y29uc3QgdGhyZWFkcyA9IHRoaXMuX2NvbW1lbnRDb250cm9sbGVycy5nZXQoaGFuZGxlKSEuZ2V0QWxsQ29tbWVudHMoKTtcblxuXHRcdFx0aWYgKHRocmVhZHMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVySWQgPSB0aGlzLmdldEhhbmRsZXIoaGFuZGxlKTtcblx0XHRcdFx0dGhpcy5fY29tbWVudFNlcnZpY2Uuc2V0V29ya3NwYWNlQ29tbWVudHMocHJvdmlkZXJJZCwgdGhyZWFkcyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyVmlld09wZW5lZExpc3RlbmVyKCkge1xuXHRcdGlmICghdGhpcy5fb3BlblZpZXdMaXN0ZW5lci52YWx1ZSkge1xuXHRcdFx0dGhpcy5fb3BlblZpZXdMaXN0ZW5lci52YWx1ZSA9IHRoaXMuX3ZpZXdzU2VydmljZS5vbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5KGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5pZCA9PT0gQ09NTUVOVFNfVklFV19JRCAmJiBlLnZpc2libGUpIHtcblx0XHRcdFx0XHR0aGlzLnNldENvbW1lbnRzKCk7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX29wZW5WaWV3TGlzdGVuZXIpIHtcblx0XHRcdFx0XHRcdHRoaXMuX29wZW5WaWV3TGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIElmIHRoZSBjb21tZW50cyB2aWV3IGhhcyBuZXZlciBiZWVuIG9wZW5lZCwgdGhlIGNvbnN0cnVjdG9yIGZvciBpdCBoYXMgbm90IHlldCBydW4gc28gaXQgaGFzXG5cdCAqIG5vIGxpc3RlbmVycyBmb3IgY29tbWVudCB0aHJlYWRzIGJlaW5nIHNldCBvciB1cGRhdGVkLiBMaXN0ZW4gZm9yIHRoZSB2aWV3IG9wZW5pbmcgZm9yIHRoZVxuXHQgKiBmaXJzdCB0aW1lIGFuZCBzZW5kIGl0IGNvbW1lbnRzIHRoZW4uXG5cdCAqL1xuXHRwcml2YXRlIHJlZ2lzdGVyVmlld0xpc3RlbmVycyhjb21tZW50c1BhbmVsQWxyZWFkeUNvbnN0cnVjdGVkOiBib29sZWFuKSB7XG5cdFx0aWYgKCFjb21tZW50c1BhbmVsQWxyZWFkeUNvbnN0cnVjdGVkKSB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyVmlld09wZW5lZExpc3RlbmVyKCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9vbkNoYW5nZUNvbnRhaW5lckxpc3RlbmVyLnZhbHVlKSB7XG5cdFx0XHR0aGlzLl9vbkNoYW5nZUNvbnRhaW5lckxpc3RlbmVyLnZhbHVlID0gdGhpcy5fdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGFpbmVyKGUgPT4ge1xuXHRcdFx0XHRpZiAoZS52aWV3cy5maW5kKHZpZXcgPT4gdmlldy5pZCA9PT0gQ09NTUVOVFNfVklFV19JRCkpIHtcblx0XHRcdFx0XHR0aGlzLnNldENvbW1lbnRzKCk7XG5cdFx0XHRcdFx0dGhpcy5yZWdpc3RlclZpZXdPcGVuZWRMaXN0ZW5lcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuX29uQ2hhbmdlQ29udGFpbmVyTG9jYXRpb25MaXN0ZW5lci52YWx1ZSkge1xuXHRcdFx0dGhpcy5fb25DaGFuZ2VDb250YWluZXJMb2NhdGlvbkxpc3RlbmVyLnZhbHVlID0gdGhpcy5fdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGFpbmVyTG9jYXRpb24oZSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNvbW1lbnRzQ29udGFpbmVyID0gdGhpcy5fdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZChDT01NRU5UU19WSUVXX0lEKTtcblx0XHRcdFx0aWYgKGUudmlld0NvbnRhaW5lci5pZCA9PT0gY29tbWVudHNDb250YWluZXI/LmlkKSB7XG5cdFx0XHRcdFx0dGhpcy5zZXRDb21tZW50cygpO1xuXHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJWaWV3T3BlbmVkTGlzdGVuZXIoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRIYW5kbGVyKGhhbmRsZTogbnVtYmVyKSB7XG5cdFx0aWYgKCF0aGlzLl9oYW5kbGVycy5oYXMoaGFuZGxlKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIGhhbmRsZXInKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2hhbmRsZXJzLmdldChoYW5kbGUpITtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsWUFBWSxlQUFlLGlCQUE4Qix5QkFBeUI7QUFDM0YsU0FBUyxXQUEwQjtBQUNuQyxTQUFpQixhQUFhO0FBQzlCLFlBQVksZUFBZTtBQUUzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDRCQUE2QztBQUN0RCxTQUE2Qix1QkFBdUI7QUFDcEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBd0QsZ0JBQWdCLG1CQUFrRTtBQUMxSSxTQUFTLGtCQUFrQiwwQkFBMEIsMkJBQTJCO0FBQ2hGLFNBQWlELGNBQWMsZ0JBQWdCLHVCQUF1Qyw4QkFBOEI7QUFDcEosU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHFCQUFxQjtBQUU5QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUU3QixNQUFNLHdCQUFpRTtBQUFBLEVBK0k3RSxZQUNRLHFCQUNBLGtCQUNBLGFBQ0EsVUFDQSxVQUNDLFFBQ1IsVUFDUSxXQUNBLGFBQ0QsVUFDTjtBQVZNO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQztBQUVBO0FBQ0E7QUFDRDtBQTlJUixTQUFpQixvQkFBb0IsSUFBSSxRQUE0QztBQXdCckYsU0FBaUIsb0JBQW9CLElBQUksUUFBNEI7QUFDckUsU0FBUyxtQkFBOEMsS0FBSyxrQkFBa0I7QUFhOUUsU0FBaUIsdUJBQXVCLElBQUksUUFBa0Q7QUFXOUYsU0FBaUIsdUJBQXVCLElBQUksUUFBaUI7QUFXN0QsU0FBUSxvQkFBeUUsVUFBVSw4QkFBOEI7QUEwQnpILFNBQWlCLCtCQUErQixJQUFJLFFBQTZEO0FBQ2pILFNBQU8sOEJBQThCLEtBQUssNkJBQTZCO0FBQ3ZFLFNBQWlCLHNDQUFzQyxJQUFJLFFBQTZEO0FBQ3hILFNBQU8scUNBQXFDLEtBQUssb0NBQW9DO0FBaUNyRixTQUFpQiw0QkFBNEIsSUFBSSxRQUEwRDtBQUMzRyxTQUFTLDJCQUFvRixLQUFLLDBCQUEwQjtBQU01SCxTQUFpQixvQkFBb0IsSUFBSSxRQUFrRDtBQUMzRixTQUFPLG1CQUFtQixLQUFLLGtCQUFrQjtBQWNoRCxTQUFLLGNBQWM7QUFDbkIsUUFBSSxhQUFhO0FBQ2hCLFdBQUssV0FBVyxDQUFDO0FBQUEsSUFDbEIsV0FBVyxVQUFVO0FBQ3BCLFdBQUssWUFBWTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUFBLEVBL0pBLElBQUksUUFBNEM7QUFDL0MsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxNQUFNLE9BQTJDO0FBQ3BELFNBQUssU0FBUztBQUNkLFNBQUssa0JBQWtCLEtBQUssS0FBSztBQUFBLEVBQ2xDO0FBQUEsRUFHQSxJQUFJLG1CQUE4RDtBQUFFLFdBQU8sS0FBSyxrQkFBa0I7QUFBQSxFQUFPO0FBQUEsRUFJekcsSUFBSSxRQUE0QjtBQUMvQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLE1BQU0sT0FBMkI7QUFDcEMsU0FBSyxTQUFTO0FBQ2QsU0FBSyxrQkFBa0IsS0FBSyxLQUFLLE1BQU07QUFBQSxFQUN4QztBQUFBLEVBSUEsSUFBSSxlQUFtQztBQUN0QyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLGFBQWEsU0FBNkI7QUFDN0MsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUFBLEVBT0EsSUFBVyxXQUF5RDtBQUNuRSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFXLFNBQVMsYUFBMkQ7QUFDOUUsU0FBSyxZQUFZO0FBQ2pCLFNBQUsscUJBQXFCLEtBQUssS0FBSyxTQUFTO0FBQUEsRUFDOUM7QUFBQSxFQUdBLElBQUksc0JBQXVFO0FBQUUsV0FBTyxLQUFLLHFCQUFxQjtBQUFBLEVBQU87QUFBQSxFQUVySCxJQUFJLE1BQU0sT0FBc0I7QUFDL0IsU0FBSyxTQUFTO0FBQUEsRUFDZjtBQUFBLEVBRUEsSUFBSSxRQUF1QjtBQUMxQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFHQSxJQUFJLHNCQUFzQztBQUFFLFdBQU8sS0FBSyxxQkFBcUI7QUFBQSxFQUFPO0FBQUEsRUFDcEYsSUFBSSxTQUFTLE9BQWdCO0FBQzVCLFNBQUssWUFBWTtBQUNqQixTQUFLLHFCQUFxQixLQUFLLEtBQUssU0FBUztBQUFBLEVBQzlDO0FBQUEsRUFFQSxJQUFJLFdBQVc7QUFDZCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFHQSxJQUFJLG1CQUFtQjtBQUN0QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLGlCQUFpQixVQUErRDtBQUNuRixRQUFJLEtBQUssNEJBQTRCLFFBQVc7QUFDL0MsV0FBSywwQkFBMEI7QUFBQSxJQUNoQztBQUVBLFFBQUksYUFBYSxLQUFLLG1CQUFtQjtBQUN4QyxXQUFLLG9CQUFvQjtBQUN6QixXQUFLLDZCQUE2QixLQUFLLEtBQUssaUJBQWlCO0FBQUEsSUFDOUQ7QUFBQSxFQUNEO0FBQUEsRUFHQSxJQUFJLDBCQUEwQjtBQUM3QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFZLHdCQUF3Qix5QkFBOEU7QUFDakgsU0FBSywyQkFBMkI7QUFDaEMsU0FBSyxvQ0FBb0MsS0FBSyx1QkFBdUI7QUFBQSxFQUN0RTtBQUFBLEVBU0EsSUFBSSxhQUFzQjtBQUN6QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSwwQkFBbUU7QUFDbEUsV0FBTyxLQUFLLFdBQVcsVUFBYSxNQUFNLFNBQVMsS0FBSyxNQUFNO0FBQUEsRUFDL0Q7QUFBQSxFQUdBLElBQUksUUFBUTtBQUNYLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksTUFBTSxVQUFvRDtBQUM3RCxTQUFLLFNBQVM7QUFDZCxTQUFLLGtCQUFrQixLQUFLLEtBQUssTUFBTTtBQUFBLEVBQ3hDO0FBQUEsRUFJQSxJQUFJLGdCQUFrRTtBQUNyRSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLGNBQWMsT0FBeUQ7QUFDMUUsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSywwQkFBMEIsS0FBSyxLQUFLO0FBQUEsRUFDMUM7QUFBQSxFQUtBLElBQVcsYUFBc0I7QUFDaEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBeUJBLFlBQVksU0FBa0M7QUFDN0MsVUFBTSxXQUFXLENBQUMsVUFDakIsT0FBTyxVQUFVLGVBQWUsS0FBSyxTQUFTLEtBQUs7QUFFcEQsUUFBSSxTQUFTLE9BQU8sR0FBRztBQUFFLFdBQUssU0FBUyxRQUFRO0FBQUEsSUFBUTtBQUN2RCxRQUFJLFNBQVMsT0FBTyxHQUFHO0FBQUUsV0FBSyxTQUFTLFFBQVE7QUFBQSxJQUFPO0FBQ3RELFFBQUksU0FBUyxjQUFjLEdBQUc7QUFBRSxXQUFLLGdCQUFnQixRQUFRLGlCQUFpQixPQUFPLFNBQVksUUFBUTtBQUFBLElBQWM7QUFDdkgsUUFBSSxTQUFTLFVBQVUsR0FBRztBQUFFLFdBQUssV0FBVyxRQUFRO0FBQUEsSUFBVTtBQUM5RCxRQUFJLFNBQVMsZUFBZSxHQUFHO0FBQUUsV0FBSyxtQkFBbUIsUUFBUTtBQUFBLElBQWU7QUFDaEYsUUFBSSxTQUFTLFVBQVUsR0FBRztBQUFFLFdBQUssV0FBVyxRQUFRO0FBQUEsSUFBVztBQUMvRCxRQUFJLFNBQVMsT0FBTyxHQUFHO0FBQUUsV0FBSyxRQUFRLFFBQVE7QUFBQSxJQUFRO0FBQ3RELFFBQUksU0FBUyxlQUFlLEdBQUc7QUFBRSxXQUFLLGdCQUFnQixRQUFRO0FBQUEsSUFBZ0I7QUFDOUUsUUFBSSxTQUFTLFlBQVksR0FBRztBQUFFLFdBQUssY0FBYyxRQUFRO0FBQUEsSUFBYTtBQUFBLEVBQ3ZFO0FBQUEsRUFFQSxjQUF1QjtBQUN0QixXQUFPLENBQUMsQ0FBQyxLQUFLLFlBQVksS0FBSyxTQUFTLFNBQVM7QUFBQSxFQUNsRDtBQUFBLEVBRUEsVUFBVTtBQUNULFNBQUssY0FBYztBQUNuQixTQUFLLDZCQUE2QixRQUFRO0FBQzFDLFNBQUsscUJBQXFCLFFBQVE7QUFDbEMsU0FBSyxrQkFBa0IsUUFBUTtBQUMvQixTQUFLLGtCQUFrQixRQUFRO0FBQy9CLFNBQUssa0JBQWtCLFFBQVE7QUFBQSxFQUNoQztBQUFBLEVBRUEsU0FBa0M7QUFDakMsV0FBTztBQUFBLE1BQ04sTUFBTSxhQUFhO0FBQUEsTUFDbkIsc0JBQXNCLEtBQUs7QUFBQSxNQUMzQixxQkFBcUIsS0FBSztBQUFBLElBQzNCO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSw0QkFBNEI7QUFBQSxFQUVqQyxZQUE0QixRQUFzRDtBQUF0RDtBQUQ1QixTQUFnQixrQkFBbUMsSUFBSSxnQkFBZ0I7QUFBQSxFQUNhO0FBQUEsRUFDcEYsVUFBVTtBQUNULFNBQUssZ0JBQWdCLFFBQVE7QUFBQSxFQUM5QjtBQUNEO0FBRU8sTUFBTSw0QkFBMEQ7QUFBQSxFQThDdEUsWUFDa0IsUUFDQSxpQkFDQSxTQUNBLFdBQ0EsS0FDQSxRQUNULFdBQ1A7QUFQZ0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1Q7QUFsQlQsU0FBaUIsV0FBK0QsSUFBSSxjQUFtRDtBQUFBLEVBbUJuSTtBQUFBLEVBckRKLElBQUksU0FBaUI7QUFDcEIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxLQUFhO0FBQ2hCLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksZUFBdUI7QUFDMUIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxRQUE4QjtBQUNqQyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFFBQWdCO0FBQ25CLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUlBLElBQUksWUFBWTtBQUNmLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLElBQUksVUFBVSxXQUFvRDtBQUNqRSxTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRUEsSUFBSSxVQUFVO0FBQ2IsV0FBTyxLQUFLLFVBQVU7QUFBQSxFQUN2QjtBQUFBLEVBS0EsSUFBSSxXQUFvQztBQUN2QyxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxJQUFJLFFBQVE7QUFDWCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFZQSxJQUFJLGdCQUFnQjtBQUNuQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFHQSxNQUFNLDBCQUEwQixhQUEyRjtBQUMxSCxTQUFLLGlCQUFpQjtBQUN0QixXQUFPLEtBQUssT0FBTyxrQkFBa0IsS0FBSyxTQUFTLGNBQWMsRUFBRSxxQkFBcUIsWUFBWSxPQUFPLHFCQUFxQixrQkFBa0IsWUFBWSxTQUFTLGlCQUFpQixJQUFJLE1BQVM7QUFBQSxFQUN0TTtBQUFBLEVBRUEsZUFBZSxVQUFtQztBQUNqRCxTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUFBLEVBRUEsb0JBQW9CLGFBQ25CLHFCQUNBLFVBQ0EsVUFDQSxPQUNBLFVBQ0EsWUFDQSxVQUMrQztBQUMvQyxVQUFNLFNBQVMsSUFBSTtBQUFBLE1BQ2xCO0FBQUEsTUFDQSxLQUFLO0FBQUEsTUFDTDtBQUFBLE1BQ0E7QUFBQSxNQUNBLElBQUksT0FBTyxRQUFRLEVBQUUsU0FBUztBQUFBLE1BQzlCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxVQUFNLHVCQUF1QixJQUFJLDRCQUE0QixNQUFNO0FBQ25FLFNBQUssU0FBUyxJQUFJLHFCQUFxQixvQkFBb0I7QUFDM0QseUJBQXFCLGdCQUFnQixJQUFJLE9BQU8sNEJBQTRCLE1BQU07QUFDakYsV0FBSyxNQUFNLHFCQUFxQixLQUFLLFFBQVEsT0FBTyxxQkFBcUIsRUFBRSxlQUFlLE9BQU8saUJBQWlCLENBQUM7QUFBQSxJQUNwSCxDQUFDLENBQUM7QUFHRixRQUFJLE9BQU8sd0JBQXdCLEdBQUc7QUFDckMsV0FBSyxnQkFBZ0IsZUFBZSxLQUFLLFdBQVc7QUFBQSxRQUNuRCxPQUFPLENBQUMsTUFBTTtBQUFBLFFBQ2QsU0FBUyxDQUFDO0FBQUEsUUFDVixTQUFTLENBQUM7QUFBQSxRQUNWLFNBQVMsQ0FBQztBQUFBLE1BQ1gsQ0FBQztBQUFBLElBQ0YsT0FBTztBQUNOLFdBQUssZ0JBQWdCLHVCQUF1QixLQUFLLFdBQVc7QUFBQSxRQUMzRCxPQUFPLENBQUMsTUFBNkM7QUFBQSxRQUNyRCxTQUFTLENBQUM7QUFBQSxRQUNWLFNBQVMsQ0FBQztBQUFBLFFBQ1YsU0FBUyxDQUFDO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDRjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxvQkFBb0IscUJBQ25CLFVBQ0EsVUFDQSxTQUFxQztBQUNyQyxVQUFNLFNBQVMsS0FBSyxlQUFlLG1CQUFtQjtBQUN0RCxXQUFPLFlBQVksT0FBTztBQUUxQixRQUFJLE9BQU8sd0JBQXdCLEdBQUc7QUFDckMsV0FBSyxnQkFBZ0IsZUFBZSxLQUFLLFdBQVc7QUFBQSxRQUNuRCxPQUFPLENBQUM7QUFBQSxRQUNSLFNBQVMsQ0FBQztBQUFBLFFBQ1YsU0FBUyxDQUFDLE1BQU07QUFBQSxRQUNoQixTQUFTLENBQUM7QUFBQSxNQUNYLENBQUM7QUFBQSxJQUNGLE9BQU87QUFDTixXQUFLLGdCQUFnQix1QkFBdUIsS0FBSyxXQUFXO0FBQUEsUUFDM0QsT0FBTyxDQUFDO0FBQUEsUUFDUixTQUFTLENBQUM7QUFBQSxRQUNWLFNBQVMsQ0FBQyxNQUE2QztBQUFBLFFBQ3ZELFNBQVMsQ0FBQztBQUFBLE1BQ1gsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUVEO0FBQUEsRUFFQSxvQkFBb0IscUJBQTZCO0FBQ2hELFVBQU0sU0FBUyxLQUFLLGVBQWUsbUJBQW1CO0FBQ3RELFNBQUssU0FBUyxpQkFBaUIsbUJBQW1CO0FBQ2xELFdBQU8sUUFBUTtBQUVmLFFBQUksT0FBTyx3QkFBd0IsR0FBRztBQUNyQyxXQUFLLGdCQUFnQixlQUFlLEtBQUssV0FBVztBQUFBLFFBQ25ELE9BQU8sQ0FBQztBQUFBLFFBQ1IsU0FBUyxDQUFDLE1BQU07QUFBQSxRQUNoQixTQUFTLENBQUM7QUFBQSxRQUNWLFNBQVMsQ0FBQztBQUFBLE1BQ1gsQ0FBQztBQUFBLElBQ0YsT0FBTztBQUNOLFdBQUssZ0JBQWdCLHVCQUF1QixLQUFLLFdBQVc7QUFBQSxRQUMzRCxPQUFPLENBQUM7QUFBQSxRQUNSLFNBQVMsQ0FBQyxNQUE2QztBQUFBLFFBQ3ZELFNBQVMsQ0FBQztBQUFBLFFBQ1YsU0FBUyxDQUFDO0FBQUEsTUFDWCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQSxFQUVBLHdCQUF3QixpQkFBeUI7QUFDaEQsZUFBVyxFQUFFLE9BQU8sS0FBSyxLQUFLLFNBQVMsT0FBTyxHQUFHO0FBQ2hELFVBQUksT0FBTyxhQUFhLGlCQUFpQjtBQUN4QyxhQUFLLE9BQU8scUJBQXFCLEtBQUssU0FBUyxPQUFPLG1CQUFtQjtBQUFBLE1BQzFFO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLFlBQVksT0FBZTtBQUMxQixVQUFNLFNBQVMsS0FBSztBQUVwQixRQUFJLFVBQVUsT0FBTyxPQUFPO0FBQzNCLFlBQU0sZUFBZSxPQUFPO0FBQzVCLG1CQUFhLFFBQVE7QUFDckIsYUFBTyxRQUFRO0FBQUEsSUFDaEI7QUFBQSxFQUNEO0FBQUEsRUFFQSx1QkFBdUIsZUFBdUQ7QUFDN0UsU0FBSyxnQkFBZ0IsdUJBQXVCLEtBQUssV0FBVyxhQUFhO0FBQUEsRUFDMUU7QUFBQSxFQUVRLGVBQWUscUJBQTJFO0FBQ2pHLFVBQU0sU0FBUyxLQUFLLFNBQVMsSUFBSSxtQkFBbUI7QUFDcEQsUUFBSSxDQUFDLFFBQVE7QUFDWixZQUFNLElBQUksTUFBTSxnQkFBZ0I7QUFBQSxJQUNqQztBQUNBLFdBQU8sT0FBTztBQUFBLEVBQ2Y7QUFBQSxFQUVBLE1BQU0sb0JBQW9CLFVBQWUsT0FBMEI7QUFDbEUsUUFBSSxTQUFTLFdBQVcsUUFBUSxvQkFBb0I7QUFDbkQsYUFBTztBQUFBLFFBQ04sYUFBYSxLQUFLO0FBQUEsUUFDbEIsT0FBTyxLQUFLO0FBQUEsUUFDWixTQUFTLENBQUM7QUFBQSxRQUNWLGtCQUFrQjtBQUFBLFVBQ2pCO0FBQUEsVUFDQSxRQUFRLENBQUM7QUFBQSxVQUNULGNBQWM7QUFBQSxRQUNmO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLE1BQXlDLENBQUM7QUFDaEQsZUFBVyxVQUFVLENBQUMsR0FBRyxLQUFLLFNBQVMsS0FBSyxDQUFDLEdBQUc7QUFDL0MsWUFBTSxnQkFBZ0IsS0FBSyxTQUFTLElBQUksTUFBTTtBQUM5QyxVQUFJLGNBQWMsT0FBTyxhQUFhLFNBQVMsU0FBUyxHQUFHO0FBQzFELFlBQUksY0FBYyxPQUFPLHdCQUF3QixHQUFHO0FBQ25ELGNBQUksS0FBSyxjQUFjLE1BQU07QUFBQSxRQUM5QjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsVUFBTSxtQkFBbUIsTUFBTSxLQUFLLE9BQU8seUJBQXlCLEtBQUssUUFBUSxVQUFVLEtBQUs7QUFFaEcsV0FBTztBQUFBLE1BQ04sYUFBYSxLQUFLO0FBQUEsTUFDbEIsT0FBTyxLQUFLO0FBQUEsTUFDWixTQUFTO0FBQUEsTUFDVCxrQkFBa0I7QUFBQSxRQUNqQjtBQUFBLFFBQ0EsUUFBUSxrQkFBa0IsVUFBVSxDQUFDO0FBQUEsUUFDckMsY0FBYyxDQUFDLENBQUMsa0JBQWtCO0FBQUEsTUFDbkM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxvQkFBb0IsVUFBZSxPQUEwQjtBQUNsRSxRQUFJLFNBQVMsV0FBVyxRQUFRLG9CQUFvQjtBQUNuRCxhQUFPO0FBQUEsUUFDTixhQUFhLEtBQUs7QUFBQSxRQUNsQixPQUFPLEtBQUs7QUFBQSxRQUNaLFNBQVMsQ0FBQztBQUFBLE1BQ1g7QUFBQSxJQUNEO0FBRUEsVUFBTSxNQUE2QyxDQUFDO0FBQ3BELGVBQVcsVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTLEtBQUssQ0FBQyxHQUFHO0FBQy9DLFlBQU0sZ0JBQWdCLEtBQUssU0FBUyxJQUFJLE1BQU07QUFDOUMsVUFBSSxjQUFjLE9BQU8sYUFBYSxTQUFTLFNBQVMsR0FBRztBQUMxRCxZQUFJLENBQUMsY0FBYyxPQUFPLHdCQUF3QixHQUFHO0FBQ3BELGNBQUksS0FBSyxjQUFjLE1BQTZDO0FBQUEsUUFDckU7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxNQUNOLGFBQWEsS0FBSztBQUFBLE1BQ2xCLE9BQU8sS0FBSztBQUFBLE1BQ1osU0FBUztBQUFBLElBQ1Y7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLGVBQWUsS0FBVSxRQUFpQyxTQUE0QixVQUFxQyxPQUF5QztBQUN6SyxXQUFPLEtBQUssT0FBTyxnQkFBZ0IsS0FBSyxTQUFTLE9BQU8scUJBQXFCLEtBQUssU0FBUyxRQUFRO0FBQUEsRUFDcEc7QUFBQSxFQUVBLGlCQUFpRTtBQUNoRSxVQUFNLE1BQXNELENBQUM7QUFDN0QsZUFBVyxVQUFVLENBQUMsR0FBRyxLQUFLLFNBQVMsS0FBSyxDQUFDLEdBQUc7QUFDL0MsVUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLE1BQU0sRUFBRyxNQUFNO0FBQUEsSUFDM0M7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsNEJBQTRCLFVBQXlCLE9BQTJCLFVBQWtDO0FBQ2pILFdBQU8sS0FBSyxPQUFPLDZCQUE2QixLQUFLLFFBQVEsVUFBVSxPQUFPLFFBQVE7QUFBQSxFQUN2RjtBQUFBLEVBRUEsTUFBTSw0QkFBNEIsY0FBc0IsT0FBZTtBQUN0RSxVQUFNLEtBQUssT0FBTyw2QkFBNkIsS0FBSyxRQUFRLGNBQWMsS0FBSztBQUFBLEVBQ2hGO0FBQUEsRUFFQSxTQUFjO0FBQ2IsV0FBTztBQUFBLE1BQ04sTUFBTSxhQUFhO0FBQUEsTUFDbkIsUUFBUSxLQUFLO0FBQUEsSUFDZDtBQUFBLEVBQ0Q7QUFDRDtBQUdBLE1BQU0sbUJBQW1CLGFBQWEsc0JBQXNCLFFBQVEsbUJBQW1CLFNBQVMsb0JBQW9CLGlDQUFpQyxDQUFDO0FBRy9JLElBQU0scUJBQU4sY0FBaUMsV0FBOEM7QUFBQSxFQWFyRixZQUNDLGdCQUNrQyxpQkFDRixlQUNTLHdCQUNILHFCQUNMLGdCQUNoQztBQUNELFVBQU07QUFONEI7QUFDRjtBQUNTO0FBQ0g7QUFDTDtBQWhCbEMsU0FBUSxZQUFZLG9CQUFJLElBQW9CO0FBQzVDLFNBQVEsc0JBQXNCLG9CQUFJLElBQXlDO0FBRzNFLFNBQWlCLHlDQUF5QyxLQUFLLFVBQVUsSUFBSSxnQkFBZ0IsQ0FBQztBQUU5RixTQUFpQixvQkFBb0QsS0FBSyxVQUFVLElBQUksa0JBQWtCLENBQUM7QUFDM0csU0FBaUIsNkJBQTZELEtBQUssVUFBVSxJQUFJLGtCQUFrQixDQUFDO0FBQ3BILFNBQWlCLHFDQUFxRSxLQUFLLFVBQVUsSUFBSSxrQkFBa0IsQ0FBQztBQVczSCxTQUFLLFNBQVMsZUFBZSxTQUFTLGVBQWUsZUFBZTtBQUNwRSxTQUFLLGdCQUFnQiw0QkFBNEI7QUFFakQsU0FBSyxVQUFVLEtBQUssZ0JBQWdCLHNDQUFzQyxPQUFNLFdBQVU7QUFDekYsWUFBTSxTQUFVLE9BQXdEO0FBQ3hFLFlBQU0sYUFBYSxLQUFLLG9CQUFvQixJQUFJLE1BQU07QUFFdEQsVUFBSSxDQUFDLFlBQVk7QUFDaEI7QUFBQSxNQUNEO0FBRUEsV0FBSyx1Q0FBdUMsTUFBTTtBQUNsRCxXQUFLLDhCQUE4QjtBQUNuQyxpQkFBVyw2QkFBNkIsS0FBSztBQUFBLElBQzlDLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLDJCQUEyQixRQUFnQixJQUFZLE9BQWUsYUFBMkI7QUFDaEcsVUFBTSxhQUFhLEdBQUcsRUFBRSxJQUFJLFdBQVc7QUFDdkMsU0FBSyxVQUFVLElBQUksUUFBUSxVQUFVO0FBRXJDLFVBQU0sV0FBVyxJQUFJLDRCQUE0QixLQUFLLFFBQVEsS0FBSyxpQkFBaUIsUUFBUSxZQUFZLElBQUksT0FBTyxDQUFDLENBQUM7QUFDckgsU0FBSyxnQkFBZ0IsMEJBQTBCLFlBQVksUUFBUTtBQUNuRSxTQUFLLG9CQUFvQixJQUFJLFFBQVEsUUFBUTtBQUU3QyxTQUFLLFVBQVUsS0FBSyxnQkFBZ0IsOEJBQThCLE9BQUs7QUFDdEUsV0FBSyxhQUFhO0FBQUEsSUFDbkIsQ0FBQyxDQUFDO0FBRUYsU0FBSyxVQUFVLEtBQUssZ0JBQWdCLDBCQUEwQixPQUFLO0FBQ2xFLFdBQUssYUFBYTtBQUFBLElBQ25CLENBQUMsQ0FBQztBQUVGLFNBQUssZ0JBQWdCLHFCQUFxQixPQUFPLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFBQSxFQUM3RDtBQUFBLEVBRUEsNkJBQTZCLFFBQXNCO0FBQ2xELFVBQU0sYUFBYSxLQUFLLFVBQVUsSUFBSSxNQUFNO0FBQzVDLFNBQUssVUFBVSxPQUFPLE1BQU07QUFDNUIsU0FBSyxvQkFBb0IsT0FBTyxNQUFNO0FBRXRDLFFBQUksT0FBTyxlQUFlLFVBQVU7QUFDbkM7QUFBQSxJQUVELE9BQU87QUFDTixXQUFLLGdCQUFnQiw0QkFBNEIsVUFBVTtBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUFBLEVBRUEsaUNBQWlDLFFBQWdCLFVBQXlDO0FBQ3pGLFVBQU0sV0FBVyxLQUFLLG9CQUFvQixJQUFJLE1BQU07QUFFcEQsUUFBSSxDQUFDLFVBQVU7QUFDZCxhQUFPO0FBQUEsSUFDUjtBQUVBLGFBQVMsZUFBZSxRQUFRO0FBQUEsRUFDakM7QUFBQSxFQUVBLHFCQUFxQixRQUNwQixxQkFDQSxVQUNBLFVBQ0EsT0FDQSxVQUNBLGFBQ0EsWUFDQSxVQUMyRDtBQUMzRCxVQUFNLFdBQVcsS0FBSyxvQkFBb0IsSUFBSSxNQUFNO0FBRXBELFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLFNBQVMsb0JBQW9CLFlBQVksT0FBTyxxQkFBcUIsVUFBVSxVQUFVLE9BQU8sVUFBVSxZQUFZLFFBQVE7QUFBQSxFQUN0STtBQUFBLEVBRUEscUJBQXFCLFFBQ3BCLHFCQUNBLFVBQ0EsVUFDQSxTQUFxQztBQUNyQyxVQUFNLFdBQVcsS0FBSyxvQkFBb0IsSUFBSSxNQUFNO0FBRXBELFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLFNBQVMsb0JBQW9CLHFCQUFxQixVQUFVLFVBQVUsT0FBTztBQUFBLEVBQ3JGO0FBQUEsRUFFQSxxQkFBcUIsUUFBZ0IscUJBQTZCO0FBQ2pFLFVBQU0sV0FBVyxLQUFLLG9CQUFvQixJQUFJLE1BQU07QUFFcEQsUUFBSSxDQUFDLFVBQVU7QUFDZDtBQUFBLElBQ0Q7QUFFQSxXQUFPLFNBQVMsb0JBQW9CLG1CQUFtQjtBQUFBLEVBQ3hEO0FBQUEsRUFFQSx3QkFBd0IsUUFBZ0IsZUFBdUQ7QUFDOUYsVUFBTSxXQUFXLEtBQUssb0JBQW9CLElBQUksTUFBTTtBQUVwRCxRQUFJLENBQUMsVUFBVTtBQUNkO0FBQUEsSUFDRDtBQUVBLGFBQVMsdUJBQXVCLGFBQWE7QUFBQSxFQUM5QztBQUFBLEVBRUEsTUFBTSxxQkFBcUIsUUFBZ0IscUJBQTZCLHlCQUFpQyxTQUE4RDtBQUN0SyxVQUFNLFdBQVcsS0FBSyxvQkFBb0IsSUFBSSxNQUFNO0FBRXBELFFBQUksQ0FBQyxVQUFVO0FBQ2QsYUFBTyxRQUFRLFFBQVE7QUFBQSxJQUN4QjtBQUVBLFVBQU0sU0FBUyxTQUFTLGVBQWUsRUFBRSxLQUFLLENBQUFBLFlBQVVBLFFBQU8sd0JBQXdCLG1CQUFtQjtBQUMxRyxRQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sd0JBQXdCLEdBQUc7QUFDakQsYUFBTyxRQUFRLFFBQVE7QUFBQSxJQUN4QjtBQUVBLFVBQU0sVUFBVSxPQUFPLFVBQVUsS0FBSyxDQUFBQyxhQUFXQSxTQUFRLHFCQUFxQix1QkFBdUI7QUFFckcsd0JBQW9CLEtBQUssaUJBQWlCLEtBQUssZ0JBQWdCLEtBQUsscUJBQXFCLFFBQVEsU0FBUyxRQUFRLFlBQVksUUFBVyxRQUFRLGFBQWE7QUFBQSxFQUMvSjtBQUFBLEVBRUEsTUFBTSxtQkFBbUIsUUFBZ0IscUJBQTRDO0FBQ3BGLFVBQU0sV0FBVyxLQUFLLG9CQUFvQixJQUFJLE1BQU07QUFFcEQsUUFBSSxDQUFDLFVBQVU7QUFDZCxhQUFPLFFBQVEsUUFBUTtBQUFBLElBQ3hCO0FBRUEsVUFBTSxTQUFTLFNBQVMsZUFBZSxFQUFFLEtBQUssQ0FBQUQsWUFBVUEsUUFBTyx3QkFBd0IsbUJBQW1CO0FBQzFHLFFBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyx3QkFBd0IsR0FBRztBQUNqRCxhQUFPLFFBQVEsUUFBUTtBQUFBLElBQ3hCO0FBRUEsV0FBTyxtQkFBbUIsVUFBVSw4QkFBOEI7QUFBQSxFQUNuRTtBQUFBLEVBRVEsZUFBZTtBQUN0QixVQUFNLGtDQUFrQyxDQUFDLENBQUMsS0FBSyx1QkFBdUIsc0JBQXNCLGdCQUFnQjtBQUM1RyxRQUFJLENBQUMsaUNBQWlDO0FBQ3JDLFlBQU0saUJBQWdDLFNBQVMsR0FBNEIsZUFBZSxzQkFBc0IsRUFBRSxzQkFBc0I7QUFBQSxRQUN2SSxJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsUUFDUCxnQkFBZ0IsSUFBSSxlQUFlLG1CQUFtQixDQUFDLGtCQUFrQixFQUFFLHNDQUFzQyxLQUFLLENBQUMsQ0FBQztBQUFBLFFBQ3hILFdBQVc7QUFBQSxRQUNYLGFBQWE7QUFBQSxRQUNiLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxNQUNSLEdBQUcsc0JBQXNCLEtBQUs7QUFFOUIsZUFBUyxHQUFtQixlQUFlLGFBQWEsRUFBRSxjQUFjLENBQUM7QUFBQSxRQUN4RSxJQUFJO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixxQkFBcUI7QUFBQSxRQUNyQixnQkFBZ0IsSUFBSSxlQUFlLGFBQWE7QUFBQSxRQUNoRCxhQUFhO0FBQUEsUUFDYixlQUFlO0FBQUEsUUFDZixjQUFjO0FBQUEsVUFDYixJQUFJO0FBQUEsUUFDTDtBQUFBLE1BQ0QsQ0FBQyxHQUFHLGNBQWM7QUFBQSxJQUNuQjtBQUNBLFNBQUssc0JBQXNCLCtCQUErQjtBQUFBLEVBQzNEO0FBQUEsRUFFUSxjQUFjO0FBQ3JCLEtBQUMsR0FBRyxLQUFLLG9CQUFvQixLQUFLLENBQUMsRUFBRSxRQUFRLFlBQVU7QUFDdEQsWUFBTSxVQUFVLEtBQUssb0JBQW9CLElBQUksTUFBTSxFQUFHLGVBQWU7QUFFckUsVUFBSSxRQUFRLFFBQVE7QUFDbkIsY0FBTSxhQUFhLEtBQUssV0FBVyxNQUFNO0FBQ3pDLGFBQUssZ0JBQWdCLHFCQUFxQixZQUFZLE9BQU87QUFBQSxNQUM5RDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLDZCQUE2QjtBQUNwQyxRQUFJLENBQUMsS0FBSyxrQkFBa0IsT0FBTztBQUNsQyxXQUFLLGtCQUFrQixRQUFRLEtBQUssY0FBYywwQkFBMEIsT0FBSztBQUNoRixZQUFJLEVBQUUsT0FBTyxvQkFBb0IsRUFBRSxTQUFTO0FBQzNDLGVBQUssWUFBWTtBQUNqQixjQUFJLEtBQUssbUJBQW1CO0FBQzNCLGlCQUFLLGtCQUFrQixRQUFRO0FBQUEsVUFDaEM7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPUSxzQkFBc0IsaUNBQTBDO0FBQ3ZFLFFBQUksQ0FBQyxpQ0FBaUM7QUFDckMsV0FBSywyQkFBMkI7QUFBQSxJQUNqQztBQUVBLFFBQUksQ0FBQyxLQUFLLDJCQUEyQixPQUFPO0FBQzNDLFdBQUssMkJBQTJCLFFBQVEsS0FBSyx1QkFBdUIscUJBQXFCLE9BQUs7QUFDN0YsWUFBSSxFQUFFLE1BQU0sS0FBSyxVQUFRLEtBQUssT0FBTyxnQkFBZ0IsR0FBRztBQUN2RCxlQUFLLFlBQVk7QUFDakIsZUFBSywyQkFBMkI7QUFBQSxRQUNqQztBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFFQSxRQUFJLENBQUMsS0FBSyxtQ0FBbUMsT0FBTztBQUNuRCxXQUFLLG1DQUFtQyxRQUFRLEtBQUssdUJBQXVCLDZCQUE2QixPQUFLO0FBQzdHLGNBQU0sb0JBQW9CLEtBQUssdUJBQXVCLHlCQUF5QixnQkFBZ0I7QUFDL0YsWUFBSSxFQUFFLGNBQWMsT0FBTyxtQkFBbUIsSUFBSTtBQUNqRCxlQUFLLFlBQVk7QUFDakIsZUFBSywyQkFBMkI7QUFBQSxRQUNqQztBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUEsRUFFUSxXQUFXLFFBQWdCO0FBQ2xDLFFBQUksQ0FBQyxLQUFLLFVBQVUsSUFBSSxNQUFNLEdBQUc7QUFDaEMsWUFBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsSUFDbEM7QUFDQSxXQUFPLEtBQUssVUFBVSxJQUFJLE1BQU07QUFBQSxFQUNqQztBQUNEO0FBOVBhLHFCQUFOO0FBQUEsRUFETixxQkFBcUIsWUFBWSxrQkFBa0I7QUFBQSxFQWdCakQ7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FuQlU7IiwKICAibmFtZXMiOiBbInRocmVhZCIsICJjb21tZW50Il0KfQo=
