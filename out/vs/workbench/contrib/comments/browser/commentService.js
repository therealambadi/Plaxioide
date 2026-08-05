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
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Range } from "../../../../editor/common/core/range.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CommentMenus } from "./commentMenus.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { COMMENTS_SECTION } from "../common/commentsConfiguration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CommentsModel } from "./commentsModel.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { Schemas } from "../../../../base/common/network.js";
const ICommentService = createDecorator("commentService");
const CONTINUE_ON_COMMENTS = "comments.continueOnComments";
let CommentService = class extends Disposable {
  // schemes
  constructor(instantiationService, layoutService, configurationService, contextKeyService, storageService, logService, modelService) {
    super();
    this.instantiationService = instantiationService;
    this.layoutService = layoutService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this.logService = logService;
    this.modelService = modelService;
    this._onDidSetDataProvider = this._register(new Emitter());
    this.onDidSetDataProvider = this._onDidSetDataProvider.event;
    this._onDidDeleteDataProvider = this._register(new Emitter());
    this.onDidDeleteDataProvider = this._onDidDeleteDataProvider.event;
    this._onDidSetResourceCommentInfos = this._register(new Emitter());
    this.onDidSetResourceCommentInfos = this._onDidSetResourceCommentInfos.event;
    this._onDidSetAllCommentThreads = this._register(new Emitter());
    this.onDidSetAllCommentThreads = this._onDidSetAllCommentThreads.event;
    this._onDidUpdateCommentThreads = this._register(new Emitter());
    this.onDidUpdateCommentThreads = this._onDidUpdateCommentThreads.event;
    this._onDidUpdateNotebookCommentThreads = this._register(new Emitter());
    this.onDidUpdateNotebookCommentThreads = this._onDidUpdateNotebookCommentThreads.event;
    this._onDidUpdateCommentingRanges = this._register(new Emitter());
    this.onDidUpdateCommentingRanges = this._onDidUpdateCommentingRanges.event;
    this._onDidChangeActiveEditingCommentThread = this._register(new Emitter());
    this.onDidChangeActiveEditingCommentThread = this._onDidChangeActiveEditingCommentThread.event;
    this._onDidChangeCurrentCommentThread = this._register(new Emitter());
    this.onDidChangeCurrentCommentThread = this._onDidChangeCurrentCommentThread.event;
    this._onDidChangeCommentingEnabled = this._register(new Emitter());
    this.onDidChangeCommentingEnabled = this._onDidChangeCommentingEnabled.event;
    this._onResourceHasCommentingRanges = this._register(new Emitter());
    this.onResourceHasCommentingRanges = this._onResourceHasCommentingRanges.event;
    this._onDidChangeActiveCommentingRange = this._register(new Emitter());
    this.onDidChangeActiveCommentingRange = this._onDidChangeActiveCommentingRange.event;
    this._commentControls = /* @__PURE__ */ new Map();
    this._commentMenus = /* @__PURE__ */ new Map();
    this._isCommentingEnabled = true;
    this._continueOnComments = /* @__PURE__ */ new Map();
    // uniqueOwner -> PendingCommentThread[]
    this._continueOnCommentProviders = /* @__PURE__ */ new Set();
    this._commentsModel = this._register(new CommentsModel());
    this.commentsModel = this._commentsModel;
    this._commentingRangeResources = /* @__PURE__ */ new Set();
    // URIs
    this._commentingRangeResourceHintSchemes = /* @__PURE__ */ new Set();
    this._handleConfiguration();
    this._handleZenMode();
    this._workspaceHasCommenting = CommentContextKeys.WorkspaceHasCommenting.bindTo(contextKeyService);
    this._commentingEnabled = CommentContextKeys.commentingEnabled.bindTo(contextKeyService);
    const storageListener = this._register(new DisposableStore());
    const storageEvent = Event.debounce(this.storageService.onDidChangeValue(StorageScope.WORKSPACE, CONTINUE_ON_COMMENTS, storageListener), (last, event) => last?.external ? last : event, 500);
    storageListener.add(storageEvent((v) => {
      if (!v.external) {
        return;
      }
      const commentsToRestore = this.storageService.getObject(CONTINUE_ON_COMMENTS, StorageScope.WORKSPACE);
      if (!commentsToRestore) {
        return;
      }
      this.logService.debug(`Comments: URIs of continue on comments from storage ${commentsToRestore.map((thread) => thread.uri.toString()).join(", ")}.`);
      const changedOwners = this._addContinueOnComments(commentsToRestore, this._continueOnComments);
      for (const uniqueOwner of changedOwners) {
        const control = this._commentControls.get(uniqueOwner);
        if (!control) {
          continue;
        }
        const evt = {
          uniqueOwner,
          owner: control.owner,
          ownerLabel: control.label,
          pending: this._continueOnComments.get(uniqueOwner) || [],
          added: [],
          removed: [],
          changed: []
        };
        this.updateModelThreads(evt);
      }
    }));
    this._register(storageService.onWillSaveState(() => {
      const map = /* @__PURE__ */ new Map();
      for (const provider of this._continueOnCommentProviders) {
        const pendingComments = provider.provideContinueOnComments();
        this._addContinueOnComments(pendingComments, map);
      }
      this._saveContinueOnComments(map);
    }));
    this._register(this.modelService.onModelAdded((model) => {
      if (model.uri.scheme === Schemas.vscodeSourceControl) {
        return;
      }
      if (!this._commentingRangeResources.has(model.uri.toString())) {
        this.getDocumentComments(model.uri);
      }
    }));
  }
  _updateResourcesWithCommentingRanges(resource, commentInfos) {
    let addedResources = false;
    for (const comments of commentInfos) {
      if (comments && (comments.commentingRanges.ranges.length > 0 || comments.threads.length > 0)) {
        this._commentingRangeResources.add(resource.toString());
        addedResources = true;
      }
    }
    if (addedResources) {
      this._onResourceHasCommentingRanges.fire();
    }
  }
  _handleConfiguration() {
    this._isCommentingEnabled = this._defaultCommentingEnablement;
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("comments.visible")) {
        this.enableCommenting(this._defaultCommentingEnablement);
      }
    }));
  }
  _handleZenMode() {
    let preZenModeValue = this._isCommentingEnabled;
    this._register(this.layoutService.onDidChangeZenMode((e) => {
      if (e) {
        preZenModeValue = this._isCommentingEnabled;
        this.enableCommenting(false);
      } else {
        this.enableCommenting(preZenModeValue);
      }
    }));
  }
  get _defaultCommentingEnablement() {
    return !!this.configurationService.getValue(COMMENTS_SECTION)?.visible;
  }
  get isCommentingEnabled() {
    return this._isCommentingEnabled;
  }
  enableCommenting(enable) {
    if (enable !== this._isCommentingEnabled) {
      this._isCommentingEnabled = enable;
      this._commentingEnabled.set(enable);
      this._onDidChangeCommentingEnabled.fire(enable);
    }
  }
  /**
   * The current comment thread is the thread that has focus or is being hovered.
   * @param commentThread
   */
  setCurrentCommentThread(commentThread) {
    this._onDidChangeCurrentCommentThread.fire(commentThread);
  }
  /**
   * The active comment thread is the thread that is currently being edited.
   * @param commentThread
   */
  setActiveEditingCommentThread(commentThread) {
    this._onDidChangeActiveEditingCommentThread.fire(commentThread);
  }
  get lastActiveCommentcontroller() {
    return this._lastActiveCommentController;
  }
  async setActiveCommentAndThread(uniqueOwner, commentInfo) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    if (commentController !== this._lastActiveCommentController) {
      await this._lastActiveCommentController?.setActiveCommentAndThread(void 0);
    }
    this._lastActiveCommentController = commentController;
    return commentController.setActiveCommentAndThread(commentInfo);
  }
  setDocumentComments(resource, commentInfos) {
    this._onDidSetResourceCommentInfos.fire({ resource, commentInfos });
  }
  setModelThreads(ownerId, owner, ownerLabel, commentThreads) {
    this._commentsModel.setCommentThreads(ownerId, owner, ownerLabel, commentThreads);
    this._onDidSetAllCommentThreads.fire({ ownerId, ownerLabel, commentThreads });
  }
  updateModelThreads(event) {
    this._commentsModel.updateCommentThreads(event);
    this._onDidUpdateCommentThreads.fire(event);
  }
  setWorkspaceComments(uniqueOwner, commentsByResource) {
    if (commentsByResource.length) {
      this._workspaceHasCommenting.set(true);
    }
    const control = this._commentControls.get(uniqueOwner);
    if (control) {
      this.setModelThreads(uniqueOwner, control.owner, control.label, commentsByResource);
    }
  }
  removeWorkspaceComments(uniqueOwner) {
    const control = this._commentControls.get(uniqueOwner);
    if (control) {
      this.setModelThreads(uniqueOwner, control.owner, control.label, []);
    }
  }
  registerCommentController(uniqueOwner, commentControl) {
    this._commentControls.set(uniqueOwner, commentControl);
    this._onDidSetDataProvider.fire();
  }
  unregisterCommentController(uniqueOwner) {
    if (uniqueOwner) {
      this._commentControls.delete(uniqueOwner);
    } else {
      this._commentControls.clear();
    }
    this._commentsModel.deleteCommentsByOwner(uniqueOwner);
    this._onDidDeleteDataProvider.fire(uniqueOwner);
  }
  getCommentController(uniqueOwner) {
    return this._commentControls.get(uniqueOwner);
  }
  async createCommentThreadTemplate(uniqueOwner, resource, range, editorId) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    return commentController.createCommentThreadTemplate(resource, range, editorId);
  }
  async updateCommentThreadTemplate(uniqueOwner, threadHandle, range) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (!commentController) {
      return;
    }
    await commentController.updateCommentThreadTemplate(threadHandle, range);
  }
  disposeCommentThread(uniqueOwner, threadId) {
    const controller = this.getCommentController(uniqueOwner);
    controller?.deleteCommentThreadMain(threadId);
  }
  getCommentMenus(uniqueOwner) {
    if (this._commentMenus.get(uniqueOwner)) {
      return this._commentMenus.get(uniqueOwner);
    }
    const menu = this.instantiationService.createInstance(CommentMenus);
    this._commentMenus.set(uniqueOwner, menu);
    return menu;
  }
  updateComments(ownerId, event) {
    const control = this._commentControls.get(ownerId);
    if (control) {
      const evt = Object.assign({}, event, { uniqueOwner: ownerId, ownerLabel: control.label, owner: control.owner });
      this.updateModelThreads(evt);
    }
  }
  updateNotebookComments(ownerId, event) {
    const evt = Object.assign({}, event, { uniqueOwner: ownerId });
    this._onDidUpdateNotebookCommentThreads.fire(evt);
  }
  updateCommentingRanges(ownerId, resourceHints) {
    if (resourceHints?.schemes && resourceHints.schemes.length > 0) {
      for (const scheme of resourceHints.schemes) {
        this._commentingRangeResourceHintSchemes.add(scheme);
      }
    }
    this._workspaceHasCommenting.set(true);
    this._onDidUpdateCommentingRanges.fire({ uniqueOwner: ownerId });
  }
  async toggleReaction(uniqueOwner, resource, thread, comment, reaction) {
    const commentController = this._commentControls.get(uniqueOwner);
    if (commentController) {
      return commentController.toggleReaction(resource, thread, comment, reaction, CancellationToken.None);
    } else {
      throw new Error("Not supported");
    }
  }
  hasReactionHandler(uniqueOwner) {
    const commentProvider = this._commentControls.get(uniqueOwner);
    if (commentProvider) {
      return !!commentProvider.features.reactionHandler;
    }
    return false;
  }
  async getDocumentComments(resource) {
    const commentControlResult = [];
    for (const control of this._commentControls.values()) {
      commentControlResult.push(control.getDocumentComments(resource, CancellationToken.None).then((documentComments) => {
        for (const documentCommentThread of documentComments.threads) {
          if (documentCommentThread.comments?.length === 0 && documentCommentThread.range) {
            this.removeContinueOnComment({ range: documentCommentThread.range, uri: resource, uniqueOwner: documentComments.uniqueOwner });
          }
        }
        const pendingComments = this._continueOnComments.get(documentComments.uniqueOwner);
        documentComments.pendingCommentThreads = pendingComments?.filter((pendingComment) => pendingComment.uri.toString() === resource.toString());
        return documentComments;
      }).catch((_) => {
        return null;
      }));
    }
    const commentInfos = await Promise.all(commentControlResult);
    this._updateResourcesWithCommentingRanges(resource, commentInfos);
    return commentInfos;
  }
  async getNotebookComments(resource) {
    const commentControlResult = [];
    this._commentControls.forEach((control) => {
      commentControlResult.push(control.getNotebookComments(resource, CancellationToken.None).catch((_) => {
        return null;
      }));
    });
    return Promise.all(commentControlResult);
  }
  registerContinueOnCommentProvider(provider) {
    this._continueOnCommentProviders.add(provider);
    return {
      dispose: () => {
        this._continueOnCommentProviders.delete(provider);
      }
    };
  }
  _saveContinueOnComments(map) {
    const commentsToSave = [];
    for (const pendingComments of map.values()) {
      commentsToSave.push(...pendingComments);
    }
    this.logService.debug(`Comments: URIs of continue on comments to add to storage ${commentsToSave.map((thread) => thread.uri.toString()).join(", ")}.`);
    this.storageService.store(CONTINUE_ON_COMMENTS, commentsToSave, StorageScope.WORKSPACE, StorageTarget.USER);
  }
  removeContinueOnComment(pendingComment) {
    const pendingComments = this._continueOnComments.get(pendingComment.uniqueOwner);
    if (pendingComments) {
      const commentIndex = pendingComments.findIndex((comment) => comment.uri.toString() === pendingComment.uri.toString() && Range.equalsRange(comment.range, pendingComment.range) && (pendingComment.isReply === void 0 || comment.isReply === pendingComment.isReply));
      if (commentIndex > -1) {
        return pendingComments.splice(commentIndex, 1)[0];
      }
    }
    return void 0;
  }
  _addContinueOnComments(pendingComments, map) {
    const changedOwners = /* @__PURE__ */ new Set();
    for (const pendingComment of pendingComments) {
      if (!map.has(pendingComment.uniqueOwner)) {
        map.set(pendingComment.uniqueOwner, [pendingComment]);
        changedOwners.add(pendingComment.uniqueOwner);
      } else {
        const commentsForOwner = map.get(pendingComment.uniqueOwner);
        if (commentsForOwner.every((comment) => comment.uri.toString() !== pendingComment.uri.toString() || !Range.equalsRange(comment.range, pendingComment.range))) {
          commentsForOwner.push(pendingComment);
          changedOwners.add(pendingComment.uniqueOwner);
        }
      }
    }
    return changedOwners;
  }
  resourceHasCommentingRanges(resource) {
    return this._commentingRangeResourceHintSchemes.has(resource.scheme) || this._commentingRangeResources.has(resource.toString());
  }
};
CommentService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IStorageService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IModelService)
], CommentService);
export {
  CommentService,
  ICommentService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCwgQ29tbWVudEluZm8sIENvbW1lbnQsIENvbW1lbnRSZWFjdGlvbiwgQ29tbWVudGluZ1JhbmdlcywgQ29tbWVudFRocmVhZCwgQ29tbWVudE9wdGlvbnMsIFBlbmRpbmdDb21tZW50VGhyZWFkLCBDb21tZW50aW5nUmFuZ2VSZXNvdXJjZUhpbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IsIElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBSYW5nZSwgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElDb21tZW50VGhyZWFkQ2hhbmdlZEV2ZW50IH0gZnJvbSAnLi4vY29tbW9uL2NvbW1lbnRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDb21tZW50TWVudXMgfSBmcm9tICcuL2NvbW1lbnRNZW51cy5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ09NTUVOVFNfU0VDVElPTiwgSUNvbW1lbnRzQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50c0NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IENvbW1lbnRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBDb21tZW50c01vZGVsLCBJQ29tbWVudHNNb2RlbCB9IGZyb20gJy4vY29tbWVudHNNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5cbmV4cG9ydCBjb25zdCBJQ29tbWVudFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUNvbW1lbnRTZXJ2aWNlPignY29tbWVudFNlcnZpY2UnKTtcblxuaW50ZXJmYWNlIElSZXNvdXJjZUNvbW1lbnRUaHJlYWRFdmVudCB7XG5cdHJlc291cmNlOiBVUkk7XG5cdGNvbW1lbnRJbmZvczogSUNvbW1lbnRJbmZvW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbW1lbnRJbmZvPFQgPSBJUmFuZ2U+IGV4dGVuZHMgQ29tbWVudEluZm88VD4ge1xuXHR1bmlxdWVPd25lcjogc3RyaW5nO1xuXHRsYWJlbD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tDb21tZW50SW5mbyB7XG5cdGV4dGVuc2lvbklkPzogc3RyaW5nO1xuXHR0aHJlYWRzOiBDb21tZW50VGhyZWFkPElDZWxsUmFuZ2U+W107XG5cdHVuaXF1ZU93bmVyOiBzdHJpbmc7XG5cdGxhYmVsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3Jrc3BhY2VDb21tZW50VGhyZWFkc0V2ZW50IHtcblx0b3duZXJJZDogc3RyaW5nO1xuXHRvd25lckxhYmVsOiBzdHJpbmc7XG5cdGNvbW1lbnRUaHJlYWRzOiBDb21tZW50VGhyZWFkW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCBleHRlbmRzIENvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQ8SUNlbGxSYW5nZT4ge1xuXHR1bmlxdWVPd25lcjogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21tZW50Q29udHJvbGxlciB7XG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdGZlYXR1cmVzOiB7XG5cdFx0cmVhY3Rpb25Hcm91cD86IENvbW1lbnRSZWFjdGlvbltdO1xuXHRcdHJlYWN0aW9uSGFuZGxlcj86IGJvb2xlYW47XG5cdFx0b3B0aW9ucz86IENvbW1lbnRPcHRpb25zO1xuXHR9O1xuXHRvcHRpb25zPzogQ29tbWVudE9wdGlvbnM7XG5cdGNvbnRleHRWYWx1ZT86IHN0cmluZztcblx0b3duZXI6IHN0cmluZztcblx0YWN0aXZlQ29tbWVudDogeyB0aHJlYWQ6IENvbW1lbnRUaHJlYWQ7IGNvbW1lbnQ/OiBDb21tZW50IH0gfCB1bmRlZmluZWQ7XG5cdGNyZWF0ZUNvbW1lbnRUaHJlYWRUZW1wbGF0ZShyZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZCwgZWRpdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuXHR1cGRhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUodGhyZWFkSGFuZGxlOiBudW1iZXIsIHJhbmdlOiBJUmFuZ2UpOiBQcm9taXNlPHZvaWQ+O1xuXHRkZWxldGVDb21tZW50VGhyZWFkTWFpbihjb21tZW50VGhyZWFkSWQ6IHN0cmluZyk6IHZvaWQ7XG5cdHRvZ2dsZVJlYWN0aW9uKHVyaTogVVJJLCB0aHJlYWQ6IENvbW1lbnRUaHJlYWQsIGNvbW1lbnQ6IENvbW1lbnQsIHJlYWN0aW9uOiBDb21tZW50UmVhY3Rpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD47XG5cdGdldERvY3VtZW50Q29tbWVudHMocmVzb3VyY2U6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ29tbWVudEluZm88SVJhbmdlPj47XG5cdGdldE5vdGVib29rQ29tbWVudHMocmVzb3VyY2U6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJTm90ZWJvb2tDb21tZW50SW5mbz47XG5cdHNldEFjdGl2ZUNvbW1lbnRBbmRUaHJlYWQoY29tbWVudEluZm86IHsgdGhyZWFkOiBDb21tZW50VGhyZWFkOyBjb21tZW50PzogQ29tbWVudCB9IHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29udGludWVPbkNvbW1lbnRQcm92aWRlciB7XG5cdHByb3ZpZGVDb250aW51ZU9uQ29tbWVudHMoKTogUGVuZGluZ0NvbW1lbnRUaHJlYWRbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWVudFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IG9uRGlkU2V0UmVzb3VyY2VDb21tZW50SW5mb3M6IEV2ZW50PElSZXNvdXJjZUNvbW1lbnRUaHJlYWRFdmVudD47XG5cdHJlYWRvbmx5IG9uRGlkU2V0QWxsQ29tbWVudFRocmVhZHM6IEV2ZW50PElXb3Jrc3BhY2VDb21tZW50VGhyZWFkc0V2ZW50Pjtcblx0cmVhZG9ubHkgb25EaWRVcGRhdGVDb21tZW50VGhyZWFkczogRXZlbnQ8SUNvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZFVwZGF0ZU5vdGVib29rQ29tbWVudFRocmVhZHM6IEV2ZW50PElOb3RlYm9va0NvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUFjdGl2ZUVkaXRpbmdDb21tZW50VGhyZWFkOiBFdmVudDxDb21tZW50VGhyZWFkIHwgbnVsbD47XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ3VycmVudENvbW1lbnRUaHJlYWQ6IEV2ZW50PENvbW1lbnRUaHJlYWQgfCB1bmRlZmluZWQ+O1xuXHRyZWFkb25seSBvbkRpZFVwZGF0ZUNvbW1lbnRpbmdSYW5nZXM6IEV2ZW50PHsgdW5pcXVlT3duZXI6IHN0cmluZyB9Pjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVDb21tZW50aW5nUmFuZ2U6IEV2ZW50PHsgcmFuZ2U6IFJhbmdlOyBjb21tZW50aW5nUmFuZ2VzSW5mbzogQ29tbWVudGluZ1JhbmdlcyB9Pjtcblx0cmVhZG9ubHkgb25EaWRTZXREYXRhUHJvdmlkZXI6IEV2ZW50PHZvaWQ+O1xuXHRyZWFkb25seSBvbkRpZERlbGV0ZURhdGFQcm92aWRlcjogRXZlbnQ8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb21tZW50aW5nRW5hYmxlZDogRXZlbnQ8Ym9vbGVhbj47XG5cdHJlYWRvbmx5IG9uUmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgaXNDb21tZW50aW5nRW5hYmxlZDogYm9vbGVhbjtcblx0cmVhZG9ubHkgY29tbWVudHNNb2RlbDogSUNvbW1lbnRzTW9kZWw7XG5cdHJlYWRvbmx5IGxhc3RBY3RpdmVDb21tZW50Y29udHJvbGxlcjogSUNvbW1lbnRDb250cm9sbGVyIHwgdW5kZWZpbmVkO1xuXHRzZXREb2N1bWVudENvbW1lbnRzKHJlc291cmNlOiBVUkksIGNvbW1lbnRJbmZvczogSUNvbW1lbnRJbmZvW10pOiB2b2lkO1xuXHRzZXRXb3Jrc3BhY2VDb21tZW50cyh1bmlxdWVPd25lcjogc3RyaW5nLCBjb21tZW50c0J5UmVzb3VyY2U6IENvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT5bXSk6IHZvaWQ7XG5cdHJlbW92ZVdvcmtzcGFjZUNvbW1lbnRzKHVuaXF1ZU93bmVyOiBzdHJpbmcpOiB2b2lkO1xuXHRyZWdpc3RlckNvbW1lbnRDb250cm9sbGVyKHVuaXF1ZU93bmVyOiBzdHJpbmcsIGNvbW1lbnRDb250cm9sOiBJQ29tbWVudENvbnRyb2xsZXIpOiB2b2lkO1xuXHR1bnJlZ2lzdGVyQ29tbWVudENvbnRyb2xsZXIodW5pcXVlT3duZXI/OiBzdHJpbmcpOiB2b2lkO1xuXHRnZXRDb21tZW50Q29udHJvbGxlcih1bmlxdWVPd25lcjogc3RyaW5nKTogSUNvbW1lbnRDb250cm9sbGVyIHwgdW5kZWZpbmVkO1xuXHRjcmVhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUodW5pcXVlT3duZXI6IHN0cmluZywgcmVzb3VyY2U6IFVSSSwgcmFuZ2U6IFJhbmdlIHwgdW5kZWZpbmVkLCBlZGl0b3JJZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG5cdHVwZGF0ZUNvbW1lbnRUaHJlYWRUZW1wbGF0ZSh1bmlxdWVPd25lcjogc3RyaW5nLCB0aHJlYWRIYW5kbGU6IG51bWJlciwgcmFuZ2U6IFJhbmdlKTogUHJvbWlzZTx2b2lkPjtcblx0Z2V0Q29tbWVudE1lbnVzKHVuaXF1ZU93bmVyOiBzdHJpbmcpOiBDb21tZW50TWVudXM7XG5cdHVwZGF0ZUNvbW1lbnRzKG93bmVySWQ6IHN0cmluZywgZXZlbnQ6IENvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQ8SVJhbmdlPik6IHZvaWQ7XG5cdHVwZGF0ZU5vdGVib29rQ29tbWVudHMob3duZXJJZDogc3RyaW5nLCBldmVudDogQ29tbWVudFRocmVhZENoYW5nZWRFdmVudDxJQ2VsbFJhbmdlPik6IHZvaWQ7XG5cdGRpc3Bvc2VDb21tZW50VGhyZWFkKG93bmVySWQ6IHN0cmluZywgdGhyZWFkSWQ6IHN0cmluZyk6IHZvaWQ7XG5cdGdldERvY3VtZW50Q29tbWVudHMocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8KElDb21tZW50SW5mbyB8IG51bGwpW10+O1xuXHRnZXROb3RlYm9va0NvbW1lbnRzKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPChJTm90ZWJvb2tDb21tZW50SW5mbyB8IG51bGwpW10+O1xuXHR1cGRhdGVDb21tZW50aW5nUmFuZ2VzKG93bmVySWQ6IHN0cmluZywgcmVzb3VyY2VIaW50cz86IENvbW1lbnRpbmdSYW5nZVJlc291cmNlSGludCk6IHZvaWQ7XG5cdGhhc1JlYWN0aW9uSGFuZGxlcih1bmlxdWVPd25lcjogc3RyaW5nKTogYm9vbGVhbjtcblx0dG9nZ2xlUmVhY3Rpb24odW5pcXVlT3duZXI6IHN0cmluZywgcmVzb3VyY2U6IFVSSSwgdGhyZWFkOiBDb21tZW50VGhyZWFkPElSYW5nZSB8IElDZWxsUmFuZ2U+LCBjb21tZW50OiBDb21tZW50LCByZWFjdGlvbjogQ29tbWVudFJlYWN0aW9uKTogUHJvbWlzZTx2b2lkPjtcblx0c2V0QWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZDogQ29tbWVudFRocmVhZDxJUmFuZ2UgfCBJQ2VsbFJhbmdlPiB8IG51bGwpOiB2b2lkO1xuXHRzZXRDdXJyZW50Q29tbWVudFRocmVhZChjb21tZW50VGhyZWFkOiBDb21tZW50VGhyZWFkPElSYW5nZSB8IElDZWxsUmFuZ2U+IHwgdW5kZWZpbmVkKTogdm9pZDtcblx0c2V0QWN0aXZlQ29tbWVudEFuZFRocmVhZCh1bmlxdWVPd25lcjogc3RyaW5nLCBjb21tZW50SW5mbzogeyB0aHJlYWQ6IENvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT47IGNvbW1lbnQ/OiBDb21tZW50IH0gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+O1xuXHRlbmFibGVDb21tZW50aW5nKGVuYWJsZTogYm9vbGVhbik6IHZvaWQ7XG5cdHJlZ2lzdGVyQ29udGludWVPbkNvbW1lbnRQcm92aWRlcihwcm92aWRlcjogSUNvbnRpbnVlT25Db21tZW50UHJvdmlkZXIpOiBJRGlzcG9zYWJsZTtcblx0cmVtb3ZlQ29udGludWVPbkNvbW1lbnQocGVuZGluZ0NvbW1lbnQ6IHsgcmFuZ2U6IElSYW5nZSB8IHVuZGVmaW5lZDsgdXJpOiBVUkk7IHVuaXF1ZU93bmVyOiBzdHJpbmc7IGlzUmVwbHk/OiBib29sZWFuIH0pOiBQZW5kaW5nQ29tbWVudFRocmVhZCB8IHVuZGVmaW5lZDtcblx0cmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzKHJlc291cmNlOiBVUkkpOiBib29sZWFuO1xufVxuXG5jb25zdCBDT05USU5VRV9PTl9DT01NRU5UUyA9ICdjb21tZW50cy5jb250aW51ZU9uQ29tbWVudHMnO1xuXG5leHBvcnQgY2xhc3MgQ29tbWVudFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNvbW1lbnRTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZXREYXRhUHJvdmlkZXI6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRTZXREYXRhUHJvdmlkZXI6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRTZXREYXRhUHJvdmlkZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREZWxldGVEYXRhUHJvdmlkZXI6IEVtaXR0ZXI8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZyB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRGVsZXRlRGF0YVByb3ZpZGVyOiBFdmVudDxzdHJpbmcgfCB1bmRlZmluZWQ+ID0gdGhpcy5fb25EaWREZWxldGVEYXRhUHJvdmlkZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZXRSZXNvdXJjZUNvbW1lbnRJbmZvczogRW1pdHRlcjxJUmVzb3VyY2VDb21tZW50VGhyZWFkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVJlc291cmNlQ29tbWVudFRocmVhZEV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRTZXRSZXNvdXJjZUNvbW1lbnRJbmZvczogRXZlbnQ8SVJlc291cmNlQ29tbWVudFRocmVhZEV2ZW50PiA9IHRoaXMuX29uRGlkU2V0UmVzb3VyY2VDb21tZW50SW5mb3MuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZXRBbGxDb21tZW50VGhyZWFkczogRW1pdHRlcjxJV29ya3NwYWNlQ29tbWVudFRocmVhZHNFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJV29ya3NwYWNlQ29tbWVudFRocmVhZHNFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2V0QWxsQ29tbWVudFRocmVhZHM6IEV2ZW50PElXb3Jrc3BhY2VDb21tZW50VGhyZWFkc0V2ZW50PiA9IHRoaXMuX29uRGlkU2V0QWxsQ29tbWVudFRocmVhZHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGVDb21tZW50VGhyZWFkczogRW1pdHRlcjxJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlQ29tbWVudFRocmVhZHM6IEV2ZW50PElDb21tZW50VGhyZWFkQ2hhbmdlZEV2ZW50PiA9IHRoaXMuX29uRGlkVXBkYXRlQ29tbWVudFRocmVhZHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGVOb3RlYm9va0NvbW1lbnRUaHJlYWRzOiBFbWl0dGVyPElOb3RlYm9va0NvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SU5vdGVib29rQ29tbWVudFRocmVhZENoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlTm90ZWJvb2tDb21tZW50VGhyZWFkczogRXZlbnQ8SU5vdGVib29rQ29tbWVudFRocmVhZENoYW5nZWRFdmVudD4gPSB0aGlzLl9vbkRpZFVwZGF0ZU5vdGVib29rQ29tbWVudFRocmVhZHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGVDb21tZW50aW5nUmFuZ2VzOiBFbWl0dGVyPHsgdW5pcXVlT3duZXI6IHN0cmluZyB9PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgdW5pcXVlT3duZXI6IHN0cmluZyB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRVcGRhdGVDb21tZW50aW5nUmFuZ2VzOiBFdmVudDx7IHVuaXF1ZU93bmVyOiBzdHJpbmcgfT4gPSB0aGlzLl9vbkRpZFVwZGF0ZUNvbW1lbnRpbmdSYW5nZXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPENvbW1lbnRUaHJlYWQgfCBudWxsPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZCA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDdXJyZW50Q29tbWVudFRocmVhZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPENvbW1lbnRUaHJlYWQgfCB1bmRlZmluZWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUN1cnJlbnRDb21tZW50VGhyZWFkID0gdGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50Q29tbWVudFRocmVhZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbW1lbnRpbmdFbmFibGVkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29tbWVudGluZ0VuYWJsZWQgPSB0aGlzLl9vbkRpZENoYW5nZUNvbW1lbnRpbmdFbmFibGVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uUmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uUmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzID0gdGhpcy5fb25SZXNvdXJjZUhhc0NvbW1lbnRpbmdSYW5nZXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVDb21tZW50aW5nUmFuZ2U6IEVtaXR0ZXI8e1xuXHRcdHJhbmdlOiBSYW5nZTsgY29tbWVudGluZ1Jhbmdlc0luZm86XG5cdFx0Q29tbWVudGluZ1Jhbmdlcztcblx0fT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7XG5cdFx0cmFuZ2U6IFJhbmdlOyBjb21tZW50aW5nUmFuZ2VzSW5mbzpcblx0XHRDb21tZW50aW5nUmFuZ2VzO1xuXHR9PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVDb21tZW50aW5nUmFuZ2U6IEV2ZW50PHsgcmFuZ2U6IFJhbmdlOyBjb21tZW50aW5nUmFuZ2VzSW5mbzogQ29tbWVudGluZ1JhbmdlcyB9PiA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlQ29tbWVudGluZ1JhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX2NvbW1lbnRDb250cm9scyA9IG5ldyBNYXA8c3RyaW5nLCBJQ29tbWVudENvbnRyb2xsZXI+KCk7XG5cdHByaXZhdGUgX2NvbW1lbnRNZW51cyA9IG5ldyBNYXA8c3RyaW5nLCBDb21tZW50TWVudXM+KCk7XG5cdHByaXZhdGUgX2lzQ29tbWVudGluZ0VuYWJsZWQ6IGJvb2xlYW4gPSB0cnVlO1xuXHRwcml2YXRlIF93b3Jrc3BhY2VIYXNDb21tZW50aW5nOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBfY29tbWVudGluZ0VuYWJsZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgX2NvbnRpbnVlT25Db21tZW50cyA9IG5ldyBNYXA8c3RyaW5nLCBQZW5kaW5nQ29tbWVudFRocmVhZFtdPigpOyAvLyB1bmlxdWVPd25lciAtPiBQZW5kaW5nQ29tbWVudFRocmVhZFtdXG5cdHByaXZhdGUgX2NvbnRpbnVlT25Db21tZW50UHJvdmlkZXJzID0gbmV3IFNldDxJQ29udGludWVPbkNvbW1lbnRQcm92aWRlcj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21tZW50c01vZGVsOiBDb21tZW50c01vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvbW1lbnRzTW9kZWwoKSk7XG5cdHB1YmxpYyByZWFkb25seSBjb21tZW50c01vZGVsOiBJQ29tbWVudHNNb2RlbCA9IHRoaXMuX2NvbW1lbnRzTW9kZWw7XG5cblx0cHJpdmF0ZSBfY29tbWVudGluZ1JhbmdlUmVzb3VyY2VzID0gbmV3IFNldDxzdHJpbmc+KCk7IC8vIFVSSXNcblx0cHJpdmF0ZSBfY29tbWVudGluZ1JhbmdlUmVzb3VyY2VIaW50U2NoZW1lcyA9IG5ldyBTZXQ8c3RyaW5nPigpOyAvLyBzY2hlbWVzXG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9oYW5kbGVDb25maWd1cmF0aW9uKCk7XG5cdFx0dGhpcy5faGFuZGxlWmVuTW9kZSgpO1xuXHRcdHRoaXMuX3dvcmtzcGFjZUhhc0NvbW1lbnRpbmcgPSBDb21tZW50Q29udGV4dEtleXMuV29ya3NwYWNlSGFzQ29tbWVudGluZy5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2NvbW1lbnRpbmdFbmFibGVkID0gQ29tbWVudENvbnRleHRLZXlzLmNvbW1lbnRpbmdFbmFibGVkLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3Qgc3RvcmFnZUxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdGNvbnN0IHN0b3JhZ2VFdmVudCA9IEV2ZW50LmRlYm91bmNlKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBDT05USU5VRV9PTl9DT01NRU5UUywgc3RvcmFnZUxpc3RlbmVyKSwgKGxhc3QsIGV2ZW50KSA9PiBsYXN0Py5leHRlcm5hbCA/IGxhc3QgOiBldmVudCwgNTAwKTtcblx0XHRzdG9yYWdlTGlzdGVuZXIuYWRkKHN0b3JhZ2VFdmVudCh2ID0+IHtcblx0XHRcdGlmICghdi5leHRlcm5hbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb21tZW50c1RvUmVzdG9yZTogUGVuZGluZ0NvbW1lbnRUaHJlYWRbXSB8IHVuZGVmaW5lZCA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0T2JqZWN0KENPTlRJTlVFX09OX0NPTU1FTlRTLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRcdGlmICghY29tbWVudHNUb1Jlc3RvcmUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBDb21tZW50czogVVJJcyBvZiBjb250aW51ZSBvbiBjb21tZW50cyBmcm9tIHN0b3JhZ2UgJHtjb21tZW50c1RvUmVzdG9yZS5tYXAodGhyZWFkID0+IHRocmVhZC51cmkudG9TdHJpbmcoKSkuam9pbignLCAnKX0uYCk7XG5cdFx0XHRjb25zdCBjaGFuZ2VkT3duZXJzID0gdGhpcy5fYWRkQ29udGludWVPbkNvbW1lbnRzKGNvbW1lbnRzVG9SZXN0b3JlLCB0aGlzLl9jb250aW51ZU9uQ29tbWVudHMpO1xuXHRcdFx0Zm9yIChjb25zdCB1bmlxdWVPd25lciBvZiBjaGFuZ2VkT3duZXJzKSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRyb2wgPSB0aGlzLl9jb21tZW50Q29udHJvbHMuZ2V0KHVuaXF1ZU93bmVyKTtcblx0XHRcdFx0aWYgKCFjb250cm9sKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZXZ0OiBJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCA9IHtcblx0XHRcdFx0XHR1bmlxdWVPd25lcjogdW5pcXVlT3duZXIsXG5cdFx0XHRcdFx0b3duZXI6IGNvbnRyb2wub3duZXIsXG5cdFx0XHRcdFx0b3duZXJMYWJlbDogY29udHJvbC5sYWJlbCxcblx0XHRcdFx0XHRwZW5kaW5nOiB0aGlzLl9jb250aW51ZU9uQ29tbWVudHMuZ2V0KHVuaXF1ZU93bmVyKSB8fCBbXSxcblx0XHRcdFx0XHRhZGRlZDogW10sXG5cdFx0XHRcdFx0cmVtb3ZlZDogW10sXG5cdFx0XHRcdFx0Y2hhbmdlZDogW11cblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy51cGRhdGVNb2RlbFRocmVhZHMoZXZ0KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHtcblx0XHRcdGNvbnN0IG1hcDogTWFwPHN0cmluZywgUGVuZGluZ0NvbW1lbnRUaHJlYWRbXT4gPSBuZXcgTWFwKCk7XG5cdFx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMuX2NvbnRpbnVlT25Db21tZW50UHJvdmlkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IHBlbmRpbmdDb21tZW50cyA9IHByb3ZpZGVyLnByb3ZpZGVDb250aW51ZU9uQ29tbWVudHMoKTtcblx0XHRcdFx0dGhpcy5fYWRkQ29udGludWVPbkNvbW1lbnRzKHBlbmRpbmdDb21tZW50cywgbWFwKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3NhdmVDb250aW51ZU9uQ29tbWVudHMobWFwKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsU2VydmljZS5vbk1vZGVsQWRkZWQobW9kZWwgPT4ge1xuXHRcdFx0Ly8gRXhjbHVkZWQgc2NoZW1lc1xuXHRcdFx0aWYgKChtb2RlbC51cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVNvdXJjZUNvbnRyb2wpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIEFsbG93cyBjb21tZW50IHByb3ZpZGVycyB0byBjYXVzZSB0aGVpciBjb21tZW50aW5nIHJhbmdlcyB0byBiZSBwcmVmZXRjaGVkIGJ5IG9wZW5pbmcgdGV4dCBkb2N1bWVudHMgaW4gdGhlIGJhY2tncm91bmQuXG5cdFx0XHRpZiAoIXRoaXMuX2NvbW1lbnRpbmdSYW5nZVJlc291cmNlcy5oYXMobW9kZWwudXJpLnRvU3RyaW5nKCkpKSB7XG5cdFx0XHRcdHRoaXMuZ2V0RG9jdW1lbnRDb21tZW50cyhtb2RlbC51cmkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVJlc291cmNlc1dpdGhDb21tZW50aW5nUmFuZ2VzKHJlc291cmNlOiBVUkksIGNvbW1lbnRJbmZvczogKElDb21tZW50SW5mbyB8IG51bGwpW10pIHtcblx0XHRsZXQgYWRkZWRSZXNvdXJjZXMgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IGNvbW1lbnRzIG9mIGNvbW1lbnRJbmZvcykge1xuXHRcdFx0aWYgKGNvbW1lbnRzICYmIChjb21tZW50cy5jb21tZW50aW5nUmFuZ2VzLnJhbmdlcy5sZW5ndGggPiAwIHx8IGNvbW1lbnRzLnRocmVhZHMubGVuZ3RoID4gMCkpIHtcblx0XHRcdFx0dGhpcy5fY29tbWVudGluZ1JhbmdlUmVzb3VyY2VzLmFkZChyZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0YWRkZWRSZXNvdXJjZXMgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoYWRkZWRSZXNvdXJjZXMpIHtcblx0XHRcdHRoaXMuX29uUmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9oYW5kbGVDb25maWd1cmF0aW9uKCkge1xuXHRcdHRoaXMuX2lzQ29tbWVudGluZ0VuYWJsZWQgPSB0aGlzLl9kZWZhdWx0Q29tbWVudGluZ0VuYWJsZW1lbnQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignY29tbWVudHMudmlzaWJsZScpKSB7XG5cdFx0XHRcdHRoaXMuZW5hYmxlQ29tbWVudGluZyh0aGlzLl9kZWZhdWx0Q29tbWVudGluZ0VuYWJsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVplbk1vZGUoKSB7XG5cdFx0bGV0IHByZVplbk1vZGVWYWx1ZTogYm9vbGVhbiA9IHRoaXMuX2lzQ29tbWVudGluZ0VuYWJsZWQ7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYXlvdXRTZXJ2aWNlLm9uRGlkQ2hhbmdlWmVuTW9kZShlID0+IHtcblx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdHByZVplbk1vZGVWYWx1ZSA9IHRoaXMuX2lzQ29tbWVudGluZ0VuYWJsZWQ7XG5cdFx0XHRcdHRoaXMuZW5hYmxlQ29tbWVudGluZyhmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmVuYWJsZUNvbW1lbnRpbmcocHJlWmVuTW9kZVZhbHVlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBfZGVmYXVsdENvbW1lbnRpbmdFbmFibGVtZW50KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SUNvbW1lbnRzQ29uZmlndXJhdGlvbiB8IHVuZGVmaW5lZD4oQ09NTUVOVFNfU0VDVElPTik/LnZpc2libGU7XG5cdH1cblxuXHRnZXQgaXNDb21tZW50aW5nRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNDb21tZW50aW5nRW5hYmxlZDtcblx0fVxuXG5cdGVuYWJsZUNvbW1lbnRpbmcoZW5hYmxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKGVuYWJsZSAhPT0gdGhpcy5faXNDb21tZW50aW5nRW5hYmxlZCkge1xuXHRcdFx0dGhpcy5faXNDb21tZW50aW5nRW5hYmxlZCA9IGVuYWJsZTtcblx0XHRcdHRoaXMuX2NvbW1lbnRpbmdFbmFibGVkLnNldChlbmFibGUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb21tZW50aW5nRW5hYmxlZC5maXJlKGVuYWJsZSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBjdXJyZW50IGNvbW1lbnQgdGhyZWFkIGlzIHRoZSB0aHJlYWQgdGhhdCBoYXMgZm9jdXMgb3IgaXMgYmVpbmcgaG92ZXJlZC5cblx0ICogQHBhcmFtIGNvbW1lbnRUaHJlYWRcblx0ICovXG5cdHNldEN1cnJlbnRDb21tZW50VGhyZWFkKGNvbW1lbnRUaHJlYWQ6IENvbW1lbnRUaHJlYWQgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUN1cnJlbnRDb21tZW50VGhyZWFkLmZpcmUoY29tbWVudFRocmVhZCk7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGFjdGl2ZSBjb21tZW50IHRocmVhZCBpcyB0aGUgdGhyZWFkIHRoYXQgaXMgY3VycmVudGx5IGJlaW5nIGVkaXRlZC5cblx0ICogQHBhcmFtIGNvbW1lbnRUaHJlYWRcblx0ICovXG5cdHNldEFjdGl2ZUVkaXRpbmdDb21tZW50VGhyZWFkKGNvbW1lbnRUaHJlYWQ6IENvbW1lbnRUaHJlYWQgfCBudWxsKSB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZC5maXJlKGNvbW1lbnRUaHJlYWQpO1xuXHR9XG5cblx0Z2V0IGxhc3RBY3RpdmVDb21tZW50Y29udHJvbGxlcigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFzdEFjdGl2ZUNvbW1lbnRDb250cm9sbGVyO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGFzdEFjdGl2ZUNvbW1lbnRDb250cm9sbGVyOiBJQ29tbWVudENvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG5cdGFzeW5jIHNldEFjdGl2ZUNvbW1lbnRBbmRUaHJlYWQodW5pcXVlT3duZXI6IHN0cmluZywgY29tbWVudEluZm86IHsgdGhyZWFkOiBDb21tZW50VGhyZWFkPElSYW5nZT47IGNvbW1lbnQ/OiBDb21tZW50IH0gfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBjb21tZW50Q29udHJvbGxlciA9IHRoaXMuX2NvbW1lbnRDb250cm9scy5nZXQodW5pcXVlT3duZXIpO1xuXG5cdFx0aWYgKCFjb21tZW50Q29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChjb21tZW50Q29udHJvbGxlciAhPT0gdGhpcy5fbGFzdEFjdGl2ZUNvbW1lbnRDb250cm9sbGVyKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9sYXN0QWN0aXZlQ29tbWVudENvbnRyb2xsZXI/LnNldEFjdGl2ZUNvbW1lbnRBbmRUaHJlYWQodW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0dGhpcy5fbGFzdEFjdGl2ZUNvbW1lbnRDb250cm9sbGVyID0gY29tbWVudENvbnRyb2xsZXI7XG5cdFx0cmV0dXJuIGNvbW1lbnRDb250cm9sbGVyLnNldEFjdGl2ZUNvbW1lbnRBbmRUaHJlYWQoY29tbWVudEluZm8pO1xuXHR9XG5cblx0c2V0RG9jdW1lbnRDb21tZW50cyhyZXNvdXJjZTogVVJJLCBjb21tZW50SW5mb3M6IElDb21tZW50SW5mb1tdKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRTZXRSZXNvdXJjZUNvbW1lbnRJbmZvcy5maXJlKHsgcmVzb3VyY2UsIGNvbW1lbnRJbmZvcyB9KTtcblx0fVxuXG5cdHByaXZhdGUgc2V0TW9kZWxUaHJlYWRzKG93bmVySWQ6IHN0cmluZywgb3duZXI6IHN0cmluZywgb3duZXJMYWJlbDogc3RyaW5nLCBjb21tZW50VGhyZWFkczogQ29tbWVudFRocmVhZDxJUmFuZ2U+W10pIHtcblx0XHR0aGlzLl9jb21tZW50c01vZGVsLnNldENvbW1lbnRUaHJlYWRzKG93bmVySWQsIG93bmVyLCBvd25lckxhYmVsLCBjb21tZW50VGhyZWFkcyk7XG5cdFx0dGhpcy5fb25EaWRTZXRBbGxDb21tZW50VGhyZWFkcy5maXJlKHsgb3duZXJJZCwgb3duZXJMYWJlbCwgY29tbWVudFRocmVhZHMgfSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU1vZGVsVGhyZWFkcyhldmVudDogSUNvbW1lbnRUaHJlYWRDaGFuZ2VkRXZlbnQpIHtcblx0XHR0aGlzLl9jb21tZW50c01vZGVsLnVwZGF0ZUNvbW1lbnRUaHJlYWRzKGV2ZW50KTtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUNvbW1lbnRUaHJlYWRzLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0c2V0V29ya3NwYWNlQ29tbWVudHModW5pcXVlT3duZXI6IHN0cmluZywgY29tbWVudHNCeVJlc291cmNlOiBDb21tZW50VGhyZWFkW10pOiB2b2lkIHtcblxuXHRcdGlmIChjb21tZW50c0J5UmVzb3VyY2UubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VIYXNDb21tZW50aW5nLnNldCh0cnVlKTtcblx0XHR9XG5cdFx0Y29uc3QgY29udHJvbCA9IHRoaXMuX2NvbW1lbnRDb250cm9scy5nZXQodW5pcXVlT3duZXIpO1xuXHRcdGlmIChjb250cm9sKSB7XG5cdFx0XHR0aGlzLnNldE1vZGVsVGhyZWFkcyh1bmlxdWVPd25lciwgY29udHJvbC5vd25lciwgY29udHJvbC5sYWJlbCwgY29tbWVudHNCeVJlc291cmNlKTtcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVXb3Jrc3BhY2VDb21tZW50cyh1bmlxdWVPd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udHJvbCA9IHRoaXMuX2NvbW1lbnRDb250cm9scy5nZXQodW5pcXVlT3duZXIpO1xuXHRcdGlmIChjb250cm9sKSB7XG5cdFx0XHR0aGlzLnNldE1vZGVsVGhyZWFkcyh1bmlxdWVPd25lciwgY29udHJvbC5vd25lciwgY29udHJvbC5sYWJlbCwgW10pO1xuXHRcdH1cblx0fVxuXG5cdHJlZ2lzdGVyQ29tbWVudENvbnRyb2xsZXIodW5pcXVlT3duZXI6IHN0cmluZywgY29tbWVudENvbnRyb2w6IElDb21tZW50Q29udHJvbGxlcik6IHZvaWQge1xuXHRcdHRoaXMuX2NvbW1lbnRDb250cm9scy5zZXQodW5pcXVlT3duZXIsIGNvbW1lbnRDb250cm9sKTtcblx0XHR0aGlzLl9vbkRpZFNldERhdGFQcm92aWRlci5maXJlKCk7XG5cdH1cblxuXHR1bnJlZ2lzdGVyQ29tbWVudENvbnRyb2xsZXIodW5pcXVlT3duZXI/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodW5pcXVlT3duZXIpIHtcblx0XHRcdHRoaXMuX2NvbW1lbnRDb250cm9scy5kZWxldGUodW5pcXVlT3duZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9jb21tZW50Q29udHJvbHMuY2xlYXIoKTtcblx0XHR9XG5cdFx0dGhpcy5fY29tbWVudHNNb2RlbC5kZWxldGVDb21tZW50c0J5T3duZXIodW5pcXVlT3duZXIpO1xuXHRcdHRoaXMuX29uRGlkRGVsZXRlRGF0YVByb3ZpZGVyLmZpcmUodW5pcXVlT3duZXIpO1xuXHR9XG5cblx0Z2V0Q29tbWVudENvbnRyb2xsZXIodW5pcXVlT3duZXI6IHN0cmluZyk6IElDb21tZW50Q29udHJvbGxlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbW1lbnRDb250cm9scy5nZXQodW5pcXVlT3duZXIpO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlQ29tbWVudFRocmVhZFRlbXBsYXRlKHVuaXF1ZU93bmVyOiBzdHJpbmcsIHJlc291cmNlOiBVUkksIHJhbmdlOiBSYW5nZSB8IHVuZGVmaW5lZCwgZWRpdG9ySWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb21tZW50Q29udHJvbGxlciA9IHRoaXMuX2NvbW1lbnRDb250cm9scy5nZXQodW5pcXVlT3duZXIpO1xuXG5cdFx0aWYgKCFjb21tZW50Q29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21tZW50Q29udHJvbGxlci5jcmVhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUocmVzb3VyY2UsIHJhbmdlLCBlZGl0b3JJZCk7XG5cdH1cblxuXHRhc3luYyB1cGRhdGVDb21tZW50VGhyZWFkVGVtcGxhdGUodW5pcXVlT3duZXI6IHN0cmluZywgdGhyZWFkSGFuZGxlOiBudW1iZXIsIHJhbmdlOiBSYW5nZSkge1xuXHRcdGNvbnN0IGNvbW1lbnRDb250cm9sbGVyID0gdGhpcy5fY29tbWVudENvbnRyb2xzLmdldCh1bmlxdWVPd25lcik7XG5cblx0XHRpZiAoIWNvbW1lbnRDb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXdhaXQgY29tbWVudENvbnRyb2xsZXIudXBkYXRlQ29tbWVudFRocmVhZFRlbXBsYXRlKHRocmVhZEhhbmRsZSwgcmFuZ2UpO1xuXHR9XG5cblx0ZGlzcG9zZUNvbW1lbnRUaHJlYWQodW5pcXVlT3duZXI6IHN0cmluZywgdGhyZWFkSWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldENvbW1lbnRDb250cm9sbGVyKHVuaXF1ZU93bmVyKTtcblx0XHRjb250cm9sbGVyPy5kZWxldGVDb21tZW50VGhyZWFkTWFpbih0aHJlYWRJZCk7XG5cdH1cblxuXHRnZXRDb21tZW50TWVudXModW5pcXVlT3duZXI6IHN0cmluZyk6IENvbW1lbnRNZW51cyB7XG5cdFx0aWYgKHRoaXMuX2NvbW1lbnRNZW51cy5nZXQodW5pcXVlT3duZXIpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY29tbWVudE1lbnVzLmdldCh1bmlxdWVPd25lcikhO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lbnUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbW1lbnRNZW51cyk7XG5cdFx0dGhpcy5fY29tbWVudE1lbnVzLnNldCh1bmlxdWVPd25lciwgbWVudSk7XG5cdFx0cmV0dXJuIG1lbnU7XG5cdH1cblxuXHR1cGRhdGVDb21tZW50cyhvd25lcklkOiBzdHJpbmcsIGV2ZW50OiBDb21tZW50VGhyZWFkQ2hhbmdlZEV2ZW50PElSYW5nZT4pOiB2b2lkIHtcblx0XHRjb25zdCBjb250cm9sID0gdGhpcy5fY29tbWVudENvbnRyb2xzLmdldChvd25lcklkKTtcblx0XHRpZiAoY29udHJvbCkge1xuXHRcdFx0Y29uc3QgZXZ0OiBJQ29tbWVudFRocmVhZENoYW5nZWRFdmVudCA9IE9iamVjdC5hc3NpZ24oe30sIGV2ZW50LCB7IHVuaXF1ZU93bmVyOiBvd25lcklkLCBvd25lckxhYmVsOiBjb250cm9sLmxhYmVsLCBvd25lcjogY29udHJvbC5vd25lciB9KTtcblx0XHRcdHRoaXMudXBkYXRlTW9kZWxUaHJlYWRzKGV2dCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlTm90ZWJvb2tDb21tZW50cyhvd25lcklkOiBzdHJpbmcsIGV2ZW50OiBDb21tZW50VGhyZWFkQ2hhbmdlZEV2ZW50PElDZWxsUmFuZ2U+KTogdm9pZCB7XG5cdFx0Y29uc3QgZXZ0OiBJTm90ZWJvb2tDb21tZW50VGhyZWFkQ2hhbmdlZEV2ZW50ID0gT2JqZWN0LmFzc2lnbih7fSwgZXZlbnQsIHsgdW5pcXVlT3duZXI6IG93bmVySWQgfSk7XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVOb3RlYm9va0NvbW1lbnRUaHJlYWRzLmZpcmUoZXZ0KTtcblx0fVxuXG5cdHVwZGF0ZUNvbW1lbnRpbmdSYW5nZXMob3duZXJJZDogc3RyaW5nLCByZXNvdXJjZUhpbnRzPzogQ29tbWVudGluZ1JhbmdlUmVzb3VyY2VIaW50KSB7XG5cdFx0aWYgKHJlc291cmNlSGludHM/LnNjaGVtZXMgJiYgcmVzb3VyY2VIaW50cy5zY2hlbWVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3Qgc2NoZW1lIG9mIHJlc291cmNlSGludHMuc2NoZW1lcykge1xuXHRcdFx0XHR0aGlzLl9jb21tZW50aW5nUmFuZ2VSZXNvdXJjZUhpbnRTY2hlbWVzLmFkZChzY2hlbWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl93b3Jrc3BhY2VIYXNDb21tZW50aW5nLnNldCh0cnVlKTtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUNvbW1lbnRpbmdSYW5nZXMuZmlyZSh7IHVuaXF1ZU93bmVyOiBvd25lcklkIH0pO1xuXHR9XG5cblx0YXN5bmMgdG9nZ2xlUmVhY3Rpb24odW5pcXVlT3duZXI6IHN0cmluZywgcmVzb3VyY2U6IFVSSSwgdGhyZWFkOiBDb21tZW50VGhyZWFkLCBjb21tZW50OiBDb21tZW50LCByZWFjdGlvbjogQ29tbWVudFJlYWN0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29tbWVudENvbnRyb2xsZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbHMuZ2V0KHVuaXF1ZU93bmVyKTtcblxuXHRcdGlmIChjb21tZW50Q29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIGNvbW1lbnRDb250cm9sbGVyLnRvZ2dsZVJlYWN0aW9uKHJlc291cmNlLCB0aHJlYWQsIGNvbW1lbnQsIHJlYWN0aW9uLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOb3Qgc3VwcG9ydGVkJyk7XG5cdFx0fVxuXHR9XG5cblx0aGFzUmVhY3Rpb25IYW5kbGVyKHVuaXF1ZU93bmVyOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb21tZW50UHJvdmlkZXIgPSB0aGlzLl9jb21tZW50Q29udHJvbHMuZ2V0KHVuaXF1ZU93bmVyKTtcblxuXHRcdGlmIChjb21tZW50UHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiAhIWNvbW1lbnRQcm92aWRlci5mZWF0dXJlcy5yZWFjdGlvbkhhbmRsZXI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0YXN5bmMgZ2V0RG9jdW1lbnRDb21tZW50cyhyZXNvdXJjZTogVVJJKTogUHJvbWlzZTwoSUNvbW1lbnRJbmZvIHwgbnVsbClbXT4ge1xuXHRcdGNvbnN0IGNvbW1lbnRDb250cm9sUmVzdWx0OiBQcm9taXNlPElDb21tZW50SW5mbyB8IG51bGw+W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgY29udHJvbCBvZiB0aGlzLl9jb21tZW50Q29udHJvbHMudmFsdWVzKCkpIHtcblx0XHRcdGNvbW1lbnRDb250cm9sUmVzdWx0LnB1c2goY29udHJvbC5nZXREb2N1bWVudENvbW1lbnRzKHJlc291cmNlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKVxuXHRcdFx0XHQudGhlbihkb2N1bWVudENvbW1lbnRzID0+IHtcblx0XHRcdFx0XHQvLyBDaGVjayB0aGF0IHRoZXJlIGFyZW4ndCBhbnkgY29udGludWUgb24gY29tbWVudHMgaW4gdGhlIHByb3ZpZGVkIGNvbW1lbnRzXG5cdFx0XHRcdFx0Ly8gVGhpcyBjYW4gaGFwcGVuIGJlY2F1c2UgY29udGludWUgb24gY29tbWVudHMgYXJlIHN0b3JlZCBzZXBhcmF0ZWx5IGZyb20gbG9jYWwgdW4tc3VibWl0dGVkIGNvbW1lbnRzLlxuXHRcdFx0XHRcdGZvciAoY29uc3QgZG9jdW1lbnRDb21tZW50VGhyZWFkIG9mIGRvY3VtZW50Q29tbWVudHMudGhyZWFkcykge1xuXHRcdFx0XHRcdFx0aWYgKGRvY3VtZW50Q29tbWVudFRocmVhZC5jb21tZW50cz8ubGVuZ3RoID09PSAwICYmIGRvY3VtZW50Q29tbWVudFRocmVhZC5yYW5nZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnJlbW92ZUNvbnRpbnVlT25Db21tZW50KHsgcmFuZ2U6IGRvY3VtZW50Q29tbWVudFRocmVhZC5yYW5nZSwgdXJpOiByZXNvdXJjZSwgdW5pcXVlT3duZXI6IGRvY3VtZW50Q29tbWVudHMudW5pcXVlT3duZXIgfSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHBlbmRpbmdDb21tZW50cyA9IHRoaXMuX2NvbnRpbnVlT25Db21tZW50cy5nZXQoZG9jdW1lbnRDb21tZW50cy51bmlxdWVPd25lcik7XG5cdFx0XHRcdFx0ZG9jdW1lbnRDb21tZW50cy5wZW5kaW5nQ29tbWVudFRocmVhZHMgPSBwZW5kaW5nQ29tbWVudHM/LmZpbHRlcihwZW5kaW5nQ29tbWVudCA9PiBwZW5kaW5nQ29tbWVudC51cmkudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0cmV0dXJuIGRvY3VtZW50Q29tbWVudHM7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5jYXRjaChfID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1lbnRJbmZvcyA9IGF3YWl0IFByb21pc2UuYWxsKGNvbW1lbnRDb250cm9sUmVzdWx0KTtcblx0XHR0aGlzLl91cGRhdGVSZXNvdXJjZXNXaXRoQ29tbWVudGluZ1JhbmdlcyhyZXNvdXJjZSwgY29tbWVudEluZm9zKTtcblx0XHRyZXR1cm4gY29tbWVudEluZm9zO1xuXHR9XG5cblx0YXN5bmMgZ2V0Tm90ZWJvb2tDb21tZW50cyhyZXNvdXJjZTogVVJJKTogUHJvbWlzZTwoSU5vdGVib29rQ29tbWVudEluZm8gfCBudWxsKVtdPiB7XG5cdFx0Y29uc3QgY29tbWVudENvbnRyb2xSZXN1bHQ6IFByb21pc2U8SU5vdGVib29rQ29tbWVudEluZm8gfCBudWxsPltdID0gW107XG5cblx0XHR0aGlzLl9jb21tZW50Q29udHJvbHMuZm9yRWFjaChjb250cm9sID0+IHtcblx0XHRcdGNvbW1lbnRDb250cm9sUmVzdWx0LnB1c2goY29udHJvbC5nZXROb3RlYm9va0NvbW1lbnRzKHJlc291cmNlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKVxuXHRcdFx0XHQuY2F0Y2goXyA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChjb21tZW50Q29udHJvbFJlc3VsdCk7XG5cdH1cblxuXHRyZWdpc3RlckNvbnRpbnVlT25Db21tZW50UHJvdmlkZXIocHJvdmlkZXI6IElDb250aW51ZU9uQ29tbWVudFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuX2NvbnRpbnVlT25Db21tZW50UHJvdmlkZXJzLmFkZChwcm92aWRlcik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5fY29udGludWVPbkNvbW1lbnRQcm92aWRlcnMuZGVsZXRlKHByb3ZpZGVyKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfc2F2ZUNvbnRpbnVlT25Db21tZW50cyhtYXA6IE1hcDxzdHJpbmcsIFBlbmRpbmdDb21tZW50VGhyZWFkW10+KSB7XG5cdFx0Y29uc3QgY29tbWVudHNUb1NhdmU6IFBlbmRpbmdDb21tZW50VGhyZWFkW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHBlbmRpbmdDb21tZW50cyBvZiBtYXAudmFsdWVzKCkpIHtcblx0XHRcdGNvbW1lbnRzVG9TYXZlLnB1c2goLi4ucGVuZGluZ0NvbW1lbnRzKTtcblx0XHR9XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBDb21tZW50czogVVJJcyBvZiBjb250aW51ZSBvbiBjb21tZW50cyB0byBhZGQgdG8gc3RvcmFnZSAke2NvbW1lbnRzVG9TYXZlLm1hcCh0aHJlYWQgPT4gdGhyZWFkLnVyaS50b1N0cmluZygpKS5qb2luKCcsICcpfS5gKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKENPTlRJTlVFX09OX0NPTU1FTlRTLCBjb21tZW50c1RvU2F2ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHJlbW92ZUNvbnRpbnVlT25Db21tZW50KHBlbmRpbmdDb21tZW50OiB7IHJhbmdlOiBJUmFuZ2U7IHVyaTogVVJJOyB1bmlxdWVPd25lcjogc3RyaW5nOyBpc1JlcGx5PzogYm9vbGVhbiB9KTogUGVuZGluZ0NvbW1lbnRUaHJlYWQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHBlbmRpbmdDb21tZW50cyA9IHRoaXMuX2NvbnRpbnVlT25Db21tZW50cy5nZXQocGVuZGluZ0NvbW1lbnQudW5pcXVlT3duZXIpO1xuXHRcdGlmIChwZW5kaW5nQ29tbWVudHMpIHtcblx0XHRcdGNvbnN0IGNvbW1lbnRJbmRleCA9IHBlbmRpbmdDb21tZW50cy5maW5kSW5kZXgoY29tbWVudCA9PiBjb21tZW50LnVyaS50b1N0cmluZygpID09PSBwZW5kaW5nQ29tbWVudC51cmkudG9TdHJpbmcoKSAmJiBSYW5nZS5lcXVhbHNSYW5nZShjb21tZW50LnJhbmdlLCBwZW5kaW5nQ29tbWVudC5yYW5nZSkgJiYgKHBlbmRpbmdDb21tZW50LmlzUmVwbHkgPT09IHVuZGVmaW5lZCB8fCBjb21tZW50LmlzUmVwbHkgPT09IHBlbmRpbmdDb21tZW50LmlzUmVwbHkpKTtcblx0XHRcdGlmIChjb21tZW50SW5kZXggPiAtMSkge1xuXHRcdFx0XHRyZXR1cm4gcGVuZGluZ0NvbW1lbnRzLnNwbGljZShjb21tZW50SW5kZXgsIDEpWzBdO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkQ29udGludWVPbkNvbW1lbnRzKHBlbmRpbmdDb21tZW50czogUGVuZGluZ0NvbW1lbnRUaHJlYWRbXSwgbWFwOiBNYXA8c3RyaW5nLCBQZW5kaW5nQ29tbWVudFRocmVhZFtdPik6IFNldDxzdHJpbmc+IHtcblx0XHRjb25zdCBjaGFuZ2VkT3duZXJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCBwZW5kaW5nQ29tbWVudCBvZiBwZW5kaW5nQ29tbWVudHMpIHtcblx0XHRcdGlmICghbWFwLmhhcyhwZW5kaW5nQ29tbWVudC51bmlxdWVPd25lcikpIHtcblx0XHRcdFx0bWFwLnNldChwZW5kaW5nQ29tbWVudC51bmlxdWVPd25lciwgW3BlbmRpbmdDb21tZW50XSk7XG5cdFx0XHRcdGNoYW5nZWRPd25lcnMuYWRkKHBlbmRpbmdDb21tZW50LnVuaXF1ZU93bmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1lbnRzRm9yT3duZXIgPSBtYXAuZ2V0KHBlbmRpbmdDb21tZW50LnVuaXF1ZU93bmVyKSE7XG5cdFx0XHRcdGlmIChjb21tZW50c0Zvck93bmVyLmV2ZXJ5KGNvbW1lbnQgPT4gKGNvbW1lbnQudXJpLnRvU3RyaW5nKCkgIT09IHBlbmRpbmdDb21tZW50LnVyaS50b1N0cmluZygpKSB8fCAhUmFuZ2UuZXF1YWxzUmFuZ2UoY29tbWVudC5yYW5nZSwgcGVuZGluZ0NvbW1lbnQucmFuZ2UpKSkge1xuXHRcdFx0XHRcdGNvbW1lbnRzRm9yT3duZXIucHVzaChwZW5kaW5nQ29tbWVudCk7XG5cdFx0XHRcdFx0Y2hhbmdlZE93bmVycy5hZGQocGVuZGluZ0NvbW1lbnQudW5pcXVlT3duZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjaGFuZ2VkT3duZXJzO1xuXHR9XG5cblx0cmVzb3VyY2VIYXNDb21tZW50aW5nUmFuZ2VzKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY29tbWVudGluZ1JhbmdlUmVzb3VyY2VIaW50U2NoZW1lcy5oYXMocmVzb3VyY2Uuc2NoZW1lKSB8fCB0aGlzLl9jb21tZW50aW5nUmFuZ2VSZXNvdXJjZXMuaGFzKHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsaUJBQWlCLDZCQUE2QjtBQUN2RCxTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFTLFlBQVksdUJBQW9DO0FBRXpELFNBQVMsYUFBcUI7QUFDOUIsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx3QkFBZ0Q7QUFDekQsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUJBQXFDO0FBQzlDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZUFBZTtBQUVqQixNQUFNLGtCQUFrQixnQkFBaUMsZ0JBQWdCO0FBaUdoRixNQUFNLHVCQUF1QjtBQUV0QixJQUFNLGlCQUFOLGNBQTZCLFdBQXNDO0FBQUE7QUFBQSxFQTREekUsWUFDMkMsc0JBQ0EsZUFDRixzQkFDcEIsbUJBQ2MsZ0JBQ0osWUFD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
