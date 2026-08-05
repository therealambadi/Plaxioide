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
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { MOUSE_CURSOR_TEXT_CSS_CLASS_NAME } from "../../../../base/browser/ui/mouseCursor/mouseCursor.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { CommentFormActions } from "./commentFormActions.js";
import { ICommentService } from "./commentService.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { MIN_EDITOR_HEIGHT, SimpleCommentEditor, calculateEditorHeight } from "./simpleCommentEditor.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { Position } from "../../../../editor/common/core/position.js";
let INMEM_MODEL_ID = 0;
const COMMENTEDITOR_DECORATION_KEY = "commenteditordecoration";
let CommentReply = class extends Disposable {
  constructor(owner, container, _parentEditor, _commentThread, _scopedInstatiationService, _contextKeyService, _commentMenus, _commentOptions, _pendingComment, _parentThread, focus, _actionRunDelegate, commentService, configurationService, keybindingService, contextMenuService, hoverService, textModelService) {
    super();
    this.owner = owner;
    this._parentEditor = _parentEditor;
    this._commentThread = _commentThread;
    this._scopedInstatiationService = _scopedInstatiationService;
    this._contextKeyService = _contextKeyService;
    this._commentMenus = _commentMenus;
    this._commentOptions = _commentOptions;
    this._pendingComment = _pendingComment;
    this._parentThread = _parentThread;
    this._actionRunDelegate = _actionRunDelegate;
    this.commentService = commentService;
    this.keybindingService = keybindingService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this.textModelService = textModelService;
    this._commentThreadDisposables = [];
    this._editorHeight = MIN_EDITOR_HEIGHT;
    this.form = dom.append(container, dom.$(".comment-form"));
    this.commentEditor = this._register(this._scopedInstatiationService.createInstance(SimpleCommentEditor, this.form, SimpleCommentEditor.getEditorOptions(configurationService), _contextKeyService, this._parentThread));
    this.commentEditorIsEmpty = CommentContextKeys.commentIsEmpty.bindTo(this._contextKeyService);
    this.commentEditorIsEmpty.set(!this._pendingComment);
    this.initialize(focus);
  }
  async initialize(focus) {
    const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
    const modeId = generateUuid() + "-" + (hasExistingComments ? this._commentThread.threadId : ++INMEM_MODEL_ID);
    const params = JSON.stringify({
      extensionId: this._commentThread.extensionId,
      commentThreadId: this._commentThread.threadId
    });
    let resource = URI.from({
      scheme: Schemas.commentsInput,
      path: `/${this._commentThread.extensionId}/commentinput-${modeId}.md?${params}`
      // TODO. Remove params once extensions adopt authority.
    });
    const commentController = this.commentService.getCommentController(this.owner);
    if (commentController) {
      resource = resource.with({ authority: commentController.id });
    }
    const model = await this.textModelService.createModelReference(resource);
    model.object.textEditorModel.setValue(this._pendingComment?.body || "");
    this._register(model);
    this.commentEditor.setModel(model.object.textEditorModel);
    if (this._pendingComment) {
      this.commentEditor.setPosition(this._pendingComment.cursor);
    }
    this.calculateEditorHeight();
    this._register(model.object.textEditorModel.onDidChangeContent(() => {
      this.setCommentEditorDecorations();
      this.commentEditorIsEmpty?.set(!this.commentEditor.getValue());
      if (this.calculateEditorHeight()) {
        this.commentEditor.layout({ height: this._editorHeight, width: this.commentEditor.getLayoutInfo().width });
        this.commentEditor.render(true);
      }
    }));
    this.createTextModelListener(this.commentEditor, this.form);
    this.setCommentEditorDecorations();
    if (this._pendingComment) {
      this.expandReplyArea();
    } else if (hasExistingComments) {
      this.createReplyButton(this.commentEditor, this.form);
    } else if (focus && (this._commentThread.comments && this._commentThread.comments.length === 0)) {
      this.expandReplyArea();
    }
    this._error = dom.append(this.form, dom.$(".validation-error.hidden"));
    const formActions = dom.append(this.form, dom.$(".form-actions"));
    this._formActions = dom.append(formActions, dom.$(".other-actions"));
    this.createCommentWidgetFormActions(this._formActions, model.object.textEditorModel);
    this._editorActions = dom.append(formActions, dom.$(".editor-actions"));
    this.createCommentWidgetEditorActions(this._editorActions, model.object.textEditorModel);
  }
  calculateEditorHeight() {
    const newEditorHeight = calculateEditorHeight(this._parentEditor, this.commentEditor, this._editorHeight);
    if (newEditorHeight !== this._editorHeight) {
      this._editorHeight = newEditorHeight;
      return true;
    }
    return false;
  }
  updateCommentThread(commentThread) {
    const isReplying = this.commentEditor.hasTextFocus();
    const oldAndNewBothEmpty = !this._commentThread.comments?.length && !commentThread.comments?.length;
    if (!this._reviewThreadReplyButton) {
      this.createReplyButton(this.commentEditor, this.form);
    }
    if (this._commentThread.comments && this._commentThread.comments.length === 0 && !oldAndNewBothEmpty) {
      this.expandReplyArea();
    }
    if (isReplying) {
      this.commentEditor.focus();
    }
  }
  getPendingComment() {
    const model = this.commentEditor.getModel();
    if (model && model.getValueLength() > 0) {
      return { body: model.getValue(), cursor: this.commentEditor.getPosition() ?? new Position(1, 1) };
    }
    return void 0;
  }
  setPendingComment(pending) {
    this._pendingComment = pending;
    this.expandReplyArea();
    this.commentEditor.setValue(pending.body);
    this.commentEditor.setPosition(pending.cursor);
  }
  layout(widthInPixel) {
    this.commentEditor.layout({
      height: this._editorHeight,
      width: widthInPixel - 54
      /* margin 20px * 10 + scrollbar 14px*/
    });
  }
  focusIfNeeded() {
    if (!this._commentThread.comments || !this._commentThread.comments.length) {
      this.commentEditor.focus();
    } else if ((this.commentEditor.getModel()?.getValueLength() ?? 0) > 0) {
      this.expandReplyArea();
    }
  }
  focusCommentEditor() {
    this.commentEditor.focus();
  }
  expandReplyAreaAndFocusCommentEditor() {
    this.expandReplyArea();
    this.commentEditor.focus();
  }
  isCommentEditorFocused() {
    return this.commentEditor.hasWidgetFocus();
  }
  updateCanReply() {
    if (!this._commentThread.canReply) {
      this.form.style.display = "none";
    } else {
      this.form.style.display = "block";
    }
  }
  async submitComment() {
    await this._commentFormActions?.triggerDefaultAction();
    this._pendingComment = void 0;
  }
  setCommentEditorDecorations() {
    const hasExistingComments = this._commentThread.comments && this._commentThread.comments.length > 0;
    const placeholder = hasExistingComments ? this._commentOptions?.placeHolder || nls.localize("reply", "Reply...") : this._commentOptions?.placeHolder || nls.localize("newComment", "Type a new comment");
    this.commentEditor.updateOptions({ placeholder });
  }
  createTextModelListener(commentEditor, commentForm) {
    this._commentThreadDisposables.push(commentEditor.onDidFocusEditorWidget(() => {
      this._commentThread.input = {
        uri: commentEditor.getModel().uri,
        value: commentEditor.getValue()
      };
      this.commentService.setActiveEditingCommentThread(this._commentThread);
      this.commentService.setActiveCommentAndThread(this.owner, { thread: this._commentThread });
    }));
    this._commentThreadDisposables.push(commentEditor.getModel().onDidChangeContent(() => {
      const modelContent = commentEditor.getValue();
      if (this._commentThread.input && this._commentThread.input.uri === commentEditor.getModel().uri && this._commentThread.input.value !== modelContent) {
        const newInput = this._commentThread.input;
        newInput.value = modelContent;
        this._commentThread.input = newInput;
      }
      this.commentService.setActiveEditingCommentThread(this._commentThread);
    }));
    this._commentThreadDisposables.push(this._commentThread.onDidChangeInput((input) => {
      const thread = this._commentThread;
      const model = commentEditor.getModel();
      if (thread.input && model && thread.input.uri !== model.uri) {
        return;
      }
      if (!input) {
        return;
      }
      if (commentEditor.getValue() !== input.value) {
        commentEditor.setValue(input.value);
        if (input.value === "") {
          this._pendingComment = { body: "", cursor: new Position(1, 1) };
          commentForm.classList.remove("expand");
          commentEditor.getDomNode().style.outline = "";
          this._error.textContent = "";
          this._error.classList.add("hidden");
        }
      }
    }));
  }
  /**
   * Command based actions.
   */
  createCommentWidgetFormActions(container, model) {
    const menu = this._commentMenus.getCommentThreadActions(this._contextKeyService);
    this._register(menu);
    this._register(menu.onDidChange(() => {
      this._commentFormActions.setActions(menu);
    }));
    this._commentFormActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, async (action) => {
      await this._actionRunDelegate?.();
      await action.run({
        thread: this._commentThread,
        text: this.commentEditor.getValue(),
        $mid: MarshalledId.CommentThreadReply
      });
      this.hideReplyArea();
    });
    this._register(this._commentFormActions);
    this._commentFormActions.setActions(menu);
  }
  createCommentWidgetEditorActions(container, model) {
    const editorMenu = this._commentMenus.getCommentEditorActions(this._contextKeyService);
    this._register(editorMenu);
    this._register(editorMenu.onDidChange(() => {
      this._commentEditorActions.setActions(editorMenu, true);
    }));
    this._commentEditorActions = new CommentFormActions(this.keybindingService, this._contextKeyService, this.contextMenuService, container, async (action) => {
      this._actionRunDelegate?.();
      action.run({
        thread: this._commentThread,
        text: this.commentEditor.getValue(),
        $mid: MarshalledId.CommentThreadReply
      });
      this.focusCommentEditor();
    });
    this._register(this._commentEditorActions);
    this._commentEditorActions.setActions(editorMenu, true);
  }
  get isReplyExpanded() {
    return this.form.classList.contains("expand");
  }
  expandReplyArea() {
    if (!this.isReplyExpanded) {
      this.form.classList.add("expand");
      this.commentEditor.focus();
      this.commentEditor.layout();
    }
  }
  clearAndExpandReplyArea() {
    if (!this.isReplyExpanded) {
      this.commentEditor.setValue("");
      this.expandReplyArea();
    }
  }
  hideReplyArea() {
    const domNode = this.commentEditor.getDomNode();
    if (domNode) {
      domNode.style.outline = "";
    }
    this.commentEditor.setValue("");
    this._pendingComment = { body: "", cursor: new Position(1, 1) };
    this.form.classList.remove("expand");
    this._error.textContent = "";
    this._error.classList.add("hidden");
  }
  createReplyButton(commentEditor, commentForm) {
    this._reviewThreadReplyButton = dom.append(commentForm, dom.$(`button.review-thread-reply-button.${MOUSE_CURSOR_TEXT_CSS_CLASS_NAME}`));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this._reviewThreadReplyButton, this._commentOptions?.prompt || nls.localize("reply", "Reply...")));
    this._reviewThreadReplyButton.textContent = this._commentOptions?.prompt || nls.localize("reply", "Reply...");
    this._register(dom.addDisposableListener(this._reviewThreadReplyButton, "click", (_) => this.clearAndExpandReplyArea()));
    this._register(dom.addDisposableListener(this._reviewThreadReplyButton, "focus", (_) => this.clearAndExpandReplyArea()));
    this._register(commentEditor.onDidBlurEditorWidget(() => {
      if (commentEditor.getModel().getValueLength() === 0 && commentForm.classList.contains("expand")) {
        commentForm.classList.remove("expand");
      }
    }));
  }
  dispose() {
    super.dispose();
    dispose(this._commentThreadDisposables);
  }
};
CommentReply = __decorateClass([
  __decorateParam(12, ICommentService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IKeybindingService),
  __decorateParam(15, IContextMenuService),
  __decorateParam(16, IHoverService),
  __decorateParam(17, ITextModelService)
], CommentReply);
export {
  COMMENTEDITOR_DECORATION_KEY,
  CommentReply
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRSZXBseS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IE1PVVNFX0NVUlNPUl9URVhUX0NTU19DTEFTU19OQU1FIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL21vdXNlQ3Vyc29yL21vdXNlQ3Vyc29yLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nSWRzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBDb21tZW50Rm9ybUFjdGlvbnMgfSBmcm9tICcuL2NvbW1lbnRGb3JtQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tZW50TWVudXMgfSBmcm9tICcuL2NvbW1lbnRNZW51cy5qcyc7XG5pbXBvcnQgeyBJQ29tbWVudFNlcnZpY2UgfSBmcm9tICcuL2NvbW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbW1lbnRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRUaHJlYWRXaWRnZXQgfSBmcm9tICcuLi9jb21tb24vY29tbWVudFRocmVhZFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgTGF5b3V0YWJsZUVkaXRvciwgTUlOX0VESVRPUl9IRUlHSFQsIFNpbXBsZUNvbW1lbnRFZGl0b3IsIGNhbGN1bGF0ZUVkaXRvckhlaWdodCB9IGZyb20gJy4vc2ltcGxlQ29tbWVudEVkaXRvci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5cbmxldCBJTk1FTV9NT0RFTF9JRCA9IDA7XG5leHBvcnQgY29uc3QgQ09NTUVOVEVESVRPUl9ERUNPUkFUSU9OX0tFWSA9ICdjb21tZW50ZWRpdG9yZGVjb3JhdGlvbic7XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50UmVwbHk8VCBleHRlbmRzIElSYW5nZSB8IElDZWxsUmFuZ2U+IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbW1lbnRFZGl0b3I6IElDb2RlRWRpdG9yO1xuXHRmb3JtOiBIVE1MRWxlbWVudDtcblx0Y29tbWVudEVkaXRvcklzRW1wdHk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF9lcnJvciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9mb3JtQWN0aW9ucyE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9lZGl0b3JBY3Rpb25zITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXHRwcml2YXRlIF9jb21tZW50Rm9ybUFjdGlvbnMhOiBDb21tZW50Rm9ybUFjdGlvbnM7XG5cdHByaXZhdGUgX2NvbW1lbnRFZGl0b3JBY3Rpb25zITogQ29tbWVudEZvcm1BY3Rpb25zO1xuXHRwcml2YXRlIF9yZXZpZXdUaHJlYWRSZXBseUJ1dHRvbiE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9lZGl0b3JIZWlnaHQgPSBNSU5fRURJVE9SX0hFSUdIVDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBvd25lcjogc3RyaW5nLFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcGFyZW50RWRpdG9yOiBMYXlvdXRhYmxlRWRpdG9yLFxuXHRcdHByaXZhdGUgX2NvbW1lbnRUaHJlYWQ6IGxhbmd1YWdlcy5Db21tZW50VGhyZWFkPFQ+LFxuXHRcdHByaXZhdGUgX3Njb3BlZEluc3RhdGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgX2NvbW1lbnRNZW51czogQ29tbWVudE1lbnVzLFxuXHRcdHByaXZhdGUgX2NvbW1lbnRPcHRpb25zOiBsYW5ndWFnZXMuQ29tbWVudE9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfcGVuZGluZ0NvbW1lbnQ6IGxhbmd1YWdlcy5QZW5kaW5nQ29tbWVudCB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIF9wYXJlbnRUaHJlYWQ6IElDb21tZW50VGhyZWFkV2lkZ2V0LFxuXHRcdGZvY3VzOiBib29sZWFuLFxuXHRcdHByaXZhdGUgX2FjdGlvblJ1bkRlbGVnYXRlOiAoKCkgPT4gdm9pZCkgfCBudWxsLFxuXHRcdEBJQ29tbWVudFNlcnZpY2UgcHJpdmF0ZSBjb21tZW50U2VydmljZTogSUNvbW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByaXZhdGUga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5mb3JtID0gZG9tLmFwcGVuZChjb250YWluZXIsIGRvbS4kKCcuY29tbWVudC1mb3JtJykpO1xuXHRcdHRoaXMuY29tbWVudEVkaXRvciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Njb3BlZEluc3RhdGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2ltcGxlQ29tbWVudEVkaXRvciwgdGhpcy5mb3JtLCBTaW1wbGVDb21tZW50RWRpdG9yLmdldEVkaXRvck9wdGlvbnMoY29uZmlndXJhdGlvblNlcnZpY2UpLCBfY29udGV4dEtleVNlcnZpY2UsIHRoaXMuX3BhcmVudFRocmVhZCkpO1xuXHRcdHRoaXMuY29tbWVudEVkaXRvcklzRW1wdHkgPSBDb21tZW50Q29udGV4dEtleXMuY29tbWVudElzRW1wdHkuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmNvbW1lbnRFZGl0b3JJc0VtcHR5LnNldCghdGhpcy5fcGVuZGluZ0NvbW1lbnQpO1xuXG5cdFx0dGhpcy5pbml0aWFsaXplKGZvY3VzKTtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemUoZm9jdXM6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBoYXNFeGlzdGluZ0NvbW1lbnRzID0gdGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cyAmJiB0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCA+IDA7XG5cdFx0Y29uc3QgbW9kZUlkID0gZ2VuZXJhdGVVdWlkKCkgKyAnLScgKyAoaGFzRXhpc3RpbmdDb21tZW50cyA/IHRoaXMuX2NvbW1lbnRUaHJlYWQudGhyZWFkSWQgOiArK0lOTUVNX01PREVMX0lEKTtcblx0XHRjb25zdCBwYXJhbXMgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRleHRlbnNpb25JZDogdGhpcy5fY29tbWVudFRocmVhZC5leHRlbnNpb25JZCxcblx0XHRcdGNvbW1lbnRUaHJlYWRJZDogdGhpcy5fY29tbWVudFRocmVhZC50aHJlYWRJZFxuXHRcdH0pO1xuXG5cdFx0bGV0IHJlc291cmNlID0gVVJJLmZyb20oe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLmNvbW1lbnRzSW5wdXQsXG5cdFx0XHRwYXRoOiBgLyR7dGhpcy5fY29tbWVudFRocmVhZC5leHRlbnNpb25JZH0vY29tbWVudGlucHV0LSR7bW9kZUlkfS5tZD8ke3BhcmFtc31gIC8vIFRPRE8uIFJlbW92ZSBwYXJhbXMgb25jZSBleHRlbnNpb25zIGFkb3B0IGF1dGhvcml0eS5cblx0XHR9KTtcblx0XHRjb25zdCBjb21tZW50Q29udHJvbGxlciA9IHRoaXMuY29tbWVudFNlcnZpY2UuZ2V0Q29tbWVudENvbnRyb2xsZXIodGhpcy5vd25lcik7XG5cdFx0aWYgKGNvbW1lbnRDb250cm9sbGVyKSB7XG5cdFx0XHRyZXNvdXJjZSA9IHJlc291cmNlLndpdGgoeyBhdXRob3JpdHk6IGNvbW1lbnRDb250cm9sbGVyLmlkIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHJlc291cmNlKTtcblx0XHRtb2RlbC5vYmplY3QudGV4dEVkaXRvck1vZGVsLnNldFZhbHVlKHRoaXMuX3BlbmRpbmdDb21tZW50Py5ib2R5IHx8ICcnKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsKTtcblx0XHR0aGlzLmNvbW1lbnRFZGl0b3Iuc2V0TW9kZWwobW9kZWwub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cdFx0aWYgKHRoaXMuX3BlbmRpbmdDb21tZW50KSB7XG5cdFx0XHR0aGlzLmNvbW1lbnRFZGl0b3Iuc2V0UG9zaXRpb24odGhpcy5fcGVuZGluZ0NvbW1lbnQuY3Vyc29yKTtcblx0XHR9XG5cdFx0dGhpcy5jYWxjdWxhdGVFZGl0b3JIZWlnaHQoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdHRoaXMuc2V0Q29tbWVudEVkaXRvckRlY29yYXRpb25zKCk7XG5cdFx0XHR0aGlzLmNvbW1lbnRFZGl0b3JJc0VtcHR5Py5zZXQoIXRoaXMuY29tbWVudEVkaXRvci5nZXRWYWx1ZSgpKTtcblx0XHRcdGlmICh0aGlzLmNhbGN1bGF0ZUVkaXRvckhlaWdodCgpKSB7XG5cdFx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5sYXlvdXQoeyBoZWlnaHQ6IHRoaXMuX2VkaXRvckhlaWdodCwgd2lkdGg6IHRoaXMuY29tbWVudEVkaXRvci5nZXRMYXlvdXRJbmZvKCkud2lkdGggfSk7XG5cdFx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5yZW5kZXIodHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jcmVhdGVUZXh0TW9kZWxMaXN0ZW5lcih0aGlzLmNvbW1lbnRFZGl0b3IsIHRoaXMuZm9ybSk7XG5cblx0XHR0aGlzLnNldENvbW1lbnRFZGl0b3JEZWNvcmF0aW9ucygpO1xuXG5cdFx0Ly8gT25seSBhZGQgdGhlIGFkZGl0aW9uYWwgc3RlcCBvZiBjbGlja2luZyBhIHJlcGx5IGJ1dHRvbiB0byBleHBhbmQgdGhlIHRleHRhcmVhIHdoZW4gdGhlcmUgYXJlIGV4aXN0aW5nIGNvbW1lbnRzXG5cdFx0aWYgKHRoaXMuX3BlbmRpbmdDb21tZW50KSB7XG5cdFx0XHR0aGlzLmV4cGFuZFJlcGx5QXJlYSgpO1xuXHRcdH0gZWxzZSBpZiAoaGFzRXhpc3RpbmdDb21tZW50cykge1xuXHRcdFx0dGhpcy5jcmVhdGVSZXBseUJ1dHRvbih0aGlzLmNvbW1lbnRFZGl0b3IsIHRoaXMuZm9ybSk7XG5cdFx0fSBlbHNlIGlmIChmb2N1cyAmJiAodGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cyAmJiB0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRcdHRoaXMuZXhwYW5kUmVwbHlBcmVhKCk7XG5cdFx0fVxuXHRcdHRoaXMuX2Vycm9yID0gZG9tLmFwcGVuZCh0aGlzLmZvcm0sIGRvbS4kKCcudmFsaWRhdGlvbi1lcnJvci5oaWRkZW4nKSk7XG5cdFx0Y29uc3QgZm9ybUFjdGlvbnMgPSBkb20uYXBwZW5kKHRoaXMuZm9ybSwgZG9tLiQoJy5mb3JtLWFjdGlvbnMnKSk7XG5cdFx0dGhpcy5fZm9ybUFjdGlvbnMgPSBkb20uYXBwZW5kKGZvcm1BY3Rpb25zLCBkb20uJCgnLm90aGVyLWFjdGlvbnMnKSk7XG5cdFx0dGhpcy5jcmVhdGVDb21tZW50V2lkZ2V0Rm9ybUFjdGlvbnModGhpcy5fZm9ybUFjdGlvbnMsIG1vZGVsLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwpO1xuXHRcdHRoaXMuX2VkaXRvckFjdGlvbnMgPSBkb20uYXBwZW5kKGZvcm1BY3Rpb25zLCBkb20uJCgnLmVkaXRvci1hY3Rpb25zJykpO1xuXHRcdHRoaXMuY3JlYXRlQ29tbWVudFdpZGdldEVkaXRvckFjdGlvbnModGhpcy5fZWRpdG9yQWN0aW9ucywgbW9kZWwub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cdH1cblxuXHRwcml2YXRlIGNhbGN1bGF0ZUVkaXRvckhlaWdodCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBuZXdFZGl0b3JIZWlnaHQgPSBjYWxjdWxhdGVFZGl0b3JIZWlnaHQodGhpcy5fcGFyZW50RWRpdG9yLCB0aGlzLmNvbW1lbnRFZGl0b3IsIHRoaXMuX2VkaXRvckhlaWdodCk7XG5cdFx0aWYgKG5ld0VkaXRvckhlaWdodCAhPT0gdGhpcy5fZWRpdG9ySGVpZ2h0KSB7XG5cdFx0XHR0aGlzLl9lZGl0b3JIZWlnaHQgPSBuZXdFZGl0b3JIZWlnaHQ7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZUNvbW1lbnRUaHJlYWQoY29tbWVudFRocmVhZDogbGFuZ3VhZ2VzLkNvbW1lbnRUaHJlYWQ8SVJhbmdlIHwgSUNlbGxSYW5nZT4pIHtcblx0XHRjb25zdCBpc1JlcGx5aW5nID0gdGhpcy5jb21tZW50RWRpdG9yLmhhc1RleHRGb2N1cygpO1xuXHRcdGNvbnN0IG9sZEFuZE5ld0JvdGhFbXB0eSA9ICF0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzPy5sZW5ndGggJiYgIWNvbW1lbnRUaHJlYWQuY29tbWVudHM/Lmxlbmd0aDtcblxuXHRcdGlmICghdGhpcy5fcmV2aWV3VGhyZWFkUmVwbHlCdXR0b24pIHtcblx0XHRcdHRoaXMuY3JlYXRlUmVwbHlCdXR0b24odGhpcy5jb21tZW50RWRpdG9yLCB0aGlzLmZvcm0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzICYmIHRoaXMuX2NvbW1lbnRUaHJlYWQuY29tbWVudHMubGVuZ3RoID09PSAwICYmICFvbGRBbmROZXdCb3RoRW1wdHkpIHtcblx0XHRcdHRoaXMuZXhwYW5kUmVwbHlBcmVhKCk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzUmVwbHlpbmcpIHtcblx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRQZW5kaW5nQ29tbWVudCgpOiBsYW5ndWFnZXMuUGVuZGluZ0NvbW1lbnQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5jb21tZW50RWRpdG9yLmdldE1vZGVsKCk7XG5cblx0XHRpZiAobW9kZWwgJiYgbW9kZWwuZ2V0VmFsdWVMZW5ndGgoKSA+IDApIHsgLy8gY2hlY2tpbmcgbGVuZ3RoIGlzIGNoZWFwXG5cdFx0XHRyZXR1cm4geyBib2R5OiBtb2RlbC5nZXRWYWx1ZSgpLCBjdXJzb3I6IHRoaXMuY29tbWVudEVkaXRvci5nZXRQb3NpdGlvbigpID8/IG5ldyBQb3NpdGlvbigxLCAxKSB9O1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgc2V0UGVuZGluZ0NvbW1lbnQocGVuZGluZzogbGFuZ3VhZ2VzLlBlbmRpbmdDb21tZW50KSB7XG5cdFx0dGhpcy5fcGVuZGluZ0NvbW1lbnQgPSBwZW5kaW5nO1xuXHRcdHRoaXMuZXhwYW5kUmVwbHlBcmVhKCk7XG5cdFx0dGhpcy5jb21tZW50RWRpdG9yLnNldFZhbHVlKHBlbmRpbmcuYm9keSk7XG5cdFx0dGhpcy5jb21tZW50RWRpdG9yLnNldFBvc2l0aW9uKHBlbmRpbmcuY3Vyc29yKTtcblx0fVxuXG5cdHB1YmxpYyBsYXlvdXQod2lkdGhJblBpeGVsOiBudW1iZXIpIHtcblx0XHR0aGlzLmNvbW1lbnRFZGl0b3IubGF5b3V0KHsgaGVpZ2h0OiB0aGlzLl9lZGl0b3JIZWlnaHQsIHdpZHRoOiB3aWR0aEluUGl4ZWwgLSA1NCAvKiBtYXJnaW4gMjBweCAqIDEwICsgc2Nyb2xsYmFyIDE0cHgqLyB9KTtcblx0fVxuXG5cdHB1YmxpYyBmb2N1c0lmTmVlZGVkKCkge1xuXHRcdGlmICghdGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cyB8fCAhdGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5mb2N1cygpO1xuXHRcdH0gZWxzZSBpZiAoKHRoaXMuY29tbWVudEVkaXRvci5nZXRNb2RlbCgpPy5nZXRWYWx1ZUxlbmd0aCgpID8/IDApID4gMCkge1xuXHRcdFx0dGhpcy5leHBhbmRSZXBseUFyZWEoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZm9jdXNDb21tZW50RWRpdG9yKCkge1xuXHRcdHRoaXMuY29tbWVudEVkaXRvci5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGV4cGFuZFJlcGx5QXJlYUFuZEZvY3VzQ29tbWVudEVkaXRvcigpIHtcblx0XHR0aGlzLmV4cGFuZFJlcGx5QXJlYSgpO1xuXHRcdHRoaXMuY29tbWVudEVkaXRvci5mb2N1cygpO1xuXHR9XG5cblx0cHVibGljIGlzQ29tbWVudEVkaXRvckZvY3VzZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29tbWVudEVkaXRvci5oYXNXaWRnZXRGb2N1cygpO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZUNhblJlcGx5KCkge1xuXHRcdGlmICghdGhpcy5fY29tbWVudFRocmVhZC5jYW5SZXBseSkge1xuXHRcdFx0dGhpcy5mb3JtLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9ybS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzdWJtaXRDb21tZW50KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucz8udHJpZ2dlckRlZmF1bHRBY3Rpb24oKTtcblx0XHR0aGlzLl9wZW5kaW5nQ29tbWVudCA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldENvbW1lbnRFZGl0b3JEZWNvcmF0aW9ucygpIHtcblx0XHRjb25zdCBoYXNFeGlzdGluZ0NvbW1lbnRzID0gdGhpcy5fY29tbWVudFRocmVhZC5jb21tZW50cyAmJiB0aGlzLl9jb21tZW50VGhyZWFkLmNvbW1lbnRzLmxlbmd0aCA+IDA7XG5cdFx0Y29uc3QgcGxhY2Vob2xkZXIgPSBoYXNFeGlzdGluZ0NvbW1lbnRzXG5cdFx0XHQ/ICh0aGlzLl9jb21tZW50T3B0aW9ucz8ucGxhY2VIb2xkZXIgfHwgbmxzLmxvY2FsaXplKCdyZXBseScsIFwiUmVwbHkuLi5cIikpXG5cdFx0XHQ6ICh0aGlzLl9jb21tZW50T3B0aW9ucz8ucGxhY2VIb2xkZXIgfHwgbmxzLmxvY2FsaXplKCduZXdDb21tZW50JywgXCJUeXBlIGEgbmV3IGNvbW1lbnRcIikpO1xuXG5cdFx0dGhpcy5jb21tZW50RWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyBwbGFjZWhvbGRlciB9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGV4dE1vZGVsTGlzdGVuZXIoY29tbWVudEVkaXRvcjogSUNvZGVFZGl0b3IsIGNvbW1lbnRGb3JtOiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMuX2NvbW1lbnRUaHJlYWREaXNwb3NhYmxlcy5wdXNoKGNvbW1lbnRFZGl0b3Iub25EaWRGb2N1c0VkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21tZW50VGhyZWFkLmlucHV0ID0ge1xuXHRcdFx0XHR1cmk6IGNvbW1lbnRFZGl0b3IuZ2V0TW9kZWwoKSEudXJpLFxuXHRcdFx0XHR2YWx1ZTogY29tbWVudEVkaXRvci5nZXRWYWx1ZSgpXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5jb21tZW50U2VydmljZS5zZXRBY3RpdmVFZGl0aW5nQ29tbWVudFRocmVhZCh0aGlzLl9jb21tZW50VGhyZWFkKTtcblx0XHRcdHRoaXMuY29tbWVudFNlcnZpY2Uuc2V0QWN0aXZlQ29tbWVudEFuZFRocmVhZCh0aGlzLm93bmVyLCB7IHRocmVhZDogdGhpcy5fY29tbWVudFRocmVhZCB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMucHVzaChjb21tZW50RWRpdG9yLmdldE1vZGVsKCkhLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbENvbnRlbnQgPSBjb21tZW50RWRpdG9yLmdldFZhbHVlKCk7XG5cdFx0XHRpZiAodGhpcy5fY29tbWVudFRocmVhZC5pbnB1dCAmJiB0aGlzLl9jb21tZW50VGhyZWFkLmlucHV0LnVyaSA9PT0gY29tbWVudEVkaXRvci5nZXRNb2RlbCgpIS51cmkgJiYgdGhpcy5fY29tbWVudFRocmVhZC5pbnB1dC52YWx1ZSAhPT0gbW9kZWxDb250ZW50KSB7XG5cdFx0XHRcdGNvbnN0IG5ld0lucHV0OiBsYW5ndWFnZXMuQ29tbWVudElucHV0ID0gdGhpcy5fY29tbWVudFRocmVhZC5pbnB1dDtcblx0XHRcdFx0bmV3SW5wdXQudmFsdWUgPSBtb2RlbENvbnRlbnQ7XG5cdFx0XHRcdHRoaXMuX2NvbW1lbnRUaHJlYWQuaW5wdXQgPSBuZXdJbnB1dDtcblx0XHRcdH1cblx0XHRcdHRoaXMuY29tbWVudFNlcnZpY2Uuc2V0QWN0aXZlRWRpdGluZ0NvbW1lbnRUaHJlYWQodGhpcy5fY29tbWVudFRocmVhZCk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY29tbWVudFRocmVhZERpc3Bvc2FibGVzLnB1c2godGhpcy5fY29tbWVudFRocmVhZC5vbkRpZENoYW5nZUlucHV0KGlucHV0ID0+IHtcblx0XHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuX2NvbW1lbnRUaHJlYWQ7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNvbW1lbnRFZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdGlmICh0aHJlYWQuaW5wdXQgJiYgbW9kZWwgJiYgKHRocmVhZC5pbnB1dC51cmkgIT09IG1vZGVsLnVyaSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpbnB1dCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb21tZW50RWRpdG9yLmdldFZhbHVlKCkgIT09IGlucHV0LnZhbHVlKSB7XG5cdFx0XHRcdGNvbW1lbnRFZGl0b3Iuc2V0VmFsdWUoaW5wdXQudmFsdWUpO1xuXG5cdFx0XHRcdGlmIChpbnB1dC52YWx1ZSA9PT0gJycpIHtcblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nQ29tbWVudCA9IHsgYm9keTogJycsIGN1cnNvcjogbmV3IFBvc2l0aW9uKDEsIDEpIH07XG5cdFx0XHRcdFx0Y29tbWVudEZvcm0uY2xhc3NMaXN0LnJlbW92ZSgnZXhwYW5kJyk7XG5cdFx0XHRcdFx0Y29tbWVudEVkaXRvci5nZXREb21Ob2RlKCkhLnN0eWxlLm91dGxpbmUgPSAnJztcblx0XHRcdFx0XHR0aGlzLl9lcnJvci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0XHRcdHRoaXMuX2Vycm9yLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbW1hbmQgYmFzZWQgYWN0aW9ucy5cblx0ICovXG5cdHByaXZhdGUgY3JlYXRlQ29tbWVudFdpZGdldEZvcm1BY3Rpb25zKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0Y29uc3QgbWVudSA9IHRoaXMuX2NvbW1lbnRNZW51cy5nZXRDb21tZW50VGhyZWFkQWN0aW9ucyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihtZW51KTtcblx0XHR0aGlzLl9yZWdpc3RlcihtZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucy5zZXRBY3Rpb25zKG1lbnUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucyA9IG5ldyBDb21tZW50Rm9ybUFjdGlvbnModGhpcy5rZXliaW5kaW5nU2VydmljZSwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UsIHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLCBjb250YWluZXIsIGFzeW5jIChhY3Rpb246IElBY3Rpb24pID0+IHtcblx0XHRcdGF3YWl0IHRoaXMuX2FjdGlvblJ1bkRlbGVnYXRlPy4oKTtcblxuXHRcdFx0YXdhaXQgYWN0aW9uLnJ1bih7XG5cdFx0XHRcdHRocmVhZDogdGhpcy5fY29tbWVudFRocmVhZCxcblx0XHRcdFx0dGV4dDogdGhpcy5jb21tZW50RWRpdG9yLmdldFZhbHVlKCksXG5cdFx0XHRcdCRtaWQ6IE1hcnNoYWxsZWRJZC5Db21tZW50VGhyZWFkUmVwbHlcblx0XHRcdH0pO1xuXG5cdFx0XHR0aGlzLmhpZGVSZXBseUFyZWEoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbW1lbnRGb3JtQWN0aW9ucyk7XG5cdFx0dGhpcy5fY29tbWVudEZvcm1BY3Rpb25zLnNldEFjdGlvbnMobWVudSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvbW1lbnRXaWRnZXRFZGl0b3JBY3Rpb25zKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0Y29uc3QgZWRpdG9yTWVudSA9IHRoaXMuX2NvbW1lbnRNZW51cy5nZXRDb21tZW50RWRpdG9yQWN0aW9ucyh0aGlzLl9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yTWVudSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yTWVudS5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9jb21tZW50RWRpdG9yQWN0aW9ucy5zZXRBY3Rpb25zKGVkaXRvck1lbnUsIHRydWUpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2NvbW1lbnRFZGl0b3JBY3Rpb25zID0gbmV3IENvbW1lbnRGb3JtQWN0aW9ucyh0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsIGNvbnRhaW5lciwgYXN5bmMgKGFjdGlvbjogSUFjdGlvbikgPT4ge1xuXHRcdFx0dGhpcy5fYWN0aW9uUnVuRGVsZWdhdGU/LigpO1xuXG5cdFx0XHRhY3Rpb24ucnVuKHtcblx0XHRcdFx0dGhyZWFkOiB0aGlzLl9jb21tZW50VGhyZWFkLFxuXHRcdFx0XHR0ZXh0OiB0aGlzLmNvbW1lbnRFZGl0b3IuZ2V0VmFsdWUoKSxcblx0XHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLkNvbW1lbnRUaHJlYWRSZXBseVxuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuZm9jdXNDb21tZW50RWRpdG9yKCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb21tZW50RWRpdG9yQWN0aW9ucyk7XG5cdFx0dGhpcy5fY29tbWVudEVkaXRvckFjdGlvbnMuc2V0QWN0aW9ucyhlZGl0b3JNZW51LCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGlzUmVwbHlFeHBhbmRlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5mb3JtLmNsYXNzTGlzdC5jb250YWlucygnZXhwYW5kJyk7XG5cdH1cblxuXHRwcml2YXRlIGV4cGFuZFJlcGx5QXJlYSgpIHtcblx0XHRpZiAoIXRoaXMuaXNSZXBseUV4cGFuZGVkKSB7XG5cdFx0XHR0aGlzLmZvcm0uY2xhc3NMaXN0LmFkZCgnZXhwYW5kJyk7XG5cdFx0XHR0aGlzLmNvbW1lbnRFZGl0b3IuZm9jdXMoKTtcblx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyQW5kRXhwYW5kUmVwbHlBcmVhKCkge1xuXHRcdGlmICghdGhpcy5pc1JlcGx5RXhwYW5kZWQpIHtcblx0XHRcdHRoaXMuY29tbWVudEVkaXRvci5zZXRWYWx1ZSgnJyk7XG5cdFx0XHR0aGlzLmV4cGFuZFJlcGx5QXJlYSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgaGlkZVJlcGx5QXJlYSgpIHtcblx0XHRjb25zdCBkb21Ob2RlID0gdGhpcy5jb21tZW50RWRpdG9yLmdldERvbU5vZGUoKTtcblx0XHRpZiAoZG9tTm9kZSkge1xuXHRcdFx0ZG9tTm9kZS5zdHlsZS5vdXRsaW5lID0gJyc7XG5cdFx0fVxuXHRcdHRoaXMuY29tbWVudEVkaXRvci5zZXRWYWx1ZSgnJyk7XG5cdFx0dGhpcy5fcGVuZGluZ0NvbW1lbnQgPSB7IGJvZHk6ICcnLCBjdXJzb3I6IG5ldyBQb3NpdGlvbigxLCAxKSB9O1xuXHRcdHRoaXMuZm9ybS5jbGFzc0xpc3QucmVtb3ZlKCdleHBhbmQnKTtcblx0XHR0aGlzLl9lcnJvci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdHRoaXMuX2Vycm9yLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVSZXBseUJ1dHRvbihjb21tZW50RWRpdG9yOiBJQ29kZUVkaXRvciwgY29tbWVudEZvcm06IEhUTUxFbGVtZW50KSB7XG5cdFx0dGhpcy5fcmV2aWV3VGhyZWFkUmVwbHlCdXR0b24gPSA8SFRNTEJ1dHRvbkVsZW1lbnQ+ZG9tLmFwcGVuZChjb21tZW50Rm9ybSwgZG9tLiQoYGJ1dHRvbi5yZXZpZXctdGhyZWFkLXJlcGx5LWJ1dHRvbi4ke01PVVNFX0NVUlNPUl9URVhUX0NTU19DTEFTU19OQU1FfWApKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5fcmV2aWV3VGhyZWFkUmVwbHlCdXR0b24sIHRoaXMuX2NvbW1lbnRPcHRpb25zPy5wcm9tcHQgfHwgbmxzLmxvY2FsaXplKCdyZXBseScsIFwiUmVwbHkuLi5cIikpKTtcblxuXHRcdHRoaXMuX3Jldmlld1RocmVhZFJlcGx5QnV0dG9uLnRleHRDb250ZW50ID0gdGhpcy5fY29tbWVudE9wdGlvbnM/LnByb21wdCB8fCBubHMubG9jYWxpemUoJ3JlcGx5JywgXCJSZXBseS4uLlwiKTtcblx0XHQvLyBiaW5kIGNsaWNrL2VzY2FwZSBhY3Rpb25zIGZvciByZXZpZXdUaHJlYWRSZXBseUJ1dHRvbiBhbmQgdGV4dEFyZWFcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX3Jldmlld1RocmVhZFJlcGx5QnV0dG9uLCAnY2xpY2snLCBfID0+IHRoaXMuY2xlYXJBbmRFeHBhbmRSZXBseUFyZWEoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fcmV2aWV3VGhyZWFkUmVwbHlCdXR0b24sICdmb2N1cycsIF8gPT4gdGhpcy5jbGVhckFuZEV4cGFuZFJlcGx5QXJlYSgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb21tZW50RWRpdG9yLm9uRGlkQmx1ckVkaXRvcldpZGdldCgoKSA9PiB7XG5cdFx0XHRpZiAoY29tbWVudEVkaXRvci5nZXRNb2RlbCgpIS5nZXRWYWx1ZUxlbmd0aCgpID09PSAwICYmIGNvbW1lbnRGb3JtLmNsYXNzTGlzdC5jb250YWlucygnZXhwYW5kJykpIHtcblx0XHRcdFx0Y29tbWVudEZvcm0uY2xhc3NMaXN0LnJlbW92ZSgnZXhwYW5kJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9jb21tZW50VGhyZWFkRGlzcG9zYWJsZXMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHdDQUF3QztBQUVqRCxTQUFTLFlBQXlCLGVBQWU7QUFDakQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUs3QixTQUFTLHlCQUF5QjtBQUNsQyxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFHdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFHbkMsU0FBMkIsbUJBQW1CLHFCQUFxQiw2QkFBNkI7QUFDaEcsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxnQkFBZ0I7QUFFekIsSUFBSSxpQkFBaUI7QUFDZCxNQUFNLCtCQUErQjtBQUVyQyxJQUFNLGVBQU4sY0FBMEQsV0FBVztBQUFBLEVBYTNFLFlBQ1UsT0FDVCxXQUNpQixlQUNULGdCQUNBLDRCQUNBLG9CQUNBLGVBQ0EsaUJBQ0EsaUJBQ0EsZUFDUixPQUNRLG9CQUNpQixnQkFDRixzQkFDSyxtQkFDQyxvQkFDTixjQUNhLGtCQUNuQztBQUNELFVBQU07QUFuQkc7QUFFUTtBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRUE7QUFDaUI7QUFFRztBQUNDO0FBQ047QUFDYTtBQXhCckMsU0FBUSw0QkFBMkMsQ0FBQztBQUlwRCxTQUFRLGdCQUFnQjtBQXdCdkIsU0FBSyxPQUFPLElBQUksT0FBTyxXQUFXLElBQUksRUFBRSxlQUFlLENBQUM7QUFDeEQsU0FBSyxnQkFBZ0IsS0FBSyxVQUFVLEtBQUssMkJBQTJCLGVBQWUscUJBQXFCLEtBQUssTUFBTSxvQkFBb0IsaUJBQWlCLG9CQUFv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
